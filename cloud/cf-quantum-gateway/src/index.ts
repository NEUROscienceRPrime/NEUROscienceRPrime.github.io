/**
 * RPrime Quantum Gateway — Cloudflare Workers Edge Cache, Open-Science Federation
 * & Automatic Modal GPU -> Hugging Face Spaces Free Docker Failover Gateway.
 *
 * Routes:
 *   GET  /health               — Instant edge readiness & binding status
 *   GET  /api/v1/atlas         — Pareto leaderboard (?pdb_id=5VPE&sort=mpo|delta_e|vina&limit=50)
 *   GET  /api/v1/atlas/:key    — Immutable R2 + Edge Cache bundle (~35 KB DFT + .cube.gz)
 *   POST /api/v1/dft           — Gatekeeper -> R2 -> Coalesce -> PubChem/QCArchive -> Modal (12s) -> HF Spaces
 *   POST /api/v1/dft/stream    — Gatekeeper -> R2 instant SSE or Modal/HF live SCF SSE stream
 *   POST /api/v1/dock          — Gatekeeper -> R2 -> Coalesce -> PubChem -> Modal (12s) -> HF Spaces (Vina 1.2)
 */

import {
  type Env,
  type GatekeeperFailure,
  type SmilesAnalysis,
  type ValidatedDftRequest,
  type ValidatedDockRequest,
  consumeNovelComputeToken,
  evaluateCors,
  isRecord,
  isTrustedGatewayCaller,
  readOptionalNumber,
  readOptionalString,
  sha256Hex,
  validateDftRequest,
  validateDockRequest,
  validateInchiKey,
  validatePdbId,
} from "./gatekeeper";
import {
  type FederationResult,
  type QCArchiveRecord,
  runOpenScienceFederation,
} from "./federation";

type SourceTier = "r2_cache" | "qcarchive" | "modal_gpu" | "hf_space_cpu";

interface AtlasEntryRow {
  readonly id: string;
  readonly inchikey: string;
  readonly smiles: string;
  readonly mol_name: string | null;
  readonly pdb_id: string;
  readonly method_basis: string;
  readonly hac: number;
  readonly mw: number;
  readonly cns_mpo: number | null;
  readonly homo_ev: number | null;
  readonly lumo_ev: number | null;
  readonly parr_omega_ev: number | null;
  readonly delta_e_cov_kcal: number | null;
  readonly vina_kcal: number | null;
  readonly pocket_vol_a3: number | null;
  readonly orcid_credit: string | null;
  readonly researcher_name: string | null;
  readonly r2_key: string;
  readonly bundle_url: string;
  readonly source_tier: string;
  readonly hit_count: number;
  readonly created_at: string;
}

interface ExtractedMetrics {
  readonly inchikey: string;
  readonly canonicalSmiles: string;
  readonly molName: string | null;
  readonly methodBasis: string;
  readonly hac: number;
  readonly mw: number;
  readonly cnsMpo: number | null;
  readonly homoEv: number | null;
  readonly lumoEv: number | null;
  readonly parrOmegaEv: number | null;
  readonly deltaECovKcal: number | null;
  readonly vinaKcal: number | null;
  readonly pocketVolA3: number | null;
}

interface ComputeSuccessOutcome {
  readonly ok: true;
  readonly status: 200;
  readonly sourceTier: SourceTier;
  readonly cacheStatus: "HIT-R2" | "MISS";
  readonly r2Key: string;
  readonly serializedBody: string;
  readonly persistToVault: boolean;
  readonly metrics: ExtractedMetrics | null;
  readonly pdbId: string;
  readonly orcidCredit: string | null;
  readonly researcherName: string | null;
}

interface ComputeErrorOutcome {
  readonly ok: false;
  readonly status: number;
  readonly body: Record<string, unknown>;
  readonly retryAfterSeconds?: number;
}

type ComputeOutcome = ComputeSuccessOutcome | ComputeErrorOutcome;

interface BackendCallSuccess {
  readonly ok: true;
  readonly sourceTier: "modal_gpu" | "hf_space_cpu";
  readonly data: Record<string, unknown>;
  readonly failoverUsed: boolean;
  readonly modalFailoverReason: string | null;
  readonly latencyMs: number;
}

interface BackendCallFailure {
  readonly ok: false;
  readonly scientificRefusal: boolean;
  readonly status: number;
  readonly data: Record<string, unknown>;
  readonly modalError: string | null;
  readonly hfError: string | null;
}

type BackendCallResult = BackendCallSuccess | BackendCallFailure;

// ============================================================================
// Single-Flight Coalescing Map (ONLY allowed module-global state; strictly
// cleaned via `finally { inFlightJobs.delete(flightKey); }`).
// ============================================================================

const inFlightJobs = new Map<string, Promise<ComputeOutcome>>();

// ============================================================================
// Epistemic [?] Error Bar Constants
// ============================================================================

const DFT_EPISTEMIC_BOUNDS: readonly string[] = [
  "[?] Kohn-Sham df-wB97X-D/def2-SVP + ddCOSMO (eps=78.4): Frontier orbital energies (HOMO/LUMO), condensed Fukui f_A^+, and Parr electrophilicity (omega) quantify intrinsic continuum reactivity trends—NOT transition-state activation barriers (Delta G_ddagger), enzymatic k_inact/K_I kinetics, explicit-water hydrogen-bonding, or pH 7.4 tautomer microstates.",
  "[?] Covalent thiol adduct Delta E_cov (CH3SH model) bounds intrinsic thermodynamic reactivity and off-target glutathione (GSH) risk, NOT active-site steric complementarity or kinetic rate constants.",
];

const DOCK_EPISTEMIC_BOUNDS: readonly string[] = [
  "[?] AutoDock Vina 1.2 empirical scoring carries ~+/- 2.2 kcal/mol RMSE against experimental Delta G_bind; valid for 3D pose generation and virtual enrichment ranking only—blind to explicit structural water entropy, metal polarization, and large receptor induced-fit.",
  "[?] Flat PPI targets with Hendlich LIGSITE cavity volume < 180 A^3 (e.g. apo DeltaFosB) cannot support reliable non-covalent docking and require validated covalent-handle targeting.",
];

const ATLAS_EPISTEMIC_BOUNDS: readonly string[] = [
  "[?] Open Quantum Neuro-Atlas records store provenance-tagged computational observables (df-wB97X-D/def2-SVP, MolSSI QCArchive, and AutoDock Vina 1.2 +/- 2.2 kcal/mol RMSE). Always inspect method_basis, source_tier, and experimental assay kinetics before medicinal chemistry decisions.",
];

// ============================================================================
// Utility Helpers
// ============================================================================

const SAFE_R2_KEY_RE = /^[A-Za-z0-9._\/-]{4,240}$/;

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function trimTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

function isValidHttpUrl(raw: string | undefined): raw is string {
  if (!raw) return false;
  const trimmed = raw.trim();
  if (!trimmed.startsWith("https://") && !trimmed.startsWith("http://")) {
    return false;
  }
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

function slugifyMethod(methodBasis: string): string {
  return methodBasis
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 72);
}

function buildR2Key(
  prefix: "dft" | "dock",
  inchikey: string,
  pdbId: string,
  methodBasis: string,
): string {
  return `${prefix}/${inchikey}/${pdbId}/${slugifyMethod(methodBasis)}.json`;
}

function buildEdgeCacheRequest(originUrl: string, r2Key: string): Request {
  const url = new URL(`/api/v1/atlas/${encodeURIComponent(r2Key)}`, originUrl);
  return new Request(url.toString(), { method: "GET" });
}

function jsonResponse(
  body: unknown,
  status: number,
  corsHeaders: Record<string, string>,
  extraHeaders?: Record<string, string>,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...corsHeaders,
      ...(extraHeaders ?? {}),
    },
  });
}

function gatekeeperErrorResponse(
  failure: GatekeeperFailure,
  corsHeaders: Record<string, string>,
  requestId: string,
): Response {
  return jsonResponse(
    {
      status: "rejected",
      error: failure.code,
      message: failure.message,
      ...(failure.details ? { details: failure.details } : {}),
      gatekeeper: "rprime-cns-edge-v1",
      request_id: requestId,
    },
    failure.status,
    corsHeaders,
    {
      "X-RPrime-Request-Id": requestId,
      "Cache-Control": "no-store",
    },
  );
}

function normalizeEpistemicNotes(
  upstreamNotes: unknown,
  mandatoryBounds: readonly string[],
): string[] {
  const merged: string[] = [];
  const seen = new Set<string>();

  if (Array.isArray(upstreamNotes)) {
    for (const item of upstreamNotes) {
      if (typeof item === "string") {
        const trimmed = item.trim();
        if (trimmed.length > 0 && !seen.has(trimmed)) {
          seen.add(trimmed);
          merged.push(trimmed);
        }
      }
    }
  }

  for (const note of mandatoryBounds) {
    if (!seen.has(note)) {
      seen.add(note);
      merged.push(note);
    }
  }
  return merged;
}

