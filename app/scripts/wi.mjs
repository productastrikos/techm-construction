// what-if flow screenshots + interaction checks. usage: node scripts/wi.mjs [lang] [WxH]
import { launch, openPage, outDir } from './lib.mjs';
const lang = process.argv[2] || 'en';
const [w, h] = (process.argv[3] || '1366x768').split('x').map(Number);
const browser = await launch();
const dir = outDir('wi');
const { ctx, page, log } = await openPage(browser, { w, h, lang, route: '/whatif/supply' });
await page.waitForTimeout(3000);
await page.screenshot({ path: `${dir}/supply0_${lang}_${w}x${h}.png` });
// H1: click Closed
await page.click('button[aria-pressed]:has-text("Closed"), button[aria-pressed]:has-text("مغلق")');
await page.waitForTimeout(2500);
await page.screenshot({ path: `${dir}/supply1_${lang}_${w}x${h}.png`, fullPage: false });
const kp = await page.locator('[data-testid="result-kpis"]').innerText().catch(() => 'n/a');
console.log('KPIS', kp.replace(/\n+/g, ' | '));
await page.evaluate(() => document.querySelector('[data-testid="whatif-page"]').scrollTo(0, 600));
await page.waitForTimeout(600);
await page.screenshot({ path: `${dir}/supply2_${lang}_${w}x${h}.png` });
console.log(JSON.stringify({ errors: log.errors, pageErrors: log.pageErrors, failed: log.failed }));
await browser.close();
