import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ArrowRight,
  Box,
  CalendarRange,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDashed,
  ClipboardList,
  Database,
  FileText,
  FlaskConical,
  HardHat,
  LayoutDashboard,
  Pause,
  Play,
  Plug,
  Printer,
  Sparkles,
  Ticket,
  Truck,
  Wallet,
  Wrench,
} from 'lucide-react';

const V = 'var(--violet)';
const chip = 'rounded-xl border border-line bg-surface px-3 py-2.5';

function Stat({ n, label }: { n: string; label: string }) {
  return (
    <div className={chip}>
      <div className="text-[30px] font-bold leading-none tracking-tight text-ink">{n}</div>
      <div className="text-[13px] text-dim mt-2 leading-snug">{label}</div>
    </div>
  );
}

function Step({ i, title, text, ai }: { i: number; title: string; text: string; ai?: boolean }) {
  return (
    <div className="flex-1 min-w-0 rounded-xl border px-3 py-3" style={{ borderColor: ai ? 'color-mix(in srgb, var(--violet) 55%, transparent)' : 'var(--line)', background: ai ? 'color-mix(in srgb, var(--violet) 9%, var(--surface))' : 'var(--surface)' }}>
      <div className="flex items-center gap-2 mb-1">
        <span className="size-5 rounded-full grid place-items-center text-[11px] font-bold" style={{ background: ai ? 'var(--violet-solid)' : 'var(--surface-3)', color: ai ? '#fff' : 'var(--text)' }}>{i}</span>
        <span className="text-[13px] font-bold" style={{ color: ai ? V : 'var(--text)' }}>{title}</span>
      </div>
      <p className="m-0 text-[13.5px] leading-snug text-muted">{text}</p>
    </div>
  );
}

const MODULES: Array<[ReactNode, string, string]> = [
  [<LayoutDashboard size={16} key="a" />, 'Portfolio', 'Morning briefing, map, alarms, drone imagery'],
  [<Box size={16} key="b" />, 'Digital Twin', '3D site with a live incident card'],
  [<CalendarRange size={16} key="c" />, 'Schedule', 'Real CPM engine, Gantt, S-curve'],
  [<FlaskConical size={16} key="d" />, 'What-if', 'Hormuz closure, calendar and stress tests'],
  [<Truck size={16} key="e" />, 'Procurement', 'POs, routes, chokepoint exposure'],
  [<Wrench size={16} key="f" />, 'Fleet & Assets', 'Health, failure prediction, diagnosis'],
  [<ClipboardList size={16} key="g" />, 'Work Orders', 'Tickets synced to external tools'],
  [<Wallet size={16} key="h" />, 'Cost', 'Earned value, EAC, cash flow'],
  [<HardHat size={16} key="i" />, 'HSE', 'Video analytics, registers, root cause'],
  [<FileText size={16} key="j" />, 'Documents', 'Drawings, RFIs, NCRs, snags'],
  [<Printer size={16} key="k" />, 'Reports', 'Executive pack, S!a Excel-lence, CSV'],
  [<Plug size={16} key="l" />, 'Integrations', 'Connectors, how AI helps, mock vs real'],
];

