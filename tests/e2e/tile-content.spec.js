/**
 * E2E Inhalts-Tests: Prüft ob die Tiles nach dem Upload echte Werte zeigen.
 * Ergänzt app.load.spec.js (Smoke) und data.upload.spec.js (Navigation).
 *
 * Ziel: Nicht nur "ist das Kästchen sichtbar?" sondern "stimmt der Inhalt?"
 * Voraussetzung: build.py muss vorher ausgeführt worden sein.
 */

import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP_PATH  = `file://${path.resolve(__dirname, '../../Web App/FlowAnalytics.html')}`;
const FIXTURE   = path.resolve(__dirname, '../fixtures/testdata.xlsx');

async function navigateToTiles(page) {
  await page.goto(APP_PATH);
  await page.waitForLoadState('domcontentloaded');
  await page.locator('#file-input').setInputFiles(FIXTURE);
  await expect(page.locator('#page-datencheck')).toBeVisible({ timeout: 5000 });
  await page.locator('.btn-cta').click();
  await expect(page.locator('#tile-canvas-lieferfahigkeit')).toBeVisible({ timeout: 5000 });
}

/** Wählt genau einen Squad aus dem Dropdown aus (alle anderen deaktivieren). */
async function selectExactlyOneSquad(page) {
  // Dropdown öffnen
  await page.locator('#btn-squad').click();
  await page.locator('#squad-opts input[type=checkbox]').first().waitFor({ state: 'visible' });

  const checkboxes = page.locator('#squad-opts input[type=checkbox]');
  const count = await checkboxes.count();
  if (count === 0) return;

  // Alle außer dem ersten deaktivieren (erste bleibt aktiv)
  for (let i = 1; i < count; i++) {
    const cb = checkboxes.nth(i);
    if (await cb.isChecked()) await cb.click();
  }

  // Dropdown schließen durch Klick außerhalb
  await page.mouse.click(10, 10);
  // Warten bis Filter-Event die Tiles aktualisiert hat
  await page.waitForFunction(() =>
    !document.getElementById('squad-dropdown')?.classList.contains('open')
  );
}

// ── BoxChart ─────────────────────────────────────────────────────────────────

test.describe('BoxChart – Inhalts-Prüfung', () => {

  test('Median-KPI zeigt eine Zahl in Tagen (z.B. "14d")', async ({ page }) => {
    await navigateToTiles(page);
    const val = await page.locator('#bc-kpi-val').textContent();
    expect(val).toMatch(/^\d+d$/);
  });

  test('N-Anzeige zeigt Anzahl Items (z.B. "N = 42")', async ({ page }) => {
    await navigateToTiles(page);
    const n = await page.locator('#bc-kpi-n').textContent();
    expect(n).toMatch(/^N = \d+$/);
    const count = parseInt(n.replace('N = ', ''), 10);
    expect(count).toBeGreaterThan(0);
  });

  test('P85-Zeile zeigt Tage-Wert', async ({ page }) => {
    await navigateToTiles(page);
    const sub = await page.locator('#bc-kpi-sub').textContent();
    expect(sub).toMatch(/P85 · \d+d/);
  });

  test('Diag-Bar enthält keine Standardwerte (—)', async ({ page }) => {
    await navigateToTiles(page);
    const diag = await page.locator('#tile-boxchart .diag-bar').textContent();
    expect(diag).not.toBe('—');
    expect(diag).not.toBe('');
  });

});

// ── Flow Efficiency ───────────────────────────────────────────────────────────

test.describe('Flow Efficiency – Inhalts-Prüfung', () => {

  test('Diag-Bar zeigt Anzahl ausgeschlossener Datenfehler', async ({ page }) => {
    await navigateToTiles(page);
    const diag = await page.locator('#tile-flowefficiency .diag-bar').textContent();
    expect(diag).toContain('Datenfehler ausgeschlossen');
  });

  test('Diag-Bar enthält den "Flow analysieren"-Link', async ({ page }) => {
    await navigateToTiles(page);
    const diag = await page.locator('#tile-flowefficiency .diag-bar').textContent();
    expect(diag).toContain('Flow analysieren');
  });

  test('Diag-Bar zeigt keine leere Standard-Ausgabe (—)', async ({ page }) => {
    await navigateToTiles(page);
    const diag = await page.locator('#tile-flowefficiency .diag-bar').textContent();
    expect(diag.trim()).not.toBe('—');
  });

});

