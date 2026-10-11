// Earned-value management: PV from the baseline S-curve, EV from schedule progress x budget, AC from synthetic cost
// postings (per-WBS CPI, illustrative), CPI/SPI/EAC/TCPI, S-curve series and a simple cash-flow with retention/advance.
import type { CalMap } from './calendar';
import type { CpmResult } from './cpm';
import { clamp, hash32, mulberry32 } from './dates';
import { progressAt, type Plan } from './plan';
import type { ProjectPack } from './types';

export interface EvmSnapshot {
  t: number;
  bac: number;
  pv: number;
  ev: number;
  ac: number;
  cpi: number;
  spi: number;
  sv: number;
  cv: number;
  eac: number;
  etc: number;
  vac: number;
  tcpi: number;
  percentPlanned: number;
  percentComplete: number;
}

/** per-activity CPI: WBS CPI with deterministic noise */
function cpiOf(pack: ProjectPack, i: number): number {
  const a = pack.activities[i];
  const base = pack.config.cpiByWbs[a.wbsId] ?? 1;
  const n = (mulberry32(hash32('cpi:' + a.id))() - 0.5) * 0.06;
  return clamp(base + n, 0.8, 1.1);
}

function sumProgress(pack: ProjectPack, res: CpmResult, cals: CalMap, t: number, weight: (i: number) => number): number {
  let s = 0;
  for (let i = 0; i < pack.activities.length; i++) {
    const b = pack.activities[i].budget;
    if (b <= 0) continue;
    s += b * progressAt(res, cals, pack, i, t) * weight(i);
  }
  return s;
}

export function evmAt(plan: Plan, forecast: CpmResult, t: number): EvmSnapshot {
  const { pack, baseCals, baseline } = plan;
  const bac = pack.activities.reduce((s, a) => s + a.budget, 0);
  const pv = sumProgress(pack, baseline, baseCals, t, () => 1);
  const ev = sumProgress(pack, forecast, baseCals, t, () => 1);
  const ac = sumProgress(pack, forecast, baseCals, t, (i) => 1 / cpiOf(pack, i));
  const cpi = ac > 0 ? ev / ac : 1;
  const spi = pv > 0 ? ev / pv : 1;
  // EAC assuming the current cost performance persists
  const eac = cpi > 0 ? bac / cpi : bac;
  const tcpi = bac - ac > 0 ? (bac - ev) / (bac - ac) : 1;
  return { t, bac, pv, ev, ac, cpi, spi, sv: ev - pv, cv: ev - ac, eac, etc: eac - ac, vac: bac - eac, tcpi, percentPlanned: pv / bac, percentComplete: ev / bac };
}

export interface SCurve {
  t: number[];
  planned: number[];
  earned: Array<number | null>;
  actual: Array<number | null>;
  forecast: number[];
}

/** monthly S-curve: planned (baseline), earned/actual to the data date, forecast to the forecast finish */
export function sCurve(plan: Plan, forecast: CpmResult, stepDays = 30): SCurve {
  const end = Math.max(plan.baseline.finish, forecast.finish) + 20;
  const out: SCurve = { t: [], planned: [], earned: [], actual: [], forecast: [] };
  const { pack, baseCals, baseline } = plan;
  for (let t = 0; t <= end; t += stepDays) {
    out.t.push(t);
    out.planned.push(sumProgress(pack, baseline, baseCals, t, () => 1));
    const ev = sumProgress(pack, forecast, baseCals, t, () => 1);
    out.forecast.push(ev);
    out.earned.push(t <= plan.nowT ? ev : null);
    out.actual.push(t <= plan.nowT ? sumProgress(pack, forecast, baseCals, t, (i) => 1 / cpiOf(pack, i)) : null);
  }
  return out;
}

export interface CashMonth {
  t: number;
  certified: number;
  retention: number;
  advanceRecovery: number;
  netPayment: number;
  cumNet: number;
  outflow: number;
}

/** monthly IPCs: certified = delta EV; 10% retention withheld; advance (10% of BAC) recovered pro-rata; paid 45 days later */
export function cashflow(plan: Plan, forecast: CpmResult, stepDays = 30): CashMonth[] {
  const { pack, baseCals } = plan;
  const cfg = pack.config;
  const adv = cfg.advancePct * cfg.bacAED;
  const out: CashMonth[] = [];
  let prevEv = 0;
  let prevAc = 0;
  let cum = adv;
  let recovered = 0;
  const end = forecast.finish + 60;
  for (let t = stepDays; t <= end; t += stepDays) {
    const ev = sumProgress(pack, forecast, baseCals, t, () => 1);
    const ac = sumProgress(pack, forecast, baseCals, t, (i) => 1 / cpiOf(pack, i));
    const cert = ev - prevEv;
    const ret = cert * cfg.retentionPct;
    const advRec = Math.min(adv - recovered, cert * cfg.advancePct * 2);
    recovered += advRec;
    const net = cert - ret - advRec;
    cum += net - (ac - prevAc);
    out.push({ t: t + 45, certified: cert, retention: ret, advanceRecovery: advRec, netPayment: net, cumNet: cum, outflow: ac - prevAc });
    prevEv = ev;
    prevAc = ac;
  }
  return out;
}

export function evmByWbs(plan: Plan, forecast: CpmResult, t: number) {
  const { pack, baseCals, baseline } = plan;
  return pack.wbs.map((w) => {
    let bac = 0;
    let pv = 0;
    let ev = 0;
    let ac = 0;
    pack.activities.forEach((a, i) => {
      if (a.wbsId !== w.id || a.budget <= 0) return;
      bac += a.budget;
      pv += a.budget * progressAt(baseline, baseCals, pack, i, t);
      const e = a.budget * progressAt(forecast, baseCals, pack, i, t);
      ev += e;
      ac += e / cpiOf(pack, i);
    });
    return { wbs: w, bac, pv, ev, ac, cpi: ac > 0 ? ev / ac : 1, spi: pv > 0 ? ev / pv : 1 };
  });
}
