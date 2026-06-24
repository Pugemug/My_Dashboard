/**
 * E2E Test: Datei-Upload und Visual-Rendering auf Lieferfähigkeit-Page.
 * Phase 1 laut docs/specs/TestAutomatisierung.md.
 *
 * Voraussetzung: build.py muss vorher ausgeführt worden sein
 * (Web App/FlowAnalytics.html muss existieren).
 */

import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname     = path.dirname(fileURLToPath(import.meta.url));
const APP_PATH      = `file://${path.resolve(__dirname, '../../Web App/FlowAnalytics.html')}`;
const FIXTURE       = path.resolve(__dirname, '../fixtures/testdata.json');
const FIXTURE_EMPTY = path.resolve(__dirname, '../fixtures/testdata-empty.json');

// Alle Tiles die nach Upload auf der Lieferfähigkeit-Page sichtbar sein müssen
const EXPECTED_TILES = [
  '#tile-boxchart',
  '#tile-flowefficiency',
  '#tile-happinessfaktor',
  '#tile-wip',
];

test.describe('Datei-Upload und Visual-Rendering', () => {

  test('Testdatei hochladen → Datencheck-Page erscheint', async ({ page }) => {
    await page.goto(APP_PATH);
    await page.waitForLoadState('domcontentloaded');

    await page.locator('#file-input').setInputFiles(FIXTURE);

    await expect(page.locator('#page-datencheck')).toBeVisible({ timeout: 5000 });
  });

  test('CTA-Klick → Tile-Canvas Lieferfähigkeit sichtbar', async ({ page }) => {
    await page.goto(APP_PATH);
    await page.waitForLoadState('domcontentloaded');
    await page.locator('#file-input').setInputFiles(FIXTURE);
    await expect(page.locator('#page-datencheck')).toBeVisible({ timeout: 5000 });

    await page.locator('.btn-cta').click();

    await expect(page.locator('#tile-canvas-lieferfahigkeit')).toBeVisible({ timeout: 5000 });
  });

  test('Testdatei hochladen → alle Tiles erscheinen ohne JS-Fehler', async ({ page }) => {
    const jsErrors = [];
    page.on('pageerror', err => jsErrors.push(err.message));

    await page.goto(APP_PATH);
    await page.waitForLoadState('domcontentloaded');
    await page.locator('#file-input').setInputFiles(FIXTURE);
    await expect(page.locator('#page-datencheck')).toBeVisible({ timeout: 5000 });
    await page.locator('.btn-cta').click();

    for (const tileId of EXPECTED_TILES) {
      await expect(page.locator(tileId)).toBeVisible({ timeout: 5000 });
    }

    expect(jsErrors).toHaveLength(0);
  });

  test('Testdatei hochladen → kein "undefined" oder "NaN" im Tile-Canvas', async ({ page }) => {
    await page.goto(APP_PATH);
    await page.waitForLoadState('domcontentloaded');
    await page.locator('#file-input').setInputFiles(FIXTURE);
    await expect(page.locator('#page-datencheck')).toBeVisible({ timeout: 5000 });
    await page.locator('.btn-cta').click();
    await expect(page.locator('#tile-canvas-lieferfahigkeit')).toBeVisible({ timeout: 5000 });

    const tileText = await page.locator('#tile-canvas-lieferfahigkeit').textContent();
    expect(tileText).not.toContain('undefined');
    expect(tileText).not.toContain('NaN');
  });

  test('Testdatei hochladen → alle Diag-Bars rendern ohne "undefined"', async ({ page }) => {
    await page.goto(APP_PATH);
    await page.waitForLoadState('domcontentloaded');
    await page.locator('#file-input').setInputFiles(FIXTURE);
    await expect(page.locator('#page-datencheck')).toBeVisible({ timeout: 5000 });
    await page.locator('.btn-cta').click();
    await expect(page.locator('#tile-canvas-lieferfahigkeit')).toBeVisible({ timeout: 5000 });

    for (const tileId of EXPECTED_TILES) {
      await expect(page.locator(tileId)).toBeVisible({ timeout: 5000 });
      const diagText = await page.locator(`${tileId} .diag-bar`).textContent();
      expect(diagText, `Diag-Bar ${tileId} enthält "undefined"`).not.toContain('undefined');
    }
  });

  test('Leerdatei hochladen → Leerzustand, kein JS-Fehler', async ({ page }) => {
    const jsErrors = [];
    page.on('pageerror', err => jsErrors.push(err.message));

    await page.goto(APP_PATH);
    await page.waitForLoadState('domcontentloaded');
    await page.locator('#file-input').setInputFiles(FIXTURE_EMPTY);

    // Datencheck erscheint auch bei Leerdatei (0 Datenzeilen, aber gültiges Excel)
    await expect(page.locator('#page-datencheck')).toBeVisible({ timeout: 5000 });
    await page.locator('.btn-cta').click();
    await expect(page.locator('#tile-canvas-lieferfahigkeit')).toBeVisible({ timeout: 5000 });

    expect(jsErrors).toHaveLength(0);
  });

});
