#!/usr/bin/env node
/**
 * Zero-dependency Chrome DevTools Protocol driver (contract: 10-v2-contract.md §6 A2).
 *
 * Uses Node's built-in global WebSocket (Node >= 22) and the local Chrome binary.
 * No npm dependencies. The driver talks to Chrome over --remote-debugging-port,
 * discovers the page target via http://127.0.0.1:<port>/json/list and then drives
 * Page/Runtime/Input domains.
 *
 * Usage as a library:
 *   import { CDP } from './cdp.mjs';
 *   const browser = await CDP.launch({ chromePath: '/usr/bin/google-chrome', viewport: { width: 1440, height: 1000 } });
 *   await browser.navigate('http://127.0.0.1:3081/?token=...');
 *   await browser.waitFor('!!document.querySelector(".px-shell")');
 *   await browser.screenshot('/tmp/shot.png');
 *   await browser.close();
 *
 * CLI smoke:
 *   node tools/evidence/cdp.mjs --url 'http://127.0.0.1:3081/?token=...' --screenshot /tmp/x.png
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const DEFAULT_CHROME = '/usr/bin/google-chrome';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson(url, timeoutMs = 1000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Chrome DevTools Protocol session over a WebSocket to one page target. */
export class CDP {
  constructor(ws, { info = null } = {}) {
    this.ws = ws;
    this.info = info;
    this.nextId = 1;
    this.pending = new Map();
    this.events = new Map();
    this.consoleErrors = [];
    this.closed = false;
    this.onMessage = this.onMessage.bind(this);
    this.onCloseEvent = this.onCloseEvent.bind(this);
    ws.addEventListener('message', this.onMessage);
    ws.addEventListener('close', this.onCloseEvent);
  }

