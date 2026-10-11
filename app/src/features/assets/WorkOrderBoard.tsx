import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Btn, Card, Chip, type Tone } from '../../design/ui';
import { fmtAed, fmtDate, type Lang } from '../../lib/fmt';
import { tx } from '../../lib/bi';
import { useWorkOrders, type WoStatus, type WorkOrder } from './woStore';
import { useIntegration } from '../workorders/integrationStore';
import { StatusChip } from '../workorders/parts';

const COLS: WoStatus[] = ['open', 'planned', 'inprogress', 'done'];
const NEXT: Record<WoStatus, WoStatus | null> = { open: 'planned', planned: 'inprogress', inprogress: 'done', done: null };
const prioTone: Record<string, Tone> = { low: 'neutral', med: 'warn', high: 'bad' };

/** CMMS work-order kanban: drag cards between columns (or use the arrow). Predictive work orders also protect a window on the Gantt. */
export function WorkOrderBoard() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Lang;
  const nav = useNavigate();
  const { list, move } = useWorkOrders();
  const [drag, setDrag] = useState<string | null>(null);
  return (
    <div className="grid grid-cols-4 gap-3 max-[1200px]:grid-cols-2" data-testid="wo-board">
      {COLS.map((c) => {
        const items = list.filter((w) => w.status === c);
        return (
          <div key={c} onDragOver={(e) => e.preventDefault()} onDrop={() => drag && (move(drag, c), setDrag(null))} data-testid={`wo-col-${c}`}>
            <Card title={`${t(`asset.wo.${c}`)} (${items.length})`} sim className="min-h-[300px]" bodyClass="flex flex-col gap-2">
              {items.length === 0 && <div className="text-[12px] text-dim">-</div>}
              {items.map((w) => (
                <Card2 key={w.id} w={w} lang={lang} onDrag={setDrag} onAdvance={() => NEXT[w.status] && move(w.id, NEXT[w.status]!)} onGantt={() => nav('/schedule')} t={t} />
              ))}
            </Card>
          </div>
        );
      })}
    </div>
  );
}

function Card2({ w, lang, onDrag, onAdvance, onGantt, t }: { w: WorkOrder; lang: Lang; onDrag: (id: string | null) => void; onAdvance: () => void; onGantt: () => void; t: (k: string) => string }) {
  const ticket = useIntegration((s) => s.tickets.find((x) => x.woId === w.id));
  return (
    <div draggable onDragStart={() => onDrag(w.id)} className="rounded-lg border border-line bg-surface-2 p-2 flex flex-col gap-1 cursor-grab" data-testid={`wo-${w.id}`}>
      <div className="flex items-center gap-1.5">
        <span className="mono text-[10.5px] text-dim">{w.id}</span>
        <Chip tone="info">{w.kind}</Chip>
        <Chip tone={prioTone[w.priority]} className="ms-auto">{t(`asset.prio.${w.priority}`)}</Chip>
      </div>
      <div className="text-[12.5px] leading-snug" dir="auto">{tx(w.title, lang)}</div>
      <div className="flex items-center gap-1.5 text-[11px] text-dim flex-wrap">
        <span className="mono">{w.assetId}</span>
        {w.fromT !== undefined && <span className="num">{fmtDate(w.fromT, lang, 'short')}{w.toT !== undefined && w.toT - w.fromT > 0.9 ? ` - ${fmtDate(w.toT, lang, 'short')}` : ''}</span>}
        {w.costAED !== undefined && <span className="num">AED {fmtAed(w.costAED, lang)}</span>}
        <Chip tone={w.source === 'prediction' ? 'violet' : w.source === 'cctv' ? 'warn' : 'neutral'}>{t(`asset.src.${w.source}`)}</Chip>
      </div>
      {ticket && (
        <div className="flex items-center gap-1.5 text-[11px] flex-wrap" data-testid={`wo-ticket-${w.id}`}>
          <Chip tone="neutral">{ticket.externalRef}</Chip>
          <StatusChip status={ticket.status} />
        </div>
      )}
      <div className="flex gap-1.5 mt-0.5">
        {w.fromT !== undefined && (
          <Btn size="sm" variant="ghost" onClick={onGantt}>{t('asset.wo.onGantt')}</Btn>
        )}
        {NEXT[w.status] && (
          <Btn size="sm" variant="soft" className="ms-auto" onClick={onAdvance} aria-label={t('asset.wo.advance')}>
            <ArrowRight size={13} className="flip-rtl" />
          </Btn>
        )}
      </div>
    </div>
  );
}
