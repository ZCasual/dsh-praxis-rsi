import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import * as Http from '../../plugins/dsh-praxis/src/http.js';
import { createHost } from '../../plugins/dsh-praxis/src/host.js';
import * as Engine from '../../plugins/dsh-praxis/src/engine.js';

/**
 * Praxis v2 契约红测：Wire（docs/praxis/redesign/10-v2-contract.md §3）
 *   T8.1 wireVersion=3 (v4) / T8.2 catalog / T8.3 view.graph 形状 / T8.4 state 信封
 *   T8.5 command 200/409/422 / T8.6 graph 读取与 expectedRevision 保存 / T8.7 evidence
 *
 * 断言只来自契约条文；实现未就绪时必须红。
 */

const PORT = 3081;
const LOOPBACK = '127.0.0.1';
const BASE_HEADERS = { host: `${LOOPBACK}:${PORT}`, 'x-praxis-request': '1' };
const EXPECTED_STATES = [
  'INTAKE', 'QUESTION', 'PREREG_FROZEN', 'DISCUSSION', 'EXECUTING',
  'REVIEW', 'STAGE4', 'EVAL', 'MEMORY', 'DECISION',
];
const PREREG = {
  question: 'q', prediction: 'p', acceptance: 'a', acceptableFailure: 'f',
  controls: ['shuffle'], metrics: { primary: 'separation', threshold: 0.08 },
  input: { source: 'corpus' }, budget: { wallMin: 30 }, stop: { sameConclusion: 2 },
};
const QUESTION = {
  question: { text: '未知结构能否被主动提取？', hypothesis: '基线之上有新结构', unknowns: ['噪声'] },
};

function mount(host) {
  const routes = [];
  const ctx = { webServer: { host: LOOPBACK, port: PORT, register(route) { routes.push(route); return () => {}; } } };
  assert.equal(typeof Http.registerHttp, 'function', 'http.js exports registerHttp');
  Http.registerHttp(ctx, host);
  assert.equal(routes.length, 1);
  return { route: routes[0], dispose: () => {} };
}

function fakeReq({ method = 'GET', url = `${Http.API_PREFIX}/state`, headers = {}, body } = {}) {
  const chunks = body === undefined ? [] : [Buffer.from(typeof body === 'string' ? body : JSON.stringify(body))];
  const req = Readable.from(chunks);
  req.method = method;
  req.url = url;
  req.headers = { ...BASE_HEADERS, ...headers };
  req.socket = { remoteAddress: LOOPBACK };
  return req;
}

function fakeRes() {
  return {
    statusCode: 0, headers: {}, body: '', ended: false,
    writeHead(status, headers) { this.statusCode = status; for (const [k, v] of Object.entries(headers ?? {})) this.headers[k.toLowerCase()] = v; return this; },
    write(chunk) { this.body += Buffer.from(chunk).toString('utf8'); return true; },
    end(chunk) { if (chunk !== undefined) this.body += Buffer.from(chunk).toString('utf8'); this.ended = true; return this; },
  };
}

async function call(route, req) {
  const res = fakeRes();
  await route.handler(req, res);
  assert.equal(res.ended, true);
  return { status: res.statusCode, headers: res.headers, json: res.body ? JSON.parse(res.body) : null };
}

const getState = (route) => call(route, fakeReq());
const postCommand = (route, command) => call(route, fakeReq({
  method: 'POST',
  url: `${Http.API_PREFIX}/command`,
  body: { command },
}));

let seq = 0;
function command(action, { runId, payload = {}, commandId, expectedDomainVersion } = {}) {
  seq += 1;
  return {
    commandId: commandId ?? `wire-${action}-${seq}`,
    action,
    runId,
    expectedDomainVersion,
    payload,
  };
}

async function startRun(route) {
  const response = await postCommand(route, command('start', { payload: { playbookId: 'scientific-loop', title: 'wire v2' } }));
  assert.equal(response.status, 200, `start must be 200 (got ${response.status}: ${JSON.stringify(response.json)})`);
  return response.json.receipt.runId;
}

