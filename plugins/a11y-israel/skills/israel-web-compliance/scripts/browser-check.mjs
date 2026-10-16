#!/usr/bin/env node
/**
 * a11y-israel browser check: opens a running site in a real Chromium and checks what static scanning
 * cannot — trackers and cookies before consent, keyboard focus, 320px reflow, axe-core rules — and
 * saves screenshots.
 *
 *   node browser-check.mjs <base-url> [--pages /,/contact,/privacy] [--out <dir>] [--json]
 *
 * Needs `playwright` (and optionally `axe-core`) resolvable from the project, or from a folder given
 * in A11Y_DEPS (e.g. `npm i --prefix "$TMP/a11y-deps" playwright@1.49.1 axe-core@4.10.2`).
 * Browser: CHROME_PATH, else installed Chrome / Edge, else Playwright's own Chromium.
 */
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const TRACKER_HOSTS = [
  ['Google Analytics / Tag Manager', /google-analytics\.com|googletagmanager\.com|analytics\.google\.com/],
  ['Google Ads / DoubleClick', /googleadservices\.com|doubleclick\.net|googlesyndication\.com/],
  ['Meta Pixel', /connect\.facebook\.net|facebook\.com\/tr/],
  ['TikTok Pixel', /analytics\.tiktok\.com/],
  ['LinkedIn Insight', /snap\.licdn\.com|px\.ads\.linkedin\.com/],
  ['Microsoft Clarity', /clarity\.ms/],
  ['Microsoft Ads', /bat\.bing\.com/],
  ['Hotjar', /hotjar\.com|hotjar\.io/],
  ['PostHog', /posthog\.com/],
  ['Mixpanel', /mixpanel\.com|mxpnl\.com/],
  ['Segment', /segment\.(com|io)/],
  ['Pinterest', /pinimg\.com\/ct|ct\.pinterest\.com/],
  ['Taboola / Outbrain', /taboola\.com|outbrain\.com/],
];
const TRACKER_COOKIES = /^(_ga|_gid|_gat|_gcl_|_fbp|_fbc|_hj|_clck|_clsk|_uet|_tt_|_ttp|ttcid|ph_|mp_|_pin_|_scid|li_|ajs_)/;

function loadDeps() {
  const bases = [process.env.A11Y_DEPS && join(process.env.A11Y_DEPS, 'package.json'), join(process.cwd(), 'package.json'), fileURLToPath(import.meta.url)].filter(Boolean);
  let playwright = null;
  let axeSource = null;
  for (const b of bases) {
    const req = createRequire(b);
    if (!playwright) try { playwright = req('playwright'); } catch { /* try next */ }
    if (!axeSource) try { axeSource = req('axe-core').source; } catch { /* optional */ }
  }
  return { playwright, axeSource };
}

async function launch(chromium) {
  if (process.env.CHROME_PATH) return chromium.launch({ executablePath: process.env.CHROME_PATH });
  for (const channel of ['chrome', 'msedge']) {
    try {
      return await chromium.launch({ channel });
    } catch { /* not installed */ }
  }
  return chromium.launch();
}

