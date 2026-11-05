#!/usr/bin/env node
/* Release gate: the evidence manifest must be honest and complete.
 * Usage: node tools/evidence/verify-manifest.mjs [path]
 *
 * Handles both suites:
 *   v3 (graph canvas): signoff.signed/compat/unverified + contrastSummary
 *   v4 (team cockpit):  per-shot sceneMetrics (branchCards, gateRows, primary, overflow)
 */
import { readFileSync } from 'node:fs';

const path = process.argv[2] ?? new URL('../../docs/praxis/evidence/manifest-v4.json', import.meta.url);
const manifest = JSON.parse(readFileSync(path, 'utf8'));
const failures = [];
const shots = Array.isArray(manifest.screenshots) ? manifest.screenshots : [];

if (manifest.ok !== true) failures.push(`ok is ${manifest.ok}`);
if (!manifest.buildChecked) failures.push('buildChecked is false');
if (manifest.errors?.length) failures.push(`errors=${JSON.stringify(manifest.errors)}`);
if (shots.length < 8) failures.push(`screenshots=${shots.length} (< 8)`);

const signed = manifest.signoff?.signed ?? [];
const unverified = manifest.signoff?.unverified ?? [];
if (manifest.signoff) {
  if (signed.length < 7) failures.push(`signed=${signed.length} (< 7)`);
  if (unverified.length) failures.push(`unverified=${unverified.map((item) => item.scene).join(',')}`);
  for (const theme of ['light', 'dark']) {
    const summary = manifest.contrastSummary?.[theme];
    if (!summary) { failures.push(`contrastSummary.${theme} missing`); continue; }
    if (!(summary.textMin >= 4.5)) failures.push(`${theme} text contrast ${summary.textMin} (< 4.5)`);
    if (!(summary.nonTextMin >= 3)) failures.push(`${theme} non-text contrast ${summary.nonTextMin} (< 3)`);
  }
}

const running = shots.filter((shot) => shot.scenario === 'running' && shot.viewport === '1440x1000');
if (running.length < 2) failures.push(`running 1440 shots=${running.length} (< 2, need light and dark)`);
for (const shot of running) {
  const metrics = shot.sceneMetrics ?? {};
  const label = `${shot.theme}/${shot.scenario}`;
  if (!(metrics.branchCards >= 2)) failures.push(`${label}: branchCards=${metrics.branchCards} (< 2)`);
  if (!(metrics.visibleCards >= 2)) failures.push(`${label}: visibleCards=${metrics.visibleCards} (< 2 parallel)`);
  if (metrics.gateRows !== 10) failures.push(`${label}: gateRows=${metrics.gateRows} (!= 10)`);
  if (metrics.primaryCount !== 1) failures.push(`${label}: primaryCount=${metrics.primaryCount} (!= 1)`);
  if (metrics.overflowX) failures.push(`${label}: overflowX=${metrics.overflowX}`);
  if (metrics.nodes) failures.push(`${label}: graph nodes present (${metrics.nodes})`);
  if (metrics.ports) failures.push(`${label}: topology ports present (${metrics.ports})`);
  if (metrics.teamChipSource && !['live', 'none'].includes(metrics.teamChipSource)) {
    failures.push(`${label}: teamChipSource=${metrics.teamChipSource}`);
  }
}

if (failures.length) {
  process.stderr.write(`manifest gate FAILED (${failures.length}):\n${failures.map((line) => `  - ${line}`).join('\n')}\n`);
  process.exit(1);
}
process.stdout.write(
  `manifest gate passed: ${shots.length} shots, build ${String(manifest.buildHash).slice(0, 12)}, `
  + `running 1440 × ${running.length} with >=2 parallel branches\n`,
);
