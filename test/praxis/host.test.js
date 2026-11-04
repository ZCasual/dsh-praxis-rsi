import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHost, commandText } from '../../plugins/dsh-praxis/src/host.js';

test('host start and gate share one engine', () => {
  const host = createHost();
  const started = host.execute({
    action: 'start',
    commandId: 'h1',
    payload: { playbookId: 'scientific-loop', title: '未知' },
  }, 'user');
  assert.equal(started.status, 'committed');
  const gate = host.execute({ action: 'gate', payload: { target: 'experiment' } });
  assert.equal(gate.gate.allow, false);
  assert.equal(host.view().active.state, 'INTAKE');
});

test('user command text names the next action', () => {
  const host = createHost();
  host.execute({
    action: 'start', commandId: 'h1',
    payload: { playbookId: 'scientific-loop', title: '未知' },
  }, 'user');
  const denied = host.execute({
    action: 'experiment', commandId: 'h2', payload: { command: 'probe' },
  }, 'agent');
  assert.match(commandText(denied), /PREREG_REQUIRED/);
  assert.match(commandText(denied), /prereg_freeze/);
});

test('snapshot is read-only', () => {
  const host = createHost();
  const before = host.view().runs.length;
  const snap = host.execute({ action: 'snapshot' });
  assert.equal(snap.status, 'committed');
  assert.equal(host.view().runs.length, before);
});

// ===========================================================================
// Contract §2 host facade additions: actor permissions + command text.
// ===========================================================================

import { toolResult, knobFields, playbookIds } from '../../plugins/dsh-praxis/src/host.js';

const HOST_PREREG = {
  question: 'q',
  prediction: 'p',
  acceptance: 'a',
  acceptableFailure: 'f',
  controls: ['shuffle'],
  metrics: { primary: 'separation', threshold: 0.08 },
  input: { source: 'corpus' },
  budget: { wallMin: 30 },
  stop: { sameConclusion: 2 },
};

function hostStart(host, title = 'host run') {
  const started = host.execute({
    action: 'start',
    commandId: `h-start-${title}`,
    payload: { playbookId: 'scientific-loop', title },
  }, 'user');
  assert.equal(started.status, 'committed');
  return started.runId;
}

function hostFreeze(host, title = 'host run') {
  const runId = hostStart(host, title);
  const frozen = host.execute({
    action: 'prereg_freeze',
    commandId: `h-freeze-${title}`,
    runId,
    payload: { prereg: HOST_PREREG },
  }, 'user');
  assert.equal(frozen.status, 'committed');
  return runId;
}

test('host: fresh view exposes product, empty active run, defaults and knob fields', () => {
  const host = createHost();
  const view = host.view();
  assert.equal(view.product, 'Praxis');
  assert.equal(view.active, null);
  assert.deepEqual(view.runs, []);
  assert.ok(view.knobs);
  assert.ok(view.defaults);
  assert.ok(Array.isArray(view.knobFields) && view.knobFields.length >= 9);
  assert.equal(knobFields().length, view.knobFields.length);
  assert.equal(playbookIds().length, 4);
  assert.equal(view.playbooks.length, 4);
});

test('host: user source owns memory commit while agent source can only propose', () => {
  const host = createHost();
  const runId = hostFreeze(host, 'memory');
  const proposed = host.execute({
    action: 'memory_propose',
    commandId: 'h-propose',
    command: undefined,
    payload: { claim: '新路径存在', evidenceRefs: ['e1'] },
  }, 'agent');
  assert.equal(proposed.status, 'committed');
  const proposalId = host.engine.runView(runId).memory.proposals.at(-1).id;
  const agentCommit = host.execute({
    action: 'memory_commit',
    commandId: 'h-agent-commit',
    payload: { proposalId },
  }, 'agent');
  assert.equal(agentCommit.status, 'rejected');
  assert.equal(agentCommit.reasonCode, 'USER_ONLY');
  const userCommit = host.execute({
    action: 'memory_commit',
    commandId: 'h-user-commit',
    payload: { proposalId },
  }, 'user');
  assert.equal(userCommit.status, 'committed');
  assert.equal(host.engine.runView(runId).memory.commits.length, 1);
});

