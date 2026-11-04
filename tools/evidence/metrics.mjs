/**
 * 浏览器验收指标（10-v2-contract.md §5.6）。
 * 在真实页面上下文里计算，返回值可直接写进 evidence manifest 或用于断言。
 */

// §5.7 定稿（2026-11-05）：1440 签收阈值；1024 全应用/700×600 为 compat，另行覆盖。
export const METRIC_THRESHOLDS = Object.freeze({
  visibleNodeRatio: 1, // nodeVisible === nodeTotal
  bboxWidthRatio: 0.75,
  bboxHeightRatio: 0.28,
  bboxAreaRatio: 0.24,
  primaryCount: 1,
  internalCodeCount: 0,
  destructiveControlCount: 0,
  horizontalOverflow: 0,
});

const INTERNAL_CODE_PATTERN = 'prereg_freeze|gate:prereg|close-or-new-run|INVALID_TRANSITION|QUESTION_REQUIRED|QUESTION_INCOMPLETE|PREREG_VIOLATION|USER_ONLY|PROTECTED_NODE|INVALID_GRAPH|REVISION_REQUIRED';

export const COMPAT_THRESHOLDS = Object.freeze({
  visibleNodeRatio: 1,
  bboxWidthRatio: 0,
  bboxHeightRatio: 0,
  bboxAreaRatio: 0,
  primaryCount: 1,
  internalCodeCount: 0,
  destructiveControlCount: 0,
  horizontalOverflow: 0,
});

/**
 * 计算 §5.6 指标。DOM 契约：
 *   .px-shell 客户端根；.px-canvas 画布；.px-node 节点；.px-btn-primary 唯一主按钮。
 * @param {import('./cdp.mjs').CDP} cdp
 */
export async function collectMetrics(cdp) {
  return cdp.evaluate(`(() => {
    const shell = document.querySelector('.px-shell');
    if (!shell) return { available: false, reason: 'no .px-shell (Praxis panel not mounted)' };
    if (shell.querySelector('.px-loading')) return { available: false, reason: 'loading state' };
    const canvas = document.querySelector('.px-canvas');
    const canvasRect = canvas ? canvas.getBoundingClientRect() : { left: 0, top: 0, width: innerWidth, height: innerHeight, right: innerWidth, bottom: innerHeight };
    const nodes = [...document.querySelectorAll('.px-node')];
    const inCanvas = nodes.filter((node) => {
      const r = node.getBoundingClientRect();
      if (!(r.width > 0 && r.height > 0)) return false;
      return r.right > canvasRect.left && r.left < canvasRect.right && r.bottom > canvasRect.top && r.top < canvasRect.bottom;
    });
    let minX = Infinity; let minY = Infinity; let maxX = -Infinity; let maxY = -Infinity;
    for (const node of inCanvas) {
      const r = node.getBoundingClientRect();
      minX = Math.min(minX, r.left); minY = Math.min(minY, r.top);
      maxX = Math.max(maxX, r.right); maxY = Math.max(maxY, r.bottom);
    }
    const bboxWidth = inCanvas.length ? Math.max(0, maxX - minX) : 0;
    const bboxHeight = inCanvas.length ? Math.max(0, maxY - minY) : 0;
    const bboxArea = bboxWidth * bboxHeight;
    const canvasArea = Math.max(1, canvasRect.width * canvasRect.height);
    const destructiveControlCount = [...shell.querySelectorAll('button')]
      .filter((button) => /删除节点|连线|拖拽节点/.test(button.textContent ?? '')).length;
    const visible = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
    const taggedPrimary = [...shell.querySelectorAll('[data-testid=\"primary\"]')].filter(visible);
    const classPrimary = [...shell.querySelectorAll('button')].filter((button) => {
      const cls = String(button.className).trim().split(' ');
      return cls.includes('px-btn-primary') || cls.includes('primary') || button.getAttribute('data-primary') === 'true';
    }).filter(visible);
    const primary = taggedPrimary.length ? taggedPrimary : classPrimary;
    const primaryTexts = primary.map((button) => (button.textContent ?? '').trim()).slice(0, 5);
    const primaryClassNames = primary.map((button) => String(button.className)).slice(0, 5);
    const primarySelector = taggedPrimary.length ? 'data-testid=primary' : 'class-fallback';
    const drawerPrimaryCount = [...shell.querySelectorAll('[data-primary-scope=\"drawer\"]')].filter(visible).length;
    const contractPrimaryClassPresent = !!shell.querySelector('.px-btn-primary');
    const shellText = shell.innerText ?? '';
    const internalCodeCount = (shellText.match(new RegExp(${JSON.stringify(INTERNAL_CODE_PATTERN)}, 'g')) ?? []).length;
    const horizontalOverflow = Math.max(0, document.documentElement.scrollWidth - window.innerWidth);
    const world = document.querySelector('.px-canvas-world[data-testid=\"world\"]') ?? document.querySelector('.px-canvas-world');
    const worldScale = Number(world?.getAttribute('data-scale') ?? canvas?.getAttribute('data-scale') ?? NaN);
    const viewportHint = !!document.querySelector('[data-testid=\"viewport-hint\"], [data-testid=\"viewport-warning\"]');
    const shellRect = shell.getBoundingClientRect();
    const shellOverflow = Math.max(0, shell.scrollWidth - shell.clientWidth);
    const parseRgb = (value) => {
      const match = /rgba?\(([^)]+)\)/.exec(value ?? '');
      if (!match) return null;
      const parts = match[1].split(',').map((part) => Number(part.trim()));
      return parts.length >= 3 ? parts.slice(0, 3) : null;
    };
    const relativeLuminance = (rgb) => {
      const [r, g, b] = rgb.map((value) => {
        const channel = value / 255;
        return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const sampleContrast = (el, parent) => {
      if (!el) return null;
      const fg = parseRgb(getComputedStyle(el).color);
      const bg = parseRgb(getComputedStyle(parent ?? el).backgroundColor) ?? parseRgb(getComputedStyle(document.body).backgroundColor);
      if (!fg || !bg) return null;
      return { fg, bg, ratio: Number(((Math.max(relativeLuminance(fg), relativeLuminance(bg)) + 0.05) / (Math.min(relativeLuminance(fg), relativeLuminance(bg)) + 0.05)).toFixed(2)) };
    };
    const fontSizes = [...shell.querySelectorAll('.px-node-title, .px-node-sub, .px-node-foot, .px-node-chip, .px-lane-label, .px-chip, .px-btn')]
      .map((el) => Number.parseFloat(getComputedStyle(el).fontSize))
      .filter((value) => Number.isFinite(value) && value > 0);
    const fontSizeMinRaw = fontSizes.length ? Math.min(...fontSizes) : null;
    const scale = Number.isFinite(worldScale) ? worldScale : 1;
    const contrastText = sampleContrast(shell.querySelector('.px-node-title'), shell.querySelector('.px-node'));
    const contrastNonText = sampleContrast(shell.querySelector('.px-node-glyph, .px-node-dot, .px-node'), shell.querySelector('.px-node'));
    const themeSource = document.documentElement.getAttribute('data-ds-theme-source');
    const bodyBackground = getComputedStyle(document.body).backgroundColor;
    return {
      available: true,
      scenario: (document.querySelector('[data-scenario]')?.getAttribute('data-scenario')) ?? null,
      viewport: { width: innerWidth, height: innerHeight },
      canvas: { width: Math.round(canvasRect.width), height: Math.round(canvasRect.height) },
      nodeTotal: nodes.length,
      nodeVisible: inCanvas.length,
      visibleNodeRatio: nodes.length ? inCanvas.length / nodes.length : 0,
      contentBBoxRatio: bboxArea / canvasArea,
      bboxWidthRatio: canvasRect.width ? bboxWidth / canvasRect.width : 0,
      bboxHeightRatio: canvasRect.height ? bboxHeight / canvasRect.height : 0,
      bboxAreaRatio: canvasRect.width && canvasRect.height
        ? bboxArea / (canvasRect.width * canvasRect.height) : 0,
      shellWidth: Math.round(shellRect.width),
      shellHeight: Math.round(shellRect.height),
      shellOverflow,
      fontSizeMinRaw,
      fontSizeMin: fontSizeMinRaw === null ? null : Number((fontSizeMinRaw * scale).toFixed(2)),
      contrast: {
        text: contrastText ? contrastText.ratio : null,
        nonText: contrastNonText ? contrastNonText.ratio : null,
        status: contrastText ? 'sampled' : '未测',
      },
      drawerPrimaryCount,
      primarySelector,
      primaryCount: primary.length,
      primaryTexts,
      primaryClassNames,
      contractPrimaryClassPresent,
      internalCodeCount,
      destructiveControlCount,
      horizontalOverflow,
      worldScale: Number.isFinite(worldScale) ? worldScale : null,
      viewportHint,
      themeSource,
      bodyBackground,
      pageScrollHeight: document.documentElement.scrollHeight,
    };
  })()`);
}

