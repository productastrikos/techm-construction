// Illustrative HSE seed data (SIMULATED): observation categories, permits, incident log, camera detections.
import { bi, type Bi } from '../../lib/bi';
import type { ImageId } from '../../lib/images';

/** month (1..12) -> typical afternoon WBGT in deg C on the coast (illustrative) */
export const WBGT_BY_MONTH = [22.5, 23.5, 25.5, 28, 30.5, 32.5, 33.5, 33.8, 32, 29, 25.5, 23];

export const OBS_CATEGORIES: Array<{ k: string; name: Bi; pos: number; neg: number }> = [
  { k: 'height', name: bi('Working at height', 'العمل على الارتفاعات'), pos: 41, neg: 14 },
  { k: 'lifting', name: bi('Lifting operations', 'عمليات الرفع'), pos: 36, neg: 17 },
  { k: 'excavation', name: bi('Excavation', 'الحفر'), pos: 24, neg: 9 },
  { k: 'ppe', name: bi('PPE', 'معدات الوقاية'), pos: 63, neg: 28 },
  { k: 'housekeeping', name: bi('Housekeeping', 'النظافة والترتيب'), pos: 38, neg: 22 },
  { k: 'traffic', name: bi('Traffic & vehicles', 'حركة المركبات'), pos: 29, neg: 15 },
  { k: 'marine', name: bi('Marine operations', 'العمليات البحرية'), pos: 27, neg: 8 },
  { k: 'electrical', name: bi('Electrical', 'الكهرباء'), pos: 19, neg: 5 },
];

export const TRAINING: Array<{ name: Bi; hours: number }> = [
  { name: bi('Work permit system', 'نظام تصاريح العمل'), hours: 230 },
  { name: bi('Working at height', 'العمل على الارتفاعات'), hours: 140 },
  { name: bi('Lifting & rigging', 'الرفع والتحميل'), hours: 188 },
  { name: bi('Marine safety & PFD', 'السلامة البحرية'), hours: 126 },
  { name: bi('Heat-stress awareness', 'التوعية بالإجهاد الحراري'), hours: 154 },
  { name: bi('Confined space entry', 'دخول الأماكن المغلقة'), hours: 88 },
];

export type PermitKind = 'hot' | 'lift' | 'confined' | 'marine' | 'excavation' | 'electrical';
export type PermitStatus = 'requested' | 'approved' | 'active' | 'suspended' | 'closed';

export interface Permit {
  id: string;
  kind: PermitKind;
  title: Bi;
  area: Bi;
  contractor: string;
  status: PermitStatus;
  /** hours, local */
  from: string;
  to: string;
}

export const PERMITS: Permit[] = [
  { id: 'PTW-2301', kind: 'lift', title: bi('Critical lift - 85 t precast quay unit', 'رفع حرج - وحدة رصيف جاهزة 85 طن'), area: bi('Berth 1, quay wall', 'الرصيف 1، جدار الرصيف'), contractor: 'Contractor B', status: 'active', from: '07:00', to: '15:30' },
  { id: 'PTW-2302', kind: 'marine', title: bi('Barge mooring and dredge pipeline relocation', 'تثبيت الصنادل ونقل خط التكريك'), area: bi('Channel km 0.8-1.4', 'القناة كم 0.8-1.4'), contractor: 'Contractor A', status: 'active', from: '06:00', to: '17:00' },
  { id: 'PTW-2303', kind: 'hot', title: bi('Welding of fender panel brackets', 'لحام حوامل ألواح المصدّات'), area: bi('Berth 1, deck', 'الرصيف 1، السطح'), contractor: 'Contractor B', status: 'approved', from: '08:00', to: '14:00' },
  { id: 'PTW-2304', kind: 'confined', title: bi('Entry into caisson cell C-12 for inspection', 'دخول خلية الصندوق C-12 للفحص'), area: bi('Caisson yard', 'ساحة الصناديق'), contractor: 'Contractor B', status: 'requested', from: '09:00', to: '11:00' },
  { id: 'PTW-2305', kind: 'excavation', title: bi('Trenching for MV cable route', 'حفر مسار كابلات الجهد المتوسط'), area: bi('Utility corridor U2', 'ممر المرافق U2'), contractor: 'Contractor E', status: 'active', from: '07:00', to: '16:00' },
  { id: 'PTW-2306', kind: 'electrical', title: bi('Energisation of temporary 11 kV substation', 'تشغيل محطة 11 كيلوفولت المؤقتة'), area: bi('Substation S1', 'المحطة S1'), contractor: 'Contractor D', status: 'suspended', from: '10:00', to: '13:00' },
  { id: 'PTW-2299', kind: 'lift', title: bi('Tower crane jump - section 4', 'رفع قسم الرافعة البرجية 4'), area: bi('Admin building', 'مبنى الإدارة'), contractor: 'Contractor E', status: 'closed', from: '07:00', to: '12:00' },
];

