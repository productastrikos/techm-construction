// Port pack: materials (~40) and purchase-order seeds (30). ILLUSTRATIVE quantities / values / suppliers (fictional).
import { bi } from '../../lib/bi';
import type { Material, Origin } from '../../engine/types';

const m = (
  id: string,
  en: string,
  ar: string,
  cls: Material['cls'],
  unit: string,
  origin: Origin,
  exposure: number,
  leadTimeDays: number,
  domestic?: Material['domestic'],
): Material => ({ id, name: bi(en, ar), cls, unit, origin, exposure, leadTimeDays, domestic });

export const portMaterials: Material[] = [
  // ---- domestic bulk (low exposure)
  m('M-ROCKA', 'Rock armour 3-6 t', 'صخور الحماية 3-6 طن', 'domestic-bulk', 't', 'AE', 0.05, 7),
  m('M-ROCKC', 'Quarry-run rock core', 'صخور النواة (محجر)', 'domestic-bulk', 't', 'AE', 0.05, 5),
  m('M-AGG', 'Concrete aggregates', 'ركام الخرسانة', 'domestic-bulk', 't', 'AE', 0.05, 5),
  m('M-CEM', 'Cement (OPC / slag blend)', 'الإسمنت (بورتلاندي / خبث)', 'domestic-bulk', 't', 'AE', 0.08, 7),
  m('M-SAND', 'Reclamation sand fill', 'رمال الردم', 'domestic-bulk', 'm3', 'AE', 0.0, 3),
  m('M-ASPH', 'Asphalt & bitumen', 'الأسفلت والبيتومين', 'domestic-bulk', 't', 'AE', 0.1, 10),
  m('M-REBAR', 'Reinforcement steel (domestic mill)', 'حديد التسليح (مصنع محلي)', 'domestic-bulk', 't', 'AE', 0.1, 14),
  m('M-PRECAST', 'Precast kerbs & drainage units', 'الأرصفة ووحدات الصرف الجاهزة', 'domestic-bulk', 'pcs', 'AE', 0.05, 21),
  m('M-PAVER', 'Interlocking concrete pavers', 'بلاط الرصف المتشابك', 'domestic-bulk', 'm2', 'AE', 0.05, 21),
  m('M-READY', 'Ready-mix (site batching plant)', 'خرسانة جاهزة (محطة الموقع)', 'domestic-bulk', 'm3', 'AE', 0.05, 1),
  // ---- imported long-lead (high exposure)
  m('M-STS', 'Ship-to-shore gantry cranes', 'رافعات الرصيف العملاقة (STS)', 'imported-long-lead', 'set', 'CN', 0.95, 420),
  m('M-MHC', 'Mobile harbour crane', 'رافعة الميناء المتنقلة', 'imported-long-lead', 'unit', 'EU', 0.9, 300),
  m('M-RS', 'Reach stackers & terminal tractors', 'الرافعات الجانبية وجرارات المحطة', 'imported-long-lead', 'lot', 'CN', 0.85, 150),
  m('M-FEND', 'Super-cone quay fenders', 'مصدّات الرصيف المخروطية', 'imported-long-lead', 'lot', 'TR', 0.9, 120, { leadDays: 75, costFactor: 1.18, note: bi('Regional fabricator (reduced rubber grade)', 'مصنّع إقليمي (درجة مطاط مخفضة)') }),
  m('M-RAIL', 'Crane rails, clips & elastomer pads', 'سكك الرافعات والمثبتات والوسادات', 'imported-long-lead', 'lot', 'EU', 0.92, 110),
  m('M-MVSG', 'MV/LV switchgear', 'مفاتيح الجهد المتوسط والمنخفض', 'imported-long-lead', 'lot', 'EU', 0.9, 160),
  m('M-TRF', 'Power transformers', 'محولات القدرة', 'imported-long-lead', 'lot', 'EU', 0.9, 200),
  m('M-HVAC', 'HVAC chillers & air handlers', 'مبردات المياه ووحدات معالجة الهواء', 'imported-long-lead', 'lot', 'IN', 0.8, 150),
  m('M-LIFT', 'Lifts & escalators', 'المصاعد والسلالم المتحركة', 'imported-long-lead', 'lot', 'EU', 0.85, 130),
  m('M-MAST', 'High-mast lighting & LED luminaires', 'أعمدة الإنارة العالية ومصابيح LED', 'imported-long-lead', 'lot', 'CN', 0.85, 90),
  m('M-REEFS', 'Reefer sockets & monitoring', 'مقابس الحاويات المبردة والمراقبة', 'imported-long-lead', 'lot', 'IN', 0.7, 90),
  m('M-NAV', 'Navigation & berthing aids', 'وسائل الملاحة والرسو', 'imported-long-lead', 'lot', 'EU', 0.7, 90),
  m('M-CCTV', 'CCTV, PIDS & access control', 'كاميرات المراقبة والتحكم بالدخول', 'imported-long-lead', 'lot', 'CN', 0.7, 70),
  m('M-TOS', 'Terminal operating system servers', 'خوادم نظام تشغيل المحطة', 'imported-long-lead', 'lot', 'EU', 0.6, 60),
  // ---- imported standard
  m('M-SHEET', 'Steel sheet piles', 'ألواح ستائر فولاذية', 'imported-standard', 't', 'CN', 0.5, 45),
  m('M-GEOT', 'Geotextile & geogrid', 'الأقمشة والشبكات الجيوتقنية', 'imported-standard', 'm2', 'EU', 0.55, 40),
  m('M-FORM', 'Steel caisson formwork system', 'نظام القوالب الفولاذية للصناديق', 'imported-standard', 'set', 'IN', 0.6, 60),
  m('M-COAT', 'Marine admixtures & coatings', 'الإضافات والطلاءات البحرية', 'imported-standard', 'lot', 'EU', 0.5, 25),
  m('M-BOLL', 'Bollards & quay furniture', 'الأعمدة الرابطة وتجهيزات الرصيف', 'imported-standard', 'lot', 'IN', 0.55, 70),
  m('M-CABLE', 'MV/LV power cables', 'كابلات الطاقة', 'imported-standard', 'km', 'TR', 0.5, 90),
  m('M-GEN', 'Standby diesel generators', 'مولدات الديزل الاحتياطية', 'imported-standard', 'unit', 'EU', 0.6, 140),
  m('M-FIRE', 'Fire-fighting equipment & foam', 'معدات الإطفاء والرغوة', 'imported-standard', 'lot', 'TR', 0.5, 70),
  m('M-CLAD', 'Cladding panels & doors', 'ألواح الكسوة والأبواب', 'imported-standard', 'lot', 'CN', 0.5, 60),
  m('M-STEEL', 'Structural steel (buildings)', 'الحديد الإنشائي للمباني', 'imported-standard', 't', 'IN', 0.45, 70),
  m('M-PIPE', 'HDPE / ductile-iron pipes', 'أنابيب HDPE والحديد المطيلي', 'imported-standard', 'km', 'TR', 0.4, 45),
  m('M-PUMP', 'Pumps & pump-sets', 'المضخات ومجموعاتها', 'imported-standard', 'lot', 'EU', 0.55, 80),
  m('M-DOOR', 'Doors, glazing & ironmongery', 'الأبواب والزجاج والإكسسوارات', 'imported-standard', 'lot', 'CN', 0.4, 50),
  m('M-EXPJ', 'Expansion joints & bearings', 'فواصل التمدد والمساند', 'imported-standard', 'lot', 'EU', 0.5, 60),
  m('M-SILT', 'Silt curtains & monitoring buoys', 'ستائر الطمي وعوامات الرصد', 'imported-standard', 'lot', 'CN', 0.4, 45),
  m('M-DREDGESP', 'Dredger spare pump & wear parts', 'مضخة احتياطية وقطع تآكل للكراكة', 'imported-standard', 'lot', 'EU', 0.5, 60),
  m('M-PIEZO', 'Piezometers & settlement plates', 'أجهزة قياس الضغط وألواح الهبوط', 'imported-standard', 'lot', 'CN', 0.3, 35),
  m('M-RIGGING', 'Caisson lifting beams & rigging', 'عوارض رفع الصناديق ومعدات الربط', 'imported-standard', 'lot', 'IN', 0.5, 50),
  m('M-TANK', 'GRP / steel storage tanks', 'خزانات التخزين', 'imported-standard', 'lot', 'TR', 0.4, 55),
];

