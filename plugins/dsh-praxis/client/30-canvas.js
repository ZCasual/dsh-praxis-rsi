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
