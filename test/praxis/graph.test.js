import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildDefaultGraph, validateGraph, graphStates } from '../../plugins/dsh-praxis/src/graph.js';
import { createEngine, PLAYBOOKS, DEFAULT_KNOBS } from '../../plugins/dsh-praxis/src/engine.js';

/**
 * 图模型契约 v2（docs/praxis/redesign/10-v2-contract.md §1.2–§2）。
 *
 * 实现侧接口（本文件固化）：
 *   buildDefaultGraph(playbook)        -> Graph
 *   validateGraph(graph, playbook)     -> { ok: boolean, errors: [{ code: 'V1'..'V11', message? }] }
 *   graphStates(run, graph, context)   -> { states: Record<nodeId, {execution,condition,reason}>,
 *                                           current, edges, version, progress, audit }
 *
 * v2 §1.2：节点状态是双轴对象；v2 T2.1：执行轴只由 receipt + 状态游标决定。
 * §4 的投影全部来自真实 engine 生命周期（禁止手写 fakeRun）。
 */

const DEFAULT_PLAYBOOK = PLAYBOOKS['scientific-loop'];

const NODE_TYPES = ['start', 'stage', 'gate', 'actor', 'end'];
const PORTS = ['contract', 'artifact', 'evidence', 'veto'];
/** v2 §1.2 双轴枚举。 */
const EXECUTION_STATES = ['pending', 'active', 'done', 'blocked', 'failed'];
const CONDITION_STATES = ['missing', 'satisfied', 'stale', 'unknown'];

const defaultGraph = () => buildDefaultGraph(DEFAULT_PLAYBOOK);
const clone = (value) => structuredClone(value);

function validate(graph, playbook = DEFAULT_PLAYBOOK) {
  const result = validateGraph(graph, playbook);
  assert.ok(result && typeof result === 'object', 'validateGraph must return an object');
  assert.ok(Array.isArray(result.errors), 'validateGraph must return errors[]');
  assert.equal(result.ok, result.errors.length === 0);
  return result;
}

function codes(result) {
  return result.errors.map((error) => (typeof error === 'string' ? error : error.code));
}

function expectCode(graph, code, playbook) {
  const result = validate(graph, playbook);
  assert.equal(result.ok, false, `graph must be rejected (${code})`);
  assert.ok(
    codes(result).includes(code),
    `expected ${code} in ${JSON.stringify(codes(result))}`,
  );
}

function stageNode(graph, stage) {
  const node = graph.nodes.find((item) => item.type === 'stage' && item.stage === stage);
  assert.ok(node, `stage node ${stage}`);
  return node;
}

function gateNode(graph, gate) {
  const node = graph.nodes.find((item) => item.type === 'gate' && item.config?.gate === gate);
  assert.ok(node, `gate node ${gate}`);
  return node;
}

function nodeById(graph, id) {
  const node = graph.nodes.find((item) => item.id === id);
  assert.ok(node, `node ${id}`);
  return node;
}

function edgeBy(graph, fromId, toId) {
  return graph.edges.find((edge) => edge.from === fromId && edge.to === toId);
}

// ---------------------------------------------------------------------------
// 真实生命周期夹具（v2 T2.1：receipt 是执行轴权威，不能用假 run 推 gate done）
// ---------------------------------------------------------------------------

const PREREG = {
  question: 'q', prediction: 'p', acceptance: 'a', acceptableFailure: 'f',
  controls: ['shuffle'], metrics: { primary: 'separation', threshold: 0.08 },
  input: { source: 'corpus' }, budget: { wallMin: 30 }, stop: { sameConclusion: 2 },
};

const PACKAGES = [
  {
    persona: 'theorist', claim: '未知结构可以被主动提取',
    assumptions: ['信号存在于声明的语料'], evidence: ['derivation:1'],
    style: 'theoretical', minority: true, retained: true,
  },
  {
    persona: 'empiricist', claim: '当前语料只支持均值回归',
    assumptions: ['噪声解释全部方差'], evidence: ['data:2'],
    style: 'empirical', minority: false, retained: true,
  },
];

function send(engine, runId, commandId, actorKind, action, payload = {}) {
  return engine.execute({
    commandId,
    actor: { kind: actorKind, id: `${actorKind}-1` },
    action,
    runId,
    payload,
  });
}

