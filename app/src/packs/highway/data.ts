// Highway pack data: config, WBS, materials, PO seeds, fleet and 3D scene layout. ILLUSTRATIVE (fictional suppliers).
import { bi } from '../../lib/bi';
import { ymdToT } from '../../engine/dates';
import type { Asset, AssetType, Material, PackConfig, SceneElement, WbsNode, FleetVis, Supplier } from '../../engine/types';
import type { PoSeed } from '../port/materials';
import { channelsFor } from '../port/assets';

const T = ymdToT;

export const highwayConfig: PackConfig = {
  id: 'highway',
  name: bi('E611 Corridor Upgrade', 'تطوير ممر الطريق E611'),
  subtitle: bi('28 km 3+3 lane widening with interchange and two wadi bridges (illustrative)', 'توسعة 28 كم بثلاث حارات لكل اتجاه مع تقاطع وجسرين (توضيحي)'),
  code: 'E611-UPG-01',
  location: { lat: 25.3, lon: 56.2, label: bi('Coastal corridor (illustrative)', 'ممر ساحلي (توضيحي)') },
  startT: 0,
  baselineFinishT: T(2027, 11, 23), // matches the CPM baseline (programme is ~13 months)
  nowT: T(2027, 1, 15) + 8 / 24,
  bacAED: 640_000_000,
  contingencyPct: 0.06,
  retentionPct: 0.1,
  advancePct: 0.1,
  ldPerDay: 45_000,
  ldCapPct: 0.1,
  prolongationPerDay: 26_000,
  cpiByWbs: { MOB: 1.0, ERT: 0.97, STR: 0.96, PAV: 1.0, ITS: 1.0, COM: 1.0 },
  kpiSeed: { ltifr: 0.51, daysSinceLti: 74, manpower: 410, manhoursMonth: 96_000, openRisks: 14 },
  vocab: { site: bi('Corridor', 'الممر'), asset: bi('Plant', 'المعدات'), milestone: bi('Milestone', 'معلم') },
  sceneKind: 'highway',
};

export const highwayWbs: WbsNode[] = [
  { id: 'MOB', name: bi('Mobilisation & utilities', 'التجهيز وتحويل المرافق'), color: '#7dd3fc' },
  { id: 'ERT', name: bi('Earthworks', 'الأعمال الترابية'), color: '#facc15' },
  { id: 'STR', name: bi('Bridges, culverts & interchange', 'الجسور والعبّارات والتقاطع'), color: '#3ee0b0' },
  { id: 'PAV', name: bi('Pavement', 'الرصف'), color: '#94a3b8' },
  { id: 'ITS', name: bi('Drainage, lighting & ITS', 'الصرف والإنارة والنقل الذكي'), color: '#fb923c' },
  { id: 'COM', name: bi('Testing & opening', 'الاختبار والافتتاح'), color: '#f472b6' },
];

const m = (id: string, en: string, ar: string, cls: Material['cls'], unit: string, origin: Material['origin'], exposure: number, lead: number): Material => ({ id, name: bi(en, ar), cls, unit, origin, exposure, leadTimeDays: lead });
export const highwayMaterials: Material[] = [
  m('H-AGG', 'Road aggregates', 'ركام الطرق', 'domestic-bulk', 't', 'AE', 0.05, 5),
  m('H-ASPH', 'Asphalt mix', 'خليط الأسفلت', 'domestic-bulk', 't', 'AE', 0.1, 3),
  m('H-BIT', 'Bitumen', 'البيتومين', 'domestic-bulk', 't', 'AE', 0.15, 10),
  m('H-CEM', 'Cement & concrete', 'الإسمنت والخرسانة', 'domestic-bulk', 't', 'AE', 0.08, 7),
  m('H-REB', 'Reinforcement steel', 'حديد التسليح', 'domestic-bulk', 't', 'AE', 0.1, 14),
  m('H-GIR', 'Precast bridge girders', 'كمرات الجسور الجاهزة', 'imported-long-lead', 'lot', 'TR', 0.85, 120),
  m('H-BRG', 'Bearings & expansion joints', 'المساند وفواصل التمدد', 'imported-long-lead', 'lot', 'EU', 0.9, 110),
  m('H-ITS', 'ITS equipment (CCTV, detectors)', 'معدات النقل الذكي', 'imported-long-lead', 'lot', 'EU', 0.75, 100),
  m('H-VMS', 'VMS & gantry signs', 'لوحات الرسائل المتغيرة', 'imported-long-lead', 'lot', 'CN', 0.75, 90),
  m('H-POLE', 'Lighting poles & luminaires', 'أعمدة ومصابيح الإنارة', 'imported-long-lead', 'lot', 'CN', 0.7, 80),
  m('H-BAR', 'Steel crash barriers', 'حواجز الحماية الفولاذية', 'imported-standard', 'km', 'IN', 0.5, 60),
  m('H-GEO', 'Geotextile & geogrid', 'الجيوتكستايل والشبكات', 'imported-standard', 'm2', 'EU', 0.55, 40),
  m('H-PIPE', 'Culvert pipes & ducts', 'أنابيب العبّارات والمجاري', 'imported-standard', 'km', 'TR', 0.4, 45),
  m('H-PAINT', 'Road-marking paint', 'دهان علامات الطرق', 'imported-standard', 'lot', 'EU', 0.4, 30),
];

