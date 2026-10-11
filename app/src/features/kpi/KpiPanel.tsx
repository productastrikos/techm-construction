import { useMemo } from 'react';
import { ArrowRight, MessageSquare, TrendingDown, TrendingUp } from 'lucide-react';
import { Drawer } from '../../design/Drawer';
import { Chart, useChartPalette } from '../../design/Chart';
import { Btn, Chip, toneVar } from '../../design/ui';
import { AiPanel } from '../ai/kit';
import { openCopilot } from '../ai/Copilot';
import { useApp } from '../../app/store';
import { fmtDate } from '../../lib/fmt';
import { buildOutlook, type KpiSpec, type Outlook } from './forecast';
import { useKpiPanel } from './kpiStore';

/** drivers + recommended action, picked from the tile's topic (EN keywords first, AR as fallback) */
function narrative(label: string, up: boolean, lang: 'en' | 'ar'): { drivers: string[]; action: string } {
  const L = (en: string, ar: string) => (lang === 'ar' ? ar : en);
  const l = label.toLowerCase();
  if (/spi|finish|schedule|float|activity|critical|completion|اكتمال|جدول/.test(l))
    return {
      drivers: [L('Critical-path activities with the least float', 'أنشطة المسار الحرج الأقل هامشًا'), L('Late deliveries feeding the next 30 days of work', 'تأخر التوريدات المغذية لأعمال الأيام الثلاثين القادمة'), L('Weather and crane windows (wind limit)', 'الطقس ونوافذ الرافعات (حد الرياح)')],
      action: L('Protect the critical path: confirm the two longest-lead deliveries and re-sequence non-critical work into the wind-restricted days.', 'احمِ المسار الحرج: أكّد أطول توريدين مدةً وأعد ترتيب الأعمال غير الحرجة في أيام تقييد الرياح.'),
    };
  if (/cpi|eac|vac|tcpi|cost|budget|bac|ev\b|ac\b|تكلفة|ميزانية/.test(l))
    return {
      drivers: [L('Earned value vs actual cost trend', 'اتجاه القيمة المكتسبة مقابل التكلفة الفعلية'), L('Escalation on steel and fuel lines', 'تصاعد أسعار الحديد والوقود'), L('Variation orders awaiting approval', 'أوامر التغيير بانتظار الاعتماد')],
      action: L('Review the three largest cost-to-complete lines with the cost controller and lock the pending variation orders this week.', 'راجع أكبر ثلاثة بنود تكلفة للإنجاز مع مراقب التكاليف وأقفل أوامر التغيير المعلقة هذا الأسبوع.'),
    };
  if (/safety|ltifr|manpower|hse|incident|lti|سلامة|حوادث|عمالة/.test(l))
    return {
      drivers: [L('Manpower density near crane and quay-edge zones', 'كثافة العمالة قرب الرافعات وحافة الرصيف'), L('Open observations and permit-to-work volume', 'الملاحظات المفتوحة وحجم تصاريح العمل'), L('Heat and fatigue indicators on the late shift', 'مؤشرات الحرارة والإرهاق في الوردية المتأخرة')],
      action: L('Brief the night-shift supervisors on the exclusion-zone rule and close the open camera events before the next lift.', 'أطلع مشرفي الوردية الليلية على قاعدة منطقة الحظر وأغلق أحداث الكاميرات المفتوحة قبل الرفعة القادمة.'),
    };
  if (/po|material|procure|supplier|stock|route|exposed|مشتريات|مواد|توريد/.test(l))
    return {
      drivers: [L('Vessel ETAs on chokepoint-exposed routes', 'مواعيد وصول السفن على المسارات المعرضة'), L('Supplier lead-time drift', 'انحراف مدد التوريد لدى الموردين'), L('Stock cover against the 30-day look-ahead', 'تغطية المخزون مقابل نظرة الـ30 يومًا')],
      action: L('Expedite the POs with under two weeks of float and ask logistics for an alternative route quote.', 'عجّل أوامر الشراء ذات الهامش الأقل من أسبوعين واطلب من اللوجستيات عرض مسار بديل.'),
    };
  if (/fleet|asset|equipment|health|availability|أسطول|معدات|أصول/.test(l))
    return {
      drivers: [L('Vibration and temperature drift on flagged units', 'انحراف الاهتزاز والحرارة في الوحدات المُعلَّمة'), L('Preventive maintenance compliance', 'الالتزام بالصيانة الوقائية'), L('Spare-part lead times', 'مدد توريد قطع الغيار')],
      action: L('Book the planned service window for the lowest-health unit and order its long-lead spare today.', 'احجز نافذة الصيانة المخططة للوحدة الأقل صحة واطلب قطعة الغيار طويلة التوريد اليوم.'),
    };
  return {
    drivers: [L('Recent run-rate of the underlying data', 'معدل الأداء الأخير للبيانات الأساسية'), L('Seasonality and weekday pattern', 'الموسمية ونمط أيام الأسبوع'), L('Open items on the linked work packages', 'البنود المفتوحة على حزم العمل المرتبطة')],
    action: up
      ? L('Keep the current plan and re-check this indicator in the weekly review.', 'أبقِ الخطة الحالية وأعد فحص المؤشر في المراجعة الأسبوعية.')
      : L('Assign an owner to the contributing items and review again in 7 days.', 'عيّن مسؤولًا للبنود المساهمة وراجع مجددًا بعد 7 أيام.'),
  };
}

