import { Component, Suspense, useEffect, useRef, type ReactNode } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  LayoutDashboard,
  Box,
  CalendarRange,
  FlaskConical,
  Truck,
  Wrench,
  Wallet,
  HardHat,
  FileText,
  Printer,
  Plug,
  ClipboardList,
  Sun,
  Moon,
  Play,
  Pause,
  RotateCcw,
  ChevronsLeft,
  ChevronsRight,
  Type,
  Presentation,
  Search,
  Sparkles,
} from 'lucide-react';
import { useApp, ROLES, type Role } from './store';
import { applyLangToDocument } from '../i18n';
import { Btn, Chip, cx, Seg, Select, SimChip } from '../design/ui';
import { fmtDate } from '../lib/fmt';
import { PresenterPanel } from './Presenter';
import { CommandPalette } from './CommandPalette';
import { CreditsDialog } from './Credits';
import { Copilot, openCopilot } from '../features/ai/Copilot';
import { resetDemo } from './resetDemo';
import { useDataReady, usePack } from '../sim/useSim';
import { tx } from '../lib/bi';
import { AdvisoryStrip } from '../features/ai/Advisory';
import { PageKpis } from '../features/kpi/PageKpis';
import { ActionPanel } from '../features/ai/ActionPanel';
import { KpiPanel } from '../features/kpi/KpiPanel';
import { useIntegration } from '../features/workorders/integrationStore';

const NAV: Array<{ to: string; key: string; icon: ReactNode; roles?: Role[] }> = [
  { to: '/', key: 'nav.portfolio', icon: <LayoutDashboard size={18} /> },
  { to: '/twin', key: 'nav.twin', icon: <Box size={18} /> },
  { to: '/schedule', key: 'nav.schedule', icon: <CalendarRange size={18} /> },
  { to: '/whatif', key: 'nav.whatif', icon: <FlaskConical size={18} /> },
  { to: '/procurement', key: 'nav.procurement', icon: <Truck size={18} /> },
  { to: '/assets', key: 'nav.assets', icon: <Wrench size={18} /> },
  { to: '/workorders', key: 'nav.workorders', icon: <ClipboardList size={18} /> },
  { to: '/cost', key: 'nav.cost', icon: <Wallet size={18} /> },
  { to: '/hse', key: 'nav.hse', icon: <HardHat size={18} /> },
  { to: '/docs', key: 'nav.docs', icon: <FileText size={18} /> },
  { to: '/reports', key: 'nav.reports', icon: <Printer size={18} /> },
  { to: '/admin', key: 'nav.admin', icon: <Plug size={18} /> },
];

/** which nav entries each role cares about most (others stay visible but are dimmed) */
const ROLE_FOCUS: Record<Role, string[]> = {
  cxo: ['/', '/whatif', '/cost', '/reports'],
  pm: ['/', '/twin', '/schedule', '/whatif', '/reports'],
  procurement: ['/', '/procurement', '/whatif', '/schedule'],
  hse: ['/', '/hse', '/twin', '/docs'],
  asset: ['/', '/assets', '/workorders', '/whatif', '/twin'],
  finance: ['/', '/cost', '/procurement', '/reports'],
};

class Boundary extends Component<{ children: ReactNode; label: string; retry: string }, { err: Error | null }> {
  state = { err: null as Error | null };
  static getDerivedStateFromError(err: Error) {
    return { err };
  }
  componentDidCatch(err: Error) {
    console.error('[screen error]', err);
  }
  render() {
    if (!this.state.err) return this.props.children;
    return (
      <div className="m-6 rounded-xl border border-bad/50 bg-surface p-5 max-w-xl">
        <div className="font-semibold text-bad mb-1">{this.props.label}</div>
        <pre className="text-[11px] text-dim whitespace-pre-wrap">{String(this.state.err.message)}</pre>
        <Btn className="mt-3" onClick={() => this.setState({ err: null })}>
          {this.props.retry}
        </Btn>
      </div>
    );
  }
}