export const highwaySuppliers: Supplier[] = [
  { id: 'HS1', name: 'Supplier H1', country: 'TR', onTime: 0.87, quality: 0.94, priceVar: 0.02 },
  { id: 'HS2', name: 'Supplier H2', country: 'DE', onTime: 0.94, quality: 0.97, priceVar: 0.05 },
  { id: 'HS3', name: 'Supplier H3', country: 'DE', onTime: 0.9, quality: 0.96, priceVar: 0.04 },
  { id: 'HS4', name: 'Supplier H4', country: 'CN', onTime: 0.84, quality: 0.89, priceVar: -0.05 },
  { id: 'HS5', name: 'Supplier H5', country: 'IN', onTime: 0.9, quality: 0.9, priceVar: 0.0 },
  { id: 'HS6', name: 'Supplier H6', country: 'AE', onTime: 0.96, quality: 0.92, priceVar: 0.0 },
  { id: 'HS7', name: 'Supplier H7', country: 'PL', onTime: 0.9, quality: 0.94, priceVar: 0.02 },
];

export const highwayPoSeeds: PoSeed[] = [
  { id: 'PO-H01', materialId: 'H-GIR', supplierId: 'HS1', qty: 24, valueM: 21.5, weightT: 1900, routeId: 'R-PTA', incoterm: 'CFR', prodDays: 120, qaDays: 15, cover: 10, deliveryActivityId: 'DEL-GIR1', orderedOn: [2026, 11, 10], airEligible: false, slip: 0 },
  { id: 'PO-H02', materialId: 'H-GIR', supplierId: 'HS1', qty: 24, valueM: 21.5, weightT: 1900, routeId: 'R-PTA', incoterm: 'CFR', prodDays: 130, qaDays: 15, cover: 14, deliveryActivityId: 'DEL-GIR2', orderedOn: [2026, 11, 20], airEligible: false, slip: 0 },
  { id: 'PO-H03', materialId: 'H-BRG', supplierId: 'HS2', qty: 1, valueM: 5.2, weightT: 48, routeId: 'R-PTA', incoterm: 'CFR', prodDays: 90, qaDays: 12, cover: 12, deliveryActivityId: 'DEL-BRG', orderedOn: [2026, 12, 1], airEligible: true, slip: 0 },
  { id: 'PO-H04', materialId: 'H-BAR', supplierId: 'HS5', qty: 38, valueM: 9.8, weightT: 760, routeId: 'R-PTC', incoterm: 'CFR', prodDays: 60, qaDays: 8, cover: 30, deliveryActivityId: 'DEL-BAR', airEligible: false, slip: 0 },
  { id: 'PO-H05', materialId: 'H-POLE', supplierId: 'HS4', qty: 640, valueM: 8.4, weightT: 220, routeId: 'R-PTA', incoterm: 'CFR', prodDays: 70, qaDays: 10, cover: 20, deliveryActivityId: 'DEL-POLE', airEligible: false, slip: 0 },
  { id: 'PO-H06', materialId: 'H-ITS', supplierId: 'HS3', qty: 1, valueM: 14.6, weightT: 36, routeId: 'R-PTA', incoterm: 'CFR', prodDays: 100, qaDays: 10, cover: 25, deliveryActivityId: 'DEL-ITS', airEligible: true, slip: 0 },
  { id: 'PO-H07', materialId: 'H-VMS', supplierId: 'HS4', qty: 24, valueM: 6.1, weightT: 90, routeId: 'R-PTC', incoterm: 'CFR', prodDays: 80, qaDays: 8, cover: 25, deliveryActivityId: 'DEL-VMS', airEligible: true, slip: 0 },
  { id: 'PO-H08', materialId: 'H-BIT', supplierId: 'HS6', qty: 9000, valueM: 12.0, weightT: 9000, routeId: 'R-LOC', incoterm: 'DAP', prodDays: 4, qaDays: 0, cover: 8, deliveryActivityId: 'DEL-BIT', airEligible: false, slip: 0 },
  { id: 'PO-H09', materialId: 'H-REB', supplierId: 'HS6', qty: 3200, valueM: 9.0, weightT: 3200, routeId: 'R-LOC', incoterm: 'DAP', prodDays: 10, qaDays: 2, cover: 12, deliveryActivityId: 'DEL-REB', orderedOn: [2026, 12, 20], airEligible: false, slip: 0 },
  { id: 'PO-H10', materialId: 'H-GEO', supplierId: 'HS7', qty: 120000, valueM: 3.2, weightT: 60, routeId: 'R-PTA', incoterm: 'CFR', prodDays: 18, qaDays: 4, cover: 15, deliveryActivityId: 'DEL-GEO', orderedOn: [2026, 11, 12], airEligible: false, slip: 6 },
];

