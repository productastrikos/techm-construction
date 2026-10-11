import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CalendarDays, Download, ExternalLink, FileSpreadsheet, FileText, Presentation, Printer, Sparkles } from 'lucide-react';
import { Btn, Card, Chip, PageHeader, cx, toneVar } from '../../design/ui';
import type { Lang } from '../../lib/fmt';
import { tx } from '../../lib/bi';
import { usePack, useSnapshot } from '../../sim/useSim';
import { useScenario } from '../whatif/scenarioStore';
import { buildReport, type ReportDoc, type ReportKind, type Section } from './model';
import { downloadPdf } from './pdf';
import { SIA_URL } from '../../lib/links';
import { AiPanel, AiSteps, Typed } from '../ai/kit';
import { executiveSummary } from '../ai/summary';

const KINDS: Array<{ id: ReportKind; icon: ReactElement }> = [
  { id: 'daily', icon: <CalendarDays size={18} /> },
  { id: 'weekly', icon: <FileText size={18} /> },
  { id: 'board', icon: <Presentation size={18} /> },
];

function Block({ s }: { s: Section }) {
  const tone = (t?: string) => (t === 'good' ? toneVar.good : t === 'warn' ? toneVar.warn : t === 'bad' ? toneVar.bad : t === 'info' ? toneVar.info : 'currentColor');
  return (
    <section className="mb-4 break-inside-avoid">
      <h3 className="m-0 mb-1.5 text-[13px] font-semibold pb-1 border-b-2" style={{ borderColor: 'var(--accent)', display: 'inline-block' }}>{s.title}</h3>
      {s.kind === 'text' && <p className="m-0 text-[12.5px] leading-relaxed">{s.text}</p>}
      {s.kind === 'bullets' && (
        <ul className="m-0 ps-0 list-none space-y-1">
          {s.items.map((it, i) => (
            <li key={i} className="flex gap-2 text-[12.5px] leading-snug"><span className="mt-[6px] size-1.5 rounded-full shrink-0" style={{ background: tone(it.tone) }} />{it.text}</li>
          ))}
        </ul>
      )}
      {s.kind === 'kpis' && (
        <div className="grid grid-cols-4 gap-2">
          {s.items.map((it, i) => (
            <div key={i} className="rounded-md border border-line px-2.5 py-1.5">
              <div className="text-[10.5px] text-dim">{it.label}</div>
              <div className="text-[15px] font-semibold num" style={{ color: tone(it.tone) }}>{it.value}</div>
            </div>
          ))}
        </div>
      )}
      {s.kind === 'table' && (
        <table className="w-full border-collapse text-[12px]">
          <thead><tr>{s.head.map((h, i) => <th key={i} className="text-start px-2 py-1 text-[10.5px] uppercase tracking-wide bg-surface-2">{h}</th>)}</tr></thead>
          <tbody>{s.rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className="px-2 py-1 border-t border-line">{c}</td>)}</tr>)}</tbody>
        </table>
      )}
    </section>
  );
}

export function Doc({ doc }: { doc: ReportDoc }) {
  const { t } = useTranslation();
  return (
    <div id="report-print" className="rounded-xl border border-line bg-surface overflow-hidden" data-testid="report-doc">
      <div className="px-6 py-4" style={{ background: 'linear-gradient(90deg, #08202a, #0d3a46)', color: 'white' }}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[18px] font-semibold">{doc.title}</div>
            <div className="text-[12px] opacity-80">{doc.subtitle}</div>
          </div>
          <div className="text-end text-[10.5px] opacity-80"><div>{doc.id}</div><div>{t('rep.simNote')}</div></div>
        </div>
      </div>
      <div className="px-6 py-4">
        {doc.sections.map((s, i) => <Block key={i} s={s} />)}
        <div className="text-[10.5px] text-dim border-t border-line pt-2">{t('rep.footer')}</div>
      </div>
    </div>
  );
}