function normalizeAtlasRow(raw: unknown): AtlasEntryRow | null {
  if (!isRecord(raw)) return null;
  const id = readOptionalString(raw, ["id"]);
  const inchikey = readOptionalString(raw, ["inchikey"]);
  const smiles = readOptionalString(raw, ["smiles"]);
  const pdbId = readOptionalString(raw, ["pdb_id"]) ?? "NONE";
  const methodBasis = readOptionalString(raw, ["method_basis"]);
  const hac = readOptionalNumber(raw, ["hac"]);
  const mw = readOptionalNumber(raw, ["mw"]);
  const r2Key = readOptionalString(raw, ["r2_key"]);
  const sourceTier = readOptionalString(raw, ["source_tier"]) ?? "r2_cache";
  const hitCount = readOptionalNumber(raw, ["hit_count"]) ?? 1;
  const createdAt = readOptionalString(raw, ["created_at"]) ?? "";

  if (
    id === null ||
    inchikey === null ||
    smiles === null ||
    methodBasis === null ||
    hac === null ||
    mw === null ||
    r2Key === null
  ) {
    return null;
  }

  return {
    id,
    inchikey,
    smiles,
    mol_name: readOptionalString(raw, ["mol_name"]),
    pdb_id: pdbId,
    method_basis: methodBasis,
    hac: Math.trunc(hac),
    mw,
    cns_mpo: readOptionalNumber(raw, ["cns_mpo"]),
    homo_ev: readOptionalNumber(raw, ["homo_ev"]),
    lumo_ev: readOptionalNumber(raw, ["lumo_ev"]),
    parr_omega_ev: readOptionalNumber(raw, ["parr_omega_ev"]),
    delta_e_cov_kcal: readOptionalNumber(raw, ["delta_e_cov_kcal"]),
    vina_kcal: readOptionalNumber(raw, ["vina_kcal"]),
    pocket_vol_a3: readOptionalNumber(raw, ["pocket_vol_a3"]),
    orcid_credit: readOptionalString(raw, ["orcid_credit"]),
    researcher_name: readOptionalString(raw, ["researcher_name"]),
    r2_key: r2Key,
    bundle_url: `/api/v1/atlas/${encodeURIComponent(r2Key)}`,
    source_tier: sourceTier,
    hit_count: Math.trunc(hitCount),
    created_at: createdAt,
  };
}

function extractMetricsFromPayload(
  payload: Record<string, unknown>,
  analysis: SmilesAnalysis,
  fallbackInchiKey: string,
  fallbackMolName: string | null,
  fallbackMethodBasis: string,
): ExtractedMetrics {
  const covalentDetails = isRecord(payload.covalent_details) ? payload.covalent_details : {};
  const cavityDetails = isRecord(payload.cavity) ? payload.cavity : {};
  const dockingDetails = isRecord(payload.docking) ? payload.docking : {};

  const rawKey = readOptionalString(payload, ["inchikey", "InChIKey"]);
  const inchikey = (rawKey !== null ? validateInchiKey(rawKey) : null) ?? fallbackInchiKey;

  const canonicalSmiles =
    readOptionalString(payload, ["canonical_smiles", "smiles"]) ?? analysis.smiles;
  const molName = readOptionalString(payload, ["mol_name", "name"]) ?? fallbackMolName;
  const methodBasis =
    readOptionalString(payload, ["method_basis", "method"]) ?? fallbackMethodBasis;

  const hac = Math.min(38, Math.max(1, Math.trunc(readOptionalNumber(payload, ["hac"]) ?? analysis.hac)));
  const mw = Math.min(550.5, readOptionalNumber(payload, ["mw"]) ?? analysis.mw);
  const cnsMpo = readOptionalNumber(payload, ["cns_mpo"]) ?? analysis.cnsMpo;

  const homoEv = readOptionalNumber(payload, ["homo_ev"]);
  const lumoEv = readOptionalNumber(payload, ["lumo_ev"]);
  const parrOmegaEv = readOptionalNumber(payload, ["parr_omega_ev", "electrophilicity_ev"]);
  const deltaECovKcal =
    readOptionalNumber(payload, ["delta_e_cov_kcal"]) ??
    readOptionalNumber(covalentDetails, ["delta_e_cov_kcal", "delta_e_kcal"]);

  let vinaKcal =
    readOptionalNumber(payload, ["vina_kcal", "best_affinity_kcal", "affinity_kcal"]) ??
    readOptionalNumber(dockingDetails, ["vina_kcal", "best_affinity_kcal", "affinity_kcal"]);
  if (vinaKcal === null && Array.isArray(payload.poses) && payload.poses.length > 0) {
    const topPose: unknown = payload.poses[0];
    if (isRecord(topPose)) {
      vinaKcal = readOptionalNumber(topPose, ["affinity_kcal", "vina_kcal", "score_kcal"]);
    }
  }

  const pocketVolA3 =
    readOptionalNumber(payload, ["pocket_vol_a3", "cavity_volume_a3", "pocket_volume_a3"]) ??
    readOptionalNumber(cavityDetails, ["volume_a3", "pocket_vol_a3", "largest_pocket_a3"]);

  return {
    inchikey,
    canonicalSmiles,
    molName,
    methodBasis,
    hac,
    mw,
    cnsMpo,
    homoEv,
    lumoEv,
    parrOmegaEv,
    deltaECovKcal,
    vinaKcal,
    pocketVolA3,
  };
}

// ============================================================================
// R2 Vault + Edge Cache Lookup & Non-Blocking Persistence (`ctx.waitUntil`)
// ============================================================================

async function tryReadFromEdgeOrR2(
  env: Env,
  originUrl: string,
  r2Key: string,
): Promise<{ hit: true; body: string; tier: "HIT-EDGE" | "HIT-R2" } | { hit: false }> {
  // 1. Check Cloudflare Edge Cache API first (0 R2 ops)
  const edgeReq = buildEdgeCacheRequest(originUrl, r2Key);
  try {
    const edgeHit = await caches.default.match(edgeReq);
    if (edgeHit && edgeHit.ok) {
      const text = await edgeHit.text();
      return { hit: true, body: text, tier: "HIT-EDGE" };
    }
  } catch {
    // Proceed to R2 Vault
  }

  // 2. Check Cloudflare R2 Vault ($0.00 egress)
  try {
    const obj = await env.QUANTUM_VAULT.get(r2Key);
    if (obj !== null) {
      const text = await obj.text();
      return { hit: true, body: text, tier: "HIT-R2" };
    }
  } catch (err: unknown) {
    console.error(
      JSON.stringify({
        event: "r2_read_error",
        r2_key: r2Key,
        error: err instanceof Error ? err.message : String(err),
      }),
    );
  }

  return { hit: false };
}

async function lookupR2KeyBySmilesInD1(
  env: Env,
  smiles: string,
  pdbId: string,
  methodBasis: string,
): Promise<{ inchikey: string; r2Key: string } | null> {
  try {
    const row: unknown = await env.ATLAS_DB.prepare(
      `SELECT inchikey, r2_key FROM atlas_entries
       WHERE smiles = ?1 AND pdb_id = ?2 AND method_basis = ?3
       LIMIT 1`,
    )
      .bind(smiles, pdbId, methodBasis)
      .first();

    if (!isRecord(row)) return null;
    const inchikey = readOptionalString(row, ["inchikey"]);
    const r2Key = readOptionalString(row, ["r2_key"]);
    if (inchikey === null || r2Key === null) return null;
    return { inchikey, r2Key };
  } catch {
    return null;
  }
}

async function incrementHitCountInD1(env: Env, r2Key: string): Promise<void> {
  try {
    await env.ATLAS_DB.prepare(
      `UPDATE atlas_entries SET hit_count = hit_count + 1 WHERE r2_key = ?1`,
    )
      .bind(r2Key)
      .run();
  } catch (err: unknown) {
    console.error(
      JSON.stringify({
        event: "d1_hit_increment_error",
        r2_key: r2Key,
        error: err instanceof Error ? err.message : String(err),
      }),
    );
  }
}

