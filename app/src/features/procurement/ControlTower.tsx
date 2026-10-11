import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ArrowUpRight, FlaskConical, Package } from 'lucide-react';
import { Btn, Card, Chip, Empty, Kpi, Seg, Td, Th, cx, toneVar, type Tone } from '../../design/ui';
import { fmtAed, fmtDate, fmtDays, fmtNum, type Lang } from '../../lib/fmt';
import { tx } from '../../lib/bi';
import { routeOptions } from '../../engine/routes';
import type { ProjectPack } from '../../engine/types';
import type { Snapshot } from '../../sim/types';
import { RISK_TONE, STAGE_KEYS, stageCounts, useProc, type ProcRow } from './model';

const STAGE_COLORS = ['#7f8f96', '#5bb8ff', '#6f9bff', '#a78bfa', '#c08bff', '#f7b84b', '#f09a4b', '#3ee0b0'];

export function StageDots({ stage }: { stage: number }) {
  return (
    <span className="inline-flex items-center gap-[3px]" aria-label={`stage ${stage}`}>
      {STAGE_KEYS.map((_, i) => (
        <span key={i} className="inline-block h-[7px] w-[7px] rounded-full" style={{ background: i < stage ? STAGE_COLORS[i + 1] : i === stage ? STAGE_COLORS[i + 1] : 'var(--surface-3)', opacity: i === stage ? 1 : i < stage ? 0.55 : 1, outline: i === stage ? '2px solid color-mix(in srgb, var(--text) 40%, transparent)' : undefined }} />
      ))}
    </span>
  );
}

export function RiskChip({ risk }: { risk: ProcRow['risk'] }) {
  const { t } = useTranslation();
  return (
    <Chip tone={RISK_TONE[risk] as Tone} dot>
      {t(`proc.risk.${risk}`)}
    </Chip>
  );
}

function FloatNum({ d }: { d: number }) {
  const tone = d < 0 ? 'bad' : d < 14 ? 'warn' : 'neutral';
  const { i18n } = useTranslation();
  return (
    <span className="num font-medium" style={{ color: tone === 'neutral' ? 'var(--text)' : toneVar[tone] }}>
      {fmtDays(d, i18n.language as Lang, true)}
    </span>
  );
}

/* ------------------------------------------------------------------ KPI strip + pipeline */
export function Summary({ rows, snap }: { rows: ProcRow[]; snap: Snapshot }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Lang;
  const open = rows.filter((r) => r.row.stage < 6);
  const risky = open.filter((r) => r.risk === 'risk' || r.risk === 'late');
  const exposed = open.filter((r) => r.row.chokepointExposed);
  const slip = exposed.length ? exposed.reduce((s, r) => s + r.deltaEta, 0) / exposed.length : 0;
  const value = open.reduce((s, r) => s + r.po.valueAED, 0);
  const matRisk = risky.reduce((s, r) => s + r.po.valueAED, 0);
  const counts = stageCounts(rows);
  const stage = useProc((s) => s.stage);
  const setStage = useProc((s) => s.setStage);
  const maxN = Math.max(...counts.map((c) => c.n), 1);
  void snap;
  return (
    <>
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-6">
        <Kpi label={t('proc.kpi.open')} value={open.length} hint={`/ ${rows.length}`} sim />
        <Kpi label={t('proc.kpi.value')} value={fmtAed(value, lang)} unit="AED" sim />
        <Kpi label={t('proc.kpi.atRisk')} value={risky.length} tone={risky.length > 3 ? 'warn' : 'good'} hint={t('proc.kpi.atRiskHint')} />
        <Kpi label={t('proc.kpi.matRisk')} value={fmtAed(matRisk, lang)} unit="AED" tone={matRisk > 0 ? 'warn' : 'good'} />
        <Kpi label={t('proc.kpi.exposed')} value={exposed.length} tone="info" hint={t('proc.kpi.exposedHint')} />
        <Kpi label={t('proc.kpi.slip')} value={fmtNum(slip, lang, 1)} unit={lang === 'ar' ? 'يوم' : 'd'} tone={slip > 0.5 ? 'bad' : 'good'} hint={t('proc.kpi.slipHint')} />
      </div>
      <Card title={t('proc.pipeline')} subtitle={t('proc.pipelineHint')} sim className="mt-3">
        <div className="grid grid-cols-4 lg:grid-cols-8 gap-2">
          {counts.map((c, i) => {
            const on = stage === i - 1;
            const label = i === 0 ? t('proc.stage.planned') : t(`proc.stage.${STAGE_KEYS[i - 1]}`);
            return (
              <button key={i} type="button" onClick={() => setStage(i - 1)} aria-pressed={on} className={cx('rounded-lg border px-2.5 py-2 text-start transition-colors', on ? 'border-accent bg-surface-2' : 'border-line hover:bg-surface-2')}>
                <div className="flex items-center gap-1.5 text-[11.5px] text-muted truncate">
                  <span className="size-2 rounded-full shrink-0" style={{ background: STAGE_COLORS[i] }} />
                  <span className="truncate">{label}</span>
                </div>
                <div className="flex items-baseline gap-1.5 mt-0.5">
                  <span className="text-[20px] font-semibold num">{c.n}</span>
                  <span className="text-[11px] text-dim num">{fmtAed(c.value, lang)}</span>
                </div>
                <div className="mt-1.5 h-1.5 rounded-full bg-surface-3 overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${(c.n / maxN) * 100}%`, background: STAGE_COLORS[i] }} />
                </div>
              </button>
            );
          })}
        </div>
      </Card>
    </>
  );
}

