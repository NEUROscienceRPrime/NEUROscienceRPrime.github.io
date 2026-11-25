# RPrime Cloudflare Quantum Gateway (`$0.00/mo` Edge Cache, Federation & Auto-Failover)

Cloudflare Workers + R2 + D1 edge gateway for **RPrime Discovery OS** (`sim_discovery.html`) and the **RPrime Open Quantum Neuro-Atlas**.

## Architecture (`O(1)` Compute, `O(0)` Viral Reads)

```
Browser (sim_discovery.html)
  └─▶ Cloudflare Worker (`cf-quantum-gateway`)
        ├─ 1. < 2 ms CNS Anti-Slop Gatekeeper (HAC <= 38, MW <= 550, H/C/N/O/F/P/S/Cl/Br/I, closed-shell, PAINS, 4-char PDB)
        ├─ 2. Edge Cache API (`caches.default`) + R2 Vault (`QUANTUM_VAULT`, 10 GB free, $0 egress)  [100% UNLIMITED]
        ├─ 3. Per-IP Token-Bucket Rate Limiter (novel uncached submits ONLY; HTTP 429)
        ├─ 4. Single-Flight Request Coalescing (deduplicates concurrent viral hits)
        ├─ 5. Open-Science Federation: PubChem PUG-REST + MolSSI QCArchive (2500 ms fail-fast)
        ├─ 6. Primary Modal GPU Turbo (`MODAL_URL`, 12s timeout)
        ├─ 7. Automatic Seamless Failover -> 24/7 HF Spaces Free Docker (`HF_SPACE_URL`)
        └─ 8. `ctx.waitUntil()` persist immutable ~35 KB bundle to R2 + upsert D1 (`ATLAS_DB`) + stamp `[?]` bounds
```

## Endpoints

| Method | Path | Purpose |
| :--- | :--- | :--- |
| `GET` | `/health` | Instant edge health & binding status |
| `GET` | `/api/v1/atlas` | Pareto leaderboard (`?pdb_id=5VPE&sort=mpo\|delta_e\|vina\|omega\|hits\|recent&limit=50`) |
| `GET` | `/api/v1/atlas/:key` | Immutable `~35 KB` DFT + `.cube.gz` R2 bundle (`max-age=31536000, immutable`) |
| `POST` | `/api/v1/dft` | True Kohn–Sham `df-wB97X-D/def2-SVP + ddCOSMO` pipeline with federation & failover |
| `POST` | `/api/v1/dft/stream` | Live SSE SCF convergence proxy (serves instant R2 SSE hit if cached) |
| `POST` | `/api/v1/dock` | Any-PDB `AutoDock Vina 1.2` + `LIGSITE` cavity pipeline with failover |

## Quick Deploy (`$0.00/mo` Cloudflare Free Tier)

```bash
cd cloud/cf-quantum-gateway
npm install
npx wrangler login
```

### 1. Create R2 Vault & D1 Neuro-Atlas Database

```bash
# Create R2 bucket (10 GB free, $0.00 egress)
npx wrangler r2 bucket create rprime-quantum-vault

# Create D1 SQLite database (5 GB free, 5M reads/day)
npx wrangler d1 create rprime-neuro-atlas
```

Copy the `database_id` printed by `wrangler d1 create` into `wrangler.jsonc` (`d1_databases[0].database_id`).

### 2. Apply the D1 Open Quantum Neuro-Atlas Schema

```bash
# Local dev database
npx wrangler d1 execute rprime-neuro-atlas --local --file=./schema.sql

# Production Cloudflare D1 database
npx wrangler d1 execute rprime-neuro-atlas --remote --file=./schema.sql
```

### 3. Bind Secrets (Zero Hardcoded Credentials)

```bash
# Required 24/7 Free Docker baseline (Hugging Face Space)
npx wrangler secret put HF_SPACE_URL

# Optional GPU Turbo tier (Modal Starter $30/mo free credit; auto-fails over to HF after 12s)
npx wrangler secret put MODAL_URL

# Optional shared key sent in X-RPrime-Gateway-Key to protect upstream endpoints
npx wrangler secret put GATEWAY_SHARED_SECRET
```

### 4. Typecheck & Deploy

```bash
npm run typecheck
npx wrangler deploy
```

### 5. Local Development

Create a gitignored `.dev.vars` file for local `wrangler dev` testing:

```dotenv
HF_SPACE_URL=https://<your-user>-rprime-true-dft.hf.space
MODAL_URL=
GATEWAY_SHARED_SECRET=local-dev-secret
```

Then run:

```bash
npm run dev
```
