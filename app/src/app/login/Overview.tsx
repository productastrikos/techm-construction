import { useMemo, useState, type ReactNode } from 'react';
import { ChevronRight, Languages, LayoutPanelTop, MessageSquare, MousePointerClick, Palette, Sparkles, UserRound, Users } from 'lucide-react';
import { Seg, toneVar, type Tone } from '../../design/ui';
import { buildSeries, TIMEFRAMES, type KpiSeries, type KpiSpec, type Timeframe } from '../../features/kpi/forecast';

const V = 'var(--violet)';

interface Sample extends KpiSpec {
  group: string;
  tone: Tone;
  what: string;
  source: string;
}

/** sample values only: the live numbers come from the simulation engines once signed in */
const SAMPLES: Sample[] = [
  { group: 'Programme', label: 'Forecast completion', value: '24 Mar 2029', delta: '+12 d', tone: 'warn', hint: 'Baseline 12 Mar 2029', what: 'The date the critical path is expected to finish, re-run by the CPM engine on current progress.', source: 'CPM engine' },
  { group: 'Programme', label: 'SPI', value: '0.94', tone: 'warn', hint: 'Schedule performance', what: 'Earned value divided by planned value. Below 1.00 means the programme is behind plan.', source: 'EVM engine' },
  { group: 'Programme', label: 'Critical activities', value: '41', tone: 'info', hint: 'Zero or negative float', what: 'Activities with no float: any slip here moves the finish date.', source: 'CPM engine' },
  { group: 'Cost', label: 'CPI', value: '0.97', tone: 'warn', hint: 'Cost performance', what: 'Earned value divided by actual cost. Below 1.00 means over budget for the work done.', source: 'EVM engine' },
  { group: 'Cost', label: 'EAC', value: '1,842', unit: 'M AED', tone: 'warn', hint: 'Estimate at completion', what: 'Budget divided by CPI: where the final cost lands if current cost performance continues.', source: 'EVM engine' },
  { group: 'Cost', label: 'TCPI', value: '1.03', tone: 'good', hint: 'To-complete index', what: 'The cost performance needed from now on to finish on budget.', source: 'EVM engine' },
  { group: 'Supply chain', label: 'POs at risk', value: '5', tone: 'warn', hint: 'of 32 purchase orders', what: 'Open purchase orders whose float is shorter than their forecast delivery slip.', source: 'Procurement model' },
  { group: 'Supply chain', label: 'Material at risk', value: '86', unit: 'M AED', tone: 'warn', hint: 'Value of the at-risk POs', what: 'Contract value of the purchase orders flagged above.', source: 'Procurement model' },
  { group: 'Supply chain', label: 'POs on exposed routes', value: '7', tone: 'info', hint: 'Chokepoint-exposed', what: 'Open orders travelling through a strait or port that a what-if scenario can close.', source: 'Route model' },
  { group: 'Fleet', label: 'Fleet availability', value: '92.6%', tone: 'good', hint: '27 machines', what: 'Share of the fleet fit for work right now.', source: 'Degradation model' },
  { group: 'Fleet', label: 'Lowest asset health', value: '58', tone: 'warn', hint: 'CC-02 (crane)', what: 'Health score (0-100) of the weakest machine, with a 14-day failure probability behind it.', source: 'Degradation model' },
  { group: 'HSE', label: 'Days without LTI', value: '214', unit: 'days', tone: 'good', hint: 'Since last lost-time injury', what: 'Counts up until the next lost-time injury is recorded.', source: 'HSE register' },
  { group: 'HSE', label: 'LTIFR', value: '0.32', tone: 'good', hint: 'Per million hours', what: 'Lost-time injury frequency rate.', source: 'HSE register' },
  { group: 'HSE', label: 'Open camera events', value: '2', tone: 'warn', hint: 'Awaiting acknowledgement', what: 'Detections from site cameras (exclusion zones, PPE) that nobody has acknowledged yet.', source: 'Video analytics (simulated)' },
  { group: 'Documents', label: 'Open RFIs', value: '18', tone: 'warn', hint: '3 overdue', what: 'Requests for information still waiting for an answer.', source: 'Document register' },
  { group: 'Documents', label: 'Open NCRs', value: '6', tone: 'warn', hint: 'Non-conformance reports', what: 'Quality non-conformances not yet closed out.', source: 'Document register' },
];

