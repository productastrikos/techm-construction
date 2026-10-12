import { create } from 'zustand';

/**
 * Demo sign-in gate. This is a client-side screen for the PoC only: there is no server-side
 * identity provider behind it, and the credentials below ship in the bundle. Override with
 * VITE_DEMO_USER / VITE_DEMO_PASS at build time. Replace with SSO (OIDC/SAML) for production.
 */
const DEMO_USER = (import.meta.env.VITE_DEMO_USER as string | undefined) ?? 'admin';
const DEMO_PASS = (import.meta.env.VITE_DEMO_PASS as string | undefined) ?? 'Astrikos@2026';

const KEY = 'mz.auth';

function read(): string | null {
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}

interface AuthState {
  user: string | null;
  signIn: (username: string, password: string) => boolean;
  signOut: () => void;
}

export const useAuth = create<AuthState>((set) => ({
  user: read(),
  signIn: (username, password) => {
    if (username.trim().toLowerCase() !== DEMO_USER.toLowerCase() || password !== DEMO_PASS) return false;
    const user = username.trim();
    try {
      sessionStorage.setItem(KEY, user);
    } catch {
      /* ignore */
    }
    set({ user });
    return true;
  },
  signOut: () => {
    try {
      sessionStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
    set({ user: null });
  },
}));

// e2e scripts pre-seed sessionStorage['mz.auth'] via addInitScript; nothing else needs this on window.
