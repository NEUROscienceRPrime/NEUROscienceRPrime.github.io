"""
docking_engine.py — 230k+ RCSB PDB Streamer, 7-Axis Hendlich LIGSITE & AutoDock Vina 1.2
Neuroscience with RPrime · Discovery OS Backend

Pipeline:
  1. Streams any PDB (.pdb or .cif fallback) from files.rcsb.org or AlphaFold EBI DB.
  2. Runs vectorized 7-axis Hendlich (1997) LIGSITE buriedness cavity detection.
  3. Enforces the Anti-Hallucination Gate: refuses blind non-covalent docking when the
     largest cavity is < 180 A^3 (e.g. apo DeltaFosB 18 A^3) unless covalent_target_res is set.
  4. Prepares ligand topology via Meeko + receptor PDBQT and executes AutoDock Vina 1.2
     (exhaustiveness=6), returning 3D poses, residue contacts, and explicit [?] error bars.
"""

from __future__ import annotations

import math
import os
import re
import shutil
import subprocess
import tempfile
import time
from typing import Any, Dict, List, Optional, Sequence, Tuple

import httpx
import numpy as np
from rdkit import Chem
from rdkit.Chem import AllChem
from scipy import ndimage

from quantum_engine import GatekeeperError, validate_and_analyze_smiles

MIN_DRUGGABLE_POCKET_A3: float = 180.0
VINA_RMSE_KCAL: float = 2.2

_PDB_ID_RE = re.compile(r"^[0-9][A-Za-z0-9]{3}$")
_UNIPROT_RE = re.compile(r"^(?:AF-)?([A-Z0-9]{6,10})(?:-F1)?$", re.IGNORECASE)

_VDW_RADII = {
    "H": 1.20,
    "C": 1.70,
    "N": 1.55,
    "O": 1.52,
    "F": 1.47,
    "P": 1.80,
    "S": 1.80,
    "CL": 1.75,
    "BR": 1.85,
    "I": 1.98,
}

_AROMATIC_RES_ATOMS = {
    "PHE": {"CG", "CD1", "CD2", "CE1", "CE2", "CZ"},
    "TYR": {"CG", "CD1", "CD2", "CE1", "CE2", "CZ"},
    "TRP": {"CG", "CD1", "CD2", "CE2", "CE3", "CZ2", "CZ3", "CH2"},
    "HIS": {"CG", "CD2", "CE1"},
}

_STANDARD_POLAR_WATERS = {"HOH", "WAT", "DOD", "TIP3"}
_IONS_AND_BUFFERS = {
    "SO4", "PO4", "GOL", "EDO", "PEG", "DMS", "ACT", "CL", "NA", "MG", "ZN", "CA", "K", "IOD"
}


class DockingGateError(ValueError):
    """Raised on invalid receptor identifiers or structure download errors."""


def fetch_receptor_atoms(target_id: str) -> Dict[str, Any]:
    """
    Streams structure coordinates from RCSB PDB (.pdb with automatic .cif fallback for large
    cryo-EM entries like 7CN1/8EF5) or AlphaFold DB, caching locally in /tmp/rprime_cache.
    """
    clean_id = (target_id or "").strip()
    cache_dir = os.path.join(os.environ.get("RPRIME_CACHE_DIR", "/tmp/rprime_cache"), "pdb")
    os.makedirs(cache_dir, exist_ok=True)

    is_pdb = bool(_PDB_ID_RE.match(clean_id))
    uniprot_match = None if is_pdb else _UNIPROT_RE.match(clean_id)
    if not is_pdb and not uniprot_match:
        raise DockingGateError(
            f"Invalid target identifier '{clean_id}'. Provide a 4-char RCSB PDB ID (e.g. 5VPE, 1HSG, 7CN1) "
            "or UniProt/AlphaFold ID (e.g. P53539)."
        )

    norm_key = clean_id.upper() if is_pdb else f"AF-{uniprot_match.group(1).upper()}"
    cache_pdb = os.path.join(cache_dir, f"{norm_key}.pdb")
    cache_cif = os.path.join(cache_dir, f"{norm_key}.cif")

    raw_text: Optional[str] = None
    fmt = "pdb"
    source_label = "RCSB PDB"

    if os.path.isfile(cache_pdb):
        with open(cache_pdb, "r", encoding="utf-8", errors="replace") as fh:
            raw_text = fh.read()
        fmt = "pdb"
    elif os.path.isfile(cache_cif):
        with open(cache_cif, "r", encoding="utf-8", errors="replace") as fh:
            raw_text = fh.read()
        fmt = "cif"
    else:
        with httpx.Client(timeout=20.0, follow_redirects=True) as client:
            if is_pdb:
                pdb_url = f"https://files.rcsb.org/download/{norm_key}.pdb"
                r = client.get(pdb_url)
                if r.status_code == 200 and ("ATOM  " in r.text or "HETATM" in r.text):
                    raw_text = r.text
                    fmt = "pdb"
                    with open(cache_pdb, "w", encoding="utf-8") as fh:
                        fh.write(raw_text)
                else:
                    cif_url = f"https://files.rcsb.org/download/{norm_key}.cif"
                    rc = client.get(cif_url)
                    if rc.status_code != 200:
                        raise DockingGateError(
                            f"Structure '{norm_key}' not found on RCSB PDB (HTTP {rc.status_code})."
                        )
                    raw_text = rc.text
                    fmt = "cif"
                    with open(cache_cif, "w", encoding="utf-8") as fh:
                        fh.write(raw_text)
            else:
                uni = uniprot_match.group(1).upper()
                source_label = "AlphaFold DB"
                meta_r = client.get(f"https://alphafold.ebi.ac.uk/api/prediction/{uni}")
                if meta_r.status_code != 200:
                    raise DockingGateError(f"UniProt '{uni}' not found in AlphaFold DB.")
                entries = meta_r.json()
                if not entries or not isinstance(entries, list) or "pdbUrl" not in entries[0]:
                    raise DockingGateError(f"No PDB coordinate URL available for AlphaFold '{uni}'.")
                pr = client.get(entries[0]["pdbUrl"])
                pr.raise_for_status()
                raw_text = pr.text
                fmt = "pdb"
                with open(cache_pdb, "w", encoding="utf-8") as fh:
                    fh.write(raw_text)

    if fmt == "pdb":
        parsed = _parse_pdb_text(raw_text or "")
    else:
        parsed = _parse_mmcif_text(raw_text or "")

    if not parsed["polymer_atoms"]:
        raise DockingGateError(f"Structure '{norm_key}' contained zero heavy polymer atoms.")

    parsed["target_id"] = norm_key
    parsed["source_db"] = source_label
    parsed["format"] = fmt
    return parsed


