import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { FlaskConical, Sparkles } from 'lucide-react';
import { AiBar, AiPanel, AiSteps, Typed } from '../ai/kit';
import { openCopilot } from '../ai/Copilot';
import { Bar, Btn, Card, Chip, Empty, Kpi, PageHeader, Tabs, Td, Th, toneVar, type Tone } from '../../design/ui';
import { Chart, useChartPalette } from '../../design/Chart';
import { fmtAed, fmtDate, fmtDays, fmtMonth, fmtNum, fmtPct, type Lang } from '../../lib/fmt';
import { tx } from '../../lib/bi';
import { usePack, useSnapshot } from '../../sim/useSim';
import { useScenario } from '../whatif/scenarioStore';
import { CONTRACTS, VARIATIONS, priceIndices, type VoStatus } from './data';

type Tab = 'overview' | 'cashflow' | 'commercial' | 'indices';
const VO_TONE: Record<VoStatus, Tone> = { approved: 'good', pending: 'warn', review: 'info', rejected: 'bad' };

function Gauge({ value, label, lo, hi }: { value: number; label: string; lo: number; hi: number }) {
  const pal = useChartPalette();
  const color = value >= 1 ? pal.good : value >= 0.95 ? pal.warn : pal.bad;
  const option = useMemo(
    () => ({
      series: [
        {
          type: 'gauge',
          min: lo,
          max: hi,
          startAngle: 200,
          endAngle: -20,
          radius: '96%',
          progress: { show: true, width: 12, itemStyle: { color } },
          axisLine: { lineStyle: { width: 12, color: [[1, pal.grid]] } },
          axisTick: { show: false },
          splitLine: { show: false },
          axisLabel: { show: false },
          pointer: { show: false },
          anchor: { show: false },
          detail: { valueAnimation: true, offsetCenter: [0, '8%'], fontSize: 26, fontWeight: 600, color: pal.text, formatter: (v: number) => v.toFixed(2) },
          title: { offsetCenter: [0, '58%'], color: pal.muted, fontSize: 11 },
          data: [{ value: Math.min(hi, Math.max(lo, value)), name: label }],
        },
      ],
    }),
    [value, label, lo, hi, pal, color],
  );
  return <Chart option={option} height={150} />;
}

