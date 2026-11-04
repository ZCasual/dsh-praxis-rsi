/**
 * Playbook graph model v2 — pure, no IO.
 *
 * Contract: docs/praxis/redesign/10-v2-contract.md §1.2, §1.3, §2.
 *
 * Two axes per node:
 *   execution — what the run has actually walked; driven by the state cursor and
 *               committed receipts only (T2.1), never by artifact presence alone.
 *   condition — whether the artifact a node needs exists (T2.3), independent of
 *               the execution axis.
 *
 * Layout is part of the graph (§2.1): three semantic lanes with frozen geometry
 * and `layoutVersion: 2`. `migrateLayout` recomputes coordinates for v1 graphs.
 *
 * `STATE_ORDER` lives here because both modules need the indices; engine.js
 * re-exports it as the contract's single source of truth.
 */

export const NODE_TYPES = ['start', 'stage', 'gate', 'actor', 'end'];
export const PORTS = ['contract', 'artifact', 'evidence', 'veto'];

/** Contract §1.1 single source of truth for the run state machine. */
export const STATE_ORDER = Object.freeze([
  'INTAKE', 'QUESTION', 'PREREG_FROZEN', 'DISCUSSION', 'EXECUTING',
  'REVIEW', 'STAGE4', 'EVAL', 'MEMORY', 'DECISION',
]);

const STATE_INDEX = new Map(STATE_ORDER.map((state, index) => [state, index]));

export function stateIndex(state) {
  const index = STATE_INDEX.get(state);
  return index === undefined ? -1 : index;
}

/** stage key -> run state reached by passing that stage. `null` = no state of its own. */
export const STAGE_STATE = Object.freeze({
  intake: 'INTAKE',
  question: 'QUESTION',
  prereg: 'PREREG_FROZEN',
  discussion: 'DISCUSSION',
  synthesis: null,
  experiment: 'EXECUTING',
  review: 'REVIEW',
  stage4: 'STAGE4',
  eval: 'EVAL',
  memory: 'MEMORY',
  decision: 'DECISION',
});

const STAGE_ACTIONS = {
  intake: null,
  question: 'question',
  prereg: 'prereg_freeze',
  discussion: 'discussion',
  synthesis: null,
  experiment: 'experiment',
  review: 'review',
  stage4: 'stage4',
  eval: 'eval_report',
  memory: 'memory_propose',
  decision: 'decision',
};

const GATE_ACTIONS = { prereg: 'prereg_freeze', experiment: 'experiment', eval: 'eval_read' };

/** Gates a playbook owns, in canonical order (contract §2.1 lanes). */
export const PLAYBOOK_GATES = Object.freeze(['prereg', 'experiment', 'eval']);

/* -------------------------------------------------------------------------- */
/* layout (§2.1)                                                              */
/* -------------------------------------------------------------------------- */

export const SIZE = Object.freeze({ w: 156, h: 64 });

export const LANE = Object.freeze([
  Object.freeze({ id: 'define', index: 0, label: '定义问题' }),
  Object.freeze({ id: 'explore', index: 1, label: '探索与执行' }),
  Object.freeze({ id: 'converge', index: 2, label: '证据与决策' }),
]);

export const LAYOUT = Object.freeze({
  version: 2,
  laneStartX: 24,
  laneStartY: 40,
  laneGapY: 120,
  gapX: 28,
  nodeWidth: SIZE.w,
  nodeHeight: SIZE.h,
  lanes: LANE,
});

export const LAYOUT_VERSION = LAYOUT.version;
/** Lower-case alias requested by Host/Client wiring. */
export const layoutVersion = LAYOUT_VERSION;

/** Lane of a stage key; unknown stages fall to the exploratory middle lane. */
const STAGE_LANE = Object.freeze({
  intake: 0,
  question: 0,
  prereg: 0,
  discussion: 1,
  synthesis: 1,
  experiment: 1,
  review: 1,
  stage4: 1,
  eval: 2,
  memory: 2,
  decision: 2,
});

