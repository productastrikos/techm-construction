import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Boxes, Cable, Camera, Cloud, Database, DoorOpen, Drone, FileSpreadsheet, Gauge, Radar, Route, ScanLine, Server, Ship } from 'lucide-react';
import { Btn, Card, Chip, PageHeader, Tabs, Td, Th } from '../../design/ui';
import { fmtDate, type Lang } from '../../lib/fmt';
import { useSnapshotMaybe } from '../../sim/useSim';
import { AiHow } from './AiHow';

type Tab = 'ai' | 'arch' | 'connectors' | 'mock';

const SOURCES = [
  { k: 'erp', icon: <Database size={16} />, proto: 'REST / ERP OData', dir: 'both' },
  { k: 'sched', icon: <FileSpreadsheet size={16} />, proto: 'Schedule file import', dir: 'in' },
  { k: 'bim', icon: <Boxes size={16} />, proto: 'IFC / GLB / DWG', dir: 'in' },
  { k: 'vms', icon: <Camera size={16} />, proto: 'ONVIF / RTSP', dir: 'in' },
  { k: 'acs', icon: <DoorOpen size={16} />, proto: 'REST / OSDP gateway', dir: 'in' },
  { k: 'pids', icon: <Radar size={16} />, proto: 'Dry contact / MQTT', dir: 'in' },
  { k: 'drone', icon: <Drone size={16} />, proto: 'GeoTIFF / photogrammetry export', dir: 'in' },
  { k: 'laser', icon: <ScanLine size={16} />, proto: 'E57 / LAS', dir: 'in' },
  { k: 'iot', icon: <Gauge size={16} />, proto: 'MQTT / OPC UA', dir: 'in' },
  { k: 'logi', icon: <Ship size={16} />, proto: 'Partner REST (EDI)', dir: 'both' },
  { k: 'weather', icon: <Cloud size={16} />, proto: 'REST / GRIB', dir: 'in' },
] as const;

const PLATFORM = ['ops', 'dam', 'std', 'eng', 'gw'] as const;
const MODULES = ['perf', 'sop', 'alarm', 'analytics', 'asset', 'kpi'] as const;
const MOCK_ROWS = ['data', 'sched', 'pred', 'cctv', 'logi', 'twin', 'ai', 'sia', 'holiday'] as const;

export default function AdminPage() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Lang;
  const snap = useSnapshotMaybe();
  const [tab, setTab] = useState<Tab>('ai');
  const sync = snap ? fmtDate(snap.nowT, lang, 'short') : '-';
  return (
    <div className="h-full flex flex-col min-h-0" data-testid="admin-page">
      <PageHeader title={t('nav.admin')} subtitle={t('adm.subtitle')} sim actions={<Btn variant="soft" onClick={() => window.dispatchEvent(new CustomEvent('mz:credits'))}>{t('adm.mock.credits')}</Btn>} />
      <div className="px-5">
        <Tabs<Tab> value={tab} onChange={setTab} tabs={[{ id: 'ai', label: t('adm.tab.ai') }, { id: 'arch', label: t('adm.tab.arch') }, { id: 'connectors', label: t('adm.tab.connectors') }, { id: 'mock', label: t('adm.tab.mock') }]} />
      </div>
      <div className="flex-1 min-h-0 overflow-auto px-5 py-3">
        {tab === 'ai' && <AiHow />}
        {tab === 'arch' && (
          <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_40px_minmax(0,1.1fr)_40px_minmax(0,1fr)] items-stretch" data-testid="arch">
            <Card title={t('adm.arch.sources')} sim bodyClass="grid grid-cols-1 gap-1.5 content-start">
              {SOURCES.map((s) => (
                <div key={s.k} className="flex items-center gap-2 rounded-lg border border-line px-2.5 py-1.5 text-[12.5px]"><span style={{ color: 'var(--accent)' }}>{s.icon}</span><span className="truncate">{t(`adm.src.${s.k}`)}</span></div>
              ))}
            </Card>
            <div className="hidden xl:flex items-center justify-center" style={{ color: 'var(--accent)' }}><ArrowRight size={28} /></div>
            <Card title={t('adm.arch.platform')} sim bodyClass="flex flex-col gap-2">
              <div className="rounded-xl p-3 border" style={{ borderColor: 'var(--accent)', background: 'color-mix(in srgb, var(--accent) 8%, transparent)' }}>
                <div className="flex items-center gap-2 font-semibold text-[13px] mb-2"><Server size={16} style={{ color: 'var(--accent)' }} />CMC</div>
                <div className="grid gap-1.5">
                  {PLATFORM.map((p) => <div key={p} className="rounded-md bg-surface-2 px-2.5 py-1.5 text-[12.5px]">{t(`adm.plat.${p}`)}</div>)}
                </div>
              </div>
              <div className="text-[11.5px] text-dim flex gap-1.5"><Cable size={13} className="shrink-0 mt-0.5" />{t('adm.arch.note')}</div>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {['Site 1', 'Site 2', 'Site 3', '...', 'Site n'].map((s) => <Chip key={s} tone={s === 'Site 1' ? 'accent' : 'neutral'}>{s}</Chip>)}
              </div>
            </Card>
            <div className="hidden xl:flex items-center justify-center" style={{ color: 'var(--accent)' }}><ArrowRight size={28} /></div>
            <Card title={t('adm.arch.modules')} sim bodyClass="grid gap-1.5 content-start">
              {MODULES.map((m) => <div key={m} className="rounded-lg border border-line px-2.5 py-2 text-[12.5px] flex items-center gap-2"><Route size={14} style={{ color: 'var(--accent)' }} />{t(`adm.mod.${m}`)}</div>)}
            </Card>
          </div>
        )}
        {tab === 'connectors' && (
          <Card title={t('adm.tab.connectors')} sim bodyClass="!px-0 overflow-auto">
            <table className="w-full border-collapse" data-testid="connectors">
              <thead><tr><Th>{t('adm.con.name')}</Th><Th>{t('adm.con.protocol')}</Th><Th>{t('adm.con.dir')}</Th><Th>{t('adm.con.status')}</Th><Th>{t('adm.con.sync')}</Th></tr></thead>
              <tbody>
                {SOURCES.map((s) => (
                  <tr key={s.k}>
                    <Td><span className="inline-flex items-center gap-2"><span style={{ color: 'var(--accent)' }}>{s.icon}</span>{t(`adm.src.${s.k}`)}</span></Td>
                    <Td className="text-muted">{s.proto}</Td>
                    <Td>{t(`adm.con.${s.dir}`)}</Td>
                    <Td><Chip tone="warn" dot>{t('adm.con.sim')}</Chip></Td>
                    <Td className="tabular-nums">{sync}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
        {tab === 'mock' && (
          <Card title={t('adm.mock.title')} sim bodyClass="!px-0 overflow-auto">
            <table className="w-full border-collapse" data-testid="mock-table">
              <thead><tr><Th>{t('adm.mock.area')}</Th><Th>{t('adm.mock.poc')}</Th><Th>{t('adm.mock.real')}</Th></tr></thead>
              <tbody>
                {MOCK_ROWS.map((r) => (
                  <tr key={r}>
                    <Td className="font-medium whitespace-nowrap">{t(`adm.m.${r}`)}</Td>
                    <Td className="max-w-[340px]">{t(`adm.m.${r}.poc`)}</Td>
                    <Td className="max-w-[340px] text-muted">{t(`adm.m.${r}.real`)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </div>
    </div>
  );
}