const GROUPS = ['Programme', 'Cost', 'Supply chain', 'Fleet', 'HSE', 'Documents'];
const STATUS: Record<string, string> = { good: 'On track', warn: 'Watch', bad: 'At risk', info: 'Updated live', neutral: 'Updated live' };

function Card({ s, on, onPick }: { s: Sample; on: boolean; onPick: () => void }) {
  const c = s.tone === 'neutral' ? 'var(--text)' : toneVar[s.tone];
  return (
    <button
      type="button"
      onClick={onPick}
      aria-pressed={on}
      data-testid="ov-kpi"
      className="group text-start rounded-xl border bg-surface px-3.5 py-2.5 min-w-0 transition-colors hover:bg-surface-2"
      style={{ borderColor: on ? 'color-mix(in srgb, var(--violet) 70%, transparent)' : 'var(--line)', boxShadow: on ? '0 0 0 2px color-mix(in srgb, var(--violet) 25%, transparent)' : undefined }}
    >
      <div className="text-[11.5px] text-muted font-medium truncate">{s.label}</div>
      <div className="mt-0.5 flex items-baseline gap-1.5">
        <span className="text-[24px] leading-tight font-semibold tracking-tight tabular-nums" style={{ color: c }}>{s.value}</span>
        {s.unit && <span className="text-[12px] text-dim">{s.unit}</span>}
        {s.delta && <span className="ms-auto text-[11.5px] font-medium" style={{ color: c }}>{s.delta}</span>}
      </div>
      <div className="text-[11px] text-dim truncate">{s.hint}</div>
      <div className="mt-1.5 pt-1.5 border-t border-line flex items-center text-[10.5px] uppercase tracking-wider">
        <span className="inline-flex items-center gap-1 font-bold" style={{ color: s.tone === 'info' || s.tone === 'neutral' ? 'var(--dim)' : toneVar[s.tone] }}>
          <span className="size-1.5 rounded-full" style={{ background: s.tone === 'info' || s.tone === 'neutral' ? 'var(--dim)' : toneVar[s.tone] }} />
          {STATUS[s.tone]}
        </span>
        <span className="ms-auto normal-case text-[11.5px] font-semibold inline-flex items-center gap-0.5" style={{ color: V }}>
          <Sparkles size={11} /> Details <ChevronRight size={12} className="transition-transform group-hover:translate-x-0.5" />
        </span>
      </div>
    </button>
  );
}

function Mini({ s, forecast }: { s: KpiSeries; forecast: boolean }) {
  const W = 420;
  const H = 130;
  const pad = 6;
  const all = [...s.actual, ...(forecast ? [...s.forecast, ...s.lower, ...s.upper] : [])].filter((v): v is number => v != null);
  const lo = Math.min(...all);
  const hi = Math.max(...all);
  const span = hi - lo || 1;
  const n = s.labels.length;
  const x = (i: number) => pad + (i / (n - 1)) * (W - 2 * pad);
  const y = (v: number) => H - pad - ((v - lo) / span) * (H - 2 * pad);
  const path = (a: Array<number | null>) => a.map((v, i) => (v == null ? '' : `${a[i - 1] == null || i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`)).join(' ');
  const up = s.upper.map((v, i) => (v == null ? null : [x(i), y(v)] as const)).filter(Boolean) as Array<readonly [number, number]>;
  const dn = s.lower.map((v, i) => (v == null ? null : [x(i), y(v)] as const)).filter(Boolean) as Array<readonly [number, number]>;
  const band = up.length ? `M${up.map(([a, b]) => `${a.toFixed(1)},${b.toFixed(1)}`).join(' L')} L${[...dn].reverse().map(([a, b]) => `${a.toFixed(1)},${b.toFixed(1)}`).join(' L')} Z` : '';
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-[130px]" role="img" aria-label="Trend and forecast">
      {forecast && band && <path d={band} fill="var(--violet)" opacity="0.16" />}
      <path d={path(s.actual)} fill="none" stroke="var(--info)" strokeWidth="2.4" strokeLinejoin="round" />
      {forecast && <path d={path(s.forecast)} fill="none" stroke="var(--violet)" strokeWidth="2.4" strokeDasharray="6 4" />}
      <line x1={x(s.nowIndex)} x2={x(s.nowIndex)} y1={2} y2={H - 2} stroke="var(--dim)" strokeDasharray="2 3" />
      <text x={x(s.nowIndex) + 4} y={12} fontSize="10" fill="var(--dim)">NOW</text>
    </svg>
  );
}

