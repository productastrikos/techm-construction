import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarDays, MoveHorizontal } from 'lucide-react';
import { Card, cx, Select, Seg } from '../../design/ui';
import { imageUrl } from '../../lib/images';
import { fmtDate, fmtPct, type Lang } from '../../lib/fmt';
import { useSnapshotMaybe } from '../../sim/useSim';
import type { Snapshot } from '../../sim/types';

const STEP = 30;
type Preset = '30' | '90' | '180' | 'start' | 'finish';

interface Flight {
  k: number;
  t: number;
  /** share of the programme complete on that date (flown flights: earned value; later ones: the forecast) */
  p: number;
  flown: boolean;
}

/** monthly survey flights from the project start to the forecast finish */
function buildFlights(snap: Snapshot): Flight[] {
  const c = snap.sCurve;
  const bac = snap.evm.bac || 1;
  const pts: Array<[number, number]> = c.t.map((t, i) => [t, Math.min(1, (c.forecast[i] ?? 0) / bac)]);
  const at = (t: number) => {
    if (t <= pts[0][0]) return pts[0][1];
    for (let i = 1; i < pts.length; i++) {
      if (t <= pts[i][0]) {
        const [t0, v0] = pts[i - 1];
        const [t1, v1] = pts[i];
        return v0 + ((v1 - v0) * (t - t0)) / (t1 - t0 || 1);
      }
    }
    return pts[pts.length - 1][1];
  };
  const last = Math.ceil(snap.forecastFinish / STEP);
  const out: Flight[] = [];
  for (let k = 0; k <= last; k++) {
    const t = k * STEP;
    out.push({ k, t, p: k === last ? 1 : at(t), flown: t <= snap.nowT });
  }
  return out;
}

/** frame = the "before" still with the "after" still faded in by programme progress */
function Frame({ p, clip, testId }: { p: number; clip?: string; testId?: string }) {
  const a = Math.max(0, Math.min(1, p / 0.92));
  return (
    <div className="absolute inset-0" style={clip ? { clipPath: clip } : undefined} data-testid={testId}>
      <img src={imageUrl('drone-before')} alt="" className="absolute inset-0 w-full h-full object-cover" draggable={false} />
      <img src={imageUrl('drone-after')} alt="" className="absolute inset-0 w-full h-full object-cover" style={{ opacity: a }} draggable={false} />
    </div>
  );
}

