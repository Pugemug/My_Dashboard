# Testautomatisierung – Flow Analytics Dashboard

**Version:** 1.3  
**Datum:** 2026-06-15  
**Status:** Bestätigt – Phase 1 ✅ und Phase 2 (Option A) ✅ abgeschlossen  

---

## Aktueller Implementierungsstand (2026-06-15)

### Was heute existiert

| Datei | Status | Prüft was? |
|---|---|---|
| `tests/unit/core.utils.test.js` | ✅ echte Imports | Importiert aus `src/calc/core.calc.js` (30 Tests) |
| `tests/unit/scatter.calc.test.js` | ✅ echte Imports | Importiert aus `src/calc/scatter.calc.js` (12 Tests) |
| `tests/unit/wipage.calc.test.js` | ✅ echte Imports | Importiert aus `src/calc/wipage.calc.js` (10 Tests) |
| `tests/unit/flowefficiency.calc.test.js` | ✅ echte Imports | Importiert aus `src/calc/flowefficiency.calc.js` (8 Tests) |
| `tests/unit/boxchart.calc.test.js` | ✅ echte Imports | Importiert aus `src/calc/boxchart.calc.js` (10 Tests) |
| `tests/unit/heatmap.calc.test.js` | ✅ echte Imports | Importiert aus `src/calc/heatmap.calc.js` (16 Tests) |
| `tests/unit/montecarlo.calc.test.js` | ✅ echte Imports | Importiert aus `src/calc/montecarlo.calc.js` (14 Tests) |
| `tests/e2e/app.load.spec.js` | ✅ existiert | Upload-Screen sichtbar, keine JS-Fehler beim Start |
| `tests/e2e/data.upload.spec.js` | ✅ implementiert | Datei-Upload + alle Tiles rendern, Leerdatei-Test |
| `tests/e2e/scatter.spec.js` | 📋 geplant | CycleTime Scatterplot E2E |
| `tests/e2e/wipage.spec.js` | 📋 geplant | WIPAge E2E |
| `tests/e2e/heatmap.spec.js` | 📋 geplant | FlowHeatmap E2E |
| `tests/e2e/montecarlo.spec.js` | 📋 geplant | MonteCarlo E2E |

### Bekannte strukturelle Schwäche – Copy-Paste-Anti-Pattern

**Problem:** Alle Unit-Tests kopieren die zu testende Logik direkt in die Test-Datei, anstatt sie aus den echten Quelldateien zu importieren. Beispiel:

```js
// tests/unit/flowefficiency.calc.test.js
// ↓ kopiert aus flowefficiency.js – NOT: import { calcItemFE } from '../../src/flowefficiency.js'
function calcItemFE(row, ltStartCol, ltEndCol) { ... }
```

**Konsequenzen:**
- Fehler in der Quelldatei (fehlende Imports, falsche Variablen) sind für Unit-Tests unsichtbar
- Der fehlende `import { core }` in `flowefficiency.js` wurde so nicht entdeckt
- Tests können grün sein, während die echte App abstürzt
- Copy und Original können divergieren ohne dass jemand es merkt

**Ursache:** `vitest.config.js` nutzt `environment: 'node'`. Browser-APIs (`document`, `localStorage`, `window`) stehen nicht zur Verfügung. Da die Visual-Module `core.js` importieren (das Browser-APIs nutzt), können sie nicht direkt in Tests importiert werden.

**Konsequenz für bisher nicht erkannte Bugs (2026-06-15):**

| Bug | Hätte gebraucht |
|---|---|
| Fehlender `import { core }` in `flowefficiency.js` | E2E-Test mit Datei-Upload |
| `Math.max(...[])` → `-Infinity` | Unit-Test der echten `_kde`-Funktion mit leerem Input |
| XSS in innerHTML | Security-Test: manipulierter localStorage + DOM-Prüfung |
| Rejected in WIP gezählt | Unit-Test für `wip.js` mit Rejected-Datum gesetzt |
| Tote CARD_PAGE_MAP Einträge | Integrationstest: alle Visual-IDs gegen Map prüfen |
| Hardcodierte Farbe | Theme-Toggle + Farbprüfung im DOM |
| Toter page-canvas | DOM-Strukturtest |
| Redundante Methode | API-Surface-Test (geringer Wert) |

