import { useLocation, useNavigate } from 'react-router-dom';
import { Kpi } from '../../design/ui';
import { useApp } from '../../app/store';
import { useSnapshotMaybe } from '../../sim/useSim';
import { fmtAed, fmtDate, fmtDays, fmtPct } from '../../lib/fmt';
import { RFIS, NCRS, SNAGS } from '../docs/docsData';

/** compact top-of-page KPI strip for the pages whose own layout has no KPI tiles (Twin, Schedule, HSE, Docs, Reports); every tile opens the detail panel */
export function PageKpis() {
  const snap = useSnapshotMaybe();
  const lang = useApp((s) => s.lang);
  const nav = useNavigate();
  const { pathname } = useLocation();
  const L = (en: string, ar: string) => (lang === 'ar' ? ar : en);
  if (!snap) return null;
  const k = snap.kpis;
  const d = snap.dFinishVsBaseline;
  const worst = [...snap.assets].sort((a, b) => a.report.health - b.report.health)[0];
  const hseN = snap.alarms.filter((a) => a.source === 'hse').length;
  const finish = <Kpi compact key="finish" label={L('Forecast completion', 'الإنجاز المتوقع')} value={fmtDate(snap.forecastFinish, lang, 'short')} delta={fmtDays(d, lang, true)} deltaTone={d > 14 ? 'bad' : d > 1 ? 'warn' : 'good'} tone={d > 14 ? 'bad' : d > 1 ? 'warn' : 'good'} onClick={() => nav('/schedule')} />;
  const spi = <Kpi compact key="spi" label="SPI" value={k.spi.toFixed(2)} tone={k.spi < 0.95 ? 'warn' : 'good'} onClick={() => nav('/schedule')} />;
  const cpi = <Kpi compact key="cpi" label="CPI" value={k.cpi.toFixed(2)} tone={k.cpi < 0.97 ? 'warn' : 'good'} onClick={() => nav('/cost')} />;
  const crit = <Kpi compact key="crit" label={L('Critical activities', 'الأنشطة الحرجة')} value={snap.criticalPath.length} tone="info" onClick={() => nav('/schedule')} />;
  const done = <Kpi compact key="done" label={L('Complete', 'نسبة الإنجاز')} value={fmtPct(snap.evm.percentComplete, lang, 1)} tone="neutral" onClick={() => nav('/schedule')} />;
  const health = <Kpi compact key="health" label={L('Lowest asset health', 'أدنى صحة أصل')} value={worst ? Math.round(worst.report.health) : '-'} hint={worst?.id} tone={worst && worst.report.health < 60 ? 'warn' : 'good'} onClick={() => nav('/assets')} />;
  const sets: Record<string, React.ReactElement[]> = {
    '/twin': [done, finish, crit, health],
    '/schedule': [finish, spi, crit, <Kpi compact key="po" label={L('POs at risk', 'أوامر شراء معرضة')} value={k.poAtRisk} tone={k.poAtRisk > 3 ? 'warn' : 'good'} onClick={() => nav('/procurement')} />],
    '/hse': [
      <Kpi compact key="lti" label={L('Days without LTI', 'أيام بلا إصابة')} value={k.daysSinceLti} unit={L('days', 'يوم')} tone="good" />,
      <Kpi compact key="ltifr" label="LTIFR" value={k.ltifr.toFixed(2)} tone="good" />,
      <Kpi compact key="man" label={L('People on site', 'العمالة في الموقع')} value={k.manpower.toLocaleString('en')} tone="neutral" />,
      <Kpi compact key="ev" label={L('Open camera events', 'أحداث الكاميرات المفتوحة')} value={hseN} tone={hseN ? 'warn' : 'good'} />,
    ],
    '/docs': [
      <Kpi compact key="rfi" label={L('Open RFIs', 'استفسارات مفتوحة')} value={RFIS.filter((r) => r.status === 'open' || r.status === 'overdue').length} tone="warn" />,
      <Kpi compact key="od" label={L('Overdue RFIs', 'استفسارات متأخرة')} value={RFIS.filter((r) => r.status === 'overdue').length} tone={RFIS.some((r) => r.status === 'overdue') ? 'bad' : 'good'} />,
      <Kpi compact key="ncr" label={L('Open NCRs', 'تقارير عدم مطابقة مفتوحة')} value={NCRS.length} tone="warn" />,
      <Kpi compact key="snag" label={L('Open snags', 'ملاحظات مفتوحة')} value={SNAGS.length} tone="info" />,
    ],
    '/reports': [finish, spi, cpi, <Kpi compact key="eac" label="EAC" value={fmtAed(snap.evm.eac, lang)} unit="AED" tone={snap.evm.vac < 0 ? 'warn' : 'good'} onClick={() => nav('/cost')} />],
  };
  const items = sets[pathname === '/' ? '/' : '/' + pathname.split('/')[1]];
  if (!items) return null;
  return (
    <div className="shrink-0 px-4 pt-2.5" data-testid="page-kpis">
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">{items}</div>
    </div>
  );
}
