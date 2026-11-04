import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHost } from '../../plugins/dsh-praxis/src/host.js';
import { DEFAULT_KNOBS } from '../../plugins/dsh-praxis/src/engine.js';

/**
 * Contract §7 integration: one run must be able to walk the frozen loop
 *   start → prereg_freeze → discussion → experiment → review → stage4
 *         → eval_report → eval_read → memory_propose → memory_commit → decision
 * with every step committed and the final RunView internally consistent.
 */

const STATE_ORDER = [
  'INTAKE', 'QUESTION', 'PREREG_FROZEN', 'DISCUSSION', 'SYNTHESIS', 'EXEC_READY',
  'EXECUTING', 'REVIEW', 'STAGE4', 'EVAL', 'MEMORY', 'DECISION', 'CLOSED',
];

const PREREG = {
  question: '未知结构能否从噪声中被主动提取，而不是被均值回归抹平',
  prediction: '新表示使 held-out 分离度高于冻结基线 0.08',
  acceptance: 'pass 当且仅当主指标超过基线且对照被破坏',
  acceptableFailure: '若对照未被破坏，接受该表示无效',
  controls: ['shuffle', 'label-shuffle'],
  metrics: { primary: 'separation', threshold: 0.08, seeds: 3 },
  input: { source: 'declared-corpus', split: 'train', evalSplit: 'held-out' },
  budget: { wallMin: 30, agents: 4 },
  stop: { sameConclusion: 2 },
};

