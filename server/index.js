'use strict';
/**
 * techm-construction-api - integration hub for the Mazzant Construction PoC.
 * Simulates connections to external ticketing / CMMS / ERP / chat tools.
 * In-memory state, plain http + ws on ONE port (REST + websocket at /ws).
 * Everything here is SIMULATED - no real external system is contacted.
 */
const http = require('node:http');
const { WebSocketServer } = require('ws');
const pkg = require('./package.json');

const PORT = Number(process.env.PORT) || 4333;
const HOST = '0.0.0.0';
const STEP_MS = Number(process.env.TICKET_STEP_MS) > 0 ? Number(process.env.TICKET_STEP_MS) : 2500;
const ASSIGN_DELAY = STEP_MS; // new -> assigned
const START_DELAY = Math.round(STEP_MS * 2.8); // new -> in_progress (2.5s / 7s by default)
const MAX_BODY = 1024 * 1024;
const startedAt = Date.now();

const STATUSES = ['new', 'assigned', 'in_progress', 'resolved'];
const PRIORITIES = ['low', 'med', 'high', 'critical'];
const SOURCES = ['prediction', 'manual', 'cctv', 'schedule', 'alert'];
const SLA_HOURS = { critical: 4, high: 8, med: 24, low: 72 };

// ---------- helpers ----------
const now = () => new Date().toISOString();
const ago = (ms) => new Date(Date.now() - ms).toISOString();
const H = 3600 * 1000;
const rnd = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
const digits = (n) => {
  let s = '';
  for (let i = 0; i < n; i++) s += String(rnd(0, 9));
  return s;
};
const pick = (arr) => arr[rnd(0, arr.length - 1)];

const REF_GEN = {
  servicenow: () => 'INC' + digits(7),
  jira: () => 'CON-' + rnd(1000, 9999),
  maximo: () => 'WO' + digits(6),
  'sap-pm': () => '4000' + digits(6),
  teams: () => 'MSG-' + rnd(10000, 99999),
};

const ASSIGNEES = {
  Civil: ['Civil Works Queue', 'R. Nair (Site Engineer)', 'A. Haddad (Structures)'],
  MEP: ['MEP Coordination Desk', 'S. Iyer (Electrical)', 'K. Mansouri (HVAC)'],
  HSE: ['HSE Response Team', 'L. Fernandes (HSE Officer)', 'M. Al Suwaidi (Safety Lead)'],
  Procurement: ['Procurement Desk', 'P. Menon (Buyer)', 'D. Okafor (Expediter)'],
  'Plant & Equipment': ['Plant Maintenance Crew', 'V. Kumar (Mechanical)', 'T. Rahman (Fleet Planner)'],
  Marine: ['Marine Ops Desk', 'C. Dsouza (Marine Supervisor)', 'H. Al Zaabi (Dredging)'],
  _default: ['Service Desk L2', 'Site Ops Coordinator'],
};
const assigneeCounters = {};
function nextAssignee(dept) {
  const list = ASSIGNEES[dept] || ASSIGNEES._default;
  const k = ASSIGNEES[dept] ? dept : '_default';
  const i = assigneeCounters[k] || 0;
  assigneeCounters[k] = i + 1;
  return list[i % list.length];
}

function routeByDepartment(dept) {
  if (dept === 'HSE') return 'jira';
  if (dept === 'Plant & Equipment') return 'maximo';
  if (dept === 'Procurement') return 'sap-pm';
  return 'servicenow';
}

// ---------- state ----------
let integrations = new Map();
let tickets = []; // oldest first internally
let logs = [];
let ticketSeq = 2001;
const timers = new Set();