// ---------------------------------------------------------------------------
// T8.1 / T8.2 catalog
// ---------------------------------------------------------------------------

test('wire T8.1/T8.2: state carries wireVersion=3 and a complete catalog', async () => {
  const { route } = mount(createHost());
  const { status, json } = await getState(route);
  assert.equal(status, 200);
  assert.equal(json.wireVersion, 3, 'v4 wireVersion');
  assert.ok(json.view, 'T8.4 envelope carries view');
  assert.equal(json.view.wireVersion, 3);
  const catalog = json.catalog ?? json.view.catalog;
  assert.ok(catalog && typeof catalog === 'object', 'T8.2 catalog');

  // states：10 个，按 STATE_ORDER，带 label/index
  assert.ok(Array.isArray(catalog.states));
  assert.deepEqual(catalog.states.map((state) => state.id), EXPECTED_STATES, 'catalog.states 顺序');
  for (const state of catalog.states) {
    assert.equal(typeof state.index, 'number');
    assert.equal(typeof state.label, 'string');
    assert.ok(state.label.length > 0);
    assert.notEqual(state.label, state.id, 'label 必须是人类可读中文，不是内部码');
  }

  // nodeExecution / nodeCondition：覆盖双轴全部枚举
  const executionIds = catalog.nodeExecution.map((item) => item.id);
  for (const id of ['pending', 'active', 'done', 'blocked', 'failed']) {
    assert.ok(executionIds.includes(id), `catalog.nodeExecution 缺 ${id}`);
  }
  const conditionIds = catalog.nodeCondition.map((item) => item.id);
  for (const id of ['missing', 'satisfied', 'stale', 'unknown']) {
    assert.ok(conditionIds.includes(id), `catalog.nodeCondition 缺 ${id}`);
  }
  for (const item of [...catalog.nodeExecution, ...catalog.nodeCondition]) {
    assert.equal(typeof item.label, 'string');
    assert.ok(item.label.length > 0);
    assert.equal(typeof item.tone, 'string');
  }

  // actions：契约动作必须齐全，且带人类可读 label
  const actionIds = catalog.actions.map((item) => item.id);
  for (const action of [
    'start', 'question', 'prereg_freeze', 'discussion', 'experiment', 'review',
    'stage4', 'eval_report', 'eval_read', 'memory_propose', 'memory_commit',
    'decision', 'set_knobs', 'graph_save', 'layout_save',
  ]) {
    assert.ok(actionIds.includes(action), `catalog.actions 缺 ${action}`);
  }
  for (const action of catalog.actions) {
    assert.equal(typeof action.label, 'string');
    assert.ok(action.label.length > 0);
    assert.notEqual(action.label, action.id);
    assert.ok(['run', 'graph', 'any'].includes(action.scope ?? 'run'), `action.scope ${action.scope}`);
  }

  // reasons：原因码 → 人类可读
  assert.ok(catalog.reasons && typeof catalog.reasons === 'object');
  for (const code of ['QUESTION_INCOMPLETE', 'QUESTION_REQUIRED', 'INVALID_TRANSITION', 'CONFLICT']) {
    assert.equal(typeof catalog.reasons[code], 'string', `catalog.reasons.${code}`);
    assert.ok(catalog.reasons[code].length > 0);
    assert.notEqual(catalog.reasons[code], code);
  }
});

// ---------------------------------------------------------------------------
// T8.3 / T8.4 view 信封与 graph 形状
// ---------------------------------------------------------------------------

test('wire T8.4: state envelope is {...view, view, serverTime, revision}, revision=run version', async () => {
  const { route } = mount(createHost());
  const runId = await startRun(route);
  const { status, json } = await getState(route);
  assert.equal(status, 200);
  assert.ok(json.view && json.view.active);
  assert.equal(json.view.active.id, runId);
  assert.equal(json.revision, json.view.active.version, 'T8.4 revision = active run version');
  assert.ok(!Number.isNaN(Date.parse(json.serverTime)), 'serverTime ISO');
});