  static async launch(options = {}) {
    const {
      chromePath = process.env.CHROME_PATH ?? DEFAULT_CHROME,
      port = 9333,
      userDataDir = '/tmp/praxis-acceptance/chrome-profile',
      viewport = { width: 1440, height: 1000 },
      headless = true,
      extraArgs = [],
      startUrl = 'about:blank',
    } = options;
    if (!existsSync(chromePath)) throw new Error(`chrome not found at ${chromePath}`);
    mkdirSync(userDataDir, { recursive: true });
    const args = [
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${userDataDir}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-background-networking',
      '--disable-component-update',
      '--disable-sync',
      '--disable-extensions',
      '--disable-gpu',
      '--hide-scrollbars',
      '--mute-audio',
      `--window-size=${viewport.width},${viewport.height}`,
    ];
    if (headless) args.push('--headless=new');
    args.push(...extraArgs, startUrl);
    const chromeProcess = spawn(chromePath, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    chromeProcess.stderr.on('data', () => {});
    let targets = null;
    const deadline = Date.now() + 20000;
    while (Date.now() < deadline) {
      if (chromeProcess.exitCode !== null) throw new Error(`chrome exited early (${chromeProcess.exitCode})`);
      targets = await fetchJson(`http://127.0.0.1:${port}/json/list`, 800);
      if (Array.isArray(targets) && targets.length > 0) break;
      await sleep(120);
    }
    if (!Array.isArray(targets) || targets.length === 0) {
      chromeProcess.kill('SIGKILL');
      throw new Error(`chrome debugging endpoint not ready on port ${port}`);
    }
    const page = targets.find((target) => target.type === 'page') ?? targets[0];
    if (!page?.webSocketDebuggerUrl) {
      chromeProcess.kill('SIGKILL');
      throw new Error('no page target with webSocketDebuggerUrl');
    }
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      ws.addEventListener('open', resolve, { once: true });
      ws.addEventListener('error', () => reject(new Error('CDP websocket failed')), { once: true });
    });
    const browser = new CDP(ws, { info: { pid: chromeProcess.pid, port, chromePath } });
    browser.chromeProcess = chromeProcess;
    await browser.send('Page.enable');
    await browser.send('Runtime.enable');
    await browser.send('Log.enable');
    await browser.setViewport(viewport);
    return browser;
  }

  onCloseEvent() {
    this.closed = true;
    for (const [, entry] of this.pending) entry.reject(new Error('CDP socket closed'));
    this.pending.clear();
  }

  onMessage(event) {
    let message;
    try {
      message = JSON.parse(event.data);
    } catch {
      return;
    }
    if (message.id) {
      const entry = this.pending.get(message.id);
      if (!entry) return;
      this.pending.delete(message.id);
      if (message.error) entry.reject(new Error(`${entry.method}: ${message.error.message}`));
      else entry.resolve(message.result);
      return;
    }
    if (message.method) {
      if (message.method === 'Runtime.consoleAPICalled' && message.params?.type === 'error') {
        this.consoleErrors.push((message.params.args ?? []).map((arg) => arg.value ?? arg.description ?? '').join(' '));
      }
      if (message.method === 'Log.entryAdded' && message.params?.entry?.level === 'error') {
        this.consoleErrors.push(message.params.entry.text ?? '');
      }
      const waiters = this.events.get(message.method) ?? [];
      this.events.set(message.method, []);
      for (const waiter of waiters) waiter(message.params);
    }
  }

  send(method, params = {}) {
    if (this.closed) return Promise.reject(new Error('CDP socket closed'));
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject, method });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  waitEvent(method, timeoutMs = 10000) {
    return new Promise((resolve, reject) => {
      const waiters = this.events.get(method) ?? [];
      let timer;
      const done = (params) => {
        clearTimeout(timer);
        resolve(params);
      };
      timer = setTimeout(() => reject(new Error(`timeout waiting event ${method}`)), timeoutMs);
      waiters.push(done);
      this.events.set(method, waiters);
    });
  }

  async setViewport({ width, height, deviceScaleFactor = 1 }) {
    await this.send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor,
      mobile: false,
      screenWidth: width,
      screenHeight: height,
    });
  }

  async navigate(url, { timeout = 30000, waitUntil = 'load' } = {}) {
    const loaded = waitUntil === 'load' ? this.waitEvent('Page.loadEventFired', timeout).catch(() => null) : null;
    const result = await this.send('Page.navigate', { url });
    if (result?.errorText) throw new Error(`navigate failed: ${result.errorText}`);
    if (loaded) {
      await loaded;
      await sleep(80);
    }
    // App-level readiness is polled by callers via waitFor.
    return result?.frameId ?? null;
  }

  async evaluate(expression, { awaitPromise = true, returnByValue = true, timeout = 30000 } = {}) {
    const result = await this.send('Runtime.evaluate', {
      expression,
      awaitPromise,
      returnByValue,
      userGesture: true,
      timeout,
    });
    if (result?.exceptionDetails) {
      const detail = result.exceptionDetails;
      throw new Error(
        `evaluate failed: ${detail.exception?.description ?? detail.text ?? 'unknown'} :: ${expression.slice(0, 160)}`,
      );
    }
    return result?.result?.value;
  }

  async waitFor(expression, { timeout = 15000, interval = 150, label = null } = {}) {
    const deadline = Date.now() + timeout;
    let lastError = null;
    while (Date.now() < deadline) {
      try {
        const value = await this.evaluate(expression);
        if (value) return value;
      } catch (error) {
        lastError = error;
      }
      await sleep(interval);
    }
    throw new Error(`waitFor timeout${label ? ` (${label})` : ''}: ${expression}${lastError ? `; last error: ${lastError.message}` : ''}`);
  }

  async click(selector, { timeout = 10000 } = {}) {
    await this.waitFor(`!!document.querySelector(${JSON.stringify(selector)})`, { timeout, label: selector });
    const point = await this.evaluate(`(() => {
      const el = document.querySelector(${JSON.stringify(selector)});
      if (!el) return null;
      el.scrollIntoView({ block: 'center', inline: 'center' });
      const rect = el.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    })()`);
    if (!point) throw new Error(`click target not found: ${selector}`);
    return this.clickAt(point.x, point.y);
  }

  async clickAt(x, y) {
    const base = { x, y, button: 'left', clickCount: 1 };
    await this.send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...base, buttons: 0 });
    await this.send('Input.dispatchMouseEvent', { type: 'mousePressed', ...base, buttons: 1 });
    await this.send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...base, buttons: 0 });
    return true;
  }

  async clickText(text, { timeout = 10000, selector = 'button, a, [role="button"], [role="tab"], li, div' } = {}) {
    await this.waitFor(
      `(() => [...document.querySelectorAll(${JSON.stringify(selector)})].some((el) => (el.textContent ?? '').includes(${JSON.stringify(text)})))()`,
      { timeout, label: `text:${text}` },
    );
    const point = await this.evaluate(`(() => {
      const target = [...document.querySelectorAll(${JSON.stringify(selector)})]
        .filter((el) => (el.textContent ?? '').includes(${JSON.stringify(text)}))
        .sort((a, b) => (a.textContent?.length ?? 0) - (b.textContent?.length ?? 0))[0];
      if (!target) return null;
      target.scrollIntoView({ block: 'center', inline: 'center' });
      const rect = target.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    })()`);
    if (!point) throw new Error(`click text target not found: ${text}`);
    return this.clickAt(point.x, point.y);
  }

  async type(text, { selector = null } = {}) {
    if (selector) await this.click(selector);
    await this.send('Input.insertText', { text: String(text) });
    return text;
  }

  async press(key, { modifiers = 0 } = {}) {
    const map = {
      Enter: { key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: '\r' },
      Escape: { key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 },
      Tab: { key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 },
      Backspace: { key: 'Backspace', code: 'Backspace', windowsVirtualKeyCode: 8 },
      Delete: { key: 'Delete', code: 'Delete', windowsVirtualKeyCode: 46 },
      ArrowLeft: { key: 'ArrowLeft', code: 'ArrowLeft', windowsVirtualKeyCode: 37 },
      ArrowUp: { key: 'ArrowUp', code: 'ArrowUp', windowsVirtualKeyCode: 38 },
      ArrowRight: { key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 },
      ArrowDown: { key: 'ArrowDown', code: 'ArrowDown', windowsVirtualKeyCode: 40 },
    };
    const definition = map[key];
    if (!definition) {
      await this.send('Input.insertText', { text: key });
      return key;
    }
    const params = { ...definition, modifiers };
    await this.send('Input.dispatchKeyEvent', { type: 'keyDown', ...params });
    if (definition.text) await this.send('Input.dispatchKeyEvent', { type: 'char', ...params });
    await this.send('Input.dispatchKeyEvent', { type: 'keyUp', ...params });
    return key;
  }

  async screenshot(path) {
    const result = await this.send('Page.captureScreenshot', { format: 'png', fromSurface: true });
    if (!result?.data) throw new Error('screenshot returned no data');
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, Buffer.from(result.data, 'base64'));
    return path;
  }

  async url() {
    return this.evaluate('location.href');
  }

  async title() {
    return this.evaluate('document.title');
  }

  /** Same-origin Host API calls executed inside the page (browser-trust headers included). */
  async api(path, { method = 'GET', body = null } = {}) {
    return this.evaluate(`(async () => {
      const response = await fetch(${JSON.stringify(path)}, {
        method: ${JSON.stringify(method)},
        headers: { 'content-type': 'application/json', 'x-praxis-request': '1' },
        ${body === null ? '' : `body: ${JSON.stringify(JSON.stringify(body))},`}
      });
      let json = null;
      try { json = await response.json(); } catch {}
      return { status: response.status, json };
    })()`);
  }

  async close({ kill = false } = {}) {
    try {
      await this.send('Browser.close');
    } catch {
      // best effort
    }
    this.closed = true;
    try {
      this.ws.close();
    } catch {
      // ignore
    }
    if (kill && this.chromeProcess && this.chromeProcess.exitCode === null) {
      this.chromeProcess.kill('SIGKILL');
    }
    if (this.chromeProcess && this.chromeProcess.exitCode === null) {
      await sleep(200);
      if (this.chromeProcess.exitCode === null) this.chromeProcess.kill('SIGKILL');
    }
  }
}

