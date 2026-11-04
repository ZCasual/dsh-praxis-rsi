import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createEngine,
  hashJson,
  scoreAmbition,
  scoreHeterogeneity,
  DEFAULT_KNOBS,
  PLAYBOOKS,
  STATE_ORDER,
} from '../../plugins/dsh-praxis/src/engine.js';

function prereg(extra = {}) {
  return {
    question: '未知结构是否能从噪声中被主动提取，而不是被均值回归抹平',
    prediction: '新表示使 held-out 分离度高于冻结基线 0.08',
    acceptance: 'pass 当且仅当主指标超过基线且对照被破坏',
    acceptableFailure: '若对照未被破坏，接受该表示无效',
    controls: ['shuffle', 'label-shuffle'],
    metrics: { primary: 'separation', threshold: 0.08, seeds: 3 },
    input: { source: 'declared-corpus', split: 'train', evalSplit: 'held-out' },
    budget: { wallMin: 30, agents: 4 },
    stop: { sameConclusion: 2 },
    ...extra,
  };
}

test('hashJson is stable for key order', () => {
  assert.equal(hashJson({ b: 1, a: 2 }), hashJson({ a: 2, b: 1 }));
  assert.notEqual(hashJson({ a: 1 }), hashJson({ a: 2 }));
});

test('playbooks are declarative and Q19 is not the product center', () => {
  assert.ok(PLAYBOOKS['scientific-loop']);
  assert.equal(PLAYBOOKS['scientific-loop'].domain, 'general-science');
  assert.equal(PLAYBOOKS['scientific-loop'].historicalResidue, undefined);
  assert.ok(PLAYBOOKS['audit-redteam']);
  assert.ok(PLAYBOOKS['engineering-release']);
});

test('start pins playbook, knobs, and model roles', () => {
  const engine = createEngine();
  const started = engine.execute({
    commandId: 'c1',
    actor: { kind: 'root', id: 'root' },
    action: 'start',
    payload: { playbookId: 'scientific-loop', title: '未知结构' },
  });
  assert.equal(started.status, 'committed');
  const run = engine.snapshot().runs[0];
  assert.equal(run.state, 'INTAKE');
  assert.equal(run.playbookId, 'scientific-loop');
  assert.equal(run.knobHash, hashJson(DEFAULT_KNOBS));
  assert.equal(run.models.judge, 'primary');
  assert.equal(run.models.evaluator, 'secondary');
});

test('experiment without freeze is denied and recorded', () => {
  const engine = createEngine();
  const started = engine.execute({
    commandId: 'c1',
    actor: { kind: 'root', id: 'root' },
    action: 'start',
    payload: { playbookId: 'scientific-loop', title: 'x' },
  });
  const runId = started.runId;
  const denied = engine.execute({
    commandId: 'c2',
    actor: { kind: 'coding', id: 'w' },
    action: 'experiment',
    runId,
    payload: { command: 'train' },
  });
  assert.equal(denied.status, 'rejected');
  // v2 T1.3: experiment from INTAKE is an out-of-order transition; the frozen
  // prereg prerequisite is still surfaced by gate() instead of a business code.
  assert.equal(denied.reasonCode, 'INVALID_TRANSITION');
  const gate = engine.gate(runId, 'experiment');
  assert.equal(gate.allow, false);
  assert.ok(gate.missing.includes('prereg.frozen'));
  const run = engine.getRun(runId);
  assert.equal(run.state, 'INTAKE');
  assert.equal(run.events.at(-1).type, 'transition.denied');
});

test('freeze then experiment is allowed; post-result contract change forks', () => {
  const engine = createEngine();
  const { runId } = engine.execute({
    commandId: 'c1', actor: { kind: 'root', id: 'root' },
    action: 'start', payload: { playbookId: 'scientific-loop', title: 'x' },
  });
  const asked = engine.execute({
    commandId: 'c1q', actor: { kind: 'root', id: 'root' },
    action: 'question', runId,
    payload: { question: { text: '未知结构能否被主动提取？', hypothesis: '存在可分离结构', unknowns: [] } },
  });
  assert.equal(asked.status, 'committed');
  const frozen = engine.execute({
    commandId: 'c2', actor: { kind: 'root', id: 'root' },
    action: 'prereg_freeze', runId, payload: { prereg: prereg() },
  });
  assert.equal(frozen.status, 'committed');
  assert.equal(engine.getRun(runId).state, 'PREREG_FROZEN');
  const discussed = engine.execute({
    commandId: 'c2d', actor: { kind: 'root', id: 'root' },
    action: 'discussion', runId, payload: { round: 1, packages: discussionPackages() },
  });
  assert.equal(discussed.status, 'committed');
  const exp = engine.execute({
    commandId: 'c3', actor: { kind: 'coding', id: 'w' },
    action: 'experiment', runId, payload: { command: 'probe', artifactHash: 'abc' },
  });
  assert.equal(exp.status, 'committed');
  const mutated = engine.execute({
    commandId: 'c4', actor: { kind: 'root', id: 'root' },
    action: 'prereg_freeze', runId, payload: { prereg: prereg({ acceptance: '放宽到任意正数' }) },
  });
  assert.equal(mutated.status, 'rejected');
  // v2 T1.3：非当前状态的 prereg_freeze 属于非法转移。
  assert.equal(mutated.reasonCode, 'INVALID_TRANSITION');
  assert.notEqual(engine.getRun(runId).preregHash, hashJson(prereg({ acceptance: '放宽到任意正数' })));
});

test('idempotent command returns the original receipt', () => {
  const engine = createEngine();
  const a = engine.execute({
    commandId: 'same', actor: { kind: 'root', id: 'root' },
    action: 'start', payload: { playbookId: 'scientific-loop', title: 'x' },
  });
  const b = engine.execute({
    commandId: 'same', actor: { kind: 'root', id: 'root' },
    action: 'start', payload: { playbookId: 'scientific-loop', title: 'other' },
  });
  assert.equal(b.status, 'replayed');
  assert.equal(b.runId, a.runId);
  assert.equal(engine.snapshot().runs.length, 1);
});

test('expected version mismatch is a conflict', () => {
  const engine = createEngine();
  const { runId } = engine.execute({
    commandId: 'c1', actor: { kind: 'root', id: 'root' },
    action: 'start', payload: { playbookId: 'scientific-loop', title: 'x' },
  });
  const conflict = engine.execute({
    commandId: 'c2', actor: { kind: 'root', id: 'root' },
    action: 'prereg_freeze', runId,
    expectedDomainVersion: 99,
    payload: { prereg: prereg() },
  });
  assert.equal(conflict.status, 'rejected');
  assert.equal(conflict.reasonCode, 'CONFLICT');
});