function seedIntegrations() {
  const defs = [
    { id: 'servicenow', name: 'ServiceNow ITSM', vendor: 'ServiceNow', kind: 'ticketing', status: 'connected', departments: ['Civil', 'MEP', 'Marine'], endpoint: 'https://mazzant-demo.service-now.com', lastSyncAt: ago(4 * 60 * 1000), latencyMs: 92, errorsLast24h: 0 },
    { id: 'jira', name: 'Jira Service Management', vendor: 'Atlassian', kind: 'ticketing', status: 'connected', departments: ['HSE', 'Civil'], endpoint: 'https://mazzant-demo.atlassian.net', lastSyncAt: ago(9 * 60 * 1000), latencyMs: 128, errorsLast24h: 1 },
    { id: 'maximo', name: 'IBM Maximo', vendor: 'IBM', kind: 'cmms', status: 'connected', departments: ['Plant & Equipment', 'MEP'], endpoint: 'https://maximo.mazzant-demo.example.com', lastSyncAt: ago(2 * 60 * 1000), latencyMs: 74, errorsLast24h: 0 },
    { id: 'sap-pm', name: 'SAP Plant Maintenance', vendor: 'SAP', kind: 'erp', status: 'disconnected', departments: ['Procurement', 'Plant & Equipment'], endpoint: 'https://sap-s4.mazzant-demo.example.com', lastSyncAt: ago(26 * H), latencyMs: 0, errorsLast24h: 3 },
    { id: 'teams', name: 'Microsoft Teams / Email', vendor: 'Microsoft', kind: 'chat', status: 'connected', departments: ['Civil', 'MEP', 'HSE', 'Procurement', 'Plant & Equipment', 'Marine'], endpoint: 'https://graph.microsoft.com', lastSyncAt: ago(60 * 1000), latencyMs: 58, errorsLast24h: 0 },
  ];
  integrations = new Map(defs.map((d) => [d.id, { ...d, webhookPath: `/api/integrations/${d.id}/webhook` }]));
}

function mkTicket(o) {
  const created = o.createdAt || now();
  const hours = SLA_HOURS[o.priority] || 24;
  const t = {
    id: 'TKT-' + ticketSeq++,
    woId: o.woId || null,
    title: o.title,
    description: o.description || '',
    department: o.department,
    priority: o.priority,
    status: o.status || 'new',
    system: o.system,
    externalRef: o.externalRef || REF_GEN[o.system](),
    assignee: o.assignee || nextAssignee(o.department),
    assetId: o.assetId || null,
    source: o.source || 'manual',
    createdAt: created,
    updatedAt: o.updatedAt || created,
    sla: { dueAt: new Date(new Date(created).getTime() + hours * H).toISOString(), breached: false },
    timeline: o.timeline || [],
  };
  return t;
}

function seedTickets() {
  const mk = (o) => {
    const t = mkTicket(o);
    tickets.push(t);
    return t;
  };
  mk({
    system: 'servicenow', woId: 'WO-1031', title: 'Concrete pump hydraulic leak - Zone B', description: 'Hydraulic oil seepage at boom slewing ring; pump isolated pending repair.',
    department: 'Civil', priority: 'high', status: 'resolved', assignee: 'R. Nair (Site Engineer)', assetId: 'EQ-CP-02', source: 'alert',
    createdAt: ago(26 * H), updatedAt: ago(18 * H),
    timeline: [
      { at: ago(26 * H), status: 'new', note: 'Ticket created and pushed to ServiceNow ITSM' },
      { at: ago(25.9 * H), status: 'assigned', note: 'Assigned to R. Nair (Site Engineer)' },
      { at: ago(24 * H), status: 'in_progress', note: 'Seal kit ordered, crew on site' },
      { at: ago(18 * H), status: 'resolved', note: 'Seal replaced, pressure test passed' },
    ],
  });
  mk({
    system: 'jira', woId: 'WO-1044', title: 'Loose scaffold tie - Level 3 east elevation', description: 'CCTV flagged a displaced scaffold tie near the hoist landing.',
    department: 'HSE', priority: 'critical', status: 'in_progress', assignee: 'HSE Response Team', assetId: null, source: 'cctv',
    createdAt: ago(2 * H), updatedAt: ago(1.5 * H),
    timeline: [
      { at: ago(2 * H), status: 'new', note: 'Ticket created and pushed to Jira Service Management' },
      { at: ago(1.95 * H), status: 'assigned', note: 'Assigned to HSE Response Team' },
      { at: ago(1.5 * H), status: 'in_progress', note: 'Area barricaded, scaffolders dispatched' },
    ],
  });
  mk({
    system: 'maximo', woId: 'WO-1038', title: 'Tower crane TC-02 slew bearing vibration', description: 'Predictive model flagged rising vibration RMS on slew drive.',
    department: 'Plant & Equipment', priority: 'med', status: 'assigned', assignee: 'Plant Maintenance Crew', assetId: 'EQ-TC-02', source: 'prediction',
    createdAt: ago(5 * H), updatedAt: ago(4.9 * H),
    timeline: [
      { at: ago(5 * H), status: 'new', note: 'Ticket created and pushed to IBM Maximo' },
      { at: ago(4.9 * H), status: 'assigned', note: 'Assigned to Plant Maintenance Crew' },
    ],
  });
  mk({
    system: 'sap-pm', woId: 'WO-1027', title: 'Rebar delivery slot rescheduling - Berth 4', description: 'Supplier requested a new delivery window; purchase order amendment needed.',
    department: 'Procurement', priority: 'med', status: 'assigned', assignee: 'Procurement Desk', assetId: null, source: 'schedule',
    createdAt: ago(30 * H), updatedAt: ago(29.8 * H),
    timeline: [
      { at: ago(30 * H), status: 'new', note: 'Ticket created and pushed to SAP Plant Maintenance' },
      { at: ago(29.8 * H), status: 'assigned', note: 'Assigned to Procurement Desk' },
    ],
  });
}

