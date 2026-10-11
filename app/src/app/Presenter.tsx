import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Clapperboard, Flag, PlayCircle, RotateCcw, Sparkles, X } from 'lucide-react';
import { useApp, DEMO_NOW_T } from './store';
import { resetDemo } from './resetDemo';
import { useOverlay } from './overlay';
import { Btn, Card, Chip } from '../design/ui';
import { ymdToT } from '../engine/dates';
import { useScenario } from '../features/whatif/scenarioStore';
import { useWorkOrders } from '../features/assets/woStore';
import { useTwin } from '../features/twin/twinStore';
import { fmtDate, type Lang } from '../lib/fmt';

/** presenter checkpoints (data-date jumps) - illustrative demo dates */
export const CHECKPOINTS: Array<{ id: string; t: number; route: string; key: string }> = [
  { id: 'T0', t: DEMO_NOW_T, route: '/', key: 'pres.cp.t0' },
  { id: 'H1', t: ymdToT(2027, 1, 15) + 8 / 24, route: '/whatif/supply', key: 'pres.cp.h1' },
  { id: 'H3', t: ymdToT(2027, 1, 25) + 8.4 / 24, route: '/assets?asset=CC-02', key: 'pres.cp.h3' },
  { id: 'H2', t: ymdToT(2027, 2, 1) + 8 / 24, route: '/whatif/calendar', key: 'pres.cp.h2' },
];

/** hidden presenter panel (Ctrl+Shift+P): checkpoint jumps, reset, and scripted replays of the three hero flows */
export function PresenterPanel() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Lang;
  const open = useApp((s) => s.presenter);
  const setPresenter = useApp((s) => s.setPresenter);
  const setSimT = useApp((s) => s.setSimT);
  const simT = useApp((s) => s.simT);
  const nav = useNavigate();
  if (!open) return null;

  const reset = () => {
    resetDemo();
    nav('/');
  };
  const jump = (c: (typeof CHECKPOINTS)[number]) => {
    setSimT(c.t);
    nav(c.route);
  };
  const replay = (flow: 'h1' | 'h2' | 'h3') => {
    useScenario.getState().clear();
    useOverlay.getState().clear();
    const cp = CHECKPOINTS.find((c) => c.id === flow.toUpperCase())!;
    setSimT(cp.t);
    nav(flow === 'h1' ? '/whatif/supply' : flow === 'h2' ? '/whatif/calendar' : '/whatif/equipment');
    setTimeout(() => window.dispatchEvent(new CustomEvent('mz:replay', { detail: { flow } })), 1400);
  };

  return (
    <div className="fixed bottom-3 end-3 z-50 w-[300px]" data-testid="presenter-panel">
      <Card
        title={
          <span className="flex items-center gap-1.5">
            <Clapperboard size={14} /> {t('pres.title')}
          </span>
        }
        subtitle={fmtDate(simT, lang, 'long')}
        actions={
          <Btn size="sm" variant="ghost" onClick={() => setPresenter(false)} aria-label={t('common.close')}>
            <X size={14} />
          </Btn>
        }
        className="shadow-2xl border-line-2"
      >
        <div className="flex flex-col gap-2">
          <div className="text-[10.5px] uppercase tracking-wider text-dim">{t('pres.checkpoints')}</div>
          <div className="grid grid-cols-2 gap-1.5">
            {CHECKPOINTS.map((c) => (
              <Btn key={c.id} size="sm" onClick={() => jump(c)} icon={<Flag size={13} />} data-testid={`cp-${c.id}`}>
                {t(c.key)}
              </Btn>
            ))}
          </div>
          <div className="text-[10.5px] uppercase tracking-wider text-dim mt-1">{t('pres.replays')}</div>
          <div className="grid grid-cols-3 gap-1.5">
            {(['h1', 'h2', 'h3'] as const).map((f) => (
              <Btn key={f} size="sm" variant="soft" onClick={() => replay(f)} icon={<PlayCircle size={13} />} data-testid={`replay-${f}`}>
                {f.toUpperCase()}
              </Btn>
            ))}
          </div>
          <Btn size="sm" variant="primary" icon={<Sparkles size={13} />} onClick={() => window.dispatchEvent(new CustomEvent('mz:copilot', { detail: { auto: true } }))} data-testid="play-ai">
            {t('ai.play')}
          </Btn>
          <Btn size="sm" variant="outline" icon={<RotateCcw size={13} />} onClick={reset} data-testid="reset-demo">
            {t('pres.reset')}
          </Btn>
          <div className="flex gap-1.5 flex-wrap">
            <Chip tone="neutral">Ctrl+Shift+P</Chip>
          </div>
        </div>
      </Card>
    </div>
  );
}
