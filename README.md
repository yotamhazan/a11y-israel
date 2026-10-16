# a11y-israel — נגישות ופרטיות לאתרים בישראל

שלושה דברים ברפוזיטורי אחד:

1. **תפריט נגישות** לכל אתר: קובץ JavaScript אחד, בלי תלויות ובלי שליחת מידע, בעברית ובאנגלית, עם בחירת צבע, גודל ומיקום.
2. **באנר הסכמה לעוגיות** מבוסס [vanilla-cookieconsent](https://github.com/orestbida/cookieconsent) בהגדרה ישראלית:
   - עברית ו-RTL.
   - "אישור הכול" ו"רק הכרחיות" באותו משקל.
   - שום כלי מעקב לא נטען לפני הסכמה.
   - Google Consent Mode v2.
   - עיצוב זהה לתפריט הנגישות.
3. **סקיל ל-Claude Code** שבודק ובונה אתרים לפי החוק בישראל:
   - נגישות לפי ת"י 5568 חלק 1 ברמה AA (תקנה 35).
   - פרטיות לפי חוק הגנת הפרטיות, כולל תיקון 13.
   - מתקין בכל פרויקט את תפריט הנגישות, ואת באנר העוגיות כשהאתר צריך אותו.

> תפריט נגישות הוא כלי עזר לגולש, לא תחליף לאתר נגיש. בית משפט בוחן את האתר עצמו מול התקן — ולכן הסקיל בודק גם את הקוד, הטפסים, הצהרת הנגישות ומדיניות הפרטיות. זה לא ייעוץ משפטי.

---

## התקנה ב-Claude Code (סקיל + תפריט)

בתוך Claude Code:

```
/plugin marketplace add yotamhazan/a11y-israel
/plugin install a11y-israel@a11y-israel
```

או מהטרמינל:

```bash
claude plugin marketplace add yotamhazan/a11y-israel
claude plugin install a11y-israel@a11y-israel
```

זהו. מעכשיו, בכל פרויקט של אתר לקהל בישראל, Claude מפעיל את הסקיל לבד (אפשר גם ידנית: `/a11y-israel:israel-web-compliance`). הוא בודק את האתר מול החוק, מתקין את תפריט הנגישות ומכין הצהרת נגישות.

עדכון לגרסה חדשה: `claude plugin marketplace update a11y-israel` ואז `claude plugin update a11y-israel@a11y-israel`.

## רק תפריט הנגישות (בלי Claude)

**הכי פשוט:** דף ההגדרה — https://yotamhazan.github.io/a11y-israel/ — בוחרים צבע, גודל ומיקום, רואים תצוגה מקדימה ומעתיקים שורה אחת לאתר.

או ישירות:

```html
<script src="https://cdn.jsdelivr.net/gh/yotamhazan/a11y-israel@v2.1.0/plugins/a11y-israel/skills/israel-web-compliance/assets/a11y-widget/a11y-widget.js"
        data-icon-style="white-blue" data-size="medium" data-position="bottom-right"
        data-statement-url="/accessibility" defer></script>
```

מומלץ להעתיק את [`a11y-widget.js`](plugins/a11y-israel/skills/israel-web-compliance/assets/a11y-widget/a11y-widget.js) לאתר עצמו במקום לטעון מ-jsDelivr, כדי שלא יהיה גורם חיצוני (שאחרת צריך לציין במדיניות הפרטיות). כל ההגדרות: [README של התפריט](plugins/a11y-israel/skills/israel-web-compliance/assets/a11y-widget/README.md).

| הגדרה | אפשרויות |
|---|---|
| צבע (`data-icon-style`) | `blue-white` כחול על לבן · `white-blue` לבן על כחול · `black-white` שחור על לבן · `white-black` לבן על שחור |
| גודל (`data-size`) | `small` · `medium` · `large` · או מספר פיקסלים (מינימום 44) |
| מיקום (`data-position`) | `top` / `middle` / `bottom` + `right` / `left` / `start` / `end`, למשל `middle-left` |

בתפריט: הגדלת טקסט עד 200%, גופן קריא, ריווח שורות ואותיות, ניגודיות כהה ובהירה, היפוך צבעים, שחור-לבן, הדגשת קישורים וכותרות, ניווט מקלדת מודגש, עצירת אנימציות, סמן גדול, סרגל קריאה, איפוס, וקישור להצהרת נגישות. מוסיף גם "דילוג לתוכן הראשי". נפתח ב-Alt+A.

## מה יש ברפוזיטורי

```
.claude-plugin/marketplace.json          # הגדרת ה-marketplace
plugins/a11y-israel/
  .claude-plugin/plugin.json             # הגדרת התוסף
  skills/israel-web-compliance/
    SKILL.md                             # הסקיל
    references/accessibility.md          # ת"י 5568: דרישות, שינויים ישראליים, הצהרת נגישות
    references/privacy.md                # תיקון 13: יידוע, מאגרים, ממונה, אבטחה, עיצומים, דיוור
    assets/a11y-widget/                  # תפריט הנגישות, דף הגדרה, דמו, תבנית הצהרה
    assets/cookie-consent/               # באנר עוגיות: vanilla-cookieconsent 3.1.0 + הגדרה ועיצוב ישראליים
tests/                                   # בדיקה מקצה לקצה בדפדפן אמיתי
```

## פיתוח

```bash
npm install
npx playwright install chromium   # או: CHROME_PATH="<נתיב ל-Chrome>" npm test
npm test
npm run validate                  # בדיקת מבנה התוסף (דורש Claude Code)
```

לפני גרסה חדשה: לעדכן `version` ב-`plugins/a11y-israel/.claude-plugin/plugin.json`, ב-`package.json` ובכתובות ה-jsDelivr, ולתייג `vX.Y.Z`.

## רישיון

הקוד והתוכן — MIT (ראו [LICENSE](LICENSE)). אייקון הנגישות "universal-access" — Font Awesome Free 5.2.0, ברישיון [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). באנר העוגיות — [vanilla-cookieconsent](https://github.com/orestbida/cookieconsent) מאת Orest Bida, ברישיון MIT (`assets/cookie-consent/vendor/LICENSE`).

---

**English:** an Israeli web-compliance plugin for Claude Code (SI 5568 part 1 accessibility at AA, Privacy Protection Law incl. amendment 13) plus a dependency-free, privacy-friendly Hebrew/English accessibility menu for any website. Install with `/plugin marketplace add yotamhazan/a11y-israel` then `/plugin install a11y-israel@a11y-israel`.
