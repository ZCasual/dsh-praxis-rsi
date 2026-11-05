import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEngine } from '../../plugins/dsh-praxis/src/engine.js';
import {
  mainBranchDraft, branchView, BRANCH_MAIN_ID, MIN_FALSIFIABLE_LENGTH,
} from '../../plugins/dsh-praxis/src/branch.js';

/**
 * Praxis v4 分支契约（docs/praxis/redesign/20-rewrite-brief.md §2.2/§2.3）
 * 全部走真实 engine.execute，不用手写 run。
 */

const PREREG = {
  question: '结构增益是否来自结构？',
  prediction: '打乱结构后主指标下降 ≥0.08。',
  acceptance: '主指标超过基线 0.08 且对照被破坏时通过。',
  acceptableFailure: '对照无效则接受假设不成立。',
  controls: ['shuffle', 'label-shuffle'],
  metrics: { primary: 'separation', threshold: 0.08 },
  input: { source: 'declared-corpus' },
  budget: { wallMin: 30 },
  stop: { sameConclusion: 2 },
};

function boot() {
  const engine = createEngine();
  let seq = 0;
  const send = (action, payload = {}, runId = null, actor = { kind: 'root', id: 'agent' }) => {
    seq += 1;
    return engine.execute({ commandId: `${action}-${seq}`, action, runId, payload, actor });
  };
  const started = send('start', { title: 'v4 分支契约', playbookId: 'scientific-loop' });
  const runId = started.runId;
  const step = (action, payload = {}, actor = { kind: 'root', id: 'agent' }) => {
    const result = send(action, payload, runId, actor);
    if (result.status !== 'committed') throw new Error(`${action} rejected: ${result.reasonCode}`);
    return result;
  };
  step('question', { question: { text: '结构增益是否来自结构？', hypothesis: '若来自结构，打乱后增益消失。', unknowns: ['容量'] } });
  step('prereg_freeze', { prereg: PREREG });
  const run = () => engine.snapshot().runs.find((item) => item.id === runId);
  const raw = () => engine.dump().runs.find((item) => item.id === runId);
  const tryCmd = (action, payload = {}, actor = { kind: 'root', id: 'agent' }) => send(action, payload, runId, actor);
  return { engine, runId, step, run, raw, send, tryCmd };
}

function propose(step, overrides = {}) {
  const result = step('branch_propose', {
    title: overrides.title ?? '结构消融',
    hypothesis: overrides.hypothesis ?? '打乱结构会破坏增益',
    falsifiable: overrides.falsifiable ?? '打乱结构后 separation 下降 ≥0.08',
    ownerId: overrides.ownerId,
  });
  return result.branchId;
}

test('start 自动创建 b_main 主命题分支，状态 proposed', () => {
  const { run } = boot();
  const branches = run().branches;
  assert.equal(branches.length, 1);
  assert.equal(branches[0].id, BRANCH_MAIN_ID);
  assert.equal(branches[0].status, 'proposed');
  assert.equal(branches[0].title, '主命题');
  assert.ok(run().events.some((event) => event.type === 'branch.proposed' && event.branchId === BRANCH_MAIN_ID));
  assert.equal(mainBranchDraft().id, BRANCH_MAIN_ID);
});

test('PREREG_FROZEN 之前 branch_activate → INVALID_TRANSITION', () => {
  const engine = createEngine();
  const started = engine.execute({
    commandId: 'start-early', action: 'start', payload: { title: 'early', playbookId: 'scientific-loop' },
    actor: { kind: 'root', id: 'agent' },
  });
  const activated = engine.execute({
    commandId: 'activate-early', action: 'branch_activate', runId: started.runId,
    payload: { branchId: BRANCH_MAIN_ID }, actor: { kind: 'root', id: 'agent' },
  });
  assert.equal(activated.status, 'rejected');
  assert.equal(activated.reasonCode, 'INVALID_TRANSITION');
});

test('propose→assign→activate：同一 Run 可同时允许多条 active（B2）', () => {
  const { step, run } = boot();
  const first = propose(step, { title: '主假设', ownerId: undefined });
  step('branch_assign', { branchId: first, ownerId: 'agent-alpha' });
  step('branch_activate', { branchId: first });
  const second = propose(step, { title: '容量对照' });
  step('branch_assign', { branchId: second, ownerId: 'agent-beta' });
  step('branch_activate', { branchId: second });
  const active = run().branches.filter((branch) => branch.status === 'active');
  assert.equal(active.length, 2, 'B2 要求允许多条 active 并行');
  assert.deepEqual(active.map((branch) => branch.ownerId).sort(), ['agent-alpha', 'agent-beta']);
  const view = branchView(run());
  assert.equal(view.find((branch) => branch.id === first).ownerName, 'agent-alpha');
  assert.equal(view.find((branch) => branch.id === first).ownerStatus, 'unknown');
});

test('evidence×3（2 支持 1 反驳）：supports/contradicts/evidenceCount 正确且视图可读', () => {
  const { step, run, raw } = boot();
  const id = propose(step);
  step('branch_activate', { branchId: id });
  step('branch_evidence', { branchId: id, kind: 'experiment', ref: 'run/seeds.json', supports: true });
  step('branch_evidence', { branchId: id, kind: 'review', ref: 'review/r-12.md', supports: true });
  step('branch_evidence', { branchId: id, kind: 'external', ref: 'arxiv:2601.00001', supports: false });
  const view = run().branches.find((branch) => branch.id === id);
  assert.equal(view.evidenceCount, 3);
  assert.equal(view.supports, 2);
  assert.equal(view.contradicts, 1);
  assert.equal(raw().branches.find((branch) => branch.id === id).evidence.length, 3);
  assert.equal(branchView(raw()).find((branch) => branch.id === id).evidenceCount, 3);
});