const LIFECYCLE_STEPS = {
  QUESTION: (engine, runId, tag) => send(engine, runId, `${tag}-question`, 'root', 'question', {
    question: { text: '未知结构能否被主动提取？', hypothesis: '存在可分离结构', unknowns: ['噪声上限'] },
  }),
  PREREG_FROZEN: (engine, runId, tag) => send(engine, runId, `${tag}-freeze`, 'root', 'prereg_freeze', { prereg: PREREG }),
  DISCUSSION: (engine, runId, tag) => send(engine, runId, `${tag}-discussion`, 'root', 'discussion', { round: 1, packages: PACKAGES }),
  EXECUTING: (engine, runId, tag) => send(engine, runId, `${tag}-experiment`, 'coding', 'experiment', {
    command: 'probe', artifactHash: 'artifact-1',
  }),
  REVIEW: (engine, runId, tag) => send(engine, runId, `${tag}-review`, 'reviewer', 'review', {
    verdict: 'pass', items: ['对照被破坏'],
  }),
  STAGE4: (engine, runId, tag) => send(engine, runId, `${tag}-stage4`, 'root', 'stage4', {}),
  EVAL: (engine, runId, tag) => send(engine, runId, `${tag}-eval-report`, 'evaluator', 'eval_report', {
    reportHash: 'report-1', verdict: 'pass', seeds: DEFAULT_KNOBS.evalSeeds,
  }),
  MEMORY: (engine, runId, tag) => send(engine, runId, `${tag}-eval-read`, 'user', 'eval_read', { reportHash: 'report-1' }),
};

/** Start a run and walk it to `target` through real engine commands. */
function runAt(target, tag = `states-${target}`) {
  const engine = createEngine();
  const started = engine.execute({
    commandId: `${tag}-start`,
    actor: { kind: 'root', id: 'root' },
    action: 'start',
    payload: { playbookId: 'scientific-loop', title: tag },
  });
  assert.equal(started.status, 'committed');
  const runId = started.runId;
  const order = ['INTAKE', 'QUESTION', 'PREREG_FROZEN', 'DISCUSSION', 'EXECUTING', 'REVIEW', 'STAGE4', 'EVAL', 'MEMORY'];
  while (engine.getRun(runId).state !== target) {
    const index = order.indexOf(engine.getRun(runId).state);
    assert.ok(index >= 0 && index < order.length - 1, `cannot advance from ${engine.getRun(runId).state}`);
    const next = order[index + 1];
    const receipt = LIFECYCLE_STEPS[next](engine, runId, tag);
    assert.equal(receipt.status, 'committed', `advance to ${next}: ${receipt.reasonCode ?? 'ok'}`);
  }
  return { engine, runId };
}

/** Real graph projection for the run, receipt-backed (v2 T2.1). */
function project(engine, runId) {
  const run = engine.getRun(runId);
  const graph = engine.getGraph(run.playbookId);
  return { graph, run, overlay: statesOf(run, graph, { receipts: engine.receiptsFor(runId) }) };
}

function statesOf(run, graph, context) {
  const overlay = graphStates(run, graph, context);
  assert.ok(overlay && typeof overlay === 'object', 'graphStates must return an object');
  assert.ok(overlay.states && typeof overlay.states === 'object', 'graphStates must return {states}');
  assert.ok(overlay.audit && typeof overlay.audit.ok === 'boolean', 'graphStates must return {audit.ok}');
  assert.ok(Array.isArray(overlay.audit.violations), 'graphStates must return {audit.violations}');
  assert.ok(overlay.progress && typeof overlay.progress.done === 'number', 'graphStates must return {progress}');
  assert.equal(typeof overlay.progress.total, 'number');
  assert.equal(typeof overlay.progress.index, 'number');
  // v2 I5：progress 必须与派生 states 一致。
  const done = Object.values(overlay.states).filter((state) => state.execution === 'done').length;
  assert.equal(overlay.progress.done, done, 'I5: progress.done matches done nodes');
  assert.equal(overlay.progress.total, graph.nodes.length, 'I5: progress.total matches node count');
  return overlay;
}

// ---------------------------------------------------------------------------
// §2 默认图
// ---------------------------------------------------------------------------

