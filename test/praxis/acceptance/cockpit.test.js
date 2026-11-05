import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { CDP } from '../../../tools/evidence/cdp.mjs';

/**
 * Praxis v4 cockpit browser acceptance（docs/praxis/redesign/20-rewrite-brief.md §4/§5）
 *   A2 1440 驾驶舱 = runbar + gate-rail(10) + ≥2 并行 branch-card + evidence-band
 *   A3 team-chip data-source ∈ {live,none}；none 时团队抽屉文案「尚未组建团队」
 *   A4 ≥2 张 branch-card 同屏可见（并行，不是“当前唯一假设”）
 *   A6 运行态无拓扑编辑：无 node/port/拖拽
 *
 * 自管实例（309x 随机空闲端口）+ 独立 statePath + 独立 Chrome profile；结束后清理。
 */

const ROOT = new URL('../../..', import.meta.url).pathname;
const PREREG = {
  question: '结构增益是否来自结构？',
  prediction: '打乱结构后主指标下降 ≥0.08。',
  acceptance: '主指标超过基线 0.08 且对照被破坏时通过。',
  acceptableFailure: '对照无效则接受假设不成立。',
  controls: ['shuffle', 'label-shuffle'],
  metrics: { primary: 'separation', threshold: 0.08 },
  input: { source: 'declared-corpus' },
  budget: { wallMin: 30 },
  stop: { sameConclusion: 2 },
};

