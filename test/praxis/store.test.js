import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../../plugins/dsh-praxis/src/store.js';
import { DEFAULT_KNOBS } from '../../plugins/dsh-praxis/src/engine.js';

/**
 * Fake `ctx.storageDomain` opened-domain handle for contract §6.
 *
 * The real @deepseek-ai/dsh-storage-domain `Domain` exposes `table(name)` with
 * a KvTable (`get`/`put`/`entries`/`keys`/`delete`/`update`). We implement
 * that surface over a plain Map, plus flat `get(name,key)`/`put(name,key,value)`
 * convenience methods so the store adapter can use either call shape.
 */
function createFakeDomain() {
  const tables = new Map();
  const calls = [];

  function tableMap(name) {
    if (!tables.has(name)) tables.set(name, new Map());
    return tables.get(name);
  }

  function table(name) {
    const map = tableMap(name);
    const handle = {
      name,
      get(key) {
        calls.push(['get', name, key]);
        return map.get(key);
      },
      put: async (key, value) => {
        calls.push(['put', name, key]);
        map.set(key, structuredClone(value));
      },
      entries() {
        calls.push(['entries', name]);
        return [...map.entries()].map(([key, value]) => [key, structuredClone(value)]);
      },
      keys: () => [...map.keys()],
      delete: async (key) => {
        calls.push(['delete', name, key]);
        return map.delete(key);
      },
      update: async (key, fn) => {
        const next = fn(map.get(key));
        map.set(key, structuredClone(next));
        return next;
      },
      get size() {
        return map.size;
      },
    };
    return handle;
  }

  return {
    name: 'praxis',
    tables,
    calls,
    table,
    async close() {},
    get(name, key) {
      calls.push(['get', name, key]);
      return tableMap(name).get(key);
    },
    async put(name, key, value) {
      calls.push(['put', name, key]);
      tableMap(name).set(key, structuredClone(value));
    },
    entries(name) {
      calls.push(['entries', name]);
      return [...tableMap(name).entries()].map(([key, value]) => [key, structuredClone(value)]);
    },
  };
}

function sampleDump() {
  return {
    v: 1,
    knobs: { ...DEFAULT_KNOBS, heterogeneityFloor: 0.5 },
    runs: [
      {
        id: 'run_a',
        title: 'A',
        playbookId: 'scientific-loop',
        state: 'PREREG_FROZEN',
        version: 3,
        parentId: null,
        knobs: { ...DEFAULT_KNOBS },
        events: [{ seq: 1, type: 'run.started' }],
      },
      {
        id: 'run_b',
        title: 'B',
        playbookId: 'audit-redteam',
        state: 'INTAKE',
        version: 1,
        parentId: 'run_a',
        knobs: { ...DEFAULT_KNOBS },
        events: [],
      },
    ],
    receipts: [
      { commandId: 'c1', status: 'committed', runId: 'run_a' },
      { commandId: 'c2', status: 'rejected', reasonCode: 'PREREG_REQUIRED', runId: 'run_a' },
    ],
  };
}

const receipt = {
  commandId: 'c1',
  status: 'committed',
  runId: 'run_a',
  state: 'PREREG_FROZEN',
  version: 3,
};

test('store: memory fallback keeps durability honest and round-trips', async () => {
  const store = createStore();
  assert.equal(store.durability, 'memory');
  assert.equal(await store.load(), null);
  const dump = sampleDump();
  await store.save(dump);
  assert.deepEqual(await store.load(), dump);
  assert.equal(await store.getReceipt('missing'), null);
  await store.saveReceipt('c1', receipt);
  assert.deepEqual(await store.getReceipt('c1'), receipt);
  await store.close();
});

test('store: domain makes it durable and persists dump across instances', async () => {
  const domain = createFakeDomain();
  const store = createStore({ domain });
  assert.equal(store.durability, 'durable');
  assert.equal(await store.load(), null);
  const dump = sampleDump();
  await store.save(dump);
  const reborn = createStore({ domain });
  assert.deepEqual(await reborn.load(), dump);
  assert.equal(domain.tables.get('runs')?.size, dump.runs.length);
  assert.equal(domain.tables.get('receipts')?.size, dump.receipts.length);
  assert.ok(domain.tables.get('meta')?.has('dump'));
  await store.close();
  await reborn.close();
});

test('store: receipts survive a restart and are readable by commandId', async () => {
  const domain = createFakeDomain();
  const store = createStore({ domain });
  await store.saveReceipt('cmd-42', receipt);
  const reborn = createStore({ domain });
  assert.deepEqual(await reborn.getReceipt('cmd-42'), receipt);
  assert.equal(await reborn.getReceipt('cmd-unknown'), null);
  await store.close();
  await reborn.close();
});

test('store: save is idempotent and does not duplicate table rows', async () => {
  const domain = createFakeDomain();
  const store = createStore({ domain });
  const dump = sampleDump();
  await store.save(dump);
  await store.save(dump);
  assert.deepEqual(await store.load(), dump);
  assert.equal(domain.tables.get('runs')?.size, dump.runs.length);
  assert.equal(domain.tables.get('receipts')?.size, dump.receipts.length);
});

test('store: a throwing domain makes load() return null instead of throwing', async () => {
  const broken = {
    table() {
      throw new Error('disk unavailable');
    },
    get() {
      throw new Error('disk unavailable');
    },
    entries() {
      throw new Error('disk unavailable');
    },
  };
  const store = createStore({ domain: broken });
  assert.equal(store.durability, 'durable');
  let loaded;
  await assert.doesNotReject(async () => {
    loaded = await store.load();
  });
  assert.equal(loaded, null);
});

test('store: a corrupt dump makes load() return null instead of throwing', async () => {
  const domain = createFakeDomain();
  const store = createStore({ domain });
  await domain.put('meta', 'dump', { v: 999, runs: 'not-an-array' });
  let loaded;
  await assert.doesNotReject(async () => {
    loaded = await store.load();
  });
  assert.equal(loaded, null);
});
