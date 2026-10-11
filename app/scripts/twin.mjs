// twin screenshots at several view dates / modes / cameras. usage: node scripts/twin.mjs [lang] [WxH] [only]
import { launch, openPage, outDir } from './lib.mjs';
const lang = process.argv[2] || 'en';
const [w, h] = (process.argv[3] || '1366x768').split('x').map(Number);
const only = process.argv[4];
const browser = await launch();
const { ctx, page, log } = await openPage(browser, { w, h, lang, route: '/twin' });
await page.waitForTimeout(6000);
const dir = outDir('twin');
const shots = [
  // name, viewT (number | 'now' | 'end'), mode, camera
  ['now', 'now', 'realistic', 'overview'],
  ['mid', 330, 'realistic', 'overview'],
  ['quaymid', 330, 'realistic', 'quay'],
  ['casting', 300, 'realistic', 'castingYard'],
  ['end', 860, 'realistic', 'overview'],
  ['endyard', 860, 'realistic', 'yard'],
  ['progress', 330, 'progress', 'overview'],
  ['material', 330, 'material', 'overview'],
  ['health', 85, 'health', 'castingYard'],
  ['hse', 700, 'hse', 'quay'],
];
for (const [name, v, mode, cam] of shots) {
  if (only && name !== only) continue;
  await page.evaluate(([v, mode, cam]) => {
    const tw = window.__twin.getState();
    const app = window.__app.getState();
    tw.setViewT(v === 'now' ? null : v);
    app.setColorMode(mode);
    tw.patch({ preset: { name: cam, nonce: tw.preset.nonce + 1 } });
  }, [v, mode, cam]);
  await page.waitForTimeout(4200);
  await page.screenshot({ path: `${dir}/${name}_${lang}_${w}x${h}.png` });
}
console.log(JSON.stringify({ errors: log.errors, pageErrors: log.pageErrors }));
await browser.close();
