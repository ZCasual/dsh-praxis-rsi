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

function PanelMap(props) {
  const map = props.map ?? {};
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
          h('span', { className: 'px-map-status' }, `${node.evidenceRefs?.length ?? 0} 条证据`)));
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
