// Working-time calculus. A calendar turns "working hours" into real dates and back, honouring weekends, public holidays,
// Ramadan reduced hours, the summer midday ban, Eid leave surges, sea-state/wind downtime and heat productivity loss.
// Pure TS, deterministic, unit-tested. All layers are switchable so scenarios can overlay them on the baseline calendar.
import { dayToYmd, PROJECT_START, clamp } from './dates';
import type { CalId, CalendarLayers, CalendarProfile, CalendarRules } from './types';

export const ALL_LAYERS_OFF: CalendarLayers = { holidays: true, ramadan: false, midday: false, weather: false, heat: false, eidLeave: false };
export const ALL_LAYERS_ON: CalendarLayers = { holidays: true, ramadan: true, midday: true, weather: true, heat: true, eidLeave: true };

export interface DayBreakdown {
  base: number;
  holiday: boolean;
  ramadanCut: number;
  middayCut: number;
  weatherLoss: number;
  heatLoss: number;
  eidLoss: number;
  shiftHrs: number;
  hours: number;
}

/** Productive working hours for a calendar profile on integer day `d` (days since project start). */
export function dayBreakdown(p: CalendarProfile, rules: CalendarRules, d: number): DayBreakdown {
  const out: DayBreakdown = { base: 0, holiday: false, ramadanCut: 0, middayCut: 0, weatherLoss: 0, heatLoss: 0, eidLoss: 0, shiftHrs: 0, hours: 0 };
  const L = rules.layers;
  const wd = (((PROJECT_START + d + 4) % 7) + 7) % 7;
  if (p.id === 'continuous') {
    out.base = p.baseHours;
    out.hours = p.baseHours;
    return out;
  }
  if (!p.workDays[wd]) return out;
  out.base = p.baseHours;
  if (L.holidays && rules.holidays.some((h) => d >= h.startT && d <= h.endT)) {
    out.holiday = true;
    return out;
  }
  let h = p.baseHours;
  if (L.ramadan && p.ramadan) {
    const r = rules.ramadan.find((x) => d >= x.startT && d <= x.endT);
    if (r) {
      out.ramadanCut = r.cutHrs;
      h -= r.cutHrs;
    }
  }
  const { m, d: dd } = dayToYmd(PROJECT_START + d);
  if (L.midday && p.outdoor && !p.middayExempt) {
    const b = rules.middayBan;
    const afterStart = m > b.m1 || (m === b.m1 && dd >= b.d1);
    const beforeEnd = m < b.m2 || (m === b.m2 && dd <= b.d2);
    if (afterStart && beforeEnd) {
      out.middayCut = b.cutHrs;
      h -= b.cutHrs;
    }
  }
  h = Math.max(0, h);
  let f = 1;
  if (L.weather) {
    const loss = (p.sea ? rules.weather.sea[m - 1] : 0) + (p.wind ? rules.weather.wind[m - 1] : 0);
    out.weatherLoss = clamp(loss, 0, 0.9);
    f *= 1 - out.weatherLoss;
  }
  if (L.heat && p.outdoor) {
    out.heatLoss = rules.heat[m - 1];
    f *= 1 - out.heatLoss;
  }
  if (L.eidLeave) {
    const e = rules.eidLeave.find((x) => d >= x.startT && d <= x.endT);
    if (e) {
      out.eidLoss = e.loss;
      f *= 1 - e.loss;
    }
  }
  let total = h * f;
  for (const s of rules.shifts) {
    if (s.calendars.includes(p.id) && d >= s.fromT && d <= s.toT) {
      // extra shift hours are not subject to midday ban/heat but are subject to weather
      const w = L.weather ? 1 - out.weatherLoss : 1;
      out.shiftHrs += s.extraHrs * w;
      total += s.extraHrs * w;
    }
  }
  out.hours = Math.max(0, Math.min(23, total));
  return out;
}

export class Cal {
  readonly H: number;
  readonly hours: Float64Array;
  readonly start: Float64Array;
  readonly cum: Float64Array;
  readonly tailPerDay: number;
  readonly profile: CalendarProfile;

