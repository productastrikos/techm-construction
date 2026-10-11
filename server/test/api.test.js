'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const net = require('node:net');
const path = require('node:path');
const { spawn } = require('node:child_process');
const WebSocket = require('ws');

let child;
let base;
let wsUrl;

function freePort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.listen(0, '127.0.0.1', () => {
      const { port } = s.address();
      s.close(() => resolve(port));
    });
    s.on('error', reject);
  });
}

const j = async (method, p, body, raw) => {
  const res = await fetch(base + p, {
    method,
    headers: body !== undefined || raw !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: raw !== undefined ? raw : body !== undefined ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch { /* empty */ }
  return { status: res.status, data, headers: res.headers };
};

function wsConnect() {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    const msgs = [];
    const waiters = [];
    ws.on('message', (d) => {
      const m = JSON.parse(String(d));
      msgs.push(m);
      for (const w of [...waiters]) if (w.pred(m)) { waiters.splice(waiters.indexOf(w), 1); w.resolve(m); }
    });
    ws.waitFor = (pred, ms = 4000) => {
      const hit = msgs.find(pred);
      if (hit) return Promise.resolve(hit);
      return new Promise((res, rej) => {
        const w = { pred, resolve: res };
        waiters.push(w);
        setTimeout(() => rej(new Error('ws timeout')), ms).unref();
      });
    };
    ws.msgs = msgs;
    ws.on('open', () => resolve(ws));
    ws.on('error', reject);
  });
}

test.before(async () => {
  const port = await freePort();
  base = `http://127.0.0.1:${port}`;
  wsUrl = `ws://127.0.0.1:${port}/ws`;
  child = spawn(process.execPath, [path.join(__dirname, '..', 'index.js')], {
    env: { ...process.env, PORT: String(port), TICKET_STEP_MS: '100' },
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('server did not start')), 8000);
    child.stdout.on('data', (d) => { if (String(d).includes('listening')) { clearTimeout(t); resolve(); } });
    child.on('exit', (c) => reject(new Error('server exited ' + c)));
  });
});

test.after(() => { if (child) child.kill(); });

test('health on / and /api/health', async () => {
  for (const p of ['/', '/api/health']) {
    const r = await j('GET', p);
    assert.equal(r.status, 200);
    assert.equal(r.data.ok, true);
    assert.equal(r.data.service, 'techm-construction-api');
    assert.equal(r.data.ws, '/ws');
    assert.equal(r.data.integrations, 5);
    assert.equal(r.data.tickets, 4);
    assert.equal(typeof r.data.uptimeSec, 'number');
  }
});

test('integrations list has the 5 seeds with expected shape', async () => {
  const { data } = await j('GET', '/api/integrations');
  const ids = data.integrations.map((i) => i.id).sort();
  assert.deepEqual(ids, ['jira', 'maximo', 'sap-pm', 'servicenow', 'teams']);
  const by = Object.fromEntries(data.integrations.map((i) => [i.id, i]));
  assert.equal(by['sap-pm'].status, 'disconnected');
  for (const id of ['servicenow', 'jira', 'maximo', 'teams']) assert.equal(by[id].status, 'connected');
  for (const i of data.integrations) {
    assert.equal(i.webhookPath, `/api/integrations/${i.id}/webhook`);
    for (const k of ['name', 'vendor', 'kind', 'departments', 'endpoint', 'lastSyncAt', 'latencyMs', 'ticketsSynced', 'errorsLast24h']) assert.ok(k in i, k);
  }
  const { data: t } = await j('GET', '/api/tickets');
  for (const i of data.integrations) assert.equal(i.ticketsSynced, t.tickets.filter((x) => x.system === i.id).length);
});

test('seed tickets: newest first, includes resolved and in_progress', async () => {
  const { data } = await j('GET', '/api/tickets');
  assert.equal(data.tickets.length, 4);
  const st = data.tickets.map((t) => t.status);
  assert.ok(st.includes('resolved') && st.includes('in_progress'));
  assert.ok(new Date(data.tickets[0].createdAt) >= new Date(data.tickets[3].createdAt));
});

test('ticket creation validation', async () => {
  assert.equal((await j('POST', '/api/tickets', {})).status, 400);
  assert.equal((await j('POST', '/api/tickets', { title: '   ' })).status, 400);
  assert.equal((await j('POST', '/api/tickets', { title: 123 })).status, 400);
  assert.equal((await j('POST', '/api/tickets', { title: 'x', system: 'nope' })).status, 400);
  const bad = await j('POST', '/api/tickets', undefined, '{not json');
  assert.equal(bad.status, 400);
  assert.equal(bad.data.error, 'invalid_json');
});

