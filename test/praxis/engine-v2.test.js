import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as Engine from '../../plugins/dsh-praxis/src/engine.js';

/**
 * Praxis v2 契约红测：引擎真值模型（docs/praxis/redesign/10-v2-contract.md §1）
 *
 * 断言只来自契约条文，不复制现有实现返回值：
 *   T1.1 question 动作 / T1.2 QUESTION_REQUIRED / T1.3 INVALID_TRANSITION
 *   T4.1 fork 纯净性 / T4.2 fork 未重冻结前 experiment 门禁 / T4.3 dump 迁移
 *
 * 实现尚未就绪时本文件必须红；禁止为了让测试变绿而放宽断言。
 */

const EXPECTED_STATE_ORDER = [
  'INTAKE', 'QUESTION', 'PREREG_FROZEN', 'DISCUSSION', 'EXECUTING',
  'REVIEW', 'STAGE4', 'EVAL', 'MEMORY', 'DECISION',
];

const PREREG = {
  question: '未知结构能否从声明语料中被主动提取？',
  prediction: 'held-out 分离度高于冻结基线 0.08',
  acceptance: '主指标超过基线且对照被破坏',
  acceptableFailure: '若对照未被破坏，接受该表示无效',
  controls: ['shuffle', 'label-shuffle'],
  metrics: { primary: 'separation', threshold: 0.08, seeds: 3 },
  input: { source: 'declared-corpus', split: 'train', evalSplit: 'held-out' },
  budget: { wallMin: 30, agents: 4 },
  stop: { sameConclusion: 2 },
};

const QUESTION = {
  question: {
    text: '未知结构能否从声明语料中被主动提取？',
    hypothesis: '冻结基线上存在可分离的新结构',
    unknowns: ['噪声上限', '对照是否被破坏'],
  },
};

const PERSONA = {
  role: 'devil',
  topicBinding: {
    defaultAssumptionToAttack: '熟悉路径足够',
    expectedCounterexample: '跨域反例',
    falsifiableDisagreement: '若对照被破坏则承认',
  },
  sinthome: { strategy: '先写反例', observableWorkProduct: 'counterexample' },
};

const PACKAGES = [
  {
    persona: 'theorist', claim: '未知结构可被主动提取', assumptions: ['信号存在于声明语料'],
    evidence: ['derivation:1'], style: 'theoretical', minority: true, retained: true,
  },
  {
    persona: 'empiricist', claim: '当前语料只支持均值回归', assumptions: ['噪声解释全部方差'],
    evidence: ['data:2'], style: 'empirical', minority: false, retained: true,
  },
];

function stateOrder() {
  assert.ok(Array.isArray(Engine.STATE_ORDER), 'engine.js must export STATE_ORDER (T1.1 / §1.1)');
  assert.deepEqual([...Engine.STATE_ORDER], EXPECTED_STATE_ORDER, 'STATE_ORDER 是唯一状态序');
  return Engine.STATE_ORDER;
}

function newEngine(options = {}) {
  assert.equal(typeof Engine.createEngine, 'function');
  return Engine.createEngine(options);
}

function actor(kind = 'root') {
  return { kind, id: `${kind}-1` };
}

let seq = 0;
function send(engine, action, { runId, payload = {}, actorKind = 'root', commandId, expectedDomainVersion } = {}) {
  seq += 1;
  return engine.execute({
    commandId: commandId ?? `v2-${action}-${seq}`,
    actor: actor(actorKind),
    action,
    runId,
    expectedDomainVersion,
    payload,
  });
}

function runView(engine, runId) {
  assert.equal(typeof engine.runView, 'function', 'engine.runView is the public Run reader');
  return engine.runView(runId);
}

function stateOf(engine, runId) {
  return runView(engine, runId).state;
}

function versionOf(engine, runId) {
  return runView(engine, runId).version;
}

function started(engine, title = 'v2 契约') {
  const receipt = send(engine, 'start', { payload: { playbookId: 'scientific-loop', title } });
  assert.equal(receipt.status, 'committed');
  assert.ok(receipt.runId);
  return receipt.runId;
}

function questioned(engine, title = 'v2 契约') {
  const runId = started(engine, title);
  const receipt = send(engine, 'question', { runId, payload: QUESTION });
  assert.equal(receipt.status, 'committed', 'question must commit from INTAKE');
  return runId;
}