test('mean-reversion and unknown-fear are hard signals', () => {
  const engine = createEngine();
  // v2 §1.1: decision is a MEMORY/DECISION action; walk the real lifecycle.
  const runId = memoryRun(engine, 'drift-early');
  const first = engine.execute({
    commandId: 'c3', actor: { kind: 'root', id: 'root' },
    action: 'decision', runId,
    payload: { conclusion: '结构不存在', next: 'repeat-same', evidenceRefs: ['a'] },
  });
  assert.equal(first.status, 'committed');
  const second = engine.execute({
    commandId: 'c4', actor: { kind: 'root', id: 'root' },
    action: 'decision', runId,
    payload: { conclusion: '结构不存在', next: 'repeat-same', evidenceRefs: ['a'] },
  });
  assert.equal(second.status, 'rejected');
  assert.equal(second.reasonCode, 'DRIFT_DETECTED');
  const fear = engine.execute({
    commandId: 'c5', actor: { kind: 'root', id: 'root' },
    action: 'decision', runId,
    payload: { conclusion: '未知太大，回到已知基线', next: 'shrink-to-known', evidenceRefs: [] },
  });
  assert.equal(fear.reasonCode, 'UNKNOWN_FEAR');
});

test('evaluator cannot write prereg or candidate', () => {
  const engine = createEngine();
  const { runId } = engine.execute({
    commandId: 'c1', actor: { kind: 'root', id: 'root' },
    action: 'start', payload: { playbookId: 'scientific-loop', title: 'x' },
  });
  const denied = engine.execute({
    commandId: 'c2', actor: { kind: 'evaluator', id: 'e' },
    action: 'prereg_freeze', runId, payload: { prereg: prereg() },
  });
  assert.equal(denied.reasonCode, 'FORBIDDEN_ACTOR');
});

test('promote without eval.read is denied; kernel edit is denied', () => {
  const engine = createEngine();
  const { runId } = engine.execute({
    commandId: 'c1', actor: { kind: 'root', id: 'root' },
    action: 'start', payload: { playbookId: 'scientific-loop', title: 'x' },
  });
  const promote = engine.execute({
    commandId: 'c2', actor: { kind: 'root', id: 'root' },
    action: 'promote', runId,
    payload: { candidateId: 'k1', touches: ['system_prompt'] },
  });
  assert.equal(promote.reasonCode, 'EVAL_NOT_READ');
  const kernel = engine.execute({
    commandId: 'c3', actor: { kind: 'root', id: 'root' },
    action: 'promote', runId,
    payload: { candidateId: 'k2', touches: ['evaluator'], evalRead: true },
  });
  assert.equal(kernel.reasonCode, 'FORBIDDEN_BOUNDARY_EDIT');
});

test('user-only memory commit cannot be done by an agent', () => {
  const engine = createEngine();
  // v2 §1.1: memory actions live in MEMORY; reach it through the real lifecycle.
  const runId = evalReadRun(engine, 'memory-sep');
  const proposal = engine.execute({
    commandId: 'c2', actor: { kind: 'root', id: 'root' },
    action: 'memory_propose', runId,
    payload: { claim: '新路径存在', evidenceRefs: ['e1'] },
  });
  assert.equal(proposal.status, 'committed');
  const agentCommit = engine.execute({
    commandId: 'c3', actor: { kind: 'root', id: 'root' },
    action: 'memory_commit', runId, payload: { proposalId: proposal.proposalId },
  });
  assert.equal(agentCommit.reasonCode, 'USER_ONLY');
  const userCommit = engine.execute({
    commandId: 'c4', actor: { kind: 'user', id: 'owner' },
    action: 'memory_commit', runId, payload: { proposalId: proposal.proposalId },
  });
  assert.equal(userCommit.status, 'committed');
});

test('knob change during a run forks instead of mutating', () => {
  const engine = createEngine();
  const { runId } = engine.execute({
    commandId: 'c1', actor: { kind: 'root', id: 'root' },
    action: 'start', payload: { playbookId: 'scientific-loop', title: 'x' },
  });
  const changed = engine.execute({
    commandId: 'c2', actor: { kind: 'user', id: 'owner' },
    action: 'set_knobs', runId,
    payload: { knobs: { ...DEFAULT_KNOBS, heterogeneityFloor: 0.5 } },
  });
  assert.equal(changed.status, 'committed');
  assert.equal(changed.forked, true);
  assert.notEqual(changed.runId, runId);
  assert.equal(engine.getRun(runId).knobHash, hashJson(DEFAULT_KNOBS));
});

test('heterogeneity detects style-only inflation and real dissent', () => {
  const same = scoreHeterogeneity([
    { claim: 'A', assumptions: ['x'], evidence: ['paper:1'], style: 'formal' },
    { claim: 'A', assumptions: ['x'], evidence: ['paper:1'], style: 'casual' },
  ]);
  assert.equal(same.styleOnly, true);
  assert.equal(same.gain, 0);
  const split = scoreHeterogeneity([
    { claim: 'extract', assumptions: ['signal-exists'], evidence: ['data:1'], style: 'empirical', minority: true, retained: true },
    { claim: 'absent', assumptions: ['noise-only'], evidence: ['derivation:2'], style: 'theoretical', minority: false, retained: true },
  ]);
  assert.equal(split.styleOnly, false);
  assert.ok(split.D > 0.35);
});

test('ambition inflation flags self-report without artifacts', () => {
  const report = scoreAmbition({
    dimensions: { O: 1, R: 1, G: 1, H: 1, P_plan: 1 },
    evidenceClosure: 0,
    actionCompletion: 0,
    decisionUpdate: 0,
    auditIntegrity: 1,
    selfReport: 1,
    independentScore: 0.2,
  });
  assert.equal(report.inflationFlag, true);
  assert.ok(report.A_final < 0.5);
  assert.equal(report.corruptionFlags.includes('ambition.inflation'), true);
});

