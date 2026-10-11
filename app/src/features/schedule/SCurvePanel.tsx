import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, Kpi } from '../../design/ui';
import { Chart, useChartPalette } from '../../design/Chart';
import { fmtAed, fmtDate, fmtMonth, type Lang } from '../../lib/fmt';
import type { Snapshot } from '../../sim/types';

export function SCurvePanel({ snap, scenarioFinish }: { snap: Snapshot; scenarioFinish: number | null }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Lang;
  const pal = useChartPalette();
  const s = snap.sCurve;
  const bac = snap.evm.bac;
  const option = useMemo(() => {
    const cats = s.t.map((x) => fmtMonth(x, lang));
    const m = (v: number | null) => (v === null ? null : Math.round(v / 1e6));
    return {
      grid: { left: 54, right: 24, top: 36, bottom: 30 },
      legend: { top: 0, textStyle: { color: pal.muted }, itemWidth: 18 },
      tooltip: { trigger: 'axis', valueFormatter: (v: number) => `AED ${v} M` },
      xAxis: { type: 'category', data: cats, axisLabel: { color: pal.muted, interval: 2 }, axisLine: { lineStyle: { color: pal.line } } },
      yAxis: { type: 'value', name: 'AED M', nameTextStyle: { color: pal.muted }, axisLabel: { color: pal.muted }, splitLine: { lineStyle: { color: pal.grid } } },
      series: [
        { name: t('sched.sc.planned'), type: 'line', smooth: true, symbol: 'none', data: s.planned.map(m), lineStyle: { color: pal.info, width: 2.2 }, areaStyle: { color: pal.info, opacity: 0.06 } },
        { name: t('sched.sc.forecast'), type: 'line', smooth: true, symbol: 'none', data: s.forecast.map(m), lineStyle: { color: pal.warn, width: 2, type: 'dashed' } },
        { name: t('sched.sc.earned'), type: 'line', smooth: true, symbol: 'none', data: s.earned.map(m), lineStyle: { color: pal.good, width: 3 } },
        {
          name: t('sched.sc.actual'),
          type: 'line',
          smooth: true,
          symbol: 'none',
          data: s.actual.map(m),
          lineStyle: { color: pal.bad, width: 2 },
          markLine: { symbol: 'none', silent: true, lineStyle: { color: pal.accent, type: 'dashed' }, label: { color: pal.accent, formatter: t('hdr.dataDate') }, data: [{ xAxis: Math.round(snap.nowT / 30) }] },
        },
      ],
    };
  }, [s, lang, pal, t, snap.nowT]);
  const e = snap.evm;
  return (
    <div className="flex flex-col gap-3" data-testid="scurve">
      <div className="grid grid-cols-5 gap-3 max-[1200px]:grid-cols-3">
        <Kpi label="SPI" value={e.spi.toFixed(2)} tone={e.spi < 0.95 ? 'warn' : 'good'} />
        <Kpi label="CPI" value={e.cpi.toFixed(2)} tone={e.cpi < 0.97 ? 'warn' : 'good'} />
        <Kpi label={t('sched.sc.pv')} value={`AED ${fmtAed(e.pv, lang)}`} />
        <Kpi label={t('sched.sc.ev')} value={`AED ${fmtAed(e.ev, lang)}`} />
        <Kpi label={t('sched.sc.finish')} value={fmtDate(scenarioFinish ?? snap.forecastFinish, lang)} tone={scenarioFinish ? 'warn' : 'neutral'} />
      </div>
      <Card title={t('sched.tab.scurve')} subtitle={`${t('sched.sc.bac')}: AED ${fmtAed(bac, lang)}`} sim>
        <Chart option={option} height={360} />
      </Card>
    </div>
  );
}
