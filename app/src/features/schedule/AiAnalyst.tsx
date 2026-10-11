import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Brain, X } from 'lucide-react';
import { Btn, Chip } from '../../design/ui';
import { fmtDate, fmtDays, type Lang } from '../../lib/fmt';
import { tx } from '../../lib/bi';
import type { ProjectPack } from '../../engine/types';
import type { Snapshot } from '../../sim/types';
import { AiBar, AiPanel, AiSteps } from '../ai/kit';

/** "AI schedule analyst": animated reasoning over the CPM result, then three clickable findings */
export function AiAnalyst({ pack, snap, onSelect, onClose }: { pack: ProjectPack; snap: Snapshot; onSelect: (id: string) => void; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Lang;
  const nav = useNavigate();
  const L = (en: string, ar: string) => (lang === 'ar' ? ar : en);
  const [phase, setPhase] = useState<'steps' | 'done'>('steps');
  const f = snap.forecast;

  const findings = useMemo(() => {
    const live = pack.activities.map((a, i) => ({ a, i })).filter(({ a, i }) => a.kind === 'task' && !f.done[i] && f.ef[i] > snap.nowT);
    const crit = live.filter(({ i }) => f.critical[i]).sort((x, y) => f.es[x.i] - f.es[y.i]);
    const near = live.filter(({ i }) => !f.critical[i] && f.tf[i] < 7);
    const po = snap.pos.filter((p) => p.stage < 6).sort((a, b) => a.floatDays - b.floatDays)[0];
    const poAct = po ? pack.activities[f.idx.get(po.deliveryActivityId)!] : undefined;
    return { crit, near, po, poAct };
  }, [pack, snap, f]);

  const first = findings.crit[0];
  const steps = [
    L(`Reading ${pack.activities.length} activities and their logic links`, `قراءة ${pack.activities.length} نشاطًا وروابطها المنطقية`),
    L('Running forward / backward pass on the working calendars', 'تشغيل الحساب الأمامي والخلفي على تقاويم العمل'),
    L('Finding zero-float chains and near-critical paths', 'إيجاد سلاسل الهامش الصفري والمسارات شبه الحرجة'),
    L('Checking which deliveries and equipment feed them', 'فحص التوريدات والمعدات التي تغذيها'),
  ];
  return (
    <AiPanel
      className="mx-5 mb-2"
      title={t('sched.ai.title')}
      glow={phase === 'steps'}
      actions={
        <Btn size="sm" variant="ghost" className="!px-1.5" onClick={onClose} aria-label={t('common.close')}>
          <X size={14} />
        </Btn>
      }
    >
      {phase === 'steps' && (
        <div className="space-y-2" data-testid="ai-analyst-steps">
          <AiBar />
          <AiSteps steps={steps} runKey={0} stepMs={520} compact onDone={() => setPhase('done')} />
        </div>
      )}
      {phase === 'done' && (
        <div className="grid gap-2 md:grid-cols-3 ai-pop" data-testid="ai-analyst-results">
          <button type="button" className="text-start rounded-lg border border-line bg-surface p-2.5 hover:bg-surface-2" onClick={() => first && onSelect(first.a.id)}>
            <div className="flex items-center gap-1.5 mb-1">
              <Chip tone="bad" dot>{L('Critical path', 'المسار الحرج')}</Chip>
              <span className="text-[11px] text-dim">{findings.crit.length} {L('activities, zero float', 'نشاطًا بهامش صفري')}</span>
            </div>
            <div className="text-[12.5px] leading-snug">
              {first ? (f.es[first.i] <= snap.nowT
                ? L(`On the critical path now: "${tx(first.a.name, 'en')}", in progress since ${fmtDate(f.es[first.i], lang)}, due ${fmtDate(f.ef[first.i], lang)}. Any slip here moves the finish day for day.`, `على المسار الحرج الآن: "${tx(first.a.name, 'ar')}" جارٍ منذ ${fmtDate(f.es[first.i], lang)} ويستحق ${fmtDate(f.ef[first.i], lang)}. أي تأخير هنا ينقل الإنجاز يومًا بيوم.`)
                : L(`Next on the critical path: "${tx(first.a.name, 'en')}" starting ${fmtDate(f.es[first.i], lang)}. Any slip here moves the finish day for day.`, `التالي على المسار الحرج: "${tx(first.a.name, 'ar')}" يبدأ ${fmtDate(f.es[first.i], lang)}. أي تأخير هنا ينقل الإنجاز يومًا بيوم.`)) : '-'}
            </div>
          </button>
          <button type="button" className="text-start rounded-lg border border-line bg-surface p-2.5 hover:bg-surface-2" onClick={() => findings.poAct && onSelect(findings.poAct.id)}>
            <div className="flex items-center gap-1.5 mb-1">
              <Chip tone="warn" dot>{L('Supply driver', 'محرك الإمداد')}</Chip>
              {findings.po && <span className="text-[11px] text-dim">{findings.po.id}</span>}
            </div>
            <div className="text-[12.5px] leading-snug">
              {findings.po && findings.poAct
                ? L(`"${tx(findings.poAct.name, 'en')}" arrives with only ${fmtDays(findings.po.floatDays, lang)} of float${findings.po.chokepointExposed ? ' and ships through the sea chokepoint' : ''}.`, `"${tx(findings.poAct.name, 'ar')}" يصل بهامش ${fmtDays(findings.po.floatDays, lang)} فقط${findings.po.chokepointExposed ? ' ويمر عبر نقطة الاختناق' : ''}.`)
                : '-'}
            </div>
          </button>
          <div className="rounded-lg border border-line bg-surface p-2.5">
            <div className="flex items-center gap-1.5 mb-1">
              <Chip tone="info" dot>{L('Near-critical', 'شبه حرج')}</Chip>
              <span className="text-[11px] text-dim">{findings.near.length} {L('activities under 7 d float', 'نشاطًا بهامش أقل من 7 أيام')}</span>
            </div>
            <div className="text-[12.5px] leading-snug mb-2">{L('These are one disruption away from becoming critical. Test them before they bite.', 'هذه على بعد اضطراب واحد من أن تصبح حرجة. اختبرها قبل أن تؤثر.')}</div>
            <Btn size="sm" variant="primary" onClick={() => nav('/whatif')}>
              {t('sched.ai.test')}
            </Btn>
          </div>
        </div>
      )}
    </AiPanel>
  );
}

export const AiAnalystButton = ({ onClick, active }: { onClick: () => void; active: boolean }) => {
  const { t } = useTranslation();
  return (
    <Btn size="sm" variant={active ? 'soft' : 'primary'} icon={<Brain size={13} />} onClick={onClick} data-testid="ai-analyst-btn">
      {t('sched.ai.run')}
    </Btn>
  );
};
