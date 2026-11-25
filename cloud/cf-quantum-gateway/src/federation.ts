/**
 * Live Open-Science Federation Layer:
 *  1. PubChem PUG-REST (`pubchem.ncbi.nlm.nih.gov`) — Resolves SMILES -> CID & InChIKey
 *  2. MolSSI QCArchive (`api.qcarchive.molssi.org`) — Checks pre-solved Kohn-Sham DFT
 *     records (SPICE / OpenFF) under a strict 2500 ms fail-fast timeout budget.
 */

import { isRecord, readOptionalNumber, readOptionalString, validateInchiKey } from "./gatekeeper";

export interface PubChemResolution {
  readonly status: "hit" | "miss" | "timeout" | "error";
  readonly cid: number | null;
  readonly inchikey: string | null;
  readonly canonicalSmiles: string | null;
  readonly molecularFormula: string | null;
  readonly molecularWeight: number | null;
  readonly title: string | null;
  readonly latencyMs: number;
}

export interface QCArchiveRecord {
  readonly recordId: string;
  readonly moleculeId: string;
  readonly datasetHint: string;
  readonly program: string;
  readonly method: string;
  readonly basis: string;
  readonly methodBasis: string;
  readonly scfEnergyHa: number | null;
  readonly homoEv: number | null;
  readonly lumoEv: number | null;
  readonly dipoleDebye: number | null;
  readonly parrOmegaEv: number | null;
}

export interface QCArchiveLookup {
  readonly status: "hit" | "miss" | "timeout" | "error";
  readonly record: QCArchiveRecord | null;
  readonly latencyMs: number;
}

export interface FederationResult {
  readonly pubchem: PubChemResolution;
  readonly qcarchive: QCArchiveLookup | null;
}

const DEFAULT_FEDERATION_TIMEOUT_MS = 2500;
const HARTREE_TO_EV = 27.211386245988;
const AU_DIPOLE_TO_DEBYE = 2.541746473;

const PREFERRED_DFT_METHODS: readonly string[] = [
  "wb97m-d3bj",
  "wb97x-d",
  "wb97x-d3",
  "wb97x-v",
  "b3lyp-d3bj",
  "b3lyp",
  "pbe0-d3bj",
];

function isAbortOrTimeout(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  return err.name === "TimeoutError" || err.name === "AbortError";
}

/**
 * Resolve SMILES -> PubChem CID & standard 27-char InChIKey via PubChem PUG-REST POST.
 * Using POST form-encoding avoids URL-encoding hazards with '#', '/', '\', and '+' in SMILES.
 */
export async function resolveSmilesViaPubChem(
  smiles: string,
  timeoutMs: number = DEFAULT_FEDERATION_TIMEOUT_MS,
): Promise<PubChemResolution> {
  const t0 = performance.now();
  const endpoint =
    "https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/smiles/property/InChIKey,CanonicalSMILES,MolecularFormula,MolecularWeight,Title/JSON";

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
        "User-Agent": "RPrime-Quantum-Gateway/1.0 (https://neurosciencerprime.github.io)",
      },
      body: new URLSearchParams({ smiles }).toString(),
      signal: AbortSignal.timeout(Math.max(400, timeoutMs)),
    });

    const latencyMs = Math.round(performance.now() - t0);
    if (!response.ok) {
      return {
        status: response.status === 404 ? "miss" : "error",
        cid: null,
        inchikey: null,
        canonicalSmiles: null,
        molecularFormula: null,
        molecularWeight: null,
        title: null,
        latencyMs,
      };
    }

    const payload: unknown = await response.json();
    if (!isRecord(payload) || !isRecord(payload.PropertyTable)) {
      return {
        status: "miss",
        cid: null,
        inchikey: null,
        canonicalSmiles: null,
        molecularFormula: null,
        molecularWeight: null,
        title: null,
        latencyMs,
      };
    }

    const props = payload.PropertyTable.Properties;
    if (!Array.isArray(props) || props.length === 0) {
      return {
        status: "miss",
        cid: null,
        inchikey: null,
        canonicalSmiles: null,
        molecularFormula: null,
        molecularWeight: null,
        title: null,
        latencyMs,
      };
    }

    const firstRaw: unknown = props[0];
    if (!isRecord(firstRaw)) {
      return {
        status: "miss",
        cid: null,
        inchikey: null,
        canonicalSmiles: null,
        molecularFormula: null,
        molecularWeight: null,
        title: null,
        latencyMs,
      };
    }

    const first = firstRaw;
    const rawCid = readOptionalNumber(first, ["CID"]);
    const cid = rawCid !== null && rawCid > 0 ? Math.trunc(rawCid) : null;
    const rawKey = readOptionalString(first, ["InChIKey"]);
    const inchikey = rawKey !== null ? validateInchiKey(rawKey) : null;
    const canonicalSmiles = readOptionalString(first, [
      "CanonicalSMILES",
      "ConnectivitySMILES",
      "SMILES",
      "IsomericSMILES",
    ]);
    const molecularFormula = readOptionalString(first, ["MolecularFormula"]);
    const molecularWeight = readOptionalNumber(first, ["MolecularWeight"]);
    const title = readOptionalString(first, ["Title"]);

    return {
      status: inchikey !== null || cid !== null ? "hit" : "miss",
      cid,
      inchikey,
      canonicalSmiles,
      molecularFormula,
      molecularWeight,
      title,
      latencyMs,
    };
  } catch (err: unknown) {
    return {
      status: isAbortOrTimeout(err) ? "timeout" : "error",
      cid: null,
      inchikey: null,
      canonicalSmiles: null,
      molecularFormula: null,
      molecularWeight: null,
      title: null,
      latencyMs: Math.round(performance.now() - t0),
    };
  }
}

