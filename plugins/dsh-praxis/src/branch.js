/**
 * Praxis v4 branch model — parallel investigation lines inside one Run.
 *
 * Brief: docs/praxis/redesign/20-rewrite-brief.md §2 (frozen). A branch is a
 * first-class object with a hypothesis, a falsifiable statement, an owning
 * agent, an append-only evidence set, and a verdict. Multiple branches may be
 * `active` at the same time (B2) — that is the whole point of v4.
 *
 * Two sources of truth are kept consistent here:
 *   - `run.branches[]` — the materialised branch state (what the UI renders)
 *   - `run.events[]`   — append-only branch events (what the audit replays)
 *
 * Every mutation goes through `appendBranch`, which validates the event, applies
 * it to the branch state and appends one event carrying
 * `{ seq, type, at, branchId, actor, payloadHash, data }`.
 *
 * `branchInvariants` re-derives B1–B5 from the materialised state so the Host can
 * show a reconciliation banner instead of guessing.
 */

import { createHash } from 'node:crypto';

export const BRANCH_STATUS = Object.freeze([
  'proposed', 'active', 'supported', 'refuted', 'inconclusive', 'merged', 'dropped',
]);

export const BRANCH_EVENTS = Object.freeze([
  'branch.proposed', 'branch.assigned', 'branch.activated', 'branch.evidence',
  'branch.verdict', 'branch.merged', 'branch.dropped',
]);

export const EVIDENCE_KINDS = Object.freeze(['experiment', 'external', 'review', 'eval']);
export const VERDICT_STATUS = Object.freeze(['supported', 'refuted', 'inconclusive']);
export const BRANCH_MAIN_ID = 'b_main';
export const MIN_FALSIFIABLE_LENGTH = 8;

const TERMINAL = new Set(['merged', 'dropped']);
const VERDICTS = new Set(VERDICT_STATUS);
const EVIDENCE_KIND_SET = new Set(EVIDENCE_KINDS);