export interface PoSeed {
  id: string;
  materialId: string;
  supplierId: string;
  qty: number;
  valueM: number; // AED millions
  weightT: number;
  routeId: string;
  incoterm: string;
  prodDays: number;
  qaDays: number;
  /** days of float between planned arrival and the consuming activity's earliest start */
  cover: number;
  deliveryActivityId: string;
  /** order release date [y, m, d]: production stretches from here to the planned ship date */
  orderedOn?: [number, number, number];
  airEligible: boolean;
  /** slip already visible at the data date (days) */
  slip: number;
  stockTransferDays?: number;
}

// cover = deliberately tight for Chokepoint-exposed items so the 5-week disruption bites (H1)
export const portPoSeeds: PoSeed[] = [
  { id: 'PO-001', materialId: 'M-FORM', supplierId: 'S02', qty: 1, valueM: 18.5, weightT: 420, routeId: 'R-PTA', incoterm: 'CFR', prodDays: 30, qaDays: 6, cover: 10, deliveryActivityId: 'DEL-FORM', orderedOn: [2026, 11, 10], airEligible: false, slip: 0 },
  { id: 'PO-002', materialId: 'M-SHEET', supplierId: 'S01', qty: 600, valueM: 9.1, weightT: 600, routeId: 'R-PTC', incoterm: 'CFR', prodDays: 20, qaDays: 4, cover: 14, deliveryActivityId: 'DEL-SHEET', orderedOn: [2026, 11, 3], airEligible: false, slip: 0 },
  { id: 'PO-003', materialId: 'M-REBAR', supplierId: 'S12', qty: 2400, valueM: 6.8, weightT: 2400, routeId: 'R-LOC', incoterm: 'DAP', prodDays: 8, qaDays: 2, cover: 12, deliveryActivityId: 'DEL-REBAR1', orderedOn: [2026, 12, 10], airEligible: false, slip: 0 },
  { id: 'PO-004', materialId: 'M-GEOT', supplierId: 'S13', qty: 180000, valueM: 4.2, weightT: 85, routeId: 'R-PTA', incoterm: 'CFR', prodDays: 18, qaDays: 4, cover: 21, deliveryActivityId: 'DEL-GEOT', orderedOn: [2026, 11, 5], airEligible: false, slip: 9 },
  { id: 'PO-005', materialId: 'M-COAT', supplierId: 'S03', qty: 1, valueM: 2.6, weightT: 60, routeId: 'R-PTC', incoterm: 'CFR', prodDays: 14, qaDays: 4, cover: 30, deliveryActivityId: 'DEL-COAT', orderedOn: [2026, 11, 25], airEligible: true, slip: 0 },
  { id: 'PO-006', materialId: 'M-REBAR', supplierId: 'S12', qty: 3100, valueM: 8.7, weightT: 3100, routeId: 'R-LOC', incoterm: 'DAP', prodDays: 8, qaDays: 2, cover: 25, deliveryActivityId: 'DEL-REBAR2', orderedOn: [2027, 2, 20], airEligible: false, slip: 0 },
  { id: 'PO-007', materialId: 'M-PRECAST', supplierId: 'S06', qty: 4200, valueM: 5.5, weightT: 3800, routeId: 'R-LOC', incoterm: 'DAP', prodDays: 35, qaDays: 3, cover: 20, deliveryActivityId: 'DEL-PRECAST', orderedOn: [2027, 2, 5], airEligible: false, slip: 0 },
  { id: 'PO-008', materialId: 'M-FEND', supplierId: 'S03', qty: 36, valueM: 22.5, weightT: 180, routeId: 'R-PTA', incoterm: 'CFR', prodDays: 120, qaDays: 15, cover: 17, deliveryActivityId: 'DEL-FEND1', orderedOn: [2026, 12, 10], airEligible: false, slip: 0 },
  { id: 'PO-009', materialId: 'M-FEND', supplierId: 'S03', qty: 24, valueM: 14.0, weightT: 95, routeId: 'R-PTA', incoterm: 'CFR', prodDays: 130, qaDays: 15, cover: 24, deliveryActivityId: 'DEL-FEND2', orderedOn: [2026, 12, 10], airEligible: false, slip: 0 },
  { id: 'PO-010', materialId: 'M-RAIL', supplierId: 'S04', qty: 1, valueM: 11.8, weightT: 780, routeId: 'R-PTA', incoterm: 'CFR', prodDays: 100, qaDays: 20, cover: 4, deliveryActivityId: 'DEL-RAIL', orderedOn: [2027, 1, 5], airEligible: false, slip: 0 },
  { id: 'PO-011', materialId: 'M-BOLL', supplierId: 'S02', qty: 96, valueM: 6.4, weightT: 210, routeId: 'R-PTC', incoterm: 'CFR', prodDays: 60, qaDays: 10, cover: 40, deliveryActivityId: 'DEL-BOLL', airEligible: false, slip: 0 },
  { id: 'PO-012', materialId: 'M-STS', supplierId: 'S01', qty: 2, valueM: 106, weightT: 2900, routeId: 'R-PTA', incoterm: 'CFR', prodDays: 300, qaDays: 20, cover: 8, deliveryActivityId: 'DEL-STSA', orderedOn: [2026, 11, 20], airEligible: false, slip: 0 },
  { id: 'PO-013', materialId: 'M-STS', supplierId: 'S01', qty: 2, valueM: 106, weightT: 2900, routeId: 'R-PTB', incoterm: 'CFR', prodDays: 310, qaDays: 20, cover: 10, deliveryActivityId: 'DEL-STSB', orderedOn: [2026, 11, 20], airEligible: false, slip: 0 },
  { id: 'PO-014', materialId: 'M-MHC', supplierId: 'S14', qty: 1, valueM: 38, weightT: 260, routeId: 'R-PTB', incoterm: 'CFR', prodDays: 280, qaDays: 20, cover: 45, deliveryActivityId: 'DEL-MHC', orderedOn: [2026, 12, 5], airEligible: false, slip: 0 },
  { id: 'PO-015', materialId: 'M-RS', supplierId: 'S01', qty: 8, valueM: 14.5, weightT: 150, routeId: 'R-PTC', incoterm: 'CFR', prodDays: 140, qaDays: 14, cover: 45, deliveryActivityId: 'DEL-RS', orderedOn: [2027, 1, 8], airEligible: false, slip: 0 },
  { id: 'PO-016', materialId: 'M-MAST', supplierId: 'S09', qty: 18, valueM: 9.5, weightT: 310, routeId: 'R-PTA', incoterm: 'CFR', prodDays: 80, qaDays: 12, cover: 22, deliveryActivityId: 'DEL-MAST', orderedOn: [2027, 1, 10], airEligible: false, slip: 0 },
  { id: 'PO-017', materialId: 'M-REEFS', supplierId: 'S16', qty: 1, valueM: 7.0, weightT: 40, routeId: 'R-PTC', incoterm: 'CFR', prodDays: 80, qaDays: 10, cover: 50, deliveryActivityId: 'DEL-REEFS', airEligible: true, slip: 0 },
  { id: 'PO-018', materialId: 'M-MVSG', supplierId: 'S07', qty: 1, valueM: 16.0, weightT: 120, routeId: 'R-PTA', incoterm: 'CFR', prodDays: 150, qaDays: 20, cover: 10, deliveryActivityId: 'DEL-MVSG', orderedOn: [2026, 12, 20], airEligible: true, slip: 0 },
  { id: 'PO-019', materialId: 'M-TRF', supplierId: 'S07', qty: 4, valueM: 21.0, weightT: 380, routeId: 'R-PTA', incoterm: 'CFR', prodDays: 190, qaDays: 25, cover: 14, deliveryActivityId: 'DEL-TRF', orderedOn: [2026, 12, 20], airEligible: false, slip: 0 },
  { id: 'PO-020', materialId: 'M-CABLE', supplierId: 'S08', qty: 140, valueM: 17.0, weightT: 640, routeId: 'R-PTB', incoterm: 'CFR', prodDays: 80, qaDays: 10, cover: 40, deliveryActivityId: 'DEL-CABLE', airEligible: false, slip: 0 },
  { id: 'PO-021', materialId: 'M-CCTV', supplierId: 'S09', qty: 1, valueM: 8.8, weightT: 35, routeId: 'R-PTC', incoterm: 'CFR', prodDays: 60, qaDays: 10, cover: 45, deliveryActivityId: 'DEL-CCTV', airEligible: true, slip: 0 },
  { id: 'PO-022', materialId: 'M-NAV', supplierId: 'S04', qty: 1, valueM: 3.4, weightT: 22, routeId: 'R-PTB', incoterm: 'CFR', prodDays: 80, qaDays: 8, cover: 40, deliveryActivityId: 'DEL-NAV', airEligible: true, slip: 0 },
  { id: 'PO-023', materialId: 'M-TOS', supplierId: 'S07', qty: 1, valueM: 5.6, weightT: 8, routeId: 'R-PTC', incoterm: 'CFR', prodDays: 50, qaDays: 5, cover: 50, deliveryActivityId: 'DEL-TOS', airEligible: true, slip: 0 },
  { id: 'PO-024', materialId: 'M-HVAC', supplierId: 'S11', qty: 1, valueM: 24.0, weightT: 300, routeId: 'R-PTC', incoterm: 'CFR', prodDays: 140, qaDays: 14, cover: 35, deliveryActivityId: 'DEL-HVAC', orderedOn: [2027, 1, 12], airEligible: false, slip: 0 },
  { id: 'PO-025', materialId: 'M-LIFT', supplierId: 'S10', qty: 1, valueM: 6.8, weightT: 70, routeId: 'R-PTB', incoterm: 'CFR', prodDays: 120, qaDays: 10, cover: 40, deliveryActivityId: 'DEL-LIFT', airEligible: false, slip: 0 },
  { id: 'PO-026', materialId: 'M-GEN', supplierId: 'S07', qty: 2, valueM: 9.2, weightT: 120, routeId: 'R-PTC', incoterm: 'CFR', prodDays: 130, qaDays: 10, cover: 40, deliveryActivityId: 'DEL-GEN', airEligible: false, slip: 0, stockTransferDays: 12 },
  { id: 'PO-027', materialId: 'M-FIRE', supplierId: 'S08', qty: 1, valueM: 5.1, weightT: 90, routeId: 'R-PTC', incoterm: 'CFR', prodDays: 60, qaDays: 8, cover: 40, deliveryActivityId: 'DEL-FIRE', airEligible: false, slip: 0 },
  { id: 'PO-028', materialId: 'M-CLAD', supplierId: 'S09', qty: 1, valueM: 7.4, weightT: 200, routeId: 'R-PTC', incoterm: 'CFR', prodDays: 50, qaDays: 8, cover: 30, deliveryActivityId: 'DEL-CLAD', airEligible: false, slip: 0 },
  { id: 'PO-029', materialId: 'M-STEEL', supplierId: 'S02', qty: 1100, valueM: 15.2, weightT: 1100, routeId: 'R-PTC', incoterm: 'CFR', prodDays: 60, qaDays: 10, cover: 28, deliveryActivityId: 'DEL-STEEL', airEligible: false, slip: 0 },
  { id: 'PO-030', materialId: 'M-ASPH', supplierId: 'S15', qty: 8000, valueM: 11.0, weightT: 8000, routeId: 'R-LOC', incoterm: 'DAP', prodDays: 4, qaDays: 0, cover: 10, deliveryActivityId: 'DEL-ASPH', airEligible: false, slip: 0 },
  { id: 'PO-031', materialId: 'M-SILT', supplierId: 'S13', qty: 1, valueM: 3.1, weightT: 55, routeId: 'R-PTB', incoterm: 'CFR', prodDays: 20, qaDays: 4, cover: 32, deliveryActivityId: 'DEL-SILT', orderedOn: [2026, 11, 15], airEligible: false, slip: 0 },
  { id: 'PO-032', materialId: 'M-DREDGESP', supplierId: 'S14', qty: 1, valueM: 4.6, weightT: 38, routeId: 'R-PTB', incoterm: 'CFR', prodDays: 30, qaDays: 6, cover: 45, deliveryActivityId: 'DEL-DRGSP', orderedOn: [2026, 12, 1], airEligible: true, slip: 0 },
  { id: 'PO-033', materialId: 'M-PIEZO', supplierId: 'S09', qty: 1, valueM: 2.2, weightT: 14, routeId: 'R-PTC', incoterm: 'CFR', prodDays: 20, qaDays: 30, cover: 20, deliveryActivityId: 'DEL-PIEZO', orderedOn: [2026, 12, 12], airEligible: true, slip: 0 },
  { id: 'PO-034', materialId: 'M-RIGGING', supplierId: 'S02', qty: 1, valueM: 5.4, weightT: 120, routeId: 'R-PTC', incoterm: 'CFR', prodDays: 30, qaDays: 6, cover: 36, deliveryActivityId: 'DEL-RIG', orderedOn: [2026, 11, 20], airEligible: false, slip: 0 },
];
