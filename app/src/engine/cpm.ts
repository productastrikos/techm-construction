// Critical Path Method with per-activity calendars. Activity-on-node, FS/SS/FF/SF with lags (working hours of the
// successor's calendar), constraints (start-no-earlier), data date + actuals ("retained logic"), total/free float.
// Target: 300-500 activities re-computed in well under 50 ms.
import type { Cal, CalMap } from './calendar';
import type { Activity, Id, Pred } from './types';

export interface ActualRec {
  start: number;
  /** present when the activity is complete */
  finish?: number;
  /** present when in progress: remaining working hours at the data date */
  remainingHrs?: number;
  pct: number;
}

export interface CpmInput {
  activities: Activity[];
  cals: CalMap;
  dataDate?: number;
  actuals?: Map<Id, ActualRec>;
  /** extra start-no-earlier constraints (e.g. PO ETA, asset unavailable) */
  snet?: Map<Id, number>;
  /** multiplies an activity's duration (noise, productivity) */
  durScale?: Map<Id, number>;
  /** working hours added to an activity (asset downtime that interrupts it) */
  extraHrs?: Map<Id, number>;
  /** replaces an activity's predecessor list (resequencing mitigation) */
  predOverride?: Map<Id, Pred[]>;
  /** contractual finish: gives negative float when exceeded */
  finishTarget?: number;
  critTolDays?: number;
}

export interface CpmResult {
  ids: Id[];
  idx: Map<Id, number>;
  es: Float64Array;
  ef: Float64Array;
  ls: Float64Array;
  lf: Float64Array;
  tf: Float64Array;
  ff: Float64Array;
  critical: Uint8Array;
  done: Uint8Array;
  finish: number;
  critTolDays: number;
}

interface Graph {
  order: number[];
  idx: Map<Id, number>;
  succs: Array<Array<{ s: number; k: number }>>;
}
const graphCache = new WeakMap<Activity[], Graph>();

function buildGraph(acts: Activity[]): Graph {
  const hit = graphCache.get(acts);
  if (hit) return hit;
  const idx = new Map<Id, number>();
  acts.forEach((a, i) => idx.set(a.id, i));
  const n = acts.length;
  const indeg = new Int32Array(n);
  const succs: Graph['succs'] = Array.from({ length: n }, () => []);
  acts.forEach((a, i) => {
    a.preds.forEach((p, k) => {
      const pi = idx.get(p.id);
      if (pi === undefined) throw new Error(`Unknown predecessor ${p.id} of ${a.id}`);
      succs[pi].push({ s: i, k });
      indeg[i]++;
    });
  });
  const q: number[] = [];
  for (let i = 0; i < n; i++) if (indeg[i] === 0) q.push(i);
  const order: number[] = [];
  for (let h = 0; h < q.length; h++) {
    const u = q[h];
    order.push(u);
    for (const e of succs[u]) if (--indeg[e.s] === 0) q.push(e.s);
  }
  if (order.length !== n) throw new Error('Cycle detected in activity network');
  const g = { order, idx, succs };
  graphCache.set(acts, g);
  return g;
}

function lagFwd(cal: Cal, t: number, lag: number): number {
  if (lag === 0) return t;
  if (lag > 0) return cal.addWork(cal.startOf(t), lag);
  return cal.subWork(t, -lag);
}
function lagBack(cal: Cal, t: number, lag: number): number {
  if (lag === 0) return t;
  if (lag > 0) return cal.subWork(cal.endOf(t), lag);
  return cal.addWork(cal.startOf(t), -lag);
}

