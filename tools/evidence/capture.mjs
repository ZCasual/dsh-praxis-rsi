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
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { CDP } from './cdp.mjs';
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
    scenarios: ['frozen'],
    theme: 'light',
    viewport: '1440x1000',
    serverLog: null,
    chrome: process.env.CHROME_PATH ?? '/usr/bin/google-chrome',
    timeoutMs: 45000,
    skipBuildCheck: false,
    restart: false,
    keepServer: false,
    buildChecked: false,
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

function registerShot(manifest, { file, viewport, theme, scenario, metrics, themeApplied, note, expectedMetrics = null }) {
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
    metricsViolations: checkMetrics(metrics, expectedMetrics ?? {}),
    note: note ?? null,
  };
  manifest.screenshots = [...(manifest.screenshots ?? []).filter((item) => item.file !== relativePath), entry];
  return entry;
}

async function captureAt(browser, options, target, manifest, context) {
  const { viewport, theme, scenario, name, note } = target;
  const expectedMetrics = target.expectedMetrics ?? null;
  await browser.setViewport(viewport);
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 250));
  const metrics = await collectMetrics(browser);
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
  });
  const violations = entry.metricsViolations.filter((item) => !(expectedMetrics?.allowUnavailable && !metrics.available));
  entry.metricsViolations = violations;
  process.stdout.write(
    `shot ${relative(ROOT, file)} sha256=${entry.sha256.slice(0, 12)} visible=${metrics.available ? `${metrics.nodeVisible}/${metrics.nodeTotal}` : 'n/a'} primary=${metrics.available ? metrics.primaryCount : 'n/a'} violations=${violations.length}\n`,
  );
  if (violations.length > 0) {
    manifest.metricViolations = [...(manifest.metricViolations ?? []), { file: entry.file, violations }];
  }
  return entry;
}

async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
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
        // selected：点选第一个节点并等检查器滑出
        try {
          const clicked = await browser.evaluate(`(() => {
            const node = document.querySelector('.px-node');
            if (!node) return null;
            node.scrollIntoView({ block: 'center', inline: 'center' });
            const rect = node.getBoundingClientRect();
            return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
          })()`);
          if (clicked) {
            await browser.clickAt(clicked.x, clicked.y);
            await new Promise((resolvePromise) => setTimeout(resolvePromise, 400));
          }
          await captureAt(browser, options, {
            name: `selected-${options.theme}-${tagOf(vp)}`,
            scenario: `selected:${mainScenario}`,
            viewport: vp,
            theme: options.theme,
            note: `节点选中态（检查器，${tagOf(vp)}）`,
            expectedMetrics: viewportExpected,
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
        if (options.theme === 'light') {
          await browser.press('Escape').catch(() => {});
          try {
            const corner = await browser.evaluate(`(() => { const c = document.querySelector('.px-canvas'); const r = c.getBoundingClientRect(); return { x: r.left + 20, y: r.top + 20 }; })()`);
            await browser.clickAt(corner.x, corner.y);
          } catch {}
          await new Promise((resolvePromise) => setTimeout(resolvePromise, 350));
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
        const clicked = await browser.evaluate(`(() => {
          const nodes = [...document.querySelectorAll('.px-node')];
          const target = nodes.find((node) => !node.classList.contains('is-current')) ?? nodes[1] ?? nodes[0];
          if (!target) return null;
          const rect = target.getBoundingClientRect();
          return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
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
          }, manifest, context);
        }
      } catch (error) {
        manifest.errors.push(`selected-noncurrent screenshot unavailable: ${error instanceof Error ? error.message : String(error)}`);
      }

      // drawer/modal
      try {
        await browser.press('Escape').catch(() => {});
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
        }, manifest, context);
        await browser.press('Escape').catch(() => {});
      } catch (error) {
        manifest.warnings = [...(manifest.warnings ?? []), `drawer screenshot optional: ${error instanceof Error ? error.message : String(error)}`];
      }

      // loading 态（重载瞬间的骨架/加载）
      try {
        await browser.navigate(tokenUrl);
        await new Promise((resolvePromise) => setTimeout(resolvePromise, 120));
        await captureAt(browser, options, {
          name: `loading-${options.theme}-1440x1000`,
          scenario: 'loading',
          viewport,
          theme: options.theme,
          note: '加载态（重载瞬间）',
          expectedMetrics: { ...COMPAT_THRESHOLDS, allowUnavailable: true, visibleNodeRatio: 0, nodeVisible: 0, bboxWidthRatio: 0, bboxHeightRatio: 0, bboxAreaRatio: 0, primaryCount: 0 },
        }, manifest, context);
        await openPraxis(browser, options.timeoutMs);
      } catch (error) {
        manifest.warnings = [...(manifest.warnings ?? []), `loading screenshot optional: ${error instanceof Error ? error.message : String(error)}`];
      }

      // 未测场景登记（不写“通过”）
      manifest.unverifiedScenes = [
        { scene: 'error', reason: '需注入接口 500/断网；当前 capture 未实现' },
        { scene: 'stale', reason: '需客户端 StoreSend 触发 409；当前 capture 未实现' },
        { scene: '14-nodes', reason: '受保护节点约束下尚未定义合法 14 节点自定义图；待 Lead 提供夹具' },
      ];

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

      await browser.close();
    } catch (error) {
      manifest.errors.push(error instanceof Error ? error.message : String(error));
      try { await browser.close(); } catch {}
    }

    // 合并历史截图：亮/暗、不同场景的多次 capture 累加到同一 manifest。
    for (const [file, entry] of previousShots) {
      if (!manifest.screenshots.some((item) => item.file === file)) manifest.screenshots.push(entry);
    }
    manifest.screenshots.sort((a, b) => String(a.file).localeCompare(String(b.file)));
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
      && requiredShots.length >= 8
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
