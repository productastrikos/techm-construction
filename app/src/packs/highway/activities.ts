// Highway pack: E611 corridor upgrade (28 km, 3+3 lanes, 1 interchange, 2 wadi bridges, 4 culverts). ILLUSTRATIVE.
import { Builder, type PredSpec } from '../port/activities';
import type { Activity } from '../../engine/types';

const SHARE: Record<string, number> = { MOB: 0.05, ERT: 0.2, STR: 0.3, PAV: 0.25, ITS: 0.14, COM: 0.06 };

export function buildHighwayActivities(bac: number): Activity[] {
  const b = new Builder();
  // ======================================================================== MOB
  b.ms('MOB-001', 'MOB', 'Notice to proceed', 'إشعار المباشرة', []);
  b.task('MOB-010', 'MOB', 'Mobilise team, camp & site offices', 'تجهيز الفريق والمعسكر والمكاتب', 15, 'site', ['MOB-001']);
  b.task('MOB-020', 'MOB', 'Topographic & utilities survey', 'المسح الطبوغرافي ومسح المرافق', 15, 'site', ['MOB-010']);
  b.task('MOB-030', 'MOB', 'Traffic management plan approvals', 'اعتماد خطة إدارة المرور', 30, 'indoor', ['MOB-001']);
  b.task('MOB-040', 'MOB', 'Utilities diversion: power', 'تحويل المرافق: الكهرباء', 30, 'site', ['MOB-020']);
  b.task('MOB-041', 'MOB', 'Utilities diversion: water & telecom', 'تحويل المرافق: المياه والاتصالات', 28, 'site', ['MOB-020']);
  b.task('MOB-050', 'MOB', 'Batching & asphalt plants erection', 'تركيب محطتي الخرسانة والأسفلت', 25, 'site', ['MOB-010'], { assets: ['BP-01'] });
  b.task('MOB-060', 'MOB', 'Temporary diversion roads', 'الطرق المؤقتة للتحويل', 25, 'site', ['MOB-030', 'MOB-020']);
  b.task('MOB-070', 'MOB', 'Design: road & drainage IFC', 'التصميم: الطرق والصرف للتنفيذ', 45, 'indoor', ['MOB-001']);
  b.task('MOB-080', 'MOB', 'Design: bridges & culverts IFC', 'التصميم: الجسور والعبّارات للتنفيذ', 70, 'indoor', ['MOB-001']);
  b.ms('MOB-090', 'MOB', 'Mobilisation complete', 'اكتمال التجهيز', ['MOB-010', 'MOB-050', 'MOB-060', 'MOB-040', 'MOB-041']);
  // deliveries
  b.del('DEL-GEO', 'ERT', 'Delivery: geotextile & geogrid', 'التوريد: الجيوتكستايل والشبكات', 'PO-H10');
  b.del('DEL-REB', 'STR', 'Delivery: rebar (domestic)', 'التوريد: حديد التسليح (محلي)', 'PO-H09');
  b.del('DEL-GIR1', 'STR', 'Delivery: precast girders bridge B1', 'التوريد: الكمرات الجاهزة للجسر B1', 'PO-H01');
  b.del('DEL-GIR2', 'STR', 'Delivery: precast girders bridge B2', 'التوريد: الكمرات الجاهزة للجسر B2', 'PO-H02');
  b.del('DEL-BRG', 'STR', 'Delivery: bearings & expansion joints', 'التوريد: المساند وفواصل التمدد', 'PO-H03');
  b.del('DEL-BIT', 'PAV', 'Delivery: bitumen supply contract', 'التوريد: عقد البيتومين', 'PO-H08');
  b.del('DEL-BAR', 'ITS', 'Delivery: steel crash barriers', 'التوريد: حواجز الحماية الفولاذية', 'PO-H04');
  b.del('DEL-POLE', 'ITS', 'Delivery: lighting poles & luminaires', 'التوريد: أعمدة ومصابيح الإنارة', 'PO-H05');
  b.del('DEL-ITS', 'ITS', 'Delivery: ITS equipment (CCTV, sensors)', 'التوريد: معدات النقل الذكي', 'PO-H06');
  b.del('DEL-VMS', 'ITS', 'Delivery: VMS & gantry signs', 'التوريد: لوحات الرسائل المتغيرة', 'PO-H07');

  // ======================================================================== ERT (7 segments)
  for (let k = 1; k <= 7; k++) {
    const el = [`EMB-${k}`];
    const cl: PredSpec[] = ['MOB-090', 'MOB-020'];
    if (k > 1) cl.push([`ERT-C${k - 1}`, 'SS', 8]);
    b.task(`ERT-C${k}`, 'ERT', `Segment S${k}: clearing & grubbing`, `المقطع S${k}: إزالة النباتات والتنظيف`, 6, 'site', cl, { assets: ['EX-01'], el, crew: 30 });
    const ef: PredSpec[] = [`ERT-C${k}`, 'MOB-070'];
    if (k <= 2) ef.push('DEL-GEO');
    if (k > 1) ef.push([`ERT-E${k - 1}`, 'SS', 14]);
    b.task(`ERT-E${k}`, 'ERT', `Segment S${k}: cut-to-fill earthworks`, `المقطع S${k}: أعمال القطع والردم`, 22, 'site', ef, { assets: k % 2 ? ['EX-01', 'DT-01', 'DT-02'] : ['EX-02', 'DT-02', 'DT-03'], el, crew: 55 });
    b.task(`ERT-G${k}`, 'ERT', `Segment S${k}: subgrade preparation`, `المقطع S${k}: تجهيز التربة التحتية`, 9, 'site', [`ERT-E${k}`], { assets: ['GR-01'], el, crew: 30 });
  }
  // ======================================================================== STR
  const bridge = (n: number, seg: number, pre: string) => {
    const bel = [`BR-${n}`];
    const pel = [`PIER-${n}`];
    b.task(`BR${n}-P`, 'STR', `Bridge B${n}: bored piles`, `الجسر B${n}: الخوازيق المحفورة`, 24, 'site', [`ERT-C${seg}`, 'MOB-080', 'DEL-REB'], { assets: ['PR-01'], el: pel, crew: 40 });
    b.task(`BR${n}-C`, 'STR', `Bridge B${n}: pile caps & abutments`, `الجسر B${n}: قبعات الخوازيق والدعامات`, 14, 'site', [`BR${n}-P`], { assets: ['BP-01'], el: pel, crew: 35 });
    b.task(`BR${n}-PR`, 'STR', `Bridge B${n}: piers`, `الجسر B${n}: الأعمدة`, 20, 'crane', [`BR${n}-C`], { assets: ['CC-01'], el: pel, crew: 35 });
    b.task(`BR${n}-G`, 'STR', `Bridge B${n}: girder launching`, `الجسر B${n}: رفع الكمرات`, 14, 'crane', [`BR${n}-PR`, pre, 'DEL-BRG'], { assets: ['CC-01'], el: bel, crew: 40 });
    b.task(`BR${n}-D`, 'STR', `Bridge B${n}: deck slab`, `الجسر B${n}: بلاطة السطح`, 18, 'site', [`BR${n}-G`], { assets: ['BP-01'], el: bel, crew: 45 });
    b.task(`BR${n}-F`, 'STR', `Bridge B${n}: parapets, joints & waterproofing`, `الجسر B${n}: الدرابزين والفواصل والعزل`, 12, 'site', [`BR${n}-D`], { el: bel, crew: 30 });
    b.task(`BR${n}-A`, 'STR', `Bridge B${n}: approach slabs`, `الجسر B${n}: بلاطات الاقتراب`, 8, 'site', [`BR${n}-F`], { el: bel, crew: 25 });
  };
  bridge(1, 2, 'DEL-GIR1');
  bridge(2, 5, 'DEL-GIR2');
  [1, 2, 3, 4].forEach((c) => {
    const seg = c === 1 ? 1 : c === 2 ? 3 : c === 3 ? 4 : 6;
    const el = [`CUL-${c}`];
    b.task(`CUL${c}-E`, 'STR', `Culvert C${c}: excavation & bedding`, `العبّارة C${c}: الحفر والفرشة`, 6, 'site', [`ERT-C${seg}`], { assets: ['EX-02'], el, crew: 20 });
    b.task(`CUL${c}-I`, 'STR', `Culvert C${c}: precast box installation`, `العبّارة C${c}: تركيب الصناديق الجاهزة`, 8, 'crane', [`CUL${c}-E`, 'DEL-REB'], { assets: ['CC-01'], el, crew: 20 });
    b.task(`CUL${c}-H`, 'STR', `Culvert C${c}: headwalls & backfill`, `العبّارة C${c}: الجدران الأمامية والردم`, 7, 'site', [`CUL${c}-I`], { el, crew: 20 });
  });
  // interchange
  b.task('INT-E', 'STR', 'Interchange: ramp earthworks', 'التقاطع: أعمال ترابية للمنحدرات', 25, 'site', ['ERT-E3', 'MOB-070'], { assets: ['EX-02', 'DT-03'], el: ['RAMP-1', 'RAMP-2'], crew: 45 });
  b.task('INT-P', 'STR', 'Interchange: ramp paving', 'التقاطع: رصف المنحدرات', 18, 'site', ['INT-E', 'DEL-BIT'], { assets: ['PV-01', 'RL-01'], el: ['RAMP-1', 'RAMP-2'], crew: 40 });
  // ======================================================================== PAV (segments)
  for (let k = 1; k <= 7; k++) {
    const el = [`RD-${k}`];
    const struct: PredSpec[] = k === 2 ? ['BR1-A'] : k === 5 ? ['BR2-A'] : [];
    const culs = k === 1 ? ['CUL1-H'] : k === 3 ? ['CUL2-H'] : k === 4 ? ['CUL3-H'] : k === 6 ? ['CUL4-H'] : [];
    const sb: PredSpec[] = [`ERT-G${k}`, ...struct, ...culs];
    if (k > 1) sb.push([`PAV-S${k - 1}`, 'SS', 8]);
    b.task(`PAV-S${k}`, 'PAV', `Segment S${k}: subbase`, `المقطع S${k}: الطبقة التحتية`, 9, 'site', sb, { assets: ['GR-01', 'RL-01'], el, crew: 40 });
    b.task(`PAV-B${k}`, 'PAV', `Segment S${k}: base course`, `المقطع S${k}: الطبقة الأساسية`, 9, 'site', [`PAV-S${k}`, ...(k > 1 ? ([[`PAV-B${k - 1}`, 'SS', 8]] as PredSpec[]) : [])], { assets: ['RL-01', 'DT-01'], el, crew: 40 });
    b.task(`PAV-I${k}`, 'PAV', `Segment S${k}: asphalt binder course`, `المقطع S${k}: طبقة الأسفلت الرابطة`, 8, 'site', [`PAV-B${k}`, 'DEL-BIT', ...(k > 1 ? ([[`PAV-I${k - 1}`, 'SS', 8]] as PredSpec[]) : [])], { assets: ['PV-01', 'RL-01'], el, crew: 45 });
    b.task(`PAV-W${k}`, 'PAV', `Segment S${k}: wearing course & markings`, `المقطع S${k}: طبقة التآكل والعلامات`, 7, 'site', [`PAV-I${k}`, ...(k > 1 ? ([[`PAV-W${k - 1}`, 'SS', 8]] as PredSpec[]) : [])], { assets: ['PV-01', 'RL-01'], el, crew: 45 });
  }
  // ======================================================================== ITS
  for (let g = 1; g <= 4; g++) b.task(`ITS-D${g}`, 'ITS', `Drainage & ditches: group ${g}`, `الصرف والخنادق: المجموعة ${g}`, 16, 'site', [`PAV-B${g * 2 - 1}`], { assets: ['EX-02'], el: [`RD-${g * 2 - 1}`], crew: 30 });
  for (let g = 1; g <= 3; g++) {
    b.task(`ITS-L${g}`, 'ITS', `Lighting poles installation: group ${g}`, `تركيب أعمدة الإنارة: المجموعة ${g}`, 10, 'crane', ['DEL-POLE', `PAV-I${g * 2}`], { assets: ['CC-01'], el: [`LIGHT-${g}`], crew: 25 });
  }
  b.task('ITS-B1', 'ITS', 'Crash barriers & guardrails', 'حواجز الحماية والدرابزين', 24, 'site', ['DEL-BAR', 'PAV-W3'], { crew: 30 });
  b.task('ITS-S1', 'ITS', 'Gantry signs & VMS', 'اللوحات الإرشادية ولوحات الرسائل المتغيرة', 14, 'crane', ['DEL-VMS', 'PAV-W5'], { assets: ['CC-01'], crew: 20 });
  b.task('ITS-C1', 'ITS', 'ITS cabling, CCTV & sensors', 'كابلات النقل الذكي والكاميرات والحساسات', 28, 'site', ['DEL-ITS', 'ITS-D2'], { crew: 25 });
  b.task('ITS-C2', 'ITS', 'ITS integration & traffic-control centre link', 'دمج النقل الذكي وربط مركز التحكم', 20, 'indoor', ['ITS-C1', 'ITS-S1'], { crew: 15 });
  // ======================================================================== COM
  b.task('COM-01', 'COM', 'Bridge load tests', 'اختبارات تحميل الجسور', 12, 'site', ['BR1-A', 'BR2-A']);
  b.task('COM-02', 'COM', 'Road safety audit & lighting survey', 'تدقيق السلامة المرورية ومسح الإنارة', 10, 'indoor', ['PAV-W7', 'ITS-L3', 'ITS-B1']);
  b.task('COM-03', 'COM', 'Traffic switch-over & trial operation', 'تحويل المرور والتشغيل التجريبي', 14, 'site', ['COM-01', 'COM-02', 'ITS-C2', 'INT-P']);
  b.task('COM-04', 'COM', 'Snagging & as-built handover', 'معالجة الملاحظات وتسليم مخططات التنفيذ', 30, 'indoor', ['COM-03', 'ITS-D4']);
  b.ms('COM-MS', 'COM', 'Opening to traffic / project complete', 'الافتتاح للمرور / اكتمال المشروع', ['COM-04']);
  for (const a of b.acts.filter((x) => x.kind === 'task')) if (!b.acts.some((y) => y.preds.some((p) => p.id === a.id)) && a.id !== 'COM-04') b.acts.find((x) => x.id === 'COM-04')!.preds.push({ id: a.id, type: 'FS', lagHrs: 0 });
  // budgets
  const sums = new Map<string, number>();
  for (const a of b.acts) sums.set(a.wbsId, (sums.get(a.wbsId) ?? 0) + (b.weights.get(a.id) ?? 0));
  for (const a of b.acts) a.budget = Math.round(((SHARE[a.wbsId] ?? 0) * bac * (b.weights.get(a.id) ?? 0)) / (sums.get(a.wbsId) || 1) / 1000) * 1000;
  return b.acts;
}
