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
/* =============================================================================
 * 20-layout.js — Praxis v2 泳道布局 / 正交连线 / 视口适配
 * 契约来源：docs/praxis/redesign/10-v2-contract.md §2.1（T5.1）、§4.2（B1/B2）、§5.1
 *
 * 约定：
 * - 顶层标识符全部 Layout* 前缀（B1），不使用 var / import / export。
 * - 节点坐标以 Host 给出的 graph.nodes[i].position 为准（§2.1 冻结公式），
 *   本模块只做分组、排序、包围盒与几何路径；不改写 Host 坐标。
 * - 泳道按 position.y 的语义行归属：laneIndex = round((y - laneStartY) / laneGapY)，
 *   因此 Host 如何把 n_prereg 之类的边界节点归入泳道，客户端都不需要硬编码成员表。
 * =========================================================================== */

const LayoutConstants = Object.freeze({
  nodeW: 156,
  nodeH: 64,
  gapX: 28,
  laneStartX: 24,
  laneStartY: 40,
  laneGapY: 120,
});

const LayoutLanes = Object.freeze([
  Object.freeze({ id: 'define', label: '定义问题', index: 0 }),
  Object.freeze({ id: 'explore', label: '探索与执行', index: 1 }),
  Object.freeze({ id: 'converge', label: '证据与决策', index: 2 }),
]);

const LayoutLanePadY = 14;          // 泳道带上下留白（band 高度 = nodeH + 2*pad）
const LayoutLaneRightPad = 24;      // 泳道带右侧留白
const LayoutFitMinScale = 0.75;     // D5-2 宽画布（≥900）缩放下限
const LayoutFitNarrowBreakpoint = 900;   // canvasWidth < 900 视为窄画布
const LayoutFitNarrowMinScale = 0.62;    // 窄画布下限（700×600 静止 15/15 可见）
const LayoutFitNarrowPadding = 16;       // 窄画布适配时每侧留白（对应 (W-32)）
const LayoutFitMaxScale = 1.0;      // 适配缩放上限：默认 100% 清晰
const LayoutFitDefaultPadding = 32;
const LayoutDefaultViewport = Object.freeze({ width: 1160, height: 640 });
const LayoutRoundRadius = 10;       // 跨泳道路径圆角半径（§5 要求 10）
const LayoutLeftChannelX = 18;      // 左回环通道：10px 标签(2..12) 与节点左边(24) 之间
const LayoutRightChannelPad = 20;   // 右回环通道：内容右边界之外 20px
const LayoutEntryInset = 10;        // 跨泳道进入目标左侧的水平进入段长度

function LayoutClamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function LayoutRound1(value) {
  return Math.round(value * 10) / 10;
}

function LayoutIsFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

/** position.y → 泳道行；超出范围的坐标夹到首/末泳道。 */
function LayoutLaneIndexForY(y) {
  if (!LayoutIsFiniteNumber(y)) return 0;
  const raw = Math.round((y - LayoutConstants.laneStartY) / LayoutConstants.laneGapY);
  return LayoutClamp(raw, 0, LayoutLanes.length - 1);
}

/** 节点泳道归属：显式 lane/laneIndex 优先，否则用 Host 给的位置推导。 */
function LayoutLaneIndexOfNode(node, fallbackIndex) {
  if (!node) return fallbackIndex;
  if (Number.isInteger(node.laneIndex)) return LayoutClamp(node.laneIndex, 0, LayoutLanes.length - 1);
  if (Number.isInteger(node.lane)) return LayoutClamp(node.lane, 0, LayoutLanes.length - 1);
  if (typeof node.lane === 'string') {
    const found = LayoutLanes.findIndex(function (lane) { return lane.id === node.lane; });
    if (found >= 0) return found;
  }
  const position = node.position;
  if (position && LayoutIsFiniteNumber(position.y)) return LayoutLaneIndexForY(position.y);
  return fallbackIndex;
}

/** 统一矩形输入：{x,y,w,h} 或 {position:{x,y}} 或节点对象。 */
function LayoutNodeRect(input) {
  const fallback = { x: 0, y: 0, w: LayoutConstants.nodeW, h: LayoutConstants.nodeH };
  if (!input || typeof input !== 'object') return fallback;
  const raw = input.position && LayoutIsFiniteNumber(input.position.x) ? input.position : input;
  const x = LayoutIsFiniteNumber(raw.x) ? raw.x : 0;
  const y = LayoutIsFiniteNumber(raw.y) ? raw.y : 0;
  const w = LayoutIsFiniteNumber(raw.w) ? raw.w : LayoutConstants.nodeW;
  const h = LayoutIsFiniteNumber(raw.h) ? raw.h : LayoutConstants.nodeH;
  return { x: x, y: y, w: w, h: h };
}

/** 包围盒归一化：接受 {minX..} 或 {x,y,w,h}；空输入返回 0 尺寸盒。 */
function LayoutNormalizeBounds(bounds) {
  if (!bounds || typeof bounds !== 'object') {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
  }
  if (LayoutIsFiniteNumber(bounds.minX) && LayoutIsFiniteNumber(bounds.minY)) {
    const minX = bounds.minX;
    const minY = bounds.minY;
    const maxX = LayoutIsFiniteNumber(bounds.maxX) ? bounds.maxX : minX;
    const maxY = LayoutIsFiniteNumber(bounds.maxY) ? bounds.maxY : minY;
    return {
      minX: minX,
      minY: minY,
      maxX: maxX,
      maxY: maxY,
      width: Math.max(0, maxX - minX),
      height: Math.max(0, maxY - minY),
    };
  }
  if (LayoutIsFiniteNumber(bounds.x) && LayoutIsFiniteNumber(bounds.y)) {
    const width = LayoutIsFiniteNumber(bounds.w) ? bounds.w : 0;
    const height = LayoutIsFiniteNumber(bounds.h) ? bounds.h : 0;
    return { minX: bounds.x, minY: bounds.y, maxX: bounds.x + width, maxY: bounds.y + height, width: width, height: height };
  }
  return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
}

/** 视口归一化；缺省用 1160×640 验收视口（§0 D5 / 本任务断言视口）。 */
function LayoutNormalizeViewport(viewport) {
  const source = viewport && typeof viewport === 'object' ? viewport : {};
  const width = LayoutIsFiniteNumber(source.width) && source.width > 0 ? source.width : LayoutDefaultViewport.width;
  const height = LayoutIsFiniteNumber(source.height) && source.height > 0 ? source.height : LayoutDefaultViewport.height;
  return { width: width, height: height };
}

/**
 * LayoutCompute(graph) → { positions, lanes, bounds }
 * - positions：{ [nodeId]: {x,y} }，直接采用 Host 坐标；缺失坐标按泳道公式补位。
 * - lanes：3 条泳道带，nodeIds 按 x 升序（同 x 保持图数组顺序）。
 * - bounds：节点包围盒（不含泳道留白），供 LayoutFit / 相机使用。
 */
function LayoutCompute(graph) {
  const { nodeW, nodeH, gapX, laneStartX, laneStartY, laneGapY } = LayoutConstants;
  const nodes = graph && Array.isArray(graph.nodes) ? graph.nodes : [];
  const positions = {};
  const buckets = LayoutLanes.map(function () { return []; });

  for (let order = 0; order < nodes.length; order += 1) {
    const node = nodes[order];
    if (!node || typeof node.id !== 'string' || !node.id) continue;
    const laneIndex = LayoutLaneIndexOfNode(node, 0);
    const bucket = buckets[laneIndex];
    if (Object.prototype.hasOwnProperty.call(positions, node.id)) continue;
    const position = node.position;
    const hasPosition = position && LayoutIsFiniteNumber(position.x) && LayoutIsFiniteNumber(position.y);
    const x = hasPosition ? position.x : laneStartX + bucket.length * (nodeW + gapX);
    const y = hasPosition ? position.y : laneStartY + laneIndex * laneGapY;
    positions[node.id] = { x: x, y: y };
    bucket.push({ id: node.id, x: x, order: order });
  }

  const ids = Object.keys(positions);
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < ids.length; i += 1) {
    const point = positions[ids[i]];
    if (point.x < minX) minX = point.x;
    if (point.y < minY) minY = point.y;
    if (point.x + nodeW > maxX) maxX = point.x + nodeW;
    if (point.y + nodeH > maxY) maxY = point.y + nodeH;
  }
  if (!ids.length) {
    minX = 0;
    minY = 0;
    maxX = 0;
    maxY = 0;
  }

  const laneWidth = Math.max(laneStartX + nodeW, maxX + LayoutLaneRightPad);
  const lanes = LayoutLanes.map(function (lane) {
    const members = buckets[lane.index].slice().sort(function (a, b) {
      if (a.x !== b.x) return a.x - b.x;
      return a.order - b.order;
    });
    return {
      id: lane.id,
      label: lane.label,
      index: lane.index,
      nodeIds: members.map(function (member) { return member.id; }),
      x: 0,
      y: laneStartY + lane.index * laneGapY - LayoutLanePadY,
      w: laneWidth,
      h: nodeH + LayoutLanePadY * 2,
    };
  });

  return {
    positions: positions,
    lanes: lanes,
    bounds: { minX: minX, minY: minY, maxX: maxX, maxY: maxY, width: maxX - minX, height: maxY - minY },
  };
}

/**
 * LayoutNaturalScale(boundsOrGraph, viewport, padding) → 数字
 * 未夹取的原始适配比例；< LayoutFitMinScale 时调用方进入“视口不足”降级提示。
 */
function LayoutNaturalScale(boundsOrGraph, viewport, padding) {
  const bounds = boundsOrGraph && Array.isArray(boundsOrGraph.nodes)
    ? LayoutCompute(boundsOrGraph).bounds
    : LayoutNormalizeBounds(boundsOrGraph);
  const view = LayoutNormalizeViewport(viewport);
  const pad = LayoutIsFiniteNumber(padding) && padding >= 0 ? padding : LayoutFitDefaultPadding;
  const contentW = Math.max(1, bounds.width);
  const contentH = Math.max(1, bounds.height);
  const availableW = Math.max(1, view.width - pad * 2);
  const availableH = Math.max(1, view.height - pad * 2);
  return Math.min(availableW / contentW, availableH / contentH);
}

/**
 * LayoutFit(boundsOrGraph, viewport, padding) → { scale, x, y }
 * 屏幕坐标 = 内容坐标 * scale + {x,y}。scale ∈ [0.5, 1.0]（§2.1 / §5.1：默认 100% 全览）。
 * 兼容契约 §4.2 的 LayoutFit(graph, viewport) 形式：传入 graph 时内部先 LayoutCompute。
 */
function LayoutFit(boundsOrGraph, viewport, padding) {
  const bounds = boundsOrGraph && Array.isArray(boundsOrGraph.nodes)
    ? LayoutCompute(boundsOrGraph).bounds
    : LayoutNormalizeBounds(boundsOrGraph);
  const view = LayoutNormalizeViewport(viewport);
  const pad = LayoutIsFiniteNumber(padding) && padding >= 0 ? padding : LayoutFitDefaultPadding;
  const contentW = Math.max(1, bounds.width);
  const contentH = Math.max(1, bounds.height);
  const availableW = Math.max(1, view.width - pad * 2);
  const availableH = Math.max(1, view.height - pad * 2);
  const rawScale = Math.min(availableW / contentW, availableH / contentH);
  const minScale = view.width < LayoutFitNarrowBreakpoint ? LayoutFitNarrowMinScale : LayoutFitMinScale;
  const scale = LayoutClamp(rawScale, minScale, LayoutFitMaxScale);
  const x = (view.width - contentW * scale) / 2 - bounds.minX * scale;
  const y = (view.height - contentH * scale) / 2 - bounds.minY * scale;
  return { scale: scale, x: x, y: y };
}

/**
 * LayoutFocus(bounds, viewport, nodePosition) → { x, y }
 * 返回内容坐标系里的“相机中心”（需要被放到视口中心的内容点）。不改变 scale——
 * 调用方保持当前 zoom，按 pan = viewport/2 - camera*zoom 平移即可（§5 定位当前）。
 */
function LayoutFocus(bounds, viewport, nodePosition) {
  const box = LayoutNormalizeBounds(bounds);
  const view = LayoutNormalizeViewport(viewport);
  const point = nodePosition && LayoutIsFiniteNumber(nodePosition.x) && LayoutIsFiniteNumber(nodePosition.y)
    ? nodePosition
    : { x: box.minX, y: box.minY };
  const centerX = point.x + LayoutConstants.nodeW / 2;
  const centerY = point.y + LayoutConstants.nodeH / 2;
  return {
    x: LayoutClamp(centerX, box.minX, box.maxX),
    y: LayoutClamp(centerY, box.minY, box.maxY),
  };
}

/**
 * LayoutClampCamera(camera, bounds, viewport, scale) → { x, y }
 * 相机中心夹取（“定位当前”依赖它）：
 * - 内容大于视口：不允许把视口移出内容（保留 half viewport 边界）；
 * - 内容小于视口：允许相机中心在内容包围盒内移动，这样 LayoutFocus 能把任意节点
 *   精确放到视口中心；未交互时调用方传 null，回落到包围盒中心（整图居中）。
 */
function LayoutClampCamera(camera, bounds, viewport, scale) {
  const box = LayoutNormalizeBounds(bounds);
  const view = LayoutNormalizeViewport(viewport);
  const zoom = LayoutIsFiniteNumber(scale) && scale > 0 ? scale : 1;
  const centerX = box.minX + box.width / 2;
  const centerY = box.minY + box.height / 2;
  const sourceX = camera && LayoutIsFiniteNumber(camera.x) ? camera.x : centerX;
  const sourceY = camera && LayoutIsFiniteNumber(camera.y) ? camera.y : centerY;
  const halfW = view.width / (2 * zoom);
  const halfH = view.height / (2 * zoom);
  let x = sourceX;
  let y = sourceY;
  if (box.width <= halfW * 2) x = LayoutClamp(sourceX, box.minX, box.maxX);
  else x = LayoutClamp(sourceX, box.minX + halfW, box.maxX - halfW);
  if (box.height <= halfH * 2) y = LayoutClamp(sourceY, box.minY, box.maxY);
  else y = LayoutClamp(sourceY, box.minY + halfH, box.maxY - halfH);
  return { x: x, y: y };
}

/** 折线 → 圆角正交路径；每个拐角半径受相邻段长度一半限制，避免倒角互相吃掉。 */
function LayoutRoundPath(points, radius) {
  if (!Array.isArray(points) || points.length < 2) return '';
  const pts = [];
  for (let i = 0; i < points.length; i += 1) {
    const point = points[i];
    if (!point) continue;
    const previous = pts[pts.length - 1];
    if (previous && Math.abs(previous.x - point.x) < 0.01 && Math.abs(previous.y - point.y) < 0.01) continue;
    pts.push({ x: point.x, y: point.y });
  }
  if (pts.length < 2) return '';
  const maxRadius = LayoutIsFiniteNumber(radius) && radius > 0 ? radius : LayoutRoundRadius;
  let d = 'M ' + LayoutRound1(pts[0].x) + ' ' + LayoutRound1(pts[0].y);
  for (let i = 1; i < pts.length - 1; i += 1) {
    const previous = pts[i - 1];
    const current = pts[i];
    const next = pts[i + 1];
    const inLength = Math.hypot(current.x - previous.x, current.y - previous.y);
    const outLength = Math.hypot(next.x - current.x, next.y - current.y);
    const r = Math.max(0, Math.min(maxRadius, inLength / 2, outLength / 2));
    if (r < 0.5) {
      d += ' L ' + LayoutRound1(current.x) + ' ' + LayoutRound1(current.y);
      continue;
    }
    const inX = current.x + ((previous.x - current.x) / inLength) * r;
    const inY = current.y + ((previous.y - current.y) / inLength) * r;
    const outX = current.x + ((next.x - current.x) / outLength) * r;
    const outY = current.y + ((next.y - current.y) / outLength) * r;
    d += ' L ' + LayoutRound1(inX) + ' ' + LayoutRound1(inY);
    d += ' Q ' + LayoutRound1(current.x) + ' ' + LayoutRound1(current.y) + ' ' + LayoutRound1(outX) + ' ' + LayoutRound1(outY);
  }
  const last = pts[pts.length - 1];
  d += ' L ' + LayoutRound1(last.x) + ' ' + LayoutRound1(last.y);
  return d;
}

/**
 * LayoutOrtho(a, b, ctx) → SVG path d
 * - 同泳道正向：三次贝塞尔，dx 严格取两端间隙的一半，控制点不越界（修掉旧实现
 *   dx = max(40, ...) 在 28px 间隙下产生的反 S）。
 * - 同泳道反向/重叠：绕节点下方正交折线。
 * - 跨泳道：右出 → 右侧通道竖直 → 目标泳道上方/下方水平 → 进入目标左侧，
 *   圆角半径 10；水平段只走泳道带之间的空白，不穿过泳道内的节点。
 * ctx 支持：{ rightChannel, leftChannel, radius, portGap, laneA, laneB }
 * portGap > 0 时终点从目标左边再退后 portGap（蓝图态箭头不压端口）。
 */
function LayoutOrtho(a, b, ctx) {
  const rectA = LayoutNodeRect(a);
  const rectB = LayoutNodeRect(b);
  const options = ctx && typeof ctx === 'object' ? ctx : {};
  const radius = LayoutIsFiniteNumber(options.radius) ? options.radius : LayoutRoundRadius;
  const portGap = LayoutIsFiniteNumber(options.portGap) && options.portGap > 0 ? options.portGap : 0;
  const x1 = rectA.x + rectA.w;
  const y1 = rectA.y + rectA.h / 2;
  const x2 = rectB.x - portGap;
  const y2 = rectB.y + rectB.h / 2;
  const laneA = Number.isInteger(options.laneA) ? options.laneA : LayoutLaneIndexForY(rectA.y);
  const laneB = Number.isInteger(options.laneB) ? options.laneB : LayoutLaneIndexForY(rectB.y);

  if (laneA === laneB) {
    const gap = x2 - x1;
    if (gap >= 2) {
      const dx = gap / 2;
      return 'M ' + LayoutRound1(x1) + ' ' + LayoutRound1(y1)
        + ' C ' + LayoutRound1(x1 + dx) + ' ' + LayoutRound1(y1)
        + ', ' + LayoutRound1(x2 - dx) + ' ' + LayoutRound1(y2)
        + ', ' + LayoutRound1(x2) + ' ' + LayoutRound1(y2);
    }
    // 同泳道回边：从下方绕行；所有水平段都落在泳道带外的空白里。
    const bendY = Math.max(rectA.y + rectA.h, rectB.y + rectB.h) + 14;
    const points = [
      { x: x1, y: y1 },
      { x: x1 + 14, y: y1 },
      { x: x1 + 14, y: bendY },
      { x: x2 - 14, y: bendY },
      { x: x2 - 14, y: y2 },
      { x: x2, y: y2 },
    ];
    return LayoutRoundPath(points, Math.min(radius, 8));
  }

  // 跨泳道：右侧通道 → 目标泳道带外的水平通道 → 目标左侧进入。
  const rightChannel = LayoutIsFiniteNumber(options.rightChannel) && options.rightChannel > x1
    ? options.rightChannel
    : Math.max(x1, rectB.x + rectB.w) + LayoutRightChannelPad;
  const targetBelow = laneB > laneA;
  // 水平通道落在两条泳道带之间的空白里（节点上/下留白 14px，再让 7px，避免压在泳道边框上）。
  const approachOffset = LayoutLanePadY + 7;
  const approachY = targetBelow
    ? rectB.y - approachOffset
    : rectB.y + rectB.h + approachOffset;
  const entryX = x2 - LayoutEntryInset;
  const points = [
    { x: x1, y: y1 },
    { x: rightChannel, y: y1 },
    { x: rightChannel, y: approachY },
    { x: entryX, y: approachY },
    { x: entryX, y: y2 },
    { x: x2, y: y2 },
  ];
  return LayoutRoundPath(points, radius);
}

/** 契约 §4.2 的 LayoutCamera(纯函数集)：Fit / Focus / Clamp 三个纯函数。 */
const LayoutCamera = Object.freeze({
  Fit: LayoutFit,
  Natural: LayoutNaturalScale,
  Focus: LayoutFocus,
  Clamp: LayoutClampCamera,
});

/* ===== 30-canvas.js ===== */
/* =============================================================================
 * 30-canvas.js — Praxis v2 只读运行画布 + 蓝图草稿画布
 * 契约来源：docs/praxis/redesign/10-v2-contract.md §4.2（B1）、§5.1–§5.5
 *
 * 结构约定（Lead 词表）：
 * - 容器 .px-canvas / .px-canvas-world / .px-canvas-svg / .px-canvas-tools /
 *   .px-zoom / .px-zoom-text / .px-lane(-0/-1/-2) / .px-lane-label /
 *   .px-node + data-execution|data-selected|data-current|data-type /
 *   .px-node-title / .px-node-sub / .px-node-chip / .px-node-badge / .px-node-glyph /
 *   .px-port(-in/-out) / .px-edge + data-execution|data-port|data-draft /
 *   .px-canvas-draft
 * - 视觉全部进文件末尾 CanvasCss（只使用主题 token），不在组件内注入 <style>。
 * - 节点位置只用 inline transform；尺寸/字体由 CSS 给（156×64）。
 * - 运行态只读：无端口、无拖拽、无 Delete；蓝图态才允许草稿修改。
 * =========================================================================== */

const CanvasEmptyGraph = Object.freeze({ nodes: Object.freeze([]), edges: Object.freeze([]), revision: 0 });

const CanvasSheetBreakpoint = 1180;   // ≤1180 检查器变底部 sheet
const CanvasSheetSafeRatio = 0.40;    // 焦点节点中心超过该比例就可能被 sheet 遮住
const CanvasSheetTargetRatio = 0.30;  // 向上平移后焦点节点落在可视上半区中心
const CanvasInspectorPanelWidth = 360;      // 70-css .px-inspector width
const CanvasInspectorPanelGap = 12;         // 检查器 right:12
const CanvasInspectorNodeGap = 16;          // 节点右缘与检查器至少留 16px
const CanvasNarrowCanvasWidth = 900;        // 画布 <900 视为窄屏（此时检查器是底部 sheet）

const CanvasThemeVars = Object.freeze({
  text: 'var(--dsw-alias-label-primary)',
  secondary: 'var(--dsw-alias-label-secondary)',
  idle: 'var(--dsw-alias-state-idle-primary)',
  border: 'var(--dsw-alias-border-l2)',
  layer: 'var(--dsw-alias-bg-layer-1)',
});

const CanvasExecutionLabels = Object.freeze({
  pending: '等待',
  active: '进行中',
  done: '已完成',
  blocked: '被阻断',
  failed: '需核对',
});

const CanvasExecutionOrder = Object.freeze(['pending', 'active', 'done', 'blocked', 'failed']);

const CanvasConditionLabels = Object.freeze({
  missing: '契约缺失',
  satisfied: '契约已冻结',
  stale: '继承待确认',
  unknown: '条件待确认',
});

const CanvasStageLabels = Object.freeze({
  intake: '立项',
  question: '提出问题',
  prereg: '预注册',
  discussion: '讨论',
  synthesis: '综合',
  'exec-ready': '准备执行',
  experiment: '执行实验',
  review: '审查',
  stage4: '阶段四',
  eval: '评估',
  memory: '记忆',
  decision: '决策',
});

const CanvasGateLabels = Object.freeze({
  prereg: '预注册门禁',
  experiment: '执行门禁',
  eval: '评估门禁',
});

const CanvasArtifactLabels = Object.freeze({
  preregHash: '预注册契约',
  artifactHash: '实验产物',
  reviewReport: '审查报告',
  evalReportHash: '评估报告',
  memoryCommit: '记忆提交',
  decisionRecord: '决策记录',
});

const CanvasDefaultNodeState = Object.freeze({ execution: 'pending', condition: 'unknown', reason: null });

function CanvasClamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function CanvasEmptyDraft() {
  return { positions: {}, addedEdges: [], removedNodeIds: [], removedEdgeIds: [] };
}

/** 底部 sheet 的真实触发条件 = 窗口宽度 ≤1180（70-css @media max-width:1180px），与画布宽度无关。 */
function CanvasWindowMatchesNarrow() {
  try {
    if (typeof window === 'undefined') return false;
    if (typeof window.matchMedia === 'function') return window.matchMedia('(max-width: ' + CanvasSheetBreakpoint + 'px)').matches === true;
    return typeof window.innerWidth === 'number' && window.innerWidth < CanvasSheetBreakpoint;
  } catch (error) {
    return false;
  }
}

function CanvasEmptyLayout() {
  const laneW = LayoutConstants.laneStartX + 5 * (LayoutConstants.nodeW + LayoutConstants.gapX);
  const lanes = LayoutLanes.map(function (lane) {
    return {
      id: lane.id,
      label: lane.label,
      index: lane.index,
      nodeIds: [],
      x: 0,
      y: LayoutConstants.laneStartY + lane.index * LayoutConstants.laneGapY - 14,
      w: laneW,
      h: LayoutConstants.nodeH + 28,
    };
  });
  const top = lanes[0].y;
  const bottom = lanes[lanes.length - 1].y + lanes[lanes.length - 1].h;
  return {
    positions: {},
    lanes: lanes,
    bounds: { minX: 0, minY: top, maxX: laneW, maxY: bottom, width: laneW, height: bottom - top },
  };
}

/** 图签名：轮询拿到新对象但内容未变时，不触发布局/边重建。 */
function CanvasGraphSignature(graph) {
  if (!graph || typeof graph !== 'object') return 'empty';
  const nodes = Array.isArray(graph.nodes) ? graph.nodes : [];
  const edges = Array.isArray(graph.edges) ? graph.edges : [];
  const nodeParts = [];
  for (let i = 0; i < nodes.length; i += 1) {
    const node = nodes[i];
    if (!node) continue;
    const config = node.config && typeof node.config === 'object' ? node.config : {};
    const position = node.position && typeof node.position === 'object' ? node.position : null;
    nodeParts.push([
      node.id,
      node.type,
      node.stage || '',
      config.gate || config.guards || '',
      node.label || '',
      position ? position.x : '',
      position ? position.y : '',
      node.lane === undefined ? '' : node.lane,
      node.laneIndex === undefined ? '' : node.laneIndex,
    ].join('|'));
  }
  const edgeParts = [];
  for (let i = 0; i < edges.length; i += 1) {
    const edge = edges[i];
    if (!edge) continue;
    edgeParts.push([edge.id, edge.from, edge.to, edge.port || ''].join('|'));
  }
  const revision = graph.revision === undefined ? '' : String(graph.revision);
  return revision + '::' + nodeParts.join(';') + '@' + edgeParts.join(';');
}

/** 状态签名：执行/条件/原因任一变化才重算边颜色与节点解剖。 */
function CanvasStatesSignature(states) {
  if (!states || typeof states !== 'object') return '';
  const ids = Object.keys(states).sort();
  const parts = [];
  for (let i = 0; i < ids.length; i += 1) {
    const id = ids[i];
    const value = states[id];
    if (typeof value === 'string') parts.push(id + '=' + value);
    else if (value && typeof value === 'object') parts.push(id + '=' + [value.execution || '', value.condition || '', value.reason || ''].join('/'));
    else parts.push(id + '=');
  }
  return parts.join(';');
}

function CanvasNormalizeExecution(value) {
  return CanvasExecutionOrder.indexOf(value) >= 0 ? value : 'pending';
}

function CanvasNormalizeStates(states) {
  const normalized = {};
  if (!states || typeof states !== 'object') return normalized;
  const ids = Object.keys(states);
  for (let i = 0; i < ids.length; i += 1) {
    const id = ids[i];
    const value = states[id];
    if (typeof value === 'string') {
      normalized[id] = { execution: CanvasNormalizeExecution(value), condition: 'unknown', reason: null };
      continue;
    }
    if (value && typeof value === 'object') {
      normalized[id] = {
        execution: CanvasNormalizeExecution(value.execution),
        condition: typeof value.condition === 'string' && value.condition ? value.condition : 'unknown',
        reason: typeof value.reason === 'string' && value.reason ? value.reason : null,
      };
    }
  }
  return normalized;
}

function CanvasCatalogMap(list) {
  const map = {};
  if (!Array.isArray(list)) return map;
  for (let i = 0; i < list.length; i += 1) {
    const item = list[i];
    if (item && typeof item.id === 'string' && typeof item.label === 'string' && item.label) map[item.id] = item.label;
  }
  return map;
}

function CanvasExecutionLabel(execution, catalogExecutionMap) {
  if (catalogExecutionMap && catalogExecutionMap[execution]) return catalogExecutionMap[execution];
  return CanvasExecutionLabels[execution] || CanvasExecutionLabels.pending;
}

function CanvasConditionLabel(condition, gateKind, catalogConditionMap) {
  if (catalogConditionMap && catalogConditionMap[condition]) return catalogConditionMap[condition];
  if (gateKind && gateKind !== 'prereg') {
    const generic = { missing: '条件缺失', satisfied: '条件已满足', stale: '继承待确认', unknown: '条件待确认' };
    if (generic[condition]) return generic[condition];
  }
  return CanvasConditionLabels[condition] || CanvasConditionLabels.unknown;
}

function CanvasNodeGateKind(node) {
  if (!node || node.type !== 'gate') return null;
  const config = node.config && typeof node.config === 'object' ? node.config : {};
  return config.gate || config.guards || null;
}