test('persona without topic binding is rejected', () => {
  const engine = createEngine();
  // v2: pin_persona belongs to PREREG_FROZEN and later.
  const runId = frozenRun(engine, 'persona');
  const bad = engine.execute({
    commandId: 'c2', actor: { kind: 'root', id: 'root' },
    action: 'pin_persona', runId,
    payload: { persona: { role: 'devil', stance: { claim: '反对' } } },
  });
  assert.equal(bad.reasonCode, 'PERSONA_DECORATIVE');
  const good = engine.execute({
    commandId: 'c3', actor: { kind: 'root', id: 'root' },
    action: 'pin_persona', runId,
    payload: {
      persona: {
        role: 'devil',
        topicBinding: {
          questionId: 'q1',
          defaultAssumptionToAttack: '熟悉路径足够',
          expectedCounterexample: '跨域反例',
          falsifiableDisagreement: '若对照被破坏则承认',
        },
        symptomProfile: { blindSpots: ['锚定'], attractors: ['论文'], antiPatterns: ['附和'] },
        sinthome: { strategy: '先写反例再写结论', observableWorkProduct: 'counterexample' },
        stance: { claim: '未知不是风险，退回已知才是', scope: '本议题', prior: 0.6 },
        evidenceStandard: { allowed: ['data', 'derivation'], minIndependentSources: 2, requiresControl: true, forbidsDomains: [] },
        taboos: ['不改冻结判据'],
      },
    },
  });
  assert.equal(good.status, 'committed');
  assert.ok(engine.getRun(runId).personas[0].contentHash);
});

test('map records claims and refuses to average contradictions', () => {
  const engine = createEngine();
  const { runId } = engine.execute({
    commandId: 'c1', actor: { kind: 'root', id: 'root' },
    action: 'start', payload: { playbookId: 'scientific-loop', title: 'x' },
  });
  engine.execute({
    commandId: 'c2', actor: { kind: 'root', id: 'root' },
    action: 'map_claim', runId,
    payload: { claim: '结构存在', evidenceRefs: ['e1'], status: 'unverified' },
  });
  engine.execute({
    commandId: 'c3', actor: { kind: 'root', id: 'root' },
    action: 'map_claim', runId,
    payload: { claim: '结构不存在', evidenceRefs: ['e2'], contradicts: '结构存在' },
  });
  const map = engine.cognitiveMap(runId);
  assert.equal(map.contradictions.length, 1);
  assert.equal(map.averaged, false);
  assert.equal(map.nodes.length, 2);
});

test('gate status names the missing contracts', () => {
  const engine = createEngine();
  const { runId } = engine.execute({
    commandId: 'c1', actor: { kind: 'root', id: 'root' },
    action: 'start', payload: { playbookId: 'scientific-loop', title: 'x' },
  });
  const gate = engine.gate(runId, 'experiment');
  assert.equal(gate.allow, false);
  assert.ok(gate.missing.includes('prereg.frozen'));
  assert.ok(gate.nextAction);
});

test('L2 and L3 are closed by default knobs', () => {
  assert.equal(DEFAULT_KNOBS.l2CodeEdit, false);
  assert.equal(DEFAULT_KNOBS.l3MetaEdit, false);
  assert.ok(DEFAULT_KNOBS.heterogeneityFloor >= 0.35);
  assert.ok(DEFAULT_KNOBS.ambitionFloor > 0 && DEFAULT_KNOBS.ambitionFloor < 1);
});

// ===========================================================================
// Contract §2/§3 additions (frozen 2026-11-04). These tests define the
// target behavior for task-2 (engine). They are expected to be red until the
// contract implementation lands; see test/praxis/README.md.
// ===========================================================================

/** v2 §1.1: the frozen 10-state machine, exported by the engine as the single source. */
const STATE_PIPELINE = STATE_ORDER;

function startRun(engine, title = 'contract run', playbookId = 'scientific-loop') {
  const receipt = engine.execute({
    commandId: `start-${title}`,
    actor: { kind: 'root', id: 'root' },
    action: 'start',
    payload: { playbookId, title },
  });
  assert.equal(receipt.status, 'committed');
  assert.ok(receipt.runId);
  return receipt.runId;
}

function doCommand(engine, runId, commandId, actorKind, action, payload = {}) {
  return engine.execute({
    commandId,
    actor: { kind: actorKind, id: `${actorKind}-1` },
    action,
    runId,
    payload,
  });
}

function discussionPackages() {
  return [
    {
      persona: 'theorist',
      claim: '未知结构可以被主动提取',
      assumptions: ['信号存在于声明的语料'],
      evidence: ['derivation:1'],
      style: 'theoretical',
      minority: true,
      retained: true,
    },
    {
      persona: 'empiricist',
      claim: '当前语料只支持均值回归',
      assumptions: ['噪声解释全部方差'],
      evidence: ['data:2'],
      style: 'empirical',
      minority: false,
      retained: true,
    },
  ];
}

function homogeneousPackages() {
  return [
    { persona: 'a', claim: '同一结论', assumptions: ['同一假设'], evidence: ['paper:1'], style: 'formal' },
    { persona: 'b', claim: '同一结论', assumptions: ['同一假设'], evidence: ['paper:1'], style: 'casual' },
  ];
}

function frozenRun(engine, title = 'frozen') {
  const runId = startRun(engine, title);
  // v2 T1.1/T1.2：冻结前必须先在 INTAKE 提交 question（fixture 迁移，不动断言强度）
  const asked = doCommand(engine, runId, `question-${title}`, 'root', 'question', {
    question: {
      text: '未知结构能否被主动提取？',
      hypothesis: '冻结基线上存在可分离结构',
      unknowns: ['噪声上限'],
    },
  });
  assert.equal(asked.status, 'committed');
  const freeze = doCommand(engine, runId, `freeze-${title}`, 'root', 'prereg_freeze', { prereg: prereg() });
  assert.equal(freeze.status, 'committed');
  return runId;
}

/**
 * v2 §1.1: one step per state transition. Fixtures below reuse it so every
 * "later state" test walks the real lifecycle instead of jumping the cursor.
 */
const NEXT_STEP = {
  QUESTION: (engine, runId, tag) => doCommand(engine, runId, `${tag}-question`, 'root', 'question', {
    question: {
      text: '未知结构能否被主动提取？',
      hypothesis: '冻结基线上存在可分离结构',
      unknowns: ['噪声上限'],
    },
  }),
  PREREG_FROZEN: (engine, runId, tag) => doCommand(engine, runId, `${tag}-freeze`, 'root', 'prereg_freeze', {
    prereg: prereg(),
  }),
  DISCUSSION: (engine, runId, tag) => doCommand(engine, runId, `${tag}-discussion`, 'root', 'discussion', {
    round: 1,
    packages: discussionPackages(),
  }),
  EXECUTING: (engine, runId, tag) => doCommand(engine, runId, `${tag}-experiment`, 'coding', 'experiment', {
    command: 'probe',
    artifactHash: 'artifact-1',
  }),
  REVIEW: (engine, runId, tag) => doCommand(engine, runId, `${tag}-review`, 'reviewer', 'review', {
    verdict: 'pass',
    items: ['对照被破坏'],
  }),
  STAGE4: (engine, runId, tag) => doCommand(engine, runId, `${tag}-stage4`, 'root', 'stage4', {}),
  EVAL: (engine, runId, tag) => doCommand(engine, runId, `${tag}-eval-report`, 'evaluator', 'eval_report', {
    reportHash: 'report-1',
    verdict: 'pass',
    seeds: DEFAULT_KNOBS.evalSeeds,
  }),
  MEMORY: (engine, runId, tag) => doCommand(engine, runId, `${tag}-eval-read`, 'user', 'eval_read', {
    reportHash: 'report-1',
  }),
  DECISION: (engine, runId, tag) => doCommand(engine, runId, `${tag}-decision`, 'user', 'decision', {
    conclusion: '结构存在',
    next: 'new-run',
    evidenceRefs: ['e1'],
    ambition: 0.7,
  }),
};

