import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { CDP } from '../../../tools/evidence/cdp.mjs';
import { COMPAT_THRESHOLDS, METRIC_THRESHOLDS, checkMetrics, collectMetrics } from '../../../tools/evidence/metrics.mjs';

/**
 * 浏览器验收门槛（10-v2-contract.md §5.6 / §6 / D2、D5、D6）。
 *
 * - 用真实本地 Chrome + CDP 驱动，不用 npm 依赖（A2）。
 * - 独立的 Chrome profile 与测试实例 statePath（/tmp/praxis-acceptance，A1）。
 * - 3081 不可达 / 缺 token / 缺 chrome 时 **skip 并打印原因**，不允许静默通过。
 * - 每条断言带场景名；失败输出实际值（A3）。
 */

const BASE_URL = process.env.PRAXIS_BASE_URL ?? 'http://127.0.0.1:3081';
const CHROME = process.env.CHROME_PATH ?? '/usr/bin/google-chrome';
const PROFILE_DIR = `${process.env.PRAXIS_PROFILE_DIR ?? '/tmp/praxis-acceptance/chrome-profile-browser'}-${process.pid}`;
const LOG_CANDIDATES = [
  process.env.PRAXIS_SERVER_LOG,
  '/tmp/praxis-3081.log',
  '/tmp/praxis-acceptance/server-3081.log',
  '/tmp/praxis-acceptance/server-3082-manual.log',
].filter(Boolean);

function parseTokenFromLogs() {
  if (process.env.PRAXIS_TOKEN) return process.env.PRAXIS_TOKEN;
  for (const path of LOG_CANDIDATES) {
    if (!existsSync(path)) continue;
    const match = /token=([A-Za-z0-9_-]+)/.exec(readFileSync(path, 'utf8'));
    if (match) return match[1];
  }
  return null;
}

async function probe(baseUrl, token) {
  const url = new URL('/praxis/api/state', baseUrl);
  if (token) url.searchParams.set('token', token);
  try {
    const response = await fetch(url, { headers: { 'x-praxis-request': '1' } });
    return { status: response.status };
  } catch (error) {
    return { status: 0, error: error instanceof Error ? error.message : String(error) };
  }
}

let browser = null;
let token = null;
let baseState = null;
let setupError = null;

before(async () => {
  if (!existsSync(CHROME)) {
    setupError = `Chrome not found at ${CHROME}; browser acceptance cannot run`;
    return;
  }
  token = parseTokenFromLogs();
  const reachable = await probe(BASE_URL, null);
  if (reachable.status === 0) {
    setupError = `Praxis test instance unreachable at ${BASE_URL} (${reachable.error ?? 'connection failed'}); start it with: dsh web --patch /tmp/praxis-test-patch.yml --port 3081 --no-open`;
    return;
  }
  if (!token) {
    setupError = `no browser token: set PRAXIS_TOKEN or PRAXIS_SERVER_LOG (test instance ${BASE_URL} requires ?token=...)`;
    return;
  }
  try {
    browser = await CDP.launch({ chromePath: CHROME, userDataDir: PROFILE_DIR, viewport: { width: 1440, height: 1000 } });
    await browser.navigate(`${BASE_URL}/?token=${token}`);
    await browser.waitFor('document.readyState === "complete"', { timeout: 30000, label: 'document ready' });
    if (!(await browser.evaluate('!!document.querySelector(".px-shell")'))) {
      await browser.clickText('Praxis', { selector: 'button, a, [role="button"], li, div', timeout: 10000 });
      await browser.waitFor('!!document.querySelector(".px-shell")', { timeout: 30000, label: 'Praxis panel mounted' });
    }
    const state = await browser.api('/praxis/api/state');
    if (state.status !== 200) throw new Error(`browser API /state failed: ${state.status}`);
    baseState = state.json;
  } catch (error) {
    setupError = `browser setup failed: ${error instanceof Error ? error.message : String(error)}`;
    if (browser) {
      try { await browser.close(); } catch {}
      browser = null;
    }
  }
});