test('graph: buildDefaultGraph validates for every playbook and covers all stages', () => {
  for (const playbook of Object.values(PLAYBOOKS)) {
    const graph = buildDefaultGraph(playbook);
    assert.equal(graph.playbookId, playbook.id);
    assert.ok(Number.isInteger(graph.version) && graph.version >= 1);
    assert.equal(graph.id, `${playbook.id}:v${graph.version}`);
    assert.equal(typeof graph.name, 'string');
    assert.ok(!Number.isNaN(Date.parse(graph.updatedAt)), 'updatedAt must be a date string');
    assert.equal(typeof graph.contentHash, 'string');
    assert.ok(Array.isArray(graph.nodes) && graph.nodes.length > 0);
    assert.ok(Array.isArray(graph.edges));
    assert.equal(validate(graph, playbook).ok, true, `${playbook.id} default graph must validate`);

    const covered = new Set(graph.nodes.map((node) => node.stage).filter(Boolean));
    for (const stage of playbook.stages) {
      assert.ok(covered.has(stage), `${playbook.id} default graph covers stage ${stage}`);
    }

    assert.equal(graph.nodes.filter((node) => node.type === 'start').length, 1);
    assert.ok(graph.nodes.filter((node) => node.type === 'end').length >= 1);
    for (const node of graph.nodes) {
      assert.ok(NODE_TYPES.includes(node.type), `node type ${node.type}`);
      assert.ok(Number.isFinite(node.position?.x) && Number.isFinite(node.position?.y));
      assert.equal(typeof node.label, 'string');
    }
    for (const edge of graph.edges) {
      assert.ok(PORTS.includes(edge.port), `edge port ${edge.port}`);
      assert.ok(graph.nodes.some((node) => node.id === edge.from), `edge from ${edge.from}`);
      assert.ok(graph.nodes.some((node) => node.id === edge.to), `edge to ${edge.to}`);
    }
  }
});

test('graph: default scientific-loop graph has the contract topology and typed nodes', () => {
  const graph = defaultGraph();

  // start / end 的出入边规则。
  const start = graph.nodes.find((node) => node.type === 'start');
  const end = graph.nodes.find((node) => node.type === 'end');
  assert.ok(start && end);
  assert.equal(graph.edges.some((edge) => edge.to === start.id), false, 'start has no in-edges');
  assert.equal(graph.edges.some((edge) => edge.from === end.id), false, 'end has no out-edges');

  // 写在契约 §2 的 gate 节点及 action。
  const preregGate = gateNode(graph, 'prereg');
  assert.equal(preregGate.config.action, 'prereg_freeze');
  const experimentGate = gateNode(graph, 'experiment');
  const evalGate = gateNode(graph, 'eval');
  assert.equal(evalGate.config.action, 'eval_read');
  assert.ok(experimentGate);

  // stage 节点的 action 由 stage 推断。
  const actions = {
    discussion: 'discussion',
    experiment: 'experiment',
    review: 'review',
    stage4: 'stage4',
    eval: 'eval_report',
    memory: 'memory_propose',
    decision: 'decision',
  };
  for (const [stage, action] of Object.entries(actions)) {
    assert.equal(stageNode(graph, stage).config.action, action, `${stage} action`);
  }

  // 边端口：gate→stage 用 contract；stage→stage 用 artifact；至少一条 evidence。
  for (const edge of graph.edges) {
    const from = nodeById(graph, edge.from);
    const to = nodeById(graph, edge.to);
    if (from.type === 'gate' && to.type === 'stage') {
      assert.equal(edge.port, 'contract', `gate ${from.id} → ${to.id}`);
    }
    if (from.type === 'stage' && to.type === 'stage') {
      const isEvidence = edge.port === 'evidence';
      const isReviewEval = from.stage === 'review' && to.stage === 'eval';
      if (isEvidence) {
        assert.ok(isReviewEval, `evidence edge must be review→eval (${from.id}→${to.id})`);
      } else if (isReviewEval) {
        assert.equal(edge.port, 'evidence', 'review→eval uses evidence');
      } else {
        assert.equal(edge.port, 'artifact', `stage ${from.id} → ${to.id}`);
      }
    }
  }
  assert.ok(graph.edges.some((edge) => edge.port === 'evidence'), 'default graph has an evidence edge');

  // 默认图是一条从 start 到 end 的单链（拓扑可达且无环）。
  const byId = new Map(graph.nodes.map((node) => [node.id, node]));
  const outgoing = new Map();
  for (const edge of graph.edges) {
    if (!outgoing.has(edge.from)) outgoing.set(edge.from, []);
    outgoing.get(edge.from).push(edge.to);
  }
  const seen = new Set();
  const stack = [start.id];
  while (stack.length > 0) {
    const id = stack.pop();
    assert.ok(byId.has(id), `reachable node ${id}`);
    assert.equal(seen.has(id), false, `no cycle through ${id}`);
    seen.add(id);
    for (const next of outgoing.get(id) ?? []) stack.push(next);
  }
  assert.equal(seen.has(end.id), true, 'end is reachable from start');
  assert.equal(seen.size, graph.nodes.length, 'every node is reachable from start');
});

