import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, Chip, Select, Td, Th, toneVar } from '../../design/ui';
import { Chart, useChartPalette } from '../../design/Chart';
import { MapView, type MapLine, type MapMarker } from '../../design/MapView';
import { fmtAed, fmtDate, fmtDays, type Lang } from '../../lib/fmt';
import { tx } from '../../lib/bi';
import { routeOptions } from '../../engine/routes';
import type { PortId, ProjectPack } from '../../engine/types';
import type { Snapshot } from '../../sim/types';
import { useProc, type ProcRow } from './model';

type LL = [number, number];
const ENTRY: LL = [60.9, 22.9];
const CHOKEPOINT: LL = [56.62, 26.52];
/** schematic sea lanes (illustrative, not navigational) */
const LANES: Record<string, LL[]> = {
  'R-PTA': [ENTRY, [59.0, 24.7], [57.7, 25.8], [56.95, 26.45], CHOKEPOINT, [55.9, 26.7], [55.0, 26.3], [54.7, 25.6], [55.06, 25.01]],
  'R-PTE': [ENTRY, [59.0, 24.7], [57.7, 25.8], [56.95, 26.45], CHOKEPOINT, [55.0, 26.8], [53.6, 27.2], [52.0, 26.9]],
  'R-PTB': [ENTRY, [59.0, 24.6], [57.6, 25.2], [56.36, 25.34]],
  'R-PTC': [ENTRY, [59.0, 24.3], [57.5, 24.95], [56.36, 25.17]],
  'R-PTD': [ENTRY, [59.0, 24.0], [57.6, 24.5], [56.62, 24.5]],
  'R-AIR': [[61.2, 22.0], [58.4, 23.9], [56.36, 25.17]],
};

function along(path: LL[], f: number): LL {
  const seg = path.slice(1).map((p, i) => Math.hypot(p[0] - path[i][0], p[1] - path[i][1]));
  const total = seg.reduce((a, b) => a + b, 0) || 1;
  let d = Math.min(1, Math.max(0, f)) * total;
  for (let i = 0; i < seg.length; i++) {
    if (d <= seg[i]) {
      const k = seg[i] ? d / seg[i] : 0;
      return [path[i][0] + (path[i + 1][0] - path[i][0]) * k, path[i][1] + (path[i + 1][1] - path[i][1]) * k];
    }
    d -= seg[i];
  }
  return path[path.length - 1];
}

