import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, ArrowRight, CheckCircle2, ChevronRight, CloudSun, HardHat, Sparkles, Ticket, Truck, Wrench } from 'lucide-react';
import { Drawer } from '../../design/Drawer';
import { Btn, Chip, Dot, toneVar, type Tone } from '../../design/ui';
import { AiBar, AiPanel, AiSteps } from './kit';
import { useActionPanel } from './actionStore';
import { useApp } from '../../app/store';
import { usePack, useSnapshot } from '../../sim/useSim';
import type { Alarm, Snapshot } from '../../sim/types';
import type { ProjectPack } from '../../engine/types';
import { bi, tx } from '../../lib/bi';
import { fmtDate, fmtPct, type Lang } from '../../lib/fmt';
import { useWorkOrders, type WoKind } from '../assets/woStore';
import { useIntegration } from '../workorders/integrationStore';
import { StatusChip } from '../workorders/parts';

const SEV: Record<Alarm['severity'], Tone> = { crit: 'bad', warn: 'warn', info: 'info' };
const ICON = { asset: <Wrench size={14} />, po: <Truck size={14} />, schedule: <AlertTriangle size={14} />, hse: <HardHat size={14} />, weather: <CloudSun size={14} /> };

interface Explain {
  steps: string[];
  what: string;
  why: string[];
  next: string[];
  dept: string;
  priority: 'high' | 'med' | 'low';
  kind: WoKind;
  woTitle: { en: string; ar: string };
  goto: { label: string; to: string };
}

