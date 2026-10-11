// 4D logic: per-element progress derived from the schedule (pure function of dates), so "4D reveals match schedule dates".
import type { CalMap } from './calendar';
import type { CpmResult } from './cpm';
import { progressAt } from './plan';
import type { Id, ProjectPack, SceneElement } from './types';

export interface ElementState {
  id: Id;
  /** forecast progress at the view date (what the 3D shows) */
  pf: number;
  /** planned (baseline) progress at the view date */
  pb: number;
  startF: number;
  endF: number;
  startB: number;
  endB: number;
  /** forecast finish - baseline finish, days (max over linked activities) */
  varianceDays: number;
  status: 'planned' | 'inprogress' | 'done';
  /** on-track / at-risk / late relative to plan at the view date */
  health: 'ok' | 'watch' | 'late' | 'neutral';
}

/** duration-weighted progress of the activities driving an element */
export function elementState(el: SceneElement, pack: ProjectPack, fc: CpmResult, base: CpmResult, cals: CalMap, t: number, idx: Map<Id, number>): ElementState {
  let wSum = 0;
  let pf = 0;
  let pb = 0;
  let sF = Infinity;
  let eF = -Infinity;
  let sB = Infinity;
  let eB = -Infinity;
  let variance = 0;
  for (const aid of el.activityIds) {
    const i = idx.get(aid);
    if (i === undefined) continue;
    const a = pack.activities[i];
    const w = Math.max(1, a.durationHrs);
    wSum += w;
    pf += w * progressAt(fc, cals, pack, i, t);
    pb += w * progressAt(base, cals, pack, i, t);
    sF = Math.min(sF, fc.es[i]);
    eF = Math.max(eF, fc.ef[i]);
    sB = Math.min(sB, base.es[i]);
    eB = Math.max(eB, base.ef[i]);
    variance = Math.max(variance, fc.ef[i] - base.ef[i]);
  }
  if (wSum === 0) return { id: el.id, pf: 0, pb: 0, startF: 0, endF: 0, startB: 0, endB: 0, varianceDays: 0, status: 'planned', health: 'neutral' };
  pf /= wSum;
  pb /= wSum;
  const status: ElementState['status'] = pf >= 0.999 ? 'done' : pf > 0.001 ? 'inprogress' : 'planned';
  const gap = pb - pf;
  const health: ElementState['health'] = status === 'done' ? 'ok' : gap > 0.15 ? 'late' : gap > 0.02 || variance > 21 ? 'watch' : pf <= 0.001 && pb <= 0.001 ? 'neutral' : 'ok';
  return { id: el.id, pf, pb, startF: sF, endF: eF, startB: sB, endB: eB, varianceDays: variance, status, health };
}

export function allElementStates(pack: ProjectPack, fc: CpmResult, base: CpmResult, cals: CalMap, t: number): Map<Id, ElementState> {
  const idx = new Map<Id, number>();
  pack.activities.forEach((a, i) => idx.set(a.id, i));
  const out = new Map<Id, ElementState>();
  for (const el of pack.elements) out.set(el.id, elementState(el, pack, fc, base, cals, t, idx));
  return out;
}

/** progress of a single activity id at time t (used for caisson sub-stages) */
export function activityProgress(pack: ProjectPack, fc: CpmResult, cals: CalMap, id: Id, t: number): number {
  const i = fc.idx.get(id);
  return i === undefined ? 0 : progressAt(fc, cals, pack, i, t);
}

/** is any linked activity of the asset in progress at t (forecast)? */
export function assetActive(pack: ProjectPack, fc: CpmResult, assetId: Id, t: number): boolean {
  const a = pack.assets.find((x) => x.id === assetId);
  if (!a) return false;
  for (const id of a.linkedActivityIds) {
    const i = fc.idx.get(id);
    if (i !== undefined && t >= fc.es[i] && t < fc.ef[i]) return true;
  }
  return false;
}

/** has asset been mobilised (all its linked activities have not started => not yet on site, unless it is always-on) */
export function assetOnSite(pack: ProjectPack, fc: CpmResult, assetId: Id, t: number): boolean {
  const a = pack.assets.find((x) => x.id === assetId);
  if (!a) return false;
  if (!a.linkedActivityIds.length) return true;
  let first = Infinity;
  let last = -Infinity;
  for (const id of a.linkedActivityIds) {
    const i = fc.idx.get(id);
    if (i === undefined) continue;
    first = Math.min(first, fc.es[i]);
    last = Math.max(last, fc.ef[i]);
  }
  return t >= first - 8 && t <= last + 10;
}
