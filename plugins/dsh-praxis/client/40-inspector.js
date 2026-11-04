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
