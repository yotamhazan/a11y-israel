/**
 * End-to-end test of the accessibility menu in a real Chromium.
 *   npm install && npx playwright install chromium && npm test
 * or point CHROME_PATH at an installed Chrome:  CHROME_PATH="C:/Program Files/Google/Chrome/Application/chrome.exe" npm test
 */
import { chromium } from 'playwright';
import { startServer } from './serve.mjs';

const OUT = process.env.SCREENSHOT_DIR || new URL('./screenshots/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const server = await startServer();
const BASE = server.url;
const W = '/plugins/a11y-israel/skills/israel-web-compliance/assets/a11y-widget';
let failures = 0;
const check = (name, ok, extra = '') => {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (extra && !ok ? '  ' + extra : ''));
  if (!ok) failures++;
};

const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => {
  if (m.type() === 'error' && !m.location().url.endsWith('/favicon.ico')) errors.push(m.text());
});

await page.goto(BASE + W + '/demo.html');
await page.waitForFunction(() => window.A11yWidget);
const cls = () => page.evaluate(() => document.documentElement.className);
const active = () =>
  page.evaluate(() => {
    let a = document.activeElement;
    while (a && a.shadowRoot && a.shadowRoot.activeElement) a = a.shadowRoot.activeElement;
    return a ? a.getAttribute('aria-label') || a.textContent.trim() || a.tagName : null;
  });

// skip link
await page.keyboard.press('Tab');
const skip = await page.evaluate(() => {
  const a = document.activeElement;
  return { t: a.textContent, top: a.getBoundingClientRect().top };
});
check('Tab shows skip link', skip.t === 'דילוג לתוכן הראשי' && skip.top >= 0, JSON.stringify(skip));
await page.keyboard.press('Enter');
check('skip link focuses main', await page.evaluate(() => document.activeElement.tagName === 'MAIN'));

// open via click
await page.getByRole('button', { name: 'תפריט נגישות' }).click();
check('panel opens', await page.getByRole('dialog', { name: 'התאמות נגישות' }).isVisible());
check('focus moves to close button', (await active()) === 'סגירת תפריט הנגישות', await active());
await page.screenshot({ path: OUT + '/w_open.png' });

// every toggle
const toggles = {
  'גופן קריא': 'a11yw-readable-font',
  'ריווח שורות': 'a11yw-line-spacing',
  'ריווח אותיות': 'a11yw-letter-spacing',
  'הדגשת קישורים': 'a11yw-highlight-links',
  'הדגשת כותרות': 'a11yw-highlight-headings',
  'ניווט מקלדת מודגש': 'a11yw-keyboard-focus',
  'עצירת אנימציות': 'a11yw-stop-animations',
  'סמן עכבר גדול': 'a11yw-big-cursor',
  'סרגל קריאה': 'a11yw-reading-guide',
};
for (const [label, c] of Object.entries(toggles)) {
  const b = page.getByRole('button', { name: label, exact: true });
  await b.click();
  const on = (await cls()).includes(c) && (await b.getAttribute('aria-pressed')) === 'true';
  const focusKept = (await active()) === label;
  await b.click();
  const off = !(await cls()).includes(c);
  check('toggle ' + label, on && off && focusKept, `on=${on} off=${off} focus=${focusKept}`);
}

// contrast modes are exclusive
for (const [label, mode] of [
  ['ניגודיות כהה', 'dark'],
  ['ניגודיות בהירה', 'light'],
  ['היפוך צבעים', 'invert'],
  ['שחור-לבן', 'monochrome'],
]) {
  await page.getByRole('button', { name: label, exact: true }).click();
  const c = await cls();
  const n = (c.match(/a11yw-contrast-/g) || []).length;
  check('contrast ' + mode, c.includes('a11yw-contrast-' + mode) && n === 1, c);
  if (mode === 'dark') await page.screenshot({ path: OUT + '/w_dark.png' });
  if (mode === 'invert') {
    const ok = await page
      .getByRole('button', { name: 'הדגשת קישורים', exact: true })
      .click({ timeout: 3000 })
      .then(
        () => true,
        () => false,
      );
    check('panel clickable in invert mode', ok);
    await page.screenshot({ path: OUT + '/w_invert.png' });
    if (ok) await page.getByRole('button', { name: 'הדגשת קישורים', exact: true }).click();
  }
}
await page.getByRole('button', { name: 'שחור-לבן', exact: true }).click();
check('clicking the active contrast turns it off', !(await cls()).includes('a11yw-contrast-'));

