import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as Engine from '../../plugins/dsh-praxis/src/engine.js';
import * as Graph from '../../plugins/dsh-praxis/src/graph.js';

/**
 * Praxis v2 契约红测：图真值模型（docs/praxis/redesign/10-v2-contract.md §1.2–§2）
 *
 * 断言只来自契约条文：
 *   双轴 NodeState（§1.2）、T2.1 receipt 驱动、T2.2 拓扑钳制、I1–I6 审计（§1.3）
 *   T4.1/T4.2 fork 图投影（§1.4）、T5.1 布局、T5.2 迁移（§2.1）
 *   T6.1 保护节点 V10、T6.2 端口推导、T6.3 V11（§2.2）、T7.1 graphView（§2.3）
 *
 * 生命周期一律用真实引擎跑 start→question→prereg_freeze→set_knobs fork，
 * 禁止手写 fakeRun 对象。实现未就绪时本文件必须红。
 */

const PLAYBOOK_ID = 'scientific-loop';
const PLAYBOOK = Engine.PLAYBOOKS?.[PLAYBOOK_ID];
const NODE_STATES = ['pending', 'active', 'done', 'blocked', 'failed'];
const CONDITION_STATES = ['missing', 'satisfied', 'stale', 'unknown'];
const EXPECTED_STATE_ORDER = [
  'INTAKE', 'QUESTION', 'PREREG_FROZEN', 'DISCUSSION', 'EXECUTING',
  'REVIEW', 'STAGE4', 'EVAL', 'MEMORY', 'DECISION',
];

const LANES = [
  // 契约 §2.1（2026-11-05 修订）：15 节点、泳道 5/5/5，每泳道宽 892。
  { id: 'define', index: 0, members: ['start', 'n_intake', 'n_question', 'g_prereg', 'n_prereg'] },
  { id: 'explore', index: 1, members: ['n_discussion', 'g_experiment', 'n_experiment', 'n_review', 'n_stage4'] },
  { id: 'converge', index: 2, members: ['g_eval', 'n_eval', 'n_memory', 'n_decision', 'end'] },
];
const GEOMETRY = { w: 156, h: 64, gapX: 28, laneStartX: 24, laneStartY: 40, laneGapY: 120 };

const QUESTION = {
  question: {
    text: '未知结构能否从声明语料中被主动提取？',
    hypothesis: '冻结基线上存在可分离的新结构',
    unknowns: ['噪声上限'],
  },
};
const PREREG = {
  question: '未知结构能否从声明语料中被主动提取？',
  prediction: 'held-out 分离度高于基线 0.08',
  acceptance: '主指标超过基线且对照被破坏',
  acceptableFailure: '若对照未被破坏，接受该表示无效',
  controls: ['shuffle'],
  metrics: { primary: 'separation', threshold: 0.08, seeds: 3 },
  input: { source: 'declared-corpus' },
  budget: { wallMin: 30 },
  stop: { sameConclusion: 2 },
};
const PACKAGES = [
  { persona: 'theorist', claim: '结构可提取', assumptions: ['信号存在'], evidence: ['d:1'], style: 'theoretical', minority: true, retained: true },
  { persona: 'empiricist', claim: '只有均值回归', assumptions: ['噪声解释'], evidence: ['d:2'], style: 'empirical', minority: false, retained: true },
];

function assertExports() {
  assert.ok(Array.isArray(Engine.STATE_ORDER), 'engine.js exports STATE_ORDER');
  assert.deepEqual([...Engine.STATE_ORDER], EXPECTED_STATE_ORDER);
  assert.ok(PLAYBOOK, 'PLAYBOOKS.scientific-loop');
  for (const name of ['buildDefaultGraph', 'validateGraph', 'graphStates', 'derivePort']) {
    assert.equal(typeof Graph[name], 'function', `graph.js exports ${name}`);
  }
  assert.equal(typeof Engine.createEngine, 'function');
}