async function persistBundleToR2AndD1(
  env: Env,
  originUrl: string,
  r2Key: string,
  serializedBody: string,
  metrics: ExtractedMetrics,
  pdbId: string,
  sourceTier: SourceTier,
  orcidCredit: string | null,
  researcherName: string | null,
): Promise<void> {
  // 1. Store immutable bundle in Cloudflare R2 Vault
  try {
    await env.QUANTUM_VAULT.put(r2Key, serializedBody, {
      httpMetadata: {
        contentType: "application/json; charset=utf-8",
        cacheControl: "public, max-age=31536000, immutable",
      },
      customMetadata: {
        inchikey: metrics.inchikey,
        pdb_id: pdbId,
        method_basis: metrics.methodBasis,
        source_tier: sourceTier,
      },
    });
  } catch (err: unknown) {
    console.error(
      JSON.stringify({
        event: "r2_persist_error",
        r2_key: r2Key,
        error: err instanceof Error ? err.message : String(err),
      }),
    );
  }

  // 2. Warm Cloudflare Edge Cache for GET /api/v1/atlas/:key
  try {
    const edgeReq = buildEdgeCacheRequest(originUrl, r2Key);
    await caches.default.put(
      edgeReq,
      new Response(serializedBody, {
        status: 200,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "public, max-age=31536000, immutable",
          "X-RPrime-Source-Tier": sourceTier,
        },
      }),
    );
  } catch {
    // Non-fatal edge cache warm failure
  }

  // 3. Upsert metadata index in D1 Open Quantum Neuro-Atlas
  try {
    const rowId = crypto.randomUUID();
    await env.ATLAS_DB.prepare(
      `INSERT INTO atlas_entries (
        id, inchikey, smiles, mol_name, pdb_id, method_basis,
        hac, mw, cns_mpo, homo_ev, lumo_ev, parr_omega_ev,
        delta_e_cov_kcal, vina_kcal, pocket_vol_a3,
        orcid_credit, researcher_name, r2_key, source_tier, hit_count
      ) VALUES (
        ?1, ?2, ?3, ?4, ?5, ?6,
        ?7, ?8, ?9, ?10, ?11, ?12,
        ?13, ?14, ?15,
        ?16, ?17, ?18, ?19, 1
      )
      ON CONFLICT(inchikey, pdb_id, method_basis) DO UPDATE SET
        mol_name = COALESCE(atlas_entries.mol_name, excluded.mol_name),
        cns_mpo = COALESCE(excluded.cns_mpo, atlas_entries.cns_mpo),
        homo_ev = COALESCE(excluded.homo_ev, atlas_entries.homo_ev),
        lumo_ev = COALESCE(excluded.lumo_ev, atlas_entries.lumo_ev),
        parr_omega_ev = COALESCE(excluded.parr_omega_ev, atlas_entries.parr_omega_ev),
        delta_e_cov_kcal = COALESCE(excluded.delta_e_cov_kcal, atlas_entries.delta_e_cov_kcal),
        vina_kcal = COALESCE(excluded.vina_kcal, atlas_entries.vina_kcal),
        pocket_vol_a3 = COALESCE(excluded.pocket_vol_a3, atlas_entries.pocket_vol_a3),
        orcid_credit = COALESCE(atlas_entries.orcid_credit, excluded.orcid_credit),
        researcher_name = COALESCE(atlas_entries.researcher_name, excluded.researcher_name),
        r2_key = excluded.r2_key,
        source_tier = excluded.source_tier,
        hit_count = atlas_entries.hit_count + 1`,
    )
      .bind(
        rowId,
        metrics.inchikey,
        metrics.canonicalSmiles,
        metrics.molName,
        pdbId,
        metrics.methodBasis,
        metrics.hac,
        metrics.mw,
        metrics.cnsMpo,
        metrics.homoEv,
        metrics.lumoEv,
        metrics.parrOmegaEv,
        metrics.deltaECovKcal,
        metrics.vinaKcal,
        metrics.pocketVolA3,
        orcidCredit,
        researcherName,
        r2Key,
        sourceTier,
      )
      .run();
  } catch (err: unknown) {
    console.error(
      JSON.stringify({
        event: "d1_upsert_error",
        inchikey: metrics.inchikey,
        pdb_id: pdbId,
        error: err instanceof Error ? err.message : String(err),
      }),
    );
  }
}

// ============================================================================
// Primary Modal GPU Turbo (12s Timeout) -> Automatic Failover to HF Spaces
// ============================================================================

async function callSingleUpstream(
  baseUrl: string,
  endpointPath: string,
  payload: Record<string, unknown>,
  sharedSecret: string | undefined,
  timeoutMs: number,
  requestId: string,
): Promise<
  | { ok: true; data: Record<string, unknown>; latencyMs: number }
  | { ok: false; scientificRefusal: boolean; status: number; data: Record<string, unknown>; reason: string }
> {
  const t0 = performance.now();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    "X-Request-Id": requestId,
  };
  if (sharedSecret && sharedSecret.trim().length > 0) {
    headers["X-RPrime-Gateway-Key"] = sharedSecret.trim();
  }

  try {
    const response = await fetch(`${trimTrailingSlash(baseUrl)}${endpointPath}`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const latencyMs = Math.round(performance.now() - t0);

    let parsedBody: Record<string, unknown> = {};
    try {
      const raw: unknown = await response.json();
      if (isRecord(raw)) {
        parsedBody = raw;
      }
    } catch {
      parsedBody = { message: `Upstream returned HTTP ${response.status} without JSON body.` };
    }

    if (response.ok) {
      return { ok: true, data: parsedBody, latencyMs };
    }

    // 400 / 422 are intentional scientific rejections (e.g., LIGSITE cavity < 180 A^3
    // refusing blind non-covalent docking on apo DeltaFosB, or RDKit sanitization failure).
    // Propagate them directly rather than masking them as backend outages.
    if (response.status === 400 || response.status === 422) {
      return {
        ok: false,
        scientificRefusal: true,
        status: response.status,
        data: parsedBody,
        reason: `scientific_refusal_${response.status}`,
      };
    }

    return {
      ok: false,
      scientificRefusal: false,
      status: response.status,
      data: parsedBody,
      reason: `http_${response.status}`,
    };
  } catch (err: unknown) {
    const isTimeout =
      err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
    return {
      ok: false,
      scientificRefusal: false,
      status: isTimeout ? 504 : 502,
      data: {
        error: isTimeout ? "UPSTREAM_TIMEOUT" : "UPSTREAM_NETWORK_ERROR",
        message: isTimeout
          ? `Upstream compute exceeded ${timeoutMs} ms timeout.`
          : "Upstream compute endpoint unreachable.",
      },
      reason: isTimeout ? `timeout_${timeoutMs}ms` : "network_error",
    };
  }
}

async function invokeComputeWithFailover(
  env: Env,
  endpointPath: "/api/v1/dft" | "/api/v1/dock",
  payload: Record<string, unknown>,
  requestId: string,
): Promise<BackendCallResult> {
  const modalUrl = isValidHttpUrl(env.MODAL_URL) ? env.MODAL_URL.trim() : null;
  const hfUrl = isValidHttpUrl(env.HF_SPACE_URL) ? env.HF_SPACE_URL.trim() : null;
  const modalTimeoutMs = parsePositiveInt(env.MODAL_TIMEOUT_MS, 12_000);
  const hfTimeoutMs = parsePositiveInt(env.HF_TIMEOUT_MS, 55_000);

  let modalError: string | null = null;

  // Tier 1: Primary Modal GPU Turbo (12s strict timeout)
  if (modalUrl !== null) {
    const modalAttempt = await callSingleUpstream(
      modalUrl,
      endpointPath,
      payload,
      env.GATEWAY_SHARED_SECRET,
      modalTimeoutMs,
      requestId,
    );
    if (modalAttempt.ok) {
      return {
        ok: true,
        sourceTier: "modal_gpu",
        data: modalAttempt.data,
        failoverUsed: false,
        modalFailoverReason: null,
        latencyMs: modalAttempt.latencyMs,
      };
    }
    if (modalAttempt.scientificRefusal) {
      return {
        ok: false,
        scientificRefusal: true,
        status: modalAttempt.status,
        data: modalAttempt.data,
        modalError: modalAttempt.reason,
        hfError: null,
      };
    }
    modalError = modalAttempt.reason;
  }

  // Tier 2: Automatic Seamless Failover to 24/7 Hugging Face Spaces Free Docker
  if (hfUrl !== null) {
    const hfAttempt = await callSingleUpstream(
      hfUrl,
      endpointPath,
      payload,
      env.GATEWAY_SHARED_SECRET,
      hfTimeoutMs,
      requestId,
    );
    if (hfAttempt.ok) {
      return {
        ok: true,
        sourceTier: "hf_space_cpu",
        data: hfAttempt.data,
        failoverUsed: modalUrl !== null,
        modalFailoverReason: modalError,
        latencyMs: hfAttempt.latencyMs,
      };
    }
    return {
      ok: false,
      scientificRefusal: hfAttempt.scientificRefusal,
      status: hfAttempt.status,
      data: hfAttempt.data,
      modalError,
      hfError: hfAttempt.reason,
    };
  }

  return {
    ok: false,
    scientificRefusal: false,
    status: 503,
    data: {
      error: "NO_COMPUTE_BACKEND_CONFIGURED",
      message:
        "No live compute backend configured. Set HF_SPACE_URL (and optional MODAL_URL) via `wrangler secret put`.",
    },
    modalError,
    hfError: "hf_space_url_not_configured",
  };
}

// ============================================================================
// Federated QCArchive Payload Builder
// ============================================================================