function frozen(engine, title = 'v2 契约') {
  const runId = questioned(engine, title);
  const receipt = send(engine, 'prereg_freeze', { runId, payload: { prereg: PREREG } });
  assert.equal(receipt.status, 'committed', 'prereg_freeze must commit from QUESTION');
  return runId;
}

function fullRunToDecision(engine) {
  const runId = frozen(engine, 'fork 父 Run');
  assert.equal(send(engine, 'pin_persona', { runId, payload: { persona: PERSONA } }).status, 'committed');
  assert.equal(send(engine, 'discussion', { runId, payload: { round: 1, packages: PACKAGES } }).status, 'committed');
  assert.equal(send(engine, 'experiment', { runId, actorKind: 'coding', payload: { command: 'probe', artifactHash: 'artifact-1' } }).status, 'committed');
  assert.equal(send(engine, 'review', { runId, actorKind: 'reviewer', payload: { verdict: 'pass', items: ['对照被破坏'] } }).status, 'committed');
  assert.equal(send(engine, 'stage4', { runId, payload: {} }).status, 'committed');
  assert.equal(send(engine, 'eval_report', { runId, actorKind: 'evaluator', payload: { reportHash: 'report-1', verdict: 'pass', seeds: 3 } }).status, 'committed');
  assert.equal(send(engine, 'eval_read', { runId, payload: { reportHash: 'report-1' } }).status, 'committed');
  assert.equal(send(engine, 'memory_propose', { runId, payload: { claim: '新路径存在', evidenceRefs: ['e1'] } }).status, 'committed');
  const view = runView(engine, runId);
  const proposalId = view.memory.proposals.at(-1)?.id;
  assert.ok(proposalId, 'memory proposal id');
  assert.equal(send(engine, 'memory_commit', { runId, actorKind: 'user', payload: { proposalId } }).status, 'committed');
  assert.equal(send(engine, 'decision', { runId, actorKind: 'user', payload: { conclusion: '结构存在', next: 'new-run', evidenceRefs: ['e1'], ambition: 0.7 } }).status, 'committed');
  assert.equal(stateOf(engine, runId), 'DECISION');
  return runId;
}

/** 只推进到指定状态，供非法转移用例构造真实 Run。 */
function runTo(engine, target) {
  const runId = frozen(engine, `transition-${target}`);
  const steps = [
    ['PREREG_FROZEN', null],
    ['DISCUSSION', () => send(engine, 'discussion', { runId, payload: { round: 1, packages: PACKAGES } })],
    ['EXECUTING', () => send(engine, 'experiment', { runId, actorKind: 'coding', payload: { command: 'probe', artifactHash: 'a' } })],
    ['REVIEW', () => send(engine, 'review', { runId, actorKind: 'reviewer', payload: { verdict: 'pass', items: [] } })],
    ['STAGE4', () => send(engine, 'stage4', { runId, payload: {} })],
    ['EVAL', () => send(engine, 'eval_report', { runId, actorKind: 'evaluator', payload: { reportHash: 'r', verdict: 'pass', seeds: 3 } })],
    ['MEMORY', () => send(engine, 'eval_read', { runId, payload: { reportHash: 'r' } })],
  ];
  for (const [state, step] of steps) {
    if (state === target) return runId;
    if (step) assert.equal(step().status, 'committed', `advance to ${state}`);
  }
  assert.equal(stateOf(engine, runId), target);
  return runId;
}

/** dump 里定位 run：兼容 runs 数组与对象映射两种序列化。 */
function findDumpRun(dump, runId) {
  const runs = Array.isArray(dump?.runs) ? dump.runs : Object.values(dump?.runs ?? {});
  const found = runs.find((item) => item?.id === runId);
  assert.ok(found, `dump must contain run ${runId}`);
  return found;
}

// ---------------------------------------------------------------------------
// §1.1 状态机 + T1.1 question
// ---------------------------------------------------------------------------

test('v2 engine: STATE_ORDER is exported and is the single 10-state source', () => {
  stateOrder();
  assert.equal(EXPECTED_STATE_ORDER.includes('SYNTHESIS'), false);
  assert.equal(EXPECTED_STATE_ORDER.includes('EXEC_READY'), false);
});