test('graph: default node ids are stable and unique', () => {
  const first = buildDefaultGraph(DEFAULT_PLAYBOOK);
  const second = buildDefaultGraph(DEFAULT_PLAYBOOK);
  assert.deepEqual(
    first.nodes.map((node) => node.id),
    second.nodes.map((node) => node.id),
    'node ids must be deterministic',
  );
  assert.deepEqual(
    first.edges.map((edge) => edge.id),
    second.edges.map((edge) => edge.id),
    'edge ids must be deterministic',
  );
  const ids = new Set(first.nodes.map((node) => node.id));
  assert.equal(ids.size, first.nodes.length, 'node ids are unique');
  const edgeIds = new Set(first.edges.map((edge) => edge.id));
  assert.equal(edgeIds.size, first.edges.length, 'edge ids are unique');
});

// ---------------------------------------------------------------------------
// §3 校验 V1–V9
// ---------------------------------------------------------------------------

test('graph: a valid default graph passes validation with no errors', () => {
  const result = validate(defaultGraph());
  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, []);
});

test('graph: V1 rejects duplicate node ids', () => {
  const graph = defaultGraph();
  const duplicate = clone(graph.nodes[1]);
  graph.nodes.push(duplicate);
  expectCode(graph, 'V1');
});

test('graph: V2 rejects edges with unknown endpoints', () => {
  const graph = defaultGraph();
  graph.edges.push({ id: 'e_ghost', from: 'ghost_node', to: graph.nodes[1].id, port: 'artifact' });
  expectCode(graph, 'V2');
  const graph2 = defaultGraph();
  graph2.edges.push({ id: 'e_ghost2', from: graph2.nodes[1].id, to: 'ghost_node', port: 'artifact' });
  expectCode(graph2, 'V2');
});

test('graph: V3 rejects cycles and self-loops', () => {
  const graph = defaultGraph();
  graph.edges.push({
    id: 'e_cycle',
    from: stageNode(graph, 'decision').id,
    to: stageNode(graph, 'intake').id,
    port: 'artifact',
  });
  expectCode(graph, 'V3');

  const selfLoop = defaultGraph();
  const intake = stageNode(selfLoop, 'intake').id;
  selfLoop.edges.push({ id: 'e_self', from: intake, to: intake, port: 'artifact' });
  expectCode(selfLoop, 'V3');
});

test('graph: V4 requires exactly one start, at least one end, and endpoint edges', () => {
  const noStart = defaultGraph();
  const start = noStart.nodes.find((node) => node.type === 'start');
  noStart.nodes = noStart.nodes.filter((node) => node.id !== start.id);
  noStart.edges = noStart.edges.filter((edge) => edge.from !== start.id && edge.to !== start.id);
  expectCode(noStart, 'V4');

  const twoStarts = defaultGraph();
  const start2 = clone(start);
  start2.id = 'n_start_2';
  start2.position = { x: 999, y: 999 };
  twoStarts.nodes.push(start2);
  twoStarts.edges.push({ id: 'e_start2', from: start2.id, to: stageNode(twoStarts, 'intake').id, port: 'artifact' });
  expectCode(twoStarts, 'V4');

  const noEnd = defaultGraph();
  const end = noEnd.nodes.find((node) => node.type === 'end');
  noEnd.nodes = noEnd.nodes.filter((node) => node.id !== end.id);
  noEnd.edges = noEnd.edges.filter((edge) => edge.from !== end.id && edge.to !== end.id);
  expectCode(noEnd, 'V4');
});

