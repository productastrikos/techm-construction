import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, LayoutGrid, LogIn, Lock, LogOut, User } from 'lucide-react';
import { useAuth } from './auth';
import { Deck } from './login/Deck';
import { Overview } from './login/Overview';

/** Always rendered dark, whatever the app theme is: matches the Tech Mahindra x Astrikos sign-in reference. */
const C = {
  page: '#1c1c1c',
  card: '#0a0a0a',
  field: '#141414',
  fieldLine: '#1f1f1f',
  title: '#ffffff',
  sub: '#8fa3bf',
  label: '#7fb3e6',
  placeholder: '#9aa0aa',
  icon: '#9aa0aa',
  button: '#3f3f3f',
  buttonHover: '#4a4a4a',
};

type Tab = 'signin' | 'overview';

export default function LoginPage() {
  const user = useAuth((s) => s.user);
  const signIn = useAuth((s) => s.signIn);
  const nav = useNavigate();
  const [name, setName] = useState('');
  const [pass, setPass] = useState('');
  const [show, setShow] = useState(false);
  const [err, setErr] = useState('');
  const [tab, setTab] = useState<Tab>('signin');

  if (user) return <Navigate to="/" replace />;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !pass) {
      setErr('Enter your username and password.');
      return;
    }
    if (signIn(name, pass)) nav('/', { replace: true });
    else setErr('Invalid username or password.');
  };

  const field = 'w-full h-[52px] rounded-xl pl-11 text-[16px] outline-none border focus:border-[#5a5a5a]';
  const tabBtn = (id: Tab, icon: React.ReactNode, label: string) => (
    <button
      key={id}
      type="button"
      role="tab"
      aria-selected={tab === id}
      onClick={() => setTab(id)}
      data-testid={`login-tab-${id}`}
      className="inline-flex items-center gap-2 h-10 px-4 rounded-lg text-[14px] font-semibold transition-colors"
      style={tab === id ? { background: '#262626', color: '#fff', boxShadow: 'inset 0 0 0 1px #3a3a3a' } : { color: C.sub }}
    >
      {icon}
      {label}
    </button>
  );

  const logo = (h: number) => (
    <span className="inline-flex items-center rounded-xl bg-white px-4 py-2.5 shrink-0">
      <img src="brand/tm-logo.png" alt="Tech Mahindra" style={{ height: h }} className="w-auto block" />
    </span>
  );
  const poweredBy = (
    <div className="flex items-center justify-center gap-3 text-[15px]" style={{ color: C.sub }}>
      <span>Powered by</span>
      <img src="brand/astrikos-logo.png" alt="Astrikos" className="h-[26px] w-auto" style={{ filter: 'brightness(1.9)' }} />
    </div>
  );

  return (
    <div data-theme="dark" className="h-full w-full overflow-auto" style={{ background: C.page, color: 'var(--text)' }} data-testid="login">
      <div className="mx-auto w-full max-w-[1100px] px-4 sm:px-8 pb-10">
        <nav role="tablist" aria-label="Sign-in page sections" className="flex justify-center sm:justify-end pt-5">
          <div className="flex items-center gap-1 rounded-xl p-1" style={{ background: '#141414' }}>
            {tabBtn('signin', <LogIn size={16} />, 'Sign in')}
            {tabBtn('overview', <LayoutGrid size={16} />, 'KPI & UX overview')}
          </div>
        </nav>

        {tab === 'signin' ? (
          <div className="flex justify-center pt-[56px]">
            <form onSubmit={submit} noValidate className="w-full max-w-[475px] rounded-[20px] px-10 pt-11 pb-9 shadow-[0_20px_60px_rgba(0,0,0,0.45)]" style={{ background: C.card }}>
              <div className="flex justify-center">{logo(44)}</div>
              <h1 className="mt-8 text-center text-[22px] font-bold tracking-tight" style={{ color: C.title }}>
                Construction Command Hub
              </h1>
              <p className="mt-2 text-center text-[15px]" style={{ color: C.sub }}>
                Sign in to access your dashboard
              </p>

              <label htmlFor="login-user" className="block mt-9 mb-2 text-[13.5px] uppercase tracking-[0.03em]" style={{ color: C.label }}>
                Username
              </label>
              <div className="relative">
                <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: C.icon }} />
                <input
                  id="login-user"
                  autoFocus
                  autoComplete="username"
                  value={name}
                  onChange={(e) => (setName(e.target.value), setErr(''))}
                  placeholder="Enter username"
                  className={field}
                  style={{ background: C.field, borderColor: C.fieldLine, color: C.title }}
                />
              </div>

              <label htmlFor="login-pass" className="block mt-6 mb-2 text-[13.5px] uppercase tracking-[0.03em]" style={{ color: C.label }}>
                Password
              </label>
              <div className="relative">
                <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: C.icon }} />
                <input
                  id="login-pass"
                  type={show ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={pass}
                  onChange={(e) => (setPass(e.target.value), setErr(''))}
                  placeholder="Enter password"
                  className={field + ' pr-12'}
                  style={{ background: C.field, borderColor: C.fieldLine, color: C.title }}
                />
                <button
                  type="button"
                  onClick={() => setShow((v) => !v)}
                  aria-label={show ? 'Hide password' : 'Show password'}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1"
                  style={{ color: C.icon }}
                >
                  {show ? <EyeOff size={19} /> : <Eye size={19} />}
                </button>
              </div>

              <div role="alert" className="min-h-[18px] mt-2 text-[13px]" style={{ color: '#ff6b6b' }} data-testid="login-error">
                {err}
              </div>

              <button
                type="submit"
                className="mt-1 w-full h-[50px] rounded-xl text-[16px] font-medium transition-colors"
                style={{ background: C.button, color: '#fff' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = C.buttonHover)}
                onMouseLeave={(e) => (e.currentTarget.style.background = C.button)}
              >
                Sign In
              </button>

              <div className="mt-10">{poweredBy}</div>
            </form>
          </div>
        ) : (
          <div className="pt-4 space-y-10">
            <div className="flex flex-wrap items-center gap-4">
              {logo(38)}
              <div className="leading-tight">
                <div className="text-[20px] font-bold tracking-tight" style={{ color: C.title }}>Construction Command Hub</div>
                <div className="text-[13px]" style={{ color: C.sub }}>About this proof of concept</div>
              </div>
            </div>
            <Deck />
            <Overview />
            <div className="pt-2">{poweredBy}</div>
          </div>
        )}
      </div>
    </div>
  );
}

export function LogoutButton() {
  const signOut = useAuth((s) => s.signOut);
  return (
    <button
      type="button"
      onClick={signOut}
      className="inline-flex items-center justify-center h-9 px-2 rounded-lg text-dim hover:text-ink hover:bg-surface-2"
      aria-label="Sign out"
      title="Sign out"
      data-testid="signout"
    >
      <LogOut size={17} />
    </button>
  );
}