// ── WIP ──────────────────────────────────────────────────────────────────────

test.describe('WIP – Inhalts-Prüfung', () => {

  test('Ohne Squad-Auswahl: Hinweis "genau einen Squad auswählen"', async ({ page }) => {
    await navigateToTiles(page);
    const diag = await page.locator('#tile-wip .diag-bar').textContent();
    expect(diag).toContain('genau einen Squad');
  });

  test('Mit einem Squad: Hinweis verschwindet, Tile reagiert auf Auswahl', async ({ page }) => {
    await navigateToTiles(page);
    await selectExactlyOneSquad(page);
    // Warten bis WIP den Hinweis entfernt hat
    await page.waitForFunction(
      () => !document.querySelector('#tile-wip .diag-bar')?.textContent?.includes('genau einen Squad'),
      { timeout: 3000 }
    );
    const diag = await page.locator('#tile-wip .diag-bar').textContent();
    expect(diag).not.toContain('genau einen Squad');
  });

  test('Mit einem Squad: Header zeigt N = [Zahl]', async ({ page }) => {
    await navigateToTiles(page);
    await selectExactlyOneSquad(page);
    await page.waitForFunction(
      () => !document.querySelector('#tile-wip .diag-bar')?.textContent?.includes('genau einen Squad'),
      { timeout: 3000 }
    );
    // WIP zeigt Anzahl Stories im Header-Badge (nicht im diag-bar)
    const header = await page.locator('#tile-wip .tile-header').textContent();
    expect(header).toMatch(/N = \d+/);
  });

  test('Mit einem Squad: SVG-Chart wird gezeichnet', async ({ page }) => {
    await navigateToTiles(page);
    await selectExactlyOneSquad(page);
    await page.waitForFunction(
      () => !document.querySelector('#tile-wip .diag-bar')?.textContent?.includes('genau einen Squad'),
      { timeout: 3000 }
    );
    const svg = page.locator('#tile-wip svg');
    await expect(svg).toBeVisible({ timeout: 3000 });
  });

});

// ── Happiness Faktor ──────────────────────────────────────────────────────────

test.describe('Happiness Faktor – Inhalts-Prüfung', () => {

  test('Mit einem Squad: SVG-Chart wird gezeichnet', async ({ page }) => {
    await navigateToTiles(page);
    await selectExactlyOneSquad(page);
    // Warten bis SVG im Tile erscheint
    await page.waitForSelector('#tile-happinessfaktor svg', { timeout: 5000 });
    const svg = page.locator('#tile-happinessfaktor svg');
    await expect(svg).toBeVisible();
  });

  test('Mit einem Squad: SVG enthält mindestens einen Datenpunkt', async ({ page }) => {
    await navigateToTiles(page);
    await selectExactlyOneSquad(page);
    await page.waitForSelector('#tile-happinessfaktor svg', { timeout: 5000 });
    const points = page.locator('#tile-happinessfaktor svg rect, #tile-happinessfaktor svg circle');
    const count = await points.count();
    expect(count).toBeGreaterThan(0);
  });

});

// ── Say Do Ratio Epics ────────────────────────────────────────────────────────

