window.__ModuleLoader__.load({
  id: '@local/dsh-praxis',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const { useState, useEffect, useRef, useCallback } = React;

    const API = '/praxis/api';
    const TABS = [
      ['tower', '观测塔'],
      ['map', '认知地图'],
      ['contract', '契约'],
      ['discuss', '讨论'],
      ['experiment', '实验'],
      ['eval', '评估'],
      ['memory', '记忆'],
      ['lineage', '谱系'],
      ['audit', '审计'],
      ['knobs', '旋钮'],
    ];
    const STATE_TONE = {
      INTAKE: 'idle', QUESTION: 'idle', PREREG_FROZEN: 'info', DISCUSSION: 'info',
      SYNTHESIS: 'info', EXEC_READY: 'warn', EXECUTING: 'warn', REVIEW: 'warn',
      STAGE4: 'info', EVAL: 'info', MEMORY: 'ok', DECISION: 'ok', CLOSED: 'ok',
      DRIFT_DETECTED: 'bad', BLOCKED: 'bad',
    };
    const NEXT_LABEL = {
      prereg_freeze: '冻结契约', discussion: '启动讨论', experiment: '执行实验',
      review: '复核', stage4: '阶段四', eval_report: '提交评估', eval_read: '读评估',
      memory_commit: '提交记忆', decision: '记录决策',
    };

    async function api(path, init) {
      const headers = { 'x-praxis-request': '1', ...(init && init.headers) };
      const response = await fetch(`${API}${path}`, { ...init, headers });
      const text = await response.text();
      let value;
      try { value = text ? JSON.parse(text) : {}; } catch { value = { error: text }; }
      if (!response.ok) {
        const error = new Error(value.error ?? value.code ?? `HTTP ${response.status}`);
        error.code = value.code;
        error.blockers = value.blockers;
        error.receipt = value.receipt;
        throw error;
      }
      return value;
    }

    function usePraxis() {
      const [view, setView] = useState(null);
      const [error, setError] = useState('');
      const [busy, setBusy] = useState(false);
      const [lastAt, setLastAt] = useState(0);
      const [receipt, setReceipt] = useState(null);
      const timer = useRef(null);
      const hidden = useRef(false);

      const refresh = useCallback(async () => {
        try {
          const value = await api('/state');
          setView(value.view ?? value);
          setLastAt(Date.now());
          setError('');
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : String(cause));
        }
      }, []);

      useEffect(() => {
        let alive = true;
        const tick = async () => {
          if (!alive) return;
          if (!hidden.current) await refresh();
          timer.current = setTimeout(tick, 4000);
        };
        const onVisibility = () => { hidden.current = document.hidden; };
        document.addEventListener('visibilitychange', onVisibility);
        tick();
        return () => {
          alive = false;
          if (timer.current) clearTimeout(timer.current);
          document.removeEventListener('visibilitychange', onVisibility);
        };
      }, [refresh]);

      const send = useCallback(async (action, payload, options = {}) => {
        setBusy(true);
        setError('');
        let result = null;
        try {
          const command = {
            commandId: `${action}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
            action,
            runId: options.runId ?? undefined,
            actor: options.actor ?? undefined,
            payload: payload ?? {},
          };
          const value = await api('/command', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ command }),
          });
          if (value.view) setView(value.view);
          result = value.receipt ?? null;
          setReceipt(result);
          if (result && result.status === 'rejected') setError(`${result.reasonCode ?? 'REJECTED'}${result.nextAction ? ` → ${result.nextAction}` : ''}`);
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : String(cause));
          if (cause.receipt) setReceipt(cause.receipt);
          result = cause.receipt ?? null;
        } finally {
          setBusy(false);
        }
        return result;
      }, []);

      return { view, error, busy, lastAt, receipt, refresh, send };
    }

    function pill(tone, text) {
      return h('span', { className: `px-pill ${tone}` }, text);
    }

    function Card({ kicker, title, children, wide, actions }) {
      return h('article', { className: `px-card${wide ? ' px-wide' : ''}` },
        kicker ? h('p', { className: 'px-kicker' }, kicker) : null,
        title ? h('h2', null, title) : null,
        children,
        actions ? h('div', { className: 'px-actions' }, actions) : null);
    }

    function Readout({ rows }) {
      return h('dl', { className: 'px-readout' },
        rows.filter(Boolean).map(([key, value]) => h('div', { key },
          h('dt', null, key),
          h('dd', null, value))));
    }

    function Bar({ value, tone }) {
      const pct = Math.max(0, Math.min(1, Number(value) || 0)) * 100;
      return h('div', { className: 'px-bar', role: 'meter', 'aria-valuenow': Math.round(pct), 'aria-valuemin': 0, 'aria-valuemax': 100 },
        h('span', { className: tone ?? '', style: { width: `${pct}%` } }));
    }

    function Button({ children, onClick, tone, disabled, type = 'button', title }) {
      return h('button', { type, className: `px-btn${tone ? ` ${tone}` : ''}`, onClick, disabled, title }, children);
    }

    function Field({ label, hint, children }) {
      return h('label', { className: 'px-field' },
        h('span', { className: 'px-field-label' }, label, hint ? h('em', null, hint) : null),
        children);
    }

    function Input(props) {
      return h('input', { className: 'px-input', ...props });
    }

    function TextArea(props) {
      return h('textarea', { className: 'px-input px-textarea', rows: 4, ...props });
    }

    function Select({ options, ...props }) {
      return h('select', { className: 'px-input', ...props },
        options.map(([value, label]) => h('option', { key: value, value }, label)));
    }

    function Empty({ children }) {
      return h('p', { className: 'px-empty' }, children);
    }

    function Banner({ tone, children }) {
      return h('p', { className: `px-banner ${tone}`, role: tone === 'bad' ? 'alert' : 'status' }, children);
    }

    function num(value, digits = 2) {
      return typeof value === 'number' ? value.toFixed(digits) : '—';
    }

    function json(value) {
      try { return JSON.stringify(value, null, 2); } catch { return String(value); }
    }

    function parseJson(text, fallback) {
      if (!text || !text.trim()) return fallback;
      return JSON.parse(text);
    }

    // ---------------------------------------------------------------- shell

    function Header({ view, tab, setTab, onNewRun, lastAt, busy, onRefresh }) {
      const stale = lastAt && Date.now() - lastAt > 12000;
      return h('header', { className: 'px-head' },
        h('div', { className: 'px-head-top' },
          h('div', { className: 'px-brand' },
            h('span', { className: 'px-mark', 'aria-hidden': true }),
            h('div', null,
              h('p', { className: 'px-kicker' }, 'OBSERVATORY · RESEARCH ENGINE'),
              h('h1', null, 'Praxis'),
              h('p', { className: 'px-sub' }, '先把未知放上地图，再决定要不要收束。')),
          ),
          h('div', { className: 'px-head-right' },
          view ? pill(view.durability === 'durable' ? 'ok' : 'warn', view.durability === 'durable' ? '持久化' : '内存态') : null,
          view && view.active ? pill(STATE_TONE[view.active.state] ?? 'idle', view.active.state) : pill('idle', 'IDLE'),
          stale ? pill('warn', 'STALE') : null,
            h(Button, { onClick: onRefresh, disabled: busy, title: '刷新快照' }, busy ? '刷新中' : '刷新'),
            h(Button, { onClick: onNewRun, tone: 'primary' }, '新建运行'),
          ),
        ),
        h('nav', { className: 'px-tabs', 'aria-label': 'Praxis 分区' },
          TABS.map(([id, label]) => h('button', {
            key: id, type: 'button', className: tab === id ? 'is-on' : '', 'aria-pressed': tab === id,
            onClick: () => setTab(id),
          }, label))),
      );
    }

    function RunRail({ view, onSelect, activeId }) {
      const runs = view?.runs ?? [];
      return h('aside', { className: 'px-rail', 'aria-label': '运行列表' },
        h('p', { className: 'px-kicker' }, 'RUNS'),
        runs.length === 0 ? h('p', { className: 'px-muted' }, '还没有运行。新建一个剧本。') : null,
        h('ul', { className: 'px-runs' },
          runs.slice().reverse().map((run) => h('li', { key: run.id },
            h('button', {
              type: 'button',
              className: `px-run${run.id === activeId ? ' is-on' : ''}`,
              onClick: () => onSelect(run),
            },
            h('span', { className: `px-dot ${STATE_TONE[run.state] ?? 'idle'}`, 'aria-hidden': true }),
            h('span', { className: 'px-run-title' }, run.title),
            h('span', { className: 'px-run-meta' }, `${run.state} · ${run.playbookId}`),
            )))),
        h('div', { className: 'px-rail-foot' },
          h('p', { className: 'px-kicker' }, 'PLAYBOOKS'),
          (view?.playbooks ?? []).map((playbook) => h('p', { key: playbook.id, className: 'px-playbook' },
            h('strong', null, playbook.title),
            h('span', null, playbook.intent ?? ''),
          ))),
      );
    }

    // ---------------------------------------------------------------- pages

    function Tower({ view, active, send, setTab }) {
      if (!active) return h(Empty, null, '没有活动运行。新建运行后，这里会显示门禁、下一动作与野心读数。');
      const gate = active.blockers ?? [];
      const corruption = active.ambition?.corruptionFlags ?? [];
      const events = (active.events ?? []).slice(-9).reverse();
      return h('div', { className: 'px-grid' },
        h(Card, { kicker: 'CONTROL TOWER', title: active.title, wide: true },
          h(Readout, {
            rows: [
              ['剧本', active.playbookId],
              ['状态', active.state],
              ['版本', String(active.version)],
              ['旋钮哈希', active.knobHash],
              ['判断模型', active.models?.judge ?? '—'],
              ['评估模型', active.models?.evaluator ?? '—'],
            ],
          }),
          ['DECISION', 'CLOSED', 'DRIFT_DETECTED'].includes(active.state)
            ? h(Banner, { tone: active.state === 'DRIFT_DETECTED' ? 'bad' : 'ok' },
              active.state === 'DRIFT_DETECTED' ? '同结论重复：必须转向、重定义或停止。' : '本轮已到决策点。下一轮从新问题开始。')
            : gate.length
              ? h(Banner, { tone: 'warn' }, `实验门关闭：${gate.join(', ')}`)
              : h(Banner, { tone: 'ok' }, '实验门开放。冻结契约已生效。'),
          h('div', { className: 'px-actions' },
            active.state === 'INTAKE' ? h(Button, { tone: 'primary', onClick: () => setTab('contract') }, '去冻结契约') : null,
            active.blockers?.length ? h('span', { className: 'px-muted' }, `下一动作：${NEXT_LABEL[active.nextAction] ?? active.nextAction ?? '—'}`) : null,
          ),
        ),
        h(Card, { kicker: 'AMBITION', title: '野心读数' },
          h(Readout, { rows: [
            ['A_p 挑战', num(active.ambition?.A_p)],
            ['E 兑现', num(active.ambition?.E)],
            ['A_d 实际', num(active.ambition?.A_d)],
            ['A_final', num(active.ambition?.A_final)],
            ['通胀', active.ambition?.inflationFlag ? '是' : '否'],
          ] }),
          h(Bar, { value: active.ambition?.A_final ?? 0, tone: 'ok' }),
          corruption.length ? h(Banner, { tone: 'bad' }, `腐化信号：${corruption.join(', ')}`) : h('p', { className: 'px-muted' }, '没有腐化信号，不等于有野心。'),
        ),
        h(Card, { kicker: 'TIMELINE', title: '最近事件', wide: true },
          events.length ? h('ol', { className: 'px-events' }, events.map((event) => h('li', { key: event.seq },
            h('span', { className: 'px-num' }, `#${event.seq}`),
            h('span', { className: 'px-event-type' }, event.type),
            h('span', { className: 'px-muted' }, event.at ? new Date(event.at).toLocaleTimeString('zh-CN', { hour12: false }) : ''),
          ))) : h(Empty, null, '还没有事件。'),
        ),
      );
    }

    function MapPage({ view, active, send }) {
      if (!active) return h(Empty, null, '没有活动运行，地图为空。');
      const map = view.map ?? { nodes: [], edges: [], frontier: [], blindSpots: [], contradictions: [], meanReversion: {} };
      const [claim, setClaim] = useState('');
      const [status, setStatus] = useState('unverified');
      const [contradicts, setContradicts] = useState('');
      const [from, setFrom] = useState('');
      const [to, setTo] = useState('');
      const [relation, setRelation] = useState('depends');
      return h('div', { className: 'px-grid' },
        h(Card, { kicker: 'COGNITIVE MAP', title: `节点 ${map.nodes.length} · 边 ${map.edges.length}`, wide: true },
          map.nodes.length
            ? h('ul', { className: 'px-nodes' }, map.nodes.map((node) => h('li', { key: node.id },
              h('span', { className: `px-dot ${node.status === 'unverified' ? 'warn' : 'ok'}`, 'aria-hidden': true }),
              h('strong', null, node.label),
              h('span', { className: 'px-muted' }, `${node.status} · ${node.evidenceRefs?.length ?? 0} 证据`),
            )))
            : h(Empty, null, '地图为空。空地图不是共识。'),
          map.edges.length
            ? h('div', null,
              h('p', { className: 'px-kicker' }, 'EDGES'),
              h('ul', { className: 'px-list' }, map.edges.map((edge) => h('li', { key: edge.id },
                h('span', { className: 'px-num' }, edge.from ?? '?'),
                h('span', { className: 'px-muted' }, ` —${edge.kind}→ `),
                h('span', { className: 'px-num' }, edge.to ?? '?')))))
            : null,
          map.contradictions.length
            ? h('div', null,
              h('p', { className: 'px-kicker' }, 'CONTRADICTIONS'),
              h('ul', { className: 'px-pairs' }, map.contradictions.map((item) => h('li', { key: item.id ?? item.left },
                `${item.left}  ≠  ${item.right}`))))
            : null,
        ),
        h(Card, { kicker: 'FRONTIER', title: '已知的未知' },
          map.frontier.length ? h('ul', { className: 'px-list' }, map.frontier.map((item) => h('li', { key: item.nodeId }, `${item.nodeId} · ${item.whyUnknown}`)))
            : h(Empty, null, '还没有登记未知。没有未知，通常意味着问题被缩小了。'),
          map.blindSpots.length ? h('ul', { className: 'px-list' }, map.blindSpots.map((item) => h('li', { key: item.area }, item.area))) : null,
        ),
        h(Card, { kicker: 'MEAN REVERSION', title: '均值回归检查' },
          h(Readout, { rows: [
            ['距离', num(map.meanReversion?.distance)],
            ['居中', map.meanReversion?.centered ? '是' : '否'],
            ['可疑', map.meanReversion?.suspect ? '是' : '否'],
          ] }),
        ),
        h(Card, { kicker: 'ADD', title: '登记主张' },
          h(Field, { label: '主张' }, h(Input, { value: claim, onChange: (event) => setClaim(event.target.value), placeholder: '结构在声明语料中可被主动提取' })),
          h(Field, { label: '状态' }, h(Select, { value: status, onChange: (event) => setStatus(event.target.value), options: [['unverified', '未验证'], ['known', '已知'], ['contested', '有争议'], ['unknown', '未知']] })),
          h(Field, { label: '与哪条矛盾（可选）' }, h(Select, { value: contradicts, onChange: (event) => setContradicts(event.target.value), options: [['', '无'], ...map.nodes.map((node) => [node.label, node.label])] })),
          h(Button, { tone: 'primary', onClick: async () => {
            if (!claim.trim()) return;
            const result = await send('map_claim', { claim: claim.trim(), status, contradicts: contradicts || undefined, evidenceRefs: [] });
            if (result && result.status === 'committed') setClaim('');
          } }, '登记'),
        ),
        h(Card, { kicker: 'EDGE', title: '连接两个节点' },
          h(Field, { label: '起点' }, h(Select, { value: from, onChange: (event) => setFrom(event.target.value), options: [['', '选择'], ...map.nodes.map((node) => [node.id, node.label])] })),
          h(Field, { label: '终点' }, h(Select, { value: to, onChange: (event) => setTo(event.target.value), options: [['', '选择'], ...map.nodes.map((node) => [node.id, node.label])] })),
          h(Field, { label: '关系' }, h(Select, { value: relation, onChange: (event) => setRelation(event.target.value), options: [['supports', '支持'], ['contradicts', '矛盾'], ['derives', '派生'], ['analogous', '类比'], ['depends', '依赖'], ['frontier', '前沿']] })),
          h(Button, { onClick: () => send('map_edge', { from, to, relation }), disabled: !from || !to }, '连边'),
        ),
      );
    }

    function ContractPage({ active, send }) {
      if (!active) return h(Empty, null, '没有活动运行。');
      const frozen = active.prereg?.frozen;
      const [form, setForm] = useState({
        question: active.title, prediction: '', acceptance: '', acceptableFailure: '',
        controls: 'shuffle, label-shuffle', primary: 'separation', threshold: '0.08', seeds: '3',
        source: 'declared-corpus', split: 'train', evalSplit: 'held-out', wallMin: '30', agents: '4',
      });
      const update = (key) => (event) => setForm({ ...form, [key]: event.target.value });
      const submit = () => send('prereg_freeze', {
        prereg: {
          question: form.question,
          prediction: form.prediction,
          acceptance: form.acceptance,
          acceptableFailure: form.acceptableFailure,
          controls: form.controls.split(',').map((item) => item.trim()).filter(Boolean),
          metrics: { primary: form.primary, threshold: Number(form.threshold), seeds: Number(form.seeds) },
          input: { source: form.source, split: form.split, evalSplit: form.evalSplit },
          budget: { wallMin: Number(form.wallMin), agents: Number(form.agents) },
          stop: { sameConclusion: 2 },
        },
      });
      return h('div', { className: 'px-grid' },
        h(Card, { kicker: 'PRE-REGISTRATION', title: frozen ? '已冻结' : '待冻结', wide: true },
          frozen
            ? h('div', null,
              h(Banner, { tone: 'ok' }, `冻结哈希 ${active.prereg.hash}`),
              h('pre', { className: 'px-code' }, json(active.prereg.contract)),
              h(Banner, { tone: 'warn' }, '结果出现后改契约不会覆盖本运行；改动会要求新运行。'),
            )
            : h('div', null,
              h(Field, { label: '问题' }, h(Input, { value: form.question, onChange: update('question') })),
              h(Field, { label: '预测', hint: '具体数字/方向' }, h(Input, { value: form.prediction, onChange: update('prediction'), placeholder: '新表示使分离度高于冻结基线 0.08' })),
              h(Field, { label: '验收' }, h(TextArea, { value: form.acceptance, onChange: update('acceptance'), placeholder: 'pass 当且仅当主指标超过基线且对照被破坏' })),
              h(Field, { label: '可接受失败' }, h(TextArea, { value: form.acceptableFailure, onChange: update('acceptableFailure'), placeholder: '若对照未被破坏，接受该表示无效' })),
              h(Field, { label: '对照', hint: '逗号分隔' }, h(Input, { value: form.controls, onChange: update('controls') })),
              h('div', { className: 'px-row3' },
                h(Field, { label: '主指标' }, h(Input, { value: form.primary, onChange: update('primary') })),
                h(Field, { label: '阈值' }, h(Input, { value: form.threshold, onChange: update('threshold'), inputMode: 'decimal' })),
                h(Field, { label: '种子' }, h(Input, { value: form.seeds, onChange: update('seeds'), inputMode: 'numeric' })),
              ),
              h('div', { className: 'px-row3' },
                h(Field, { label: '数据源' }, h(Input, { value: form.source, onChange: update('source') })),
                h(Field, { label: '训练切分' }, h(Input, { value: form.split, onChange: update('split') })),
                h(Field, { label: '评估切分' }, h(Input, { value: form.evalSplit, onChange: update('evalSplit') })),
              ),
              h('div', { className: 'px-row3' },
                h(Field, { label: '时限(分)' }, h(Input, { value: form.wallMin, onChange: update('wallMin'), inputMode: 'numeric' })),
                h(Field, { label: '代理数' }, h(Input, { value: form.agents, onChange: update('agents'), inputMode: 'numeric' })),
              ),
              h(Button, { tone: 'primary', onClick: submit }, '冻结契约'),
              h('p', { className: 'px-muted' }, '缺任一字段会被拒绝，并列出 blockers。'),
            ),
        ),
      );
    }

    function DiscussPage({ active, send }) {
      if (!active) return h(Empty, null, '没有活动运行。');
      const [packages, setPackages] = useState('');
      const [persona, setPersona] = useState('');
      const heterogeneity = active.discussion?.heterogeneity;
      const sample = JSON.stringify([
        { persona: 'theorist', claim: '未知结构可以被主动提取', assumptions: ['信号存在于声明的语料'], evidence: ['derivation:1'], style: 'theoretical', minority: true, retained: true },
        { persona: 'empiricist', claim: '当前语料只支持均值回归', assumptions: ['噪声解释全部方差'], evidence: ['data:2'], style: 'empirical', minority: false, retained: true },
      ], null, 2);
      const personaSample = JSON.stringify({
        role: 'devil',
        topicBinding: { defaultAssumptionToAttack: '熟悉路径足够', expectedCounterexample: '跨域反例', falsifiableDisagreement: '若对照被破坏则承认' },
        symptomProfile: { blindSpots: ['锚定'], attractors: ['论文'], antiPatterns: ['附和'] },
        sinthome: { strategy: '先写反例再写结论', observableWorkProduct: 'counterexample' },
        stance: { claim: '未知不是风险，退回已知才是', scope: '本议题', prior: 0.6 },
        evidenceStandard: { allowed: ['data', 'derivation'], minIndependentSources: 2, requiresControl: true, forbidsDomains: [] },
        taboos: ['不改冻结判据'],
      }, null, 2);
      return h('div', { className: 'px-grid' },
        h(Card, { kicker: 'DISCUSSION', title: '异质讨论', wide: true },
          h('p', { className: 'px-muted' }, `轮次 ${active.discussion?.rounds ?? 0} · 观点包 ${active.discussion?.packages?.length ?? 0}`),
          heterogeneity ? h('div', null,
            h(Readout, { rows: [
              ['D 异质度', num(heterogeneity.D)],
              ['style-only', heterogeneity.styleOnly ? '是' : '否'],
              ['增益', num(heterogeneity.gain)],
              ['少数派保留', num(heterogeneity.minorityRetention)],
            ] }),
            h(Bar, { value: heterogeneity.D, tone: heterogeneity.D < 0.35 ? 'bad' : 'ok' }),
            heterogeneity.styleOnly || heterogeneity.D < 0.35 ? h(Banner, { tone: 'bad' }, '讨论空转或人格通胀：只有措辞不同，没有证据路径差异。') : null,
          ) : h(Empty, null, '还没有讨论。合成不压平，先让立场互相攻击。'),
          h(Field, { label: '观点包 JSON' }, h(TextArea, { rows: 8, value: packages, onChange: (event) => setPackages(event.target.value), placeholder: '粘贴观点包数组' })),
          h('div', { className: 'px-actions' },
            h(Button, { onClick: () => setPackages(sample) }, '载入示例'),
            h(Button, { tone: 'primary', onClick: async () => {
              let parsed;
              try { parsed = parseJson(packages, []); } catch { return; }
              if (!Array.isArray(parsed) || parsed.length < 2) return;
              const result = await send('discussion', { round: (active.discussion?.rounds ?? 0) + 1, packages: parsed });
              if (result && result.status === 'committed') setPackages('');
            } }, '提交讨论'),
          ),
        ),
        h(Card, { kicker: 'PERSONA', title: '固定独立人格' },
          h(Field, { label: '人格 JSON', hint: '必须带 topicBinding 与 sinthome.observableWorkProduct' }, h(TextArea, { rows: 8, value: persona, onChange: (event) => setPersona(event.target.value) })),
          h('div', { className: 'px-actions' },
            h(Button, { onClick: () => setPersona(personaSample) }, '载入示例'),
            h(Button, { onClick: async () => {
              let parsed;
              try { parsed = parseJson(persona, null); } catch { return; }
              if (!parsed) return;
              const result = await send('pin_persona', { persona: parsed });
              if (result && result.status === 'committed') setPersona('');
            } }, '固定'),
          ),
          (active.personas ?? []).length ? h('ul', { className: 'px-list' }, active.personas.map((item) => h('li', { key: item.contentHash }, `${item.role ?? 'persona'} · ${item.contentHash}`))) : null,
        ),
      );
    }

    function ExperimentPage({ active, send }) {
      if (!active) return h(Empty, null, '没有活动运行。');
      const [command, setCommand] = useState('');
      const [artifactHash, setArtifactHash] = useState('');
      const [verdict, setVerdict] = useState('pass');
      const [items, setItems] = useState('对照被破坏\n主指标超过基线');
      const [stage4, setStage4] = useState('');
      const [actor, setActor] = useState('coding');
      return h('div', { className: 'px-grid' },
        h(Card, { kicker: 'EXECUTE', title: '实验执行', wide: true },
          h(Field, { label: '派工角色' }, h(Select, { value: actor, onChange: (event) => setActor(event.target.value), options: [['coding', 'coding'], ['worker', 'worker'], ['root', 'root'], ['user', 'user']] })),
          h(Field, { label: '执行描述' }, h(Input, { value: command, onChange: (event) => setCommand(event.target.value), placeholder: 'train + held-out probe' })),
          h(Field, { label: '产物哈希' }, h(Input, { value: artifactHash, onChange: (event) => setArtifactHash(event.target.value), placeholder: 'artifact-sha' })),
          h(Button, { tone: 'primary', onClick: async () => {
            if (!command.trim()) return;
            const result = await send('experiment', { command: command.trim(), artifactHash: artifactHash.trim() || null }, { actor: { kind: actor, id: `${actor}-ui` } });
            if (result && result.status === 'committed') { setCommand(''); setArtifactHash(''); }
          } }, '记录实验'),
          (active.experiments ?? []).length
            ? h('table', { className: 'px-table' },
              h('thead', null, h('tr', null, ['ID', '命令', '产物', '状态'].map((label) => h('th', { key: label }, label)))),
              h('tbody', null, active.experiments.map((item) => h('tr', { key: item.id },
                h('td', { className: 'px-num' }, item.id),
                h('td', null, item.command),
                h('td', { className: 'px-num' }, item.artifactHash ?? '—'),
                h('td', null, item.resultState)))))
            : h(Empty, null, '还没有实验记录。'),
        ),
        h(Card, { kicker: 'REVIEW', title: '关键判据复核' },
          h(Field, { label: '结论' }, h(Select, { value: verdict, onChange: (event) => setVerdict(event.target.value), options: [['pass', 'pass'], ['suspect', 'suspect'], ['fail', 'fail']] })),
          h(Field, { label: '逐项' }, h(TextArea, { value: items, onChange: (event) => setItems(event.target.value) })),
          h(Button, { onClick: () => send('review', { verdict, items: items.split('\n').map((line) => line.trim()).filter(Boolean) }, { actor: { kind: 'reviewer', id: 'reviewer-ui' } }) }, '记录复核'),
        ),
        h(Card, { kicker: 'STAGE 4', title: '阶段四（root 亲写）', wide: true },
          h(Field, { label: '解读 / 追问 / 认知 / 决策 / 野心自省' }, h(TextArea, { rows: 5, value: stage4, onChange: (event) => setStage4(event.target.value), placeholder: '结果是什么；为什么；改变了什么认知；下一步；是否在投机' })),
          h(Button, { onClick: () => send('stage4', { text: stage4 }) }, '记录阶段四'),
        ),
      );
    }

    function EvalPage({ active, send }) {
      if (!active) return h(Empty, null, '没有活动运行。');
      const [reportHash, setReportHash] = useState('');
      const [verdict, setVerdict] = useState('pass');
      const [seeds, setSeeds] = useState('3');
      const evalState = active.eval ?? {};
      return h('div', { className: 'px-grid' },
        h(Card, { kicker: 'EVALUATION', title: '独立评估', wide: true },
          h(Banner, { tone: evalState.readAt ? 'ok' : 'warn' }, evalState.readAt ? `已读：${evalState.readAt}` : '评估报告尚未被读；promotion 会被拒绝。'),
          h(Readout, { rows: [
            ['报告哈希', evalState.reportHash ?? '—'],
            ['结论', evalState.verdict ?? '—'],
            ['种子', String(evalState.seeds ?? '—')],
            ['读取人', evalState.readBy ?? '—'],
          ] }),
          h(Field, { label: '报告哈希' }, h(Input, { value: reportHash, onChange: (event) => setReportHash(event.target.value), placeholder: 'eval-report-sha' })),
          h('div', { className: 'px-row3' },
            h(Field, { label: '结论' }, h(Select, { value: verdict, onChange: (event) => setVerdict(event.target.value), options: [['pass', 'pass'], ['suspect', 'suspect'], ['fail', 'fail']] })),
            h(Field, { label: '种子' }, h(Input, { value: seeds, onChange: (event) => setSeeds(event.target.value), inputMode: 'numeric' })),
          ),
          h('div', { className: 'px-actions' },
            h(Button, { onClick: () => send('eval_report', { reportHash: reportHash.trim() || null, verdict, seeds: Number(seeds) || 3 }, { actor: { kind: 'evaluator', id: 'evaluator-ui' } }) }, '提交评估报告'),
            h(Button, { tone: 'primary', onClick: () => send('eval_read', { reportHash: reportHash.trim() || evalState.reportHash }) }, '我读过报告（eval.read）'),
          ),
        ),
        h(Card, { kicker: 'PROMOTION', title: '候选晋升' },
          h('p', { className: 'px-muted' }, 'kernel 路径（evaluator/stop/permissions/hidden-tests）任何候选都不可触碰。'),
          h(Button, { onClick: () => send('promote', { candidateId: 'candidate-ui', touches: ['system_prompt'] }) }, '提交候选（system_prompt）'),
        ),
      );
    }

    function MemoryPage({ active, send }) {
      if (!active) return h(Empty, null, '没有活动运行。');
      const [claim, setClaim] = useState('');
      const [evidence, setEvidence] = useState('');
      const selected = useRef(null);
      const proposals = active.memory?.proposals ?? [];
      return h('div', { className: 'px-grid' },
        h(Card, { kicker: 'MEMORY', title: '记忆提案与提交', wide: true },
          h(Field, { label: '主张' }, h(Input, { value: claim, onChange: (event) => setClaim(event.target.value), placeholder: '在声明语料上，主动提取优于均值基线' })),
          h(Field, { label: '证据引用', hint: '逗号分隔' }, h(Input, { value: evidence, onChange: (event) => setEvidence(event.target.value), placeholder: 'artifact-sha, eval-report-sha' })),
          h(Button, { onClick: async () => {
            if (!claim.trim()) return;
            const result = await send('memory_propose', { claim: claim.trim(), evidenceRefs: evidence.split(',').map((item) => item.trim()).filter(Boolean) });
            if (result && result.status === 'committed') setClaim('');
          } }, '提出记忆'),
          proposals.length ? h('ul', { className: 'px-list' }, proposals.map((item) => h('li', { key: item.id },
            h('span', { className: `px-dot ${item.status === 'committed' ? 'ok' : 'warn'}`, 'aria-hidden': true }),
            `${item.id} · ${item.claim} · ${item.status}`,
          ))) : h(Empty, null, '没有提案。'),
        ),
        h(Card, { kicker: 'COMMIT', title: '用户提交（仅用户）' },
          h(Select, { value: selected.current ?? '', onChange: (event) => { selected.current = event.target.value; } , options: [['', '选择提案'], ...proposals.filter((item) => item.status !== 'committed').map((item) => [item.id, `${item.id} · ${item.claim}`])] }),
          h(Button, { tone: 'primary', onClick: () => { if (selected.current) send('memory_commit', { proposalId: selected.current }); } }, '提交到长期记忆'),
          h('p', { className: 'px-muted' }, 'agent 不能提交记忆；未提交的提案不是记忆。'),
        ),
      );
    }

    function LineagePage({ view, active }) {
      const runs = view?.runs ?? [];
      return h('div', { className: 'px-grid' },
        h(Card, { kicker: 'LINEAGE', title: '运行谱系', wide: true },
          runs.length ? h('ul', { className: 'px-tree' }, runs.map((run) => h('li', { key: run.id },
            h('span', { className: `px-dot ${STATE_TONE[run.state] ?? 'idle'}`, 'aria-hidden': true }),
            h('strong', null, run.title),
            h('span', { className: 'px-num' }, run.id),
            run.parentId ? h('span', { className: 'px-muted' }, `← ${run.parentId}`) : h('span', { className: 'px-muted' }, 'root'),
            h('span', { className: 'px-muted' }, `${run.state} · v${run.version}`),
          ))) : h(Empty, null, '还没有运行。'),
        ),
        h(Card, { kicker: 'CHILDREN', title: '当前运行子代' },
          active ? (active.lineage?.children?.length ? h('ul', { className: 'px-list' }, active.lineage.children.map((id) => h('li', { key: id }, id))) : h('p', { className: 'px-muted' }, '没有子运行。改旋钮会产生 fork。')) : h(Empty, null, '无活动运行。'),
        ),
      );
    }

    function AuditPage({ active }) {
      if (!active) return h(Empty, null, '没有活动运行。');
      const events = (active.events ?? []).slice().reverse();
      const exportJson = () => {
        const blob = new Blob([JSON.stringify(active, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `${active.id}-audit.json`;
        anchor.click();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
      };
      return h('div', { className: 'px-grid' },
        h(Card, { kicker: 'AUDIT', title: `事件 ${events.length}`, wide: true, actions: h(Button, { onClick: exportJson }, '导出 JSON') },
          events.length ? h('table', { className: 'px-table' },
            h('thead', null, h('tr', null, ['seq', 'type', 'at', 'data'].map((label) => h('th', { key: label }, label)))),
            h('tbody', null, events.map((event) => h('tr', { key: event.seq },
              h('td', { className: 'px-num' }, event.seq),
              h('td', null, event.type),
              h('td', { className: 'px-num' }, event.at?.slice(11, 19) ?? ''),
              h('td', { className: 'px-code-inline' }, JSON.stringify(event.data ?? {}).slice(0, 120))))))
            : h(Empty, null, '没有事件。'),
        ),
      );
    }

    function KnobsPage({ view, active, send }) {
      const fields = view?.knobFields ?? [];
      const current = active?.knobs ?? view?.knobs ?? {};
      const [draft, setDraft] = useState(current);
      useEffect(() => setDraft(current), [active?.id, active?.knobHash]);
      return h('div', { className: 'px-grid' },
        h(Card, { kicker: 'KNOBS', title: '冻结超参', wide: true },
          h(Banner, { tone: 'warn' }, '运行中改任何被 pin 的参数都会分叉成新运行，不改写当前运行。'),
          h('div', { className: 'px-knobs' }, fields.map((field) => h('div', { key: field.key, className: 'px-knob' },
            h('div', { className: 'px-knob-head' },
              h('strong', null, field.label),
              h('span', { className: 'px-kicker' }, `${field.scope} · ${field.unit}`)),
            h('div', { className: 'px-knob-body' },
              h('input', { className: 'px-range', type: 'range', min: field.min, max: field.max, step: field.step, value: draft[field.key] ?? current[field.key] ?? 0, onChange: (event) => setDraft({ ...draft, [field.key]: Number(event.target.value) }), 'aria-label': field.label }),
              h('span', { className: 'px-num px-knob-value' }, String(draft[field.key] ?? current[field.key] ?? '—'))),
            h('p', { className: 'px-muted' }, field.hint ?? `默认 ${field.min}–${field.max}`),
          ))),
          h(Button, { tone: 'primary', onClick: () => send('set_knobs', { knobs: { ...current, ...draft } }) }, '冻结为新运行'),
        ),
        h(Card, { kicker: 'DEFAULTS', title: '默认值' },
          h('pre', { className: 'px-code' }, json(view?.defaults ?? {})),
        ),
      );
    }

    // ---------------------------------------------------------------- app

    function App() {
      const praxis = usePraxis();
      const [tab, setTab] = useState('tower');
      const [newRun, setNewRun] = useState(false);
      const [playbookId, setPlaybookId] = useState('scientific-loop');
      const [title, setTitle] = useState('');
      const view = praxis.view;
      const active = view?.active ?? null;
      const selectRun = async (run) => {
        if (run && run.id !== active?.id) await praxis.send('activate', {}, { runId: run.id });
        await praxis.refresh();
      };

      if (!view) {
        return h('section', { className: 'px-shell', 'aria-busy': 'true' },
          h('style', null, CSS),
          h('div', { className: 'px-loading' },
            h('p', { className: 'px-kicker' }, 'PRAXIS'),
            h('p', null, praxis.error ? `观测通道未接通：${praxis.error}` : '正在读取观测快照…'),
            h(Button, { onClick: praxis.refresh }, '重试')));
      }

      return h('section', { className: 'px-shell' },
        h('style', null, CSS),
        h(Header, {
          view, tab, setTab, lastAt: praxis.lastAt, busy: praxis.busy,
          onRefresh: praxis.refresh,
          onNewRun: () => setNewRun(!newRun),
        }),
        praxis.error ? h(Banner, { tone: 'bad' }, praxis.error) : null,
        praxis.receipt ? h(Banner, { tone: praxis.receipt.status === 'committed' || praxis.receipt.status === 'replayed' ? 'ok' : 'warn' },
          `回执 ${praxis.receipt.status}${praxis.receipt.reasonCode ? ` · ${praxis.receipt.reasonCode}` : ''}${praxis.receipt.runId ? ` · ${praxis.receipt.runId}` : ''}`) : null,
        newRun ? h('div', { className: 'px-new' },
          h(Field, { label: '剧本' }, h(Select, { value: playbookId, onChange: (event) => setPlaybookId(event.target.value), options: (view.playbooks ?? []).map((playbook) => [playbook.id, `${playbook.title} · ${playbook.domain}`]) })),
          h(Field, { label: '标题' }, h(Input, { value: title, onChange: (event) => setTitle(event.target.value), placeholder: '这轮要回答什么问题' })),
          h(Button, { tone: 'primary', onClick: async () => {
            const result = await praxis.send('start', { playbookId, title: title.trim() || playbookId });
            if (result && result.status === 'committed') { setNewRun(false); setTitle(''); setTab('contract'); }
          } }, '创建'),
        ) : null,
        h('div', { className: 'px-layout' },
          h(RunRail, { view, activeId: active?.id, onSelect: selectRun }),
          h('main', { className: 'px-main' },
            tab === 'tower' ? h(Tower, { view, active, send: praxis.send, setTab }) : null,
            tab === 'map' ? h(MapPage, { view, active, send: praxis.send }) : null,
            tab === 'contract' ? h(ContractPage, { active, send: praxis.send }) : null,
            tab === 'discuss' ? h(DiscussPage, { active, send: praxis.send }) : null,
            tab === 'experiment' ? h(ExperimentPage, { active, send: praxis.send }) : null,
            tab === 'eval' ? h(EvalPage, { active, send: praxis.send }) : null,
            tab === 'memory' ? h(MemoryPage, { active, send: praxis.send }) : null,
            tab === 'lineage' ? h(LineagePage, { view, active }) : null,
            tab === 'audit' ? h(AuditPage, { active }) : null,
            tab === 'knobs' ? h(KnobsPage, { view, active, send: praxis.send }) : null,
          ),
        ),
      );
    }

    function Dock() {
      const praxis = usePraxis();
      const active = praxis.view?.active;
      return h('div', { className: 'px-dock' },
        h('span', { className: 'px-dock-mark', 'aria-hidden': true }),
        h('strong', null, 'Praxis'),
        h('span', { className: 'px-muted' }, active ? `${active.title} · ${active.state}` : '空闲 · 未选择运行'),
        active?.blockers?.length ? h('span', { className: 'px-dock-warn' }, `门禁 ${active.blockers.length}`) : null,
      );
    }

    function Icon({ size = 20, active = false }) {
      return h('svg', {
        width: size, height: size, viewBox: '0 0 24 24', 'aria-hidden': true,
        fill: 'none', stroke: active ? 'var(--dsw-alias-brand-primary)' : 'currentColor', strokeWidth: 1.5,
        strokeLinecap: 'round', strokeLinejoin: 'round',
      },
      h('circle', { cx: 12, cy: 12, r: 8.2 }),
      h('path', { d: 'M12 3.8v16.4M3.8 12h16.4' }),
      h('circle', { cx: 12, cy: 12, r: 2.4, fill: 'currentColor', stroke: 'none' }),
      h('path', { d: 'M17.6 6.4l2.2-2.2M4.2 19.8l2.2-2.2' }));
    }

    const CSS = `
      .px-shell {
        color: var(--dsw-alias-label-primary);
        background: var(--dsw-alias-bg-base);
        font: 13px/1.5 ui-sans-serif, -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
        min-height: 100%;
        padding: 20px 24px 40px;
        display: grid; gap: 14px; align-content: start;
        font-variant-numeric: tabular-nums;
      }
      .px-shell *, .px-dock * { box-sizing: border-box; }
      .px-head { display: grid; gap: 10px; padding-bottom: 0; border-bottom: 1px solid var(--dsw-alias-border-l1); }
      .px-head-top { display: flex; align-items: flex-end; justify-content: space-between; gap: 20px; }
      .px-brand { display: flex; gap: 12px; align-items: center; }
      .px-mark { width: 30px; height: 30px; border: 1px solid var(--dsw-alias-border-l2); border-radius: 50%; position: relative; display: inline-block; }
      .px-mark::before, .px-mark::after { content: ""; position: absolute; background: var(--dsw-alias-brand-primary); }
      .px-mark::before { left: 50%; top: 4px; bottom: 4px; width: 1px; }
      .px-mark::after { top: 50%; left: 4px; right: 4px; height: 1px; }
      .px-shell h1 { margin: 0; font-size: 26px; line-height: 1.1; font-weight: 560; letter-spacing: .01em; }
      .px-shell h2 { margin: 0; font-size: 15px; font-weight: 560; }
      .px-kicker { margin: 0; font-size: 10px; letter-spacing: .18em; text-transform: uppercase; color: var(--dsw-alias-label-secondary); }
      .px-sub { margin: 2px 0 0; color: var(--dsw-alias-label-secondary); }
      .px-head-right { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
      .px-pill { font-size: 11px; padding: 2px 8px; border-radius: 2px; border: 1px solid var(--dsw-alias-border-l2); color: var(--dsw-alias-label-secondary); white-space: nowrap; }
      .px-pill.ok { color: var(--dsw-alias-state-success-primary); border-color: currentColor; }
      .px-pill.warn { color: var(--dsw-alias-state-warn-primary); border-color: currentColor; }
      .px-pill.bad { color: var(--dsw-alias-state-error-primary); border-color: currentColor; }
      .px-pill.info { color: var(--dsw-alias-brand-primary); border-color: currentColor; }
      .px-pill.idle { color: var(--dsw-alias-label-secondary); }
      .px-tabs { display: flex; gap: 2px; flex-wrap: wrap; border-bottom: 1px solid var(--dsw-alias-border-l1); margin-bottom: -1px; }
      .px-tabs button { appearance: none; border: 0; background: transparent; color: var(--dsw-alias-label-secondary); font: inherit; font-size: 12px; padding: 8px 12px; cursor: pointer; border-bottom: 1px solid transparent; }
      .px-tabs button:hover { color: var(--dsw-alias-label-primary); }
      .px-tabs button.is-on { color: var(--dsw-alias-label-primary); border-bottom-color: var(--dsw-alias-brand-primary); }
      .px-tabs button:focus-visible, .px-btn:focus-visible, .px-input:focus-visible, .px-run:focus-visible { outline: 1px solid var(--dsw-alias-brand-primary); outline-offset: 2px; }
      .px-layout { display: grid; grid-template-columns: 240px minmax(0, 1fr); gap: 18px; align-items: start; }
      .px-rail { display: grid; gap: 8px; position: sticky; top: 12px; }
      .px-runs { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; }
      .px-run { width: 100%; text-align: left; background: transparent; border: 1px solid transparent; color: inherit; padding: 8px 9px; display: grid; grid-template-columns: 8px 1fr; grid-template-rows: auto auto; column-gap: 8px; cursor: pointer; border-radius: 2px; }
      .px-run:hover { border-color: var(--dsw-alias-border-l1); background: var(--dsw-alias-bg-layer-1); }
      .px-run.is-on { border-color: var(--dsw-alias-border-l2); background: var(--dsw-alias-bg-layer-1); }
      .px-run-title { font-size: 12.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .px-run-meta { grid-column: 2; font-size: 10.5px; color: var(--dsw-alias-label-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .px-dot { width: 7px; height: 7px; border-radius: 50%; display: inline-block; margin-top: 5px; background: var(--dsw-alias-label-secondary); }
      .px-dot.ok { background: var(--dsw-alias-state-success-primary); }
      .px-dot.warn { background: var(--dsw-alias-state-warn-primary); }
      .px-dot.bad { background: var(--dsw-alias-state-error-primary); }
      .px-dot.info { background: var(--dsw-alias-brand-primary); }
      .px-rail-foot { margin-top: 12px; border-top: 1px solid var(--dsw-alias-border-l1); padding-top: 10px; }
      .px-playbook { margin: 6px 0 0; display: grid; gap: 2px; font-size: 11px; color: var(--dsw-alias-label-secondary); }
      .px-playbook strong { color: var(--dsw-alias-label-primary); font-weight: 500; font-size: 12px; }
      .px-main { min-width: 0; }
      .px-grid { display: grid; grid-template-columns: minmax(0, 1.55fr) minmax(260px, .85fr); gap: 12px; align-items: start; }
      .px-card { border: 1px solid var(--dsw-alias-border-l1); background: var(--dsw-alias-bg-layer-1); padding: 14px 16px; display: grid; gap: 10px; border-radius: 2px; }
      .px-wide { grid-column: 1 / -1; }
      .px-card h2 { letter-spacing: .01em; }
      .px-readout { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 10px 16px; margin: 0; }
      .px-readout dt { font-size: 10.5px; letter-spacing: .08em; text-transform: uppercase; color: var(--dsw-alias-label-secondary); }
      .px-readout dd { margin: 1px 0 0; font-size: 13px; overflow-wrap: anywhere; }
      .px-num { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; }
      .px-muted { color: var(--dsw-alias-label-secondary); margin: 0; }
      .px-empty { color: var(--dsw-alias-label-secondary); margin: 0; padding: 14px; border: 1px dashed var(--dsw-alias-border-l1); text-align: center; }
      .px-btn { appearance: none; border: 1px solid var(--dsw-alias-border-l2); background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-primary); font: inherit; font-size: 12px; padding: 5px 11px; cursor: pointer; border-radius: 2px; }
      .px-btn:hover { border-color: var(--dsw-alias-brand-primary); }
      .px-btn.primary { background: var(--dsw-alias-brand-primary); border-color: var(--dsw-alias-brand-primary); color: var(--dsw-alias-bg-base); }
      .px-btn:disabled { opacity: .5; cursor: not-allowed; }
      .px-actions { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
      .px-banner { margin: 0; padding: 7px 10px; border-left: 2px solid var(--dsw-alias-border-l2); background: var(--dsw-alias-bg-layer-2); font-size: 12px; }
      .px-banner.ok { border-left-color: var(--dsw-alias-state-success-primary); }
      .px-banner.warn { border-left-color: var(--dsw-alias-state-warn-primary); }
      .px-banner.bad { border-left-color: var(--dsw-alias-state-error-primary); }
      .px-field { display: grid; gap: 4px; }
      .px-field-label { font-size: 11px; color: var(--dsw-alias-label-secondary); display: flex; gap: 8px; align-items: baseline; }
      .px-field-label em { font-style: normal; font-size: 10.5px; opacity: .8; }
      .px-input { width: 100%; background: var(--dsw-alias-bg-base); color: var(--dsw-alias-label-primary); border: 1px solid var(--dsw-alias-border-l1); border-radius: 2px; padding: 6px 8px; font: inherit; font-size: 12px; }
      .px-textarea { resize: vertical; min-height: 64px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11.5px; line-height: 1.5; }
      .px-row3 { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
      .px-bar { height: 5px; background: var(--dsw-alias-bg-layer-2); border: 1px solid var(--dsw-alias-border-l1); overflow: hidden; }
      .px-bar span { display: block; height: 100%; background: var(--dsw-alias-brand-primary); }
      .px-bar span.ok { background: var(--dsw-alias-state-success-primary); }
      .px-bar span.bad { background: var(--dsw-alias-state-error-primary); }
      .px-events { list-style: none; margin: 0; padding: 0; display: grid; gap: 0; }
      .px-events li { display: grid; grid-template-columns: 52px minmax(0, 1fr) 64px; gap: 10px; padding: 6px 0; border-top: 1px solid var(--dsw-alias-border-l1); font-size: 12px; }
      .px-events li:first-child { border-top: 0; }
      .px-event-type { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .px-nodes, .px-list, .px-pairs, .px-tree { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
      .px-nodes li { display: grid; grid-template-columns: 8px 1fr auto; gap: 8px; align-items: baseline; padding: 6px 0; border-top: 1px solid var(--dsw-alias-border-l1); }
      .px-nodes li:first-child { border-top: 0; }
      .px-nodes strong { font-weight: 500; }
      .px-pairs li { padding: 6px 8px; border-left: 2px solid var(--dsw-alias-state-warn-primary); background: var(--dsw-alias-bg-layer-2); font-size: 12px; }
      .px-list li { display: flex; gap: 8px; align-items: baseline; font-size: 12px; padding: 3px 0; }
      .px-tree li { display: grid; grid-template-columns: 8px 1.2fr 1fr .8fr .8fr; gap: 8px; align-items: baseline; padding: 5px 0; border-top: 1px solid var(--dsw-alias-border-l1); font-size: 12px; }
      .px-tree li:first-child { border-top: 0; }
      .px-tree strong { font-weight: 500; }
      .px-table { width: 100%; border-collapse: collapse; font-size: 12px; }
      .px-table th { text-align: left; font-size: 10px; letter-spacing: .1em; text-transform: uppercase; color: var(--dsw-alias-label-secondary); font-weight: 500; padding: 4px 8px; border-bottom: 1px solid var(--dsw-alias-border-l2); }
      .px-table td { padding: 6px 8px; border-bottom: 1px solid var(--dsw-alias-border-l1); vertical-align: top; }
      .px-table tr:last-child td { border-bottom: 0; }
      .px-code { margin: 0; padding: 10px; background: var(--dsw-alias-bg-base); border: 1px solid var(--dsw-alias-border-l1); font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; line-height: 1.55; overflow: auto; max-height: 320px; white-space: pre-wrap; }
      .px-code-inline { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 10.5px; color: var(--dsw-alias-label-secondary); overflow-wrap: anywhere; }
      .px-knobs { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; }
      .px-knob { border: 1px solid var(--dsw-alias-border-l1); padding: 10px; display: grid; gap: 6px; }
      .px-knob-head { display: flex; justify-content: space-between; gap: 8px; align-items: baseline; }
      .px-knob-head strong { font-weight: 500; font-size: 12px; }
      .px-knob-body { display: grid; grid-template-columns: 1fr 40px; gap: 8px; align-items: center; }
      .px-range { width: 100%; accent-color: var(--dsw-alias-brand-primary); }
      .px-knob-value { text-align: right; }
      .px-new { border: 1px solid var(--dsw-alias-border-l2); background: var(--dsw-alias-bg-layer-1); padding: 12px 14px; display: grid; grid-template-columns: 1fr 1fr auto; gap: 12px; align-items: end; }
      .px-loading { display: grid; gap: 10px; place-content: center; min-height: 40vh; text-align: center; }
      .px-dock { display: flex; gap: 8px; align-items: center; font-size: 11.5px; color: var(--dsw-alias-label-secondary); padding: 2px 0; }
      .px-dock strong { color: var(--dsw-alias-label-primary); font-weight: 560; }
      .px-dock-mark { width: 12px; height: 12px; border: 1px solid var(--dsw-alias-brand-primary); border-radius: 50%; display: inline-block; }
      .px-dock-warn { color: var(--dsw-alias-state-warn-primary); }
      .px-new .px-field { min-width: 0; }
      @media (max-width: 1100px) {
        .px-layout { grid-template-columns: 1fr; }
        .px-rail { position: static; }
        .px-grid { grid-template-columns: 1fr; }
        .px-row3, .px-new { grid-template-columns: 1fr; }
      }
    `;

    return {
      inject: ['slots'],
      apply(ctx) {
        ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
          name: 'sidebar.panellist', id: 'praxis', order: 35, label: 'Praxis',
        }, Icon));
        ctx.slots.inject('main', () => ctx.slots.register({
          name: 'main', key: 'praxis',
        }, App));
        ctx.slots.inject('conversation.composer.dock', () => ctx.slots.register({
          name: 'conversation.composer.dock', id: 'praxis', order: 40, label: 'Praxis',
        }, Dock));
      },
    };
  },
});
