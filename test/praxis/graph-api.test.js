import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { registerHttp, API_PREFIX } from '../../plugins/dsh-praxis/src/http.js';
import { createHost } from '../../plugins/dsh-praxis/src/host.js';
import { createStore } from '../../plugins/dsh-praxis/src/store.js';
import { PLAYBOOKS } from '../../plugins/dsh-praxis/src/engine.js';
import { buildDefaultGraph } from '../../plugins/dsh-praxis/src/graph.js';

/**
 * 图 API 契约 v2（docs/praxis/redesign/10-v2-contract.md §2.3 / §3）。
 *
 * 实现侧接口（本文件固化）：
 *   GET  /praxis/api/graph?runId=     -> 200 扁平 graph 投影（T8.6a / T8.3）
 *                                        { id, playbookId, revision, layoutVersion, name,
 *                                          nodes, edges, states, current, progress, audit }
 *   POST /praxis/api/graph            -> body { playbookId, graph, expectedRevision, actor? }
 *                                        缺 expectedRevision -> 428 REVISION_REQUIRED（T8.6）
 *                                        过期 -> 409 CONFLICT + 当前图
 *                                        无效图 -> 4xx + V 码
 *                                        actor.kind !== 'user' -> 4xx USER_ONLY
 *   POST /praxis/api/layout           -> body { playbookId, positions, actor? } -> 200 { graph }
 *   持久化：store dump 的 graphs[playbookId]，重启后保留。
 */

const PLAYBOOK_ID = 'scientific-loop';
const PLAYBOOK = PLAYBOOKS[PLAYBOOK_ID];
const PORT = 3080;
const LOOPBACK_HOST = '127.0.0.1';
const BASE_HEADERS = { host: `${LOOPBACK_HOST}:${PORT}`, 'x-praxis-request': '1' };
const EXECUTION_STATES = ['pending', 'active', 'done', 'blocked', 'failed'];
const CONDITION_STATES = ['missing', 'satisfied', 'stale', 'unknown'];

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

/** v2 T8.6: saves must carry the live graph revision. */
async function currentGraph(route, runId) {
  const { status, json } = await getGraph(route, runId);
  assert.equal(status, 200);
  return json;
}

// ---------------------------------------------------------------------------

test('graph api: GET /graph without a run returns the flat default playbook graph', async () => {
  const host = createHost();
  const { route } = mount(host);
  const { status, json } = await getGraph(route);
  assert.equal(status, 200);
  // v2 T8.6a：扁平投影，没有 { graph: ... } 包装。
  assert.equal('graph' in json, false, 'GET /graph must be a flat projection');
  for (const key of ['id', 'playbookId', 'revision', 'layoutVersion', 'nodes', 'edges', 'states', 'current', 'progress', 'audit']) {
    assert.ok(key in json, `GET /graph.${key} missing`);
  }
  assert.equal(json.playbookId, PLAYBOOK_ID);
  assert.equal(json.layoutVersion, 2);
  assert.equal(typeof json.revision, 'number');
  assert.ok(Array.isArray(json.nodes) && json.nodes.length === 15);
  assert.ok(Array.isArray(json.edges));
  assert.deepEqual(json.states, {});
  assert.equal(json.current, null);
  assert.equal(json.audit.ok, true);
});

test('graph api: GET /graph?runId returns the graph plus dual-axis derived states', async () => {
  const host = createHost();
  const { route } = mount(host);
  const runId = await startRun(route);
  assert.ok(runId);
  const { status, json } = await getGraph(route, runId);
  assert.equal(status, 200);
  assert.equal('graph' in json, false, 'GET /graph must be a flat projection');
  assert.equal(json.playbookId, PLAYBOOK_ID);
  assert.equal(json.layoutVersion, 2);
  assert.ok(Array.isArray(json.nodes) && json.nodes.length === 15);
  const intake = intakeId(json);
  assert.equal(json.states[intake].execution, 'active');
  assert.equal(json.current, intake);
  assert.equal(json.progress.total, json.nodes.length);
  assert.equal(json.progress.index, 0);
  assert.equal(json.audit.ok, true);
  for (const nodeId of Object.keys(json.states)) {
    const state = json.states[nodeId];
    assert.ok(EXECUTION_STATES.includes(state.execution), `execution ${nodeId}`);
    assert.ok(CONDITION_STATES.includes(state.condition), `condition ${nodeId}`);
    assert.ok(state.reason === null || typeof state.reason === 'string');
  }
  // 与 engine.graphView 是同一投影。
  assert.deepEqual(json.states, host.engine.graphView(runId).states);
});

