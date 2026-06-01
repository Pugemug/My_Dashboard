# Flow Analytics Dashboard – Projektübergabe

**Version:** 2.1  
**Datum:** 2026-06-01  
**Basis:** v2.0 + WIPAge Chart (`wipage.js`) als Visual 3

---

## Was die App macht

Browser-basiertes Flow-Analytics-Dashboard: Vier Dateien in einem SharePoint-Ordner (kein Server, kein Build-System), die eine Excel-Datei einlesen und Visuals in einem frei konfigurierbaren Grid-Dashboard anzeigen.

**Visual 1 – FlowHeatmap (`heatmap.js`):** Kumulative Verweildauer von Work Items in Workflow-Zuständen, gruppiert nach Issue-Type oder Squad, mit Status-Visibility-Steuerung und Lead-Time-Konfiguration.

**Visual 2 – CycleTime Scatterplot (`scatter.js`):** Durchlaufzeit (CT) jedes Work Items über die Zeit, mit Perzentil-Linien, 3 Farb-Modi und Jira-Link im Tooltip.

**Visual 3 – WIPAge Chart (`wipage.js`):** Scatterplot aktiver WIP-Items gruppiert nach aktuellem Status (X-Achse), mit dem Alter im aktuellen Status auf der Y-Achse. Rolling-Pace-Bänder (P50/P70/P85) aus abgeschlossenen Items der letzten N Tage. Dots wechseln ab einem konfigurierbaren Schwellwert die Farbe. Reihenfolge-Panel (▲/▼ + Drag) und Jira-Link im Tooltip.

---

## Was die App NICHT macht

- Kein Cross-Filter zwischen Visuals
- Keine weiteren Diagrammtypen (CFD, LeadTime BoxChart) – noch ausstehend
- Kein Server, keine API, kein Power BI
- Kein DAX, keine automatischen Aggregationen (wird alles in JS berechnet)

---

## Deployment

Alle 4 Dateien in **einen gemeinsamen Ordner** auf SharePoint/OneDrive legen. Nutzer öffnen `index.html` per Link im Browser. ES-Module funktionieren weil SharePoint über HTTPS ausliefert.

```
flow-analytics/
  index.html     ← Einstiegspunkt, Layout, CSS, Modul-Imports
  core.js        ← Gemeinsame Engine (State, Grid, Theme, Utils, Events)
  heatmap.js     ← FlowHeatmap Visual (vollständig eigenständig)
  scatter.js     ← CycleTime Scatterplot (vollständig eigenständig)
  wipage.js      ← WIPAge Chart (vollständig eigenständig)
```

**Abhängigkeiten (CDN, kein lokaler Install):**
```
Google Fonts: DM Sans + DM Mono
SheetJS:      https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js
```

---

## Excel-Datenstruktur

Sheet-Name: **`JiraStories`** (Pflicht, Fallback: erstes Sheet)

| Excel-Spalte | Rolle | Pflicht? |
|---|---|---|
| `Jira-ID` | Eindeutiger Item-Identifier | ✅ |
| `Issue-Type` | Grouping + Scatter-Farb-Modus „Typ" | optional |
| `Squad` | Grouping + globaler Filter | optional |
| `Issue-Status` | Aktueller Workflow-Status (Text) – **WIPAge X-Achse** | optional* |
| `In Progress_first` | WIP-Startmarker – **WIPAge Aktiv-Logik** | optional* |
| `Ready4Progress_first` | LT/CT Start-Default | optional |
| `Resolved` | LT/CT Ende-Default + WIPAge Aktiv-Logik (leer = aktiv) | optional |
| `[Zustand]` | Eintrittsdatum Workflow-Zustand – **WIPAge Y-Achse** | optional (mehrfach) |
| `leaving_[Zustand]` | Austrittsdatum Workflow-Zustand – **WIPAge Rolling Pace** | optional (mehrfach) |

*Für WIPAge Chart erforderlich.

**State-Erkennungslogik:** Spalte ist Workflow-Zustand wenn sie nicht in `META_COLS`, nicht `leaving_`-Präfix, nicht `_first`-Suffix, nicht `_Count`-Suffix.

