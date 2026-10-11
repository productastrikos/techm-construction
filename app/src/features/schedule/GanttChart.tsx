import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { CpmResult } from '../../engine/cpm';
import { ymdToT, dayToYmd, PROJECT_START } from '../../engine/dates';
import type { Activity, Id, ProjectPack } from '../../engine/types';
import { fmtDate, type Lang } from '../../lib/fmt';
import { tx } from '../../lib/bi';
import type { Snapshot } from '../../sim/types';

const ROW = 24;
const HEAD = 46;

export interface GanttFilters {
  wbs: string | 'all';
  criticalOnly: boolean;
  baseline: boolean;
  calendar: boolean;
  links: boolean;
  query: string;
  /** only activities moved by the active scenario */
  changedOnly?: boolean;
}

interface Row {
  key: string;
  kind: 'wbs' | 'act';
  wbsId: string;
  idx: number; // activity index (act rows)
}

const MONTHS_EN = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

export interface GanttProps {
  pack: ProjectPack;
  snap: Snapshot;
  scenario: CpmResult | null;
  lang: Lang;
  pxPerDay: number;
  filters: GanttFilters;
  selected: Id | null;
  onSelect: (id: Id | null) => void;
  collapsed: Set<string>;
  onToggle: (wbs: string) => void;
  /** activity ids whose logic changed (shown in scenario colour) */
  scenarioLabel?: string | null;
  leftW: number;
  /** planned service windows from the CMMS (shown as protected windows) */
  maintenance?: Array<{ id: string; assetId: string; fromT: number; toT: number }>;
  focus?: { id: Id; nonce: number } | null;
}

