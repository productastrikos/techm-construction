import { describe, expect, it } from 'vitest';
import { buildCalendars } from '../src/engine/calendar';
import { act, criticalIds, runCpm } from '../src/engine/cpm';
import { mk, noRules, profiles } from './fixtures';

const cals = buildCalendars(profiles, noRules());
const close = (a: number, b: number, eps = 1e-6) => expect(Math.abs(a - b)).toBeLessThan(eps);
const T = (day: number, frac = 0.25, hrs = 0) => day + frac + hrs / 24;

describe('CPM forward / backward pass', () => {
  // A(3d) -> B(2d) -> D(1d) ; A -> C(1d) -> D   (C has float)
  const acts = [mk('A', 3), mk('B', 2, ['A']), mk('C', 1, ['A']), mk('D', 1, ['B', 'C'])];
  const r = runCpm({ activities: acts, cals });
  it('forward pass dates (hand computed)', () => {
    close(act(r, 'A').es, T(0));
    close(act(r, 'A').ef, T(2, 0.25, 10)); // 30 h => end of day 2
    close(act(r, 'B').es, T(3));
    close(act(r, 'B').ef, T(4, 0.25, 10));
    expect(Math.floor(act(r, 'D').es)).toBe(6); // Friday (5) is off
  });
  it('critical path = A,B,D and C has float', () => {
    expect(criticalIds(r)).toEqual(['A', 'B', 'D']);
    expect(act(r, 'C').tf).toBeGreaterThan(0.9);
    expect(act(r, 'C').critical).toBe(false);
  });
  it('total float of C = 1 day (B is one day longer)', () => {
    close(act(r, 'C').tf, 1, 1e-6);
  });
  it('project finish equals D finish', () => close(r.finish, act(r, 'D').ef));
});

describe('relationships and lags', () => {
  it('SS with lag', () => {
    const r = runCpm({ activities: [mk('A', 5), mk('B', 2, [['A', 'SS', 10]])], cals });
    // B starts 10 working hours after A starts -> next working day start (t=1.25)
    close(act(r, 'B').es, 1.25, 1e-6);
  });
  it('FF with lag forces finish no earlier than pred finish + lag', () => {
    const r = runCpm({ activities: [mk('A', 3), mk('B', 1, [['A', 'FF', 10]])], cals });
    expect(act(r, 'B').ef).toBeGreaterThanOrEqual(act(r, 'A').ef + 0.9);
  });
  it('FS with negative lag (lead) overlaps', () => {
    const r = runCpm({ activities: [mk('A', 4), mk('B', 2, [['A', 'FS', -10]])], cals });
    expect(act(r, 'B').es).toBeLessThan(act(r, 'A').ef);
    close(act(r, 'B').es, T(3));
  });
  it('milestone has zero duration', () => {
    const r = runCpm({ activities: [mk('A', 2), mk('M', 0, ['A'])], cals });
    close(act(r, 'M').es, act(r, 'M').ef);
  });
  it('start-no-earlier constraint delays the successor (material not available until X)', () => {
    const acts = [mk('A', 1), mk('B', 1, ['A'])];
    const base = runCpm({ activities: acts, cals });
    const late = runCpm({ activities: acts, cals, snet: new Map([['B', 20]]) });
    close(act(late, 'B').es, 20.25);
    expect(late.finish - base.finish).toBeGreaterThan(18);
  });
  it('different calendars: continuous curing works through the Friday', () => {
    const acts = [mk('A', 1), mk('Cure', 4, ['A'], { calendarId: 'continuous', durationHrs: 4 * 24 }), mk('B', 1, ['Cure'])];
    const r = runCpm({ activities: acts, cals });
    close(act(r, 'Cure').ef - act(r, 'Cure').es, 4, 1e-6);
  });
  it('cycle detection', () => {
    expect(() => runCpm({ activities: [mk('A', 1, ['B']), mk('B', 1, ['A'])], cals })).toThrow(/Cycle/);
  });
});

describe('data date and actuals', () => {
  const acts = [mk('A', 3), mk('B', 3, ['A']), mk('C', 3, ['B'])];
  it('completed activities are fixed; remaining work resumes at the data date', () => {
    const actuals = new Map([
      ['A', { start: 0.25, finish: 3.0, pct: 1 }],
      ['B', { start: 4.0, remainingHrs: 10, pct: 0.66 }],
    ]);
    const r = runCpm({ activities: acts, cals, dataDate: 6.3, actuals });
    close(act(r, 'A').ef, 3.0);
    expect(act(r, 'A').done).toBe(true);
    // B has 10 h left and resumes at data date 6.3 (Saturday): 8.8 h remain that day, 1.2 h spill to Sunday
    close(act(r, 'B').ef, 7.25 + 1.2 / 24, 1e-6);
    expect(act(r, 'C').es).toBeGreaterThan(act(r, 'B').ef - 1e-9);
    expect(act(r, 'A').critical).toBe(false);
  });
  it('nothing unstarted can begin before the data date', () => {
    const r = runCpm({ activities: acts, cals, dataDate: 30 });
    expect(act(r, 'A').es).toBeGreaterThanOrEqual(30);
  });
});

describe('contract finish target gives negative float', () => {
  it('tf < 0 on the critical chain when target is before the forecast finish', () => {
    const acts = [mk('A', 5), mk('B', 5, ['A'])];
    const free = runCpm({ activities: acts, cals });
    const r = runCpm({ activities: acts, cals, finishTarget: free.finish - 3 });
    expect(act(r, 'B').tf).toBeLessThan(-2);
  });
});

describe('performance', () => {
  it('400 activities recompute in < 50 ms', () => {
    const acts = [mk('X0', 2)];
    for (let i = 1; i < 400; i++) acts.push(mk(`X${i}`, 1 + (i % 7), [`X${Math.max(0, i - 1 - (i % 3))}`, `X${Math.max(0, i - 5)}`]));
    runCpm({ activities: acts, cals });
    const t0 = performance.now();
    for (let k = 0; k < 5; k++) runCpm({ activities: acts, cals });
    const per = (performance.now() - t0) / 5;
    expect(per).toBeLessThan(50);
  });
});
