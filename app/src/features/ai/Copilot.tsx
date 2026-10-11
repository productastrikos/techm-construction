import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ExternalLink, Play, Send, Sparkles, Square, X } from 'lucide-react';
import { Btn, Chip, cx } from '../../design/ui';
import { useApp } from '../../app/store';
import { usePack, useSnapshotMaybe } from '../../sim/useSim';
import { AiSteps, AiTag, Typed, pick, useLang } from './kit';
import { DEMO_SCRIPT, FALLBACK, INTENTS, matchIntent, type Action, type Ctx, type Intent, type Reply } from './intents';

interface Msg {
  id: number;
  role: 'user' | 'ai';
  text?: string;
  intent?: Intent;
  /** custom reply (fallback) */
  fixed?: Reply;
}

export const openCopilot = (prompt?: string) => window.dispatchEvent(new CustomEvent('mz:copilot', { detail: { prompt } }));

function AiMessage({ msg, ctx, onDone, instant }: { msg: Msg; ctx: Ctx; onDone: () => void; instant: boolean }) {
  const { t } = useTranslation();
  const nav = useNavigate();
  const [reply, setReply] = useState<Reply | null>(msg.fixed ?? null);
  const [stepsDone, setStepsDone] = useState(!!msg.fixed || instant);
  const [typed, setTyped] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const once = useRef(false);

  useEffect(() => {
    if (msg.fixed || !msg.intent) return;
    let live = true;
    msg.intent
      .answer(ctx)
      .then((r) => live && setReply(r))
      .catch((e) => live && setErr(String(e)));
    return () => {
      live = false;
    };
    // the answer is computed once, at the data date it was asked
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (typed && !once.current) {
      once.current = true;
      onDone();
    }
  }, [typed, onDone]);

  const run = (a: Action) => {
    if (a.href) {
      window.open(a.href, '_blank', 'noopener,noreferrer');
      return;
    }
    if (a.to) nav(a.to);
    if (a.replay) setTimeout(() => window.dispatchEvent(new CustomEvent('mz:replay', { detail: { flow: a.replay } })), 1400);
  };

  const steps = msg.intent?.steps.map((s) => pick(s, ctx.lang)) ?? [];
  return (
    <div className="flex gap-2 items-start ai-pop">
      <span className="mt-0.5 grid place-items-center size-6 rounded-full shrink-0" style={{ background: 'color-mix(in srgb, var(--violet) 22%, transparent)', color: 'var(--violet)' }}>
        <Sparkles size={13} />
      </span>
      <div className="min-w-0 flex-1 space-y-2">
        {steps.length > 0 && (
          <div className="rounded-lg border border-line bg-surface-2 px-2.5 py-2">
            <div className="text-[10px] uppercase tracking-wider text-dim mb-1">{t('ai.trace')}</div>
            <AiSteps steps={steps} runKey={msg.id} stepMs={instant ? 60 : 480} compact onDone={() => setStepsDone(true)} />
          </div>
        )}
        {err && <div className="text-[12px] text-bad">{err}</div>}
        {stepsDone && reply && (
          <>
            <div className="ai-body text-[14.5px] leading-relaxed whitespace-pre-line">
              {typed ? reply.text : <Typed text={reply.text} cps={instant ? 2000 : 210} onDone={() => setTyped(true)} />}
            </div>
            {typed && (
              <div className="space-y-2 ai-pop">
                {reply.sources.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1">
                    <span className="text-[10.5px] text-dim">{t('ai.sources')}:</span>
                    {reply.sources.map((s) => (
                      <Chip key={s} tone="neutral" className="!text-[10px]">
                        {s}
                      </Chip>
                    ))}
                  </div>
                )}
                {reply.actions.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {reply.actions.map((a, i) => (
                      <Btn key={i} size="sm" variant={a.kind === 'primary' ? 'primary' : 'soft'} onClick={() => run(a)} icon={a.href ? <ExternalLink size={13} /> : undefined}>
                        {pick(a.label, ctx.lang)}
                      </Btn>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/** global AI Copilot drawer (header button or Ctrl+J). Answers are computed live from the engines; wording is scripted. */
export function Copilot() {
  const { t } = useTranslation();
  const lang = useLang();
  const pack = usePack();
  const snap = useSnapshotMaybe();
  const simT = useApp((s) => s.simT);
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState('');
  const [auto, setAuto] = useState(false);
  const idRef = useRef(1);
  const scroller = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const autoQ = useRef<string[]>([]);
  const ctx: Ctx | null = snap ? { snap, pack, lang, simT } : null;
  const ctxRef = useRef(ctx);
  ctxRef.current = ctx;

  const scroll = useCallback(() => {
    requestAnimationFrame(() => scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' }));
  }, []);

  const ask = useCallback(
    (question: string, intent?: Intent | null) => {
      if (!question.trim()) return;
      const it = intent ?? matchIntent(question);
      const uid = idRef.current++;
      const aid = idRef.current++;
      setBusy(true);
      setMsgs((m) => [
        ...m,
        { id: uid, role: 'user', text: question },
        it ? { id: aid, role: 'ai', intent: it } : { id: aid, role: 'ai', fixed: FALLBACK(ctxRef.current?.lang ?? 'en') },
      ]);
      scroll();
    },
    [scroll],
  );

  useEffect(() => {
    const on = (e: Event) => {
      setOpen(true);
      const d = (e as CustomEvent<{ prompt?: string; auto?: boolean }>).detail;
      if (d?.auto) {
        setTimeout(() => startAutoRef.current?.(), 350);
        return;
      }
      const p = d?.prompt;
      if (p) {
        const it = INTENTS.find((x) => x.id === p);
        setTimeout(() => ask(it ? pick(it.question, ctxRef.current?.lang ?? 'en') : p, it), 250);
      }
    };
    const key = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === 'Escape') setOpen(false);
    };
    const rst = () => {
      setMsgs([]);
      setBusy(false);
      setDraft('');
      setAuto(false);
      autoQ.current = [];
    };
    window.addEventListener('mz:copilot', on);
    window.addEventListener('mz:reset', rst);
    window.addEventListener('keydown', key);
    return () => {
      window.removeEventListener('mz:reset', rst);
      window.removeEventListener('mz:copilot', on);
      window.removeEventListener('keydown', key);
    };
  }, [ask]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 200);
  }, [open]);

  const finished = useCallback(() => {
    setBusy(false);
    scroll();
  }, [scroll]);

  // ---- "Play AI demo": types each scripted question into the box, sends it, waits for the answer, moves on
  const typeIn = useCallback((q: string, then: () => void) => {
    let i = 0;
    const h = setInterval(() => {
      i++;
      setDraft(q.slice(0, i));
      if (i >= q.length) {
        clearInterval(h);
        setTimeout(then, 450);
      }
    }, 28);
    return h;
  }, []);
  const stopRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const nextAuto = useCallback(() => {
    const id = autoQ.current.shift();
    if (!id) {
      setAuto(false);
      return;
    }
    const it = INTENTS.find((x) => x.id === id)!;
    const q = pick(it.question, ctxRef.current?.lang ?? 'en');
    stopRef.current = typeIn(q, () => {
      setDraft('');
      ask(q, it);
    });
  }, [ask, typeIn]);
  const startAutoRef = useRef<(() => void) | null>(null);
  const startAuto = () => {
    autoQ.current = [...DEMO_SCRIPT];
    setMsgs([]);
    setAuto(true);
    nextAuto();
  };
  startAutoRef.current = startAuto;
  const stopAuto = () => {
    autoQ.current = [];
    if (stopRef.current) clearInterval(stopRef.current);
    setDraft('');
    setAuto(false);
  };
  const onMsgDone = useCallback(() => {
    finished();
    if (autoQ.current.length) setTimeout(nextAuto, 1600);
    else setAuto(false);
  }, [finished, nextAuto]);

  const submit = () => {
    if (busy || !draft.trim()) return;
    ask(draft);
    setDraft('');
  };

  if (!open) return null;
  const lastAiId = [...msgs].reverse().find((m) => m.role === 'ai')?.id;
  return (
    <aside className="fixed z-30 top-14 bottom-0 end-0 w-[min(420px,100vw)] border-s border-line bg-surface flex flex-col shadow-2xl anim-in" data-testid="copilot" aria-label={t('ai.title')}>
      <header className="flex items-center gap-2 px-3.5 h-12 border-b border-line shrink-0">
        <span className="grid place-items-center size-7 rounded-lg" style={{ background: 'color-mix(in srgb, var(--violet) 25%, transparent)', color: 'var(--violet)' }}>
          <Sparkles size={15} />
        </span>
        <div className="min-w-0 flex-1 leading-tight">
          <div className="text-[15px] font-bold truncate" style={{ color: "var(--violet)" }}>{t('ai.title')}</div>
          <div className="text-[10.5px] text-dim truncate">{t('ai.subtitle')}</div>
        </div>
        <AiTag />
        <Btn variant="ghost" size="sm" className="!px-1.5" onClick={() => setOpen(false)} aria-label={t('common.close')}>
          <X size={15} />
        </Btn>
      </header>

      <div ref={scroller} className="flex-1 min-h-0 overflow-auto px-3.5 py-3 space-y-3">
        {msgs.length === 0 && (
          <div className="space-y-3 anim-in">
            <div className="ai-body rounded-xl border p-3 text-[14px] leading-relaxed" style={{ borderColor: "color-mix(in srgb, var(--violet) 50%, var(--line))", background: "color-mix(in srgb, var(--violet) 8%, var(--surface-2))" }}>
              <div className="font-semibold mb-1">{t('ai.hello')}</div>
              <div className="text-muted">{t('ai.helloBody')}</div>
            </div>
            <Btn variant="primary" size="md" className="w-full" icon={<Play size={14} />} onClick={startAuto} disabled={!ctx}>
              {t('ai.play')}
            </Btn>
            <div className="text-[10.5px] uppercase tracking-wider text-dim">{t('ai.try')}</div>
          </div>
        )}
        {msgs.map((m) =>
          m.role === 'user' ? (
            <div key={m.id} className="flex justify-end ai-pop">
              <div className="max-w-[88%] rounded-2xl rounded-ee-md px-3 py-2 text-[12.5px] bg-accent text-accent-ink">{m.text}</div>
            </div>
          ) : (
            ctx && <AiMessage key={m.id} msg={m} ctx={ctx} onDone={m.id === lastAiId ? onMsgDone : () => undefined} instant={m.id !== lastAiId} />
          ),
        )}
        {busy && msgs.length > 0 && <div className="h-1 rounded-full ai-bar bg-surface-3" aria-hidden />}
      </div>

      <div className="border-t border-line p-3 space-y-2 shrink-0">
        <div className={cx('flex flex-wrap gap-1.5', msgs.length > 0 && 'max-h-[64px] overflow-auto')}>
          {INTENTS.map((it) => (
            <button key={it.id} type="button" disabled={busy || !ctx} onClick={() => ask(pick(it.question, lang), it)} className="rounded-full border border-line-2 px-2.5 py-1 text-[11.5px] text-muted hover:text-ink hover:bg-surface-2 disabled:opacity-40 transition-colors">
              {pick(it.chip, lang)}
            </button>
          ))}
        </div>
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <input ref={inputRef} value={draft} onChange={(e) => setDraft(e.target.value)} disabled={auto} placeholder={t('ai.placeholder')} className="flex-1 h-9 rounded-lg border border-line-2 bg-surface-2 px-3 text-[13px] min-w-0" aria-label={t('ai.placeholder')} />
          {auto ? (
            <Btn variant="danger" className="!px-2.5" onClick={stopAuto} aria-label={t('ai.stop')} type="button">
              <Square size={14} />
            </Btn>
          ) : (
            <Btn variant="primary" className="!px-2.5" type="submit" disabled={busy || !draft.trim()} aria-label={t('ai.send')}>
              <Send size={14} className="flip-rtl" />
            </Btn>
          )}
        </form>
        <div className="text-[10.5px] text-dim leading-snug">{t('ai.footer')}</div>
      </div>
    </aside>
  );
}