export function laneIndexOfNode(item) {
  if (!item) return 1;
  if (item.type === 'start') return 0;
  if (item.type === 'end') return 2;
  if (item.type === 'gate') {
    const gate = item.config?.gate ?? item.config?.guards;
    if (gate === 'prereg') return 0;
    if (gate === 'experiment') return 1;
    if (gate === 'eval') return 2;
    const stageLane = STAGE_LANE[gate];
    return stageLane ?? 1;
  }
  if (item.type === 'stage') return STAGE_LANE[item.stage] ?? 1;
  return 1;
}

/** Contract §2.1 position formula. */
export function lanePosition(laneIndex, column) {
  return {
    x: LAYOUT.laneStartX + column * (LAYOUT.nodeWidth + LAYOUT.gapX),
    y: LAYOUT.laneStartY + laneIndex * LAYOUT.laneGapY,
  };
}

function node(id, type, label, extra = {}) {
  return {
    id,
    type,
    label,
    position: extra.position ?? { x: 0, y: 0 },
    config: extra.config ?? {},
    ...(extra.stage ? { stage: extra.stage } : {}),
    ...(extra.role ? { role: extra.role } : {}),
    ...(extra.protected ? { protected: true } : {}),
  };
}

function assignLayout(nodes) {
  const counters = [0, 0, 0];
  for (const item of nodes) {
    const laneIndex = laneIndexOfNode(item);
    const column = counters[laneIndex];
    counters[laneIndex] += 1;
    item.position = lanePosition(laneIndex, column);
  }
  return nodes;
}

/** Build the canonical graph for a playbook with v2 lane layout. */
export function buildDefaultGraph(playbook) {
  if (!playbook || !Array.isArray(playbook.stages)) throw new Error('playbook.stages is required');
  const stages = playbook.stages;
  const nodes = [];
  const edges = [];
  let sequence = 0;

  nodes.push(node('start', 'start', '开始', { protected: true }));

  const pushStage = (stage) => {
    const id = `n_${stage}`;
    nodes.push(node(id, 'stage', stageLabel(stage), {
      stage,
      protected: true,
      config: { action: STAGE_ACTIONS[stage] ?? null, requiredArtifacts: artifactsFor(stage) },
    }));
  };

  const pushGate = (gate, label) => {
    const id = `g_${gate}`;
    nodes.push(node(id, 'gate', label, {
      protected: true,
      config: { gate, action: GATE_ACTIONS[gate] ?? null, guards: gate },
    }));
  };

  for (const stage of stages) {
    if (stage === 'prereg') pushGate('prereg', '预注册门禁');
    if (stage === 'experiment') pushGate('experiment', '执行门禁');
    if (stage === 'eval') pushGate('eval', '评估门禁');
    pushStage(stage);
  }

  nodes.push(node('end', 'end', '结束', { protected: true }));
  assignLayout(nodes);

  const order = nodes.map((item) => item.id);
  for (let i = 0; i < order.length - 1; i += 1) {
    sequence += 1;
    edges.push({
      id: `e_${sequence}`,
      from: order[i],
      to: order[i + 1],
      port: derivePort(nodes[i], nodes[i + 1]),
    });
  }

  return {
    id: `${playbook.id}:v1`,
    playbookId: playbook.id,
    version: 1,
    revision: 1,
    layoutVersion: LAYOUT_VERSION,
    name: playbook.title ?? playbook.id,
    nodes,
    edges,
    updatedAt: new Date(0).toISOString(),
    contentHash: '',
  };
}

/** T5.0: node labels are human-readable Chinese; stage/gate ids stay English. */
function stageLabel(stage) {
  const labels = {
    intake: '立项', question: '研究问题', prereg: '预注册', discussion: '讨论',
    synthesis: '综合', experiment: '实验', review: '复核', stage4: '阶段四',
    eval: '独立评估', memory: '记忆', decision: '决策',
  };
  return labels[stage] ?? stage;
}

