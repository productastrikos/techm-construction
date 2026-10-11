import { create } from 'zustand';
import type { Delta, ScenarioResult } from '../../engine/scenario';
import type { RecoveryOption } from '../../engine/scenario';

export interface SavedScenario {
  id: string;
  name: string;
  deltas: Delta[];
  result: ScenarioResult;
  committed: boolean;
}

/** the scenario currently shown across the app (Gantt ghost bars, 3D overlay, cost bar) + saved scenarios for comparison */
interface ScenarioState {
  active: { label: string; deltas: Delta[]; result: ScenarioResult } | null;
  saved: SavedScenario[];
  options: RecoveryOption[];
  setActive: (a: ScenarioState['active']) => void;
  save: (s: SavedScenario) => void;
  commit: (id: string) => void;
  remove: (id: string) => void;
  setOptions: (o: RecoveryOption[]) => void;
  clear: () => void;
}

export const useScenario = create<ScenarioState>((set) => ({
  active: null,
  saved: [],
  options: [],
  setActive: (active) => set({ active }),
  save: (s) => set((st) => ({ saved: [...st.saved.filter((x) => x.id !== s.id), s].slice(-6) })),
  commit: (id) => set((st) => ({ saved: st.saved.map((x) => ({ ...x, committed: x.id === id })) })),
  remove: (id) => set((st) => ({ saved: st.saved.filter((x) => x.id !== id) })),
  setOptions: (options) => set({ options }),
  clear: () => set({ active: null, options: [] }),
}));

if (typeof window !== 'undefined') (window as unknown as { __scenario: typeof useScenario }).__scenario = useScenario;
