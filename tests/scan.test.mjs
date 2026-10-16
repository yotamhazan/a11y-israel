/**
 * Tests for the scanner (static) and the browser check, against two fixture sites:
 * bad-site breaks every rule we can plant, good-site should come out clean.
 *   CHROME_PATH="C:/Program Files/Google/Chrome/Application/chrome.exe" node tests/scan.test.mjs
 */
import { fileURLToPath } from 'node:url';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { scan } from '../plugins/a11y-israel/skills/israel-web-compliance/scripts/scan.mjs';
import { check } from '../plugins/a11y-israel/skills/israel-web-compliance/scripts/browser-check.mjs';
import { startServer } from './serve.mjs';

let failures = 0;
const ok = (name, cond, extra = '') => {
  console.log((cond ? 'PASS ' : 'FAIL ') + name + (extra && !cond ? '  ' + extra : ''));
  if (!cond) failures++;
};
const dir = (name) => fileURLToPath(new URL('./fixtures/scan/' + name, import.meta.url));

// ---- static scan
const bad = scan(dir('bad-site'));
const ids = new Set(bad.findings.map((f) => f.id));
for (const id of [
  'a11y/html-lang', 'a11y/zoom-blocked', 'a11y/img-alt', 'a11y/click-non-button', 'a11y/icon-button', 'a11y/outline-none',
  'a11y/autoplay', 'a11y/input-label', 'a11y/tabindex-positive', 'a11y/no-h1', 'a11y/no-main', 'a11y/vague-link', 'a11y/light-text',
  'a11y/no-widget', 'todo/placeholder', 'legal/no-a11y-statement', 'legal/no-privacy-policy', 'legal/footer-links', 'privacy/form-notice',
  'privacy/marketing-prechecked', 'privacy/trackers-ungated', 'privacy/secret-in-client', 'consumer/no-cancel-link',
  'consumer/no-terms', 'consumer/no-business-id', 'consumer/price-without-vat',
]) ok('bad-site finds ' + id, ids.has(id));
ok('bad-site detected as a shop', bad.facts.shop === true, JSON.stringify(bad.facts.shopSignals));
ok('bad-site trackers named', bad.facts.trackers.map((t) => t.name).join() === 'Google Analytics,Meta Pixel', JSON.stringify(bad.facts.trackers));
ok('findings carry file and line', bad.findings.find((f) => f.id === 'a11y/img-alt')?.line === 5);
ok('blocking findings first', bad.findings[0].sev === 'blocking');
ok('same input, same output', JSON.stringify(scan(dir('bad-site')).findings) === JSON.stringify(bad.findings));

const good = scan(dir('good-site'));
ok('good-site has no findings', good.findings.length === 0, good.findings.map((f) => f.id + '@' + f.file).join(', '));
ok('good-site documents found', good.facts.a11yStatement === 'accessibility.html' && good.facts.privacyPolicy === 'privacy.html', JSON.stringify(good.facts));
ok('good-site tracker counted as gated', good.facts.trackers.length === 1 && good.facts.trackers[0].gated);
ok('good-site not a shop', good.facts.shop === false);

// ---- browser check
const server = await startServer();
const out = mkdtempSync(join(tmpdir(), 'a11y-bc-'));
const badRun = await check(server.url, ['/tests/fixtures/scan/bad-site/index.html'], out);
const badIds = new Set(badRun.pages[0].findings.map((f) => f.id));
ok('browser: tracker before consent caught', badIds.has('privacy/tracker-before-consent'), [...badIds].join(', '));
ok('browser: missing lang caught', badIds.has('a11y/html-lang'));
ok('browser: axe ran', badRun.axe === true);
ok('browser: screenshots saved', badRun.pages[0].screenshots.length === 2);

const goodRun = await check(server.url, ['/tests/fixtures/scan/good-site/accessibility.html'], out);
const goodBlocking = goodRun.pages[0].findings.filter((f) => f.sev === 'blocking');
ok('browser: good page has no blocking findings', goodBlocking.length === 0, JSON.stringify(goodBlocking));
server.close();

console.log(failures ? `\n${failures} FAILED` : '\nALL PASSED');
process.exit(failures ? 1 : 0);
