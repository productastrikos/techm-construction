import { tx, type Bi } from '../../lib/bi';
import { fmtAed, fmtDate, fmtDays, fmtPct, type Lang } from '../../lib/fmt';
import { getDs, getPack } from '../../sim/useSim';
import type { Snapshot } from '../../sim/types';
import type { ProjectPack } from '../../engine/types';
import { SIA_URL } from '../../lib/links';

/**
 * The Copilot's brain for the PoC. Every number in an answer comes from the live engines (CPM, scenario,
 * asset health, procurement). Only the *language* is templated - there is no LLM behind this in the PoC.
 */
export interface Ctx {
  snap: Snapshot;
  pack: ProjectPack;
  lang: Lang;
  simT: number;
}
export interface Action {
  label: Bi;
  to?: string;
  href?: string;
  /** scripted replay of a hero flow after navigating */
  replay?: 'h1' | 'h2' | 'h3';
  kind?: 'primary' | 'soft';
}
export interface Reply {
  text: string;
  actions: Action[];
  /** engines / registers the answer was computed from (shown as chips) */
  sources: string[];
}
export interface Intent {
  id: string;
  question: Bi;
  /** short chip label */
  chip: Bi;
  /** tool-call style trace shown while "thinking" */
  steps: Bi[];
  keywords: string[];
  answer: (c: Ctx) => Promise<Reply>;
}

const L = (c: Ctx, en: string, ar: string) => (c.lang === 'ar' ? ar : en);
const fd = (c: Ctx, t: number) => fmtDate(t, c.lang);

function worstAsset(c: Ctx) {
  const a = [...c.snap.assets].sort((x, y) => x.report.health - y.report.health)[0];
  return { row: a, def: c.pack.assets.find((x) => x.id === a.id)! };
}

