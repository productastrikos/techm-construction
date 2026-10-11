/**
 * Deterministic 7 / 30 day outlook for a KPI tile.
 * The current value comes from the live engines; the outlook is a trend + confidence band seeded from the KPI itself
 * (stable between renders, direction follows the tile's tone), so every KPI can show a prediction.
 */
export type KpiTone = 'good' | 'bad' | 'warn' | 'info' | 'violet' | 'neutral' | 'accent';

export interface KpiSpec {
  label: string;
  value: string;
  unit?: string;
  hint?: string;
  delta?: string;
  tone: KpiTone;
  /** called by the "Open page" button in the panel (the tile's original navigation) */
  goto?: () => void;
}

export interface Outlook {
  kind: 'num' | 'date';
  now: number;
  /** last 7 days incl. today (index 6 = today) */
  hist: number[];
  mid: number[];
  lo: number[];
  hi: number[];
  /** format a series value for display */
  fmt: (v: number) => string;
  /** smallest meaningful axis step (one displayed unit) */
  step: number;
  higherIsBetter: boolean;
  /** relative change of the central forecast at day 7 / day 30 */
  d7: number;
  d30: number;
  conf7: number;
  conf30: number;
}

const NUM = /[-+]?\d[\d,]*\.?\d*/;

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function rng(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const LOWER_IS_BETTER = /risk|alarm|exposed|late|delay|behind|slip|ltifr|overdue|open|incident|rework|cost|eac|vac|deficit|breach|downtime|rfi|ncr|backlog|خطر|إنذار|تأخر|تعرض|حوادث|مفتوح/i;

/** parse the displayed value: a plain number, a number with a unit suffix ("92.4%"), or a date ("12 Mar 2027") */
export function buildOutlook(spec: KpiSpec, lang: 'en' | 'ar', startDay: number): Outlook | null {
  const text = spec.value.trim();
  const rnd = rng(hash(spec.label + '|' + spec.value));

  let kind: Outlook['kind'] = 'num';
  let base = NaN;
  let fmt: (v: number) => string;
  let step = 1;

  const asDate = /[A-Za-z؀-ۿ]{3}/.test(text) ? Date.parse(text.replace(/(\d)(st|nd|rd|th)/, '$1')) : NaN;
  if (!Number.isNaN(asDate) && /\d{4}|\d{1,2}\s+[A-Za-z]{3}/.test(text)) {
    kind = 'date';
    base = asDate / 86400000;
    fmt = (v) => new Date(v * 86400000).toLocaleDateString(lang === 'ar' ? 'ar-AE-u-nu-latn' : 'en-GB', { day: '2-digit', month: 'short', timeZone: 'UTC' });
  } else {
    const m = text.match(NUM);
    if (!m) return null;
    base = parseFloat(m[0].replace(/,/g, ''));
    if (!Number.isFinite(base)) return null;
    const dec = (m[0].split('.')[1] ?? '').length;
    step = Math.pow(10, -dec);
    const isPct = /%/.test(text);
    const pre = text.slice(0, m.index);
    const post = text.slice(m.index! + m[0].length);
    fmt = (v) => {
      const vv = isPct ? Math.min(100, Math.max(0, v)) : v;
      const body = dec > 0 ? vv.toFixed(dec) : Math.round(vv).toLocaleString('en');
      return `${pre}${dec > 0 ? Number(body).toLocaleString('en', { minimumFractionDigits: dec, maximumFractionDigits: dec }) : body}${post}`;
    };
  }

  // a completion date: later is worse. Otherwise the label decides.
  const lowerBetter = kind === 'date' || LOWER_IS_BETTER.test(spec.label);
  const higherIsBetter = !lowerBetter;
  // direction of travel: good tiles hold or improve, warn / bad tiles drift the wrong way
  const sign = spec.tone === 'good' ? (higherIsBetter ? 1 : -1) * (0.25 + rnd() * 0.5) : spec.tone === 'warn' || spec.tone === 'bad' ? (higherIsBetter ? -1 : 1) * (0.6 + rnd() * 0.8) : (rnd() < 0.5 ? -1 : 1) * (0.2 + rnd() * 0.4);

  const scale = kind === 'date' ? 4 : Math.max(Math.abs(base), 1) * (Math.abs(base) < 5 ? 0.4 : 1);
  const vol = kind === 'date' ? 0.5 : scale * 0.006;
  // slope per day (relative to the scale): ~0.3-0.9 % per day for dates (days), ~0.2-0.5 % per day for numbers
  const slope = kind === 'date' ? sign * 0.35 : sign * scale * 0.0035;

  const hist: number[] = [];
  let v = base;
  for (let i = 6; i >= 0; i--) {
    hist[i] = v;
    v = v - slope * 0.6 + (rnd() - 0.5) * 2 * vol;
  }
  hist[6] = base;

  const mid: number[] = [];
  const lo: number[] = [];
  const hi: number[] = [];
  const horizon = 30;
  for (let d = 0; d <= horizon; d++) {
    const drift = slope * d + Math.sin(d / 3.1 + rnd() * 0.2) * vol * 0.8;
    const c = base + drift;
    const band = vol * (1.1 + d * 0.28) + (kind === 'date' ? d * 0.08 : 0);
    mid.push(d === 0 ? base : c);
    lo.push(d === 0 ? base : c - band);
    hi.push(d === 0 ? base : c + band);
  }
  const rel = (x: number) => (kind === 'date' ? x - base : base === 0 ? 0 : (x - base) / Math.abs(base));
  void startDay;
  return { kind, now: base, hist, mid, lo, hi, fmt, step, higherIsBetter, d7: rel(mid[7]), d30: rel(mid[30]), conf7: Math.round(88 - rnd() * 6), conf30: Math.round(74 - rnd() * 8) };
}
