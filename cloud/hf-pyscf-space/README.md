---
title: RPrime True-DFT and Vina Engine
emoji: ⚛️
colorFrom: green
colorTo: indigo
sdk: docker
app_port: 7860
license: mit
short_description: Kohn-Sham df-wB97X-D/def2-SVP + ddCOSMO PySCF & AutoDock Vina 1.2
---

# RPrime True-DFT & AutoDock Vina 1.2 Cloud Engine (`hf-pyscf-space`)

Authentic, zero-surrogate quantum neuropharmacology and covalent/non-covalent structure-based drug discovery backend for **Neuroscience with RPrime** (`sim_discovery.html`).

Designed to run 24/7 at **$0.00/month** inside a sanctioned Hugging Face Spaces Free Docker container (`2 vCPU / 16 GB RAM`) behind the Cloudflare R2/D1 canonical `InChIKey` edge cache (`cloud/cf-quantum-gateway/`).

## Scientific Stack (Zero Phony Approximations)

1. **Anti-Slop CNS Chemical Space Gatekeeper (`RDKit`):**
   - Canonicalizes SMILES, enforces closed-shell organic CNS space (`HAC <= 38`, `MW <= 550 Da`, elements `H,C,N,O,F,P,S,Cl,Br,I`, `spin = 0`), screens `PAINS` alerts, and computes Ertl `TPSA`, Wildman–Crippen `cLogP`, and 6-parameter Pfizer `CNS MPO` (`0–6`).
2. **3D Conformer Ensemble & Pre-Relaxation (`ETKDGv3` + `GFN2-xTB/ALPB`):**
   - Generates 8 3D conformers via `RDKit ETKDGv3` + `MMFF94s` pre-filtering, then relaxes the lowest-energy conformer in **`xtb` (`GFN2-xTB` + `ALPB` continuum water)** (with transparent `MMFF94s` fallback logged verbatim if `xtb` is absent).
3. **True Kohn–Sham Density Functional Theory (`PySCF`):**
   - Solves restricted Kohn–Sham SCF (`dft.RKS`) with **RI-JK density fitting (`def2-universal-jkfit`)**, **`wb97x_d` (`ωB97X-D`)**, **`def2-svp`**, and **`ddCOSMO` (`ε = 78.4` water)** (`grids.level = 2`, `conv_tol = 1e-7`).
   - Computes total SCF energy (`Ha`), `HOMO`/`LUMO` (`eV`), Parr global electrophilicity $\omega = \mu^2 / (2\eta)$, molecular dipole (`Debye`), condensed electrophilic **Fukui $f_A^+$** (`N+1` vs `N` Löwdin/Mulliken populations), quantized `0.25 Å` Gaussian **`.cube.gz`** (`HOMO` & `LUMO`), and balanced **$\text{CH}_3\text{SH}$ (`Cys172` model) covalent warhead reaction energies $\Delta E_{\text{cov}}$ (`kcal/mol`)**.
4. **230,000+ RCSB PDB Streaming, 7-Axis `LIGSITE` & `AutoDock Vina 1.2`:**
   - Streams any PDB from `files.rcsb.org` (or AlphaFold DB), runs vectorized 7-axis Hendlich (1997) `LIGSITE` buriedness cavity detection, **refuses blind non-covalent docking on flat surfaces (`< 180 Å³`, e.g., apo `ΔFosB` `18 Å³`)** unless `covalent_target_res` is specified, prepares `.pdbqt` topologies with `Meeko`, and docks via `AutoDock Vina 1.2` (`exhaustiveness = 6`) with explicit `[?]` `±2.2 kcal/mol RMSE` epistemic bounds.

## HTTP API Endpoints (`Port 7860`)

- `GET /health` — Engine versions (`pyscf`, `rdkit`, `xtb`, `vina`, `meeko`) and capacity status.
- `POST /api/v1/dft` — Full synchronous JSON solve (`df-ωB97X-D/def2-SVP + ddCOSMO`, `.cube.gz`, Fukui $f_A^+$, covalent $\Delta E_{\text{cov}}$) with per-`InChIKey` single-flight coalescing.
- `POST /api/v1/dft/stream` — Server-Sent Events (`text/event-stream`) streaming every live Kohn–Sham SCF cycle (`E_tot`, `|g_orb|`, `ΔE`).
- `POST /api/v1/dock` — `LIGSITE` pocket volume gate + `Meeko` + `AutoDock Vina 1.2` pose generation.

## Optional Environment Variables

- `RPRIME_GATEWAY_KEY`: Shared secret validated via constant-time `hmac.compare_digest` against `X-RPrime-Gateway-Key` (leave unset for open direct access).
- `ALLOWED_ORIGINS`: Comma-separated CORS origins (defaults to `*` for open scientific access or restrict to `https://neurosciencerprime.github.io`).
- `PYSCF_MAX_MEMORY`: Max RAM in MB per SCF worker (default `6000`).
