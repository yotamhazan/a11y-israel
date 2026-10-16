#!/usr/bin/env node
/**
 * a11y-israel static scan: reads a website project's source and lists accessibility, privacy and
 * consumer-protection findings under Israeli law. No dependencies, no network, read-only.
 * Same project in → same findings out, so it can be run before and after fixing to compare.
 *
 *   node scan.mjs <project-dir>                 human-readable report (Hebrew)
 *   node scan.mjs <project-dir> --json          JSON on stdout
 *   node scan.mjs <project-dir> --out scan.json also write JSON to a file
 *
 * Exit code: 0 = no blocking findings, 1 = blocking findings, 2 = usage error.
 * Regex-based by design (works on HTML, JSX/TSX, Vue, Svelte, Astro, PHP, Liquid…): every finding is
 * a lead to verify in the code, not a verdict. Browser checks live in browser-check.mjs.
 */
import { readdirSync, readFileSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { join, relative, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const VERSION = '1.0.0';
const MARKUP = new Set(['.html', '.htm', '.jsx', '.tsx', '.js', '.ts', '.mjs', '.vue', '.svelte', '.astro', '.php', '.liquid', '.ejs', '.hbs', '.njk', '.twig', '.erb', '.cshtml', '.mdx']);
const STYLE = new Set(['.css', '.scss', '.sass', '.less']);
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'out', '.next', '.nuxt', '.svelte-kit', '.astro', '.vercel', '.netlify', 'coverage', 'vendor', '.cache', '.turbo', 'storybook-static', '__pycache__', '.idea', '.vscode']);
// Our own shipped assets and minified bundles are not the site's code.
const SKIP_FILES = /(^|[\\/])(a11y-widget\.js|cookieconsent\.umd\.js|cookieconsent\.esm\.js|cookie-consent\.config\.js)$|\.min\.(js|css)$|\.(test|spec|stories)\.[jt]sx?$/;
const MAX_FILE_BYTES = 1_500_000;

// ---------------------------------------------------------------- findings catalogue