export async function check(baseUrl, pages, outDir) {
  const { playwright, axeSource } = loadDeps();
  if (!playwright) throw new Error('playwright not found. Install it: npm i --prefix "<dir>" playwright@1.49.1 axe-core@4.10.2, then set A11Y_DEPS=<dir>');
  mkdirSync(outDir, { recursive: true });
  const browser = await launch(playwright.chromium);
  const results = [];

  for (const path of pages) {
    const url = new URL(path, baseUrl).href;
    const slug = path.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '') || 'home';
    const r = { path, url, findings: [], screenshots: [] };
    const push = (id, sev, title, detail) => r.findings.push({ id, sev, title, detail });

    // 1. A fresh visitor who has not consented: what loads, what gets stored.
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, locale: 'he-IL' });
    // Consent banners often hide themselves from automated browsers; look like a person so it shows.
    await ctx.addInitScript(() => Object.defineProperty(navigator, 'webdriver', { get: () => false }));
    const page = await ctx.newPage();
    const trackerRequests = new Set();
    page.on('request', (req) => {
      for (const [name, re] of TRACKER_HOSTS) if (re.test(req.url())) trackerRequests.add(name);
    });
    try {
      await page.goto(url, { waitUntil: 'load', timeout: 30000 });
      await page.waitForTimeout(2500);
    } catch (e) {
      push('browser/unreachable', 'blocking', 'העמוד לא נטען', e.message.split('\n')[0]);
      results.push(r);
      await ctx.close();
      continue;
    }
    if (trackerRequests.size) push('privacy/tracker-before-consent', 'blocking', 'כלי מעקב נטען לפני שהגולש הסכים', [...trackerRequests].join(', '));
    const cookies = (await ctx.cookies()).filter((c) => TRACKER_COOKIES.test(c.name)).map((c) => c.name);
    if (cookies.length) push('privacy/cookie-before-consent', 'blocking', 'עוגיות מעקב נשמרות לפני הסכמה', [...new Set(cookies)].join(', '));

    const basics = await page.evaluate(() => ({
      lang: document.documentElement.getAttribute('lang'),
      title: document.title.trim(),
      h1: document.querySelectorAll('h1').length,
      main: !!document.querySelector('main, [role=main]'),
      banner: !!document.querySelector('#cc-main .cm, #cc-main [role=dialog]'),
    }));
    if (!basics.lang) push('a11y/html-lang', 'important', 'אין lang לעמוד');
    if (!basics.title) push('a11y/title', 'important', 'אין <title> לעמוד (2.4.2)');
    if (basics.h1 !== 1) push('a11y/h1-count', basics.h1 === 0 ? 'important' : 'recommended', 'מספר כותרות H1: ' + basics.h1);
    if (!basics.main) push('a11y/no-main', 'important', 'אין אזור <main> (2.4.1)');

    const shot = join(outDir, slug + '-desktop.png');
    await page.screenshot({ path: shot });
    r.screenshots.push(shot);

    // Dismiss the cookie banner (necessary only) so it does not cover what we test next.
    const reject = page.locator('#cc-main [data-role="necessary"]').first();
    if (await reject.count()) {
      await reject.click().catch(() => {});
      // Wait until the banner has fully faded out: mid-transition it is half transparent, which axe
      // reports as low contrast, and it still holds keyboard focus.
      await page.waitForFunction(() => !document.documentElement.classList.contains('show--consent'), null, { timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(600);
    }

    // 2. axe-core (WCAG 2.0 A/AA = SI 5568 basis, plus heading rules that Israel raised to AA).
    if (axeSource) {
      await page.addScriptTag({ content: axeSource });
      const axe = await page.evaluate(async () => {
        const res = await window.axe.run(document, {
          runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] },
          resultTypes: ['violations'],
        });
        const extra = await window.axe.run(document, { runOnly: { type: 'rule', values: ['heading-order', 'page-has-heading-one', 'landmark-one-main', 'region'] }, resultTypes: ['violations'] });
        return [...res.violations, ...extra.violations].map((v) => ({ id: v.id, impact: v.impact, help: v.help, count: v.nodes.length, sample: v.nodes.slice(0, 3).map((n) => n.target.join(' ')) }));
      });
      for (const v of axe) push('axe/' + v.id, v.impact === 'critical' || v.impact === 'serious' ? 'important' : 'recommended', v.help + ' (' + v.count + ')', v.sample.join(' | '));
    } else {
      r.notes = (r.notes || []).concat('axe-core לא מותקן — לא הורצה בדיקת axe');
    }

    // 3. Keyboard: walk the page with Tab and look for focus you cannot see.
    const invisible = new Set();
    let firstFocus = null;
    await page.evaluate(() => { document.activeElement && document.activeElement.blur(); window.scrollTo(0, 0); });
    for (let i = 0; i < 40; i++) {
      await page.keyboard.press('Tab');
      const info = await page.evaluate(() => {
        let a = document.activeElement;
        while (a && a.shadowRoot && a.shadowRoot.activeElement) a = a.shadowRoot.activeElement;
        if (!a || a === document.body) return null;
        const cs = getComputedStyle(a);
        const visible = (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) || cs.boxShadow !== 'none';
        const label = (a.getAttribute('aria-label') || a.textContent || a.getAttribute('name') || a.tagName).trim().replace(/\s+/g, ' ').slice(0, 40);
        return { tag: a.tagName.toLowerCase(), label, visible, text: (a.textContent || '').trim() };
      });
      if (!info) continue;
      if (!firstFocus) firstFocus = info;
      if (!info.visible) invisible.add(info.tag + ' "' + info.label + '"');
    }
    if (invisible.size) push('a11y/focus-invisible', 'important', 'רכיבים שהפוקוס עליהם לא נראה (2.4.7)', [...invisible].slice(0, 8).join(' | '));
    if (firstFocus && !/דילוג|skip/i.test(firstFocus.text)) push('a11y/skip-link', 'recommended', 'הרכיב הראשון ב-Tab אינו "דילוג לתוכן" (2.4.1)', firstFocus.label);
    await ctx.close();

    // 4. Reflow at 320px (1.4.4 / mobile) + mobile screenshot.
    const m = await browser.newContext({ viewport: { width: 320, height: 640 }, isMobile: true, hasTouch: true, locale: 'he-IL' });
    await m.addInitScript(() => Object.defineProperty(navigator, 'webdriver', { get: () => false }));
    const mp = await m.newPage();
    await mp.goto(url, { waitUntil: 'load', timeout: 30000 }).catch(() => {});
    await mp.waitForTimeout(800);
    const overflow = await mp.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (overflow > 2) push('a11y/reflow-320', 'important', 'גלילה אופקית ברוחב 320px', overflow + 'px');
    const mshot = join(outDir, slug + '-mobile.png');
    await mp.screenshot({ path: mshot });
    r.screenshots.push(mshot);
    await m.close();

    results.push(r);
  }
  await browser.close();
  const summary = { blocking: 0, important: 0, recommended: 0 };
  for (const r of results) for (const f of r.findings) summary[f.sev]++;
  return { tool: 'a11y-israel/browser-check', baseUrl, axe: !!loadDeps().axeSource, summary, pages: results };
}

