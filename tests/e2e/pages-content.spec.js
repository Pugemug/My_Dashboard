/**
 * E2E Inhalts-Tests: Visuals auf eigenen Pages (Sidebar-Navigation).
 * Betrifft: Blocker, Heatmap, Scatter, WIPAge, Monte Carlo.
 *
 * Voraussetzung: build.py muss vorher ausgeführt worden sein.
 */

import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP_PATH  = `file://${path.resolve(__dirname, '../../Web App/FlowAnalytics.html')}`;
const FIXTURE   = path.resolve(__dirname, '../fixtures/testdata.xlsx');

/** Datei hochladen, CTA klicken, dann per Sidebar zur Ziel-Page navigieren. */
async function navigateToPage(page, pageName) {
  await page.goto(APP_PATH);
  await page.waitForLoadState('domcontentloaded');
  await page.locator('#file-input').setInputFiles(FIXTURE);
  await expect(page.locator('#page-datencheck')).toBeVisible({ timeout: 5000 });
  await page.locator('.btn-cta').click();
  await expect(page.locator('#tile-canvas-lieferfahigkeit')).toBeVisible({ timeout: 5000 });
  await page.locator(`.sidebar-link[data-page="${pageName}"]`).click();
  await expect(page.locator(`#page-${pageName}`)).toBeVisible({ timeout: 3000 });
}

// ── Blocker ───────────────────────────────────────────────────────────────────

test.describe('Blocker – Inhalts-Prüfung', () => {

  test('Page ist nach Sidebar-Klick sichtbar', async ({ page }) => {
    await navigateToPage(page, 'blocker');
    await expect(page.locator('#page-blocker')).toBeVisible();
  });

  test('Diag zeigt Anzahl Issues mit Blockier-/Warte-Episoden', async ({ page }) => {
    await navigateToPage(page, 'blocker');
    const diag = await page.locator('#blocker-diag').textContent();
    expect(diag).toContain('Issues mit Blockier-/Warte-Episoden');
  });

  test('Diag zeigt Anzahl aktuell offener Blocker', async ({ page }) => {
    await navigateToPage(page, 'blocker');
    const diag = await page.locator('#blocker-diag').textContent();
    expect(diag).toContain('aktuell offen');
  });

  test('Canvas enthält gerenderten Inhalt (nicht leer)', async ({ page }) => {
    await navigateToPage(page, 'blocker');
    const canvas = page.locator('#blocker-canvas');
    await expect(canvas).not.toBeEmpty();
  });

});

// ── Heatmap ───────────────────────────────────────────────────────────────────

test.describe('Heatmap – Inhalts-Prüfung', () => {

  test('Page ist nach Sidebar-Klick sichtbar', async ({ page }) => {
    await navigateToPage(page, 'heatmap');
    await expect(page.locator('#page-heatmap')).toBeVisible();
  });

  test('Card ist sichtbar', async ({ page }) => {
    await navigateToPage(page, 'heatmap');
    await expect(page.locator('#card-heatmap')).toBeVisible();
  });

  test('Diag-Bar zeigt Items und Gruppen', async ({ page }) => {
    await navigateToPage(page, 'heatmap');
    const diag = await page.locator('#card-heatmap .diag-bar').textContent();
    expect(diag).toContain('Items');
    expect(diag).toContain('Gruppen');
  });

  test('Diag-Bar zeigt Status-Anzahl', async ({ page }) => {
    await navigateToPage(page, 'heatmap');
    const diag = await page.locator('#card-heatmap .diag-bar').textContent();
    expect(diag).toMatch(/\d+\/\d+ Status/);
  });

  test('Card-Inhalt enthält gerenderte Daten (nicht leer)', async ({ page }) => {
    await navigateToPage(page, 'heatmap');
    const content = page.locator('#card-heatmap .card-content');
    await expect(content).not.toBeEmpty();
  });

});

// ── Scatter ───────────────────────────────────────────────────────────────────

