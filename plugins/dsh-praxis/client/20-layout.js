/* Praxis v4 cockpit geometry. Pure helpers; no graph/editor assumptions. */

const LayoutConstants = Object.freeze({
  railW: 220,
  boardGap: 12,
  columnW: 240,
  headerH: 44,
  bandH: 120,
});

function LayoutNumber(value, fallback) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function LayoutBranchColumns(branches, viewport) {
  const list = Array.isArray(branches) ? branches : [];
  const view = viewport && typeof viewport === 'object' ? viewport : {};
  const height = Math.max(180, LayoutNumber(view.height, 640) - LayoutConstants.headerH - LayoutConstants.bandH);
  const columns = list.map((branch, index) => ({
    id: branch?.id ?? `branch-${index + 1}`,
    x: LayoutConstants.railW + LayoutConstants.boardGap + index * (LayoutConstants.columnW + LayoutConstants.boardGap),
    y: 0,
    w: LayoutConstants.columnW,
    h: height,
  }));
  const totalWidth = Math.max(
    LayoutConstants.railW + LayoutConstants.boardGap * 2,
    LayoutConstants.railW + LayoutConstants.boardGap + list.length * (LayoutConstants.columnW + LayoutConstants.boardGap),
  );
  return { columns, totalWidth };
}

function LayoutGateRows(gates) {
  const list = Array.isArray(gates) ? gates : [];
  const rowH = 44;
  const gap = 6;
  return list.map((gate, index) => ({
    id: gate?.id ?? `gate-${index + 1}`,
    y: index * (rowH + gap),
    h: rowH,
  }));
}
