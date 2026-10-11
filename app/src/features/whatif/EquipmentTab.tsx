import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Check, ClipboardList, Wrench } from 'lucide-react';
import { useApp } from '../../app/store';
import { Bar, Btn, Card, Chip, Field, Kpi, Seg, Slider, type Tone } from '../../design/ui';
import { Chart, useChartPalette } from '../../design/Chart';
import { fmtAed, fmtDate, fmtDays, fmtPct, type Lang } from '../../lib/fmt';
import { bi, tx } from '../../lib/bi';
import type { Delta, ScenarioResult } from '../../engine/scenario';
import { getDs, usePack, useSnapshot } from '../../sim/useSim';
import { useWorkOrders } from '../assets/woStore';
import { CostBars } from './shared';
import { useRunner } from './useRunner';

type Mode = 'run' | 'service' | 'prepos' | 'manual';
interface Opts {
  run: ScenarioResult;
  service: { startT: number; res: ScenarioResult };
  prepos: ScenarioResult;
}

export default function EquipmentTab({ initialAsset }: { initialAsset?: string }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Lang;
  const pack = usePack();
  const snap = useSnapshot();
  const nav = useNavigate();
  const simT = useApp((s) => s.simT);
  const pal = useChartPalette();
  const wo = useWorkOrders();
  const sorted = useMemo(() => [...snap.assets].sort((a, b) => a.report.health - b.report.health), [snap]);
  const [assetId, setAssetId] = useState(initialAsset ?? sorted[0].id);
  const [mode, setMode] = useState<Mode>('run');
  const [manualDays, setManualDays] = useState(10);
  const [created, setCreated] = useState<string | null>(null);
  const row = snap.assets.find((a) => a.id === assetId)!;
  const asset = pack.assets.find((a) => a.id === assetId)!;
  const r = row.report;
  const failT = r.failT ?? simT + 21;
  const [opts, setOpts] = useState<Opts | null>(null);

  useEffect(() => {
    let live = true;
    setOpts(null);
    setCreated(null);
    getDs().assetOptions(simT, assetId, failT).then((o) => live && setOpts(o));
    return () => {
      live = false;
    };
  }, [assetId, simT, failT]);

  const deltas = useMemo<Delta[]>(() => {
    if (!opts) return [];
    switch (mode) {
      case 'run':
        return [{ kind: 'failAsset', assetId, startT: failT }];
      case 'service':
        return [{ kind: 'serviceAsset', assetId, startT: opts.service.startT }];
      case 'prepos':
        return [{ kind: 'failAsset', assetId, startT: failT, downDays: 2, replacementPrepositioned: true }];
      default:
        return [{ kind: 'failAsset', assetId, startT: simT + 3, downDays: manualDays }];
    }
  }, [mode, opts, assetId, failT, manualDays, simT]);
  const { result } = useRunner(deltas, `${assetId}: ${t(`wi.eq.mode.${mode}`)}`);

  useEffect(() => {
    const on = (e: Event) => {
      if ((e as CustomEvent).detail?.flow !== 'h3') return;
      setAssetId('CC-02');
      setMode('run');
      setTimeout(() => setMode('service'), 2200);
      setTimeout(() => (document.querySelector('[data-testid="create-wo"]') as HTMLElement | null)?.click(), 3800);
    };
    window.addEventListener('mz:replay', on);
    return () => window.removeEventListener('mz:replay', on);
  }, []);

  const flagged = r.rulDays !== null;
  const tone: Tone = r.status === 'good' ? 'good' : r.status === 'watch' ? 'warn' : 'bad';
  const hit = result?.assetEvents[0]?.hitActivities ?? [];

  const probOption = useMemo(
    () => ({
      grid: { left: 40, right: 14, top: 14, bottom: 26 },
      tooltip: { trigger: 'axis', valueFormatter: (v: number) => `${(v * 100).toFixed(0)}%` },
      xAxis: { type: 'category', data: r.failProb.map((_, i) => i + 1), axisLabel: { color: pal.muted }, name: lang === 'ar' ? 'يوم' : 'days', nameTextStyle: { color: pal.muted } },
      yAxis: { type: 'value', max: 1, axisLabel: { color: pal.muted, formatter: (v: number) => `${v * 100}%` }, splitLine: { lineStyle: { color: pal.grid } } },
      series: [
        {
          type: 'line',
          data: r.failProb,
          symbol: 'none',
          smooth: true,
          lineStyle: { color: pal.bad, width: 2.6 },
          areaStyle: { color: pal.bad, opacity: 0.16 },
          markLine: r.rulDays !== null ? { symbol: 'none', silent: true, lineStyle: { color: pal.warn, type: 'dashed' }, label: { color: pal.warn, formatter: `RUL ${r.rulDays.toFixed(0)} d` }, data: [{ xAxis: Math.max(0, Math.min(29, Math.round(r.rulDays) - 1)) }] } : undefined,
        },
      ],
    }),
    [r, pal, lang],
  );

  const options: Array<{ id: Mode; res: ScenarioResult | null; sub: string; recommended?: boolean }> = opts
    ? [
        { id: 'run', res: opts.run, sub: t('wi.eq.run.sub') },
        { id: 'service', res: opts.service.res, sub: `${t('wi.eq.service.sub')} ${fmtDate(opts.service.startT, lang, 'short')}`, recommended: true },
        { id: 'prepos', res: opts.prepos, sub: t('wi.eq.prepos.sub') },
      ]
    : [];

  const createWo = () => {
    if (!opts) return;
    const start = opts.service.startT;
    const w = wo.create({
      assetId,
      title: bi(`Planned service - ${asset.name.en}${r.degradingChannel ? ' (' + (asset.channels.find((c) => c.id === r.degradingChannel)?.name.en ?? '') + ')' : ''}`, `صيانة مخططة - ${asset.name.ar}`),
      kind: 'PdM',
      status: 'planned',
      priority: r.health < 50 ? 'high' : 'med',
      fromT: start,
      toT: start + asset.serviceDays,
      createdT: simT,
      source: 'prediction',
      costAED: Math.round(asset.rentalPerDay * 1.5),
    });
    setCreated(w.id);
    setMode('service');
  };

  return (
    <div className="grid grid-cols-[300px_1fr] gap-4 max-[1250px]:grid-cols-1" data-testid="equipment-tab">
      <Card title={t('wi.eq.pick')} bodyClass="!px-2 flex flex-col gap-0.5 max-h-[640px] overflow-auto">
        {sorted.map((a) => {
          const on = a.id === assetId;
          const tn: Tone = a.report.status === 'good' ? 'good' : a.report.status === 'watch' ? 'warn' : 'bad';
          return (
            <button key={a.id} type="button" onClick={() => setAssetId(a.id)} className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-start ${on ? 'bg-[color-mix(in_srgb,var(--accent)_14%,transparent)]' : 'hover:bg-surface-2'}`} data-testid={`asset-${a.id}`}>
              <Chip tone={tn} dot>{Math.round(a.report.health)}</Chip>
              <div className="min-w-0 flex-1">
                <div className="text-[12.5px] truncate" dir="auto">{tx(pack.assets.find((x) => x.id === a.id)!.name, lang)}</div>
                <div className="text-[10.5px] text-dim mono">{a.id}{a.report.rulDays !== null ? ` - ${t('wi.eq.rul')} ${a.report.rulDays.toFixed(0)} d` : ''}</div>
              </div>
            </button>
          );
        })}
      </Card>

      <div className="flex flex-col gap-3 min-w-0">
        <div className="grid grid-cols-4 gap-3 max-[1200px]:grid-cols-2">
          <Kpi label={t('twin.asset.health')} value={`${Math.round(r.health)}`} tone={tone} hint={t(`asset.status.${r.status}`)} sim />
          <Kpi label={t('wi.eq.window')} value={flagged ? fmtDate(failT, lang, 'short') : t('wi.eq.none')} tone={flagged ? 'bad' : 'good'} hint={flagged ? `${t('wi.eq.rul')} ${fmtDays(r.rulDays!, lang)}` : t('twin.asset.none')} />
          <Kpi label={t('twin.asset.p14')} value={fmtPct(r.p14, lang)} tone={r.p14 > 0.5 ? 'bad' : r.p14 > 0.1 ? 'warn' : 'good'} />
          <Kpi label={t('wi.eq.impactLost')} value={opts ? fmtDays(opts.run.dFinish, lang, true) : '-'} tone={opts && opts.run.dFinish > 3 ? 'bad' : 'neutral'} hint={opts ? `AED ${fmtAed(opts.run.cost.total, lang)}` : undefined} />
        </div>

        <div className="grid grid-cols-2 gap-3 max-[1200px]:grid-cols-1">
          <Card title={t('wi.eq.prediction')} subtitle={tx(asset.name, lang)} sim="rule">
            <div className="flex flex-col gap-2">
              {flagged && asset.fault && (
                <div className="text-[12.5px]" dir="auto">
                  <span className="text-dim">{t('wi.eq.component')}: </span>
                  {tx(asset.fault.component, lang)}
                </div>
              )}
              <Chart option={probOption} height={150} />
              <div className="text-[11px] uppercase tracking-wider text-dim">{t('wi.eq.why')}</div>
              {r.explanation.length === 0 && <div className="text-[12px] text-dim">{t('wi.eq.noTrend')}</div>}
              {r.explanation.map((e) => {
                const ch = asset.channels.find((c) => c.id === e.channelId)!;
                return (
                  <div key={e.channelId} className="grid grid-cols-[1fr_120px_96px] items-center gap-2 text-[12px]">
                    <span className="truncate" dir="auto">{tx(ch.name, lang)}</span>
                    <Bar value={e.share} tone="bad" />
                    <span className="num text-end text-dim">{e.value.toFixed(1)} {ch.unit} ({fmtPct(e.share, lang)})</span>
                  </div>
                );
              })}
            </div>
          </Card>
          <Card title={t('wi.eq.impact')} subtitle={t('wi.eq.impactSub')}>
            {!result ? (
              <div className="text-[12px] text-dim">{t('common.loading')}</div>
            ) : (
              <div className="flex flex-col gap-2">
                <CostBars cost={result.cost} lang={lang} />
                <div className="text-[11px] uppercase tracking-wider text-dim mt-1">{t('wi.eq.hitActs')}</div>
                {hit.length === 0 && <div className="text-[12px] text-dim">{t('wi.eq.noHit')}</div>}
                {hit.slice(0, 4).map((id) => {
                  const a = pack.activities.find((x) => x.id === id)!;
                  return (
                    <button key={id} type="button" onClick={() => nav(`/schedule?act=${id}`)} className="text-start text-[12px] hover:bg-surface-2 rounded px-1 flex gap-2">
                      <span className="mono text-dim whitespace-nowrap shrink-0">{id}</span>
                      <span className="truncate" dir="auto">{tx(a.name, lang)}</span>
                      {snap.forecast.critical[snap.forecast.idx.get(id)!] ? <Chip tone="bad" className="ms-auto !text-[9.5px]">{t('sched.critical')}</Chip> : null}
                    </button>
                  );
                })}
              </div>
            )}
          </Card>
        </div>

        <Card title={t('wi.eq.options')} subtitle={t('wi.eq.optionsSub')} sim="rule">
          {!opts ? (
            <div className="text-[12px] text-dim">{t('common.loading')}</div>
          ) : (
            <div className="grid grid-cols-3 gap-3 max-[1200px]:grid-cols-1" data-testid="asset-options">
              {options.map((o) => {
                const on = mode === o.id;
                return (
                  <button key={o.id} type="button" onClick={() => setMode(o.id)} className={`text-start rounded-xl border p-3 flex flex-col gap-1 ${on ? 'border-accent bg-[color-mix(in_srgb,var(--accent)_8%,transparent)]' : 'border-line bg-surface hover:bg-surface-2'}`} data-testid={`opt-${o.id}`}>
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-semibold">{t(`wi.eq.mode.${o.id}`)}</span>
                      {o.recommended && <Chip tone="good">{t('wi.eq.recommended')}</Chip>}
                    </div>
                    <div className="text-[11.5px] text-dim">{o.sub}</div>
                    <div className="grid grid-cols-2 gap-2 mt-1">
                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-dim">{t('wi.eq.daysLost')}</div>
                        <div className="text-[18px] font-semibold num" style={{ color: o.res!.dFinish > 3 ? 'var(--bad)' : 'var(--good)' }}>{fmtDays(o.res!.dFinish, lang)}</div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-dim">{t('wi.eq.cost')}</div>
                        <div className="text-[18px] font-semibold num">AED {fmtAed(o.res!.cost.total, lang)}</div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
          <div className="flex items-center gap-3 mt-3 flex-wrap">
            <Btn variant="primary" icon={created ? <Check size={14} /> : <ClipboardList size={14} />} onClick={createWo} disabled={!opts || !!created} data-testid="create-wo">
              {created ? `${t('wi.eq.woCreated')} ${created}` : t('wi.eq.createWo')}
            </Btn>
            {created && (
              <>
                <Btn size="sm" icon={<Wrench size={14} />} onClick={() => nav('/assets?tab=wo')}>{t('wi.eq.openCmms')}</Btn>
                <Btn size="sm" onClick={() => nav('/schedule')}>{t('wi.act.gantt')}</Btn>
              </>
            )}
            <div className="flex-1" />
            <div className="flex items-center gap-2">
              <Seg<Mode> size="sm" value={mode === 'manual' ? 'manual' : 'run'} onChange={(m) => setMode(m)} options={[{ value: 'run', label: t('wi.eq.predicted') }, { value: 'manual', label: t('wi.eq.manual') }]} />
              {mode === 'manual' && (
                <Field label={`${manualDays} ${t('common.days')}`} className="w-[170px]">
                  <Slider value={manualDays} min={1} max={30} onChange={setManualDays} ariaLabel={t('wi.eq.manual')} />
                </Field>
              )}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
