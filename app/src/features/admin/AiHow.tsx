import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ArrowUpRight, Eye, FileSpreadsheet, Lightbulb, Radar, Zap } from 'lucide-react';
import { Btn, Card, Chip } from '../../design/ui';
import type { Lang } from '../../lib/fmt';
import { SIA_URL } from '../../lib/links';
import { AiTag } from '../ai/kit';
import { openCopilot } from '../ai/Copilot';

/** "How AI helps": animated Sense -> Understand -> Recommend -> Act pipeline, with a link to every AI moment in the PoC */
export function AiHow() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Lang;
  const L = (en: string, ar: string) => (lang === 'ar' ? ar : en);
  const nav = useNavigate();
  const stages = [
    {
      icon: <Eye size={20} />,
      color: 'var(--info)',
      title: L('Sense', 'الاستشعار'),
      body: L('Reads every feed continuously: schedule, purchase orders, telemetry, CCTV, drone flights, weather, drawings.', 'يقرأ كل الخلاصات باستمرار: الجدول وأوامر الشراء والقياسات والكاميرات والطائرات المسيّرة والطقس والمخططات.'),
      demo: [
        [L('AI vision on the CCTV wall', 'رؤية الذكاء على جدار الكاميرات'), '/hse'],
        [L('AI site scan on the twin', 'مسح الموقع على التوأم'), '/twin'],
      ],
    },
    {
      icon: <Radar size={20} />,
      color: 'var(--violet)',
      title: L('Understand', 'الفهم'),
      body: L('Joins the data into one model: which delivery feeds which activity, which machine drives which date, what is critical.', 'يربط البيانات في نموذج واحد: أي توريد يغذي أي نشاط، وأي معدة تحدد أي موعد، وما هو الحرج.'),
      demo: [
        [L('AI schedule analyst', 'محلل الجدول'), '/schedule'],
        [L('AI diagnosis of CC-02', 'تشخيص CC-02'), '/assets?asset=CC-02'],
      ],
    },
    {
      icon: <Lightbulb size={20} />,
      color: 'var(--warn)',
      title: L('Recommend', 'التوصية'),
      body: L('Runs what-ifs on a copy of the plan and ranks recovery options by days saved per dirham, with the trade-offs shown.', 'يشغّل سيناريوهات ماذا-لو على نسخة من الخطة ويرتب خيارات التعافي حسب الأيام المستردة لكل درهم مع إظهار المقايضات.'),
      demo: [
        [L('AI supply-risk scan', 'فحص مخاطر الإمداد'), '/procurement'],
        [L('Hormuz what-if', 'سيناريو هرمز'), '/whatif/supply'],
      ],
    },
    {
      icon: <Zap size={20} />,
      color: 'var(--good)',
      title: L('Act', 'التنفيذ'),
      body: L('Drafts the work order, the SOP, the RFI reply and the board report; a person approves. Data can flow on to S!a Excel-lence.', 'يصوغ أمر العمل والإجراء والرد على الاستفسار وتقرير المجلس؛ ويعتمدها شخص. ويمكن نقل البيانات إلى S!a Excel-lence.'),
      demo: [
        [L('AI RFI reply and drawing review', 'رد الاستفسار ومراجعة المخطط'), '/docs'],
        [L('AI executive summary', 'الملخص التنفيذي'), '/reports'],
      ],
    },
  ] as const;
  const W = 1000;
  const xs = [125, 375, 625, 875];
  return (
    <div className="space-y-3" data-testid="ai-how">
      <Card
        title={t('adm.ai.title')}
        subtitle={t('adm.ai.sub')}
        actions={
          <>
            <AiTag />
            <Btn size="sm" variant="primary" onClick={() => openCopilot()}>{t('hdr.ai')}</Btn>
          </>
        }
      >
        <div dir="ltr" className="w-full">
          <svg viewBox={`0 0 ${W} 120`} className="w-full" role="img" aria-label="AI pipeline">
            <defs>
              <linearGradient id="aiflow" x1="0" x2="1">
                <stop offset="0" stopColor="var(--info)" />
                <stop offset="0.5" stopColor="var(--violet)" />
                <stop offset="1" stopColor="var(--good)" />
              </linearGradient>
            </defs>
            <line x1={xs[0]} y1={50} x2={xs[3]} y2={50} stroke="url(#aiflow)" strokeWidth={3} strokeLinecap="round" opacity={0.5} />
            {[0, 1, 2].map((k) => (
              <circle key={k} r={5} fill="var(--accent)">
                <animate attributeName="cx" from={xs[0]} to={xs[3]} dur="5s" begin={`${k * 1.65}s`} repeatCount="indefinite" />
                <animate attributeName="cy" values="50;50" dur="5s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.1;0.9;1" dur="5s" begin={`${k * 1.65}s`} repeatCount="indefinite" />
              </circle>
            ))}
            {stages.map((s, i) => (
              <g key={i}>
                <circle cx={xs[i]} cy={50} r={26} fill="var(--surface)" stroke={s.color} strokeWidth={2.5} />
                <circle cx={xs[i]} cy={50} r={26} fill="none" stroke={s.color} strokeWidth={2} opacity={0.5}>
                  <animate attributeName="r" values="26;38;26" dur="3s" begin={`${i * 0.7}s`} repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.5;0;0.5" dur="3s" begin={`${i * 0.7}s`} repeatCount="indefinite" />
                </circle>
                <text x={xs[i]} y={55} textAnchor="middle" fontSize={15} fontWeight={700} fill={s.color}>{i + 1}</text>
                <text x={xs[i]} y={105} textAnchor="middle" fontSize={15} fontWeight={600} fill="var(--text)">{s.title}</text>
              </g>
            ))}
          </svg>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4 mt-1">
          {stages.map((s, i) => (
            <div key={i} className="rounded-xl border border-line bg-surface-2 p-3 flex flex-col gap-2">
              <div className="flex items-center gap-2" style={{ color: s.color }}>
                {s.icon}
                <span className="text-[13.5px] font-semibold text-ink">{s.title}</span>
              </div>
              <p className="m-0 text-[12.5px] text-muted leading-snug">{s.body}</p>
              <div className="mt-auto flex flex-col gap-1">
                {s.demo.map(([label, to]) => (
                  <button key={to} type="button" onClick={() => nav(to)} className="flex items-center justify-between gap-2 text-start text-[12px] rounded-lg border border-line px-2.5 py-1.5 hover:bg-surface-3 transition-colors">
                    <span>{label}</span>
                    <ArrowUpRight size={13} className="shrink-0 text-dim flip-rtl" />
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>
      <Card title={t('adm.ai.value')} subtitle={t('adm.ai.valueSub')} actions={<Chip tone="warn">{t('chip.illustrative')}</Chip>}>
        <div className="grid gap-3 md:grid-cols-3">
          {[
            [L('Morning briefing', 'إحاطة الصباح'), L('45 min of reading', '45 دقيقة قراءة'), L('read in 1 minute', 'تُقرأ في دقيقة')],
            [L('Spotting a late delivery', 'رصد توريد متأخر'), L('days, at the next meeting', 'أيام، في الاجتماع القادم'), L('hours, automatically', 'ساعات، تلقائيًا')],
            [L('Board report', 'تقرير المجلس'), L('half a day of assembly', 'نصف يوم تجميع'), L('one click, then review', 'نقرة واحدة ثم مراجعة')],
          ].map(([k, from, to]) => (
            <div key={k} className="rounded-xl border border-line p-3">
              <div className="text-[12px] text-dim">{k}</div>
              <div className="mt-1 flex items-center gap-2 text-[13px]"><span className="text-muted line-through">{from}</span><span aria-hidden>→</span><span className="font-semibold" style={{ color: 'var(--good)' }}>{to}</span></div>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          <a href={SIA_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-line-2 text-[13px] hover:bg-surface-2">
            <FileSpreadsheet size={14} /> {t('rep.siaTitle')}
          </a>
          <span className="text-[11.5px] text-dim">{t('adm.ai.note')}</span>
        </div>
      </Card>
    </div>
  );
}
