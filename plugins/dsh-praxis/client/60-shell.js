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
      ctx.slots.inject('conversation.composer.dock', () => ctx.slots.register({
        name: 'conversation.composer.dock', id: 'praxis', order: 40, label: 'Praxis',
      }, ShellDock));
    },
  };
}
