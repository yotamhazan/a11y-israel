/**
 * End-to-end test of the Israeli vanilla-cookieconsent setup in a real Chromium.
 *   CHROME_PATH="C:/Program Files/Google/Chrome/Application/chrome.exe" node tests/cookies.test.mjs
 */
import { chromium } from 'playwright';
import { startServer } from './serve.mjs';

const server = await startServer();
const URL_ = server.url + '/tests/fixtures/cookies.html';
let failures = 0;
const check = (name, ok, extra = '') => {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (extra && !ok ? '  ' + extra : ''));
  if (!ok) failures++;
};

const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
// The config uses hideFromBots, which hides the banner from automated browsers; look like a person.
await ctx.addInitScript(() => Object.defineProperty(navigator, 'webdriver', { get: () => false }));
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));

await page.goto(URL_);
const banner = page.getByRole('dialog', { name: 'הסכמה לעוגיות' });
await banner.waitFor();
check('Hebrew banner shown on first visit', await banner.isVisible());
check('banner is RTL', await page.evaluate(() => document.getElementById('cc-main').classList.contains('cc--rtl')));
const ran = () => page.evaluate(() => ({ a: !!window.analyticsRan, m: !!window.marketingRan }));
check('no tracker runs before consent', JSON.stringify(await ran()) === '{"a":false,"m":false}');
const gcm = await page.evaluate(() => window.dataLayer.find((e) => e[0] === 'consent' && e[1] === 'default')?.[2]);
check('Google Consent Mode defaults to denied', gcm?.ad_storage === 'denied' && gcm?.analytics_storage === 'denied', JSON.stringify(gcm));

// Refusing is as easy as agreeing: both are primary-weight buttons in the first layer.
const btns = await banner.getByRole('button').allInnerTexts();
check('accept and necessary-only both in first layer', btns.includes('אישור הכול') && btns.includes('רק הכרחיות'), btns.join('|'));
const weights = await page.evaluate(() =>
  [...document.querySelectorAll('#cc-main .cm__btn')].map((b) => getComputedStyle(b).backgroundColor),
);
check('accept / reject buttons have equal weight', weights[0] === weights[1], weights.join(' vs '));

await banner.getByRole('button', { name: 'רק הכרחיות' }).click();
check('necessary-only keeps trackers off', JSON.stringify(await ran()) === '{"a":false,"m":false}');
await page.reload();
check('choice remembered (no banner after reload)', !(await page.getByRole('dialog', { name: 'הסכמה לעוגיות' }).isVisible()));

// Footer link reopens the preferences; choose analytics only.
await page.getByRole('button', { name: 'הגדרות עוגיות' }).click();
const prefs = page.getByRole('dialog', { name: 'הגדרות עוגיות' });
await prefs.waitFor();
check('footer link opens preferences', await prefs.isVisible());
await prefs.getByRole('checkbox', { name: /סטטיסטיקה/ }).check({ force: true });
await prefs.getByRole('button', { name: 'שמירת הבחירה' }).click();
await page.waitForTimeout(200);
check('analytics runs only after consent, marketing still off', JSON.stringify(await ran()) === '{"a":true,"m":false}', JSON.stringify(await ran()));
const upd = await page.evaluate(() => window.dataLayer.filter((e) => e[0] === 'consent' && e[1] === 'update').pop()?.[2]);
check('Consent Mode updated', upd?.analytics_storage === 'granted' && upd?.ad_storage === 'denied', JSON.stringify(upd));

// Withdrawal clears tracker cookies.
await page.evaluate(() => (document.cookie = '_ga=GA1.1.123; path=/'));
await page.getByRole('button', { name: 'הגדרות עוגיות' }).click();
await prefs.getByRole('button', { name: 'רק הכרחיות' }).click();
await page.waitForLoadState('load');
await page.waitForTimeout(600);
check('withdrawing consent clears _ga', !(await page.evaluate(() => document.cookie)).includes('_ga='), await page.evaluate(() => document.cookie));

// Keyboard: Esc closes preferences.
await page.getByRole('button', { name: 'הגדרות עוגיות' }).focus();
await page.keyboard.press('Enter');
await prefs.waitFor();
await page.keyboard.press('Escape');
await page.waitForTimeout(300);
check('Esc closes preferences', !(await prefs.isVisible()));
check('no page errors', errors.length === 0, errors.join(' | '));

await browser.close();
server.close();
console.log(failures ? `\n${failures} FAILED` : '\nALL PASSED');
process.exit(failures ? 1 : 0);