### Phase 1 – E2E-Upload-Test ✅ abgeschlossen

`tests/e2e/data.upload.spec.js` implementiert. Prüft:
- `testdata.xlsx` hochladen → Datencheck-Page erscheint
- CTA-Klick → `#tile-canvas-lieferfahigkeit` sichtbar
- Alle 4 Tiles (`#tile-boxchart`, `#tile-flowefficiency`, `#tile-happinessfaktor`, `#tile-wip`) erscheinen ohne JS-Fehler
- Kein `undefined`/`NaN` im Tile-Canvas-Inhalt
- Alle Diag-Bars rendern ohne `undefined`
- `testdata-empty.xlsx` → Leerzustand, kein JS-Fehler

Dieser Test hätte den Crash in `flowefficiency.js` gefunden.

### Phase 2 – Echte Imports via `src/calc/` ✅ abgeschlossen (Option A)

Alle Unit-Tests importieren jetzt aus echten `src/calc/`-Dateien statt Logik zu kopieren.

**Neue Dateien in `src/calc/`:**
- `core.calc.js` – `toDate`, `dur`, `pct`, `fmt`, `intTicks`, `dualPeriodDuration`, `isErledigt`, `DUAL_PERIOD_THRESHOLD_MS`
- `scatter.calc.js` – `calcCT`, `calcCTFromRow`
- `flowefficiency.calc.js` – `WAIT_STATUS`, `calcItemFE`
- `wipage.calc.js` – `calcAge`, `isActive`, `parseExcludeList`
- `heatmap.calc.js` – `stateStats`, `calcHeatmapT`
- `boxchart.calc.js` – `calcBoxStats`, `isOutlier`
- `montecarlo.calc.js` – `calcCV`, `runSimulation`

**Visual-Quelldateien delegieren an `src/calc/`:** `core.js`, `scatter.js`, `flowefficiency.js`, `wipage.js`, `heatmap.js`, `boxchart.js`, `montecarlo.js`

Ergebnis: 100 Unit-Tests + 10 E2E-Tests, alle grün.

### Phase 3 – Bundle-Build-Fehler abfangen ✅ abgeschlossen (2026-06-16)

**Hintergrund:** Beim Umstieg auf einen gebündelten Build (`build.py` + `src/calc/`) traten Laufzeitfehler auf, die weder Unit-Tests noch E2E-Tests aufgedeckt hätten:

| Fehler | Ursache | Warum nicht gefunden |
|---|---|---|
| `Unexpected identifier 'as'` | Mehrzeiliger `import { X as Y }` nicht entfernt | Unit-Tests importieren ES-Module nativ; Build-Fehler unsichtbar |
| `_toDate is not defined` | Aliasierter Import (`toDate as _toDate`) wurde gelöscht statt in `const` umgewandelt | Wie oben |
| `WAIT_STATUS is not defined` | `calc/`-Dateien wurden nicht in Bundle eingebunden | Build-Skript prüfte nur `init_*`, nicht Vollständigkeit |
| `mean is not defined` | Variable in `montecarlo.js` genutzt, aber nur innerhalb `calcCV` lokal definiert | Unit-Tests testen nur `calcCV()`-Rückgabewert, nicht Nutzung in `_renderStability` |

**Kernproblem:** `alert('Fehler beim Laden: ...')` im `try/catch` von `_loadFile()` wirft **keinen** `pageerror`-Event. Playwright's `page.on('pageerror')` ist blind dafür.

**Fixes (2026-06-16):**
1. `strip_module_syntax` in `build.py` wandelt `import { X as Y }` → `const Y = X;` um
2. `build.py` bündelt jetzt alle `src/calc/*.js` vor den Visuals
3. `build.py`-Selbstcheck prüft auf verbliebene `import`/`from`-Syntax im Bundle
4. Alle E2E-Tests registrieren `page.on('dialog')` zusätzlich zu `page.on('pageerror')`
5. Bug in `montecarlo.js`: `mean` wird jetzt in `_renderStability` lokal berechnet