/** drone imagery: pick two survey dates and swipe between them. The stills are AI-generated illustrations; the dates and % come from the schedule engine. */
export function DroneCompare() {
  const { i18n } = useTranslation();
  const lang = (i18n.language === 'ar' ? 'ar' : 'en') as Lang;
  const L = (en: string, ar: string) => (lang === 'ar' ? ar : en);
  const snap = useSnapshotMaybe();
  const [x, setX] = useState(52);
  const [preset, setPreset] = useState<Preset>('finish');
  const [pair, setPair] = useState<{ a: number; b: number } | null>(null);

  const flights = useMemo(() => (snap ? buildFlights(snap) : []), [snap]);
  const latest = useMemo(() => {
    let k = 0;
    flights.forEach((f) => f.flown && (k = f.k));
    return k;
  }, [flights]);
  if (!snap || flights.length < 2) return null;

  const lastK = flights.length - 1;
  const fromPreset = (pr: Preset): { a: number; b: number } => {
    if (pr === 'finish') return { a: 0, b: lastK };
    if (pr === 'start') return { a: 0, b: latest };
    const back = Math.max(1, Math.round(Number(pr) / STEP));
    return { a: Math.max(0, latest - back), b: latest };
  };
  const cur = pair ?? fromPreset(preset);
  const A = flights[Math.min(cur.a, cur.b)];
  const B = flights[Math.max(cur.a, cur.b)];
  const label = (f: Flight) => `${L('Flight', 'رحلة')} ${f.k + 1} · ${fmtDate(f.t, lang, 'med')}${f.flown ? '' : ` · ${L('forecast', 'متوقعة')}`}`;
  const opts = flights.map((f) => ({ value: String(f.k), label: `F${f.k + 1} · ${fmtDate(f.t, lang, 'med')}${f.flown ? '' : ` (${L('forecast', 'متوقعة')})`}` }));
  const setA = (v: string) => setPair({ a: Number(v), b: B.k });
  const setB = (v: string) => setPair({ a: A.k, b: Number(v) });
  const pick = (pr: Preset) => {
    setPreset(pr);
    setPair(null);
  };
  const presetOpts: Array<{ value: Preset; label: string; title: string }> = [
    { value: '30', label: '30D', title: L('Latest flight vs 30 days earlier', 'آخر رحلة مقابل قبل 30 يومًا') },
    { value: '90', label: '90D', title: L('Latest flight vs 90 days earlier', 'آخر رحلة مقابل قبل 90 يومًا') },
    { value: '180', label: '180D', title: L('Latest flight vs 180 days earlier', 'آخر رحلة مقابل قبل 180 يومًا') },
    { value: 'start', label: L('Since start', 'منذ البداية'), title: L('Latest flight vs the first flight', 'آخر رحلة مقابل الرحلة الأولى') },
    { value: 'finish', label: L('Start → finish', 'البداية ← الانتهاء'), title: L('First flight vs the forecast finish', 'الرحلة الأولى مقابل الانتهاء المتوقع') },
  ];
  const delta = (B.p - A.p) * 100;

  return (
    <Card
      title={L('Drone imagery', 'صور الطائرات المسيّرة')}
      subtitle={L('Pick two survey dates and drag to compare', 'اختر تاريخي مسح واسحب للمقارنة')}
      sim
      bodyClass="!p-0 overflow-hidden rounded-b-xl"
    >
      <div className="px-3.5 pt-1 pb-2.5 flex flex-wrap items-center gap-2" data-testid="drone-filters">
        <Seg<Preset> size="sm" ariaLabel={L('Quick range', 'نطاق سريع')} value={pair ? ('' as Preset) : preset} onChange={pick} options={presetOpts} />
        <div className="flex items-center gap-1.5 ms-auto min-w-0">
          <CalendarDays size={14} className="text-dim shrink-0" />
          <Select ariaLabel={L('Earlier flight', 'الرحلة السابقة')} value={String(A.k)} onChange={setA} options={opts} className="!h-8 w-[232px]" />
          <span className="text-dim text-[12px]">{L('vs', 'مقابل')}</span>
          <Select ariaLabel={L('Later flight', 'الرحلة اللاحقة')} value={String(B.k)} onChange={setB} options={opts} className="!h-8 w-[232px]" />
        </div>
      </div>

      <div className="relative select-none" style={{ aspectRatio: '16 / 7' }} dir="ltr" data-testid="drone-compare">
        <Frame p={B.p} testId="drone-b" />
        <Frame p={A.p} clip={`inset(0 ${100 - x}% 0 0)`} testId="drone-a" />
        <div className="absolute inset-y-0" style={{ left: `${x}%`, width: 2, background: 'white', boxShadow: '0 0 8px rgba(0,0,0,.6)' }}>
          <span className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 size-8 rounded-full bg-white text-black grid place-items-center shadow"><MoveHorizontal size={16} /></span>
        </div>
        <span className="absolute top-2 left-2 rounded bg-black/65 px-2 py-1 text-[11px] text-white leading-tight">
          <b>{label(A)}</b>
          <br />
          <span className="opacity-80">{fmtPct(A.p, lang)} {L('complete', 'منجز')}</span>
        </span>
        <span className="absolute top-2 right-2 rounded bg-black/65 px-2 py-1 text-[11px] text-white leading-tight text-end">
          <b>{label(B)}</b>
          <br />
          <span className="opacity-80">{fmtPct(B.p, lang)} {L('complete', 'منجز')}</span>
        </span>
        <input type="range" min={2} max={98} value={x} onChange={(e) => setX(Number(e.target.value))} aria-label={L('Drone imagery comparison', 'مقارنة صور الطائرات')} className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize" />
      </div>

      <div className="px-3.5 py-2.5 border-t border-line" data-testid="drone-timeline">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11.5px] text-dim mb-1.5">
          <span className="font-semibold text-ink tabular-nums whitespace-nowrap">{B.t - A.t} {L('days apart', 'يومًا بينهما')}</span>
          <span>·</span>
          <span className="tabular-nums" style={{ color: 'var(--good)' }}>+{delta.toFixed(1)} {L('pp progress between the two flights', 'نقطة مئوية تقدم بين الرحلتين')}</span>
          <span className="ms-auto basis-full sm:basis-auto">{L('Stills are illustrations; dates and % come from the schedule engine', 'الصور توضيحية؛ التواريخ والنسب من محرك الجدول')}</span>
        </div>
        <div className="relative h-7 flex items-center" role="group" aria-label={L('Survey flights', 'رحلات المسح')}>
          <div className="absolute inset-x-0 top-1/2 h-px bg-line-2" />
          <div className="absolute top-1/2 h-[3px] -translate-y-1/2 rounded" style={{ insetInlineStart: `${(A.k / lastK) * 100}%`, width: `${((B.k - A.k) / lastK) * 100}%`, background: 'var(--violet)' }} />
          {flights.map((f) => {
            const sel = f.k === A.k || f.k === B.k;
            return (
              <button
                key={f.k}
                type="button"
                title={label(f)}
                aria-label={label(f)}
                onClick={() => {
                  // clicking a dot moves whichever end is nearer
                  const nearA = Math.abs(f.k - A.k) <= Math.abs(f.k - B.k);
                  setPair(nearA ? { a: f.k, b: B.k } : { a: A.k, b: f.k });
                }}
                className={cx('absolute -translate-x-1/2 rounded-full border transition-all', sel ? 'size-3.5 z-10' : 'size-2 hover:size-3')}
                style={{
                  left: `${(f.k / lastK) * 100}%`,
                  background: sel ? 'var(--violet-solid)' : f.flown ? 'var(--text)' : 'var(--surface)',
                  borderColor: sel ? 'var(--violet)' : f.flown ? 'var(--text)' : 'var(--dim)',
                }}
              />
            );
          })}
        </div>
        <div className="flex justify-between gap-2 text-[10.5px] text-dim mt-0.5 tabular-nums">
          <span>{fmtDate(flights[0].t, lang, 'short')}</span>
          <span style={{ color: 'var(--text)' }}>{L('Data date', 'تاريخ البيانات')} {fmtDate(snap.nowT, lang, 'short')}</span>
          <span>{fmtDate(flights[lastK].t, lang, 'short')} ({L('forecast', 'متوقع')})</span>
        </div>
      </div>
    </Card>
  );
}
