---
name: audit
description: בדיקה בלבד, בלי לשנות קבצים — סורק את האתר מול החוק הישראלי (נגישות ת"י 5568, פרטיות ותיקון 13, הגנת הצרכן) ומחזיר דוח בעברית. Run only when the user invokes /a11y-israel:audit.
disable-model-invocation: true
argument-hint: "[אופציונלי: כתובת אתר רץ לבדיקה בדפדפן, למשל http://localhost:3000]"
---

# /a11y-israel:audit — בדיקה בלי שינויים

`$IWC` = `${CLAUDE_SKILL_DIR}/../israel-web-compliance`. **אל תשנה אף קובץ בפרויקט** בהרצה הזו (חוץ מתיקיית הדוח).

1. `node "$IWC/scripts/scan.mjs" . --out a11y-israel-report/scan.json` (קוד יציאה 1 = יש ממצאים חוסמים — צפוי).
2. אם המשתמש נתן כתובת ($ARGUMENTS), או שקל להריץ את האתר: הרץ את `$IWC/scripts/browser-check.mjs` כמתואר בשלב 10 של `${CLAUDE_SKILL_DIR}/../fix/SKILL.md`.
3. עבור על הממצאים ואמת בקוד את החוסמים (הסריקה היא כיוון, לא פסק דין). סמן ממצאים שגויים.
4. דוח בעברית, בשפה של בעל העסק, לפי "פורמט הדוח" ב-`$IWC/SKILL.md`: חוסם / חשוב / מומלץ, איפה, מה הבעיה, מה התיקון. בסוף: מה לא נבדק, מה דורש החלטה של בעל העסק, ושאפשר לתקן הכול עם `/a11y-israel:fix`.