function Mock({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-line bg-surface p-3 ${className ?? ''}`}>{children}</div>;
}

interface Slide {
  kicker: string;
  title: string;
  lead: string;
  body: ReactNode;
}

const SLIDES: Slide[] = [
  {
    kicker: 'The proof of concept',
    title: 'One control tower for a construction programme',
    lead: 'S!aP Mazzant by Astrikos AI, shown for Tech Mahindra: a front-end-complete demo of construction management plus a digital twin, with an AI layer on top.',
    body: (
      <>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <Stat n="12" label="modules from portfolio to integrations" />
          <Stat n="339" label="activities in the live schedule engine" />
          <Stat n="32 · 27" label="purchase orders · machines tracked" />
          <Stat n="EN · AR" label="with RTL, dark and light themes" />
        </div>
        <p className="mt-3 mb-0 text-[13.5px] text-dim">Demo project: Mina Al Hamriya Port. Scope, quantities and dates are illustrative; all data is simulated.</p>
      </>
    ),
  },
  {
    kicker: 'Why it exists',
    title: 'Programme data lives in silos and warnings arrive late',
    lead: 'Schedulers, ERP, CCTV, drones and spreadsheets each hold a piece of the truth. Nobody sees the whole picture in time to act.',
    body: (
      <>
        <div className="grid sm:grid-cols-3 gap-2.5">
          <Mock>
            <div className="text-[13px] font-bold text-ink">Silos</div>
            <p className="m-0 mt-1 text-[13.5px] text-muted leading-snug">Scheduler, ERP, CCTV, drone and site spreadsheets never meet, so every report is stitched by hand.</p>
          </Mock>
          <Mock>
            <div className="text-[13px] font-bold text-ink">Late warnings</div>
            <p className="m-0 mt-1 text-[13.5px] text-muted leading-snug">A delayed shipment or a failing crane is found after it has already hit the critical path.</p>
          </Mock>
          <Mock>
            <div className="text-[13px] font-bold text-ink">Slow decisions</div>
            <p className="m-0 mt-1 text-[13.5px] text-muted leading-snug">What if a strait closes for twelve months? Answering takes days, not minutes.</p>
          </Mock>
        </div>
        <div className="mt-3 flex items-center gap-2 rounded-xl px-3 py-2.5 text-[13px] font-semibold" style={{ background: 'color-mix(in srgb, var(--violet) 10%, transparent)', color: V }}>
          <Sparkles size={15} /> The answer: see it, understand it, and act on it from one screen.
        </div>
      </>
    ),
  },
  {
    kicker: 'What you can open after signing in',
    title: 'Twelve connected modules, one data model',
    lead: 'Every module reads the same simulated programme, so a change in one (a late PO, a failing crane) shows up everywhere.',
    body: (
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {MODULES.map(([icon, name, sub]) => (
          <div key={name} className={`${chip} !py-2 flex items-start gap-2`}>
            <span className="mt-0.5 text-accent shrink-0">{icon}</span>
            <span className="min-w-0">
              <span className="block text-[13px] font-semibold text-ink leading-tight">{name}</span>
              <span className="block text-[11.5px] text-dim leading-snug">{sub}</span>
            </span>
          </div>
        ))}
      </div>
    ),
  },
  {
    kicker: 'Flow 1 · the demo moment',
    title: 'A live incident on the Digital Twin, ticketed in one click',
    lead: 'The twin opens on a crane that is trending toward failure. The card pinned to the machine carries the AI insight and the next action.',
    body: (
      <>
        <div className="flex flex-col sm:flex-row gap-2">
          <Step i={1} title="Sense" text="Crane CC-02 health drops on simulated telemetry; the twin pins an alert to the machine." />
          <Step i={2} title="Understand" ai text="AI explains what happened, why, and what failing costs compared with servicing now." />
          <Step i={3} title="Act" ai text="Create ticket or Act & Assign: the work order is raised by department." />
          <Step i={4} title="Track" text="The ticket syncs to the connected tool and its live status shows in Work Orders." />
        </div>
        <div className="mt-3 flex items-center gap-2 text-[13.5px] text-dim">
          <Ticket size={14} /> Ticketing tools shown: ServiceNow, Jira, Maximo, SAP PM, Teams (simulated by the hub).
        </div>
      </>
    ),
  },
  {
    kicker: 'Violet means AI',
    title: 'An AI layer that explains, forecasts and acts',
    lead: 'AI content is always larger and violet, so you can tell at a glance what the AI wrote and what the engines computed.',
    body: (
      <>
        <div className="rounded-xl border-[1.5px] p-3" style={{ borderColor: 'color-mix(in srgb, var(--violet) 60%, var(--line))', background: 'color-mix(in srgb, var(--violet) 9%, var(--surface))' }}>
          <div className="flex items-center gap-2 mb-1.5">
            <Sparkles size={16} style={{ color: V }} />
            <span className="text-[14px] font-bold" style={{ color: V }}>AI advisory</span>
          </div>
          <p className="m-0 text-[15px] leading-snug font-semibold" style={{ color: 'color-mix(in srgb, var(--violet) 52%, var(--text))' }}>
            Forecast finish is 12 days behind baseline; two long-lead deliveries drive most of it.
          </p>
        </div>
        <div className="mt-2.5 grid grid-cols-2 sm:grid-cols-4 gap-2">
          {['Morning briefing', 'KPI forecast + Apply', 'Copilot (Ctrl+J)', 'AI scans and diagnosis'].map((t) => (
            <div key={t} className="rounded-lg px-2.5 py-2 text-[12px] font-semibold text-center" style={{ background: 'color-mix(in srgb, var(--violet) 12%, transparent)', color: V }}>
              {t}
            </div>
          ))}
        </div>
        <p className="mt-2.5 mb-0 text-[12px] text-dim">Honest by design: numbers are computed live by the engines; the wording is scripted. No language model is connected in this PoC.</p>
      </>
    ),
  },
  {
    kicker: 'Every KPI card is clickable',
    title: 'Click a card for the day filter, forecast and AI advice',
    lead: 'Each card ends in a violet Details link. It opens a panel with the trend, a 7 / 14 / 30 / 90-day window, a forecast with confidence band, and recommended actions.',
    body: (
      <div className="grid sm:grid-cols-[210px_1fr] gap-3 items-start">
        <Mock className="!p-3">
          <div className="text-[11.5px] font-medium text-muted">SPI</div>
          <div className="text-[24px] font-semibold leading-tight text-warn">0.94</div>
          <div className="mt-1.5 pt-1.5 border-t border-line flex items-center text-[10.5px] uppercase tracking-wider">
            <span className="font-bold text-warn">Watch</span>
            <span className="ms-auto normal-case text-[11.5px] font-semibold inline-flex items-center gap-0.5" style={{ color: V }}>
              <Sparkles size={11} /> Details <ChevronRight size={12} />
            </span>
          </div>
        </Mock>
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="inline-flex rounded-lg border border-line-2 bg-surface-2 p-0.5 gap-0.5">
              {['7D', '14D', '30D', '90D'].map((d, i) => (
                <span key={d} className="px-2 h-6 grid place-items-center rounded-md text-[11.5px] font-medium" style={i === 2 ? { background: 'color-mix(in srgb, var(--accent) 22%, transparent)', color: 'var(--accent)' } : { color: 'var(--muted)' }}>{d}</span>
              ))}
            </span>
            <span className="h-7 px-2.5 rounded-lg text-[11.5px] font-semibold inline-flex items-center border" style={{ color: V, borderColor: 'color-mix(in srgb, var(--violet) 55%, transparent)', background: 'color-mix(in srgb, var(--violet) 12%, transparent)' }}>Forecast</span>
            <span className="h-7 px-2.5 rounded-lg text-[11.5px] font-semibold inline-flex items-center border border-line-2 text-muted">Compare previous</span>
          </div>
          <svg viewBox="0 0 300 70" className="w-full h-[70px]" aria-hidden>
            <path d="M0 52 C30 48 50 50 80 40 S130 34 150 30" fill="none" stroke="var(--info)" strokeWidth="2.4" />
            <path d="M150 30 L300 18 L300 52 Z" fill="var(--violet)" opacity="0.18" />
            <path d="M150 30 C200 30 250 30 300 34" fill="none" stroke="var(--violet)" strokeWidth="2.4" strokeDasharray="5 4" />
            <line x1="150" x2="150" y1="4" y2="68" stroke="var(--dim)" strokeDasharray="2 3" />
          </svg>
          <div className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[12px]" style={{ background: 'color-mix(in srgb, var(--violet) 8%, var(--surface))' }}>
            <span className="flex-1 font-medium text-ink">Confirm the two longest-lead deliveries this week</span>
            <span className="h-6 px-2.5 rounded-md inline-flex items-center gap-1 text-[11.5px] font-bold" style={{ background: 'var(--violet-solid)', color: '#fff' }}>Apply <ArrowRight size={11} /></span>
          </div>
        </div>
      </div>
    ),
  },
  {
    kicker: 'Know what you are looking at',
    title: 'What is real and what is simulated',
    lead: 'A PoC should be honest. The engines are real and tested; the data feeding them, and the AI wording, are mocked.',
    body: (
      <div className="grid sm:grid-cols-2 gap-2.5">
        <Mock>
          <div className="flex items-center gap-1.5 text-[13px] font-bold text-good mb-1.5"><CheckCircle2 size={15} /> Real</div>
          <ul className="m-0 ps-4 text-[13.5px] text-muted space-y-1">
            <li>CPM schedule and what-if scenario engine (unit tested)</li>
            <li>Earned value, EAC and cash-flow maths</li>
            <li>Ticket hub API behind Work Orders</li>
            <li>KPI forecasts are deterministic from the live value</li>
          </ul>
        </Mock>
        <Mock>
          <div className="flex items-center gap-1.5 text-[13px] font-bold text-warn mb-1.5"><CircleDashed size={15} /> Simulated</div>
          <ul className="m-0 ps-4 text-[13.5px] text-muted space-y-1">
            <li>Telemetry, CCTV and drone imagery (generated stills)</li>
            <li>Logistics and ticketing connectors (no real calls)</li>
            <li>AI wording is scripted, no LLM connected</li>
            <li>Sign-in is a client-side demo gate</li>
          </ul>
        </Mock>
        <div className="sm:col-span-2 flex items-center gap-2 text-[12px] text-dim"><Database size={13} /> The full table lives in the README and under Integrations → Mock vs real.</div>
      </div>
    ),
  },
];

/** short, self-running slide deck shown next to the sign-in card */
export function Deck() {
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [hover, setHover] = useState(false);
  const reduced = useRef(false);
  const n = SLIDES.length;
  useEffect(() => {
    try {
      reduced.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (reduced.current) setPlaying(false);
    } catch {
      /* ignore */
    }
  }, []);
  const go = useCallback((k: number) => setI(((k % n) + n) % n), [n]);
  useEffect(() => {
    if (!playing || hover) return;
    const h = window.setTimeout(() => setI((v) => (v + 1) % n), 9000);
    return () => window.clearTimeout(h);
  }, [playing, hover, i, n]);
  const s = SLIDES[i];
  return (
    <section
      className="rounded-[20px] flex flex-col min-h-[400px] shadow-[0_20px_60px_rgba(0,0,0,0.45)] outline-none"
      style={{ background: '#0a0a0a' }}
      aria-roledescription="carousel"
      aria-label="About this proof of concept"
      data-testid="login-deck"
      tabIndex={0}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight') go(i + 1);
        if (e.key === 'ArrowLeft') go(i - 1);
      }}
    >
      <div className="flex items-center gap-2 px-6 pt-5">
        <span className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: V }}>{s.kicker}</span>
        <span className="ms-auto text-[12px] text-dim tabular-nums" data-testid="deck-count">{i + 1} / {n}</span>
      </div>
      <div key={i} className="flex-1 px-6 pt-2 pb-4 anim-in" aria-live="polite" data-testid="deck-slide">
        <h2 className="m-0 text-[28px] leading-tight font-bold tracking-tight text-ink max-w-[32ch]">{s.title}</h2>
        <p className="mt-2.5 mb-5 text-[15px] leading-relaxed text-muted max-w-[64ch]">{s.lead}</p>
        {s.body}
      </div>
      <div className="flex items-center gap-2 px-5 pb-4">
        <button type="button" onClick={() => go(i - 1)} aria-label="Previous slide" className="size-8 rounded-lg grid place-items-center border border-line-2 text-muted hover:text-ink hover:bg-surface-2" data-testid="deck-prev">
          <ChevronLeft size={16} />
        </button>
        <button type="button" onClick={() => go(i + 1)} aria-label="Next slide" className="size-8 rounded-lg grid place-items-center border border-line-2 text-muted hover:text-ink hover:bg-surface-2" data-testid="deck-next">
          <ChevronRight size={16} />
        </button>
        <button type="button" onClick={() => setPlaying((p) => !p)} aria-label={playing ? 'Pause slideshow' : 'Play slideshow'} className="size-8 rounded-lg grid place-items-center text-dim hover:text-ink">
          {playing ? <Pause size={14} /> : <Play size={14} />}
        </button>
        <div className="flex items-center gap-1.5 ms-auto" role="tablist" aria-label="Slides">
          {SLIDES.map((sl, k) => (
            <button
              key={sl.title}
              type="button"
              role="tab"
              aria-selected={k === i}
              aria-label={`Slide ${k + 1}: ${sl.title}`}
              onClick={() => go(k)}
              className="h-2 rounded-full transition-all"
              style={{ width: k === i ? 22 : 8, background: k === i ? 'var(--violet-solid)' : 'var(--line-2)' }}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
