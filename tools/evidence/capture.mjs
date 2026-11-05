#!/usr/bin/env node
/**
 * Evidence capture for Praxis v2 (contract: 10-v2-contract.md §6 / D3).
 *
 * Starts (or reuses) a dedicated DSH web test instance on a non-3080 port with an
 * isolated `statePath` under /tmp/praxis-acceptance, drives it with local Chrome
 * over CDP, captures screenshots, computes §5.6 metrics and writes
 * docs/praxis/evidence/manifest.json with provenance:
 *   sha256 / build hash / git commit / package+node version / port / token URL /
 *   viewport / theme / scenario / time.
 *
 * No npm dependencies. Never touches ~/.dsh/praxis/state.json or port 3080.
 *
 * Usage:
 *   node tools/evidence/capture.mjs                       # reuse 3081 if up (light)
 *   node tools/evidence/capture.mjs --port 3081 --manage-server
 *   node tools/evidence/capture.mjs --theme dark --manage-server
 *   node tools/evidence/capture.mjs --scenario fresh,frozen,blocked
 *   node tools/evidence/capture.mjs --reuse --token <token> --out /tmp/shots
 */
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:net';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { CDP } from './cdp.mjs';
import { buildDefaultGraph } from '../../plugins/dsh-praxis/src/graph.js';
import { PLAYBOOKS } from '../../plugins/dsh-praxis/src/engine.js';
import { COMPAT_THRESHOLDS, METRIC_THRESHOLDS, checkMetrics, collectMetrics } from './metrics.mjs';

const ROOT = resolve(import.meta.dirname, '../..');
const PLUGIN = join(ROOT, 'plugins/dsh-praxis');
const EVIDENCE_DIR = join(ROOT, 'docs/praxis/evidence');
const MANIFEST_PATH = join(EVIDENCE_DIR, 'manifest.json');
const DEFAULT_STATE_PATH = '/tmp/praxis-acceptance/state.json';
const DEFAULT_PROFILE = '/tmp/praxis-acceptance/chrome-profile';

function parseArgs(argv) {
  const options = {
    port: 0, // 0 = pick a free port; capture owns its instance (never assume 3081)
    host: '127.0.0.1',
    reuse: false,
    manageServer: true,
    token: process.env.PRAXIS_TOKEN ?? null,
    statePath: join('/tmp/praxis-acceptance', `state-capture-${process.pid}.json`),
    profileDir: join('/tmp/praxis-acceptance', `chrome-profile-capture-${process.pid}`),
    outDir: join(ROOT, 'docs/praxis/screenshots/v2'),
    manifest: MANIFEST_PATH,
    scenarios: ['empty', 'frozen'],
    theme: 'light',
    viewport: '1440x1000',
    serverLog: null,
    chrome: process.env.CHROME_PATH ?? '/usr/bin/google-chrome',
    timeoutMs: 45000,
    skipBuildCheck: false,
    restart: false,
    keepServer: false,
    buildChecked: false,
    v4: false,
    v4OutDir: join(ROOT, 'docs/praxis/screenshots/v4'),
    v4Manifest: join(EVIDENCE_DIR, 'manifest-v4.json'),
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const value = () => argv[i + 1];
    if (arg === '--port') { options.port = Number(value()); i += 1; }
    else if (arg === '--host') { options.host = value(); i += 1; }
    else if (arg === '--reuse') options.reuse = true;
    else if (arg === '--manage-server') options.manageServer = true;
    else if (arg === '--token') { options.token = value(); i += 1; }
    else if (arg === '--state-path') { options.statePath = resolve(value()); i += 1; }
    else if (arg === '--profile-dir') { options.profileDir = resolve(value()); i += 1; }
    else if (arg === '--out') { options.outDir = resolve(value()); i += 1; }
    else if (arg === '--manifest') { options.manifest = resolve(value()); i += 1; }
    else if (arg === '--scenario') { options.scenarios = value().split(',').map((item) => item.trim()).filter(Boolean); i += 1; }
    else if (arg === '--theme') { options.theme = value(); i += 1; }
    else if (arg === '--viewport') { options.viewport = value(); i += 1; }
    else if (arg === '--server-log') { options.serverLog = resolve(value()); i += 1; }
    else if (arg === '--chrome') { options.chrome = value(); i += 1; }
    else if (arg === '--skip-build-check') options.skipBuildCheck = true;
    else if (arg === '--restart') options.restart = true;
    else if (arg === '--keep-server') options.keepServer = true;
    else if (arg === '--all') options.all = true;
    else if (arg === '--v4') options.v4 = true;
    else if (arg === '--help') { options.help = true; }
  }
  return options;
}

function sha256File(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function gitCommit() {
  try {
    const result = spawnSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: ROOT, encoding: 'utf8' });
    return result.status === 0 ? result.stdout.trim() : null;
  } catch {
    return null;
  }
}

function packageVersion() {
  try {
    return JSON.parse(readFileSync(join(PLUGIN, 'package.json'), 'utf8')).version ?? null;
  } catch {
    return null;
  }
}

function parseToken(logText) {
  const match = /token=([A-Za-z0-9_-]+)/.exec(logText ?? '');
  return match ? match[1] : null;
}

async function probeState(baseUrl, token) {
  const url = new URL('/praxis/api/state', baseUrl);
  if (token) url.searchParams.set('token', token);
  try {
    const response = await fetch(url, { headers: { 'x-praxis-request': '1' } });
    let json = null;
    try { json = await response.json(); } catch {}
    return { status: response.status, json };
  } catch (error) {
    return { status: 0, error: error instanceof Error ? error.message : String(error) };
  }
}

async function waitForServer(baseUrl, token, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const probe = await probeState(baseUrl, token);
    if (probe.status === 200 || probe.status === 403) return probe;
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 250));
  }
  return { status: 0, error: 'server did not become ready' };
}

async function pickFreePort() {
  return new Promise((resolvePromise, reject) => {
    const server = createServer();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolvePromise(port));
    });
  });
}

function startServer(options, logPath) {
  const patchDir = '/tmp/praxis-acceptance';
  mkdirSync(patchDir, { recursive: true });
  mkdirSync(dirname(options.statePath), { recursive: true });
  const patchPath = join(patchDir, `patch-${options.port}.yml`);
  const lines = ['- id: praxis', `  config: { statePath: ${options.statePath} }`];
  if (options.theme === 'dark') {
    // 主题偏好保存在 Host user-settings；隔离实例可通过 ui-theme patch 覆盖（若插件 id 匹配）。
    lines.push('- id: ui-theme', '  config: { preference: dark }');
  }
  writeFileSync(patchPath, `${lines.join('\n')}\n`);
  const dshBin = process.env.DSH_BIN ?? 'dsh';
  const args = ['web', '--patch', patchPath, '--port', String(options.port), '--no-open'];
  const child = spawn(dshBin, args, {
    cwd: ROOT,
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const chunks = [];
  child.stdout.on('data', (data) => chunks.push(String(data)));
  child.stderr.on('data', (data) => chunks.push(String(data)));
  child.on('error', () => {});
  child.unref();
  return {
    child,
    args,
    patchPath,
    getLog: () => chunks.join(''),
    stop: () => {
      try { process.kill(-child.pid, 'SIGTERM'); } catch { try { child.kill('SIGTERM'); } catch {} }
    },
  };
}

async function waitForLogToken(server, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const token = parseToken(server.getLog());
    if (token) return token;
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 200));
  }
  return null;
}

async function openPraxis(browser, timeoutMs) {
  await browser.waitFor('document.readyState === "complete"', { timeout: timeoutMs, label: 'document ready' });
  if (await browser.evaluate('!!document.querySelector(".px-shell")')) return;
  const clicks = ['Praxis'];
  for (const text of clicks) {
    try {
      await browser.clickText(text, { timeout: Math.min(8000, timeoutMs) });
      await browser.waitFor('!!document.querySelector(".px-shell")', { timeout: timeoutMs, label: 'px-shell after sidebar click' });
      return;
    } catch {
      // try next strategy
    }
  }
  throw new Error('Praxis panel did not mount (.px-shell missing) after sidebar click');
}

async function ensurePraxis(browser, timeoutMs) {
  if (await browser.evaluate('!!document.querySelector(".px-shell")')) return;
  await openPraxis(browser, timeoutMs);
}

