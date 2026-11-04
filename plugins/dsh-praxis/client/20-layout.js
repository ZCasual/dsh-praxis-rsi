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