function clearTimers() {
  for (const t of timers) clearTimeout(t);
  timers.clear();
}

function reseed() {
  clearTimers();
  ticketSeq = 2001;
  tickets = [];
  logs = [];
  Object.keys(assigneeCounters).forEach((k) => delete assigneeCounters[k]);
  seedIntegrations();
  seedTickets();
  addLog('system', 'info', 'Integration hub initialised (simulated connectors)', false);
}

// ---------- serialisation ----------
function pubTicket(t) {
  const breached = t.status !== 'resolved' && Date.now() > new Date(t.sla.dueAt).getTime();
  return { ...t, sla: { dueAt: t.sla.dueAt, breached }, timeline: t.timeline.map((e) => ({ ...e })) };
}
function pubIntegration(i) {
  return { ...i, departments: [...i.departments], ticketsSynced: tickets.filter((t) => t.system === i.id).length };
}

// ---------- ws ----------
let wss = null;
function broadcast(msg) {
  if (!wss) return;
  const data = JSON.stringify(msg);
  for (const c of wss.clients) {
    if (c.readyState === 1) {
      try { c.send(data); } catch { /* ignore */ }
    }
  }
}
function addLog(system, level, text, emit = true) {
  const log = { at: now(), system, level, text };
  logs.push(log);
  if (logs.length > 200) logs = logs.slice(-200);
  if (emit) broadcast({ type: 'log', log });
}
function emitTicket(t) { broadcast({ type: 'ticket', ticket: pubTicket(t) }); }
function emitIntegration(i) { broadcast({ type: 'integration', integration: pubIntegration(i) }); }

// ---------- ticket lifecycle ----------
function setStatus(t, status, note) {
  t.status = status;
  t.updatedAt = now();
  t.timeline.push({ at: t.updatedAt, status, note });
}
function schedule(fn, ms) {
  const h = setTimeout(() => { timers.delete(h); try { fn(); } catch (e) { console.error(e); } }, ms);
  timers.add(h);
}
function scheduleLifecycle(t) {
  schedule(() => {
    if (!tickets.includes(t) || t.status !== 'new') return;
    setStatus(t, 'assigned', `Assigned to ${t.assignee}`);
    addLog(t.system, 'info', `${t.externalRef} assigned to ${t.assignee} (${t.id})`);
    emitTicket(t);
  }, ASSIGN_DELAY);
  schedule(() => {
    if (!tickets.includes(t) || (t.status !== 'assigned' && t.status !== 'new')) return;
    setStatus(t, 'in_progress', `Work started by ${t.assignee}`);
    addLog(t.system, 'info', `${t.externalRef} in progress (${t.id})`);
    emitTicket(t);
  }, START_DELAY);
}

