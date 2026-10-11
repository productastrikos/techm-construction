// Asset telemetry + health. Everything is a CLOSED-FORM function of (asset, channel, time) so telemetry is deterministic,
// scrubbable and reproducible ("1 Hz internally, downsampled to the UI"). Health / RUL / failure probability are RULE-BASED
// (trend extrapolation + Weibull) and labelled as such in the UI - the seam where a real ML model would plug in.
import { clamp, hash32, noise1 } from './dates';
import type { Asset, ChannelDef, FaultSeed } from './types';

/** failure level of a degrading channel, expressed as multiples of (alarm - base) */
export const FAIL_FACTOR = 1.45;
/** health below this flags an asset on dashboards, alarms and the briefing */
export const FLAG_HEALTH = 75;

const kCache = new Map<string, number>();

/** growth rate k of the exponential fault signal so that excess(alarmT) = (alarm-base) and excess(failT) = FAIL_FACTOR*(alarm-base) */
export function faultK(f: FaultSeed): number {
  const key = `${f.onsetT}|${f.alarmT}|${f.failT}`;
  const hit = kCache.get(key);
  if (hit !== undefined) return hit;
  const a = f.alarmT - f.onsetT;
  const fl = f.failT - f.onsetT;
  const target = 1 / FAIL_FACTOR;
  let lo = 1e-4;
  let hi = 3;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    const r = (Math.exp(mid * a) - 1) / (Math.exp(mid * fl) - 1);
    // r grows toward 1 with k when a<fl... r decreases as k increases
    if (r > target) lo = mid;
    else hi = mid;
  }
  const k = (lo + hi) / 2;
  kCache.set(key, k);
  return k;
}

/** 0 at onset .. 1 at failure (and beyond) */
export function faultProgress(f: FaultSeed, t: number): number {
  if (t <= f.onsetT) return 0;
  const k = faultK(f);
  const p = (Math.exp(k * (t - f.onsetT)) - 1) / (Math.exp(k * (f.failT - f.onsetT)) - 1);
  return Math.min(p, 1.6);
}

export interface WorkCtx {
  /** 0..1 how hard the asset is working at time t (schedule-driven) */
  work: (t: number) => number;
}
export const idleCtx: WorkCtx = { work: () => 0.5 };

const keyCache = new Map<string, number>();
const keyOf = (a: string, c: string) => {
  const k = a + ':' + c;
  let v = keyCache.get(k);
  if (v === undefined) keyCache.set(k, (v = hash32(k)));
  return v;
};

/** expected (fault-free) value of a channel */
export function expectedValue(ch: ChannelDef, t: number, w: number): number {
  const hrs = (t - Math.floor(t)) * 24;
  return ch.base + ch.diurnal * Math.sin((2 * Math.PI * (hrs - 9)) / 24) + ch.load * w;
}

export function channelValue(asset: Asset, ch: ChannelDef, t: number, ctx: WorkCtx): number {
  const w = ctx.work(t);
  let v = expectedValue(ch, t, w) + ch.noise * noise1(keyOf(asset.id, ch.id), Math.floor(t * 1440));
  const f = asset.fault;
  if (f) {
    const p = faultProgress(f, t);
    if (p > 0) {
      if (ch.id === f.channelId) v += FAIL_FACTOR * (ch.alarm - ch.base) * p;
      else if (f.coupled && f.coupled[ch.id] !== undefined) v += f.coupled[ch.id] * (ch.alarm - ch.base) * p;
    }
  }
  return v;
}

export interface Sample {
  t: number;
  v: number;
}
export function series(asset: Asset, chId: string, fromT: number, toT: number, stepDays: number, ctx: WorkCtx): Sample[] {
  const ch = asset.channels.find((c) => c.id === chId);
  if (!ch) return [];
  const out: Sample[] = [];
  for (let t = fromT; t <= toT + 1e-9; t += stepDays) out.push({ t, v: channelValue(asset, ch, t, ctx) });
  return out;
}

export interface ChannelStatus {
  id: string;
  value: number;
  expected: number;
  /** excess over expected, normalised by (alarm - base) */
  severity: number;
  level: 'ok' | 'warn' | 'alarm';
  /** contribution to the explanation (sums to 1 over channels) */
  contribution: number;
}

export interface HealthReport {
  assetId: string;
  t: number;
  health: number;
  status: 'good' | 'watch' | 'warning' | 'critical';
  channels: ChannelStatus[];
  /** remaining useful life to failure, days (null = no degradation trend detected) */
  rulDays: number | null;
  failT: number | null;
  /** days until the degrading channel crosses its alarm threshold */
  alarmInDays: number | null;
  degradingChannel: string | null;
  /** P(fail within horizon) for horizons 1..30 days */
  failProb: number[];
  /** probability of failure inside the next 14 days */
  p14: number;
  pmDue: boolean;
  pmCompliance: number;
  explanation: Array<{ channelId: string; share: number; value: number; expected: number }>;
  rationale: 'rule-based';
}