after(async () => {
  if (browser) {
    try { await browser.close(); } catch {}
    browser = null;
  }
});

function requireReady(t) {
  if (setupError) {
    t.skip(setupError);
    return false;
  }
  return true;
}

async function seedRun(scenario = 'frozen') {
  const start = await browser.api('/praxis/api/command', {
    method: 'POST',
    body: { command: { commandId: `accept-${Date.now()}-start`, action: 'start', payload: { playbookId: 'scientific-loop', title: `验收 ${scenario}` } } },
  });
  assert.equal(start.status, 200, `scenario ${scenario}: start status ${start.status}`);
  const runId = start.json.receipt.runId;
  const question = await browser.api('/praxis/api/command', {
    method: 'POST',
    body: {
      command: {
        commandId: `accept-${Date.now()}-q`,
        action: 'question',
        runId,
        payload: { question: { text: '未知结构能否被主动提取？', hypothesis: '存在可分离结构', unknowns: ['噪声上限'] } },
      },
    },
  });
  assert.equal(question.status, 200, `scenario ${scenario}: question status ${question.status}`);
  if (scenario === 'fresh') return { runId, expected: 'QUESTION' };
  const freeze = await browser.api('/praxis/api/command', {
    method: 'POST',
    body: {
      command: {
        commandId: `accept-${Date.now()}-freeze`,
        action: 'prereg_freeze',
        runId,
        payload: {
          prereg: {
            question: '未知结构能否被主动提取？',
            prediction: '分离度高于基线 0.08',
            acceptance: '主指标超过基线且对照被破坏',
            acceptableFailure: '对照未破坏则接受无效',
            controls: ['shuffle'],
            metrics: { primary: 'separation', threshold: 0.08 },
            input: { source: 'corpus' },
            budget: { wallMin: 30 },
            stop: { sameConclusion: 2 },
          },
        },
      },
    },
  });
  assert.equal(freeze.status, 200, `scenario ${scenario}: prereg_freeze status ${freeze.status}`);
  return { runId, expected: 'PREREG_FROZEN' };
}

async function refreshPraxis() {
  await browser.evaluate(`(async () => {
    const response = await fetch('/praxis/api/state', { headers: { 'x-praxis-request': '1' } });
    return response.ok;
  })()`);
  // 客户端是 4s 轮询；等待其拉取到最新快照。
  await browser.waitFor(`(() => {
    const chip = document.querySelector('[class*="px-chip"], .px-runbar, [class*="px-run"]');
    return !!chip;
  })()`, { timeout: 15000, label: 'run bar' }).catch(() => null);
  await new Promise((resolve) => setTimeout(resolve, 4200));
}

async function dragCanvas(dx = 60, dy = 0) {
  const before = await browser.evaluate(`getComputedStyle(document.querySelector('.px-canvas-world')).transform`);
  const point = await browser.evaluate(`(() => {
    const canvas = document.querySelector('.px-canvas');
    const rect = canvas.getBoundingClientRect();
    return { x: rect.left + 40, y: rect.top + rect.height - 40 };
  })()`);
  await browser.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: point.x, y: point.y, button: 'left', buttons: 1, clickCount: 1 });
  await browser.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: point.x + dx, y: point.y + dy, button: 'left', buttons: 1 });
  await browser.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: point.x + dx, y: point.y + dy, button: 'left', buttons: 0, clickCount: 1 });
  await new Promise((resolve) => setTimeout(resolve, 300));
  const after = await browser.evaluate(`getComputedStyle(document.querySelector('.px-canvas-world')).transform`);
  return { before, after, changed: before !== after };
}

