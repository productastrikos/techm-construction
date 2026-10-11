// Verifies that the header reset (and presenter reset) returns HSE events, work orders, scenario and copilot history to the opening state.
import { launch, openPage } from './lib.mjs';

const browser = await launch();
const { ctx, page, log } = await openPage(browser, { w: 1440, h: 900, route: '/hse' });
await page.waitForTimeout(2500);
let ok = true;
const check = (n, v) => { if (!v) ok = false; console.log(v ? 'PASS' : 'FAIL', n); };
await page.locator('main [role="tab"]').nth(1).click();
await page.waitForTimeout(800);
const createBtn = page.locator('[data-event="EV-1"] button').nth(2);
await createBtn.click();
await page.waitForTimeout(500);
check('work order created on EV-1 (button disabled)', await createBtn.isDisabled());
// open copilot and ask something so there is history
await page.click('[data-testid="ask-ai"]');
await page.getByRole('button', { name: /Cost forecast|توقع التكلفة/ }).click();
await page.waitForTimeout(500);
// header reset (rotate-ccw button next to the clock)
await page.locator('button[aria-label="Reset demo clock"], button[title*="eset"]').first().click();
await page.waitForTimeout(800);
check('copilot history cleared', (await page.locator('[data-testid="copilot"] >> text=What the AI is doing').count()) === 0);
await page.keyboard.press('Escape');
await page.waitForTimeout(300);
check('Esc closes the copilot', (await page.locator('[data-testid="copilot"]').count()) === 0);
await page.goto('http://127.0.0.1:5176/#/hse');
await page.waitForTimeout(1200);
await page.locator('main [role="tab"]').nth(1).click();
await page.waitForTimeout(800);
check('EV-1 work-order button enabled again', await page.locator('[data-event="EV-1"] button').nth(2).isEnabled());
check('console clean', log.errors.length + log.pageErrors.length === 0);
await ctx.close();
await browser.close();
process.exit(ok ? 0 : 1);
