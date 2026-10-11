import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { CalendarRange, FileText, Search, Truck, Wrench, LayoutDashboard, Sparkles } from 'lucide-react';
import { SIA_URL } from '../lib/links';
import { tx } from '../lib/bi';
import type { Lang } from '../lib/fmt';
import { usePack, useSnapshotMaybe } from '../sim/useSim';
import { useProc } from '../features/procurement/model';
import { DRAWINGS, RFIS } from '../features/docs/docsData';
import { cx } from '../design/ui';

interface Item {
  id: string;
  group: 'action' | 'pages' | 'po' | 'asset' | 'activity' | 'doc';
  label: string;
  hint?: string;
  go: () => void;
}

const PAGES: Array<[string, string]> = [
  ['/', 'nav.portfolio'],
  ['/twin', 'nav.twin'],
  ['/schedule', 'nav.schedule'],
  ['/whatif', 'nav.whatif'],
  ['/procurement', 'nav.procurement'],
  ['/assets', 'nav.assets'],
  ['/cost', 'nav.cost'],
  ['/hse', 'nav.hse'],
  ['/docs', 'nav.docs'],
  ['/reports', 'nav.reports'],
  ['/workorders', 'nav.workorders'],
  ['/admin', 'nav.admin'],
];

const ICON = { action: <Sparkles size={15} />, pages: <LayoutDashboard size={15} />, po: <Truck size={15} />, asset: <Wrench size={15} />, activity: <CalendarRange size={15} />, doc: <FileText size={15} /> };

/** global search (Ctrl+K or the header button): pages, POs, equipment, schedule activities and documents */
export function CommandPalette() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Lang;
  const nav = useNavigate();
  const pack = usePack();
  const snap = useSnapshotMaybe();
  const selectPo = useProc((s) => s.select);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [idx, setIdx] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const on = () => setOpen(true);
    const key = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('mz:palette', on);
    window.addEventListener('keydown', key);
    return () => {
      window.removeEventListener('mz:palette', on);
      window.removeEventListener('keydown', key);
    };
  }, []);
  useEffect(() => {
    if (open) {
      setQ('');
      setIdx(0);
      setTimeout(() => input.current?.focus(), 10);
    }
  }, [open]);

  const close = () => setOpen(false);
  const all = useMemo<Item[]>(() => {
    const out: Item[] = [
      { id: 'ai', group: 'action', label: t('pal.ai'), hint: 'copilot assistant ai ask', go: () => window.dispatchEvent(new CustomEvent('mz:copilot')) },
      { id: 'ai-demo', group: 'action', label: t('pal.aiDemo'), hint: 'play demo ai', go: () => window.dispatchEvent(new CustomEvent('mz:copilot', { detail: { auto: true } })) },
      { id: 'sia', group: 'action', label: t('pal.sia'), hint: 'sia excel spreadsheet xlsx', go: () => void window.open(SIA_URL, '_blank', 'noopener,noreferrer') },
      ...PAGES.map(([to, key]) => ({ id: `p${to}`, group: 'pages' as const, label: t(key), go: () => nav(to) })),
    ];
    for (const p of pack.pos) {
      const m = pack.materials.find((x) => x.id === p.materialId);
      out.push({ id: p.id, group: 'po', label: `${p.id} - ${tx(m?.name, lang)}`, hint: `${tx(m?.name, 'en')} ${tx(m?.name, 'ar')}`, go: () => { selectPo(p.id); nav('/procurement'); } });
    }
    for (const a of pack.assets) out.push({ id: a.id, group: 'asset', label: `${a.id} - ${tx(a.name, lang)}`, hint: `${tx(a.name, 'en')} ${tx(a.name, 'ar')} ${a.model}`, go: () => nav(`/assets?asset=${a.id}`) });
    for (const a of pack.activities) if (a.kind !== 'milestone') out.push({ id: a.id, group: 'activity', label: `${tx(a.name, lang)}`, hint: `${a.id} ${tx(a.name, 'en')} ${tx(a.name, 'ar')}`, go: () => nav(`/schedule?act=${a.id}`) });
    for (const d of DRAWINGS) out.push({ id: d.no, group: 'doc', label: `${d.no} - ${tx(d.title, lang)}`, hint: `${tx(d.title, 'en')} ${tx(d.title, 'ar')}`, go: () => nav('/docs') });
    for (const r of RFIS) out.push({ id: r.id, group: 'doc', label: `${r.id} - ${tx(r.subject, lang)}`, hint: `${tx(r.subject, 'en')} ${tx(r.subject, 'ar')}`, go: () => nav('/docs') });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pack, lang, nav, t, selectPo, snap === null]);

  const results = useMemo(() => {
    const ql = q.trim().toLowerCase();
    if (!ql) return all.filter((i) => i.group === 'pages' || i.group === 'action');
    const hits = all.filter((i) => `${i.label} ${i.hint ?? ''} ${i.id}`.toLowerCase().includes(ql));
    const per: Record<string, number> = {};
    return hits.filter((h) => (per[h.group] = (per[h.group] ?? 0) + 1) <= 6).slice(0, 24);
  }, [q, all]);

  if (!open) return null;
  const choose = (i?: Item) => {
    if (!i) return;
    i.go();
    close();
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setIdx((i) => Math.min(results.length - 1, i + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setIdx((i) => Math.max(0, i - 1)); }
    else if (e.key === 'Enter') choose(results[idx]);
  };
  let lastGroup = '';
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] px-4" style={{ background: 'var(--scrim)' }} onClick={close} role="dialog" aria-modal="true" aria-label={t('hdr.search')}>
      <div className="w-full max-w-[640px] rounded-2xl border border-line-2 bg-surface shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 px-4 border-b border-line">
          <Search size={16} className="text-dim" />
          <input ref={input} value={q} onChange={(e) => { setQ(e.target.value); setIdx(0); }} onKeyDown={onKey} placeholder={t('pal.placeholder')} aria-label={t('pal.placeholder')} className="h-12 flex-1 bg-transparent outline-none text-[14px]" data-testid="palette-input" />
          <kbd className="text-[10.5px] text-dim border border-line rounded px-1.5 py-0.5">Esc</kbd>
        </div>
        <div className="max-h-[52vh] overflow-auto p-1.5" role="listbox">
          {results.length === 0 && <div className="px-3 py-6 text-center text-[13px] text-muted">{t('pal.empty')}</div>}
          {results.map((r, i) => {
            const head = r.group !== lastGroup ? ((lastGroup = r.group), <div key={`g-${r.group}-${i}`} className="px-3 pt-2 pb-1 text-[10.5px] uppercase tracking-wider text-dim font-semibold">{t(`pal.g.${r.group}`)}</div>) : null;
            return (
              <div key={`${r.group}-${r.id}`}>
                {head}
                <button type="button" role="option" aria-selected={i === idx} onMouseEnter={() => setIdx(i)} onClick={() => choose(r)} className={cx('w-full flex items-center gap-2.5 text-start rounded-lg px-3 py-2 text-[13px]', i === idx ? 'bg-surface-3' : 'hover:bg-surface-2')}>
                  <span style={{ color: 'var(--accent)' }}>{ICON[r.group]}</span>
                  <span className="truncate">{r.label}</span>
                </button>
              </div>
            );
          })}
        </div>
        <div className="px-4 py-1.5 border-t border-line text-[11px] text-dim">{t('pal.hint')}</div>
      </div>
    </div>
  );
}
