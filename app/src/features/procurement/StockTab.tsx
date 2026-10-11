import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Bar, Card, Chip, Td, Th, toneVar, type Tone } from '../../design/ui';
import { Chart, useChartPalette } from '../../design/Chart';
import { imageUrl } from '../../lib/images';
import { fmtNum, type Lang } from '../../lib/fmt';
import { tx } from '../../lib/bi';
import type { ProjectPack } from '../../engine/types';
import type { Snapshot } from '../../sim/types';
import { h01 } from './model';

interface StockRow {
  id: string;
  name: ReturnType<typeof Object>;
  unit: string;
  onHand: number;
  draw: number;
  cover: number;
  nextIn: number | null;
  status: 'ok' | 'low' | 'out';
}

/** deterministic, illustrative stock position per material */
export function stockModel(pack: ProjectPack, snap: Snapshot) {
  const ids = pack.materials.filter((m) => m.cls === 'domestic-bulk' || ['M-SHEET', 'M-STEEL', 'M-GEOT', 'M-PIPE', 'M-COAT'].includes(m.id));
  const forced: Record<string, number> = { 'M-REBAR': 9, 'M-ASPH': 6, 'M-AGG': 12, 'M-SHEET': 17, 'M-GEOT': 5 };
  return ids.map((m) => {
    const r = h01('stock' + m.id);
    const drawBase: Record<string, number> = { t: 120, m3: 900, pcs: 160, m2: 380, lot: 1, km: 0.4 };
    const draw = Math.max(0.3, (drawBase[m.unit] ?? 20) * (0.4 + r * 1.6));
    const cover = forced[m.id] ?? 14 + Math.round(h01('cv' + m.id) * 38);
    const next = pack.pos.filter((p) => p.materialId === m.id && p.etaT > snap.nowT).map((p) => p.etaT - snap.nowT);
    const nextIn = next.length ? Math.min(...next) : null;
    const status: StockRow['status'] = cover < 7 ? 'out' : cover < 14 ? 'low' : 'ok';
    return { id: m.id, name: m.name, unit: m.unit, onHand: draw * cover, draw, cover, nextIn, status };
  });
}

const ZONES = [
  { k: 'a', base: 0.74 },
  { k: 'b', base: 0.58 },
  { k: 'c', base: 0.83 },
  { k: 'd', base: 0.46 },
  { k: 'e', base: 0.31 },
];

export function StockTab({ pack, snap }: { pack: ProjectPack; snap: Snapshot }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Lang;
  const pal = useChartPalette();
  const rows = useMemo(() => stockModel(pack, snap), [pack, snap]);
  const sorted = [...rows].sort((a, b) => a.cover - b.cover);
  const reorder = sorted.filter((r) => r.status !== 'ok');
  const tone = (s: StockRow['status']): Tone => (s === 'ok' ? 'good' : s === 'low' ? 'warn' : 'bad');
  const chart = useMemo(
    () => ({
      grid: { left: 130, right: 24, top: 8, bottom: 22 },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      xAxis: { type: 'value', axisLabel: { color: pal.muted }, splitLine: { lineStyle: { color: pal.grid } } },
      yAxis: { type: 'category', inverse: true, data: sorted.map((r) => tx(r.name as never, lang)), axisLabel: { color: pal.text, fontSize: 11, width: 118, overflow: 'truncate' } },
      series: [
        {
          type: 'bar',
          data: sorted.map((r) => ({ value: r.cover, itemStyle: { color: r.status === 'ok' ? pal.good : r.status === 'low' ? pal.warn : pal.bad, borderRadius: 3 } })),
          barWidth: 11,
          markLine: { silent: true, symbol: 'none', lineStyle: { color: pal.warn, type: 'dashed' }, data: [{ xAxis: 14 }], label: { formatter: '14 d', color: pal.warn } },
        },
      ],
    }),
    [sorted, pal, lang],
  );
  return (
    <div className="grid gap-3 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
      <div className="flex flex-col gap-3 min-w-0">
        <Card title={t('proc.stock.title')} subtitle={t('proc.stock.hint')} sim>
          <Chart option={chart} height={Math.max(240, rows.length * 22 + 30)} />
        </Card>
        <Card title={t('proc.stock.title')} sim bodyClass="!px-0 overflow-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <Th>{t('proc.stock.col.material')}</Th>
                <Th align="end">{t('proc.stock.col.onHand')}</Th>
                <Th align="end">{t('proc.stock.col.draw')}</Th>
                <Th align="end">{t('proc.stock.col.cover')}</Th>
                <Th align="end">{t('proc.stock.col.next')}</Th>
                <Th>{t('proc.stock.col.status')}</Th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => (
                <tr key={r.id}>
                  <Td>{tx(r.name as never, lang)}</Td>
                  <Td align="end" className="tabular-nums">{fmtNum(r.onHand, lang)} {r.unit}</Td>
                  <Td align="end" className="tabular-nums">{fmtNum(r.draw, lang, r.draw < 5 ? 1 : 0)}</Td>
                  <Td align="end" className="tabular-nums font-medium" >
                    <span style={{ color: toneVar[tone(r.status)] }}>{r.cover}</span>
                  </Td>
                  <Td align="end" className="tabular-nums">{r.nextIn === null ? '-' : `${Math.round(r.nextIn)} ${lang === 'ar' ? 'يوم' : 'd'}`}</Td>
                  <Td>
                    <Chip tone={tone(r.status)} dot>{t(`proc.stock.${r.status}`)}</Chip>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
      <div className="flex flex-col gap-3 min-w-0">
        <Card title={t('proc.stock.reorder')} sim="rule">
          {reorder.length === 0 ? (
            <div className="text-[12.5px] text-muted">{t('proc.stock.none')}</div>
          ) : (
            <ul className="space-y-1.5 m-0 ps-0 list-none">
              {reorder.map((r) => (
                <li key={r.id} className="flex gap-2 text-[12.5px]">
                  <span className="mt-1.5 size-2 rounded-full shrink-0" style={{ background: toneVar[tone(r.status)] }} />
                  <span>{r.nextIn === null ? t('proc.stock.reorderLineNone', { m: tx(r.name as never, lang), d: r.cover }) : t('proc.stock.reorderLine', { m: tx(r.name as never, lang), d: r.cover, n: Math.round(r.nextIn) })}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title={t('proc.laydown.title')} sim>
          <div className="relative rounded-lg overflow-hidden mb-3">
            <img src={imageUrl('cctv-yard')} alt="" className="w-full h-[150px] object-cover" />
            <span className="absolute start-2 top-2 rounded bg-black/55 px-1.5 text-[10.5px] text-white">CAM-YARD-02</span>
          </div>
          <div className="space-y-2.5">
            {ZONES.map((z) => {
              const v = Math.min(0.97, z.base + 0.04 * Math.sin(snap.nowT / 6 + z.base * 9));
              return (
                <div key={z.k}>
                  <div className="flex justify-between text-[12px]">
                    <span>{t(`proc.zone.${z.k}`)}</span>
                    <span className="num text-muted">{Math.round(v * 100)}% {t('proc.laydown.occupancy')}</span>
                  </div>
                  <Bar value={v} tone={v > 0.85 ? 'warn' : 'accent'} />
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}
