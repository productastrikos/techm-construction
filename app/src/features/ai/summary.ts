import { tx } from '../../lib/bi';
import { fmtAed, fmtDate, fmtDays, fmtPct, type Lang } from '../../lib/fmt';
import type { ProjectPack } from '../../engine/types';
import type { Snapshot } from '../../sim/types';
import type { ScenarioResult } from '../../engine/scenario';

export interface SummaryCtx {
  pack: ProjectPack;
  snap: Snapshot;
  lang: Lang;
  scenario: { label: string; result: ScenarioResult } | null;
}

/** Executive-summary paragraph for the Reports page. Facts are live from the engines; phrasing is templated. */
export function executiveSummary(kind: 'daily' | 'weekly' | 'board', c: SummaryCtx): { steps: string[]; text: string } {
  const { snap, pack, lang, scenario } = c;
  const L = (en: string, ar: string) => (lang === 'ar' ? ar : en);
  const k = snap.kpis;
  const open = snap.pos.filter((p) => p.stage < 6).sort((a, b) => a.floatDays - b.floatDays);
  const worst = [...snap.assets].sort((a, b) => a.report.health - b.report.health)[0];
  const wDef = pack.assets.find((a) => a.id === worst.id);
  const m0 = tx(pack.materials.find((m) => m.id === open[0]?.materialId)?.name, lang);
  const behind = snap.dFinishVsBaseline;
  const steps = [
    L('Reading today\'s progress, cost and safety figures', 'قراءة أرقام التقدم والتكلفة والسلامة لليوم'),
    L('Comparing against the contract baseline', 'المقارنة مع الخط المرجعي للعقد'),
    scenario ? L(`Folding in the active scenario: ${scenario.label}`, `دمج السيناريو النشط: ${scenario.label}`) : L('Selecting the three items that need a decision', 'اختيار البنود الثلاثة التي تحتاج قرارًا'),
    L('Drafting the narrative', 'صياغة السرد'),
  ];
  const head = L(
    `Forecast completion is ${fmtDate(snap.forecastFinish, lang)}, ${fmtDays(Math.abs(behind), lang)} ${behind > 0 ? 'behind' : 'ahead of'} the contract baseline. SPI ${k.spi.toFixed(2)}, CPI ${k.cpi.toFixed(2)}; ${k.daysSinceLti} days without a lost-time injury.`,
    `الإنجاز المتوقع ${fmtDate(snap.forecastFinish, lang)} أي ${behind > 0 ? 'بتأخر' : 'بتقدم'} ${fmtDays(Math.abs(behind), lang)} عن الخط المرجعي للعقد. SPI ${k.spi.toFixed(2)} و CPI ${k.cpi.toFixed(2)}؛ ${k.daysSinceLti} يومًا دون إصابة مضيّعة للوقت.`,
  );
  const risks = L(
    ` Attention: ${open[0]?.id} (${m0}) has ${fmtDays(open[0]?.floatDays ?? 0, lang)} of float, ${open.filter((p) => p.chokepointExposed).length} orders ship through the sea chokepoint, and ${worst.id}${wDef ? ` (${tx(wDef.name, lang)})` : ''} is at health ${Math.round(worst.report.health)}.`,
    ` للانتباه: ${open[0]?.id} (${m0}) هامشه ${fmtDays(open[0]?.floatDays ?? 0, lang)}، و${open.filter((p) => p.chokepointExposed).length} أوامر تُشحن عبر نقطة الاختناق، و${worst.id}${wDef ? ` (${tx(wDef.name, lang)})` : ''} بصحة ${Math.round(worst.report.health)}.`,
  );
  const cost = L(` Forecast cost at completion AED ${fmtAed(snap.evm.eac, lang)} against a budget of AED ${fmtAed(snap.evm.bac, lang)}; ${fmtPct(snap.evm.percentComplete, lang)} complete.`, ` التكلفة المتوقعة عند الإنجاز ${fmtAed(snap.evm.eac, lang)} درهم مقابل ميزانية ${fmtAed(snap.evm.bac, lang)} درهم؛ نسبة الإنجاز ${fmtPct(snap.evm.percentComplete, lang)}.`);
  const scen = scenario
    ? L(` Active scenario "${scenario.label}": finish ${fmtDate(scenario.result.finish, lang)} (${fmtDays(scenario.result.dFinish, lang, true)}), added cost AED ${fmtAed(scenario.result.cost.total, lang)}.`, ` السيناريو النشط "${scenario.label}": الإنجاز ${fmtDate(scenario.result.finish, lang)} (${fmtDays(scenario.result.dFinish, lang, true)})، تكلفة إضافية ${fmtAed(scenario.result.cost.total, lang)} درهم.`)
    : '';
  const ask =
    kind === 'board'
      ? L(' Decision requested: approve the recommended supply re-route package and the planned crane service window.', ' القرار المطلوب: اعتماد حزمة إعادة توجيه الإمداد الموصى بها ونافذة صيانة الرافعة المخططة.')
      : kind === 'weekly'
        ? L(' Next week: close out the at-risk purchase orders and confirm the service slot.', ' الأسبوع القادم: إغلاق أوامر الشراء المعرّضة للخطر وتأكيد موعد الصيانة.')
        : L(' Today: chase the tightest PO and review the open camera events.', ' اليوم: متابعة أضيق أمر شراء ومراجعة أحداث الكاميرات المفتوحة.');
  return { steps, text: head + risks + (kind === 'daily' ? '' : cost) + scen + ask };
}
