"""
app.py — FastAPI Production Server for RPrime True-DFT & AutoDock Vina 1.2
Hugging Face Spaces Docker Target (Port 7860)

Exposes:
  - GET  /health
  - POST /api/v1/dft         (Kohn-Sham df-wB97X-D/def2-SVP + ddCOSMO + .cube.gz + Fukui + Delta E_cov)
  - POST /api/v1/dft/stream  (Server-Sent Events real-time Kohn-Sham SCF iteration stream)
  - POST /api/v1/dock        (RCSB PDB / AlphaFold + 7-Axis LIGSITE Gate + Meeko + AutoDock Vina 1.2)
"""

from __future__ import annotations

import asyncio
import hmac
import json
import os
import shutil
from collections import OrderedDict
from typing import Any, AsyncGenerator, Dict, List, Optional, Tuple

from fastapi import Depends, FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field

from docking_engine import DockingGateError, run_docking_pipeline
from quantum_engine import (
    MAX_HAC,
    MAX_MW,
    GatekeeperError,
    run_kohn_sham_dft_pipeline,
    validate_and_analyze_smiles,
)

USE_GPU_DEFAULT: bool = os.environ.get("RPRIME_USE_GPU", "0").strip().lower() in ("1", "true", "yes")
MAX_CONCURRENT_JOBS: int = max(1, int(os.environ.get("RPRIME_MAX_CONCURRENCY", "2")))
LRU_MAX_ENTRIES: int = 128

app = FastAPI(
    title="RPrime True-DFT & AutoDock Vina 1.2 Engine",
    description=(
        "Authentic Kohn-Sham PySCF (df-wB97X-D/def2-SVP + ddCOSMO) and AutoDock Vina 1.2 "
        "microservice for Neuroscience with RPrime Discovery OS."
    ),
    version="1.0.0",
)

# Configure strict CORS with sensible RPrime defaults
_raw_origins = os.environ.get("ALLOWED_ORIGINS", "").strip()
if _raw_origins == "*":
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=False,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["Content-Type", "Authorization", "X-RPrime-Gateway-Key"],
    )
elif _raw_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[o.strip() for o in _raw_origins.split(",") if o.strip()],
        allow_credentials=False,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["Content-Type", "Authorization", "X-RPrime-Gateway-Key"],
    )
else:
    app.add_middleware(
        CORSMiddleware,
        allow_origin_regex=r"^(https://([a-zA-Z0-9-]+\.)?(github\.io|pages\.dev|huggingface\.co|hf\.space)|http://(localhost|127\.0\.0\.1)(:\d+)?|null)$",
        allow_credentials=False,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["Content-Type", "Authorization", "X-RPrime-Gateway-Key"],
    )


# ----------------------------------------------------------------------------
# AUTHENTICATION, SINGLE-FLIGHT COALESCING & IN-MEMORY LRU CACHE
# ----------------------------------------------------------------------------
def verify_gateway_key(
    x_rprime_gateway_key: Optional[str] = Header(default=None, alias="X-RPrime-Gateway-Key")
) -> None:
    """
    Validates optional X-RPrime-Gateway-Key using constant-time hmac.compare_digest
    whenever RPRIME_GATEWAY_KEY is configured in the container environment.
    """
    expected = os.environ.get("RPRIME_GATEWAY_KEY", "").strip()
    if not expected:
        return
    provided = (x_rprime_gateway_key or "").strip()
    if not provided or not hmac.compare_digest(provided.encode("utf-8"), expected.encode("utf-8")):
        raise HTTPException(status_code=401, detail="Invalid or missing X-RPrime-Gateway-Key.")


