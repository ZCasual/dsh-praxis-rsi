import { createHash } from 'node:crypto';
import {
  STATE_ORDER as GRAPH_STATE_ORDER, buildDefaultGraph, validateGraph, graphStates,
  cloneGraph, migrateLayout, protectedNodeIds, stateIndex, LAYOUT_VERSION,
} from './graph.js';
import {
  BRANCH_STATUS, BRANCH_EVENTS, BRANCH_MAIN_ID, branchView, branchInvariants,
  appendBranch, mainBranchDraft,
} from './branch.js';

export { BRANCH_STATUS, BRANCH_EVENTS, branchView, branchInvariants, appendBranch };

/** Contract §1.1: the run state machine has exactly one definition (graph.js);
 *  engine.js is its public home. */
export const STATE_ORDER = GRAPH_STATE_ORDER;


export const KERNEL_PATHS = [
  'evaluator', 'stop', 'permissions', 'approval', 'data-boundary',
  'hidden-tests', 'audit', 'memory-commit', 'resolver', 'budget', 'kill-switch',
];

export const DEFAULT_KNOBS = Object.freeze({
  heterogeneityFloor: 0.35,
  ambitionFloor: 0.45,
  inflationGap: 0.25,
  sameConclusionLimit: 2,
  maxPersonas: 5,
  minPersonas: 3,
  probeBudget: 8,
  evalSeeds: 3,
  wallMin: 45,
  agentDepth: 3,
  explorationQuota: 0.2,
  l2CodeEdit: false,
  l3MetaEdit: false,
  primaryModel: 'primary',
  secondaryModel: 'secondary',
});

/** @deprecated alias kept for the v1 wire surface; STATE_ORDER is authoritative. */
export const STATE_PIPELINE = STATE_ORDER;

export const PLAYBOOKS = {
  'scientific-loop': {
    id: 'scientific-loop',
    title: '科研闭环',
    domain: 'general-science',
    intent: '维护认知地图，把未知变成可裁决问题，拒绝均值回归。',
    stages: ['intake', 'question', 'prereg', 'discussion', 'experiment', 'review', 'stage4', 'eval', 'memory', 'decision'],
    requiredPrereg: ['question', 'prediction', 'acceptance', 'acceptableFailure', 'controls', 'metrics', 'input', 'budget', 'stop'],
    fearSignals: ['回到已知', '未知太大', '先做熟悉的', '缩到已知基线', '均值回归是唯一', '不可行'],
  },
  'engineering-release': {
    id: 'engineering-release',
    title: '工程验证',
    domain: 'engineering',
    intent: '用冻结契约验证发布，不把诊断当验收。',
    stages: ['intake', 'prereg', 'experiment', 'review', 'eval', 'decision'],
    requiredPrereg: ['question', 'prediction', 'acceptance', 'controls', 'metrics', 'input', 'budget', 'stop'],
    fearSignals: ['先发了再说', '只是测试'],
  },
  'audit-redteam': {
    id: 'audit-redteam',
    title: '审计红队',
    domain: 'audit',
    intent: '寻找会让系统自证成功的路径，并把它写成硬拒绝。',
    stages: ['intake', 'prereg', 'experiment', 'review', 'eval', 'decision'],
    requiredPrereg: ['question', 'prediction', 'acceptance', 'controls', 'metrics', 'input', 'budget', 'stop'],
    fearSignals: ['这只是测试', '没有威胁'],
  },
  'knowledge-production': {
    id: 'knowledge-production',
    title: '知识生产',
    domain: 'knowledge',
    intent: '把主张、反例和矛盾留在地图上，不压成一篇平滑综述。',
    stages: ['intake', 'question', 'discussion', 'review', 'memory', 'decision'],
    requiredPrereg: ['question', 'prediction', 'acceptance', 'controls', 'metrics', 'input', 'budget', 'stop'],
    fearSignals: ['综合意见是', '多数同意'],
  },
};

const BRANCH_ACTIONS = [
  'branch_propose', 'branch_assign', 'branch_activate', 'branch_evidence',
  'branch_verdict', 'branch_merge', 'branch_drop',
];

const ALLOWED = {
  user: ['start', 'question', 'prereg_freeze', 'discussion', 'pin_persona', 'experiment', 'review', 'stage4',
    'eval_read', 'memory_commit', 'map_claim', 'map_edge', 'decision', 'promote', 'set_knobs', ...BRANCH_ACTIONS],
  root: ['start', 'question', 'prereg_freeze', 'discussion', 'pin_persona', 'experiment', 'review', 'stage4',
    'eval_read', 'memory_propose', 'memory_commit', 'map_claim', 'map_edge', 'decision', 'promote', 'set_knobs',
    ...BRANCH_ACTIONS],
  coding: ['experiment'],
  worker: ['experiment'],
  reviewer: ['review'],
  evaluator: ['eval_report', 'branch_evidence'],
};

/**
 * §1.1 legal entry states. An action may only run when the run's state index is
 * at or past its entry state (question/prereg_freeze are exact: their later
 * states are covered by T1.3 and rule 2). Actions absent here (map_claim,
 * map_edge, promote, set_knobs, start) are unrestricted.
 */
const LEGAL_START = Object.freeze({
  question: stateIndex('INTAKE'),
  prereg_freeze: stateIndex('QUESTION'),
  discussion: stateIndex('PREREG_FROZEN'),
  experiment: stateIndex('DISCUSSION'),
  review: stateIndex('EXECUTING'),
  stage4: stateIndex('REVIEW'),
  eval_report: stateIndex('STAGE4'),
  eval_read: stateIndex('EVAL'),
  memory_propose: stateIndex('MEMORY'),
  memory_commit: stateIndex('MEMORY'),
  decision: stateIndex('MEMORY'),
  pin_persona: stateIndex('PREREG_FROZEN'),
  branch_assign: stateIndex('PREREG_FROZEN'),
  branch_activate: stateIndex('PREREG_FROZEN'),
  branch_evidence: stateIndex('PREREG_FROZEN'),
  branch_verdict: stateIndex('PREREG_FROZEN'),
  branch_merge: stateIndex('PREREG_FROZEN'),
  branch_drop: stateIndex('PREREG_FROZEN'),
});

/** Actions that are only legal in exactly one state. */
const EXACT_START = new Set(['question', 'prereg_freeze']);

