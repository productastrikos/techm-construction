// KPI details affordance + panel (day filter, forecast toggle, AI forecast button, Apply) and the drone survey-date selector.
// usage: node scripts/kpi-drone.mjs [light|dark]   -> screenshots in app/.verify/kpi
import { launch, openPage, outDir, summarize } from './lib.mjs';
const theme = process.argv[2] || 'light';
const browser = await launch();
const dir = outDir('kpi');
let bad = 0;
const check = (n, ok, d = '') => { console.log(ok ? 'PASS' : 'FAIL', n, d); if (!ok) bad++; };
const { ctx, page, log } = await openPage(browser, { w: 1440, h: 900, theme, route: '/' });
await page.waitForSelector('[data-kpi]', { timeout: 30000 });
await page.waitForTimeout(1200);

// 1. every KPI card advertises that it opens
const cards = await page.locator('[data-kpi]').count();
const withDetails = await page.locator('[data-kpi]:has-text("Details")').count();
check('KPI cards show a Details link', cards > 0 && cards === withDetails, `${withDetails}/${cards}`);
check('non-compact cards show a status label', (await page.locator('[data-kpi]:has-text("On track"), [data-kpi]:has-text("Watch"), [data-kpi]:has-text("At risk"), [data-kpi]:has-text("Updated live")').count()) > 0);
await page.screenshot({ path: `${dir}/home-${theme}.png` });

// 2. panel
await page.locator('[data-kpi]').first().click();
await page.waitForSelector('[data-testid=kpi-panel-body]');
await page.waitForTimeout(700);
check('panel has the day filter (7D/14D/30D/90D)', (await page.locator('[data-testid=kpi-filters] [data-value]').count()) === 4);
check('panel has Forecast + Compare previous toggles', (await page.locator('[data-testid=kpi-toggle-forecast]').count()) === 1 && (await page.locator('[data-testid=kpi-toggle-prev]').count()) === 1);
check('panel has a Forecast button on the AI block', (await page.locator('[data-testid=kpi-run-forecast]').count()) === 1);
check('forecast stats shown', (await page.locator('[data-testid=kpi-stats]').count()) === 1);
await page.screenshot({ path: `${dir}/panel-${theme}.png` });
const t30 = await page.locator('[data-testid=kpi-stats]').textContent();
await page.locator('[data-testid=kpi-filters] [data-value="90"]').click();
await page.waitForTimeout(400);
check('AI re-runs the forecast when the window changes', (await page.locator('[data-testid=kpi-panel-body] .ai-spin').count()) > 0 || (await page.locator('[data-testid=kpi-panel-body]').textContent()).includes('Reading the last 90 days'));
await page.waitForTimeout(2200);
const t90 = await page.locator('[data-testid=kpi-stats]').textContent();
check('90D changes the forecast numbers', t30 !== t90, `${t30} -> ${t90}`);
await page.screenshot({ path: `${dir}/panel-90d-${theme}.png` });
await page.locator('[data-testid=kpi-toggle-forecast]').click();
await page.waitForTimeout(250);
check('Forecast toggle hides the forecast stats', (await page.locator('[data-testid=kpi-stats]').count()) === 0);
await page.locator('[data-testid=kpi-toggle-forecast]').click();
await page.locator('[data-testid=kpi-run-forecast]').click();
await page.waitForTimeout(300);
check('Forecast button replays the AI steps', (await page.locator('[data-testid=kpi-panel-body]').textContent()).includes('Fitting trend') || (await page.locator('[data-testid=kpi-panel-body] .ai-spin').count()) > 0);
await page.waitForTimeout(2200);
const acts = await page.locator('[data-testid=kpi-apply]').count();
check('AI advisory lists Apply actions', acts >= 3, String(acts));
await page.locator('[data-testid=kpi-apply]').first().click();
await page.waitForTimeout(1100);
check('Apply creates a work order and routes it', /WO-\d+ created and routed/.test(await page.locator('[data-testid=kpi-panel-body]').textContent()));
await page.screenshot({ path: `${dir}/panel-applied-${theme}.png` });
await page.keyboard.press('Escape');
await page.waitForTimeout(300);

// date KPI + percent KPI render
for (const label of ['Forecast completion', 'Fleet availability']) {
  const c = page.locator(`[data-kpi="${label}"]`).first();
  if (await c.count()) {
    await c.click();
    await page.waitForSelector('[data-testid=kpi-panel-body]');
    await page.waitForTimeout(500);
    const txt = await page.locator('[data-testid=kpi-stats]').textContent();
    check(`${label}: range reads sensibly`, !/NaN|undefined|±0\.0%/.test(txt ?? ''), txt);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(250);
  }
}

// 3. drone survey-date selector
const drone = page.locator('[data-testid=drone-compare]');
await drone.scrollIntoViewIfNeeded();
await page.waitForTimeout(400);
check('drone: quick day presets', (await page.locator('[data-testid=drone-filters] [data-value]').count()) === 5);
check('drone: two flight-date dropdowns', (await page.locator('[data-testid=drone-filters] select').count()) === 2);
await page.screenshot({ path: `${dir}/drone-${theme}.png` });
const capA = await page.locator('[data-testid=drone-compare] b').allTextContents();
await page.locator('[data-testid=drone-filters] [data-value="90"]').click();
await page.waitForTimeout(300);
const capB = await page.locator('[data-testid=drone-compare] b').allTextContents();
check('drone: 90D preset changes the compared flights', String(capA) !== String(capB), `${capA} -> ${capB}`);
await page.locator('[data-testid=drone-filters] select').first().selectOption({ index: 3 });
await page.waitForTimeout(250);
check('drone: exact date selection works', String(await page.locator('[data-testid=drone-compare] b').allTextContents()) !== String(capB));
await page.locator('[data-testid=drone-timeline] button').nth(10).click();
await page.waitForTimeout(250);
await page.screenshot({ path: `${dir}/drone-picked-${theme}.png` });

// 4. header
check('header has AI Copilot + AI Advisory buttons', (await page.locator('[data-testid=ask-ai]').count()) === 1 && (await page.locator('[data-testid=ai-advisory-btn]').count()) === 1);
await page.locator('[data-testid=ai-advisory-btn]').click();
await page.waitForTimeout(500);
await page.screenshot({ path: `${dir}/advisory-btn-${theme}.png` });

const s = summarize(log);
const errs = [...s.errors, ...s.pageErrors].filter((e) => !/502|Bad Gateway|ECONNREFUSED/.test(e));
check('no console / page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
await ctx.close();
await browser.close();
process.exit(bad ? 1 : 0);