**Dauerberechnung:** `(leaving_X - X) / 86400000 + 1` Tage — Ein- und Austrittstag zählen.

---

## Architektur

### Prinzip: Jedes Visual ist eine eigenständige Datei

```
index.html
  └── <script type="module">
        import { core }        from './core.js'
        import { init }        from './heatmap.js'   → abonniert core-Events
        import { init }        from './scatter.js'   → abonniert core-Events
        import { init }        from './wipage.js'    → abonniert core-Events
        // import { init }     from './boxchart.js'  ← neue Zeile = neues Visual
```

Jedes Visual:
- erzeugt seine eigene Card via `core.createCard()`
- hält seinen Config-State **lokal** (nicht in core)
- abonniert `core.on('data' | 'theme' | 'filter' | 'resize', fn)` — plus `'settings'` wenn es `core.state.urlTemplate` nutzt
- schreibt in eigenen localStorage-Key (`fhwa_xyz`)
- berührt keinen Code anderer Visuals

### DOM-Struktur (index.html)

```
<body>
  #upload-screen      Drag&Drop + Datei-Picker
  #app-screen
    .topbar           Logo · File-Badge · 🏰 Squads · ⚙ Einstellungen · ☀/🌙 Theme · Neue Datei
    #dashboard        overflow:auto — scrollt wenn Cards über Viewport hinausgehen
      #dash-canvas    position:relative — wächst mit Cards mit (_updateCanvasH)
        #card-heatmap position:absolute  ← von heatmap.js erzeugt
        #card-scatter position:absolute  ← von scatter.js erzeugt
        #card-wipage  position:absolute  ← von wipage.js erzeugt
  [Tooltips]          von jedem Visual eigenständig erzeugt und an body gehängt
```

### Neues Visual registrieren (2 Schritte, kein anderer Code nötig)

**Schritt 1** – neue `.js`-Datei schreiben (Template siehe unten).

**Schritt 2** – In `index.html` zwei Zeilen ergänzen:
```javascript
import { init as initBoxChart } from './boxchart.js';
// ...
initBoxChart();
```

---

## core.js – Public API

`core` ist ein Singleton-Objekt das alle Visuals importieren.

### Shared State (nur lesen, nie direkt schreiben)

```javascript
core.state.rows          // Row[] — alle geladenen Excel-Zeilen
core.state.dateCols      // string[] — alle Datumsspalten
core.state.states        // { name, entryCol, exitCol }[] — erkannte Workflow-Zustände
core.state.stateOrder    // string[] — aktuelle Reihenfolge der Zustände
core.state.allSquads     // string[] — alle Squad-Namen
core.state.hasSquad      // boolean
core.state.hasIssueType  // boolean
core.state.squadFilter   // string[] — aktiver globaler Filter ([] = alle)
core.state.fileName      // string
core.state.sheetName     // string
core.state.urlTemplate   // string — globales Jira URL-Template (⚙ Einstellungen-Panel)
```

### Event Bus

```javascript
core.on('data',     fn)    // Excel wurde geladen, state.rows gefüllt
core.on('theme',    fn)    // Dark/Light gewechselt → neu rendern
core.on('filter',   fn)    // Squad-Filter geändert → neu rendern
core.on('resize',   fn)    // Card wurde gezogen/resized → SVG neu rendern
core.on('settings', fn)    // Globale Einstellung geändert (z.B. urlTemplate) → neu rendern
core.emit(event)         // intern; Visuals rufen das nicht auf
```

### Card Factory

```javascript
const { cardEl, contentEl, headerExtraEl, diagEl } = core.createCard({
  id:          'wipage',                      // wird zu #card-wipage
  title:       'WIP<span class="hl">Age</span>',
  defaultGrid: { col: 0, row: 0, w: 6, h: 10 },
});
// cardEl         → das .card-Element
// contentEl      → .card-content (hier rein rendern)
// headerExtraEl  → freier Bereich im Card-Header für eigene Buttons/Toggles
// diagEl         → .diag-bar (Diagnose-Zeile unten)
```

### Daten-Utilities

