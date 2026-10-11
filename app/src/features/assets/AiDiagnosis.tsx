import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Stethoscope } from 'lucide-react';
import { Btn } from '../../design/ui';
import { fmtDate, fmtDays, fmtPct, type Lang } from '../../lib/fmt';
import { tx } from '../../lib/bi';
import type { Asset } from '../../engine/types';
import type { AssetRow } from '../../sim/types';
import { AiBar, AiPanel, AiSteps, Typed } from '../ai/kit';

/** AI diagnosis: animated reasoning trace, the failure-probability curve drawing itself, and a typed explanation */
export function AiDiagnosis({ asset, row, simT }: { asset: Asset; row: AssetRow; simT: number }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Lang;
  const L = (en: string, ar: string) => (lang === 'ar' ? ar : en);
  const r = row.report;
  const flagged = r.status !== 'good' || r.p14 > 0.05;
  const [phase, setPhase] = useState<'idle' | 'steps' | 'typing' | 'done'>('idle');
  const [run, setRun] = useState(0);

  // restart whenever a different asset is opened
  useEffect(() => {
    setPhase(flagged ? 'steps' : 'idle');
    setRun((x) => x + 1);
  }, [asset.id, flagged]);

  const ch = (id?: string | null) => asset.channels.find((c) => c.id === id);
  const top = r.explanation[0];
  const second = r.explanation[1];
  const n1 = tx(ch(top?.channelId)?.name, lang);
  const n2 = tx(ch(second?.channelId)?.name, lang);
  const text = useMemo(() => {
    if (!flagged) {
      return L(
        `No degradation trend across ${asset.channels.length} sensor channels in the last 30 days. Health ${Math.round(r.health)}/100; next planned service in ${Math.max(0, Math.round(asset.pm.intervalHrs - (asset.hours - asset.pm.lastDoneHrs)))} running hours.`,
        `لا يوجد اتجاه تدهور في ${asset.channels.length} قنوات استشعار خلال 30 يومًا. الصحة ${Math.round(r.health)}/100؛ الصيانة الدورية القادمة بعد ${Math.max(0, Math.round(asset.pm.intervalHrs - (asset.hours - asset.pm.lastDoneHrs)))} ساعة تشغيل.`,
      );
    }
    const rul = r.rulDays != null ? Math.round(r.rulDays) : null;
    return L(
      `${n1 || 'A sensor channel'} is trending out of its normal band and carries ${fmtPct(top?.share ?? 0, lang)} of the risk signal${n2 ? `, corroborated by ${n2} (${fmtPct(second!.share, lang)})` : ''}. The pattern matches early-stage wear. The model estimates ${rul != null ? `${rul} days of remaining life` : 'a degrading trend'} with a ${fmtPct(r.p14, lang)} chance of failure inside 14 days.\n\nRecommended: inspect within 5 days and book a service window${r.failT != null ? ` before ${fmtDate(r.failT, lang)}` : ''} - a planned stop costs about a day, an in-service failure many times more.${asset.type === 'crawler-crane' ? ` Spare SP-1101 (hoist gearbox bearing set) has a 21-day lead time${rul != null && rul < 21 ? ', longer than the remaining life - order it today' : ''}.` : ''}`,
      `${n1 || 'قناة استشعار'} تخرج من نطاقها الطبيعي وتحمل ${fmtPct(top?.share ?? 0, lang)} من إشارة الخطر${n2 ? `، وتؤكدها ${n2} (${fmtPct(second!.share, lang)})` : ''}. النمط يطابق تآكلًا في مرحلة مبكرة. يقدّر النموذج ${rul != null ? `عمرًا متبقيًا ${rul} يومًا` : 'اتجاه تدهور'} واحتمال عطل ${fmtPct(r.p14, lang)} خلال 14 يومًا.\n\nالتوصية: الفحص خلال 5 أيام وحجز نافذة صيانة${r.failT != null ? ` قبل ${fmtDate(r.failT, lang)}` : ''} - التوقف المخطط يكلف نحو يوم واحد والعطل أثناء التشغيل أضعاف ذلك.${asset.type === 'crawler-crane' ? ` قطعة الغيار SP-1101 (طقم محامل علبة تروس الرفع) مدة توريدها 21 يومًا${rul != null && rul < 21 ? '، أطول من العمر المتبقي - اطلبها اليوم' : ''}.` : ''}`,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asset.id, r, lang, flagged]);

  const steps = [
    L(`Reading 30 days of telemetry (${asset.channels.length} channels)`, `قراءة 30 يومًا من القياسات (${asset.channels.length} قنوات)`),
    L('Comparing against the healthy baseline for this model', 'المقارنة بخط الأساس السليم لهذا الطراز'),
    L('Fitting the degradation curve, estimating remaining life', 'مواءمة منحنى التدهور وتقدير العمر المتبقي'),
    L('Attributing the risk to sensor channels', 'إسناد الخطر إلى قنوات الاستشعار'),
  ];
  const W = 300;
  const H = 64;
  const pts = r.failProb.map((p, i) => [(i / Math.max(1, r.failProb.length - 1)) * W, H - 4 - p * (H - 10)] as const);
  const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const x14 = (13 / Math.max(1, r.failProb.length - 1)) * W;
  void simT;
  return (
    <AiPanel
      className="mt-3"
      title={t('asset.ai.title')}
      glow={phase === 'steps'}
      actions={
        <Btn
          size="sm"
          variant={phase === 'idle' ? 'primary' : 'soft'}
          icon={<Stethoscope size={13} />}
          disabled={phase === 'steps' || phase === 'typing'}
          onClick={() => {
            setPhase('steps');
            setRun((x) => x + 1);
          }}
          data-testid="ai-diagnose-btn"
        >
          {phase === 'idle' ? t('asset.ai.run') : t('asset.ai.rerun')}
        </Btn>
      }
    >
      {phase === 'idle' && <div className="text-[12px] text-dim">{t('asset.ai.hint')}</div>}
      {phase === 'steps' && (
        <div className="space-y-2">
          <AiBar />
          <AiSteps steps={steps} runKey={run} stepMs={520} compact onDone={() => setPhase('typing')} />
        </div>
      )}
      {(phase === 'typing' || phase === 'done') && (
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_300px] items-start" data-testid="ai-diagnosis">
          <p className="m-0 text-[12.5px] leading-relaxed whitespace-pre-line">{phase === 'done' ? text : <Typed text={text} cps={200} onDone={() => setPhase('done')} />}</p>
          {flagged && (
            <div dir="ltr">
              <div className="text-[10.5px] uppercase tracking-wider text-dim mb-0.5">{t('asset.ai.curve')}</div>
              <svg viewBox={`0 0 ${W} ${H + 14}`} className="w-full" role="img" aria-label="failure probability">
                <line x1={0} x2={W} y1={H - 4} y2={H - 4} stroke="var(--line-2)" />
                <line x1={x14} x2={x14} y1={2} y2={H - 4} stroke="var(--warn)" strokeDasharray="3 3" />
                <text x={x14} y={H + 9} fontSize={9} textAnchor="middle" fill="var(--warn)">14 d</text>
                <text x={0} y={H + 9} fontSize={9} fill="var(--dim)">1 d</text>
                <text x={W} y={H + 9} fontSize={9} textAnchor="end" fill="var(--dim)">30 d</text>
                <path d={`${d} L${W},${H - 4} L0,${H - 4} Z`} fill="var(--bad)" opacity={0.12} />
                <path d={d} fill="none" stroke="var(--bad)" strokeWidth={2} strokeLinecap="round" className="ai-draw" style={{ ['--len' as string]: 700 }} />
              </svg>
              <div className="text-[11px] text-dim">
                {t('twin.asset.p14')}: <span className="num font-medium" style={{ color: 'var(--bad)' }}>{fmtPct(r.p14, lang)}</span>
                {r.rulDays != null && <> - {t('asset.rul')} {fmtDays(r.rulDays, lang)}</>}
              </div>
            </div>
          )}
        </div>
      )}
    </AiPanel>
  );
}
