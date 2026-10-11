import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '../../design/ui';
import { imageUrl } from '../../lib/images';

/** drone imagery: before / after swipe. Both frames are AI-generated illustrations with a matching camera. */
export function DroneCompare() {
  const { t } = useTranslation();
  const [x, setX] = useState(52);
  return (
    <Card title={t('port.drone.title')} subtitle={t('port.drone.sub')} sim bodyClass="!p-0 overflow-hidden rounded-b-xl">
      <div className="relative select-none" style={{ aspectRatio: '16 / 7' }} dir="ltr" data-testid="drone-compare">
        <img src={imageUrl('drone-after')} alt="" className="absolute inset-0 w-full h-full object-cover" draggable={false} />
        <img src={imageUrl('drone-before')} alt="" className="absolute inset-0 w-full h-full object-cover" style={{ clipPath: `inset(0 ${100 - x}% 0 0)` }} draggable={false} />
        <div className="absolute inset-y-0" style={{ left: `${x}%`, width: 2, background: 'white', boxShadow: '0 0 8px rgba(0,0,0,.6)' }}>
          <span className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 size-8 rounded-full bg-white text-black grid place-items-center text-[13px] font-bold shadow">&#8596;</span>
        </div>
        <span className="absolute top-2 left-2 rounded bg-black/60 px-1.5 py-0.5 text-[11px] text-white">{t('port.drone.before')}</span>
        <span className="absolute top-2 right-2 rounded bg-black/60 px-1.5 py-0.5 text-[11px] text-white">{t('port.drone.after')}</span>
        <input type="range" min={2} max={98} value={x} onChange={(e) => setX(Number(e.target.value))} aria-label={t('port.drone.title')} className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize" />
      </div>
    </Card>
  );
}
