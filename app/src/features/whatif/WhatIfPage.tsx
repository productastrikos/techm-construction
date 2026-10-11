import { lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Btn, PageHeader, Tabs } from '../../design/ui';
import { useOverlay } from '../../app/overlay';
import { useScenario } from './scenarioStore';

const SupplyTab = lazy(() => import('./SupplyTab'));
const CalendarTab = lazy(() => import('./CalendarTab'));
const EquipmentTab = lazy(() => import('./EquipmentTab'));
const StressTab = lazy(() => import('./StressTab'));

type Tab = 'supply' | 'calendar' | 'equipment' | 'stress';
const TABS: Tab[] = ['supply', 'calendar', 'equipment', 'stress'];

/** What-If Studio: A supply / route (Chokepoint), B calendar & workforce, C equipment failure, D combined stress test */
export default function WhatIfPage() {
  const { t } = useTranslation();
  const loc = useLocation();
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const seg = loc.pathname.split('/').filter(Boolean)[1] as Tab | undefined;
  const tab: Tab = TABS.includes(seg as Tab) ? (seg as Tab) : 'supply';
  const active = useScenario((s) => s.active);
  const go = (tb: Tab) => nav(`/whatif/${tb}`);
  return (
    <div className="h-full overflow-auto" data-testid="whatif-page">
      <PageHeader
        title={t('nav.whatif')}
        subtitle={t('wi.subtitle')}
        sim="rule"
        actions={
          active ? (
            <Btn
              size="sm"
              variant="soft"
              onClick={() => {
                useScenario.getState().clear();
                useOverlay.getState().clear();
              }}
            >
              {t('wi.clear')}
            </Btn>
          ) : undefined
        }
      />
      <div className="px-5">
        <Tabs<Tab>
          value={tab}
          onChange={go}
          tabs={[
            { id: 'supply', label: `A  ${t('wi.tab.supply')}` },
            { id: 'calendar', label: `B  ${t('wi.tab.calendar')}` },
            { id: 'equipment', label: `C  ${t('wi.tab.equipment')}` },
            { id: 'stress', label: `D  ${t('wi.tab.stress')}` },
          ]}
        />
      </div>
      <div className="px-5 py-3">
        <Suspense fallback={<div className="text-dim">{t('common.loading')}</div>}>
          {tab === 'supply' && <SupplyTab />}
          {tab === 'calendar' && <CalendarTab />}
          {tab === 'equipment' && <EquipmentTab initialAsset={sp.get('asset') ?? undefined} />}
          {tab === 'stress' && <StressTab />}
        </Suspense>
      </div>
    </div>
  );
}
