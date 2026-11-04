/**
 * Praxis persistence adapter — plain Node, no Harness imports.
 *
 * Three interchangeable modes, chosen by the options object:
 *
 *   createStore({ domain })   → contract §6 adapter over an open
 *                               `@deepseek-ai/dsh-storage-domain` handle
 *                               (tables `runs` / `receipts` / `meta`),
 *                               `durability: 'durable'`.
 *   createStore({ path })     → file-backed single JSON document
 *                               (default `<homedir>/.dsh/praxis/state.json`
 *                               when only `homedir`/`durable:true` is given),
 *                               atomic tmp+rename writes, `durability: 'file'`.
 *   createStore()             → in-memory fallback for the storageDomain-less
 *                               wiring path (contract §1), `durability: 'memory'`.
 *
 * A hosted deployment should pass an explicit `path` (or a `domain`) — the
 * no-argument form is deliberately the honest memory fallback, not a silent
 * disk writer.
 *
 * Common guarantees:
 * - `load()` never throws. A missing medium, truncated file, foreign JSON, or
 *   failing domain yields `null` after logging, and leaves an empty state.
 * - Writes are serialized on one chain and idempotent: an unchanged payload is
 *   not rewritten, and repeated writes never duplicate rows.
 * - Receipts live in the same document/table set and are readable by
 *   `commandId` after a restart.
 *
 * File shape on disk:
 *   { v: 1, schemaVersion: 1, updatedAt: '<iso>',
 *     dump: <engine dump|null>, receipts: { [commandId]: <receipt> } }
 *
 * Domain records: every value is a versioned passthrough object — `meta` holds
 * the wrapped dump under key `dump`, `runs` holds one record per run keyed by
 * `runId`, `receipts` one per receipt keyed by `commandId`.
 */