// ---------- http plumbing ----------
class HttpError extends Error {
  constructor(status, code, extra) { super(code); this.status = status; this.code = code; this.extra = extra; }
}

function send(res, status, body) {
  const data = body === undefined ? '' : JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(data),
    'Cache-Control': 'no-store',
    ...CORS,
  });
  res.end(data);
}
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
  'Access-Control-Max-Age': '86400',
};

function readJson(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let failed = false;
    req.on('data', (c) => {
      if (failed) return;
      size += c.length;
      if (size > MAX_BODY) { failed = true; reject(new HttpError(413, 'payload_too_large')); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      if (failed) return;
      const raw = Buffer.concat(chunks).toString('utf8').trim();
      if (!raw) return resolve({});
      try {
        const v = JSON.parse(raw);
        if (v === null || typeof v !== 'object' || Array.isArray(v)) return reject(new HttpError(400, 'invalid_json', { message: 'Body must be a JSON object' }));
        resolve(v);
      } catch {
        reject(new HttpError(400, 'invalid_json', { message: 'Body is not valid JSON' }));
      }
    });
    req.on('error', () => reject(new HttpError(400, 'bad_request')));
  });
}

function getIntegration(id) {
  const i = integrations.get(id);
  if (!i) throw new HttpError(404, 'integration_not_found');
  return i;
}
function getTicket(id) {
  const t = tickets.find((x) => x.id === id);
  if (!t) throw new HttpError(404, 'ticket_not_found');
  return t;
}
const isStr = (v) => typeof v === 'string' && v.trim().length > 0;

function normPriority(p) {
  if (typeof p !== 'string') return 'med';
  const s = p.toLowerCase().trim();
  if (PRIORITIES.includes(s)) return s;
  if (s === 'medium' || s === 'normal') return 'med';
  if (s === 'urgent' || s === 'p1') return 'critical';
  return 'med';
}
const STATUS_ALIASES = {
  open: 'new', created: 'new', new: 'new',
  assigned: 'assigned',
  in_progress: 'in_progress', 'in progress': 'in_progress', inprogress: 'in_progress', wip: 'in_progress', 'work in progress': 'in_progress', started: 'in_progress',
  resolved: 'resolved', closed: 'resolved', done: 'resolved', completed: 'resolved', complete: 'resolved',
};
function normStatus(s) {
  if (typeof s !== 'string') return null;
  const v = STATUS_ALIASES[s.toLowerCase().trim()];
  return v && STATUSES.includes(v) ? v : null;
}

// ---------- route handlers ----------
function health() {
  return { ok: true, service: 'techm-construction-api', version: pkg.version, uptimeSec: Math.round((Date.now() - startedAt) / 1000), ws: '/ws', integrations: integrations.size, tickets: tickets.length };
}

