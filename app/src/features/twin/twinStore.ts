import { create } from 'zustand';

interface TwinState {
  viewT: number | null; // null = follow the demo clock
  /** first visit: start on a populated showpiece date, "Today" returns to the demo clock */
  initialised: boolean;
  playing4d: boolean;
  outline: boolean;
  zones: boolean;
  fleet: boolean;
  labels: boolean;
  panel: boolean;
  /** AI site-scan sweep is running (drawn over the 3D canvas) */
  aiScanning: boolean;
  preset: { name: string; nonce: number };
  /** the floating incident card is shown on the machine (re-openable from the chip) */
  incidentOpen: boolean;
  setViewT: (t: number | null) => void;
  patch: (p: Partial<TwinState>) => void;
}

export const useTwin = create<TwinState>((set) => ({
  viewT: null,
  initialised: false,
  playing4d: false,
  outline: true,
  zones: false,
  fleet: true,
  labels: true,
  panel: true,
  aiScanning: false,
  preset: { name: 'overview', nonce: 0 },
  incidentOpen: true,
  setViewT: (viewT) => set({ viewT }),
  patch: (p) => set(p),
}));
if (typeof window !== 'undefined') (window as unknown as { __twin: typeof useTwin }).__twin = useTwin;