export const INTENTS: Intent[] = [
  {
    id: 'risk',
    question: { en: 'What is the biggest risk to the finish date?', ar: 'ما أكبر خطر على تاريخ الإنجاز؟' },
    chip: { en: 'Biggest schedule risk', ar: 'أكبر خطر على الجدول' },
    steps: [
      { en: 'Reading the live schedule (339 activities)', ar: 'قراءة الجدول الحي (339 نشاطًا)' },
      { en: 'Running the CPM engine: forward and backward pass', ar: 'تشغيل محرك المسار الحرج' },
      { en: 'Cross-checking purchase-order float and equipment health', ar: 'مطابقة هامش أوامر الشراء وصحة المعدات' },
      { en: 'Ranking drivers by days of finish impact', ar: 'ترتيب العوامل حسب أثرها بالأيام' },
    ],
    keywords: ['risk', 'finish', 'delay', 'late', 'critical', 'schedule', 'خطر', 'تأخر', 'الجدول', 'الإنجاز', 'حرج'],
    answer: async (c) => {
      const s = c.snap;
      const nextCrit = s.criticalPath.map((id) => c.pack.activities[s.forecast.idx.get(id)!]).find((a) => a && a.kind === 'task' && s.forecast.ef[s.forecast.idx.get(a.id)!] > s.nowT);
      const pos = s.pos.filter((p) => p.stage < 6).sort((a, b) => a.floatDays - b.floatDays);
      const w = worstAsset(c);
      const m = (id: string) => tx(c.pack.materials.find((x) => x.id === id)?.name, c.lang);
      const text = L(
        c,
        `Forecast completion is ${fd(c, s.forecastFinish)}, ${fmtDays(s.dFinishVsBaseline, c.lang)} behind the contract baseline. Three things drive it:\n\n1. Critical path - it currently runs through "${tx(nextCrit?.name, c.lang)}" with zero float.\n2. Supply - ${pos.filter((p) => p.floatDays < 14).length} open POs have under 14 days of float; the tightest is ${pos[0].id} (${m(pos[0].materialId)}) at ${fmtDays(pos[0].floatDays, c.lang)}, and ${pos.filter((p) => p.chokepointExposed).length} ship through the sea chokepoint.\n3. Equipment - ${w.row.id} (${tx(w.def.name, c.lang)}) is at health ${Math.round(w.row.report.health)}${w.row.report.rulDays != null ? ` with ~${Math.round(w.row.report.rulDays)} days of remaining life` : ''}.\n\nMy recommendation: stress-test the chokepoint first - it is the largest single exposure.`,
        `الإنجاز المتوقع ${fd(c, s.forecastFinish)} أي بتأخر ${fmtDays(s.dFinishVsBaseline, c.lang)} عن الخط المرجعي للعقد. ثلاثة عوامل تحدد ذلك:\n\n1. المسار الحرج - يمر حاليًا عبر "${tx(nextCrit?.name, c.lang)}" بهامش صفري.\n2. الإمداد - عدد أوامر الشراء المفتوحة التي هامشها أقل من 14 يومًا: ${pos.filter((p) => p.floatDays < 14).length}؛ الأضيق ${pos[0].id} (${m(pos[0].materialId)}) بهامش ${fmtDays(pos[0].floatDays, c.lang)}، و${pos.filter((p) => p.chokepointExposed).length} منها تمر عبر نقطة الاختناق البحرية.\n3. المعدات - ${w.row.id} (${tx(w.def.name, c.lang)}) بصحة ${Math.round(w.row.report.health)}${w.row.report.rulDays != null ? ` وعمر متبقٍ ~${Math.round(w.row.report.rulDays)} يومًا` : ''}.\n\nتوصيتي: اختبر إغلاق نقطة الاختناق أولًا فهو أكبر تعرّض منفرد.`,
      );
      return {
        text,
        sources: ['CPM engine', 'PO register', 'Asset health'],
        actions: [
          { label: { en: 'Open critical path', ar: 'افتح المسار الحرج' }, to: '/schedule', kind: 'soft' },
          { label: { en: 'Run the chokepoint what-if', ar: 'شغّل سيناريو نقطة الاختناق' }, to: '/whatif/supply', replay: 'h1', kind: 'primary' },
        ],
      };
    },
  },
  {
    id: 'hormuz',
    question: { en: 'What happens if the Strait of Hormuz closes for 12 months?', ar: 'ماذا يحدث إذا أُغلق مضيق هرمز لمدة 12 شهرًا؟' },
    chip: { en: 'Hormuz closure impact', ar: 'أثر إغلاق هرمز' },
    steps: [
      { en: 'Cloning the live plan into a sandbox', ar: 'نسخ الخطة الحية إلى بيئة تجريبية' },
      { en: 'Applying: chokepoint = closed, 12 months', ar: 'تطبيق: نقطة الاختناق = مغلقة، 12 شهرًا' },
      { en: 'Re-routing exposed shipments, recomputing ETAs', ar: 'إعادة توجيه الشحنات المعرّضة وإعادة حساب مواعيد الوصول' },
      { en: 'Re-running CPM and the cost model', ar: 'إعادة تشغيل المسار الحرج ونموذج التكلفة' },
      { en: 'Searching recovery options', ar: 'البحث عن خيارات التعافي' },
    ],
    keywords: ['hormuz', 'strait', 'chokepoint', 'closure', 'close', 'sea', 'route', 'shipping', 'هرمز', 'مضيق', 'اختناق', 'إغلاق', 'شحن'],
    answer: async (c) => {
      const deltas = [{ kind: 'chokepoint' as const, state: 'closed' as const, startT: c.simT, durationDays: 365 }];
      const [res, rec] = await Promise.all([getDs().runScenario(c.simT, deltas), getDs().recovery(c.simT, 'supply', deltas)]);
      const hit = res.poImpacts.filter((p) => p.slipDays > 0.5 && !p.delivered);
      const best = [...rec.options].sort((a, b) => b.recoveredDays - a.recoveredDays)[0];
      const text = L(
        c,
        `A 12-month closure moves forecast completion to ${fd(c, res.finish)} (${fmtDays(res.dFinish, c.lang, true)} vs today's forecast) and adds about AED ${fmtAed(res.cost.total, c.lang)} of cost (liquidated damages, prolongation, escalation).\n\n${hit.length} purchase orders slip - the worst by ${fmtDays(Math.max(0, ...hit.map((p) => p.slipDays)), c.lang)}. ${res.newlyCritical.length} ${res.newlyCritical.length === 1 ? 'activity becomes' : 'activities become'} newly critical and ${res.affectedElements.length} 3D elements are affected.\n\n${best ? `Best recovery I found: "${tx(best.title, c.lang)}" - recovers ${fmtDays(best.recoveredDays, c.lang)} for about AED ${fmtAed(best.spendAED, c.lang)} of mitigation spend.` : ''}`,
        `إغلاق لمدة 12 شهرًا ينقل الإنجاز المتوقع إلى ${fd(c, res.finish)} (${fmtDays(res.dFinish, c.lang, true)} مقارنة بالتوقع الحالي) ويضيف نحو ${fmtAed(res.cost.total, c.lang)} درهم من التكلفة (غرامات تأخير وإطالة وتصاعد أسعار).\n\nعدد أوامر الشراء المتأخرة ${hit.length} - أسوؤها بمقدار ${fmtDays(Math.max(0, ...hit.map((p) => p.slipDays)), c.lang)}. عدد الأنشطة الحرجة الجديدة ${res.newlyCritical.length}، وعدد العناصر ثلاثية الأبعاد المتأثرة ${res.affectedElements.length}.\n\n${best ? `أفضل تعافٍ وجدته: "${tx(best.title, c.lang)}" - يسترد ${fmtDays(best.recoveredDays, c.lang)} مقابل نحو ${fmtAed(best.spendAED, c.lang)} درهم من الإنفاق.` : ''}`,
      );
      return {
        text,
        sources: ['Scenario engine', 'CPM engine', 'Route model', 'Cost model'],
        actions: [{ label: { en: 'Replay it live in What-If', ar: 'أعد التشغيل مباشرة في ماذا-لو' }, to: '/whatif/supply', replay: 'h1', kind: 'primary' }],
      };
    },
  },
  {
    id: 'equipment',
    question: { en: 'Will any equipment fail soon, and what would it cost us?', ar: 'هل ستتعطل أي معدة قريبًا وكم سيكلفنا ذلك؟' },
    chip: { en: 'Predictive maintenance', ar: 'الصيانة التنبؤية' },
    steps: [
      { en: 'Pulling 30 days of telemetry from 27 units', ar: 'سحب 30 يومًا من القياسات من 27 وحدة' },
      { en: 'Scoring degradation trends per sensor channel', ar: 'تقييم اتجاهات التدهور لكل قناة استشعار' },
      { en: 'Estimating remaining useful life and failure probability', ar: 'تقدير العمر المتبقي واحتمال العطل' },
      { en: 'Simulating downtime vs a planned service window', ar: 'محاكاة التوقف مقابل نافذة صيانة مخططة' },
    ],
    keywords: ['equipment', 'fail', 'crane', 'maintenance', 'asset', 'breakdown', 'machine', 'fleet', 'معدات', 'عطل', 'رافعة', 'صيانة', 'أسطول'],
    answer: async (c) => {
      const { row, def } = worstAsset(c);
      const r = row.report;
      const failT = r.failT ?? c.simT + 21;
      const chName = tx(def.channels.find((ch) => ch.id === r.degradingChannel)?.name, c.lang).toLowerCase() || L(c, 'a sensor channel', 'قناة استشعار');
      const o = await getDs().assetOptions(c.simT, row.id, failT);
      const text = L(
        c,
        `${row.id} - ${tx(def.name, c.lang)} - is the unit to watch. Health ${Math.round(r.health)}/100, ${r.rulDays != null ? `about ${Math.round(r.rulDays)} days of remaining life, ` : ''}${fmtPct(r.p14, c.lang)} probability of failure in the next 14 days. The signal is ${chName} trending out of its normal band.\n\nIf it fails in service the programme loses ${fmtDays(o.run.dFinish, c.lang)} (AED ${fmtAed(o.run.cost.total, c.lang)}). A planned service now costs ${fmtDays(o.service.res.dFinish, c.lang)} (AED ${fmtAed(o.service.res.cost.total, c.lang)}).\n\nRecommendation: book the service window before ${fd(c, failT)} and raise an inspection work order today.${def.type === 'crawler-crane' ? ` Spare SP-1101 (hoist gearbox bearing set) has a 21-day lead time${r.rulDays != null && r.rulDays < 21 ? ' - longer than its remaining life, so order it now' : ''}.` : ''}`,
        `${row.id} - ${tx(def.name, c.lang)} - هي الوحدة الأجدر بالمراقبة. الصحة ${Math.round(r.health)}/100، ${r.rulDays != null ? `وعمر متبقٍ نحو ${Math.round(r.rulDays)} يومًا، ` : ''}واحتمال العطل خلال 14 يومًا ${fmtPct(r.p14, c.lang)}. الإشارة: ${chName} تخرج من نطاقها الطبيعي.\n\nإذا تعطلت أثناء التشغيل يخسر البرنامج ${fmtDays(o.run.dFinish, c.lang)} (${fmtAed(o.run.cost.total, c.lang)} درهم). أما الصيانة المخططة الآن فتكلف ${fmtDays(o.service.res.dFinish, c.lang)} (${fmtAed(o.service.res.cost.total, c.lang)} درهم).\n\nالتوصية: احجز نافذة الصيانة قبل ${fd(c, failT)} وأنشئ أمر فحص اليوم.${def.type === 'crawler-crane' ? ` قطعة الغيار SP-1101 (طقم محامل علبة تروس الرفع) مدة توريدها 21 يومًا${r.rulDays != null && r.rulDays < 21 ? ' - أطول من عمرها المتبقي، فاطلبها الآن' : ''}.` : ''}`,
      );
      return {
        text,
        sources: ['Telemetry', 'Health model', 'Scenario engine'],
        actions: [
          { label: { en: 'Open asset and create work order', ar: 'افتح الأصل وأنشئ أمر عمل' }, to: `/assets?asset=${row.id}`, kind: 'primary' },
          { label: { en: 'Replay the failure what-if', ar: 'أعد سيناريو العطل' }, to: '/whatif/equipment', replay: 'h3', kind: 'soft' },
        ],
      };
    },
  },
  {
    id: 'po',
    question: { en: 'Which purchase orders need action this week?', ar: 'أي أوامر الشراء تحتاج إجراءً هذا الأسبوع؟' },
    chip: { en: 'POs needing action', ar: 'أوامر شراء تحتاج إجراءً' },
    steps: [
      { en: 'Scanning 34 purchase orders and their shipping legs', ar: 'فحص 34 أمر شراء ومراحل شحنها' },
      { en: 'Matching each delivery to the activity it feeds', ar: 'مطابقة كل توريد بالنشاط الذي يغذيه' },
      { en: 'Computing float to need-by date', ar: 'حساب الهامش حتى تاريخ الحاجة' },
    ],
    keywords: ['po', 'purchase', 'order', 'procurement', 'supplier', 'delivery', 'material', 'shipment', 'شراء', 'أوامر', 'مورد', 'توريد', 'مواد'],
    answer: async (c) => {
      const open = c.snap.pos.filter((p) => p.stage < 6).sort((a, b) => a.floatDays - b.floatDays);
      const top = open.slice(0, 3);
      const m = (id: string) => tx(c.pack.materials.find((x) => x.id === id)?.name, c.lang);
      const lines = top.map((p) => `- ${p.id}: ${m(p.materialId)} - ${L(c, 'float', 'هامش')} ${fmtDays(p.floatDays, c.lang)}${p.chokepointExposed ? L(c, ' (chokepoint route)', ' (عبر نقطة الاختناق)') : ''}`).join('\n');
      const exposed = open.filter((p) => p.chokepointExposed);
      const text = L(
        c,
        `${open.filter((p) => p.floatDays < 14).length} of ${open.length} open orders have under 14 days of float, and AED ${fmtAed(c.snap.kpis.materialAtRiskAED, c.lang)} of material is at risk. The three to chase first:\n\n${lines}\n\n${exposed.length} orders ship through the chokepoint - if you only act on one thing, ask the supplier for an alternate-port routing on ${top.find((p) => p.chokepointExposed)?.id ?? exposed[0]?.id}.`,
        `من بين ${open.length} أمر شراء مفتوح، هامش ${open.filter((p) => p.floatDays < 14).length} منها أقل من 14 يومًا، وهناك مواد بقيمة ${fmtAed(c.snap.kpis.materialAtRiskAED, c.lang)} درهم معرّضة للخطر. الثلاثة الأولى للمتابعة:\n\n${lines}\n\nعدد الأوامر المشحونة عبر نقطة الاختناق ${exposed.length} - إن تحركت في أمر واحد فاطلب من المورد مسارًا عبر ميناء بديل لـ ${top.find((p) => p.chokepointExposed)?.id ?? exposed[0]?.id}.`,
      );
      return { text, sources: ['PO register', 'Route model', 'CPM engine'], actions: [{ label: { en: 'Open procurement control tower', ar: 'افتح برج مراقبة المشتريات' }, to: '/procurement', kind: 'primary' }] };
    },
  },
  {
    id: 'calendar',
    question: { en: 'How will Ramadan and the summer midday ban affect us?', ar: 'كيف سيؤثر رمضان وحظر العمل وقت الظهيرة صيفًا علينا؟' },
    chip: { en: 'Ramadan & summer impact', ar: 'أثر رمضان والصيف' },
    steps: [
      { en: 'Loading the GCC working calendar (holidays, Ramadan, Eid)', ar: 'تحميل تقويم العمل الخليجي (العطل ورمضان والعيد)' },
      { en: 'Applying Ramadan -2 h, Eid leave and midday ban layers', ar: 'تطبيق طبقات رمضان والعيد وحظر الظهيرة' },
      { en: 'Recomputing activity durations per crew calendar', ar: 'إعادة حساب مدد الأنشطة حسب تقويم كل طاقم' },
      { en: 'Re-running CPM', ar: 'إعادة تشغيل المسار الحرج' },
    ],
    keywords: ['ramadan', 'eid', 'summer', 'heat', 'midday', 'calendar', 'holiday', 'productivity', 'رمضان', 'عيد', 'صيف', 'حرارة', 'ظهيرة', 'تقويم'],
    answer: async (c) => {
      const deltas = [{ kind: 'layers' as const, layers: { ramadan: true, eidLeave: true, midday: true } }];
      const res = await getDs().runScenario(c.simT, deltas);
      const text = L(
        c,
        `With Ramadan working hours, the Eid leave surge and the 15 Jun - 15 Sep midday ban switched on, forecast completion moves to ${fd(c, res.finish)} (${fmtDays(res.dFinish, c.lang, true)}) and costs about AED ${fmtAed(res.cost.total, c.lang)}. ${res.changed.length} activities move by a day or more.\n\nThe biggest lever is shifting outdoor crews to night work during the ban; the What-If Studio compares night shift, crane double-shift and a pre-Eid push side by side.`,
        `عند تفعيل ساعات رمضان وإجازات العيد وحظر العمل وقت الظهيرة (15 يونيو - 15 سبتمبر) ينتقل الإنجاز المتوقع إلى ${fd(c, res.finish)} (${fmtDays(res.dFinish, c.lang, true)}) بتكلفة نحو ${fmtAed(res.cost.total, c.lang)} درهم. عدد الأنشطة التي تتحرك بيوم أو أكثر: ${res.changed.length}.\n\nأكبر رافعة هي نقل الطواقم الخارجية للعمل الليلي خلال فترة الحظر؛ يقارن الاستوديو بين الوردية الليلية وورديتين للرافعات ودفعة ما قبل العيد.`,
      );
      return { text, sources: ['GCC calendar', 'Scenario engine', 'CPM engine'], actions: [{ label: { en: 'Replay it live in What-If', ar: 'أعد التشغيل مباشرة في ماذا-لو' }, to: '/whatif/calendar', replay: 'h2', kind: 'primary' }] };
    },
  },
  {
    id: 'safety',
    question: { en: 'Give me a safety and site status summary', ar: 'أعطني ملخصًا للسلامة وحالة الموقع' },
    chip: { en: 'Safety summary', ar: 'ملخص السلامة' },
    steps: [
      { en: 'Reading HSE observations, permits and incidents', ar: 'قراءة ملاحظات السلامة والتصاريح والحوادث' },
      { en: 'Checking CCTV analytics events', ar: 'فحص أحداث تحليلات كاميرات المراقبة' },
      { en: 'Forecasting heat stress (WBGT, next 7 days)', ar: 'توقع الإجهاد الحراري (WBGT للأيام السبعة القادمة)' },
    ],
    keywords: ['safety', 'hse', 'incident', 'ppe', 'cctv', 'injury', 'permit', 'سلامة', 'حادث', 'كاميرا', 'تصريح', 'إصابة'],
    answer: async (c) => {
      const k = c.snap.kpis;
      const hse = c.snap.alarms.filter((a) => a.source === 'hse');
      const text = L(
        c,
        `${k.daysSinceLti} days without a lost-time injury, LTIFR ${k.ltifr.toFixed(2)}, ${k.manpower.toLocaleString('en')} people on site. ${hse.length ? `There ${hse.length === 1 ? 'is' : 'are'} ${hse.length} open camera event${hse.length === 1 ? '' : 's'}: "${tx(hse[0].text, c.lang)}".` : 'No open camera events.'}\n\nThe vision model flags exclusion-zone breaches and missing PPE in seconds, then drafts the SOP step and a work order for the supervisor to approve - you only decide.`,
        `${k.daysSinceLti} يومًا دون إصابة مضيّعة للوقت، معدل LTIFR ${k.ltifr.toFixed(2)}، و${k.manpower.toLocaleString('en')} شخصًا في الموقع. ${hse.length ? `هناك ${hse.length} حدث كاميرا مفتوح: "${tx(hse[0].text, c.lang)}".` : 'لا توجد أحداث كاميرات مفتوحة.'}\n\nيرصد نموذج الرؤية اختراق مناطق الحظر ونقص معدات الوقاية خلال ثوانٍ ثم يصوغ خطوة الإجراء وأمر العمل ليعتمدهما المشرف - عليك القرار فقط.`,
      );
      return { text, sources: ['HSE register', 'CCTV analytics', 'Weather feed'], actions: [{ label: { en: 'Open the CCTV wall', ar: 'افتح جدار الكاميرات' }, to: '/hse', kind: 'primary' }] };
    },
  },
  {
    id: 'cost',
    question: { en: 'Where is the budget heading?', ar: 'إلى أين تتجه الميزانية؟' },
    chip: { en: 'Cost forecast', ar: 'توقع التكلفة' },
    steps: [
      { en: 'Aggregating earned value by work package', ar: 'تجميع القيمة المكتسبة حسب حزمة العمل' },
      { en: 'Projecting EAC from current CPI', ar: 'إسقاط التكلفة عند الإنجاز من مؤشر الأداء الحالي' },
      { en: 'Checking contingency burn', ar: 'فحص استهلاك الاحتياطي' },
    ],
    keywords: ['cost', 'budget', 'eac', 'cpi', 'money', 'spend', 'finance', 'تكلفة', 'ميزانية', 'مالية', 'إنفاق'],
    answer: async (c) => {
      const e = c.snap.evm;
      const text = L(
        c,
        `At the current cost performance (CPI ${c.snap.kpis.cpi.toFixed(2)}) the project forecasts AED ${fmtAed(e.eac, c.lang)} at completion against a budget of AED ${fmtAed(e.bac, c.lang)} - a variance of AED ${fmtAed(e.vac, c.lang)}. To finish on budget the remaining work must run at an efficiency of ${e.tcpi.toFixed(2)}.\n\nThe variance is inside the contingency pool; I'd watch Marine structures, the largest package.`,
        `بالأداء المالي الحالي (CPI ${c.snap.kpis.cpi.toFixed(2)}) تتوقع التكلفة عند الإنجاز ${fmtAed(e.eac, c.lang)} درهم مقابل ميزانية ${fmtAed(e.bac, c.lang)} درهم - بفارق ${fmtAed(e.vac, c.lang)} درهم. للإنجاز ضمن الميزانية يجب أن تعمل بقية الأعمال بكفاءة ${e.tcpi.toFixed(2)}.\n\nالفارق ضمن مخصص الاحتياطي؛ أنصح بمراقبة الإنشاءات البحرية وهي أكبر الحزم.`,
      );
      return { text, sources: ['EVM engine', 'Cost register'], actions: [{ label: { en: 'Open Cost & EVM', ar: 'افتح التكلفة والقيمة المكتسبة' }, to: '/cost', kind: 'primary' }] };
    },
  },
  {
    id: 'board',
    question: { en: 'Draft the board briefing', ar: 'أعدّ إحاطة مجلس الإدارة' },
    chip: { en: 'Draft board briefing', ar: 'إحاطة المجلس' },
    steps: [
      { en: 'Collecting headline KPIs and top risks', ar: 'جمع المؤشرات الرئيسية وأهم المخاطر' },
      { en: 'Including the active what-if scenario, if any', ar: 'تضمين سيناريو ماذا-لو النشط إن وجد' },
      { en: 'Drafting executive summary and decisions needed', ar: 'صياغة الملخص التنفيذي والقرارات المطلوبة' },
    ],
    keywords: ['board', 'briefing', 'report', 'executive', 'summary', 'brief', 'draft', 'تقرير', 'إحاطة', 'مجلس', 'ملخص'],
    answer: async (c) => ({
      text: L(
        c,
        `The board briefing is ready: headline, top risks, the decisions you need from the board and - if a what-if scenario is active - its impact on date and cost. You can print it, save it as PDF, or send the underlying data to S!a Excel-lence for further spreadsheet analysis.`,
        `إحاطة المجلس جاهزة: العنوان وأهم المخاطر والقرارات المطلوبة من المجلس، ومعها أثر سيناريو ماذا-لو النشط على الموعد والتكلفة إن وُجد. يمكنك طباعتها أو حفظها PDF أو إرسال البيانات إلى S!a Excel-lence لمزيد من التحليل.`,
      ),
      sources: ['Report builder'],
      actions: [
        { label: { en: 'Open board briefing', ar: 'افتح إحاطة المجلس' }, to: '/reports?kind=board', kind: 'primary' },
        { label: { en: 'Analyse in S!a Excel-lence', ar: 'حلّل في S!a Excel-lence' }, href: SIA_URL, kind: 'soft' },
      ],
    }),
  },
  {
    id: 'sia',
    question: { en: 'Analyse this data in a spreadsheet with S!a', ar: 'حلّل هذه البيانات في جدول بيانات مع S!a' },
    chip: { en: 'Open S!a Excel-lence', ar: 'افتح S!a Excel-lence' },
    steps: [
      { en: 'Preparing the register data for export', ar: 'تجهيز بيانات السجلات للتصدير' },
      { en: 'Connecting to the S!a Excel-lence assistant', ar: 'الاتصال بمساعد S!a Excel-lence' },
    ],
    keywords: ['sia', 's!a', 'excel', 'spreadsheet', 'xlsx', 'sheet', 'إكسل', 'جدول'],
    answer: async (c) => ({
      text: L(
        c,
        `S!a Excel-lence is Astrikos' AI spreadsheet assistant: ask it questions about your data in plain language, build formulas, pivots and charts, and clean messy exports. Download any register from Reports as CSV, then open S!a to analyse it. (It is a separate hosted service, so it needs an internet connection.)`,
        `S!a Excel-lence هو مساعد أستريكوس الذكي لجداول البيانات: اسأله عن بياناتك بلغة طبيعية، وأنشئ الصيغ والجداول المحورية والمخططات ونظّف التصديرات. نزّل أي سجل من التقارير بصيغة CSV ثم افتح S!a لتحليله. (خدمة مستضافة منفصلة وتتطلب اتصالًا بالإنترنت.)`,
      ),
      sources: ['S!a Excel-lence'],
      actions: [
        { label: { en: 'Open S!a Excel-lence', ar: 'افتح S!a Excel-lence' }, href: SIA_URL, kind: 'primary' },
        { label: { en: 'Go to Reports', ar: 'اذهب إلى التقارير' }, to: '/reports', kind: 'soft' },
      ],
    }),
  },
];

/** score an utterance against the intents' keywords */
export function matchIntent(q: string): Intent | null {
  const s = q.toLowerCase();
  let best: Intent | null = null;
  let bestScore = 0;
  for (const it of INTENTS) {
    let score = 0;
    for (const k of it.keywords) if (s.includes(k.toLowerCase())) score += k.length > 3 ? 2 : 1;
    if (score > bestScore) {
      best = it;
      bestScore = score;
    }
  }
  return best;
}

export const FALLBACK: (lang: Lang) => Reply = (lang) => ({
  text:
    lang === 'ar'
      ? 'في هذا العرض التجريبي أجيب عن أسئلة الجدول والمشتريات والمعدات والسلامة والتكلفة وسيناريوهات ماذا-لو. جرّب أحد الأسئلة المقترحة أدناه - الأرقام كلها محسوبة من محركات المحاكاة الحية.'
      : 'In this demo I can answer questions about the schedule, procurement, equipment, safety, cost and what-if scenarios. Try one of the suggested questions below - every number is computed live from the simulation engines.',
  actions: [],
  sources: [],
});

/** ordered script for the "Play AI demo" button */
export const DEMO_SCRIPT = ['risk', 'hormuz', 'equipment'];
export { getPack };
