import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import * as Http from '../../plugins/dsh-praxis/src/http.js';
import { createHost } from '../../plugins/dsh-praxis/src/host.js';

/**
 * Praxis v4 Wire 契约（docs/praxis/redesign/20-rewrite-brief.md §8）
 *   GET /praxis/api/state：wireVersion=3，含 branches / team / gates / evidenceRows
 *   无 run 时不伪造数据；有 run 时 gates 固定 10 项，PREREG_FROZEN 的门禁状态正确。
 */

const PORT = 3083;
const LOOPBACK = '127.0.0.1';
const BASE_HEADERS = { host: `${LOOPBACK}:${PORT}`, 'x-praxis-request': '1' };
const PREREG = {
  question: 'q', prediction: 'p', acceptance: 'a', acceptableFailure: 'f',
  controls: ['shuffle'], metrics: { primary: 'separation', threshold: 0.08 },
  input: { source: 'corpus' }, budget: { wallMin: 30 }, stop: { sameConclusion: 2 },
};

function mount(host) {
  const routes = [];
  const ctx = { webServer: { host: LOOPBACK, port: PORT, register(route) { routes.push(route); return () => {}; } } };
  Http.registerHttp(ctx, host);
  assert.equal(routes.length, 1);
  return { route: routes[0] };
}

function fakeReq({ method = 'GET', url = `${Http.API_PREFIX}/state`, body } = {}) {
  const chunks = body === undefined ? [] : [Buffer.from(typeof body === 'string' ? body : JSON.stringify(body))];
  const req = Readable.from(chunks);
  req.method = method;
  req.url = url;
  req.headers = { ...BASE_HEADERS };
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
  return { status: res.statusCode, json: res.body ? JSON.parse(res.body) : null };
}

const getState = (route) => call(route, fakeReq());

let seq = 0;
function command(action, payload = {}, runId = null) {
  seq += 1;
  return { commandId: `v4-wire-${action}-${seq}`, action, runId, payload };
}

async function postCommand(route, cmd) {
  return call(route, fakeReq({ method: 'POST', url: `${Http.API_PREFIX}/command`, body: { command: cmd } }));
}

async function startFrozen(route) {
  const started = await postCommand(route, command('start', { title: 'v4 wire', playbookId: 'scientific-loop' }));
  assert.equal(started.status, 200, JSON.stringify(started.json));
  const runId = started.json.receipt.runId;
  const asked = await postCommand(route, command('question', {
    question: { text: '结构增益是否来自结构？', hypothesis: '打乱后增益消失。', unknowns: ['容量'] },
  }, runId));
  assert.equal(asked.status, 200, JSON.stringify(asked.json));
  const frozen = await postCommand(route, command('prereg_freeze', { prereg: PREREG }, runId));
  assert.equal(frozen.status, 200, JSON.stringify(frozen.json));
  return runId;
}

test('无 run：wireVersion=3，branches=[]、team.source=none、gates=[]、evidenceRows=[]', async () => {
  const { route } = mount(createHost());
  const { status, json } = await getState(route);
  assert.equal(status, 200);
  assert.equal(json.wireVersion, 3);
  assert.equal(json.view.wireVersion, 3);
  assert.equal(json.view.design, 'Cockpit');
  assert.deepEqual(json.view.branches, []);
  assert.equal(json.view.team.source, 'none');
  assert.deepEqual(json.view.team.members, []);
  assert.deepEqual(json.view.gates, []);
  assert.deepEqual(json.view.evidenceRows, []);
});

test('有 run：branches 非空（b_main 起手）、gates 长度 10、evidenceRows 为数组', async () => {
  const { route } = mount(createHost());
  const runId = await startFrozen(route);
  const { status, json } = await getState(route);
  assert.equal(status, 200);
  assert.equal(json.view.activeRunId, runId);
  assert.ok(Array.isArray(json.view.branches));
  assert.ok(json.view.branches.length >= 1, '每个 run 起手至少 b_main');
  assert.equal(json.view.branches[0].id, 'b_main');
  for (const field of ['id', 'title', 'hypothesis', 'falsifiable', 'status', 'ownerId', 'ownerName',
    'ownerStatus', 'evidenceCount', 'supports', 'contradicts', 'verdict', 'taskId', 'updatedAt']) {
    assert.ok(Object.hasOwn(json.view.branches[0], field), `BranchView 缺字段 ${field}`);
  }
  assert.equal(json.view.gates.length, 10, 'v4 门禁轨固定 10 项');
  assert.ok(Array.isArray(json.view.evidenceRows));
  assert.equal(json.view.team.source, 'none');
});

test('PREREG_FROZEN 时门禁：question/prereg=passed，discussion=blocked，其余 future', async () => {
  const { route } = mount(createHost());
  await startFrozen(route);
  const { json } = await getState(route);
  const gates = Object.fromEntries(json.view.gates.map((gate) => [gate.id, gate]));
  assert.equal(json.view.gates.length, 10);
  assert.equal(gates.question.status, 'passed');
  assert.equal(gates.prereg.status, 'passed');
  assert.equal(gates.discussion.status, 'blocked');
  for (const id of ['experiment', 'review', 'stage4', 'eval', 'eval_read', 'memory', 'decision']) {
    assert.equal(gates[id].status, 'future', `${id} 应为 future`);
  }
  assert.equal(typeof gates.discussion.label, 'string');
  assert.ok(gates.discussion.label.length > 0);
});

test('分支命令经 HTTP 写入后 state.branches 增加，版本前移（v4 并行分支可用）', async () => {
  const { route } = mount(createHost());
  const runId = await startFrozen(route);
  const proposed = await postCommand(route, command('branch_propose', {
    title: '结构消融', hypothesis: '打乱破坏增益', falsifiable: '打乱后 separation 下降 ≥0.08', ownerId: 'agent-alpha',
  }, runId));
  assert.equal(proposed.status, 200, JSON.stringify(proposed.json));
  assert.equal(proposed.json.receipt.status, 'committed');
  const { json } = await getState(route);
  const created = json.view.branches.find((branch) => branch.id !== 'b_main');
  assert.ok(created, 'HTTP 写入后应出现自定义分支');
  assert.equal(created.status, 'proposed');
  assert.equal(created.ownerId, 'agent-alpha');
  assert.equal(created.falsifiable, '打乱后 separation 下降 ≥0.08');
  assert.ok(json.view.revision >= 4);
});

test('evidenceRows 由 claims 投影：主张、状态、支持/反驳计数与最新来源可读', async () => {
  const { route } = mount(createHost());
  const runId = await startFrozen(route);
  await postCommand(route, command('map_claim', {
    claim: '结构增益与容量无关', evidenceRefs: ['run/seeds-1-3.json', 'review/r-12.md'], status: 'supported',
  }, runId));
  const { json } = await getState(route);
  assert.equal(json.view.evidenceRows.length, 1);
  const row = json.view.evidenceRows[0];
  assert.equal(row.claim, '结构增益与容量无关');
  assert.equal(row.status, 'supported');
  assert.equal(row.supports, 2);
  assert.equal(row.contradicts, 0);
  assert.equal(row.latestSource, 'review/r-12.md');
  for (const field of ['claimId', 'claim', 'status', 'supports', 'contradicts', 'latestSource', 'latestAt']) {
    assert.ok(Object.hasOwn(row, field), `EvidenceRow 缺字段 ${field}`);
  }
});
