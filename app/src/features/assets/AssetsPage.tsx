import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Bar, Btn, Card, Chip, Kpi, PageHeader, Tabs, Td, Th, type Tone } from '../../design/ui';
import { Chart, useChartPalette } from '../../design/Chart';
import { fmtDate, fmtNum, fmtPct, type Lang } from '../../lib/fmt';
import { tx } from '../../lib/bi';
import type { AssetType } from '../../engine/types';
import { usePack, useSnapshot } from '../../sim/useSim';
import { FLAG_HEALTH } from '../../engine/assets';
import { AssetDetail } from './AssetDetail';
import { WorkOrderBoard } from './WorkOrderBoard';
import { useWorkOrders } from './woStore';

type Tab = 'registry' | 'wo' | 'certs' | 'parts';

const TYPE_GROUPS: Array<{ id: string; types: AssetType[] }> = [
  { id: 'cranes', types: ['crawler-crane', 'mobile-harbour-crane', 'tower-crane'] },
  { id: 'earth', types: ['excavator'] },
  { id: 'trucks', types: ['dump-truck', 'concrete-mixer'] },
  { id: 'marine', types: ['dredger', 'tug', 'barge'] },
  { id: 'piling', types: ['piling-rig'] },
  { id: 'plant', types: ['batching-plant', 'generator'] },
];

const toneOf = (s: string): Tone => (s === 'good' ? 'good' : s === 'watch' ? 'warn' : 'bad');

