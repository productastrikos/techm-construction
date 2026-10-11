import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { allCredits } from '../three/assetManifest';
import { Btn, Td, Th } from '../design/ui';

const IMAGES: Array<[string, string]> = [
  ['drone-before.jpg / drone-after.jpg', 'AI-generated aerial illustrations of a port platform (before / after)'],
  ['cctv-gate / cctv-quay / cctv-yard / cctv-batching .jpg', 'AI-generated simulated CCTV stills'],
  ['hero-port.jpg', 'AI-generated port-at-dusk banner'],
];

/** attribution screen for third-party / generated assets (CC BY 4.0 requires attribution) */
export function CreditsDialog() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const on = () => setOpen(true);
    window.addEventListener('mz:credits', on);
    return () => window.removeEventListener('mz:credits', on);
  }, []);
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [open]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6" style={{ background: 'var(--scrim)' }} onClick={() => setOpen(false)} role="dialog" aria-modal="true" aria-label={t('credits.title')}>
      <div className="w-full max-w-[980px] max-h-full overflow-auto rounded-2xl border border-line-2 bg-surface p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-1">
          <h2 className="m-0 text-[18px] font-semibold flex-1">{t('credits.title')}</h2>
          <Btn variant="ghost" size="sm" onClick={() => setOpen(false)} aria-label={t('common.close')}>
            <X size={16} />
          </Btn>
        </div>
        <p className="text-[12.5px] text-muted mt-0 mb-3">{t('credits.intro')}</p>
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <Th>{t('credits.model')}</Th>
              <Th>{t('credits.work')}</Th>
              <Th>{t('credits.author')}</Th>
              <Th>{t('credits.licence')}</Th>
            </tr>
          </thead>
          <tbody>
            {allCredits().map((c) => (
              <tr key={c.file}>
                <Td className="mono !text-[11.5px]">{c.file}</Td>
                <Td>{c.credit.title}</Td>
                <Td>
                  <span dir="ltr">{c.credit.author}</span>
                </Td>
                <Td>{c.credit.licence}</Td>
              </tr>
            ))}
          </tbody>
        </table>
        <h3 className="text-[13px] font-semibold mt-4 mb-1">{t('credits.images')}</h3>
        <ul className="m-0 ps-5 text-[12.5px] text-muted">
          {IMAGES.map(([f, d]) => (
            <li key={f}>
              <span className="mono">{f}</span> - {d}
            </li>
          ))}
        </ul>
        <p className="text-[11.5px] text-dim mt-3 mb-0">{t('credits.note')}</p>
      </div>
    </div>
  );
}