/** AI cost explainer: reads EVM by work package and writes the "why" in two sentences */
function AiCostInsight() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Lang;
  const pack = usePack();
  const snap = useSnapshot();
  const [phase, setPhase] = useState<'idle' | 'steps' | 'typing' | 'done'>('idle');
  const [run, setRun] = useState(0);
  const L = (en: string, ar: string) => (lang === 'ar' ? ar : en);
  const e = snap.evm;
  const worst = [...snap.evmWbs].filter((w) => w.bac > 0 && w.ev > 0).sort((a, b) => a.cpi - b.cpi)[0];
  const worstName = worst ? tx(pack.wbs.find((w) => w.id === worst.wbsId)?.name, lang) : '';
  const text = L(
    `The forecast at completion is AED ${fmtAed(e.eac, lang)} against a budget of AED ${fmtAed(e.bac, lang)} (${fmtAed(e.vac, lang)}). The overrun comes from cost performance of ${e.cpi.toFixed(2)}${worst ? `, led by ${worstName} at ${worst.cpi.toFixed(2)}` : ''}. Approved variations add AED ${fmtAed(VARIATIONS.filter((v) => v.status === 'approved').reduce((a, v) => a + v.amountM * 1e6, 0), lang)} on top (the last bar of the chart). The overrun is covered by the contingency pool, but the remaining work must run at ${e.tcpi.toFixed(2)} efficiency to stay on budget - flag it to the commercial team now rather than at the next IPC.`,
    `التكلفة المتوقعة عند الإنجاز ${fmtAed(e.eac, lang)} درهم مقابل ميزانية ${fmtAed(e.bac, lang)} درهم (${fmtAed(e.vac, lang)}). يأتي التجاوز من أداء تكلفة ${e.cpi.toFixed(2)}${worst ? ` بقيادة ${worstName} عند ${worst.cpi.toFixed(2)}` : ''}. وتضيف الأوامر التغييرية المعتمدة ما قيمته ${fmtAed(VARIATIONS.filter((v) => v.status === 'approved').reduce((a, v) => a + v.amountM * 1e6, 0), lang)} درهم فوق ذلك (العمود الأخير في المخطط). يغطي مخصص الاحتياطي التجاوز، لكن بقية الأعمال يجب أن تعمل بكفاءة ${e.tcpi.toFixed(2)} لتبقى ضمن الميزانية - أبلغ الفريق التجاري الآن لا عند الدفعة القادمة.`,
  );
  const steps = [L('Aggregating earned value by work package', 'تجميع القيمة المكتسبة حسب حزمة العمل'), L('Projecting EAC from current CPI', 'إسقاط التكلفة عند الإنجاز من المؤشر الحالي'), L('Finding the packages that drive the variance', 'إيجاد الحزم التي تقود الفارق')];
  return (
    <AiPanel
      title={t('cost.ai.title')}
      glow={phase === 'steps'}
      actions={
        <Btn size="sm" variant={phase === 'idle' ? 'primary' : 'soft'} icon={<Sparkles size={13} />} disabled={phase === 'steps' || phase === 'typing'} onClick={() => { setPhase('steps'); setRun((x) => x + 1); }} data-testid="ai-cost-btn">
          {phase === 'idle' ? t('cost.ai.run') : t('rep.ai.regenerate')}
        </Btn>
      }
    >
      {phase === 'idle' && <div className="text-[12px] text-dim">{t('cost.ai.hint')}</div>}
      {phase === 'steps' && (
        <div className="space-y-2">
          <AiBar />
          <AiSteps steps={steps} runKey={run} stepMs={480} compact onDone={() => setPhase('typing')} />
        </div>
      )}
      {(phase === 'typing' || phase === 'done') && <p className="m-0 text-[12.5px] leading-relaxed">{phase === 'done' ? text : <Typed text={text} cps={200} onDone={() => setPhase('done')} />}</p>}
    </AiPanel>
  );
}

