// Builds the data-date snapshot the UI renders: schedule results, PO pipeline, fleet health, EVM, alarms, KPIs, briefing.
import { criticalIds } from '../engine/cpm';
import { FLAG_HEALTH, healthReport, type WorkCtx } from '../engine/assets';
import { hash32 } from '../engine/dates';
import { cashflow, evmAt, evmByWbs, sCurve } from '../engine/evm';
import type { Plan } from '../engine/plan';
import { poTimeline, stageAt } from '../engine/routes';
import { bi } from '../lib/bi';
import { fmtDate } from '../lib/fmt';
import type { Asset, Id } from '../engine/types';
import type { Alarm, AssetRow, Briefing, PoRow, RiskLevel, Snapshot } from './types';

/** how hard an asset works at time t: driven by its linked activities in the forecast schedule */
export function assetWorkCtx(plan: Plan, asset: Asset): WorkCtx {
  const iv: Array<[number, number]> = [];
  for (const id of asset.linkedActivityIds) {
    const i = plan.forecast.idx.get(id);
    if (i === undefined) continue;
    iv.push([plan.forecast.es[i], plan.forecast.ef[i]]);
  }
  const alwaysOn = iv.length === 0;
  return {
    work: (t: number) => {
      const hr = (t - Math.floor(t)) * 24;
      const day = hr >= 6 && hr <= 17;
      if (alwaysOn) return day ? 0.6 : 0.45;
      for (const [a, b] of iv) if (t >= a && t <= b) return day ? 0.82 + 0.15 * Math.sin(t * 37) : 0.12;
      return day ? 0.18 : 0.05;
    },
  };
}

const riskOf = (floatDays: number, slip: number): RiskLevel => (floatDays < 0 ? 'late' : floatDays < 14 ? 'risk' : floatDays < 30 || slip > 3 ? 'watch' : 'ok');

