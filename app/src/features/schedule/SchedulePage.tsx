import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { Maximize2, ZoomIn, ZoomOut } from 'lucide-react';
import { Btn, Chip, PageHeader, Select, Seg, Tabs, Toggle } from '../../design/ui';
import { fmtDate, fmtDays, type Lang } from '../../lib/fmt';
import { tx } from '../../lib/bi';
import { usePack, useSnapshot } from '../../sim/useSim';
import { useScenario } from '../whatif/scenarioStore';
import { useWorkOrders } from '../assets/woStore';
import { GanttChart, type GanttFilters } from './GanttChart';
import { ActivityDetail } from './ActivityDetail';
import { LookAhead } from './LookAhead';
import { SCurvePanel } from './SCurvePanel';
import { AiAnalyst, AiAnalystButton } from './AiAnalyst';

type Tab = 'gantt' | 'lookahead' | 'scurve';

export default function SchedulePage() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Lang;
  const pack = usePack();
  const snap = useSnapshot();
  const scen = useScenario((s) => s.active);
  const wos = useWorkOrders((s) => s.list);
  const maintenance = useMemo(() => wos.filter((w) => w.status !== 'done' && w.fromT !== undefined && w.source !== 'schedule').map((w) => ({ id: w.id, assetId: w.assetId, fromT: w.fromT!, toT: w.toT ?? w.fromT! + 1 })), [wos]);
  const [sp, setSp] = useSearchParams();
  const [tab, setTab] = useState<Tab>('gantt');
  const [px, setPx] = useState(1.6);
  const [ai, setAi] = useState(false);
  const [selected, setSelected] = useState<string | null>(sp.get('act'));
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [focus, setFocus] = useState<{ id: string; nonce: number } | null>(sp.get('act') ? { id: sp.get('act')!, nonce: 1 } : null);
  const [filters, setFilters] = useState<GanttFilters>({ wbs: 'all', criticalOnly: false, baseline: true, calendar: true, links: false, query: '', changedOnly: !!useScenario.getState().active });
  const [showScenario, setShowScenario] = useState(true);
  const set = (p: Partial<GanttFilters>) => setFilters((f) => ({ ...f, ...p }));

  useEffect(() => {
    const a = sp.get('act');
    if (a && a !== selected) {
      setSelected(a);
      setFocus((f) => ({ id: a, nonce: (f?.nonce ?? 0) + 1 }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sp]);

  const scenarioCpm = showScenario && scen ? scen.result.cpm : null;
  const res = scenarioCpm ?? snap.forecast;
  const delta = res.finish - snap.baselineFinish;

  const select = (id: string | null) => {
    setSelected(id);
    if (id) {
      setFocus(null);
      const n = new URLSearchParams(sp);
      n.set('act', id);
      setSp(n, { replace: true });
    }
  };
  const wbsOptions = useMemo(
    () => [{ value: 'all', label: t('common.all') }, ...pack.wbs.map((w) => ({ value: w.id, label: tx(w.name, lang) }))],
    [pack, lang, t],
  );

  return (
    <div className="h-full flex flex-col min-h-0" data-testid="schedule-page">
      <PageHeader
        title={t('nav.schedule')}
        subtitle={`${pack.activities.length} ${t('sched.activities')} - ${t('sched.baselineFinish')} ${fmtDate(snap.baselineFinish, lang)} - ${t('sched.forecastFinish')} ${fmtDate(res.finish, lang)} (${fmtDays(delta, lang, true)})`}
        sim
        actions={scen ? <Chip tone="warn" dot>{t('sched.scenarioActive')}: {scen.label}</Chip> : undefined}
      />
      <div className="px-5">
        <Tabs<Tab> value={tab} onChange={setTab} tabs={[{ id: 'gantt', label: t('sched.tab.gantt') }, { id: 'lookahead', label: t('sched.tab.lookahead') }, { id: 'scurve', label: t('sched.tab.scurve') }]} />
      </div>
      {tab === 'gantt' && (
        <>
          <div className="px-5 py-2 flex items-center gap-3 flex-wrap">
            <Select value={filters.wbs} onChange={(v) => set({ wbs: v })} options={wbsOptions} ariaLabel="WBS" className="max-w-[200px]" />
            <input value={filters.query} onChange={(e) => set({ query: e.target.value })} placeholder={t('sched.search')} className="h-8 rounded-lg border border-line-2 bg-surface-2 px-2.5 text-[13px] w-[170px]" aria-label={t('sched.search')} />
            <Toggle on={filters.criticalOnly} onChange={(v) => set({ criticalOnly: v })} label={t('sched.criticalOnly')} />
            <Toggle on={filters.baseline} onChange={(v) => set({ baseline: v })} label={t('sched.showBaseline')} />
            <Toggle on={filters.calendar} onChange={(v) => set({ calendar: v })} label={t('sched.showCalendar')} />
            <Toggle on={filters.links} onChange={(v) => set({ links: v })} label={t('sched.showLinks')} />
            {scen && <Toggle on={showScenario} onChange={setShowScenario} label={t('sched.showScenario')} />}
            {scen && <Toggle on={!!filters.changedOnly} onChange={(v) => set({ changedOnly: v })} label={t('sched.changedOnly')} />}
            <div className="flex-1" />
            <AiAnalystButton active={ai} onClick={() => setAi((v) => !v)} />
            <Seg size="sm" value={px} onChange={setPx} ariaLabel="zoom" options={[{ value: 0.7, label: <ZoomOut size={13} /> }, { value: 1.6, label: '1x' }, { value: 3.2, label: '2x' }, { value: 6.4, label: <ZoomIn size={13} /> }]} />
            <Btn size="sm" variant="ghost" onClick={() => setPx(0.62)} title={t('sched.fit')}>
              <Maximize2 size={14} />
            </Btn>
          </div>
          {ai && <AiAnalyst pack={pack} snap={snap} onSelect={select} onClose={() => setAi(false)} />}
          <div className="flex-1 min-h-0 px-5 pb-2 flex flex-col gap-2">
            <div className="flex-1 min-h-0">
              <GanttChart
                pack={pack}
                snap={snap}
                scenario={scenarioCpm}
                lang={lang}
                pxPerDay={px}
                filters={filters}
                selected={selected}
                onSelect={select}
                collapsed={collapsed}
                onToggle={(w) => setCollapsed((c) => { const n = new Set(c); n.has(w) ? n.delete(w) : n.add(w); return n; })}
                leftW={430}
                maintenance={maintenance}
                focus={focus}
              />
            </div>
            {selected && (
              <div className="h-[168px] shrink-0">
                <ActivityDetail pack={pack} snap={snap} scenario={scenarioCpm} id={selected} onClose={() => setSelected(null)} onSelect={select} />
              </div>
            )}
          </div>
          <div className="px-5 pb-2 flex gap-4 text-[11px] text-dim flex-wrap">
            <Legend color="var(--dim)" label={t('sched.leg.baseline')} />
            <Legend color="var(--accent)" label={t('sched.leg.forecast')} />
            <Legend color="var(--bad)" label={t('sched.leg.critical')} outline />
            <Legend color="var(--warn)" label={t('sched.leg.scenario')} />
            <Legend color="var(--info)" label={t('sched.leg.delivery')} diamond />
            <Legend color="var(--violet)" label={t('sched.leg.maint')} band />
            <Legend color="var(--bad)" label={t('sched.leg.holiday')} band />
            <Legend color="var(--violet)" label={t('sched.leg.ramadan')} band />
            <Legend color="var(--warn)" label={t('sched.leg.midday')} band />
          </div>
        </>
      )}
      {tab === 'lookahead' && (
        <div className="flex-1 min-h-0 overflow-auto px-5 py-3">
          <LookAhead pack={pack} snap={snap} onOpen={(id) => { setTab('gantt'); select(id); setFocus({ id, nonce: Date.now() }); }} />
        </div>
      )}
      {tab === 'scurve' && (
        <div className="flex-1 min-h-0 overflow-auto px-5 py-3">
          <SCurvePanel snap={snap} scenarioFinish={scenarioCpm?.finish ?? null} />
        </div>
      )}
    </div>
  );
}

function Legend({ color, label, outline, diamond, band }: { color: string; label: string; outline?: boolean; diamond?: boolean; band?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={`inline-block ${diamond ? 'rotate-45 size-2' : band ? 'w-3.5 h-3' : 'w-4 h-2'} rounded-sm`}
        style={{ background: band ? `color-mix(in srgb, ${color} 30%, transparent)` : outline ? 'transparent' : color, border: outline ? `1.6px solid ${color}` : band ? `1px solid ${color}` : 'none' }}
      />
      {label}
    </span>
  );
}
