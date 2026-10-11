import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { Btn } from '../../design/ui';
import { tx } from '../../lib/bi';
import type { Lang } from '../../lib/fmt';
import type { Incident } from './data';
import { AiBar, AiPanel, AiSteps, Typed } from '../ai/kit';

/** AI root-cause analysis for an open incident: pulls related data (weather, CCTV, permits) and proposes causes + actions */
export function AiRca({ incident, onClose }: { incident: Incident; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Lang;
  const L = (en: string, ar: string) => (lang === 'ar' ? ar : en);
  const [phase, setPhase] = useState<'steps' | 'typing' | 'done'>('steps');
  useEffect(() => setPhase('steps'), [incident.id]);

  const text = L(
    `${incident.id} - ${tx(incident.title, 'en')}.\n\nLikely causes (ranked):\n1. Wind: gusts near 11 m/s are the crane lift limit; the wind log for that afternoon should be checked against the lift time. (medium confidence)\n2. Rigging: tag-line not attached on the leeward side; the banksman was outside the exclusion zone. (medium)\n3. Planning: the precast unit was lifted over a walkway that the lift plan marked as closed. (medium)\n\nPattern: the other near misses in the last 47 days were a dropped scaffold board and a forklift route breach - different causes, so this one looks specific to the lift.\n\nProposed actions: pause lifts above 10 m/s wind (auto-alert to the crane operator), add a tag-line check to the permit-to-work, and brief all banksmen at tomorrow's toolbox talk.`,
    `${incident.id} - ${tx(incident.title, 'ar')}.\n\nالأسباب المرجحة (مرتبة):\n1. الرياح: الهبّات قرب 11 م/ث تمثل حد الرفع للرافعة؛ يجب مطابقة سجل الرياح بعد ظهر ذلك اليوم مع وقت الرفع. (ثقة متوسطة)\n2. التربيط: لم يُثبَّت حبل التوجيه في الجهة المعاكسة للريح، وكان المشير خارج منطقة الحظر. (متوسطة)\n3. التخطيط: رُفعت الوحدة الجاهزة فوق ممر صنّفته خطة الرفع مغلقًا. (متوسطة)\n\nالنمط: حوادث شبه الوقوع الأخرى خلال 47 يومًا كانت سقوط لوح سقالة واختراق مسار الرافعة الشوكية - أسباب مختلفة، فيبدو هذا الحادث خاصًا بعملية الرفع.\n\nالإجراءات المقترحة: إيقاف الرفع عند رياح فوق 10 م/ث (تنبيه آلي لمشغّل الرافعة)، وإضافة فحص حبل التوجيه إلى تصريح العمل، وتوعية جميع المشيرين في اجتماع الغد.`,
  );
  const steps = [
    L('Reading the incident report and photos', 'قراءة تقرير الحادث والصور'),
    L('Pulling weather, CCTV events and permits for that hour', 'سحب الطقس وأحداث الكاميرات والتصاريح لتلك الساعة'),
    L('Searching 47 days of incidents for the same pattern', 'البحث في حوادث 47 يومًا عن النمط نفسه'),
    L('Drafting causes and corrective actions', 'صياغة الأسباب والإجراءات التصحيحية'),
  ];
  return (
    <AiPanel
      className="mt-3"
      title={`${t('hse.ai.rca')} - ${incident.id}`}
      glow={phase === 'steps'}
      actions={
        <Btn size="sm" variant="ghost" className="!px-1.5" onClick={onClose} aria-label={t('common.close')}>
          <X size={14} />
        </Btn>
      }
    >
      {phase === 'steps' && (
        <div className="space-y-2">
          <AiBar />
          <AiSteps steps={steps} runKey={incident.id} stepMs={560} compact onDone={() => setPhase('typing')} />
        </div>
      )}
      {phase !== 'steps' && (
        <p className="m-0 text-[12.5px] leading-relaxed whitespace-pre-line" data-testid="ai-rca-text">
          {phase === 'done' ? text : <Typed text={text} cps={300} onDone={() => setPhase('done')} />}
        </p>
      )}
    </AiPanel>
  );
}
