import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Sun } from 'lucide-react';
import { Bar, Card, Chip, Kpi, toneVar } from '../../design/ui';
import { Chart, useChartPalette } from '../../design/Chart';
import { fmtMonth, fmtNum, fmtPct, type Lang } from '../../lib/fmt';
import { tx } from '../../lib/bi';
import { dayToYmd, tToDay } from '../../engine/dates';
import { usePack, useSnapshot } from '../../sim/useSim';
import { CONTRACTS } from '../cost/data';
import { OBS_CATEGORIES, PERMITS, TRAINING, WBGT_BY_MONTH } from './data';
import { useHse } from './hseStore';

export function HseDashboard() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Lang;
  const pack = usePack();
  const snap = useSnapshot();
  const pal = useChartPalette();
  const permits = useHse((s) => s.permits);
  const k = snap.kpis;
  const seed = pack.config.kpiSeed;
  const monthsIn = Math.max(1, snap.nowT / 30);
  const manhoursTotal = seed.manhoursMonth * monthsIn;
  const pos = OBS_CATEGORIES.reduce((s, c) => s + c.pos, 0);
  const neg = OBS_CATEGORIES.reduce((s, c) => s + c.neg, 0);
  const trainHours = TRAINING.reduce((s, c) => s + c.hours, 0);
  const activePermits = PERMITS.filter((p) => (permits[p.id] ?? p.status) === 'active').length;

  const ymd = dayToYmd(tToDay(snap.nowT));
  const wbgt = WBGT_BY_MONTH[ymd.m - 1];
  const heat = wbgt >= 32 ? { tone: 'bad' as const, key: 'extreme' } : wbgt >= 30 ? { tone: 'warn' as const, key: 'high' } : wbgt >= 28 ? { tone: 'info' as const, key: 'moderate' } : { tone: 'good' as const, key: 'low' };
  const inBan = (ymd.m > 6 || (ymd.m === 6 && ymd.d >= 15)) && (ymd.m < 9 || (ymd.m === 9 && ymd.d <= 15));

  const obsOpt = useMemo(
    () => ({
      grid: { left: 118, right: 16, top: 26, bottom: 22 },
      legend: { top: 0, textStyle: { color: pal.muted } },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      xAxis: { type: 'value', axisLabel: { color: pal.muted }, splitLine: { lineStyle: { color: pal.grid } } },
      yAxis: { type: 'category', inverse: true, data: OBS_CATEGORIES.map((c) => tx(c.name, lang)), axisLabel: { color: pal.text, fontSize: 11 } },
      series: [
        { name: t('hse.obs.pos'), type: 'bar', stack: 'o', data: OBS_CATEGORIES.map((c) => c.pos), itemStyle: { color: pal.good }, barWidth: 12 },
        { name: t('hse.obs.neg'), type: 'bar', stack: 'o', data: OBS_CATEGORIES.map((c) => c.neg), itemStyle: { color: pal.bad, borderRadius: [0, 3, 3, 0] } },
      ],
    }),
    [pal, lang, t],
  );

  const ltifrOpt = useMemo(() => {
    const months = Array.from({ length: 12 }, (_, i) => i);
    const vals = [0.82, 0.74, 0.7, 0.66, 0.6, 0.58, 0.55, 0.5, 0.47, 0.45, 0.43, k.ltifr];
    return {
      grid: { left: 40, right: 14, top: 18, bottom: 26 },
      tooltip: { trigger: 'axis' },
      xAxis: { type: 'category', data: months.map((m) => fmtMonth(snap.nowT - (11 - m) * 30, lang)), axisLabel: { color: pal.muted, interval: 2 }, axisLine: { lineStyle: { color: pal.line } } },
      yAxis: { type: 'value', min: 0, axisLabel: { color: pal.muted }, splitLine: { lineStyle: { color: pal.grid } } },
      series: [{ type: 'line', smooth: true, symbol: 'circle', symbolSize: 5, data: vals, lineStyle: { color: pal.accent, width: 2.6 }, areaStyle: { color: pal.accent, opacity: 0.08 }, markLine: { silent: true, symbol: 'none', lineStyle: { color: pal.warn, type: 'dashed' }, label: { color: pal.warn, formatter: t('hse.target') }, data: [{ yAxis: 0.5 }] } }],
    };
  }, [pal, lang, t, k.ltifr, snap.nowT]);

  const crewOpt = useMemo(
    () => ({
      grid: { left: 130, right: 24, top: 8, bottom: 22 },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      xAxis: { type: 'value', axisLabel: { color: pal.muted }, splitLine: { lineStyle: { color: pal.grid } } },
      yAxis: { type: 'category', inverse: true, data: CONTRACTS.map((c) => c.party.replace(/ \(.*/, '')), axisLabel: { color: pal.text, fontSize: 10.5, width: 120, overflow: 'truncate' } },
      series: [{ type: 'bar', barWidth: 12, data: CONTRACTS.map((c, i) => ({ value: Math.round(k.manpower * [0.27, 0.34, 0.12, 0.15, 0.08, 0.04][i]), itemStyle: { color: pal.info, borderRadius: [0, 3, 3, 0] } })), label: { show: true, position: 'right', color: pal.muted } }],
    }),
    [pal, k.manpower],
  );

  const trainOpt = useMemo(
    () => ({
      grid: { left: 130, right: 30, top: 8, bottom: 22 },
      xAxis: { type: 'value', axisLabel: { color: pal.muted }, splitLine: { lineStyle: { color: pal.grid } } },
      yAxis: { type: 'category', inverse: true, data: TRAINING.map((c) => tx(c.name, lang)), axisLabel: { color: pal.text, fontSize: 10.5, width: 120, overflow: 'truncate' } },
      series: [{ type: 'bar', barWidth: 12, data: TRAINING.map((c) => ({ value: c.hours, itemStyle: { color: pal.violet, borderRadius: [0, 3, 3, 0] } })), label: { show: true, position: 'right', color: pal.muted } }],
    }),
    [pal, lang],
  );

  const forecast = Array.from({ length: 7 }, (_, i) => {
    const d = dayToYmd(tToDay(snap.nowT + i));
    const base = WBGT_BY_MONTH[d.m - 1];
    return { d: i, v: base + 1.6 * Math.sin(i * 1.3) };
  });

  return (
    <div className="space-y-3" data-testid="hse-dashboard">
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4 2xl:grid-cols-8">
        <Kpi label={t('hse.kpi.manpower')} value={fmtNum(k.manpower, lang)} sim />
        <Kpi label={t('hse.kpi.manhours')} value={fmtNum(manhoursTotal / 1000, lang)} unit="k" hint={t('hse.kpi.manhoursHint')} />
        <Kpi label="LTIFR" value={k.ltifr.toFixed(2)} tone={k.ltifr > 0.5 ? 'warn' : 'good'} hint={t('hse.kpi.ltifrHint')} />
        <Kpi label={t('hse.kpi.daysSince')} value={k.daysSinceLti} tone="good" hint={t('hse.kpi.daysSinceHint')} />
        <Kpi label={t('hse.kpi.severity')} value="2.1" hint={t('hse.kpi.severityHint')} />
        <Kpi label={t('hse.kpi.obs')} value={pos + neg} tone="info" hint={`${fmtPct(pos / (pos + neg), lang)} ${t('hse.obs.pos').toLowerCase()}`} />
        <Kpi label={t('hse.kpi.training')} value={fmtNum(trainHours, lang)} unit="h" />
        <Kpi label={t('hse.kpi.permits')} value={activePermits} tone="accent" hint={t('hse.kpi.permitsHint')} />
      </div>
      <div className="grid gap-3 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card title={t('hse.obs.title')} subtitle={`${pos} ${t('hse.obs.pos').toLowerCase()} / ${neg} ${t('hse.obs.neg').toLowerCase()}`} sim>
          <Chart option={obsOpt} height={270} />
        </Card>
        <Card title={t('hse.heat.title')} subtitle={t('hse.heat.sub')} sim="rule" actions={<Chip tone={heat.tone} dot>{t(`hse.heat.${heat.key}`)}</Chip>}>
          <div className="flex items-end gap-3">
            <div className="text-[34px] font-semibold num leading-none" style={{ color: toneVar[heat.tone] }}>{wbgt.toFixed(1)}<span className="text-[15px] text-dim"> C</span></div>
            <div className="text-[12px] text-muted pb-1">WBGT - {fmtMonth(snap.nowT, lang)}</div>
          </div>
          <div className="mt-3 flex items-end gap-1.5 h-[64px]">
            {forecast.map((f) => (
              <div key={f.d} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full rounded-t" style={{ height: `${Math.max(8, ((f.v - 18) / 20) * 52)}px`, background: f.v >= 32 ? toneVar.bad : f.v >= 30 ? toneVar.warn : f.v >= 28 ? toneVar.info : toneVar.good, opacity: 0.85 }} title={f.v.toFixed(1)} />
                <span className="text-[10px] text-dim num">+{f.d}d</span>
              </div>
            ))}
          </div>
          <div className="mt-3 rounded-lg border border-line p-2.5 text-[12px] text-muted flex gap-2">
            <Sun size={15} className="shrink-0 mt-0.5" style={{ color: toneVar.warn }} />
            <span>{inBan ? t('hse.heat.banOn') : t('hse.heat.banOff')} {t(`hse.heat.guide.${heat.key}`)}</span>
          </div>
        </Card>
      </div>
      <div className="grid gap-3 lg:grid-cols-3">
        <Card title={t('hse.ltifr.title')} subtitle={t('hse.ltifr.sub')} sim><Chart option={ltifrOpt} height={220} /></Card>
        <Card title={t('hse.crew.title')} sim><Chart option={crewOpt} height={220} /></Card>
        <Card title={t('hse.train.title')} sim><Chart option={trainOpt} height={220} /></Card>
      </div>
      <Card title={t('hse.unsafe.title')} subtitle={t('hse.unsafe.sub')} sim>
        <div className="grid grid-cols-2 gap-5">
          <div>
            <div className="flex justify-between text-[12.5px] mb-1"><span style={{ color: toneVar.good }}>{t('hse.obs.pos')}</span><span className="num font-semibold">{pos}</span></div>
            <Bar value={pos / (pos + neg)} tone="good" height={10} />
          </div>
          <div>
            <div className="flex justify-between text-[12.5px] mb-1"><span style={{ color: toneVar.bad }}>{t('hse.obs.neg')}</span><span className="num font-semibold">{neg}</span></div>
            <Bar value={neg / (pos + neg)} tone="bad" height={10} />
          </div>
        </div>
      </Card>
    </div>
  );
}
