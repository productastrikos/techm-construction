// Illustrative commercial seed data for the Cost page: variation orders, contract packages, price indices.
// Everything here is SIMULATED; amounts are AED millions unless stated.
import { bi, type Bi } from '../../lib/bi';

export type VoStatus = 'approved' | 'pending' | 'review' | 'rejected';

export interface Variation {
  id: string;
  title: Bi;
  wbs: string;
  amountM: number;
  eotDays: number;
  status: VoStatus;
  raisedT: number;
}

export const VARIATIONS: Variation[] = [
  { id: 'VO-001', title: bi('Additional dredging - unforeseen rock layer in channel', 'تكريك إضافي - طبقة صخرية غير متوقعة في القناة'), wbs: 'DRG', amountM: 38.5, eotDays: 21, status: 'approved', raisedT: 40 },
  { id: 'VO-002', title: bi('Revised super-cone fender specification', 'تعديل مواصفات المصدّات المخروطية'), wbs: 'MAR', amountM: 14.0, eotDays: 0, status: 'approved', raisedT: 71 },
  { id: 'VO-003', title: bi('Relocation of utility corridor at gate', 'نقل ممر المرافق عند البوابة'), wbs: 'BLD', amountM: 4.6, eotDays: 6, status: 'approved', raisedT: 88 },
  { id: 'VO-004', title: bi('Apron pavement thickness - design change', 'تغيير تصميم سماكة رصف الساحة'), wbs: 'PAV', amountM: 11.2, eotDays: 0, status: 'approved', raisedT: 96 },
  { id: 'VO-005', title: bi('Omit landscaping package (value engineering)', 'حذف حزمة تنسيق المواقع (هندسة القيمة)'), wbs: 'BLD', amountM: -6.4, eotDays: 0, status: 'approved', raisedT: 101 },
  { id: 'VO-006', title: bi('Gate complex scope change', 'تغيير نطاق مجمع البوابة'), wbs: 'BLD', amountM: 9.8, eotDays: 10, status: 'pending', raisedT: 118 },
  { id: 'VO-007', title: bi('Additional reefer sockets - block C', 'مقابس حاويات مبردة إضافية - المجموعة ج'), wbs: 'EQP', amountM: 7.0, eotDays: 0, status: 'pending', raisedT: 124 },
  { id: 'VO-008', title: bi('Extended CCTV / PIDS coverage', 'توسيع تغطية الكاميرات وكشف التسلل'), wbs: 'EQP', amountM: 3.9, eotDays: 0, status: 'pending', raisedT: 130 },
  { id: 'VO-009', title: bi('Shamal weather standby - extension of time claim', 'انتظار الطقس (الشمال) - مطالبة بتمديد المدة'), wbs: 'MAR', amountM: 3.1, eotDays: 12, status: 'review', raisedT: 136 },
  { id: 'VO-010', title: bi('Price escalation - imported equipment (chokepoint disruption)', 'تصعيد الأسعار - معدات مستوردة (اضطراب نقطة الاختناق)'), wbs: 'EQP', amountM: 22.0, eotDays: 0, status: 'review', raisedT: 141 },
  { id: 'VO-011', title: bi('Contractor request: night-time dredging premium', 'طلب المقاول: علاوة التكريك الليلي'), wbs: 'DRG', amountM: 5.5, eotDays: 0, status: 'rejected', raisedT: 112 },
];

export interface Contract {
  id: string;
  title: Bi;
  party: string;
  wbs: string;
  valueShare: number;
  type: 'Lump sum' | 'Re-measurable' | 'Supply';
}

/** fictional contractors / suppliers */
export const CONTRACTS: Contract[] = [
  { id: 'C-01', title: bi('Dredging & reclamation', 'التكريك والردم'), party: 'Contractor A', wbs: 'DRG', valueShare: 0.24, type: 'Re-measurable' },
  { id: 'C-02', title: bi('Marine structures (quay, revetment)', 'المنشآت البحرية (الرصيف والحماية)'), party: 'Contractor B', wbs: 'MAR', valueShare: 0.31, type: 'Lump sum' },
  { id: 'C-03', title: bi('Pavements & yard', 'الرصف والساحات'), party: 'Contractor C', wbs: 'PAV', valueShare: 0.11, type: 'Re-measurable' },
  { id: 'C-04', title: bi('Buildings & utilities', 'المباني والمرافق'), party: 'Contractor E', wbs: 'BLD', valueShare: 0.12, type: 'Lump sum' },
  { id: 'C-05', title: bi('Port equipment supply', 'توريد معدات الميناء'), party: 'Multiple suppliers (see Procurement)', wbs: 'EQP', valueShare: 0.2, type: 'Supply' },
  { id: 'C-06', title: bi('Power, ICT & security systems', 'الطاقة وتقنية المعلومات والأمن'), party: 'Contractor D', wbs: 'COM', valueShare: 0.02, type: 'Lump sum' },
];

/** monthly price indices, base 100 at project start: [steel, container freight, AED/USD peg (fixed), EUR/AED] */
export function priceIndices(months: number): Array<{ m: number; steel: number; freight: number; eur: number }> {
  const out: Array<{ m: number; steel: number; freight: number; eur: number }> = [];
  for (let m = 0; m <= months; m++) {
    const steel = 100 + m * 0.9 + 3 * Math.sin(m / 2.1) + (m > 3 ? Math.min(8, (m - 3) * 1.6) : 0);
    // freight: calm, then a shock around month 4-6, easing slowly
    const shock = m < 4 ? 0 : 55 * Math.exp(-Math.pow((m - 6.5) / 3.6, 2));
    const freight = 100 + 2 * Math.sin(m) + shock;
    const eur = 4.0 + 0.03 * Math.sin(m / 1.7);
    out.push({ m, steel: Math.round(steel * 10) / 10, freight: Math.round(freight * 10) / 10, eur: Math.round(eur * 1000) / 1000 });
  }
  return out;
}
