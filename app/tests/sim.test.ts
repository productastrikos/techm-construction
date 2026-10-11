import { describe, expect, it } from 'vitest';
import { SimCore } from '../src/sim/core';
import { ymdToT } from '../src/engine/dates';
import { enAll as en, arAll as ar } from '../src/i18n/dict';
import { buildPortPack } from '../src/packs/port';
import { buildPlan } from '../src/engine/plan';
import { evmAt, sCurve, cashflow } from '../src/engine/evm';

describe('i18n', () => {
  it('Arabic has exactly the same keys as English, none empty', () => {
    const e = Object.keys(en).sort();
    const a = Object.keys(ar).sort();
    expect(a.filter((k) => !(k in en))).toEqual([]);
    expect(e.filter((k) => !(k in ar))).toEqual([]);
    for (const k of a) expect(ar[k].trim().length, k).toBeGreaterThan(0);
  });
  it('interpolation placeholders match between languages', () => {
    const ph = (s: string) => (s.match(/\{\{\w+\}\}/g) ?? []).sort().join(',');
    for (const k of Object.keys(en)) expect(ph(ar[k] ?? ''), k).toBe(ph(en[k]));
  });
});

describe('SimCore (inline DataSource)', () => {
  const core = new SimCore('port');
  it('boots and returns a complete snapshot', async () => {
    await core.init();
    const pack = buildPortPack();
    const s = await core.getSnapshot(pack.config.nowT);
    expect(s.pos.length).toBe(pack.pos.length);
    expect(s.assets.length).toBe(pack.assets.length);
    expect(s.briefing.bullets.length).toBeGreaterThan(3);
    expect(s.alarms.length).toBeGreaterThan(1);
    expect(s.criticalPath.length).toBeGreaterThan(10);
    expect(s.kpis.fleetAvailability).toBeGreaterThan(0.85);
    expect(s.kpis.poTotal).toBeGreaterThan(20);
    expect(s.evm.bac).toBeGreaterThan(2.0e9);
    expect(s.evm.cpi).toBeGreaterThan(0.9);
    expect(s.evm.cpi).toBeLessThan(1.05);
  });
  it('re-plans as the demo clock advances: progress grows and the CC-02 alarm appears by the H3 checkpoint', async () => {
    const s0 = await core.getSnapshot(ymdToT(2027, 1, 15));
    const s1 = await core.getSnapshot(ymdToT(2027, 1, 25) + 0.35);
    expect(s1.evm.ev).toBeGreaterThan(s0.evm.ev);
    const cc = s1.assets.find((a) => a.id === 'CC-02')!;
    expect(cc.report.health).toBeLessThan(50);
    expect(s1.alarms.some((a) => a.ref === 'CC-02' && a.severity === 'crit')).toBe(true);
    const cc0 = s0.assets.find((a) => a.id === 'CC-02')!;
    expect(cc0.report.health).toBeGreaterThan(cc.report.health + 15);
  });
  it('is deterministic: the same clock gives the same snapshot (Reset returns to the exact start)', async () => {
    const a = await core.getSnapshot(ymdToT(2027, 2, 2));
    await core.reset();
    const b = await core.getSnapshot(ymdToT(2027, 2, 2));
    expect(b.forecastFinish).toBe(a.forecastFinish);
    expect(b.evm.ev).toBe(a.evm.ev);
    expect(b.assets.map((x) => x.report.health)).toEqual(a.assets.map((x) => x.report.health));
  });
  it('runs scenarios through the DataSource interface', async () => {
    const pack = buildPortPack();
    const r = await core.runScenario(pack.config.nowT, [{ kind: 'chokepoint', state: 'closed', startT: pack.config.nowT, durationDays: 365 }]);
    expect(r.dFinish).toBeGreaterThan(10);
    const rec = await core.recovery(pack.config.nowT, 'supply', [{ kind: 'chokepoint', state: 'closed', startT: pack.config.nowT, durationDays: 365 }]);
    expect(rec.options.length).toBeGreaterThan(1);
  });
  it('serves deterministic telemetry', async () => {
    const pack = buildPortPack();
    const a = await core.telemetry('CC-02', 'vib', pack.config.nowT - 20, pack.config.nowT, 1, pack.config.nowT);
    const b = await core.telemetry('CC-02', 'vib', pack.config.nowT - 20, pack.config.nowT, 1, pack.config.nowT);
    expect(a.length).toBe(21);
    expect(a).toEqual(b);
    // vibration is trending up
    expect(a[a.length - 1].v).toBeGreaterThan(a[0].v);
  });
  it('productive hours series for the heatmap', async () => {
    const h = await core.productiveHours('site', { midday: true }, ymdToT(2027, 7, 1), ymdToT(2027, 7, 14));
    expect(h.length).toBe(14);
    expect(Math.max(...h)).toBeCloseTo(7.5, 6);
    expect(h.filter((x) => x === 0).length).toBe(2); // two Fridays
  });
});

describe('EVM', () => {
  const pack = buildPortPack();
  const plan = buildPlan(pack);
  it('PV at the finish equals BAC; EV never exceeds BAC; identities hold', () => {
    const e = evmAt(plan, plan.forecast, plan.nowT);
    expect(e.sv).toBeCloseTo(e.ev - e.pv, 6);
    expect(e.cv).toBeCloseTo(e.ev - e.ac, 6);
    expect(e.cpi).toBeCloseTo(e.ev / e.ac, 6);
    expect(e.spi).toBeCloseTo(e.ev / e.pv, 6);
    expect(e.eac).toBeCloseTo(e.bac / e.cpi, 4);
    expect(e.vac).toBeCloseTo(e.bac - e.eac, 4);
    const end = evmAt(plan, plan.baseline, plan.baseline.finish + 1);
    expect(end.pv).toBeCloseTo(end.bac, -3);
    expect(end.ev).toBeLessThanOrEqual(end.bac * 1.0001);
  });
  it('S-curve is monotonic and ends at BAC; actual stops at the data date', () => {
    const s = sCurve(plan, plan.forecast);
    for (let i = 1; i < s.planned.length; i++) expect(s.planned[i]).toBeGreaterThanOrEqual(s.planned[i - 1] - 1);
    expect(s.planned[s.planned.length - 1]).toBeCloseTo(pack.activities.reduce((a, b) => a + b.budget, 0), -4);
    expect(s.actual.filter((x) => x !== null).length).toBeGreaterThan(1);
    expect(s.actual[s.actual.length - 1]).toBeNull();
  });
  it('cash flow retention and advance recovery obey the contract terms', () => {
    const cf = cashflow(plan, plan.forecast);
    const cert = cf.reduce((s, m) => s + m.certified, 0);
    const ret = cf.reduce((s, m) => s + m.retention, 0);
    expect(ret / cert).toBeCloseTo(pack.config.retentionPct, 6);
    const adv = cf.reduce((s, m) => s + m.advanceRecovery, 0);
    expect(adv).toBeLessThanOrEqual(pack.config.advancePct * pack.config.bacAED + 1);
  });
});