test('graph: V5 rejects unknown types, stageless stages and uncovered playbook stages', () => {
  const badType = defaultGraph();
  badType.nodes[0].type = 'bogus';
  expectCode(badType, 'V5');

  const missingStage = defaultGraph();
  missingStage.nodes.find((node) => node.type === 'stage' && node.stage).stage = undefined;
  expectCode(missingStage, 'V5');

  // 删掉 review 节点，把 experiment → stage4 接上：review 这个 playbook stage 未被覆盖。
  const uncovered = defaultGraph();
  const review = stageNode(uncovered, 'review');
  const experiment = stageNode(uncovered, 'experiment');
  const stage4 = stageNode(uncovered, 'stage4');
  uncovered.nodes = uncovered.nodes.filter((node) => node.id !== review.id);
  uncovered.edges = uncovered.edges.filter(
    (edge) => edge.from !== review.id && edge.to !== review.id,
  );
  uncovered.edges.push({
    id: 'e_skip_review',
    from: experiment.id,
    to: stage4.id,
    port: 'artifact',
  });
  expectCode(uncovered, 'V5');
});

test('graph: V6 rejects gates without config.gate and gates placed after their guarded stage', () => {
  const missingGate = defaultGraph();
  gateNode(missingGate, 'prereg').config = {};
  expectCode(missingGate, 'V6');

  // 把 prereg_gate 挪到它守护的 stage 之后，同时保持单链与 DAG 无环。
  const reversed = defaultGraph();
  const preregGate = gateNode(reversed, 'prereg');
  const guarded = reversed.nodes.find(
    (node) => node.type === 'stage'
      && node.stage === (preregGate.config.guards ?? preregGate.config.gate),
  );
  assert.ok(guarded, 'prereg_gate must declare the stage it guards');
  const inEdge = reversed.edges.find((edge) => edge.to === preregGate.id);
  const outEdge = reversed.edges.find((edge) => edge.from === preregGate.id);
  const succEdge = reversed.edges.find((edge) => edge.from === guarded.id);
  assert.ok(inEdge && outEdge && succEdge);
  reversed.edges = reversed.edges.filter(
    (edge) => edge !== inEdge && edge !== outEdge && edge !== succEdge,
  );
  reversed.edges.push(
    { id: 'e_v6_pred_guarded', from: inEdge.from, to: guarded.id, port: 'artifact' },
    { id: 'e_v6_guarded_gate', from: guarded.id, to: preregGate.id, port: 'artifact' },
    { id: 'e_v6_gate_succ', from: preregGate.id, to: succEdge.to, port: 'contract' },
  );
  expectCode(reversed, 'V6');
});

test('graph: V7 rejects non-finite node positions', () => {
  const nan = defaultGraph();
  nan.nodes[1].position = { x: Number.NaN, y: 0 };
  expectCode(nan, 'V7');

  const infinite = defaultGraph();
  infinite.nodes[1].position = { x: 0, y: Number.POSITIVE_INFINITY };
  expectCode(infinite, 'V7');
});

test('graph: V8 rejects unknown edge ports', () => {
  const graph = defaultGraph();
  graph.edges[0].port = 'telepathy';
  expectCode(graph, 'V8');
});

test('graph: V9 rejects artifact edges out of non-stage/non-actor nodes', () => {
  const graph = defaultGraph();
  const gateEdge = graph.edges.find((edge) => edge.port === 'contract');
  assert.ok(gateEdge, 'default graph has contract edges from gates');
  gateEdge.port = 'artifact';
  expectCode(graph, 'V9');
});

test('graph: validation never mutates the candidate graph', () => {
  const graph = defaultGraph();
  const before = clone(graph);
  validate(graph);
  const broken = defaultGraph();
  broken.edges[0].port = 'telepathy';
  const brokenBefore = clone(broken);
  validate(broken);
  assert.deepEqual(graph, before);
  assert.deepEqual(broken, brokenBefore);
});

// ---------------------------------------------------------------------------
// §4 graphStates（v2 双轴投影，投影全部来自真实 engine 生命周期）
// ---------------------------------------------------------------------------

