// verifies the client-feedback round: advisory strip, KPI side panel on every page, hidden SIMULATED / AI DEMO labels,
// alert -> AI explanation -> ticket -> Work Orders flow, integrations tab. usage: node scripts/features.mjs [theme] [WxH]
import { launch, openPage, outDir, summarize } from './lib.mjs';

const theme = process.argv[2] || 'light';
const [w, h] = (process.argv[3] || '1600x900').split('x').map(Number);
const dir = outDir('features');
const results = [];
const check = (name, ok, extra = '') => {
  results.push({ name, ok: !!ok, extra });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  - ' + extra : ''}`);
};

const browser = await launch();
const { page, log } = await openPage(browser, { w, h, theme, route: '/' });
await page.waitForSelector('[data-testid="portfolio-page"]', { timeout: 90000 });
await page.waitForTimeout(1500);
await page.screenshot({ path: `${dir}/01_dashboard_${theme}.png` });

const bodyText = async () => (await page.locator('body').innerText()).replace(/\s+/g, ' ');
let txt = await bodyText();
check('advisory strip visible under header', await page.locator('[data-testid="ai-advisory"]').count());
check('no "SIMULATED" label on dashboard', !/SIMULATED/i.test(txt));
check('no "AI demo" label on dashboard', !/AI DEMO/i.test(txt));
check('"Good morning" hero is hidden', !/good morning/i.test(txt));
check('Watch the AI at work button kept', await page.locator('[data-testid="watch-ai"]').count());

// KPI panel
const kpi = page.locator('[data-kpi]').first();
await kpi.click();
await page.waitForSelector('[data-testid="kpi-panel-body"]', { timeout: 5000 }).catch(() => {});
await page.waitForTimeout(900);
check('KPI click opens the right panel', await page.locator('[data-testid="kpi-panel-body"]').count());
check('KPI panel has 7-day and 30-day charts', (await page.locator('[data-testid="kpi-panel"] canvas').count()) >= 2, `${await page.locator('[data-testid="kpi-panel"] canvas').count()} canvases`);
await page.screenshot({ path: `${dir}/02_kpi_panel_${theme}.png` });
await page.keyboard.press('Escape');
await page.waitForTimeout(400);

// every page: advisory + KPI panel opens (where the page has KPI tiles)
const routes = ["/", "/twin", "/schedule", "/whatif", "/procurement", "/assets", "/workorders", "/cost", "/hse", "/docs", "/reports"];
for (const r of routes) {
  await page.goto(`${page.url().split('#')[0]}#${r}`);
  await page.waitForTimeout(r === '/twin' ? 4000 : 1500);
  const adv = await page.locator('[data-testid="ai-advisory"]').count();
  const k = page.locator('[data-kpi]');
  const n = await k.count();
  let opened = false;
  if (n) {
    await k.first().click();
    await page.waitForTimeout(700);
    opened = (await page.locator('[data-testid="kpi-panel-body"]').count()) > 0;
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  }
  const t = await bodyText();
  check(`route ${r}: advisory + KPI panel`, adv && n > 0 && opened && !/SIMULATED|AI DEMO/i.test(t), `${n} KPI tiles`);
}

// scenario: dashboard alert -> AI explains -> ticket -> visible in Work Orders
await page.goto(`${page.url().split('#')[0]}#/`);
await page.waitForSelector('[data-testid="alarm-item"]', { timeout: 30000 });
await page.waitForTimeout(800);
await page.locator('[data-testid="alarm-item"]').first().click();
await page.waitForSelector('[data-testid="alert-detail"]', { timeout: 5000 });
await page.waitForTimeout(600);
await page.screenshot({ path: `${dir}/03_alert_analysing_${theme}.png` });
await page.waitForSelector('[data-testid="create-ticket"]', { timeout: 12000 });
await page.waitForTimeout(500);
await page.screenshot({ path: `${dir}/04_alert_explained_${theme}.png` });
check('alert panel explains what / why / next', /what happened/i.test(await page.locator('[data-testid="alert-detail"]').innerText()) && /what to do next/i.test(await page.locator('[data-testid="alert-detail"]').innerText()));
await page.locator('[data-testid="create-ticket"]').click();
await page.waitForSelector('[data-testid="ticket-sync"]', { timeout: 8000 }).catch(() => {});
check('ticket created and synced to an external tool', await page.locator('[data-testid="ticket-sync"]').count(), (await page.locator('[data-testid="ticket-sync"]').innerText().catch(() => '')).replace(/\s+/g, ' '));
await page.waitForTimeout(3500);
await page.screenshot({ path: `${dir}/05_ticket_created_${theme}.png` });
await page.locator('[data-testid="view-in-wo"]').click();
await page.waitForTimeout(1200);
check('navigated to Work Orders', /#\/workorders/.test(page.url()));
const row = page.locator('[data-testid^="ticket-WO-"]').first();
check('new ticket is in the Work Orders list', await row.count(), (await row.innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 140));
await page.screenshot({ path: `${dir}/06_workorders_ticket_${theme}.png` });
await page.waitForTimeout(6500);
const rowTxt = (await row.innerText().catch(() => '')).replace(/\s+/g, ' ');
check('ticket status advanced live (in progress)', /in progress/i.test(rowTxt), rowTxt.slice(-60));

// board tab + integrations tab
await page.getByText('Work order board').click();
await page.waitForTimeout(600);
check('board shows the ticket reference on the card', await page.locator('[data-testid^="wo-ticket-WO-"]').count());
await page.screenshot({ path: `${dir}/07_board_${theme}.png` });
await page.locator('[data-testid="workorders-page"]').getByText('Integrations', { exact: true }).click();
await page.waitForSelector('[data-testid="integrations-tab"]', { timeout: 5000 });
await page.waitForTimeout(600);
check('integrations tab lists 5 connectors', (await page.locator('[data-testid^="int-"]').count()) === 5, `${await page.locator('[data-testid^="int-"]').count()}`);
await page.locator('[data-testid="test-servicenow"]').click();
await page.waitForTimeout(900);
check('connection test returns OK', /OK \d+ ms/.test(await page.locator('[data-testid="int-servicenow"]').innerText()));
await page.screenshot({ path: `${dir}/08_integrations_${theme}.png`, fullPage: false });

// "See actions" list from the advisory strip
await page.locator('[data-testid="see-actions"]').click();
await page.waitForSelector('[data-testid="action-list"]', { timeout: 4000 }).catch(() => {});
check('See actions opens the recommended-actions list', await page.locator('[data-testid="action-item"]').count());

const s = summarize(log);
check('no console errors / page errors', s.errors.length === 0 && s.pageErrors.length === 0, JSON.stringify({ errors: s.errors.slice(0, 3), pageErrors: s.pageErrors.slice(0, 3) }));
check('no external hosts requested', s.external.length === 0, s.external.join(','));
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
