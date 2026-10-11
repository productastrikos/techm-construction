// Port pack: programme generator (~340 activities). Deterministic, bilingual, logic-linked. ILLUSTRATIVE durations and logic.
import { bi, type Bi } from '../../lib/bi';
import type { Activity, CalId, Pred, RelType } from '../../engine/types';

export type PredSpec = string | [string, RelType, number] | [string, RelType, number, { type: RelType; lagDays: number; label: Bi }];

export const BASE: Record<CalId, number> = { site: 10, marine: 10, crane: 10, indoor: 9, continuous: 24 };
const pad = (n: number) => String(n).padStart(2, '0');

interface Opts {
  el?: string[];
  assets?: string[];
  w?: number;
  crew?: number;
  poId?: string;
}

export class Builder {
  acts: Activity[] = [];
  weights = new Map<string, number>();

  private preds(cal: CalId, specs: PredSpec[]): Pred[] {
    return specs.map((s) => {
      if (typeof s === 'string') return { id: s, type: 'FS' as RelType, lagHrs: 0 };
      const [id, type, lag, rs] = s;
      const p: Pred = { id, type, lagHrs: lag * BASE[cal] };
      if (rs) p.resequence = { type: rs.type, lagHrs: rs.lagDays * BASE[cal], label: rs.label };
      return p;
    });
  }

  task(id: string, wbs: string, en: string, ar: string, days: number, cal: CalId, preds: PredSpec[], o: Opts = {}) {
    const crew = o.crew ?? (cal === 'indoor' ? 8 : cal === 'continuous' ? 2 : 40);
    this.acts.push({
      id,
      wbsId: wbs,
      name: bi(en, ar),
      kind: 'task',
      durationHrs: days * BASE[cal],
      calendarId: cal,
      preds: this.preds(cal, preds),
      budget: 0,
      elementIds: o.el ?? [],
      assetIds: o.assets,
      crew,
    });
    this.weights.set(id, o.w ?? days * (0.4 + crew / 40));
    return id;
  }

  ms(id: string, wbs: string, en: string, ar: string, preds: PredSpec[], el: string[] = []) {
    this.acts.push({ id, wbsId: wbs, name: bi(en, ar), kind: 'milestone', durationHrs: 0, calendarId: 'indoor', preds: this.preds('indoor', preds), budget: 0, elementIds: el });
    this.weights.set(id, 0);
    return id;
  }

  del(id: string, wbs: string, en: string, ar: string, poId: string, _preds: PredSpec[] = []) {
    // delivery milestones carry NO logic predecessors: their date is the PO ETA (start-no-earlier constraint)
    this.acts.push({ id, wbsId: wbs, name: bi(en, ar), kind: 'delivery', durationHrs: 0, calendarId: 'indoor', preds: [], budget: 0, elementIds: [], poId });
    this.weights.set(id, 0);
    return id;
  }
}

/** WBS budget shares of BAC (sum = 1) */
const SHARE: Record<string, number> = { MOB: 0.04, DRG: 0.14, MAR: 0.34, PAV: 0.12, BLD: 0.1, EQP: 0.22, COM: 0.04 };

