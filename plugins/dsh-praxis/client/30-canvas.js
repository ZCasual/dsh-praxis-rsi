/* Praxis v4 evidence-first cockpit. No topology editing, ports, or drag state. */

const CanvasGateStatusLabels = Object.freeze({ passed: '已过', blocked: '阻塞', future: '未到' });
const CanvasBranchStatusLabels = Object.freeze({
  proposed: '待启用', active: '进行中', supported: '已支持', refuted: '已反驳',
  inconclusive: '未定', merged: '已合流', dropped: '已放弃',
});
const CanvasOwnerStatusLabels = Object.freeze({ running: '运行中', inactive: '空闲', unknown: '未连接' });

function CanvasText(value, fallback = '—') {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function CanvasClip(value, size = 120) {
  const text = CanvasText(value, '');
  return text.length > size ? `${text.slice(0, size)}…` : text;
}

function CanvasTone(status) {
  if (status === 'passed' || status === 'supported') return 'ok';
  if (status === 'blocked' || status === 'refuted') return 'bad';
  if (status === 'active') return 'active';
  return 'warn';
}

function CanvasStatusLabel(status, labels, fallback = '待确认') {
  return labels[status] ?? fallback;
}

function CanvasOwner(member, branch) {
  const ownerId = branch?.ownerId;
  const found = (Array.isArray(member) ? member : []).find((item) => item?.id === ownerId);
  return {
    name: branch?.ownerName || found?.name || (ownerId ? ownerId : '未指派'),
    status: branch?.ownerStatus || found?.status || 'unknown',
  };
}

function CanvasGateRail({ gates, currentStage, onSelect }) {
  const list = Array.isArray(gates) ? gates : [];
  const rows = LayoutGateRows(list);
  return h('aside', {
    className: 'px-v4-gate-rail',
    'data-testid': 'gate-rail',
    'aria-label': '研究门禁',
  },
  h('div', { className: 'px-v4-section-head' },
    h('span', { className: 'px-v4-kicker' }, '治理门禁'),
    h('span', { className: 'px-v4-count' }, `${list.length}`)),
  h('div', { className: 'px-v4-gate-list' }, list.length
    ? list.map((gate, index) => {
      const status = gate?.status ?? 'future';
      const missing = Array.isArray(gate?.missing) ? gate.missing : [];
      const selected = gate?.id === currentStage;
      return h('button', {
        key: gate?.id ?? index,
        type: 'button',
        className: `px-v4-gate-row is-${status}`,
        'data-testid': 'gate-row',
        'data-gate-id': gate?.id ?? `gate-${index + 1}`,
        'data-status': status,
        'data-current': selected ? 'true' : 'false',
        style: { minHeight: `${rows[index]?.h ?? 44}px` },
        onClick: () => onSelect?.(gate?.id ?? null),
        title: missing.length ? `缺失 ${missing.length} 项` : undefined,
      },
      h('span', { className: 'px-v4-gate-rail-mark', 'aria-hidden': true }),
      h('span', { className: 'px-v4-gate-copy' },
        h('strong', null, CanvasText(gate?.label, '门禁')),
        h('span', null, CanvasStatusLabel(status, CanvasGateStatusLabels), missing.length ? ` · 缺失 ${missing.length}` : '')),
      h('span', { className: 'px-v4-gate-icon', 'aria-hidden': true }, status === 'passed' ? '✓' : status === 'blocked' ? '!' : '○'));
    })
    : h('p', { className: 'px-v4-empty-note' }, '暂无门禁')));
}

function CanvasBranchOwner({ branch, members }) {
  const owner = CanvasOwner(members, branch);
  const status = owner.status;
  return h('div', {
    className: 'px-v4-branch-owner',
    'data-testid': 'branch-owner',
    'data-owner-status': status,
  },
    h('span', {
      className: `px-v4-status-dot is-${status}`,
      'data-owner-status': status,
      'aria-label': CanvasOwnerStatusLabels[status] ?? '未连接',
    }),
    h('span', { className: 'px-v4-owner-name' }, CanvasText(owner.name, '未指派')),
    h('span', { className: 'px-v4-owner-state' }, CanvasOwnerStatusLabels[status] ?? '未连接'));
}

function CanvasBranchCard({ branch, members, events, selected, onSelect, onOpenBranch }) {
  const status = branch?.status ?? 'proposed';
  const supports = Number.isFinite(branch?.supports) ? branch.supports : 0;
  const contradicts = Number.isFinite(branch?.contradicts) ? branch.contradicts : 0;
  const evidenceCount = Number.isFinite(branch?.evidenceCount) ? branch.evidenceCount : supports + contradicts;
  const select = () => {
    onSelect?.(branch?.id ?? null);
    onOpenBranch?.(branch?.id ?? null);
  };
  return h('article', {
    className: `px-v4-branch-card is-${status}${selected ? ' is-selected' : ''}`,
    'data-testid': 'branch-card',
    'data-branch-id': branch?.id ?? '',
    'data-status': status,
  },
  h('button', {
    type: 'button',
    className: 'px-v4-branch-hit',
    onClick: select,
    'aria-label': `查看分支：${CanvasText(branch?.title, '未命名分支')}`,
  },
    h('span', { className: 'px-v4-branch-stripe', 'aria-hidden': true }),
    h('span', { className: 'px-v4-branch-head' },
      h('strong', { className: 'px-v4-branch-title' }, CanvasText(branch?.title, '未命名分支')),
      h('span', { className: `px-chip ${CanvasTone(status)}`, 'data-testid': 'branch-status' }, CanvasStatusLabel(status, CanvasBranchStatusLabels))),
    h('span', { className: 'px-v4-branch-falsifiable' }, CanvasClip(branch?.falsifiable || branch?.hypothesis, 145)),
    h(CanvasBranchOwner, { branch, members }),
    h('span', { className: 'px-v4-branch-evidence' },
      h('span', null, `${evidenceCount} 条证据`),
      h('span', { className: 'px-v4-support' }, `支持 ${supports}`),
      h('span', { className: 'px-v4-contradict' }, `反驳 ${contradicts}`)),
    h('span', { className: 'px-v4-branch-log' },
      CanvasBranchLog(branch, events)),
    h('span', { className: 'px-v4-branch-verdict' }, CanvasText(branch?.verdict, '尚无结论'))));
}


/* Branch evidence log: the newest evidence appended to this branch, newest first. */
function CanvasBranchLog(branch, events) {
  const list = Array.isArray(events) ? events : [];
  const rows = list
    .filter((event) => event?.branchId === branch?.id && event?.type === 'branch.evidence')
    .slice(-6)
    .reverse();
  if (!rows.length) {
    return h('span', { className: 'px-v4-branch-log-empty' }, '尚无证据');
  }
  return h('span', { className: 'px-v4-branch-log-list' },
    rows.map((event, index) => {
      const data = event.data ?? {};
      const tone = data.supports === false ? 'is-against' : 'is-for';
      return h('span', { key: event.seq ?? index, className: `px-v4-branch-log-row ${tone}` },
        h('span', { className: 'px-v4-branch-log-kind' }, CanvasEvidenceKind(data.kind)),
        h('span', { className: 'px-v4-branch-log-ref', title: data.ref ?? '' }, CanvasClip(data.ref, 34)),
        h('span', { className: 'px-v4-branch-log-mark' }, data.supports === false ? '−' : '+'));
    }));
}

function CanvasEvidenceKind(kind) {
  const labels = { experiment: '实验', external: '外部', review: '复核', eval: '评估' };
  return labels[kind] ?? '证据';
}

function CanvasBranchBoard({ branches, members, events, timeline, selectedBranchId, onSelect, onOpenBranch, onCreateBranch }) {
  const list = Array.isArray(branches) ? branches : [];
  return h('section', {
    className: 'px-v4-branch-board',
    'data-testid': 'branch-board',
    'aria-label': '并行探究分支',
  },
  h('div', { className: 'px-v4-board-head' },
    h('div', null,
      h('span', { className: 'px-v4-kicker' }, '并行探究'),
      h('h2', null, `${list.length} 条分支`)),
    onCreateBranch ? h(PrimBtn, { onClick: onCreateBranch, className: 'px-v4-create-branch' }, '+ 新建分支') : null),
  list.length
    ? h('div', { className: 'px-v4-branch-columns' }, list.map((branch) => h(CanvasBranchCard, {
      key: branch?.id,
      branch,
      members,
      events,
      selected: branch?.id === selectedBranchId,
      onSelect,
      onOpenBranch,
    })))
    : h(PrimEmpty, {
      title: '还没有并行分支',
      hint: '把一个可证伪陈述设为独立探究线。',
      action: onCreateBranch ? h(PrimBtn, { tone: 'primary', onClick: onCreateBranch }, '创建第一条分支') : null,
    }),
  h(CanvasTimeline, { events: timeline ?? events, branches: list, onSelect }));
}

/* Research timeline: the run's own event stream, newest first. Fills the board below the branches. */
function CanvasTimeline({ events, branches, onSelect }) {
  const list = Array.isArray(events) ? events : [];
  const byId = {};
  for (const branch of Array.isArray(branches) ? branches : []) byId[branch?.id] = branch?.title ?? branch?.id;
  const rows = list
    .filter((event) => String(event?.type ?? '').startsWith('branch.') || ['prereg.frozen', 'map.claim', 'decision.recorded', 'eval.reported'].includes(event?.type))
    .slice(-60)
    .reverse();
  return h('section', { className: 'px-v4-timeline', 'data-testid': 'timeline', 'aria-label': '研究时间线' },
    h('div', { className: 'px-v4-section-head' },
      h('span', { className: 'px-v4-kicker' }, '研究时间线'),
      h('span', { className: 'px-v4-count' }, `${rows.length} 条事件`)),
    rows.length
      ? h('ol', { className: 'px-v4-timeline-rows' }, rows.map((event, index) => {
        const data = event.data ?? {};
        const branchTitle = data.branchId ? byId[data.branchId] ?? data.branchId : null;
        return h('li', { key: event.seq ?? index, className: 'px-v4-timeline-row' },
          h('span', { className: 'px-v4-timeline-time' }, CanvasClockTime(event.at)),
          h('span', { className: 'px-v4-timeline-kind' }, CanvasEventLabel(event.type)),
          branchTitle
            ? h('button', {
              type: 'button',
              className: 'px-v4-timeline-branch',
              onClick: () => onSelect?.(data.branchId),
            }, branchTitle)
            : h('span', { className: 'px-v4-timeline-branch' }, '—'),
          h('span', { className: 'px-v4-timeline-note' }, CanvasClip(data.ref ?? data.reason ?? data.note ?? '', 72)));
      }))
      : h('p', { className: 'px-v4-empty-note' }, '暂无研究事件'));
}

function CanvasClockTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function CanvasEventLabel(type) {
  const labels = {
    'branch.proposed': '提出分支', 'branch.assigned': '指派负责人', 'branch.activated': '启用分支',
    'branch.evidence': '记录证据', 'branch.verdict': '给出结论', 'branch.merged': '合流',
    'branch.dropped': '放弃分支', 'prereg.frozen': '冻结预注册', 'map.claim': '登记主张',
    'decision.recorded': '记录决策', 'eval.reported': '提交评估',
  };
  return labels[type] ?? type;
}

function CanvasEvidenceBand({ rows, selectedClaimId, onSelect }) {
  const list = Array.isArray(rows) ? rows : [];
  return h('section', {
    className: 'px-v4-evidence-band',
    'data-testid': 'evidence-band',
    'aria-label': '证据带',
  },
  h('div', { className: 'px-v4-section-head' },
    h('span', { className: 'px-v4-kicker' }, '证据带'),
    h('span', { className: 'px-v4-count' }, `${list.length} 条主张`)),
  list.length
    ? h('div', { className: 'px-v4-evidence-rows' }, list.map((row, index) => {
      const selected = row?.claimId === selectedClaimId;
      return h('button', {
        key: row?.claimId ?? index,
        type: 'button',
        className: `px-v4-evidence-row${selected ? ' is-selected' : ''}`,
        'data-testid': 'evidence-row',
        'data-claim-id': row?.claimId ?? '',
        onClick: () => onSelect?.(row?.claimId ?? null),
      },
        h('span', { className: 'px-v4-evidence-claim' }, CanvasText(row?.claim, '未命名主张')),
        h('span', { className: 'px-v4-evidence-counts' },
          h('span', { className: 'px-v4-support' }, `支持 ${row?.supports ?? 0}`),
          h('span', { className: 'px-v4-contradict' }, `反驳 ${row?.contradicts ?? 0}`)),
        h('span', { className: 'px-v4-evidence-latest' }, CanvasText(row?.latestSource, '暂无最新证据')));
    }))
    : h('p', { className: 'px-v4-empty-note' }, '暂无主张与证据'));
}

/* Compatibility wrapper for a shell during migration; it has no editor affordances. */
function CanvasView(props) {
  const input = props ?? {};
  return h('div', { className: 'px-v4-cockpit-canvas' },
    h(CanvasGateRail, { gates: input.gates ?? [], currentStage: input.currentStage, onSelect: input.onSelectGate }),
    h(CanvasBranchBoard, {
      branches: input.branches ?? input.view?.branches ?? [],
      members: input.members ?? input.team?.members ?? [],
      selectedBranchId: input.selectedBranchId,
      onSelect: input.onSelectBranch ?? input.onSelect,
      onOpenBranch: input.onOpenBranch,
      onCreateBranch: input.onCreateBranch,
    }),
    h(CanvasEvidenceBand, {
      rows: input.evidenceRows ?? input.rows ?? [],
      selectedClaimId: input.selectedClaimId,
      onSelect: input.onSelectEvidence,
    }));
}

const CanvasCss = `
.px-v4-cockpit-canvas { display:grid; grid-template-columns:220px minmax(0,1fr); grid-template-rows:minmax(0,1fr) 120px; gap:16px; min-height:0; height:100%; overflow:hidden; padding:16px; color:var(--dsw-alias-label-primary); background:var(--dsw-alias-bg-base); }
.px-v4-gate-rail { min-height:0; overflow:auto; padding:2px 0; border-right:1px solid var(--dsw-alias-border-l1); }
.px-v4-section-head,.px-v4-board-head { display:flex; justify-content:space-between; align-items:center; gap:10px; min-height:28px; }
.px-v4-kicker { color:var(--dsw-alias-label-secondary); font-size:var(--px-fs-3); letter-spacing:.08em; text-transform:uppercase; }
.px-v4-count { color:var(--dsw-alias-label-secondary); font-size:var(--px-fs-3); }
.px-v4-gate-list { display:grid; gap:6px; margin-top:8px; padding-right:12px; }
.px-v4-gate-row { position:relative; display:grid; grid-template-columns:4px 1fr 18px; gap:9px; align-items:center; width:100%; padding:7px 8px 7px 0; border:0; border-bottom:1px solid var(--dsw-alias-border-l1); background:transparent; color:inherit; text-align:left; cursor:pointer; }
.px-v4-gate-row:hover,.px-v4-gate-row[data-current="true"] { background:var(--dsw-alias-bg-layer-1); }
.px-v4-gate-rail-mark { align-self:stretch; background:var(--dsw-alias-state-success-primary); }
.px-v4-gate-row.is-blocked .px-v4-gate-rail-mark { background:var(--dsw-alias-state-error-primary); }
.px-v4-gate-row.is-future .px-v4-gate-rail-mark { background:var(--dsw-alias-border-l2); }
.px-v4-gate-copy { display:grid; gap:2px; min-width:0; }
.px-v4-gate-copy strong { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:var(--px-fs-2); font-weight:600; }
.px-v4-gate-copy span,.px-v4-gate-icon { color:var(--dsw-alias-label-secondary); font-size:var(--px-fs-3); }
.px-v4-gate-row.is-blocked .px-v4-gate-copy span,.px-v4-gate-row.is-blocked .px-v4-gate-icon { color:var(--dsw-alias-state-error-primary); }
.px-v4-branch-board { display:flex; flex-direction:column; flex:1 1 auto; min-width:0; min-height:0; overflow:auto; padding:0 12px; }
.px-v4-board-head { margin-bottom:8px; }
.px-v4-board-head h2 { margin:2px 0 0; font-size:var(--px-fs-1); font-weight:600; }
.px-v4-branch-columns { display:grid; grid-template-columns:repeat(auto-fit,minmax(206px,1fr)); gap:12px; align-items:start; align-content:start; }
.px-v4-branch-card { position:relative; display:flex; flex-direction:column; min-height:0; border:1px solid var(--dsw-alias-border-l1); background:var(--dsw-alias-bg-layer-1); overflow:hidden; }
.px-v4-branch-log { display:flex; flex-direction:column; gap:0; margin-top:2px; border-top:1px solid var(--dsw-alias-border-l1); overflow:hidden; }
.px-v4-branch-log-empty { padding:10px 0 0; color:var(--dsw-alias-label-secondary); font-size:var(--px-fs-3); }
.px-v4-branch-log-list { display:flex; flex-direction:column; padding-top:4px; min-height:0; overflow:hidden; }
.px-v4-branch-log-row { display:grid; grid-template-columns:44px minmax(0,1fr) 12px; gap:8px; align-items:center; padding:3px 0; font-size:var(--px-fs-3); color:var(--dsw-alias-label-secondary); border-bottom:1px dotted var(--dsw-alias-border-l1); }
.px-v4-branch-log-kind { color:var(--dsw-alias-label-secondary); }
.px-v4-branch-log-ref { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:var(--dsw-alias-label-primary); }
.px-v4-branch-log-mark { text-align:right; font-weight:600; }
.px-v4-branch-log-row.is-for .px-v4-branch-log-mark { color:var(--dsw-alias-state-success-primary); }
.px-v4-branch-log-row.is-against .px-v4-branch-log-mark { color:var(--dsw-alias-state-error-primary); }
.px-v4-branch-card.is-selected { border-color:var(--dsw-alias-brand-primary); box-shadow:inset 0 0 0 1px var(--dsw-alias-brand-primary); }
.px-v4-branch-hit { display:flex; flex-direction:column; gap:12px; width:100%; height:auto; padding:14px 14px 16px 17px; border:0; background:transparent; color:inherit; text-align:left; cursor:pointer; }
.px-v4-branch-stripe { position:absolute; left:0; top:0; bottom:0; width:4px; background:var(--dsw-alias-label-secondary); }
.px-v4-branch-card.is-active .px-v4-branch-stripe { background:var(--dsw-alias-brand-primary); }
.px-v4-branch-card.is-supported .px-v4-branch-stripe { background:var(--dsw-alias-state-success-primary); }
.px-v4-branch-card.is-refuted .px-v4-branch-stripe { background:var(--dsw-alias-state-error-primary); }
.px-v4-branch-head { display:flex; align-items:flex-start; justify-content:space-between; gap:8px; }
.px-v4-branch-title { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:var(--px-fs-1); }
.px-v4-branch-falsifiable { display:-webkit-box; min-height:42px; overflow:hidden; color:var(--dsw-alias-label-secondary); font-size:var(--px-fs-2); line-height:1.5; -webkit-line-clamp:2; -webkit-box-orient:vertical; }
.px-v4-branch-owner { display:flex; align-items:center; gap:7px; min-width:0; padding-top:3px; border-top:1px solid var(--dsw-alias-border-l1); }
.px-v4-status-dot { width:8px; height:8px; flex:none; border:1px solid currentColor; border-radius:50%; color:var(--dsw-alias-label-secondary); }
.px-v4-status-dot.is-running { background:var(--dsw-alias-state-success-primary); border-color:var(--dsw-alias-state-success-primary); }
.px-v4-status-dot.is-inactive { background:transparent; }
.px-v4-status-dot.is-unknown { border-style:dashed; }
.px-v4-owner-name { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:var(--px-fs-2); }
.px-v4-owner-state { margin-left:auto; color:var(--dsw-alias-label-secondary); font-size:var(--px-fs-3); }
.px-v4-branch-evidence { display:flex; flex-wrap:wrap; gap:7px; color:var(--dsw-alias-label-secondary); font-size:var(--px-fs-3); }
.px-v4-support { color:var(--dsw-alias-state-success-primary); }
.px-v4-contradict { color:var(--dsw-alias-state-error-primary); }
.px-v4-branch-verdict { padding-top:9px; border-top:1px solid var(--dsw-alias-border-l1); font-size:var(--px-fs-2); }
.px-v4-timeline { display:flex; flex-direction:column; flex:1 1 auto; min-height:160px; margin-top:12px; border-top:1px solid var(--dsw-alias-border-l1); padding-top:10px; overflow:hidden; }
.px-v4-timeline-rows { list-style:none; margin:6px 0 0; padding:0; overflow:auto; min-height:0; flex:1 1 auto; }
.px-v4-timeline-row { display:grid; grid-template-columns:52px 104px minmax(120px,220px) minmax(0,1fr); gap:10px; align-items:baseline; padding:4px 0; border-bottom:1px dotted var(--dsw-alias-border-l1); font-size:var(--px-fs-3); }
.px-v4-timeline-time { color:var(--dsw-alias-label-secondary); font-variant-numeric:tabular-nums; }
.px-v4-timeline-kind { color:var(--dsw-alias-label-secondary); }
.px-v4-timeline-branch { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; border:0; background:transparent; color:var(--dsw-alias-brand-primary); text-align:left; font:inherit; padding:0; cursor:pointer; }
.px-v4-timeline-note { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:var(--dsw-alias-label-primary); }
.px-v4-evidence-band { grid-column:1 / -1; min-width:0; border-top:1px solid var(--dsw-alias-border-l1); padding-top:8px; overflow:auto; }
.px-v4-evidence-rows { display:grid; gap:2px; margin-top:5px; }
.px-v4-evidence-row { display:grid; grid-template-columns:minmax(180px,1.3fr) minmax(140px,.7fr) minmax(180px,1fr); gap:12px; align-items:center; min-height:32px; width:100%; padding:5px 8px; border:0; border-bottom:1px solid var(--dsw-alias-border-l1); background:transparent; color:inherit; text-align:left; cursor:pointer; }
.px-v4-evidence-row:hover,.px-v4-evidence-row.is-selected { background:var(--dsw-alias-bg-layer-1); }
.px-v4-evidence-claim,.px-v4-evidence-latest { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:var(--px-fs-2); }
.px-v4-evidence-counts { display:flex; gap:9px; font-size:var(--px-fs-3); }
.px-v4-evidence-latest { color:var(--dsw-alias-label-secondary); font-size:var(--px-fs-3); }
.px-v4-empty-note { padding:12px 4px; color:var(--dsw-alias-label-secondary); font-size:var(--px-fs-2); }
@media (max-width:900px) { .px-v4-cockpit-canvas { grid-template-columns:1fr; grid-template-rows:auto minmax(280px,1fr) auto; overflow:auto; } .px-v4-gate-rail { border-right:0; border-bottom:1px solid var(--dsw-alias-border-l1); max-height:160px; } .px-v4-evidence-row { grid-template-columns:1fr; gap:2px; } }
`;
