import type { Lang } from './fmt';
/** bilingual string used by pack content (activity names, materials...) */
export interface Bi {
  en: string;
  ar: string;
}
export const bi = (en: string, ar: string): Bi => ({ en, ar });
export const tx = (b: Bi | undefined, lang: Lang): string => (b ? (lang === 'ar' ? b.ar || b.en : b.en) : '');