function buildQCArchiveResponsePayload(
  req: ValidatedDftRequest,
  inchikey: string,
  r2Key: string,
  federation: FederationResult,
  qcRecord: QCArchiveRecord,
): Record<string, unknown> {
  return {
    status: "ok",
    mol_name: req.molName ?? federation.pubchem.title ?? req.analysis.formula,
    inchikey,
    smiles: req.smiles,
    canonical_smiles: federation.pubchem.canonicalSmiles ?? req.smiles,
    formula: federation.pubchem.molecularFormula ?? req.analysis.formula,
    pdb_id: req.pdbId,
    method_basis: qcRecord.methodBasis,
    hac: req.analysis.hac,
    mw: federation.pubchem.molecularWeight ?? req.analysis.mw,
    cns_mpo: req.analysis.cnsMpo,
    tpsa: req.analysis.tpsa,
    clogp: req.analysis.clogp,
    total_energy_ha: qcRecord.scfEnergyHa,
    homo_ev: qcRecord.homoEv,
    lumo_ev: qcRecord.lumoEv,
    parr_omega_ev: qcRecord.parrOmegaEv,
    dipole_debye: qcRecord.dipoleDebye,
    delta_e_cov_kcal: null,
    homo_cube_gz_b64: null,
    lumo_cube_gz_b64: null,
    source_tier: "qcarchive",
    r2_key: r2Key,
    bundle_url: `/api/v1/atlas/${encodeURIComponent(r2Key)}`,
    federation: {
      pubchem_cid: federation.pubchem.cid,
      pubchem_status: federation.pubchem.status,
      qcarchive_status: "hit",
      qcarchive_record_id: qcRecord.recordId,
      qcarchive_dataset: qcRecord.datasetHint,
      qcarchive_program: qcRecord.program,
    },
    attribution: {
      orcid_credit: req.orcidCredit,
      researcher_name: req.researcherName,
    },
    epistemic_notes: normalizeEpistemicNotes(
      [
        `[?] Federated pre-solved Kohn-Sham DFT record retrieved from MolSSI QCArchive (${qcRecord.datasetHint}, record #${qcRecord.recordId}). Gas-phase or dataset-native solvent model applies; volumetric .cube grids require live PySCF execution.`,
      ],
      DFT_EPISTEMIC_BOUNDS,
    ),
  };
}

// ============================================================================
// Route Handlers
// ============================================================================

function handleHealth(env: Env, corsHeaders: Record<string, string>, requestId: string): Response {
  return jsonResponse(
    {
      status: "ok",
      service: "rprime-quantum-gateway",
      compatibility_date: "2026-11-24",
      default_method: env.DEFAULT_METHOD || "df-wB97X-D/def2-SVP+ddCOSMO",
      bindings: {
        r2_vault: Boolean(env.QUANTUM_VAULT),
        d1_atlas: Boolean(env.ATLAS_DB),
        modal_gpu_configured: isValidHttpUrl(env.MODAL_URL),
        hf_space_configured: isValidHttpUrl(env.HF_SPACE_URL),
        shared_secret_configured: Boolean(env.GATEWAY_SHARED_SECRET?.trim()),
      },
      in_flight_coalesced_jobs: inFlightJobs.size,
      epistemic_policy: "strict_error_bars_enforced",
      timestamp: new Date().toISOString(),
    },
    200,
    corsHeaders,
    {
      "Cache-Control": "no-store",
      "X-RPrime-Request-Id": requestId,
    },
  );
}

async function handleAtlasLeaderboard(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  corsHeaders: Record<string, string>,
  requestId: string,
): Promise<Response> {
  const url = new URL(request.url);
  const rawPdb = url.searchParams.get("pdb_id")?.trim() ?? "";
  const rawSort = (url.searchParams.get("sort")?.trim().toLowerCase() ?? "mpo");
  const rawLimit = Number.parseInt(url.searchParams.get("limit") ?? "50", 10);
  const rawOffset = Number.parseInt(url.searchParams.get("offset") ?? "0", 10);
  const rawInchiKey = url.searchParams.get("inchikey")?.trim() ?? "";

  let pdbFilter: string | null = null;
  if (rawPdb.length > 0 && rawPdb.toUpperCase() !== "ALL") {
    if (rawPdb.toUpperCase() === "NONE") {
      pdbFilter = "NONE";
    } else {
      const validPdb = validatePdbId(rawPdb);
      if (validPdb === null) {
        return jsonResponse(
          {
            status: "error",
            error: "INVALID_PDB_ID",
            message: "Query param 'pdb_id' must be a 4-character PDB ID (e.g. 5VPE), 'NONE', or 'ALL'.",
          },
          400,
          corsHeaders,
          { "X-RPrime-Request-Id": requestId },
        );
      }
      pdbFilter = validPdb;
    }
  }

  let inchikeyFilter: string | null = null;
  if (rawInchiKey.length > 0) {
    const validKey = validateInchiKey(rawInchiKey);
    if (validKey === null) {
      return jsonResponse(
        {
          status: "error",
          error: "INVALID_INCHIKEY",
          message: "Query param 'inchikey' must match 27-char IUPAC InChIKey format.",
        },
        400,
        corsHeaders,
        { "X-RPrime-Request-Id": requestId },
      );
    }
    inchikeyFilter = validKey;
  }

  const limit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(100, rawLimit)) : 50;
  const offset = Number.isFinite(rawOffset) ? Math.max(0, Math.min(1000, rawOffset)) : 0;

  // Strictly whitelisted static ORDER BY clauses (zero SQL injection surface)
  let orderBySql: string;
  let canonicalSort: string;
  switch (rawSort) {
    case "delta_e":
    case "delta_e_cov":
      canonicalSort = "delta_e";
      orderBySql =
        "CASE WHEN delta_e_cov_kcal IS NULL THEN 1 ELSE 0 END ASC, delta_e_cov_kcal ASC, cns_mpo DESC";
      break;
    case "vina":
      canonicalSort = "vina";
      orderBySql =
        "CASE WHEN vina_kcal IS NULL THEN 1 ELSE 0 END ASC, vina_kcal ASC, cns_mpo DESC";
      break;
    case "omega":
      canonicalSort = "omega";
      orderBySql =
        "CASE WHEN parr_omega_ev IS NULL THEN 1 ELSE 0 END ASC, parr_omega_ev DESC, cns_mpo DESC";
      break;
    case "hits":
      canonicalSort = "hits";
      orderBySql = "hit_count DESC, cns_mpo DESC";
      break;
    case "recent":
      canonicalSort = "recent";
      orderBySql = "created_at DESC";
      break;
    case "mpo":
    default:
      canonicalSort = "mpo";
      orderBySql =
        "CASE WHEN cns_mpo IS NULL THEN 1 ELSE 0 END ASC, cns_mpo DESC, delta_e_cov_kcal ASC, vina_kcal ASC";
      break;
  }

  // Edge-cache normalized leaderboard queries for 30s (0 D1 reads during viral bursts)
  const normalizedCacheUrl = new URL("/api/v1/atlas", url.origin);
  normalizedCacheUrl.searchParams.set("pdb_id", pdbFilter ?? "ALL");
  normalizedCacheUrl.searchParams.set("sort", canonicalSort);
  normalizedCacheUrl.searchParams.set("limit", String(limit));
  normalizedCacheUrl.searchParams.set("offset", String(offset));
  if (inchikeyFilter !== null) {
    normalizedCacheUrl.searchParams.set("inchikey", inchikeyFilter);
  }
  const cacheReq = new Request(normalizedCacheUrl.toString(), { method: "GET" });

  try {
    const cached = await caches.default.match(cacheReq);
    if (cached) {
      const bodyText = await cached.text();
      return new Response(bodyText, {
        status: 200,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "public, max-age=30, s-maxage=60, stale-while-revalidate=300",
          "X-RPrime-Cache": "HIT-EDGE",
          "X-RPrime-Request-Id": requestId,
          ...corsHeaders,
        },
      });
    }
  } catch {
    // Fall through to D1
  }

  const conditions: string[] = [];
  const params: Array<string | number> = [];

  if (pdbFilter !== null) {
    params.push(pdbFilter);
    conditions.push(`pdb_id = ?${params.length}`);
  }
  if (inchikeyFilter !== null) {
    params.push(inchikeyFilter);
    conditions.push(`inchikey = ?${params.length}`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  params.push(limit);
  const limitParamIdx = params.length;
  params.push(offset);
  const offsetParamIdx = params.length;

  const sql = `
    SELECT
      id, inchikey, smiles, mol_name, pdb_id, method_basis,
      hac, mw, cns_mpo, homo_ev, lumo_ev, parr_omega_ev,
      delta_e_cov_kcal, vina_kcal, pocket_vol_a3,
      orcid_credit, researcher_name, r2_key, source_tier, hit_count, created_at
    FROM atlas_entries
    ${whereClause}
    ORDER BY ${orderBySql}
    LIMIT ?${limitParamIdx} OFFSET ?${offsetParamIdx}
  `;

  try {
    const result = await env.ATLAS_DB.prepare(sql)
      .bind(...params)
      .all();

    const entries: AtlasEntryRow[] = [];
    for (const row of result.results) {
      const normalized = normalizeAtlasRow(row);
      if (normalized !== null) {
        entries.push(normalized);
      }
    }

    const payload = {
      status: "ok",
      pdb_id: pdbFilter ?? "ALL",
      sort: canonicalSort,
      limit,
      offset,
      count: entries.length,
      entries,
      epistemic_notes: ATLAS_EPISTEMIC_BOUNDS,
    };

    const serialized = JSON.stringify(payload);
    ctx.waitUntil(
      caches.default
        .put(
          cacheReq,
          new Response(serialized, {
            status: 200,
            headers: {
              "Content-Type": "application/json; charset=utf-8",
              "Cache-Control": "public, max-age=30, s-maxage=60, stale-while-revalidate=300",
            },
          }),
        )
        .catch(() => undefined),
    );

    return new Response(serialized, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "public, max-age=30, s-maxage=60, stale-while-revalidate=300",
        "X-RPrime-Cache": "MISS-D1",
        "X-RPrime-Request-Id": requestId,
        ...corsHeaders,
      },
    });
  } catch (err: unknown) {
    console.error(
      JSON.stringify({
        event: "d1_leaderboard_query_error",
        error: err instanceof Error ? err.message : String(err),
      }),
    );
    return jsonResponse(
      {
        status: "error",
        error: "ATLAS_DB_UNAVAILABLE",
        message: "Unable to query Open Quantum Neuro-Atlas D1 index.",
      },
      503,
      corsHeaders,
      { "X-RPrime-Request-Id": requestId },
    );
  }
}

