import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTeamProjector, emptyTeam, TEAM_STATUS } from '../../plugins/dsh-praxis/src/team.js';

/**
 * Praxis v4 团队投影契约（docs/praxis/redesign/20-rewrite-brief.md §3）
 *   - live：members 与 listMembers 一致、kind/status 归一、currentTask、branchIds
 *   - none：无服务 / 无 membership 时不得伪造 members；lead 可单列
 *   - 安全底线：source==='none' 时 members.length 必须为 0
 */

function fakeCtx(services) {
  return {
    reflect: {
      get(key) {
        return services[key] ?? null;
      },
    },
  };
}

const ROOT = { id: 'root-1', name: 'Lead', status: 'running' };

function liveServices(overrides = {}) {
  return {
    agents: { roots: () => [ROOT] },
    agentTeams: {
      tryMembership: (agent) => (agent?.id === 'root-1' ? { teamId: 'team-1', rootId: 'root-1' } : null),
      listMembers: () => [
        { id: 'root-1', name: 'Lead', role: 'lead', status: 'running', model: 'm-primary' },
        { id: 'm-2', name: 'Alice', role: 'teammate', status: 'busy', model: 'm-fast' },
        { id: 'm-3', name: 'Bob', role: 'subagent', status: 'idle' },
      ],
      listTasks: () => [
        { id: 't-1', subject: '验证结构消融', status: 'in_progress', ownerName: 'Alice' },
        { id: 't-2', subject: '复核容量对照', status: 'completed', ownerName: 'Alice' },
        { id: 't-3', subject: '整理语料', status: 'pending', ownerName: 'Carol' },
      ],
      ...overrides,
    },
  };
}

test('live：source=live，members 与 listMembers 数量一致，lead/teammate/subagent 判定正确', () => {
  const projector = createTeamProjector(fakeCtx(liveServices()));
  const view = projector.project([{ id: 'b_1', ownerId: 'm-2' }, { id: 'b_2', ownerId: 'm-3' }]);
  assert.equal(view.source, 'live');
  assert.equal(view.members.length, 3);
  assert.deepEqual(view.members.map((member) => member.kind), ['lead', 'teammate', 'subagent']);
  assert.equal(view.lead.id, 'root-1');
  assert.equal(view.lead.name, 'Lead');
});

test('status 归一化：busy/idle/starting/error/未知 分别映射 running/inactive/provisioning/failed/unknown', () => {
  const services = liveServices({
    listMembers: () => [
      { id: 'root-1', name: 'Lead', role: 'lead', status: 'active' },
      { id: 'm-1', name: 'A', role: 'teammate', status: 'idle' },
      { id: 'm-2', name: 'B', role: 'teammate', status: 'starting' },
      { id: 'm-3', name: 'C', role: 'teammate', status: 'error' },
      { id: 'm-4', name: 'D', role: 'teammate', status: 'quantum' },
    ],
  });
  const view = createTeamProjector(fakeCtx(services)).project([]);
  assert.deepEqual(view.members.map((member) => member.status), [
    'running', 'inactive', 'provisioning', 'failed', 'unknown',
  ]);
  assert.deepEqual(TEAM_STATUS, ['running', 'inactive', 'provisioning', 'failed', 'unknown']);
});

test('currentTask 归属：只取 ownerName 匹配的 in_progress（其次 pending），并计入 counts', () => {
  const view = createTeamProjector(fakeCtx(liveServices())).project([]);
  const alice = view.members.find((member) => member.name === 'Alice');
  assert.equal(alice.currentTask.id, 't-1');
  assert.equal(alice.currentTask.status, 'in_progress');
  assert.equal(view.members.find((member) => member.id === 'root-1').currentTask, null);
  assert.deepEqual(view.counts, { running: 2, idle: 1, tasksOpen: 2, tasksDone: 1 });
  assert.equal(view.tasks.length, 3);
});

test('branchIds 由 ownerId 反查，未拥有分支的成员为空数组', () => {
  const view = createTeamProjector(fakeCtx(liveServices())).project([
    { id: 'b_1', ownerId: 'm-2' },
    { id: 'b_2', ownerId: 'm-2' },
    { id: 'b_3', ownerId: 'missing-agent' },
  ]);
  assert.deepEqual(view.members.find((member) => member.id === 'm-2').branchIds, ['b_1', 'b_2']);
  assert.deepEqual(view.members.find((member) => member.id === 'm-3').branchIds, []);
});

test('无 agentTeams 服务：source=none、members=[]，不伪造团队', () => {
  const ctx = fakeCtx({ agents: { roots: () => [ROOT] } });
  const view = createTeamProjector(ctx).project([{ id: 'b_1', ownerId: 'root-1' }]);
  assert.equal(view.source, 'none');
  assert.equal(view.members.length, 0);
  assert.equal(view.reason, 'no-agent-teams-service');
  assert.deepEqual(view.tasks, []);
  assert.equal(view.lead, null);
});

test('有 root 但无 membership：source=none、reason=no-team-membership，lead 仍给出', () => {
  const services = {
    agents: { roots: () => [ROOT] },
    agentTeams: {
      tryMembership: () => null,
      listMembers: () => [{ id: 'ghost', name: 'Ghost', role: 'teammate' }],
      listTasks: () => [],
    },
  };
  const view = createTeamProjector(fakeCtx(services)).project([]);
  assert.equal(view.source, 'none');
  assert.equal(view.reason, 'no-team-membership');
  assert.equal(view.members.length, 0);
  assert.deepEqual(view.lead, { id: 'root-1', name: 'Lead', status: 'running' });
});

test('安全底线：任何 source=none 分支 members 必须为空（含服务抛错/无 root）', () => {
  const variants = [
    fakeCtx({}),
    fakeCtx({ agents: { roots: () => [] } }),
    fakeCtx({ agents: { roots: () => { throw new Error('boom'); } }, agentTeams: null }),
    fakeCtx({ agents: { roots: () => [ROOT] }, agentTeams: { tryMembership: () => { throw new Error('boom'); } } }),
    fakeCtx({ agents: { roots: () => [ROOT] }, agentTeams: { tryMembership: () => ({ teamId: 'x' }), listMembers: () => { throw new Error('boom'); } } }),
  ];
  for (const ctx of variants) {
    const view = createTeamProjector(ctx).project([{ id: 'b_1', ownerId: 'root-1' }]);
    if (view.source === 'none') {
      assert.equal(view.members.length, 0, `source=none 不得伪造成员：${JSON.stringify(view)}`);
    }
    assert.ok(view.source === 'live' || view.source === 'none');
  }
  const empty = emptyTeam('demo');
  assert.equal(empty.source, 'none');
  assert.equal(empty.members.length, 0);
  assert.equal(empty.reason, 'demo');
});
