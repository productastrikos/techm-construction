import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Check, Info, Loader2, MessageSquare, RotateCw, Sparkles, TrendingDown, TrendingUp } from 'lucide-react';
import { Drawer } from '../../design/Drawer';
import { Chart, useChartPalette } from '../../design/Chart';
import { Btn, Chip, cx, Seg, toneVar } from '../../design/ui';
import { AiPanel, AiSteps } from '../ai/kit';
import { openCopilot } from '../ai/Copilot';
import { useWorkOrders } from '../assets/woStore';
import { useApp } from '../../app/store';
import { bi } from '../../lib/bi';
import { fmtDate } from '../../lib/fmt';
import { buildSeries, TIMEFRAMES, type KpiSpec, type KpiSeries, type Timeframe } from './forecast';
import { useKpiPanel } from './kpiStore';

type Lang = 'en' | 'ar';
interface Act {
  en: string;
  ar: string;
  dept: string;
}
interface Topic {
  drivers: Array<[string, string]>;
  actions: Act[];
  definition: [string, string];
}

/** drivers, recommended actions and the definition line, picked from the tile's topic (EN keywords first, AR as fallback) */
function topicFor(label: string): Topic {
  const l = label.toLowerCase();
  if (/spi|finish|schedule|float|activity|critical|completion|اكتمال|جدول/.test(l))
    return {
      drivers: [
        ['Critical-path activities with the least float', 'أنشطة المسار الحرج الأقل هامشًا'],
        ['Late deliveries feeding the next 30 days of work', 'تأخر التوريدات المغذية لأعمال الأيام الثلاثين القادمة'],
        ['Weather and crane windows (wind limit)', 'الطقس ونوافذ الرافعات (حد الرياح)'],
      ],
      actions: [
        { en: 'Confirm the two longest-lead deliveries with suppliers this week', ar: 'أكّد أطول توريدين مدةً مع الموردين هذا الأسبوع', dept: 'Procurement' },
        { en: 'Re-sequence non-critical work into the wind-restricted days', ar: 'أعد ترتيب الأعمال غير الحرجة في أيام تقييد الرياح', dept: 'Marine' },
        { en: 'Add a second shift on the quay-wall pour to recover float', ar: 'أضف وردية ثانية لصب جدار الرصيف لاستعادة الهامش', dept: 'Civil' },
      ],
      definition: ['Planned finish comes from the CPM engine run on the current progress: forecast finish = the date the critical path is expected to complete.', 'تاريخ الإنجاز المتوقع يأتي من محرك المسار الحرج على التقدم الحالي.'],
    };
  if (/cpi|eac|vac|tcpi|cost|budget|bac|ev\b|ac\b|تكلفة|ميزانية/.test(l))
    return {
      drivers: [
        ['Earned value vs actual cost trend', 'اتجاه القيمة المكتسبة مقابل التكلفة الفعلية'],
        ['Escalation on steel and fuel lines', 'تصاعد أسعار الحديد والوقود'],
        ['Variation orders awaiting approval', 'أوامر التغيير بانتظار الاعتماد'],
      ],
      actions: [
        { en: 'Review the three largest cost-to-complete lines with the cost controller', ar: 'راجع أكبر ثلاثة بنود تكلفة للإنجاز مع مراقب التكاليف', dept: 'Civil' },
        { en: 'Lock the pending variation orders this week', ar: 'أقفل أوامر التغيير المعلقة هذا الأسبوع', dept: 'Procurement' },
        { en: 'Hedge the next steel call-off at the current price', ar: 'ثبّت سعر دفعة الحديد القادمة', dept: 'Procurement' },
      ],
      definition: ['CPI = earned value / actual cost (below 1.00 means over budget). EAC = estimate at completion = budget / CPI. All from the EVM engine.', 'CPI = القيمة المكتسبة / التكلفة الفعلية. EAC = التكلفة المتوقعة عند الإنجاز.'],
    };
  if (/safety|ltifr|manpower|hse|incident|lti|سلامة|حوادث|عمالة|camera|people/.test(l))
    return {
      drivers: [
        ['Manpower density near crane and quay-edge zones', 'كثافة العمالة قرب الرافعات وحافة الرصيف'],
        ['Open observations and permit-to-work volume', 'الملاحظات المفتوحة وحجم تصاريح العمل'],
        ['Heat and fatigue indicators on the late shift', 'مؤشرات الحرارة والإرهاق في الوردية المتأخرة'],
      ],
      actions: [
        { en: 'Brief the night-shift supervisors on the exclusion-zone rule', ar: 'أطلع مشرفي الوردية الليلية على قاعدة منطقة الحظر', dept: 'HSE' },
        { en: 'Close the open camera events before the next lift', ar: 'أغلق أحداث الكاميرات المفتوحة قبل الرفعة القادمة', dept: 'HSE' },
        { en: 'Add a hydration and shade break to the 13:00-15:00 window', ar: 'أضف استراحة ترطيب وظل بين 13:00 و15:00', dept: 'HSE' },
      ],
      definition: ['LTIFR = lost-time injuries per million hours worked. Days without LTI counts since the last recordable lost-time event.', 'LTIFR = الإصابات المضيعة للوقت لكل مليون ساعة عمل.'],
    };
  if (/po|material|procure|supplier|stock|route|exposed|مشتريات|مواد|توريد/.test(l))
    return {
      drivers: [
        ['Vessel ETAs on chokepoint-exposed routes', 'مواعيد وصول السفن على المسارات المعرضة'],
        ['Supplier lead-time drift', 'انحراف مدد التوريد لدى الموردين'],
        ['Stock cover against the 30-day look-ahead', 'تغطية المخزون مقابل نظرة الـ30 يومًا'],
      ],
      actions: [
        { en: 'Expedite the POs with under two weeks of float', ar: 'عجّل أوامر الشراء ذات الهامش الأقل من أسبوعين', dept: 'Procurement' },
        { en: 'Ask logistics for an alternative-route quote on exposed POs', ar: 'اطلب من اللوجستيات عرض مسار بديل للأوامر المعرضة', dept: 'Procurement' },
        { en: 'Raise safety stock on the three longest-lead materials', ar: 'ارفع مخزون الأمان لأطول ثلاث مواد توريدًا', dept: 'Procurement' },
      ],
      definition: ['Counts come from the procurement model: an order is at risk when its float to the activity that needs it is shorter than the forecast delivery slip.', 'تأتي الأرقام من نموذج المشتريات: الأمر معرّض للخطر عندما يقل هامشه عن تأخر التسليم المتوقع.'],
    };
  if (/fleet|asset|equipment|health|availability|أسطول|معدات|أصول/.test(l))
    return {
      drivers: [
        ['Vibration and temperature drift on flagged units', 'انحراف الاهتزاز والحرارة في الوحدات المُعلَّمة'],
        ['Preventive maintenance compliance', 'الالتزام بالصيانة الوقائية'],
        ['Spare-part lead times', 'مدد توريد قطع الغيار'],
      ],
      actions: [
        { en: 'Book the planned service window for the lowest-health unit', ar: 'احجز نافذة الصيانة المخططة للوحدة الأقل صحة', dept: 'Plant & Equipment' },
        { en: 'Order the long-lead spare part today', ar: 'اطلب قطعة الغيار طويلة التوريد اليوم', dept: 'Procurement' },
        { en: 'Move the unit to light duty until the service', ar: 'انقل الوحدة إلى مهام خفيفة حتى الصيانة', dept: 'Plant & Equipment' },
      ],
      definition: ['Asset health (0-100) comes from the degradation model on simulated telemetry; availability = units fit for work / fleet.', 'صحة الأصل (0-100) من نموذج التدهور على بيانات محاكاة؛ الجاهزية = الوحدات الصالحة / الأسطول.'],
    };
  return {
    drivers: [
      ['Recent run-rate of the underlying data', 'معدل الأداء الأخير للبيانات الأساسية'],
      ['Seasonality and weekday pattern', 'الموسمية ونمط أيام الأسبوع'],
      ['Open items on the linked work packages', 'البنود المفتوحة على حزم العمل المرتبطة'],
    ],
    actions: [
      { en: 'Assign an owner to the contributing items', ar: 'عيّن مسؤولًا للبنود المساهمة', dept: 'Civil' },
      { en: 'Re-check this indicator in the weekly review', ar: 'أعد فحص المؤشر في المراجعة الأسبوعية', dept: 'Civil' },
      { en: 'Ask the Copilot for a deeper breakdown', ar: 'اطلب تحليلًا أعمق من المساعد الذكي', dept: 'Civil' },
    ],
    definition: ['Value comes from the live simulation engines at the current data date.', 'القيمة من محركات المحاكاة عند تاريخ البيانات الحالي.'],
  };
}

