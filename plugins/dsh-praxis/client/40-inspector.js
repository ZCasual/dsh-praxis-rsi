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
  if (status === 'active') {
    return {
      id: 'branch_evidence',
      label: '记录证据',
      form: 'branch_evidence',
      payload: { branchId: branch?.id },
      alternates: [
        { id: 'branch_verdict', label: '给出结论', form: 'branch_verdict' },
        { id: 'branch_drop', label: '放弃分支', form: 'branch_drop' },
      ],
    };
  }
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

function InspectBranchOwnerControl({ branch, team, onAction }) {
  const members = (team?.members ?? []).filter((item) => item.kind !== 'lead');
  const [ownerId, setOwnerId] = useState('');
  const [pending, setPending] = useState(false);
  const current = branch?.ownerId ?? '';
  if (!members.length) {
    return h('div', { className: 'px-v4-inspect-section' },
      h('span', { className: 'px-v4-inspect-label' }, '负责人'),
      h('p', { className: 'px-v4-inspect-claim' }, current || '未指派'),
      h('p', { className: 'px-v4-inspect-note' }, '当前没有可指派的团队成员。'));
  }
  const options = [['', '选择成员']].concat(members.map((item) => [item.id, item.name]));
  const assign = async () => {
    if (!ownerId || pending) return;
    setPending(true);
    try { await onAction?.('branch_assign', { branchId: branch?.id, ownerId }); } finally { setPending(false); }
  };
  return h('div', { className: 'px-v4-inspect-section' },
    h('span', { className: 'px-v4-inspect-label' }, '负责人'),
    h('p', { className: 'px-v4-inspect-claim' }, current || '未指派'),
    h('div', { className: 'px-v4-inspect-member-head' },
      h(PrimSelect, { value: ownerId, options, onChange: (event) => setOwnerId(event.target.value) }),
      h(PrimBtn, { onClick: assign, disabled: !ownerId || pending }, pending ? '指派中…' : '指派')),
    h('p', { className: 'px-v4-inspect-note' }, '指派来自当前团队的真实成员；换人会写审计事件。'));
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
  const [altId, setAltId] = useState('');
  const alternates = action?.alternates ?? [];
  const alt = alternates.find((item) => item.id === altId) ?? null;
  const activeAction = alt ? { ...action, id: alt.id, label: alt.label, form: alt.form } : action;
  const kind = activeAction?.form ?? 'none';

  function build() {
    if (kind === 'branch_verdict') {
      return { branchId: action.payload?.branchId, verdict: values.verdict ?? 'supported', reason: String(values.reason ?? '').trim() || '证据一致' };
    }
    if (kind === 'branch_drop') {
      return { branchId: action.payload?.branchId, reason: String(values.dropReason ?? '').trim() || '方向不再优先' };
    }
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
    if (kind === 'branch_activate') return { branchId: action.payload?.branchId };
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
    if (kind === 'branch_verdict') {
      if (!String(values.reason ?? '').trim()) return '给出结论必须写理由：哪条证据支持这个判断';
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
      const receipt = await onAction?.(activeAction.id, build());
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
    if (kind === 'branch_verdict') {
      return h('div', { className: 'px-v4-form', 'data-testid': 'branch-verdict-form' },
        h(PrimField, { label: '结论' },
          h(PrimSelect, { value: values.verdict ?? 'supported', onChange: set('verdict'), options: [['supported', '支持本分支'], ['refuted', '否定本分支'], ['inconclusive', '证据不足']] })),
        h(PrimField, { label: '理由' },
          h(PrimArea, { value: values.reason ?? '', rows: 3, placeholder: '哪条证据支持这个判断', onChange: set('reason') })));
    }
    if (kind === 'branch_drop') {
      return h('div', { className: 'px-v4-form' },
        h(PrimField, { label: '放弃理由' },
          h(PrimInput, { value: values.dropReason ?? '', onChange: set('dropReason') })));
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
    alternates.length
      ? h('div', { className: 'px-v4-alt-actions' },
        alternates.map((item) => h('button', {
          key: item.id,
          type: 'button',
          className: `px-v4-alt${altId === item.id ? ' is-on' : ''}`,
          'data-testid': 'alternate-action',
          'data-action': item.id,
          onClick: () => { setAltId(altId === item.id ? '' : item.id); setError(''); },
        }, altId === item.id ? `返回${action?.label ?? '主操作'}` : item.label)))
      : null,
    form,
    error ? h('p', { className: 'px-v4-form-error', 'data-testid': 'action-error', role: 'alert' }, error) : null,
    h('button', {
      type: 'button',
      className: 'px-btn primary px-v4-inspect-primary',
      'data-testid': 'primary',
      'data-action': activeAction?.id ?? '',
      disabled: pending,
      onClick: submit,
    }, pending ? '提交中…' : activeAction?.label ?? '提交'));
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
    ? h('div', null,
      h(InspectBranchBody, { branch, member }),
      h(InspectBranchOwnerControl, { branch, team: run?.team, onAction }))
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
.px-v4-alt-actions { display:flex; gap:6px; flex-wrap:wrap; }
.px-v4-alt { border:1px solid var(--dsw-alias-border-l1); background:transparent; color:var(--dsw-alias-label-secondary); border-radius:999px; padding:3px 10px; font:inherit; font-size:var(--px-fs-3); cursor:pointer; }
.px-v4-alt:hover { color:var(--dsw-alias-label-primary); border-color:var(--dsw-alias-border-l2); }
.px-v4-alt.is-on { color:var(--dsw-alias-brand-primary); border-color:var(--dsw-alias-brand-primary); }
@media (max-width:1180px) { .px-v4-inspector { top:auto; left:0; width:100%; max-height:46vh; } }
`;
