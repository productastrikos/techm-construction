// The Plan = pack + baseline schedule + progress (actuals at the data date) + current forecast.
// Progress is synthesised deterministically ("actual universe" = baseline logic with seeded duration noise and a few
// scripted slow-downs), then frozen at the data date. The forecast re-runs CPM from the data date over those actuals.
import { buildCalendars, type CalMap } from './calendar';
import { clamp, hash32, mulberry32 } from './dates';
import { runCpm, type ActualRec, type CpmResult } from './cpm';
import { poTimeline, type PoTimeline } from './routes';
import type { Id, ProjectPack } from './types';

export interface Plan {
  pack: ProjectPack;
  nowT: number;
  baseCals: CalMap;
  baseline: CpmResult;
  actuals: Map<Id, ActualRec>;
  forecast: CpmResult;
  /** forecast PO timelines (includes slips already seen at the data date) */
  poTl: Map<Id, PoTimeline>;
  /** contractual completion = baseline finish */
  contractFinish: number;
  /** durations used by the "actual universe" (for transparency in the UI) */
  slowdowns: Record<Id, number>;
}

/** scripted slow-downs that explain why the forecast is already behind baseline at the data date */
const SLOWDOWN: Record<string, number> = { 'MOB-060': 1.22, 'MOB-130': 1.12, 'DRG-Z1': 1.1, 'MOB-110': 1.15, 'MOB-100': 1.1 };

const packCache = new WeakMap<ProjectPack, { baseCals: CalMap; baseline: CpmResult }>();

export function buildPlan(pack: ProjectPack, dataDate?: number): Plan {
  const nowT = dataDate ?? pack.config.nowT;
  let cached = packCache.get(pack);
  if (!cached) {
    const baseCals = buildCalendars(pack.calendars, pack.rules);
    cached = { baseCals, baseline: runCpm({ activities: pack.activities, cals: baseCals }) };
    packCache.set(pack, cached);
  }
  const { baseCals, baseline } = cached;

  // forecast PO timelines (no scenario, only already-seen slips)
  const poTl = new Map<Id, PoTimeline>();
  for (const po of pack.pos) poTl.set(po.id, poTimeline(pack, po, nowT, null));
  const snet = new Map<Id, number>();
  for (const po of pack.pos) snet.set(po.deliveryActivityId, poTl.get(po.id)!.etaT);

  // --- actual universe
  const durScale = new Map<Id, number>();
  const slowdowns: Record<Id, number> = {};
  for (const a of pack.activities) {
    if (a.durationHrs <= 0) continue;
    const r = mulberry32(hash32(a.id))();
    const base = 0.95 + 0.14 * r; // 0.95 .. 1.09
    const sc = (SLOWDOWN[a.id] ?? 1) * base;
    durScale.set(a.id, sc);
    slowdowns[a.id] = sc;
  }
  const universe = runCpm({ activities: pack.activities, cals: baseCals, durScale, snet });

  const actuals = new Map<Id, ActualRec>();
  pack.activities.forEach((a, i) => {
    const es = universe.es[i];
    const ef = universe.ef[i];
    if (es >= nowT && a.kind === 'task') return; // not started
    if (a.kind !== 'task') {
      if (ef <= nowT) actuals.set(a.id, { start: es, finish: ef, pct: 1 });
      return;
    }
    if (ef <= nowT) {
      actuals.set(a.id, { start: es, finish: ef, pct: 1 });
    } else {
      const cal = baseCals[a.calendarId];
      const total = cal.workBetween(es, ef);
      const done = Math.max(0, cal.workBetween(es, nowT));
      const pct = total > 0 ? clamp(done / total, 0, 0.98) : 0;
      actuals.set(a.id, { start: es, remainingHrs: Math.max(1, (1 - pct) * a.durationHrs), pct });
    }
  });

  const forecast = runCpm({ activities: pack.activities, cals: baseCals, dataDate: nowT, actuals, snet });
  return { pack, nowT, baseCals, baseline, actuals, forecast, poTl, contractFinish: baseline.finish, slowdowns };
}

/** fraction complete of activity index i at time t, from a schedule result (pure function of dates) */
export function progressAt(res: CpmResult, cals: CalMap, pack: ProjectPack, i: number, t: number): number {
  const a = pack.activities[i];
  const es = res.es[i];
  const ef = res.ef[i];
  if (a.durationHrs <= 0) return t >= es ? 1 : 0;
  if (t <= es) return 0;
  if (t >= ef) return 1;
  const cal = cals[a.calendarId];
  const total = cal.workBetween(es, ef);
  if (total <= 0) return clamp((t - es) / Math.max(1e-6, ef - es), 0, 1);
  return clamp(cal.workBetween(es, t) / total, 0, 1);
}

export function activityIndex(pack: ProjectPack): Map<Id, number> {
  const m = new Map<Id, number>();
  pack.activities.forEach((a, i) => m.set(a.id, i));
  return m;
}