test.describe('Scatter – Inhalts-Prüfung', () => {

  test('Page ist nach Sidebar-Klick sichtbar', async ({ page }) => {
    await navigateToPage(page, 'scatter');
    await expect(page.locator('#page-scatter')).toBeVisible();
  });

  test('Card ist sichtbar', async ({ page }) => {
    await navigateToPage(page, 'scatter');
    await expect(page.locator('#card-scatter')).toBeVisible();
  });

  test('Diag-Bar zeigt Item-Anzahl (n=) und CT-Zeitraum nach Render', async ({ page }) => {
    await navigateToPage(page, 'scatter');
    // showPage() feuert resize-Event nach 50ms → Scatter re-rendert mit echten Dimensionen
    await page.waitForFunction(
      () => {
        const t = document.querySelector('#card-scatter .diag-bar')?.textContent ?? '';
        return t.trim() !== '—';
      },
      { timeout: 3000 }
    );
    const diag = await page.locator('#card-scatter .diag-bar').textContent();
    expect(diag).toMatch(/n=\d+/);
    expect(diag).toContain('CT:');
  });

  test('SVG-Chart ist nach Render sichtbar', async ({ page }) => {
    await navigateToPage(page, 'scatter');
    await page.waitForFunction(
      () => {
        const t = document.querySelector('#card-scatter .diag-bar')?.textContent ?? '';
        return t.trim() !== '—';
      },
      { timeout: 3000 }
    );
    await expect(page.locator('#card-scatter svg')).toBeVisible();
  });

});

// ── WIPAge ────────────────────────────────────────────────────────────────────

test.describe('WIPAge – Inhalts-Prüfung', () => {

  test('Page ist nach Sidebar-Klick sichtbar', async ({ page }) => {
    await navigateToPage(page, 'wipage');
    await expect(page.locator('#page-wipage')).toBeVisible();
  });

  test('Card ist sichtbar', async ({ page }) => {
    await navigateToPage(page, 'wipage');
    await expect(page.locator('#card-wipage')).toBeVisible();
  });

  test('Diag-Bar zeigt WIP-Items oder Datenstatus', async ({ page }) => {
    await navigateToPage(page, 'wipage');
    const diag = await page.locator('#card-wipage .diag-bar').textContent();
    const hasWipData = /\d+ WIP-Items/.test(diag);
    const hasStatus  = diag.includes('aktive Items') || diag.includes('keine Daten');
    expect(hasWipData || hasStatus).toBe(true);
  });

  test('Diag-Bar ist nicht leer (—)', async ({ page }) => {
    await navigateToPage(page, 'wipage');
    const diag = await page.locator('#card-wipage .diag-bar').textContent();
    expect(diag.trim()).not.toBe('—');
  });

  test('SVG-Chart ist sichtbar', async ({ page }) => {
    await navigateToPage(page, 'wipage');
    const svg = page.locator('#card-wipage svg');
    await expect(svg).toBeVisible({ timeout: 3000 });
  });

});

// ── Monte Carlo ───────────────────────────────────────────────────────────────

test.describe('Monte Carlo – Inhalts-Prüfung', () => {

  test('Page ist nach Sidebar-Klick sichtbar', async ({ page }) => {
    await navigateToPage(page, 'monte');
    await expect(page.locator('#page-monte')).toBeVisible();
  });

  test('Card ist sichtbar', async ({ page }) => {
    await navigateToPage(page, 'monte');
    await expect(page.locator('#card-montecarlo')).toBeVisible();
  });

  test('Diag-Bar zeigt Datenbasis (n=) und Anzahl Simulationsläufe', async ({ page }) => {
    await navigateToPage(page, 'monte');
    const diag = await page.locator('#card-montecarlo .diag-bar').textContent();
    expect(diag).toMatch(/n=\d+/);
    expect(diag).toContain('Läufe');
  });

  test('"Simulation starten"-Button ist sichtbar', async ({ page }) => {
    await navigateToPage(page, 'monte');
    const btn = page.locator('#card-montecarlo button', { hasText: 'Simulation starten' });
    await expect(btn).toBeVisible({ timeout: 3000 });
  });

  test('Simulation läuft durch und zeigt Ergebnis-SVG', async ({ page }) => {
    await navigateToPage(page, 'monte');
    const btn = page.locator('#card-montecarlo button', { hasText: 'Simulation starten' });
    await btn.click();
    // Nach Simulation gibt es ≥2 SVGs (Icon + Histogramm-Chart) → letztes ist das Chart
    const svg = page.locator('#card-montecarlo svg').last();
    await expect(svg).toBeVisible({ timeout: 5000 });
  });

});