def _parse_pdb_text(text: str) -> Dict[str, Any]:
    polymer_atoms: List[Dict[str, Any]] = []
    het_ligands: Dict[str, List[Tuple[float, float, float]]] = {}
    cysteines: List[Dict[str, Any]] = []
    seen_alt_keys = set()

    for line in text.splitlines():
        rec = line[:6].strip()
        if rec == "ENDMDL":
            # Keep Model 1 only for NMR ensembles
            if polymer_atoms:
                break
            continue
        if rec not in ("ATOM", "HETATM") or len(line) < 54:
            continue

        alt_loc = line[16:17].strip()
        if alt_loc and alt_loc not in ("A", "1"):
            continue

        atom_name = line[12:16].strip()
        res_name = line[17:20].strip().upper()
        chain_id = line[21:22].strip() or "A"
        try:
            res_seq = int(line[22:26].strip())
            x = float(line[30:38])
            y = float(line[38:46])
            z = float(line[46:54])
        except ValueError:
            continue

        elem = (line[76:78].strip() if len(line) >= 78 else "").upper()
        if not elem:
            elem = re.sub(r"[^A-Za-z]", "", atom_name)[:1].upper() or "C"
        if elem == "H" or elem == "D":
            continue

        dedup_key = (rec, chain_id, res_seq, atom_name)
        if dedup_key in seen_alt_keys:
            continue
        seen_alt_keys.add(dedup_key)

        if rec == "HETATM":
            if res_name not in _STANDARD_POLAR_WATERS and res_name not in _IONS_AND_BUFFERS:
                key = f"{res_name}:{chain_id}:{res_seq}"
                het_ligands.setdefault(key, []).append((x, y, z))
            continue

        if res_name in _STANDARD_POLAR_WATERS:
            continue

        atom_rec = {
            "atom_name": atom_name,
            "res_name": res_name,
            "chain": chain_id,
            "res_seq": res_seq,
            "elem": elem,
            "x": x,
            "y": y,
            "z": z,
        }
        polymer_atoms.append(atom_rec)
        if res_name == "CYS" and atom_name == "SG":
            cysteines.append(atom_rec)

    return {
        "polymer_atoms": polymer_atoms,
        "het_ligands": het_ligands,
        "cysteines": cysteines,
    }


