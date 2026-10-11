import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { ArrowRight, Sparkles } from 'lucide-react';
import { useApp } from '../../app/store';
import { useSnapshotMaybe } from '../../sim/useSim';
import type { Snapshot } from '../../sim/types';
import { fmtAed, fmtDate, fmtPct, type Lang } from '../../lib/fmt';
import { useWorkOrders } from '../assets/woStore';
import { useIntegration } from '../workorders/integrationStore';
import { openActions } from './actionStore';

type Tone = 'good' | 'warn' | 'bad' | 'info';
interface Item {
  tone: Tone;
  text: string;
}
const DOT: Record<Tone, string> = { good: 'var(--good)', warn: 'var(--warn)', bad: 'var(--bad)', info: 'var(--info)' };

function build(path: string, s: Snapshot, lang: Lang, extra: { openWo: number; connected: number; total: number; ticketsOpen: number }): Item[] {
  const L = (en: string, ar: string) => (lang === 'ar' ? ar : en);
  const k = s.kpis;
  const d = Math.round(s.dFinishVsBaseline);
  const crit = s.alarms.filter((a) => a.severity === 'crit').length;
  const warn = s.alarms.filter((a) => a.severity === 'warn').length;
  const atRisk = s.pos.filter((p) => p.stage < 6 && (p.risk === 'risk' || p.risk === 'late'));
  const exposed = s.pos.filter((p) => p.stage < 6 && p.chokepointExposed).length;
  const flagged = s.assets.filter((a) => a.report.health < 75);
  const worst = [...s.assets].sort((a, b) => a.report.health - b.report.health)[0];
  const hseN = s.alarms.filter((a) => a.source === 'hse').length;
  const finish: Item = { tone: d > 14 ? 'bad' : d > 1 ? 'warn' : 'good', text: d > 1 ? L(`Forecast finish ${d} days behind baseline`, `الإنجاز المتوقع متأخر ${d} يومًا عن الخط الأساسي`) : L('Forecast finish on baseline', 'الإنجاز المتوقع ضمن الخط الأساسي') };
  const alerts: Item = { tone: crit ? 'bad' : 'warn', text: L(`${crit} critical and ${warn} warning alerts to triage`, `${crit} تنبيه حرج و${warn} تحذير للفرز`) };
  const pos: Item = { tone: atRisk.length ? 'warn' : 'good', text: L(`${atRisk.length} purchase orders at risk (AED ${fmtAed(k.materialAtRiskAED, 'en')} exposed)`, `${atRisk.length} أمر شراء معرّض للخطر (${fmtAed(k.materialAtRiskAED, 'ar')} درهم)`) };
  const fleet: Item = { tone: flagged.length ? 'warn' : 'good', text: L(`${flagged.length} ${flagged.length === 1 ? 'asset' : 'assets'} flagged for predictive service${worst ? ` - ${worst.id} health ${Math.round(worst.report.health)}` : ''}`, `${flagged.length} أصول مُعلَّمة للصيانة التنبؤية${worst ? ` - ${worst.id} الصحة ${Math.round(worst.report.health)}` : ''}`) };
  const wind: Item = { tone: 'info', text: L('Wind gusts 11 m/s this afternoon - crane lifts near limit', 'رياح 11 م/ث بعد الظهر - الرفع قرب الحد') };
  const wo: Item = { tone: extra.openWo > 6 ? 'warn' : 'info', text: L(`${extra.openWo} open work orders, ${extra.ticketsOpen} tickets live in connected tools`, `${extra.openWo} أمر عمل مفتوح و${extra.ticketsOpen} تذكرة حية في الأدوات المتصلة`) };

  switch (path) {
    case '/twin':
      return [{ tone: worst && worst.report.health < 50 ? 'bad' : 'warn', text: worst ? L(`${worst.id} is the machine to watch - health ${Math.round(worst.report.health)}, ${fmtPct(worst.report.p14, 'en')} failure risk in 14 days`, `${worst.id} هي الآلة الأهم - الصحة ${Math.round(worst.report.health)} وخطر العطل ${fmtPct(worst.report.p14, 'ar')} خلال 14 يومًا`) : L('All machines healthy', 'كل الآلات سليمة') }, { tone: hseN ? 'warn' : 'good', text: L(`${hseN} open camera events in the exclusion zones`, `${hseN} أحداث كاميرا مفتوحة في مناطق الحظر`) }, wind, finish];
    case '/schedule':
      return [finish, { tone: k.spi < 0.95 ? 'warn' : 'good', text: L(`SPI ${k.spi.toFixed(2)} - ${s.criticalPath.length} activities on the critical path`, `SPI ${k.spi.toFixed(2)} - ${s.criticalPath.length} نشاطًا على المسار الحرج`) }, pos, wind];
    case '/whatif':
      return [{ tone: 'warn', text: L(`${exposed} open POs travel through chokepoint-exposed routes`, `${exposed} أمر شراء مفتوح يمر عبر مسارات معرّضة`) }, fleet, finish, { tone: 'info', text: L('Run the Hormuz closure scenario to see the cost and recovery options', 'شغّل سيناريو إغلاق هرمز لرؤية التكلفة وخيارات التعافي') }];
    case '/procurement':
      return [pos, { tone: exposed ? 'warn' : 'good', text: L(`${exposed} open POs on chokepoint-exposed routes`, `${exposed} أمر شراء على مسارات معرّضة`) }, { tone: 'info', text: L(`${s.pos.filter((p) => p.stage < 6).length} of ${s.pos.length} purchase orders still open`, `${s.pos.filter((p) => p.stage < 6).length} من ${s.pos.length} أمر شراء ما زالت مفتوحة`) }, finish];
    case '/assets':
      return [fleet, { tone: k.fleetAvailability < 0.9 ? 'warn' : 'good', text: L(`Fleet availability ${fmtPct(k.fleetAvailability, 'en')}`, `جاهزية الأسطول ${fmtPct(k.fleetAvailability, 'ar')}`) }, wo, wind];
    case '/cost':
      return [{ tone: k.cpi < 0.97 ? 'warn' : 'good', text: L(`CPI ${k.cpi.toFixed(2)} - EAC AED ${fmtAed(s.evm.eac, 'en')}`, `CPI ${k.cpi.toFixed(2)} - التكلفة المتوقعة ${fmtAed(s.evm.eac, 'ar')} درهم`) }, { tone: s.evm.vac < 0 ? 'warn' : 'good', text: L(`Variance at completion AED ${fmtAed(s.evm.vac, 'en')}`, `الفرق عند الإنجاز ${fmtAed(s.evm.vac, 'ar')} درهم`) }, { tone: s.evm.tcpi > 1.05 ? 'warn' : 'good', text: L(`TCPI ${s.evm.tcpi.toFixed(2)} needed to finish on budget`, `يلزم TCPI ${s.evm.tcpi.toFixed(2)} للإنجاز ضمن الميزانية`) }, pos];
    case '/hse':
      return [{ tone: 'good', text: L(`${k.daysSinceLti} days without a lost-time injury`, `${k.daysSinceLti} يومًا بدون إصابة مضيعة للوقت`) }, { tone: hseN ? 'warn' : 'good', text: L(`${hseN} camera events awaiting acknowledgement`, `${hseN} أحداث كاميرا بانتظار الإقرار`) }, { tone: 'info', text: L(`${k.manpower.toLocaleString('en')} people on site, LTIFR ${k.ltifr.toFixed(2)}`, `${k.manpower.toLocaleString('en')} شخص في الموقع، LTIFR ${k.ltifr.toFixed(2)}`) }, wind];
    case '/workorders':
      return [wo, { tone: extra.connected === extra.total ? 'good' : 'warn', text: L(`${extra.connected} of ${extra.total} ticketing tools connected`, `${extra.connected} من ${extra.total} أدوات تذاكر متصلة`) }, fleet, alerts];
    case '/docs':
    case '/reports':
    case '/admin':
    case '/models':
      return [alerts, finish, pos, fleet];
    default:
      return [{ tone: s.alarms.length ? 'warn' : 'good', text: L(`Portfolio pace: SPI ${k.spi.toFixed(2)}, CPI ${k.cpi.toFixed(2)}`, `وتيرة المحفظة: SPI ${k.spi.toFixed(2)} وCPI ${k.cpi.toFixed(2)}`) }, alerts, pos, fleet, finish, wind];
  }
}

