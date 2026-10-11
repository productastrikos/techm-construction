// Port pack: static configuration. EVERYTHING here is illustrative. Project name, coordinates, quantities and dates are
// config values (see docs/04) so the pack can be retitled in one file. No live client data, no real client integration.
import { bi } from '../../lib/bi';
import { ymdToT } from '../../engine/dates';
import type { CalendarProfile, CalendarRules, HolidayDef, PackConfig, Port, RouteDef, RouteTable, Supplier, WbsNode } from '../../engine/types';

const T = ymdToT;

export const portConfig: PackConfig = {
  id: 'port',
  name: bi('Mina Al Hamriya Port', 'ميناء الحمرية'),
  subtitle: bi('New deepwater gateway port - illustrative scope, quantities and dates', 'ميناء بوابة جديد للمياه العميقة - نطاق وكميات وتواريخ توضيحية'),
  code: 'POC-PORT-01',
  // illustrative coastal site position
  location: { lat: 25.205, lon: 56.375, label: bi('Coastal site (illustrative)', 'موقع ساحلي (توضيحي)') },
  startT: 0,
  baselineFinishT: T(2029, 4, 20),
  nowT: T(2027, 1, 15) + 8 / 24,
  bacAED: 2_240_000_000,
  contingencyPct: 0.07,
  retentionPct: 0.1,
  advancePct: 0.1,
  ldPerDay: 120_000,
  ldCapPct: 0.1,
  prolongationPerDay: 85_000,
  cpiByWbs: { MOB: 0.99, DRG: 0.93, MAR: 0.97, PAV: 1.0, BLD: 1.0, EQP: 1.0, COM: 1.0 },
  kpiSeed: { ltifr: 0.42, daysSinceLti: 118, manpower: 1240, manhoursMonth: 286_000, openRisks: 27 },
  vocab: { site: bi('Port site', 'موقع الميناء'), asset: bi('Equipment', 'المعدات'), milestone: bi('Milestone', 'معلم') },
  sceneKind: 'port',
};

export const portWbs: WbsNode[] = [
  { id: 'MOB', name: bi('Mobilisation & enabling', 'التجهيز والأعمال التمهيدية'), color: '#7dd3fc' },
  { id: 'DRG', name: bi('Dredging & reclamation', 'التكريك والردم'), color: '#38bdf8' },
  { id: 'MAR', name: bi('Marine structures', 'المنشآت البحرية'), color: '#3ee0b0' },
  { id: 'PAV', name: bi('Pavements & yard', 'الأرصفة والساحات'), color: '#facc15' },
  { id: 'BLD', name: bi('Buildings & utilities', 'المباني والمرافق'), color: '#fb923c' },
  { id: 'EQP', name: bi('Port equipment', 'معدات الميناء'), color: '#a78bfa' },
  { id: 'COM', name: bi('Commissioning & handover', 'التشغيل التجريبي والتسليم'), color: '#f472b6' },
];

// Friday = weekly rest day (policy is configurable). index = weekday (0 Sun .. 6 Sat)
const WEEK = [true, true, true, true, true, false, true];
const ALLWEEK = [true, true, true, true, true, true, true];

export const portCalendars: CalendarProfile[] = [
  { id: 'site', name: bi('Site - outdoor 10 h', 'الموقع - خارجي 10 ساعات'), baseHours: 10, workDays: WEEK, outdoor: true, sea: false, wind: false, ramadan: true, middayExempt: false },
  { id: 'marine', name: bi('Marine works - sea-state limited', 'الأعمال البحرية - حدود حالة البحر'), baseHours: 10, workDays: WEEK, outdoor: true, sea: true, wind: false, ramadan: true, middayExempt: false },
  { id: 'crane', name: bi('Lifting works - wind limited', 'أعمال الرفع - حدود الرياح'), baseHours: 10, workDays: WEEK, outdoor: true, sea: false, wind: true, ramadan: true, middayExempt: false },
  { id: 'indoor', name: bi('Office / indoor 9 h', 'مكتبي / داخلي 9 ساعات'), baseHours: 9, workDays: WEEK, outdoor: false, sea: false, wind: false, ramadan: true, middayExempt: true },
  { id: 'continuous', name: bi('Continuous (curing, settlement, factory)', 'مستمر (المعالجة، الهبوط، المصنع)'), baseHours: 24, workDays: ALLWEEK, outdoor: false, sea: false, wind: false, ramadan: false, middayExempt: true },
];

