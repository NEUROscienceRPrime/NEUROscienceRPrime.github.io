"""
quantum_engine.py — Authentic Kohn-Sham PySCF + GFN2-xTB + RDKit Quantum Engine
Neuroscience with RPrime · Discovery OS Backend

Performs genuine ab initio / density-functional electronic structure calculations:
  1. Anti-Slop CNS Med-Chem Gatekeeper (HAC <= 38, MW <= 550, closed-shell, PAINS, CNS MPO)
  2. RDKit ETKDGv3 8-conformer search + GFN2-xTB/ALPB(water) 3D geometry optimization
  3. Restricted Kohn-Sham DFT: df-wB97X-D/def2-SVP + ddCOSMO(eps=78.4) with RI-JK fitting
  4. Exact HOMO/LUMO, Parr electrophilicity (omega), dipole, condensed Fukui f_A^+ (N+1 vs N),
     quantized 0.25 A Gaussian .cube.gz orbitals, and CH3SH covalent warhead Delta E_cov.
"""

from __future__ import annotations

import base64
import gzip
import math
import os
import shutil
import subprocess
import tempfile
import threading
import time
from dataclasses import dataclass
from typing import Any, Callable, Dict, List, Optional, Sequence, Tuple

import numpy as np
from rdkit import Chem
from rdkit.Chem import AllChem, Crippen, Descriptors, FilterCatalog, rdMolDescriptors

# Physical constants (CODATA 2018)
HARTREE_TO_EV: float = 27.211386245988
HARTREE_TO_KCAL_MOL: float = 627.5094740631
BOHR_TO_ANGSTROM: float = 0.529177210903
ANGSTROM_TO_BOHR: float = 1.0 / BOHR_TO_ANGSTROM

ALLOWED_ATOMIC_NUMS = frozenset({1, 6, 7, 8, 9, 15, 16, 17, 35, 53})
MAX_HAC: int = 38
MAX_MW: float = 550.0
WATER_EPSILON: float = 78.4

ProgressCallback = Optional[Callable[[str, Dict[str, Any]], None]]


class GatekeeperError(ValueError):
    """Raised when an input SMILES violates CNS chemical-space or quantum safety gates."""


# Initialize RDKit PAINS catalog once per process
_PAINS_PARAMS = FilterCatalog.FilterCatalogParams()
_PAINS_PARAMS.AddCatalog(FilterCatalog.FilterCatalogParams.FilterCatalogs.PAINS)
_PAINS_CATALOG = FilterCatalog.FilterCatalog(_PAINS_PARAMS)

# Cache reference small-molecule energies (CH3SH, HCl, HBr) keyed by (xc_func, use_gpu)
_REF_ENERGY_LOCK = threading.Lock()
_REF_ENERGY_CACHE: Dict[Tuple[str, str], float] = {}


def _compute_pfizer_cns_mpo(
    clogp: float, mw: float, tpsa: float, hbd: int, basic_amines: int
) -> float:
    """
    Computes Wager et al. (ACS Chem. Neurosci. 2010) 6-parameter CNS MPO score (0.0 - 6.0).
    Uses monotonic piecewise linear desirability functions across:
      1. cLogP (<=3 -> 1, >=5 -> 0)
      2. cLogD_pH7.4 est (<=2 -> 1, >=4 -> 0)
      3. MW (<=360 -> 1, >=500 -> 0)
      4. TPSA (40..90 -> 1, <=20 or >=120 -> 0)
      5. HBD (0 -> 1, >=3.5 -> 0)
      6. Most-basic pKa est (<=8 -> 1, >=10 -> 0)
    """
    est_pka = 9.4 if basic_amines > 0 else 4.5
    clogd = clogp - (1.1 if basic_amines > 0 else 0.0)

    def ramp_down(val: float, low: float, high: float) -> float:
        if val <= low:
            return 1.0
        if val >= high:
            return 0.0
        return (high - val) / (high - low)

    d_clogp = ramp_down(clogp, 3.0, 5.0)
    d_clogd = ramp_down(clogd, 2.0, 4.0)
    d_mw = ramp_down(mw, 360.0, 500.0)
    if 40.0 <= tpsa <= 90.0:
        d_tpsa = 1.0
    elif 20.0 < tpsa < 40.0:
        d_tpsa = (tpsa - 20.0) / 20.0
    elif 90.0 < tpsa < 120.0:
        d_tpsa = (120.0 - tpsa) / 30.0
    else:
        d_tpsa = 0.0
    d_hbd = ramp_down(float(hbd), 0.5, 3.5)
    d_pka = ramp_down(est_pka, 8.0, 10.0)

    return round(d_clogp + d_clogd + d_mw + d_tpsa + d_hbd + d_pka, 2)


