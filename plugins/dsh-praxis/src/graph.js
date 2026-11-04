/** Playbook graph model: build, validate, topo-sort, and overlay run state. Pure, no IO. */

export const NODE_TYPES = ['start', 'stage', 'gate', 'actor', 'end'];
export const PORTS = ['contract', 'artifact', 'evidence', 'veto'];

export const STAGE_ORDER = [
  'INTAKE', 'QUESTION', 'PREREG_FROZEN', 'DISCUSSION', 'SYNTHESIS', 'EXEC_READY',
  'EXECUTING', 'REVIEW', 'STAGE4', 'EVAL', 'MEMORY', 'DECISION', 'CLOSED',
];

export const STAGE_STATE = {
  intake: 'INTAKE',
  question: 'QUESTION',
  prereg: 'PREREG_FROZEN',
  discussion: 'DISCUSSION',
  synthesis: 'SYNTHESIS',
  'exec-ready': 'EXEC_READY',
  experiment: 'EXECUTING',
  review: 'REVIEW',
  stage4: 'STAGE4',
  eval: 'EVAL',
  memory: 'MEMORY',
  decision: 'DECISION',
};

const STAGE_ACTIONS = {
  intake: null,
  question: null,
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

function node(id, type, label, extra = {}) {
  return {
    id,
    type,
    label,
    position: extra.position ?? { x: 0, y: 0 },
    config: extra.config ?? {},
    ...(extra.stage ? { stage: extra.stage } : {}),
    ...(extra.role ? { role: extra.role } : {}),
  };
}

/** Build the canonical graph for a playbook. Layout is left-to-right, one gate before each guarded stage. */
export function buildDefaultGraph(playbook) {
  if (!playbook || !Array.isArray(playbook.stages)) throw new Error('playbook.stages is required');
  const stages = playbook.stages;
  const columns = [];
  const nodes = [];
  const edges = [];
  let column = 0;
  const y = 220;
  const stepX = 210;

  nodes.push(node('start', 'start', 'Start', { position: { x: 40, y } }));

  const pushStage = (stage) => {
    const id = `n_${stage}`;
    nodes.push(node(id, 'stage', stageLabel(stage), {
      stage,
      position: { x: 40 + (++column) * stepX, y },
      config: { action: STAGE_ACTIONS[stage] ?? null, requiredArtifacts: artifactsFor(stage) },
    }));
    columns.push(id);
  };

  const pushGate = (gate, guardedStage, label) => {
    const id = `g_${gate}`;
    nodes.push(node(id, 'gate', label, {
      position: { x: 40 + (++column) * stepX, y },
      config: { gate, action: GATE_ACTIONS[gate] ?? null, guards: guardedStage },
    }));
    columns.push(id);
  };

  const order = stages.slice();
  for (const stage of order) {
    if (stage === 'prereg') pushGate('prereg', 'prereg', 'Prereg Gate');
    if (stage === 'experiment') pushGate('experiment', 'experiment', 'Execution Gate');
    if (stage === 'eval') pushGate('eval', 'eval', 'Evaluation Gate');
    if (stage === 'decision') {
      // decision is terminal; keep the stage itself
    }
    pushStage(stage);
  }

  nodes.push(node('end', 'end', 'End', { position: { x: 40 + (column + 1) * stepX, y } }));

  const sequence = ['start', ...columns, 'end'];
  for (let i = 0; i < sequence.length - 1; i += 1) {
    const from = sequence[i];
    const to = sequence[i + 1];
    const fromNode = nodes.find((item) => item.id === from);
    const toNode = nodes.find((item) => item.id === to);
    const port = fromNode.type === 'gate' ? 'contract' : toNode.type === 'gate' ? 'evidence' : 'artifact';
    edges.push({ id: `e_${i + 1}`, from, to, port });
  }

  return {
    id: `${playbook.id}:v1`,
    playbookId: playbook.id,
    version: 1,
    name: playbook.title ?? playbook.id,
    nodes,
    edges,
    updatedAt: new Date(0).toISOString(),
    contentHash: '',
  };
}

function stageLabel(stage) {
  const labels = {
    intake: 'Intake', question: 'Question', prereg: 'Preregistration', discussion: 'Discussion',
    synthesis: 'Synthesis', experiment: 'Experiment', review: 'Review', stage4: 'Stage 4',
    eval: 'Evaluation', memory: 'Memory', decision: 'Decision',
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

/** Validate a graph against contract codes V1..V9. Returns {ok, errors[]}. */
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
    if (edge.port === 'artifact') {
      const from = byId.get(edge.from);
      const to = byId.get(edge.to);
      if (from && !['stage', 'actor', 'start'].includes(from.type)) {
        errors.push({ code: 'V9', message: `artifact edge from ${from.type}`, edgeId: edge.id });
      }
      if (to && !['stage', 'gate', 'end'].includes(to.type)) {
        errors.push({ code: 'V9', message: `artifact edge to ${to.type}`, edgeId: edge.id });
      }
    }
  }

  if (!hasCycle(graph)) {
    // ok
  } else {
    errors.push({ code: 'V3', message: 'graph contains a cycle' });
  }

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
      const guarded = gate.config?.guards ?? gate.stage;
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
  const white = new Set(nodes.map((item) => item.id));
  const gray = new Set();
  const black = new Set();
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
  for (const id of white) {
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
    for (const next of adj.get(id)) {
      indegree.set(next, indegree.get(next) - 1);
      if (indegree.get(next) === 0) queue.push(next);
    }
  }
  return order;
}

function stageIndexForState(state) {
  const map = {
    INTAKE: 0, QUESTION: 1, PREREG_DRAFT: 2, PREREG_FROZEN: 2, DISCUSSION: 3, SYNTHESIS: 4,
    EXEC_READY: 5, EXECUTING: 6, REVIEW: 7, STAGE4: 8, EVAL: 9, MEMORY: 10, DECISION: 11, CLOSED: 12,
  };
  return map[state] ?? 0;
}

const CURSOR_STATE = {
  INTAKE: 'INTAKE', QUESTION: 'QUESTION', PREREG_DRAFT: 'PREREG_FROZEN', PREREG_FROZEN: 'DISCUSSION',
  DISCUSSION: 'DISCUSSION', SYNTHESIS: 'SYNTHESIS', EXEC_READY: 'EXECUTING', EXECUTING: 'EXECUTING',
  REVIEW: 'REVIEW', STAGE4: 'STAGE4', EVAL: 'EVAL', MEMORY: 'MEMORY', DECISION: 'DECISION', CLOSED: 'CLOSED',
};

/** Overlay a run on a graph: node states + current node. Pure. */
export function graphStates(run, graph) {
  const nodes = graph.nodes ?? [];
  const edges = graph.edges ?? [];
  const order = topoOrder(graph);
  const cursorState = CURSOR_STATE[run.state] ?? 'INTAKE';
  const cursorIndex = Math.max(0, STAGE_ORDER.indexOf(cursorState));
  const drift = run.state === 'DRIFT_DETECTED';
  const states = {};

  for (const item of nodes) {
    if (item.type === 'start') { states[item.id] = 'done'; continue; }
    if (item.type === 'end') { states[item.id] = run.state === 'CLOSED' ? 'done' : 'pending'; continue; }
    if (item.type === 'gate') {
      const gate = item.config?.gate ?? item.config?.guards;
      if (gate === 'prereg') {
        if (drift) states[item.id] = 'failed';
        else if (run.preregHash) states[item.id] = 'done';
        else states[item.id] = 'active';
      } else if (gate === 'experiment') {
        if (drift) states[item.id] = 'failed';
        else if (!run.preregHash) states[item.id] = 'blocked';
        else if (cursorIndex >= STAGE_ORDER.indexOf('EXECUTING')) states[item.id] = 'done';
        else states[item.id] = 'active';
      } else if (gate === 'eval') {
        if (run.eval?.readAt) states[item.id] = 'done';
        else if (run.eval?.reportHash) states[item.id] = 'active';
        else states[item.id] = 'pending';
      } else {
        states[item.id] = 'pending';
      }
      continue;
    }
    if (item.type === 'stage') {
      const mapped = STAGE_STATE[item.stage] ?? String(item.stage).toUpperCase();
      const nodeIndex = STAGE_ORDER.indexOf(mapped);
      if (drift) { states[item.id] = nodeIndex <= cursorIndex ? 'failed' : 'pending'; continue; }
      if (nodeIndex < 0) { states[item.id] = 'pending'; continue; }
      if (nodeIndex < cursorIndex) states[item.id] = 'done';
      else if (nodeIndex === cursorIndex) states[item.id] = 'active';
      else states[item.id] = 'pending';
      continue;
    }
    if (item.type === 'actor') { states[item.id] = 'pending'; continue; }
    states[item.id] = 'pending';
  }

  let current = order.find((id) => states[id] === 'active') ?? null;
  if (!current) current = order.find((id) => states[id] === 'blocked') ?? null;
  if (drift) current = order.find((id) => states[id] === 'failed') ?? current;
  return { states, current, edges, version: run.version };
}

export function cloneGraph(graph) {
  return JSON.parse(JSON.stringify(graph));
}