const H = (id: string, en: string, ar: string, s: [number, number, number], e: [number, number, number], kind: HolidayDef['kind'], unc: number): HolidayDef => ({
  id,
  name: bi(en, ar),
  startT: T(...s),
  endT: T(...e),
  kind,
  uncertaintyDays: unc,
});

/** Expected dates (Islamic dates +/- 1 day, moon sighting). MUST be re-verified before any client-facing claim. */
export const portHolidays: HolidayDef[] = [
  H('cd26', 'National Observance', 'مناسبة وطنية', [2026, 11, 30], [2026, 11, 30], 'national', 0),
  H('nd26', 'National Day', 'اليوم الوطني', [2026, 12, 2], [2026, 12, 3], 'national', 0),
  H('ny27', 'New Year', 'رأس السنة الميلادية', [2027, 1, 1], [2027, 1, 1], 'public', 0),
  H('eidf27', 'Eid al-Fitr (expected)', 'عيد الفطر (متوقع)', [2027, 3, 9], [2027, 3, 12], 'eid', 1),
  H('adha27', 'Arafat Day & Eid al-Adha (expected)', 'يوم عرفة وعيد الأضحى (متوقع)', [2027, 5, 15], [2027, 5, 19], 'eid', 1),
  H('hij27', 'Islamic New Year (expected)', 'رأس السنة الهجرية (متوقع)', [2027, 6, 6], [2027, 6, 6], 'public', 1),
  H('mawlid27', "Prophet's Birthday (expected)", 'المولد النبوي (متوقع)', [2027, 8, 14], [2027, 8, 15], 'public', 1),
  H('cd27', 'National Observance', 'مناسبة وطنية', [2027, 11, 30], [2027, 11, 30], 'national', 0),
  H('nd27', 'National Day', 'اليوم الوطني', [2027, 12, 2], [2027, 12, 3], 'national', 0),
  H('ny28', 'New Year', 'رأس السنة الميلادية', [2028, 1, 1], [2028, 1, 1], 'public', 0),
  H('eidf28', 'Eid al-Fitr (expected)', 'عيد الفطر (متوقع)', [2028, 2, 26], [2028, 2, 29], 'eid', 1),
  H('adha28', 'Arafat Day & Eid al-Adha (expected)', 'يوم عرفة وعيد الأضحى (متوقع)', [2028, 5, 4], [2028, 5, 8], 'eid', 1),
  H('hij28', 'Islamic New Year (expected)', 'رأس السنة الهجرية (متوقع)', [2028, 5, 25], [2028, 5, 25], 'public', 1),
  H('mawlid28', "Prophet's Birthday (expected)", 'المولد النبوي (متوقع)', [2028, 8, 3], [2028, 8, 4], 'public', 1),
  H('cd28', 'National Observance', 'مناسبة وطنية', [2028, 11, 30], [2028, 11, 30], 'national', 0),
  H('nd28', 'National Day', 'اليوم الوطني', [2028, 12, 2], [2028, 12, 3], 'national', 0),
  H('ny29', 'New Year', 'رأس السنة الميلادية', [2029, 1, 1], [2029, 1, 1], 'public', 0),
  H('eidf29', 'Eid al-Fitr (expected)', 'عيد الفطر (متوقع)', [2029, 2, 14], [2029, 2, 17], 'eid', 1),
  H('adha29', 'Arafat Day & Eid al-Adha (expected)', 'يوم عرفة وعيد الأضحى (متوقع)', [2029, 4, 23], [2029, 4, 27], 'eid', 1),
];