export interface Incident {
  id: string;
  daysAgo: number;
  type: 'near-miss' | 'first-aid' | 'property' | 'environment';
  severity: 1 | 2 | 3 | 4;
  title: Bi;
  status: 'open' | 'investigating' | 'closed';
}

export const INCIDENTS: Incident[] = [
  { id: 'INC-0412', daysAgo: 2, type: 'near-miss', severity: 3, title: bi('Load swung towards walkway during precast lift', 'اتجاه الحمل نحو الممر أثناء رفع الوحدة الجاهزة'), status: 'investigating' },
  { id: 'INC-0411', daysAgo: 5, type: 'first-aid', severity: 1, title: bi('Minor hand laceration - rebar fixing', 'جرح طفيف باليد - تثبيت حديد التسليح'), status: 'closed' },
  { id: 'INC-0409', daysAgo: 9, type: 'property', severity: 2, title: bi('Dump truck reversed into barrier', 'شاحنة قلابة ارتدت نحو الحاجز'), status: 'closed' },
  { id: 'INC-0407', daysAgo: 14, type: 'environment', severity: 2, title: bi('Turbidity above limit at silt-curtain monitoring buoy', 'عكارة تتجاوز الحد عند عوامة الرصد'), status: 'closed' },
  { id: 'INC-0405', daysAgo: 21, type: 'near-miss', severity: 2, title: bi('Unsecured scaffold board dropped from level 2', 'سقوط لوح سقالة غير مثبت من الطابق الثاني'), status: 'closed' },
  { id: 'INC-0402', daysAgo: 33, type: 'near-miss', severity: 2, title: bi('Pedestrian entered forklift route in yard', 'دخول مشاة إلى مسار الرافعة الشوكية في الساحة'), status: 'closed' },
  { id: 'INC-0398', daysAgo: 47, type: 'first-aid', severity: 1, title: bi('Heat exhaustion - worker treated on site', 'إجهاد حراري - عولج العامل في الموقع'), status: 'closed' },
];

export interface Detection {
  /** percent of frame */
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  conf: number;
  tone: 'good' | 'warn' | 'bad' | 'info';
}

export interface CameraDef {
  id: string;
  image: ImageId;
  name: Bi;
  detections: Detection[];
  zone?: { x: number; y: number; w: number; h: number; label: Bi };
}