class SingleFlightRegistry:
    """Coalesces concurrent identical requests onto a single compute execution with clean teardown."""

    def __init__(self) -> None:
        self._locks: Dict[str, asyncio.Lock] = {}
        self._waiters: Dict[str, int] = {}
        self._guard = asyncio.Lock()

    async def acquire(self, key: str) -> asyncio.Lock:
        async with self._guard:
            lock = self._locks.get(key)
            if lock is None:
                lock = asyncio.Lock()
                self._locks[key] = lock
            self._waiters[key] = self._waiters.get(key, 0) + 1
        await lock.acquire()
        return lock

    async def release(self, key: str, lock: asyncio.Lock) -> None:
        lock.release()
        async with self._guard:
            rem = self._waiters.get(key, 1) - 1
            if rem <= 0:
                self._waiters.pop(key, None)
                self._locks.pop(key, None)
            else:
                self._waiters[key] = rem

    @property
    def active_keys(self) -> int:
        return len(self._locks)


_COMPUTE_SEMAPHORE = asyncio.Semaphore(MAX_CONCURRENT_JOBS)
_SINGLE_FLIGHT = SingleFlightRegistry()
_DFT_LRU: "OrderedDict[str, Dict[str, Any]]" = OrderedDict()
_DOCK_LRU: "OrderedDict[str, Dict[str, Any]]" = OrderedDict()


def _lru_get(store: "OrderedDict[str, Dict[str, Any]]", key: str) -> Optional[Dict[str, Any]]:
    val = store.get(key)
    if val is not None:
        store.move_to_end(key)
    return val


def _lru_put(store: "OrderedDict[str, Dict[str, Any]]", key: str, val: Dict[str, Any]) -> None:
    store[key] = val
    store.move_to_end(key)
    while len(store) > LRU_MAX_ENTRIES:
        store.popitem(last=False)


# ----------------------------------------------------------------------------
# REQUEST SCHEMAS
# ----------------------------------------------------------------------------
class DFTRequest(BaseModel):
    smiles: str = Field(..., min_length=1, max_length=400, description="Input ligand SMILES")
    mol_name: Optional[str] = Field(default=None, max_length=120)
    pdb_id: Optional[str] = Field(default=None, max_length=24)
    compute_covalent_delta_e: bool = Field(default=True)
    cube_grid_spacing: float = Field(default=0.25, ge=0.18, le=0.50)
    reject_pains: bool = Field(default=False)
    orcid_credit: Optional[str] = Field(default=None, max_length=64)
    researcher_name: Optional[str] = Field(default=None, max_length=120)


class DockRequest(BaseModel):
    smiles: str = Field(..., min_length=1, max_length=400, description="Input ligand SMILES")
    pdb_id: str = Field(..., min_length=4, max_length=24, description="4-char RCSB PDB ID or UniProt ID")
    box_center: Optional[List[float]] = Field(default=None, min_length=3, max_length=3)
    box_size: List[float] = Field(default=[20.0, 20.0, 20.0], min_length=3, max_length=3)
    covalent_target_res: Optional[str] = Field(
        default=None, max_length=32, description="Optional covalent target e.g. 'A:172' or 'CYS172'"
    )
    exhaustiveness: int = Field(default=6, ge=2, le=10)
    orcid_credit: Optional[str] = Field(default=None, max_length=64)
    researcher_name: Optional[str] = Field(default=None, max_length=120)


# ----------------------------------------------------------------------------
# ROUTES
# ----------------------------------------------------------------------------
def _probe_versions() -> Dict[str, Any]:
    versions: Dict[str, Any] = {"xtb_binary": bool(shutil.which("xtb")), "vina_binary": bool(shutil.which("vina"))}
    for pkg in ("pyscf", "rdkit", "meeko", "vina", "gpu4pyscf"):
        try:
            mod = __import__(pkg)
            versions[pkg] = getattr(mod, "__version__", "installed")
        except Exception:
            versions[pkg] = None
    return versions


@app.get("/")
@app.get("/health")
async def health() -> Dict[str, Any]:
    return {
        "status": "ok",
        "service": "rprime-true-dft-vina-engine",
        "version": "1.0.0",
        "default_method": "df-wb97x_d/def2-SVP+ddCOSMO(eps=78.4)",
        "gpu_enabled": USE_GPU_DEFAULT,
        "limits": {"max_hac": MAX_HAC, "max_mw": MAX_MW, "max_concurrency": MAX_CONCURRENT_JOBS},
        "inflight_keys": _SINGLE_FLIGHT.active_keys,
        "cached_dft": len(_DFT_LRU),
        "cached_dock": len(_DOCK_LRU),
        "engines": _probe_versions(),
    }