/** Walk an existing run forward through the frozen state machine. */
function advanceTo(engine, runId, target, tag = 'adv') {
  while (engine.getRun(runId).state !== target) {
    const current = engine.getRun(runId).state;
    const index = STATE_ORDER.indexOf(current);
    assert.ok(index >= 0 && index < STATE_ORDER.length - 1, `cannot advance from ${current}`);
    const next = STATE_ORDER[index + 1];
    const step = NEXT_STEP[next];
    assert.ok(step, `no advance step for ${next}`);
    const receipt = step(engine, runId, tag);
    assert.equal(receipt.status, 'committed', `advance ${tag} to ${next} (${receipt.reasonCode ?? 'ok'})`);
  }
  return runId;
}

const evalRun = (engine, title = 'eval') => advanceTo(engine, frozenRun(engine, title), 'EVAL', title);
/** EVAL -> MEMORY via eval_read; no memory proposal yet. */
const evalReadRun = (engine, title = 'eval-read') => advanceTo(engine, evalRun(engine, title), 'MEMORY', title);

/** MEMORY with one committed proposal; the run can now record a decision. */
function memoryRun(engine, title = 'memory') {
  const runId = evalReadRun(engine, title);
  const proposed = doCommand(engine, runId, `${title}-propose`, 'root', 'memory_propose', {
    claim: '新路径存在',
    evidenceRefs: ['e1'],
  });
  assert.equal(proposed.status, 'committed');
  const committed = doCommand(engine, runId, `${title}-commit`, 'user', 'memory_commit', {
    proposalId: latestProposalId(engine, runId),
  });
  assert.equal(committed.status, 'committed');
  return runId;
}

/** Receipt extras live in `data` per contract §2; read ids from the RunView. */
function latestProposalId(engine, runId) {
  const proposals = engine.runView(runId).memory.proposals;
  assert.ok(proposals.length > 0, 'a proposal must be recorded first');
  const last = proposals.at(-1);
  return last.id ?? last.proposalId;
}

function claimIds(engine, runId) {
  return engine.map(runId).nodes.map((node) => node.id);
}

// --- hard rule 1 -----------------------------------------------------------

test('contract rule 1: experiment gate lists missing prereg and opens after freeze', () => {
  const engine = createEngine();
  const runId = startRun(engine, 'rule1');
  const gate = engine.gate(runId, 'experiment');
  assert.equal(gate.allow, false);
  assert.ok(gate.missing.includes('prereg.frozen'));
  assert.equal(gate.nextAction, 'prereg_freeze');
  const denied = doCommand(engine, runId, 'r1-exp', 'coding', 'experiment', { command: 'probe' });
  assert.equal(denied.status, 'rejected');
  // v2 T1.3: INTAKE -> EXECUTING is not a legal edge; the gate() snapshot still
  // names the missing prereg contract.
  assert.equal(denied.reasonCode, 'INVALID_TRANSITION');
  assert.equal(engine.getRun(runId).state, 'INTAKE');
  assert.equal(doCommand(engine, runId, 'r1-question', 'root', 'question', {
    question: { text: '未知结构能否被主动提取？', hypothesis: '存在可分离结构', unknowns: [] },
  }).status, 'committed');
  doCommand(engine, runId, 'r1-freeze', 'root', 'prereg_freeze', { prereg: prereg() });
  const gate2 = engine.gate(runId, 'experiment');
  assert.equal(gate2.allow, true);
  assert.deepEqual(gate2.missing, []);
  doCommand(engine, runId, 'r1-discussion', 'root', 'discussion', {
    round: 1, packages: discussionPackages(),
  });
  const allowed = doCommand(engine, runId, 'r1-exp2', 'coding', 'experiment', {
    command: 'probe', artifactHash: 'h-1',
  });
  assert.equal(allowed.status, 'committed');
});

// --- hard rule 2 -----------------------------------------------------------

test('contract rule 2: post-freeze prereg mutation is a violation that asks for a new run', () => {
  const engine = createEngine();
  const runId = frozenRun(engine, 'rule2');
  const frozenView = engine.runView(runId);
  const oldHash = frozenView.preregHash ?? frozenView.prereg.hash;
  const mutated = doCommand(engine, runId, 'r2-mutate', 'root', 'prereg_freeze', {
    prereg: prereg({ acceptance: '放宽到任意正数' }),
  });
  assert.equal(mutated.status, 'rejected');
  // v2 T1.3：非当前状态的 prereg_freeze 属于非法转移。
  assert.equal(mutated.reasonCode, 'INVALID_TRANSITION');
  assert.equal(mutated.nextAction, 'new-run');
  const after = engine.runView(runId);
  assert.equal(after.preregHash ?? after.prereg.hash, oldHash);
  assert.equal(after.prereg.contract.acceptance, prereg().acceptance);
});

// --- hard rule 3 -----------------------------------------------------------

test('contract rule 3: promote rejects kernel paths, closed L2/L3, and unread eval', () => {
  const engine = createEngine();
  // v2 §1.1: eval_read is an EVAL action, so the run must reach EVAL first.
  const runId = evalRun(engine, 'rule3');
  const kernel = doCommand(engine, runId, 'r3-kernel', 'user', 'promote', {
    candidateId: 'k1', touches: ['evaluator'], evalRead: true,
  });
  assert.equal(kernel.reasonCode, 'FORBIDDEN_BOUNDARY_EDIT');
  const unread = doCommand(engine, runId, 'r3-unread', 'user', 'promote', {
    candidateId: 'k2', touches: ['system_prompt'],
  });
  assert.equal(unread.reasonCode, 'EVAL_NOT_READ');
  // Open the eval gate, then closed-L2 / closed-L3 still refuse code and meta edits.
  doCommand(engine, runId, 'r3-read', 'user', 'eval_read', { reportHash: 'rh' });
  const l2 = doCommand(engine, runId, 'r3-l2', 'user', 'promote', {
    candidateId: 'k3', touches: ['code'],
  });
  assert.equal(l2.reasonCode, 'L2_CLOSED');
  const l3 = doCommand(engine, runId, 'r3-l3', 'user', 'promote', {
    candidateId: 'k4', touches: ['meta'],
  });
  assert.equal(l3.reasonCode, 'L3_CLOSED');
});

