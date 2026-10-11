import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Loader2, Sparkles } from 'lucide-react';
import { Chip, cx } from '../../design/ui';
import type { Bi } from '../../lib/bi';
import type { Lang } from '../../lib/fmt';

/** pick the active language from an EN/AR pair (AI copy is authored inline, side by side) */
export const pick = (b: Bi, lang: Lang) => (lang === 'ar' ? b.ar : b.en);
export const useLang = (): Lang => useTranslation().i18n.language as Lang;

/** reveals `text` character by character; `active=false` shows nothing, `skip` shows everything at once */
export function useTypewriter(text: string, active = true, cps = 120, skipIn = false) {
  const [n, setN] = useState(0);
  const reduced = usePrefersReducedMotion();
  const skip = skipIn || reduced;
  useEffect(() => {
    if (!active) {
      setN(0);
      return;
    }
    if (skip) {
      setN(text.length);
      return;
    }
    setN(0);
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const k = Math.min(text.length, Math.floor(((now - start) / 1000) * cps));
      setN(k);
      if (k < text.length) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [text, active, cps, skip]);
  return { shown: text.slice(0, n), done: n >= text.length && active };
}

/** typed text with a blinking caret while it is still being written */
export function Typed({ text, active = true, cps = 120, skip, className, onDone }: { text: string; active?: boolean; cps?: number; skip?: boolean; className?: string; onDone?: () => void }) {
  const { shown, done } = useTypewriter(text, active, cps, skip);
  const fired = useRef(false);
  useEffect(() => {
    if (done && !fired.current) {
      fired.current = true;
      onDone?.();
    }
    if (!done) fired.current = false;
  }, [done, onDone]);
  return (
    <span className={className}>
      {shown}
      {active && !done && <span className="ai-caret" aria-hidden />}
    </span>
  );
}

/** small violet "AI" label used wherever the AI layer speaks. Honest by design: tooltip says what is scripted. */
export function AiTag({ className, label }: { className?: string; label?: string }) {
  const { t } = useTranslation();
  return (
    <span
      title={t('ai.tagTip')}
      className={cx('inline-flex items-center gap-1 rounded-full px-2 py-[2px] text-[11px] font-bold uppercase tracking-wider whitespace-nowrap leading-[1.4]', className)}
      style={{ background: 'var(--violet)', color: 'var(--violet-ink)' }}
    >
      <Sparkles size={11} />
      {label ?? t('ai.tag')}
    </span>
  );
}

/**
 * The "thinking" trace: a list of steps that tick over one by one (spinner -> check).
 * Calls onDone once the last step has completed. Restarts whenever `runKey` changes.
 */
export function AiSteps({ steps, runKey, stepMs = 520, onDone, className, compact }: { steps: string[]; runKey: number | string; stepMs?: number; onDone?: () => void; className?: string; compact?: boolean }) {
  const [i, setI] = useState(0);
  const cb = useRef(onDone);
  cb.current = onDone;
  useEffect(() => {
    setI(0);
    let k = 0;
    const h = setInterval(() => {
      k++;
      setI(k);
      if (k >= steps.length) {
        clearInterval(h);
        setTimeout(() => cb.current?.(), 250);
      }
    }, stepMs);
    return () => clearInterval(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runKey, steps.length, stepMs]);
  return (
    <ul className={cx('m-0 ps-0 list-none', compact ? 'space-y-0.5' : 'space-y-1', className)} aria-live="polite">
      {steps.slice(0, Math.min(steps.length, i + 1)).map((s, k) => {
        const done = k < i;
        return (
          <li key={k} className="flex items-center gap-2 text-[12px] ai-pop" style={{ color: done ? 'var(--dim)' : 'var(--text)' }}>
            {done ? <Check size={13} style={{ color: 'var(--good)' }} /> : <Loader2 size={13} className="ai-spin" style={{ color: 'var(--violet)' }} />}
            <span>{s}</span>
          </li>
        );
      })}
    </ul>
  );
}

/** indeterminate shimmer bar under a heading while the AI "works" */
export function AiBar({ className }: { className?: string }) {
  return <div className={cx('ai-bar h-1 rounded-full bg-surface-3', className)} aria-hidden />;
}

/** panel wrapper with the violet glow border used by every AI insight block */
export function AiPanel({ title, children, actions, className, glow }: { title: ReactNode; children: ReactNode; actions?: ReactNode; className?: string; glow?: boolean }) {
  return (
    <div className={cx('rounded-xl border-[1.5px] p-3.5 min-w-0', glow && 'ai-glow', className)} style={{ borderColor: 'color-mix(in srgb, var(--violet) 60%, var(--line))', background: 'color-mix(in srgb, var(--violet) 9%, var(--surface))' }}>
      <div className="flex items-center gap-2 mb-2.5 min-w-0">
        <Sparkles size={17} style={{ color: 'var(--violet)' }} />
        <div className="text-[15px] font-bold truncate flex-1" style={{ color: 'var(--violet)' }}>{title}</div>
        <AiTag />
        {actions}
      </div>
      <div className="ai-body">{children}</div>
    </div>
  );
}

/** reduced-motion preference: AI animations jump straight to the end state */
export function usePrefersReducedMotion() {
  const [r, setR] = useState(false);
  useEffect(() => {
    try {
      setR(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    } catch {
      /* ignore */
    }
  }, []);
  return r;
}
