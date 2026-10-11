import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Bar, Card, Chip, Td, Th, toneVar } from '../../design/ui';
import { fmtAed, fmtPct, fmtDays, type Lang } from '../../lib/fmt';
import { tx } from '../../lib/bi';
import type { ProjectPack } from '../../engine/types';
import type { ProcRow } from './model';
import { h01 } from './model';

const score = (onTime: number, quality: number, priceVar: number) => 100 * (0.5 * onTime + 0.3 * quality + 0.2 * Math.max(0, 1 - Math.abs(priceVar) * 6));

export function SuppliersTab({ rows, pack }: { rows: ProcRow[]; pack: ProjectPack }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Lang;
  const table = useMemo(
    () =>
      pack.suppliers
        .map((s) => {
          const mine = rows.filter((r) => r.po.supplierId === s.id && r.row.stage < 6);
          return { s, open: mine.length, value: mine.reduce((a, r) => a + r.po.valueAED, 0), risk: mine.filter((r) => r.risk === 'risk' || r.risk === 'late').length, score: score(s.onTime, s.quality, s.priceVar) };
        })
        .sort((a, b) => b.value - a.value),
    [rows, pack],
  );

  const fend = pack.materials.find((m) => m.id === 'M-FEND');
  const bids = [
    { k: 'incumbent', price: 100, lead: fend?.leadTimeDays ?? 120, exposure: fend?.exposure ?? 0.9, quality: 0.92 },
    { k: 'regional', price: Math.round((fend?.domestic?.costFactor ?? 1.18) * 100), lead: fend?.domestic?.leadDays ?? 75, exposure: 0.12, quality: 0.86 },
    { k: 'second', price: 108, lead: 150, exposure: 0.85, quality: 0.9 },
  ].map((b) => ({ ...b, score: Math.round(100 * (0.3 * (1 - (b.price - 95) / 40) + 0.3 * (1 - b.lead / 200) + 0.25 * (1 - b.exposure) + 0.15 * b.quality)) }));
  const best = bids.reduce((a, b) => (a.score >= b.score ? a : b));

  const matches = useMemo(
    () =>
      rows
        .filter((r) => r.row.stage >= 5)
        .slice(0, 7)
        .map((r) => {
          const v = h01('3w' + r.po.id);
          const grn = r.po.valueAED * (v > 0.8 ? 0.97 : 1);
          const inv = r.po.valueAED * (v > 0.55 && v <= 0.8 ? 1.02 : v > 0.8 ? 0.97 : 1);
          return { r, grn, inv, ok: Math.abs(inv - r.po.valueAED) < 1 && Math.abs(grn - r.po.valueAED) < 1 };
        }),
    [rows],
  );

  return (
    <div className="grid gap-3 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
      <Card title={t('proc.sup.title')} sim bodyClass="!px-0 overflow-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <Th>{t('proc.sup.col.supplier')}</Th>
              <Th className="hidden lg:table-cell">{t('proc.sup.col.country')}</Th>
              <Th>{t('proc.sup.col.onTime')}</Th>
              <Th>{t('proc.sup.col.quality')}</Th>
              <Th align="end">{t('proc.sup.col.price')}</Th>
              <Th align="end">{t('proc.sup.col.open')}</Th>
              <Th align="end" className="hidden xl:table-cell">{t('proc.sup.col.value')}</Th>
              <Th align="end">{t('proc.sup.col.score')}</Th>
            </tr>
          </thead>
          <tbody>
            {table.map(({ s, open, value, risk, score: sc }) => (
              <tr key={s.id}>
                <Td className="font-medium">{s.name}</Td>
                <Td className="hidden lg:table-cell text-muted">{s.country}</Td>
                <Td className="min-w-[90px]">
                  <div className="num text-[12px]">{fmtPct(s.onTime, lang)}</div>
                  <Bar value={s.onTime} tone={s.onTime > 0.85 ? 'good' : s.onTime > 0.75 ? 'warn' : 'bad'} height={4} />
                </Td>
                <Td className="min-w-[90px]">
                  <div className="num text-[12px]">{fmtPct(s.quality, lang)}</div>
                  <Bar value={s.quality} tone="info" height={4} />
                </Td>
                <Td align="end" className="tabular-nums"><span style={{ color: s.priceVar > 0.03 ? toneVar.warn : undefined }}>{s.priceVar > 0 ? '+' : ''}{fmtPct(s.priceVar, lang, 1)}</span></Td>
                <Td align="end" className="tabular-nums">{open}{risk > 0 && <span className="ms-1" style={{ color: toneVar.warn }}>({risk})</span>}</Td>
                <Td align="end" className="hidden xl:table-cell tabular-nums">{fmtAed(value, lang)}</Td>
                <Td align="end"><Chip tone={sc > 85 ? 'good' : sc > 75 ? 'info' : 'warn'}>{Math.round(sc)}</Chip></Td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <div className="flex flex-col gap-3 min-w-0">
        <Card title={t('proc.rfq.title')} subtitle={t('proc.rfq.sub')} sim="rule" bodyClass="!px-0 overflow-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <Th>{t('proc.rfq.bidder')}</Th>
                <Th align="end">{t('proc.rfq.price')}</Th>
                <Th align="end">{t('proc.rfq.lead')}</Th>
                <Th align="end">{t('proc.rfq.exposure')}</Th>
                <Th align="end">{t('proc.rfq.score')}</Th>
              </tr>
            </thead>
            <tbody>
              {bids.map((b) => (
                <tr key={b.k} className={b === best ? 'bg-surface-2' : undefined}>
                  <Td>
                    {t(`proc.rfq.${b.k}`)}
                    {b === best && <Chip tone="accent" className="ms-1.5 !py-0">{t('proc.rfq.recommend')}</Chip>}
                  </Td>
                  <Td align="end" className="tabular-nums">{b.price}</Td>
                  <Td align="end" className="tabular-nums">{fmtDays(b.lead, lang)}</Td>
                  <Td align="end" className="tabular-nums"><span style={{ color: b.exposure > 0.5 ? toneVar.bad : toneVar.good }}>{fmtPct(b.exposure, lang)}</span></Td>
                  <Td align="end" className="tabular-nums font-semibold">{b.score}</Td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-3 pt-2 text-[11.5px] text-dim">{tx(fend?.domestic?.note, lang)}</div>
        </Card>
        <Card title={t('proc.match.title')} sim bodyClass="!px-0 overflow-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <Th>{t('proc.col.po')}</Th>
                <Th align="end">{t('proc.match.po')}</Th>
                <Th align="end">{t('proc.match.grn')}</Th>
                <Th align="end">{t('proc.match.inv')}</Th>
                <Th>{t('common.status')}</Th>
              </tr>
            </thead>
            <tbody>
              {matches.map(({ r, grn, inv, ok }) => (
                <tr key={r.po.id}>
                  <Td className="tabular-nums">{r.po.id}</Td>
                  <Td align="end" className="tabular-nums">{fmtAed(r.po.valueAED, lang)}</Td>
                  <Td align="end" className="tabular-nums">{fmtAed(grn, lang)}</Td>
                  <Td align="end" className="tabular-nums">{fmtAed(inv, lang)}</Td>
                  <Td>{ok ? <Chip tone="good" dot>{t('proc.match.ok')}</Chip> : <Chip tone="warn" dot>{t('proc.match.diff')} {fmtAed(Math.abs(inv - r.po.valueAED), lang)}</Chip>}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}
