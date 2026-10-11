// Report document model: one structure rendered both as an HTML preview (EN/AR, print-ready) and as a jsPDF file.
import { dayToYmd, tToDay } from '../../engine/dates';
import type { ProjectPack } from '../../engine/types';
import type { ScenarioResult } from '../../engine/scenario';
import { fmtAed, fmtDate, fmtDays, fmtPct, type Lang } from '../../lib/fmt';
import { tx } from '../../lib/bi';
import type { Snapshot } from '../../sim/types';
import { WBGT_BY_MONTH } from '../hse/data';

export type Tone = 'good' | 'warn' | 'bad' | 'info' | 'neutral';
export type Section =
  | { kind: 'kpis'; title: string; items: Array<{ label: string; value: string; tone?: Tone }> }
  | { kind: 'table'; title: string; head: string[]; rows: string[][] }
  | { kind: 'bullets'; title: string; items: Array<{ text: string; tone?: Tone }> }
  | { kind: 'text'; title: string; text: string };

export interface ReportDoc {
  id: string;
  title: string;
  subtitle: string;
  sections: Section[];
}

export type ReportKind = 'daily' | 'weekly' | 'board';

export interface ReportCtx {
  pack: ProjectPack;
  snap: Snapshot;
  lang: Lang;
  scenario: { label: string; result: ScenarioResult } | null;
}