/** Every number below comes from the live snapshot; the wording is templated (no LLM) */
function explain(a: Alarm, snap: Snapshot, pack: ProjectPack, lang: Lang): Explain {
  const L = (en: string, ar: string) => (lang === 'ar' ? ar : en);
  const alarmText = tx(a.text, lang);
  if (a.source === 'asset') {
    const row = snap.assets.find((x) => x.id === a.ref);
    const def = pack.assets.find((x) => x.id === a.ref);
    const r = row?.report;
    const ch = def?.channels.find((c) => c.id === r?.degradingChannel) ?? def?.channels.find((c) => c.id === r?.explanation[0]?.channelId);
    const chName = (tx(ch?.name, lang) || L('a sensor channel', 'قناة استشعار')).toLowerCase();
    const top = r?.explanation[0];
    const ratio = top && top.expected > 0 ? top.value / top.expected : null;
    const rul = r?.rulDays != null ? Math.round(r.rulDays) : null;
    const failT = r?.failT ?? snap.nowT + 21;
    return {
      steps: [L('Reading the alert and the unit\'s last 30 days of telemetry', 'قراءة التنبيه وقياسات آخر 30 يومًا للوحدة'), L('Scoring each sensor channel against its normal band', 'تقييم كل قناة استشعار مقابل نطاقها الطبيعي'), L('Estimating remaining life and probability of failure', 'تقدير العمر المتبقي واحتمال العطل'), L('Checking the schedule and spares impact', 'فحص الأثر على الجدول وقطع الغيار')],
      what: L(
        `${a.ref}${def ? ` (${tx(def.name, lang)})` : ''} is flagged: health ${Math.round(r?.health ?? 0)}/100 and a ${fmtPct(r?.p14 ?? 0, lang)} chance of failing within 14 days.`,
        `${a.ref}${def ? ` (${tx(def.name, lang)})` : ''} مُعلَّمة: الصحة ${Math.round(r?.health ?? 0)}/100 واحتمال العطل خلال 14 يومًا ${fmtPct(r?.p14 ?? 0, lang)}.`,
      ),
      why: [
        L(`${chName} is ${ratio ? `${ratio.toFixed(1)}x its expected level` : 'trending out of its normal band'}`, `${chName} ${ratio ? `يبلغ ${ratio.toFixed(1)} ضعف المستوى المتوقع` : 'يخرج عن نطاقه الطبيعي'}`),
        rul != null ? L(`At the current trend about ${rul} days of life remain (failure around ${fmtDate(failT, lang, 'short')})`, `بحسب الاتجاه الحالي يتبقى نحو ${rul} يومًا (العطل نحو ${fmtDate(failT, lang, 'short')})`) : L('A degradation trend is detected but no failure date is predicted yet', 'رُصد اتجاه تدهور دون تحديد موعد عطل بعد'),
        L(`Preventive-maintenance compliance is ${fmtPct(r?.pmCompliance ?? 0, lang)}`, `الالتزام بالصيانة الوقائية ${fmtPct(r?.pmCompliance ?? 0, lang)}`),
      ],
      next: [
        L('Raise an inspection work order now (one click below)', 'أنشئ أمر فحص الآن (بنقرة واحدة أدناه)'),
        L(`Book a ${def?.serviceDays ?? 2}-day planned service before ${fmtDate(failT, lang, 'short')} instead of a ${def?.repairDays ?? 6}-day in-service repair`, `احجز صيانة مخططة ${def?.serviceDays ?? 2} يوم قبل ${fmtDate(failT, lang, 'short')} بدل إصلاح ${def?.repairDays ?? 6} أيام أثناء التشغيل`),
        L('Order the long-lead spare today and protect the service window on the schedule', 'اطلب قطعة الغيار طويلة التوريد اليوم واحمِ نافذة الصيانة في الجدول'),
      ],
      dept: 'Plant & Equipment',
      priority: a.severity === 'crit' ? 'high' : 'med',
      kind: 'PdM',
      woTitle: bi(`${a.ref}: inspect ${chName} and book planned service (AI alert)`, `${a.ref}: فحص ${chName} وحجز صيانة مخططة (تنبيه ذكي)`),
      goto: { label: L('Open asset', 'افتح الأصل'), to: `/assets?asset=${a.ref}` },
    };
  }
  if (a.source === 'po') {
    const po = snap.pos.find((x) => x.id === a.ref);
    const mat = pack.materials.find((m) => m.id === po?.materialId);
    const sup = pack.suppliers.find((s) => s.id === po?.supplierId);
    return {
      steps: [L('Tracing the purchase order through its shipping route', 'تتبع أمر الشراء عبر مسار الشحن'), L('Comparing the ETA with the need-by date of the activity it feeds', 'مقارنة موعد الوصول بتاريخ الحاجة للنشاط المرتبط'), L('Checking chokepoint exposure and supplier history', 'فحص التعرض لنقاط الاختناق وسجل المورد'), L('Costing the recovery options', 'تقدير تكلفة خيارات التعافي')],
      what: L(`${a.ref}${mat ? ` - ${tx(mat.name, lang)}` : ''} has only ${Math.max(0, Math.round(po?.floatDays ?? 0))} days of float between arrival and need-by.`, `${a.ref}${mat ? ` - ${tx(mat.name, lang)}` : ''} هامشه ${Math.max(0, Math.round(po?.floatDays ?? 0))} يومًا فقط بين الوصول وتاريخ الحاجة.`),
      why: [
        po?.chokepointExposed ? L('The route passes a chokepoint that is exposed to disruption', 'المسار يمر بنقطة اختناق معرّضة للتعطل') : L('Shipping time has drifted against the plan', 'زمن الشحن انحرف عن الخطة'),
        sup ? L(`${sup.name} delivers on time ${fmtPct(sup.onTime, lang)} of the time`, `${sup.name} يلتزم بالموعد ${fmtPct(sup.onTime, lang)} من الحالات`) : L('Supplier history is thin', 'سجل المورد محدود'),
        L(`Forecast slip so far: ${Math.round(po?.slipDays ?? 0)} days`, `التأخر المتوقع حتى الآن: ${Math.round(po?.slipDays ?? 0)} يومًا`),
      ],
      next: [L('Ask the supplier to expedite and confirm a firm ETD', 'اطلب من المورد التعجيل وتأكيد موعد الشحن'), L('Get a quote for the alternative route or a partial air shipment', 'احصل على عرض للمسار البديل أو شحنة جوية جزئية'), L('Raise an expediting ticket for the procurement team (below)', 'أنشئ تذكرة متابعة لفريق المشتريات (أدناه)')],
      dept: 'Procurement',
      priority: a.severity === 'crit' ? 'high' : 'med',
      kind: 'CM',
      woTitle: bi(`${a.ref}: expedite delivery - low float${mat ? ` (${tx(mat.name, 'en')})` : ''}`, `${a.ref}: تعجيل التوريد - هامش منخفض${mat ? ` (${tx(mat.name, 'ar')})` : ''}`),
      goto: { label: L('Open procurement', 'افتح المشتريات'), to: '/procurement' },
    };
  }
  if (a.source === 'schedule') {
    const names = snap.criticalPath
      .map((id) => pack.activities[snap.forecast.idx.get(id)!])
      .filter((x) => x && x.kind === 'task' && snap.forecast.ef[snap.forecast.idx.get(x.id)!] > snap.nowT)
      .slice(0, 3)
      .map((x) => tx(x.name, lang));
    return {
      steps: [L('Re-running the schedule from the data date', 'إعادة تشغيل الجدول من تاريخ البيانات'), L('Finding the critical path and the activities driving the slip', 'تحديد المسار الحرج والأنشطة المسببة للتأخر'), L('Ranking recovery levers by days recovered per dirham', 'ترتيب خيارات التعافي حسب الأيام المستردة لكل درهم')],
      what: alarmText,
      why: names.length ? [L(`Critical path now runs through: ${names.join('; ')}`, `المسار الحرج يمر الآن عبر: ${names.join('؛ ')}`), L('Late material and equipment availability are consuming float', 'تأخر المواد والمعدات يستهلك الهامش')] : [L('Float on the critical path has been consumed', 'استُهلك هامش المسار الحرج')],
      next: [L('Review the recovery options in the Schedule and What-If pages', 'راجع خيارات التعافي في صفحتي الجدول وماذا-لو'), L('Resequence non-critical work to free crews for the critical activities', 'أعد ترتيب الأعمال غير الحرجة لتحرير الفرق للأنشطة الحرجة'), L('Raise a planning ticket for the recovery workshop (below)', 'أنشئ تذكرة تخطيط لورشة التعافي (أدناه)')],
      dept: 'Civil',
      priority: a.severity === 'crit' ? 'high' : 'med',
      kind: 'CM',
      woTitle: bi('Schedule recovery workshop - forecast completion slipping', 'ورشة تعافي الجدول - تأخر الإنجاز المتوقع'),
      goto: { label: L('Open schedule', 'افتح الجدول'), to: '/schedule' },
    };
  }
  if (a.source === 'hse') {
    return {
      steps: [L('Reading the camera event and its zone rule', 'قراءة حدث الكاميرا وقاعدة المنطقة'), L('Checking the live lift plan and permits in that zone', 'فحص خطة الرفع والتصاريح الحية في المنطقة'), L('Drafting the stop-work step for the supervisor', 'صياغة خطوة إيقاف العمل للمشرف')],
      what: alarmText,
      why: [L('The vision model matched a person / vehicle against an active exclusion-zone rule', 'طابق نموذج الرؤية شخصًا / مركبة مع قاعدة منطقة حظر نشطة'), L('A lift permit is open in the same zone', 'يوجد تصريح رفع مفتوح في المنطقة نفسها')],
      next: [L('Pause the lift and clear the zone', 'أوقف الرفع وأخلِ المنطقة'), L('Brief the crew and log the observation', 'أطلع الفريق وسجّل الملاحظة'), L('Raise an HSE follow-up ticket (below)', 'أنشئ تذكرة متابعة للسلامة (أدناه)')],
      dept: 'HSE',
      priority: 'high',
      kind: 'INSP',
      woTitle: bi(`${a.ref}: exclusion-zone breach - supervisor follow-up`, `${a.ref}: اختراق منطقة الحظر - متابعة المشرف`),
      goto: { label: L('Open HSE & CCTV', 'افتح السلامة والكاميرات'), to: '/hse' },
    };
  }
  return {
    steps: [L('Reading the 48 hour site forecast', 'قراءة توقعات الموقع لـ48 ساعة'), L('Matching gusts to the crane and lifting limits', 'مطابقة الهبات مع حدود الرافعات والرفع'), L('Finding the safe working windows', 'تحديد نوافذ العمل الآمنة')],
    what: alarmText,
    why: [L('Gusts are close to the crane operating limit', 'الهبات قريبة من حد تشغيل الرافعة'), L('The heavy lifts planned this afternoon are the most sensitive', 'الرفعات الثقيلة المخططة بعد الظهر هي الأكثر حساسية')],
    next: [L('Move heavy lifts to the early-morning window', 'انقل الرفعات الثقيلة إلى نافذة الصباح الباكر'), L('Brief the lift supervisors on the wind limit', 'أطلع مشرفي الرفع على حد الرياح'), L('Raise a lift-planning ticket (below)', 'أنشئ تذكرة تخطيط الرفع (أدناه)')],
    dept: 'Plant & Equipment',
    priority: 'low',
    kind: 'INSP',
    woTitle: bi('Re-plan afternoon lifts around the wind limit', 'إعادة تخطيط رفعات بعد الظهر وفق حد الرياح'),
    goto: { label: L('Open What-If', 'افتح ماذا-لو'), to: '/whatif/calendar' },
  };
}