test('contract rule 3: promote commits when eval was read and L2/L3 knobs are open', () => {
  const engine = createEngine({ knobs: { l2CodeEdit: true, l3MetaEdit: true } });
  const runId = evalRun(engine, 'rule3-open');
  doCommand(engine, runId, 'r3o-read', 'user', 'eval_read', { reportHash: 'rh' });
  const promoted = doCommand(engine, runId, 'r3o-promote', 'user', 'promote', {
    candidateId: 'cand-1', touches: ['code', 'meta'],
  });
  assert.equal(promoted.status, 'committed');
});

// --- hard rule 4 -----------------------------------------------------------

test('contract rule 4: memory separation — propose vs user commit, uncommitted is not memory', () => {
  const engine = createEngine();
  // v2 §1.1: memory actions live in MEMORY; this fixture reaches MEMORY with no
  // proposal yet, so the propose/commit separation is observed cleanly.
  const runId = evalReadRun(engine, 'rule4');
  const proposed = doCommand(engine, runId, 'r4-propose', 'root', 'memory_propose', {
    claim: '新路径存在', evidenceRefs: ['e1'],
  });
  assert.equal(proposed.status, 'committed');
  let view = engine.runView(runId);
  assert.equal(view.memory.proposals.length, 1);
  assert.equal(view.memory.commits.length, 0);
  const proposalId = latestProposalId(engine, runId);
  const agentCommit = doCommand(engine, runId, 'r4-agent-commit', 'root', 'memory_commit', {
    proposalId,
  });
  assert.equal(agentCommit.status, 'rejected');
  assert.equal(agentCommit.reasonCode, 'USER_ONLY');
  const userPropose = doCommand(engine, runId, 'r4-user-propose', 'user', 'memory_propose', {
    claim: '越权提案',
  });
  assert.equal(userPropose.status, 'rejected');
  assert.equal(userPropose.reasonCode, 'FORBIDDEN_ACTOR');
  const userCommit = doCommand(engine, runId, 'r4-user-commit', 'user', 'memory_commit', {
    proposalId,
  });
  assert.equal(userCommit.status, 'committed');
  view = engine.runView(runId);
  assert.equal(view.memory.commits.length, 1);
  assert.equal(view.memory.commits[0].proposalId, proposalId);
});

// --- hard rule 5 -----------------------------------------------------------

test('contract rule 5: repeated same conclusion drifts; fear without evidence is unknown', () => {
  const engine = createEngine();
  // v2 §1.1: decision is recorded at MEMORY; drift is measured across decisions.
  const runId = memoryRun(engine, 'rule5');
  const first = doCommand(engine, runId, 'r5-1', 'root', 'decision', {
    conclusion: '结构不存在', next: 'repeat-same', evidenceRefs: ['e1'],
  });
  assert.equal(first.status, 'committed');
  const second = doCommand(engine, runId, 'r5-2', 'root', 'decision', {
    conclusion: '结构不存在', next: 'repeat-same', evidenceRefs: ['e1'],
  });
  assert.equal(second.status, 'rejected');
  assert.equal(second.reasonCode, 'DRIFT_DETECTED');
  assert.equal(engine.getRun(runId).state, 'DRIFT_DETECTED');
  const fear = doCommand(engine, runId, 'r5-3', 'root', 'decision', {
    conclusion: '未知太大，回到已知基线', next: 'shrink-to-known', evidenceRefs: [],
  });
  assert.equal(fear.reasonCode, 'UNKNOWN_FEAR');
  assert.ok(engine.getRun(runId).events.some((event) => event.type === 'unknown.fear'));
});

// --- hard rule 6 -----------------------------------------------------------

test('contract rule 6: every persona binding field is required', () => {
  const engine = createEngine();
  const runId = frozenRun(engine, 'rule6');
  const complete = {
    role: 'devil',
    topicBinding: {
      defaultAssumptionToAttack: '熟悉路径足够',
      expectedCounterexample: '跨域反例',
      falsifiableDisagreement: '若对照被破坏则承认',
    },
    sinthome: { strategy: '先写反例', observableWorkProduct: 'counterexample' },
  };
  const mutations = [
    ['defaultAssumptionToAttack', (p) => { delete p.topicBinding.defaultAssumptionToAttack; }],
    ['expectedCounterexample', (p) => { delete p.topicBinding.expectedCounterexample; }],
    ['falsifiableDisagreement', (p) => { delete p.topicBinding.falsifiableDisagreement; }],
    ['sinthome.observableWorkProduct', (p) => { delete p.sinthome.observableWorkProduct; }],
  ];
  let n = 0;
  for (const [label, mutate] of mutations) {
    const persona = structuredClone(complete);
    mutate(persona);
    const receipt = doCommand(engine, runId, `r6-${n}`, 'root', 'pin_persona', { persona });
    n += 1;
    assert.equal(receipt.reasonCode, 'PERSONA_DECORATIVE', `missing ${label}`);
  }
  const ok = doCommand(engine, runId, 'r6-ok', 'root', 'pin_persona', { persona: complete });
  assert.equal(ok.status, 'committed');
  assert.equal(engine.runView(runId).personas.length, 1);
});

// --- hard rule 7 -----------------------------------------------------------

test('contract rule 7: knob changes fork a child run instead of mutating the current one', () => {
  const engine = createEngine();
  const runId = frozenRun(engine, 'rule7');
  const forked = doCommand(engine, runId, 'r7-knobs', 'user', 'set_knobs', {
    knobs: { ...DEFAULT_KNOBS, heterogeneityFloor: 0.55 },
  });
  assert.equal(forked.status, 'committed');
  assert.equal(forked.forked, true);
  assert.notEqual(forked.runId, runId);
  const parent = engine.runView(runId);
  const child = engine.runView(forked.runId);
  assert.equal(parent.knobs.heterogeneityFloor, DEFAULT_KNOBS.heterogeneityFloor);
  assert.equal(child.knobs.heterogeneityFloor, 0.55);
  assert.equal(child.parentId, runId);
  assert.equal(child.lineage.parentId, runId);
  assert.ok(parent.lineage.children.includes(forked.runId));
  const rootKnobs = doCommand(engine, runId, 'r7-root-knobs', 'root', 'set_knobs', {
    knobs: { ...DEFAULT_KNOBS, heterogeneityFloor: 0.6 },
  });
  assert.equal(rootKnobs.status, 'rejected');
});