export function buildReport(kind: ReportKind, ctx: ReportCtx): ReportDoc {
  const { pack, snap, lang, scenario } = ctx;
  const L = (en: string, ar: string) => (lang === 'ar' ? ar : en);
  const name = tx(pack.config.name, lang);
  const date = fmtDate(snap.nowT, lang, 'long');
  const k = snap.kpis;
  const ymd = dayToYmd(tToDay(snap.nowT));
  const num = (n: number) => String(ymd.y).slice(2) + String(ymd.m).padStart(2, '0') + String(ymd.d).padStart(2, '0') + `-${n}`;
  const wbgt = WBGT_BY_MONTH[ymd.m - 1];
  const d = snap.dFinishVsBaseline;
  const open = snap.pos.filter((p) => p.stage < 6);
  const risky = open.filter((p) => p.risk === 'risk' || p.risk === 'late').sort((a, b) => a.floatDays - b.floatDays);
  const matName = (id: string) => tx(pack.materials.find((m) => m.id === id)?.name, lang);

  const inProgress = pack.activities
    .map((a, i) => ({ a, p: snap.pct[i] ?? 0 }))
    .filter((x) => x.a.kind === 'task' && x.p > 0.02 && x.p < 0.98)
    .sort((x, y) => y.a.budget - x.a.budget)
    .slice(0, 8);

  const progressTable: Section = {
    kind: 'table',
    title: L('Work in progress', 'الأعمال الجارية'),
    head: [L('Activity', 'النشاط'), L('Complete', 'الإنجاز'), L('Finish', 'الإنهاء')],
    rows: inProgress.map(({ a, p }) => [tx(a.name, lang), fmtPct(p, lang), fmtDate(snap.forecast.ef[snap.forecast.idx.get(a.id)!], lang, 'short')]),
  };
  const fleet = [...snap.assets].sort((a, b) => a.report.health - b.report.health).slice(0, 5);
  const fleetSection: Section = {
    kind: 'table',
    title: L('Equipment needing attention', 'معدات تحتاج إلى اهتمام'),
    head: [L('Asset', 'الأصل'), L('Health', 'الصحة'), L('Failure risk 14 d', 'خطر العطل خلال 14 يومًا')],
    rows: fleet.map((a) => [a.id, String(Math.round(a.report.health)), fmtPct(a.report.p14, lang)]),
  };
  const poSection: Section = {
    kind: 'table',
    title: L('Purchase orders at risk', 'أوامر الشراء المعرّضة للخطر'),
    head: ['PO', L('Material', 'المادة'), L('Float', 'الهامش'), L('Value', 'القيمة')],
    rows: (risky.length ? risky : open.sort((a, b) => a.floatDays - b.floatDays)).slice(0, 6).map((p) => [p.id, matName(p.materialId), fmtDays(p.floatDays, lang, true), `AED ${fmtAed(p.valueAED, lang)}`]),
  };
  const evmSection: Section = {
    kind: 'kpis',
    title: L('Cost and schedule performance', 'أداء التكلفة والجدول'),
    items: [
      { label: 'SPI', value: k.spi.toFixed(2), tone: k.spi < 0.95 ? 'warn' : 'good' },
      { label: 'CPI', value: k.cpi.toFixed(2), tone: k.cpi < 0.97 ? 'warn' : 'good' },
      { label: L('Earned value', 'القيمة المكتسبة'), value: `AED ${fmtAed(snap.evm.ev, lang)}` },
      { label: L('Forecast at completion', 'التقدير عند الإنجاز'), value: `AED ${fmtAed(snap.evm.eac, lang)}`, tone: snap.evm.vac < 0 ? 'warn' : 'good' },
    ],
  };
  const scenSection: Section | null = scenario
    ? {
        kind: 'bullets',
        title: L('Active what-if scenario', 'سيناريو ماذا-لو النشط'),
        items: [
          { text: `${scenario.label}`, tone: 'info' },
          { text: L(`Finish moves by ${fmtDays(scenario.result.dFinish, 'en', true)} to ${fmtDate(scenario.result.finish, 'en')}.`, `يتحرك الإنجاز بمقدار ${fmtDays(scenario.result.dFinish, 'ar', true)} إلى ${fmtDate(scenario.result.finish, 'ar')}.`), tone: scenario.result.dFinish > 0 ? 'bad' : 'good' },
          { text: L(`Cost impact AED ${fmtAed(scenario.result.cost.total, 'en')}.`, `الأثر على التكلفة ${fmtAed(scenario.result.cost.total, 'ar')} درهم.`), tone: scenario.result.cost.total > 0 ? 'warn' : 'good' },
        ],
      }
    : null;
  const brief: Section = { kind: 'bullets', title: L('Highlights', 'أبرز النقاط'), items: snap.briefing.bullets.map((b) => ({ text: tx(b.text, lang), tone: b.tone === 'info' ? 'info' : b.tone })) };

  if (kind === 'daily') {
    return {
      id: `DSR-${num(1)}`,
      title: L('Daily site report', 'التقرير اليومي للموقع'),
      subtitle: `${name} - ${date}`,
      sections: [
        { kind: 'kpis', title: L('Site summary', 'ملخص الموقع'), items: [{ label: L('Manpower', 'القوى العاملة'), value: k.manpower.toLocaleString('en') }, { label: L('Fleet availability', 'جاهزية الأسطول'), value: fmtPct(k.fleetAvailability, lang) }, { label: L('Days since LTI', 'أيام بلا إصابة'), value: String(k.daysSinceLti), tone: 'good' }, { label: 'WBGT', value: `${wbgt.toFixed(1)} C`, tone: wbgt >= 30 ? 'warn' : 'good' }] },
        progressTable,
        fleetSection,
        { kind: 'bullets', title: L('Alarms and events today', 'الإنذارات والأحداث اليوم'), items: snap.alarms.slice(0, 6).map((a) => ({ text: tx(a.text, lang), tone: a.severity === 'crit' ? 'bad' : a.severity === 'warn' ? 'warn' : 'info' })) },
        { kind: 'text', title: L('Notes', 'ملاحظات'), text: L('Auto-generated from the site data. Pending site engineer sign-off.', 'أُنشئ آليًا من بيانات الموقع. بانتظار اعتماد مهندس الموقع.') },
      ],
    };
  }
  if (kind === 'weekly') {
    const ahead = pack.activities
      .map((a, i) => ({ a, es: snap.forecast.es[i] }))
      .filter((x) => x.a.kind === 'task' && x.es > snap.nowT && x.es < snap.nowT + 21)
      .sort((x, y) => x.es - y.es)
      .slice(0, 8);
    return {
      id: `WPR-${num(2)}`,
      title: L('Weekly progress report', 'تقرير التقدم الأسبوعي'),
      subtitle: `${name} - ${date}`,
      sections: [
        { kind: 'kpis', title: L('Progress', 'التقدم'), items: [{ label: L('Forecast finish', 'الإنجاز المتوقع'), value: fmtDate(snap.forecastFinish, lang, 'short'), tone: d > 14 ? 'bad' : d > 1 ? 'warn' : 'good' }, { label: L('vs baseline', 'مقابل الخط الأساسي'), value: fmtDays(d, lang, true) }, { label: L('Complete', 'الإنجاز'), value: fmtPct(snap.evm.percentComplete, lang, 1) }, { label: L('Planned', 'المخطط'), value: fmtPct(snap.evm.percentPlanned, lang, 1) }] },
        evmSection,
        progressTable,
        { kind: 'table', title: L('Three-week look-ahead', 'نظرة ثلاثة أسابيع قادمة'), head: [L('Activity', 'النشاط'), L('Starts', 'يبدأ')], rows: ahead.map(({ a, es }) => [tx(a.name, lang), fmtDate(es, lang, 'short')]) },
        poSection,
        fleetSection,
        brief,
      ],
    };
  }
  return {
    id: `BRD-${num(3)}`,
    title: L('Board briefing', 'إحاطة مجلس الإدارة'),
    subtitle: `${name} - ${date}`,
    sections: [
      { kind: 'text', title: L('Headline', 'العنوان'), text: tx(snap.briefing.headline, lang) },
      { kind: 'kpis', title: L('Key indicators', 'المؤشرات الرئيسية'), items: [{ label: L('Forecast finish', 'الإنجاز المتوقع'), value: fmtDate(snap.forecastFinish, lang, 'short'), tone: d > 14 ? 'bad' : d > 1 ? 'warn' : 'good' }, { label: 'SPI / CPI', value: `${k.spi.toFixed(2)} / ${k.cpi.toFixed(2)}`, tone: k.spi < 0.95 || k.cpi < 0.97 ? 'warn' : 'good' }, { label: L('Material at risk', 'مواد معرّضة للخطر'), value: `AED ${fmtAed(k.materialAtRiskAED, lang)}`, tone: 'warn' }, { label: L('Days since LTI', 'أيام بلا إصابة'), value: String(k.daysSinceLti), tone: 'good' }] },
      brief,
      ...(scenSection ? [scenSection] : []),
      poSection,
      evmSection,
      {
        kind: 'bullets',
        title: L('Decisions requested', 'القرارات المطلوبة'),
        items: [
          { text: L('Approve early release of long-lead imported equipment on a route that avoids the chokepoint.', 'الموافقة على الإفراج المبكر للمعدات المستوردة طويلة التوريد عبر مسار يتجنب نقطة الاختناق.'), tone: 'info' },
          { text: L('Approve a planned service window for the flagged crane before the next heavy-lift campaign.', 'الموافقة على نافذة صيانة مخططة للرافعة المرصودة قبل حملة الرفع الثقيل القادمة.'), tone: 'info' },
        ],
      },
    ],
  };
}
