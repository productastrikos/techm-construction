// Portfolio sites. The first is the live project (values come from the simulator snapshot); the others are
// ILLUSTRATIVE companion sites so the multi-site command-centre story can be told. Names are generic on purpose.
import { bi, type Bi } from '../../lib/bi';

export interface SiteSummary {
  id: string;
  name: Bi;
  lon: number;
  lat: number;
  main?: boolean;
  progress: number;
  spi: number;
  cpi: number;
  ltifr: number;
  alarms: number;
}

export const SITES: SiteSummary[] = [
  { id: 'S1', name: bi('Mina Al Hamriya Port', 'ميناء الحمرية'), lon: 56.4, lat: 25.2, main: true, progress: 0, spi: 1, cpi: 1, ltifr: 0, alarms: 0 },
  { id: 'S2', name: bi('East-coast logistics yard', 'ساحة اللوجستيات الساحلية الشرقية'), lon: 56.05, lat: 25.75, progress: 0.63, spi: 1.02, cpi: 0.99, ltifr: 0.31, alarms: 1 },
  { id: 'S3', name: bi('Inland container depot', 'محطة الحاويات الداخلية'), lon: 55.45, lat: 24.95, progress: 0.28, spi: 0.91, cpi: 0.97, ltifr: 0.55, alarms: 4 },
];