/* ------------------------------------------------------------------ PO table */
type Filter = 'all' | 'risk' | 'exposed' | 'imported' | 'domestic';

export function PoTable({ rows, pack }: { rows: ProcRow[]; pack: ProjectPack }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Lang;
  const [filter, setFilter] = useState<Filter>('all');
  const [q, setQ] = useState('');
  const stage = useProc((s) => s.stage);
  const selected = useProc((s) => s.selected);
  const select = useProc((s) => s.select);
  const scan = useProc((s) => s.scan);
  const view = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return rows
      .filter((r) => (stage === null ? true : r.row.stage === stage))
      .filter((r) => {
        if (filter === 'risk') return r.risk === 'risk' || r.risk === 'late';
        if (filter === 'exposed') return r.row.chokepointExposed;
        if (filter === 'imported') return r.mat.cls !== 'domestic-bulk';
        if (filter === 'domestic') return r.mat.cls === 'domestic-bulk';
        return true;
      })
      .filter((r) => !ql || `${r.po.id} ${tx(r.mat.name, 'en')} ${tx(r.mat.name, 'ar')} ${r.sup.name}`.toLowerCase().includes(ql))
      .sort((a, b) => (a.row.stage === 6 ? 1 : 0) - (b.row.stage === 6 ? 1 : 0) || a.floatDays - b.floatDays);
  }, [rows, filter, q, stage]);
  const portName = (routeId: string) => {
    const r = pack.routes.find((x) => x.id === routeId);
    return r ? tx(pack.ports.find((p) => p.id === r.portId)?.name, lang) : routeId;
  };
  return (
    <Card
      className="min-h-0 flex-1"
      bodyClass="flex flex-col min-h-0 !px-0"
      actions={
        <div className="flex items-center gap-2">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('proc.search')} aria-label={t('proc.search')} className="h-7 w-[200px] rounded-lg border border-line-2 bg-surface-2 px-2.5 text-[12.5px]" />
          <Seg<Filter>
            size="sm"
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'all', label: t('proc.filter.all') },
              { value: 'risk', label: t('proc.filter.risk'), tone: 'warn' },
              { value: 'exposed', label: t('proc.filter.exposed'), tone: 'info' },
              { value: 'imported', label: t('proc.filter.imported') },
              { value: 'domestic', label: t('proc.filter.domestic') },
            ]}
          />
        </div>
      }
    >
      <div className="overflow-auto min-h-0 flex-1" data-testid="po-table">
        <table className="w-full border-collapse">
          <thead className="sticky top-0 bg-surface z-10">
            <tr>
              <Th>{t('proc.col.po')}</Th>
              <Th>{t('proc.col.material')}</Th>
              <Th className="hidden 2xl:table-cell">{t('proc.col.supplier')}</Th>
              <Th className="hidden 2xl:table-cell">{t('proc.col.route')}</Th>
              <Th>{t('proc.col.stage')}</Th>
              <Th>{t('proc.col.eta')}</Th>
              <Th className="hidden 2xl:table-cell">{t('proc.col.needBy')}</Th>
              <Th align="end">{t('proc.col.float')}</Th>
              <Th>{t('proc.col.risk')}</Th>
              <Th align="end" className="hidden 2xl:table-cell">{t('proc.col.value')}</Th>
            </tr>
          </thead>
          <tbody>
            {view.map((r) => (
              <tr key={r.po.id} onClick={() => select(r.po.id)} className={cx('cursor-pointer transition-colors', selected === r.po.id ? 'bg-surface-2' : 'hover:bg-surface-2/60', scan === r.po.id && 'ai-row-flash')} style={scan === r.po.id ? { boxShadow: 'inset 3px 0 0 var(--violet)' } : undefined} data-po={r.po.id}>
                <Td className="tabular-nums font-medium whitespace-nowrap">{r.po.id}</Td>
                <Td className="max-w-[240px]">
                  <div className="truncate">{tx(r.mat.name, lang)}</div>
                  <div className="text-[11px] text-dim truncate">{r.row.chokepointExposed ? <span style={{ color: toneVar.info }}>{t('proc.filter.exposed')}</span> : r.mat.cls === 'domestic-bulk' ? t('proc.filter.domestic') : t('proc.filter.imported')} - {portName(r.po.routeId)}</div>
                </Td>
                <Td className="hidden 2xl:table-cell max-w-[150px] truncate">{r.sup.name}</Td>
                <Td className="hidden 2xl:table-cell whitespace-nowrap">{portName(r.po.routeId)}</Td>
                <Td>
                  <StageDots stage={r.row.stage} />
                </Td>
                <Td className="whitespace-nowrap tabular-nums">
                  {fmtDate(r.etaT, lang, 'short')}
                  {r.deltaEta > 0.5 && <span className="ms-1.5 text-[11px] font-medium" style={{ color: toneVar.bad }}>{fmtDays(r.deltaEta, lang, true)}</span>}
                </Td>
                <Td className="hidden 2xl:table-cell whitespace-nowrap tabular-nums">{fmtDate(r.row.needBy, lang, 'short')}</Td>
                <Td align="end">
                  <FloatNum d={r.floatDays} />
                </Td>
                <Td>
                  <RiskChip risk={r.risk} />
                </Td>
                <Td align="end" className="hidden 2xl:table-cell tabular-nums whitespace-nowrap">{fmtAed(r.po.valueAED, lang)}</Td>
              </tr>
            ))}
          </tbody>
        </table>
        {view.length === 0 && <Empty title={t('common.notFound')} icon={<Package size={22} />} />}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ PO detail */