export function runCpm(inp: CpmInput): CpmResult {
  const acts = inp.activities;
  const n = acts.length;
  const g = buildGraph(acts);
  const { order, idx, succs } = g;
  const es = new Float64Array(n);
  const ef = new Float64Array(n);
  const ls = new Float64Array(n);
  const lf = new Float64Array(n);
  const tf = new Float64Array(n);
  const ff = new Float64Array(n);
  const critical = new Uint8Array(n);
  const done = new Uint8Array(n);
  const dur = new Float64Array(n);
  const dd = inp.dataDate;
  const tol = inp.critTolDays ?? 1.0;

  const predsOf = (i: number): Pred[] => inp.predOverride?.get(acts[i].id) ?? acts[i].preds;

  // ---------------------------------------------------------------- forward pass
  for (const i of order) {
    const a = acts[i];
    const cal = inp.cals[a.calendarId];
    const scale = inp.durScale?.get(a.id) ?? 1;
    const extra = inp.extraHrs?.get(a.id) ?? 0;
    dur[i] = a.durationHrs * scale + extra;
    const act = inp.actuals?.get(a.id);
    if (act && act.finish !== undefined) {
      es[i] = act.start;
      ef[i] = act.finish;
      done[i] = 1;
      continue;
    }
    let lower = 0;
    const preds = predsOf(i);
    for (let k = 0; k < preds.length; k++) {
      const p = preds[k];
      const pi = idx.get(p.id)!;
      let c: number;
      switch (p.type) {
        case 'FS':
          c = lagFwd(cal, ef[pi], p.lagHrs);
          break;
        case 'SS':
          c = lagFwd(cal, es[pi], p.lagHrs);
          break;
        case 'FF':
          c = dur[i] > 0 ? cal.subWork(lagFwd(cal, ef[pi], p.lagHrs), dur[i]) : lagFwd(cal, ef[pi], p.lagHrs);
          break;
        default: // SF
          c = dur[i] > 0 ? cal.subWork(lagFwd(cal, es[pi], p.lagHrs), dur[i]) : lagFwd(cal, es[pi], p.lagHrs);
      }
      if (c > lower) lower = c;
    }
    // a scenario constraint REPLACES the activity's own start-no-earlier (e.g. an expedited PO arrives earlier)
    const sn = inp.snet?.get(a.id);
    const eff = sn !== undefined ? sn : a.snet;
    if (eff !== undefined && eff > lower) lower = eff;
    if (act && act.remainingHrs !== undefined) {
      // in progress: actual start retained, remaining work resumes at the data date (or later if constrained)
      es[i] = act.start;
      const resume = cal.startOf(Math.max(dd ?? act.start, act.start, sn ?? -Infinity));
      ef[i] = cal.addWork(resume, act.remainingHrs * scale + extra);
      continue;
    }
    if (dd !== undefined && lower < dd) lower = dd;
    if (dur[i] <= 0) {
      es[i] = lower;
      ef[i] = lower;
    } else {
      es[i] = cal.startOf(lower);
      ef[i] = cal.addWork(es[i], dur[i]);
    }
  }

  let finish = 0;
  for (let i = 0; i < n; i++) if (ef[i] > finish) finish = ef[i];
  const target = inp.finishTarget ?? finish;

  // ---------------------------------------------------------------- backward pass
  for (let oi = n - 1; oi >= 0; oi--) {
    const i = order[oi];
    const a = acts[i];
    const cal = inp.cals[a.calendarId];
    if (done[i]) {
      ls[i] = es[i];
      lf[i] = ef[i];
      tf[i] = 0;
      ff[i] = 0;
      continue;
    }
    let late = Infinity;
    let freeF = Infinity;
    for (const e of succs[i]) {
      const si = e.s;
      const sPreds = predsOf(si);
      // find the (possibly overridden) edge i -> si
      const sp = sPreds.find((p) => p.id === a.id);
      if (!sp) continue; // edge removed by override
      const scal = inp.cals[acts[si].calendarId];
      let c: number;
      switch (sp.type) {
        case 'FS':
          c = lagBack(scal, ls[si], sp.lagHrs);
          break;
        case 'SS': {
          const lsI = lagBack(scal, ls[si], sp.lagHrs);
          c = dur[i] > 0 ? cal.addWork(lsI, dur[i]) : lsI;
          break;
        }
        case 'FF':
          c = lagBack(scal, lf[si], sp.lagHrs);
          break;
        default: {
          const lsI = lagBack(scal, lf[si], sp.lagHrs);
          c = dur[i] > 0 ? cal.addWork(lsI, dur[i]) : lsI;
        }
      }
      if (c < late) late = c;
      const gap = sp.type === 'FS' ? es[si] - ef[i] - Math.max(0, sp.lagHrs) / 24 : sp.type === 'SS' ? es[si] - es[i] : ef[si] - ef[i];
      if (gap < freeF) freeF = gap;
    }
    if (late === Infinity) late = target;
    lf[i] = dur[i] > 0 ? cal.endOf(late) : late;
    ls[i] = dur[i] > 0 ? cal.subWork(lf[i], dur[i]) : lf[i];
    tf[i] = lf[i] - ef[i];
    ff[i] = freeF === Infinity ? Math.max(0, target - ef[i]) : Math.max(0, freeF);
  }

  for (let i = 0; i < n; i++) {
    critical[i] = !done[i] && tf[i] <= tol ? 1 : 0;
  }
  return { ids: acts.map((a) => a.id), idx, es, ef, ls, lf, tf, ff, critical, done, finish, critTolDays: tol };
}

export function criticalIds(r: CpmResult): Id[] {
  const out: Id[] = [];
  for (let i = 0; i < r.ids.length; i++) if (r.critical[i]) out.push(r.ids[i]);
  out.sort((a, b) => r.es[r.idx.get(a)!] - r.es[r.idx.get(b)!]);
  return out;
}

export function act(r: CpmResult, id: Id) {
  const i = r.idx.get(id);
  if (i === undefined) throw new Error(`unknown activity ${id}`);
  return { es: r.es[i], ef: r.ef[i], ls: r.ls[i], lf: r.lf[i], tf: r.tf[i], ff: r.ff[i], critical: !!r.critical[i], done: !!r.done[i] };
}
