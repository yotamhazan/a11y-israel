/*!
 * Israeli setup for vanilla-cookieconsent v3 (https://github.com/orestbida/cookieconsent, MIT).
 * Hebrew + English, RTL, equal-weight "accept" / "necessary only" buttons, Google Consent Mode v2,
 * tracker cookies cleared when consent is withdrawn.
 *
 * Load order in <head>, BEFORE Google Tag Manager / gtag / any tracker, WITHOUT defer:
 *   <link rel="stylesheet" href="/cookie-consent/cookieconsent.css">
 *   <link rel="stylesheet" href="/cookie-consent/cookie-consent.theme.css">
 *   <script src="/cookie-consent/cookieconsent.umd.js"></script>
 *   <script src="/cookie-consent/cookie-consent.config.js"></script>
 *
 * Block a tracker until consent:  <script type="text/plain" data-category="analytics" src="..."></script>
 * Footer link to change the choice: <button type="button" data-cc="show-preferencesModal">הגדרות עוגיות</button>
 */
(function () {
  'use strict';

  // ================================================================ EDIT FOR EACH SITE
  // Fill these from what the site's code actually loads. Remove a category that has no tools.
  var SITE = {
    privacyUrl: '/privacy',
    // Bump when a new tracker or purpose is added: everyone is asked again.
    revision: 1,
    // Tools per category, as visitors know them. Empty list = category is not shown.
    services: {
      functional: [], // e.g. 'YouTube', 'Google Maps', 'WhatsApp chat'
      analytics: ['Google Analytics'], // e.g. 'Hotjar', 'Microsoft Clarity', 'PostHog'
      marketing: ['Meta Pixel'], // e.g. 'Google Ads', 'TikTok Pixel', 'LinkedIn Insight'
    },
  };
  // ================================================================ END OF SITE SETTINGS

  // Google Consent Mode v2: everything optional is denied until the visitor chooses.
  window.dataLayer = window.dataLayer || [];
  if (typeof window.gtag !== 'function') {
    window.gtag = function () {
      window.dataLayer.push(arguments);
    };
  }
  var hasFunctional = SITE.services.functional.length > 0;
  window.gtag('consent', 'default', {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    analytics_storage: 'denied',
    functionality_storage: hasFunctional ? 'denied' : 'granted',
    personalization_storage: hasFunctional ? 'denied' : 'granted',
    security_storage: 'granted',
    wait_for_update: 500,
  });

  function updateGoogleConsent() {
    var on = function (c) {
      return window.CookieConsent.acceptedCategory(c) ? 'granted' : 'denied';
    };
    window.gtag('consent', 'update', {
      ad_storage: on('marketing'),
      ad_user_data: on('marketing'),
      ad_personalization: on('marketing'),
      analytics_storage: on('analytics'),
      functionality_storage: hasFunctional ? on('functional') : 'granted',
      personalization_storage: hasFunctional ? on('functional') : 'granted',
    });
    window.dataLayer.push({ event: 'cookie_consent_update' });
  }

  // Cookies the common trackers leave on the site's own domain.
  var TRACKER_COOKIES = {
    analytics: [/^_ga/, /^_gid$/, /^_gat/, /^_hj/, /^_clck$/, /^_clsk$/, /^ph_/, /^mp_/, /^ajs_/],
    marketing: [/^_fbp$/, /^_fbc$/, /^_gcl_/, /^_uet/, /^_tt_/, /^_ttp$/, /^ttcid$/, /^_pin_/, /^_scid/, /^li_/, /^_rdt_/],
    functional: [],
  };

  var categories = { necessary: { enabled: true, readOnly: true } };
  ['functional', 'analytics', 'marketing'].forEach(function (c) {
    if (!SITE.services[c].length) return;
    categories[c] = {
      autoClear: {
        cookies: TRACKER_COOKIES[c].map(function (re) {
          return { name: re };
        }),
        // Scripts that already ran cannot be unloaded; a reload stops them after withdrawal.
        reloadPage: true,
      },
    };
  });

  function tools(c, label) {
    return SITE.services[c].length ? '<br>' + label + SITE.services[c].join(', ') : '';
  }
  function section(c, title, description, label) {
    if (!SITE.services[c].length) return null;
    return { title: title, description: description + tools(c, label), linkedCategory: c };
  }
  function compact(list) {
    return list.filter(Boolean);
  }
  var policyLink = function (text) {
    return '<a href="' + SITE.privacyUrl + '">' + text + '</a>';
  };

  var config = {
    revision: SITE.revision,
    mode: 'opt-in',
    manageScriptTags: true,
    autoClearCookies: true,
    hideFromBots: true,
    disablePageInteraction: false,
    cookie: { name: 'cc_cookie', expiresAfterDays: 365, sameSite: 'Lax' },
    guiOptions: {
      // Equal-weight buttons: refusing has to be as easy as agreeing.
      consentModal: { layout: 'box wide', position: 'bottom center', equalWeightButtons: true, flipButtons: false },
      preferencesModal: { layout: 'box', equalWeightButtons: true, flipButtons: false },
    },
    onConsent: updateGoogleConsent,
    onChange: updateGoogleConsent,
    categories: categories,
    language: {
      default: 'he',
      rtl: 'he',
      autoDetect: 'document',
      translations: {
        he: {
          consentModal: {
            label: 'הסכמה לעוגיות',
            title: 'עוגיות באתר',
            description:
              'אנחנו משתמשים בעוגיות הכרחיות כדי שהאתר יעבוד. בהסכמתך נשתמש גם בעוגיות נוספות — הבחירה שלך, ואפשר לשנות אותה בכל עת דרך "הגדרות עוגיות" בתחתית האתר. ' +
              policyLink('למדיניות הפרטיות'),
            acceptAllBtn: 'אישור הכול',
            acceptNecessaryBtn: 'רק הכרחיות',
            showPreferencesBtn: 'התאמה אישית',
            closeIconLabel: 'סגירה בלי הסכמה',
            revisionMessage: '<br>עדכנו את השימוש בעוגיות מאז הביקור הקודם, ולכן נבקש את בחירתך מחדש.',
          },
          preferencesModal: {
            title: 'הגדרות עוגיות',
            acceptAllBtn: 'אישור הכול',
            acceptNecessaryBtn: 'רק הכרחיות',
            savePreferencesBtn: 'שמירת הבחירה',
            closeIconLabel: 'סגירה',
            serviceCounterLabel: 'שירות|שירותים',
            sections: compact([
              { description: 'בחרו אילו סוגי עוגיות לאפשר. עוגיות הכרחיות תמיד פעילות. אפשר לחזור לכאן ולשנות בכל עת. ' + policyLink('למדיניות הפרטיות') },
              {
                title: 'הכרחיות <span class="pm__badge">תמיד פעילות</span>',
                description: 'נדרשות כדי שהאתר יעבוד ויהיה מאובטח, ולשמירת הבחירה הזו והעדפות הנגישות. אינן משמשות לפרסום.',
                linkedCategory: 'necessary',
              },
              section('functional', 'פונקציונליות', 'מפעילות תכנים ושירותים מוטמעים כמו צ\'אט, מפות וסרטונים.', 'כלים: '),
              section('analytics', 'סטטיסטיקה', 'עוזרות לנו להבין איך משתמשים באתר כדי לשפר אותו.', 'כלים: '),
              section('marketing', 'שיווק', 'משמשות להצגת פרסומות מותאמות ולמדידת קמפיינים. המידע עשוי לעבור לחברות הפרסום, גם מחוץ לישראל.', 'כלים: '),
            ]),
          },
        },
        en: {
          consentModal: {
            label: 'Cookie consent',
            title: 'Cookies on this site',
            description:
              'We use necessary cookies to make this site work. With your consent we will also use other cookies — it is your choice, and you can change it at any time from "Cookie settings" at the bottom of the site. ' +
              policyLink('Privacy policy'),
            acceptAllBtn: 'Accept all',
            acceptNecessaryBtn: 'Necessary only',
            showPreferencesBtn: 'Customize',
            closeIconLabel: 'Close without consenting',
            revisionMessage: '<br>We changed how we use cookies since your last visit, so we are asking again.',
          },
          preferencesModal: {
            title: 'Cookie settings',
            acceptAllBtn: 'Accept all',
            acceptNecessaryBtn: 'Necessary only',
            savePreferencesBtn: 'Save my choice',
            closeIconLabel: 'Close',
            serviceCounterLabel: 'service|services',
            sections: compact([
              { description: 'Choose which kinds of cookies to allow. Necessary cookies are always on. You can come back and change this at any time. ' + policyLink('Privacy policy') },
              {
                title: 'Necessary <span class="pm__badge">Always on</span>',
                description: 'Needed for the site to work and stay secure, and to remember this choice and your accessibility preferences. Never used for advertising.',
                linkedCategory: 'necessary',
              },
              section('functional', 'Functional', 'Enable embedded content and services such as chat, maps and videos.', 'Tools: '),
              section('analytics', 'Analytics', 'Help us understand how the site is used so we can improve it.', 'Tools: '),
              section('marketing', 'Marketing', 'Used to show personalized ads and measure campaigns. Data may be shared with advertising companies, including outside Israel.', 'Tools: '),
            ]),
          },
        },
      },
    },
  };

  // The consent default above must run in <head> before GTM; the banner itself needs <body>.
  function start() {
    window.CookieConsent.run(config);
  }
  if (document.body) start();
  else document.addEventListener('DOMContentLoaded', start);
})();