export function TimelineSvg({ r, nowT }: { r: ProcRow; nowT: number }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Lang;
  const tl = r.tl;
  const segs: Array<{ k: string; a: number; b: number; c: string }> = [
    { k: 'ordered', a: tl.orderedT, b: tl.b1, c: STAGE_COLORS[1] },
    { k: 'production', a: tl.b1, b: tl.b2, c: STAGE_COLORS[2] },
    { k: 'qa', a: tl.b2, b: tl.etdT, c: STAGE_COLORS[3] },
    { k: 'sea', a: tl.etdT, b: tl.b4, c: STAGE_COLORS[4] },
    { k: 'port', a: tl.b4, b: tl.b5, c: STAGE_COLORS[5] },
    { k: 'road', a: tl.b5, b: tl.etaT, c: STAGE_COLORS[6] },
  ];
  const lo = Math.max(Math.min(tl.orderedT, nowT) - 4, nowT - 24);
  const hi = Math.max(tl.etaT, r.row.needBy) + 8;
  const W = 340;
  const x = (v: number) => ((v - lo) / (hi - lo)) * W;
  return (
    <div dir="ltr">
      <svg viewBox={`0 0 ${W} 62`} className="w-full" role="img" aria-label="PO timeline">
        {segs.map((s) => (
          <rect key={s.k} x={Math.max(0, x(s.a))} y={18} width={Math.max(2, x(s.b) - Math.max(0, x(s.a)))} height={14} rx={3} fill={s.c} opacity={0.85}>
            <title>{`${t(`proc.tl.${s.k}`)} ${fmtDate(s.a, lang, 'short')} - ${fmtDate(s.b, lang, 'short')}`}</title>
          </rect>
        ))}
        <line x1={x(nowT)} x2={x(nowT)} y1={8} y2={42} stroke="var(--accent)" strokeWidth={1.4} strokeDasharray="3 2" />
        <text x={x(nowT)} y={6} fontSize={8.5} textAnchor="middle" fill="var(--accent)">{fmtDate(nowT, lang, 'short')}</text>
        <line x1={x(r.row.needBy)} x2={x(r.row.needBy)} y1={12} y2={46} stroke="var(--bad)" strokeWidth={1.6} />
        <text x={x(r.row.needBy)} y={56} fontSize={8.5} textAnchor="middle" fill="var(--bad)">{t('proc.tl.needBy')} {fmtDate(r.row.needBy, lang, 'short')}</text>
        <polygon points={`${x(tl.etaT)},34 ${x(tl.etaT) - 4},42 ${x(tl.etaT) + 4},42`} fill={r.floatDays < 0 ? 'var(--bad)' : 'var(--good)'} />
      </svg>
      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-0.5">
        {segs.map((s) => (
          <span key={s.k} className="inline-flex items-center gap-1 text-[10.5px] text-dim">
            <span className="size-2 rounded-sm" style={{ background: s.c }} />
            {t(`proc.tl.${s.k}`)}
          </span>
        ))}
      </div>
    </div>
  );
}

