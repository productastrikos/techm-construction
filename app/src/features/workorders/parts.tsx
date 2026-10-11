import { Chip, type Tone } from '../../design/ui';
import { useApp } from '../../app/store';
import type { TicketStatus } from './integrationStore';

const STATUS: Record<TicketStatus, { tone: Tone; en: string; ar: string }> = {
  new: { tone: 'info', en: 'New', ar: 'جديدة' },
  assigned: { tone: 'warn', en: 'Assigned', ar: 'مسندة' },
  in_progress: { tone: 'violet', en: 'In progress', ar: 'قيد التنفيذ' },
  resolved: { tone: 'good', en: 'Resolved', ar: 'تم الحل' },
};

export function StatusChip({ status }: { status: TicketStatus }) {
  const lang = useApp((s) => s.lang);
  const s = STATUS[status] ?? STATUS.new;
  return (
    <Chip tone={s.tone} dot>
      {lang === 'ar' ? s.ar : s.en}
    </Chip>
  );
}

const PRIO: Record<string, { tone: Tone; en: string; ar: string }> = {
  low: { tone: 'neutral', en: 'Low', ar: 'منخفضة' },
  med: { tone: 'warn', en: 'Medium', ar: 'متوسطة' },
  high: { tone: 'bad', en: 'High', ar: 'عالية' },
  critical: { tone: 'bad', en: 'Critical', ar: 'حرجة' },
};
export function PrioChip({ priority }: { priority: string }) {
  const lang = useApp((s) => s.lang);
  const p = PRIO[priority] ?? PRIO.med;
  return <Chip tone={p.tone}>{lang === 'ar' ? p.ar : p.en}</Chip>;
}

export function relTime(iso: string, lang: 'en' | 'ar'): string {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return lang === 'ar' ? 'الآن' : 'just now';
  if (m < 60) return lang === 'ar' ? `منذ ${m} د` : `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 48) return lang === 'ar' ? `منذ ${h} س` : `${h} h ago`;
  return lang === 'ar' ? `منذ ${Math.round(h / 24)} ي` : `${Math.round(h / 24)} d ago`;
}

/** time left to the SLA due time (or how late it is) */
export function slaText(dueIso: string, lang: 'en' | 'ar'): string {
  const m = Math.round((new Date(dueIso).getTime() - Date.now()) / 60000);
  const a = Math.abs(m);
  const span = a >= 120 ? `${Math.round(a / 60)} h` : `${a} min`;
  if (m >= 0) return lang === 'ar' ? `متبقٍ ${span}` : `${span} left`;
  return lang === 'ar' ? `متأخر ${span}` : `${span} overdue`;
}