function stateOrder() {
  assert.ok(Array.isArray(Engine.STATE_ORDER), 'engine.js must export STATE_ORDER');
  return Engine.STATE_ORDER;
}

let seq = 0;
function send(engine, action, { runId, payload = {}, actorKind = 'root' } = {}) {
  seq += 1;
  return engine.execute({
    commandId: `gv2-${action}-${seq}`,
    actor: { kind: actorKind, id: `${actorKind}-1` },
    action,
    runId,
    payload,
  });
}

function actorCmd(engine, action, opts = {}) {
  return send(engine, action, opts);
}

function startRun(engine, title = 'graph v2') {
  const receipt = send(engine, 'start', { payload: { playbookId: PLAYBOOK_ID, title } });
  assert.equal(receipt.status, 'committed');
  return receipt.runId;
}

function questionRun(engine, title = 'graph v2 q') {
  const runId = startRun(engine, title);
  assert.equal(send(engine, 'question', { runId, payload: QUESTION }).status, 'committed');
  return runId;
}

function frozenRun(engine, title = 'graph v2 frozen') {
  const runId = questionRun(engine, title);
  const receipt = send(engine, 'prereg_freeze', { runId, payload: { prereg: PREREG } });
  assert.equal(receipt.status, 'committed');
  return runId;
}

function runTo(engine, target, title = `graph v2 ${target}`) {
  const runId = frozenRun(engine, title);
  const advance = {
    DISCUSSION: () => send(engine, 'discussion', { runId, payload: { round: 1, packages: PACKAGES } }),
    EXECUTING: () => send(engine, 'experiment', { runId, actorKind: 'coding', payload: { command: 'probe', artifactHash: 'a' } }),
    REVIEW: () => send(engine, 'review', { runId, actorKind: 'reviewer', payload: { verdict: 'pass', items: [] } }),
    STAGE4: () => send(engine, 'stage4', { runId, payload: {} }),
    EVAL: () => send(engine, 'eval_report', { runId, actorKind: 'evaluator', payload: { reportHash: 'r', verdict: 'pass', seeds: 3 } }),
    MEMORY: () => send(engine, 'eval_read', { runId, payload: { reportHash: 'r' } }),
  };
  for (const state of ['DISCUSSION', 'EXECUTING', 'REVIEW', 'STAGE4', 'EVAL', 'MEMORY']) {
    if (stateOrder().indexOf(state) > stateOrder().indexOf(target)) break;
    const receipt = advance[state]();
    assert.equal(receipt.status, 'committed', `advance to ${state}`);
    if (state === target) return runId;
  }
  return runId;
}

function graphView(engine, runId) {
  assert.equal(typeof engine.graphView, 'function', 'engine.graphView(runId) (T7.1)');
  return engine.graphView(runId);
}

function findDumpRun(dump, runId) {
  const runs = Array.isArray(dump?.runs) ? dump.runs : Object.values(dump?.runs ?? {});
  const found = runs.find((item) => item?.id === runId);
  assert.ok(found, `dump must contain run ${runId}`);
  return found;
}

function findDumpGraph(dump, playbookId) {
  const graphs = dump?.graphs;
  if (Array.isArray(graphs)) {
    const entry = graphs.find((item) => item.playbookId === playbookId);
    return entry?.graph ?? null;
  }
  return graphs?.[playbookId] ?? null;
}

function injectDumpGraph(dump, playbookId, graph) {
  if (Array.isArray(dump.graphs)) {
    const entry = dump.graphs.find((item) => item.playbookId === playbookId);
    if (entry) entry.graph = graph;
    else dump.graphs.push({ playbookId, graph });
  } else {
    dump.graphs = { ...(dump.graphs ?? {}), [playbookId]: graph };
  }
  return dump;
}

function nodeById(view, id) {
  const node = view.graph.nodes.find((item) => item.id === id);
  assert.ok(node, `node ${id}`);
  return node;
}

function gateNode(view, gate) {
  const node = view.graph.nodes.find((item) => item.type === 'gate' && item.config?.gate === gate);
  assert.ok(node, `gate ${gate}`);
  return node;
}

