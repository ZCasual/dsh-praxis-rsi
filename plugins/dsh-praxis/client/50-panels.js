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
