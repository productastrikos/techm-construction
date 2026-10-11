import { create } from 'zustand';
import type { Id } from '../engine/types';

/** what-if results painted onto the 3D twin (and read by the Gantt): element id -> severity */
interface OverlayState {
  label: string | null;
  elements: Record<Id, 'watch' | 'late'>;
  /** activity ids whose forecast moved in the active scenario */
  activities: Record<Id, number>;
  set: (label: string | null, elements: Record<Id, 'watch' | 'late'>, activities?: Record<Id, number>) => void;
  clear: () => void;
}

export const useOverlay = create<OverlayState>((set) => ({
  label: null,
  elements: {},
  activities: {},
  set: (label, elements, activities = {}) => set({ label, elements, activities }),
  clear: () => set({ label: null, elements: {}, activities: {} }),
}));