const KNOB_FIELDS = [
  { key: 'heterogeneityFloor', label: '异质度地板', unit: '0–1', min: 0.2, max: 0.8, step: 0.05, scope: 'discussion' },
  { key: 'ambitionFloor', label: '野心地板', unit: '0–1', min: 0.2, max: 0.8, step: 0.05, scope: 'judgment' },
  { key: 'inflationGap', label: '自报通胀差', unit: '0–1', min: 0.1, max: 0.5, step: 0.05, scope: 'judgment' },
  { key: 'sameConclusionLimit', label: '同结论上限', unit: '次', min: 2, max: 4, step: 1, scope: 'judgment' },
  { key: 'maxPersonas', label: '人格上限', unit: '个', min: 3, max: 7, step: 1, scope: 'discussion' },
  { key: 'probeBudget', label: '探测预算', unit: '次', min: 2, max: 20, step: 1, scope: 'experiment' },
  { key: 'evalSeeds', label: '评估种子', unit: '个', min: 1, max: 8, step: 1, scope: 'evaluation' },
  { key: 'wallMin', label: '时限', unit: '分钟', min: 10, max: 180, step: 5, scope: 'budget' },
  { key: 'agentDepth', label: '代理深度', unit: '层', min: 1, max: 5, step: 1, scope: 'budget' },
  { key: 'explorationQuota', label: '探索配额', unit: '0–1', min: 0, max: 0.5, step: 0.05, scope: 'discussion' },
];

function nowIso() {
  return new Date().toISOString();
}

export function hashJson(value) {
  return createHash('sha256').update(JSON.stringify(sortValue(value))).digest('hex').slice(0, 16);
}

function sortValue(value) {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === 'object') {
    return Object.keys(value).sort().reduce((acc, key) => {
      acc[key] = sortValue(value[key]);
      return acc;
    }, {});
  }
  return value;
}

function entropy(labels) {
  if (!labels.length) return 0;
  const counts = new Map();
  for (const label of labels) counts.set(label, (counts.get(label) ?? 0) + 1);
  const n = labels.length;
  let h = 0;
  for (const count of counts.values()) {
    const p = count / n;
    h -= p * Math.log(p);
  }
  return h / Math.log(Math.max(counts.size, 2));
}

export function scoreHeterogeneity(packages = []) {
  if (!packages.length) {
    return { D: 0, styleOnly: false, gain: 0, stance: 0, evidenceEntropy: 0, contradictionRate: 0, minorityRetention: 1 };
  }
  const claims = packages.map((item) => item.claim);
  const evidence = packages.map((item) => (item.evidence ?? []).slice().sort().join('|') || 'none');
  const styles = packages.map((item) => item.style ?? 'none');
  const stance = entropy(claims);
  const evidenceEntropy = entropy(evidence);
  const pairs = Math.max(packages.length * (packages.length - 1) / 2, 1);
  let contradictions = 0;
  for (let i = 0; i < packages.length; i += 1) {
    for (let j = i + 1; j < packages.length; j += 1) {
      if (packages[i].claim !== packages[j].claim) contradictions += 1;
    }
  }
  const minorities = packages.filter((item) => item.minority);
  const retained = minorities.filter((item) => item.retained).length;
  const minorityRetention = minorities.length ? retained / minorities.length : 1;
  const D = 0.3 * stance + 0.25 * evidenceEntropy + 0.25 * (contradictions / pairs) + 0.2 * minorityRetention;
  const styleOnly = new Set(claims).size === 1
    && new Set(packages.map((item) => JSON.stringify(item.assumptions ?? []))).size === 1
    && new Set(evidence).size === 1
    && new Set(styles).size > 1;
  const rounded = Number(D.toFixed(3));
  return {
    D: rounded,
    styleOnly,
    gain: styleOnly ? 0 : rounded,
    stance,
    evidenceEntropy,
    contradictionRate: contradictions / pairs,
    minorityRetention,
  };
}

export function scoreAmbition(input = {}) {
  const d = input.dimensions ?? { O: 0, R: 0, G: 0, H: 0, P_plan: 0 };
  const A_p = 0.25 * (d.O ?? 0) + 0.2 * (d.R ?? 0) + 0.25 * (d.G ?? 0)
    + 0.2 * (d.H ?? 0) + 0.1 * (d.P_plan ?? 0);
  const E = 0.4 * (input.evidenceClosure ?? 0) + 0.25 * (input.actionCompletion ?? 0)
    + 0.2 * (input.decisionUpdate ?? 0) + 0.15 * (input.auditIntegrity ?? 0);
  const A_d = A_p * (0.5 + 0.5 * E);
  const independent = input.independentScore ?? A_d;
  const A_final = 0.7 * independent + 0.2 * (input.stageScore ?? independent) + 0.1 * (input.selfReport ?? independent);
  const inflationFlag = input.selfReport != null && Math.abs(input.selfReport - independent) > 0.25;
  const corruptionFlags = [];
  if (inflationFlag) corruptionFlags.push('ambition.inflation');
  if (A_p < 0.45 && (input.evidenceClosure ?? 0) < 0.4) corruptionFlags.push('corruption.warning');
  if (A_p >= 0.7 && E < 0.4) corruptionFlags.push('high-narrative-low-delivery');
  return {
    A_p: round3(A_p),
    E: round3(E),
    A_d: round3(A_d),
    A_final: round3(A_final),
    inflationFlag,
    corruptionFlags,
  };
}

function round3(n) {
  return Number(n.toFixed(3));
}

function receipt(partial) {
  return { status: 'rejected', retry: 'none', ...partial };
}

function missingPrereg(playbook, prereg) {
  return playbook.requiredPrereg.filter((key) => {
    const value = prereg?.[key];
    return value == null || value === '' || (typeof value === 'object' && !Array.isArray(value) && !Object.keys(value).length);
  });
}

function indexOfState(state) {
  return STATE_PIPELINE.indexOf(state);
}

function advance(run, target) {
  if (indexOfState(target) > indexOfState(run.state)) run.state = target;
}

const INHERITED_ARTIFACTS = [
  'question', 'claims', 'edges', 'personas', 'discussion', 'experiments',
  'reviews', 'stage4', 'eval', 'memory', 'decision',
];

function hasInheritableArtifact(value) {
  if (value == null) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value !== 'object') return false;
  if (Array.isArray(value.packages)) return value.packages.length > 0 || (value.rounds ?? 0) > 0;
  if ('proposals' in value) return (value.proposals ?? []).length > 0 || (value.commits ?? []).length > 0;
  if ('reportHash' in value) return Boolean(value.reportHash || value.readAt);
  return true;
}