@app.post("/api/v1/dft", dependencies=[Depends(verify_gateway_key)])
async def compute_dft(req: DFTRequest) -> JSONResponse:
    try:
        _, pre_props = validate_and_analyze_smiles(req.smiles, reject_pains=req.reject_pains)
    except GatekeeperError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    inchikey = pre_props["inchikey"]
    cache_key = f"dft:{inchikey}:cov={int(req.compute_covalent_delta_e)}:grid={req.cube_grid_spacing:.2f}"

    cached = _lru_get(_DFT_LRU, cache_key)
    if cached is not None:
        out = dict(cached)
        out["cache_hit"] = "memory_lru"
        if req.mol_name:
            out["mol_name"] = req.mol_name
        if req.pdb_id:
            out["pdb_id"] = req.pdb_id
        if req.orcid_credit:
            out["orcid_credit"] = req.orcid_credit
        if req.researcher_name:
            out["researcher_name"] = req.researcher_name
        return JSONResponse(content=out)

    lock = await _SINGLE_FLIGHT.acquire(cache_key)
    try:
        # Re-check cache in case a coalesced leader just finished
        cached_after = _lru_get(_DFT_LRU, cache_key)
        if cached_after is not None:
            out = dict(cached_after)
            out["cache_hit"] = "coalesced_single_flight"
            return JSONResponse(content=out)

        async with _COMPUTE_SEMAPHORE:
            result = await asyncio.to_thread(
                run_kohn_sham_dft_pipeline,
                req.smiles,
                mol_name=req.mol_name,
                compute_covalent_delta_e=req.compute_covalent_delta_e,
                cube_grid_spacing=req.cube_grid_spacing,
                reject_pains=req.reject_pains,
                use_gpu=USE_GPU_DEFAULT,
            )

        _lru_put(_DFT_LRU, cache_key, result)
        out = dict(result)
        out["cache_hit"] = False
        if req.pdb_id:
            out["pdb_id"] = req.pdb_id
        if req.orcid_credit:
            out["orcid_credit"] = req.orcid_credit
        if req.researcher_name:
            out["researcher_name"] = req.researcher_name
        return JSONResponse(content=out)
    except GatekeeperError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Kohn-Sham SCF solver error: {exc}") from exc
    finally:
        await _SINGLE_FLIGHT.release(cache_key, lock)


