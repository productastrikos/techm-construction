import { create } from 'zustand';

/** right-hand "AI actions" panel: a list of recommended actions, or one alarm explained and ticketed */
interface ActionPanelState {
  open: boolean;
  alarmId: string | null;
  show: (alarmId?: string | null) => void;
  close: () => void;
  back: () => void;
}
export const useActionPanel = create<ActionPanelState>((set) => ({
  open: false,
  alarmId: null,
  show: (alarmId = null) => set({ open: true, alarmId }),
  close: () => set({ open: false }),
  back: () => set({ alarmId: null }),
}));
export const openActions = () => useActionPanel.getState().show(null);
export const openAlert = (alarmId: string) => useActionPanel.getState().show(alarmId);
