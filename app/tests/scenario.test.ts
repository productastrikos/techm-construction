import { describe, expect, it } from 'vitest';
import { buildPortPack } from '../src/packs/port';
import { buildPlan } from '../src/engine/plan';
import { act } from '../src/engine/cpm';
import { evaluate, supplyRecovery, calendarRecovery, assetOptions } from '../src/engine/scenario';
import { dayBreakdown, periodHours } from '../src/engine/calendar';
import { poTimeline, stageAt } from '../src/engine/routes';
import { healthReport } from '../src/engine/assets';
import { ymdToT } from '../src/engine/dates';

const pack = buildPortPack();
const plan = buildPlan(pack);
const hz = (state: 'open' | 'restricted' | 'closed', days = 365) => ({ kind: 'chokepoint' as const, state, startT: plan.nowT, durationDays: days });

describe('scenario engine - invariants', () => {
  it('no deltas => identical to the live forecast, zero cost', () => {
    const r = evaluate(plan, []);
    expect(r.dFinish).toBeCloseTo(0, 6);
    expect(r.cost.total).toBeCloseTo(0, 6);
    expect(r.changed.length).toBe(0);
    expect(r.affectedElements.length).toBe(0);
  });
  it('is pure: evaluating never mutates the plan', () => {
    const f0 = plan.forecast.finish;
    evaluate(plan, [hz('closed'), { kind: 'layers', layers: { ramadan: true } }]);
    expect(plan.forecast.finish).toBe(f0);
    expect(plan.baseline.finish).toBeLessThan(f0 + 1);
  });
  it('a PO slip smaller than its float is absorbed; a larger one moves the finish by (slip - float)', () => {
    // PO-010 crane rails: consumer EQP-R4 is on the critical path
    const po = pack.pos.find((p) => p.id === 'PO-010')!;
    const di = plan.forecast.idx.get(po.deliveryActivityId)!;
    const tf = plan.forecast.tf[di];
    expect(tf).toBeGreaterThan(0);
    const small = evaluate(plan, [{ kind: 'shiftEta', poId: 'PO-010', days: Math.max(1, tf - 3) }]);
    expect(small.dFinish).toBeLessThan(0.6);
    const big = evaluate(plan, [{ kind: 'shiftEta', poId: 'PO-010', days: tf + 9 }]);
    expect(big.dFinish).toBeGreaterThan(7);
    expect(big.dFinish).toBeLessThan(11);
    expect(big.newlyCritical.length + big.criticalPath.length).toBeGreaterThan(0);
  });
  it('a milestone-only slip on a non-driving item (fenders) is absorbed by float, no finish impact', () => {
    const r = evaluate(plan, [{ kind: 'shiftEta', poId: 'PO-008', days: 35 }]);
    expect(r.dFinish).toBeCloseTo(0, 3);
    expect(r.poImpacts.find((p) => p.poId === 'PO-008')!.lateDays).toBe(0);
  });
});