function Preview({ s }: { s: Sample }) {
  const [tf, setTf] = useState<Timeframe>(30);
  const [fc, setFc] = useState(true);
  const series = useMemo(() => buildSeries(s, 'en', tf, (d) => `${d > 0 ? '+' : ''}${d}d`), [s, tf]);
  const st = series?.stats;
  const tone = st?.worsening ? 'var(--bad)' : st?.improving ? 'var(--good)' : 'var(--dim)';
  return (
    <aside className="rounded-2xl border border-line bg-surface p-4 lg:sticky lg:top-4 self-start" data-testid="ov-preview">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-[11px] uppercase tracking-wider font-bold" style={{ color: V }}>KPI detail panel · preview</div>
          <div className="text-[16px] font-semibold text-ink truncate">{s.label}</div>
        </div>
        <span className="text-[26px] font-semibold tabular-nums" style={{ color: s.tone === 'neutral' ? 'var(--text)' : toneVar[s.tone] }}>{s.value}</span>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 mt-3">
        <Seg<Timeframe> size="sm" ariaLabel="Days" value={tf} onChange={setTf} options={TIMEFRAMES.map((d) => ({ value: d, label: `${d}D` }))} />
        <button type="button" role="switch" aria-checked={fc} onClick={() => setFc((v) => !v)} className="h-7 px-2.5 rounded-lg text-[11.5px] font-semibold border" style={fc ? { color: V, borderColor: 'color-mix(in srgb, var(--violet) 55%, transparent)', background: 'color-mix(in srgb, var(--violet) 12%, transparent)' } : { color: 'var(--muted)', borderColor: 'var(--line-2)' }}>
          Forecast {fc ? 'on' : 'off'}
        </button>
      </div>
      <div className="mt-2 rounded-xl border border-line bg-surface-2 px-2 pt-2">{series && <Mini s={series} forecast={fc} />}</div>
      {series && st && fc && (
        <div className="grid grid-cols-3 gap-2 mt-2.5 text-center">
          <div className="rounded-lg border border-line py-1.5"><div className="text-[15px] font-semibold tabular-nums" style={{ color: V }}>{series.fmt(st.fEnd)}</div><div className="text-[10.5px] text-dim">in {tf} days</div></div>
          <div className="rounded-lg border border-line py-1.5"><div className="text-[15px] font-semibold tabular-nums">{st.band}</div><div className="text-[10.5px] text-dim">95% range</div></div>
          <div className="rounded-lg border border-line py-1.5"><div className="text-[15px] font-semibold tabular-nums" style={{ color: tone }}>{st.confidence}%</div><div className="text-[10.5px] text-dim">confidence</div></div>
        </div>
      )}
      <div className="mt-3 rounded-xl border-[1.5px] p-3" style={{ borderColor: 'color-mix(in srgb, var(--violet) 60%, var(--line))', background: 'color-mix(in srgb, var(--violet) 9%, var(--surface))' }}>
        <div className="flex items-center gap-1.5 text-[13px] font-bold mb-1" style={{ color: V }}><Sparkles size={14} /> AI advisory</div>
        <p className="m-0 text-[13.5px] leading-snug font-semibold" style={{ color: 'color-mix(in srgb, var(--violet) 52%, var(--text))' }}>
          {series && st ? `Expected ${series.fmt(st.fEnd)} in ${tf} days — ${st.worsening ? 'drifting the wrong way' : st.improving ? 'trending the right way' : 'broadly stable'}. Drivers and Apply actions appear in the live panel.` : ''}
        </p>
      </div>
      <dl className="m-0 mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[12.5px]">
        <dt className="text-dim">Measures</dt>
        <dd className="m-0 text-muted">{s.what}</dd>
        <dt className="text-dim">Source</dt>
        <dd className="m-0 text-muted">{s.source}</dd>
      </dl>
    </aside>
  );
}