function artifactsFor(stage) {
  const map = {
    prereg: ['preregHash'],
    experiment: ['artifactHash'],
    review: ['reviewReport'],
    eval: ['evalReportHash'],
    memory: ['memoryCommit'],
    decision: ['decisionRecord'],
  };
  return map[stage] ?? [];
}

/* -------------------------------------------------------------------------- */
/* ports (§2.2)                                                               */
/* -------------------------------------------------------------------------- */

/**
 * T6.2. Gate output is a contract, a gate input is evidence, everything else is
 * an artifact. Client wiring must call this instead of hard-coding `artifact`.
 */
export function derivePort(fromNode, toNode) {
  if (!fromNode || !toNode) return 'artifact';
  if (fromNode.type === 'gate') return 'contract';
  if (toNode.type === 'gate') return 'evidence';
  return 'artifact';
}

/* -------------------------------------------------------------------------- */
/* protection (§2.2 T6.1)                                                     */
/* -------------------------------------------------------------------------- */

/** Node ids the playbook graph must always keep. */
export function protectedNodeIds(playbook) {
  const ids = ['start', 'end'];
  if (!playbook || !Array.isArray(playbook.stages)) return ids;
  for (const stage of playbook.stages) ids.push(`n_${stage}`);
  for (const gate of PLAYBOOK_GATES) {
    if (playbook.stages.includes(gate)) ids.push(`g_${gate}`);
  }
  return ids;
}

export function isProtectedNode(item, playbook) {
  if (!item) return false;
  if (item.protected === true) return true;
  if (!playbook) return item.type === 'start' || item.type === 'end';
  return protectedNodeIds(playbook).includes(item.id);
}

/* -------------------------------------------------------------------------- */
/* validation (V1..V11)                                                       */
/* -------------------------------------------------------------------------- */

