import { useMemo, useRef, useState, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, CloudSun, HardHat, Play, RotateCw, Sparkles, Truck, Wrench } from 'lucide-react';
import { Card, Chip, Dot, Kpi, SimChip, Td, Th, toneVar, type Tone } from '../../design/ui';
import { MapView, type MapMarker } from '../../design/MapView';
import { imageUrl } from '../../lib/images';
import { fmtAed, fmtDate, fmtDays, fmtPct, type Lang } from '../../lib/fmt';
import { tx } from '../../lib/bi';
import { useApp, type Role } from '../../app/store';
import { usePack, useSnapshot } from '../../sim/useSim';
import type { Alarm, Snapshot } from '../../sim/types';
import { useProc } from '../procurement/model';
import { SITES, type SiteSummary } from './sites';
import { DroneCompare } from './DroneCompare';
import { AiBar, AiSteps, AiTag, Typed } from '../ai/kit';
import { openCopilot } from '../ai/Copilot';
import { openAlert } from '../ai/actionStore';

/** the briefing "writes itself" once per session, then stays static; Regenerate replays it */
let briefingPlayed = false;

const SEV: Record<Alarm['severity'], Tone> = { crit: 'bad', warn: 'warn', info: 'info' };
const SRC_ICON = { asset: <Wrench size={14} />, po: <Truck size={14} />, schedule: <AlertTriangle size={14} />, hse: <HardHat size={14} />, weather: <CloudSun size={14} /> };

function useGo() {
  const nav = useNavigate();
  const selectPo = useProc((s) => s.select);
  return (a: { source: Alarm['source']; ref: string }) => {
    if (a.source === 'po') {
      selectPo(a.ref);
      nav('/procurement');
    } else if (a.source === 'asset') nav(`/assets?asset=${a.ref}`);
    else if (a.source === 'schedule') nav(`/schedule?act=${a.ref}`);
    else if (a.source === 'hse') nav('/hse');
    else nav('/whatif/calendar');
  };
}