/** 被守护 stage：优先 config.guards 指定的 stage，否则取拓扑序中 gate 之后第一个 stage。 */
function guardedStage(view, gateId) {
  const nodes = view.graph.nodes;
  const edges = view.graph.edges;
  const gate = nodes.find((item) => item.id === gateId);
  const declared = gate?.config?.guards;
  if (declared) {
    const direct = nodes.find((item) => item.type === 'stage' && item.stage === declared);
    if (direct) return direct;
  }
  const seen = new Set();
  const queue = edges.filter((edge) => edge.from === gateId).map((edge) => edge.to);
  while (queue.length > 0) {
    const id = queue.shift();
    if (seen.has(id)) continue;
    seen.add(id);
    const node = nodes.find((item) => item.id === id);
    if (node?.type === 'stage') return node;
    for (const edge of edges.filter((item) => item.from === id)) queue.push(edge.to);
  }
  return null;
}

function predecessors(view, nodeId) {
  return view.graph.edges.filter((edge) => edge.to === nodeId).map((edge) => edge.from);
}

// ---------------------------------------------------------------------------
// §2.1 T5.1 布局
// ---------------------------------------------------------------------------

test('v2 graph T5.1: default graph layoutVersion=2 and frozen lane coordinates', () => {
  assertExports();
  const graph = Graph.buildDefaultGraph(PLAYBOOK);
  assert.equal(graph.layoutVersion, 2, 'T5.1 layoutVersion=2');
  assert.equal(graph.nodes.length, 15, '默认图 15 节点（5/5/5）');
  const laneWidth = 5 * GEOMETRY.w + 4 * GEOMETRY.gapX;
  assert.equal(laneWidth, 892, '每泳道宽 892px');
  const byId = new Map(graph.nodes.map((node) => [node.id, node]));
  for (const lane of LANES) {
    const present = lane.members.filter((id) => byId.has(id));
    assert.equal(present.length, 5, `泳道 ${lane.id} 必须有 5 个节点`);
    present.forEach((id, i) => {
      const node = byId.get(id);
      assert.equal(
        node.position.x,
        GEOMETRY.laneStartX + i * (GEOMETRY.w + GEOMETRY.gapX),
        `${id} x = laneStartX + i*(w+gapX)`,
      );
      assert.equal(
        node.position.y,
        GEOMETRY.laneStartY + lane.index * GEOMETRY.laneGapY,
        `${id} y = laneStartY + laneIndex*laneGapY`,
      );
    });
  }
});

// ---------------------------------------------------------------------------
// §1.2 双轴状态 / T2.1 / T2.2
// ---------------------------------------------------------------------------

test('v2 graph §1.2: graphView exposes dual-axis node states with human-readable reasons', () => {
  assertExports();
  const engine = Engine.createEngine();
  const runId = runTo(engine, 'EVAL');
  const view = graphView(engine, runId);
  for (const key of ['graph', 'states', 'current', 'progress', 'audit', 'revision']) {
    assert.ok(key in view, `T2.4/T7.1 graphView.${key} missing`);
  }
  assert.ok(Number.isFinite(view.revision), 'T7.1 revision');
  assert.ok(view.graph && Array.isArray(view.graph.nodes) && Array.isArray(view.graph.edges));
  assert.equal(view.graph.layoutVersion, 2, 'T5.1');
  assert.equal(Object.keys(view.states).length, view.graph.nodes.length, '每个节点一个状态');
  for (const node of view.graph.nodes) {
    const state = view.states[node.id];
    assert.ok(state, `state for ${node.id}`);
    assert.ok(NODE_STATES.includes(state.execution), `${node.id}.execution=${state.execution}`);
    assert.ok(CONDITION_STATES.includes(state.condition), `${node.id}.condition=${state.condition}`);
    assert.ok(state.reason === null || typeof state.reason === 'string');
    if (typeof state.reason === 'string') {
      assert.equal(
        /(prereg_freeze|discussion|experiment|review|stage4|eval_report|eval_read|memory_commit|set_knobs|close-or-new-run|INTAKE|PREREG_FROZEN|QUESTION_REQUIRED|INVALID_TRANSITION|gate:prereg)/.test(state.reason),
        false,
        `§5.2: 节点 reason 禁止内部码（${node.id}: ${state.reason}）`,
      );
    }
  }
  assert.equal(view.progress.total, view.graph.nodes.length, 'I5 total');
  const doneCount = Object.values(view.states).filter((state) => state.execution === 'done').length;
  assert.equal(view.progress.done, doneCount, 'I5 done');
  assert.equal(view.progress.index, stateOrder().indexOf(engine.runView(runId).state), 'progress.index = 状态索引');
  assert.equal(typeof view.audit.ok, 'boolean');
  assert.ok(Array.isArray(view.audit.violations));
});