// --- hard rule 8 -----------------------------------------------------------

test('contract rule 8: replaying a command id has no duplicated side effects', () => {
  const engine = createEngine();
  const runId = frozenRun(engine, 'rule8');
  const payload = { claim: '结构存在', evidenceRefs: ['e1'] };
  const first = doCommand(engine, runId, 'r8-claim', 'root', 'map_claim', payload);
  assert.equal(first.status, 'committed');
  const versionAfterFirst = engine.runView(runId).version;
  const eventsAfterFirst = engine.runView(runId).events.length;
  const second = doCommand(engine, runId, 'r8-claim', 'root', 'map_claim', payload);
  assert.equal(second.status, 'replayed');
  assert.equal(second.runId, first.runId);
  const view = engine.runView(runId);
  assert.equal(view.claims.length, 1);
  assert.equal(view.version, versionAfterFirst);
  assert.equal(view.events.length, eventsAfterFirst);
});

// --- hard rule 9 -----------------------------------------------------------

test('contract rule 9: expected version mismatch is a manual conflict without mutation', () => {
  const engine = createEngine();
  const runId = frozenRun(engine, 'rule9');
  const version = engine.runView(runId).version;
  const conflict = engine.execute({
    commandId: 'r9-conflict',
    actor: { kind: 'root', id: 'root' },
    action: 'map_claim',
    runId,
    expectedDomainVersion: version + 99,
    payload: { claim: '不会写入' },
  });
  assert.equal(conflict.status, 'rejected');
  assert.equal(conflict.reasonCode, 'CONFLICT');
  assert.equal(conflict.retry, 'manual');
  assert.equal(engine.runView(runId).version, version);
  assert.equal(engine.runView(runId).claims.length, 0);
  const ok = engine.execute({
    commandId: 'r9-ok',
    actor: { kind: 'root', id: 'root' },
    action: 'map_claim',
    runId,
    expectedDomainVersion: version,
    payload: { claim: '写入' },
  });
  assert.equal(ok.status, 'committed');
});

// --- hard rule 10 ----------------------------------------------------------

test('contract rule 10: below-floor heterogeneity warns without blocking', () => {
  const engine = createEngine();
  const runId = frozenRun(engine, 'rule10-h');
  const receipt = doCommand(engine, runId, 'r10-h-discussion', 'root', 'discussion', {
    round: 1,
    packages: homogeneousPackages(),
  });
  assert.equal(receipt.status, 'committed');
  assert.ok((receipt.corruptionFlags ?? []).includes('CORRUPTION_WARNING'));
  const view = engine.runView(runId);
  assert.ok(view.discussion.heterogeneity.D < DEFAULT_KNOBS.heterogeneityFloor);
  assert.ok(engine.getRun(runId).events.some((event) => event.type.includes('corruption')));
  assert.ok(STATE_PIPELINE.indexOf(view.state) >= STATE_PIPELINE.indexOf('DISCUSSION'));
});

test('contract rule 10: below-floor ambition warns without blocking', () => {
  const engine = createEngine();
  // v2 §1.1: decision is recorded at MEMORY; the ambition warning must not block.
  const runId = memoryRun(engine, 'rule10-a');
  const receipt = doCommand(engine, runId, 'r10-a-decision', 'root', 'decision', {
    conclusion: '结构存在',
    next: 'new-run',
    evidenceRefs: ['e1'],
    ambition: 0.1,
  });
  assert.equal(receipt.status, 'committed');
  assert.ok((receipt.corruptionFlags ?? []).includes('CORRUPTION_WARNING'));
});

// --- scoring ---------------------------------------------------------------

test('scoring: ambition formula is transparent and monotone', () => {
  const max = scoreAmbition({
    dimensions: { O: 1, R: 1, G: 1, H: 1, P_plan: 1 },
    evidenceClosure: 1,
    actionCompletion: 1,
    decisionUpdate: 1,
    auditIntegrity: 1,
    independentScore: 1,
    stageScore: 1,
    selfReport: 1,
  });
  assert.equal(max.A_p, 1);
  assert.equal(max.E, 1);
  assert.equal(max.A_d, 1);
  assert.equal(max.A_final, 1);
  assert.equal(max.inflationFlag, false);
  assert.deepEqual(max.corruptionFlags, []);
  const min = scoreAmbition({
    dimensions: { O: 0, R: 0, G: 0, H: 0, P_plan: 0 },
    evidenceClosure: 0,
    actionCompletion: 0,
    decisionUpdate: 0,
    auditIntegrity: 0,
    independentScore: 0,
    stageScore: 0,
    selfReport: 0,
  });
  assert.equal(min.A_p, 0);
  assert.equal(min.A_d, 0);
  assert.equal(min.A_final, 0);
  assert.equal(min.inflationFlag, false);
});

test('scoring: heterogeneity separates style-only from real dissent and reports retention', () => {
  const styleOnly = scoreHeterogeneity(homogeneousPackages());
  assert.equal(styleOnly.styleOnly, true);
  assert.equal(styleOnly.gain, 0);
  const dissent = scoreHeterogeneity(discussionPackages());
  assert.equal(dissent.styleOnly, false);
  assert.ok(dissent.D > DEFAULT_KNOBS.heterogeneityFloor);
  assert.equal(dissent.minorityRetention, 1);
  const partial = scoreHeterogeneity([
    { claim: 'A', assumptions: ['a'], evidence: ['e1'], minority: true, retained: true },
    { claim: 'B', assumptions: ['b'], evidence: ['e2'], minority: true, retained: false },
  ]);
  assert.equal(partial.minorityRetention, 0.5);
});

// --- cognitive map ---------------------------------------------------------

test('cognitive map: map() exposes nodes, edges, frontier, blind spots, mean reversion', () => {
  const engine = createEngine();
  const runId = frozenRun(engine, 'map-shape');
  doCommand(engine, runId, 'map-a', 'root', 'map_claim', {
    claim: '结构存在', evidenceRefs: ['e1'], status: 'unverified',
  });
  doCommand(engine, runId, 'map-b', 'root', 'map_claim', {
    claim: '结构不存在', evidenceRefs: ['e2'], contradicts: '结构存在',
  });
  const [firstId, secondId] = claimIds(engine, runId);
  const edge = doCommand(engine, runId, 'map-edge', 'root', 'map_edge', {
    from: firstId, to: secondId, relation: 'contradiction',
  });
  assert.equal(edge.status, 'committed');
  const map = engine.map(runId);
  assert.equal(map.runId, runId);
  assert.equal(map.nodes.length, 2);
  assert.ok(map.nodes.every((node) => node.id && node.label));
  assert.equal(map.edges.length, 1);
  assert.equal(map.edges[0].from, firstId);
  assert.equal(map.edges[0].to, secondId);
  assert.ok(Array.isArray(map.frontier));
  assert.ok(Array.isArray(map.blindSpots));
  assert.equal(map.contradictions.length, 1);
  for (const key of ['distance', 'centered', 'suspect']) {
    assert.ok(key in map.meanReversion, `meanReversion.${key}`);
  }
  assert.equal(map.averaged, false);
});

