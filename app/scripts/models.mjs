// focus each manifest model and screenshot it (QA of orientation / scale / tint). usage: node scripts/models.mjs
import { launch, openPage, outDir } from './lib.mjs';
const ids = process.argv[2] ? process.argv[2].split(',') : ['sts-crane','crawler-crane','container-ship','dredger','dump-truck','excavator','tower-crane','tug','reach-stacker','concrete-mixer','piling-rig','worker','harbour-crane','straddle-carrier'];
const browser = await launch();
const { ctx, page, log } = await openPage(browser, { w: 1280, h: 720, route: '/models' });
await page.waitForTimeout(3000);
const dir = outDir('models');
for (const id of ids) {
  await page.evaluate((id) => document.querySelector(`[data-testid="m-${id}"]`)?.click(), id);
  await page.waitForTimeout(1400);
  await page.locator('canvas').first().screenshot({ path: `${dir}/${id}.png` });
}
console.log(JSON.stringify({ errors: log.errors, pageErrors: log.pageErrors }));
await browser.close();