function CanvasNodeStageKey(node) {
  if (!node) return null;
  if (typeof node.stage === 'string' && node.stage) return node.stage;
  const config = node.config && typeof node.config === 'object' ? node.config : {};
  return config.guards || config.gate || null;
}

/**
 * 中文明标签（文案所有权优先 Host catalog）：
 * 1) props.catalog.nodeLabels[node.id]（host 唯一来源，T5.0）；
 * 2) node.label（host 已给的人类可读标签）；
 * 3) 内置阶段/门禁映射兜底。
 * 任何一级都不改变“禁止内部码（gate:prereg / prereg_freeze）出现在节点正文”的约束。
 */
function CanvasNodeLabel(node, nodeLabels) {
  if (!node) return '流程节点';
  if (nodeLabels && typeof nodeLabels === 'object' && typeof node.id === 'string') {
    const catalogLabel = nodeLabels[node.id];
    if (typeof catalogLabel === 'string' && catalogLabel) return catalogLabel;
  }
  const raw = typeof node.label === 'string' ? node.label.trim() : '';
  if (raw && /[\u3400-\u9fff]/.test(raw)) return raw;
  const stageKey = CanvasNodeStageKey(node);
  if (node.type === 'gate') {
    if (stageKey && CanvasGateLabels[stageKey]) return CanvasGateLabels[stageKey];
    return '流程门禁';
  }
  if (node.type === 'stage') {
    if (stageKey && CanvasStageLabels[stageKey]) return CanvasStageLabels[stageKey];
  }
  if (node.type === 'start') return '开始';
  if (node.type === 'end') return '结束';
  if (node.type === 'actor') return '角色';
  if (raw && !/[:：_]/.test(raw)) return raw;
  return '流程节点';
}

function CanvasNodeArtifact(node) {
  if (!node || node.type !== 'stage') return '';
  const config = node.config && typeof node.config === 'object' ? node.config : {};
  const required = Array.isArray(config.requiredArtifacts) ? config.requiredArtifacts : [];
  const names = [];
  for (let i = 0; i < required.length; i += 1) {
    const label = CanvasArtifactLabels[required[i]];
    if (label) names.push(label);
  }
  return names.length ? '产物 · ' + names.join(' / ') : '';
}

function CanvasNodeChip(node, condition, catalogConditionMap) {
  if (!node) return { text: '', condition: '' };
  if (node.type === 'gate') {
    const gateKind = CanvasNodeGateKind(node);
    return { text: CanvasConditionLabel(condition, gateKind, catalogConditionMap), condition: condition };
  }
  const artifact = CanvasNodeArtifact(node);
  if (artifact) return { text: artifact, condition: '' };
  return { text: '', condition: '' };
}

function CanvasIsProtected(node) {
  if (!node || typeof node !== 'object') return true;
  if (node.protected === true) return true;
  if (node.type === 'start' || node.type === 'end') return true;
  if (node.type === 'stage' && typeof node.stage === 'string' && node.stage) return true;
  if (node.type === 'gate' && CanvasNodeGateKind(node)) return true;
  return false;
}

/** §2.2 T6.2：来源是 gate 必须是 contract；目标是 gate → evidence；其余 artifact。 */
function CanvasDerivePort(fromNode, toNode) {
  if (fromNode && fromNode.type === 'gate') return 'contract';
  if (toNode && toNode.type === 'gate') return 'evidence';
  return 'artifact';
}

function CanvasDraftCount(graph, draft) {
  const total = draft.addedEdges.length + draft.removedNodeIds.length + draft.removedEdgeIds.length;
  let count = total;
  const nodes = graph && Array.isArray(graph.nodes) ? graph.nodes : [];
  const byId = new Map();
  for (let i = 0; i < nodes.length; i += 1) if (nodes[i] && nodes[i].id) byId.set(nodes[i].id, nodes[i]);
  const ids = Object.keys(draft.positions);
  for (let i = 0; i < ids.length; i += 1) {
    const id = ids[i];
    const position = draft.positions[id];
    const original = byId.get(id);
    if (!original || !original.position) {
      count += 1;
      continue;
    }
    if (Math.abs(original.position.x - position.x) > 0.5 || Math.abs(original.position.y - position.y) > 0.5) count += 1;
  }
  return count;
}

/** 蓝图草稿基线：进入蓝图时的图快照（父级持有草稿时也能算出真实修改数）。 */
function CanvasSnapshotGraph(graph) {
  const nodes = graph && Array.isArray(graph.nodes) ? graph.nodes : [];
  const edges = graph && Array.isArray(graph.edges) ? graph.edges : [];
  const nodeParts = [];
  for (let i = 0; i < nodes.length; i += 1) {
    const node = nodes[i];
    if (!node || typeof node.id !== 'string') continue;
    const position = node.position && typeof node.position === 'object' ? node.position : { x: 0, y: 0 };
    nodeParts.push({ id: node.id, x: position.x, y: position.y });
  }
  const edgeParts = [];
  for (let i = 0; i < edges.length; i += 1) {
    const edge = edges[i];
    if (!edge) continue;
    edgeParts.push({ key: edge.from + '>' + edge.to + ':' + (edge.port || 'artifact') });
  }
  return { nodes: nodeParts, edges: edgeParts };
}

/** 基线 → 当前图 的结构 diff 计数：节点增删/移动 + 边增删，与 shell 的 diff 语义一致。 */
function CanvasGraphDiffCount(base, current) {
  if (!base || !current) return 0;
  const baseNodes = new Map();
  const currentNodes = new Map();
  for (let i = 0; i < base.nodes.length; i += 1) baseNodes.set(base.nodes[i].id, base.nodes[i]);
  for (let i = 0; i < current.nodes.length; i += 1) {
    const node = current.nodes[i];
    if (node && typeof node.id === 'string') currentNodes.set(node.id, node);
  }
  let count = 0;
  currentNodes.forEach(function (node, id) {
    const old = baseNodes.get(id);
    if (!old) {
      count += 1;
      return;
    }
    const position = node.position && typeof node.position === 'object' ? node.position : { x: 0, y: 0 };
    if (Math.abs(old.x - position.x) > 0.5 || Math.abs(old.y - position.y) > 0.5) count += 1;
  });
  baseNodes.forEach(function (node, id) {
    if (!currentNodes.has(id)) count += 1;
  });
  const baseEdges = new Set();
  const currentEdges = new Set();
  for (let i = 0; i < base.edges.length; i += 1) baseEdges.add(base.edges[i].key);
  for (let i = 0; i < current.edges.length; i += 1) {
    const edge = current.edges[i];
    if (edge) currentEdges.add(edge.from + '>' + edge.to + ':' + (edge.port || 'artifact'));
  }
  currentEdges.forEach(function (key) { if (!baseEdges.has(key)) count += 1; });
  baseEdges.forEach(function (key) { if (!currentEdges.has(key)) count += 1; });
  return count;
}

/** 蓝图草稿叠加到图上：草稿坐标 / 新增边 / 删除节点。纯函数，不改入参。 */
function CanvasApplyDraft(graph, draft) {
  const sourceNodes = graph && Array.isArray(graph.nodes) ? graph.nodes : [];
  const sourceEdges = graph && Array.isArray(graph.edges) ? graph.edges : [];
  const nodes = [];
  const alive = new Set();
  for (let i = 0; i < sourceNodes.length; i += 1) {
    const node = sourceNodes[i];
    if (!node || draft.removedNodeIds.indexOf(node.id) >= 0) continue;
    alive.add(node.id);
    const draftPosition = draft.positions[node.id];
    nodes.push(draftPosition ? Object.assign({}, node, { position: { x: draftPosition.x, y: draftPosition.y } }) : node);
  }
  const edges = [];
  const seen = new Set();
  for (let i = 0; i < sourceEdges.length; i += 1) {
    const edge = sourceEdges[i];
    if (!edge || draft.removedEdgeIds.indexOf(edge.id) >= 0) continue;
    if (!alive.has(edge.from) || !alive.has(edge.to)) continue;
    const key = edge.from + '>' + edge.to;
    if (seen.has(key)) continue;
    seen.add(key);
    edges.push(edge);
  }
  for (let i = 0; i < draft.addedEdges.length; i += 1) {
    const edge = draft.addedEdges[i];
    if (!edge || !alive.has(edge.from) || !alive.has(edge.to)) continue;
    const key = edge.from + '>' + edge.to;
    if (seen.has(key)) continue;
    seen.add(key);
    edges.push(Object.assign({ draft: true }, edge));
  }
  return { nodes: nodes, edges: edges, revision: graph ? graph.revision : 0 };
}

function CanvasExecutionOf(stateMap, id) {
  return stateMap[id] || CanvasDefaultNodeState;
}

/** 边状态：failed > blocked > done > active > pending（契约 §5：done 实线、pending 虚线、blocked warn）。 */
function CanvasEdgeTone(stateMap, fromId, toId) {
  const from = CanvasExecutionOf(stateMap, fromId);
  const to = CanvasExecutionOf(stateMap, toId);
  if (from.execution === 'failed' || to.execution === 'failed') return 'failed';
  if (from.execution === 'blocked' || to.execution === 'blocked') return 'blocked';
  if (to.execution === 'done') return 'done';
  if (from.execution === 'active' || to.execution === 'active') return 'active';
  return 'pending';
}

function CanvasArrowMarkerId(tone) {
  return 'px-arrow-' + tone;
}

/** 方向键空间遍历：优先主方向距离，次方向只做轻微惩罚。 */
function CanvasSpatialNeighbor(models, fromId, direction) {
  let origin = null;
  for (let i = 0; i < models.length; i += 1) {
    if (models[i].id === fromId) {
      origin = models[i];
      break;
    }
  }
  if (!origin) return null;
  let best = null;
  let bestScore = Infinity;
  for (let i = 0; i < models.length; i += 1) {
    const candidate = models[i];
    if (!candidate || candidate.id === fromId) continue;
    const dx = candidate.x - origin.x;
    const dy = candidate.y - origin.y;
    let primary = 0;
    let secondary = 0;
    if (direction === 'left') {
      if (dx > -1) continue;
      primary = -dx;
      secondary = Math.abs(dy);
    } else if (direction === 'right') {
      if (dx < 1) continue;
      primary = dx;
      secondary = Math.abs(dy);
    } else if (direction === 'up') {
      if (dy > -1) continue;
      primary = -dy;
      secondary = Math.abs(dx);
    } else if (direction === 'down') {
      if (dy < 1) continue;
      primary = dy;
      secondary = Math.abs(dx);
    } else {
      continue;
    }
    const score = primary + secondary * 1.6;
    if (score < bestScore) {
      bestScore = score;
      best = candidate;
    }
  }
  return best;
}

function CanvasFocusNodeElement(container, id) {
  if (!container || typeof container.querySelectorAll !== 'function' || !id) return;
  const elements = container.querySelectorAll('[data-canvas-node]');
  for (let i = 0; i < elements.length; i += 1) {
    if (elements[i].getAttribute('data-canvas-node') === id && typeof elements[i].focus === 'function') {
      elements[i].focus();
      return;
    }
  }
}

function CanvasConfirm(message) {
  try {
    if (typeof window !== 'undefined' && typeof window.confirm === 'function') return window.confirm(message) === true;
  } catch (error) {
    return false;
  }
  return false;
}

function CanvasZoomValue(value) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null;
  // 兼容父级传 100（百分比）或 1（倍率）两种约定。
  return value > 3 ? value / 100 : value;
}

function CanvasRound2(value) {
  return Math.round(value * 100) / 100;
}

function CanvasStopPointer(event) {
  if (event && typeof event.stopPropagation === 'function') event.stopPropagation();
}

/** 状态图标（§5.3 形状通道）：active 实心点 / done 实心勾 / blocked 三角 / failed 叉 / pending 空心。 */
function CanvasGlyph(execution) {
  if (execution === 'active') {
    return h('svg', { viewBox: '0 0 12 12', 'aria-hidden': 'true', focusable: 'false' },
      h('circle', { cx: 6, cy: 6, r: 3.6, fill: 'currentColor' }));
  }
  if (execution === 'done') {
    return h('svg', { viewBox: '0 0 12 12', 'aria-hidden': 'true', focusable: 'false' },
      h('circle', { cx: 6, cy: 6, r: 5, fill: 'currentColor' }),
      h('path', { d: 'M3.5 6.2 L5.2 7.9 L8.7 4.2', fill: 'none', strokeWidth: 1.3, strokeLinecap: 'round', strokeLinejoin: 'round', style: { stroke: 'var(--dsw-alias-bg-layer-1)' } }));
  }
  if (execution === 'blocked') {
    return h('svg', { viewBox: '0 0 12 12', 'aria-hidden': 'true', focusable: 'false' },
      h('path', { d: 'M6 1.6 L10.6 10.4 L1.4 10.4 Z', fill: 'currentColor' }),
      h('path', { d: 'M6 4.6 L6 7.2', fill: 'none', strokeWidth: 1.2, strokeLinecap: 'round', style: { stroke: 'var(--dsw-alias-bg-layer-1)' } }),
      h('circle', { cx: 6, cy: 8.7, r: 0.6, style: { fill: 'var(--dsw-alias-bg-layer-1)' } }));
  }
  if (execution === 'failed') {
    return h('svg', { viewBox: '0 0 12 12', 'aria-hidden': 'true', focusable: 'false' },
      h('path', { d: 'M2.7 2.7 L9.3 9.3 M9.3 2.7 L2.7 9.3', fill: 'none', strokeWidth: 1.6, strokeLinecap: 'round', stroke: 'currentColor' }));
  }
  return h('svg', { viewBox: '0 0 12 12', 'aria-hidden': 'true', focusable: 'false' },
    h('circle', { cx: 6, cy: 6, r: 3.4, fill: 'none', strokeWidth: 1.2, stroke: 'currentColor' }));
}

/** 单个节点（DOM 结构固定 3 行：标题 / 状态 / 端口 chip 或产物名）。 */
function CanvasRenderNode(model, mode, handlers, catalog) {
  const node = model.node;
  const execution = model.execution;
  const current = model.current;
  const selected = model.selected;
  const chip = CanvasNodeChip(node, model.condition, catalog.condition);
  const statusText = CanvasExecutionLabel(execution, catalog.execution);
  const ariaParts = [model.label, statusText];
  if (current) ariaParts.push('当前节点');
  if (selected) ariaParts.push('已选中');
  if (mode === 'blueprint' && model.protected) ariaParts.push('受保护节点');
  // D5-3/D5-6：删除 8px 文字角标；current 只保留左轨 + 实心点 + aria-current。
  const children = [
    h('div', { key: 'title', className: 'px-node-title' },
      h('span', { key: 'label', style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0, flex: '1 1 auto' } }, model.label)),
    h('div', { key: 'sub', className: 'px-node-sub' },
      h('span', { key: 'glyph', className: 'px-node-glyph', 'aria-hidden': 'true' }, CanvasGlyph(execution)),
      h('span', { key: 'status', style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, statusText)),
    h('div', {
      key: 'chip',
      className: 'px-node-chip',
      'data-kind': chip.condition ? 'condition' : 'artifact',
      'data-condition': chip.condition || undefined,
      style: chip.text ? undefined : { border: '0', padding: 0, minHeight: '12px' },
    }, chip.text),
  ];
  if (mode === 'blueprint' && node.type !== 'start') {
    children.push(h('button', {
      key: 'port-in',
      type: 'button',
      className: 'px-port px-port-in',
      'data-canvas-port': 'in',
      tabIndex: 0,
      'aria-label': '连接到「' + model.label + '」的输入端口',
      onPointerDown: CanvasStopPointer,
      onClick: function (event) { CanvasStopPointer(event); handlers.onPortClick(event, model, 'in'); },
    }));
  }
  if (mode === 'blueprint' && node.type !== 'end') {
    children.push(h('button', {
      key: 'port-out',
      type: 'button',
      className: 'px-port px-port-out',
      'data-canvas-port': 'out',
      'data-armed': handlers.connectFrom === model.id ? 'true' : undefined,
      tabIndex: 0,
      'aria-label': '从「' + model.label + '」引出连线',
      onPointerDown: CanvasStopPointer,
      onClick: function (event) { CanvasStopPointer(event); handlers.onPortClick(event, model, 'out'); },
    }));
  }
  return h('div', {
    key: model.id,
    className: 'px-node',
    role: 'button',
    tabIndex: 0,
    'data-testid': 'node',
    'data-canvas-node': model.id,
    'data-node-id': model.id,
    'data-execution': execution,
    'data-condition': model.condition || 'unknown',
    'data-selected': selected ? 'true' : 'false',
    'data-current': current ? 'true' : 'false',
    'data-type': node.type || 'stage',
    'data-protected': model.protected ? 'true' : 'false',
    'aria-current': current ? 'true' : undefined,
    'aria-label': ariaParts.join('，') + '。按 Enter 选中，方向键移动',
    'aria-pressed': selected ? 'true' : 'false',
    title: model.reason || model.label,
    style: { transform: 'translate(' + CanvasRound2(model.x) + 'px, ' + CanvasRound2(model.y) + 'px)' },
    onPointerDown: function (event) { handlers.onNodePointerDown(event, model); },
    onPointerMove: function (event) { handlers.onNodePointerMove(event, model); },
    onPointerUp: function (event) { handlers.onNodePointerUp(event, model); },
    onPointerCancel: function (event) { handlers.onNodePointerUp(event, model); },
    onKeyDown: function (event) { handlers.onNodeKeyDown(event, model); },
  }, children);
}

function CanvasRenderEdgeLayer(edgeModels, width, height) {
  const defs = CanvasExecutionOrder.map(function (tone) {
    return h('marker', {
      key: tone,
      id: CanvasArrowMarkerId(tone),
      viewBox: '0 0 8 8',
      refX: 7,
      refY: 4,
      markerWidth: 7,
      markerHeight: 7,
      markerUnits: 'userSpaceOnUse',
      orient: 'auto',
    }, h('path', { className: 'px-arrow px-arrow-' + tone, d: 'M0,0 L8,4 L0,8 Z' }));
  });
  const paths = edgeModels.map(function (edge) {
    return h('path', {
      key: edge.id,
      className: 'px-edge',
      d: edge.d,
      'data-testid': 'edge',
      'data-edge-id': edge.id,
      'data-execution': edge.tone,
      'data-port': edge.port || 'artifact',
      'data-draft': edge.draft ? 'true' : 'false',
      'marker-end': 'url(#' + CanvasArrowMarkerId(edge.tone) + ')',
    });
  });
  return h('svg', {
    className: 'px-canvas-svg',
    width: Math.max(1, Math.round(width)),
    height: Math.max(1, Math.round(height)),
    viewBox: '0 0 ' + Math.max(1, Math.round(width)) + ' ' + Math.max(1, Math.round(height)),
    'aria-hidden': 'true',
    focusable: 'false',
  }, h('defs', null, defs), paths);
}

/**
 * CanvasView(props)
 * props = {
 *   graph, states, current, progress, audit, selectedId, mode: 'run'|'blueprint',
 *   onSelect, onDraftPositions, onSaveBlueprint, onCancelBlueprint, zoom, setZoom,
 *   // 可选：onDraftChange(draft)、onConnect(from,to,port)、onDelete(nodeId)、
 *   //       catalog（view.catalog；状态/条件/节点标签文案来源：nodeExecution/nodeCondition/nodeLabels，缺省用内置中文兜底）
 * }
 * 两种蓝图所有权都支持：
 * - Canvas 自持草稿（不传 onSaveBlueprint/onDelete）：内部 positions/addedEdges/removedNodeIds 生效，
 *   保存时把草稿 payload 交给 onSaveBlueprint。
 * - 父级自持草稿（60-shell 传 graph=editGraph + onDraftPositions/onConnect/onDelete）：
 *   Canvas 只上报变更并做拖拽期本地预览，草稿数值的状态由 parent graph 与进入蓝图时的基线 diff 得出。
 * progress / audit 由运行条与全局横幅负责（§5.1 禁止重复渲染），画布只用 progress 做 aria 摘要。
 */