function ForecastChart({ s, simT, lang, showForecast, showPrev }: { s: KpiSeries; simT: number; lang: Lang; showForecast: boolean; showPrev: boolean }) {
  const p = useChartPalette();
  const option = useMemo(() => {
    const n = s.labels.length;
    const interval = Math.max(0, Math.ceil(n / 7) - 1);
    const tf = s.tf;
    const hist = s.actual;
    const col = p.violet;
    const band = s.upper.map((u, i) => (u != null && s.lower[i] != null ? u - (s.lower[i] as number) : null));
    return {
      animationDuration: 350,
      grid: { left: 8, right: 14, top: 14, bottom: 4, containLabel: true },
      tooltip: {
        trigger: 'axis',
        backgroundColor: p.surface,
        borderColor: p.line,
        textStyle: { color: p.text, fontSize: 12 },
        formatter: (ps: Array<{ dataIndex: number; axisValueLabel: string }>) => {
          const i = ps[0]?.dataIndex ?? 0;
          const past = i <= tf;
          const v = past ? hist[i] : s.forecast[i];
          const range = !past && showForecast && s.lower[i] != null ? ` <span style="opacity:.6">(${s.fmt(s.lower[i] as number)} - ${s.fmt(s.upper[i] as number)})</span>` : '';
          const prev = showPrev && past && s.previous[i] != null ? `<br/><span style="opacity:.6">${lang === 'ar' ? 'الفترة السابقة' : 'Previous'}: ${s.fmt(s.previous[i] as number)}</span>` : '';
          return `${ps[0]?.axisValueLabel}<br/><b>${v != null ? s.fmt(v) : '-'}</b>${range}${prev}`;
        },
      },
      xAxis: { type: 'category', data: s.labels, boundaryGap: false, axisLine: { lineStyle: { color: p.line } }, axisLabel: { color: p.muted, fontSize: 10.5, interval }, axisTick: { show: false } },
      yAxis: { type: 'value', scale: true, minInterval: s.step, splitLine: { lineStyle: { color: p.grid } }, axisLabel: { color: p.muted, fontSize: 10.5, formatter: (v: number) => s.fmt(v) } },
      series: [
        { name: 'lo', type: 'line', data: showForecast ? s.lower : [], stack: 'band', symbol: 'none', lineStyle: { opacity: 0 }, silent: true },
        { name: 'band', type: 'line', data: showForecast ? band : [], stack: 'band', symbol: 'none', lineStyle: { opacity: 0 }, areaStyle: { color: col, opacity: 0.16 }, silent: true },
        { name: 'previous', type: 'line', data: showPrev ? s.previous : [], symbol: 'none', smooth: true, lineStyle: { color: p.muted, width: 1.5, type: 'dotted' }, silent: true },
        {
          name: 'forecast',
          type: 'line',
          data: showForecast ? s.forecast : [],
          symbol: 'none',
          smooth: true,
          lineStyle: { color: col, width: 2.4, type: 'dashed' },
          markLine: { symbol: 'none', silent: true, label: { show: true, formatter: lang === 'ar' ? 'الآن' : 'NOW', color: p.muted, fontSize: 10 }, lineStyle: { color: p.muted, type: 'dotted' }, data: [{ xAxis: s.nowIndex }] },
        },
        { name: 'actual', type: 'line', data: hist, symbol: 'none', smooth: true, itemStyle: { color: p.info }, lineStyle: { color: p.info, width: 2.4 }, areaStyle: { color: p.info, opacity: 0.1 } },
      ],
    };
  }, [s, lang, p, showForecast, showPrev, simT]);
  return <Chart option={option} height={210} />;
}