describe('H1 - Chokepoint shock', () => {
  it('state ordering: open < restricted < closed', () => {
    const o = evaluate(plan, [hz('open')]);
    const r = evaluate(plan, [hz('restricted')]);
    const c = evaluate(plan, [hz('closed')]);
    expect(o.dFinish).toBeCloseTo(0, 6);
    expect(r.dFinish).toBeGreaterThan(0);
    expect(c.dFinish).toBeGreaterThan(r.dFinish);
  });
  it('closed: exposed shipments slip ~5 weeks, domestic bulk is untouched', () => {
    const c = evaluate(plan, [hz('closed')]);
    const slipped = c.poImpacts.filter((p) => p.chokepointSlip > 0);
    expect(slipped.length).toBeGreaterThanOrEqual(4);
    for (const p of slipped) expect(p.slipDays).toBeCloseTo(35, 3);
    for (const po of pack.pos.filter((p) => p.routeId === 'R-LOC')) expect(c.poImpacts.find((p) => p.poId === po.id)!.slipDays).toBe(0);
  });
  it('a disruption window that ends before a PO ships does not affect it', () => {
    const c = evaluate(plan, [{ kind: 'chokepoint', state: 'closed', startT: plan.nowT, durationDays: 30 }]);
    const stsA = c.poImpacts.find((p) => p.poId === 'PO-012')!; // ships Dec 2027
    expect(stsA.chokepointSlip).toBe(0);
  });
  it('closed has teeth: finish slips by weeks, critical path jumps, cost and affected 3D elements appear', () => {
    const c = evaluate(plan, [hz('closed')]);
    expect(c.dFinish).toBeGreaterThan(15);
    expect(c.dFinish).toBeLessThan(45);
    expect(c.newlyCritical.length).toBeGreaterThan(0);
    expect(c.cost.total).toBeGreaterThan(5e6);
    expect(c.cost.escalation).toBeGreaterThan(0);
    expect(c.affectedElements.length).toBeGreaterThan(5);
  });
  it('re-routing via Port C removes the Chokepoint slip for that PO', () => {
    const c = evaluate(plan, [hz('closed'), { kind: 'reroute', poId: 'PO-010', routeId: 'R-PTC' }]);
    const p = c.poImpacts.find((x) => x.poId === 'PO-010')!;
    expect(p.chokepointSlip).toBe(0);
    expect(p.routeId).toBe('R-PTC');
    expect(p.slipDays).toBeLessThan(10);
  });
  it('recovery options are generated, ranked by days recovered, and re-run CPM (finish differs)', () => {
    const { baseResult, options } = supplyRecovery(plan, [hz('closed')]);
    expect(options.length).toBeGreaterThanOrEqual(3);
    for (let i = 1; i < options.length; i++) expect(options[i - 1].recoveredDays).toBeGreaterThanOrEqual(options[i].recoveredDays - 1e-9);
    for (const o of options) {
      expect(o.recoveredDays).toBeCloseTo(baseResult.dFinish - o.dFinish, 6);
      expect(o.recoveredDays).toBeGreaterThan(0);
    }
    const reroute = options.find((o) => o.id === 'reroute')!;
    expect(reroute.dFinish).toBeLessThan(baseResult.dFinish - 10);
    expect(reroute.spendAED).toBeGreaterThan(0);
  });
  it('the full chain executes in well under a second', () => {
    const t0 = performance.now();
    supplyRecovery(plan, [hz('closed')]);
    expect(performance.now() - t0).toBeLessThan(1000);
  });
  it('price shock raises cost but not the schedule', () => {
    const r = evaluate(plan, [{ kind: 'priceShock', pct: 0.22 }]);
    expect(r.dFinish).toBeCloseTo(0, 6);
    expect(r.cost.escalation).toBeGreaterThan(1e7);
  });
});

describe('PO timeline stages', () => {
  it('stage boundaries are monotonic and stageAt is consistent with the ETA', () => {
    for (const po of pack.pos) {
      const tl = poTimeline(pack, po, plan.nowT, null);
      expect(tl.orderedT).toBeLessThan(tl.b2);
      expect(tl.b2).toBeLessThanOrEqual(tl.etdT);
      expect(tl.etdT).toBeLessThanOrEqual(tl.b4);
      expect(tl.b4).toBeLessThanOrEqual(tl.b5);
      expect(tl.b5).toBeLessThanOrEqual(tl.etaT + 1e-9);
      expect(stageAt(tl, tl.etaT + 1)).toBe(6);
      expect(stageAt(tl, tl.orderedT - 1)).toBe(-1);
    }
  });
});

