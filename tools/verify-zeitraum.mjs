import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const HTML = 'file:///' + path.resolve(__dirname, '../Web App/FlowAnalytics.html').split('\\').join('/');
const XLSX = path.resolve(__dirname, '../tests/fixtures/testdata.xlsx');

const browser = await chromium.launch({ headless: true });
const page    = await browser.newPage();
const errors  = [];
page.on('pageerror', e => errors.push(e.message));

await page.goto(HTML);

// Upload testdata via hidden file-input (kein filechooser-Dialog)
await page.waitForLoadState('domcontentloaded');
await page.locator('#file-input').setInputFiles(XLSX);
await page.waitForSelector('#btn-goto-app', { timeout: 5000 });
await page.click('#btn-goto-app');
await page.waitForSelector('#page-lieferfahigkeit', { timeout: 5000 });
await page.waitForTimeout(300);

const chip = page.locator('.btn-daterange-trigger').first();

// 1. Initial chip text
const chipText = await chip.textContent();
console.log('1. Chip-Text initial:', chipText.trim());

// 2. Dropdown opens
await chip.click();
await page.waitForTimeout(200);
const ddVisible = await page.locator('#daterange-dropdown').isVisible();
console.log('2. Dropdown sichtbar:', ddVisible);

// 3. All options visible
const opts = await page.locator('#daterange-dropdown .dr-opt').allTextContents();
console.log('3. Optionen (' + opts.length + '):', opts.map(t => t.trim()).join(' | '));

// 4. Select "Letzte 30 Tage"
await page.locator('[data-mode="last30"]').click();
await page.waitForTimeout(200);
const chipAfter30 = await chip.textContent();
const ddClosed = !(await page.locator('#daterange-dropdown').isVisible());
console.log('4a. Chip nach Letzte-30T:', chipAfter30.trim());
console.log('4b. Dropdown auto-geschlossen:', ddClosed);

// 5. Select quarter q1
await chip.click();
await page.waitForTimeout(100);
await page.locator('[data-mode="q1"]').click();
await page.waitForTimeout(200);
const chipQ1 = await chip.textContent();
console.log('5. Chip nach q1:', chipQ1.trim());

// 6. Custom Von/Bis
await chip.click();
await page.waitForTimeout(100);
await page.fill('#dr-from', '2026-01-01');
await page.fill('#dr-to',   '2026-03-31');
await page.click('#dr-apply');
await page.waitForTimeout(200);
const chipCustom = await chip.textContent();
const isActive = await chip.evaluate(el => el.classList.contains('pf-active'));
console.log('6a. Chip nach Custom:', chipCustom.trim());
console.log('6b. pf-active gesetzt:', isActive);

// 7. Filter zurücksetzen
await page.click('#lf-filter-reset');
await page.waitForTimeout(200);
const chipReset = await chip.textContent();
const isActiveAfterReset = await chip.evaluate(el => el.classList.contains('pf-active'));
console.log('7a. Chip nach Reset:', chipReset.trim());
console.log('7b. pf-active nach Reset:', isActiveAfterReset, '(erwartet: false)');

// 8. WIPAge hat Chip
await page.click('[data-page="wipage"]');
await page.waitForTimeout(200);
const wipCount = await page.locator('#page-wipage .btn-daterange-trigger').count();
console.log('8. WIPAge-Page hat Zeitraum-Chip:', wipCount > 0);

// 9. Scatter hat Chip
await page.click('[data-page="scatter"]');
await page.waitForTimeout(200);
const scatterCount = await page.locator('#page-scatter .btn-daterange-trigger').count();
console.log('9. Scatter-Page hat Zeitraum-Chip:', scatterCount > 0);

// 10. Monte hat KEINEN Chip
await page.click('[data-page="monte"]');
await page.waitForTimeout(200);
const monteHasChip = await page.locator('#page-monte .btn-daterange-trigger').count();
console.log('10. Monte hat KEINEN Chip:', monteHasChip === 0, '(erwartet: true)');

// Probe: Übernehmen ohne Felder → kein Crash
await page.click('[data-page="lieferfahigkeit"]');
await page.waitForTimeout(100);
await chip.click();
await page.waitForTimeout(100);
await page.fill('#dr-from', '');
await page.fill('#dr-to', '');
await page.click('#dr-apply');
await page.waitForTimeout(100);
const stillCustomMode = await chip.textContent();
console.log('P1. Übernehmen ohne Datum → Chip unverändert (kein Crash):', !stillCustomMode.includes('undefined'));

// Probe: Von > Bis → kein Crash
await chip.click();
await page.waitForTimeout(100);
await page.fill('#dr-from', '2026-06-01');
await page.fill('#dr-to', '2026-01-01');
await page.click('#dr-apply');
await page.waitForTimeout(100);
const afterInvalid = await chip.textContent();
console.log('P2. Von > Bis abgefangen (kein Crash):', errors.length === 0);

// JS-Fehler
console.log('\nJS-Fehler:', errors.length === 0 ? 'keine' : errors.join('; '));
process.exit(errors.length > 0 ? 1 : 0);

await browser.close();
