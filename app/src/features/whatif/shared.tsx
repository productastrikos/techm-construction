import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Box, CalendarRange, Check } from 'lucide-react';
import { Bar, Btn, Card, Chip, Kpi, N, Td, Th, type Tone } from '../../design/ui';
import { fmtAed, fmtDate, fmtDays, type Lang } from '../../lib/fmt';
import { tx } from '../../lib/bi';
import { AiTag } from '../ai/kit';
import type { CostBreakdown, RecoveryOption, ScenarioResult } from '../../engine/scenario';
import type { ProjectPack } from '../../engine/types';
import type { Snapshot } from '../../sim/types';

const COST_KEYS: Array<[keyof CostBreakdown, string, Tone]> = [
  ['ld', 'wi.cost.ld', 'bad'],
  ['prolongation', 'wi.cost.prolongation', 'warn'],
  ['expedite', 'wi.cost.expedite', 'info'],
  ['escalation', 'wi.cost.escalation', 'violet'],
  ['rental', 'wi.cost.rental', 'accent'],
  ['shifts', 'wi.cost.shifts', 'info'],
  ['repair', 'wi.cost.repair', 'warn'],
];

export function ResultKpis({ result, snap, lang }: { result: ScenarioResult | null; snap: Snapshot; lang: Lang }) {
  const { t } = useTranslation();
  const r = result;
  const d = r?.dFinish ?? 0;
  const tone: Tone = d > 14 ? 'bad' : d > 1 ? 'warn' : d < -1 ? 'good' : 'neutral';
  return (
    <div className="grid grid-cols-4 gap-3 max-[1200px]:grid-cols-2" data-testid="result-kpis">
      <Kpi label={t('wi.kpi.finish')} value={fmtDate(r?.finish ?? snap.forecastFinish, lang)} tone={tone} hint={`${t('wi.kpi.vsForecast')} ${fmtDays(d, lang, true)}`} delta={r ? fmtDays(d, lang, true) : undefined} deltaTone={tone} />
      <Kpi label={t('wi.kpi.vsContract')} value={fmtDays(r ? r.finish - snap.contractFinish : snap.forecastFinish - snap.contractFinish, lang, true)} tone={(r?.finish ?? snap.forecastFinish) > snap.contractFinish + 14 ? 'bad' : 'warn'} hint={`${t('sched.baselineFinish')} ${fmtDate(snap.contractFinish, lang, 'short')}`} />
      <Kpi label={t('wi.kpi.cost')} value={`AED ${fmtAed(r?.cost.total ?? 0, lang)}`} tone={(r?.cost.total ?? 0) > 1e7 ? 'bad' : (r?.cost.total ?? 0) > 0 ? 'warn' : 'neutral'} hint={t('wi.kpi.costHint')} />
      <Kpi label={t('wi.kpi.critical')} value={r ? `${r.newlyCritical.length}` : '0'} tone={r && r.newlyCritical.length > 0 ? 'warn' : 'neutral'} hint={`${r?.affectedElements.length ?? 0} ${t('wi.kpi.elements')}`} />
    </div>
  );
}

export function CostBars({ cost, lang }: { cost: CostBreakdown; lang: Lang }) {
  const { t } = useTranslation();
  const max = Math.max(1, ...COST_KEYS.map(([k]) => Math.abs(cost[k])));
  return (
    <div className="flex flex-col gap-1.5" data-testid="cost-bars">
      {COST_KEYS.map(([k, label, tone]) => (
        <div key={k} className="grid grid-cols-[110px_1fr_74px] items-center gap-2 text-[12px]">
          <span className="text-muted truncate">{t(label)}</span>
          <Bar value={Math.abs(cost[k]) / max} tone={tone} />
          <span className="num text-end">{fmtAed(cost[k], lang)}</span>
        </div>
      ))}
      <div className="flex justify-between border-t border-line pt-1.5 text-[13px] font-semibold">
        <span>{t('wi.cost.total')}</span>
        <span className="num">AED {fmtAed(cost.total, lang)}</span>
      </div>
    </div>
  );
}

