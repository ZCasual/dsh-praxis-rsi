import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildDefaultGraph, validateGraph, graphStates } from '../../plugins/dsh-praxis/src/graph.js';
import { PLAYBOOKS } from '../../plugins/dsh-praxis/src/engine.js';

/**
 * 图模型契约 v1（docs/praxis/redesign/07-graph-contract.md §1–§4）。
 *
 * 实现侧接口（本文件固化）：
 *   buildDefaultGraph(playbook)        -> Graph
 *   validateGraph(graph, playbook)     -> { ok: boolean, errors: [{ code: 'V1'..'V9', message? }] }
 *   graphStates(run, graph)            -> { states: Record<nodeId, NodeState>, current: nodeId|null }
 */

const DEFAULT_PLAYBOOK = PLAYBOOKS['scientific-loop'];

const NODE_TYPES = ['start', 'stage', 'gate', 'actor', 'end'];
const PORTS = ['contract', 'artifact', 'evidence', 'veto'];
const NODE_STATES = ['pending', 'active', 'blocked', 'done', 'failed', 'quarantined'];

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

function fakeRun(overrides = {}) {
  return {
    id: 'run_graph_1',
    state: 'INTAKE',
    version: 1,
    preregHash: null,
    eval: { reportHash: null, readAt: null },
    ...overrides,
    ...(overrides.eval ? { eval: { reportHash: null, readAt: null, ...overrides.eval } } : {}),
  };
}

function statesOf(run, graph) {
  const overlay = graphStates(run, graph);
  assert.ok(overlay && typeof overlay === 'object', 'graphStates must return an object');
  assert.ok(overlay.states && typeof overlay.states === 'object', 'graphStates must return {states}');
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
// §4 graphStates
// ---------------------------------------------------------------------------

test('graphStates: INTAKE makes the intake stage active and current', () => {
  const graph = defaultGraph();
  const run = fakeRun({ state: 'INTAKE' });
  const overlay = statesOf(run, graph);
  const states = overlay.states;

  for (const node of graph.nodes) {
    assert.ok(NODE_STATES.includes(states[node.id]), `state for ${node.id}`);
  }
  assert.equal(states[stageNode(graph, 'intake').id], 'active');
  assert.equal(states[stageNode(graph, 'question').id], 'pending');
  assert.equal(overlay.current, stageNode(graph, 'intake').id);
});

test('graphStates: PREREG_FROZEN makes prereg_gate done and experiment_gate active', () => {
  const graph = defaultGraph();
  const run = fakeRun({ state: 'PREREG_FROZEN', preregHash: 'prereg-hash-1' });
  const overlay = statesOf(run, graph);
  assert.equal(overlay.states[gateNode(graph, 'prereg').id], 'done');
  assert.equal(overlay.states[gateNode(graph, 'experiment').id], 'active');
  assert.equal(overlay.states[gateNode(graph, 'eval').id], 'pending');
  const active = Object.entries(overlay.states)
    .filter(([, state]) => state === 'active' || state === 'blocked')
    .map(([id]) => id);
  assert.ok(active.includes(overlay.current), 'current is an active/blocked node');
});

test('graphStates: without preregHash experiment_gate is blocked and prereg_gate active', () => {
  const graph = defaultGraph();
  const run = fakeRun({ state: 'INTAKE', preregHash: null });
  const overlay = statesOf(run, graph);
  assert.equal(overlay.states[gateNode(graph, 'prereg').id], 'active');
  assert.equal(overlay.states[gateNode(graph, 'experiment').id], 'blocked');
});

test('graphStates: EVAL with readAt makes eval_gate done, without it eval_gate active', () => {
  const graph = defaultGraph();
  const read = statesOf(fakeRun({
    state: 'EVAL',
    preregHash: 'h',
    eval: { reportHash: 'report-1', readAt: '2026-11-04T00:00:00.000Z' },
  }), graph);
  assert.equal(read.states[gateNode(graph, 'eval').id], 'done');

  const unread = statesOf(fakeRun({
    state: 'EVAL',
    preregHash: 'h',
    eval: { reportHash: 'report-1', readAt: null },
  }), graph);
  assert.equal(unread.states[gateNode(graph, 'eval').id], 'active');

  const noReport = statesOf(fakeRun({
    state: 'PREREG_FROZEN',
    preregHash: 'h',
    eval: { reportHash: null, readAt: null },
  }), graph);
  assert.equal(noReport.states[gateNode(graph, 'eval').id], 'pending');

  // 契约 §4：eval_gate 只认 readAt/reportHash，不因 cursor 到 EVAL 就变 active。
  const evalNoReport = statesOf(fakeRun({
    state: 'EVAL',
    preregHash: 'h',
    eval: { reportHash: null, readAt: null },
  }), graph);
  assert.equal(evalNoReport.states[gateNode(graph, 'eval').id], 'pending');
});

test('graphStates: DRIFT_DETECTED fails the walked stage nodes', () => {
  const graph = defaultGraph();
  const run = fakeRun({ state: 'DRIFT_DETECTED', preregHash: 'h' });
  const overlay = statesOf(run, graph);
  assert.equal(overlay.states[stageNode(graph, 'intake').id], 'failed');
  assert.ok(
    Object.values(overlay.states).includes('failed'),
    'at least one node failed',
  );
});

test('graphStates: stage progression marks past stages done and future stages pending', () => {
  const graph = defaultGraph();
  const run = fakeRun({ state: 'REVIEW', preregHash: 'h' });
  const overlay = statesOf(run, graph);
  assert.equal(overlay.states[stageNode(graph, 'experiment').id], 'done');
  assert.equal(overlay.states[stageNode(graph, 'review').id], 'active');
  assert.equal(overlay.states[stageNode(graph, 'stage4').id], 'pending');
  assert.equal(overlay.current, stageNode(graph, 'review').id);
});

test('graphStates: pure — does not mutate run or graph', () => {
  const graph = defaultGraph();
  const run = fakeRun({ state: 'PREREG_FROZEN', preregHash: 'h' });
  const graphBefore = clone(graph);
  const runBefore = clone(run);
  statesOf(run, graph);
  assert.deepEqual(graph, graphBefore);
  assert.deepEqual(run, runBefore);
});
