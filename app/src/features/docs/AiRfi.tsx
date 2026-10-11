import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Copy, X } from 'lucide-react';
import { Btn } from '../../design/ui';
import { tx } from '../../lib/bi';
import type { Lang } from '../../lib/fmt';
import type { Rfi } from './docsData';
import { AiBar, AiPanel, AiSteps, Typed } from '../ai/kit';

/** AI drafts a reply to an open RFI: reads the drawings/specs, then types a ready-to-edit response */
export function AiRfiDraft({ rfi, onClose }: { rfi: Rfi; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Lang;
  const L = (en: string, ar: string) => (lang === 'ar' ? ar : en);
  const [phase, setPhase] = useState<'steps' | 'typing' | 'done'>('steps');
  const [copied, setCopied] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setPhase('steps');
    setCopied(false);
    box.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [rfi.id]);

  const subject = tx(rfi.subject, lang);
  const specific: Record<string, [string, string]> = {
    'RFI-030': [
      'Drawing POC-MAR-DWG-0101 Rev C gives the crane-rail gauge (17.5 m) but no tolerance at the expansion joint. Proposed response: apply +/-3 mm on gauge and +/-2 mm vertical step across the joint, to be confirmed in writing by the design consultant and added to the next drawing revision.',
      'يحدد المخطط POC-MAR-DWG-0101 المراجعة C عرض سكة الرافعة (17.5 م) دون ذكر التفاوت عند فاصل التمدد. الرد المقترح: تطبيق +/-3 مم على العرض و +/-2 مم كفرق رأسي عبر الفاصل، على أن يؤكدها المستشار كتابيًا وتضاف إلى المراجعة القادمة للمخطط.',
    ],
    'RFI-031': [
      'Corner-unit tolerance is not given on drawing POC-MAR-DWG-0102 Rev B. Proposed response: apply the typical caisson tolerance of +/-10 mm plan and +/-15 mm level, subject to consultant confirmation.',
      'تفاوت وحدات الزاوية غير مبيّن في المخطط POC-MAR-DWG-0102 المراجعة B. الرد المقترح: تطبيق تفاوت الصناديق المعتاد +/-10 مم أفقيًا و +/-15 مم رأسيًا بعد تأكيد المستشار.',
    ],
    'RFI-025': [
      'The substation earthing grid on POC-ELE-DWG-0701 crosses the cable trench. Proposed response: re-route the earth conductor 600 mm below the trench invert and issue a revised earthing layout.',
      'شبكة التأريض في المخطط POC-ELE-DWG-0701 تقطع مجرى الكابلات. الرد المقترح: إعادة توجيه موصل التأريض 600 مم تحت قاع المجرى وإصدار مخطط تأريض معدّل.',
    ],
  };
  const text = useMemo(
    () =>
      L(
        `To: ${rfi.to}\nRe: ${rfi.id} - ${subject}\n\nThank you for your query. Based on the approved drawings and the project specification, our proposed response is:\n\n${specific[rfi.id]?.[0] ?? 'The drawing is silent on this point. We propose to apply the governing specification clause and will confirm the figure in writing.'}\n\nPlease proceed on this basis. ${rfi.scheduleDays ? `This RFI has been open ${rfi.daysOpen} days and is holding up about ${rfi.scheduleDays} days of programme; a reply today releases the affected activities.` : 'No programme impact is expected.'}\n\nDraft prepared by AI - please review before issuing.`,
        `إلى: ${rfi.to}\nبخصوص: ${rfi.id} - ${subject}\n\nشكرًا على استفساركم. استنادًا إلى المخططات المعتمدة ومواصفات المشروع، ردنا المقترح:\n\n${specific[rfi.id]?.[1] ?? 'المخطط لا يحدد هذه النقطة. نقترح تطبيق بند المواصفات الحاكم وسنؤكد القيمة كتابيًا.'}\n\nيُرجى المتابعة على هذا الأساس. ${rfi.scheduleDays ? `هذا الاستفسار مفتوح منذ ${rfi.daysOpen} يومًا ويعطّل نحو ${rfi.scheduleDays} أيام من البرنامج؛ والرد اليوم يحرر الأنشطة المتأثرة.` : 'لا أثر متوقع على البرنامج.'}\n\nمسودة أعدّها الذكاء الاصطناعي - يُرجى المراجعة قبل الإصدار.`,
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rfi, lang],
  );
  const steps = [
    L(`Reading ${rfi.id} and its attachments`, `قراءة ${rfi.id} ومرفقاته`),
    L('Searching drawings, specifications and earlier RFIs', 'البحث في المخططات والمواصفات والاستفسارات السابقة'),
    L('Checking programme impact on linked activities', 'فحص الأثر على الأنشطة المرتبطة'),
    L('Drafting a response', 'صياغة الرد'),
  ];
  return (
    <div ref={box}>
    <AiPanel
      title={`${t('docs.ai.draft')} - ${rfi.id}`}
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
          <AiSteps steps={steps} runKey={rfi.id} stepMs={480} compact onDone={() => setPhase('typing')} />
        </div>
      )}
      {phase !== 'steps' && (
        <>
          <pre className="m-0 whitespace-pre-wrap font-[inherit] text-[12.5px] leading-relaxed rounded-lg border border-line bg-surface p-3" data-testid="ai-rfi-text">
            {phase === 'done' ? text : <Typed text={text} cps={320} onDone={() => setPhase('done')} />}
          </pre>
          {phase === 'done' && (
            <div className="mt-2 flex gap-2 ai-pop">
              <Btn
                size="sm"
                variant="primary"
                icon={<Copy size={13} />}
                onClick={() => {
                  void navigator.clipboard?.writeText(text).catch(() => undefined);
                  setCopied(true);
                }}
              >
                {copied ? t('docs.ai.copied') : t('docs.ai.copy')}
              </Btn>
              <Btn size="sm" variant="soft" onClick={() => setPhase('steps')}>{t('rep.ai.regenerate')}</Btn>
            </div>
          )}
        </>
      )}
    </AiPanel>
    </div>
  );
}
