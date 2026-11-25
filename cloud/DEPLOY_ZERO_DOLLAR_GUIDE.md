# RPrime Discovery OS — 5-Minute `$0.00/Month` 24/7 Cloud Deployment Guide

This guide walks through deploying the complete **Option B True Kohn–Sham DFT (`PySCF df-ωB97X-D/def2-SVP + ddCOSMO`) + `AutoDock Vina 1.2` + `230k+` RCSB PDB Cloud Stack** so it runs **24/7 in the cloud** (your laptop stays off), survives **100,000+ viral visits**, and costs **`$0.00/month` out of pocket** using 100% ToS-sanctioned free tiers.

---

## Architecture at a Glance (`$0.00` Stack)

```text
Visitor Browser (GitHub Pages: sim_discovery.html, sim_tracker.html + rprime_si.js — $0)
 ├── Direct CORS PDB/AlphaFold Stream ──► files.rcsb.org (230k+ PDBs) & alphafold.ebi.ac.uk
 ├── Local <150 ms 3D + Tier-1 SI ──────► LIGSITE + Cys SASA + <2 ms CNS Gate + On-Device rprime_kb.json
 └── Live DFT / Docking / SI API Call ──► Cloudflare Worker Gateway (cloud/cf-quantum-gateway — $0)
                                           ├── 1. Edge Cache + R2 Vault (10 GB free, $0 egress, <30 ms)
                                           ├── 2. Single-Flight InChIKey Lock (1,000 clicks = 1 solve)
                                           ├── 3. PubChem + MolSSI QCArchive Federation (<50 ms)
                                           ├── 4. Workers AI Loyal RPrime SI (10k free neurons/day, $0)
                                           ├── 5. [Optional] Modal GPU Turbo ($30/mo free credit, ~3s)
                                           └── 6. [24/7 Auto-Failover] Hugging Face Free Docker (2 vCPU / 16 GB RAM, $0 forever)
```

---

## Step 0 — Generate One Shared Gateway Secret (30 Seconds)

Generate a random 64-character hex secret so only your Cloudflare Edge Gateway (with its anti-slop `HAC <= 38` gatekeeper and rate-limiter) can trigger fresh compute on Hugging Face or Modal.

**PowerShell (Windows):**
```powershell
-join ((1..32) | ForEach-Object { "{0:x2}" -f (Get-Random -Maximum 256) })
```

**macOS / Linux:**
```bash
openssl rand -hex 32
```

Save this string temporarily — you will paste it as a secret in Hugging Face, Cloudflare, and (optionally) Modal. Never commit it to Git.

---

## Step 1 — Deploy 24/7 Baseline Compute on Hugging Face Spaces (`$0.00`, No Credit Card)

`cloud/hf-pyscf-space/` runs genuine Kohn–Sham **`PySCF` (`df-ωB97X-D/def2-SVP` with RI-JK density fitting + `ddCOSMO` water)**, **`GFN2-xTB` / `RDKit ETKDGv3`**, and **`Meeko` + `AutoDock Vina 1.2`** inside Hugging Face's free **`2 vCPU / 16 GB RAM`** container.

