#!/usr/bin/env node
/* Dev preview: rebuild client, restart isolated 3081, seed a scenario, drive Chrome via CDP,
 * and dump a screenshot plus layout metrics. Zero dependencies.
 *
 * Usage: node tools/dev/preview.mjs [--scenario empty|fresh|frozen|blocked] [--theme light|dark] [--size 1440x1000] [--keep]
 */
import { spawnSync, spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const args = process.argv.slice(2);
function arg(name, fallback) {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : fallback;
}
const scenario = arg('scenario', 'frozen');
const theme = arg('theme', 'light');
const [width, height] = arg('size', '1440x1000').split('x').map(Number);
const keep = args.includes('--keep');
const outDir = '/tmp/praxis-preview';
const port = 3081;
const patchPath = '/tmp/praxis-test-patch.yml';
const statePath = `/tmp/praxis-acceptance/state-${scenario}-${theme}.json`;
const chromePort = 9300 + Math.floor(Math.random() * 200);
const profileDir = `/tmp/praxis-chrome-${Date.now()}`;

mkdirSync(outDir, { recursive: true });
mkdirSync('/tmp/praxis-acceptance', { recursive: true });

function run(command, argv, options = {}) {
  const result = spawnSync(command, argv, { encoding: 'utf8', ...options });
  if (result.status !== 0 && !options.allowFail) {
    throw new Error(`${command} ${argv.join(' ')} failed: ${result.stderr || result.stdout}`);
  }
  return result;
}

// 1. build client
run('node', [join(root, 'plugins/dsh-praxis/build-client.mjs')]);

// 2. stop any previous 3081 instance
run('bash', ['-lc', "pkill -f 'dsh web.*--port 3081' || true"], { allowFail: true });
await new Promise((resolve) => setTimeout(resolve, 800));

// 3. start isolated instance
writeFileSync(patchPath, [
  '- id: praxis',
  '  config:',
  `    statePath: ${statePath}`,
  '- id: ui-theme',
  '  name: "@deepseek-ai/dsh-client-ui-theme"',
  '  config:',
  `    preference: ${theme}`,
  '',
].join('\n'));
rmSync(statePath, { force: true });
const logPath = join(outDir, `server-${scenario}-${theme}.log`);
const server = spawn('dsh', ['web', '--patch', patchPath, '--port', String(port), '--no-open'], {
  cwd: root,
  env: { ...process.env, DSH_THEME: theme },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let serverLog = '';
server.stdout.on('data', (chunk) => { serverLog += String(chunk); });
server.stderr.on('data', (chunk) => { serverLog += String(chunk); });

async function waitHealth() {
  for (let i = 0; i < 120; i += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/praxis/api/health`, { headers: { 'x-praxis-request': '1' } });
      if (response.ok) return await response.json();
    } catch { /* not ready */ }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`praxis instance did not start on ${port}\n${serverLog.slice(-2000)}`);
}
const health = await waitHealth();
let tokenMatch = serverLog.match(/token=([A-Za-z0-9_-]+)/);
for (let i = 0; i < 40 && !tokenMatch; i += 1) {
  await new Promise((resolve) => setTimeout(resolve, 250));
  tokenMatch = serverLog.match(/token=([A-Za-z0-9_-]+)/);
}
const token = tokenMatch ? tokenMatch[1] : '';
writeFileSync(logPath, serverLog);
if (!token) throw new Error(`no auth token in server log:\n${serverLog.slice(-1500)}`);

// 4. seed
if (args.includes('--v4')) {
  const v4 = run('node', ['/tmp/seed-v4.mjs'], { cwd: root, allowFail: true });
  writeFileSync(join(outDir, 'seed-v4.json'), `${v4.stdout}${v4.stderr}`);
} else if (scenario !== 'empty') {
  const seeded = run('node', [join(root, 'tools/dev/seed.mjs'), String(port), scenario], { cwd: root, allowFail: true });
  writeFileSync(join(outDir, `seed-${scenario}.json`), `${seeded.stdout}${seeded.stderr}`);
  if (seeded.status !== 0) process.stderr.write(`seed failed: ${seeded.stderr}\n`);
}

// 5. chrome
const chrome = spawn('/usr/bin/google-chrome', [
  '--headless=new', `--remote-debugging-port=${chromePort}`, `--user-data-dir=${profileDir}`,
  `--window-size=${width},${height}`, '--no-first-run', '--no-default-browser-check', '--disable-gpu',
  '--force-device-scale-factor=1', 'about:blank',
], { stdio: 'ignore' });

async function waitChrome() {
  for (let i = 0; i < 120; i += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${chromePort}/json/list`);
      const list = await response.json();
      const page = list.find((item) => item.type === 'page');
      if (page) return page;
    } catch { /* not ready */ }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error('chrome did not expose a page target');
}

const page = await waitChrome();
const ws = new WebSocket(page.webSocketDebuggerUrl);
let seq = 0;
const pending = new Map();
ws.addEventListener('message', (event) => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) {
    pending.get(message.id)(message);
    pending.delete(message.id);
  }
});
await new Promise((resolve) => ws.addEventListener('open', resolve));
function send(method, params = {}) {
  seq += 1;
  const id = seq;
  return new Promise((resolve) => {
    pending.set(id, resolve);
    ws.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression) {
  const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.result?.exceptionDetails) {
    const details = result.result.exceptionDetails;
    throw new Error(`evaluate failed: ${details.text} ${details.exception?.description ?? ''}\nexpr=${String(expression).slice(0, 240)}`);
  }
  return result.result?.result?.value;
}

const consoleErrors = [];
ws.addEventListener('message', (event) => {
  const message = JSON.parse(event.data);
  if (message.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(message.params?.type)) {
    const text = (message.params.args ?? []).map((arg) => String(arg.value ?? arg.description ?? '')).join(' ');
    if (text && consoleErrors.length < 20) consoleErrors.push(`${message.params.type}: ${text.slice(0, 300)}`);
  }
  if (message.method === 'Runtime.exceptionThrown') {
    const details = message.params?.exceptionDetails;
    if (consoleErrors.length < 20) consoleErrors.push(`exception: ${details?.text ?? ''} ${details?.exception?.description ?? ''}`.slice(0, 300));
  }
});
async function mouseClick(x, y) {
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'none' });
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
}
async function clickSelector(selector, index = 0) {
  const expression = '(() => { const list = [...document.querySelectorAll(' + JSON.stringify(selector) + ')];'
    + ' const el = list[' + String(index) + ']; if (!el) return null;'
    + ' const r = el.getBoundingClientRect();'
    + ' return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height }; })()';
  const box = await evaluate(expression);
  if (!box) return { clicked: false };
  await mouseClick(box.x, box.y);
  return { clicked: true, x: box.x, y: box.y, w: box.w, h: box.h };
}

