/**
 * Praxis domain declaration (optional layer).
 *
 * Contract §6: a `praxis` domain v1 with tables `runs` (key runId),
 * `receipts` (key commandId), and `meta` (key `dump`). Record schemas are
 * permissive on purpose — `z.object({ schemaVersion }).passthrough()` — because
 * the value payloads are the engine's versioned dump records, validated for
 * shape elsewhere; the domain layer only owes a version stamp and rejects
 * non-objects.
 *
 * Why the dependencies are imported lazily: this repository has no local
 * `node_modules`, so `zod` and `@deepseek-ai/dsh-storage-domain` only resolve
 * once the bundle is installed into a DSH profile. A top-level static import
 * would make `src/domain.js` unimportable from the workspace (and from any test
 * run outside a profile). `loadPraxisDomainSpec()` therefore resolves both at
 * call time and returns `null` when they are unavailable; `openDomain()` follows
 * the same contract and returns `null` instead of throwing. The Host wiring
 * (`index.js`) treats `null` as "no storageDomain" and falls back to the
 * file-backed store, which is the supported path today.
 */

export const DOMAIN_NAME = 'praxis';
export const DOMAIN_VERSION = 1;

/** Table names fixed by contract §6. */
export const TABLE_NAMES = Object.freeze({
  runs: 'runs',
  receipts: 'receipts',
  meta: 'meta',
});

/** `meta` singleton key that carries the whole engine dump. */
export const META_DUMP_KEY = 'dump';

/** Version stamped into every stored value. */
export const VALUE_SCHEMA_VERSION = 1;

/**
 * Build the permissive versioned value schema required by contract §6.
 * @param {object} z - The zod namespace (`import('zod').z`).
 * @returns {object} `z.object({...version fields}).passthrough()`
 */
export function versionedValueSchema(z) {
  return z
    .object({
      schemaVersion: z.number().int().nonnegative().default(VALUE_SCHEMA_VERSION),
      domainVersion: z.number().int().nonnegative().default(DOMAIN_VERSION),
    })
    .passthrough();
}

/**
 * Build the full domain spec from already-resolved dependencies. Exported so a
 * profile-side test can assert the declaration without importing the packages
 * inside this module.
 * @param {object} deps
 * @param {object} deps.defineDomain - `defineDomain` from dsh-storage-domain.
 * @param {Function} deps.domainTable - `domainTable` from dsh-storage-domain.
 * @param {object} deps.z - The zod namespace.
 * @returns {object} A validated domain spec.
 */
export function buildDomainSpec({ defineDomain, domainTable, z }) {
  if (typeof defineDomain !== 'function' || typeof domainTable !== 'function') {
    throw new TypeError('buildDomainSpec: defineDomain and domainTable are required');
  }
  const valueSchema = versionedValueSchema(z);
  return defineDomain({
    name: DOMAIN_NAME,
    version: DOMAIN_VERSION,
    tables: {
      [TABLE_NAMES.runs]: domainTable(valueSchema),
      [TABLE_NAMES.receipts]: domainTable(valueSchema),
      [TABLE_NAMES.meta]: domainTable(valueSchema),
    },
  });
}

let specPromise = null;

/**
 * Resolve and memoize the domain spec.
 * @param {object} [options]
 * @param {object} [options.logger] - `{debug,warn}` sink.
 * @returns {Promise<object|null>} The spec, or `null` when the packages do not resolve.
 */
export async function loadPraxisDomainSpec(options = {}) {
  if (specPromise) return specPromise;
  const attempt = (async () => {
    let defineDomain;
    let domainTable;
    let z;
    try {
      const storage = await import('@deepseek-ai/dsh-storage-domain');
      defineDomain = storage.defineDomain;
      domainTable = storage.domainTable;
      const zod = await import('zod');
      z = zod.z ?? zod.default ?? zod;
    } catch (error) {
      options.logger?.debug?.(`praxis.domain.unavailable: ${error?.message ?? String(error)}`);
      return null;
    }
    try {
      return buildDomainSpec({ defineDomain, domainTable, z });
    } catch (error) {
      options.logger?.warn?.(`praxis.domain.invalid: ${error?.message ?? String(error)}`);
      return null;
    }
  })();
  specPromise = attempt;
  // A negative result is not memoized: the packages may resolve later (tests vs.
  // profile runtime, or a supervisor retry), and caching `null` would pin it.
  attempt.then((spec) => {
    if (!spec && specPromise === attempt) specPromise = null;
  });
  return attempt;
}

/**
 * Open the `praxis` domain on a storageDomain facility.
 * @param {object} [options]
 * @param {object} [options.storageDomain] - `ctx.storageDomain`; absent → `null`.
 * @param {object} [options.logger] - `{debug,warn}` sink.
 * @returns {Promise<object|null>} The open domain handle, or `null` when unavailable.
 */
export async function openDomain(options = {}) {
  const { storageDomain, logger } = options;
  if (!storageDomain || typeof storageDomain.open !== 'function') {
    logger?.debug?.('praxis.domain.open.skipped: no storageDomain facility');
    return null;
  }
  const spec = await loadPraxisDomainSpec({ logger });
  if (!spec) return null;
  try {
    return await storageDomain.open(spec);
  } catch (error) {
    logger?.warn?.(`praxis.domain.open.failed: ${error?.message ?? String(error)}`);
    return null;
  }
}

/** Reset the memoized spec — test seam only. */
export function resetDomainSpecCache() {
  specPromise = null;
}