/** Validate a graph against contract codes V1..V11. Returns {ok, errors[]}. Never mutates. */
export function validateGraph(graph, playbook = null) {
  const errors = [];
  if (!graph || typeof graph !== 'object') return { ok: false, errors: [{ code: 'V0', message: 'graph is required' }] };
  const nodes = Array.isArray(graph.nodes) ? graph.nodes : [];
  const edges = Array.isArray(graph.edges) ? graph.edges : [];

  const ids = new Set();
  for (const item of nodes) {
    if (!item || typeof item.id !== 'string' || !item.id) {
      errors.push({ code: 'V1', message: 'node id is required' });
      continue;
    }
    if (ids.has(item.id)) errors.push({ code: 'V1', message: `duplicate node id ${item.id}`, nodeId: item.id });
    ids.add(item.id);
    if (!NODE_TYPES.includes(item.type)) errors.push({ code: 'V5', message: `bad node type ${item.type}`, nodeId: item.id });
    if (item.type === 'stage' && !item.stage) {
      errors.push({ code: 'V5', message: `stage node ${item.id} has no stage key`, nodeId: item.id });
    }
    if (!item.position || !Number.isFinite(item.position.x) || !Number.isFinite(item.position.y)) {
      errors.push({ code: 'V7', message: `bad position on ${item.id}`, nodeId: item.id });
    }
  }

  const byId = new Map(nodes.map((item) => [item.id, item]));
  for (const edge of edges) {
    if (!edge || typeof edge.from !== 'string' || typeof edge.to !== 'string') {
      errors.push({ code: 'V2', message: 'edge endpoints are required' });
      continue;
    }
    if (!byId.has(edge.from)) errors.push({ code: 'V2', message: `unknown edge.from ${edge.from}`, edgeId: edge.id });
    if (!byId.has(edge.to)) errors.push({ code: 'V2', message: `unknown edge.to ${edge.to}`, edgeId: edge.id });
    if (edge.from === edge.to) errors.push({ code: 'V3', message: `self loop ${edge.from}`, edgeId: edge.id });
    if (!PORTS.includes(edge.port)) errors.push({ code: 'V8', message: `bad port ${edge.port}`, edgeId: edge.id });
    const from = byId.get(edge.from);
    const to = byId.get(edge.to);
    if (edge.port === 'artifact') {
      if (from && !['stage', 'actor', 'start'].includes(from.type)) {
        errors.push({ code: 'V9', message: `artifact edge from ${from.type}`, edgeId: edge.id });
      }
      if (to && !['stage', 'gate', 'end'].includes(to.type)) {
        errors.push({ code: 'V9', message: `artifact edge to ${to.type}`, edgeId: edge.id });
      }
    }
    if (from && to) {
      const expected = derivePort(from, to);
      if (edge.port !== expected) {
        errors.push({
          code: 'V11',
          message: `port ${String(edge.port)} on ${edge.from}→${edge.to} must be ${expected}`,
          edgeId: edge.id,
        });
      }
    }
  }

  if (hasCycle(graph)) errors.push({ code: 'V3', message: 'graph contains a cycle' });

  const starts = nodes.filter((item) => item.type === 'start');
  const ends = nodes.filter((item) => item.type === 'end');
  if (starts.length !== 1) errors.push({ code: 'V4', message: `exactly one start required, got ${starts.length}` });
  if (ends.length < 1) errors.push({ code: 'V4', message: 'at least one end required' });
  for (const start of starts) {
    if (edges.some((edge) => edge.to === start.id)) errors.push({ code: 'V4', message: 'start must have no incoming edge', nodeId: start.id });
  }
  for (const end of ends) {
    if (edges.some((edge) => edge.from === end.id)) errors.push({ code: 'V4', message: 'end must have no outgoing edge', nodeId: end.id });
  }

  if (playbook && Array.isArray(playbook.stages)) {
    for (const stage of playbook.stages) {
      if (!nodes.some((item) => item.type === 'stage' && item.stage === stage)) {
        errors.push({ code: 'V5', message: `missing stage node ${stage}` });
      }
    }
    const order = topoOrder(graph);
    for (const gate of nodes.filter((item) => item.type === 'gate')) {
      const guarded = gate.config?.guards ?? gate.config?.gate;
      if (!guarded) errors.push({ code: 'V6', message: `gate ${gate.id} has no guards`, nodeId: gate.id });
      else {
        const guardedNode = nodes.find((item) => item.type === 'stage' && item.stage === guarded);
        if (!guardedNode) errors.push({ code: 'V6', message: `gate ${gate.id} guards unknown stage ${guarded}`, nodeId: gate.id });
        else {
          const gateIndex = order.indexOf(gate.id);
          const stageIndex = order.indexOf(guardedNode.id);
          if (gateIndex < 0 || stageIndex < 0 || gateIndex > stageIndex) {
            errors.push({ code: 'V6', message: `gate ${gate.id} must precede ${guarded}`, nodeId: gate.id });
          }
        }
      }
    }
    // T6.1: protected nodes may never disappear from the playbook graph.
    for (const id of protectedNodeIds(playbook)) {
      if (!ids.has(id)) errors.push({ code: 'V10', message: `protected node ${id} is missing`, nodeId: id });
    }
  }

  return { ok: errors.length === 0, errors };
}

export function hasCycle(graph) {
  const nodes = graph.nodes ?? [];
  const edges = graph.edges ?? [];
  const adj = new Map(nodes.map((item) => [item.id, []]));
  for (const edge of edges) {
    if (adj.has(edge.from)) adj.get(edge.from).push(edge.to);
  }
  const black = new Set();
  const gray = new Set();
  const visit = (id) => {
    if (black.has(id)) return false;
    if (gray.has(id)) return true;
    gray.add(id);
    for (const next of adj.get(id) ?? []) {
      if (visit(next)) return true;
    }
    gray.delete(id);
    black.add(id);
    return false;
  };
  for (const id of adj.keys()) {
    if (visit(id)) return true;
  }
  return false;
}