function format(res) {
  const out = ['a11y-israel browser check — ' + res.baseUrl + (res.axe ? '' : '  (בלי axe-core)'), 'סיכום: ' + res.summary.blocking + ' חוסמים · ' + res.summary.important + ' חשובים · ' + res.summary.recommended + ' מומלצים'];
  for (const p of res.pages) {
    out.push('', '== ' + p.path);
    if (!p.findings.length) out.push('  לא נמצאו בעיות בבדיקות שהורצו');
    for (const f of p.findings) out.push('- [' + f.sev + '] ' + f.title + (f.detail ? ' — ' + f.detail : '') + '  · ' + f.id);
    for (const s of p.screenshots) out.push('  צילום: ' + s);
    for (const n of p.notes || []) out.push('  הערה: ' + n);
  }
  out.push('', 'לא נבדק: קורא מסך אמיתי, תוכן אחרי התחברות, PDF. ניגודיות נבדקת רק אם axe-core מותקן.');
  return out.join('\n');
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const args = process.argv.slice(2);
  const base = args.find((a) => /^https?:\/\//.test(a));
  if (!base) {
    console.error('usage: node browser-check.mjs <base-url> [--pages /,/contact] [--out dir] [--json]');
    process.exit(2);
  }
  const get = (flag, def) => (args.indexOf(flag) !== -1 ? args[args.indexOf(flag) + 1] : def);
  const pages = get('--pages', '/').split(',').map((s) => s.trim()).filter(Boolean);
  const outDir = resolve(get('--out', 'a11y-israel-report'));
  try {
    const res = await check(base, pages, outDir);
    writeFileSync(join(outDir, 'browser-check.json'), JSON.stringify(res, null, 2));
    console.log(args.includes('--json') ? JSON.stringify(res, null, 2) : format(res));
    process.exit(res.summary.blocking > 0 ? 1 : 0);
  } catch (e) {
    console.error(e.message);
    process.exit(2);
  }
}
