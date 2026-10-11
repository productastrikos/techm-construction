// Visits every route, clicks every tab in turn, screenshots each state and reports console errors.
// usage: node scripts/tabs-tour.mjs [WxH] [lang] [theme] [routes,comma,separated]
import { launch, openPage, outDir } from './lib.mjs';

const [w, h] = (process.argv[2] || '1366x768').split('x').map(Number);
const lang = process.argv[3] || 'en';
const theme = process.argv[4] || 'dark';
const routes = (process.argv[5] || '/,/twin,/schedule,/whatif,/procurement,/assets,/cost,/hse,/docs,/reports,/admin').split(',');
const dir = outDir('tabs');
const browser = await launch();
let bad = 0;
for (const route of routes) {
  const { ctx, page, log } = await openPage(browser, { w, h, lang, theme, route });
  await page.waitForTimeout(2500);
  const name = (route.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '') || 'home');
  const tabs = await page.locator('main [role="tab"]').count();
  await page.screenshot({ path: `${dir}/${name}_0_${lang}_${theme}_${w}x${h}.png` });
  for (let i = 1; i < tabs; i++) {
    await page.locator('main [role="tab"]').nth(i).click().catch(() => {});
    await page.waitForTimeout(1600);
    await page.screenshot({ path: `${dir}/${name}_${i}_${lang}_${theme}_${w}x${h}.png` });
  }
  const errs = [...log.errors, ...log.pageErrors];
  if (errs.length) bad++;
  console.log(route.padEnd(14), `tabs=${tabs}`, errs.length ? 'ERRORS ' + JSON.stringify(errs).slice(0, 300) : 'clean');
  await ctx.close();
}
await browser.close();
process.exit(bad ? 1 : 0);