async function handleAtlasBundleGet(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  rawEncodedKey: string,
  corsHeaders: Record<string, string>,
  requestId: string,
): Promise<Response> {
  let r2Key: string;
  try {
    r2Key = decodeURIComponent(rawEncodedKey).trim();
  } catch {
    return jsonResponse(
      { status: "error", error: "INVALID_ATLAS_KEY", message: "Malformed URL encoding in atlas key." },
      400,
      corsHeaders,
      { "X-RPrime-Request-Id": requestId },
    );
  }

  if (
    !SAFE_R2_KEY_RE.test(r2Key) ||
    r2Key.includes("..") ||
    r2Key.startsWith("/") ||
    r2Key.includes("//")
  ) {
    return jsonResponse(
      { status: "error", error: "INVALID_ATLAS_KEY", message: "Invalid Atlas R2 bundle key." },
      400,
      corsHeaders,
      { "X-RPrime-Request-Id": requestId },
    );
  }

  const edgeReq = buildEdgeCacheRequest(request.url, r2Key);

  // 1. Cloudflare Edge Cache API hit — zero R2 operations, zero compute
  try {
    const edgeHit = await caches.default.match(edgeReq);
    if (edgeHit) {
      const etag = edgeHit.headers.get("ETag");
      const ifNoneMatch = request.headers.get("If-None-Match");
      if (etag !== null && ifNoneMatch !== null && ifNoneMatch === etag) {
        return new Response(null, {
          status: 304,
          headers: {
            ETag: etag,
            "Cache-Control": "public, max-age=31536000, immutable",
            "X-RPrime-Cache": "HIT-EDGE",
            "X-RPrime-Request-Id": requestId,
            ...corsHeaders,
          },
        });
      }

      const headers = new Headers(edgeHit.headers);
      for (const [k, v] of Object.entries(corsHeaders)) {
        headers.set(k, v);
      }
      headers.set("Cache-Control", "public, max-age=31536000, immutable");
      headers.set("X-RPrime-Cache", "HIT-EDGE");
      headers.set("X-RPrime-Request-Id", requestId);
      return new Response(edgeHit.body, { status: 200, headers });
    }
  } catch {
    // Fall through to R2
  }

  // 2. Direct Cloudflare R2 Vault fetch ($0.00 egress)
  const obj = await env.QUANTUM_VAULT.get(r2Key);
  if (obj === null) {
    return jsonResponse(
      {
        status: "not_found",
        error: "ATLAS_ENTRY_NOT_FOUND",
        message: `No immutable quantum bundle found in R2 Vault for key '${r2Key}'.`,
      },
      404,
      corsHeaders,
      {
        "Cache-Control": "no-store",
        "X-RPrime-Request-Id": requestId,
      },
    );
  }

  const etag = obj.httpEtag;
  const ifNoneMatch = request.headers.get("If-None-Match");
  if (ifNoneMatch !== null && ifNoneMatch === etag) {
    return new Response(null, {
      status: 304,
      headers: {
        ETag: etag,
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-RPrime-Cache": "HIT-R2",
        "X-RPrime-Request-Id": requestId,
        ...corsHeaders,
      },
    });
  }

  const bodyBytes = await obj.arrayBuffer();
  const contentType = obj.httpMetadata?.contentType ?? "application/json; charset=utf-8";
  const sourceTier = obj.customMetadata?.source_tier ?? "r2_cache";

  // Warm Edge Cache and increment D1 hit count off the critical path
  ctx.waitUntil(
    Promise.all([
      caches.default
        .put(
          edgeReq,
          new Response(bodyBytes, {
            status: 200,
            headers: {
              "Content-Type": contentType,
              ETag: etag,
              "Cache-Control": "public, max-age=31536000, immutable",
              "X-RPrime-Source-Tier": sourceTier,
            },
          }),
        )
        .catch(() => undefined),
      incrementHitCountInD1(env, r2Key),
    ]),
  );

  return new Response(bodyBytes, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      ETag: etag,
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-RPrime-Cache": "HIT-R2",
      "X-RPrime-Source-Tier": sourceTier,
      "X-RPrime-Request-Id": requestId,
      ...corsHeaders,
    },
  });
}

async function handleDftSubmit(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  corsHeaders: Record<string, string>,
  requestId: string,
): Promise<Response> {
  // 1. < 2 ms Anti-Slop Scientific Gatekeeper
  const validated = await validateDftRequest(request, env);
  if (!validated.ok) {
    return gatekeeperErrorResponse(validated, corsHeaders, requestId);
  }

  const trustedCaller = await isTrustedGatewayCaller(request, env);
  const bypassCache = validated.forceRecompute && trustedCaller;
  const originUrl = new URL(request.url).origin;

  // 2. Instant Edge Cache / R2 Vault Check (100% UNLIMITED — NO RATE LIMIT!)
  if (!bypassCache) {
    let candidateR2Key: string | null =
      validated.inchikey !== null
        ? buildR2Key("dft", validated.inchikey, validated.pdbId, validated.methodBasis)
        : null;

    if (candidateR2Key === null) {
      const d1Match = await lookupR2KeyBySmilesInD1(
        env,
        validated.smiles,
        validated.pdbId,
        validated.methodBasis,
      );
      if (d1Match !== null) {
        candidateR2Key = d1Match.r2Key;
      }
    }

    if (candidateR2Key !== null) {
      const cached = await tryReadFromEdgeOrR2(env, originUrl, candidateR2Key);
      if (cached.hit) {
        ctx.waitUntil(incrementHitCountInD1(env, candidateR2Key));
        return new Response(cached.body, {
          status: 200,
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Cache-Control": "public, max-age=31536000, immutable",
            "X-RPrime-Cache": cached.tier,
            "X-RPrime-Source-Tier": "r2_cache",
            "X-RPrime-Request-Id": requestId,
            ...corsHeaders,
          },
        });
      }
    }
  }

  // 3. Per-IP Token-Bucket Rate Limiter (ONLY for novel uncached compute submits!)
  let rateLimitHeaders: Record<string, string> = {};
  if (!trustedCaller) {
    const rl = await consumeNovelComputeToken(request, env, validated.analysis.cnsMpo);
    rateLimitHeaders = {
      "X-RateLimit-Limit": String(rl.limit),
      "X-RateLimit-Remaining": String(rl.remaining),
    };
    if (!rl.allowed) {
      return jsonResponse(
        {
          status: "rate_limited",
          error: "NOVEL_COMPUTE_RATE_LIMITED",
          message:
            "Per-IP novel DFT compute token bucket exhausted. All cached Open Quantum Neuro-Atlas & R2 reads remain 100% unlimited.",
          retry_after_seconds: rl.retryAfterSeconds,
          priority_tier: rl.priorityTier,
          cns_mpo: validated.analysis.cnsMpo,
          request_id: requestId,
        },
        429,
        corsHeaders,
        {
          ...rateLimitHeaders,
          "Retry-After": String(rl.retryAfterSeconds),
          "X-RPrime-Request-Id": requestId,
          "Cache-Control": "no-store",
        },
      );
    }
  }

  // 4. Single-Flight Coalescing (deduplicates concurrent novel submits cleanly)
  const smilesHash = await sha256Hex(validated.smiles);
  const flightKey = `dft:${validated.inchikey ?? smilesHash}:${validated.pdbId}:${slugifyMethod(validated.methodBasis)}:cov=${validated.covalentAdduct ? 1 : 0}:cube=${validated.includeCubes ? 1 : 0}`;

  let coalesced = false;
  let jobPromise = inFlightJobs.get(flightKey);
  if (jobPromise) {
    coalesced = true;
  } else {
    jobPromise = executeDftPipeline(
      env,
      originUrl,
      validated,
      smilesHash,
      bypassCache,
      requestId,
    ).finally(() => {
      inFlightJobs.delete(flightKey);
    });
    inFlightJobs.set(flightKey, jobPromise);
  }

  const outcome = await jobPromise;
  if (!outcome.ok) {
    const extra: Record<string, string> = {
      ...rateLimitHeaders,
      "X-RPrime-Coalesced": coalesced ? "1" : "0",
      "X-RPrime-Request-Id": requestId,
      "Cache-Control": "no-store",
    };
    if (outcome.retryAfterSeconds !== undefined) {
      extra["Retry-After"] = String(outcome.retryAfterSeconds);
    }
    return jsonResponse(outcome.body, outcome.status, corsHeaders, extra);
  }

  // Persist novel results asynchronously via `ctx.waitUntil(...)` (only by the leader)
  if (!coalesced && outcome.persistToVault && outcome.metrics !== null) {
    ctx.waitUntil(
      persistBundleToR2AndD1(
        env,
        originUrl,
        outcome.r2Key,
        outcome.serializedBody,
        outcome.metrics,
        outcome.pdbId,
        outcome.sourceTier,
        outcome.orcidCredit,
        outcome.researcherName,
      ),
    );
  } else if (!coalesced && outcome.cacheStatus === "HIT-R2") {
    ctx.waitUntil(incrementHitCountInD1(env, outcome.r2Key));
  }

  return new Response(outcome.serializedBody, {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control":
        outcome.persistToVault || outcome.cacheStatus === "HIT-R2"
          ? "public, max-age=31536000, immutable"
          : "no-store",
      "X-RPrime-Cache": outcome.cacheStatus,
      "X-RPrime-Source-Tier": outcome.sourceTier,
      "X-RPrime-Coalesced": coalesced ? "1" : "0",
      "X-RPrime-Request-Id": requestId,
      ...rateLimitHeaders,
      ...corsHeaders,
    },
  });
}