export async function launch(options) {
  return CDP.launch(options);
}

export default CDP;

// CLI smoke test: node tools/evidence/cdp.mjs --url ... [--screenshot /tmp/x.png]
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const arg = (name, fallback = null) => {
    const index = args.indexOf(`--${name}`);
    return index >= 0 ? args[index + 1] ?? fallback : fallback;
  };
  const url = arg('url');
  if (!url) {
    process.stderr.write('usage: node tools/evidence/cdp.mjs --url <url> [--screenshot <path>] [--evaluate <expr>]\n');
    process.exit(2);
  }
  const browser = await CDP.launch({
    chromePath: arg('chrome', DEFAULT_CHROME),
    port: Number(arg('port', 9333)),
    userDataDir: arg('profile', '/tmp/praxis-acceptance/chrome-profile-smoke'),
  });
  try {
    await browser.navigate(url);
    await browser.waitFor('document.readyState === "complete"', { timeout: 20000 });
    const expression = arg('evaluate', 'document.title');
    process.stdout.write(`${JSON.stringify(await browser.evaluate(expression))}\n`);
    const shot = arg('screenshot');
    if (shot) {
      await browser.screenshot(shot);
      process.stdout.write(`screenshot=${shot}\n`);
    }
  } finally {
    await browser.close();
  }
}
