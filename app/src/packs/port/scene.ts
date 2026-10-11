// Port pack: 3D scene element layout (metres; x east, z south, y up; the sea is -z, water level y = 0).
// Generic port geometry - illustrative, not a real design.
import { bi } from '../../lib/bi';
import type { SceneElement } from '../../engine/types';

const el = (id: string, en: string, ar: string, kind: SceneElement['kind'], pos: [number, number, number], size: [number, number, number], grow: SceneElement['grow'], color: string, extra: Partial<SceneElement> = {}): SceneElement => ({
  id,
  name: bi(en, ar),
  kind,
  pos,
  size,
  grow,
  color,
  activityIds: [],
  ...extra,
});

export const QUAY_X0 = -350;
export const QUAY_SEG = 70;
export const QUAY_Z_FACE = -18;

export function buildPortScene(): SceneElement[] {
  const out: SceneElement[] = [];

  out.push(el('SEABED', 'Dredged basin & approach channel', 'حوض التكريك وقناة الاقتراب', 'seabed', [0, -8, -300], [1400, 1, 620], 'fade', '#7a6a4a'));

  // reclamation cells (rise from the seabed to +3 m)
  for (let k = 1; k <= 5; k++) {
    const w = 152;
    out.push(el(`RCL-${k}`, `Reclamation cell R${k}`, `خلية الردم R${k}`, 'reclamation', [-380 + w * (k - 0.5), -6, 240], [w, 18, 480], 'y', '#c9b27c'));
  }

  // rock revetments
  out.push(el('RV-1', 'Rock revetment - west return', 'الحماية الصخرية - الجناح الغربي', 'revetment', [-392, -2, 230], [28, 14, 500], 'y', '#6b6f73'));
  out.push(el('RV-2', 'Rock revetment - east return', 'الحماية الصخرية - الجناح الشرقي', 'revetment', [392, -2, 230], [28, 14, 500], 'y', '#6b6f73'));
  out.push(el('RV-3', 'Rock revetment - NW face', 'الحماية الصخرية - الواجهة الشمالية الغربية', 'revetment', [-372, -2, -22], [44, 14, 40], 'y', '#6b6f73'));
  out.push(el('RV-4', 'Rock revetment - NE face', 'الحماية الصخرية - الواجهة الشمالية الشرقية', 'revetment', [372, -2, -22], [44, 14, 40], 'y', '#6b6f73'));

  // breakwater (rubble mound)
  out.push(el('BW-1', 'Breakwater - root', 'كاسر الأمواج - الجذر', 'breakwater', [-520, -1, -125], [34, 12, 250], 'y', '#75797c'));
  out.push(el('BW-2', 'Breakwater - trunk', 'كاسر الأمواج - الجذع', 'breakwater', [-310, -1, -335], [34, 12, 453], 'y', '#75797c', { rotY: 1.953 }));
  out.push(el('BW-3', 'Breakwater - head', 'كاسر الأمواج - الرأس', 'breakwater', [-10, -1, -430], [34, 12, 181], 'y', '#75797c', { rotY: 1.681 }));

  // quay wall: 10 caissons + capping beams
  for (let k = 1; k <= 10; k++) {
    const x = QUAY_X0 + QUAY_SEG * (k - 0.5);
    const kk = String(k).padStart(2, '0');
    out.push(el(`QW-${kk}`, `Quay caisson ${k}`, `صندوق الرصيف ${k}`, 'quay', [x, -6, -9], [QUAY_SEG - 2, 18, 18], 'y', '#9aa3a8'));
    out.push(el(`CAP-${kk}`, `Capping & rail beam ${k}`, `كمرة التاج وسكة الرافعة ${k}`, 'quay', [x, 3.7, -15], [QUAY_SEG, 1.4, 6], 'x', '#b9c0c4'));
  }

  // crane rails (waterside rail; landside rail drawn by the renderer 26 m behind)
  const railX: Array<[number, number]> = [
    [-350, -140],
    [-140, 0],
    [0, 210],
    [210, 350],
  ];
  railX.forEach(([a, b], i) => out.push(el(`RAIL-${i + 1}`, `Crane rail section ${i + 1}`, `قسم سكة الرافعة ${i + 1}`, 'rail', [(a + b) / 2, 4.55, -9], [b - a, 0.3, 0.6], 'x', '#d6dade')));

  // fenders (rows along the quay face)
  for (let g = 1; g <= 5; g++) {
    out.push(el(`FND-${g}`, `Fender group ${g}`, `مجموعة المصدّات ${g}`, 'fender', [QUAY_X0 + 140 * (g - 0.5), 1.4, QUAY_Z_FACE - 0.6], [136, 3, 1.4], 'fade', '#1b1f23', { count: 7 }));
  }

  // apron strips (5), yard blocks (6), roads (3)
  for (let g = 1; g <= 5; g++) {
    out.push(el(`APR-${g}`, `Apron zone A${g}`, `منطقة الرصيف A${g}`, 'apron', [QUAY_X0 + 140 * (g - 0.5), 3.4, 26], [138, 0.5, 76], 'z', '#5b6166'));
  }
  const yc = [-240, 0, 240];
  const yr = [140, 260];
  let yi = 1;
  for (const z of yr) {
    for (const x of yc) {
      out.push(el(`YRD-${yi}`, `Container yard Y${yi}`, `ساحة الحاويات Y${yi}`, 'yard', [x, 3.4, z], [214, 0.5, 100], 'z', '#4c5257'));
      yi++;
    }
  }
  out.push(el('RD-1', 'Main gate road & plaza', 'طريق البوابة الرئيسية والساحة', 'road', [0, 3.4, 420], [16, 0.4, 150], 'z', '#3f4448'));
  out.push(el('RD-2', 'Internal ring road', 'الطريق الدائري الداخلي', 'road', [0, 3.4, 330], [700, 0.4, 14], 'x', '#3f4448'));
  out.push(el('RD-3', 'Service & emergency road', 'طريق الخدمة والطوارئ', 'road', [-352, 3.4, 190], [12, 0.4, 290], 'z', '#3f4448'));

  // buildings
  out.push(el('BLD-GATE', 'Gatehouse & inspection canopy', 'غرفة البوابة ومظلة الفحص', 'building', [0, 3.4, 482], [34, 6, 14], 'y', '#c8ced2'));
  out.push(el('BLD-ADMIN', 'Administration & operations building', 'مبنى الإدارة والعمليات', 'building', [-130, 3.4, 412], [62, 15, 30], 'y', '#d3d9dc'));
  out.push(el('BLD-WORK', 'Maintenance workshop', 'ورشة الصيانة', 'building', [-250, 3.4, 420], [58, 10, 36], 'y', '#b8c0c5'));
  out.push(el('BLD-REEF', 'Reefer stack & cold chain', 'مرفق التبريد', 'building', [70, 3.4, 395], [62, 7, 26], 'y', '#aeb9c0'));
  out.push(el('BLD-SUB', 'Main electrical substation', 'المحطة الكهربائية الرئيسية', 'building', [205, 3.4, 420], [32, 9, 22], 'y', '#bfc6c9'));
  out.push(el('BLD-FIRE', 'Fire station', 'محطة الإطفاء', 'building', [320, 3.4, 440], [36, 9, 22], 'y', '#d9a3a0'));
  out.push(el('BLD-FUEL', 'Fuel & bunkering station', 'محطة الوقود', 'building', [-335, 3.4, 455], [26, 5, 18], 'y', '#c5b57f'));
  out.push(el('BLD-WH', 'Customs inspection shed', 'مستودع التفتيش الجمركي', 'building', [150, 3.4, 335], [70, 8, 30], 'y', '#b0b8bd'));

  // lighting masts (3 groups)
  out.push(el('MAST-1', 'High-mast lighting - apron', 'أعمدة الإنارة العالية - الرصيف', 'mast', [0, 3.4, 52], [620, 32, 2], 'y', '#8d969c', { count: 6 }));
  out.push(el('MAST-2', 'High-mast lighting - yard east/west', 'أعمدة الإنارة العالية - الساحة', 'mast', [0, 3.4, 200], [560, 32, 2], 'y', '#8d969c', { count: 5 }));
  out.push(el('MAST-3', 'High-mast lighting - yard rear', 'أعمدة الإنارة العالية - خلف الساحة', 'mast', [0, 3.4, 318], [560, 32, 2], 'y', '#8d969c', { count: 5 }));

  // STS cranes (equipment, modelled as elements so 4D can show erection)
  [-240, -80, 80, 240].forEach((x, i) =>
    out.push(el(`STS-${i + 1}`, `STS crane ${i + 1}`, `رافعة الرصيف ${i + 1}`, 'sts', [x, 4.5, -9], [26, 55, 30], 'y', '#e0792b')),
  );

  return out;
}
