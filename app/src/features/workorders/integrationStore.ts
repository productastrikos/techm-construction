import { create } from 'zustand';
import { api, wsUrl } from '../../lib/api';
import { tx } from '../../lib/bi';
import type { WorkOrder } from '../assets/woStore';

export type TicketStatus = 'new' | 'assigned' | 'in_progress' | 'resolved';
export interface Integration {
  id: string;
  name: string;
  vendor: string;
  kind: 'ticketing' | 'cmms' | 'erp' | 'chat';
  status: 'connected' | 'disconnected' | 'error';
  departments: string[];
  endpoint: string;
  webhookPath: string;
  lastSyncAt: string;
  latencyMs: number;
  ticketsSynced: number;
  errorsLast24h: number;
}
export interface Ticket {
  id: string;
  woId: string | null;
  title: string;
  description?: string;
  department: string;
  priority: 'low' | 'med' | 'high' | 'critical';
  status: TicketStatus;
  system: string;
  externalRef: string;
  assignee: string;
  assetId: string | null;
  source: string;
  createdAt: string;
  updatedAt: string;
  sla: { dueAt: string; breached: boolean };
  timeline: Array<{ at: string; status: string; note: string }>;
}
export interface LogLine {
  at: string;
  system: string;
  level: 'info' | 'warn' | 'error';
  text: string;
}

const now = () => new Date().toISOString();
const iso = (offsetMin: number) => new Date(Date.now() + offsetMin * 60000).toISOString();

/** used only when the backend is unreachable, so the demo still works fully offline */
const LOCAL_INTEGRATIONS: Integration[] = [
  { id: 'servicenow', name: 'ServiceNow ITSM', vendor: 'ServiceNow', kind: 'ticketing', status: 'connected', departments: ['Civil', 'MEP', 'Marine'], endpoint: 'https://techm.service-now.com', webhookPath: '/api/integrations/servicenow/webhook', lastSyncAt: iso(-3), latencyMs: 92, ticketsSynced: 128, errorsLast24h: 0 },
  { id: 'jira', name: 'Jira Service Management', vendor: 'Atlassian', kind: 'ticketing', status: 'connected', departments: ['HSE', 'Quality'], endpoint: 'https://techm.atlassian.net', webhookPath: '/api/integrations/jira/webhook', lastSyncAt: iso(-6), latencyMs: 134, ticketsSynced: 87, errorsLast24h: 1 },
  { id: 'maximo', name: 'IBM Maximo', vendor: 'IBM', kind: 'cmms', status: 'connected', departments: ['Plant & Equipment'], endpoint: 'https://maximo.techm.example', webhookPath: '/api/integrations/maximo/webhook', lastSyncAt: iso(-2), latencyMs: 61, ticketsSynced: 214, errorsLast24h: 0 },
  { id: 'sap-pm', name: 'SAP Plant Maintenance', vendor: 'SAP', kind: 'erp', status: 'disconnected', departments: ['Procurement'], endpoint: 'https://s4.techm.example', webhookPath: '/api/integrations/sap-pm/webhook', lastSyncAt: iso(-1440), latencyMs: 0, ticketsSynced: 0, errorsLast24h: 0 },
  { id: 'teams', name: 'Microsoft Teams / Email', vendor: 'Microsoft', kind: 'chat', status: 'connected', departments: ['All departments'], endpoint: 'https://graph.microsoft.com', webhookPath: '/api/integrations/teams/webhook', lastSyncAt: iso(-1), latencyMs: 48, ticketsSynced: 301, errorsLast24h: 0 },
];
const ASSIGNEES: Record<string, string[]> = {
  'Plant & Equipment': ['Maintenance planner - Plant', 'Crane workshop lead'],
  HSE: ['HSE Officer - shift A', 'HSE Manager'],
  Procurement: ['Expediting lead', 'Logistics coordinator'],
  Civil: ['Civil site engineer', 'Planning engineer'],
  MEP: ['MEP coordinator'],
  Marine: ['Marine superintendent'],
};
const routeByDept = (dept: string) => (dept === 'HSE' ? 'jira' : dept === 'Plant & Equipment' ? 'maximo' : dept === 'Procurement' ? 'sap-pm' : 'servicenow');
const REF: Record<string, (n: number) => string> = {
  servicenow: (n) => `INC${String(12000 + n).padStart(7, '0')}`,
  jira: (n) => `CON-${400 + n}`,
  maximo: (n) => `WO${String(731000 + n)}`,
  'sap-pm': (n) => `4000${String(118000 + n)}`,
  teams: (n) => `MSG-${9000 + n}`,
};
const SLA_H = { critical: 4, high: 8, med: 24, low: 72 } as const;

