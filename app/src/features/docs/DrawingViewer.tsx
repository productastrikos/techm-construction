import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { MessageSquarePlus, ScanSearch } from 'lucide-react';
import { Btn, Card, Chip } from '../../design/ui';
import { tx, type Bi } from '../../lib/bi';
import type { Lang } from '../../lib/fmt';
import type { Drawing } from './docsData';
import { AiSteps } from '../ai/kit';

const S = 'var(--text)';

/* ------------------------------------------------------------------ schematic drawings (SVG, not real drawings) */
function Marine({ rev }: { rev: string }) {
  return (
    <>
      <defs>
        <pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="6" stroke={S} strokeOpacity="0.35" strokeWidth="1" />
        </pattern>
      </defs>
      <rect x="0" y="150" width="190" height="180" fill="#0e5a73" opacity="0.35" />
      <line x1="0" y1="150" x2="190" y2="150" stroke="#5bb8ff" strokeWidth="1.2" strokeDasharray="6 3" />
      <text x="10" y="144" fontSize="10" fill="#5bb8ff">MHWS +1.9</text>
      <path d="M0 300 L190 300 L230 292 L560 292" fill="none" stroke={S} strokeWidth="1.5" />
      <text x="10" y="318" fontSize="10" fill={S} opacity="0.7">-12.0 m CD (dredged)</text>
      <rect x="190" y="110" width="70" height="190" fill="url(#hatch)" stroke={S} strokeWidth="1.8" />
      <rect x="198" y="118" width="54" height="174" fill="none" stroke={S} strokeWidth="1" strokeDasharray="4 3" />
      <path d="M260 110 L560 110 L560 292 L260 292 Z" fill="#c9a96b" opacity="0.18" stroke={S} strokeWidth="1" />
      <path d="M260 160 L330 292 L260 292 Z" fill="#8a8f93" opacity="0.5" stroke={S} strokeWidth="1" />
      <rect x="260" y="100" width="300" height="10" fill="#9aa5ab" stroke={S} strokeWidth="1.2" />
      <rect x="275" y="92" width="14" height="8" fill="#f7b84b" stroke={S} strokeWidth="1" />
      <rect x="360" y="92" width="14" height="8" fill="#f7b84b" stroke={S} strokeWidth="1" />
      <path d="M190 128 L172 140 L172 170 L190 182 Z" fill="#2d3a40" stroke={S} strokeWidth="1.2" />
      <g stroke={S} strokeWidth="1" fill={S} fontSize="10">
        <line x1="290" y1="60" x2="360" y2="60" />
        <text x="300" y="54">17.5 m rail gauge (typ.)</text>
        <line x1="148" y1="110" x2="148" y2="300" />
        <text x="60" y="210" transform="rotate(-90 70 210)">17.8 m</text>
        <line x1="190" y1="322" x2="260" y2="322" />
        <text x="206" y="314">9.0 m</text>
      </g>
      <path d="M165 120 q10 -14 22 -4 q12 -14 24 -2 q12 -12 22 2 q14 -6 18 10 q12 6 4 18 q8 12 -6 20 q2 14 -14 14 q-8 12 -20 4 q-12 10 -22 -2 q-14 4 -18 -10 q-14 -6 -8 -20 q-10 -12 4 -20 q-2 -6 -6 -10 Z" fill="none" stroke="#ff6b6b" strokeWidth="1.8" />
      <text x="150" y="108" fontSize="10" fill="#ff6b6b">REV {rev}: fender mounting revised</text>
    </>
  );
}

function Civil() {
  const layers: Array<[string, number, string]> = [
    ['Interlocking concrete block 100 mm', 24, '#9aa5ab'],
    ['Bedding sand 30 mm', 12, '#d9c58f'],
    ['Cement-bound base 250 mm', 40, '#7d8a90'],
    ['Granular sub-base 350 mm', 54, '#a1927a'],
    ['Improved subgrade (CBR >= 15)', 70, '#6e6a60'],
  ];
  let y = 70;
  return (
    <>
      <text x="20" y="40" fontSize="12" fill={S}>Typical heavy-duty apron build-up</text>
      {layers.map(([label, h, c]) => {
        const el = (
          <g key={label}>
            <rect x="60" y={y} width="300" height={h} fill={c} opacity="0.75" stroke={S} strokeWidth="1" />
            <line x1="360" y1={y + h / 2} x2="400" y2={y + h / 2} stroke={S} strokeWidth="1" />
            <text x="406" y={y + h / 2 + 3.5} fontSize="10.5" fill={S}>{label}</text>
          </g>
        );
        y += h;
        return el;
      })}
      <line x1="40" y1="70" x2="40" y2={y} stroke={S} strokeWidth="1" />
      <text x="20" y={y / 2 + 40} fontSize="10" fill={S} transform={`rotate(-90 28 ${y / 2 + 40})`}>770 mm total</text>
      <path d="M60 70 L360 70" stroke="#5bb8ff" strokeWidth="1.5" strokeDasharray="6 3" />
      <text x="70" y="62" fontSize="10" fill="#5bb8ff">FFL +4.20 (1 : 100 crossfall to drain)</text>
    </>
  );
}

