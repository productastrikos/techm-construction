import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Radar } from 'lucide-react';
import { Btn, Chip, toneVar } from '../../design/ui';
import { fmtAed, fmtDays, type Lang } from '../../lib/fmt';
import { tx } from '../../lib/bi';
import { routeOptions } from '../../engine/routes';
import type { ProjectPack } from '../../engine/types';
import type { Snapshot } from '../../sim/types';
import { AiBar, AiPanel, AiSteps } from '../ai/kit';
import { useProc, type ProcRow } from './model';

/** "AI supply-risk scan": sweeps down the PO register row by row, then lists the findings with a concrete recommendation each. */
export function AiScan({ rows, pack, snap }: { rows: ProcRow[]; pack: ProjectPack; snap: Snapshot }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Lang;
  const L = (en: string, ar: string) => (lang === 'ar' ? ar : en);
  const select = useProc((s) => s.select);
  const setScan = useProc((s) => s.setScan);
  const [phase, setPhase] = useState<'idle' | 'scan' | 'done'>('idle');
  const [run, setRun] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const open = useMemo(() => rows.filter((r) => r.row.stage < 6).sort((a, b) => a.floatDays - b.floatDays), [rows]);

  const findings = useMemo(
    () =>
      open
        .filter((r) => r.risk === 'risk' || r.risk === 'late' || r.row.chokepointExposed)
        .slice(0, 3)
        .map((r) => {
          const opts = routeOptions(pack, r.po, snap.nowT, null)
            .filter((o) => !o.blocked && o.route.id !== r.po.routeId && o.deltaDays < -0.5)
            .sort((a, b) => a.deltaDays - b.deltaDays);
          return { r, best: opts[0] };
        }),
    [open, pack, snap.nowT],
  );

  useEffect(
    () => () => {
      if (timer.current) clearInterval(timer.current);
      setScan(null);
    },
    [setScan],
  );

  const start = () => {
    setPhase('scan');
    setRun((x) => x + 1);
    const seq = open.slice(0, 16);
    let i = 0;
    if (timer.current) clearInterval(timer.current);
    timer.current = setInterval(() => {
      setScan(seq[i]?.po.id ?? null);
      i++;
      if (i > seq.length) {
        if (timer.current) clearInterval(timer.current);
        setScan(null);
        setPhase('done');
      }
    }, 210);
  };

  const steps = [
    L(`Reading ${rows.length} purchase orders and their shipping legs`, `قراءة ${rows.length} أمر شراء ومراحل شحنها`),
    L('Joining each delivery to the activity it feeds', 'ربط كل توريد بالنشاط الذي يغذيه'),
    L('Stress-testing routes against the sea chokepoint', 'اختبار المسارات أمام نقطة الاختناق البحرية'),
    L('Searching alternative routes and suppliers', 'البحث عن مسارات وموردين بدلاء'),
  ];
  return (
    <AiPanel
      className="mt-3"
      title={t('proc.ai.title')}
      glow={phase === 'scan'}
      actions={
        <Btn size="sm" variant={phase === 'idle' ? 'primary' : 'soft'} icon={<Radar size={13} />} onClick={start} disabled={phase === 'scan'} data-testid="ai-scan-btn">
          {phase === 'idle' ? t('proc.ai.run') : t('proc.ai.rerun')}
        </Btn>
      }
    >
      {phase === 'idle' && <div className="text-[12px] text-dim">{t('proc.ai.hint')}</div>}
      {phase === 'scan' && (
        <div className="space-y-2">
          <AiBar />
          <AiSteps steps={steps} runKey={run} stepMs={650} compact />
        </div>
      )}
      {phase === 'done' && (
        <div className="ai-pop" data-testid="ai-scan-results">
          <div className="text-[12.5px] font-medium mb-2">{L(`${findings.length} purchase orders need action this week - tightest first:`, `${findings.length} أوامر شراء تحتاج إجراءً هذا الأسبوع - الأضيق أولًا:`)}</div>
          <div className="grid gap-2 md:grid-cols-3">
          {findings.map(({ r, best }) => (
            <button key={r.po.id} type="button" onClick={() => select(r.po.id)} className="text-start rounded-lg border border-line bg-surface p-2.5 hover:bg-surface-2 transition-colors">
              <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                <span className="text-[12.5px] font-semibold">{r.po.id}</span>
                <Chip tone={r.risk === 'late' ? 'bad' : 'warn'} dot>
                  {fmtDays(r.floatDays, lang, true)} {L('float', 'هامش')}
                </Chip>
                {r.row.chokepointExposed && <Chip tone="info">{L('Chokepoint', 'نقطة الاختناق')}</Chip>}
              </div>
              <div className="text-[12px] text-muted truncate">{tx(r.mat.name, lang)}</div>
              <div className="text-[12px] mt-1.5 leading-snug">
                {best ? (
                  <>
                    <span style={{ color: toneVar.violet }} className="font-medium">
                      {L('AI suggests', 'يقترح الذكاء')}:{' '}
                    </span>
                    {L(`re-route via ${tx(best.route.name, 'en')}`, `إعادة التوجيه عبر ${tx(best.route.name, 'ar')}`)} - {L('arrives', 'يصل')} {fmtDays(Math.abs(best.deltaDays), lang)} {L('earlier', 'أبكر')}, {best.deltaCostAED > 0 ? '+' : ''}AED {fmtAed(best.deltaCostAED, lang)}
                  </>
                ) : (
                  L('No faster route found - expedite with the supplier.', 'لا يوجد مسار أسرع - اطلب التسريع من المورد.')
                )}
              </div>
            </button>
          ))}
          </div>
        </div>
      )}
    </AiPanel>
  );
}
