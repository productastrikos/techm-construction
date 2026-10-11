// usage: node scripts/shot.mjs <route> [--lang ar] [--sizes 1366x768,1920x1080] [--wait 1500] [--name x] [--theme dark] [--click sel] [--full]
import { launch, openPage, outDir, summarize } from './lib.mjs';
const a = process.argv.slice(2);
let route = a.find((x) => !x.startsWith('--')) || 'home'; route = route === 'home' ? '/' : '/' + route.replace(/^\/+/, '');
const opt = (n, d) => { const i = a.indexOf('--' + n); return i >= 0 && a[i + 1] ? a[i + 1] : d; };
const lang = opt('lang', 'en');
const theme = opt('theme', 'dark');
const sizes = opt('sizes', '1366x768').split(',').map((s) => s.split('x').map(Number));
const wait = Number(opt('wait', '1500'));
const name = opt('name', route.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '') || 'home');
const click = opt('click', '');
const browser = await launch();
const dir = outDir('shots');
const out = [];
for (const [w, h] of sizes) {
  const { ctx, page, log } = await openPage(browser, { w, h, lang, theme, route });
  await page.waitForTimeout(wait);
  if (click) { for (const sel of click.split('||')) { await page.click(sel, { timeout: 5000 }).catch((e) => log.pageErrors.push('click ' + sel + ': ' + String(e).slice(0, 100))); await page.waitForTimeout(500); } }
  const file = `${dir}/${name}_${lang}_${w}x${h}.png`;
  await page.screenshot({ path: file, fullPage: a.includes('--full') });
  out.push({ file, ...summarize(log) });
  await ctx.close();
}
await browser.close();
console.log(JSON.stringify(out, null, 1));