test('routing by department + fallback + refs + sla', async () => {
  const mk = (department, extra) => j('POST', '/api/tickets', { title: 'T ' + department, department, ...extra });
  const hse = await mk('HSE', { priority: 'critical', woId: 'WO-1049', source: 'cctv', assetId: 'A1' });
  assert.equal(hse.status, 201);
  const t = hse.data.ticket;
  assert.equal(t.system, 'jira');
  assert.match(t.externalRef, /^CON-\d+$/);
  assert.match(t.id, /^TKT-\d{4}$/);
  assert.equal(t.status, 'new');
  assert.equal(t.woId, 'WO-1049');
  assert.equal(t.source, 'cctv');
  assert.equal(t.sla.breached, false);
  assert.equal(Math.round((new Date(t.sla.dueAt) - new Date(t.createdAt)) / 3600000), 4);
  assert.equal(t.timeline.length, 1);

  const pe = (await mk('Plant & Equipment')).data.ticket;
  assert.equal(pe.system, 'maximo');
  assert.match(pe.externalRef, /^WO\d{6}$/);
  assert.equal(pe.priority, 'med');

  const civ = (await mk('Civil')).data.ticket;
  assert.equal(civ.system, 'servicenow');
  assert.match(civ.externalRef, /^INC\d{7}$/);

  // Procurement routes to sap-pm, which is disconnected -> falls back to servicenow
  const pr = (await mk('Procurement')).data.ticket;
  assert.equal(pr.system, 'servicenow');
  assert.ok(pr.timeline.some((e) => /disconnected/i.test(e.note)));

  // explicit system honoured
  const tm = (await mk('Civil', { system: 'teams' })).data.ticket;
  assert.equal(tm.system, 'teams');
  assert.match(tm.externalRef, /^MSG-/);

  // sequential ids
  const n = (x) => Number(x.id.slice(4));
  assert.equal(n(pe), n(t) + 1);
  assert.equal(n(civ), n(pe) + 1);
});

test('lifecycle advances new -> assigned -> in_progress over websocket', async () => {
  const ws = await wsConnect();
  const hello = await ws.waitFor((m) => m.type === 'hello');
  assert.ok(hello.serverTime);
  const created = (await j('POST', '/api/tickets', { title: 'Lifecycle', department: 'MEP' })).data.ticket;
  await ws.waitFor((m) => m.type === 'ticket' && m.ticket.id === created.id && m.ticket.status === 'new');
  const a = await ws.waitFor((m) => m.type === 'ticket' && m.ticket.id === created.id && m.ticket.status === 'assigned');
  assert.ok(a.ticket.timeline.length >= 2);
  const p = await ws.waitFor((m) => m.type === 'ticket' && m.ticket.id === created.id && m.ticket.status === 'in_progress');
  assert.ok(p.ticket.timeline.length >= 3);
  assert.ok(ws.msgs.some((m) => m.type === 'log'));
  ws.close();
  // never auto-resolves
  await new Promise((r) => setTimeout(r, 600));
  const { data } = await j('GET', '/api/tickets');
  assert.equal(data.tickets.find((t) => t.id === created.id).status, 'in_progress');
});

test('PATCH ticket + webhook update', async () => {
  const t = (await j('POST', '/api/tickets', { title: 'Patch me', department: 'Civil' })).data.ticket;
  const ws = await wsConnect();
  const p = await j('PATCH', `/api/tickets/${t.id}`, { status: 'resolved', assignee: 'Jane Doe', note: 'Fixed on site' });
  assert.equal(p.status, 200);
  assert.equal(p.data.ticket.status, 'resolved');
  assert.equal(p.data.ticket.assignee, 'Jane Doe');
  assert.ok(p.data.ticket.timeline.some((e) => e.note.includes('Fixed on site')));
  await ws.waitFor((m) => m.type === 'ticket' && m.ticket.id === t.id && m.ticket.status === 'resolved');
  // auto-advance must not undo a manual resolve
  await new Promise((r) => setTimeout(r, 500));
  assert.equal((await j('GET', `/api/tickets/${t.id}`)).data.ticket.status, 'resolved');

  assert.equal((await j('PATCH', `/api/tickets/${t.id}`, { status: 'bogus' })).status, 400);
  assert.equal((await j('PATCH', '/api/tickets/TKT-9999', { status: 'new' })).status, 404);

  // webhook from the "external tool"
  const t2 = (await j('POST', '/api/tickets', { title: 'Webhook me', department: 'HSE' })).data.ticket;
  const w = await j('POST', '/api/integrations/jira/webhook', { ref: t2.externalRef, status: 'resolved' });
  assert.equal(w.status, 200);
  assert.deepEqual(w.data, { ok: true });
  await ws.waitFor((m) => m.type === 'ticket' && m.ticket.id === t2.id && m.ticket.status === 'resolved');
  assert.equal((await j('POST', '/api/integrations/jira/webhook', { ref: 'NOPE-1', status: 'resolved' })).status, 404);
  assert.equal((await j('POST', '/api/integrations/jira/webhook', { status: 'resolved' })).status, 400);
  assert.equal((await j('POST', '/api/integrations/jira/webhook', { ref: t2.externalRef, status: 'zzz' })).status, 400);
  ws.close();
});