**Regel für künftige E2E-Tests:** Immer beide Handler registrieren:
```js
page.on('pageerror', err => jsErrors.push(err.message));
page.on('dialog', async dialog => { dialogs.push(dialog.message()); await dialog.dismiss(); });
// ...
expect(dialogs, `alert() aufgetreten: ${dialogs.join(', ')}`).toHaveLength(0);
expect(jsErrors).toHaveLength(0);
```

---

## Ersteinrichtung

Einmalig ausführen wenn das Projekt frisch geklont wurde oder auf einem neuen Rechner eingerichtet wird:

```bash
# 1. Abhängigkeiten installieren (Vitest + Playwright)
npm install

# 2. Playwright-Browser herunterladen (einmalig, ~150 MB)
npx playwright install chromium

# 3. Prüfen ob alles funktioniert
npm test
```

Erwartete Ausgabe von `npm test`:
```
✓ tests/unit/core.utils.test.js        (30 tests)
✓ tests/unit/scatter.calc.test.js      (12 tests)
✓ tests/unit/wipage.calc.test.js       (10 tests)
✓ tests/unit/flowefficiency.calc.test.js (8 tests)
✓ tests/unit/boxchart.calc.test.js     (10 tests)
✓ tests/unit/heatmap.calc.test.js      (16 tests)
✓ tests/unit/montecarlo.calc.test.js   (14 tests)

Test Files  7 passed
Tests       100 passed
```

**Voraussetzungen:**
- Node.js installiert (Version 18 oder neuer) — prüfen mit `node --version`
- Python + openpyxl für Testdatensatz-Erzeugung: `pip install openpyxl`

**Testdatensatz neu erzeugen** (falls `tests/fixtures/testdata.xlsx` fehlt):
```bash
python tools/create_testdata.py
```

**E2E Tests ausführen** (brauchen ein aktuelles Bundle):
```bash
python build.py              # App bündeln
npm run test:e2e             # Playwright starten
```

---

## Block A – Zweck & Abgrenzung

### Was diese Spec beschreibt
Automatisierte Tests für das Flow Analytics Dashboard in zwei Schichten:

1. **Unit Tests (Vitest)** – prüfen isolierte Berechnungslogik ohne Browser
2. **E2E Tests (Playwright)** – steuern die echte App im Browser

### Was explizit NICHT abgedeckt wird
- Kein Performance-Testing
- Kein Screenshot-Vergleich (Visual Regression)
- Keine Accessibility-Tests
- Kein Power BI, kein Server

### Technologie
- Unit Tests: **Vitest** (ESM-nativ, kein Babel, minimaler Setup)
- E2E Tests: **Playwright** (Cross-Browser, lokal + CI)
- Test-Runner: Node.js (lokal installiert, nicht deployed)
- Pre-commit: **Husky** (blockiert Commit wenn Unit Tests rot)

---

## Block B – Datenmodell für Tests

### Testdatensatz (M17) – fixtures/testdata.xlsx

Der Standard-Testdatensatz wird unter `tests/fixtures/testdata.xlsx` gespeichert.

**JiraStories-Sheet muss enthalten:**

| Fall | Beschreibung |
|---|---|
| `_first` gleich Basiswert | Item hat Status nur einmal durchlaufen |
| `_first` verschieden von Basiswert | Item hat Status zweimal durchlaufen (Dual-Period) |
| `Resolved` leer, `Rejected` leer | Aktives WIP-Item |
| `Rejected` gefüllt | Abgebrochenes Item (nicht in Rolling Pace) |
| `Resolved` gefüllt | Abgeschlossenes Item |
| `Squad` leer | Item ohne Teamzuordnung |
| Squad mit genau 1 Item | Grenzfall für Statistiken |
| Squad mit ≥ 20 Items | Normalfall |
| Kein `Issue-Type` | Optionale Spalte fehlt |
| Negativer CT-Wert | Inkonsistente Datumswerte (End < Start) |

**Optionale Sheets:**
- `Epics` – für Say_Do_Ratio Tests
- `Happiness Faktor` – Custom-Header in Zeile 3

