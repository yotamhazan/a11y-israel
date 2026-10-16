# קטעים מוכנים — טפסים, דיוור ופוטר

להעתיק ולהתאים לסגנון ולרכיבים של הפרויקט (HTML / JSX / Vue). שמות, נתיבים וטקסט בסוגריים — להחליף.

## הודעת יידוע ליד טופס (חוק הגנת הפרטיות, סעיף 11)

חמשת הפריטים: חובה/רשות ותוצאת אי-מסירה · מטרה · למי יועבר · מי בעל השליטה ודרכי קשר · זכות עיון ותיקון. הקצר ליד הכפתור, השאר בקישור.

```html
<p class="form-notice">
  המידע ישמש ל[מענה לפנייתך] ויישמר אצל [שם העסק][, ובאמצעות ספקים שעובדים בשבילנו]. מסירתו רשות, אך בלעדיו
  לא נוכל [לחזור אליך]. אפשר לעיין במידע ולבקש לתקן אותו — פרטים ב<a href="/privacy">מדיניות הפרטיות</a>.
</p>
```

JSX: אותו דבר עם `className` ו-`<Link href="/privacy">` אם הפרויקט משתמש ב-Next.js.

## הסכמה לדיוור (חוק התקשורת, סעיף 30א)

נפרדת מכל הסכמה אחרת, **לא מסומנת מראש**, עם תווית מקושרת:

```html
<div class="field-checkbox">
  <input type="checkbox" id="marketing-consent" name="marketingConsent" />
  <label for="marketing-consent">אשמח לקבל מ[שם העסק] עדכונים ומבצעים במייל וב-SMS. אפשר להסיר בכל עת.</label>
</div>
```

בצד שרת: לשמור יחד עם הנרשם את הוכחת ההסכמה — זמן, מקור (איזה טופס/עמוד) והנוסח שהוצג.

## שדה חובה ושגיאה נגישים (ת"י 5568 · 3.3.1, 3.3.2)

```html
<label for="phone">טלפון <span aria-hidden="true">*</span><span class="sr-only">(חובה)</span></label>
<input id="phone" name="phone" type="tel" autocomplete="tel" inputmode="tel" dir="ltr"
       required aria-invalid="true" aria-describedby="phone-error" />
<p id="phone-error" class="field-error">נא להזין מספר טלפון בן 9–10 ספרות, למשל 050-1234567.</p>
```

## פוטר — קישורים משפטיים

לכל אתר: הצהרת נגישות + מדיניות פרטיות. באתר שמוכר: גם תקנון + **ביטול עסקה** (חוק הגנת הצרכן 14ט(ב) — קישור ייעודי בדף הבית, בולט). אם יש באנר עוגיות: "הגדרות עוגיות".

```html
<footer>
  <nav aria-label="מידע משפטי">
    <ul class="legal-links">
      <li><a href="/accessibility">הצהרת נגישות</a></li>
      <li><a href="/privacy">מדיניות פרטיות</a></li>
      <li><a href="/terms">תקנון</a></li>
      <li><a href="/cancel">ביטול עסקה</a></li>
      <li><button type="button" data-cc="show-preferencesModal">הגדרות עוגיות</button></li>
    </ul>
  </nav>
  <p>[שם העסק] · [ח.פ. / ע.מ.] · [כתובת] · <a href="tel:[טלפון]">[טלפון]</a> · <a href="mailto:[מייל]">[מייל]</a></p>
</footer>
```

כפתור "הגדרות עוגיות" נראה כמו קישור — לעצב אותו כמו שאר הקישורים בפוטר (`background:none; border:0; text-decoration:underline; color:inherit; font:inherit; cursor:pointer`).