test('v2 graph T2.1: gate done is receipt+cursor driven, never derived from artifact hash', () => {
  assertExports();
  const engine = Engine.createEngine();
  const parentId = frozenRun(engine, 'T2.1 父 Run');
  const forked = send(engine, 'set_knobs', {
    runId: parentId,
    actorKind: 'user',
    payload: { knobs: { ...Engine.DEFAULT_KNOBS, heterogeneityFloor: 0.5 } },
  });
  assert.equal(forked.status, 'committed');
  const child = graphView(engine, forked.runId);
  const preregGate = gateNode(child, 'prereg');
  // 子 Run 继承了父契约草稿（condition=stale），但没有本 Run 的 prereg_freeze receipt
  assert.notEqual(child.states[preregGate.id].execution, 'done', 'T2.1: fork 子 Run gate 不得 done');
  assert.equal(child.states[preregGate.id].condition, 'stale', 'fork 继承的 prereg 条件轴为 stale');
  assert.ok(
    ['pending', 'blocked'].includes(child.states[preregGate.id].execution),
    `T2.2: INTAKE 下 prereg gate 不得 done/active（实际 ${child.states[preregGate.id].execution}）`,
  );
  // 父 Run 仍然 done
  const parent = graphView(engine, parentId);
  assert.equal(parent.states[gateNode(parent, 'prereg').id].execution, 'done');
});

test('v2 graph T2.2/I1: no done/active node before its predecessors are done (real lifecycle)', () => {
  assertExports();
  const engine = Engine.createEngine();
  const checkpoints = [];
  const intake = questionRun(engine, 'clamp-intake');
  checkpoints.push(intake);
  checkpoints.push(frozenRun(engine, 'clamp-frozen'));
  checkpoints.push(runTo(engine, 'REVIEW', 'clamp-review'));
  for (const runId of checkpoints) {
    const view = graphView(engine, runId);
    for (const node of view.graph.nodes) {
      if (node.type === 'start') continue;
      const execution = view.states[node.id].execution;
      if (execution === 'done' || execution === 'active') {
        for (const predId of predecessors(view, node.id)) {
          assert.equal(
            view.states[predId].execution,
            'done',
            `T2.2/I1: ${node.id}(${execution}) 的前驱 ${predId} 必须 done`,
          );
        }
      }
    }
    const active = Object.values(view.states).filter((state) => state.execution === 'active');
    assert.ok(active.length <= 1, 'I2: 同一图 active 节点 ≤ 1');
    if (active.length === 1) {
      assert.equal(view.states[view.current].execution, 'active', 'current 是 active 节点');
    }
  }
});

// ---------------------------------------------------------------------------
// §1.3 I 系列审计
// ---------------------------------------------------------------------------

test('v2 graph §1.3: healthy graph audit.ok=true and no violations across lifecycle', () => {
  assertExports();
  const engine = Engine.createEngine();
  const runs = [questionRun(engine, 'audit-q'), frozenRun(engine, 'audit-frozen'), runTo(engine, 'EVAL', 'audit-eval')];
  for (const runId of runs) {
    const view = graphView(engine, runId);
    assert.equal(view.audit.ok, true, `healthy run ${engine.runView(runId).state} audit.ok`);
    assert.deepEqual(view.audit.violations, []);
    const codeOk = view.audit.violations.every((violation) => /^I[1-6]$/.test(violation.code));
    assert.ok(codeOk, 'violation code ∈ I1..I6');
  }
});