test('wire T8.3: view.graph exposes the frozen graph shape', async () => {
  const { route } = mount(createHost());
  await startRun(route);
  const { json } = await getState(route);
  const graph = json.view.graph;
  assert.ok(graph, 'view.graph');
  for (const key of ['id', 'playbookId', 'revision', 'layoutVersion', 'nodes', 'edges', 'states', 'current', 'progress', 'audit']) {
    assert.ok(key in graph, `view.graph.${key} missing`);
  }
  assert.equal(graph.playbookId, 'scientific-loop');
  assert.equal(graph.layoutVersion, 2, 'T5.1');
  assert.ok(Array.isArray(graph.nodes) && graph.nodes.length === 15);
  assert.ok(Array.isArray(graph.edges));
  assert.equal(typeof graph.revision, 'number');
  assert.equal(typeof graph.audit.ok, 'boolean');
  assert.ok(Array.isArray(graph.audit.violations));
  const executionIds = ['pending', 'active', 'done', 'blocked', 'failed'];
  const conditionIds = ['missing', 'satisfied', 'stale', 'unknown'];
  for (const state of Object.values(graph.states)) {
    assert.ok(executionIds.includes(state.execution));
    assert.ok(conditionIds.includes(state.condition));
    assert.ok(state.reason === null || typeof state.reason === 'string');
  }
});

// ---------------------------------------------------------------------------
// T8.5 command 200 / 409 / 422
// ---------------------------------------------------------------------------

test('wire T8.5: successful command is 200 with {receipt, view}', async () => {
  const { route } = mount(createHost());
  const runId = await startRun(route);
  const response = await postCommand(route, command('question', { runId, payload: QUESTION }));
  assert.equal(response.status, 200);
  assert.equal(response.json.receipt.status, 'committed');
  assert.equal(response.json.receipt.state, 'QUESTION');
  assert.ok(response.json.view && response.json.view.active);
  assert.equal(response.json.view.active.state, 'QUESTION');
});

test('wire T8.5: expectedDomainVersion mismatch is HTTP 409 CONFLICT carrying current view', async () => {
  const { route } = mount(createHost());
  const runId = await startRun(route);
  const before = (await getState(route)).json.view.active.version;
  const response = await postCommand(route, command('question', {
    runId,
    payload: QUESTION,
    expectedDomainVersion: before + 99,
  }));
  assert.equal(response.status, 409);
  assert.equal(response.json.code, 'CONFLICT');
  assert.ok(response.json.view, '409 must carry current view');
  assert.equal(response.json.view.active.version, before, 'view 为最新版本');
});

test('wire T8.5: rejected command is HTTP 422 with receipt/view/nextAction/blockers', async () => {
  const { route } = mount(createHost());
  const runId = await startRun(route);
  const response = await postCommand(route, command('prereg_freeze', { runId, payload: { prereg: PREREG } }));
  assert.equal(response.status, 422);
  assert.equal(response.json.code, 'QUESTION_REQUIRED');
  assert.ok(response.json.receipt, '422 carries receipt');
  assert.equal(response.json.receipt.status, 'rejected');
  assert.ok(response.json.view, '422 carries view');
  assert.equal(response.json.nextAction, 'question');
  assert.ok(Array.isArray(response.json.blockers), '422 carries blockers');
});

test('wire T8.5: out-of-order action is 422 INVALID_TRANSITION', async () => {
  const { route } = mount(createHost());
  const runId = await startRun(route);
  const response = await postCommand(route, command('experiment', {
    runId,
    payload: { command: 'probe' },
  }));
  assert.equal(response.status, 422);
  assert.equal(response.json.code, 'INVALID_TRANSITION');
  assert.equal(response.json.receipt.status, 'rejected');
  assert.ok(response.json.view);
});

// ---------------------------------------------------------------------------
// T8.6 graph GET / expectedRevision 保存
// ---------------------------------------------------------------------------

