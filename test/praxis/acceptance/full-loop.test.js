import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { existsSync, unlinkSync } from 'node:fs';
import { registerHttp, API_PREFIX } from '../../../plugins/dsh-praxis/src/http.js';
import { createHost } from '../../../plugins/dsh-praxis/src/host.js';
import { createStore } from '../../../plugins/dsh-praxis/src/store.js';

/**
 * 真实 HTTP handler 全生命周期验收（delegatedActor 修复，2026-11-05）：
 * UI 以 user 身份提交，evaluator/root 的权限动作必须通过 payload.delegatedActor 委托完成；
 * 断言每步 200、最终状态 DECISION、actor.delegated 事件两条（evaluator/root 各一），
 * 且 receipt 不泄漏内部异常。
 */

const PORT = 3081;
const LOOPBACK = '127.0.0.1';
const BASE_HEADERS = { host: `${LOOPBACK}:${PORT}`, 'x-praxis-request': '1' };
const STATE_PATH = `/tmp/praxis-acceptance/full-loop-${process.pid}.json`;

const PREREG = {
  question: '未知结构能否从声明语料中被主动提取？',
  prediction: 'held-out 分离度高于基线 0.08',
  acceptance: '主指标超过基线且对照被破坏',
  acceptableFailure: '若对照未被破坏，接受该表示无效',
  controls: ['shuffle', 'label-shuffle'],
  metrics: { primary: 'separation', threshold: 0.08, seeds: 3 },
  input: { source: 'declared-corpus', split: 'train', evalSplit: 'held-out' },
  budget: { wallMin: 30, agents: 4 },
  stop: { sameConclusion: 2 },
};
const PACKAGES = [
  { persona: 'theorist', claim: '结构可提取', assumptions: ['信号存在'], evidence: ['d:1'], style: 'theoretical', minority: true, retained: true },
  { persona: 'empiricist', claim: '只有均值回归', assumptions: ['噪声解释'], evidence: ['d:2'], style: 'empirical', minority: false, retained: true },
];
const PERSONA = {
  role: 'devil',
  topicBinding: {
    defaultAssumptionToAttack: '熟悉路径足够',
    expectedCounterexample: '跨域反例',
    falsifiableDisagreement: '若对照被破坏则承认',
  },
  sinthome: { strategy: '先写反例', observableWorkProduct: 'counterexample' },
};

function mount(host) {
  const routes = [];
  const ctx = { webServer: { host: LOOPBACK, port: PORT, register(route) { routes.push(route); return () => {}; } } };
  registerHttp(ctx, host);
  assert.equal(routes.length, 1);
  return routes[0];
}

