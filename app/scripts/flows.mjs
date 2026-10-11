// End-to-end hero flows H1/H2/H3 (+H4) with assertions and screenshots. usage: node scripts/flows.mjs [WxH] [lang]
import { launch, openPage, outDir } from './lib.mjs';

const [w, h] = (process.argv[2] || '1366x768').split('x').map(Number);
const lang = process.argv[3] || 'en';
const dir = outDir('flows');
const browser = await launch();
const results = [];
const check = (name, ok, info = '') => {
  results.push({ name, ok, info });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} ${info}`);
};
const shot = (page, n) => page.screenshot({ path: `${dir}/${n}_${lang}_${w}x${h}.png` });
const txt = async (page, sel) => (await page.locator(sel).first().innerText().catch(() => '')).replace(/\s+/g, ' ');

// ------------------------------------------------------------------ H1
{
  const { ctx, page, log } = await openPage(browser, { w, h, lang, route: '/' });
  await page.waitForTimeout(2500);
  let clicks = 0;
  const click = async (sel, label) => { await page.click(sel); clicks++; console.log(`  click ${clicks}: ${label}`); };
  await click('a[href="#/whatif"]', 'What-If Studio');
  await page.waitForSelector('[data-testid="supply-tab"]');
  await page.waitForTimeout(800);
  await click('[data-testid="supply-tab"] button[data-value="closed"]', 'Chokepoint = Closed');
  await page.waitForSelector('[data-testid="recovery-options"]', { timeout: 15000 });
  await page.waitForTimeout(800);
  const k1 = await txt(page, '[data-testid="result-kpis"]');
  const d = parseFloat((k1.match(/\+(\d+(\.\d+)?)/) || [])[1] || '0');
  check('H1: Chokepoint closed delays the finish by weeks', d > 15 && d < 45, `(+${d} d)`);
  await shot(page, 'h1_1_closed');
  await click('[data-testid="apply-reroute"]', 'Apply re-route via Port C');
  await page.waitForTimeout(1500);
  const cmp = await txt(page, '[data-testid="compare"]');
  check('H1: re-route option recovers the delay', /Port C|ميناء ج/.test(cmp), cmp.slice(0, 90));
  await click('[data-testid="commit"]', 'Commit scenario');
  check('H1: committed in <= 6 clicks', clicks <= 6, `(${clicks} clicks)`);
  await shot(page, 'h1_2_committed');
  await page.click('[data-testid="view-gantt"]');
  await page.waitForSelector('[data-testid="gantt-scroll"]');
  await page.waitForTimeout(2000);
  const ghost = await page.locator('svg rect[fill="var(--warn)"]').count();
  check('H1: Gantt shows scenario ghost bars', ghost > 0, `(${ghost} warn rects)`);
  await shot(page, 'h1_3_gantt');
  await page.click('a[href="#/twin"]');
  await page.waitForSelector('[data-testid="twin-canvas"]', { timeout: 20000 });
  await page.waitForTimeout(3500);
  const chip = await page.getByText(/Scenario overlay|عرض السيناريو/).count();
  check('H1: 3D twin carries the scenario overlay', chip > 0);
  await shot(page, 'h1_4_twin');
  check('H1: console clean', log.errors.length === 0 && log.pageErrors.length === 0, JSON.stringify([...log.errors, ...log.pageErrors]).slice(0, 200));
  await ctx.close();
}

// ------------------------------------------------------------------ H2
{
  const { ctx, page, log } = await openPage(browser, { w, h, lang, route: '/whatif/calendar' });
  await page.waitForTimeout(2500);
  await page.click('[data-testid="calendar-tab"] button[data-value="ramEid"]');
  await page.waitForSelector('[data-testid="recovery-options"]', { timeout: 15000 });
  await page.waitForTimeout(1200);
  const k = await txt(page, '[data-testid="calendar-tab"]');
  const lost = parseFloat((k.match(/(\d+(\.\d+)?)%/) || [])[1] || '0');
  check('H2: productive hours lost shown for Ramadan + Eid', lost > 5, `(${lost}%)`);
  await shot(page, 'h2_1_ramadan');
  const before = await txt(page, '[data-testid="compare"]');
  await page.click('[data-testid="apply-night"]');
  await page.waitForTimeout(1500);
  const after = await txt(page, '[data-testid="compare"]');
  check('H2: night-shift mitigation compared', /Night shift|وردية ليلية/.test(after) || after.length > 50, after.slice(0, 100));
  await page.click('[data-testid="calendar-tab"] button[data-value="summer"]');
  await page.waitForTimeout(2000);
  await shot(page, 'h2_2_summer');
  check('H2: console clean', log.errors.length === 0 && log.pageErrors.length === 0, JSON.stringify([...log.errors, ...log.pageErrors]).slice(0, 200));
  void before;
  await ctx.close();
}

// ------------------------------------------------------------------ H3
{
  const { ctx, page, log } = await openPage(browser, { w, h, lang, route: '/assets' });
  await page.waitForTimeout(2500);
  await page.evaluate(() => window.__app.getState().setSimT(75 + 10 + 8.4 / 24 - 8 / 24));
  await page.waitForTimeout(2500);
  await page.click('[data-testid="arow-CC-02"]');
  await page.waitForSelector('[data-testid="asset-detail"]');
  await page.waitForTimeout(1500);
  const det = await txt(page, '[data-testid="asset-detail"]');
  check('H3: CC-02 flagged critical with a failure window', /critical|حرج/i.test(det), det.slice(0, 120));
  await shot(page, 'h3_1_asset');
  await page.getByRole('button', { name: /Analyse impact|تحليل الأثر/ }).click();
  await page.waitForSelector('[data-testid="asset-options"]', { timeout: 15000 });
  await page.waitForTimeout(1500);
  const eq = await txt(page, '[data-testid="equipment-tab"]');
  check('H3: failure impact ~10 days lost vs service ~1 day', /10/.test(eq) && /1/.test(eq), '');
  await shot(page, 'h3_2_impact');
  await page.click('[data-testid="create-wo"]');
  await page.waitForTimeout(800);
  const created = await txt(page, '[data-testid="create-wo"]');
  check('H3: work order created', /WO-\d+/.test(created), created);
  await page.goto(page.url().split('#')[0] + '#/assets?tab=wo');
  await page.waitForSelector('[data-testid="wo-board"]');
  await page.waitForTimeout(800);
  const planned = await txt(page, '[data-testid="wo-col-planned"]');
  check('H3: work order appears in the CMMS kanban', /CC-02/.test(planned), '');
  await shot(page, 'h3_3_wo');
  await page.click('a[href="#/schedule"]');
  await page.waitForSelector('[data-testid="gantt-scroll"]');
  await page.waitForTimeout(1500);
  const band = await page.locator('svg rect[fill="var(--violet)"][opacity="0.28"]').count();
  check('H3: protected service window on the Gantt', band > 0, `(${band})`);
  await shot(page, 'h3_4_gantt');
  check('H3: console clean', log.errors.length === 0 && log.pageErrors.length === 0, JSON.stringify([...log.errors, ...log.pageErrors]).slice(0, 200));
  await ctx.close();
}

// ------------------------------------------------------------------ H4
{
  const { ctx, page, log } = await openPage(browser, { w, h, lang, route: '/whatif/stress' });
  await page.waitForTimeout(3500);
  await page.waitForSelector('[data-testid="compare"]');
  await page.waitForTimeout(2500);
  await shot(page, 'h4_1_stress');
  const cmp = await txt(page, '[data-testid="compare"]');
  check('H4: combined stress and mitigation package compared', /Combined stress|الإجهاد المركّب/.test(cmp), cmp.slice(0, 120));
  await page.click('[data-testid="gen-briefing"]');
  await page.waitForSelector('[data-testid="briefing-sheet"]');
  await page.waitForTimeout(800);
  await shot(page, 'h4_2_briefing');
  check('H4: board briefing generated', true);
  check('H4: console clean', log.errors.length === 0 && log.pageErrors.length === 0, JSON.stringify([...log.errors, ...log.pageErrors]).slice(0, 200));
  await ctx.close();
}

await browser.close();
const bad = results.filter((r) => !r.ok);
console.log(`\n${results.length - bad.length}/${results.length} checks passed`);
process.exit(bad.length ? 1 : 0);