import { promises as nodeFs, readFileSync as nodeReadFileSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export const STORE_SCHEMA_VERSION = 1;
export const DEFAULT_STATE_FILE = 'state.json';
export const DEFAULT_STATE_DIR = path.join('.dsh', 'praxis');
/** `meta` key that carries the engine dump in domain mode (contract §6). */
export const META_DUMP_KEY = 'dump';
/** Domain version stamped into every domain record. */
export const STORE_DOMAIN_VERSION = 1;

/** Contract §6 default location: `<homedir>/.dsh/praxis/state.json`. */
export function defaultStatePath(homedir = os.homedir()) {
  return path.join(homedir, DEFAULT_STATE_DIR, DEFAULT_STATE_FILE);
}

function silentLogger() {}

const CONSOLE_LOGGER = {
  debug: (...args) => console.debug(...args),
  info: (...args) => console.info(...args),
  warn: (...args) => console.warn(...args),
  error: (...args) => console.error(...args),
};

function resolveLogger(logger) {
  if (logger === false) {
    return { debug: silentLogger, info: silentLogger, warn: silentLogger, error: silentLogger };
  }
  const base = logger ?? CONSOLE_LOGGER;
  return {
    debug: typeof base.debug === 'function' ? base.debug.bind(base) : silentLogger,
    info: typeof base.info === 'function' ? base.info.bind(base) : silentLogger,
    warn: typeof base.warn === 'function' ? base.warn.bind(base) : silentLogger,
    error: typeof base.error === 'function' ? base.error.bind(base) : silentLogger,
  };
}

/** Accept `node:fs`, `node:fs/promises`, or a hand-rolled promise fs (tests). */
function resolveFs(fs) {
  if (!fs) return nodeFs;
  if (typeof fs.readFile === 'function' && typeof fs.writeFile === 'function') return fs;
  if (fs.promises && typeof fs.promises.readFile === 'function') return fs.promises;
  throw new TypeError('createStore: options.fs must expose promise-based readFile/writeFile');
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasDomainSurface(domain) {
  if (!domain || typeof domain !== 'object') return false;
  return typeof domain.table === 'function' || typeof domain.get === 'function';
}

/**
 * Reject dumps the engine could never have produced. Kept narrow on purpose:
 * the store owns "is this the shape we persist", the engine owns everything
 * below it.
 */
function validateDump(dump) {
  if (!isPlainObject(dump)) throw new Error('dump is not a JSON object');
  if (dump.v !== 1) throw new Error(`unsupported dump version: ${String(dump.v)}`);
  if (!Array.isArray(dump.runs)) throw new Error('dump.runs is not an array');
  if (dump.receipts !== undefined && !Array.isArray(dump.receipts)) throw new Error('dump.receipts is not an array');
  return dump;
}

function wrapDomainDump(dump) {
  return {
    ...dump,
    schemaVersion: STORE_SCHEMA_VERSION,
    domainVersion: STORE_DOMAIN_VERSION,
  };
}

function unwrapDomainDump(record) {
  if (!isPlainObject(record)) throw new Error('stored dump record is not a JSON object');
  const { schemaVersion: _schemaVersion, domainVersion: _domainVersion, ...dump } = record;
  return validateDump(dump);
}

/** `commandId → receipt` map out of a dump's receipt ledger. */
function receiptsOfDump(dump) {
  const ledger = new Map();
  for (const receipt of Array.isArray(dump?.receipts) ? dump.receipts : []) {
    if (!isPlainObject(receipt)) continue;
    const key = receipt.commandId ?? receipt.id;
    if (key === undefined || key === null || key === '') continue;
    ledger.set(String(key), receipt);
  }
  return ledger;
}

/** `runId → run` map out of a dump's run list. */
function runsOfDump(dump) {
  const ledger = new Map();
  for (const run of Array.isArray(dump?.runs) ? dump.runs : []) {
    if (!isPlainObject(run)) continue;
    const key = run.id ?? run.runId;
    if (key === undefined || key === null || key === '') continue;
    ledger.set(String(key), run);
  }
  return ledger;
}

/** Identity used to make `save`/`saveReceipt` idempotent (ignores `updatedAt`). */
function signatureOf(dump, receipts) {
  const ledger = {};
  for (const [key, value] of receipts) ledger[key] = value;
  return JSON.stringify({ dump: dump ?? null, receipts: ledger });
}

/** Ordered plain object of the receipt ledger. */
function receiptLedger(receipts) {
  const ledger = {};
  for (const [key, value] of receipts) ledger[key] = value;
  return ledger;
}

/**
 * @param {object} [options]
 * @param {object} [options.domain] - Open domain handle (`table(name)` / KvTable).
 * @param {string|null} [options.path] - State file path; `null` forces memory mode.
 * @param {boolean} [options.durable] - With no `path`, use the default file path.
 * @param {string} [options.homedir] - Base for the default file path.
 * @param {object} [options.fs] - Injectable promise-based fs (readFile/writeFile/rename/mkdir/unlink).
 * @param {object|false} [options.logger] - `{debug,info,warn,error}`; `false` silences.
 * @param {number} [options.maxReceipts] - File-mode ledger cap, oldest commandIds evicted first.
 */
export function createStore(options = {}) {
  const logger = resolveLogger(options.logger);
  const domain = hasDomainSurface(options.domain) ? options.domain : null;
  const fs = resolveFs(options.fs);
  const wantsFile = !domain
    && options.path !== null
    && (typeof options.path === 'string' || options.durable === true || options.homedir !== undefined);
  const mode = domain ? 'domain' : (wantsFile ? 'file' : 'memory');
  const file = mode === 'file'
    ? (typeof options.path === 'string' ? options.path : defaultStatePath(options.homedir ?? os.homedir()))
    : null;
  const maxReceipts = Number.isInteger(options.maxReceipts) && options.maxReceipts > 0
    ? options.maxReceipts
    : Number.POSITIVE_INFINITY;

  const state = {
    loaded: false,
    dump: null,
    receipts: new Map(),
    signature: null,
  };

  // Single write chain: every mutating call serializes behind the previous one,
  // so two concurrent saves can never interleave their tmp+rename pair or
  // domain table writes.
  let chain = Promise.resolve();
  let tmpCounter = 0;

  function enqueue(task) {
    const next = chain.then(task);
    chain = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  }

  function pruneReceipts() {
    if (state.receipts.size <= maxReceipts) return;
    const overflow = state.receipts.size - maxReceipts;
    let dropped = 0;
    for (const key of state.receipts.keys()) {
      if (dropped >= overflow) break;
      state.receipts.delete(key);
      dropped += 1;
    }
  }

  /* ---------------------------------------------------------------- file mode */

  async function readStateFile() {
    const text = await fs.readFile(file, 'utf8');
    const parsed = JSON.parse(text);
    if (!isPlainObject(parsed)) throw new Error('state file is not a JSON object');
    const rawReceipts = parsed.receipts ?? {};
    if (!isPlainObject(rawReceipts)) throw new Error('receipts section is not a JSON object');
    const dump = parsed.dump === undefined ? null : parsed.dump;
    if (dump !== null) validateDump(dump);
    return { dump, receipts: new Map(Object.entries(rawReceipts)) };
  }

  /**
   * Synchronous lookup path for `getReceipt` on a store that never called
   * `load()` (the contract requires a synchronous read). Deliberately does not
   * mutate the cached view: the next `load()`/write still sees the medium.
   */
  function peekReceiptOnDisk(commandId) {
    try {
      const text = nodeReadFileSync(file, 'utf8');
      const parsed = JSON.parse(text);
      if (!isPlainObject(parsed) || !isPlainObject(parsed.receipts)) return null;
      return parsed.receipts[commandId] ?? null;
    } catch {
      return null;
    }
  }

  async function writeStateFile() {
    const signature = signatureOf(state.dump, state.receipts);
    if (signature === state.signature) {
      logger.debug?.('praxis.store.write.skipped (unchanged)');
      return;
    }
    if (typeof fs.mkdir === 'function') await fs.mkdir(path.dirname(file), { recursive: true });
    const payload = JSON.stringify(
      {
        v: STORE_SCHEMA_VERSION,
        schemaVersion: STORE_SCHEMA_VERSION,
        updatedAt: new Date().toISOString(),
        dump: state.dump ?? null,
        receipts: receiptLedger(state.receipts),
      },
      null,
      2,
    );
    const temporary = `${file}.tmp-${process.pid}-${tmpCounter++}`;
    try {
      await fs.writeFile(temporary, payload, 'utf8');
      if (typeof fs.rename === 'function') await fs.rename(temporary, file);
      else await fs.writeFile(file, payload, 'utf8');
    } catch (error) {
      try {
        if (typeof fs.unlink === 'function') await fs.unlink(temporary);
      } catch {
        // Best effort: a leftover tmp file is harmless, the throw below is the signal.
      }
      throw error;
    }
    state.signature = signature;
  }

  /* -------------------------------------------------------------- domain mode */

  function tableOf(name) {
    if (!domain) return null;
    if (typeof domain.table === 'function') {
      let table;
      try {
        table = domain.table(name);
      } catch {
        throw new Error(`domain has no usable '${name}' table`);
      }
      return table && typeof table.get === 'function' ? table : null;
    }
    return null;
  }

  function readDomainRecord(tableName, key) {
    const table = tableOf(tableName);
    if (table && typeof table.get === 'function') return table.get(key);
    if (domain && typeof domain.get === 'function') return domain.get(tableName, key);
    return undefined;
  }

  async function writeDomainRecord(tableName, key, value) {
    const table = tableOf(tableName);
    if (table && typeof table.put === 'function') {
      await table.put(key, value);
      return;
    }
    if (domain && typeof domain.put === 'function') {
      await domain.put(tableName, key, value);
      return;
    }
    throw new Error(`domain has no writable '${tableName}' table`);
  }

  async function deleteDomainRecord(tableName, key) {
    const table = tableOf(tableName);
    if (table && typeof table.delete === 'function') return table.delete(key);
    return false;
  }

  /** Write exactly `records` into one table, retiring keys no longer present. */
  async function syncDomainTable(tableName, records) {
    const table = tableOf(tableName);
    const existing = new Set();
    if (table) {
      if (typeof table.keys === 'function') {
        for (const key of table.keys()) existing.add(String(key));
      } else if (typeof table.entries === 'function') {
        for (const [key] of table.entries()) existing.add(String(key));
      }
      for (const key of existing) {
        if (!records.has(key)) await deleteDomainRecord(tableName, key);
      }
    }
    for (const [key, value] of records) {
      await writeDomainRecord(tableName, key, value);
    }
  }

  async function writeDomainState() {
    const runRecords = runsOfDump(state.dump);
    const receiptRecords = receiptsOfDump(state.dump);
    // Saved receipts are authoritative for their own keys; a dump without a
    // receipts array must not erase them.
    for (const [key, value] of state.receipts) receiptRecords.set(key, value);

    if (state.dump === null) await deleteDomainRecord('meta', META_DUMP_KEY);
    else await writeDomainRecord('meta', META_DUMP_KEY, wrapDomainDump(state.dump));
    await syncDomainTable('runs', runRecords);
    await syncDomainTable('receipts', receiptRecords);
  }

  /* -------------------------------------------------------------------- load */

  async function loadInner() {
    try {
      if (mode === 'file') {
        const parsed = await readStateFile();
        state.dump = parsed.dump;
        state.receipts = parsed.receipts;
        state.signature = signatureOf(state.dump, state.receipts);
        state.loaded = true;
        logger.debug?.(`praxis.store.loaded file=${file} runs=${state.dump?.runs?.length ?? 0} receipts=${state.receipts.size}`);
        return state.dump;
      }
      if (mode === 'domain') {
        const record = readDomainRecord('meta', META_DUMP_KEY);
        const dump = record === undefined || record === null ? null : unwrapDomainDump(record);
        state.dump = dump;
        state.receipts = new Map();
        if (dump) {
          for (const [key, value] of receiptsOfDump(dump)) state.receipts.set(key, value);
        }
        state.signature = signatureOf(state.dump, state.receipts);
        state.loaded = true;
        logger.debug?.(`praxis.store.loaded domain=${String(domain?.name ?? 'praxis')} runs=${dump?.runs?.length ?? 0}`);
        return dump;
      }
      state.loaded = true;
      return state.dump;
    } catch (error) {
      // Startup must survive a broken medium: empty state + log, never a throw.
      state.loaded = true;
      state.dump = null;
      state.receipts = new Map();
      state.signature = null;
      if (error && error.code === 'ENOENT') {
        logger.debug?.(`praxis.store.empty file=${file} (no state file yet)`);
      } else {
        logger.warn?.(`praxis.store.load.failed (${mode}): ${error?.message ?? String(error)}`);
      }
      return null;
    }
  }

  /** Public read: serialized behind pending writes. */
  function load() {
    return enqueue(loadInner);
  }

  /** Writes must see what the medium already holds before replacing it. */
  async function ensureLoaded() {
    if (!state.loaded) await loadInner();
  }

  /* -------------------------------------------------------------------- save */

  async function saveInner(dump) {
    await ensureLoaded();
    state.dump = dump === undefined ? null : dump;
    if (mode === 'file') {
      await writeStateFile();
      return;
    }
    if (mode === 'domain') {
      await writeDomainState();
    }
    // memory: nothing to persist.
  }

  function save(dump) {
    return enqueue(() => saveInner(dump));
  }

  async function saveReceiptInner(commandId, receipt) {
    await ensureLoaded();
    const key = String(commandId);
    // Re-insert so the ledger's insertion order tracks recency for eviction.
    if (state.receipts.has(key)) state.receipts.delete(key);
    state.receipts.set(key, receipt);
    pruneReceipts();

    if (mode === 'file') {
      await writeStateFile();
      return;
    }
    if (mode === 'domain') {
      await writeDomainRecord('receipts', key, receipt);
    }
  }

  function saveReceipt(commandId, receipt) {
    if (commandId === undefined || commandId === null || commandId === '') {
      return Promise.reject(new TypeError('saveReceipt: commandId is required'));
    }
    return enqueue(() => saveReceiptInner(commandId, receipt));
  }

  /* ---------------------------------------------------------------- receipts */

  function getReceipt(commandId) {
    if (commandId === undefined || commandId === null || commandId === '') return null;
    const key = String(commandId);
    if (mode === 'domain') {
      try {
        const record = readDomainRecord('receipts', key);
        return record ?? null;
      } catch (error) {
        logger.warn?.(`praxis.store.receipt.read.failed key=${key}: ${error?.message ?? String(error)}`);
        return null;
      }
    }
    const cached = state.receipts.get(key);
    if (cached !== undefined) return cached;
    // File mode: a fresh instance may be asked for a receipt before load().
    if (mode === 'file' && !state.loaded) return peekReceiptOnDisk(key);
    return null;
  }

  /* ------------------------------------------------------------------- close */

  async function close() {
    await chain;
    if (mode === 'domain' && domain && typeof domain.close === 'function') {
      try {
        await domain.close();
      } catch (error) {
        logger.warn?.(`praxis.store.close.failed: ${error?.message ?? String(error)}`);
      }
    }
  }

  return {
    load,
    save,
    saveReceipt,
    getReceipt,
    durability: mode === 'domain' ? 'durable' : (mode === 'file' ? 'file' : 'memory'),
    mode,
    close,
    /** Path of the backing document; `null` outside file mode. */
    path: file,
    /** Resolve after every queued write has settled. */
    flush() {
      return chain;
    },
    /** True once `load()` (or a write) has initialized the in-memory view. */
    get loaded() {
      return state.loaded;
    },
  };
}

export default createStore;