const analysed = new Set<string>();

function Detail({ alarm, snap }: { alarm: Alarm; snap: Snapshot }) {
  const lang = useApp((s) => s.lang);
  const simT = useApp((s) => s.simT);
  const L = (en: string, ar: string) => (lang === 'ar' ? ar : en);
  const pack = usePack();
  const nav = useNavigate();
  const close = useActionPanel((s) => s.close);
  const ex = useMemo(() => explain(alarm, snap, pack, lang), [alarm, snap, pack, lang]);
  const [done, setDone] = useState(analysed.has(alarm.id));
  useEffect(() => setDone(analysed.has(alarm.id)), [alarm.id]);
  const wos = useWorkOrders((s) => s.list);
  const create = useWorkOrders((s) => s.create);
  const wo = wos.find((w) => w.alarmId === alarm.id);
  const ticket = useIntegration((s) => (wo ? s.tickets.find((t) => t.woId === wo.id) : undefined));
  const system = useIntegration((s) => (ticket ? s.integrations.find((i) => i.id === ticket.system) : undefined));
  const makeTicket = () => {
    create({ assetId: alarm.ref, title: ex.woTitle, kind: ex.kind, status: 'open', priority: ex.priority, createdT: simT, source: 'alert', department: ex.dept, alarmId: alarm.id, note: bi(`Raised from the AI alert: ${tx(alarm.text, 'en')}`, `أُنشئ من تنبيه ذكي: ${tx(alarm.text, 'ar')}`) });
  };
  const steps = useMemo(() => ex.steps, [ex.steps]);
  return (
    <div className="space-y-3.5" data-testid="alert-detail">
      <div className="flex items-start gap-2">
        <span className="mt-0.5" style={{ color: toneVar[SEV[alarm.severity]] }}>{ICON[alarm.source]}</span>
        <div className="min-w-0">
          <Chip tone={SEV[alarm.severity]} dot>{alarm.severity === 'crit' ? L('Critical', 'حرج') : alarm.severity === 'warn' ? L('Warning', 'تحذير') : L('Info', 'معلومة')}</Chip>
          <div className="text-[14px] font-semibold leading-snug mt-1.5">{tx(alarm.text, lang)}</div>
          <div className="text-[11.5px] text-dim">{alarm.ref} - {fmtDate(alarm.t, lang, 'short')}</div>
        </div>
      </div>

      {!done && (
        <AiPanel title={L('AI is analysing the alert', 'الذكاء الاصطناعي يحلل التنبيه')} glow>
          <AiBar className="mb-2" />
          <AiSteps
            steps={steps}
            runKey={alarm.id}
            stepMs={430}
            onDone={() => {
              analysed.add(alarm.id);
              setDone(true);
            }}
          />
        </AiPanel>
      )}

      {done && (
        <div className="space-y-3 ai-pop">
          <AiPanel title={L('What happened', 'ما الذي حدث')}>
            <p className="m-0 text-[13px] leading-snug">{ex.what}</p>
          </AiPanel>
          <section>
            <div className="text-[11px] uppercase tracking-wider text-dim mb-1">{L('Why it happened', 'لماذا حدث')}</div>
            <ul className="m-0 ps-4 text-[12.5px] text-muted space-y-1">{ex.why.map((w) => <li key={w}>{w}</li>)}</ul>
          </section>
          <section className="rounded-lg border border-line bg-surface-2 px-3 py-2.5">
            <div className="text-[11px] uppercase tracking-wider text-dim mb-1">{L('What to do next', 'ماذا نفعل الآن')}</div>
            <ol className="m-0 ps-4 text-[12.5px] space-y-1">{ex.next.map((n) => <li key={n}>{n}</li>)}</ol>
          </section>

          <section className="rounded-lg border px-3 py-2.5" style={{ borderColor: wo ? 'color-mix(in srgb, var(--good) 55%, var(--line))' : 'var(--line)' }} data-testid="ticket-box">
            {!wo ? (
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-[12.5px] font-semibold">{L('Create a ticket for this alert', 'أنشئ تذكرة لهذا التنبيه')}</div>
                  <div className="text-[11.5px] text-dim">{L(`Routed to ${ex.dept} - synced to the connected ticketing tool`, `تُوجَّه إلى ${ex.dept} - وتُزامَن مع أداة التذاكر المتصلة`)}</div>
                </div>
                <Btn variant="primary" onClick={makeTicket} data-testid="create-ticket">
                  <Ticket size={14} /> {L('Create ticket', 'إنشاء تذكرة')}
                </Btn>
              </div>
            ) : (
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-[12.5px] font-semibold" style={{ color: 'var(--good)' }}>
                  <CheckCircle2 size={15} /> {L(`Ticket ${wo.id} created`, `تم إنشاء التذكرة ${wo.id}`)}
                </div>
                {ticket ? (
                  <div className="text-[12px] text-muted flex flex-wrap items-center gap-x-2 gap-y-1" data-testid="ticket-sync">
                    <span>{L('Synced to', 'مزامنة مع')} <b className="text-ink">{system?.name ?? ticket.system}</b></span>
                    <Chip tone="neutral">{ticket.externalRef}</Chip>
                    <StatusChip status={ticket.status} />
                    <span className="text-dim">{L('assigned to', 'مسندة إلى')} {ticket.assignee}</span>
                  </div>
                ) : (
                  <div className="text-[12px] text-dim">{L('Syncing to the ticketing tool...', 'جارٍ المزامنة مع أداة التذاكر...')}</div>
                )}
                <Btn
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    close();
                    nav(`/workorders?wo=${wo.id}`);
                  }}
                  data-testid="view-in-wo"
                >
                  {L('View in Work Orders', 'عرض في أوامر العمل')} <ArrowRight size={13} className="flip-rtl" />
                </Btn>
              </div>
            )}
          </section>

          <Btn
            variant="ghost"
            size="sm"
            onClick={() => {
              close();
              nav(ex.goto.to);
            }}
          >
            {ex.goto.label} <ChevronRight size={13} className="flip-rtl" />
          </Btn>
        </div>
      )}
    </div>
  );
}