describe('H2 - calendar & workforce intelligence', () => {
  const site = pack.calendars.find((c) => c.id === 'site')!;
  const marine = pack.calendars.find((c) => c.id === 'marine')!;
  it('Ramadan 2027 removes exactly 2 h on each working day (hand-computed)', () => {
    const r = pack.rules.ramadan[0];
    const base = periodHours(site, pack.rules, r.startT, r.endT);
    const on = periodHours(site, { ...pack.rules, layers: { ...pack.rules.layers, ramadan: true } }, r.startT, r.endT);
    let workdays = 0;
    for (let d = r.startT; d <= r.endT; d++) if (dayBreakdown(site, pack.rules, d).hours > 0) workdays++;
    expect(workdays).toBeGreaterThan(20);
    expect(base - on).toBeCloseTo(2 * workdays, 6);
  });
  it('midday ban removes 2.5 h/day on outdoor work only between 15 Jun and 15 Sep', () => {
    const rules = { ...pack.rules, layers: { ...pack.rules.layers, midday: true } };
    expect(dayBreakdown(site, rules, ymdToT(2027, 7, 12)).hours).toBeCloseTo(7.5, 6);
    expect(dayBreakdown(site, rules, ymdToT(2027, 10, 12)).hours).toBeCloseTo(10, 6);
    const indoor = pack.calendars.find((c) => c.id === 'indoor')!;
    expect(dayBreakdown(indoor, rules, ymdToT(2027, 7, 12)).hours).toBeCloseTo(9, 6);
  });
  it('Eid al-Fitr holidays are zero-hour days and flagged +/-1 day', () => {
    expect(dayBreakdown(site, pack.rules, ymdToT(2027, 3, 10)).hours).toBe(0);
    expect(pack.rules.holidays.find((h) => h.id === 'eidf27')!.uncertaintyDays).toBe(1);
  });
  it('marine works lose more to weather than general site works', () => {
    const rules = { ...pack.rules, layers: { ...pack.rules.layers, weather: true } };
    const d = ymdToT(2027, 7, 10);
    expect(dayBreakdown(marine, rules, d).hours).toBeLessThan(dayBreakdown(site, rules, d).hours);
  });
  it('scenario layers delay the finish; more layers => more delay; numbers reconcile with productive hours', () => {
    const ram = evaluate(plan, [{ kind: 'layers', layers: { ramadan: true } }]);
    const ramEid = evaluate(plan, [{ kind: 'layers', layers: { ramadan: true, eidLeave: true } }]);
    const summer = evaluate(plan, [{ kind: 'layers', layers: { midday: true } }]);
    expect(ram.dFinish).toBeGreaterThan(5);
    expect(ramEid.dFinish).toBeGreaterThan(ram.dFinish);
    expect(summer.dFinish).toBeGreaterThan(10);
    // Ramadan in 2027+2028+2029: lost working hours / 10 h per day is an upper bound on days lost to the finish
    let lostHrs = 0;
    for (const r of pack.rules.ramadan) lostHrs += periodHours(site, pack.rules, r.startT, r.endT) - periodHours(site, { ...pack.rules, layers: { ...pack.rules.layers, ramadan: true } }, r.startT, r.endT);
    expect(ram.dFinish).toBeLessThan((lostHrs / 10) * (7 / 6) + 3);
  });
  it('mitigations (night shift, overtime, stagger) recover days and carry a cost; stagger is almost free', () => {
    const base = [{ kind: 'layers' as const, layers: { ramadan: true, eidLeave: true } }];
    const win = { fromT: ymdToT(2027, 2, 8), toT: ymdToT(2027, 3, 20) };
    const { baseResult, options } = calendarRecovery(plan, base, win);
    expect(baseResult.dFinish).toBeGreaterThan(10);
    const night = options.find((o) => o.id === 'night')!;
    expect(night.recoveredDays).toBeGreaterThan(8);
    expect(night.spendAED).toBeGreaterThan(5e5);
    const stagger = options.find((o) => o.id === 'stagger')!;
    expect(stagger.spendAED).toBeLessThan(1);
    expect(stagger.recoveredDays).toBeGreaterThan(0);
  });
});

describe('H3 - asset failure prediction', () => {
  const cc02 = pack.assets.find((a) => a.id === 'CC-02')!;
  const checkpoint = ymdToT(2027, 1, 25) + 0.35;
  it('healthy fleet is healthy; CC-02 is the standout at the H3 checkpoint', () => {
    const reports = pack.assets.map((a) => healthReport(a, checkpoint));
    const worst = [...reports].sort((a, b) => a.health - b.health)[0];
    expect(worst.assetId).toBe('CC-02');
    expect(worst.health).toBeLessThan(50);
    for (const r of reports.filter((r) => r.assetId !== 'CC-02' && r.assetId !== 'GEN-02' && r.assetId !== 'DT-04')) expect(r.health).toBeGreaterThan(90);
  });
  it('predicts failure about 9 days out (true failure is scripted for 3 Feb)', () => {
    const r = healthReport(cc02, checkpoint);
    expect(r.rulDays).not.toBeNull();
    expect(r.rulDays!).toBeGreaterThan(7.5);
    expect(r.rulDays!).toBeLessThan(10.5);
    expect(r.degradingChannel).toBe('vib');
    expect(r.explanation[0].channelId).toBe('vib');
    expect(r.p14).toBeGreaterThan(0.9);
    // monotonic failure-probability curve
    for (let i = 1; i < r.failProb.length; i++) expect(r.failProb[i]).toBeGreaterThanOrEqual(r.failProb[i - 1]);
  });
  it('prediction is stable under repeat evaluation (deterministic telemetry)', () => {
    const a = healthReport(cc02, checkpoint);
    const b = healthReport(cc02, checkpoint);
    expect(a.health).toBe(b.health);
    expect(a.rulDays).toBe(b.rulDays);
  });
  it('if it fails: ~10 days lost; planned service: <= 2 days; service is far cheaper', () => {
    const plan2 = buildPlan(pack, checkpoint);
    const o = assetOptions(plan2, 'CC-02', ymdToT(2027, 2, 3), plan2.nowT);
    expect(o.run.dFinish).toBeGreaterThan(8);
    expect(o.run.dFinish).toBeLessThan(13);
    expect(o.run.assetEvents[0].downDays).toBe(11);
    expect(o.service.res.dFinish).toBeLessThan(2.1);
    expect(o.service.res.cost.total).toBeLessThan(o.run.cost.total / 3);
    expect(o.prepos.dFinish).toBeLessThan(o.run.dFinish);
    expect(o.run.assetEvents[0].hitActivities.length).toBeGreaterThan(0);
  });
});