test('v2 engine T1.1: question commits from INTAKE and records the question payload', () => {
  const engine = newEngine();
  const runId = started(engine);
  assert.equal(stateOf(engine, runId), 'INTAKE');
  const receipt = send(engine, 'question', { runId, payload: QUESTION });
  assert.equal(receipt.status, 'committed');
  assert.equal(receipt.state, 'QUESTION');
  assert.equal(receipt.nextAction, 'prereg_freeze');
  assert.deepEqual(receipt.blockers, ['prereg.frozen']);
  const view = runView(engine, runId);
  assert.equal(view.state, 'QUESTION');
  assert.deepEqual(view.question, QUESTION.question);
  assert.ok(view.version >= 2);
});

test('v2 engine T1.1: incomplete question is rejected with QUESTION_INCOMPLETE and no mutation', () => {
  const engine = newEngine();
  const runId = started(engine);
  const baseline = runView(engine, runId);
  for (const payload of [
    { question: { text: '短', hypothesis: '足够长的假设', unknowns: [] } },
    { question: { text: '足够长的问题文本', hypothesis: '   ', unknowns: [] } },
    { question: { text: '   ', hypothesis: '足够长的假设', unknowns: ['x'] } },
    {},
  ]) {
    const receipt = send(engine, 'question', { runId, payload });
    assert.equal(receipt.status, 'rejected', JSON.stringify(payload));
    assert.equal(receipt.reasonCode, 'QUESTION_INCOMPLETE', JSON.stringify(payload));
    assert.equal(receipt.nextAction, 'question');
    const view = runView(engine, runId);
    assert.equal(view.state, 'INTAKE');
    assert.equal(view.version, baseline.version);
    assert.equal(view.question, undefined);
  }
});

// ---------------------------------------------------------------------------
// T1.2 QUESTION_REQUIRED
// ---------------------------------------------------------------------------

test('v2 engine T1.2: prereg_freeze in INTAKE is QUESTION_REQUIRED and does not freeze', () => {
  const engine = newEngine();
  const runId = started(engine);
  const baseline = runView(engine, runId);
  const receipt = send(engine, 'prereg_freeze', { runId, payload: { prereg: PREREG } });
  assert.equal(receipt.status, 'rejected');
  assert.equal(receipt.reasonCode, 'QUESTION_REQUIRED');
  assert.equal(receipt.nextAction, 'question');
  const view = runView(engine, runId);
  assert.equal(view.state, 'INTAKE');
  assert.equal(view.version, baseline.version);
  assert.equal(view.preregHash, undefined);
});

test('v2 engine T1.2: prereg_freeze in QUESTION commits and freezes', () => {
  const engine = newEngine();
  const runId = questioned(engine);
  const receipt = send(engine, 'prereg_freeze', { runId, payload: { prereg: PREREG } });
  assert.equal(receipt.status, 'committed');
  assert.equal(receipt.state, 'PREREG_FROZEN');
  const view = runView(engine, runId);
  assert.equal(view.state, 'PREREG_FROZEN');
  assert.equal(view.prereg.frozen, true);
  assert.ok(view.preregHash);
});

// ---------------------------------------------------------------------------
// T1.3 INVALID_TRANSITION
// ---------------------------------------------------------------------------

test('v2 engine T1.3: every out-of-order transition is INVALID_TRANSITION with no mutation past', () => {
  const engine = newEngine();
  const cases = [
    { action: 'discussion', from: 'INTAKE', payload: { round: 1, packages: PACKAGES } },
    { action: 'experiment', from: 'QUESTION', payload: { command: 'probe' }, actorKind: 'coding' },
    { action: 'review', from: 'PREREG_FROZEN', payload: { verdict: 'pass', items: [] }, actorKind: 'reviewer' },
    { action: 'eval_report', from: 'DISCUSSION', payload: { reportHash: 'r', verdict: 'pass' }, actorKind: 'evaluator' },
    { action: 'decision', from: 'EVAL', payload: { conclusion: 'c', next: 'new-run', evidenceRefs: [] }, actorKind: 'user' },
  ];
  // 为每个前置状态构造真实 run。
  const builders = {
    INTAKE: () => started(engine, 'transition-intake'),
    QUESTION: () => questioned(engine, 'transition-question'),
    PREREG_FROZEN: () => frozen(engine, 'transition-prereg'),
    DISCUSSION: () => {
      const runId = frozen(engine, 'transition-discussion');
      assert.equal(send(engine, 'discussion', { runId, payload: { round: 1, packages: PACKAGES } }).status, 'committed');
      return runId;
    },
    EVAL: () => runTo(engine, 'EVAL'),
  };
  for (const { action, from, payload, actorKind } of cases) {
    const runId = builders[from]();
    const before = runView(engine, runId);
    const receipt = send(engine, action, { runId, payload, actorKind });
    assert.equal(receipt.status, 'rejected', `${action} from ${from}`);
    assert.equal(receipt.reasonCode, 'INVALID_TRANSITION', `${action} from ${from}`);
    const after = runView(engine, runId);
    assert.equal(after.state, before.state, `${action} must not move state`);
    assert.equal(after.version, before.version, `${action} must not bump version`);
    assert.ok(
      after.events.some((event) => event.type === 'transition.denied'),
      `${action} must append transition.denied`,
    );
  }
});