export function topoOrder(graph) {
  const nodes = graph.nodes ?? [];
  const edges = graph.edges ?? [];
  const indegree = new Map(nodes.map((item) => [item.id, 0]));
  const adj = new Map(nodes.map((item) => [item.id, []]));
  for (const edge of edges) {
    if (!indegree.has(edge.to) || !adj.has(edge.from)) continue;
    indegree.set(edge.to, indegree.get(edge.to) + 1);
    adj.get(edge.from).push(edge.to);
  }
  const queue = nodes.filter((item) => indegree.get(item.id) === 0).map((item) => item.id);
  const order = [];
  while (queue.length) {
    const id = queue.shift();
    order.push(id);
    for (const next of adj.get(id) ?? []) {
      indegree.set(next, indegree.get(next) - 1);
      if (indegree.get(next) === 0) queue.push(next);
    }
  }
  return order;
}

/* -------------------------------------------------------------------------- */
/* layout migration (T5.2)                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Recompute lane coordinates for a graph authored before layoutVersion 2.
 * Nodes and edges are preserved verbatim; hand-added nodes are appended to
 * their lane in topological order. Returns a clone.
 */
export function migrateLayout(graph, playbook = null) {
  if (!graph || typeof graph !== 'object') return graph;
  const next = cloneGraph(graph);
  if (next.layoutVersion === LAYOUT_VERSION) return next;
  const nodes = Array.isArray(next.nodes) ? next.nodes : [];
  const order = topoOrder(next);
  const position = new Map(order.map((id, index) => [id, index]));
  const sorted = nodes.slice().sort((a, b) => {
    const pa = position.get(a.id);
    const pb = position.get(b.id);
    if (pa === undefined && pb === undefined) return 0;
    if (pa === undefined) return 1;
    if (pb === undefined) return -1;
    return pa - pb;
  });
  assignLayout(sorted);
  next.nodes = sorted;
  next.layoutVersion = LAYOUT_VERSION;
  if (playbook) next.playbookId = playbook.id ?? next.playbookId;
  return next;
}

/* -------------------------------------------------------------------------- */
/* run overlay (T2.1–T2.4)                                                    */
/* -------------------------------------------------------------------------- */

function isDrift(run) {
  return run?.state === 'DRIFT_DETECTED';
}

function cursorIndexOf(run) {
  if (!run) return 0;
  if (isDrift(run)) return Array.isArray(run.decisions) && run.decisions.length > 0 ? stateIndex('DECISION') : 0;
  const index = stateIndex(run.state);
  return index < 0 ? 0 : index;
}

function gateKeyOf(item) {
  if (item?.type !== 'gate') return null;
  return item.config?.gate ?? item.config?.guards ?? null;
}

function preregCondition(run) {
  const prereg = run?.prereg ?? null;
  if (run?.preregHash && prereg?.frozen !== false) return 'satisfied';
  if (prereg?.inheritedFrom) return 'stale';
  return 'missing';
}

function gateCondition(gate, run) {
  if (gate === 'prereg') return preregCondition(run);
  if (gate === 'experiment') return (run?.experiments ?? []).length > 0 ? 'satisfied' : 'missing';
  if (gate === 'eval') return run?.eval?.reportHash || run?.eval?.readAt ? 'satisfied' : 'missing';
  return 'unknown';
}

function stageCondition(stage, run) {
  if (!stage) return 'unknown';
  if (stage === 'prereg') return preregCondition(run);
  const checks = {
    question: () => Boolean(run?.question),
    discussion: () => (run?.discussion?.rounds ?? 0) > 0,
    experiment: () => (run?.experiments ?? []).length > 0,
    review: () => (run?.reviews ?? []).length > 0,
    stage4: () => run?.stage4 != null,
    eval: () => Boolean(run?.eval?.reportHash),
    memory: () => ((run?.memory?.commits ?? []).length > 0 || (run?.memory?.proposals ?? []).length > 0),
    decision: () => run?.decision != null,
  };
  const check = checks[stage];
  if (!check) return 'unknown';
  return check() ? 'satisfied' : 'missing';
}

