// Sign-in page tour: slide deck (all slides), KPI & UX overview tab (card -> preview, day filter), mobile layout.
// usage: node scripts/login-tour.mjs   -> screenshots in app/.verify/login
import { launch, BASE, outDir } from './lib.mjs';
const browser = await launch();
const dir = outDir('login');
let bad = 0;
const check = (n, ok, d = '') => { console.log(ok ? 'PASS' : 'FAIL', n, d); if (!ok) bad++; };
const errs = [];

const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
page.on('pageerror', (e) => errs.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errs.push(m.text().slice(0, 200)));
await page.goto(`${BASE}/#/login`, { waitUntil: 'networkidle' });

check('main login screen is just the sign-in card (no deck)', (await page.locator('[data-testid=login-deck]').count()) === 0);
await page.screenshot({ path: `${dir}/signin.png` });
await page.click('[data-testid=login-tab-overview]');
await page.waitForSelector('[data-testid=login-deck]');
const n = await page.locator('[data-testid=deck-count]').textContent();
check('deck renders with a counter', /1 \/ \d+/.test(n ?? ''), n);
const total = Number((n ?? '').split('/')[1]);
check('short deck (5-8 slides)', total >= 5 && total <= 8, String(total));
for (let i = 0; i < total; i++) {
  await page.screenshot({ path: `${dir}/slide-${i + 1}.png` });
  const title = (await page.locator('[data-testid=deck-slide] h2').textContent()) ?? '';
  check(`slide ${i + 1} has a title`, title.length > 5, title);
  const overflow = await page.evaluate(() => { const el = document.querySelector('[data-testid=deck-slide]'); return el ? el.scrollWidth > el.clientWidth + 2 : false; });
  check(`slide ${i + 1} has no horizontal overflow`, !overflow);
  await page.click('[data-testid=deck-next]');
  await page.waitForTimeout(250);
}
check('deck wraps around to slide 1', ((await page.locator('[data-testid=deck-count]').textContent()) ?? '').startsWith('1 /'));

// overview tab
await page.waitForSelector('[data-testid=login-overview]');
const cards = await page.locator('[data-testid=ov-kpi]').count();
check('overview lists the KPI cards', cards >= 12, String(cards));
check('every card shows a Details link', (await page.locator('[data-testid=ov-kpi]:has-text("Details")').count()) === cards);
await page.screenshot({ path: `${dir}/overview-top.png` });
await page.locator('[data-testid=ov-kpi]').nth(4).click();
await page.waitForTimeout(300);
check('clicking a card updates the preview', ((await page.locator('[data-testid=ov-preview]').textContent()) ?? '').includes('EAC'));
await page.locator('[data-testid=ov-preview] [data-value="90"]').click();
await page.waitForTimeout(200);
check('90D filter shows in preview', ((await page.locator('[data-testid=ov-preview]').textContent()) ?? '').includes('in 90 days'));
await page.screenshot({ path: `${dir}/overview-catalogue.png`, fullPage: false });
await page.locator('[data-testid=login-overview]').scrollIntoViewIfNeeded();
await page.screenshot({ path: `${dir}/overview-full.png`, fullPage: true });

// sign in still works from the first tab
await page.click('[data-testid=login-tab-signin]');
await page.fill('#login-user', 'admin');
await page.fill('#login-pass', process.env.DEMO_PASS ?? 'Astrikos@2026');
await page.click('button[type=submit]');
await page.waitForSelector('#main', { timeout: 15000 });
check('sign in lands in the app', page.url().endsWith('#/'));
await ctx.close();

// mobile
const m = await browser.newContext({ viewport: { width: 390, height: 844 } });
const mp = await m.newPage();
await mp.goto(`${BASE}/#/login`, { waitUntil: 'networkidle' });
await mp.screenshot({ path: `${dir}/mobile-signin.png`, fullPage: true });
const hs = await mp.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2 || document.querySelector('[data-testid=login]').scrollWidth > window.innerWidth + 2);
check('mobile: no horizontal scroll (sign-in tab)', !hs);
await mp.click('[data-testid=login-tab-overview]');
await mp.waitForTimeout(300);
await mp.screenshot({ path: `${dir}/mobile-overview.png`, fullPage: true });
const hs2 = await mp.evaluate(() => document.querySelector('[data-testid=login]').scrollWidth > window.innerWidth + 2);
check('mobile: no horizontal scroll (overview tab)', !hs2);
await m.close();

const real = errs.filter((e) => !/502|Bad Gateway/.test(e));
check('no page errors', real.length === 0, real.slice(0, 3).join(' | '));
await browser.close();
process.exit(bad ? 1 : 0);