async function seedScenario(browser, scenario, stateResponse) {
  const command = async (action, payload = {}, runId = undefined) => {
    const response = await browser.api('/praxis/api/command', {
      method: 'POST',
      body: { command: { commandId: `evidence-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, action, runId, payload } },
    });
    return response;
  };
  const start = async (title) => {
    const response = await command('start', { playbookId: 'scientific-loop', title });
    if (response.status !== 200) throw new Error(`start failed: ${response.status} ${JSON.stringify(response.json)}`);
    return response.json.receipt.runId;
  };
  const question = (runId) => command('question', {
    question: { text: '未知结构能否从声明语料中被主动提取？', hypothesis: '冻结基线之上存在可分离结构', unknowns: ['噪声上限'] },
  }, runId);
  if (scenario === 'empty') {
    const runs = stateResponse?.json?.view?.runs ?? stateResponse?.json?.runs ?? [];
    if (runs.length > 0) return { status: 'unavailable', reason: `state already has ${runs.length} runs; empty scenario needs a fresh statePath` };
    return { status: 'seeded', note: 'no run (empty state)' };
  }
  const runId = await start(`证据截图 · ${scenario}`);
  if (scenario === 'fresh') return { status: 'seeded', runId, expected: 'INTAKE' };
  const asked = await question(runId);
  if (asked.status !== 200) throw new Error(`question failed: ${asked.status} ${JSON.stringify(asked.json)}`);
  if (scenario === 'blocked') return { status: 'seeded', runId, expected: 'QUESTION' };
  if (scenario === 'frozen') {
    const prereg = {
      question: '未知结构能否从声明语料中被主动提取？',
      prediction: 'held-out 分离度高于基线 0.08',
      acceptance: '主指标超过基线且对照被破坏',
      acceptableFailure: '若对照未被破坏，接受该表示无效',
      controls: ['shuffle', 'label-shuffle'],
      metrics: { primary: 'separation', threshold: 0.08, seeds: 3 },
      input: { source: 'declared-corpus', split: 'train', evalSplit: 'held-out' },
      budget: { wallMin: 30, agents: 4 },
      stop: { sameConclusion: 2 },
    };
    const frozen = await command('prereg_freeze', { prereg }, runId);
    if (frozen.status !== 200) throw new Error(`prereg_freeze failed: ${frozen.status} ${JSON.stringify(frozen.json)}`);
    return { status: 'seeded', runId, expected: 'PREREG_FROZEN' };
  }
  throw new Error(`unknown scenario ${scenario}`);
}

async function applyTheme(browser, theme) {
  if (theme !== 'dark') {
    const source = await browser.evaluate('document.documentElement.getAttribute("data-ds-theme-source")');
    return { requested: theme, applied: source !== 'dark', mechanism: 'host default' };
  }
  await browser.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'dark' }] });
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 400));
  const state = await browser.evaluate(`(() => ({
    source: document.documentElement.getAttribute('data-ds-theme-source'),
    dark: document.body.hasAttribute('data-ds-dark') || document.documentElement.classList.contains('dark'),
    bg: getComputedStyle(document.body).backgroundColor,
  }))()`);
  const rgb = /rgba?\(([^)]+)\)/.exec(state.bg ?? '');
  const values = rgb ? rgb[1].split(',').map((part) => Number(part.trim())) : [];
  const luminance = values.length >= 3 ? (values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722) / 255 : 1;
  const applied = state.dark || state.source === 'dark' || luminance < 0.5;
  return {
    requested: theme,
    applied,
    mechanism: applied ? 'CDP Emulation.setEmulatedMedia + host theme source' : 'host user-settings theme is not switchable over CDP; start a managed instance with a dark ui-theme patch',
  };
}

function splitViolations(metrics, expectedMetrics, scenario) {
  const all = checkMetrics(metrics, expectedMetrics ?? {});
  const expected = [];
  const unexpected = [];
  for (const violation of all) {
    const isExpected =
      (!metrics.available && /^loading/.test(String(scenario)))
      || (/^map:/.test(String(scenario)) && violation.metric === 'primaryCount')
      || (expectedMetrics?.allowUnavailable && violation.metric === 'available')
      || (/^drawer:/.test(String(scenario)) && violation.metric === 'primaryCount');
    const reason = /^loading/.test(String(scenario))
      ? 'loading 无 .px-shell 是预期'
      : /^drawer:/.test(String(scenario)) && violation.metric === 'primaryCount'
        ? 'B-V03 抽屉规则：drawer primary 不计'
        : /^map:/.test(String(scenario)) && violation.metric === 'primaryCount'
          ? 'B-V03 地图规则：drawer 内 primary 不计'
          : '允许不可用';
    if (isExpected) expected.push({ ...violation, reason });
    else unexpected.push(violation);
  }
  return { expected, unexpected };
}

function registerShot(manifest, { file, viewport, theme, scenario, metrics, themeApplied, note, expectedMetrics = null, sceneMetrics = null }) {
  const absolute = resolve(file);
  const relativePath = relative(ROOT, absolute);
  const sha256 = sha256File(absolute);
  const entry = {
    file: relativePath,
    sha256,
    viewport,
    theme,
    themeApplied,
    scenario,
    capturedAt: new Date().toISOString(),
    metrics,
    sceneMetrics,
    ...(() => {
      const split = splitViolations(metrics, expectedMetrics, scenario);
      const violations = [...split.unexpected];
      if (sceneMetrics && Number.isFinite(sceneMetrics.selectedOverlapArea) && sceneMetrics.selectedOverlapArea > 0.5 && expectedMetrics?.enforceOverlap) {
        violations.push({ metric: 'selectedOverlap', expected: 0, actual: sceneMetrics.selectedOverlapArea, selected: sceneMetrics.selectedNodeId });
      }
      return { violations, expectedViolations: split.expected };
    })(),
    note: note ?? null,
  };
  manifest.screenshots = [...(manifest.screenshots ?? []).filter((item) => item.file !== relativePath), entry];
  return entry;
}

async function collectSceneMetrics(browser, selectedNodeId = null) {
  return browser.evaluate(`(() => {
    const shell = document.querySelector('.px-shell');
    const runbar = document.querySelector('.px-runbar');
    const runbarText = runbar ? runbar.innerText : '';
    const progressLine = runbarText.split('\\n').map((line) => line.trim()).find((line) => line.length <= 8 && line.includes('/'));
    const progressParts = progressLine ? progressLine.split('/').map((value) => Number(value)) : [];
    const world = document.querySelector('.px-canvas-world[data-testid="world"]') ?? document.querySelector('.px-canvas-world');
    const targetNodeId = ${JSON.stringify(selectedNodeId)};
    const selectedNode = (targetNodeId ? document.querySelector('[data-node-id="' + targetNodeId + '"]') : null)
      ?? document.querySelector('[data-node-id][data-current="true"]')
      ?? document.querySelector('[data-current="true"]');
    const inspector = document.querySelector('.px-inspector');
    let selectedRect = null;
    let inspectorRect = null;
    let intersectionArea = 0;
    if (selectedNode) {
      const r = selectedNode.getBoundingClientRect();
      selectedRect = { x: r.x, y: r.y, w: r.width, h: r.height };
    }
    if (inspector) {
      const r = inspector.getBoundingClientRect();
      inspectorRect = { x: r.x, y: r.y, w: r.width, h: r.height };
    }
    if (selectedRect && inspectorRect) {
      const overlapW = Math.max(0, Math.min(selectedRect.x + selectedRect.w, inspectorRect.x + inspectorRect.w) - Math.max(selectedRect.x, inspectorRect.x));
      const overlapH = Math.max(0, Math.min(selectedRect.y + selectedRect.h, inspectorRect.y + inspectorRect.h) - Math.max(selectedRect.y, inspectorRect.y));
      intersectionArea = Number((overlapW * overlapH).toFixed(2));
    }
    return {
      shellScene: shell ? shell.getAttribute('data-scene') : null,
      shellMode: shell ? shell.getAttribute('data-mode') : null,
      runbarText: runbarText.slice(0, 200),
      progress: progressLine || null,
      progressDone: progressParts.length === 2 ? progressParts[0] : null,
      progressTotal: progressParts.length === 2 ? progressParts[1] : null,
      worldScale: world ? world.getAttribute('data-scale') : null,
      selectedNodeId: selectedNode ? selectedNode.getAttribute('data-node-id') : null,
      selectedRect,
      inspectorRect,
      selectedOverlapArea: intersectionArea,
      inspectorVisible: !!inspector,
      bannerText: (() => { const banner = document.querySelector('[data-testid="banner"]'); return banner ? banner.innerText.slice(0, 300) : ''; })(),
      bannerButtons: (() => { const banner = document.querySelector('[data-testid="banner"]'); return banner ? [...banner.querySelectorAll('button')].map((button) => (button.textContent || '').trim()).slice(0, 6) : []; })(),
      retryVisible: [...document.querySelectorAll('button')].some((button) => /重试/.test(button.textContent || '')),
      errorText: shell && shell.getAttribute('data-scene') === 'error' ? shell.innerText.slice(0, 300) : null,
      primaryDisabled: (() => {
        const primary = document.querySelector('[data-testid="primary"]');
        if (!primary) return null;
        return Boolean(primary.disabled || primary.getAttribute('aria-disabled') === 'true');
      })(),
      graphNodeCount: document.querySelectorAll('.px-node').length,
      skeletonVisible: (() => {
        const skeleton = document.querySelector('.px-skeleton');
        if (!skeleton) return false;
        const rect = skeleton.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      })(),
      skeletonRowHeight: (() => {
        const row = document.querySelector('.px-skeleton-row');
        return row ? Number(row.getBoundingClientRect().height.toFixed(1)) : null;
      })(),
      loadingHintText: (() => {
        const hint = document.querySelector('[data-testid="loading-hint"]');
        return hint ? hint.innerText.slice(0, 120) : null;
      })(),
      shellWidth: shell ? Math.round(shell.getBoundingClientRect().width) : null,
      shellHeight: shell ? Math.round(shell.getBoundingClientRect().height) : null,
      nodeOverlapArea: (() => {
        const rects = [...document.querySelectorAll('.px-node')].map((node) => node.getBoundingClientRect());
        let area = 0;
        for (let i = 0; i < rects.length; i += 1) {
          for (let j = i + 1; j < rects.length; j += 1) {
            const w = Math.max(0, Math.min(rects[i].right, rects[j].right) - Math.max(rects[i].left, rects[j].left));
            const h = Math.max(0, Math.min(rects[i].bottom, rects[j].bottom) - Math.max(rects[i].top, rects[j].top));
            area += w * h;
          }
        }
        return Number(area.toFixed(2));
      })(),
    };
  })()`);
}

async function captureAt(browser, options, target, manifest, context) {
  const { viewport, theme, scenario, name, note } = target;
  const expectedMetrics = target.expectedMetrics ?? null;
  await browser.setViewport(viewport);
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 250));
  const metrics = await collectMetrics(browser);
  const sceneMetrics = await collectSceneMetrics(browser, target.selectedNodeId ?? null);
  const file = join(options.outDir, `${name}.png`);
  await browser.screenshot(file);
  const entry = registerShot(manifest, {
    file,
    viewport: `${viewport.width}x${viewport.height}`,
    theme,
    scenario,
    metrics,
    themeApplied: context.themeApplied,
    note,
    expectedMetrics: target.expectedMetrics ?? null,
    sceneMetrics,
  });
  const violations = entry.violations;
  process.stdout.write(
    `shot ${relative(ROOT, file)} sha256=${entry.sha256.slice(0, 12)} visible=${metrics.available ? `${metrics.nodeVisible}/${metrics.nodeTotal}` : 'n/a'} primary=${metrics.available ? metrics.primaryCount : 'n/a'} violations=${violations.length}\n`,
  );
  if (violations.length > 0) {
    manifest.metricViolations = [...(manifest.metricViolations ?? []), { file: entry.file, violations }];
  }
  if (entry.expectedViolations.length > 0) {
    manifest.expectedViolations = [...(manifest.expectedViolations ?? []), { file: entry.file, violations: entry.expectedViolations }];
  }
  return entry;
}

async function captureV4(options) {
  const v4 = {
    suite: 'v4-cockpit',
    generatedAt: new Date().toISOString(),
    gitCommit: gitCommit(),
    packageVersion: packageVersion(),
    node: process.version,
    buildChecked: false,
    buildHash: null,
    errors: [],
    themes: {},
    screenshots: [],
    required: [],
  };
  const bundle = join(PLUGIN, 'client.js');
  if (existsSync(bundle)) {
    v4.bundleSha256 = sha256File(bundle);
    v4.buildHash = v4.bundleSha256;
  }
  const check = spawnSync(process.execPath, ['plugins/dsh-praxis/build-client.mjs', '--check'], { cwd: ROOT, encoding: 'utf8' });
  v4.buildChecked = check.status === 0;
  if (check.status !== 0) {
    v4.errors.push(`client.js build check failed: ${(check.stdout || check.stderr || '').trim()}`);
  }
  const requiredNames = (theme) => [
    `empty-${theme}-1440x1000.png`,
    `running-${theme}-1440x1000.png`,
    `running-${theme}-1024x900.png`,
    `branch-inspector-${theme}-1440x1000.png`,
    `team-drawer-${theme}-1440x1000.png`,
  ];
  v4.required = ['light', 'dark'].flatMap(requiredNames);
  mkdirSync(options.v4OutDir, { recursive: true });

  for (const theme of ['light', 'dark']) {
    const statePath = join('/tmp/praxis-acceptance', `state-v4-${theme}-${process.pid}.json`);
    try { unlinkSync(statePath); } catch {}
    const themeOptions = {
      ...options,
      port: 0,
      theme,
      statePath,
      profileDir: join('/tmp/praxis-acceptance', `chrome-v4-${theme}-${process.pid}`),
      reuse: false,
      manageServer: true,
      token: null,
      serverLog: null,
    };
    themeOptions.port = await pickFreePort();
    const logPath = join('/tmp/praxis-acceptance', `v4-server-${theme}-${themeOptions.port}.log`);
    const server = startServer(themeOptions, logPath);
    let browser = null;
    const themeEntry = { applied: false, port: themeOptions.port, screenshots: [] };
    try {
      const baseUrl = `http://127.0.0.1:${themeOptions.port}`;
      await waitForServer(baseUrl, null, options.timeoutMs);
      const token = await waitForLogToken(server, options.timeoutMs);
      browser = await CDP.launch({
        chromePath: options.chrome,
        userDataDir: themeOptions.profileDir,
        viewport: { width: 1440, height: 1000 },
        headless: true,
      });
      const tokenUrl = `${baseUrl}/?token=${token}`;
      await browser.navigate(tokenUrl);
      await openPraxis(browser, options.timeoutMs);
      const themeApplied = await applyTheme(browser, theme);
      themeEntry.applied = themeApplied.applied;
      if (!themeApplied.applied) v4.errors.push(`theme ${theme} not applied: ${themeApplied.mechanism}`);

      const snapV4 = async (name, scenario, viewport) => {
        const relativePath = join('docs/praxis/screenshots/v4', `${name}.png`);
        const absolutePath = join(ROOT, relativePath);
        await browser.screenshot(absolutePath);
        const sceneMetrics = await browser.evaluate(`(() => {
          const qa = (selector) => [...document.querySelectorAll(selector)];
          const root = document.documentElement;
          const cards = qa('[data-testid="branch-card"]');
          return {
            branchCards: cards.length,
            visibleCards: cards.filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth; }).length,
            gateRows: qa('[data-testid="gate-row"]').length,
            gateRail: !!document.querySelector('[data-testid="gate-rail"]'),
            evidenceBand: !!document.querySelector('[data-testid="evidence-band"]'),
            primaryCount: qa('[data-testid="primary"]').length,
            teamChip: !!document.querySelector('[data-testid="team-chip"]'),
            teamSource: document.querySelector('[data-testid="team-chip"]')?.getAttribute('data-source') ?? null,
            inspectorVisible: !!document.querySelector('[data-testid="inspector"]'),
            inspectorPrimary: document.querySelector('[data-testid="inspector"]')?.querySelectorAll('[data-testid="primary"]').length ?? null,
            drawerVisible: !!document.querySelector('[data-testid="drawer"]'),
            teamPanelText: document.querySelector('[data-testid="team-panel"]')?.innerText?.slice(0, 200) ?? null,
            progress: document.querySelector('[data-testid="progress"]')?.innerText ?? null,
            nodes: qa('[data-testid="node"]').length,
            ports: qa('.px-port').length,
            horizontalOverflow: root.scrollWidth - root.clientWidth,
          };
        })()`);
        const entry = {
          file: relativePath,
          sha256: sha256File(absolutePath),
          viewport,
          theme,
          scenario,
          capturedAt: new Date().toISOString(),
          sceneMetrics,
        };
        v4.screenshots.push(entry);
        themeEntry.screenshots.push(entry.file);
        process.stdout.write(`v4 shot ${relativePath} sha256=${entry.sha256.slice(0, 12)}
`);
        return entry;
      };

      // 1) empty（全新 statePath，无 Run）
      await snapV4(`empty-${theme}-1440x1000`, 'empty', '1440x1000');

      // 2) seed v4 cockpit 数据
      const seeded = await seedV4(browser);
      themeEntry.runId = seeded.runId;
      await browser.navigate(tokenUrl);
      await openPraxis(browser, options.timeoutMs);
      await browser.waitFor("!!document.querySelector('[data-testid=\"branch-board\"]')", { timeout: 20000, label: 'v4 branch-board' }).catch(() => null);
      const stateV4 = await browser.api('/praxis/api/state');
      themeEntry.branches = stateV4.json?.view?.branches?.map((branch) => `${branch.id}:${branch.status}`) ?? [];
      themeEntry.activeBranches = stateV4.json?.view?.branches?.filter((branch) => branch.status === 'active').length ?? 0;

      // 3) running 1440
      await snapV4(`running-${theme}-1440x1000`, 'running', '1440x1000');
      // 4) running 1024
      await browser.setViewport({ width: 1024, height: 900 });
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 350));
      await snapV4(`running-${theme}-1024x900`, 'running', '1024x900');
      // 5) branch-inspector 1440
      await browser.setViewport({ width: 1440, height: 1000 });
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 300));
      await browser.click('[data-testid="branch-card"]');
      await browser.waitFor("!!document.querySelector('[data-testid=\"inspector\"]')", { timeout: 10000, label: 'v4 inspector' });
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 250));
      await snapV4(`branch-inspector-${theme}-1440x1000`, 'branch-inspector', '1440x1000');
      await browser.press('Escape').catch(() => {});
      // 6) team-drawer
      await browser.click('[data-testid="team-chip"]');
      await browser.waitFor("!!document.querySelector('[data-testid=\"team-panel\"]')", { timeout: 10000, label: 'v4 team panel' });
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 250));
      await snapV4(`team-drawer-${theme}-1440x1000`, 'team-drawer', '1440x1000');
      await browser.press('Escape').catch(() => {});
    } catch (error) {
      v4.errors.push(`${theme}: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      try { await browser?.close({ kill: true }); } catch {}
      try { server.stop(); } catch {}
      themeEntry.serverLog = logPath;
      v4.themes[theme] = themeEntry;
    }
  }

  const present = new Set(v4.screenshots.map((item) => item.file.split('/').pop()));
  const missing = v4.required.filter((name) => !present.has(name));
  if (missing.length) v4.errors.push(`missing required v4 screenshots: ${missing.join(', ')}`);
  v4.ok = v4.errors.length === 0 && v4.buildChecked && missing.length === 0;
  writeFileSync(options.v4Manifest, `${JSON.stringify(v4, null, 2)}
`);
  process.stdout.write(`v4 manifest ${relative(ROOT, options.v4Manifest)} ok=${v4.ok} shots=${v4.screenshots.length} errors=${v4.errors.length}
`);
  for (const error of v4.errors) process.stdout.write(`v4 error: ${error}
`);
}

async function seedV4(browser) {
  const command = async (action, payload = {}, runId = undefined) => {
    const response = await browser.api('/praxis/api/command', {
      method: 'POST',
      body: { command: { commandId: `v4-${action}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, action, runId, payload } },
    });
    if (response.status !== 200) throw new Error(`v4 ${action} failed: ${response.status} ${JSON.stringify(response.json)}`);
    return response.json;
  };
  const started = await command('start', { title: '结构增益的因果分离实验', playbookId: 'scientific-loop' });
  const runId = started.receipt.runId;
  const prereg = {
    question: '结构增益是否来自算子结构，而非容量匹配？',
    prediction: '打乱结构后主指标下降 ≥0.08。',
    acceptance: '主指标超过基线 0.08 且对照被破坏时通过。',
    acceptableFailure: '对照无效则接受假设不成立。',
    controls: ['shuffle', 'label-shuffle'],
    metrics: { primary: 'separation', threshold: 0.08 },
    input: { source: 'declared-corpus' },
    budget: { wallMin: 30 },
    stop: { sameConclusion: 2 },
  };
  await command('question', { question: { text: '结构增益是否来自结构？', hypothesis: '若来自结构，打乱结构后增益消失。', unknowns: ['容量是否匹配', 'held-out 是否独立'] } }, runId);
  await command('prereg_freeze', { prereg }, runId);
  const propose = async (title, hypothesis, falsifiable, ownerId) => {
    const result = await command('branch_propose', { title, hypothesis, falsifiable, ownerId }, runId);
    return result.receipt.branchId ?? result.receipt.branch?.id;
  };
  const b1 = await propose('结构消融（主假设）', '打乱结构会破坏增益', '打乱结构后 separation 下降 ≥0.08', 'agent-alpha');
  const b2 = await propose('容量匹配对照', '增益来自容量差异', '容量匹配后增益降到 0.02 以内', 'agent-beta');
  const b3 = await propose('跨语料泛化', '增益只在声明语料成立', '换语料后增益消失', 'agent-gamma');
  for (const id of [b1, b2, b3]) await command('branch_activate', { branchId: id }, runId);
  await command('branch_evidence', { branchId: b1, kind: 'experiment', ref: 'run/seeds-1-3.json', supports: true, note: '打乱结构后 separation 0.31→0.08' }, runId);
  await command('branch_evidence', { branchId: b1, kind: 'review', ref: 'review/r-12.md', supports: true }, runId);
  await command('branch_evidence', { branchId: b1, kind: 'external', ref: 'arxiv:2601.00001', supports: false, note: '另一样本上结论不显著' }, runId);
  await command('branch_evidence', { branchId: b2, kind: 'experiment', ref: 'run/capacity-matched.json', supports: true, note: '容量匹配后增益 0.04' }, runId);
  await command('branch_evidence', { branchId: b3, kind: 'experiment', ref: 'run/corpus-b.json', supports: false }, runId);
  await command('branch_verdict', { branchId: b2, verdict: 'refuted', reason: '容量匹配无法解释 0.08 的差距' }, runId);
  await command('map_claim', { claim: '结构增益与容量无关', evidenceRefs: ['run/seeds-1-3.json', 'review/r-12.md'], status: 'supported' }, runId);
  await command('map_claim', { claim: '增益只在声明语料成立', evidenceRefs: ['run/corpus-b.json'], status: 'unverified' }, runId);
  return { runId };
}