test.describe('Say Do Ratio Epics – Inhalts-Prüfung', () => {

  test('Tile ist nach Upload sichtbar', async ({ page }) => {
    await navigateToTiles(page);
    await expect(page.locator('#tile-saydoratioepics')).toBeVisible();
  });

  test('Diag-Bar enthält den "Was zeigt diese Ansicht?"-Link', async ({ page }) => {
    await navigateToTiles(page);
    const diag = await page.locator('#tile-saydoratioepics .diag-bar').textContent();
    expect(diag).toContain('Was zeigt diese Ansicht?');
  });

  test('Tile reagiert auf Daten: zeigt N-Zahl oder Hinweis auf fehlendes Sheet', async ({ page }) => {
    await navigateToTiles(page);
    const header = await page.locator('#tile-saydoratioepics .tile-header').textContent();
    const diag   = await page.locator('#tile-saydoratioepics .diag-bar').textContent();
    const hasData        = /N = \d+/.test(header);
    const hasMissingHint = diag.includes('nicht gefunden') || diag.includes('keine gültigen');
    expect(hasData || hasMissingHint).toBe(true);
  });

  test('Wenn JiraEpics vorhanden: nBadge zeigt N = [Zahl], sonst korrekter Hinweis', async ({ page }) => {
    await navigateToTiles(page);
    const header = await page.locator('#tile-saydoratioepics .tile-header').textContent();
    if (/N = \d+/.test(header)) {
      const n = parseInt(header.match(/N = (\d+)/)[1], 10);
      expect(n).toBeGreaterThanOrEqual(0);
    } else {
      const diag = await page.locator('#tile-saydoratioepics .diag-bar').textContent();
      expect(diag).toMatch(/nicht gefunden|keine gültigen|keine Etappen/);
    }
  });

});

// ── Akzeptanzkriterien ────────────────────────────────────────────────────────

test.describe('Akzeptanzkriterien – Inhalts-Prüfung', () => {

  test('Tile ist nach Upload sichtbar', async ({ page }) => {
    await navigateToTiles(page);
    await expect(page.locator('#tile-akzeptanz')).toBeVisible();
  });

  test('Ohne Squad-Auswahl: Diag zeigt "Kein Squad"', async ({ page }) => {
    await navigateToTiles(page);
    const diag = await page.locator('#tile-akzeptanz .diag-bar').textContent();
    expect(diag).toContain('Kein Squad');
  });

  test('Diag-Bar enthält den "Was zeigt diese Ansicht?"-Link', async ({ page }) => {
    await navigateToTiles(page);
    const diag = await page.locator('#tile-akzeptanz .diag-bar').textContent();
    expect(diag).toContain('Was zeigt diese Ansicht?');
  });

  test('Mit einem Squad: zeigt N-Zahl oder Hinweis auf fehlende Daten', async ({ page }) => {
    await navigateToTiles(page);
    await selectExactlyOneSquad(page);
    await page.waitForFunction(
      () => {
        const t = document.querySelector('#tile-akzeptanz .diag-bar')?.textContent ?? '';
        return !t.includes('Kein Squad') && !t.includes('Squads gewählt');
      },
      { timeout: 3000 }
    );
    const header = await page.locator('#tile-akzeptanz .tile-header').textContent();
    const diag   = await page.locator('#tile-akzeptanz .diag-bar').textContent();
    const hasData = /N = \d+/.test(header);
    const hasHint = diag.includes('JiraEpics') || diag.includes('Stage') || diag.includes('fehlt');
    expect(hasData || hasHint).toBe(true);
  });

  test('Mit einem Squad und JiraEpics-Daten: SVG wird gezeichnet', async ({ page }) => {
    await navigateToTiles(page);
    await selectExactlyOneSquad(page);
    await page.waitForFunction(
      () => {
        const t = document.querySelector('#tile-akzeptanz .diag-bar')?.textContent ?? '';
        return !t.includes('Kein Squad') && !t.includes('Squads gewählt');
      },
      { timeout: 3000 }
    );
    const header = await page.locator('#tile-akzeptanz .tile-header').textContent();
    if (/N = \d+/.test(header)) {
      await expect(page.locator('#tile-akzeptanz svg')).toBeVisible({ timeout: 3000 });
    } else {
      // Sheet fehlt — Tile zeigt korrekten Hinweis statt SVG
      const diag = await page.locator('#tile-akzeptanz .diag-bar').textContent();
      expect(diag.length).toBeGreaterThan(0);
    }
  });

});
