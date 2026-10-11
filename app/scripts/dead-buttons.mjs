// Dead-button detector: clicks every visible button / tab / link once per route and reports the ones that change nothing
// (no DOM mutation, no URL change, no popup, no download). Toggles that are already "on" show up as benign false positives.
// usage: node scripts/dead-buttons.mjs [lang] [routes,comma,separated]
import { launch, openPage, BASE } from './lib.mjs';

const lang = process.argv[2] || 'en';
const routes = (process.argv[3] || '/,/twin,/schedule,/whatif,/procurement,/assets,/cost,/hse,/docs,/reports,/admin').split(',');
const browser = await launch();
let total = 0;
const dead = [];
for (const route of routes) {
  const first = await openPage(browser, { w: 1440, h: 900, lang, route });
  await first.page.waitForTimeout(2500);
  await first.page.evaluate(() => window.__twin?.getState().patch({ incidentOpen: false })); // the pinned incident card moves/animates: keep the control list stable
  await first.page.waitForTimeout(300);
  const labels = await first.page.evaluate(() =>
    [...document.querySelectorAll('main button, main [role="tab"], main a[href]')]
      .filter((e) => e.offsetParent !== null && !e.disabled)
      .map((e, i) => ({ i, text: (e.innerText || e.getAttribute('aria-label') || e.title || e.getAttribute('href') || '').trim().replace(/\s+/g, ' ').slice(0, 40) })),
  );
  await first.ctx.close();
  console.log(route.padEnd(14), `${labels.length} controls`);
  for (const l of labels) {
    const { ctx, page } = await openPage(browser, { w: 1440, h: 900, lang, route });
    await page.waitForTimeout(1800);
    await page.evaluate(() => window.__twin?.getState().patch({ incidentOpen: false }));
    await page.waitForTimeout(300);
    await page.evaluate(() => {
      window.__mut = 0;
      new MutationObserver((r) => (window.__mut += r.length)).observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true });
    });
    const els = page.locator('main button, main [role="tab"], main a[href]');
    const visible = [];
    const n = await els.count();
    for (let k = 0; k < n; k++) if ((await els.nth(k).isVisible({ timeout: 1500 }).catch(() => false)) && (await els.nth(k).isEnabled({ timeout: 1500 }).catch(() => false))) visible.push(k);
    const target = els.nth(visible[l.i] ?? -1);
    const url0 = page.url();
    const pop = ctx.waitForEvent('page', { timeout: 700 }).catch(() => null);
    const dl = page.waitForEvent('download', { timeout: 700 }).catch(() => null);
    try {
      await target.click({ timeout: 2500 });
    } catch {
      continue;
    }
    total++;
    const [p2, d2] = await Promise.all([pop, dl]);
    await page.waitForTimeout(500);
    const mut = await page.evaluate(() => window.__mut);
    const changed = mut > 0 || page.url() !== url0 || p2 || d2;
    if (!changed) dead.push(`${route}  "${l.text}"`);
    await ctx.close();
  }
}
await browser.close();
console.log(`\nclicked ${total} controls; ${dead.length} produced no visible change:`);
for (const d of dead) console.log('  -', d);
