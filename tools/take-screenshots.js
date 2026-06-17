/**
 * Referenz-Screenshots für docs/design/screenshots/
 *
 * Verwendung: node tools/take-screenshots.js
 * Voraussetzung: build.py muss vorher ausgeführt worden sein.
 *
 * Erzeugt Screenshots aller Seiten in Dark und Light Mode als
 * visuelle Wahrheitsquelle für Neubauten.
 */

import { chromium } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP_PATH  = `file://${path.resolve(__dirname, '../Web App/FlowAnalytics.html')}`;
const FIXTURE   = path.resolve(__dirname, '../tests/fixtures/testdata.xlsx');
const OUT_DIR   = path.resolve(__dirname, '../docs/design/screenshots');

fs.mkdirSync(OUT_DIR, { recursive: true });

async function shot(page, filename) {
  await page.waitForTimeout(600); // SVGs vollständig rendern lassen
  await page.screenshot({ path: path.join(OUT_DIR, filename), fullPage: false });
  console.log(`✓ ${filename}`);
}

async function navigateTo(page, pageId) {
  await page.locator(`[data-page="${pageId}"]`).click();
  await page.locator(`#page-${pageId}`).waitFor({ state: 'visible', timeout: 8000 });
}

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page    = await context.newPage();

// ── Upload-Screen ──────────────────────────────────────────
await page.goto(APP_PATH);
await page.waitForLoadState('domcontentloaded');
await shot(page, '01-upload-dark.png');

await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));
await shot(page, '02-upload-light.png');

// ── Datei laden ────────────────────────────────────────────
await page.evaluate(() => document.documentElement.removeAttribute('data-theme'));
await page.locator('#file-input').setInputFiles(FIXTURE);
await page.locator('#page-datencheck').waitFor({ state: 'visible', timeout: 8000 });
await shot(page, '03-datencheck-dark.png');

// ── Lieferfähigkeit ────────────────────────────────────────
await page.locator('.btn-cta').click();
await page.locator('#tile-canvas-lieferfahigkeit').waitFor({ state: 'visible', timeout: 8000 });
await shot(page, '04-lieferfahigkeit-dark.png');

await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));
await shot(page, '05-lieferfahigkeit-light.png');
await page.evaluate(() => document.documentElement.removeAttribute('data-theme'));

// ── Deep-Dive-Pages ────────────────────────────────────────
const deepDivePages = [
  { id: 'wipage',  nr: '06', label: 'wipage'  },
  { id: 'scatter', nr: '07', label: 'scatter' },
  { id: 'heatmap', nr: '08', label: 'heatmap' },
  { id: 'monte',   nr: '09', label: 'monte'   },
  { id: 'blocker', nr: '10', label: 'blocker' },
];

for (const { id, nr, label } of deepDivePages) {
  await navigateTo(page, id);
  await shot(page, `${nr}-${label}-dark.png`);

  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));
  await shot(page, `${nr}-${label}-light.png`);
  await page.evaluate(() => document.documentElement.removeAttribute('data-theme'));
}

await browser.close();
console.log(`\nAlle Screenshots gespeichert in: ${OUT_DIR}`);
