// Illustrative document-control and quality seed data (SIMULATED). Dates are days offsets from the data date.
import { bi, type Bi } from '../../lib/bi';

export type DrawStatus = 'IFC' | 'AFC' | 'IFA' | 'IFR';
export interface Drawing {
  no: string;
  title: Bi;
  disc: 'Marine' | 'Civil' | 'Architectural' | 'Electrical' | 'Mechanical';
  rev: string;
  status: DrawStatus;
  daysAgo: number;
  trans: string;
}

export const DRAWINGS: Drawing[] = [
  { no: 'POC-MAR-DWG-0101', title: bi('Quay wall - typical cross-section', 'جدار الرصيف - مقطع عرضي نموذجي'), disc: 'Marine', rev: 'C', status: 'AFC', daysAgo: 12, trans: 'TR-0142' },
  { no: 'POC-MAR-DWG-0102', title: bi('Caisson reinforcement - unit type A', 'تسليح الصندوق - النوع أ'), disc: 'Marine', rev: 'B', status: 'AFC', daysAgo: 30, trans: 'TR-0131' },
  { no: 'POC-MAR-DWG-0140', title: bi('Super-cone fender layout, berth 1', 'مخطط المصدّات المخروطية، الرصيف 1'), disc: 'Marine', rev: 'D', status: 'IFC', daysAgo: 4, trans: 'TR-0151' },
  { no: 'POC-MAR-DWG-0210', title: bi('Rock revetment - section and gradation', 'حماية صخرية - المقطع والتدرج'), disc: 'Marine', rev: 'B', status: 'AFC', daysAgo: 52, trans: 'TR-0118' },
  { no: 'POC-CIV-DWG-0301', title: bi('Apron pavement - structural build-up', 'رصف الساحة - طبقات الهيكل'), disc: 'Civil', rev: 'E', status: 'IFC', daysAgo: 9, trans: 'TR-0146' },
  { no: 'POC-CIV-DWG-0322', title: bi('Container yard drainage plan', 'مخطط تصريف ساحة الحاويات'), disc: 'Civil', rev: 'A', status: 'IFA', daysAgo: 6, trans: 'TR-0148' },
  { no: 'POC-CIV-DWG-0340', title: bi('Crane rail foundation detail', 'تفصيل أساس سكة الرافعة'), disc: 'Civil', rev: 'C', status: 'AFC', daysAgo: 21, trans: 'TR-0139' },
  { no: 'POC-ARC-DWG-0501', title: bi('Gate complex - floor plans', 'مجمع البوابة - مخططات الطوابق'), disc: 'Architectural', rev: 'B', status: 'IFR', daysAgo: 3, trans: 'TR-0153' },
  { no: 'POC-ARC-DWG-0520', title: bi('Administration building - elevations', 'مبنى الإدارة - الواجهات'), disc: 'Architectural', rev: 'A', status: 'IFA', daysAgo: 15, trans: 'TR-0136' },
  { no: 'POC-ELE-DWG-0701', title: bi('Substation S1 - single line diagram', 'محطة S1 - المخطط أحادي الخط'), disc: 'Electrical', rev: 'C', status: 'IFC', daysAgo: 8, trans: 'TR-0147' },
  { no: 'POC-ELE-DWG-0730', title: bi('High-mast lighting layout', 'مخطط أعمدة الإنارة العالية'), disc: 'Electrical', rev: 'B', status: 'AFC', daysAgo: 40, trans: 'TR-0125' },
  { no: 'POC-MEC-DWG-0801', title: bi('Workshop HVAC schematic', 'مخطط تكييف الورشة'), disc: 'Mechanical', rev: 'A', status: 'IFR', daysAgo: 2, trans: 'TR-0154' },
];

export type RfiStatus = 'open' | 'answered' | 'overdue' | 'closed';
export interface Rfi {
  id: string;
  subject: Bi;
  from: string;
  to: string;
  daysOpen: number;
  status: RfiStatus;
  scheduleDays: number;
  costM: number;
}

