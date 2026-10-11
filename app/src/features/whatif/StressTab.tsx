import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { FileText } from 'lucide-react';
import type * as echarts from 'echarts/core';
import { useApp } from '../../app/store';
import { Btn, Card, Kpi, Toggle } from '../../design/ui';
import { Chart, useChartPalette } from '../../design/Chart';
import { fmtAed, fmtDate, fmtDays, type Lang } from '../../lib/fmt';
import { bi, tx } from '../../lib/bi';
import { ymdToT } from '../../engine/dates';
import type { Delta, RecoveryOption, ScenarioResult } from '../../engine/scenario';
import { getDs, usePack, useSnapshot } from '../../sim/useSim';
import { ActionsBar, ChangedList, CompareCard, CostBars } from './shared';
import { useRunner } from './useRunner';
import { useScenario } from './scenarioStore';
import { BoardBriefing, type BriefingData } from './BoardBriefing';

interface Driver {
  id: 'chokepoint' | 'calendar' | 'asset' | 'price';
  label: string;
  deltas: Delta[];
}

export default function StressTab() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Lang;
  const pack = usePack();
  const snap = useSnapshot();
  const nav = useNavigate();
  const simT = useApp((s) => s.simT);
  const pal = useChartPalette();
  const [on, setOn] = useState({ chokepoint: true, calendar: true, asset: true, price: false });
  const [single, setSingle] = useState<Record<string, ScenarioResult> | null>(null);
  const [pkg, setPkg] = useState<{ result: ScenarioResult; parts: string[] } | null>(null);
  const [briefing, setBriefing] = useState(false);
  const chart = useRef<echarts.ECharts | null>(null);

  const cc = snap.assets.find((a) => a.id === 'CC-02');
  const failT = cc?.report.failT ?? simT + 9;
  const drivers = useMemo<Driver[]>(
    () => [
      { id: 'chokepoint', label: t('wi.stress.chokepoint'), deltas: [{ kind: 'chokepoint', state: 'closed', startT: simT, durationDays: 365 }] },
      { id: 'calendar', label: t('wi.stress.calendar'), deltas: [{ kind: 'layers', layers: { ramadan: true, eidLeave: true, midday: true } }] },
      { id: 'asset', label: t('wi.stress.asset'), deltas: [{ kind: 'failAsset', assetId: 'CC-02', startT: failT }] },
      { id: 'price', label: t('wi.stress.price'), deltas: [{ kind: 'priceShock', pct: 0.22 }] },
    ],
    [simT, failT, t],
  );
  const combined = useMemo(() => drivers.filter((d) => on[d.id]).flatMap((d) => d.deltas), [drivers, on]);
  const { result } = useRunner(combined, t('wi.stress.title'));

  // one-at-a-time impacts for the tornado
  useEffect(() => {
    let live = true;
    (async () => {
      const ds = getDs();
      const out: Record<string, ScenarioResult> = {};
      for (const d of drivers) out[d.id] = await ds.runScenario(simT, d.deltas);
      if (live) setSingle(out);
    })();
    return () => {
      live = false;
    };
  }, [drivers, simT]);

  // recommended mitigation package on top of the combined stress
  useEffect(() => {
    let live = true;
    (async () => {
      if (!combined.length) return setPkg(null);
      const ds = getDs();
      const parts: string[] = [];
      let deltas: Delta[] = [...combined];
      if (on.chokepoint) {
        const rec = await ds.recovery(simT, 'supply', drivers[0].deltas);
        const best: RecoveryOption | undefined = rec.options.find((o) => o.id === 'combo') ?? rec.options[0];
        if (best) {
          deltas = deltas.concat(best.deltas.filter((d) => d.kind === 'reroute' || d.kind === 'resequence' || d.kind === 'expedite'));
          parts.push(tx(best.title, lang));
        }
      }
      if (on.calendar) {
        const mk = (id: string, fromT: number, toT: number): Delta => ({ kind: 'shift', shift: { id, label: bi('Night shift', 'وردية ليلية'), calendars: ['site', 'marine', 'crane'], extraHrs: 6, fromT, toT, costPerHr: 9500 } });
        deltas.push(mk('n1', ymdToT(2027, 2, 8), ymdToT(2027, 3, 20)), mk('n2', ymdToT(2027, 6, 15), ymdToT(2027, 9, 15)));
        parts.push(t('wi.eq.mode.night'));
      }
      if (on.asset) {
        const ao = await ds.assetOptions(simT, 'CC-02', failT);
        deltas = deltas.filter((d) => d.kind !== 'failAsset');
        deltas.push({ kind: 'serviceAsset', assetId: 'CC-02', startT: ao.service.startT });
        parts.push(t('wi.eq.mode.service'));
      }
      const r = await ds.runScenario(simT, deltas);
      if (live) setPkg({ result: r, parts });
    })();
    return () => {
      live = false;
    };
  }, [combined, on, drivers, simT, failT, lang, t]);

  const tornado = useMemo(() => {
    if (!single) return {};
    const rows = drivers.map((d) => ({ d, r: single[d.id] })).sort((a, b) => a.r.dFinish - b.r.dFinish);
    return {
      grid: { left: 150, right: 170, top: 10, bottom: 28 },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      xAxis: { type: 'value', axisLabel: { color: pal.muted, formatter: '{value} d' }, splitLine: { lineStyle: { color: pal.grid } } },
      yAxis: { type: 'category', data: rows.map((x) => x.d.label), axisLabel: { color: pal.text, width: 140, overflow: 'truncate' } },
      series: [
        {
          type: 'bar',
          name: t('wi.kpi.finish'),
          data: rows.map((x) => ({ value: Math.round(x.r.dFinish * 10) / 10, itemStyle: { color: x.r.dFinish > 20 ? pal.bad : x.r.dFinish > 8 ? pal.warn : pal.info } })),
          label: { show: true, position: 'right', color: pal.text, formatter: (p: { value: number; dataIndex: number }) => `+${p.value} d / AED ${fmtAed(rows[p.dataIndex].r.cost.total, lang)}` },
        },
      ],
    };
  }, [single, drivers, pal, t, lang]);

  const committed = useScenario((s) => s.saved.some((x) => x.id === 'stress' && x.committed));
  const save = () => result && useScenario.getState().save({ id: 'stress', name: t('wi.stress.title'), deltas: combined, result, committed: false });
  const commit = () => {
    save();
    useScenario.getState().commit('stress');
  };

  const rows = [
    { label: t('wi.cmp.live'), finish: fmtDate(snap.forecastFinish, lang), delta: 0, cost: 0 },
    ...(result ? [{ label: t('wi.stress.combined'), finish: fmtDate(result.finish, lang), delta: result.dFinish, cost: result.cost.total }] : []),
    ...(pkg ? [{ label: `${t('wi.stress.package')}: ${pkg.parts.join(' + ')}`, finish: fmtDate(pkg.result.finish, lang), delta: pkg.result.dFinish, cost: pkg.result.cost.total, highlight: true }] : []),
  ];

  const bdata: BriefingData | null = result && single
    ? {
        lang,
        nowT: snap.nowT,
        liveFinish: snap.forecastFinish,
        baselineFinish: snap.baselineFinish,
        combined: result,
        pkg,
        drivers: drivers.map((d) => ({ label: d.label, result: single[d.id] })),
        chartImage: chart.current?.getDataURL({ pixelRatio: 2, backgroundColor: '#ffffff' }) ?? null,
        pack,
      }
    : null;

  return (
    <div className="flex flex-col gap-3" data-testid="stress-tab">
      <Card title={t('wi.stress.title')} subtitle={t('wi.stress.sub')} sim>
        <div className="flex items-center gap-6 flex-wrap">
          <Toggle on={on.chokepoint} onChange={(v) => setOn((s) => ({ ...s, chokepoint: v }))} label={t('wi.stress.chokepoint')} />
          <Toggle on={on.calendar} onChange={(v) => setOn((s) => ({ ...s, calendar: v }))} label={t('wi.stress.calendar')} />
          <Toggle on={on.asset} onChange={(v) => setOn((s) => ({ ...s, asset: v }))} label={t('wi.stress.asset')} />
          <Toggle on={on.price} onChange={(v) => setOn((s) => ({ ...s, price: v }))} label={t('wi.stress.price')} />
          <div className="flex-1" />
          <Btn variant="primary" icon={<FileText size={15} />} disabled={!bdata} onClick={() => { setBriefing(true); }} data-testid="gen-briefing">
            {t('wi.stress.briefing')}
          </Btn>
        </div>
      </Card>
      <div className="grid grid-cols-4 gap-3 max-[1200px]:grid-cols-2">
        <Kpi label={t('wi.kpi.finish')} value={fmtDate(result?.finish ?? snap.forecastFinish, lang)} tone={result && result.dFinish > 14 ? 'bad' : 'neutral'} hint={result ? fmtDays(result.dFinish, lang, true) : undefined} />
        <Kpi label={t('wi.kpi.cost')} value={`AED ${fmtAed(result?.cost.total ?? 0, lang)}`} tone={(result?.cost.total ?? 0) > 2e7 ? 'bad' : 'warn'} />
        <Kpi label={t('wi.stress.afterPkg')} value={pkg ? fmtDays(pkg.result.dFinish, lang, true) : '-'} tone="good" hint={pkg ? `AED ${fmtAed(pkg.result.cost.total, lang)}` : undefined} />
        <Kpi label={t('wi.kpi.critical')} value={`${result?.newlyCritical.length ?? 0}`} hint={`${result?.affectedElements.length ?? 0} ${t('wi.kpi.elements')}`} />
      </div>
      <div className="grid grid-cols-[1.4fr_1fr] gap-3 max-[1200px]:grid-cols-1">
        <Card title={t('wi.stress.tornado')} subtitle={t('wi.stress.tornadoSub')} sim>
          <Chart option={tornado} height={210} onReady={(c) => (chart.current = c)} />
          <div className="text-[11.5px] text-dim mt-1">{t('wi.stress.nonAdditive')}</div>
        </Card>
        <Card title={t('wi.cost.title')} sim>
          {result ? <CostBars cost={result.cost} lang={lang} /> : <div className="text-[12px] text-dim">{t('wi.supply.empty')}</div>}
        </Card>
      </div>
      <CompareCard title={t('wi.cmp.title')} rows={rows} />
      {result && (
        <>
          <ActionsBar onSave={save} onCommit={commit} committed={committed} />
          <Card title={t('wi.ripple.title')} subtitle={`${result.changed.length} ${t('wi.ripple.acts')}`}>
            <ChangedList result={result} pack={pack} lang={lang} onOpen={(id) => nav(`/schedule?act=${id}`)} />
          </Card>
        </>
      )}
      {briefing && bdata && <BoardBriefing data={{ ...bdata, chartImage: chart.current?.getDataURL({ pixelRatio: 2, backgroundColor: '#ffffff' }) ?? null }} onClose={() => setBriefing(false)} />}
    </div>
  );
}
