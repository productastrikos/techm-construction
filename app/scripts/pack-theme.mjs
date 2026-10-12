// Highway pack + light theme smoke test with screenshots. usage: node scripts/pack-theme.mjs
import { launch, outDir, BASE } from './lib.mjs';

const dir = outDir('packtheme');
const browser = await launch();
const cases = [
  { name: 'highway', pack: 'highway', theme: 'dark', routes: ['/', '/twin', '/schedule', '/procurement', '/assets', '/whatif'] },
  { name: 'light', pack: 'port', theme: 'light', routes: ['/', '/procurement', '/reports', '/hse'] },
];
let bad = 0;
for (const c of cases) {
  for (const route of c.routes) {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    await ctx.addInitScript(([p, th]) => {
      try {
        sessionStorage.setItem('mz.auth', 'admin');
        localStorage.setItem('mz.pack', JSON.stringify(p));
        localStorage.setItem('mz.theme', JSON.stringify(th));
        localStorage.setItem('mz.lang', JSON.stringify('en'));
      } catch {}
    }, [c.pack, c.theme]);
    const page = await ctx.newPage();
    const errs = [];
    page.on('console', (m) => m.type() === 'error' && errs.push(m.text().slice(0, 200)));
    page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
    await page.goto(`${BASE}/#${route}`, { waitUntil: 'networkidle' }).catch(() => {});
    await page.waitForTimeout(3500);
    if (route === '/procurement' && c.theme === 'light') {
      await page.click('[data-testid="ai-scan-btn"]').catch(() => {});
      await page.waitForTimeout(9000);
    }
    const f = `${dir}/${c.name}_${route.replace(/\W+/g, '_') || 'home'}.png`;
    await page.screenshot({ path: f });
    if (errs.length) bad++;
    console.log(c.name.padEnd(8), route.padEnd(14), errs.length ? 'ERRORS ' + JSON.stringify(errs) : 'clean');
    await ctx.close();
  }
}
await browser.close();
process.exit(bad ? 1 : 0);
