// What-If engine. A scenario = the live plan + a list of deltas (immutable clone semantics: the baseline and the live
// forecast are never mutated). evaluate() re-runs CPM and returns finish/cost/critical-path/affected-3D-elements.
// recovery*() enumerate mitigations, re-run CPM for each and rank by days recovered per AED.
import { buildCalendars, withLayers, dayBreakdown, type CalMap } from './calendar';
import { runCpm, criticalIds, type CpmResult } from './cpm';
import type { Plan } from './plan';
import { materialById, poTimeline, stageAt, type ChokepointScenario, type PoOverride, type PoTimeline } from './routes';
import type { Asset, CalendarLayers, CalendarRules, ChokepointState, Id, Pred, ShiftPlan } from './types';
import { bi, type Bi } from '../lib/bi';

export type Delta =
  | { kind: 'chokepoint'; state: ChokepointState; startT: number; durationDays: number }
  | { kind: 'shiftEta'; poId: Id; days: number }
  | { kind: 'reroute'; poId: Id; routeId: Id }
  | { kind: 'expedite'; poId: Id }
  | { kind: 'substitute'; poId: Id }
  | { kind: 'stockTransfer'; poId: Id }
  | { kind: 'resequence'; actId: Id; predId: Id }
  | { kind: 'layers'; layers: Partial<CalendarLayers> }
  | { kind: 'shift'; shift: ShiftPlan }
  | { kind: 'stagger'; factor: number }
  | { kind: 'failAsset'; assetId: Id; startT: number; downDays?: number; replacementPrepositioned?: boolean }
  | { kind: 'serviceAsset'; assetId: Id; startT: number }
  | { kind: 'priceShock'; pct: number };

export interface CostBreakdown {
  ld: number;
  prolongation: number;
  expedite: number;
  escalation: number;
  rental: number;
  shifts: number;
  repair: number;
  total: number;
}
export const zeroCost = (): CostBreakdown => ({ ld: 0, prolongation: 0, expedite: 0, escalation: 0, rental: 0, shifts: 0, repair: 0, total: 0 });

export interface PoImpact {
  poId: Id;
  routeId: Id;
  etaForecast: number;
  etaScenario: number;
  slipDays: number;
  /** late date of the delivery milestone in the forecast (need-by) */
  needBy: number;
  /** float remaining after the scenario ETA (negative = days the PO now drives the schedule) */
  floatAfter: number;
  floatBefore: number;
  lateDays: number;
  chokepointSlip: number;
  stageNow: number;
  delivered: boolean;
}

export interface AssetEventOut {
  assetId: Id;
  kind: 'fail' | 'service';
  startT: number;
  endT: number;
  downDays: number;
  hitActivities: Id[];
}

export interface ScenarioResult {
  deltas: Delta[];
  cpm: CpmResult;
  finish: number;
  dFinish: number;
  dFinishVsBaseline: number;
  criticalPath: Id[];
  newlyCritical: Id[];
  leftCritical: Id[];
  changed: Array<{ id: Id; dEs: number; dEf: number }>;
  affectedElements: Id[];
  poImpacts: PoImpact[];
  cost: CostBreakdown;
  assetEvents: AssetEventOut[];
  poTl: Map<Id, PoTimeline>;
  /** hours of productive work per week-day-profile summary, for the calendar view */
  floatConsumedDays: number;
}

export interface RecoveryOption {
  id: string;
  title: Bi;
  detail: Bi;
  deltas: Delta[];
  finish: number;
  dFinish: number;
  recoveredDays: number;
  /** mitigation spend (extra freight, shifts, rental...) */
  spendAED: number;
  /** net change in total scenario cost vs doing nothing (negative = saves money) */
  netAED: number;
  /** days recovered per AED million of mitigation spend (higher is better) */
  efficiency: number;
  tradeoffs: Bi[];
  result: ScenarioResult;
}

const EPS = 0.5;

