import { describe, expect, it } from 'vitest';
import { Cal, dayBreakdown, periodHours, buildCalendars } from '../src/engine/calendar';
import { D, PROJECT_START, weekday, ymdToT } from '../src/engine/dates';
import { noRules, prof, profiles } from './fixtures';

const close = (a: number, b: number, eps = 1e-6) => expect(Math.abs(a - b)).toBeLessThan(eps);

describe('dates', () => {
  it('project start 1 Nov 2026 is a Sunday', () => {
    expect(weekday(PROJECT_START)).toBe(0);
    expect(weekday(PROJECT_START + 5)).toBe(5); // Friday
  });
  it('ymdToT', () => {
    expect(ymdToT(2026, 11, 1)).toBe(0);
    expect(ymdToT(2027, 1, 15)).toBe(D(2027, 1, 15) - D(2026, 11, 1));
    expect(ymdToT(2027, 1, 15)).toBe(75);
  });
});

describe('calendar working-time calculus', () => {
  const cal = new Cal(prof('site'), noRules());
  it('10 h task from day 0 finishes the same day', () => {
    const s = cal.startOf(0);
    close(s, 0.25);
    close(cal.addWork(s, 10), 0.25 + 10 / 24);
  });
  it('30 h task finishes on day 2', () => close(cal.addWork(cal.startOf(0), 30), 2 + 0.25 + 10 / 24));
  it('skips Friday: 60 h starting Sunday ends Saturday (t=6)', () => {
    const t = cal.addWork(cal.startOf(0), 60);
    expect(Math.floor(t)).toBe(6);
    close(t, 6 + 0.25 + 10 / 24);
  });
  it('startOf skips non-working Friday', () => close(cal.startOf(5.1), 6.25));
  it('addWork/subWork are inverse', () => {
    const s = cal.startOf(3.4);
    const f = cal.addWork(s, 77);
    close(cal.subWork(f, 77), s, 1e-6);
  });
  it('workBetween counts only working hours', () => close(cal.workBetween(0, 7), 60));
  it('public holiday removes a working day', () => {
    const r = noRules({ holidays: [{ id: 'h', name: { en: 'x', ar: 'x' }, startT: 2, endT: 2, kind: 'public', uncertaintyDays: 0 }] });
    const c = new Cal(prof('site'), r);
    // 30h from Sunday: Sun, Mon, (Tue holiday), Wed => ends day 3
    expect(Math.floor(c.addWork(c.startOf(0), 30))).toBe(3);
  });
  it('Ramadan layer cuts 2 h/day (10 -> 8)', () => {
    const r = noRules({ ramadan: [{ startT: 0, endT: 20, cutHrs: 2 }], layers: { ...noRules().layers, ramadan: true } });
    const c = new Cal(prof('site'), r);
    close(c.hours[0], 8);
    close(c.addWork(c.startOf(0), 16), 1 + 0.25 + 8 / 24);
  });
  it('midday ban only applies to outdoor, non-exempt profiles, in the summer window', () => {
    const r = noRules({ layers: { ...noRules().layers, midday: true } });
    const jul = ymdToT(2027, 7, 10);
    const sep20 = ymdToT(2027, 9, 20);
    close(dayBreakdown(prof('site'), r, jul).hours, 7.5);
    close(dayBreakdown(prof('site'), r, sep20).hours, 10);
    close(dayBreakdown(prof('indoor', { outdoor: false }), r, jul).hours, 10);
    close(dayBreakdown(prof('site', { middayExempt: true }), r, jul).hours, 10);
    // ban window edges (15 Jun - 15 Sep inclusive)
    close(dayBreakdown(prof('site'), r, ymdToT(2027, 6, 14)).hours, 10);
    close(dayBreakdown(prof('site'), r, ymdToT(2027, 6, 15)).hours, 7.5);
    close(dayBreakdown(prof('site'), r, ymdToT(2027, 9, 15)).hours, 7.5);
    close(dayBreakdown(prof('site'), r, ymdToT(2027, 9, 16)).hours, 10);
  });
  it('weather loss applies to sea-sensitive profile only', () => {
    const sea = Array(12).fill(0);
    sea[0] = 0.2; // January
    const r = noRules({ weather: { sea, wind: Array(12).fill(0) }, layers: { ...noRules().layers, weather: true } });
    const jan = ymdToT(2027, 1, 12);
    close(dayBreakdown(prof('marine', { sea: true }), r, jan).hours, 8);
    close(dayBreakdown(prof('site'), r, jan).hours, 10);
  });
  it('night shift mitigation adds hours but ignores the midday ban', () => {
    const jul = ymdToT(2027, 7, 10);
    const r = noRules({
      layers: { ...noRules().layers, midday: true },
      shifts: [{ id: 's', label: { en: 'n', ar: 'n' }, calendars: ['site'], extraHrs: 6, fromT: jul - 5, toT: jul + 5, costPerHr: 1 }],
    });
    close(dayBreakdown(prof('site'), r, jul).hours, 7.5 + 6);
  });
  it('continuous calendar works 24/7', () => {
    const c = buildCalendars(profiles, noRules()).continuous;
    close(c.addWork(c.startOf(2.0), 48), 4.0);
  });
  it('periodHours reconciles with daily sum', () => {
    const r = noRules();
    // 14 days Sunday..Saturday x2 = 12 working days (Fridays off) = 120h
    close(periodHours(prof('site'), r, 0, 13), 120);
  });
});