async function executeDftPipeline(
  env: Env,
  originUrl: string,
  req: ValidatedDftRequest,
  smilesHash: string,
  bypassCache: boolean,
  requestId: string,
): Promise<ComputeOutcome> {
  const federationTimeoutMs = parsePositiveInt(env.FEDERATION_TIMEOUT_MS, 2500);

  // 1. Live Open-Science Federation: PubChem PUG-REST -> InChIKey + MolSSI QCArchive (2500 ms cap)
  const federation = await runOpenScienceFederation(
    req.smiles,
    req.inchikey,
    req.preferFederated,
    federationTimeoutMs,
  );
  const resolvedInchiKey = req.inchikey ?? federation.pubchem.inchikey;

  // 2. Re-check R2 Vault if PubChem resolved a canonical InChIKey we did not have earlier
  if (!bypassCache && resolvedInchiKey !== null && req.inchikey === null) {
    const resolvedR2Key = buildR2Key("dft", resolvedInchiKey, req.pdbId, req.methodBasis);
    const r2Hit = await tryReadFromEdgeOrR2(env, originUrl, resolvedR2Key);
    if (r2Hit.hit) {
      return {
        ok: true,
        status: 200,
        sourceTier: "r2_cache",
        cacheStatus: "HIT-R2",
        r2Key: resolvedR2Key,
        serializedBody: r2Hit.body,
        persistToVault: false,
        metrics: null,
        pdbId: req.pdbId,
        orcidCredit: req.orcidCredit,
        researcherName: req.researcherName,
      };
    }
  }

  // 3. Fast-path MolSSI QCArchive hit when volumetric .cube.gz / CH3SH covalent adduct are not required
  const qcRecord = federation.qcarchive?.record ?? null;
  if (
    qcRecord !== null &&
    resolvedInchiKey !== null &&
    req.preferFederated &&
    !req.includeCubes &&
    !req.covalentAdduct &&
    qcRecord.scfEnergyHa !== null
  ) {
    const qcR2Key = buildR2Key("dft", resolvedInchiKey, req.pdbId, qcRecord.methodBasis);
    const qcPayload = buildQCArchiveResponsePayload(
      req,
      resolvedInchiKey,
      qcR2Key,
      federation,
      qcRecord,
    );
    const metrics = extractMetricsFromPayload(
      qcPayload,
      req.analysis,
      resolvedInchiKey,
      req.molName ?? federation.pubchem.title,
      qcRecord.methodBasis,
    );
    return {
      ok: true,
      status: 200,
      sourceTier: "qcarchive",
      cacheStatus: "MISS",
      r2Key: qcR2Key,
      serializedBody: JSON.stringify(qcPayload),
      persistToVault: true,
      metrics,
      pdbId: req.pdbId,
      orcidCredit: req.orcidCredit,
      researcherName: req.researcherName,
    };
  }

  // 4. Primary Modal GPU Turbo (12s timeout) -> Automatic Failover to 24/7 HF Spaces Free Docker
  const upstreamPayload: Record<string, unknown> = {
    smiles: req.smiles,
    mol_name: req.molName ?? federation.pubchem.title ?? req.analysis.formula,
    pdb_id: req.pdbId,
    method_basis: req.methodBasis,
    compute_covalent_delta_e: req.covalentAdduct,
    covalent_adduct: req.covalentAdduct,
    include_cubes: req.includeCubes,
    cube_grid_spacing: req.cubeGridSpacing,
  };
  if (resolvedInchiKey !== null) upstreamPayload.inchikey = resolvedInchiKey;
  if (req.orcidCredit !== null) upstreamPayload.orcid_credit = req.orcidCredit;
  if (req.researcherName !== null) upstreamPayload.researcher_name = req.researcherName;

  const backend = await invokeComputeWithFailover(env, "/api/v1/dft", upstreamPayload, requestId);
  if (!backend.ok) {
    // Graceful degradation: if compute backends are offline but QCArchive had a verified DFT record, serve it!
    if (!backend.scientificRefusal && qcRecord !== null && resolvedInchiKey !== null) {
      const qcR2Key = buildR2Key("dft", resolvedInchiKey, req.pdbId, qcRecord.methodBasis);
      const qcPayload = buildQCArchiveResponsePayload(
        req,
        resolvedInchiKey,
        qcR2Key,
        federation,
        qcRecord,
      );
      const metrics = extractMetricsFromPayload(
        qcPayload,
        req.analysis,
        resolvedInchiKey,
        req.molName ?? federation.pubchem.title,
        qcRecord.methodBasis,
      );
      return {
        ok: true,
        status: 200,
        sourceTier: "qcarchive",
        cacheStatus: "MISS",
        r2Key: qcR2Key,
        serializedBody: JSON.stringify(qcPayload),
        persistToVault: true,
        metrics,
        pdbId: req.pdbId,
        orcidCredit: req.orcidCredit,
        researcherName: req.researcherName,
      };
    }

    return {
      ok: false,
      status: backend.status,
      retryAfterSeconds: backend.scientificRefusal ? undefined : 30,
      body: {
        status: backend.scientificRefusal ? "rejected" : "error",
        ...backend.data,
        failover_telemetry: {
          modal_error: backend.modalError,
          hf_error: backend.hfError,
        },
        epistemic_notes: DFT_EPISTEMIC_BOUNDS,
        request_id: requestId,
      },
    };
  }

  // 5. Merge authoritative upstream DFT output with gateway provenance, R2 key & [?] bounds
  const fallbackKey = resolvedInchiKey ?? `SHA256-${smilesHash.slice(0, 20).toUpperCase()}`;
  const metrics = extractMetricsFromPayload(
    backend.data,
    req.analysis,
    fallbackKey,
    req.molName ?? federation.pubchem.title,
    req.methodBasis,
  );
  const finalR2Key = buildR2Key("dft", metrics.inchikey, req.pdbId, metrics.methodBasis);

  const enrichedPayload: Record<string, unknown> = {
    ...backend.data,
    status: "ok",
    inchikey: metrics.inchikey,
    pdb_id: req.pdbId,
    method_basis: metrics.methodBasis,
    hac: metrics.hac,
    mw: metrics.mw,
    cns_mpo: metrics.cnsMpo,
    r2_key: finalR2Key,
    bundle_url: `/api/v1/atlas/${encodeURIComponent(finalR2Key)}`,
    source_tier: backend.sourceTier,
    gateway: {
      request_id: requestId,
      source_tier: backend.sourceTier,
      failover_used: backend.failoverUsed,
      modal_failover_reason: backend.modalFailoverReason,
      upstream_latency_ms: backend.latencyMs,
      gatekeeper_ms: req.analysis.elapsedMs,
    },
    federation: {
      pubchem_cid: federation.pubchem.cid,
      pubchem_status: federation.pubchem.status,
      qcarchive_status: federation.qcarchive?.status ?? "skipped",
      qcarchive_record_id: qcRecord?.recordId ?? null,
      qcarchive_energy_ha: qcRecord?.scfEnergyHa ?? null,
      qcarchive_dataset: qcRecord?.datasetHint ?? null,
    },
    attribution: {
      orcid_credit: req.orcidCredit,
      researcher_name: req.researcherName,
    },
    epistemic_notes: normalizeEpistemicNotes(backend.data.epistemic_notes, DFT_EPISTEMIC_BOUNDS),
  };

  return {
    ok: true,
    status: 200,
    sourceTier: backend.sourceTier,
    cacheStatus: "MISS",
    r2Key: finalR2Key,
    serializedBody: JSON.stringify(enrichedPayload),
    persistToVault: true,
    metrics,
    pdbId: req.pdbId,
    orcidCredit: req.orcidCredit,
    researcherName: req.researcherName,
  };
}