test('wire T8.6: GET /graph?runId returns the same shape as view.graph', async () => {
  const { route } = mount(createHost());
  const runId = await startRun(route);
  const response = await call(route, fakeReq({ url: `${Http.API_PREFIX}/graph?runId=${runId}` }));
  assert.equal(response.status, 200);
  // T8.6a：扁平投影，无 {graph:...} 包装。
  assert.equal('graph' in response.json, false, 'GET /graph must be flat');
  const graph = response.json;
  assert.equal(graph.playbookId, 'scientific-loop');
  assert.equal(graph.layoutVersion, 2);
  assert.ok(Array.isArray(graph.nodes) && graph.nodes.length === 15);
  const stateResponse = await getState(route);
  assert.deepEqual(graph.states, stateResponse.json.view.graph.states, 'GET /graph states == view.graph.states');
});

test('wire T8.6: POST /graph requires expectedRevision; stale revision is 409 with current graph', async () => {
  const { route } = mount(createHost());
  const runId = await startRun(route);
  const state = (await getState(route)).json;
  const graph = state.view.graph;
  const expectedRevision = graph.revision;

  const missing = await call(route, fakeReq({
    method: 'POST',
    url: `${Http.API_PREFIX}/graph`,
    body: { playbookId: 'scientific-loop', graph },
  }));
  assert.equal(missing.status, 428, 'T8.6: 缺 expectedRevision 必须 428');
  assert.equal(missing.json.code, 'REVISION_REQUIRED');

  const stale = await call(route, fakeReq({
    method: 'POST',
    url: `${Http.API_PREFIX}/graph`,
    body: { playbookId: 'scientific-loop', graph, expectedRevision: expectedRevision + 7 },
  }));
  assert.equal(stale.status, 409);
  assert.ok(stale.json.graph, '409 必须携带当前图');

  const okResponse = await call(route, fakeReq({
    method: 'POST',
    url: `${Http.API_PREFIX}/graph`,
    body: { playbookId: 'scientific-loop', graph, expectedRevision },
  }));
  assert.equal(okResponse.status, 200, JSON.stringify(okResponse.json));
  assert.ok(okResponse.json.receipt, '200 carries the save receipt');
  const savedGraph = okResponse.json.graph;
  assert.ok(savedGraph.revision > expectedRevision, '保存后 revision 递增');
  // 保存确实落盘：重新 GET 得到新 revision（扁平投影）。
  const after = await call(route, fakeReq({ url: `${Http.API_PREFIX}/graph?runId=${runId}` }));
  assert.equal(after.json.revision, savedGraph.revision);
});

// ---------------------------------------------------------------------------
// T8.7 evidence
// ---------------------------------------------------------------------------

test('wire T8.7: GET /evidence exposes runs with receipts/events plus audit', async () => {
  const { route } = mount(createHost());
  const runId = await startRun(route);
  const response = await call(route, fakeReq({ url: `${Http.API_PREFIX}/evidence` }));
  assert.equal(response.status, 200);
  const evidence = response.json.evidence;
  assert.ok(evidence && typeof evidence === 'object', 'evidence envelope');
  assert.ok(Array.isArray(evidence.runs) && evidence.runs.length >= 1);
  const run = evidence.runs.find((item) => item.id === runId);
  assert.ok(run, 'evidence.runs contains the active run');
  for (const key of ['id', 'state', 'version', 'receipts', 'events']) {
    assert.ok(key in run, `evidence run.${key}`);
  }
  assert.ok(Array.isArray(run.receipts));
  assert.ok(Array.isArray(run.events));
  assert.ok(evidence.audit && typeof evidence.audit.ok === 'boolean');
});

// ---------------------------------------------------------------------------
// delegatedActor：UI user 会话委托 evaluator/root 权限（2026-11-05 修复）
// ---------------------------------------------------------------------------

async function commitStep(route, action, payload, runId) {
  const response = await postCommand(route, command(action, { runId, payload }));
  assert.equal(response.status, 200, `${action} must be 200, got ${response.status} ${JSON.stringify(response.json)}`);
  return response.json.receipt;
}