function Tile({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-3.5">
      <div className="flex items-center gap-2 text-[13.5px] font-bold text-ink mb-1">
        <span className="text-accent">{icon}</span>
        {title}
      </div>
      <p className="m-0 text-[12.5px] leading-relaxed text-muted">{children}</p>
    </div>
  );
}

const PATH: Array<[string, string]> = [
  ['Portfolio', 'The morning briefing writes itself. Click a KPI card and use the 7D to 90D filter and the Forecast button.'],
  ['Digital Twin', 'Opens on the live crane incident: read the AI insight, then Create ticket or Act & Assign.'],
  ['Work Orders', 'Watch the ticket arrive in the external tool and change status.'],
  ['Procurement', 'Run the AI scan on purchase orders and read the re-route recommendations.'],
  ['What-if', 'Run the Hormuz closure and compare cost and recovery options.'],
  ['Reports', 'Generate the executive summary with AI, then open S!a Excel-lence.'],
];

function H({ n, children, sub }: { n: string; children: ReactNode; sub?: string }) {
  return (
    <div className="mb-3">
      <div className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: V }}>{n}</div>
      <h2 className="m-0 text-[20px] font-bold tracking-tight text-ink">{children}</h2>
      {sub && <p className="m-0 mt-1 text-[13px] text-dim max-w-[80ch]">{sub}</p>}
    </div>
  );
}

