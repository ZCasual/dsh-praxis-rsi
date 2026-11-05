/* AUTO-GENERATED FILE. Do not edit client.js by hand.
 * Source: plugins/dsh-praxis/client/*.js
 * Rebuild: node plugins/dsh-praxis/build-client.mjs
 */
window.__ModuleLoader__.load({
  id: '@local/dsh-praxis',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const { useState, useEffect, useRef, useCallback, useMemo, useReducer } = React;

/* ===== 00-primitives.js ===== */
/* Shared primitives. Prefix Prim*. Contract §4.2. No imports, no JSX. */

function PrimCls(...parts) {
  return parts.filter(Boolean).join(' ');
}

function PrimShort(value, size = 12) {
  const text = String(value ?? '');
  return text.length > size ? `${text.slice(0, size)}…` : text;
}

function PrimClock(iso) {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function PrimAgo(iso) {
  if (!iso) return '—';
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return '—';
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  return `${Math.floor(hours / 24)} 天前`;
}

function PrimBtn({ children, onClick, tone, disabled, title, type = 'button', className, ariaLabel, ...rest }) {
  return h('button', {
    type,
    title,
    disabled,
    'aria-label': ariaLabel ?? (typeof children === 'string' ? children : undefined),
    className: PrimCls('px-btn', tone, className),
    onClick,
    ...rest,
  }, children);
}

function PrimField({ label, hint, children, error, id }) {
  return h('label', { className: PrimCls('px-field', error && 'has-error'), htmlFor: id },
    h('span', { className: 'px-field-label' },
      h('span', null, label),
      hint ? h('em', null, hint) : null),
    children,
    error ? h('span', { className: 'px-field-error', role: 'alert' }, error) : null);
}

function PrimInput(props) {
  return h('input', { className: PrimCls('px-input', props.className), ...props });
}

function PrimArea(props) {
  return h('textarea', { rows: 3, className: PrimCls('px-input px-area', props.className), ...props });
}

function PrimSelect({ options, className, ...props }) {
  return h('select', { className: PrimCls('px-input', className), ...props },
    (options ?? []).map(([value, label]) => h('option', { key: value, value }, label)));
}

function PrimChip({ tone, children, title, className, ...rest }) {
  return h('span', { className: PrimCls('px-chip', tone, className), title, ...rest }, children);
}

function PrimBanner({ tone = 'idle', children, onDismiss, action }) {
  return h('div', { className: PrimCls('px-banner', tone), role: tone === 'bad' ? 'alert' : 'status' },
    h('span', { className: 'px-banner-text' }, children),
    action ?? null,
    onDismiss ? h('button', { type: 'button', className: 'px-banner-x', 'aria-label': '关闭提示', onClick: onDismiss }, '×') : null);
}

function PrimMenu({ label, items, tone, disabled }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (event) => {
      if (ref.current && !ref.current.contains(event.target)) setOpen(false);
    };
    const onKey = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
  return h('div', { className: 'px-menu', ref },
    h(PrimBtn, {
      tone, disabled, onClick: () => setOpen((value) => !value),
      className: 'px-menu-trigger', ariaLabel: label,
    }, label, h('span', { className: 'px-menu-caret', 'aria-hidden': true }, '▾')),
    open ? h('div', { className: 'px-menu-list', role: 'menu' },
      (items ?? []).map((item) => h('button', {
        key: item.id ?? item.label,
        type: 'button',
        role: 'menuitem',
        className: PrimCls('px-menu-item', item.danger && 'danger', item.active && 'is-on'),
        onClick: () => { setOpen(false); item.onClick?.(); },
        disabled: item.disabled,
        title: item.title,
      }, item.label, item.hint ? h('em', null, item.hint) : null))) : null);
}

function PrimTabs({ items, value, onChange, ariaLabel }) {
  return h('div', { className: 'px-tabs', role: 'tablist', 'aria-label': ariaLabel },
    (items ?? []).map((item) => h('button', {
      key: item.id,
      type: 'button',
      role: 'tab',
      'aria-selected': item.id === value,
      className: PrimCls('px-tab', item.id === value && 'is-on'),
      onClick: () => onChange?.(item.id),
      title: item.title,
    }, item.label)));
}

function PrimSkeleton({ rows = 3 }) {
  return h('div', { className: 'px-skeleton', 'aria-hidden': true },
    Array.from({ length: rows }, (_, index) => h('span', { key: index, className: 'px-skeleton-row' })));
}

function PrimEmpty({ title, hint, action }) {
  return h('div', { className: 'px-empty' },
    h('p', { className: 'px-empty-title' }, title),
    hint ? h('p', { className: 'px-empty-hint' }, hint) : null,
    action ?? null);
}

function PrimModal({ title, children, onClose, actions, wide }) {
  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return h('div', { className: 'px-modal-scrim', role: 'presentation', onPointerDown: (event) => {
    if (event.target === event.currentTarget) onClose?.();
  } },
  h('div', { className: PrimCls('px-modal', wide && 'wide'), role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
    h('header', { className: 'px-modal-head' },
      h('h2', null, title),
      h('button', { type: 'button', className: 'px-icon-btn', onClick: onClose, 'aria-label': '关闭' }, '×')),
    h('div', { className: 'px-modal-body' }, children),
    actions ? h('footer', { className: 'px-modal-foot' }, actions) : null));
}

function PrimKeyValue({ rows }) {
  return h('dl', { className: 'px-kv' },
    rows.filter(Boolean).map(([label, value]) => h('div', { key: label, className: 'px-kv-row' },
      h('dt', null, label),
      h('dd', null, value))));
}

function PrimGlyph({ kind, 'aria-hidden': ariaHidden = true }) {
  const map = { done: '✓', blocked: '!', failed: '×', active: '●', pending: '○', unknown: '?', stale: '↺', satisfied: '✓', missing: '—' };
  return h('span', { className: PrimCls('px-glyph', kind), 'aria-hidden': ariaHidden }, map[kind] ?? '·');
}

/* ===== 10-store.js ===== */
/* Single shared snapshot store. Prefix Store*. Contract §4.2 B3, B4, B5.
 * App and Dock both call StoreUse(), so there is exactly one poller and one truth. */

const StoreBase = '/praxis/api';
const StorePollMs = 4000;

const StoreSingleton = {
  snapshot: null,
  phase: 'loading',
  error: '',
  conflict: '',
  updatedAt: 0,
  revision: 0,
  receipt: null,
  busy: 0,
  listeners: new Set(),
  timer: null,
  inflight: null,
  started: false,
  hidden: false,
};

/** Contract §4.2: StoreCreate() returns the one shared store instance. Idempotent. */
function StoreCreate() {
  return StoreSingleton;
}

function StoreEmit() {
  for (const listener of StoreSingleton.listeners) {
    try {
      listener();
    } catch {
      /* a broken subscriber must not stop the rest */
    }
  }
}

function StorePatch(patch) {
  Object.assign(StoreSingleton, patch);
  StoreEmit();
}

function StoreSubscribe(listener) {
  StoreSingleton.listeners.add(listener);
  return () => StoreSingleton.listeners.delete(listener);
}

async function StoreApi(path, init) {
  const headers = { 'x-praxis-request': '1', ...(init && init.headers) };
  const response = await fetch(`${StoreBase}${path}`, { ...init, headers, cache: 'no-store' });
  const text = await response.text();
  let value = {};
  try {
    value = text ? JSON.parse(text) : {};
  } catch {
    value = { error: text };
  }
  if (!response.ok) {
    const error = new Error(value.error ?? value.code ?? `HTTP ${response.status}`);
    error.status = response.status;
    error.code = value.code;
    error.value = value;
    throw error;
  }
  return value;
}

function StoreReason(code) {
  if (!code) return '';
  const reasons = StoreSingleton.snapshot?.catalog?.reasons ?? {};
  return reasons[code] ?? code;
}

function StoreApplyView(view) {
  if (!view || typeof view !== 'object') return;
  // A conflict stays visible until the next successful command or an explicit dismiss.
  StorePatch({
    snapshot: view,
    phase: 'fresh',
    error: '',
    updatedAt: Date.now(),
    revision: Number(view.revision ?? view.active?.version ?? 0),
  });
}

function StoreDismissConflict() {
  StorePatch({ conflict: '' });
}

async function StoreRefresh() {
  if (StoreSingleton.inflight) return StoreSingleton.inflight;
  StoreSingleton.inflight = (async () => {
    try {
      const value = await StoreApi('/state');
      StoreApplyView(value.view ?? value);
      return StoreSingleton.snapshot;
    } catch (error) {
      const hasData = Boolean(StoreSingleton.snapshot);
      StorePatch({
        phase: hasData ? 'stale' : 'error',
        error: error instanceof Error ? error.message : String(error),
      });
      return StoreSingleton.snapshot;
    } finally {
      StoreSingleton.inflight = null;
    }
  })();
  return StoreSingleton.inflight;
}

function StoreStart() {
  if (StoreSingleton.started) return;
  StoreSingleton.started = true;
  const tick = async () => {
    if (!StoreSingleton.hidden) await StoreRefresh();
    StoreSingleton.timer = setTimeout(tick, StorePollMs);
  };
  document.addEventListener('visibilitychange', () => {
    StoreSingleton.hidden = document.hidden;
    if (!document.hidden) void StoreRefresh();
  });
  void tick();
}

function StoreCommandId(action) {
  return `${action}-${Date.now().toString(36)}-${Math.floor(Math.random() * 46656).toString(36)}`;
}

/** Submit one command. Always pins expectedDomainVersion unless opts.force. */
async function StoreSend(action, payload, options = {}) {
  const command = {
    commandId: options.commandId ?? StoreCommandId(action),
    action,
    runId: options.runId ?? StoreSingleton.snapshot?.activeRunId ?? undefined,
    expectedDomainVersion: options.force ? undefined : (options.expectedDomainVersion ?? StoreSingleton.revision),
    payload: payload ?? {},
  };
  StorePatch({ busy: StoreSingleton.busy + 1, error: '' });
  try {
    const value = await StoreApi('/command', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ command }),
    });
    if (value.view) StoreApplyView(value.view);
    else await StoreRefresh();
    StorePatch({ receipt: value.receipt ?? null, busy: StoreSingleton.busy - 1, conflict: '' });
    return value.receipt ?? null;
  } catch (error) {
    const status = error?.status;
    const body = error?.value ?? {};
    if (body.view) {
      StorePatch({
        snapshot: body.view,
        updatedAt: Date.now(),
        revision: Number(body.view.revision ?? 0),
        phase: status === 409 ? 'stale' : StoreSingleton.phase,
      });
    }
    const code = body.code ?? error?.code;
    const message = code ? StoreReason(code) : (error instanceof Error ? error.message : String(error));
    StorePatch({
      busy: StoreSingleton.busy - 1,
      error: message,
      conflict: status === 409 ? message : '',
      receipt: body.receipt ?? { status: 'rejected', reasonCode: code, nextAction: body.nextAction, blockers: body.blockers },
    });
    return body.receipt ?? null;
  }
}

async function StoreActivate(runId) {
  const receipt = await StoreSend('activate', { runId }, { runId, force: true });
  await StoreRefresh();
  return receipt;
}

async function StoreStartRun(title, playbookId) {
  const receipt = await StoreSend('start', { title, playbookId }, { runId: undefined, force: true });
  await StoreRefresh();
  return receipt;
}

function StoreUse() {
  const [, force] = useReducer((value) => value + 1, 0);
  useEffect(() => {
    StoreStart();
    StoreInstallDebugSeam();
    return StoreSubscribe(() => force());
  }, []);
  return StoreSingleton;
}

/** Test/debug seam: exposes the same commands the UI uses (no extra privileges). */
function StoreInstallDebugSeam() {
  if (typeof window === 'undefined') return;
  if (window.__praxisDebug) return;
  window.__praxisDebug = {
    store: StoreSingleton,
    snapshot: () => StoreSingleton.snapshot,
    revision: () => StoreSingleton.revision,
    refresh: () => StoreRefresh(),
    send: (action, payload, options) => StoreSend(action, payload, options ?? {}),
    dismissConflict: () => StoreDismissConflict(),
  };
}

/** Read the latest graph projection without polling. */
async function StoreGraph(runId) {
  const suffix = runId ? `?runId=${encodeURIComponent(runId)}` : '';
  const value = await StoreApi(`/graph${suffix}`);
  return value.graph ?? value;
}

/* ===== 20-layout.js ===== */
/* Praxis v4 cockpit geometry. Pure helpers; no graph/editor assumptions. */

const LayoutConstants = Object.freeze({
  railW: 220,
  boardGap: 12,
  columnW: 240,
  headerH: 44,
  bandH: 120,
});

function LayoutNumber(value, fallback) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function LayoutBranchColumns(branches, viewport) {
  const list = Array.isArray(branches) ? branches : [];
  const view = viewport && typeof viewport === 'object' ? viewport : {};
  const height = Math.max(180, LayoutNumber(view.height, 640) - LayoutConstants.headerH - LayoutConstants.bandH);
  const columns = list.map((branch, index) => ({
    id: branch?.id ?? `branch-${index + 1}`,
    x: LayoutConstants.railW + LayoutConstants.boardGap + index * (LayoutConstants.columnW + LayoutConstants.boardGap),
    y: 0,
    w: LayoutConstants.columnW,
    h: height,
  }));
  const totalWidth = Math.max(
    LayoutConstants.railW + LayoutConstants.boardGap * 2,
    LayoutConstants.railW + LayoutConstants.boardGap + list.length * (LayoutConstants.columnW + LayoutConstants.boardGap),
  );
  return { columns, totalWidth };
}

function LayoutGateRows(gates) {
  const list = Array.isArray(gates) ? gates : [];
  const rowH = 44;
  const gap = 6;
  return list.map((gate, index) => ({
    id: gate?.id ?? `gate-${index + 1}`,
    y: index * (rowH + gap),
    h: rowH,
  }));
}

/* ===== 30-canvas.js ===== */
/* Praxis v4 evidence-first cockpit. No topology editing, ports, or drag state. */

const CanvasGateStatusLabels = Object.freeze({ passed: '已过', blocked: '阻塞', future: '未到' });
const CanvasBranchStatusLabels = Object.freeze({
  proposed: '待启用', active: '进行中', supported: '已支持', refuted: '已反驳',
  inconclusive: '未定', merged: '已合流', dropped: '已放弃',
});
const CanvasOwnerStatusLabels = Object.freeze({ running: '运行中', inactive: '空闲', unknown: '未连接' });

function CanvasText(value, fallback = '—') {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function CanvasClip(value, size = 120) {
  const text = CanvasText(value, '');
  return text.length > size ? `${text.slice(0, size)}…` : text;
}

function CanvasTone(status) {
  if (status === 'passed' || status === 'supported') return 'ok';
  if (status === 'blocked' || status === 'refuted') return 'bad';
  if (status === 'active') return 'active';
  return 'warn';
}

function CanvasStatusLabel(status, labels, fallback = '待确认') {
  return labels[status] ?? fallback;
}

function CanvasOwner(member, branch) {
  const ownerId = branch?.ownerId;
  const found = (Array.isArray(member) ? member : []).find((item) => item?.id === ownerId);
  return {
    name: branch?.ownerName || found?.name || (ownerId ? ownerId : '未指派'),
    status: branch?.ownerStatus || found?.status || 'unknown',
  };
}

function CanvasGateRail({ gates, currentStage, onSelect }) {
  const list = Array.isArray(gates) ? gates : [];
  const rows = LayoutGateRows(list);
  return h('aside', {
    className: 'px-v4-gate-rail',
    'data-testid': 'gate-rail',
    'aria-label': '研究门禁',
  },
  h('div', { className: 'px-v4-section-head' },
    h('span', { className: 'px-v4-kicker' }, '治理门禁'),
    h('span', { className: 'px-v4-count' }, `${list.length}`)),
  h('div', { className: 'px-v4-gate-list' }, list.length
    ? list.map((gate, index) => {
      const status = gate?.status ?? 'future';
      const missing = Array.isArray(gate?.missing) ? gate.missing : [];
      const selected = gate?.id === currentStage;
      return h('button', {
        key: gate?.id ?? index,
        type: 'button',
        className: `px-v4-gate-row is-${status}`,
        'data-testid': 'gate-row',
        'data-gate-id': gate?.id ?? `gate-${index + 1}`,
        'data-status': status,
        'data-current': selected ? 'true' : 'false',
        style: { minHeight: `${rows[index]?.h ?? 44}px` },
        onClick: () => onSelect?.(gate?.id ?? null),
        title: missing.length ? `缺失 ${missing.length} 项` : undefined,
      },
      h('span', { className: 'px-v4-gate-rail-mark', 'aria-hidden': true }),
      h('span', { className: 'px-v4-gate-copy' },
        h('strong', null, CanvasText(gate?.label, '门禁')),
        h('span', null, CanvasStatusLabel(status, CanvasGateStatusLabels), missing.length ? ` · 缺失 ${missing.length}` : '')),
      h('span', { className: 'px-v4-gate-icon', 'aria-hidden': true }, status === 'passed' ? '✓' : status === 'blocked' ? '!' : '○'));
    })
    : h('p', { className: 'px-v4-empty-note' }, '暂无门禁')));
}

function CanvasBranchOwner({ branch, members }) {
  const owner = CanvasOwner(members, branch);
  const status = owner.status;
  return h('div', {
    className: 'px-v4-branch-owner',
    'data-testid': 'branch-owner',
    'data-owner-status': status,
  },
    h('span', {
      className: `px-v4-status-dot is-${status}`,
      'data-owner-status': status,
      'aria-label': CanvasOwnerStatusLabels[status] ?? '未连接',
    }),
    h('span', { className: 'px-v4-owner-name' }, CanvasText(owner.name, '未指派')),
    h('span', { className: 'px-v4-owner-state' }, CanvasOwnerStatusLabels[status] ?? '未连接'));
}

function CanvasBranchCard({ branch, members, events, selected, onSelect, onOpenBranch }) {
  const status = branch?.status ?? 'proposed';
  const supports = Number.isFinite(branch?.supports) ? branch.supports : 0;
  const contradicts = Number.isFinite(branch?.contradicts) ? branch.contradicts : 0;
  const evidenceCount = Number.isFinite(branch?.evidenceCount) ? branch.evidenceCount : supports + contradicts;
  const select = () => {
    onSelect?.(branch?.id ?? null);
    onOpenBranch?.(branch?.id ?? null);
  };
  return h('article', {
    className: `px-v4-branch-card is-${status}${selected ? ' is-selected' : ''}`,
    'data-testid': 'branch-card',
    'data-branch-id': branch?.id ?? '',
    'data-status': status,
  },
  h('button', {
    type: 'button',
    className: 'px-v4-branch-hit',
    onClick: select,
    'aria-label': `查看分支：${CanvasText(branch?.title, '未命名分支')}`,
  },
    h('span', { className: 'px-v4-branch-stripe', 'aria-hidden': true }),
    h('span', { className: 'px-v4-branch-head' },
      h('strong', { className: 'px-v4-branch-title' }, CanvasText(branch?.title, '未命名分支')),
      h('span', { className: `px-chip ${CanvasTone(status)}`, 'data-testid': 'branch-status' }, CanvasStatusLabel(status, CanvasBranchStatusLabels))),
    h('span', { className: 'px-v4-branch-falsifiable' }, CanvasClip(branch?.falsifiable || branch?.hypothesis, 145)),
    h(CanvasBranchOwner, { branch, members }),
    h('span', { className: 'px-v4-branch-evidence' },
      h('span', null, `${evidenceCount} 条证据`),
      h('span', { className: 'px-v4-support' }, `支持 ${supports}`),
      h('span', { className: 'px-v4-contradict' }, `反驳 ${contradicts}`)),
    h('span', { className: 'px-v4-branch-log' },
      CanvasBranchLog(branch, events)),
    h('span', { className: 'px-v4-branch-verdict' }, CanvasText(branch?.verdict, '尚无结论'))));
}


/* Branch evidence log: the newest evidence appended to this branch, newest first. */
function CanvasBranchLog(branch, events) {
  const list = Array.isArray(events) ? events : [];
  const rows = list
    .filter((event) => event?.branchId === branch?.id && event?.type === 'branch.evidence')
    .slice(-6)
    .reverse();
  if (!rows.length) {
    return h('span', { className: 'px-v4-branch-log-empty' }, '尚无证据');
  }
  return h('span', { className: 'px-v4-branch-log-list' },
    rows.map((event, index) => {
      const data = event.data ?? {};
      const tone = data.supports === false ? 'is-against' : 'is-for';
      return h('span', { key: event.seq ?? index, className: `px-v4-branch-log-row ${tone}` },
        h('span', { className: 'px-v4-branch-log-kind' }, CanvasEvidenceKind(data.kind)),
        h('span', { className: 'px-v4-branch-log-ref', title: data.ref ?? '' }, CanvasClip(data.ref, 34)),
        h('span', { className: 'px-v4-branch-log-mark' }, data.supports === false ? '−' : '+'));
    }));
}

function CanvasEvidenceKind(kind) {
  const labels = { experiment: '实验', external: '外部', review: '复核', eval: '评估' };
  return labels[kind] ?? '证据';
}

function CanvasBranchBoard({ branches, members, events, timeline, selectedBranchId, onSelect, onOpenBranch, onCreateBranch }) {
  const list = Array.isArray(branches) ? branches : [];
  return h('section', {
    className: 'px-v4-branch-board',
    'data-testid': 'branch-board',
    'aria-label': '并行探究分支',
  },
  h('div', { className: 'px-v4-board-head' },
    h('div', null,
      h('span', { className: 'px-v4-kicker' }, '并行探究'),
      h('h2', null, `${list.length} 条分支`)),
    onCreateBranch ? h(PrimBtn, { onClick: onCreateBranch, className: 'px-v4-create-branch' }, '+ 新建分支') : null),
  list.length
    ? h('div', { className: 'px-v4-branch-columns' }, list.map((branch) => h(CanvasBranchCard, {
      key: branch?.id,
      branch,
      members,
      events,
      selected: branch?.id === selectedBranchId,
      onSelect,
      onOpenBranch,
    })))
    : h(PrimEmpty, {
      title: '还没有并行分支',
      hint: '把一个可证伪陈述设为独立探究线。',
      action: onCreateBranch ? h(PrimBtn, { tone: 'primary', onClick: onCreateBranch }, '创建第一条分支') : null,
    }),
  h(CanvasTimeline, { events: timeline ?? events, branches: list, onSelect }));
}

/* Research timeline: the run's own event stream, newest first. Fills the board below the branches. */
function CanvasTimeline({ events, branches, onSelect }) {
  const list = Array.isArray(events) ? events : [];
  const byId = {};
  for (const branch of Array.isArray(branches) ? branches : []) byId[branch?.id] = branch?.title ?? branch?.id;
  const rows = list
    .filter((event) => String(event?.type ?? '').startsWith('branch.') || ['prereg.frozen', 'map.claim', 'decision.recorded', 'eval.reported'].includes(event?.type))
    .slice(-60)
    .reverse();
  return h('section', { className: 'px-v4-timeline', 'data-testid': 'timeline', 'aria-label': '研究时间线' },
    h('div', { className: 'px-v4-section-head' },
      h('span', { className: 'px-v4-kicker' }, '研究时间线'),
      h('span', { className: 'px-v4-count' }, `${rows.length} 条事件`)),
    rows.length
      ? h('ol', { className: 'px-v4-timeline-rows' }, rows.map((event, index) => {
        const data = event.data ?? {};
        const branchTitle = data.branchId ? byId[data.branchId] ?? data.branchId : null;
        return h('li', { key: event.seq ?? index, className: 'px-v4-timeline-row' },
          h('span', { className: 'px-v4-timeline-time' }, CanvasClockTime(event.at)),
          h('span', { className: 'px-v4-timeline-kind' }, CanvasEventLabel(event.type)),
          branchTitle
            ? h('button', {
              type: 'button',
              className: 'px-v4-timeline-branch',
              onClick: () => onSelect?.(data.branchId),
            }, branchTitle)
            : h('span', { className: 'px-v4-timeline-branch' }, '—'),
          h('span', { className: 'px-v4-timeline-note' }, CanvasClip(data.ref ?? data.reason ?? data.note ?? '', 72)));
      }))
      : h('p', { className: 'px-v4-empty-note' }, '暂无研究事件'));
}

function CanvasClockTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function CanvasEventLabel(type) {
  const labels = {
    'branch.proposed': '提出分支', 'branch.assigned': '指派负责人', 'branch.activated': '启用分支',
    'branch.evidence': '记录证据', 'branch.verdict': '给出结论', 'branch.merged': '合流',
    'branch.dropped': '放弃分支', 'prereg.frozen': '冻结预注册', 'map.claim': '登记主张',
    'decision.recorded': '记录决策', 'eval.reported': '提交评估',
  };
  return labels[type] ?? type;
}

function CanvasEvidenceBand({ rows, selectedClaimId, onSelect }) {
  const list = Array.isArray(rows) ? rows : [];
  return h('section', {
    className: 'px-v4-evidence-band',
    'data-testid': 'evidence-band',
    'aria-label': '证据带',
  },
  h('div', { className: 'px-v4-section-head' },
    h('span', { className: 'px-v4-kicker' }, '证据带'),
    h('span', { className: 'px-v4-count' }, `${list.length} 条主张`)),
  list.length
    ? h('div', { className: 'px-v4-evidence-rows' }, list.map((row, index) => {
      const selected = row?.claimId === selectedClaimId;
      return h('button', {
        key: row?.claimId ?? index,
        type: 'button',
        className: `px-v4-evidence-row${selected ? ' is-selected' : ''}`,
        'data-testid': 'evidence-row',
        'data-claim-id': row?.claimId ?? '',
        onClick: () => onSelect?.(row?.claimId ?? null),
      },
        h('span', { className: 'px-v4-evidence-claim' }, CanvasText(row?.claim, '未命名主张')),
        h('span', { className: 'px-v4-evidence-counts' },
          h('span', { className: 'px-v4-support' }, `支持 ${row?.supports ?? 0}`),
          h('span', { className: 'px-v4-contradict' }, `反驳 ${row?.contradicts ?? 0}`)),
        h('span', { className: 'px-v4-evidence-latest' }, CanvasText(row?.latestSource, '暂无最新证据')));
    }))
    : h('p', { className: 'px-v4-empty-note' }, '暂无主张与证据'));
}

/* Compatibility wrapper for a shell during migration; it has no editor affordances. */
function CanvasView(props) {
  const input = props ?? {};
  return h('div', { className: 'px-v4-cockpit-canvas' },
    h(CanvasGateRail, { gates: input.gates ?? [], currentStage: input.currentStage, onSelect: input.onSelectGate }),
    h(CanvasBranchBoard, {
      branches: input.branches ?? input.view?.branches ?? [],
      members: input.members ?? input.team?.members ?? [],
      selectedBranchId: input.selectedBranchId,
      onSelect: input.onSelectBranch ?? input.onSelect,
      onOpenBranch: input.onOpenBranch,
      onCreateBranch: input.onCreateBranch,
    }),
    h(CanvasEvidenceBand, {
      rows: input.evidenceRows ?? input.rows ?? [],
      selectedClaimId: input.selectedClaimId,
      onSelect: input.onSelectEvidence,
    }));
}

const CanvasCss = `
.px-v4-cockpit-canvas { display:grid; grid-template-columns:220px minmax(0,1fr); grid-template-rows:minmax(0,1fr) 120px; gap:16px; min-height:0; height:100%; overflow:hidden; padding:16px; color:var(--dsw-alias-label-primary); background:var(--dsw-alias-bg-base); }
.px-v4-gate-rail { min-height:0; overflow:auto; padding:2px 0; border-right:1px solid var(--dsw-alias-border-l1); }
.px-v4-section-head,.px-v4-board-head { display:flex; justify-content:space-between; align-items:center; gap:10px; min-height:28px; }
.px-v4-kicker { color:var(--dsw-alias-label-secondary); font-size:var(--px-fs-3); letter-spacing:.08em; text-transform:uppercase; }
.px-v4-count { color:var(--dsw-alias-label-secondary); font-size:var(--px-fs-3); }
.px-v4-gate-list { display:grid; gap:6px; margin-top:8px; padding-right:12px; }
.px-v4-gate-row { position:relative; display:grid; grid-template-columns:4px 1fr 18px; gap:9px; align-items:center; width:100%; padding:7px 8px 7px 0; border:0; border-bottom:1px solid var(--dsw-alias-border-l1); background:transparent; color:inherit; text-align:left; cursor:pointer; }
.px-v4-gate-row:hover,.px-v4-gate-row[data-current="true"] { background:var(--dsw-alias-bg-layer-1); }
.px-v4-gate-rail-mark { align-self:stretch; background:var(--dsw-alias-state-success-primary); }
.px-v4-gate-row.is-blocked .px-v4-gate-rail-mark { background:var(--dsw-alias-state-error-primary); }
.px-v4-gate-row.is-future .px-v4-gate-rail-mark { background:var(--dsw-alias-border-l2); }
.px-v4-gate-copy { display:grid; gap:2px; min-width:0; }
.px-v4-gate-copy strong { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:var(--px-fs-2); font-weight:600; }
.px-v4-gate-copy span,.px-v4-gate-icon { color:var(--dsw-alias-label-secondary); font-size:var(--px-fs-3); }
.px-v4-gate-row.is-blocked .px-v4-gate-copy span,.px-v4-gate-row.is-blocked .px-v4-gate-icon { color:var(--dsw-alias-state-error-primary); }
.px-v4-branch-board { display:flex; flex-direction:column; flex:1 1 auto; min-width:0; min-height:0; overflow:auto; padding:0 12px; }
.px-v4-board-head { margin-bottom:8px; }
.px-v4-board-head h2 { margin:2px 0 0; font-size:var(--px-fs-1); font-weight:600; }
.px-v4-branch-columns { display:grid; grid-template-columns:repeat(auto-fit,minmax(206px,1fr)); gap:12px; align-items:start; align-content:start; }
.px-v4-branch-card { position:relative; display:flex; flex-direction:column; min-height:0; border:1px solid var(--dsw-alias-border-l1); background:var(--dsw-alias-bg-layer-1); overflow:hidden; }
.px-v4-branch-log { display:flex; flex-direction:column; gap:0; margin-top:2px; border-top:1px solid var(--dsw-alias-border-l1); overflow:hidden; }
.px-v4-branch-log-empty { padding:10px 0 0; color:var(--dsw-alias-label-secondary); font-size:var(--px-fs-3); }
.px-v4-branch-log-list { display:flex; flex-direction:column; padding-top:4px; min-height:0; overflow:hidden; }
.px-v4-branch-log-row { display:grid; grid-template-columns:44px minmax(0,1fr) 12px; gap:8px; align-items:center; padding:3px 0; font-size:var(--px-fs-3); color:var(--dsw-alias-label-secondary); border-bottom:1px dotted var(--dsw-alias-border-l1); }
.px-v4-branch-log-kind { color:var(--dsw-alias-label-secondary); }
.px-v4-branch-log-ref { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:var(--dsw-alias-label-primary); }
.px-v4-branch-log-mark { text-align:right; font-weight:600; }
.px-v4-branch-log-row.is-for .px-v4-branch-log-mark { color:var(--dsw-alias-state-success-primary); }
.px-v4-branch-log-row.is-against .px-v4-branch-log-mark { color:var(--dsw-alias-state-error-primary); }
.px-v4-branch-card.is-selected { border-color:var(--dsw-alias-brand-primary); box-shadow:inset 0 0 0 1px var(--dsw-alias-brand-primary); }
.px-v4-branch-hit { display:flex; flex-direction:column; gap:12px; width:100%; height:auto; padding:14px 14px 16px 17px; border:0; background:transparent; color:inherit; text-align:left; cursor:pointer; }
.px-v4-branch-stripe { position:absolute; left:0; top:0; bottom:0; width:4px; background:var(--dsw-alias-label-secondary); }
.px-v4-branch-card.is-active .px-v4-branch-stripe { background:var(--dsw-alias-brand-primary); }
.px-v4-branch-card.is-supported .px-v4-branch-stripe { background:var(--dsw-alias-state-success-primary); }
.px-v4-branch-card.is-refuted .px-v4-branch-stripe { background:var(--dsw-alias-state-error-primary); }
.px-v4-branch-head { display:flex; align-items:flex-start; justify-content:space-between; gap:8px; }
.px-v4-branch-title { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:var(--px-fs-1); }
.px-v4-branch-falsifiable { display:-webkit-box; min-height:42px; overflow:hidden; color:var(--dsw-alias-label-secondary); font-size:var(--px-fs-2); line-height:1.5; -webkit-line-clamp:2; -webkit-box-orient:vertical; }
.px-v4-branch-owner { display:flex; align-items:center; gap:7px; min-width:0; padding-top:3px; border-top:1px solid var(--dsw-alias-border-l1); }
.px-v4-status-dot { width:8px; height:8px; flex:none; border:1px solid currentColor; border-radius:50%; color:var(--dsw-alias-label-secondary); }
.px-v4-status-dot.is-running { background:var(--dsw-alias-state-success-primary); border-color:var(--dsw-alias-state-success-primary); }
.px-v4-status-dot.is-inactive { background:transparent; }
.px-v4-status-dot.is-unknown { border-style:dashed; }
.px-v4-owner-name { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:var(--px-fs-2); }
.px-v4-owner-state { margin-left:auto; color:var(--dsw-alias-label-secondary); font-size:var(--px-fs-3); }
.px-v4-branch-evidence { display:flex; flex-wrap:wrap; gap:7px; color:var(--dsw-alias-label-secondary); font-size:var(--px-fs-3); }
.px-v4-support { color:var(--dsw-alias-state-success-primary); }
.px-v4-contradict { color:var(--dsw-alias-state-error-primary); }
.px-v4-branch-verdict { padding-top:9px; border-top:1px solid var(--dsw-alias-border-l1); font-size:var(--px-fs-2); }
.px-v4-timeline { display:flex; flex-direction:column; flex:1 1 auto; min-height:160px; margin-top:12px; border-top:1px solid var(--dsw-alias-border-l1); padding-top:10px; overflow:hidden; }
.px-v4-timeline-rows { list-style:none; margin:6px 0 0; padding:0; overflow:auto; min-height:0; flex:1 1 auto; }
.px-v4-timeline-row { display:grid; grid-template-columns:52px 104px minmax(120px,220px) minmax(0,1fr); gap:10px; align-items:baseline; padding:4px 0; border-bottom:1px dotted var(--dsw-alias-border-l1); font-size:var(--px-fs-3); }
.px-v4-timeline-time { color:var(--dsw-alias-label-secondary); font-variant-numeric:tabular-nums; }
.px-v4-timeline-kind { color:var(--dsw-alias-label-secondary); }
.px-v4-timeline-branch { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; border:0; background:transparent; color:var(--dsw-alias-brand-primary); text-align:left; font:inherit; padding:0; cursor:pointer; }
.px-v4-timeline-note { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:var(--dsw-alias-label-primary); }
.px-v4-evidence-band { grid-column:1 / -1; min-width:0; border-top:1px solid var(--dsw-alias-border-l1); padding-top:8px; overflow:auto; }
.px-v4-evidence-rows { display:grid; gap:2px; margin-top:5px; }
.px-v4-evidence-row { display:grid; grid-template-columns:minmax(180px,1.3fr) minmax(140px,.7fr) minmax(180px,1fr); gap:12px; align-items:center; min-height:32px; width:100%; padding:5px 8px; border:0; border-bottom:1px solid var(--dsw-alias-border-l1); background:transparent; color:inherit; text-align:left; cursor:pointer; }
.px-v4-evidence-row:hover,.px-v4-evidence-row.is-selected { background:var(--dsw-alias-bg-layer-1); }
.px-v4-evidence-claim,.px-v4-evidence-latest { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:var(--px-fs-2); }
.px-v4-evidence-counts { display:flex; gap:9px; font-size:var(--px-fs-3); }
.px-v4-evidence-latest { color:var(--dsw-alias-label-secondary); font-size:var(--px-fs-3); }
.px-v4-empty-note { padding:12px 4px; color:var(--dsw-alias-label-secondary); font-size:var(--px-fs-2); }
@media (max-width:900px) { .px-v4-cockpit-canvas { grid-template-columns:1fr; grid-template-rows:auto minmax(280px,1fr) auto; overflow:auto; } .px-v4-gate-rail { border-right:0; border-bottom:1px solid var(--dsw-alias-border-l1); max-height:160px; } .px-v4-evidence-row { grid-template-columns:1fr; gap:2px; } }
`;

/* ===== 40-inspector.js ===== */
/* Praxis v4 object inspector. One selected object, one primary action. */

const InspectBranchLabels = Object.freeze({
  proposed: '待启用', active: '进行中', supported: '已支持', refuted: '已反驳',
  inconclusive: '未定', merged: '已合流', dropped: '已放弃',
});
const InspectMemberLabels = Object.freeze({ running: '运行中', inactive: '空闲', provisioning: '准备中', failed: '失败', unknown: '未连接' });

function InspectText(value, fallback = '—') {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function InspectShort(value, size = 120) {
  const text = InspectText(value, '');
  return text.length > size ? `${text.slice(0, size)}…` : text;
}

function InspectStatusLabel(value, labels, fallback = '待确认') {
  return labels[value] ?? fallback;
}

function InspectEvidenceCount(value) {
  return Number.isFinite(value) ? value : 0;
}

function InspectPrimaryButton({ action, onAction, disabled }) {
  const [pending, setPending] = useState(false);
  const run = async () => {
    if (!action || disabled || pending) return;
    setPending(true);
    try { await onAction?.(action.id, action.payload ?? {}); } finally { setPending(false); }
  };
  return h('button', {
    type: 'button',
    className: 'px-btn primary px-v4-inspect-primary',
    'data-testid': 'primary',
    'data-action': action?.id ?? '',
    disabled: Boolean(disabled || pending),
    onClick: run,
  }, pending ? '处理中…' : action?.label ?? '继续');
}

function InspectCloseButton({ onClose }) {
  return h('button', {
    type: 'button',
    className: 'px-icon-btn',
    'aria-label': '关闭检查器',
    onClick: onClose,
  }, '×');
}

function InspectBranchAction(branch) {
  const status = branch?.status;
  if (status === 'proposed') return { id: 'branch_activate', label: '启用分支', form: 'none', payload: { branchId: branch?.id } };
  if (status === 'active') return { id: 'branch_evidence', label: '记录证据', form: 'branch_evidence', payload: { branchId: branch?.id } };
  if (status === 'supported' || status === 'refuted' || status === 'inconclusive') {
    return { id: 'branch_merge', label: '合流到研究结论', form: 'branch_merge', payload: { branchId: branch?.id } };
  }
  return null;
}

/* Run-level next action: every stage has one canonical submission form. */
function InspectRunAction(run, catalog) {
  const actionId = catalog?.stateActions?.[run?.state] ?? run?.nextAction ?? null;
  if (!actionId) return null;
  const label = (catalog?.actions ?? []).find((item) => item.id === actionId)?.label ?? '提交';
  return { id: actionId, label, form: InspectRunFormKind(actionId), payload: {} };
}

function InspectRunFormKind(actionId) {
  const withForm = ['question', 'prereg_freeze', 'discussion', 'experiment', 'review', 'stage4', 'eval_report', 'memory_propose', 'memory_commit', 'decision'];
  return withForm.includes(actionId) ? actionId : 'none';
}

function InspectMemberAction(member, branch) {
  const ids = Array.isArray(member?.branchIds) ? member.branchIds : [];
  if (branch?.id) return { id: 'member_open_branch', label: '查看负责分支', payload: { branchId: branch.id } };
  if (ids.length) return { id: 'member_open_branch', label: '查看负责分支', payload: { branchId: ids[0] } };
  return null;
}

function InspectEvidenceAction(row) {
  if (!row?.claimId) return null;
  return { id: 'evidence_open_claim', label: '查看主张', payload: { claimId: row.claimId } };
}

function InspectKeyValue({ rows }) {
  return h('dl', { className: 'px-v4-inspect-kv' }, rows.filter(Boolean).map(([label, value]) => h('div', { key: label },
    h('dt', null, label), h('dd', null, value))));
}

function InspectBranchBody({ branch, member }) {
  const status = branch?.status ?? 'proposed';
  const supports = InspectEvidenceCount(branch?.supports);
  const contradicts = InspectEvidenceCount(branch?.contradicts);
  const ownerName = branch?.ownerName || member?.name || '未指派';
  return h('div', { className: 'px-v4-inspect-body' },
    h('div', { className: 'px-v4-inspect-status-line' },
      h('span', { className: `px-chip ${status === 'supported' ? 'ok' : status === 'refuted' ? 'bad' : 'active'}` }, InspectStatusLabel(status, InspectBranchLabels)),
      h('span', { className: 'px-v4-inspect-muted' }, `${supports + contradicts} 条证据`)),
    h('section', { className: 'px-v4-inspect-section' },
      h('span', { className: 'px-v4-inspect-label' }, '可证伪陈述'),
      h('p', { className: 'px-v4-inspect-claim' }, InspectText(branch?.falsifiable || branch?.hypothesis))),
    h(InspectKeyValue, { rows: [
      ['负责人', ownerName],
      ['支持证据', h('span', { className: 'px-v4-support' }, String(supports))],
      ['反驳证据', h('span', { className: 'px-v4-contradict' }, String(contradicts))],
      ['结论', InspectText(branch?.verdict, '尚无结论')],
      ['更新时间', InspectText(branch?.updatedAt, '—')],
    ] }),
    branch?.hypothesis && branch?.falsifiable
      ? h('section', { className: 'px-v4-inspect-section' },
        h('span', { className: 'px-v4-inspect-label' }, '假设'),
        h('p', { className: 'px-v4-inspect-note' }, InspectShort(branch.hypothesis, 240)))
      : null);
}

function InspectMemberBody({ member, team }) {
  const task = member?.currentTask;
  const branches = Array.isArray(member?.branchIds) ? member.branchIds : [];
  return h('div', { className: 'px-v4-inspect-body' },
    h('div', { className: 'px-v4-inspect-member-head' },
      h('span', { className: `px-v4-status-dot is-${member?.status ?? 'unknown'}` }),
      h('strong', null, InspectText(member?.name, '未命名成员')),
      h('span', { className: 'px-v4-inspect-muted' }, InspectStatusLabel(member?.status, InspectMemberLabels, '未连接'))),
    h(InspectKeyValue, { rows: [
      ['角色', InspectText(member?.kind, '成员')],
      ['模型', InspectText(member?.model, '—')],
      ['当前任务', task?.title ? InspectShort(task.title, 80) : '暂无任务'],
      ['任务状态', task?.status ? InspectText(task.status) : '—'],
      ['负责分支', branches.length ? `${branches.length} 条` : '暂无'],
      ['团队来源', team?.source === 'live' ? '实时团队' : '尚未组建团队'],
    ] }));
}

function InspectEvidenceBody({ evidenceRow }) {
  return h('div', { className: 'px-v4-inspect-body' },
    h('div', { className: 'px-v4-inspect-status-line' },
      h('span', { className: 'px-chip active' }, '主张'),
      h('span', { className: 'px-v4-inspect-muted' }, InspectText(evidenceRow?.latestAt, '—'))),
    h('section', { className: 'px-v4-inspect-section' },
      h('span', { className: 'px-v4-inspect-label' }, '主张'),
      h('p', { className: 'px-v4-inspect-claim' }, InspectText(evidenceRow?.claim, '未命名主张'))),
    h(InspectKeyValue, { rows: [
      ['支持', h('span', { className: 'px-v4-support' }, String(InspectEvidenceCount(evidenceRow?.supports)))],
      ['反驳', h('span', { className: 'px-v4-contradict' }, String(InspectEvidenceCount(evidenceRow?.contradicts)))],
      ['最新证据', InspectText(evidenceRow?.latestSource, '暂无')],
      ['状态', InspectText(evidenceRow?.status, '未定')],
    ] }));
}



/* Run body: where the run stands and what the single next action is. */
function InspectRunBody({ run, catalog }) {
  if (!run) return h('p', { className: 'px-v4-inspect-note' }, '没有活动运行');
  const stateLabel = (catalog?.states ?? []).find((item) => item.id === run.state)?.label ?? run.state;
  const blockers = (run.blockers ?? []).map((code) => catalog?.blockerLabels?.[code] ?? catalog?.reasons?.[code] ?? code);
  const branches = Array.isArray(run.branches) ? run.branches : [];
  const active = branches.filter((branch) => branch.status === 'active').length;
  return h('div', { className: 'px-v4-inspect-body' },
    h('div', { className: 'px-v4-inspect-section' },
      h('span', { className: 'px-v4-inspect-label' }, '当前阶段'),
      h('p', { className: 'px-v4-inspect-claim' }, stateLabel)),
    h('div', { className: 'px-v4-inspect-section' },
      h('span', { className: 'px-v4-inspect-label' }, '并行分支'),
      h('p', { className: 'px-v4-inspect-claim' }, `${branches.length} 条 · ${active} 条进行中`)),
    blockers.length
      ? h('div', { className: 'px-v4-inspect-section' },
        h('span', { className: 'px-v4-inspect-label' }, '为什么停在这里'),
        blockers.map((text, index) => h('p', { key: index, className: 'px-v4-inspect-note' }, text)))
      : null);
}

/* Submission area: an inline form when the action needs fields, otherwise one button. */
function InspectSubmitArea({ action, onAction, run, branch, catalog }) {
  const [values, setValues] = useState({});
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const kind = action?.form ?? 'none';

  function build() {
    if (kind === 'branch_evidence') {
      return {
        branchId: action.payload?.branchId,
        kind: values.kind ?? 'experiment',
        ref: String(values.ref ?? '').trim(),
        supports: values.supports !== 'contradict',
        note: String(values.note ?? '').trim() || undefined,
      };
    }
    if (kind === 'branch_merge') {
      return { branchId: action.payload?.branchId, into: values.into ?? 'b_main' };
    }
    if (kind === 'question') {
      return { question: { text: String(values.text ?? '').trim(), hypothesis: String(values.hypothesis ?? '').trim(), unknowns: String(values.unknowns ?? '').split(/[,\n]/).map((x) => x.trim()).filter(Boolean) } };
    }
    if (kind === 'prereg_freeze') {
      return { prereg: {
        question: String(values.question ?? run?.question?.text ?? '').trim(),
        prediction: String(values.prediction ?? '').trim(),
        acceptance: String(values.acceptance ?? '').trim(),
        acceptableFailure: String(values.acceptableFailure ?? '若对照无效，接受假设不成立').trim(),
        controls: String(values.controls ?? 'shuffle').trim(),
        metrics: String(values.metrics ?? 'separation').trim(),
        input: String(values.input ?? 'declared-corpus').trim(),
        budget: String(values.budget ?? '45 分钟').trim(),
        stop: String(values.stop ?? '连续两轮无新证据即停止').trim(),
      } };
    }
    if (kind === 'discussion') {
      const persona = String(values.persona ?? 'skeptic').trim();
      const claim = String(values.claim ?? '').trim();
      return { packages: claim ? [{ persona, claim, evidence: [], style: 'direct' }] : [] };
    }
    if (kind === 'experiment') return { command: String(values.command ?? '').trim() || 'ablation' };
    if (kind === 'review') return { verdict: values.verdict ?? 'pass', findings: [] };
    if (kind === 'stage4') return { notes: String(values.notes ?? '阶段四完成').trim() };
    if (kind === 'eval_report') return { reportHash: String(values.reportHash ?? '').trim() || 'eval-1', verdict: values.evalVerdict ?? 'supports', seeds: [1, 2, 3], delegatedActor: 'evaluator' };
    if (kind === 'memory_propose') return { claim: String(values.claim ?? '').trim() || '结论待定', evidenceRefs: [], delegatedActor: 'root' };
    if (kind === 'memory_commit') return {};
    if (kind === 'decision') return { conclusion: String(values.conclusion ?? '').trim() || '维持当前判断', reason: String(values.reason ?? '').trim() || '证据不足', ambition: 0.6 };
    return action?.payload ?? {};
  }

  function validate() {
    if (kind === 'branch_evidence') {
      if (!String(values.ref ?? '').trim()) return '证据引用不能为空（文件、链接或实验产物 id）';
    }
    if (kind === 'question') {
      if (String(values.text ?? '').trim().length < 4) return '研究问题至少 4 个字符';
      if (String(values.hypothesis ?? '').trim().length < 4) return '假设至少 4 个字符';
    }
    if (kind === 'prereg_freeze') {
      if (String(values.prediction ?? '').trim().length < 2) return '预测必须写明方向或数字';
      if (String(values.acceptance ?? '').trim().length < 2) return '验收条件不能为空';
    }
    if (kind === 'discussion' && String(values.claim ?? '').trim().length < 2) return '观点包至少需要一个主张';
    return '';
  }

  async function submit() {
    if (pending) return;
    const problem = validate();
    if (problem) { setError(problem); return; }
    setError('');
    setPending(true);
    try {
      const receipt = await onAction?.(action.id, build());
      if (!receipt || receipt.status === 'rejected') {
        const code = receipt?.reasonCode ?? 'REJECTED';
        setError(`提交被拒绝：${code}`);
      }
    } finally {
      setPending(false);
    }
  }

  const set = (key) => (event) => setValues({ ...values, [key]: event.target.value });

  const form = (() => {
    if (kind === 'none') return null;
    if (kind === 'branch_evidence') {
      return h('div', { className: 'px-v4-form', 'data-testid': 'branch-evidence-form' },
        h(PrimField, { label: '证据类型' },
          h(PrimSelect, { value: values.kind ?? 'experiment', onChange: set('kind'), options: [['experiment', '实验产物'], ['external', '外部来源'], ['review', '复核结论'], ['eval', '独立评估']] })),
        h(PrimField, { label: '引用', hint: '文件、链接或产物 id' },
          h(PrimInput, { value: values.ref ?? '', placeholder: 'run/seeds-1-3.json', onChange: set('ref') })),
        h(PrimField, { label: '方向' },
          h(PrimSelect, { value: values.supports ?? 'support', onChange: set('supports'), options: [['support', '支持本分支'], ['contradict', '反驳本分支']] })),
        h(PrimField, { label: '备注', hint: '可选' },
          h(PrimArea, { value: values.note ?? '', rows: 2, onChange: set('note') })));
    }
    if (kind === 'branch_merge') {
      return h('div', { className: 'px-v4-form' },
        h(PrimField, { label: '合流到' },
          h(PrimSelect, { value: values.into ?? 'b_main', onChange: set('into'), options: [['b_main', '主命题'], ['conclusion', '研究结论']] })));
    }
    if (kind === 'question') {
      return h('div', { className: 'px-v4-form' },
        h(PrimField, { label: '研究问题' }, h(PrimArea, { value: values.text ?? run?.question?.text ?? '', rows: 3, onChange: set('text') })),
        h(PrimField, { label: '可证伪假设' }, h(PrimArea, { value: values.hypothesis ?? '', rows: 3, onChange: set('hypothesis') })),
        h(PrimField, { label: '未知项', hint: '逗号分隔' }, h(PrimInput, { value: values.unknowns ?? '', onChange: set('unknowns') })));
    }
    if (kind === 'prereg_freeze') {
      return h('div', { className: 'px-v4-form' },
        h(PrimField, { label: '研究问题' }, h(PrimInput, { value: values.question ?? run?.question?.text ?? '', onChange: set('question') })),
        h(PrimField, { label: '预测', hint: '数字或方向' }, h(PrimInput, { value: values.prediction ?? '', placeholder: '打乱结构后 separation 下降 ≥0.08', onChange: set('prediction') })),
        h(PrimField, { label: '验收条件' }, h(PrimInput, { value: values.acceptance ?? '', placeholder: '主指标超过基线 0.08 且对照被破坏', onChange: set('acceptance') })),
        h(PrimField, { label: '对照' }, h(PrimInput, { value: values.controls ?? 'shuffle', onChange: set('controls') })),
        h(PrimField, { label: '主指标' }, h(PrimInput, { value: values.metrics ?? 'separation', onChange: set('metrics') })),
        h(PrimField, { label: '预算' }, h(PrimInput, { value: values.budget ?? '45 分钟', onChange: set('budget') })));
    }
    if (kind === 'discussion') {
      return h('div', { className: 'px-v4-form' },
        h(PrimField, { label: '立场' }, h(PrimSelect, { value: values.persona ?? 'skeptic', onChange: set('persona'), options: [['skeptic', '质疑者'], ['builder', '构造者'], ['devil', '魔鬼代言人']] })),
        h(PrimField, { label: '主张' }, h(PrimArea, { value: values.claim ?? '', rows: 3, onChange: set('claim') })));
    }
    if (kind === 'experiment') return h('div', { className: 'px-v4-form' }, h(PrimField, { label: '实验命令' }, h(PrimInput, { value: values.command ?? '', placeholder: 'ablate-structure', onChange: set('command') })));
    if (kind === 'review') return h('div', { className: 'px-v4-form' }, h(PrimField, { label: '复核结论' }, h(PrimSelect, { value: values.verdict ?? 'pass', onChange: set('verdict'), options: [['pass', '通过'], ['suspect', '存疑'], ['fail', '不通过']] })));
    if (kind === 'stage4') return h('div', { className: 'px-v4-form' }, h(PrimField, { label: '阶段四记录' }, h(PrimArea, { value: values.notes ?? '', rows: 3, onChange: set('notes') })));
    if (kind === 'eval_report') {
      return h('div', { className: 'px-v4-form' },
        h(PrimField, { label: '评估报告哈希' }, h(PrimInput, { value: values.reportHash ?? '', placeholder: 'eval-1', onChange: set('reportHash') })),
        h(PrimField, { label: '评估结论' }, h(PrimSelect, { value: values.evalVerdict ?? 'supports', onChange: set('evalVerdict'), options: [['supports', '支持'], ['refutes', '反驳'], ['inconclusive', '不确定']] })),
        h('p', { className: 'px-v4-inspect-note' }, '以独立评估者身份提交，记录 actor.delegated 审计事件。'));
    }
    if (kind === 'memory_propose') {
      return h('div', { className: 'px-v4-form' },
        h(PrimField, { label: '记忆主张' }, h(PrimArea, { value: values.claim ?? '', rows: 3, onChange: set('claim') })),
        h('p', { className: 'px-v4-inspect-note' }, '以 Agent 身份提议，记录 actor.delegated 审计事件。'));
    }
    if (kind === 'decision') {
      return h('div', { className: 'px-v4-form' },
        h(PrimField, { label: '结论' }, h(PrimInput, { value: values.conclusion ?? '', onChange: set('conclusion') })),
        h(PrimField, { label: '理由' }, h(PrimArea, { value: values.reason ?? '', rows: 2, onChange: set('reason') })));
    }
    return null;
  })();

  return h('div', { className: 'px-v4-submit' },
    form,
    error ? h('p', { className: 'px-v4-form-error', 'data-testid': 'action-error', role: 'alert' }, error) : null,
    h('button', {
      type: 'button',
      className: 'px-btn primary px-v4-inspect-primary',
      'data-testid': 'primary',
      'data-action': action?.id ?? '',
      disabled: pending,
      onClick: submit,
    }, pending ? '提交中…' : action?.label ?? '提交'));
}

function InspectPanel({ selection, run, branch, member, evidenceRow, catalog, onAction, onClose }) {
  const kind = selection?.kind ?? selection?.type ?? null;
  if (!kind) return null;
  const title = kind === 'branch' ? InspectText(branch?.title, '分支详情')
    : kind === 'member' ? InspectText(member?.name, '成员详情')
      : kind === 'run' ? '运行下一步' : '证据详情';
  const action = kind === 'branch' ? InspectBranchAction(branch)
    : kind === 'member' ? InspectMemberAction(member, branch)
      : kind === 'run' ? InspectRunAction(run, catalog) : InspectEvidenceAction(evidenceRow);
  const body = kind === 'branch'
    ? h(InspectBranchBody, { branch, member })
    : kind === 'member'
      ? h(InspectMemberBody, { member, team: run?.team })
      : kind === 'run'
        ? h(InspectRunBody, { run, catalog })
        : h(InspectEvidenceBody, { evidenceRow });
  return h('aside', {
    className: 'px-v4-inspector',
    'data-testid': 'inspector',
    'data-selection-kind': kind,
    role: 'dialog',
    'aria-label': title,
  },
    h('header', { className: 'px-v4-inspect-head' },
      h('div', null,
        h('span', { className: 'px-v4-kicker' }, kind === 'branch' ? '并行分支' : kind === 'member' ? '团队成员' : kind === 'run' ? '研究运行' : '证据'),
        h('h2', null, title)),
      h(InspectCloseButton, { onClose })),
    body,
    action ? h('footer', { className: 'px-v4-inspect-foot' },
      h(InspectSubmitArea, { action, onAction, run, branch, catalog })) : null);
}

const InspectCss = `
.px-v4-inspector { position:absolute; top:0; right:0; bottom:0; z-index:10; display:flex; flex-direction:column; width:360px; min-width:0; border-left:1px solid var(--dsw-alias-border-l1); background:var(--dsw-alias-bg-overlay); box-shadow:-12px 0 28px rgb(0 0 0 / .14); color:var(--dsw-alias-label-primary); }
.px-v4-inspect-head { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; padding:16px; border-bottom:1px solid var(--dsw-alias-border-l1); }
.px-v4-inspect-head h2 { margin:3px 0 0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:var(--px-fs-1); font-weight:600; }
.px-v4-inspect-body { min-height:0; overflow:auto; display:grid; align-content:start; gap:16px; padding:16px; }
.px-v4-inspect-status-line,.px-v4-inspect-member-head { display:flex; align-items:center; gap:8px; }
.px-v4-inspect-muted,.px-v4-inspect-note { color:var(--dsw-alias-label-secondary); font-size:var(--px-fs-2); }
.px-v4-inspect-member-head strong { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.px-v4-inspect-section { display:grid; gap:6px; }
.px-v4-inspect-label { color:var(--dsw-alias-label-secondary); font-size:var(--px-fs-3); letter-spacing:.04em; }
.px-v4-inspect-claim { margin:0; font-size:var(--px-fs-1); line-height:1.55; }
.px-v4-inspect-kv { display:grid; gap:7px; margin:0; }
.px-v4-inspect-kv > div { display:grid; grid-template-columns:92px 1fr; gap:8px; }
.px-v4-inspect-kv dt { color:var(--dsw-alias-label-secondary); font-size:var(--px-fs-3); }
.px-v4-inspect-kv dd { min-width:0; margin:0; overflow-wrap:anywhere; font-size:var(--px-fs-2); }
.px-v4-inspect-foot { margin-top:auto; padding:12px 16px 16px; border-top:1px solid var(--dsw-alias-border-l1); }
.px-v4-inspect-primary { width:100%; min-height:36px; }
.px-v4-submit { display:grid; gap:10px; }
.px-v4-form { display:grid; gap:8px; }
.px-v4-form-error { margin:0; color:var(--dsw-alias-state-error-primary); font-size:var(--px-fs-3); }
@media (max-width:1180px) { .px-v4-inspector { top:auto; left:0; width:100%; max-height:46vh; } }
`;

/* ===== 50-panels.js ===== */
/* Praxis v4 drawers: runs, real team, evidence, audit and knob forks. */

const PanelMemberStatusLabels = Object.freeze({ running: '运行中', inactive: '空闲', provisioning: '准备中', failed: '失败', unknown: '未连接' });
const PanelMemberKindLabels = Object.freeze({ lead: 'Lead', teammate: '队友', subagent: '子代理' });
const PanelAuditEventLabels = Object.freeze({
  'run.started': '研究运行开始', 'run.forked': '运行已分叉', 'prereg.frozen': '预注册已冻结',
  'discussion.recorded': '讨论已记录', 'experiment.recorded': '实验已记录', 'review.recorded': '复核已记录',
  'stage4.recorded': '阶段四已记录', 'eval.reported': '评估报告已提交', 'eval.read': '评估报告已读',
  'memory.proposed': '记忆提案已提出', 'memory.committed': '记忆已提交', 'decision.recorded': '决策已记录',
  'corruption.detected': '检测到质量风险', 'drift.detected': '检测到重复路径',
});

function PanelText(value, fallback = '—') {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function PanelShort(value, size = 90) {
  const text = PanelText(value, '');
  return text.length > size ? `${text.slice(0, size)}…` : text;
}

function PanelStatusDot({ status, testid = 'member-status' }) {
  return h('span', {
    className: `px-v4-status-dot is-${status ?? 'unknown'}`,
    'data-testid': testid,
    'data-member-status': status ?? 'unknown',
    'aria-label': PanelMemberStatusLabels[status] ?? '未连接',
  });
}

function PanelDrawer({ id, title, hint, onClose, children, footer }) {
  return h('aside', {
    className: 'px-v4-drawer',
    'data-testid': 'drawer',
    'data-drawer': id,
    role: 'dialog',
    'aria-modal': 'true',
    'aria-label': title,
  },
    h('header', { className: 'px-v4-drawer-head' },
      h('div', null, h('strong', null, title), hint ? h('span', { className: 'px-v4-drawer-hint' }, hint) : null),
      h('button', { type: 'button', className: 'px-icon-btn', 'aria-label': '关闭', onClick: onClose }, '×')),
    h('div', { className: 'px-v4-drawer-body' }, children),
    footer ? h('footer', { className: 'px-v4-drawer-foot' }, footer) : null);
}

function PanelRuns({ runs, activeRunId, onSelectRun, onCreateRun, onClose }) {
  const list = Array.isArray(runs) ? runs : [];
  const [title, setTitle] = useState('');
  const create = () => {
    const value = title.trim() || '未命名研究';
    onCreateRun?.({ title: value });
    setTitle('');
  };
  return h(PanelDrawer, { id: 'runs', title: '研究运行', hint: `${list.length} 个`, onClose,
    footer: h('div', { className: 'px-v4-drawer-create' },
      h(PrimInput, { value: title, placeholder: '新运行标题', onChange: (event) => setTitle(event.target.value) }),
      h(PrimBtn, { tone: 'primary', onClick: create }, '新建运行')) },
  list.length
    ? h('ul', { className: 'px-v4-panel-list' }, list.map((run) => h('li', { key: run?.id },
      h('button', {
        type: 'button',
        className: `px-v4-run-row${run?.id === activeRunId ? ' is-selected' : ''}`,
        'data-testid': 'run-item',
        'data-run-id': run?.id ?? '',
        onClick: () => onSelectRun?.(run?.id),
      },
        h('span', { className: 'px-v4-run-main' },
          h('strong', null, PanelShort(run?.title, 42)),
          h('span', null, `版本 ${run?.version ?? 0}`)),
        h('span', { className: 'px-chip active' }, PanelText(run?.state, '待开始'))))))
    : h(PrimEmpty, { title: '还没有研究运行', hint: '创建一个运行，把问题带入可追踪的研究闭环。' }));
}

function PanelTeam({ team, onClose }) {
  const source = team?.source === 'live' ? 'live' : 'none';
  const members = source === 'live' && Array.isArray(team?.members) ? team.members : [];
  return h(PanelDrawer, { id: 'team', title: '研究团队', hint: source === 'live' ? `${members.length} 人 · 实时` : '未连接', onClose },
    h('section', { className: 'px-v4-team-panel', 'data-testid': 'team-panel', 'data-team-source': source },
      source === 'none'
        ? h(PrimEmpty, { title: '尚未组建团队', hint: '当前没有可读取的实时 Agent Team；界面不会伪造成员。' })
        : h('div', { className: 'px-v4-team-list' },
          members.length ? members.map((member) => h('article', { key: member?.id, className: 'px-v4-team-member' },
            h(PanelStatusDot, { status: member?.status }),
            h('div', { className: 'px-v4-team-member-copy' },
              h('strong', null, PanelText(member?.name, '未命名成员')),
              h('span', null, PanelMemberKindLabels[member?.kind] ?? '成员'),
              h('span', { className: 'px-v4-team-task' }, member?.currentTask?.title ? PanelShort(member.currentTask.title, 56) : '暂无当前任务')),
            h('span', { className: 'px-v4-team-state' }, PanelMemberStatusLabels[member?.status] ?? '未连接')))
            : h(PrimEmpty, { title: '团队暂时为空', hint: '实时团队服务尚未返回成员。' }))));
}

function PanelEvidence({ rows, onSelect, onClose }) {
  const list = Array.isArray(rows) ? rows : [];
  return h(PanelDrawer, { id: 'evidence', title: '证据总览', hint: `${list.length} 条主张`, onClose },
    list.length
      ? h('div', { className: 'px-v4-panel-evidence' }, list.map((row, index) => h('button', {
        key: row?.claimId ?? index,
        type: 'button',
        className: 'px-v4-panel-evidence-row',
        'data-testid': 'evidence-panel-row',
        onClick: () => onSelect?.(row?.claimId),
      },
        h('strong', null, PanelText(row?.claim, '未命名主张')),
        h('span', { className: 'px-v4-evidence-counts' },
          h('span', { className: 'px-v4-support' }, `支持 ${row?.supports ?? 0}`),
          h('span', { className: 'px-v4-contradict' }, `反驳 ${row?.contradicts ?? 0}`)),
        h('span', { className: 'px-v4-panel-latest' }, PanelText(row?.latestSource, '暂无最新证据')))))
      : h(PrimEmpty, { title: '暂无证据', hint: '主张出现后，支持与反驳会在这里并列显示。' }));
}

function PanelAudit({ run, onClose }) {
  const events = Array.isArray(run?.events) ? run.events.slice().reverse() : [];
  return h(PanelDrawer, { id: 'audit', title: '审计时间线', hint: run ? `${events.length} 条事件` : '', onClose },
    run
      ? events.length
        ? h('ol', { className: 'px-v4-audit-list' }, events.map((event, index) => h('li', { key: event?.seq ?? index, className: 'px-v4-audit-row' },
          h('time', null, PanelText(event?.at, '—')),
          h('div', null,
            h('strong', null, PanelAuditEventLabels[event?.type] ?? '研究事件'),
            event?.data?.conclusion ? h('span', null, PanelShort(event.data.conclusion, 72)) : null,
            event?.data?.claim ? h('span', null, PanelShort(event.data.claim, 72)) : null))))
        : h(PrimEmpty, { title: '暂无审计事件', hint: '运行推进后，事件会按时间顺序出现在这里。' })
      : h(PrimEmpty, { title: '没有活动运行', hint: '选择一个运行后再查看审计记录。' }));
}

function PanelKnobValue(value, step) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '—';
  return number.toFixed(Number(step) < 1 ? 2 : 0);
}

function PanelKnobs({ knobs, fields, onFork, onClose }) {
  const source = knobs && typeof knobs === 'object' ? knobs : {};
  const list = Array.isArray(fields) ? fields : [];
  const [draft, setDraft] = useState(() => ({ ...source }));
  const [pending, setPending] = useState(false);
  const setValue = (key, value) => setDraft((previous) => ({ ...previous, [key]: value }));
  const fork = async () => {
    if (!onFork || pending) return;
    setPending(true);
    try { await onFork({ ...source, ...draft }); } finally { setPending(false); }
  };
  return h(PanelDrawer, { id: 'knobs', title: '运行旋钮', hint: '修改会派生新运行', onClose,
    footer: h('div', { className: 'px-v4-drawer-actions' },
      h(PrimBtn, { onClick: () => setDraft({ ...source }), disabled: pending }, '恢复当前值'),
      h(PrimBtn, { tone: 'primary', onClick: fork, disabled: pending || !list.length }, pending ? '派生中…' : '派生新运行')) },
    h(PrimBanner, { tone: 'warn' }, '当前运行保持不变；新旋钮只在派生运行中生效。'),
    list.length
      ? h('ul', { className: 'px-v4-knob-list' }, list.map((field) => {
        const value = draft[field?.key] ?? source[field?.key] ?? field?.min ?? 0;
        const step = field?.step ?? 0.05;
        return h('li', { key: field?.key, className: 'px-v4-knob-row' },
          h('div', { className: 'px-v4-knob-head' },
            h('strong', null, PanelText(field?.label, field?.key)),
            h('span', null, `${PanelKnobValue(value, step)}${field?.unit ? ` ${field.unit}` : ''}`)),
          h('input', {
            type: 'range', min: field?.min ?? 0, max: field?.max ?? 1, step, value,
            'aria-label': PanelText(field?.label, field?.key),
            onChange: (event) => setValue(field.key, Number(event.target.value)),
          }));
      }))
      : h(PrimEmpty, { title: '没有可调整的旋钮', hint: '当前 Host 没有下发旋钮字段。' }));
}

const PanelsCss = `
.px-v4-drawer { position:absolute; inset:0 0 0 auto; z-index:20; display:flex; flex-direction:column; width:420px; max-width:100%; border-left:1px solid var(--dsw-alias-border-l1); background:var(--dsw-alias-bg-overlay); box-shadow:-14px 0 32px rgb(0 0 0 / .16); color:var(--dsw-alias-label-primary); }
.px-v4-drawer-head { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; padding:14px 16px; border-bottom:1px solid var(--dsw-alias-border-l1); }
.px-v4-drawer-head strong { display:block; font-size:var(--px-fs-1); font-weight:600; }
.px-v4-drawer-hint { display:block; margin-top:3px; color:var(--dsw-alias-label-secondary); font-size:var(--px-fs-3); }
.px-v4-drawer-body { min-height:0; overflow:auto; display:grid; align-content:start; gap:12px; padding:14px 16px; }
.px-v4-drawer-foot { display:grid; gap:8px; padding:12px 16px; border-top:1px solid var(--dsw-alias-border-l1); }
.px-v4-drawer-create,.px-v4-drawer-actions { display:flex; gap:8px; align-items:center; }
.px-v4-drawer-create .px-input { flex:1 1 auto; }
.px-v4-panel-list,.px-v4-team-list,.px-v4-panel-evidence,.px-v4-knob-list,.px-v4-audit-list { display:grid; gap:6px; list-style:none; margin:0; padding:0; }
.px-v4-run-row { display:flex; align-items:center; justify-content:space-between; gap:10px; width:100%; padding:9px 10px; border:1px solid transparent; background:transparent; color:inherit; text-align:left; cursor:pointer; }
.px-v4-run-row:hover,.px-v4-run-row.is-selected { border-color:var(--dsw-alias-border-l2); background:var(--dsw-alias-bg-layer-1); }
.px-v4-run-main { display:grid; min-width:0; gap:2px; }
.px-v4-run-main strong { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:var(--px-fs-2); }
.px-v4-run-main span,.px-v4-panel-latest { color:var(--dsw-alias-label-secondary); font-size:var(--px-fs-3); }
.px-v4-team-panel { display:grid; gap:10px; }
.px-v4-team-member { display:grid; grid-template-columns:10px 1fr auto; gap:9px; align-items:start; padding:10px 0; border-bottom:1px solid var(--dsw-alias-border-l1); }
.px-v4-team-member-copy { display:grid; gap:2px; min-width:0; }
.px-v4-team-member-copy strong { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:var(--px-fs-2); }
.px-v4-team-member-copy span,.px-v4-team-state { color:var(--dsw-alias-label-secondary); font-size:var(--px-fs-3); }
.px-v4-team-task { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.px-v4-panel-evidence-row { display:grid; grid-template-columns:1fr auto; gap:5px 10px; padding:10px; border:1px solid transparent; background:transparent; color:inherit; text-align:left; cursor:pointer; }
.px-v4-panel-evidence-row:hover { border-color:var(--dsw-alias-border-l2); background:var(--dsw-alias-bg-layer-1); }
.px-v4-panel-evidence-row strong { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:var(--px-fs-2); }
.px-v4-panel-evidence-row .px-v4-panel-latest { grid-column:1 / -1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.px-v4-audit-row { display:grid; grid-template-columns:58px 1fr; gap:10px; padding:8px 0; border-bottom:1px solid var(--dsw-alias-border-l1); }
.px-v4-audit-row time { color:var(--dsw-alias-label-secondary); font-size:var(--px-fs-3); }
.px-v4-audit-row div { display:grid; gap:2px; }
.px-v4-audit-row strong,.px-v4-audit-row span { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:var(--px-fs-2); }
.px-v4-audit-row span { color:var(--dsw-alias-label-secondary); font-size:var(--px-fs-3); }
.px-v4-knob-row { display:grid; gap:6px; padding:10px 0; border-bottom:1px solid var(--dsw-alias-border-l1); }
.px-v4-knob-head { display:flex; justify-content:space-between; gap:8px; font-size:var(--px-fs-2); }
.px-v4-knob-head span { color:var(--dsw-alias-label-secondary); font-variant-numeric:tabular-nums; }
.px-v4-knob-row input[type="range"] { width:100%; accent-color:var(--dsw-alias-brand-primary); }
@media (max-width:700px) { .px-v4-drawer { width:100%; } .px-v4-drawer-actions { flex-wrap:wrap; } }
`;

/* ===== 60-shell.js ===== */
/* Shell v4: research cockpit. Run bar + gate rail + branch board + evidence band.
 * Contract: docs/praxis/redesign/20-rewrite-brief.md §4, §9, §10. */

function ShellCatalog(snapshot) {
  return snapshot?.catalog ?? {
    states: [], stateActions: {}, actions: [], reasons: [], blockerLabels: {}, eventLabels: {},
  };
}

function ShellStateMeta(catalog, stateId) {
  return (catalog.states ?? []).find((item) => item.id === stateId) ?? null;
}

function ShellActionMeta(catalog, actionId) {
  return (catalog.actions ?? []).find((item) => item.id === actionId) ?? null;
}

function ShellNextAction(catalog, run) {
  if (!run) return null;
  return catalog.stateActions?.[run.state] ?? run.nextAction ?? null;
}

function ShellRunBar(props) {
  const { store, active, team, catalog, onPrimary, onOpenDrawer, onNewRun, overlayOpen } = props;
  const stateMeta = ShellStateMeta(catalog, active?.state);
  const states = catalog.states ?? [];
  const index = Math.max(0, states.findIndex((item) => item.id === active?.state)) + 1;
  const total = states.length || 12;
  const actionId = ShellNextAction(catalog, active);
  const label = ShellActionMeta(catalog, actionId)?.label ?? '继续';
  const members = team?.members ?? [];
  const running = team?.counts?.running ?? 0;
  const degraded = store.phase === 'error' || Boolean(store.conflict);
  const teamText = team?.source === 'live'
    ? `团队 ${members.length} 人 · 运行中 ${running}`
    : '尚未组建团队';

  return h('header', { className: 'px-runbar', 'data-testid': 'runbar' },
    h('div', { className: 'px-runbar-left' },
      h('div', { className: 'px-brand' },
        h('span', { className: 'px-mark', 'aria-hidden': true }),
        h('span', { className: 'px-brand-name' }, 'Praxis')),
      active
        ? h('div', { className: 'px-run-id' },
          h('span', { className: 'px-run-title', title: active.title }, PrimShort(active.title, 30)),
          h(PrimChip, { tone: 'active' }, stateMeta?.label ?? active.state),
          h('span', { className: 'px-run-version' }, `v${active.version}`))
        : h('span', { className: 'px-run-title' }, '未选择运行')),
    h('div', { className: 'px-runbar-center' },
      active ? h('div', { className: 'px-progress', 'data-testid': 'progress' },
        h('span', { className: 'px-progress-track' },
          h('span', { className: 'px-progress-fill', style: { width: `${Math.round((index / total) * 100)}%` } })),
        h('span', { className: 'px-progress-text' }, `${index}/${total}`)) : null,
      h('button', {
        type: 'button',
        className: `px-team-chip${team?.source === 'live' ? ' is-live' : ''}`,
        'data-testid': 'team-chip',
        'data-source': team?.source ?? 'none',
        title: teamText,
        onClick: () => onOpenDrawer('team'),
      },
      h('span', { className: 'px-team-dot', 'data-running': running > 0 ? 'true' : 'false', 'aria-hidden': true }),
      h('span', null, teamText))),
    h('div', { className: 'px-runbar-right' },
      overlayOpen ? null : active ? h(PrimBtn, {
        tone: 'primary',
        'data-testid': 'primary',
        'data-action-id': actionId ?? '',
        disabled: store.busy > 0 || degraded,
        title: degraded ? '数据过期或服务不可用，先处理提示' : `执行：${label}`,
        onClick: () => onPrimary(actionId),
      }, label) : null,
      h(PrimMenu, {
        label: '更多',
        items: [
          { id: 'runs', label: '运行列表', onClick: () => onOpenDrawer('runs') },
          { id: 'team', label: '团队', onClick: () => onOpenDrawer('team') },
          { id: 'evidence', label: '证据总览', onClick: () => onOpenDrawer('evidence') },
          { id: 'audit', label: '审计时间线', onClick: () => onOpenDrawer('audit') },
          { id: 'knobs', label: '超参数（fork）', onClick: () => onOpenDrawer('knobs') },
          active ? null : { id: 'new', label: '新建运行', onClick: onNewRun },
        ].filter(Boolean),
      })));
}

function ShellApp() {
  const store = StoreUse();
  const snapshot = store.snapshot;
  const catalog = ShellCatalog(snapshot);
  const active = snapshot?.active ?? null;
  const allBranches = snapshot?.branches ?? active?.branches ?? [];
  // The default placeholder branch is noise once real branches exist.
  const branches = allBranches.length > 1
    ? allBranches.filter((branch) => !(branch.id === 'b_main' && !branch.evidenceCount))
    : allBranches;
  const team = snapshot?.team ?? null;
  const gates = snapshot?.gates ?? [];
  const evidenceRows = snapshot?.evidenceRows ?? [];
  const [selection, setSelection] = useState(null);
  const [drawer, setDrawer] = useState(null);
  const [report, setReport] = useState('');
  useEffect(() => {
    if (!report) return undefined;
    const timer = setTimeout(() => setReport(''), 6000);
    return () => clearTimeout(timer);
  }, [report]);
  const [newRun, setNewRun] = useState(null);

  const kind = selection?.kind ?? null;
  const selectedBranch = kind === 'branch' ? branches.find((item) => item.id === selection.id) ?? null : null;
  const selectedMember = kind === 'member' ? (team?.members ?? []).find((item) => item.id === selection.id) ?? null : null;
  const selectedEvidence = kind === 'evidence' ? evidenceRows.find((item) => item.claimId === selection.id) ?? null : null;

  useEffect(() => { if (!active) setSelection(null); }, [active?.id]);

  useEffect(() => {
    const onKey = (event) => {
      if (event.key !== 'Escape') return;
      if (newRun) { setNewRun(null); return; }
      if (drawer) { setDrawer(null); return; }
      if (selection) setSelection(null);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [newRun, drawer, selection]);

  async function submitAction(action, payload) {
    if (!action) return null;
    const receipt = await StoreSend(action, payload ?? {});
    if (receipt?.status === 'committed' || receipt?.status === 'replayed') {
      setReport(`${ShellActionMeta(catalog, action)?.label ?? action}：已提交`);
      await StoreRefresh();
    }
    return receipt;
  }

  function onPrimary(actionId) {
    if (!actionId) return;
    const meta = ShellActionMeta(catalog, actionId);
    if (meta?.payload === 'none') { void submitAction(actionId, {}); return; }
    setSelection(null);
    setDrawer('action');
  }

  function openDrawer(id) {
    setSelection(null);
    setDrawer(id);
  }

  const banner = (() => {
    if (store.conflict) {
      return h(PrimBanner, {
        tone: 'warn',
        onDismiss: () => StoreDismissConflict(),
        action: h(PrimBtn, { onClick: () => void StoreRefresh(), className: 'px-bar-ghost' }, '刷新'),
      }, `数据已更新，本次操作未提交：${store.conflict}`);
    }
    if (store.error) return h(PrimBanner, { tone: 'bad' }, store.error);
    if (report) return h(PrimBanner, { tone: 'ok', onDismiss: () => setReport('') }, report);
    return null;
  })();

  if (!snapshot) {
    const failed = store.phase === 'error';
    return h('section', {
      className: 'px-shell',
      'data-praxis': 'app',
      'data-testid': 'praxis-shell',
      'data-scene': failed ? 'error' : 'loading',
    },
    h('style', null, CssText),
    h('div', { className: 'px-boot', 'data-testid': failed ? 'error' : 'loading' },
      failed
        ? h(PrimEmpty, {
          title: '无法连接 Praxis 服务',
          hint: store.error || '本地回环 API 不可用。',
          action: h(PrimBtn, { tone: 'primary', onClick: () => void StoreRefresh() }, '重试'),
        })
        : h('div', { className: 'px-boot-wait' },
          h('p', { className: 'px-boot-hint', 'data-testid': 'loading-hint' }, '正在连接 Praxis 服务…'),
          h(PrimSkeleton, { rows: 4 }))));
  }

  return h('section', {
    className: 'px-shell',
    'data-praxis': 'app',
    'data-testid': 'praxis-shell',
    'data-scene': active ? 'run' : 'empty',
  },
  h('style', null, CssText),
  h(ShellRunBar, {
    store, active, team, catalog,
    onPrimary,
    onOpenDrawer: openDrawer,
    onNewRun: () => setNewRun({ title: '', playbookId: snapshot?.playbooks?.[0]?.id ?? 'scientific-loop' }),
    overlayOpen: Boolean(drawer || newRun || selection),
  }),
  banner ? h('div', { className: 'px-banner-slot', 'data-testid': 'banner' }, banner) : null,
  h('div', { className: 'px-cockpit' },
    h('aside', { className: 'px-v4-rail', 'aria-label': '门禁' },
      active
        ? h(CanvasGateRail, { gates, currentStage: active.state, onSelect: () => {} })
        : h('div', { className: 'px-rail-empty' }, '运行建立后显示门禁')),
    h('main', { className: 'px-v4-board', 'aria-label': '探究分支' },
      active
        ? h(CanvasBranchBoard, {
          branches,
          members: team?.members ?? [],
          events: active?.events ?? [],
          selectedBranchId: selectedBranch?.id ?? null,
          onSelect: (branchId) => setSelection({ kind: 'branch', id: branchId }),
          onOpenBranch: (branchId) => setSelection({ kind: 'branch', id: branchId }),
          onCreateBranch: () => setDrawer('action'),
          onSelectBranch: (branchId) => setSelection({ kind: 'branch', id: branchId }),
          timeline: snapshot?.timeline ?? active?.events ?? [],
        })
        : h('div', { className: 'px-empty-stage', 'data-testid': 'empty' },
          h(PrimEmpty, {
            title: '还没有研究运行',
            hint: '新建运行后，把假设拆成并行分支，交给团队成员各自推进。',
            action: h(PrimBtn, {
              tone: 'primary',
              'data-testid': 'empty-primary',
              onClick: () => setNewRun({ title: '', playbookId: snapshot?.playbooks?.[0]?.id ?? 'scientific-loop' }),
            }, '新建研究运行'),
          }))),
    selection && (selectedBranch || selectedMember || selectedEvidence)
      ? h(InspectPanel, {
        selection,
        run: { ...active, team },
        branch: selectedBranch,
        member: selectedMember,
        evidenceRow: selectedEvidence,
        catalog,
        onAction: submitAction,
        onClose: () => setSelection(null),
      })
      : null),
  h('footer', { className: 'px-v4-band', 'aria-label': '证据带' },
    h(CanvasEvidenceBand, {
      rows: evidenceRows,
      selectedClaimId: kind === 'evidence' ? selection.id : null,
      onSelect: (claimId) => setSelection({ kind: 'evidence', id: claimId }),
    })),
  drawer ? h(ShellDrawer, {
    id: drawer,
    snapshot,
    active,
    catalog,
    team,
    evidenceRows,
    onClose: () => setDrawer(null),
    onSelectRun: async (runId) => { setDrawer(null); await StoreActivate(runId); },
    onAction: submitAction,
    onCreateRun: async (payload) => {
      setDrawer(null);
      const receipt = await StoreStartRun(payload?.title ?? '未命名研究', payload?.playbookId ?? snapshot?.playbooks?.[0]?.id);
      if (receipt?.status === 'committed') setSelection(null);
    },
    onFork: async (knobs) => StoreSend('set_knobs', { knobs }, { force: false }),
  }) : null,
  newRun ? h(PrimModal, {
    title: '新建研究运行',
    onClose: () => setNewRun(null),
    actions: h('div', { className: 'px-row' },
      h(PrimBtn, { onClick: () => setNewRun(null) }, '取消'),
      h(PrimBtn, {
        tone: 'primary',
        onClick: async () => {
          const payload = { title: newRun.title.trim() || '未命名研究', playbookId: newRun.playbookId };
          setNewRun(null);
          const receipt = await StoreStartRun(payload.title, payload.playbookId);
          if (receipt?.status === 'committed') setSelection(null);
        },
      }, '创建')),
  },
  h(PrimField, { label: '研究标题' },
    h(PrimInput, {
      value: newRun.title, autoFocus: true, placeholder: '例如：结构增益是否来自算子结构',
      onChange: (event) => setNewRun({ ...newRun, title: event.target.value }),
    })),
  h(PrimField, { label: '剧本' },
    h(PrimSelect, {
      value: newRun.playbookId,
      options: (snapshot?.playbooks ?? []).map((item) => [item.id, item.title ?? item.id]),
      onChange: (event) => setNewRun({ ...newRun, playbookId: event.target.value }),
    }))) : null);
}

function ShellDrawer(props) {
  const { id, snapshot, active, catalog, team, evidenceRows, onClose, onSelectRun, onAction, onCreateRun, onFork } = props;
  if (id === 'runs') {
    return h(PanelRuns, {
      runs: snapshot?.runs ?? [],
      activeRunId: snapshot?.activeRunId,
      onSelectRun,
      onCreateRun,
      onClose,
    });
  }
  if (id === 'team') return h(PanelTeam, { team, onClose });
  if (id === 'evidence') return h(PanelEvidence, { rows: evidenceRows, onSelect: onClose, onClose });
  if (id === 'audit') return h(PanelAudit, { run: active, onClose });
  if (id === 'knobs') return h(PanelKnobs, { knobs: snapshot?.knobs, fields: snapshot?.knobFields, onFork, onClose });
  if (id === 'action') {
    return h(InspectPanel, {
      selection: { kind: 'run', id: active?.id },
      run: { ...active, team },
      branch: null,
      member: null,
      evidenceRow: null,
      catalog,
      onAction,
      onClose,
    });
  }
  return null;
}

function ShellDock() {
  const store = StoreUse();
  const snapshot = store.snapshot;
  const active = snapshot?.active;
  const catalog = ShellCatalog(snapshot);
  const team = snapshot?.team ?? null;
  if (!active) {
    return h('span', { className: 'px-dock', 'data-praxis': 'dock', role: 'status' },
      h('i', { 'aria-hidden': true }), 'Praxis · 无运行');
  }
  const stateMeta = ShellStateMeta(catalog, active.state);
  const branches = snapshot?.branches ?? [];
  const running = branches.filter((branch) => branch.status === 'active').length;
  const parts = [stateMeta?.label ?? active.state];
  if (branches.length) parts.push(`${branches.length} 分支`);
  if (running) parts.push(`${running} 进行中`);
  if (team?.source === 'live') parts.push(`团队 ${team.members.length}`);
  return h('span', {
    className: 'px-dock',
    'data-praxis': 'dock',
    role: 'status',
    title: `${active.title} · v${active.version}`,
  }, h('i', { 'aria-hidden': true }), parts.join(' · '));
}

function ShellSidebar() {
  const store = StoreUse();
  const snapshot = store.snapshot;
  if (!snapshot) return h('div', { className: 'px-side' }, h(PrimSkeleton, { rows: 3 }));
  const runs = snapshot.runs ?? [];
  const catalog = ShellCatalog(snapshot);
  return h('div', { className: 'px-side' },
    h('div', { className: 'px-side-head' },
      h('span', { className: 'px-side-title' }, 'Praxis'),
      h('span', { className: 'px-side-count' }, `${runs.length}`)),
    h('ul', { className: 'px-side-list' },
      runs.slice().reverse().map((run) => h('li', { key: run.id },
        h('button', {
          type: 'button',
          className: `px-side-run${run.id === snapshot.activeRunId ? ' is-on' : ''}`,
          onClick: () => void StoreActivate(run.id),
          title: run.title,
        },
        h('span', { className: 'px-side-name' }, PrimShort(run.title, 18)),
        h('span', { className: 'px-side-state' }, ShellStateMeta(catalog, run.state)?.label ?? run.state))))));
}

function ShellIcon({ size = 20, active: isActive = false }) {
  return h('svg', {
    width: size, height: size, viewBox: '0 0 24 24', 'aria-hidden': true,
    fill: 'none', stroke: isActive ? 'var(--dsw-alias-brand-primary)' : 'currentColor',
    strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round',
  },
  h('circle', { cx: 8, cy: 12, r: 3 }),
  h('circle', { cx: 16, cy: 8, r: 2.2 }),
  h('circle', { cx: 16, cy: 16, r: 2.2 }),
  h('path', { d: 'M10.8 10.6 13.9 9M10.8 13.4 13.9 15' }));
}

function praxisPlugin() {
  return {
    inject: ['slots'],
    apply(ctx) {
      ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
        name: 'sidebar.panellist', id: 'praxis', order: 35, label: 'Praxis',
      }, ShellIcon));
      ctx.slots.inject('main', () => ctx.slots.register({
        name: 'main', key: 'praxis',
      }, ShellApp));
      ctx.slots.inject('conversation.input.dock', () => ctx.slots.register({
        name: 'conversation.input.dock', id: 'praxis', order: 40, label: 'Praxis',
      }, ShellDock));
    },
  };
}

/* ===== 70-css.js ===== */
/* Design system + shell + primitives styles. Prefix Css*. Theme tokens only. */

const CssBase = `
.px-shell {
  --px-fs-1: 13px;
  --px-fs-2: 11.5px;
  --px-fs-3: 10px;
  --px-radius: 8px;
  --px-gap: 8px;
  color: var(--dsw-alias-label-primary);
  background: var(--dsw-alias-bg-base);
  font: 13px/1.5 ui-sans-serif, -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
  font-variant-numeric: tabular-nums;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}
.px-shell *, .px-dock, .px-dock * { box-sizing: border-box; }
.px-shell h1, .px-shell h2, .px-shell h3, .px-shell p { margin: 0; }
.px-shell button { font: inherit; color: inherit; }
.px-shell :focus-visible, .px-dock:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: 2px; }

/* ---------- run bar ---------- */
.px-runbar {
  flex: 0 0 60px;
  height: 60px;
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 0 16px;
  border-bottom: 1px solid var(--dsw-alias-border-l1);
  background: var(--dsw-alias-bg-base);
  min-width: 0;
}
.px-runbar-left { display: flex; align-items: center; gap: 14px; min-width: 0; flex: 1 1 auto; }
.px-runbar-center { display: flex; align-items: center; gap: 14px; flex: 0 0 auto; }
.px-runbar-right { display: flex; align-items: center; gap: 8px; flex: 0 0 auto; }
.px-brand { display: flex; align-items: center; gap: 8px; flex: 0 0 auto; }
.px-brand-name { font-size: var(--px-fs-1); font-weight: 600; letter-spacing: .01em; }
.px-mark { width: 18px; height: 18px; border: 1px solid var(--dsw-alias-border-l2); border-radius: 50%; position: relative; display: inline-block; flex: none; }
.px-mark::before, .px-mark::after { content: ""; position: absolute; background: var(--dsw-alias-brand-primary); }
.px-mark::before { left: 50%; top: 3px; bottom: 3px; width: 1px; }
.px-mark::after { top: 50%; left: 3px; right: 3px; height: 1px; }
.px-run-id { display: flex; align-items: center; gap: 8px; min-width: 0; }
.px-run-title { font-size: var(--px-fs-1); max-width: 260px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.px-run-version { font-size: var(--px-fs-3); color: var(--dsw-alias-label-secondary); }
.px-progress { display: flex; align-items: center; gap: 8px; }
.px-progress-track { width: 96px; height: 4px; border-radius: 2px; background: var(--dsw-alias-border-l1); overflow: hidden; display: inline-block; }
.px-progress-fill { display: block; height: 100%; background: var(--dsw-alias-brand-primary); transition: width .2s ease; }
.px-progress-text { font-size: var(--px-fs-3); color: var(--dsw-alias-label-secondary); }
.px-modes { display: inline-flex; border: 1px solid var(--dsw-alias-border-l1); border-radius: 6px; overflow: hidden; }
.px-mode { border: 0; background: transparent; padding: 4px 12px; font-size: var(--px-fs-2); cursor: pointer; color: var(--dsw-alias-label-secondary); }
.px-mode.is-on { background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-primary); font-weight: 560; }
.px-bar-ghost { background: transparent; border-color: transparent; color: var(--dsw-alias-label-secondary); }
.px-runbar-reason { font-size: var(--px-fs-3); color: var(--dsw-alias-state-warn-primary); max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* ---------- buttons / fields / chips ---------- */
.px-btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  height: 30px; padding: 0 12px; border-radius: 6px;
  border: 1px solid var(--dsw-alias-border-l2);
  background: transparent; color: var(--dsw-alias-label-primary);
  font-size: var(--px-fs-2); cursor: pointer; white-space: nowrap;
  transition: background .14s ease, border-color .14s ease;
}
.px-btn:hover:not(:disabled) { background: var(--dsw-alias-bg-layer-2); }
.px-btn:disabled { opacity: .45; cursor: not-allowed; }
.px-btn.primary { background: var(--dsw-alias-brand-primary); border-color: var(--dsw-alias-brand-primary); color: var(--dsw-alias-bg-base); font-weight: 560; }
.px-btn.primary:hover:not(:disabled) { filter: brightness(1.08); }
.px-btn.danger { border-color: var(--dsw-alias-state-error-primary); color: var(--dsw-alias-state-error-primary); }
.px-btn.active { border-color: var(--dsw-alias-brand-primary); color: var(--dsw-alias-brand-primary); }
.px-btn.block { width: 100%; }
.px-icon-btn { border: 0; background: transparent; cursor: pointer; font-size: 16px; line-height: 1; padding: 2px 6px; color: var(--dsw-alias-label-secondary); border-radius: 4px; }
.px-icon-btn:hover { background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-primary); }
.px-row { display: flex; gap: 8px; align-items: center; justify-content: flex-end; }

.px-field { display: grid; gap: 4px; }
.px-field-label { display: flex; align-items: baseline; gap: 6px; font-size: var(--px-fs-3); color: var(--dsw-alias-label-secondary); letter-spacing: .02em; }
.px-field-label em { font-style: normal; opacity: .7; }
.px-field-error { font-size: var(--px-fs-3); color: var(--dsw-alias-state-error-primary); }
.px-field.has-error .px-input { border-color: var(--dsw-alias-state-error-primary); }
.px-input {
  width: 100%; min-height: 30px; padding: 5px 8px;
  border: 1px solid var(--dsw-alias-border-l1); border-radius: 6px;
  background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-label-primary);
  font: inherit; font-size: var(--px-fs-2);
}
.px-input:focus { border-color: var(--dsw-alias-brand-primary); outline: none; }
.px-area { resize: vertical; min-height: 62px; line-height: 1.5; }
.px-input::placeholder { color: var(--dsw-alias-label-secondary); opacity: .7; }

.px-chip {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 1px 7px; border-radius: 999px; border: 1px solid var(--dsw-alias-border-l1);
  font-size: var(--px-fs-3); color: var(--dsw-alias-label-secondary); white-space: nowrap;
}
.px-chip.active { color: var(--dsw-alias-brand-primary); border-color: var(--dsw-alias-brand-primary); }
.px-chip.ok { color: var(--dsw-alias-state-success-primary); border-color: var(--dsw-alias-state-success-primary); }
.px-chip.warn { color: var(--dsw-alias-state-warn-primary); border-color: var(--dsw-alias-state-warn-primary); }
.px-chip.bad { color: var(--dsw-alias-state-error-primary); border-color: var(--dsw-alias-state-error-primary); }

.px-banner-slot { position: absolute; left: 50%; top: 10px; transform: translateX(-50%); z-index: 30; max-width: min(640px, calc(100% - 48px)); width: max-content; }
.px-banner-slot:empty { display: none; }
.px-banner {
  display: flex; align-items: center; gap: 10px;
  padding: 7px 12px; border-radius: 6px; font-size: var(--px-fs-2);
  border: 1px solid var(--dsw-alias-border-l1); background: var(--dsw-alias-bg-layer-1);
}
.px-banner.warn { border-color: var(--dsw-alias-state-warn-primary); color: var(--dsw-alias-state-warn-primary); }
.px-banner.bad { border-color: var(--dsw-alias-state-error-primary); color: var(--dsw-alias-state-error-primary); }
.px-banner.ok { border-color: var(--dsw-alias-state-success-primary); color: var(--dsw-alias-state-success-primary); }
.px-banner-text { flex: 1 1 auto; }
.px-banner-x { border: 0; background: transparent; cursor: pointer; color: inherit; opacity: .7; font-size: 14px; }

/* ---------- menu / tabs / modal ---------- */
.px-menu { position: relative; }
.px-menu-trigger { gap: 4px; }
.px-menu-caret { font-size: 9px; opacity: .7; }
.px-menu-list {
  position: absolute; right: 0; top: calc(100% + 6px); min-width: 176px; z-index: 40;
  background: var(--dsw-alias-bg-overlay); border: 1px solid var(--dsw-alias-border-l1);
  border-radius: var(--px-radius); padding: 4px; box-shadow: 0 12px 28px rgb(0 0 0 / .18);
  display: grid; gap: 1px;
}
.px-menu-item {
  display: flex; justify-content: space-between; gap: 10px; align-items: center;
  border: 0; background: transparent; text-align: left; cursor: pointer;
  padding: 6px 8px; border-radius: 5px; font-size: var(--px-fs-2); color: var(--dsw-alias-label-primary);
}
.px-menu-item:hover { background: var(--dsw-alias-bg-layer-2); }
.px-menu-item.danger { color: var(--dsw-alias-state-error-primary); }
.px-menu-item em { font-style: normal; font-size: var(--px-fs-3); color: var(--dsw-alias-label-secondary); }
.px-tabs { display: inline-flex; gap: 2px; border-bottom: 1px solid var(--dsw-alias-border-l1); }
.px-tab { border: 0; background: transparent; padding: 6px 10px; font-size: var(--px-fs-2); color: var(--dsw-alias-label-secondary); cursor: pointer; border-bottom: 2px solid transparent; }
.px-tab.is-on { color: var(--dsw-alias-label-primary); border-bottom-color: var(--dsw-alias-brand-primary); }
.px-modal-scrim { position: fixed; inset: 0; background: rgb(0 0 0 / .32); display: grid; place-items: center; z-index: 60; }
.px-modal { width: 420px; max-width: calc(100vw - 32px); background: var(--dsw-alias-bg-overlay); border: 1px solid var(--dsw-alias-border-l1); border-radius: 10px; box-shadow: 0 24px 64px rgb(0 0 0 / .28); overflow: hidden; }
.px-modal.wide { width: 640px; }
.px-modal-head { display: flex; align-items: center; justify-content: space-between; padding: 12px 14px; border-bottom: 1px solid var(--dsw-alias-border-l1); }
.px-modal-head h2 { font-size: var(--px-fs-1); font-weight: 600; }
.px-modal-body { padding: 14px; display: grid; gap: 12px; }
.px-modal-foot { padding: 10px 14px; border-top: 1px solid var(--dsw-alias-border-l1); }
.px-kv { display: grid; gap: 6px; margin: 0; }
.px-kv-row { display: grid; grid-template-columns: 96px 1fr; gap: 10px; }
.px-kv dt { font-size: var(--px-fs-3); color: var(--dsw-alias-label-secondary); }
.px-kv dd { margin: 0; font-size: var(--px-fs-2); }

/* ---------- cockpit grid ---------- */
.px-cockpit {
  flex: 1 1 auto;
  min-height: 0;
  display: grid;
  grid-template-columns: 200px minmax(0, 1fr) auto;
  gap: 0;
  overflow: hidden;
}
.px-v4-rail { border-right: 1px solid var(--dsw-alias-border-l1); overflow: auto; min-height: 0; }
.px-v4-board { position: relative; overflow: hidden; min-height: 0; display: flex; flex-direction: column; }
.px-cockpit > [data-testid="inspector"] { position: absolute; }
.px-cockpit { position: relative; }
.px-cockpit > .px-inspector, .px-cockpit > .px-v4-inspector {
  position: absolute; right: 0; top: 0; bottom: 0; width: 360px; z-index: 12;
}
.px-v4-band { flex: 0 0 148px; border-top: 1px solid var(--dsw-alias-border-l1); overflow: auto; }
.px-rail-empty { padding: 16px; font-size: var(--px-fs-2); color: var(--dsw-alias-label-secondary); }
.px-empty-stage { position: absolute; inset: 0; display: grid; place-items: center; padding: 24px; }

/* run bar team chip */
.px-team-chip {
  display: inline-flex; align-items: center; gap: 6px;
  height: 26px; padding: 0 10px; border-radius: 999px;
  border: 1px solid var(--dsw-alias-border-l1); background: transparent;
  font-size: var(--px-fs-3); color: var(--dsw-alias-label-secondary); cursor: pointer;
  white-space: nowrap;
}
.px-team-chip:hover { background: var(--dsw-alias-bg-layer-2); }
.px-team-chip.is-live { color: var(--dsw-alias-label-primary); border-color: var(--dsw-alias-border-l2); }
.px-team-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--dsw-alias-label-secondary); opacity: .5; }
.px-team-dot[data-running="true"] { background: var(--px-ok, var(--dsw-alias-state-success-primary)); opacity: 1; }

/* ---------- skeleton / empty / glyph ---------- */
.px-skeleton { display: grid; gap: 10px; padding: 18px 0; width: 100%; }
.px-skeleton-row {
  display: block; height: 12px; border-radius: 6px;
  background: color-mix(in oklab, var(--dsw-alias-border-l2) 45%, var(--dsw-alias-bg-layer-1));
  border: 1px solid var(--dsw-alias-border-l1);
  animation: px-pulse 1.4s ease-in-out infinite;
}
.px-skeleton-row:nth-child(2) { width: 78%; }
.px-skeleton-row:nth-child(3) { width: 56%; }
@keyframes px-pulse { 0%, 100% { opacity: .45; } 50% { opacity: .9; } }
.px-boot { display: grid; place-items: center; height: 100%; padding: 24px; }
.px-boot-wait { display: grid; gap: 10px; justify-items: stretch; width: min(420px, 100%); }
.px-boot-hint { font-size: var(--px-fs-2); color: var(--dsw-alias-label-secondary); text-align: center; }
.px-empty { display: grid; gap: 8px; place-items: center; text-align: center; padding: 18px; }
.px-empty-title { font-size: var(--px-fs-1); font-weight: 560; }
.px-empty-hint { font-size: var(--px-fs-2); color: var(--dsw-alias-label-secondary); max-width: 320px; }
.px-glyph { display: inline-flex; align-items: center; justify-content: center; width: 14px; height: 14px; border-radius: 50%; font-size: 9px; line-height: 1; flex: none; border: 1px solid currentColor; }
.px-glyph.done { background: currentColor; color: var(--dsw-alias-bg-base); }
.px-glyph.blocked { border-radius: 3px; }
.px-glyph.failed { border-radius: 3px; }
.px-glyph.pending { border-style: dashed; }
.px-glyph.active { background: currentColor; color: var(--dsw-alias-bg-base); }

/* ---------- dock / sidebar panel ---------- */
.px-dock {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 11px; color: var(--dsw-alias-label-secondary);
  border: 1px solid var(--dsw-alias-border-l1); border-radius: 999px; padding: 1px 8px;
  background: transparent; white-space: nowrap;
}
.px-dock.warn { color: var(--dsw-alias-state-warn-primary); border-color: currentColor; }
.px-dock i { width: 5px; height: 5px; border-radius: 50%; background: currentColor; }
.px-side { display: flex; flex-direction: column; gap: 8px; padding: 10px; min-height: 0; font-size: var(--px-fs-2); }
.px-side-head { display: flex; align-items: baseline; justify-content: space-between; padding: 0 4px; }
.px-side-title { font-size: var(--px-fs-1); font-weight: 600; }
.px-side-count { font-size: var(--px-fs-3); color: var(--dsw-alias-label-secondary); }
.px-side-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 2px; overflow: auto; }
.px-side-run { display: flex; justify-content: space-between; gap: 8px; width: 100%; border: 1px solid transparent; background: transparent; border-radius: 5px; padding: 5px 8px; cursor: pointer; text-align: left; }
.px-side-run:hover { background: var(--dsw-alias-bg-layer-2); }
.px-side-run.is-on { border-color: var(--dsw-alias-border-l2); background: var(--dsw-alias-bg-layer-1); }
.px-side-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.px-side-state { font-size: var(--px-fs-3); color: var(--dsw-alias-label-secondary); flex: none; }

/* ---------- canvas ---------- */
.px-canvas { position: absolute; inset: 0; overflow: hidden; outline: none;
  background-image: radial-gradient(circle, var(--dsw-alias-border-l1) 1px, transparent 1px);
  background-size: 18px 18px; }
.px-canvas-world { position: absolute; left: 0; top: 0; transform-origin: 0 0; will-change: transform; }
.px-canvas-svg { position: absolute; left: 0; top: 0; overflow: visible; pointer-events: none; }
.px-lane-label { position: absolute; font-size: var(--px-fs-2); letter-spacing: .08em; color: var(--dsw-alias-label-secondary); white-space: nowrap; }
.px-edge { fill: none; stroke: var(--dsw-alias-border-l2); stroke-width: 1.2; }
.px-edge[data-execution="done"] { stroke: var(--dsw-alias-state-success-primary); }
.px-edge[data-execution="active"] { stroke: var(--dsw-alias-brand-primary); stroke-width: 1.6; }
.px-edge[data-execution="blocked"] { stroke: var(--dsw-alias-state-warn-primary); stroke-dasharray: 3 3; }
.px-edge[data-execution="failed"] { stroke: var(--dsw-alias-state-error-primary); stroke-dasharray: 4 3; }
.px-edge[data-draft="true"] { stroke-dasharray: 5 4; }
.px-node {
  position: absolute; width: 156px; height: 64px;
  display: flex; flex-direction: column; justify-content: center; gap: 1px;
  padding: 7px 10px; border: 1px solid var(--dsw-alias-border-l2); border-radius: 7px;
  background: var(--dsw-alias-bg-layer-1); cursor: pointer; user-select: none;
  transition: border-color .12s ease, box-shadow .12s ease;
}
.px-node[data-type="gate"] { border-style: dashed; }
.px-node[data-type="start"], .px-node[data-type="end"] { border-color: var(--dsw-alias-border-l1); }
.px-node[data-execution="done"] { border-color: var(--dsw-alias-state-success-primary); }
.px-node[data-execution="active"] { border-color: var(--dsw-alias-brand-primary); box-shadow: 0 0 0 1px var(--dsw-alias-brand-primary) inset; }
.px-node[data-execution="blocked"] { border-color: var(--dsw-alias-state-warn-primary); border-style: dashed; }
.px-node[data-execution="failed"] { border-color: var(--dsw-alias-state-error-primary); box-shadow: inset 0 0 0 2px var(--dsw-alias-state-error-primary); }
.px-node[data-current="true"]::before {
  content: ""; position: absolute; left: -1px; top: 9px; bottom: 9px; width: 3px;
  border-radius: 2px; background: var(--dsw-alias-brand-primary);
}
.px-node[data-selected="true"] { outline: 2px dashed var(--dsw-alias-label-secondary); outline-offset: 3px; }
.px-node[data-execution="done"] .px-node-glyph { color: var(--dsw-alias-state-success-primary); }
.px-node[data-execution="active"] .px-node-glyph { color: var(--dsw-alias-brand-primary); }
.px-node[data-execution="blocked"] .px-node-glyph { color: var(--dsw-alias-state-warn-primary); }
.px-node[data-execution="failed"] .px-node-glyph { color: var(--dsw-alias-state-error-primary); }
.px-node[data-execution="pending"] .px-node-glyph { color: var(--dsw-alias-label-secondary); opacity: .8; }
.px-node-title { display: flex; align-items: center; gap: 5px; font-size: 12.5px; font-weight: 600; line-height: 1.25; }
.px-node-title span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.px-node-sub { font-size: 11px; color: var(--dsw-alias-label-secondary); line-height: 1.3; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.px-node-chip { display: inline-flex; align-items: center; gap: 3px; font-size: 10px; color: var(--dsw-alias-label-secondary); line-height: 1.3; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.px-node-chip[data-condition="satisfied"] { color: var(--dsw-alias-state-success-primary); }
.px-node-chip[data-condition="missing"] { color: var(--dsw-alias-state-warn-primary); }
.px-node-chip[data-condition="stale"] { color: var(--dsw-alias-state-error-primary); }
.px-node-badge { position: absolute; right: 7px; top: 6px; font-size: 9px; letter-spacing: .04em; color: var(--dsw-alias-brand-primary); }
.px-port { position: absolute; width: 10px; height: 10px; border-radius: 50%; border: 1px solid var(--dsw-alias-border-l2); background: var(--dsw-alias-bg-base); cursor: crosshair; padding: 0; }
.px-port-in { left: -5px; top: 50%; margin-top: -5px; }
.px-port-out { right: -5px; top: 50%; margin-top: -5px; }
.px-canvas-tools {
  position: absolute; right: 12px; bottom: 12px; display: flex; align-items: center; gap: 4px;
  background: var(--dsw-alias-bg-overlay); border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 6px; padding: 3px; z-index: 6;
}
.px-canvas-tools .px-btn { height: 24px; padding: 0 8px; font-size: var(--px-fs-3); border-color: transparent; }
.px-zoom { display: flex; align-items: center; gap: 4px; }
.px-zoom-text { min-width: 38px; text-align: center; font-size: var(--px-fs-3); color: var(--dsw-alias-label-secondary); }
.px-canvas-draft { font-size: var(--px-fs-3); color: var(--dsw-alias-state-warn-primary); padding: 0 6px; }

/* ---------- inspector ---------- */
.px-inspector {
  position: absolute; right: 12px; top: 12px; bottom: 12px; width: 360px;
  display: flex; flex-direction: column; z-index: 10;
  background: var(--dsw-alias-bg-overlay); border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 10px; box-shadow: 0 16px 40px rgb(0 0 0 / .18); overflow: hidden;
}
.px-inspector-head { display: flex; align-items: flex-start; gap: 8px; padding: 12px 12px 8px; border-bottom: 1px solid var(--dsw-alias-border-l1); }
.px-inspector-title { flex: 1 1 auto; display: grid; gap: 4px; min-width: 0; }
.px-inspector-title strong { font-size: var(--px-fs-1); font-weight: 600; }
.px-inspector-close { flex: none; }
.px-inspector-body { flex: 1 1 auto; overflow: auto; padding: 12px; display: grid; gap: 12px; align-content: start; }
.px-inspector-foot { border-top: 1px solid var(--dsw-alias-border-l1); padding: 10px 12px; }
.px-inspector-actions { display: flex; gap: 8px; justify-content: flex-end; }
.px-action-form { display: grid; gap: 10px; }
.px-action-error { font-size: var(--px-fs-3); color: var(--dsw-alias-state-error-primary); }
.px-state-duo { display: flex; gap: 6px; flex-wrap: wrap; }

/* ---------- drawer ---------- */
.px-drawer {
  position: absolute; right: 0; top: 0; bottom: 0; width: 480px; z-index: 20;
  display: flex; flex-direction: column;
  background: var(--dsw-alias-bg-overlay); border-left: 1px solid var(--dsw-alias-border-l1);
  box-shadow: -16px 0 40px rgb(0 0 0 / .16);
}
.px-drawer-head { display: flex; align-items: center; gap: 8px; padding: 12px 14px; border-bottom: 1px solid var(--dsw-alias-border-l1); }
.px-drawer-head strong { flex: 1 1 auto; font-size: var(--px-fs-1); }
.px-drawer-body { flex: 1 1 auto; overflow: auto; padding: 14px; display: grid; gap: 12px; align-content: start; }
.px-drawer-foot { border-top: 1px solid var(--dsw-alias-border-l1); padding: 10px 14px; display: flex; gap: 8px; justify-content: flex-end; }
.px-drawer-close { flex: none; }

/* ---------- map / knobs / audit / evidence / runs ---------- */
.px-map { position: relative; display: grid; gap: 10px; }
.px-map-legend { display: flex; gap: 12px; flex-wrap: wrap; font-size: var(--px-fs-3); color: var(--dsw-alias-label-secondary); }
.px-map-node { border: 1px solid var(--dsw-alias-border-l2); border-radius: 6px; padding: 7px 9px; font-size: var(--px-fs-2); }
.px-map-node[data-status="unknown"] { border-style: dashed; color: var(--dsw-alias-label-secondary); }
.px-map-node[data-status="supported"] { border-color: var(--dsw-alias-state-success-primary); }
.px-map-node[data-status="contradicted"] { border-color: var(--dsw-alias-state-error-primary); color: var(--dsw-alias-state-error-primary); }
.px-map-node[data-status="obsolete"] { text-decoration: line-through; opacity: .6; }
.px-map-frontier { border-left: 2px solid var(--dsw-alias-state-warn-primary); padding-left: 8px; }
.px-knob { display: grid; gap: 4px; }
.px-knob-head { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; font-size: var(--px-fs-2); }
.px-knob-range { width: 100%; accent-color: var(--dsw-alias-brand-primary); }
.px-knob-hint { font-size: var(--px-fs-3); color: var(--dsw-alias-label-secondary); }
.px-audit-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
.px-audit-item { display: grid; grid-template-columns: 46px 92px 1fr; gap: 8px; font-size: var(--px-fs-2); border-bottom: 1px solid var(--dsw-alias-border-l1); padding-bottom: 5px; }
.px-audit-time { color: var(--dsw-alias-label-secondary); font-size: var(--px-fs-3); }
.px-audit-kind { color: var(--dsw-alias-label-secondary); font-size: var(--px-fs-3); }
.px-audit-violation { border-left: 2px solid var(--dsw-alias-state-error-primary); padding-left: 8px; font-size: var(--px-fs-2); color: var(--dsw-alias-state-error-primary); }
.px-evidence { display: grid; gap: 8px; }
.px-evidence-row { display: grid; grid-template-columns: 110px 1fr; gap: 8px; font-size: var(--px-fs-2); border-bottom: 1px solid var(--dsw-alias-border-l1); padding-bottom: 6px; }
.px-evidence-gap { color: var(--dsw-alias-state-warn-primary); font-size: var(--px-fs-3); }
.px-runs { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; }
.px-run-item { display: flex; justify-content: space-between; gap: 8px; width: 100%; padding: 7px 9px; border: 1px solid transparent; border-radius: 6px; background: transparent; cursor: pointer; text-align: left; }
.px-run-item:hover { background: var(--dsw-alias-bg-layer-2); }
.px-run-item.is-on { border-color: var(--dsw-alias-border-l2); background: var(--dsw-alias-bg-layer-1); }
.px-run-item-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.px-run-item-state { font-size: var(--px-fs-3); color: var(--dsw-alias-label-secondary); flex: none; }
.px-table { width: 100%; border-collapse: collapse; font-size: var(--px-fs-2); }
.px-table th { text-align: left; font-size: var(--px-fs-3); color: var(--dsw-alias-label-secondary); font-weight: 500; padding: 4px 6px; border-bottom: 1px solid var(--dsw-alias-border-l1); }
.px-table td { padding: 5px 6px; border-bottom: 1px solid var(--dsw-alias-border-l1); vertical-align: top; }

/* ---------- responsive ---------- */
@media (max-width: 1180px) {
  .px-progress-track { width: 48px; }
  .px-run-title { max-width: 160px; }
  .px-run-version { display: none; }
  .px-runbar { gap: 10px; padding: 0 12px; }
  .px-runbar-reason { display: none; }
  .px-inspector { left: 12px; right: 12px; top: auto; bottom: 12px; width: auto; max-height: 46vh; }
  .px-drawer { width: 100%; }
}
@media (max-width: 900px) {
  .px-runbar { gap: 8px; padding: 0 10px; }
  .px-runbar-center { display: none; }
  .px-brand-name { display: none; }
}
`;

const CssText = [
  CssBase,
  typeof CanvasCss === 'string' ? CanvasCss : '',
  typeof InspectCss === 'string' ? InspectCss : '',
  typeof PanelsCss === 'string' ? PanelsCss : '',
].join('\n');
    return praxisPlugin();
  },
});
