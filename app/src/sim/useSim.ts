import { useEffect, useMemo } from 'react';
import { create } from 'zustand';
import { useApp } from '../app/store';
import { buildCalendars, type CalMap } from '../engine/calendar';
import type { ProjectPack } from '../engine/types';
import { createDataSource, type DataSourceHandle } from './dataSource';
import { loadPack } from './core';
import type { Snapshot } from './types';

interface SimState {
  ready: boolean;
  packId: string;
  snap: Snapshot | null;
  /** monotonically increases every time a new snapshot lands (cheap change signal) */
  rev: number;
  kind: 'worker' | 'inline' | null;
  error: string | null;
}

export const useSimStore = create<SimState>(() => ({ ready: false, packId: 'port', snap: null, rev: 0, kind: null, error: null }));

let handle: DataSourceHandle | null = null;
let lastKey = -1;
let inflight = 0;

export function getDs() {
  if (!handle) handle = createDataSource();
  return handle.ds;
}

async function refresh(simT: number, force = false) {
  const key = Math.floor(simT);
  if (!force && key === lastKey) return;
  lastKey = key;
  const my = ++inflight;
  try {
    const snap = await getDs().getSnapshot(simT);
    if (my === inflight || force) useSimStore.setState((s) => ({ snap, ready: true, rev: s.rev + 1, kind: handle?.kind ?? null }));
  } catch (e) {
    console.error('snapshot failed', e);
    useSimStore.setState({ error: String(e) });
  }
}

/** boots the simulator and keeps the snapshot in step with the demo clock and the active project pack */
export function useSimBoot() {
  const simT = useApp((s) => s.simT);
  const packId = useApp((s) => s.packId);
  useEffect(() => {
    let live = true;
    (async () => {
      const ds = getDs() as unknown as { setPack: (id: string) => Promise<void> };
      useSimStore.setState({ ready: false, packId });
      lastKey = -1;
      await ds.setPack(packId);
      if (live) {
        useSimStore.setState({ packId });
        await refresh(useApp.getState().simT, true);
      }
    })();
    return () => {
      live = false;
    };
  }, [packId]);
  useEffect(() => {
    if (useSimStore.getState().ready) void refresh(simT);
  }, [simT]);
}

export function useDataReady(): boolean {
  useSimBoot();
  return useSimStore((s) => s.ready);
}

export function useSnapshot(): Snapshot {
  const s = useSimStore((st) => st.snap);
  if (!s) throw new Error('snapshot not ready');
  return s;
}

export function useSnapshotMaybe(): Snapshot | null {
  return useSimStore((st) => st.snap);
}

const packCache = new Map<string, ProjectPack>();
export function getPack(id: string): ProjectPack {
  let p = packCache.get(id);
  if (!p) packCache.set(id, (p = loadPack(id)));
  return p;
}
const calCache = new WeakMap<ProjectPack, CalMap>();
export function getBaseCals(pack: ProjectPack): CalMap {
  let c = calCache.get(pack);
  if (!c) calCache.set(pack, (c = buildCalendars(pack.calendars, pack.rules)));
  return c;
}

/** the active project pack (static content, available synchronously) */
export function usePack(): ProjectPack {
  const packId = useApp((s) => s.packId);
  return useMemo(() => getPack(packId), [packId]);
}