function Sidebar() {
  const { t } = useTranslation();
  const collapsed = useApp((s) => s.navCollapsed);
  const setCollapsed = useApp((s) => s.setNavCollapsed);
  const role = useApp((s) => s.role);
  return (
    <aside className={cx('shrink-0 border-e border-line bg-surface flex flex-col transition-[width] duration-200', collapsed ? 'w-[64px]' : 'w-[212px]')}>
      <div className={cx('flex items-center h-16 border-b border-line', collapsed ? 'justify-center px-0' : 'px-3.5')}>
        <span className="inline-flex items-center rounded-md px-2 py-1.5" style={{ background: 'var(--logo-tile)' }}>
          {collapsed ? (
            <img src="brand/tm-mark.png" alt="Tech Mahindra" className="h-7 w-auto" />
          ) : (
            <img src="brand/tm-logo.png" alt="Tech Mahindra" className="h-[34px] w-auto" />
          )}
        </span>
      </div>
      <nav className="flex-1 overflow-y-auto py-2 px-2 flex flex-col gap-0.5" aria-label="Main">
        {NAV.map((n) => {
          const focus = ROLE_FOCUS[role].includes(n.to);
          return (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === '/'}
              title={collapsed ? t(n.key) : undefined}
              className={({ isActive }) =>
                cx(
                  'flex items-center gap-2.5 rounded-lg h-10 text-[12.5px] font-medium uppercase tracking-[0.04em] transition-colors border-s-2',
                  collapsed ? 'justify-center px-0' : 'px-2.5',
                  isActive ? 'bg-[color-mix(in_srgb,var(--accent)_11%,transparent)] text-accent border-accent' : focus ? 'text-ink border-transparent hover:bg-surface-2' : 'text-dim border-transparent hover:bg-surface-2 hover:text-ink',
                )
              }
            >
              {n.icon}
              {!collapsed && <span className="truncate">{t(n.key)}</span>}
            </NavLink>
          );
        })}
      </nav>
      {!collapsed && (
        <>
          <button type="button" onClick={() => window.dispatchEvent(new CustomEvent('mz:credits'))} className="h-8 text-[11px] text-dim hover:text-ink border-t border-line">
            {t('credits.link')}
          </button>
          <div className="flex items-center justify-center gap-2 h-12 border-t border-line text-[11px] text-dim" title={t('app.poweredBy')}>
            <span>{t('app.poweredByShort')}</span>
            <img src="brand/astrikos-logo.png" alt="Astrikos" className="h-[22px] w-auto" style={{ filter: 'var(--astrikos-filter)' }} />
          </div>
        </>
      )}
      <button
        type="button"
        onClick={() => setCollapsed(!collapsed)}
        className="h-10 border-t border-line text-dim hover:text-ink flex items-center justify-center gap-2 text-[12px]"
        aria-label={collapsed ? t('nav.expand') : t('nav.collapse')}
      >
        {collapsed ? <ChevronsRight size={16} className="flip-rtl" /> : <ChevronsLeft size={16} className="flip-rtl" />}
        {!collapsed && t('nav.collapse')}
      </button>
    </aside>
  );
}

function ClockControls() {
  const { t, i18n } = useTranslation();
  const simT = useApp((s) => s.simT);
  const playing = useApp((s) => s.playing);
  const speed = useApp((s) => s.speed);
  const setPlaying = useApp((s) => s.setPlaying);
  const setSpeed = useApp((s) => s.setSpeed);
  const reset = resetDemo;
  const lang = i18n.language as 'en' | 'ar';
  return (
    <div className="flex items-center gap-1.5 rounded-lg border border-line-2 bg-surface-2 ps-2.5 pe-1 h-9" title={t('hdr.demoClock')}>
      <div className="leading-tight me-1 shrink-0">
        <div className="text-[9.5px] uppercase tracking-wider text-dim">{t('hdr.dataDate')}</div>
        <div className="text-[12.5px] font-semibold num whitespace-nowrap">{fmtDate(simT, lang)}</div>
      </div>
      <Btn variant="ghost" size="sm" className="!px-1.5" onClick={() => setPlaying(!playing)} aria-label={playing ? t('hdr.pause') : t('hdr.play')} title={playing ? t('hdr.pause') : t('hdr.play')}>
        {playing ? <Pause size={15} /> : <Play size={15} />}
      </Btn>
      <Seg
        size="sm"
        ariaLabel={t('hdr.speed')}
        value={speed}
        onChange={setSpeed}
        options={[
          { value: 1 / 24, label: '1h', title: t('speed.1') },
          { value: 1, label: '1d', title: t('speed.2') },
          { value: 7, label: '1w', title: t('speed.3') },
        ]}
      />
      <Btn variant="ghost" size="sm" className="!px-1.5" onClick={reset} aria-label={t('hdr.reset')} title={t('hdr.reset')}>
        <RotateCcw size={14} />
      </Btn>
    </div>
  );
}

