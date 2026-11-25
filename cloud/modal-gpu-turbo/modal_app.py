"""
modal_app.py — Drop-In Modal Starter ($30/mo Free Credit, Scale-to-Zero) GPU Turbo Endpoint
Neuroscience with RPrime · Discovery OS Backend

Runs true Kohn-Sham df-wB97X-D/def2-SVP + ddCOSMO(water) on an NVIDIA T4 GPU (~2-3 s/solve)
using `gpu4pyscf-cuda12x` + `xtb` + `AutoDock Vina 1.2`, exposing the EXACT same FastAPI
JSON contract (`/health`, `/api/v1/dft`, `/api/v1/dft/stream`, `/api/v1/dock`) as
`cloud/hf-pyscf-space/app.py` for seamless Cloudflare Gateway primary/failover routing.

Deploy ($0.00 out-of-pocket on Modal Starter free $30/mo tier):
    modal deploy cloud/modal-gpu-turbo/modal_app.py

Quick CLI smoke test:
    modal run cloud/modal-gpu-turbo/modal_app.py --smiles "CC(=O)CCl"
"""

from __future__ import annotations

import os
import sys
from pathlib import Path
from typing import Any

import modal

HERE = Path(__file__).resolve().parent
HF_ENGINE_DIR = (HERE.parent / "hf-pyscf-space").resolve()
REMOTE_ENGINE_DIR = "/root/rprime_engine"

# Build CUDA 12 + Micromamba image with xtb, AutoDock Vina 1.2, PySCF & gpu4pyscf
_base_image = (
    modal.Image.micromamba(python_version="3.11")
    .apt_install("build-essential", "ca-certificates", "curl", "libgomp1")
    .micromamba_install(
        "xtb=6.7.1",
        "autodock-vina=1.2.5",
        "openbabel",
        "cuda-version=12.4",
        "cuda-nvrtc=12.4*",
        "cuda-cudart-dev=12.4*",
        "libcublas=12.*",
        "libcusolver=11.*",
        "libcufft=11.*",
        channels=["conda-forge", "nvidia"],
    )
    .pip_install(
        "fastapi>=0.111.0,<1.0.0",
        "uvicorn[standard]>=0.30.0,<1.0.0",
        "pydantic>=2.7.0,<3.0.0",
        "httpx>=0.27.0,<1.0.0",
        "numpy>=1.26.0,<3.0.0",
        "scipy>=1.13.0,<2.0.0",
        "pyscf>=2.6.0,<3.0.0",
        "cupy-cuda12x>=13.1.0",
        "cutensor-cu12>=2.0.1",
        "gpu4pyscf-cuda12x>=1.0.0",
        "rdkit>=2024.3.1",
        "meeko>=0.5.0",
        "vina>=1.2.5",
    )
    .env(
        {
            "RPRIME_USE_GPU": "1",
            "RPRIME_MAX_CONCURRENCY": "4",
            "PYSCF_MAX_MEMORY": "10000",
            "OMP_NUM_THREADS": "4",
            "RPRIME_CACHE_DIR": "/tmp/rprime_cache",
        }
    )
)

# Attach shared quantum_engine.py, docking_engine.py, and app.py from cloud/hf-pyscf-space/
if hasattr(_base_image, "add_local_dir"):
    gpu_image = _base_image.add_local_dir(str(HF_ENGINE_DIR), remote_path=REMOTE_ENGINE_DIR)
else:  # Legacy Modal SDK compatibility
    gpu_image = _base_image

app = modal.App("rprime-quantum-gpu-turbo", image=gpu_image)


@app.function(
    gpu="T4",
    cpu=4.0,
    memory=12288,
    timeout=120,
    scaledown_window=60,  # Scale strictly to 0 containers after 60s idle ($0 idle cost!)
    max_containers=2,     # Hard concurrency ceiling protecting free $30/mo credit!
)
@modal.asgi_app()
def fastapi_turbo_endpoint() -> Any:
    """
    Exposes `/health`, `/api/v1/dft`, `/api/v1/dft/stream`, and `/api/v1/dock` on T4 GPU.
    Optional shared secret: configure Modal Secret `rprime-gateway-auth` with `RPRIME_GATEWAY_KEY`.
    """
    if REMOTE_ENGINE_DIR not in sys.path:
        sys.path.insert(0, REMOTE_ENGINE_DIR)
    os.environ["RPRIME_USE_GPU"] = "1"

    import app as rprime_fastapi_app

    return rprime_fastapi_app.app


@app.function(
    gpu="T4",
    cpu=4.0,
    memory=12288,
    timeout=120,
)
def run_gpu_dft_once(smiles: str, mol_name: str = "CLI-Smoke-Test") -> dict[str, Any]:
    if REMOTE_ENGINE_DIR not in sys.path:
        sys.path.insert(0, REMOTE_ENGINE_DIR)
    os.environ["RPRIME_USE_GPU"] = "1"

    from quantum_engine import run_kohn_sham_dft_pipeline

    return run_kohn_sham_dft_pipeline(
        smiles,
        mol_name=mol_name,
        compute_covalent_delta_e=True,
        use_gpu=True,
    )


@app.local_entrypoint()
def main(smiles: str = "COc1ccc2c(c1C(=O)CCl)CC(=O)O2") -> None:
    """Smoke-tests true T4 GPU df-wB97X-D/def2-SVP + ddCOSMO on RPrime's hybrid phenacyl."""
    res = run_gpu_dft_once.remote(smiles=smiles, mol_name="RPrime-Benzofuranone-Phenacyl")
    print(f"[OK] Method:      {res['method_basis']} ({res['engine_backend']})")
    print(f"[OK] InChIKey:    {res['inchikey']} | CNS MPO: {res['cns_mpo']}/6.0")
    print(f"[OK] E_tot (Ha):  {res['total_energy_ha']} | Wall: {res['wall_time_s']} s")
    print(f"[OK] HOMO/LUMO:   {res['homo_ev']} eV / {res['lumo_ev']} eV | omega = {res['parr_omega_ev']} eV")
    print(f"[OK] Warhead dE:  {res['delta_e_cov_kcal']} kcal/mol ({res['warhead_class']})")
