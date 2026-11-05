import { createEngine, DEFAULT_KNOBS, PLAYBOOKS } from './engine.js';
import { createTeamProjector, emptyTeam } from './team.js';

const ACTIONS = [
  'start', 'question', 'prereg_freeze', 'discussion', 'pin_persona', 'experiment', 'review',
  'stage4', 'eval_report', 'eval_read', 'memory_propose', 'memory_commit',
  'map_claim', 'map_edge', 'decision', 'promote', 'set_knobs', 'gate', 'map', 'snapshot', 'activate',
  'graph', 'graph_save', 'layout_save',
  'branch_propose', 'branch_assign', 'branch_activate', 'branch_evidence',
  'branch_verdict', 'branch_merge', 'branch_drop',
];

const READ_ONLY = new Set(['gate', 'map', 'snapshot']);

export function createHost(options = {}) {
  const engine = options.engine ?? createEngine({ knobs: options.knobs });
  const store = options.store ?? null;
  const team = options.team ?? (options.ctx ? createTeamProjector(options.ctx) : null);
  const current = { runId: null };
  let pending = Promise.resolve();

  function actorFor(source) {
    if (source === 'user' || source === 'command' || source === 'ui') return { kind: 'user', id: 'owner' };
    return { kind: 'root', id: 'agent' };
  }

  /**
   * Explicit delegation from the UI: the owner asks Praxis to record an action under a
   * different role (evaluator / agent). Only two mappings exist, and every use is audited.
   */
  function delegatedActor(input) {
    const flag = input?.payload?.delegatedActor;
    if (flag === 'evaluator') return { kind: 'evaluator', id: 'delegated:owner', delegatedBy: 'owner' };
    if (flag === 'root') return { kind: 'root', id: 'delegated:owner', delegatedBy: 'owner' };
    return null;
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
    if (action === 'graph') {
      const runId = input.runId ?? current.runId;
      try {
        return { status: 'committed', graph: engine.graphView(runId, input.payload?.playbookId), retry: 'none' };
      } catch (error) {
        return { status: 'rejected', reasonCode: 'UNKNOWN_PLAYBOOK', retry: 'none' };
      }
    }
    if (action === 'graph_save' || action === 'layout_save') {
      const actor = input.actor ?? actorFor(source);
      const payload = input.payload ?? {};
      if (action === 'graph_save' && payload.expectedRevision != null) {
        const currentGraph = safeRawGraph(payload.playbookId);
        const live = currentGraph?.revision ?? 0;
        if (live !== payload.expectedRevision) {
          return {
            status: 'rejected', reasonCode: 'CONFLICT', retry: 'manual',
            graph: graphProjection(payload.playbookId), expectedRevision: payload.expectedRevision, liveRevision: live,
          };
        }
      }
      const result = action === 'graph_save'
        ? engine.saveGraph(payload.playbookId, payload.graph, actor.kind)
        : engine.saveLayout(payload.playbookId, payload.positions, actor.kind);
      if (result.status === 'committed') void persist();
      return result;
    }
    if (action === 'map') {
      const runId = input.runId ?? current.runId;
      if (!runId) return { status: 'rejected', reasonCode: 'NO_RUN', retry: 'none' };
      return { status: 'committed', map: engine.map(runId) };
    }
    const command = {
      commandId: input.commandId ?? `${action}-${Date.now()}`,
      actor: input.actor ?? delegatedActor(input) ?? actorFor(source),
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

  function safeRawGraph(playbookId) {
    try {
      return engine.getGraph(playbookId) ?? null;
    } catch {
      return null;
    }
  }

  function graphProjection(runId, playbookId) {
    let viewValue = null;
    try {
      viewValue = engine.graphView(runId, playbookId);
    } catch {
      try {
        viewValue = engine.graphView(undefined, playbookId ?? snapshotPlaybookId());
      } catch {
        viewValue = null;
      }
    }
    const graph = viewValue?.graph ?? viewValue ?? null;
    if (!graph) return null;
    return {
      id: graph.id,
      playbookId: graph.playbookId,
      revision: viewValue?.revision ?? graph.revision ?? 0,
      layoutVersion: graph.layoutVersion ?? 1,
      name: graph.name ?? '',
      nodes: graph.nodes ?? [],
      edges: graph.edges ?? [],
      states: viewValue?.states ?? {},
      current: viewValue?.current ?? null,
      progress: viewValue?.progress ?? { done: 0, total: (graph.nodes ?? []).length, index: 0 },
      audit: viewValue?.audit ?? { ok: true, violations: [] },
    };
  }

  function snapshotPlaybookId() {
    const playbooks = engine.snapshot().playbooks ?? [];
    return playbooks[0]?.id;
  }

  function mapView(runId) {
    try {
      return engine.map(runId);
    } catch {
      return { runId, nodes: [], edges: [], frontier: [], blindSpots: [], contradictions: [] };
    }
  }


/** Gate rail: the governance skeleton, derived from the run state only. */
const GATE_DEFS = [
  { id: 'question', label: '研究问题', after: 0, role: '主代理' },
  { id: 'prereg', label: '预注册冻结', after: 1, role: '主代理' },
  { id: 'discussion', label: '讨论完成', after: 3, role: '团队' },
  { id: 'experiment', label: '实验执行', after: 4, role: '执行代理' },
  { id: 'review', label: '复核完成', after: 5, role: '复核代理' },
  { id: 'stage4', label: '阶段四', after: 6, role: '主代理' },
  { id: 'eval', label: '独立评估', after: 7, role: '评估代理' },
  { id: 'eval_read', label: '评估已读', after: 8, role: '主代理' },
  { id: 'memory', label: '记忆落库', after: 9, role: '主代理' },
  { id: 'decision', label: '决策记录', after: 10, role: '主代理' },
];

function buildGates(run) {
  if (!run) {
    return GATE_DEFS.map((gate) => ({ id: gate.id, label: gate.label, role: gate.role, status: 'future', missing: [], index: gate.after }));
  }
  const states = buildCatalog().states ?? [];
  const index = Math.max(0, states.findIndex((item) => item.id === run.state));
  const blockers = run.blockers ?? [];
  const nextIndex = index;
  return GATE_DEFS.map((gate) => {
    const passed = index > gate.after;
    const isNext = !passed && gate.after >= nextIndex && gate.after - nextIndex <= 1;
    const status = passed ? 'passed' : (isNext ? 'blocked' : 'future');
    return {
      id: gate.id,
      label: gate.label,
      role: gate.role,
      status,
      missing: status === 'blocked' ? blockers.slice(0, 3) : [],
      index: gate.after,
    };
  });
}

/** Evidence band rows: one per claim, with support/contradiction counts. */
function buildEvidenceRows(run) {
  const claims = run.claims ?? [];
  const contradictions = run.contradictions ?? [];
  return claims.map((claim) => {
    const refs = claim.evidenceRefs ?? [];
    const against = contradictions.filter((item) => item.right === claim.claim || item.left === claim.id).length;
    return {
      claimId: claim.id,
      claim: claim.claim ?? claim.label ?? '',
      status: claim.status ?? 'unverified',
      supports: refs.length,
      contradicts: against,
      latestSource: refs.at(-1) ?? null,
      latestAt: claim.at ?? null,
    };
  });
}

  function catalog() {
    return buildCatalog();
  }

  function evidence(runId) {
    const snapshot = engine.snapshot();
    const runs = (snapshot.runs ?? []).map((run) => ({
      id: run.id,
      title: run.title,
      state: run.state,
      version: run.version,
      parentId: run.parentId ?? null,
      events: (run.events ?? []).slice(-20),
      receipts: typeof engine.receiptsFor === 'function' ? engine.receiptsFor(run.id) : [],
    }));
    const target = runId ?? current.runId ?? runs.at(-1)?.id ?? null;
    const projection = target ? graphProjection(target) : null;
    return {
      runs,
      activeRunId: target,
      graph: projection,
      audit: projection?.audit ?? { ok: true, violations: [] },
    };
  }

  function view() {
    const snapshot = engine.snapshot();
    const activeId = current.runId ?? snapshot.runs.at(-1)?.id ?? null;
    const active = activeId ? runView(activeId) : null;
    const branches = active?.branches ?? [];
    return {
      product: 'Praxis',
      wireVersion: 3,
      design: 'Cockpit',
      branches,
      team: team ? team.project(branches) : emptyTeam('no-ctx'),
      gates: buildGates(active),
      evidenceRows: active ? buildEvidenceRows(active) : [],
      serverTime: new Date().toISOString(),
      revision: active?.version ?? 0,
      activeRunId: activeId,
      active,
      runs: snapshot.runs,
      playbooks: snapshot.playbooks,
      knobs: active?.knobs ?? engine.knobs ?? snapshot.knobs,
      defaults: snapshot.defaults ?? DEFAULT_KNOBS,
      knobFields: snapshot.knobFields ?? knobFields(),
      catalog: catalog(),
      map: activeId ? mapView(activeId) : null,
      graph: graphProjection(activeId ?? undefined) ?? (snapshot.playbooks?.[0] ? graphProjection(undefined, snapshot.playbooks[0].id) : null),
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

  return { execute, view, engine, store, map: mapView, runView, flush, load, evidence, catalog, graph: graphProjection, buildGates, buildEvidenceRows };
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

/** UI catalog: the single source of human labels. Client must not invent its own map. */
export function buildCatalog() {
  return {
    states: [
      { id: 'INTAKE', label: '立项', index: 0 },
      { id: 'QUESTION', label: '研究问题', index: 1 },
      { id: 'PREREG_FROZEN', label: '预注册已冻结', index: 2 },
      { id: 'DISCUSSION', label: '讨论', index: 3 },
      { id: 'EXECUTING', label: '执行实验', index: 4 },
      { id: 'REVIEW', label: '复核', index: 5 },
      { id: 'STAGE4', label: '阶段四', index: 6 },
      { id: 'EVAL', label: '独立评估', index: 7 },
      { id: 'MEMORY', label: '记忆', index: 8 },
      { id: 'DECISION', label: '决策', index: 9 },
    ],
    terminalStates: [
      { id: 'CLOSED', label: '已关闭' },
      { id: 'DRIFT_DETECTED', label: '漂移' },
    ],
    stateActions: {
      INTAKE: 'question',
      QUESTION: 'prereg_freeze',
      PREREG_FROZEN: 'discussion',
      DISCUSSION: 'experiment',
      EXECUTING: 'review',
      REVIEW: 'stage4',
      STAGE4: 'eval_report',
      EVAL: 'eval_read',
      MEMORY: 'memory_propose',
      DECISION: 'decision',
    },
    nodeExecution: [
      { id: 'pending', label: '等待', tone: 'idle' },
      { id: 'active', label: '进行中', tone: 'active' },
      { id: 'done', label: '已完成', tone: 'ok' },
      { id: 'blocked', label: '被阻断', tone: 'warn' },
      { id: 'failed', label: '需核对', tone: 'bad' },
    ],
    nodeLabels: {
      start: '开始', end: '结束',
      n_intake: '立项', n_question: '研究问题', g_prereg: '预注册门禁', n_prereg: '预注册',
      n_discussion: '讨论', g_experiment: '执行门禁', n_experiment: '实验', n_review: '复核',
      n_stage4: '阶段四', g_eval: '评估门禁', n_eval: '独立评估', n_memory: '记忆', n_decision: '决策',
    },
    nodeCondition: [
      { id: 'missing', label: '缺失', tone: 'warn' },
      { id: 'satisfied', label: '已满足', tone: 'ok' },
      { id: 'stale', label: '继承待确认', tone: 'bad' },
      { id: 'unknown', label: '未知', tone: 'idle' },
    ],
    actions: [
      { id: 'start', label: '新建研究运行', scope: 'run', primary: true },
      { id: 'activate', label: '切换运行', scope: 'run', primary: false },
      { id: 'question', label: '记录研究问题', scope: 'run', primary: true },
      { id: 'prereg_freeze', label: '冻结预注册', scope: 'run', primary: true },
      { id: 'discussion', label: '提交讨论', scope: 'run', primary: true },
      { id: 'pin_persona', label: '固定人格', scope: 'run', primary: false },
      { id: 'experiment', label: '执行实验', scope: 'run', primary: true },
      { id: 'review', label: '提交复核', scope: 'run', primary: true },
      { id: 'stage4', label: '阶段四', scope: 'run', primary: true, payload: 'none' },
      { id: 'eval_report', label: '提交独立评估', scope: 'run', primary: true },
      { id: 'eval_read', label: '读取独立评估', scope: 'run', primary: true, payload: 'none' },
      { id: 'memory_propose', label: '提议记忆', scope: 'run', primary: true },
      { id: 'memory_commit', label: '提交记忆', scope: 'run', primary: false },
      { id: 'decision', label: '记录决策', scope: 'run', primary: true },
      { id: 'map_claim', label: '登记主张', scope: 'graph', primary: false },
      { id: 'map_edge', label: '连接主张', scope: 'graph', primary: false },
      { id: 'promote', label: '晋升候选', scope: 'any', primary: false },
      { id: 'set_knobs', label: '修改超参数（fork）', scope: 'run', primary: false },
      { id: 'branch_propose', label: '提出分支', scope: 'run', primary: false },
      { id: 'branch_assign', label: '指派负责人', scope: 'run', primary: false },
      { id: 'branch_activate', label: '启用分支', scope: 'run', primary: false },
      { id: 'branch_evidence', label: '记录证据', scope: 'run', primary: false },
      { id: 'branch_verdict', label: '给出结论', scope: 'run', primary: false },
      { id: 'branch_merge', label: '合流分支', scope: 'run', primary: false },
      { id: 'branch_drop', label: '放弃分支', scope: 'run', primary: false },
      { id: 'graph_save', label: '保存蓝图', scope: 'graph', primary: true },
      { id: 'layout_save', label: '保存布局', scope: 'graph', primary: false },
    ],
    blockerLabels: {
      'prereg.frozen': '需要冻结预注册',
      'prereg.contract': '预注册契约不全',
      'question': '需要记录研究问题',
      'discussion': '需要提交讨论',
      'experiment': '需要执行实验',
      'review': '需要提交复核',
      'stage4': '需要完成阶段四',
      'eval.report': '需要提交独立评估',
      'eval.read': '需要读取独立评估',
      'memory': '需要提交记忆',
      'decision': '需要记录决策',
      'audit': '状态一致性检查未通过',
    },
    eventLabels: {
      'run.started': '运行开始',
      'run.forked': '派生新运行',
      'question.recorded': '记录研究问题',
      'prereg.frozen': '冻结预注册',
      'prereg.violation': '冻结后修改契约',
      'discussion.recorded': '记录讨论',
      'persona.pinned': '固定人格',
      'experiment.recorded': '记录实验',
      'review.recorded': '记录复核',
      'eval.reported': '提交独立评估',
      'eval.read': '读取独立评估',
      'memory.proposed': '提议记忆',
      'memory.committed': '提交记忆',
      'decision.recorded': '记录决策',
      'map.claim': '登记主张',
      'map.edge': '连接主张',
      'gap.recorded': '登记缺口',
      'drift.detected': '检测到漂移',
      'unknown.fear': '登记未知恐惧',
      'gate.denied': '门禁拒绝',
      'transition.denied': '状态转移被拒绝',
      'boundary.denied': '边界编辑被拒绝',
      'candidate.promoted': '晋升候选',
      'corruption.detected': '检测到投机信号',
      'migration.reconciled': '数据迁移已对账',
      'stage4.recorded': '记录阶段四',
      'eval.read.skipped': '跳过评估读取',
    },
    reasons: {
      PREREG_INCOMPLETE: '预注册缺少必填项',
      PREREG_REQUIRED: '需要先冻结预注册',
      PREREG_VIOLATION: '冻结后不能修改契约，请新建 Run',
      QUESTION_REQUIRED: '需要先记录研究问题',
      QUESTION_INCOMPLETE: '研究问题与假设都必须填写',
      INVALID_TRANSITION: '当前状态不允许这个动作',
      CONFLICT: '数据已被其他操作更新，请重试',
      FORBIDDEN_ACTOR: '该角色没有执行权限',
      NO_RUN: '没有选中的运行',
      UNKNOWN_PLAYBOOK: '未知剧本',
      UNKNOWN_ACTION: '未知动作',
      PERSONA_DECORATIVE: '人格缺少可证伪的立场绑定',
      DRIFT_DETECTED: '检测到目标漂移',
      EVAL_NOT_READ: '还没有读取独立评估',
      PROTECTED_NODE: '受保护节点不可删除',
      BAD_COMMAND: '命令格式不正确',
      BAD_PACKAGES: '讨论包格式不正确',
      L2_CLOSED: '代码修改层未开启',
      L3_CLOSED: '元层修改未开启',
      FORBIDDEN_BOUNDARY_EDIT: '禁止修改内核边界',
      USER_ONLY: '只有用户可以执行该动作',
      ENGINE_ERROR: '引擎内部错误',
    },
  };
}