/** every table of the report as one Excel-friendly CSV (UTF-8 BOM so Arabic opens correctly) */
function reportCsv(doc: ReportDoc): string {
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lines: string[] = [esc(doc.title), esc(doc.subtitle), ''];
  for (const s of doc.sections) {
    lines.push(esc(s.title));
    if (s.kind === 'table') {
      lines.push(s.head.map(esc).join(','));
      for (const r of s.rows) lines.push(r.map(esc).join(','));
    } else if (s.kind === 'kpis') {
      for (const it of s.items) lines.push([it.label, it.value].map(esc).join(','));
    } else if (s.kind === 'bullets') {
      for (const it of s.items) lines.push(esc(it.text));
    } else lines.push(esc(s.text));
    lines.push('');
  }
  const BOM = String.fromCharCode(0xfeff);
  return BOM + lines.join(String.fromCharCode(13, 10));
}
function downloadCsv(doc: ReportDoc, kind: string) {
  const blob = new Blob([reportCsv(doc)], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${kind}-report-${doc.id}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function SiaButton({ variant = 'soft', className }: { variant?: 'soft' | 'primary'; className?: string }) {
  const { t } = useTranslation();
  return (
    <a href={SIA_URL} target="_blank" rel="noopener noreferrer" data-testid="sia-link" className={className} title={t('rep.siaNote')}>
      <Btn variant={variant} icon={<FileSpreadsheet size={15} />} tabIndex={-1} className="pointer-events-none" aria-hidden>
        {t('rep.sia')}
        <ExternalLink size={12} />
      </Btn>
    </a>
  );
}

function AiSummary({ doc, kind, ctx }: { doc: ReportDoc; kind: ReportKind; ctx: Parameters<typeof executiveSummary>[1] }) {
  const { t } = useTranslation();
  const [run, setRun] = useState(0);
  const [phase, setPhase] = useState<'idle' | 'steps' | 'typing'>('idle');
  const sum = useMemo(() => executiveSummary(kind, ctx), [kind, ctx]);
  useEffect(() => setPhase('idle'), [kind, doc.id]);
  const start = () => {
    setRun((r) => r + 1);
    setPhase('steps');
  };
  return (
    <AiPanel
      title={t('rep.ai.title')}
      glow={phase === 'steps'}
      actions={
        <Btn size="sm" variant={phase === 'idle' ? 'primary' : 'soft'} icon={<Sparkles size={13} />} onClick={start} disabled={phase === 'steps'} data-testid="ai-summary-btn">
          {phase === 'idle' ? t('rep.ai.generate') : t('rep.ai.regenerate')}
        </Btn>
      }
    >
      {phase === 'idle' && <div className="text-[12px] text-dim">{t('rep.ai.hint')}</div>}
      {phase === 'steps' && <AiSteps steps={sum.steps} runKey={run} stepMs={450} compact onDone={() => setPhase('typing')} />}
      {phase === 'typing' && (
        <p className="m-0 text-[12.5px] leading-relaxed" data-testid="ai-summary-text">
          <Typed text={sum.text} cps={170} />
        </p>
      )}
    </AiPanel>
  );
}

export default function ReportsPage() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Lang;
  const pack = usePack();
  const snap = useSnapshot();
  const scen = useScenario((s) => s.active);
  const [params] = useSearchParams();
  const initial = params.get('kind');
  const [kind, setKind] = useState<ReportKind>(initial === 'board' || initial === 'weekly' ? initial : 'daily');
  const doc = useMemo(() => buildReport(kind, { pack, snap, lang, scenario: scen ? { label: scen.label, result: scen.result } : null }), [kind, pack, snap, lang, scen]);
  const pdfDoc = () => buildReport(kind, { pack, snap, lang: 'en', scenario: scen ? { label: scen.label, result: scen.result } : null });
  return (
    <div className="h-full flex flex-col min-h-0" data-testid="reports-page">
      <style>{`@media print { body * { visibility: hidden !important; } #report-print, #report-print * { visibility: visible !important; } #report-print { position: fixed; inset: 0; width: 100%; border: 0; background: white !important; color: #111 !important; } }`}</style>
      <PageHeader
        title={t('nav.reports')}
        subtitle={t('rep.subtitle')}
        sim="rule"
        actions={
          <div className="flex gap-2">
            <SiaButton />
            <Btn variant="soft" icon={<Printer size={15} />} onClick={() => window.print()}>{t('rep.print')}</Btn>
            <Btn variant="primary" icon={<Download size={15} />} onClick={() => downloadPdf(pdfDoc(), tx(pack.config.name, 'en'))}>{t('rep.pdf')}</Btn>
          </div>
        }
      />
      <div className="flex-1 min-h-0 overflow-auto px-5 pb-5 grid gap-3 xl:grid-cols-[280px_minmax(0,1fr)] content-start">
        <div className="space-y-3 self-start min-w-0">
        <Card title={t('rep.types')} bodyClass="space-y-2">
          {KINDS.map((k) => (
            <button key={k.id} type="button" onClick={() => setKind(k.id)} aria-pressed={kind === k.id} className={cx('w-full text-start rounded-lg border px-3 py-2.5 flex gap-2.5 items-start transition-colors', kind === k.id ? 'border-accent bg-surface-2' : 'border-line hover:bg-surface-2')}>
              <span className="mt-0.5" style={{ color: 'var(--accent)' }}>{k.icon}</span>
              <span>
                <span className="block text-[13px] font-semibold">{t(`rep.k.${k.id}`)}</span>
                <span className="block text-[11.5px] text-dim">{t(`rep.k.${k.id}d`)}</span>
              </span>
            </button>
          ))}
          <div className="pt-1 text-[11.5px] text-dim">
            {scen ? <Chip tone="warn" dot>{t('rep.withScenario')}: {scen.label}</Chip> : t('rep.noScenario')}
          </div>
          <div className="text-[11.5px] text-dim">{lang === 'ar' ? t('rep.pdfEnNote') : t('rep.pdfNote')}</div>
        </Card>
        <Card title={t('rep.siaTitle')} bodyClass="space-y-2.5">
          <p className="m-0 text-[12px] text-muted leading-relaxed">{t('rep.siaBody')}</p>
          <a href={SIA_URL} target="_blank" rel="noopener noreferrer" data-testid="sia-card-link" className="flex h-9 items-center justify-center gap-1.5 rounded-lg bg-accent text-accent-ink text-[13px] font-medium hover:brightness-110">
            <FileSpreadsheet size={15} /> {t('rep.siaTitle')} <ExternalLink size={12} />
          </a>
          <Btn className="w-full" icon={<Download size={14} />} onClick={() => downloadCsv(doc, kind)} data-testid="csv-btn">{t('rep.csv')}</Btn>
          <div className="text-[11px] text-dim">{t('rep.csvHint')} {t('rep.siaNote')}</div>
        </Card>
        </div>
        <div className="min-w-0 space-y-3">
          <AiSummary doc={doc} kind={kind} ctx={{ pack, snap, lang, scenario: scen ? { label: scen.label, result: scen.result } : null }} />
          <Doc doc={doc} />
        </div>
      </div>
    </div>
  );
}
