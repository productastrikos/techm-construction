import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PageHeader, Tabs } from '../../design/ui';
import { CctvWall } from './CctvWall';
import { HseDashboard } from './HseDashboard';
import { Incidents, Permits } from './Registers';

type Tab = 'dashboard' | 'cctv' | 'permits' | 'incidents';

export default function HsePage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>('cctv');
  return (
    <div className="h-full flex flex-col min-h-0" data-testid="hse-page">
      <PageHeader title={t('nav.hse')} subtitle={t('hse.subtitle')} sim />
      <div className="px-5">
        <Tabs<Tab> value={tab} onChange={setTab} tabs={[{ id: 'cctv', label: t('hse.tab.cctv') }, { id: 'dashboard', label: t('hse.tab.dashboard') }, { id: 'permits', label: t('hse.tab.permits') }, { id: 'incidents', label: t('hse.tab.incidents') }]} />
      </div>
      <div className="flex-1 min-h-0 overflow-auto px-5 py-3">
        {tab === 'dashboard' && <HseDashboard />}
        {tab === 'cctv' && <CctvWall />}
        {tab === 'permits' && <Permits />}
        {tab === 'incidents' && <Incidents />}
      </div>
    </div>
  );
}
