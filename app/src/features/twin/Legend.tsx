import { useTranslation } from 'react-i18next';
import type { ColorMode } from '../../app/store';

const C = { good: '#3ee0b0', warn: '#f7b84b', bad: '#ff6b6b', dim: '#52707a', red: '#ff4b4b', green: '#3ee0b0' };

export function Legend({ mode }: { mode: ColorMode }) {
  const { t } = useTranslation();
  const rows: Array<[string, string]> =
    mode === 'progress'
      ? [[C.good, t('twin.legend.ok')], [C.warn, t('twin.legend.watch')], [C.bad, t('twin.legend.late')], [C.dim, t('twin.legend.planned')]]
      : mode === 'material'
        ? [[C.good, t('twin.legend.matOk')], [C.warn, t('twin.legend.matWatch')], [C.bad, t('twin.legend.matLate')], [C.dim, t('twin.legend.matNone')]]
        : mode === 'health'
          ? [[C.good, t('twin.legend.hGood')], [C.warn, t('twin.legend.hWatch')], [C.bad, t('twin.legend.hBad')]]
          : mode === 'hse'
            ? [[C.red, t('twin.legend.zRed')], [C.warn, t('twin.legend.zAmber')], [C.green, t('twin.legend.zGreen')]]
            : [];
  if (!rows.length) return null;
  return (
    <div className="absolute bottom-2 start-2.5 rounded-lg border border-line-2 bg-surface/85 backdrop-blur px-2.5 py-1.5" data-testid="legend">
      <div className="text-[10px] uppercase tracking-wider text-dim mb-0.5">{t('twin.legend')}</div>
      {rows.map(([c, l]) => (
        <div key={l} className="flex items-center gap-1.5 text-[11.5px] leading-snug">
          <span className="inline-block size-2.5 rounded-sm shrink-0" style={{ background: c }} />
          <span>{l}</span>
        </div>
      ))}
    </div>
  );
}