function markInherited(value) {
  if (Array.isArray(value)) return value.map((item) => (item && typeof item === 'object' ? { ...item, inherited: true } : item));
  if (value && typeof value === 'object') return { ...value, inherited: true };
  return value;
}

export function createEngine(options = {}) {
  const knobs = { ...DEFAULT_KNOBS, ...(options.knobs ?? {}) };
  const runs = new Map();
  const receipts = new Map();
  const graphs = new Map();
  const children = new Map();
  let runCounter = 0;
  let seq = 0;

  function getRun(runId) {
    const run = runs.get(runId);
    if (!run) {
      const error = new Error(`unknown run ${runId}`);
      error.code = 'UNKNOWN_RUN';
      throw error;
    }
    return run;
  }

  function append(run, type, data = {}, options = {}) {
    // branch.js appends its own events, so advance past whatever the run already holds.
    seq = Math.max(seq, run.events.at?.(-1)?.seq ?? 0) + 1;
    if (options.bumpVersion !== false) run.version += 1;
    run.updatedAt = nowIso();
    run.events.push({ seq, type, at: run.updatedAt, data, ...(options.extra ?? {}) });
  }

  /** T1.3: a denied transition is recorded but must not move state or version. */
  function denyTransition(run, action, detail = {}) {
    const { nextAction = run.nextAction ?? null, ...data } = detail;
    append(run, 'transition.denied', { action, from: run.state, ...data }, { bumpVersion: false });
    return receipt({
      reasonCode: 'INVALID_TRANSITION', runId: run.id, state: run.state,
      nextAction, retry: 'none',
    });
  }

  /**
   * §1.1 transition guard. Advancing actions may not walk backwards; question
   * must precede prereg_freeze. T1.2/T1.3.
   */
  function checkTransition(run, action) {
    const cursor = stateIndex(run.state);
    // T1.2 keeps its own code for the classic "freeze before question" mistake.
    if (action === 'prereg_freeze' && cursor === stateIndex('INTAKE')) {
      return receipt({
        reasonCode: 'QUESTION_REQUIRED', runId: run.id, state: run.state,
        nextAction: 'question', blockers: ['question'], retry: 'none',
      });
    }
    const start = LEGAL_START[action];
    if (start === undefined) return null;
    if (cursor < 0) return null; // DRIFT_DETECTED: recovery actions stay available
    const wrongState = EXACT_START.has(action) ? cursor !== start : cursor < start;
    if (!wrongState) return null;
    if (action === 'prereg_freeze') {
      // Re-freezing after the door closed is a manual fork request (rule 2 / T1.3).
      return denyTransition(run, action, { nextAction: 'new-run' });
    }
    return denyTransition(run, action, { required: STATE_ORDER[start] });
  }

  function remember(command, result) {
    const key = `${command.runId ?? '*'}:${command.commandId}`;
    receipts.set(key, {
      ...result,
      commandId: command.commandId,
      action: command.action,
      runId: result.runId ?? (command.runId && command.runId !== '*' ? command.runId : null),
      at: nowIso(),
    });
    return result;
  }

  function execute(command) {
    if (!command || typeof command !== 'object' || typeof command.action !== 'string') {
      return receipt({ reasonCode: 'BAD_COMMAND' });
    }
    if (!command.commandId) command.commandId = `${command.action}-${Date.now()}-${seq}`;
    const prior = receipts.get(`${command.runId ?? '*'}:${command.commandId}`);
    if (prior) return { ...prior, status: prior.status === 'committed' ? 'replayed' : prior.status };

    const kind = command.actor?.kind ?? 'root';
    const allowed = ALLOWED[kind] ?? [];
    if (!allowed.includes(command.action)) {
      if (command.runId && runs.has(command.runId)) {
        append(getRun(command.runId), 'gate.denied', { action: command.action, actor: kind, reasonCode: 'FORBIDDEN_ACTOR' });
      }
      return remember(command, receipt({ reasonCode: 'FORBIDDEN_ACTOR', runId: command.runId ?? null }));
    }

    if (command.action === 'start') return remember({ ...command, runId: '*' }, start(command));

    const run = runs.get(command.runId);
    if (!run) return remember(command, receipt({ reasonCode: 'NO_RUN', runId: command.runId ?? null }));
    if (command.expectedDomainVersion != null && command.expectedDomainVersion !== run.version) {
      return remember(command, receipt({ reasonCode: 'CONFLICT', runId: run.id, retry: 'manual' }));
    }
    const denied = checkTransition(run, command.action);
    if (denied) return remember(command, denied);
    if (command.actor?.delegatedBy) {
      append(run, 'actor.delegated', {
        action: command.action,
        kind: command.actor.kind,
        actorId: command.actor.id,
        delegatedBy: command.actor.delegatedBy,
      });
    }
    return remember(command, dispatch(run, command));
  }

  function start(command) {
    const playbook = PLAYBOOKS[command.payload?.playbookId];
    if (!playbook) return receipt({ reasonCode: 'UNKNOWN_PLAYBOOK' });
    runCounter += 1;
    const id = `run_${hashJson({ t: nowIso(), n: runCounter, title: command.payload?.title }).slice(0, 8)}`;
    const run = {
      id,
      title: command.payload?.title ?? playbook.title,
      playbookId: playbook.id,
      state: 'INTAKE',
      version: 0,
      parentId: null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      knobHash: hashJson(knobs),
      knobs: { ...knobs },
      models: { judge: knobs.primaryModel, evaluator: knobs.secondaryModel, reviewer: knobs.secondaryModel },
      prereg: null,
      inheritedArtifacts: [],
      personas: [],
      claims: [],
      edges: [],
      contradictions: [],
      decisions: [],
      discussion: { rounds: 0, packages: [], heterogeneity: null },
      experiments: [],
      reviews: [],
      stage4: null,
      eval: { reportHash: null, verdict: null, readAt: null, readBy: null, seeds: null },
      memory: { proposals: [], commits: [] },
      branches: [],
      decision: null,
      ambition: null,
      nextAction: 'question',
      blockers: ['question'],
      events: [],
    };
    runs.set(id, run);
    append(run, 'run.started', { playbookId: playbook.id, title: run.title, knobHash: run.knobHash });
    // v4: every run opens with the main proposition as a branch (§2.1).
    appendBranch(run, {
      type: 'branch.proposed',
      actor: command.actor ?? null,
      data: { id: BRANCH_MAIN_ID, title: '主命题', hypothesis: '待补', falsifiable: '待补' },
    });
    return { status: 'committed', runId: id, state: run.state, version: run.version, retry: 'none' };
  }

  function dispatch(run, command) {
    switch (command.action) {
      case 'question': return question(run, command);
      case 'prereg_freeze': return freeze(run, command);
      case 'discussion': return discussion(run, command);
      case 'pin_persona': return pinPersona(run, command);
      case 'experiment': return experiment(run, command);
      case 'review': return review(run, command);
      case 'stage4': return stage4(run, command);
      case 'eval_report': return evalReport(run, command);
      case 'eval_read': return evalRead(run, command);
      case 'memory_propose': return propose(run, command);
      case 'memory_commit': return commitMemory(run, command);
      case 'map_claim': return mapClaim(run, command);
      case 'map_edge': return mapEdge(run, command);
      case 'decision': return decision(run, command);
      case 'promote': return promote(run, command);
      case 'set_knobs': return setKnobs(run, command);
      case 'branch_propose': return branchPropose(run, command);
      case 'branch_assign': return branchEvent(run, command, 'branch.assigned');
      case 'branch_activate': return branchEvent(run, command, 'branch.activated');
      case 'branch_evidence': return branchEvidence(run, command);
      case 'branch_verdict': return branchEvent(run, command, 'branch.verdict');
      case 'branch_merge': return branchEvent(run, command, 'branch.merged');
      case 'branch_drop': return branchEvent(run, command, 'branch.dropped');
      default: return receipt({ reasonCode: 'UNKNOWN_ACTION', runId: run.id });
    }
  }

  function question(run, command) {
    const payload = command.payload?.question ?? {};
    const text = typeof payload.text === 'string' ? payload.text.trim() : '';
    const hypothesis = typeof payload.hypothesis === 'string' ? payload.hypothesis.trim() : '';
    const unknowns = Array.isArray(payload.unknowns)
      ? payload.unknowns.filter((item) => typeof item === 'string' && item.trim()).map((item) => item.trim())
      : [];
    if (text.length < 4 || hypothesis.length < 4) {
      return receipt({
        reasonCode: 'QUESTION_INCOMPLETE', runId: run.id,
        nextAction: 'question', blockers: ['question'], retry: 'none',
      });
    }
    run.question = { text, hypothesis, unknowns };
    advance(run, 'QUESTION');
    run.nextAction = 'prereg_freeze';
    run.blockers = ['prereg.frozen'];
    append(run, 'question.recorded', { textLength: text.length, hypothesisLength: hypothesis.length, unknowns: unknowns.length });
    return {
      status: 'committed', runId: run.id, state: run.state, version: run.version,
      nextAction: 'prereg_freeze', blockers: ['prereg.frozen'], retry: 'none',
      data: { question: run.question },
    };
  }

  function freeze(run, command) {
    const playbook = PLAYBOOKS[run.playbookId];
    const missing = missingPrereg(playbook, command.payload?.prereg);
    if (missing.length) {
      return receipt({ reasonCode: 'PREREG_INCOMPLETE', runId: run.id, blockers: missing, nextAction: 'complete-prereg' });
    }
    const nextHash = hashJson(command.payload.prereg);
    if (run.preregHash && run.preregHash !== nextHash) {
      append(run, 'prereg.violation', { from: run.preregHash, to: nextHash });
      return receipt({ reasonCode: 'PREREG_VIOLATION', runId: run.id, retry: 'manual', nextAction: 'new-run' });
    }
    run.prereg = { hash: nextHash, frozen: true, contract: command.payload.prereg };
    run.preregHash = nextHash;
    advance(run, 'PREREG_FROZEN');
    run.nextAction = 'discussion';
    run.blockers = ['discussion'];
    append(run, 'prereg.frozen', { hash: nextHash });
    return { status: 'committed', runId: run.id, state: run.state, version: run.version, retry: 'none' };
  }

  function discussion(run, command) {
    if (!run.preregHash) return receipt({ reasonCode: 'PREREG_REQUIRED', runId: run.id, blockers: ['prereg.frozen'] });
    const packages = command.payload?.packages ?? [];
    if (!Array.isArray(packages)) return receipt({ reasonCode: 'BAD_PACKAGES', runId: run.id });
    const heterogeneity = scoreHeterogeneity(packages);
    run.discussion.rounds += 1;
    run.discussion.packages = packages;
    run.discussion.heterogeneity = heterogeneity;
    advance(run, 'DISCUSSION');
    run.nextAction = 'experiment';
    append(run, 'discussion.recorded', { round: command.payload?.round ?? run.discussion.rounds, D: heterogeneity.D });
    const corruptionFlags = [];
    if (heterogeneity.D < run.knobs.heterogeneityFloor || heterogeneity.styleOnly) {
      corruptionFlags.push('CORRUPTION_WARNING');
      append(run, 'corruption.detected', { scope: 'discussion', D: heterogeneity.D });
    }
    return {
      status: 'committed', runId: run.id, state: run.state, version: run.version,
      corruptionFlags, retry: 'none', data: { heterogeneity },
    };
  }

  function pinPersona(run, command) {
    const persona = command.payload?.persona ?? {};
    const binding = persona.topicBinding ?? {};
    const required = ['defaultAssumptionToAttack', 'expectedCounterexample', 'falsifiableDisagreement'];
    if (required.some((key) => !binding[key]) || !persona.sinthome?.observableWorkProduct) {
      return receipt({ reasonCode: 'PERSONA_DECORATIVE', runId: run.id, nextAction: 'complete-topic-binding' });
    }
    const stored = { ...persona, contentHash: hashJson(persona), pinnedAt: nowIso() };
    run.personas.push(stored);
    append(run, 'persona.pinned', { hash: stored.contentHash, role: persona.role ?? null });
    return { status: 'committed', runId: run.id, version: run.version, personaHash: stored.contentHash, retry: 'none' };
  }

  function experiment(run, command) {
    if (!run.preregHash) {
      append(run, 'gate.denied', { action: 'experiment', reasonCode: 'PREREG_REQUIRED', missing: ['prereg.frozen'] });
      return receipt({
        reasonCode: 'PREREG_REQUIRED', runId: run.id, blockers: ['prereg.frozen'], nextAction: 'prereg_freeze',
      });
    }
    const entry = {
      id: `exp_${run.experiments.length + 1}`,
      command: command.payload?.command ?? null,
      artifactHash: command.payload?.artifactHash ?? null,
      resultState: 'recorded',
      at: nowIso(),
    };
    run.experiments.push(entry);
    advance(run, 'EXECUTING');
    run.nextAction = 'review';
    append(run, 'experiment.recorded', { id: entry.id, command: entry.command, artifactHash: entry.artifactHash });
    return { status: 'committed', runId: run.id, state: run.state, version: run.version, retry: 'none' };
  }

  function review(run, command) {
    const entry = {
      verdict: command.payload?.verdict ?? 'suspect',
      items: command.payload?.items ?? [],
      at: nowIso(),
    };
    run.reviews.push(entry);
    advance(run, 'REVIEW');
    run.nextAction = 'stage4';
    append(run, 'review.recorded', { verdict: entry.verdict, items: entry.items.length });
    return { status: 'committed', runId: run.id, state: run.state, version: run.version, retry: 'none' };
  }

  function stage4(run, command) {
    run.stage4 = { ...command.payload, at: nowIso() };
    advance(run, 'STAGE4');
    run.nextAction = 'eval_report';
    append(run, 'stage4.recorded', { keys: Object.keys(command.payload ?? {}) });
    return { status: 'committed', runId: run.id, state: run.state, version: run.version, retry: 'none' };
  }

  function evalReport(run, command) {
    run.eval = {
      reportHash: command.payload?.reportHash ?? null,
      verdict: command.payload?.verdict ?? 'suspect',
      seeds: command.payload?.seeds ?? run.knobs.evalSeeds,
      readAt: run.eval.readAt,
      readBy: run.eval.readBy,
    };
    advance(run, 'EVAL');
    run.nextAction = 'eval_read';
    append(run, 'eval.reported', { reportHash: run.eval.reportHash, verdict: run.eval.verdict });
    return { status: 'committed', runId: run.id, state: run.state, version: run.version, retry: 'none' };
  }

  function evalRead(run, command) {
    run.eval.readAt = nowIso();
    run.eval.readBy = command.actor?.id ?? null;
    advance(run, 'MEMORY');
    run.nextAction = 'memory_propose';
    run.blockers = [];
    append(run, 'eval.read', { actor: command.actor?.id ?? null, reportHash: command.payload?.reportHash ?? run.eval.reportHash });
    return { status: 'committed', runId: run.id, state: run.state, version: run.version, retry: 'none' };
  }

  function propose(run, command) {
    const proposal = {
      id: `mem_${run.memory.proposals.length + 1}`,
      claim: command.payload?.claim ?? '',
      evidenceRefs: command.payload?.evidenceRefs ?? [],
      status: 'proposed',
      at: nowIso(),
    };
    run.memory.proposals.push(proposal);
    advance(run, 'MEMORY');
    run.nextAction = 'memory_commit';
    append(run, 'memory.proposed', { id: proposal.id, claim: proposal.claim });
    return {
      status: 'committed', runId: run.id, state: run.state, version: run.version,
      proposalId: proposal.id, data: { proposalId: proposal.id }, retry: 'none',
    };
  }

  function commitMemory(run, command) {
    if (command.actor?.kind !== 'user') return receipt({ reasonCode: 'USER_ONLY', runId: run.id });
    const proposal = run.memory.proposals.find((item) => item.id === command.payload?.proposalId);
    if (!proposal) return receipt({ reasonCode: 'UNKNOWN_PROPOSAL', runId: run.id });
    proposal.status = 'committed';
    run.memory.commits.push({ proposalId: proposal.id, at: nowIso(), by: command.actor.id });
    advance(run, 'MEMORY');
    run.nextAction = 'decision';
    append(run, 'memory.committed', { proposalId: proposal.id });
    return { status: 'committed', runId: run.id, state: run.state, version: run.version, retry: 'none' };
  }

  function mapClaim(run, command) {
    const claim = {
      id: `claim_${run.claims.length + 1}`,
      label: command.payload?.claim ?? '',
      claim: command.payload?.claim ?? '',
      evidenceRefs: command.payload?.evidenceRefs ?? [],
      status: command.payload?.status ?? 'unverified',
      at: nowIso(),
    };
    run.claims.push(claim);
    if (command.payload?.contradicts) {
      run.contradictions.push({
        id: `contra_${run.contradictions.length + 1}`,
        left: command.payload.contradicts,
        right: claim.claim,
        at: nowIso(),
      });
    }
    append(run, 'map.claim', { id: claim.id, status: claim.status, contradicts: command.payload?.contradicts ?? null });
    return { status: 'committed', runId: run.id, version: run.version, claimId: claim.id, retry: 'none' };
  }

  function mapEdge(run, command) {
    const edge = {
      id: `edge_${run.edges.length + 1}`,
      from: command.payload?.from ?? null,
      to: command.payload?.to ?? null,
      kind: command.payload?.relation ?? command.payload?.kind ?? 'depends',
      at: nowIso(),
    };
    run.edges.push(edge);
    append(run, 'map.edge', { id: edge.id, from: edge.from, to: edge.to, kind: edge.kind });
    return { status: 'committed', runId: run.id, version: run.version, edgeId: edge.id, retry: 'none' };
  }

  function decision(run, command) {
    const payload = command.payload ?? {};
    const text = `${payload.conclusion ?? ''} ${payload.next ?? ''}`;
    const playbook = PLAYBOOKS[run.playbookId];
    const evidenceRefs = payload.evidenceRefs ?? [];
    if (playbook.fearSignals.some((signal) => text.includes(signal)) && evidenceRefs.length === 0) {
      append(run, 'unknown.fear', { text });
      return receipt({ reasonCode: 'UNKNOWN_FEAR', runId: run.id, nextAction: 'register-unknown-on-map' });
    }
    const same = run.decisions.filter((item) => item.conclusion === payload.conclusion
      && item.next === payload.next && payload.next === 'repeat-same');
    if (same.length + 1 >= run.knobs.sameConclusionLimit && payload.next === 'repeat-same') {
      run.state = 'DRIFT_DETECTED';
      append(run, 'drift.detected', { conclusion: payload.conclusion });
      return receipt({ reasonCode: 'DRIFT_DETECTED', runId: run.id, state: run.state, nextAction: 'pivot-or-stop' });
    }
    const entry = {
      conclusion: payload.conclusion ?? '',
      next: payload.next ?? 'new-run',
      evidenceRefs,
      ambition: payload.ambition ?? null,
      at: nowIso(),
    };
    run.decisions.push(entry);
    run.decision = entry;
    run.claims.push({
      id: `claim_${run.claims.length + 1}`,
      label: entry.conclusion,
      claim: entry.conclusion,
      evidenceRefs,
      status: 'decided',
      at: entry.at,
    });
    const derivedDimensions = {
      O: run.claims.length ? 0.75 : (run.experiments.length ? 0.6 : 0.4),
      R: run.preregHash ? 0.8 : 0.3,
      G: run.discussion.packages.length > 1 ? 0.7 : 0.45,
      H: typeof payload.ambition === 'number' ? Math.max(0, Math.min(1, payload.ambition)) : 0.6,
      P_plan: evidenceRefs.length ? 0.8 : 0.4,
    };
    const ambition = scoreAmbition({
      dimensions: payload.dimensions ?? derivedDimensions,
      evidenceClosure: evidenceRefs.length ? 1 : 0,
      actionCompletion: run.experiments.length ? 1 : 0,
      decisionUpdate: 1,
      auditIntegrity: run.reviews.length ? 1 : 0,
      selfReport: typeof payload.selfReport === 'number' ? payload.selfReport
        : (typeof payload.ambition === 'number' ? payload.ambition : undefined),
    });
    run.ambition = ambition;
    advance(run, 'DECISION');
    run.nextAction = 'close-or-new-run';
    append(run, 'decision.recorded', { conclusion: entry.conclusion, next: entry.next, ambition: entry.ambition });
    const corruptionFlags = [];
    if (typeof payload.ambition === 'number' && payload.ambition < run.knobs.ambitionFloor) {
      corruptionFlags.push('CORRUPTION_WARNING');
      append(run, 'corruption.detected', { scope: 'decision', ambition: payload.ambition });
    }
    return { status: 'committed', runId: run.id, state: run.state, version: run.version, corruptionFlags, retry: 'none' };
  }

  function promote(run, command) {
    const touches = command.payload?.touches ?? [];
    if (touches.some((item) => KERNEL_PATHS.includes(item))) {
      append(run, 'boundary.denied', { touches });
      return receipt({ reasonCode: 'FORBIDDEN_BOUNDARY_EDIT', runId: run.id });
    }
    if (command.payload?.evalRead !== true && !run.eval.readAt) {
      return receipt({ reasonCode: 'EVAL_NOT_READ', runId: run.id, nextAction: 'eval_read' });
    }
    if (!run.knobs.l2CodeEdit && touches.includes('code')) {
      return receipt({ reasonCode: 'L2_CLOSED', runId: run.id });
    }
    if (!run.knobs.l3MetaEdit && touches.includes('meta')) {
      return receipt({ reasonCode: 'L3_CLOSED', runId: run.id });
    }
    append(run, 'candidate.promoted', { candidateId: command.payload?.candidateId ?? null, touches });
    return { status: 'committed', runId: run.id, version: run.version, retry: 'none' };
  }

  /* ---------------------------------------------------------------- branches */

  function branchReceipt(run, branch) {
    const view = branchView(run).find((item) => item.id === branch.id) ?? null;
    return {
      status: 'committed', runId: run.id, state: run.state, version: run.version,
      branchId: branch.id, branch: view, retry: 'none',
    };
  }

  function branchFailure(run, command, error) {
    const code = typeof error?.code === 'string' && error.code.startsWith('BRANCH_')
      ? error.code
      : 'BRANCH_EVENT_INVALID';
    return receipt({
      reasonCode: code,
      runId: run.id,
      branchId: error?.branchId ?? command.payload?.branchId ?? null,
      message: error?.message ?? String(error),
      ...(Array.isArray(error?.violations) ? { violations: error.violations } : {}),
      retry: 'none',
    });
  }

  /** One appendBranch + one version bump per successful branch command. */
  function branchEvent(run, command, type, data = null) {
    const payload = data ?? command.payload ?? {};
    try {
      const { branch } = appendBranch(run, {
        type,
        actor: command.actor ?? null,
        data: { ...payload },
      });
      run.version += 1;
      return branchReceipt(run, branch);
    } catch (error) {
      return branchFailure(run, command, error);
    }
  }

  function branchPropose(run, command) {
    const payload = command.payload ?? {};
    try {
      const { branch } = appendBranch(run, {
        type: 'branch.proposed',
        actor: command.actor ?? null,
        data: {
          title: payload.title,
          hypothesis: payload.hypothesis,
          falsifiable: payload.falsifiable,
        },
      });
      if (payload.ownerId != null && String(payload.ownerId).trim()) {
        // B5: setting an owner at proposal time still leaves the assigned record.
        appendBranch(run, {
          type: 'branch.assigned',
          actor: command.actor ?? null,
          data: { branchId: branch.id, ownerId: payload.ownerId },
        });
      }
      run.version += 1;
      return branchReceipt(run, branch);
    } catch (error) {
      return branchFailure(run, command, error);
    }
  }

  function branchEvidence(run, command) {
    const payload = command.payload ?? {};
    if (command.actor?.kind === 'evaluator' && String(payload.kind ?? '').trim() !== 'eval') {
      return receipt({
        reasonCode: 'FORBIDDEN_ACTOR', runId: run.id,
        branchId: payload.branchId ?? null,
        message: 'evaluator 只能提交 kind=eval 的证据', retry: 'none',
      });
    }
    return branchEvent(run, command, 'branch.evidence', {
      branchId: payload.branchId,
      kind: payload.kind,
      ref: payload.ref,
      supports: payload.supports === true,
      note: payload.note,
    });
  }

  function setKnobs(run, command) {
    if (command.actor?.kind !== 'user') return receipt({ reasonCode: 'USER_ONLY', runId: run.id });
    const next = { ...run.knobs, ...(command.payload?.knobs ?? {}) };
    runCounter += 1;
    const id = `run_${hashJson({ parent: run.id, knobs: next, n: runCounter }).slice(0, 8)}`;
    // T4.1: a fork is a pure intake. It inherits artifacts for inspection but no
    // frozen contract — only a fresh prereg_freeze can open the experiment gate.
    const inheritedArtifacts = INHERITED_ARTIFACTS.filter((key) => hasInheritableArtifact(run[key]));
    const forked = {
      ...structuredClone(run),
      id,
      version: 0,
      parentId: run.id,
      state: 'INTAKE',
      knobs: next,
      knobHash: hashJson(next),
      preregHash: null,
      prereg: run.prereg?.contract
        ? { hash: null, frozen: false, inheritedFrom: run.id, contract: structuredClone(run.prereg.contract) }
        : null,
      branches: [mainBranchDraft()],
      inheritedArtifacts,
      events: [],
      createdAt: nowIso(),
      updatedAt: nowIso(),
      nextAction: 'question',
      blockers: ['question'],
    };
    for (const key of inheritedArtifacts) forked[key] = markInherited(forked[key]);
    runs.set(id, forked);
    if (!children.has(run.id)) children.set(run.id, []);
    children.get(run.id).push(id);
    append(forked, 'run.forked', { parentId: run.id, reason: 'knob-change' }, {
      bumpVersion: false,
      extra: { inheritedArtifacts },
    });
    return {
      status: 'committed', runId: id, parentId: run.id, forked: true,
      state: forked.state, version: forked.version, retry: 'none',
    };
  }

  function gate(runId, target = 'experiment') {
    const run = runs.get(runId);
    if (!run) return { allow: false, missing: ['run'], nextAction: 'start', state: null, runId };
    const missing = [];
    if (target === 'experiment' && !run.preregHash) missing.push('prereg.frozen');
    const nextAction = missing.includes('prereg.frozen') ? 'prereg_freeze' : null;
    return { allow: missing.length === 0, missing, nextAction, state: run.state, runId };
  }

  function lineageChildren(runId) {
    return children.get(runId) ?? [];
  }

  function runView(runId) {
    const run = runs.get(runId);
    if (!run) {
      const error = new Error(`unknown run ${runId}`);
      error.code = 'UNKNOWN_RUN';
      throw error;
    }
    const gateExperiment = gate(runId, 'experiment');
    return {
      id: run.id,
      title: run.title,
      playbookId: run.playbookId,
      state: run.state,
      version: run.version,
      parentId: run.parentId,
      createdAt: run.createdAt,
      updatedAt: run.updatedAt,
      knobHash: run.knobHash,
      knobs: run.knobs,
      models: run.models,
      prereg: run.prereg ?? { hash: null, frozen: false, contract: null },
      preregHash: run.preregHash,
      question: run.question,
      inheritedArtifacts: run.inheritedArtifacts ?? [],
      stage: run.state,
      nextAction: run.nextAction ?? null,
      blockers: gateExperiment.allow ? [] : gateExperiment.missing,
      personas: run.personas,
      participants: run.personas.map((persona) => ({ role: persona.role ?? null, personaHash: persona.contentHash })),
      discussion: run.discussion,
      experiments: run.experiments,
      reviews: run.reviews,
      eval: run.eval,
      decision: run.decision,
      ambition: run.ambition ?? {
        A_p: 0, E: 0, A_d: 0, A_final: 0, inflationFlag: false, corruptionFlags: [],
      },
      memory: run.memory,
      events: run.events,
      claims: run.claims,
      edges: run.edges,
      contradictions: run.contradictions,
      branches: branchView(run),
      branchInvariants: branchInvariants(run),
      lineage: { parentId: run.parentId, children: lineageChildren(run.id) },
    };
  }

  function map(runId) {
    const run = runs.get(runId);
    if (!run) {
      const error = new Error(`unknown run ${runId}`);
      error.code = 'UNKNOWN_RUN';
      throw error;
    }
    const nodes = run.claims.map((claim) => ({
      id: claim.id,
      kind: 'claim',
      label: claim.label ?? claim.claim,
      claim: claim.claim,
      status: claim.status,
      evidenceRefs: claim.evidenceRefs,
      runRefs: [run.id],
    }));
    const frontier = nodes
      .filter((node) => node.status === 'unverified' || node.status === 'unknown')
      .map((node) => ({ nodeId: node.id, whyUnknown: node.status, testableNext: '' }));
    return {
      runId,
      nodes,
      edges: run.edges,
      frontier,
      blindSpots: [],
      contradictions: run.contradictions,
      meanReversion: { distance: 0, centered: false, suspect: false },
      averaged: false,
      version: run.version,
    };
  }

  function getGraph(playbookId) {
    const playbook = PLAYBOOKS[playbookId];
    if (!playbook) return null;
    const stored = graphs.get(playbookId);
    if (!stored) return buildDefaultGraph(playbook);
    let graph = cloneGraph(stored);
    if (graph.layoutVersion !== LAYOUT_VERSION) {
      // T5.2: a persisted v1 layout is re-laid out on read and written back.
      graph = migrateLayout(graph, playbook);
      graph.layoutVersion = LAYOUT_VERSION;
      graph.revision = graph.revision ?? graph.version ?? 1;
      if (!graph.contentHash) graph.contentHash = hashJson(graph);
      graphs.set(playbookId, cloneGraph(graph));
    }
    if (graph.revision === undefined) graph.revision = graph.version ?? 1;
    return graph;
  }

  /** T6.1: protected nodes (start/end/playbook stages and gates) cannot be deleted. */
  function protectedDeletionErrors(playbookId, playbook, candidate) {
    const previous = graphs.get(playbookId) ?? buildDefaultGraph(playbook);
    const present = new Set((candidate?.nodes ?? []).map((item) => item?.id));
    const missing = [];
    for (const id of protectedNodeIds(playbook)) {
      if ((previous.nodes ?? []).some((item) => item.id === id) && !present.has(id)) missing.push(id);
    }
    return missing.map((id) => ({ code: 'V10', nodeId: id, message: `protected node ${id} cannot be deleted` }));
  }

  function saveGraph(playbookId, graph, actorKind = 'user') {
    if (actorKind !== 'user') return receipt({ reasonCode: 'USER_ONLY' });
    const playbook = PLAYBOOKS[playbookId];
    if (!playbook) return receipt({ reasonCode: 'UNKNOWN_PLAYBOOK' });
    const deletions = protectedDeletionErrors(playbookId, playbook, graph);
    if (deletions.length) return receipt({ reasonCode: 'PROTECTED_NODE', errors: deletions });
    const validation = validateGraph(graph, playbook);
    if (!validation.ok) return receipt({ reasonCode: 'INVALID_GRAPH', errors: validation.errors });
    const previous = graphs.get(playbookId) ?? buildDefaultGraph(playbook);
    const version = (previous?.version ?? 0) + 1;
    const revision = (previous?.revision ?? previous?.version ?? 0) + 1;
    const next = {
      ...cloneGraph(graph),
      id: `${playbookId}:v${version}`,
      playbookId,
      version,
      revision,
      layoutVersion: graph.layoutVersion ?? previous?.layoutVersion ?? LAYOUT_VERSION,
      updatedAt: nowIso(),
      contentHash: hashJson(graph),
    };
    graphs.set(playbookId, next);
    return { status: 'committed', graph: cloneGraph(next), version, revision };
  }

  function saveLayout(playbookId, positions, actorKind = 'user') {
    if (actorKind !== 'user') return receipt({ reasonCode: 'USER_ONLY' });
    const playbook = PLAYBOOKS[playbookId];
    if (!playbook) return receipt({ reasonCode: 'UNKNOWN_PLAYBOOK' });
    const current = graphs.get(playbookId) ?? buildDefaultGraph(playbook);
    const next = cloneGraph(current);
    for (const [id, position] of Object.entries(positions ?? {})) {
      const target = next.nodes.find((item) => item.id === id);
      if (target && Number.isFinite(position?.x) && Number.isFinite(position?.y)) {
        target.position = { x: position.x, y: position.y };
      }
    }
    const validation = validateGraph(next, playbook);
    if (!validation.ok) return receipt({ reasonCode: 'INVALID_GRAPH', errors: validation.errors });
    next.layoutVersion = LAYOUT_VERSION;
    next.revision = (current?.revision ?? current?.version ?? 0) + 1;
    next.updatedAt = nowIso();
    next.contentHash = hashJson(next);
    graphs.set(playbookId, next);
    return { status: 'committed', graph: cloneGraph(next), revision: next.revision };
  }

  function graphView(runId, playbookId) {
    const run = runId ? runs.get(runId) : null;
    // T7.1: without a run the caller may omit the playbook; fall back to the
    // first catalog entry so the blueprint view always has a graph to draw.
    const target = playbookId ?? run?.playbookId ?? Object.keys(PLAYBOOKS)[0];
    const graph = target ? getGraph(target) : null;
    if (!graph) {
      const error = new Error(`unknown playbook ${target}`);
      error.code = 'UNKNOWN_PLAYBOOK';
      throw error;
    }
    const overlay = run ? graphStates(run, graph, { receipts: receiptsFor(run.id) }) : null;
    return {
      graph,
      states: overlay?.states ?? {},
      current: overlay?.current ?? null,
      progress: overlay?.progress ?? { done: 0, total: 0, index: 0 },
      audit: overlay?.audit ?? { ok: true, violations: [] },
      revision: graph.revision ?? graph.version ?? 1,
      runId: run?.id ?? null,
      version: run?.version ?? 0,
      availableCommands: graph.nodes
        .filter((item) => item.config?.action)
        .map((item) => ({ nodeId: item.id, action: item.config.action })),
    };
  }

  /** T8.7 evidence ledger: receipts of one run, oldest first. */
  function receiptsFor(runId) {
    const target = runId ?? null;
    const entries = [];
    for (const value of receipts.values()) {
      if (!value) continue;
      if (target !== null && value.runId !== target) continue;
      entries.push({
        commandId: value.commandId ?? null,
        action: value.action ?? null,
        status: value.status ?? null,
        reasonCode: value.reasonCode ?? null,
        at: value.at ?? null,
      });
    }
    return entries;
  }

  function snapshot() {
    return {
      runs: [...runs.values()].map((run) => publicRun(run)),
      knobs: { ...knobs },
      defaults: { ...DEFAULT_KNOBS },
      knobFields: KNOB_FIELDS.map((field) => ({ ...field })),
      playbooks: Object.values(PLAYBOOKS).map((item) => ({
        id: item.id, title: item.title, domain: item.domain, intent: item.intent, stages: item.stages,
      })),
    };
  }

  function publicRun(run) {
    return runView(run.id);
  }

  function dump() {
    return {
      v: 1,
      knobs: { ...knobs },
      runs: [...runs.values()].map((run) => structuredClone(run)),
      receipts: [...receipts.entries()].map(([key, value]) => ({ key, value })),
      graphs: Object.fromEntries(graphs.entries()),
    };
  }

  /** T4.3: legacy runs that entered INTAKE holding a frozen hash are reconciled. */
  function migrateRunOnLoad(run) {
    if (run.state === 'INTAKE' && run.preregHash != null) {
      const inheritedHash = run.prereg?.inheritedHash ?? run.preregHash;
      run.preregHash = null;
      run.prereg = {
        hash: null,
        frozen: false,
        inheritedFrom: run.prereg?.inheritedFrom ?? run.parentId ?? null,
        inheritedHash,
        contract: run.prereg?.contract ?? null,
      };
      if (!run.events.some((event) => event.type === 'migration.reconciled')) {
        append(run, 'migration.reconciled', { inheritedHash });
      }
    }
    if (!Array.isArray(run.inheritedArtifacts)) run.inheritedArtifacts = [];
    if (!Array.isArray(run.branches)) {
      // v4 migration: old dumps predate branches; materialise b_main without an
      // event so replay trails of past runs are not rewritten.
      const main = mainBranchDraft();
      main.createdAt = run.createdAt ?? main.createdAt;
      main.updatedAt = run.updatedAt ?? main.updatedAt;
      run.branches = [main];
    }
    return run;
  }

  function load(dumpValue) {
    if (!dumpValue || dumpValue.v !== 1) throw new Error('unsupported dump');
    runs.clear();
    receipts.clear();
    children.clear();
    for (const run of dumpValue.runs ?? []) {
      runs.set(run.id, run);
      if (run.parentId) {
        if (!children.has(run.parentId)) children.set(run.parentId, []);
        children.get(run.parentId).push(run.id);
      }
    }
    for (const entry of dumpValue.receipts ?? []) receipts.set(entry.key, entry.value);
    for (const run of runs.values()) migrateRunOnLoad(run);
    for (const [playbookId, graph] of Object.entries(dumpValue.graphs ?? {})) {
      const migrated = migrateLayout(graph, PLAYBOOKS[playbookId] ?? null);
      migrated.layoutVersion = LAYOUT_VERSION;
      migrated.revision = migrated.revision ?? migrated.version ?? 1;
      if (!migrated.contentHash) migrated.contentHash = hashJson(migrated);
      graphs.set(playbookId, migrated);
    }
    let maxSeq = 0;
    for (const run of runs.values()) {
      const last = run.events?.at?.(-1)?.seq ?? 0;
      if (last > maxSeq) maxSeq = last;
    }
    seq = maxSeq;
    runCounter = runs.size;
    Object.assign(knobs, dumpValue.knobs ?? {});
    return true;
  }

  return {
    execute, gate, getRun, snapshot, runView, map, cognitiveMap: map,
    dump, load, knobs, lineageChildren, receiptsFor,
    getGraph, saveGraph, saveLayout, graphView,
  };
}

export default createEngine;