const PACKAGES = [
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

test('integration: one run walks the frozen loop to DECISION without shortcuts', async () => {
  const host = createHost();
  const steps = [];
  const command = (n, action, actor, payload = {}, runId) => {
    const receipt = host.execute({
      commandId: `it-${n}-${action}`,
      actor,
      action,
      runId,
      payload,
    }, actor.kind === 'user' ? 'user' : 'agent');
    const effectiveRunId = runId ?? receipt.runId;
    steps.push({
      action,
      receipt,
      state: effectiveRunId ? host.engine.runView(effectiveRunId).state : null,
    });
    return receipt;
  };
  const user = { kind: 'user', id: 'owner' };
  const root = { kind: 'root', id: 'agent' };
  const coding = { kind: 'coding', id: 'worker-1' };
  const reviewer = { kind: 'reviewer', id: 'reviewer-1' };
  const evaluator = { kind: 'evaluator', id: 'evaluator-1' };

  // 1. INTAKE — a playbook-bound run.
  const started = command(1, 'start', user, {
    playbookId: 'scientific-loop',
    title: '集成全链路',
  });
  assert.equal(started.status, 'committed');
  const runId = started.runId;
  assert.ok(runId);
  assert.equal(host.engine.runView(runId).state, 'INTAKE');

  // The experiment gate must be closed before the contract is frozen.
  const closedGate = host.execute({ action: 'gate', runId, payload: { target: 'experiment' } }, 'user');
  assert.equal(closedGate.gate.allow, false);
  assert.ok(closedGate.gate.missing.includes('prereg.frozen'));

  // v2 T1.1/T1.2：冻结前必须在 INTAKE 提交 question。
  const asked = command(12, 'question', user, {
    question: {
      text: '未知结构能否从声明语料中被主动提取？',
      hypothesis: '冻结基线上存在可分离的新结构',
      unknowns: ['噪声上限'],
    },
  }, runId);
  assert.equal(asked.status, 'committed');
  assert.equal(host.engine.runView(runId).state, 'QUESTION');

  // 2. PREREG_FROZEN.
  const frozen = command(2, 'prereg_freeze', user, { prereg: PREREG }, runId);
  assert.equal(frozen.status, 'committed');
  assert.equal(host.engine.runView(runId).state, 'PREREG_FROZEN');
  const openGate = host.execute({ action: 'gate', runId, payload: { target: 'experiment' } }, 'user');
  assert.equal(openGate.gate.allow, true);

  // 3. DISCUSSION — real dissent, not style-only.
  const discussed = command(3, 'discussion', user, { round: 1, packages: PACKAGES }, runId);
  assert.equal(discussed.status, 'committed');
  const afterDiscussion = host.engine.runView(runId);
  assert.ok(STATE_ORDER.indexOf(afterDiscussion.state) >= STATE_ORDER.indexOf('DISCUSSION'));
  assert.ok(afterDiscussion.discussion.packages.length >= 2);
  assert.equal(afterDiscussion.discussion.heterogeneity.styleOnly, false);

  // 4. EXECUTING — the frozen contract is executed by a worker.
  const experiment = command(4, 'experiment', coding, {
    command: 'train + held-out probe',
    artifactHash: 'artifact-sha-1',
  }, runId);
  assert.equal(experiment.status, 'committed');
  assert.equal(host.engine.runView(runId).state, 'EXECUTING');

  // 5. REVIEW.
  const review = command(5, 'review', reviewer, {
    verdict: 'pass',
    items: ['对照被破坏', '主指标超过基线'],
  }, runId);
  assert.equal(review.status, 'committed');
  assert.equal(host.engine.runView(runId).state, 'REVIEW');

  // 6. STAGE4.
  const stage4 = command(6, 'stage4', user, {}, runId);
  assert.equal(stage4.status, 'committed');
  assert.equal(host.engine.runView(runId).state, 'STAGE4');

  // 7. EVAL — only the evaluator writes the report.
  const report = command(7, 'eval_report', evaluator, {
    reportHash: 'eval-report-sha-1',
    verdict: 'pass',
    seeds: DEFAULT_KNOBS.evalSeeds,
  }, runId);
  assert.equal(report.status, 'committed');
  assert.equal(host.engine.runView(runId).state, 'EVAL');

  // 8. EVAL — the user reads the report; promotion gates depend on this.
  const read = command(8, 'eval_read', user, { reportHash: 'eval-report-sha-1' }, runId);
  assert.equal(read.status, 'committed');
  assert.ok(host.engine.runView(runId).eval.readAt);

  // 9. MEMORY — propose then user-commit; an uncommitted proposal is not memory.
  const proposal = command(9, 'memory_propose', root, {
    claim: '在声明语料上，主动提取优于均值基线',
    evidenceRefs: ['artifact-sha-1', 'eval-report-sha-1'],
  }, runId);
  assert.equal(proposal.status, 'committed');
  assert.equal(host.engine.runView(runId).memory.commits.length, 0);
  const proposalId = host.engine.runView(runId).memory.proposals.at(-1).id;
  const commit = command(10, 'memory_commit', user, { proposalId }, runId);
  assert.equal(commit.status, 'committed');
  assert.equal(host.engine.runView(runId).memory.commits.length, 1);

  // 10. DECISION.
  const decision = command(11, 'decision', user, {
    conclusion: '在声明语料上，主动提取优于均值基线',
    next: 'new-run',
    evidenceRefs: ['artifact-sha-1', 'eval-report-sha-1'],
    ambition: 0.7,
  }, runId);
  assert.equal(decision.status, 'committed');
  assert.equal(host.engine.runView(runId).state, 'DECISION');

  // Every receipt in the loop committed, and no stage regressed.
  assert.ok(steps.every(({ receipt }) => receipt.status === 'committed'));
  const states = steps.map(({ state }) => state);
  for (let i = 1; i < states.length; i += 1) {
    assert.ok(
      STATE_ORDER.indexOf(states[i]) >= STATE_ORDER.indexOf(states[i - 1]),
      `state regressed from ${states[i - 1]} to ${states[i]} after ${steps[i].action}`,
    );
  }
  assert.equal(states[0], 'INTAKE');
  assert.equal(states.at(-1), 'DECISION');
  // The append-only event log must carry every story beat.
  const eventTypes = host.engine.runView(runId).events.map((event) => event.type);
  for (const expected of ['run.started', 'prereg.frozen']) {
    assert.ok(eventTypes.includes(expected), `missing event ${expected}`);
  }
  assert.ok(eventTypes.some((type) => type.includes('discussion')), 'discussion event');
  assert.ok(eventTypes.some((type) => type.includes('experiment')), 'experiment event');
  assert.ok(eventTypes.some((type) => type.includes('eval')), 'eval event');
  assert.ok(eventTypes.some((type) => type.includes('memory')), 'memory event');
  assert.ok(eventTypes.some((type) => type.includes('decision')), 'decision event');

  // Final RunView is internally consistent.
  const view = host.engine.runView(runId);
  assert.equal(view.id, runId);
  assert.equal(view.state, 'DECISION');
  assert.equal(view.prereg.frozen, true);
  assert.ok(view.prereg.hash);
  assert.equal(view.experiments.length, 1);
  assert.equal(view.experiments[0].artifactHash, 'artifact-sha-1');
  assert.equal(view.reviews.length, 1);
  assert.equal(view.reviews[0].verdict, 'pass');
  assert.equal(view.eval.reportHash, 'eval-report-sha-1');
  assert.equal(view.eval.verdict, 'pass');
  assert.ok(view.eval.readAt);
  assert.equal(view.eval.seeds, DEFAULT_KNOBS.evalSeeds);
  assert.equal(view.memory.proposals.length, 1);
  assert.equal(view.memory.commits.length, 1);
  assert.equal(view.memory.commits[0].proposalId, proposalId);
  assert.equal(view.decision.conclusion, '在声明语料上，主动提取优于均值基线');
  assert.equal(view.decision.next, 'new-run');
  assert.deepEqual(view.decision.evidenceRefs, ['artifact-sha-1', 'eval-report-sha-1']);
  for (const key of ['A_p', 'E', 'A_d', 'A_final', 'inflationFlag', 'corruptionFlags']) {
    assert.ok(key in view.ambition, `ambition.${key}`);
  }
  assert.ok(view.ambition.A_final >= 0 && view.ambition.A_final <= 1);
  assert.equal(view.lineage.parentId, null);
  assert.ok(Array.isArray(view.lineage.children));
  assert.ok(view.version >= steps.length);

  // The host view tracks the same active run.
  const hostView = host.view();
  assert.equal(hostView.product, 'Praxis');
  assert.equal(hostView.activeRunId, runId);
  assert.equal(hostView.active.id, runId);
  assert.equal(hostView.active.state, 'DECISION');
  assert.equal(hostView.runs.length, 1);

  // Idempotency survives the whole loop: replaying the committed decision is
  // a `replayed` receipt with no duplicated decision record.
  const replayReceipt = host.execute({
    commandId: 'it-11-decision',
    actor: user,
    action: 'decision',
    runId,
    payload: {
      conclusion: '在声明语料上，主动提取优于均值基线',
      next: 'new-run',
      evidenceRefs: ['artifact-sha-1', 'eval-report-sha-1'],
      ambition: 0.7,
    },
  }, 'user');
  assert.equal(replayReceipt.status, 'replayed');
  assert.equal(host.engine.runView(runId).decision.conclusion, '在声明语料上，主动提取优于均值基线');
});