function ForecastChart({ o, days, simT, lang }: { o: Outlook; days: 7 | 30; simT: number; lang: 'en' | 'ar' }) {
  const p = useChartPalette();
  const option = useMemo(() => {
    const histN = 7;
    const labels: string[] = [];
    for (let i = -(histN - 1); i <= days; i++) labels.push(fmtDate(simT + i, lang, 'short'));
    const pad = new Array(histN - 1).fill(null);
    const hist = [...o.hist, ...new Array(days).fill(null)];
    const mid = [...pad, ...o.mid.slice(0, days + 1)];
    const lo = [...pad, ...o.lo.slice(0, days + 1)];
    const band = [...pad, ...o.hi.slice(0, days + 1).map((h, i) => h - o.lo[i])];
    const col = p.violet;
    return {
      grid: { left: 8, right: 14, top: 14, bottom: 4, containLabel: true },
      tooltip: {
        trigger: 'axis',
        backgroundColor: p.surface,
        borderColor: p.line,
        textStyle: { color: p.text, fontSize: 12 },
        formatter: (ps: Array<{ axisValueLabel: string; seriesName: string; value: number | null; dataIndex: number }>) => {
          const i = ps[0]?.dataIndex ?? 0;
          const v = i < histN ? o.hist[i] : o.mid[i - (histN - 1)];
          const range = i >= histN ? ` <span style="opacity:.6">(${o.fmt(o.lo[i - (histN - 1)])} - ${o.fmt(o.hi[i - (histN - 1)])})</span>` : '';
          return `${ps[0]?.axisValueLabel}<br/><b>${o.fmt(v)}</b>${range}`;
        },
      },
      xAxis: { type: 'category', data: labels, boundaryGap: false, axisLine: { lineStyle: { color: p.line } }, axisLabel: { color: p.muted, fontSize: 10.5, interval: days === 7 ? 1 : 4 }, axisTick: { show: false } },
      yAxis: { type: 'value', scale: true, minInterval: o.step, splitLine: { lineStyle: { color: p.grid } }, axisLabel: { color: p.muted, fontSize: 10.5, formatter: (v: number) => o.fmt(v) } },
      series: [
        { name: 'lo', type: 'line', data: lo, stack: 'band', symbol: 'none', lineStyle: { opacity: 0 }, silent: true },
        { name: 'band', type: 'line', data: band, stack: 'band', symbol: 'none', lineStyle: { opacity: 0 }, areaStyle: { color: col, opacity: 0.14 }, silent: true },
        { name: 'forecast', type: 'line', data: mid, symbol: 'none', smooth: true, lineStyle: { color: col, width: 2.2, type: 'dashed' }, markLine: { symbol: 'none', silent: true, label: { show: false }, lineStyle: { color: p.muted, type: 'dotted' }, data: [{ xAxis: histN - 1 }] } },
        { name: 'actual', type: 'line', data: hist, symbol: 'circle', symbolSize: 5, smooth: true, itemStyle: { color: p.text }, lineStyle: { color: p.text, width: 2.2 } },
      ],
    };
  }, [o, days, simT, lang, p]);
  return <Chart option={option} height={176} />;
}

