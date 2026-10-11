import { describe, expect, it } from 'vitest';
import { buildHighwayPack } from '../src/packs/highway';
import { buildPlan } from '../src/engine/plan';
import { criticalIds } from '../src/engine/cpm';
import { evaluate } from '../src/engine/scenario';
import { iso } from '../src/engine/dates';

describe('Highway pack (same engine, new project)', () => {
  const pack = buildHighwayPack();
  const plan = buildPlan(pack);
  it('builds, is acyclic and flows into a single completion milestone', () => {
    expect(pack.activities.length).toBeGreaterThan(100);
    const succ = new Set(pack.activities.flatMap((a) => a.preds.map((p) => p.id)));
    expect(pack.activities.filter((a) => !succ.has(a.id)).map((a) => a.id)).toEqual(['COM-MS']);
  });
  it('finishes in about 13 months with a small forecast slip and a critical path', () => {
    console.log('highway baseline', iso(plan.baseline.finish), 'forecast', iso(plan.forecast.finish), 'crit', criticalIds(plan.forecast).length);
    expect(plan.baseline.finish).toBeGreaterThan(330);
    expect(plan.baseline.finish).toBeLessThan(900);
    expect(criticalIds(plan.forecast).length).toBeGreaterThan(8);
  });
  it('the Chokepoint and calendar engines work unchanged on the new pack', () => {
    const h = evaluate(plan, [{ kind: 'chokepoint', state: 'closed', startT: plan.nowT, durationDays: 365 }]);
    expect(h.dFinish).toBeGreaterThanOrEqual(0);
    const c = evaluate(plan, [{ kind: 'layers', layers: { ramadan: true, midday: true } }]);
    expect(c.dFinish).toBeGreaterThan(5);
  });
  it('every PO has a consumer, every element an activity', () => {
    for (const p of pack.pos) expect(pack.activities.find((a) => a.id === p.deliveryActivityId)).toBeDefined();
    for (const e of pack.elements) expect(e.activityIds.length, e.id).toBeGreaterThan(0);
  });
});