function Architectural() {
  return (
    <>
      <rect x="40" y="40" width="470" height="250" fill="none" stroke={S} strokeWidth="2.2" />
      {[
        [40, 40, 180, 120, 'Reception'],
        [220, 40, 150, 120, 'Security office'],
        [370, 40, 140, 120, 'Inspection bay'],
        [40, 160, 140, 130, 'Welfare'],
        [180, 160, 190, 130, 'Customs hall'],
        [370, 160, 140, 130, 'Plant room'],
      ].map(([x, y, w, h, l]) => (
        <g key={String(l)}>
          <rect x={x as number} y={y as number} width={w as number} height={h as number} fill="color-mix(in srgb, var(--surface-3) 60%, transparent)" stroke={S} strokeWidth="1.2" />
          <text x={(x as number) + (w as number) / 2} y={(y as number) + (h as number) / 2} textAnchor="middle" fontSize="11" fill={S}>{l as string}</text>
        </g>
      ))}
      <path d="M200 40 a20 20 0 0 1 20 20" fill="none" stroke={S} />
      <path d="M180 220 a20 20 0 0 0 -20 20" fill="none" stroke={S} />
      <g stroke={S} fill={S} fontSize="10">
        <line x1="40" y1="312" x2="510" y2="312" />
        <text x="250" y="325">28.0 m</text>
      </g>
    </>
  );
}

function Electrical() {
  return (
    <>
      <text x="20" y="30" fontSize="12" fill={S}>11 kV incomer and LV distribution (single line)</text>
      <circle cx="90" cy="70" r="14" fill="none" stroke={S} strokeWidth="1.6" />
      <circle cx="90" cy="86" r="14" fill="none" stroke={S} strokeWidth="1.6" />
      <text x="115" y="82" fontSize="10" fill={S}>11/0.4 kV  2.5 MVA</text>
      <line x1="90" y1="100" x2="90" y2="140" stroke={S} strokeWidth="1.6" />
      <rect x="82" y="140" width="16" height="16" fill="none" stroke={S} strokeWidth="1.6" />
      <line x1="90" y1="156" x2="90" y2="185" stroke={S} strokeWidth="1.6" />
      <line x1="40" y1="185" x2="520" y2="185" stroke="#f7b84b" strokeWidth="4" />
      <text x="44" y="177" fontSize="10" fill="#f7b84b">LV busbar 400 V 3-phase</text>
      {[110, 200, 290, 380, 470].map((x, i) => (
        <g key={x}>
          <line x1={x} y1="185" x2={x} y2="215" stroke={S} strokeWidth="1.4" />
          <rect x={x - 7} y="215" width="14" height="14" fill="none" stroke={S} strokeWidth="1.4" />
          <line x1={x} y1="229" x2={x} y2="262" stroke={S} strokeWidth="1.4" />
          <circle cx={x} cy="274" r="11" fill="none" stroke={S} strokeWidth="1.4" />
          <text x={x} y="278" fontSize="9" textAnchor="middle" fill={S}>{['M', 'M', 'G', 'L', 'L'][i]}</text>
          <text x={x} y="304" fontSize="9" textAnchor="middle" fill={S}>{['Crane 1', 'Crane 2', 'Gen', 'Lighting', 'Gate'][i]}</text>
        </g>
      ))}
    </>
  );
}

function Mechanical() {
  return (
    <>
      <text x="20" y="30" fontSize="12" fill={S}>Workshop ventilation / cooling schematic</text>
      <rect x="40" y="110" width="120" height="90" fill="none" stroke={S} strokeWidth="1.8" />
      <text x="100" y="150" fontSize="11" textAnchor="middle" fill={S}>AHU-01</text>
      <text x="100" y="168" fontSize="9" textAnchor="middle" fill={S} opacity="0.7">12 000 m3/h</text>
      <path d="M160 140 L260 140 L260 80 L500 80" fill="none" stroke="#5bb8ff" strokeWidth="3" />
      <path d="M160 175 L260 175 L260 250 L500 250" fill="none" stroke="#5bb8ff" strokeWidth="3" />
      {[300, 380, 460].map((x) => (
        <g key={x}>
          <rect x={x - 14} y="70" width="28" height="20" fill="none" stroke={S} />
          <rect x={x - 14} y="240" width="28" height="20" fill="none" stroke={S} />
        </g>
      ))}
      <text x="330" y="60" fontSize="10" fill="#5bb8ff">Supply 22 C</text>
      <text x="330" y="285" fontSize="10" fill="#5bb8ff">Return 27 C</text>
    </>
  );
}