test('cognitive map: claims are never averaged into one node', () => {
  const engine = createEngine();
  const runId = frozenRun(engine, 'map-no-average');
  doCommand(engine, runId, 'ma-1', 'root', 'map_claim', { claim: '结构存在' });
  doCommand(engine, runId, 'ma-2', 'root', 'map_claim', { claim: '结构不存在', contradicts: '结构存在' });
  const map = engine.map(runId);
  assert.equal(map.nodes.length, 2);
  assert.notEqual(map.nodes[0].label, map.nodes[1].label);
});

// --- runView ---------------------------------------------------------------

test('runView: shape matches contract §3 across the full loop', () => {
  const engine = createEngine();
  const runId = startRun(engine, 'runview');
  doCommand(engine, runId, 'rv-question', 'root', 'question', {
    question: { text: '未知结构能否被主动提取？', hypothesis: '存在可分离结构', unknowns: [] },
  });
  doCommand(engine, runId, 'rv-freeze', 'root', 'prereg_freeze', { prereg: prereg() });
  doCommand(engine, runId, 'rv-persona', 'root', 'pin_persona', {
    persona: {
      role: 'devil',
      topicBinding: {
        defaultAssumptionToAttack: '熟悉路径足够',
        expectedCounterexample: '跨域反例',
        falsifiableDisagreement: '若对照被破坏则承认',
      },
      sinthome: { strategy: '先写反例', observableWorkProduct: 'counterexample' },
    },
  });
  doCommand(engine, runId, 'rv-discussion', 'root', 'discussion', {
    round: 1, packages: discussionPackages(),
  });
  doCommand(engine, runId, 'rv-experiment', 'coding', 'experiment', {
    command: 'probe', artifactHash: 'artifact-1',
  });
  doCommand(engine, runId, 'rv-review', 'reviewer', 'review', {
    verdict: 'pass', items: ['对照被破坏'],
  });
  doCommand(engine, runId, 'rv-stage4', 'root', 'stage4', {});
  doCommand(engine, runId, 'rv-eval-report', 'evaluator', 'eval_report', {
    reportHash: 'report-1', verdict: 'pass', seeds: DEFAULT_KNOBS.evalSeeds,
  });
  doCommand(engine, runId, 'rv-eval-read', 'user', 'eval_read', { reportHash: 'report-1' });
  doCommand(engine, runId, 'rv-propose', 'root', 'memory_propose', {
    claim: '新路径存在', evidenceRefs: ['e1'],
  });
  const proposalId = latestProposalId(engine, runId);
  doCommand(engine, runId, 'rv-commit', 'user', 'memory_commit', {
    proposalId,
  });
  doCommand(engine, runId, 'rv-decision', 'user', 'decision', {
    conclusion: '结构存在', next: 'new-run', evidenceRefs: ['e1'], ambition: 0.7,
  });

  const view = engine.runView(runId);
  const required = [
    'id', 'title', 'playbookId', 'state', 'version', 'parentId', 'createdAt', 'updatedAt',
    'knobHash', 'knobs', 'models', 'prereg', 'preregHash', 'stage', 'nextAction',
    'blockers', 'personas', 'participants', 'discussion', 'experiments', 'reviews',
    'eval', 'decision', 'ambition', 'memory', 'events', 'claims', 'edges',
    'contradictions', 'lineage',
  ];
  for (const key of required) assert.ok(key in view, `RunView.${key} missing`);
  assert.equal(view.id, runId);
  assert.equal(view.state, 'DECISION');
  assert.ok(view.version > 0);
  assert.equal(view.playbookId, 'scientific-loop');
  assert.ok(view.prereg.hash);
  assert.equal(view.prereg.frozen, true);
  assert.ok(view.prereg.contract);
  assert.equal(view.preregHash, view.prereg.hash);
  assert.ok(Array.isArray(view.personas) && view.personas.length === 1);
  assert.ok(Array.isArray(view.participants));
  assert.equal(Array.isArray(view.discussion.packages), true);
  assert.ok(view.discussion.rounds >= 1);
  for (const key of ['D', 'styleOnly', 'gain', 'minorityRetention']) {
    assert.ok(key in view.discussion.heterogeneity, `heterogeneity.${key}`);
  }
  assert.equal(view.experiments.length, 1);
  for (const key of ['id', 'command', 'artifactHash', 'resultState', 'at']) {
    assert.ok(key in view.experiments[0], `experiment.${key}`);
  }
  assert.equal(view.experiments[0].artifactHash, 'artifact-1');
  assert.equal(view.reviews.length, 1);
  for (const key of ['verdict', 'items', 'at']) {
    assert.ok(key in view.reviews[0], `review.${key}`);
  }
  assert.equal(view.eval.reportHash, 'report-1');
  assert.equal(view.eval.verdict, 'pass');
  assert.ok(view.eval.readAt);
  assert.equal(view.eval.seeds, DEFAULT_KNOBS.evalSeeds);
  assert.equal(view.decision.conclusion, '结构存在');
  assert.equal(view.decision.next, 'new-run');
  assert.deepEqual(view.decision.evidenceRefs, ['e1']);
  assert.ok('ambition' in view.decision);
  for (const key of ['A_p', 'E', 'A_d', 'A_final', 'inflationFlag', 'corruptionFlags']) {
    assert.ok(key in view.ambition, `ambition.${key}`);
  }
  assert.equal(view.memory.proposals.length, 1);
  assert.equal(view.memory.commits.length, 1);
  assert.ok(Array.isArray(view.events) && view.events.length > 0);
  assert.ok(Array.isArray(view.claims));
  assert.ok(Array.isArray(view.edges));
  assert.ok(Array.isArray(view.contradictions));
  assert.ok('parentId' in view.lineage);
  assert.ok(Array.isArray(view.lineage.children));
  assert.ok(view.nextAction === null || typeof view.nextAction === 'string');
  assert.ok(Array.isArray(view.blockers));
});

// --- dump / load / snapshot ------------------------------------------------