// text size
for (let i = 0; i < 6; i++) {
  const b = page.getByRole('button', { name: 'הגדלת הטקסט' });
  if (await b.isDisabled()) break;
  await b.click();
}
const fs = await page.evaluate(() => document.documentElement.style.fontSize);
check('text scales to 200% max', fs === '200%', fs);
check(
  'larger disabled at max, focus moved to smaller',
  (await page.getByRole('button', { name: 'הגדלת הטקסט' }).isDisabled()) && (await active()) === 'הקטנת הטקסט',
  await active(),
);
await page.screenshot({ path: OUT + '/w_200.png' });

const status = await page.evaluate(
  () =>
    new Promise((r) =>
      setTimeout(() => r(document.getElementById('a11yw-host').shadowRoot.querySelector('[role=status]').textContent), 100),
    ),
);
check('change announced to screen readers', status.includes('200%'), status);

// persistence
await page.getByRole('button', { name: 'ניגודיות כהה', exact: true }).click();
await page.reload();
await page.waitForFunction(() => window.A11yWidget);
const c2 = await cls();
check(
  'preferences persist after reload',
  c2.includes('a11yw-contrast-dark') && (await page.evaluate(() => document.documentElement.style.fontSize)) === '200%',
  c2,
);
check('launcher shows active count', (await page.getByRole('button', { name: /תפריט נגישות \(2 התאמות פעילות\)/ }).count()) === 1);

// Alt+A, Escape, outside click
await page.keyboard.press('Alt+KeyA');
check('Alt+A opens', await page.getByRole('dialog').isVisible());
await page.keyboard.press('Escape');
check(
  'Escape closes and returns focus to launcher',
  !(await page.getByRole('dialog').isVisible()) && (await active()).startsWith('תפריט נגישות'),
  await active(),
);
await page.keyboard.press('Alt+KeyA');
await page.mouse.click(640, 300);
check('outside click closes', !(await page.getByRole('dialog').isVisible()));

// reset
await page.keyboard.press('Alt+KeyA');
await page.getByRole('button', { name: 'איפוס' }).click();
check(
  'reset clears everything',
  (await cls()) === '' &&
    (await page.evaluate(() => document.documentElement.style.fontSize)) === '' &&
    (await page.evaluate(() => localStorage.getItem('a11yw_prefs'))) === null,
);
check('statement link in panel', (await page.getByRole('dialog').getByRole('link', { name: 'הצהרת נגישות' }).count()) === 1);

// SPA language switch
await page.evaluate(() => {
  document.documentElement.lang = 'en';
  document.documentElement.dir = 'ltr';
});
await page.waitForTimeout(50);
check(
  'follows <html lang> change',
  (await page.getByRole('button', { name: 'Accessibility menu', exact: true }).count()) === 1 &&
    (await page.getByRole('dialog', { name: 'Accessibility adjustments' }).isVisible()),
);
check('no page errors', errors.length === 0, errors.join(' | '));

// English page + invalid config fallback
const p2 = await ctx.newPage();
const warns = [];
p2.on('console', (m) => {
  if (m.type() === 'warning') warns.push(m.text());
});
await p2.goto(BASE + '/tests/fixtures/en.html');
await p2.waitForFunction(() => window.A11yWidget);
const box = await p2.getByRole('button', { name: 'Accessibility menu', exact: true }).boundingBox();
check('English launcher on the left (start)', box.x < 100, JSON.stringify(box));
check('unknown icon style rejected with warning', warns.some((w) => w.includes('unknown icon-style')), warns.join(' | '));
check('size under 44 clamped with warning', warns.some((w) => w.includes('below 44px')) && Math.round(box.width) === 44, JSON.stringify(box));
await p2.getByRole('button', { name: 'Accessibility menu', exact: true }).click();
await p2.screenshot({ path: OUT + '/w_en.png' });