function List({ snap }: { snap: Snapshot }) {
  const lang = useApp((s) => s.lang);
  const show = useActionPanel((s) => s.show);
  const L = (en: string, ar: string) => (lang === 'ar' ? ar : en);
  const wos = useWorkOrders((s) => s.list);
  const items = snap.alarms.slice(0, 8);
  return (
    <div className="space-y-2.5" data-testid="action-list">
      <p className="m-0 text-[12.5px] text-muted">{L('The AI ranked what needs a decision today. Open one to see what happened, why, and what to do - then raise a ticket in one click.', 'رتّب الذكاء الاصطناعي ما يحتاج قرارًا اليوم. افتح أي بند لترى ما حدث ولماذا وماذا تفعل - ثم أنشئ تذكرة بنقرة واحدة.')}</p>
      {items.map((a) => {
        const has = wos.some((w) => w.alarmId === a.id);
        return (
          <button key={a.id} type="button" onClick={() => show(a.id)} className="w-full text-start rounded-lg border border-line px-3 py-2 hover:bg-surface-2 transition-colors flex gap-2.5 items-start" data-testid="action-item">
            <span className="mt-0.5" style={{ color: toneVar[SEV[a.severity]] }}>{ICON[a.source]}</span>
            <span className="min-w-0 flex-1">
              <span className="block text-[12.5px] leading-snug">{tx(a.text, lang)}</span>
              <span className="block text-[11px] text-dim">{a.ref}{has ? ` - ${L('ticket raised', 'تم إنشاء تذكرة')}` : ''}</span>
            </span>
            <Dot tone={SEV[a.severity]} pulse={a.severity === 'crit' && !has} />
          </button>
        );
      })}
    </div>
  );
}

