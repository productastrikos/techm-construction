import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import { Bar, Btn, Card, Chip, N, SimChip, type Tone } from '../../design/ui';
import { fmtAed, fmtDate, fmtDays, fmtPct, type Lang } from '../../lib/fmt';
import { tx } from '../../lib/bi';
import { hash32 } from '../../engine/dates';
import { usePack, useSnapshot } from '../../sim/useSim';
import { prog, type SceneModel } from '../../three/sceneModel';

const riskTone: Record<string, Tone> = { ok: 'good', watch: 'warn', risk: 'warn', late: 'bad' };

/** deterministic, clearly-simulated sensor + document stubs for an element */
function stubs(id: string, kind: string, lang: Lang) {
  const h = hash32(id);
  const r = (n: number, a: number, b: number) => a + (((h >> n) & 255) / 255) * (b - a);
  const sensors: Array<[string, string]> =
    kind === 'quay' || kind === 'reclamation' || kind === 'revetment' || kind === 'breakwater'
      ? [
          [lang === 'ar' ? 'هبوط (ملم)' : 'Settlement (mm)', r(0, 2, 14).toFixed(1)],
          [lang === 'ar' ? 'ميلان (درجة)' : 'Tilt (deg)', r(8, 0.02, 0.22).toFixed(2)],
          [lang === 'ar' ? 'ضغط مسامي (kPa)' : 'Pore pressure (kPa)', r(16, 18, 64).toFixed(0)],
        ]
      : kind === 'building'
        ? [
            [lang === 'ar' ? 'مقاومة المكعبات (MPa)' : 'Cube strength (MPa)', r(0, 38, 52).toFixed(1)],
            [lang === 'ar' ? 'انحراف المسح (ملم)' : 'Survey deviation (mm)', r(8, 1, 9).toFixed(1)],
          ]
        : [[lang === 'ar' ? 'انحراف المسح (ملم)' : 'Survey deviation (mm)', r(0, 1, 11).toFixed(1)]];
  const prefix = id.replace(/[^A-Z]/g, '').slice(0, 3) || 'GEN';
  const docs = [`POC-${prefix}-DWG-${100 + (h % 80)} Rev ${'ABCD'[h % 4]}`, `ITP-${prefix}-${10 + ((h >> 5) % 40)} (${lang === 'ar' ? 'خطة فحص' : 'inspection plan'})`, `RFI-${200 + ((h >> 9) % 90)}`];
  return { sensors, docs };
}

