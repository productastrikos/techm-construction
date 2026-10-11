// draw-call / triangle / frame-time probe for the twin (SwiftShader numbers are NOT GPU fps; calls+tris are what matter)
import { launch, openPage } from './lib.mjs';
const browser = await launch();
const { ctx, page } = await openPage(browser, { w: 1366, h: 768, route: '/twin?perf' });
await page.waitForTimeout(5000);
for (const [name, v] of [['mid-2027', 330], ['end-2029', 860]]) {
  await page.evaluate((v) => window.__twin.getState().setViewT(v), v);
  await page.waitForTimeout(4000);
  const t = await page.locator('[data-testid="perf"]').innerText().catch(() => 'n/a');
  console.log(name, t);
}
const fps = await page.evaluate(() => new Promise((res) => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 > 3000) res(n / 3); else requestAnimationFrame(f); }; requestAnimationFrame(f); }));
console.log('rAF fps in SwiftShader (software GL, lower bound):', fps.toFixed(1));
await browser.close();
