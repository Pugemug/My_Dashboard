# Testautomatisierung – Flow Analytics Dashboard

**Version:** 1.0  
**Datum:** 2026-06-12  
**Status:** Bestätigt  

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

```
My_Dashboard/
  tests/
    unit/                    ← Vitest Unit Tests
      core.utils.test.js     ← toDate, dur, pct, fmt, intTicks
      core.filter.test.js    ← filteredRows, loadGlobalStatusOrder
      scatter.calc.test.js   ← CycleTime Berechnungen
      wipage.calc.test.js    ← WIPAge, Dual-Period-Logik, Aktiv-Logik
      heatmap.calc.test.js   ← Verweildauer, Dual-Period
      boxchart.calc.test.js  ← LeadTime Berechnungen
      flowefficiency.test.js ← Flow Efficiency Berechnung
      montecarlo.test.js     ← Simulation, CV, Throughput
    e2e/                     ← Playwright E2E Tests
      app.load.spec.js       ← App öffnen, Upload-Screen sichtbar
      data.upload.spec.js    ← Testdatensatz hochladen, Preview erscheint
      scatter.spec.js        ← CycleTime Scatterplot E2E
      wipage.spec.js         ← WIPAge E2E
      heatmap.spec.js        ← FlowHeatmap E2E
      montecarlo.spec.js     ← MonteCarlo E2E
    fixtures/
      testdata.xlsx          ← M17 Testdatensatz (noch zu erstellen)
      testdata-empty.xlsx    ← Nur Header, keine Datenzeilen
  package.json               ← Vitest + Playwright Abhängigkeiten
  vitest.config.js           ← Vitest Konfiguration
  playwright.config.js       ← Playwright Konfiguration
  .husky/
    pre-commit               ← npx vitest run (Unit Tests vor Commit)
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

### E2E Tests
- [ ] App öffnet ohne JS-Fehler in der Console
- [ ] Nach Upload: mindestens ein Visual zeigt `n=X` in der Diag-Bar
- [ ] Kein `undefined` oder `NaN` sichtbar im UI
- [ ] `testdata-empty.xlsx` hochladen → Leerzustand sichtbar, kein JS-Fehler

---

## Änderungshistorie

| Version | Datum | Änderung |
|---|---|---|
| 1.0 | 2026-06-12 | Initiale Spec – Konzept bestätigt |