/**
 * T2.1: a gate is passed only when its advancing action was committed in THIS
 * run. Receipt evidence is the sole authority — without a ledger (old dump,
 * bare run object) the safe answer is "not done", never an artifact-derived
 * promotion.
 */
function gatePassed(gate, evidence) {
  if (!evidence) return false;
  const action = GATE_ACTIONS[gate];
  return action ? evidence.has(action) : false;
}

/** Committed/replayed actions of the run, derived from its receipt ledger. */
function evidenceFrom(context) {
  if (!context || !Array.isArray(context.receipts)) return null;
  const actions = new Set();
  for (const entry of context.receipts) {
    if (entry && (entry.status === 'committed' || entry.status === 'replayed') && typeof entry.action === 'string') {
      actions.add(entry.action);
    }
  }
  return actions;
}

const CONDITION_REASONS = {
  prereg: { satisfied: '契约已冻结', stale: '继承自父 Run，待重新冻结', missing: '契约缺失', unknown: null },
  experiment: { satisfied: '冻结契约已执行', stale: '继承的契约待确认', missing: '契约缺失', unknown: null },
  eval: { satisfied: '评估已独立读取', stale: '继承的评估待确认', missing: '评估报告缺失', unknown: null },
};

function gateReason(gate, execution, condition, nodeId) {
  const table = CONDITION_REASONS[gate];
  if (execution === 'done') return table?.satisfied ?? '已完成';
  if (execution === 'failed') return '状态不一致，需核对';
  if (execution === 'blocked') return table?.missing ?? '前置未完成';
  return table?.[condition] ?? null;
}

function stateForNode(item, run, cursor, drift, evidence) {
  const condition = item.type === 'gate' ? gateCondition(gateKeyOf(item), run) : stageCondition(item.stage, run);

  if (item.type === 'start') {
    return { execution: drift ? 'failed' : 'done', condition, reason: drift ? '状态漂移，需核对' : null };
  }
  if (item.type === 'actor') {
    return { execution: 'pending', condition, reason: null };
  }
  if (item.type === 'gate') {
    const gate = gateKeyOf(item);
    const guardedStage = item.config?.guards ?? item.config?.gate ?? null;
    const guardedIndex = guardedStage ? stateIndex(STAGE_STATE[guardedStage]) : -1;
    const passed = gatePassed(gate, evidence);
    let execution;
    if (drift) execution = guardedIndex >= 0 && guardedIndex < cursor ? 'failed' : 'pending';
    else if (passed && guardedIndex >= 0 && cursor >= guardedIndex) execution = 'done';
    else if (guardedIndex >= 0 && cursor >= guardedIndex) execution = 'blocked';
    else execution = 'pending';
    if (drift && execution === 'failed') return { execution, condition, reason: '状态漂移，需核对' };
    return { execution, condition, reason: gateReason(gate, execution, condition, item.id) };
  }
  if (item.type === 'end') {
    return { execution: 'pending', condition: 'unknown', reason: null };
  }
  // stage (and any custom type falls here as a stage-like node)
  const mapped = STAGE_STATE[item.stage];
  const nodeIndex = mapped ? stateIndex(mapped) : -1;
  if (drift) {
    const execution = nodeIndex >= 0 && nodeIndex <= cursor ? 'failed' : 'pending';
    return { execution, condition, reason: execution === 'failed' ? '状态漂移，需核对' : null };
  }
  if (nodeIndex < 0) return { execution: 'pending', condition, reason: null };
  if (nodeIndex < cursor) return { execution: 'done', condition, reason: null };
  if (nodeIndex === cursor) return { execution: 'active', condition, reason: '当前阶段' };
  return { execution: 'pending', condition, reason: null };
}

