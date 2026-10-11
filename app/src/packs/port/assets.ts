// Port pack: construction fleet (27 assets), telemetry channel templates and seeded degradation faults.
// ILLUSTRATIVE: models are generic, hours/health are synthetic, the fault on CC-02 is scripted for the H3 demo flow.
import { bi } from '../../lib/bi';
import { ymdToT } from '../../engine/dates';
import type { Asset, AssetType, ChannelDef, FaultSeed } from '../../engine/types';

const T = ymdToT;

const ch = (id: string, en: string, ar: string, unit: string, base: number, warn: number, alarm: number, weight: number, diurnal: number, noise: number, load: number): ChannelDef => ({
  id,
  name: bi(en, ar),
  unit,
  base,
  warn,
  alarm,
  weight,
  diurnal,
  noise,
  load,
});

const craneChannels = (): ChannelDef[] => [
  ch('vib', 'Hoist gearbox vibration', 'اهتزاز علبة تروس الرفع', 'mm/s', 2.1, 4.5, 7.1, 3, 0.1, 0.12, 0.6),
  ch('temp', 'Gearbox oil temperature', 'حرارة زيت علبة التروس', 'C', 58, 80, 95, 2, 6, 1.2, 12),
  ch('hyd', 'Hydraulic pressure', 'الضغط الهيدروليكي', 'bar', 205, 245, 270, 1, 1, 3, 25),
  ch('oil', 'Oil debris (Fe)', 'الشوائب المعدنية في الزيت', 'ppm', 14, 40, 70, 2.5, 0, 1.5, 2),
  ch('cycles', 'Load cycles', 'دورات الحمل', '/h', 4, 40, 55, 0.3, 0, 1.5, 22),
  ch('wind', 'Wind speed at boom', 'سرعة الرياح عند الذراع', 'm/s', 4.5, 11, 14, 0.2, 3, 1.1, 0),
  ch('tilt', 'Tilt / level', 'الميلان', 'deg', 0.2, 0.8, 1.2, 0.5, 0.02, 0.03, 0.05),
];
const earthChannels = (): ChannelDef[] => [
  ch('temp', 'Engine coolant temperature', 'حرارة سائل تبريد المحرك', 'C', 84, 98, 108, 2, 4, 1, 6),
  ch('hyd', 'Hydraulic pressure', 'الضغط الهيدروليكي', 'bar', 280, 340, 380, 2, 2, 4, 40),
  ch('vib', 'Frame vibration', 'اهتزاز الهيكل', 'mm/s', 3.2, 6.5, 10, 1.5, 0.15, 0.2, 1.4),
  ch('oil', 'Oil debris (Fe)', 'الشوائب المعدنية في الزيت', 'ppm', 18, 50, 80, 2.5, 0, 2, 3),
  ch('fuel', 'Fuel rate', 'معدل استهلاك الوقود', 'L/h', 6, 28, 38, 0.3, 0, 0.8, 16),
];
const dredgerChannels = (): ChannelDef[] => [
  ch('vib', 'Dredge pump vibration', 'اهتزاز مضخة التكريك', 'mm/s', 3.4, 7, 11, 3, 0.12, 0.25, 1.2),
  ch('temp', 'Main engine temperature', 'حرارة المحرك الرئيسي', 'C', 78, 92, 102, 2, 3, 1, 8),
  ch('press', 'Discharge pressure', 'ضغط التفريغ', 'bar', 6.5, 11, 13.5, 1.5, 0.2, 0.2, 3),
  ch('oil', 'Oil debris (Fe)', 'الشوائب المعدنية في الزيت', 'ppm', 20, 55, 90, 2.5, 0, 2, 3),
  ch('fuel', 'Fuel rate', 'معدل استهلاك الوقود', 'L/h', 120, 520, 680, 0.3, 0, 12, 280),
];
const plantChannels = (): ChannelDef[] => [
  ch('temp', 'Motor winding temperature', 'حرارة ملفات المحرك', 'C', 62, 95, 120, 2, 5, 1.2, 14),
  ch('vib', 'Drive vibration', 'اهتزاز المحرك', 'mm/s', 2.4, 5.5, 8.5, 2, 0.1, 0.15, 0.9),
  ch('curr', 'Motor current', 'تيار المحرك', 'A', 140, 260, 320, 1.2, 4, 3, 60),
  ch('oil', 'Lubricant debris', 'شوائب مواد التشحيم', 'ppm', 12, 38, 65, 1.5, 0, 1.2, 2),
];
const genChannels = (): ChannelDef[] => [
  ch('temp', 'Engine coolant temperature', 'حرارة سائل تبريد المحرك', 'C', 80, 96, 106, 2, 3, 1, 8),
  ch('vib', 'Engine vibration', 'اهتزاز المحرك', 'mm/s', 2.8, 6, 9, 1.5, 0.1, 0.15, 1),
  ch('oil', 'Oil debris (Fe)', 'الشوائب المعدنية في الزيت', 'ppm', 10, 35, 60, 2.5, 0, 1.2, 2),
  ch('volt', 'Output voltage THD', 'تشوه جهد الخرج', '%', 1.8, 4, 6, 0.8, 0.1, 0.1, 0.8),
];