test('v2 graph I3: a gate marked done with a missing artifact is reported by audit', () => {
  assertExports();
  const engine = Engine.createEngine();
  const runId = runTo(engine, 'EVAL', 'audit-i3');
  const dump = JSON.parse(JSON.stringify(engine.dump()));
  const run = findDumpRun(dump, runId);
  // 注入损坏：receipt/游标保留 gate done，但产物（prereg）被删掉 → condition=missing
  run.preregHash = null;
  run.prereg = null;
  const broken = Engine.createEngine();
  broken.load(dump);
  const view = graphView(broken, runId);
  assert.equal(view.audit.ok, false, 'I3: 损坏 dump 必须 audit.ok=false');
  assert.ok(view.audit.violations.length > 0);
  const codes = view.audit.violations.map((violation) => violation.code);
  assert.ok(codes.every((code) => /^I[1-6]$/.test(code)), `violation codes ${codes}`);
  assert.ok(codes.includes('I3'), `I3 必须被报告（实际 ${codes}）`);
  for (const violation of view.audit.violations) {
    assert.equal(typeof violation.message, 'string');
    assert.ok(violation.message.length > 0);
  }
});

test('v2 graph I2: two active nodes in one component are reported by audit', () => {
  assertExports();
  const engine = Engine.createEngine();
  const baseRun = questionRun(engine, 'audit-i2'); // QUESTION 索引 1：两个 question 节点可同为 active
  const dump = JSON.parse(JSON.stringify(engine.dump()));
  const graph = JSON.parse(JSON.stringify(Graph.buildDefaultGraph(PLAYBOOK)));
  // 注入第二个 question stage 节点，使其与主链同源并共用 QUESTION 阶段 → 两个 active
  const question = graph.nodes.find((node) => node.stage === 'question');
  graph.nodes.push({
    ...JSON.parse(JSON.stringify(question)),
    id: 'n_question_dup',
    label: '重复问题节点',
  });
  const start = graph.nodes.find((node) => node.type === 'start');
  graph.edges.push({ id: 'e_dup_start', from: start.id, to: 'n_question_dup', port: 'artifact' });
  // 不放 dup→n_question：否则 T2.2 会把 n_question 降级，同分量只剩 1 个 active。
  injectDumpGraph(dump, PLAYBOOK_ID, graph);

  const broken = Engine.createEngine();
  broken.load(dump);
  const view = graphView(broken, baseRun);
  const activeIds = Object.entries(view.states)
    .filter(([, state]) => state.execution === 'active')
    .map(([id]) => id);
  // 该注入在状态 QUESTION 时产生两个 active 节点
  assert.equal(activeIds.length >= 2, true, `I2 场景需要 ≥2 active（实际 ${activeIds}）`);
  assert.equal(view.audit.ok, false, 'I2: 必须 audit.ok=false');
  const codes = view.audit.violations.map((violation) => violation.code);
  assert.ok(codes.includes('I2'), `I2 必须被报告（实际 ${codes}）`);
});

test('v2 graph §1.3: violations are always I1..I6 with messages; ok equals emptiness', () => {
  assertExports();
  const engine = Engine.createEngine();
  const runId = runTo(engine, 'MEMORY', 'audit-generic');
  const dump = JSON.parse(JSON.stringify(engine.dump()));
  const run = findDumpRun(dump, runId);
  // 注入损坏：游标在 MEMORY，但所有 receipt/事件被清空
  run.receipts = [];
  run.events = run.events.filter((event) => event.type === 'run.started' || event.type === 'question.recorded' || event.type === 'prereg.frozen');
  const broken = Engine.createEngine();
  broken.load(dump);
  const view = graphView(broken, runId);
  assert.equal(view.audit.ok, view.audit.violations.length === 0, 'audit.ok ⇔ 无 violation');
  for (const violation of view.audit.violations) {
    assert.ok(/^I[1-6]$/.test(violation.code), `invalid audit code ${violation.code}`);
    assert.equal(typeof violation.message, 'string');
  }
});

