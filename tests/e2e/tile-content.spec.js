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
const APP_PATH      = `file://${path.resolve(__dirname, '../../Web App/FlowAnalytics.html')}`;
const FIXTURE       = path.resolve(__dirname, '../fixtures/testdata.xlsx');
const FIXTURE_SINGLE = path.resolve(__dirname, '../fixtures/testdata-single-squad.xlsx');

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

// ── Kachel-Reihenfolge (Lieferfähigkeit) ─────────────────────────────────────

test.describe('Kachel-Reihenfolge – Lieferfähigkeit', () => {

  const DEFAULT_ORDER  = ['boxchart', 'saydoratioepics', 'happinessfaktor', 'flowefficiency', 'wip', 'akzeptanz'];
  const TILE_ORDER_KEY = 'fhwa_tile_order';

  async function getTileOrder(page) {
    return page.locator('#tile-canvas-lieferfahigkeit .tile').evaluateAll(
      els => els.map(el => el.id.replace('tile-', ''))
    );
  }

  /** Navigiert zur App, setzt den gewünschten localStorage-Wert und geht durch den Upload-Flow. */
  async function navigateWithOrder(page, order) {
    await page.goto(APP_PATH);
    await page.waitForLoadState('domcontentloaded');
    if (order === null) {
      await page.evaluate(k => localStorage.removeItem(k), TILE_ORDER_KEY);
    } else {
      await page.evaluate(([k, v]) => localStorage.setItem(k, v), [TILE_ORDER_KEY, JSON.stringify(order)]);
    }
    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    await page.locator('#file-input').setInputFiles(FIXTURE);
    await expect(page.locator('#page-datencheck')).toBeVisible({ timeout: 5000 });
    await page.locator('.btn-cta').click();
    await expect(page.locator('#tile-canvas-lieferfahigkeit')).toBeVisible({ timeout: 5000 });
  }

  test('Standard-Reihenfolge wird ohne gespeicherten Wert angewendet', async ({ page }) => {
    await navigateWithOrder(page, null);
    const order = await getTileOrder(page);
    expect(order).toEqual(DEFAULT_ORDER);
  });

  test('Gespeicherte Reihenfolge wird nach Reload wiederhergestellt', async ({ page }) => {
    const custom = ['wip', 'boxchart', 'saydoratioepics', 'happinessfaktor', 'flowefficiency', 'akzeptanz'];
    await navigateWithOrder(page, custom);
    const order = await getTileOrder(page);
    expect(order).toEqual(custom);
  });

  test('"Kachel-Reihenfolge zurücksetzen" stellt Standard her und aktualisiert localStorage', async ({ page }) => {
    const custom = ['wip', 'flowefficiency', 'boxchart', 'saydoratioepics', 'happinessfaktor', 'akzeptanz'];
    await navigateWithOrder(page, custom);
    expect(await getTileOrder(page)).toEqual(custom);

    await page.locator('#btn-settings').click();
    await expect(page.locator('#settings-panel')).toBeVisible();
    await page.locator('#settings-tile-order-reset').click();

    expect(await getTileOrder(page)).toEqual(DEFAULT_ORDER);
    const saved = await page.evaluate(k => localStorage.getItem(k), TILE_ORDER_KEY);
    expect(JSON.parse(saved)).toEqual(DEFAULT_ORDER);
  });

  test('Alle 6 Tiles sind mit draggable="true" markiert', async ({ page }) => {
    await navigateToTiles(page);
    const tiles = page.locator('#tile-canvas-lieferfahigkeit .tile');
    expect(await tiles.count()).toBe(6);
    for (let i = 0; i < 6; i++) {
      expect(await tiles.nth(i).getAttribute('draggable')).toBe('true');
    }
  });

});

// ── Tile-Vollbild-Modus ───────────────────────────────────────────────────────

