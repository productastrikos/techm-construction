import * as Comlink from 'comlink';
import { SimCore } from './core';
import type { DataSource } from './types';

export interface DataSourceHandle {
  ds: DataSource & { setPack?: (id: string) => Promise<void> };
  kind: 'worker' | 'inline';
}

/** WorkerDataSource by default; falls back to the same SimCore inline if workers are unavailable (tests, odd browsers). */
export function createDataSource(packId = 'port'): DataSourceHandle {
  if (typeof Worker !== 'undefined' && !new URLSearchParams(typeof location !== 'undefined' ? location.search : '').has('inline')) {
    try {
      const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
      const proxy = Comlink.wrap<SimCore>(worker) as unknown as DataSourceHandle['ds'];
      return { ds: proxy, kind: 'worker' };
    } catch (e) {
      console.warn('worker unavailable, running simulator inline', e);
    }
  }
  return { ds: new SimCore(packId), kind: 'inline' };
}
