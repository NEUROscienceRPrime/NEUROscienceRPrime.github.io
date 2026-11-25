/**
 * < 2 ms Anti-Slop Scientific Gatekeeper, Strict CORS, Web Crypto Constant-Time Auth,
 * and Cloudflare Edge Cache API Per-IP Token-Bucket Rate Limiter.
 *
 * Enforces CNS chemical space (HAC <= 38, MW <= 550 Da, closed-shell organic elements
 * H/C/N/O/F/P/S/Cl/Br/I), rejects salts/mixtures ('.'), open-shell radicals, broken
 * valences, and graph-verified PAINS assay-interference motifs before any compute fires.
 */

export interface Env {
  readonly QUANTUM_VAULT: R2Bucket;
  readonly ATLAS_DB: D1Database;
  readonly ALLOWED_ORIGINS: string;
  readonly DEFAULT_METHOD: string;
  readonly RATE_LIMIT_MAX_TOKENS?: string;
  readonly RATE_LIMIT_REFILL_SECONDS?: string;
  readonly MODAL_TIMEOUT_MS?: string;
  readonly HF_TIMEOUT_MS?: string;
  readonly FEDERATION_TIMEOUT_MS?: string;
  // Secrets configured via `wrangler secret put` — NEVER hardcoded
  readonly MODAL_URL?: string;
  readonly HF_SPACE_URL?: string;
  readonly GATEWAY_SHARED_SECRET?: string;
}

export type AllowedElement = "H" | "C" | "N" | "O" | "F" | "P" | "S" | "Cl" | "Br" | "I";

export interface SmilesAnalysis {
  readonly smiles: string;
  readonly hac: number;
  readonly mw: number;
  readonly formula: string;
  readonly netCharge: number;
  readonly totalElectrons: number;
  readonly hbd: number;
  readonly hba: number;
  readonly tpsa: number;
  readonly clogp: number;
  readonly cnsMpo: number;
  readonly aromaticAtomCount: number;
  readonly ringCount: number;
  readonly elapsedMs: number;
}

export interface GatekeeperFailure {
  readonly ok: false;
  readonly status: 400 | 413 | 422;
  readonly code: string;
  readonly message: string;
  readonly details?: Record<string, string | number | boolean>;
}

export interface ValidatedDftRequest {
  readonly ok: true;
  readonly smiles: string;
  readonly analysis: SmilesAnalysis;
  readonly inchikey: string | null;
  readonly molName: string | null;
  readonly pdbId: string;
  readonly methodBasis: string;
  readonly covalentAdduct: boolean;
  readonly includeCubes: boolean;
  readonly cubeGridSpacing: number;
  readonly preferFederated: boolean;
  readonly forceRecompute: boolean;
  readonly orcidCredit: string | null;
  readonly researcherName: string | null;
}

export interface ValidatedDockRequest {
  readonly ok: true;
  readonly smiles: string;
  readonly analysis: SmilesAnalysis;
  readonly inchikey: string | null;
  readonly molName: string | null;
  readonly pdbId: string;
  readonly methodBasis: string;
  readonly covalentTargetRes: string | null;
  readonly exhaustiveness: number;
  readonly boxCenter: readonly [number, number, number] | null;
  readonly boxSize: readonly [number, number, number] | null;
  readonly forceRecompute: boolean;
  readonly orcidCredit: string | null;
  readonly researcherName: string | null;
}

export interface CorsDecision {
  readonly allowed: boolean;
  readonly origin: string | null;
  readonly headers: Record<string, string>;
}

export interface RateLimitDecision {
  readonly allowed: boolean;
  readonly remaining: number;
  readonly limit: number;
  readonly retryAfterSeconds: number;
  readonly priorityTier: "cns_fast_lane" | "standard";
}

// ============================================================================
// Constants & Chemical Tables
// ============================================================================

export const MAX_CNS_HAC = 38;
export const MAX_CNS_MW = 550.0;
const MAX_JSON_BODY_BYTES = 16_384;
const MAX_SMILES_LENGTH = 256;

const PDB_ID_RE = /^[1-9][A-Za-z0-9]{3}$/;
const INCHIKEY_RE = /^[A-Z]{14}-[A-Z]{10}-[A-Z]$/;
const ORCID_RE = /^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/;
const COVALENT_RES_RE = /^[A-Za-z0-9:_-]{2,24}$/;
const METHOD_BASIS_RE = /^[A-Za-z0-9._+\/-]{3,80}$/;

const ATOMIC_MASS: Readonly<Record<AllowedElement, number>> = {
  H: 1.00794,
  C: 12.0107,
  N: 14.0067,
  O: 15.9994,
  F: 18.9984,
  P: 30.97376,
  S: 32.065,
  Cl: 35.453,
  Br: 79.904,
  I: 126.90447,
};

const ATOMIC_NUMBER: Readonly<Record<AllowedElement, number>> = {
  H: 1,
  C: 6,
  N: 7,
  O: 8,
  F: 9,
  P: 15,
  S: 16,
  Cl: 17,
  Br: 35,
  I: 53,
};

const STANDARD_VALENCES: Readonly<Record<AllowedElement, readonly number[]>> = {
  H: [1],
  C: [4],
  N: [3, 5],
  O: [2],
  F: [1],
  P: [3, 5],
  S: [2, 4, 6],
  Cl: [1],
  Br: [1],
  I: [1],
};

function isAllowedElement(sym: string): sym is AllowedElement {
  return Object.prototype.hasOwnProperty.call(ATOMIC_MASS, sym);
}

// ============================================================================
// Strict Runtime Type Guards (Zero `any`, Zero Double Type-Assertions)
// ============================================================================

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function readOptionalString(
  obj: Record<string, unknown>,
  keys: readonly string[],
): string | null {
  for (const key of keys) {
    const val = obj[key];
    if (typeof val === "string") {
      const trimmed = val.trim();
      if (trimmed.length > 0) {
        return trimmed;
      }
    }
  }
  return null;
}

export function readOptionalBoolean(
  obj: Record<string, unknown>,
  keys: readonly string[],
  defaultVal: boolean,
): boolean {
  for (const key of keys) {
    const val = obj[key];
    if (typeof val === "boolean") {
      return val;
    }
  }
  return defaultVal;
}

export function readOptionalNumber(
  obj: Record<string, unknown>,
  keys: readonly string[],
): number | null {
  for (const key of keys) {
    const val = obj[key];
    if (typeof val === "number" && Number.isFinite(val)) {
      return val;
    }
    if (typeof val === "string" && val.trim().length > 0) {
      const parsed = Number(val);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }
  return null;
}

function readOptionalTuple3(
  obj: Record<string, unknown>,
  key: string,
): readonly [number, number, number] | null | "invalid" {
  const val = obj[key];
  if (val === undefined || val === null) {
    return null;
  }
  if (!Array.isArray(val) || val.length !== 3) {
    return "invalid";
  }
  const a = val[0];
  const b = val[1];
  const c = val[2];
  if (
    typeof a !== "number" ||
    typeof b !== "number" ||
    typeof c !== "number" ||
    !Number.isFinite(a) ||
    !Number.isFinite(b) ||
    !Number.isFinite(c)
  ) {
    return "invalid";
  }
  return [a, b, c];
}

function sanitizeDisplayText(input: string | null, maxLen: number): string | null {
  if (input === null) {
    return null;
  }
  const cleaned = input.replace(/[\x00-\x1F\x7F]/g, " ").replace(/\s+/g, " ").trim();
  if (cleaned.length === 0) {
    return null;
  }
  return cleaned.slice(0, maxLen);
}

// ============================================================================
// Web Crypto Constant-Time Comparison & Hashing
// ============================================================================

export async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const view = new Uint8Array(digest);
  let hex = "";
  for (const byte of view) {
    hex += byte.toString(16).padStart(2, "0");
  }
  return hex;
}