@app.post("/api/v1/dft/stream", dependencies=[Depends(verify_gateway_key)])
async def compute_dft_stream(req: DFTRequest, request: Request) -> StreamingResponse:
    """
    Streams real-time Server-Sent Events (SSE) for every Kohn-Sham SCF cycle so the
    browser console in sim_discovery.html displays live electronic convergence.
    """
    try:
        _, pre_props = validate_and_analyze_smiles(req.smiles, reject_pains=req.reject_pains)
    except GatekeeperError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    inchikey = pre_props["inchikey"]
    cache_key = f"dft:{inchikey}:cov={int(req.compute_covalent_delta_e)}:grid={req.cube_grid_spacing:.2f}"

    async def event_generator() -> AsyncGenerator[str, None]:
        cached = _lru_get(_DFT_LRU, cache_key)
        if cached is not None:
            out = dict(cached)
            out["cache_hit"] = "memory_lru"
            for rec in out.get("scf_history", []):
                yield f"event: scf_iter\ndata: {json.dumps(rec)}\n\n"
            yield f"event: result\ndata: {json.dumps(out)}\n\n"
            return

        loop = asyncio.get_running_loop()
        queue: "asyncio.Queue[Optional[Tuple[str, Dict[str, Any]]]]" = asyncio.Queue()

        def thread_progress_cb(ev_name: str, payload: Dict[str, Any]) -> None:
            loop.call_soon_threadsafe(queue.put_nowait, (ev_name, payload))

        async def worker_task() -> None:
            lock = await _SINGLE_FLIGHT.acquire(cache_key)
            try:
                cached_inner = _lru_get(_DFT_LRU, cache_key)
                if cached_inner is not None:
                    out = dict(cached_inner)
                    out["cache_hit"] = "coalesced_single_flight"
                    await queue.put(("result", out))
                    return

                async with _COMPUTE_SEMAPHORE:
                    res = await asyncio.to_thread(
                        run_kohn_sham_dft_pipeline,
                        req.smiles,
                        mol_name=req.mol_name,
                        compute_covalent_delta_e=req.compute_covalent_delta_e,
                        cube_grid_spacing=req.cube_grid_spacing,
                        reject_pains=req.reject_pains,
                        use_gpu=USE_GPU_DEFAULT,
                        progress_cb=thread_progress_cb,
                    )
                _lru_put(_DFT_LRU, cache_key, res)
            except Exception as exc:
                await queue.put(("error", {"detail": str(exc)}))
            finally:
                await _SINGLE_FLIGHT.release(cache_key, lock)
                await queue.put(None)

        task = asyncio.create_task(worker_task())
        try:
            while True:
                if await request.is_disconnected():
                    break
                item = await queue.get()
                if item is None:
                    break
                ev_name, payload = item
                if ev_name == "result":
                    payload = dict(payload)
                    payload.setdefault("cache_hit", False)
                    if req.pdb_id:
                        payload["pdb_id"] = req.pdb_id
                    if req.orcid_credit:
                        payload["orcid_credit"] = req.orcid_credit
                    if req.researcher_name:
                        payload["researcher_name"] = req.researcher_name
                yield f"event: {ev_name}\ndata: {json.dumps(payload)}\n\n"
        finally:
            if not task.done():
                task.cancel()

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@app.post("/api/v1/dock", dependencies=[Depends(verify_gateway_key)])
async def compute_docking(req: DockRequest) -> JSONResponse:
    try:
        _, pre_props = validate_and_analyze_smiles(req.smiles, reject_pains=False)
    except GatekeeperError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    inchikey = pre_props["inchikey"]
    box_sig = (
        f"{req.box_center[0]:.1f},{req.box_center[1]:.1f},{req.box_center[2]:.1f}"
        if req.box_center
        else "auto"
    )
    cov_sig = (req.covalent_target_res or "none").strip().upper()
    dock_key = f"dock:{inchikey}:{req.pdb_id.strip().upper()}:{box_sig}:{cov_sig}:exh={req.exhaustiveness}"

    cached = _lru_get(_DOCK_LRU, dock_key)
    if cached is not None:
        out = dict(cached)
        out["cache_hit"] = "memory_lru"
        return JSONResponse(content=out)

    lock = await _SINGLE_FLIGHT.acquire(dock_key)
    try:
        cached_after = _lru_get(_DOCK_LRU, dock_key)
        if cached_after is not None:
            out = dict(cached_after)
            out["cache_hit"] = "coalesced_single_flight"
            return JSONResponse(content=out)

        async with _COMPUTE_SEMAPHORE:
            result = await asyncio.to_thread(
                run_docking_pipeline,
                req.smiles,
                req.pdb_id,
                box_center=req.box_center,
                box_size=req.box_size,
                covalent_target_res=req.covalent_target_res,
                exhaustiveness=req.exhaustiveness,
            )

        _lru_put(_DOCK_LRU, dock_key, result)
        out = dict(result)
        out["cache_hit"] = False
        if req.orcid_credit:
            out["orcid_credit"] = req.orcid_credit
        if req.researcher_name:
            out["researcher_name"] = req.researcher_name
        return JSONResponse(content=out)
    except (GatekeeperError, DockingGateError) as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"AutoDock Vina pipeline error: {exc}") from exc
    finally:
        await _SINGLE_FLIGHT.release(dock_key, lock)