function CanvasView(props) {
  const raw = props || {};
  const graph = raw.graph && typeof raw.graph === 'object' ? raw.graph : CanvasEmptyGraph;
  const mode = raw.mode === 'blueprint' ? 'blueprint' : 'run';

  const containerRef = useRef(null);
  const [CanvasViewportState, setCanvasViewportState] = useState(function () {
    return { width: LayoutDefaultViewport.width, height: LayoutDefaultViewport.height };
  });
  const [CanvasWindowNarrow, setCanvasWindowNarrow] = useState(CanvasWindowMatchesNarrow);
  const [CanvasCameraState, setCanvasCameraState] = useState(null);
  const [CanvasInternalZoomState, setCanvasInternalZoomState] = useState(null);
  const [CanvasLocalSelectedId, setCanvasLocalSelectedId] = useState(null);
  const [CanvasDraftState, setCanvasDraftState] = useState(CanvasEmptyDraft);
  const [CanvasConnectState, setCanvasConnectState] = useState(null);
  const CanvasDragRef = useRef(null);
  const CanvasPanRef = useRef(null);
  const CanvasBaseGraphRef = useRef(null);
  const CanvasLastGraphSigRef = useRef('');

  useEffect(function () {
    const element = containerRef.current;
    if (!element) return undefined;
    const measure = function () {
      const width = element.clientWidth || LayoutDefaultViewport.width;
      const height = element.clientHeight || LayoutDefaultViewport.height;
      setCanvasViewportState(function (previous) {
        if (Math.abs(previous.width - width) < 1 && Math.abs(previous.height - height) < 1) return previous;
        return { width: width, height: height };
      });
    };
    measure();
    if (typeof ResizeObserver === 'function') {
      const observer = new ResizeObserver(measure);
      observer.observe(element);
      return function () { observer.disconnect(); };
    }
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener('resize', measure);
      return function () { window.removeEventListener('resize', measure); };
    }
    return undefined;
  }, []);

  useEffect(function () {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
    const query = window.matchMedia('(max-width: ' + CanvasSheetBreakpoint + 'px)');
    const update = function (event) { setCanvasWindowNarrow(event && event.matches === true); };
    setCanvasWindowNarrow(query.matches === true);
    if (typeof query.addEventListener === 'function') {
      query.addEventListener('change', update);
      return function () { query.removeEventListener('change', update); };
    }
    if (typeof query.addListener === 'function') {
      query.addListener(update);
      return function () { query.removeListener(update); };
    }
    return undefined;
  }, []);

  useEffect(function () {
    if (mode === 'blueprint') return;
    setCanvasDraftState(CanvasEmptyDraft());
    setCanvasConnectState(null);
    CanvasBaseGraphRef.current = null;
    CanvasLastGraphSigRef.current = '';
  }, [mode]);

  const CanvasGraphSig = useMemo(function () { return CanvasGraphSignature(graph); }, [graph]);
  const CanvasStatesSig = useMemo(function () { return CanvasStatesSignature(raw.states); }, [raw.states]);

  // 进入蓝图时冻结基线：父级自持草稿（60-shell：graph=editGraph）时也能算出真实修改数。
  if (mode === 'blueprint') {
    if (CanvasBaseGraphRef.current === null) CanvasBaseGraphRef.current = CanvasSnapshotGraph(graph);
  } else if (CanvasBaseGraphRef.current !== null) {
    CanvasBaseGraphRef.current = null;
  }
  const CanvasBaseGraph = CanvasBaseGraphRef.current;

  // 父级更新 graph（接受草稿/重置草稿）后，丢弃拖拽期本地预览坐标，以父级 graph 为准。
  useEffect(function () {
    const previous = CanvasLastGraphSigRef.current;
    CanvasLastGraphSigRef.current = CanvasGraphSig;
    if (!previous || previous === CanvasGraphSig) return;
    if (mode !== 'blueprint') return;
    setCanvasDraftState(function (draft) {
      if (!Object.keys(draft.positions).length) return draft;
      return Object.assign({}, draft, { positions: {} });
    });
  }, [CanvasGraphSig, mode]);

  const CanvasEffective = useMemo(function () { return CanvasApplyDraft(graph, CanvasDraftState); }, [CanvasGraphSig, CanvasDraftState]);
  const CanvasDraftChanges = useMemo(function () { return CanvasGraphDiffCount(CanvasBaseGraph, CanvasEffective); }, [CanvasBaseGraph, CanvasEffective]);
  const CanvasLayoutData = useMemo(function () {
    if (!CanvasEffective.nodes.length) return CanvasEmptyLayout();
    return LayoutCompute(CanvasEffective);
  }, [CanvasEffective]);
  const CanvasStateMap = useMemo(function () { return CanvasNormalizeStates(raw.states); }, [CanvasStatesSig]);
  const CanvasCatalog = useMemo(function () {
    const catalog = raw.catalog && typeof raw.catalog === 'object' ? raw.catalog : {};
    const nodeLabels = catalog.nodeLabels && typeof catalog.nodeLabels === 'object' ? catalog.nodeLabels : {};
    return {
      execution: CanvasCatalogMap(catalog.nodeExecution),
      condition: CanvasCatalogMap(catalog.nodeCondition),
      nodeLabels: nodeLabels,
    };
  }, [raw.catalog]);

  // D5-2 / 700×600 静止全览：窄画布（<900）用 16px 侧边留白 + 0.62 下限
  const CanvasFitPadding = CanvasViewportState.width < LayoutFitNarrowBreakpoint ? LayoutFitNarrowPadding : 32;
  const CanvasFit = useMemo(function () {
    return LayoutFit(CanvasLayoutData.bounds, CanvasViewportState, CanvasFitPadding);
  }, [CanvasLayoutData, CanvasViewportState, CanvasFitPadding]);

  const CanvasPropZoom = CanvasZoomValue(raw.zoom);
  const CanvasZoom = CanvasClamp(
    CanvasPropZoom !== null ? CanvasPropZoom : (CanvasInternalZoomState === null ? CanvasFit.scale : CanvasInternalZoomState),
    0.4,
    1.6,
  );
  const CanvasCamera = useMemo(function () {
    const fallback = {
      x: CanvasLayoutData.bounds.minX + CanvasLayoutData.bounds.width / 2,
      y: CanvasLayoutData.bounds.minY + CanvasLayoutData.bounds.height / 2,
    };
    return LayoutClampCamera(CanvasCameraState === null ? fallback : CanvasCameraState, CanvasLayoutData.bounds, CanvasViewportState, CanvasZoom);
  }, [CanvasCameraState, CanvasLayoutData, CanvasViewportState, CanvasZoom]);
  const CanvasBasePanX = CanvasViewportState.width / 2 - CanvasCamera.x * CanvasZoom;
  const CanvasBasePanY = CanvasViewportState.height / 2 - CanvasCamera.y * CanvasZoom;

  const CanvasSelectedId = raw.selectedId !== undefined ? raw.selectedId : CanvasLocalSelectedId;
  const CanvasCurrentId = useMemo(function () {
    if (typeof raw.current === 'string' && raw.current) return raw.current;
    if (typeof graph.current === 'string' && graph.current) return graph.current;
    const ids = Object.keys(CanvasStateMap);
    for (let i = 0; i < ids.length; i += 1) if (CanvasStateMap[ids[i]].execution === 'active') return ids[i];
    for (let i = 0; i < ids.length; i += 1) if (CanvasStateMap[ids[i]].execution === 'blocked') return ids[i];
    return null;
  }, [raw.current, CanvasGraphSig, CanvasStatesSig]);

  // S2-06 / D5-12：≤1180 检查器变底部 sheet 时，把当前/选中节点抬到可视上半区。
  const CanvasSheetFocusId = CanvasSelectedId || CanvasCurrentId;
  const CanvasSheetPosition = CanvasSheetFocusId ? CanvasLayoutData.positions[CanvasSheetFocusId] : null;
  const CanvasSheetActive = mode === 'run'
    && CanvasWindowNarrow
    && (raw.inspectorOpen === undefined ? true : raw.inspectorOpen === true);
  let CanvasSheetOffsetY = 0;
  if (CanvasSheetActive && CanvasSheetPosition) {
    const focusCenterY = CanvasBasePanY + (CanvasSheetPosition.y + LayoutConstants.nodeH / 2) * CanvasZoom;
    if (focusCenterY > CanvasViewportState.height * CanvasSheetSafeRatio) {
      CanvasSheetOffsetY = CanvasViewportState.height * CanvasSheetTargetRatio - focusCenterY;
    }
  }
  // S1-A：inspectorOpen 时（含 1440 宽屏右侧 360px 面板）保证焦点节点不被面板遮住：
  // visibleRight = canvasW - (360 + 12)，节点屏幕右缘超出 visibleRight-16 才左移相机；scale 不变。
  const CanvasInspectorOpen = raw.inspectorOpen === true;
  let CanvasInspectorOffsetX = 0;
  if (CanvasInspectorOpen && CanvasSheetPosition) {
    const visibleRight = CanvasViewportState.width - (CanvasInspectorPanelWidth + CanvasInspectorPanelGap);
    const nodeRight = CanvasBasePanX + (CanvasSheetPosition.x + LayoutConstants.nodeW) * CanvasZoom;
    const limit = visibleRight - CanvasInspectorNodeGap;
    if (nodeRight > limit) CanvasInspectorOffsetX = limit - nodeRight;
  }
  const CanvasPan = { x: CanvasBasePanX + CanvasInspectorOffsetX, y: CanvasBasePanY + CanvasSheetOffsetY };

  // D5-2“视口不足”降级：raw fit < 0.75 时不缩字（scale 夹在 0.75），画布内拖动查看并提示。
  const CanvasNaturalScale = useMemo(function () {
    return LayoutNaturalScale(CanvasLayoutData.bounds, CanvasViewportState, CanvasFitPadding);
  }, [CanvasLayoutData, CanvasViewportState, CanvasFitPadding]);
  // D5-2 降级：rawFit<0.75，或窄画布(<900)，或 world scale<0.85（1024 全应用 0.762 / 700×600 0.75）
  const CanvasViewportInsufficient = CanvasNaturalScale < LayoutFitMinScale - 0.000001
    || CanvasViewportState.width < CanvasNarrowCanvasWidth
    || CanvasZoom < 0.85 - 0.000001;

  const CanvasNodeModels = useMemo(function () {
    const positions = CanvasLayoutData.positions;
    const models = [];
    for (let i = 0; i < CanvasEffective.nodes.length; i += 1) {
      const node = CanvasEffective.nodes[i];
      if (!node || typeof node.id !== 'string') continue;
      const position = positions[node.id] || node.position || { x: 0, y: 0 };
      const state = CanvasExecutionOf(CanvasStateMap, node.id);
      models.push({
        id: node.id,
        node: node,
        x: position.x,
        y: position.y,
        execution: state.execution,
        condition: state.condition,
        reason: state.reason,
        label: CanvasNodeLabel(node, CanvasCatalog.nodeLabels),
        current: node.id === CanvasCurrentId,
        selected: node.id === CanvasSelectedId,
        protected: CanvasIsProtected(node),
      });
    }
    return models;
  }, [CanvasEffective, CanvasLayoutData, CanvasStateMap, CanvasCurrentId, CanvasSelectedId]);

  const CanvasEdgeModels = useMemo(function () {
    const positions = CanvasLayoutData.positions;
    const byId = new Map();
    for (let i = 0; i < CanvasEffective.nodes.length; i += 1) byId.set(CanvasEffective.nodes[i].id, CanvasEffective.nodes[i]);
    const rightChannel = CanvasLayoutData.bounds.maxX + 20;
    const portGap = mode === 'blueprint' ? 8 : 4; // D5-13: 箭头终点在节点边界外 ≥4px；蓝图避开 10px 端口
    const models = [];
    for (let i = 0; i < CanvasEffective.edges.length; i += 1) {
      const edge = CanvasEffective.edges[i];
      const fromPosition = edge ? positions[edge.from] : null;
      const toPosition = edge ? positions[edge.to] : null;
      if (!fromPosition || !toPosition || !byId.get(edge.from) || !byId.get(edge.to)) continue;
      const rectA = { x: fromPosition.x, y: fromPosition.y, w: LayoutConstants.nodeW, h: LayoutConstants.nodeH };
      const rectB = { x: toPosition.x, y: toPosition.y, w: LayoutConstants.nodeW, h: LayoutConstants.nodeH };
      const path = LayoutOrtho(rectA, rectB, {
        rightChannel: rightChannel,
        laneA: LayoutLaneIndexForY(fromPosition.y),
        laneB: LayoutLaneIndexForY(toPosition.y),
        portGap: portGap,
      });
      models.push({
        id: edge.id || (edge.from + '>' + edge.to),
        from: edge.from,
        to: edge.to,
        port: edge.port || 'artifact',
        draft: edge.draft === true,
        tone: CanvasEdgeTone(CanvasStateMap, edge.from, edge.to),
        d: path,
      });
    }
    return models;
  }, [CanvasEffective, CanvasLayoutData, CanvasStateMap, mode]);

  const CanvasStageWidth = Math.max(600, CanvasLayoutData.bounds.maxX + 48, CanvasLayoutData.lanes.length ? CanvasLayoutData.lanes[0].w + 48 : 0);
  const CanvasStageHeight = Math.max(280, CanvasLayoutData.bounds.maxY + 48, CanvasLayoutData.lanes.length ? CanvasLayoutData.lanes[CanvasLayoutData.lanes.length - 1].y + CanvasLayoutData.lanes[CanvasLayoutData.lanes.length - 1].h + 24 : 0);

  const CanvasSelect = function (id) {
    if (typeof raw.onSelect === 'function') raw.onSelect(id);
    else setCanvasLocalSelectedId(id);
  };

  const CanvasReportDraft = function (draft) {
    if (typeof raw.onDraftPositions === 'function') raw.onDraftPositions(Object.assign({}, draft.positions));
    if (typeof raw.onDraftChange === 'function') raw.onDraftChange(draft);
  };

  const CanvasApplyZoom = function (nextZoom) {
    const clamped = CanvasClamp(nextZoom, 0.4, 1.6);
    if (typeof raw.setZoom === 'function') raw.setZoom(clamped);
    else setCanvasInternalZoomState(clamped);
  };

  const CanvasCompleteConnect = function (fromId, toId) {
    setCanvasConnectState(null);
    if (!fromId || !toId || fromId === toId) return;
    const byId = new Map();
    for (let i = 0; i < CanvasEffective.nodes.length; i += 1) byId.set(CanvasEffective.nodes[i].id, CanvasEffective.nodes[i]);
    const fromNode = byId.get(fromId);
    const toNode = byId.get(toId);
    if (!fromNode || !toNode) return;
    const port = CanvasDerivePort(fromNode, toNode);
    if (typeof raw.onConnect === 'function') {
      raw.onConnect(fromId, toId, port);
      return;
    }
    const exists = CanvasEffective.edges.some(function (edge) { return edge.from === fromId && edge.to === toId; })
      || CanvasDraftState.addedEdges.some(function (edge) { return edge.from === fromId && edge.to === toId; });
    if (exists) return;
    const nextDraft = Object.assign({}, CanvasDraftState, {
      addedEdges: CanvasDraftState.addedEdges.concat([{
        id: 'draft_edge_' + (CanvasDraftState.addedEdges.length + 1),
        from: fromId,
        to: toId,
        port: port,
        draft: true,
      }]),
    });
    setCanvasDraftState(nextDraft);
    CanvasReportDraft(nextDraft);
  };

  const CanvasDeleteNode = function (id) {
    if (mode !== 'blueprint' || !id) return;
    let node = null;
    for (let i = 0; i < CanvasEffective.nodes.length; i += 1) if (CanvasEffective.nodes[i].id === id) node = CanvasEffective.nodes[i];
    if (!node || CanvasIsProtected(node)) return;
    const label = CanvasNodeLabel(node, CanvasCatalog.nodeLabels);
    if (!CanvasConfirm('删除节点「' + label + '」及其全部连线？保存蓝图前只是本地草稿。')) return;
    if (typeof raw.onDelete === 'function') {
      raw.onDelete(id);
      CanvasSelect(null);
      return;
    }
    const firstIndex = CanvasDraftState.removedNodeIds.indexOf(id);
    if (firstIndex >= 0) return;
    const nextDraft = Object.assign({}, CanvasDraftState, { removedNodeIds: CanvasDraftState.removedNodeIds.concat([id]) });
    setCanvasDraftState(nextDraft);
    CanvasReportDraft(nextDraft);
    CanvasSelect(null);
  };

  const CanvasHandleFit = function () {
    setCanvasCameraState(null);
    CanvasApplyZoom(CanvasFit.scale);
  };

  // “定位当前”语义：LayoutFocus 返回内容坐标系相机中心；这里只改相机、不改 scale/zoom。
  // 调用方渲染时按 pan = viewport/2 - camera*zoom 换算屏幕平移，因此节点中心恰好在视口中心。
  const CanvasHandleFocusCurrent = function () {
    if (!CanvasCurrentId) return;
    const position = CanvasLayoutData.positions[CanvasCurrentId];
    if (!position) return;
    setCanvasCameraState(LayoutFocus(CanvasLayoutData.bounds, CanvasViewportState, position));
  };

  const CanvasHandleSave = function () {
    if (typeof raw.onSaveBlueprint !== 'function') return;
    raw.onSaveBlueprint({
      revision: graph ? graph.revision : undefined,
      graph: Object.assign({}, graph, { nodes: CanvasEffective.nodes, edges: CanvasEffective.edges }),
      positions: Object.assign({}, CanvasDraftState.positions),
      addedEdges: CanvasDraftState.addedEdges.slice(),
      removedNodeIds: CanvasDraftState.removedNodeIds.slice(),
      removedEdgeIds: CanvasDraftState.removedEdgeIds.slice(),
    });
  };

  const CanvasHandleCancel = function () {
    const changes = CanvasDraftChanges;
    if (changes > 0 && !CanvasConfirm('放弃蓝图草稿的 ' + changes + ' 处修改？')) return;
    const reset = CanvasEmptyDraft();
    setCanvasDraftState(reset);
    setCanvasConnectState(null);
    CanvasReportDraft(reset);
    if (typeof raw.onCancelBlueprint === 'function') raw.onCancelBlueprint();
  };

  const CanvasHandleNodePointerDown = function (event, model) {
    if (event && typeof event.button === 'number' && event.button !== 0) return;
    CanvasStopPointer(event);
    if (CanvasConnectState) {
      if (CanvasConnectState.from === model.id) {
        setCanvasConnectState(null);
        return;
      }
      if (event && typeof event.preventDefault === 'function') event.preventDefault();
      CanvasCompleteConnect(CanvasConnectState.from, model.id);
      return;
    }
    CanvasSelect(model.id);
    if (mode !== 'blueprint') return;
    CanvasDragRef.current = {
      id: model.id,
      pointerId: event ? event.pointerId : undefined,
      startClientX: event ? event.clientX : 0,
      startClientY: event ? event.clientY : 0,
      originX: model.x,
      originY: model.y,
      moved: false,
    };
    const target = event ? event.currentTarget : null;
    if (target && typeof target.setPointerCapture === 'function' && event && typeof event.pointerId === 'number') {
      try { target.setPointerCapture(event.pointerId); } catch (error) { /* 老浏览器忽略 */ }
    }
  };

  const CanvasHandleNodePointerMove = function (event) {
    const drag = CanvasDragRef.current;
    if (!drag || !event) return;
    const deltaX = (event.clientX - drag.startClientX) / CanvasZoom;
    const deltaY = (event.clientY - drag.startClientY) / CanvasZoom;
    if (!drag.moved && Math.abs(deltaX) + Math.abs(deltaY) > 2) drag.moved = true;
    if (!drag.moved) return;
    const nextPosition = { x: Math.round(drag.originX + deltaX), y: Math.round(drag.originY + deltaY) };
    const nextDraft = Object.assign({}, CanvasDraftState, {
      positions: Object.assign({}, CanvasDraftState.positions, { [drag.id]: nextPosition }),
    });
    setCanvasDraftState(nextDraft);
  };

  const CanvasHandleNodePointerUp = function (event) {
    const drag = CanvasDragRef.current;
    CanvasDragRef.current = null;
    if (!drag) return;
    const target = event ? event.currentTarget : null;
    if (target && typeof target.releasePointerCapture === 'function' && event && typeof event.pointerId === 'number') {
      try { target.releasePointerCapture(event.pointerId); } catch (error) { /* 忽略 */ }
    }
    if (drag.moved) {
      // 用 pointerup 的最终坐标补齐最后一帧，避免 pointermove 批处理丢失尾帧。
      const finalDraft = Object.assign({}, CanvasDraftState, {
        positions: Object.assign({}, CanvasDraftState.positions, {
          [drag.id]: {
            x: Math.round(drag.originX + (event ? (event.clientX - drag.startClientX) / CanvasZoom : 0)),
            y: Math.round(drag.originY + (event ? (event.clientY - drag.startClientY) / CanvasZoom : 0)),
          },
        }),
      });
      setCanvasDraftState(finalDraft);
      CanvasReportDraft(finalDraft);
      return;
    }
    CanvasSelect(drag.id);
  };

  const CanvasHandleNodeKeyDown = function (event, model) {
    if (!event) return;
    const key = event.key;
    const eventTarget = event.target;
    const onPort = eventTarget && typeof eventTarget.closest === 'function' && eventTarget.closest('[data-canvas-port]');
    if ((key === 'Enter' || key === ' ' || key === 'Spacebar') && onPort) return; // 交给端口按钮自身 click
    if (key === 'Enter' || key === ' ' || key === 'Spacebar') {
      if (typeof event.preventDefault === 'function') event.preventDefault();
      CanvasStopPointer(event);
      CanvasSelect(model.id);
      return;
    }
    if (key === 'Escape') {
      if (typeof event.preventDefault === 'function') event.preventDefault();
      CanvasStopPointer(event);
      setCanvasConnectState(null);
      CanvasSelect(null);
      return;
    }
    if (mode === 'blueprint' && (key === 'Delete' || key === 'Backspace')) {
      if (typeof event.preventDefault === 'function') event.preventDefault();
      CanvasStopPointer(event);
      CanvasDeleteNode(model.id);
      return;
    }
    const directions = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' };
    const direction = directions[key];
    if (!direction) return;
    if (typeof event.preventDefault === 'function') event.preventDefault();
    CanvasStopPointer(event);
    const next = CanvasSpatialNeighbor(CanvasNodeModels, model.id, direction);
    if (!next) return;
    CanvasSelect(next.id);
    CanvasFocusNodeElement(containerRef.current, next.id);
  };

  const CanvasHandlePortClick = function (event, model, direction) {
    if (mode !== 'blueprint') return;
    if (direction === 'out') {
      if (CanvasConnectState && CanvasConnectState.from === model.id) setCanvasConnectState(null);
      else {
        setCanvasConnectState({ from: model.id });
        CanvasSelect(model.id);
      }
      return;
    }
    if (CanvasConnectState) CanvasCompleteConnect(CanvasConnectState.from, model.id);
  };

  const CanvasHandleBackgroundPointerDown = function (event) {
    if (event && typeof event.button === 'number' && event.button !== 0) return;
    const target = event ? event.target : null;
    if (target && typeof target.closest === 'function') {
      if (target.closest('.px-canvas-tools') || target.closest('.px-canvas-draft') || target.closest('[data-canvas-node]')) return;
    }
    setCanvasConnectState(null);
    CanvasSelect(null);
    CanvasPanRef.current = {
      pointerId: event ? event.pointerId : undefined,
      startClientX: event ? event.clientX : 0,
      startClientY: event ? event.clientY : 0,
      cameraX: CanvasCamera.x,
      cameraY: CanvasCamera.y,
    };
    const element = containerRef.current;
    if (element && typeof element.setPointerCapture === 'function' && event && typeof event.pointerId === 'number') {
      try { element.setPointerCapture(event.pointerId); } catch (error) { /* 忽略 */ }
    }
  };

  const CanvasHandlePointerMove = function (event) {
    const pan = CanvasPanRef.current;
    if (!pan || !event) return;
    setCanvasCameraState({
      x: pan.cameraX - (event.clientX - pan.startClientX) / CanvasZoom,
      y: pan.cameraY - (event.clientY - pan.startClientY) / CanvasZoom,
    });
  };

  const CanvasHandlePointerUp = function (event) {
    if (!CanvasPanRef.current) return;
    CanvasPanRef.current = null;
    const element = containerRef.current;
    if (element && typeof element.releasePointerCapture === 'function' && event && typeof event.pointerId === 'number') {
      try { element.releasePointerCapture(event.pointerId); } catch (error) { /* 忽略 */ }
    }
  };

  const CanvasHandleKeyDown = function (event) {
    if (!event) return;
    const key = event.key;
    const target = event.target;
    if (target && typeof target.closest === 'function' && target.closest('[data-canvas-node]')) return;
    if (key === 'Escape') {
      setCanvasConnectState(null);
      CanvasSelect(null);
      return;
    }
    if (mode === 'blueprint' && (key === 'Delete' || key === 'Backspace') && CanvasSelectedId) {
      if (typeof event.preventDefault === 'function') event.preventDefault();
      CanvasDeleteNode(CanvasSelectedId);
      return;
    }
    if (key === '+' || key === '=') {
      if (typeof event.preventDefault === 'function') event.preventDefault();
      CanvasApplyZoom(CanvasZoom * 1.1);
      return;
    }
    if (key === '-') {
      if (typeof event.preventDefault === 'function') event.preventDefault();
      CanvasApplyZoom(CanvasZoom / 1.1);
      return;
    }
    if (key === '0') {
      if (typeof event.preventDefault === 'function') event.preventDefault();
      CanvasHandleFit();
    }
  };

  const CanvasNodeHandlers = {
    connectFrom: CanvasConnectState ? CanvasConnectState.from : null,
    onNodePointerDown: CanvasHandleNodePointerDown,
    onNodePointerMove: CanvasHandleNodePointerMove,
    onNodePointerUp: CanvasHandleNodePointerUp,
    onNodeKeyDown: CanvasHandleNodeKeyDown,
    onPortClick: CanvasHandlePortClick,
  };

  const CanvasWorldStyle = {
    transform: 'translate(' + CanvasRound2(CanvasPan.x) + 'px, ' + CanvasRound2(CanvasPan.y) + 'px) scale(' + CanvasRound2(CanvasZoom) + ')',
  };

  const CanvasLaneElements = CanvasLayoutData.lanes.map(function (lane) {
    return h('div', {
      key: lane.id,
      className: 'px-lane px-lane-' + lane.index,
      'data-testid': 'lane',
      'data-lane': lane.id,
      'data-lane-id': lane.id,
      style: { left: lane.x + 'px', top: lane.y + 'px', width: lane.w + 'px', height: lane.h + 'px' },
    }, h('span', { className: 'px-lane-label', 'aria-hidden': 'true' }, lane.label));
  });

  const CanvasNodeElements = CanvasNodeModels.map(function (model) {
    return CanvasRenderNode(model, mode, CanvasNodeHandlers, CanvasCatalog);
  });

  const CanvasDraftText = '草稿：' + CanvasDraftChanges + ' 处修改 · 校验：' + (CanvasDraftChanges > 0 ? '待保存' : '无修改');

  const CanvasProgress = raw.progress && typeof raw.progress === 'object' ? raw.progress : null;
  const CanvasProgressDone = CanvasProgress && typeof CanvasProgress.done === 'number' ? CanvasProgress.done : null;
  const CanvasProgressTotal = CanvasProgress && typeof CanvasProgress.total === 'number' ? CanvasProgress.total : CanvasNodeModels.length;
  let CanvasCurrentLabel = '';
  for (let i = 0; i < CanvasNodeModels.length; i += 1) if (CanvasNodeModels[i].id === CanvasCurrentId) CanvasCurrentLabel = CanvasNodeModels[i].label;
  const CanvasAriaSummary = CanvasProgressDone !== null
    ? '已完成 ' + CanvasProgressDone + ' / ' + CanvasProgressTotal + ' 个节点' + (CanvasCurrentLabel ? '，当前节点：' + CanvasCurrentLabel : '')
    : '共 ' + CanvasNodeModels.length + ' 个节点' + (CanvasCurrentLabel ? '，当前节点：' + CanvasCurrentLabel : '');

  const CanvasDraftBar = mode === 'blueprint' ? h('div', {
    className: 'px-canvas-draft',
    'data-testid': 'draft-status',
    role: 'status',
    style: CanvasViewportInsufficient ? { top: '44px' } : undefined,
    onPointerDown: CanvasStopPointer,
  },
  h('span', null, CanvasDraftText),
  CanvasConnectState ? h('span', null, '连线中：点击目标节点完成 · Esc 取消') : null,
  typeof raw.onSaveBlueprint === 'function' ? h('button', {
    type: 'button',
    onClick: CanvasHandleSave,
    disabled: CanvasDraftChanges === 0,
    'aria-label': '保存蓝图草稿',
  }, '保存蓝图') : null,
  typeof raw.onCancelBlueprint === 'function' ? h('button', {
    type: 'button',
    onClick: CanvasHandleCancel,
    'aria-label': '放弃蓝图草稿',
  }, '放弃修改') : null) : null;

  const CanvasToolbar = h('div', {
    className: 'px-canvas-tools',
    'data-testid': 'canvas-tools',
    onPointerDown: CanvasStopPointer,
    role: 'toolbar',
    'aria-label': '画布缩放工具',
  },
  h('div', { className: 'px-zoom' },
    h('button', {
      type: 'button',
      onClick: function () { CanvasApplyZoom(CanvasZoom / 1.1); },
      'aria-label': '缩小画布',
      title: '缩小',
    }, '−'),
    h('span', { className: 'px-zoom-text', 'data-testid': 'zoom-text', 'aria-live': 'polite' }, Math.round(CanvasZoom * 100) + '%'),
    h('button', {
      type: 'button',
      onClick: function () { CanvasApplyZoom(CanvasZoom * 1.1); },
      'aria-label': '放大画布',
      title: '放大',
    }, '+'),
    h('button', {
      type: 'button',
      'data-testid': 'fit',
      onClick: CanvasHandleFit,
      'aria-label': '适配全部节点',
      title: '适配',
    }, '适配'),
    h('button', {
      type: 'button',
      'data-testid': 'locate-current',
      onClick: CanvasHandleFocusCurrent,
      disabled: !CanvasCurrentId || !CanvasLayoutData.positions[CanvasCurrentId],
      'aria-label': '定位当前节点',
      title: '定位当前',
    }, '定位当前')));

  const CanvasViewportHint = CanvasViewportInsufficient ? h('div', {
    'data-testid': 'viewport-hint',
    style: {
      position: 'absolute',
      left: '10px',
      top: '8px',
      bottom: 'auto',
      zIndex: 4,
      padding: '3px 8px',
      fontSize: '12px',
      lineHeight: '16px',
      color: CanvasThemeVars.secondary,
      background: CanvasThemeVars.layer,
      border: '1px dashed ' + CanvasThemeVars.border,
      borderRadius: '4px',
      pointerEvents: 'none',
    },
  }, '视口不足：可拖拽查看完整流程') : null;

  const CanvasEmptyHint = !CanvasEffective.nodes.length ? h('div', {
    style: {
      position: 'absolute',
      inset: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      pointerEvents: 'none',
      fontSize: '12px',
      color: CanvasThemeVars.secondary,
    },
  }, '暂无流程。新建研究运行后将在此显示 3 条研究泳道。') : null;

  return h('div', {
    ref: containerRef,
    className: 'px-canvas',
    'data-testid': 'canvas',
    'data-mode': mode,
    'data-scale': CanvasZoom.toFixed(3),
    tabIndex: 0,
    role: 'region',
    'aria-label': 'Praxis 流程画布，共 ' + CanvasNodeModels.length + ' 个节点',
    onKeyDown: CanvasHandleKeyDown,
    onPointerDown: CanvasHandleBackgroundPointerDown,
    onPointerMove: CanvasHandlePointerMove,
    onPointerUp: CanvasHandlePointerUp,
    onPointerCancel: CanvasHandlePointerUp,
  },
  h('div', {
    className: 'px-canvas-world',
    'data-testid': 'world',
    'data-scale': CanvasZoom.toFixed(3),
    style: CanvasWorldStyle,
  },
    CanvasLaneElements,
    CanvasRenderEdgeLayer(CanvasEdgeModels, CanvasStageWidth, CanvasStageHeight),
    CanvasNodeElements),
  CanvasEmptyHint,
  CanvasViewportHint,
  CanvasDraftBar,
  CanvasToolbar,
  h('span', {
    'aria-live': 'polite',
    style: {
      position: 'absolute',
      width: '1px',
      height: '1px',
      overflow: 'hidden',
      clip: 'rect(0 0 0 0)',
      whiteSpace: 'nowrap',
    },
  }, CanvasAriaSummary));
}

/* 词表样式；由 70-css.js 拼进最终样式表。只允许主题 token（禁 #fff/black 等魔法色）。 */
const CanvasCss = `
.px-canvas {
  --px-ok: var(--dsw-alias-state-success-primary);
  --px-ok: color-mix(in oklab, var(--dsw-alias-state-success-primary) 62%, var(--dsw-alias-label-primary));
  --px-warn: var(--dsw-alias-state-warn-primary);
  --px-warn: color-mix(in oklab, var(--dsw-alias-state-warn-primary) 62%, var(--dsw-alias-label-primary));
  --px-bad: var(--dsw-alias-state-error-primary);
  --px-bad: color-mix(in oklab, var(--dsw-alias-state-error-primary) 62%, var(--dsw-alias-label-primary));
  --px-active: var(--dsw-alias-brand-primary);
  position: relative; inset: auto; width: 100%; height: 100%; min-height: 240px; overflow: hidden; touch-action: none; color: var(--dsw-alias-label-primary); background-color: var(--dsw-alias-bg-base); background-image: radial-gradient(var(--dsw-alias-border-l1) 1px, transparent 1px); background-size: 26px 26px; outline: none; font-variant-numeric: tabular-nums; }
.px-canvas:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: -2px; }
.px-canvas-world { position: absolute; left: 0; top: 0; transform-origin: 0 0; will-change: transform; }
.px-canvas-svg { position: absolute; left: 0; top: 0; overflow: visible; pointer-events: none; }
.px-lane { position: absolute; pointer-events: none; background: transparent; opacity: 1; border: 0; border-top: 1px solid var(--dsw-alias-border-l1); border-bottom: 1px solid var(--dsw-alias-border-l1); border-radius: 0; }
.px-lane-label { position: absolute; left: 8px; top: 1px; bottom: auto; width: auto; height: 13px; display: flex; align-items: center; justify-content: flex-start; writing-mode: horizontal-tb; text-orientation: mixed; font-size: 11px; line-height: 13px; letter-spacing: 0.02em; color: var(--dsw-alias-label-secondary); white-space: nowrap; user-select: none; z-index: 1; }
.px-node { position: absolute; left: 0; top: 0; width: 156px; height: 64px; box-sizing: border-box; display: flex; flex-direction: column; justify-content: center; gap: 2px; padding: 6px 10px; background: var(--dsw-alias-bg-layer-1); border: 1px solid var(--dsw-alias-border-l2); border-radius: 4px; cursor: pointer; user-select: none; color: var(--dsw-alias-label-primary); }
.px-node::before { content: ""; position: absolute; left: 0; top: 0; bottom: 0; width: 3px; border-radius: 4px 0 0 4px; background: transparent; }
.px-node:hover { border-color: var(--dsw-alias-brand-primary); border-style: solid; }
.px-node[data-current="true"] { border-color: var(--px-active); }
.px-node[data-current="true"], .px-node[data-execution="active"] { box-shadow: none; }
.px-node[data-current="true"]::before { background: var(--px-active); }
.px-node[data-selected="true"] { outline: 2px dashed var(--dsw-alias-label-secondary); outline-offset: 3px; }
.px-node:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: 2px; }
.px-node[data-execution="done"] { border-color: var(--px-ok); }
.px-node[data-execution="blocked"] { border-color: var(--px-warn); border-style: solid; background-image: repeating-linear-gradient(135deg, transparent 0 4px, var(--dsw-alias-bg-layer-2) 4px 6px); }
.px-node[data-execution="failed"] { border: 3px double var(--px-bad); box-shadow: none; }
.px-node[data-execution="pending"] { color: var(--dsw-alias-label-secondary); }
.px-node-title { display: flex; align-items: center; gap: 4px; min-width: 0; font-size: 12.5px; font-weight: 600; line-height: 16px; color: var(--dsw-alias-label-primary); }
.px-node-sub { display: flex; align-items: center; gap: 4px; min-width: 0; font-size: 11px; line-height: 14px; color: var(--dsw-alias-label-secondary); }
.px-node-glyph { display: inline-flex; flex: none; width: 10px; height: 10px; color: var(--dsw-alias-label-secondary); }
.px-node-glyph svg { width: 10px; height: 10px; display: block; }
.px-node[data-execution="active"] .px-node-glyph { color: var(--px-active); }
.px-node[data-execution="done"] .px-node-glyph { color: var(--px-ok); }
.px-node[data-execution="blocked"] .px-node-glyph { color: var(--px-warn); }
.px-node[data-execution="failed"] .px-node-glyph { color: var(--px-bad); }
.px-node-chip { display: inline-flex; align-items: center; align-self: flex-start; max-width: 100%; height: 16px; padding: 0 4px; font-size: 10.5px; line-height: 12.5px; border: 1px solid var(--dsw-alias-border-l2); border-radius: 4px; color: var(--dsw-alias-label-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.px-node-chip[data-kind="condition"]::before { content: ""; flex: none; width: 5px; height: 5px; margin-right: 3px; border-radius: 50%; background: var(--dsw-alias-label-secondary); }
.px-node-chip[data-kind="condition"][data-condition="satisfied"] { color: var(--dsw-alias-label-secondary); border-color: var(--px-ok); }
.px-node-chip[data-kind="condition"][data-condition="satisfied"]::before { background: var(--px-ok); }
.px-node-chip[data-kind="condition"][data-condition="missing"] { color: var(--dsw-alias-label-secondary); border-color: var(--px-warn); }
.px-node-chip[data-kind="condition"][data-condition="missing"]::before { background: var(--px-warn); }
.px-node-chip[data-kind="condition"][data-condition="stale"] { color: var(--dsw-alias-label-secondary); border-color: var(--dsw-alias-label-secondary); }
.px-node-chip[data-kind="condition"][data-condition="stale"]::before { background: var(--dsw-alias-label-secondary); }
.px-node[data-execution="done"] .px-node-sub, .px-node[data-execution="active"] .px-node-sub,
.px-node[data-execution="blocked"] .px-node-sub, .px-node[data-execution="failed"] .px-node-sub,
.px-node[data-execution="pending"] .px-node-sub { color: var(--dsw-alias-label-secondary); }
.px-canvas[data-mode="blueprint"] .px-node { cursor: grab; }
.px-canvas[data-mode="blueprint"] .px-node:active { cursor: grabbing; }
.px-port { position: absolute; width: 10px; height: 10px; border-radius: 50%; border: 1px solid var(--dsw-alias-border-l2); background: var(--dsw-alias-bg-base); padding: 0; cursor: crosshair; z-index: 2; }
.px-port-in { left: -5px; top: calc(50% - 5px); }
.px-port-out { right: -5px; top: calc(50% - 5px); }
.px-port:hover, .px-port[data-armed="true"] { border-color: var(--dsw-alias-brand-primary); background: var(--dsw-alias-brand-primary); }
.px-port:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: 1px; }
.px-edge { fill: none; stroke: var(--dsw-alias-label-secondary); stroke-width: 1.2; }
.px-edge[data-execution="active"] { stroke: var(--px-active); stroke-width: 1.6; stroke-dasharray: none; }
.px-edge[data-execution="done"] { stroke: var(--px-ok); stroke-width: 1.6; stroke-dasharray: none; }
.px-edge[data-execution="pending"] { stroke: var(--dsw-alias-label-secondary); stroke-width: 1.2; stroke-dasharray: 4 3; }
.px-edge[data-execution="blocked"] { stroke: var(--px-warn); stroke-width: 1.2; stroke-dasharray: 5 3; }
.px-edge[data-execution="failed"] { stroke: var(--px-bad); stroke-width: 1.2; stroke-dasharray: none; }
.px-arrow-pending { fill: var(--dsw-alias-label-secondary); }
.px-arrow-active { fill: var(--px-active); }
.px-arrow-done { fill: var(--px-ok); }
.px-arrow-blocked { fill: var(--px-warn); }
.px-arrow-failed { fill: var(--px-bad); }
.px-canvas-tools { position: absolute; top: 8px; right: 10px; bottom: auto; z-index: 3; display: flex; align-items: center; gap: 6px; padding: 3px 6px; background: var(--dsw-alias-bg-layer-1); border: 1px solid var(--dsw-alias-border-l1); border-radius: 6px; }
.px-zoom { display: flex; align-items: center; gap: 2px; }
.px-canvas-tools button { appearance: none; border: 1px solid transparent; background: transparent; color: var(--dsw-alias-label-primary); font: inherit; font-size: 12px; line-height: 20px; padding: 0 6px; border-radius: 3px; cursor: pointer; }
.px-canvas-tools button:hover:not(:disabled) { border-color: var(--dsw-alias-border-l2); background: var(--dsw-alias-bg-layer-2); }
.px-canvas-tools button:disabled { color: var(--dsw-alias-state-idle-primary); cursor: not-allowed; }
.px-canvas-tools button:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: 1px; }
.px-zoom-text { min-width: 42px; text-align: center; font-size: 12px; color: var(--dsw-alias-label-secondary); font-variant-numeric: tabular-nums; }
.px-canvas-draft { position: absolute; left: 10px; top: 8px; z-index: 3; display: flex; align-items: center; gap: 8px; max-width: calc(100% - 240px); padding: 3px 8px; background: var(--dsw-alias-bg-layer-1); border: 1px dashed var(--dsw-alias-border-l2); border-radius: 6px; font-size: 12px; color: var(--dsw-alias-label-secondary); }
.px-canvas-draft > span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.px-canvas-draft button { appearance: none; flex: none; border: 1px solid var(--dsw-alias-border-l2); background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-label-primary); font: inherit; font-size: 12px; line-height: 18px; padding: 0 7px; border-radius: 3px; cursor: pointer; }
.px-canvas-draft button:hover:not(:disabled) { border-color: var(--dsw-alias-brand-primary); }
.px-canvas-draft button:disabled { color: var(--dsw-alias-state-idle-primary); cursor: not-allowed; }
`;

