import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { registerHttp, API_PREFIX } from '../../plugins/dsh-praxis/src/http.js';
import { createHost } from '../../plugins/dsh-praxis/src/host.js';
import { createStore } from '../../plugins/dsh-praxis/src/store.js';
import { PLAYBOOKS } from '../../plugins/dsh-praxis/src/engine.js';
import { buildDefaultGraph } from '../../plugins/dsh-praxis/src/graph.js';

/**
 * 图 API 契约 v1（docs/praxis/redesign/07-graph-contract.md §5–§6）。
 *
 * 实现侧接口（本文件固化）：
 *   GET  /praxis/api/graph?runId=     -> 200 { graph, states, current, runId, version }
 *   POST /praxis/api/graph            -> body { playbookId, graph, actor? }
 *                                        200 { graph, receipt }
 *                                        400 { error, code:'INVALID_GRAPH', errors[] }
 *                                        actor.kind !== 'user' -> 4xx { error, code:'USER_ONLY' }
 *   POST /praxis/api/layout           -> body { playbookId, positions, actor? } -> 200 { graph }
 *   持久化：store dump 的 graphs[playbookId]（§6），重启后保留。
 */

const PLAYBOOK_ID = 'scientific-loop';
const PLAYBOOK = PLAYBOOKS[PLAYBOOK_ID];
const PORT = 3080;
const LOOPBACK_HOST = '127.0.0.1';
const BASE_HEADERS = { host: `${LOOPBACK_HOST}:${PORT}`, 'x-praxis-request': '1' };
const NODE_STATES = ['pending', 'active', 'blocked', 'done', 'failed', 'quarantined'];

// --- fake domain / store ---------------------------------------------------

