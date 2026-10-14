/**
 * Deterministic KPI series for the detail panel.
 *
 * The response shape mirrors the reference control-tower API (`GET /api/v1/kpi?label=&value=&tf=`):
 * `labels / actual / forecast / lower / upper / previous / nowIndex / stats`, one call per time frame. Here it is built
 * in the browser so the demo works offline; to move it behind the hub, serve `buildSeries(spec, tf)` from
 * `server/` and keep the panel unchanged (see docs/08_REFERENCE_API_AND_AI_UX.md).
 *
 * The current value comes from the live engines. History and outlook are a trend + confidence band seeded from the KPI
 * itself (stable between renders, direction follows the tile's tone). It is NOT an engine forecast.
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

/** time frames offered by the day filter: history window = forecast horizon = N days */
export const TIMEFRAMES = [7, 14, 30, 90] as const;
export type Timeframe = (typeof TIMEFRAMES)[number];

export interface KpiSeries {
  tf: Timeframe;
  kind: 'num' | 'date';
  /** `tf` days of history, today, then `tf` days of outlook: (2 * tf + 1) points */
  labels: string[];
  actual: Array<number | null>;
  forecast: Array<number | null>;
  lower: Array<number | null>;
  upper: Array<number | null>;
  /** the equally long period before the window, aligned point by point */
  previous: Array<number | null>;
  nowIndex: number;
  stats: {
    last: number;
    fEnd: number;
    lo: number;
    hi: number;
    /** relative change (numbers) or days (dates) of the outlook end vs today */
    change: number;
    /** half-width of the band as % of the outlook value (numbers) */
    bandPct: number;
    /** half-width of the band for display: '±4.2%' or '±3.5 d' */
    band: string;
    confidence: number;
    horizonDays: number;
    /** +1 when the outlook end is above today */
    direction: 1 | -1 | 0;
    /** true when the outlook end is moving the wrong way for this KPI */
    worsening: boolean;
    improving: boolean;
    /** change of today vs the start of the history window, same units as `change` */
    vsPrevious: number;
  };
  /** format a series value for display */
  fmt: (v: number) => string;
  step: number;
  higherIsBetter: boolean;
}

const NUM = /[-+]?\d[\d,]*\.?\d*/;
const HIST = 2 * Math.max(...TIMEFRAMES);
const HORIZON = Math.max(...TIMEFRAMES);

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

interface Base {
  kind: 'num' | 'date';
  now: number;
  /** HIST + 1 points, last = today */
  hist: number[];
  /** HORIZON + 1 points, first = today */
  mid: number[];
  lo: number[];
  hi: number[];
  fmt: (v: number) => string;
  step: number;
  higherIsBetter: boolean;
  isPct: boolean;
  rel: (x: number) => number;
  conf: (days: number) => number;
}

const cache = new Map<string, Base | null>();

/** parse the displayed value: a plain number, a number with a unit suffix ("92.4%"), or a date ("12 Mar 2027") */
function base(spec: KpiSpec, lang: 'en' | 'ar'): Base | null {
  const key = `${spec.label}|${spec.value}|${spec.tone}|${lang}`;
  if (cache.has(key)) return cache.get(key)!;
  const out = make(spec, lang);
  cache.set(key, out);
  return out;
}