/* ===== 40-inspector.js ===== */
/* Inspector: run mode = dual-axis node state + exactly one primary action form;
 * blueprint mode = node field editing with protection, validation and diff.
 * Prefix Inspect*. Contract §4.2, §5.1–§5.5, T1.1, T3.1, T6.1, T6.2, U2, U3.
 * DOM hooks: data-testid inspector / inspector-close / execution-chip /
 * condition-chip / action-form / primary[data-inspector-submit] / action-error. */

const InspectNodeTypeLabels = { start: '起点', stage: '阶段', gate: '门禁', actor: '角色', end: '终点' };
const InspectPortLabels = { artifact: '产物', contract: '契约', evidence: '证据', veto: '否决' };
const InspectVerdictOptions = [['pass', '通过'], ['suspect', '存疑'], ['fail', '失败']];
const InspectNextLabels = {
  'new-run': '新建运行', stop: '停止', deepen: '深化', pivot: '转向', redefine: '重定义', 'repeat-same': '重复同结论',
};
const InspectFormByAction = {
  question: 'question',
  prereg_freeze: 'prereg',
  'complete-prereg': 'prereg',
  discussion: 'discussion',
  experiment: 'experiment',
  review: 'review',
  stage4: 'stage4',
  eval_report: 'eval',
  eval_read: 'evalread',
  memory_propose: 'memory',
  memory_commit: 'memory',
  decision: 'decision',
  'close-or-new-run': 'decision',
  'pivot-or-stop': 'decision',
};
const InspectFormByState = {
  INTAKE: 'question',
  QUESTION: 'prereg',
  PREREG_FROZEN: 'discussion',
  DISCUSSION: 'experiment',
  EXECUTING: 'review',
  REVIEW: 'stage4',
  STAGE4: 'eval',
  EVAL: 'evalread',
  MEMORY: 'memory',
  DECISION: 'decision',
};
const InspectFormTitles = {
  question: '提出研究问题',
  prereg: '冻结预注册',
  discussion: '提交讨论',
  experiment: '记录实验',
  review: '记录复核',
  stage4: '记录阶段四',
  eval: '提交评估报告',
  evalread: '确认已读评估',
  memory: '记忆提案与提交',
  decision: '记录决策',
};
const InspectDiscussionSample = JSON.stringify([
  {
    persona: 'mechanist',
    claim: '增益来自算子结构',
    assumptions: ['容量匹配后仍增益'],
    evidence: ['derivation:1', 'data:4'],
    style: 'theoretical',
    minority: true,
    retained: true,
  },
  {
    persona: 'scaling',
    claim: '增益来自容量',
    assumptions: ['容量解释全部增益'],
    evidence: ['data:5'],
    style: 'empirical',
    minority: false,
    retained: true,
  },
  {
    persona: 'cross-domain',
    claim: '用可辨识性重写算子',
    assumptions: ['可辨识性先于容量'],
    evidence: ['analogy:2'],
    style: 'analogical',
    minority: true,
    retained: true,
  },
], null, 2);

/* ---------------------------------------------------------------- helpers */

function InspectActionMeta(catalog, actionId) {
  if (!actionId) return null;
  return (catalog?.actions ?? []).find((item) => item.id === actionId) ?? null;
}

function InspectActionLabel(catalog, actionId) {
  return InspectActionMeta(catalog, actionId)?.label ?? '';
}

function InspectStateLabel(catalog, stateId) {
  const meta = (catalog?.states ?? []).find((item) => item.id === stateId);
  return meta?.label ?? '';
}

function InspectExecutionMeta(catalog, execution) {
  const meta = (catalog?.nodeExecution ?? []).find((item) => item.id === execution);
  return { label: meta?.label ?? '未知', tone: meta?.tone ?? 'idle' };
}

function InspectConditionMeta(catalog, condition) {
  const meta = (catalog?.nodeCondition ?? []).find((item) => item.id === condition);
  return { label: meta?.label ?? '未知', tone: meta?.tone ?? 'idle' };
}

function InspectReasonText(catalog, code) {
  if (!code) return '';
  const text = catalog?.reasons?.[code];
  return typeof text === 'string' ? text : '';
}

function InspectFormKey(actionId, stateId) {
  if (actionId && InspectFormByAction[actionId]) return InspectFormByAction[actionId];
  return InspectFormByState[stateId] ?? null;
}

function InspectActionFor(run, catalog) {
  const stateAction = catalog?.stateActions?.[run?.state] ?? null;
  const actionId = stateAction ?? run?.nextAction ?? null;
  return {
    actionId,
    label: InspectActionLabel(catalog, actionId),
    formKey: InspectFormKey(actionId, run?.state),
  };
}

function InspectActionOwner(graph, actionId, current) {
  const nodes = Array.isArray(graph?.nodes) ? graph.nodes : [];
  if (actionId) {
    const owner = nodes.find((item) => item?.config?.action === actionId);
    if (owner) return owner;
  }
  if (current) return nodes.find((item) => item.id === current) ?? null;
  return null;
}

function InspectNodeLabel(node, catalog) {
  if (!node) return '';
  const catalogLabel = catalog?.nodeLabels?.[node.id];
  if (typeof catalogLabel === 'string' && catalogLabel) return catalogLabel;
  return typeof node.label === 'string' ? node.label : '';
}

function InspectStagePosition(run, catalog) {
  const states = Array.isArray(catalog?.states) ? catalog.states : [];
  const index = states.findIndex((item) => item.id === run?.state);
  if (index < 0 || !states.length) return null;
  return { index, total: states.length };
}

function InspectText(value) {
  if (value == null) return '';
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'object') return '';
  return String(value);
}

function InspectNumberText(value, fallback) {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'string' && value.trim()) return value.trim();
  return fallback;
}

function InspectLines(text) {
  return String(text ?? '').split(/[\n,，]/).map((item) => item.trim()).filter(Boolean);
}

function InspectNodeStateOf(nodeState) {
  if (!nodeState) return { execution: null, condition: null, reason: '' };
  if (typeof nodeState === 'string') return { execution: nodeState, condition: null, reason: '' };
  return {
    execution: nodeState.execution ?? null,
    condition: nodeState.condition ?? null,
    reason: typeof nodeState.reason === 'string' ? nodeState.reason : '',
  };
}

function InspectCloneGraph(graph) {
  return JSON.parse(JSON.stringify(graph ?? { nodes: [], edges: [] }));
}

function InspectNodePatch(graph, nodeId, patch) {
  const next = InspectCloneGraph(graph);
  next.nodes = (next.nodes ?? []).map((item) => (item.id === nodeId ? { ...item, ...patch } : item));
  return next;
}

function InspectNodeRemove(graph, nodeId) {
  const next = InspectCloneGraph(graph);
  next.nodes = (next.nodes ?? []).filter((item) => item.id !== nodeId);
  next.edges = (next.edges ?? []).filter((edge) => edge.from !== nodeId && edge.to !== nodeId);
  return next;
}

function InspectIsProtected(node) {
  if (!node) return true;
  if (node.protected === true) return true;
  if (node.id === 'start' || node.id === 'end') return true;
  if (node.type === 'stage' || node.type === 'gate') {
    return Boolean(node.stage || node.config?.gate || node.config?.guards);
  }
  return false;
}

function InspectValidationList(validation) {
  if (!validation) return [];
  const toText = (item) => (typeof item === 'string' ? item : item?.message ?? '');
  if (Array.isArray(validation)) return validation.map(toText).filter(Boolean);
  if (Array.isArray(validation.errors)) return validation.errors.map(toText).filter(Boolean);
  if (typeof validation === 'string') return [validation];
  return [];
}

function InspectDiffText(diff) {
  if (!diff) return '';
  if (typeof diff === 'string') return diff;
  if (Array.isArray(diff)) return diff.join('；');
  if (typeof diff.total === 'number') {
    if (!diff.total) return '与已保存图一致';
    const parts = [];
    if (diff.nodesAdded || diff.nodesRemoved) parts.push(`节点 +${diff.nodesAdded ?? 0} / −${diff.nodesRemoved ?? 0}`);
    if (diff.edgesAdded || diff.edgesRemoved) parts.push(`连线 +${diff.edgesAdded ?? 0} / −${diff.edgesRemoved ?? 0}`);
    if (diff.moved) parts.push(`移动 ${diff.moved}`);
    return parts.length ? parts.join(' · ') : '与已保存图一致';
  }
  return '';
}

function InspectActionError({ message }) {
  if (!message) return null;
  return h('p', { className: 'px-action-error', 'data-testid': 'action-error', role: 'alert' }, message);
}

function InspectPrimary({ label, actionId, pending, busy, disabled, onClick }) {
  const waiting = Boolean(pending || busy);
  return h('button', {
    type: 'button',
    className: 'px-btn primary',
    'data-testid': 'primary',
    'data-inspector-submit': 'true',
    'data-action-id': actionId ?? '',
    'data-primary-scope': 'inspector',
    disabled: Boolean(disabled) || waiting,
    onClick: waiting ? undefined : onClick,
  }, waiting ? '提交中…' : label);
}

function InspectUseSubmit(props, actionId) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  async function submit(payload) {
    if (typeof props.onAction !== 'function') {
      setError('当前没有可用的提交通道');
      return null;
    }
    setPending(true);
    setError('');
    setFieldErrors({});
    let receipt = null;
    try {
      receipt = await props.onAction(actionId, payload, { expectedDomainVersion: props.run?.version });
    } catch (cause) {
      setPending(false);
      setError(cause instanceof Error ? cause.message : '提交失败');
      return null;
    }
    setPending(false);
    if (receipt && receipt.status === 'rejected') {
      const reason = InspectReasonText(props.catalog, receipt.reasonCode) || '提交被拒绝';
      const nextLabel = InspectActionLabel(props.catalog, receipt.nextAction);
      setError(nextLabel ? `${reason}；下一步：${nextLabel}` : reason);
      if (Array.isArray(receipt.blockers) && receipt.blockers.length) {
        const next = {};
        for (const key of receipt.blockers) next[key] = '此项未通过服务端校验';
        setFieldErrors(next);
      }
    } else if (receipt && (receipt.status === 'committed' || receipt.status === 'replayed')) {
      if (typeof props.onReport === 'function') {
        props.onReport(`已提交：${InspectActionLabel(props.catalog, actionId) || '操作'}`);
      }
    }
    return receipt;
  }

  return { submit, pending, error, fieldErrors };
}

/* ---------------------------------------------------------------- forms */

function InspectQuestionForm(props) {
  const run = props.run;
  const submitApi = InspectUseSubmit(props, 'question');
  const [text, setText] = useState(() => run?.question?.text ?? '');
  const [hypothesis, setHypothesis] = useState(() => run?.question?.hypothesis ?? '');
  const [unknowns, setUnknowns] = useState(() => (Array.isArray(run?.question?.unknowns) ? run.question.unknowns.join('\n') : ''));
  const [errors, setErrors] = useState({});

  function validate() {
    const next = {};
    if (String(text).trim().length < 4) next.text = '研究问题至少 4 个字符';
    if (String(hypothesis).trim().length < 4) next.hypothesis = '可证伪假设至少 4 个字符';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function onSubmit() {
    if (!validate()) return;
    void submitApi.submit({
      question: {
        text: String(text).trim(),
        hypothesis: String(hypothesis).trim(),
        unknowns: InspectLines(unknowns),
      },
    });
  }

  const fieldErrors = { ...errors, ...submitApi.fieldErrors };
  const formError = submitApi.error || (Object.keys(errors).length ? '请先修正标红的字段' : '');
  return h('div', { className: 'px-action-fields' },
    h('p', { className: 'px-action-hint' }, '先把问题写成可裁决的形式。冻结预注册后，问题与假设不能再改。'),
    h(PrimField, { label: '研究问题', hint: '一句话', error: fieldErrors.text },
      h(PrimInput, {
        value: text,
        placeholder: '例如：容量匹配后，算子结构是否仍带来增益？',
        onChange: (event) => setText(event.target.value),
      })),
    h(PrimField, { label: '可证伪假设', hint: '方向或数值', error: fieldErrors.hypothesis },
      h(PrimInput, {
        value: hypothesis,
        placeholder: '例如：容量匹配后增益下降到 0.02 以内',
        onChange: (event) => setHypothesis(event.target.value),
      })),
    h(PrimField, { label: '未知清单', hint: '每行一个' },
      h(PrimArea, {
        rows: 3,
        value: unknowns,
        placeholder: '例如：不确定基线是否已匹配容量',
        onChange: (event) => setUnknowns(event.target.value),
      })),
    h(InspectActionError, { message: formError }),
    h('div', { className: 'px-inspector-actions' },
      h(InspectPrimary, { label: '提交问题', actionId: 'question', pending: submitApi.pending, busy: props.busy, disabled: props.disabled, onClick: onSubmit })));
}

function InspectPreregForm(props) {
  const run = props.run;
  const contract = run?.prereg?.contract ?? {};
  const submitApi = InspectUseSubmit(props, 'prereg_freeze');
  const [advanced, setAdvanced] = useState(false);
  const [form, setForm] = useState(() => ({
    question: InspectText(contract.question) || run?.question?.text || run?.title || '',
    prediction: InspectText(contract.prediction),
    acceptance: InspectText(contract.acceptance),
    acceptableFailure: InspectText(contract.acceptableFailure),
    controls: InspectText(contract.controls),
    metricsPrimary: InspectText(contract.metrics?.primary) || 'separation',
    metricsThreshold: InspectNumberText(contract.metrics?.threshold, '0.08'),
    metricsSeeds: InspectNumberText(contract.metrics?.seeds, '3'),
    inputSource: InspectText(contract.input?.source) || 'declared-corpus',
    inputSplit: InspectText(contract.input?.split) || 'train',
    inputEvalSplit: InspectText(contract.input?.evalSplit) || 'held-out',
    budgetWallMin: InspectNumberText(contract.budget?.wallMin, '30'),
    budgetAgents: InspectNumberText(contract.budget?.agents, '4'),
    stopSameConclusion: InspectNumberText(contract.stop?.sameConclusion, '2'),
  }));
  const [errors, setErrors] = useState({});
  const upd = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }));

  function validate() {
    const next = {};
    if (!String(form.question).trim()) next.question = '需要写清研究问题';
    if (!String(form.prediction).trim()) next.prediction = '预测必须具体';
    if (!String(form.acceptance).trim()) next.acceptance = '必须写明验收条件';
    if (!String(form.acceptableFailure).trim()) next.acceptableFailure = '必须写明可接受失败';
    if (!String(form.controls).trim()) next.controls = '至少写一个对照';
    if (!String(form.metricsPrimary).trim()) next.metricsPrimary = '主指标不能为空';
    if (!Number.isFinite(Number(form.metricsThreshold))) next.metricsThreshold = '阈值必须是数字';
    if (!Number.isFinite(Number(form.metricsSeeds))) next.metricsSeeds = '种子数必须是数字';
    if (!String(form.inputSource).trim()) next.inputSource = '数据来源不能为空';
    if (!Number.isFinite(Number(form.budgetWallMin)) || Number(form.budgetWallMin) <= 0) next.budgetWallMin = '时限必须是正数';
    if (!Number.isFinite(Number(form.budgetAgents)) || Number(form.budgetAgents) <= 0) next.budgetAgents = '代理数必须是正数';
    if (!Number.isFinite(Number(form.stopSameConclusion)) || Number(form.stopSameConclusion) < 1) next.stopSameConclusion = '同结论上限至少为 1';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function onSubmit() {
    if (!validate()) return;
    void submitApi.submit({
      prereg: {
        question: String(form.question).trim(),
        prediction: String(form.prediction).trim(),
        acceptance: String(form.acceptance).trim(),
        acceptableFailure: String(form.acceptableFailure).trim(),
        controls: InspectLines(form.controls),
        metrics: {
          primary: String(form.metricsPrimary).trim(),
          threshold: Number(form.metricsThreshold),
          seeds: Number(form.metricsSeeds),
        },
        input: {
          source: String(form.inputSource).trim(),
          split: String(form.inputSplit).trim(),
          evalSplit: String(form.inputEvalSplit).trim(),
        },
        budget: {
          wallMin: Number(form.budgetWallMin),
          agents: Number(form.budgetAgents),
        },
        stop: { sameConclusion: Number(form.stopSameConclusion) },
      },
    });
  }

  const fieldErrors = { ...errors, ...submitApi.fieldErrors };
  const formError = submitApi.error || (Object.keys(errors).length ? '请先修正标红的字段' : '');
  return h('div', { className: 'px-action-fields' },
    h('p', { className: 'px-action-hint' }, '冻结后契约不可改；改契约只能派生新运行。'),
    h(PrimField, { label: '研究问题', error: fieldErrors.question },
      h(PrimInput, { value: form.question, onChange: upd('question') })),
    h(PrimField, { label: '预测', hint: '具体数字或方向', error: fieldErrors.prediction },
      h(PrimInput, { value: form.prediction, placeholder: '例如：略高于基线 0.08', onChange: upd('prediction') })),
    h(PrimField, { label: '验收条件', error: fieldErrors.acceptance },
      h(PrimArea, { rows: 2, value: form.acceptance, placeholder: '当且仅当什么发生时算通过', onChange: upd('acceptance') })),
    h(PrimField, { label: '可接受失败', error: fieldErrors.acceptableFailure },
      h(PrimArea, { rows: 2, value: form.acceptableFailure, placeholder: '什么情况下接受假设不成立', onChange: upd('acceptableFailure') })),
    h(PrimField, { label: '对照', hint: '逗号分隔', error: fieldErrors.controls },
      h(PrimInput, { value: form.controls, placeholder: '例如：shuffle, label-shuffle', onChange: upd('controls') })),
    h('button', {
      type: 'button',
      className: 'px-disclose',
      'aria-expanded': advanced,
      onClick: () => setAdvanced((value) => !value),
    }, advanced ? '▾ 收起指标 / 数据 / 预算' : '▸ 展开指标 / 数据 / 预算'),
    advanced ? h('div', { className: 'px-form-grid' },
      h(PrimField, { label: '主指标', error: fieldErrors.metricsPrimary },
        h(PrimInput, { value: form.metricsPrimary, onChange: upd('metricsPrimary') })),
      h(PrimField, { label: '阈值', error: fieldErrors.metricsThreshold },
        h(PrimInput, { value: form.metricsThreshold, inputMode: 'decimal', onChange: upd('metricsThreshold') })),
      h(PrimField, { label: '评估种子', error: fieldErrors.metricsSeeds },
        h(PrimInput, { value: form.metricsSeeds, inputMode: 'numeric', onChange: upd('metricsSeeds') })),
      h(PrimField, { label: '数据来源', error: fieldErrors.inputSource },
        h(PrimInput, { value: form.inputSource, onChange: upd('inputSource') })),
      h(PrimField, { label: '训练切分' },
        h(PrimInput, { value: form.inputSplit, onChange: upd('inputSplit') })),
      h(PrimField, { label: '评估切分' },
        h(PrimInput, { value: form.inputEvalSplit, onChange: upd('inputEvalSplit') })),
      h(PrimField, { label: '时限（分钟）', error: fieldErrors.budgetWallMin },
        h(PrimInput, { value: form.budgetWallMin, inputMode: 'numeric', onChange: upd('budgetWallMin') })),
      h(PrimField, { label: '代理数', error: fieldErrors.budgetAgents },
        h(PrimInput, { value: form.budgetAgents, inputMode: 'numeric', onChange: upd('budgetAgents') })),
      h(PrimField, { label: '同结论上限', hint: '达到即强制转向', error: fieldErrors.stopSameConclusion },
        h(PrimInput, { value: form.stopSameConclusion, inputMode: 'numeric', onChange: upd('stopSameConclusion') }))) : null,
    h(InspectActionError, { message: formError }),
    h('div', { className: 'px-inspector-actions' },
      h(InspectPrimary, { label: '冻结预注册', actionId: 'prereg_freeze', pending: submitApi.pending, busy: props.busy, disabled: props.disabled, onClick: onSubmit })));
}

function InspectDiscussionForm(props) {
  const run = props.run;
  const submitApi = InspectUseSubmit(props, 'discussion');
  const [text, setText] = useState('');
  const [errors, setErrors] = useState({});
  const heterogeneity = run?.discussion?.heterogeneity ?? null;

  function parsePackages() {
    if (!String(text).trim()) {
      setErrors({ packages: '先粘贴或载入至少 2 个观点包' });
      return null;
    }
    let value = null;
    try {
      value = JSON.parse(text);
    } catch (cause) {
      setErrors({ packages: `JSON 语法错误：${cause instanceof Error ? cause.message : '无法解析'}` });
      return null;
    }
    if (!Array.isArray(value) || value.length < 2) {
      setErrors({ packages: '至少需要 2 个观点包，讨论才算发生' });
      return null;
    }
    for (const item of value) {
      if (!item || typeof item !== 'object' || typeof item.claim !== 'string' || !item.claim.trim()) {
        setErrors({ packages: '每个观点包都需要 claim 文本' });
        return null;
      }
    }
    setErrors({});
    return value;
  }

  function onSubmit() {
    const packages = parsePackages();
    if (!packages) return;
    void submitApi.submit({ round: (run?.discussion?.rounds ?? 0) + 1, packages });
  }

  return h('div', { className: 'px-action-fields' },
    heterogeneity ? h('p', { className: 'px-action-hint' },
      `上一轮异质度 ${typeof heterogeneity.D === 'number' ? heterogeneity.D.toFixed(2) : '—'}${heterogeneity.styleOnly ? '（只有风格差异）' : ''}`) : null,
    h(PrimField, { label: '观点包', hint: 'JSON 数组：persona / claim / evidence / style', error: errors.packages ?? submitApi.fieldErrors.packages },
      h(PrimArea, {
        rows: 9,
        className: 'px-input px-area px-source-area',
        value: text,
        spellCheck: false,
        placeholder: '粘贴至少 2 个立场不同的观点包',
        onChange: (event) => setText(event.target.value),
      })),
    h('div', { className: 'px-inspector-actions' },
      h(PrimBtn, { onClick: () => setText(InspectDiscussionSample) }, '载入示例')),
    h(InspectActionError, { message: submitApi.error || (errors.packages ? '请先修正标红的字段' : '') }),
    h('div', { className: 'px-inspector-actions' },
      h(InspectPrimary, { label: '提交讨论', actionId: 'discussion', pending: submitApi.pending, busy: props.busy, disabled: props.disabled, onClick: onSubmit })));
}

function InspectExperimentForm(props) {
  const submitApi = InspectUseSubmit(props, 'experiment');
  const [command, setCommand] = useState('');
  const [artifactHash, setArtifactHash] = useState('');
  const [errors, setErrors] = useState({});

  function onSubmit() {
    if (!String(command).trim()) {
      setErrors({ command: '写清这次实验具体做了什么' });
      return;
    }
    setErrors({});
    void submitApi.submit({
      command: String(command).trim(),
      artifactHash: String(artifactHash).trim() || null,
    });
  }

  const fieldErrors = { ...errors, ...submitApi.fieldErrors };
  const formError = submitApi.error || (Object.keys(errors).length ? '请先修正标红的字段' : '');
  return h('div', { className: 'px-action-fields' },
    h('p', { className: 'px-action-hint' }, '实验必须对得上冻结的预测与对照；这里不选择执行身份，身份由宿主决定。'),
    h(PrimField, { label: '执行描述', error: fieldErrors.command },
      h(PrimInput, {
        value: command,
        placeholder: '例如：容量匹配消融 + 留出集复现',
        onChange: (event) => setCommand(event.target.value),
      })),
    h(PrimField, { label: '产物哈希', hint: '可选' },
      h(PrimInput, {
        value: artifactHash,
        placeholder: '实验产物或日志的哈希',
        onChange: (event) => setArtifactHash(event.target.value),
      })),
    h(InspectActionError, { message: formError }),
    h('div', { className: 'px-inspector-actions' },
      h(InspectPrimary, { label: '记录实验', actionId: 'experiment', pending: submitApi.pending, busy: props.busy, disabled: props.disabled, onClick: onSubmit })));
}

function InspectReviewForm(props) {
  const submitApi = InspectUseSubmit(props, 'review');
  const [verdict, setVerdict] = useState('suspect');
  const [items, setItems] = useState('');
  const [errors, setErrors] = useState({});

  function onSubmit() {
    const lines = String(items).split('\n').map((item) => item.trim()).filter(Boolean);
    if (!lines.length) {
      setErrors({ items: '至少写一条复核结论' });
      return;
    }
    setErrors({});
    void submitApi.submit({ verdict, items: lines });
  }

  const fieldErrors = { ...errors, ...submitApi.fieldErrors };
  const formError = submitApi.error || (Object.keys(errors).length ? '请先修正标红的字段' : '');
  return h('div', { className: 'px-action-fields' },
    h('p', { className: 'px-action-hint' }, '复核只看实验是否满足冻结契约，不看叙事是否好听。'),
    h(PrimField, { label: '复核结论' },
      h(PrimSelect, {
        value: verdict,
        options: InspectVerdictOptions,
        onChange: (event) => setVerdict(event.target.value),
      })),
    h(PrimField, { label: '逐项结论', hint: '每行一条', error: fieldErrors.items },
      h(PrimArea, {
        rows: 4,
        value: items,
        placeholder: '例如：对照被破坏\n主指标超过基线',
        onChange: (event) => setItems(event.target.value),
      })),
    h(InspectActionError, { message: formError }),
    h('div', { className: 'px-inspector-actions' },
      h(InspectPrimary, { label: '记录复核', actionId: 'review', pending: submitApi.pending, busy: props.busy, disabled: props.disabled, onClick: onSubmit })));
}

