#!/usr/bin/env node
/* Release gate: the evidence manifest must be honest and complete.
 * Usage: node tools/evidence/verify-manifest.mjs [path]
 */
import { readFileSync } from 'node:fs';

const path = process.argv[2] ?? new URL('../../docs/praxis/evidence/manifest.json', import.meta.url);
const manifest = JSON.parse(readFileSync(path, 'utf8'));
const failures = [];

if (manifest.ok !== true) failures.push(`ok is ${manifest.ok}`);
if (!manifest.buildChecked) failures.push('buildChecked is false');
if (manifest.unexpectedMetricViolations !== 0) {
  failures.push(`unexpectedMetricViolations=${manifest.unexpectedMetricViolations}`);
}
if (!Array.isArray(manifest.screenshots) || manifest.screenshots.length < 20) {
  failures.push(`screenshots=${manifest.screenshots?.length ?? 0} (< 20)`);
}
const signoff = manifest.signoff ?? {};
const signed = signoff.signed ?? [];
const compat = signoff.compat ?? [];
const unverified = signoff.unverified ?? [];
if (signed.length < 7) failures.push(`signed=${signed.length} (< 7)`);
if (compat.length < 10) failures.push(`compat=${compat.length} (< 10)`);
if (unverified.length > 0) failures.push(`unverified=${unverified.map((item) => item.scene).join(',')}`);

const light = manifest.contrastSummary?.light;
const dark = manifest.contrastSummary?.dark;
for (const [name, summary] of [['light', light], ['dark', dark]]) {
  if (!summary) { failures.push(`contrastSummary.${name} missing`); continue; }
  if (!(summary.textMin >= 4.5)) failures.push(`${name} text contrast ${summary.textMin} (< 4.5)`);
  if (!(summary.nonTextMin >= 3)) failures.push(`${name} non-text contrast ${summary.nonTextMin} (< 3)`);
}

if (failures.length) {
  process.stderr.write(`manifest gate FAILED (${failures.length}):\n${failures.map((line) => `  - ${line}`).join('\n')}\n`);
  process.exit(1);
}
process.stdout.write(
  `manifest gate passed: ${manifest.screenshots.length} shots, ${signed.length} signed, `
  + `${compat.length} compat, 0 unverified, build ${String(manifest.buildHash).slice(0, 12)}\n`,
);