export function evaluate(plan: Plan, deltas: Delta[]): ScenarioResult {
  const { pack, nowT } = plan;
  let hz: ChokepointScenario | null = null;
  const poOv = new Map<Id, PoOverride>();
  let rules: CalendarRules = pack.rules;
  let rulesChanged = false;
  const predOv = new Map<Id, Pred[]>();
  const events: Array<{ delta: Extract<Delta, { kind: 'failAsset' | 'serviceAsset' }>; asset: Asset; startT: number; endT: number; downDays: number }> = [];
  let priceShock = 0;
  const getOv = (id: Id): PoOverride => {
    let o = poOv.get(id);
    if (!o) poOv.set(id, (o = {}));
    return o;
  };

  for (const d of deltas) {
    switch (d.kind) {
      case 'chokepoint':
        hz = d.state === 'open' ? null : { state: d.state, startT: d.startT, durationDays: d.durationDays };
        break;
      case 'shiftEta': {
        const o = getOv(d.poId);
        o.slipDays = (o.slipDays ?? 0) + d.days;
        break;
      }
      case 'reroute':
        getOv(d.poId).routeId = d.routeId;
        break;
      case 'expedite': {
        const po = pack.pos.find((p) => p.id === d.poId);
        if (po?.airEligible) getOv(d.poId).routeId = 'R-AIR';
        break;
      }
      case 'substitute': {
        const po = pack.pos.find((p) => p.id === d.poId);
        const mat = po && materialById(pack, po.materialId);
        if (po && mat?.domestic) {
          const o = getOv(d.poId);
          o.forceEtaT = nowT + 7 + mat.domestic.leadDays;
          o.extraCostAED = po.valueAED * (mat.domestic.costFactor - 1);
        }
        break;
      }
      case 'stockTransfer': {
        const po = pack.pos.find((p) => p.id === d.poId);
        if (po?.stockTransferDays !== undefined) {
          const o = getOv(d.poId);
          o.forceEtaT = nowT + po.stockTransferDays;
          o.extraCostAED = po.valueAED * 0.08;
        }
        break;
      }
      case 'resequence': {
        const a = pack.activities.find((x) => x.id === d.actId);
        if (!a) break;
        const cur = predOv.get(a.id) ?? a.preds;
        predOv.set(
          a.id,
          cur.map((p) => (p.id === d.predId && p.resequence ? { id: p.id, type: p.resequence.type, lagHrs: p.resequence.lagHrs } : p)),
        );
        break;
      }
      case 'layers':
        rules = withLayers(rules, d.layers);
        rulesChanged = true;
        break;
      case 'shift':
        rules = { ...rules, shifts: [...rules.shifts, d.shift] };
        rulesChanged = true;
        break;
      case 'stagger':
        rules = { ...rules, eidLeave: rules.eidLeave.map((e) => ({ ...e, loss: e.loss * (1 - d.factor) })) };
        rulesChanged = true;
        break;
      case 'priceShock':
        priceShock += d.pct;
        break;
      case 'failAsset':
      case 'serviceAsset': {
        const asset = pack.assets.find((a) => a.id === d.assetId);
        if (!asset) break;
        let downDays: number;
        if (d.kind === 'failAsset') downDays = d.downDays ?? 1 + Math.min(asset.repairDays, asset.mobDays + 3);
        else downDays = asset.serviceDays;
        events.push({ delta: d, asset, startT: d.startT, endT: d.startT + downDays, downDays });
        break;
      }
    }
  }

  const cals: CalMap = rulesChanged ? buildCalendars(pack.calendars, rules) : plan.baseCals;

  // ------------------------------------------------ PO timelines -> delivery milestone constraints
  const poTl = new Map<Id, PoTimeline>();
  const snet = new Map<Id, number>();
  for (const po of pack.pos) {
    const tl = poTimeline(pack, po, nowT, hz, poOv.get(po.id) ?? {});
    poTl.set(po.id, tl);
    snet.set(po.deliveryActivityId, tl.etaT);
  }

  // ------------------------------------------------ asset events: iterate (downtime interrupts linked activities)
  const extraHrs = new Map<Id, number>();
  const assetSnet = new Map<Id, number>();
  const hits = new Map<number, Id[]>();
  const lostByKey = new Map<string, number>();
  let cpm: CpmResult = runWith();
  function runWith(): CpmResult {
    const sn = new Map(snet);
    for (const [k, v] of assetSnet) sn.set(k, Math.max(v, sn.get(k) ?? -Infinity));
    return runCpm({
      activities: pack.activities,
      cals,
      dataDate: nowT,
      actuals: plan.actuals,
      snet: sn,
      predOverride: predOv.size ? predOv : undefined,
      extraHrs: extraHrs.size ? extraHrs : undefined,
    });
  }
  if (events.length) {
    for (let pass = 0; pass < 5; pass++) {
      let changed = false;
      events.forEach((ev, ei) => {
        const list: Id[] = [];
        for (const aid of ev.asset.linkedActivityIds) {
          const i = cpm.idx.get(aid)!;
          if (cpm.done[i]) continue;
          const es = cpm.es[i];
          const ef = cpm.ef[i];
          if (ef <= ev.startT || es >= ev.endT) continue;
          list.push(aid);
          const cal = cals[pack.activities[i].calendarId];
          if (es >= ev.startT) {
            if ((assetSnet.get(aid) ?? -Infinity) < ev.endT) {
              assetSnet.set(aid, ev.endT);
              changed = true;
            }
          } else {
            const lost = cal.workBetween(ev.startT, Math.min(ev.endT, ef));
            const key = `${aid}#${ei}`;
            const prev = lostByKey.get(key) ?? 0;
            if (Math.abs(prev - lost) > 0.01) {
              lostByKey.set(key, lost);
              extraHrs.set(aid, (extraHrs.get(aid) ?? 0) + (lost - prev));
              changed = true;
            }
          }
        }
        hits.set(ei, list);
      });
      if (!changed) break;
      cpm = runWith();
    }
  }

  // ------------------------------------------------ diff vs the live forecast
  const fc = plan.forecast;
  const finish = cpm.finish;
  const dFinish = finish - fc.finish;
  const changedList: ScenarioResult['changed'] = [];
  const elems = new Set<Id>();
  for (let i = 0; i < cpm.ids.length; i++) {
    if (cpm.done[i]) continue;
    const dEs = cpm.es[i] - fc.es[i];
    const dEf = cpm.ef[i] - fc.ef[i];
    if (Math.abs(dEf) >= EPS || Math.abs(dEs) >= EPS) {
      changedList.push({ id: cpm.ids[i], dEs, dEf });
      for (const e of pack.activities[i].elementIds) elems.add(e);
    }
  }
  const critS = criticalIds(cpm);
  const critF = new Set(criticalIds(fc));
  const critSet = new Set(critS);
  const newlyCritical = critS.filter((id) => !critF.has(id));
  const leftCritical = [...critF].filter((id) => !critSet.has(id));

  // ------------------------------------------------ PO impacts
  const poImpacts: PoImpact[] = [];
  for (const po of pack.pos) {
    const tl = poTl.get(po.id)!;
    const f = plan.poTl.get(po.id)!;
    const di = fc.idx.get(po.deliveryActivityId)!;
    const needBy = fc.ls[di];
    const delivered = stageAt(f, nowT) === 6;
    const slip = tl.etaT - f.etaT;
    const floatAfter = needBy - tl.etaT;
    poImpacts.push({
      poId: po.id,
      routeId: tl.routeId,
      etaForecast: f.etaT,
      etaScenario: tl.etaT,
      slipDays: slip,
      needBy,
      floatAfter,
      floatBefore: needBy - f.etaT,
      lateDays: Math.max(0, -floatAfter),
      chokepointSlip: tl.chokepointSlipDays,
      stageNow: stageAt(tl, nowT),
      delivered,
    });
  }

  // ------------------------------------------------ cost
  const cost = zeroCost();
  const cfg = pack.config;
  const ldCap = cfg.ldCapPct * cfg.bacAED;
  const ldF = Math.min(ldCap, Math.max(0, fc.finish - plan.contractFinish) * cfg.ldPerDay);
  const ldS = Math.min(ldCap, Math.max(0, finish - plan.contractFinish) * cfg.ldPerDay);
  cost.ld = ldS - ldF;
  cost.prolongation = dFinish * cfg.prolongationPerDay;
  for (const po of pack.pos) {
    const tl = poTl.get(po.id)!;
    const f = plan.poTl.get(po.id)!;
    if (stageAt(f, nowT) === 6) continue;
    const ov = poOv.get(po.id);
    const mat = materialById(pack, po.materialId);
    // freight delta when the route changes
    if (tl.routeId !== f.routeId) {
      cost.expedite += tl.freightAED - f.freightAED;
      // cargo already booked / shipped: carrier diversion fee, demurrage and re-documentation
      if (f.etdT < nowT) cost.expedite += 150_000 + 0.01 * po.valueAED;
      else cost.expedite += 40_000;
    }
    if (ov?.extraCostAED) cost.expedite += ov.extraCostAED;
    // Chokepoint surcharge on exposed cargo that actually transits during the disruption window
    if (hz && tl.chokepointSlipDays > 0) cost.escalation += po.valueAED * mat.exposure * pack.routeTable.chokepoint[hz.state].costPct;
    // price shock on imports not yet delivered
    if (priceShock && mat.cls !== 'domestic-bulk') cost.escalation += po.valueAED * mat.exposure * priceShock;
  }
  // shifts
  for (const s of rules.shifts) {
    if (pack.rules.shifts.includes(s)) continue;
    const profs = s.calendars.map((c) => pack.calendars.find((p) => p.id === c)!).filter(Boolean);
    let days = 0;
    for (let d = Math.max(0, Math.floor(s.fromT)); d <= Math.floor(s.toT); d++) {
      if (profs.some((p) => dayBreakdown(p, rules, d).hours > 0)) days++;
    }
    cost.shifts += days * s.extraHrs * s.costPerHr;
  }
  // asset events
  const assetEvents: AssetEventOut[] = [];
  events.forEach((ev, ei) => {
    assetEvents.push({ assetId: ev.asset.id, kind: ev.delta.kind === 'failAsset' ? 'fail' : 'service', startT: ev.startT, endT: ev.endT, downDays: ev.downDays, hitActivities: hits.get(ei) ?? [] });
    if (ev.delta.kind === 'failAsset') {
      const replace = ev.asset.mobDays + 3 < ev.asset.repairDays || ev.delta.replacementPrepositioned;
      cost.repair += ev.asset.rentalPerDay * 12;
      if (replace) cost.rental += ev.asset.rentalPerDay * Math.max(ev.asset.repairDays, 5) + (ev.delta.replacementPrepositioned ? ev.asset.rentalPerDay * 3 : 0);
    } else {
      cost.repair += ev.asset.rentalPerDay * 1.5;
    }
  });
  cost.total = cost.ld + cost.prolongation + cost.expedite + cost.escalation + cost.rental + cost.shifts + cost.repair;

  return {
    deltas,
    cpm,
    finish,
    dFinish,
    dFinishVsBaseline: finish - plan.baseline.finish,
    criticalPath: critS,
    newlyCritical,
    leftCritical,
    changed: changedList,
    affectedElements: [...elems],
    poImpacts,
    cost,
    assetEvents,
    poTl,
    floatConsumedDays: Math.max(0, dFinish),
  };
}