/** 断言 §5.6 阈值；返回 violations 数组（空数组 = 通过）。 */
export function checkMetrics(metrics, expected = {}) {
  const violations = [];
  if (!metrics?.available) {
    violations.push({ metric: 'available', expected: true, actual: metrics?.reason ?? metrics?.available });
    return violations;
  }
  const threshold = { ...METRIC_THRESHOLDS, ...expected };
  if (metrics.visibleNodeRatio < threshold.visibleNodeRatio) {
    violations.push({ metric: 'visibleNodeRatio', expected: threshold.visibleNodeRatio, actual: metrics.visibleNodeRatio });
  }
  if (metrics.bboxWidthRatio < threshold.bboxWidthRatio) {
    violations.push({ metric: 'bboxWidthRatio', expected: threshold.bboxWidthRatio, actual: metrics.bboxWidthRatio });
  }
  if (metrics.bboxHeightRatio < threshold.bboxHeightRatio) {
    violations.push({ metric: 'bboxHeightRatio', expected: threshold.bboxHeightRatio, actual: metrics.bboxHeightRatio });
  }
  if (metrics.bboxAreaRatio < threshold.bboxAreaRatio) {
    violations.push({ metric: 'bboxAreaRatio', expected: threshold.bboxAreaRatio, actual: metrics.bboxAreaRatio });
  }
  if (metrics.nodeVisible !== metrics.nodeTotal) {
    violations.push({ metric: 'nodeVisible', expected: metrics.nodeTotal, actual: metrics.nodeVisible });
  }
  if (metrics.primaryCount !== threshold.primaryCount) {
    violations.push({ metric: 'primaryCount', expected: threshold.primaryCount, actual: metrics.primaryCount, texts: metrics.primaryTexts });
  }
  if (metrics.internalCodeCount !== threshold.internalCodeCount) {
    violations.push({ metric: 'internalCodeCount', expected: threshold.internalCodeCount, actual: metrics.internalCodeCount });
  }
  if (metrics.destructiveControlCount !== threshold.destructiveControlCount) {
    violations.push({ metric: 'destructiveControlCount', expected: threshold.destructiveControlCount, actual: metrics.destructiveControlCount });
  }
  if (metrics.horizontalOverflow !== threshold.horizontalOverflow) {
    violations.push({ metric: 'horizontalOverflow', expected: threshold.horizontalOverflow, actual: metrics.horizontalOverflow });
  }
  return violations;
}

export default collectMetrics;
