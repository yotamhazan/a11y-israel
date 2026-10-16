# תפריט נגישות עצמאי — לכל אתר

קובץ אחד (`a11y-widget.js`, כ-35KB), בלי תלויות, בלי שליחת מידע לשום מקום, עובד בכל אתר: HTML רגיל, React / Next / Vite, וורדפרס, Wix, Shopify, Webflow.

> חשוב: התפריט הוא כלי עזר לגולש. הוא **לא** הופך אתר לא נגיש לנגיש — האתר עצמו חייב לעמוד בת"י 5568 (ראו `../../references/accessibility.md`).

**הדרך הקלה:** פותחים את דף ההגדרה — https://yotamhazan.github.io/a11y-israel/ — בוחרים צבע, גודל ומיקום, רואים תצוגה מקדימה ומעתיקים את השורה המוכנה.

## התקנה — אפשרות 1: הקובץ באתר שלכם (מומלץ)

1. מעתיקים את `a11y-widget.js` לתיקייה הציבורית של הפרויקט (`public/` ב-Vite/Next/React, תיקיית התבנית בוורדפרס וכו').
2. מוסיפים לפני `</body>`:

```html
<script src="/a11y-widget.js" data-statement-url="/accessibility" defer></script>
```

כך שום גורם חיצוני לא מעורב, ואין מה להוסיף למדיניות הפרטיות.

## התקנה — אפשרות 2: ישירות מ-GitHub, בלי להעתיק קבצים

מתאים לאתרים בלי גישה לקבצים (Wix, Shopify, בוני אתרים):

```html
<script src="https://cdn.jsdelivr.net/gh/yotamhazan/a11y-israel@v2.1.0/plugins/a11y-israel/skills/israel-web-compliance/assets/a11y-widget/a11y-widget.js"
        data-statement-url="/accessibility" defer></script>
```

הקובץ נטען משרת jsDelivr, ולכן כתובת ה-IP של הגולש עוברת אליו. יש לציין את זה במדיניות הפרטיות של האתר. הגרסה (`@v2.1.0`) נעולה בכתובת, כך שעדכון עתידי לא ישנה אתר קיים בלי שתבחרו בזה.

## הגדרות (כולן אופציונליות)

| מאפיין | ברירת מחדל | אפשרויות |
|---|---|---|
| `data-icon-style` | `blue-white` | צבע האייקון על הרקע: `blue-white` כחול על לבן · `white-blue` לבן על כחול · `black-white` שחור על לבן · `white-black` לבן על שחור. בסגנונות השחורים גם התפריט עצמו בשחור-אפור |
| `data-size` | `medium` | `small` (44px) · `medium` (56px) · `large` (68px) · או מספר פיקסלים (מינימום 44) |
| `data-position` | `bottom-start` | `{top|middle|bottom}-{right|left|start|end}`. למשל `bottom-right`, `middle-left`. `start` = ימין בעברית ושמאל באנגלית |
| `data-offset-x` / `data-offset-y` | `16` / `24` | מרחק מהצד ומהקצה העליון/התחתון בפיקסלים (להזיז מעל צ'אט או סרגל תחתון) |
| `data-lang` | `auto` | `he` / `en`. ב-`auto` נקבע לפי `<html lang>`, ומתעדכן לבד כשהאתר מחליף שפה |
| `data-statement-url` | — | קישור להצהרת הנגישות בתחתית התפריט (מומלץ מאוד) |
| `data-skip-link` | `true` | מוסיף קישור "דילוג לתוכן הראשי" (מכוון ל-`id="main-content"` או ל-`<main>`) |
| `data-shortcut` | `true` | קיצור Alt+A |

אפשר גם להגדיר ב-JS לפני טעינת הסקריפט:

```html
<script>window.A11yWidgetConfig = { iconStyle: 'white-blue', size: 'large', position: 'middle-right', statementUrl: '/accessibility' };</script>
```

## React / Next.js

- Vite / CRA: הקובץ ב-`public/`, השורה ב-`index.html`.
- Next.js: הקובץ ב-`public/`, ובקובץ ה-layout הראשי: `<Script src="/a11y-widget.js" data-statement-url="/accessibility" strategy="afterInteractive" />`.
- שליטה מקוד: `window.A11yWidget.open()`, `.close()`, `.reset()`, `.getPreferences()`, `.setPreferences({ contrast: 'dark' })`, `.destroy()`.

## מה יש בתפריט

הגדלת טקסט עד 200% · גופן קריא · ריווח שורות · ריווח אותיות · ניגודיות כהה · ניגודיות בהירה · היפוך צבעים · שחור-לבן · הדגשת קישורים · הדגשת כותרות · ניווט מקלדת מודגש · עצירת אנימציות (כולל סרטונים שמתחילים לבד) · סמן גדול · סרגל קריאה · איפוס · קישור להצהרה.

ההעדפות נשמרות ב-localStorage של הגולש בלבד. התפריט עצמו נגיש: מקלדת מלאה, Esc סוגר ומחזיר פוקוס, `aria-pressed` לכל כפתור, הכרזה לקורא מסך על כל שינוי, והוא מבודד ב-Shadow DOM כך שעיצוב האתר לא שובר אותו.

## הערה על הגדלת טקסט

ההגדלה משנה את גודל הגופן של `<html>`, ולכן עובדת על טקסט שמוגדר ב-`rem` (כמו ב-Tailwind). טקסט שמוגדר ב-`px` קבועים לא יגדל — וזו גם בעיה מול סעיף 1.4.4 בתקן, אז כדאי לתקן אותו באתר.

## קבצים בתיקייה

- `a11y-widget.js` — התפריט.
- `configurator.html` — דף הגדרה עם תצוגה מקדימה וקוד להעתקה.
- `accessibility-statement.he.html` — תבנית הצהרת נגישות (להחליף את כל ה-[סוגריים]).
- `demo.html` — עמוד דוגמה.

## קרדיט

האייקון "universal-access" מתוך Font Awesome Free 5.2.0 (https://fontawesome.com), ברישיון CC BY 4.0.