function extractArrayData(payload: unknown): unknown[] {
  if (Array.isArray(payload)) {
    return payload;
  }
  if (isRecord(payload) && Array.isArray(payload.data)) {
    return payload.data;
  }
  return [];
}

function extractDipoleDebye(props: Record<string, unknown>): number | null {
  const dipole = props.scf_dipole ?? props.current_dipole ?? props.dipole;
  if (Array.isArray(dipole) && dipole.length === 3) {
    const x = dipole[0];
    const y = dipole[1];
    const z = dipole[2];
    if (
      typeof x === "number" &&
      typeof y === "number" &&
      typeof z === "number" &&
      Number.isFinite(x) &&
      Number.isFinite(y) &&
      Number.isFinite(z)
    ) {
      const magAu = Math.sqrt(x * x + y * y + z * z);
      return Math.round(magAu * AU_DIPOLE_TO_DEBYE * 1000) / 1000;
    }
  }
  const direct = readOptionalNumber(props, ["dipole_debye", "scf_dipole_magnitude"]);
  return direct !== null ? Math.round(direct * 1000) / 1000 : null;
}

function methodPriorityScore(method: string, basis: string): number {
  const m = method.toLowerCase();
  const b = basis.toLowerCase();
  const idx = PREFERRED_DFT_METHODS.findIndex((pref) => m.includes(pref));
  const methodScore = idx >= 0 ? (PREFERRED_DFT_METHODS.length - idx) * 10 : 0;
  let basisScore = 0;
  if (b.includes("def2-tzvppd") || b.includes("def2-tzvp")) basisScore = 5;
  else if (b.includes("def2-svp")) basisScore = 4;
  else if (b.includes("dzvp")) basisScore = 3;
  return methodScore + basisScore;
}

function parseQCArchiveSinglepoint(raw: unknown): { score: number; record: QCArchiveRecord } | null {
  if (!isRecord(raw)) return null;

  const status = readOptionalString(raw, ["status"])?.toLowerCase();
  if (status !== undefined && status !== "complete") {
    return null;
  }

  const spec = isRecord(raw.specification) ? raw.specification : raw;
  const method = readOptionalString(spec, ["method"]);
  const basis = readOptionalString(spec, ["basis"]) ?? "unknown-basis";
  const program = readOptionalString(spec, ["program"]) ?? "psi4";
  if (method === null) return null;

  const score = methodPriorityScore(method, basis);
  // Skip force-field / semi-empirical records (only accept genuine Kohn-Sham DFT)
  if (score === 0) return null;

  const props = isRecord(raw.properties) ? raw.properties : {};
  const extras = isRecord(raw.extras) ? raw.extras : {};

  const scfEnergyHa =
    readOptionalNumber(props, ["return_energy", "scf_total_energy", "current_energy"]) ??
    readOptionalNumber(raw, ["return_result", "energy"]);

  let homoEv = readOptionalNumber(props, ["homo_ev", "HOMO_eV"]);
  let lumoEv = readOptionalNumber(props, ["lumo_ev", "LUMO_eV"]);

  if (homoEv === null) {
    const homoHa =
      readOptionalNumber(props, ["scf_homo_energy", "homo_energy_ha"]) ??
      readOptionalNumber(extras, ["homo_energy_ha"]);
    if (homoHa !== null) homoEv = Math.round(homoHa * HARTREE_TO_EV * 1000) / 1000;
  }
  if (lumoEv === null) {
    const lumoHa =
      readOptionalNumber(props, ["scf_lumo_energy", "lumo_energy_ha"]) ??
      readOptionalNumber(extras, ["lumo_energy_ha"]);
    if (lumoHa !== null) lumoEv = Math.round(lumoHa * HARTREE_TO_EV * 1000) / 1000;
  }

  let parrOmegaEv: number | null = null;
  if (homoEv !== null && lumoEv !== null && lumoEv > homoEv) {
    const mu = 0.5 * (homoEv + lumoEv);
    const eta = lumoEv - homoEv;
    parrOmegaEv = Math.round(((mu * mu) / (2 * eta)) * 1000) / 1000;
  }

  const recordIdVal = raw.id;
  const recordId =
    typeof recordIdVal === "string" || typeof recordIdVal === "number"
      ? String(recordIdVal)
      : "unknown";
  const molIdVal = raw.molecule_id ?? raw.molecule;
  const moleculeId =
    typeof molIdVal === "string" || typeof molIdVal === "number" ? String(molIdVal) : "unknown";

  const mLower = method.toLowerCase();
  const bLower = basis.toLowerCase();
  const datasetHint =
    mLower.includes("wb97m-d3bj") && bLower.includes("def2-tzvppd")
      ? "SPICE (wB97M-D3BJ/def2-TZVPPD)"
      : mLower.includes("b3lyp-d3bj") && bLower.includes("dzvp")
        ? "OpenFF (B3LYP-D3BJ/DZVP)"
        : "MolSSI QCArchive DFT";

  return {
    score,
    record: {
      recordId,
      moleculeId,
      datasetHint,
      program,
      method,
      basis,
      methodBasis: `${method}/${basis}`,
      scfEnergyHa,
      homoEv,
      lumoEv,
      dipoleDebye: extractDipoleDebye(props),
      parrOmegaEv,
    },
  };
}

