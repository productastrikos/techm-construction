import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { enAll, arAll } from './dict';
import type { Lang } from '../lib/fmt';

let saved: Lang = 'en';
try {
  const v = localStorage.getItem('mz.lang');
  if (v) saved = JSON.parse(v) as Lang;
} catch {
  /* ignore */
}

i18n.use(initReactI18next).init({
  resources: { en: { translation: enAll }, ar: { translation: arAll } },
  lng: saved,
  fallbackLng: 'en',
  keySeparator: false,
  nsSeparator: false,
  interpolation: { escapeValue: false },
  returnNull: false,
});

export function applyLangToDocument(lang: Lang) {
  const el = document.documentElement;
  el.lang = lang;
  el.dir = lang === 'ar' ? 'rtl' : 'ltr';
  if (i18n.language !== lang) void i18n.changeLanguage(lang);
}

export default i18n;
