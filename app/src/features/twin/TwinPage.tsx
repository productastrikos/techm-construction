import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Layers, PanelRightClose, PanelRightOpen } from 'lucide-react';
import { useApp, type ColorMode, type Quality } from '../../app/store';
import { useOverlay } from '../../app/overlay';
import { Btn, Chip, PageHeader, Seg, Select, Toggle } from '../../design/ui';
import { getBaseCals, usePack, useSnapshot } from '../../sim/useSim';
import { buildSceneModel } from '../../three/sceneModel';
import type { MatRisk } from '../../three/PortScene';
import { fmtDate, type Lang } from '../../lib/fmt';
import { useTwin } from './twinStore';
import { TwinPanel } from './TwinPanel';
import { Timeline } from './Timeline';
import { Legend } from './Legend';
import { PlanView2D } from './PlanView2D';
import { TwinAiScan } from './AiScan';
import { IncidentCard, useIncident } from './IncidentCard';

const PortScene = lazy(() => import('../../three/PortScene').then((m) => ({ default: m.PortScene })));

function webglOk(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

export default function TwinPage() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Lang;
  const pack = usePack();
  const snap = useSnapshot();
  const simT = useApp((s) => s.simT);
  const mode = useApp((s) => s.colorMode);
  const setMode = useApp((s) => s.setColorMode);
  const quality = useApp((s) => s.quality);
  const setQuality = useApp((s) => s.setQuality);
  const selection = useApp((s) => s.selection);
  const select = useApp((s) => s.select);
  const tw = useTwin();
  const ov = useOverlay();
  const [fallback, setFallback] = useState(false);
  const [stats, setStats] = useState<{ calls: number; triangles: number } | null>(null);
  const ok = useMemo(webglOk, []);
  const showPerf = typeof location !== 'undefined' && location.hash.includes('perf');

  const incident = useIncident();
  const anchorRef = useRef<HTMLDivElement>(null);
  const viewT = tw.viewT ?? simT;
  const showIncident = !!incident && tw.incidentOpen && Math.abs(viewT - simT) < 30;
  const incidentProp = useMemo(() => {
    if (!incident || !showIncident) return null;
    const [x, y, z] = incident.pos;
    return {
      pos: incident.pos,
      cam: { pos: [x - 70, y + 52, z - 120] as [number, number, number], target: [x - 26, y + 6, z + 8] as [number, number, number] },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incident, showIncident]);
  const bucket = Math.floor(viewT * 2) / 2;
  const cals = useMemo(() => getBaseCals(pack), [pack]);
  const model = useMemo(() => buildSceneModel(pack, snap.forecast, snap.baseline, cals, bucket), [pack, snap, cals, bucket]);

  // delivery -> PO risk, element -> worst risk of its supply items
  const matRisk = useMemo(() => {
    const byDel = new Map(snap.pos.map((p) => [p.deliveryActivityId, p]));
    const out = new Map<string, MatRisk>();
    const rank: Record<MatRisk, number> = { none: 0, ok: 1, watch: 2, risk: 3, late: 4 };
    for (const el of pack.elements) {
      let worst: MatRisk = 'none';
      for (const aid of el.activityIds) {
        const a = pack.activities.find((x) => x.id === aid)!;
        for (const pr of a.preds) {
          const po = byDel.get(pr.id);
          if (!po) continue;
          const r: MatRisk = po.stage === 6 ? 'ok' : po.risk;
          if (rank[r] > rank[worst]) worst = r;
        }
      }
      out.set(el.id, worst);
    }
    return out;
  }, [pack, snap]);
  const assetHealth = useMemo(() => new Map(snap.assets.map((a) => [a.id, { health: a.report.health, status: a.report.status }])), [snap]);

  // first visit: open on the live incident at the data date (the demo moment); the timeline shortcuts jump to later showpiece dates
  useEffect(() => {
    const st = useTwin.getState();
    if (st.initialised) return;
    st.patch({ initialised: true, viewT: null, preset: { name: incident ? 'incident' : 'overview', nonce: st.preset.nonce + 1 } });
  }, [incident]);

  // 4D playback
  useEffect(() => {
    if (!tw.playing4d) return;
    const end = snap.forecastFinish + 20;
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.2, (now - last) / 1000);
      last = now;
      const cur = useTwin.getState().viewT ?? useApp.getState().simT;
      const next = cur + dt * 45;
      if (next >= end) {
        useTwin.getState().patch({ playing4d: false, viewT: end });
        return;
      }
      useTwin.getState().setViewT(next);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [tw.playing4d, snap.forecastFinish]);

  const modes: Array<{ value: ColorMode; label: string }> = [
    { value: 'realistic', label: t('twin.mode.realistic') },
    { value: 'progress', label: t('twin.mode.progress') },
    { value: 'material', label: t('twin.mode.material') },
    { value: 'health', label: t('twin.mode.health') },
    { value: 'hse', label: t('twin.mode.hse') },
  ];
  const use3d = ok && !fallback;

  return (
    <div className="h-full flex flex-col min-h-0" data-testid="twin-page">
      <PageHeader
        title={t('nav.twin')}
        subtitle={t('twin.subtitle')}
        sim
        actions={
          <div className="flex items-center gap-2">
            <Seg size="sm" ariaLabel={t('twin.mode')} value={mode} onChange={setMode} options={modes} />
            <Select<Quality> ariaLabel={t('twin.quality')} value={quality} onChange={setQuality} className="!h-7 text-[12px]" options={[{ value: 'high', label: t('quality.high') }, { value: 'balanced', label: t('quality.balanced') }, { value: 'low', label: t('quality.low') }]} />
            <Btn variant="ghost" size="sm" className="!px-2" onClick={() => tw.patch({ panel: !tw.panel })} aria-label={t('twin.panel')} title={t('twin.panel')}>
              {tw.panel ? <PanelRightClose size={16} className="flip-rtl" /> : <PanelRightOpen size={16} className="flip-rtl" />}
            </Btn>
          </div>
        }
      />
      <div className="flex-1 min-h-0 flex gap-3 px-5 pb-2">
        <div className="relative flex-1 min-w-0 rounded-xl overflow-hidden border border-line bg-[#a9c4cf]">
          {use3d ? (
            <Suspense fallback={<div className="p-6 text-dim">{t('common.loading')}</div>}>
              <PortScene
                model={model}
                colorMode={mode}
                selection={selection}
                onSelect={select}
                quality={quality}
                outline={tw.outline}
                zones={tw.zones}
                fleet={tw.fleet}
                labels={tw.labels}
                matRisk={matRisk}
                assetHealth={assetHealth}
                overlay={ov.elements}
                preset={tw.preset}
                incident={incidentProp}
                anchorRef={anchorRef}
                onContextLost={() => setFallback(true)}
                onStats={showPerf ? setStats : undefined}
              />
            </Suspense>
          ) : (
            <PlanView2D model={model} colorMode={mode} selection={selection} onSelect={select} matRisk={matRisk} overlay={ov.elements} />
          )}
          {incident && showIncident && (
            <div className="absolute inset-0 overflow-hidden pointer-events-none z-10">
              <div ref={anchorRef} className="absolute left-0 top-0 will-change-transform" style={{ visibility: 'hidden' }}>
                <IncidentCard incident={incident} onClose={() => tw.patch({ incidentOpen: false })} />
              </div>
            </div>
          )}
          {tw.aiScanning && <div className="ai-scanline z-10" style={{ animationDuration: '1.4s', animationIterationCount: 2 }} aria-hidden />}
          {/* overlays */}
          <div className="absolute top-2.5 start-2.5 flex flex-col items-start gap-1.5 pointer-events-none">
            <div className="rounded-lg border border-line-2 bg-surface/85 backdrop-blur px-2.5 py-1.5 pointer-events-auto">
              <div className="text-[10px] uppercase tracking-wider text-dim">{t('twin.viewDate')}</div>
              <div className="text-[15px] font-semibold num" data-testid="view-date">{fmtDate(viewT, lang, 'long')}</div>
            </div>
            {viewT > simT + 2 && <Chip tone="info" className="pointer-events-auto">{t('twin.projected')}</Chip>}
            {!use3d && <Chip tone="warn">{t('twin.fallback')}</Chip>}
            <TwinAiScan matRisk={matRisk} onSelect={select} />
            {incident && !tw.incidentOpen && (
              <button type="button" className="pointer-events-auto inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-[12px] font-semibold border" style={{ color: 'var(--bad)', borderColor: 'color-mix(in srgb, var(--bad) 55%, var(--line))', background: 'color-mix(in srgb, var(--bad) 10%, var(--surface))' }} onClick={() => tw.patch({ incidentOpen: true, preset: { name: 'incident', nonce: tw.preset.nonce + 1 } })}>
                <AlertTriangle size={13} /> {t('twin.incident.chip')}
              </button>
            )}
            {ov.label && (
              <div className="rounded-lg border border-warn/60 bg-surface/90 px-2.5 py-1.5 pointer-events-auto flex items-center gap-2 max-w-[320px]">
                <Layers size={14} className="text-warn shrink-0" />
                <div className="text-[12px] leading-tight">
                  <div className="text-warn font-semibold">{t('twin.scenario')}</div>
                  <div className="text-muted truncate">{ov.label}</div>
                </div>
                <Btn size="sm" variant="ghost" onClick={ov.clear}>{t('twin.scenario.clear')}</Btn>
              </div>
            )}
          </div>
          <div className="absolute top-2.5 end-2.5 flex flex-col gap-1.5 items-end">
            <div className="rounded-lg border border-line-2 bg-surface/85 backdrop-blur px-2.5 py-1.5 flex flex-col gap-1">
              <Toggle on={tw.outline} onChange={(v) => tw.patch({ outline: v })} label={t('twin.outline')} />
              <Toggle on={tw.fleet} onChange={(v) => tw.patch({ fleet: v })} label={t('twin.fleet')} />
              <Toggle on={tw.zones} onChange={(v) => tw.patch({ zones: v })} label={t('twin.zones')} />
            </div>
          </div>
          <div className="absolute bottom-2 end-2.5 flex gap-1">
            {[...(incident ? ['incident'] : []), 'overview', 'quay', 'castingYard', 'yard', 'offshore'].map((n) => (
              <Btn key={n} size="sm" variant="soft" className="!bg-surface/85 backdrop-blur" data-testid={`cam-${n}`} onClick={() => tw.patch({ preset: { name: n, nonce: tw.preset.nonce + 1 } })}>
                {t(`twin.cam${pack.config.sceneKind === 'highway' ? 'H' : ''}.${n}`)}
              </Btn>
            ))}
          </div>
          <Legend mode={mode} />
          {stats && (
            <div className="absolute bottom-2 start-1/2 -translate-x-1/2 mono text-[11px] bg-black/60 text-white px-2 py-0.5 rounded" data-testid="perf">
              draw calls {stats.calls} / tris {Math.round(stats.triangles / 1000)}k
            </div>
          )}
        </div>
        {tw.panel && (
          <aside className="w-[330px] shrink-0 min-h-0 overflow-auto">
            <TwinPanel model={model} selection={selection} onClose={() => select(null)} />
          </aside>
        )}
      </div>
      <Timeline />
    </div>
  );
}
