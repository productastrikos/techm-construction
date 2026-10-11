import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import { useApp } from '../../app/store';
import { Bar, Btn, Card, Chip, type Tone } from '../../design/ui';
import { Chart, useChartPalette } from '../../design/Chart';
import { fmtDate, fmtDays, fmtPct, type Lang } from '../../lib/fmt';
import { tx } from '../../lib/bi';
import type { Sample } from '../../engine/assets';
import { getDs, usePack, useSnapshot } from '../../sim/useSim';
import { useWorkOrders } from './woStore';
import { AiDiagnosis } from './AiDiagnosis';

/** asset detail: telemetry sparklines (30 d, simulated) with thresholds + anomaly flags, prediction, actions */
export function AssetDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Lang;
  const pack = usePack();
  const snap = useSnapshot();
  const nav = useNavigate();
  const pal = useChartPalette();
  const simT = useApp((s) => s.simT);
  const wo = useWorkOrders();
  const asset = pack.assets.find((a) => a.id === id);
  const row = snap.assets.find((a) => a.id === id);
  const [data, setData] = useState<Record<string, Sample[]>>({});

  useEffect(() => {
    if (!asset) return;
    let live = true;
    (async () => {
      const out: Record<string, Sample[]> = {};
      for (const ch of asset.channels) out[ch.id] = await getDs().telemetry(id, ch.id, simT - 30, simT, 0.25, simT);
      if (live) setData(out);
    })();
    return () => {
      live = false;
    };
  }, [id, simT, asset]);

  const charts = useMemo(() => {
    if (!asset) return [];
    return asset.channels.map((ch) => {
      const s = data[ch.id] ?? [];
      const last = s[s.length - 1]?.v ?? ch.base;
      const level = last >= ch.alarm ? 'alarm' : last >= ch.warn ? 'warn' : 'ok';
      const col = level === 'alarm' ? pal.bad : level === 'warn' ? pal.warn : pal.accent;
      return {
        ch,
        last,
        level,
        option: {
          grid: { left: 2, right: 2, top: 4, bottom: 2 },
          xAxis: { type: 'value', show: false, min: simT - 30, max: simT },
          yAxis: { type: 'value', show: false, min: (v: { min: number }) => Math.min(v.min, ch.base * 0.9), max: (v: { max: number }) => Math.max(v.max, ch.warn) },
          series: [
            {
              type: 'line',
              data: s.map((p) => [p.t, Math.round(p.v * 100) / 100]),
              symbol: 'none',
              lineStyle: { color: col, width: 1.5 },
              areaStyle: { color: col, opacity: 0.1 },
              markLine: { symbol: 'none', silent: true, label: { show: false }, data: [{ yAxis: ch.warn, lineStyle: { color: pal.warn, type: 'dashed', width: 1 } }, { yAxis: ch.alarm, lineStyle: { color: pal.bad, type: 'dashed', width: 1 } }] },
            },
          ],
        },
      };
    });
  }, [data, asset, pal, simT]);

  if (!asset || !row) return null;
  const r = row.report;
  const tone: Tone = r.status === 'good' ? 'good' : r.status === 'watch' ? 'warn' : 'bad';
  const createWo = () => {
    const start = Math.ceil(simT) + 2;
    wo.create({ assetId: id, title: { en: `Inspection - ${asset.name.en}`, ar: `فحص - ${asset.name.ar}` }, kind: 'INSP', status: 'open', priority: r.health < 62 ? 'high' : 'med', createdT: simT, fromT: start + 0.25, toT: start + 1, source: 'manual' });
    nav('/assets?tab=wo');
  };

  return (
    <Card title={`${asset.id} - ${tx(asset.name, lang)}`} subtitle={`${asset.model} - ${tx(asset.location, lang)}`} sim="rule" actions={<Btn size="sm" variant="ghost" onClick={onClose} aria-label={t('common.close')}><X size={14} /></Btn>}>
      <div data-testid="asset-detail" className="grid grid-cols-[210px_1fr] gap-4 max-[1250px]:grid-cols-1">
        <div className="flex flex-col gap-2">
          <div className="flex items-baseline gap-2">
            <span className="text-[34px] font-semibold num" style={{ color: `var(--${tone === 'good' ? 'good' : tone === 'warn' ? 'warn' : 'bad'})` }}>{Math.round(r.health)}</span>
            <Chip tone={tone}>{t(`asset.status.${r.status}`)}</Chip>
          </div>
          <Bar value={r.health / 100} tone={tone} />
          <div className="text-[12px] flex flex-col gap-0.5">
            <Line k={t('asset.rul')} v={r.rulDays === null ? t('twin.asset.none') : fmtDays(r.rulDays, lang)} />
            <Line k={t('twin.asset.p14')} v={fmtPct(r.p14, lang)} />
            <Line k={t('asset.avail')} v={fmtPct(row.availability, lang, 1)} />
            <Line k="MTBF / MTTR" v={`${row.mtbfHrs} h / ${row.mttrHrs} h`} />
            <Line k="PM" v={r.pmDue ? t('asset.pmDue') : 'OK'} />
            <Line k={t('asset.linked')} v={`${asset.linkedActivityIds.length}`} />
          </div>
          {r.explanation.length > 0 && (
            <div className="mt-1">
              <div className="text-[10.5px] uppercase tracking-wider text-dim mb-0.5">{t('wi.eq.why')}</div>
              {r.explanation.map((e) => (
                <div key={e.channelId} className="text-[11.5px] flex justify-between"><span className="truncate me-2">{tx(asset.channels.find((c) => c.id === e.channelId)!.name, lang)}</span><span className="num text-dim">{fmtPct(e.share, lang)}</span></div>
              ))}
            </div>
          )}
          <div className="flex flex-col gap-1.5 mt-2">
            <Btn size="sm" variant="primary" onClick={() => nav(`/whatif/equipment?asset=${id}`)}>{t('asset.analyse')}</Btn>
            <Btn size="sm" onClick={createWo}>{t('asset.createWo')}</Btn>
          </div>
        </div>
        <div>
          <div className="text-[10.5px] uppercase tracking-wider text-dim mb-1">{t('asset.telemetry')} - 30 d</div>
          <div className="grid grid-cols-4 gap-2 max-[1450px]:grid-cols-3 max-[1250px]:grid-cols-2">
            {charts.map((c) => (
              <div key={c.ch.id} className={`rounded-lg border p-1.5 ${c.level === 'alarm' ? 'border-bad' : c.level === 'warn' ? 'border-warn' : 'border-line'}`} data-testid={`ch-${c.ch.id}`}>
                <div className="flex items-baseline justify-between gap-1">
                  <span className="text-[10.5px] text-muted truncate" dir="auto">{tx(c.ch.name, lang)}</span>
                  {c.level !== 'ok' && <Chip tone={c.level === 'alarm' ? 'bad' : 'warn'} className="!text-[9px]">{c.level === 'alarm' ? t('asset.crit') : t('asset.warn')}</Chip>}
                </div>
                <div className="text-[15px] font-semibold num">{c.last.toFixed(1)} <span className="text-[10px] text-dim font-normal">{c.ch.unit}</span></div>
                <Chart option={c.option} height={44} />
              </div>
            ))}
          </div>
          <div className="text-[11px] text-dim mt-1.5">{t('asset.certExpiry')}: {asset.certExpiryT !== undefined ? fmtDate(asset.certExpiryT, lang) : '-'}</div>
        </div>
      </div>
      <AiDiagnosis asset={asset} row={row} simT={simT} />
    </Card>
  );
}

function Line({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-dim">{k}</span>
      <span className="num text-end">{v}</span>
    </div>
  );
}