// ---------------------------------------------------------------------------
// T4.1 fork purity
// ---------------------------------------------------------------------------

test('v2 engine T4.1: set_knobs fork is a clean INTAKE child with inherited draft contract', () => {
  const engine = newEngine();
  const parentId = fullRunToDecision(engine);
  const parent = runView(engine, parentId);
  const forked = send(engine, 'set_knobs', {
    runId: parentId,
    actorKind: 'user',
    payload: { knobs: { ...Engine.DEFAULT_KNOBS, heterogeneityFloor: 0.55 } },
  });
  assert.equal(forked.status, 'committed');
  assert.equal(forked.forked, true);
  assert.notEqual(forked.runId, parentId);
  const child = runView(engine, forked.runId);

  // T4.1 状态与版本
  assert.equal(child.state, 'INTAKE');
  assert.equal(child.version, 0);
  assert.equal(child.parentId, parentId);
  // T4.1 契约清理
  assert.equal(child.preregHash, null);
  assert.equal(child.prereg.frozen, false);
  assert.equal(child.prereg.inheritedFrom, parentId);
  assert.deepEqual(child.prereg.contract, parent.prereg.contract, '子 Run 保留父契约草稿');
  // 其余研究产物保留并标 inherited: true
  assert.equal(child.personas.length, parent.personas.length);
  assert.ok(child.personas.length > 0);
  assert.ok(child.personas.every((item) => item.inherited === true), 'personas inherited');
  assert.ok(child.claims.length > 0 && child.claims.every((item) => item.inherited === true));
  assert.ok(child.discussion && child.discussion.inherited === true, 'discussion inherited');
  assert.ok(child.experiments.length > 0 && child.experiments.every((item) => item.inherited === true));
  assert.ok(child.reviews.length > 0 && child.reviews.every((item) => item.inherited === true));
  assert.ok(child.eval && child.eval.inherited === true, 'eval inherited');
  // run.forked 事件含 inheritedArtifacts
  const forkedEvent = child.events.find((event) => event.type === 'run.forked');
  assert.ok(forkedEvent, 'child must append run.forked');
  assert.ok(Array.isArray(forkedEvent.inheritedArtifacts), 'run.forked.inheritedArtifacts');
  for (const artifact of ['personas', 'claims', 'discussion', 'experiments', 'reviews', 'eval']) {
    assert.ok(
      forkedEvent.inheritedArtifacts.includes(artifact),
      `run.forked.inheritedArtifacts includes ${artifact}`,
    );
  }
  // 父 Run 不被修改
  const parentAfter = runView(engine, parentId);
  assert.equal(parentAfter.state, 'DECISION');
  assert.equal(parentAfter.preregHash, parent.preregHash);
  assert.equal(parentAfter.prereg.frozen, true);
});