/** daily mean of excess-over-expected for a channel over the last `days` days (needs >= 6 points) */
function dailyExcess(asset: Asset, ch: ChannelDef, t: number, days: number, ctx: WorkCtx): Array<{ d: number; x: number }> {
  const out: Array<{ d: number; x: number }> = [];
  for (let i = days; i >= 0; i--) {
    const d0 = t - i;
    let s = 0;
    const n = 12;
    for (let k = 0; k < n; k++) {
      const tt = d0 - (k / n) * 0.9;
      s += channelValue(asset, ch, tt, ctx) - expectedValue(ch, tt, ctx.work(tt));
    }
    out.push({ d: -i, x: s / n });
  }
  return out;
}

export function weibullCdf(tau: number, eta: number, beta = 4): number {
  if (tau <= 0) return 0;
  return 1 - Math.exp(-Math.pow(tau / eta, beta));
}

export function healthReport(asset: Asset, t: number, ctx: WorkCtx = idleCtx): HealthReport {
  const statuses: ChannelStatus[] = [];
  let wSum = 0;
  let wSev = 0;
  let maxSev = 0;
  for (const ch of asset.channels) {
    // average the last 3 h to suppress noise
    let v = 0;
    let e = 0;
    const n = 6;
    for (let k = 0; k < n; k++) {
      const tt = t - (k / n) * (3 / 24);
      v += channelValue(asset, ch, tt, ctx);
      e += expectedValue(ch, tt, ctx.work(tt));
    }
    v /= n;
    e /= n;
    const sev = clamp((v - e) / (ch.alarm - ch.base), 0, 1.8);
    const wsev = sev * Math.min(1, ch.weight / 2);
    wSum += ch.weight;
    wSev += ch.weight * sev;
    if (wsev > maxSev) maxSev = wsev;
    statuses.push({ id: ch.id, value: v, expected: e, severity: sev, level: v >= ch.alarm ? 'alarm' : v >= ch.warn ? 'warn' : 'ok', contribution: 0 });
  }
  const contribTotal = statuses.reduce((s, c, i) => s + asset.channels[i].weight * c.severity * c.severity, 0) || 1;
  statuses.forEach((c, i) => (c.contribution = (asset.channels[i].weight * c.severity * c.severity) / contribTotal));

  const sincePm = asset.hours - asset.pm.lastDoneHrs;
  const pmRatio = sincePm / asset.pm.intervalHrs;
  const pmDue = pmRatio >= 0.9;
  const wear = clamp(pmRatio - 0.6, 0, 0.5) * 8 + clamp(asset.hours / 12000, 0, 1) * 3;
  const health = clamp(100 - 62 * Math.pow(maxSev, 1.15) - 30 * (wSev / (wSum || 1)) - wear, 0, 100);

  // RUL: log-linear trend of the excess of every channel over the last 12 days
  let rul: number | null = null;
  let degr: string | null = null;
  let alarmIn: number | null = null;
  for (const ch of asset.channels) {
    const pts = dailyExcess(asset, ch, t, 12, ctx);
    const cur = pts[pts.length - 1].x;
    const frac = cur / (ch.alarm - ch.base);
    if (frac < 0.12) continue;
    const xs = pts.map((p) => p.d);
    const ys = pts.map((p) => Math.log(Math.max(1e-3, p.x)));
    const n = xs.length;
    const mx = xs.reduce((a, b) => a + b, 0) / n;
    const my = ys.reduce((a, b) => a + b, 0) / n;
    let sxx = 0;
    let sxy = 0;
    let syy = 0;
    for (let i = 0; i < n; i++) {
      sxx += (xs[i] - mx) ** 2;
      sxy += (xs[i] - mx) * (ys[i] - my);
      syy += (ys[i] - my) ** 2;
    }
    const slope = sxy / sxx;
    const r2 = syy > 0 ? (sxy * sxy) / (sxx * syy) : 0;
    if (slope < 0.015 || r2 < 0.7) continue;
    const curFit = Math.exp(my + slope * (0 - mx));
    const exFail = FAIL_FACTOR * (ch.alarm - ch.base);
    const r = Math.max(0, Math.log(exFail / curFit) / slope);
    const a = Math.max(0, Math.log((ch.alarm - ch.base) / curFit) / slope);
    if (rul === null || r < rul) {
      rul = r;
      degr = ch.id;
      alarmIn = a;
    }
  }
  const failProb: number[] = [];
  const base = 0.0004; // background daily hazard
  for (let h = 1; h <= 30; h++) {
    const p = rul === null ? 1 - Math.pow(1 - base * (1 + (100 - health) / 25), h) : Math.max(weibullCdf(h, Math.max(0.5, rul * 1.12)), 1 - Math.pow(1 - base, h));
    failProb.push(clamp(p, 0, 0.999));
  }
  const status: HealthReport['status'] = health >= 80 ? 'good' : health >= 62 ? 'watch' : health >= 40 ? 'warning' : 'critical';
  const expl = [...statuses].sort((a, b) => b.contribution - a.contribution).slice(0, 3).filter((c) => c.contribution > 0.02);
  return {
    assetId: asset.id,
    t,
    health,
    status,
    channels: statuses,
    rulDays: rul,
    failT: rul === null ? null : t + rul,
    alarmInDays: alarmIn,
    degradingChannel: degr,
    failProb,
    p14: failProb[13],
    pmDue,
    pmCompliance: clamp(1 - Math.max(0, pmRatio - 1), 0, 1),
    explanation: expl.map((c) => ({ channelId: c.id, share: c.contribution, value: c.value, expected: c.expected })),
    rationale: 'rule-based',
  };
}