function fakeReq({ method = 'GET', url = `${API_PREFIX}/state`, headers = {}, body } = {}) {
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

let seq = 0;
function makeCommand(action, { runId, payload = {}, delegatedActor } = {}) {
  seq += 1;
  const fullPayload = delegatedActor ? { ...payload, delegatedActor } : payload;
  return {
    command: {
      commandId: `full-loop-${action}-${seq}`,
      action,
      runId,
      payload: fullPayload,
    },
  };
}

async function command(route, action, options = {}) {
  const response = await call(route, fakeReq({ method: 'POST', url: `${API_PREFIX}/command`, body: makeCommand(action, options) }));
  return { response, receipt: response.json?.receipt };
}

function assertCommitted(step, response) {
  assert.equal(response.status, 200, `${step}: expected 200, got ${response.status} ${JSON.stringify(response.json)}`);
  assert.equal(response.json.receipt.status, 'committed', `${step}: receipt.status`);
  assert.equal(response.json.receipt.reasonCode ?? null, null, `${step}: committed receipt must not carry reasonCode`);
}

test('acceptance full-loop: delegated user session reaches DECISION with two actor.delegated events', async () => {
  const store = createStore({ path: STATE_PATH });
  const host = createHost({ store });
  const route = mount(host);
  try {
    const started = await command(route, 'start', { payload: { playbookId: 'scientific-loop', title: '全链路验收' } });
    assertCommitted('start', started.response);
    const runId = started.receipt.runId;
    assert.ok(runId);

    const steps = [
      ['question', { payload: { question: { text: '未知结构能否从声明语料中被主动提取？', hypothesis: '冻结基线之上存在可分离结构', unknowns: ['噪声上限'] } } }],
      ['prereg_freeze', { payload: { prereg: PREREG } }],
      ['pin_persona', { payload: { persona: PERSONA } }],
      ['discussion', { payload: { round: 1, packages: PACKAGES } }],
      ['experiment', { payload: { command: 'train + held-out probe', artifactHash: 'artifact-sha-1' } }],
      ['review', { payload: { verdict: 'pass', items: ['对照被破坏'] } }],
      ['stage4', { payload: {} }],
      ['eval_report', { payload: { reportHash: 'eval-report-sha-1', verdict: 'pass', seeds: 3 }, delegatedActor: 'evaluator' }],
      ['eval_read', { payload: { reportHash: 'eval-report-sha-1' } }],
      ['memory_propose', { payload: { claim: '主动提取优于均值基线', evidenceRefs: ['eval-report-sha-1'] }, delegatedActor: 'root' }],
    ];
    for (const [action, options] of steps) {
      const result = await command(route, action, { ...options, runId });
      assertCommitted(action, result.response);
    }

    // memory_commit / decision remain user-only
    const stateAfterPropose = await call(route, fakeReq({ url: `${API_PREFIX}/state` }));
    const proposals = stateAfterPropose.json.view.active.memory.proposals;
    assert.ok(proposals.length >= 1);
    const proposalId = proposals.at(-1).id;
    assertCommitted('memory_commit', (await command(route, 'memory_commit', { runId, payload: { proposalId } })).response);
    assertCommitted('decision', (await command(route, 'decision', {
      runId,
      payload: { conclusion: '在声明语料上，主动提取优于均值基线', next: 'new-run', evidenceRefs: ['eval-report-sha-1'], ambition: 0.7 },
    })).response);
    assertCommitted('map_claim', (await command(route, 'map_claim', { runId, payload: { claim: '结构存在', evidenceRefs: ['eval-report-sha-1'] } })).response);

    const finalState = await call(route, fakeReq({ url: `${API_PREFIX}/state` }));
    assert.equal(finalState.status, 200);
    assert.equal(finalState.json.view.active.state, 'DECISION', 'final state must be DECISION');

    const evidence = await call(route, fakeReq({ url: `${API_PREFIX}/evidence` }));
    assert.equal(evidence.status, 200);
    const runEvidence = evidence.json.evidence.runs.find((item) => item.id === runId);
    assert.ok(runEvidence, 'evidence run');
    const delegated = runEvidence.events.filter((event) => event.type === 'actor.delegated');
    assert.equal(delegated.length, 2, `actor.delegated events actual=${JSON.stringify(delegated)}`);
    const kinds = delegated.map((event) => event.data?.kind ?? event.kind ?? event.actor?.kind).sort();
    assert.deepEqual(kinds, ['evaluator', 'root'], `delegated kinds actual=${JSON.stringify(kinds)}`);
    for (const event of delegated) {
      assert.equal(event.data?.delegatedBy ?? event.delegatedBy, 'owner');
      assert.equal(typeof (event.data?.action ?? event.action), 'string');
    }

    // receipt 不得泄漏内部异常：只允许契约字段；committed 回执无 reasonCode/stack。
    for (const receipt of runEvidence.receipts) {
      const serialized = JSON.stringify(receipt);
      assert.equal(/TypeError|ReferenceError|ENOENT|at Object\.|stack trace/.test(serialized), false, `receipt leaks internals: ${serialized}`);
      if (receipt.status === 'committed') assert.equal(receipt.reasonCode ?? null, null);
    }
  } finally {
    await store.close();
    if (existsSync(STATE_PATH)) unlinkSync(STATE_PATH);
  }
});