function make(spec: KpiSpec, lang: 'en' | 'ar'): Base | null {
  const text = spec.value.trim();
  const rnd = rng(hash(spec.label + '|' + spec.value));

  let kind: Base['kind'] = 'num';
  let now = NaN;
  let fmt: (v: number) => string;
  let step = 1;
  let isPct = false;

  const asDate = /[A-Za-z؀-ۿ]{3}/.test(text) ? Date.parse(text.replace(/(\d)(st|nd|rd|th)/, '$1')) : NaN;
  if (!Number.isNaN(asDate) && /\d{4}|\d{1,2}\s+[A-Za-z]{3}/.test(text)) {
    kind = 'date';
    now = asDate / 86400000;
    fmt = (v) => new Date(v * 86400000).toLocaleDateString(lang === 'ar' ? 'ar-AE-u-nu-latn' : 'en-GB', { day: '2-digit', month: 'short', timeZone: 'UTC' });
  } else {
    const m = text.match(NUM);
    if (!m) return null;
    now = parseFloat(m[0].replace(/,/g, ''));
    if (!Number.isFinite(now)) return null;
    const dec = (m[0].split('.')[1] ?? '').length;
    step = Math.pow(10, -dec);
    isPct = /%/.test(text);
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

  const scale = kind === 'date' ? 4 : Math.max(Math.abs(now), 1) * (Math.abs(now) < 5 ? 0.4 : 1);
  const vol = kind === 'date' ? 0.5 : scale * 0.006;
  // slope per day: ~0.35 d/day for dates, ~0.2-0.5 % of the scale per day for numbers
  const slope = kind === 'date' ? sign * 0.35 : sign * scale * 0.0035;
  const keep = (v: number) => (isPct ? Math.min(100, Math.max(0, v)) : now >= 0 && kind === 'num' ? Math.max(0, v) : v);

  const hist: number[] = new Array(HIST + 1);
  let v = now;
  for (let i = HIST; i >= 0; i--) {
    hist[i] = i === HIST ? now : keep(v);
    // walk backwards against the trend with mean reversion so 6 months of history stay believable
    v = v - slope * 0.35 + (rnd() - 0.5) * 2 * vol + (now - v) * 0.012;
  }

  const mid: number[] = [];
  const lo: number[] = [];
  const hi: number[] = [];
  for (let d = 0; d <= HORIZON; d++) {
    // damped long-range drift: the trend fades over a quarter instead of running away
    const drift = slope * (d / (1 + d / 120)) + Math.sin(d / 3.1 + rnd() * 0.2) * vol * 0.8;
    const c = d === 0 ? now : keep(now + drift);
    const band = vol * (1.1 + d * 0.28) + (kind === 'date' ? d * 0.08 : 0);
    mid.push(c);
    lo.push(d === 0 ? now : keep(c - band));
    hi.push(d === 0 ? now : keep(c + band));
  }
  const jitter = (rnd() - 0.5) * 6;
  return {
    kind,
    now,
    hist,
    mid,
    lo,
    hi,
    fmt,
    step,
    higherIsBetter,
    isPct,
    rel: (x) => (kind === 'date' ? x - now : now === 0 ? 0 : (x - now) / Math.abs(now)),
    conf: (days) => Math.max(52, Math.min(96, Math.round(90 - 14 * Math.log10(Math.max(days, 1) / 3) + jitter))),
  };
}

/** `fmtLabel(offsetDays)` turns a day offset from the data date into an axis label */
export function buildSeries(spec: KpiSpec, lang: 'en' | 'ar', tf: Timeframe, fmtLabel: (offsetDays: number) => string): KpiSeries | null {
  const b = base(spec, lang);
  if (!b) return null;
  const n = 2 * tf + 1;
  const labels: string[] = [];
  const actual: Array<number | null> = new Array(n).fill(null);
  const forecast: Array<number | null> = new Array(n).fill(null);
  const lower: Array<number | null> = new Array(n).fill(null);
  const upper: Array<number | null> = new Array(n).fill(null);
  const previous: Array<number | null> = new Array(n).fill(null);
  for (let i = 0; i < n; i++) {
    labels.push(fmtLabel(i - tf));
    if (i <= tf) {
      actual[i] = b.hist[HIST - tf + i];
      const p = HIST - 2 * tf + i;
      previous[i] = p >= 0 ? b.hist[p] : null;
    } else {
      const d = i - tf;
      forecast[i] = b.mid[d];
      lower[i] = b.lo[d];
      upper[i] = b.hi[d];
    }
  }
  forecast[tf] = b.now;
  lower[tf] = b.now;
  upper[tf] = b.now;
  const fEnd = b.mid[tf];
  const change = b.rel(fEnd);
  const material = Math.abs(change) > (b.kind === 'date' ? 0.5 : 0.004);
  const rising = change > 0;
  const stats: KpiSeries['stats'] = {
    last: b.now,
    fEnd,
    lo: b.lo[tf],
    hi: b.hi[tf],
    change,
    bandPct: fEnd === 0 ? 0 : ((b.hi[tf] - b.lo[tf]) / 2 / Math.abs(fEnd)) * 100,
    band: b.kind === 'date' ? `±${((b.hi[tf] - b.lo[tf]) / 2).toFixed(1)} d` : `±${(fEnd === 0 ? 0 : ((b.hi[tf] - b.lo[tf]) / 2 / Math.abs(fEnd)) * 100).toFixed(1)}%`,
    confidence: b.conf(tf),
    horizonDays: tf,
    direction: change === 0 ? 0 : rising ? 1 : -1,
    worsening: material && rising !== b.higherIsBetter,
    improving: material && rising === b.higherIsBetter,
    vsPrevious: b.rel(b.hist[HIST - tf]) * -1,
  };
  return { tf, kind: b.kind, labels, actual, forecast, lower, upper, previous, nowIndex: tf, stats, fmt: b.fmt, step: b.step, higherIsBetter: b.higherIsBetter };
}