```javascript
core.filteredRows()          // → Row[] nach activem squadFilter
core.toDate(v)               // Excel-Wert / String / Date → Date | null
core.dur(entryVal, exitVal)  // → Tage (inklusiv) | null
core.pct(sortedArr, p)       // → Perzentil p (0–100)
core.fmt(v)                  // → "12.3d" | "–"
```

### Theme & Farben

```javascript
core.isLight()               // → boolean
core.palette()               // → PALETTE_DARK | PALETTE_LIGHT (8 Farben)
core.lerp(t)                 // → rgb-String, Heatmap-Gradient (t = 0…1)
core.getCellContrast(t)      // → 'dark' | 'light' für Text auf Heatmap-Zelle
core.scatterColors()         // → { plotBg, gridLine, axisLine, axisLabel, dotStroke, … }
core.toggleTheme()           // Theme wechseln + 'theme'-Event emittieren
core.initTheme()             // Gespeichertes Theme beim Start laden
```

### Storage

```javascript
core.save(key, value)        // localStorage.setItem mit JSON.stringify
core.load(key, default)      // localStorage.getItem mit JSON.parse + Fallback
```

### Grid (intern, kein direkter Aufruf nötig)

Grid wird vollständig von `core.initLayout()` und `core.initDragResize()` verwaltet.
Layout-Key: `fhwa_layout2` (abweichend von v1.x `fhwa_layout` — Absicht, um alten gespeicherten State zu ignorieren).

---

## Visual-Template (Minimalbeispiel für neues Visual)

```javascript
// wipage.js
import { core } from './core.js';

export function init() {

  // 1. Lokaler Config-State (nur diese Datei kennt ihn)
  const cfg = core.load('fhwa_wipage', {
    maxAge: 30,
    // ...
  });

  // 2. Card anlegen
  const { contentEl, headerExtraEl, diagEl } = core.createCard({
    id:          'wipage',
    title:       'WIP<span class="hl">Age</span>',
    defaultGrid: { col: 0, row: 12, w: 6, h: 10 },
  });

  // 3. Eigene Header-Controls (optional)
  const btn = document.createElement('button');
  btn.className = 'btn-icon';
  btn.textContent = '⚙ Einstellungen';
  btn.onclick = () => { /* Panel öffnen */ };
  headerExtraEl.appendChild(btn);

  // 4. Render-Funktion
  function render() {
    const rows = core.filteredRows();
    // ... SVG oder DOM aufbauen, in contentEl einhängen
    diagEl.textContent = `n=${rows.length}`;
  }

  // 5. Config speichern
  function saveConfig() { core.save('fhwa_wipage', cfg); }

  // 6. Events abonnieren
  core.on('data',     render);
  core.on('theme',    render);
  core.on('filter',   render);
  core.on('resize',   render);
  core.on('settings', render);  // nur wenn core.state.urlTemplate genutzt wird
}
```

---

## localStorage-Keys

| Key | Datei | Inhalt |
|---|---|---|
| `fhwa_layout2` | core.js | `{ [visualId]: { col, row, w, h } }` für alle Cards |
| `fhwa_heatmap` | heatmap.js | metric, filter, ltStart, ltEnd, hiddenStates[], stateOrder[] |
| `fhwa_scatter` | scatter.js | colorMode, interval, ctStart, ctEnd, dotSize, singleColor, typeColors, P50/70/85/95 show+color |
| `fhwa_wipage` | wipage.js | rollingDays, statusAgeDays, alertColor, dotSize, showBands, excludeList, stateOrder[] |
| `fhwa_global` | core.js | squadFilter[], urlTemplate |
| `fhwa_theme` | core.js | `'dark'` \| `'light'` |
| `fhwa_boxchart` | boxchart.js | *(noch nicht implementiert)* |

**Hinweis:** `fhwa_layout` (ohne `2`) war der Key der alten Single-File-Version (v1.x). Wird ignoriert.

---

## Theme-System

### CSS-Variablen (in index.html)