function nowIso() {
  return new Date().toISOString();
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

function payloadHashOf(value) {
  return createHash('sha256').update(JSON.stringify(sortValue(value))).digest('hex').slice(0, 16);
}

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function charLength(value) {
  return [...String(value ?? '')].length;
}

/** Error carrying a stable `BRANCH_*` code plus optional invariant violations. */
function branchError(code, message, extra = {}) {
  const error = new Error(message);
  error.code = code;
  Object.assign(error, extra);
  return error;
}

function ensureBranches(run) {
  if (!Array.isArray(run.branches)) run.branches = [];
  if (!Array.isArray(run.events)) run.events = [];
  return run.branches;
}

function requireBranch(run, branchId) {
  const id = text(branchId);
  if (!id) throw branchError('BRANCH_ID_REQUIRED', 'branchId is required');
  const branch = ensureBranches(run).find((item) => item.id === id);
  if (!branch) throw branchError('BRANCH_NOT_FOUND', `unknown branch ${id}`, { branchId: id });
  return branch;
}

function nextBranchId(run) {
  const taken = new Set(run.branches.map((item) => item.id));
  let index = 1;
  while (taken.has(`b_${index}`)) index += 1;
  return `b_${index}`;
}

function nextSeq(run) {
  return (run.events.at?.(-1)?.seq ?? 0) + 1;
}

function stateInvalid(branch, action) {
  return branchError(
    'BRANCH_STATE_INVALID',
    `branch ${branch.id} is ${branch.status}; cannot ${action}`,
    { branchId: branch.id, status: branch.status },
  );
}

function makeBranch(run, data, at, id) {
  const branchId = text(data.id) || id || nextBranchId(run);
  if (run.branches.some((item) => item.id === branchId)) {
    throw branchError('BRANCH_DUPLICATE', `branch ${branchId} already exists`, { branchId });
  }
  return {
    id: branchId,
    title: text(data.title),
    hypothesis: text(data.hypothesis),
    falsifiable: text(data.falsifiable) || '待补',
    ownerId: null,
    status: 'proposed',
    evidence: [],
    verdict: null,
    mergedInto: null,
    droppedReason: null,
    taskId: null,
    createdAt: at,
    updatedAt: at,
  };
}

/**
 * Validate one branch event, apply it to `run.branches`, and append it to
 * `run.events`. Throws a `BRANCH_*` coded error on invalid input (nothing is
 * written in that case). Returns `{ branch, event }`.
 *
 * @param {object} run
 * @param {{type: string, branchId?: string, actor?: object, payloadHash?: string, at?: string, data?: object}} event
 */
export function appendBranch(run, event = {}) {
  if (!run || typeof run !== 'object') throw branchError('BRANCH_EVENT_INVALID', 'run is required');
  const type = event.type;
  if (!BRANCH_EVENTS.includes(type)) {
    throw branchError('BRANCH_EVENT_INVALID', `unknown branch event ${String(type)}`);
  }
  const data = event.data ?? {};
  const at = event.at ?? nowIso();
  const actor = event.actor ?? null;
  const branches = ensureBranches(run);
  let branch;

  switch (type) {
    case 'branch.proposed': {
      const draft = makeBranch(run, data, at);
      if (!draft.title) throw branchError('BRANCH_INVALID', 'title is required');
      if (!draft.hypothesis) throw branchError('BRANCH_INVALID', 'hypothesis is required');
      branches.push(draft);
      branch = draft;
      break;
    }
    case 'branch.assigned': {
      branch = requireBranch(run, data.branchId ?? event.branchId);
      if (TERMINAL.has(branch.status)) throw stateInvalid(branch, 'change owner');
      const ownerId = text(data.ownerId);
      if (!ownerId) throw branchError('BRANCH_OWNER_REQUIRED', 'ownerId is required', { branchId: branch.id });
      branch.ownerId = ownerId;
      branch.updatedAt = at;
      break;
    }
    case 'branch.activated': {
      branch = requireBranch(run, data.branchId ?? event.branchId);
      if (branch.status === 'active') break; // idempotent activation keeps the event trail
      if (branch.status !== 'proposed') throw stateInvalid(branch, 'activate');
      branch.status = 'active';
      branch.updatedAt = at;
      break;
    }
    case 'branch.evidence': {
      branch = requireBranch(run, data.branchId ?? event.branchId);
      if (TERMINAL.has(branch.status)) throw stateInvalid(branch, 'add evidence');
      const kind = text(data.kind);
      const ref = text(data.ref);
      if (!EVIDENCE_KIND_SET.has(kind)) {
        throw branchError(
          'BRANCH_EVIDENCE_INVALID',
          `evidence kind must be one of ${EVIDENCE_KINDS.join('|')}`,
          { branchId: branch.id, violations: [{ code: 'B4', branchId: branch.id, message: 'evidence kind 非法' }] },
        );
      }
      if (!ref) {
        throw branchError('BRANCH_EVIDENCE_INVALID', 'evidence ref is required', {
          branchId: branch.id,
          violations: [{ code: 'B4', branchId: branch.id, message: 'evidence 缺少 ref' }],
        });
      }
      branch.evidence.push({
        id: `ev_${branch.evidence.length + 1}`,
        kind,
        ref,
        supports: data.supports === true,
        note: text(data.note) || null,
        at,
      });
      branch.updatedAt = at;
      break;
    }
    case 'branch.verdict': {
      branch = requireBranch(run, data.branchId ?? event.branchId);
      const verdict = text(data.verdict);
      if (!VERDICTS.has(verdict)) {
        throw branchError(
          'BRANCH_VERDICT_INVALID',
          `verdict must be one of ${VERDICT_STATUS.join('|')}`,
          { branchId: branch.id },
        );
      }
      if (TERMINAL.has(branch.status)) throw stateInvalid(branch, 'record verdict');
      if (charLength(branch.falsifiable) < MIN_FALSIFIABLE_LENGTH) {
        // B1: no verdict without a real falsifiable statement.
        throw branchError('BRANCH_UNFALSIFIABLE', 'falsifiable statement must be at least 8 characters', {
          branchId: branch.id,
          violations: [{ code: 'B1', branchId: branch.id, message: '可证伪陈述不足 8 字符，不得给出结论' }],
        });
      }
      const reason = text(data.reason);
      if (!reason) throw branchError('BRANCH_VERDICT_INVALID', 'verdict reason is required', { branchId: branch.id });
      branch.status = verdict;
      branch.verdict = { verdict, reason, at };
      branch.updatedAt = at;
      break;
    }
    case 'branch.merged': {
      branch = requireBranch(run, data.branchId ?? event.branchId);
      const into = text(data.into);
      if (!into) {
        // B3: a merge must say what it merged into.
        throw branchError('BRANCH_MERGE_TARGET_REQUIRED', 'merged branch must record into', {
          branchId: branch.id,
          violations: [{ code: 'B3', branchId: branch.id, message: 'merged 分支必须记录 mergedInto' }],
        });
      }
      if (into === branch.id) {
        throw branchError('BRANCH_MERGE_TARGET_INVALID', 'a branch cannot merge into itself', { branchId: branch.id });
      }
      if (!branches.some((item) => item.id === into)) {
        throw branchError('BRANCH_MERGE_TARGET_INVALID', `unknown merge target ${into}`, { branchId: branch.id, into });
      }
      if (!VERDICTS.has(branch.status)) throw stateInvalid(branch, 'merge');
      branch.status = 'merged';
      branch.mergedInto = into;
      branch.updatedAt = at;
      break;
    }
    case 'branch.dropped': {
      branch = requireBranch(run, data.branchId ?? event.branchId);
      if (TERMINAL.has(branch.status)) throw stateInvalid(branch, 'drop');
      const reason = text(data.reason);
      if (!reason) throw branchError('BRANCH_DROP_REASON_REQUIRED', 'drop reason is required', { branchId: branch.id });
      branch.status = 'dropped';
      branch.droppedReason = reason;
      branch.updatedAt = at;
      break;
    }
    default:
      throw branchError('BRANCH_EVENT_INVALID', `unhandled branch event ${type}`);
  }

  const record = {
    seq: nextSeq(run),
    type,
    at,
    branchId: branch.id,
    actor,
    payloadHash: event.payloadHash ?? payloadHashOf({ type, branchId: branch.id, data }),
    data,
  };
  run.events.push(record);
  run.updatedAt = at;
  return { branch, event: record };
}

/**
 * Frozen BranchView shape (brief §8). Never mutates the run.
 * @returns {Array<object>}
 */
export function branchView(run) {
  const branches = Array.isArray(run?.branches) ? run.branches : [];
  return branches.map((branch) => {
    const evidence = Array.isArray(branch.evidence) ? branch.evidence : [];
    return {
      id: branch.id,
      title: branch.title ?? '',
      hypothesis: branch.hypothesis ?? '',
      falsifiable: branch.falsifiable ?? '',
      ownerId: branch.ownerId ?? null,
      ownerName: branch.ownerId ?? '未指派',
      ownerStatus: 'unknown',
      status: branch.status,
      evidenceCount: evidence.length,
      supports: evidence.filter((item) => item?.supports === true).length,
      contradicts: evidence.filter((item) => item?.supports === false).length,
      verdict: branch.verdict?.reason ?? branch.verdict?.verdict ?? null,
      taskId: branch.taskId ?? null,
      updatedAt: branch.updatedAt ?? branch.createdAt ?? null,
    };
  });
}

/**
 * Re-derive B1–B5 from branch state + event trail.
 * B2 explicitly permits several `active` branches in one run; it only requires
 * that an active line has a responsible owner.
 * @returns {{ok: boolean, violations: Array<{code: string, branchId: string, message: string}>}}
 */
export function branchInvariants(run) {
  const violations = [];
  const branches = Array.isArray(run?.branches) ? run.branches : [];
  const events = Array.isArray(run?.events) ? run.events : [];
  const assigned = new Set();
  for (const event of events) {
    if (event?.type === 'branch.assigned' && event.branchId) assigned.add(event.branchId);
  }
  const push = (code, branchId, message) => violations.push({ code, branchId, message });

  for (const branch of branches) {
    const branchId = branch.id;
    const evidence = Array.isArray(branch.evidence) ? branch.evidence : [];
    const verdictRecorded = Boolean(branch.verdict) || VERDICTS.has(branch.status);

    // B1: verdict requires a real falsifiable statement.
    if (verdictRecorded && charLength(branch.falsifiable) < MIN_FALSIFIABLE_LENGTH) {
      push('B1', branchId, '可证伪陈述不足 8 字符，不得给出结论');
    }
    // B2: several active branches are valid; each active line needs an owner.
    if (branch.status === 'active' && !branch.ownerId) {
      push('B2', branchId, '活跃分支必须有负责人（同一 Run 允许并行的多条 active）');
    }
    // B3: merged must record where it merged into.
    if (branch.status === 'merged') {
      if (!branch.mergedInto) push('B3', branchId, 'merged 分支必须记录 mergedInto');
      else if (branch.mergedInto === branchId) push('B3', branchId, 'mergedInto 不能指向自己');
      else if (!branches.some((item) => item.id === branch.mergedInto)) {
        push('B3', branchId, `mergedInto 目标不存在：${branch.mergedInto}`);
      }
    }
    // B4: evidence must name its kind and its source.
    for (const item of evidence) {
      if (!EVIDENCE_KIND_SET.has(item?.kind)) push('B4', branchId, `evidence kind 非法：${String(item?.kind)}`);
      if (!text(item?.ref)) push('B4', branchId, 'evidence 缺少 ref');
    }
    // B5: ownership changes must leave a branch.assigned record.
    if (branch.ownerId && !assigned.has(branchId)) {
      push('B5', branchId, 'owner 变更缺少 branch.assigned 事件');
    }
  }

  return { ok: violations.length === 0, violations };
}

/** Fresh `b_main` draft used by `start` and by legacy-run migration. */
export function mainBranchDraft() {
  const at = nowIso();
  return {
    id: BRANCH_MAIN_ID,
    title: '主命题',
    hypothesis: '待补',
    falsifiable: '待补',
    ownerId: null,
    status: 'proposed',
    evidence: [],
    verdict: null,
    mergedInto: null,
    droppedReason: null,
    taskId: null,
    createdAt: at,
    updatedAt: at,
  };
}
