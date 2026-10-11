// Procurement control-tower model: joins snapshot PO rows with pack data and re-times every PO under a local Chokepoint
// state (the What-If Studio owns the global scenario; this page lets the presenter flip the strait on its own).
import { create } from 'zustand';
import { poTimeline, type ChokepointScenario, type PoTimeline } from '../../engine/routes';
import type { ChokepointState, Material, ProjectPack, PurchaseOrder, Supplier } from '../../engine/types';
import type { PoRow, RiskLevel, Snapshot } from '../../sim/types';

interface ProcState {
  hz: ChokepointState;
  tab: 'tower' | 'routes' | 'stock' | 'suppliers' | 'gateway';
  selected: string | null;
  stage: number | null;
  /** PO currently flashed by the AI scan */
  scan: string | null;
  setScan: (id: string | null) => void;
  setHz: (h: ChokepointState) => void;
  setTab: (t: ProcState['tab']) => void;
  select: (id: string | null) => void;
  setStage: (s: number | null) => void;
}

export const useProc = create<ProcState>((set) => ({
  hz: 'open',
  tab: 'tower',
  selected: null,
  stage: null,
  scan: null,
  setScan: (scan) => set({ scan }),
  setHz: (hz) => set({ hz }),
  setTab: (tab) => set({ tab }),
  select: (selected) => set({ selected }),
  setStage: (stage) => set((s) => ({ stage: s.stage === stage ? null : stage })),
}));

export const riskOf = (floatDays: number, slip: number): RiskLevel => (floatDays < 0 ? 'late' : floatDays < 14 ? 'risk' : floatDays < 30 || slip > 3 ? 'watch' : 'ok');

export interface ProcRow {
  po: PurchaseOrder;
  row: PoRow;
  mat: Material;
  sup: Supplier;
  tl: PoTimeline;
  /** stage after re-timing (stage is time driven, ETA moves only the later boundaries) */
  etaT: number;
  deltaEta: number;
  floatDays: number;
  risk: RiskLevel;
}

export const hzScenario = (state: ChokepointState, nowT: number): ChokepointScenario | null => (state === 'open' ? null : { state, startT: nowT, durationDays: 120 });

export function buildRows(pack: ProjectPack, snap: Snapshot, hz: ChokepointState): ProcRow[] {
  const sc = hzScenario(hz, snap.nowT);
  const out: ProcRow[] = [];
  for (const row of snap.pos) {
    const po = pack.pos.find((p) => p.id === row.id);
    if (!po) continue;
    const mat = pack.materials.find((m) => m.id === po.materialId)!;
    const sup = pack.suppliers.find((s) => s.id === po.supplierId)!;
    const tl = poTimeline(pack, po, snap.nowT, sc);
    const deltaEta = tl.etaT - row.etaT;
    const floatDays = row.needBy - tl.etaT;
    out.push({ po, row, mat, sup, tl, etaT: tl.etaT, deltaEta, floatDays, risk: row.stage === 6 ? 'ok' : riskOf(floatDays, tl.slipDays) });
  }
  return out;
}

export const STAGE_KEYS = ['ordered', 'production', 'qa', 'shipped', 'port', 'truck', 'site'] as const;

export function stageCounts(rows: ProcRow[]) {
  const c = Array.from({ length: 8 }, () => ({ n: 0, value: 0 })); // index 0 = planned (-1), 1..7 = stages 0..6
  for (const r of rows) {
    const i = r.row.stage + 1;
    c[i].n += 1;
    c[i].value += r.po.valueAED;
  }
  return c;
}

export const RISK_TONE = { ok: 'good', watch: 'info', risk: 'warn', late: 'bad' } as const;

/** simple deterministic synthetic helpers (illustrative stock / gateway data) */
export function h01(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
}
