import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Btn, Card, Chip, Kpi, PageHeader, Seg, Tabs, Td, Th, cx, toneVar, type Tone } from '../../design/ui';
import { Chart, useChartPalette } from '../../design/Chart';
import { tx } from '../../lib/bi';
import { fmtNum, type Lang } from '../../lib/fmt';
import { CUBES, DRAWINGS, NCRS, RFIS, SNAGS, SUBMITTALS, type Drawing, type RfiStatus, type SubStatus } from './docsData';
import { DrawingViewer } from './DrawingViewer';
import { AiRfiDraft } from './AiRfi';
import { Sparkles } from 'lucide-react';

type Tab = 'drawings' | 'rfi' | 'submittals' | 'quality' | 'snags';

const DRAW_TONE: Record<Drawing['status'], Tone> = { AFC: 'good', IFC: 'info', IFA: 'warn', IFR: 'violet' };
const RFI_TONE: Record<RfiStatus, Tone> = { open: 'warn', answered: 'info', overdue: 'bad', closed: 'good' };
const SUB_TONE: Record<SubStatus, Tone> = { submitted: 'warn', approved: 'good', noted: 'info', rejected: 'bad' };

export default function DocsPage() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Lang;
  const pal = useChartPalette();
  const [tab, setTab] = useState<Tab>('quality');
  const [disc, setDisc] = useState<string>('all');
  const [sel, setSel] = useState<string>(DRAWINGS[0].no);
  const [aiRfi, setAiRfi] = useState<string | null>(null);
  const [snagState, setSnagState] = useState<Record<string, string>>({});
  const drawings = DRAWINGS.filter((d) => disc === 'all' || d.disc === disc);
  const cur = DRAWINGS.find((d) => d.no === sel) ?? DRAWINGS[0];
  const cubeOpt = useMemo(() => {
    const mean = CUBES.reduce((a, b) => a + b, 0) / CUBES.length;
    return {
      grid: { left: 40, right: 16, top: 24, bottom: 28 },
      tooltip: { trigger: 'axis', valueFormatter: (v: number) => `${v} MPa` },
      xAxis: { type: 'category', data: CUBES.map((_, i) => `#${i + 1}`), axisLabel: { color: pal.muted, interval: 1 }, axisLine: { lineStyle: { color: pal.line } } },
      yAxis: { type: 'value', min: 38, max: 58, axisLabel: { color: pal.muted }, splitLine: { lineStyle: { color: pal.grid } }, name: 'MPa', nameTextStyle: { color: pal.muted } },
      series: [
        {
          type: 'bar',
          barWidth: 12,
          data: CUBES.map((v) => ({ value: v, itemStyle: { color: v < 45 ? pal.bad : pal.good, borderRadius: [3, 3, 0, 0] } })),
          markLine: { silent: true, symbol: 'none', lineStyle: { type: 'dashed' }, data: [{ yAxis: 45, lineStyle: { color: pal.warn }, label: { formatter: 'fck 45', color: pal.warn } }, { yAxis: Math.round(mean * 10) / 10, lineStyle: { color: pal.accent }, label: { formatter: `mean ${mean.toFixed(1)}`, color: pal.accent } }] },
        },
      ],
    };
  }, [pal]);
  const nOpenRfi = RFIS.filter((r) => r.status === 'open' || r.status === 'overdue').length;
  const nOverdue = RFIS.filter((r) => r.status === 'overdue').length;
  const schedImpact = RFIS.filter((r) => r.status === 'open' || r.status === 'overdue').reduce((s, r) => s + r.scheduleDays, 0);
  const snagStatus = (id: string, d: string) => snagState[id] ?? d;

  return (
    <div className="h-full flex flex-col min-h-0" data-testid="docs-page">
      <PageHeader title={t('nav.docs')} subtitle={t('docs.subtitle')} sim />
      <div className="px-5">
        <Tabs<Tab> value={tab} onChange={setTab} tabs={[{ id: 'quality', label: t('docs.tab.quality') }, { id: 'drawings', label: t('docs.tab.drawings') }, { id: 'rfi', label: t('docs.tab.rfi'), badge: nOverdue ? <Chip tone="bad" className="!py-0">{nOverdue}</Chip> : undefined }, { id: 'submittals', label: t('docs.tab.submittals') }, { id: 'snags', label: t('docs.tab.snags') }]} />
      </div>
      <div className="flex-1 min-h-0 overflow-auto px-5 py-3 space-y-3">
        {tab === 'drawings' && (
          <div className="grid gap-3 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
            <Card title={t('docs.draw.title')} sim actions={<Seg size="sm" value={disc} onChange={setDisc} options={[{ value: 'all', label: t('common.all') }, { value: 'Marine', label: t('docs.disc.Marine') }, { value: 'Civil', label: t('docs.disc.Civil') }, { value: 'Architectural', label: t('docs.disc.Architectural') }, { value: 'Electrical', label: t('docs.disc.Electrical') }]} />} bodyClass="!px-0 overflow-auto">
              <table className="w-full border-collapse">
                <thead><tr><Th>{t('docs.draw.no')}</Th><Th>{t('docs.draw.titleCol')}</Th><Th>{t('docs.draw.rev')}</Th><Th>{t('common.status')}</Th></tr></thead>
                <tbody>
                  {drawings.map((d) => (
                    <tr key={d.no} onClick={() => setSel(d.no)} className={cx('cursor-pointer', sel === d.no ? 'bg-surface-2' : 'hover:bg-surface-2/60')}>
                      <Td className="tabular-nums font-medium whitespace-nowrap">{d.no}</Td>
                      <Td className="max-w-[300px]"><div className="truncate">{tx(d.title, lang)}</div><div className="text-[10.5px] text-dim">{t(`docs.disc.${d.disc}`)} - {d.trans} - {d.daysAgo} {t('docs.daysAgo')}</div></Td>
                      <Td className="tabular-nums">{d.rev}</Td>
                      <Td><Chip tone={DRAW_TONE[d.status]} dot>{d.status}</Chip></Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
            <DrawingViewer drawing={cur} />
          </div>
        )}
        {tab === 'rfi' && (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <Kpi label={t('docs.rfi.open')} value={nOpenRfi} tone="warn" sim />
              <Kpi label={t('docs.rfi.overdue')} value={nOverdue} tone={nOverdue ? 'bad' : 'good'} />
              <Kpi label={t('docs.rfi.impact')} value={fmtNum(schedImpact, lang)} unit={lang === 'ar' ? 'يوم' : 'd'} tone="info" hint={t('docs.rfi.impactHint')} />
            </div>
            <Card title={t('docs.rfi.title')} sim bodyClass="!px-0 overflow-auto">
              <table className="w-full border-collapse">
                <thead><tr><Th>{t('docs.col.ref')}</Th><Th>{t('docs.rfi.subject')}</Th><Th className="hidden xl:table-cell">{t('docs.rfi.from')}</Th><Th align="end">{t('docs.rfi.daysOpen')}</Th><Th align="end">{t('docs.rfi.sched')}</Th><Th>{t('common.status')}</Th><Th>AI</Th></tr></thead>
                <tbody>
                  {RFIS.map((r) => (
                    <tr key={r.id}>
                      <Td className="tabular-nums font-medium">{r.id}</Td>
                      <Td className="max-w-[340px]">{tx(r.subject, lang)}<div className="text-[10.5px] text-dim">{r.to}</div></Td>
                      <Td className="hidden xl:table-cell text-muted">{r.from}</Td>
                      <Td align="end" className="tabular-nums">{r.daysOpen ? `${r.daysOpen} d` : '-'}</Td>
                      <Td align="end" className="tabular-nums">{r.scheduleDays ? `+${r.scheduleDays} d` : '-'}</Td>
                      <Td><Chip tone={RFI_TONE[r.status]} dot>{t(`docs.rfi.s.${r.status}`)}</Chip></Td>
                      <Td>
                        {(r.status === 'open' || r.status === 'overdue') && (
                          <Btn size="sm" variant={aiRfi === r.id ? 'soft' : 'primary'} icon={<Sparkles size={12} />} onClick={() => setAiRfi(r.id)} data-testid={`ai-rfi-${r.id}`}>
                            {t('docs.ai.draft')}
                          </Btn>
                        )}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
            {aiRfi && <AiRfiDraft rfi={RFIS.find((r) => r.id === aiRfi)!} onClose={() => setAiRfi(null)} />}
          </>
        )}
        {tab === 'submittals' && (
          <Card title={t('docs.sub.title')} sim bodyClass="!px-0 overflow-auto">
            <table className="w-full border-collapse">
              <thead><tr><Th>{t('docs.col.ref')}</Th><Th>{t('docs.sub.item')}</Th><Th>{t('docs.sub.spec')}</Th><Th align="end">{t('docs.sub.review')}</Th><Th>{t('common.status')}</Th></tr></thead>
              <tbody>
                {SUBMITTALS.map((s) => (
                  <tr key={s.id}>
                    <Td className="tabular-nums font-medium">{s.id}</Td>
                    <Td>{tx(s.item, lang)}</Td>
                    <Td className="tabular-nums text-muted">{s.spec}</Td>
                    <Td align="end" className="tabular-nums">{s.daysInReview ? `${s.daysInReview} d` : '-'}</Td>
                    <Td><Chip tone={SUB_TONE[s.status]} dot>{t(`docs.sub.s.${s.status}`)}</Chip></Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
        {tab === 'quality' && (
          <div className="grid gap-3 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
            <Card title={t('docs.ncr.title')} sim bodyClass="!px-0 overflow-auto">
              <table className="w-full border-collapse">
                <thead><tr><Th>{t('docs.col.ref')}</Th><Th>{t('docs.ncr.desc')}</Th><Th>{t('docs.ncr.sev')}</Th><Th>{t('common.status')}</Th></tr></thead>
                <tbody>
                  {NCRS.map((n) => (
                    <tr key={n.id}>
                      <Td className="tabular-nums font-medium">{n.id}</Td>
                      <Td className="max-w-[300px]">{tx(n.title, lang)}<div className="text-[10.5px] text-dim">{tx(n.area, lang)} - {n.daysOpen} d</div></Td>
                      <Td><Chip tone={n.severity === 'major' ? 'bad' : 'warn'}>{t(`docs.ncr.${n.severity}`)}</Chip></Td>
                      <Td><Chip tone={n.status === 'closed' ? 'good' : n.status === 'open' ? 'bad' : 'warn'} dot>{t(`docs.ncr.s.${n.status}`)}</Chip></Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
            <Card title={t('docs.cube.title')} subtitle={t('docs.cube.sub')} sim>
              <Chart option={cubeOpt} height={250} />
              <div className="text-[11.5px] text-dim mt-1">{t('docs.cube.note')}</div>
            </Card>
          </div>
        )}
        {tab === 'snags' && (
          <Card title={t('docs.snag.title')} sim bodyClass="!px-0 overflow-auto">
            <table className="w-full border-collapse">
              <thead><tr><Th>{t('docs.col.ref')}</Th><Th>{t('docs.snag.item')}</Th><Th>{t('docs.snag.trade')}</Th><Th>{t('docs.snag.priority')}</Th><Th>{t('common.status')}</Th><Th /></tr></thead>
              <tbody>
                {SNAGS.map((s) => {
                  const st = snagStatus(s.id, s.status);
                  const next = st === 'open' ? 'fixed' : st === 'fixed' ? 'verified' : null;
                  return (
                    <tr key={s.id}>
                      <Td className="tabular-nums font-medium">{s.id}</Td>
                      <Td>{tx(s.item, lang)}</Td>
                      <Td className="text-muted">{s.trade}</Td>
                      <Td><span style={{ color: s.priority === 'high' ? toneVar.bad : s.priority === 'medium' ? toneVar.warn : undefined }}>{t(`docs.snag.p.${s.priority}`)}</span></Td>
                      <Td><Chip tone={st === 'verified' ? 'good' : st === 'fixed' ? 'info' : 'warn'} dot>{t(`docs.snag.s.${st}`)}</Chip></Td>
                      <Td align="end">{next && <Btn size="sm" variant="soft" onClick={() => setSnagState((m) => ({ ...m, [s.id]: next }))}>{t(`docs.snag.act.${next}`)}</Btn>}</Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        )}
      </div>
    </div>
  );
}