export function buildPortActivities(bac: number): Activity[] {
  const b = new Builder();

  // =========================================================================================== MOB
  b.ms('MOB-001', 'MOB', 'Notice to proceed / contract effective', 'إشعار المباشرة / سريان العقد', []);
  b.task('MOB-010', 'MOB', 'Mobilise management team & establish site', 'تجهيز فريق الإدارة وإنشاء الموقع', 10, 'site', ['MOB-001']);
  b.task('MOB-020', 'MOB', 'Temporary offices, labour camp & welfare', 'المكاتب المؤقتة وسكن العمال والخدمات', 20, 'site', ['MOB-010']);
  b.task('MOB-030', 'MOB', 'Control survey & setting-out', 'المسح المرجعي والتوقيع', 8, 'site', ['MOB-010']);
  b.task('MOB-040', 'MOB', 'Marine survey: bathymetry & geotechnical campaign', 'المسح البحري: العمق والتحريات الجيوتقنية', 15, 'marine', ['MOB-010']);
  b.task('MOB-050', 'MOB', 'Environmental baseline & monitoring set-up', 'خط الأساس البيئي وإعداد الرصد', 12, 'indoor', ['MOB-010']);
  b.task('MOB-060', 'MOB', 'Regulatory approvals & NOCs', 'الموافقات التنظيمية وشهادات عدم الممانعة', 40, 'indoor', ['MOB-001']);
  b.task('MOB-070', 'MOB', 'Temporary power, water & communications', 'الكهرباء والمياه والاتصالات المؤقتة', 15, 'site', ['MOB-020']);
  b.task('MOB-080', 'MOB', 'Haul road & temporary access', 'طريق النقل والوصول المؤقت', 15, 'site', ['MOB-030']);
  b.task('MOB-090', 'MOB', 'Quarry qualification & rock supply agreements', 'تأهيل المحجر واتفاقيات توريد الصخور', 25, 'indoor', ['MOB-001']);
  b.task('MOB-100', 'MOB', 'Concrete batching plant erection & commissioning', 'تركيب وتشغيل محطة الخرسانة', 20, 'site', ['MOB-070', 'MOB-080'], { assets: ['BP-01'] });
  b.task('MOB-110', 'MOB', 'Caisson casting yard: earthworks & ground preparation', 'ساحة صب الصناديق: أعمال التربة وتجهيز الأرض', 25, 'site', ['MOB-030', 'MOB-080']);
  b.task('MOB-120', 'MOB', 'Caisson casting beds & launch ramp', 'أحواض صب الصناديق ومنحدر الإنزال', 35, 'crane', ['MOB-110', 'MOB-170', 'DEL-SHEET'], { assets: ['CC-02'], el: [] });
  b.task('MOB-130', 'MOB', 'Mobilise dredger to site', 'نقل كراكة التكريك إلى الموقع', 20, 'marine', ['MOB-040', 'MOB-060'], { assets: ['DRG-01'] });
  b.task('MOB-140', 'MOB', 'Mobilise tug & barge fleet', 'نقل القاطرة والصنادل', 12, 'marine', ['MOB-010'], { assets: ['TUG-01', 'BRG-01', 'BRG-02'] });
  b.task('MOB-150', 'MOB', 'Mobilise piling rigs', 'نقل معدات الدق', 10, 'site', ['MOB-080'], { assets: ['PR-01', 'PR-02'] });
  b.task('MOB-160', 'MOB', 'Mobilise crawler & mobile harbour cranes', 'نقل الرافعات الزاحفة ورافعة الميناء المتنقلة', 10, 'site', ['MOB-080'], { assets: ['CC-01', 'CC-02', 'MHC-01'] });
  b.task('MOB-170', 'MOB', 'Temporary works design & method statements', 'تصميم الأعمال المؤقتة وبيانات الطرائق', 30, 'indoor', ['MOB-001']);
  b.task('MOB-180', 'MOB', 'Design: marine structures IFC package', 'التصميم: حزمة المنشآت البحرية للتنفيذ', 60, 'indoor', ['MOB-001']);
  b.task('MOB-190', 'MOB', 'Design: pavement & drainage IFC package', 'التصميم: حزمة الرصف والصرف للتنفيذ', 50, 'indoor', ['MOB-001']);
  b.task('MOB-200', 'MOB', 'Design: buildings & utilities IFC package', 'التصميم: حزمة المباني والمرافق للتنفيذ', 90, 'indoor', ['MOB-001']);
  b.task('MOB-210', 'MOB', 'Design: equipment & crane-rail interface', 'التصميم: واجهة المعدات وسكك الرافعات', 45, 'indoor', ['MOB-180']);
  b.ms('MOB-220', 'MOB', 'Mobilisation complete', 'اكتمال التجهيز', ['MOB-020', 'MOB-050', 'MOB-100', 'MOB-130', 'MOB-140', 'MOB-150', 'MOB-160']);

  // Deliveries needed early (POs defined in materials.ts)
  b.del('DEL-FORM', 'MAR', 'Delivery: caisson steel formwork system', 'التوريد: نظام القوالب الفولاذية للصناديق', 'PO-001', ['MOB-170']);
  b.del('DEL-SHEET', 'MOB', 'Delivery: sheet piles for temporary works', 'التوريد: ألواح ستائر للأعمال المؤقتة', 'PO-002');
  b.del('DEL-REBAR1', 'MAR', 'Delivery: rebar lot 1 (domestic)', 'التوريد: حديد التسليح - الدفعة 1 (محلي)', 'PO-003');
  b.del('DEL-GEOT', 'MAR', 'Delivery: geotextile for revetments', 'التوريد: الأقمشة الجيوتقنية للحماية الصخرية', 'PO-004');
  b.del('DEL-COAT', 'MAR', 'Delivery: marine admixtures & coatings', 'التوريد: الإضافات والطلاءات البحرية', 'PO-005');
  b.del('DEL-REBAR2', 'MAR', 'Delivery: rebar lot 2 (domestic)', 'التوريد: حديد التسليح - الدفعة 2 (محلي)', 'PO-006');
  b.del('DEL-SILT', 'DRG', 'Delivery: silt curtains & marine monitoring buoys', 'التوريد: ستائر الطمي وعوامات الرصد البحري', 'PO-031');
  b.del('DEL-DRGSP', 'DRG', 'Delivery: dredger spare pump & wear parts', 'التوريد: مضخة احتياطية وقطع تآكل للكراكة', 'PO-032');
  b.del('DEL-PIEZO', 'DRG', 'Delivery: piezometers & settlement instrumentation', 'التوريد: أجهزة قياس الضغط والهبوط', 'PO-033');
  b.del('DEL-RIG', 'MAR', 'Delivery: caisson lifting beams & rigging', 'التوريد: عوارض رفع الصناديق ومعدات الربط', 'PO-034');
  b.del('DEL-PRECAST', 'PAV', 'Delivery: precast kerbs & drainage units', 'التوريد: الأرصفة والوحدات الجاهزة للصرف', 'PO-007');

  // =========================================================================================== DRG
  b.task('DRG-010', 'DRG', 'Pre-dredge bathymetric survey', 'مسح العمق قبل التكريك', 4, 'marine', ['MOB-040', 'MOB-130', 'MOB-060'], { el: ['SEABED'] });
  const zDur = [45, 40, 36, 40, 36, 30];
  const zName: Array<[string, string]> = [
    ['Approach channel - outer reach', 'قناة الاقتراب - الجزء الخارجي'],
    ['Approach channel - inner reach', 'قناة الاقتراب - الجزء الداخلي'],
    ['Berth pocket - east', 'حوض الرصيف - الشرقي'],
    ['Turning basin', 'حوض الدوران'],
    ['Berth pocket - west', 'حوض الرصيف - الغربي'],
    ['Tug harbour & service basin', 'مرفأ القاطرات وحوض الخدمة'],
  ];
  for (let k = 1; k <= 6; k++) {
    const id = `DRG-Z${k}`;
    const preds: PredSpec[] = k === 1 ? ['DRG-010'] : [['DRG-Z' + (k - 1), 'SS', 28], ['DRG-Z' + (k - 1), 'FF', 10]];
    if (k === 2) preds.push('DEL-SILT');
    if (k === 3) preds.push('DEL-DRGSP');
    b.task(id, 'DRG', `Dredging: ${zName[k - 1][0]}`, `التكريك: ${zName[k - 1][1]}`, zDur[k - 1], 'marine', preds, { assets: ['DRG-01'], el: ['SEABED'], crew: 70 });
    b.task(`DRG-S${k}`, 'DRG', `Post-dredge survey: zone ${k}`, `مسح ما بعد التكريك: المنطقة ${k}`, 2, 'marine', [id], { el: ['SEABED'], crew: 8 });
  }
  const rDur = [40, 40, 35, 35, 30];
  for (let k = 1; k <= 5; k++) {
    const rv = k <= 2 ? 'RV-C1' : 'RV-C2';
    const preds: PredSpec[] = [[`DRG-Z${k}`, 'SS', 20], rv];
    if (k > 1) preds.push([`DRG-R${k - 1}`, 'SS', 25]);
    b.task(`DRG-R${k}`, 'DRG', `Reclamation fill: cell R${k}`, `ردم الأرض: الخلية R${k}`, rDur[k - 1], 'marine', preds, { assets: ['DRG-01', 'EX-01', 'DT-01', 'DT-02'], el: [`RCL-${k}`], crew: 60 });
    b.task(`DRG-W${k}`, 'DRG', `Settlement waiting period: R${k}`, `فترة انتظار الهبوط: R${k}`, 21, 'continuous', k === 1 ? [`DRG-R${k}`, 'DEL-PIEZO'] : [`DRG-R${k}`], { el: [`RCL-${k}`], crew: 4 });
    const gp: PredSpec[] = [`DRG-W${k}`];
    if (k > 1) gp.push([`DRG-G${k - 1}`, 'SS', 15]);
    b.task(`DRG-G${k}`, 'DRG', `Ground improvement (vibro-compaction): R${k}`, `تحسين التربة (الدمك الاهتزازي): R${k}`, 25, 'site', gp, { assets: [k % 2 ? 'PR-01' : 'PR-02'], el: [`RCL-${k}`], crew: 35 });
    b.task(`DRG-L${k}`, 'DRG', `Compaction acceptance tests: R${k}`, `اختبارات قبول الدمك: R${k}`, 4, 'site', [`DRG-G${k}`], { el: [`RCL-${k}`], crew: 10 });
  }
  b.ms('DRG-MS1', 'DRG', 'Dredging complete', 'اكتمال التكريك', ['DRG-Z6', 'DRG-S1', 'DRG-S2', 'DRG-S3', 'DRG-S4', 'DRG-S5', 'DRG-S6'], ['SEABED']);
  b.ms('DRG-MS2', 'DRG', 'Reclamation fill complete', 'اكتمال ردم الأرض', ['DRG-R5']);
  b.ms('DRG-MS3', 'DRG', 'Platform ready for civil works', 'المنصة جاهزة للأعمال المدنية', ['DRG-L1', 'DRG-L2', 'DRG-L3', 'DRG-L4', 'DRG-L5']);

  // =========================================================================================== MAR - revetments / breakwater
  const rvName: Array<[string, string]> = [
    ['west return', 'الجناح الغربي'],
    ['east return', 'الجناح الشرقي'],
    ['north-west face', 'الواجهة الشمالية الغربية'],
    ['north-east face', 'الواجهة الشمالية الشرقية'],
  ];
  for (let j = 1; j <= 4; j++) {
    const cp: PredSpec[] = ['MOB-090', 'MOB-140', ['MOB-180', 'SS', 40]];
    if (j > 1) cp.push([`RV-C${j - 1}`, 'SS', 20]);
    b.task(`RV-C${j}`, 'MAR', `Rock revetment ${rvName[j - 1][0]}: core`, `الحماية الصخرية ${rvName[j - 1][1]}: النواة`, 30, 'marine', cp, { assets: ['BRG-01', 'EX-02'], el: [`RV-${j}`], crew: 45 });
    b.task(`RV-U${j}`, 'MAR', `Rock revetment ${rvName[j - 1][0]}: underlayer & geotextile`, `الحماية الصخرية ${rvName[j - 1][1]}: الطبقة السفلية والجيوتكستايل`, 25, 'marine', [[`RV-C${j}`, 'SS', 15], [`RV-C${j}`, 'FF', 5], 'DEL-GEOT'], { assets: ['BRG-01'], el: [`RV-${j}`], crew: 45 });
    b.task(`RV-A${j}`, 'MAR', `Rock revetment ${rvName[j - 1][0]}: armour layer`, `الحماية الصخرية ${rvName[j - 1][1]}: طبقة الحماية`, 35, 'marine', [[`RV-U${j}`, 'SS', 15], [`RV-U${j}`, 'FF', 5]], { assets: ['BRG-02', 'EX-03'], el: [`RV-${j}`], crew: 45 });
  }
  const bwName: Array<[string, string]> = [
    ['root', 'الجذر'],
    ['trunk', 'الجذع'],
    ['head', 'الرأس'],
  ];
  for (let j = 1; j <= 3; j++) {
    const cp: PredSpec[] = j === 1 ? [['RV-C1', 'SS', 10], 'MOB-090', 'MOB-140'] : [[`BW-C${j - 1}`, 'SS', 30]];
    b.task(`BW-C${j}`, 'MAR', `Breakwater ${bwName[j - 1][0]}: rock core`, `كاسر الأمواج ${bwName[j - 1][1]}: نواة الصخور`, 45, 'marine', cp, { assets: ['BRG-01'], el: [`BW-${j}`], crew: 50 });
    b.task(`BW-U${j}`, 'MAR', `Breakwater ${bwName[j - 1][0]}: underlayer`, `كاسر الأمواج ${bwName[j - 1][1]}: الطبقة السفلية`, 35, 'marine', [[`BW-C${j}`, 'SS', 25], [`BW-C${j}`, 'FF', 5]], { assets: ['BRG-02'], el: [`BW-${j}`], crew: 50 });
    b.task(`BW-A${j}`, 'MAR', `Breakwater ${bwName[j - 1][0]}: armour units`, `كاسر الأمواج ${bwName[j - 1][1]}: وحدات الحماية`, 50, 'marine', [[`BW-U${j}`, 'SS', 25], [`BW-U${j}`, 'FF', 5]], { assets: ['BRG-02', 'CC-01'], el: [`BW-${j}`], crew: 50 });
  }
  b.task('SC-1', 'MAR', 'Toe scour protection: west', 'حماية القاعدة من النحر: الغرب', 20, 'marine', ['RV-A1'], { el: ['RV-1'], crew: 30 });
  b.task('SC-2', 'MAR', 'Toe scour protection: east', 'حماية القاعدة من النحر: الشرق', 20, 'marine', ['RV-A2'], { el: ['RV-2'], crew: 30 });

  // =========================================================================================== MAR - quay wall (10 caissons x 70 m = 700 m)
  b.task('QW-BED', 'MAR', 'Quay foundation trench & rock bedding', 'خندق أساس الرصيف وفرشة الصخور', 35, 'marine', ['DRG-Z3', ['MOB-180', 'FS', 0], 'MOB-140'], { assets: ['DRG-01', 'BRG-01'], crew: 55, el: [] });
  for (let k = 1; k <= 10; k++) {
    const kk = pad(k);
    const crane = k % 2 === 0 ? 'CC-02' : 'CC-01';
    const cp: PredSpec[] =
      k === 1
        ? ['MOB-120', 'MOB-100', 'MOB-180', 'MOB-220', 'DEL-FORM', 'DEL-REBAR1', 'DEL-COAT', 'DEL-RIG']
        : [[`QW-C${pad(k - 1)}`, 'SS', 19], ...(k === 6 ? (['DEL-REBAR2'] as PredSpec[]) : [])];
    const el = [`QW-${kk}`];
    b.task(`QW-C${kk}`, 'MAR', `Caisson ${k}: reinforcement, formwork & cast`, `الصندوق الخرساني ${k}: التسليح والقوالب والصب`, 24, 'crane', cp, { assets: [crane, 'BP-01', 'CM-01'], el, crew: 55 });
    b.task(`QW-U${kk}`, 'MAR', `Caisson ${k}: curing & strength gain`, `الصندوق الخرساني ${k}: المعالجة واكتساب المقاومة`, 10, 'continuous', [`QW-C${kk}`], { el, crew: 2 });
    const pp: PredSpec[] = [`QW-U${kk}`, 'QW-BED'];
    if (k > 1) pp.push(`QW-P${pad(k - 1)}`);
    b.task(`QW-P${kk}`, 'MAR', `Caisson ${k}: launch, tow & place`, `الصندوق الخرساني ${k}: الإنزال والسحب والتثبيت`, 6, 'marine', pp, { assets: ['TUG-01', 'BRG-01'], el, crew: 40 });
    const fp: PredSpec[] = [`QW-P${kk}`];
    if (k > 1) fp.push([`QW-F${pad(k - 1)}`, 'SS', 4]);
    b.task(`QW-F${kk}`, 'MAR', `Caisson ${k}: cell fill & ballast`, `الصندوق الخرساني ${k}: ملء الخلايا والصابورة`, 8, 'marine', fp, { assets: ['BRG-02', 'EX-04'], el, crew: 40 });
    const kp: PredSpec[] = [`QW-F${kk}`];
    if (k > 1) kp.push([`QW-K${pad(k - 1)}`, 'SS', 8]);
    b.task(`QW-K${kk}`, 'MAR', `Capping beam ${k}`, `كمرة التاج ${k}`, 12, 'crane', kp, { assets: [crane, 'CM-02'], el: [`CAP-${kk}`], crew: 45 });
    b.task(`QW-RB${kk}`, 'MAR', `Crane-rail beam ${k}`, `كمرة سكة الرافعة ${k}`, 10, 'crane', [`QW-K${kk}`], { assets: [crane], el: [`CAP-${kk}`], crew: 40 });
  }
  for (let g = 1; g <= 5; g++) {
    b.task(`QW-BF${g}`, 'MAR', `Backfill & compaction behind caissons ${2 * g - 1}-${2 * g}`, `الردم والدمك خلف الصناديق ${2 * g - 1}-${2 * g}`, 12, 'site', [`QW-F${pad(2 * g)}`], { assets: ['EX-04', 'DT-03', 'DT-04'], el: [`QW-${pad(2 * g)}`], crew: 40 });
  }
  b.ms('QW-MS1', 'MAR', 'Quay wall structurally complete (700 m)', 'اكتمال هيكل رصيف الميناء (700 م)', ['QW-RB01', 'QW-RB02', 'QW-RB03', 'QW-RB04', 'QW-RB05', 'QW-RB06', 'QW-RB07', 'QW-RB08', 'QW-RB09', 'QW-RB10', 'QW-BF1', 'QW-BF2', 'QW-BF3', 'QW-BF4', 'QW-BF5']);
  b.ms('MAR-MS2', 'MAR', 'Breakwater & revetments complete', 'اكتمال كاسر الأمواج والحماية الصخرية', ['BW-A1', 'BW-A2', 'BW-A3', 'RV-A3', 'RV-A4', 'SC-1', 'SC-2']);

  // =========================================================================================== PAV
  const aprName = ['Apron zone A1 (berth 1 west)', 'Apron zone A2', 'Apron zone A3', 'Apron zone A4', 'Apron zone A5 (berth 2 east)'];
  const aprAr = ['منطقة الرصيف A1 (الغرب)', 'منطقة الرصيف A2', 'منطقة الرصيف A3', 'منطقة الرصيف A4', 'منطقة الرصيف A5 (الشرق)'];
  for (let g = 1; g <= 5; g++) {
    const el = [`APR-${g}`];
    const pre: PredSpec[] = [`QW-BF${g}`, 'DRG-MS3', 'MOB-190'];
    if (g > 1) pre.push([`PAV-A${g - 1}S`, 'SS', 10]);
    b.task(`PAV-A${g}S`, 'PAV', `${aprName[g - 1]}: subbase & drainage`, `${aprAr[g - 1]}: الطبقة التحتية والصرف`, 10, 'site', pre, { assets: ['EX-01', 'DT-05'], el, crew: 40 });
    b.task(`PAV-A${g}B`, 'PAV', `${aprName[g - 1]}: base course`, `${aprAr[g - 1]}: الطبقة الأساسية`, 10, 'site', [`PAV-A${g}S`, ...(g > 1 ? ([[`PAV-A${g - 1}B`, 'SS', 10]] as PredSpec[]) : [])], { assets: ['DT-05', 'DT-06'], el, crew: 40 });
    b.task(`PAV-A${g}P`, 'PAV', `${aprName[g - 1]}: heavy-duty paving`, `${aprAr[g - 1]}: الرصف للأحمال الثقيلة`, 14, 'site', [`PAV-A${g}B`, `QW-RB${pad(2 * g)}`, ...(g > 1 ? ([[`PAV-A${g - 1}P`, 'SS', 10]] as PredSpec[]) : [])], { assets: ['CM-03'], el, crew: 45 });
  }
  for (let y = 1; y <= 6; y++) {
    const el = [`YRD-${y}`];
    const pre: PredSpec[] = [`DRG-L${Math.min(5, Math.ceil(y * 5 / 6))}`, 'MOB-190', 'DEL-PRECAST'];
    if (y > 1) pre.push([`PAV-Y${y - 1}S`, 'SS', 12]);
    b.task(`PAV-Y${y}S`, 'PAV', `Container yard Y${y}: subgrade & drainage`, `ساحة الحاويات Y${y}: التربة التحتية والصرف`, 10, 'site', pre, { assets: ['EX-01', 'DT-05'], el, crew: 40 });
    b.task(`PAV-Y${y}B`, 'PAV', `Container yard Y${y}: base course`, `ساحة الحاويات Y${y}: الطبقة الأساسية`, 10, 'site', [`PAV-Y${y}S`], { el, crew: 40 });
    b.task(`PAV-Y${y}P`, 'PAV', `Container yard Y${y}: surfacing`, `ساحة الحاويات Y${y}: التسطيح النهائي`, 14, 'site', [`PAV-Y${y}B`], { el, crew: 45 });
    b.task(`PAV-Y${y}M`, 'PAV', `Container yard Y${y}: markings & kerbs`, `ساحة الحاويات Y${y}: العلامات والأرصفة`, 4, 'site', [`PAV-Y${y}P`], { el, crew: 20 });
  }
  for (let r = 1; r <= 3; r++) {
    const el = [`RD-${r}`];
    const nm: Array<[string, string]> = [['Main gate road & plaza', 'طريق البوابة الرئيسية والساحة'], ['Internal ring road', 'الطريق الدائري الداخلي'], ['Service & emergency road', 'طريق الخدمة والطوارئ']];
    b.task(`PAV-D${r}S`, 'PAV', `${nm[r - 1][0]}: earthworks`, `${nm[r - 1][1]}: الأعمال الترابية`, 10, 'site', ['DRG-MS3', 'MOB-190'], { el, crew: 35 });
    b.task(`PAV-D${r}P`, 'PAV', `${nm[r - 1][0]}: asphalt paving`, `${nm[r - 1][1]}: رصف الأسفلت`, 12, 'site', [`PAV-D${r}S`], { el, crew: 40 });
  }
  b.task('PAV-DR1', 'PAV', 'Storm drainage network & outfalls', 'شبكة تصريف مياه الأمطار والمخارج', 40, 'site', ['DRG-MS3', 'MOB-190'], { el: ['YRD-1', 'YRD-2'], crew: 35 });
  b.task('PAV-DR2', 'PAV', 'Oil-water separators & treatment', 'فواصل الزيت والماء ومعالجتها', 25, 'site', ['PAV-DR1'], { crew: 25 });
  b.task('PAV-DR3', 'PAV', 'Apron trench drains & cable ducts', 'قنوات تصريف الرصيف ومجاري الكابلات', 30, 'site', ['PAV-A1B'], { el: ['APR-1', 'APR-3'], crew: 30 });
  b.ms('PAV-MS1', 'PAV', 'Apron & yard pavements complete', 'اكتمال أرصفة وساحات الميناء', ['PAV-A1P', 'PAV-A2P', 'PAV-A3P', 'PAV-A4P', 'PAV-A5P', 'PAV-Y1M', 'PAV-Y2M', 'PAV-Y3M', 'PAV-Y4M', 'PAV-Y5M', 'PAV-Y6M', 'PAV-D1P', 'PAV-D2P', 'PAV-D3P', 'PAV-DR2', 'EQP-AS']);

  // =========================================================================================== BLD
  const bld: Array<{ id: string; el: string; en: string; ar: string; startPred: PredSpec[]; scale: number }> = [
    { id: 'GH', el: 'BLD-GATE', en: 'Gatehouse & truck inspection canopy', ar: 'غرفة البوابة ومظلة فحص الشاحنات', startPred: ['PAV-D1S', 'MOB-200'], scale: 0.8 },
    { id: 'AD', el: 'BLD-ADMIN', en: 'Administration & operations building', ar: 'مبنى الإدارة والعمليات', startPred: ['DRG-MS3', 'MOB-200'], scale: 1.4 },
    { id: 'WK', el: 'BLD-WORK', en: 'Maintenance workshop & stores', ar: 'ورشة الصيانة والمخازن', startPred: ['DRG-MS3', 'MOB-200'], scale: 1 },
    { id: 'SB', el: 'BLD-SUB', en: 'Main electrical substation', ar: 'المحطة الكهربائية الرئيسية', startPred: ['DRG-MS3', 'MOB-200'], scale: 1.1 },
    { id: 'RF', el: 'BLD-REEF', en: 'Reefer stack & cold-chain facility', ar: 'مرفق التبريد والحاويات المبردة', startPred: ['PAV-Y3B', 'MOB-200'], scale: 1 },
    { id: 'FS', el: 'BLD-FIRE', en: 'Fire station & first response', ar: 'محطة الإطفاء والاستجابة الأولية', startPred: ['PAV-D2S', 'MOB-200'], scale: 0.7 },
    { id: 'FL', el: 'BLD-FUEL', en: 'Fuel & bunkering station', ar: 'محطة الوقود والتزود', startPred: ['PAV-D2S', 'MOB-200'], scale: 0.6 },
    { id: 'WH', el: 'BLD-WH', en: 'Customs inspection shed & warehouse', ar: 'مستودع التفتيش الجمركي', startPred: ['PAV-Y2B', 'MOB-200'], scale: 1.1 },
  ];
  for (const x of bld) {
    const s = x.scale;
    const el = [x.el];
    b.task(`BLD-${x.id}F`, 'BLD', `${x.en}: foundations`, `${x.ar}: الأساسات`, Math.round(15 * s), 'site', x.startPred, { el, crew: 30 });
    b.task(`BLD-${x.id}S`, 'BLD', `${x.en}: structure`, `${x.ar}: الهيكل الإنشائي`, Math.round(32 * s), 'site', [`BLD-${x.id}F`], { el, crew: 45 });
    b.task(`BLD-${x.id}E`, 'BLD', `${x.en}: envelope & roofing`, `${x.ar}: الغلاف والأسقف`, Math.round(22 * s), 'site', [`BLD-${x.id}S`], { el, crew: 35 });
    b.task(`BLD-${x.id}M`, 'BLD', `${x.en}: MEP first & second fix`, `${x.ar}: الأعمال الكهروميكانيكية`, Math.round(35 * s), 'indoor', [[`BLD-${x.id}E`, 'SS', 10]], { el, crew: 35 });
    b.task(`BLD-${x.id}X`, 'BLD', `${x.en}: finishes & fit-out`, `${x.ar}: التشطيبات والتجهيز`, Math.round(28 * s), 'indoor', [`BLD-${x.id}M`], { el, crew: 30 });
  }
  b.del('DEL-HVAC', 'BLD', 'Delivery: HVAC chillers & air handlers', 'التوريد: مبردات المياه ووحدات معالجة الهواء', 'PO-024', ['BLD-ADE']);
  b.del('DEL-LIFT', 'BLD', 'Delivery: lifts & escalators', 'التوريد: المصاعد والسلالم المتحركة', 'PO-025', ['BLD-ADS']);
  b.task('BLD-HV1', 'BLD', 'HVAC plant installation & balancing', 'تركيب وموازنة أنظمة التكييف', 30, 'indoor', ['DEL-HVAC', 'BLD-ADE', 'BLD-WKE'], { el: ['BLD-ADMIN', 'BLD-WORK'], crew: 25 });
  b.task('BLD-LF1', 'BLD', 'Lift installation & certification', 'تركيب المصاعد واعتمادها', 25, 'indoor', ['DEL-LIFT', 'BLD-ADS'], { el: ['BLD-ADMIN'], crew: 12 });
  b.task('BLD-SB1', 'BLD', 'Substation: MV switchgear & transformer installation', 'المحطة: تركيب مفاتيح الجهد المتوسط والمحولات', 40, 'indoor', [['BLD-SBE', 'FS', 0, { type: 'SS', lagDays: 22, label: bi('Start switchgear installation once the envelope is watertight', 'بدء تركيب مفاتيح التوزيع فور إحكام غلاف المبنى') }], 'DEL-MVSG', 'DEL-TRF'], { el: ['BLD-SUB'], crew: 25 });
  b.task('BLD-SB2', 'BLD', 'Substation: testing, protection & energisation', 'المحطة: الاختبار والحماية والتغذية بالكهرباء', 12, 'indoor', ['BLD-SB1'], { el: ['BLD-SUB'], crew: 15 });
  b.del('DEL-MVSG', 'BLD', 'Delivery: MV/LV switchgear', 'التوريد: مفاتيح الجهد المتوسط والمنخفض', 'PO-018', ['MOB-200']);
  b.del('DEL-TRF', 'BLD', 'Delivery: power transformers', 'التوريد: محولات القدرة', 'PO-019', ['MOB-200']);
  b.del('DEL-CABLE', 'BLD', 'Delivery: MV/LV cables', 'التوريد: كابلات الجهد المتوسط والمنخفض', 'PO-020', ['MOB-200']);
  // utilities
  const util: Array<[string, string, string, number, PredSpec[]]> = [
    ['U1', 'Potable & fire-water network', 'شبكة مياه الشرب والإطفاء', 45, ['PAV-DR1']],
    ['U2', 'Sewerage & sewage treatment', 'الصرف الصحي ومحطة المعالجة', 50, ['PAV-DR1']],
    ['U3', 'HV/MV duct bank & cable pulling', 'مجاري الكابلات وسحب الكابلات', 40, ['PAV-DR3']],
    ['U4', 'Fibre-optic backbone & OT network', 'الشبكة الضوئية وشبكة التشغيل', 30, ['PAV-DR3']],
    ['U5', 'Potable water storage tanks', 'خزانات مياه الشرب', 35, ['DRG-MS3', 'MOB-200']],
    ['U6', 'Standby generation plant', 'محطة التوليد الاحتياطية', 28, ['BLD-SBF']],
  ];
  for (const [id, en, ar, d, p] of util) b.task(`BLD-${id}`, 'BLD', en, ar, d, 'site', p, { crew: 30 });
  b.task('BLD-U7', 'BLD', 'LV cabling to buildings & yard', 'كابلات الجهد المنخفض للمباني والساحات', 40, 'site', ['BLD-U3', 'DEL-CABLE', 'BLD-SB2'], { crew: 30 });
  b.ms('BLD-MS1', 'BLD', 'Buildings & utilities complete', 'اكتمال المباني والمرافق', ['BLD-ADX', 'BLD-WKX', 'BLD-GHX', 'BLD-SBX', 'BLD-RFX', 'BLD-FSX', 'BLD-FLX', 'BLD-WHX', 'BLD-HV1', 'BLD-LF1', 'BLD-U1', 'BLD-U2', 'BLD-U4', 'BLD-U5', 'BLD-U6', 'BLD-U7', 'EQP-CL']);

  // =========================================================================================== EQP
  b.del('DEL-FEND1', 'EQP', 'Delivery: super-cone fenders lot 1', 'التوريد: مصدّات الرصيف - الدفعة 1', 'PO-008', ['MOB-210']);
  b.del('DEL-FEND2', 'EQP', 'Delivery: super-cone fenders lot 2 & panels', 'التوريد: مصدّات الرصيف - الدفعة 2 والألواح', 'PO-009', ['MOB-210']);
  b.del('DEL-RAIL', 'EQP', 'Delivery: crane rails, clips & pads', 'التوريد: سكك الرافعات والمثبتات', 'PO-010', ['MOB-210']);
  b.del('DEL-BOLL', 'EQP', 'Delivery: bollards & quay furniture', 'التوريد: الأعمدة الرابطة وتجهيزات الرصيف', 'PO-011', ['MOB-210']);
  b.del('DEL-STSA', 'EQP', 'Delivery: STS cranes 1-2 (heavy-lift vessel)', 'التوريد: رافعات الرصيف 1-2 (سفينة الأوزان الثقيلة)', 'PO-012', ['MOB-210']);
  b.del('DEL-STSB', 'EQP', 'Delivery: STS cranes 3-4 (heavy-lift vessel)', 'التوريد: رافعات الرصيف 3-4 (سفينة الأوزان الثقيلة)', 'PO-013', ['MOB-210']);
  b.del('DEL-MHC', 'EQP', 'Delivery: mobile harbour crane', 'التوريد: رافعة الميناء المتنقلة', 'PO-014', ['MOB-210']);
  b.del('DEL-RS', 'EQP', 'Delivery: reach stackers & terminal tractors', 'التوريد: الرافعات الجانبية وجرارات المحطة', 'PO-015', ['PAV-Y2P']);
  b.del('DEL-MAST', 'EQP', 'Delivery: high-mast lighting & LED luminaires', 'التوريد: أعمدة الإنارة العالية ومصابيح LED', 'PO-016', ['MOB-200']);
  b.del('DEL-REEFS', 'EQP', 'Delivery: reefer sockets & monitoring', 'التوريد: مقابس الحاويات المبردة والمراقبة', 'PO-017', ['MOB-200']);
  b.del('DEL-CCTV', 'EQP', 'Delivery: CCTV, PIDS & access-control hardware', 'التوريد: كاميرات المراقبة وأنظمة التحكم بالدخول', 'PO-021', ['MOB-200']);
  b.del('DEL-NAV', 'EQP', 'Delivery: navigation aids & berthing aids', 'التوريد: وسائل الملاحة والرسو', 'PO-022', ['MOB-210']);
  b.del('DEL-TOS', 'EQP', 'Delivery: terminal operating system servers', 'التوريد: خوادم نظام تشغيل المحطة', 'PO-023', ['MOB-200']);
  b.del('DEL-GEN', 'EQP', 'Delivery: standby generators', 'التوريد: المولدات الاحتياطية', 'PO-026', ['MOB-200']);
  b.del('DEL-FIRE', 'EQP', 'Delivery: fire-fighting equipment & foam systems', 'التوريد: معدات مكافحة الحريق وأنظمة الرغوة', 'PO-027', ['MOB-200']);
  b.del('DEL-CLAD', 'EQP', 'Delivery: cladding panels & doors', 'التوريد: ألواح الكسوة والأبواب', 'PO-028', ['BLD-ADS']);
  b.del('DEL-STEEL', 'EQP', 'Delivery: structural steel for buildings', 'التوريد: الحديد الإنشائي للمباني', 'PO-029', ['MOB-200']);
  b.del('DEL-ASPH', 'EQP', 'Delivery: asphalt & bitumen supply contract', 'التوريد: عقد توريد الأسفلت والبيتومين', 'PO-030', ['MOB-190']);
  for (let g = 1; g <= 5; g++) {
    const lot = g <= 3 ? 'DEL-FEND1' : 'DEL-FEND2';
    b.task(`EQP-F${g}`, 'EQP', `Fender installation: berth section ${g}`, `تركيب المصدّات: قسم الرصيف ${g}`, 10, 'crane', [`QW-K${pad(2 * g)}`, lot, ...(g > 1 ? ([[`EQP-F${g - 1}`, 'SS', 6]] as PredSpec[]) : [])], { assets: ['CC-01', 'BRG-02'], el: [`FND-${g}`], crew: 30 });
  }
  for (let j = 1; j <= 3; j++) {
    b.task(`EQP-B${j}`, 'EQP', `Bollards & quay furniture: group ${j}`, `الأعمدة الرابطة وتجهيزات الرصيف: المجموعة ${j}`, 6, 'crane', [`QW-K${pad(j === 1 ? 4 : j === 2 ? 7 : 10)}`, 'DEL-BOLL'], { assets: ['CC-01'], el: [`CAP-${pad(j === 1 ? 4 : j === 2 ? 7 : 10)}`], crew: 25 });
  }
  const rg = [3, 5, 8, 10];
  for (let j = 1; j <= 4; j++) {
    const rbPred: PredSpec =
      j === 4
        ? ['QW-RB10', 'FS', 0, { type: 'SS', lagDays: 9, label: bi('Install rails on cured beam sections while the last beams finish', 'تركيب السكك على مقاطع الكمرات المعالجة أثناء إنهاء آخر الكمرات') }]
        : `QW-RB${pad(rg[j - 1])}`;
    b.task(`EQP-R${j}`, 'EQP', `Crane rail installation & alignment: section ${j}`, `تركيب ومحاذاة سكة الرافعات: القسم ${j}`, 12, 'crane', [rbPred, ...(j === 4 ? (['DEL-RAIL'] as PredSpec[]) : []), ...(j === 1 ? (['MOB-210'] as PredSpec[]) : []), ...(j > 1 ? ([[`EQP-R${j - 1}`, 'SS', 5]] as PredSpec[]) : [])], { assets: ['CC-01', 'CC-02'], el: [`RAIL-${j}`], crew: 35 });
  }
  b.task('EQP-RS', 'EQP', 'Rail survey, grounding & power-feed trench', 'مسح السكك والتأريض وخندق التغذية', 14, 'site', ['EQP-R4', 'PAV-A5B'], { el: ['RAIL-4'], crew: 25 });
  // heavy-lift vessels berth at the new quay to roll the cranes off: needs fenders, bollards, rails and a trimmed berth
  b.task('EQP-HLA', 'EQP', 'STS cranes 1-2: heavy-lift vessel berthing & discharge', 'رافعات الرصيف 1-2: رسو سفينة الأوزان الثقيلة والتفريغ', 6, 'marine', ['DEL-STSA', 'EQP-F1', 'EQP-F2', 'EQP-F3', 'EQP-B1', 'EQP-R2', ['EQP-RS', 'FS', 0, { type: 'SS', lagDays: 12, label: bi('Berth the heavy-lift vessel while rail survey completes', 'رسو سفينة الأوزان الثقيلة أثناء إنهاء مسح السكك') }]], { assets: ['TUG-01'], el: ['STS-1', 'STS-2'], crew: 40 });
  b.task('EQP-HLB', 'EQP', 'STS cranes 3-4: heavy-lift vessel berthing & discharge', 'رافعات الرصيف 3-4: رسو سفينة الأوزان الثقيلة والتفريغ', 6, 'marine', ['DEL-STSB', 'EQP-F4', 'EQP-F5', 'EQP-B3', 'EQP-R4', 'EQP-HLA', ['EQP-ST2', 'SS', 10]], { assets: ['TUG-01'], el: ['STS-3', 'STS-4'], crew: 40 });
  const sts = [1, 2, 3, 4];
  for (const n of sts) {
    const pre: PredSpec[] = [n <= 2 ? (n === 1 ? (['EQP-HLA', 'FS', 0, { type: 'SS', lagDays: 5, label: bi('Start erection as the first crane rolls off', 'بدء التركيب فور إنزال أول رافعة') }] as PredSpec) : 'EQP-HLA') : 'EQP-HLB'];
    if (n > 1) pre.push([`EQP-ST${n - 1}`, 'SS', 15]);
    b.task(`EQP-ST${n}`, 'EQP', `STS crane ${n}: erection & alignment`, `رافعة الرصيف ${n}: التركيب والمحاذاة`, 42, 'crane', pre, { assets: ['CC-01', 'CC-02', 'MHC-01'], el: [`STS-${n}`], crew: 60, w: 12 });
    b.task(`EQP-SC${n}`, 'EQP', `STS crane ${n}: electrical commissioning & load test`, `رافعة الرصيف ${n}: التشغيل الكهربائي واختبار الحمل`, 36, 'site', [`EQP-ST${n}`, 'BLD-SB2'], { el: [`STS-${n}`], crew: 30, w: 8 });
  }
  b.task('EQP-MH', 'EQP', 'Mobile harbour crane: acceptance & commissioning', 'رافعة الميناء المتنقلة: القبول والتشغيل', 20, 'site', ['DEL-MHC', 'PAV-A2P'], { el: [], crew: 15 });
  b.task('EQP-YR', 'EQP', 'Reach stackers & tractors: acceptance & operator handover', 'الرافعات الجانبية والجرارات: القبول والتسليم', 8, 'site', ['DEL-RS', 'PAV-Y2M'], { crew: 12 });
  for (let j = 1; j <= 3; j++) {
    b.task(`EQP-M${j}`, 'EQP', `High-mast lighting erection: group ${j}`, `تركيب أعمدة الإنارة العالية: المجموعة ${j}`, 12, 'crane', ['DEL-MAST', j === 1 ? 'PAV-A3P' : j === 2 ? 'PAV-Y2P' : 'PAV-Y5P', ...(j > 1 ? ([[`EQP-M${j - 1}`, 'SS', 5]] as PredSpec[]) : [])], { assets: ['CC-01'], el: [`MAST-${j}`], crew: 28 });
  }
  b.task('EQP-ML', 'EQP', 'Lighting controls, aiming & lux survey', 'ضبط الإنارة وفحص الإضاءة', 10, 'site', ['EQP-M1', 'EQP-M2', 'EQP-M3', 'BLD-U7'], { el: ['MAST-3'], crew: 15 });
  b.task('EQP-RE', 'EQP', 'Reefer sockets installation & monitoring', 'تركيب مقابس الحاويات المبردة والمراقبة', 20, 'site', ['DEL-REEFS', 'BLD-RFX', 'PAV-Y3P'], { crew: 20 });
  b.task('EQP-NV', 'EQP', 'Navigation & berthing aids installation', 'تركيب وسائل الملاحة والرسو', 14, 'marine', ['DEL-NAV', 'BW-A3', 'EQP-F5'], { crew: 15 });
  b.task('EQP-IT1', 'EQP', 'CCTV, PIDS & access-control installation', 'تركيب كاميرات المراقبة والتحكم بالدخول', 35, 'indoor', ['DEL-CCTV', 'BLD-U4', 'BLD-GHE'], { crew: 15 });
  b.task('EQP-IT2', 'EQP', 'Terminal operating system build & integration', 'بناء ودمج نظام تشغيل المحطة', 70, 'indoor', ['DEL-TOS', 'BLD-U4'], { crew: 20 });
  b.task('EQP-IT3', 'EQP', 'Gate OCR & automatic gate system', 'نظام البوابات الآلية وقراءة اللوحات', 25, 'indoor', ['EQP-IT1', 'PAV-D1P'], { crew: 12 });
  b.task('EQP-GN', 'EQP', 'Standby generators: installation & load bank test', 'المولدات الاحتياطية: التركيب واختبار الحمل', 20, 'site', ['DEL-GEN', 'BLD-U6'], { assets: ['GEN-01', 'GEN-02'], crew: 12 });
  b.task('EQP-FF', 'EQP', 'Fire-fighting systems installation & testing', 'تركيب واختبار أنظمة مكافحة الحريق', 30, 'indoor', ['DEL-FIRE', 'BLD-U1', 'BLD-FSE'], { crew: 15 });
  b.task('EQP-CL', 'EQP', 'Cladding & steel erection support (buildings)', 'دعم تركيب الكسوة والحديد الإنشائي', 20, 'site', ['DEL-CLAD', 'DEL-STEEL', 'BLD-ADS'], { assets: ['TC-01', 'TC-02'], crew: 25 });
  b.task('EQP-AS', 'EQP', 'Asphalt supply & placement support', 'دعم توريد ورصف الأسفلت', 15, 'site', ['DEL-ASPH', 'PAV-D1S'], { crew: 15 });
  b.ms('EQP-MS1', 'EQP', 'Port equipment installed & commissioned', 'اكتمال تركيب وتشغيل معدات الميناء', ['EQP-SC1', 'EQP-SC2', 'EQP-SC3', 'EQP-SC4', 'EQP-MH', 'EQP-YR', 'EQP-ML', 'EQP-RE', 'EQP-NV', 'EQP-IT2', 'EQP-IT3', 'EQP-GN', 'EQP-FF', 'EQP-F1', 'EQP-F2', 'EQP-F3', 'EQP-F4', 'EQP-F5', 'EQP-B1', 'EQP-B2', 'EQP-B3']);

  // =========================================================================================== COM
  b.task('COM-01', 'COM', 'Integrated power-on & systems energisation', 'التشغيل المتكامل وتغذية الأنظمة بالكهرباء', 10, 'indoor', ['EQP-MS1', 'BLD-MS1']);
  b.task('COM-02', 'COM', 'Integrated systems testing (crane + TOS + gate)', 'اختبار الأنظمة المتكاملة (رافعات + نظام التشغيل + البوابات)', 55, 'indoor', ['COM-01', 'EQP-IT3']);
  b.task('COM-03', 'COM', 'Operator & maintenance staff training', 'تدريب المشغلين وفرق الصيانة', 30, 'indoor', ['EQP-SC1'], { crew: 20 });
  b.task('COM-04', 'COM', 'Marine trials: dredged depth & basin verification', 'التجارب البحرية: التحقق من العمق والحوض', 8, 'marine', ['DRG-MS1', 'EQP-NV']);
  b.task('COM-05', 'COM', 'Civil defence, HSE & port-authority inspections', 'تفتيش الدفاع المدني والسلامة وهيئة الميناء', 40, 'indoor', ['COM-01', 'EQP-FF']);
  b.task('COM-06', 'COM', 'Mock vessel operation (dry run)', 'التشغيل التجريبي لسفينة (محاكاة)', 25, 'marine', ['COM-02', 'COM-04', 'COM-03']);
  b.task('COM-07', 'COM', 'Trial berthing & first call readiness review', 'الرسو التجريبي ومراجعة الجاهزية لأول سفينة', 10, 'marine', ['COM-06', 'COM-05']);
  b.task('COM-08', 'COM', 'Snagging & defects rectification', 'معالجة الملاحظات والعيوب', 60, 'site', ['COM-02', 'PAV-MS1'], { crew: 40 });
  b.task('COM-09', 'COM', 'As-built drawings, O&M manuals & digital handover', 'مخططات التنفيذ وأدلة التشغيل والتسليم الرقمي', 40, 'indoor', ['COM-01']);
  b.task('COM-10', 'COM', 'Asset register & spare-parts handover', 'سجل الأصول وتسليم قطع الغيار', 15, 'indoor', ['COM-09']);
  b.task('COM-13', 'COM', 'Trial operations with live vessels (regulatory period)', 'التشغيل التجريبي بسفن حقيقية (الفترة التنظيمية)', 70, 'marine', ['COM-07']);
  b.task('COM-11', 'COM', 'Operational readiness & performance guarantee tests', 'الجاهزية التشغيلية واختبارات ضمان الأداء', 40, 'indoor', ['COM-13', 'COM-08']);
  b.ms('COM-MS1', 'COM', 'Taking-over certificate', 'شهادة الاستلام', ['COM-11', 'COM-10', 'MAR-MS2', 'DRG-MS2', 'QW-MS1']);
  b.task('COM-12', 'COM', 'Handover to terminal operator', 'التسليم لمشغل المحطة', 10, 'indoor', ['COM-MS1']);
  b.ms('COM-MS2', 'COM', 'Project complete / start of defects liability period', 'اكتمال المشروع / بدء فترة ضمان العيوب', ['COM-12']);

  // ------------------------------------------------------------------ budgets
  const acts = b.acts;
  const sums = new Map<string, number>();
  for (const a of acts) sums.set(a.wbsId, (sums.get(a.wbsId) ?? 0) + (b.weights.get(a.id) ?? 0));
  for (const a of acts) {
    const w = b.weights.get(a.id) ?? 0;
    const s = sums.get(a.wbsId) ?? 1;
    a.budget = Math.round(((SHARE[a.wbsId] ?? 0) * bac * w) / s / 1000) * 1000;
  }
  return acts;
}