test('v2 engine T4.2: forked child cannot pass experimentation gate before re-freezing', () => {
  const engine = newEngine();
  const parentId = frozen(engine, 'T4.2 父 Run');
  const forked = send(engine, 'set_knobs', {
    runId: parentId,
    actorKind: 'user',
    payload: { knobs: { ...Engine.DEFAULT_KNOBS, ambitionFloor: 0.5 } },
  });
  assert.equal(forked.status, 'committed');
  const childId = forked.runId;

  const gate = engine.gate(childId, 'experiment');
  assert.equal(gate.allow, false, 'T4.2: inherited prereg must not open experiment gate');
  assert.ok(gate.missing.includes('prereg.frozen'));

  // 重新 question → prereg_freeze 后才允许
  assert.equal(send(engine, 'question', { runId: childId, payload: QUESTION }).status, 'committed');
  assert.equal(send(engine, 'prereg_freeze', { runId: childId, payload: { prereg: PREREG } }).status, 'committed');
  const gate2 = engine.gate(childId, 'experiment');
  assert.equal(gate2.allow, true, '重新冻结后 experiment 门禁打开');
});

// ---------------------------------------------------------------------------
// T4.3 dump 迁移
// ---------------------------------------------------------------------------

test('v2 engine T4.3: loading a legacy INTAKE+preregHash run reconciles it and records audit trail', () => {
  const engine = newEngine();
  const runId = frozen(engine, '迁移 Run');
  const original = runView(engine, runId);
  const originalHash = original.preregHash;
  assert.ok(originalHash);

  const dump = JSON.parse(JSON.stringify(engine.dump()));
  const legacy = findDumpRun(dump, runId);
  legacy.state = 'INTAKE'; // 旧版 fork 遗留：状态被重置但 preregHash 仍在
  legacy.prereg = { ...(legacy.prereg ?? {}), frozen: true, hash: originalHash };
  legacy.preregHash = originalHash;

  const migrated = newEngine();
  migrated.load(dump);
  const view = runView(migrated, runId);
  assert.equal(view.state, 'INTAKE');
  assert.equal(view.preregHash, null, 'T4.3: preregHash 必须清空');
  assert.equal(view.prereg.frozen, false, 'T4.3: 冻结标记必须清除');
  assert.ok(
    view.prereg.inheritedFrom == null || typeof view.prereg.inheritedFrom === 'string',
    '迁移后 inheritedFrom 只能是空或审计指针',
  );
  // T4.1a：继承字段唯一位置在 prereg 内，run 顶层不得有同义字段
  assert.equal(view.prereg.inheritedHash, originalHash, 'T4.3: prereg.inheritedHash 保留审计');
  assert.equal('preregInheritedHash' in view, false, 'T4.1a: run 顶层不得放 preregInheritedHash');
  const migratedEvent = view.events.find((event) => event.type === 'migration.reconciled');
  assert.ok(migratedEvent, 'T4.3: append migration.reconciled');
  const eventHash = migratedEvent.inheritedHash ?? migratedEvent.payload?.inheritedHash ?? migratedEvent.data?.inheritedHash;
  assert.equal(eventHash, originalHash, 'T4.1a: 迁移事件 payload 带 inheritedHash');
  assert.ok(
    view.events.some((event) => event.type === 'migration.reconciled'),
    'T4.3: append migration.reconciled',
  );
  assert.equal(migrated.gate(runId, 'experiment').allow, false);
});

test('v2 engine T4.3: migration is idempotent across repeated loads', () => {
  const engine = newEngine();
  const runId = frozen(engine, '迁移幂等 Run');
  const hash = runView(engine, runId).preregHash;
  const dump = JSON.parse(JSON.stringify(engine.dump()));
  const legacy = findDumpRun(dump, runId);
  legacy.state = 'INTAKE';
  legacy.preregHash = hash;
  legacy.prereg = { ...(legacy.prereg ?? {}), frozen: true, hash };

  const migrated = newEngine();
  migrated.load(dump);
  migrated.load(JSON.parse(JSON.stringify(dump)));
  const view = runView(migrated, runId);
  const reconciliations = view.events.filter((event) => event.type === 'migration.reconciled');
  assert.equal(reconciliations.length, 1, '重复 load 不得重复 append migration.reconciled');
  assert.equal(view.preregHash, null);
});

test('v2 engine T4.3: a healthy dump is not migrated', () => {
  const engine = newEngine();
  const runId = frozen(engine, '健康 dump');
  const dump = JSON.parse(JSON.stringify(engine.dump()));
  const restored = newEngine();
  restored.load(dump);
  const view = runView(restored, runId);
  assert.equal(view.state, 'PREREG_FROZEN');
  assert.ok(view.preregHash);
  assert.equal(view.events.some((event) => event.type === 'migration.reconciled'), false);
});