// ======================================================================================= recovery

const optionFrom = (id: string, title: Bi, detail: Bi, base: ScenarioResult, deltas: Delta[], plan: Plan, tradeoffs: Bi[]): RecoveryOption => {
  const result = evaluate(plan, deltas);
  const recovered = base.dFinish - result.dFinish;
  const cost = result.cost.total - base.cost.total;
  // efficiency counts only the mitigation spend (cost), never LD/prolongation savings which are the benefit
  const pos = (x: number) => Math.max(0, x);
  const mitigationSpend = pos(result.cost.expedite - base.cost.expedite) + pos(result.cost.rental - base.cost.rental) + pos(result.cost.shifts - base.cost.shifts) + pos(result.cost.repair - base.cost.repair);
  return {
    id,
    title,
    detail,
    deltas,
    finish: result.finish,
    dFinish: result.dFinish,
    recoveredDays: recovered,
    spendAED: mitigationSpend,
    netAED: cost,
    efficiency: recovered > 0 ? recovered / Math.max(0.05, mitigationSpend / 1e6) : 0,
    tradeoffs,
    result,
  };
};

/** supply-chain recovery options for a scenario made of supply deltas */
export function supplyRecovery(plan: Plan, base: Delta[]): { baseResult: ScenarioResult; options: RecoveryOption[] } {
  const { pack, nowT } = plan;
  const baseResult = evaluate(plan, base);
  const options: RecoveryOption[] = [];
  const hzDelta = base.find((d) => d.kind === 'chokepoint') as Extract<Delta, { kind: 'chokepoint' }> | undefined;
  const hz: ChokepointScenario | null = hzDelta && hzDelta.state !== 'open' ? { state: hzDelta.state, startT: hzDelta.startT, durationDays: hzDelta.durationDays } : null;
  const impacted = baseResult.poImpacts.filter((p) => !p.delivered && p.slipDays > EPS);
  if (!impacted.length || baseResult.dFinish <= EPS) return { baseResult, options };
  const driving = impacted.filter((p) => p.lateDays > 0);

  // 1. re-route everything that is exposed through Port C / Port B + bonded trucking
  const reroute: Delta[] = [];
  for (const p of impacted) {
    const po = pack.pos.find((x) => x.id === p.poId)!;
    const mat = materialById(pack, po.materialId);
    if (mat.origin === 'AE') continue;
    const r0 = pack.routes.find((r) => r.id === po.routeId)!;
    if (!r0.chokepointDependent) continue;
    // pick the non-Chokepoint sea route with the earliest ETA
    let best: { id: string; eta: number } | null = null;
    for (const r of pack.routes.filter((r) => r.mode === 'sea' && !r.chokepointDependent)) {
      const tl = poTimeline(pack, po, nowT, hz, { routeId: r.id });
      if (!best || tl.etaT < best.eta) best = { id: r.id, eta: tl.etaT };
    }
    if (best) reroute.push({ kind: 'reroute', poId: po.id, routeId: best.id });
  }
  if (reroute.length)
    options.push(
      optionFrom(
        'reroute',
        bi('Re-route via Port B / Port C + bonded trucking', 'إعادة التوجيه عبر ميناء ج / ميناء ب + الشاحنات المؤمَّنة'),
        bi(`${reroute.length} Chokepoint-exposed shipments diverted to the alternate-coast ports (outside the chokepoint), ~2 h by road to site.`, `تحويل ${reroute.length} شحنات معرّضة لنقطة الاختناق إلى الموانئ البديلة (خارج نقطة الاختناق) ثم نقلها برًا خلال ساعتين تقريبًا.`),
        baseResult,
        [...base, ...reroute],
        plan,
        [bi('Higher inland freight and port handling', 'ارتفاع تكلفة النقل البري والمناولة'), bi('Needs carrier consent for diversion of cargo already at sea', 'يتطلب موافقة الناقل لتحويل الشحنات في البحر')],
      ),
    );

  // 2. air-freight only the items that actually drive the finish date
  const air: Delta[] = [];
  for (const p of driving) {
    const po = pack.pos.find((x) => x.id === p.poId)!;
    if (po.airEligible) air.push({ kind: 'expedite', poId: po.id });
  }
  if (air.length)
    options.push(
      optionFrom(
        'air',
        bi('Air-freight the critical, airfreightable items', 'الشحن الجوي للبنود الحرجة القابلة للشحن جوًا'),
        bi(`${air.length} critical item(s) flown to the nearest airport; heavy / bulky items stay on the sea route.`, `شحن ${air.length} بنود حرجة جوًا إلى أقرب مطار؛ تبقى البنود الثقيلة على المسار البحري.`),
        baseResult,
        [...base, ...air],
        plan,
        [bi('Very high cost per tonne', 'تكلفة مرتفعة جدًا للطن'), bi('Only partial coverage - heavy items cannot fly', 'تغطية جزئية - لا يمكن شحن البنود الثقيلة جوًا')],
      ),
    );

  // 3. domestic re-source / stock transfer where possible
  const alt: Delta[] = [];
  for (const p of driving) {
    const po = pack.pos.find((x) => x.id === p.poId)!;
    const mat = materialById(pack, po.materialId);
    if (po.stockTransferDays !== undefined) alt.push({ kind: 'stockTransfer', poId: po.id });
    else if (mat.domestic) alt.push({ kind: 'substitute', poId: po.id });
  }
  if (alt.length)
    options.push(
      optionFrom(
        'domestic',
        bi('Re-source domestically / transfer from stock', 'التوريد من مصدر محلي / النقل من المخزون'),
        bi(`${alt.length} item(s) re-sourced from regional fabricators or stock transferred from another project.`, `إعادة توريد ${alt.length} بنود من مصنّعين إقليميين أو نقلها من مخزون مشروع آخر.`),
        baseResult,
        [...base, ...alt],
        plan,
        [bi('Reduced specification / quality sign-off needed', 'يلزم اعتماد جودة ومواصفات مخفضة'), bi('Limited to items with a qualified local alternative', 'مقتصر على البنود ذات البديل المحلي المؤهل')],
      ),
    );

  // 4. resequence: switch critical links to overlapped logic
  const reseq: Delta[] = [];
  for (const id of baseResult.criticalPath) {
    const a = pack.activities[baseResult.cpm.idx.get(id)!];
    for (const p of a.preds) if (p.resequence) reseq.push({ kind: 'resequence', actId: a.id, predId: p.id });
  }
  if (reseq.length)
    options.push(
      optionFrom(
        'resequence',
        bi('Resequence: overlap critical activities', 'إعادة التسلسل: تداخل الأنشطة الحرجة'),
        bi(`${reseq.length} critical link(s) changed from finish-to-start to overlapped start-to-start logic.`, `تغيير ${reseq.length} روابط حرجة من النهاية-للبداية إلى منطق متداخل بداية-لبداية.`),
        baseResult,
        [...base, ...reseq],
        plan,
        [bi('Increases site congestion and rework risk', 'يزيد ازدحام الموقع واحتمال إعادة العمل'), bi('No procurement cost - needs engineer sign-off', 'بدون تكلفة توريد - يتطلب اعتماد المهندس')],
      ),
    );

  // 5. best combination: reroute + resequence (+ air for what is left)
  if (reroute.length && reseq.length)
    options.push(
      optionFrom(
        'combo',
        bi('Re-route + resequence (recommended package)', 'إعادة التوجيه + إعادة التسلسل (الحزمة الموصى بها)'),
        bi('Divert exposed cargo to alternate-coast ports and overlap the critical links to claw back the remaining days.', 'تحويل الشحنات المعرّضة إلى الموانئ البديلة وتداخل الروابط الحرجة لاسترداد الأيام المتبقية.'),
        baseResult,
        [...base, ...reroute, ...reseq],
        plan,
        [bi('Combines the trade-offs of both measures', 'يجمع بين مقايضات الإجراءين')],
      ),
    );

  options.sort((a, b) => b.recoveredDays - a.recoveredDays);
  return { baseResult, options: options.filter((o) => o.recoveredDays > EPS) };
}

