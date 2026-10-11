import { useEffect, useMemo, useState } from 'react';
import { useTwin } from './twinStore';
import { useTranslation } from 'react-i18next';
import { ScanLine, X } from 'lucide-react';
import { Btn, Chip } from '../../design/ui';
import { fmtDays, fmtPct, type Lang } from '../../lib/fmt';
import { tx } from '../../lib/bi';
import { allElementStates } from '../../engine/twin';
import type { MatRisk } from '../../three/PortScene';
import { usePack, useSnapshot, getBaseCals } from '../../sim/useSim';
import { AiBar, AiSteps, AiTag } from '../ai/kit';

/** "AI site scan": a sweep over the 3D view, then the elements the AI believes are behind plan at the DATA date, with likely cause */
export function TwinAiScan({ matRisk, onSelect }: { matRisk: Map<string, MatRisk>; onSelect: (id: string) => void }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Lang;
  const L = (en: string, ar: string) => (lang === 'ar' ? ar : en);
  const pack = usePack();
  const snap = useSnapshot();
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<'idle' | 'scan' | 'done'>('idle');
  const [run, setRun] = useState(0);

  useEffect(() => {
    useTwin.getState().patch({ aiScanning: phase === 'scan' });
    return () => useTwin.getState().patch({ aiScanning: false });
  }, [phase]);

  const findings = useMemo(() => {
    const st = allElementStates(pack, snap.forecast, snap.baseline, getBaseCals(pack), snap.nowT);
    return pack.elements
      .map((el) => ({ el, s: st.get(el.id)! }))
      .filter(({ s }) => s && s.status !== 'planned' && s.status !== 'done' && s.pb - s.pf > 0.01)
      .sort((a, b) => b.s.pb - b.s.pf - (a.s.pb - a.s.pf) || b.s.varianceDays - a.s.varianceDays)
      .slice(0, 3);
  }, [pack, snap]);

  // not started yet, but the AI sees the material for it arriving late
  const upcoming = useMemo(() => {
    const have = new Set(findings.map((f) => f.el.id));
    return pack.elements.filter((el) => !have.has(el.id) && (matRisk.get(el.id) === 'risk' || matRisk.get(el.id) === 'late')).slice(0, 3);
  }, [pack, findings, matRisk]);

  const start = () => {
    setOpen(true);
    setPhase('scan');
    setRun((x) => x + 1);
  };
  const steps = [
    L('Aligning the latest drone flight to the BIM model', 'مواءمة آخر رحلة طائرة مسيّرة مع نموذج BIM'),
    L('Measuring built volume per element', 'قياس الحجم المنفَّذ لكل عنصر'),
    L('Comparing against the baseline plan and the CPM forecast', 'المقارنة مع الخطة المرجعية وتوقع المسار الحرج'),
    L('Looking for the cause: materials, equipment, calendar', 'البحث عن السبب: المواد والمعدات والتقويم'),
  ];
  const cause = (id: string) => {
    const r = matRisk.get(id);
    if (r === 'risk' || r === 'late') return L('waiting on a late material delivery', 'بانتظار توريد مادة متأخر');
    if (r === 'watch') return L('material delivery has little float', 'توريد المواد بهامش ضيق');
    return L('slower than planned productivity on the working calendar', 'إنتاجية أبطأ من المخطط ضمن تقويم العمل');
  };

  return (
    <>
      {!open && (
        <Btn size="sm" variant="primary" icon={<ScanLine size={14} />} className="pointer-events-auto shadow-lg" onClick={start} data-testid="twin-ai-btn">
          {t('twin.ai.run')}
        </Btn>
      )}
      {open && (
        <div className="pointer-events-auto rounded-xl border bg-surface/92 backdrop-blur p-2.5 w-[300px] ai-pop" style={{ borderColor: 'color-mix(in srgb, var(--violet) 55%, var(--line))' }} data-testid="twin-ai-panel">
          <div className="flex items-center gap-2 mb-1.5">
            <ScanLine size={14} style={{ color: 'var(--violet)' }} />
            <div className="text-[12.5px] font-semibold flex-1 truncate">{t('twin.ai.title')}</div>
            <AiTag />
            <button type="button" onClick={() => { setOpen(false); setPhase('idle'); }} className="text-dim hover:text-ink" aria-label={t('common.close')}><X size={14} /></button>
          </div>
          {phase === 'scan' && (
            <div className="space-y-1.5">
              <AiBar />
              <AiSteps steps={steps} runKey={run} stepMs={650} compact onDone={() => setPhase('done')} />
            </div>
          )}
          {phase === 'done' && (
            <div className="space-y-1.5 ai-pop">
              <div className="text-[11.5px] text-muted">
                {findings.length
                  ? L(`${findings.length} ${findings.length === 1 ? 'element is' : 'elements are'} behind plan at the data date:`, `${findings.length} ${findings.length === 1 ? 'عنصر متأخر' : 'عناصر متأخرة'} عن الخطة في تاريخ البيانات:`)
                  : L('All started elements are on plan at the data date.', 'جميع العناصر التي بدأت وفق الخطة في تاريخ البيانات.')}
              </div>
              {findings.map(({ el, s }) => (
                <button key={el.id} type="button" onClick={() => onSelect(el.id)} className="w-full text-start rounded-lg border border-line p-2 hover:bg-surface-2 transition-colors">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[12px] font-medium truncate flex-1">{tx(el.name, lang)}</span>
                    <Chip tone={s.varianceDays > 14 ? 'bad' : 'warn'} dot>{fmtDays(s.varianceDays, lang, true)}</Chip>
                  </div>
                  <div className="text-[11px] text-dim">
                    {fmtPct(s.pf, lang, 1)} {L('built', 'منفّذ')} / {fmtPct(s.pb, lang, 1)} {L('planned', 'مخطط')} - {cause(el.id)}
                  </div>
                </button>
              ))}
              {upcoming.length > 0 && (
                <div className="text-[11.5px] text-muted pt-0.5">{L('Not started, but material is at risk:', 'لم تبدأ، لكن المواد معرّضة للخطر:')}</div>
              )}
              {upcoming.map((el) => (
                <button key={el.id} type="button" onClick={() => onSelect(el.id)} className="w-full text-start rounded-lg border border-line p-2 hover:bg-surface-2 transition-colors">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[12px] font-medium truncate flex-1">{tx(el.name, lang)}</span>
                    <Chip tone={matRisk.get(el.id) === 'late' ? 'bad' : 'warn'} dot>{L('Material', 'مواد')}</Chip>
                  </div>
                </button>
              ))}
              <Btn size="sm" variant="soft" onClick={start}>{t('rep.ai.regenerate')}</Btn>
            </div>
          )}
        </div>
      )}
    </>
  );
}