interface State {
  /** null = still probing, true = backend answered, false = offline fallback */
  online: boolean | null;
  integrations: Integration[];
  tickets: Ticket[];
  logs: LogLine[];
  wsLive: boolean;
  init: () => Promise<void>;
  pushWorkOrder: (wo: WorkOrder) => Promise<Ticket | null>;
  test: (id: string) => Promise<{ ok: boolean; latencyMs: number; message: string }>;
  setConnected: (id: string, on: boolean) => Promise<void>;
  sync: (id: string) => Promise<void>;
  reset: () => Promise<void>;
}

let started = false;
let seq = 0;
let ws: WebSocket | null = null;
const timers: ReturnType<typeof setTimeout>[] = [];

export const useIntegration = create<State>((set, get) => {
  const upsertTicket = (t: Ticket) => set((s) => ({ tickets: s.tickets.some((x) => x.id === t.id) ? s.tickets.map((x) => (x.id === t.id ? t : x)) : [t, ...s.tickets] }));
  const upsertInt = (i: Integration) => set((s) => ({ integrations: s.integrations.some((x) => x.id === i.id) ? s.integrations.map((x) => (x.id === i.id ? i : x)) : [...s.integrations, i] }));
  const log = (system: string, level: LogLine['level'], text: string) => set((s) => ({ logs: [{ at: now(), system, level, text }, ...s.logs].slice(0, 100) }));

  const loadFromApi = async () => {
    const [i, t, l] = await Promise.all([api<{ integrations: Integration[] }>('/api/integrations'), api<{ tickets: Ticket[] }>('/api/tickets'), api<{ logs: LogLine[] }>('/api/logs').catch(() => ({ logs: [] as LogLine[] }))]);
    set({ integrations: i.integrations, tickets: t.tickets, logs: l.logs, online: true });
  };

  const openSocket = () => {
    try {
      const url = wsUrl();
      if (!url || ws) return;
      ws = new WebSocket(url);
      ws.onopen = () => set({ wsLive: true });
      ws.onmessage = (ev) => {
        try {
          const m = JSON.parse(String(ev.data)) as { type: string; ticket?: Ticket; integration?: Integration; log?: LogLine };
          if (m.type === 'ticket' && m.ticket) upsertTicket(m.ticket);
          else if (m.type === 'integration' && m.integration) upsertInt(m.integration);
          else if (m.type === 'log' && m.log) set((s) => ({ logs: [m.log!, ...s.logs].slice(0, 100) }));
        } catch {
          /* ignore malformed frames */
        }
      };
      ws.onclose = () => {
        ws = null;
        set({ wsLive: false });
        if (get().online) timers.push(setTimeout(openSocket, 5000));
      };
      ws.onerror = () => ws?.close();
    } catch {
      /* no websocket available: REST still works */
    }
  };

  const goOffline = () => {
    timers.forEach(clearTimeout);
    timers.length = 0;
    seq = 0;
    set({ online: false, wsLive: false, integrations: LOCAL_INTEGRATIONS.map((x) => ({ ...x })), tickets: [], logs: [] });
    log('hub', 'warn', 'API offline - running the local integration simulator');
  };

  const localTicket = (wo: WorkOrder): Ticket => {
    const dept = wo.department ?? 'Plant & Equipment';
    let sys = routeByDept(dept);
    let note = `Routed by department (${dept})`;
    if (get().integrations.find((x) => x.id === sys)?.status !== 'connected') {
      sys = 'servicenow';
      note += ' - target tool offline, fell back to ServiceNow';
    }
    seq += 1;
    const pr = wo.priority === 'high' ? 'high' : wo.priority === 'med' ? 'med' : 'low';
    const people = ASSIGNEES[dept] ?? ASSIGNEES.Civil;
    const t: Ticket = {
      id: `TKT-${2000 + seq + 4}`,
      woId: wo.id,
      title: tx(wo.title, 'en'),
      description: wo.note ? tx(wo.note, 'en') : '',
      department: dept,
      priority: pr,
      status: 'new',
      system: sys,
      externalRef: REF[sys](seq + 40),
      assignee: people[seq % people.length],
      assetId: wo.assetId,
      source: wo.source,
      createdAt: now(),
      updatedAt: now(),
      sla: { dueAt: iso(SLA_H[pr] * 60), breached: false },
      timeline: [{ at: now(), status: 'new', note }],
    };
    const step = (status: TicketStatus, ms: number, text: string) =>
      timers.push(
        setTimeout(() => {
          const cur = get().tickets.find((x) => x.id === t.id);
          if (!cur) return;
          upsertTicket({ ...cur, status, updatedAt: now(), timeline: [...cur.timeline, { at: now(), status, note: text }] });
          log(sys, 'info', `${cur.externalRef} -> ${status}`);
        }, ms),
      );
    step('assigned', 2500, `Assigned to ${t.assignee}`);
    step('in_progress', 7000, 'Work started');
    return t;
  };

  return {
    online: null,
    integrations: [],
    tickets: [],
    logs: [],
    wsLive: false,
    init: async () => {
      if (started) return;
      started = true;
      try {
        // each page load starts from the clean demo state (work orders restart at the seed ids), so reset the hub too
        await api('/api/reset', { method: 'POST' });
        await loadFromApi();
        openSocket();
      } catch {
        goOffline();
        // the API may come up later (server restart): probe again once
        timers.push(
          setTimeout(async () => {
            if (get().online) return;
            try {
              await loadFromApi();
              openSocket();
            } catch {
              /* stay offline */
            }
          }, 20000),
        );
      }
    },
    pushWorkOrder: async (wo) => {
      const dept = wo.department ?? (wo.source === 'cctv' ? 'HSE' : 'Plant & Equipment');
      const w = { ...wo, department: dept };
      if (get().online) {
        try {
          const r = await api<{ ticket: Ticket }>('/api/tickets', {
            method: 'POST',
            body: { title: tx(wo.title, 'en'), description: wo.note ? tx(wo.note, 'en') : '', department: dept, priority: wo.priority === 'high' ? 'high' : wo.priority === 'med' ? 'med' : 'low', assetId: wo.assetId, woId: wo.id, source: wo.source },
          });
          upsertTicket(r.ticket);
          return r.ticket;
        } catch {
          /* fall through to the local simulator */
        }
      }
      const t = localTicket(w);
      upsertTicket(t);
      log(t.system, 'info', `Ticket ${t.externalRef} created for ${wo.id}`);
      return t;
    },
    test: async (id) => {
      if (get().online) {
        try {
          return await api(`/api/integrations/${id}/test`, { method: 'POST' });
        } catch {
          /* fall back */
        }
      }
      const i = get().integrations.find((x) => x.id === id);
      const ok = i?.status === 'connected';
      log(id, ok ? 'info' : 'error', ok ? 'Connection test OK' : 'Connection test failed - not connected');
      return { ok, latencyMs: ok ? i!.latencyMs : 0, message: ok ? 'Handshake and auth OK' : 'Connector is disconnected' };
    },
    setConnected: async (id, on) => {
      if (get().online) {
        try {
          const r = await api<{ integration?: Integration } & Partial<Integration>>(`/api/integrations/${id}/${on ? 'connect' : 'disconnect'}`, { method: 'POST' });
          upsertInt((r.integration ?? r) as Integration);
          return;
        } catch {
          /* fall back */
        }
      }
      const i = get().integrations.find((x) => x.id === id);
      if (i) upsertInt({ ...i, status: on ? 'connected' : 'disconnected', lastSyncAt: now(), latencyMs: on ? 70 : 0 });
      log(id, 'info', on ? 'Connector connected' : 'Connector disconnected');
    },
    sync: async (id) => {
      if (get().online) {
        try {
          await api(`/api/integrations/${id}/sync`, { method: 'POST' });
          await loadFromApi();
          return;
        } catch {
          /* fall back */
        }
      }
      const i = get().integrations.find((x) => x.id === id);
      if (i) upsertInt({ ...i, lastSyncAt: now() });
      log(id, 'info', 'Sync complete');
    },
    reset: async () => {
      if (get().online) {
        try {
          await api('/api/reset', { method: 'POST' });
          await loadFromApi();
          return;
        } catch {
          /* fall back */
        }
      }
      goOffline();
    },
  };
});