// ---------------------------------------------------------------------------
// §1.4 T4.1 / T4.2 fork 图投影
// ---------------------------------------------------------------------------

test('v2 graph T4.1/I4: forked child never shows gate done before its guarded stage', () => {
  assertExports();
  const engine = Engine.createEngine();
  const parentId = frozenRun(engine, 'T4.1 图父 Run');
  const forked = send(engine, 'set_knobs', {
    runId: parentId,
    actorKind: 'user',
    payload: { knobs: { ...Engine.DEFAULT_KNOBS, ambitionFloor: 0.5 } },
  });
  assert.equal(forked.status, 'committed');
  const child = graphView(engine, forked.runId);
  for (const gate of child.graph.nodes.filter((node) => node.type === 'gate')) {
    if (child.states[gate.id].execution !== 'done') continue;
    const guarded = guardedStage(child, gate.id);
    assert.ok(guarded, `gate ${gate.id} must guard a stage`);
    assert.ok(
      ['active', 'done'].includes(child.states[guarded.id].execution),
      `I4: gate ${gate.id} done ⇒ 被守护 stage ${guarded.id} ∈ {active,done}（实际 ${child.states[guarded.id].execution}）`,
    );
  }
  const experimentGate = gateNode(child, 'experiment');
  assert.ok(
    ['pending', 'blocked'].includes(child.states[experimentGate.id].execution),
    `T4.2 图投影：experiment gate 未到达（实际 ${child.states[experimentGate.id].execution}）`,
  );
  assert.equal(child.states[experimentGate.id].condition, 'missing', 'T4.2 图投影：experiment 条件缺失');
});

test('v2 graph T4.2: gate("experiment") denies forked child until re-freeze (real engine)', () => {
  assertExports();
  const engine = Engine.createEngine();
  const parentId = frozenRun(engine, 'T4.2 图父 Run');
  const forked = send(engine, 'set_knobs', { runId: parentId, actorKind: 'user', payload: { knobs: { ...Engine.DEFAULT_KNOBS } } });
  const childId = forked.runId;
  const gate = engine.gate(childId, 'experiment');
  assert.equal(gate.allow, false);
  assert.ok(gate.missing.includes('prereg.frozen'));
  const view = graphView(engine, childId);
  const experimentGate = gateNode(view, 'experiment');
  assert.notEqual(view.states[experimentGate.id].execution, 'done');
});

// ---------------------------------------------------------------------------
// §2.1 T5.2 迁移
// ---------------------------------------------------------------------------

test('v2 graph T5.2: loading a v1 layout recomputes frozen lane coordinates and preserves topology', () => {
  assertExports();
  const engine = Engine.createEngine();
  const runId = frozenRun(engine, 'T5.2 迁移');
  const dump = JSON.parse(JSON.stringify(engine.dump()));
  const graph = JSON.parse(JSON.stringify(Graph.buildDefaultGraph(PLAYBOOK)));
  graph.layoutVersion = 1;
  for (const node of graph.nodes) node.position = { x: 0, y: 0 };
  const nodeIds = graph.nodes.map((node) => node.id);
  const edgeIds = graph.edges.map((edge) => edge.id);
  injectDumpGraph(dump, PLAYBOOK_ID, graph);

  const migrated = Engine.createEngine();
  migrated.load(dump);
  const view = graphView(migrated, runId);
  assert.equal(view.graph.layoutVersion, 2, 'T5.2: layoutVersion 重算为 2');
  assert.deepEqual(view.graph.nodes.map((node) => node.id), nodeIds, 'T5.2: 节点保留');
  assert.deepEqual(view.graph.edges.map((edge) => edge.id), edgeIds, 'T5.2: 边保留');
  const byId = new Map(view.graph.nodes.map((node) => [node.id, node]));
  for (const lane of LANES) {
    const present = lane.members.filter((id) => byId.has(id));
    assert.equal(present.length, 5, `迁移后泳道 ${lane.id} 仍 5 节点`);
    present.forEach((id, i) => {
      assert.equal(byId.get(id).position.y, GEOMETRY.laneStartY + lane.index * GEOMETRY.laneGapY, `${id} lane y`);
      assert.equal(byId.get(id).position.x, GEOMETRY.laneStartX + i * (GEOMETRY.w + GEOMETRY.gapX), `${id} lane x`);
    });
  }
});