const SPECS: Array<{ id: string; type: AssetType; en: string; ar: string; model: string; hours: number; rental: number; fault?: Asset['fault'] }> = [
  { id: 'EX-01', type: 'excavator', en: 'Excavator 36 t #1', ar: 'حفارة 36 طن رقم 1', model: '36 t hydraulic excavator', hours: 2100, rental: 3200 },
  { id: 'EX-02', type: 'excavator', en: 'Excavator 36 t #2', ar: 'حفارة 36 طن رقم 2', model: '36 t hydraulic excavator', hours: 1950, rental: 3200 },
  { id: 'DT-01', type: 'dump-truck', en: 'Dump truck #1', ar: 'شاحنة قلابة رقم 1', model: '40 t articulated dump truck', hours: 2600, rental: 1800 },
  { id: 'DT-02', type: 'dump-truck', en: 'Dump truck #2', ar: 'شاحنة قلابة رقم 2', model: '40 t articulated dump truck', hours: 2480, rental: 1800 },
  { id: 'DT-03', type: 'dump-truck', en: 'Dump truck #3', ar: 'شاحنة قلابة رقم 3', model: '40 t articulated dump truck', hours: 2310, rental: 1800 },
  { id: 'GR-01', type: 'excavator', en: 'Motor grader', ar: 'مدرّجة طرق', model: '16 ft motor grader', hours: 1700, rental: 3600 },
  { id: 'PV-01', type: 'excavator', en: 'Asphalt paver', ar: 'فرادة أسفلت', model: '9 m asphalt paver', hours: 1250, rental: 7200 },
  { id: 'RL-01', type: 'excavator', en: 'Vibratory roller', ar: 'مدحلة اهتزازية', model: '14 t vibratory roller', hours: 1540, rental: 2100 },
  {
    id: 'CC-01',
    type: 'crawler-crane',
    en: 'Crawler crane 250 t (girder launching)',
    ar: 'رافعة زاحفة 250 طن (رفع الكمرات)',
    model: '250 t lattice-boom crawler crane',
    hours: 5300,
    rental: 21000,
    fault: { channelId: 'vib', component: bi('Slewing-drive gearbox bearing', 'محمل علبة تروس الدوران'), onsetT: T(2027, 1, 30), alarmT: T(2027, 4, 26), failT: T(2027, 5, 1), coupled: { oil: 0.8, temp: 0.4 } },
  },
  { id: 'PR-01', type: 'piling-rig', en: 'Bored-piling rig', ar: 'معدة الخوازيق المحفورة', model: 'Rotary bored piling rig', hours: 2200, rental: 22000 },
  { id: 'BP-01', type: 'batching-plant', en: 'Batching plant 90 m3/h', ar: 'محطة خلط 90 م3/س', model: '90 m3/h batching plant', hours: 1100, rental: 11000 },
];

export function buildHighwayAssets(linked: Record<string, string[]>): Asset[] {
  return SPECS.map((s) => ({
    id: s.id,
    type: s.type,
    name: bi(s.en, s.ar),
    model: s.model,
    hours: s.hours,
    location: bi('Corridor', 'الممر'),
    channels: channelsFor(s.type),
    fault: s.fault,
    linkedActivityIds: linked[s.id] ?? [],
    pm: { intervalHrs: 500, lastDoneHrs: s.hours - 210 },
    certExpiryT: s.type.includes('crane') ? T(2027, 9, 30) : undefined,
    rentalPerDay: s.rental,
    mobDays: 7,
    repairDays: s.id === 'CC-01' ? 12 : 4,
    serviceDays: 2,
  }));
}

// ------------------------------------------------------------------------------------------------ 3D scene
const el = (id: string, en: string, ar: string, kind: SceneElement['kind'], pos: [number, number, number], size: [number, number, number], grow: SceneElement['grow'], color: string, extra: Partial<SceneElement> = {}): SceneElement => ({ id, name: bi(en, ar), kind, pos, size, grow, color, activityIds: [], ...extra });