/**
 * Query MolSSI QCArchive (`api.qcarchive.molssi.org`) for pre-solved true Kohn-Sham DFT
 * records (SPICE / OpenFF) strictly bounded by `timeoutMs` (default 2500 ms) so cold
 * misses fail fast without blocking live Modal/HF PySCF compute.
 */
export async function queryQCArchive(
  inchikey: string,
  timeoutMs: number = DEFAULT_FEDERATION_TIMEOUT_MS,
): Promise<QCArchiveLookup> {
  const t0 = performance.now();
  const deadline = t0 + Math.max(500, timeoutMs);
  const baseHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    "User-Agent": "RPrime-Quantum-Gateway/1.0 (https://neurosciencerprime.github.io)",
  };

  try {
    // Step 1: Lookup molecule IDs by standard InChIKey
    const remaining1 = Math.max(300, Math.floor(deadline - performance.now()));
    const molResp = await fetch("https://api.qcarchive.molssi.org/api/v1/molecules/query", {
      method: "POST",
      headers: baseHeaders,
      body: JSON.stringify({
        identifiers: { inchikey },
        limit: 5,
      }),
      signal: AbortSignal.timeout(remaining1),
    });

    if (!molResp.ok) {
      return {
        status: molResp.status === 404 ? "miss" : "error",
        record: null,
        latencyMs: Math.round(performance.now() - t0),
      };
    }

    const molPayload: unknown = await molResp.json();
    const molItems = extractArrayData(molPayload);
    const moleculeIds: Array<string | number> = [];
    for (const item of molItems) {
      if (isRecord(item) && (typeof item.id === "number" || typeof item.id === "string")) {
        moleculeIds.push(item.id);
      }
    }

    if (moleculeIds.length === 0) {
      return {
        status: "miss",
        record: null,
        latencyMs: Math.round(performance.now() - t0),
      };
    }

    // Step 2: Query completed singlepoint Kohn-Sham DFT records within remaining time budget
    const remaining2 = Math.floor(deadline - performance.now());
    if (remaining2 < 350) {
      return {
        status: "timeout",
        record: null,
        latencyMs: Math.round(performance.now() - t0),
      };
    }

    const recResp = await fetch(
      "https://api.qcarchive.molssi.org/api/v1/records/singlepoint/query",
      {
        method: "POST",
        headers: baseHeaders,
        body: JSON.stringify({
          molecule_id: moleculeIds.slice(0, 5),
          status: ["complete"],
          limit: 12,
        }),
        signal: AbortSignal.timeout(remaining2),
      },
    );

    if (!recResp.ok) {
      return {
        status: recResp.status === 404 ? "miss" : "error",
        record: null,
        latencyMs: Math.round(performance.now() - t0),
      };
    }

    const recPayload: unknown = await recResp.json();
    const recItems = extractArrayData(recPayload);
    let best: { score: number; record: QCArchiveRecord } | null = null;
    for (const item of recItems) {
      const candidate = parseQCArchiveSinglepoint(item);
      if (candidate !== null && (best === null || candidate.score > best.score)) {
        best = candidate;
      }
    }

    return {
      status: best !== null ? "hit" : "miss",
      record: best !== null ? best.record : null,
      latencyMs: Math.round(performance.now() - t0),
    };
  } catch (err: unknown) {
    return {
      status: isAbortOrTimeout(err) ? "timeout" : "error",
      record: null,
      latencyMs: Math.round(performance.now() - t0),
    };
  }
}

/**
 * Combined fast open-science federation lookup (PubChem + optional QCArchive).
 */
export async function runOpenScienceFederation(
  smiles: string,
  knownInchiKey: string | null,
  checkQCArchive: boolean,
  timeoutMs: number = DEFAULT_FEDERATION_TIMEOUT_MS,
): Promise<FederationResult> {
  const pubchem = await resolveSmilesViaPubChem(smiles, timeoutMs);
  const resolvedKey = knownInchiKey ?? pubchem.inchikey;

  if (!checkQCArchive || resolvedKey === null) {
    return {
      pubchem,
      qcarchive: null,
    };
  }

  const qcarchive = await queryQCArchive(resolvedKey, timeoutMs);
  return {
    pubchem,
    qcarchive,
  };
}