1. Sign in at [huggingface.co/new-space](https://huggingface.co/new-space) (free account, **no credit card required**).
2. Configure the Space:
   - **Space name:** `rprime-quantum-engine`
   - **Select the Space SDK:** **Docker** → choose **Blank**
   - **Space hardware:** **`CPU basic · 2 vCPU · 16 GB · FREE`**
   - **Visibility:** **Public** *(free Docker Spaces are public; all secrets live safely in encrypted Space Secrets)*
3. Open your new Space's **Settings → Variables and secrets → New secret**:
   - **Name:** `GATEWAY_SHARED_SECRET` *(also add `RPRIME_GATEWAY_KEY` with the exact same value if prompted by your Space config)*
   - **Value:** `<paste-secret-from-step-0>`
4. Push the contents of `cloud/hf-pyscf-space/` into the Space repository:
   ```powershell
   cd cloud/hf-pyscf-space
   git init
   git checkout -b main
   git add README.md Dockerfile requirements.txt app.py quantum_engine.py docking_engine.py
   git commit -m "Deploy RPrime PySCF df-wB97X-D + Vina 1.2 engine"
   git remote add space https://huggingface.co/spaces/<YOUR_HF_USERNAME>/rprime-quantum-engine
   git push --force space main
   ```
   *(Alternatively, drag-and-drop those 6 files directly in the Hugging Face browser UI under **Files → Add file → Upload files**.)*
5. Wait ~3–4 minutes for the Docker image to build (`Running` badge). Copy your Space's **Direct URL**:
   ```text
   https://<YOUR_HF_USERNAME>-rprime-quantum-engine.hf.space
   ```
6. **Verify Health:**
   ```powershell
   curl.exe https://<YOUR_HF_USERNAME>-rprime-quantum-engine.hf.space/health
   ```
   > **24/7 Sleepless Note:** Free HF Spaces pause after 48 hours of zero traffic and automatically wake on the next incoming HTTP request — your personal laptop never needs to stay running.

---

## Step 2 — Deploy Cloudflare Edge Gateway, R2 Vault & D1 Atlas (`$0.00` Free Tier)

`cloud/cf-quantum-gateway/` enforces the `<2 ms` CNS gatekeeper, serves cached `.cube.gz` orbitals + docked poses globally at **`$0.00` egress**, indexes the **Open Quantum Neuro-Atlas**, and routes cold solves to compute.

1. Sign in to [dash.cloudflare.com](https://dash.cloudflare.com) (Workers Free + D1 Free + R2 Free `10 GB` storage / `0` egress fees).
2. Install dependencies & authenticate Wrangler:
   ```powershell
   cd cloud/cf-quantum-gateway
   npm install
   npx wrangler login
   ```
3. **Create the Free R2 Bucket (`QUANTUM_VAULT`):**
   ```powershell
   npx wrangler r2 bucket create rprime-quantum-vault
   ```
   *(Verify `bucket_name` in `wrangler.jsonc` matches `rprime-quantum-vault`.)*
4. **Create & Initialize the Free D1 SQLite Database (`ATLAS_DB`):**
   ```powershell
   npx wrangler d1 create rprime-atlas-db
   ```
   Copy the `database_id` printed in the terminal into `cloud/cf-quantum-gateway/wrangler.jsonc` under the `ATLAS_DB` `d1_databases` binding, then apply `schema.sql`:
   ```powershell
   npx wrangler d1 execute rprime-atlas-db --remote --file=./schema.sql
   ```
5. **Check `ALLOWED_ORIGINS` in `wrangler.jsonc`:**
   Ensure `vars.ALLOWED_ORIGINS` includes your GitHub Pages domain (e.g., `https://neurosciencerprime.github.io,http://localhost:8000`).
6. **Bind Encrypted Worker Secrets:**
   ```powershell
   npx wrangler secret put HF_SPACE_URL
   # Paste: https://<YOUR_HF_USERNAME>-rprime-quantum-engine.hf.space

   npx wrangler secret put GATEWAY_SHARED_SECRET
   # Paste: <paste-secret-from-step-0>
   ```
7. **Deploy the Edge Gateway:**
   ```powershell
   npx wrangler deploy
   ```
   Wrangler prints your live 24/7 gateway URL:
   ```text
   https://rprime-quantum-gateway.<YOUR_SUBDOMAIN>.workers.dev
   ```
8. **Verify Edge Gateway & Atlas:**
   ```powershell
   curl.exe https://rprime-quantum-gateway.<YOUR_SUBDOMAIN>.workers.dev/health
   curl.exe "https://rprime-quantum-gateway.<YOUR_SUBDOMAIN>.workers.dev/api/v1/atlas?pdb_id=5VPE&limit=10"
   ```

---

## Step 3 — (Optional) Add Modal GPU Turbo (`~3s` DFT, `$30/mo` Free Credits + Hard `$0` Cap)

`cloud/hf-pyscf-space/` already handles 100% of DFT and Vina jobs for `$0.00`. Adding `cloud/modal-gpu-turbo/` drops cold Kohn–Sham SCF wall times from `~10–18 s` (CPU) to **`~2.5–3 s` (`gpu4pyscf` scale-to-zero GPU)** using Modal's recurring **`$30/month` Starter free credit** (~5,000+ novel DFT solves/month).

1. Create a Starter account at [modal.com](https://modal.com) and authenticate locally:
   ```powershell
   pip install modal
   modal setup
   ```
2. **Enforce Hard `$0.00` Out-of-Pocket Protection:**
   - In **Modal Dashboard → Settings → Workspace / Billing Limits**, set your monthly spending limit strictly at or below the **`$30.00` free monthly credit** so you can never be billed a cent.
   - **Zero-Downtime Failover:** If your `$30` monthly GPU credit ever runs out mid-month (or if `MODAL_URL` is left unset), `cf-quantum-gateway` catches the timeout/status in milliseconds and **automatically fails over to your free 24/7 Hugging Face Space (`HF_SPACE_URL`)** with zero broken requests.
3. Add your shared gateway key as a Modal secret (`rprime-gateway-secret` with `GATEWAY_SHARED_SECRET=<paste-secret-from-step-0>`), then deploy:
   ```powershell
   modal deploy cloud/modal-gpu-turbo/modal_app.py
   ```
4. Copy the deployed `https://<workspace>--rprime-gpu-turbo.modal.run` URL and register it on Cloudflare:
   ```powershell
   cd cloud/cf-quantum-gateway
   npx wrangler secret put MODAL_URL
   # Paste: https://<workspace>--rprime-gpu-turbo.modal.run
   ```

---

## Step 4 — Connect `sim_discovery.html` & Run End-to-End Verification

1. **Zero-Edit Live Query-Param Test (`?api=`):**
   Before editing any HTML, test your live gateway directly in the browser using the `?api=` override built into `sim_discovery.html`:
   ```text
   https://neurosciencerprime.github.io/sim_discovery.html?api=https://rprime-quantum-gateway.<YOUR_SUBDOMAIN>.workers.dev
   ```
   - Stream **`5VPE`** (`ΔFosB/JunD`) from RCSB PDB → confirm `LIGSITE` flags `< 180 Å³` covalent-only geometry and locates **`CYS 172`** (`47.6 Å²` apo / `32.2 Å²` DNA-bound).
   - Select **Benzofuranone α-Chlorophenacyl** (or enter a novel CNS SMILES with `HAC <= 38`) and run **True DFT (`ωB97X-D/def2-SVP`)**:
     - **1st run (Cold Solve):** Streams/solves in `~3–16 s`, renders 3D volumetric **HOMO/LUMO `.cube`** lobes + **Fukui $f_A^+$** + **$\Delta E_{\text{cov}}$**, and writes permanently to Cloudflare R2 + D1.
     - **2nd run (Warm Hit — open in an Incognito tab!):** Returns the exact Kohn–Sham `.cube.gz` bundle from Cloudflare Edge/R2 in **`<30 ms`** with **`0` compute used**.
2. **Interactive UI Configuration (`localStorage`):**
   Click **`[⚙ Cloud DFT Gateway]`** in the top bar of `sim_discovery.html` to paste, test, or switch endpoints anytime without touching code.
3. **Make It Default for All Visitors:**
   Once verified, set your `https://rprime-quantum-gateway.<YOUR_SUBDOMAIN>.workers.dev` URL as `DEFAULT_GATEWAY_URL` in `sim_discovery.html`, commit, and `git push` to GitHub Pages.

---

## Step 5 — Activate Tier-2 Loyal RPrime SI (`$0.00/mo` Cloudflare Workers AI)

Good news: **there is no separate service to deploy or pay for.** Because `cloud/cf-quantum-gateway/wrangler.jsonc` already declares `"ai": { "binding": "AI" }`, your `npx wrangler deploy` in **Step 2** automatically activates **`POST /api/v1/si/chat`** on the exact same Cloudflare Worker!

1. **Zero Keys, Zero Credit Card, `10,000` Free Neurons/Day:**
   - Cloudflare Workers AI includes **`10,000` free neurons every day** (`@cf/meta/llama-3.1-8b-instruct-fast`) out of the box — no OpenAI/Anthropic API keys and no surprise billing.
   - Confirm it is live on your gateway `/health` endpoint (`"si_available": true`):
     ```powershell
     curl.exe https://rprime-quantum-gateway.<YOUR_SUBDOMAIN>.workers.dev/health
     ```
2. **Automatic Connection Across All Pages (`⌘J` / `Ctrl+J`):**
   - `assets/rprime_si.js` automatically reads the exact same `localStorage['rprime_dft_gateway_url']` saved in `sim_discovery.html` (or can be set directly via **`[⚙ SI Gateway]`** inside the `⌘J` SI drawer).
3. **Server-Locked Loyalty + Anti-Platitude Firewall + Fail-Closed Tier-1 Fallback:**
   - **Hardened Server Prompt & Verifier:** Every Tier-2 reply is enforced against RPrime's corpus (Articles 01–08 + Penrose), isolated inside `<user_query>` prompt-injection tags, gated on `n_logs >= 3` before `sim_tracker.html` predictions, and post-checked for: (a) `>= 2` exact `StatePacket` telemetry numbers when present, (b) **zero** banned pop-science platitudes (`dopamine detox`, `willpower`, `cold plunge`, `mindfulness`, etc.) or disloyal framing, and (c) an explicit `[?]` epistemic bound.
   - **Unbreakable Quota Cap Resilience:** Per-IP edge rate-limiting (`15` chats/hr) prevents single-user abuse. Whenever the `10,000` daily free neurons cap is reached — or if no gateway is configured or a reply trips the verifier — both the Worker (`tier: "tier1_fallback"`) and `assets/rprime_si.js` **instantly fail-closed to the deterministic on-device Tier-1 BM25 + telemetry engine (`assets/rprime_kb.json`)** with `0` errors and `$0.00` cost.

---

## Why Viral Spikes (`100,000+` Visits) Cost `$0.00` & Never Burn Out Quota

| Protection Layer | What Happens During a Viral Traffic Surge | Compute Cost | Egress / Storage Cost |
| :--- | :--- | :--- | :--- |
| **1. Direct Browser PDB/AlphaFold CORS** | `230k+` PDBs & `200M+` AlphaFold structures stream straight from `rcsb.org` / `ebi.ac.uk` to the visitor's WebGL/Canvas3D engine; `LIGSITE` runs client-side. | `0` CPU s | `$0.00` |
| **2. `<2 ms` CNS Pre-Gatekeeper** | Blocks `HAC > 38`, `MW > 550`, metals, open-shell radicals, `PAINS`, and blind docking on flat `<180 Å³` surfaces before SCF starts. Trolls submitting `C200` buckyballs burn zero CPU. | `0` CPU s | `$0.00` |
| **3. Immutable `InChIKey` R2 + CDN Vault** | Every `InChIKey × PDB_ID` solve (`~35 KB` `.cube.gz` + JSON) is cached with `Cache-Control: immutable`. `10 GB` Free R2 holds **`~285,000` unique DFT solutions** forever. | `0` CPU s on every repeat view | **`$0.00` R2 egress** |
| **4. Single-Flight `InChIKey` Coalescing** | If 2,000 Reel viewers click a brand-new molecule at the exact same second, Worker + FastAPI locks coalesce all 2,000 requests onto **1** SCF run. | `1` solve total | `$0.00` |
| **5. `PubChem` / `QCArchive` + IP Token Bucket** | Known molecules hit open-science DFT archives in `<50 ms`; abusive IPs spamming random uncached SMILES get `HTTP 429` while cached Atlas reads remain **100% unlimited**. | Bounded & fair-queued | `$0.00` |
| **6. Workers AI `10k` Neurons/Day → Tier-1 Fallback** | `POST /api/v1/si/chat` caps at `15` chats/hr/IP inside Cloudflare's free `10,000` neurons/day; overflow seamlessly drops to on-device Tier-1 (`rprime_kb.json` + `StatePacket`). | Capped at `$0.00` free tier | `$0.00` |