function predecessorsOf(graph) {
  const map = new Map((graph.nodes ?? []).map((item) => [item.id, []]));
  for (const edge of graph.edges ?? []) {
    if (map.has(edge.to) && map.has(edge.from)) map.get(edge.to).push(edge.from);
  }
  return map;
}

/** T2.2: a node cannot be done/active while any predecessor is not done. */
function clampToTopology(states, graph) {
  const predecessors = predecessorsOf(graph);
  const nodes = graph.nodes ?? [];
  let changed = true;
  let guard = 0;
  while (changed && guard <= nodes.length + 1) {
    changed = false;
    guard += 1;
    for (const item of nodes) {
      if (item.type === 'start') continue;
      const current = states[item.id];
      if (!current || (current.execution !== 'done' && current.execution !== 'active')) continue;
      const blocked = (predecessors.get(item.id) ?? []).some((id) => states[id]?.execution !== 'done');
      if (!blocked) continue;
      states[item.id] = {
        ...current,
        execution: current.execution === 'active' ? 'blocked' : 'pending',
        reason: current.execution === 'active' ? '前置节点尚未完成' : current.reason,
      };
      changed = true;
    }
  }
  // A terminal node is done only when its whole incoming frontier is done.
  for (const item of nodes) {
    if (item.type !== 'end') continue;
    const preds = predecessors.get(item.id) ?? [];
    const complete = preds.length > 0 && preds.every((id) => states[id]?.execution === 'done');
    states[item.id] = { execution: complete ? 'done' : 'pending', condition: 'unknown', reason: null };
  }
}

/**
 * Overlay a run on a graph. Pure.
 * @returns {{states: Record<string, {execution:string, condition:string, reason:string|null}>,
 *   current: string|null, edges: object[], version: number,
 *   progress: {done:number,total:number,index:number},
 *   audit: {ok:boolean,violations:{code:string,nodeId?:string,message:string}[]}}}
 */
export function graphStates(run, graph = {}, context = {}) {
  const nodes = graph.nodes ?? [];
  const edges = graph.edges ?? [];
  const cursor = cursorIndexOf(run);
  const drift = isDrift(run);
  const evidence = evidenceFrom(context);
  const states = {};

  for (const item of nodes) states[item.id] = stateForNode(item, run, cursor, drift, evidence);
  clampToTopology(states, graph);

  const order = topoOrder(graph);
  const predecessors = predecessorsOf(graph);
  let current = order.find((id) => states[id]?.execution === 'active') ?? null;
  if (!current) {
    current = order.find((id) => {
      const state = states[id];
      if (!state || state.execution !== 'pending') return false;
      const preds = predecessors.get(id) ?? [];
      return preds.every((pred) => states[pred]?.execution === 'done');
    }) ?? null;
  }
  if (!current) current = order.find((id) => states[id]?.execution === 'blocked') ?? null;
  if (!current && drift) current = order.find((id) => states[id]?.execution === 'failed') ?? null;

  const done = Object.values(states).filter((state) => state.execution === 'done').length;
  const progress = { done, total: nodes.length, index: cursor };
  const audit = auditGraphState(run, graph, { states, progress, current, cursor });

  return { states, current, edges, version: run?.version ?? 0, progress, audit };
}

/* -------------------------------------------------------------------------- */
/* invariant audit (§1.3)                                                     */
/* -------------------------------------------------------------------------- */

function weaklyConnectedComponents(graph) {
  const nodes = graph.nodes ?? [];
  const parent = new Map(nodes.map((item) => [item.id, item.id]));
  const find = (id) => {
    let cursor = id;
    while (parent.get(cursor) !== cursor) cursor = parent.get(cursor);
    return cursor;
  };
  const union = (a, b) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };
  for (const edge of graph.edges ?? []) {
    if (parent.has(edge.from) && parent.has(edge.to)) union(edge.from, edge.to);
  }
  const groups = new Map();
  for (const item of nodes) {
    const root = find(item.id);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(item.id);
  }
  return [...groups.values()];
}