**Fehlende Sheets:** Tests prüfen explizit den Leerzustand wenn Sheet fehlt.

---

## Block C – Ordnerstruktur

**Legende:** ✅ existiert · 📋 geplant · ⚠️ strukturelle Schwäche

```
My_Dashboard/
  tests/
    unit/                         ← Vitest Unit Tests (environment: node)
      core.utils.test.js   ✅     ← toDate, dur, pct, fmt, intTicks (aus src/calc/core.calc.js)
      scatter.calc.test.js ✅     ← CycleTime Berechnungen (aus src/calc/scatter.calc.js)
      wipage.calc.test.js  ✅     ← WIPAge, Dual-Period, Aktiv-Logik (aus src/calc/wipage.calc.js)
      heatmap.calc.test.js ✅     ← Verweildauer, Dual-Period (aus src/calc/heatmap.calc.js)
      boxchart.calc.test.js ✅    ← LeadTime Berechnungen (aus src/calc/boxchart.calc.js)
      flowefficiency.calc.test.js ✅ ← Flow Efficiency (aus src/calc/flowefficiency.calc.js)
      montecarlo.calc.test.js ✅  ← Simulation, CV, Throughput (aus src/calc/montecarlo.calc.js)
      core.filter.test.js  📋    ← filteredRows, loadGlobalStatusOrder
      wip.calc.test.js     📋    ← WIP-Berechnung, Rejected-Ausschluss
    e2e/                          ← Playwright E2E Tests
      app.load.spec.js     ✅     ← App öffnet, Upload-Screen sichtbar, keine JS-Fehler
      data.upload.spec.js  ✅     ← Testdatensatz hochladen, alle Tiles rendern (6 Tests)
      scatter.spec.js      📋    ← CycleTime Scatterplot E2E
      wipage.spec.js       📋    ← WIPAge E2E
      heatmap.spec.js      📋    ← FlowHeatmap E2E
      montecarlo.spec.js   📋    ← MonteCarlo E2E
    fixtures/
      testdata.xlsx        ✅     ← M17 Testdatensatz (erzeugt via create_testdata.py)
      testdata-empty.xlsx  ✅     ← Nur Header, keine Datenzeilen
  package.json                    ← Vitest + Playwright Abhängigkeiten
  vitest.config.js                ← Vitest Konfiguration (environment: node)
  playwright.config.js            ← Playwright Konfiguration
  .husky/
    pre-commit                    ← npx vitest run (Unit Tests vor Commit)
```

### Geplant: data.upload.spec.js (Phase 1 – Priorität hoch)

```js
// tests/e2e/data.upload.spec.js
import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('Datei-Upload und Visual-Rendering', () => {
  test('Testdatei hochladen → alle Tiles ohne JS-Fehler', async ({ page }) => {
    const jsErrors = [];
    page.on('pageerror', err => jsErrors.push(err.message));

    await page.goto(APP_PATH);
    await page.waitForLoadState('domcontentloaded');

    // Datei hochladen
    const fixturePath = path.resolve('tests/fixtures/testdata.xlsx');
    await page.locator('#file-input').setInputFiles(fixturePath);

    // Datencheck-Page erscheint
    await expect(page.locator('#page-datencheck')).toBeVisible({ timeout: 5000 });

    // CTA klicken → Lieferfähigkeit-Page
    await page.locator('.btn-cta').click();
    await expect(page.locator('#tile-canvas-lieferfahigkeit')).toBeVisible();

    // Tiles erscheinen – keine JS-Fehler
    expect(jsErrors).toHaveLength(0);
    await expect(page.locator('#tile-boxchart')).toBeVisible();

    // Keine undefined/NaN im gerendertem Inhalt
    const bodyText = await page.locator('#tile-canvas-lieferfahigkeit').textContent();
    expect(bodyText).not.toContain('undefined');
    expect(bodyText).not.toContain('NaN');
  });

  test('Leerdatei hochladen → Leerzustand, kein JS-Fehler', async ({ page }) => {
    const jsErrors = [];
    page.on('pageerror', err => jsErrors.push(err.message));

    await page.goto(APP_PATH);
    const emptyPath = path.resolve('tests/fixtures/testdata-empty.xlsx');
    await page.locator('#file-input').setInputFiles(emptyPath);
    await page.locator('.btn-cta').click();

    expect(jsErrors).toHaveLength(0);
  });
});
```

