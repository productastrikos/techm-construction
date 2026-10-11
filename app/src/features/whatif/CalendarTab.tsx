import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../app/store';
import { Card, Chip, Kpi, Seg, Select, Toggle } from '../../design/ui';
import { Chart, useChartPalette } from '../../design/Chart';
import { fmtDate, fmtNum, fmtPct, type Lang } from '../../lib/fmt';
import { tx } from '../../lib/bi';
import { PROJECT_START, weekday, ymdToT } from '../../engine/dates';
import type { Delta } from '../../engine/scenario';
import type { CalId, CalendarLayers } from '../../engine/types';
import { getDs, usePack, useSnapshot } from '../../sim/useSim';
import { ActionsBar, ChangedList, CompareCard, CostBars, OptionCards } from './shared';
import { useRecovery, useRunner } from './useRunner';
import { useScenario } from './scenarioStore';

type Preset = 'none' | 'ramadan' | 'eid' | 'ramEid' | 'summer' | 'weather' | 'heat' | 'all';
const LAYERS: Array<keyof CalendarLayers> = ['ramadan', 'eidLeave', 'midday', 'weather', 'heat'];
const PRESET_LAYERS: Record<Preset, Partial<CalendarLayers>> = {
  none: {},
  ramadan: { ramadan: true },
  eid: { eidLeave: true },
  ramEid: { ramadan: true, eidLeave: true },
  summer: { midday: true },
  weather: { weather: true },
  heat: { heat: true },
  all: { ramadan: true, eidLeave: true, midday: true, weather: true, heat: true },
};
const WEEKDAYS_EN = ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const WEEKDAYS_AR = ['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'];