/** calendar mitigations: night shift, overtime, pre-Eid push, leave staggering */
export function calendarRecovery(plan: Plan, base: Delta[], window: { fromT: number; toT: number }): { baseResult: ScenarioResult; options: RecoveryOption[] } {
  const baseResult = evaluate(plan, base);
  const options: RecoveryOption[] = [];
  if (baseResult.dFinish <= EPS) return { baseResult, options };
  const outdoor: ShiftPlan['calendars'] = ['site', 'marine', 'crane'];
  const mkShift = (id: string, label: Bi, cals: ShiftPlan['calendars'], extraHrs: number, fromT: number, toT: number, costPerHr: number): Delta => ({
    kind: 'shift',
    shift: { id, label, calendars: cals, extraHrs, fromT, toT, costPerHr },
  });
  const cands: Array<{ id: string; title: Bi; detail: Bi; deltas: Delta[]; tradeoffs: Bi[] }> = [
    {
      id: 'night',
      title: bi('Night shift on outdoor crews', 'وردية ليلية للأطقم الخارجية'),
      detail: bi('Add a 6 h night shift (floodlit, outside the midday ban) for the whole affected period.', 'إضافة وردية ليلية 6 ساعات (إضاءة صناعية، خارج حظر الظهيرة) طوال الفترة المتأثرة.'),
      deltas: [mkShift('night', bi('Night shift', 'وردية ليلية'), outdoor, 6, window.fromT, window.toT, 9500)],
      tradeoffs: [bi('Night-work permits and lighting needed', 'يلزم تصاريح العمل الليلي والإضاءة'), bi('Higher HSE exposure at night', 'تعرض أعلى للمخاطر ليلاً')],
    },
    {
      id: 'overtime',
      title: bi('Overtime +2 h/day (compliant with Ramadan/summer rules)', 'عمل إضافي ساعتان يوميًا (متوافق مع قواعد رمضان والصيف)'),
      detail: bi('Two extra hours per day in the shaded morning/evening windows.', 'ساعتان إضافيتان يوميًا في فترتي الصباح والمساء.'),
      deltas: [mkShift('ot', bi('Overtime', 'عمل إضافي'), outdoor, 2, window.fromT, window.toT, 8200)],
      tradeoffs: [bi('Fatigue and heat-stress risk', 'خطر الإجهاد والإجهاد الحراري'), bi('Lower recovery than a full night shift', 'استرداد أقل من الوردية الليلية الكاملة')],
    },
    {
      id: 'preeid',
      title: bi('Pre-Eid push (4 weeks before the holiday)', 'دفعة ما قبل العيد (4 أسابيع قبل الإجازة)'),
      detail: bi('Front-load critical work with +3 h/day in the four weeks before the period.', 'تقديم الأعمال الحرجة بـ +3 ساعات يوميًا في الأسابيع الأربعة السابقة للفترة.'),
      deltas: [mkShift('preeid', bi('Pre-Eid push', 'دفعة ما قبل العيد'), outdoor, 3, window.fromT - 28, window.fromT - 1, 8800)],
      tradeoffs: [bi('Needs crews and material staged early', 'يتطلب جاهزية الأطقم والمواد مبكرًا')],
    },
    {
      id: 'stagger',
      title: bi('Stagger leave & workforce rotation', 'جدولة الإجازات وتناوب العمالة'),
      detail: bi('Halve Eid absenteeism by staggering leave across crews.', 'تقليل الغياب حول العيد إلى النصف عبر جدولة الإجازات بين الأطقم.'),
      deltas: [{ kind: 'stagger', factor: 0.5 }],
      tradeoffs: [bi('Only helps leave-surge periods', 'يفيد فقط في فترات تزامن الإجازات'), bi('Negligible cost', 'تكلفة ضئيلة')],
    },
    {
      id: 'crane2',
      title: bi('Double-shift the cranes (equipment re-allocation)', 'وردية مزدوجة للرافعات (إعادة توزيع المعدات)'),
      detail: bi('Run lifting equipment on two shifts and re-allocate spare plant to critical lifts.', 'تشغيل معدات الرفع على ورديتين وإعادة توزيع المعدات الاحتياطية على الرفعات الحرجة.'),
      deltas: [mkShift('crane2', bi('Crane second shift', 'وردية ثانية للرافعات'), ['crane', 'marine'], 8, window.fromT, window.toT, 6200)],
      tradeoffs: [bi('Operator availability and rental of extra plant', 'توفر المشغلين واستئجار معدات إضافية')],
    },
  ];
  for (const c of cands) options.push(optionFrom(c.id, c.title, c.detail, baseResult, [...base, ...c.deltas], plan, c.tradeoffs));
  options.sort((a, b) => b.recoveredDays - a.recoveredDays);
  return { baseResult, options: options.filter((o) => o.recoveredDays > 0.05) };
}

/** asset options: run-to-failure vs. planned service (best window) vs. pre-positioned rental */
export function assetOptions(plan: Plan, assetId: Id, failT: number, nowT: number) {
  const asset = plan.pack.assets.find((a) => a.id === assetId)!;
  const run = evaluate(plan, [{ kind: 'failAsset', assetId, startT: failT }]);
  // planned service: scan the window [now+1, failT-1] for the start with the smallest finish impact
  let best: { startT: number; res: ScenarioResult } | null = null;
  const lo = Math.ceil(nowT) + 1;
  const hi = Math.max(lo, Math.floor(failT) - 1);
  for (let s = lo; s <= hi; s++) {
    // services start on a working-day morning
    const startT = s + 0.25;
    const res = evaluate(plan, [{ kind: 'serviceAsset', assetId, startT }]);
    if (!best || res.dFinish < best.res.dFinish - 0.01 || (Math.abs(res.dFinish - best.res.dFinish) <= 0.01 && res.cost.total < best.res.cost.total)) best = { startT, res };
  }
  const service = best!;
  const prepos = evaluate(plan, [{ kind: 'failAsset', assetId, startT: failT, downDays: 2, replacementPrepositioned: true }]);
  return { asset, run, service, prepos };
}