/* ------------------------------------------------------------------ AI review (findings per discipline, positions in the 560x330 viewBox) */
interface AiFinding {
  x: number;
  y: number;
  text: Bi;
  tone: 'bad' | 'warn';
}
const FINDINGS: Record<Drawing['disc'], AiFinding[]> = {
  Marine: [
    { x: 182, y: 154, tone: 'bad', text: { en: 'Fender bracket dimension differs from fender layout 0140 Rev D by 40 mm.', ar: 'بُعد حامل المصد يختلف عن مخطط المصدّات 0140 المراجعة D بمقدار 40 مم.' } },
    { x: 320, y: 98, tone: 'warn', text: { en: 'Crane-rail gauge 17.5 m: expansion-joint tolerance not stated (see open RFI-030).', ar: 'عرض سكة الرافعة 17.5 م: لم يُذكر تفاوت فاصل التمدد (راجع الاستفسار المفتوح RFI-030).' } },
    { x: 225, y: 292, tone: 'warn', text: { en: 'Founding level -12.0 m CD is above the dredged level on the latest survey.', ar: 'منسوب التأسيس -12.0 م أعلى من منسوب الكراكة في آخر مسح.' } },
  ],
  Civil: [
    { x: 210, y: 130, tone: 'warn', text: { en: 'Cement-bound base thickness differs from the geotechnical report (300 mm).', ar: 'سمك الطبقة المتماسكة بالإسمنت يختلف عن التقرير الجيوتقني (300 مم).' } },
    { x: 330, y: 70, tone: 'bad', text: { en: 'Crossfall 1:100 conflicts with the drainage plan 0322 (1:80 at the outfall).', ar: 'ميل 1:100 يتعارض مع مخطط التصريف 0322 (1:80 عند المصب).' } },
  ],
  Architectural: [
    { x: 295, y: 100, tone: 'warn', text: { en: 'Security-office door swing blocks the egress route (fire-code check).', ar: 'اتجاه فتح باب مكتب الأمن يسد مسار الإخلاء (فحص كود الحريق).' } },
    { x: 440, y: 225, tone: 'bad', text: { en: 'Plant room has no access route for the 2.5 MVA transformer lift-in.', ar: 'غرفة المعدات بلا مسار لإدخال المحول 2.5 ميغا فولت أمبير.' } },
  ],
  Electrical: [
    { x: 90, y: 148, tone: 'warn', text: { en: 'Incomer breaker rating is not shown: 2.5 MVA at 0.4 kV carries about 3 600 A at full load - confirm the rating.', ar: 'تصنيف قاطع الدخول غير مبيّن: 2.5 ميغا فولت أمبير عند 0.4 كيلو فولت تعني نحو 3600 أمبير - يُرجى تأكيد التصنيف.' } },
    { x: 290, y: 222, tone: 'bad', text: { en: 'Crane 2 feeder is not shown on cable schedule E-0712.', ar: 'مغذّي الرافعة 2 غير مدرج في جدول الكابلات E-0712.' } },
  ],
  Mechanical: [
    { x: 260, y: 140, tone: 'warn', text: { en: 'Supply duct clashes with the cable tray on electrical layout 0730.', ar: 'قناة التغذية تتعارض مع حامل الكابلات في المخطط الكهربائي 0730.' } },
    { x: 380, y: 250, tone: 'warn', text: { en: 'Return-air temperature rise exceeds the 5 K design limit.', ar: 'ارتفاع حرارة هواء الإرجاع يتجاوز حد التصميم 5 كلفن.' } },
  ],
};