export function ChangedList({ result, pack, lang, onOpen }: { result: ScenarioResult; pack: ProjectPack; lang: Lang; onOpen: (id: string) => void }) {
  const { t } = useTranslation();
  const rows = [...result.changed].filter((c) => Math.abs(c.dEf) >= 0.5).sort((a, b) => Math.abs(b.dEf) - Math.abs(a.dEf)).slice(0, 8);
  return (
    <div className="flex flex-col gap-0.5">
      {rows.length === 0 && <div className="text-[12px] text-dim">{t('wi.noChange')}</div>}
      {rows.map((c) => {
        const a = pack.activities[pack.activities.findIndex((x) => x.id === c.id)];
        return (
          <button key={c.id} type="button" onClick={() => onOpen(c.id)} className="flex items-center gap-2 text-start hover:bg-surface-2 rounded px-1.5 py-0.5 text-[12px]">
            <span className="mono text-[10px] text-dim w-[58px] shrink-0">{c.id}</span>
            <span className="truncate flex-1" dir="auto">{tx(a.name, lang)}</span>
            <span className="num font-semibold" style={{ color: c.dEf > 0 ? 'var(--bad)' : 'var(--good)' }}>{fmtDays(c.dEf, lang, true)}</span>
          </button>
        );
      })}
      {result.changed.length > 8 && <div className="text-[11px] text-dim px-1.5">+{result.changed.length - 8} {t('wi.moreActs')}</div>}
    </div>
  );
}

export function OptionCards({ options, applied, onApply, lang, baseDFinish }: { options: RecoveryOption[]; applied: string | null; onApply: (id: string | null) => void; lang: Lang; baseDFinish: number }) {
  const { t } = useTranslation();
  return (
    <div className="grid grid-cols-3 gap-3 max-[1200px]:grid-cols-1" data-testid="recovery-options">
      {options.slice(0, 3).map((o, i) => {
        const on = applied === o.id;
        return (
          <div key={o.id} className={`rounded-xl border p-3 flex flex-col gap-1.5 ${on ? 'border-accent bg-[color-mix(in_srgb,var(--accent)_8%,transparent)]' : i === 0 ? 'border-[color-mix(in_srgb,var(--violet)_55%,var(--line))] bg-surface ai-glow' : 'border-line bg-surface'}`} data-testid={`option-${o.id}`}>
            {i === 0 && !on && <div><AiTag label={t('wi.opt.aiRec')} /></div>}
            <div className="flex items-start gap-2">
              <span className="size-5 rounded-full bg-surface-3 text-[11px] font-bold flex items-center justify-center shrink-0">{i + 1}</span>
              <div className="text-[13px] font-semibold leading-snug" dir="auto">{tx(o.title, lang)}</div>
            </div>
            <div className="text-[12px] text-muted leading-snug" dir="auto">{tx(o.detail, lang)}</div>
            <div className="grid grid-cols-3 gap-2 mt-1">
              <MiniStat label={t('wi.opt.recovers')} value={fmtDays(o.recoveredDays, lang)} tone={o.recoveredDays >= baseDFinish * 0.8 ? 'good' : 'warn'} />
              <MiniStat label={t('wi.opt.spend')} value={`AED ${fmtAed(o.spendAED, lang)}`} />
              <MiniStat label={t('wi.opt.net')} value={`${o.netAED < 0 ? '-' : '+'}AED ${fmtAed(Math.abs(o.netAED), lang)}`} tone={o.netAED < 0 ? 'good' : 'bad'} />
            </div>
            <div className="text-[11.5px] text-dim">
              {t('wi.opt.newFinish')}: <span className="num text-ink font-medium">{fmtDays(o.dFinish, lang, true)}</span> {t('wi.kpi.vsForecast')}
            </div>
            <ul className="m-0 ps-4 text-[11.5px] text-dim">
              {o.tradeoffs.map((x, k) => (
                <li key={k} dir="auto">{tx(x, lang)}</li>
              ))}
            </ul>
            <Btn variant={on ? 'soft' : 'primary'} size="sm" className="mt-auto" onClick={() => onApply(on ? null : o.id)} data-testid={`apply-${o.id}`} icon={on ? <Check size={14} /> : <ArrowRight size={14} className="flip-rtl" />}>
              {on ? t('wi.opt.applied') : t('wi.opt.apply')}
            </Btn>
          </div>
        );
      })}
    </div>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: string; tone?: Tone }) {
  const c = tone === 'good' ? 'var(--good)' : tone === 'bad' ? 'var(--bad)' : tone === 'warn' ? 'var(--warn)' : 'var(--text)';
  return (
    <div className="min-w-0">
      <div className="text-[10px] uppercase tracking-wider text-dim truncate">{label}</div>
      <div className="text-[13px] font-semibold num truncate" style={{ color: c }}>{value}</div>
    </div>
  );
}