export function ActionPanel() {
  const { open, alarmId, close, back } = useActionPanel();
  const lang = useApp((s) => s.lang);
  const L = (en: string, ar: string) => (lang === 'ar' ? ar : en);
  return (
    <Drawer
      open={open}
      onClose={close}
      testId="action-panel"
      width={480}
      title={
        <span className="inline-flex items-center gap-1.5">
          {alarmId && (
            <button type="button" onClick={back} className="text-dim hover:text-ink -ms-1 p-0.5" aria-label="Back">
              <ArrowLeft size={16} className="flip-rtl" />
            </button>
          )}
          <Sparkles size={15} style={{ color: 'var(--violet)' }} />
          {alarmId ? L('Alert explained', 'شرح التنبيه') : L('AI recommended actions', 'إجراءات مقترحة من الذكاء الاصطناعي')}
        </span>
      }
      subtitle={L('Explain - decide - ticket', 'اشرح - قرّر - أنشئ تذكرة')}
    >
      {open && <PanelBody alarmId={alarmId} />}
    </Drawer>
  );
}

function PanelBody({ alarmId }: { alarmId: string | null }) {
  const snap = useSnapshot();
  const alarm = alarmId ? snap.alarms.find((a) => a.id === alarmId) : undefined;
  if (alarm) return <Detail alarm={alarm} snap={snap} />;
  return <List snap={snap} />;
}
