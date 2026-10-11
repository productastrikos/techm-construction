import { describe, expect, it } from 'vitest';
import { buildPortPack } from '../src/packs/port';
import { buildPlan } from '../src/engine/plan';
import { criticalIds } from '../src/engine/cpm';
import { stageAt } from '../src/engine/routes';
import { ymdToT } from '../src/engine/dates';

const pack = buildPortPack();
const plan = buildPlan(pack);

describe('Port pack integrity', () => {
  it('has the documented scale', () => {
    expect(pack.activities.length).toBeGreaterThanOrEqual(300);
    expect(pack.activities.length).toBeLessThanOrEqual(400);
    expect(pack.wbs.length).toBe(7);
    expect(pack.materials.length).toBeGreaterThanOrEqual(40);
    expect(pack.pos.length).toBeGreaterThanOrEqual(30);
    expect(pack.assets.length).toBeGreaterThanOrEqual(25);
  });
  it('activity ids are unique and every predecessor exists', () => {
    const ids = new Set(pack.activities.map((a) => a.id));
    expect(ids.size).toBe(pack.activities.length);
    for (const a of pack.activities) for (const p of a.preds) expect(ids.has(p.id), `${a.id} <- ${p.id}`).toBe(true);
  });
  it('every PO has a delivery milestone, every delivery has a consumer, and PO ids are unique', () => {
    expect(new Set(pack.pos.map((p) => p.id)).size).toBe(pack.pos.length);
    const consumed = new Set(pack.activities.flatMap((a) => a.preds.map((p) => p.id)));
    for (const po of pack.pos) {
      const d = pack.activities.find((a) => a.id === po.deliveryActivityId);
      expect(d?.kind).toBe('delivery');
      expect(consumed.has(po.deliveryActivityId), po.deliveryActivityId).toBe(true);
    }
  });
  it('3D elements reference real activities and every activity element exists', () => {
    const el = new Set(pack.elements.map((e) => e.id));
    for (const a of pack.activities) for (const e of a.elementIds) expect(el.has(e), `${a.id}:${e}`).toBe(true);
    for (const e of pack.elements) if (e.kind !== 'seabed') expect(e.activityIds.length, e.id).toBeGreaterThan(0);
  });
  it('no dangling activities: everything flows into a project-complete milestone', () => {
    const succ = new Map<string, number>();
    for (const a of pack.activities) for (const p of a.preds) succ.set(p.id, (succ.get(p.id) ?? 0) + 1);
    const terminals = pack.activities.filter((a) => !succ.get(a.id)).map((a) => a.id);
    expect(terminals).toEqual(['COM-MS2']);
  });
  it('baseline finishes around April 2029 (~30 months) and the forecast is slightly behind', () => {
    const fin = plan.baseline.finish;
    expect(fin).toBeGreaterThan(ymdToT(2029, 2, 15));
    expect(fin).toBeLessThan(ymdToT(2029, 5, 15));
    expect(plan.forecast.finish - plan.baseline.finish).toBeGreaterThan(0);
    expect(plan.forecast.finish - plan.baseline.finish).toBeLessThan(30);
  });
  it('the critical path runs through the quay-wall casting chain (CC-02 is on it) and ends at project completion', () => {
    const crit = criticalIds(plan.forecast);
    expect(crit).toContain('QW-C02');
    expect(crit).toContain('COM-MS2');
    expect(crit).toContain('MOB-120');
    const cc02 = pack.assets.find((a) => a.id === 'CC-02')!;
    expect(cc02.linkedActivityIds.some((id) => crit.includes(id))).toBe(true);
  });
  it('seed budget sums to the BAC (within rounding)', () => {
    const sum = pack.activities.reduce((s, a) => s + a.budget, 0);
    expect(Math.abs(sum - pack.config.bacAED) / pack.config.bacAED).toBeLessThan(0.002);
  });
  it('PO pipeline at the data date covers most of the 7 stages', () => {
    const stages = new Set(pack.pos.map((p) => stageAt(plan.poTl.get(p.id)!, plan.nowT)));
    for (const s of [-1, 0, 1, 3, 4, 5, 6]) expect(stages.has(s as never), `stage ${s}`).toBe(true);
  });
  it('4-5+ Chokepoint-exposed (Port A) POs exist; domestic POs use the local route', () => {
    const exposed = pack.pos.filter((p) => pack.routes.find((r) => r.id === p.routeId)!.chokepointDependent);
    expect(exposed.length).toBeGreaterThanOrEqual(5);
    for (const p of pack.pos.filter((p) => pack.materials.find((m) => m.id === p.materialId)!.origin === 'AE')) expect(p.routeId).toBe('R-LOC');
  });
  it('holidays carry the +/-1 day uncertainty for Islamic dates and fixed dates carry none', () => {
    const islamic = pack.rules.holidays.filter((h) => /expected/.test(h.name.en));
    expect(islamic.length).toBeGreaterThan(5);
    for (const h of islamic) expect(h.uncertaintyDays).toBe(1);
    expect(pack.rules.holidays.find((h) => h.id === 'nd27')!.uncertaintyDays).toBe(0);
  });
});
