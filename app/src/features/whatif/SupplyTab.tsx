import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { openCopilot } from '../ai/Copilot';
import { useApp } from '../../app/store';
import { Btn, Card, Chip, Field, N, Seg, Select, Slider, Td, Th } from '../../design/ui';
import { MapView, arc, type MapLine, type MapMarker } from '../../design/MapView';
import { fmtAed, fmtDate, fmtDays, fmtNum, type Lang } from '../../lib/fmt';
import { tx } from '../../lib/bi';
import type { Delta } from '../../engine/scenario';
import { routeOptions, type ChokepointScenario } from '../../engine/routes';
import type { ChokepointState } from '../../engine/types';
import { usePack, useSnapshot } from '../../sim/useSim';
import { ActionsBar, ChangedList, CompareCard, CostBars, OptionCards, PoImpactTable, ResultKpis } from './shared';
import { useRecovery, useRunner } from './useRunner';
import { useScenario } from './scenarioStore';

const ENTRY: [number, number] = [61.8, 21.6];
const CHOKEPOINT: [number, number] = [56.4, 26.5];
const SITE: [number, number] = [56.375, 25.205];

function seaPath(portId: string, port: [number, number]): Array<[number, number]> {
  switch (portId) {
    case 'PTA':
      return [ENTRY, [58.9, 24.9], [57.3, 26.1], CHOKEPOINT, [55.7, 25.9], port];
    case 'PTE':
      return [ENTRY, [58.9, 24.9], [57.3, 26.1], CHOKEPOINT, [54.5, 26.3], [52, 26.9], port];
    case 'PTD':
      return [ENTRY, [59, 23.6], port];
    default:
      return [ENTRY, [59.2, 24.2], [57.4, 25.2], port];
  }
}