def validate_and_analyze_smiles(
    smiles: str, *, reject_pains: bool = False
) -> Tuple[Chem.Mol, Dict[str, Any]]:
    """
    Validates SMILES against the Anti-Slop CNS & closed-shell Kohn-Sham gatekeeper.
    Returns sanitized RDKit Mol and medicinal-chemistry property dictionary.
    """
    raw = (smiles or "").strip()
    if not raw or len(raw) > 400:
        raise GatekeeperError("SMILES must be non-empty and <= 400 characters.")
    if "." in raw:
        raise GatekeeperError(
            "Multi-component salts/mixtures ('.') are rejected. Submit the single active microspecies."
        )

    mol = Chem.MolFromSmiles(raw, sanitize=True)
    if mol is None:
        raise GatekeeperError("Invalid SMILES or broken Kekule valence structure.")

    if len(Chem.GetMolFrags(mol)) > 1:
        raise GatekeeperError("Disconnected molecular fragments are rejected.")

    hac = mol.GetNumHeavyAtoms()
    if hac < 1 or hac > MAX_HAC:
        raise GatekeeperError(
            f"Heavy atom count HAC={hac} outside CNS Kohn-Sham limit (1..{MAX_HAC})."
        )

    mw = float(Descriptors.MolWt(mol))
    if mw > MAX_MW:
        raise GatekeeperError(
            f"Molecular weight ({mw:.1f} Da) exceeds CNS ceiling ({MAX_MW:.0f} Da)."
        )

    for atom in mol.GetAtoms():
        z = atom.GetAtomicNum()
        if z not in ALLOWED_ATOMIC_NUMS:
            raise GatekeeperError(
                f"Element '{atom.GetSymbol()}' (Z={z}) is outside organic CNS chemical space "
                "(allowed: H, C, N, O, F, P, S, Cl, Br, I)."
            )
        if atom.GetNumRadicalElectrons() > 0:
            raise GatekeeperError(
                f"Open-shell radical center detected on atom {atom.GetSymbol()}{atom.GetIdx()}; "
                "restricted closed-shell RKS requires spin=0."
            )

    mol_h = Chem.AddHs(mol)
    formal_charge = int(Chem.GetFormalCharge(mol_h))
    total_z = sum(a.GetAtomicNum() for a in mol_h.GetAtoms())
    n_electrons = total_z - formal_charge
    if n_electrons <= 0 or (n_electrons % 2 != 0):
        raise GatekeeperError(
            f"Odd electron count ({n_electrons} e-, charge={formal_charge:+d}); "
            "submit a closed-shell singlet species."
        )

    pains_matches = _PAINS_CATALOG.GetMatches(mol)
    pains_alerts = [m.GetDescription() for m in pains_matches]
    if reject_pains and pains_alerts:
        raise GatekeeperError(
            f"PAINS assay-interference motif rejected: {', '.join(pains_alerts)}"
        )

    canonical_smiles = Chem.MolToSmiles(mol, isomericSmiles=True, canonical=True)
    inchikey = Chem.MolToInchiKey(mol)
    formula = rdMolDescriptors.CalcMolFormula(mol)
    tpsa = round(float(rdMolDescriptors.CalcTPSA(mol)), 2)
    clogp = round(float(Crippen.MolLogP(mol)), 2)
    hbd = int(rdMolDescriptors.CalcNumHBD(mol))
    hba = int(rdMolDescriptors.CalcNumHBA(mol))
    rotb = int(rdMolDescriptors.CalcNumRotatableBonds(mol))

    basic_amine_pat = Chem.MolFromSmarts("[NX3;H2,H1,H0;!$(NC=O);!$(NS=O);!$(N~a)]")
    basic_amines = len(mol.GetSubstructMatches(basic_amine_pat)) if basic_amine_pat else 0
    cns_mpo = _compute_pfizer_cns_mpo(clogp, mw, tpsa, hbd, basic_amines)

    props = {
        "input_smiles": raw,
        "canonical_smiles": canonical_smiles,
        "inchikey": inchikey,
        "formula": formula,
        "hac": hac,
        "mw": round(mw, 2),
        "formal_charge": formal_charge,
        "n_electrons": n_electrons,
        "tpsa": tpsa,
        "clogp": clogp,
        "hbd": hbd,
        "hba": hba,
        "rotatable_bonds": rotb,
        "cns_mpo": cns_mpo,
        "pains_alerts": pains_alerts,
    }
    return mol, props


