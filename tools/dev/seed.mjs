#!/usr/bin/env node
/* Seed a deterministic demo run on an isolated Praxis instance.
 * Usage: node tools/dev/seed.mjs [port] [scenario]
 * Scenario: empty | fresh | frozen | blocked
 */
const port = Number(process.argv[2] ?? 3081);
const scenario = process.argv[3] ?? 'frozen';
const base = `http://127.0.0.1:${port}/praxis/api`;

async function api(path, init) {
  const response = await fetch(`${base}${path}`, {
    ...init,
    headers: { 'x-praxis-request': '1', 'content-type': 'application/json', ...(init?.headers ?? {}) },
  });
  const text = await response.text();
  let value = {};
  try { value = text ? JSON.parse(text) : {}; } catch { value = { raw: text }; }
  if (!response.ok) {
    const error = new Error(`${value.code ?? response.status}: ${value.error ?? ''}`);
    error.value = value;
    throw error;
  }
  return value;
}

let n = 0;
async function command(action, payload, options = {}) {
  n += 1;
  return api('/command', {
    method: 'POST',
    body: JSON.stringify({
      command: {
        commandId: `seed-${scenario}-${n}`,
        action,
        runId: options.runId,
        expectedDomainVersion: options.version,
        payload: payload ?? {},
      },
    }),
  });
}

const prereg = {
  question: '算子消融的增益是否来自结构性机制，而不是超参搜索的偶然命中？',
  prediction: '在 held-out 切分上，主指标相对基线提升 ≥ 0.08，且对照组不提升。',
  acceptance: '当且仅当主指标超过基线 0.08 且对照被破坏时判通过。',
  acceptableFailure: '若对照无效，接受假设不成立，并登记为未知。',
  controls: 'shuffle, label-shuffle',
  metrics: 'separation',
  input: 'declared-corpus',
  budget: '30 分钟 / 4 个代理',
  stop: '连续两轮无新证据即停止并转向。',
};

try {
  await api('/state');
} catch (error) {
  console.error(`Praxis not reachable on ${port}: ${error.message}`);
  process.exit(2);
}

if (scenario === 'empty') {
  console.log(JSON.stringify({ scenario, runs: 0 }));
  process.exit(0);
}

const started = await command('start', { title: '算子消融：未知结构是否真的被提取', playbookId: 'scientific-loop' }, { version: undefined });
const runId = started.receipt.runId;
let version = started.view.active.version;

async function step(action, payload) {
  const result = await command(action, payload, { runId, version });
  version = result.view.active.version;
  return result.receipt;
}

const question = await step('question', {
  question: {
    text: '算子消融的增益是否来自结构性机制？',
    hypothesis: '若增益来自结构，则打乱结构后增益消失；若来自超参搜索，则打乱后增益保留。',
    unknowns: ['结构度量尚未定义', 'held-out 切分是否独立'],
  },
});
if (question.status !== 'committed') console.error('question rejected:', question.reasonCode);

if (scenario !== 'fresh') {
  const frozen = await step('prereg_freeze', { prereg });
  if (frozen.status !== 'committed') console.error('prereg_freeze rejected:', frozen.reasonCode);
}

if (scenario === 'blocked') {
  // Leave the run at QUESTION so the UI shows QUESTION_REQUIRED as the single next action.
  version = (await api('/state')).view.active.version;
}

const state = await api('/state');
console.log(JSON.stringify({
  scenario, runId, state: state.view.active?.state, version: state.view.active?.version,
  nextAction: state.view.active?.nextAction, blocks: state.view.graph?.audit?.ok,
}));