export function buildSnapshot(plan: Plan): Snapshot {
  const { pack, nowT, forecast, baseline } = plan;
  const n = pack.activities.length;
  const pct = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const a = plan.actuals.get(pack.activities[i].id);
    if (a) pct[i] = a.finish !== undefined ? 1 : a.pct;
    else pct[i] = 0;
  }

  // ---- PO pipeline
  const pos: PoRow[] = pack.pos.map((po) => {
    const tl = plan.poTl.get(po.id)!;
    const di = forecast.idx.get(po.deliveryActivityId)!;
    const needBy = forecast.ls[di];
    const floatDays = needBy - tl.etaT;
    const route = pack.routes.find((r) => r.id === tl.routeId)!;
    const stage = stageAt(tl, nowT);
    return {
      id: po.id,
      materialId: po.materialId,
      supplierId: po.supplierId,
      routeId: tl.routeId,
      stage,
      orderedT: tl.orderedT,
      etdT: tl.etdT,
      etaT: tl.etaT,
      needBy,
      floatDays,
      slipDays: tl.slipDays,
      risk: stage === 6 ? 'ok' : riskOf(floatDays, tl.slipDays),
      chokepointExposed: route.chokepointDependent && stage < 6,
      valueAED: po.valueAED,
      deliveryActivityId: po.deliveryActivityId,
    };
  });

  // ---- fleet
  const assets: AssetRow[] = pack.assets.map((a) => {
    const ctx = assetWorkCtx(plan, a);
    const report = healthReport(a, nowT, ctx);
    const working = ctx.work(nowT);
    const sincePm = a.hours - a.pm.lastDoneHrs;
    return {
      id: a.id,
      report,
      working,
      utilisation: Math.max(0.2, Math.min(0.95, 0.42 + working * 0.45 + ((hash32(a.id) % 21) - 8) / 100)),
      availability: Math.max(0.55, 0.985 - (100 - report.health) * 0.0045 - (sincePm > a.pm.intervalHrs ? 0.02 : 0)),
      mtbfHrs: Math.round(380 + (report.health / 100) * 520 + (a.hours % 90)),
      mttrHrs: Math.round(5 + (100 - report.health) * 0.12 + (a.type === 'dredger' ? 14 : 0)),
    };
  });

  const evm = evmAt(plan, forecast, nowT);
  const evmWbs = evmByWbs(plan, forecast, nowT).map((r) => ({ wbsId: r.wbs.id, bac: r.bac, pv: r.pv, ev: r.ev, ac: r.ac, cpi: r.cpi, spi: r.spi }));
  const crit = criticalIds(forecast);

  // ---- alarms (rule-based + scripted site events, all SIMULATED)
  const alarms: Alarm[] = [];
  for (const r of assets) {
    if (r.report.health < FLAG_HEALTH) {
      const rul = r.report.rulDays;
      alarms.push({
        id: `al-${r.id}`,
        t: nowT - 0.05,
        severity: r.report.health < 40 ? 'crit' : 'warn',
        source: 'asset',
        ref: r.id,
        text: bi(
          `${r.id}: health ${Math.round(r.report.health)}${rul !== null ? `, predicted failure in ${rul.toFixed(0)} days` : ''}`,
          `${r.id}: الحالة الصحية ${Math.round(r.report.health)}${rul !== null ? `، الفشل المتوقع خلال ${rul.toFixed(0)} أيام` : ''}`,
        ),
      });
    }
  }
  for (const p of pos) {
    if (p.stage === 6) continue;
    if (p.risk === 'late' || (p.risk === 'risk' && p.chokepointExposed)) {
      alarms.push({
        id: `al-${p.id}`,
        t: nowT - 0.3,
        severity: p.risk === 'late' ? 'crit' : 'warn',
        source: 'po',
        ref: p.id,
        text: bi(`${p.id}: only ${Math.max(0, Math.round(p.floatDays))} days of float${p.chokepointExposed ? ' (chokepoint-exposed route)' : ''}`, `${p.id}: هامش ${Math.max(0, Math.round(p.floatDays))} يومًا فقط${p.chokepointExposed ? ' (مسار معرّض لنقطة الاختناق)' : ''}`),
      });
    }
  }
  const delay = forecast.finish - baseline.finish;
  if (delay > 1)
    alarms.push({
      id: 'al-sched',
      t: nowT - 0.6,
      severity: delay > 14 ? 'crit' : 'warn',
      source: 'schedule',
      ref: 'finish',
      text: bi(`Forecast completion is ${delay.toFixed(0)} days behind the contract baseline`, `الإنجاز المتوقع متأخر ${delay.toFixed(0)} يومًا عن الخط الأساسي للعقد`),
    });
  alarms.push({
    id: 'al-wx',
    t: nowT - 0.12,
    severity: 'info',
    source: 'weather',
    ref: 'wind',
    text: pack.config.sceneKind === 'highway'
      ? bi('Wind gusts forecast 11 m/s this afternoon - girder launching near limit ', 'توقع رياح بسرعة 11 م/ث بعد الظهر - رفع الكمرات قرب الحد')
      : bi('Wind gusts forecast 11 m/s this afternoon - crane lifts near limit ', 'توقع رياح بسرعة 11 م/ث بعد الظهر - عمليات الرفع قرب الحد'),
  });
  alarms.push({
    id: 'al-hse',
    t: nowT - 0.2,
    severity: 'warn',
    source: 'hse',
    ref: 'CCTV-02',
    text: pack.config.sceneKind === 'highway'
      ? bi('CCTV work zone: vehicle detected inside the lane-closure taper', 'كاميرا منطقة العمل: رصد مركبة داخل منطقة تضييق المسار')
      : bi('CCTV quay edge: person detected inside the crane exclusion zone', 'كاميرا حافة الرصيف: رصد شخص داخل منطقة حظر الرافعة'),
  });
  alarms.sort((a, b) => (a.severity === b.severity ? b.t - a.t : a.severity === 'crit' ? -1 : b.severity === 'crit' ? 1 : a.severity === 'warn' ? -1 : 1));

  const poOpen = pos.filter((p) => p.stage < 6);
  const atRisk = poOpen.filter((p) => p.risk === 'risk' || p.risk === 'late');
  const fleetAvail = assets.reduce((s, a) => s + a.availability, 0) / assets.length;
  const cfg = pack.config;
  const kp = cfg.kpiSeed;

  const snap: Snapshot = {
    nowT,
    baselineFinish: baseline.finish,
    forecastFinish: forecast.finish,
    contractFinish: plan.contractFinish,
    dFinishVsBaseline: forecast.finish - baseline.finish,
    baseline,
    forecast,
    pct,
    criticalPath: crit,
    pos,
    assets,
    evm,
    evmWbs,
    sCurve: sCurve(plan, forecast, 30),
    cashflow: cashflow(plan, forecast, 30),
    alarms,
    briefing: { headline: bi('', ''), bullets: [] },
    kpis: {
      spi: evm.spi,
      cpi: evm.cpi,
      ltifr: kp.ltifr,
      daysSinceLti: kp.daysSinceLti + Math.max(0, Math.floor(nowT - pack.config.nowT)),
      manpower: kp.manpower,
      openRisks: kp.openRisks + atRisk.length,
      fleetAvailability: fleetAvail,
      materialAtRiskAED: atRisk.reduce((s, p) => s + p.valueAED, 0),
      poAtRisk: atRisk.length,
      poTotal: poOpen.length,
    },
  };
  snap.briefing = buildBriefing(plan, snap);
  return snap;
}