/** one-line AI summary under the header on every page: what changed, what needs a decision, one click to the actions */
export function AdvisoryStrip() {
  const snap = useSnapshotMaybe();
  const lang = useApp((s) => s.lang);
  const { pathname } = useLocation();
  const wos = useWorkOrders((s) => s.list);
  const integrations = useIntegration((s) => s.integrations);
  const tickets = useIntegration((s) => s.tickets);
  const L = (en: string, ar: string) => (lang === 'ar' ? ar : en);
  const path = pathname === '/' ? '/' : '/' + pathname.split('/')[1];
  const items = useMemo(
    () =>
      snap
        ? build(path, snap, lang, { openWo: wos.filter((w) => w.status !== 'done').length, connected: integrations.filter((i) => i.status === 'connected').length, total: integrations.length || 5, ticketsOpen: tickets.filter((t) => t.status !== 'resolved').length })
        : [],
    [snap, path, lang, wos, integrations, tickets],
  );
  if (!snap) return null;
  const hh = Math.floor((snap.nowT % 1) * 24 + 8) % 24;
  const asAt = `${fmtDate(snap.nowT, lang, 'short')} ${String(hh).padStart(2, '0')}:42 GST`;
  return (
    <div className="shrink-0 px-4 pt-2.5" data-testid="ai-advisory">
      <div className="flex items-center gap-4 rounded-xl px-4 py-2.5 text-white" style={{ background: 'linear-gradient(90deg, #17141b 0%, #1d1822 100%)', border: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="shrink-0 leading-tight">
          <div className="flex items-center gap-1.5 text-[11px] font-bold tracking-[0.12em] uppercase" style={{ color: '#ff8fb0' }}>
            <Sparkles size={13} /> {L('AI Advisory', 'استشارة الذكاء الاصطناعي')}
          </div>
          <div className="text-[10.5px] text-white/50 num">{L('as at', 'حتى')} {asAt}</div>
        </div>
        <div className="w-px self-stretch bg-white/10" />
        <ul className="m-0 ps-0 list-none flex flex-wrap gap-x-5 gap-y-1 flex-1 min-w-0 text-[12px]">
          {items.map((it, i) => (
            <li key={i} className="inline-flex items-center gap-1.5 min-w-0">
              <span className="size-1.5 rounded-full shrink-0" style={{ background: DOT[it.tone] }} />
              <span className="text-white/85">{it.text}</span>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => openActions()}
          className="shrink-0 inline-flex items-center gap-1.5 h-8 rounded-lg px-3 text-[12px] font-semibold bg-white/10 hover:bg-white/20 transition-colors"
          data-testid="see-actions"
        >
          {L('See actions', 'عرض الإجراءات')} <ArrowRight size={13} className="flip-rtl" />
        </button>
      </div>
    </div>
  );
}