test('host: explicit actors drive evaluator/reviewer/coding permissions', () => {
  const host = createHost();
  const runId = hostFreeze(host, 'actors');
  const coding = host.execute({
    action: 'experiment',
    commandId: 'h-coding-exp',
    actor: { kind: 'coding', id: 'w1' },
    payload: { command: 'probe', artifactHash: 'h1' },
  });
  assert.equal(coding.status, 'committed');
  const reviewer = host.execute({
    action: 'review',
    commandId: 'h-review',
    actor: { kind: 'reviewer', id: 'r1' },
    payload: { verdict: 'pass', items: ['对照被破坏'] },
  });
  assert.equal(reviewer.status, 'committed');
  const evaluator = host.execute({
    action: 'eval_report',
    commandId: 'h-eval-report',
    actor: { kind: 'evaluator', id: 'e1' },
    payload: { reportHash: 'rh1', verdict: 'pass', seeds: 3 },
  });
  assert.equal(evaluator.status, 'committed');
  const userEval = host.execute({
    action: 'eval_report',
    commandId: 'h-user-eval',
    actor: { kind: 'user', id: 'owner' },
    payload: { reportHash: 'rh2', verdict: 'pass' },
  });
  assert.equal(userEval.status, 'rejected');
  assert.equal(userEval.reasonCode, 'FORBIDDEN_ACTOR');
  assert.equal(host.engine.runView(runId).eval.reportHash, 'rh1');
});

test('host: read-only commands work with any actor and never mutate state', () => {
  const host = createHost();
  assert.equal(host.execute({ action: 'gate', payload: { target: 'experiment' } }, 'user').reasonCode, 'NO_RUN');
  assert.equal(host.execute({ action: 'map' }, 'user').reasonCode, 'NO_RUN');
  const runId = hostStart(host, 'readonly');
  const before = host.engine.runView(runId).version;
  const gate = host.execute({ action: 'gate', runId, payload: { target: 'experiment' } }, 'agent');
  assert.equal(gate.status, 'committed');
  assert.equal(gate.gate.allow, false);
  assert.equal(gate.gate.nextAction, 'prereg_freeze');
  const map = host.execute({ action: 'map', runId }, 'user');
  assert.equal(map.status, 'committed');
  assert.ok(Array.isArray(map.map.nodes));
  const snapshot = host.execute({ action: 'snapshot' }, 'user');
  assert.equal(snapshot.status, 'committed');
  assert.equal(host.engine.runView(runId).version, before);
});

test('host: commandText is honest about committed, replayed and rejected commands', () => {
  const host = createHost();
  const committed = host.execute({
    action: 'start', commandId: 'h-txt-start',
    payload: { playbookId: 'scientific-loop', title: '文本' },
  }, 'user');
  assert.match(commandText(committed), /committed/i);
  assert.match(commandText(committed), new RegExp(committed.runId));
  const replayed = host.execute({
    action: 'start', commandId: 'h-txt-start',
    payload: { playbookId: 'scientific-loop', title: '文本' },
  }, 'user');
  assert.equal(replayed.status, 'replayed');
  assert.match(commandText(replayed), /replayed/i);
  const rejected = host.execute({
    action: 'experiment', commandId: 'h-txt-exp', payload: { command: 'probe' },
  }, 'agent');
  assert.equal(rejected.status, 'rejected');
  assert.match(commandText(rejected), /PREREG_REQUIRED/);
  assert.match(commandText(rejected), /prereg_freeze/);
});

test('host: toolResult keeps the machine-readable fields separate from prose', () => {
  const host = createHost();
  hostStart(host, 'tool');
  const denied = host.execute({
    action: 'experiment', commandId: 'h-tool-exp', payload: { command: 'probe' },
  }, 'agent');
  const result = toolResult(denied);
  for (const key of ['status', 'reasonCode', 'runId', 'nextAction', 'blockers', 'forked', 'state']) {
    assert.ok(key in result, `toolResult.${key} missing`);
  }
  assert.equal(result.status, 'rejected');
  assert.equal(result.reasonCode, 'PREREG_REQUIRED');
  assert.ok(result.blockers.length > 0);
  assert.equal(result.nextAction, 'prereg_freeze');
  assert.equal(result.forked, false);
});

test('host: unknown actions are rejected without touching engine state', () => {
  const host = createHost();
  hostStart(host, 'unknown');
  const before = host.view().runs[0].version;
  const unknown = host.execute({ action: 'nuke-everything', commandId: 'h-unknown' }, 'user');
  assert.equal(unknown.status, 'rejected');
  assert.equal(unknown.reasonCode, 'UNKNOWN_ACTION');
  assert.equal(host.view().runs[0].version, before);
});
