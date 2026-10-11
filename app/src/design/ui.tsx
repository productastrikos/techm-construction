import { type ReactNode, type ButtonHTMLAttributes, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { openKpi } from '../features/kpi/kpiStore';

export type Tone = 'good' | 'bad' | 'warn' | 'info' | 'violet' | 'neutral' | 'accent';

export const toneVar: Record<Tone, string> = {
  good: 'var(--good)',
  bad: 'var(--bad)',
  warn: 'var(--warn)',
  info: 'var(--info)',
  violet: 'var(--violet)',
  neutral: 'var(--muted)',
  accent: 'var(--accent)',
};

export function cx(...a: Array<string | false | null | undefined>) {
  return a.filter(Boolean).join(' ');
}

/* ------------------------------------------------------------------ Card */
export function Card({
  title,
  subtitle,
  actions,
  children,
  className,
  bodyClass,
  sim,
  style,
  id,
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
  bodyClass?: string;
  sim?: boolean | 'rule';
  style?: CSSProperties;
  id?: string;
}) {
  return (
    <section id={id} style={style} className={cx('rounded-xl border border-line bg-surface shadow-[var(--shadow)] flex flex-col min-h-0 min-w-0', className)}>
      {(title || actions || sim) && (
        <header className="flex items-start gap-2 px-3.5 pt-2.5 pb-1.5 min-w-0">
          <div className="min-w-0 flex-1">
            {title && <h3 className="m-0 text-[12.5px] font-semibold uppercase tracking-[0.06em] text-ink truncate">{title}</h3>}
            {subtitle && <div className="text-[11.5px] text-dim truncate">{subtitle}</div>}
          </div>
          {sim && <SimChip rule={sim === 'rule'} />}
          {actions && <div className="flex items-center gap-1.5 shrink-0">{actions}</div>}
        </header>
      )}
      <div className={cx('flex-1 min-h-0 px-3.5 pb-3', !title && !actions && 'pt-3', bodyClass)}>{children}</div>
    </section>
  );
}

/* ------------------------------------------------------------------ Chip */
export function Chip({ tone = 'neutral', children, className, title, dot }: { tone?: Tone; children: ReactNode; className?: string; title?: string; dot?: boolean }) {
  const c = toneVar[tone];
  return (
    <span
      title={title}
      className={cx('inline-flex items-center gap-1 rounded-full border px-2 py-[1px] text-[11px] font-medium whitespace-nowrap leading-[1.5]', className)}
      style={{ color: c, borderColor: `color-mix(in srgb, ${c} 45%, transparent)`, background: `color-mix(in srgb, ${c} 12%, transparent)` }}
    >
      {dot && <span className="inline-block size-1.5 rounded-full" style={{ background: c }} />}
      {children}
    </span>
  );
}

/** data-origin chips are hidden for client presentations (the README still lists what is simulated) */
export function SimChip(_props: { rule?: boolean; className?: string }) {
  return null;
}

/* ------------------------------------------------------------------ Button */
type BtnVariant = 'primary' | 'ghost' | 'outline' | 'danger' | 'soft';
export function Btn({
  variant = 'outline',
  size = 'md',
  icon,
  children,
  className,
  ...rest
}: { variant?: BtnVariant; size?: 'sm' | 'md' | 'lg'; icon?: ReactNode } & ButtonHTMLAttributes<HTMLButtonElement>) {
  const base = 'inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed select-none whitespace-nowrap';
  const sz = size === 'sm' ? 'h-7 px-2.5 text-[12px]' : size === 'lg' ? 'h-10 px-4 text-[14px]' : 'h-8 px-3 text-[13px]';
  const v: Record<BtnVariant, string> = {
    primary: 'bg-accent text-accent-ink hover:brightness-110 border border-transparent',
    outline: 'border border-line-2 bg-transparent text-ink hover:bg-surface-2',
    ghost: 'border border-transparent bg-transparent text-muted hover:text-ink hover:bg-surface-2',
    soft: 'border border-transparent bg-surface-3 text-ink hover:brightness-110',
    danger: 'border border-transparent bg-bad text-white hover:brightness-110',
  };
  return (
    <button type="button" {...rest} className={cx(base, sz, v[variant], className)}>
      {icon}
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ Segmented */
export function Seg<T extends string | number>({
  options,
  value,
  onChange,
  size = 'md',
  className,
  ariaLabel,
}: {
  options: Array<{ value: T; label: ReactNode; title?: string; tone?: Tone }>;
  value: T;
  onChange: (v: T) => void;
  size?: 'sm' | 'md';
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <div role="group" aria-label={ariaLabel} className={cx('inline-flex rounded-lg border border-line-2 bg-surface-2 p-0.5 gap-0.5', className)}>
      {options.map((o) => {
        const on = o.value === value;
        const c = o.tone ? toneVar[o.tone] : 'var(--accent)';
        return (
          <button
            key={String(o.value)}
            data-value={String(o.value)}
            type="button"
            title={o.title}
            aria-pressed={on}
            onClick={() => onChange(o.value)}
            className={cx('rounded-md font-medium transition-colors whitespace-nowrap', size === 'sm' ? 'px-2 h-6 text-[11.5px]' : 'px-3 h-7 text-[12.5px]', on ? '' : 'text-muted hover:text-ink')}
            style={on ? { background: `color-mix(in srgb, ${c} 22%, transparent)`, color: c, boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${c} 50%, transparent)` } : undefined}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ Kpi */
export function Kpi({
  label,
  value,
  unit,
  delta,
  deltaTone,
  tone = 'neutral',
  hint,
  spark,
  onClick,
  className,
  sim,
  compact,
}: {
  label: ReactNode;
  value: ReactNode;
  unit?: ReactNode;
  delta?: ReactNode;
  deltaTone?: Tone;
  tone?: Tone;
  hint?: ReactNode;
  spark?: number[];
  onClick?: () => void;
  className?: string;
  sim?: boolean;
  compact?: boolean;
}) {
  const c = toneVar[tone === 'neutral' ? 'accent' : tone];
  const inner = (
    <>
      <div className="flex items-center gap-1.5 text-[11.5px] text-muted font-medium truncate">
        <span className="truncate">{label}</span>
      </div>
      <div className="mt-0.5 flex items-baseline gap-1.5 min-w-0">
        <span className={cx('leading-tight font-semibold tracking-tight num', compact ? 'text-[19px]' : 'text-[24px]')} style={{ color: tone === 'neutral' ? 'var(--text)' : c }}>
          {value}
        </span>
        {unit && <span className="text-[12px] text-dim">{unit}</span>}
        {delta != null && (
          <span className="text-[11.5px] font-medium ms-auto num" style={{ color: toneVar[deltaTone ?? 'neutral'] }}>
            {delta}
          </span>
        )}
      </div>
      {hint && !compact && <div className="text-[11px] text-dim truncate">{hint}</div>}
      {spark && spark.length > 1 && <Spark data={spark} color={c} className="absolute bottom-0 end-0 opacity-70" />}
    </>
  );
  // every KPI tile opens the detail panel (value, 7 / 30 day prediction); the tile's own navigation becomes "Open full page"
  const text = (n: ReactNode) => (typeof n === 'string' ? n : typeof n === 'number' ? String(n) : undefined);
  const lbl = text(label);
  const val = text(value);
  const panel = lbl && val ? () => openKpi({ label: lbl, value: val, unit: text(unit), hint: text(hint), delta: text(delta), tone, goto: onClick }) : onClick;
  const cls = cx('rounded-xl border border-line bg-surface shadow-[var(--shadow)] text-start min-w-0 relative overflow-hidden', compact ? 'px-3 py-1.5' : 'px-3.5 py-2.5', panel && 'hover:bg-surface-2 transition-colors cursor-pointer', className);
  return panel ? (
    <button type="button" onClick={panel} className={cls} data-kpi={lbl}>
      {inner}
    </button>
  ) : (
    <div className={cls}>{inner}</div>
  );
}

export function Spark({ data, color = 'var(--accent)', w = 84, h = 28, className, fill = true }: { data: number[]; color?: string; w?: number; h?: number; className?: string; fill?: boolean }) {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const pts = data.map((v, i) => [(i / (data.length - 1)) * w, h - 3 - ((v - min) / span) * (h - 6)] as const);
  const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className={className} aria-hidden style={{ direction: 'ltr' }}>
      {fill && <path d={`${d} L${w},${h} L0,${h} Z`} fill={color} opacity={0.12} />}
      <path d={d} fill="none" stroke={color} strokeWidth={1.6} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

/* ------------------------------------------------------------------ Progress */
export function Bar({ value, tone = 'accent', height = 6, track = true, label }: { value: number; tone?: Tone; height?: number; track?: boolean; label?: string }) {
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className="rounded-full overflow-hidden w-full" style={{ height, background: track ? 'var(--surface-3)' : 'transparent' }} role="progressbar" aria-valuenow={Math.round(v * 100)} aria-label={label}>
      <div className="h-full rounded-full" style={{ width: `${v * 100}%`, background: toneVar[tone] }} />
    </div>
  );
}

/* ------------------------------------------------------------------ Tabs */
export function Tabs<T extends string>({ tabs, value, onChange, className }: { tabs: Array<{ id: T; label: ReactNode; badge?: ReactNode }>; value: T; onChange: (v: T) => void; className?: string }) {
  return (
    <div role="tablist" className={cx('flex items-end gap-1 border-b border-line', className)}>
      {tabs.map((tb) => {
        const on = tb.id === value;
        return (
          <button
            key={tb.id}
            role="tab"
            aria-selected={on}
            type="button"
            onClick={() => onChange(tb.id)}
            className={cx('px-3.5 h-9 text-[13px] font-medium -mb-px border-b-2 transition-colors flex items-center gap-1.5', on ? 'border-accent text-ink' : 'border-transparent text-muted hover:text-ink')}
          >
            {tb.label}
            {tb.badge}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ Misc */
export function Field({ label, children, hint, className }: { label: ReactNode; children: ReactNode; hint?: ReactNode; className?: string }) {
  return (
    <label className={cx('block min-w-0', className)}>
      <span className="block text-[11.5px] text-muted font-medium mb-1">{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-dim mt-0.5">{hint}</span>}
    </label>
  );
}

export function Slider({ value, min, max, step = 1, onChange, ariaLabel, className }: { value: number; min: number; max: number; step?: number; onChange: (v: number) => void; ariaLabel?: string; className?: string }) {
  return (
    <input
      type="range"
      aria-label={ariaLabel}
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className={cx('w-full accent-[var(--accent)] cursor-pointer', className)}
    />
  );
}

export function Select<T extends string>({ value, onChange, options, className, ariaLabel }: { value: T; onChange: (v: T) => void; options: Array<{ value: T; label: string }>; className?: string; ariaLabel?: string }) {
  return (
    <select
      aria-label={ariaLabel}
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className={cx('h-8 rounded-lg border border-line-2 bg-surface-2 px-2 text-[13px] text-ink min-w-0', className)}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function Toggle({ on, onChange, label, className }: { on: boolean; onChange: (b: boolean) => void; label?: ReactNode; className?: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)} className={cx('inline-flex items-center gap-2 text-[12.5px] text-ink', className)}>
      <span className="relative inline-block h-[18px] w-8 rounded-full transition-colors shrink-0" style={{ background: on ? 'var(--accent)' : 'var(--surface-3)' }}>
        <span className="absolute top-[2px] size-[14px] rounded-full bg-white transition-all" style={{ insetInlineStart: on ? 16 : 2 }} />
      </span>
      {label}
    </button>
  );
}

export function Empty({ title, hint, icon }: { title: ReactNode; hint?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="h-full w-full flex flex-col items-center justify-center gap-2 text-center text-muted py-10">
      {icon}
      <div className="text-[13px] font-medium">{title}</div>
      {hint && <div className="text-[12px] text-dim max-w-sm">{hint}</div>}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions, sim }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; sim?: boolean | 'rule' }) {
  return (
    <div className="flex items-center gap-3 px-5 pt-3.5 pb-2.5 min-w-0">
      <div className="min-w-0 flex-1">
        <h1 className="m-0 text-[19px] font-semibold tracking-tight truncate">{title}</h1>
        {subtitle && <div className="text-[12.5px] text-muted truncate">{subtitle}</div>}
      </div>
      {sim && <SimChip rule={sim === 'rule'} />}
      {actions}
    </div>
  );
}

export function Dot({ tone = 'good', pulse }: { tone?: Tone; pulse?: boolean }) {
  return <span className={cx('inline-block size-2 rounded-full', pulse && 'pulse-bad')} style={{ background: toneVar[tone] }} />;
}

export function Th({ children, className, align }: { children?: ReactNode; className?: string; align?: 'start' | 'end' | 'center' }) {
  return <th className={cx('px-2.5 py-1.5 text-[11px] uppercase tracking-wider font-semibold text-dim whitespace-nowrap', align === 'end' ? 'text-end' : align === 'center' ? 'text-center' : 'text-start', className)}>{children}</th>;
}
export function Td({ children, className, align, title }: { children?: ReactNode; className?: string; align?: 'start' | 'end' | 'center'; title?: string }) {
  return (
    <td title={title} className={cx('px-2.5 py-1.5 text-[12.5px] border-t border-line', align === 'end' ? 'text-end' : align === 'center' ? 'text-center' : 'text-start', className)}>
      {children}
    </td>
  );
}

/** a number that must stay LTR/tabular inside RTL text */
export function N({ children }: { children: ReactNode }) {
  return <span className="num">{children}</span>;
}