/** offline markup viewer. The schematic changes per discipline (illustrative, not a real drawing); AI review drops findings onto it */
export function DrawingViewer({ drawing }: { drawing: Drawing }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Lang;
  const [pins, setPins] = useState<Array<{ x: number; y: number }>>(drawing.disc === 'Marine' ? [{ x: 372, y: 118 }] : []);
  const [ai, setAi] = useState<'idle' | 'scan' | 'done'>('idle');
  const [shown, setShown] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const findings = FINDINGS[drawing.disc];

  // new drawing selected: reset markup + review
  useEffect(() => {
    setPins(drawing.disc === 'Marine' ? [{ x: 372, y: 118 }] : []);
    setAi('idle');
    setShown(0);
    if (timer.current) clearInterval(timer.current);
  }, [drawing.no, drawing.disc]);
  useEffect(() => () => void (timer.current && clearInterval(timer.current)), []);

  const review = () => {
    setAi('scan');
    setShown(0);
  };
  const reveal = () => {
    setAi('done');
    let k = 0;
    if (timer.current) clearInterval(timer.current);
    timer.current = setInterval(() => {
      k++;
      setShown(k);
      if (k >= findings.length && timer.current) clearInterval(timer.current);
    }, 450);
  };

  const body: ReactNode = drawing.disc === 'Marine' ? <Marine rev={drawing.rev} /> : drawing.disc === 'Civil' ? <Civil /> : drawing.disc === 'Architectural' ? <Architectural /> : drawing.disc === 'Electrical' ? <Electrical /> : <Mechanical />;
  const steps = [
    lang === 'ar' ? 'قراءة المخطط ومعاييره' : 'Reading the drawing and its revision history',
    lang === 'ar' ? 'مطابقته مع المخططات والاستفسارات ذات الصلة' : 'Cross-checking related drawings, RFIs and specs',
    lang === 'ar' ? 'البحث عن التعارضات والأبعاد المتضاربة' : 'Looking for clashes and conflicting dimensions',
  ];
  return (
    <Card title={drawing.no} subtitle={tx(drawing.title, lang)} sim actions={<Chip tone="accent">{t('docs.view.rev')} {drawing.rev}</Chip>}>
      <div className="relative rounded-lg border border-line overflow-hidden" style={{ background: 'color-mix(in srgb, var(--surface-2) 70%, #0b3d52)' }} dir="ltr">
        <svg
          viewBox="0 0 560 330"
          className="w-full cursor-crosshair block"
          role="img"
          aria-label="Drawing (schematic)"
          onClick={(e) => {
            const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
            setPins((p) => [...p, { x: ((e.clientX - r.left) / r.width) * 560, y: ((e.clientY - r.top) / r.height) * 330 }].slice(-6));
          }}
        >
          {body}
          {pins.map((p, i) => (
            <g key={i} transform={`translate(${p.x},${p.y})`}>
              <circle r="9" fill="#a78bfa" stroke="white" strokeWidth="1.5" />
              <text textAnchor="middle" y="3.5" fontSize="10" fill="white" fontWeight="700">{i + 1}</text>
            </g>
          ))}
          {ai === 'done' &&
            findings.slice(0, shown).map((f, i) => (
              <g key={i} transform={`translate(${f.x},${f.y})`}>
                <g className="ai-pop" style={{ transformBox: 'fill-box', transformOrigin: 'center' }}>
                  <circle r="14" fill="none" stroke={f.tone === 'bad' ? '#ff6b6b' : '#f7b84b'} strokeWidth="2" strokeDasharray="4 3" />
                  <circle r="8" fill={f.tone === 'bad' ? '#ff6b6b' : '#f7b84b'} />
                  <text textAnchor="middle" y="3.5" fontSize="10" fill="#111" fontWeight="800">AI</text>
                </g>
              </g>
            ))}
        </svg>
        {ai === 'scan' && <div className="ai-scanline" style={{ animationDuration: '2.6s' }} aria-hidden />}
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 text-[11.5px] text-dim">
        <span>{t('docs.view.hint')}</span>
        <div className="flex gap-1.5">
          <Btn size="sm" variant={ai === 'idle' ? 'primary' : 'soft'} icon={<ScanSearch size={13} />} onClick={review} disabled={ai === 'scan'} data-testid="ai-review-btn">
            {t('docs.ai.review')}
          </Btn>
          <Btn size="sm" variant="ghost" icon={<MessageSquarePlus size={13} />} onClick={() => setPins([])}>{t('docs.view.clear')}</Btn>
        </div>
      </div>
      {ai === 'scan' && (
        <div className="mt-2" data-testid="ai-review-steps">
          <AiSteps steps={steps} runKey={drawing.no + ai} stepMs={820} compact onDone={reveal} />
        </div>
      )}
      {ai === 'done' && (
        <ol className="mt-2 m-0 ps-0 list-none space-y-1.5" data-testid="ai-review-findings">
          {findings.slice(0, shown).map((f, i) => (
            <li key={i} className="flex gap-2 text-[12px] leading-snug ai-pop">
              <Chip tone={f.tone} className="shrink-0 !py-0">AI {i + 1}</Chip>
              <span>{lang === 'ar' ? f.text.ar : f.text.en}</span>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