await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: `http://127.0.0.1:${port}/?token=${token}` });

// wait for the shell, then open the Praxis main view
for (let i = 0; i < 80; i += 1) {
  const ready = await evaluate(`Boolean([...document.querySelectorAll('button')].find((b) => b.innerText.trim() === 'Praxis'))`);
  if (ready) break;
  await new Promise((resolve) => setTimeout(resolve, 250));
}
await evaluate(`(() => { const btn = [...document.querySelectorAll('button')].find((b) => b.innerText.trim() === 'Praxis'); if (btn) btn.click(); return true; })()`);
for (let i = 0; i < 80; i += 1) {
  const ready = await evaluate(`Boolean(document.querySelector('[data-praxis="app"]'))`);
  if (ready) break;
  await new Promise((resolve) => setTimeout(resolve, 250));
}
await new Promise((resolve) => setTimeout(resolve, 1500));

const metrics = await evaluate(`(() => {
  const app = document.querySelector('[data-praxis="app"]');
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth;
  };
  const nodes = [...document.querySelectorAll('[data-testid="node"]')];
  const canvas = document.querySelector('[data-testid="canvas"]');
  const canvasRect = canvas ? canvas.getBoundingClientRect() : null;
  const inCanvas = nodes.filter((node) => {
    const r = node.getBoundingClientRect();
    if (!canvasRect) return false;
    return r.left >= canvasRect.left - 1 && r.right <= canvasRect.right + 1 && r.top >= canvasRect.top - 1 && r.bottom <= canvasRect.bottom + 1;
  });
  const text = app ? app.innerText : '';
  const internal = ['gate:', 'prereg_freeze', 'close-or-new-run', 'pivot-or-stop', 'eval_report', 'memory_propose'].filter((token) => text.includes(token));
  return {
    hasApp: Boolean(app),
    mode: app ? app.getAttribute('data-mode') : null,
    nodeCount: nodes.length,
    nodesVisible: nodes.filter(visible).length,
    nodesInCanvas: inCanvas.length,
    canvas: canvasRect ? { w: Math.round(canvasRect.width), h: Math.round(canvasRect.height) } : null,
    primaryButtons: document.querySelectorAll('.px-btn.primary').length,
    inspectorOpen: Boolean(document.querySelector('[data-testid="inspector"]')),
    badges: [...document.querySelectorAll('[data-testid="node"] [data-node-id], [data-testid="node"]')].length,
    internalTokens: internal,
    docOverflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    bodyScroll: document.body.scrollHeight > document.body.clientHeight,
    textSample: text.slice(0, 240),
    fontSizeMin: (() => {
      const sizes = [...document.querySelectorAll('.px-node-title, .px-node-sub, .px-node-chip')].map((el) => parseFloat(getComputedStyle(el).fontSize));
      return sizes.length ? Math.min(...sizes) : null;
    })(),
  };
})()`);

