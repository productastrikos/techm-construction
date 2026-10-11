import { create } from 'zustand';
import type { KpiSpec } from './forecast';

interface KpiPanelState {
  spec: KpiSpec | null;
  open: (s: KpiSpec) => void;
  close: () => void;
}
export const useKpiPanel = create<KpiPanelState>((set) => ({ spec: null, open: (spec) => set({ spec }), close: () => set({ spec: null }) }));
export const openKpi = (s: KpiSpec) => useKpiPanel.getState().open(s);