// icon styles, sizes and positions
const styles = { 'blue-white': ['rgb(21, 79, 146)', 'rgb(255, 255, 255)'], 'white-blue': ['rgb(255, 255, 255)', 'rgb(21, 79, 146)'], 'black-white': ['rgb(0, 0, 0)', 'rgb(255, 255, 255)'], 'white-black': ['rgb(255, 255, 255)', 'rgb(0, 0, 0)'] };
const sizes = { small: 44, medium: 56, large: 68 };
const positions = ['top-right', 'top-left', 'middle-right', 'middle-left', 'bottom-right', 'bottom-left'];
const VW = 1280, VH = 860;
const combos = [];
for (const st of Object.keys(styles)) combos.push([st, 'medium', 'bottom-right']);
for (const sz of Object.keys(sizes)) combos.push(['blue-white', sz, 'bottom-left']);
for (const pos of positions) combos.push(['white-blue', 'large', pos]);
const p4 = await ctx.newPage();
for (const [st, sz, pos] of combos) {
  await p4.goto(`${BASE}/tests/fixtures/config.html?style=${st}&size=${sz}&pos=${pos}`);
  await p4.waitForFunction(() => window.A11yWidget);
  const info = await p4.evaluate(() => {
    const b = document.getElementById('a11yw-host').shadowRoot.querySelector('.launcher');
    const cs = getComputedStyle(b);
    const r = b.getBoundingClientRect();
    return { color: cs.color, bg: cs.backgroundColor, x: r.x, y: r.y, w: r.width, h: r.height };
  });
  const [fg, bg] = styles[st];
  const okColor = info.color === fg && info.bg === bg;
  const okSize = Math.round(info.w) === sizes[sz];
  const [v, h] = pos.split('-');
  const okH = h === 'right' ? Math.round(VW - (info.x + info.w)) === 16 : Math.round(info.x) === 16;
  const okV = v === 'top' ? Math.round(info.y) === 24 : v === 'bottom' ? Math.round(VH - (info.y + info.h)) === 24 : Math.abs(info.y + info.h / 2 - VH / 2) < 2;
  // the panel must open fully on screen next to/above/below the launcher
  await p4.getByRole('button', { name: 'תפריט נגישות', exact: true }).click();
  const pb = await p4.getByRole('dialog').boundingBox();
  const okPanel = pb.x >= 0 && pb.y >= 0 && pb.x + pb.width <= VW && pb.y + pb.height <= VH;
  check(`config ${st} / ${sz} / ${pos}`, okColor && okSize && okH && okV && okPanel, JSON.stringify({ info, pb }));
  if (pos === 'middle-left') await p4.screenshot({ path: OUT + '/w_middle_left.png' });
}

// configurator
const p5 = await ctx.newPage();
await p5.goto(BASE + W + '/configurator.html');
await p5.getByLabel('לבן על שחור').check();
await p5.getByLabel('גדול (68px)').check();
await p5.getByLabel('למעלה משמאל').check();
await p5.waitForTimeout(300);
const snip = await p5.locator('#snippet').inputValue();
check('configurator snippet reflects choices', snip.includes('data-icon-style="white-black"') && snip.includes('data-size="large"') && snip.includes('data-position="top-left"') && snip.includes('data-statement-url="/accessibility"'), snip);
const fr = p5.frameLocator('#frame');
const lb = await fr.getByRole('button', { name: 'תפריט נגישות', exact: true }).boundingBox();
const frameBox = await p5.locator('#frame').boundingBox();
check('configurator preview shows the chosen position', lb && Math.round(lb.x - frameBox.x) === 16 && Math.round(lb.y - frameBox.y) === 24 && Math.round(lb.width) === 68, JSON.stringify({ lb, frameBox }));
await fr.getByRole('button', { name: 'תפריט נגישות', exact: true }).click();
await p5.screenshot({ path: OUT + '/w_configurator.png', fullPage: true });

// mobile
const m = await browser.newContext({ viewport: { width: 375, height: 740 }, isMobile: true, hasTouch: true });
const p3 = await m.newPage();
await p3.goto(BASE + W + '/demo.html');
await p3.waitForFunction(() => window.A11yWidget);
await p3.getByRole('button', { name: 'תפריט נגישות' }).tap();
const pb = await p3.getByRole('dialog').boundingBox();
check('mobile panel fits the screen', pb.x >= 0 && pb.x + pb.width <= 375 && pb.y >= 0, JSON.stringify(pb));
await p3.screenshot({ path: OUT + '/w_mobile.png' });

await browser.close();
server.close();
console.log(failures ? `\n${failures} FAILED` : '\nALL PASSED');
process.exit(failures ? 1 : 0);