let interaction = null;
if (args.includes('--inspector')) {
  interaction = await evaluate(`(() => {
    const node = document.querySelector('[data-testid="node"][data-current="true"]') || document.querySelector('[data-testid="node"]');
    return { id: node ? node.getAttribute('data-node-id') : null };
  })()`);
  const clickTarget = await clickSelector('[data-testid="node"][data-current="true"]');
  interaction.clicked = clickTarget;
  await new Promise((resolve) => setTimeout(resolve, 900));
  interaction.inspector = await evaluate(`(() => {
    const panel = document.querySelector('[data-testid="inspector"]');
    if (!panel) return { open: false };
    return {
      open: true,
      primary: panel.querySelectorAll('.px-btn.primary').length,
      submit: Boolean(panel.querySelector('[data-testid="inspector-submit"]')),
      text: panel.innerText.slice(0, 200),
    };
  })()`);
  const shot2 = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(join(outDir, `${scenario}-${theme}-${width}x${height}-inspector.png`), Buffer.from(shot2.result.data, 'base64'));
}
if (args.includes('--drawer')) {
  interaction = interaction ?? {};
  const drawerId = arg('drawer', 'map');
  await evaluate(`(() => {
    const trigger = [...document.querySelectorAll('.px-menu-trigger')].pop();
    if (trigger) trigger.click();
    return true;
  })()`);
  await new Promise((resolve) => setTimeout(resolve, 300));
  interaction.menu = await evaluate(`(() => {
    const items = [...document.querySelectorAll('.px-menu-item')].map((el) => el.innerText.trim());
    const target = [...document.querySelectorAll('.px-menu-item')].find((el) => el.innerText.includes(${JSON.stringify(drawerId === 'map' ? '认知地图' : drawerId === 'source' ? '流程图源码' : drawerId)}));
    if (target) target.click();
    return { items, clicked: Boolean(target) };
  })()`);
  await new Promise((resolve) => setTimeout(resolve, 900));
  interaction.drawer = await evaluate(`(() => {
    const drawer = document.querySelector('[data-testid="drawer"]');
    return drawer ? { open: true, id: drawer.getAttribute('data-drawer'), text: drawer.innerText.slice(0, 200) } : { open: false };
  })()`);
  const shot3 = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(join(outDir, `${scenario}-${theme}-${width}x${height}-drawer.png`), Buffer.from(shot3.result.data, 'base64'));
}