function Header() {
  const { t, i18n } = useTranslation();
  const lang = useApp((s) => s.lang);
  const setLang = useApp((s) => s.setLang);
  const theme = useApp((s) => s.theme);
  const setTheme = useApp((s) => s.setTheme);
  const big = useApp((s) => s.big);
  const setBig = useApp((s) => s.setBig);
  const role = useApp((s) => s.role);
  const setRole = useApp((s) => s.setRole);
  const packId = useApp((s) => s.packId);
  const setPack = useApp((s) => s.setPack);
  const pack = usePack();
  const presenter = useApp((s) => s.presenter);
  const setPresenter = useApp((s) => s.setPresenter);
  return (
    <header className="h-14 shrink-0 border-b border-line bg-surface flex items-center gap-2.5 px-4 min-w-0">
      <div className="min-w-0 leading-tight">
        <div className="flex items-center gap-2">
          <span className="text-[15px] font-semibold tracking-tight truncate">{tx(pack.config.name, lang)}</span>
        </div>
        <div className="text-[11.5px] text-dim truncate max-w-[26ch]" title={tx(pack.config.subtitle, lang)}>{tx(pack.config.subtitle, lang)}</div>
      </div>
      <div className="flex-1" />
      <button
        type="button"
        className="hidden 2xl:flex items-center gap-2 h-9 rounded-lg border border-line-2 bg-surface-2 px-3 text-[12.5px] text-dim hover:text-ink"
        onClick={() => window.dispatchEvent(new CustomEvent('mz:palette'))}
      >
        <Search size={14} />
        {t('hdr.search')}
      </button>
      <button
        type="button"
        onClick={() => openCopilot()}
        className="flex items-center gap-1.5 h-9 shrink-0 whitespace-nowrap rounded-lg px-3 text-[12.5px] font-semibold border border-transparent transition-colors hover:brightness-110 ai-glow"
        style={{ color: 'var(--violet-ink)', background: 'var(--violet)' }}
        title={`${t('ai.title')} (Ctrl+J)`}
        data-testid="ask-ai"
      >
        <Sparkles size={14} />
        {t('hdr.ai')}
      </button>
      <ClockControls />
      <Select<Role>
        ariaLabel={t('hdr.role')}
        value={role}
        onChange={setRole}
        className="!h-9 w-[152px] shrink-0"
        options={ROLES.map((r) => ({ value: r, label: t(`role.${r}`) }))}
      />
      <Select<'port' | 'highway'>
        ariaLabel={t('hdr.pack')}
        value={packId}
        onChange={setPack}
        className="!h-9 w-[108px] shrink-0 hidden lg:block"
        options={[
          { value: 'port', label: t('pack.portShort') },
          { value: 'highway', label: t('pack.highwayShort') },
        ]}
      />
      <Seg
        ariaLabel={t('hdr.language')}
        value={lang}
        onChange={(l) => {
          setLang(l);
          applyLangToDocument(l);
        }}
        options={[
          { value: 'en', label: 'EN' },
          { value: 'ar', label: 'عربي' },
        ]}
      />
      <Btn variant="ghost" className="!px-2" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label={t('hdr.theme')} title={t('hdr.theme')}>
        {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
      </Btn>
      <Btn variant={big ? 'soft' : 'ghost'} className="!px-2" onClick={() => setBig(!big)} aria-label={t('hdr.bigText')} title={t('hdr.bigText')}>
        <Type size={17} />
      </Btn>
      <Btn variant={presenter ? 'soft' : 'ghost'} className="!px-2" onClick={() => setPresenter(!presenter)} aria-label={t('hdr.presenter')} title={`${t('hdr.presenter')} (Ctrl+Shift+P)`}>
        <Presentation size={17} />
      </Btn>
      <span className="sr-only">{i18n.language}</span>
    </header>
  );
}

/** advances the demo clock while playing */
function useClockTicker() {
  const playing = useApp((s) => s.playing);
  const raf = useRef(0);
  useEffect(() => {
    if (!playing) return;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.25, (now - last) / 1000);
      last = now;
      const st = useApp.getState();
      st.setSimT(st.simT + dt * st.speed);
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf.current);
  }, [playing]);
}

export function Shell() {
  const { t } = useTranslation();
  const lang = useApp((s) => s.lang);
  const theme = useApp((s) => s.theme);
  const big = useApp((s) => s.big);
  const setPresenter = useApp((s) => s.setPresenter);
  const loc = useLocation();
  const ready = useDataReady();
  useClockTicker();
  useEffect(() => {
    void useIntegration.getState().init();
  }, []);

  useEffect(() => {
    applyLangToDocument(lang);
  }, [lang]);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  useEffect(() => {
    document.documentElement.dataset.big = big ? '1' : '0';
  }, [big]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        setPresenter(!useApp.getState().presenter);
      }
    };
    window.addEventListener('keydown', onKey);
    if (new URLSearchParams(window.location.search).get('presenter') === '1') setPresenter(true);
    return () => window.removeEventListener('keydown', onKey);
  }, [setPresenter]);

  return (
    <div className="h-full flex min-w-0">
      <Sidebar />
      <div className="flex-1 min-w-0 flex flex-col">
        <Header />
        <AdvisoryStrip />
        <PageKpis />
        <main className="flex-1 min-h-0 overflow-auto relative" id="main" data-route={loc.pathname}>
          <Boundary label={t('err.title')} retry={t('err.retry')} key={loc.pathname}>
            <Suspense fallback={<div className="p-6 text-dim text-[13px]">{t('common.loading')}</div>}>
              {ready ? <Outlet /> : <div className="p-6 text-dim text-[13px]" data-testid="booting">{t('common.loading')}</div>}
            </Suspense>
          </Boundary>
        </main>
      </div>
      <Copilot />
      <KpiPanel />
      <ActionPanel />
      <PresenterPanel />
      <CommandPalette />
      <CreditsDialog />
      <Chip tone="neutral" className="sr-only">
        {t('common.illustrativeNote')}
      </Chip>
    </div>
  );
}
