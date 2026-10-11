/** Backend endpoints. Both come from env (see app/.env.production); empty = same origin (dev server proxies /api and /ws). */
export const API_URL = ((import.meta.env.VITE_API_URL as string | undefined) ?? '').replace(/\/+$/, '');
const SOCKET_BASE = ((import.meta.env.VITE_SOCKET_URL as string | undefined) ?? '').replace(/\/+$/, '');

/** websocket endpoint of the integration hub (one backend port serves REST and the socket) */
export function wsUrl(): string {
  if (SOCKET_BASE) return `${SOCKET_BASE.replace(/^http/i, 'ws')}/ws`;
  if (typeof location === 'undefined') return '';
  return `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`;
}

export async function api<T>(path: string, init?: { method?: string; body?: unknown; timeoutMs?: number }): Promise<T> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), init?.timeoutMs ?? 4000);
  try {
    const res = await fetch(`${API_URL}${path}`, {
      method: init?.method ?? 'GET',
      headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
      body: init?.body ? JSON.stringify(init.body) : undefined,
      signal: ctl.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}
