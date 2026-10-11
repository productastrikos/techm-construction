import { useTranslation } from 'react-i18next';
import { PageHeader, Card, Empty } from '../design/ui';

export default function PageStub({ titleKey }: { titleKey: string }) {
  const { t } = useTranslation();
  return (
    <div className="h-full flex flex-col">
      <PageHeader title={t(titleKey)} subtitle={t('common.illustrativeNote')} sim />
      <div className="px-5 pb-5 flex-1 min-h-0">
        <Card className="h-full">
          <Empty title={t('common.comingSoon')} />
        </Card>
      </div>
    </div>
  );
}