function KpiStrip({ role, snap }: { role: Role; snap: Snapshot }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Lang;
  const nav = useNavigate();
  const k = snap.kpis;
  const d = snap.dFinishVsBaseline;
  const open = snap.pos.filter((p) => p.stage < 6);
  const exposed = open.filter((p) => p.chokepointExposed).length;
  const hseAlarms = snap.alarms.filter((a) => a.source === 'hse').length;
  const worst = [...snap.assets].sort((a, b) => a.report.health - b.report.health)[0];
  const all: Record<string, ReactElement> = {
    finish: <Kpi key="finish" label={t('port.kpi.finish')} value={fmtDate(snap.forecastFinish, lang, 'short')} delta={fmtDays(d, lang, true)} deltaTone={d > 14 ? 'bad' : d > 1 ? 'warn' : 'good'} tone={d > 14 ? 'bad' : d > 1 ? 'warn' : 'good'} hint={`${t('port.kpi.baseline')} ${fmtDate(snap.baselineFinish, lang, 'short')}`} onClick={() => nav('/schedule')} sim />,
    spi: <Kpi key="spi" label="SPI" value={k.spi.toFixed(2)} tone={k.spi < 0.95 ? 'warn' : 'good'} hint={t('port.kpi.spiHint')} onClick={() => nav('/schedule')} />,
    cpi: <Kpi key="cpi" label="CPI" value={k.cpi.toFixed(2)} tone={k.cpi < 0.97 ? 'warn' : 'good'} hint={`EAC ${fmtAed(snap.evm.eac, lang)}`} onClick={() => nav('/cost')} />,
    safety: <Kpi key="safety" label={t('port.kpi.safety')} value={k.daysSinceLti} unit={t('common.days')} tone="good" hint={`LTIFR ${k.ltifr.toFixed(2)}`} onClick={() => nav('/hse')} />,
    risks: <Kpi key="risks" label={t('port.kpi.risks')} value={k.openRisks} tone={k.openRisks > 25 ? 'warn' : 'neutral'} hint={`${snap.alarms.length} ${t('port.alarms.title').toLowerCase()}`} />,
    matRisk: <Kpi key="matRisk" label={t('port.kpi.matRisk')} value={fmtAed(k.materialAtRiskAED, lang)} unit="AED" tone={k.materialAtRiskAED > 0 ? 'warn' : 'good'} hint={`${k.poAtRisk} / ${k.poTotal} POs`} onClick={() => nav('/procurement')} />,
    fleet: <Kpi key="fleet" label={t('port.kpi.fleet')} value={fmtPct(k.fleetAvailability, lang)} tone={k.fleetAvailability < 0.9 ? 'warn' : 'good'} hint={worst ? `${worst.id}: ${Math.round(worst.report.health)}` : undefined} onClick={() => nav('/assets')} />,
    openPo: <Kpi key="openPo" label={t('port.kpi.openPo')} value={open.length} hint={`/ ${snap.pos.length}`} onClick={() => nav('/procurement')} />,
    atRisk: <Kpi key="atRisk" label={t('port.kpi.poRisk')} value={k.poAtRisk} tone={k.poAtRisk > 3 ? 'warn' : 'good'} onClick={() => nav('/procurement')} />,
    exposed: <Kpi key="exposed" label={t('port.kpi.exposed')} value={exposed} tone="info" hint={t('port.kpi.exposedHint')} onClick={() => nav('/procurement')} />,
    manpower: <Kpi key="manpower" label={t('port.kpi.manpower')} value={k.manpower.toLocaleString('en')} tone="neutral" onClick={() => nav('/hse')} />,
    hseAlarms: <Kpi key="hseAlarms" label={t('port.kpi.hseAlarms')} value={hseAlarms} tone={hseAlarms > 0 ? 'warn' : 'good'} onClick={() => nav('/hse')} />,
    eac: <Kpi key="eac" label={t('port.kpi.eac')} value={fmtAed(snap.evm.eac, lang)} unit="AED" tone={snap.evm.vac < 0 ? 'warn' : 'good'} hint={`VAC ${fmtAed(snap.evm.vac, lang)}`} onClick={() => nav('/cost')} />,
    tcpi: <Kpi key="tcpi" label="TCPI" value={snap.evm.tcpi.toFixed(2)} tone={snap.evm.tcpi > 1.05 ? 'warn' : 'good'} />,
  };
  const sets: Record<Role, string[]> = {
    cxo: ['finish', 'spi', 'cpi', 'safety', 'risks', 'matRisk', 'fleet'],
    pm: ['finish', 'spi', 'risks', 'atRisk', 'fleet', 'manpower', 'safety'],
    procurement: ['openPo', 'atRisk', 'matRisk', 'exposed', 'finish', 'cpi', 'risks'],
    hse: ['safety', 'manpower', 'hseAlarms', 'risks', 'fleet', 'finish', 'spi'],
    asset: ['fleet', 'risks', 'finish', 'spi', 'atRisk', 'safety', 'manpower'],
    finance: ['cpi', 'eac', 'tcpi', 'matRisk', 'finish', 'spi', 'risks'],
  };
  return <div className="grid gap-3 grid-cols-2 lg:grid-cols-4 2xl:grid-cols-7">{sets[role].map((id) => all[id])}</div>;
}

