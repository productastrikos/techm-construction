import { create } from 'zustand';
import { bi } from '../../lib/bi';
import { useApp } from '../../app/store';
import { useWorkOrders } from '../assets/woStore';

export type EventState = 'new' | 'ack' | 'sop' | 'wo';

export interface WorkOrder {
  id: string;
  eventId: string;
  cam: string;
  title: string;
  assignee: string;
  createdAt: number;
}

interface HseState {
  events: Record<string, EventState>;
  workOrders: WorkOrder[];
  permits: Record<string, string>;
  focus: string | null;
  ack: (id: string) => void;
  sop: (id: string) => void;
  createWo: (eventId: string, cam: string, title: string) => void;
  setPermit: (id: string, s: string) => void;
  setFocus: (id: string | null) => void;
  reset: () => void;
}

export const useHse = create<HseState>((set) => ({
  events: {},
  workOrders: [],
  permits: {},
  focus: null,
  ack: (id) => set((s) => ({ events: { ...s.events, [id]: s.events[id] === 'wo' || s.events[id] === 'sop' ? s.events[id] : 'ack' } })),
  sop: (id) => set((s) => ({ events: { ...s.events, [id]: s.events[id] === 'wo' ? 'wo' : 'sop' } })),
  createWo: (eventId, cam, title) => {
    // the CCTV work order is a real work order: it is routed to the HSE team's ticketing tool through the integration hub
    const wo = useWorkOrders.getState().create({ assetId: cam, title: bi(title, title), kind: 'INSP', status: 'open', priority: 'high', createdT: useApp.getState().simT, source: 'cctv', department: 'HSE', note: bi('Raised from a CCTV analytics event.', 'أُنشئ من حدث تحليلات الكاميرات.') });
    set((s) => ({
      events: { ...s.events, [eventId]: 'wo' },
      workOrders: [{ id: wo.id, eventId, cam, title, assignee: 'HSE Officer - shift A', createdAt: Date.now() }, ...s.workOrders],
    }));
  },
  setPermit: (id, st) => set((s) => ({ permits: { ...s.permits, [id]: st } })),
  setFocus: (focus) => set({ focus }),
  reset: () => set({ events: {}, workOrders: [], permits: {}, focus: null }),
}));