export const CAMERAS: CameraDef[] = [
  {
    id: 'CAM-GATE-01',
    image: 'cctv-gate',
    name: bi('Main gate', 'البوابة الرئيسية'),
    detections: [
      { x: 72, y: 40, w: 19, h: 26, label: 'Truck', conf: 0.96, tone: 'info' },
      { x: 48, y: 36, w: 16, h: 28, label: 'Gate cabin', conf: 0.9, tone: 'info' },
      { x: 31, y: 48, w: 4, h: 9, label: 'Person', conf: 0.88, tone: 'good' },
    ],
  },
  {
    id: 'CAM-QUAY-01',
    image: 'cctv-quay',
    name: bi('Quay edge - berth 1', 'حافة الرصيف - الرصيف 1'),
    zone: { x: 48, y: 36, w: 24, h: 40, label: bi('Lifting exclusion zone', 'منطقة حظر الرفع') },
    detections: [
      { x: 20, y: 2, w: 30, h: 50, label: 'Crane', conf: 0.97, tone: 'info' },
      { x: 52, y: 38, w: 10, h: 15, label: 'Load', conf: 0.91, tone: 'info' },
      { x: 62, y: 62, w: 5, h: 13, label: 'Person IN ZONE', conf: 0.93, tone: 'bad' },
      { x: 86, y: 74, w: 4, h: 11, label: 'Person', conf: 0.9, tone: 'good' },
    ],
  },
  {
    id: 'CAM-YARD-02',
    image: 'cctv-yard',
    name: bi('Laydown yard', 'ساحة التخزين'),
    detections: [
      { x: 43, y: 46, w: 11, h: 13, label: 'Forklift', conf: 0.94, tone: 'info' },
      { x: 71, y: 3, w: 14, h: 36, label: 'Mobile crane', conf: 0.95, tone: 'info' },
      { x: 53, y: 55, w: 4, h: 10, label: 'Person - no hi-vis', conf: 0.82, tone: 'warn' },
    ],
  },
  {
    id: 'CAM-BATCH-01',
    image: 'cctv-batching',
    name: bi('Batching plant', 'محطة الخلط'),
    detections: [
      { x: 10, y: 46, w: 12, h: 15, label: 'Mixer truck', conf: 0.95, tone: 'info' },
      { x: 40, y: 49, w: 11, h: 17, label: 'Mixer truck', conf: 0.93, tone: 'info' },
      { x: 21, y: 2, w: 28, h: 40, label: 'Silo', conf: 0.89, tone: 'info' },
    ],
  },
];

export interface HseEvent {
  id: string;
  cam: string;
  severity: 'crit' | 'warn' | 'info';
  title: Bi;
  sop: Bi;
  minsAgo: number;
}

export const EVENTS: HseEvent[] = [
  { id: 'EV-1', cam: 'CAM-QUAY-01', severity: 'crit', title: bi('Person detected inside the lifting exclusion zone', 'رصد شخص داخل منطقة حظر الرفع'), sop: bi('SOP-L-04: stop the lift, hold the load, clear the zone, supervisor sign-off before resuming.', 'إجراء SOP-L-04: إيقاف الرفع وتثبيت الحمل وإخلاء المنطقة وموافقة المشرف قبل المتابعة.'), minsAgo: 1 },
  { id: 'EV-2', cam: 'CAM-YARD-02', severity: 'warn', title: bi('Worker without high-visibility vest near forklift route', 'عامل بدون سترة عاكسة قرب مسار الرافعة الشوكية'), sop: bi('SOP-P-02: stop work for the individual, issue PPE, record a toolbox-talk action.', 'إجراء SOP-P-02: إيقاف العامل وتزويده بالمعدات وتسجيل إجراء توعية.'), minsAgo: 6 },
  { id: 'EV-3', cam: 'CAM-GATE-01', severity: 'info', title: bi('Vehicle without a valid gate pass queued at barrier', 'مركبة بدون تصريح دخول صالح عند الحاجز'), sop: bi('SOP-S-01: hold at barrier, verify with the access-control desk.', 'إجراء SOP-S-01: التوقف عند الحاجز والتحقق من مكتب التحكم بالدخول.'), minsAgo: 12 },
  { id: 'EV-4', cam: 'CAM-BATCH-01', severity: 'info', title: bi('Two mixer trucks queued at the plant - loading delay about 14 min', 'شاحنتا خلط في الانتظار - تأخير التحميل نحو 14 دقيقة'), sop: bi('Planning note: re-sequence pours or add a loading bay.', 'ملاحظة تخطيط: إعادة ترتيب الصبّات أو إضافة منفذ تحميل.'), minsAgo: 18 },
];