async function route(req, res, method, path) {
  if (method === 'GET' && (path === '/' || path === '/api/health')) return send(res, 200, health());
  if (method === 'GET' && path === '/api/integrations') return send(res, 200, { integrations: [...integrations.values()].map(pubIntegration) });
  if (method === 'GET' && path === '/api/tickets') return send(res, 200, { tickets: tickets.map((t, i) => ({ t, i })).sort((a, b) => (a.t.createdAt < b.t.createdAt ? 1 : a.t.createdAt > b.t.createdAt ? -1 : b.i - a.i)).map((x) => pubTicket(x.t)) });
  if (method === 'GET' && path === '/api/logs') return send(res, 200, { logs: logs.slice(-100) });

  if (method === 'POST' && path === '/api/reset') {
    await readJson(req).catch(() => ({}));
    reseed();
    broadcast({ type: 'hello', serverTime: now(), reset: true });
    for (const i of integrations.values()) emitIntegration(i);
    for (const t of tickets) emitTicket(t);
    return send(res, 200, { ok: true });
  }

  let m = path.match(/^\/api\/integrations\/([^/]+)\/(test|connect|disconnect|sync|webhook)$/);
  if (m && method === 'POST') {
    const integ = getIntegration(decodeURIComponent(m[1]));
    const action = m[2];
    if (action === 'test') {
      const latencyMs = rnd(40, 180);
      const ok = integ.status !== 'disconnected';
      if (ok) { integ.latencyMs = latencyMs; }
      addLog(integ.id, ok ? 'info' : 'warn', ok ? `Connection test OK (${latencyMs} ms)` : 'Connection test failed - integration disconnected');
      if (ok) emitIntegration(integ);
      return send(res, 200, { ok, latencyMs: ok ? latencyMs : 0, message: ok ? `Reached ${integ.endpoint} in ${latencyMs} ms (simulated)` : `${integ.name} is disconnected - connect it first` });
    }
    if (action === 'connect') {
      integ.status = 'connected';
      integ.latencyMs = rnd(50, 140);
      integ.lastSyncAt = now();
      addLog(integ.id, 'info', `Connected to ${integ.name}`);
      emitIntegration(integ);
      return send(res, 200, pubIntegration(integ));
    }
    if (action === 'disconnect') {
      integ.status = 'disconnected';
      integ.latencyMs = 0;
      addLog(integ.id, 'warn', `Disconnected from ${integ.name}`);
      emitIntegration(integ);
      return send(res, 200, pubIntegration(integ));
    }
    if (action === 'sync') {
      if (integ.status === 'disconnected') {
        addLog(integ.id, 'warn', 'Sync skipped - integration disconnected');
        return send(res, 200, { ok: false, pulled: 0, pushed: 0, message: `${integ.name} is disconnected` });
      }
      const pulled = rnd(0, 3);
      const pushed = tickets.filter((t) => t.system === integ.id && t.status !== 'resolved').length;
      integ.lastSyncAt = now();
      integ.latencyMs = rnd(50, 150);
      addLog(integ.id, 'info', `Sync complete: pulled ${pulled}, pushed ${pushed}`);
      emitIntegration(integ);
      return send(res, 200, { ok: true, pulled, pushed });
    }
    if (action === 'webhook') {
      const body = await readJson(req);
      if (!isStr(body.ref)) throw new HttpError(400, 'ref_required');
      const status = normStatus(body.status);
      if (!status) throw new HttpError(400, 'invalid_status');
      const t = tickets.find((x) => x.externalRef === body.ref.trim());
      if (!t) {
        addLog(integ.id, 'warn', `Webhook for unknown ref ${body.ref}`);
        throw new HttpError(404, 'ticket_not_found');
      }
      setStatus(t, status, `${integ.name} webhook: ${body.ref} -> ${status}`);
      addLog(integ.id, 'info', `Webhook: ${t.externalRef} -> ${status} (${t.id})`);
      emitTicket(t);
      emitIntegration(integ);
      return send(res, 200, { ok: true });
    }
  }

  if (method === 'POST' && path === '/api/tickets') {
    const b = await readJson(req);
    if (!isStr(b.title)) throw new HttpError(400, 'title_required');
    if (b.system !== undefined && b.system !== null && b.system !== '' && !integrations.has(b.system)) throw new HttpError(400, 'unknown_system');
    const department = isStr(b.department) ? b.department.trim() : 'Civil';
    let system = isStr(b.system) ? b.system : routeByDepartment(department);
    const note0 = [];
    const requested = system;
    if (integrations.get(system).status === 'disconnected' && system !== 'servicenow') {
      system = 'servicenow';
      note0.push(`${integrations.get(requested).name} is disconnected - routed to ${integrations.get('servicenow').name}`);
    }
    const sysName = integrations.get(system).name;
    const t = mkTicket({
      title: b.title.trim().slice(0, 300),
      description: typeof b.description === 'string' ? b.description.slice(0, 4000) : '',
      department,
      priority: normPriority(b.priority),
      assetId: isStr(b.assetId) ? b.assetId : null,
      woId: isStr(b.woId) ? b.woId : null,
      source: SOURCES.includes(b.source) ? b.source : 'manual',
      system,
    });
    t.timeline.push({ at: t.createdAt, status: 'new', note: `Ticket created and pushed to ${sysName}` });
    for (const n of note0) t.timeline.push({ at: t.createdAt, status: 'new', note: n });
    tickets.push(t);
    const integ = integrations.get(system);
    integ.lastSyncAt = now();
    addLog(system, 'info', `Created ${t.externalRef} for ${t.id}: ${t.title}`);
    for (const n of note0) addLog(requested, 'warn', n);
    scheduleLifecycle(t);
    emitTicket(t);
    emitIntegration(integ);
    return send(res, 201, { ticket: pubTicket(t) });
  }

  m = path.match(/^\/api\/tickets\/([^/]+)$/);
  if (m && method === 'GET') return send(res, 200, { ticket: pubTicket(getTicket(decodeURIComponent(m[1]))) });
  if (m && method === 'PATCH') {
    const t = getTicket(decodeURIComponent(m[1]));
    const b = await readJson(req);
    let status = null;
    if (b.status !== undefined) {
      status = normStatus(b.status);
      if (!status) throw new HttpError(400, 'invalid_status');
    }
    if (b.assignee !== undefined && !isStr(b.assignee)) throw new HttpError(400, 'invalid_assignee');
    const notes = [];
    if (isStr(b.assignee) && b.assignee.trim() !== t.assignee) {
      t.assignee = b.assignee.trim();
      notes.push(`Reassigned to ${t.assignee}`);
    }
    if (isStr(b.note)) notes.push(b.note.trim());
    if (status && status !== t.status) {
      setStatus(t, status, notes.join(' - ') || `Status set to ${status}`);
    } else if (notes.length) {
      t.updatedAt = now();
      t.timeline.push({ at: t.updatedAt, status: t.status, note: notes.join(' - ') });
    }
    addLog(t.system, 'info', `Updated ${t.externalRef} (${t.id}) -> ${t.status}`);
    emitTicket(t);
    return send(res, 200, { ticket: pubTicket(t) });
  }

  throw new HttpError(404, 'not_found');
}

