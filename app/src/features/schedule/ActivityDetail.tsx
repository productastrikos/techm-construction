import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import type { CpmResult } from '../../engine/cpm';
import type { Activity, ProjectPack } from '../../engine/types';
import { Btn, Card, Chip, N, type Tone } from '../../design/ui';
import { fmtAed, fmtDate, fmtDays, fmtPct, type Lang } from '../../lib/fmt';
import { tx } from '../../lib/bi';
import type { Snapshot } from '../../sim/types';

const riskTone: Record<string, Tone> = { ok: 'good', watch: 'warn', risk: 'warn', late: 'bad' };

export function ActivityDetail({ pack, snap, scenario, id, onClose, onSelect }: { pack: ProjectPack; snap: Snapshot; scenario: CpmResult | null; id: string; onClose: () => void; onSelect: (id: string) => void }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Lang;
  const nav = useNavigate();
  const i = snap.forecast.idx.get(id);
  if (i === undefined) return null;
  const a: Activity = pack.activities[i];
  const f = snap.forecast;
  const b = snap.baseline;
  const wbs = pack.wbs.find((w) => w.id === a.wbsId)!;
  const succs = pack.activities.filter((s) => s.preds.some((p) => p.id === a.id));
  const po = snap.pos.find((p) => p.deliveryActivityId === a.id);
  const assets = (a.assetIds ?? []).map((aid) => snap.assets.find((x) => x.id === aid)).filter(Boolean);
  const pct = snap.pct[i];
  const status = f.done[i] ? t('sched.done') : pct > 0 ? t('sched.inprogress') : t('sched.notstarted');
  const row = (k: string, v: React.ReactNode) => (
    <div className="flex justify-between gap-3 text-[12px] py-[1px]">
      <span className="text-dim">{k}</span>
      <span className="text-end">{v}</span>
    </div>
  );
  const sc = scenario ? { es: scenario.es[i], ef: scenario.ef[i] } : null;
  return (
    <Card
      title={`${a.id} - ${tx(a.name, lang)}`}
      subtitle={tx(wbs.name, lang)}
      actions={
        <Btn size="sm" variant="ghost" onClick={onClose} aria-label={t('common.close')}>
          <X size={14} />
        </Btn>
      }
      className="h-full"
      bodyClass="overflow-auto"
    >
      <div className="grid grid-cols-4 gap-4 max-[1500px]:grid-cols-2" data-testid="activity-detail">
        <div>
          <div className="flex gap-1.5 mb-1.5 flex-wrap">
            <Chip tone={f.done[i] ? 'good' : pct > 0 ? 'info' : 'neutral'}>{status}</Chip>
            {f.critical[i] ? <Chip tone="bad">{t('sched.critical')}</Chip> : null}
            {a.kind === 'delivery' && <Chip tone="info">{t('sched.delivery')}</Chip>}
          </div>
          {row(t('sched.progress'), <N>{fmtPct(pct, lang)}</N>)}
          {row(t('sched.duration'), <N>{a.kind === 'task' ? fmtDays(f.ef[i] - f.es[i], lang) : '0'}</N>)}
          {row(t('sched.calendar'), tx(pack.calendars.find((c) => c.id === a.calendarId)?.name, lang))}
          {row(t('sched.budget'), <N>AED {fmtAed(a.budget, lang)}</N>)}
          {row(t('sched.crew'), <N>{a.crew ?? '-'}</N>)}
        </div>
        <div>
          {row(t('sched.baselineDates'), <N>{fmtDate(b.es[i], lang, 'short')} - {fmtDate(b.ef[i], lang, 'short')}</N>)}
          {row(t('sched.forecastDates'), <N>{fmtDate(f.es[i], lang, 'short')} - {fmtDate(f.ef[i], lang, 'short')}</N>)}
          {sc && row(t('sched.scenarioDates'), <span className="text-warn num">{fmtDate(sc.es, lang, 'short')} - {fmtDate(sc.ef, lang, 'short')}</span>)}
          {row(t('sched.variance'), <N>{fmtDays(f.ef[i] - b.ef[i], lang, true)}</N>)}
          {row(t('sched.totalFloat'), <N>{f.done[i] ? '-' : fmtDays(f.tf[i], lang)}</N>)}
          {row(t('sched.freeFloat'), <N>{f.done[i] ? '-' : fmtDays(f.ff[i], lang)}</N>)}
        </div>
        <div>
          <div className="text-[10.5px] uppercase tracking-wider text-dim mb-0.5">{t('sched.predecessors')}</div>
          <div className="flex flex-col max-h-[88px] overflow-auto">
            {a.preds.length === 0 && <span className="text-[12px] text-dim">-</span>}
            {a.preds.map((p) => (
              <button key={p.id} type="button" className="text-start text-[11.5px] hover:bg-surface-2 rounded px-1 flex gap-1.5" onClick={() => onSelect(p.id)}>
                <span className="mono text-dim">{p.id}</span>
                <span className="truncate flex-1">{tx(pack.activities[f.idx.get(p.id)!].name, lang)}</span>
                <span className="text-dim">{p.type}{p.lagHrs ? ` ${p.lagHrs > 0 ? '+' : ''}${Math.round(p.lagHrs / 10)}d` : ''}</span>
              </button>
            ))}
          </div>
          <div className="text-[10.5px] uppercase tracking-wider text-dim mt-1 mb-0.5">{t('sched.successors')}</div>
          <div className="flex flex-col max-h-[60px] overflow-auto">
            {succs.slice(0, 6).map((s) => (
              <button key={s.id} type="button" className="text-start text-[11.5px] hover:bg-surface-2 rounded px-1 flex gap-1.5" onClick={() => onSelect(s.id)}>
                <span className="mono text-dim">{s.id}</span>
                <span className="truncate">{tx(s.name, lang)}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          {po && (
            <div className="rounded-lg border border-line p-2">
              <div className="flex items-center gap-1.5 text-[12px]">
                <span className="mono text-dim">{po.id}</span>
                <span className="truncate flex-1">{tx(pack.materials.find((m) => m.id === po.materialId)?.name, lang)}</span>
                <Chip tone={po.stage === 6 ? 'good' : riskTone[po.risk]}>{po.stage === 6 ? 'OK' : `${Math.round(po.floatDays)} d`}</Chip>
              </div>
              <div className="text-[11.5px] text-dim">ETA {fmtDate(po.etaT, lang)}</div>
            </div>
          )}
          {assets.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {assets.map((x) => (
                <button key={x!.id} type="button" onClick={() => nav(`/assets?asset=${x!.id}`)}>
                  <Chip tone={x!.report.status === 'good' ? 'good' : x!.report.status === 'watch' ? 'warn' : 'bad'} dot>
                    {x!.id} {Math.round(x!.report.health)}
                  </Chip>
                </button>
              ))}
            </div>
          )}
          <div className="flex gap-2 mt-auto">
            {a.elementIds.length > 0 && (
              <Btn size="sm" onClick={() => nav('/twin')}>
                {t('sched.openTwin')}
              </Btn>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