export function RoutePlanner({ rows, pack, snap }: { rows: ProcRow[]; pack: ProjectPack; snap: Snapshot }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Lang;
  const pal = useChartPalette();
  const hz = useProc((s) => s.hz);
  const selected = useProc((s) => s.selected);
  const select = useProc((s) => s.select);
  const site: LL = [pack.config.location.lon, pack.config.location.lat];
  const portLL = (id: PortId): LL => {
    const p = pack.ports.find((x) => x.id === id)!;
    return [p.lon, p.lat];
  };

  const selRoute = useProc((st) => rows.find((r) => r.po.id === st.selected)?.po.routeId);
  const hzTone = hz === 'open' ? 'good' : hz === 'restricted' ? 'warn' : 'bad';
  const lines: MapLine[] = useMemo(() => {
    const out: MapLine[] = [];
    for (const [id, pts] of Object.entries(LANES)) {
      const r = pack.routes.find((x) => x.id === id);
      if (!r) continue;
      const exposed = r.chokepointDependent;
      const cur = id === selRoute;
      out.push({
        id,
        coords: pts,
        color: exposed ? (hz === 'closed' ? pal.bad : hz === 'restricted' ? pal.warn : pal.info) : pal.good,
        width: cur ? 4 : 1.6,
        dashed: r.mode === 'air',
        opacity: cur ? 1 : exposed && hz === 'closed' ? 0.4 : 0.55,
      });
    }
    // bonded truck legs port -> site
    for (const p of pack.ports) {
      if (p.id === 'LOC' || p.id === 'PTE') continue;
      out.push({ id: `road-${p.id}`, coords: [[p.lon, p.lat], site], color: pal.warn, width: 1.6, dashed: true, opacity: 0.8 });
    }
    return out;
  }, [pack, hz, site, pal, selRoute]);

  const markers: MapMarker[] = useMemo(() => {
    const m: MapMarker[] = [];
    for (const p of pack.ports) {
      if (p.id === 'LOC' || p.id === 'PTC') continue;
      if (p.id === 'PTE') {
        m.push({ id: 'port-PTE', lon: 52.75, lat: 26.75, label: `${tx(p.name, lang)} ←`, tone: 'info', size: 9, title: tx(p.name, lang) });
        continue;
      }
      const label = p.id === 'PTB' ? `${tx(p.name, lang)} / ${tx(pack.ports.find((x) => x.id === 'PTC')?.name, lang)}` : tx(p.name, lang);
      m.push({ id: `port-${p.id}`, lon: p.lon, lat: p.id === 'PTB' ? p.lat + 0.25 : p.lat, label, tone: p.insideChokepoint ? 'info' : 'good', size: 11, title: label });
    }
    m.push({ id: 'site', lon: site[0] + 0.35, lat: site[1] - 0.05, label: t('proc.map.site'), tone: 'accent', size: 15, pulse: true });
    m.push({ id: 'chokepoint', lon: CHOKEPOINT[0], lat: CHOKEPOINT[1], label: `${t('proc.map.chokepoint')} - ${t(`proc.hz.${hz}`)}`, tone: hzTone, size: 14, pulse: hz !== 'open' });
    for (const r of rows) {
      const lane = LANES[r.po.routeId];
      if (!lane) continue;
      if (r.row.stage === 3) {
        const f = (snap.nowT - r.tl.etdT) / Math.max(1, r.tl.b4 - r.tl.etdT);
        const [lon, lat] = along(lane, f);
        m.push({ id: `v-${r.po.id}`, lon, lat, tone: r.risk === 'late' || r.risk === 'risk' ? 'warn' : 'violet', size: 10, title: `${r.po.id} - ${tx(r.mat.name, lang)}`, onClick: () => select(r.po.id), label: r.po.id === selected ? r.po.id : undefined });
      } else if (r.row.stage === 5) {
        const port = pack.ports.find((p) => p.id === pack.routes.find((x) => x.id === r.po.routeId)?.portId);
        if (port) {
          const f = (snap.nowT - r.tl.b5) / Math.max(0.3, r.tl.etaT - r.tl.b5);
          m.push({ id: `t-${r.po.id}`, lon: port.lon + (site[0] - port.lon) * Math.min(1, Math.max(0, f)), lat: port.lat + (site[1] - port.lat) * Math.min(1, Math.max(0, f)), tone: 'warn', size: 8, title: r.po.id, onClick: () => select(r.po.id) });
        }
      }
    }
    return m;
  }, [pack, rows, lang, t, hz, hzTone, snap.nowT, select, site, selected]);

  const exposedRows = rows.filter((r) => r.row.stage < 6 && r.mat.cls !== 'domestic-bulk');
  const sel = rows.find((r) => r.po.id === selected) ?? [...exposedRows].sort((a, b) => a.floatDays - b.floatDays).find((r) => r.row.chokepointExposed) ?? exposedRows[0];
  const opts = useMemo(() => (sel ? routeOptions(pack, sel.po, snap.nowT, hz === 'open' ? null : { state: hz, startT: snap.nowT, durationDays: 120 }) : []), [sel, pack, snap.nowT, hz]);
  const free = opts.filter((o) => !o.blocked);
  const fastest = free.length ? free.reduce((a, b) => (a.etaT <= b.etaT ? a : b)) : null;
  const cheapest = free.length ? free.reduce((a, b) => (a.costAED <= b.costAED ? a : b)) : null;

  const scatter = useMemo(
    () => ({
      grid: { left: 52, right: 14, top: 26, bottom: 36 },
      tooltip: { trigger: 'item', formatter: (p: { data: [number, number, string] }) => `${p.data[2]}<br/>${p.data[0].toFixed(0)} d / AED ${(p.data[1] / 1e6).toFixed(1)} M` },
      xAxis: { type: 'value', scale: true, name: lang === 'ar' ? 'أيام النقل' : 'Transit days', nameLocation: 'middle', nameGap: 22, axisLabel: { color: pal.muted }, nameTextStyle: { color: pal.muted }, splitLine: { lineStyle: { color: pal.grid } } },
      yAxis: { type: 'value', scale: true, name: 'AED M', axisLabel: { color: pal.muted, formatter: (v: number) => (v / 1e6).toFixed(1) }, nameTextStyle: { color: pal.muted }, splitLine: { lineStyle: { color: pal.grid } } },
      series: [
        {
          type: 'scatter',
          symbolSize: 16,
          data: opts.map((o) => ({ value: [o.transitDays, o.costAED, tx(o.route.name, lang)], itemStyle: { color: o.blocked ? pal.bad : o.route.id === sel?.po.routeId ? pal.accent : o.risk === 'low' ? pal.good : pal.warn, opacity: o.blocked ? 0.45 : 1 } })),
          label: { show: true, formatter: (p: { data: { value: [number, number, string] } }) => (p.data.value[2].match(/Port [A-Z]/)?.[0] ?? p.data.value[2].replace(/^(Sea|Air freight|Domestic) (to )?/, '').split(' ')[0]), color: pal.muted, position: 'top', fontSize: 10 },
        },
      ],
    }),
    [opts, pal, lang, sel],
  );

  return (
    <div className="grid gap-3 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] h-full min-h-0">
      <Card title={t('proc.map.title')} subtitle={t('proc.map.note')} sim className="min-h-[360px]" bodyClass="relative !p-0 overflow-hidden rounded-b-xl">
        <MapView className="absolute inset-0" bounds={[[53.2, 22.6], [61.4, 27.3]]} markers={markers} lines={lines} interactive />
        <div className="absolute start-3 bottom-3 rounded-lg border border-line bg-surface/90 px-2.5 py-1.5 text-[11px] text-muted space-y-0.5">
          <div className="flex items-center gap-1.5"><span className="inline-block h-[3px] w-5 rounded" style={{ background: toneVar.good }} />{t('proc.map.legend.sea')}</div>
          <div className="flex items-center gap-1.5"><span className="inline-block h-[3px] w-5 rounded" style={{ background: hz === 'closed' ? toneVar.bad : hz === 'restricted' ? toneVar.warn : toneVar.info }} />{t('proc.map.legend.exposed')}</div>
          <div className="flex items-center gap-1.5"><span className="inline-block size-2 rounded-full" style={{ background: toneVar.violet }} />{t('proc.map.legend.vessel')}</div>
          <div className="flex items-center gap-1.5"><span className="inline-block h-[3px] w-5 rounded" style={{ background: toneVar.warn }} />{t('proc.map.legend.truck')}</div>
        </div>
      </Card>
      <div className="flex flex-col gap-3 min-h-0 overflow-auto">
        <Card title={t('proc.planner.title')} sim className="shrink-0">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[12px] text-muted shrink-0">{t('proc.planner.po')}</span>
            <Select
              className="flex-1"
              value={sel?.po.id ?? ''}
              onChange={(v) => select(v)}
              ariaLabel={t('proc.planner.po')}
              options={exposedRows.map((r) => ({ value: r.po.id, label: `${r.po.id} - ${tx(r.mat.name, lang)}` }))}
            />
          </div>
          {sel && (
            <>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {fastest && <Chip tone="accent">{t('proc.planner.best')}: {tx(fastest.route.name, lang).split(' + ')[0]} ({fmtDate(fastest.etaT, lang, 'short')})</Chip>}
                {cheapest && <Chip tone="good">{t('proc.planner.cheapest')}: {tx(cheapest.route.name, lang).split(' + ')[0]}</Chip>}
              </div>
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <Th>{t('proc.opt.route')}</Th>
                    <Th align="end">{t('proc.opt.transit')}</Th>
                    <Th align="end">{t('proc.opt.eta')}</Th>
                    <Th align="end">{t('proc.opt.cost')}</Th>
                  </tr>
                </thead>
                <tbody>
                  {opts.map((o) => (
                    <tr key={o.route.id} className={o.blocked ? 'opacity-50' : undefined}>
                      <Td className="max-w-[190px]">
                        <div className="truncate">{tx(o.route.name, lang)}</div>
                        <div className="text-[10.5px]">{o.blocked ? <span style={{ color: toneVar.bad }}>{t('proc.opt.blocked')}</span> : <span style={{ color: o.risk === 'low' ? toneVar.good : o.risk === 'medium' ? toneVar.warn : toneVar.bad }}>{t('proc.opt.risk')}: {t(`proc.opt.risk.${o.risk}`)}</span>}</div>
                      </Td>
                      <Td align="end" className="tabular-nums">{fmtDays(o.transitDays, lang)}</Td>
                      <Td align="end" className="tabular-nums whitespace-nowrap">{fmtDate(o.etaT, lang, 'short')}<div className="text-[10.5px]" style={{ color: o.deltaDays > 0.5 ? toneVar.bad : o.deltaDays < -0.5 ? toneVar.good : 'var(--dim)' }}>{fmtDays(o.deltaDays, lang, true)}</div></Td>
                      <Td align="end" className="tabular-nums whitespace-nowrap">{fmtAed(o.costAED, lang)}<div className="text-[10.5px] text-dim">{o.deltaCostAED === 0 ? '' : `${o.deltaCostAED > 0 ? '+' : ''}${fmtAed(o.deltaCostAED, lang)}`}</div></Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </Card>
        <Card title={t('proc.planner.scatter')} sim className="shrink-0">
          <Chart option={scatter} height={210} />
        </Card>
      </div>
    </div>
  );
}