export const RFIS: Rfi[] = [
  { id: 'RFI-031', subject: bi('Caisson corner-unit tolerance clarification', 'توضيح تفاوت وحدات زاوية الصناديق'), from: 'Contractor B', to: 'Design consultant', daysOpen: 6, status: 'open', scheduleDays: 3, costM: 0 },
  { id: 'RFI-030', subject: bi('Crane rail alignment tolerance at expansion joint', 'تفاوت محاذاة سكة الرافعة عند فاصل التمدد'), from: 'Contractor E', to: 'Design consultant', daysOpen: 14, status: 'overdue', scheduleDays: 5, costM: 0.4 },
  { id: 'RFI-029', subject: bi('Alternative rock source - quarry B grading', 'مصدر صخور بديل - تدرج المحجر B'), from: 'Contractor A', to: 'Engineer', daysOpen: 3, status: 'open', scheduleDays: 0, costM: -1.2 },
  { id: 'RFI-028', subject: bi('Fender panel colour and UV spec', 'لون ألواح المصدّات ومواصفات الأشعة'), from: 'Contractor B', to: 'Engineer', daysOpen: 0, status: 'answered', scheduleDays: 0, costM: 0 },
  { id: 'RFI-027', subject: bi('Reefer socket block C power rating', 'قدرة مقابس المبردات في المجموعة ج'), from: 'Contractor D', to: 'Design consultant', daysOpen: 9, status: 'open', scheduleDays: 2, costM: 0.9 },
  { id: 'RFI-026', subject: bi('Drainage outfall level vs tide range', 'منسوب مصب الصرف مقابل مدى المد'), from: 'Contractor C', to: 'Engineer', daysOpen: 0, status: 'closed', scheduleDays: 0, costM: 0 },
  { id: 'RFI-025', subject: bi('Substation earthing conflict with cable trench', 'تعارض تأريض المحطة مع مجرى الكابلات'), from: 'Contractor E', to: 'Design consultant', daysOpen: 18, status: 'overdue', scheduleDays: 4, costM: 0.2 },
  { id: 'RFI-024', subject: bi('Gate canopy wind-load criteria', 'معايير حمل الرياح لمظلة البوابة'), from: 'Contractor E', to: 'Design consultant', daysOpen: 0, status: 'closed', scheduleDays: 0, costM: 0 },
];

export type SubStatus = 'submitted' | 'approved' | 'noted' | 'rejected';
export interface Submittal {
  id: string;
  item: Bi;
  spec: string;
  status: SubStatus;
  daysInReview: number;
}

export const SUBMITTALS: Submittal[] = [
  { id: 'SUB-114', item: bi('Super-cone fender - type approval data', 'المصدّات المخروطية - بيانات الاعتماد'), spec: '05 50 00', status: 'submitted', daysInReview: 11 },
  { id: 'SUB-113', item: bi('Concrete mix design M45 marine', 'تصميم خلطة خرسانة M45 بحرية'), spec: '03 30 00', status: 'approved', daysInReview: 0 },
  { id: 'SUB-112', item: bi('STS crane - structural calculation package', 'رافعة STS - حزمة الحسابات الإنشائية'), spec: '14 50 00', status: 'noted', daysInReview: 0 },
  { id: 'SUB-111', item: bi('Geotextile product data', 'بيانات الأقمشة الجيوتقنية'), spec: '31 32 19', status: 'approved', daysInReview: 0 },
  { id: 'SUB-110', item: bi('MV switchgear - factory test procedure', 'مفاتيح الجهد المتوسط - إجراء الاختبار'), spec: '26 13 00', status: 'submitted', daysInReview: 5 },
  { id: 'SUB-109', item: bi('Rebar mill certificates - batch 7', 'شهادات مصنع الحديد - الدفعة 7'), spec: '03 21 00', status: 'rejected', daysInReview: 0 },
  { id: 'SUB-108', item: bi('Asphalt job-mix formula', 'تركيبة خلطة الأسفلت'), spec: '32 12 16', status: 'approved', daysInReview: 0 },
  { id: 'SUB-107', item: bi('High-mast luminaire photometrics', 'القياسات الضوئية لأعمدة الإنارة'), spec: '26 56 00', status: 'submitted', daysInReview: 3 },
];

