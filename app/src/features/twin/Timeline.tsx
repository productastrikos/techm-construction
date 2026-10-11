import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Pause, Play } from 'lucide-react';
import { useApp } from '../../app/store';
import { Btn, Toggle } from '../../design/ui';
import { fmtDate, fmtMonth, type Lang } from '../../lib/fmt';
import { ymdToT } from '../../engine/dates';
import { usePack, useSnapshot } from '../../sim/useSim';
import { tx } from '../../lib/bi';
import { useTwin } from './twinStore';

const MS_CFG: Record<string, Array<[string, string]>> = {
  port: [['DRG-MS1', 'twin.jump.dredge'], ['DRG-MS3', 'twin.jump.reclaim'], ['QW-MS1', 'twin.jump.quay'], ['EQP-MS1', 'twin.jump.sts'], ['COM-MS2', 'twin.jump.handover']],
  highway: [['MOB-090', 'twin.jumpH.mob'], ['BR1-A', 'twin.jumpH.b1'], ['BR2-A', 'twin.jumpH.b2'], ['PAV-W7', 'twin.jumpH.pave'], ['COM-MS', 'twin.jump.handover']],
};

/** 4D scrubber: date slider over the whole programme with milestone / data-date / baseline-finish markers */
export function Timeline() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Lang;
  const pack = usePack();
  const snap = useSnapshot();
  const simT = useApp((s) => s.simT);
  const tw = useTwin();
  const viewT = tw.viewT ?? simT;
  const cfg = MS_CFG[pack.config.sceneKind ?? 'port'];
  const max = Math.ceil(snap.forecastFinish + 25);
  const pct = (x: number) => `${Math.min(100, Math.max(0, (x / max) * 100))}%`;
  const ms = useMemo(
    () =>
      cfg.map(([id]) => {
        const a = pack.activities.find((x) => x.id === id);
        const i = snap.forecast.idx.get(id);
        return a && i !== undefined ? { id, name: tx(a.name, lang), t: snap.forecast.es[i] } : null;
      }).filter(Boolean) as Array<{ id: string; name: string; t: number }>,
    [pack, snap, lang, cfg],
  );
  const ticks = useMemo(() => {
    const out: number[] = [];
    for (let y = 2026; y <= 2029; y++) for (const m of [1, 4, 7, 10]) {
      const x = ymdToT(y, m, 1);
      if (x >= 0 && x <= max) out.push(x);
    }
    return out;
  }, [max]);
  const jump = (id: string) => {
    const i = snap.forecast.idx.get(id);
    if (i !== undefined) tw.setViewT(snap.forecast.ef[i] + 1);
  };
  const follow = tw.viewT === null;
  return (
    <div className="mx-5 mb-3 rounded-xl border border-line bg-surface px-3.5 py-2" data-testid="timeline">
      <div className="flex items-center gap-2 flex-wrap">
        <Btn size="sm" variant={tw.playing4d ? 'soft' : 'primary'} icon={tw.playing4d ? <Pause size={14} /> : <Play size={14} />} onClick={() => tw.patch({ playing4d: !tw.playing4d, viewT: tw.viewT ?? simT })} data-testid="play4d">
          {tw.playing4d ? t('twin.pause4d') : t('twin.play4d')}
        </Btn>
        <Toggle on={follow} onChange={(v) => tw.setViewT(v ? null : simT)} label={t('twin.follow')} />
        <div className="flex-1" />
        <div className="flex items-center gap-1 flex-wrap">
          <Btn size="sm" variant="ghost" onClick={() => tw.setViewT(null)}>{t('twin.jump.now')}</Btn>
          {cfg.map(([id, key]) => (
            <Btn key={id} size="sm" variant="ghost" onClick={() => jump(id)} data-testid={id === 'QW-MS1' ? 'jump-quay' : id === 'EQP-MS1' ? 'jump-sts' : undefined}>
              {t(key)}
            </Btn>
          ))}
        </div>
        <div className="text-[12.5px] font-semibold num w-[110px] text-end">{fmtDate(viewT, lang)}</div>
      </div>
      <div className="relative h-[34px] mt-1" dir="ltr">
        <div className="absolute inset-x-0 top-[9px] h-[6px] rounded-full bg-surface-3 overflow-hidden">
          <div className="h-full bg-accent/50" style={{ width: pct(viewT) }} />
        </div>
        {/* planned finish / data date / forecast finish markers */}
        <Marker left={pct(snap.nowT)} color="var(--accent)" label={t('hdr.dataDate')} top />
        <Marker left={pct(snap.baselineFinish)} color="var(--info)" label="BL" />
        <Marker left={pct(snap.forecastFinish)} color="var(--warn)" label="FC" />
        {ms.map((m) => (
          <span key={m.id} className="absolute top-[7px] size-[10px] rounded-sm rotate-45 bg-violet -ms-[5px]" style={{ left: pct(m.t) }} title={`${m.name} - ${fmtDate(m.t, lang)}`} />
        ))}
        <input
          type="range"
          aria-label={t('twin.viewDate')}
          min={0}
          max={max}
          step={1}
          value={Math.round(viewT)}
          onChange={(e) => tw.patch({ viewT: Number(e.target.value), playing4d: false })}
          className="absolute inset-x-0 top-0 w-full h-[24px] opacity-0 cursor-pointer"
          data-testid="timeline-range"
        />
        {ticks.map((x) => (
          <span key={x} className="absolute bottom-0 text-[9.5px] text-dim -translate-x-1/2 num" style={{ left: pct(x) }}>
            {fmtMonth(x, lang)}
          </span>
        ))}
      </div>
    </div>
  );
}

function Marker({ left, color, label, top }: { left: string; color: string; label: string; top?: boolean }) {
  return (
    <span className="absolute top-[3px] flex flex-col items-center -translate-x-1/2 pointer-events-none" style={{ left }}>
      <span className="w-[2px] h-[18px]" style={{ background: color }} />
      <span className="absolute text-[8.5px] font-bold leading-none" style={{ color, top: top ? -2 : undefined, transform: 'translateY(-100%)' }} title={label}>
        {label.length > 3 ? '' : label}
      </span>
    </span>
  );
}