test('graph api: POST /graph with an invalid graph is 422 with V codes', async () => {
  const host = createHost();
  const { route } = mount(host);
  const current = await currentGraph(route);
  const graph = buildDefaultGraph(PLAYBOOK);
  graph.edges.push({
    id: 'e_cycle',
    from: graph.nodes.find((node) => node.type === 'end').id,
    to: graph.nodes.find((node) => node.type === 'start').id,
    port: 'artifact',
  });
  const { status, json } = await postGraph(route, {
    playbookId: PLAYBOOK_ID,
    graph,
    expectedRevision: current.revision,
  });
  // v2 T8.6：expectedRevision 齐备后，无效图是 4xx（实现返回 422）。
  assert.ok(status >= 400 && status < 500, `expected 4xx, got ${status}`);
  assert.equal(json.code, 'INVALID_GRAPH');
  assert.equal(typeof json.error, 'string');
  assert.ok(Array.isArray(json.errors) && json.errors.length > 0);
  assert.ok(json.errors.every((error) => typeof error.code === 'string'));
  assert.ok(json.errors.some((error) => error.code === 'V3'), 'cycle must surface V3');
  // 未落盘。
  const after = await currentGraph(route);
  assert.equal(after.revision, current.revision);
});

test('graph api: POST /graph requires expectedRevision and rejects a body without a graph', async () => {
  const host = createHost();
  const { route } = mount(host);
  const before = await currentGraph(route);

  // v2 T8.6：缺 expectedRevision 时保存被拒绝（revision gate 先于其它校验）。
  const missingRevision = await postGraph(route, { playbookId: PLAYBOOK_ID });
  assert.equal(missingRevision.status, 428);
  assert.equal(missingRevision.json.code, 'REVISION_REQUIRED');

  // 带 expectedRevision 但没有 graph：必须是 4xx + V 码，且不能删除受保护节点。
  const noGraph = await postGraph(route, { playbookId: PLAYBOOK_ID, expectedRevision: before.revision });
  assert.ok(noGraph.status >= 400 && noGraph.status < 500, `expected 4xx, got ${noGraph.status}`);
  assert.ok(Array.isArray(noGraph.json.errors) && noGraph.json.errors.length > 0);
  assert.ok(noGraph.json.errors.every((error) => /^V\d+$/.test(error.code)), 'errors must be V codes');
  const after = await currentGraph(route);
  assert.equal(after.revision, before.revision, 'rejected save must not persist');
  assert.equal(after.nodes.length, before.nodes.length);
});

test('graph api: POST /graph with a valid graph is 200 and persists into the store dump', async () => {
  const store = durableStore();
  const host = createHost({ store });
  const { route } = mount(host);
  const graph = buildDefaultGraph(PLAYBOOK);
  graph.name = 'UI 编辑图';
  graph.nodes.find((node) => node.id === intakeId(graph)).label = '进入';

  const current = await currentGraph(route);
  const { status, json } = await postGraph(route, {
    playbookId: PLAYBOOK_ID,
    graph,
    expectedRevision: current.revision,
  });
  assert.equal(status, 200);
  assert.ok(json.graph && typeof json.graph === 'object');
  assert.equal(json.graph.name, 'UI 编辑图');
  assert.equal(json.graph.playbookId, PLAYBOOK_ID);
  assert.equal(typeof json.graph.contentHash, 'string');
  assert.ok(json.graph.contentHash.length > 0, 'contentHash is computed when saving');
  assert.equal(json.graph.revision, current.revision + 1, 'T8.6: revision increments on save');
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
  const before = await currentGraph(mount1.route);
  const saved = await postGraph(mount1.route, {
    playbookId: PLAYBOOK_ID,
    graph,
    expectedRevision: before.revision,
  });
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
  // v2 T8.6a：GET /graph 是扁平投影。
  assert.equal(json.name, '重启后仍在');
  assert.equal(json.playbookId, PLAYBOOK_ID);
  assert.equal(json.layoutVersion, 2);
});

test('graph api: POST /layout merges positions only', async () => {
  const store = durableStore();
  const host = createHost({ store });
  const { route } = mount(host);
  const graph = buildDefaultGraph(PLAYBOOK);
  graph.name = '布局前';
  const before = await currentGraph(route);
  const saved = await postGraph(route, {
    playbookId: PLAYBOOK_ID,
    graph,
    expectedRevision: before.revision,
  });
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
  const before = await currentGraph(route);

  const deniedGraph = await postGraph(route, {
    playbookId: PLAYBOOK_ID,
    graph,
    expectedRevision: before.revision,
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