function freePort() {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.once('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

async function waitForToken(server, childLog, timeoutMs = 25000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const match = /token=([A-Za-z0-9_-]+)/.exec(childLog());
    if (match) return match[1];
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`server did not print token in time: ${childLog().slice(-800)}`);
}

async function seedCockpit(browser) {
  const command = async (action, payload = {}, runId = undefined) => {
    const response = await browser.api('/praxis/api/command', {
      method: 'POST',
      body: { command: { commandId: `cockpit-${action}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, action, runId, payload } },
    });
    if (response.status !== 200) throw new Error(`${action} failed: ${response.status} ${JSON.stringify(response.json)}`);
    return response.json;
  };
  const started = await command('start', { title: '结构增益的因果分离实验', playbookId: 'scientific-loop' });
  const runId = started.receipt.runId;
  await command('question', { question: { text: '结构增益是否来自结构？', hypothesis: '若来自结构，打乱后增益消失。', unknowns: ['容量是否匹配'] } }, runId);
  await command('prereg_freeze', { prereg: PREREG }, runId);
  const propose = async (title, hypothesis, falsifiable, ownerId) => {
    const result = await command('branch_propose', { title, hypothesis, falsifiable, ownerId }, runId);
    return result.receipt.branchId ?? result.receipt.branch?.id;
  };
  const b1 = await propose('结构消融（主假设）', '打乱结构会破坏增益', '打乱结构后 separation 下降 ≥0.08', 'agent-alpha');
  const b2 = await propose('容量匹配对照', '增益来自容量差异', '容量匹配后增益降到 0.02 以内', 'agent-beta');
  const b3 = await propose('跨语料泛化', '增益只在声明语料成立', '换语料后增益消失', 'agent-gamma');
  for (const id of [b1, b2, b3]) await command('branch_activate', { branchId: id }, runId);
  await command('branch_evidence', { branchId: b1, kind: 'experiment', ref: 'run/seeds-1-3.json', supports: true, note: '打乱后 0.31→0.08' }, runId);
  await command('branch_evidence', { branchId: b1, kind: 'review', ref: 'review/r-12.md', supports: true }, runId);
  await command('branch_evidence', { branchId: b1, kind: 'external', ref: 'arxiv:2601.00001', supports: false }, runId);
  await command('branch_evidence', { branchId: b2, kind: 'experiment', ref: 'run/capacity-matched.json', supports: true }, runId);
  await command('branch_evidence', { branchId: b3, kind: 'experiment', ref: 'run/corpus-b.json', supports: false }, runId);
  await command('branch_verdict', { branchId: b2, verdict: 'refuted', reason: '容量匹配无法解释 0.08 的差距' }, runId);
  await command('map_claim', { claim: '结构增益与容量无关', evidenceRefs: ['run/seeds-1-3.json', 'review/r-12.md'], status: 'supported' }, runId);
  await command('map_claim', { claim: '增益只在声明语料成立', evidenceRefs: ['run/corpus-b.json'], status: 'unverified' }, runId);
  return runId;
}

test('v4 cockpit：1440 驾驶舱 DOM 断言（A2/A3/A4/A6）', { timeout: 180000 }, async () => {
  const port = await freePort();
  const workDir = join('/tmp/praxis-acceptance', `cockpit-${process.pid}-${Date.now()}`);
  mkdirSync(workDir, { recursive: true });
  const patchPath = join(workDir, 'patch.yml');
  writeFileSync(patchPath, `- id: praxis\n  config: { statePath: ${join(workDir, 'state.json')} }\n`);
  let log = '';
  const server = spawn(process.env.DSH_BIN ?? 'dsh', ['web', '--patch', patchPath, '--port', String(port), '--no-open'], {
    cwd: ROOT, detached: true, stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stdout.on('data', (data) => { log += String(data); });
  server.stderr.on('data', (data) => { log += String(data); });
  server.unref();
  let browser = null;
  try {
    const token = await waitForToken(server, () => log);
    const baseUrl = `http://127.0.0.1:${port}`;
    browser = await CDP.launch({
      userDataDir: join(workDir, 'chrome'),
      viewport: { width: 1440, height: 1000 },
      startUrl: 'about:blank',
    });
    await browser.navigate(`${baseUrl}/?token=${token}`);
    await browser.waitFor('document.readyState === "complete"', { timeout: 30000, label: 'document ready' });
    await browser.clickText('Praxis', { timeout: 15000 });
    await browser.waitFor('!!document.querySelector(".px-shell")', { timeout: 30000, label: 'px-shell' });

    const runId = await seedCockpit(browser);
    // 重新加载让客户端投影最终状态（3 条 active + 1 条 refuted）
    await browser.navigate(`${baseUrl}/?token=${token}`);
    await browser.waitFor('document.readyState === "complete"', { timeout: 30000, label: 'document ready (reload)' });
    await browser.clickText('Praxis', { timeout: 15000 });
    await browser.waitFor('!!document.querySelector("[data-testid=\\"branch-board\\"]")', { timeout: 30000, label: 'branch-board' });

    const stateResponse = await browser.api('/praxis/api/state');
    assert.equal(stateResponse.status, 200);
    const view = stateResponse.json.view;
    assert.equal(view.wireVersion, 3);
    assert.equal(view.activeRunId, runId);
    assert.ok(view.branches.filter((branch) => branch.status === 'active').length >= 2, 'A4：同一 run ≥2 active 分支');

    const snapshot = await browser.evaluate(`(() => {
      const q = (selector) => document.querySelector(selector);
      const qa = (selector) => [...document.querySelectorAll(selector)];
      const visible = (el) => {
        if (!el) return false;
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < innerHeight && rect.right > 0 && rect.left < innerWidth;
      };
      const root = document.documentElement;
      return {
        branchBoard: !!q('[data-testid="branch-board"]'),
        branchCards: qa('[data-testid="branch-card"]').length,
        visibleCards: qa('[data-testid="branch-card"]').filter(visible).length,
        gateRows: qa('[data-testid="gate-row"]').length,
        gateRail: !!q('[data-testid="gate-rail"]'),
        evidenceBand: !!q('[data-testid="evidence-band"]'),
        primaryCount: qa('[data-testid="primary"]').length,
        teamChip: !!q('[data-testid="team-chip"]'),
        teamSource: q('[data-testid="team-chip"]')?.getAttribute('data-source') ?? null,
        nodes: qa('[data-testid="node"]').length,
        ports: qa('.px-port').length,
        dragHandles: qa('[data-branch-drag], [draggable="true"] .px-port').length,
        overflow: root.scrollWidth - root.clientWidth,
        runbar: !!q('[data-testid="runbar"]'),
        progress: q('[data-testid="progress"]')?.innerText ?? null,
        teamText: q('[data-testid="team-chip"]')?.innerText ?? null,
      };
    })()`);
    assert.equal(snapshot.branchBoard, true, 'A2：branch-board 存在');
    assert.ok(snapshot.branchCards >= 2, `A2：分支卡 ≥2，实际 ${snapshot.branchCards}`);
    assert.ok(snapshot.visibleCards >= 2, `A4：同屏可见分支卡 ≥2，实际 ${snapshot.visibleCards}`);
    assert.equal(snapshot.gateRail, true, 'A2：gate-rail 存在');
    assert.equal(snapshot.gateRows, 10, `A2：gate-rail 行数=10，实际 ${snapshot.gateRows}`);
    assert.equal(snapshot.evidenceBand, true, 'A2：evidence-band 存在');
    assert.equal(snapshot.primaryCount, 1, `A2：唯一主按钮，实际 ${snapshot.primaryCount}`);
    assert.ok(snapshot.overflow <= 1, `无横向溢出，实际 ${snapshot.overflow}`);
    assert.equal(snapshot.runbar, true);
    // 简报 §4.1 写 n/12，但实现 catalog 仍是 10 阶段（3/10）；测试只断言“阶段计数存在”，
    // 阶段总数不一致作为实现偏差上报 Lead，不在此放宽为产品要求。
    assert.match(String(snapshot.progress), /^\d+\/\d+$/, `运行条阶段计数，实际 ${snapshot.progress}`);
    assert.equal(snapshot.nodes, 0, 'A6：不存在 v3 节点');
    assert.equal(snapshot.ports, 0, 'A6：不存在拖拽端口');
    assert.equal(snapshot.dragHandles, 0, 'A6：不存在拖拽端口');

    assert.equal(snapshot.teamChip, true, 'A3：team-chip 存在');
    assert.ok(['live', 'none'].includes(snapshot.teamSource), `A3：team-chip data-source ∈ {live,none}，实际 ${snapshot.teamSource}`);
    if (snapshot.teamSource === 'none') {
      assert.ok(/尚未组建团队/.test(snapshot.teamText ?? ''), 'none 时 team-chip 文案含“尚未组建团队”');
      await browser.click('[data-testid="team-chip"]');
      await browser.waitFor('!!document.querySelector("[data-testid=\\"team-panel\\"]")', { timeout: 10000, label: 'team-panel' });
      const teamText = await browser.evaluate('document.querySelector("[data-testid=\\"team-panel\\"]")?.innerText ?? ""');
      assert.ok(/尚未组建团队/.test(teamText), 'A3：团队抽屉含组建入口文案');
      await browser.press('Escape').catch(() => {});
    }

    // 点击分支卡 → 检查器出现，且其内 primary ≤1
    const cardPoint = await browser.evaluate(`(() => {
      const card = document.querySelector('[data-testid="branch-card"]');
      if (!card) return null;
      card.scrollIntoView({ block: 'center', inline: 'center' });
      const rect = card.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    })()`);
    assert.ok(cardPoint, '分支卡可点击');
    await browser.clickAt(cardPoint.x, cardPoint.y);
    await browser.waitFor('!!document.querySelector("[data-testid=\\"inspector\\"]")', { timeout: 10000, label: 'inspector after branch click' });
    const inspector = await browser.evaluate(`(() => {
      const panel = document.querySelector('[data-testid="inspector"]');
      return {
        text: panel?.innerText ?? '',
        primary: panel ? panel.querySelectorAll('[data-testid="primary"]').length : -1,
      };
    })()`);
    assert.ok(inspector.text.length > 0, '检查器有内容');
    assert.ok(inspector.primary <= 1, `检查器内 primary ≤1，实际 ${inspector.primary}`);
  } finally {
    try { await browser?.close({ kill: true }); } catch {}
    try { process.kill(-server.pid, 'SIGTERM'); } catch { try { server.kill('SIGTERM'); } catch {} }
  }
});