test('dump/load: round-trips runs, knobs and receipts; replay survives reload', () => {
  const engine = createEngine({ knobs: { heterogeneityFloor: 0.5 } });
  const runId = frozenRun(engine, 'dump');
  const claim = doCommand(engine, runId, 'dump-claim', 'root', 'map_claim', {
    claim: '结构存在', evidenceRefs: ['e1'],
  });
  assert.equal(claim.status, 'committed');
  const dump = engine.dump();
  assert.equal(dump.v, 1);
  assert.ok(Array.isArray(dump.runs));
  assert.ok(Array.isArray(dump.receipts));
  assert.equal(dump.knobs.heterogeneityFloor, 0.5);
  const wire = JSON.parse(JSON.stringify(dump));
  const reborn = createEngine();
  reborn.load(wire);
  assert.equal(reborn.knobs.heterogeneityFloor, 0.5);
  assert.equal(reborn.runView(runId).state, engine.runView(runId).state);
  assert.equal(reborn.runView(runId).version, engine.runView(runId).version);
  const replayed = reborn.execute({
    commandId: 'dump-claim',
    actor: { kind: 'root', id: 'root' },
    action: 'map_claim',
    runId,
    payload: { claim: '结构存在', evidenceRefs: ['e1'] },
  });
  assert.equal(replayed.status, 'replayed');
  assert.equal(reborn.runView(runId).claims.length, 1);
});

test('snapshot: exposes runs, playbooks, knobs, defaults and knob fields', () => {
  const engine = createEngine();
  startRun(engine, 'snap');
  const snapshot = engine.snapshot();
  assert.equal(snapshot.runs.length, 1);
  assert.equal(snapshot.playbooks.length, 4);
  assert.deepEqual(snapshot.knobs, { ...DEFAULT_KNOBS });
  assert.deepEqual(snapshot.defaults, { ...DEFAULT_KNOBS });
  assert.equal(DEFAULT_KNOBS.explorationQuota, 0.2);
  assert.ok(Array.isArray(snapshot.knobFields) && snapshot.knobFields.length >= 9);
  for (const field of snapshot.knobFields) {
    assert.ok(field.key && field.label);
  }
});

// --- permissions -----------------------------------------------------------

test('permissions: the action matrix is enforced inside the engine', () => {
  const engine = createEngine();
  const runId = frozenRun(engine, 'matrix');
  const allowed = [
    ['start', 'user'], ['start', 'root'],
    ['prereg_freeze', 'user'], ['prereg_freeze', 'root'],
    ['discussion', 'user'], ['discussion', 'root'],
    ['pin_persona', 'user'], ['pin_persona', 'root'],
    ['experiment', 'user'], ['experiment', 'root'], ['experiment', 'coding'], ['experiment', 'worker'],
    ['review', 'user'], ['review', 'root'], ['review', 'reviewer'],
    ['stage4', 'user'], ['stage4', 'root'],
    ['eval_report', 'evaluator'],
    ['eval_read', 'user'], ['eval_read', 'root'],
    ['memory_propose', 'root'],
    ['memory_commit', 'user'],
    ['map_claim', 'user'], ['map_claim', 'root'],
    ['map_edge', 'user'], ['map_edge', 'root'],
    ['decision', 'user'], ['decision', 'root'],
    ['promote', 'user'],
    ['set_knobs', 'user'],
  ];
  let n = 0;
  for (const [action, actorKind] of allowed) {
    const payload = action === 'start'
      ? { playbookId: 'scientific-loop', title: `matrix-${n}` }
      : action === 'prereg_freeze' ? { prereg: prereg() }
        : action === 'pin_persona' ? {
          persona: {
            role: 'devil',
            topicBinding: {
              defaultAssumptionToAttack: 'a',
              expectedCounterexample: 'b',
              falsifiableDisagreement: 'c',
            },
            sinthome: { observableWorkProduct: 'd' },
          },
        }
          : action === 'memory_commit' ? { proposalId: 'missing' }
            : action === 'experiment' ? { command: 'probe' }
              : {};
    const receipt = doCommand(engine, runId, `matrix-a-${n}`, actorKind, action, payload);
    n += 1;
    assert.notEqual(receipt.reasonCode, 'FORBIDDEN_ACTOR', `${actorKind} may ${action}`);
  }
  const denied = [
    ['start', 'coding'], ['start', 'evaluator'], ['start', 'reviewer'], ['start', 'worker'],
    ['prereg_freeze', 'evaluator'], ['prereg_freeze', 'coding'],
    ['discussion', 'evaluator'], ['pin_persona', 'reviewer'],
    ['experiment', 'reviewer'], ['experiment', 'evaluator'],
    ['review', 'coding'], ['review', 'evaluator'],
    ['stage4', 'reviewer'], ['stage4', 'coding'],
    ['eval_report', 'user'], ['eval_report', 'root'], ['eval_report', 'coding'],
    ['eval_read', 'evaluator'], ['eval_read', 'reviewer'], ['eval_read', 'coding'],
    ['memory_propose', 'user'], ['memory_propose', 'evaluator'],
    ['map_claim', 'evaluator'], ['map_edge', 'coding'],
    ['decision', 'evaluator'], ['decision', 'coding'],
    ['promote', 'evaluator'],
    ['set_knobs', 'evaluator'],
  ];
  for (const [action, actorKind] of denied) {
    const receipt = doCommand(engine, runId, `matrix-d-${n}`, actorKind, action, {});
    n += 1;
    assert.equal(receipt.status, 'rejected', `${actorKind} may not ${action}`);
    assert.equal(receipt.reasonCode, 'FORBIDDEN_ACTOR', `${actorKind} may not ${action}`);
  }
  // "user-only" actions are enforced at the business layer on the existing
  // surface (root memory_commit/promote keep their USER_ONLY / business codes
  // because the legacy 21-test suite pins that behavior).
  for (const [action, actorKind] of [['set_knobs', 'root'], ['memory_commit', 'root']]) {
    const receipt = doCommand(engine, runId, `matrix-u-${n}`, actorKind, action, {});
    n += 1;
    assert.equal(receipt.status, 'rejected', `${actorKind} may not ${action}`);
    assert.ok(
      ['FORBIDDEN_ACTOR', 'USER_ONLY'].includes(receipt.reasonCode),
      `${actorKind} ${action} must be denied (got ${receipt.reasonCode})`,
    );
  }
});

test('start rejects unknown playbooks', () => {
  const engine = createEngine();
  const receipt = engine.execute({
    commandId: 'unknown-playbook',
    actor: { kind: 'root', id: 'root' },
    action: 'start',
    payload: { playbookId: 'does-not-exist', title: 'x' },
  });
  assert.equal(receipt.status, 'rejected');
  assert.equal(receipt.reasonCode, 'UNKNOWN_PLAYBOOK');
  assert.equal(engine.snapshot().runs.length, 0);
});