---

## Block D – Berechnungslogik der Tests

### Unit Test Kategorien

#### 1. core.utils – Grundfunktionen
```
toDate(v):
  - Excel-Seriennummer → Date
  - ISO-String → Date
  - null/undefined/leer → null
  - ungültiger String → null

dur(a, b):
  - Normaler Fall: (b - a) / 86400000 + 1
  - a == b: 1 Tag (inklusiv)
  - b < a: null (negativ → ungültig)
  - ein Datum null: null

pct(arr, p):
  - Leeres Array → null
  - 1 Element → das Element selbst
  - Interpolation zwischen Elementen

intTicks(max, n):
  - Immer ganzzahlige Werte
  - Erster Tick = 0, letzter ≥ max
  - Schritt immer ≥ 1
```

#### 2. Dual-Period-Logik (kritisch – war Quelle von Bugs)
```
Schwellenwert: < 43.200.000 ms (0,5 Tage)

Fall A: X_first ≈ X (gleicher Tag)
  → Dauer = leaving_X − X + 1

Fall B: X_first ≠ X (zweimal durchlaufen)
  → Dauer = (leaving_X_first − X_first + 1) + (leaving_X − X + 1)
```

#### 3. Aktiv/Erledigt-Logik (XOR)
```
erledigt = Resolved ODER Rejected gefüllt
aktiv    = weder Resolved noch Rejected gefüllt
```

#### 4. Flow Efficiency
```
FE = aktive Bearbeitungszeit / Gesamtdurchlaufzeit × 100%
Grenzfall: Gesamtdurchlaufzeit = 0 → null (kein Div/0)
```

### E2E Test Szenarien

#### Smoke-Test (ersetzt manuellen M9-Check)
1. `FlowAnalytics.html` öffnen → Upload-Screen sichtbar
2. `testdata.xlsx` hochladen → Data-Preview erscheint, CTA-Button aktiv
3. Zur Lieferfähigkeit-Page navigieren → Tiles erscheinen
4. Theme-Toggle → Visual-Hintergrund wechselt

#### Pro Visual (aus Block G der jeweiligen Spec)
- Visual erscheint nach Datei-Upload
- Diag-Bar zeigt `n=X` (nicht leer)
- Leerzustand: korrekte Meldung wenn relevantes Sheet fehlt
- Config-State überlebt Browser-Reload

---

## Block E – Konfiguration

| Property | Datei | Default | Beschreibung |
|---|---|---|---|
| `testTimeout` | vitest.config.js | 5000ms | Max. Dauer pro Unit Test |
| `browser` | playwright.config.js | Chromium | Playwright Browser |
| `baseURL` | playwright.config.js | `file:///.../Web App/FlowAnalytics.html` | Pfad zur gebündelten App |
| `headless` | playwright.config.js | true (CI), false (lokal) | Browser sichtbar? |

---

## Block F – Integration in bestehenden Prozess

### SDD-Integration (neue Pflicht-Schritte)

**Beim SDD-Interview Block G:**
Claude schreibt nach dem Interview automatisch einen **Test-Skeleton** für das neue Visual:
- `tests/unit/[visualName].calc.test.js` – leere `it()`-Blöcke für jeden AC
- `tests/e2e/[visualName].spec.js` – Playwright-Skeleton für Smoke-Test

**Gate 2 (Pre-Delivery Review) – neuer Pflicht-Check:**
```
- [ ] Unit Tests für dieses Visual: alle grün (npx vitest run tests/unit/[visual].test.js)
- [ ] E2E Smoke-Test: Visual erscheint nach Upload (npx playwright test e2e/[visual].spec.js)
```

**Pre-commit Hook:**
- Blockiert Commit wenn `npx vitest run` fehlschlägt
- E2E Tests laufen NICHT automatisch vor Commit (zu langsam)

### Bestehende Maßnahmen unverändert
M9 (manueller Smoke-Test) bleibt erhalten – E2E Tests ersetzen ihn nicht vollständig, da M9 auch subjektive Qualitätsprüfung enthält.

