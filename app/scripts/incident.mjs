// first-open view of the twin (incident card + camera). usage: node scripts/incident.mjs [lang] [WxH] [theme]
import { launch, openPage, outDir } from './lib.mjs';
const lang = process.argv[2] || 'en';
const [w, h] = (process.argv[3] || '1600x900').split('x').map(Number);
const theme = process.argv[4] || 'dark';
const browser = await launch();
const { page, log } = await openPage(browser, { w, h, lang, theme, route: '/twin' });
await page.waitForSelector('[data-testid="incident-card"]', { timeout: 90000 }).catch(() => {});
await page.waitForTimeout(5000);
const dir = outDir('incident');
await page.screenshot({ path: `${dir}/open_${lang}_${theme}.png` });
const ticket = page.locator('[data-testid="incident-ticket"]');
if (await ticket.count()) {
  await ticket.click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${dir}/ticket_${lang}_${theme}.png` });
}
console.log(JSON.stringify({ errors: log.errors, pageErrors: log.pageErrors, card: await page.locator('[data-testid="incident-card"]').count() }));
await browser.close();