function InspectStage4Form(props) {
  const submitApi = InspectUseSubmit(props, 'stage4');
  const [text, setText] = useState('');
  const [errors, setErrors] = useState({});

  function onSubmit() {
    if (!String(text).trim()) {
      setErrors({ text: '阶段四不能留空' });
      return;
    }
    setErrors({});
    void submitApi.submit({ text: String(text).trim() });
  }

  const fieldErrors = { ...errors, ...submitApi.fieldErrors };
  const formError = submitApi.error || (Object.keys(errors).length ? '请先修正标红的字段' : '');
  return h('div', { className: 'px-action-fields' },
    h('p', { className: 'px-action-hint' }, '依次写清：解读、追问、认知更新、决策、野心自省。'),
    h(PrimField, { label: '阶段四记录', error: fieldErrors.text },
      h(PrimArea, {
        rows: 7,
        value: text,
        placeholder: '解读：……\n追问：……\n认知：……\n决策：……\n野心自省：……',
        onChange: (event) => setText(event.target.value),
      })),
    h(InspectActionError, { message: formError }),
    h('div', { className: 'px-inspector-actions' },
      h(InspectPrimary, { label: '记录阶段四', actionId: 'stage4', pending: submitApi.pending, busy: props.busy, disabled: props.disabled, onClick: onSubmit })));
}

function InspectEvalForm(props) {
  const run = props.run;
  const submitApi = InspectUseSubmit(props, 'eval_report');
  const [reportHash, setReportHash] = useState('');
  const [verdict, setVerdict] = useState('suspect');
  const [seeds, setSeeds] = useState(() => String(run?.knobs?.evalSeeds ?? 3));
  const [errors, setErrors] = useState({});
  const [delegated, setDelegated] = useState(false);

  function onSubmit() {
    const next = {};
    if (!String(reportHash).trim()) next.reportHash = '评估报告哈希不能为空';
    if (!Number.isFinite(Number(seeds)) || Number(seeds) < 1) next.seeds = '种子数至少为 1';
    if (!delegated) next.delegation = '提交前必须勾选委托身份';
    setErrors(next);
    if (Object.keys(next).length) return;
    void submitApi.submit({
      reportHash: String(reportHash).trim(),
      verdict,
      seeds: Number(seeds),
      delegatedActor: 'evaluator',
    });
  }

  const fieldErrors = { ...errors, ...submitApi.fieldErrors };
  const formError = submitApi.error || (Object.keys(errors).length ? '请先修正标红的字段' : '');
  return h('div', { className: 'px-action-fields' },
    h('p', { className: 'px-action-hint' }, '评估由独立评估者产出；这里只登记报告与结论。'),
    h(PrimField, { label: '报告哈希', error: fieldErrors.reportHash },
      h(PrimInput, {
        value: reportHash,
        placeholder: '评估报告哈希',
        onChange: (event) => setReportHash(event.target.value),
      })),
    h('div', { className: 'px-form-grid' },
      h(PrimField, { label: '评估结论' },
        h(PrimSelect, {
          value: verdict,
          options: InspectVerdictOptions,
          onChange: (event) => setVerdict(event.target.value),
        })),
      h(PrimField, { label: '评估种子', error: fieldErrors.seeds },
        h(PrimInput, {
          value: seeds,
          inputMode: 'numeric',
          onChange: (event) => setSeeds(event.target.value),
        }))),
    h(PrimField, {
      label: '角色委托',
      hint: '独立评估必须由不同角色提交；直接以本人身份提交会被拒绝',
      error: fieldErrors.delegation,
    },
    h('label', { className: 'px-check' },
      h('input', {
        type: 'checkbox',
        'data-testid': 'delegation-checkbox',
        checked: delegated,
        onChange: (event) => setDelegated(event.target.checked),
      }),
      h('span', null, '我以独立评估者身份提交（将记录为委托，写入审计）'))),
    h(InspectActionError, { message: formError }),
    h('div', { className: 'px-inspector-actions' },
      h(InspectPrimary, { label: '提交评估报告', actionId: 'eval_report', pending: submitApi.pending, busy: props.busy, disabled: !delegated || props.disabled, onClick: onSubmit })));
}

function InspectEvalReadForm(props) {
  const run = props.run;
  const submitApi = InspectUseSubmit(props, 'eval_read');
  const [read, setRead] = useState(false);
  const [readBy, setReadBy] = useState(() => run?.eval?.readBy ?? '');
  const evalState = run?.eval ?? {};

  function onSubmit() {
    if (!read) return;
    void submitApi.submit({
      readBy: String(readBy).trim() || null,
      reportHash: evalState.reportHash ?? null,
    });
  }

  return h('div', { className: 'px-action-fields' },
    h(PrimKeyValue, {
      rows: [
        ['评估结论', PanelVerdictLabel(evalState.verdict)],
        ['评估种子', evalState.seeds == null ? '—' : String(evalState.seeds)],
        ['已读状态', evalState.readAt ? '已读' : '未读'],
      ].filter(Boolean),
    }),
    h('p', { className: 'px-action-hint' }, '未读评估报告时，候选晋升会被拒绝。'),
    h('label', { className: 'px-check' },
      h('input', {
        type: 'checkbox',
        checked: read,
        onChange: (event) => setRead(event.target.checked),
      }),
      h('span', null, '我已独立读过这份评估报告')),
    h(PrimField, { label: '阅读人', hint: '可选，写入回执' },
      h(PrimInput, {
        value: readBy,
        placeholder: '谁读的这份报告',
        onChange: (event) => setReadBy(event.target.value),
      })),
    h(InspectActionError, { message: submitApi.error }),
    h('div', { className: 'px-inspector-actions' },
      h(InspectPrimary, {
        label: '确认已读', actionId: 'eval_read',
        pending: submitApi.pending,
        busy: props.busy,
        disabled: !read,
        onClick: onSubmit,
      })));
}

function InspectMemoryForm(props) {
  const run = props.run;
  const proposals = Array.isArray(run?.memory?.proposals) ? run.memory.proposals : [];
  const commits = Array.isArray(run?.memory?.commits) ? run.memory.commits : [];
  const pendingProposals = proposals.filter((item) => item.status !== 'committed');
  const commitFirst = pendingProposals.length > 0;
  const commitApi = InspectUseSubmit(props, 'memory_commit');
  const proposeApi = InspectUseSubmit(props, 'memory_propose');
  const [claim, setClaim] = useState('');
  const [evidence, setEvidence] = useState('');
  const [selectedId, setSelectedId] = useState(() => pendingProposals[0]?.id ?? '');
  const [errors, setErrors] = useState({});
  const [proposeDelegated, setProposeDelegated] = useState(false);

  useEffect(() => {
    if (!selectedId && pendingProposals.length) setSelectedId(pendingProposals[0].id);
  }, [selectedId, pendingProposals.length]);

  function onPropose() {
    const next = {};
    if (!String(claim).trim()) next.claim = '提案必须写一条主张';
    if (!proposeDelegated) next.delegation = '提议前必须勾选 Agent 委托身份';
    setErrors(next);
    if (Object.keys(next).length) return;
    void proposeApi.submit({
      claim: String(claim).trim(),
      evidenceRefs: InspectLines(evidence),
      delegatedActor: 'root',
    });
  }

  function onCommit() {
    if (!selectedId) {
      setErrors({ proposalId: '先选择一条待提交的提案' });
      return;
    }
    setErrors({});
    void commitApi.submit({ proposalId: selectedId });
  }

  const proposeError = proposeApi.error || (errors.claim ? '请先修正标红的字段' : '');
  const commitError = commitApi.error || (errors.proposalId ? '请先修正标红的字段' : '');
  return h('div', { className: 'px-action-fields' },
    h('p', { className: 'px-action-hint' },
      `提案 ${proposals.length} 条 · 已提交 ${commits.length} 条。记忆提议需以 Agent 委托身份提交；提交到长期记忆是用户级动作。`),
    h('div', { className: 'px-action-section' },
      h('p', { className: 'px-section-title' }, '提出记忆提案'),
      h(PrimField, { label: '主张', error: errors.claim ?? proposeApi.fieldErrors.claim },
        h(PrimInput, {
          value: claim,
          placeholder: '这次运行最值得留下的一条结论',
          onChange: (event) => setClaim(event.target.value),
        })),
      h(PrimField, { label: '证据引用', hint: '逗号分隔，可选' },
        h(PrimInput, {
          value: evidence,
          placeholder: '产物哈希、评估报告哈希',
          onChange: (event) => setEvidence(event.target.value),
        })),
      h(PrimField, {
        label: '角色委托',
        hint: '记忆提议以 Agent 身份提交；直接以本人身份提交会被拒绝',
        error: errors.delegation,
      },
      h('label', { className: 'px-check' },
        h('input', {
          type: 'checkbox',
          'data-testid': 'delegation-checkbox',
          checked: proposeDelegated,
          onChange: (event) => setProposeDelegated(event.target.checked),
        }),
        h('span', null, '以 Agent 身份提议记忆（将记录为委托）'))),
      h(InspectActionError, { message: proposeError }),
      h('div', { className: 'px-inspector-actions' },
        commitFirst
          ? h(PrimBtn, {
            onClick: onPropose,
            disabled: !proposeDelegated || proposeApi.pending || props.busy || props.disabled,
          }, proposeApi.pending ? '提交中…' : '提出记忆')
          : h(InspectPrimary, {
            label: '提出记忆',
            actionId: 'memory_propose',
            pending: proposeApi.pending,
            busy: props.busy,
            disabled: !proposeDelegated || props.disabled,
            onClick: onPropose,
          }))),
    h('div', { className: 'px-action-section' },
      h('p', { className: 'px-section-title' }, '提交到长期记忆'),
      pendingProposals.length
        ? h(PrimField, { label: '待提交提案', error: errors.proposalId ?? commitApi.fieldErrors.proposalId },
          h(PrimSelect, {
            value: selectedId,
            options: pendingProposals.map((item) => [item.id, PrimShort(item.claim || '未命名提案', 28)]),
            onChange: (event) => setSelectedId(event.target.value),
          }))
        : h('p', { className: 'px-action-hint' }, '还没有待提交的提案；先提出一条记忆。'),
      h(InspectActionError, { message: commitError }),
      h('div', { className: 'px-inspector-actions' },
        commitFirst
          ? h(InspectPrimary, { label: '提交到长期记忆', actionId: 'memory_commit', pending: commitApi.pending, busy: props.busy, disabled: props.disabled, onClick: onCommit })
          : h(PrimBtn, { onClick: onCommit, disabled: true }, '提交到长期记忆'))));
}

function InspectDecisionForm(props) {
  const run = props.run;
  const submitApi = InspectUseSubmit(props, 'decision');
  const decisions = Array.isArray(run?.decisions) ? run.decisions : [];
  const last = decisions.length ? decisions[decisions.length - 1] : null;
  const [conclusion, setConclusion] = useState('');
  const [reason, setReason] = useState('');
  const [ambition, setAmbition] = useState('0.7');
  const [close, setClose] = useState(false);
  const [evidence, setEvidence] = useState('');
  const [errors, setErrors] = useState({});
  const [startPending, setStartPending] = useState(false);
  const [secondaryError, setSecondaryError] = useState('');

  function validate() {
    const next = {};
    if (String(conclusion).trim().length < 4) next.conclusion = '结论至少 4 个字符';
    const value = Number(ambition);
    if (!Number.isFinite(value) || value < 0 || value > 1) next.ambition = '野心必须在 0–1 之间';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function onSubmit() {
    if (!validate()) return;
    void submitApi.submit({
      conclusion: String(conclusion).trim(),
      reason: String(reason).trim(),
      next: close ? 'stop' : 'new-run',
      close,
      ambition: Number(ambition),
      evidenceRefs: InspectLines(evidence),
    });
  }

  async function onCloseRun() {
    if (typeof props.onAction !== 'function') return;
    setSecondaryError('');
    void submitApi.submit({
      conclusion: last?.conclusion ?? String(conclusion).trim() ?? '收束本轮',
      next: 'stop',
      close: true,
      reason: '关闭运行',
      ambition: Number(ambition),
      evidenceRefs: Array.isArray(last?.evidenceRefs) ? last.evidenceRefs : InspectLines(evidence),
    });
  }

  async function onStartNewRun() {
    if (typeof props.onAction !== 'function') return;
    setStartPending(true);
    setSecondaryError('');
    try {
      const receipt = await props.onAction('start', {
        playbookId: run?.playbookId,
        title: `${run?.title ?? '研究'} · 新运行`,
      }, { force: true });
      if (receipt && receipt.status === 'rejected') setSecondaryError('新建运行被拒绝');
    } catch (cause) {
      setSecondaryError(cause instanceof Error ? cause.message : '新建运行失败');
    } finally {
      setStartPending(false);
    }
  }

  const fieldErrors = { ...errors, ...submitApi.fieldErrors };
  const formError = submitApi.error || (Object.keys(errors).length ? '请先修正标红的字段' : '');
  const canCloseOrNew = run?.nextAction === 'close-or-new-run';
  return h('div', { className: 'px-action-fields' },
    last ? h('p', { className: 'px-action-hint' },
      `上次决策：${PrimShort(last.conclusion || '未填写结论', 24)} · ${InspectNextLabels[last.next] ?? '未说明'}`) : null,
    h(PrimField, { label: '结论', hint: '一句可检验的判断', error: fieldErrors.conclusion },
      h(PrimArea, {
        rows: 3,
        value: conclusion,
        placeholder: '例如：结构增益在容量匹配后消失，假设不成立',
        onChange: (event) => setConclusion(event.target.value),
      })),
    h(PrimField, { label: '理由', hint: '可选' },
      h(PrimArea, {
        rows: 2,
        value: reason,
        placeholder: '为什么得出这个结论',
        onChange: (event) => setReason(event.target.value),
      })),
    h(PrimField, { label: '野心', hint: '0–1', error: fieldErrors.ambition },
      h('div', { className: 'px-range-row' },
        h('input', {
          type: 'range',
          className: 'px-knob-range',
          min: 0,
          max: 1,
          step: 0.05,
          value: ambition,
          'aria-label': '野心',
          onChange: (event) => setAmbition(event.target.value),
        }),
        h('span', { className: 'px-range-value' }, Number(ambition).toFixed(2)))),
    h(PrimField, { label: '证据引用', hint: '逗号分隔，可选' },
      h(PrimInput, {
        value: evidence,
        placeholder: '支撑结论的证据',
        onChange: (event) => setEvidence(event.target.value),
      })),
    h('label', { className: 'px-check' },
      h('input', {
        type: 'checkbox',
        checked: close,
        onChange: (event) => setClose(event.target.checked),
      }),
      h('span', null, '本轮收束（关闭运行）')),
    h(InspectActionError, { message: formError }),
    h(InspectActionError, { message: secondaryError }),
    h('div', { className: 'px-inspector-actions' },
      h(InspectPrimary, { label: '记录决策', actionId: 'decision', pending: submitApi.pending, busy: props.busy, disabled: props.disabled, onClick: onSubmit })),
    canCloseOrNew
      ? h('div', { className: 'px-inspector-actions' },
        h(PrimBtn, { onClick: onCloseRun, disabled: submitApi.pending || props.busy, title: '记录收束决策并结束本轮' }, '关闭运行'),
        h(PrimBtn, { onClick: onStartNewRun, disabled: startPending, title: '保留现有运行，另起一个' }, startPending ? '新建中…' : '新建运行'))
      : null);
}

function InspectFallbackAction(props) {
  const { run, catalog } = props;
  const action = InspectActionFor(run, catalog);
  const stateLabel = InspectStateLabel(catalog, run?.state);
  return h('div', { className: 'px-action-fields' },
    h('p', { className: 'px-action-hint' },
      action.label
        ? `当前状态的下一步是「${action.label}」，请回到画布选中对应节点。`
        : '当前状态没有可提交的推进动作。'),
    stateLabel ? h('p', { className: 'px-action-hint' }, `运行状态：${stateLabel}`) : null);
}

/* ---------------------------------------------------------------- run body */

function InspectWhyBlocked(props) {
  const { run, nodeState, catalog } = props;
  const state = InspectNodeStateOf(nodeState);
  const rows = [];
  const seen = new Set();
  for (const code of Array.isArray(run?.blockers) ? run.blockers : []) {
    const text = InspectReasonText(catalog, code);
    const line = text || '条件未满足';
    if (!seen.has(line)) {
      seen.add(line);
      rows.push({ text: line, code: text ? null : code });
    }
  }
  if (state.reason && !seen.has(state.reason)) {
    seen.add(state.reason);
    rows.push({ text: state.reason, code: null });
  }
  if (!rows.length) return null;
  return h('section', { className: 'px-inspector-section' },
    h('p', { className: 'px-section-title' }, '为什么停在这里'),
    h('ul', { className: 'px-blocked-list' },
      rows.map((row, index) => h('li', {
        key: index,
        className: 'px-blocked-item',
        title: row.code ? `原因码 ${row.code}` : undefined,
      }, row.text))));
}

function InspectEventLine(event) {
  return h('li', { key: event.seq ?? event.at ?? event.type, className: 'px-inspector-event' },
    h('span', { className: 'px-inspector-event-time' }, PrimClock(event.at)),
    h('span', { className: 'px-inspector-event-text' },
      `${PanelEventLabel(event.type)} · ${PanelEventSummary(event)}`));
}

function InspectRunSummary(props) {
  const { run, catalog, onClose } = props;
  const stateLabel = InspectStateLabel(catalog, run?.state);
  const action = InspectActionFor(run, catalog);
  const stage = InspectStagePosition(run, catalog);
  const events = Array.isArray(run?.events) ? run.events.slice(-3).reverse() : [];
  const blockers = Array.isArray(run?.blockers) ? run.blockers : [];
  return h('aside', {
    className: 'px-inspector',
    'data-testid': 'inspector',
    'data-mode': 'run',
    role: 'dialog',
    'aria-label': '运行摘要',
    onKeyDown: (event) => { if (event.key === 'Escape') onClose?.(); },
  },
  h('header', { className: 'px-inspector-head' },
    h('div', { className: 'px-inspector-title' },
      h('strong', null, '运行摘要'),
      h('span', { className: 'px-inspector-sub' }, run?.title ?? '未选择运行')),
    h('button', {
      type: 'button',
      className: 'px-icon-btn px-inspector-close',
      'data-testid': 'inspector-close',
      'aria-label': '关闭检查器',
      onClick: onClose,
    }, '×')),
  h('div', { className: 'px-inspector-body' },
    h('div', { className: 'px-state-duo' },
      h('span', { className: 'px-chip active' }, stateLabel || '状态未知'),
      h('span', { className: 'px-chip' }, stage ? `阶段 ${stage.index + 1}/${stage.total}` : '阶段未知')),
    h('section', { className: 'px-inspector-section' },
      h('p', { className: 'px-section-title' }, '唯一主动作'),
      h('p', { className: 'px-inspector-note' }, action.label || '当前没有可提交的推进动作'),
      h('p', { className: 'px-inspector-note' }, '选中画布节点后，检查器显示可提交的表单。')),
    blockers.length
      ? h('section', { className: 'px-inspector-section' },
        h('p', { className: 'px-section-title' }, '阻塞原因'),
        h('ul', { className: 'px-blocked-list' },
          blockers.map((code, index) => {
            const text = InspectReasonText(catalog, code);
            return h('li', {
              key: index,
              className: 'px-blocked-item',
              title: text ? undefined : `原因码 ${code}`,
            }, text || '条件未满足');
          })))
      : null,
    h('section', { className: 'px-inspector-section' },
      h('p', { className: 'px-section-title' }, '最近事件'),
      events.length
        ? h('ul', { className: 'px-inspector-events' }, events.map((event) => InspectEventLine(event)))
        : h('p', { className: 'px-inspector-note' }, '还没有事件'))));
}

function InspectRunBody(props) {
  const { run, graph, node, nodeState, current, catalog, onClose, busy, onOpenPanel } = props;
  const nodeStateValue = InspectNodeStateOf(nodeState);
  const execution = InspectExecutionMeta(catalog, nodeStateValue.execution);
  const condition = InspectConditionMeta(catalog, nodeStateValue.condition);
  const action = InspectActionFor(run, catalog);
  const stage = InspectStagePosition(run, catalog);
  const auditBlocked = graph?.audit?.ok === false;
  const repairAllowed = action.actionId === 'question' || action.actionId === 'prereg_freeze';
  const actionDisabled = auditBlocked && !repairAllowed;
  const formKey = action.formKey;
  const isCurrent = Boolean(node && current && node.id === current);
  const nodeAction = node?.config?.action ?? null;
  const executable = Boolean(formKey) && (nodeAction === action.actionId || isCurrent);
  const owner = InspectActionOwner(graph, action.actionId, current);
  const ownerLabel = InspectNodeLabel(owner, catalog);
  const showWhyBlocked = isCurrent
    || nodeStateValue.execution === 'blocked'
    || nodeStateValue.execution === 'failed';
  const claims = Array.isArray(run?.claims) ? run.claims : [];
  const reviews = Array.isArray(run?.reviews) ? run.reviews : [];
  const evalState = run?.eval ?? {};
  const typeLabel = InspectNodeTypeLabels[node?.type] ?? '节点';
  const formProps = { ...props, actionId: action.actionId, actionLabel: action.label, disabled: actionDisabled };
  const form = formKey
    ? (() => {
      const Component = {
        question: InspectQuestionForm,
        prereg: InspectPreregForm,
        discussion: InspectDiscussionForm,
        experiment: InspectExperimentForm,
        review: InspectReviewForm,
        stage4: InspectStage4Form,
        eval: InspectEvalForm,
        evalread: InspectEvalReadForm,
        memory: InspectMemoryForm,
        decision: InspectDecisionForm,
      }[formKey];
      return h(Component, { key: `${run?.id ?? 'run'}:${formKey}`, ...formProps });
    })()
    : h(InspectFallbackAction, formProps);

  return h('aside', {
    className: 'px-inspector',
    'data-testid': 'inspector',
    'data-mode': 'run',
    role: 'dialog',
    'aria-label': node ? `${InspectNodeLabel(node, catalog) || '节点'} 检查器` : '运行检查器',
    onKeyDown: (event) => { if (event.key === 'Escape') onClose?.(); },
  },
  h('header', { className: 'px-inspector-head' },
    h('div', { className: 'px-inspector-title' },
      h('strong', null, InspectNodeLabel(node, catalog) || '运行摘要'),
      h('span', { className: 'px-inspector-sub' },
        stage ? `${typeLabel} · 阶段 ${stage.index + 1}/${stage.total}` : typeLabel)),
    h('button', {
      type: 'button',
      className: 'px-icon-btn px-inspector-close',
      'data-testid': 'inspector-close',
      'aria-label': '关闭检查器',
      onClick: onClose,
    }, '×')),
  h('div', { className: 'px-inspector-body' },
    h('div', { className: 'px-state-duo' },
      h('span', {
        className: PrimCls('px-chip', execution.tone, 'px-state-chip'),
        'data-testid': 'execution-chip',
        title: '执行轴',
      }, `执行 · ${execution.label}`),
      h('span', {
        className: PrimCls('px-chip', condition.tone, 'px-state-chip'),
        'data-testid': 'condition-chip',
        title: '条件轴',
      }, `条件 · ${condition.label}`)),
    showWhyBlocked ? h(InspectWhyBlocked, { run, nodeState, catalog }) : null,
    auditBlocked && !repairAllowed
      ? h(PrimBanner, { tone: 'bad' }, '状态不一致，需要核对；修正前不能推进运行。')
      : null,
    h('section', { className: 'px-inspector-section' },
      h('div', { className: 'px-action-head' },
        h('span', { className: 'px-action-kicker' }, '运行下一步'),
        h('strong', null, ownerLabel ? `· ${ownerLabel}` : (action.label || '暂无'))),
      h('p', { className: 'px-action-owner' },
        action.label ? `动作：${action.label}` : '当前没有待执行的运行动作'),
      executable
        ? h('div', {
          className: 'px-action-form',
          'data-testid': 'action-form',
          'data-action': action.actionId ?? '',
        }, form)
        : h('div', {
          className: 'px-action-form px-action-readonly',
          'data-testid': 'action-form',
          'data-action': action.actionId ?? '',
          'data-readonly': 'true',
        },
          h('p', { className: 'px-action-note', 'data-testid': 'action-readonly' },
            action.actionId
              ? (nodeStateValue.execution === 'done'
                ? '该节点已走过；下一步在运行条。'
                : '该节点尚未到达；下一步在运行条。')
              : '当前状态没有可提交的推进动作。')))),
  h('footer', { className: 'px-inspector-foot' },
    h('div', { className: 'px-inspector-evidence' },
      h('span', null,
        `主张 ${claims.length} · 复核 ${reviews.length} · 评估 ${evalState.readAt ? '已读' : (evalState.reportHash ? '未读' : '缺失')}`),
      typeof onOpenPanel === 'function'
        ? h(PrimBtn, { onClick: () => onOpenPanel('evidence') }, '证据链')
        : null)));
}

/* ---------------------------------------------------------------- blueprint */

function InspectNodeDraft(node) {
  return {
    type: node?.type ?? 'stage',
    label: node?.label ?? '',
    stage: node?.stage ?? '',
    action: node?.config?.action ?? '',
  };
}

function InspectBlueprintGraph(graph, node, draft) {
  const next = InspectCloneGraph(graph);
  next.nodes = (next.nodes ?? []).map((item) => {
    if (item.id !== node.id) return item;
    const config = { ...(item.config ?? {}) };
    const action = String(draft.action ?? '').trim();
    if (action) config.action = action; else delete config.action;
    const copy = {
      ...item,
      type: draft.type,
      label: String(draft.label ?? '').trim() || item.label,
      config,
    };
    const stage = String(draft.stage ?? '').trim();
    if (stage) copy.stage = stage; else delete copy.stage;
    return copy;
  });
  return next;
}

function InspectBlueprintPanel(props) {
  const { graph, node, catalog, onClose, validation, diff } = props;
  const [draft, setDraft] = useState(() => InspectNodeDraft(node));
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, setPending] = useState(false);
  const [applied, setApplied] = useState('');
  const [applyError, setApplyError] = useState('');
  const protectedNode = InspectIsProtected(node);
  const canDraft = typeof props.onDraftChange === 'function';
  const canSave = typeof props.onSaveBlueprint === 'function';

  useEffect(() => {
    setDraft(InspectNodeDraft(node));
    setConfirmDelete(false);
    setApplied('');
    setApplyError('');
  }, [node?.id, node?.label, node?.type, node?.stage, node?.config?.action]);

  async function applyGraph(next, successText) {
    setApplyError('');
    if (canDraft) {
      props.onDraftChange(next);
      setApplied(successText);
      return;
    }
    if (!canSave) {
      setApplyError('当前没有保存通道');
      return;
    }
    setPending(true);
    try {
      const receipt = await props.onSaveBlueprint(next, { expectedRevision: graph?.revision });
      if (receipt && receipt.status === 'rejected') setApplyError('保存被拒绝，请检查校验结果');
      else setApplied('已保存');
    } catch (cause) {
      setApplyError(cause instanceof Error ? cause.message : '保存失败');
    } finally {
      setPending(false);
    }
  }

  function onApply() {
    void applyGraph(InspectBlueprintGraph(graph, node, draft), canDraft ? '已写入草稿，确认后在画布工具条保存' : '已保存');
  }

  const applyLabel = canDraft ? '应用修改' : (canSave ? '提交修改' : '应用修改');

  function onDelete() {
    if (protectedNode) return;
    void applyGraph(InspectNodeRemove(graph, node.id), '已从草稿移除');
  }

  const incoming = (graph?.edges ?? []).filter((edge) => edge.to === node.id);
  const outgoing = (graph?.edges ?? []).filter((edge) => edge.from === node.id);
  const labelOf = (id) => InspectNodeLabel((graph?.nodes ?? []).find((item) => item.id === id), catalog) || '未知节点';
  const actionOptions = [['', '（不绑定动作）'], ...((catalog?.actions ?? []).map((item) => [item.id, item.label]))];
  const typeOptions = Object.entries(InspectNodeTypeLabels).map(([value, label]) => [value, label]);
  const validationErrors = InspectValidationList(validation);
  const diffText = InspectDiffText(diff);

  return h('aside', {
    className: 'px-inspector',
    'data-testid': 'inspector',
    'data-mode': 'blueprint',
    role: 'dialog',
    'aria-label': `${InspectNodeLabel(node, catalog) || '节点'} 蓝图编辑`,
    onKeyDown: (event) => { if (event.key === 'Escape') onClose?.(); },
  },
  h('header', { className: 'px-inspector-head' },
    h('div', { className: 'px-inspector-title' },
      h('strong', null, InspectNodeLabel(node, catalog) || '节点'),
      h('span', { className: 'px-inspector-sub' },
        `蓝图编辑 · ${protectedNode ? '受保护节点' : '可编辑'}${graph?.revision != null ? ` · 图版本 ${graph.revision}` : ''}`)),
    h('button', {
      type: 'button',
      className: 'px-icon-btn px-inspector-close',
      'data-testid': 'inspector-close',
      'aria-label': '关闭检查器',
      onClick: onClose,
    }, '×')),
  h('div', { className: 'px-inspector-body' },
    h('section', { className: 'px-inspector-section' },
      h('p', { className: 'px-section-title' }, '节点字段'),
      h(PrimField, { label: '节点 ID', hint: '只读' },
        h(PrimInput, { value: node?.id ?? '', readOnly: true, onFocus: (event) => event.target.select() })),
      h(PrimField, { label: '类型' },
        h(PrimSelect, {
          value: draft.type,
          options: typeOptions,
          onChange: (event) => setDraft((prev) => ({ ...prev, type: event.target.value })),
        })),
      h(PrimField, { label: '中文标签' },
        h(PrimInput, {
          value: draft.label,
          onChange: (event) => setDraft((prev) => ({ ...prev, label: event.target.value })),
        })),
      h(PrimField, { label: '阶段', hint: '留空表示无阶段' },
        h(PrimInput, {
          value: draft.stage,
          onChange: (event) => setDraft((prev) => ({ ...prev, stage: event.target.value })),
        })),
      h(PrimField, { label: '绑定动作', hint: '只有绑定动作的节点才能推进运行' },
        h(PrimSelect, {
          value: draft.action,
          options: actionOptions,
          onChange: (event) => setDraft((prev) => ({ ...prev, action: event.target.value })),
        }))),
    h('section', { className: 'px-inspector-section' },
      h('p', { className: 'px-section-title' }, '端口列表'),
      h('p', { className: 'px-inspector-note' },
        `输入 ${incoming.length} 个${node?.type === 'gate' ? ' · 门禁出边端口固定为契约' : ''}`),
      incoming.length
        ? h('div', { className: 'px-port-list' },
          incoming.map((edge) => h('span', { key: edge.id ?? `${edge.from}-${edge.to}`, className: 'px-chip' },
            `${labelOf(edge.from)} · ${InspectPortLabels[edge.port] ?? '产物'}`)))
        : h('p', { className: 'px-inspector-note' }, '没有输入连线'),
      h('p', { className: 'px-inspector-note' }, `输出 ${outgoing.length} 个`),
      outgoing.length
        ? h('div', { className: 'px-port-list' },
          outgoing.map((edge) => h('span', { key: edge.id ?? `${edge.from}-${edge.to}`, className: 'px-chip' },
            `${labelOf(edge.to)} · ${InspectPortLabels[edge.port] ?? '产物'}`)))
        : h('p', { className: 'px-inspector-note' }, '没有输出连线')),
    validationErrors.length
      ? h('section', { className: 'px-inspector-section' },
        h('p', { className: 'px-section-title' }, '校验错误'),
        h(PrimBanner, { tone: 'bad' }, '当前草稿未通过校验'),
        h('ul', { className: 'px-blocked-list' },
          validationErrors.map((message, index) => h('li', { key: index, className: 'px-blocked-item' }, message))))
      : null,
    diffText
      ? h('p', { className: 'px-inspector-note' }, `与已保存图的差异：${diffText}`)
      : null,
    h(InspectActionError, { message: applyError }),
    applied ? h(PrimBanner, { tone: 'ok' }, applied) : null),
  h('footer', { className: 'px-inspector-foot' },
    h('div', { className: 'px-inspector-actions' },
      h(PrimBtn, {
        tone: 'danger',
        disabled: protectedNode || pending,
        title: protectedNode ? '受保护节点不可删除' : '从草稿中移除该节点',
        onClick: () => setConfirmDelete(true),
      }, '删除节点'),
      h(PrimBtn, {
        disabled: !canDraft && !canSave,
        title: canDraft ? '把字段修改写入蓝图草稿，保存由画布工具条确认' : '当前没有草稿通道',
        onClick: onApply,
      }, pending ? '应用中…' : applyLabel)),
    confirmDelete
      ? h('div', { className: 'px-inspector-actions' },
        h(PrimBtn, { onClick: () => setConfirmDelete(false) }, '取消'),
        h(PrimBtn, { tone: 'danger', onClick: onDelete, disabled: pending }, '确认删除'))
      : null,
    protectedNode
      ? h('p', { className: 'px-inspector-note' }, '受保护节点由剧本定义，不能删除。')
      : null));
}

