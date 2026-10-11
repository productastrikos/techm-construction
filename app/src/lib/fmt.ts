import { dayToYmd, PROJECT_START, MS_DAY } from '../engine/dates';

export type Lang = 'en' | 'ar';
const loc = (lang: Lang) => (lang === 'ar' ? 'ar-AE-u-nu-latn' : 'en-GB');

export function fmtNum(n: number, lang: Lang = 'en', digits = 0): string {
  if (!Number.isFinite(n)) return '-';
  return new Intl.NumberFormat(loc(lang), { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(n);
}

/** AED, compact: 1.25 M, 340 k */
export function fmtAed(n: number, lang: Lang = 'en', compact = true): string {
  if (!Number.isFinite(n)) return '-';
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (!compact) return `${sign}${fmtNum(abs, lang)}`;
  const u = lang === 'ar' ? { b: ' مليار', m: ' مليون', k: ' ألف' } : { b: ' bn', m: ' M', k: ' k' };
  if (abs >= 1e9) return `${sign}${fmtNum(abs / 1e9, lang, 2)}${u.b}`;
  if (abs >= 1e6) return `${sign}${fmtNum(abs / 1e6, lang, abs >= 1e8 ? 0 : 1)}${u.m}`;
  if (abs >= 1e3) return `${sign}${fmtNum(abs / 1e3, lang, 0)}${u.k}`;
  return `${sign}${fmtNum(abs, lang)}`;
}

export function fmtPct(x: number, lang: Lang = 'en', digits = 0): string {
  return `${fmtNum(x * 100, lang, digits)}%`;
}

/** t = days since project start (float) */
export function fmtDate(t: number, lang: Lang = 'en', style: 'short' | 'med' | 'long' = 'med'): string {
  if (!Number.isFinite(t)) return '-';
  const day = Math.floor(PROJECT_START + t);
  const opts: Intl.DateTimeFormatOptions =
    style === 'short'
      ? { day: '2-digit', month: 'short', timeZone: 'UTC' }
      : style === 'long'
        ? { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }
        : { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' };
  return new Intl.DateTimeFormat(loc(lang), opts).format(new Date(day * MS_DAY));
}

export function fmtMonth(t: number, lang: Lang = 'en'): string {
  const day = Math.floor(PROJECT_START + t);
  return new Intl.DateTimeFormat(loc(lang), { month: 'short', year: '2-digit', timeZone: 'UTC' }).format(new Date(day * MS_DAY));
}

export function fmtDays(d: number, lang: Lang = 'en', signed = false): string {
  const n = Math.round(d * 10) / 10;
  const s = signed && n > 0 ? '+' : '';
  return `${s}${fmtNum(n, lang, Number.isInteger(n) ? 0 : 1)}${lang === 'ar' ? ' يوم' : ' d'}`;
}

export function ymd(t: number) {
  return dayToYmd(PROJECT_START + t);
}