export default function AssetsPage() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Lang;
  const pack = usePack();
  const snap = useSnapshot();
  const nav = useNavigate();
  const pal = useChartPalette();
  const [sp, setSp] = useSearchParams();
  const [tab, setTab] = useState<Tab>((sp.get('tab') as Tab) || 'registry');
  const selected = sp.get('asset');
  const wo = useWorkOrders((s) => s.list);
  useEffect(() => {
    const tb = sp.get('tab');
    if (tb && tb !== tab) setTab(tb as Tab);
    else if (!tb && sp.get('asset') && tab !== 'registry') setTab('registry');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sp]);

  const rows = useMemo(() => [...snap.assets].sort((a, b) => a.report.health - b.report.health), [snap]);
  const avgHealth = rows.reduce((s, r) => s + r.report.health, 0) / rows.length;
  const flagged = rows.filter((r) => r.report.health < FLAG_HEALTH).length;
  const pmComp = pack.assets.reduce((s, a) => s + (a.hours - a.pm.lastDoneHrs <= a.pm.intervalHrs ? 1 : 0), 0) / pack.assets.length;
  const openWo = wo.filter((w) => w.status !== 'done').length;

  const radar = useMemo(() => {
    const groups = TYPE_GROUPS.map((g) => {
      const items = rows.filter((r) => g.types.includes(pack.assets.find((a) => a.id === r.id)!.type));
      return { g, v: items.length ? items.reduce((s, r) => s + r.report.health, 0) / items.length : 100, min: items.length ? Math.min(...items.map((r) => r.report.health)) : 100 };
    });
    return {
      radar: { indicator: groups.map((x) => ({ name: t(`asset.group.${x.g.id}`), max: 100 })), radius: '46%', axisName: { color: pal.muted, fontSize: 11 }, splitLine: { lineStyle: { color: pal.grid } }, splitArea: { show: false }, axisLine: { lineStyle: { color: pal.grid } } },
      tooltip: {},
      series: [
        {
          type: 'radar',
          data: [
            { value: groups.map((x) => Math.round(x.v)), name: t('asset.avg'), areaStyle: { color: pal.accent, opacity: 0.18 }, lineStyle: { color: pal.accent, width: 2 }, itemStyle: { color: pal.accent } },
            { value: groups.map((x) => Math.round(x.min)), name: t('asset.worst'), lineStyle: { color: pal.bad, width: 1.6, type: 'dashed' }, itemStyle: { color: pal.bad } },
          ],
        },
      ],
      legend: { bottom: 0, textStyle: { color: pal.muted } },
    };
  }, [rows, pack, pal, t]);

  const setTabUrl = (tb: Tab) => {
    setTab(tb);
    const n = new URLSearchParams(sp);
    n.set('tab', tb);
    setSp(n, { replace: true });
  };
  const open = (id: string | null) => {
    const n = new URLSearchParams(sp);
    if (id) n.set('asset', id);
    else n.delete('asset');
    setSp(n, { replace: true });
  };

  return (
    <div className="h-full overflow-auto" data-testid="assets-page">
      <PageHeader title={t('nav.assets')} subtitle={t('asset.subtitle')} sim />
      <div className="px-5 grid grid-cols-5 gap-3 max-[1200px]:grid-cols-3">
        <Kpi label={t('asset.kpi.avail')} value={fmtPct(snap.kpis.fleetAvailability, lang, 1)} tone={snap.kpis.fleetAvailability > 0.93 ? 'good' : 'warn'} sim />
        <Kpi label={t('asset.kpi.health')} value={Math.round(avgHealth)} tone={avgHealth > 85 ? 'good' : 'warn'} hint={`${rows.length} ${t('asset.units')}`} sim />
        <Kpi label={t('asset.kpi.flagged')} value={flagged} tone={flagged ? 'bad' : 'good'} hint={t('asset.kpi.flaggedHint')} />
        <Kpi label={t('asset.kpi.pm')} value={fmtPct(pmComp, lang)} tone={pmComp > 0.9 ? 'good' : 'warn'} hint={t('asset.kpi.pmHint')} />
        <Kpi label={t('asset.kpi.wo')} value={openWo} hint={t('asset.kpi.woHint')} />
      </div>
      <div className="px-5 mt-2">
        <Tabs<Tab> value={tab} onChange={setTabUrl} tabs={[{ id: 'registry', label: t('asset.tab.registry') }, { id: 'wo', label: t('asset.tab.wo'), badge: <Chip tone="info">{openWo}</Chip> }, { id: 'certs', label: t('asset.tab.certs') }, { id: 'parts', label: t('asset.tab.parts') }]} />
      </div>
      <div className="px-5 py-3">
        {tab === 'registry' && (
          <div className="grid grid-cols-[1fr_330px] gap-3 max-[1250px]:grid-cols-1">
            <div className="flex flex-col gap-3 min-w-0">
              {selected && <AssetDetail id={selected} onClose={() => open(null)} />}
              <Card title={t('asset.registry')} subtitle={t('asset.registrySub')} sim="rule" bodyClass="overflow-auto">
                <table className="w-full border-collapse" data-testid="asset-table">
                  <thead>
                    <tr>
                      <Th>ID</Th>
                      <Th>{t('common.name')}</Th>
                      <Th className="hidden 2xl:table-cell">{t('asset.location')}</Th>
                      <Th align="end">{t('asset.hours')}</Th>
                      <Th>{t('asset.healthCol')}</Th>
                      <Th align="end">{t('asset.util')}</Th>
                      <Th align="end">MTBF</Th>
                      <Th align="end">{t('asset.rul')}</Th>
                      <Th>PM</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => {
                      const a = pack.assets.find((x) => x.id === r.id)!;
                      const pmDue = a.hours - a.pm.lastDoneHrs >= a.pm.intervalHrs * 0.9;
                      return (
                        <tr key={r.id} onClick={() => open(r.id)} className={`cursor-pointer hover:bg-surface-2 ${selected === r.id ? 'bg-[color-mix(in_srgb,var(--accent)_12%,transparent)]' : ''}`} data-testid={`arow-${r.id}`}>
                          <Td className="mono whitespace-nowrap">{r.id}</Td>
                          <Td className="max-w-[190px] truncate" title={tx(a.name, lang)}>{tx(a.name, lang)}</Td>
                          <Td className="max-w-[130px] truncate text-muted hidden 2xl:table-cell">{tx(a.location, lang)}</Td>
                          <Td align="end"><span className="tabular-nums">{fmtNum(a.hours, lang)}</span></Td>
                          <Td>
                            <div className="flex items-center gap-2 w-[120px]">
                              <Bar value={r.report.health / 100} tone={toneOf(r.report.status)} />
                              <span className="num text-[12px] w-6 text-end">{Math.round(r.report.health)}</span>
                            </div>
                          </Td>
                          <Td align="end"><span className="tabular-nums">{fmtPct(r.utilisation, lang)}</span></Td>
                          <Td align="end" className="whitespace-nowrap"><span className="tabular-nums">{r.mtbfHrs} h</span></Td>
                          <Td align="end">{r.report.rulDays === null ? <span className="text-dim">-</span> : <Chip tone={r.report.rulDays < 14 ? 'bad' : 'warn'}>{r.report.rulDays.toFixed(0)} d</Chip>}</Td>
                          <Td>{pmDue ? <Chip tone="warn">{t('asset.pmDue')}</Chip> : <Chip tone="good">OK</Chip>}</Td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </Card>
            </div>
            <div className="flex flex-col gap-3">
              <Card title={t('asset.radar')} subtitle={t('asset.radarSub')} sim>
                <Chart option={radar} height={260} />
              </Card>
              <Card title={t('asset.alarms')} sim>
                <div className="flex flex-col gap-1.5">
                  {snap.alarms.filter((a) => a.source === 'asset').length === 0 && <div className="text-[12px] text-dim">{t('asset.noAlarms')}</div>}
                  {snap.alarms
                    .filter((a) => a.source === 'asset')
                    .map((a) => (
                      <button key={a.id} type="button" onClick={() => open(a.ref)} className="text-start flex items-start gap-2 text-[12px] hover:bg-surface-2 rounded px-1 py-0.5">
                        <Chip tone={a.severity === 'crit' ? 'bad' : 'warn'} dot>{a.severity === 'crit' ? t('asset.crit') : t('asset.warn')}</Chip>
                        <span dir="auto">{tx(a.text, lang)}</span>
                      </button>
                    ))}
                </div>
                <Btn size="sm" variant="primary" className="mt-3" onClick={() => nav('/whatif/equipment')}>{t('asset.openWhatIf')}</Btn>
              </Card>
            </div>
          </div>
        )}
        {tab === 'wo' && <WorkOrderBoard />}
        {tab === 'certs' && (
          <Card title={t('asset.certs')} subtitle={t('asset.certsSub')} sim>
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <Th>ID</Th>
                  <Th>{t('common.name')}</Th>
                  <Th>{t('asset.certType')}</Th>
                  <Th align="end">{t('asset.expires')}</Th>
                  <Th align="end">{t('asset.daysLeft')}</Th>
                </tr>
              </thead>
              <tbody>
                {pack.assets
                  .filter((a) => a.certExpiryT !== undefined)
                  .sort((a, b) => a.certExpiryT! - b.certExpiryT!)
                  .map((a) => {
                    const left = a.certExpiryT! - snap.nowT;
                    return (
                      <tr key={a.id}>
                        <Td className="mono">{a.id}</Td>
                        <Td>{tx(a.name, lang)}</Td>
                        <Td>{a.type.includes('crane') ? t('asset.cert.lifting') : a.type === 'dredger' || a.type === 'tug' ? t('asset.cert.marine') : t('asset.cert.general')}</Td>
                        <Td align="end"><span className="tabular-nums">{fmtDate(a.certExpiryT!, lang)}</span></Td>
                        <Td align="end"><Chip tone={left < 60 ? 'bad' : left < 150 ? 'warn' : 'good'}>{Math.round(left)} d</Chip></Td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </Card>
        )}
        {tab === 'parts' && <Parts />}
      </div>
    </div>
  );
}

function Parts() {
  const { t } = useTranslation();
  const rows = [
    ['SP-1101', 'Hoist gearbox bearing set (CC-class)', 1, 1, 'CC-01 / CC-02', 'lead 21 d'],
    ['SP-1102', 'Hydraulic hose kit 36 t excavator', 6, 4, 'EX-01..04', 'stock'],
    ['SP-1103', 'Dump-truck hydraulic pump', 1, 1, 'DT-01..06', 'lead 14 d'],
    ['SP-1104', 'Dredge pump wear parts', 2, 2, 'DRG-01', 'lead 30 d'],
    ['SP-1105', 'Wire rope 28 mm (100 m)', 3, 2, 'CC-01 / CC-02 / TC', 'stock'],
    ['SP-1106', 'Generator oil filter kit', 8, 6, 'GEN-01 / GEN-02', 'stock'],
  ];
  return (
    <Card title={t('asset.parts')} subtitle={t('asset.partsSub')} sim>
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <Th>{t('asset.part')}</Th>
            <Th>{t('common.name')}</Th>
            <Th align="end">{t('asset.onHand')}</Th>
            <Th align="end">{t('asset.minStock')}</Th>
            <Th>{t('asset.usedOn')}</Th>
            <Th>{t('asset.supply')}</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r[0]}>
              <Td className="mono">{r[0]}</Td>
              <Td>{r[1]}</Td>
              <Td align="end"><Chip tone={(r[2] as number) <= (r[3] as number) ? 'warn' : 'good'}>{r[2]}</Chip></Td>
              <Td align="end"><span className="tabular-nums">{r[3]}</span></Td>
              <Td className="text-muted">{r[4]}</Td>
              <Td className="text-muted">{r[5]}</Td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