function createFakeDomain() {
  const tables = new Map();
  const calls = [];

  function tableMap(name) {
    if (!tables.has(name)) tables.set(name, new Map());
    return tables.get(name);
  }

  function table(name) {
    const map = tableMap(name);
    return {
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
      delete: async (key) => map.delete(key),
      update: async (key, fn) => {
        const next = fn(map.get(key));
        map.set(key, structuredClone(next));
        return next;
      },
      get size() {
        return map.size;
      },
    };
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

function durableStore() {
  return createStore({ domain: createFakeDomain() });
}

// --- fake web server / req / res ------------------------------------------

function mount(host) {
  const routes = [];
  const ctx = {
    webServer: {
      host: LOOPBACK_HOST,
      port: PORT,
      register(route) {
        routes.push(route);
        return () => {};
      },
    },
  };
  registerHttp(ctx, host);
  assert.equal(routes.length, 1, 'exactly one route is registered');
  return { route: routes[0], dispose: () => {} };
}

function fakeReq({ method = 'GET', url = `${API_PREFIX}/graph`, headers = {}, body } = {}) {
  const chunks = [];
  if (body !== undefined) {
    chunks.push(Buffer.from(typeof body === 'string' ? body : JSON.stringify(body)));
  }
  const req = Readable.from(chunks);
  req.method = method;
  req.url = url;
  req.headers = { ...BASE_HEADERS, ...headers };
  req.socket = { remoteAddress: LOOPBACK_HOST };
  return req;
}

function fakeRes() {
  return {
    statusCode: 0,
    headers: {},
    body: '',
    ended: false,
    writeHead(status, headers) {
      this.statusCode = status;
      for (const [key, value] of Object.entries(headers ?? {})) {
        this.headers[key.toLowerCase()] = value;
      }
      return this;
    },
    write(chunk) {
      this.body += Buffer.from(chunk).toString('utf8');
      return true;
    },
    end(chunk) {
      if (chunk !== undefined) this.body += Buffer.from(chunk).toString('utf8');
      this.ended = true;
      return this;
    },
  };
}

async function call(route, req) {
  const res = fakeRes();
  await route.handler(req, res);
  assert.equal(res.ended, true, 'handler must end the response');
  const json = res.body ? JSON.parse(res.body) : null;
  return { status: res.statusCode, headers: res.headers, json };
}

const getGraph = (route, runId) => call(route, fakeReq({
  url: runId ? `${API_PREFIX}/graph?runId=${encodeURIComponent(runId)}` : `${API_PREFIX}/graph`,
}));

const postGraph = (route, body) => call(route, fakeReq({
  method: 'POST',
  url: `${API_PREFIX}/graph`,
  body,
}));

const postLayout = (route, body) => call(route, fakeReq({
  method: 'POST',
  url: `${API_PREFIX}/layout`,
  body,
}));

async function startRun(route, commandId = 'graph-api-start') {
  const response = await call(route, fakeReq({
    method: 'POST',
    url: `${API_PREFIX}/command`,
    body: {
      command: {
        commandId,
        action: 'start',
        payload: { playbookId: PLAYBOOK_ID, title: '图 API 契约' },
      },
    },
  }));
  assert.equal(response.status, 200);
  return response.json.receipt.runId;
}

const intakeId = (graph) => graph.nodes.find((node) => node.type === 'stage' && node.stage === 'intake').id;

// ---------------------------------------------------------------------------

test('graph api: GET /graph without a run returns the default playbook graph', async () => {
  const host = createHost();
  const { route } = mount(host);
  const { status, json } = await getGraph(route);
  assert.equal(status, 200);
  assert.ok(json.graph && typeof json.graph === 'object');
  assert.equal(json.graph.playbookId, PLAYBOOK_ID);
  assert.ok(Array.isArray(json.graph.nodes) && json.graph.nodes.length > 0);
  assert.ok(Array.isArray(json.graph.edges));
  assert.equal(json.runId, null);
  assert.deepEqual(json.states, {});
  assert.equal(json.current, null);
});

test('graph api: GET /graph?runId returns the graph plus derived states', async () => {
  const host = createHost();
  const { route } = mount(host);
  const runId = await startRun(route);
  assert.ok(runId);
  const { status, json } = await getGraph(route, runId);
  assert.equal(status, 200);
  assert.equal(json.runId, runId);
  assert.equal(json.version, host.engine.runView(runId).version);
  assert.equal(json.graph.playbookId, PLAYBOOK_ID);
  const intake = intakeId(json.graph);
  assert.equal(json.states[intake], 'active');
  assert.equal(json.current, intake);
  for (const nodeId of Object.keys(json.states)) {
    assert.ok(NODE_STATES.includes(json.states[nodeId]), `state ${nodeId}`);
  }
});

test('graph api: POST /graph with an invalid graph is 400 with V codes', async () => {
  const host = createHost();
  const { route } = mount(host);
  const graph = buildDefaultGraph(PLAYBOOK);
  graph.edges.push({
    id: 'e_cycle',
    from: graph.nodes.find((node) => node.type === 'end').id,
    to: graph.nodes.find((node) => node.type === 'start').id,
    port: 'artifact',
  });
  const { status, json } = await postGraph(route, { playbookId: PLAYBOOK_ID, graph });
  assert.equal(status, 400);
  assert.equal(json.code, 'INVALID_GRAPH');
  assert.equal(typeof json.error, 'string');
  assert.ok(Array.isArray(json.errors) && json.errors.length > 0);
  assert.ok(json.errors.every((error) => typeof error.code === 'string'));
  assert.ok(json.errors.some((error) => error.code === 'V3'), 'cycle must surface V3');
});

test('graph api: POST /graph without a graph body is 400 INVALID_GRAPH', async () => {
  const host = createHost();
  const { route } = mount(host);
  const { status, json } = await postGraph(route, { playbookId: PLAYBOOK_ID });
  assert.equal(status, 400);
  assert.equal(json.code, 'INVALID_GRAPH');
  assert.ok(Array.isArray(json.errors));
});

test('graph api: POST /graph with a valid graph is 200 and persists into the store dump', async () => {
  const store = durableStore();
  const host = createHost({ store });
  const { route } = mount(host);
  const graph = buildDefaultGraph(PLAYBOOK);
  graph.name = 'UI 编辑图';
  graph.nodes.find((node) => node.id === intakeId(graph)).label = '进入';

  const { status, json } = await postGraph(route, { playbookId: PLAYBOOK_ID, graph });
  assert.equal(status, 200);
  assert.ok(json.graph && typeof json.graph === 'object');
  assert.equal(json.graph.name, 'UI 编辑图');
  assert.equal(json.graph.playbookId, PLAYBOOK_ID);
  assert.equal(typeof json.graph.contentHash, 'string');
  assert.ok(json.graph.contentHash.length > 0, 'contentHash is computed when saving');
  assert.ok(json.receipt && typeof json.receipt === 'object');
  assert.equal(json.receipt.status, 'committed');

  await host.flush();
  const dump = await store.load();
  assert.ok(dump, 'store must have a dump after saving a graph');
  assert.ok(dump.graphs, 'store dump carries graphs');
  assert.equal(dump.graphs[PLAYBOOK_ID].name, 'UI 编辑图');
  assert.equal(
    dump.graphs[PLAYBOOK_ID].nodes.find((node) => node.id === intakeId(dump.graphs[PLAYBOOK_ID])).label,
    '进入',
  );
});

test('graph api: a saved graph survives a store reload (restart)', async () => {
  const store = durableStore();
  const host = createHost({ store });
  const mount1 = mount(host);
  const graph = buildDefaultGraph(PLAYBOOK);
  graph.name = '重启后仍在';
  const saved = await postGraph(mount1.route, { playbookId: PLAYBOOK_ID, graph });
  assert.equal(saved.status, 200);
  await host.flush();

  const dump = await store.load();
  assert.ok(dump?.graphs?.[PLAYBOOK_ID], 'graph persisted before restart');

  const host2 = createHost({ store });
  assert.equal(host2.load(dump), true);
  const mount2 = mount(host2);
  const runId = await startRun(mount2.route, 'graph-api-restart');
  const { status, json } = await getGraph(mount2.route, runId);
  assert.equal(status, 200);
  assert.equal(json.graph.name, '重启后仍在');
  assert.equal(json.graph.playbookId, PLAYBOOK_ID);
});

test('graph api: POST /layout merges positions only', async () => {
  const store = durableStore();
  const host = createHost({ store });
  const { route } = mount(host);
  const graph = buildDefaultGraph(PLAYBOOK);
  graph.name = '布局前';
  const saved = await postGraph(route, { playbookId: PLAYBOOK_ID, graph });
  assert.equal(saved.status, 200);
  const intake = intakeId(saved.json.graph);
  const question = saved.json.graph.nodes.find(
    (node) => node.type === 'stage' && node.stage === 'question',
  ).id;

  const { status, json } = await postLayout(route, {
    playbookId: PLAYBOOK_ID,
    positions: {
      [intake]: { x: 123.5, y: 45 },
      [question]: { x: 200, y: 45 },
    },
  });
  assert.equal(status, 200);
  const layoutGraph = json.graph;
  assert.equal(layoutGraph.name, '布局前', 'layout must not touch anything but positions');
  assert.equal(
    layoutGraph.nodes.find((node) => node.id === intake).position.x,
    123.5,
  );
  assert.equal(
    layoutGraph.nodes.find((node) => node.id === question).position.y,
    45,
  );
  assert.equal(layoutGraph.nodes.length, saved.json.graph.nodes.length);
  assert.deepEqual(
    layoutGraph.nodes.map((node) => node.id),
    saved.json.graph.nodes.map((node) => node.id),
  );
  assert.deepEqual(
    layoutGraph.nodes.find((node) => node.id === intake).config,
    saved.json.graph.nodes.find((node) => node.id === intake).config,
  );
  assert.deepEqual(
    layoutGraph.edges.map((edge) => edge.id),
    saved.json.graph.edges.map((edge) => edge.id),
  );

  await host.flush();
  const dump = await store.load();
  const persisted = dump.graphs[PLAYBOOK_ID];
  assert.equal(persisted.nodes.find((node) => node.id === intake).position.x, 123.5);
  assert.equal(persisted.name, '布局前');
});

test('graph api: graph and layout management are user-only', async () => {
  const store = durableStore();
  const host = createHost({ store });
  const { route } = mount(host);
  const graph = buildDefaultGraph(PLAYBOOK);
  graph.name = '越权图';

  const deniedGraph = await postGraph(route, {
    playbookId: PLAYBOOK_ID,
    graph,
    actor: { kind: 'agent', id: 'agent-1' },
  });
  assert.ok(deniedGraph.status >= 400 && deniedGraph.status < 500, `expected 4xx, got ${deniedGraph.status}`);
  assert.equal(deniedGraph.json.code, 'USER_ONLY');

  const deniedLayout = await postLayout(route, {
    playbookId: PLAYBOOK_ID,
    positions: {},
    actor: { kind: 'coding', id: 'worker-1' },
  });
  assert.ok(deniedLayout.status >= 400 && deniedLayout.status < 500);
  assert.equal(deniedLayout.json.code, 'USER_ONLY');

  await host.flush();
  const dump = await store.load();
  assert.equal(dump?.graphs?.[PLAYBOOK_ID]?.name ?? null, null, 'denied writes persist nothing');
});