test('wire T8.5: eval_report without/invalid delegatedActor is 422 FORBIDDEN_ACTOR, valid evaluator is 200', async () => {
  const { route } = mount(createHost());
  const runId = await startRun(route);
  await commitStep(route, 'question', QUESTION, runId);
  await commitStep(route, 'prereg_freeze', { prereg: PREREG }, runId);
  await commitStep(route, 'discussion', { round: 1, packages: [] }, runId);
  await commitStep(route, 'experiment', { command: 'probe', artifactHash: 'a' }, runId);
  await commitStep(route, 'review', { verdict: 'pass', items: [] }, runId);
  await commitStep(route, 'stage4', {}, runId);

  const missing = await postCommand(route, command('eval_report', {
    runId, payload: { reportHash: 'r1', verdict: 'pass', seeds: 3 },
  }));
  assert.equal(missing.status, 422, `no delegatedActor actual=${missing.status} ${JSON.stringify(missing.json)}`);
  assert.equal(missing.json.code, 'FORBIDDEN_ACTOR');

  const invalid = await postCommand(route, command('eval_report', {
    runId, payload: { reportHash: 'r1', verdict: 'pass', seeds: 3, delegatedActor: 'admin' },
  }));
  assert.equal(invalid.status, 422, `invalid delegatedActor must be ignored actual=${invalid.status}`);
  assert.equal(invalid.json.code, 'FORBIDDEN_ACTOR');

  const delegated = await postCommand(route, command('eval_report', {
    runId, payload: { reportHash: 'r1', verdict: 'pass', seeds: 3, delegatedActor: 'evaluator' },
  }));
  assert.equal(delegated.status, 200, `delegated evaluator actual=${delegated.status} ${JSON.stringify(delegated.json)}`);
  assert.equal(delegated.json.receipt.status, 'committed');
});

test('wire T8.5: memory_propose without/invalid delegatedActor is 422 FORBIDDEN_ACTOR, valid root is 200', async () => {
  const { route } = mount(createHost());
  const runId = await startRun(route);
  await commitStep(route, 'question', QUESTION, runId);
  await commitStep(route, 'prereg_freeze', { prereg: PREREG }, runId);
  await commitStep(route, 'discussion', { round: 1, packages: [] }, runId);
  await commitStep(route, 'experiment', { command: 'probe', artifactHash: 'a' }, runId);
  await commitStep(route, 'review', { verdict: 'pass', items: [] }, runId);
  await commitStep(route, 'stage4', {}, runId);
  await commitStep(route, 'eval_report', { reportHash: 'r1', verdict: 'pass', seeds: 3, delegatedActor: 'evaluator' }, runId);
  await commitStep(route, 'eval_read', { reportHash: 'r1' }, runId);

  const missing = await postCommand(route, command('memory_propose', {
    runId, payload: { claim: 'c', evidenceRefs: ['r1'] },
  }));
  assert.equal(missing.status, 422, `no delegatedActor actual=${missing.status}`);
  assert.equal(missing.json.code, 'FORBIDDEN_ACTOR');

  const invalid = await postCommand(route, command('memory_propose', {
    runId, payload: { claim: 'c', evidenceRefs: ['r1'], delegatedActor: 'admin' },
  }));
  assert.equal(invalid.status, 422);
  assert.equal(invalid.json.code, 'FORBIDDEN_ACTOR');

  const delegated = await postCommand(route, command('memory_propose', {
    runId, payload: { claim: 'c', evidenceRefs: ['r1'], delegatedActor: 'root' },
  }));
  assert.equal(delegated.status, 200, `delegated root actual=${delegated.status} ${JSON.stringify(delegated.json)}`);
  assert.equal(delegated.json.receipt.status, 'committed');

  const evidence = await call(route, fakeReq({ url: `${Http.API_PREFIX}/evidence` }));
  const run = evidence.json.evidence.runs.find((item) => item.id === runId);
  const delegatedEvents = run.events.filter((event) => event.type === 'actor.delegated');
  assert.equal(delegatedEvents.length, 2, `actor.delegated events actual=${JSON.stringify(delegatedEvents)}`);
});