if (args.includes('--coldstart')) {
  interaction = interaction ?? {};
  const steps = [];
  const step = async (name, fn) => {
    const value = await fn();
    steps.push({ name, value });
    return value;
  };
  await step('empty-primary', async () => clickSelector('[data-testid="empty-primary"]'));
  await new Promise((resolve) => setTimeout(resolve, 600));
  await step('modal-title', async () => evaluate(`(() => {
    const input = document.querySelector('.px-modal input');
    if (!input) return { found: false };
    input.focus();
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(input, '冷启动验收：结构可分离性');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return { found: true, value: input.value };
  })()`));
  await step('modal-create', async () => clickSelector('.px-modal .px-btn.primary'));
  await new Promise((resolve) => setTimeout(resolve, 1800));
  await step('intake-state', async () => evaluate(`(() => ({
    scene: document.querySelector('[data-testid="praxis-shell"]')?.getAttribute('data-scene'),
    runbar: document.querySelector('[data-testid="runbar"]')?.innerText.replaceAll(String.fromCharCode(10), ' | '),
    primary: document.querySelector('[data-testid="primary"]')?.innerText ?? null,
    nodeCount: document.querySelectorAll('[data-testid="node"]').length,
  }))()`));
  await step('primary-click', async () => clickSelector('[data-testid="primary"]'));
  await new Promise((resolve) => setTimeout(resolve, 800));
  await step('question-form', async () => evaluate(`(() => {
    const panel = document.querySelector('[data-testid="inspector"]');
    const form = panel?.querySelector('[data-testid="action-form"]');
    return {
      open: Boolean(panel),
      action: form?.getAttribute('data-action') ?? null,
      fields: [...(panel?.querySelectorAll('input, textarea') ?? [])].map((el) => el.getAttribute('placeholder') ?? el.getAttribute('aria-label') ?? el.name ?? el.type).slice(0, 8),
      submit: Boolean(panel?.querySelector('[data-testid="primary"]')),
    };
  })()`));
  await step('fill-question', async () => evaluate(`(() => {
    const panel = document.querySelector('[data-testid="inspector"]');
    if (!panel) return { ok: false };
    const setValue = (el, value) => {
      const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
      setter.call(el, value);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    };
    const inputs = [...panel.querySelectorAll('input')];
    const areas = [...panel.querySelectorAll('textarea')];
    if (inputs[0]) setValue(inputs[0], '结构可分离性是否由算子消融单独证实？');
    if (inputs[1]) setValue(inputs[1], '若结构可分离，则打乱结构后指标下降；否则不下降。');
    if (areas[0]) setValue(areas[0], '结构度量尚未定义');
    return { fields: inputs.length + areas.length };
  })()`));
  await new Promise((resolve) => setTimeout(resolve, 300));
  await step('submit', async () => clickSelector('[data-testid="primary"]'));
  await new Promise((resolve) => setTimeout(resolve, 1800));
  await step('after-submit', async () => evaluate(`(() => ({
    runbar: document.querySelector('[data-testid="runbar"]')?.innerText.replaceAll(String.fromCharCode(10), ' | '),
    banner: document.querySelector('[data-testid="banner"]')?.innerText ?? '',
    error: document.querySelector('[data-testid="action-error"]')?.innerText ?? '',
    progress: document.querySelector('[data-testid="progress"]')?.innerText ?? '',
  }))()`));
  interaction.coldstart = steps;
  const shot6 = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(join(outDir, `${scenario}-${theme}-${width}x${height}-coldstart.png`), Buffer.from(shot6.result.data, 'base64'));
}