// ---------------------------------------------------------------------------
// §2.2 保护节点 / 端口推导 / V10 / V11
// ---------------------------------------------------------------------------

test('v2 graph T6.1: deleting protected playbook nodes yields V10', () => {
  assertExports();
  const protectedIds = ['start', 'end', 'n_intake', 'g_prereg', 'n_experiment'];
  for (const id of protectedIds) {
    const graph = JSON.parse(JSON.stringify(Graph.buildDefaultGraph(PLAYBOOK)));
    graph.nodes = graph.nodes.filter((node) => node.id !== id);
    graph.edges = graph.edges.filter((edge) => edge.from !== id && edge.to !== id);
    const result = Graph.validateGraph(graph, PLAYBOOK);
    assert.equal(result.ok, false, `删除保护节点 ${id} 必须被拒绝`);
    assert.ok(
      result.errors.some((error) => error.code === 'V10'),
      `V10 PROTECTED_NODE（删除 ${id}，实际 ${result.errors.map((e) => e.code)}）`,
    );
  }
});

test('v2 graph T6.2: derivePort follows gate/type rules', () => {
  assertExports();
  const byId = new Map(Graph.buildDefaultGraph(PLAYBOOK).nodes.map((node) => [node.id, node]));
  const gate = byId.get('g_prereg');
  const stage = byId.get('n_discussion');
  const stage2 = byId.get('n_experiment');
  assert.equal(Graph.derivePort(gate, stage), 'contract', 'gate → * = contract');
  assert.equal(Graph.derivePort(stage, gate), 'evidence', '* → gate = evidence');
  assert.equal(Graph.derivePort(stage, stage2), 'artifact', 'stage → stage = artifact');
});

test('v2 graph T6.3: wrong port for a gate target is V11 (and gate artifact source is V9)', () => {
  assertExports();
  const artifactToGate = JSON.parse(JSON.stringify(Graph.buildDefaultGraph(PLAYBOOK)));
  const edgeToGate = artifactToGate.edges.find((edge) => {
    const to = artifactToGate.nodes.find((node) => node.id === edge.to);
    return to?.type === 'gate';
  });
  assert.ok(edgeToGate, '默认图需存在指向 gate 的边');
  edgeToGate.port = 'artifact';
  const result = Graph.validateGraph(artifactToGate, PLAYBOOK);
  assert.equal(result.ok, false);
  assert.ok(
    result.errors.some((error) => error.code === 'V11'),
    `V11 INVALID_PORT_FOR_TYPE（实际 ${result.errors.map((e) => e.code)}）`,
  );

  const artifactFromGate = JSON.parse(JSON.stringify(Graph.buildDefaultGraph(PLAYBOOK)));
  const edgeFromGate = artifactFromGate.edges.find((edge) => {
    const from = artifactFromGate.nodes.find((node) => node.id === edge.from);
    return from?.type === 'gate';
  });
  assert.ok(edgeFromGate);
  edgeFromGate.port = 'artifact';
  const result2 = Graph.validateGraph(artifactFromGate, PLAYBOOK);
  assert.equal(result2.ok, false);
  assert.ok(
    result2.errors.some((error) => error.code === 'V9' || error.code === 'V11'),
    `gate 源 artifact 必须被拒（实际 ${result2.errors.map((e) => e.code)}）`,
  );
});