/**
 * Audit I1–I6. Never throws; violations are returned for the UI banner.
 * @param {object} run
 * @param {object} graph
 * @param {object} [overlayOrStates] - Either a `states` map or a graphStates() payload.
 * @returns {{ok: boolean, violations: {code: string, nodeId?: string, message: string}[]}}
 */
export function auditGraphState(run, graph, overlayOrStates = null) {
  const violations = [];
  const nodes = graph?.nodes ?? [];
  const overlay = overlayOrStates && overlayOrStates.states ? overlayOrStates : null;
  const states = overlay ? overlay.states : (overlayOrStates ?? graphStates(run, graph).states);
  const progress = overlay?.progress ?? null;
  const predecessors = predecessorsOf(graph ?? {});
  const cursor = cursorIndexOf(run);

  const push = (code, nodeId, message) => {
    const violation = { code, message };
    if (nodeId) violation.nodeId = nodeId;
    violations.push(violation);
  };

  // I1 — every done node has all predecessors done.
  for (const item of nodes) {
    if (states[item.id]?.execution !== 'done') continue;
    const blockedBy = (predecessors.get(item.id) ?? []).filter((id) => states[id]?.execution !== 'done');
    if (blockedBy.length) {
      push('I1', item.id, `节点已完成但前驱未完成：${blockedBy.join('、')}`);
    }
  }

  // I2 — at most one active node per weakly connected component.
  for (const component of weaklyConnectedComponents(graph ?? {})) {
    const active = component.filter((id) => states[id]?.execution === 'active');
    if (active.length > 1) {
      push('I2', active[0], `同一连通分量存在 ${active.length} 个活动节点：${active.join('、')}`);
    }
  }

  // I3 / I4 — a done gate needs its artifact and its guarded stage.
  for (const item of nodes) {
    if (item.type !== 'gate') continue;
    if (states[item.id]?.execution !== 'done') continue;
    if (states[item.id]?.condition === 'missing') {
      push('I3', item.id, '门禁已完成但所需产物缺失');
    }
    const guarded = item.config?.guards ?? item.config?.gate;
    const guardedNode = guarded
      ? nodes.find((candidate) => candidate.type === 'stage' && candidate.stage === guarded)
      : null;
    const guardedExecution = guardedNode ? states[guardedNode.id]?.execution : 'missing';
    if (guardedExecution !== 'active' && guardedExecution !== 'done') {
      push('I4', item.id, `门禁已完成但守护阶段状态为 ${String(guardedExecution)}`);
    }
  }

  // I5 — progress must match the derived states.
  if (progress) {
    const doneCount = Object.values(states).filter((state) => state.execution === 'done').length;
    if (progress.done !== doneCount || progress.total !== nodes.length) {
      push('I5', undefined, `进度统计不一致：done=${progress.done}/${doneCount}, total=${progress.total}/${nodes.length}`);
    }
  }

  // I6 — a done node must not sit ahead of the state cursor.
  for (const item of nodes) {
    if (states[item.id]?.execution !== 'done') continue;
    const mapped = item.type === 'gate'
      ? STAGE_STATE[item.config?.guards ?? item.config?.gate]
      : (item.type === 'stage' ? STAGE_STATE[item.stage] : null);
    if (!mapped) continue;
    const nodeIndex = stateIndex(mapped);
    if (nodeIndex < 0) continue;
    if (nodeIndex > cursor) {
      push('I6', item.id, `节点已完成但状态游标停在 ${String(run?.state)}`);
    }
  }

  return { ok: violations.length === 0, violations };
}

export function cloneGraph(graph) {
  return JSON.parse(JSON.stringify(graph));
}