export interface Ncr {
  id: string;
  title: Bi;
  severity: 'minor' | 'major';
  area: Bi;
  daysOpen: number;
  status: 'open' | 'rectifying' | 'closed';
}

export const NCRS: Ncr[] = [
  { id: 'NCR-018', title: bi('Honeycombing at caisson unit C-07 lift joint', 'تعشيش في وصلة الصندوق C-07'), severity: 'major', area: bi('Caisson yard', 'ساحة الصناديق'), daysOpen: 9, status: 'rectifying' },
  { id: 'NCR-017', title: bi('Rebar cover below specification at slab edge', 'غطاء الحديد أقل من المواصفة عند حافة البلاطة'), severity: 'minor', area: bi('Apron A1', 'الساحة A1'), daysOpen: 4, status: 'open' },
  { id: 'NCR-016', title: bi('Rock gradation outside envelope - load 214', 'تدرج الصخور خارج النطاق - الحمولة 214'), severity: 'minor', area: bi('Revetment', 'الحماية الصخرية'), daysOpen: 12, status: 'rectifying' },
  { id: 'NCR-015', title: bi('Paver compaction test below 95%', 'اختبار دمك البلاط أقل من 95%'), severity: 'minor', area: bi('Yard 2', 'الساحة 2'), daysOpen: 20, status: 'closed' },
  { id: 'NCR-014', title: bi('Weld defect on fender bracket', 'عيب لحام في حامل المصد'), severity: 'major', area: bi('Berth 1', 'الرصيف 1'), daysOpen: 2, status: 'open' },
];

/** 28-day cube strengths, MPa (illustrative) vs M45 characteristic strength 45 MPa */
export const CUBES: number[] = [51.2, 49.8, 52.6, 48.1, 50.4, 47.9, 53.2, 49.1, 51.7, 46.8, 50.9, 48.5, 52.1, 47.2, 49.6, 51.0, 44.1, 50.2, 48.9, 52.8];

export interface Snag {
  id: string;
  item: Bi;
  trade: string;
  priority: 'low' | 'medium' | 'high';
  status: 'open' | 'fixed' | 'verified';
}

export const SNAGS: Snag[] = [
  { id: 'SN-201', item: bi('Gate cabin door closer misaligned', 'ضبط قفل باب كشك البوابة'), trade: 'Architectural', priority: 'low', status: 'open' },
  { id: 'SN-202', item: bi('Missing handrail bracket at quay access stair', 'حامل درابزين مفقود عند سلم الرصيف'), trade: 'Marine', priority: 'high', status: 'open' },
  { id: 'SN-203', item: bi('Paint touch-up on fender frames', 'ترميم الطلاء على إطارات المصدّات'), trade: 'Marine', priority: 'low', status: 'fixed' },
  { id: 'SN-204', item: bi('Drain cover not flush with pavement', 'غطاء المصرف غير مستوٍ مع الرصف'), trade: 'Civil', priority: 'medium', status: 'open' },
  { id: 'SN-205', item: bi('Cable gland missing at panel LV-2', 'غلاف كابل مفقود في اللوحة LV-2'), trade: 'Electrical', priority: 'high', status: 'fixed' },
  { id: 'SN-206', item: bi('Sealant gap at workshop cladding joint', 'فجوة مانع التسرب في وصلة كسوة الورشة'), trade: 'Architectural', priority: 'medium', status: 'verified' },
];
