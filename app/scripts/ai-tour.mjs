// Exercises every AI moment (button -> animation -> result) and saves screenshots. usage: node scripts/ai-tour.mjs [WxH] [lang]
import { launch, openPage, outDir } from './lib.mjs';

const [w, h] = (process.argv[2] || '1440x900').split('x').map(Number);
const lang = process.argv[3] || 'en';
const dir = outDir('ai');
const browser = await launch();
const results = [];
const check = (name, ok, info = '') => {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} ${info}`);
};
const shot = (page, n) => page.screenshot({ path: `${dir}/${n}_${lang}_${w}x${h}.png` });
const visit = async (route, wait = 2500) => {
  const o = await openPage(browser, { w, h, lang, route });
  await o.page.waitForTimeout(wait);
  return o;
};
const has = async (page, sel) => (await page.locator(sel).count()) > 0;

// ---- home briefing writes itself, then Ask AI chips open the copilot
{
  const { ctx, page, log } = await visit('/', 0);
  await page.waitForSelector('[data-testid="briefing-steps"]', { timeout: 4000 }).then(() => check('home: briefing shows thinking steps', true)).catch(() => check('home: briefing shows thinking steps', false));
  await shot(page, 'home_1_steps');
  await page.waitForTimeout(3500);
  await shot(page, 'home_2_typing');
  await page.waitForTimeout(7000);
  await shot(page, 'home_3_done');
  const chips = await page.getByRole('button', { name: /Hormuz closure impact|أثر إغلاق هرمز/ }).count();
  check('home: briefing offers Ask-AI prompts', chips > 0);
  await page.getByRole('button', { name: /Hormuz closure impact|أثر إغلاق هرمز/ }).first().click();
  await page.waitForSelector('[data-testid="copilot"]');
  await page.waitForTimeout(9000);
  await shot(page, 'home_4_copilot');
  const t = await page.locator('[data-testid="copilot"]').innerText();
  check('copilot: answers the Hormuz question with live numbers', /AED|درهم/.test(t) && /\d/.test(t));
  check('home: console clean', log.errors.length + log.pageErrors.length === 0, JSON.stringify([...log.errors, ...log.pageErrors]).slice(0, 200));
  await ctx.close();
}

// ---- procurement scan
{
  const { ctx, page, log } = await visit('/procurement');
  await page.click('[data-testid="ai-scan-btn"]');
  await page.waitForTimeout(1500);
  await shot(page, 'proc_1_scan');
  await page.waitForSelector('[data-testid="ai-scan-results"]', { timeout: 15000 }).then(() => check('procurement: AI scan produces findings', true)).catch(() => check('procurement: AI scan produces findings', false));
  await shot(page, 'proc_2_results');
  check('procurement: console clean', log.errors.length + log.pageErrors.length === 0, JSON.stringify([...log.errors, ...log.pageErrors]).slice(0, 200));
  await ctx.close();
}

// ---- schedule analyst
{
  const { ctx, page, log } = await visit('/schedule');
  await page.click('[data-testid="ai-analyst-btn"]');
  await page.waitForTimeout(1200);
  await shot(page, 'sched_1_steps');
  await page.waitForSelector('[data-testid="ai-analyst-results"]', { timeout: 10000 }).then(() => check('schedule: AI analyst findings', true)).catch(() => check('schedule: AI analyst findings', false));
  await shot(page, 'sched_2_results');
  check('schedule: console clean', log.errors.length + log.pageErrors.length === 0, JSON.stringify([...log.errors, ...log.pageErrors]).slice(0, 200));
  await ctx.close();
}

// ---- twin scan
{
  const { ctx, page, log } = await visit('/twin');
  await page.waitForSelector('[data-testid="twin-ai-btn"]');
  await page.waitForTimeout(2500);
  await page.click('[data-testid="twin-ai-btn"]');
  await page.waitForTimeout(1200);
  await shot(page, 'twin_1_scan');
  await page.waitForTimeout(4500);
  await shot(page, 'twin_2_results');
  check('twin: AI panel shows findings', await has(page, '[data-testid="twin-ai-panel"]'));
  check('twin: console clean', log.errors.length + log.pageErrors.length === 0, JSON.stringify([...log.errors, ...log.pageErrors]).slice(0, 200));
  await ctx.close();
}

// ---- HSE CCTV
{
  const { ctx, page, log } = await visit('/hse');
  await page.getByRole('tab', { name: /CCTV|video analytics|الكاميرات|تحليلات الفيديو/ }).click();
  await page.waitForTimeout(1800);
  await shot(page, 'hse_1_cctv');
  await page.locator('[data-event="EV-1"] button').nth(1).click();
  await page.waitForTimeout(2600);
  await shot(page, 'hse_2_sop');
  check('hse: console clean', log.errors.length + log.pageErrors.length === 0, JSON.stringify([...log.errors, ...log.pageErrors]).slice(0, 200));
  await ctx.close();
}

// ---- docs
{
  const { ctx, page, log } = await visit('/docs');
  await page.getByRole('tab', { name: /Drawings|المخططات/ }).click();
  await page.click('[data-testid="ai-review-btn"]');
  await page.waitForTimeout(1500);
  await shot(page, 'docs_1_review');
  await page.waitForSelector('[data-testid="ai-review-findings"]', { timeout: 10000 }).then(() => check('docs: AI drawing review findings', true)).catch(() => check('docs: AI drawing review findings', false));
  await page.waitForTimeout(1800);
  await shot(page, 'docs_2_findings');
  await page.getByRole('tab', { name: /RFIs|طلبات المعلومات/ }).click();
  await page.waitForTimeout(500);
  await page.click('[data-testid="ai-rfi-RFI-030"]');
  await page.waitForSelector('[data-testid="ai-rfi-text"]', { timeout: 10000 }).then(() => check('docs: AI RFI draft', true)).catch(() => check('docs: AI RFI draft', false));
  await page.waitForTimeout(3500);
  await shot(page, 'docs_3_rfi');
  check('docs: console clean', log.errors.length + log.pageErrors.length === 0, JSON.stringify([...log.errors, ...log.pageErrors]).slice(0, 200));
  await ctx.close();
}

// ---- reports + Sia
{
  const { ctx, page, log } = await visit('/reports');
  const href = await page.getAttribute('[data-testid="sia-link"]', 'href');
  check('reports: Sia button points at S!a Excel-lence', href === 'https://sia-xcel.demo.holasia.ai/login', href || '');
  check('reports: Sia opens in a new tab safely', (await page.getAttribute('[data-testid="sia-link"]', 'target')) === '_blank' && /noopener/.test((await page.getAttribute('[data-testid="sia-link"]', 'rel')) || ''));
  await page.click('[data-testid="ai-summary-btn"]');
  await page.waitForSelector('[data-testid="ai-summary-text"]', { timeout: 10000 }).then(() => check('reports: AI summary generates', true)).catch(() => check('reports: AI summary generates', false));
  await page.waitForTimeout(4000);
  await shot(page, 'reports_1');
  check('reports: console clean', log.errors.length + log.pageErrors.length === 0, JSON.stringify([...log.errors, ...log.pageErrors]).slice(0, 200));
  await ctx.close();
}

await browser.close();
const bad = results.filter((r) => !r.ok);
console.log(`\n${results.length - bad.length}/${results.length} checks passed`);
process.exit(bad.length ? 1 : 0);