export function PoDetail({ rows, pack, snap }: { rows: ProcRow[]; pack: ProjectPack; snap: Snapshot }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Lang;
  const nav = useNavigate();
  const sel = useProc((s) => s.selected);
  const hz = useProc((s) => s.hz);
  const r = rows.find((x) => x.po.id === sel);
  const opts = useMemo(() => (r ? routeOptions(pack, r.po, snap.nowT, hz === 'open' ? null : { state: hz, startT: snap.nowT, durationDays: 120 }) : []), [r, pack, snap.nowT, hz]);
  if (!r) return <Card title={t('proc.detail.title')} className="h-full"><Empty title={t('proc.detail.pick')} hint={t('proc.detail.pickHint')} icon={<Package size={22} />} /></Card>;
  const dom = r.mat.domestic;
  return (
    <Card title={`${r.po.id} - ${tx(r.mat.name, lang)}`} subtitle={`${r.sup.name} - ${r.sup.country}`} actions={<RiskChip risk={r.risk} />} className="h-full" bodyClass="overflow-auto" sim>
      <div className="grid grid-cols-3 gap-2 text-[12px]">
        <div><div className="text-dim">{t('proc.detail.qty')}</div><div className="num font-medium">{fmtNum(r.po.qty, lang)} {r.mat.unit}</div></div>
        <div><div className="text-dim">{t('proc.col.value')}</div><div className="num font-medium">{fmtAed(r.po.valueAED, lang)}</div></div>
        <div><div className="text-dim">{t('proc.detail.incoterm')}</div><div className="num font-medium">{r.po.incoterm}</div></div>
      </div>
      <div className="mt-3 text-[11.5px] font-semibold text-muted">{t('proc.detail.timeline')}</div>
      <TimelineSvg r={r} nowT={snap.nowT} />
      <div className="mt-1 flex items-center gap-2 text-[12px]">
        <span className="text-dim">{t('proc.col.float')}</span>
        <FloatNum d={r.floatDays} />
        {r.deltaEta > 0.5 && <Chip tone="bad">Chokepoint {fmtDays(r.deltaEta, lang, true)}</Chip>}
      </div>

      <div className="mt-3 text-[11.5px] font-semibold text-muted">{t('proc.detail.options')}</div>
      <div className="overflow-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <Th>{t('proc.opt.route')}</Th>
              <Th align="end">{t('proc.opt.eta')}</Th>
              <Th align="end">{t('proc.opt.dEta')}</Th>
              <Th align="end">{t('proc.opt.dCost')}</Th>
            </tr>
          </thead>
          <tbody>
            {opts.map((o) => {
              const cur = o.route.id === r.po.routeId;
              return (
                <tr key={o.route.id} className={cx(o.blocked && 'opacity-50')}>
                  <Td className="max-w-[170px]">
                    <div className="truncate">{tx(o.route.name, lang)}</div>
                    <div className="text-[10.5px] flex items-center gap-1">
                      {cur && <Chip tone="accent" className="!py-0">{t('proc.opt.current')}</Chip>}
                      {o.blocked ? <Chip tone="bad" className="!py-0">{t('proc.opt.blocked')}</Chip> : <span style={{ color: o.risk === 'low' ? toneVar.good : o.risk === 'medium' ? toneVar.warn : toneVar.bad }}>{t(`proc.opt.risk.${o.risk}`)}</span>}
                    </div>
                  </Td>
                  <Td align="end" className="tabular-nums whitespace-nowrap">{fmtDate(o.etaT, lang, 'short')}</Td>
                  <Td align="end" className="tabular-nums" >
                    <span style={{ color: o.deltaDays > 0.5 ? toneVar.bad : o.deltaDays < -0.5 ? toneVar.good : undefined }}>{cur ? '-' : fmtDays(o.deltaDays, lang, true)}</span>
                  </Td>
                  <Td align="end" className="tabular-nums whitespace-nowrap">{cur ? '-' : `${o.deltaCostAED > 0 ? '+' : ''}${fmtAed(o.deltaCostAED, lang)}`}</Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {dom && (
        <div className="mt-2 rounded-lg border border-line p-2 text-[12px]">
          <div className="font-medium" style={{ color: toneVar.good }}>{t('proc.detail.domestic')}</div>
          <div className="text-muted">{tx(dom.note, lang)}</div>
          <div className="num text-dim">{t('proc.detail.domesticNote', { days: dom.leadDays, factor: dom.costFactor.toFixed(2) })}</div>
        </div>
      )}
      <div className="mt-3 flex gap-2 flex-wrap">
        <Btn size="sm" variant="soft" icon={<ArrowUpRight size={14} />} onClick={() => nav(`/schedule?act=${r.po.deliveryActivityId}`)}>
          {t('proc.detail.openSched')}
        </Btn>
        <Btn size="sm" variant="primary" icon={<FlaskConical size={14} />} onClick={() => nav('/whatif')}>
          {t('proc.detail.openWhatIf')}
        </Btn>
      </div>
    </Card>
  );
}
