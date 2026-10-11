// screenshot the twin from an arbitrary camera. usage: node scripts/cam.mjs name viewT px,py,pz tx,ty,tz [WxH] [lang]
import { launch, openPage, outDir } from './lib.mjs';
const [name, viewT, pos, target, size = '1600x900', lang = 'en'] = process.argv.slice(2);
const [w, h] = size.split('x').map(Number);
const browser = await launch();
const { page, log } = await openPage(browser, { w, h, lang, route: '/twin' });
await page.waitForTimeout(6000);
await page.evaluate(([v, pos, target]) => {
  window.__customCam = { pos: pos.split(',').map(Number), target: target.split(',').map(Number) };
  const tw = window.__twin.getState();
  tw.patch({ incidentOpen: false });
  tw.setViewT(v === 'now' ? null : Number(v));
  tw.patch({ preset: { name: 'custom', nonce: tw.preset.nonce + 1 } });
}, [viewT, pos, target]);
await page.waitForTimeout(5000);
await page.screenshot({ path: `${outDir('cam')}/${name}.png` });
console.log(JSON.stringify({ errors: log.errors, pageErrors: log.pageErrors }));
await browser.close();
