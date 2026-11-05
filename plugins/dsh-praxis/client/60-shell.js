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


/* Branch creation: the only path that turns a hypothesis into a parallel inquiry line. */
function ShellBranchCreate({ team, onAction, onClose }) {
  const [title, setTitle] = useState('');
  const [falsifiable, setFalsifiable] = useState('');
  const [hypothesis, setHypothesis] = useState('');
  const [ownerId, setOwnerId] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const members = (team?.members ?? []).filter((member) => member.kind !== 'lead');
  const options = [['', '稍后指派']].concat(members.map((member) => [member.id, `${member.name}（${member.status === 'running' ? '运行中' : '空闲'}）`]));

  async function submit() {
    if (pending) return;
    if (title.trim().length < 2) { setError('分支标题至少 2 个字符'); return; }
    if (falsifiable.trim().length < 8) { setError('可证伪陈述至少 8 个字符：写清什么观测会否定这条分支'); return; }
    setError('');
    setPending(true);
    try {
      const receipt = await onAction('branch_propose', {
        title: title.trim(),
        hypothesis: hypothesis.trim() || falsifiable.trim(),
        falsifiable: falsifiable.trim(),
        ownerId: ownerId || undefined,
      });
      if (!receipt || receipt.status === 'rejected') setError(`提交被拒绝：${receipt?.reasonCode ?? 'REJECTED'}`);
      else onClose?.();
    } finally {
      setPending(false);
    }
  }

  return h('aside', { className: 'px-v4-inspector', 'data-testid': 'inspector', 'data-selection-kind': 'branch-create', role: 'dialog', 'aria-label': '新建分支' },
    h('header', { className: 'px-v4-inspect-head' },
      h('div', null,
        h('span', { className: 'px-v4-kicker' }, '并行探究'),
        h('h2', null, '新建分支')),
      h('button', { type: 'button', className: 'px-icon-btn', 'aria-label': '关闭', onClick: onClose }, '×')),
    h('div', { className: 'px-v4-inspect-body' },
      h(PrimField, { label: '分支标题' },
        h(PrimInput, { value: title, autoFocus: true, placeholder: '例如：容量匹配对照', onChange: (event) => setTitle(event.target.value) })),
      h(PrimField, { label: '可证伪陈述', hint: '什么观测会否定这条分支' },
        h(PrimArea, { value: falsifiable, rows: 3, placeholder: '容量匹配后增益降到 0.02 以内', onChange: (event) => setFalsifiable(event.target.value) })),
      h(PrimField, { label: '假设', hint: '可选' },
        h(PrimArea, { value: hypothesis, rows: 2, onChange: (event) => setHypothesis(event.target.value) })),
      h(PrimField, { label: '负责人', hint: members.length ? '来自当前团队' : '尚未组建团队，可稍后指派' },
        h(PrimSelect, { value: ownerId, options, onChange: (event) => setOwnerId(event.target.value) })),
      error ? h('p', { className: 'px-v4-form-error', 'data-testid': 'action-error', role: 'alert' }, error) : null),
    h('footer', { className: 'px-v4-inspect-foot' },
      h('button', {
        type: 'button', className: 'px-btn primary px-v4-inspect-primary',
        'data-testid': 'primary', 'data-action': 'branch_propose',
        disabled: pending, onClick: submit,
      }, pending ? '创建中…' : '创建分支')));
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
    'data-inspector': selection ? 'true' : 'false',
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
          onCreateBranch: () => openDrawer('branch-new'),
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
  if (id === 'branch-new') {
    return h(ShellBranchCreate, {
      team,
      onAction,
      onClose,
    });
  }
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