```css
/* Dark (Standard) */
:root { --bg:#0f1c30; --bg2:#162035; --bg3:#1e2e47; --bg4:#273552;
  --border:#2a3d5c; --text:#e8f0fe; --dim:#8ba8c8; --dimmer:#4d6a88;
  --blue:#38bdf8; --red:#f87171; --green:#4ade80; --yellow:#fbbf24;
  --purple:#c084fc; --orange:#fb923c; }

/* Light */
[data-theme="light"] { --bg:#f1f5f9; --bg2:#ffffff; --bg3:#f8fafc; --bg4:#e2e8f0;
  --border:#cbd5e1; --text:#0f172a; --dim:#475569; --dimmer:#94a3b8;
  --blue:#0284c7; --red:#dc2626; --green:#16a34a; --yellow:#b45309;
  --purple:#7c3aed; --orange:#c2410c; }
```

`data-theme` sitzt auf `<html>`. Theme-Toggle ruft `core.toggleTheme()` auf, das 'theme'-Event emittiert — alle Visuals rendern neu.

### Farbpaletten

| | Dark | Light |
|---|---|---|
| Heatmap-Gradient | Navy `[28,42,63]` → Rot `[192,57,43]` | Hellblau `[219,234,254]` → Orange `[251,146,60]` |
| Scatter-Palette | `#38bdf8, #fb923c, #a78bfa, …` | `#0284c7, #c2410c, #7c3aed, …` |
| Dot-Halo | `rgba(0,0,0,0.45)` | `rgba(255,255,255,0.6)` |

**Regel:** Nie SVG-Farben hardcoden. Immer `core.scatterColors()` oder CSS-Variablen verwenden.

---

## Dashboard-Grid

```
GRID_COLS = 12      (Spalten)
GRID_ROW_H = 70px   (Zeilenhöhe)
```

**Drag:** Handle `⠿` → `core._initDrag(id)` → mousemove verschiebt frei → mouseup: `_snapToGrid()` → Kollisionsprüfung → bei Überlappung Revert → `_saveLayout()`.

**Resize:** Ecke rechts unten → `core._initResize(id)` → gleicher Ablauf.

**Überlappungsschutz:**
```javascript
function _overlap(a, b) {
  return a.col < b.col+b.w && a.col+a.w > b.col &&
         a.row < b.row+b.h && a.row+a.h > b.row;
}
// In _snapToGrid(): wenn blocked → _grid[id] = {...origGrid} (Revert)
```

**Scroll:** `_updateCanvasH()` setzt `#dash-canvas.style.minHeight` live im mousemove.

**Default-Layout:** Wenn kein gespeichertes Layout vorhanden, verteilt `initLayout()` alle Cards gleichmäßig auf die volle Breite und die verfügbare Viewport-Höhe.

---

## WIPAge Chart – Details

**Aktiv-Logik:** `In Progress_first` gefüllt **UND** `Resolved` leer.

**Status-Age Y-Achse:** `heute − row[Issue-Status-Wert]` (Eintrittsdatum des aktuellen Status aus der gleichnamigen Spalte).

**Rolling Pace:** Abgeschlossene Items (`Resolved` nicht leer, innerhalb letzter `rollingDays` Tage) → `leaving_[Status] − [Status]` pro Status → P50/P70/P85 als gestrichelte horizontale Linien.

**Dot-Farben:**
- Normal: `var(--blue)`
- Alert (≥ `statusAgeDays` Tage): `cfg.alertColor` (Default `var(--red)`, konfigurierbar via Color-Picker im ⚙-Panel)

**Jitter:** Dots pro Status-Spalte werden horizontal gestreut (`± colW * 0.35`, max ±18px) damit überlappende Punkte sichtbar bleiben.

**Config-Panel (⚙ Einstellungen):**

| Property | Typ | Default | Beschreibung |
|---|---|---|---|
| `rollingDays` | number | `90` | Zeitfenster Perzentil-Berechnung |
| `statusAgeDays` | number | `5` | Alert-Schwellwert in Tagen |
| `dotSize` | number | `4` | Basis-Radius (skaliert mit pW) |
| `showBands` | bool | `true` | P50/P70/P85-Linien ein/ausblenden |
| `excludeList` | string | `""` | Komma-getrennte Status ausblenden |
| `alertColor` | string | `var(--red)` | Farbe überfälliger Dots |