test('browser §5.7 @1440×1000: 15/15 可见、内容占比 ≥35%、唯一主按钮、0 内部码、0 破坏性控件、无横向溢出', async (t) => {
  if (!requireReady(t)) return;
  await seedRun('frozen');
  await refreshPraxis();
  const metrics = await collectMetrics(browser);
  const violations = checkMetrics(metrics);
  assert.equal(metrics.nodeTotal, 15, `scenario=1440x1000-run 节点总数 actual=${metrics.nodeTotal}`);
  assert.equal(metrics.nodeVisible, metrics.nodeTotal, `scenario=1440x1000-run 可见节点 actual=${metrics.nodeVisible}/${metrics.nodeTotal}`);
  assert.equal(metrics.internalCodeCount, 0, `scenario=1440x1000-run 内部码 actual=${metrics.internalCodeCount}`);
  assert.equal(metrics.destructiveControlCount, 0, `scenario=1440x1000-run 破坏性控件 actual=${metrics.destructiveControlCount}`);
  assert.equal(metrics.horizontalOverflow, 0, `scenario=1440x1000-run 横向溢出 actual=${metrics.horizontalOverflow}`);
  assert.deepEqual(
    violations,
    [],
    `scenario=1440x1000-run actual=${JSON.stringify(metrics)} violations=${JSON.stringify(violations)}`,
  );
  t.diagnostic(`§5.7 1440 metrics=${JSON.stringify({ bboxW: metrics.bboxWidthRatio, bboxH: metrics.bboxHeightRatio, area: metrics.bboxAreaRatio, fontSizeMin: metrics.fontSizeMin, contrast: metrics.contrast })}`);
  if (metrics.contrast?.status === 'sampled' && metrics.contrast.text !== null) {
    assert.ok(metrics.contrast.text >= 4.5, `scenario=1440-contrast 正文对比度 actual=${metrics.contrast.text}`);
    assert.ok(metrics.contrast.nonText === null || metrics.contrast.nonText >= 3.0, `scenario=1440-contrast 非文本 actual=${metrics.contrast.nonText}`);
  }
});

test('browser D5-1 @1024×900（全应用 compat）: 15/15、页面/根溢出 0、viewport-hint、可拖拽', async (t) => {
  if (!requireReady(t)) return;
  browser.consoleErrors.length = 0;
  await browser.setViewport({ width: 1024, height: 900 });
  await new Promise((resolve) => setTimeout(resolve, 600));
  const metrics = await collectMetrics(browser);
  assert.equal(metrics.available, true, `scenario=1024x900 actual=${JSON.stringify(metrics)}`);
  assert.equal(metrics.horizontalOverflow, 0, `scenario=1024x900 页面横向溢出 actual=${metrics.horizontalOverflow}`);
  assert.equal(metrics.shellOverflow, 0, `scenario=1024x900 根横向溢出 actual=${metrics.shellOverflow}`);
  assert.equal(metrics.nodeVisible, metrics.nodeTotal, `scenario=1024x900 可见节点 actual=${metrics.nodeVisible}/${metrics.nodeTotal}`);
  if (metrics.worldScale !== null && metrics.worldScale < 0.75) {
    assert.equal(metrics.viewportHint, true, `scenario=1024x900 worldScale=${metrics.worldScale} 但缺少 viewport-hint`);
  }
  const drag = await dragCanvas();
  assert.equal(drag.changed, true, `scenario=1024x900 画布不可拖拽 transform=${JSON.stringify(drag)}`);
  assert.deepEqual(browser.consoleErrors, [], `scenario=1024x900 控制台错误 actual=${JSON.stringify(browser.consoleErrors)}`);
  t.diagnostic(`1024 compat metrics=${JSON.stringify({ worldScale: metrics.worldScale, viewportHint: metrics.viewportHint })}`);
  await browser.setViewport({ width: 1440, height: 1000 });
});