test('connect / disconnect / test / sync', async () => {
  const ws = await wsConnect();
  let r = await j('POST', '/api/integrations/sap-pm/test');
  assert.equal(r.data.ok, false);

  r = await j('POST', '/api/integrations/sap-pm/connect');
  assert.equal(r.data.status, 'connected');
  await ws.waitFor((m) => m.type === 'integration' && m.integration.id === 'sap-pm' && m.integration.status === 'connected');

  r = await j('POST', '/api/integrations/sap-pm/test');
  assert.equal(r.data.ok, true);
  assert.ok(r.data.latencyMs >= 40 && r.data.latencyMs <= 180);

  r = await j('POST', '/api/integrations/sap-pm/sync');
  assert.equal(r.data.ok, true);
  assert.equal(typeof r.data.pulled, 'number');
  assert.equal(typeof r.data.pushed, 'number');

  // now Procurement routes to sap-pm
  const pr = (await j('POST', '/api/tickets', { title: 'Order steel', department: 'Procurement' })).data.ticket;
  assert.equal(pr.system, 'sap-pm');
  assert.match(pr.externalRef, /^4000\d{6}$/);

  r = await j('POST', '/api/integrations/sap-pm/disconnect');
  assert.equal(r.data.status, 'disconnected');
  r = await j('POST', '/api/integrations/sap-pm/sync');
  assert.equal(r.data.ok, false);

  assert.equal((await j('POST', '/api/integrations/nope/test')).status, 404);

  const logs = (await j('GET', '/api/logs')).data.logs;
  assert.ok(logs.length > 0 && logs.length <= 100);
  assert.ok(logs.every((l) => l.at && l.system && ['info', 'warn', 'error'].includes(l.level) && l.text));
  ws.close();
});

test('CORS headers + OPTIONS preflight + 404 JSON', async () => {
  const pre = await fetch(base + '/api/tickets', { method: 'OPTIONS', headers: { Origin: 'https://x.test', 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type' } });
  assert.ok(pre.status === 204 || pre.status === 200);
  assert.equal(pre.headers.get('access-control-allow-origin'), '*');
  assert.match(pre.headers.get('access-control-allow-headers').toLowerCase(), /content-type/);
  for (const m of ['GET', 'POST', 'PATCH', 'DELETE']) assert.match(pre.headers.get('access-control-allow-methods'), new RegExp(m));
  const g = await j('GET', '/api/tickets');
  assert.equal(g.headers.get('access-control-allow-origin'), '*');
  const nf = await j('GET', '/api/does-not-exist');
  assert.equal(nf.status, 404);
  assert.deepEqual(nf.data, { error: 'not_found' });
});

test('reset reseeds everything', async () => {
  await j('POST', '/api/tickets', { title: 'Before reset' });
  const r = await j('POST', '/api/reset');
  assert.deepEqual(r.data, { ok: true });
  const { data } = await j('GET', '/api/tickets');
  assert.equal(data.tickets.length, 4);
  assert.ok(!data.tickets.some((t) => t.title === 'Before reset'));
  const ints = (await j('GET', '/api/integrations')).data.integrations;
  assert.equal(ints.find((i) => i.id === 'sap-pm').status, 'disconnected');
  const next = (await j('POST', '/api/tickets', { title: 'After reset' })).data.ticket;
  assert.equal(next.id, 'TKT-2005');
});

test('websocket rejects other paths', async () => {
  await new Promise((resolve) => {
    const ws = new WebSocket(wsUrl.replace('/ws', '/nope'));
    ws.on('error', () => resolve());
    ws.on('unexpected-response', () => resolve());
    ws.on('open', () => { ws.close(); resolve(); assert.fail('should not open'); });
  });
});