/* ---------------------------------------------------------------- entry */

function InspectPanel(props) {
  const mode = props.mode === 'blueprint' ? 'blueprint' : 'run';
  if (mode === 'blueprint') return h(InspectBlueprintPanel, props);
  if (!props.node) return h(InspectRunSummary, props);
  return h(InspectRunBody, props);
}

/* ---------------------------------------------------------------- styles */

const InspectCss = `
.px-inspector-sub { font-size: var(--px-fs-3); color: var(--dsw-alias-label-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.px-inspector-section { display: grid; gap: 6px; }
.px-section-title { font-size: var(--px-fs-3); letter-spacing: .08em; color: var(--dsw-alias-label-secondary); }
.px-inspector-note { font-size: var(--px-fs-3); color: var(--dsw-alias-label-secondary); line-height: 1.5; }
.px-inspector-evidence { display: flex; align-items: center; justify-content: space-between; gap: 8px; font-size: var(--px-fs-3); color: var(--dsw-alias-label-secondary); }
.px-action-head { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
.px-action-head strong { font-size: var(--px-fs-2); font-weight: 600; }
.px-action-kicker { font-size: var(--px-fs-3); letter-spacing: .08em; color: var(--dsw-alias-label-secondary); }
.px-action-fields { display: grid; gap: 10px; }
.px-action-hint { font-size: var(--px-fs-3); color: var(--dsw-alias-label-secondary); line-height: 1.5; }
.px-action-owner { font-size: var(--px-fs-3); color: var(--dsw-alias-label-secondary); }
.px-action-note { font-size: var(--px-fs-2); color: var(--dsw-alias-label-secondary); line-height: 1.55; border-left: 2px solid var(--dsw-alias-border-l2); padding-left: 8px; }
.px-action-readonly .px-action-note { color: var(--dsw-alias-label-secondary); }
.px-action-section { display: grid; gap: 8px; border-top: 1px solid var(--dsw-alias-border-l1); padding-top: 8px; }
.px-blocked-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; }
.px-blocked-item { font-size: var(--px-fs-2); color: var(--dsw-alias-state-warn-primary); border-left: 2px solid var(--dsw-alias-state-warn-primary); padding-left: 8px; line-height: 1.45; }
.px-state-chip { font-variant-numeric: tabular-nums; }
.px-form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.px-disclose { border: 0; background: transparent; padding: 0; text-align: left; cursor: pointer; font-size: var(--px-fs-3); color: var(--dsw-alias-brand-primary); }
.px-check { display: flex; align-items: center; gap: 6px; font-size: var(--px-fs-2); color: var(--dsw-alias-label-primary); }
.px-check input { accent-color: var(--dsw-alias-brand-primary); }
.px-range-row { display: flex; align-items: center; gap: 8px; }
.px-range-value { font-size: var(--px-fs-2); color: var(--dsw-alias-label-primary); font-variant-numeric: tabular-nums; min-width: 32px; text-align: right; }
.px-inspector-events { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; }
.px-inspector-event { display: grid; grid-template-columns: 38px 1fr; gap: 6px; font-size: var(--px-fs-3); color: var(--dsw-alias-label-secondary); line-height: 1.45; }
.px-inspector-event-time { color: var(--dsw-alias-label-secondary); font-variant-numeric: tabular-nums; }
.px-inspector-event-text { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.px-port-list { display: flex; flex-wrap: wrap; gap: 4px; }
.px-source-area { min-height: 220px; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: var(--px-fs-3); line-height: 1.5; }
`;

/* ===== 50-panels.js ===== */
/* Drawers: source / runs / map / knobs / audit / evidence.
 * Prefix Panel*. Contract §4.2, §5.1, §5.5; T8.2 catalog is the only Chinese
 * state source; map colors come from real claim.status values.
 * DOM hooks: drawer[data-drawer] / drawer-close / map-node[data-status] /
 * source-save / source-validate / run-item[data-run-id] / audit-violation. */

/* ---------------------------------------------------------------- shared */

function PanelButton({ label, testid, primary, scope, disabled, onClick, title }) {
  return h('button', {
    type: 'button',
    className: PrimCls('px-btn', primary && 'primary'),
    'data-testid': testid,
    'data-primary-scope': primary ? (scope ?? 'drawer') : undefined,
    disabled,
    title,
    onClick: disabled ? undefined : onClick,
  }, label);
}

function PanelStateLabel(catalog, stateId) {
  const meta = (catalog?.states ?? []).find((item) => item.id === stateId);
  return meta?.label ?? '';
}

function PanelVerdictLabel(verdict) {
  if (verdict === 'pass') return '通过';
  if (verdict === 'suspect') return '存疑';
  if (verdict === 'fail') return '失败';
  return '未说明';
}

function PanelClaimStatus(status) {
  const value = String(status ?? '').toLowerCase();
  if (value === 'supported' || value === 'verified' || value === 'ok') return { id: 'supported', label: '已支持' };
  if (value === 'contradicted' || value === 'refuted' || value === 'rejected') return { id: 'contradicted', label: '被反驳' };
  if (value === 'obsolete' || value === 'archived' || value === 'retired') return { id: 'obsolete', label: '已过时' };
  if (value === 'unknown') return { id: 'unknown', label: '未知' };
  return { id: 'unknown', label: '未验证' };
}

function PanelClaimStatusLabel(status) {
  return PanelClaimStatus(status).label;
}

function PanelEdgeKind(kind) {
  const value = String(kind ?? '').toLowerCase();
  if (value.includes('contradict') || value.includes('refut')) return 'contradicts';
  if (value.includes('support') || value.includes('entail')) return 'supports';
  if (value.includes('depend') || value.includes('derive') || !value) return 'depends';
  return 'other';
}

function PanelMapLayout(nodes) {
  const columns = 2;
  const boxWidth = 196;
  const boxHeight = 58;
  const gapX = 12;
  const gapY = 12;
  const pad = 8;
  const positions = {};
  (nodes ?? []).forEach((node, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    positions[node.id] = { x: pad + column * (boxWidth + gapX), y: pad + row * (boxHeight + gapY) };
  });
  const rows = Math.ceil((nodes ?? []).length / columns);
  const height = Math.max(boxHeight + pad * 2, pad * 2 + rows * (boxHeight + gapY) - gapY);
  return { positions, width: pad * 2 + columns * boxWidth + gapX, height, boxWidth, boxHeight };
}

const PanelEventLabels = {
  'run.started': '运行开始',
  'run.forked': '派生新运行',
  'question.recorded': '研究问题已记录',
  'prereg.frozen': '预注册已冻结',
  'prereg.violation': '预注册被篡改',
  'discussion.recorded': '讨论已记录',
  'persona.pinned': '人格已固定',
  'experiment.recorded': '实验已记录',
  'review.recorded': '复核已记录',
  'stage4.recorded': '阶段四已记录',
  'eval.reported': '评估报告已提交',
  'eval.read': '评估报告已读',
  'memory.proposed': '记忆提案已提出',
  'memory.committed': '记忆已提交',
  'decision.recorded': '决策已记录',
  'drift.detected': '检测到漂移',
  'unknown.fear': '未知恐惧被拦截',
  'gate.denied': '门禁拒绝',
  'transition.denied': '非法转移被拒绝',
  'corruption.detected': '检测到腐化',
  'boundary.denied': '越界修改被拒绝',
  'candidate.promoted': '候选已晋升',
  'map.claim': '认知地图新增主张',
  'map.edge': '认知地图新增连线',
  'migration.reconciled': '迁移已校准',
};

function PanelEventLabel(type) {
  return PanelEventLabels[type] ?? '其他事件';
}

function PanelEventSummary(event) {
  const data = event?.data ?? {};
  const type = event?.type;
  const short = (value, size = 22) => PrimShort(value, size);
  if (type === 'run.started') return data.title ? `标题：${short(data.title, 20)}` : '已创建运行';
  if (type === 'run.forked') return '由旋钮修改派生';
  if (type === 'question.recorded') return data.text ? short(data.text, 26) : '已记录研究问题';
  if (type === 'prereg.frozen') return '契约已冻结，后续不可修改';
  if (type === 'prereg.violation') return '冻结后试图改动契约';
  if (type === 'discussion.recorded') {
    const heterogeneity = typeof data.D === 'number' ? data.D.toFixed(2) : '—';
    return `第 ${data.round ?? '—'} 轮 · 异质度 ${heterogeneity}`;
  }
  if (type === 'persona.pinned') return data.role ? `角色：${short(data.role, 16)}` : '已固定人格';
  if (type === 'experiment.recorded') return data.id ? `实验 ${short(data.id, 12)}` : '已记录实验';
  if (type === 'review.recorded') return `结论：${PanelVerdictLabel(data.verdict)} · 逐项 ${data.items ?? 0}`;
  if (type === 'stage4.recorded') return '阶段四自省已记录';
  if (type === 'eval.reported') return `结论：${PanelVerdictLabel(data.verdict)}`;
  if (type === 'eval.read') return '评估报告已读';
  if (type === 'memory.proposed') return data.claim ? short(data.claim, 24) : '已提出记忆';
  if (type === 'memory.committed') return '提案已提交到长期记忆';
  if (type === 'decision.recorded') return data.conclusion ? short(data.conclusion, 24) : '已记录决策';
  if (type === 'drift.detected') return '同一结论重复，需要转向或停止';
  if (type === 'unknown.fear') return '决策文本触发未知恐惧拦截';
  if (type === 'gate.denied') return '门禁拒绝了推进';
  if (type === 'transition.denied') return '状态机拒绝了非法转移';
  if (type === 'corruption.detected') return '质量门检测到腐化信号';
  if (type === 'boundary.denied') return '内核路径修改被拒绝';
  if (type === 'candidate.promoted') return '候选改动已晋升';
  if (type === 'map.claim') return data.status ? `状态：${PanelClaimStatusLabel(data.status)}` : '已登记主张';
  if (type === 'map.edge') return '已登记主张间关系';
  if (type === 'migration.reconciled') return '旧数据已迁移校准';
  return '—';
}

function PanelGraphDiff(before, after) {
  const empty = {
    total: 0, lines: ['与当前图一致'], nodesAdded: [], nodesRemoved: [], nodesChanged: [], edgesAdded: 0, edgesRemoved: 0,
  };
  if (!before || !after) return empty;
  const beforeNodes = new Map((before.nodes ?? []).map((node) => [node.id, node]));
  const afterNodes = new Map((after.nodes ?? []).map((node) => [node.id, node]));
  const nodesAdded = [];
  const nodesRemoved = [];
  const nodesChanged = [];
  for (const [id, node] of afterNodes) {
    if (!beforeNodes.has(id)) nodesAdded.push(node.label ?? '未命名节点');
  }
  for (const [id, node] of beforeNodes) {
    if (!afterNodes.has(id)) nodesRemoved.push(node.label ?? '未命名节点');
  }
  for (const [id, node] of afterNodes) {
    const old = beforeNodes.get(id);
    if (old && JSON.stringify(old) !== JSON.stringify(node)) nodesChanged.push(node.label ?? '未命名节点');
  }
  const edgeKey = (edge) => `${edge.from}->${edge.to}:${edge.port ?? ''}`;
  const beforeEdges = new Set((before.edges ?? []).map(edgeKey));
  const afterEdges = new Set((after.edges ?? []).map(edgeKey));
  let edgesAdded = 0;
  let edgesRemoved = 0;
  for (const key of afterEdges) if (!beforeEdges.has(key)) edgesAdded += 1;
  for (const key of beforeEdges) if (!afterEdges.has(key)) edgesRemoved += 1;
  const lines = [];
  if (nodesAdded.length) lines.push(`新增节点：${nodesAdded.join('、')}`);
  if (nodesRemoved.length) lines.push(`删除节点：${nodesRemoved.join('、')}`);
  if (nodesChanged.length) lines.push(`修改节点：${nodesChanged.join('、')}`);
  if (edgesAdded) lines.push(`新增连线 ${edgesAdded} 条`);
  if (edgesRemoved) lines.push(`删除连线 ${edgesRemoved} 条`);
  const total = nodesAdded.length + nodesRemoved.length + nodesChanged.length + edgesAdded + edgesRemoved;
  if (!total) lines.push('与当前图一致');
  return {
    total, lines, nodesAdded, nodesRemoved, nodesChanged, edgesAdded, edgesRemoved,
  };
}

function PanelValidateGraph(graph) {
  if (!graph || typeof graph !== 'object' || Array.isArray(graph)) return ['内容必须是 JSON 对象'];
  const errors = [];
  const nodes = Array.isArray(graph.nodes) ? graph.nodes : null;
  const edges = Array.isArray(graph.edges) ? graph.edges : null;
  if (!nodes) errors.push('缺少节点列表');
  if (!edges) errors.push('缺少连线列表');
  if (nodes) {
    if (!nodes.length) errors.push('节点列表为空');
    const ids = new Set();
    for (const node of nodes) {
      if (!node || typeof node !== 'object') {
        errors.push('存在无效节点');
        continue;
      }
      if (!node.id || typeof node.id !== 'string') {
        errors.push('存在缺少 ID 的节点');
        continue;
      }
      if (ids.has(node.id)) errors.push(`节点 ID 重复：${node.id}`);
      ids.add(node.id);
      if (!node.type) errors.push(`节点「${node.label ?? node.id}」缺少类型`);
      if (!node.label) errors.push(`节点「${node.id}」缺少中文标签`);
    }
    if (!nodes.some((node) => node && node.type === 'start')) errors.push('缺少起点节点');
    if (!nodes.some((node) => node && node.type === 'end')) errors.push('缺少终点节点');
  }
  if (nodes && edges) {
    const byId = new Map(nodes.filter(Boolean).map((node) => [node.id, node]));
    const seen = new Set();
    for (const edge of edges) {
      if (!edge || typeof edge !== 'object') {
        errors.push('存在无效连线');
        continue;
      }
      if (!byId.has(edge.from) || !byId.has(edge.to)) {
        errors.push('连线引用了不存在的节点');
        continue;
      }
      if (edge.from === edge.to) errors.push('连线不能指向自身');
      const key = `${edge.from}->${edge.to}`;
      if (seen.has(key)) errors.push('存在重复连线');
      seen.add(key);
      const fromNode = byId.get(edge.from);
      if (fromNode && fromNode.type === 'gate' && edge.port && edge.port !== 'contract') {
        errors.push('门禁节点的出边端口必须是契约');
      }
    }
  }
  return errors;
}

function PanelReceiptStatus(status) {
  if (status === 'committed') return '已提交';
  if (status === 'rejected') return '被拒绝';
  if (status === 'replayed') return '重放';
  return '已记录';
}

/* ---------------------------------------------------------------- drawer */

function PanelDrawer(props) {
  const { id, title, hint, onClose, children, footer } = props;
  const ref = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    const target = ref.current?.querySelector('[data-drawer-autofocus]')
      ?? ref.current?.querySelector('button, input, select, textarea');
    if (target && typeof target.focus === 'function') target.focus();
    return () => {
      if (previous && typeof previous.focus === 'function' && document.contains(previous)) previous.focus();
    };
  }, []);
  return h('div', {
    className: 'px-drawer-mask',
    onPointerDown: (event) => {
      if (event.target === event.currentTarget) onClose?.();
    },
  },
  h('aside', {
    className: 'px-drawer',
    role: 'dialog',
    'aria-modal': 'true',
    'aria-label': title,
    'data-testid': 'drawer',
    'data-drawer': id,
    ref,
    onKeyDown: (event) => { if (event.key === 'Escape') onClose?.(); },
  },
  h('header', { className: 'px-drawer-head' },
    h('strong', null, title),
    hint ? h('span', { className: 'px-drawer-hint' }, hint) : null,
    h('button', {
      type: 'button',
      className: 'px-icon-btn px-drawer-close',
      'data-testid': 'drawer-close',
      'data-drawer-autofocus': 'true',
      'aria-label': '关闭抽屉',
      onClick: onClose,
    }, '×')),
  h('div', { className: 'px-drawer-body' }, children),
  footer ? h('footer', { className: 'px-drawer-foot' }, footer) : null));
}

/* ---------------------------------------------------------------- source */

function PanelSource(props) {
  const graph = props.graph;
  const [text, setText] = useState(() => (graph ? JSON.stringify(graph, null, 2) : ''));
  const [dirty, setDirty] = useState(false);
  const [errors, setErrors] = useState([]);
  const [diffLines, setDiffLines] = useState([]);
  const [notice, setNotice] = useState('');
  const [pending, setPending] = useState(false);
  const revision = graph?.revision ?? graph?.contentHash ?? '';

  useEffect(() => {
    if (!dirty) setText(graph ? JSON.stringify(graph, null, 2) : '');
  }, [revision, dirty, graph]);

  function parseDraft() {
    if (!String(text).trim()) return { ok: false, errors: ['内容为空'] };
    let parsed = null;
    try {
      parsed = JSON.parse(text);
    } catch (cause) {
      return { ok: false, errors: [`JSON 语法错误：${cause instanceof Error ? cause.message : '无法解析'}`] };
    }
    const list = PanelValidateGraph(parsed);
    return { ok: list.length === 0, errors: list, graph: parsed };
  }

  function onValidate() {
    const result = parseDraft();
    setErrors(result.errors);
    setNotice('');
    if (result.ok) {
      setDiffLines(PanelGraphDiff(graph, result.graph).lines);
      setNotice('校验通过');
    } else {
      setDiffLines([]);
    }
  }

  async function onSave() {
    const result = parseDraft();
    setErrors(result.errors);
    if (!result.ok) {
      setNotice('');
      return;
    }
    if (typeof props.onSave !== 'function') {
      setErrors(['当前没有保存通道']);
      return;
    }
    setPending(true);
    setNotice('');
    try {
      const receipt = await props.onSave(result.graph, { expectedRevision: graph?.revision });
      if (receipt && receipt.status === 'rejected') {
        const list = Array.isArray(receipt.errors)
          ? receipt.errors.map((item) => (typeof item === 'string' ? item : item?.message ?? '校验失败'))
          : [];
        setErrors(list.length ? list : ['保存被拒绝，请先修正校验错误']);
      } else if (receipt && (receipt.status === 'committed' || receipt.status === 'replayed')) {
        setDirty(false);
        setDiffLines([]);
        setErrors([]);
        setNotice('已保存，正在刷新图版本');
      } else {
        setNotice('已提交');
      }
    } catch (cause) {
      setErrors([cause instanceof Error ? cause.message : '保存失败']);
    } finally {
      setPending(false);
    }
  }

  const children = [];
  children.push(h('p', { key: 'hint', className: 'px-drawer-note' },
    '与画布同一 schema。保存前先校验；服务端会再校验一次并生成新的图版本。'));
  if (!graph) {
    children.push(h(PrimEmpty, {
      key: 'empty',
      title: '没有可编辑的流程图',
      hint: '先新建或选择一个研究运行，再编辑流程图源码。',
    }));
  } else {
    children.push(h(PrimField, { key: 'editor', label: 'JSON 源码', hint: dirty ? '有未保存修改' : '' },
      h(PrimArea, {
        className: 'px-input px-area px-source-area',
        rows: 20,
        value: text,
        spellCheck: false,
        placeholder: '粘贴或编辑流程图 JSON',
        onChange: (event) => { setText(event.target.value); setDirty(true); setNotice(''); },
      })));
    if (notice) {
      children.push(h(PrimBanner, { key: 'notice', tone: errors.length ? 'bad' : 'ok' }, notice));
    }
    if (errors.length) {
      children.push(h('ul', { key: 'errors', className: 'px-error-list' },
        errors.map((message, index) => h('li', { key: index }, message))));
    }
    if (diffLines.length) {
      children.push(h('div', { key: 'diff', className: 'px-diff' },
        h('p', { className: 'px-section-title' }, '与当前图的差异'),
        h('ul', { className: 'px-diff-list' },
          diffLines.map((line, index) => h('li', { key: index }, line)))));
    }
  }

  return h(PanelDrawer, {
    id: 'source',
    title: '流程图源码',
    hint: graph?.revision != null ? `图版本 ${graph.revision}` : '',
    onClose: props.onClose,
    footer: h('div', { className: 'px-row' },
      h(PrimBtn, { onClick: () => { setText(graph ? JSON.stringify(graph, null, 2) : ''); setDirty(false); setErrors([]); setNotice(''); setDiffLines([]); }, disabled: !graph }, '重载'),
      h(PanelButton, { label: '校验', testid: 'source-validate', onClick: onValidate, disabled: !graph }),
      h(PanelButton, { label: pending ? '保存中…' : '保存', testid: 'source-save', primary: true, scope: 'drawer', onClick: onSave, disabled: !graph || pending })),
  }, children);
}

/* ---------------------------------------------------------------- runs */

function PanelRuns(props) {
  const runs = Array.isArray(props.runs) ? props.runs : [];
  const playbooks = Array.isArray(props.playbooks) ? props.playbooks : [];
  const activate = typeof props.onActivate === 'function' ? props.onActivate : props.onSelectRun;
  const [title, setTitle] = useState('');
  const [playbookId, setPlaybookId] = useState(() => playbooks[0]?.id ?? '');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const byId = new Map(runs.map((run) => [run.id, run]));

  useEffect(() => {
    if (!playbookId && playbooks.length) setPlaybookId(playbooks[0].id);
  }, [playbookId, playbooks]);

  async function onCreate() {
    if (typeof props.onStart !== 'function') {
      setError('当前没有创建通道');
      return;
    }
    setPending(true);
    setError('');
    try {
      const receipt = await props.onStart({
        title: String(title).trim() || '未命名研究',
        playbookId: playbookId || playbooks[0]?.id,
      });
      if (receipt && receipt.status === 'rejected') setError('创建被拒绝，请检查标题与剧本');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '创建失败');
    } finally {
      setPending(false);
    }
  }

  const children = [];
  children.push(h('p', { key: 'hint', className: 'px-drawer-note' },
    runs.length ? `共 ${runs.length} 个运行，当前运行高亮显示。` : '还没有研究运行。'));
  if (!runs.length) {
    children.push(h(PrimEmpty, {
      key: 'empty',
      title: '还没有研究运行',
      hint: '在下方填写标题并选择剧本，创建第一个研究运行。',
    }));
  } else {
    children.push(h('ul', { key: 'list', className: 'px-runs' },
      runs.slice().reverse().map((run) => {
        const parent = run.parentId ? byId.get(run.parentId) : null;
        const stateLabel = PanelStateLabel(props.catalog, run.state) || '未知状态';
        const meta = [`v${run.version ?? 0}`];
        if (run.parentId) meta.push('分叉');
        if (parent?.title) meta.push(`父：${PrimShort(parent.title, 14)}`);
        return h('li', { key: run.id },
          h('button', {
            type: 'button',
            className: PrimCls('px-run-item', run.id === props.activeRunId && 'is-on'),
            'data-testid': 'run-item',
            'data-run-id': run.id,
            title: run.title ?? '未命名运行',
            onClick: () => { if (typeof activate === 'function') activate(run.id); },
          },
          h('span', { className: 'px-run-item-main' },
            h('span', { className: 'px-run-item-name' }, PrimShort(run.title ?? '未命名运行', 22)),
            h('span', { className: 'px-runs-meta' }, meta.join(' · '))),
          h('span', { className: 'px-run-item-state' }, stateLabel)));
      })));
  }
  children.push(h('div', { key: 'create', className: 'px-runs-create' },
    h(PrimField, { label: '研究标题' },
      h(PrimInput, {
        value: title,
        placeholder: '例如：算子消融的因果证据',
        onChange: (event) => setTitle(event.target.value),
      })),
    h(PrimField, { label: '剧本' },
      h(PrimSelect, {
        value: playbookId,
        options: playbooks.map((item) => [item.id, item.title ?? item.id]),
        onChange: (event) => setPlaybookId(event.target.value),
      })),
    error ? h('p', { key: 'error', className: 'px-action-error' }, error) : null));

  return h(PanelDrawer, {
    id: 'runs',
    title: '运行列表',
    hint: `${runs.length} 个运行`,
    onClose: props.onClose,
    footer: h('div', { className: 'px-row' },
      h(PanelButton, {
        label: pending ? '创建中…' : '新建运行',
        onClick: onCreate,
        disabled: pending || !playbooks.length,
      })),
  }, children);
}

/* ---------------------------------------------------------------- map */

const PanelClaimStatusOptions = [
  ['unverified', '未验证'],
  ['supported', '已支持'],
  ['contradicted', '被反驳'],
  ['obsolete', '已过时'],
];
const PanelEdgeRelationOptions = [
  ['depends', '依赖'],
  ['contradicts', '反驳'],
  ['supports', '支持'],
];

function PanelMapContradictionCount(node, contradictions) {
  if (!node) return 0;
  return (Array.isArray(contradictions) ? contradictions : []).filter((item) => item
    && (item.left === node.id || item.right === node.id || item.left === node.claim || item.right === node.claim)).length;
}

