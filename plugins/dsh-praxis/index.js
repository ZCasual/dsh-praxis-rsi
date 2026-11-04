import { createHost, toolResult, commandText, knobFields } from './src/host.js';
import { registerHttp } from './src/http.js';
import { createStore, defaultStatePath } from './src/store.js';

export const name = 'praxis';
export const inject = ['tools', 'commands', 'systemPrompt', 'webServer'];

const ACTIONS = [
  'start', 'prereg_freeze', 'discussion', 'pin_persona', 'experiment', 'review',
  'stage4', 'eval_report', 'eval_read', 'memory_propose', 'memory_commit',
  'map_claim', 'map_edge', 'decision', 'promote', 'set_knobs', 'gate', 'map', 'snapshot', 'activate',
];

const PARAMETERS = {
  type: 'object',
  additionalProperties: false,
  required: ['action'],
  properties: {
    action: { type: 'string', enum: ACTIONS, description: 'Engine action.' },
    commandId: { type: 'string', description: 'Idempotency key.' },
    runId: { type: 'string', description: 'Target run. Omit to use the active run.' },
    expectedDomainVersion: { type: 'number', description: 'Optimistic concurrency check.' },
    payload: { type: 'object', additionalProperties: true, description: 'Action payload.' },
  },
};

const OUTPUT = {
  type: 'object',
  additionalProperties: false,
  properties: {
    status: { type: 'string' },
    reasonCode: { type: 'string' },
    runId: { type: 'string' },
    nextAction: { type: 'string' },
    blockers: { type: 'array', items: { type: 'string' } },
    forked: { type: 'boolean' },
    state: { type: 'string' },
    version: { type: 'number' },
    reason: { type: 'string' },
  },
};

function numeric(value, fallback) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

export async function apply(ctx, config = {}) {
  const knobs = {
    heterogeneityFloor: numeric(config.heterogeneityFloor, 0.35),
    ambitionFloor: numeric(config.ambitionFloor, 0.45),
    inflationGap: numeric(config.inflationGap, 0.25),
    sameConclusionLimit: numeric(config.sameConclusionLimit, 2),
    maxPersonas: numeric(config.maxPersonas, 5),
    probeBudget: numeric(config.probeBudget, 8),
    evalSeeds: numeric(config.evalSeeds, 3),
    wallMin: numeric(config.wallMin, 45),
    agentDepth: numeric(config.agentDepth, 3),
    explorationQuota: numeric(config.explorationQuota, 0.2),
    primaryModel: config.primaryModel ?? 'primary',
    secondaryModel: config.secondaryModel ?? 'secondary',
  };
  const store = createStore({ path: config.statePath ?? defaultStatePath() });
  let restored = null;
  try {
    restored = await store.load();
  } catch (error) {
    ctx.logger?.warn?.('praxis: state load failed: %s', String(error));
  }
  const host = createHost({
    knobs,
    store,
    log: (format, value) => ctx.logger?.warn?.(format, value),
  });
  if (restored) {
    const ok = host.load(restored);
    ctx.logger?.info?.(`praxis: restored=${ok} runs=${host.view().runs.length} durability=${store.durability}`);
  }
  ctx.effect(() => () => { void store.close(); });

  ctx.effect(() => ctx.tools.register({
    name: 'rsi_run',
    description: 'Operate the Praxis research engine: start a playbook, freeze a contract, record discussion/experiment/review, read the gate, record decisions, or maintain the cognitive map. The Observatory panel calls the same engine method.',
    parameters: PARAMETERS,
    output: {
      schema: OUTPUT,
      render(_args, value) {
        return [{ type: 'text', text: commandText(value) }];
      },
    },
    async execute(args) {
      const receipt = host.execute(args, 'agent');
      await host.flush();
      return toolResult(receipt);
    },
  }));

  ctx.effect(() => ctx.tools.guard((execution) => {
    if (execution.name !== 'rsi_run') return undefined;
    const action = execution.arguments?.action;
    if (action === 'memory_commit' || action === 'set_knobs') return 'user-only action: open the Observatory or use the praxis command';
    return undefined;
  }));

  ctx.effect(() => ctx.commands.register({
    name: 'praxis',
    description: 'Inspect or open the Praxis observatory.',
    input: { hint: 'status | start <playbook> | gate | map' },
    async handler(invocation) {
      const line = (invocation.rawInput ?? '').trim();
      if (!line || line === 'status') {
        const view = host.view();
        const active = view.active;
        const text = active
          ? `${active.title} · ${active.state} · ${active.playbookId} · v${active.version}`
          : 'Praxis 空闲。用 start <playbook> 打开一个剧本。';
        return { kind: 'success', text };
      }
      if (line.startsWith('start')) {
        const playbookId = line.split(/\s+/)[1] ?? 'scientific-loop';
        const receipt = host.execute({
          action: 'start',
          commandId: `cmd-${Date.now()}`,
          payload: { playbookId, title: playbookId },
        }, 'user');
        await host.flush();
        return receipt.status === 'committed'
          ? { kind: 'success', text: commandText(receipt) }
          : { kind: 'error', text: commandText(receipt) };
      }
      if (line === 'gate' || line === 'map') {
        const view = host.view();
        const text = line === 'gate'
          ? JSON.stringify(view.active ? host.engine.gate(view.active.id, 'experiment') : { allow: false })
          : JSON.stringify(view.map);
        return { kind: 'success', text };
      }
      return { kind: 'error', text: 'Praxis 命令只接受 status / start <playbook> / gate / map。其余动作走 rsi_run。' };
    },
  }));

  ctx.effect(() => ctx.systemPrompt.section({
    name: 'praxis',
    order: 840,
    interpolate: false,
    text: () => {
      const view = host.view();
      const active = view.active;
      const gate = active ? host.engine.gate(active.id, 'experiment') : null;
      const line = active
        ? `active ${active.id} state ${active.state}; experiment ${gate.allow ? 'open' : `blocked:${gate.missing.join(',')}`}`
        : 'no active run';
      return [
        'Praxis is the research engine. Use rsi_run for every state change.',
        'A familiar path is not an answer to an unknown question. Register unknowns on the cognitive map.',
        'A frozen contract cannot be edited. A repeated conclusion must change path.',
        'Evaluator, stop rules, permissions, data boundary, and memory commit are outside the candidate.',
        'memory_commit and set_knobs are user-only.',
        line,
      ].join('\n');
    },
  }));

  try {
    ctx.effect(() => registerHttp(ctx, host));
    ctx.logger?.info?.(`praxis: http /praxis/api ready; durability=${store.durability}`);
  } catch (error) {
    ctx.logger?.error?.('praxis: http registration failed: %s', String(error));
  }

  ctx.logger?.info?.(`praxis ready: runs=${host.view().runs.length} durability=${store.durability}`);
}
