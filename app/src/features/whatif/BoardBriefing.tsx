import { useTranslation } from 'react-i18next';
import { Printer, X } from 'lucide-react';
import { Btn } from '../../design/ui';
import { fmtAed, fmtDate, fmtDays, type Lang } from '../../lib/fmt';
import { tx } from '../../lib/bi';
import type { ScenarioResult } from '../../engine/scenario';
import type { ProjectPack } from '../../engine/types';

export interface BriefingData {
  lang: Lang;
  nowT: number;
  liveFinish: number;
  baselineFinish: number;
  combined: ScenarioResult;
  pkg: { result: ScenarioResult; parts: string[] } | null;
  drivers: Array<{ label: string; result: ScenarioResult }>;
  chartImage: string | null;
  pack: ProjectPack;
}

/** one-page board briefing: print it or "Save as PDF" from the browser (works offline, Arabic RTL included) */
export function BoardBriefing({ data, onClose }: { data: BriefingData; onClose: () => void }) {
  const { t } = useTranslation();
  const { lang, combined, pkg, drivers, pack } = data;
  const top = [...combined.changed].sort((a, b) => b.dEf - a.dEf).slice(0, 6);
  return (
    <div className="fixed inset-0 z-50 overflow-auto p-6 print-overlay" style={{ background: 'var(--scrim)' }} dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <div className="print-hide flex justify-end gap-2 max-w-[820px] mx-auto mb-2">
        <Btn variant="primary" icon={<Printer size={15} />} onClick={() => window.print()} data-testid="print-briefing">
          {t('wi.brief.print')}
        </Btn>
        <Btn variant="soft" icon={<X size={15} />} onClick={onClose}>
          {t('common.close')}
        </Btn>
      </div>
      <article className="print-sheet mx-auto bg-white text-[#0c2229] rounded-lg shadow-2xl p-9" style={{ width: 820, minHeight: 1100, fontSize: 13 }} data-testid="briefing-sheet">
        <header className="flex items-start justify-between border-b-2 border-[#0a8f6c] pb-3">
          <div>
            <div className="text-[11px] tracking-widest uppercase text-[#3f5f66]">{t('app.title')} - {t('app.byline')}</div>
            <h1 className="m-0 text-[24px] font-bold mt-1">{t('wi.brief.title')}</h1>
            <div className="text-[13px] text-[#3f5f66]">{tx(pack.config.name, lang)} - {tx(pack.config.subtitle, lang)}</div>
          </div>
          <div className="text-end text-[12px]">
            <div className="font-semibold">{fmtDate(data.nowT, lang, 'long')}</div>
          </div>
        </header>
        <section className="mt-4">
          <h2 className="text-[15px] m-0 mb-1.5">{t('wi.brief.headline')}</h2>
          <p className="m-0 leading-relaxed" style={{ fontSize: 14 }}>
            {lang === 'ar'
              ? `في سيناريو الإجهاد المركّب (نقطة الاختناق مغلق + قيود التقويم الموسمية + عطل رافعة) يتأخر الإنجاز ${fmtDays(combined.dFinish, lang)} إلى ${fmtDate(combined.finish, lang)} بتكلفة إضافية AED ${fmtAed(combined.cost.total, lang)}.${pkg ? ` تُقلّص حزمة الإجراءات الموصى بها التأخير إلى ${fmtDays(pkg.result.dFinish, lang)}.` : ''}`
              : `Under the combined stress test (Chokepoint closed + seasonal calendar constraints + crane failure) completion slips ${fmtDays(combined.dFinish, lang)} to ${fmtDate(combined.finish, lang)} at an added cost of AED ${fmtAed(combined.cost.total, lang)}.${pkg ? ` The recommended mitigation package limits the slip to ${fmtDays(pkg.result.dFinish, lang)}.` : ''}`}
          </p>
        </section>
        <section className="mt-4 grid grid-cols-3 gap-3 text-center">
          <Box label={t('wi.cmp.live')} value={fmtDate(data.liveFinish, lang)} sub={`${t('sched.baselineFinish')} ${fmtDate(data.baselineFinish, lang, 'short')}`} />
          <Box label={t('wi.stress.combined')} value={fmtDate(combined.finish, lang)} sub={`${fmtDays(combined.dFinish, lang, true)} / AED ${fmtAed(combined.cost.total, lang)}`} bad />
          <Box label={t('wi.stress.package')} value={pkg ? fmtDate(pkg.result.finish, lang) : '-'} sub={pkg ? `${fmtDays(pkg.result.dFinish, lang, true)} / AED ${fmtAed(pkg.result.cost.total, lang)}` : ''} good />
        </section>
        <section className="mt-4">
          <h2 className="text-[15px] m-0 mb-1.5">{t('wi.stress.tornado')}</h2>
          {data.chartImage ? <img src={data.chartImage} alt="" style={{ width: '100%' }} /> : null}
          <table className="w-full mt-2 border-collapse text-[12px]">
            <tbody>
              {drivers.map((d) => (
                <tr key={d.label} className="border-t border-[#d3e2e5]">
                  <td className="py-1">{d.label}</td>
                  <td className="text-end">{fmtDays(d.result.dFinish, lang, true)}</td>
                  <td className="text-end">AED {fmtAed(d.result.cost.total, lang)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <section className="mt-4">
          <h2 className="text-[15px] m-0 mb-1.5">{t('wi.brief.actions')}</h2>
          {pkg ? <ul className="m-0 ps-5 leading-relaxed">{pkg.parts.map((p) => <li key={p}>{p}</li>)}</ul> : null}
        </section>
        <section className="mt-4">
          <h2 className="text-[15px] m-0 mb-1.5">{t('wi.brief.drivers')}</h2>
          <ul className="m-0 ps-5 leading-relaxed text-[12px]">
            {top.map((c) => (
              <li key={c.id}>
                <span style={{ fontFamily: 'monospace' }}>{c.id}</span> {tx(pack.activities.find((a) => a.id === c.id)!.name, lang)}: {fmtDays(c.dEf, lang, true)}
              </li>
            ))}
          </ul>
        </section>
        <footer className="mt-6 pt-2 border-t border-[#d3e2e5] text-[10.5px] text-[#5b7a81]">{t('wi.brief.disclaimer')}</footer>
      </article>
    </div>
  );
}

function Box({ label, value, sub, bad, good }: { label: string; value: string; sub: string; bad?: boolean; good?: boolean }) {
  return (
    <div className="rounded-lg border p-3" style={{ borderColor: bad ? '#c93a3a' : good ? '#0a8f6c' : '#d3e2e5' }}>
      <div className="text-[11px] uppercase tracking-wider text-[#5b7a81]">{label}</div>
      <div className="text-[19px] font-bold" style={{ color: bad ? '#c93a3a' : good ? '#0a8f6c' : '#0c2229' }}>{value}</div>
      <div className="text-[11.5px] text-[#3f5f66]">{sub}</div>
    </div>
  );
}