function Toggle({ on, onChange, children, testId }: { on: boolean; onChange: (v: boolean) => void; children: string; testId?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      data-testid={testId}
      className="inline-flex items-center gap-1.5 h-8 rounded-lg border px-2.5 text-[12px] font-semibold transition-colors"
      style={on ? { borderColor: 'color-mix(in srgb, var(--violet) 55%, transparent)', background: 'color-mix(in srgb, var(--violet) 12%, transparent)', color: 'var(--violet)' } : { borderColor: 'var(--line-2)', color: 'var(--muted)' }}
    >
      <span className="size-3.5 rounded grid place-items-center border" style={{ borderColor: on ? 'var(--violet)' : 'var(--line-2)', background: on ? 'var(--violet-solid)' : 'transparent' }}>{on && <Check size={10} color="#fff" strokeWidth={3} />}</span>
      {children}
    </button>
  );
}

function ApplyRow({ a, lang, spec }: { a: Act; lang: Lang; spec: KpiSpec }) {
  const create = useWorkOrders((s) => s.create);
  const simT = useApp((s) => s.simT);
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle');
  const [woId, setWoId] = useState('');
  const apply = () => {
    setState('busy');
    window.setTimeout(() => {
      const wo = create({
        assetId: 'PMO',
        title: bi(a.en, a.ar),
        kind: 'CM',
        status: 'open',
        priority: spec.tone === 'bad' ? 'high' : 'med',
        createdT: simT,
        source: 'alert',
        department: a.dept,
        note: bi(`Raised from the AI advisory on KPI "${spec.label}" (${spec.value})`, `أُنشئ من الاستشارة الذكية للمؤشر "${spec.label}" (${spec.value})`),
      });
      setWoId(wo.id);
      setState('done');
    }, 650);
  };
  return (
    <div className="flex items-center gap-3 rounded-lg px-3 py-2" style={{ background: 'color-mix(in srgb, var(--violet) 7%, var(--surface))' }} data-testid="kpi-action">
      <div className="flex-1 min-w-0 text-[13px] leading-snug text-ink">
        {lang === 'ar' ? a.ar : a.en}
        {state === 'done' && <div className="text-[11.5px] mt-0.5" style={{ color: 'var(--good)' }}>{lang === 'ar' ? `أُنشئ ${woId} وأُرسل إلى ${a.dept}` : `${woId} created and routed to ${a.dept}`}</div>}
      </div>
      <button
        type="button"
        onClick={apply}
        disabled={state !== 'idle'}
        className="shrink-0 inline-flex items-center gap-1 h-8 rounded-lg px-3 text-[12px] font-bold transition disabled:opacity-90"
        style={state === 'done' ? { background: 'color-mix(in srgb, var(--good) 18%, transparent)', color: 'var(--good)' } : { background: 'var(--violet-solid)', color: 'var(--violet-solid-ink)' }}
        data-testid="kpi-apply"
      >
        {state === 'busy' ? <Loader2 size={13} className="ai-spin" /> : state === 'done' ? <Check size={13} /> : null}
        {state === 'done' ? (lang === 'ar' ? 'تم' : 'Applied') : lang === 'ar' ? 'تطبيق' : 'Apply'}
        {state === 'idle' && <ArrowRight size={13} className="flip-rtl" />}
      </button>
    </div>
  );
}