def _parse_mmcif_text(text: str) -> Dict[str, Any]:
    """Lightweight loop_ _atom_site parser for large cryo-EM structures (e.g. 7CN1, 8EF5)."""
    polymer_atoms: List[Dict[str, Any]] = []
    het_ligands: Dict[str, List[Tuple[float, float, float]]] = {}
    cysteines: List[Dict[str, Any]] = []

    lines = text.splitlines()
    n = len(lines)
    i = 0
    while i < n:
        if lines[i].strip() == "loop_":
            cols: List[str] = []
            j = i + 1
            while j < n and lines[j].strip().startswith("_"):
                cols.append(lines[j].strip())
                j += 1
            if cols and cols[0].startswith("_atom_site."):
                col_idx = {c: idx for idx, c in enumerate(cols)}
                req = (
                    "_atom_site.group_PDB",
                    "_atom_site.label_atom_id",
                    "_atom_site.label_comp_id",
                    "_atom_site.Cartn_x",
                    "_atom_site.Cartn_y",
                    "_atom_site.Cartn_z",
                )
                if all(k in col_idx for k in req):
                    ig = col_idx["_atom_site.group_PDB"]
                    ia = col_idx["_atom_site.label_atom_id"]
                    icomp = col_idx["_atom_site.label_comp_id"]
                    ichain = col_idx.get(
                        "_atom_site.auth_asym_id", col_idx.get("_atom_site.label_asym_id", -1)
                    )
                    iseq = col_idx.get(
                        "_atom_site.auth_seq_id", col_idx.get("_atom_site.label_seq_id", -1)
                    )
                    ielem = col_idx.get("_atom_site.type_symbol", -1)
                    imodel = col_idx.get("_atom_site.pdbx_PDB_model_num", -1)
                    ix, iy, iz = (
                        col_idx["_atom_site.Cartn_x"],
                        col_idx["_atom_site.Cartn_y"],
                        col_idx["_atom_site.Cartn_z"],
                    )

                    while j < n:
                        row_str = lines[j].strip()
                        if not row_str or row_str.startswith("#") or row_str.startswith("_") or row_str == "loop_":
                            break
                        parts = row_str.split()
                        j += 1
                        if len(parts) < len(cols):
                            continue
                        if imodel >= 0 and parts[imodel] not in ("1", "?", "."):
                            continue
                        rec = parts[ig]
                        if rec not in ("ATOM", "HETATM"):
                            continue
                        elem = (parts[ielem] if ielem >= 0 else parts[ia][:1]).upper()
                        if elem in ("H", "D"):
                            continue
                        atom_name = parts[ia].strip('"')
                        res_name = parts[icomp].upper()
                        chain_id = (parts[ichain] if ichain >= 0 else "A")[:1]
                        try:
                            res_seq = int(parts[iseq]) if (iseq >= 0 and parts[iseq].lstrip("-").isdigit()) else 1
                            x, y, z = float(parts[ix]), float(parts[iy]), float(parts[iz])
                        except ValueError:
                            continue

                        if rec == "HETATM":
                            if res_name not in _STANDARD_POLAR_WATERS and res_name not in _IONS_AND_BUFFERS:
                                het_ligands.setdefault(f"{res_name}:{chain_id}:{res_seq}", []).append((x, y, z))
                            continue
                        if res_name in _STANDARD_POLAR_WATERS:
                            continue

                        atom_rec = {
                            "atom_name": atom_name,
                            "res_name": res_name,
                            "chain": chain_id,
                            "res_seq": res_seq,
                            "elem": elem,
                            "x": x,
                            "y": y,
                            "z": z,
                        }
                        polymer_atoms.append(atom_rec)
                        if res_name == "CYS" and atom_name == "SG":
                            cysteines.append(atom_rec)
                i = j
                continue
        i += 1

    return {
        "polymer_atoms": polymer_atoms,
        "het_ligands": het_ligands,
        "cysteines": cysteines,
    }


def _scan_psp_1d_slices(occ: np.ndarray) -> np.ndarray:
    """Marks empty (False) entries enclosed between True entries along the last axis."""
    left_protein = np.maximum.accumulate(occ, axis=-1)
    right_protein = np.maximum.accumulate(occ[..., ::-1], axis=-1)[..., ::-1]
    return (~occ) & left_protein & right_protein