---

## Block G – Akzeptanzkriterien

### Setup & Konfiguration
- [ ] `npm install` läuft ohne Fehler auf Windows 11
- [ ] `npx vitest run` findet alle `tests/unit/**/*.test.js` und gibt Ergebnis aus
- [ ] `npx playwright test` findet alle `tests/e2e/**/*.spec.js`
- [ ] Pre-commit Hook: Commit wird geblockt wenn ein Unit Test fehlschlägt
- [ ] Pre-commit Hook: Commit geht durch wenn alle Unit Tests grün sind

### Unit Tests – core.js
- [ ] `toDate(44927)` (Excel-Seriennummer) → gültiges Date-Objekt
- [ ] `toDate(null)` → null
- [ ] `dur('2024-01-01', '2024-01-03')` → 3 (inklusiv)
- [ ] `dur('2024-01-01', '2024-01-01')` → 1 (gleicher Tag = 1 Tag)
- [ ] `dur('2024-01-03', '2024-01-01')` → null (negativ ungültig)
- [ ] `pct([], 50)` → null
- [ ] `intTicks(7, 5)` → Array mit 0 als erstem Wert, letzter Wert ≥ 7

### Unit Tests – Dual-Period-Logik
- [ ] Item mit `X_first == X` → einfache Dauer berechnet
- [ ] Item mit `X_first != X` (> 0,5 Tage Differenz) → additive Dauer berechnet

### Unit Tests – Aktiv/Erledigt
- [ ] `Resolved` gefüllt, `Rejected` leer → erledigt
- [ ] `Resolved` leer, `Rejected` gefüllt → erledigt
- [ ] Beide leer → aktiv
- [ ] `Resolved` gefüllt, `Rejected` gefüllt → erledigt (beide gesetzt = Datenqualitätsproblem, kein Absturz)

### E2E Tests – Smoke (app.load.spec.js, ✅ implementiert)
- [ ] App öffnet ohne JS-Fehler in der Console
- [ ] Upload-Screen sichtbar beim Start
- [ ] Kein `undefined` oder `NaN` im Upload-Screen-Text

### E2E Tests – Datei-Upload (data.upload.spec.js, ✅ implementiert – Phase 1)
- [x] `testdata.xlsx` hochladen → Datencheck-Page erscheint
- [x] CTA-Button klicken → `#tile-canvas-lieferfahigkeit` sichtbar
- [x] `#tile-boxchart` erscheint (kein JS-Fehler, kein leerer Container)
- [x] Kein `undefined` oder `NaN` im tile-canvas-Inhalt
- [x] Alle Diag-Bars rendern ohne `undefined`
- [x] `testdata-empty.xlsx` hochladen → Leerzustand sichtbar, kein JS-Fehler
- [x] `page.on('pageerror')` liefert leeres Array (keine unbehandelten JS-Fehler)

---

## Änderungshistorie

| Version | Datum | Änderung |
|---|---|---|
| 1.3 | 2026-06-15 | Phase 1 ✅: data.upload.spec.js implementiert (6 Tests). Phase 2 ✅: Option A umgesetzt — 7 `src/calc/`-Dateien extrahiert, alle Visual-Quelldateien delegieren dorthin, alle Unit-Tests importieren aus echten Quellen (100 Tests). Gesamt: 10 E2E-Tests + 100 Unit-Tests, alle grün. |
| 1.2 | 2026-06-15 | Strukturelle Schwäche Copy-Paste-Anti-Pattern dokumentiert (Ursache: 8 unentdeckte Bugs). Aktueller Implementierungsstand + Statusmarkierungen in Block C ergänzt. data.upload.spec.js als Phase-1-Priorität und Beispiel-Implementierung ergänzt. Dreiphasen-Migrationsplan (Option A/B/C) dokumentiert. Block G um Upload-E2E-Kriterien erweitert. |
| 1.1 | 2026-06-12 | Ersteinrichtungs-Abschnitt ergänzt |
| 1.0 | 2026-06-12 | Initiale Spec – Konzept bestätigt |