async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  if (options.v4) {
    await captureV4(options);
    return;
  }
  if (options.help) {
    process.stdout.write('usage: node tools/evidence/capture.mjs [--port 3081] [--reuse] [--manage-server] [--theme light|dark] [--scenario fresh,frozen,blocked] [--out dir] [--manifest path]\n');
    return 0;
  }
  if (options.port === 3080) throw new Error('refusing to touch the user instance on port 3080 (contract A1)');
  if (options.manageServer && !options.reuse && options.port === 0) options.port = await pickFreePort();
  if (options.manageServer && !options.reuse) {
    options.statePath = join('/tmp/praxis-acceptance', `state-capture-${process.pid}-${options.port}.json`);
    options.profileDir = join('/tmp/praxis-acceptance', `chrome-profile-capture-${process.pid}-${options.port}`);
    try { spawnSync('rm', ['-f', options.statePath]); } catch {}
  }
  let startedServer = null;
  const manifest = {
    version: 1,
    generatedAt: new Date().toISOString(),
    node: process.version,
    packageVersion: packageVersion(),
    gitCommit: gitCommit(),
    buildHash: null,
    bundleSha256: null,
    buildChecked: false,
    port: options.port,
    url: null,
    statePath: options.statePath,
    chromeProfile: options.profileDir,
    server: null,
    theme: null,
    scenarios: [],
    screenshots: [],
    metricViolations: [],
    warnings: [],
    errors: [],
    ok: false,
  };
  let previousManifest = null;
  try { previousManifest = JSON.parse(readFileSync(options.manifest, 'utf8')); } catch {}
  const previousShots = new Map((previousManifest?.screenshots ?? []).map((item) => [item.file, item]));
  try {
    // 1) build consistency (evidence only accepted from a current bundle)
    const bundle = join(PLUGIN, 'client.js');
    if (!options.skipBuildCheck) {
      const check = spawnSync(process.execPath, [join(PLUGIN, 'build-client.mjs'), '--check'], { cwd: ROOT, encoding: 'utf8', timeout: 60000 });
      if (check.status !== 0) {
        throw new Error(`client build is stale; run node plugins/dsh-praxis/build-client.mjs first\n${check.stderr ?? ''}`);
      }
      manifest.buildChecked = true;
    }
    manifest.bundleSha256 = sha256File(bundle);
    manifest.buildHash = manifest.bundleSha256; // build hash = generated bundle sha256
    process.stdout.write(`build ${options.skipBuildCheck ? 'UNCHECKED (tool smoke only)' : 'ok'} sha256=${manifest.buildHash.slice(0, 12)}\n`);
    if (options.skipBuildCheck) manifest.errors.push('build check skipped: --skip-build-check is for tool smoke only, never acceptable as acceptance evidence');

    // 2) server (reuse or start dedicated instance)
    const baseUrl = `http://${options.host}:${options.port}`;
    if (options.restart) {
      if (options.port === 3080) throw new Error('refusing to restart the user instance on 3080 (contract A1)');
      // 只杀 dsh web 进程，避免 pkill 误伤 verifier/capture 自身命令行。
      spawnSync('pkill', ['-f', `dsh web .*--port ${options.port}( |$)`]);
      const deadline = Date.now() + 10000;
      while (Date.now() < deadline) {
        const probe = await probeState(baseUrl, null);
        if (probe.status === 0) break;
        await new Promise((resolvePromise) => setTimeout(resolvePromise, 250));
      }
      options.reuse = false;
      options.manageServer = true;
      options.token = null;
    }
    let stateResponse = await probeState(baseUrl, options.token);
    if (stateResponse.status === 0 && options.manageServer) {
      const logPath = join('/tmp/praxis-acceptance', `server-${options.port}.log`);
      const server = startServer(options, logPath);
      startedServer = server;
      stateResponse = await waitForServer(baseUrl, null, options.timeoutMs);
      if (!options.token) options.token = await waitForLogToken(server, options.timeoutMs);
      stateResponse = await probeState(baseUrl, options.token);
      manifest.server = {
        reused: false,
        port: options.port,
        pid: server.child.pid ?? null,
        statePath: options.statePath,
        theme: options.theme,
        command: `${process.env.DSH_BIN ?? 'dsh'} ${server.args.join(' ')}`,
        patch: server.patchPath,
        log: logPath,
      };
    } else if (stateResponse.status === 403 && !options.token) {
      const logCandidates = [options.serverLog, '/tmp/praxis-3081.log', `/tmp/praxis-acceptance/server-${options.port}.log`].filter(Boolean);
      for (const candidate of logCandidates) {
        if (!existsSync(candidate)) continue;
        const token = parseToken(readFileSync(candidate, 'utf8'));
        if (token) { options.token = token; break; }
      }
      if (options.token) stateResponse = await probeState(baseUrl, options.token);
    }
    if (stateResponse.status === 0) {
      throw new Error(`server not usable at ${baseUrl} (status ${stateResponse.status}${stateResponse.error ? `: ${stateResponse.error}` : ''}); existing instance requires token or --manage-server`);
    }
    // 403 表示实例已达、但 API 需要浏览器 token cookie；凭证由带 token 的页面导航建立。
    manifest.server = manifest.server ?? { reused: true, command: null, statePathKnown: false };
    manifest.server.probeStatus = stateResponse.status;

    // 3) browser
    const viewport = (() => {
      const match = /^(\d+)x(\d+)$/.exec(options.viewport);
      if (!match) return { width: 1440, height: 1000 };
      return { width: Number(match[1]), height: Number(match[2]) };
    })();
    const browser = await CDP.launch({
      chromePath: options.chrome,
      userDataDir: options.profileDir,
      viewport,
      headless: true,
    });
    const tokenUrl = `${baseUrl}/?token=${options.token ?? ''}`;
    manifest.url = options.token
      ? `${baseUrl}/?token=${options.token.slice(0, 4)}…${options.token.slice(-4)}`
      : baseUrl;
    try {
      await browser.navigate(tokenUrl);
      await openPraxis(browser, options.timeoutMs);
      const theme = await applyTheme(browser, options.theme);
      manifest.theme = theme;
      if (!theme.applied) {
        manifest.errors.push(`theme ${options.theme} not applied: ${theme.mechanism}`);
      }

      // 浏览器内取一次权威 state（token cookie 已由导航建立）。
      const browserState = await browser.api('/praxis/api/state');
      if (browserState.status !== 200 || !browserState.json) {
        throw new Error(`browser API state failed: ${browserState.status} (token/auth)`);
      }
      manifest.stateRevision = browserState.json.revision ?? null;
      const runsNow = browserState.json?.view?.runs ?? browserState.json?.runs ?? [];
      const context = { themeApplied: theme.applied };
      const viewports = [viewport, { width: 1024, height: 900 }, { width: 700, height: 600 }];
      const tagOf = (vp) => `${vp.width}x${vp.height}`;

      // 场景 1/4：empty（仅在全新 statePath 下可截；不伪造空态）
      if (options.scenarios.includes('empty')) {
        if (runsNow.length === 0) {
          manifest.scenarios.push({ scenario: 'empty', status: 'seeded', note: 'no run' });
          for (const vp of viewports) {
            await browser.setViewport(vp);
            await new Promise((resolvePromise) => setTimeout(resolvePromise, 250));
            await captureAt(browser, options, {
              name: `empty-${options.theme}-${tagOf(vp)}`,
              scenario: 'empty', viewport: vp, theme: options.theme,
              note: `空态（无 Run，${tagOf(vp)}）`,
              expectedMetrics: { visibleNodeRatio: 0, nodeVisible: 0, bboxWidthRatio: 0, bboxHeightRatio: 0, bboxAreaRatio: 0, primaryCount: 1, internalCodeCount: 0, destructiveControlCount: 0, horizontalOverflow: 0 },
            }, manifest, context);
          }
          await browser.setViewport(viewport);
        } else {
          manifest.errors.push(`empty scenario unavailable: statePath 已有 ${runsNow.length} 个 Run（capture 应使用全新 statePath）`);
          manifest.scenarios.push({ scenario: 'empty', status: 'unavailable', reason: `已有 ${runsNow.length} 个 Run` });
        }
      }

      // 场景 2/4 + 3/4：running / selected；场景 4/4：blueprint
      const mainScenario = options.scenarios.includes('frozen') ? 'frozen' : options.scenarios[0] ?? 'frozen';
      const seeded = await seedScenario(browser, mainScenario, { json: browserState.json });
      manifest.scenarios.push({ scenario: mainScenario, ...seeded });
      const fixtureState = await browser.api('/praxis/api/state');
      manifest.fixture = {
        runId: fixtureState.json?.view?.active?.id ?? seeded.runId ?? null,
        state: fixtureState.json?.view?.active?.state ?? null,
        scenario: mainScenario,
      };
      // 等客户端轮询把新夹具（PREREG_FROZEN）投影到画布，避免截到上一帧 1/10。
      const expectedCurrent = {
        INTAKE: 'n_intake', QUESTION: 'n_question', PREREG_FROZEN: 'n_prereg',
        DISCUSSION: 'n_discussion', EXECUTING: 'n_experiment', REVIEW: 'n_review',
        STAGE4: 'n_stage4', EVAL: 'n_eval', MEMORY: 'n_memory', DECISION: 'n_decision',
      }[manifest.fixture.state] ?? null;
      if (expectedCurrent) {
        await browser.waitFor(
          `document.querySelector('[data-current="true"]')?.getAttribute('data-node-id') === ${JSON.stringify(expectedCurrent)}`,
          { timeout: 15000, label: `fixture projected: ${expectedCurrent}` },
        ).catch(() => null);
      }
      // 客户端 4s 轮询：等真实 Run 投影到画布后再截图，避免拍到上一帧/空态。
      try {
        await browser.waitFor('document.querySelectorAll(".px-node").length > 0', { timeout: 15000, label: 'seed projected to canvas' });
      } catch (error) {
        manifest.errors.push(`seed projection timeout: ${error instanceof Error ? error.message : String(error)}`);
      }
      await browser.evaluate('window.scrollTo(0,0); true');

      for (const vp of viewports) {
        await browser.setViewport(vp);
        await new Promise((resolvePromise) => setTimeout(resolvePromise, 300));
        const viewportExpected = vp.width >= 1440 ? null : { ...COMPAT_THRESHOLDS };
        await captureAt(browser, options, {
          name: `running-${options.theme}-${tagOf(vp)}`,
          scenario: `running:${mainScenario}`,
          viewport: vp,
          theme: options.theme,
          note: `运行态画布（${tagOf(vp)}）`,
          expectedMetrics: viewportExpected,
        }, manifest, context);

        if (vp.width < 1024) continue; // 700×600 仅兼容性 running 截图（compat）
        if (vp.width < 1440) continue; // selected 只在 1440 签收；1024 全应用为 compat
        // selected：点选 current 节点（frozen 夹具 n_prereg，3/10）并等检查器滑出
        let clickedNodeId = null;
        try {
          const clicked = await browser.evaluate(`(() => {
            const node = document.querySelector('[data-node-id="n_prereg"][data-current="true"]')
              ?? document.querySelector('[data-current="true"]')
              ?? document.querySelector('.px-node');
            if (!node) return null;
            node.scrollIntoView({ block: 'center', inline: 'center' });
            const rect = node.getBoundingClientRect();
            return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, id: node.getAttribute('data-node-id') };
          })()`);
          if (clicked) {
            clickedNodeId = clicked.id;
            await browser.clickAt(clicked.x, clicked.y);
            await new Promise((resolvePromise) => setTimeout(resolvePromise, 400));
          }
          await captureAt(browser, options, {
            name: `selected-${options.theme}-${tagOf(vp)}`,
            scenario: `selected:${mainScenario}`,
            viewport: vp,
            theme: options.theme,
            note: `current 节点选中态（检查器，${tagOf(vp)}）`,
            expectedMetrics: vp.width >= 1440 ? { enforceOverlap: true } : viewportExpected,
            selectedNodeId: clickedNodeId,
          }, manifest, context);
        } catch (error) {
          manifest.errors.push(`selected screenshot unavailable (${tagOf(vp)}): ${error instanceof Error ? error.message : String(error)}`);
        }

        // blueprint：蓝图模态（D6 拓扑编辑）
        try {
          const modeBefore = await browser.evaluate(`document.querySelector('.px-shell')?.getAttribute('data-mode')`);
          await browser.clickText('蓝图', { timeout: 6000, selector: 'button, [role="tab"], .px-btn' });
          await new Promise((resolvePromise) => setTimeout(resolvePromise, 400));
          const modeAfter = await browser.evaluate(`document.querySelector('.px-shell')?.getAttribute('data-mode')`);
          if (modeAfter === modeBefore) {
            throw new Error(`blueprint mode not entered (data-mode=${modeAfter})`);
          }
          await captureAt(browser, options, {
            name: `blueprint-${options.theme}-${tagOf(vp)}`,
            scenario: `blueprint:${mainScenario}`,
            viewport: vp,
            theme: options.theme,
            note: `蓝图模态（拓扑编辑草稿/diff，${tagOf(vp)}）`,
            expectedMetrics: viewportExpected,
          }, manifest, context);
          await browser.clickText('运行', { timeout: 5000, selector: 'button, [role="tab"], .px-btn' });
          await new Promise((resolvePromise) => setTimeout(resolvePromise, 300));
        } catch (error) {
          manifest.errors.push(`blueprint screenshot unavailable (${tagOf(vp)}): ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      // designer canonical：干净 1440 light，无抽屉/无选中污染
      try {
        await browser.setViewport(viewport);
        await ensurePraxis(browser, options.timeoutMs);
        if (options.theme === 'light') {
          try {
            const corner = await browser.evaluate(`(() => { const c = document.querySelector('.px-canvas'); const r = c.getBoundingClientRect(); return { x: r.left + 20, y: r.top + 20 }; })()`);
            await browser.clickAt(corner.x, corner.y);
          } catch {}
          await new Promise((resolvePromise) => setTimeout(resolvePromise, 350));
          await ensurePraxis(browser, options.timeoutMs);
          await captureAt(browser, options, {
            name: `clean-${options.theme}-1440x1000`,
            scenario: `clean:${mainScenario}`,
            viewport,
            theme: options.theme,
            note: 'canonical 干净运行态（无抽屉、无选中）',
          }, manifest, context);
        }
      } catch (error) {
        manifest.errors.push(`clean canonical screenshot unavailable: ${error instanceof Error ? error.message : String(error)}`);
      }

      // selected 非 current 节点（只读动作）
      try {
        await ensurePraxis(browser, options.timeoutMs);
        const clicked = await browser.evaluate(`(() => {
          const nodes = [...document.querySelectorAll('.px-node')];
          const target = nodes.find((node) => node.dataset.current !== 'true' && node.dataset.nodeId !== 'start') ?? nodes[1] ?? nodes[0];
          if (!target) return null;
          const rect = target.getBoundingClientRect();
          return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, id: target.getAttribute('data-node-id') };
        })()`);
        if (clicked) {
          await browser.clickAt(clicked.x, clicked.y);
          await new Promise((resolvePromise) => setTimeout(resolvePromise, 400));
          await captureAt(browser, options, {
            name: `selected-noncurrent-${options.theme}-1440x1000`,
            scenario: `selected-noncurrent:${mainScenario}`,
            viewport,
            theme: options.theme,
            note: '选中的非 current 节点（只读动作/证据）',
            selectedNodeId: clicked.id,
          }, manifest, context);
        }
      } catch (error) {
        manifest.errors.push(`selected-noncurrent screenshot unavailable: ${error instanceof Error ? error.message : String(error)}`);
      }

      // drawer/modal
      try {
        await browser.press('Escape').catch(() => {});
        await ensurePraxis(browser, options.timeoutMs);
        await browser.clickText('更多', { timeout: 5000, selector: 'button, [role="button"], .px-btn, [class*="menu"]' });
        await new Promise((resolvePromise) => setTimeout(resolvePromise, 250));
        await browser.clickText('源码', { timeout: 5000, selector: 'button, [role="menuitem"], [class*="item"], a, li, div' });
        await new Promise((resolvePromise) => setTimeout(resolvePromise, 350));
        await captureAt(browser, options, {
          name: `drawer-source-${options.theme}-1440x1000`,
          scenario: 'drawer:source',
          viewport,
          theme: options.theme,
          note: '源码抽屉（modal）',
          expectedMetrics: { allowUnavailable: true, visibleNodeRatio: 0, nodeVisible: 0, bboxWidthRatio: 0, bboxHeightRatio: 0, bboxAreaRatio: 0, primaryCount: 0, internalCodeCount: 0, destructiveControlCount: 0, horizontalOverflow: 0 },
        }, manifest, context);
        await browser.press('Escape').catch(() => {});
        await ensurePraxis(browser, options.timeoutMs);
      } catch (error) {
        manifest.warnings = [...(manifest.warnings ?? []), `drawer screenshot optional: ${error instanceof Error ? error.message : String(error)}`];
      }

      // loading 态：新文档内延迟 /praxis/api/state 1.5s，确认 Praxis 骨架（.px-skeleton 可见）后截图。
      let loadingVerified = false;
      try {
        const injectionId = (await browser.send('Page.addScriptToEvaluateOnNewDocument', {
          source: `(() => {
            const original = window.fetch;
            window.fetch = (...args) => {
              const target = args[0] && args[0].url ? args[0].url : args[0];
              if (String(target).includes('/praxis/api/state')) {
                return new Promise((resolve) => setTimeout(() => resolve(original.apply(window, args)), 1500));
              }
              return original.apply(window, args);
            };
          })();`,
        })).identifier;
        await browser.navigate(tokenUrl);
        await browser.clickText('Praxis', { timeout: 8000, selector: 'button, a, [role="button"], li, div' }).catch(() => {});
        await browser.waitFor(`(() => {
          const shell = document.querySelector('[data-testid="praxis-shell"][data-scene="loading"]');
          if (!shell) return false;
          const hint = document.querySelector('[data-testid="loading-hint"]');
          const row = shell.querySelector('.px-skeleton-row');
          return Boolean(hint && hint.innerText.trim().length > 0 && row && row.getBoundingClientRect().height > 0);
        })()`, { timeout: 8000, label: 'Praxis loading scaffold+hint' });
        const loadingEntry = await captureAt(browser, options, {
          name: `loading-${options.theme}-1440x1000`,
          scenario: 'loading',
          viewport,
          theme: options.theme,
          note: 'Praxis loading 骨架（state 请求延迟 1.5s，.px-skeleton 可见）',
          expectedMetrics: { visibleNodeRatio: 0, nodeVisible: 0, bboxWidthRatio: 0, bboxHeightRatio: 0, bboxAreaRatio: 0, primaryCount: 0, internalCodeCount: 0, destructiveControlCount: 0, horizontalOverflow: 0 },
        }, manifest, context);
        const loadingInfo = loadingEntry.sceneMetrics ?? {};
        loadingVerified = loadingInfo.shellScene === 'loading'
          && loadingInfo.skeletonVisible === true
          && typeof loadingInfo.skeletonRowHeight === 'number'
          && loadingInfo.skeletonRowHeight > 0
          && typeof loadingInfo.loadingHintText === 'string'
          && loadingInfo.loadingHintText.length > 0;
        if (loadingVerified) {
          manifest.loadingScene = { scene: loadingInfo.shellScene, skeletonVisible: loadingInfo.skeletonVisible, skeletonRowHeight: loadingInfo.skeletonRowHeight, loadingHintText: loadingInfo.loadingHintText, shellWidth: loadingInfo.shellWidth, shellHeight: loadingInfo.shellHeight };
        } else {
          manifest.unverifiedScenes.push({ scene: 'loading', reason: `capture 时序未能稳定捕获 Praxis 骨架（shellScene=${loadingInfo.shellScene}, skeletonVisible=${loadingInfo.skeletonVisible}）` });
        }
        await browser.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: injectionId }).catch(() => {});
        await openPraxis(browser, options.timeoutMs);
        await browser.waitFor('document.querySelectorAll(".px-node").length > 0', { timeout: 15000, label: 'running after loading' }).catch(() => null);
      } catch (error) {
        manifest.unverifiedScenes.push({ scene: 'loading', reason: `capture 时序未能稳定捕获 Praxis 骨架（截图为宿主空白区）: ${error instanceof Error ? error.message : String(error)}` });
      }

      // 未测场景登记（动态：能真实复现的移出 unverified，不写“通过”）
      manifest.unverifiedScenes = [];
      manifest.variants = [];

      // 附加：认知地图（非 D3 必需场景；失败记为 warning，不阻塞 manifest）
      try {
        await browser.setViewport(viewport);
        try {
          await browser.clickText('地图', { timeout: 3000, selector: 'button, [role="tab"], [class*="tab"], a' });
        } catch {
          await browser.clickText('更多', { timeout: 4000, selector: 'button, [role="button"], .px-btn, [class*="menu"]' });
          await new Promise((resolvePromise) => setTimeout(resolvePromise, 250));
          await browser.clickText('地图', { timeout: 5000, selector: 'button, [role="menuitem"], [class*="item"], a, li, div' });
        }
        await browser.waitFor(`!!document.querySelector('[data-mode="map"], .px-map, .px-canvas')`, { timeout: 5000 });
        await new Promise((resolvePromise) => setTimeout(resolvePromise, 400));
        await captureAt(browser, options, {
          name: `cognitive-map-${options.theme}-${viewport.width}x${viewport.height}`,
          scenario: `map:${mainScenario}`,
          viewport,
          theme: options.theme,
          note: '认知地图',
        }, manifest, context);
      } catch (error) {
        manifest.warnings = [...(manifest.warnings ?? []), `map screenshot optional: ${error instanceof Error ? error.message : String(error)}`];
      }

      // -------------------------------------------------------------------
      // 补充场景：error / stale(409) / variant-engineering-11（消除 unverified）
      // -------------------------------------------------------------------
      const recover = async () => {
        try { await browser.send('Fetch.disable'); } catch {}
        await browser.navigate(tokenUrl);
        await openPraxis(browser, options.timeoutMs);
        await browser.waitFor('document.querySelectorAll(".px-node").length > 0', { timeout: 15000, label: 'recover nodes' }).catch(() => null);
      };

      // error 场景：Fetch.failRequest /praxis/api/state → 错误态 + 重试按钮
      try {
        await browser.send('Fetch.enable', { patterns: [{ urlPattern: '*praxis/api/state*', requestStage: 'Request' }] });
        const pausedPromise = browser.waitEvent('Fetch.requestPaused', 15000);
        await browser.navigate(tokenUrl);
        await browser.clickText('Praxis', { timeout: 8000, selector: 'button, a, [role="button"], li, div' }).catch(() => {});
        const paused = await pausedPromise.catch(() => null);
        if (!paused) throw new Error('no paused /praxis/api/state request');
        await browser.send('Fetch.failRequest', { requestId: paused.requestId, errorReason: 'Failed' });
        await browser.waitFor(`!!document.querySelector('.px-shell[data-scene="error"], [data-testid="error"]')`, { timeout: 8000, label: 'error scene' }).catch(() => null);
        await new Promise((resolvePromise) => setTimeout(resolvePromise, 350));
        const errorEntry = await captureAt(browser, options, {
          name: `error-${options.theme}-1440x1000`,
          scenario: 'error',
          viewport,
          theme: options.theme,
          note: '服务错误态（/praxis/api/state 注入失败）+ 重试按钮',
          expectedMetrics: { visibleNodeRatio: 0, nodeVisible: 0, bboxWidthRatio: 0, bboxHeightRatio: 0, bboxAreaRatio: 0, primaryCount: 1, internalCodeCount: 0, destructiveControlCount: 0, horizontalOverflow: 0 },
        }, manifest, context);
        const errorInfo = errorEntry.sceneMetrics ?? {};
        if (errorInfo.shellScene !== 'error' || !errorInfo.retryVisible || !errorInfo.errorText) {
          manifest.unverifiedScenes.push({ scene: 'error', reason: `error UI incomplete: ${JSON.stringify({ scene: errorInfo.shellScene, retry: errorInfo.retryVisible, text: errorInfo.errorText })}` });
        } else {
          manifest.errorScene = { scene: errorInfo.shellScene, retryVisible: errorInfo.retryVisible, text: errorInfo.errorText.slice(0, 160) };
        }
        await browser.send('Fetch.disable').catch(() => {});
        await recover();
      } catch (error) {
        manifest.unverifiedScenes.push({ scene: 'error', reason: error instanceof Error ? error.message : String(error) });
        try { await browser.send('Fetch.disable'); } catch {}
      }

      // stale/409 场景（确定性）：服务端先前进到 v4，再用 __praxisDebug.send 以旧 revision 提交 → 409 CONFLICT
      try {
        await recover();
        await browser.waitFor('!!window.__praxisDebug && typeof window.__praxisDebug.send === "function"', { timeout: 10000, label: 'praxis debug seam' });
        await browser.waitFor('document.querySelectorAll(".px-node").length > 0', { timeout: 15000, label: 'stale fixture mounted' }).catch(() => null);
        const packages = [
          { persona: 'theorist', claim: '结构可提取', assumptions: ['信号存在'], evidence: ['d:1'], style: 'theoretical', minority: true, retained: true },
          { persona: 'empiricist', claim: '只有均值回归', assumptions: ['噪声解释'], evidence: ['d:2'], style: 'empirical', minority: false, retained: true },
        ];
        const oldRevision = await browser.evaluate('window.__praxisDebug.revision()');
        // 1) 绕过客户端 store 直接前进服务端版本（期望成功）
        const advance = await browser.evaluate(`(async () => {
          const response = await fetch('/praxis/api/command', {
            method: 'POST',
            headers: { 'content-type': 'application/json', 'x-praxis-request': '1' },
            body: JSON.stringify({ command: {
              commandId: 'stale-advance-' + Date.now(),
              action: 'discussion',
              expectedDomainVersion: ${JSON.stringify(oldRevision)},
              payload: { round: 1, packages: ${JSON.stringify(packages)} },
            } }),
          });
          let json = null; try { json = await response.json(); } catch {}
          return { status: response.status, code: json && json.code, state: json && json.view && json.view.active && json.view.active.state };
        })()`);
        if (advance.status !== 200) throw new Error(`server advance failed: ${advance.status} ${JSON.stringify(advance)}`);
        // 2) 用旧 revision 走客户端同权 StoreSend → 409 CONFLICT
        const stale = await browser.evaluate(`(async () => {
          try {
            const receipt = await window.__praxisDebug.send('discussion', { round: 1, packages: ${JSON.stringify(packages)} }, { expectedDomainVersion: ${JSON.stringify(oldRevision)} });
            return { receiptStatus: receipt && receipt.status, receiptCode: receipt && receipt.reasonCode };
          } catch (error) {
            return { error: String(error) };
          }
        })()`);
        await browser.waitFor(`(() => { const banner = document.querySelector('[data-testid="banner"]'); return Boolean(banner && /数据已更新|未提交/.test(banner.innerText)); })()`, { timeout: 8000, label: 'stale banner' }).catch(() => null);
        await new Promise((resolvePromise) => setTimeout(resolvePromise, 800));
        const staleEntry = await captureAt(browser, options, {
          name: `stale-${options.theme}-1440x1000`,
          scenario: 'stale',
          viewport,
          theme: options.theme,
          note: '确定性 409 CONFLICT（__praxisDebug.send 旧 revision）→ sticky stale 横幅 + 推进按钮禁用',
          expectedMetrics: { visibleNodeRatio: 1, bboxWidthRatio: 0, bboxHeightRatio: 0, bboxAreaRatio: 0, primaryCount: 1, internalCodeCount: 0, destructiveControlCount: 0, horizontalOverflow: 0 },
        }, manifest, context);
        const staleInfo = staleEntry.sceneMetrics ?? {};
        const bannerOk = /数据已更新|未提交/.test(staleInfo.bannerText ?? '');
        const hasRefresh = (staleInfo.bannerButtons ?? []).some((text) => /刷新/.test(text));
        const hasClose = (staleInfo.bannerButtons ?? []).some((text) => /关闭|×/.test(text));
        const staleVerified = bannerOk
          && hasRefresh && hasClose
          && staleInfo.primaryDisabled === true
          && stale.receiptStatus === 'rejected'
          && stale.receiptCode === 'CONFLICT';
        if (!staleVerified) {
          manifest.unverifiedScenes.push({ scene: 'stale', reason: `deterministic 409 seam incomplete: ${JSON.stringify({ seam: stale, banner: staleInfo.bannerText, buttons: staleInfo.bannerButtons, disabled: staleInfo.primaryDisabled })}` });
        } else {
          manifest.staleScene = {
            seam: { oldRevision, advancedState: advance.state, receiptStatus: stale.receiptStatus, receiptCode: stale.receiptCode },
            ui: { bannerPresent: true, banner: staleInfo.bannerText.slice(0, 200), primaryDisabled: staleInfo.primaryDisabled, buttons: staleInfo.bannerButtons },
          };
        }
        await recover();
      } catch (error) {
        manifest.unverifiedScenes.push({ scene: 'stale', reason: `deterministic 409 seam failed: ${error instanceof Error ? error.message : String(error)}` });
      }

      // variant-engineering-11：非 15 节点（engineering-release 11 节点）布局/检查器覆盖
      try {
        await recover();
        const playbookId = 'engineering-release';
        const playbook = PLAYBOOKS[playbookId];
        if (!playbook) throw new Error('PLAYBOOKS.engineering-release missing');
        const variantGraph = buildDefaultGraph(playbook);
        const currentGraph = await browser.api(`/praxis/api/graph?playbookId=${playbookId}`);
        const expectedRevision = currentGraph.status === 200 ? (currentGraph.json?.revision ?? 0) : 0;
        const saved = await browser.api('/praxis/api/graph', {
          method: 'POST',
          body: { playbookId, graph: variantGraph, expectedRevision },
        });
        if (saved.status !== 200) throw new Error(`save variant graph failed: ${saved.status} ${JSON.stringify(saved.json)}`);
        const stamp = Date.now();
        const start = await browser.api('/praxis/api/command', {
          method: 'POST',
          body: { command: { commandId: `variant-${stamp}-start`, action: 'start', payload: { playbookId, title: 'variant engineering 11' } } },
        });
        if (start.status !== 200) throw new Error(`variant start failed: ${start.status} ${JSON.stringify(start.json)}`);
        const variantRunId = start.json.receipt.runId;
        const asked = await browser.api('/praxis/api/command', {
          method: 'POST',
          body: {
            command: {
              commandId: `variant-${stamp}-q`, action: 'question', runId: variantRunId,
              payload: { question: { text: '工程发布：冻结契约能否验证发布？', hypothesis: '可以验证且不把诊断当验收', unknowns: ['回滚窗口'] } },
            },
          },
        });
        if (asked.status !== 200) throw new Error(`variant question failed: ${asked.status} ${JSON.stringify(asked.json)}`);
        const frozenVariant = await browser.api('/praxis/api/command', {
          method: 'POST',
          body: {
            command: {
              commandId: `variant-${stamp}-f`, action: 'prereg_freeze', runId: variantRunId,
              payload: { prereg: { question: '工程发布能否用冻结契约验证？', prediction: '可以', acceptance: '通过', acceptableFailure: '回滚', controls: ['canary'], metrics: { primary: 'pass-rate', threshold: 0.9 }, input: { source: 'release' }, budget: { wallMin: 30 }, stop: { sameConclusion: 2 } } },
            },
          },
        });
        if (frozenVariant.status !== 200) throw new Error(`variant freeze failed: ${frozenVariant.status} ${JSON.stringify(frozenVariant.json)}`);
        await browser.waitFor('document.querySelectorAll(".px-node").length === 11', { timeout: 15000, label: '11-node variant graph' }).catch(() => null);
        await new Promise((resolvePromise) => setTimeout(resolvePromise, 500));
        const currentPoint = await browser.evaluate(`(() => {
          const node = document.querySelector('[data-current="true"]') ?? document.querySelector('.px-node');
          if (!node) return null;
          const rect = node.getBoundingClientRect();
          return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, id: node.getAttribute('data-node-id') };
        })()`);
        if (currentPoint) {
          await browser.clickAt(currentPoint.x, currentPoint.y);
          await new Promise((resolvePromise) => setTimeout(resolvePromise, 450));
        }
        const variantEntry = await captureAt(browser, options, {
          name: `variant-engineering-11-${options.theme}-1440x1000`,
          scenario: 'variant-engineering-11',
          viewport,
          theme: options.theme,
          note: 'variant：engineering-release 11 节点（非 15；非 14 的诚实替代）',
          expectedMetrics: { visibleNodeRatio: 1, bboxWidthRatio: 0, bboxHeightRatio: 0, bboxAreaRatio: 0, primaryCount: 1, internalCodeCount: 0, destructiveControlCount: 0, horizontalOverflow: 0 },
          selectedNodeId: currentPoint?.id ?? null,
        }, manifest, context);
        const variantInfo = variantEntry.sceneMetrics ?? {};
        const variantTotal = variantEntry.metrics?.nodeTotal ?? null;
        if (variantTotal !== 11 || variantInfo.nodeOverlapArea > 0.5 || variantInfo.inspectorVisible !== true) {
          manifest.unverifiedScenes.push({ scene: 'variant-engineering-11', reason: `variant layout/inspector incomplete: ${JSON.stringify({ nodes: variantTotal, overlap: variantInfo.nodeOverlapArea, inspector: variantInfo.inspectorVisible })}` });
        } else {
          manifest.variants = [{ scene: 'variant-engineering-11', nodes: 11, note: 'engineering-release 11 节点；非 14，按 Lead 建议诚实替代' }];
        }
      } catch (error) {
        manifest.unverifiedScenes.push({ scene: 'variant-engineering-11', reason: error instanceof Error ? error.message : String(error) });
      }

      // 未验证场景不留误导性截图：loading/stale 在 unverified 时从证据集删除。
      const dropShotPrefixes = manifest.unverifiedScenes
        .map((item) => item.scene)
        .filter((scene) => scene === 'loading' || scene === 'stale')
        .map((scene) => `/${scene}-`);
      if (dropShotPrefixes.length > 0) {
        manifest.screenshots = manifest.screenshots.filter((shot) => {
          const file = String(shot.file);
          if (dropShotPrefixes.some((prefix) => file.includes(prefix))) {
            try { unlinkSync(resolve(ROOT, shot.file)); } catch {}
            return false;
          }
          return true;
        });
      }

      await browser.close();
    } catch (error) {
      manifest.errors.push(error instanceof Error ? error.message : String(error));
      try { await browser.close(); } catch {}
    }

    // 合并历史截图：亮/暗、不同场景的多次 capture 累加到同一 manifest。
    const INAPPLICABLE_700 = /(selected|blueprint)-[^/]*700x600\.png$/;
    // 允许矩阵之外的历史截图一律移除，避免旧口径污染 aggregate manifest。
    const ALLOWED = /(?:^|\/)(?:empty-(?:light|dark)-(?:1440x1000|1024x900|700x600)|running-(?:light|dark)-(?:1440x1000|1024x900|700x600)|selected-(?:light|dark)-1440x1000|blueprint-(?:light|dark)-1440x1000|selected-noncurrent-(?:light|dark)-1440x1000|drawer-source-(?:light|dark)-1440x1000|clean-light-1440x1000|loading-(?:light|dark)-1440x1000|cognitive-map-(?:light|dark)-1440x1000|error-(?:light|dark)-1440x1000|stale-(?:light|dark)-1440x1000|variant-engineering-11-(?:light|dark)-1440x1000)\.png$/;
    for (const [file, entry] of previousShots) {
      if (INAPPLICABLE_700.test(entry.file) || !ALLOWED.test(entry.file)) {
        try { unlinkSync(resolve(ROOT, entry.file)); } catch {}
        continue;
      }
      if (!manifest.screenshots.some((item) => item.file === file)) manifest.screenshots.push(entry);
    }
    const unverifiedScenes = new Set((manifest.unverifiedScenes ?? []).map((item) => item.scene));
    if (unverifiedScenes.has('loading') || unverifiedScenes.has('stale')) {
      manifest.screenshots = manifest.screenshots.filter((shot) => {
        const base = String(shot.file).split('/').pop() ?? '';
        const drop = (unverifiedScenes.has('loading') && base.startsWith('loading-'))
          || (unverifiedScenes.has('stale') && base.startsWith('stale-'));
        if (drop) {
          try { unlinkSync(resolve(ROOT, shot.file)); } catch {}
          return false;
        }
        return true;
      });
    }
    manifest.screenshots.sort((a, b) => String(a.file).localeCompare(String(b.file)));
    manifest.themes = { ...(previousManifest?.themes ?? {}) };
    manifest.themes[options.theme] = {
      themeRequested: options.theme,
      themeApplied: manifest.theme?.applied ?? null,
      buildHash: manifest.buildHash,
      bundleSha256: manifest.bundleSha256,
      server: manifest.server ? { port: manifest.server.port, statePath: manifest.server.statePath, pid: manifest.server.pid } : null,
      screenshots: manifest.screenshots.filter((item) => item.theme === options.theme).map((item) => item.file),
      scenarios: manifest.screenshots.filter((item) => item.theme === options.theme).map((item) => item.scenario),
    };
    // 从合并后的截图重新汇总 violations（避免 dark run 覆盖掉 light 的未解决违规）。
    manifest.metricViolations = manifest.screenshots
      .filter((item) => (item.violations ?? []).length > 0)
      .map((item) => ({ file: item.file, violations: item.violations }));
    manifest.expectedViolations = manifest.screenshots
      .filter((item) => (item.expectedViolations ?? []).length > 0)
      .map((item) => ({ file: item.file, violations: item.expectedViolations }));
    manifest.unexpectedMetricViolations = manifest.metricViolations.reduce((sum, item) => sum + item.violations.length, 0);
    manifest.expectedMetricViolations = manifest.expectedViolations.reduce((sum, item) => sum + item.violations.length, 0);
    // 场景状态一致性检查（合并后）。
    const progressValues = [...new Set(manifest.screenshots
      .filter((item) => /^(running|selected|blueprint|clean|selected-noncurrent)/.test(String(item.scenario)))
      .map((item) => item.sceneMetrics?.progress)
      .filter(Boolean))];
    manifest.sceneConsistency = { progressValues };
    if (progressValues.length > 1) {
      manifest.metricViolations = [...(manifest.metricViolations ?? []), { file: 'scene-consistency', violations: [{ metric: 'sceneProgressMismatch', expected: 1, actual: progressValues }] }];
      manifest.unexpectedMetricViolations += 1;
    }
    // 签收 / compat / 未验证拆分；ok 不掩盖 unverified。
    const themes = Object.keys(manifest.themes ?? {});
    const themeList = themes.length > 0 ? themes : [options.theme];
    const signed = [];
    const compat = [];
    const unverified = [...(manifest.unverifiedScenes ?? [])];
    const requiredFor = (theme) => (theme === 'light'
      ? ['empty', 'running', 'selected', 'blueprint', 'clean'].map((scene) => `${scene}-${theme}-1440x1000.png`)
      : ['running', 'selected'].map((scene) => `${scene}-${theme}-1440x1000.png`));
    const files = new Set(manifest.screenshots.map((item) => String(item.file).split('/').pop()));
    for (const theme of themeList) {
      for (const file of requiredFor(theme)) {
        if (files.has(file)) signed.push({ scene: file.replace(/\.png$/, ''), theme, file });
        else unverified.push({ scene: file.replace(/\.png$/, ''), reason: 'missing evidence (signed scene)' });
      }
    }
    for (const item of manifest.screenshots) {
      const base = String(item.file).split('/').pop() ?? '';
      if (!/1440x1000/.test(base) || !/^(empty|running|selected|blueprint|selected-noncurrent|drawer-source|clean)-/.test(base)) {
        compat.push({ scene: base.replace(/\.png$/, ''), viewport: item.viewport, theme: item.theme, status: 'compat-not-signed' });
      }
    }
    manifest.signoff = { signed, compat, unverified };
    manifest.contrastSummary = Object.fromEntries(themeList.map((theme) => {
      const shots = manifest.screenshots.filter((item) => item.theme === theme && item.metrics?.contrast);
      const text = shots.map((item) => item.metrics.contrast.textMin).filter((value) => typeof value === 'number');
      const nonText = shots.map((item) => item.metrics.contrast.nonTextMin).filter((value) => typeof value === 'number');
      return [theme, {
        textMin: text.length ? Math.min(...text) : null,
        nonTextMin: nonText.length ? Math.min(...nonText) : null,
        pairsSampled: shots.reduce((sum, item) => sum + (item.metrics.contrastPairs?.filter((pair) => pair.status === 'sampled').length ?? 0), 0),
        pairsMissing: shots.reduce((sum, item) => sum + (item.metrics.contrastPairs?.filter((pair) => pair.status === 'missing').length ?? 0), 0),
      }];
    }));
    manifest.captures = [
      ...(previousManifest?.captures ?? []),
      {
        at: new Date().toISOString(),
        theme: options.theme,
        scenarios: options.scenarios,
        buildHash: manifest.buildHash,
        buildChecked: manifest.buildChecked,
        screenshots: manifest.screenshots.map((item) => item.file),
        errors: manifest.errors,
        ok: manifest.errors.length === 0,
      },
    ].slice(-10);
    if (startedServer && !options.keepServer) {
      try { startedServer.stop(); manifest.server.stopped = true; } catch {}
    }
    const requiredShots = manifest.screenshots.filter((item) =>
      /^(empty|running|selected|blueprint)-/.test(String(item.file).split('/').pop() ?? ''),
    );
    manifest.requiredShots = requiredShots.length;
    manifest.ok = manifest.errors.length === 0
      && manifest.unexpectedMetricViolations === 0
      && manifest.signoff.unverified.filter((item) => /missing evidence/.test(item.reason ?? '')).length === 0
      && !(manifest.theme && !manifest.theme.applied);
    mkdirSync(dirname(options.manifest), { recursive: true });
    writeFileSync(options.manifest, `${JSON.stringify(manifest, null, 2)}\n`);
    process.stdout.write(`manifest ${relative(ROOT, options.manifest)} ok=${manifest.ok} shots=${manifest.screenshots.length} metricViolations=${manifest.metricViolations.length} errors=${manifest.errors.length}\n`);
    for (const warning of manifest.warnings ?? []) process.stderr.write(`warning: ${warning}\n`);
    for (const error of manifest.errors) process.stderr.write(`error: ${error}\n`);
    return manifest.ok ? 0 : 2;
  } catch (error) {
    manifest.errors.push(error instanceof Error ? error.message : String(error));
    manifest.ok = false;
    mkdirSync(dirname(options.manifest), { recursive: true });
    writeFileSync(options.manifest, `${JSON.stringify(manifest, null, 2)}\n`);
    process.stderr.write(`capture failed: ${error instanceof Error ? error.message : String(error)}\n`);
    return 1;
  }
}

const isEntry = import.meta.url === `file://${process.argv[1]}`;
if (isEntry) {
  const argv = process.argv.slice(2);
  if (argv.includes('--all')) {
    const base = argv.filter((item) => item !== '--all');
    const withScenario = base.includes('--scenario') ? base : [...base, '--scenario', 'empty,frozen'];
    let exitCode = 0;
    for (const theme of ['light', 'dark']) {
      const runArgs = [...withScenario.filter((item, index) => !(item === '--theme' || (index > 0 && withScenario[index - 1] === '--theme'))), '--theme', theme];
      const code = await main(runArgs);
      if (code !== 0) exitCode = code;
    }
    process.exit(exitCode);
  }
  const exitCode = await main(argv);
  process.exit(exitCode);
}

export { main, parseArgs, startServer };
