import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Praxis v2 契约红测：客户端构建一致性（10-v2-contract.md §4.1 / §6）
 *   B1 模块拆分与命名；B2 生成入口；client-build.mjs --check 必须退出 0 且不写盘。
 */

const ROOT = resolve(import.meta.dirname, '../..');
const PLUGIN = resolve(ROOT, 'plugins/dsh-praxis');
const CLIENT_DIR = resolve(PLUGIN, 'client');
const BUNDLE = resolve(PLUGIN, 'client.js');
const PARTS = [
  '00-primitives.js',
  '10-store.js',
  '20-layout.js',
  '30-canvas.js',
  '40-inspector.js',
  '50-panels.js',
  '60-shell.js',
  '70-css.js',
];

test('client build B1: all frozen client modules exist and use module prefixes, no var', () => {
  assert.ok(existsSync(CLIENT_DIR), 'plugins/dsh-praxis/client/ must exist (§4.1)');
  const present = new Set(readdirSync(CLIENT_DIR));
  for (const part of PARTS) {
    assert.ok(present.has(part), `missing client module ${part}`);
    const source = readFileSync(resolve(CLIENT_DIR, part), 'utf8');
    assert.ok(source.trim().length > 0, `${part} is empty`);
    assert.equal(
      /\bvar\s+[A-Za-z_$]/.test(source),
      false,
      `B1: ${part} must not use var`,
    );
  }
  const allParts = readFileSync(resolve(CLIENT_DIR, '00-primitives.js'), 'utf8');
  assert.match(allParts, /function Prim[A-Z]/, 'B1: 00-primitives.js defines Prim* identifiers');
});

test('client build B2: generated bundle is the ModuleLoader factory with three slots', () => {
  assert.ok(existsSync(BUNDLE), 'plugins/dsh-praxis/client.js generated bundle');
  const source = readFileSync(BUNDLE, 'utf8');
  assert.match(source, /__ModuleLoader__\.load\(/, 'B2: module loader wrapper');
  assert.match(source, /factory\(require\)/, 'B2: factory(require) signature');
  assert.match(source, /function praxisPlugin\(/, 'B2: 60-shell.js defines praxisPlugin()');
  for (const slot of ['sidebar.panellist', 'conversation.composer.dock']) {
    assert.ok(source.includes(slot), `B2: bundle registers slot ${slot}`);
  }
  assert.ok(source.includes('praxis'), 'B2: main slot key praxis');
});

test('client build B3/B4: single shared store instance and one style render (static contract)', () => {
  const shell = readFileSync(resolve(CLIENT_DIR, '60-shell.js'), 'utf8');
  assert.match(shell, /ShellApp/, 'B2: ShellApp defined');
  assert.match(shell, /ShellDock/, 'B2: ShellDock defined');
  assert.match(shell, /StoreUse\(/, 'B3: shell consumes shared store hook');
  assert.match(shell, /<style>|CssText/, 'B4: ShellApp renders CssText');
  const store = readFileSync(resolve(CLIENT_DIR, '10-store.js'), 'utf8');
  assert.match(store, /StoreCreate/, 'B3: StoreCreate singleton');
  assert.match(store, /StoreUse/, 'B3: StoreUse hook');
  assert.match(store, /expectedDomainVersion/, 'B5: StoreSend carries expectedDomainVersion');
  assert.match(store, /409|CONFLICT|stale/, 'B5: 409 → stale handling');
});

test('client build: build-client.mjs --check exits 0 and does not write the bundle', () => {
  const script = resolve(PLUGIN, 'build-client.mjs');
  assert.ok(existsSync(script), 'plugins/dsh-praxis/build-client.mjs (§4.1)');
  const before = readFileSync(BUNDLE, 'utf8');
  const result = spawnSync(process.execPath, [script, '--check'], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 60000,
  });
  assert.equal(
    result.status,
    0,
    `--check must exit 0 (stdout: ${result.stdout}\nstderr: ${result.stderr})`,
  );
  const after = readFileSync(BUNDLE, 'utf8');
  assert.equal(after, before, '--check must 只比对不写盘 (§4.1)');
});