if (args.includes('--blueprintsave')) {
  interaction = interaction ?? {};
  const steps = [];
  const step = async (name, fn) => { const value = await fn(); steps.push({ name, value }); return value; };
  await step('enter-blueprint', async () => evaluate(`(() => { const bp = [...document.querySelectorAll('.px-mode')].find((b) => b.innerText.trim() === '蓝图'); if (!bp) return { ok: false }; bp.click(); return { ok: true }; })()`));
  await new Promise((resolve) => setTimeout(resolve, 1200));
  const before = await step('revision-before', async () => evaluate("(async () => (await (await fetch('/praxis/api/graph', { headers: { 'x-praxis-request': '1' } })).json()).revision)()"));
  await step('drag-node', async () => {
    const box = await evaluate(`(() => { const el = document.querySelector('[data-testid="node"][data-type="stage"]'); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
    if (!box) return { ok: false };
    await mouseClick(box.x, box.y);
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: box.x, y: box.y, button: 'left', clickCount: 1 });
    for (let i = 1; i <= 6; i += 1) {
      await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: box.x, y: box.y - i * 8, button: 'left' });
    }
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: box.x, y: box.y - 48, button: 'left', clickCount: 1 });
    return { ok: true, from: box };
  });
  await new Promise((resolve) => setTimeout(resolve, 600));
  await step('draft-status', async () => evaluate(`document.querySelector('[data-testid="draft-status"]')?.innerText ?? ''`));
  await step('click-save', async () => clickSelector('[data-testid="primary"]'));
  await new Promise((resolve) => setTimeout(resolve, 700));
  await step('confirm-modal', async () => evaluate(`(() => { const modal = document.querySelector('.px-modal'); if (!modal) return { open: false }; const btn = [...modal.querySelectorAll('button')].find((b) => b.innerText.trim() === '确认保存'); if (btn) btn.click(); return { open: true, clicked: Boolean(btn) }; })()`));
  await new Promise((resolve) => setTimeout(resolve, 1800));
  await step('revision-after', async () => evaluate("(async () => (await (await fetch('/praxis/api/graph', { headers: { 'x-praxis-request': '1' } })).json()).revision)()"));
  await step('after-state', async () => evaluate(`(() => ({ scene: document.querySelector('[data-testid="praxis-shell"]')?.getAttribute('data-scene'), banner: document.querySelector('[data-testid="banner"]')?.innerText ?? '', runbar: document.querySelector('[data-testid="runbar"]')?.innerText.slice(0, 60) }))()`));
  interaction.blueprintsave = { before, steps };
  const shot7 = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(join(outDir, `${scenario}-${theme}-${width}x${height}-blueprintsave.png`), Buffer.from(shot7.result.data, 'base64'));
}

if (args.includes('--flow')) {
  interaction = interaction ?? {};
  const before = await evaluate(`(() => ({ text: document.querySelector('[data-testid="runbar"]')?.innerText ?? '' }))()`);
  interaction.before = before.text;
  const primary = await clickSelector('[data-testid="primary"]');
  interaction.primaryClick = primary;
  await new Promise((resolve) => setTimeout(resolve, 900));
  interaction.inspectorAfterPrimary = await evaluate(`(() => {
    const panel = document.querySelector('[data-testid="inspector"]');
    return panel ? { open: true, submit: Boolean(panel.querySelector('[data-testid="inspector-submit"]')), text: panel.innerText.slice(0, 160) } : { open: false };
  })()`);
  // use the sample loader when the form offers one
  await evaluate(`(() => { const btn = [...document.querySelectorAll('button')].find((b) => b.innerText.trim() === '载入示例'); if (btn) { btn.click(); return true; } return false; })()`);
  await new Promise((resolve) => setTimeout(resolve, 400));
  const submit = await clickSelector('[data-testid="inspector-submit"]');
  interaction.submitClick = submit;
  await new Promise((resolve) => setTimeout(resolve, 1800));
  interaction.after = await evaluate(`(() => ({
    runbar: document.querySelector('[data-testid="runbar"]')?.innerText ?? '',
    banner: document.querySelector('[data-testid="banner"]')?.innerText ?? '',
    error: document.querySelector('[data-testid="action-error"]')?.innerText ?? '',
  }))()`);
  const shot4 = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(join(outDir, `${scenario}-${theme}-${width}x${height}-after-submit.png`), Buffer.from(shot4.result.data, 'base64'));
}

if (args.includes('--blueprint')) {
  interaction = interaction ?? {};
  const modes = await evaluate(`(() => { const btns = [...document.querySelectorAll('.px-mode')]; const bp = btns.find((b) => b.innerText.trim() === '蓝图'); if (!bp) return { ok: false }; bp.click(); return { ok: true, disabled: bp.disabled }; })()`);
  interaction.blueprintClick = modes;
  await new Promise((resolve) => setTimeout(resolve, 1200));
  interaction.blueprint = await evaluate(`(() => ({
    mode: document.querySelector('[data-testid="praxis-shell"]')?.getAttribute('data-mode'),
    canvasMode: document.querySelector('[data-testid="canvas"]')?.getAttribute('data-mode'),
    ports: document.querySelectorAll('.px-port').length,
    draft: document.querySelector('[data-testid="draft-status"]')?.innerText ?? '',
    primary: document.querySelectorAll('.px-btn.primary').length,
  }))()`);
  const shot5 = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(join(outDir, `${scenario}-${theme}-${width}x${height}-blueprint.png`), Buffer.from(shot5.result.data, 'base64'));
}

const shot = await send('Page.captureScreenshot', { format: 'png' });
const shotPath = join(outDir, `${scenario}-${theme}-${width}x${height}.png`);
writeFileSync(shotPath, Buffer.from(shot.result.data, 'base64'));

const summary = { scenario, theme, size: `${width}x${height}`, health, screenshot: shotPath, metrics, consoleErrors, interaction };
writeFileSync(join(outDir, `${scenario}-${theme}-metrics.json`), JSON.stringify(summary, null, 2));
process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);

chrome.kill('SIGKILL');
if (!keep) {
  server.kill('SIGTERM');
  await new Promise((resolve) => setTimeout(resolve, 600));
}
process.exit(0);