function Body({ spec }: { spec: KpiSpec }) {
  const lang = useApp((s) => s.lang);
  const simT = useApp((s) => s.simT);
  const L = (en: string, ar: string) => (lang === 'ar' ? ar : en);
  const o = useMemo(() => buildOutlook(spec, lang, 0), [spec, lang]);
  const worsening = o ? (o.d30 > 0) !== o.higherIsBetter && Math.abs(o.d30) > 0.004 : false;
  const improving = o ? (o.d30 > 0) === o.higherIsBetter && Math.abs(o.d30) > 0.004 : false;
  const trendTone = worsening ? 'bad' : improving ? 'good' : 'neutral';
  const tr = o ? narrative(spec.label, !worsening, lang) : null;
  const dTxt = (d: number) => (o?.kind === 'date' ? `${d > 0 ? '+' : ''}${d.toFixed(1)} ${L('d', 'ي')}` : `${d > 0 ? '+' : ''}${(d * 100).toFixed(1)}%`);
  const Icon = o && o.d30 < 0 ? TrendingDown : TrendingUp;
  return (
    <div className="space-y-4" data-testid="kpi-panel-body">
      <div>
        <div className="flex items-baseline gap-2">
          <span className="text-[34px] leading-none font-semibold tracking-tight num" style={{ color: spec.tone === 'neutral' ? 'var(--text)' : toneVar[spec.tone] }}>{spec.value}</span>
          {spec.unit && <span className="text-[13px] text-dim">{spec.unit}</span>}
          {spec.delta && <Chip tone={spec.tone === 'neutral' ? 'info' : spec.tone}>{spec.delta}</Chip>}
        </div>
        {spec.hint && <div className="text-[12px] text-dim mt-1">{spec.hint}</div>}
      </div>
      {o && tr ? (
        <>
          <AiPanel title={L('AI outlook', 'توقعات الذكاء الاصطناعي')}>
            <p className="m-0 text-[13px] leading-snug text-muted">
              {L('Expected to be', 'من المتوقع أن يصبح')} <b className="text-ink num">{o.fmt(o.mid[7])}</b> {L('in 7 days and', 'خلال 7 أيام و')} <b className="text-ink num">{o.fmt(o.mid[30])}</b> {L('in 30 days', 'خلال 30 يومًا')}
              {worsening ? L(' - drifting the wrong way.', ' - اتجاه غير مرغوب.') : improving ? L(' - trending in the right direction.', ' - اتجاه إيجابي.') : L(' - broadly stable.', ' - مستقر إجمالًا.')}
            </p>
          </AiPanel>
          <div className="grid grid-cols-2 gap-3">
            {([['7', o.mid[7], o.d7, o.conf7], ['30', o.mid[30], o.d30, o.conf30]] as const).map(([d, v, rel, conf]) => (
              <div key={d} className="rounded-lg border border-line px-3 py-2">
                <div className="text-[11px] text-dim uppercase tracking-wide">{L(`In ${d} days`, `بعد ${d} يومًا`)}</div>
                <div className="text-[19px] font-semibold num leading-tight">{o.fmt(v)}</div>
                <div className="flex items-center gap-1 text-[11.5px] num" style={{ color: trendTone === 'neutral' ? 'var(--dim)' : toneVar[trendTone] }}>
                  <Icon size={12} /> <bdi>{dTxt(rel)}</bdi> <span className="text-dim ms-auto">{L('conf.', 'ثقة')} <bdi>{conf}%</bdi></span>
                </div>
              </div>
            ))}
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wider text-dim mb-1">{L('Next 7 days', 'الأيام السبعة القادمة')}</div>
            <ForecastChart o={o} days={7} simT={simT} lang={lang} />
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wider text-dim mb-1">{L('Next 30 days', 'الثلاثون يومًا القادمة')}</div>
            <ForecastChart o={o} days={30} simT={simT} lang={lang} />
            <div className="flex items-center gap-3 text-[11px] text-dim mt-1">
              <span className="inline-flex items-center gap-1"><span className="inline-block w-4 border-t-2" style={{ borderColor: 'var(--text)' }} /> {L('Actual', 'الفعلي')}</span>
              <span className="inline-flex items-center gap-1"><span className="inline-block w-4 border-t-2 border-dashed" style={{ borderColor: 'var(--violet)' }} /> {L('Forecast', 'التوقع')}</span>
              <span className="inline-flex items-center gap-1"><span className="inline-block w-4 h-2 rounded-sm" style={{ background: 'color-mix(in srgb, var(--violet) 20%, transparent)' }} /> {L('Confidence band', 'نطاق الثقة')}</span>
            </div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wider text-dim mb-1">{L('What is driving it', 'ما الذي يحركه')}</div>
            <ul className="m-0 ps-4 text-[12.5px] text-muted space-y-0.5">{tr.drivers.map((d) => <li key={d}>{d}</li>)}</ul>
          </div>
          <div className="rounded-lg border border-line bg-surface-2 px-3 py-2.5">
            <div className="text-[11px] uppercase tracking-wider text-dim mb-0.5">{L('Recommended action', 'الإجراء الموصى به')}</div>
            <div className="text-[12.5px] leading-snug">{tr.action}</div>
          </div>
        </>
      ) : (
        <div className="text-[12.5px] text-muted">{L('No forecast is available for this indicator.', 'لا يتوفر توقع لهذا المؤشر.')}</div>
      )}
    </div>
  );
}

export function KpiPanel() {
  const spec = useKpiPanel((s) => s.spec);
  const close = useKpiPanel((s) => s.close);
  const lang = useApp((s) => s.lang);
  const L = (en: string, ar: string) => (lang === 'ar' ? ar : en);
  return (
    <Drawer
      open={!!spec}
      onClose={close}
      testId="kpi-panel"
      title={spec?.label ?? ''}
      subtitle={L('Details and 7 / 30 day prediction', 'التفاصيل وتوقع 7 / 30 يومًا')}
      footer={
        spec && (
          <>
            {spec.goto && (
              <Btn
                variant="primary"
                onClick={() => {
                  const g = spec.goto;
                  close();
                  g?.();
                }}
              >
                {L('Open full page', 'افتح الصفحة كاملة')} <ArrowRight size={14} className="flip-rtl" />
              </Btn>
            )}
            <Btn
              variant="outline"
              onClick={() => {
                close();
                openCopilot();
              }}
            >
              <MessageSquare size={14} /> {L('Ask AI about this', 'اسأل الذكاء الاصطناعي')}
            </Btn>
          </>
        )
      }
    >
      {spec && <Body spec={spec} />}
    </Drawer>
  );
}
