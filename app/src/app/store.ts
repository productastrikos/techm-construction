import { create } from 'zustand';
import { D, MS_DAY, msToT, tToMs } from '../engine/dates';
import type { Lang } from '../lib/fmt';

export type Role = 'cxo' | 'pm' | 'procurement' | 'hse' | 'asset' | 'finance';
export type Theme = 'dark' | 'light';
export type Quality = 'high' | 'balanced' | 'low';
export type ColorMode = 'realistic' | 'progress' | 'material' | 'health' | 'hse';
export const ROLES: Role[] = ['cxo', 'pm', 'procurement', 'hse', 'asset', 'finance'];

/** Demo "now": data date of the project. Illustrative. */
export const DEMO_NOW_T = D(2027, 1, 15) - D(2026, 11, 1) + 8 / 24; // 15 Jan 2027, 08:00

function ls<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v == null ? fallback : (JSON.parse(v) as T);
  } catch {
    return fallback;
  }
}
function save(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* ignore */
  }
}

export interface AppState {
  lang: Lang;
  theme: Theme;
  big: boolean;
  role: Role;
  packId: 'port' | 'highway';
  quality: Quality;
  colorMode: ColorMode;
  presenter: boolean;
  navCollapsed: boolean;
  /** demo clock, days since project start (float) */
  simT: number;
  playing: boolean;
  /** sim days per wall second */
  speed: number;
  selection: string | null;
  setLang: (l: Lang) => void;
  setTheme: (t: Theme) => void;
  setBig: (b: boolean) => void;
  setRole: (r: Role) => void;
  setPack: (p: 'port' | 'highway') => void;
  setQuality: (q: Quality) => void;
  setColorMode: (m: ColorMode) => void;
  setPresenter: (p: boolean) => void;
  setNavCollapsed: (c: boolean) => void;
  setSimT: (t: number) => void;
  setPlaying: (p: boolean) => void;
  setSpeed: (s: number) => void;
  select: (id: string | null) => void;
  resetClock: () => void;
}

export const useApp = create<AppState>((set) => ({
  lang: ls<Lang>('mz.lang', 'en'),
  theme: ls<Theme>('mz.theme', 'light'),
  big: ls('mz.big', false),
  role: ls<Role>('mz.role', 'cxo'),
  packId: ls<'port' | 'highway'>('mz.pack', 'port'),
  quality: ls<Quality>('mz.quality', 'balanced'),
  colorMode: 'realistic',
  presenter: false,
  navCollapsed: ls('mz.nav', false),
  simT: DEMO_NOW_T,
  playing: false,
  speed: 1,
  selection: null,
  setLang: (lang) => (save('mz.lang', lang), set({ lang })),
  setTheme: (theme) => (save('mz.theme', theme), set({ theme })),
  setBig: (big) => (save('mz.big', big), set({ big })),
  setRole: (role) => (save('mz.role', role), set({ role })),
  setPack: (packId) => (save('mz.pack', packId), set({ packId })),
  setQuality: (quality) => (save('mz.quality', quality), set({ quality })),
  setColorMode: (colorMode) => set({ colorMode }),
  setPresenter: (presenter) => set({ presenter }),
  setNavCollapsed: (navCollapsed) => (save('mz.nav', navCollapsed), set({ navCollapsed })),
  setSimT: (simT) => set({ simT }),
  setPlaying: (playing) => set({ playing }),
  setSpeed: (speed) => set({ speed }),
  select: (selection) => set({ selection }),
  resetClock: () => set({ simT: DEMO_NOW_T, playing: false, speed: 1 }),
}));

// expose for e2e scripts (presenter automation) - harmless in production
if (typeof window !== 'undefined') (window as unknown as { __app: typeof useApp }).__app = useApp;

export const simMs = () => tToMs(useApp.getState().simT);
export { msToT, MS_DAY };
