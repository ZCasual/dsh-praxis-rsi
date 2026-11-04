/** Loopback API for the Praxis Observatory panel. Same-origin, JSON only. */
const API_PREFIX = '/praxis/api';
const MAX_BODY = 256 * 1024;

function send(res, status, value) {
  const body = JSON.stringify(value);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'content-length': Buffer.byteLength(body),
  });
  res.end(body);
}

export function sameOrigin(req, port) {
  if (!req?.headers) return false;
  const host = req.headers.host;
  if (host !== `127.0.0.1:${port}` && host !== `localhost:${port}`) return false;
  if (req.headers['x-praxis-request'] !== '1') return false;
  const origin = req.headers.origin;
  return origin === undefined || origin === `http://${host}`;
}

async function readBody(req, maxBytes = MAX_BODY) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    const bytes = Buffer.from(chunk);
    size += bytes.length;
    if (size > maxBytes) {
      const error = new Error(`request exceeds ${maxBytes} bytes`);
      error.status = 400;
      throw error;
    }
    chunks.push(bytes);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    const error = new Error('request body is not JSON');
    error.status = 400;
    throw error;
  }
}

/** Pure request handler used by both the DSH route and tests: returns {status, value}. */
export async function handleApi(host, { method, pathname, search = '', body = {} }) {
  if (!pathname.startsWith(`${API_PREFIX}/`)) return { status: 404, value: { error: 'unknown route', code: 'NOT_FOUND' } };
  const route = pathname.slice(API_PREFIX.length + 1);
  if (route === 'state' && method === 'GET') {
    const view = host.view();
    return { status: 200, value: { ...view, view } };
  }
  if (route === 'health' && method === 'GET') {
    return { status: 200, value: { ok: true, product: 'Praxis', wireVersion: 1, durability: host.view().durability } };
  }
  if (route === 'map' && method === 'GET') {
    const runId = new URLSearchParams(search).get('runId') ?? undefined;
    try {
      return { status: 200, value: { map: host.map(runId) } };
    } catch (error) {
      return { status: 404, value: { error: error.message, code: 'NO_RUN' } };
    }
  }
  if (route === 'command' && method === 'POST') {
    const command = body?.command;
    if (!command || typeof command !== 'object' || typeof command.action !== 'string') {
      return { status: 400, value: { error: 'command.action is required', code: 'BAD_COMMAND' } };
    }
    const receipt = host.execute({ ...command, commandId: command.commandId ?? `ui-${Date.now()}` }, 'ui');
    await host.flush();
    const view = host.view();
    if (receipt.status === 'rejected') {
      return {
        status: 409,
        value: {
          error: receipt.reasonCode ?? 'command rejected',
          code: receipt.reasonCode ?? 'REJECTED',
          blockers: receipt.blockers ?? [],
          receipt,
          view,
        },
      };
    }
    return { status: 200, value: { receipt, view } };
  }
  return { status: 405, value: { error: `method ${method} not allowed`, code: 'METHOD_NOT_ALLOWED' } };
}

/** Register the loopback prefix route. Throws when the web server is not bound to loopback. */
export function registerHttp(ctx, host) {
  if (ctx.webServer.host !== '127.0.0.1') {
    throw new Error('Praxis Observatory requires a loopback Web server');
  }
  return ctx.webServer.register({
    kind: 'prefix',
    path: '/praxis',
    handler: async (req, res) => {
      const url = new URL(req.url ?? '/', 'http://localhost');
      if (!url.pathname.startsWith(`${API_PREFIX}/`)) {
        send(res, 404, { error: 'unknown route', code: 'NOT_FOUND' });
        return;
      }
      if (!sameOrigin(req, ctx.webServer.port)) {
        send(res, 403, { error: 'same-origin Praxis request required', code: 'FORBIDDEN_ORIGIN' });
        return;
      }
      try {
        const body = req.method === 'POST' ? await readBody(req) : {};
        const result = await handleApi(host, {
          method: req.method ?? 'GET',
          pathname: url.pathname,
          search: url.search,
          body,
        });
        send(res, result.status, result.value);
      } catch (error) {
        const status = error?.status ?? 500;
        const code = status === 400 ? 'BAD_REQUEST' : status === 403 ? 'FORBIDDEN_ORIGIN' : 'INTERNAL';
        send(res, status, { error: error instanceof Error ? error.message : String(error), code });
      }
    },
  });
}

export { API_PREFIX };