const server = http.createServer(async (req, res) => {
  const method = (req.method || 'GET').toUpperCase();
  let path = '/';
  try {
    path = new URL(req.url || '/', 'http://x').pathname;
    if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);
  } catch { /* keep '/' */ }
  if (method === 'OPTIONS') {
    res.writeHead(204, { ...CORS, 'Content-Length': '0' });
    return res.end();
  }
  try {
    await route(req, res, method, path);
  } catch (e) {
    if (res.headersSent) return;
    if (e instanceof HttpError) return send(res, e.status, { error: e.code, ...(e.extra || {}) });
    console.error('[error]', e);
    send(res, 500, { error: 'internal_error' });
  }
});

// ---------- websocket ----------
wss = new WebSocketServer({ noServer: true });
server.on('upgrade', (req, socket, head) => {
  let p = '';
  try { p = new URL(req.url || '/', 'http://x').pathname; } catch { /* ignore */ }
  if (p !== '/ws') {
    socket.write('HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n');
    return socket.destroy();
  }
  wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
});
wss.on('connection', (ws) => {
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });
  ws.on('error', () => {});
  ws.on('message', (raw) => {
    try {
      const m = JSON.parse(String(raw));
      if (m && m.type === 'ping') ws.send(JSON.stringify({ type: 'pong', serverTime: now() }));
    } catch { /* ignore */ }
  });
  ws.send(JSON.stringify({ type: 'hello', serverTime: now(), service: 'techm-construction-api', version: pkg.version, integrations: integrations.size, tickets: tickets.length }));
});
const heartbeat = setInterval(() => {
  for (const ws of wss.clients) {
    if (ws.isAlive === false) { ws.terminate(); continue; }
    ws.isAlive = false;
    try { ws.ping(); } catch { /* ignore */ }
  }
}, 25000);

// ---------- boot ----------
reseed();
server.listen(PORT, HOST, () => {
  console.log(`[techm-construction-api] v${pkg.version} listening on http://${HOST}:${PORT}  (ws: /ws)`);
});

function shutdown() {
  clearInterval(heartbeat);
  clearTimers();
  for (const ws of wss.clients) ws.terminate();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 1000).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