/** templated NLG over the live snapshot - labelled RULE-BASED in the UI */
export function buildBriefing(plan: Plan, s: Snapshot): Briefing {
  const { pack } = plan;
  const bullets: Briefing['bullets'] = [];
  const d = s.dFinishVsBaseline;
  const en = (t: number) => fmtDate(t, 'en');
  const ar = (t: number) => fmtDate(t, 'ar');
  bullets.push({
    tone: d > 14 ? 'bad' : d > 1 ? 'warn' : 'good',
    text: bi(
      `Forecast completion ${en(s.forecastFinish)} - ${d >= 0 ? `${d.toFixed(0)} days behind` : `${(-d).toFixed(0)} days ahead of`} the contract baseline (${en(s.baselineFinish)}).`,
      `الإنجاز المتوقع ${ar(s.forecastFinish)} - ${d >= 0 ? `متأخر ${d.toFixed(0)} يومًا عن` : `متقدم ${(-d).toFixed(0)} يومًا على`} الخط الأساسي للعقد (${ar(s.baselineFinish)}).`,
    ),
  });
  const firstCrit = s.criticalPath.map((id) => pack.activities[s.forecast.idx.get(id)!]).find((a) => a.kind === 'task' && s.forecast.ef[s.forecast.idx.get(a.id)!] > s.nowT);
  if (firstCrit)
    bullets.push({
      tone: 'info',
      text: bi(`Critical path currently runs through "${firstCrit.name.en}" (${s.criticalPath.length} activities with zero float).`, `المسار الحرج يمر حاليًا عبر "${firstCrit.name.ar}" (${s.criticalPath.length} نشاطًا بلا هامش).`),
      ref: { type: 'activity', id: firstCrit.id },
    });
  const k = s.kpis;
  const exposed = s.pos.filter((p) => p.chokepointExposed).length;
  bullets.push({
    tone: k.poAtRisk > 3 ? 'warn' : 'good',
    text: bi(
      `${k.poAtRisk} of ${k.poTotal} open purchase orders have under 14 days of float; ${exposed} ship via chokepoint-exposed routes.`,
      `${k.poAtRisk} من أصل ${k.poTotal} أوامر شراء مفتوحة لديها أقل من 14 يومًا من الهامش؛ ${exposed} منها تُشحن عبر مسارات معرّضة لنقطة الاختناق.`,
    ),
  });
  const worst = [...s.assets].sort((a, b) => a.report.health - b.report.health)[0];
  if (worst && worst.report.health < FLAG_HEALTH) {
    const r = worst.report;
    bullets.push({
      tone: r.health < 40 ? 'bad' : 'warn',
      text: bi(
        `${worst.id} flagged: health ${Math.round(r.health)}${r.rulDays !== null ? `, ${(r.p14 * 100).toFixed(0)}% chance of failure within 14 days` : ''}. Planned service avoids most of the schedule loss.`,
        `${worst.id}: الحالة الصحية ${Math.round(r.health)}${r.rulDays !== null ? `، احتمال العطل خلال 14 يومًا ${(r.p14 * 100).toFixed(0)}%` : ''}. الصيانة المخططة تتجنب معظم خسارة الجدول.`,
      ),
      ref: { type: 'asset', id: worst.id },
    });
  }
  bullets.push({
    tone: k.cpi < 0.95 ? 'warn' : 'good',
    text: bi(
      `Cost performance CPI ${k.cpi.toFixed(2)}, SPI ${k.spi.toFixed(2)}; forecast at completion AED ${(s.evm.eac / 1e9).toFixed(2)} bn vs budget ${(s.evm.bac / 1e9).toFixed(2)} bn.`,
      `مؤشر أداء التكلفة ${k.cpi.toFixed(2)}، ومؤشر الجدول ${k.spi.toFixed(2)}؛ التكلفة المتوقعة عند الإنجاز ${(s.evm.eac / 1e9).toFixed(2)} مليار درهم مقابل ميزانية ${(s.evm.bac / 1e9).toFixed(2)} مليار.`,
    ),
  });
  bullets.push({
    tone: 'good',
    text: bi(`Safety: ${k.daysSinceLti} days since the last lost-time injury, LTIFR ${k.ltifr.toFixed(2)}.`, `السلامة: ${k.daysSinceLti} يومًا منذ آخر إصابة مُعطِّلة للعمل، ومعدل الإصابات ${k.ltifr.toFixed(2)}.`),
  });
  const headline =
    d > 14
      ? bi('Schedule slipping - action needed on the critical path', 'تأخر في الجدول - مطلوب إجراء على المسار الحرج')
      : worst && worst.report.health < 40
        ? bi('On track, but one crane needs service within days', 'المشروع على المسار، لكن إحدى الرافعات تحتاج صيانة خلال أيام')
        : bi('On track with manageable risks', 'المشروع على المسار مع مخاطر يمكن التحكم بها');
  return { headline, bullets };
}

export { poTimeline };
