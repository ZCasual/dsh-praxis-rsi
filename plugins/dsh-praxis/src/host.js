import { createEngine, DEFAULT_KNOBS, PLAYBOOKS } from './engine.js';

const ACTIONS = [
  'start', 'prereg_freeze', 'discussion', 'pin_persona', 'experiment', 'review',
  'stage4', 'eval_report', 'eval_read', 'memory_propose', 'memory_commit',
  'map_claim', 'map_edge', 'decision', 'promote', 'set_knobs', 'gate', 'map', 'snapshot', 'activate',
];

const READ_ONLY = new Set(['gate', 'map', 'snapshot']);

export function createHost(options = {}) {
  const engine = options.engine ?? createEngine({ knobs: options.knobs });
  const store = options.store ?? null;
  const current = { runId: null };
  let pending = Promise.resolve();

  function actorFor(source) {
    if (source === 'user' || source === 'command' || source === 'ui') return { kind: 'user', id: 'owner' };
    return { kind: 'root', id: 'agent' };
  }

  function persist() {
    if (!store) return pending;
    pending = pending
      .then(() => store.save(engine.dump()))
      .catch((error) => {
        if (options.log) options.log('praxis persist failed: %s', String(error));
      });
    return pending;
  }

  function execute(input, source = 'agent') {
    const action = input.action;
    if (!ACTIONS.includes(action)) {
      return { status: 'rejected', reasonCode: 'UNKNOWN_ACTION', retry: 'none' };
    }
    if (action === 'snapshot') return { status: 'committed', snapshot: view() };
    if (action === 'activate') {
      const target = input.runId ?? input.payload?.runId;
      const runs = engine.snapshot().runs;
      const found = runs.find((run) => run.id === target);
      if (!found) return { status: 'rejected', reasonCode: 'NO_RUN', retry: 'none' };
      current.runId = found.id;
      return { status: 'committed', runId: found.id, state: found.state, version: found.version, retry: 'none' };
    }
    if (action === 'gate') {
      const runId = input.runId ?? current.runId;
      if (!runId) return { status: 'rejected', reasonCode: 'NO_RUN', retry: 'none' };
      return { status: 'committed', gate: engine.gate(runId, input.payload?.target ?? 'experiment') };
    }
    if (action === 'map') {
      const runId = input.runId ?? current.runId;
      if (!runId) return { status: 'rejected', reasonCode: 'NO_RUN', retry: 'none' };
      return { status: 'committed', map: engine.map(runId) };
    }
    const command = {
      commandId: input.commandId ?? `${action}-${Date.now()}`,
      actor: input.actor ?? actorFor(source),
      action,
      runId: action === 'start' ? input.runId : (input.runId ?? current.runId ?? undefined),
      expectedDomainVersion: input.expectedDomainVersion,
      payload: input.payload ?? {},
    };
    let result;
    try {
      result = engine.execute(command);
    } catch (error) {
      return {
        status: 'rejected',
        reasonCode: error?.code === 'UNKNOWN_RUN' ? 'NO_RUN' : 'ENGINE_ERROR',
        reason: error instanceof Error ? error.message : String(error),
        retry: 'none',
      };
    }
    if (result.runId) current.runId = result.runId;
    if (result.status === 'committed' && !READ_ONLY.has(action)) void persist();
    return result;
  }

  function runView(runId) {
    if (typeof engine.runView === 'function') return engine.runView(runId);
    return null;
  }

  function mapView(runId) {
    try {
      return engine.map(runId);
    } catch {
      return { runId, nodes: [], edges: [], frontier: [], blindSpots: [], contradictions: [] };
    }
  }

  function view() {
    const snapshot = engine.snapshot();
    const activeId = current.runId ?? snapshot.runs.at(-1)?.id ?? null;
    const active = activeId ? runView(activeId) : null;
    return {
      product: 'Praxis',
      wireVersion: 1,
      design: 'Observatory',
      activeRunId: activeId,
      active,
      runs: snapshot.runs,
      playbooks: snapshot.playbooks,
      knobs: active?.knobs ?? engine.knobs ?? snapshot.knobs,
      defaults: snapshot.defaults ?? DEFAULT_KNOBS,
      knobFields: snapshot.knobFields ?? knobFields(),
      map: activeId ? mapView(activeId) : null,
      durability: !store || store.durability === 'memory' ? 'memory' : 'durable',
    };
  }

  function flush() {
    return pending;
  }

  function load(dump) {
    if (!dump) return false;
    try {
      engine.load(dump);
      const snapshot = engine.snapshot();
      current.runId = snapshot.runs.at(-1)?.id ?? null;
      return true;
    } catch (error) {
      if (options.log) options.log('praxis restore failed: %s', String(error));
      return false;
    }
  }

  return { execute, view, engine, store, map: mapView, runView, flush, load };
}

export function knobFields() {
  return [
    { key: 'heterogeneityFloor', label: '异质度地板', unit: '0–1', min: 0.2, max: 0.8, step: 0.05, scope: 'discussion', hint: '低于此值判讨论空转' },
    { key: 'ambitionFloor', label: '野心地板', unit: '0–1', min: 0.2, max: 0.8, step: 0.05, scope: 'judgment', hint: '低于此值判投机风险' },
    { key: 'inflationGap', label: '自报通胀差', unit: '0–1', min: 0.1, max: 0.5, step: 0.05, scope: 'judgment', hint: '自评与独立评分差超过即标通胀' },
    { key: 'sameConclusionLimit', label: '同结论上限', unit: '次', min: 2, max: 4, step: 1, scope: 'judgment', hint: '达到即强制转向' },
    { key: 'maxPersonas', label: '人格上限', unit: '个', min: 3, max: 7, step: 1, scope: 'discussion', hint: '单轮讨论主体数量' },
    { key: 'probeBudget', label: '探测预算', unit: '次', min: 2, max: 20, step: 1, scope: 'experiment', hint: '实验前允许的探测数' },
    { key: 'evalSeeds', label: '评估种子', unit: '个', min: 1, max: 8, step: 1, scope: 'evaluation', hint: '独立评估重复次数' },
    { key: 'wallMin', label: '时限', unit: '分钟', min: 10, max: 180, step: 5, scope: 'budget', hint: '单轮墙钟预算' },
    { key: 'agentDepth', label: '代理深度', unit: '层', min: 1, max: 5, step: 1, scope: 'budget', hint: '子代理递归深度上限' },
    { key: 'explorationQuota', label: '探索配额', unit: '0–1', min: 0, max: 0.5, step: 0.05, scope: 'discussion', hint: '强制用于未知/前沿的比例' },
  ];
}

export function toolResult(result) {
  return {
    status: result.status,
    reasonCode: result.reasonCode ?? '',
    runId: result.runId ?? '',
    nextAction: result.nextAction ?? '',
    blockers: result.blockers ?? [],
    forked: result.forked ?? false,
    state: result.state ?? '',
    version: result.version ?? 0,
    reason: result.reason ?? '',
  };
}

export function commandText(result) {
  if (result.status === 'committed' || result.status === 'replayed') {
    return `Praxis ${result.status} ${result.runId ?? ''}`.trim();
  }
  return `Praxis ${result.reasonCode ?? result.status}${result.nextAction ? ` → ${result.nextAction}` : ''}`;
}

export function playbookIds() {
  return Object.keys(PLAYBOOKS);
}