async function handleDockSubmit(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  corsHeaders: Record<string, string>,
  requestId: string,
): Promise<Response> {
  // 1. < 2 ms Anti-Slop Scientific Gatekeeper (ligand + 4-char PDB ID)
  const validated = await validateDockRequest(request, env);
  if (!validated.ok) {
    return gatekeeperErrorResponse(validated, corsHeaders, requestId);
  }

  const trustedCaller = await isTrustedGatewayCaller(request, env);
  const bypassCache = validated.forceRecompute && trustedCaller;
  const originUrl = new URL(request.url).origin;

  // 2. Instant Edge Cache / R2 Vault Check (100% UNLIMITED — NO RATE LIMIT!)
  if (!bypassCache) {
    let candidateR2Key: string | null =
      validated.inchikey !== null
        ? buildR2Key("dock", validated.inchikey, validated.pdbId, validated.methodBasis)
        : null;

    if (candidateR2Key === null) {
      const d1Match = await lookupR2KeyBySmilesInD1(
        env,
        validated.smiles,
        validated.pdbId,
        validated.methodBasis,
      );
      if (d1Match !== null) {
        candidateR2Key = d1Match.r2Key;
      }
    }

    if (candidateR2Key !== null) {
      const cached = await tryReadFromEdgeOrR2(env, originUrl, candidateR2Key);
      if (cached.hit) {
        ctx.waitUntil(incrementHitCountInD1(env, candidateR2Key));
        return new Response(cached.body, {
          status: 200,
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Cache-Control": "public, max-age=31536000, immutable",
            "X-RPrime-Cache": cached.tier,
            "X-RPrime-Source-Tier": "r2_cache",
            "X-RPrime-Request-Id": requestId,
            ...corsHeaders,
          },
        });
      }
    }
  }

  // 3. Per-IP Token-Bucket Rate Limiter (ONLY on uncached docking submits!)
  let rateLimitHeaders: Record<string, string> = {};
  if (!trustedCaller) {
    const rl = await consumeNovelComputeToken(request, env, validated.analysis.cnsMpo);
    rateLimitHeaders = {
      "X-RateLimit-Limit": String(rl.limit),
      "X-RateLimit-Remaining": String(rl.remaining),
    };
    if (!rl.allowed) {
      return jsonResponse(
        {
          status: "rate_limited",
          error: "NOVEL_COMPUTE_RATE_LIMITED",
          message:
            "Per-IP novel docking compute token bucket exhausted. All cached Atlas & R2 reads remain 100% unlimited.",
          retry_after_seconds: rl.retryAfterSeconds,
          priority_tier: rl.priorityTier,
          cns_mpo: validated.analysis.cnsMpo,
          request_id: requestId,
        },
        429,
        corsHeaders,
        {
          ...rateLimitHeaders,
          "Retry-After": String(rl.retryAfterSeconds),
          "X-RPrime-Request-Id": requestId,
          "Cache-Control": "no-store",
        },
      );
    }
  }

  // 4. Single-Flight Coalescing
  const smilesHash = await sha256Hex(validated.smiles);
  const flightKey = `dock:${validated.inchikey ?? smilesHash}:${validated.pdbId}:${slugifyMethod(validated.methodBasis)}:res=${validated.covalentTargetRes ?? "auto"}`;

  let coalesced = false;
  let jobPromise = inFlightJobs.get(flightKey);
  if (jobPromise) {
    coalesced = true;
  } else {
    jobPromise = executeDockPipeline(
      env,
      originUrl,
      validated,
      smilesHash,
      bypassCache,
      requestId,
    ).finally(() => {
      inFlightJobs.delete(flightKey);
    });
    inFlightJobs.set(flightKey, jobPromise);
  }

  const outcome = await jobPromise;
  if (!outcome.ok) {
    const extra: Record<string, string> = {
      ...rateLimitHeaders,
      "X-RPrime-Coalesced": coalesced ? "1" : "0",
      "X-RPrime-Request-Id": requestId,
      "Cache-Control": "no-store",
    };
    if (outcome.retryAfterSeconds !== undefined) {
      extra["Retry-After"] = String(outcome.retryAfterSeconds);
    }
    return jsonResponse(outcome.body, outcome.status, corsHeaders, extra);
  }

  if (!coalesced && outcome.persistToVault && outcome.metrics !== null) {
    ctx.waitUntil(
      persistBundleToR2AndD1(
        env,
        originUrl,
        outcome.r2Key,
        outcome.serializedBody,
        outcome.metrics,
        outcome.pdbId,
        outcome.sourceTier,
        outcome.orcidCredit,
        outcome.researcherName,
      ),
    );
  } else if (!coalesced && outcome.cacheStatus === "HIT-R2") {
    ctx.waitUntil(incrementHitCountInD1(env, outcome.r2Key));
  }

  return new Response(outcome.serializedBody, {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control":
        outcome.persistToVault || outcome.cacheStatus === "HIT-R2"
          ? "public, max-age=31536000, immutable"
          : "no-store",
      "X-RPrime-Cache": outcome.cacheStatus,
      "X-RPrime-Source-Tier": outcome.sourceTier,
      "X-RPrime-Coalesced": coalesced ? "1" : "0",
      "X-RPrime-Request-Id": requestId,
      ...rateLimitHeaders,
      ...corsHeaders,
    },
  });
}

async function executeDockPipeline(
  env: Env,
  originUrl: string,
  req: ValidatedDockRequest,
  smilesHash: string,
  bypassCache: boolean,
  requestId: string,
): Promise<ComputeOutcome> {
  const federationTimeoutMs = parsePositiveInt(env.FEDERATION_TIMEOUT_MS, 2500);

  // 1. PubChem InChIKey resolution (skip QCArchive since docking is PDB-specific)
  const federation = await runOpenScienceFederation(
    req.smiles,
    req.inchikey,
    false,
    federationTimeoutMs,
  );
  const resolvedInchiKey = req.inchikey ?? federation.pubchem.inchikey;

  // 2. Re-check R2 Vault with canonical PubChem InChIKey
  if (!bypassCache && resolvedInchiKey !== null && req.inchikey === null) {
    const resolvedR2Key = buildR2Key("dock", resolvedInchiKey, req.pdbId, req.methodBasis);
    const r2Hit = await tryReadFromEdgeOrR2(env, originUrl, resolvedR2Key);
    if (r2Hit.hit) {
      return {
        ok: true,
        status: 200,
        sourceTier: "r2_cache",
        cacheStatus: "HIT-R2",
        r2Key: resolvedR2Key,
        serializedBody: r2Hit.body,
        persistToVault: false,
        metrics: null,
        pdbId: req.pdbId,
        orcidCredit: req.orcidCredit,
        researcherName: req.researcherName,
      };
    }
  }

  // 3. Primary Modal GPU/Multi-Core (12s timeout) -> Automatic Failover to HF Spaces Free Docker
  const upstreamPayload: Record<string, unknown> = {
    smiles: req.smiles,
    pdb_id: req.pdbId,
    mol_name: req.molName ?? federation.pubchem.title ?? req.analysis.formula,
    exhaustiveness: req.exhaustiveness,
  };
  if (resolvedInchiKey !== null) upstreamPayload.inchikey = resolvedInchiKey;
  if (req.covalentTargetRes !== null) upstreamPayload.covalent_target_res = req.covalentTargetRes;
  if (req.boxCenter !== null) upstreamPayload.box_center = req.boxCenter;
  if (req.boxSize !== null) upstreamPayload.box_size = req.boxSize;
  if (req.orcidCredit !== null) upstreamPayload.orcid_credit = req.orcidCredit;
  if (req.researcherName !== null) upstreamPayload.researcher_name = req.researcherName;

  const backend = await invokeComputeWithFailover(env, "/api/v1/dock", upstreamPayload, requestId);
  if (!backend.ok) {
    return {
      ok: false,
      status: backend.status,
      retryAfterSeconds: backend.scientificRefusal ? undefined : 30,
      body: {
        status: backend.scientificRefusal ? "rejected" : "error",
        ...backend.data,
        failover_telemetry: {
          modal_error: backend.modalError,
          hf_error: backend.hfError,
        },
        epistemic_notes: DOCK_EPISTEMIC_BOUNDS,
        request_id: requestId,
      },
    };
  }

  const fallbackKey = resolvedInchiKey ?? `SHA256-${smilesHash.slice(0, 20).toUpperCase()}`;
  const metrics = extractMetricsFromPayload(
    backend.data,
    req.analysis,
    fallbackKey,
    req.molName ?? federation.pubchem.title,
    req.methodBasis,
  );
  const finalR2Key = buildR2Key("dock", metrics.inchikey, req.pdbId, metrics.methodBasis);

  const enrichedPayload: Record<string, unknown> = {
    ...backend.data,
    status: "ok",
    inchikey: metrics.inchikey,
    pdb_id: req.pdbId,
    method_basis: metrics.methodBasis,
    hac: metrics.hac,
    mw: metrics.mw,
    cns_mpo: metrics.cnsMpo,
    vina_kcal: metrics.vinaKcal,
    pocket_vol_a3: metrics.pocketVolA3,
    r2_key: finalR2Key,
    bundle_url: `/api/v1/atlas/${encodeURIComponent(finalR2Key)}`,
    source_tier: backend.sourceTier,
    gateway: {
      request_id: requestId,
      source_tier: backend.sourceTier,
      failover_used: backend.failoverUsed,
      modal_failover_reason: backend.modalFailoverReason,
      upstream_latency_ms: backend.latencyMs,
      gatekeeper_ms: req.analysis.elapsedMs,
    },
    federation: {
      pubchem_cid: federation.pubchem.cid,
      pubchem_status: federation.pubchem.status,
    },
    attribution: {
      orcid_credit: req.orcidCredit,
      researcher_name: req.researcherName,
    },
    epistemic_notes: normalizeEpistemicNotes(backend.data.epistemic_notes, DOCK_EPISTEMIC_BOUNDS),
  };

  return {
    ok: true,
    status: 200,
    sourceTier: backend.sourceTier,
    cacheStatus: "MISS",
    r2Key: finalR2Key,
    serializedBody: JSON.stringify(enrichedPayload),
    persistToVault: true,
    metrics,
    pdbId: req.pdbId,
    orcidCredit: req.orcidCredit,
    researcherName: req.researcherName,
  };
}

