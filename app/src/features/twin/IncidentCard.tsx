import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowUpRight, CheckCircle2, Sparkles, UserCheck, X } from 'lucide-react';
import { usePack, useSnapshot } from '../../sim/useSim';
import { useApp } from '../../app/store';
import { fmtDate, fmtPct, type Lang } from '../../lib/fmt';
import { bi, tx } from '../../lib/bi';
import type { Asset } from '../../engine/types';
import type { AssetRow } from '../../sim/types';
import { useWorkOrders } from '../assets/woStore';
import { Typed } from '../ai/kit';

export interface Incident {
  asset: Asset;
  row: AssetRow;
  /** world position of the machine (metres) */
  pos: [number, number, number];
}

/** the worst-health machine that is drawn in the 3D scene: the demo's "what just happened" area */
export function useIncident(): Incident | null {
  const pack = usePack();
  const snap = useSnapshot();
  return useMemo(() => {
    let best: Incident | null = null;
    for (const row of snap.assets) {
      if (row.report.status === 'good') continue;
      const vis = pack.fleetVis[row.id];
      const asset = pack.assets.find((a) => a.id === row.id);
      if (!vis || !asset) continue;
      const m = vis.motion;
      const p: [number, number, number] = m.kind === 'static' ? m.pos : m.kind === 'loop' ? [m.pts[0][0], m.y, m.pts[0][1]] : [m.a[0], m.y, m.a[1]];
      if (!best || row.report.health < best.row.report.health) best = { asset, row, pos: p };
    }
    return best;
  }, [pack, snap]);
}

