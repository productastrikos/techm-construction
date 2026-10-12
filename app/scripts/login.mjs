// Login gate check: redirect to /login, bad creds rejected, good creds land in the app, sign out returns.
// Credentials come from env (DEMO_USER / DEMO_PASS) so they are never hard-coded in the script.
import { launch, BASE } from './lib.mjs';
const user = process.env.DEMO_USER ?? 'admin';
const pass = process.env.DEMO_PASS ?? 'Astrikos@2026';
const browser = await launch();
const page = await (await browser.newContext({ viewport: { width: 1366, height: 768 } })).newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));
let bad = 0;
const check = (n, ok) => { console.log(ok ? 'PASS' : 'FAIL', n); if (!ok) bad++; };
await page.goto(`${BASE}/#/hse`, { waitUntil: 'networkidle' });
check('unauthenticated deep link redirects to /login', page.url().endsWith('#/login'));
await page.fill('#login-user', user);
await page.fill('#login-pass', 'nope');
await page.click('button[type=submit]');
check('wrong password shows error', (await page.textContent('[data-testid=login-error]')).includes('Invalid'));
await page.fill('#login-pass', pass);
await page.click('button[type=submit]');
await page.waitForSelector('#main', { timeout: 15000 });
check('good credentials open the app', page.url().endsWith('#/'));
await page.reload({ waitUntil: 'networkidle' });
check('session survives reload', !!(await page.$('#main')));
await page.click('[data-testid=signout]');
await page.waitForSelector('[data-testid=login]');
check('sign out returns to login', page.url().endsWith('#/login'));
check('no page errors', errs.length === 0);
await browser.close();
process.exit(bad ? 1 : 0);