/**
 * Constant-time string comparison using SHA-256 fixed-length digests and
 * Cloudflare Workers' Web Crypto `crypto.subtle.timingSafeEqual`.
 * Hashing both strings first prevents leaking secret length.
 */
export async function constantTimeEqual(a: string, b: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const [digestA, digestB] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(a)),
    crypto.subtle.digest("SHA-256", encoder.encode(b)),
  ]);
  return crypto.subtle.timingSafeEqual(digestA, digestB);
}

export async function isTrustedGatewayCaller(
  request: Request,
  env: Env,
): Promise<boolean> {
  const secret = env.GATEWAY_SHARED_SECRET?.trim();
  if (!secret) {
    return false;
  }
  const provided = request.headers.get("X-RPrime-Gateway-Key")?.trim();
  if (!provided) {
    return false;
  }
  return constantTimeEqual(provided, secret);
}

// ============================================================================
// Strict CORS Enforcement
// ============================================================================

export function evaluateCors(request: Request, env: Env): CorsDecision {
  const origin = request.headers.get("Origin");
  const allowedList = (env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  const baseHeaders: Record<string, string> = {
    Vary: "Origin",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-RPrime-Gateway-Key, X-Client-Version",
    "Access-Control-Expose-Headers":
      "X-RPrime-Cache, X-RPrime-Source-Tier, X-RPrime-Request-Id, X-RPrime-Coalesced, X-RateLimit-Limit, X-RateLimit-Remaining, Retry-After",
    "Access-Control-Max-Age": "86400",
  };

  // Non-browser / server-to-server requests (curl, scripts) send no Origin header
  if (origin === null) {
    return {
      allowed: true,
      origin: null,
      headers: baseHeaders,
    };
  }

  const isAllowed = allowedList.includes(origin);
  if (!isAllowed) {
    return {
      allowed: false,
      origin,
      headers: baseHeaders,
    };
  }

  return {
    allowed: true,
    origin,
    headers: {
      ...baseHeaders,
      "Access-Control-Allow-Origin": origin,
    },
  };
}

// ============================================================================
// Pure-TS < 2 ms SMILES Molecular Graph Parser, CNS Gatekeeper & PAINS Filter
// ============================================================================

interface ParsedAtom {
  readonly index: number;
  readonly element: AllowedElement;
  readonly aromatic: boolean;
  readonly bracketed: boolean;
  readonly explicitH: number;
  readonly formalCharge: number;
  readonly isotope: number | null;
  implicitH: number;
}

interface ParsedBond {
  readonly from: number;
  readonly to: number;
  readonly order: number; // 1, 2, 3, 4, or 1.5 (aromatic)
  readonly aromatic: boolean;
}

interface PendingRing {
  readonly atomIndex: number;
  readonly explicitOrder: number | null;
  readonly explicitAromatic: boolean | null;
}

type BondToken = {
  readonly order: number;
  readonly aromatic: boolean;
};

const BRACKET_ATOM_RE =
  /^(\d+)?([A-Z][a-z]?|[cnopsb])(@@?)?(H(\d+)?)?([+-]\d*|\d+[+-]|\+\+|--)?(:\d+)?$/;

function parseFormalCharge(token: string | undefined): number | null {
  if (!token) {
    return 0;
  }
  if (token === "+") return 1;
  if (token === "-") return -1;
  if (token === "++") return 2;
  if (token === "--") return -2;
  const signFirst = /^([+-])(\d+)$/.exec(token);
  if (signFirst && signFirst[1] && signFirst[2]) {
    const mag = Number.parseInt(signFirst[2], 10);
    return signFirst[1] === "+" ? mag : -mag;
  }
  const numFirst = /^(\d+)([+-])$/.exec(token);
  if (numFirst && numFirst[1] && numFirst[2]) {
    const mag = Number.parseInt(numFirst[1], 10);
    return numFirst[2] === "+" ? mag : -mag;
  }
  return null;
}

function normalizeAromaticSymbol(sym: string): { element: string; aromatic: boolean } {
  if (sym === "c") return { element: "C", aromatic: true };
  if (sym === "n") return { element: "N", aromatic: true };
  if (sym === "o") return { element: "O", aromatic: true };
  if (sym === "p") return { element: "P", aromatic: true };
  if (sym === "s") return { element: "S", aromatic: true };
  if (sym === "b") return { element: "B", aromatic: true };
  return { element: sym, aromatic: false };
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function linearDesirability(val: number, idealMax: number, zeroAt: number): number {
  if (val <= idealMax) return 1.0;
  if (val >= zeroAt) return 0.0;
  return (zeroAt - val) / (zeroAt - idealMax);
}

/**
 * Graph-based PAINS / pan-assay reactive trash detector.
 * Precision-tuned for CNS pharmacology and targeted covalent inhibitors:
 * - Rejects acyl halides, thiocarbonyl halides, sulfenyl halides, 1,2-/1,4-quinones,
 *   rhodanines, isocyanates/isothiocyanates, peroxides (O-O), diazo/nitroso, and aromatic azo dyes.
 * - Explicitly PERMITS catechols (dopamine/norepinephrine!), alpha-haloketones (C(=O)CH2Cl),
 *   maleimides, epoxides, acrylamides, and sulfonate esters.
 */
function detectPainsMotif(
  atoms: readonly ParsedAtom[],
  adj: readonly (readonly { neighbor: number; order: number; aromatic: boolean }[])[],
): { code: string; motif: string } | null {
  const n = atoms.length;

  for (let i = 0; i < n; i++) {
    const atom = atoms[i];
    const neighbors = adj[i];
    if (!atom || !neighbors) continue;

    // 1. Acyl halide C(=O)X or Thiocarbonyl halide C(=S)X
    if (atom.element === "C" && !atom.aromatic) {
      let hasDoubleO = false;
      let hasDoubleS = false;
      let hasHalogen = false;
      for (const edge of neighbors) {
        const nb = atoms[edge.neighbor];
        if (!nb) continue;
        if (nb.element === "O" && edge.order === 2) hasDoubleO = true;
        if (nb.element === "S" && edge.order === 2) hasDoubleS = true;
        if (
          edge.order === 1 &&
          (nb.element === "F" || nb.element === "Cl" || nb.element === "Br" || nb.element === "I")
        ) {
          hasHalogen = true;
        }
      }
      if (hasDoubleO && hasHalogen) {
        return {
          code: "PAINS_ACYL_HALIDE",
          motif: "Acyl halide (C(=O)X) hydrolyzes instantaneously in aqueous buffer",
        };
      }
      if (hasDoubleS && hasHalogen) {
        return {
          code: "PAINS_THIOCARBONYL_HALIDE",
          motif: "Thiocarbonyl halide (C(=S)X) is non-selective reactive assay trash",
        };
      }
    }

    // 2. Isocyanate (N=C=O) or Isothiocyanate (N=C=S)
    if (atom.element === "C" && !atom.aromatic) {
      let hasDoubleN = false;
      let hasDoubleChalcogen = false;
      for (const edge of neighbors) {
        const nb = atoms[edge.neighbor];
        if (!nb) continue;
        if (nb.element === "N" && edge.order === 2) hasDoubleN = true;
        if ((nb.element === "O" || nb.element === "S") && edge.order === 2) {
          hasDoubleChalcogen = true;
        }
      }
      if (hasDoubleN && hasDoubleChalcogen) {
        return {
          code: "PAINS_ISOCYANATE",
          motif: "Isocyanate / isothiocyanate (N=C=O / N=C=S) promiscuous electrophile",
        };
      }
    }

    // 3. Organic Peroxide (O-O single bond)
    if (atom.element === "O") {
      for (const edge of neighbors) {
        const nb = atoms[edge.neighbor];
        if (nb && nb.element === "O" && edge.neighbor > i) {
          return {
            code: "PAINS_PEROXIDE",
            motif: "Labile O-O peroxide bond (redox-cycling PAINS liability)",
          };
        }
      }
    }

    // 4. Sulfenyl halide (S-Cl/Br/I without sulfonyl =O stabilization)
    if (atom.element === "S" && !atom.aromatic) {
      let doubleOCount = 0;
      let hasHeavyHalogen = false;
      for (const edge of neighbors) {
        const nb = atoms[edge.neighbor];
        if (!nb) continue;
        if (nb.element === "O" && edge.order === 2) doubleOCount++;
        if (
          edge.order === 1 &&
          (nb.element === "Cl" || nb.element === "Br" || nb.element === "I")
        ) {
          hasHeavyHalogen = true;
        }
      }
      if (hasHeavyHalogen && doubleOCount < 2) {
        return {
          code: "PAINS_SULFENYL_HALIDE",
          motif: "Sulfenyl/sulfinyl halide is unstable non-specific thiol-reactive trash",
        };
      }
    }

    // 5. Nitroso (R-N=O, excluding nitro [N+](=O)[O-] and oxime) & Aromatic Azo (Ar-N=N-Ar) & Diazo
    if (atom.element === "N") {
      let doubleO = 0;
      let singleO = 0;
      let doubleNCount = 0;
      for (const edge of neighbors) {
        const nb = atoms[edge.neighbor];
        if (!nb) continue;
        if (nb.element === "O" && edge.order === 2) doubleO++;
        if (nb.element === "O" && edge.order === 1) singleO++;
        if (nb.element === "N" && edge.order === 2) doubleNCount++;
      }
      if (doubleO === 1 && singleO === 0 && atom.formalCharge === 0 && neighbors.length <= 2) {
        return {
          code: "PAINS_NITROSO",
          motif: "Nitroso (R-N=O) reactive/mutagenic PAINS alert",
        };
      }
      if (doubleNCount >= 2) {
        return {
          code: "PAINS_DIAZO_AZIDE",
          motif: "Cumulated diazo/azide nitrogen motif (N=N=N / C=N=N)",
        };
      }
      for (const edge of neighbors) {
        const nb = atoms[edge.neighbor];
        if (!nb || nb.element !== "N" || edge.order !== 2 || edge.neighbor <= i) continue;
        const nbAdj = adj[edge.neighbor] ?? [];
        const iHasAromC = neighbors.some((e) => {
          const a = atoms[e.neighbor];
          return a !== undefined && a.element === "C" && a.aromatic;
        });
        const jHasAromC = nbAdj.some((e) => {
          const a = atoms[e.neighbor];
          return a !== undefined && a.element === "C" && a.aromatic;
        });
        if (iHasAromC && jHasAromC) {
          return {
            code: "PAINS_AZO_DYE",
            motif: "Aromatic azo dye (Ar-N=N-Ar) PAINS pan-assay interferent",
          };
        }
      }
    }
  }

  // 6. Rhodanine core: 5-membered ring containing N - C(=S) - S - C - C(=O) - N
  for (let i = 0; i < n; i++) {
    const cThio = atoms[i];
    const thioEdges = adj[i];
    if (!cThio || !thioEdges || cThio.element !== "C") continue;
    const hasDoubleS = thioEdges.some((e) => {
      const nb = atoms[e.neighbor];
      return nb !== undefined && nb.element === "S" && e.order === 2;
    });
    if (!hasDoubleS) continue;

    // Look for adjacent ring N and ring S on the thiocarbonyl C
    const ringNs = thioEdges.filter((e) => {
      const nb = atoms[e.neighbor];
      return nb !== undefined && nb.element === "N" && e.order < 2;
    });
    const ringSs = thioEdges.filter((e) => {
      const nb = atoms[e.neighbor];
      return nb !== undefined && nb.element === "S" && e.order < 2;
    });

    for (const nEdge of ringNs) {
      const nAdj = adj[nEdge.neighbor] ?? [];
      for (const sEdge of ringSs) {
        const sAdj = adj[sEdge.neighbor] ?? [];
        // Check if N connects to a C(=O) which connects to a C which connects to S
        for (const nToCarb of nAdj) {
          if (nToCarb.neighbor === i) continue;
          const carbAtom = atoms[nToCarb.neighbor];
          const carbAdj = adj[nToCarb.neighbor] ?? [];
          if (!carbAtom || carbAtom.element !== "C") continue;
          const isCarbonyl = carbAdj.some((e) => {
            const nb = atoms[e.neighbor];
            return nb !== undefined && nb.element === "O" && e.order === 2;
          });
          if (!isCarbonyl) continue;
          for (const carbToC5 of carbAdj) {
            if (carbToC5.neighbor === nEdge.neighbor) continue;
            const c5 = atoms[carbToC5.neighbor];
            if (!c5 || c5.element !== "C") continue;
            const closesToS = sAdj.some((e) => e.neighbor === carbToC5.neighbor);
            if (closesToS) {
              return {
                code: "PAINS_RHODANINE",
                motif: "Rhodanine / 2-thioxothiazolidin-4-one classic PAINS promiscuous binder",
              };
            }
          }
        }
      }
    }
  }

  // 7. 1,4- and 1,2-Quinones: two C(=O) carbons on a 6-membered all-carbon cycle
  //    containing at least one C=C or aromatic c:c unsaturation (excludes maleimides
  //    which are 5-membered N-heterocycles and excludes saturated cyclohexanediones).
  const carbonylCSet = new Set<number>();
  for (let i = 0; i < n; i++) {
    const atom = atoms[i];
    const edges = adj[i];
    if (!atom || !edges || atom.element !== "C") continue;
    const hasExocyclicDoubleO = edges.some((e) => {
      const nb = atoms[e.neighbor];
      return nb !== undefined && nb.element === "O" && e.order === 2;
    });
    if (hasExocyclicDoubleO) {
      carbonylCSet.add(i);
    }
  }

  if (carbonylCSet.size >= 2) {
    const carbonylList = Array.from(carbonylCSet);
    for (const start of carbonylList) {
      // Bounded DFS of exact length 6 over carbon-only ring vertices
      const path: number[] = [start];
      const visited = new Set<number>([start]);

      const dfs = (current: number, hasUnsaturatedCC: boolean, secondCarbonylFound: boolean): boolean => {
        const edges = adj[current] ?? [];
        if (path.length === 6) {
          for (const e of edges) {
            if (e.neighbor === start) {
              const unsat = hasUnsaturatedCC || e.order === 2 || e.aromatic;
              if (unsat && secondCarbonylFound) {
                return true;
              }
            }
          }
          return false;
        }
        for (const e of edges) {
          const nextIdx = e.neighbor;
          if (visited.has(nextIdx)) continue;
          const nextAtom = atoms[nextIdx];
          if (!nextAtom || nextAtom.element !== "C") continue;
          // Exclude paths going directly to carbonyl oxygen (already filtered by element === 'C')
          visited.add(nextIdx);
          path.push(nextIdx);
          const nextUnsat = hasUnsaturatedCC || e.order === 2 || e.aromatic;
          const nextSecond = secondCarbonylFound || carbonylCSet.has(nextIdx);
          if (dfs(nextIdx, nextUnsat, nextSecond)) {
            return true;
          }
          path.pop();
          visited.delete(nextIdx);
        }
        return false;
      };

      if (dfs(start, false, false)) {
        return {
          code: "PAINS_QUINONE",
          motif: "1,2- or 1,4-Quinone redox-cycling Michael-trash PAINS motif",
        };
      }
    }
  }

  return null;
}

export function analyzeSmiles(rawSmiles: string): { ok: true; analysis: SmilesAnalysis } | GatekeeperFailure {
  const t0 = performance.now();
  const smiles = rawSmiles.trim();

  if (smiles.length === 0) {
    return {
      ok: false,
      status: 400,
      code: "EMPTY_SMILES",
      message: "SMILES string is required and cannot be empty.",
    };
  }
  if (smiles.length > MAX_SMILES_LENGTH) {
    return {
      ok: false,
      status: 422,
      code: "SMILES_TOO_LONG",
      message: `SMILES length (${smiles.length}) exceeds CNS gatekeeper cap (${MAX_SMILES_LENGTH} chars).`,
    };
  }
  if (!/^[\x21-\x7E]+$/.test(smiles)) {
    return {
      ok: false,
      status: 400,
      code: "INVALID_SMILES_CHARS",
      message: "SMILES contains whitespace or non-ASCII control characters.",
    };
  }
  if (smiles.includes(".")) {
    return {
      ok: false,
      status: 422,
      code: "SALT_OR_MIXTURE",
      message:
        "Disconnected salts, counterions, or mixtures ('.') are rejected. Submit the single desalted organic ligand.",
    };
  }
  if (smiles.includes(">") || smiles.includes("*")) {
    return {
      ok: false,
      status: 422,
      code: "UNSUPPORTED_SMILES_SYNTAX",
      message: "Reaction SMILES ('>') and wildcard/polymer atoms ('*') are not supported.",
    };
  }

  const atoms: ParsedAtom[] = [];
  const bonds: ParsedBond[] = [];
  const branchStack: number[] = [];
  const openRings = new Map<number, PendingRing>();

  let prevAtom: number | null = null;
  let pendingBond: BondToken | null = null;
  let ringCount = 0;

  let i = 0;
  while (i < smiles.length) {
    const ch = smiles[i];
    if (ch === undefined) break;

    if (ch === "(") {
      if (prevAtom === null) {
        return {
          ok: false,
          status: 400,
          code: "INVALID_BRANCH",
          message: "SMILES branch '(' opened before any atom.",
        };
      }
      if (smiles[i + 1] === ")") {
        return {
          ok: false,
          status: 400,
          code: "EMPTY_BRANCH",
          message: "SMILES contains empty branch '()'.",
        };
      }
      branchStack.push(prevAtom);
      i++;
      continue;
    }

    if (ch === ")") {
      if (branchStack.length === 0) {
        return {
          ok: false,
          status: 400,
          code: "UNBALANCED_BRANCH",
          message: "SMILES has unmatched closing parenthesis ')'.",
        };
      }
      if (pendingBond !== null) {
        return {
          ok: false,
          status: 400,
          code: "DANGLING_BOND",
          message: "SMILES has a dangling bond symbol before ')'.",
        };
      }
      prevAtom = branchStack.pop() ?? null;
      i++;
      continue;
    }

    // Bond symbols
    if (ch === "-" || ch === "=" || ch === "#" || ch === "$" || ch === ":" || ch === "/" || ch === "\\") {
      if (pendingBond !== null) {
        return {
          ok: false,
          status: 400,
          code: "CONSECUTIVE_BONDS",
          message: `Malformed SMILES: consecutive bond symbols near index ${i}.`,
        };
      }
      if (ch === "-" || ch === "/" || ch === "\\") {
        pendingBond = { order: 1, aromatic: false };
      } else if (ch === "=") {
        pendingBond = { order: 2, aromatic: false };
      } else if (ch === "#") {
        pendingBond = { order: 3, aromatic: false };
      } else if (ch === "$") {
        pendingBond = { order: 4, aromatic: false };
      } else {
        pendingBond = { order: 1.5, aromatic: true };
      }
      i++;
      continue;
    }

    // Ring closure digits: 0-9 or %10-%99
    if ((ch >= "0" && ch <= "9") || ch === "%") {
      if (prevAtom === null) {
        return {
          ok: false,
          status: 400,
          code: "RING_WITHOUT_ATOM",
          message: "Ring closure digit appeared before any atom.",
        };
      }
      let ringNum: number;
      if (ch === "%") {
        const twoDigits = smiles.slice(i + 1, i + 3);
        if (!/^\d{2}$/.test(twoDigits)) {
          return {
            ok: false,
            status: 400,
            code: "INVALID_RING_TOKEN",
            message: `Invalid two-digit ring label '%${twoDigits}'.`,
          };
        }
        ringNum = Number.parseInt(twoDigits, 10);
        i += 3;
      } else {
        ringNum = Number.parseInt(ch, 10);
        i++;
      }

      const existing = openRings.get(ringNum);
      if (!existing) {
        openRings.set(ringNum, {
          atomIndex: prevAtom,
          explicitOrder: pendingBond ? pendingBond.order : null,
          explicitAromatic: pendingBond ? pendingBond.aromatic : null,
        });
        pendingBond = null;
      } else {
        if (existing.atomIndex === prevAtom) {
          return {
            ok: false,
            status: 400,
            code: "SELF_LOOP_RING",
            message: `Invalid self-loop on ring ${ringNum}.`,
          };
        }
        const a1 = atoms[existing.atomIndex];
        const a2 = atoms[prevAtom];
        if (!a1 || !a2) {
          return {
            ok: false,
            status: 400,
            code: "INTERNAL_RING_ERROR",
            message: "Unable to resolve ring closure atoms.",
          };
        }

        let order: number;
        let aromatic: boolean;
        if (existing.explicitOrder !== null && pendingBond !== null) {
          if (existing.explicitOrder !== pendingBond.order) {
            return {
              ok: false,
              status: 400,
              code: "RING_BOND_MISMATCH",
              message: `Conflicting bond orders on ring closure ${ringNum}.`,
            };
          }
          order = pendingBond.order;
          aromatic = pendingBond.aromatic;
        } else if (existing.explicitOrder !== null) {
          order = existing.explicitOrder;
          aromatic = existing.explicitAromatic ?? false;
        } else if (pendingBond !== null) {
          order = pendingBond.order;
          aromatic = pendingBond.aromatic;
        } else if (a1.aromatic && a2.aromatic) {
          order = 1.5;
          aromatic = true;
        } else {
          order = 1;
          aromatic = false;
        }

        bonds.push({ from: existing.atomIndex, to: prevAtom, order, aromatic });
        openRings.delete(ringNum);
        ringCount++;
        pendingBond = null;
      }
      continue;
    }

    // Atom token: bracketed `[...]` or organic subset
    let parsedElement: AllowedElement;
    let aromatic = false;
    let bracketed = false;
    let explicitH = 0;
    let formalCharge = 0;
    let isotope: number | null = null;

    if (ch === "[") {
      const closeIdx = smiles.indexOf("]", i + 1);
      if (closeIdx === -1) {
        return {
          ok: false,
          status: 400,
          code: "UNCLOSED_BRACKET",
          message: "Unclosed atom bracket '[' in SMILES.",
        };
      }
      const inside = smiles.slice(i + 1, closeIdx);
      const match = BRACKET_ATOM_RE.exec(inside);
      if (!match || !match[2]) {
        return {
          ok: false,
          status: 422,
          code: "UNSUPPORTED_BRACKET_ATOM",
          message: `Unsupported or malformed bracket atom '[${inside}]'.`,
        };
      }
      isotope = match[1] ? Number.parseInt(match[1], 10) : null;
      const norm = normalizeAromaticSymbol(match[2]);
      if (!isAllowedElement(norm.element)) {
        return {
          ok: false,
          status: 422,
          code: "UNSUPPORTED_ELEMENT",
          message: `Element '${norm.element}' is outside closed-shell CNS medicinal organic space (allowed: H, C, N, O, F, P, S, Cl, Br, I).`,
          details: { rejected_element: norm.element },
        };
      }
      parsedElement = norm.element;
      aromatic = norm.aromatic;
      bracketed = true;
      if (match[4]) {
        explicitH = match[5] ? Number.parseInt(match[5], 10) : 1;
      }
      const chargeVal = parseFormalCharge(match[6]);
      if (chargeVal === null) {
        return {
          ok: false,
          status: 400,
          code: "INVALID_CHARGE",
          message: `Invalid formal charge syntax in '[${inside}]'.`,
        };
      }
      formalCharge = chargeVal;
      i = closeIdx + 1;
    } else {
      // Unbracketed organic subset
      const twoChar = smiles.slice(i, i + 2);
      let sym: string;
      if (twoChar === "Cl" || twoChar === "Br") {
        sym = twoChar;
        i += 2;
      } else {
        sym = ch;
        i += 1;
      }

      if (sym === "B" || sym === "b") {
        return {
          ok: false,
          status: 422,
          code: "UNSUPPORTED_ELEMENT",
          message:
            "Element 'B' (boron) is outside the closed-shell CNS organic basis whitelist (H, C, N, O, F, P, S, Cl, Br, I).",
          details: { rejected_element: "B" },
        };
      }
      const norm = normalizeAromaticSymbol(sym);
      if (
        !isAllowedElement(norm.element) ||
        norm.element === "H" // Bare unbracketed H is non-standard SMILES
      ) {
        return {
          ok: false,
          status: 400,
          code: "INVALID_ATOM_TOKEN",
          message: `Unrecognized SMILES atom token '${sym}' at index ${i - sym.length}.`,
        };
      }
      parsedElement = norm.element;
      aromatic = norm.aromatic;
    }

    const atomIdx = atoms.length;
    atoms.push({
      index: atomIdx,
      element: parsedElement,
      aromatic,
      bracketed,
      explicitH,
      formalCharge,
      isotope,
      implicitH: 0,
    });

    if (prevAtom !== null) {
      const parent = atoms[prevAtom];
      if (!parent) {
        return {
          ok: false,
          status: 400,
          code: "INTERNAL_GRAPH_ERROR",
          message: "Failed to link adjacent SMILES atoms.",
        };
      }
      let order: number;
      let bondAromatic: boolean;
      if (pendingBond !== null) {
        order = pendingBond.order;
        bondAromatic = pendingBond.aromatic;
      } else if (parent.aromatic && aromatic) {
        order = 1.5;
        bondAromatic = true;
      } else {
        order = 1;
        bondAromatic = false;
      }
      bonds.push({ from: prevAtom, to: atomIdx, order, aromatic: bondAromatic });
    } else if (pendingBond !== null) {
      return {
        ok: false,
        status: 400,
        code: "LEADING_BOND",
        message: "SMILES starts with a bond symbol before any atom.",
      };
    }

    prevAtom = atomIdx;
    pendingBond = null;
  }

  if (branchStack.length > 0) {
    return {
      ok: false,
      status: 400,
      code: "UNBALANCED_BRANCH",
      message: "SMILES has unclosed branch parenthesis '('.",
    };
  }
  if (openRings.size > 0) {
    return {
      ok: false,
      status: 400,
      code: "UNCLOSED_RING",
      message: `SMILES has unclosed ring closure(s): ${Array.from(openRings.keys()).join(", ")}.`,
    };
  }
  if (pendingBond !== null) {
    return {
      ok: false,
      status: 400,
      code: "TRAILING_BOND",
      message: "SMILES ends with a dangling bond symbol.",
    };
  }

  // Build adjacency list
  const adj: Array<Array<{ neighbor: number; order: number; aromatic: boolean }>> = Array.from(
    { length: atoms.length },
    () => [],
  );
  for (const b of bonds) {
    adj[b.from]?.push({ neighbor: b.to, order: b.order, aromatic: b.aromatic });
    adj[b.to]?.push({ neighbor: b.from, order: b.order, aromatic: b.aromatic });
  }

  // Validate Heavy Atom Count (HAC <= 38) early
  let hac = 0;
  let aromaticAtomCount = 0;
  for (const a of atoms) {
    if (a.element !== "H") hac++;
    if (a.aromatic) aromaticAtomCount++;
  }
  if (hac === 0) {
    return {
      ok: false,
      status: 422,
      code: "NO_HEAVY_ATOMS",
      message: "Ligand must contain at least one heavy atom.",
    };
  }
  if (hac > MAX_CNS_HAC) {
    return {
      ok: false,
      status: 422,
      code: "CNS_HAC_EXCEEDED",
      message: `Outside CNS chemical space: Heavy Atom Count (HAC=${hac}) exceeds cap of ${MAX_CNS_HAC} (protects O(N^3-N^4) DFT queue from macrocycles/buckyballs).`,
      details: { hac, max_hac: MAX_CNS_HAC },
    };
  }

  if (aromaticAtomCount > 0 && (ringCount === 0 || aromaticAtomCount < 5)) {
    return {
      ok: false,
      status: 422,
      code: "INVALID_AROMATICITY",
      message:
        "Broken Kekule/aromatic system: aromatic atoms require a valid closed >=5-membered aromatic ring.",
    };
  }

  // Compute valences, implicit hydrogens, formula, MW, and electron parity
  const elemCounts: Record<AllowedElement, number> = {
    H: 0,
    C: 0,
    N: 0,
    O: 0,
    F: 0,
    P: 0,
    S: 0,
    Cl: 0,
    Br: 0,
    I: 0,
  };

  let mw = 0;
  let netCharge = 0;
  let totalElectrons = 0;

  for (let idx = 0; idx < atoms.length; idx++) {
    const atom = atoms[idx];
    const edges = adj[idx];
    if (!atom || !edges) continue;

    let aromBondCount = 0;
    let exocyclicOrderSum = 0;
    let totalOrderSum = 0;
    for (const e of edges) {
      totalOrderSum += e.order;
      if (e.aromatic) {
        aromBondCount++;
      } else {
        exocyclicOrderSum += e.order;
      }
    }

    if (atom.bracketed) {
      // Bracketed atoms have explicit hydrogen counts specified directly
      atom.implicitH = 0;
      const effectiveValence = Math.ceil(totalOrderSum) + atom.explicitH;
      const maxAllowed =
        atom.element === "C"
          ? 4
          : atom.element === "O"
            ? 3
            : atom.element === "N" || atom.element === "P"
              ? 5
              : atom.element === "S"
                ? 6
                : 1;
      if (effectiveValence > maxAllowed + Math.abs(atom.formalCharge)) {
        return {
          ok: false,
          status: 422,
          code: "VALENCE_VIOLATION",
          message: `Broken valence on bracketed atom '${atom.element}' (valence=${effectiveValence}).`,
        };
      }
    } else if (atom.aromatic) {
      if (atom.element === "C") {
        // Exocyclic double-bonded aromatic carbons (e.g. caffeine, uracil, coumarin `c(=O)`)
        // use 2 ring sigma bonds + exocyclic double bond = valence 4 (0 implicit H).
        const hasExocyclicDouble = edges.some((e) => !e.aromatic && e.order === 2);
        const usedValence =
          hasExocyclicDouble && aromBondCount === 2
            ? 2 + exocyclicOrderSum
            : aromBondCount >= 3
              ? 4 + exocyclicOrderSum
              : 3 + exocyclicOrderSum;
        if (usedValence > 4) {
          return {
            ok: false,
            status: 422,
            code: "VALENCE_VIOLATION",
            message: "Broken aromatic carbon valence (exceeds 4).",
          };
        }
        atom.implicitH = Math.max(0, 4 - usedValence);
      } else if (atom.element === "N" || atom.element === "P") {
        // Unbracketed pyridine-like aromatic n/p has 0 implicit H (pyrrole requires [nH])
        if (aromBondCount + exocyclicOrderSum > 5) {
          return {
            ok: false,
            status: 422,
            code: "VALENCE_VIOLATION",
            message: `Broken aromatic '${atom.element}' valence.`,
          };
        }
        atom.implicitH = 0;
      } else {
        // Aromatic o, s (furan, thiophene)
        if (exocyclicOrderSum > 0 && atom.element === "O") {
          return {
            ok: false,
            status: 422,
            code: "VALENCE_VIOLATION",
            message: "Broken aromatic oxygen valence.",
          };
        }
        atom.implicitH = 0;
      }
    } else {
      // Unbracketed aliphatic atom
      const valences = STANDARD_VALENCES[atom.element];
      const roundedSum = Math.round(totalOrderSum);
      const matched = valences.find((v) => v >= roundedSum);
      if (matched === undefined) {
        return {
          ok: false,
          status: 422,
          code: "VALENCE_VIOLATION",
          message: `Broken valence on atom '${atom.element}' (explicit bond order=${roundedSum}).`,
        };
      }
      atom.implicitH = matched - roundedSum;
    }

    const attachedH = atom.element === "H" ? 0 : atom.explicitH + atom.implicitH;
    elemCounts[atom.element] += 1;
    elemCounts.H += attachedH;

    const baseMass = atom.isotope !== null ? atom.isotope : ATOMIC_MASS[atom.element];
    mw += baseMass + attachedH * ATOMIC_MASS.H;
    netCharge += atom.formalCharge;
    totalElectrons += ATOMIC_NUMBER[atom.element] + attachedH;
  }

  totalElectrons -= netCharge;

  // Closed-shell singlet parity check (spin = 0 requires even electron count)
  if (totalElectrons % 2 !== 0) {
    return {
      ok: false,
      status: 422,
      code: "OPEN_SHELL_RADICAL",
      message: `Open-shell radical/odd-electron species rejected (total electrons=${totalElectrons}). Only closed-shell singlet (spin=0) organic ligands are accepted for RKS DFT.`,
      details: { total_electrons: totalElectrons, net_charge: netCharge },
    };
  }

  if (Math.abs(netCharge) > 2) {
    return {
      ok: false,
      status: 422,
      code: "EXCESSIVE_CHARGE",
      message: `Net formal charge (${netCharge}) exceeds CNS continuum-DFT limit (|q| <= 2).`,
      details: { net_charge: netCharge },
    };
  }

  const roundedMw = Math.round(mw * 100) / 100;
  if (roundedMw > MAX_CNS_MW) {
    return {
      ok: false,
      status: 422,
      code: "CNS_MW_EXCEEDED",
      message: `Outside CNS chemical space: Molecular Weight (${roundedMw} Da) exceeds BBB/CNS cap of ${MAX_CNS_MW} Da.`,
      details: { mw: roundedMw, max_mw: MAX_CNS_MW },
    };
  }

  // Graph-based PAINS assay-interference screening
  const painsHit = detectPainsMotif(atoms, adj);
  if (painsHit !== null) {
    return {
      ok: false,
      status: 422,
      code: painsHit.code,
      message: `PAINS gatekeeper rejected ligand: ${painsHit.motif}.`,
    };
  }

  // Fast Ertl TPSA, Wildman-Crippen-inspired cLogP, and Pfizer CNS MPO (0-6) triage
  let hbd = 0;
  let hba = 0;
  let tpsa = 0;
  let clogp = 0;
  let hasBasicAmine = false;
  let hasCarboxylicAcid = false;

  for (let idx = 0; idx < atoms.length; idx++) {
    const atom = atoms[idx];
    const edges = adj[idx] ?? [];
    if (!atom) continue;
    const hCount = atom.explicitH + atom.implicitH;

    if (atom.element === "N" || atom.element === "O") {
      hba++;
      if (hCount > 0) hbd += hCount;
    }

    if (atom.element === "C") {
      clogp += atom.aromatic ? 0.29 : 0.18;
    } else if (atom.element === "F") {
      clogp += 0.35;
    } else if (atom.element === "Cl") {
      clogp += 0.65;
    } else if (atom.element === "Br") {
      clogp += 0.85;
    } else if (atom.element === "I") {
      clogp += 1.05;
    } else if (atom.element === "S") {
      clogp += atom.aromatic ? 0.45 : 0.35;
      tpsa += atom.aromatic ? 28.2 : 19.2;
    } else if (atom.element === "P") {
      clogp -= 0.2;
      tpsa += 13.6;
    } else if (atom.element === "O") {
      const isDoubleO = edges.some((e) => e.order === 2);
      if (isDoubleO) {
        tpsa += 17.07;
        clogp -= 0.35;
      } else if (hCount > 0) {
        tpsa += 20.23;
        clogp -= 0.55;
        // Detect carboxylic acid C(=O)OH
        const onCarbonyl = edges.some((e) => {
          const nb = atoms[e.neighbor];
          const nbAdj = adj[e.neighbor] ?? [];
          return (
            nb?.element === "C" &&
            nbAdj.some((ne) => atoms[ne.neighbor]?.element === "O" && ne.order === 2)
          );
        });
        if (onCarbonyl) hasCarboxylicAcid = true;
      } else {
        tpsa += atom.aromatic ? 13.14 : 9.23;
        clogp -= 0.15;
      }
    } else if (atom.element === "N") {
      clogp -= 0.52;
      if (atom.aromatic) {
        tpsa += hCount > 0 ? 15.79 : 12.89;
      } else if (edges.some((e) => e.order === 3)) {
        tpsa += 23.79; // nitrile
      } else if (hCount >= 2) {
        tpsa += 26.02;
      } else if (hCount === 1) {
        tpsa += 12.03;
      } else {
        tpsa += 3.24;
      }
      // Identify basic aliphatic amine (not amide, not aromatic, not nitro)
      if (!atom.aromatic && !edges.some((e) => e.order >= 2)) {
        const isAmideOrAniline = edges.some((e) => {
          const nb = atoms[e.neighbor];
          if (!nb) return false;
          if (nb.aromatic) return true;
          const nbAdj = adj[e.neighbor] ?? [];
          return (
            nb.element === "C" &&
            nbAdj.some(
              (ne) =>
                (atoms[ne.neighbor]?.element === "O" || atoms[ne.neighbor]?.element === "S") &&
                ne.order === 2,
            )
          );
        });
        if (!isAmideOrAniline) {
          hasBasicAmine = true;
        }
      }
    }
  }

  // Hill-system molecular formula (C first, H second, then alphabetical)
  const hillOrder: readonly AllowedElement[] = ["C", "H", "Br", "Cl", "F", "I", "N", "O", "P", "S"];
  let formula = "";
  for (const el of hillOrder) {
    const count = elemCounts[el];
    if (count > 0) {
      formula += count === 1 ? el : `${el}${count}`;
    }
  }

  const roundedTpsa = Math.round(tpsa * 10) / 10;
  const roundedClogp = Math.round(clamp(clogp, -3.5, 8.5) * 100) / 100;
  const estClogd = roundedClogp - (hasBasicAmine ? 1.2 : 0) - (hasCarboxylicAcid ? 2.5 : 0);
  const estPka = hasBasicAmine ? 9.1 : 6.0;

  // Wager et al. (2010) Pfizer CNS MPO desirability components (each 0..1, sum 0..6)
  const dClogp = linearDesirability(roundedClogp, 3.0, 5.0);
  const dClogd = linearDesirability(estClogd, 2.0, 4.0);
  const dMw = linearDesirability(roundedMw, 360.0, 500.0);
  const dHbd = linearDesirability(hbd, 0.5, 3.5);
  const dPka = linearDesirability(estPka, 8.0, 10.0);
  let dTpsa: number;
  if (roundedTpsa >= 40 && roundedTpsa <= 90) {
    dTpsa = 1.0;
  } else if (roundedTpsa < 40) {
    dTpsa = roundedTpsa <= 20 ? 0.0 : (roundedTpsa - 20) / 20;
  } else {
    dTpsa = roundedTpsa >= 120 ? 0.0 : (120 - roundedTpsa) / 30;
  }

  const cnsMpo =
    Math.round(clamp(dClogp + dClogd + dMw + dHbd + dPka + dTpsa, 0, 6) * 100) / 100;

  return {
    ok: true,
    analysis: {
      smiles,
      hac,
      mw: roundedMw,
      formula,
      netCharge,
      totalElectrons,
      hbd,
      hba,
      tpsa: roundedTpsa,
      clogp: roundedClogp,
      cnsMpo,
      aromaticAtomCount,
      ringCount,
      elapsedMs: Math.round((performance.now() - t0) * 1000) / 1000,
    },
  };
}

// ============================================================================
// Request Body Parsers & Validators (< 2 ms)
// ============================================================================

export function validatePdbId(raw: string): string | null {
  const upper = raw.trim().toUpperCase();
  return PDB_ID_RE.test(upper) ? upper : null;
}

export function validateInchiKey(raw: string): string | null {
  const upper = raw.trim().toUpperCase();
  return INCHIKEY_RE.test(upper) ? upper : null;
}

async function parseJsonObject(
  request: Request,
): Promise<{ ok: true; body: Record<string, unknown> } | GatekeeperFailure> {
  const contentLength = request.headers.get("Content-Length");
  if (contentLength !== null) {
    const declared = Number.parseInt(contentLength, 10);
    if (Number.isFinite(declared) && declared > MAX_JSON_BODY_BYTES) {
      return {
        ok: false,
        status: 413,
        code: "PAYLOAD_TOO_LARGE",
        message: `Request body exceeds maximum size (${MAX_JSON_BODY_BYTES} bytes).`,
      };
    }
  }

  let rawText: string;
  try {
    rawText = await request.text();
  } catch {
    return {
      ok: false,
      status: 400,
      code: "UNREADABLE_BODY",
      message: "Could not read JSON request body.",
    };
  }

  if (rawText.length > MAX_JSON_BODY_BYTES) {
    return {
      ok: false,
      status: 413,
      code: "PAYLOAD_TOO_LARGE",
      message: `Request body exceeds maximum size (${MAX_JSON_BODY_BYTES} bytes).`,
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    return {
      ok: false,
      status: 400,
      code: "INVALID_JSON",
      message: "Request body must be valid JSON.",
    };
  }

  if (!isRecord(parsed)) {
    return {
      ok: false,
      status: 400,
      code: "JSON_OBJECT_REQUIRED",
      message: "Request body must be a JSON object.",
    };
  }

  return { ok: true, body: parsed };
}

function validateCommonMetadata(
  body: Record<string, unknown>,
  defaultMethod: string,
):
  | {
      ok: true;
      inchikey: string | null;
      molName: string | null;
      methodBasis: string;
      orcidCredit: string | null;
      researcherName: string | null;
      forceRecompute: boolean;
    }
  | GatekeeperFailure {
  const rawInchiKey = readOptionalString(body, ["inchikey", "inchi_key", "InChIKey"]);
  let inchikey: string | null = null;
  if (rawInchiKey !== null) {
    inchikey = validateInchiKey(rawInchiKey);
    if (inchikey === null) {
      return {
        ok: false,
        status: 400,
        code: "INVALID_INCHIKEY",
        message: "Provided InChIKey must match standard 27-character format (XXXXXXXXXXXXXX-YYYYYYYYYY-Z).",
      };
    }
  }

  const rawOrcid = readOptionalString(body, ["orcid_credit", "orcid"]);
  let orcidCredit: string | null = null;
  if (rawOrcid !== null) {
    const cleanedOrcid = rawOrcid.replace(/^https?:\/\/orcid\.org\//i, "").trim().toUpperCase();
    if (!ORCID_RE.test(cleanedOrcid)) {
      return {
        ok: false,
        status: 400,
        code: "INVALID_ORCID",
        message: "ORCID must match format 0000-0000-0000-000X.",
      };
    }
    orcidCredit = cleanedOrcid;
  }

  const rawMethod = readOptionalString(body, ["method_basis", "method"]) ?? defaultMethod;
  if (!METHOD_BASIS_RE.test(rawMethod)) {
    return {
      ok: false,
      status: 400,
      code: "INVALID_METHOD_BASIS",
      message: "method_basis contains invalid characters or exceeds 80 characters.",
    };
  }

  return {
    ok: true,
    inchikey,
    molName: sanitizeDisplayText(readOptionalString(body, ["mol_name", "name", "ligand_name"]), 96),
    methodBasis: rawMethod,
    orcidCredit,
    researcherName: sanitizeDisplayText(
      readOptionalString(body, ["researcher_name", "author", "lab_name"]),
      80,
    ),
    forceRecompute: readOptionalBoolean(body, ["force_recompute"], false),
  };
}

export async function validateDftRequest(
  request: Request,
  env: Env,
): Promise<ValidatedDftRequest | GatekeeperFailure> {
  const jsonResult = await parseJsonObject(request);
  if (!jsonResult.ok) return jsonResult;
  const { body } = jsonResult;

  const rawSmiles = readOptionalString(body, ["smiles", "SMILES"]);
  if (rawSmiles === null) {
    return {
      ok: false,
      status: 400,
      code: "MISSING_SMILES",
      message: "Field 'smiles' is required.",
    };
  }

  const analysisResult = analyzeSmiles(rawSmiles);
  if (!analysisResult.ok) return analysisResult;

  const rawPdb = readOptionalString(body, ["pdb_id", "pdbId"]);
  let pdbId = "NONE";
  if (rawPdb !== null && rawPdb.toUpperCase() !== "NONE") {
    const validatedPdb = validatePdbId(rawPdb);
    if (validatedPdb === null) {
      return {
        ok: false,
        status: 400,
        code: "INVALID_PDB_ID",
        message: "Optional 'pdb_id' must be a valid 4-character RCSB PDB ID (e.g. 5VPE, 7CN1).",
      };
    }
    pdbId = validatedPdb;
  }

  const meta = validateCommonMetadata(
    body,
    env.DEFAULT_METHOD || "df-wB97X-D/def2-SVP+ddCOSMO",
  );
  if (!meta.ok) return meta;

  const rawGrid = readOptionalNumber(body, ["cube_grid_spacing", "grid_spacing"]);
  const cubeGridSpacing =
    rawGrid === null ? 0.25 : Math.round(clamp(rawGrid, 0.18, 0.5) * 100) / 100;

  return {
    ok: true,
    smiles: analysisResult.analysis.smiles,
    analysis: analysisResult.analysis,
    inchikey: meta.inchikey,
    molName: meta.molName,
    pdbId,
    methodBasis: meta.methodBasis,
    covalentAdduct: readOptionalBoolean(
      body,
      ["compute_covalent_delta_e", "covalent_adduct", "compute_covalent", "thiol_adduct"],
      true,
    ),
    includeCubes: readOptionalBoolean(body, ["include_cubes", "cubes"], true),
    cubeGridSpacing,
    preferFederated: readOptionalBoolean(body, ["prefer_federated"], true),
    forceRecompute: meta.forceRecompute,
    orcidCredit: meta.orcidCredit,
    researcherName: meta.researcherName,
  };
}

export async function validateDockRequest(
  request: Request,
  env: Env,
): Promise<ValidatedDockRequest | GatekeeperFailure> {
  const jsonResult = await parseJsonObject(request);
  if (!jsonResult.ok) return jsonResult;
  const { body } = jsonResult;

  const rawSmiles = readOptionalString(body, ["smiles", "SMILES"]);
  if (rawSmiles === null) {
    return {
      ok: false,
      status: 400,
      code: "MISSING_SMILES",
      message: "Field 'smiles' is required.",
    };
  }

  const analysisResult = analyzeSmiles(rawSmiles);
  if (!analysisResult.ok) return analysisResult;

  const rawPdb = readOptionalString(body, ["pdb_id", "pdbId"]);
  if (rawPdb === null) {
    return {
      ok: false,
      status: 400,
      code: "MISSING_PDB_ID",
      message: "Field 'pdb_id' (4-character RCSB PDB ID, e.g. 5VPE) is required for docking.",
    };
  }
  const pdbId = validatePdbId(rawPdb);
  if (pdbId === null) {
    return {
      ok: false,
      status: 400,
      code: "INVALID_PDB_ID",
      message: "Field 'pdb_id' must be a valid 4-character RCSB PDB ID (e.g. 5VPE, 1HSG, 7CN1).",
    };
  }

  const rawCovRes = readOptionalString(body, ["covalent_target_res", "covalent_res"]);
  let covalentTargetRes: string | null = null;
  if (rawCovRes !== null) {
    if (!COVALENT_RES_RE.test(rawCovRes)) {
      return {
        ok: false,
        status: 400,
        code: "INVALID_COVALENT_TARGET",
        message: "Field 'covalent_target_res' must be a residue identifier like 'A:CYS172' or 'CYS172'.",
      };
    }
    covalentTargetRes = rawCovRes;
  }

  const rawExh = readOptionalNumber(body, ["exhaustiveness"]);
  const exhaustiveness = rawExh === null ? 6 : Math.round(clamp(rawExh, 2, 10));

  const boxCenter = readOptionalTuple3(body, "box_center");
  if (boxCenter === "invalid") {
    return {
      ok: false,
      status: 400,
      code: "INVALID_BOX_CENTER",
      message: "Field 'box_center' must be a 3-number [x, y, z] coordinate tuple.",
    };
  }
  const boxSize = readOptionalTuple3(body, "box_size");
  if (boxSize === "invalid") {
    return {
      ok: false,
      status: 400,
      code: "INVALID_BOX_SIZE",
      message: "Field 'box_size' must be a 3-number [dx, dy, dz] dimension tuple.",
    };
  }

  const meta = validateCommonMetadata(body, "autodock-vina-1.2");
  if (!meta.ok) return meta;

  // Allow docking to inherit default method_basis if caller didn't specify one
  const methodBasis =
    readOptionalString(body, ["method_basis", "method"]) ??
    (env.DEFAULT_METHOD ? `vina-1.2+${env.DEFAULT_METHOD}` : "autodock-vina-1.2");

  return {
    ok: true,
    smiles: analysisResult.analysis.smiles,
    analysis: analysisResult.analysis,
    inchikey: meta.inchikey,
    molName: meta.molName,
    pdbId,
    methodBasis,
    covalentTargetRes,
    exhaustiveness,
    boxCenter,
    boxSize,
    forceRecompute: meta.forceRecompute,
    orcidCredit: meta.orcidCredit,
    researcherName: meta.researcherName,
  };
}

// ============================================================================
// Cloudflare Edge Cache API (`caches.default`) Per-IP Token-Bucket Rate Limiter
// Applied ONLY to novel uncached compute submits — R2/Atlas reads stay unlimited!
// ============================================================================

interface TokenBucketState {
  readonly tokens: number;
  readonly lastRefillMs: number;
}

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseBucketState(value: unknown): TokenBucketState | null {
  if (!isRecord(value)) return null;
  const tokens = value.tokens;
  const lastRefillMs = value.lastRefillMs;
  if (
    typeof tokens !== "number" ||
    !Number.isFinite(tokens) ||
    typeof lastRefillMs !== "number" ||
    !Number.isFinite(lastRefillMs)
  ) {
    return null;
  }
  return { tokens, lastRefillMs };
}

export async function consumeNovelComputeToken(
  request: Request,
  env: Env,
  cnsMpo: number,
): Promise<RateLimitDecision> {
  const baseMaxTokens = parsePositiveInt(env.RATE_LIMIT_MAX_TOKENS, 8);
  const refillSeconds = parsePositiveInt(env.RATE_LIMIT_REFILL_SECONDS, 120);

  // MPO priority queue shaping: CNS-like compounds (MPO >= 3.0) receive full burst capacity
  const priorityTier: "cns_fast_lane" | "standard" = cnsMpo >= 3.0 ? "cns_fast_lane" : "standard";
  const limit =
    priorityTier === "cns_fast_lane" ? baseMaxTokens : Math.max(2, Math.floor(baseMaxTokens / 2));

  const clientIp =
    request.headers.get("CF-Connecting-IP") ??
    request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() ??
    "local-dev";
  const ipHash = await sha256Hex(`rprime-rl-v1:${clientIp}`);
  const bucketKey = new Request(`https://ratelimit.rprime.internal/v1/bucket/${ipHash}`, {
    method: "GET",
  });

  const nowMs = Date.now();
  const cache = caches.default;

  let currentTokens = limit;
  try {
    const cached = await cache.match(bucketKey);
    if (cached) {
      const parsed: unknown = await cached.json();
      const state = parseBucketState(parsed);
      if (state !== null) {
        const elapsedSec = Math.max(0, (nowMs - state.lastRefillMs) / 1000);
        const refilled = state.tokens + elapsedSec / refillSeconds;
        currentTokens = Math.min(limit, refilled);
      }
    }
  } catch {
    // Fail open on transient cache read error rather than blocking legitimate science
    currentTokens = limit;
  }

  if (currentTokens < 1) {
    const retryAfterSeconds = Math.max(1, Math.ceil((1 - currentTokens) * refillSeconds));
    return {
      allowed: false,
      remaining: 0,
      limit,
      retryAfterSeconds,
      priorityTier,
    };
  }

  const nextTokens = Math.max(0, currentTokens - 1);
  const nextState: TokenBucketState = {
    tokens: nextTokens,
    lastRefillMs: nowMs,
  };

  const ttlSeconds = Math.max(300, limit * refillSeconds);
  try {
    await cache.put(
      bucketKey,
      new Response(JSON.stringify(nextState), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": `public, max-age=${ttlSeconds}`,
        },
      }),
    );
  } catch {
    // Best-effort cache write in edge PoP
  }

  return {
    allowed: true,
    remaining: Math.floor(nextTokens),
    limit,
    retryAfterSeconds: 0,
    priorityTier,
  };
}
