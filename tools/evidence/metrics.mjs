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
  contrastTextMin: 4.5,
  contrastNonTextMin: 3.0,
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
  contrastTextMin: 0,
  contrastNonTextMin: 0,
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
    const contractPrimaryClassPresent = !!shell.querySelector('[data-testid="primary"], .px-btn.primary');
    const shellText = shell.innerText ?? '';
    const internalCodeCount = (shellText.match(new RegExp(${JSON.stringify(INTERNAL_CODE_PATTERN)}, 'g')) ?? []).length;
    const horizontalOverflow = Math.max(0, document.documentElement.scrollWidth - window.innerWidth);
    const world = document.querySelector('.px-canvas-world[data-testid=\"world\"]') ?? document.querySelector('.px-canvas-world');
    const worldScale = Number(world?.getAttribute('data-scale') ?? canvas?.getAttribute('data-scale') ?? NaN);
    const viewportHint = !!document.querySelector('[data-testid=\"viewport-hint\"], [data-testid=\"viewport-warning\"]');
    const shellRect = shell.getBoundingClientRect();
    const shellOverflow = Math.max(0, shell.scrollWidth - shell.clientWidth);
    const clamp01 = (x) => Math.min(1, Math.max(0, x));
    const toSrgb = (linear) => (linear <= 0.0031308 ? 12.92 * linear : 1.055 * Math.pow(linear, 1 / 2.4) - 0.055);
    const parseNumericList = (value, open, close) => {
      const start = value.indexOf(open);
      const end = value.indexOf(close, start + 1);
      if (start < 0 || end < 0) return null;
      const body = value.slice(start + 1, end).split('/')[0];
      const parts = body.trim().split(/[ ,]+/).filter(Boolean).map((part) => Number(part));
      return parts.some((part) => !Number.isFinite(part)) ? null : parts;
    };
    const oklabToRgb = (L, a, b) => {
      const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
      const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
      const s_ = L - 0.0894841775 * a - 1.291485548 * b;
      const l = l_ ** 3; const m = m_ ** 3; const sp = s_ ** 3;
      const r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * sp;
      const g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * sp;
      const bl = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * sp;
      return [toSrgb(clamp01(r)) * 255, toSrgb(clamp01(g)) * 255, toSrgb(clamp01(bl)) * 255];
    };
    const parseColor = (value) => {
      if (!value) return null;
      if (value.startsWith('#')) {
        const hex = value.slice(1);
        if (hex.length === 6) return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
        return null;
      }
      if (value.startsWith('rgb')) {
        const parts = parseNumericList(value, '(', ')');
        if (!parts || parts.length < 3) return null;
        return parts.slice(0, 3);
      }
      if (value.startsWith('oklab')) {
        const parts = parseNumericList(value, '(', ')');
        if (!parts || parts.length < 3) return null;
        return oklabToRgb(parts[0], parts[1], parts[2]);
      }
      if (value.startsWith('color')) {
        const parts = parseNumericList(value, '(', ')');
        if (!parts || parts.length < 3) return null;
        return parts.slice(0, 3).map((part) => clamp01(part) * 255);
      }
      return null;
    };
    const relativeLuminance = (rgb) => {
      const [r, g, b] = rgb.map((value) => {
        const channel = value / 255;
        return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const backgroundOf = (el) => {
      let node = el;
      while (node && node !== document.documentElement) {
        const style = getComputedStyle(node).backgroundColor;
        const rgb = parseColor(style);
        if (rgb) {
          const start = style.indexOf('(');
          const end = style.indexOf(')', start + 1);
          const parts = start >= 0 && end > start ? style.slice(start + 1, end).split(',') : [];
          const alpha = parts.length >= 4 ? Number(parts[3]) : 1;
          if (alpha > 0.05) return rgb;
        }
        node = node.parentElement;
      }
      return parseColor(getComputedStyle(document.body).backgroundColor) ?? [255, 255, 255];
    };
    const contrastPair = (name, selector, kind, property = 'color') => {
      const el = shell.querySelector(selector);
      if (!el) return { name, selector, kind, status: 'missing' };
      const fg = parseColor(getComputedStyle(el)[property]);
      const bg = backgroundOf(el);
      if (!fg || !bg) return { name, selector, kind, status: 'missing' };
      const ratio = (Math.max(relativeLuminance(fg), relativeLuminance(bg)) + 0.05) / (Math.min(relativeLuminance(fg), relativeLuminance(bg)) + 0.05);
      return { name, selector, kind, fg, bg, ratio: Number(ratio.toFixed(2)), status: 'sampled' };
    };
    const contrastPairs = [
      contrastPair('node.title', '.px-node-title', 'text'),
      contrastPair('node.sub', '.px-node-sub', 'text'),
      contrastPair('node.chip', '.px-node-chip', 'text'),
      contrastPair('lane.label', '.px-lane-label', 'text'),
      contrastPair('runbar.text', '.px-runbar', 'text'),
      contrastPair('inspector.body', '.px-inspector-body', 'text'),
      contrastPair('primary.text', '.px-btn.primary, [data-testid=\"primary\"]', 'text'),
      contrastPair('node.glyph', '.px-node-glyph', 'nonText'),
      contrastPair('node.chipBorder', '.px-node-chip', 'nonText', 'borderTopColor'),
    ];
    const sampledText = contrastPairs.filter((pair) => pair.status === 'sampled' && pair.kind === 'text');
    const sampledNonText = contrastPairs.filter((pair) => pair.status === 'sampled' && pair.kind === 'nonText');
    const contrastTextMin = sampledText.length ? Math.min(...sampledText.map((pair) => pair.ratio)) : null;
    const contrastNonTextMin = sampledNonText.length ? Math.min(...sampledNonText.map((pair) => pair.ratio)) : null;
    const fontSizes = [...shell.querySelectorAll('.px-node-title, .px-node-sub, .px-node-foot, .px-node-chip, .px-lane-label, .px-chip, .px-btn')]
      .map((el) => Number.parseFloat(getComputedStyle(el).fontSize))
      .filter((value) => Number.isFinite(value) && value > 0);
    const fontSizeMinRaw = fontSizes.length ? Math.min(...fontSizes) : null;
    const scale = Number.isFinite(worldScale) ? worldScale : 1;
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
      contrastPairs,
      contrast: {
        textMin: contrastTextMin,
        nonTextMin: contrastNonTextMin,
        textStatus: sampledText.length ? 'sampled' : '未测',
        nonTextStatus: sampledNonText.length ? 'sampled' : '未测',
        violations: [
          ...sampledText.filter((pair) => pair.ratio < 4.5).map((pair) => ({ pair: pair.name, ratio: pair.ratio, min: 4.5 })),
          ...sampledNonText.filter((pair) => pair.ratio < 3).map((pair) => ({ pair: pair.name, ratio: pair.ratio, min: 3 })),
        ],
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
  for (const item of metrics.contrast?.violations ?? []) {
    if (item.min === 4.5 && (threshold.contrastTextMin ?? 0) > 0) {
      violations.push({ metric: 'contrastText', pair: item.pair, expected: item.min, actual: item.ratio });
    }
    if (item.min === 3 && (threshold.contrastNonTextMin ?? 0) > 0) {
      violations.push({ metric: 'contrastNonText', pair: item.pair, expected: item.min, actual: item.ratio });
    }
  }
  return violations;
}

export default collectMetrics;