export const portRules: CalendarRules = {
  holidays: portHolidays,
  ramadan: [
    { startT: T(2027, 2, 8), endT: T(2027, 3, 8), cutHrs: 2 },
    { startT: T(2028, 1, 28), endT: T(2028, 2, 25), cutHrs: 2 },
    { startT: T(2029, 1, 16), endT: T(2029, 2, 13), cutHrs: 2 },
  ],
  // labour-leave surges around Eid (output loss as a fraction of workforce)
  eidLeave: [
    { startT: T(2027, 3, 4), endT: T(2027, 3, 20), loss: 0.18 },
    { startT: T(2027, 5, 10), endT: T(2027, 5, 26), loss: 0.12 },
    { startT: T(2028, 2, 21), endT: T(2028, 3, 8), loss: 0.18 },
    { startT: T(2028, 4, 29), endT: T(2028, 5, 15), loss: 0.12 },
    { startT: T(2029, 2, 9), endT: T(2029, 2, 25), loss: 0.18 },
  ],
  // 15 Jun - 15 Sep, 12:30-15:00 outdoor work ban (2.5 h)
  middayBan: { m1: 6, d1: 15, m2: 9, d2: 15, cutHrs: 2.5 },
  // monthly expected downtime fractions (illustrative normals for a coastal site)
  weather: {
    sea: [0.08, 0.07, 0.06, 0.04, 0.05, 0.12, 0.15, 0.12, 0.07, 0.03, 0.04, 0.07],
    wind: [0.06, 0.07, 0.07, 0.06, 0.05, 0.08, 0.09, 0.06, 0.04, 0.03, 0.04, 0.05],
  },
  heat: [0, 0, 0.02, 0.05, 0.09, 0.14, 0.18, 0.19, 0.12, 0.04, 0, 0],
  // contractual baseline: standard 10 h calendar + public holidays; seasonal exposure is analysed as overlays
  layers: { holidays: true, ramadan: false, midday: false, weather: false, heat: false, eidLeave: false },
  shifts: [],
};

export const portPorts: Port[] = [
  { id: 'PTA', name: bi('Port A', 'ميناء أ'), lat: 25.01, lon: 55.06, insideChokepoint: true, handlingDays: 4, handlingAedPerT: 90, roadDays: 0.4, roadAedPerT: 160, borderDays: 0, transshipAedPerT: 0 },
  { id: 'PTB', name: bi('Port B', 'ميناء ب'), lat: 25.34, lon: 56.36, insideChokepoint: false, handlingDays: 4, handlingAedPerT: 110, roadDays: 0.2, roadAedPerT: 70, borderDays: 0, transshipAedPerT: 380 },
  { id: 'PTC', name: bi('Port C', 'ميناء ج'), lat: 25.17, lon: 56.36, insideChokepoint: false, handlingDays: 3, handlingAedPerT: 105, roadDays: 0.15, roadAedPerT: 40, borderDays: 0, transshipAedPerT: 520 },
  { id: 'PTD', name: bi('Port D', 'ميناء د'), lat: 24.5, lon: 56.62, insideChokepoint: false, handlingDays: 5, handlingAedPerT: 100, roadDays: 0.4, roadAedPerT: 140, borderDays: 1, transshipAedPerT: 450 },
  { id: 'PTE', name: bi('Port E', 'ميناء هـ'), lat: 26.5, lon: 50.2, insideChokepoint: true, handlingDays: 6, handlingAedPerT: 120, roadDays: 1.2, roadAedPerT: 450, borderDays: 2, transshipAedPerT: 150 },
  { id: 'LOC', name: bi('Local', 'محلي'), lat: 25.2, lon: 56.3, insideChokepoint: false, handlingDays: 0, handlingAedPerT: 0, roadDays: 0.3, roadAedPerT: 55, borderDays: 0, transshipAedPerT: 0 },
];