function PanelMap(props) {
  const map = props.map ?? {};
  const onAction = typeof props.onAction === 'function' ? props.onAction : null;
  const catalog = props.catalog;
  const nodes = Array.isArray(map.nodes) ? map.nodes : [];
  const edges = Array.isArray(map.edges) ? map.edges : [];
  const frontier = Array.isArray(map.frontier) ? map.frontier : [];
  const blindSpots = Array.isArray(map.blindSpots) ? map.blindSpots : [];
  const contradictions = Array.isArray(map.contradictions) ? map.contradictions : [];
  const layout = PanelMapLayout(nodes);
  const nodeLabel = (id) => {
    const node = nodes.find((item) => item.id === id);
    return node ? (node.label ?? node.claim ?? '未命名主张') : '未知主张';
  };

  const [claimOpen, setClaimOpen] = useState(true);
  const [claimText, setClaimText] = useState('');
  const [claimEvidence, setClaimEvidence] = useState('');
  const [claimStatus, setClaimStatus] = useState('unverified');
  const [claimContradicts, setClaimContradicts] = useState('');
  const [claimBusy, setClaimBusy] = useState(false);
  const [claimError, setClaimError] = useState('');
  const [edgeFrom, setEdgeFrom] = useState('');
  const [edgeTo, setEdgeTo] = useState('');
  const [edgeRelation, setEdgeRelation] = useState('depends');
  const [edgeBusy, setEdgeBusy] = useState(false);
  const [edgeError, setEdgeError] = useState('');
  const [notice, setNotice] = useState('');

  async function submitClaim() {
    if (!onAction) {
      setClaimError('当前视图没有登记通道');
      return;
    }
    if (!String(claimText).trim()) {
      setClaimError('主张不能为空');
      return;
    }
    setClaimBusy(true);
    setClaimError('');
    setNotice('');
    const payload = {
      claim: String(claimText).trim(),
      evidenceRefs: InspectLines(claimEvidence),
      status: claimStatus,
    };
    if (claimContradicts) payload.contradicts = claimContradicts;
    try {
      const receipt = await onAction('map_claim', payload, { expectedDomainVersion: map?.version });
      if (receipt && receipt.status === 'rejected') {
        setClaimError(InspectReasonText(catalog, receipt.reasonCode) || '登记被拒绝');
      } else {
        setClaimText('');
        setClaimEvidence('');
        setClaimContradicts('');
        setClaimStatus('unverified');
        setNotice('已登记，等待刷新');
      }
    } catch (cause) {
      setClaimError(cause instanceof Error ? cause.message : '登记失败');
    } finally {
      setClaimBusy(false);
    }
  }

  async function submitEdge() {
    if (!onAction) {
      setEdgeError('当前视图没有连接通道');
      return;
    }
    if (!edgeFrom || !edgeTo) {
      setEdgeError('请选择起点与终点主张');
      return;
    }
    if (edgeFrom === edgeTo) {
      setEdgeError('起点与终点不能相同');
      return;
    }
    setEdgeBusy(true);
    setEdgeError('');
    setNotice('');
    try {
      const receipt = await onAction('map_edge', {
        from: edgeFrom,
        to: edgeTo,
        relation: edgeRelation,
      }, { expectedDomainVersion: map?.version });
      if (receipt && receipt.status === 'rejected') {
        setEdgeError(InspectReasonText(catalog, receipt.reasonCode) || '连接被拒绝');
      } else {
        setEdgeFrom('');
        setEdgeTo('');
        setEdgeRelation('depends');
        setNotice('已登记连线，等待刷新');
      }
    } catch (cause) {
      setEdgeError(cause instanceof Error ? cause.message : '连接失败');
    } finally {
      setEdgeBusy(false);
    }
  }

  const claimOptions = nodes.map((node) => [node.id, PrimShort(node.label ?? node.claim ?? node.id, 20)]);
  const legendStatuses = [
    ['unknown', '未知 / 未验证'],
    ['supported', '已支持'],
    ['contradicted', '被反驳'],
    ['obsolete', '已过时'],
  ];
  const legendEdges = [
    ['depends', '依赖'],
    ['contradicts', '反驳'],
    ['supports', '支持'],
  ];

  const children = [];

  children.push(h('section', { key: 'claim-form', className: 'px-map-form', 'data-testid': 'map-claim-form' },
    h('div', { className: 'px-action-head' },
      h('span', { className: 'px-action-kicker' }, '登记主张'),
      h(PrimBtn, { onClick: () => setClaimOpen((value) => !value) }, claimOpen ? '收起' : '展开')),
    claimOpen
      ? h('div', { className: 'px-action-fields' },
        h(PrimField, { label: '主张', hint: '一条可被检验的判断' },
          h(PrimArea, {
            'data-testid': 'map-claim-input',
            rows: 2,
            value: claimText,
            placeholder: '例如：容量匹配后结构增益消失',
            onChange: (event) => setClaimText(event.target.value),
          })),
        h(PrimField, { label: '证据引用', hint: '逗号分隔，可选' },
          h(PrimInput, {
            value: claimEvidence,
            placeholder: '产物哈希、评估报告哈希',
            onChange: (event) => setClaimEvidence(event.target.value),
          })),
        h('div', { className: 'px-form-grid' },
          h(PrimField, { label: '状态' },
            h(PrimSelect, {
              value: claimStatus,
              options: PanelClaimStatusOptions,
              onChange: (event) => setClaimStatus(event.target.value),
            })),
          h(PrimField, { label: '与已有主张矛盾', hint: '可选' },
            h(PrimSelect, {
              value: claimContradicts,
              options: [['', '（不关联）'], ...claimOptions],
              onChange: (event) => setClaimContradicts(event.target.value),
            }))),
        claimError ? h('p', { className: 'px-action-error' }, claimError) : null,
        h('div', { className: 'px-inspector-actions' },
          h(PanelButton, {
            label: claimBusy ? '提交中…' : '登记主张',
            testid: 'map-claim-submit',
            primary: true,
            scope: 'drawer',
            disabled: claimBusy || !onAction,
            onClick: submitClaim,
          })))
      : null));

  children.push(h('section', { key: 'edge-form', className: 'px-map-form', 'data-testid': 'map-edge-form' },
    h('p', { className: 'px-section-title' }, '连接主张'),
    h('div', { className: 'px-form-grid' },
      h(PrimField, { label: '起点' },
        h(PrimSelect, {
          value: edgeFrom,
          options: [['', '（选择主张）'], ...claimOptions],
          onChange: (event) => setEdgeFrom(event.target.value),
        })),
      h(PrimField, { label: '终点' },
        h(PrimSelect, {
          value: edgeTo,
          options: [['', '（选择主张）'], ...claimOptions],
          onChange: (event) => setEdgeTo(event.target.value),
        }))),
    h(PrimField, { label: '关系' },
      h(PrimSelect, {
        value: edgeRelation,
        options: PanelEdgeRelationOptions,
        onChange: (event) => setEdgeRelation(event.target.value),
      })),
    edgeError ? h('p', { className: 'px-action-error' }, edgeError) : null,
    h('div', { className: 'px-inspector-actions' },
      h(PanelButton, {
        label: edgeBusy ? '提交中…' : '连接主张',
        testid: 'map-edge-submit',
        disabled: edgeBusy || !onAction || nodes.length < 2,
        onClick: submitEdge,
      }))));

  if (notice) children.push(h(PrimBanner, { key: 'notice', tone: 'ok' }, notice));

  children.push(h('div', { key: 'legend', className: 'px-map-legend' },
    legendStatuses.map(([status, label]) => h('span', { key: status, className: 'px-map-legend-item' },
      h('i', { className: 'px-map-swatch', 'data-status': status, 'aria-hidden': true }), label)),
    legendEdges.map(([kind, label]) => h('span', { key: kind, className: 'px-map-legend-item' },
      h('i', { className: 'px-map-swatch', 'data-kind': kind, 'aria-hidden': true }), label))));

  if (!nodes.length) {
    children.push(h(PrimEmpty, {
      key: 'empty',
      title: '还没有登记主张',
      hint: '运行推进时把主张与证据登记到认知地图，这里会按真实状态着色。',
      action: h(PrimBtn, {
        onClick: () => {
          setClaimOpen(true);
          if (typeof document !== 'undefined') {
            document.querySelector('[data-testid="map-claim-input"]')?.focus();
          }
        },
      }, '登记第一条主张'),
    }));
  } else {
    children.push(h('div', { key: 'canvas', className: 'px-map-canvas', style: { height: `${layout.height}px` } },
      h('svg', {
        className: 'px-map-edges',
        width: layout.width,
        height: layout.height,
        viewBox: `0 0 ${layout.width} ${layout.height}`,
        'aria-hidden': true,
      }, edges.map((edge, index) => {
        const from = layout.positions[edge.from];
        const to = layout.positions[edge.to];
        if (!from || !to) return null;
        const kind = PanelEdgeKind(edge.kind ?? edge.relation);
        return h('line', {
          key: edge.id ?? index,
          className: 'px-map-edge-line',
          'data-kind': kind,
          x1: from.x + layout.boxWidth / 2,
          y1: from.y + layout.boxHeight / 2,
          x2: to.x + layout.boxWidth / 2,
          y2: to.y + layout.boxHeight / 2,
        });
      })),
      nodes.map((node) => {
        const position = layout.positions[node.id];
        const status = PanelClaimStatus(node.status);
        const contradictionCount = PanelMapContradictionCount(node, contradictions);
        return h('div', {
          key: node.id,
          className: 'px-map-node',
          'data-testid': 'map-node',
          'data-status': status.id,
          style: {
            left: `${position.x}px`,
            top: `${position.y}px`,
            width: `${layout.boxWidth}px`,
            minHeight: `${layout.boxHeight}px`,
          },
          title: node.claim ?? node.label ?? '',
        },
        h('div', { className: 'px-map-node-label' }, PrimShort(node.label ?? node.claim ?? '未命名主张', 26)),
        h('div', { className: 'px-map-node-meta' },
          h('span', { className: 'px-map-status' }, status.label),
          h('span', { className: 'px-map-status' }, `${node.evidenceRefs?.length ?? 0} 条证据`),
          contradictionCount ? h('span', { className: 'px-map-contradiction' }, `矛盾 ${contradictionCount}`) : null));
      })));
  }

  children.push(h('section', { key: 'frontier', className: 'px-map-frontier-block' },
    h('p', { className: 'px-section-title' }, `未知前沿（${frontier.length}）`),
    frontier.length
      ? h('ul', { className: 'px-map-list' },
        frontier.map((item, index) => h('li', { key: item.nodeId ?? index, className: 'px-map-frontier' },
          h('strong', null, PrimShort(nodeLabel(item.nodeId), 24)),
          h('span', { className: 'px-map-status' }, PanelClaimStatusLabel(item.whyUnknown)),
          item.testableNext ? h('span', { className: 'px-map-status' }, `下一步可测：${PrimShort(item.testableNext, 30)}`) : null)))
      : h('p', { className: 'px-drawer-note' }, '没有登记未知前沿')));

  children.push(h('section', { key: 'blind', className: 'px-map-frontier-block' },
    h('p', { className: 'px-section-title' }, `盲点（${blindSpots.length}）`),
    blindSpots.length
      ? h('ul', { className: 'px-map-list' },
        blindSpots.map((item, index) => {
          const text = typeof item === 'string'
            ? item
            : (item?.label ?? item?.claim ?? item?.description ?? item?.note ?? '未命名盲点');
          return h('li', { key: item?.id ?? index }, PrimShort(text, 40));
        }))
      : h('p', { className: 'px-drawer-note' }, '没有标记盲点')));

  if (contradictions.length) {
    children.push(h('section', { key: 'contradictions', className: 'px-map-frontier-block' },
      h('p', { className: 'px-section-title' }, `矛盾（${contradictions.length}）`),
      h('ul', { className: 'px-map-list' },
        contradictions.map((item, index) => h('li', { key: item.id ?? index },
          `${PrimShort(item.left ?? '未知', 18)} ↔ ${PrimShort(item.right ?? '未知', 18)}`)))));
  }

  return h(PanelDrawer, {
    id: 'map',
    title: '认知地图',
    hint: nodes.length ? `主张 ${nodes.length} · 关系 ${edges.length}` : '',
    onClose: props.onClose,
  }, children);
}

/* ---------------------------------------------------------------- knobs */

function PanelFormatKnob(value, step) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '—';
  const decimals = Number(step) > 0 && Number(step) < 1 ? 2 : 0;
  return number.toFixed(decimals);
}

function PanelKnobs(props) {
  const fields = Array.isArray(props.fields) ? props.fields : [];
  const current = props.knobs ?? {};
  const [draft, setDraft] = useState(() => ({ ...current }));
  const [dirty, setDirty] = useState(false);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const baseline = useRef(JSON.stringify(current));

  useEffect(() => {
    const next = JSON.stringify(props.knobs ?? {});
    if (next === baseline.current) return;
    baseline.current = next;
    if (!dirty) setDraft({ ...(props.knobs ?? {}) });
  }, [props.knobs, dirty]);

  function setValue(key, value) {
    setDraft((previous) => ({ ...previous, [key]: value }));
    setDirty(true);
    setNotice('');
  }

  async function onFork() {
    if (typeof props.onFork !== 'function') {
      setError('当前没有 fork 通道');
      return;
    }
    setPending(true);
    setError('');
    setNotice('');
    try {
      const receipt = await props.onFork({ ...current, ...draft });
      if (receipt && receipt.status === 'rejected') {
        setError('fork 被拒绝：请检查旋钮范围');
      } else {
        setDirty(false);
        setNotice(receipt?.forked ? '已派生新运行，当前运行不变' : '已提交');
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'fork 失败');
    } finally {
      setPending(false);
    }
  }

  const children = [];
  if (!fields.length) {
    children.push(h(PrimEmpty, {
      key: 'empty',
      title: '没有可调整的旋钮',
      hint: '当前视图没有提供旋钮字段。',
    }));
  } else {
    children.push(h('ul', { key: 'list', className: 'px-knob-list' },
      fields.map((field) => {
        const value = draft[field.key] ?? current[field.key] ?? field.min ?? 0;
        const step = field.step ?? 0.05;
        return h('li', { key: field.key, className: 'px-knob' },
          h('div', { className: 'px-knob-head' },
            h('span', null, field.label ?? field.key),
            h('span', { className: 'px-knob-value' },
              `${PanelFormatKnob(value, step)}${field.unit ? ` ${field.unit}` : ''}`)),
          h('div', { className: 'px-knob-controls' },
            h('input', {
              type: 'range',
              className: 'px-knob-range',
              min: field.min ?? 0,
              max: field.max ?? 1,
              step,
              value,
              'aria-label': field.label ?? field.key,
              onChange: (event) => setValue(field.key, Number(event.target.value)),
            }),
            h('input', {
              type: 'number',
              className: 'px-input px-knob-num',
              min: field.min ?? 0,
              max: field.max ?? 1,
              step,
              value,
              'aria-label': `${field.label ?? field.key} 数值`,
              onChange: (event) => {
                const next = Number(event.target.value);
                if (Number.isFinite(next)) setValue(field.key, next);
              },
            })),
          field.hint ? h('div', { className: 'px-knob-hint' }, field.hint) : null);
      })));
  }
  children.push(h(PrimBanner, { key: 'risk', tone: 'warn' },
    '修改旋钮会 fork 新 Run，当前 Run 不变。'));
  if (error) children.push(h('p', { key: 'error', className: 'px-action-error' }, error));
  if (notice) children.push(h(PrimBanner, { key: 'notice', tone: 'ok' }, notice));

  return h(PanelDrawer, {
    id: 'knobs',
    title: '超参数',
    hint: 'fork 操作',
    onClose: props.onClose,
    footer: h('div', { className: 'px-row' },
      h(PrimBtn, {
        onClick: () => { setDraft({ ...current }); setDirty(false); setNotice(''); setError(''); },
        disabled: !dirty || pending,
      }, '恢复当前值'),
      h(PanelButton, {
        label: pending ? '派生中…' : '以新旋钮 fork 运行',
        primary: true,
        scope: 'drawer',
        onClick: onFork,
        disabled: pending || !fields.length,
      })),
  }, children);
}

/* ---------------------------------------------------------------- audit */

function PanelAudit(props) {
  const run = props.run;
  const graph = props.graph;
  const catalog = props.catalog;
  const events = Array.isArray(run?.events) ? run.events.slice().reverse() : [];
  const audit = graph?.audit ?? null;
  const violations = Array.isArray(audit?.violations) ? audit.violations : [];
  const receipts = Array.isArray(run?.receipts) ? run.receipts : [];
  const nodeLabel = (nodeId) => (graph?.nodes ?? []).find((node) => node.id === nodeId)?.label ?? '';

  const children = [];
  if (!run) {
    children.push(h(PrimEmpty, {
      key: 'empty',
      title: '没有活动运行',
      hint: '选择一个运行后再查看审计记录。',
    }));
  } else {
    children.push(h('section', { key: 'audit', className: 'px-audit-section' },
      h('p', { className: 'px-section-title' }, '图状态审计'),
      audit
        ? (audit.ok
          ? h('div', { className: 'px-audit-ok' }, h(PrimChip, { tone: 'ok' }, '图状态一致'))
          : h('div', { className: 'px-audit-violations' },
            h(PrimBanner, { tone: 'bad' }, '状态不一致，需要核对'),
            h('ul', { className: 'px-audit-violation-list' },
              violations.map((item, index) => h('li', {
                key: `${item.code ?? 'violation'}-${index}`,
                className: 'px-audit-violation',
                'data-testid': 'audit-violation',
              }, `${item.nodeId ? `${nodeLabel(item.nodeId) || '节点'}：` : ''}${item.message ?? '存在不变量违规'}`)))))
        : h('p', { className: 'px-drawer-note' }, '当前视图没有图审计数据')));
    children.push(h('section', { key: 'events', className: 'px-audit-section' },
      h('p', { className: 'px-section-title' }, `事件时间线（${events.length}）`),
      events.length
        ? h('ul', { className: 'px-audit-list' },
          events.map((event, index) => h('li', { key: event.seq ?? index, className: 'px-audit-item' },
            h('span', { className: 'px-audit-time' }, PrimClock(event.at)),
            h('span', { className: 'px-audit-kind' }, PanelEventLabel(event.type)),
            h('span', { className: 'px-audit-text' }, PanelEventSummary(event)))))
        : h('p', { className: 'px-drawer-note' }, '还没有事件')));
    children.push(h('section', { key: 'receipts', className: 'px-audit-section' },
      h('p', { className: 'px-section-title' }, `回执（${receipts.length}）`),
      receipts.length
        ? h('div', { className: 'px-table-wrap' },
          h('table', { className: 'px-table' },
            h('thead', null, h('tr', null,
              h('th', null, '序号'),
              h('th', null, '结果'),
              h('th', null, '原因'))),
            h('tbody', null, receipts.map((item, index) => {
              const value = item && typeof item === 'object' && item.value && typeof item.value === 'object' ? item.value : (item ?? {});
              const reason = InspectReasonText(catalog, value.reasonCode);
              return h('tr', { key: item?.key ?? value.commandId ?? index },
                h('td', { className: 'px-num' }, index + 1),
                h('td', null, PanelReceiptStatus(value.status)),
                h('td', null, reason || '—'));
            }))))
        : h('p', { className: 'px-drawer-note' }, '本运行暂无回执记录')));
  }

  return h(PanelDrawer, {
    id: 'audit',
    title: '审计记录',
    hint: run ? `版本 ${run.version ?? 0}` : '',
    onClose: props.onClose,
  }, children);
}

/* ---------------------------------------------------------------- evidence */

function PanelEvidence(props) {
  const run = props.run;
  const graph = props.graph;
  const claims = Array.isArray(run?.claims) ? run.claims : [];
  const reviews = Array.isArray(run?.reviews) ? run.reviews : [];
  const evalState = run?.eval ?? {};
  const decision = run?.decision ?? null;
  const lastReview = reviews.length ? reviews[reviews.length - 1] : null;
  const evalDone = Boolean(evalState.reportHash);
  const evalRead = Boolean(evalState.readAt);
  const decisionDone = Boolean(decision && (decision.conclusion || decision.next));
  const auditBad = graph?.audit && graph.audit.ok === false;

  const children = [];
  if (!run) {
    children.push(h(PrimEmpty, {
      key: 'empty',
      title: '没有活动运行',
      hint: '选择一个运行后再查看证据链。',
    }));
  } else if (!claims.length) {
    children.push(h(PrimEmpty, {
      key: 'empty',
      title: '还没有主张',
      hint: '在认知地图登记主张后，这里会显示从主张到决策的证据链。',
    }));
  } else {
    let closed = 0;
    const rows = claims.map((claim, index) => {
      const refs = Array.isArray(claim.evidenceRefs) ? claim.evidenceRefs : [];
      const complete = refs.length > 0 && Boolean(lastReview) && evalDone && decisionDone;
      if (complete) closed += 1;
      const status = PanelClaimStatus(claim.status);
      return h('div', { key: claim.id ?? index, className: 'px-evidence-claim' },
        h('div', { className: 'px-evidence-claim-head' },
          h('span', { className: 'px-evidence-claim-title' },
            `${index + 1}. ${claim.claim ?? claim.label ?? '未命名主张'}`),
          h('span', { className: 'px-map-status' }, status.label)),
        h('div', { className: 'px-evidence-row' },
          h('span', { className: 'px-evidence-label' }, '证据引用'),
          refs.length
            ? h('span', null, `${refs.length} 条（${PrimShort(refs.join('、'), 44)}）`)
            : h('span', { className: 'px-evidence-gap' }, '缺失')),
        h('div', { className: 'px-evidence-row' },
          h('span', { className: 'px-evidence-label' }, '独立复核'),
          lastReview
            ? h('span', null, `${PanelVerdictLabel(lastReview.verdict)} · ${lastReview.items?.length ?? 0} 项`)
            : h('span', { className: 'px-evidence-gap' }, '缺失')),
        h('div', { className: 'px-evidence-row' },
          h('span', { className: 'px-evidence-label' }, '独立评估'),
          evalDone
            ? h('span', null, `${PanelVerdictLabel(evalState.verdict)} · ${evalRead ? '已读' : '未读'}`)
            : h('span', { className: 'px-evidence-gap' }, '缺失')),
        h('div', { className: 'px-evidence-row' },
          h('span', { className: 'px-evidence-label' }, '决策'),
          decisionDone
            ? h('span', null, PrimShort(decision.conclusion ?? '已记录', 32))
            : h('span', { className: 'px-evidence-gap' }, '缺失')));
    });
    children.push(h('div', { key: 'summary', className: 'px-evidence-summary' },
      h(PrimChip, { tone: closed === claims.length ? 'ok' : 'warn' },
        `证据闭环 ${closed}/${claims.length} 条主张`),
      !lastReview ? h(PrimChip, { tone: 'warn' }, '缺独立复核') : null,
      !evalDone ? h(PrimChip, { tone: 'warn' }, '缺独立评估') : null,
      !decisionDone ? h(PrimChip, { tone: 'warn' }, '缺决策') : null));
    children.push(h('div', { key: 'rows', className: 'px-evidence' }, rows));
    if (auditBad) {
      children.push(h(PrimBanner, { key: 'audit', tone: 'bad' }, '图状态不一致，证据链可能不可信'));
    }
    if (closed < claims.length) {
      children.push(h(PrimBanner, { key: 'gap', tone: 'warn' },
        `证据链尚未闭合：${claims.length - closed} 条主张缺少环节`));
    }
  }

  return h(PanelDrawer, {
    id: 'evidence',
    title: '证据链',
    hint: claims.length ? `${claims.length} 条主张` : '',
    onClose: props.onClose,
  }, children);
}

/* ---------------------------------------------------------------- styles */

const PanelsCss = `
.px-shell { position: relative; }
.px-drawer-mask {
  position: absolute; left: 0; right: 0; top: 60px; bottom: 0; z-index: 25;
  display: flex; justify-content: flex-end;
}
.px-drawer-mask::before {
  content: ""; position: absolute; inset: 0;
  background: var(--dsw-alias-bg-base); opacity: .14;
}
.px-drawer-mask > .px-drawer { pointer-events: auto; }
.px-drawer-hint { font-size: var(--px-fs-3); color: var(--dsw-alias-label-secondary); white-space: nowrap; }
.px-drawer-note { font-size: var(--px-fs-3); color: var(--dsw-alias-label-secondary); line-height: 1.55; }
.px-error-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; }
.px-error-list li { font-size: var(--px-fs-3); color: var(--dsw-alias-state-error-primary); line-height: 1.5; }
.px-diff { display: grid; gap: 4px; border-top: 1px solid var(--dsw-alias-border-l1); padding-top: 8px; }
.px-diff-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 2px; }
.px-diff-list li { font-size: var(--px-fs-3); color: var(--dsw-alias-label-secondary); line-height: 1.5; }
.px-runs-meta { font-size: var(--px-fs-3); color: var(--dsw-alias-label-secondary); }
.px-run-item-main { display: grid; gap: 1px; min-width: 0; }
.px-runs-create { display: grid; gap: 8px; border-top: 1px solid var(--dsw-alias-border-l1); padding-top: 10px; }
.px-map-canvas {
  position: relative; overflow: hidden; border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 8px; background: var(--dsw-alias-bg-layer-1);
}
.px-map-edges { position: absolute; left: 0; top: 0; overflow: visible; }
.px-map-edge-line { fill: none; stroke: var(--dsw-alias-border-l2); stroke-width: 1.2; }
.px-map-edge-line[data-kind="depends"] { stroke: var(--dsw-alias-border-l2); }
.px-map-edge-line[data-kind="contradicts"] { stroke: var(--dsw-alias-state-error-primary); stroke-dasharray: 4 3; }
.px-map-edge-line[data-kind="supports"] { stroke: var(--dsw-alias-state-success-primary); }
.px-map-edge-line[data-kind="other"] { stroke: var(--dsw-alias-label-secondary); stroke-dasharray: 2 3; }
.px-map-node { position: absolute; display: grid; gap: 2px; background: var(--dsw-alias-bg-base); overflow: hidden; }
.px-map-node-label { font-size: var(--px-fs-2); color: var(--dsw-alias-label-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.px-map-node-meta { display: flex; justify-content: space-between; gap: 6px; }
.px-map-status { font-size: var(--px-fs-3); color: var(--dsw-alias-label-secondary); }
.px-map-legend-item { display: inline-flex; align-items: center; gap: 4px; }
.px-map-swatch { display: inline-block; width: 8px; height: 8px; border-radius: 50%; border: 1px solid var(--dsw-alias-border-l2); }
.px-map-swatch[data-status="unknown"] { border-style: dashed; background: transparent; }
.px-map-swatch[data-status="supported"] { background: var(--dsw-alias-state-success-primary); border-color: var(--dsw-alias-state-success-primary); }
.px-map-swatch[data-status="contradicted"] { background: var(--dsw-alias-state-error-primary); border-color: var(--dsw-alias-state-error-primary); }
.px-map-swatch[data-status="obsolete"] { background: var(--dsw-alias-label-secondary); opacity: .5; }
.px-map-swatch[data-kind="depends"] { width: 12px; height: 0; border-radius: 0; border-width: 1px 0 0; border-color: var(--dsw-alias-border-l2); }
.px-map-swatch[data-kind="contradicts"] { width: 12px; height: 0; border-radius: 0; border-width: 1px 0 0; border-color: var(--dsw-alias-state-error-primary); border-style: dashed; }
.px-map-swatch[data-kind="supports"] { width: 12px; height: 0; border-radius: 0; border-width: 1px 0 0; border-color: var(--dsw-alias-state-success-primary); }
.px-map-frontier-block { display: grid; gap: 4px; border-top: 1px solid var(--dsw-alias-border-l1); padding-top: 8px; }
.px-map-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; }
.px-map-list li { font-size: var(--px-fs-2); color: var(--dsw-alias-label-primary); line-height: 1.5; }
.px-map-frontier { display: grid; gap: 1px; border-left: 2px solid var(--dsw-alias-state-warn-primary); padding-left: 8px; }
.px-map-form { display: grid; gap: 8px; border: 1px solid var(--dsw-alias-border-l1); border-radius: 8px; padding: 10px; background: var(--dsw-alias-bg-layer-1); }
.px-map-contradiction { font-size: var(--px-fs-3); color: var(--dsw-alias-state-error-primary); }
.px-knob-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 12px; }
.px-knob-controls { display: flex; align-items: center; gap: 8px; }
.px-knob-controls .px-knob-range { flex: 1 1 auto; }
.px-knob-num { width: 76px; flex: 0 0 auto; }
.px-knob-value { font-size: var(--px-fs-2); color: var(--dsw-alias-label-primary); font-variant-numeric: tabular-nums; }
.px-audit-section { display: grid; gap: 6px; }
.px-audit-ok { display: flex; }
.px-audit-violation-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
.px-audit-text { font-size: var(--px-fs-2); color: var(--dsw-alias-label-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.px-table-wrap { overflow: auto; }
.px-num { font-variant-numeric: tabular-nums; }
.px-evidence { display: grid; gap: 8px; }
.px-evidence-summary { display: flex; flex-wrap: wrap; gap: 6px; }
.px-evidence-claim { display: grid; gap: 4px; border-top: 1px solid var(--dsw-alias-border-l1); padding-top: 8px; }
.px-evidence-claim-head { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
.px-evidence-claim-title { font-size: var(--px-fs-2); font-weight: 560; color: var(--dsw-alias-label-primary); }
.px-evidence-label { font-size: var(--px-fs-3); color: var(--dsw-alias-label-secondary); }
`;

/* ===== 60-shell.js ===== */
/* Shell: single 60px run bar, canvas workspace, inspector overlay, drawers, dock.
 * Prefix Shell*. Contract §5.1, §5.4, §5.5. */

function ShellCatalog(snapshot) {
  return snapshot?.catalog ?? {
    states: [], stateActions: {}, nodeExecution: [], nodeCondition: [], actions: [], reasons: {},
  };
}

