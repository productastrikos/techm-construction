import { create } from 'zustand';
import { bi, type Bi } from '../../lib/bi';
import { ymdToT } from '../../engine/dates';
import { useIntegration } from '../workorders/integrationStore';

export type WoStatus = 'open' | 'planned' | 'inprogress' | 'done';
export type WoKind = 'PM' | 'CM' | 'PdM' | 'INSP';

export interface WorkOrder {
  id: string;
  assetId: string;
  title: Bi;
  kind: WoKind;
  status: WoStatus;
  priority: 'low' | 'med' | 'high';
  /** planned service window (shown as a protected window on the Gantt) */
  fromT?: number;
  toT?: number;
  createdT: number;
  source: 'prediction' | 'manual' | 'cctv' | 'schedule' | 'alert';
  /** owning department, used to route the ticket to the right external tool */
  department?: string;
  /** dashboard alarm this work order was raised from */
  alarmId?: string;
  costAED?: number;
  note?: Bi;
}

const seed: WorkOrder[] = [
  { id: 'WO-1042', assetId: 'DT-03', title: bi('500 h service - engine oil & filters', 'صيانة 500 ساعة - زيت المحرك والفلاتر'), kind: 'PM', status: 'done', priority: 'low', createdT: ymdToT(2027, 1, 4), fromT: ymdToT(2027, 1, 8), toT: ymdToT(2027, 1, 8), source: 'schedule', costAED: 6800 },
  { id: 'WO-1043', assetId: 'EX-02', title: bi('Hydraulic hose replacement', 'استبدال الخراطيم الهيدروليكية'), kind: 'CM', status: 'done', priority: 'med', createdT: ymdToT(2027, 1, 6), fromT: ymdToT(2027, 1, 9), toT: ymdToT(2027, 1, 10), source: 'manual', costAED: 14200 },
  { id: 'WO-1044', assetId: 'CC-01', title: bi('Wire-rope inspection (lifting certificate)', 'فحص حبال الرفع (شهادة الرفع)'), kind: 'INSP', status: 'planned', priority: 'med', createdT: ymdToT(2027, 1, 10), fromT: ymdToT(2027, 2, 14), toT: ymdToT(2027, 2, 14), source: 'schedule', costAED: 9500 },
  { id: 'WO-1045', assetId: 'TUG-01', title: bi('Propeller shaft seal check', 'فحص ختم عمود المروحة'), kind: 'PM', status: 'planned', priority: 'low', createdT: ymdToT(2027, 1, 11), fromT: ymdToT(2027, 2, 20), toT: ymdToT(2027, 2, 21), source: 'schedule', costAED: 21000 },
  { id: 'WO-1046', assetId: 'GEN-02', title: bi('Oil analysis follow-up (iron trend)', 'متابعة تحليل الزيت (اتجاه الحديد)'), kind: 'PdM', status: 'open', priority: 'med', createdT: ymdToT(2027, 1, 13), source: 'prediction' },
  { id: 'WO-1047', assetId: 'DT-04', title: bi('Hydraulic pump wear inspection', 'فحص تآكل المضخة الهيدروليكية'), kind: 'PdM', status: 'open', priority: 'med', createdT: ymdToT(2027, 1, 14), source: 'prediction' },
  { id: 'WO-1048', assetId: 'DRG-01', title: bi('Dredge pump impeller wear survey', 'مسح تآكل ريشة مضخة التكريك'), kind: 'PM', status: 'inprogress', priority: 'low', createdT: ymdToT(2027, 1, 12), fromT: ymdToT(2027, 1, 14), toT: ymdToT(2027, 1, 16), source: 'schedule', costAED: 38000 },
];

interface WoState {
  list: WorkOrder[];
  seq: number;
  create: (w: Omit<WorkOrder, 'id'>) => WorkOrder;
  move: (id: string, status: WoStatus) => void;
  reset: () => void;
}

export const useWorkOrders = create<WoState>((set, get) => ({
  list: seed,
  seq: 1049,
  create: (w) => {
    const wo: WorkOrder = { ...w, id: `WO-${get().seq}` };
    set((s) => ({ list: [wo, ...s.list], seq: s.seq + 1 }));
    // hand the work order to the integration hub: it becomes a ticket in the external tool (ServiceNow, Maximo, ...)
    void useIntegration.getState().pushWorkOrder(wo);
    return wo;
  },
  move: (id, status) => set((s) => ({ list: s.list.map((x) => (x.id === id ? { ...x, status } : x)) })),
  reset: () => {
    set({ list: seed, seq: 1049 });
    void useIntegration.getState().reset();
  },
}));

if (typeof window !== 'undefined') (window as unknown as { __wo: typeof useWorkOrders }).__wo = useWorkOrders;