export default function SupplyTab() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Lang;
  const pack = usePack();
  const snap = useSnapshot();
  const nav = useNavigate();
  const simT = useApp((s) => s.simT);
  const [hz, setHz] = useState<ChokepointState>('open');
  const [months, setMonths] = useState(12);
  const [shock, setShock] = useState(0);
  const [delayPo, setDelayPo] = useState('PO-010');
  const [weeks, setWeeks] = useState(0);
  const [routeSel, setRouteSel] = useState<Record<string, string>>({});
  const [selPo, setSelPo] = useState<string | null>('PO-010');
  const [applied, setApplied] = useState<string | null>(null);

  const base = useMemo<Delta[]>(() => {
    const d: Delta[] = [];
    if (hz !== 'open') d.push({ kind: 'chokepoint', state: hz, startT: simT, durationDays: Math.round(months * 30.4) });
    if (shock > 0) d.push({ kind: 'priceShock', pct: shock / 100 });
    if (weeks !== 0) d.push({ kind: 'shiftEta', poId: delayPo, days: weeks * 7 });
    for (const [poId, routeId] of Object.entries(routeSel)) d.push({ kind: 'reroute', poId, routeId });
    return d;
  }, [hz, months, shock, weeks, delayPo, routeSel, simT]);

  const needsRecovery = base.length > 0;
  const rec = useRecovery('supply', base, undefined, needsRecovery);
  const appliedOpt = rec.options?.find((o) => o.id === applied) ?? null;
  const finalDeltas = appliedOpt ? appliedOpt.deltas : base;
  const label = applied && appliedOpt ? `${hz === 'open' ? t('wi.supply.title') : t(`wi.hz.${hz}`)} + ${tx(appliedOpt.title, lang)}` : hz !== 'open' ? `Chokepoint ${t(`wi.hz.${hz}`)}` : t('wi.supply.title');
  const { result, loading } = useRunner(finalDeltas, label);
  const noAction = rec.baseResult ?? result;

  const hzScen: ChokepointScenario | null = hz === 'open' ? null : { state: hz, startT: simT, durationDays: Math.round(months * 30.4) };
  const po = selPo ? pack.pos.find((p) => p.id === selPo) : undefined;
  const opts = useMemo(() => (po ? routeOptions(pack, po, simT, hzScen) : []), [po, pack, simT, hz, months]); // eslint-disable-line react-hooks/exhaustive-deps
  const bestEta = Math.min(...opts.filter((o) => !o.blocked).map((o) => o.etaT));

  // ---- map
  const { lines, markers } = useMemo(() => {
    const lines: MapLine[] = [];
    const markers: MapMarker[] = [];
    const chosen = po ? routeSel[po.id] ?? result?.poImpacts.find((x) => x.poId === po.id)?.routeId ?? po.routeId : null;
    for (const port of pack.ports.filter((x) => x.id !== 'LOC')) {
      const used = chosen && pack.routes.find((r) => r.id === chosen)?.portId === port.id;
      const bad = port.insideChokepoint && hz === 'closed';
      const color = used ? '#3ee0b0' : bad ? '#ff6b6b' : port.insideChokepoint && hz === 'restricted' ? '#f7b84b' : '#5d8f9c';
      const sea = seaPath(port.id, [port.lon, port.lat]);
      lines.push({ id: `s-${port.id}`, coords: sea, color, width: used ? 3.4 : 1.6, opacity: used ? 1 : 0.55, dashed: bad });
      lines.push({ id: `r-${port.id}`, coords: [[port.lon, port.lat], SITE], color: used ? '#3ee0b0' : '#5d8f9c', width: used ? 2.6 : 1.2, dashed: true, opacity: used ? 0.95 : 0.4 });
      markers.push({ id: port.id, lon: port.lon, lat: port.lat, label: port.id === 'PTB' ? undefined : tx(port.name, lang), title: tx(port.name, lang), tone: port.insideChokepoint ? (hz === 'open' ? 'info' : hz === 'restricted' ? 'warn' : 'bad') : 'good', size: used ? 14 : 10 });
    }
    if (chosen === 'R-AIR') lines.push({ id: 'air', coords: arc([64.5, 24], [56.37, 25.1], 0.1), color: '#a78bfa', width: 2.5, dashed: true });
    markers.push({ id: 'chokepoint', lon: CHOKEPOINT[0], lat: CHOKEPOINT[1], label: lang === 'ar' ? `نقطة الاختناق: ${t(`wi.hz.${hz}`)}` : `Chokepoint: ${t(`wi.hz.${hz}`)}`, tone: hz === 'open' ? 'good' : hz === 'restricted' ? 'warn' : 'bad', size: 16, pulse: hz !== 'open' });
    markers.push({ id: 'site', lon: SITE[0], lat: SITE[1], label: lang === 'ar' ? 'موقع المشروع' : 'Project site', tone: 'accent', size: 14 });
    return { lines, markers };
  }, [pack, po, routeSel, result, hz, lang, t]);

  const saveScenario = () => result && useScenario.getState().save({ id: label, name: label, deltas: finalDeltas, result, committed: false });
  const committed = useScenario((s) => s.saved.some((x) => x.id === label && x.committed));
  const commit = () => {
    if (!result) return;
    useScenario.getState().save({ id: label, name: label, deltas: finalDeltas, result, committed: false });
    useScenario.getState().commit(label);
  };

  // presenter replay (H1): Chokepoint closed -> pick the re-route package -> commit
  useEffect(() => {
    const on = (e: Event) => {
      if ((e as CustomEvent).detail?.flow !== 'h1') return;
      setHz('closed');
      setApplied(null);
      setTimeout(() => (document.querySelector('[data-testid="apply-reroute"], [data-testid="apply-combo"]') as HTMLElement | null)?.click(), 2600);
      setTimeout(() => (document.querySelector('[data-testid="commit"]') as HTMLElement | null)?.click(), 4200);
    };
    window.addEventListener('mz:replay', on);
    return () => window.removeEventListener('mz:replay', on);
  }, []);

  const openPos = snap.pos.filter((p) => p.stage < 6);
  const compareRows = [
    { label: t('wi.cmp.live'), finish: fmtDate(snap.forecastFinish, lang), delta: 0, cost: 0 },
    ...(noAction && base.length ? [{ label: t('wi.cmp.noAction'), finish: fmtDate(noAction.finish, lang), delta: noAction.dFinish, cost: noAction.cost.total }] : []),
    ...(rec.options ?? []).slice(0, 3).map((o) => ({ label: tx(o.title, lang), finish: fmtDate(o.finish, lang), delta: o.dFinish, cost: o.result.cost.total, highlight: applied === o.id })),
  ];
  const openOptions = rec.options ?? [];

  return (
    <div className="grid grid-cols-[340px_1fr] gap-4 max-[1250px]:grid-cols-1" data-testid="supply-tab">
      {/* ---------------------------------------------------------------- controls */}
      <div className="flex flex-col gap-3">
        <Card title={t('wi.chokepoint.title')} subtitle={t('wi.chokepoint.sub')} sim>
          <Seg<ChokepointState>
            ariaLabel="Chokepoint"
            value={hz}
            onChange={(v) => {
              setHz(v);
              setApplied(null);
            }}
            options={[
              { value: 'open', label: t('wi.hz.open'), tone: 'good' },
              { value: 'restricted', label: t('wi.hz.restricted'), tone: 'warn' },
              { value: 'closed', label: t('wi.hz.closed'), tone: 'bad' },
            ]}
            className="w-full [&>button]:flex-1"
          />
          {hz !== 'open' && (
            <div className="mt-3">
              <Field label={`${t('wi.chokepoint.duration')}: ${months} ${t('wi.months')}`}>
                <Slider value={months} min={1} max={18} onChange={(v) => { setMonths(v); setApplied(null); }} ariaLabel={t('wi.chokepoint.duration')} />
              </Field>
              <p className="text-[11.5px] text-dim m-0 mt-1">
                {hz === 'closed' ? t('wi.chokepoint.closedNote') : t('wi.chokepoint.restrictedNote')}
              </p>
            </div>
          )}
        </Card>
        <Card title={t('wi.delay.title')} subtitle={t('wi.delay.sub')}>
          <Field label={t('wi.delay.po')}>
            <Select value={delayPo} onChange={(v) => { setDelayPo(v); setSelPo(v); setApplied(null); }} className="w-full" options={openPos.map((p) => ({ value: p.id, label: `${p.id} - ${tx(pack.materials.find((m) => m.id === p.materialId)?.name, lang)}` }))} />
          </Field>
          <Field label={`${t('wi.delay.shift')}: ${weeks > 0 ? '+' : ''}${weeks} ${t('wi.weeks')}`} className="mt-2">
            <Slider value={weeks} min={-4} max={12} onChange={(v) => { setWeeks(v); setApplied(null); }} ariaLabel={t('wi.delay.shift')} />
          </Field>
        </Card>
        <Card title={t('wi.price.title')} subtitle={t('wi.price.sub')} sim>
          <Field label={`${t('wi.price.shock')}: +${shock}%`}>
            <Slider value={shock} min={0} max={30} onChange={(v) => { setShock(v); setApplied(null); }} ariaLabel={t('wi.price.shock')} />
          </Field>
        </Card>
        <Card className="min-h-[300px]" bodyClass="!p-0 overflow-hidden rounded-b-xl" title={t('wi.map.title')} subtitle={t('wi.map.sub')}>
          <div className="h-[300px]">
            <MapView center={[57, 25]} zoom={6} bounds={[[54.2, 23.2], [61, 27.1]]} markers={markers} lines={lines} />
          </div>
        </Card>
      </div>

      {/* ---------------------------------------------------------------- results */}
      <div className="flex flex-col gap-3 min-w-0">
        <ResultKpis result={result} snap={snap} lang={lang} />
        {loading && <div className="text-[11px] text-dim">{t('common.loading')}</div>}
        {!base.length && (
          <Card>
            <div className="py-6 text-center flex flex-col items-center gap-3" data-testid="supply-empty">
              <div className="text-[13px] text-muted max-w-[560px]">{t('wi.supply.empty')}</div>
              <div className="flex gap-2 flex-wrap justify-center">
                <Btn variant="primary" onClick={() => { setHz('closed'); setApplied(null); }} data-testid="cta-close">{t('wi.cta.close')}</Btn>
                <Btn variant="soft" onClick={() => { setDelayPo(delayPo); setWeeks(6); setApplied(null); }} data-testid="cta-delay">{t('wi.cta.delay')}</Btn>
                <Btn variant="outline" icon={<Sparkles size={13} style={{ color: 'var(--violet)' }} />} onClick={() => openCopilot('hormuz')}>{t('wi.cta.ask')}</Btn>
              </div>
            </div>
          </Card>
        )}
        {base.length > 0 && result && (
          <>
            <ActionsBar onSave={saveScenario} onCommit={commit} committed={committed} />
            {openOptions.length > 0 && (
              <Card title={t('wi.opt.title')} subtitle={t('wi.opt.sub')} sim="rule">
                <OptionCards options={openOptions} applied={applied} onApply={setApplied} lang={lang} baseDFinish={noAction?.dFinish ?? 0} />
              </Card>
            )}
            <div className="grid grid-cols-2 gap-3 max-[1200px]:grid-cols-1">
              <Card title={t('wi.cost.title')} subtitle={t('wi.cost.sub')} sim>
                <CostBars cost={result.cost} lang={lang} />
              </Card>
              <Card title={t('wi.ripple.title')} subtitle={`${result.changed.length} ${t('wi.ripple.acts')}`}>
                <ChangedList result={result} pack={pack} lang={lang} onOpen={(id) => nav(`/schedule?act=${id}`)} />
              </Card>
            </div>
            <CompareCard title={t('wi.cmp.title')} rows={compareRows} />
          </>
        )}
        <div className="grid grid-cols-1 gap-3 2xl:grid-cols-[1.25fr_1fr]">
          <Card title={t('wi.po.title')} subtitle={t('wi.po.sub')} sim>
            <PoImpactTable result={result} snap={snap} pack={pack} lang={lang} selected={selPo} onSelect={setSelPo} />
          </Card>
          <Card title={t('wi.route.title')} subtitle={po ? `${po.id} - ${tx(pack.materials.find((m) => m.id === po.materialId)?.name, lang)}` : ''} sim>
            {!po ? (
              <div className="text-[12px] text-dim">{t('wi.route.pick')}</div>
            ) : (
              <table className="w-full border-collapse" data-testid="route-table">
                <thead>
                  <tr>
                    <Th>{t('wi.po.route')}</Th>
                    <Th align="end">{t('wi.route.transit')}</Th>
                    <Th align="end">ETA</Th>
                    <Th align="end">{t('wi.route.cost')}</Th>
                    <Th />
                  </tr>
                </thead>
                <tbody>
                  {opts.map((o) => {
                    const on = routeSel[po.id] === o.route.id;
                    return (
                      <tr key={o.route.id} className={o.blocked ? 'opacity-50' : ''}>
                        <Td className="max-w-[150px]">
                          <div className="truncate text-[12px]" title={tx(o.route.name, lang)} dir="auto">{tx(o.route.name, lang)}</div>
                          <div className="flex gap-1 mt-0.5">
                            {o.route.chokepointDependent && <Chip tone={o.blocked ? 'bad' : o.chokepointSlip > 0 ? 'warn' : 'neutral'}>{o.blocked ? t('wi.route.blocked') : 'Chokepoint'}</Chip>}
                            {!o.blocked && o.etaT === bestEta && <Chip tone="good">{t('wi.route.fastest')}</Chip>}
                          </div>
                        </Td>
                        <Td align="end"><N>{fmtNum(o.transitDays, lang, 0)} {t('unit.d')}</N></Td>
                        <Td align="end"><N>{fmtDate(o.etaT, lang, 'short')}</N></Td>
                        <Td align="end"><N>{fmtAed(o.costAED, lang)}</N></Td>
                        <Td align="end">
                          <Btn size="sm" variant={on ? 'soft' : 'outline'} onClick={() => { setRouteSel((s) => { const n = { ...s }; if (on) delete n[po.id]; else n[po.id] = o.route.id; return n; }); setApplied(null); }} data-testid={`use-${o.route.id}`}>
                            {on ? t('wi.route.selected') : t('wi.route.use')}
                          </Btn>
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
            {po && (
              <div className="text-[11.5px] text-dim mt-2">
                {t('wi.route.cargo')}: {fmtNum(po.weightT, lang)} t - AED {fmtAed(po.valueAED, lang)} - {fmtDays(opts.find((o) => o.route.id === po.routeId)?.deltaDays ?? 0, lang, true)}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