test('graphStates: INTAKE makes the intake stage active and current', () => {
  const { engine, runId } = runAt('INTAKE');
  const { graph, overlay } = project(engine, runId);
  const states = overlay.states;

  for (const node of graph.nodes) {
    const state = states[node.id];
    assert.ok(state && typeof state === 'object', `state for ${node.id}`);
    assert.ok(EXECUTION_STATES.includes(state.execution), `execution for ${node.id}`);
    assert.ok(CONDITION_STATES.includes(state.condition), `condition for ${node.id}`);
    assert.ok(state.reason === null || typeof state.reason === 'string', `reason for ${node.id}`);
  }
  assert.equal(states[stageNode(graph, 'intake').id].execution, 'active');
  assert.equal(states[stageNode(graph, 'question').id].execution, 'pending');
  // v2 T2.3：condition 与 execution 独立；还没到 gate 的守护阶段时 gate 仍是 pending。
  assert.equal(states[gateNode(graph, 'prereg').id].execution, 'pending');
  assert.equal(states[gateNode(graph, 'prereg').id].condition, 'missing');
  assert.equal(overlay.current, stageNode(graph, 'intake').id);
  assert.deepEqual(overlay.progress, { done: 1, total: 15, index: 0 });
  assert.equal(overlay.audit.ok, true);
});

test('graphStates: PREREG_FROZEN makes prereg_gate done and experiment_gate pending', () => {
  const { engine, runId } = runAt('PREREG_FROZEN');
  const { graph, overlay } = project(engine, runId);
  const states = overlay.states;
  const preregGate = gateNode(graph, 'prereg');
  const experimentGate = gateNode(graph, 'experiment');
  assert.equal(states[preregGate.id].execution, 'done');
  assert.equal(states[preregGate.id].condition, 'satisfied');
  // v2 T2.1：experiment gate 只有到 EXECUTING 才被“到达”，因此仍是 pending。
  assert.equal(states[experimentGate.id].execution, 'pending');
  assert.equal(states[experimentGate.id].condition, 'missing');
  assert.equal(states[stageNode(graph, 'prereg').id].execution, 'active');
  assert.equal(states[gateNode(graph, 'eval').id].execution, 'pending');
  const active = Object.entries(states)
    .filter(([, state]) => state.execution === 'active' || state.execution === 'blocked')
    .map(([id]) => id);
  assert.ok(active.includes(overlay.current), 'current is an active/blocked node');
  // v2 §1.2：reason 必须人类可读，不得泄漏内部码。
  for (const [id, state] of Object.entries(states)) {
    if (state.reason == null) continue;
    assert.ok(!/[a-z]+_[a-z]+/.test(state.reason), `${id} reason leaks an internal code`);
  }
  assert.equal(overlay.audit.ok, true);
});

test('graphStates: without a frozen prereg neither gate is done and the legacy contract is stale', () => {
  // 新 Run：INTAKE 还没到达任何 gate，双轴都必须是 pending/missing。
  const { engine, runId } = runAt('INTAKE', 'states-no-prereg');
  const { graph, overlay } = project(engine, runId);
  const states = overlay.states;
  assert.equal(states[gateNode(graph, 'prereg').id].execution, 'pending');
  assert.equal(states[gateNode(graph, 'prereg').id].condition, 'missing');
  assert.equal(states[gateNode(graph, 'experiment').id].execution, 'pending');
  assert.equal(states[gateNode(graph, 'experiment').id].condition, 'missing');
  assert.equal(states[gateNode(graph, 'experiment').id].execution === 'done', false);
  const gate = engine.gate(runId, 'experiment');
  assert.equal(gate.allow, false);
  assert.ok(gate.missing.includes('prereg.frozen'));
  assert.equal(overlay.audit.ok, true);

  // v2 T4.1/T4.2：fork 子 Run 只继承草稿契约，condition=stale，且未重冻结前门禁仍拒绝。
  const parent = runAt('PREREG_FROZEN', 'states-fork-elder');
  const forked = parent.engine.execute({
    commandId: 'states-fork-knobs',
    actor: { kind: 'user', id: 'owner' },
    action: 'set_knobs',
    runId: parent.runId,
    payload: { knobs: { ...DEFAULT_KNOBS, heterogeneityFloor: 0.55 } },
  });
  assert.equal(forked.status, 'committed');
  assert.equal(forked.forked, true);
  const child = project(parent.engine, forked.runId);
  const childStates = child.overlay.states;
  assert.equal(parent.engine.getRun(forked.runId).state, 'INTAKE');
  assert.equal(childStates[gateNode(child.graph, 'prereg').id].condition, 'stale');
  assert.equal(childStates[gateNode(child.graph, 'prereg').id].execution, 'pending');
  assert.equal(childStates[gateNode(child.graph, 'experiment').id].execution, 'pending');
  assert.equal(parent.engine.gate(forked.runId, 'experiment').allow, false);
});