def generate_relaxed_3d_geometry(
    mol_no_h: Chem.Mol,
    formal_charge: int,
    num_confs: int = 8,
    xtb_timeout_s: float = 35.0,
) -> Tuple[List[Tuple[str, Tuple[float, float, float]]], str]:
    """
    Generates 3D conformers via RDKit ETKDGv3 + MMFF94s, then refines the lowest-energy
    conformer with GFN2-xTB/ALPB(water) when the `xtb` binary is installed.
    Explicitly returns the exact `geometry_method` string for full scientific provenance.
    """
    mol = Chem.AddHs(mol_no_h)
    params = AllChem.ETKDGv3()
    params.randomSeed = 20261115
    params.pruneRmsThresh = 0.45
    params.useSmallRingTorsions = True

    conf_ids = list(AllChem.EmbedMultipleConfs(mol, numConfs=num_confs, params=params))
    if not conf_ids:
        # Fallback for strained bridged polycyclics (morphinans, tropanes)
        params.useRandomCoords = True
        conf_ids = list(AllChem.EmbedMultipleConfs(mol, numConfs=max(4, num_confs // 2), params=params))
    if not conf_ids:
        raise GatekeeperError("RDKit ETKDGv3 failed to embed valid 3D coordinates for this structure.")

    best_cid = conf_ids[0]
    best_e = float("inf")
    mmff_used = "MMFF94s"
    try:
        res = AllChem.MMFFOptimizeMoleculeConfs(
            mol, mmffVariant="MMFF94s", maxIters=500, numThreads=2
        )
        for cid, (not_conv, energy) in zip(conf_ids, res):
            if math.isfinite(energy) and energy < best_e:
                best_e = energy
                best_cid = cid
    except Exception:
        res = AllChem.UFFOptimizeMoleculeConfs(mol, maxIters=500, numThreads=2)
        mmff_used = "UFF"
        for cid, (not_conv, energy) in zip(conf_ids, res):
            if math.isfinite(energy) and energy < best_e:
                best_e = energy
                best_cid = cid

    conf = mol.GetConformer(best_cid)
    atoms_xyz: List[Tuple[str, Tuple[float, float, float]]] = []
    for idx in range(mol.GetNumAtoms()):
        sym = mol.GetAtomWithIdx(idx).GetSymbol()
        pos = conf.GetAtomPosition(idx)
        atoms_xyz.append((sym, (float(pos.x), float(pos.y), float(pos.z))))

    xtb_bin = shutil.which("xtb")
    if not xtb_bin:
        return atoms_xyz, f"RDKit-ETKDGv3/{mmff_used} (xtb-unavailable-fallback)"

    try:
        with tempfile.TemporaryDirectory(prefix="rprime_xtb_") as tmpdir:
            xyz_in = os.path.join(tmpdir, "input.xyz")
            lines = [str(len(atoms_xyz)), f"charge={formal_charge} uhf=0"]
            for sym, (x, y, z) in atoms_xyz:
                lines.append(f"{sym:<3s} {x:15.8f} {y:15.8f} {z:15.8f}")
            with open(xyz_in, "w", encoding="utf-8") as fh:
                fh.write("\n".join(lines) + "\n")

            cmd = [
                xtb_bin,
                "input.xyz",
                "--opt",
                "normal",
                "--gfn",
                "2",
                "--alpb",
                "water",
                "--chrg",
                str(formal_charge),
                "--uhf",
                "0",
                "--parallel",
                "2",
            ]
            proc = subprocess.run(
                cmd,
                cwd=tmpdir,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                timeout=xtb_timeout_s,
                check=False,
                text=True,
            )
            xyz_out = os.path.join(tmpdir, "xtbopt.xyz")
            if proc.returncode == 0 and os.path.isfile(xyz_out):
                parsed = _parse_xyz_file(xyz_out)
                if len(parsed) == len(atoms_xyz):
                    return parsed, "GFN2-xTB/ALPB(water)"
    except Exception:
        pass

    return atoms_xyz, f"RDKit-ETKDGv3/{mmff_used} (xtb-nonconverged-fallback)"


def _parse_xyz_file(path: str) -> List[Tuple[str, Tuple[float, float, float]]]:
    with open(path, "r", encoding="utf-8") as fh:
        raw_lines = [ln.strip() for ln in fh if ln.strip()]
    if len(raw_lines) < 3:
        return []
    n_atoms = int(raw_lines[0])
    out: List[Tuple[str, Tuple[float, float, float]]] = []
    for ln in raw_lines[2 : 2 + n_atoms]:
        parts = ln.split()
        if len(parts) < 4:
            return []
        sym = parts[0]
        x, y, z = float(parts[1]), float(parts[2]), float(parts[3])
        if not (math.isfinite(x) and math.isfinite(y) and math.isfinite(z)):
            return []
        out.append((sym, (x, y, z)))
    return out


def _resolve_xc_functional() -> str:
    """
    Resolves wB97X-D in PySCF's libxc/xcfun backend, falling back transparently
    only if a minimal libxc build omits a specific alias, and reporting verbatim.
    """
    from pyscf import dft

    candidates = ("wb97x_d", "hyb_gga_xc_wb97x_d", "wb97x_d3", "wb97x_v", "b3lyp")
    for xc in candidates:
        try:
            dft.libxc.parse_xc(xc)
            return xc
        except Exception:
            continue
    return "b3lyp"


def _build_rks_solver(pmol: Any, xc_func: str, use_gpu: bool = False) -> Tuple[Any, str]:
    """
    Constructs Restricted Kohn-Sham solver with RI-JK density fitting (def2-universal-jkfit)
    and ddCOSMO continuum water solvation (eps = 78.4). Supports gpu4pyscf when use_gpu=True.
    """
    engine_backend = "pyscf-cpu"
    mf = None
    if use_gpu:
        try:
            from gpu4pyscf.dft import rks as gpu_rks

            mf = gpu_rks.RKS(pmol, xc=xc_func).density_fit(auxbasis="def2-universal-jkfit")
            engine_backend = "gpu4pyscf-cuda"
        except Exception:
            mf = None

    if mf is None:
        from pyscf import dft

        mf = dft.RKS(pmol, xc=xc_func).density_fit(auxbasis="def2-universal-jkfit")

    # Attach ddCOSMO implicit water solvation
    try:
        mf = mf.ddCOSMO()
        mf.with_solvent.eps = WATER_EPSILON
    except Exception:
        from pyscf import solvent

        mf = solvent.ddCOSMO(mf)
        mf.with_solvent.eps = WATER_EPSILON

    mf.grids.level = 2
    mf.conv_tol = 1e-7
    mf.max_cycle = 75
    return mf, engine_backend


def _single_point_energy_ha(
    atoms_xyz: Sequence[Tuple[str, Tuple[float, float, float]]],
    charge: int,
    xc_func: str,
    use_gpu: bool = False,
) -> float:
    from pyscf import gto

    max_mem = int(os.environ.get("PYSCF_MAX_MEMORY", "6000"))
    pmol = gto.Mole()
    pmol.atom = [(s, c) for s, c in atoms_xyz]
    pmol.basis = "def2-svp"
    pmol.unit = "Angstrom"
    pmol.charge = charge
    pmol.spin = 0
    pmol.max_memory = max_mem
    pmol.verbose = 0
    pmol.build()

    mf, _ = _build_rks_solver(pmol, xc_func, use_gpu=use_gpu)
    e_tot = float(mf.kernel())
    if not mf.converged:
        # Newton-Raphson second-order fallback for tough SCF cases
        mf_newton = mf.newton()
        e_tot = float(mf_newton.kernel())
    return e_tot


def _get_reference_species_energy_ha(
    smiles: str, xc_func: str, use_gpu: bool = False
) -> float:
    key = (smiles, f"{xc_func}:{'gpu' if use_gpu else 'cpu'}")
    with _REF_ENERGY_LOCK:
        if key in _REF_ENERGY_CACHE:
            return _REF_ENERGY_CACHE[key]

    mol = Chem.MolFromSmiles(smiles)
    atoms_xyz, _ = generate_relaxed_3d_geometry(mol, formal_charge=0, num_confs=4)
    e_ha = _single_point_energy_ha(atoms_xyz, charge=0, xc_func=xc_func, use_gpu=use_gpu)
    with _REF_ENERGY_LOCK:
        _REF_ENERGY_CACHE[key] = e_ha
    return e_ha


def _compute_lowdin_charges_and_fukui(
    pmol: Any,
    mf_neutral: Any,
    xc_func: str,
    homo_idx: int,
    lumo_idx: int,
) -> Tuple[np.ndarray, np.ndarray, np.ndarray, str]:
    """
    Computes Mulliken charges, symmetric S^(1/2) Lowdin atomic charges q_A(N), and
    condensed electrophilic Fukui function f_A^+ = q_A(N) - q_A(N+1) from a vertical
    (N+1)-electron open-shell UKS calculation at the exact same geometry, with fallback
    to exact frontier LUMO Lowdin orbital density if the vertical radical anion fails SCF.
    """
    # Overlap matrix S and symmetric S^(1/2)
    ovlp = np.asarray(pmol.intor_symmetric("int1e_ovlp"), dtype=np.float64)
    eigvals, eigvecs = np.linalg.eigh(ovlp)
    s_half = (eigvecs * np.sqrt(np.clip(eigvals, 1e-12, None))) @ eigvecs.T

    dm_n = np.asarray(mf_neutral.make_rdm1(), dtype=np.float64)
    if dm_n.ndim == 3:
        dm_n = dm_n[0] + dm_n[1]

    # Lowdin gross orbital populations: diag(S^(1/2) * P * S^(1/2))
    pop_ao_n = np.einsum("ij,jk,ki->i", s_half, dm_n, s_half)
    # Mulliken gross orbital populations: diag(P * S)
    mull_ao_n = np.einsum("ij,ji->i", dm_n, ovlp)

    aoslices = pmol.aoslice_by_atom()
    n_atoms = pmol.natm
    q_lowdin_n = np.zeros(n_atoms, dtype=np.float64)
    q_mulliken_n = np.zeros(n_atoms, dtype=np.float64)
    for ia in range(n_atoms):
        p0, p1 = aoslices[ia, 2], aoslices[ia, 3]
        z_eff = float(pmol.atom_charge(ia))
        q_lowdin_n[ia] = z_eff - float(np.sum(pop_ao_n[p0:p1]))
        q_mulliken_n[ia] = z_eff - float(np.sum(mull_ao_n[p0:p1]))

    # Attempt true vertical (N+1) open-shell UKS single-point for finite-difference f_A^+
    try:
        from pyscf import dft, gto

        pmol_anion = pmol.copy()
        pmol_anion.charge = pmol.charge - 1
        pmol_anion.spin = 1
        pmol_anion.verbose = 0
        pmol_anion.build(False, False)

        mf_an = dft.UKS(pmol_anion, xc=xc_func).density_fit(auxbasis="def2-universal-jkfit")
        try:
            mf_an = mf_an.ddCOSMO()
            mf_an.with_solvent.eps = WATER_EPSILON
        except Exception:
            from pyscf import solvent

            mf_an = solvent.ddCOSMO(mf_an)
            mf_an.with_solvent.eps = WATER_EPSILON

        mf_an.grids.level = 2
        mf_an.conv_tol = 1e-6
        mf_an.max_cycle = 38

        # Seed initial guess directly from converged neutral MOs + 1 electron in LUMO
        mo_c = np.asarray(mf_neutral.mo_coeff, dtype=np.float64)
        occ_alpha = np.array(mf_neutral.mo_occ, dtype=np.float64) * 0.5
        occ_beta = occ_alpha.copy()
        if lumo_idx < len(occ_alpha):
            occ_alpha[lumo_idx] = 1.0
        dm_guess = np.stack(
            [
                (mo_c * occ_alpha) @ mo_c.T,
                (mo_c * occ_beta) @ mo_c.T,
            ],
            axis=0,
        )
        mf_an.kernel(dm0=dm_guess)
        if mf_an.converged:
            dm_an = np.asarray(mf_an.make_rdm1(), dtype=np.float64)
            dm_an_tot = dm_an[0] + dm_an[1]
            pop_ao_an = np.einsum("ij,jk,ki->i", s_half, dm_an_tot, s_half)
            q_lowdin_an = np.zeros(n_atoms, dtype=np.float64)
            for ia in range(n_atoms):
                p0, p1 = aoslices[ia, 2], aoslices[ia, 3]
                q_lowdin_an[ia] = float(pmol.atom_charge(ia)) - float(np.sum(pop_ao_an[p0:p1]))
            # f_A^+ = P_A(N+1) - P_A(N) = q_A(N) - q_A(N+1)
            fukui_plus = q_lowdin_n - q_lowdin_an
            return q_lowdin_n, q_mulliken_n, fukui_plus, "vertical-UKS(N+1)-Lowdin"
    except Exception:
        pass

    # Exact frontier-orbital Lowdin LUMO density fallback
    mo_c = np.asarray(mf_neutral.mo_coeff, dtype=np.float64)
    c_lumo_orth = s_half @ mo_c[:, lumo_idx]
    fukui_lumo = np.zeros(n_atoms, dtype=np.float64)
    for ia in range(n_atoms):
        p0, p1 = aoslices[ia, 2], aoslices[ia, 3]
        fukui_lumo[ia] = float(np.sum(c_lumo_orth[p0:p1] ** 2))
    return q_lowdin_n, q_mulliken_n, fukui_lumo, "frontier-LUMO-Lowdin-fallback"


def _generate_quantized_cubes_and_lobes(
    pmol: Any,
    mo_coeff: np.ndarray,
    homo_idx: int,
    lumo_idx: int,
    spacing_ang: float = 0.25,
    margin_ang: float = 3.0,
    isovalue: float = 0.038,
) -> Dict[str, Any]:
    """
    Evaluates real Kohn-Sham HOMO and LUMO wavefunctions on a 3D grid, produces
    gzipped Gaussian .cube files (base64 encoded, typically 18-42 KB), and extracts
    compact 3D lobe point clouds for instant WebGL/Canvas3D rendering.
    """
    coords_bohr = np.asarray(pmol.atom_coords(), dtype=np.float64)
    coords_ang = coords_bohr * BOHR_TO_ANGSTROM

    min_ang = coords_ang.min(axis=0) - margin_ang
    max_ang = coords_ang.max(axis=0) + margin_ang
    span_ang = max_ang - min_ang

    # Cap total grid points around ~68^3 (~314k) so .cube.gz stays < 45 KB & fast on 2 vCPUs
    eff_spacing = float(spacing_ang)
    max_dim = float(np.max(span_ang))
    if max_dim / eff_spacing > 68.0:
        eff_spacing = round(max_dim / 68.0, 3)

    nx = max(12, int(math.ceil(span_ang[0] / eff_spacing)) + 1)
    ny = max(12, int(math.ceil(span_ang[1] / eff_spacing)) + 1)
    nz = max(12, int(math.ceil(span_ang[2] / eff_spacing)) + 1)

    xs_ang = min_ang[0] + np.arange(nx) * eff_spacing
    ys_ang = min_ang[1] + np.arange(ny) * eff_spacing
    zs_ang = min_ang[2] + np.arange(nz) * eff_spacing

    gx, gy, gz = np.meshgrid(xs_ang, ys_ang, zs_ang, indexing="ij")
    pts_ang = np.column_stack([gx.ravel(), gy.ravel(), gz.ravel()])
    pts_bohr = pts_ang * ANGSTROM_TO_BOHR

    # Chunked GTO evaluation to keep peak RAM tiny
    n_pts = pts_bohr.shape[0]
    homo_vals = np.empty(n_pts, dtype=np.float32)
    lumo_vals = np.empty(n_pts, dtype=np.float32)
    c_homo = np.asarray(mo_coeff[:, homo_idx], dtype=np.float64)
    c_lumo = np.asarray(mo_coeff[:, lumo_idx], dtype=np.float64)

    chunk = 32768
    for start in range(0, n_pts, chunk):
        end = min(n_pts, start + chunk)
        ao = pmol.eval_gto("GTOval_sph", pts_bohr[start:end])
        homo_vals[start:end] = (ao @ c_homo).astype(np.float32)
        lumo_vals[start:end] = (ao @ c_lumo).astype(np.float32)

    origin_bohr = min_ang * ANGSTROM_TO_BOHR
    step_bohr = eff_spacing * ANGSTROM_TO_BOHR

    homo_cube_b64 = _encode_cube_gz_b64(
        pmol, "RPrime Kohn-Sham HOMO", origin_bohr, step_bohr, (nx, ny, nz), homo_vals
    )
    lumo_cube_b64 = _encode_cube_gz_b64(
        pmol, "RPrime Kohn-Sham LUMO", origin_bohr, step_bohr, (nx, ny, nz), lumo_vals
    )

    def sample_lobes(vals: np.ndarray, max_points: int = 360) -> List[List[float]]:
        mask = np.abs(vals) >= isovalue
        idxs = np.flatnonzero(mask)
        if idxs.size == 0:
            return []
        if idxs.size > max_points:
            # Deterministic stride weighted toward highest-amplitude density
            top_order = idxs[np.argsort(-np.abs(vals[idxs]))]
            step = max(1, top_order.size // max_points)
            idxs = top_order[::step][:max_points]
        out: List[List[float]] = []
        for idx in idxs:
            p = pts_ang[idx]
            out.append([round(float(p[0]), 2), round(float(p[1]), 2), round(float(p[2]), 2), round(float(vals[idx]), 4)])
        return out

    return {
        "grid_spacing_ang": eff_spacing,
        "grid_shape": [nx, ny, nz],
        "isovalue_default": isovalue,
        "homo_cube_gz_b64": homo_cube_b64,
        "lumo_cube_gz_b64": lumo_cube_gz_b64,
        "orbital_lobes": {
            "homo": sample_lobes(homo_vals),
            "lumo": sample_lobes(lumo_vals),
        },
    }


def _encode_cube_gz_b64(
    pmol: Any,
    title: str,
    origin_bohr: np.ndarray,
    step_bohr: float,
    shape: Tuple[int, int, int],
    values: np.ndarray,
) -> str:
    nx, ny, nz = shape
    header = [
        title,
        "Generated by RPrime PySCF Quantum Engine (quantized 0.25A grid)",
        f"{pmol.natm:5d} {origin_bohr[0]:12.6f} {origin_bohr[1]:12.6f} {origin_bohr[2]:12.6f}",
        f"{nx:5d} {step_bohr:12.6f} {0.0:12.6f} {0.0:12.6f}",
        f"{ny:5d} {0.0:12.6f} {step_bohr:12.6f} {0.0:12.6f}",
        f"{nz:5d} {0.0:12.6f} {0.0:12.6f} {step_bohr:12.6f}",
    ]
    coords_bohr = pmol.atom_coords()
    for ia in range(pmol.natm):
        z_num = int(pmol.atom_charge(ia))
        cx, cy, cz = coords_bohr[ia]
        header.append(f"{z_num:5d} {float(z_num):12.6f} {cx:12.6f} {cy:12.6f} {cz:12.6f}")

    # Quantize small noise <1e-4 to 0 so gzip achieves ~8x compression cleanly
    quant = np.where(np.abs(values) < 1e-4, 0.0, np.round(values, 4)).reshape((nx, ny, nz))
    body_lines: List[str] = []
    for ix in range(nx):
        for iy in range(ny):
            row = quant[ix, iy]
            for kz in range(0, nz, 6):
                seg = row[kz : kz + 6]
                body_lines.append(" ".join(f"{float(v):11.4E}" for v in seg))

    cube_bytes = ("\n".join(header) + "\n" + "\n".join(body_lines) + "\n").encode("ascii")
    gz_bytes = gzip.compress(cube_bytes, compresslevel=6)
    return base64.b64encode(gz_bytes).decode("ascii")


# Covalent warhead reaction rules with methanethiol (CH3SH = Cys172 sidechain model)
_WARHEAD_REACTIONS: List[Tuple[str, str, Optional[str]]] = [
    (
        "alpha_haloketone_phenacyl_sn2",
        "[C,#6:1](=[O:2])[CH2,CH1:3][Cl:4].[CH3:5][SH:6]>>[C:1](=[O:2])[C:3][S:6][CH3:5]",
        "Cl",  # Leaving group conjugate acid HCl (SMILES 'Cl' in RDKit = HCl!)
    ),
    (
        "alpha_bromoketone_phenacyl_sn2",
        "[C,#6:1](=[O:2])[CH2,CH1:3][Br:4].[CH3:5][SH:6]>>[C:1](=[O:2])[C:3][S:6][CH3:5]",
        "Br",  # HBr
    ),
    (
        "chloroacetamide_sn2",
        "[N:1][C:2](=[O:3])[CH2:4][Cl:5].[CH3:6][SH:7]>>[N:1][C:2](=[O:3])[CH2:4][S:7][CH3:6]",
        "Cl",
    ),
    (
        "maleimide_michael_addition",
        "[C:1]1=[C:2][C:3](=[O:4])[N:5][C:6]1=[O:7].[CH3:8][SH:9]>>[CH3:8][S:9][C:1]1[C:2][C:3](=[O:4])[N:5][C:6]1=[O:7]",
        None,
    ),
    (
        "cyanoacrylamide_reversible_michael",
        "[C:1]=[C:2]([C:3]#[N:4])[C:5](=[O:6]).[CH3:7][SH:8]>>[CH3:7][S:8][C:1][C:2]([C:3]#[N:4])[C:5](=[O:6])",
        None,
    ),
    (
        "acrylamide_acrylate_vinylketone_michael",
        "[C;!R:1]=[C;!R:2][C:3](=[O:4]).[CH3:5][SH:6]>>[CH3:5][S:6][C:1][C:2][C:3](=[O:4])",
        None,
    ),
    (
        "vinyl_sulfone_michael",
        "[C:1]=[C:2][S:3](=[O:4])(=[O:5]).[CH3:6][SH:7]>>[CH3:6][S:7][C:1][C:2][S:3](=[O:4])(=[O:5])",
        None,
    ),
    (
        "epoxide_ring_opening",
        "[C:1]1[O:2][C:3]1.[CH3:4][SH:5]>>[CH3:4][S:5][C:1][C:3][O:2]",
        None,
    ),
]


def _evaluate_covalent_warhead_delta_e(
    mol: Chem.Mol,
    e_ligand_ha: float,
    formal_charge: int,
    xc_func: str,
    use_gpu: bool = False,
) -> Dict[str, Any]:
    """
    Detects electrophilic covalent warheads, constructs the balanced methanethiol (CH3SH)
    adduct, optimizes geometry, and computes true Kohn-Sham Delta E_cov (kcal/mol) at the
    identical df-wB97X-D/def2-SVP + ddCOSMO(water) level of theory.
    """
    thiol = Chem.MolFromSmiles("CS")
    for wh_class, rxn_smarts, hx_smiles in _WARHEAD_REACTIONS:
        rxn = AllChem.ReactionFromSmarts(rxn_smarts)
        prods = rxn.RunReactants((mol, thiol))
        if not prods:
            continue
        adduct = prods[0][0]
        try:
            Chem.SanitizeMol(adduct)
        except Exception:
            continue

        if adduct.GetNumHeavyAtoms() > MAX_HAC + 3:
            return {
                "warhead_detected": True,
                "warhead_class": wh_class,
                "delta_e_cov_kcal": None,
                "adduct_smiles": Chem.MolToSmiles(adduct, isomericSmiles=True),
                "note": "Adduct exceeds HAC cap; covalent single-point skipped.",
            }

        adduct_charge = int(Chem.GetFormalCharge(adduct))
        adduct_xyz, adduct_geom_method = generate_relaxed_3d_geometry(
            adduct, formal_charge=adduct_charge, num_confs=6
        )
        e_adduct_ha = _single_point_energy_ha(
            adduct_xyz, charge=adduct_charge, xc_func=xc_func, use_gpu=use_gpu
        )
        e_ch3sh_ha = _get_reference_species_energy_ha("CS", xc_func, use_gpu=use_gpu)
        e_hx_ha = (
            _get_reference_species_energy_ha(hx_smiles, xc_func, use_gpu=use_gpu)
            if hx_smiles
            else 0.0
        )

        delta_e_kcal = (e_adduct_ha + e_hx_ha - e_ligand_ha - e_ch3sh_ha) * HARTREE_TO_KCAL_MOL
        return {
            "warhead_detected": True,
            "warhead_class": wh_class,
            "delta_e_cov_kcal": round(float(delta_e_kcal), 2),
            "adduct_smiles": Chem.MolToSmiles(adduct, isomericSmiles=True),
            "adduct_geometry_method": adduct_geom_method,
            "leaving_group_byproduct": hx_smiles,
        }

    # Explicit detection of the PDB 7UCD MV0 trap (aryl/benzofuranone methyl ketone lacking alpha-X)
    mv0_trap_pat = Chem.MolFromSmarts("[c,C][C](=O)[CH3]")
    if mv0_trap_pat and mol.HasSubstructMatch(mv0_trap_pat):
        return {
            "warhead_detected": False,
            "warhead_class": "unreactive_methyl_ketone_7ucd_mv0_trap",
            "delta_e_cov_kcal": None,
            "adduct_smiles": None,
            "note": (
                "Contains an unactivated alpha-CH3 ketone with no leaving group "
                "(PDB 7UCD 'MV0' artifact — non-electrophilic toward Cys172!)."
            ),
        }

    return {
        "warhead_detected": False,
        "warhead_class": "non_covalent",
        "delta_e_cov_kcal": None,
        "adduct_smiles": None,
    }


def run_kohn_sham_dft_pipeline(
    smiles: str,
    *,
    mol_name: Optional[str] = None,
    compute_covalent_delta_e: bool = True,
    cube_grid_spacing: float = 0.25,
    reject_pains: bool = False,
    use_gpu: bool = False,
    progress_cb: ProgressCallback = None,
) -> Dict[str, Any]:
    """
    End-to-end true Kohn-Sham DFT + volumetric orbital + covalent warhead pipeline.
    """
    t0 = time.perf_counter()

    def emit(event: str, payload: Dict[str, Any]) -> None:
        if progress_cb is not None:
            progress_cb(event, payload)

    emit("stage", {"step": "gatekeeper", "message": "Validating CNS chemical space & Kekule valence..."})
    mol, props = validate_and_analyze_smiles(smiles, reject_pains=reject_pains)

    emit("stage", {"step": "geometry", "message": "Running RDKit ETKDGv3 + GFN2-xTB/ALPB(water) relaxation..."})
    atoms_xyz, geom_method = generate_relaxed_3d_geometry(
        mol, formal_charge=props["formal_charge"], num_confs=8
    )

    from pyscf import gto

    xc_func = _resolve_xc_functional()
    max_mem = int(os.environ.get("PYSCF_MAX_MEMORY", "6000"))

    pmol = gto.Mole()
    pmol.atom = [(s, c) for s, c in atoms_xyz]
    pmol.basis = "def2-svp"
    pmol.unit = "Angstrom"
    pmol.charge = props["formal_charge"]
    pmol.spin = 0
    pmol.max_memory = max_mem
    pmol.verbose = 0
    pmol.build()

    mf, engine_backend = _build_rks_solver(pmol, xc_func, use_gpu=use_gpu)
    method_basis = f"df-{xc_func}/def2-SVP+ddCOSMO(eps={WATER_EPSILON})"

    emit(
        "stage",
        {
            "step": "scf_start",
            "method_basis": method_basis,
            "backend": engine_backend,
            "nao": int(pmol.nao_nr()),
            "message": f"Starting Kohn-Sham SCF ({method_basis}, {pmol.nao_nr()} basis functions)...",
        },
    )

    scf_history: List[Dict[str, Any]] = []
    prev_e: List[Optional[float]] = [None]

    def _scf_cb(envs: Dict[str, Any]) -> None:
        cyc = int(envs.get("cycle", len(scf_history))) + 1
        e_tot = float(envs.get("e_tot", 0.0))
        norm_g = float(envs.get("norm_gorb", 0.0))
        de = 0.0 if prev_e[0] is None else (e_tot - prev_e[0])
        prev_e[0] = e_tot
        rec = {
            "cycle": cyc,
            "e_tot_ha": round(e_tot, 8),
            "delta_e_ha": float(f"{de:.3e}"),
            "norm_gorb": float(f"{norm_g:.3e}"),
            "elapsed_s": round(time.perf_counter() - t0, 2),
        }
        scf_history.append(rec)
        emit("scf_iter", rec)

    mf.callback = _scf_cb
    total_energy_ha = float(mf.kernel())
    if not mf.converged:
        mf_newton = mf.newton()
        total_energy_ha = float(mf_newton.kernel())

    mo_energy = np.asarray(mf.mo_energy, dtype=np.float64)
    mo_occ = np.asarray(mf.mo_occ, dtype=np.float64)
    mo_coeff = np.asarray(mf.mo_coeff, dtype=np.float64)

    occ_indices = np.where(mo_occ > 0.5)[0]
    homo_idx = int(occ_indices[-1])
    lumo_idx = int(homo_idx + 1)

    homo_ev = float(mo_energy[homo_idx] * HARTREE_TO_EV)
    lumo_ev = float(mo_energy[lumo_idx] * HARTREE_TO_EV)
    gap_ev = float(lumo_ev - homo_ev)
    mu_ev = 0.5 * (homo_ev + lumo_ev)
    eta_ev = max(0.05, gap_ev)
    parr_omega_ev = float((mu_ev * mu_ev) / (2.0 * eta_ev))

    dip_vec = np.asarray(mf.dip_moment(unit="Debye", verbose=0), dtype=np.float64)
    dipole_debye = float(np.linalg.norm(dip_vec))

    emit("stage", {"step": "fukui_cubes", "message": "Computing condensed Fukui f_A^+ & 0.25 A .cube.gz orbitals..."})
    q_lowdin, q_mulliken, fukui_plus, fukui_method = _compute_lowdin_charges_and_fukui(
        pmol, mf, xc_func, homo_idx, lumo_idx
    )

    cube_bundle = _generate_quantized_cubes_and_lobes(
        pmol, mo_coeff, homo_idx, lumo_idx, spacing_ang=cube_grid_spacing
    )

    atoms_3d: List[Dict[str, Any]] = []
    heavy_fukui_best_idx = 0
    heavy_fukui_best_val = -999.0
    for idx, (sym, (x, y, z)) in enumerate(atoms_xyz):
        fp = float(fukui_plus[idx])
        if sym != "H" and fp > heavy_fukui_best_val:
            heavy_fukui_best_val = fp
            heavy_fukui_best_idx = idx
        atoms_3d.append(
            {
                "idx": idx,
                "symbol": sym,
                "x": round(x, 4),
                "y": round(y, 4),
                "z": round(z, 4),
                "lowdin_charge": round(float(q_lowdin[idx]), 4),
                "mulliken_charge": round(float(q_mulliken[idx]), 4),
                "fukui_f_plus": round(fp, 4),
            }
        )

    covalent_info: Dict[str, Any] = {
        "warhead_detected": False,
        "warhead_class": "skipped",
        "delta_e_cov_kcal": None,
        "adduct_smiles": None,
    }
    if compute_covalent_delta_e:
        emit("covalent", {"message": "Evaluating CH3SH covalent adduct thermodynamics..."})
        covalent_info = _evaluate_covalent_warhead_delta_e(
            mol, total_energy_ha, props["formal_charge"], xc_func, use_gpu=use_gpu
        )

    wall_s = round(time.perf_counter() - t0, 2)
    epistemic_notes = [
        "[?] Thermodynamic Delta E_cov measures exergonicity with methanethiol (Cys model), NOT transition-state barrier Delta G_ddagger or k_inact/K_I kinetics.",
        "[?] ddCOSMO(eps=78.4) models bulk aqueous polarization but omits explicit counter-ion pairing (cf. Article 07's 8.1-unit C172 Delta pKa swing).",
    ]
    if props["pains_alerts"]:
        epistemic_notes.append(
            f"[!] PAINS structural alert(s) flagged: {', '.join(props['pains_alerts'])}."
        )

    result = {
        "status": "ok",
        "mol_name": mol_name or props["formula"],
        "inchikey": props["inchikey"],
        "smiles": props["input_smiles"],
        "canonical_smiles": props["canonical_smiles"],
        "formula": props["formula"],
        "method_basis": method_basis,
        "xc_functional": xc_func,
        "engine_backend": engine_backend,
        "geometry_method": geom_method,
        "fukui_method": fukui_method,
        "converged": bool(mf.converged),
        "hac": props["hac"],
        "mw": props["mw"],
        "formal_charge": props["formal_charge"],
        "tpsa": props["tpsa"],
        "clogp": props["clogp"],
        "cns_mpo": props["cns_mpo"],
        "pains_alerts": props["pains_alerts"],
        "total_energy_ha": round(total_energy_ha, 8),
        "homo_ev": round(homo_ev, 4),
        "lumo_ev": round(lumo_ev, 4),
        "homo_lumo_gap_ev": round(gap_ev, 4),
        "chemical_potential_ev": round(mu_ev, 4),
        "chemical_hardness_ev": round(eta_ev, 4),
        "parr_omega_ev": round(parr_omega_ev, 4),
        "dipole_debye": round(dipole_debye, 3),
        "dipole_vector_debye": [round(float(v), 3) for v in dip_vec],
        "reactive_atom_idx": heavy_fukui_best_idx,
        "fukui_f_plus": [round(float(v), 4) for v in fukui_plus],
        "warhead_detected": covalent_info["warhead_detected"],
        "warhead_class": covalent_info["warhead_class"],
        "delta_e_cov_kcal": covalent_info["delta_e_cov_kcal"],
        "adduct_smiles": covalent_info.get("adduct_smiles"),
        "covalent_details": covalent_info,
        "atoms_3d": atoms_3d,
        "homo_cube_gz_b64": cube_bundle["homo_cube_gz_b64"],
        "lumo_cube_gz_b64": cube_bundle["lumo_cube_gz_b64"],
        "cube_grid_spacing_ang": cube_bundle["grid_spacing_ang"],
        "cube_grid_shape": cube_bundle["grid_shape"],
        "orbital_lobes": cube_bundle["orbital_lobes"],
        "scf_history": scf_history,
        "wall_time_s": wall_s,
        "epistemic_notes": epistemic_notes,
    }
    emit("result", result)
    return result