function Body({ spec }: { spec: KpiSpec }) {
  const lang = useApp((s) => s.lang) as Lang;
  const simT = useApp((s) => s.simT);
  const L = (en: string, ar: string) => (lang === 'ar' ? ar : en);
  const [tf, setTf] = useState<Timeframe>(30);
  const [showForecast, setShowForecast] = useState(true);
  const [showPrev, setShowPrev] = useState(true);
  const [run, setRun] = useState(0);
  const [phase, setPhase] = useState<'thinking' | 'ready'>('ready');
  const [first, setFirst] = useState(true);

  const s = useMemo(() => buildSeries(spec, lang, tf, (d) => fmtDate(simT + d, lang, 'short')), [spec, lang, tf, simT]);
  const topic = useMemo(() => topicFor(spec.label), [spec.label]);

  // the AI "re-runs" its forecast whenever the window changes or the button is pressed
  const rerun = () => {
    setPhase('thinking');
    setRun((r) => r + 1);
  };
  useEffect(() => {
    if (first) {
      setFirst(false);
      return;
    }
    if (showForecast) rerun();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tf]);

  const st = s?.stats;
  const tone = st ? (st.worsening ? 'bad' : st.improving ? 'good' : 'neutral') : 'neutral';
  const Icon = st && st.change < 0 ? TrendingDown : TrendingUp;
  const dTxt = (d: number) => (s?.kind === 'date' ? `${d > 0 ? '+' : ''}${d.toFixed(1)} ${L('d', 'ي')}` : `${d > 0 ? '+' : ''}${(d * 100).toFixed(1)}%`);
  const steps = [
    L(`Reading the last ${tf} days of data`, `قراءة بيانات آخر ${tf} يومًا`),
    L('Fitting trend and weekday pattern', 'مواءمة الاتجاه ونمط أيام الأسبوع'),
    L(`Projecting the next ${tf} days with a 95% band`, `توقع الأيام ${tf} القادمة بنطاق ثقة 95%`),
  ];
  const sentence = st && s ? (
    <>
      {L('Expected to be', 'من المتوقع أن يصبح')} <b className="num">{s.fmt(st.fEnd)}</b> {L(`in ${tf} days`, `خلال ${tf} يومًا`)}{' '}
      <span className="opacity-80">({s.fmt(st.lo)} - {s.fmt(st.hi)})</span>
      {st.worsening ? L(' - drifting the wrong way.', ' - اتجاه غير مرغوب.') : st.improving ? L(' - trending in the right direction.', ' - اتجاه إيجابي.') : L(' - broadly stable.', ' - مستقر إجمالًا.')}
    </>
  ) : null;

  return (
    <div className="space-y-4" data-testid="kpi-panel-body">
      <div>
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-[34px] leading-none font-semibold tracking-tight num" style={{ color: spec.tone === 'neutral' ? 'var(--text)' : toneVar[spec.tone] }}>{spec.value}</span>
          {spec.unit && <span className="text-[13px] text-dim">{spec.unit}</span>}
          {spec.delta && <Chip tone={spec.tone === 'neutral' ? 'info' : spec.tone}>{spec.delta}</Chip>}
        </div>
        {spec.hint && <div className="text-[12px] text-dim mt-1">{spec.hint}</div>}
      </div>

      {s && st ? (
        <>
          <div className="flex flex-wrap items-center gap-2" data-testid="kpi-filters">
            <Seg<Timeframe> size="sm" ariaLabel={L('Time frame in days', 'الإطار الزمني بالأيام')} value={tf} onChange={setTf} options={TIMEFRAMES.map((d) => ({ value: d, label: `${d}${L('D', 'ي')}`, title: L(`Last ${d} days and next ${d} days`, `آخر ${d} يومًا والـ${d} القادمة`) }))} />
            <Toggle on={showForecast} onChange={setShowForecast} testId="kpi-toggle-forecast">{L('Forecast', 'التوقع')}</Toggle>
            <Toggle on={showPrev} onChange={setShowPrev} testId="kpi-toggle-prev">{L('Compare previous', 'قارن بالسابق')}</Toggle>
          </div>

          <div className="rounded-xl border border-line px-3 pt-2.5 pb-2" style={{ background: 'var(--surface-2)' }}>
            <div className="flex items-center gap-3 mb-1">
              <div className="text-[11px] uppercase tracking-wider text-dim font-semibold flex-1">{L('Trend and prediction', 'الاتجاه والتوقع')}</div>
              <div className="flex items-center gap-3 text-[11px] text-dim">
                <span className="inline-flex items-center gap-1"><span className="inline-block w-4 border-t-2" style={{ borderColor: 'var(--info)' }} /> {L('Actual', 'الفعلي')}</span>
                {showPrev && <span className="inline-flex items-center gap-1"><span className="inline-block w-4 border-t-2 border-dotted" style={{ borderColor: 'var(--muted)' }} /> {L('Previous', 'السابق')}</span>}
                {showForecast && <span className="inline-flex items-center gap-1"><span className="inline-block w-4 border-t-2 border-dashed" style={{ borderColor: 'var(--violet)' }} /> {L('Forecast', 'التوقع')}</span>}
              </div>
            </div>
            <ForecastChart s={s} simT={simT} lang={lang} showForecast={showForecast} showPrev={showPrev} />
          </div>

          {showForecast && (
            <div className="grid grid-cols-3 gap-2.5" data-testid="kpi-stats">
              <div className="rounded-lg border border-line px-3 py-2">
                <div className="text-[18px] font-semibold num leading-tight" style={{ color: 'var(--violet)' }}>{s.fmt(st.fEnd)}</div>
                <div className="text-[11px] text-dim">{L(`Forecast · ${tf} days`, `التوقع · ${tf} يومًا`)}</div>
              </div>
              <div className="rounded-lg border border-line px-3 py-2">
                <div className="text-[18px] font-semibold num leading-tight">{st.band}</div>
                <div className="text-[11px] text-dim">{L(`95% range · ${st.confidence}% conf.`, `نطاق 95% · ثقة ${st.confidence}%`)}</div>
              </div>
              <div className="rounded-lg border border-line px-3 py-2">
                <div className="text-[18px] font-semibold num leading-tight inline-flex items-center gap-1" style={{ color: tone === 'neutral' ? 'var(--text)' : toneVar[tone] }}>
                  <Icon size={15} /> <bdi>{dTxt(st.change)}</bdi>
                </div>
                <div className="text-[11px] text-dim">{L('vs today', 'مقارنة باليوم')}</div>
              </div>
            </div>
          )}

          <AiPanel
            title={L('AI advisory', 'استشارة الذكاء الاصطناعي')}
            glow={phase === 'thinking'}
            actions={
              <button
                type="button"
                onClick={rerun}
                disabled={phase === 'thinking'}
                className="inline-flex items-center gap-1 h-7 rounded-lg px-2.5 text-[11.5px] font-bold disabled:opacity-60"
                style={{ background: 'var(--violet-solid)', color: 'var(--violet-solid-ink)' }}
                data-testid="kpi-run-forecast"
              >
                {phase === 'thinking' ? <Loader2 size={12} className="ai-spin" /> : <RotateCw size={12} />}
                {L('Forecast', 'توقع')}
              </button>
            }
          >
            {phase === 'thinking' ? (
              <AiSteps steps={steps} runKey={run} stepMs={380} onDone={() => setPhase('ready')} compact />
            ) : (
              <div className="space-y-3.5 ai-pop">
                <p className="m-0 text-[15px] leading-snug font-semibold">{sentence}</p>
                <div>
                  <div className="text-[11px] uppercase tracking-wider font-bold opacity-80 mb-1">{L('Drivers', 'المحركات')}</div>
                  <ul className="m-0 ps-5 list-disc marker:text-[var(--violet)] space-y-0.5 text-[13.5px]">
                    {topic.drivers.map((d) => (
                      <li key={d[0]}>{lang === 'ar' ? d[1] : d[0]}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-wider font-bold opacity-80 mb-1.5">{L('Recommended actions', 'الإجراءات الموصى بها')}</div>
                  <div className="space-y-1.5">
                    {topic.actions.map((a) => (
                      <ApplyRow key={a.en} a={a} lang={lang} spec={spec} />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </AiPanel>
          <div className="flex items-start gap-2 text-[12px] text-dim leading-snug">
            <Info size={14} className="shrink-0 mt-0.5" />
            <span>
              <b className="text-muted">{L('Definition', 'التعريف')}</b> · {lang === 'ar' ? topic.definition[1] : topic.definition[0]}
            </span>
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
      width={520}
      title={
        <span className="inline-flex items-center gap-2">
          <Sparkles size={15} style={{ color: 'var(--violet)' }} />
          {spec?.label ?? ''}
        </span>
      }
      subtitle={L('KPI detail · day filter, forecast and AI advisory', 'تفاصيل المؤشر · فلتر الأيام والتوقع والاستشارة الذكية')}
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
              className={cx('!border-[color-mix(in_srgb,var(--violet)_55%,transparent)]')}
              style={{ color: 'var(--violet)' }}
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
      {spec && <Body key={spec.label + spec.value} spec={spec} />}
    </Drawer>
  );
}