test.describe('Tile-Vollbild – Expand/Collapse', () => {

  const TILE_IDS = ['boxchart', 'saydoratioepics', 'happinessfaktor', 'flowefficiency', 'wip', 'akzeptanz'];

  test('Jede Tile hat einen sichtbaren ⤢-Button', async ({ page }) => {
    await navigateToTiles(page);
    for (const id of TILE_IDS) {
      await expect(page.locator(`#tile-${id} .tile-expand-btn`)).toBeVisible();
    }
  });

  test('Klick auf ⤢ öffnet Modal (Panel + Backdrop sichtbar)', async ({ page }) => {
    await navigateToTiles(page);
    await page.locator('#tile-boxchart .tile-expand-btn').click();
    await expect(page.locator('#tile-fullscreen-panel')).toBeVisible();
    await expect(page.locator('#tile-fullscreen-backdrop')).toBeVisible();
  });

  test('Vollbild-Header zeigt Kachel-Titel (nicht leer)', async ({ page }) => {
    await navigateToTiles(page);
    await page.locator('#tile-boxchart .tile-expand-btn').click();
    await expect(page.locator('#tile-fullscreen-panel')).toBeVisible();
    const title = await page.locator('#tile-fullscreen-title').textContent();
    expect(title.trim().length).toBeGreaterThan(0);
  });

  test('Header-Controls (Tabs, ⚙, ?) sind im Vollbild sichtbar', async ({ page }) => {
    await navigateToTiles(page);
    // Flow Efficiency hat Linie/Violin-Tabs + ⚙ + ?
    await page.locator('#tile-flowefficiency .tile-expand-btn').click();
    await expect(page.locator('#tile-fullscreen-panel')).toBeVisible();
    const headerBtns = page.locator('#tile-fullscreen-content .tile-header .btn-icon:not(.tile-expand-btn)');
    expect(await headerBtns.count()).toBeGreaterThan(0);
    await expect(headerBtns.first()).toBeVisible();
  });

  test('Schließen per ×-Button: Modal versteckt, Tile zurück im Canvas', async ({ page }) => {
    await navigateToTiles(page);
    await page.locator('#tile-boxchart .tile-expand-btn').click();
    await expect(page.locator('#tile-fullscreen-panel')).toBeVisible();
    await page.locator('#tile-fullscreen-close').click();
    await expect(page.locator('#tile-fullscreen-panel')).toBeHidden();
    await expect(page.locator('#tile-canvas-lieferfahigkeit #tile-boxchart')).toBeVisible();
  });

  test('Schließen per Backdrop-Klick außerhalb des Panels', async ({ page }) => {
    await navigateToTiles(page);
    await page.locator('#tile-boxchart .tile-expand-btn').click();
    await expect(page.locator('#tile-fullscreen-panel')).toBeVisible();
    // Klick in obere linke Ecke – das Panel beginnt erst bei 5%/5%
    await page.locator('#tile-fullscreen-backdrop').click({ position: { x: 10, y: 10 } });
    await expect(page.locator('#tile-fullscreen-panel')).toBeHidden();
  });

  test('Sidebar-Navigation schließt das Vollbild-Modal automatisch', async ({ page }) => {
    await navigateToTiles(page);
    await page.locator('#tile-boxchart .tile-expand-btn').click();
    await expect(page.locator('#tile-fullscreen-panel')).toBeVisible();
    await page.locator('.sidebar-link[data-page="scatter"]').click();
    await expect(page.locator('#tile-fullscreen-panel')).toBeHidden();
  });

  test('Kein JS-Fehler beim Öffnen und Schließen des Vollbilds', async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await navigateToTiles(page);
    await page.locator('#tile-boxchart .tile-expand-btn').click();
    await expect(page.locator('#tile-fullscreen-panel')).toBeVisible();
    await page.locator('#tile-fullscreen-close').click();
    await expect(page.locator('#tile-fullscreen-panel')).toBeHidden();
    expect(errors).toHaveLength(0);
  });

});

// ── 1-Squad-Sonderfall ───────────────────────────────────────────────────────

async function navigateToTilesSingleSquad(page) {
  await page.goto(APP_PATH);
  await page.waitForLoadState('domcontentloaded');
  await page.locator('#file-input').setInputFiles(FIXTURE_SINGLE);
  await expect(page.locator('#page-datencheck')).toBeVisible({ timeout: 5000 });
  await page.locator('.btn-cta').click();
  await expect(page.locator('#tile-canvas-lieferfahigkeit')).toBeVisible({ timeout: 5000 });
}

test.describe('1-Squad-Sonderfall – Auto-Setzung des Squad-Filters', () => {

  test('Filter-Button zeigt Squad-Namen statt "Alle"', async ({ page }) => {
    await navigateToTilesSingleSquad(page);
    const text = await page.locator('#btn-squad').textContent();
    expect(text).toContain('Squad-X');
    expect(text).not.toContain('Alle');
  });

  test('Filter-Button trägt die Klasse pf-active', async ({ page }) => {
    await navigateToTilesSingleSquad(page);
    await expect(page.locator('#btn-squad')).toHaveClass(/pf-active/);
  });

  test('WIP-Tile: kein "genau einen Squad"-Hinweis ohne manuelle Auswahl', async ({ page }) => {
    await navigateToTilesSingleSquad(page);
    const diag = await page.locator('#tile-wip .diag-bar').textContent();
    expect(diag).not.toContain('genau einen Squad');
  });

  test('WIP-Tile: SVG-Chart wird ohne manuelle Squad-Auswahl gezeichnet', async ({ page }) => {
    await navigateToTilesSingleSquad(page);
    await page.waitForSelector('#tile-wip svg', { timeout: 5000 });
    await expect(page.locator('#tile-wip svg')).toBeVisible();
  });

  test('Happiness-Tile: SVG-Chart wird ohne manuelle Squad-Auswahl gezeichnet', async ({ page }) => {
    await navigateToTilesSingleSquad(page);
    await page.waitForSelector('#tile-happinessfaktor svg', { timeout: 5000 });
    await expect(page.locator('#tile-happinessfaktor svg')).toBeVisible();
  });

  test('Akzeptanz-Tile: kein "Kein Squad"-Hinweis ohne manuelle Auswahl', async ({ page }) => {
    await navigateToTilesSingleSquad(page);
    const diag = await page.locator('#tile-akzeptanz .diag-bar').textContent();
    expect(diag).not.toContain('Kein Squad');
  });

});

// ── Settings-Panel: Jira URL Default ─────────────────────────────────────────

test.describe('Settings-Panel – Jira URL Default', () => {

  test('URL-Eingabe zeigt Default-URL wenn kein Wert gespeichert', async ({ page }) => {
    await page.goto(APP_PATH);
    await page.waitForLoadState('domcontentloaded');
    await page.evaluate(() => {
      const raw = localStorage.getItem('fhwa_global');
      if (raw) {
        try {
          const g = JSON.parse(raw);
          delete g.urlTemplate;
          localStorage.setItem('fhwa_global', JSON.stringify(g));
        } catch (_) {}
      }
    });
    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    await page.locator('#file-input').setInputFiles(FIXTURE);
    await expect(page.locator('#page-datencheck')).toBeVisible({ timeout: 5000 });
    await page.locator('.btn-cta').click();
    await expect(page.locator('#tile-canvas-lieferfahigkeit')).toBeVisible({ timeout: 5000 });

    await page.locator('#btn-settings').click();
    await expect(page.locator('#settings-panel')).toBeVisible();

    const value = await page.locator('#settings-url-input').inputValue();
    expect(value).toBe('https://jira.axa.com/jira/browse/{issueKey}');
  });

});
