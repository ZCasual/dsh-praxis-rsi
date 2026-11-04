#!/usr/bin/env node
/**
 * Build client.js from client/*.js parts. Contract: docs/praxis/redesign/10-v2-contract.md §4.1.
 *
 * Parts are sorted by filename and concatenated into one function scope inside the
 * DSH client module factory. No imports, no JSX, no bundler.
 *
 * Usage:
 *   node build-client.mjs            # write client.js
 *   node build-client.mjs --check    # verify client.js is current (exit 1 when stale)
 */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const partsDir = join(here, 'client');
const target = join(here, 'client.js');

const HEADER = `/* AUTO-GENERATED FILE. Do not edit client.js by hand.
 * Source: plugins/dsh-praxis/client/*.js
 * Rebuild: node plugins/dsh-praxis/build-client.mjs
 */
`;

const PRELUDE = `window.__ModuleLoader__.load({
  id: '@local/dsh-praxis',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const { useState, useEffect, useRef, useCallback, useMemo, useReducer } = React;
`;

const TAIL = `    return praxisPlugin();
  },
});
`;

async function collectParts() {
  const names = (await readdir(partsDir)).filter((name) => name.endsWith('.js')).sort();
  if (!names.length) throw new Error(`no parts found in ${partsDir}`);
  const parts = [];
  for (const name of names) {
    const source = await readFile(join(partsDir, name), 'utf8');
    parts.push({ name, source });
  }
  return parts;
}

function assemble(parts) {
  const body = parts
    .map(({ name, source }) => `\n/* ===== ${name} ===== */\n${source.replace(/\s+$/, '')}\n`)
    .join('');
  const content = `${HEADER}${PRELUDE}${body}${TAIL}`;
  return { content, hash: createHash('sha256').update(content).digest('hex') };
}

function summarizeDiff(current, next) {
  const currentLines = current.split('\n');
  const nextLines = next.split('\n');
  const lines = [];
  const max = Math.max(currentLines.length, nextLines.length);
  for (let i = 0; i < max && lines.length < 8; i += 1) {
    if (currentLines[i] !== nextLines[i]) {
      lines.push(`  line ${i + 1}:`);
      lines.push(`    now: ${(currentLines[i] ?? '<missing>').slice(0, 120)}`);
      lines.push(`    new: ${(nextLines[i] ?? '<missing>').slice(0, 120)}`);
    }
  }
  return lines.join('\n');
}

const check = process.argv.includes('--check');
const build = await assemble(await collectParts());

let current = null;
try {
  current = await readFile(target, 'utf8');
} catch {
  current = null;
}

if (check) {
  if (current === build.content) {
    process.stdout.write(`client.js is current (sha256 ${build.hash.slice(0, 16)})\n`);
    process.exit(0);
  }
  process.stderr.write('client.js is stale. Rebuild with: node plugins/dsh-praxis/build-client.mjs\n');
  if (current) process.stderr.write(`${summarizeDiff(current, build.content)}\n`);
  process.exit(1);
}

if (current !== build.content) {
  await writeFile(target, build.content, 'utf8');
  process.stdout.write(`built client.js sha256=${build.hash.slice(0, 16)} bytes=${Buffer.byteLength(build.content)}\n`);
} else {
  process.stdout.write(`client.js unchanged sha256=${build.hash.slice(0, 16)}\n`);
}