export function TwinPanel({ model, selection, onClose }: { model: SceneModel; selection: string | null; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Lang;
  const pack = usePack();
  const snap = useSnapshot();
  const nav = useNavigate();
  const el = selection ? pack.elements.find((e) => e.id === selection) : undefined;
  const asset = selection ? pack.assets.find((a) => a.id === selection) : undefined;

  const detail = useMemo(() => {
    if (!el) return null;
    const st = model.states.get(el.id)!;
    const acts = el.activityIds.map((id) => pack.activities[snap.forecast.idx.get(id)!]);
    const budget = acts.reduce((s, a) => s + a.budget, 0);
    const earned = acts.reduce((s, a) => s + a.budget * prog(model, a.id), 0);
    const byDel = new Map(snap.pos.map((p) => [p.deliveryActivityId, p]));
    const pos = new Map<string, (typeof snap.pos)[number]>();
    for (const a of acts) for (const p of a.preds) {
      const po = byDel.get(p.id);
      if (po) pos.set(po.id, po);
    }
    const assets = pack.assets.filter((x) => x.linkedActivityIds.some((id) => el.activityIds.includes(id)));
    return { st, acts, budget, earned, pos: [...pos.values()], assets, ...stubs(el.id, el.kind, lang) };
  }, [el, model, pack, snap, lang]);

  if (!selection || (!el && !asset)) return <Summary model={model} />;

  if (asset) {
    const row = snap.assets.find((a) => a.id === asset.id)!;
    const r = row.report;
    const tone: Tone = r.status === 'good' ? 'good' : r.status === 'watch' ? 'warn' : 'bad';
    return (
      <Card title={tx(asset.name, lang)} subtitle={`${asset.id} - ${asset.model}`} actions={<Btn size="sm" variant="ghost" onClick={onClose}><X size={14} /></Btn>} sim="rule" data-testid="twin-panel">
        <div className="flex items-baseline gap-2">
          <span className="text-[30px] font-semibold num" style={{ color: `var(--${tone === 'good' ? 'good' : tone === 'warn' ? 'warn' : 'bad'})` }}>{Math.round(r.health)}</span>
          <span className="text-muted text-[12px]">{t('twin.asset.health')}</span>
          <Chip tone={tone} className="ms-auto">{t(`asset.status.${r.status}`)}</Chip>
        </div>
        <Bar value={r.health / 100} tone={tone} />
        <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[12.5px]">
          <span className="text-dim">{t('twin.asset.rul')}</span>
          <span className="num text-end">{r.rulDays === null ? t('twin.asset.none') : fmtDays(r.rulDays, lang)}</span>
          <span className="text-dim">{t('twin.asset.p14')}</span>
          <span className="num text-end">{fmtPct(r.p14, lang)}</span>
          <span className="text-dim">{t('twin.asset.model')}</span>
          <span className="text-end truncate">{asset.model}</span>
          <span className="text-dim">{t('twin.asset.hours')}</span>
          <span className="num text-end">{asset.hours.toLocaleString('en')}</span>
        </div>
        <div className="mt-3 flex gap-2">
          <Btn size="sm" variant="primary" onClick={() => nav(`/assets?asset=${asset.id}`)}>{t('twin.sel.openFleet')}</Btn>
        </div>
      </Card>
    );
  }

  const d = detail!;
  const st = d.st;
  const statusTone: Tone = st.status === 'done' ? 'good' : st.status === 'inprogress' ? 'info' : 'neutral';
  return (
    <Card title={tx(el!.name, lang)} subtitle={`${el!.id} - ${el!.kind}`} actions={<Btn size="sm" variant="ghost" onClick={onClose} aria-label={t('common.close')}><X size={14} /></Btn>} data-testid="twin-panel">
      <div data-testid="twin-panel-body" className="flex flex-col gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Chip tone={statusTone}>{t(`twin.sel.status.${st.status}`)}</Chip>
            {st.health !== 'neutral' && st.status !== 'done' && <Chip tone={st.health === 'late' ? 'bad' : st.health === 'watch' ? 'warn' : 'good'}>{st.health === 'ok' ? t('twin.legend.ok') : st.health === 'watch' ? t('twin.legend.watch') : t('twin.legend.late')}</Chip>}
            <span className="ms-auto text-[13px] font-semibold num">{fmtPct(st.pf, lang)}</span>
          </div>
          <Bar value={st.pf} tone={st.status === 'done' ? 'good' : 'accent'} label={t('twin.sel.progress')} />
          <div className="text-[11px] text-dim mt-0.5">{t('twin.sel.progress')} (plan {fmtPct(st.pb, lang)})</div>
        </div>
        <table className="w-full text-[12.5px] border-collapse">
          <thead>
            <tr className="text-dim text-[10.5px] uppercase tracking-wider">
              <th className="text-start font-semibold py-0.5" />
              <th className="text-start font-semibold">{t('twin.sel.start')}</th>
              <th className="text-start font-semibold">{t('twin.sel.finish')}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="text-muted py-0.5">{t('twin.sel.baseline')}</td>
              <td className="tabular-nums">{fmtDate(st.startB, lang)}</td>
              <td className="tabular-nums">{fmtDate(st.endB, lang)}</td>
            </tr>
            <tr>
              <td className="text-muted py-0.5">{t('twin.sel.forecast')}</td>
              <td className="tabular-nums">{fmtDate(st.startF, lang)}</td>
              <td className="tabular-nums">{fmtDate(st.endF, lang)}</td>
            </tr>
          </tbody>
        </table>
        <div className="flex items-center justify-between text-[12.5px]">
          <span className="text-muted">{t('twin.sel.variance')}</span>
          <span className="num font-semibold" style={{ color: st.varianceDays > 14 ? 'var(--bad)' : st.varianceDays > 1 ? 'var(--warn)' : 'var(--good)' }}>{fmtDays(st.varianceDays, lang, true)}</span>
        </div>
        <div className="rounded-lg border border-line p-2">
          <div className="text-[10.5px] uppercase tracking-wider text-dim mb-1">{t('twin.sel.cost')}</div>
          <div className="flex justify-between text-[12.5px]"><span className="text-muted">{t('twin.sel.budget')}</span><span className="num">AED {fmtAed(d.budget, lang)}</span></div>
          <div className="flex justify-between text-[12.5px]"><span className="text-muted">{t('twin.sel.earned')}</span><span className="num">AED {fmtAed(d.earned, lang)}</span></div>
        </div>
        <div>
          <div className="text-[10.5px] uppercase tracking-wider text-dim mb-1">{t('twin.sel.activities')} ({d.acts.length})</div>
          <div className="flex flex-col gap-0.5 max-h-[120px] overflow-auto">
            {d.acts.slice(0, 8).map((a) => {
              const i = snap.forecast.idx.get(a.id)!;
              return (
                <button key={a.id} type="button" onClick={() => nav(`/schedule?act=${a.id}`)} className="flex items-center gap-1.5 text-start text-[11.5px] hover:bg-surface-2 rounded px-1 py-0.5">
                  <span className="mono text-dim shrink-0">{a.id}</span>
                  <span className="truncate flex-1">{tx(a.name, lang)}</span>
                  {snap.forecast.critical[i] ? <Chip tone="bad" className="!text-[9.5px]">{t('twin.sel.critical')}</Chip> : null}
                </button>
              );
            })}
          </div>
        </div>
        <div>
          <div className="text-[10.5px] uppercase tracking-wider text-dim mb-1">{t('twin.sel.materials')}</div>
          {d.pos.length === 0 ? (
            <div className="text-[12px] text-dim">{t('twin.sel.noMaterials')}</div>
          ) : (
            d.pos.slice(0, 4).map((p) => (
              <div key={p.id} className="flex items-center gap-1.5 text-[12px] py-0.5">
                <span className="mono text-dim">{p.id}</span>
                <span className="truncate flex-1">{tx(pack.materials.find((m) => m.id === p.materialId)?.name, lang)}</span>
                <span className="num text-dim">{t('twin.sel.eta')} {fmtDate(p.etaT, lang, 'short')}</span>
                <Chip tone={p.stage === 6 ? 'good' : riskTone[p.risk]}>{p.stage === 6 ? 'OK' : `${Math.round(p.floatDays)} ${t('unit.d')}`}</Chip>
              </div>
            ))
          )}
        </div>
        {d.assets.length > 0 && (
          <div>
            <div className="text-[10.5px] uppercase tracking-wider text-dim mb-1">{t('twin.sel.equipment')}</div>
            <div className="flex flex-wrap gap-1">
              {d.assets.map((a) => {
                const r = snap.assets.find((x) => x.id === a.id)!.report;
                return (
                  <button key={a.id} type="button" onClick={() => nav(`/assets?asset=${a.id}`)}>
                    <Chip tone={r.status === 'good' ? 'good' : r.status === 'watch' ? 'warn' : 'bad'} dot>{a.id} {Math.round(r.health)}</Chip>
                  </button>
                );
              })}
            </div>
          </div>
        )}
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-[10.5px] uppercase tracking-wider text-dim">{t('twin.sel.sensors')}</span>
            <SimChip />
          </div>
          {d.sensors.map(([k, v]) => (
            <div key={k} className="flex justify-between text-[12px]"><span className="text-muted">{k}</span><N>{v}</N></div>
          ))}
        </div>
        <div>
          <div className="text-[10.5px] uppercase tracking-wider text-dim mb-1">{t('twin.sel.docs')}</div>
          {d.docs.map((x) => (
            <div key={x} className="text-[12px] text-muted mono" dir="ltr">{x}</div>
          ))}
        </div>
        <div className="flex gap-2">
          <Btn size="sm" onClick={() => nav(`/schedule?act=${el!.activityIds[0]}`)}>{t('twin.sel.openGantt')}</Btn>
          <Btn size="sm" variant="ghost" onClick={() => nav('/whatif')}>{t('twin.sel.whatIf')}</Btn>
        </div>
      </div>
    </Card>
  );
}

function Summary({ model }: { model: SceneModel }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Lang;
  const snap = useSnapshot();
  const els = [...model.states.values()].filter((s) => s.id !== 'SEABED');
  const late = els.filter((s) => s.health === 'late' || s.health === 'watch').length;
  const avgPf = els.reduce((s, e) => s + e.pf, 0) / els.length;
  const avgPb = els.reduce((s, e) => s + e.pb, 0) / els.length;
  return (
    <Card title={t('twin.sum.title')}>
      <div className="flex flex-col gap-2.5 text-[12.5px]">
        <div>
          <div className="flex justify-between"><span className="text-muted">{t('twin.sum.complete')}</span><span className="num font-semibold">{fmtPct(avgPf, lang)}</span></div>
          <Bar value={avgPf} />
          <div className="flex justify-between mt-1"><span className="text-muted">{t('twin.sum.planned')}</span><span className="num">{fmtPct(avgPb, lang)}</span></div>
          <Bar value={avgPb} tone="info" />
        </div>
        <div className="flex justify-between"><span className="text-muted">{t('twin.sum.finish')}</span><span className="num font-semibold">{fmtDate(snap.forecastFinish, lang)}</span></div>
        <div className="flex justify-between"><span className="text-muted">{t('twin.sum.critical')}</span><span className="num">{snap.criticalPath.length}</span></div>
        <div className="flex justify-between"><span className="text-muted">{t('twin.sum.late')}</span><span className="num">{late}</span></div>
        <p className="text-[12px] text-dim m-0 leading-relaxed">{t('twin.sel.none')}</p>
      </div>
    </Card>
  );
}
