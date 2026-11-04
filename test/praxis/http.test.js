import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { registerHttp, handleApi, API_PREFIX } from '../../plugins/dsh-praxis/src/http.js';
import { createHost } from '../../plugins/dsh-praxis/src/host.js';

/**
 * Contract §4: loopback JSON API under /praxis/api.
 *
 * The wire behavior (403 same-origin guard, 400 body validation, 200 success,
 * 4xx engine rejection) lives in the route handler registered on the web
 * server, so these tests mount that handler on a fake web server and drive it
 * with fake req/res objects.
 */

const PORT = 3080;
const LOOPBACK_HOST = '127.0.0.1';
const BASE_HEADERS = {
  host: `${LOOPBACK_HOST}:${PORT}`,
  'x-praxis-request': '1',
};

function mount(host, { binding = LOOPBACK_HOST } = {}) {
  const routes = [];
  const ctx = {
    webServer: {
      host: binding,
      port: PORT,
      register(route) {
        routes.push(route);
        return () => {};
      },
    },
  };
  const dispose = registerHttp(ctx, host);
  assert.equal(routes.length, 1, 'exactly one route is registered');
  assert.equal(routes[0].kind, 'prefix');
  assert.ok(routes[0].path.startsWith('/praxis'));
  return { route: routes[0], dispose };
}

function fakeReq({
  method = 'GET',
  url = `${API_PREFIX}/state`,
  headers = {},
  body,
  remoteAddress = LOOPBACK_HOST,
} = {}) {
  const chunks = [];
  if (body !== undefined) {
    chunks.push(Buffer.from(typeof body === 'string' ? body : JSON.stringify(body)));
  }
  const req = Readable.from(chunks);
  req.method = method;
  req.url = url;
  req.headers = { ...BASE_HEADERS, ...headers };
  req.socket = { remoteAddress };
  return req;
}

function fakeRes() {
  const res = {
    statusCode: 0,
    headers: {},
    body: '',
    ended: false,
    writeHead(status, headers) {
      res.statusCode = status;
      for (const [key, value] of Object.entries(headers ?? {})) {
        res.headers[key.toLowerCase()] = value;
      }
      return res;
    },
    write(chunk) {
      res.body += Buffer.from(chunk).toString('utf8');
      return true;
    },
    end(chunk) {
      if (chunk !== undefined) res.body += Buffer.from(chunk).toString('utf8');
      res.ended = true;
      return res;
    },
  };
  return res;
}

async function call(route, req) {
  const res = fakeRes();
  await route.handler(req, res);
  assert.equal(res.ended, true, 'handler must end the response');
  const json = res.body ? JSON.parse(res.body) : null;
  return { status: res.statusCode, headers: res.headers, json };
}

function startCommand(commandId = 'http-start') {
  return {
    command: {
      commandId,
      action: 'start',
      payload: { playbookId: 'scientific-loop', title: 'HTTP 契约' },
    },
  };
}

test('http: only a loopback-bound web server accepts the route', () => {
  const host = createHost();
  assert.throws(() => mount(host, { binding: '0.0.0.0' }), /loopback/i);
});

test('http: GET state returns 200 with the contract state envelope', async () => {
  const host = createHost();
  const { route } = mount(host);
  const { status, json } = await call(route, fakeReq());
  assert.equal(status, 200);
  assert.equal(json.product, 'Praxis');
  // v2 T8.1/T8.4：wireVersion 2 与 {...view, view, serverTime, revision} 信封。
  assert.equal(json.wireVersion, 2);
  assert.ok(json.view && typeof json.view === 'object', 'state envelope carries view');
  assert.equal(json.view.wireVersion, 2);
  assert.ok(json.catalog && typeof json.catalog === 'object', 'state envelope carries catalog');
  assert.ok(!Number.isNaN(Date.parse(json.serverTime)), 'serverTime is an ISO timestamp');
  assert.equal(typeof json.revision, 'number');
  assert.ok(Array.isArray(json.runs));
  assert.ok(json.knobs && typeof json.knobs === 'object');
  assert.ok(json.defaults && typeof json.defaults === 'object');
  assert.ok(Array.isArray(json.knobFields) && json.knobFields.length > 0);
  assert.ok(Array.isArray(json.playbooks) && json.playbooks.length > 0);
  assert.ok(['durable', 'memory'].includes(json.durability));
});

test('http: localhost Host header is accepted like 127.0.0.1', async () => {
  const host = createHost();
  const { route } = mount(host);
  const { status } = await call(route, fakeReq({
    headers: { host: `localhost:${PORT}` },
  }));
  assert.equal(status, 200);
});

test('http: non-loopback Host header is forbidden with 403', async () => {
  const host = createHost();
  const { route } = mount(host);
  const { status, json } = await call(route, fakeReq({
    headers: { host: 'evil.example:3080' },
  }));
  assert.equal(status, 403);
  assert.equal(typeof json.error, 'string');
  assert.equal(typeof json.code, 'string');
});

test('http: cross-origin Origin is forbidden with 403', async () => {
  const host = createHost();
  const { route } = mount(host);
  const { status } = await call(route, fakeReq({
    headers: { origin: 'http://evil.example' },
  }));
  assert.equal(status, 403);
});

