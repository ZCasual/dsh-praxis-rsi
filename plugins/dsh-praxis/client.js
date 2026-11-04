window.__ModuleLoader__.load({
  id: '@local/dsh-praxis',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const { useState, useEffect, useRef, useCallback } = React;

    const API = '/praxis/api';
    const STAGE_ORDER = [
      ['INTAKE', 'Intake'], ['QUESTION', 'Question'], ['PREREG', 'Prereg'],
      ['DISCUSSION', 'Discuss'], ['SYNTHESIS', 'Synthesis'], ['EXECUTING', 'Execute'],
      ['REVIEW', 'Review'], ['STAGE4', 'Stage4'], ['EVAL', 'Eval'],
      ['MEMORY', 'Memory'], ['DECISION', 'Decision'],
    ];
    const STATE_LABEL = {
      INTAKE: 'Intake', QUESTION: 'Question', PREREG_DRAFT: 'Prereg', PREREG_FROZEN: 'Prereg',
      DISCUSSION: 'Discuss', SYNTHESIS: 'Synthesis', EXEC_READY: 'Execute', EXECUTING: 'Execute',
      REVIEW: 'Review', STAGE4: 'Stage4', EVAL: 'Eval', MEMORY: 'Memory', DECISION: 'Decision',
      CLOSED: 'Closed', DRIFT_DETECTED: 'Drift',
    };
    const NEXT_LABEL = {
      prereg_freeze: '冻结契约', discussion: '启动讨论', experiment: '执行实验', review: '复核',
      stage4: '阶段四', eval_report: '提交评估', eval_read: '读评估', memory_commit: '提交记忆',
      decision: '记录决策', close: '关闭', 'new-run': '新运行',
      'close-or-new-run': '收束或新运行', 'pivot-or-stop': '转向或停止',
      'register-unknown-on-map': '登记未知', 'complete-prereg': '补全契约',
      'complete-topic-binding': '补全人格绑定', 'eval_report': '提交评估',
    };
    function stageKeyFor(state) {
      if (state === 'PREREG_DRAFT' || state === 'PREREG_FROZEN') return 'PREREG';
      if (state === 'EXEC_READY') return 'EXECUTING';
      if (state === 'CLOSED') return 'DECISION';
      return state;
    }
    const TONE = { pending: 'idle', active: 'active', blocked: 'warn', done: 'ok', failed: 'bad', quarantined: 'bad' };

    async function api(path, init) {
      const headers = { 'x-praxis-request': '1', ...(init && init.headers) };
      const response = await fetch(`${API}${path}`, { ...init, headers });
      const text = await response.text();
      let value;
      try { value = text ? JSON.parse(text) : {}; } catch { value = { error: text }; }
      if (!response.ok) {
        const error = new Error(value.error ?? value.code ?? `HTTP ${response.status}`);
        error.code = value.code;
        error.errors = value.errors;
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
          setReceipt(value.receipt ?? null);
          if (value.receipt?.status === 'rejected') {
            setError(`${value.receipt.reasonCode ?? 'REJECTED'}${value.receipt.nextAction ? ` → ${value.receipt.nextAction}` : ''}`);
          }
          return value.receipt;
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : String(cause));
          if (cause.receipt) setReceipt(cause.receipt);
          return cause.receipt ?? null;
        } finally {
          setBusy(false);
        }
      }, []);

      return { view, setView, error, setError, busy, lastAt, receipt, refresh, send };
    }

    function Btn({ children, onClick, tone, disabled, title, type = 'button', className }) {
      return h('button', {
        type, title, disabled,
        className: `px-btn${tone ? ` ${tone}` : ''}${className ? ` ${className}` : ''}`,
        onClick,
      }, children);
    }
    function Field({ label, hint, children }) {
      return h('label', { className: 'px-field' },
        h('span', { className: 'px-field-label' }, label, hint ? h('em', null, hint) : null), children);
    }
    function Input(props) { return h('input', { className: 'px-input', ...props }); }
    function Area(props) { return h('textarea', { className: 'px-input px-area', ...props }); }
    function Select({ options, ...props }) {
      return h('select', { className: 'px-input', ...props },
        options.map(([value, label]) => h('option', { key: value, value }, label)));
    }
    function Banner({ tone, children }) {
      return h('p', { className: `px-banner ${tone}`, role: tone === 'bad' ? 'alert' : 'status' }, children);
    }
    function short(value, size = 10) {
      const text = String(value ?? '');
      return text.length > size ? `${text.slice(0, size)}…` : text;
    }
    function num(value, digits = 2) {
      return typeof value === 'number' ? value.toFixed(digits) : '—';
    }

    const NODE_W = 186;
    const NODE_H = 78;
    const PORT_Y = NODE_H / 2;

    function edgePath(a, b) {
      const x1 = a.x + NODE_W;
      const y1 = a.y + PORT_Y;
      const x2 = b.x;
      const y2 = b.y + PORT_Y;
      const dx = Math.max(40, Math.abs(x2 - x1) * 0.5);
      return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
    }

    function Canvas({ graph, states, current, selectedId, onSelect, onLayout, onConnect, onDelete, scale, setScale, connectMode }) {
      const [connectFrom, setConnectFrom] = useState(null);
      const [camera, setCamera] = useState({ x: 40, y: 100 });
      const [positions, setPositions] = useState({});
      const [drag, setDrag] = useState(null);
      const [pan, setPan] = useState(null);
      const [link, setLink] = useState(null);
      const [cursor, setCursor] = useState({ x: 0, y: 0 });
      const worldRef = useRef(null);
      const canvasRef = useRef(null);
      const moved = useRef(false);

      useEffect(() => {
        const list = graph?.nodes ?? [];
        const next = {};
        for (const node of list) next[node.id] = { ...node.position };
        setPositions(next);
        const focus = list.find((node) => node.id === current) ?? list[0];
        const nextScale = 0.9;
        const rect = canvasRef.current?.getBoundingClientRect();
        const centerY = rect ? Math.max(60, (rect.height - NODE_H * nextScale) / 2) : 200;
        const index = Math.max(0, list.findIndex((node) => node.id === focus.id));
        const anchorNode = list[Math.max(0, index - 3)] ?? list[0];
        const anchorX = anchorNode.position.x - 24;
        setScale(nextScale);
        setCamera({ x: 60 - anchorX * nextScale, y: centerY - focus.position.y * nextScale });
      }, [graph?.contentHash, graph?.playbookId, graph?.version, current]);

      const nodes = graph?.nodes ?? [];
      const edges = graph?.edges ?? [];
      const pos = (node) => positions[node.id] ?? node.position ?? { x: 0, y: 0 };
      const toWorld = (clientX, clientY) => {
        const rect = worldRef.current?.getBoundingClientRect();
        const left = rect ? rect.left : 0;
        const top = rect ? rect.top : 0;
        return { x: (clientX - left) / scale, y: (clientY - top) / scale };
      };

      const onWheel = (event) => {
        event.preventDefault();
        setScale(Math.max(0.35, Math.min(1.6, scale * (event.deltaY > 0 ? 0.92 : 1.08))));
      };
      const onBackgroundDown = (event) => {
        if (event.target !== event.currentTarget) return;
        onSelect(null);
        setPan({ x: event.clientX - camera.x, y: event.clientY - camera.y });
      };
      const onPointerMove = (event) => {
        if (drag) {
          const point = toWorld(event.clientX, event.clientY);
          moved.current = true;
          setPositions((value) => ({ ...value, [drag.id]: { x: Math.round(point.x - drag.dx), y: Math.round(point.y - drag.dy) } }));
        }
        if (pan) setCamera({ x: event.clientX - pan.x, y: event.clientY - pan.y });
        if (link) setCursor(toWorld(event.clientX, event.clientY));
      };
      const onPointerUp = () => {
        if (drag && moved.current) onLayout(positions);
        setDrag(null);
        setPan(null);
        setLink(null);
      };

      const onNodeDown = (event, node) => {
        event.stopPropagation();
        if (connectMode) {
          if (!connectFrom) { setConnectFrom(node.id); onSelect(node.id); return; }
          if (connectFrom !== node.id) { onConnect(connectFrom, node.id, 'artifact'); setConnectFrom(null); onSelect(node.id); return; }
        }
        onSelect(node.id);
        const start = toWorld(event.clientX, event.clientY);
        const origin = pos(node);
        setDrag({ id: node.id, dx: start.x - origin.x, dy: start.y - origin.y });
        moved.current = false;
      };
      const startLink = (event, node) => {
        event.stopPropagation();
        if (link) { setLink(null); return; }
        setLink({ from: node.id });
        setCursor(toWorld(event.clientX, event.clientY));
      };
      const finishLink = (event, node) => {
        event.stopPropagation();
        if (!link || link.from === node.id) { setLink(null); return; }
        onConnect(link.from, node.id);
        setLink(null);
      };

      const from = link ? nodes.find((item) => item.id === link.from) : null;
      return h('div', {
        ref: canvasRef,
        className: `px-canvas${drag ? ' is-dragging' : ''}`,
        onPointerDown: onBackgroundDown,
        onPointerMove,
        onPointerUp,
        onPointerLeave: onPointerUp,
        onWheel,
        tabIndex: 0,
        onKeyDown: (event) => {
          if (event.key === 'Escape') onSelect(null);
          if (event.key === '+' || event.key === '=') setScale(Math.min(1.6, scale * 1.1));
          if (event.key === '-') setScale(Math.max(0.35, scale / 1.1));
        },
      },
      h('div', { className: `px-world${scale < 0.55 ? ' lod-far' : ''}`, ref: worldRef, style: { transform: `translate(${camera.x}px, ${camera.y}px) scale(${scale})`, '--px-scale': scale } },
        h('svg', { className: 'px-edges', width: 3200, height: 1400 },
          h('defs', null, h('marker', { id: 'px-arrow', viewBox: '0 0 8 8', refX: 7, refY: 4, markerWidth: 7, markerHeight: 7, orient: 'auto' },
            h('path', { d: 'M0,0 L8,4 L0,8 z', className: 'px-arrow' }))),
          edges.map((edge) => {
            const a = nodes.find((item) => item.id === edge.from);
            const b = nodes.find((item) => item.id === edge.to);
            if (!a || !b) return null;
            const tone = edge.port === 'contract' ? 'contract' : edge.port === 'evidence' ? 'evidence' : 'artifact';
            return h('path', { key: edge.id, d: edgePath(pos(a), pos(b)), className: `px-edge ${tone}`, 'marker-end': 'url(#px-arrow)' });
          }),
          link && from ? h('path', { className: 'px-edge temp', d: edgePath(pos(from), { x: cursor.x - NODE_W, y: cursor.y - PORT_Y }) }) : null),
        nodes.map((node) => {
          const state = states?.[node.id] ?? 'pending';
          const selected = selectedId === node.id;
          const focused = current === node.id;
          const real = pos(node);
          const action = node.config?.action;
          return h('div', {
            key: node.id,
            className: `px-node ${TONE[state] ?? 'idle'}${selected ? ' is-selected' : ''}${focused ? ' is-current' : ''}${node.type === 'gate' ? ' is-gate' : ''}`,
            style: { transform: `translate(${real.x}px, ${real.y}px)` },
            onPointerDown: (event) => onNodeDown(event, node),
            onDoubleClick: () => { if (action) onSelect(node.id); },
            tabIndex: 0,
            role: 'button',
            'aria-label': `${node.label} ${state}`,
            onKeyDown: (event) => {
              if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(node.id); }
              if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); onDelete(node.id); }
            },
          },
          h('div', { className: 'px-node-head' },
            h('i', { className: 'px-node-dot', 'aria-hidden': true }),
            h('span', { className: 'px-node-label' }, node.label),
            focused ? h('span', { className: 'px-node-here' }, '当前') : null),
          h('div', { className: 'px-node-meta' }, node.type === 'gate' ? `gate · ${node.config?.gate ?? ''}` : `${node.type}${node.stage ? ` · ${node.stage}` : ''}`),
          h('div', { className: 'px-node-foot' }, state),
          node.type !== 'start' ? h('button', {
            className: 'px-port in', title: '输入端口',
            onPointerDown: (event) => event.stopPropagation(),
            onClick: (event) => finishLink(event, node),
          }) : null,
          node.type !== 'end' ? h('button', {
            className: 'px-port out', title: '从右侧端口拖出连线',
            onPointerDown: (event) => event.stopPropagation(),
            onClick: (event) => startLink(event, node),
          }) : null);
        })),
      h('div', { className: 'px-canvas-help' },
        h('span', null, `节点 ${nodes.length} · 边 ${edges.length}`),
        connectFrom ? h('span', { className: 'px-connect-hint' }, `连线起点 ${connectFrom}`) : null,
        h('span', null, '滚轮缩放 · 拖背景平移 · 拖节点移动 · 拖右侧端口连线 · Delete 删除')),
      h('div', { className: 'px-zoom' },
        h(Btn, { onClick: () => setScale(Math.max(0.35, scale - 0.1)) }, '−'),
        h('span', { className: 'px-num' }, `${Math.round(scale * 100)}%`),
        h(Btn, { onClick: () => setScale(Math.min(1.6, scale + 0.1)) }, '+'),
        h(Btn, { onClick: () => {
          const el = canvasRef.current;
          const list = graph?.nodes ?? [];
          if (!el || !list.length) return;
          const rect = el.getBoundingClientRect();
          const minX = Math.min(...list.map((node) => node.position.x));
          const maxX = Math.max(...list.map((node) => node.position.x + NODE_W));
          const minY = Math.min(...list.map((node) => node.position.y));
          const maxY = Math.max(...list.map((node) => node.position.y + NODE_H));
          const fit = Math.max(0.25, Math.min(1, (rect.width - 90) / Math.max(1, maxX - minX), (rect.height - 110) / Math.max(1, maxY - minY)));
          setScale(fit);
          setCamera({ x: 42 - minX * fit, y: 40 - minY * fit });
        } }, '适配')));
    }

    function RunBar({ active, onAction, onSelect, onOpenRuns, onOpenSource, onOpenAudit, onOpenKnobs, mode, setMode, onNew, connectMode, setConnectMode }) {
      if (!active) {
        return h('div', { className: 'px-runbar px-empty-run' },
          h('span', { className: 'px-kicker' }, 'CANVAS'),
          h('span', { className: 'px-muted' }, '没有活动运行。新建一个剧本，或从运行列表选择。'),
          h('div', { className: 'px-grow' }),
          h(Btn, { onClick: onOpenRuns }, '运行列表'),
          h(Btn, { tone: 'primary', onClick: onNew }, '新建运行'));
      }
      const blockers = active.blockers ?? [];
      const next = active.nextAction;
      const currentLabel = STATE_LABEL[active.state] ?? active.state;
      const currentKey = stageKeyFor(active.state);
      const currentIndex = Math.max(0, STAGE_ORDER.findIndex(([value]) => value === currentKey));
      return h('div', { className: 'px-runbar' },
        h('div', { className: 'px-runbar-main' },
          h('span', { className: 'px-kicker' }, 'RUN'),
          h('strong', { className: 'px-run-title' }, active.title),
          h('span', { className: `px-state ${blockers.length ? 'warn' : ''}` }, blockers.length ? `${blockers.length} 阻塞` : currentLabel),
          h('span', { className: 'px-num px-muted' }, `v${active.version}`)),
        h('div', { className: 'px-progress' },
          h('span', { className: 'px-muted' }, '阶段'),
          h('span', { className: 'px-num' }, `${currentIndex + 1}/${STAGE_ORDER.length}`),
          h('span', { className: 'px-progress-bar' },
            h('i', { style: { width: `${Math.max(4, ((currentIndex + 1) / STAGE_ORDER.length) * 100)}%` } }))),
        h('div', { className: 'px-runbar-actions' },
          blockers.length
            ? h(Btn, { tone: 'primary', onClick: () => onAction(next) }, `下一步：${NEXT_LABEL[next] ?? next}`)
            : next ? h(Btn, { tone: 'primary', onClick: () => onAction(next) }, NEXT_LABEL[next] ?? next) : null,
          h(Btn, { onClick: onOpenRuns }, '运行'),
          h(Btn, { onClick: onOpenSource }, '源码'),
          h(Btn, { onClick: onOpenAudit }, '审计'),
          h(Btn, { onClick: onOpenKnobs }, '旋钮'),
          h(Btn, { className: connectMode ? 'is-on' : '', onClick: () => setConnectMode(!connectMode) }, '连线'),
          h('span', { className: 'px-sep' }),
          h(Btn, { className: mode === 'flow' ? 'is-on' : '', onClick: () => { setMode('flow'); onSelect(null); } }, '流程'),
          h(Btn, { className: mode === 'map' ? 'is-on' : '', onClick: () => { setMode('map'); onSelect(null); } }, '地图')));
    }


    // ---------------------------------------------------------------- inspector

    function Technical({ node, run }) {
      const [open, setOpen] = useState(false);
      return h('div', { className: 'px-tech' },
        h('button', { className: 'px-disclose', onClick: () => setOpen(!open), 'aria-expanded': open },
          open ? '▾ 技术细节' : '▸ 技术细节'),
        open ? h('pre', { className: 'px-code' }, JSON.stringify({
          node: { id: node.id, type: node.type, stage: node.stage, config: node.config },
          run: run ? { id: run.id, version: run.version, knobHash: run.knobHash, models: run.models } : null,
        }, null, 2)) : null);
    }

    function PreregForm({ send, active }) {
      const [form, setForm] = useState({
        question: active.title, prediction: '', acceptance: '', acceptableFailure: '',
        controls: 'shuffle, label-shuffle', primary: 'separation', threshold: '0.08', seeds: '3',
        source: 'declared-corpus', split: 'train', evalSplit: 'held-out', wallMin: '30', agents: '4',
      });
      const upd = (key) => (event) => setForm({ ...form, [key]: event.target.value });
      return h('div', { className: 'px-form' },
        h(Field, { label: '预测', hint: '具体数字/方向' }, h(Input, { value: form.prediction, onChange: upd('prediction'), placeholder: '略高于基线 0.08' })),
        h(Field, { label: '验收' }, h(Area, { rows: 2, value: form.acceptance, onChange: upd('acceptance'), placeholder: 'pass 当且仅当主指标超过基线且对照被破坏' })),
        h(Field, { label: '可接受失败' }, h(Area, { rows: 2, value: form.acceptableFailure, onChange: upd('acceptableFailure'), placeholder: '若对照无效，接受假设不成立' })),
        h(Field, { label: '对照', hint: '逗号分隔' }, h(Input, { value: form.controls, onChange: upd('controls') })),
        h('div', { className: 'px-row2' },
          h(Field, { label: '主指标' }, h(Input, { value: form.primary, onChange: upd('primary') })),
          h(Field, { label: '阈值' }, h(Input, { value: form.threshold, onChange: upd('threshold'), inputMode: 'decimal' }))),
        h('div', { className: 'px-row2' },
          h(Field, { label: '数据源' }, h(Input, { value: form.source, onChange: upd('source') })),
          h(Field, { label: '评估切分' }, h(Input, { value: form.evalSplit, onChange: upd('evalSplit') }))),
        h(Btn, {
          tone: 'primary',
          onClick: () => send('prereg_freeze', {
            prereg: {
              question: form.question, prediction: form.prediction, acceptance: form.acceptance,
              acceptableFailure: form.acceptableFailure,
              controls: form.controls.split(',').map((item) => item.trim()).filter(Boolean),
              metrics: { primary: form.primary, threshold: Number(form.threshold), seeds: Number(form.seeds) },
              input: { source: form.source, split: form.split, evalSplit: form.evalSplit },
              budget: { wallMin: Number(form.wallMin), agents: Number(form.agents) },
              stop: { sameConclusion: 2 },
            },
          }),
        }, '冻结契约'));
    }

    function DiscussionForm({ send, active }) {
      const [text, setText] = useState('');
      const sample = JSON.stringify([
        { persona: 'mechanist', claim: '增益来自算子结构', assumptions: ['容量匹配后仍增益'], evidence: ['derivation:1', 'data:4'], style: 'theoretical', minority: true, retained: true },
        { persona: 'scaling', claim: '增益来自容量', assumptions: ['容量解释全部增益'], evidence: ['data:5'], style: 'empirical', minority: false, retained: true },
        { persona: 'cross-domain', claim: '用可辨识性重写算子', assumptions: ['可辨识性先于容量'], evidence: ['analogy:2'], style: 'analogical', minority: true, retained: true },
      ], null, 2);
      return h('div', { className: 'px-form' },
        h(Field, { label: '观点包 JSON' }, h(Area, { rows: 7, value: text, onChange: (event) => setText(event.target.value) })),
        h('div', { className: 'px-actions' },
          h(Btn, { onClick: () => setText(sample) }, '载入示例'),
          h(Btn, { tone: 'primary', onClick: () => {
            let packages;
            try { packages = JSON.parse(text || '[]'); } catch { return; }
            if (!Array.isArray(packages) || packages.length < 2) return;
            send('discussion', { round: (active.discussion?.rounds ?? 0) + 1, packages });
          } }, '提交讨论')),
        active.discussion?.heterogeneity ? h('p', { className: 'px-muted' }, `D ${num(active.discussion.heterogeneity.D)} · style-only ${active.discussion.heterogeneity.styleOnly ? '是' : '否'}`) : null);
    }

    function ExperimentForm({ send }) {
      const [command, setCommand] = useState('');
      const [hash, setHash] = useState('');
      const [actor, setActor] = useState('coding');
      return h('div', { className: 'px-form' },
        h(Field, { label: '派工角色' }, h(Select, { value: actor, onChange: (event) => setActor(event.target.value), options: [['coding', 'coding'], ['worker', 'worker'], ['root', 'root'], ['user', 'user']] })),
        h(Field, { label: '执行描述' }, h(Input, { value: command, onChange: (event) => setCommand(event.target.value), placeholder: 'capacity-matched ablation + held-out' })),
        h(Field, { label: '产物哈希' }, h(Input, { value: hash, onChange: (event) => setHash(event.target.value) })),
        h(Btn, { tone: 'primary', onClick: () => { if (command.trim()) send('experiment', { command: command.trim(), artifactHash: hash.trim() || null }, { actor: { kind: actor, id: `${actor}-ui` } }); } }, '记录实验'));
    }

    function ReviewForm({ send }) {
      const [verdict, setVerdict] = useState('pass');
      const [items, setItems] = useState('对照被破坏\n主指标超过基线');
      return h('div', { className: 'px-form' },
        h(Field, { label: '结论' }, h(Select, { value: verdict, onChange: (event) => setVerdict(event.target.value), options: [['pass', 'pass'], ['suspect', 'suspect'], ['fail', 'fail']] })),
        h(Field, { label: '逐项' }, h(Area, { rows: 3, value: items, onChange: (event) => setItems(event.target.value) })),
        h(Btn, { onClick: () => send('review', { verdict, items: items.split('\n').map((line) => line.trim()).filter(Boolean) }, { actor: { kind: 'reviewer', id: 'reviewer-ui' } }) }, '记录复核'));
    }

    function Stage4Form({ send }) {
      const [text, setText] = useState('');
      return h('div', { className: 'px-form' },
        h(Field, { label: '解读 / 追问 / 认知 / 决策 / 野心自省' }, h(Area, { rows: 5, value: text, onChange: (event) => setText(event.target.value) })),
        h(Btn, { onClick: () => send('stage4', { text }) }, '记录阶段四'));
    }

    function EvalForm({ send, active }) {
      const [hash, setHash] = useState('');
      const [verdict, setVerdict] = useState('pass');
      const [seeds, setSeeds] = useState('3');
      return h('div', { className: 'px-form' },
        active.eval?.readAt ? h(Banner, { tone: 'ok' }, `已读 ${active.eval.readAt}`) : h(Banner, { tone: 'warn' }, '未读评估；promotion 会被拒绝'),
        h(Field, { label: '报告哈希' }, h(Input, { value: hash, onChange: (event) => setHash(event.target.value) })),
        h('div', { className: 'px-row2' },
          h(Field, { label: '结论' }, h(Select, { value: verdict, onChange: (event) => setVerdict(event.target.value), options: [['pass', 'pass'], ['suspect', 'suspect'], ['fail', 'fail']] })),
          h(Field, { label: '种子' }, h(Input, { value: seeds, onChange: (event) => setSeeds(event.target.value), inputMode: 'numeric' }))),
        h('div', { className: 'px-actions' },
          h(Btn, { onClick: () => send('eval_report', { reportHash: hash.trim() || null, verdict, seeds: Number(seeds) || 3 }, { actor: { kind: 'evaluator', id: 'evaluator-ui' } }) }, '提交报告'),
          h(Btn, { tone: 'primary', onClick: () => send('eval_read', { reportHash: hash.trim() || active.eval?.reportHash }) }, '我读过（eval.read）')));
    }

    function MemoryForm({ send, active }) {
      const [claim, setClaim] = useState('');
      const [evidence, setEvidence] = useState('');
      const [selected, setSelected] = useState('');
      const proposals = active.memory?.proposals ?? [];
      return h('div', { className: 'px-form' },
        h(Field, { label: '主张' }, h(Input, { value: claim, onChange: (event) => setClaim(event.target.value) })),
        h(Field, { label: '证据引用' }, h(Input, { value: evidence, onChange: (event) => setEvidence(event.target.value), placeholder: 'artifact-sha, eval-report-sha' })),
        h(Btn, { onClick: () => { if (claim.trim()) send('memory_propose', { claim: claim.trim(), evidenceRefs: evidence.split(',').map((item) => item.trim()).filter(Boolean) }); } }, '提出记忆'),
        h('div', { className: 'px-rule' }),
        h(Field, { label: '提交到长期记忆（仅用户）' }, h(Select, { value: selected, onChange: (event) => setSelected(event.target.value), options: [['', '选择提案'], ...proposals.filter((item) => item.status !== 'committed').map((item) => [item.id, `${item.id} · ${item.claim}`])] })),
        h(Btn, { tone: 'primary', onClick: () => { if (selected) send('memory_commit', { proposalId: selected }); } }, '提交'));
    }

    function DecisionForm({ send }) {
      const [conclusion, setConclusion] = useState('');
      const [next, setNext] = useState('new-run');
      const [ambition, setAmbition] = useState('0.7');
      return h('div', { className: 'px-form' },
        h(Field, { label: '结论' }, h(Area, { rows: 3, value: conclusion, onChange: (event) => setConclusion(event.target.value) })),
        h('div', { className: 'px-row2' },
          h(Field, { label: '下一步' }, h(Select, { value: next, onChange: (event) => setNext(event.target.value), options: [['new-run', '新运行'], ['deepen', '深化'], ['pivot', '转向'], ['redefine', '重定义'], ['stop', '停止']] })),
          h(Field, { label: '野心' }, h(Input, { value: ambition, onChange: (event) => setAmbition(event.target.value), inputMode: 'decimal' }))),
        h(Btn, { tone: 'primary', onClick: () => send('decision', { conclusion, next, ambition: Number(ambition), evidenceRefs: [] }) }, '记录决策'));
    }

    function Inspector({ node, active, send, selectedId, onDelete, graph, onConnect }) {
      if (!node) {
        return h('aside', { className: 'px-inspector px-inspector-empty' },
          h('p', { className: 'px-kicker' }, 'INSPECTOR'),
          h('p', { className: 'px-muted' }, '选择一个节点查看契约、产物与动作。'),
          active ? h('div', { className: 'px-summary' },
            h('p', { className: 'px-kicker' }, 'RUN'),
            h('strong', null, active.title),
            h('p', { className: 'px-muted' }, `${STATE_LABEL[active.state] ?? active.state} · v${active.version}`),
            active.blockers?.length ? h(Banner, { tone: 'warn' }, `阻塞：${active.blockers.join(', ')}`) : null) : null);
      }
      const state = node.id === selectedId ? 'selected' : '';
      const action = node.config?.action;
      const form = node.type === 'gate' && node.config?.gate === 'prereg' ? h(PreregForm, { send, active })
        : node.type === 'gate' && node.config?.gate === 'eval' ? h(EvalForm, { send, active })
          : node.stage === 'discussion' ? h(DiscussionForm, { send, active })
            : node.stage === 'experiment' ? h(ExperimentForm, { send })
              : node.stage === 'review' ? h(ReviewForm, { send })
                : node.stage === 'stage4' ? h(Stage4Form, { send })
                  : node.stage === 'memory' ? h(MemoryForm, { send, active })
                    : node.stage === 'decision' ? h(DecisionForm, { send }) : null;
      const targets = (graph?.nodes ?? []).filter((item) => item.id !== node.id && ['stage', 'gate', 'end'].includes(item.type));
      const [connectTo, setConnectTo] = useState('');
      const [port, setPort] = useState('artifact');
      return h('aside', { className: 'px-inspector' },
        h('p', { className: 'px-kicker' }, node.type.toUpperCase()),
        h('h2', null, node.label),
        h('p', { className: 'px-muted' }, `${node.type}${node.stage ? ` · ${node.stage}` : ''}${node.config?.gate ? ` · gate:${node.config.gate}` : ''}`),
        action ? h('p', { className: 'px-action-line' }, h('span', { className: 'px-muted' }, '可执行动作 '), h('code', null, action)) : null,
        form,
        node.type !== 'end' ? h('div', { className: 'px-connect' },
          h('p', { className: 'px-kicker' }, 'CONNECT'),
          h(Select, { value: port, onChange: (event) => setPort(event.target.value), options: [['artifact', 'artifact'], ['contract', 'contract'], ['evidence', 'evidence']] }),
          h(Select, { value: connectTo, onChange: (event) => { const value = event.target.value; setConnectTo(value); if (value) onConnect(node.id, value, port); }, options: [['', '选择目标节点'], ...targets.map((item) => [item.id, item.label])] })) : null,
        node.type !== 'start' && node.type !== 'end'
          ? h(Btn, { className: 'px-danger', onClick: () => onDelete(node.id) }, '删除节点')
          : null,
        h(Technical, { node, run: active }));
    }

    // ---------------------------------------------------------------- drawers

    function Drawer({ title, onClose, children, wide }) {
      return h('div', { className: 'px-drawer-mask', onClick: onClose },
        h('section', { className: `px-drawer${wide ? ' is-wide' : ''}`, onClick: (event) => event.stopPropagation(), role: 'dialog', 'aria-label': title },
          h('header', null, h('h2', null, title), h(Btn, { onClick: onClose }, '关闭')), children));
    }

    function RunsDrawer({ view, active, send, onClose, onSelect }) {
      const [playbook, setPlaybook] = useState('scientific-loop');
      const [title, setTitle] = useState('');
      return h(Drawer, { title: '运行', onClose },
        h('div', { className: 'px-form' },
          h(Field, { label: '剧本' }, h(Select, { value: playbook, onChange: (event) => setPlaybook(event.target.value), options: (view.playbooks ?? []).map((item) => [item.id, `${item.title} · ${item.domain}`]) })),
          h(Field, { label: '标题' }, h(Input, { value: title, onChange: (event) => setTitle(event.target.value), placeholder: '这轮要回答什么' })),
          h(Btn, { tone: 'primary', onClick: async () => { const receipt = await send('start', { playbookId: playbook, title: title.trim() || playbook }); if (receipt?.status === 'committed') { onClose(); onSelect(receipt.runId); } } }, '新建运行')),
        h('div', { className: 'px-rule' }),
        h('ul', { className: 'px-runs' }, (view.runs ?? []).map((run) => h('li', { key: run.id },
          h('button', {
            className: `px-run${run.id === active?.id ? ' is-on' : ''}`,
            onClick: async () => { await send('activate', {}, { runId: run.id }); onClose(); },
          },
          h('i', { className: `px-dot ${run.blockers?.length ? 'warn' : 'ok'}`, 'aria-hidden': true }),
          h('span', null, run.title),
          h('span', { className: 'px-num px-muted' }, `${STATE_LABEL[run.state] ?? run.state} · v${run.version}`))))));
    }

    function SourceDrawer({ view, graph, send, onClose }) {
      const initial = JSON.stringify(graph, null, 2);
      const [text, setText] = useState(initial);
      const [errors, setErrors] = useState([]);
      const [saved, setSaved] = useState('');
      useEffect(() => setText(initial), [graph?.contentHash]);
      const apply = async () => {
        let parsed;
        try { parsed = JSON.parse(text); } catch (cause) { setErrors([{ code: 'JSON', message: String(cause.message) }]); return; }
        const result = await send('graph_save', { playbookId: graph.playbookId, graph: parsed });
        if (result?.status === 'committed') { setErrors([]); setSaved(`已保存 v${result.version}`); }
        else setErrors(result?.errors ?? [{ code: result?.reasonCode ?? 'REJECTED', message: result?.reasonCode ?? 'rejected' }]);
      };
      return h(Drawer, { title: '源码（JSON）', onClose, wide: true },
        h('p', { className: 'px-muted' }, '与画布同 schema。改完校验后保存；非法图会返回 V 码。'),
        h(Area, { className: 'px-source', rows: 18, value: text, onChange: (event) => setText(event.target.value), spellCheck: false }),
        h('div', { className: 'px-actions' },
          h(Btn, { onClick: () => setText(initial) }, '重载'),
          h(Btn, { tone: 'primary', onClick: apply }, '校验并保存'),
          saved ? h('span', { className: 'px-muted' }, saved) : null),
        errors.length ? h('ul', { className: 'px-errors' }, errors.map((error, index) => h('li', { key: index }, `${error.code}: ${error.message}`))) : null);
    }

    function AuditDrawer({ active, onClose }) {
      return h(Drawer, { title: '审计', onClose, wide: true },
        active ? h('table', { className: 'px-table' },
          h('thead', null, h('tr', null, ['seq', 'type', 'at'].map((label) => h('th', { key: label }, label)))),
          h('tbody', null, (active.events ?? []).slice().reverse().map((event) => h('tr', { key: event.seq },
            h('td', { className: 'px-num' }, event.seq),
            h('td', null, event.type),
            h('td', { className: 'px-num' }, new Date(event.at).toLocaleTimeString('zh-CN', { hour12: false }))))))
          : h('p', { className: 'px-muted' }, '没有活动运行。'));
    }

    function KnobsDrawer({ view, active, send, onClose }) {
      const fields = view.knobFields ?? [];
      const current = active?.knobs ?? view.knobs ?? {};
      const [draft, setDraft] = useState(current);
      useEffect(() => setDraft(current), [active?.id, active?.knobHash]);
      return h(Drawer, { title: '旋钮', onClose },
        h(Banner, { tone: 'warn' }, '运行中修改会被冻结；应用后 fork 新 Run。'),
        h('div', { className: 'px-knobs' }, fields.map((field) => h('div', { key: field.key, className: 'px-knob' },
          h('div', { className: 'px-knob-head' }, h('strong', null, field.label), h('span', { className: 'px-kicker' }, field.scope)),
          h('input', { className: 'px-range', type: 'range', min: field.min, max: field.max, step: field.step, value: draft[field.key] ?? current[field.key] ?? 0, onChange: (event) => setDraft({ ...draft, [field.key]: Number(event.target.value) }), 'aria-label': field.label }),
          h('span', { className: 'px-num' }, String(draft[field.key] ?? current[field.key] ?? '—'))))),
        h(Btn, { tone: 'primary', onClick: () => send('set_knobs', { knobs: { ...current, ...draft } }) }, '冻结为新运行'));
    }

    // ---------------------------------------------------------------- app

    function MapCanvas({ map, scale }) {
      const nodes = map?.nodes ?? [];
      const edges = map?.edges ?? [];
      const positions = {};
      nodes.forEach((node, index) => { positions[node.id] = { x: 80 + (index % 4) * 240, y: 80 + Math.floor(index / 4) * 130 }; });
      if (!nodes.length) {
        return h('div', { className: 'px-canvas' },
          h('div', { className: 'px-empty-canvas' },
            h('p', { className: 'px-kicker' }, 'COGNITIVE MAP'),
            h('p', null, '当前运行还没有登记主张。到检查器里用 map_claim 登记未知或主张。')));
      }
      return h('div', { className: 'px-canvas' },
        h('div', { className: 'px-world', style: { transform: `translate(20px, 20px) scale(${scale})` } },
          h('svg', { className: 'px-edges', width: 2000, height: 1200 },
            edges.map((edge, index) => {
              const a = positions[edge.from];
              const b = positions[edge.to];
              if (!a || !b) return null;
              return h('path', { key: index, d: edgePath(a, b), className: 'px-edge artifact', 'marker-end': 'url(#px-arrow)' });
            })),
          nodes.map((node) => h('div', { key: node.id, className: 'px-node ok', style: { transform: `translate(${positions[node.id].x}px, ${positions[node.id].y}px)` } },
            h('div', { className: 'px-node-head' }, h('i', { className: 'px-node-dot' }), h('span', { className: 'px-node-label' }, node.label)),
            h('div', { className: 'px-node-meta' }, `${node.status} · ${node.evidenceRefs?.length ?? 0} 证据`)))),
        h('div', { className: 'px-canvas-help' }, h('span', null, `认知地图 · 节点 ${nodes.length} · 边 ${edges.length}`),
          h('span', null, map?.meanReversion ? `均值回归 ${num(map.meanReversion.distance)}` : '')));
    }

    function App() {
      const praxis = usePraxis();
      const [mode, setMode] = useState('flow');
      const [scale, setScale] = useState(0.9);
      const [selectedId, setSelectedId] = useState(null);
      const [drawer, setDrawer] = useState(null);
      const [connectMode, setConnectMode] = useState(false);
      const view = praxis.view;
      const active = view?.active ?? null;
      const graph = view?.graph?.graph ?? null;
      const states = view?.graph?.states ?? {};
      const current = view?.graph?.current ?? null;
      const selected = graph?.nodes?.find((node) => node.id === selectedId) ?? null;

      const saveGraph = async (nextGraph) => {
        const receipt = await praxis.send('graph_save', { playbookId: graph.playbookId, graph: nextGraph });
        if (receipt?.status === 'committed') await praxis.refresh();
        return receipt;
      };
      const onConnect = async (from, to, port = 'artifact') => {
        if (!graph || from === to) return;
        if (graph.edges.some((edge) => edge.from === from && edge.to === to)) return;
        const next = { ...graph, edges: [...graph.edges, { id: `e_${Date.now()}`, from, to, port }] };
        const receipt = await saveGraph(next);
        if (receipt?.status !== 'committed') praxis.setError(receipt?.reasonCode ?? 'INVALID_GRAPH');
      };
      const onDelete = async (id) => {
        if (!graph || id === 'start' || id === 'end') return;
        const next = {
          ...graph,
          nodes: graph.nodes.filter((node) => node.id !== id),
          edges: graph.edges.filter((edge) => edge.from !== id && edge.to !== id),
        };
        const receipt = await saveGraph(next);
        if (receipt?.status !== 'committed') praxis.setError(receipt?.reasonCode ?? 'INVALID_GRAPH');
        else setSelectedId(null);
      };
      const onLayout = async (positions) => {
        if (!graph) return;
        await praxis.send('layout_save', { playbookId: graph.playbookId, positions }, {});
      };
      const focusAction = (action) => {
        if (!action) return;
        const node = graph?.nodes?.find((item) => item.config?.action === action)
          ?? (String(action).includes('close') ? graph?.nodes?.find((item) => item.stage === 'decision') : null)
          ?? (String(action).includes('pivot') ? graph?.nodes?.find((item) => item.stage === 'decision') : null)
          ?? (String(action).includes('unknown') ? graph?.nodes?.find((item) => item.stage === 'decision') : null)
          ?? graph?.nodes?.find((item) => item.stage === 'prereg');
        if (node) { setSelectedId(node.id); setDrawer(null); }
        else if (current) setSelectedId(current);
      };

      if (!view) {
        return h('section', { className: 'px-shell' },
          h('style', null, CSS),
          h('div', { className: 'px-loading' },
            h('p', { className: 'px-kicker' }, 'PRAXIS · OBSERVATORY'),
            h('p', null, praxis.error ? `观测通道未接通：${praxis.error}` : '正在读取图与运行状态…'),
            h(Btn, { onClick: praxis.refresh }, '重试')));
      }

      return h('section', { className: 'px-shell', 'data-connect': connectMode ? '1' : '0' },
        h('style', null, CSS),
        h('div', { className: 'px-top' },
        h('header', { className: 'px-head' },
          h('div', { className: 'px-brand' },
            h('span', { className: 'px-mark', 'aria-hidden': true }),
            h('div', null,
              h('p', { className: 'px-kicker' }, 'PRAXIS · OBSERVATORY'),
              h('h1', null, 'Praxis'),
              h('p', { className: 'px-sub' }, '先画流程，再推进度。'))),
          h('div', { className: 'px-head-right' },
            h('span', { className: 'px-chip' }, view.durability === 'durable' ? '持久化' : '内存态'),
            h(Btn, { onClick: praxis.refresh, disabled: praxis.busy }, praxis.busy ? '刷新中' : '刷新'),
            h(Btn, { tone: 'primary', onClick: () => setDrawer('runs') }, '新建运行'))),
        h(RunBar, {
          active, onAction: focusAction,
          onOpenRuns: () => setDrawer('runs'), onOpenSource: () => setDrawer('source'), onOpenAudit: () => setDrawer('audit'), onOpenKnobs: () => setDrawer('knobs'),
          mode, setMode, onNew: () => setDrawer('runs'), connectMode, setConnectMode, onSelect: setSelectedId,
        }),
        praxis.error ? h(Banner, { tone: 'bad' }, praxis.error) : null),
        h('div', { className: 'px-workspace' },
          h('main', { className: 'px-stage-area' },
            mode === 'map'
              ? h(MapCanvas, { map: view.map, scale })
              : graph
                ? h(Canvas, { graph, states, current, selectedId, onSelect: setSelectedId, onLayout, onConnect, onDelete, scale, setScale, connectMode })
                : h('div', { className: 'px-empty-canvas' }, h('p', null, '没有图。新建运行，或从运行列表选择。'))),
          h(Inspector, { node: selected, active, send: praxis.send, selectedId, onDelete, graph, onConnect })),
        drawer === 'runs' ? h(RunsDrawer, { view, active, send: praxis.send, onClose: () => setDrawer(null), onSelect: (id) => { setSelectedId(null); } }) : null,
        drawer === 'source' && graph ? h(SourceDrawer, { view, graph, send: praxis.send, onClose: () => setDrawer(null) }) : null,
        drawer === 'audit' ? h(AuditDrawer, { active, onClose: () => setDrawer(null) }) : null,
        drawer === 'knobs' ? h(KnobsDrawer, { view, active, send: praxis.send, onClose: () => setDrawer(null) }) : null);
    }

    function Dock() {
      const praxis = usePraxis();
      const active = praxis.view?.active;
      if (!active) return null;
      const blockers = active.blockers?.length ?? 0;
      const next = active.nextAction;
      const text = blockers ? `Praxis · ${blockers} 阻塞` : next ? `Praxis · ${NEXT_LABEL[next] ?? next}` : 'Praxis';
      return h('span', { className: `px-dock${blockers ? ' warn' : ''}`, title: active.title }, h('i', { 'aria-hidden': true }), text);
    }

    function Icon({ size = 20, active = false }) {
      return h('svg', {
        width: size, height: size, viewBox: '0 0 24 24', 'aria-hidden': true,
        fill: 'none', stroke: active ? 'var(--dsw-alias-brand-primary)' : 'currentColor', strokeWidth: 1.5,
        strokeLinecap: 'round', strokeLinejoin: 'round',
      },
      h('circle', { cx: 12, cy: 12, r: 8.2 }),
      h('path', { d: 'M12 3.8v16.4M3.8 12h16.4' }),
      h('circle', { cx: 12, cy: 12, r: 2.4, fill: 'currentColor', stroke: 'none' }));
    }

    const CSS = `
      .px-shell { color: var(--dsw-alias-label-primary); background: var(--dsw-alias-bg-base); font: 13px/1.5 ui-sans-serif, -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif; display: grid; grid-template-rows: auto minmax(0, 1fr); height: 100%; min-height: 100%; overflow: hidden; font-variant-numeric: tabular-nums; }
      .px-top { display: grid; }
      .px-shell *, .px-dock * { box-sizing: border-box; }
      .px-head { display: flex; align-items: center; justify-content: space-between; gap: 18px; padding: 14px 20px 10px; border-bottom: 1px solid var(--dsw-alias-border-l1); min-width: 0; }
      .px-brand { display: flex; gap: 12px; align-items: center; }
      .px-mark { width: 28px; height: 28px; border: 1px solid var(--dsw-alias-border-l2); border-radius: 50%; position: relative; display: inline-block; flex: none; }
      .px-mark::before, .px-mark::after { content: ""; position: absolute; background: var(--dsw-alias-brand-primary); }
      .px-mark::before { left: 50%; top: 4px; bottom: 4px; width: 1px; }
      .px-mark::after { top: 50%; left: 4px; right: 4px; height: 1px; }
      .px-shell h1 { margin: 0; font-size: 22px; line-height: 1.1; font-weight: 560; letter-spacing: .01em; }
      .px-shell h2 { margin: 0; font-size: 14px; font-weight: 560; }
      .px-kicker { margin: 0; font-size: 10px; letter-spacing: .18em; text-transform: uppercase; color: var(--dsw-alias-label-secondary); }
      .px-sub { margin: 1px 0 0; color: var(--dsw-alias-label-secondary); font-size: 12px; }
      .px-head-right { display: flex; align-items: center; gap: 8px; flex-wrap: nowrap; flex: none; }
      .px-chip { font-size: 11px; padding: 2px 7px; border: 1px solid var(--dsw-alias-border-l2); color: var(--dsw-alias-label-secondary); }
      .px-btn { appearance: none; border: 1px solid var(--dsw-alias-border-l2); background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-label-primary); font: inherit; font-size: 12px; padding: 5px 10px; cursor: pointer; border-radius: 2px; white-space: nowrap; }
      .px-btn:hover { border-color: var(--dsw-alias-brand-primary); }
      .px-btn.primary { background: var(--dsw-alias-brand-primary); border-color: var(--dsw-alias-brand-primary); color: var(--dsw-alias-bg-base); }
      .px-btn.is-on { border-color: var(--dsw-alias-brand-primary); color: var(--dsw-alias-brand-primary); }
      .px-btn:disabled { opacity: .5; cursor: not-allowed; }
      .px-btn.px-danger { color: var(--dsw-alias-state-error-primary); border-color: var(--dsw-alias-state-error-primary); }
      .px-btn:focus-visible, .px-input:focus-visible, .px-node:focus-visible, .px-canvas:focus-visible { outline: 1px solid var(--dsw-alias-brand-primary); outline-offset: 2px; }
      .px-runbar { display: flex; align-items: center; gap: 14px; padding: 8px 20px; border-bottom: 1px solid var(--dsw-alias-border-l1); background: var(--dsw-alias-bg-layer-1); min-height: 46px; flex-wrap: nowrap; min-width: 0; }
      .px-runbar.px-empty-run { justify-content: flex-start; }
      .px-runbar-main { display: flex; align-items: baseline; gap: 8px; min-width: 0; }
      .px-run-title { max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 520; }
      .px-state { font-size: 11px; color: var(--dsw-alias-label-secondary); border: 1px solid var(--dsw-alias-border-l2); padding: 1px 6px; }
      .px-state.warn { color: var(--dsw-alias-state-warn-primary); border-color: currentColor; }
      .px-progress { display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0; color: var(--dsw-alias-label-secondary); }
      .px-progress-bar { flex: 0 0 180px; height: 3px; background: var(--dsw-alias-border-l1); }
      .px-progress-bar i { display: block; height: 100%; background: var(--dsw-alias-brand-primary); }
      .px-progress-label { font-size: 11px; color: var(--dsw-alias-label-primary); }
      .px-stage { font-size: 10px; color: var(--dsw-alias-label-secondary); padding: 2px 5px; border-bottom: 1px solid transparent; white-space: nowrap; }
      .px-stage.is-done { color: var(--dsw-alias-label-primary); opacity: .55; }
      .px-stage.is-on { color: var(--dsw-alias-brand-primary); border-bottom-color: var(--dsw-alias-brand-primary); }
      .px-runbar-actions { display: flex; gap: 6px; align-items: center; flex: none; }
      .px-sep { width: 1px; height: 16px; background: var(--dsw-alias-border-l1); margin: 0 2px; }
      .px-workspace { display: grid; grid-template-columns: minmax(0, 1fr) 320px; min-height: 0; min-width: 0; width: 100%; overflow: hidden; }
      .px-stage-area { position: relative; min-width: 0; height: 100%; overflow: hidden; }
      .px-inspector { border-left: 1px solid var(--dsw-alias-border-l1); padding: 14px 16px; overflow: auto; display: grid; gap: 10px; align-content: start; background: var(--dsw-alias-bg-base); min-width: 0; width: 100%; }
      .px-inspector-empty { color: var(--dsw-alias-label-secondary); }
      .px-summary { border: 1px solid var(--dsw-alias-border-l1); padding: 10px; display: grid; gap: 4px; }
      .px-canvas { position: relative; width: 100%; height: 100%; overflow: hidden; background-color: var(--dsw-alias-bg-base); background-image: radial-gradient(var(--dsw-alias-border-l1) 1px, transparent 1px); background-size: 26px 26px; cursor: grab; touch-action: none; }
      .px-canvas.is-dragging { cursor: grabbing; }
      .px-world { position: absolute; left: 0; top: 0; transform-origin: 0 0; will-change: transform; }
      .px-edges { position: absolute; left: 0; top: 0; overflow: visible; pointer-events: none; }
      .px-edge { fill: none; stroke: var(--dsw-alias-border-l2); stroke-width: 1.2; }
      .px-edge.contract { stroke: var(--dsw-alias-brand-primary); opacity: .55; }
      .px-edge.evidence { stroke: var(--dsw-alias-state-success-primary); opacity: .5; }
      .px-edge.temp { stroke: var(--dsw-alias-brand-primary); stroke-dasharray: 4 3; opacity: .8; }
      .px-arrow { fill: var(--dsw-alias-border-l2); }
      .px-node { position: absolute; width: 186px; height: 78px; border: 1px solid var(--dsw-alias-border-l2); background: var(--dsw-alias-bg-layer-1); padding: 8px 10px; display: grid; grid-template-rows: auto 1fr auto; gap: 2px; cursor: pointer; border-radius: 2px; user-select: none; }
      .px-node:hover { border-color: var(--dsw-alias-brand-primary); }
      .px-node.is-gate { border-style: dashed; background: var(--dsw-alias-bg-base); }
      .px-node.is-selected { box-shadow: 0 0 0 1px var(--dsw-alias-brand-primary); }
      .px-node.is-current { border-color: var(--dsw-alias-brand-primary); }
      .px-node-head { display: flex; align-items: center; gap: 6px; min-width: 0; }
      .px-node-label { font-size: 12.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .px-node-here { margin-left: auto; font-size: 9px; letter-spacing: .08em; color: var(--dsw-alias-brand-primary); }
      .px-node-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--dsw-alias-label-secondary); flex: none; }
      .px-world.lod-far .px-node { height: 46px; padding: 7px 9px; }
      .px-world.lod-far .px-node-meta, .px-world.lod-far .px-node-foot, .px-world.lod-far .px-port { display: none; }
      .px-node-meta { font-size: 10.5px; color: var(--dsw-alias-label-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .px-node-foot { font-size: 9.5px; letter-spacing: .08em; text-transform: uppercase; color: var(--dsw-alias-label-secondary); }
      .px-node.active { border-color: var(--dsw-alias-brand-primary); }
      .px-node.active .px-node-dot { background: var(--dsw-alias-brand-primary); }
      .px-node.blocked { border-color: var(--dsw-alias-state-warn-primary); }
      .px-node.blocked .px-node-dot { background: var(--dsw-alias-state-warn-primary); }
      .px-node.failed { border-color: var(--dsw-alias-state-error-primary); }
      .px-node.failed .px-node-dot { background: var(--dsw-alias-state-error-primary); }
      .px-node.done { opacity: .72; }
      .px-node.done .px-node-dot { background: var(--dsw-alias-state-success-primary); }
      .px-port { position: absolute; width: 10px; height: 10px; border-radius: 50%; border: 1px solid var(--dsw-alias-border-l2); background: var(--dsw-alias-bg-base); padding: 0; cursor: crosshair; }
      .px-port.in { left: -6px; top: calc(50% - 5px); }
      .px-port.out { right: -6px; top: calc(50% - 5px); }
      .px-port:hover { border-color: var(--dsw-alias-brand-primary); background: var(--dsw-alias-brand-primary); }
      .px-connect-hint { color: var(--dsw-alias-brand-primary); }
      .px-canvas-help { position: absolute; left: 12px; bottom: 10px; display: flex; gap: 14px; font-size: 10.5px; color: var(--dsw-alias-label-secondary); pointer-events: none; }
      .px-zoom { position: absolute; right: 12px; bottom: 10px; display: flex; gap: 4px; align-items: center; }
      .px-zoom .px-btn { padding: 2px 7px; }
      .px-form { display: grid; gap: 8px; min-width: 0; }
      .px-field { display: grid; gap: 3px; min-width: 0; }
      .px-field-label { font-size: 10.5px; color: var(--dsw-alias-label-secondary); display: flex; gap: 6px; }
      .px-field-label em { font-style: normal; opacity: .75; }
      .px-input { width: 100%; min-width: 0; background: var(--dsw-alias-bg-base); color: var(--dsw-alias-label-primary); border: 1px solid var(--dsw-alias-border-l1); border-radius: 2px; padding: 5px 7px; font: inherit; font-size: 12px; }
      .px-area { resize: vertical; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; line-height: 1.5; }
      .px-row2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
      .px-actions { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
      .px-rule { height: 1px; background: var(--dsw-alias-border-l1); }
      .px-banner { margin: 0; padding: 6px 9px; border-left: 2px solid var(--dsw-alias-border-l2); background: var(--dsw-alias-bg-layer-1); font-size: 11.5px; }
      .px-banner.ok { border-left-color: var(--dsw-alias-state-success-primary); }
      .px-banner.warn { border-left-color: var(--dsw-alias-state-warn-primary); }
      .px-banner.bad { border-left-color: var(--dsw-alias-state-error-primary); }
      .px-muted { color: var(--dsw-alias-label-secondary); margin: 0; }
      .px-num { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11.5px; }
      .px-code { margin: 0; padding: 8px; background: var(--dsw-alias-bg-layer-1); border: 1px solid var(--dsw-alias-border-l1); font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 10.5px; line-height: 1.5; overflow: auto; max-height: 300px; white-space: pre-wrap; }
      .px-tech { display: grid; gap: 4px; }
      .px-disclose { appearance: none; border: 0; background: transparent; color: var(--dsw-alias-label-secondary); font: inherit; font-size: 11px; text-align: left; cursor: pointer; padding: 0; }
      .px-drawer-mask { position: fixed; inset: 0; background: rgba(0,0,0,.32); display: flex; justify-content: flex-end; z-index: 40; }
      .px-drawer { width: 420px; max-width: 92vw; background: var(--dsw-alias-bg-base); border-left: 1px solid var(--dsw-alias-border-l2); padding: 14px 16px; overflow: auto; display: grid; gap: 10px; align-content: start; }
      .px-drawer.is-wide { width: 720px; }
      .px-drawer header { display: flex; align-items: center; justify-content: space-between; }
      .px-drawer h2 { font-size: 15px; }
      .px-source { min-height: 360px; }
      .px-errors { margin: 0; padding-left: 16px; color: var(--dsw-alias-state-error-primary); font-size: 11.5px; }
      .px-runs { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; }
      .px-run { width: 100%; display: grid; grid-template-columns: 10px 1fr auto; gap: 8px; align-items: center; background: transparent; border: 1px solid transparent; color: inherit; font: inherit; font-size: 12px; padding: 7px 8px; text-align: left; cursor: pointer; }
      .px-run:hover { border-color: var(--dsw-alias-border-l1); }
      .px-run.is-on { border-color: var(--dsw-alias-border-l2); background: var(--dsw-alias-bg-layer-1); }
      .px-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--dsw-alias-label-secondary); display: inline-block; }
      .px-dot.ok { background: var(--dsw-alias-state-success-primary); }
      .px-dot.warn { background: var(--dsw-alias-state-warn-primary); }
      .px-table { width: 100%; border-collapse: collapse; font-size: 11.5px; }
      .px-table th { text-align: left; font-size: 9.5px; letter-spacing: .1em; text-transform: uppercase; color: var(--dsw-alias-label-secondary); padding: 4px 6px; border-bottom: 1px solid var(--dsw-alias-border-l2); }
      .px-table td { padding: 5px 6px; border-bottom: 1px solid var(--dsw-alias-border-l1); }
      .px-knobs { display: grid; gap: 10px; }
      .px-knob { border: 1px solid var(--dsw-alias-border-l1); padding: 8px 10px; display: grid; gap: 4px; }
      .px-knob-head { display: flex; justify-content: space-between; align-items: baseline; }
      .px-range { width: 100%; accent-color: var(--dsw-alias-brand-primary); }
      .px-loading { display: grid; gap: 10px; place-content: center; min-height: 50vh; text-align: center; }
      .px-empty-canvas { display: grid; place-content: center; height: 100%; color: var(--dsw-alias-label-secondary); }
      .px-dock { display: inline-flex; align-items: center; gap: 6px; font-size: 11px; color: var(--dsw-alias-label-secondary); border: 1px solid var(--dsw-alias-border-l1); padding: 1px 7px; }
      .px-dock.warn { color: var(--dsw-alias-state-warn-primary); border-color: currentColor; }
      .px-dock i { width: 5px; height: 5px; border-radius: 50%; background: currentColor; }
      @media (max-width: 1000px) { .px-workspace { grid-template-columns: 1fr; } .px-inspector { border-left: 0; border-top: 1px solid var(--dsw-alias-border-l1); max-height: 38vh; } .px-stages { display: none; } }
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
