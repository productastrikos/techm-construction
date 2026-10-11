import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { cx } from './ui';

/** right-hand slide-in panel (left in RTL) used by the KPI detail and the AI action views */
export function Drawer({ open, onClose, title, subtitle, children, footer, width = 460, testId }: { open: boolean; onClose: () => void; title: ReactNode; subtitle?: ReactNode; children: ReactNode; footer?: ReactNode; width?: number; testId?: string }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  return (
    <div className={cx('fixed inset-0 z-[60]', open ? 'pointer-events-auto' : 'pointer-events-none')} aria-hidden={!open}>
      <div className={cx('absolute inset-0 transition-opacity duration-200', open ? 'opacity-100' : 'opacity-0')} style={{ background: 'rgba(10,10,14,0.38)' }} onClick={onClose} />
      <aside
        role="dialog"
        aria-modal="true"
        data-testid={testId}
        className={cx('absolute top-0 bottom-0 end-0 max-w-full flex flex-col border-s border-line bg-surface shadow-2xl transition-transform duration-200', open ? 'translate-x-0' : 'translate-x-full rtl:-translate-x-full')}
        style={{ width }}
      >
        <header className="flex items-start gap-3 px-5 pt-4 pb-3 border-b border-line">
          <div className="min-w-0 flex-1">
            <h2 className="m-0 text-[15px] font-semibold tracking-tight truncate">{title}</h2>
            {subtitle && <div className="text-[12px] text-dim truncate">{subtitle}</div>}
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-md text-dim hover:text-ink hover:bg-surface-2" aria-label="Close">
            <X size={17} />
          </button>
        </header>
        <div className="flex-1 min-h-0 overflow-auto px-5 py-4">{open && children}</div>
        {footer && <footer className="px-5 py-3 border-t border-line flex flex-wrap items-center gap-2">{footer}</footer>}
      </aside>
    </div>
  );
}
