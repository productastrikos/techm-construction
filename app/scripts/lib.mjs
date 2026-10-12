// Shared Playwright helpers for verification (WebGL via SwiftShader, falls back across installed Chromium builds).
import { chromium } from 'playwright';
import { existsSync, readdirSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

export const BASE = process.env.APP_URL || 'http://127.0.0.1:5176';
const launchArgs = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'];

function installed() {
  const root = join(process.env.LOCALAPPDATA || '', 'ms-playwright');
  if (!existsSync(root)) return [];
  const rev = (n) => Number(n.split('-')[1]);
  const dirs = readdirSync(root);
  const full = dirs.filter((n) => /^chromium-\d+$/.test(n)).sort((a, b) => rev(b) - rev(a)).map((n) => join(root, n, 'chrome-win64', 'chrome.exe'));
  const shell = dirs.filter((n) => /^chromium_headless_shell-\d+$/.test(n)).sort((a, b) => rev(b) - rev(a)).map((n) => join(root, n, 'chrome-headless-shell-win64', 'chrome-headless-shell.exe'));
  return [...full, ...shell].filter(existsSync);
}

export async function launch() {
  try {
    return await chromium.launch({ args: launchArgs });
  } catch (e) {
    for (const executablePath of installed()) {
      try {
        return await chromium.launch({ args: launchArgs, executablePath });
      } catch {}
    }
    for (const channel of ['chrome', 'msedge']) {
      try {
        return await chromium.launch({ args: launchArgs, channel });
      } catch {}
    }
    throw e;
  }
}

/** open a page, collecting console errors / page errors / failed + external requests */
export async function openPage(browser, { w = 1366, h = 768, lang = 'en', theme = 'dark', route = '/' } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  await ctx.addInitScript(([l, th]) => {
    try {
      sessionStorage.setItem('mz.auth', 'admin');
      localStorage.setItem('mz.lang', JSON.stringify(l));
      localStorage.setItem('mz.theme', JSON.stringify(th));
    } catch {}
  }, [lang, theme]);
  const page = await ctx.newPage();
  const log = { errors: [], warnings: [], pageErrors: [], failed: [], external: new Set() };
  page.on('console', (m) => {
    if (m.type() === 'error') log.errors.push(m.text().slice(0, 400));
    else if (m.type() === 'warning') log.warnings.push(m.text().slice(0, 240));
  });
  page.on('pageerror', (e) => log.pageErrors.push(String(e).slice(0, 400)));
  page.on('requestfailed', (r) => log.failed.push(`${r.url().slice(0, 140)} :: ${r.failure()?.errorText}`));
  page.on('request', (r) => {
    try {
      const u = new URL(r.url());
      if (/^https?:$/.test(u.protocol) && !['127.0.0.1', 'localhost'].includes(u.hostname)) log.external.add(u.hostname);
    } catch {}
  });
  await page.goto(`${BASE}/#${route}`, { waitUntil: 'networkidle', timeout: 60000 }).catch((e) => log.pageErrors.push('nav: ' + e));
  return { ctx, page, log };
}

export function outDir(sub) {
  const d = join(process.cwd(), '.verify', sub);
  mkdirSync(d, { recursive: true });
  return d;
}

export function summarize(log) {
  return {
    errors: log.errors,
    pageErrors: log.pageErrors,
    failed: log.failed,
    external: [...log.external],
    warnings: log.warnings.slice(0, 5),
  };
}