export const channelsFor = (t: AssetType): ChannelDef[] => {
  switch (t) {
    case 'crawler-crane':
    case 'mobile-harbour-crane':
    case 'tower-crane':
      return craneChannels();
    case 'dredger':
      return dredgerChannels();
    case 'excavator':
    case 'dump-truck':
    case 'piling-rig':
    case 'tug':
    case 'barge':
      return earthChannels();
    case 'batching-plant':
    case 'concrete-mixer':
      return plantChannels();
    default:
      return genChannels();
  }
};

interface Spec {
  id: string;
  type: AssetType;
  en: string;
  ar: string;
  model: string;
  hours: number;
  loc: [string, string];
  rental: number;
  mob: number;
  repair: number;
  service: number;
  pmInterval: number;
  pmLast: number;
  fuel?: number;
  cert?: [number, number, number];
  fault?: FaultSeed;
}

const SPECS: Spec[] = [
  { id: 'CC-01', type: 'crawler-crane', en: 'Crawler crane 350 t #1', ar: 'رافعة زاحفة 350 طن رقم 1', model: '350 t lattice-boom crawler crane', hours: 6120, loc: ['Casting yard', 'ساحة الصب'], rental: 26000, mob: 9, repair: 5, service: 2, pmInterval: 500, pmLast: 5780, cert: [2027, 8, 30] },
  {
    id: 'CC-02',
    type: 'crawler-crane',
    en: 'Crawler crane 350 t #2',
    ar: 'رافعة زاحفة 350 طن رقم 2',
    model: '350 t lattice-boom crawler crane',
    hours: 8450,
    loc: ['Casting yard', 'ساحة الصب'],
    rental: 26000,
    mob: 7,
    repair: 12,
    service: 2,
    pmInterval: 500,
    pmLast: 8010,
    cert: [2027, 4, 12],
    // H3 hero fault: hoist gearbox bearing - vibration trending to alarm, failure expected shortly after
    fault: {
      channelId: 'vib',
      component: bi('Hoist gearbox - output-shaft bearing (outer-race defect signature)', 'علبة تروس الرفع - محمل العمود الخارج (نمط عيب الحلقة الخارجية)'),
      onsetT: T(2026, 12, 18),
      alarmT: T(2027, 1, 29),
      failT: T(2027, 2, 3),
      coupled: { oil: 0.85, temp: 0.45 },
    },
  },
  { id: 'MHC-01', type: 'mobile-harbour-crane', en: 'Mobile harbour crane 140 t', ar: 'رافعة ميناء متنقلة 140 طن', model: '140 t mobile harbour crane', hours: 2310, loc: ['Laydown berth', 'رصيف التخزين'], rental: 18000, mob: 14, repair: 6, service: 2, pmInterval: 400, pmLast: 2080, cert: [2027, 10, 5] },
  { id: 'TC-01', type: 'tower-crane', en: 'Tower crane #1 (admin block)', ar: 'رافعة برجية رقم 1 (مبنى الإدارة)', model: 'Luffing tower crane 12 t', hours: 1480, loc: ['Admin building', 'مبنى الإدارة'], rental: 14000, mob: 12, repair: 4, service: 1, pmInterval: 400, pmLast: 1260, cert: [2027, 6, 18] },
  { id: 'TC-02', type: 'tower-crane', en: 'Tower crane #2 (workshop)', ar: 'رافعة برجية رقم 2 (الورشة)', model: 'Luffing tower crane 12 t', hours: 1390, loc: ['Workshop', 'الورشة'], rental: 14000, mob: 12, repair: 4, service: 1, pmInterval: 400, pmLast: 1100, cert: [2027, 6, 18] },
  { id: 'EX-01', type: 'excavator', en: 'Excavator 36 t #1', ar: 'حفارة 36 طن رقم 1', model: '36 t hydraulic excavator', hours: 3420, loc: ['Reclamation R1', 'الردم R1'], rental: 3200, mob: 3, repair: 3, service: 1, pmInterval: 500, pmLast: 3100 },
  { id: 'EX-02', type: 'excavator', en: 'Excavator 36 t #2', ar: 'حفارة 36 طن رقم 2', model: '36 t hydraulic excavator', hours: 3180, loc: ['Rock revetment west', 'الحماية الصخرية الغربية'], rental: 3200, mob: 3, repair: 3, service: 1, pmInterval: 500, pmLast: 2800 },
  { id: 'EX-03', type: 'excavator', en: 'Excavator 50 t #3', ar: 'حفارة 50 طن رقم 3', model: '50 t hydraulic excavator', hours: 2750, loc: ['Rock revetment east', 'الحماية الصخرية الشرقية'], rental: 4200, mob: 3, repair: 3, service: 1, pmInterval: 500, pmLast: 2480 },
  { id: 'EX-04', type: 'excavator', en: 'Excavator 36 t #4', ar: 'حفارة 36 طن رقم 4', model: '36 t hydraulic excavator', hours: 2950, loc: ['Quay backfill', 'ردم الرصيف'], rental: 3200, mob: 3, repair: 3, service: 1, pmInterval: 500, pmLast: 2600 },
  { id: 'DT-01', type: 'dump-truck', en: 'Articulated dump truck #1', ar: 'شاحنة قلابة مفصلية رقم 1', model: '40 t articulated dump truck', hours: 4210, loc: ['Haul road', 'طريق النقل'], rental: 1800, mob: 2, repair: 2, service: 1, pmInterval: 500, pmLast: 3980 },
  { id: 'DT-02', type: 'dump-truck', en: 'Articulated dump truck #2', ar: 'شاحنة قلابة مفصلية رقم 2', model: '40 t articulated dump truck', hours: 4005, loc: ['Haul road', 'طريق النقل'], rental: 1800, mob: 2, repair: 2, service: 1, pmInterval: 500, pmLast: 3700 },
  { id: 'DT-03', type: 'dump-truck', en: 'Articulated dump truck #3', ar: 'شاحنة قلابة مفصلية رقم 3', model: '40 t articulated dump truck', hours: 3880, loc: ['Reclamation R2', 'الردم R2'], rental: 1800, mob: 2, repair: 2, service: 1, pmInterval: 500, pmLast: 3510 },
  {
    id: 'DT-04',
    type: 'dump-truck',
    en: 'Articulated dump truck #4',
    ar: 'شاحنة قلابة مفصلية رقم 4',
    model: '40 t articulated dump truck',
    hours: 4510,
    loc: ['Reclamation R2', 'الردم R2'],
    rental: 1800,
    mob: 2,
    repair: 2,
    service: 1,
    pmInterval: 500,
    pmLast: 4100,
    fault: { channelId: 'hyd', component: bi('Hoist-cylinder hydraulic pump wear', 'تآكل مضخة أسطوانة الرفع الهيدروليكية'), onsetT: T(2027, 1, 2), alarmT: T(2027, 4, 8), failT: T(2027, 4, 24), coupled: { oil: 0.5 } },
  },
  { id: 'DT-05', type: 'dump-truck', en: 'Articulated dump truck #5', ar: 'شاحنة قلابة مفصلية رقم 5', model: '40 t articulated dump truck', hours: 3320, loc: ['Yard Y1', 'الساحة Y1'], rental: 1800, mob: 2, repair: 2, service: 1, pmInterval: 500, pmLast: 3050 },
  { id: 'DT-06', type: 'dump-truck', en: 'Articulated dump truck #6', ar: 'شاحنة قلابة مفصلية رقم 6', model: '40 t articulated dump truck', hours: 3150, loc: ['Yard Y1', 'الساحة Y1'], rental: 1800, mob: 2, repair: 2, service: 1, pmInterval: 500, pmLast: 2900 },
  { id: 'DRG-01', type: 'dredger', en: 'Trailing suction hopper dredger', ar: 'كراكة شفط ذاتية الحمولة', model: '6,500 m3 trailing suction hopper dredger', hours: 11200, loc: ['Offshore - approach channel', 'البحر - قناة الاقتراب'], rental: 85000, mob: 30, repair: 10, service: 3, pmInterval: 1000, pmLast: 10350, cert: [2027, 9, 1], fuel: 520 },
  { id: 'PR-01', type: 'piling-rig', en: 'Piling / vibro rig #1', ar: 'معدة دق / دمك اهتزازي رقم 1', model: 'Crawler piling & vibro-compaction rig', hours: 2980, loc: ['Reclamation R1', 'الردم R1'], rental: 22000, mob: 10, repair: 5, service: 2, pmInterval: 500, pmLast: 2700 },
  { id: 'PR-02', type: 'piling-rig', en: 'Piling / vibro rig #2', ar: 'معدة دق / دمك اهتزازي رقم 2', model: 'Crawler piling & vibro-compaction rig', hours: 2870, loc: ['Reclamation R2', 'الردم R2'], rental: 22000, mob: 10, repair: 5, service: 2, pmInterval: 500, pmLast: 2490 },
  { id: 'BP-01', type: 'batching-plant', en: 'Concrete batching plant 120 m3/h', ar: 'محطة خلط الخرسانة 120 م3/س', model: '120 m3/h twin-shaft batching plant', hours: 1840, loc: ['Plant area', 'منطقة المحطة'], rental: 12000, mob: 20, repair: 4, service: 1, pmInterval: 400, pmLast: 1640 },
  { id: 'CM-01', type: 'concrete-mixer', en: 'Concrete mixer truck #1', ar: 'خلاطة خرسانة رقم 1', model: '9 m3 transit mixer', hours: 3900, loc: ['Casting yard', 'ساحة الصب'], rental: 1600, mob: 2, repair: 2, service: 1, pmInterval: 500, pmLast: 3640 },
  { id: 'CM-02', type: 'concrete-mixer', en: 'Concrete mixer truck #2', ar: 'خلاطة خرسانة رقم 2', model: '9 m3 transit mixer', hours: 3750, loc: ['Casting yard', 'ساحة الصب'], rental: 1600, mob: 2, repair: 2, service: 1, pmInterval: 500, pmLast: 3490 },
  { id: 'CM-03', type: 'concrete-mixer', en: 'Concrete mixer truck #3', ar: 'خلاطة خرسانة رقم 3', model: '9 m3 transit mixer', hours: 3610, loc: ['Plant area', 'منطقة المحطة'], rental: 1600, mob: 2, repair: 2, service: 1, pmInterval: 500, pmLast: 3330 },
  { id: 'TUG-01', type: 'tug', en: 'Harbour tug 40 t bollard pull', ar: 'قاطرة ميناء 40 طن سحب', model: '40 t BP harbour tug', hours: 5240, loc: ['Offshore - basin', 'البحر - الحوض'], rental: 9000, mob: 15, repair: 6, service: 2, pmInterval: 750, pmLast: 4800, cert: [2027, 7, 11] },
  { id: 'BRG-01', type: 'barge', en: 'Split-hopper barge #1', ar: 'صندل قاع مفتوح رقم 1', model: '1,200 m3 split-hopper barge', hours: 4100, loc: ['Offshore - revetment', 'البحر - الحماية الصخرية'], rental: 4500, mob: 10, repair: 4, service: 1, pmInterval: 750, pmLast: 3760 },
  { id: 'BRG-02', type: 'barge', en: 'Flat-top barge #2', ar: 'صندل مسطح رقم 2', model: 'Flat-top deck barge 3,000 t', hours: 3650, loc: ['Offshore - breakwater', 'البحر - كاسر الأمواج'], rental: 4500, mob: 10, repair: 4, service: 1, pmInterval: 750, pmLast: 3300 },
  { id: 'GEN-01', type: 'generator', en: 'Diesel generator 1 MVA #1', ar: 'مولد ديزل 1 م.ف.أ رقم 1', model: '1 MVA diesel generator set', hours: 7020, loc: ['Plant area', 'منطقة المحطة'], rental: 1500, mob: 3, repair: 2, service: 1, pmInterval: 500, pmLast: 6710 },
  {
    id: 'GEN-02',
    type: 'generator',
    en: 'Diesel generator 1 MVA #2',
    ar: 'مولد ديزل 1 م.ف.أ رقم 2',
    model: '1 MVA diesel generator set',
    hours: 6860,
    loc: ['Camp', 'السكن'],
    rental: 1500,
    mob: 3,
    repair: 2,
    service: 1,
    pmInterval: 500,
    pmLast: 6420,
    fault: { channelId: 'oil', component: bi('Engine bearing wear (oil debris trend)', 'تآكل محامل المحرك (اتجاه شوائب الزيت)'), onsetT: T(2026, 12, 28), alarmT: T(2027, 4, 2), failT: T(2027, 4, 22), coupled: { vib: 0.4 } },
  },
];

export function buildPortAssets(linked: Record<string, string[]>): Asset[] {
  return SPECS.map((s) => ({
    id: s.id,
    type: s.type,
    name: bi(s.en, s.ar),
    model: s.model,
    hours: s.hours,
    location: bi(s.loc[0], s.loc[1]),
    channels: channelsFor(s.type),
    fault: s.fault,
    linkedActivityIds: linked[s.id] ?? [],
    pm: { intervalHrs: s.pmInterval, lastDoneHrs: s.pmLast },
    certExpiryT: s.cert ? T(...s.cert) : undefined,
    rentalPerDay: s.rental,
    mobDays: s.mob,
    repairDays: s.repair,
    serviceDays: s.service,
    fuelLph: s.fuel,
  }));
}