function ShellStateMeta(catalog, stateId) {
  return (catalog.states ?? []).find((item) => item.id === stateId) ?? null;
}

function ShellActionMeta(catalog, actionId) {
  return (catalog.actions ?? []).find((item) => item.id === actionId) ?? null;
}

function ShellExecutionLabel(catalog, execution) {
  return (catalog.nodeExecution ?? []).find((item) => item.id === execution)?.label ?? execution ?? '';
}

function ShellConditionLabel(catalog, condition) {
  return (catalog.nodeCondition ?? []).find((item) => item.id === condition)?.label ?? condition ?? '';
}

function ShellProgress(progress) {
  if (!progress || !progress.total) return { done: 0, total: 0, ratio: 0 };
  const ratio = Math.max(0, Math.min(1, progress.done / progress.total));
  return { done: progress.done, total: progress.total, ratio };
}

function ShellNodeForAction(graph, actionId) {
  if (!graph || !actionId) return null;
  return (graph.nodes ?? []).find((node) => node.config?.action === actionId) ?? null;
}

function ShellDiff(before, after) {
  if (!before || !after) return { nodesAdded: 0, nodesRemoved: 0, edgesAdded: 0, edgesRemoved: 0, moved: 0, total: 0 };
  const beforeNodes = new Map((before.nodes ?? []).map((node) => [node.id, node]));
  const afterNodes = new Map((after.nodes ?? []).map((node) => [node.id, node]));
  const beforeEdges = new Set((before.edges ?? []).map((edge) => `${edge.from}->${edge.to}:${edge.port}`));
  const afterEdges = new Set((after.edges ?? []).map((edge) => `${edge.from}->${edge.to}:${edge.port}`));
  let nodesAdded = 0;
  let nodesRemoved = 0;
  let moved = 0;
  for (const id of afterNodes.keys()) if (!beforeNodes.has(id)) nodesAdded += 1;
  for (const id of beforeNodes.keys()) if (!afterNodes.has(id)) nodesRemoved += 1;
  for (const [id, node] of afterNodes) {
    const old = beforeNodes.get(id);
    if (!old) continue;
    if (old.position?.x !== node.position?.x || old.position?.y !== node.position?.y) moved += 1;
  }
  let edgesAdded = 0;
  for (const key of afterEdges) if (!beforeEdges.has(key)) edgesAdded += 1;
  let edgesRemoved = 0;
  for (const key of beforeEdges) if (!afterEdges.has(key)) edgesRemoved += 1;
  return {
    nodesAdded, nodesRemoved, edgesAdded, edgesRemoved, moved,
    total: nodesAdded + nodesRemoved + edgesAdded + edgesRemoved + moved,
  };
}

function ShellRunBar(props) {
  const {
    store, active, graph, mode, setMode, catalog, onPrimary, onSelectNode,
    onOpenDrawer, onNewRun, inspectorOpen, overlayOpen, inspectorHasPrimary,
  } = props;
  const stateMeta = ShellStateMeta(catalog, active?.state);
  const states = catalog.states ?? [];
  const stateIndex = states.findIndex((item) => item.id === active?.state);
  const stateTotal = states.length || 10;
  const progress = {
    index: stateIndex < 0 ? 0 : stateIndex + 1,
    total: stateTotal,
    ratio: stateIndex < 0 ? 0 : (stateIndex + 1) / stateTotal,
    nodes: ShellProgress(graph?.progress),
  };
  const actionId = catalog.stateActions?.[active?.state] ?? active?.nextAction ?? null;
  const actionMeta = ShellActionMeta(catalog, actionId);
  const hasConflict = store.phase === 'stale' && Boolean(store.conflict);
  const auditBad = graph?.audit && graph.audit.ok === false;
  // A blocker that the primary action resolves must not disable it (D5-7).
  const hardBlocked = Boolean(auditBad || hasConflict || store.phase === 'error');
  const actionNode = ShellNodeForAction(graph, actionId);
  const primaryLabel = actionMeta?.label ?? '继续';
  const softReasons = (active?.blockers ?? [])
    .map((code) => catalog.blockerLabels?.[code] ?? catalog.reasons?.[code] ?? '')
    .filter(Boolean);

  return h('header', { className: 'px-runbar', 'data-mode': mode, 'data-testid': 'runbar' },
    h('div', { className: 'px-runbar-left' },
      h('div', { className: 'px-brand' },
        h('span', { className: 'px-mark', 'aria-hidden': true }),
        h('span', { className: 'px-brand-name' }, 'Praxis')),
      active ? h('div', { className: 'px-run-id' },
        h('span', { className: 'px-run-title', title: active.title }, PrimShort(active.title, 26)),
        h(PrimChip, { tone: stateMeta ? 'active' : 'idle' }, stateMeta?.label ?? active.state),
        h('span', { className: 'px-run-version' }, `v${active.version}`)) : h('span', { className: 'px-run-title' }, '未选择运行')),
    h('div', { className: 'px-runbar-center' },
      active ? h('div', { className: 'px-progress', 'data-testid': 'progress', title: `当前阶段 ${progress.index}/${progress.total}，节点 ${progress.nodes.done}/${progress.nodes.total}` },
        h('span', { className: 'px-progress-track' },
          h('span', { className: 'px-progress-fill', style: { width: `${Math.round(progress.ratio * 100)}%` } })),
        h('span', { className: 'px-progress-text' }, `${progress.index}/${progress.total}`)) : null,
      h('div', { className: 'px-modes', role: 'tablist', 'aria-label': '视图模式' },
        h('button', {
          type: 'button', role: 'tab', 'aria-selected': mode === 'run',
          className: `px-mode${mode === 'run' ? ' is-on' : ''}`,
          onClick: () => setMode('run'), title: '运行视图：只读，安全推进研究',
        }, '运行'),
        h('button', {
          type: 'button', role: 'tab', 'aria-selected': mode === 'blueprint',
          className: `px-mode${mode === 'blueprint' ? ' is-on' : ''}`,
          disabled: !active,
          onClick: () => setMode('blueprint'), title: active ? '蓝图视图：修改流程图，保存前需要确认' : '先新建运行',
        }, '蓝图'))),
    h('div', { className: 'px-runbar-right' },
      overlayOpen ? null
        : inspectorOpen ? h(PrimBtn, { onClick: () => onSelectNode(null), className: 'px-bar-ghost' }, '收起面板')
        : null,
      !overlayOpen && (inspectorOpen ? !inspectorHasPrimary : Boolean(active)) && active && mode === 'run' ? h(PrimBtn, {
          tone: 'primary',
          'data-testid': 'primary',
          'data-action-id': actionId ?? '',
          onClick: () => onPrimary(actionId, actionNode),
          disabled: store.busy > 0 || hardBlocked,
          title: hardBlocked ? '状态不一致或数据过期，先处理提示' : `执行：${primaryLabel}`,
        }, primaryLabel) : null,
      !inspectorOpen && active && softReasons.length && !hardBlocked
        ? h('span', { className: 'px-runbar-reason' }, `待办：${softReasons[0]}`)
        : null,
      h(PrimMenu, {
        label: '更多',
        items: [
          { id: 'runs', label: '运行列表', onClick: () => onOpenDrawer('runs') },
          { id: 'source', label: '流程图源码', onClick: () => onOpenDrawer('source') },
          { id: 'map', label: '认知地图', onClick: () => onOpenDrawer('map') },
          { id: 'evidence', label: '证据链', onClick: () => onOpenDrawer('evidence') },
          { id: 'audit', label: '审计记录', onClick: () => onOpenDrawer('audit') },
          { id: 'knobs', label: '超参数（fork）', onClick: () => onOpenDrawer('knobs') },
          active ? { id: 'new', label: '新建运行', onClick: onNewRun } : null,
        ].filter(Boolean),
      })));
}

function ShellApp() {
  const store = StoreUse();
  const snapshot = store.snapshot;
  const catalog = ShellCatalog(snapshot);
  const active = snapshot?.active ?? null;
  const graph = snapshot?.graph ?? null;
  const [mode, setMode] = useState('run');
  const [selectedId, setSelectedId] = useState(null);
  const [drawer, setDrawer] = useState(null);
  const [draft, setDraft] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [newRun, setNewRun] = useState(null);

  useEffect(() => {
    if (mode !== 'blueprint') setDraft(null);
  }, [mode]);

  useEffect(() => {
    if (!active) { setSelectedId(null); setMode('run'); }
  }, [active?.id]);

  useEffect(() => {
    const onKey = (event) => {
      if (event.key !== 'Escape') return;
      if (confirm) { setConfirm(null); return; }
      if (newRun) { setNewRun(null); return; }
      if (drawer) { setDrawer(null); return; }
      if (selectedId) setSelectedId(null);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [confirm, newRun, drawer, selectedId]);

  const nodes = (mode === 'blueprint' && draft ? draft : graph)?.nodes ?? [];
  const selectedNode = selectedId ? nodes.find((node) => node.id === selectedId) ?? null : null;
  const nodeState = selectedNode ? (graph?.states?.[selectedNode.id] ?? null) : null;
  const inspectorOpen = Boolean(selectedNode) && mode === 'run';
  const nextActionId = catalog.stateActions?.[active?.state] ?? active?.nextAction ?? null;
  const inspectorHasPrimary = Boolean(selectedNode)
    && mode === 'run'
    && (selectedNode.id === graph?.current || (selectedNode.config?.action && selectedNode.config.action === nextActionId));

  const editGraph = mode === 'blueprint' ? draft : graph;

  function enterBlueprint() {
    if (!graph) return;
    setDraft(JSON.parse(JSON.stringify(graph)));
  }

  function blueprintDirty() {
    return Boolean(draft) && ShellDiff(graph, draft).total > 0;
  }

  function setModeSafe(next) {
    if (next === 'blueprint') {
      enterBlueprint();
      setSelectedId(null);
      setMode('blueprint');
      return;
    }
    if (blueprintDirty()) {
      setConfirm({ kind: 'discard', next: 'run' });
      return;
    }
    setMode(next);
    setDraft(null);
  }

  async function saveBlueprint() {
    if (!draft) return;
    const diff = ShellDiff(graph, draft);
    setConfirm({ kind: 'blueprint', diff });
  }

  function confirmDiscard() {
    const pending = confirm;
    setConfirm(null);
    if (pending?.next === 'run') {
      setMode('run');
      setDraft(null);
    }
  }

  async function commitBlueprint() {
    setConfirm(null);
    const receipt = await StoreSend('graph_save', {
      playbookId: draft.playbookId,
      graph: draft,
      expectedRevision: graph?.revision,
    }, { force: true });
    if (receipt?.status === 'committed') {
      const revision = receipt.graph?.revision ?? receipt.graph?.revision;
      setReport(revision ? `蓝图已保存：新 revision ${revision}` : '蓝图已保存');
      setSelectedId(null);
      setMode('run');
      setDraft(null);
    } else {
      setReport('');
    }
  }

  function onPrimary(actionId, node) {
    if (!actionId) return;
    const meta = ShellActionMeta(catalog, actionId);
    if (meta?.payload === 'none') {
      void submitAction(actionId, {});
      return;
    }
    // Actions with payload open the inspector; focus lands on its first required field.
    if (node) setSelectedId(node.id);
    else if (graph?.current) setSelectedId(graph.current);
  }

  function onDraftChange(nextGraph) {
    setDraft(nextGraph);
  }

  function onDraftPositions(positions) {
    setDraft((value) => {
      if (!value) return value;
      return {
        ...value,
        nodes: value.nodes.map((node) => positions[node.id] ? { ...node, position: positions[node.id] } : node),
      };
    });
  }

  function onConnectDraft(from, to, port) {
    setDraft((value) => {
      if (!value) return value;
      if (value.edges.some((edge) => edge.from === from && edge.to === to)) return value;
      return { ...value, edges: [...value.edges, { id: `e_${Date.now().toString(36)}`, from, to, port }] };
    });
  }

  function onDeleteDraft(nodeId) {
    setDraft((value) => {
      if (!value) return value;
      const node = value.nodes.find((item) => item.id === nodeId);
      if (!node || node.protected) return value;
      return {
        ...value,
        nodes: value.nodes.filter((item) => item.id !== nodeId),
        edges: value.edges.filter((edge) => edge.from !== nodeId && edge.to !== nodeId),
      };
    });
  }

  async function submitAction(action, payload) {
    const receipt = await StoreSend(action, payload);
    if (receipt?.status === 'committed' || receipt?.status === 'replayed') {
      setReport('');
      return receipt;
    }
    return receipt;
  }

  const [report, setReport] = useState('');
  const [theme, setTheme] = useState(() => {
    try {
      const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      return dark ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  });

  useEffect(() => {
    const root = document.documentElement;
    const read = () => {
      const declared = root.getAttribute('data-theme') ?? root.getAttribute('data-color-scheme') ?? '';
      if (declared === 'dark' || declared === 'light') { setTheme(declared); return; }
      try {
        const probe = document.querySelector('[data-testid="praxis-shell"]');
        const color = probe ? getComputedStyle(probe).backgroundColor : '';
        const match = color.match(/(\d+)[,\s]+(\d+)[,\s]+(\d+)/);
        if (match) {
          const [r, g, b] = [Number(match[1]), Number(match[2]), Number(match[3])];
          const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
          setTheme(luminance < 0.5 ? 'dark' : 'light');
          return;
        }
      } catch { /* keep default */ }
      setTheme(window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    };
    read();
    const observer = new MutationObserver(read);
    observer.observe(root, { attributes: true, attributeFilter: ['data-theme', 'data-color-scheme', 'class', 'style'] });
    return () => observer.disconnect();
  }, []);

  const banner = (() => {
    if (graph?.audit && graph.audit.ok === false) {
      const list = (graph.audit.violations ?? []).slice(0, 2).map((item) => item.message).join('；');
      return h(PrimBanner, { tone: 'bad' }, `状态不一致，需要核对：${list || '存在图不变量违规'}`);
    }
    if (store.conflict) {
      return h(PrimBanner, {
        tone: 'warn',
        onDismiss: () => StoreDismissConflict(),
        action: h(PrimBtn, { onClick: () => void StoreRefresh(), className: 'px-bar-ghost' }, '刷新'),
      }, `数据已更新，本次操作未提交：${store.conflict}`);
    }
    if (store.error) return h(PrimBanner, { tone: 'bad' }, store.error);
    if (report) return h(PrimBanner, { tone: 'ok' }, report);
    return null;
  })();

  if (!snapshot) {
    return h('section', {
      className: 'px-shell',
      'data-praxis': 'app',
      'data-testid': 'praxis-shell',
      'data-scene': store.phase === 'error' ? 'error' : 'loading',
      'data-mode': 'run',
    },
      h('style', null, CssText),
      h('div', { className: 'px-boot', 'data-testid': store.phase === 'error' ? 'error' : 'loading' },
        store.phase === 'error'
          ? h(PrimEmpty, {
            title: '无法连接 Praxis 服务',
            hint: store.error || '本地回环 API 不可用。',
            action: h(PrimBtn, { tone: 'primary', onClick: () => void StoreRefresh() }, '重试'),
          })
          : h('div', { className: 'px-boot-wait' },
            h('p', { className: 'px-boot-hint', 'data-testid': 'loading-hint' }, '正在连接 Praxis 服务…'),
            h(PrimSkeleton, { rows: 4 }))));
  }

  const scene = !active ? 'empty' : mode === 'blueprint' ? 'blueprint' : 'running';
  return h('section', {
    className: 'px-shell',
    'data-praxis': 'app',
    'data-testid': 'praxis-shell',
    'data-mode': mode,
    'data-scene': scene,
    'data-theme': theme,
  },
    h('style', null, CssText),
    h(ShellRunBar, {
      store, active, graph, mode, catalog,
      setMode: setModeSafe,
      onPrimary,
      onSelectNode: setSelectedId,
      onOpenDrawer: setDrawer,
      onNewRun: () => setNewRun({ title: '', playbookId: snapshot?.playbooks?.[0]?.id ?? 'scientific-loop' }),
      inspectorOpen,
      inspectorHasPrimary,
      overlayOpen: Boolean(drawer || confirm || newRun),
    }),
    h('div', { className: 'px-workspace' },
      banner ? h('div', { className: 'px-banner-slot', 'data-testid': 'banner' }, banner) : null,
      h('main', { className: 'px-stage', 'aria-label': mode === 'blueprint' ? '蓝图编辑画布' : '研究流程画布' },
        active || mode === 'blueprint'
          ? h(CanvasView, {
            graph: editGraph,
            catalog,
            states: graph?.states ?? {},
            current: graph?.current ?? null,
            progress: graph?.progress ?? null,
            audit: graph?.audit ?? null,
            selectedId,
            mode,
            inspectorOpen,
            onSelect: setSelectedId,
            onDraftPositions,
            onConnect: onConnectDraft,
            onDelete: onDeleteDraft,
            zoom: null,
            setZoom: null,
          })
          : h('div', { className: 'px-empty-stage', 'data-testid': 'empty' },
            h('div', { className: 'px-empty-lanes', 'aria-hidden': true },
              ['定义问题', '探索与执行', '证据与决策'].map((label) => h('div', { key: label, className: 'px-empty-lane' },
                h('span', { className: 'px-empty-lane-label' }, label)))),
            h('div', { className: 'px-empty-card' },
              h(PrimEmpty, {
                title: '还没有研究运行',
                hint: '新建一个运行，先把研究问题写成可裁决的假设，再冻结预注册。',
                action: h(PrimBtn, {
                  tone: 'primary',
                  'data-testid': 'empty-primary',
                  'data-action-id': 'start',
                  onClick: () => setNewRun({ title: '', playbookId: snapshot?.playbooks?.[0]?.id ?? 'scientific-loop' }),
                }, '新建研究运行'),
              }),
              (snapshot?.runs?.length ?? 0) > 0
                ? h('div', { className: 'px-empty-recent' },
                  h('p', { className: 'px-empty-recent-title' }, '最近运行'),
                  h('ul', { className: 'px-runs' }, snapshot.runs.slice(-3).reverse().map((run) => h('li', { key: run.id },
                    h('button', {
                      type: 'button', className: 'px-run-item', 'data-testid': 'run-item', 'data-run-id': run.id,
                      onClick: async () => { await StoreActivate(run.id); setMode('run'); },
                    },
                    h('span', { className: 'px-run-item-name' }, PrimShort(run.title, 22)),
                    h('span', { className: 'px-run-item-state' }, ShellStateMeta(catalog, run.state)?.label ?? ''))))))
                : null))),
      mode === 'blueprint'
        ? h('div', { className: 'px-blueprint-bar' },
          h('span', null, `草稿：${ShellDiff(graph, draft).total} 处修改`),
          h(PrimBtn, { onClick: () => { setDraft(JSON.parse(JSON.stringify(graph))); }, disabled: !draft }, '重置草稿'),
          h(PrimBtn, { onClick: () => { setMode('run'); setDraft(null); } }, '退出蓝图'),
          h(PrimBtn, { tone: 'primary', 'data-testid': 'primary', 'data-primary-scope': 'blueprint', onClick: saveBlueprint, disabled: !draft }, '保存蓝图'))
        : null,
      inspectorOpen
        ? h(InspectPanel, {
          run: active,
          graph,
          node: selectedNode,
          nodeState,
          current: graph?.current,
          catalog,
          mode: 'run',
          onAction: submitAction,
          onClose: () => setSelectedId(null),
          busy: store.busy > 0,
          onReport: setReport,
          onOpenPanel: (id) => setDrawer(id),
          diff: null,
          onDraftChange: null,
        })
        : null,
      mode === 'blueprint' && selectedNode
        ? h(InspectPanel, {
          run: active,
          graph: draft,
          node: selectedNode,
          nodeState: null,
          current: null,
          catalog,
          mode: 'blueprint',
          onAction: null,
          onClose: () => setSelectedId(null),
          busy: false,
          diff: ShellDiff(graph, draft),
          onDraftChange,
          onOpenPanel: (id) => setDrawer(id),
        })
        : null),
    drawer ? h(ShellDrawer, {
      id: drawer, snapshot, active, graph, catalog,
      onClose: () => setDrawer(null),
      onSelectRun: async (runId) => {
        if (mode === 'blueprint' && blueprintDirty()) {
          setConfirm({ kind: 'discard', next: 'run' });
          return;
        }
        setDrawer(null);
        setMode('run');
        setDraft(null);
        await StoreActivate(runId);
      },
      onAction: submitAction,
      onStart: async (payload) => {
        setDrawer(null);
        const receipt = await StoreStartRun(payload.title, payload.playbookId);
        if (receipt?.status === 'committed') setMode('run');
      },
    }) : null,
    confirm && confirm.kind === 'blueprint' ? h(PrimModal, {
      title: '确认保存蓝图',
      onClose: () => setConfirm(null),
      actions: h('div', { className: 'px-row' },
        h(PrimBtn, { onClick: () => setConfirm(null) }, '取消'),
        h(PrimBtn, { tone: 'primary', onClick: commitBlueprint }, '确认保存')),
    }, h(PrimKeyValue, {
      rows: [
        ['节点变化', `+${confirm.diff.nodesAdded} / −${confirm.diff.nodesRemoved}`],
        ['连线变化', `+${confirm.diff.edgesAdded} / −${confirm.diff.edgesRemoved}`],
        ['位置变化', `${confirm.diff.moved}`],
        ['说明', '保存后生成新的图 revision；正在运行的 Run 固定原有 revision。'],
      ],
    })) : null,
    confirm && confirm.kind === 'discard' ? h(PrimModal, {
      title: '放弃蓝图草稿？',
      onClose: () => setConfirm(null),
      actions: h('div', { className: 'px-row' },
        h(PrimBtn, { onClick: () => setConfirm(null) }, '继续编辑'),
        h(PrimBtn, { tone: 'primary', onClick: confirmDiscard }, '放弃修改')),
    }, h('p', { className: 'px-inspector-note' }, `有 ${ShellDiff(graph, draft).total} 处未保存修改。离开蓝图将丢弃这些修改。`)) : null,
    newRun ? h(PrimModal, {
      title: '新建研究运行',
      onClose: () => setNewRun(null),
      actions: h('div', { className: 'px-row' },
        h(PrimBtn, { onClick: () => setNewRun(null) }, '取消'),
        h(PrimBtn, { tone: 'primary', onClick: async () => {
          const payload = { title: newRun.title.trim() || '未命名研究', playbookId: newRun.playbookId };
          setNewRun(null);
          const receipt = await StoreStartRun(payload.title, payload.playbookId);
          if (receipt?.status === 'committed') { setMode('run'); setSelectedId(null); }
        } }, '创建')),
    },
    h(PrimField, { label: '研究标题' },
      h(PrimInput, {
        value: newRun.title, autoFocus: true, placeholder: '例如：算子消融的因果证据',
        onChange: (event) => setNewRun({ ...newRun, title: event.target.value }),
      })),
    h(PrimField, { label: '剧本' },
      h(PrimSelect, {
        value: newRun.playbookId,
        options: (snapshot?.playbooks ?? []).map((item) => [item.id, item.title ?? item.id]),
        onChange: (event) => setNewRun({ ...newRun, playbookId: event.target.value }),
      }))) : null);
}

function ShellAuditDrawer({ active, graph, catalog, onClose }) {
  const [receipts, setReceipts] = useState(null);
  useEffect(() => {
    let alive = true;
    StoreApi('/evidence')
      .then((value) => {
        if (!alive) return;
        const run = (value?.evidence?.runs ?? []).find((item) => item.id === active?.id);
        setReceipts(run?.receipts ?? []);
      })
      .catch(() => { if (alive) setReceipts([]); });
    return () => { alive = false; };
  }, [active?.id]);
  const merged = active ? { ...active, receipts: receipts ?? [] } : null;
  return h(PanelAudit, { run: merged, graph, catalog, onClose });
}

function ShellDrawer({ id, snapshot, active, graph, catalog, onClose, onSelectRun, onAction, onStart }) {
  if (id === 'source') {
    return h(PanelSource, {
      graph,
      catalog,
      onClose,
      onSave: async (next) => StoreSend('graph_save', {
        playbookId: next.playbookId,
        graph: next,
        expectedRevision: graph?.revision ?? next.revision,
      }, { force: true }),
    });
  }
  if (id === 'runs') {
    return h(PanelRuns, {
      runs: snapshot?.runs ?? [],
      activeRunId: snapshot?.activeRunId,
      playbooks: snapshot?.playbooks ?? [],
      catalog,
      onSelectRun,
      onStart,
      onClose,
    });
  }
  if (id === 'map') {
    return h(PanelMap, {
      map: snapshot?.map,
      run: active,
      catalog,
      onClose,
      onAction: async (action, payload) => {
        const receipt = await StoreSend(action, payload, { runId: active?.id });
        if (receipt?.status === 'committed' || receipt?.status === 'replayed') await StoreRefresh();
        return receipt;
      },
    });
  }
  if (id === 'knobs') {
    return h(PanelKnobs, {
      knobs: snapshot?.knobs,
      fields: snapshot?.knobFields,
      onFork: async (knobs) => StoreSend('set_knobs', { knobs }, { force: false }),
      onClose,
    });
  }
  if (id === 'audit') return h(ShellAuditDrawer, { active, graph, catalog, onClose });
  if (id === 'evidence') return h(PanelEvidence, { run: active, graph, catalog, onClose });
  return null;
}

function ShellDock() {
  const store = StoreUse();
  const snapshot = store.snapshot;
  const active = snapshot?.active;
  const catalog = ShellCatalog(snapshot);
  const graph = snapshot?.graph;
  if (!active) {
    return h('span', { className: 'px-dock', 'data-praxis': 'dock', role: 'status' },
      h('i', { 'aria-hidden': true }), 'Praxis · 无运行');
  }
  const stateMeta = ShellStateMeta(catalog, active.state);
  const auditBad = graph?.audit && graph.audit.ok === false;
  const blocked = (active.blockers?.length ?? 0) > 0 || auditBad;
  const actionId = catalog.stateActions?.[active.state] ?? active.nextAction ?? null;
  const actionMeta = ShellActionMeta(catalog, actionId);
  const text = blocked ? `${stateMeta?.label ?? active.state} · 阻塞 ${active.blockers?.length ?? 0}`
    : `${stateMeta?.label ?? active.state} · ${actionMeta?.label ?? '继续'}`;
  return h('span', {
    className: `px-dock${blocked ? ' warn' : ''}`,
    'data-praxis': 'dock',
    role: 'status',
    title: `${active.title} · v${active.version}`,
  }, h('i', { 'aria-hidden': true }), text);
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
      runs.slice().reverse().map((run) => {
        const stateMeta = ShellStateMeta(catalog, run.state);
        return h('li', { key: run.id },
          h('button', {
            type: 'button',
            className: `px-side-run${run.id === snapshot.activeRunId ? ' is-on' : ''}`,
            onClick: () => void StoreActivate(run.id),
            title: run.title,
          },
          h('span', { className: 'px-side-name' }, PrimShort(run.title, 18)),
          h('span', { className: 'px-side-state' }, stateMeta?.label ?? run.state)));
      })));
}

function ShellIcon({ size = 20, active = false }) {
  return h('svg', {
    width: size, height: size, viewBox: '0 0 24 24', 'aria-hidden': true,
    fill: 'none', stroke: active ? 'var(--dsw-alias-brand-primary)' : 'currentColor',
    strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round',
  },
  h('circle', { cx: 12, cy: 12, r: 8.2 }),
  h('path', { d: 'M12 3.8v16.4M3.8 12h16.4' }),
  h('circle', { cx: 12, cy: 12, r: 2.4, fill: 'currentColor', stroke: 'none' }));
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

/* ---------- workspace / stage ---------- */
.px-workspace { position: relative; flex: 1 1 auto; min-height: 0; overflow: hidden; }
.px-stage { position: absolute; inset: 0; }
.px-empty-stage { position: absolute; inset: 0; display: grid; place-items: center; padding: 24px; }
.px-empty-lanes { position: absolute; inset: 40px 24px; display: grid; grid-template-rows: repeat(3, 1fr); gap: 32px; pointer-events: none; }
.px-empty-lane { border-top: 1px solid var(--dsw-alias-border-l1); border-bottom: 1px solid var(--dsw-alias-border-l1); display: flex; align-items: flex-start; padding-top: 6px; }
.px-empty-lane-label { font-size: var(--px-fs-3); letter-spacing: .08em; color: var(--dsw-alias-label-secondary); opacity: .7; }
.px-empty-card { position: relative; z-index: 1; display: grid; gap: 14px; justify-items: center; padding: 20px 24px; background: var(--dsw-alias-bg-base); border: 1px solid var(--dsw-alias-border-l1); border-radius: 10px; max-width: 460px; }
.px-empty-recent { display: grid; gap: 6px; width: 100%; border-top: 1px solid var(--dsw-alias-border-l1); padding-top: 10px; }
.px-empty-recent-title { font-size: var(--px-fs-3); letter-spacing: .08em; color: var(--dsw-alias-label-secondary); }
.px-blueprint-bar {
  position: absolute; left: 50%; bottom: 14px; transform: translateX(-50%);
  display: flex; align-items: center; gap: 10px; z-index: 8;
  background: var(--dsw-alias-bg-overlay); border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 8px; padding: 8px 12px; box-shadow: 0 10px 24px rgb(0 0 0 / .16);
  font-size: var(--px-fs-2);
}

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