test('http: same-origin Origin and missing Origin are both allowed', async () => {
  const host = createHost();
  const { route } = mount(host);
  const sameOrigin = await call(route, fakeReq({
    headers: { origin: `http://${LOOPBACK_HOST}:${PORT}` },
  }));
  assert.equal(sameOrigin.status, 200);
  const missing = await call(route, fakeReq({ headers: {} }));
  assert.equal(missing.status, 200);
});

test('http: missing x-praxis-request header is forbidden with 403', async () => {
  const host = createHost();
  const { route } = mount(host);
  const req = fakeReq({ headers: { host: `${LOOPBACK_HOST}:${PORT}` } });
  delete req.headers['x-praxis-request'];
  const { status } = await call(route, req);
  assert.equal(status, 403);
});

test('http: POST command returns 200 with receipt and refreshed view', async () => {
  const host = createHost();
  const { route } = mount(host);
  const { status, headers, json } = await call(route, fakeReq({
    method: 'POST',
    url: `${API_PREFIX}/command`,
    body: startCommand(),
  }));
  assert.equal(status, 200);
  assert.match(String(headers['content-type']), /application\/json/);
  assert.equal(json.receipt.status, 'committed');
  assert.ok(json.receipt.runId);
  assert.ok(json.view && typeof json.view === 'object');
  assert.equal(json.view.activeRunId, json.receipt.runId);
  assert.equal(json.view.runs.length, 1);
});

test('http: engine rejection is a 4xx with the contract error envelope', async () => {
  const host = createHost();
  const { route } = mount(host);
  const started = await call(route, fakeReq({
    method: 'POST',
    url: `${API_PREFIX}/command`,
    body: startCommand('http-start-2'),
  }));
  const runId = started.json.receipt.runId;
  // v2 T1.2/T8.5：冻结前必须先记录 question，这是带 blockers 的规范 422 拒绝。
  const { status, json } = await call(route, fakeReq({
    method: 'POST',
    url: `${API_PREFIX}/command`,
    body: {
      command: {
        commandId: 'http-early-freeze',
        action: 'prereg_freeze',
        runId,
        payload: {
          prereg: {
            question: 'q', prediction: 'p', acceptance: 'a', acceptableFailure: 'f',
            controls: ['shuffle'], metrics: { primary: 'separation', threshold: 0.08 },
            input: { source: 'corpus' }, budget: { wallMin: 30 }, stop: { sameConclusion: 2 },
          },
        },
      },
    },
  }));
  assert.ok(status >= 400 && status < 500, `expected 4xx, got ${status}`);
  assert.equal(json.receipt.status, 'rejected');
  assert.equal(json.receipt.reasonCode, 'QUESTION_REQUIRED');
  assert.equal(json.code, 'QUESTION_REQUIRED');
  assert.equal(typeof json.error, 'string');
  assert.ok(Array.isArray(json.blockers ?? json.receipt.blockers));
  assert.equal(json.nextAction, 'question');
});

test('http: POST without command is 400', async () => {
  const host = createHost();
  const { route } = mount(host);
  const { status, json } = await call(route, fakeReq({
    method: 'POST',
    url: `${API_PREFIX}/command`,
    body: { notACommand: true },
  }));
  assert.equal(status, 400);
  assert.equal(typeof json.error, 'string');
  assert.equal(typeof json.code, 'string');
});

test('http: malformed JSON body is 400', async () => {
  const host = createHost();
  const { route } = mount(host);
  const { status, json } = await call(route, fakeReq({
    method: 'POST',
    url: `${API_PREFIX}/command`,
    body: '{not json',
  }));
  assert.equal(status, 400);
  assert.equal(typeof json.error, 'string');
  assert.equal(typeof json.code, 'string');
});

test('http: GET map returns the MapView for an existing run', async () => {
  const host = createHost();
  const { route } = mount(host);
  const started = await call(route, fakeReq({
    method: 'POST',
    url: `${API_PREFIX}/command`,
    body: startCommand('http-start-map'),
  }));
  const runId = started.json.receipt.runId;
  const { status, json } = await call(route, fakeReq({
    url: `${API_PREFIX}/map?runId=${runId}`,
  }));
  assert.equal(status, 200);
  assert.ok(json.map && typeof json.map === 'object');
  assert.equal(json.map.runId, runId);
  assert.ok(Array.isArray(json.map.nodes));
  assert.ok(Array.isArray(json.map.edges));
  assert.ok(Array.isArray(json.map.frontier));
  assert.ok(Array.isArray(json.map.blindSpots));
  assert.ok(Array.isArray(json.map.contradictions));
});

test('http: unknown API route is a 4xx JSON error', async () => {
  const host = createHost();
  const { route } = mount(host);
  const { status, json } = await call(route, fakeReq({ url: `${API_PREFIX}/does-not-exist` }));
  assert.ok(status >= 400 && status < 500);
  assert.equal(typeof json.error, 'string');
  assert.equal(typeof json.code, 'string');
});

test('http: handleApi is a pure routing seam with the same statuses', async () => {
  const host = createHost();
  assert.equal((await handleApi(host, { method: 'GET', pathname: `${API_PREFIX}/state` })).status, 200);
  assert.equal((await handleApi(host, { method: 'GET', pathname: '/elsewhere' })).status, 404);
  const bad = await handleApi(host, {
    method: 'POST',
    pathname: `${API_PREFIX}/command`,
    body: {},
  });
  assert.equal(bad.status, 400);
});