  constructor(profile: CalendarProfile, rules: CalendarRules, horizon = 1800) {
    this.profile = profile;
    this.H = horizon;
    this.hours = new Float64Array(horizon);
    this.start = new Float64Array(horizon);
    this.cum = new Float64Array(horizon + 1);
    for (let d = 0; d < horizon; d++) {
      const h = dayBreakdown(profile, rules, d).hours;
      this.hours[d] = h;
      this.start[d] = profile.id === 'continuous' ? 0 : Math.min(0.25, 1 - h / 24);
      this.cum[d + 1] = this.cum[d] + h;
    }
    const tailDays = 28;
    this.tailPerDay = Math.max(0.5, (this.cum[horizon] - this.cum[horizon - tailDays]) / tailDays);
  }

  /** cumulative working hours at time t */
  C(t: number): number {
    if (t <= 0) return t < 0 ? (t * this.profile.baseHours * 6) / 7 : 0;
    if (t >= this.H) return this.cum[this.H] + (t - this.H) * this.tailPerDay;
    const d = Math.floor(t);
    const h = this.hours[d];
    if (h <= 0) return this.cum[d];
    const frac = clamp((t - (d + this.start[d])) / (h / 24), 0, 1);
    return this.cum[d] + frac * h;
  }

  /** earliest instant >= t at which work can happen */
  startOf(t: number): number {
    if (t < 0) t = 0;
    let d = Math.floor(t);
    while (d < this.H) {
      const h = this.hours[d];
      if (h > 0) {
        const ws = d + this.start[d];
        const we = ws + h / 24;
        if (t < ws) return ws;
        if (t < we - 1e-9) return t;
      }
      d++;
      t = Math.max(t, d);
    }
    return t;
  }

  /** latest instant <= t at which work could have ended */
  endOf(t: number): number {
    if (t >= this.H) return t;
    let d = Math.floor(t);
    while (d >= 0) {
      const h = this.hours[d];
      if (h > 0) {
        const ws = d + this.start[d];
        const we = ws + h / 24;
        if (t >= we) return we;
        if (t > ws + 1e-9) return t;
      }
      d--;
      t = Math.min(t, d + 1 - 1e-12);
    }
    return Math.max(0, t);
  }

  /** time after performing `hrs` of work starting at t (t should already be a working instant) */
  addWork(t: number, hrs: number): number {
    if (hrs <= 0) return t;
    const X = this.C(t) + hrs;
    return this.invertFinish(X);
  }

  /** time at which work of `hrs` hours must start so that it ends at t */
  subWork(t: number, hrs: number): number {
    if (hrs <= 0) return t;
    const X = this.C(t) - hrs;
    return this.invertStart(X);
  }

  /** earliest t with C(t) == X, ending-of-work convention (end of the earlier working day when X sits on a boundary) */
  private invertFinish(X: number): number {
    const cum = this.cum;
    if (X <= 0) return X / Math.max(1, this.profile.baseHours);
    if (X > cum[this.H]) return this.H + (X - cum[this.H]) / this.tailPerDay;
    let lo = 0;
    let hi = this.H;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (cum[mid] >= X) hi = mid;
      else lo = mid + 1;
    }
    const d = lo - 1;
    return d + this.start[d] + (X - cum[d]) / 24;
  }

  /** latest t with C(t) == X, start-of-work convention */
  private invertStart(X: number): number {
    const cum = this.cum;
    if (X < 0) return X / Math.max(1, this.profile.baseHours);
    if (X >= cum[this.H]) return this.H + (X - cum[this.H]) / this.tailPerDay;
    let lo = 0;
    let hi = this.H;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (cum[mid] > X) hi = mid;
      else lo = mid + 1;
    }
    const d = lo - 1;
    return d + this.start[d] + (X - cum[d]) / 24;
  }

  workBetween(t1: number, t2: number): number {
    return this.C(t2) - this.C(t1);
  }
}

export type CalMap = Record<CalId, Cal>;

export function buildCalendars(profiles: CalendarProfile[], rules: CalendarRules, horizon = 1800): CalMap {
  const out = {} as CalMap;
  for (const p of profiles) out[p.id] = new Cal(p, rules, horizon);
  return out;
}

/** Aggregate productive hours for a date range - used by the heatmap and by mitigation tables. */
export function periodHours(p: CalendarProfile, rules: CalendarRules, fromT: number, toT: number): number {
  let s = 0;
  for (let d = Math.floor(fromT); d <= Math.floor(toT); d++) s += dayBreakdown(p, rules, d).hours;
  return s;
}

export function withLayers(rules: CalendarRules, layers: Partial<CalendarLayers>): CalendarRules {
  return { ...rules, layers: { ...rules.layers, ...layers } };
}