test('browser D5-1 @700×600（compat）: 15/15、viewport-hint、可拖拽', async (t) => {
  if (!requireReady(t)) return;
  await browser.setViewport({ width: 700, height: 600 });
  await new Promise((resolve) => setTimeout(resolve, 600));
  const metrics = await collectMetrics(browser);
  assert.equal(metrics.available, true, `scenario=700x600 actual=${JSON.stringify(metrics)}`);
  assert.equal(metrics.nodeVisible, metrics.nodeTotal, `scenario=700x600 可见节点 actual=${metrics.nodeVisible}/${metrics.nodeTotal}`);
  assert.equal(metrics.viewportHint, true, `scenario=700x600 缺少 viewport-hint`);
  const drag = await dragCanvas(40, 20);
  assert.equal(drag.changed, true, `scenario=700x600 画布不可拖拽 transform=${JSON.stringify(drag)}`);
  await browser.setViewport({ width: 1440, height: 1000 });
});

test('browser §5.2: 节点正文只显示人类可读状态，不出现内部码', async (t) => {
  if (!requireReady(t)) return;
  const text = await browser.evaluate('document.querySelector(".px-shell")?.innerText ?? ""');
  const internal = /prereg_freeze|gate:prereg|close-or-new-run|INVALID_TRANSITION|QUESTION_REQUIRED|REVISION_REQUIRED|PROTECTED_NODE/.test(text);
  assert.equal(internal, false, `scenario=node-text 出现内部码；actual text=${text.slice(0, 300)}`);
  const readable = /等待|进行中|已完成|被阻断|需核对|契约已冻结|契约缺失|继承待确认/.test(text);
  assert.equal(readable, true, `scenario=node-text 缺少人类可读状态；actual text=${text.slice(0, 300)}`);
});

test('browser §5.2/T2.1: 冻结后 prereg gate 显示契约已冻结而非 1/11 倒挂', async (t) => {
  if (!requireReady(t)) return;
  await refreshPraxis();
  const view = (await browser.api('/praxis/api/state')).json;
  const graph = view.view?.graph ?? view.graph;
  assert.ok(graph, 'scenario=truthful-projection: view.graph missing');
  for (const [id, state] of Object.entries(graph.states)) {
    if (state.execution === 'done') {
      // 执行轴 done 的节点，其前驱必须 done（I1 的 UI 投影）。
      const node = graph.nodes.find((item) => item.id === id);
      const preds = graph.edges.filter((edge) => edge.to === id).map((edge) => edge.from);
      for (const pred of preds) {
        assert.equal(
          graph.states[pred].execution,
          'done',
          `scenario=truthful-projection node=${node?.label ?? id} done 但前驱 ${pred}=${graph.states[pred].execution}`,
        );
      }
    }
  }
  const shellText = await browser.evaluate('document.querySelector(".px-shell")?.innerText ?? ""');
  assert.ok(
    /契约已冻结|已完成/.test(shellText),
    `scenario=truthful-projection 冻结态未显示契约已冻结/已完成；actual=${shellText.slice(0, 200)}`,
  );
});

test('browser §5.4/D6: 运行模态主按钮唯一，且无拓扑破坏控件', async (t) => {
  if (!requireReady(t)) return;
  const metrics = await collectMetrics(browser);
  assert.equal(metrics.primaryCount, 1, `scenario=run-mode-primary actual=${metrics.primaryCount}`);
  assert.equal(metrics.destructiveControlCount, 0, `scenario=run-mode-destructive actual=${metrics.destructiveControlCount}`);
});

test('browser §5.3/D5: 暗色主题由独立 dark 实例验证（同实例不可切换）', async (t) => {
  if (!requireReady(t)) return;
  const requestedTheme = process.env.PRAXIS_THEME ?? 'light';
  const source = await browser.evaluate('document.documentElement.getAttribute("data-ds-theme-source")');
  if (requestedTheme !== 'dark') {
    assert.equal(source, 'light', `scenario=theme-light actual=${source}`);
    t.skip('需要独立暗色实例：用 capture.mjs --theme dark --manage-server（patch ui-theme.preference=dark）生成证据，再以 PRAXIS_THEME=dark 跑本用例');
    return;
  }
  assert.equal(source, 'dark', `scenario=theme-dark actual=${source}；独立暗色实例未生效`);
});
