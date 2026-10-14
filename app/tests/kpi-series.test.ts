import { describe, expect, it } from 'vitest';
import { buildSeries, TIMEFRAMES, type KpiSpec } from '../src/features/kpi/forecast';

const lbl = (d: number) => `d${d}`;
const num: KpiSpec = { label: 'SPI', value: '0.94', tone: 'warn' };
const pct: KpiSpec = { label: 'Fleet availability', value: '97%', tone: 'good' };
const date: KpiSpec = { label: 'Forecast completion', value: '21 Mar 2027', tone: 'warn' };

describe('KPI series (mirrors the reference /api/v1/kpi shape)', () => {
  it('returns history + outlook for every time frame, aligned to nowIndex', () => {
    for (const tf of TIMEFRAMES) {
      const s = buildSeries(num, 'en', tf, lbl)!;
      expect(s.labels).toHaveLength(2 * tf + 1);
      expect(s.nowIndex).toBe(tf);
      for (const k of ['actual', 'forecast', 'lower', 'upper', 'previous'] as const) expect(s[k]).toHaveLength(2 * tf + 1);
      expect(s.actual[tf]).toBeCloseTo(0.94, 6);
      expect(s.forecast[tf]).toBeCloseTo(0.94, 6);
      expect(s.actual[tf + 1]).toBeNull();
      expect(s.forecast[tf - 1]).toBeNull();
    }
  });
  it('is deterministic', () => {
    expect(buildSeries(num, 'en', 30, lbl)).toEqual(buildSeries(num, 'en', 30, lbl));
  });
  it('the confidence band brackets the forecast and widens with the horizon', () => {
    const s = buildSeries(num, 'en', 90, lbl)!;
    for (let i = s.nowIndex + 1; i < s.labels.length; i++) {
      expect(s.lower[i]!).toBeLessThanOrEqual(s.forecast[i]! + 1e-9);
      expect(s.upper[i]!).toBeGreaterThanOrEqual(s.forecast[i]! - 1e-9);
    }
    const w = (i: number) => s.upper[i]! - s.lower[i]!;
    expect(w(s.labels.length - 1)).toBeGreaterThan(w(s.nowIndex + 3));
  });
  it('a longer window is less confident', () => {
    expect(buildSeries(num, 'en', 7, lbl)!.stats.confidence).toBeGreaterThan(buildSeries(num, 'en', 90, lbl)!.stats.confidence);
  });
  it('previous period is the same length and precedes the window', () => {
    const s = buildSeries(num, 'en', 30, lbl)!;
    expect(s.previous.slice(0, 31).every((v) => v != null)).toBe(true);
    expect(s.previous.slice(31).every((v) => v == null)).toBe(true);
  });
  it('percent KPIs never leave 0..100 and dates report the band in days', () => {
    const p = buildSeries(pct, 'en', 90, lbl)!;
    for (const v of [...p.actual, ...p.forecast, ...p.upper, ...p.lower]) if (v != null) expect(v).toBeLessThanOrEqual(100);
    const d = buildSeries(date, 'en', 30, lbl)!;
    expect(d.kind).toBe('date');
    expect(d.stats.band).toMatch(/^±\d+\.\d d$/);
    expect(d.stats.worsening).toBe(true); // a warn-tone completion date drifts later
  });
  it('returns null for a value with nothing to forecast', () => {
    expect(buildSeries({ label: 'x', value: 'n/a', tone: 'neutral' }, 'en', 30, lbl)).toBeNull();
  });
});
