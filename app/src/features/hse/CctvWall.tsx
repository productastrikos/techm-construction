import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, ClipboardList, Eye, Maximize2, ScanEye, ShieldAlert, X } from 'lucide-react';
import { Btn, Card, Chip, Dot, cx, toneVar, type Tone } from '../../design/ui';
import { imageUrl } from '../../lib/images';
import { fmtDate, type Lang } from '../../lib/fmt';
import { tx } from '../../lib/bi';
import { useSnapshot } from '../../sim/useSim';
import { CAMERAS, EVENTS, type CameraDef, type HseEvent } from './data';
import { useHse } from './hseStore';
import { AiSteps, Typed } from '../ai/kit';

/** event ids whose SOP text has already been typed out once (so revisiting the tab does not replay it) */
const typedSop = new Set<string>();
export const resetTypedSop = () => typedSop.clear();

const SEV_TONE: Record<HseEvent['severity'], Tone> = { crit: 'bad', warn: 'warn', info: 'info' };

function useClock(): string {
  const [s, setS] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setS((x) => x + 1), 1000);
    return () => clearInterval(id);
  }, []);
  const total = 8 * 3600 + 40 * 60 + s;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(Math.floor(total / 3600) % 24)}:${p(Math.floor(total / 60) % 60)}:${p(total % 60)}`;
}

export function CameraTile({ cam, big, alertOn }: { cam: CameraDef; big?: boolean; alertOn: boolean }) {
  const { i18n } = useTranslation();
  const lang = i18n.language as Lang;
  const snap = useSnapshot();
  const clock = useClock();
  const setFocus = useHse((s) => s.setFocus);
  return (
    <div className={cx('relative rounded-xl overflow-hidden border bg-black group', alertOn ? 'border-bad' : 'border-line')} style={alertOn ? { boxShadow: '0 0 0 1px var(--bad), 0 0 18px color-mix(in srgb, var(--bad) 40%, transparent)' } : undefined} data-cam={cam.id}>
      <div className="relative" style={{ aspectRatio: '16 / 9' }}>
        <img src={imageUrl(cam.image)} alt="" className="absolute inset-0 w-full h-full object-cover" style={{ filter: 'contrast(1.05) saturate(0.85)' }} draggable={false} />
        {/* AI vision sweep */}
        <div className="ai-scanline" style={{ animationDuration: '5.5s', animationIterationCount: 'infinite', animationDelay: `${(cam.id.length % 5) * 0.9}s`, height: 2, opacity: 0.8 }} aria-hidden />
        <div className="absolute top-1.5 inset-x-0 flex justify-center pointer-events-none"><span className="inline-flex items-center gap-1 rounded-full px-1.5 py-[1px] text-[9.5px] font-semibold tracking-wider" style={{ background: 'rgba(120,90,230,.78)', color: '#fff' }}><ScanEye size={10} />AI VISION</span></div>
        {/* scanlines */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.12]" style={{ background: 'repeating-linear-gradient(0deg, #000 0 1px, transparent 1px 3px)' }} />
        {cam.zone && (
          <div className="absolute border-2 border-dashed" style={{ left: `${cam.zone.x}%`, top: `${cam.zone.y}%`, width: `${cam.zone.w}%`, height: `${cam.zone.h}%`, borderColor: alertOn ? '#ff6b6b' : '#f7b84b', background: alertOn ? 'rgba(255,107,107,.12)' : 'rgba(247,184,75,.08)' }}>
            <span className="absolute -top-4 start-0 text-[10px] font-semibold px-1 rounded" style={{ background: alertOn ? '#ff6b6b' : '#f7b84b', color: '#111' }}>{tx(cam.zone.label, lang)}</span>
          </div>
        )}
        {cam.detections.map((d, i) => {
          const hot = d.tone === 'bad' && !alertOn ? false : true;
          if (!hot) return null;
          const c = toneVar[d.tone === 'good' ? 'good' : d.tone];
          return (
            <div key={i} className="absolute ai-pop" style={{ animationDelay: `${0.3 + i * 0.28}s`, left: `${d.x}%`, top: `${d.y}%`, width: `${d.w}%`, height: `${d.h}%`, border: `2px solid ${c}`, boxShadow: d.tone === 'bad' ? `0 0 10px ${c}` : undefined }}>
              <span className="absolute -top-[15px] start-[-2px] whitespace-nowrap text-[9.5px] font-semibold leading-none px-1 py-[2px]" style={{ background: c, color: '#0a1416' }}>
                {d.label} {Math.round(d.conf * 100)}%
              </span>
            </div>
          );
        })}
        <div className="absolute top-1.5 start-2 text-[11px] font-mono text-white/90 drop-shadow">{cam.id}</div>
        <div className="absolute bottom-1.5 start-2 text-[11px] font-mono text-white/90 drop-shadow">{fmtDate(snap.nowT, 'en', 'med')} {clock}</div>
        {!big && (
          <button type="button" aria-label="Maximise" onClick={() => setFocus(cam.id)} className="absolute bottom-1 end-1.5 size-6 rounded bg-black/55 text-white/90 opacity-0 group-hover:opacity-100 transition-opacity grid place-items-center">
            <Maximize2 size={13} />
          </button>
        )}
        {alertOn && <div className="absolute top-8 start-2 ai-pop"><Chip tone="bad" dot className="!bg-black/60">ALERT - AI</Chip></div>}
      </div>
      <div className="flex items-center justify-between px-2.5 py-1.5 bg-surface text-[12px]">
        <span className="font-medium truncate">{tx(cam.name, lang)}</span>
        <span className="text-dim num">{cam.detections.length} obj</span>
      </div>
    </div>
  );
}

/** the AI drafts the SOP step live (typed once per event) */
function SopText({ id, text }: { id: string; text: string }) {
  const first = useRef(!typedSop.has(id));
  const [steps, setSteps] = useState(first.current);
  useEffect(() => {
    typedSop.add(id);
  }, [id]);
  if (!first.current) return <span>{text}</span>;
  return steps ? <AiSteps steps={[lang0(text)]} runKey={id} stepMs={450} compact onDone={() => setSteps(false)} /> : <Typed text={text} cps={160} />;
}
const lang0 = (_text: string) => (document.documentElement.lang === 'ar' ? 'مطابقة الحدث مع مكتبة الإجراءات...' : 'Matching the event to the SOP library...');

export function EventFeed() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Lang;
  const { events, ack, sop, createWo, workOrders } = useHse();
  return (
    <Card title={t('hse.events.title')} subtitle={t('hse.events.sub')} sim="rule" className="min-h-0" bodyClass="overflow-auto space-y-2">
      {EVENTS.map((ev) => {
        const st = events[ev.id] ?? 'new';
        const tone = SEV_TONE[ev.severity];
        const wo = workOrders.find((w) => w.eventId === ev.id);
        return (
          <div key={ev.id} className="rounded-lg border p-2.5" style={{ borderColor: `color-mix(in srgb, ${toneVar[tone]} ${st === 'new' ? 50 : 20}%, var(--line))`, background: st === 'new' && ev.severity === 'crit' ? 'color-mix(in srgb, var(--bad) 8%, transparent)' : undefined }} data-event={ev.id}>
            <div className="flex items-start gap-2">
              <Dot tone={tone} pulse={st === 'new' && ev.severity === 'crit'} />
              <div className="min-w-0 flex-1">
                <div className="text-[12.5px] font-medium leading-snug">{tx(ev.title, lang)}</div>
                <div className="text-[11px] text-dim">{ev.cam} - {ev.minsAgo} {t('hse.minAgo')}</div>
              </div>
              <Chip tone={st === 'new' ? tone : st === 'wo' ? 'good' : 'info'}>{t(`hse.state.${st}`)}</Chip>
            </div>
            {(st === 'sop' || st === 'wo') && <div className="mt-1.5 rounded bg-surface-2 px-2 py-1.5 text-[11.5px] text-muted flex gap-1.5"><ShieldAlert size={13} className="shrink-0 mt-0.5" style={{ color: toneVar.warn }} /><SopText id={ev.id} text={tx(ev.sop, lang)} /></div>}
            {wo && <div className="mt-1.5 text-[11.5px] flex items-center gap-1.5" style={{ color: toneVar.good }}><Check size={13} />{wo.id} - {t('hse.woCreated')} ({wo.assignee})</div>}
            <div className="mt-2 flex gap-1.5 flex-wrap">
              <Btn size="sm" variant="ghost" icon={<Eye size={13} />} onClick={() => ack(ev.id)} disabled={st !== 'new'}>{t('hse.act.ack')}</Btn>
              <Btn size="sm" variant="soft" icon={<ShieldAlert size={13} />} onClick={() => sop(ev.id)} disabled={st === 'sop' || st === 'wo'}>{t('hse.act.sop')}</Btn>
              <Btn size="sm" variant={ev.severity === 'crit' ? 'primary' : 'outline'} icon={<ClipboardList size={13} />} onClick={() => createWo(ev.id, ev.cam, tx(ev.title, 'en'))} disabled={st === 'wo'}>{t('hse.act.wo')}</Btn>
            </div>
          </div>
        );
      })}
    </Card>
  );
}

export function CctvWall() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Lang;
  const events = useHse((s) => s.events);
  const focus = useHse((s) => s.focus);
  const setFocus = useHse((s) => s.setFocus);
  const alertCams = new Set(EVENTS.filter((e) => e.severity === 'crit' && (events[e.id] ?? 'new') !== 'wo').map((e) => e.cam));
  const f = CAMERAS.find((c) => c.id === focus);
  return (
    <div className="grid gap-3 xl:grid-cols-[minmax(0,1.7fr)_minmax(340px,1fr)]" data-testid="cctv-wall">
      <div className="grid gap-3 sm:grid-cols-2 content-start">
        {CAMERAS.map((c) => (
          <CameraTile key={c.id} cam={c} alertOn={alertCams.has(c.id)} />
        ))}
        <div className="sm:col-span-2 text-[11.5px] text-dim flex items-center gap-2">{t('hse.cctv.note')}</div>
      </div>
      <EventFeed />
      {f && (
        <div className="fixed inset-0 z-50 bg-black/70 grid place-items-center p-6" onClick={() => setFocus(null)} role="dialog" aria-label={tx(f.name, lang)}>
          <div className="w-full max-w-[980px]" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-end mb-1.5"><Btn size="sm" variant="soft" icon={<X size={14} />} onClick={() => setFocus(null)}>{t('common.close')}</Btn></div>
            <CameraTile cam={f} big alertOn={alertCams.has(f.id)} />
          </div>
        </div>
      )}
    </div>
  );
}
