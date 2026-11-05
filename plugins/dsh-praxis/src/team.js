/**
 * Team projection: read the live DSH Agent Teams state, never invent members.
 *
 * Sources (all optional; each degrades to `source: 'none'`):
 *   ctx.agents.roots()                       -> live root Agents
 *   ctx.agentTeams.tryMembership(agent)      -> membership for that Agent
 *   ctx.agentTeams.listMembers(agent)        -> TeamMemberView[]
 *   ctx.agentTeams.listTasks(agent)          -> TeamTaskView[]
 *
 * The projection is read-only. Praxis does not spawn or interrupt agents here;
 * it reports what the runtime says.
 */

const TEAM_STATUS = ['running', 'inactive', 'provisioning', 'failed', 'unknown'];

function normalizeStatus(value) {
  const status = String(value ?? '').toLowerCase();
  if (status === 'running' || status === 'active' || status === 'busy') return 'running';
  if (status === 'inactive' || status === 'idle' || status === 'ready') return 'inactive';
  if (status === 'provisioning' || status === 'starting') return 'provisioning';
  if (status === 'failed' || status === 'error') return 'failed';
  return 'unknown';
}

function normalizeTask(task) {
  if (!task || typeof task !== 'object') return null;
  return {
    id: String(task.id ?? task.taskId ?? ''),
    title: String(task.subject ?? task.title ?? task.description ?? ''),
    status: String(task.status ?? 'pending'),
    ownerName: String(task.ownerName ?? task.owner ?? ''),
  };
}

function memberKind(member, index, leadId) {
  const id = String(member.id ?? member.sessionId ?? member.target ?? '');
  if (leadId && id === leadId) return 'lead';
  const raw = String(member.role ?? member.kind ?? '').toLowerCase();
  if (raw.includes('lead')) return 'lead';
  if (raw.includes('subagent')) return 'subagent';
  if (index === 0) return 'lead';
  return 'teammate';
}

function memberName(member) {
  return String(member.name ?? member.target ?? member.title ?? member.id ?? '未命名成员');
}

/** Build one MemberView from a runtime record. */
export function memberView(member, options = {}) {
  const { index = 0, leadId = '', tasks = [], branchByOwner = {} } = options;
  const id = String(member.id ?? member.sessionId ?? member.target ?? '');
  const name = memberName(member);
  const ownTasks = tasks.filter((task) => task.ownerName && task.ownerName === name);
  const currentTask = ownTasks.find((task) => task.status === 'in_progress')
    ?? ownTasks.find((task) => task.status === 'pending')
    ?? null;
  return {
    id,
    name,
    kind: memberKind(member, index, leadId),
    status: normalizeStatus(member.status ?? member.availability),
    model: member.model ? String(member.model) : null,
    currentTask: currentTask ? { id: currentTask.id, title: currentTask.title, status: currentTask.status } : null,
    branchIds: branchByOwner[id] ?? [],
  };
}

/** Empty projection. Used when the team services are absent. */
export function emptyTeam(reason = 'none') {
  return {
    source: 'none',
    reason,
    lead: null,
    members: [],
    tasks: [],
    counts: { running: 0, idle: 0, tasksOpen: 0, tasksDone: 0 },
  };
}

function counts(members, tasks) {
  return {
    running: members.filter((member) => member.status === 'running').length,
    idle: members.filter((member) => member.status === 'inactive').length,
    tasksOpen: tasks.filter((task) => task.status !== 'completed').length,
    tasksDone: tasks.filter((task) => task.status === 'completed').length,
  };
}

/**
 * Create a projector bound to one Cordis context.
 * Every call re-reads the runtime; the projector holds no cached state.
 */
export function createTeamProjector(ctx) {
  /** Optional services throw on property access when not injected; probe safely. */
  function service(key) {
    try {
      // reflect.get bypasses the inject gate; services that are absent return undefined.
      if (ctx?.reflect?.get) return ctx.reflect.get(key, false) ?? null;
      return ctx?.[key] ?? null;
    } catch {
      return null;
    }
  }

  function roots() {
    try {
      return service('agents')?.roots?.() ?? [];
    } catch {
      return [];
    }
  }

  function membership(agent) {
    try {
      return service('agentTeams')?.tryMembership?.(agent) ?? null;
    } catch {
      return null;
    }
  }

  return {
    /** Project the team that owns `branches` (ownerId -> branch ids). */
    project(branches = []) {
      const branchByOwner = {};
      for (const branch of branches) {
        const owner = branch?.ownerId;
        if (!owner) continue;
        branchByOwner[owner] = [...(branchByOwner[owner] ?? []), branch.id];
      }

      const teamService = service('agentTeams');
      if (!teamService) return { ...emptyTeam('no-agent-teams-service'), branchByOwner };

      const rootAgent = roots().find((agent) => membership(agent)) ?? roots()[0] ?? null;
      const teamMembership = rootAgent ? membership(rootAgent) : null;

      if (!rootAgent || !teamMembership) {
        // A root agent may exist without a team. Report the lead only, never fake teammates.
        if (rootAgent) {
          const lead = { id: String(rootAgent.id ?? ''), name: String(rootAgent.name ?? 'lead'), status: normalizeStatus(rootAgent.status) };
          return {
            source: 'none',
            reason: 'no-team-membership',
            lead,
            members: [],
            tasks: [],
            counts: { running: 0, idle: 0, tasksOpen: 0, tasksDone: 0 },
          };
        }
        return { ...emptyTeam('no-root-agent'), branchByOwner };
      }

      let rawMembers = [];
      let rawTasks = [];
      try {
        rawMembers = teamService.listMembers(rootAgent) ?? [];
      } catch {
        rawMembers = [];
      }
      try {
        rawTasks = teamService.listTasks(rootAgent) ?? [];
      } catch {
        rawTasks = [];
      }

      const tasks = rawTasks.map(normalizeTask).filter(Boolean);
      const leadId = String(rootAgent.id ?? '');
      const members = rawMembers.map((member, index) => memberView(member, { index, leadId, tasks, branchByOwner }));
      const leadMember = members.find((member) => member.kind === 'lead') ?? null;

      return {
        source: 'live',
        reason: null,
        lead: leadMember ? { id: leadMember.id, name: leadMember.name, status: leadMember.status } : null,
        members,
        tasks,
        counts: counts(members, tasks),
        branchByOwner,
      };
    },
  };
}

export { TEAM_STATUS };