**Reihenfolge-Panel (↕):** Exaktes heatmap.js-Muster – `⠿` Drag-Handle + ▲/▼ Buttons. Gespeichert in `cfg.stateOrder`. Synchronisiert sich automatisch mit neuen/entfallenen Status beim nächsten Datenload.

**Dot-Radius-Formel:** `Math.max(3, Math.min(8, pW/100)) * (cfg.dotSize/4)` — konsistent mit scatter.js.

**Tooltip (§4.9-Pattern):**
```javascript
tooltip.style.pointerEvents = d.url ? 'all' : 'none';
// Hover-Delay 120ms: dot mouseout → _hideTt(), tooltip mouseenter → _showTt()
window.open(url, '_blank');  // kein host.launchUrl — standalone HTML
```

---

## CycleTime Scatterplot – Details

**CT-Formel:** `(endDate − startDate) / 86400000 + 1` (inklusiv, konsistent mit `core.dur()`)
Items mit `ct < 1` werden ausgeschlossen.

**SVG-Rendering:** `svgEl.innerHTML = parts.join('')` — erlaubt in Browser-Kontext (kein ESLint/pbiviz).

**Achsen:**
- X: Fertigstellungsdatum (`cfg.ctEnd`), Ticks nach Woche/Monat/Quartal
- Y: CT in Tagen, `_niceYTicks()` für schöne Rundwerte

**Dot-Rendering:**
- Radius: `Math.max(3.5, Math.min(6, pW/80))`
- Opacity: 0.95
- Stroke-Halo: `stroke="${C.dotStroke}" stroke-width="1.5"`

**Farb-Modi:** `single` → cfg.singleColor · `issueType` → cfg.typeColors[type] · `heatmap` → `core.lerp(ct/maxCT)`

**Tooltip (§4.9-Pattern):**
```javascript
dot.addEventListener('mouseleave', () => {
  _scHideTimer = setTimeout(() => tooltip.style.display = 'none', 130)
});
tooltip.addEventListener('mouseenter', () => clearTimeout(_scHideTimer));
tooltip.style.pointerEvents = item.url ? 'all' : 'none';
window.open(item.url, '_blank');  // kein host.launchUrl — standalone HTML
```

---

## Bekannte Bugs und Lösungen

**Bug 1: Scrollbalken fehlte nach Card-Drag**
- Symptom: Card über sichtbaren Bereich ziehen → kein Scrollbalken
- Ursache: Cards in `position:absolute` ohne berechnete Container-Höhe
- Fix: Innerer `#dash-canvas`; `_updateCanvasH()` setzt `minHeight` live im mousemove

**Bug 2: Cards überlappten sich (v1.1 → v1.2)**
- Symptom: Nach Drag/Resize konnte eine Card die andere überdecken
- Ursache: Kein Kollisionscheck
- Fix: `_overlap(a, b)` + `origGrid`-Revert in `_snapToGrid()`

**Bug 3: Issue-Type Legende fehlte im Scatterplot**
- Symptom: Farb-Modus „Typ" ohne Legende
- Fix: SVG-Legende oben rechts im Plotbereich

---

## Aktive Design-Standards

- [x] Tooltip: boundary-safe Positionierung mit clientX/Y + Overflow-Prüfung
- [x] Scatter-Tooltip + WIPAge-Tooltip: Hover-Delay (120–130ms) + `pointerEvents: all` wenn URL vorhanden
- [x] N-Anzeige: Heatmap in Diag-Bar; Scatter + WIPAge als SVG-Text unter X-Achsen-Beschriftung
- [x] Skalierung: Scatter/WIPAge SVG 100%/100%, Dot-Radius relativ zu pW
- [x] Diag-Bar: jede Card hat eigene Diagnose-Zeile (immer sichtbar)
- [x] Dark/Light Theme: CSS-Variablen + `core.scatterColors()` + `core.lerp()`
- [x] Überlappungsschutz: Cards können nicht aufeinander gezogen/resized werden
- [x] Squad-Filter global: wirkt auf alle Visuals via `core.on('filter', render)`
- [x] Reihenfolge-Panel: heatmap.js + wipage.js verwenden identisches ▲/▼ + Drag-Muster
- [–] pbiviz-Standards (§9.6 Icon, §9.7 launchUrl) nicht anwendbar — standalone HTML

