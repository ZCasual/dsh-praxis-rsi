/* Single shared snapshot store. Prefix Store*. Contract §4.2 B3, B4, B5.
 * App and Dock both call StoreUse(), so there is exactly one poller and one truth. */

const StoreBase = '/praxis/api';
const StorePollMs = 4000;

const StoreSingleton = {
  snapshot: null,
  phase: 'loading',
  error: '',
  conflict: '',
  updatedAt: 0,
  revision: 0,
  receipt: null,
  busy: 0,
  listeners: new Set(),
  timer: null,
  inflight: null,
  started: false,
  hidden: false,
};

/** Contract §4.2: StoreCreate() returns the one shared store instance. Idempotent. */
function StoreCreate() {
  return StoreSingleton;
}

function StoreEmit() {
  for (const listener of StoreSingleton.listeners) {
    try {
      listener();
    } catch {
      /* a broken subscriber must not stop the rest */
    }
  }
}

function StorePatch(patch) {
  Object.assign(StoreSingleton, patch);
  StoreEmit();
}

function StoreSubscribe(listener) {
  StoreSingleton.listeners.add(listener);
  return () => StoreSingleton.listeners.delete(listener);
}

async function StoreApi(path, init) {
  const headers = { 'x-praxis-request': '1', ...(init && init.headers) };
  const response = await fetch(`${StoreBase}${path}`, { ...init, headers, cache: 'no-store' });
  const text = await response.text();
  let value = {};
  try {
    value = text ? JSON.parse(text) : {};
  } catch {
    value = { error: text };
  }
  if (!response.ok) {
    const error = new Error(value.error ?? value.code ?? `HTTP ${response.status}`);
    error.status = response.status;
    error.code = value.code;
    error.value = value;
    throw error;
  }
  return value;
}

function StoreReason(code) {
  if (!code) return '';
  const reasons = StoreSingleton.snapshot?.catalog?.reasons ?? {};
  return reasons[code] ?? code;
}

function StoreApplyView(view) {
  if (!view || typeof view !== 'object') return;
  StorePatch({
    snapshot: view,
    phase: 'fresh',
    error: '',
    conflict: '',
    updatedAt: Date.now(),
    revision: Number(view.revision ?? view.active?.version ?? 0),
  });
}

async function StoreRefresh() {
  if (StoreSingleton.inflight) return StoreSingleton.inflight;
  StoreSingleton.inflight = (async () => {
    try {
      const value = await StoreApi('/state');
      StoreApplyView(value.view ?? value);
      return StoreSingleton.snapshot;
    } catch (error) {
      const hasData = Boolean(StoreSingleton.snapshot);
      StorePatch({
        phase: hasData ? 'stale' : 'error',
        error: error instanceof Error ? error.message : String(error),
      });
      return StoreSingleton.snapshot;
    } finally {
      StoreSingleton.inflight = null;
    }
  })();
  return StoreSingleton.inflight;
}

function StoreStart() {
  if (StoreSingleton.started) return;
  StoreSingleton.started = true;
  const tick = async () => {
    if (!StoreSingleton.hidden) await StoreRefresh();
    StoreSingleton.timer = setTimeout(tick, StorePollMs);
  };
  document.addEventListener('visibilitychange', () => {
    StoreSingleton.hidden = document.hidden;
    if (!document.hidden) void StoreRefresh();
  });
  void tick();
}

function StoreCommandId(action) {
  return `${action}-${Date.now().toString(36)}-${Math.floor(Math.random() * 46656).toString(36)}`;
}

/** Submit one command. Always pins expectedDomainVersion unless opts.force. */
async function StoreSend(action, payload, options = {}) {
  const command = {
    commandId: options.commandId ?? StoreCommandId(action),
    action,
    runId: options.runId ?? StoreSingleton.snapshot?.activeRunId ?? undefined,
    expectedDomainVersion: options.force ? undefined : (options.expectedDomainVersion ?? StoreSingleton.revision),
    payload: payload ?? {},
  };
  StorePatch({ busy: StoreSingleton.busy + 1, error: '' });
  try {
    const value = await StoreApi('/command', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ command }),
    });
    if (value.view) StoreApplyView(value.view);
    else await StoreRefresh();
    StorePatch({ receipt: value.receipt ?? null, busy: StoreSingleton.busy - 1 });
    return value.receipt ?? null;
  } catch (error) {
    const status = error?.status;
    const body = error?.value ?? {};
    if (body.view) {
      StorePatch({
        snapshot: body.view,
        updatedAt: Date.now(),
        revision: Number(body.view.revision ?? 0),
        phase: status === 409 ? 'stale' : StoreSingleton.phase,
      });
    }
    const code = body.code ?? error?.code;
    const message = code ? StoreReason(code) : (error instanceof Error ? error.message : String(error));
    StorePatch({
      busy: StoreSingleton.busy - 1,
      error: message,
      conflict: status === 409 ? message : '',
      receipt: body.receipt ?? { status: 'rejected', reasonCode: code, nextAction: body.nextAction, blockers: body.blockers },
    });
    return body.receipt ?? null;
  }
}

async function StoreActivate(runId) {
  const receipt = await StoreSend('activate', { runId }, { runId, force: true });
  await StoreRefresh();
  return receipt;
}

async function StoreStartRun(title, playbookId) {
  const receipt = await StoreSend('start', { title, playbookId }, { runId: undefined, force: true });
  await StoreRefresh();
  return receipt;
}

function StoreUse() {
  const [, force] = useReducer((value) => value + 1, 0);
  useEffect(() => {
    StoreStart();
    return StoreSubscribe(() => force());
  }, []);
  return StoreSingleton;
}

/** Read the latest graph projection without polling. */
async function StoreGraph(runId) {
  const suffix = runId ? `?runId=${encodeURIComponent(runId)}` : '';
  const value = await StoreApi(`/graph${suffix}`);
  return value.graph ?? value;
}