export const portRoutes: RouteDef[] = [
  { id: 'R-PTA', name: bi('Sea to Port A + bonded truck to site', 'بحرًا إلى ميناء أ + شاحنات مُؤمَّنة إلى الموقع'), portId: 'PTA', mode: 'sea', chokepointDependent: true, extraDays: 1 },
  { id: 'R-PTB', name: bi('Sea to Port B + bonded trucking', 'بحرًا إلى ميناء ب + شاحنات مُؤمَّنة'), portId: 'PTB', mode: 'sea', chokepointDependent: false, extraDays: 1 },
  { id: 'R-PTC', name: bi('Sea to Port C + bonded trucking', 'بحرًا إلى ميناء ج + شاحنات مُؤمَّنة'), portId: 'PTC', mode: 'sea', chokepointDependent: false, extraDays: 1 },
  { id: 'R-PTD', name: bi('Sea to Port D + overland', 'بحرًا إلى ميناء د + برًا'), portId: 'PTD', mode: 'sea', chokepointDependent: false, extraDays: 2 },
  { id: 'R-PTE', name: bi('Sea to Port E + overland', 'بحرًا إلى ميناء هـ + برًا'), portId: 'PTE', mode: 'sea', chokepointDependent: true, extraDays: 2 },
  { id: 'R-AIR', name: bi('Air freight to nearest airport + road', 'شحن جوي إلى أقرب مطار + برًا'), portId: 'PTC', mode: 'air', chokepointDependent: false, extraDays: 1 },
  { id: 'R-LOC', name: bi('Domestic supply by road', 'توريد محلي بالطريق'), portId: 'LOC', mode: 'road', chokepointDependent: false, extraDays: 0 },
];

export const portRouteTable: RouteTable = {
  seaDays: {
    CN: { PTA: 22, PTB: 20, PTC: 21, PTD: 21, PTE: 26 },
    IN: { PTA: 7, PTB: 6, PTC: 6, PTD: 5, PTE: 10 },
    TR: { PTA: 24, PTB: 22, PTC: 22, PTD: 22, PTE: 27 },
    EU: { PTA: 26, PTB: 24, PTC: 24, PTD: 24, PTE: 29 },
    AE: {},
  },
  seaAedPerT: { CN: 260, IN: 110, TR: 240, EU: 300, AE: 0 },
  airDays: 4,
  airAedPerKg: 18,
  chokepoint: {
    open: { extraDays: 0, costPct: 0 },
    restricted: { extraDays: 14, costPct: 0.1 },
    closed: { extraDays: 35, costPct: 0.22 },
  },
};

// fictional suppliers (no real companies)
export const portSuppliers: Supplier[] = [
  { id: 'S01', name: 'Supplier 01', country: 'CN', onTime: 0.86, quality: 0.93, priceVar: -0.03 },
  { id: 'S02', name: 'Supplier 02', country: 'IN', onTime: 0.91, quality: 0.9, priceVar: 0.01 },
  { id: 'S03', name: 'Supplier 03', country: 'TR', onTime: 0.88, quality: 0.94, priceVar: 0.02 },
  { id: 'S04', name: 'Supplier 04', country: 'DE', onTime: 0.95, quality: 0.97, priceVar: 0.05 },
  { id: 'S05', name: 'Supplier 05', country: 'AE', onTime: 0.97, quality: 0.92, priceVar: 0.0 },
  { id: 'S06', name: 'Supplier 06', country: 'AE', onTime: 0.94, quality: 0.91, priceVar: 0.01 },
  { id: 'S07', name: 'Supplier 07', country: 'DE', onTime: 0.9, quality: 0.97, priceVar: 0.06 },
  { id: 'S08', name: 'Supplier 08', country: 'TR', onTime: 0.89, quality: 0.9, priceVar: -0.02 },
  { id: 'S09', name: 'Supplier 09', country: 'CN', onTime: 0.82, quality: 0.88, priceVar: -0.06 },
  { id: 'S10', name: 'Supplier 10', country: 'IT', onTime: 0.87, quality: 0.95, priceVar: 0.04 },
  { id: 'S11', name: 'Supplier 11', country: 'IN', onTime: 0.84, quality: 0.89, priceVar: -0.01 },
  { id: 'S12', name: 'Supplier 12', country: 'AE', onTime: 0.96, quality: 0.93, priceVar: 0.0 },
  { id: 'S13', name: 'Supplier 13', country: 'PL', onTime: 0.9, quality: 0.94, priceVar: 0.02 },
  { id: 'S14', name: 'Supplier 14', country: 'NL', onTime: 0.93, quality: 0.96, priceVar: 0.03 },
  { id: 'S15', name: 'Supplier 15', country: 'AE', onTime: 0.95, quality: 0.9, priceVar: 0.0 },
  { id: 'S16', name: 'Supplier 16', country: 'IN', onTime: 0.85, quality: 0.9, priceVar: 0.0 },
];