/**
 * SSE Real-Time SCF Convergence Stream (`POST /api/v1/dft/stream`).
 * Serves instant synthetic SSE `event: result` on R2 Vault hits (0 compute),
 * otherwise rate-limits and proxies live SSE from Modal -> HF Spaces.
 */
async function handleDftStreamProxy(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  corsHeaders: Record<string, string>,
  requestId: string,
): Promise<Response> {
  const validated = await validateDftRequest(request, env);
  if (!validated.ok) {
    return gatekeeperErrorResponse(validated, corsHeaders, requestId);
  }

  const trustedCaller = await isTrustedGatewayCaller(request, env);
  const bypassCache = validated.forceRecompute && trustedCaller;
  const originUrl = new URL(request.url).origin;

  // Instant SSE hit from Edge Cache / R2 Vault without burning compute or rate-limit tokens
  if (!bypassCache) {
    let candidateR2Key: string | null =
      validated.inchikey !== null
        ? buildR2Key("dft", validated.inchikey, validated.pdbId, validated.methodBasis)
        : null;
    if (candidateR2Key === null) {
      const d1Match = await lookupR2KeyBySmilesInD1(
        env,
        validated.smiles,
        validated.pdbId,
        validated.methodBasis,
      );
      if (d1Match !== null) candidateR2Key = d1Match.r2Key;
    }
    if (candidateR2Key !== null) {
      const cached = await tryReadFromEdgeOrR2(env, originUrl, candidateR2Key);
      if (cached.hit) {
        ctx.waitUntil(incrementHitCountInD1(env, candidateR2Key));
        const sseBody =
          `event: stage\ndata: ${JSON.stringify({ step: "r2_vault_hit", message: "Instant immutable hit served from Cloudflare R2 Quantum Vault ($0 compute)." })}\n\n` +
          `event: result\ndata: ${cached.body}\n\n` +
          `event: done\ndata: {"cached":true}\n\n`;
        return new Response(sseBody, {
          status: 200,
          headers: {
            "Content-Type": "text/event-stream; charset=utf-8",
            "Cache-Control": "no-cache",
            "X-RPrime-Cache": cached.tier,
            "X-RPrime-Source-Tier": "r2_cache",
            "X-RPrime-Request-Id": requestId,
            ...corsHeaders,
          },
        });
      }
    }
  }

  if (!trustedCaller) {
    const rl = await consumeNovelComputeToken(request, env, validated.analysis.cnsMpo);
    if (!rl.allowed) {
      return jsonResponse(
        {
          status: "rate_limited",
          error: "NOVEL_COMPUTE_RATE_LIMITED",
          message:
            "Per-IP novel DFT stream token bucket exhausted. Cached Atlas/R2 reads remain unlimited.",
          retry_after_seconds: rl.retryAfterSeconds,
          request_id: requestId,
        },
        429,
        corsHeaders,
        {
          "Retry-After": String(rl.retryAfterSeconds),
          "X-RateLimit-Limit": String(rl.limit),
          "X-RateLimit-Remaining": "0",
          "X-RPrime-Request-Id": requestId,
        },
      );
    }
  }

  const candidates: Array<{ url: string; tier: "modal_gpu" | "hf_space_cpu"; timeoutMs: number }> =
    [];
  if (isValidHttpUrl(env.MODAL_URL)) {
    candidates.push({
      url: env.MODAL_URL.trim(),
      tier: "modal_gpu",
      timeoutMs: parsePositiveInt(env.MODAL_TIMEOUT_MS, 12_000),
    });
  }
  if (isValidHttpUrl(env.HF_SPACE_URL)) {
    candidates.push({
      url: env.HF_SPACE_URL.trim(),
      tier: "hf_space_cpu",
      timeoutMs: parsePositiveInt(env.HF_TIMEOUT_MS, 55_000),
    });
  }

  const upstreamPayload: Record<string, unknown> = {
    smiles: validated.smiles,
    mol_name: validated.molName ?? validated.analysis.formula,
    pdb_id: validated.pdbId,
    method_basis: validated.methodBasis,
    compute_covalent_delta_e: validated.covalentAdduct,
    covalent_adduct: validated.covalentAdduct,
    include_cubes: validated.includeCubes,
    cube_grid_spacing: validated.cubeGridSpacing,
  };
  if (validated.orcidCredit !== null) upstreamPayload.orcid_credit = validated.orcidCredit;
  if (validated.researcherName !== null) upstreamPayload.researcher_name = validated.researcherName;
  const upstreamBody = JSON.stringify(upstreamPayload);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "text/event-stream",
    "X-Request-Id": requestId,
  };
  if (env.GATEWAY_SHARED_SECRET?.trim()) {
    headers["X-RPrime-Gateway-Key"] = env.GATEWAY_SHARED_SECRET.trim();
  }

  for (const target of candidates) {
    try {
      const upstreamResp = await fetch(`${trimTrailingSlash(target.url)}/api/v1/dft/stream`, {
        method: "POST",
        headers,
        body: upstreamBody,
        signal: AbortSignal.timeout(target.timeoutMs),
      });
      if (upstreamResp.ok && upstreamResp.body !== null) {
        return new Response(upstreamResp.body, {
          status: 200,
          headers: {
            "Content-Type": "text/event-stream; charset=utf-8",
            "Cache-Control": "no-cache",
            "X-RPrime-Cache": "MISS",
            "X-RPrime-Source-Tier": target.tier,
            "X-RPrime-Request-Id": requestId,
            ...corsHeaders,
          },
        });
      }
      if (upstreamResp.status === 400 || upstreamResp.status === 422) {
        const errText = await upstreamResp.text();
        return new Response(errText, {
          status: upstreamResp.status,
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            "X-RPrime-Request-Id": requestId,
            ...corsHeaders,
          },
        });
      }
    } catch {
      // Automatically fail over to next upstream candidate
    }
  }

  return jsonResponse(
    {
      status: "error",
      error: "STREAM_UPSTREAM_UNAVAILABLE",
      message: "No live SSE PySCF compute backend responded.",
      request_id: requestId,
    },
    503,
    corsHeaders,
    { "Retry-After": "30", "X-RPrime-Request-Id": requestId },
  );
}

// ============================================================================
// Worker Fetch Entrypoint (NEVER destructure `ctx` — always `ctx.waitUntil`)
// ============================================================================

const worker: ExportedHandler<Env> = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const requestId = crypto.randomUUID();
    const cors = evaluateCors(request, env);

    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      if (!cors.allowed) {
        return new Response(null, { status: 403, headers: { Vary: "Origin" } });
      }
      return new Response(null, { status: 204, headers: cors.headers });
    }

    // Enforce strict Origin allowlist for browser POST requests
    if (!cors.allowed && request.method !== "GET" && request.method !== "HEAD") {
      return jsonResponse(
        {
          status: "error",
          error: "CORS_ORIGIN_FORBIDDEN",
          message: `Origin '${cors.origin ?? "unknown"}' is not permitted by ALLOWED_ORIGINS.`,
          request_id: requestId,
        },
        403,
        cors.headers,
        { "X-RPrime-Request-Id": requestId },
      );
    }

    const url = new URL(request.url);
    const pathname = url.pathname.replace(/\/+$/, "") || "/";

    if (request.method === "GET" && pathname === "/health") {
      return handleHealth(env, cors.headers, requestId);
    }

    if (request.method === "GET" && pathname === "/api/v1/atlas") {
      return handleAtlasLeaderboard(request, env, ctx, cors.headers, requestId);
    }

    if (request.method === "GET" && pathname.startsWith("/api/v1/atlas/")) {
      const rawKey = pathname.slice("/api/v1/atlas/".length);
      return handleAtlasBundleGet(request, env, ctx, rawKey, cors.headers, requestId);
    }

    if (request.method === "POST" && pathname === "/api/v1/dft") {
      return handleDftSubmit(request, env, ctx, cors.headers, requestId);
    }

    if (request.method === "POST" && pathname === "/api/v1/dft/stream") {
      return handleDftStreamProxy(request, env, ctx, cors.headers, requestId);
    }

    if (request.method === "POST" && pathname === "/api/v1/dock") {
      return handleDockSubmit(request, env, ctx, cors.headers, requestId);
    }

    return jsonResponse(
      {
        status: "not_found",
        error: "ROUTE_NOT_FOUND",
        message: `Unknown route ${request.method} ${pathname}.`,
        endpoints: [
          "GET /health",
          "GET /api/v1/atlas",
          "GET /api/v1/atlas/:key",
          "POST /api/v1/dft",
          "POST /api/v1/dft/stream",
          "POST /api/v1/dock",
        ],
        request_id: requestId,
      },
      404,
      cors.headers,
      { "X-RPrime-Request-Id": requestId },
    );
  },
};

export default worker;