const RULES = {
  // accessibility (SI 5568 part 1, AA)
  'a11y/html-lang': { sev: 'important', ref: 'ת"י 5568 · 3.1.1', title: 'לדף אין שפה מוגדרת', fix: 'הוסיפו lang="he" dir="rtl" לתגית <html> (או את השפה בפועל).' },
  'a11y/img-alt': { sev: 'important', ref: 'ת"י 5568 · 1.1.1', title: 'תמונה בלי טקסט חלופי (alt)', fix: 'תמונה עם משמעות: alt שמתאר אותה (עד כ-120 תווים, בלי "תמונה של"). תמונה דקורטיבית: alt="".' },
  'a11y/click-non-button': { sev: 'important', ref: 'ת"י 5568 · 2.1.1, 4.1.2', title: 'אלמנט לחיץ שאינו כפתור או קישור', fix: 'החליפו ב-<button type="button"> (או <a href> לניווט). כך הוא עובד במקלדת ומוכרז לקורא מסך.' },
  'a11y/outline-none': { sev: 'important', ref: 'ת"י 5568 · 2.4.7', title: 'הסתרת מסגרת הפוקוס בלי תחליף', fix: 'השאירו focus גלוי: הוסיפו :focus-visible / focus-visible: עם outline או ring בולט.' },
  'a11y/tabindex-positive': { sev: 'important', ref: 'ת"י 5568 · 2.4.3', title: 'tabindex חיובי משבש את סדר הניווט', fix: 'השתמשו ב-tabindex="0" או "-1" בלבד, וסדרו את הסדר ב-DOM.' },
  'a11y/autoplay': { sev: 'important', ref: 'ת"י 5568 · 1.4.2, 2.2.2', title: 'מדיה או תנועה שמתחילה לבד', fix: 'ודאו שיש כפתור עצירה/השתקה גלוי, או בטלו autoplay. וידאו עם דיבור צריך כתוביות (1.2.2 — בישראל AA).' },
  'a11y/input-label': { sev: 'important', ref: 'ת"י 5568 · 1.3.1, 3.3.2', title: 'שדה טופס בלי תווית מקושרת', fix: 'הוסיפו <label for="..."> שמקושר ל-id של השדה (placeholder אינו תווית). אם השדה עטוף ב-<label> — זה תקין, סמנו כנבדק.' },
  'a11y/icon-button': { sev: 'important', ref: 'ת"י 5568 · 4.1.2, 2.4.4', title: 'כפתור או קישור של אייקון בלי שם נגיש', fix: 'הוסיפו aria-label שמתאר את הפעולה (למשל aria-label="סגירה"), ו-aria-hidden="true" לאייקון.' },
  'a11y/multiple-h1': { sev: 'recommended', ref: 'ת"י 5568 · 1.3.1, 2.4.10', title: 'יותר מכותרת H1 אחת באותו קובץ', fix: 'H1 אחת לכל עמוד, ומתחתיה H2–H6 בלי דילוגים.' },
  'a11y/no-h1': { sev: 'important', ref: 'ת"י 5568 · 2.4.10 (בישראל AA)', title: 'אין באתר כותרת H1', fix: 'לכל עמוד כותרת H1 אחת שמתארת אותו.' },
  'a11y/no-main': { sev: 'important', ref: 'ת"י 5568 · 2.4.1, 1.3.1', title: 'אין אזור <main> באתר', fix: 'עטפו את התוכן הראשי ב-<main id="main-content">, ואת הניווט/כותרת/פוטר ב-nav/header/footer.' },
  'a11y/vague-link': { sev: 'recommended', ref: 'ת"י 5568 · 2.4.4', title: 'קישור עם טקסט לא מובן לבד ("לחצו כאן")', fix: 'כתבו בקישור לאן הוא מוביל, למשל "למדיניות הפרטיות".' },
  'a11y/zoom-blocked': { sev: 'important', ref: 'ת"י 5568 · 1.4.4', title: 'חסימת הגדלה במובייל', fix: 'הסירו user-scalable=no ו-maximum-scale=1 מתגית ה-viewport.' },
  'a11y/light-text': { sev: 'recommended', ref: 'ת"י 5568 · 1.4.3', title: 'טקסט בגוון בהיר שעלול לא לעמוד בניגודיות 4.5:1', fix: 'בדקו ניגודיות מול הרקע; על רקע לבן השתמשו לפחות ב-gray-600 / slate-600.' },
  'a11y/no-widget': { sev: 'recommended', ref: 'לא חובה בחוק', title: 'אין תפריט נגישות', fix: 'התקינו את a11y-widget.js (assets/a11y-widget). זה עזר לגולש — לא תחליף לתיקון הקוד.' },
  'todo/placeholder': { sev: 'important', ref: 'פרטים שבעל העסק צריך למלא', title: 'נשארו פרטים למילוי [בסוגריים]', fix: 'מלאו את הפרט האמיתי. בתוך alt / aria-label קורא מסך מקריא את הסוגריים כמו שהם.' },
  'a11y/dynamic-statement-date': { sev: 'important', ref: 'תקנה 35 · הצהרת נגישות', title: 'תאריך עדכון דינמי בהצהרת הנגישות', fix: 'כתבו תאריך קבוע של הבדיקה האחרונה, לא new Date().' },
  // legal pages
  'legal/no-a11y-statement': { sev: 'blocking', ref: 'תקנה 35 · חובת הצהרת נגישות', title: 'אין הצהרת נגישות', fix: 'צרו עמוד /accessibility מהתבנית assets/a11y-widget/accessibility-statement.he.html וקשרו אותו מהפוטר בכל עמוד.' },
  'legal/no-privacy-policy': { sev: 'blocking', ref: 'חוק הגנת הפרטיות · סעיף 11', title: 'אין מדיניות פרטיות', fix: 'צרו עמוד /privacy מהתבנית assets/legal/privacy-policy.he.html, לפי מה שהקוד עושה בפועל.' },
  'legal/footer-links': { sev: 'important', ref: 'תקנה 35 · חוק הגנת הפרטיות', title: 'הפוטר לא מקשר להצהרת הנגישות ולמדיניות הפרטיות', fix: 'הוסיפו לפוטר: הצהרת נגישות · מדיניות פרטיות · תקנון (וביטול עסקה בחנות) · הגדרות עוגיות.' },
  // privacy (Privacy Protection Law incl. amendment 13, Communications Law 30A)
  'privacy/form-notice': { sev: 'blocking', ref: 'חוק הגנת הפרטיות · סעיף 11', title: 'טופס שאוסף מידע בלי הודעת יידוע', fix: 'ליד כפתור השליחה: למה המידע נאסף, למי יועבר, שמסירתו רשות/חובה, וקישור למדיניות הפרטיות (תבנית: assets/legal/snippets.he.md).' },
  'privacy/marketing-prechecked': { sev: 'blocking', ref: 'חוק התקשורת · סעיף 30א', title: 'הסכמה לדיוור מסומנת מראש', fix: 'תיבת הסכמה לדיוור נפרדת ולא מסומנת: הסירו checked / defaultChecked.' },
  'privacy/trackers-ungated': { sev: 'blocking', ref: 'חוק הגנת הפרטיות · תיקון 13 · הסכמה מדעת', title: 'כלי מעקב נטענים בלי הסכמת הגולש', fix: 'התקינו את באנר העוגיות (assets/cookie-consent) וסמנו כל סקריפט כזה ב-type="text/plain" data-category="analytics|marketing". פרטו כל כלי במדיניות הפרטיות.' },
  'privacy/secret-in-client': { sev: 'blocking', ref: 'תקנות אבטחת מידע', title: 'מפתח סודי בקוד שמגיע לדפדפן', fix: 'העבירו את המפתח לצד שרת (משתנה סביבה), החליפו אותו (rotate) — הוא כבר חשוף.' },
  'privacy/insecure-script': { sev: 'important', ref: 'תקנות אבטחת מידע', title: 'סקריפט חיצוני נטען ב-http', fix: 'טענו ב-https בלבד.' },
  'privacy/third-party-widget': { sev: 'important', ref: 'חוק הגנת הפרטיות · סעיף 11', title: 'תוסף נגישות או צ\'אט של צד שלישי', fix: 'פרטו אותו במדיניות הפרטיות (מה נאסף ולאן עובר), וודאו שהרישיון בתוקף.' },
  // consumer protection (shops)
  'consumer/no-cancel-link': { sev: 'blocking', ref: 'חוק הגנת הצרכן · סעיף 14ט(ב)', title: 'אין בדף הבית קישור ייעודי לביטול עסקה', fix: 'הוסיפו קישור בולט "ביטול עסקה" לדף הבית (בפוטר בכל עמוד), עם דרכי הביטול לידו (תבנית: assets/legal/cancellation.he.html).' },
  'consumer/no-terms': { sev: 'important', ref: 'חוק הגנת הצרכן · סעיף 14ג', title: 'אין תקנון / תנאי שימוש', fix: 'צרו עמוד /terms מהתבנית assets/legal/terms.he.html.' },
  'consumer/no-business-id': { sev: 'important', ref: 'חוק הגנת הצרכן · סעיף 14ג(א)', title: 'לא נמצאו פרטי זיהוי העסק (ח.פ. / ע.מ. וכתובת)', fix: 'הציגו בתקנון ובפוטר: שם העוסק, ח.פ./ע.מ., כתובת, טלפון ומייל.' },
  'consumer/price-without-vat': { sev: 'blocking', ref: 'חוק הגנת הצרכן · סעיף 17ב', title: 'מחיר מוצג בלי מע"מ', fix: 'לצרכן מציגים רק את המחיר הכולל (כולל מע"מ וכל תשלום חובה), בשקלים.' },
};