export function buildHighwayScene(): SceneElement[] {
  const out: SceneElement[] = [];
  const W = 257;
  for (let k = 1; k <= 7; k++) {
    const x = -900 + W * (k - 0.5);
    out.push(el(`EMB-${k}`, `Embankment S${k}`, `الردم S${k}`, 'embankment', [x, 1, 0], [W - 2, 4, 78], 'y', '#b9a57c'));
    out.push(el(`RD-${k}`, `Carriageway S${k}`, `الطريق S${k}`, 'road', [x, 3.15, 0], [W - 2, 0.5, 40], 'x', '#34393d'));
  }
  out.push(el('BR-1', 'Bridge B1 deck', 'سطح الجسر B1', 'bridge', [-450, 9, 0], [130, 1.8, 42], 'x', '#aeb6ba'));
  out.push(el('BR-2', 'Bridge B2 deck', 'سطح الجسر B2', 'bridge', [300, 9, 0], [130, 1.8, 42], 'x', '#aeb6ba'));
  out.push(el('PIER-1', 'Bridge B1 piers & abutments', 'أعمدة ودعامات الجسر B1', 'pier', [-450, 4, 0], [120, 9, 34], 'y', '#9aa3a8', { count: 4 }));
  out.push(el('PIER-2', 'Bridge B2 piers & abutments', 'أعمدة ودعامات الجسر B2', 'pier', [300, 4, 0], [120, 9, 34], 'y', '#9aa3a8', { count: 4 }));
  [-700, -250, 150, 650].forEach((x, i) => out.push(el(`CUL-${i + 1}`, `Culvert C${i + 1}`, `العبّارة C${i + 1}`, 'culvert', [x, 1, 0], [16, 4.5, 64], 'y', '#8d969c')));
  out.push(el('RAMP-1', 'Interchange ramp east', 'منحدر التقاطع الشرقي', 'road', [60, 3.2, 120], [220, 0.5, 16], 'x', '#34393d', { rotY: -0.35 }));
  out.push(el('RAMP-2', 'Interchange ramp west', 'منحدر التقاطع الغربي', 'road', [-40, 3.2, -120], [220, 0.5, 16], 'x', '#34393d', { rotY: 0.35 }));
  [[-600, 0], [-120, 1], [380, 2]].forEach(([x], i) => out.push(el(`LIGHT-${i + 1}`, `Lighting group ${i + 1}`, `مجموعة الإنارة ${i + 1}`, 'mast', [x + 200, 3.4, 24], [380, 14, 2], 'y', '#8d969c', { count: 9 })));
  return out;
}

const loopRoad = (x0: number, x1: number, z: number, speed: number, phase: number) =>
  ({ kind: 'loop' as const, pts: [[x0, z], [x1, z], [x1, z + 7], [x0, z + 7]] as Array<[number, number]>, y: 3.5, speed, phase });

export const highwayFleetVis: Record<string, FleetVis> = {
  'EX-01': { model: 'excavator', motion: { kind: 'static', pos: [-780, 3.5, -30], yaw: 0.6, swing: 0.6, swingPeriod: 9 } },
  'EX-02': { model: 'excavator', motion: { kind: 'static', pos: [-100, 3.5, 36], yaw: -1.2, swing: 0.6, swingPeriod: 10 } },
  'DT-01': { model: 'dump-truck', motion: loopRoad(-800, -500, 10, 6, 0) },
  'DT-02': { model: 'dump-truck', motion: loopRoad(-800, -500, 10, 6, 0.5) },
  'DT-03': { model: 'dump-truck', motion: loopRoad(-300, 0, 12, 5.5, 0.2) },
  'GR-01': { model: 'proc:gen', motion: loopRoad(-250, 200, -9, 2.2, 0.3) },
  'PV-01': { model: 'proc:barge', motion: loopRoad(-200, 250, -9, 1.2, 0.6), scale: 0.45 },
  'RL-01': { model: 'proc:gen', motion: loopRoad(-200, 250, 14, 1.6, 0.1), scale: 1.2 },
  'CC-01': { model: 'crawler-crane', motion: { kind: 'static', pos: [-380, 3.5, 28], yaw: 1.0, swing: 0.5, swingPeriod: 14 } },
  'PR-01': { model: 'piling-rig', motion: { kind: 'static', pos: [300, 3.5, 30], yaw: -0.4, swing: 0.15, swingPeriod: 8 } },
  'BP-01': { model: 'batching-plant', motion: { kind: 'static', pos: [-870, 3, 70], yaw: 0 } },
};

export const highwayCameraPresets: Record<string, { pos: [number, number, number]; target: [number, number, number] }> = {
  overview: { pos: [-780, 260, 560], target: [-60, 0, 0] },
  quay: { pos: [-520, 70, 150], target: [-450, 6, 0] },
  castingYard: { pos: [120, 90, 160], target: [300, 6, 0] },
  yard: { pos: [-300, 160, 380], target: [0, 4, 40] },
  offshore: { pos: [700, 120, -200], target: [900, 4, 0] },
};
