import { bi } from '../src/lib/bi';
import type { Activity, CalendarProfile, CalendarRules, Pred } from '../src/engine/types';

export const prof = (id: CalendarProfile['id'], over: Partial<CalendarProfile> = {}): CalendarProfile => ({
  id,
  name: bi(id, id),
  baseHours: 10,
  // t=0 (1 Nov 2026) is a Sunday; Friday (5) off
  workDays: [true, true, true, true, true, false, true],
  outdoor: true,
  sea: false,
  wind: false,
  ramadan: true,
  middayExempt: false,
  ...over,
});

export const profiles: CalendarProfile[] = [
  prof('site'),
  prof('marine', { sea: true }),
  prof('crane', { wind: true }),
  prof('indoor', { outdoor: false }),
  prof('continuous', { baseHours: 24, workDays: [true, true, true, true, true, true, true], outdoor: false, ramadan: false, middayExempt: true }),
];

export const noRules = (over: Partial<CalendarRules> = {}): CalendarRules => ({
  holidays: [],
  ramadan: [],
  eidLeave: [],
  middayBan: { m1: 6, d1: 15, m2: 9, d2: 15, cutHrs: 2.5 },
  weather: { sea: Array(12).fill(0), wind: Array(12).fill(0) },
  heat: Array(12).fill(0),
  layers: { holidays: true, ramadan: false, midday: false, weather: false, heat: false, eidLeave: false },
  shifts: [],
  ...over,
});

export const mk = (id: string, days: number, preds: Array<string | [string, Pred['type'], number]> = [], over: Partial<Activity> = {}): Activity => ({
  id,
  wbsId: 'W',
  name: bi(id, id),
  kind: days === 0 ? 'milestone' : 'task',
  durationHrs: days * 10,
  calendarId: 'site',
  preds: preds.map((p) => (typeof p === 'string' ? { id: p, type: 'FS' as const, lagHrs: 0 } : { id: p[0], type: p[1], lagHrs: p[2] })),
  budget: 1000,
  elementIds: [],
  ...over,
});