test('verdict supported → merge 到 b_main，mergedInto 正确（B3）', () => {
  const { step, run, raw } = boot();
  const id = propose(step);
  step('branch_activate', { branchId: id });
  step('branch_evidence', { branchId: id, kind: 'experiment', ref: 'run/seeds.json', supports: true });
  step('branch_verdict', { branchId: id, verdict: 'supported', reason: '对照被破坏，增益消失' });
  assert.equal(raw().branches.find((branch) => branch.id === id).status, 'supported');
  step('branch_merge', { branchId: id, into: BRANCH_MAIN_ID });
  const merged = raw().branches.find((branch) => branch.id === id);
  assert.equal(merged.status, 'merged');
  assert.equal(merged.mergedInto, BRANCH_MAIN_ID);
  const events = raw().events.filter((event) => event.type === 'branch.merged');
  assert.equal(events.length, 1);
  assert.equal(events[0].branchId, id);
});

test('B1：falsifiable 为空/过短时 verdict 被拒（BRANCH_UNFALSIFIABLE）', () => {
  const { step, run, tryCmd } = boot();
  const short = propose(step, { falsifiable: '太短' });
  const rejected = tryCmd('branch_verdict', { branchId: short, verdict: 'supported', reason: '想直接下结论' });
  assert.equal(rejected.status, 'rejected');
  assert.equal(rejected.reasonCode, 'BRANCH_UNFALSIFIABLE');
  assert.equal(run().branches.find((branch) => branch.id === short).status, 'proposed');
  assert.ok(MIN_FALSIFIABLE_LENGTH >= 8);
  const empty = propose(step, { falsifiable: '   ' });
  const emptyRejected = tryCmd('branch_verdict', { branchId: empty, verdict: 'refuted', reason: '空陈述' });
  assert.equal(emptyRejected.reasonCode, 'BRANCH_UNFALSIFIABLE');
});

test('B4：evidence kind 非 experiment|external|review|eval 或 ref 为空 → BRANCH_EVIDENCE_INVALID', () => {
  const { step, tryCmd } = boot();
  const id = propose(step);
  step('branch_activate', { branchId: id });
  const badKind = tryCmd('branch_evidence', { branchId: id, kind: 'telepathy', ref: 'x:1', supports: true });
  assert.equal(badKind.status, 'rejected');
  assert.equal(badKind.reasonCode, 'BRANCH_EVIDENCE_INVALID');
  assert.ok(Array.isArray(badKind.violations) && badKind.violations.some((item) => item.code === 'B4'));
  const badRef = tryCmd('branch_evidence', { branchId: id, kind: 'experiment', ref: '   ', supports: true });
  assert.equal(badRef.reasonCode, 'BRANCH_EVIDENCE_INVALID');
});

test('权限：evaluator 只能提交 kind=eval 的 branch_evidence，其它 kind 被拒', () => {
  const { step, tryCmd } = boot();
  const id = propose(step);
  step('branch_activate', { branchId: id });
  const evaluator = { kind: 'evaluator', id: 'eval-1' };
  const bad = tryCmd('branch_evidence', { branchId: id, kind: 'experiment', ref: 'run/x.json', supports: true }, evaluator);
  assert.equal(bad.status, 'rejected');
  assert.equal(bad.reasonCode, 'FORBIDDEN_ACTOR');
  const good = step('branch_evidence', { branchId: id, kind: 'eval', ref: 'eval/report.json', supports: false }, evaluator);
  assert.equal(good.status, 'committed');
});

test('权限：coding 调 branch_activate → FORBIDDEN_ACTOR 且不写分支事件', () => {
  const { step, raw, tryCmd } = boot();
  const id = propose(step);
  const branchEventsBefore = raw().events.filter((event) => String(event.type).startsWith('branch.')).length;
  const denied = tryCmd('branch_activate', { branchId: id }, { kind: 'coding', id: 'code-1' });
  assert.equal(denied.status, 'rejected');
  assert.equal(denied.reasonCode, 'FORBIDDEN_ACTOR');
  assert.equal(raw().branches.find((branch) => branch.id === id).status, 'proposed');
  assert.equal(raw().events.filter((event) => String(event.type).startsWith('branch.')).length, branchEventsBefore, '被拒命令不应写 branch 事件');
});

test('dump/load 后 branches 与证据完整保留（append-only 事件可重放）', () => {
  const { engine, step, raw } = boot();
  const id = propose(step, { title: '持久分支' });
  step('branch_assign', { branchId: id, ownerId: 'agent-alpha' });
  step('branch_activate', { branchId: id });
  step('branch_evidence', { branchId: id, kind: 'experiment', ref: 'run/a.json', supports: true });
  step('branch_verdict', { branchId: id, verdict: 'inconclusive', reason: '样本不足' });
  const before = JSON.parse(JSON.stringify(raw().branches));
  const runId = raw().id;
  const dump = engine.dump();
  const restored = createEngine();
  assert.equal(restored.load(dump), true);
  const after = restored.dump().runs.find((item) => item.id === runId).branches;
  assert.deepEqual(after.map((branch) => ({ id: branch.id, status: branch.status })), before.map((branch) => ({ id: branch.id, status: branch.status })));
  const restoredBranch = after.find((branch) => branch.id === id);
  assert.equal(restoredBranch.evidence.length, 1);
  assert.equal(restoredBranch.verdict.verdict, 'inconclusive');
  assert.equal(restoredBranch.ownerId, 'agent-alpha');
});