def compute_ligsite_cavities(
    polymer_atoms: Sequence[Dict[str, Any]],
    focus_center: Optional[Tuple[float, float, float]] = None,
    region_half_width: float = 16.0,
    grid_spacing: float = 1.0,
    psp_threshold: int = 6,
) -> Dict[str, Any]:
    """
    Vectorized 7-axis Hendlich (1997) LIGSITE cavity finder (3 Cartesian + 4 cubic diagonals).
    Returns largest cavity volume (A^3), top ranked pockets, and lining residues.
    """
    coords = np.array([[a["x"], a["y"], a["z"]] for a in polymer_atoms], dtype=np.float64)
    radii = np.array(
        [_VDW_RADII.get(a["elem"], 1.70) + 1.15 for a in polymer_atoms], dtype=np.float64
    )

    if focus_center is not None:
        fc = np.array(focus_center, dtype=np.float64)
        mask = np.all(np.abs(coords - fc) <= (region_half_width + 5.0), axis=1)
        sub_idx = np.flatnonzero(mask)
        if sub_idx.size < 15:
            sub_idx = np.arange(len(polymer_atoms))
            min_pt = coords.min(axis=0) - 2.0
            max_pt = coords.max(axis=0) + 2.0
        else:
            min_pt = fc - region_half_width
            max_pt = fc + region_half_width
    else:
        sub_idx = np.arange(len(polymer_atoms))
        span = coords.max(axis=0) - coords.min(axis=0)
        if float(np.max(span)) > 48.0:
            # Focus on geometric core of large complexes if no center given
            fc = coords.mean(axis=0)
            min_pt = fc - 20.0
            max_pt = fc + 20.0
            mask = np.all(np.abs(coords - fc) <= 25.0, axis=1)
            sub_idx = np.flatnonzero(mask)
        else:
            min_pt = coords.min(axis=0) - 2.0
            max_pt = coords.max(axis=0) + 2.0

    step = float(grid_spacing)
    dims = np.ceil((max_pt - min_pt) / step).astype(int) + 1
    dims = np.clip(dims, 12, 64)
    nx, ny, nz = int(dims[0]), int(dims[1]), int(dims[2])

    xs = min_pt[0] + np.arange(nx) * step
    ys = min_pt[1] + np.arange(ny) * step
    zs = min_pt[2] + np.arange(nz) * step

    occ = np.zeros((nx, ny, nz), dtype=bool)
    sub_coords = coords[sub_idx]
    sub_radii = radii[sub_idx]

    for (ax, ay, az), rad in zip(sub_coords, sub_radii):
        ix0 = max(0, int(math.floor((ax - rad - min_pt[0]) / step)))
        ix1 = min(nx - 1, int(math.ceil((ax + rad - min_pt[0]) / step)))
        iy0 = max(0, int(math.floor((ay - rad - min_pt[1]) / step)))
        iy1 = min(ny - 1, int(math.ceil((ay + rad - min_pt[1]) / step)))
        iz0 = max(0, int(math.floor((az - rad - min_pt[2]) / step)))
        iz1 = min(nz - 1, int(math.ceil((az + rad - min_pt[2]) / step)))
        if ix0 > ix1 or iy0 > iy1 or iz0 > iz1:
            continue
        dx2 = (xs[ix0 : ix1 + 1, None, None] - ax) ** 2
        dy2 = (ys[None, iy0 : iy1 + 1, None] - ay) ** 2
        dz2 = (zs[None, None, iz0 : iz1 + 1] - az) ** 2
        occ[ix0 : ix1 + 1, iy0 : iy1 + 1, iz0 : iz1 + 1] |= (dx2 + dy2 + dz2) <= (rad * rad)

    psp_count = np.zeros((nx, ny, nz), dtype=np.uint8)
    # 3 Cartesian axes
    psp_count += _scan_psp_1d_slices(occ).astype(np.uint8)
    psp_count += np.swapaxes(_scan_psp_1d_slices(np.swapaxes(occ, 1, 2)), 1, 2).astype(np.uint8)
    psp_count += np.swapaxes(_scan_psp_1d_slices(np.swapaxes(occ, 0, 2)), 0, 2).astype(np.uint8)

    # 4 Body diagonals via step-by-step directional sweeps
    for sx, sy, sz in ((1, 1, 1), (1, 1, -1), (1, -1, 1), (-1, 1, 1)):
        v = occ[::sx, ::sy, ::sz]
        fwd = v.copy()
        for k in range(1, min(nx, ny, nz)):
            fwd[k:, k:, k:] |= fwd[:-k, :-k, :-k]
            if k >= 14:
                break
        bwd = v.copy()
        for k in range(1, min(nx, ny, nz)):
            bwd[:-k, :-k, :-k] |= bwd[k:, k:, k:]
            if k >= 14:
                break
        enclosed = (~v) & fwd & bwd
        psp_count += enclosed[::sx, ::sy, ::sz].astype(np.uint8)

    buried = (~occ) & (psp_count >= psp_threshold)
    labels, n_clusters = ndimage.label(buried)
    voxel_vol = step ** 3

    pockets: List[Dict[str, Any]] = []
    if n_clusters > 0:
        counts = np.bincount(labels.ravel())
        counts[0] = 0
        order = np.argsort(-counts)
        for cid in order[:5]:
            nvox = int(counts[cid])
            if nvox < 4:
                continue
            vol_a3 = round(nvox * voxel_vol, 1)
            pts_idx = np.argwhere(labels == cid)
            pts_xyz = min_pt + pts_idx * step
            centroid = pts_xyz.mean(axis=0)

            # Identify lining residues within 4.5 A of cavity centroid / voxels
            d2 = np.sum((sub_coords - centroid) ** 2, axis=1)
            near_mask = d2 <= 9.5 ** 2
            lining_set = set()
            for local_i in np.flatnonzero(near_mask):
                at = polymer_atoms[int(sub_idx[local_i])]
                at_pt = np.array([at["x"], at["y"], at["z"]])
                if float(np.min(np.sum((pts_xyz - at_pt) ** 2, axis=1))) <= 4.5 ** 2:
                    lining_set.add(f"{at['chain']}:{at['res_name']}{at['res_seq']}")

            sample_stride = max(1, len(pts_xyz) // 180)
            pockets.append(
                {
                    "volume_a3": vol_a3,
                    "voxel_count": nvox,
                    "center": [round(float(c), 2) for c in centroid],
                    "lining_residues": sorted(lining_set)[:18],
                    "voxels_sample": [
                        [round(float(p[0]), 2), round(float(p[1]), 2), round(float(p[2]), 2)]
                        for p in pts_xyz[::sample_stride]
                    ],
                }
            )

    largest_vol = pockets[0]["volume_a3"] if pockets else 0.0
    return {
        "largest_pocket_vol_a3": largest_vol,
        "druggable_non_covalent": largest_vol >= MIN_DRUGGABLE_POCKET_A3,
        "pockets": pockets,
    }


def _resolve_target_cysteine(
    cysteines: Sequence[Dict[str, Any]], spec: str
) -> Optional[Dict[str, Any]]:
    raw = spec.strip().upper().replace("CYS", "")
    # Formats accepted: "A:172", "A:CYS172", "172", "CYS172"
    chain_req: Optional[str] = None
    if ":" in raw:
        parts = raw.split(":", 1)
        chain_req = parts[0].strip() or None
        raw = re.sub(r"[^0-9-]", "", parts[1])
    else:
        raw = re.sub(r"[^0-9-]", "", raw)

    if not raw:
        return cysteines[0] if cysteines else None
    seq_num = int(raw)
    for cys in cysteines:
        if cys["res_seq"] == seq_num and (chain_req is None or cys["chain"].upper() == chain_req):
            return cys
    return None


def _write_receptor_pdbqt(
    polymer_atoms: Sequence[Dict[str, Any]],
    center: Tuple[float, float, float],
    cutoff_ang: float = 22.0,
) -> str:
    """Writes standard AutoDock4-typed rigid receptor PDBQT within cutoff of binding box."""
    cx, cy, cz = center
    r2_max = cutoff_ang * cutoff_ang
    lines: List[str] = []
    serial = 1
    for at in polymer_atoms:
        dx = at["x"] - cx
        dy = at["y"] - cy
        dz = at["z"] - cz
        if (dx * dx + dy * dy + dz * dz) > r2_max:
            continue
        el = at["elem"]
        aname = at["atom_name"]
        rname = at["res_name"]
        if el == "C":
            ad_type = "A" if aname in _AROMATIC_RES_ATOMS.get(rname, set()) else "C"
            q = 0.05
        elif el == "N":
            ad_type = "NA" if rname == "HIS" and aname in ("ND1", "NE2") else "N"
            q = -0.32
        elif el == "O":
            ad_type = "OA"
            q = -0.45
        elif el == "S":
            ad_type = "SA"
            q = -0.18
        elif el == "P":
            ad_type = "P"
            q = 0.45
        else:
            ad_type = el[:2]
            q = 0.0

        lines.append(
            f"ATOM  {serial:5d} {aname:<4s} {rname:>3s} {at['chain']:1s}{at['res_seq']:4d}    "
            f"{at['x']:8.3f}{at['y']:8.3f}{at['z']:8.3f}  1.00  0.00    {q:+6.3f} {ad_type:<2s}"
        )
        serial += 1
    return "\n".join(lines) + "\n"


def _prepare_ligand_pdbqt(mol_no_h: Chem.Mol) -> str:
    """Prepares flexible-torsion ligand PDBQT via Meeko, with rigid-root RDKit fallback."""
    mol = Chem.AddHs(mol_no_h)
    params = AllChem.ETKDGv3()
    params.randomSeed = 20261115
    cids = list(AllChem.EmbedMultipleConfs(mol, numConfs=4, params=params))
    if not cids:
        params.useRandomCoords = True
        cids = list(AllChem.EmbedMultipleConfs(mol, numConfs=2, params=params))
    if not cids:
        raise GatekeeperError("Failed to generate 3D conformer for ligand docking.")
    try:
        AllChem.MMFFOptimizeMolecule(mol, mmffVariant="MMFF94s", maxIters=400)
    except Exception:
        AllChem.UFFOptimizeMolecule(mol, maxIters=400)

    try:
        from meeko import MoleculePreparation, PDBQTWriterLegacy

        preparator = MoleculePreparation()
        mol_setups = preparator.prepare(mol)
        for setup in mol_setups:
            pdbqt_str, is_ok, _err = PDBQTWriterLegacy.write_string(setup)
            if is_ok and pdbqt_str.strip():
                return pdbqt_str
    except Exception:
        pass

    # Clean rigid-root PDBQT fallback with RDKit Gasteiger partial charges
    AllChem.ComputeGasteigerCharges(mol)
    conf = mol.GetConformer()
    lines = ["ROOT"]
    for idx in range(mol.GetNumAtoms()):
        atom = mol.GetAtomWithIdx(idx)
        sym = atom.GetSymbol().upper()
        if sym == "H":
            nbrs = atom.GetNeighbors()
            if not nbrs or nbrs[0].GetSymbol() not in ("N", "O", "S"):
                continue
            ad_type = "HD"
        elif sym == "C":
            ad_type = "A" if atom.GetIsAromatic() else "C"
        elif sym == "N":
            ad_type = "NA" if atom.GetIsAromatic() or atom.GetTotalNumHs() == 0 else "N"
        elif sym == "O":
            ad_type = "OA"
        elif sym == "S":
            ad_type = "SA"
        elif sym in ("F", "P", "I"):
            ad_type = sym
        elif sym in ("CL", "BR"):
            ad_type = sym[0] + sym[1].lower()
        else:
            ad_type = "C"

        q_raw = float(atom.GetProp("_GasteigerCharge")) if atom.HasProp("_GasteigerCharge") else 0.0
        if not math.isfinite(q_raw):
            q_raw = 0.0
        pos = conf.GetAtomPosition(idx)
        aname = f"{sym}{idx + 1}"[:4]
        lines.append(
            f"ATOM  {idx + 1:5d} {aname:<4s} LIG A   1    "
            f"{pos.x:8.3f}{pos.y:8.3f}{pos.z:8.3f}  1.00  0.00    {q_raw:+6.3f} {ad_type:<2s}"
        )
    lines.append("ENDROOT")
    lines.append("TORSDOF 0")
    return "\n".join(lines) + "\n"


def _parse_vina_output_pdbqt(
    pdbqt_out: str,
    polymer_atoms: Sequence[Dict[str, Any]],
    covalent_cys: Optional[Dict[str, Any]] = None,
) -> List[Dict[str, Any]]:
    poses: List[Dict[str, Any]] = []
    blocks = pdbqt_out.split("MODEL ")
    poly_coords = np.array([[a["x"], a["y"], a["z"]] for a in polymer_atoms], dtype=np.float64)

    for blk in blocks:
        if "ATOM  " not in blk and "HETATM" not in blk:
            continue
        affinity: Optional[float] = None
        rmsd_lb = 0.0
        rmsd_ub = 0.0
        atoms_3d: List[Dict[str, Any]] = []

        for ln in blk.splitlines():
            if ln.startswith("REMARK VINA RESULT:"):
                parts = ln.replace("REMARK VINA RESULT:", "").split()
                if len(parts) >= 3:
                    affinity = float(parts[0])
                    rmsd_lb = float(parts[1])
                    rmsd_ub = float(parts[2])
            elif ln.startswith(("ATOM  ", "HETATM")) and len(ln) >= 54:
                aname = ln[12:16].strip()
                ad_type = ln[77:79].strip() if len(ln) >= 78 else aname[:1]
                if ad_type == "HD" or aname.startswith("H"):
                    continue
                try:
                    x, y, z = float(ln[30:38]), float(ln[38:46]), float(ln[46:54])
                except ValueError:
                    continue
                elem = re.sub(r"[^A-Za-z]", "", ad_type or aname)[:2].capitalize()
                atoms_3d.append({"symbol": elem, "x": round(x, 3), "y": round(y, 3), "z": round(z, 3)})

        if not atoms_3d:
            continue

        lig_pts = np.array([[a["x"], a["y"], a["z"]] for a in atoms_3d], dtype=np.float64)
        # Compute receptor residues within 4.0 A of docked pose
        centroid = lig_pts.mean(axis=0)
        near_poly = np.flatnonzero(np.sum((poly_coords - centroid) ** 2, axis=1) <= 14.0 ** 2)
        contacts = set()
        for pi in near_poly:
            dmin2 = float(np.min(np.sum((lig_pts - poly_coords[pi]) ** 2, axis=1)))
            if dmin2 <= 4.0 ** 2:
                at = polymer_atoms[int(pi)]
                contacts.add(f"{at['chain']}:{at['res_name']}{at['res_seq']}")

        cys_dist: Optional[float] = None
        if covalent_cys is not None:
            sg_pt = np.array([covalent_cys["x"], covalent_cys["y"], covalent_cys["z"]])
            cys_dist = round(float(np.sqrt(np.min(np.sum((lig_pts - sg_pt) ** 2, axis=1)))), 2)

        poses.append(
            {
                "pose_rank": len(poses) + 1,
                "affinity_kcal_mol": round(affinity, 2) if affinity is not None else None,
                "rmsd_lb": round(rmsd_lb, 2),
                "rmsd_ub": round(rmsd_ub, 2),
                "cys_sg_min_dist_ang": cys_dist,
                "contacts_4a": sorted(contacts)[:16],
                "atoms_3d": atoms_3d,
            }
        )
    return poses


def run_docking_pipeline(
    smiles: str,
    pdb_id: str,
    *,
    box_center: Optional[Sequence[float]] = None,
    box_size: Sequence[float] = (20.0, 20.0, 20.0),
    covalent_target_res: Optional[str] = None,
    exhaustiveness: int = 6,
) -> Dict[str, Any]:
    """
    Full RCSB PDB -> 7-Axis LIGSITE Gate -> Meeko -> AutoDock Vina 1.2 docking workflow.
    """
    t0 = time.perf_counter()
    mol, props = validate_and_analyze_smiles(smiles, reject_pains=False)
    rec_data = fetch_receptor_atoms(pdb_id)
    polymer_atoms = rec_data["polymer_atoms"]
    cysteines = rec_data["cysteines"]

    covalent_cys: Optional[Dict[str, Any]] = None
    if covalent_target_res:
        covalent_cys = _resolve_target_cysteine(cysteines, covalent_target_res)
        if covalent_cys is None:
            avail = ", ".join(f"{c['chain']}:CYS{c['res_seq']}" for c in cysteines[:10]) or "none"
            raise DockingGateError(
                f"Requested covalent cysteine '{covalent_target_res}' not found in {rec_data['target_id']} "
                f"(available CYS SG: {avail})."
            )

    # Determine initial focus region (explicit box_center > covalent CYS > co-crystal HETATM > LIGSITE scan)
    focus_pt: Optional[Tuple[float, float, float]] = None
    center_source = "auto_ligsite_largest_pocket"
    if box_center is not None and len(box_center) == 3:
        focus_pt = (float(box_center[0]), float(box_center[1]), float(box_center[2]))
        center_source = "user_specified_box"
    elif covalent_cys is not None:
        focus_pt = (covalent_cys["x"], covalent_cys["y"], covalent_cys["z"])
        center_source = f"covalent_tether_{covalent_cys['chain']}:CYS{covalent_cys['res_seq']}"
    elif rec_data["het_ligands"]:
        # Pick largest bound co-crystal ligand (excluding buffers/ions)
        best_het_key = max(rec_data["het_ligands"], key=lambda k: len(rec_data["het_ligands"][k]))
        het_pts = np.array(rec_data["het_ligands"][best_het_key], dtype=np.float64)
        c = het_pts.mean(axis=0)
        focus_pt = (float(c[0]), float(c[1]), float(c[2]))
        center_source = f"cocrystal_ligand_{best_het_key}"

    ligsite = compute_ligsite_cavities(polymer_atoms, focus_center=focus_pt)
    pocket_vol = ligsite["largest_pocket_vol_a3"]

    cys_summary = [
        {
            "residue": f"{c['chain']}:CYS{c['res_seq']}",
            "x": round(c["x"], 2),
            "y": round(c["y"], 2),
            "z": round(c["z"], 2),
        }
        for c in cysteines[:24]
    ]

    # ANTI-HALLUCINATION CAVITY VOLUME GATE (< 180 A^3)
    if pocket_vol < MIN_DRUGGABLE_POCKET_A3 and covalent_cys is None:
        return {
            "status": "refused_flat_surface",
            "docking_status": "refused_flat_surface",
            "pdb_id": rec_data["target_id"],
            "source_db": rec_data["source_db"],
            "inchikey": props["inchikey"],
            "canonical_smiles": props["canonical_smiles"],
            "pocket_vol_a3": pocket_vol,
            "druggability_floor_a3": MIN_DRUGGABLE_POCKET_A3,
            "top_pockets": ligsite["pockets"],
            "reactive_cysteines": cys_summary,
            "vina_kcal": None,
            "poses": [],
            "wall_time_s": round(time.perf_counter() - t0, 2),
            "message": (
                f"BLIND NON-COVALENT DOCKING REFUSED: Largest LIGSITE cavity is {pocket_vol:.1f} A^3 "
                f"(< {MIN_DRUGGABLE_POCKET_A3:.0f} A^3 druggability floor). On flat PPI/DNA-binding surfaces "
                "(like apo DeltaFosB at 18 A^3), non-covalent docking scores are physical artifacts. "
                "Specify `covalent_target_res` (e.g. CYS172) for covalent handle evaluation."
            ),
            "epistemic_notes": [
                "[?] Hendlich 7-axis LIGSITE check blocked hallucinated non-covalent pose generation on an undruggable surface."
            ],
        }

    if focus_pt is None:
        if ligsite["pockets"]:
            c = ligsite["pockets"][0]["center"]
            focus_pt = (float(c[0]), float(c[1]), float(c[2]))
        else:
            coords = np.array([[a["x"], a["y"], a["z"]] for a in polymer_atoms], dtype=np.float64)
            c = coords.mean(axis=0)
            focus_pt = (float(c[0]), float(c[1]), float(c[2]))

    eff_box = (
        (16.0, 16.0, 16.0)
        if (covalent_cys is not None and box_center is None)
        else (
            min(26.0, max(12.0, float(box_size[0]))),
            min(26.0, max(12.0, float(box_size[1]))),
            min(26.0, max(12.0, float(box_size[2]))),
        )
    )
    eff_exh = min(10, max(2, int(exhaustiveness)))

    rec_pdbqt = _write_receptor_pdbqt(polymer_atoms, focus_pt, cutoff_ang=max(eff_box) * 0.85 + 8.0)
    lig_pdbqt = _prepare_ligand_pdbqt(mol)

    pdbqt_poses_out = _execute_vina_engine(rec_pdbqt, lig_pdbqt, focus_pt, eff_box, eff_exh)
    poses = _parse_vina_output_pdbqt(pdbqt_poses_out, polymer_atoms, covalent_cys=covalent_cys)
    best_kcal = poses[0]["affinity_kcal_mol"] if poses else None

    epistemic_notes = [
        f"[?] AutoDock Vina 1.2 empirical scoring carries ±{VINA_RMSE_KCAL:.1f} kcal/mol RMSE; treat scores as coarse pose enrichment, NOT alchemical Delta G_bind.",
        "[?] Rigid-backbone implicit-solvent docking omits explicit water networks and induced-fit reorganization.",
    ]
    if covalent_cys is not None:
        epistemic_notes.append(
            f"[?] Covalent pre-organization box centered on {covalent_cys['chain']}:CYS{covalent_cys['res_seq']} S-gamma; combine pose proximity (cys_sg_min_dist_ang) with Kohn-Sham Delta E_cov."
        )

    return {
        "status": "ok",
        "docking_status": "covalent_preorganization" if covalent_cys else "non_covalent_docked",
        "pdb_id": rec_data["target_id"],
        "source_db": rec_data["source_db"],
        "inchikey": props["inchikey"],
        "canonical_smiles": props["canonical_smiles"],
        "cns_mpo": props["cns_mpo"],
        "box_center": [round(focus_pt[0], 2), round(focus_pt[1], 2), round(focus_pt[2], 2)],
        "box_size": list(eff_box),
        "box_center_source": center_source,
        "exhaustiveness": eff_exh,
        "pocket_vol_a3": pocket_vol,
        "top_pockets": ligsite["pockets"],
        "reactive_cysteines": cys_summary,
        "vina_kcal": best_kcal,
        "vina_rmse_kcal": VINA_RMSE_KCAL,
        "poses": poses,
        "wall_time_s": round(time.perf_counter() - t0, 2),
        "epistemic_notes": epistemic_notes,
    }


def _execute_vina_engine(
    rec_pdbqt: str,
    lig_pdbqt: str,
    center: Tuple[float, float, float],
    box_size: Tuple[float, float, float],
    exhaustiveness: int,
) -> str:
    """Runs AutoDock Vina 1.2 via Python bindings or `vina` CLI binary."""
    with tempfile.TemporaryDirectory(prefix="rprime_vina_") as tmpdir:
        rec_path = os.path.join(tmpdir, "receptor.pdbqt")
        lig_path = os.path.join(tmpdir, "ligand.pdbqt")
        out_path = os.path.join(tmpdir, "out.pdbqt")
        with open(rec_path, "w", encoding="utf-8") as fh:
            fh.write(rec_pdbqt)
        with open(lig_path, "w", encoding="utf-8") as fh:
            fh.write(lig_pdbqt)

        # 1. Try Python `vina` bindings first
        try:
            from vina import Vina

            v = Vina(sf_name="vina", cpu=2, seed=20261115, verbosity=0)
            v.set_receptor(rec_path)
            v.set_ligand_from_file(lig_path)
            v.compute_vina_maps(center=list(center), box_size=list(box_size))
            v.dock(exhaustiveness=exhaustiveness, n_poses=5)
            v.write_poses(out_path, n_poses=5, overwrite=True)
            if os.path.isfile(out_path):
                with open(out_path, "r", encoding="utf-8") as fh:
                    return fh.read()
        except Exception:
            pass

        # 2. Fallback to `vina` CLI binary (installed via conda-forge autodock-vina)
        vina_bin = shutil.which("vina")
        if not vina_bin:
            raise DockingGateError(
                "Neither Python `vina` module nor `vina` CLI binary is available in PATH."
            )

        cmd = [
            vina_bin,
            "--receptor",
            rec_path,
            "--ligand",
            lig_path,
            "--center_x",
            f"{center[0]:.3f}",
            "--center_y",
            f"{center[1]:.3f}",
            "--center_z",
            f"{center[2]:.3f}",
            "--size_x",
            f"{box_size[0]:.2f}",
            "--size_y",
            f"{box_size[1]:.2f}",
            "--size_z",
            f"{box_size[2]:.2f}",
            "--exhaustiveness",
            str(exhaustiveness),
            "--num_modes",
            "5",
            "--cpu",
            "2",
            "--seed",
            "20261115",
            "--out",
            out_path,
        ]
        proc = subprocess.run(
            cmd,
            cwd=tmpdir,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=65.0,
            check=False,
            text=True,
        )
        if proc.returncode != 0 or not os.path.isfile(out_path):
            raise DockingGateError(
                f"AutoDock Vina failed (code {proc.returncode}): {(proc.stderr or proc.stdout)[-300:]}"
            )
        with open(out_path, "r", encoding="utf-8") as fh:
            return fh.read()