---

## Aktives Zusammenarbeits-Protokoll (§0 aus pbiviz_entwickeln.md)

Das Protokoll aus `pbiviz_entwickeln.md §0` gilt auch für die Web App.

- **SDD-Interview (§0.0): vor jedem neuen Visual durchführen** – Blöcke A–G, SDD.md erstellen ✓
- Gate 1 (SDD-Bestätigung): vor jedem neuen Visual durchführen ✓
- Gate 2 (Pre-Delivery Review): vor jeder Datei-Übergabe durchführen
- M1 (eine Frage auf einmal): aktiv
- M3 (Begründung bei Design-Entscheidungen): aktiv
- M4 (Übergabe-Dokument ab Nachricht 15): aktiv
- **M5 (Bug-Doku nach Behebung): gilt auch für Web App** – Bugs in „Bekannte Bugs und Lösungen" oben dokumentieren; bei Spec-Lücken zuerst SDD updaten (§0.7)
- M6 (Prototyp vor Implementierung): für neue Visuals aktiv

**Übergabe-Regel (Web App):** Immer nur die geänderte(n) `.js`-Datei(en) übergeben. `core.js` und `index.html` nur wenn sie explizit geändert wurden. Bei Bundle-Bedarf: `build.py` ausführen → `FlowAnalytics.html` übergeben.

---

## Nächste mögliche Features (Backlog)

| Feature | Datei | Aufwand | Hinweis |
|---|---|---|---|
| **LeadTime BoxChart** | `boxchart.js` | mittel | Box-Whisker pro Gruppe; pbiviz-Version als Referenz |
| **CFD (Cumulative Flow)** | `cfd.js` | groß | Stapelflächen über Zeit |
| **Card-Titel editierbar** | index.html | klein | `contenteditable` auf `.card-title` |
| **Card minimieren** | core.js | klein | `.card-content` auf `height:0` klappen |

---

## Hinweise für neuen Chat-Start

**Dateien hochladen:**

| Vorhaben | Hochladen |
|---|---|
| Neues Visual schreiben | `pbiviz_entwickeln.md` + `FlowAnalytics_Dashboard_Uebergabe.md` + `core.js` |
| Bestehendes Visual ändern | `pbiviz_entwickeln.md` + `FlowAnalytics_Dashboard_Uebergabe.md` + `core.js` + betroffene `.js`-Datei |
| WIPAge ändern | `pbiviz_entwickeln.md` + `FlowAnalytics_Dashboard_Uebergabe.md` + `core.js` + `wipage.js` |
| index.html anpassen | `pbiviz_entwickeln.md` + `FlowAnalytics_Dashboard_Uebergabe.md` + `index.html` |

**Einstiegssatz:**
> „Wir entwickeln das Flow Analytics Dashboard weiter. Lies bitte die Übergabe-Datei und core.js. Ich möchte [Feature] ergänzen."

Für neue Visuals: Claude startet automatisch das SDD-Interview (§0.0 aus `pbiviz_entwickeln.md`) bevor Code geschrieben wird.

**Wichtig:**
- Neue Visuals immer in eigener `.js`-Datei — nie bestehende Dateien erweitern
- Config-State immer lokal im Visual halten — nie in `core.state` schreiben
- Theme-Farben immer über `core.scatterColors()` oder CSS-Variablen — nie hardcoden
- localStorage-Key nach Schema `fhwa_[visualId]` benennen

---

*Erstellt: 2026-05-30 · Aktualisiert: 2026-06-01 · Autor: Oliver Wolter*  
*v1.0–v1.2: Single-File HTML · v2.0: Migration auf ES-Module (4 Dateien), core.js API dokumentiert, Visual-Template ergänzt · v2.1: WIPAge Chart (`wipage.js`) als Visual 3 ergänzt · v2.2: SDD-Workflow (§0.0) ergänzt · v2.3: M5 Web App, SDD-Update-Regel, Übergabe-Regel*