test('graphStates: EVAL keeps eval_gate blocked until eval_read (receipt-driven)', () => {
  const { engine, runId } = runAt('EVAL', 'states-eval');
  const before = project(engine, runId);
  const evalGate = gateNode(before.graph, 'eval');
  // v2 T2.1：有 reportHash（condition=satisfied）不足以让 gate done，
  // 必须存在本 Run 的 eval_read receipt；到 EVAL 后它是 blocked，而不是 done。
  assert.equal(before.overlay.states[evalGate.id].condition, 'satisfied');
  assert.equal(before.overlay.states[evalGate.id].execution, 'blocked');
  assert.notEqual(before.overlay.states[evalGate.id].execution, 'done');
  assert.ok(
    ['active', 'blocked'].includes(before.overlay.states[before.overlay.current]?.execution),
    'current is an active/blocked node',
  );
  assert.equal(before.overlay.audit.ok, true);

  const read = send(engine, runId, 'states-eval-read', 'user', 'eval_read', { reportHash: 'report-1' });
  assert.equal(read.status, 'committed');
  assert.equal(engine.getRun(runId).state, 'MEMORY');
  const after = project(engine, runId);
  assert.equal(after.overlay.states[evalGate.id].execution, 'done');
  assert.equal(after.overlay.states[stageNode(after.graph, 'eval').id].execution, 'done');
  assert.equal(after.overlay.states[stageNode(after.graph, 'memory').id].execution, 'active');
  assert.equal(after.overlay.current, stageNode(after.graph, 'memory').id);
  assert.equal(after.overlay.audit.ok, true);
});

test('graphStates: DRIFT_DETECTED fails the walked stage nodes', () => {
  const { engine, runId } = runAt('MEMORY', 'states-drift');
  const first = send(engine, runId, 'states-drift-decision-1', 'user', 'decision', {
    conclusion: '结构不存在', next: 'repeat-same', evidenceRefs: ['e1'],
  });
  assert.equal(first.status, 'committed');
  const drift = send(engine, runId, 'states-drift-decision-2', 'user', 'decision', {
    conclusion: '结构不存在', next: 'repeat-same', evidenceRefs: ['e1'],
  });
  assert.equal(drift.reasonCode, 'DRIFT_DETECTED');
  assert.equal(engine.getRun(runId).state, 'DRIFT_DETECTED');

  const { graph, overlay } = project(engine, runId);
  const states = overlay.states;
  assert.equal(states[stageNode(graph, 'intake').id].execution, 'failed');
  assert.equal(states[stageNode(graph, 'memory').id].execution, 'failed');
  assert.equal(states[gateNode(graph, 'eval').id].execution, 'failed');
  assert.ok(
    Object.values(states).some((state) => state.execution === 'failed'),
    'at least one node failed',
  );
  assert.equal(states[graph.nodes.find((node) => node.id === 'end').id].execution, 'pending');
});

test('graphStates: stage progression marks past stages done and future stages pending', () => {
  const { engine, runId } = runAt('REVIEW', 'states-review');
  const { graph, overlay } = project(engine, runId);
  const states = overlay.states;
  assert.equal(states[stageNode(graph, 'experiment').id].execution, 'done');
  assert.equal(states[stageNode(graph, 'review').id].execution, 'active');
  assert.equal(states[stageNode(graph, 'stage4').id].execution, 'pending');
  assert.equal(overlay.current, stageNode(graph, 'review').id);
  // 已提交 receipt 的 gate 是 done；尚未到达的 eval gate 仍是 pending。
  assert.equal(states[gateNode(graph, 'prereg').id].execution, 'done');
  assert.equal(states[gateNode(graph, 'experiment').id].execution, 'done');
  assert.equal(states[gateNode(graph, 'eval').id].execution, 'pending');
  assert.equal(overlay.audit.ok, true);
});

test('graphStates: pure — does not mutate run or graph', () => {
  const { engine, runId } = runAt('DISCUSSION', 'states-pure');
  const run = engine.getRun(runId);
  const graph = engine.getGraph('scientific-loop');
  const graphBefore = clone(graph);
  const runBefore = clone(run);
  project(engine, runId);
  assert.deepEqual(graph, graphBefore);
  assert.deepEqual(run, runBefore);
});
