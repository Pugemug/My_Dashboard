/**
 * E2E Smoke-Test: App öffnen und Upload-Screen prüfen.
 * Ersetzt den manuellen M9-Schritt 1.
 *
 * Voraussetzung: build.py muss vorher ausgeführt worden sein
 * (Web App/FlowAnalytics.html muss existieren).
 */

import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP_PATH = `file://${path.resolve(__dirname, '../../Web App/FlowAnalytics.html')}`;

test.describe('App Smoke-Test', () => {

  test('App öffnet ohne JS-Fehler', async ({ page }) => {
    const jsErrors = [];
    page.on('pageerror', err => jsErrors.push(err.message));

    await page.goto(APP_PATH);
    await page.waitForLoadState('domcontentloaded');

    expect(jsErrors).toHaveLength(0);
  });

  test('Upload-Screen ist sichtbar beim Start', async ({ page }) => {
    await page.goto(APP_PATH);
    const uploadScreen = page.locator('#upload-screen');
    await expect(uploadScreen).toBeVisible();
  });

  test('App-Screen ist beim Start verborgen', async ({ page }) => {
    await page.goto(APP_PATH);
    const appScreen = page.locator('#app-screen');
    await expect(appScreen).toBeHidden();
  });

  test('Kein "undefined" oder "NaN" sichtbar im Upload-Screen', async ({ page }) => {
    await page.goto(APP_PATH);
    const text = await page.locator('#upload-screen').innerText();
    expect(text).not.toContain('undefined');
    expect(text).not.toContain('NaN');
  });

});