function Briefing({ snap }: { snap: Snapshot }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Lang;
  const nav = useNavigate();
  const b = snap.briefing;
  const selectPo = useProc((s) => s.select);
  const [run, setRun] = useState(0);
  const [phase, setPhase] = useState<'steps' | 'typing' | 'done'>(briefingPlayed ? 'done' : 'steps');
  const [k, setK] = useState(briefingPlayed ? 99 : 0);
  const played = useRef(briefingPlayed);
  const go = (r?: { type: 'po' | 'asset' | 'activity'; id: string }) => {
    if (!r) return;
    if (r.type === 'po') {
      selectPo(r.id);
      nav('/procurement');
    } else if (r.type === 'asset') nav(`/assets?asset=${r.id}`);
    else nav(`/schedule?act=${r.id}`);
  };
  const regen = () => {
    setRun((r) => r + 1);
    setK(0);
    setPhase('steps');
  };
  const steps = [
    lang === 'ar' ? 'مسح 339 نشاطًا و32 أمر شراء و27 أصلًا' : 'Scanning 339 activities, 32 purchase orders, 27 assets',
    lang === 'ar' ? 'مقارنة الأداء بالخط المرجعي' : 'Comparing performance with the baseline',
    lang === 'ar' ? 'ترتيب المخاطر حسب الأثر' : 'Ranking risks by impact',
    lang === 'ar' ? 'صياغة إحاطة الصباح' : 'Writing the morning briefing',
  ];
  const finish = () => {
    briefingPlayed = true;
    played.current = true;
    setPhase('done');
  };
  const dot = (tone: string) => (tone === 'good' ? toneVar.good : tone === 'warn' ? toneVar.warn : tone === 'bad' ? toneVar.bad : toneVar.info);
  const quick: Array<[string, string, string]> = [
    ['risk', 'Biggest schedule risk', 'أكبر خطر على الجدول'],
    ['hormuz', 'Hormuz closure impact', 'أثر إغلاق هرمز'],
    ['equipment', 'Predictive maintenance', 'الصيانة التنبؤية'],
  ];
  return (
    <Card
      title={<span className="inline-flex items-center gap-1.5"><Sparkles size={14} style={{ color: toneVar.violet }} />{t('port.brief.title')}</span>}
      subtitle={fmtDate(snap.nowT, lang, 'long')}
      actions={
        <>
          <AiTag />
          <button type="button" onClick={regen} disabled={phase === 'steps'} className="text-dim hover:text-ink disabled:opacity-40 p-1" aria-label={t('rep.ai.regenerate')} title={t('rep.ai.regenerate')} data-testid="briefing-regen">
            <RotateCw size={13} />
          </button>
        </>
      }
      id="briefing"
    >
      {phase === 'steps' && (
        <div className="space-y-2 py-1" data-testid="briefing-steps">
          <AiBar />
          <AiSteps steps={steps} runKey={run} stepMs={420} onDone={() => setPhase('typing')} />
        </div>
      )}
      {phase !== 'steps' && (
        <>
          <div className="text-[15px] font-semibold leading-snug mb-2.5 min-h-[1.4em]">
            {phase === 'done' ? tx(b.headline, lang) : <Typed text={tx(b.headline, lang)} cps={90} onDone={() => setK((x) => Math.max(x, 1))} />}
          </div>
          <ul className="m-0 ps-0 list-none space-y-2">
            {b.bullets.map((x, i) => {
              const shown = phase === 'done' || k > i;
              const active = phase === 'typing' && k === i + 1;
              if (!shown && !active) return null;
              return (
                <li key={i} className={`flex gap-2 text-[12.5px] leading-snug ${x.ref ? 'cursor-pointer hover:text-ink' : ''}`} onClick={() => go(x.ref)}>
                  <span className="mt-[5px] size-2 rounded-full shrink-0" style={{ background: dot(x.tone) }} />
                  <span className="text-muted">
                    {active ? (
                      <Typed
                        text={tx(x.text, lang)}
                        cps={170}
                        onDone={() => {
                          setK((v) => v + 1);
                          if (i === b.bullets.length - 1) finish();
                        }}
                      />
                    ) : (
                      tx(x.text, lang)
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
          {phase === 'done' && (
            <div className="mt-3 pt-2.5 border-t border-line flex flex-wrap items-center gap-1.5 ai-pop">
              <span className="text-[11px] text-dim me-0.5">{lang === 'ar' ? 'اسأل:' : 'Ask:'}</span>
              {quick.map(([id, en, ar]) => (
                <button key={id} type="button" onClick={() => openCopilot(id)} className="rounded-full border px-2.5 py-0.5 text-[11.5px] hover:brightness-125 transition" style={{ color: 'var(--violet)', borderColor: 'color-mix(in srgb, var(--violet) 45%, transparent)' }}>
                  {lang === 'ar' ? ar : en}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </Card>
  );
}

function AlarmFeed({ snap }: { snap: Snapshot }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Lang;
  const go = useGo();
  const list = [...snap.alarms].sort((a, b) => (a.severity === b.severity ? b.t - a.t : a.severity === 'crit' ? -1 : b.severity === 'crit' ? 1 : a.severity === 'warn' ? -1 : 1)).slice(0, 7);
  return (
    <Card title={t('port.alarms.title')} subtitle={t('port.alarms.sub')} sim className="min-h-0" bodyClass="overflow-auto space-y-1.5">
      {list.length === 0 && <div className="text-[12.5px] text-muted">{t('port.alarms.none')}</div>}
      {list.map((a) => (
        <button key={a.id} type="button" onClick={() => openAlert(a.id)} data-testid="alarm-item" className="w-full text-start rounded-lg border border-line px-2.5 py-1.5 hover:bg-surface-2 transition-colors flex gap-2 items-start">
          <span className="mt-0.5" style={{ color: toneVar[SEV[a.severity]] }}>{SRC_ICON[a.source]}</span>
          <span className="min-w-0 flex-1">
            <span className="block text-[12.5px] leading-snug">{tx(a.text, lang)}</span>
            <span className="block text-[11px] text-dim">{a.ref} - {fmtDate(a.t, lang, 'short')}</span>
          </span>
          <Dot tone={SEV[a.severity]} pulse={a.severity === 'crit'} />
        </button>
      ))}
    </Card>
  );
}

function RoleWidget({ role, snap }: { role: Role; snap: Snapshot }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Lang;
  const pack = usePack();
  const nav = useNavigate();
  if (role === 'pm') {
    const rows = snap.criticalPath
      .map((id) => pack.activities[snap.forecast.idx.get(id)!])
      .filter((a) => a && a.kind === 'task' && snap.forecast.ef[snap.forecast.idx.get(a.id)!] > snap.nowT)
      .slice(0, 6);
    return (
      <Card title={t('port.role.pm')} sim bodyClass="!px-0 overflow-auto">
        <table className="w-full border-collapse">
          <thead><tr><Th>{t('port.role.activity')}</Th><Th align="end">{t('port.role.finish')}</Th></tr></thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.id} className="cursor-pointer hover:bg-surface-2" onClick={() => nav(`/schedule?act=${a.id}`)}>
                <Td>{tx(a.name, lang)}<div className="text-[10.5px] text-dim num">{a.id}</div></Td>
                <Td align="end" className="whitespace-nowrap tabular-nums">{fmtDate(snap.forecast.ef[snap.forecast.idx.get(a.id)!], lang, 'short')}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    );
  }
  if (role === 'procurement') {
    const rows = snap.pos.filter((p) => p.stage < 6).sort((a, b) => a.floatDays - b.floatDays).slice(0, 6);
    return (
      <Card title={t('port.role.procurement')} sim bodyClass="!px-0 overflow-auto">
        <table className="w-full border-collapse">
          <thead><tr><Th>PO</Th><Th>{t('port.role.material')}</Th><Th align="end">{t('port.role.float')}</Th></tr></thead>
          <tbody>
            {rows.map((p) => {
              const m = pack.materials.find((x) => x.id === p.materialId);
              return (
                <tr key={p.id} className="cursor-pointer hover:bg-surface-2" onClick={() => nav('/procurement')}>
                  <Td className="tabular-nums font-medium">{p.id}</Td>
                  <Td className="max-w-[220px] truncate">{tx(m?.name, lang)}</Td>
                  <Td align="end" className="tabular-nums" ><span style={{ color: p.floatDays < 14 ? toneVar.warn : undefined }}>{fmtDays(p.floatDays, lang, true)}</span></Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    );
  }
  if (role === 'asset') {
    const rows = [...snap.assets].sort((a, b) => a.report.health - b.report.health).slice(0, 6);
    return (
      <Card title={t('port.role.asset')} sim bodyClass="!px-0 overflow-auto">
        <table className="w-full border-collapse">
          <thead><tr><Th>{t('port.role.asset')}</Th><Th align="end">{t('port.role.health')}</Th><Th align="end">p14</Th></tr></thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.id} className="cursor-pointer hover:bg-surface-2" onClick={() => nav(`/assets?asset=${a.id}`)}>
                <Td className="tabular-nums font-medium">{a.id}</Td>
                <Td align="end" className="tabular-nums"><span style={{ color: a.report.health < 50 ? toneVar.bad : a.report.health < 70 ? toneVar.warn : toneVar.good }}>{Math.round(a.report.health)}</span></Td>
                <Td align="end" className="tabular-nums">{fmtPct(a.report.p14, lang)}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    );
  }
  if (role === 'finance') {
    const e = snap.evm;
    return (
      <Card title={t('port.role.finance')} sim>
        <div className="grid grid-cols-2 gap-3">
          <Kpi label={t('port.kpi.bac')} value={fmtAed(e.bac, lang)} unit="AED" />
          <Kpi label="EV" value={fmtAed(e.ev, lang)} unit="AED" />
          <Kpi label="AC" value={fmtAed(e.ac, lang)} unit="AED" />
          <Kpi label="VAC" value={fmtAed(e.vac, lang)} unit="AED" tone={e.vac < 0 ? 'bad' : 'good'} />
        </div>
      </Card>
    );
  }
  if (role === 'hse') {
    return (
      <Card title={t('port.role.hse')} sim>
        <div className="text-[12.5px] text-muted mb-2">{t('port.role.hseBody')}</div>
        <button type="button" onClick={() => nav('/hse')} className="rounded-lg border border-line px-3 py-2 text-[13px] hover:bg-surface-2 w-full text-start">{t('port.role.hseGo')}</button>
      </Card>
    );
  }
  // cxo: portfolio table
  return <SiteTable snap={snap} />;
}

function SiteTable({ snap }: { snap: Snapshot }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Lang;
  const rows = useSites(snap);
  return (
    <Card title={t('port.sites.title')} sim bodyClass="!px-0 overflow-auto">
      <table className="w-full border-collapse" data-testid="site-table">
        <thead>
          <tr><Th>{t('port.sites.site')}</Th><Th>{t('port.sites.progress')}</Th><Th align="end">SPI</Th><Th align="end">CPI</Th><Th align="end">LTIFR</Th><Th align="end">{t('port.alarms.title')}</Th></tr>
        </thead>
        <tbody>
          {rows.map((s) => (
            <tr key={s.id}>
              <Td><span className="inline-flex items-center gap-1.5"><Dot tone={s.health} />{tx(s.name, lang)}</span></Td>
              <Td className="min-w-[110px]"><div className="num text-[12px]">{fmtPct(s.progress, lang)}</div><div className="h-1.5 rounded-full bg-surface-3 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${s.progress * 100}%`, background: toneVar[s.health] }} /></div></Td>
              <Td align="end" className="tabular-nums">{s.spi.toFixed(2)}</Td>
              <Td align="end" className="tabular-nums">{s.cpi.toFixed(2)}</Td>
              <Td align="end" className="tabular-nums">{s.ltifr.toFixed(2)}</Td>
              <Td align="end" className="tabular-nums">{s.alarms}</Td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function useSites(snap: Snapshot): Array<SiteSummary & { health: Tone }> {
  const pack = usePack();
  return useMemo(
    () =>
      SITES.map((s) =>
        s.main
          ? { ...s, name: pack.config.name, progress: snap.evm.percentComplete, spi: snap.kpis.spi, cpi: snap.kpis.cpi, ltifr: snap.kpis.ltifr, alarms: snap.alarms.length, health: (snap.dFinishVsBaseline > 14 || snap.kpis.cpi < 0.93 ? 'bad' : snap.dFinishVsBaseline > 1 || snap.kpis.cpi < 0.97 ? 'warn' : 'good') as Tone }
          : { ...s, health: (s.spi < 0.95 ? 'warn' : 'good') as Tone },
      ),
    [pack, snap],
  );
}

export default function PortfolioPage() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Lang;
  const role = useApp((s) => s.role);
  const nav = useNavigate();
  const pack = usePack();
  const snap = useSnapshot();
  const sites = useSites(snap);
  const markers: MapMarker[] = sites.map((s) => ({ id: s.id, lon: s.lon, lat: s.lat, label: tx(s.name, lang), tone: s.health, size: s.main ? 16 : 12, pulse: s.main, title: `${tx(s.name, lang)} - ${fmtPct(s.progress, lang)}`, onClick: s.main ? () => nav('/twin') : undefined }));
  return (
    <div className="h-full overflow-auto" data-testid="portfolio-page">
      <div className="flex items-center justify-end px-5 pt-3">
        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent('mz:copilot', { detail: { auto: true } }))}
          className="inline-flex items-center gap-1.5 h-9 rounded-lg px-3.5 text-[13px] font-semibold shadow-sm hover:brightness-110 transition"
          style={{ background: 'var(--violet)', color: 'var(--violet-ink)' }}
          data-testid="watch-ai"
        >
          <Play size={14} /> {t('port.aiPlay')}
        </button>
      </div>
      <div className="px-5 pt-2 pb-3 space-y-3">
        <KpiStrip role={role} snap={snap} />
        <div className="grid gap-3 xl:grid-cols-[minmax(0,1.55fr)_minmax(360px,1fr)]">
          <div className="space-y-3 min-w-0">
            <Card title={t('port.map.title')} subtitle={t('port.map.sub')} sim className="h-[320px]" bodyClass="relative !p-0 overflow-hidden rounded-b-xl">
              <MapView className="absolute inset-0" bounds={[[54.9, 24.45], [57.1, 26.05]]} markers={markers} />
            </Card>
            <RoleWidget role={role} snap={snap} />
            <DroneCompare />
          </div>
          <div className="space-y-3 min-w-0">
            <Briefing snap={snap} />
            <AlarmFeed snap={snap} />
          </div>
        </div>
      </div>
    </div>
  );
}
