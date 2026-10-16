# באנר הסכמה לעוגיות — vanilla-cookieconsent בהגדרה ישראלית

מבוסס על [vanilla-cookieconsent](https://github.com/orestbida/cookieconsent) גרסה 3.1.0 (רישיון MIT, הקבצים ב-`vendor/`). מה שהוספנו: הגדרה מוכנה לאתר בישראל.

- עברית ואנגלית, RTL. השפה נקבעת לפי `<html lang>`.
- "אישור הכול" ו"רק הכרחיות" מופיעים כבר בשכבה הראשונה ובאותו משקל, כי לסרב צריך להיות קל כמו להסכים.
- שום סקריפט שאינו הכרחי לא רץ לפני הסכמה (`manageScriptTags`).
- Google Consent Mode v2: ברירת המחדל היא "לא מאושר", והמצב מתעדכן אחרי שהגולש בוחר.
- גולש שמבטל הסכמה: עוגיות המעקב נמחקות והעמוד נטען מחדש.
- הבחירה נשמרת שנה. כשמעלים את `revision` כולם נשאלים שוב.
- צבעים תואמים לתפריט הנגישות, ניגודיות של 4.5:1 לפחות, focus בולט וכפתורים בגובה 44px לפחות.

## התקנה

1. מעתיקים את התיקייה לתיקייה הציבורית של האתר, למשל `public/cookie-consent/`: `vendor/cookieconsent.umd.js`, `vendor/cookieconsent.css`, `cookie-consent.config.js`, `cookie-consent.theme.css`.
2. ממלאים ב-`cookie-consent.config.js` את החלק `SITE`: קישור למדיניות הפרטיות, ובכל קטגוריה את הכלים שהאתר טוען בפועל. קטגוריה בלי כלים לא תוצג.
3. מוסיפים ב-`<head>`, **לפני** GTM / gtag וכל כלי מעקב, ו**בלי** `defer`:

```html
<link rel="stylesheet" href="/cookie-consent/cookieconsent.css">
<link rel="stylesheet" href="/cookie-consent/cookie-consent.theme.css">
<script src="/cookie-consent/cookieconsent.umd.js"></script>
<script src="/cookie-consent/cookie-consent.config.js"></script>
```

4. חוסמים כל סקריפט שאינו הכרחי עד ההסכמה, עם `type="text/plain"` ו-`data-category`:

```html
<script type="text/plain" data-category="analytics" src="https://www.googletagmanager.com/gtag/js?id=G-XXXX"></script>
<script type="text/plain" data-category="marketing">/* Meta Pixel */</script>
```

אתר שמשתמש ב-GTM: משאירים את GTM רגיל, וב-GTM מגדירים לכל תג דרישת הסכמה (Consent Settings). Consent Mode מטפל בשאר.

5. בפוטר של כל עמוד, ליד מדיניות הפרטיות, מוסיפים כפתור לשינוי הבחירה:

```html
<button type="button" data-cc="show-preferencesModal">הגדרות עוגיות</button>
```

## React / Next.js

אפשר לטעון את אותם הקבצים מ-`public/`. ב-Next.js עושים את זה ב-layout הראשי עם `<Script strategy="beforeInteractive">`. אפשרות אחרת היא `npm i vanilla-cookieconsent@3.1.0`, ואז קוראים ל-`CookieConsent.run(config)` מתוך `useEffect` ומעתיקים את אובייקט ההגדרה מהקובץ.

## מה הבאנר לא עושה

הבאנר לא מחליף את מדיניות הפרטיות. כל כלי שמופיע ב-`SITE.services` צריך להופיע גם במדיניות: מה הוא אוסף, למה, ולאן המידע עובר, כולל העברה לחו"ל. הבאנר גם לא חוסם סקריפט שלא סומן ב-`data-category`, ולכן צריך לעבור על כל ה-`<script>` באתר.