export function PoImpactTable({ result, snap, pack, lang, selected, onSelect, rows = 12 }: { result: ScenarioResult | null; snap: Snapshot; pack: ProjectPack; lang: Lang; selected: string | null; onSelect: (id: string) => void; rows?: number }) {
  const { t } = useTranslation();
  const list = snap.pos
    .filter((p) => p.stage < 6)
    .map((p) => ({ p, imp: result?.poImpacts.find((x) => x.poId === p.id) }))
    .sort((a, b) => Number(!!b.imp && b.imp.slipDays > 0.5) - Number(!!a.imp && a.imp.slipDays > 0.5) || (b.imp?.lateDays ?? 0) - (a.imp?.lateDays ?? 0) || Number(b.p.chokepointExposed) - Number(a.p.chokepointExposed) || a.p.floatDays - b.p.floatDays)
    .slice(0, rows);
  return (
    <div className="overflow-auto">
      <table className="w-full border-collapse" data-testid="po-table">
        <thead>
          <tr>
            <Th>PO</Th>
            <Th>{t('wi.po.material')}</Th>
            <Th>{t('wi.po.route')}</Th>
            <Th align="end">ETA</Th>
            <Th align="end">{t('wi.po.slip')}</Th>
            <Th align="end">{t('wi.po.float')}</Th>
          </tr>
        </thead>
        <tbody>
          {list.map(({ p, imp }) => {
            const slip = imp?.slipDays ?? 0;
            const fl = imp ? imp.floatAfter : p.floatDays;
            const route = pack.routes.find((r) => r.id === (imp?.routeId ?? p.routeId))!;
            return (
              <tr key={p.id} onClick={() => onSelect(p.id)} className={`cursor-pointer hover:bg-surface-2 ${selected === p.id ? 'bg-[color-mix(in_srgb,var(--accent)_12%,transparent)]' : ''}`} data-testid={`po-${p.id}`}>
                <Td className="mono">{p.id}</Td>
                <Td className="max-w-[170px] truncate" title={tx(pack.materials.find((m) => m.id === p.materialId)?.name, lang)}>{tx(pack.materials.find((m) => m.id === p.materialId)?.name, lang)}</Td>
                <Td>
                  <Chip tone={route.chokepointDependent ? 'warn' : 'good'}>{route.id.replace('R-', '')}</Chip>
                </Td>
                <Td align="end">
                  <N>{fmtDate(imp?.etaScenario ?? p.etaT, lang, 'short')}</N>
                </Td>
                <Td align="end">
                  <span className="num" style={{ color: slip > 0.5 ? 'var(--bad)' : 'var(--dim)' }}>{slip > 0.5 ? `+${Math.round(slip)}d` : '-'}</span>
                </Td>
                <Td align="end">
                  <Chip tone={fl < 0 ? 'bad' : fl < 14 ? 'warn' : 'good'}>{Math.round(fl)}d</Chip>
                </Td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function ActionsBar({ onSave, onCommit, committed, disabled }: { onSave: () => void; onCommit: () => void; committed: boolean; disabled?: boolean }) {
  const { t } = useTranslation();
  const nav = useNavigate();
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Btn size="sm" icon={<CalendarRange size={14} />} onClick={() => nav('/schedule')} disabled={disabled} data-testid="view-gantt">
        {t('wi.act.gantt')}
      </Btn>
      <Btn size="sm" icon={<Box size={14} />} onClick={() => nav('/twin')} disabled={disabled} data-testid="view-3d">
        {t('wi.act.twin')}
      </Btn>
      <Btn size="sm" variant="soft" onClick={onSave} disabled={disabled}>
        {t('wi.act.save')}
      </Btn>
      <Btn size="sm" variant={committed ? 'soft' : 'primary'} onClick={onCommit} disabled={disabled} icon={committed ? <Check size={14} /> : undefined} data-testid="commit">
        {committed ? t('wi.act.committed') : t('wi.act.commit')}
      </Btn>
    </div>
  );
}

export function CompareCard({ title, rows }: { title: string; rows: Array<{ label: string; finish: string; delta: number; cost: number; tone?: Tone; highlight?: boolean }> }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Lang;
  return (
    <Card title={title} sim>
      <table className="w-full border-collapse" data-testid="compare">
        <thead>
          <tr>
            <Th>{t('wi.cmp.scenario')}</Th>
            <Th align="end">{t('wi.kpi.finish')}</Th>
            <Th align="end">{t('wi.cmp.delta')}</Th>
            <Th align="end">{t('wi.cmp.cost')}</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className={r.highlight ? 'bg-[color-mix(in_srgb,var(--accent)_10%,transparent)]' : ''}>
              <Td>{r.label}</Td>
              <Td align="end"><N>{r.finish}</N></Td>
              <Td align="end">
                <span className="num font-semibold" style={{ color: r.delta > 1 ? 'var(--bad)' : r.delta < -1 ? 'var(--good)' : 'var(--muted)' }}>{fmtDays(r.delta, lang, true)}</span>
              </Td>
              <Td align="end"><N>AED {fmtAed(r.cost, lang)}</N></Td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
