-- ============================================================================
-- RPrime Open Quantum Neuro-Atlas — Cloudflare D1 (SQLite) Schema
-- Compute-Once, Compound-Forever Molecular Index & Pareto Leaderboards
--
-- Initialize locally:
--   npx wrangler d1 execute rprime-neuro-atlas --local --file=./schema.sql
-- Initialize remote:
--   npx wrangler d1 execute rprime-neuro-atlas --remote --file=./schema.sql
-- ============================================================================

CREATE TABLE IF NOT EXISTS atlas_entries (
  id TEXT PRIMARY KEY,
  inchikey TEXT NOT NULL,
  smiles TEXT NOT NULL,
  mol_name TEXT,
  pdb_id TEXT NOT NULL DEFAULT 'NONE',
  method_basis TEXT NOT NULL,
  hac INTEGER NOT NULL CHECK (hac > 0 AND hac <= 38),
  mw REAL NOT NULL CHECK (mw > 0.0 AND mw <= 550.5),
  cns_mpo REAL CHECK (cns_mpo IS NULL OR (cns_mpo >= 0.0 AND cns_mpo <= 6.0)),
  homo_ev REAL,
  lumo_ev REAL,
  parr_omega_ev REAL,
  delta_e_cov_kcal REAL,
  vina_kcal REAL,
  pocket_vol_a3 REAL,
  orcid_credit TEXT,
  researcher_name TEXT,
  r2_key TEXT NOT NULL,
  source_tier TEXT NOT NULL,
  hit_count INTEGER NOT NULL DEFAULT 1 CHECK (hit_count >= 1),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CONSTRAINT uq_atlas_inchikey_pdb_method UNIQUE (inchikey, pdb_id, method_basis)
);

-- Pareto Leaderboard Indexes (per-PDB and global queries)
CREATE INDEX IF NOT EXISTS idx_atlas_pdb_mpo
  ON atlas_entries (pdb_id, cns_mpo DESC, delta_e_cov_kcal ASC, vina_kcal ASC);

CREATE INDEX IF NOT EXISTS idx_atlas_pdb_delta_e
  ON atlas_entries (pdb_id, delta_e_cov_kcal ASC, cns_mpo DESC);

CREATE INDEX IF NOT EXISTS idx_atlas_pdb_vina
  ON atlas_entries (pdb_id, vina_kcal ASC, cns_mpo DESC);

CREATE INDEX IF NOT EXISTS idx_atlas_global_mpo
  ON atlas_entries (cns_mpo DESC, hit_count DESC);

-- Fast exact-identity, SMILES alias, R2 key, and recency lookups
CREATE INDEX IF NOT EXISTS idx_atlas_inchikey
  ON atlas_entries (inchikey);

CREATE INDEX IF NOT EXISTS idx_atlas_smiles_lookup
  ON atlas_entries (smiles, pdb_id, method_basis);

CREATE INDEX IF NOT EXISTS idx_atlas_r2_key
  ON atlas_entries (r2_key);

CREATE INDEX IF NOT EXISTS idx_atlas_created
  ON atlas_entries (created_at DESC);
