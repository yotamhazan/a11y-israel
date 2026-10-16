/*!
 * a11y-widget v2.1 — a self-contained accessibility menu for any website.
 * One file, no dependencies, no network calls, no tracking.
 *
 * Usage (ideally before </body>):
 *   <script src="/a11y-widget.js"
 *           data-icon-style="blue-white"      // blue-white | white-blue | black-white | white-black  (icon-on-background)
 *           data-size="medium"                // small | medium | large | a number of px (min 44)
 *           data-position="bottom-start"      // {top|middle|bottom}-{start|end|left|right}; start = right in Hebrew
 *           data-offset-x="16" data-offset-y="24"
 *           data-lang="auto"                  // auto | he | en   (auto = read <html lang>, follows changes)
 *           data-statement-url="/accessibility"
 *           data-skip-link="true" data-shortcut="true"
 *           defer></script>
 * or set window.A11yWidgetConfig = { iconStyle, size, position, ... } before the script loads.
 *
 * Public API: window.A11yWidget.open() / close() / toggle() / reset() /
 *             getPreferences() / setPreferences(partial) / destroy()
 *
 * Built for SI 5568 part 1 (WCAG 2.0 AA with Israeli changes) as a visitor aid.
 * It does NOT make an inaccessible site compliant — the site's own markup must.
 *
 * Launcher icon: "universal-access" from Font Awesome Free 5.2.0 by @fontawesome
 * (https://fontawesome.com), licensed CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/),
 * via Wikimedia Commons (File:Accessibility.svg). Colors applied by this widget.
 */