export const GanttChart = memo(function GanttChart(p: GanttProps) {
  const { pack, snap, scenario, lang, pxPerDay, filters, selected, collapsed, leftW } = p;
  const scroller = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewH, setViewH] = useState(500);
  const res = scenario ?? snap.forecast;
  const total = Math.ceil(Math.max(snap.forecastFinish, scenario?.finish ?? 0, snap.baselineFinish) + 40);
  const timeW = Math.ceil(total * pxPerDay);

  // ------------------------------------------------------------------ rows
  const rows = useMemo<Row[]>(() => {
    const q = filters.query.trim().toLowerCase();
    const out: Row[] = [];
    for (const w of pack.wbs) {
      if (filters.wbs !== 'all' && filters.wbs !== w.id) continue;
      const acts: number[] = [];
      pack.activities.forEach((a, i) => {
        if (a.wbsId !== w.id) return;
        if (filters.criticalOnly && !res.critical[i]) return;
        if (filters.changedOnly && scenario && Math.abs(scenario.ef[i] - snap.forecast.ef[i]) < 0.5 && Math.abs(scenario.es[i] - snap.forecast.es[i]) < 0.5) return;
        if (q && !(a.id.toLowerCase().includes(q) || a.name.en.toLowerCase().includes(q) || a.name.ar.includes(q))) return;
        acts.push(i);
      });
      if (!acts.length) continue;
      acts.sort((a, b) => snap.baseline.es[a] - snap.baseline.es[b] || a - b);
      out.push({ key: `w:${w.id}`, kind: 'wbs', wbsId: w.id, idx: -1 });
      if (!collapsed.has(w.id)) for (const i of acts) out.push({ key: pack.activities[i].id, kind: 'act', wbsId: w.id, idx: i });
    }
    return out;
  }, [pack, snap, filters.wbs, filters.criticalOnly, filters.changedOnly, filters.query, collapsed, res, scenario]);

  const rowIndex = useMemo(() => {
    const m = new Map<Id, number>();
    rows.forEach((r, i) => r.kind === 'act' && m.set(pack.activities[r.idx].id, i));
    return m;
  }, [rows, pack]);

  const wbsAgg = useMemo(() => {
    const m = new Map<string, { es: number; ef: number; bes: number; bef: number; pct: number; w: number; crit: boolean }>();
    pack.activities.forEach((a, i) => {
      let g = m.get(a.wbsId);
      if (!g) m.set(a.wbsId, (g = { es: Infinity, ef: -Infinity, bes: Infinity, bef: -Infinity, pct: 0, w: 0, crit: false }));
      g.es = Math.min(g.es, res.es[i]);
      g.ef = Math.max(g.ef, res.ef[i]);
      g.bes = Math.min(g.bes, snap.baseline.es[i]);
      g.bef = Math.max(g.bef, snap.baseline.ef[i]);
      const w = Math.max(1, a.durationHrs);
      g.pct += snap.pct[i] * w;
      g.w += w;
      if (res.critical[i]) g.crit = true;
    });
    return m;
  }, [pack, snap, res]);

  // ------------------------------------------------------------------ scroll / virtualization
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setViewH(el.clientHeight));
    ro.observe(el);
    setViewH(el.clientHeight);
    return () => ro.disconnect();
  }, []);
  // open scrolled to the data date so the near-term programme is in view
  useEffect(() => {
    scroller.current?.scrollTo({ left: Math.max(0, (snap.nowT - 25) * pxPerDay), top: 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!p.focus) return;
    const i = rowIndex.get(p.focus.id);
    const el = scroller.current;
    if (i === undefined || !el) return;
    const ai = res.idx.get(p.focus.id)!;
    el.scrollTo({ top: Math.max(0, i * ROW - el.clientHeight / 3), left: Math.max(0, res.es[ai] * pxPerDay - (el.clientWidth - leftW) / 3), behavior: 'smooth' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.focus?.nonce]);

  const first = Math.max(0, Math.floor(scrollTop / ROW) - 4);
  const last = Math.min(rows.length, Math.ceil((scrollTop + viewH) / ROW) + 4);
  const vis = rows.slice(first, last);
  const bodyH = rows.length * ROW;

  // ------------------------------------------------------------------ calendar shading
  const bands = useMemo(() => {
    if (!filters.calendar) return [];
    const out: Array<{ x0: number; x1: number; kind: 'hol' | 'ram' | 'sum' | 'eid'; label: string }> = [];
    for (const h of pack.rules.holidays) out.push({ x0: h.startT, x1: h.endT + 1, kind: h.kind === 'eid' ? 'eid' : 'hol', label: tx(h.name, lang) });
    for (const r of pack.rules.ramadan) out.push({ x0: r.startT, x1: r.endT + 1, kind: 'ram', label: lang === 'ar' ? 'رمضان (ساعات مخفضة)' : 'Ramadan (reduced hours)' });
    for (let y = 2027; y <= 2029; y++) out.push({ x0: ymdToT(y, 6, 15), x1: ymdToT(y, 9, 16), kind: 'sum', label: lang === 'ar' ? 'حظر العمل وقت الظهيرة' : 'Midday outdoor-work ban' });
    return out.filter((b) => b.x1 > 0 && b.x0 < total);
  }, [pack, filters.calendar, lang, total]);

  // ------------------------------------------------------------------ header ticks
  const header = useMemo(() => {
    const months: Array<{ x: number; w: number; m: number; y: number }> = [];
    const years: Array<{ x: number; w: number; y: number }> = [];
    const start = dayToYmd(PROJECT_START);
    let y = start.y;
    let m = start.m;
    let guard = 0;
    while (guard++ < 60) {
      const x0 = ymdToT(y, m, 1);
      const ny = m === 12 ? y + 1 : y;
      const nm = m === 12 ? 1 : m + 1;
      const x1 = ymdToT(ny, nm, 1);
      if (x0 > total) break;
      months.push({ x: Math.max(0, x0) * pxPerDay, w: (x1 - Math.max(0, x0)) * pxPerDay, m, y });
      const lastY = years[years.length - 1];
      if (!lastY || lastY.y !== y) years.push({ x: Math.max(0, x0) * pxPerDay, w: (x1 - Math.max(0, x0)) * pxPerDay, y });
      else lastY.w += (x1 - Math.max(0, x0)) * pxPerDay;
      y = ny;
      m = nm;
    }
    return { months, years };
  }, [total, pxPerDay]);

  const fmtShort = (t: number) => fmtDate(t, lang, 'short');
  const wbsColor = (id: string) => pack.wbs.find((w) => w.id === id)?.color ?? '#3ee0b0';

  // ------------------------------------------------------------------ dependency links
  const links = useMemo(() => {
    const out: Array<{ a: Id; b: Id; crit: boolean }> = [];
    const addFor = (id: Id) => {
      const i = res.idx.get(id)!;
      const a = pack.activities[i];
      for (const pr of a.preds) out.push({ a: pr.id, b: id, crit: !!(res.critical[res.idx.get(pr.id)!] && res.critical[i]) });
      pack.activities.forEach((s, si) => {
        if (s.preds.some((q) => q.id === id)) out.push({ a: id, b: s.id, crit: !!(res.critical[i] && res.critical[si]) });
      });
    };
    if (selected && res.idx.has(selected)) addFor(selected);
    if (filters.links) {
      pack.activities.forEach((a, i) => {
        if (!res.critical[i]) return;
        for (const pr of a.preds) if (res.critical[res.idx.get(pr.id)!]) out.push({ a: pr.id, b: a.id, crit: true });
      });
    }
    return out;
  }, [selected, filters.links, res, pack]);

  const rowCY = (id: Id) => {
    const r = rowIndex.get(id);
    return r === undefined ? null : r * ROW + ROW / 2;
  };

  const onRowClick = (r: Row) => {
    if (r.kind === 'act') p.onSelect(pack.activities[r.idx].id);
  };

  return (
    <div ref={scroller} className="overflow-auto h-full w-full relative border border-line rounded-xl bg-surface" dir="ltr" onScroll={(e) => setScrollTop((e.target as HTMLDivElement).scrollTop)} data-testid="gantt-scroll">
      <div style={{ display: 'grid', gridTemplateColumns: `${leftW}px ${timeW}px`, gridTemplateRows: `${HEAD}px ${bodyH}px`, width: leftW + timeW }}>
        {/* corner */}
        <div className="sticky top-0 start-0 z-30 bg-surface-2 border-b border-e border-line flex items-end text-[10.5px] uppercase tracking-wider text-dim font-semibold" style={{ left: 0 }}>
          <div className="flex w-full px-2 pb-1 gap-1">
            <span className="flex-1">{lang === 'ar' ? 'النشاط' : 'Activity'}</span>
            <span className="w-[62px] text-end">{lang === 'ar' ? 'البداية' : 'Start'}</span>
            <span className="w-[62px] text-end">{lang === 'ar' ? 'النهاية' : 'Finish'}</span>
            <span className="w-[34px] text-end">{lang === 'ar' ? 'هامش' : 'TF'}</span>
          </div>
        </div>
        {/* time header */}
        <div className="sticky top-0 z-20 bg-surface-2 border-b border-line" style={{ height: HEAD, width: timeW }}>
          <svg width={timeW} height={HEAD}>
            {header.years.map((yy) => (
              <g key={yy.y}>
                <rect x={yy.x} y={0} width={yy.w} height={20} fill="none" stroke="var(--line)" />
                <text x={yy.x + 6} y={14} fontSize={11} fontWeight={600} fill="var(--muted)">{yy.y}</text>
              </g>
            ))}
            {header.months.map((mm, i) => (
              <g key={i}>
                <line x1={mm.x} x2={mm.x} y1={20} y2={HEAD} stroke="var(--line)" />
                {mm.w > 10 && <text x={mm.x + mm.w / 2} y={36} fontSize={10} textAnchor="middle" fill="var(--dim)">{pxPerDay >= 3 ? new Date(Date.UTC(2026, mm.m - 1, 1)).toLocaleString(lang === 'ar' ? 'ar-AE-u-nu-latn' : 'en-GB', { month: 'short', timeZone: 'UTC' }) : MONTHS_EN[mm.m - 1]}</text>}
              </g>
            ))}
          </svg>
        </div>
        {/* left rows */}
        <div className="sticky z-10 bg-surface border-e border-line relative" style={{ left: 0, height: bodyH }}>
          {vis.map((r, k) => {
            const i = first + k;
            const y = i * ROW;
            if (r.kind === 'wbs') {
              const w = pack.wbs.find((x) => x.id === r.wbsId)!;
              const g = wbsAgg.get(r.wbsId)!;
              const isCol = collapsed.has(r.wbsId);
              return (
                <div key={r.key} className="absolute inset-x-0 flex items-center gap-1 px-1.5 bg-surface-2 border-b border-line cursor-pointer" style={{ top: y, height: ROW }} onClick={() => p.onToggle(r.wbsId)}>
                  {isCol ? <ChevronRight size={13} className="text-dim" /> : <ChevronDown size={13} className="text-dim" />}
                  <span className="size-2 rounded-sm shrink-0" style={{ background: w.color }} />
                  <span className="flex-1 truncate text-[12px] font-semibold" dir="auto">{tx(w.name, lang)}</span>
                  <span className="w-[62px] text-end num text-[11px] text-muted">{fmtShort(g.es)}</span>
                  <span className="w-[62px] text-end num text-[11px] text-muted">{fmtShort(g.ef)}</span>
                  <span className="w-[34px]" />
                </div>
              );
            }
            const a = pack.activities[r.idx];
            return <ActRow key={r.key} a={a} i={r.idx} y={y} res={res} sel={selected === a.id} lang={lang} onClick={() => onRowClick(r)} />;
          })}
        </div>
        {/* body */}
        <div className="relative" style={{ width: timeW, height: bodyH }}>
          <svg width={timeW} height={bodyH} style={{ position: 'absolute', inset: 0 }}>
            {/* calendar bands (full height) */}
            {bands.map((b, i) => (
              <rect key={i} x={b.x0 * pxPerDay} y={0} width={Math.max(1, (b.x1 - b.x0) * pxPerDay)} height={bodyH} fill={b.kind === 'sum' ? 'var(--warn)' : b.kind === 'ram' ? 'var(--violet)' : 'var(--bad)'} opacity={b.kind === 'sum' ? 0.06 : b.kind === 'ram' ? 0.09 : 0.18}>
                <title>{b.label}</title>
              </rect>
            ))}
            {(p.maintenance ?? []).map((m) => (
              <g key={m.id}>
                <rect x={m.fromT * pxPerDay} y={0} width={Math.max(3, (m.toT - m.fromT) * pxPerDay)} height={bodyH} fill="var(--violet)" opacity={0.28}>
                  <title>{`${m.id} - ${m.assetId}`}</title>
                </rect>
              </g>
            ))}
            {header.months.map((mm, i) => (
              <line key={i} x1={mm.x} x2={mm.x} y1={0} y2={bodyH} stroke="var(--line)" opacity={0.5} />
            ))}
            {/* rows */}
            {vis.map((r, k) => {
              const i = first + k;
              const y = i * ROW;
              if (r.kind === 'wbs') {
                const g = wbsAgg.get(r.wbsId)!;
                const col = wbsColor(r.wbsId);
                const x0 = g.es * pxPerDay;
                const w = Math.max(3, (g.ef - g.es) * pxPerDay);
                return (
                  <g key={r.key}>
                    <rect x={0} y={y} width={timeW} height={ROW} fill="var(--surface-2)" opacity={0.7} />
                    {filters.baseline && <rect x={g.bes * pxPerDay} y={y + 16} width={Math.max(2, (g.bef - g.bes) * pxPerDay)} height={3} fill="var(--dim)" opacity={0.8} />}
                    <path d={`M${x0},${y + 6} h${w} v6 l-4,4 h-${Math.max(0, w - 8)} l-4,-4 z`} fill={col} opacity={0.9} />
                    <rect x={x0} y={y + 6} width={(w * g.pct) / g.w} height={4} fill="#fff" opacity={0.35} />
                  </g>
                );
              }
              const a = pack.activities[r.idx];
              const i2 = r.idx;
              return (
                <Bars key={r.key} a={a} i={i2} y={y} snap={snap} res={res} scenario={!!scenario} px={pxPerDay} col={wbsColor(a.wbsId)} sel={selected === a.id} baseline={filters.baseline} onClick={() => p.onSelect(a.id)} lang={lang} />
              );
            })}
            {/* dependency links */}
            {links.map((l, k) => {
              const ya = rowCY(l.a);
              const yb = rowCY(l.b);
              if (ya === null || yb === null) return null;
              const ia = res.idx.get(l.a)!;
              const ib = res.idx.get(l.b)!;
              const x1 = res.ef[ia] * pxPerDay;
              const x2 = res.es[ib] * pxPerDay;
              const mx = Math.max(x1 + 6, x2 - 6);
              return <path key={k} d={`M${x1},${ya} H${mx} V${yb} H${x2}`} fill="none" stroke={l.crit ? 'var(--bad)' : 'var(--accent)'} strokeWidth={l.crit ? 1.4 : 1} opacity={0.8} />;
            })}
            {/* today / data date + baseline & forecast finish */}
            <line x1={snap.nowT * pxPerDay} x2={snap.nowT * pxPerDay} y1={0} y2={bodyH} stroke="var(--accent)" strokeWidth={1.5} strokeDasharray="4 3" />
            <line x1={snap.baselineFinish * pxPerDay} x2={snap.baselineFinish * pxPerDay} y1={0} y2={bodyH} stroke="var(--info)" strokeWidth={1} strokeDasharray="2 4" opacity={0.8} />
            <line x1={res.finish * pxPerDay} x2={res.finish * pxPerDay} y1={0} y2={bodyH} stroke={scenario ? 'var(--warn)' : 'var(--bad)'} strokeWidth={1} strokeDasharray="2 4" opacity={0.8} />
          </svg>
        </div>
      </div>
    </div>
  );
});

const ActRow = memo(function ActRow({ a, i, y, res, sel, lang, onClick }: { a: Activity; i: number; y: number; res: CpmResult; sel: boolean; lang: Lang; onClick: () => void }) {
  const crit = !!res.critical[i];
  const tf = res.tf[i];
  return (
    <div className={`absolute inset-x-0 flex items-center gap-1 px-2 border-b border-line cursor-pointer hover:bg-surface-2 ${sel ? 'bg-[color-mix(in_srgb,var(--accent)_14%,transparent)]' : ''}`} style={{ top: y, height: ROW }} onClick={onClick} data-testid={`row-${a.id}`}>
      <span className="mono text-[9.5px] text-dim w-[58px] shrink-0 truncate">{a.id}</span>
      <span className={`flex-1 truncate text-[11.5px] ${crit ? 'text-bad font-medium' : ''}`} dir="auto" title={tx(a.name, lang)}>
        {a.kind === 'delivery' ? '◇ ' : ''}
        {tx(a.name, lang)}
      </span>
      <span className="w-[62px] text-end num text-[10.5px] text-muted">{fmtDate(res.es[i], lang, 'short')}</span>
      <span className="w-[62px] text-end num text-[10.5px] text-muted">{fmtDate(res.ef[i], lang, 'short')}</span>
      <span className="w-[34px] text-end num text-[10.5px]" style={{ color: tf <= 1 ? 'var(--bad)' : tf < 10 ? 'var(--warn)' : 'var(--dim)' }}>{res.done[i] ? '-' : tf > 999 ? '999+' : Math.round(tf)}</span>
    </div>
  );
});

function Bars({ a, i, y, snap, res, scenario, px, col, sel, baseline, onClick, lang }: { a: Activity; i: number; y: number; snap: Snapshot; res: CpmResult; scenario: boolean; px: number; col: string; sel: boolean; baseline: boolean; onClick: () => void; lang: Lang }) {
  const fc = snap.forecast;
  const bes = snap.baseline.es[i];
  const bef = snap.baseline.ef[i];
  const es = scenario ? fc.es[i] : res.es[i];
  const ef = scenario ? fc.ef[i] : res.ef[i];
  const ses = res.es[i];
  const sef = res.ef[i];
  const crit = !!res.critical[i];
  const pct = snap.pct[i];
  const done = !!fc.done[i];
  const moved = scenario && (Math.abs(sef - ef) >= 0.5 || Math.abs(ses - es) >= 0.5);
  const tip = `${a.id} ${tx(a.name, lang)}\n${fmtDate(es, lang)} - ${fmtDate(ef, lang)}${scenario ? `\n${lang === 'ar' ? 'السيناريو' : 'Scenario'}: ${fmtDate(ses, lang)} - ${fmtDate(sef, lang)}` : ''}`;
  const isMs = a.kind !== 'task';
  return (
    <g onClick={onClick} style={{ cursor: 'pointer' }} data-testid={`bar-${a.id}`}>
      <rect x={0} y={y} width={99999} height={ROW} fill={sel ? 'var(--accent)' : 'transparent'} opacity={sel ? 0.1 : 0} />
      <title>{tip}</title>
      {baseline && (isMs ? <path d={`M${bes * px},${y + 19} l3,-4 l3,4 l-3,3 z`} fill="var(--dim)" opacity={0.8} /> : <rect x={bes * px} y={y + 18} width={Math.max(2, (bef - bes) * px)} height={3} rx={1} fill="var(--dim)" opacity={0.75} />)}
      {isMs ? (
        <path d={`M${es * px},${y + 5} l6,6 l-6,6 l-6,-6 z`} fill={a.kind === 'delivery' ? 'var(--info)' : done ? 'var(--dim)' : col} stroke={crit ? 'var(--bad)' : 'none'} strokeWidth={1.6} />
      ) : (
        <>
          <rect x={es * px} y={y + 6} width={Math.max(2, (ef - es) * px)} height={10} rx={2} fill={col} opacity={done ? 0.45 : 0.9} stroke={crit ? 'var(--bad)' : 'none'} strokeWidth={crit ? 1.6 : 0} />
          {pct > 0 && !done && <rect x={es * px} y={y + 6} width={Math.max(0, (ef - es) * px * pct)} height={10} rx={2} fill="#fff" opacity={0.38} />}
        </>
      )}
      {moved && (
        <>
          {isMs ? (
            <path d={`M${ses * px},${y + 2} l5,5 l-5,5 l-5,-5 z`} fill="var(--warn)" />
          ) : (
            <>
              <rect x={ses * px} y={y + 2} width={Math.max(2, (sef - ses) * px)} height={4} rx={1.5} fill="var(--warn)" />
              <line x1={ef * px} x2={sef * px} y1={y + 11} y2={y + 11} stroke="var(--warn)" strokeDasharray="3 2" opacity={0.9} />
            </>
          )}
        </>
      )}
    </g>
  );
}