export default function CalendarTab() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Lang;
  const pack = usePack();
  const snap = useSnapshot();
  const nav = useNavigate();
  const simT = useApp((s) => s.simT);
  const pal = useChartPalette();
  const [preset, setPreset] = useState<Preset>('none');
  const [layers, setLayers] = useState<Partial<CalendarLayers>>({});
  const [profile, setProfile] = useState<CalId>('site');
  const [applied, setApplied] = useState<string | null>(null);

  useEffect(() => {
    const on = (e: Event) => {
      if ((e as CustomEvent).detail?.flow !== 'h2') return;
      choose('ramEid');
      setTimeout(() => (document.querySelector('[data-testid="apply-night"]') as HTMLElement | null)?.click(), 2800);
    };
    window.addEventListener('mz:replay', on);
    return () => window.removeEventListener('mz:replay', on);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const choose = (p: Preset) => {
    setPreset(p);
    setLayers(PRESET_LAYERS[p]);
    setApplied(null);
  };
  const win = useMemo(() => {
    if (preset === 'summer') return { fromT: ymdToT(2027, 6, 15), toT: ymdToT(2027, 9, 15) };
    if (preset === 'weather') return { fromT: ymdToT(2027, 6, 1), toT: ymdToT(2027, 8, 31) };
    if (preset === 'heat') return { fromT: ymdToT(2027, 6, 1), toT: ymdToT(2027, 9, 30) };
    if (preset === 'all') return { fromT: simT, toT: snap.forecastFinish };
    return { fromT: ymdToT(2027, 2, 8), toT: ymdToT(2027, 3, 20) };
  }, [preset, simT, snap.forecastFinish]);

  const active = LAYERS.some((k) => layers[k]);
  const base = useMemo<Delta[]>(() => (active ? [{ kind: 'layers', layers }] : []), [active, layers]);
  const rec = useRecovery('calendar', base, win, active);
  const appliedOpt = rec.options?.find((o) => o.id === applied) ?? null;
  const finalDeltas = appliedOpt ? appliedOpt.deltas : base;
  const label = `${t(`wi.cal.preset.${preset}`)}${appliedOpt ? ' + ' + tx(appliedOpt.title, lang) : ''}`;
  const { result } = useRunner(finalDeltas, label);
  const noAction = rec.baseResult ?? result;

  // ---- productive hours heatmap (baseline vs scenario) from the simulator
  const from = ymdToT(2027, 1, 1);
  const to = ymdToT(2028, 12, 31);
  const [hrs, setHrs] = useState<{ base: number[]; scen: number[] } | null>(null);
  useEffect(() => {
    let live = true;
    (async () => {
      const ds = getDs();
      const [b, s] = await Promise.all([ds.productiveHours(profile, {}, from, to), ds.productiveHours(profile, layers, from, to)]);
      if (live) setHrs({ base: b, scen: s });
    })();
    return () => {
      live = false;
    };
  }, [profile, layers, from, to]);

  const stats = useMemo(() => {
    if (!hrs) return null;
    const sum = (a: number[], x0: number, x1: number) => a.slice(Math.max(0, x0 - from), x1 - from + 1).reduce((s, v) => s + v, 0);
    const b = sum(hrs.base, win.fromT, win.toT);
    const s = sum(hrs.scen, win.fromT, win.toT);
    return { baseH: b, scenH: s, lossPct: b > 0 ? 1 - s / b : 0 };
  }, [hrs, win, from]);

  const [craneStats, setCraneStats] = useState<number | null>(null);
  useEffect(() => {
    let live = true;
    (async () => {
      const ds = getDs();
      const [b, s] = await Promise.all([ds.productiveHours('crane', {}, win.fromT, win.toT), ds.productiveHours('crane', layers, win.fromT, win.toT)]);
      const sb = b.reduce((x, y) => x + y, 0);
      const ss = s.reduce((x, y) => x + y, 0);
      if (live) setCraneStats(sb > 0 ? 1 - ss / sb : 0);
    })();
    return () => {
      live = false;
    };
  }, [layers, win]);

  const heatOption = useMemo(() => {
    if (!hrs) return {};
    const data: Array<[number, number, number]> = [];
    // x = week index since `from` (weeks start Saturday), y = weekday index 0..6 (Sat..Fri)
    for (let i = 0; i < hrs.scen.length; i++) {
      const day = from + i;
      const wd = weekdayOf(day); // 0 Sun..6 Sat
      const col = (wd + 1) % 7; // Sat=0
      const week = Math.floor((i + weekdayOffset(from)) / 7);
      data.push([week, col, Math.round(hrs.scen[i] * 10) / 10]);
    }
    const weeks = Math.ceil((hrs.scen.length + weekdayOffset(from)) / 7);
    const names = lang === 'ar' ? WEEKDAYS_AR : WEEKDAYS_EN;
    const monthLabel = (w: number) => {
      const t0 = from - weekdayOffset(from) + w * 7;
      return fmtDate(t0, lang, 'short');
    };
    return {
      grid: { left: 52, right: 12, top: 8, bottom: 62 },
      tooltip: { formatter: (p: { data: [number, number, number] }) => `${monthLabel(p.data[0])} (${names[p.data[1]]}): <b>${p.data[2]} h</b>` },
      xAxis: { type: 'category', data: Array.from({ length: weeks }, (_, i) => i), axisLabel: { color: pal.muted, interval: 12, formatter: (v: string) => monthLabel(Number(v)) }, splitArea: { show: false }, axisLine: { lineStyle: { color: pal.line } } },
      yAxis: { type: 'category', data: names, inverse: true, axisLabel: { color: pal.muted, fontSize: 10 }, axisLine: { show: false } },
      visualMap: { min: 0, max: 10, calculable: false, orient: 'horizontal', left: 'center', bottom: 0, itemWidth: 12, itemHeight: 140, textStyle: { color: pal.muted }, inRange: { color: ['#3a1f2c', '#a14a4a', '#d8a13e', '#3ee0b0'] }, text: [lang === 'ar' ? '10 س' : '10 h', '0'] },
      series: [{ type: 'heatmap', data, itemStyle: { borderColor: pal.surface, borderWidth: 1 }, emphasis: { itemStyle: { borderColor: '#fff' } } }],
    };
  }, [hrs, lang, pal, from]);

  const weeklyOption = useMemo(() => {
    if (!hrs) return {};
    const weeks = Math.ceil(hrs.scen.length / 7);
    const agg = (a: number[]) => Array.from({ length: weeks }, (_, w) => Math.round(a.slice(w * 7, w * 7 + 7).reduce((s, v) => s + v, 0)));
    return {
      grid: { left: 44, right: 12, top: 24, bottom: 24 },
      legend: { top: 0, textStyle: { color: pal.muted } },
      tooltip: { trigger: 'axis' },
      xAxis: { type: 'category', data: Array.from({ length: weeks }, (_, w) => fmtDate(from + w * 7, lang, 'short')), axisLabel: { color: pal.muted, interval: 12 } },
      yAxis: { type: 'value', axisLabel: { color: pal.muted }, splitLine: { lineStyle: { color: pal.grid } }, name: lang === 'ar' ? 'ساعات/أسبوع' : 'h/week', nameTextStyle: { color: pal.muted } },
      series: [
        { name: t('wi.cal.baseline'), type: 'line', symbol: 'none', data: agg(hrs.base), lineStyle: { color: pal.info, width: 1.6 } },
        { name: t('wi.cal.scenario'), type: 'line', symbol: 'none', data: agg(hrs.scen), lineStyle: { color: pal.warn, width: 2.2 }, areaStyle: { color: pal.warn, opacity: 0.12 } },
      ],
    };
  }, [hrs, pal, lang, from, t]);

  const mitigationOption = useMemo(() => {
    const o = rec.options ?? [];
    return {
      grid: { left: 130, right: 60, top: 8, bottom: 26 },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      xAxis: { type: 'value', axisLabel: { color: pal.muted }, splitLine: { lineStyle: { color: pal.grid } } },
      yAxis: { type: 'category', data: o.map((x) => tx(x.title, lang)).reverse(), axisLabel: { color: pal.muted, width: 120, overflow: 'truncate' } },
      series: [{ type: 'bar', name: t('wi.opt.recovers'), data: o.map((x) => Math.round(x.recoveredDays * 10) / 10).reverse(), itemStyle: { color: pal.good }, label: { show: true, position: 'right', color: pal.text, formatter: (p: { value: number }) => `${p.value} d` } }],
    };
  }, [rec.options, pal, lang, t]);

  const committed = useScenario((s) => s.saved.some((x) => x.id === label && x.committed));
  const save = () => result && useScenario.getState().save({ id: label, name: label, deltas: finalDeltas, result, committed: false });
  const commit = () => {
    if (!result) return;
    save();
    useScenario.getState().commit(label);
  };
  const pushed = result ? result.changed.filter((c) => c.dEf >= 1).length : 0;
  const compareRows = [
    { label: t('wi.cmp.live'), finish: fmtDate(snap.forecastFinish, lang), delta: 0, cost: 0 },
    ...(noAction && active ? [{ label: t('wi.cmp.noAction'), finish: fmtDate(noAction.finish, lang), delta: noAction.dFinish, cost: noAction.cost.total }] : []),
    ...(rec.options ?? []).slice(0, 4).map((o) => ({ label: tx(o.title, lang), finish: fmtDate(o.finish, lang), delta: o.dFinish, cost: o.result.cost.total, highlight: applied === o.id })),
  ];
  const presets: Preset[] = ['ramadan', 'eid', 'ramEid', 'summer', 'weather', 'heat', 'all'];

  return (
    <div className="flex flex-col gap-3" data-testid="calendar-tab">
      <Card title={t('wi.cal.pick')} subtitle={t('wi.cal.pickSub')} sim>
        <div className="flex items-center gap-3 flex-wrap">
          <Seg<Preset> ariaLabel="preset" value={preset} onChange={choose} options={[{ value: 'none', label: t('wi.cal.preset.none') }, ...presets.map((p) => ({ value: p, label: t(`wi.cal.preset.${p}`) }))]} />
        </div>
        <div className="flex items-center gap-4 mt-3 flex-wrap">
          {LAYERS.map((k) => (
            <Toggle key={k} on={!!layers[k]} onChange={(v) => { setLayers((l) => ({ ...l, [k]: v })); setPreset('none'); setApplied(null); }} label={t(`wi.cal.layer.${k}`)} />
          ))}
          <div className="flex-1" />
          <Select<CalId> ariaLabel="profile" value={profile} onChange={setProfile} options={pack.calendars.map((c) => ({ value: c.id, label: tx(c.name, lang) }))} />
        </div>
      </Card>
      <div className="grid grid-cols-5 gap-3 max-[1200px]:grid-cols-3">
        <Kpi label={t('wi.cal.hoursLost')} value={stats ? fmtPct(stats.lossPct, lang, 1) : '-'} tone={stats && stats.lossPct > 0.1 ? 'bad' : stats && stats.lossPct > 0 ? 'warn' : 'neutral'} hint={`${t('wi.cal.period')}: ${fmtDate(win.fromT, lang, 'short')} - ${fmtDate(win.toT, lang, 'short')}`} />
        <Kpi label={t('wi.cal.caisson')} value={craneStats === null ? '-' : craneStats < 0.0005 ? fmtPct(0, lang, 1) : `-${fmtPct(craneStats, lang, 1)}`} tone={craneStats && craneStats > 0.08 ? 'bad' : 'neutral'} hint={t('wi.cal.caissonHint')} />
        <Kpi label={t('wi.kpi.finish')} value={fmtDate(result?.finish ?? snap.forecastFinish, lang)} tone={result && result.dFinish > 1 ? 'warn' : 'neutral'} hint={result ? `${result.dFinish > 0 ? '+' : ''}${fmtNum(result.dFinish, lang, 1)} ${t('unit.d')}` : undefined} />
        <Kpi label={t('wi.cal.pushed')} value={`${pushed}`} hint={t('wi.cal.pushedHint')} />
        <Kpi label={t('wi.kpi.cost')} value={`AED ${fmtNum((result?.cost.total ?? 0) / 1e6, lang, 1)} M`} tone={(result?.cost.total ?? 0) > 5e6 ? 'warn' : 'neutral'} hint={t('wi.kpi.costHint')} />
      </div>
      <div className="grid grid-cols-[1.6fr_1fr] gap-3 max-[1200px]:grid-cols-1">
        <Card title={t('wi.cal.heat')} subtitle={`${tx(pack.calendars.find((c) => c.id === profile)?.name, lang)} - ${t('wi.cal.heatSub')}`} sim>
          <Chart option={heatOption} height={230} />
        </Card>
        <Card title={t('wi.cal.weekly')} subtitle={t('wi.cal.weeklySub')}>
          <Chart option={weeklyOption} height={230} />
        </Card>
      </div>
      {active && result && (
        <>
          <ActionsBar onSave={save} onCommit={commit} committed={committed} />
          {(rec.options?.length ?? 0) > 0 && (
            <Card title={t('wi.cal.mitigations')} subtitle={t('wi.cal.mitSub')} sim="rule">
              <div className="grid grid-cols-[1fr_340px] gap-4 max-[1200px]:grid-cols-1">
                <OptionCards options={rec.options!} applied={applied} onApply={setApplied} lang={lang} baseDFinish={noAction?.dFinish ?? 0} />
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-dim mb-1">{t('wi.opt.recovers')}</div>
                  <Chart option={mitigationOption} height={220} />
                </div>
              </div>
            </Card>
          )}
          <div className="grid grid-cols-2 gap-3 max-[1200px]:grid-cols-1">
            <Card title={t('wi.cost.title')} sim>
              <CostBars cost={result.cost} lang={lang} />
            </Card>
            <Card title={t('wi.ripple.title')} subtitle={`${result.changed.length} ${t('wi.ripple.acts')}`}>
              <ChangedList result={result} pack={pack} lang={lang} onOpen={(id) => nav(`/schedule?act=${id}`)} />
            </Card>
          </div>
          <CompareCard title={t('wi.cmp.title')} rows={compareRows} />
        </>
      )}
      <Card title={t('wi.cal.holidays')} subtitle={t('wi.cal.holidaysSub')}>
        <div className="flex flex-wrap gap-1.5">
          {pack.rules.holidays
            .filter((h) => h.endT >= simT - 5 && h.startT < simT + 460)
            .map((h) => (
              <Chip key={h.id} tone={h.uncertaintyDays ? 'warn' : 'neutral'} title={h.uncertaintyDays ? t('wi.cal.uncertain') : ''}>
                {tx(h.name, lang)} {fmtDate(h.startT, lang, 'short')}
                {h.endT > h.startT ? ` - ${fmtDate(h.endT, lang, 'short')}` : ''}
                {h.uncertaintyDays ? ' ±1' : ''}
              </Chip>
            ))}
        </div>
        <details className="mt-3 text-[12px] text-muted">
          <summary className="cursor-pointer font-medium">{t('common.assumptions')}</summary>
          <ul className="mt-1.5 ps-5 leading-relaxed">
            <li>{t('wi.cal.as.ramadan')}</li>
            <li>{t('wi.cal.as.midday')}</li>
            <li>{t('wi.cal.as.weather')}: {pack.rules.weather.sea.map((x) => Math.round(x * 100)).join(' / ')} %</li>
            <li>{t('wi.cal.as.heat')}: {pack.rules.heat.map((x) => Math.round(x * 100)).join(' / ')} %</li>
            <li>{t('wi.cal.as.base')}</li>
          </ul>
        </details>
      </Card>
    </div>
  );
}

function weekdayOf(t: number): number {
  return weekday(PROJECT_START + Math.floor(t));
}
/** how many columns into the first week (Saturday-based) the first day falls */
function weekdayOffset(t0: number): number {
  return (weekdayOf(t0) + 1) % 7;
}