/** floating incident card anchored on the machine in the 3D view: what happened, AI insight, one-click ticket */
export function IncidentCard({ incident, onClose }: { incident: Incident; onClose: () => void }) {
  const { i18n } = useTranslation();
  const lang = i18n.language as Lang;
  const L = (en: string, ar: string) => (lang === 'ar' ? ar : en);
  const nav = useNavigate();
  const simT = useApp((s) => s.simT);
  const { asset, row } = incident;
  const r = row.report;
  const wos = useWorkOrders((s) => s.list);
  const create = useWorkOrders((s) => s.create);
  const existing = wos.find((w) => w.assetId === asset.id && w.source === 'prediction' && w.status !== 'done' && w.kind === 'PdM');
  const [created, setCreated] = useState<string | null>(null);
  const [assigned, setAssigned] = useState(false);
  const woId = created ?? existing?.id ?? null;

  const ch = asset.channels.find((c) => c.id === (r.degradingChannel ?? r.explanation[0]?.channelId));
  const chName = tx(ch?.name, lang) || L('sensor channel', 'قناة الاستشعار');
  const top = r.explanation[0];
  const ratio = top && top.expected > 0 ? top.value / top.expected : null;
  const rul = r.rulDays != null ? Math.round(r.rulDays) : null;
  const sev = r.status === 'critical' ? L('CRITICAL', 'حرج') : r.status === 'warning' ? L('WARNING', 'تحذير') : L('WATCH', 'مراقبة');

  const what = L(
    `${chName} on ${tx(asset.name, lang)} is ${ratio ? `${ratio.toFixed(1)}x its expected level` : 'trending out of its normal band'}. Health ${Math.round(r.health)}/100, ${fmtPct(r.p14, lang)} chance of failure within 14 days.`,
    `${chName} في ${tx(asset.name, lang)} ${ratio ? `يبلغ ${ratio.toFixed(1)} ضعف المستوى المتوقع` : 'يخرج عن نطاقه الطبيعي'}. الصحة ${Math.round(r.health)}/100 واحتمال العطل خلال 14 يومًا ${fmtPct(r.p14, lang)}.`,
  );
  const insight = L(
    `Bearing-wear signature, ${rul != null ? `about ${rul} days of life left` : 'degrading trend'}. A planned ${asset.serviceDays}-day stop now avoids a ${asset.repairDays}-day in-service repair and idles the casting yard. Spare SP-1101 has a 21-day lead time: order today.`,
    `نمط تآكل في المحمل، ${rul != null ? `العمر المتبقي نحو ${rul} يومًا` : 'اتجاه تدهور'}. التوقف المخطط ${asset.serviceDays} يوم الآن يتجنب إصلاحًا ${asset.repairDays} يومًا أثناء التشغيل وتعطل ساحة الصب. مدة توريد SP-1101 ‏21 يومًا: اطلبها اليوم.`,
  );

  useEffect(() => setAssigned(false), [woId]);

  const makeTicket = () => {
    const wo = create({
      assetId: asset.id,
      title: bi(`${asset.id}: inspect and replace ${chName.toLowerCase()} components (AI predicted)`, `${asset.id}: فحص واستبدال مكونات ${chName} (تنبؤ ذكي)`),
      kind: 'PdM',
      status: 'open',
      priority: 'high',
      createdT: simT,
      source: 'prediction',
      note: bi('Raised from the Digital Twin incident card.', 'أُنشئ من بطاقة الحادث في التوأم الرقمي.'),
    });
    setCreated(wo.id);
  };

  return (
    <div className="relative" style={{ pointerEvents: 'none' }} data-testid="incident-card">
      {/* beacon on the machine */}
      <span className="absolute -translate-x-1/2 -translate-y-1/2 grid place-items-center" style={{ width: 28, height: 28 }}>
        <span className="absolute inset-0 rounded-full animate-ping" style={{ background: 'color-mix(in srgb, var(--bad) 55%, transparent)' }} />
        <span className="relative rounded-full border-2 border-white" style={{ width: 13, height: 13, background: 'var(--bad)' }} />
      </span>
      {/* leader line */}
      <svg className="absolute" style={{ left: 0, top: 0, width: 40, height: 4, overflow: 'visible' }} aria-hidden>
        <line x1="10" y1="0" x2="42" y2="0" stroke="var(--violet)" strokeWidth="2" />
      </svg>
      <div
        className="absolute rounded-xl border shadow-2xl backdrop-blur-md text-ink"
        style={{ left: 42, top: -150, width: 372, pointerEvents: 'auto', background: 'color-mix(in srgb, var(--surface) 94%, transparent)', borderColor: 'color-mix(in srgb, var(--violet) 55%, var(--line))' }}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-3 pt-2.5">
          <AlertTriangle size={15} style={{ color: 'var(--bad)' }} />
          <span className="text-[11px] font-bold tracking-wider" style={{ color: 'var(--bad)' }}>
            {L('LIVE INCIDENT', 'حادث مباشر')} · {sev}
          </span>
          <span className="ms-auto text-[11px] text-dim num">{fmtDate(simT, lang, 'short')}</span>
          <button type="button" className="text-dim hover:text-ink" onClick={onClose} aria-label="close">
            <X size={14} />
          </button>
        </div>
        <div className="px-3 pt-1">
          <div className="text-[16px] font-semibold leading-tight">{tx(asset.name, lang)}</div>
          <div className="text-[12px] text-dim">{tx(asset.location, lang)} · {asset.id}</div>
        </div>
        <p className="px-3 pt-2 text-[13px] leading-snug text-muted m-0">{what}</p>

        <div className="mx-3 mt-2.5 rounded-lg border p-2.5" style={{ borderColor: 'color-mix(in srgb, var(--violet) 50%, var(--line))', background: 'color-mix(in srgb, var(--violet) 10%, var(--surface))' }}>
          <div className="flex items-center gap-1.5 mb-1">
            <Sparkles size={15} style={{ color: 'var(--violet)' }} />
            <span className="text-[12px] font-bold tracking-wider uppercase" style={{ color: 'var(--violet)' }}>
              {L('AI insight', 'رؤية الذكاء الاصطناعي')}
            </span>
          </div>
          <div className="text-[14.5px] leading-snug font-medium" style={{ color: 'color-mix(in srgb, var(--violet) 70%, var(--text))' }}>
            <Typed text={insight} cps={160} />
          </div>
        </div>

        <div className="p-3 pt-2.5">
          {!woId ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="h-9 px-3.5 rounded-lg text-[13px] font-semibold inline-flex items-center gap-1.5 hover:brightness-110"
                style={{ background: 'var(--violet)', color: 'var(--violet-ink)' }}
                onClick={makeTicket}
                data-testid="incident-ticket"
              >
                <Sparkles size={14} />
                {L('Create ticket', 'إنشاء تذكرة')}
              </button>
              <button type="button" className="h-9 px-3 rounded-lg text-[13px] font-medium border border-line-2 hover:bg-surface-2" onClick={() => { makeTicket(); setAssigned(true); }}>
                {L('Act & Assign', 'تصرّف وأسند')}
              </button>
              <button type="button" className="ms-auto text-[12px] text-muted hover:text-ink inline-flex items-center gap-0.5" onClick={() => nav(`/assets?asset=${asset.id}`)}>
                {L('Details', 'التفاصيل')} <ArrowUpRight size={13} className="flip-rtl" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 flex-wrap" data-testid="incident-created">
              <CheckCircle2 size={17} style={{ color: 'var(--good)' }} />
              <div className="text-[13px]">
                <span className="font-semibold">{woId}</span> {L('is open', 'مفتوحة')}
                {assigned && (
                  <span className="text-muted">
                    {' '}
                    · <UserCheck size={12} className="inline -mt-0.5" /> {L('assigned to Maintenance Planner', 'أُسندت إلى مخطط الصيانة')}
                  </span>
                )}
              </div>
              {!assigned && (
                <button type="button" className="h-8 px-2.5 rounded-lg text-[12px] font-medium border border-line-2 hover:bg-surface-2" onClick={() => setAssigned(true)}>
                  {L('Assign', 'إسناد')}
                </button>
              )}
              <button type="button" className="ms-auto text-[12px] hover:underline inline-flex items-center gap-0.5" style={{ color: 'var(--violet)' }} onClick={() => nav('/assets?tab=wo')}>
                {L('Open work orders', 'فتح أوامر العمل')} <ArrowUpRight size={13} className="flip-rtl" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