const SEV_ORDER = { blocking: 0, important: 1, recommended: 2 };
const SEV_HE = { blocking: 'חוסם — הפרת חוק ברורה', important: 'חשוב — הפרת סעיף בתקן', recommended: 'מומלץ' };

// Known third-party tools. `kind` decides the cookie category and whether consent is needed.
const TRACKERS = [
  { name: 'Google Analytics', kind: 'analytics', re: /googletagmanager\.com\/gtag\/js|google-analytics\.com|gtag\(\s*['"]config['"]|\bG-[A-Z0-9]{6,}\b|react-ga4?|@next\/third-parties\/google/ },
  { name: 'Google Tag Manager', kind: 'analytics', re: /googletagmanager\.com\/gtm\.js|\bGTM-[A-Z0-9]{4,}\b/ },
  { name: 'Google Ads', kind: 'marketing', re: /googleadservices\.com|\bAW-\d{6,}\b|googlesyndication\.com/ },
  { name: 'Meta Pixel', kind: 'marketing', re: /connect\.facebook\.net|fbq\(\s*['"]init|react-facebook-pixel/ },
  { name: 'TikTok Pixel', kind: 'marketing', re: /analytics\.tiktok\.com|ttq\.load/ },
  { name: 'LinkedIn Insight', kind: 'marketing', re: /snap\.licdn\.com|_linkedin_partner_id/ },
  { name: 'Microsoft Clarity', kind: 'analytics', re: /clarity\.ms\/tag|clarity\(\s*['"]/ },
  { name: 'Microsoft Ads (UET)', kind: 'marketing', re: /bat\.bing\.com/ },
  { name: 'Hotjar', kind: 'analytics', re: /static\.hotjar\.com|hotjar\.com\/c\/hotjar|hjid/ },
  { name: 'PostHog', kind: 'analytics', re: /posthog\.init|posthog-js|i\.posthog\.com/ },
  { name: 'Mixpanel', kind: 'analytics', re: /mixpanel\.init|cdn\.mxpnl\.com|mixpanel-browser/ },
  { name: 'Segment', kind: 'analytics', re: /cdn\.segment\.com|analytics\.load\(/ },
  { name: 'Pinterest Tag', kind: 'marketing', re: /s\.pinimg\.com\/ct|pintrk\(/ },
  { name: 'Snap Pixel', kind: 'marketing', re: /sc-static\.net\/scevent/ },
  { name: 'Taboola / Outbrain', kind: 'marketing', re: /cdn\.taboola\.com|amplify\.outbrain\.com/ },
  { name: 'YouTube embed', kind: 'functional', re: /youtube\.com\/embed|youtu\.be\// },
  { name: 'Google Maps embed', kind: 'functional', re: /google\.com\/maps\/embed|maps\.googleapis\.com/ },
  { name: 'Vimeo embed', kind: 'functional', re: /player\.vimeo\.com/ },
  { name: 'Intercom', kind: 'functional', re: /widget\.intercom\.io|Intercom\(\s*['"]boot/ },
  { name: 'Tawk.to', kind: 'functional', re: /embed\.tawk\.to/ },
  { name: 'Crisp', kind: 'functional', re: /client\.crisp\.chat/ },
  { name: 'Zendesk chat', kind: 'functional', re: /static\.zdassets\.com/ },
  { name: 'HubSpot', kind: 'marketing', re: /js\.hs-scripts\.com|js\.hsforms\.net/ },
];
const THIRD_PARTY_A11Y = [
  { name: 'נגיש בקליק', re: /nagich\.co\.il|nagishli/i },
  { name: 'UserWay', re: /userway\.org|cdn\.userway/i },
  { name: 'Enable', re: /enable\.co\.il|cdn\.enable/i },
  { name: 'accessiBe', re: /acsbapp\.com|accessibe/i },
  { name: 'EqualWeb', re: /equalweb\.com|nagich\.com/i },
];

// ---------------------------------------------------------------- helpers

function walk(dir, root, out) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name) || (e.name.startsWith('.') && e.name !== '.well-known')) continue;
      walk(p, root, out);
    } else if (e.isFile()) {
      const ext = extname(e.name).toLowerCase();
      if (!MARKUP.has(ext) && !STYLE.has(ext)) continue;
      const rel = relative(root, p).split('\\').join('/');
      if (SKIP_FILES.test(rel)) continue;
      try {
        if (statSync(p).size > MAX_FILE_BYTES) continue;
      } catch {
        continue;
      }
      out.push({ path: p, rel, ext, style: STYLE.has(ext) });
    }
  }
  return out;
}

function lineAt(text, index) {
  let n = 1;
  for (let i = 0; i < index && i < text.length; i++) if (text.charCodeAt(i) === 10) n++;
  return n;
}

/** Opening tags of the given names, with attribute text, tolerant of JSX `{...}` with `>` inside. */
function* tags(text, names) {
  const re = new RegExp('<(' + names + ')(?=[\\s/>])', 'g');
  let m;
  while ((m = re.exec(text))) {
    let i = m.index + m[0].length;
    let depth = 0;
    let quote = null;
    for (; i < text.length; i++) {
      const c = text[i];
      if (quote) {
        if (c === quote) quote = null;
      } else if (c === '"' || c === "'" || c === '`') quote = c;
      else if (c === '{') depth++;
      else if (c === '}') depth--;
      else if (c === '>' && depth <= 0) break;
    }
    yield { name: m[1], attrs: text.slice(m.index + m[0].length, i), index: m.index, end: i + 1 };
  }
}

const has = (attrs, name) => new RegExp('(^|\\s)' + name + '\\s*(=|\\s|$|/)', 'i').test(attrs) || new RegExp('(^|\\s)' + name + '$', 'i').test(attrs.trim());
const attrValue = (attrs, name) => {
  const m = attrs.match(new RegExp('(?:^|\\s)' + name + '\\s*=\\s*(?:"([^"]*)"|\'([^\']*)\'|\\{\\s*["\'`]([^"\'`]*)["\'`]\\s*\\}|\\{([^}]*)\\}|([^\\s>]+))', 'i'));
  return m ? m[1] ?? m[2] ?? m[3] ?? m[4] ?? m[5] ?? '' : null;
};

// ---------------------------------------------------------------- scan

export function scan(projectDir) {
  const root = resolve(projectDir);
  const files = walk(root, root, []);
  const findings = [];
  const add = (id, file, text, index, detail) => {
    findings.push({ id, ...RULES[id], file: file ? file.rel : null, line: file && index != null ? lineAt(text, index) : null, detail: detail || null });
  };

  const facts = {
    framework: detectFramework(root),
    files: files.length,
    pages: [],
    forms: [],
    trackers: [],
    thirdPartyA11y: [],
    widgetInstalled: false,
    cookieBannerInstalled: false,
    a11yStatement: null,
    privacyPolicy: null,
    terms: null,
    cancellationPage: null,
    footerFiles: [],
    shop: false,
    shopSignals: [],
  };

  let anyH1 = false;
  let anyMain = false;
  let anyBusinessId = false;
  let anyCancelText = false;
  const trackerHits = new Map(); // name -> { kind, gated, files:Set }
  const shopSignals = new Set();

  for (const f of files) {
    let text;
    try {
      text = readFileSync(f.path, 'utf8');
    } catch {
      continue;
    }

    if (f.style) {
      scanStyles(f, text, add);
      continue;
    }

    // ---- facts
    if (/<html[\s>]/i.test(text) || /(^|\/)(pages|app)\/.*\.(jsx|tsx|vue|svelte|astro)$|\.(html|htm|astro|php|liquid)$/i.test(f.rel)) {
      if (!/(^|\/)(components?|partials?|includes?|layouts?|_)/i.test(f.rel)) facts.pages.push(f.rel);
    }
    if (/a11y-widget\.js|A11yWidgetConfig/.test(text)) facts.widgetInstalled = true;
    if (/cookieconsent\.umd\.js|vanilla-cookieconsent|CookieConsent\.run|cookie-consent\.config\.js|CookieConsentConfig/.test(text)) facts.cookieBannerInstalled = true;
    // A document page is one whose file name, <title> or <h1> names it; a mention in a footer is not the page.
    const heading = ((text.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '') + ' ' + ((text.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || [])[1] || '');
    const isDoc = (nameRe, titleRe) => nameRe.test(f.rel) || titleRe.test(heading);
    if (isDoc(/accessib|a11y-statement|negishut|נגישות/i, /הצהרת\s+נגישות|accessibility statement/i) && /(ת"י|ת״י|תקן\s+ישראלי)\s*5568|רכז(?:\/ת)?\s+(?:ה)?נגישות|התאמות נגישות לשירות/.test(text)) facts.a11yStatement ||= f.rel;
    if (isDoc(/privacy|pratiut|פרטיות/i, /מדיניות\s+(?:ה)?פרטיות|privacy/i) && /(זכות\s+(?:ה)?עיון|מידע\s+(?:ה)?נאסף|מטרות\s+(?:ה)?שימוש|עוגיות|cookies)/i.test(text)) facts.privacyPolicy ||= f.rel;
    if (isDoc(/terms|takanon|תקנון/i, /תקנון|תנאי\s+(?:ה)?שימוש|terms/i) && /(קניין\s+רוחני|אחריות|סמכות\s+שיפוט|דין\s+החל|liability)/i.test(text)) facts.terms ||= f.rel;
    if (/ביטול\s+עסקה/.test(text)) {
      anyCancelText = true;
      if (isDoc(/cancel|returns|bitul|ביטול/i, /ביטול\s+עסקה|החזרות|cancel/i)) facts.cancellationPage ||= f.rel;
    }
    if (/(ח\.?\s?פ\.?|ע\.?\s?מ\.?|עוסק\s+מורשה|מספר\s+חברה)\s*[:\-]?\s*\d{6,9}|\[(ח\.פ\.|מספר\s+עוסק)/.test(text)) anyBusinessId = true;
    if (/<h1[\s>]/i.test(text)) anyH1 = true;
    if (/<main[\s>]|role=["']main["']/i.test(text)) anyMain = true;

    for (const s of [
      [/add.?to.?cart|הוספה\s+לסל|הוסף\s+לסל|לסל\s+הקניות|סל\s+קניות|shopping.?cart/i, 'סל קניות'],
      [/checkout|לתשלום|מעבר\s+לקופה|קופה/i, 'קופה / תשלום'],
      [/stripe|paypal|cardcom|tranzila|meshulam|grow\.link|payplus|icount|pelecard|hyp\.co\.il|isracard|bit\.ly\/pay|lemonsqueezy|paddle\.com|shopify|woocommerce/i, 'ספק תשלומים'],
      [/₪\s?\d|\d\s?₪|ש"ח|ILS/, 'מחירים בשקלים'],
      [/מנוי\s+(חודשי|שנתי)|subscription|recurring/i, 'מנוי מתחדש'],
    ]) if (s[0].test(text)) shopSignals.add(s[1]);

    for (const t of TRACKERS) {
      const m = t.re.exec(text);
      if (!m) continue;
      const hit = trackerHits.get(t.name) || { kind: t.kind, gated: true, files: new Set(), first: null };
      hit.files.add(f.rel);
      // Gated = inside a <script type="text/plain" data-category> block, or the file loads it after consent.
      const before = text.slice(Math.max(0, m.index - 600), m.index);
      const gatedHere = /type=["']text\/plain["'][^>]*data-category|data-category=["'][a-z]+["'][^>]*type=["']text\/plain["']/.test(before) || /acceptedCategory\(|CookieConsent\.(acceptedCategory|getCookie)|onConsent/.test(text);
      if (!gatedHere) {
        hit.gated = false;
        hit.first ||= { file: f, text, index: m.index };
      }
      trackerHits.set(t.name, hit);
    }
    for (const t of THIRD_PARTY_A11Y) {
      const m = t.re.exec(text);
      if (m && !facts.thirdPartyA11y.includes(t.name)) {
        facts.thirdPartyA11y.push(t.name);
        add('privacy/third-party-widget', f, text, m.index, t.name);
      }
    }

    scanMarkup(f, text, add, facts);
  }

  // ---- site-wide findings
  if (files.some((f) => !f.style)) {
    if (!anyH1) add('a11y/no-h1');
    if (!anyMain) add('a11y/no-main');
  }
  if (!facts.widgetInstalled && facts.thirdPartyA11y.length === 0) add('a11y/no-widget');
  if (!facts.a11yStatement) add('legal/no-a11y-statement');

  facts.trackers = [...trackerHits.entries()].map(([name, h]) => ({ name, kind: h.kind, gated: h.gated, files: [...h.files] }));
  const needsConsent = facts.trackers.filter((t) => !t.gated);
  if (needsConsent.length) {
    const first = trackerHits.get(needsConsent[0].name).first;
    add('privacy/trackers-ungated', first.file, first.text, first.index, needsConsent.map((t) => t.name).join(', '));
  }
  if (!facts.privacyPolicy) {
    const r = { ...RULES['legal/no-privacy-policy'] };
    // With no forms and no trackers the site may collect nothing; still important (contact links, server logs).
    if (!facts.forms.length && !facts.trackers.length) r.sev = 'important';
    findings.push({ id: 'legal/no-privacy-policy', ...r, file: null, line: null, detail: null });
  }

  facts.shopSignals = [...shopSignals];
  // Prices alone (a price list on a service site) are not a shop; a cart, checkout or payment provider is.
  facts.shop = shopSignals.has('סל קניות') || shopSignals.has('קופה / תשלום') || shopSignals.has('ספק תשלומים') || shopSignals.has('מנוי מתחדש');
  if (facts.shop) {
    if (!anyCancelText) add('consumer/no-cancel-link');
    if (!facts.terms) add('consumer/no-terms');
    if (!anyBusinessId) add('consumer/no-business-id');
  }

  // Footer links: every file that defines a footer should link to the statement and the privacy policy.
  for (const ff of facts.footerFiles) {
    if (!ff.a11y || !ff.privacy) findings.push({ id: 'legal/footer-links', ...RULES['legal/footer-links'], file: ff.rel, line: ff.line, detail: [!ff.a11y && 'הצהרת נגישות', !ff.privacy && 'מדיניות פרטיות'].filter(Boolean).join(', ') });
  }
  facts.footerFiles = facts.footerFiles.map((f) => f.rel);

  findings.sort((a, b) => SEV_ORDER[a.sev] - SEV_ORDER[b.sev] || String(a.file).localeCompare(String(b.file)) || (a.line || 0) - (b.line || 0) || a.id.localeCompare(b.id));
  const summary = { blocking: 0, important: 0, recommended: 0 };
  for (const f of findings) summary[f.sev]++;
  return { tool: 'a11y-israel/scan', version: VERSION, project: root, summary, facts, findings };
}

function scanStyles(f, text, add) {
  const hasFocusVisible = /:focus-visible|:focus\s*\{[^}]*(outline|box-shadow)/.test(text);
  const re = /outline\s*:\s*(none|0)\b/g;
  let m;
  while ((m = re.exec(text))) {
    if (!hasFocusVisible) add('a11y/outline-none', f, text, m.index);
  }
}

function scanMarkup(f, text, add, facts) {
  const isJsxLike = /\.(jsx|tsx|js|ts|mjs|mdx)$/.test(f.rel);
  // Plain .js/.ts without any markup: only the tracker / secret checks apply.
  const hasMarkup = /<[a-zA-Z][\w.-]*[\s>/]/.test(text);

  // secrets shipped to the browser (server-only files are skipped by name)
  if (!/(^|\/)(server|api|backend|functions|supabase\/functions|scripts)\/|\.server\.|route\.(t|j)s$|middleware\.(t|j)s$/.test(f.rel)) {
    const s = /(sk_live_[0-9a-zA-Z]{10,}|rk_live_[0-9a-zA-Z]{10,}|AKIA[0-9A-Z]{16}|-----BEGIN (?:RSA )?PRIVATE KEY-----|"service_role"|SUPABASE_SERVICE_ROLE_KEY\s*[:=]\s*["'][^"']{20,})/.exec(text);
    if (s) add('privacy/secret-in-client', f, text, s.index);
  }
  const insecure = /<script[^>]+src=["']http:\/\/(?!localhost|127\.0\.0\.1)/i.exec(text);
  if (insecure) add('privacy/insecure-script', f, text, insecure.index);
  // [Hebrew placeholders] left by templates or by /fix: one finding per file, with a count.
  const ph = text.match(/\[[^\]\n"'`]*[֐-׿][^\]\n"'`]*\]/g);
  if (ph) {
    const first = text.search(/\[[^\]\n"'`]*[֐-׿][^\]\n"'`]*\]/);
    const inA11yName = /(alt|aria-label)\s*=\s*["'{]\s*["'`]?\[[^\]\n]*[֐-׿]/.test(text);
    add('todo/placeholder', f, text, first, ph.length + (inA11yName ? ' — כולל בתוך alt / aria-label' : '') + ': ' + [...new Set(ph)].slice(0, 3).join(' '));
  }

  if (!hasMarkup) return;

  // <html lang>
  for (const t of tags(text, 'html')) if (!/\blang\s*=/.test(t.attrs)) add('a11y/html-lang', f, text, t.index);

  // viewport zoom
  const vp = /<meta[^>]+name=["']viewport["'][^>]*>/i.exec(text) || /viewport\s*[:=][^\n]*(user-scalable|maximum-scale)/i.exec(text);
  if (vp && /user-scalable\s*=\s*(no|0)|maximum-scale\s*=\s*1(\.0)?\b/i.test(vp[0])) add('a11y/zoom-blocked', f, text, vp.index);

  // images
  for (const t of tags(text, 'img|Image')) {
    if (t.name === 'Image' && !isJsxLike && f.ext !== '.astro' && f.ext !== '.vue') continue;
    if (!/(^|\s)(alt|:alt|v-bind:alt)\s*=|\{\s*\.\.\.|aria-hidden=["']true["']|role=["'](presentation|none)["']/.test(t.attrs)) add('a11y/img-alt', f, text, t.index);
  }

  // click handlers on non-interactive elements
  for (const t of tags(text, 'div|span|li|td|tr|p|section|article|img|svg|i')) {
    if (/(^|\s)(onClick|onclick|@click|v-on:click|on:click|\(click\))\s*=/.test(t.attrs) && !/\brole\s*=/.test(t.attrs)) add('a11y/click-non-button', f, text, t.index);
  }

  // tabindex > 0
  const tab = /tab[iI]ndex\s*=\s*\{?\s*["']?([1-9]\d*)/g;
  let m;
  while ((m = tab.exec(text))) add('a11y/tabindex-positive', f, text, m.index);

  // autoplay media / carousels
  const ap = /<(video|audio|iframe)[^>]*\b(autoplay|autoPlay)\b|autoplay\s*[:=]\s*(true|\{|["']?\d)/g;
  while ((m = ap.exec(text))) add('a11y/autoplay', f, text, m.index);

  // outline removal in class names (Tailwind) without a focus-visible replacement in the same file
  const ol = /(?:class|className)\s*=\s*["'{`][^"'`]*\b(outline-none|focus:outline-none)\b/g;
  const hasFocusRing = /focus-visible:|focus:ring|focus:outline-(?!none)|focus:border|:focus-visible/.test(text);
  while ((m = ol.exec(text))) if (!hasFocusRing) add('a11y/outline-none', f, text, m.index);
  const olInline = /outline\s*:\s*['"]?(none|0)\b/g;
  while ((m = olInline.exec(text))) if (!hasFocusRing) add('a11y/outline-none', f, text, m.index);

  // form fields without labels
  for (const t of tags(text, 'input|select|textarea')) {
    const type = (attrValue(t.attrs, 'type') || '').toLowerCase();
    if (['hidden', 'submit', 'button', 'reset', 'image'].includes(type)) continue;
    if (/aria-label(ledby)?\s*=|\{\s*\.\.\.(register|field|props|rest)/.test(t.attrs)) continue;
    const id = attrValue(t.attrs, 'id');
    if (id && !/[{}$]/.test(id) && new RegExp('(for|htmlFor)\\s*=\\s*\\{?\\s*["\'`]' + id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '["\'`]').test(text)) continue;
    // Wrapped in <label>…</label>: an opening <label> before it with no closing in between.
    const before = text.slice(Math.max(0, t.index - 400), t.index);
    const lastOpen = before.lastIndexOf('<label');
    if (lastOpen !== -1 && before.indexOf('</label>', lastOpen) === -1) continue;
    add('a11y/input-label', f, text, t.index, type || t.name);
  }

  // icon-only buttons / links
  const iconBtn = /<(button|a)\b([^>]*)>\s*(<(svg|i|img|span[^>]*class=["'][^"']*icon)[\s\S]{0,400}?<\/(svg|i|span)>|<img[^>]*\/?>|<[A-Z]\w*(Icon)?\b[^>]*\/>)\s*<\/(button|a)>/g;
  while ((m = iconBtn.exec(text))) {
    const attrs = m[2];
    if (/aria-label(ledby)?\s*=|title\s*=/.test(attrs)) continue;
    if (/<img[^>]*\balt\s*=\s*["'][^"']+["']/.test(m[3])) continue;
    add('a11y/icon-button', f, text, m.index);
  }

  // headings
  const h1s = text.match(/<h1[\s>]/gi);
  if (h1s && h1s.length > 1) add('a11y/multiple-h1', f, text, text.search(/<h1[\s>]/i) + 1, h1s.length + ' כותרות H1');

  // vague link text
  const vague = />\s*(לחצו?\s+כאן|לחץ\s+כאן|כאן|קרא(?:ו)?\s+עוד|click here|here|read more|more)\s*<\/a>/gi;
  while ((m = vague.exec(text))) add('a11y/vague-link', f, text, m.index, m[1]);

  // light grey text classes (Tailwind)
  const light = /\btext-(gray|slate|zinc|neutral|stone)-(200|300|400)\b/g;
  while ((m = light.exec(text))) {
    // Dark backgrounds make light text fine; skip when the same line sets a dark bg.
    const lineStart = text.lastIndexOf('\n', m.index) + 1;
    const lineEnd = text.indexOf('\n', m.index);
    const line = text.slice(lineStart, lineEnd === -1 ? undefined : lineEnd);
    if (/\bbg-(gray|slate|zinc|neutral|stone|black|blue|indigo|purple|red|green)-(7|8|9)\d\d\b|\bdark:/.test(line)) continue;
    add('a11y/light-text', f, text, m.index, m[0]);
  }

  // statement with a dynamic date
  if (/הצהרת\s+נגישות/.test(text)) {
    const d = /new Date\(\)|Date\.now\(\)|toLocaleDateString\(\)/.exec(text);
    if (d) add('a11y/dynamic-statement-date', f, text, d.index);
  }

  // forms: privacy notice in the same file
  for (const t of tags(text, 'form|Form')) {
    if (t.name === 'Form' && !isJsxLike) continue;
    facts.forms.push(f.rel + ':' + lineAt(text, t.index));
    const close = text.indexOf(t.name === 'form' ? '</form>' : '</Form>', t.end);
    const body = text.slice(t.index, close === -1 ? t.index + 6000 : close);
    const collectsPersonal = /type=["'](email|tel)["']|name=["'](email|phone|tel|name|fullName|full_name|first_?name|last_?name|id|address)["']|(שם|טלפון|דוא"ל|אימייל|מייל|כתובת|ת\.?ז)/i.test(body);
    if (!collectsPersonal) continue;
    const window = text.slice(Math.max(0, t.index - 800), (close === -1 ? t.index + 6000 : close) + 1200);
    if (!/(מדיניות\s+(?:ה)?פרטיות|privacy|PrivacyNotice|FormNotice|הודעת\s+פרטיות)/i.test(window)) add('privacy/form-notice', f, text, t.index);

    // marketing consent pre-checked
    for (const c of tags(body, 'input|Checkbox')) {
      if (c.name === 'input' && !/type=["']checkbox["']/.test(c.attrs)) continue;
      if (!/(^|\s)(checked|defaultChecked)(\s|=|$)/.test(c.attrs) || /checked\s*=\s*\{\s*(false|\w+\s*===)/.test(c.attrs)) continue;
      const around = body.slice(Math.max(0, c.index - 300), c.end + 300);
      if (/(דיוור|ניוזלטר|עדכונים|מבצעים|פרסומ|שיווק|newsletter|marketing|promotion|subscribe)/i.test(around)) add('privacy/marketing-prechecked', f, text, t.index + c.index);
    }
  }

  // price displayed without VAT
  const vat = /(\+\s*מע"?מ|לא\s+כולל\s+מע"?מ|ללא\s+מע"?מ|\+\s*VAT|excl\.?\s*VAT|before\s+VAT)/gi;
  while ((m = vat.exec(text))) add('consumer/price-without-vat', f, text, m.index, m[0]);

  // footers
  for (const t of tags(text, 'footer|Footer')) {
    if (t.name === 'Footer' && /\/>$/.test(text.slice(t.index, t.end))) continue; // usage, not definition
    const close = text.indexOf(t.name === 'footer' ? '</footer>' : '</Footer>', t.end);
    const body = text.slice(t.index, close === -1 ? text.length : close);
    facts.footerFiles.push({
      rel: f.rel,
      line: lineAt(text, t.index),
      a11y: /נגישות|accessibility/i.test(body),
      privacy: /פרטיות|privacy/i.test(body),
    });
  }
}

function detectFramework(root) {
  try {
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    for (const [dep, name] of [['next', 'Next.js'], ['nuxt', 'Nuxt'], ['@remix-run/react', 'Remix'], ['astro', 'Astro'], ['@sveltejs/kit', 'SvelteKit'], ['gatsby', 'Gatsby'], ['vue', 'Vue'], ['svelte', 'Svelte'], ['react', 'React'], ['vite', 'Vite']]) if (deps[dep]) return name;
    return 'Node project';
  } catch {
    /* no package.json */
  }
  if (existsSync(join(root, 'wp-content')) || existsSync(join(root, 'functions.php')) || existsSync(join(root, 'style.css')) && existsSync(join(root, 'index.php'))) return 'WordPress';
  if (existsSync(join(root, 'index.html'))) return 'HTML';
  return 'unknown';
}

// ---------------------------------------------------------------- report

export function formatReport(r) {
  const out = [];
  const f = r.facts;
  out.push('a11y-israel scan ' + r.version + ' — ' + r.project);
  out.push('');
  out.push('סוג: ' + f.framework + ' · קבצים שנסרקו: ' + f.files + ' · עמודים: ' + f.pages.length + ' · טפסים: ' + f.forms.length + (f.shop ? ' · חנות (' + f.shopSignals.join(', ') + ')' : ''));
  out.push('כלי צד שלישי: ' + (f.trackers.length ? f.trackers.map((t) => t.name + (t.gated ? ' ✓' : ' ✗')).join(', ') : 'לא נמצאו') + (f.thirdPartyA11y.length ? ' · תוסף נגישות: ' + f.thirdPartyA11y.join(', ') : ''));
  out.push('תפריט a11y-israel: ' + (f.widgetInstalled ? 'מותקן' : 'לא') + ' · באנר עוגיות: ' + (f.cookieBannerInstalled ? 'מותקן' : 'לא') + ' · הצהרת נגישות: ' + (f.a11yStatement || 'לא נמצאה') + ' · מדיניות פרטיות: ' + (f.privacyPolicy || 'לא נמצאה') + ' · תקנון: ' + (f.terms || 'לא נמצא'));
  out.push('');
  out.push('סיכום: ' + r.summary.blocking + ' חוסמים · ' + r.summary.important + ' חשובים · ' + r.summary.recommended + ' מומלצים');
  for (const sev of ['blocking', 'important', 'recommended']) {
    const list = r.findings.filter((x) => x.sev === sev);
    if (!list.length) continue;
    out.push('');
    out.push('== ' + SEV_HE[sev] + ' (' + list.length + ')');
    for (const x of list) {
      out.push('- ' + x.title + (x.detail ? ' [' + x.detail + ']' : '') + '  (' + x.ref + ')');
      out.push('  ' + (x.file ? x.file + (x.line ? ':' + x.line : '') : 'כל האתר') + '  ·  ' + x.id);
      out.push('  תיקון: ' + x.fix);
    }
  }
  out.push('');
  out.push('סריקה סטטית: כל ממצא הוא כיוון לבדיקה בקוד. לא נבדקו כאן: ניגודיות בפועל, מקלדת, זום — ראו browser-check.mjs.');
  return out.join('\n');
}

// ---------------------------------------------------------------- CLI

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const args = process.argv.slice(2);
  const dir = args.find((a) => !a.startsWith('--'));
  if (!dir || !existsSync(dir)) {
    console.error('usage: node scan.mjs <project-dir> [--json] [--out file.json]');
    process.exit(2);
  }
  const result = scan(dir);
  const outIdx = args.indexOf('--out');
  if (outIdx !== -1 && args[outIdx + 1]) writeFileSync(args[outIdx + 1], JSON.stringify(result, null, 2));
  console.log(args.includes('--json') ? JSON.stringify(result, null, 2) : formatReport(result));
  process.exit(result.summary.blocking > 0 ? 1 : 0);
}
