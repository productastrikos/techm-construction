// Day arithmetic shared by every engine. All dates are "site-local calendar days" encoded as UTC day numbers so
// there is no timezone drift between worker, tests and UI. `t` (float days since PROJECT_START) is the engine axis.

export const MS_DAY = 86_400_000;

/** UTC day number (days since 1970-01-01) for a calendar date. month is 1..12. */
export function D(y: number, m: number, d: number): number {
  return Math.round(Date.UTC(y, m - 1, d) / MS_DAY);
}

/** Project origin: contract start. Illustrative. */
export const PROJECT_START = D(2026, 11, 1);

export function dayToYmd(day: number): { y: number; m: number; d: number } {
  const dt = new Date(Math.floor(day) * MS_DAY);
  return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
}

/** 0 = Sunday ... 6 = Saturday */
export function weekday(day: number): number {
  return (((Math.floor(day) + 4) % 7) + 7) % 7;
}

/** t (days since project start, float) -> UTC day number (float) */
export const tToDay = (t: number) => PROJECT_START + t;
export const dayToT = (day: number) => day - PROJECT_START;
export const ymdToT = (y: number, m: number, d: number) => D(y, m, d) - PROJECT_START;

export function tToMs(t: number): number {
  return (PROJECT_START + t) * MS_DAY;
}
export function msToT(ms: number): number {
  return ms / MS_DAY - PROJECT_START;
}

export function iso(t: number): string {
  const { y, m, d } = dayToYmd(PROJECT_START + t);
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** month index (1..12) of a t value */
export function monthOfT(t: number): number {
  return dayToYmd(PROJECT_START + t).m;
}

export function clamp(x: number, a: number, b: number) {
  return Math.min(b, Math.max(a, x));
}

/** deterministic PRNG (mulberry32) */
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** stable string -> uint32 hash (FNV-1a) */
export function hash32(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** hash-based noise in [-1,1] for (key, integer index) - closed form so telemetry is scrubbable */
export function noise1(key: number, i: number): number {
  let h = (key ^ Math.imul(i | 0, 0x9e3779b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h ^= h >>> 16;
  return ((h >>> 0) / 4294967296) * 2 - 1;
}
