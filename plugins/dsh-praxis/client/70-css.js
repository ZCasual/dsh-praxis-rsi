/* Design system + shell + primitives styles. Prefix Css*. Theme tokens only. */

const CssBase = `
.px-shell {
  --px-fs-1: 13px;
  --px-fs-2: 11.5px;
  --px-fs-3: 10px;
  --px-radius: 8px;
  --px-gap: 8px;
  color: var(--dsw-alias-label-primary);
  background: var(--dsw-alias-bg-base);
  font: 13px/1.5 ui-sans-serif, -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
  font-variant-numeric: tabular-nums;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}
.px-shell *, .px-dock, .px-dock * { box-sizing: border-box; }
.px-shell h1, .px-shell h2, .px-shell h3, .px-shell p { margin: 0; }
.px-shell button { font: inherit; color: inherit; }
.px-shell :focus-visible, .px-dock:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: 2px; }

/* ---------- run bar ---------- */
.px-runbar {
  flex: 0 0 60px;
  height: 60px;
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 0 16px;
  border-bottom: 1px solid var(--dsw-alias-border-l1);
  background: var(--dsw-alias-bg-base);
  min-width: 0;
}
.px-runbar-left { display: flex; align-items: center; gap: 14px; min-width: 0; flex: 1 1 auto; }
.px-runbar-center { display: flex; align-items: center; gap: 14px; flex: 0 0 auto; }
.px-runbar-right { display: flex; align-items: center; gap: 8px; flex: 0 0 auto; }
.px-brand { display: flex; align-items: center; gap: 8px; flex: 0 0 auto; }
.px-brand-name { font-size: var(--px-fs-1); font-weight: 600; letter-spacing: .01em; }
.px-mark { width: 18px; height: 18px; border: 1px solid var(--dsw-alias-border-l2); border-radius: 50%; position: relative; display: inline-block; flex: none; }
.px-mark::before, .px-mark::after { content: ""; position: absolute; background: var(--dsw-alias-brand-primary); }
.px-mark::before { left: 50%; top: 3px; bottom: 3px; width: 1px; }
.px-mark::after { top: 50%; left: 3px; right: 3px; height: 1px; }
.px-run-id { display: flex; align-items: center; gap: 8px; min-width: 0; }
.px-run-title { font-size: var(--px-fs-1); max-width: 260px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.px-run-version { font-size: var(--px-fs-3); color: var(--dsw-alias-label-secondary); }
.px-progress { display: flex; align-items: center; gap: 8px; }
.px-progress-track { width: 96px; height: 4px; border-radius: 2px; background: var(--dsw-alias-border-l1); overflow: hidden; display: inline-block; }
.px-progress-fill { display: block; height: 100%; background: var(--dsw-alias-brand-primary); transition: width .2s ease; }
.px-progress-text { font-size: var(--px-fs-3); color: var(--dsw-alias-label-secondary); }
.px-modes { display: inline-flex; border: 1px solid var(--dsw-alias-border-l1); border-radius: 6px; overflow: hidden; }
.px-mode { border: 0; background: transparent; padding: 4px 12px; font-size: var(--px-fs-2); cursor: pointer; color: var(--dsw-alias-label-secondary); }
.px-mode.is-on { background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-primary); font-weight: 560; }
.px-bar-ghost { background: transparent; border-color: transparent; color: var(--dsw-alias-label-secondary); }
.px-runbar-reason { font-size: var(--px-fs-3); color: var(--dsw-alias-state-warn-primary); max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* ---------- buttons / fields / chips ---------- */
.px-btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  height: 30px; padding: 0 12px; border-radius: 6px;
  border: 1px solid var(--dsw-alias-border-l2);
  background: transparent; color: var(--dsw-alias-label-primary);
  font-size: var(--px-fs-2); cursor: pointer; white-space: nowrap;
  transition: background .14s ease, border-color .14s ease;
}
.px-btn:hover:not(:disabled) { background: var(--dsw-alias-bg-layer-2); }
.px-btn:disabled { opacity: .45; cursor: not-allowed; }
.px-btn.primary { background: var(--dsw-alias-brand-primary); border-color: var(--dsw-alias-brand-primary); color: var(--dsw-alias-bg-base); font-weight: 560; }
.px-btn.primary:hover:not(:disabled) { filter: brightness(1.08); }
.px-btn.danger { border-color: var(--dsw-alias-state-error-primary); color: var(--dsw-alias-state-error-primary); }
.px-btn.active { border-color: var(--dsw-alias-brand-primary); color: var(--dsw-alias-brand-primary); }
.px-btn.block { width: 100%; }
.px-icon-btn { border: 0; background: transparent; cursor: pointer; font-size: 16px; line-height: 1; padding: 2px 6px; color: var(--dsw-alias-label-secondary); border-radius: 4px; }
.px-icon-btn:hover { background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-primary); }
.px-row { display: flex; gap: 8px; align-items: center; justify-content: flex-end; }

.px-field { display: grid; gap: 4px; }
.px-field-label { display: flex; align-items: baseline; gap: 6px; font-size: var(--px-fs-3); color: var(--dsw-alias-label-secondary); letter-spacing: .02em; }
.px-field-label em { font-style: normal; opacity: .7; }
.px-field-error { font-size: var(--px-fs-3); color: var(--dsw-alias-state-error-primary); }
.px-field.has-error .px-input { border-color: var(--dsw-alias-state-error-primary); }
.px-input {
  width: 100%; min-height: 30px; padding: 5px 8px;
  border: 1px solid var(--dsw-alias-border-l1); border-radius: 6px;
  background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-label-primary);
  font: inherit; font-size: var(--px-fs-2);
}
.px-input:focus { border-color: var(--dsw-alias-brand-primary); outline: none; }
.px-area { resize: vertical; min-height: 62px; line-height: 1.5; }
.px-input::placeholder { color: var(--dsw-alias-label-secondary); opacity: .7; }

.px-chip {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 1px 7px; border-radius: 999px; border: 1px solid var(--dsw-alias-border-l1);
  font-size: var(--px-fs-3); color: var(--dsw-alias-label-secondary); white-space: nowrap;
}
.px-chip.active { color: var(--dsw-alias-brand-primary); border-color: var(--dsw-alias-brand-primary); }
.px-chip.ok { color: var(--dsw-alias-state-success-primary); border-color: var(--dsw-alias-state-success-primary); }
.px-chip.warn { color: var(--dsw-alias-state-warn-primary); border-color: var(--dsw-alias-state-warn-primary); }
.px-chip.bad { color: var(--dsw-alias-state-error-primary); border-color: var(--dsw-alias-state-error-primary); }

.px-banner-slot { position: absolute; left: 50%; top: 10px; transform: translateX(-50%); z-index: 30; max-width: min(640px, calc(100% - 48px)); width: max-content; }
.px-banner-slot:empty { display: none; }
.px-banner {
  display: flex; align-items: center; gap: 10px;
  padding: 7px 12px; border-radius: 6px; font-size: var(--px-fs-2);
  border: 1px solid var(--dsw-alias-border-l1); background: var(--dsw-alias-bg-layer-1);
}
.px-banner.warn { border-color: var(--dsw-alias-state-warn-primary); color: var(--dsw-alias-state-warn-primary); }
.px-banner.bad { border-color: var(--dsw-alias-state-error-primary); color: var(--dsw-alias-state-error-primary); }
.px-banner.ok { border-color: var(--dsw-alias-state-success-primary); color: var(--dsw-alias-state-success-primary); }
.px-banner-text { flex: 1 1 auto; }
.px-banner-x { border: 0; background: transparent; cursor: pointer; color: inherit; opacity: .7; font-size: 14px; }

/* ---------- menu / tabs / modal ---------- */
.px-menu { position: relative; }
.px-menu-trigger { gap: 4px; }
.px-menu-caret { font-size: 9px; opacity: .7; }
.px-menu-list {
  position: absolute; right: 0; top: calc(100% + 6px); min-width: 176px; z-index: 40;
  background: var(--dsw-alias-bg-overlay); border: 1px solid var(--dsw-alias-border-l1);
  border-radius: var(--px-radius); padding: 4px; box-shadow: 0 12px 28px rgb(0 0 0 / .18);
  display: grid; gap: 1px;
}
.px-menu-item {
  display: flex; justify-content: space-between; gap: 10px; align-items: center;
  border: 0; background: transparent; text-align: left; cursor: pointer;
  padding: 6px 8px; border-radius: 5px; font-size: var(--px-fs-2); color: var(--dsw-alias-label-primary);
}
.px-menu-item:hover { background: var(--dsw-alias-bg-layer-2); }
.px-menu-item.danger { color: var(--dsw-alias-state-error-primary); }
.px-menu-item em { font-style: normal; font-size: var(--px-fs-3); color: var(--dsw-alias-label-secondary); }
.px-tabs { display: inline-flex; gap: 2px; border-bottom: 1px solid var(--dsw-alias-border-l1); }
.px-tab { border: 0; background: transparent; padding: 6px 10px; font-size: var(--px-fs-2); color: var(--dsw-alias-label-secondary); cursor: pointer; border-bottom: 2px solid transparent; }
.px-tab.is-on { color: var(--dsw-alias-label-primary); border-bottom-color: var(--dsw-alias-brand-primary); }
.px-modal-scrim { position: fixed; inset: 0; background: rgb(0 0 0 / .32); display: grid; place-items: center; z-index: 60; }
.px-modal { width: 420px; max-width: calc(100vw - 32px); background: var(--dsw-alias-bg-overlay); border: 1px solid var(--dsw-alias-border-l1); border-radius: 10px; box-shadow: 0 24px 64px rgb(0 0 0 / .28); overflow: hidden; }
.px-modal.wide { width: 640px; }
.px-modal-head { display: flex; align-items: center; justify-content: space-between; padding: 12px 14px; border-bottom: 1px solid var(--dsw-alias-border-l1); }
.px-modal-head h2 { font-size: var(--px-fs-1); font-weight: 600; }
.px-modal-body { padding: 14px; display: grid; gap: 12px; }
.px-modal-foot { padding: 10px 14px; border-top: 1px solid var(--dsw-alias-border-l1); }
.px-kv { display: grid; gap: 6px; margin: 0; }
.px-kv-row { display: grid; grid-template-columns: 96px 1fr; gap: 10px; }
.px-kv dt { font-size: var(--px-fs-3); color: var(--dsw-alias-label-secondary); }
.px-kv dd { margin: 0; font-size: var(--px-fs-2); }

/* ---------- cockpit grid ---------- */
.px-cockpit {
  flex: 1 1 auto;
  min-height: 0;
  display: grid;
  grid-template-columns: 200px minmax(0, 1fr) auto;
  gap: 0;
  overflow: hidden;
}
.px-v4-rail { border-right: 1px solid var(--dsw-alias-border-l1); overflow: auto; min-height: 0; }
.px-v4-board { position: relative; overflow: hidden; min-height: 0; display: flex; flex-direction: column; }
.px-cockpit > [data-testid="inspector"] { position: absolute; }
.px-cockpit { position: relative; }
.px-cockpit > .px-inspector, .px-cockpit > .px-v4-inspector {
  position: absolute; right: 0; top: 0; bottom: 0; width: 360px; z-index: 12;
}
.px-v4-band { flex: 0 0 148px; border-top: 1px solid var(--dsw-alias-border-l1); overflow: auto; }
.px-rail-empty { padding: 16px; font-size: var(--px-fs-2); color: var(--dsw-alias-label-secondary); }
.px-empty-stage { position: absolute; inset: 0; display: grid; place-items: center; padding: 24px; }

/* run bar team chip */
.px-team-chip {
  display: inline-flex; align-items: center; gap: 6px;
  height: 26px; padding: 0 10px; border-radius: 999px;
  border: 1px solid var(--dsw-alias-border-l1); background: transparent;
  font-size: var(--px-fs-3); color: var(--dsw-alias-label-secondary); cursor: pointer;
  white-space: nowrap;
}
.px-team-chip:hover { background: var(--dsw-alias-bg-layer-2); }
.px-team-chip.is-live { color: var(--dsw-alias-label-primary); border-color: var(--dsw-alias-border-l2); }
.px-team-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--dsw-alias-label-secondary); opacity: .5; }
.px-team-dot[data-running="true"] { background: var(--px-ok, var(--dsw-alias-state-success-primary)); opacity: 1; }

/* ---------- skeleton / empty / glyph ---------- */
.px-skeleton { display: grid; gap: 10px; padding: 18px 0; width: 100%; }
.px-skeleton-row {
  display: block; height: 12px; border-radius: 6px;
  background: color-mix(in oklab, var(--dsw-alias-border-l2) 45%, var(--dsw-alias-bg-layer-1));
  border: 1px solid var(--dsw-alias-border-l1);
  animation: px-pulse 1.4s ease-in-out infinite;
}
.px-skeleton-row:nth-child(2) { width: 78%; }
.px-skeleton-row:nth-child(3) { width: 56%; }
@keyframes px-pulse { 0%, 100% { opacity: .45; } 50% { opacity: .9; } }
.px-boot { display: grid; place-items: center; height: 100%; padding: 24px; }
.px-boot-wait { display: grid; gap: 10px; justify-items: stretch; width: min(420px, 100%); }
.px-boot-hint { font-size: var(--px-fs-2); color: var(--dsw-alias-label-secondary); text-align: center; }
.px-empty { display: grid; gap: 8px; place-items: center; text-align: center; padding: 18px; }
.px-empty-title { font-size: var(--px-fs-1); font-weight: 560; }
.px-empty-hint { font-size: var(--px-fs-2); color: var(--dsw-alias-label-secondary); max-width: 320px; }
.px-glyph { display: inline-flex; align-items: center; justify-content: center; width: 14px; height: 14px; border-radius: 50%; font-size: 9px; line-height: 1; flex: none; border: 1px solid currentColor; }
.px-glyph.done { background: currentColor; color: var(--dsw-alias-bg-base); }
.px-glyph.blocked { border-radius: 3px; }
.px-glyph.failed { border-radius: 3px; }
.px-glyph.pending { border-style: dashed; }
.px-glyph.active { background: currentColor; color: var(--dsw-alias-bg-base); }

/* ---------- dock / sidebar panel ---------- */
.px-dock {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 11px; color: var(--dsw-alias-label-secondary);
  border: 1px solid var(--dsw-alias-border-l1); border-radius: 999px; padding: 1px 8px;
  background: transparent; white-space: nowrap;
}
.px-dock.warn { color: var(--dsw-alias-state-warn-primary); border-color: currentColor; }
.px-dock i { width: 5px; height: 5px; border-radius: 50%; background: currentColor; }
.px-side { display: flex; flex-direction: column; gap: 8px; padding: 10px; min-height: 0; font-size: var(--px-fs-2); }
.px-side-head { display: flex; align-items: baseline; justify-content: space-between; padding: 0 4px; }
.px-side-title { font-size: var(--px-fs-1); font-weight: 600; }
.px-side-count { font-size: var(--px-fs-3); color: var(--dsw-alias-label-secondary); }
.px-side-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 2px; overflow: auto; }
.px-side-run { display: flex; justify-content: space-between; gap: 8px; width: 100%; border: 1px solid transparent; background: transparent; border-radius: 5px; padding: 5px 8px; cursor: pointer; text-align: left; }
.px-side-run:hover { background: var(--dsw-alias-bg-layer-2); }
.px-side-run.is-on { border-color: var(--dsw-alias-border-l2); background: var(--dsw-alias-bg-layer-1); }
.px-side-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.px-side-state { font-size: var(--px-fs-3); color: var(--dsw-alias-label-secondary); flex: none; }

/* ---------- canvas ---------- */
.px-canvas { position: absolute; inset: 0; overflow: hidden; outline: none;
  background-image: radial-gradient(circle, var(--dsw-alias-border-l1) 1px, transparent 1px);
  background-size: 18px 18px; }
.px-canvas-world { position: absolute; left: 0; top: 0; transform-origin: 0 0; will-change: transform; }
.px-canvas-svg { position: absolute; left: 0; top: 0; overflow: visible; pointer-events: none; }
.px-lane-label { position: absolute; font-size: var(--px-fs-2); letter-spacing: .08em; color: var(--dsw-alias-label-secondary); white-space: nowrap; }
.px-edge { fill: none; stroke: var(--dsw-alias-border-l2); stroke-width: 1.2; }
.px-edge[data-execution="done"] { stroke: var(--dsw-alias-state-success-primary); }
.px-edge[data-execution="active"] { stroke: var(--dsw-alias-brand-primary); stroke-width: 1.6; }
.px-edge[data-execution="blocked"] { stroke: var(--dsw-alias-state-warn-primary); stroke-dasharray: 3 3; }
.px-edge[data-execution="failed"] { stroke: var(--dsw-alias-state-error-primary); stroke-dasharray: 4 3; }
.px-edge[data-draft="true"] { stroke-dasharray: 5 4; }
.px-node {
  position: absolute; width: 156px; height: 64px;
  display: flex; flex-direction: column; justify-content: center; gap: 1px;
  padding: 7px 10px; border: 1px solid var(--dsw-alias-border-l2); border-radius: 7px;
  background: var(--dsw-alias-bg-layer-1); cursor: pointer; user-select: none;
  transition: border-color .12s ease, box-shadow .12s ease;
}
.px-node[data-type="gate"] { border-style: dashed; }
.px-node[data-type="start"], .px-node[data-type="end"] { border-color: var(--dsw-alias-border-l1); }
.px-node[data-execution="done"] { border-color: var(--dsw-alias-state-success-primary); }
.px-node[data-execution="active"] { border-color: var(--dsw-alias-brand-primary); box-shadow: 0 0 0 1px var(--dsw-alias-brand-primary) inset; }
.px-node[data-execution="blocked"] { border-color: var(--dsw-alias-state-warn-primary); border-style: dashed; }
.px-node[data-execution="failed"] { border-color: var(--dsw-alias-state-error-primary); box-shadow: inset 0 0 0 2px var(--dsw-alias-state-error-primary); }
.px-node[data-current="true"]::before {
  content: ""; position: absolute; left: -1px; top: 9px; bottom: 9px; width: 3px;
  border-radius: 2px; background: var(--dsw-alias-brand-primary);
}
.px-node[data-selected="true"] { outline: 2px dashed var(--dsw-alias-label-secondary); outline-offset: 3px; }
.px-node[data-execution="done"] .px-node-glyph { color: var(--dsw-alias-state-success-primary); }
.px-node[data-execution="active"] .px-node-glyph { color: var(--dsw-alias-brand-primary); }
.px-node[data-execution="blocked"] .px-node-glyph { color: var(--dsw-alias-state-warn-primary); }
.px-node[data-execution="failed"] .px-node-glyph { color: var(--dsw-alias-state-error-primary); }
.px-node[data-execution="pending"] .px-node-glyph { color: var(--dsw-alias-label-secondary); opacity: .8; }
.px-node-title { display: flex; align-items: center; gap: 5px; font-size: 12.5px; font-weight: 600; line-height: 1.25; }
.px-node-title span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.px-node-sub { font-size: 11px; color: var(--dsw-alias-label-secondary); line-height: 1.3; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.px-node-chip { display: inline-flex; align-items: center; gap: 3px; font-size: 10px; color: var(--dsw-alias-label-secondary); line-height: 1.3; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.px-node-chip[data-condition="satisfied"] { color: var(--dsw-alias-state-success-primary); }
.px-node-chip[data-condition="missing"] { color: var(--dsw-alias-state-warn-primary); }
.px-node-chip[data-condition="stale"] { color: var(--dsw-alias-state-error-primary); }
.px-node-badge { position: absolute; right: 7px; top: 6px; font-size: 9px; letter-spacing: .04em; color: var(--dsw-alias-brand-primary); }
.px-port { position: absolute; width: 10px; height: 10px; border-radius: 50%; border: 1px solid var(--dsw-alias-border-l2); background: var(--dsw-alias-bg-base); cursor: crosshair; padding: 0; }
.px-port-in { left: -5px; top: 50%; margin-top: -5px; }
.px-port-out { right: -5px; top: 50%; margin-top: -5px; }
.px-canvas-tools {
  position: absolute; right: 12px; bottom: 12px; display: flex; align-items: center; gap: 4px;
  background: var(--dsw-alias-bg-overlay); border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 6px; padding: 3px; z-index: 6;
}
.px-canvas-tools .px-btn { height: 24px; padding: 0 8px; font-size: var(--px-fs-3); border-color: transparent; }
.px-zoom { display: flex; align-items: center; gap: 4px; }
.px-zoom-text { min-width: 38px; text-align: center; font-size: var(--px-fs-3); color: var(--dsw-alias-label-secondary); }
.px-canvas-draft { font-size: var(--px-fs-3); color: var(--dsw-alias-state-warn-primary); padding: 0 6px; }

/* ---------- inspector ---------- */
.px-inspector {
  position: absolute; right: 12px; top: 12px; bottom: 12px; width: 360px;
  display: flex; flex-direction: column; z-index: 10;
  background: var(--dsw-alias-bg-overlay); border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 10px; box-shadow: 0 16px 40px rgb(0 0 0 / .18); overflow: hidden;
}
.px-inspector-head { display: flex; align-items: flex-start; gap: 8px; padding: 12px 12px 8px; border-bottom: 1px solid var(--dsw-alias-border-l1); }
.px-inspector-title { flex: 1 1 auto; display: grid; gap: 4px; min-width: 0; }
.px-inspector-title strong { font-size: var(--px-fs-1); font-weight: 600; }
.px-inspector-close { flex: none; }
.px-inspector-body { flex: 1 1 auto; overflow: auto; padding: 12px; display: grid; gap: 12px; align-content: start; }
.px-inspector-foot { border-top: 1px solid var(--dsw-alias-border-l1); padding: 10px 12px; }
.px-inspector-actions { display: flex; gap: 8px; justify-content: flex-end; }
.px-action-form { display: grid; gap: 10px; }
.px-action-error { font-size: var(--px-fs-3); color: var(--dsw-alias-state-error-primary); }
.px-state-duo { display: flex; gap: 6px; flex-wrap: wrap; }

/* ---------- drawer ---------- */
.px-drawer {
  position: absolute; right: 0; top: 0; bottom: 0; width: 480px; z-index: 20;
  display: flex; flex-direction: column;
  background: var(--dsw-alias-bg-overlay); border-left: 1px solid var(--dsw-alias-border-l1);
  box-shadow: -16px 0 40px rgb(0 0 0 / .16);
}
.px-drawer-head { display: flex; align-items: center; gap: 8px; padding: 12px 14px; border-bottom: 1px solid var(--dsw-alias-border-l1); }
.px-drawer-head strong { flex: 1 1 auto; font-size: var(--px-fs-1); }
.px-drawer-body { flex: 1 1 auto; overflow: auto; padding: 14px; display: grid; gap: 12px; align-content: start; }
.px-drawer-foot { border-top: 1px solid var(--dsw-alias-border-l1); padding: 10px 14px; display: flex; gap: 8px; justify-content: flex-end; }
.px-drawer-close { flex: none; }

/* ---------- map / knobs / audit / evidence / runs ---------- */
.px-map { position: relative; display: grid; gap: 10px; }
.px-map-legend { display: flex; gap: 12px; flex-wrap: wrap; font-size: var(--px-fs-3); color: var(--dsw-alias-label-secondary); }
.px-map-node { border: 1px solid var(--dsw-alias-border-l2); border-radius: 6px; padding: 7px 9px; font-size: var(--px-fs-2); }
.px-map-node[data-status="unknown"] { border-style: dashed; color: var(--dsw-alias-label-secondary); }
.px-map-node[data-status="supported"] { border-color: var(--dsw-alias-state-success-primary); }
.px-map-node[data-status="contradicted"] { border-color: var(--dsw-alias-state-error-primary); color: var(--dsw-alias-state-error-primary); }
.px-map-node[data-status="obsolete"] { text-decoration: line-through; opacity: .6; }
.px-map-frontier { border-left: 2px solid var(--dsw-alias-state-warn-primary); padding-left: 8px; }
.px-knob { display: grid; gap: 4px; }
.px-knob-head { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; font-size: var(--px-fs-2); }
.px-knob-range { width: 100%; accent-color: var(--dsw-alias-brand-primary); }
.px-knob-hint { font-size: var(--px-fs-3); color: var(--dsw-alias-label-secondary); }
.px-audit-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
.px-audit-item { display: grid; grid-template-columns: 46px 92px 1fr; gap: 8px; font-size: var(--px-fs-2); border-bottom: 1px solid var(--dsw-alias-border-l1); padding-bottom: 5px; }
.px-audit-time { color: var(--dsw-alias-label-secondary); font-size: var(--px-fs-3); }
.px-audit-kind { color: var(--dsw-alias-label-secondary); font-size: var(--px-fs-3); }
.px-audit-violation { border-left: 2px solid var(--dsw-alias-state-error-primary); padding-left: 8px; font-size: var(--px-fs-2); color: var(--dsw-alias-state-error-primary); }
.px-evidence { display: grid; gap: 8px; }
.px-evidence-row { display: grid; grid-template-columns: 110px 1fr; gap: 8px; font-size: var(--px-fs-2); border-bottom: 1px solid var(--dsw-alias-border-l1); padding-bottom: 6px; }
.px-evidence-gap { color: var(--dsw-alias-state-warn-primary); font-size: var(--px-fs-3); }
.px-runs { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; }
.px-run-item { display: flex; justify-content: space-between; gap: 8px; width: 100%; padding: 7px 9px; border: 1px solid transparent; border-radius: 6px; background: transparent; cursor: pointer; text-align: left; }
.px-run-item:hover { background: var(--dsw-alias-bg-layer-2); }
.px-run-item.is-on { border-color: var(--dsw-alias-border-l2); background: var(--dsw-alias-bg-layer-1); }
.px-run-item-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.px-run-item-state { font-size: var(--px-fs-3); color: var(--dsw-alias-label-secondary); flex: none; }
.px-table { width: 100%; border-collapse: collapse; font-size: var(--px-fs-2); }
.px-table th { text-align: left; font-size: var(--px-fs-3); color: var(--dsw-alias-label-secondary); font-weight: 500; padding: 4px 6px; border-bottom: 1px solid var(--dsw-alias-border-l1); }
.px-table td { padding: 5px 6px; border-bottom: 1px solid var(--dsw-alias-border-l1); vertical-align: top; }

/* ---------- responsive ---------- */
@media (max-width: 1180px) {
  .px-progress-track { width: 48px; }
  .px-run-title { max-width: 160px; }
  .px-run-version { display: none; }
  .px-runbar { gap: 10px; padding: 0 12px; }
  .px-runbar-reason { display: none; }
  .px-inspector { left: 12px; right: 12px; top: auto; bottom: 12px; width: auto; max-height: 46vh; }
  .px-drawer { width: 100%; }
}
@media (max-width: 900px) {
  .px-runbar { gap: 8px; padding: 0 10px; }
  .px-runbar-center { display: none; }
  .px-brand-name { display: none; }
}
`;

const CssText = [
  CssBase,
  typeof CanvasCss === 'string' ? CanvasCss : '',
  typeof InspectCss === 'string' ? InspectCss : '',
  typeof PanelsCss === 'string' ? PanelsCss : '',
].join('\n');