/** the "KPI cards and UI/UX" overview tab of the sign-in page */
export function Overview() {
  const [sel, setSel] = useState(0);
  return (
    <div className="space-y-9" data-testid="login-overview">
      <section>
        <H n="1 · Anatomy" sub="Every KPI card follows the same pattern. The violet Details link is the cue that the card opens a panel with more information.">How to read a KPI card</H>
        <div className="grid md:grid-cols-[300px_1fr] gap-4 items-start">
          <div className="relative rounded-xl border bg-surface px-3.5 py-2.5" style={{ borderColor: 'color-mix(in srgb, var(--violet) 55%, var(--line))' }}>
            <div className="text-[11.5px] text-muted font-medium">SPI <Num n={1} /></div>
            <div className="mt-0.5 flex items-baseline gap-1.5">
              <span className="text-[24px] leading-tight font-semibold tabular-nums text-warn">0.94</span>
              <span className="ms-auto text-[11.5px] font-medium text-warn">-0.03 <Num n={3} /></span>
            </div>
            <div className="text-[11px] text-dim">Schedule performance <Num n={2} /></div>
            <div className="mt-1.5 pt-1.5 border-t border-line flex items-center text-[10.5px] uppercase tracking-wider">
              <span className="inline-flex items-center gap-1 font-bold text-warn"><span className="size-1.5 rounded-full bg-warn" /> Watch <Num n={4} /></span>
              <span className="ms-auto normal-case text-[11.5px] font-semibold inline-flex items-center gap-0.5" style={{ color: V }}><Sparkles size={11} /> Details <ChevronRight size={12} /> <Num n={5} /></span>
            </div>
          </div>
          <ol className="m-0 ps-0 list-none grid sm:grid-cols-2 gap-x-6 gap-y-2 text-[13px] text-muted">
            {[
              ['Name', 'what is measured, in plain words'],
              ['Context line', 'the unit, baseline or what it is compared with'],
              ['Change', 'movement against the baseline or the last period'],
              ['Status', 'On track, Watch or At risk, coloured by threshold'],
              ['Details', 'click anywhere on the card: opens the panel with the day filter (7D, 14D, 30D, 90D), Forecast and Compare previous toggles, the AI advisory and Apply actions'],
            ].map(([t, d], k) => (
              <li key={t} className={`flex gap-2 ${k === 4 ? 'sm:col-span-2' : ''}`}>
                <Num n={k + 1} />
                <span><b className="text-ink">{t}</b> — {d}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section>
        <H n="2 · Catalogue" sub="Sample values for each KPI family. Click a card to preview its detail panel, change the day window and switch the forecast on or off. Live numbers come from the simulation engines after sign-in.">The KPI cards in the platform</H>
        <div className="grid lg:grid-cols-[1fr_380px] gap-4">
          <div className="space-y-4 min-w-0">
            {GROUPS.map((g) => (
              <div key={g}>
                <div className="text-[12px] font-bold uppercase tracking-wider text-dim mb-1.5">{g}</div>
                <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-2.5">
                  {SAMPLES.map((s, idx) => (s.group === g ? <Card key={s.label} s={s} on={idx === sel} onPick={() => setSel(idx)} /> : null))}
                </div>
              </div>
            ))}
          </div>
          <Preview key={SAMPLES[sel].label} s={SAMPLES[sel]} />
        </div>
      </section>

      <section>
        <H n="3 · UI / UX" sub="A few conventions repeat on every screen so a first-time viewer can read it without a guide.">How the interface works</H>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          <Tile icon={<Palette size={16} />} title="Violet = AI">AI content is always larger and violet: the briefing, advisory, forecast and Copilot. Brand red marks navigation and primary actions.</Tile>
          <Tile icon={<Sparkles size={16} />} title="AI Advisory">The strip under the header gives page-specific headlines from the live engines; the AI Advisory button lists recommended actions.</Tile>
          <Tile icon={<MessageSquare size={16} />} title="AI Copilot">Press Ctrl+J to ask about risk, Hormuz impact or which crane will fail. Answers cite the live numbers.</Tile>
          <Tile icon={<MousePointerClick size={16} />} title="Click to go deeper">KPI cards, alarms and map markers open a panel or a page. Nothing important is more than two clicks away.</Tile>
          <Tile icon={<LayoutPanelTop size={16} />} title="Digital Twin">3D site with a live incident card pinned to the machine, a timeline to the finished port and an AI site scan.</Tile>
          <Tile icon={<Users size={16} />} title="Role views">Switch between CXO, project manager, procurement, HSE, asset and finance: the home KPIs and the sidebar emphasis change.</Tile>
          <Tile icon={<Languages size={16} />} title="English and Arabic">Full right-to-left layout, Arabic numerals kept readable, plus a large-text projector mode.</Tile>
          <Tile icon={<UserRound size={16} />} title="Presenter panel">Ctrl+Shift+P opens checkpoints, hero-flow replays, the AI demo and a reset, for a clean live demo.</Tile>
        </div>
      </section>

      <section>
        <H n="4 · Walk-through" sub="A suggested path of about three minutes.">Suggested demo path</H>
        <ol className="m-0 ps-0 list-none grid sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {PATH.map(([t, d], k) => (
            <li key={t} className="rounded-xl border border-line bg-surface p-3 flex gap-3">
              <span className="size-6 shrink-0 rounded-full grid place-items-center text-[12px] font-bold" style={{ background: 'var(--violet-solid)', color: '#fff' }}>{k + 1}</span>
              <span className="text-[12.5px] leading-snug text-muted"><b className="block text-[13.5px] text-ink">{t}</b>{d}</span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

function Num({ n }: { n: number }) {
  return (
    <span className="inline-grid place-items-center size-[17px] rounded-full text-[10px] font-bold align-middle shrink-0" style={{ background: 'var(--violet-solid)', color: '#fff' }}>
      {n}
    </span>
  );
}
