import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Chip, PageHeader, Seg, Tabs } from '../../design/ui';
import { usePack, useSnapshot } from '../../sim/useSim';
import type { ChokepointState } from '../../engine/types';
import { PoDetail, PoTable, Summary } from './ControlTower';
import { AiScan } from './AiScan';
import { RoutePlanner } from './RoutePlanner';
import { StockTab } from './StockTab';
import { SuppliersTab } from './SuppliersTab';
import { GatewayTab } from './GatewayTab';
import { buildRows, useProc } from './model';

export default function ProcurementPage() {
  const { t } = useTranslation();
  const pack = usePack();
  const snap = useSnapshot();
  const { hz, setHz, tab, setTab } = useProc();
  const rows = useMemo(() => buildRows(pack, snap, hz), [pack, snap, hz]);
  const selected = useProc((s) => s.selected);
  const select = useProc((s) => s.select);
  useEffect(() => {
    if (selected) return;
    const worst = [...rows].filter((r) => r.row.stage < 6 && r.row.chokepointExposed).sort((a, b) => a.floatDays - b.floatDays)[0] ?? [...rows].filter((r) => r.row.stage < 6).sort((a, b) => a.floatDays - b.floatDays)[0];
    if (worst) select(worst.po.id);
  }, [rows, selected, select]);
  const tone = hz === 'open' ? 'good' : hz === 'restricted' ? 'warn' : 'bad';
  return (
    <div className="h-full flex flex-col min-h-0" data-testid="procurement-page">
      <PageHeader
        title={t('nav.procurement')}
        subtitle={t('proc.subtitle')}
        sim
        actions={
          <div className="flex items-center gap-2" title={t('proc.hzNote')}>
            <span className="text-[12px] text-muted hidden md:inline">{t('proc.chokepoint')}</span>
            <Seg<ChokepointState>
              size="sm"
              ariaLabel={t('proc.chokepoint')}
              value={hz}
              onChange={setHz}
              options={[
                { value: 'open', label: t('proc.hz.open'), tone: 'good' },
                { value: 'restricted', label: t('proc.hz.restricted'), tone: 'warn' },
                { value: 'closed', label: t('proc.hz.closed'), tone: 'bad' },
              ]}
            />
            <Chip tone={tone} dot>{t(`proc.hz.${hz}`)}</Chip>
          </div>
        }
      />
      <div className="px-5">
        <Tabs value={tab} onChange={setTab} tabs={[{ id: 'tower', label: t('proc.tab.tower') }, { id: 'routes', label: t('proc.tab.routes') }, { id: 'stock', label: t('proc.tab.stock') }, { id: 'suppliers', label: t('proc.tab.suppliers') }, { id: 'gateway', label: t('proc.tab.gateway') }]} />
      </div>
      <div className="flex-1 min-h-0 overflow-auto px-5 py-3">
        {tab === 'tower' && (
          <div className="flex flex-col gap-0 min-h-full">
            <Summary rows={rows} snap={snap} />
            <AiScan rows={rows} pack={pack} snap={snap} />
            <div className="grid gap-3 mt-3 xl:grid-cols-[minmax(0,1.7fr)_minmax(340px,1fr)] min-h-[420px]">
              <PoTable rows={rows} pack={pack} />
              <PoDetail rows={rows} pack={pack} snap={snap} />
            </div>
          </div>
        )}
        {tab === 'routes' && <div className="h-full min-h-[560px]"><RoutePlanner rows={rows} pack={pack} snap={snap} /></div>}
        {tab === 'stock' && <StockTab pack={pack} snap={snap} />}
        {tab === 'suppliers' && <SuppliersTab rows={rows} pack={pack} />}
        {tab === 'gateway' && <GatewayTab rows={rows} pack={pack} snap={snap} />}
      </div>
    </div>
  );
}
