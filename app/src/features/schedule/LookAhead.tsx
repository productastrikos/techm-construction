import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, Chip, type Tone } from '../../design/ui';
import { fmtDate, type Lang } from '../../lib/fmt';
import { tx } from '../../lib/bi';
import type { ProjectPack } from '../../engine/types';
import type { Snapshot } from '../../sim/types';
import { FLAG_HEALTH } from '../../engine/assets';

/** 3-week look-ahead board: what is in progress / starts in each of the next three weeks, with constraints flagged */
export function LookAhead({ pack, snap, onOpen }: { pack: ProjectPack; snap: Snapshot; onOpen: (id: string) => void }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Lang;
  const f = snap.forecast;
  const now = snap.nowT;

  const cols = useMemo(() => {
    const out: Array<{ key: string; title: string; from: number; to: number; items: number[] }> = [
      { key: 'inprog', title: t('sched.la.inprogress'), from: -Infinity, to: now, items: [] },
      { key: 'w1', title: `${t('sched.la.week')} 1`, from: now, to: now + 7, items: [] },
      { key: 'w2', title: `${t('sched.la.week')} 2`, from: now + 7, to: now + 14, items: [] },
      { key: 'w3', title: `${t('sched.la.week')} 3`, from: now + 14, to: now + 21, items: [] },
    ];
    pack.activities.forEach((a, i) => {
      if (a.kind !== 'task' || f.done[i]) return;
      const es = f.es[i];
      const ef = f.ef[i];
      if (es <= now && ef > now) out[0].items.push(i);
      else if (es > now && es <= now + 21) out[es <= now + 7 ? 1 : es <= now + 14 ? 2 : 3].items.push(i);
    });
    out.forEach((c) => c.items.sort((a, b) => Number(f.critical[b]) - Number(f.critical[a]) || f.es[a] - f.es[b]));
    return out;
  }, [pack, f, now, t]);

  // constraints log: late POs, flagged assets, tight floats
  const constraints = useMemo(() => {
    const rows: Array<{ tone: Tone; text: string }> = [];
    for (const p of snap.pos.filter((x) => x.stage < 6 && (x.risk === 'late' || x.risk === 'risk')).slice(0, 6))
      rows.push({ tone: p.risk === 'late' ? 'bad' : 'warn', text: `${p.id} ${tx(pack.materials.find((m) => m.id === p.materialId)?.name, lang)}: ${Math.round(p.floatDays)} d float, ETA ${fmtDate(p.etaT, lang, 'short')}` });
    for (const a of snap.assets.filter((x) => x.report.health < FLAG_HEALTH)) rows.push({ tone: a.report.health < 40 ? 'bad' : 'warn', text: `${a.id}: ${t('sched.la.health')} ${Math.round(a.report.health)}${a.report.rulDays !== null ? `, ${t('sched.la.rul')} ${a.report.rulDays.toFixed(0)} d` : ''}` });
    rows.push({ tone: 'info', text: lang === 'ar' ? 'الموافقات التنظيمية: لا عوائق مفتوحة' : 'Regulatory approvals: no open blockers' });
    return rows;
  }, [snap, pack, lang, t]);

  return (
    <div className="flex flex-col gap-3" data-testid="lookahead">
      <div className="grid grid-cols-4 gap-3 max-[1200px]:grid-cols-2">
        {cols.map((c) => (
          <Card key={c.key} title={`${c.title} (${c.items.length})`} subtitle={c.key === 'inprog' ? fmtDate(now, lang) : `${fmtDate(c.from, lang, 'short')} - ${fmtDate(c.to, lang, 'short')}`} bodyClass="flex flex-col gap-1.5 max-h-[420px] overflow-auto">
            {c.items.length === 0 && <div className="text-[12px] text-dim">-</div>}
            {c.items.slice(0, 14).map((i) => {
              const a = pack.activities[i];
              const wbs = pack.wbs.find((w) => w.id === a.wbsId)!;
              return (
                <button key={a.id} type="button" onClick={() => onOpen(a.id)} className="text-start rounded-lg border border-line bg-surface-2 hover:bg-surface-3 px-2 py-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="size-2 rounded-sm shrink-0" style={{ background: wbs.color }} />
                    <span className="mono text-[10px] text-dim">{a.id}</span>
                    {f.critical[i] ? <Chip tone="bad" className="!text-[9.5px] ms-auto">{t('sched.critical')}</Chip> : null}
                  </div>
                  <div className="text-[12px] leading-snug" dir="auto">{tx(a.name, lang)}</div>
                  <div className="text-[10.5px] text-dim num">{fmtDate(f.es[i], lang, 'short')} - {fmtDate(f.ef[i], lang, 'short')} - {a.crew ?? 0} {t('sched.la.crew')}</div>
                </button>
              );
            })}
          </Card>
        ))}
      </div>
      <Card title={t('sched.la.constraints')} sim>
        <div className="flex flex-col gap-1">
          {constraints.map((c, i) => (
            <div key={i} className="flex items-center gap-2 text-[12.5px]">
              <Chip tone={c.tone} dot>{c.tone === 'bad' ? t('sched.la.high') : c.tone === 'warn' ? t('sched.la.med') : t('sched.la.info')}</Chip>
              <span dir="auto">{c.text}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
