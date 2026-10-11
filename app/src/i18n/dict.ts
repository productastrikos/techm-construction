// Merges the base dictionaries with per-feature parts (each part holds EN and AR side by side so keys stay paired).
import { en } from './en';
import { ar } from './ar';
import { twin } from './parts/twin';
import { schedule } from './parts/schedule';
import { mine } from './parts/mine';
import { whatif } from './parts/whatif';
import { assetsPart } from './parts/assets';
import { presenter } from './parts/presenter';
import { ai } from './parts/ai';

export interface Part {
  en: Record<string, string>;
  ar: Record<string, string>;
}

const parts: Part[] = [twin, schedule, whatif, assetsPart, presenter, ai, ...mine];

export const enAll: Record<string, string> = Object.assign({}, en, ...parts.map((p) => p.en));
export const arAll: Record<string, string> = Object.assign({}, ar, ...parts.map((p) => p.ar));
