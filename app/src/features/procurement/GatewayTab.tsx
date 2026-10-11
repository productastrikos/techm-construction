import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Radio, ShieldCheck, Ship, Truck, Warehouse } from 'lucide-react';
import { Card, Chip, Td, Th, Dot, SimChip } from '../../design/ui';
import { fmtDate, type Lang } from '../../lib/fmt';
import { tx } from '../../lib/bi';
import type { ProjectPack } from '../../engine/types';
import type { Snapshot } from '../../sim/types';
import { h01, type ProcRow } from './model';

const CONNECTORS = [
  { k: 'c1', icon: <Ship size={18} />, records: 1842, latency: 220 },
  { k: 'c2', icon: <Warehouse size={18} />, records: 614, latency: 310 },
  { k: 'c3', icon: <Radio size={18} />, records: 96, latency: 540 },
  { k: 'c4', icon: <ShieldCheck size={18} />, records: 377, latency: 410 },
  { k: 'c5', icon: <Truck size={18} />, records: 58, latency: 160 },
];

/** fictional ISO-style unit id (prefix MZTU is not a real owner code) */
const unitId = (po: string, i: number) => `MZTU ${String(Math.floor(h01(po + i) * 900000) + 100000)} ${Math.floor(h01(po + 'c' + i) * 9)}`;

export function GatewayTab({ rows, pack, snap }: { rows: ProcRow[]; pack: ProjectPack; snap: Snapshot }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Lang;
  const units = useMemo(() => {
    const out: Array<{ id: string; po: string; ev: string; where: string; customs: 'cleared' | 'hold' | 'pending'; t: number }> = [];
    for (const r of rows) {
      if (r.row.stage < 3 || r.row.stage > 5) continue;
      const port = tx(pack.ports.find((p) => p.id === pack.routes.find((x) => x.id === r.po.routeId)?.portId)?.name, lang);
      const n = Math.max(1, Math.min(3, Math.round(r.po.weightT / 900)));
      for (let i = 0; i < n; i++) {
        const v = h01('cu' + r.po.id + i);
        out.push({
          id: unitId(r.po.id, i),
          po: r.po.id,
          ev: r.row.stage === 3 ? 'proc.gw.ev.sea' : r.row.stage === 4 ? (v > 0.5 ? 'proc.gw.ev.gatein' : 'proc.gw.ev.arrived') : 'proc.gw.ev.gateout',
          where: r.row.stage === 3 ? '-' : port,
          customs: r.row.stage === 3 ? 'pending' : r.row.stage === 4 ? (v > 0.78 ? 'hold' : v > 0.35 ? 'cleared' : 'pending') : 'cleared',
          t: snap.nowT - v * 2,
        });
      }
    }
    return out.slice(0, 16);
  }, [rows, pack, lang, snap.nowT]);
  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-xl border px-3.5 py-2 text-[12.5px] flex items-center gap-2" style={{ borderColor: 'color-mix(in srgb, var(--warn) 50%, transparent)', background: 'color-mix(in srgb, var(--warn) 10%, transparent)' }}>
        <SimChip />
        <span>{t('proc.gw.banner')}</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {CONNECTORS.map((c) => (
          <Card key={c.k} className="!p-0">
            <div className="p-3">
              <div className="flex items-center gap-2 text-accent">
                {c.icon}
                <span className="font-semibold text-ink text-[13px] truncate">{t(`proc.gw.${c.k}`)}</span>
              </div>
              <div className="text-[11.5px] text-dim mt-1 min-h-[30px]">{t(`proc.gw.${c.k}d`)}</div>
              <div className="mt-2 flex items-center gap-1.5 text-[12px]">
                <Dot tone="warn" pulse />
                <span>{t('proc.gw.status')}</span>
              </div>
              <div className="mt-1.5 grid grid-cols-2 gap-1 text-[11px] text-muted tabular-nums">
                <span>{c.records} {t('proc.gw.records')}</span>
                <span className="text-end">{t('proc.gw.latency')} {c.latency} ms</span>
              </div>
              <div className="text-[11px] text-dim mt-0.5">{t('proc.gw.sync')}: {fmtDate(snap.nowT, lang, 'short')} 08:00</div>
            </div>
          </Card>
        ))}
      </div>
      <Card title={t('proc.gw.containers')} subtitle={t('proc.gw.sub')} sim bodyClass="!px-0 overflow-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <Th>{t('proc.gw.col.unit')}</Th>
              <Th>{t('proc.gw.col.po')}</Th>
              <Th>{t('proc.gw.col.event')}</Th>
              <Th>{t('proc.gw.col.where')}</Th>
              <Th>{t('proc.gw.col.customs')}</Th>
            </tr>
          </thead>
          <tbody>
            {units.map((u) => (
              <tr key={u.id}>
                <Td className="tabular-nums font-medium whitespace-nowrap">{u.id}</Td>
                <Td className="tabular-nums">{u.po}</Td>
                <Td>{t(u.ev)}</Td>
                <Td>{u.where}</Td>
                <Td>
                  <Chip tone={u.customs === 'cleared' ? 'good' : u.customs === 'hold' ? 'bad' : 'warn'} dot>
                    {t(`proc.gw.cu.${u.customs}`)}
                  </Chip>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
        {units.length === 0 && <div className="p-4 text-[12.5px] text-muted">{t('proc.gw.empty')}</div>}
      </Card>
    </div>
  );
}