(function () {
  'use strict';

  // Guard against the script being included twice (e.g. once by a CMS plugin, once by hand).
  if (typeof window === 'undefined' || window.__a11ywLoaded) return;
  window.__a11ywLoaded = true;

  var currentScript = document.currentScript;
  var VERSION = '2.1.0';
  var TEXT_SCALE_STEPS = [100, 115, 130, 150, 175, 200];
  var CONTRAST_MODES = ['dark', 'light', 'invert', 'monochrome'];
  var TOGGLES = [
    'readableFont',
    'lineSpacing',
    'letterSpacing',
    'highlightLinks',
    'highlightHeadings',
    'keyboardFocus',
    'stopAnimations',
    'bigCursor',
    'readingGuide',
  ];
  var CLASS_PREFIX = 'a11yw-';
  var STORAGE_VERSION = 1;

  /** Launcher icon/background pairs. Every pair is at least 7:1. */
  var ICON_STYLES = {
    'blue-white': { fg: '#154f92', bg: '#ffffff', theme: 'blue' },
    'white-blue': { fg: '#ffffff', bg: '#154f92', theme: 'blue' },
    'black-white': { fg: '#000000', bg: '#ffffff', theme: 'mono' },
    'white-black': { fg: '#ffffff', bg: '#000000', theme: 'mono' },
  };
  /**
   * Panel palettes. The panel shares its design with the cookie banner (vanilla-cookieconsent +
   * ../cookie-consent/cookie-consent.theme.css): same tokens, sizes and radii, so both look like one system.
   * ink = text and primary buttons, ink2 = secondary text, accent = hover and "on" switches,
   * pale/line = blocks and secondary buttons, hover = block hover, off = "off" switches, sep = separators.
   */
  var THEMES = {
    blue: { ink: '#0a2353', ink2: '#27324a', accent: '#1450c8', pale: '#eef4fd', line: '#d3e0f5', hover: '#e2ecfb', off: '#5b6474', sep: '#f0f4f7' },
    mono: { ink: '#000000', ink2: '#3f3f46', accent: '#1f1f1f', pale: '#f4f4f5', line: '#d4d4d8', hover: '#e4e4e7', off: '#52525b', sep: '#f0f0f1' },
  };
  var SIZES = { small: 44, medium: 56, large: 68 };

  // ---------------------------------------------------------------- config

  function readConfig() {
    var ds = (currentScript && currentScript.dataset) || {};
    var fromWindow = window.A11yWidgetConfig || {};
    var pick = function (key, fallback) {
      if (fromWindow[key] !== undefined) return fromWindow[key];
      if (ds[key] !== undefined) return ds[key];
      return fallback;
    };
    var bool = function (value) {
      return value === true || value === 'true' || value === '';
    };
    var int = function (value, fallback) {
      var n = parseInt(value, 10);
      return isNaN(n) ? fallback : n;
    };

    var iconStyle = String(pick('iconStyle', 'blue-white'));
    if (!ICON_STYLES[iconStyle]) {
      console.warn('[a11y-widget] unknown icon-style "' + iconStyle + '"; using blue-white');
      iconStyle = 'blue-white';
    }
    var rawSize = pick('size', 'medium');
    var size = SIZES[rawSize] || int(rawSize, SIZES.medium);
    if (size < 44) {
      // 44px is the minimum comfortable touch target; smaller launchers are hard to hit.
      console.warn('[a11y-widget] size ' + size + 'px is below 44px; using 44');
      size = 44;
    }
    var position = String(pick('position', 'bottom-start')).toLowerCase();
    var parts = position.split('-');
    var vertical = ['top', 'middle', 'bottom'].indexOf(parts[0]) !== -1 ? parts[0] : 'bottom';
    var horizontal = ['start', 'end', 'left', 'right'].indexOf(parts[1]) !== -1 ? parts[1] : 'start';

    return {
      lang: String(pick('lang', 'auto')),
      statementUrl: String(pick('statementUrl', '')),
      iconStyle: iconStyle,
      size: size,
      vertical: vertical,
      horizontal: horizontal,
      offsetX: int(pick('offsetX', 16), 16),
      offsetY: int(pick('offsetY', 24), 24),
      zIndex: int(pick('zIndex', 2147483000), 2147483000),
      skipLink: bool(pick('skipLink', true)),
      shortcut: bool(pick('shortcut', true)),
      storageKey: String(pick('storageKey', 'a11yw_prefs')),
    };
  }

  // ---------------------------------------------------------------- strings

  var STRINGS = {
    he: {
      launcher: 'תפריט נגישות',
      title: 'התאמות נגישות',
      close: 'סגירת תפריט הנגישות',
      hint: 'קיצור מקלדת: Alt+A לפתיחה ולסגירה, Esc לסגירה.',
      skip: 'דילוג לתוכן הראשי',
      active: '{n} התאמות פעילות',
      on: 'מופעל',
      off: 'כבוי',
      sectionText: 'טקסט וקריאות',
      sectionColor: 'צבעים וניגודיות',
      sectionNav: 'ניווט והתמצאות',
      textSize: 'גודל טקסט',
      smaller: 'הקטנת הטקסט',
      larger: 'הגדלת הטקסט',
      readableFont: 'גופן קריא',
      lineSpacing: 'ריווח שורות',
      letterSpacing: 'ריווח אותיות',
      dark: 'ניגודיות כהה',
      light: 'ניגודיות בהירה',
      invert: 'היפוך צבעים',
      monochrome: 'שחור-לבן',
      highlightLinks: 'הדגשת קישורים',
      highlightHeadings: 'הדגשת כותרות',
      keyboardFocus: 'ניווט מקלדת מודגש',
      stopAnimations: 'עצירת אנימציות',
      bigCursor: 'סמן עכבר גדול',
      readingGuide: 'סרגל קריאה',
      reset: 'איפוס',
      resetDone: 'כל התאמות הנגישות אופסו',
      statement: 'הצהרת נגישות',
    },
    en: {
      launcher: 'Accessibility menu',
      title: 'Accessibility adjustments',
      close: 'Close the accessibility menu',
      hint: 'Keyboard shortcut: Alt+A to open and close, Esc to close.',
      skip: 'Skip to main content',
      active: '{n} adjustments on',
      on: 'on',
      off: 'off',
      sectionText: 'Text and readability',
      sectionColor: 'Color and contrast',
      sectionNav: 'Navigation',
      textSize: 'Text size',
      smaller: 'Decrease text size',
      larger: 'Increase text size',
      readableFont: 'Readable font',
      lineSpacing: 'Line spacing',
      letterSpacing: 'Letter spacing',
      dark: 'Dark contrast',
      light: 'Light contrast',
      invert: 'Invert colors',
      monochrome: 'Grayscale',
      highlightLinks: 'Highlight links',
      highlightHeadings: 'Highlight headings',
      keyboardFocus: 'Strong keyboard focus',
      stopAnimations: 'Stop animations',
      bigCursor: 'Large cursor',
      readingGuide: 'Reading guide',
      reset: 'Reset',
      resetDone: 'All accessibility adjustments were reset',
      statement: 'Accessibility statement',
    },
  };

  // ---------------------------------------------------------------- icons

  /** Font Awesome "universal-access" (CC BY 4.0), see header. */
  var UNIVERSAL_ACCESS =
    'M256 48c114.953 0 208 93.029 208 208 0 114.953-93.029 208-208 208-114.953 0-208-93.029-208-208 0-114.953 93.029-208 208-208m0-40C119.033 8 8 119.033 8 256s111.033 248 248 248 248-111.033 248-248S392.967 8 256 8zm0 56C149.961 64 64 149.961 64 256s85.961 192 192 192 192-85.961 192-192S362.039 64 256 64zm0 44c19.882 0 36 16.118 36 36s-16.118 36-36 36-36-16.118-36-36 16.118-36 36-36zm117.741 98.023c-28.712 6.779-55.511 12.748-82.14 15.807.851 101.023 12.306 123.052 25.037 155.621 3.617 9.26-.957 19.698-10.217 23.315-9.261 3.617-19.699-.957-23.316-10.217-8.705-22.308-17.086-40.636-22.261-78.549h-9.686c-5.167 37.851-13.534 56.208-22.262 78.549-3.615 9.255-14.05 13.836-23.315 10.217-9.26-3.617-13.834-14.056-10.217-23.315 12.713-32.541 24.185-54.541 25.037-155.621-26.629-3.058-53.428-9.027-82.141-15.807-8.6-2.031-13.926-10.648-11.895-19.249s10.647-13.926 19.249-11.895c96.686 22.829 124.283 22.783 220.775 0 8.599-2.03 17.218 3.294 19.249 11.895 2.029 8.601-3.297 17.219-11.897 19.249z';

  function universalAccess(size) {
    return (
      '<svg aria-hidden="true" focusable="false" width="' + size + '" height="' + size +
      '" viewBox="0 0 512 512"><path fill="currentColor" d="' + UNIVERSAL_ACCESS + '"/></svg>'
    );
  }

  // Line icons (24x24), drawn like the cookie banner's: close X, and the check / X inside switch knobs.
  var ICONS = {
    close: '<path d="M19.5 4.5l-15 15M4.5 4.5l15 15"/>',
    on: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    off: '<path d="M7 7l10 10M17 7L7 17"/>',
  };

  function icon(name, size, strokeWidth) {
    var s = size || 20;
    return (
      '<svg aria-hidden="true" focusable="false" width="' + s + '" height="' + s +
      '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + (strokeWidth || 1.5) +
      '" stroke-linecap="round" stroke-linejoin="round">' + ICONS[name] + '</svg>'
    );
  }

  // ---------------------------------------------------------------- preferences

  function defaults() {
    var prefs = { textScale: 100, contrast: 'none' };
    TOGGLES.forEach(function (key) {
      prefs[key] = false;
    });
    return prefs;
  }

  function sanitize(raw) {
    var prefs = defaults();
    if (!raw || typeof raw !== 'object') return prefs;
    if (TEXT_SCALE_STEPS.indexOf(raw.textScale) !== -1) prefs.textScale = raw.textScale;
    if (CONTRAST_MODES.indexOf(raw.contrast) !== -1) prefs.contrast = raw.contrast;
    TOGGLES.forEach(function (key) {
      if (typeof raw[key] === 'boolean') prefs[key] = raw[key];
    });
    return prefs;
  }

  function countActive(prefs) {
    var n = (prefs.textScale !== 100 ? 1 : 0) + (prefs.contrast !== 'none' ? 1 : 0);
    TOGGLES.forEach(function (key) {
      if (prefs[key]) n += 1;
    });
    return n;
  }

  function load(key) {
    try {
      var parsed = JSON.parse(window.localStorage.getItem(key) || 'null');
      if (!parsed || parsed.v !== STORAGE_VERSION) return defaults();
      return sanitize(parsed.prefs);
    } catch (e) {
      return defaults();
    }
  }

  function save(key, prefs) {
    try {
      if (countActive(prefs) === 0) window.localStorage.removeItem(key);
      else window.localStorage.setItem(key, JSON.stringify({ v: STORAGE_VERSION, prefs: prefs }));
    } catch (e) {
      /* storage blocked: adjustments still apply for this page view */
    }
  }

  function kebab(key) {
    return key.replace(/[A-Z]/g, function (c) {
      return '-' + c.toLowerCase();
    });
  }

  function applyToDocument(prefs) {
    var root = document.documentElement;
    TOGGLES.forEach(function (key) {
      root.classList.toggle(CLASS_PREFIX + kebab(key), prefs[key]);
    });
    CONTRAST_MODES.forEach(function (mode) {
      root.classList.toggle(CLASS_PREFIX + 'contrast-' + mode, prefs.contrast === mode);
    });
    // rem-based sites scale cleanly; px-based text needs the site to use rem/em (SI 5568 1.4.4).
    root.style.fontSize = prefs.textScale === 100 ? '' : prefs.textScale + '%';
  }

  // ---------------------------------------------------------------- page-level CSS

  var EXCLUDE = ':not(svg):not(svg *):not(#a11yw-host)';
  var NOT_MEDIA = ':not(img):not(video):not(svg):not(svg *):not(canvas):not(#a11yw-host)';
  var BIG_CURSOR =
    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='48' height='48' viewBox='0 0 24 24'%3E%3Cpath d='M4 2l16 11.5-7 1.2 4.2 7.3-3 1.7-4.2-7.3L4 21z' fill='%23000' stroke='%23fff' stroke-width='1.2' stroke-linejoin='round'/%3E%3C/svg%3E\") 6 2, auto";

  function pageCss() {
    var p = 'html.' + CLASS_PREFIX;
    return [
      p + 'readable-font body *' + EXCLUDE + ':not(code):not(pre){font-family:Arial,"Helvetica Neue",Helvetica,sans-serif!important}',
      p + 'line-spacing body *' + EXCLUDE + '{line-height:1.8!important}',
      p + 'letter-spacing body *' + EXCLUDE + '{letter-spacing:.12em!important;word-spacing:.16em!important}',
      // Filters on the root element do not create a containing block, so fixed elements keep working.
      p + 'contrast-monochrome{filter:grayscale(1)}',
      p + 'contrast-invert{filter:invert(1) hue-rotate(180deg)}',
      p + 'contrast-invert img,' + p + 'contrast-invert video,' + p + 'contrast-invert picture,' +
        p + 'contrast-invert canvas,' + p + 'contrast-invert iframe{filter:invert(1) hue-rotate(180deg)}',
      p + 'contrast-dark,' + p + 'contrast-dark body,' + p + 'contrast-dark body *' + NOT_MEDIA +
        '{background-color:#000!important;background-image:none!important;color:#fff!important;border-color:#fff!important;box-shadow:none!important;text-shadow:none!important}',
      p + 'contrast-dark body a[href],' + p + 'contrast-dark body a[href] *{color:#ffeb3b!important}',
      p + 'contrast-light,' + p + 'contrast-light body,' + p + 'contrast-light body *' + NOT_MEDIA +
        '{background-color:#fff!important;background-image:none!important;color:#000!important;border-color:#000!important;box-shadow:none!important;text-shadow:none!important}',
      p + 'contrast-light body a[href],' + p + 'contrast-light body a[href] *{color:#0000c8!important}',
      p + 'highlight-links body a[href]{text-decoration:underline!important;text-decoration-thickness:2px!important;text-underline-offset:3px!important;outline:2px solid #f5b400!important;outline-offset:2px!important}',
      p + 'highlight-headings body :is(h1,h2,h3,h4,h5,h6,[role="heading"]){outline:2px dashed #7c3aed!important;outline-offset:4px!important}',
      p + 'keyboard-focus body *:focus{outline:3px solid #f5b400!important;outline-offset:2px!important;box-shadow:0 0 0 6px #000!important}',
      p + 'stop-animations *,' + p + 'stop-animations *::before,' + p + 'stop-animations *::after' +
        '{animation-duration:.001ms!important;animation-delay:0s!important;animation-iteration-count:1!important;transition-duration:.001ms!important;transition-delay:0s!important;scroll-behavior:auto!important}',
      p + 'big-cursor,' + p + 'big-cursor *{cursor:' + BIG_CURSOR + '!important}',
      '.a11yw-skip{position:fixed;inset-inline-start:16px;top:16px;z-index:2147483647;transform:translateY(-200%);padding:12px 20px;border-radius:8px;background:#0a2353;color:#fff!important;font:600 16px/1.2 system-ui,Arial,sans-serif;text-decoration:none}',
      '.a11yw-skip:focus{transform:none;outline:3px solid #f5b400;outline-offset:2px}',
      '@media print{#a11yw-host,.a11yw-skip{display:none!important}}',
    ].join('\n');
  }

  // ---------------------------------------------------------------- widget CSS (inside shadow DOM)

  function widgetCss(cfg, side) {
    var style = ICON_STYLES[cfg.iconStyle];
    var th = THEMES[style.theme];
    var gap = 12;
    var panelSide = cfg.vertical === 'middle' ? cfg.offsetX + cfg.size + gap : cfg.offsetX;
    var launcherY =
      cfg.vertical === 'middle' ? 'top:50%;translate:0 -50%;' : cfg.vertical + ':' + cfg.offsetY + 'px;';
    var panelY =
      cfg.vertical === 'middle'
        ? 'top:50%;translate:0 -50%;max-height:calc(100vh - 32px);'
        : cfg.vertical + ':' + (cfg.offsetY + cfg.size + gap) + 'px;max-height:calc(100vh - ' + (cfg.offsetY + cfg.size + gap + 16) + 'px);';
    // White launchers get a soft shadow so they stand out on white pages.
    var launcherShadow = style.bg === '#ffffff' ? '0 3px 12px rgba(10,35,83,.28)' : '0 3px 12px rgba(0,0,0,.3)';

    return [
      ':host{all:initial}',
      // Same tokens as the cookie banner: 16px system font, .5rem panel radius, .4rem control radius.
      '.root{font:400 16px/1.15 system-ui,-apple-system,"Segoe UI",Arial,sans-serif;-webkit-font-smoothing:antialiased;letter-spacing:normal;word-spacing:normal;color:' + th.ink +
        ';--ink:' + th.ink + ';--ink2:' + th.ink2 + ';--accent:' + th.accent + ';--pale:' + th.pale + ';--line:' + th.line +
        ';--hover:' + th.hover + ';--off:' + th.off + ';--sep:' + th.sep + ';--r:.4rem}',
      '.root *{box-sizing:border-box;font:inherit;letter-spacing:inherit;line-height:inherit}',
      ':host(.inverted) .surface{filter:invert(1) hue-rotate(180deg)}',
      'button,a{cursor:pointer;-webkit-tap-highlight-color:transparent}',
      'button:focus-visible,a:focus-visible{outline:3px solid #f5b400;outline-offset:2px}',

      '.launcher{position:fixed;' + side + ':' + cfg.offsetX + 'px;' + launcherY + 'z-index:' + cfg.zIndex +
        ';width:' + cfg.size + 'px;height:' + cfg.size + 'px;padding:0;border:0;border-radius:50%;background:' + style.bg +
        ';color:' + style.fg + ';display:flex;align-items:center;justify-content:center;box-shadow:' + launcherShadow +
        ';transition:scale .15s ease}',
      '.launcher:hover{scale:1.06}',
      '.launcher svg{display:block}',
      '.badge{position:absolute;top:-3px;inset-inline-end:-3px;min-width:20px;height:20px;padding:0 5px;border-radius:10px;background:#f5b400;color:#000;font-size:12px;font-weight:800;display:flex;align-items:center;justify-content:center;box-shadow:0 0 0 2px #fff}',

      '.panel{position:fixed;' + side + ':' + panelSide + 'px;' + panelY + 'z-index:' + (cfg.zIndex + 1) +
        ';width:380px;max-width:calc(100vw - 32px);display:flex;flex-direction:column;overflow:hidden;background:#fff;border-radius:.5rem;box-shadow:0 .625em 1.875em rgba(0,0,2,.3)}',
      '@media (max-width:520px){.panel{' + side + ':16px}}',
      '.panel[hidden]{display:none}',
      // Header / body / footer: the cookie preferences window (.pm__header / .pm__body / .pm__footer).
      '.head{display:flex;align-items:center;justify-content:space-between;gap:1em;padding:1em 1.4em;border-bottom:1px solid var(--sep)}',
      '.head h2{margin:0;font-size:1em;font-weight:600;color:var(--ink)}',
      '.x{flex:none;width:44px;height:44px;padding:0;border:1px solid var(--ink);border-radius:var(--r);background:var(--pale);color:var(--ink);display:flex;align-items:center;justify-content:center;transition:background-color .15s ease}',
      '.x:hover{background:var(--line)}',
      '.body{flex:1;overflow-y:auto;scrollbar-width:thin;overscroll-behavior:contain;padding:1em 1.4em;display:flex;flex-direction:column;gap:1.1em}',
      '.hint{margin:0;font-size:.9em;line-height:1.5;color:var(--ink2)}',
      '.section h3{margin:0 0 .5em;font-size:.95em;font-weight:600;color:var(--ink)}',
      '.list{display:flex;flex-direction:column;gap:.375rem}',
      // A feature row = a cookie category block with its switch (.pm__section--toggle + .section__toggle).
      '.row{width:100%;min-height:58px;display:flex;align-items:center;justify-content:space-between;gap:1em;padding:1.1em 1.2em;border:1px solid var(--line);border-radius:var(--r);background:var(--pale);color:var(--ink);font-size:.95em;font-weight:600;text-align:start;transition:background-color .25s ease,border-color .25s ease}',
      '.row:hover{background:var(--hover)}',
      '.switch{flex:none;position:relative;width:50px;height:23px;border-radius:4em;background:var(--off);box-shadow:0 0 0 1px var(--off);transition:background-color .25s ease,box-shadow .25s ease}',
      '.knob{position:absolute;top:0;inset-inline-start:0;width:23px;height:23px;border-radius:50%;background:#fff;box-shadow:0 1px 2px rgba(24,32,35,.36);color:var(--off);display:flex;align-items:center;justify-content:center;transition:inset-inline-start .25s ease,color .25s ease}',
      '.knob svg{display:block}',
      '.knob .on{display:none}',
      '.row[aria-pressed="true"] .switch{background:var(--accent);box-shadow:0 0 0 1px var(--accent)}',
      '.row[aria-pressed="true"] .knob{inset-inline-start:27px;color:var(--accent)}',
      '.row[aria-pressed="true"] .knob .on{display:block}',
      '.row[aria-pressed="true"] .knob .off{display:none}',
      '.size{min-height:58px;display:flex;align-items:center;justify-content:space-between;gap:1em;padding:.5em .7em .5em 1.2em;border:1px solid var(--line);border-radius:var(--r);background:var(--pale)}',
      '.size span{font-size:.95em;font-weight:600;color:var(--ink)}',
      '.step{flex:none;width:44px;height:44px;padding:0;border:1px solid var(--ink);border-radius:var(--r);background:#fff;color:var(--ink);font-weight:600;font-size:.95em;transition:background-color .15s ease}',
      '.step:hover{background:var(--line)}',
      '.step:disabled{opacity:.35;cursor:not-allowed}',
      // Footer buttons = .pm__btn: primary (ink) and secondary (pale with ink border), equal size.
      '.foot{display:flex;align-items:center;gap:.375rem;padding:1em 1.4em;border-top:1px solid var(--sep)}',
      '.btn{flex:1;min-height:44px;min-width:110px;display:flex;align-items:center;justify-content:center;padding:.5em 1.5em;border:1px solid var(--ink);border-radius:var(--r);background:var(--ink);color:#fff;font-size:.82em;font-weight:600;text-align:center;text-decoration:none;transition:background-color .15s ease,border-color .15s ease}',
      '.btn:hover{background:var(--accent);border-color:var(--accent)}',
      '.btn.secondary{background:var(--pale);color:var(--ink);border-color:var(--ink)}',
      '.btn.secondary:hover{background:var(--line);border-color:var(--ink)}',
      '.sr{position:absolute;width:1px;height:1px;margin:-1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}',
      '.guide{position:fixed;inset-inline:0;height:0;border-top:4px solid #f5b400;pointer-events:none;z-index:' + (cfg.zIndex + 2) + '}',
    ].join('\n');
  }

  // ---------------------------------------------------------------- widget

  function init() {
    var cfg = readConfig();
    var prefs = load(cfg.storageKey);
    var open = false;
    var langObserver = null;

    var style = document.createElement('style');
    style.id = 'a11yw-page-css';
    style.textContent = pageCss();
    document.head.appendChild(style);

    var skip = null;
    if (cfg.skipLink) {
      skip = document.createElement('a');
      skip.className = 'a11yw-skip';
      skip.href = '#main-content';
      skip.addEventListener('click', onSkip);
      document.body.insertBefore(skip, document.body.firstChild);
    }

    var host = document.createElement('div');
    host.id = 'a11yw-host';
    document.body.appendChild(host);
    var shadow = host.attachShadow({ mode: 'open' });

    function lang() {
      if (cfg.lang === 'he' || cfg.lang === 'en') return cfg.lang;
      return /^he|^iw/i.test(document.documentElement.lang || '') ? 'he' : 'en';
    }
    function t(key, n) {
      var s = STRINGS[lang()][key];
      return n === undefined ? s : s.replace('{n}', String(n));
    }
    function side() {
      if (cfg.horizontal === 'left' || cfg.horizontal === 'right') return cfg.horizontal;
      var rtl = lang() === 'he';
      return (cfg.horizontal === 'start') === rtl ? 'right' : 'left';
    }

    function tile(action, key, pressed) {
      // The switch is decoration; state is exposed by aria-pressed on the button.
      return (
        '<button type="button" class="row" data-action="' + action + '" data-key="' + key + '" aria-pressed="' + pressed +
        '"><span>' + t(key) + '</span><span class="switch" aria-hidden="true"><span class="knob">' +
        icon('on', 16, 2.5).replace('<svg', '<svg class="on"') + icon('off', 16, 2.5).replace('<svg', '<svg class="off"') +
        '</span></span></button>'
      );
    }

    function render() {
      var dir = lang() === 'he' ? 'rtl' : 'ltr';
      var statement = cfg.statementUrl
        ? '<a class="btn" href="' + cfg.statementUrl.replace(/"/g, '&quot;') + '">' + t('statement') + '</a>'
        : '';
      var max = TEXT_SCALE_STEPS[TEXT_SCALE_STEPS.length - 1];

      shadow.innerHTML =
        '<style>' + widgetCss(cfg, side()) + '</style>' +
        '<div class="root" dir="' + dir + '" lang="' + lang() + '">' +
        '<button type="button" class="launcher surface" data-action="toggle" aria-expanded="' + open +
        '" aria-controls="a11yw-panel" aria-keyshortcuts="Alt+A" title="' + t('launcher') + '"></button>' +
        '<div class="panel surface" id="a11yw-panel" role="dialog" aria-modal="false" aria-labelledby="a11yw-title"' +
        (open ? '' : ' hidden') + '>' +
        '<div class="head"><h2 id="a11yw-title">' + t('title') + '</h2>' +
        '<button type="button" class="x" data-action="close" aria-label="' + t('close') + '">' + icon('close', 20) + '</button></div>' +
        '<div class="body">' +
        '<p class="hint">' + t('hint') + '</p>' +
        '<div class="section" role="group" aria-labelledby="a11yw-s1"><h3 id="a11yw-s1">' + t('sectionText') + '</h3><div class="list">' +
        '<div class="size"><button type="button" class="step" data-action="smaller" aria-label="' + t('smaller') + '"' +
        (prefs.textScale <= 100 ? ' disabled' : '') + '><span dir="ltr">A-</span></button><span>' + t('textSize') + ' ' + prefs.textScale +
        '%</span><button type="button" class="step" data-action="larger" aria-label="' + t('larger') + '"' +
        (prefs.textScale >= max ? ' disabled' : '') + '><span dir="ltr">A+</span></button></div>' +
        tile('toggle-pref', 'readableFont', prefs.readableFont) +
        tile('toggle-pref', 'lineSpacing', prefs.lineSpacing) +
        tile('toggle-pref', 'letterSpacing', prefs.letterSpacing) +
        '</div></div>' +
        '<div class="section" role="group" aria-labelledby="a11yw-s2"><h3 id="a11yw-s2">' + t('sectionColor') + '</h3><div class="list">' +
        CONTRAST_MODES.map(function (m) {
          return tile('contrast', m, prefs.contrast === m);
        }).join('') +
        '</div></div>' +
        '<div class="section" role="group" aria-labelledby="a11yw-s3"><h3 id="a11yw-s3">' + t('sectionNav') + '</h3><div class="list">' +
        ['highlightLinks', 'highlightHeadings', 'keyboardFocus', 'stopAnimations', 'bigCursor', 'readingGuide']
          .map(function (k) {
            return tile('toggle-pref', k, prefs[k]);
          })
          .join('') +
        '</div></div>' +
        '</div>' +
        '<div class="foot"><button type="button" class="btn secondary" data-action="reset">' + t('reset') + '</button>' + statement + '</div>' +
        '</div>' +
        '<div class="guide" hidden></div>' +
        '<div class="sr" role="status" aria-live="polite"></div>' +
        '</div>';
      updateLauncher();
      updateGuide();
    }

    function $(sel) {
      return shadow.querySelector(sel);
    }

    function updateLauncher() {
      var n = countActive(prefs);
      var launcher = $('.launcher');
      launcher.innerHTML =
        universalAccess(cfg.size) + (n > 0 ? '<span class="badge" aria-hidden="true">' + n + '</span>' : '');
      launcher.setAttribute('aria-label', n > 0 ? t('launcher') + ' (' + t('active', n) + ')' : t('launcher'));
      launcher.setAttribute('aria-expanded', String(open));
    }

    function announce(text) {
      var region = $('.sr');
      region.textContent = '';
      // A fresh text node after a tick makes screen readers repeat identical messages.
      setTimeout(function () {
        region.textContent = text;
      }, 30);
    }

    function commit(message, focusSelector) {
      applyToDocument(prefs);
      host.classList.toggle('inverted', prefs.contrast === 'invert');
      save(cfg.storageKey, prefs);
      syncVideos();
      render();
      if (focusSelector) {
        var el = $(focusSelector);
        // A text-size button that just hit its limit is disabled; keep focus on its sibling.
        if (el && el.disabled) el = $(focusSelector.indexOf('larger') !== -1 ? '[data-action="smaller"]' : '[data-action="larger"]');
        if (el) el.focus();
      }
      if (message) announce(message);
    }

    function setOpen(next, returnFocus) {
      open = next;
      $('.panel').hidden = !open;
      updateLauncher();
      if (open) $('.x').focus();
      else if (returnFocus) $('.launcher').focus();
    }

    shadow.addEventListener('click', function (event) {
      var target = event.target.closest('[data-action]');
      if (!target) return;
      var action = target.getAttribute('data-action');
      var key = target.getAttribute('data-key');
      var state = function (on) {
        return on ? t('on') : t('off');
      };
      if (action === 'toggle') setOpen(!open, false);
      else if (action === 'close') setOpen(false, true);
      else if (action === 'toggle-pref') {
        prefs[key] = !prefs[key];
        commit(t(key) + ': ' + state(prefs[key]), '[data-key="' + key + '"]');
      } else if (action === 'contrast') {
        prefs.contrast = prefs.contrast === key ? 'none' : key;
        commit(t(key) + ': ' + state(prefs.contrast === key), '[data-key="' + key + '"]');
      } else if (action === 'smaller' || action === 'larger') {
        var i = TEXT_SCALE_STEPS.indexOf(prefs.textScale) + (action === 'larger' ? 1 : -1);
        prefs.textScale = TEXT_SCALE_STEPS[Math.max(0, Math.min(TEXT_SCALE_STEPS.length - 1, i))];
        commit(t('textSize') + ' ' + prefs.textScale + '%', '[data-action="' + action + '"]');
      } else if (action === 'reset') {
        prefs = defaults();
        commit(t('resetDone'), '[data-action="reset"]');
      }
    });

    function onKeyDown(event) {
      if (cfg.shortcut && event.altKey && !event.ctrlKey && !event.metaKey && event.code === 'KeyA') {
        event.preventDefault();
        setOpen(!open, open);
        return;
      }
      if (event.key === 'Escape' && open) setOpen(false, true);
    }

    function onPointerDown(event) {
      if (!open) return;
      var path = event.composedPath ? event.composedPath() : [];
      if (path.indexOf(host) !== -1) return;
      setOpen(false, false);
    }

    function onSkip(event) {
      var target =
        document.getElementById('main-content') ||
        document.querySelector('main, [role="main"]') ||
        document.querySelector('h1');
      if (!target) return;
      event.preventDefault();
      if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
      target.scrollIntoView({ block: 'start' });
    }

    // Reading guide follows the pointer.
    var guideFrame = 0;
    var guideY = -100;
    function onPointerMove(event) {
      guideY = event.clientY;
      if (guideFrame) return;
      guideFrame = requestAnimationFrame(function () {
        guideFrame = 0;
        var g = $('.guide');
        if (g) g.style.top = guideY + 14 + 'px';
      });
    }
    function updateGuide() {
      var g = $('.guide');
      g.hidden = !prefs.readingGuide;
      g.style.top = guideY + 14 + 'px';
      if (prefs.readingGuide) window.addEventListener('pointermove', onPointerMove, { passive: true });
      else window.removeEventListener('pointermove', onPointerMove);
    }

    // "Stop animations": pause videos that start on their own; a video the visitor plays on purpose is left alone.
    function pauseVideo(video) {
      if (video.getAttribute('data-a11yw-paused') === '1' || !video.autoplay) return;
      video.setAttribute('data-a11yw-paused', '1');
      video.pause();
    }
    function onPlay(event) {
      if (prefs.stopAnimations && event.target && event.target.tagName === 'VIDEO') pauseVideo(event.target);
    }
    function syncVideos() {
      var videos = document.querySelectorAll('video');
      for (var i = 0; i < videos.length; i++) {
        if (prefs.stopAnimations) pauseVideo(videos[i]);
        else videos[i].removeAttribute('data-a11yw-paused');
      }
    }

    function renderSkipText() {
      if (skip) {
        skip.textContent = t('skip');
        skip.setAttribute('lang', lang());
      }
    }

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('play', onPlay, true);

    if (cfg.lang === 'auto' && window.MutationObserver) {
      // SPA language switches change <html lang>; follow them.
      langObserver = new MutationObserver(function () {
        renderSkipText();
        render();
      });
      langObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['lang', 'dir'] });
    }

    applyToDocument(prefs);
    host.classList.toggle('inverted', prefs.contrast === 'invert');
    syncVideos();
    renderSkipText();
    render();

    window.A11yWidget = {
      version: VERSION,
      open: function () {
        setOpen(true);
      },
      close: function () {
        setOpen(false, true);
      },
      toggle: function () {
        setOpen(!open, open);
      },
      reset: function () {
        prefs = defaults();
        commit(t('resetDone'));
      },
      getPreferences: function () {
        return JSON.parse(JSON.stringify(prefs));
      },
      setPreferences: function (partial) {
        var merged = {};
        for (var k in prefs) merged[k] = prefs[k];
        for (var p in partial || {}) merged[p] = partial[p];
        prefs = sanitize(merged);
        commit();
      },
      destroy: function () {
        document.removeEventListener('keydown', onKeyDown);
        document.removeEventListener('pointerdown', onPointerDown);
        document.removeEventListener('play', onPlay, true);
        window.removeEventListener('pointermove', onPointerMove);
        if (langObserver) langObserver.disconnect();
        applyToDocument(defaults());
        host.remove();
        style.remove();
        if (skip) skip.remove();
        delete window.A11yWidget;
        window.__a11ywLoaded = false;
      },
    };
  }

  if (document.body) init();
  else document.addEventListener('DOMContentLoaded', init);
})();