export default function CostPage() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Lang;
  const nav = useNavigate();
  const pack = usePack();
  const snap = useSnapshot();
  const scen = useScenario((s) => s.active);
  const pal = useChartPalette();
  const [tab, setTab] = useState<Tab>('overview');
  const e = snap.evm;
  const voApproved = VARIATIONS.filter((v) => v.status === 'approved').reduce((s, v) => s + v.amountM * 1e6, 0);
  const voOpen = VARIATIONS.filter((v) => v.status === 'pending' || v.status === 'review').reduce((s, v) => s + v.amountM * 1e6, 0);
  const eotOpen = VARIATIONS.filter((v) => v.status === 'pending' || v.status === 'review').reduce((s, v) => s + v.eotDays, 0);
  const scnCost = scen?.result.cost.total ?? 0;
  const contingency = pack.config.contingencyPct * e.bac;
  const contUsed = Math.min(contingency, Math.max(0, e.eac - e.bac) * 0.45 + voApproved * 0.35);
  const wbsName = (id: string) => tx(pack.wbs.find((w) => w.id === id)?.name, lang) || id;

  /* ---------------- EAC bridge (waterfall) */
  const bridge = useMemo(() => {
    const perf = e.eac - e.bac;
    const steps = [
      { name: t('cost.bridge.bac'), v: e.bac, base: 0, c: pal.info },
      { name: t('cost.bridge.perf'), v: Math.abs(perf), base: perf >= 0 ? e.bac : e.bac + perf, c: perf >= 0 ? pal.bad : pal.good },
      { name: t('cost.bridge.vo'), v: voApproved, base: e.eac, c: pal.warn },
      { name: t('cost.bridge.eac'), v: e.eac + voApproved, base: 0, c: pal.accent },
      ...(scnCost > 0 ? [{ name: t('cost.bridge.scenario'), v: scnCost, base: e.eac + voApproved, c: pal.bad }, { name: t('cost.bridge.total'), v: e.eac + voApproved + scnCost, base: 0, c: pal.violet }] : []),
    ];
    return {
      grid: { left: 54, right: 16, top: 16, bottom: 38 },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: (p: Array<{ dataIndex: number }>) => `${steps[p[0].dataIndex].name}: AED ${(steps[p[0].dataIndex].v / 1e6).toFixed(0)} M` },
      xAxis: { type: 'category', data: steps.map((s) => s.name), axisLabel: { color: pal.muted, fontSize: 10.5, interval: 0 }, axisLine: { lineStyle: { color: pal.line } } },
      yAxis: { type: 'value', min: e.bac * 0.9, axisLabel: { color: pal.muted, formatter: (v: number) => (v / 1e9).toFixed(2) }, splitLine: { lineStyle: { color: pal.grid } }, name: 'AED bn', nameTextStyle: { color: pal.muted } },
      series: [
        { type: 'bar', stack: 'w', silent: true, itemStyle: { color: 'transparent' }, data: steps.map((s) => s.base) },
        { type: 'bar', stack: 'w', barWidth: 34, itemStyle: { borderRadius: 3 }, label: { show: true, position: 'top', color: pal.text, fontSize: 10.5, formatter: (p: { dataIndex: number }) => fmtAed(steps[p.dataIndex].v, lang) }, data: steps.map((s) => ({ value: s.v, itemStyle: { color: s.c } })) },
      ],
    };
  }, [e, voApproved, scnCost, pal, t, lang]);

  /* ---------------- cashflow */
  const cash = snap.cashflow;
  const cashOpt = useMemo(() => {
    const cats = cash.map((c) => fmtMonth(c.t, lang));
    const nowIdx = cash.findIndex((c) => c.t >= snap.nowT);
    return {
      grid: { left: 60, right: 56, top: 36, bottom: 30 },
      legend: { top: 0, textStyle: { color: pal.muted } },
      tooltip: { trigger: 'axis', valueFormatter: (v: number) => `AED ${v} M` },
      xAxis: { type: 'category', data: cats, axisLabel: { color: pal.muted, interval: 2 }, axisLine: { lineStyle: { color: pal.line } } },
      yAxis: [
        { type: 'value', name: 'AED M', nameTextStyle: { color: pal.muted }, axisLabel: { color: pal.muted }, splitLine: { lineStyle: { color: pal.grid } } },
        { type: 'value', name: 'AED M', nameTextStyle: { color: pal.muted }, axisLabel: { color: pal.muted }, splitLine: { show: false } },
      ],
      series: [
        { name: t('cost.cash.net'), type: 'bar', data: cash.map((c) => Math.round(c.netPayment / 1e6)), itemStyle: { color: pal.good, borderRadius: [3, 3, 0, 0] }, barGap: '-10%', markLine: nowIdx > 0 ? { symbol: 'none', silent: true, lineStyle: { color: pal.accent, type: 'dashed' }, label: { color: pal.accent, formatter: t('cost.cash.now') }, data: [{ xAxis: nowIdx }] } : undefined },
        { name: t('cost.cash.out'), type: 'bar', data: cash.map((c) => -Math.round(c.outflow / 1e6)), itemStyle: { color: pal.bad, borderRadius: [0, 0, 3, 3] } },
        { name: t('cost.cash.cum'), type: 'line', yAxisIndex: 1, smooth: true, symbol: 'none', data: cash.map((c) => Math.round(c.cumNet / 1e6)), lineStyle: { color: pal.warn, width: 2.5 } },
      ],
    };
  }, [cash, lang, pal, t, snap.nowT]);

  /* ---------------- indices */
  const idx = useMemo(() => priceIndices(18), []);
  const idxOpt = useMemo(
    () => ({
      grid: { left: 44, right: 16, top: 34, bottom: 28 },
      legend: { top: 0, textStyle: { color: pal.muted } },
      tooltip: { trigger: 'axis' },
      xAxis: { type: 'category', data: idx.map((p) => fmtMonth(p.m * 30, lang)), axisLabel: { color: pal.muted, interval: 2 }, axisLine: { lineStyle: { color: pal.line } } },
      yAxis: { type: 'value', min: 90, axisLabel: { color: pal.muted }, splitLine: { lineStyle: { color: pal.grid } } },
      series: [
        { name: t('cost.idx.steel'), type: 'line', smooth: true, symbol: 'none', data: idx.map((p) => p.steel), lineStyle: { color: pal.info, width: 2.4 } },
        { name: t('cost.idx.freight'), type: 'line', smooth: true, symbol: 'none', data: idx.map((p) => p.freight), lineStyle: { color: pal.bad, width: 2.4 }, markArea: { silent: true, itemStyle: { color: 'rgba(255,107,107,0.08)' }, data: [[{ xAxis: 4 }, { xAxis: 10 }]] } },
      ],
    }),
    [idx, lang, pal, t],
  );
  const importedOpen = useMemo(() => snap.pos.filter((p) => p.stage < 6 && p.chokepointExposed).reduce((s, p) => s + p.valueAED, 0), [snap.pos]);
  const openTotal = useMemo(() => snap.pos.filter((p) => p.stage < 6).reduce((s, p) => s + p.valueAED, 0), [snap.pos]);

  const ipcs = cash.filter((c) => c.t - 45 <= snap.nowT + 30).map((c, i) => ({ i: i + 1, ...c, status: c.t <= snap.nowT ? 'paid' : c.t - 45 <= snap.nowT ? 'certified' : 'submitted' }));

  const scnItems = scen
    ? (['ld', 'prolongation', 'expedite', 'escalation', 'rental', 'shifts', 'repair'] as const).map((k) => ({ k, v: scen.result.cost[k] })).filter((x) => x.v > 0)
    : [];
  const scnColors = [pal.bad, pal.warn, pal.info, pal.violet, pal.accent, pal.good, pal.muted];

  return (
    <div className="h-full flex flex-col min-h-0" data-testid="cost-page">
      <PageHeader title={t('nav.cost')} subtitle={t('cost.subtitle')} sim />
      <div className="px-5">
        <Tabs<Tab> value={tab} onChange={setTab} tabs={[{ id: 'overview', label: t('cost.tab.overview') }, { id: 'cashflow', label: t('cost.tab.cashflow') }, { id: 'commercial', label: t('cost.tab.commercial') }, { id: 'indices', label: t('cost.tab.indices') }]} />
      </div>
      <div className="flex-1 min-h-0 overflow-auto px-5 py-3 space-y-3">
        {tab === 'overview' && (
          <>
            <div className="grid gap-3 grid-cols-2 lg:grid-cols-4 2xl:grid-cols-7">
              <Kpi label={t('cost.kpi.bac')} value={fmtAed(e.bac, lang)} unit="AED" sim />
              <Kpi label={t('cost.kpi.revised')} value={fmtAed(e.bac + voApproved, lang)} unit="AED" hint={t('cost.kpi.revisedHint')} />
              <Kpi label={t('cost.kpi.ev')} value={fmtAed(e.ev, lang)} unit="AED" hint={fmtPct(e.percentComplete, lang, 1)} />
              <Kpi label={t('cost.kpi.ac')} value={fmtAed(e.ac, lang)} unit="AED" />
              <Kpi label={t('cost.kpi.eac')} value={fmtAed(e.eac, lang)} unit="AED" tone={e.eac > e.bac ? 'warn' : 'good'} hint={t('cost.kpi.eacHint')} />
              <Kpi label={t('cost.kpi.vac')} value={fmtAed(e.vac, lang)} unit="AED" tone={e.vac < 0 ? 'bad' : 'good'} />
              <Kpi label={t('cost.kpi.tcpi')} value={e.tcpi.toFixed(2)} tone={e.tcpi > 1.05 ? 'warn' : 'good'} hint={t('cost.kpi.tcpiHint')} />
            </div>
            <AiCostInsight />
            <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
              <Card title={t('cost.gauge.cpi')} sim>
                <div className="grid grid-cols-2 gap-2">
                  <Gauge value={e.cpi} label="CPI" lo={0.7} hi={1.2} />
                  <Gauge value={e.spi} label="SPI" lo={0.7} hi={1.2} />
                </div>
                <div className="mt-1 space-y-1.5">
                  <div className="flex justify-between text-[12px]"><span className="text-muted">{t('cost.cont.pool')}</span><span className="num">AED {fmtAed(contingency, lang)}</span></div>
                  <Bar value={contUsed / contingency} tone={contUsed / contingency > 0.7 ? 'warn' : 'accent'} />
                  <div className="flex justify-between text-[11.5px] text-dim"><span>{t('cost.cont.used')} {fmtAed(contUsed, lang)}</span><span>{t('cost.cont.remaining')} {fmtAed(contingency - contUsed, lang)}</span></div>
                </div>
              </Card>
              <Card title={t('cost.bridge.title')} subtitle={t('cost.bridge.sub')} sim>
                <Chart option={bridge} height={290} />
              </Card>
            </div>
            <div className="grid gap-3 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
              <Card title={t('cost.wbs.title')} sim bodyClass="!px-0 overflow-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      <Th>{t('cost.wbs.col.wbs')}</Th>
                      <Th align="end">{t('cost.wbs.col.bac')}</Th>
                      <Th align="end">{t('cost.wbs.col.ev')}</Th>
                      <Th align="end">{t('cost.wbs.col.ac')}</Th>
                      <Th>{t('cost.wbs.col.cpi')}</Th>
                      <Th>{t('cost.wbs.col.spi')}</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {snap.evmWbs.filter((w) => w.bac > 0).map((w) => (
                      <tr key={w.wbsId}>
                        <Td>
                          <span className="inline-block size-2 rounded-sm me-1.5" style={{ background: pack.wbs.find((x) => x.id === w.wbsId)?.color }} />
                          {wbsName(w.wbsId)}
                        </Td>
                        <Td align="end" className="tabular-nums">{fmtAed(w.bac, lang)}</Td>
                        <Td align="end" className="tabular-nums">{fmtAed(w.ev, lang)}</Td>
                        <Td align="end" className="tabular-nums">{fmtAed(w.ac, lang)}</Td>
                        <Td className="min-w-[90px]">
                          <span className="num text-[12px]" style={{ color: w.cpi < 0.95 ? toneVar.bad : w.cpi < 0.99 ? toneVar.warn : toneVar.good }}>{w.cpi.toFixed(2)}</span>
                          <Bar value={Math.min(1.1, w.cpi) / 1.1} tone={w.cpi < 0.95 ? 'bad' : w.cpi < 0.99 ? 'warn' : 'good'} height={4} />
                        </Td>
                        <Td className="min-w-[90px]">
                          <span className="num text-[12px]" style={{ color: w.pv <= 0 ? 'var(--dim)' : w.spi < 0.95 ? toneVar.bad : w.spi < 0.99 ? toneVar.warn : toneVar.good }}>{w.pv <= 0 ? '-' : w.spi.toFixed(2)}</span>
                          <Bar value={Math.min(1.1, w.spi) / 1.1} tone={w.spi < 0.95 ? 'bad' : w.spi < 0.99 ? 'warn' : 'good'} height={4} />
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
              <Card title={t('cost.scn.title')} sim actions={scen ? <Chip tone="warn" dot>{scen.label}</Chip> : undefined}>
                {!scen ? (
                  <div className="py-5 flex flex-col items-center gap-2 text-center">
                    <FlaskConical size={22} className="text-muted" />
                    <div className="text-[13px] font-medium text-muted">{t('cost.scn.none')}</div>
                    <div className="text-[12px] text-dim max-w-sm">{t('cost.scn.noneHint')}</div>
                    <div className="flex gap-2 mt-1 flex-wrap justify-center">
                      <Btn size="sm" variant="primary" icon={<FlaskConical size={14} />} onClick={() => nav('/whatif')}>{t('cost.scn.open')}</Btn>
                      <Btn size="sm" variant="outline" icon={<Sparkles size={13} style={{ color: 'var(--violet)' }} />} onClick={() => openCopilot('hormuz')}>{t('wi.cta.ask')}</Btn>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-baseline justify-between">
                      <span className="text-[12px] text-muted">{t('cost.scn.total')}</span>
                      <span className="text-[22px] font-semibold num" style={{ color: toneVar.bad }}>AED {fmtAed(scnCost, lang)}</span>
                    </div>
                    <div className="text-[12px] text-muted">{t('cost.scn.finish')} <span className="num font-medium" style={{ color: scen.result.dFinish > 0 ? toneVar.bad : toneVar.good }}>{fmtDays(scen.result.dFinish, lang, true)}</span> ({fmtDate(scen.result.finish, lang)})</div>
                    {scnItems.map((it, i) => (
                      <div key={it.k}>
                        <div className="flex justify-between text-[12px]"><span>{t(`cost.scn.${it.k}`)}</span><span className="num">{fmtAed(it.v, lang)}</span></div>
                        <div className="h-1.5 rounded-full bg-surface-3 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${(it.v / scnCost) * 100}%`, background: scnColors[i % scnColors.length] }} /></div>
                      </div>
                    ))}
                  </div>
                )}
                {scen && <div className="mt-3"><Btn size="sm" variant="soft" icon={<FlaskConical size={14} />} onClick={() => nav('/whatif')}>{t('cost.scn.open')}</Btn></div>}
              </Card>
            </div>
          </>
        )}
        {tab === 'cashflow' && (
          <>
            <Card title={t('cost.cash.title')} subtitle={t('cost.cash.sub')} sim>
              <Chart option={cashOpt} height={320} />
            </Card>
            <Card title={t('cost.ipc.title')} subtitle={t('cost.terms', { ret: fmtPct(pack.config.retentionPct, lang), adv: fmtPct(pack.config.advancePct, lang) })} sim bodyClass="!px-0 overflow-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <Th>{t('cost.ipc.col.ipc')}</Th>
                    <Th>{t('cost.ipc.col.month')}</Th>
                    <Th align="end">{t('cost.ipc.col.cert')}</Th>
                    <Th align="end">{t('cost.ipc.col.ret')}</Th>
                    <Th align="end">{t('cost.ipc.col.adv')}</Th>
                    <Th align="end">{t('cost.ipc.col.net')}</Th>
                    <Th>{t('cost.ipc.col.status')}</Th>
                  </tr>
                </thead>
                <tbody>
                  {ipcs.map((c) => (
                    <tr key={c.i}>
                      <Td className="tabular-nums font-medium">IPC-{String(c.i).padStart(2, '0')}</Td>
                      <Td>{fmtMonth(c.t - 45, lang)}</Td>
                      <Td align="end" className="tabular-nums">{fmtAed(c.certified, lang)}</Td>
                      <Td align="end" className="tabular-nums">-{fmtAed(c.retention, lang)}</Td>
                      <Td align="end" className="tabular-nums">-{fmtAed(c.advanceRecovery, lang)}</Td>
                      <Td align="end" className="tabular-nums font-medium">{fmtAed(c.netPayment, lang)}</Td>
                      <Td><Chip tone={c.status === 'paid' ? 'good' : c.status === 'certified' ? 'info' : 'warn'} dot>{t(`cost.ipc.${c.status}`)}</Chip></Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </>
        )}
        {tab === 'commercial' && (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <Kpi label={t('cost.vo.sumApproved')} value={fmtAed(voApproved, lang)} unit="AED" tone="good" sim />
              <Kpi label={t('cost.vo.sumPending')} value={fmtAed(voOpen, lang)} unit="AED" tone="warn" />
              <Kpi label={t('cost.vo.sumEot')} value={fmtNum(eotOpen, lang)} unit={lang === 'ar' ? 'يوم' : 'd'} tone="info" />
            </div>
            <Card title={t('cost.vo.title')} sim bodyClass="!px-0 overflow-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <Th>{t('cost.vo.col.id')}</Th>
                    <Th>{t('cost.vo.col.title')}</Th>
                    <Th>{t('cost.vo.col.wbs')}</Th>
                    <Th align="end">{t('cost.vo.col.amount')}</Th>
                    <Th align="end">{t('cost.vo.col.eot')}</Th>
                    <Th>{t('cost.vo.col.status')}</Th>
                  </tr>
                </thead>
                <tbody>
                  {VARIATIONS.map((v) => (
                    <tr key={v.id}>
                      <Td className="tabular-nums font-medium whitespace-nowrap">{v.id}</Td>
                      <Td className="max-w-[360px]">{tx(v.title, lang)}</Td>
                      <Td className="whitespace-nowrap text-muted">{wbsName(v.wbs)}</Td>
                      <Td align="end" className="tabular-nums whitespace-nowrap"><span style={{ color: v.amountM < 0 ? toneVar.good : undefined }}>{v.amountM > 0 ? '+' : ''}{fmtAed(v.amountM * 1e6, lang)}</span></Td>
                      <Td align="end" className="tabular-nums">{v.eotDays ? fmtDays(v.eotDays, lang, true) : '-'}</Td>
                      <Td><Chip tone={VO_TONE[v.status]} dot>{t(`cost.vo.${v.status}`)}</Chip></Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
            <Card title={t('cost.con.title')} sim bodyClass="!px-0 overflow-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <Th>{t('cost.con.col.id')}</Th>
                    <Th>{t('cost.con.col.title')}</Th>
                    <Th>{t('cost.con.col.party')}</Th>
                    <Th>{t('cost.con.col.type')}</Th>
                    <Th align="end">{t('cost.con.col.value')}</Th>
                    <Th>{t('cost.con.col.progress')}</Th>
                  </tr>
                </thead>
                <tbody>
                  {CONTRACTS.map((c) => {
                    const w = snap.evmWbs.find((x) => x.wbsId === c.wbs);
                    const pct = w && w.bac > 0 ? w.ev / w.bac : 0;
                    return (
                      <tr key={c.id}>
                        <Td className="tabular-nums font-medium">{c.id}</Td>
                        <Td>{tx(c.title, lang)}</Td>
                        <Td className="text-muted">{c.party}</Td>
                        <Td>{c.type}</Td>
                        <Td align="end" className="tabular-nums">{fmtAed(e.bac * c.valueShare, lang)}</Td>
                        <Td className="min-w-[110px]"><span className="num text-[12px]">{fmtPct(pct, lang)}</span><Bar value={pct} height={4} /></Td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Card>
          </>
        )}
        {tab === 'indices' && (
          <div className="grid gap-3 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            <Card title={t('cost.idx.title')} subtitle={t('cost.idx.sub')} sim>
              <Chart option={idxOpt} height={320} />
              <div className="grid grid-cols-3 gap-3 mt-2">
                <Kpi label={t('cost.idx.steel')} value={idx[idx.length - 1].steel.toFixed(1)} tone="info" />
                <Kpi label={t('cost.idx.freight')} value={idx[idx.length - 1].freight.toFixed(1)} tone="warn" />
                <Kpi label={t('cost.idx.peg')} value="3.6725" hint={t('cost.idx.pegNote')} />
              </div>
            </Card>
            <div className="flex flex-col gap-3">
              <Card title={t('cost.idx.exposure')} subtitle={t('cost.idx.exposureHint')} sim>
                <div className="text-[26px] font-semibold num" style={{ color: toneVar.warn }}>AED {fmtAed(importedOpen, lang)}</div>
                <div className="text-[12px] text-muted mb-1.5">{fmtPct(openTotal ? importedOpen / openTotal : 0, lang)} / AED {fmtAed(openTotal, lang)}</div>
                <Bar value={openTotal ? importedOpen / openTotal : 0} tone="warn" />
              </Card>
              <Card title={t('cost.erp.title')} sim>
                <div className="text-[12.5px] text-muted">{t('cost.erp.body')}</div>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
