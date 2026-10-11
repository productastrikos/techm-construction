import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Sparkles } from 'lucide-react';
import { AiRca } from './AiRca';
import { Btn, Card, Chip, Td, Th, type Tone } from '../../design/ui';
import { tx } from '../../lib/bi';
import type { Lang } from '../../lib/fmt';
import { INCIDENTS, PERMITS, type PermitStatus } from './data';
import { useHse } from './hseStore';

const PERMIT_TONE: Record<PermitStatus, Tone> = { requested: 'warn', approved: 'info', active: 'good', suspended: 'bad', closed: 'neutral' };
const NEXT: Partial<Record<PermitStatus, PermitStatus>> = { requested: 'approved', approved: 'active', active: 'closed', suspended: 'active' };

export function Permits() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Lang;
  const overrides = useHse((s) => s.permits);
  const setPermit = useHse((s) => s.setPermit);
  return (
    <Card title={t('hse.ptw.title')} subtitle={t('hse.ptw.sub')} sim bodyClass="!px-0 overflow-auto">
      <table className="w-full border-collapse" data-testid="permits">
        <thead>
          <tr>
            <Th>{t('hse.ptw.col.id')}</Th>
            <Th>{t('hse.ptw.col.type')}</Th>
            <Th>{t('hse.ptw.col.work')}</Th>
            <Th className="hidden xl:table-cell">{t('hse.ptw.col.area')}</Th>
            <Th className="hidden 2xl:table-cell">{t('hse.ptw.col.contractor')}</Th>
            <Th>{t('hse.ptw.col.window')}</Th>
            <Th>{t('hse.ptw.col.status')}</Th>
            <Th />
          </tr>
        </thead>
        <tbody>
          {PERMITS.map((p) => {
            const st = (overrides[p.id] as PermitStatus | undefined) ?? p.status;
            const next = NEXT[st];
            return (
              <tr key={p.id}>
                <Td className="tabular-nums font-medium whitespace-nowrap">{p.id}</Td>
                <Td><Chip tone="accent">{t(`hse.ptw.k.${p.kind}`)}</Chip></Td>
                <Td className="max-w-[300px]">{tx(p.title, lang)}</Td>
                <Td className="hidden xl:table-cell text-muted">{tx(p.area, lang)}</Td>
                <Td className="hidden 2xl:table-cell text-muted">{p.contractor}</Td>
                <Td className="tabular-nums whitespace-nowrap"><span className="num">{p.from} - {p.to}</span></Td>
                <Td><Chip tone={PERMIT_TONE[st]} dot>{t(`hse.ptw.s.${st}`)}</Chip></Td>
                <Td align="end">{next && <Btn size="sm" variant="soft" onClick={() => setPermit(p.id, next)}>{t(`hse.ptw.act.${next}`)}</Btn>}</Td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}

export function Incidents() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Lang;
  const sevTone: Tone[] = ['neutral', 'info', 'warn', 'bad', 'bad'];
  const [rca, setRca] = useState<string | null>(INCIDENTS.find((i) => i.status !== 'closed')?.id ?? null);
  return (
    <>
    <Card title={t('hse.inc.title')} sim bodyClass="!px-0 overflow-auto">
      <table className="w-full border-collapse" data-testid="incidents">
        <thead>
          <tr>
            <Th>{t('hse.inc.col.id')}</Th>
            <Th>{t('hse.inc.col.when')}</Th>
            <Th>{t('hse.inc.col.type')}</Th>
            <Th>{t('hse.inc.col.desc')}</Th>
            <Th>{t('hse.inc.col.sev')}</Th>
            <Th>{t('hse.inc.col.status')}</Th>
            <Th>AI</Th>
          </tr>
        </thead>
        <tbody>
          {INCIDENTS.map((i) => (
            <tr key={i.id}>
              <Td className="tabular-nums font-medium">{i.id}</Td>
              <Td className="whitespace-nowrap text-muted">{i.daysAgo} {t('hse.inc.daysAgo')}</Td>
              <Td><Chip tone="accent">{t(`hse.inc.t.${i.type}`)}</Chip></Td>
              <Td className="max-w-[420px]">{tx(i.title, lang)}</Td>
              <Td><Chip tone={sevTone[i.severity]}>S{i.severity}</Chip></Td>
              <Td><Chip tone={i.status === 'closed' ? 'good' : i.status === 'open' ? 'bad' : 'warn'} dot>{t(`hse.inc.s.${i.status}`)}</Chip></Td>
              <Td>{i.status !== 'closed' && <Btn size="sm" variant={rca === i.id ? 'soft' : 'primary'} icon={<Sparkles size={12} />} onClick={() => setRca(i.id)} data-testid={`ai-rca-${i.id}`}>{t('hse.ai.rca')}</Btn>}</Td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
    {rca && <AiRca incident={INCIDENTS.find((x) => x.id === rca)!} onClose={() => setRca(null)} />}
    </>
  );
}
