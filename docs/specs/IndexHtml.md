# index.html – Spezifikation

**Version:** 2.7  
**Datum:** 2026-06-20  
**Status:** Teilweise implementiert · Abschnitte §3 (Upload-Screen) und §4 (Datencheck-Page) ausstehend

---

## Zweck

`index.html` ist der einzige Einstiegspunkt der Web-App. Sie enthält:
- das gesamte CSS (Theme-System, Layout, Komponenten-Klassen)
- das HTML-Gerüst (Upload-Screen, App-Screen mit Sidebar + Main-Content)
- den ES-Module-Bootstrap (Imports + `init()`-Aufrufe aller Visuals)

Es gibt keinen Build-Schritt. Die Datei wird direkt im Browser geöffnet (SharePoint/HTTPS).

---

## HTML-Struktur

```
<body>
  #upload-screen            Drag&Drop + Datei-Picker + Hint-Box
  #app-screen
    #squad-dropdown         position:fixed – shared Squad-Dropdown (alle Pages)
    #issuetype-dropdown     position:fixed – shared Issue-Type-Dropdown (alle Pages außer Blocker)
    #daterange-dropdown     position:fixed – shared Zeitraum-Dropdown (alle Pages außer Blocker + Monte)
    .app-body               Sidebar + Main-Content (kein globaler Topbar)
      .sidebar              Persistente linke Navigation
        .sidebar-logo       FlowAnalytics
        .sidebar-filebadge  Dateiname · Sheet-Name (#file-badge)
        #sidebar-locked     Oranges Banner „Erst Daten bestätigen" (display:none → flex nach File-Load)
        .sidebar-nav
          .sidebar-section  „Überblick"
          .sidebar-link[data-page="lieferfahigkeit"]   Lieferfähigkeit (▤ + 6 Metriken)
          .sidebar-section  „Detailanalysen"
          .sidebar-link[data-page="wipage"]            Was liegt gerade rum? (⏳)
          .sidebar-link[data-page="scatter"]           Wie lange dauert ein Ticket? (⏰)
          .sidebar-link[data-page="heatmap"]           Wo verbringen Tickets ihre Zeit? (🔥)
          .sidebar-link[data-page="monte"]             Wann sind wir fertig? (🎲🎲)
        .sidebar-bottom     Utility-Buttons (Einstellungen · Theme · Datencheck · Neue Datei)
          #settings-wrap    Einstellungen-Button + settings-panel (position:fixed)
          #btn-theme        Theme-Toggle (☀ Light / 🌙 Dark)
          #btn-datencheck   Zurück zur Datencheck-Page
          #btn-reset        Neue Datei laden
      .main-content
        #page-datencheck    Daten-Bestätigung nach File-Load (dynamisch befüllt von core.js)
        #page-lieferfahigkeit  (.page-flex)
          .page-filterbar   Squad · Issue-Typ · Zeitraum · Filter zurücksetzen
            #squad-dd-wrap  Nur noch der Trigger-Button (#btn-squad .btn-squad-trigger)
          .page-scroll
            #tile-canvas-lieferfahigkeit  CSS-Grid (auto-fill var(--tile-w), zentriert, max. 3 Spalten) — Tiles via core.createTile()
        #page-wipage  (.page-flex)
          .page-filterbar   „Was liegt gerade rum?" · Squad · Issue-Typ · Zeitraum · Reset
          .page-detail-canvas  id="page-canvas-wipage" — Card füllt inset:0
        #page-scatter  (.page-flex)
          .page-filterbar   „Wie lange dauert ein Ticket?" · Squad · Issue-Typ · Zeitraum · Reset
          .page-detail-canvas  id="page-canvas-scatter" — Card füllt inset:0
        #page-heatmap  (.page-flex)
          .page-filterbar   „Wo verbringen Tickets ihre Zeit?" · Squad · Issue-Typ · Zeitraum · Reset
          .page-detail-canvas  id="page-canvas-heatmap" — Card füllt inset:0
        #page-monte  (.page-flex)
          .page-filterbar   „Wann sind wir fertig?" · Squad · Issue-Typ · Reset
          .page-detail-canvas  id="page-canvas-monte" — Card füllt inset:0
  <script type="module"> ES-Module-Bootstrap
```

---

## App-Flow (Zustandsmaschine)

```
Upload-Screen (sichtbar beim Start)
  │  User lädt Datei
  ▼
App-Screen sichtbar · #page-datencheck aktiv · Sidebar-Nav gesperrt (.nav-locked)
  │  User klickt „Weiter zu Lieferfähigkeit"
  ▼
Sidebar-Nav entsperrt · #page-lieferfahigkeit aktiv · normaler Dashboard-Betrieb
  │  User klickt „↩ Neue Datei" (Sidebar-Bottom)
  ▼
Upload-Screen (zurückgesetzt)
```

**Gesperrter Zustand** (nach File-Load, vor Bestätigung):
- `.sidebar-link` trägt Klasse `.nav-locked` → `opacity:0.3; pointer-events:none`
- `#sidebar-locked` wird als `display:flex` gezeigt (Orange-Banner)
- Nur `#btn-theme`, `#btn-settings` und `#btn-reset` in `.sidebar-bottom` sind aktiv

---

## Upload-Screen (`#upload-screen`)

Sichtbar beim Start, versteckt nach Datei-Laden.

| Element | ID / Klasse | Funktion |
|---|---|---|
| Drag&Drop-Zone | `#drop-zone` | `dragover`, `drop` → `_loadFile()` in core.js |
| Datei-Picker | `#file-input` | `type="file"`, `display:none` |
| Sheet-Navigator | `.sheet-nav` | **Neu (v2.5)** – ersetzt bisherige `.hint-box`. Tab-Leiste mit 5 Reitern für alle bekannten Worksheets. JiraStories ist Standard-Tab (aktiv beim Öffnen). |

> `#data-preview` existiert noch im DOM (Kompatibilitäts-Rest), wird aber nicht mehr aktiv genutzt. Die Daten-Preview findet jetzt auf `#page-datencheck` im App-Screen statt.
> `.hint-box`, `.hint-title`, `.hint-cols`, `.hint-col`, `.hc-req/.hc-opt/.hc-state`, `.hint-note` entfallen mit v2.5 – werden durch `.sheet-nav`-Klassen ersetzt.

### Sheet-Navigator (`.sheet-nav`) – Struktur

```
.sheet-nav                     max-width:440px, passend zur Drop-Zone
  .sheet-tabs                  Horizontale Tab-Leiste (5 Tabs, flex-wrap möglich)
    .sheet-tab[data-tab]       Tab-Button; .active → aktiver Tab (blau hervorgehoben)
      .tab-name                Sheet-Name (z.B. „JiraStories")
      .tab-badge.req           „Pflicht" (blau) – nur bei JiraStories
      .tab-badge.opt           „optional" (gedimmt) – alle anderen Sheets
  .sheet-tab-content[data-tab] Inhaltsbereich; nur der passende ist sichtbar (.active)
    .hint-cols                 Spalten-Chips (Klassen .hc-req / .hc-opt / .hc-state bleiben)
    .hint-note                 Hinweistext unten
```

**Tab-Switching:** `click` auf `.sheet-tab` → `.active` wechselt auf Klick; zugehöriger `.sheet-tab-content` wird eingeblendet. Kein Core-Event nötig – reine CSS-Klassen-Toggle-Logik im Bootstrap.

### Inhalte der einzelnen Tabs

| Tab | data-tab | Pflicht? | Spalten-Chips | Hinweistext |
|---|---|---|---|---|
| JiraStories | `jira-stories` | ✅ `.tab-badge.req` | `Jira-ID` (blau) · `Issue-Type` (grau) · `Squad` (grau) · `Zustand` (orange) · `leaving_Zustand` (orange) | Blau = Pflicht · Grau = optional · Orange = Zustandsspalten |
| JiraEpics | `jira-epics` | optional | `Stage` (grau) · `Squad` (grau) · `Resolved` (grau) · `Rejected` (grau) · `UNCALLED` (grau) | Genutzt von: SayDo Ratio Epics · Akzeptanzkriterien |
| BRP Etappen | `brp-etappen` | optional | `Etappe` (grau) · `Startdatum` (grau) · `Endedatum` (grau) | Verknüpft mit JiraEpics via `Stage = Etappe` |
| Blockermanagement | `blockermanagement` | optional | `issues.key` (grau) · `Squad` (grau) · `BlockiertWartendSeit` (grau) · `Blockiert/Wartend_Zustand` (grau) · `Blockiert/Wartend_Grund` (grau) · `BlockedStart` (grau) · `BlockedEnd` (grau) | Genutzt von: Flow Efficiency · Blockermanagement-Seite |
| Happiness Faktor | `happiness-faktor` | optional | `Squad` (grau) · `[Monat]` (grau) | Header in Zeile 3 · Genutzt von: Happiness Index |

---

## Datencheck-Page (`#page-datencheck`)

Wird nach File-Load von `_buildDatencheckPage()` in core.js dynamisch befüllt.

### Zentrierungs-Fix (v2.5)

`.dc-wrap` erhält `margin:0 auto` (ergänzt zu bestehendem `max-width:860px; padding:2rem 2.4rem`). Damit wird der Inhalt auf breiten Bildschirmen horizontal zentriert.

**Vollständige neue CSS-Regel:**
```css
.dc-wrap { padding:2rem 2.4rem; max-width:860px; margin:0 auto; }
```

### Gesamtstruktur (dynamisch erzeugt)

```
.dc-wrap                         max-width:860px; margin:0 auto  ← NEU
  .dc-badge          „✓ Datei erkannt" (grün)
  .dc-title          „Das haben wir in deinem Export gefunden"
  .dc-sub            Dateiname · Sheet · Ticket-Anzahl
  .dc-stats (4-spaltig)
    .dc-stat         Tickets gesamt (fertig · aktiv)
    .dc-stat         Zeitraum in Monaten (min–max Datum)
    .dc-stat.green   Durchsatz / 30 T.
    .dc-stat.orange  Auffällig alt (aktive > 90 T.)
  .dc-cards (2-spaltig)
    .dc-card         Workflow-Status erkannt (.dc-pills mit .dc-pill / .dc-pill.leaving)
    .dc-card         Squads & Typen (.dc-pills)
  .dc-extra-sheets (NEU – nur wenn mind. 1 optionales Sheet vorhanden)
    .dc-section-title  „Weitere Daten erkannt"
    .dc-sheets         Flex-Row der Sheet-Kacheln (flex-wrap:wrap, gap:.6rem)
      .dc-sheet-card   [ein Card pro gefundenem Sheet] (max. 3 sichtbar)
  .dc-cta
    .btn-cta         „Weiter zu Lieferfähigkeit →" → ruft _launchApp()
    .dc-cta-note     Hinweistext
```

### Berechnungen in `_buildDatencheckPage()` (core.js)

**Bestehende Berechnungen (unverändert):**

| Wert | Berechnung |
|---|---|
| `finished` | Zeilen mit `Resolved != null` ODER `Rejected != null` |
| `active` | `rows.length - finished` |
| Zeitraum | min/max über alle `s.dateCols` |
| `throughput` | `Math.round(finished / totalDays * 30)` |
| `oldCount` | aktive Tickets deren erster Zustands-Eintrag > 90 Tage zurückliegt |
| Leaving-States | `st.exitCol !== null` → `.dc-pill.leaving` (rot) |

**Neue Berechnungen (v2.5) – optional, nur wenn Sheet vorhanden:**

| Sheet | Felder | Berechnung |
|---|---|---|
| `JiraEpics` | `epicCount`, `epicResolved`, `epicRejected`, `epicUncalled`, `epicOpen` | Aus `core.state.sheets['JiraEpics'] ?? []`; Zeilen mit `Resolved`-Datum zählen = resolved; `Rejected`-Datum = rejected; `UNCALLED`-Datum = uncalled; Rest = open |
| `JiraBlockermanagement` | `blockerOpen`, `blockerTotal` | Aus `core.state.sheets['JiraBlockermanagement'] ?? []`; `BlockedEnd == null` → offen; gesamt = rows.length |
| `Happiness Faktor` | `happLast`, `happLastMonth`, `happAvg` | Aus `core.state.sheetsRaw['Happiness Faktor'] ?? []`; Header-Zeile via `findIndex` (`row.some(c => c === 'Squad')`); letzte Monatsspalte mit Daten = letzter Wert; Durchschnitt über alle Zellen |

### `.dc-sheet-card` – Inhalte pro Sheet

| Sheet | Titel | Metriken (`.dc-stat-val` + `.dc-stat-lbl`) |
|---|---|---|
| JiraEpics | „JiraEpics" | Zeile 1: `epicCount` → „Epics gesamt" · Zeile 2 (Chips): X Resolved (grün) · Y Rejected (orange) · Z UNCALLED (lila) · W Offen (gedimmt) |
| JiraBlockermanagement | „Blockermanagement" | `blockerOpen` → „Offene Episoden" (rot wenn > 0, gedimmt wenn 0) · `blockerTotal` → „Gesamt-Episoden" |
| Happiness Faktor | „Happiness Faktor" | `happLast` (1 Dezimalstelle) → „Letzter Wert · [Monat]" · `happAvg` (1 Dezimalstelle) → „Ø alle Monate" |

**Leerzustand:** Wenn kein optionales Sheet erkannt → `.dc-extra-sheets` entfällt komplett (kein leerer Abschnitt).

---

## Sidebar

### Sidebar-Top

| Element | ID / Klasse | Funktion |
|---|---|---|
| Logo | `.sidebar-logo` | Statischer Text Flow**Analytics** |
| File-Badge | `#file-badge` (`.sidebar-filebadge`) | Dateiname · Sheet-Name (gesetzt von `_processData()`) |
| Locked-Banner | `#sidebar-locked` | Orange · `display:none` → `display:flex` in `_lockNav()` |

### Sidebar-Nav

Alle `.sidebar-link`-Elemente tragen `data-page="[pageId]"`. Click-Handler in `_initSidebar()` prüft `.nav-locked` und ruft `core.showPage(pageId)` auf.

| Link | data-page | Glyph | Tech-Untertitel |
|---|---|---|---|
| Lieferfähigkeit | `lieferfahigkeit` | 📦 | 6 Metriken |
| Was liegt gerade rum? | `wipage` | ⏳ | WIP-Alter |
| Wie lange dauert ein Ticket? | `scatter` | ⏰ | Cycle Time |
| Wo verbringen Tickets ihre Zeit? | `heatmap` | 🔥 | Flow-Heatmap |

### Sidebar-Bottom (`.sidebar-bottom`)

Alle Buttons sind `.sidebar-bottom-btn`. Aktiver Zustand: `.sb-active`.

| Element | ID | Funktion |
|---|---|---|
| Einstellungen | `#btn-settings` | Öffnet `#settings-panel` als zentriertes Overlay (position:fixed, transform:translate(-50%,-50%)) |
| Jira-URL-Input | `#settings-url-input` | Setzt `core.state.urlTemplate`, emittiert `'settings'` |
| Kachelgröße-Slider | `#settings-tile-height` | Setzt `--tile-w` + `--tile-h` (16:10, 390–720 px); disabled bis Datei geladen |
| Theme-Toggle | `#btn-theme` | `core.toggleTheme()` · Text: `☀ Light` / `🌙 Dark` |
| Datencheck | `#btn-datencheck` | `core.showPage('datencheck')` |
| Neue Datei | `#btn-reset` | Zurück zum Upload-Screen |

**Settings-Panel-Positionierung:**  
`position:fixed; top:50%; left:50%; transform:translate(-50%,-50%); z-index:500`. Backdrop `#settings-backdrop` (`z-index:490`) schließt Panel bei Klick außerhalb. Open/Close-Logik im Bootstrap-Block von index.html — **nicht** in core.js.

---

## Lieferfähigkeit-Page (`#page-lieferfahigkeit`)

Hat Klasse `.page-flex` → `showPage()` setzt `display:flex` (statt `block`) damit Filter-Leiste oben fixiert bleibt und `.page-scroll` scrollt.

### Filter-Leiste (`.page-filterbar`)

```
pf-page-title  „Lieferfähigkeit"
pf-sep
#squad-dd-wrap
  #btn-squad (.btn-squad-trigger)       Squad-Filter-Button — öffnet shared #squad-dropdown
.btn-issuetype-trigger (.pf-filter-chip)  Issue-Type-Filter-Button — öffnet shared #issuetype-dropdown
.btn-daterange-trigger (.pf-filter-chip)  Zeitraum-Filter-Button — öffnet shared #daterange-dropdown
pf-spacer
#lf-filter-reset (.squad-filter-reset)   „↻ Filter zurücksetzen" — setzt Squad + Issue-Type zurück (core.js)
```

**Squad-Filter:** `#btn-squad` trägt Klasse `.pf-filter-chip`. Aktiv-Zustand: `.pf-active`. Text-Update durch `_updateSquadBtn()` in core.js:

| Zustand | Anzeige |
|---|---|
| Alle ausgewählt / keine Restriction | `SQUADS Alle ▽` (kein `pf-active`) |
| 1 Squad ausgewählt | `SQUADS {name} ▽` + `pf-active` |
| 2 Squads ausgewählt | `SQUADS {name1}, {name2} ▽` + `pf-active` |
| ≥3 Squads (nicht alle) | `SQUADS N/M ▽` + `pf-active` |

**Issue-Type-Filter:** `.btn-issuetype-trigger` trägt Klasse `.pf-filter-chip`. Aktiv-Zustand: `.pf-active`. Text-Update durch `_updateIssueTypeBtn()` in core.js (Logik siehe § Issue-Type-Filter).

**Zeitraum-Filter:** `.btn-daterange-trigger` trägt Klasse `.pf-filter-chip`. Aktiv-Zustand: `.pf-active`. Text-Update durch `_updateDateRangeBtn()` in core.js (Logik siehe § Zeitraum-Filter). Nicht auf Monte-Page vorhanden.

**Filter-Reset** (`#lf-filter-reset`): setzt Squad-Checkboxen **und** Issue-Type-Checkboxen auf `checked=true` **und** Zeitraum auf `mode = 'all'`.

### Scrollbarer Inhalt (`.page-scroll`)

```
#tile-canvas-lieferfahigkeit   Flexbox (flex-wrap:wrap, justify-content:center) — auto 3→2→1 Spalten
```

---

## Kachel-Reihenfolge (Lieferfähigkeit-Page)

### Default-Reihenfolge

| Position | Visual-ID | Tile-Titel |
|---|---|---|
| 1 | `boxchart` | Lead**Time** |
| 2 | `saydoratioepics` | Say**Do** Ratio |
| 3 | `happinessfaktor` | Happiness **Faktor** |
| 4 | `flowefficiency` | Flow **Efficiency** |
| 5 | `wip` | **WIP** pro Person |
| 6 | `akzeptanz` | **Akzeptanz**kriterien |

### Persistenz

localStorage-Key: **`fhwa_tile_order`** — `string[]` mit Visual-IDs in aktueller Reihenfolge.

Default (wenn nicht gesetzt oder unvollständig):
```js
['boxchart', 'saydoratioepics', 'happinessfaktor', 'flowefficiency', 'wip', 'akzeptanz']
```

Beim Initialisieren des Tile-Canvas: gespeicherte Reihenfolge laden → fehlende IDs ans Ende anhängen (Robustheit bei zukünftig neuen Visuals).

### Drag-and-Drop-Mechanik

**Trigger:** Drag startet im gesamten `.tile-header`-Bereich. `draggable="true"` sitzt auf dem `.tile`-Element; ein `mousedown`-Listener merkt ob der Klick im Header war — nur dann wird der Drag zugelassen (zuverlässiger als `getBoundingClientRect()`-Check in `dragstart`).

**HTML5 Drag API:**

| Event | Ziel | Aktion |
|---|---|---|
| `dragstart` | `.tile` | Speichert Visual-ID in `draggedId`; setzt Klasse `.tile-dragging` |
| `dragover` | `.tile` | `preventDefault()` (Drop erlauben); setzt Klasse `.tile-drag-over` auf Zielkachel |
| `dragleave` | `.tile` | Entfernt `.tile-drag-over` |
| `drop` | `.tile` | Tauscht Positionen via `insertBefore`/`appendChild` im DOM; speichert neue Reihenfolge in `fhwa_tile_order` |
| `dragend` | `.tile` | Räumt alle Drag-Klassen auf |

**Visuelles Feedback:**
- Gezogene Kachel: `.tile-dragging` → `opacity:.35; box-shadow:0 12px 36px rgba(0,0,0,.6)`
- Zielkachel: `.tile-drag-over` → `border-color:var(--yellow)!important; background:rgba(251,191,36,.06)`
- Kachel-Header: `cursor:grab` im Ruhezustand; `cursor:grabbing` während Drag (`:active`)

**Neuanordnung:** DOM-Reihenfolge der `.tile`-Elemente in `#tile-canvas-lieferfahigkeit` wird beim Drop aktualisiert. `fhwa_tile_order` wird sofort gespeichert.

### Reset im Settings-Panel (Abschnitt „Lieferfähigkeit")

| Button | ID | Aktion |
|---|---|---|
| ↩ Kachel-Reihenfolge zurücksetzen | `#settings-tile-order-reset` | Setzt `fhwa_tile_order` auf Default-Reihenfolge; rendert Tile-Canvas neu |
| ⚠ Alle Einstellungen zurücksetzen | `#settings-factory-reset` | `window.confirm('Alle Einstellungen zurücksetzen?')` → löscht alle `fhwa_*`-Keys aus `localStorage` → `location.reload()` |

### CSS-Klassen (neu)

| Klasse | Beschreibung |
|---|---|
| `.tile-header` | Erhält `cursor:grab; user-select:none; cursor:grabbing` (`:active`) |
| `.tile.tile-dragging` | Auf der gezogenen Kachel während des Drags |
| `.tile.tile-drag-over` | Auf der Zielkachel: gelber Rahmen, leichte Gelbfärbung |

```css
/* Tile-Drag (Kachel-Reihenfolge) */
.tile-title          { cursor:grab; user-select:none }
.tile.tile-dragging  { opacity:.35; box-shadow:0 12px 36px rgba(0,0,0,.6) }
.tile.tile-drag-over { border-color:var(--yellow)!important; background:rgba(251,191,36,.06) }
```

### Akzeptanzkriterien

1. Beim ersten Öffnen / nach Reset erscheinen Kacheln in Default-Reihenfolge: Lead Time → Say Do → Happiness → Flow Efficiency → WIP → Akzeptanzkriterien
2. Kachel lässt sich am Titel anfassen und an eine andere Position ziehen (Cursor ändert sich auf `grab`)
3. Während des Drags: gezogene Kachel transparent; Zielkachel mit gelbem Rahmen hervorgehoben
4. Nach Drop: neue Reihenfolge sofort sichtbar und überlebt Browser-Reload (`fhwa_tile_order`)
5. „↩ Kachel-Reihenfolge zurücksetzen" stellt Default-Reihenfolge wieder her; alle anderen Einstellungen unverändert
6. „⚠ Alle Einstellungen zurücksetzen" öffnet `window.confirm()`; nach Bestätigung: alle `fhwa_*`-Keys gelöscht, Seite neu geladen
7. Kein JS-Fehler wenn `fhwa_tile_order` fehlt oder nur teilweise gefüllt ist (fehlende IDs werden ans Ende angehängt)

---

## Issue-Type-Filter

Globaler Filter für die `Issue-Type`-Spalte des JiraStories-Sheets. Wirkt auf alle Visuals die `core.filteredRows()` verwenden. Nicht betroffen: Happiness, Akzeptanzkriterien, SayDoRatioEpics, Blockermanagement (andere Datenquellen).

### State (core.js)

| Feld | Typ | Default | Persistenz |
|---|---|---|---|
| `core.state.allIssueTypes` | `string[]` | `[]` | – (aus Daten befüllt) |
| `core.state.issueTypeFilter` | `string[]` | `[]` (= alle) | `fhwa_global` |

`fhwa_global` enthält: `{ squadFilter, issueTypeFilter, urlTemplate }`.

### Dropdown (`#issuetype-dropdown`)

`position:fixed` auf `#app-screen`-Ebene, geteilt über alle Pages. CSS-Klassen identisch mit Squad-Dropdown (`.squad-dropdown`, `.squad-dd-header`, `.sdd-btn`, `.squad-opt`).

| Element | ID | Funktion |
|---|---|---|
| Container | `#issuetype-dropdown` | `position:fixed`, `display:none` → `.open` |
| Header | `.squad-dd-header` | Flex-Zeile mit Alle/Keine |
| Alle-Button | `#sdd-type-all` | setzt alle Checkboxen auf `checked=true` |
| Keine-Button | `#sdd-type-none` | setzt alle Checkboxen auf `checked=false` |
| Options-Container | `#issuetype-opts` | dynamisch von `_buildIssueTypeDD()` befüllt |
| Trigger-Klasse | `.btn-issuetype-trigger` | auf allen Pages außer Blocker |

**Gegenseitiges Schließen:** Öffnen des Issue-Type-Dropdowns schließt `#squad-dropdown` und umgekehrt.

### Button-Text-Logik

| Zustand | Anzeige |
|---|---|
| Alle ausgewählt / keine Restriction | `ISSUE-TYP Alle ▽` (kein `pf-active`) |
| 1 Typ ausgewählt | `ISSUE-TYP {name} ▽` + `pf-active` |
| 2 Typen ausgewählt | `ISSUE-TYP {name1}, {name2} ▽` + `pf-active` |
| ≥3 Typen (nicht alle) | `ISSUE-TYP N/M ▽` + `pf-active` |

### filteredRows() (core.js)

```js
filteredRows() {
  let rows = core.state.rows;
  if (core.state.squadFilter.length)
    rows = rows.filter(r => core.state.squadFilter.indexOf(String(r['Squad'] || '')) >= 0);
  if (core.state.issueTypeFilter.length)
    rows = rows.filter(r => core.state.issueTypeFilter.indexOf(String(r['Issue-Type'] || '')) >= 0);
  if (core.state.dateRangeMode !== 'all') {
    const from = core.state.dateRangeFrom;
    const to   = core.state.dateRangeTo;
    rows = rows.filter(r => {
      const resolved = core.toDate(r['Resolved']);
      const rejected = core.toDate(r['Rejected']);
      const doneDate = resolved ?? rejected;     // Abschlussdatum
      if (!doneDate) return true;                // aktives Ticket: immer anzeigen
      return doneDate >= from && doneDate <= to; // Abgeschlossen: Datum muss im Zeitraum liegen
    });
  }
  return rows;
}
```

### Akzeptanzkriterien

1. Filter zeigt alle Werte aus `Issue-Type`-Spalte des JiraStories-Sheets (alphabetisch)
2. Default: alle ausgewählt, Button zeigt „ISSUE-TYP Alle ▽"
3. „Alle"/„Keine"-Buttons funktionieren
4. Button-Text: 1 Name / 2 Namen / N/M (mind. 2 Namen vor Umschaltung auf N/M)
5. Seitenwechsel erhält Auswahl; alle Trigger-Buttons aktualisiert
6. Browser-Reload stellt Auswahl wieder her (`fhwa_global`)
7. „Filter zurücksetzen" setzt Squad UND Issue-Type auf Alle
8. Fehlende `Issue-Type`-Spalte: Dropdown leer, Button zeigt „Alle" – kein Fehler
9. Alle JiraStories-basierten Visuals rendern neu (via `'filter'`-Event)

---

## Zeitraum-Filter

Globaler Filter für den angezeigten Zeitraum. Wirkt auf alle Visuals **außer MonteCarlo**. Emittiert bei Änderung `'filter'`-Event — alle bestehenden Visuals rendern automatisch neu.

### State (core.js)

| Feld | Typ | Default | Persistenz |
|---|---|---|---|
| `core.state.dateRangeMode` | `string` | `'all'` | `fhwa_global` |
| `core.state.dateRangeCustomFrom` | `string` (ISO, z.B. `'2026-01-01'`) | `''` | `fhwa_global` |
| `core.state.dateRangeCustomTo` | `string` (ISO) | `''` | `fhwa_global` |
| `core.state.dateRangeFrom` | `Date \| null` | `null` | – (berechnet, nicht persistiert) |
| `core.state.dateRangeTo` | `Date \| null` | `null` | – (berechnet, nicht persistiert) |

`fhwa_global` enthält: `{ squadFilter, issueTypeFilter, urlTemplate, dateRange: { mode, customFrom, customTo } }`.

`dateRangeFrom`/`dateRangeTo` werden bei jedem Laden und bei jeder Modus-Änderung aus `mode` + `customFrom/customTo` berechnet (Ende des Tages = 23:59:59 für `dateRangeTo`).

### Berechnete Datumsgrenzen pro Modus

| Mode | `dateRangeFrom` | `dateRangeTo` |
|---|---|---|
| `'all'` | `null` | `null` |
| `'last30'` | heute − 30 Tage (00:00) | heute (23:59) |
| `'last90'` | heute − 90 Tage (00:00) | heute (23:59) |
| `'last180'` | heute − 180 Tage (00:00) | heute (23:59) |
| `'q0'` | 1. Tag des aktuellen Quartals (00:00) | letzter Tag des aktuellen Quartals (23:59) |
| `'q1'` | 1. Tag von Q-1 (00:00) | letzter Tag von Q-1 (23:59) |
| `'q2'` | 1. Tag von Q-2 (00:00) | letzter Tag von Q-2 (23:59) |
| `'q3'` | 1. Tag von Q-3 (00:00) | letzter Tag von Q-3 (23:59) |
| `'custom'` | `new Date(customFrom + 'T00:00:00')` | `new Date(customTo + 'T23:59:59')` |

Quartals-Berechnung: Q0 = aktuelles Quartal des heutigen Datums. Q1–Q3 = jeweils 1–3 Quartale davor. Quartal beginnt am 1. Januar / 1. April / 1. Juli / 1. Oktober.

### Dropdown (`#daterange-dropdown`)

`position:fixed` auf `#app-screen`-Ebene, shared. CSS-Rahmen wie `#squad-dropdown` (Klasse `.squad-dropdown`).

```
#daterange-dropdown (.squad-dropdown)
  .dr-mode-list
    .dr-opt[data-mode="all"].active     „Alles anzeigen"
    .dr-opt[data-mode="last30"]         „Letzte 30 Tage"
    .dr-opt[data-mode="last90"]         „Letzte 90 Tage"
    .dr-opt[data-mode="last180"]        „Letzte 180 Tage"
  .dr-divider                           „Quartale"
  .dr-mode-list
    .dr-opt[data-mode="q0"]             z.B. „Q2/2026 (aktuell)"
    .dr-opt[data-mode="q1"]             z.B. „Q1/2026"
    .dr-opt[data-mode="q2"]             z.B. „Q4/2025"
    .dr-opt[data-mode="q3"]             z.B. „Q3/2025"
  .dr-divider                           „Zeitraum festlegen"
  .dr-custom
    .dr-custom-row
      <label>Von</label>  <input type="date" id="dr-from">
    .dr-custom-row
      <label>Bis</label>  <input type="date" id="dr-to">
    <button id="dr-apply" class="btn-icon">Übernehmen</button>
```

**Quartals-Labels:** Dynamisch beim Öffnen des Dropdowns aus `new Date()` berechnet. Label = `Q{n}/{Jahr}`, z.B. „Q2/2026 (aktuell)".

**Gegenseitiges Schließen:** Öffnen des Zeitraum-Dropdowns schließt `#squad-dropdown` und `#issuetype-dropdown` (und umgekehrt).

**Positionierung:** Unterhalb des auslösenden `.btn-daterange-trigger`-Buttons, analog zu `#squad-dropdown`.

### Button-Text-Logik (`_updateDateRangeBtn()` in core.js)

| Mode | Anzeige |
|---|---|
| `'all'` | `ZEITRAUM Alle ▽` (kein `pf-active`) |
| `'last30'` | `ZEITRAUM Letzte 30T ▽` + `pf-active` |
| `'last90'` | `ZEITRAUM Letzte 90T ▽` + `pf-active` |
| `'last180'` | `ZEITRAUM Letzte 180T ▽` + `pf-active` |
| `'q0'`–`'q3'` | `ZEITRAUM Q2/2026 ▽` (dynamisches Quartals-Label) + `pf-active` |
| `'custom'` | `ZEITRAUM 01.04.–30.06. ▽` (dd.mm.–dd.mm., ohne Jahr) + `pf-active` |

`_updateDateRangeBtn()` setzt Text und `.pf-active` auf **allen** `.btn-daterange-trigger`-Buttons (alle Pages synchron).

### Filterlogik pro Datenquelle

#### JiraStories — über `core.filteredRows()` (siehe § filteredRows())

- Aktives Ticket (weder `Resolved` noch `Rejected` gefüllt): **immer anzeigen**
- Abgeschlossenes Ticket (`Resolved` oder `Rejected` gefüllt): Abschlussdatum (`Resolved ?? Rejected`) muss in `[dateRangeFrom, dateRangeTo]` liegen

#### JiraEpics — von Visuals selbst angewendet

SayDoRatioEpics und Akzeptanzkriterien lesen `core.state.dateRangeFrom/To` im `render()`-Handler:
- Epic ohne Resolved-/Rejected-Datum (offen): immer anzeigen
- Epic abgeschlossen: `Resolved ?? Rejected` muss im Zeitraum liegen

#### Happiness Faktor — von `happiness.js` selbst angewendet

Monats-Granularität: Monat wird angezeigt wenn der Monat den Zeitraum überlappt:
```js
const monStart = new Date(year, monthIdx, 1);
const monEnd   = new Date(year, monthIdx + 1, 0, 23, 59, 59);
return monStart <= core.state.dateRangeTo && monEnd >= core.state.dateRangeFrom;
```
Wenn `mode === 'all'`: alle Monate anzeigen (keine Filterung).

### Events

Zeitraum-Änderung emittiert `'filter'`-Event. Alle Visuals die `core.on('filter', render)` abonniert haben rendern automatisch neu.  
JiraEpics- und Happiness-Visuals lesen im `render()`-Handler `core.state.dateRangeMode/From/To`.

### CSS-Klassen (neu)

| Klasse | Beschreibung |
|---|---|
| `.btn-daterange-trigger` | Zeitraum-Filter-Button auf jeder Page (außer Blocker + Monte) — öffnet `#daterange-dropdown` |
| `.dr-mode-list` | Container für Modus-Buttons |
| `.dr-opt` | Modus-Button (ganze Breite, cursor:pointer); `.active` = aktuell gewählter Modus (blau hervorgehoben) |
| `.dr-divider` | Abschnitts-Trenner im Dropdown mit Label-Text (uppercase, gedimmt, kleiner Border oben) |
| `.dr-custom` | Container für Von/Bis-Inputs + Übernehmen-Button |
| `.dr-custom-row` | Flex-Zeile (label + date-input, gap zwischen Label und Input) |

### Akzeptanzkriterien

1. Default (mode `'all'`): keine Datumsfilterung; alle Tickets angezeigt; Chip: „ZEITRAUM Alle ▽" ohne `pf-active`
2. „Letzte 30 Tage": erledigte Tickets mit Resolved/Rejected in letzten 30 Tagen + alle aktiven sichtbar; Chip: „ZEITRAUM Letzte 30T ▽" mit `pf-active`
3. „Letzte 90/180 Tage": analog zu Letzte 30 Tage
4. Quartals-Schnellauswahl: genau 4 Optionen (aktuelles Q + Q-1 + Q-2 + Q-3), dynamisch aus aktuellem Datum berechnet
5. Quartals-Labels: korrekte Bezeichnung (z.B. „Q2/2026 (aktuell)", „Q1/2026") beim Öffnen des Dropdowns
6. „Zeitraum festlegen": Von/Bis per `<input type="date">`; erst nach „Übernehmen" wird mode auf `'custom'` gesetzt
7. Custom-Modus: Chip zeigt „ZEITRAUM TT.MM.–TT.MM. ▽" (dd.mm.–dd.mm., ohne Jahr)
8. Happiness Index: Monate die den Zeitraum überlappen werden angezeigt, außerhalb liegende ausgeblendet
9. JiraEpics: offene Epics immer sichtbar; abgeschlossene nur wenn Abschlussdatum im Zeitraum
10. Browser-Reload stellt Modus wieder her (`fhwa_global`)
11. „Filter zurücksetzen" setzt Squad + Issue-Type + Zeitraum (→ `'all'`) zurück
12. Monte-Page: kein Zeitraum-Chip in der Filterleiste
13. Alle `.btn-daterange-trigger`-Buttons synchron aktualisiert nach Auswahl

---

## Zwei Rendering-Modelle

**Tile-Canvas** (Lieferfähigkeit-Page):
```css
.tile-container { display:flex; flex-wrap:wrap; justify-content:center; align-content:start; gap:.75rem; padding:.75rem; max-width:calc(3 * var(--tile-w) + 3rem); margin:0 auto; }
.tile { width:var(--tile-w,550px); height:var(--tile-h,344px); flex-shrink:0; }  /* 16:10 · 390–720 px via Slider */
```
Tiles werden über `core.createTile()` erzeugt und hängen sich selbst ein. Kein Drag, kein Resize.

**Page-Canvas** (Deep-Dive-Pages wipage / scatter / heatmap):
```css
.page-canvas { position:relative; min-height:100%; }
```
Cards werden über `core.createCard()` erzeugt und per `position:absolute` positioniert.

---

## `showPage(pageId)` – Verhalten

```javascript
// Aus core.js:
page.style.display = page.classList.contains('page-flex') ? 'flex' : 'block';
```

Pages mit `.page-flex` (aktuell: `#page-lieferfahigkeit`) werden als `flex` angezeigt, alle anderen als `block`. `#btn-datencheck` in `.sidebar-bottom` erhält `.sb-active` wenn `pageId === 'datencheck'`.

---

## CSS-System

### Theme-Variablen (`:root` / `[data-theme="light"]`)

`data-theme` sitzt auf `<html>`. Wird von `core.toggleTheme()` gesetzt.

| Variable | Dark | Light | Verwendung |
|---|---|---|---|
| `--bg` | `#0f1c30` | `#f1f5f9` | Body-Hintergrund |
| `--bg2` | `#162035` | `#ffffff` | Cards, Sidebar, Panels |
| `--bg3` | `#1e2e47` | `#f8fafc` | Inputs, sekundäre Flächen |
| `--bg4` | `#273552` | `#e2e8f0` | Hover-Flächen |
| `--border` | `#2a3d5c` | `#cbd5e1` | Alle Rahmen |
| `--text` | `#e8f0fe` | `#0f172a` | Primärtext |
| `--dim` | `#8ba8c8` | `#475569` | Sekundärtext |
| `--dimmer` | `#4d6a88` | `#94a3b8` | Tertiärtext, Icons |
| `--blue` | `#38bdf8` | `#0284c7` | Akzentfarbe, Links |
| `--red` | `#f87171` | `#dc2626` | Alert, Fehler |
| `--green` | `#4ade80` | `#16a34a` | Positiv |
| `--yellow` | `#fbbf24` | `#b45309` | Warn, Drag-Highlight |
| `--purple` | `#c084fc` | `#7c3aed` | Select-Focus |
| `--orange` | `#fb923c` | `#c2410c` | Locked-Banner, Zustandsspalten-Hint |
| `--tile-w` | `550px` | `550px` | Kachelbreite Lieferfähigkeit-Page (390–720 px) |
| `--tile-h` | `344px` | `344px` | Kachelhöhe = `--tile-w * 10/16` (abgeleitet, nicht direkt gesetzt) |

### Komponenten-Klassen (vollständige Liste)

#### Sidebar

| Klasse | Beschreibung |
|---|---|
| `.sidebar` | 196px breit, `display:flex; flex-direction:column` |
| `.sidebar-logo` | Logo-Zeile oben, `.hl` für blauen „Analytics"-Teil |
| `.sidebar-filebadge` | Mono, klein, gedimmt — Dateiname + Sheet |
| `.sidebar-locked` | Orange Banner; `display:none` → `display:flex` via `_lockNav()` |
| `.sidebar-nav` | `flex:1`, scrollbar |
| `.sidebar-section` | Section-Label (uppercase, gedimmt) |
| `.sidebar-link` | Nav-Eintrag; `border-left:2px solid transparent` |
| `.sidebar-link.active` | Blauer Akzent, `border-left-color:var(--blue)` |
| `.sidebar-link.nav-locked` | `opacity:0.3; pointer-events:none` — gesperrt vor Bestätigung |
| `.sidebar-glyph` | Glyph-Icon pro Link (▤ ◔ ◑ ◕) |
| `.sidebar-txt` | Wrapper für Name + Tech-Untertitel |
| `.sidebar-name` | Haupttext des Links |
| `.sidebar-tech` | Technischer Untertitel (Mono, kleiner) |
| `.sidebar-bottom` | `flex-shrink:0; border-top:1px solid var(--border)` |
| `.sidebar-bottom-btn` | Utility-Button in Sidebar-Bottom; `width:100%` |
| `.sidebar-bottom-btn.sb-active` | Blau-aktiver Zustand (Einstellungen offen, Datencheck aktiv) |

#### Page Filter Bar

| Klasse | Beschreibung |
|---|---|
| `.page-filterbar` | Flex-Leiste oben auf Pages; `flex-shrink:0; z-index:10` |
| `.pf-page-title` | Seitenname links in der Filterleiste |
| `.pf-sep` | Vertikaler Trenner (1px) |
| `.pf-spacer` | `flex:1` — schiebt Reset-Button an den rechten Rand |
| `.pf-filter-chip` | Filter-Button-Stil (Hintergrund, Border, klein) |
| `.pf-filter-chip.pf-active` | Aktiver Filter (blau) |
| `.pf-filter-chip.pf-disabled` | `opacity:0.5; cursor:not-allowed` — nicht implementiert |
| `.pf-reset` | Reset-Chip (transparent, kein Rand) |
| `.page-scroll` | `flex:1; overflow:auto` — scrollbarer Inhalt unter Filterleiste |
| `.page-flex` | Klasse auf Pages die `display:flex` benötigen (lieferfahigkeit, wipage, scatter, heatmap) |

#### Datencheck-Page

| Klasse | Beschreibung |
|---|---|
| `.dc-wrap` | Content-Wrapper mit `max-width:860px` |
| `.dc-badge` | Grünes „✓ Datei erkannt" Badge |
| `.dc-title` | H2-artiger Titel |
| `.dc-sub` | Dateiinfo (Mono) |
| `.dc-stats` | 4-spaltiges Grid für Kennzahlen |
| `.dc-stat` | Einzelne Kennzahl-Kachel |
| `.dc-stat-val` | Großer Zahlenwert; `.green` / `.orange` für Farben |
| `.dc-stat-lbl` | Label (uppercase, klein) |
| `.dc-stat-sub` | Unterzeile (Mono, gedimmt) |
| `.dc-cards` | 2-spaltiges Grid für Info-Karten |
| `.dc-card` | Info-Karte (Workflow-Status / Squads & Typen) |
| `.dc-card-title` | Karten-Überschrift (uppercase, sehr klein) |
| `.dc-pills` | Flex-Wrap für Pill-Elemente |
| `.dc-pill` | Status- oder Squad-Pill |
| `.dc-pill.leaving` | Roter Leaving-State |
| `.dc-pill.type` | Issue-Typ Pill (gedimmt) |
| `.dc-note` | Hinweistext (Mono, sehr klein) |
| `.dc-cta` | Flex-Row für CTA-Button + Hinweistext |

#### Tiles (Lieferfähigkeit)

| Klasse | Beschreibung |
|---|---|
| `.tile-container` | Flexbox (`flex-wrap:wrap; justify-content:center`) — max. 3 Spalten (`max-width:calc(3 * var(--tile-w) + 3rem)`), `margin:0 auto` zentriert |
| `.tile` | Kompakte Kachel; feste Breite `var(--tile-w, 550px)` und Höhe `var(--tile-h, 344px)` (16:10); `flex-shrink:0`; kein Drag/Resize |
| `.tile-header` | Titel-Zeile (`min-height:32px`) |
| `.tile-title` | Kachel-Titel, `.hl` für blaue Hervorhebung |
| `.tile-spacer` | `flex:1` — schiebt `headerExtraEl` an den rechten Rand |
| `.tile-content` | `flex:1; overflow:hidden` — Render-Bereich |
| `.tile-content svg` | `display:block; width:100%; height:100%` — SVG füllt Tile-Content vollständig aus |

#### Cards (Deep-Dive-Pages)

| Klasse | Beschreibung |
|---|---|
| `.card` | Card-Element; auf Detail-Pages via CSS `inset:0 !important` auf volle Canvas-Größe gezwungen |
| `.card-header` | Drag-Handle (ausgeblendet auf Detail-Pages) · Titel · Controls |
| `.card-drag-handle` | `⠿`-Icon — `display:none !important` auf `.page-detail-canvas .card` |
| `.card-title` | Fett, `.hl` für blaue Hervorhebung |
| `.card-content` | `flex:1; overflow:auto` — hier rendert das Visual |
| `.card-resize-handle` | Ecke rechts unten — `display:none !important` auf `.page-detail-canvas .card` |

#### Detail-Page-Canvas

| Klasse | Beschreibung |
|---|---|
| `.page-detail-canvas` | `flex:1; position:relative; overflow:hidden` — Canvas für wipage/scatter/heatmap |
| `.btn-squad-trigger` | Squad-Filter-Button auf jeder Page — öffnet shared `#squad-dropdown` |
| `.btn-issuetype-trigger` | Issue-Type-Filter-Button auf jeder Page (außer Blocker) — öffnet shared `#issuetype-dropdown` |
| `.btn-daterange-trigger` | Zeitraum-Filter-Button auf jeder Page (außer Blocker + Monte) — öffnet shared `#daterange-dropdown` |
| `.squad-filter-reset` | Filter-zurücksetzen-Button auf jeder Page — setzt Squad + Issue-Type + Zeitraum zurück (core.js) |

#### Sonstige

| Klasse | Beschreibung |
|---|---|
| `.btn-cta` | Blauer CTA-Button (Datencheck-Page) |
| `.btn-icon` | Standard-Button (für Visuals in Card/Tile-Headern) |
| `.btn-icon.p-blue/yellow/…` | Aktiver Zustand (farbig) |
| `.diag-bar` | Fixe Zeile unten in jeder Card/Tile |
| `.sub-panel` | Aufklappbares Panel innerhalb Card/Tile |
| `.settings-backdrop` | `position:fixed; inset:0` — Overlay-Hintergrund; `z-index:490`; Klick schließt Settings-Panel |
| `.settings-close-btn` | ×-Button in der Panel-Kopfzeile |
| `.settings-panel-header` | Flex-Zeile mit Titel + Close-Button |
| `.settings-divider` | `<hr>` Trennlinie zwischen Panel-Abschnitten |
| `.settings-section-label` | Abschnitts-Überschrift im Settings-Panel (uppercase, klein) |
| `.settings-order-list` | Flex-Wrap-Container für Status-Reihenfolge-Items (benutzt `.order-item`) |
| `.settings-order-reset` | „↩ Standard"-Button im Status-Reihenfolge-Abschnitt |
| `.settings-range` | Range-Input mit `accent-color:var(--blue)` |
| `.settings-row--disabled` | `opacity:0.4; pointer-events:none` |
| `.order-item` | Drag-fähiges Element im Reihenfolge-Panel |
| `.o-extra` | **Extra-Status** (nicht in DEFAULT_STATUS_ORDER) — orangefarbener Rahmen + Name in `var(--orange)`; gilt für `.order-item` in allen Order-Panels |
| `.th-extra` | Extra-Status Tabellen-Header in der Heatmap — Spaltenname in `var(--orange)` |
| `.tt-*` | Tooltip-Stile (`tt-title`, `tt-row`, `tt-lbl`, `tt-val`, `tt-link`) |

---

## Settings-Panel

**Position:** `position:fixed; top:50%; left:50%; transform:translate(-50%,-50%)` — zentriertes Overlay.  
Breite: `min(540px, 92vw)` · max-height: `82vh` (scrollbar) · `z-index:500`.  
Backdrop: `#settings-backdrop` (`position:fixed; inset:0; background:rgba(0,0,0,.42); z-index:490`).

Öffnen/Schließen: Button `#btn-settings` → `openSettings()` · Backdrop-Klick → `closeSettings()` · Close-Button `#settings-close-btn` → `closeSettings()`.  
**Hinweis:** Open/Close-Logik liegt komplett im `<script type="module">`-Bootstrap von index.html. core.js hat keinen Settings-Button-Handler mehr.

### Abschnitte im Panel

| Abschnitt | Element-IDs | Inhalt |
|---|---|---|
| **Jira** | `#settings-url-input` | URL-Template; **Default: `https://jira.axa.com/jira/browse/{issueKey}`** (wird vorgebefüllt wenn `fhwa_global.urlTemplate` leer oder nicht gesetzt ist); setzt `core.state.urlTemplate`, emittiert `'settings'` |
| **Darstellung** | `#settings-tile-height`, `#tile-h-display`, `#settings-tile-row` | Kachelgröße-Slider (390–720 px, 16:10); `fhwa_tileHeight`; disabled bis Datei geladen |
| **Lieferfähigkeit** | `#settings-tile-order-reset`, `#settings-factory-reset` | Zwei Buttons: „↩ Kachel-Reihenfolge zurücksetzen" (`#settings-tile-order-reset`) → setzt `fhwa_tile_order` auf Default-Reihenfolge und rendert Tile-Canvas neu. „⚠ Alle Einstellungen zurücksetzen" (`#settings-factory-reset`) → `window.confirm()` → löscht alle `fhwa_*`-Keys aus localStorage → `location.reload()`. |
| **Status-Reihenfolge** | `#settings-order-list`, `#settings-order-reset` | Drag&Drop-Liste + ▲▼ + „↩ Standard"-Button; liest/schreibt `core.loadGlobalStatusOrder()` / `core.saveGlobalStatusOrder()`; Extra-Status mit `.o-extra` markiert; aktualisiert sich bei `statusOrder`-Event |

---

## ES-Module-Bootstrap

```html
<script type="module">
  import { core, DEFAULT_STATUS_ORDER }  from './core.js';
  import { init as initHeatmap }         from './heatmap.js';
  import { init as initScatter }         from './scatter.js';
  import { init as initWipage }          from './wipage.js';
  import { init as initBoxChart }        from './boxchart.js';
  import { init as initHappiness }       from './happiness.js';
  import { init as initWip }             from './wip.js';
  import { init as initFlowEfficiency }  from './flowefficiency.js';
  import { init as initMonteCarlo }      from './montecarlo.js';

  initHeatmap(); initScatter(); initWipage(); initBoxChart();
  initHappiness(); initWip(); initFlowEfficiency(); initMonteCarlo();
  core.initApp();

  // Settings-Panel: Overlay-Logik (open/close, Backdrop, Status-Reihenfolge-Liste)
  // → openSettings(), closeSettings(), _rebuildOrderList(), _moveOrderItem()
  // → core.on('statusOrder', _rebuildOrderList) für bidirektionalen Sync

  // Kachelgröße: laden, anwenden, Slider verdrahten
  // (localStorage-Key: fhwa_tileHeight, Default 550px Breite, Ratio 10:16, Clamp 390–720)
</script>
```

**Reihenfolge:** Alle `init()`-Aufrufe vor `core.initApp()`. Die `init()`-Funktionen registrieren Cards/Tiles; `initApp()` startet Theme, State und File-Upload-Handler.

**Neues Visual hinzufügen:** Zwei Zeilen ergänzen (import + init-Aufruf). `build.py` an 5 Stellen aktualisieren (siehe WebAppEntwickeln.md).

---

## Geplante Features (Backlog)

| Feature | Aufwand | Beschreibung |
|---|---|---|
| **Card-Titel editierbar** | klein | `contenteditable` auf `.card-title`; Änderung in `fhwa_layout2` persistieren |
| **Card minimieren** | klein | `.card-content` auf `height:0` klappen; Button im Card-Header |
| **Lieferfähigkeit Page-Header** | mittel | ÜBERSICHT-Label, Titel, Zeitraum-Anzeige, Aufmerksamkeits-Box — eigenes `lieferfahigkeit.js`-Modul |

## Bekannte Bugs (separater Fix, nicht in Spec)

| Bug | Symptom | Ursache (Vermutung) | Betroffene Datei |
|---|---|---|---|
| **Browser-Back-Button** | Nach Browser-Zurück (vom App-Screen zum Upload-Screen) und erneutem Datei-Auswählen löst der File-Input kein `change`-Event aus → App bleibt leer | Browser cached den File-Input-Wert; `input.value = ''` in `_resetToUpload()` reicht nicht, wenn der Nutzer denselben Dateinamen erneut wählt. Ursache: `_resetToUpload()` setzt `input.value = ''` nur synchron, der Event-Listener für `change` ist aber noch aktiv. | `core.js` → `_resetToUpload()` + File-Input-Handler |

---

## Exaktes CSS – vollständige Klassen-Referenz

*Beim Neubau: Diese Regeln exakt übernehmen — nicht interpretieren, nicht kürzen.  
Design-Tokens (CSS-Variablen) stammen aus [`docs/design/design-tokens.css`](../design/design-tokens.css).*

### Reset & Body

```css
*,*::before,*::after { box-sizing:border-box; margin:0; padding:0 }
body { background:var(--bg); color:var(--text); font-family:var(--sans); height:100vh; overflow:hidden }
```

### Upload-Screen

```css
#upload-screen { display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:100vh; padding:2rem; gap:1.8rem }
.logo { font-size:2.2rem; font-weight:700; letter-spacing:-.04em }
.logo-flow { color:var(--text) }
.logo-heat { color:var(--blue) }
.logo-map  { color:var(--dim); font-weight:400 }
.logo-sub  { font-size:.75rem; color:var(--dimmer); font-family:var(--mono); letter-spacing:.08em; text-transform:uppercase; text-align:center; margin-top:.25rem }
.drop-zone { width:100%; max-width:440px; border:1.5px dashed var(--border); border-radius:14px; padding:2.5rem 2rem; text-align:center; cursor:pointer; transition:border-color .2s,background .2s }
.drop-zone:hover,
.drop-zone.drag-over { border-color:var(--blue); background:rgba(56,189,248,.04) }
.dz-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:4px; width:48px; margin:0 auto 1.2rem; opacity:.35 }
.dz-cell { height:14px; border-radius:2px }
.c1 { background:var(--bg4) }  .c2 { background:var(--orange) }
.c3 { background:var(--red) }  .c4 { background:var(--blue) }
.drop-zone p     { color:var(--dim); font-size:.9rem; margin-bottom:.3rem }
.drop-zone small { color:var(--dimmer); font-family:var(--mono); font-size:.68rem }
.btn-pick { display:inline-block; margin-top:1.2rem; padding:.5rem 1.3rem; background:var(--bg3); border:1px solid var(--border); border-radius:7px; color:var(--text); font-family:var(--sans); font-size:.85rem; font-weight:500; cursor:pointer; transition:background .15s }
.btn-pick:hover { background:var(--bg4); border-color:var(--dim) }
#file-input { display:none }

/* Sheet-Navigator (v2.5 – ersetzt .hint-box) */
.sheet-nav   { width:100%; max-width:440px; background:var(--bg2); border:1px solid var(--border); border-radius:10px; overflow:hidden }
.sheet-tabs  { display:flex; flex-wrap:wrap; border-bottom:1px solid var(--border); background:var(--bg3) }
.sheet-tab   { display:flex; align-items:center; gap:.3rem; padding:.32rem .6rem; font-size:.65rem; font-weight:500; color:var(--dim); background:transparent; border:none; cursor:pointer; border-bottom:2px solid transparent; transition:color .12s,border-color .12s; font-family:var(--sans); flex-shrink:0 }
.sheet-tab:hover { color:var(--text) }
.sheet-tab.active { color:var(--blue); border-bottom-color:var(--blue); background:var(--bg2) }
.tab-badge   { font-size:.55rem; font-family:var(--mono); padding:.1rem .28rem; border-radius:3px; font-weight:600; flex-shrink:0 }
.tab-badge.req { background:rgba(56,189,248,.12); color:var(--blue) }
.tab-badge.opt { background:rgba(255,255,255,.05); color:var(--dimmer) }
.sheet-tab-content        { display:none; padding:.75rem 1rem }
.sheet-tab-content.active { display:block }
.hint-cols  { display:flex; flex-wrap:wrap; gap:.3rem }
.hint-col   { font-family:var(--mono); font-size:.67rem; padding:.18rem .45rem; border-radius:4px; white-space:nowrap }
.hc-req   { background:rgba(56,189,248,.12); color:var(--blue) }
.hc-opt   { background:rgba(255,255,255,.05); color:var(--dim) }
.hc-state { background:rgba(251,146,60,.12); color:var(--orange) }
.hint-note { font-size:.67rem; color:var(--dimmer); margin-top:.55rem; font-family:var(--mono); line-height:1.55 }
```

### App-Layout

```css
#app-screen { display:none; height:100vh; overflow:hidden }
.app-body   { display:flex; height:100%; width:100%; overflow:hidden }
```

### Sidebar

```css
.sidebar        { width:196px; flex-shrink:0; background:var(--bg2); border-right:1px solid var(--border); display:flex; flex-direction:column; overflow-y:auto; overflow-x:hidden }
.sidebar-logo   { font-size:.8rem; font-weight:700; letter-spacing:-.02em; padding:.65rem .8rem; border-bottom:1px solid var(--border); color:var(--text); flex-shrink:0; white-space:nowrap }
.sidebar-logo .hl { color:var(--blue) }
.sidebar-filebadge { font-family:var(--mono); font-size:.59rem; color:var(--dimmer); padding:.18rem .82rem .3rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis }
.sidebar-locked { display:none; margin:.35rem .55rem; padding:.28rem .55rem; background:rgba(251,146,60,.1); border:1px solid rgba(251,146,60,.25); border-radius:6px; color:var(--orange); font-size:.64rem; font-weight:600; align-items:center; gap:.3rem; cursor:default }
/* → display:flex setzen wenn Nav gesperrt (nach File-Load vor Bestätigung) */
.sidebar-nav    { display:flex; flex-direction:column; padding:.25rem 0; flex:1 }
.sidebar-section { font-size:.56rem; font-weight:600; text-transform:uppercase; letter-spacing:.09em; color:var(--dimmer); padding:.65rem .8rem .18rem; opacity:.65; flex-shrink:0 }
.sidebar-link   { display:flex; align-items:center; gap:.55rem; padding:.38rem .8rem; color:var(--dim); cursor:pointer; border-left:2px solid transparent; transition:color .12s,background .12s,border-color .12s; user-select:none }
.sidebar-link:hover { color:var(--text); background:var(--bg3) }
.sidebar-link:hover .sidebar-glyph { color:var(--dim) }
.sidebar-link:hover .sidebar-tech  { color:var(--dim) }
.sidebar-link.active { color:var(--blue); border-left-color:var(--blue); background:rgba(56,189,248,.07); font-weight:600 }
.sidebar-link.active .sidebar-glyph { color:var(--blue) }
.sidebar-link.active .sidebar-tech  { color:rgba(56,189,248,.7) }
.sidebar-link.nav-locked { opacity:.3; pointer-events:none; cursor:default }
.sidebar-glyph  { font-size:.95rem; line-height:1; flex-shrink:0; width:1.1rem; text-align:center; color:var(--dimmer); transition:color .12s }
.sidebar-txt    { display:flex; flex-direction:column; gap:.06rem; min-width:0 }
.sidebar-name   { font-size:.72rem; font-weight:500; line-height:1.2; white-space:nowrap; overflow:hidden; text-overflow:ellipsis }
.sidebar-tech   { font-size:.59rem; color:var(--dimmer); font-family:var(--mono); line-height:1.2; transition:color .12s }
.sidebar-bottom { flex-shrink:0; border-top:1px solid var(--border); padding:.3rem 0 }
.sidebar-bottom-btn { display:flex; align-items:center; gap:.5rem; padding:.34rem .8rem; color:var(--dim); cursor:pointer; font-size:.72rem; font-weight:500; background:transparent; border:none; width:100%; text-align:left; font-family:var(--sans); transition:color .12s,background .12s; white-space:nowrap }
.sidebar-bottom-btn:hover { color:var(--text); background:var(--bg3) }
.sidebar-bottom-btn.sb-active { color:var(--blue); background:rgba(56,189,248,.07) }
```

### Main Content & Pages

```css
.main-content { flex:1; overflow:hidden; min-width:0; display:flex; flex-direction:column }
.page         { display:none; height:100%; overflow:auto; background:var(--bg); flex-direction:column }
.page.page-flex { display:none; flex-direction:column; overflow:hidden }
/* showPage() setzt: display:flex für .page-flex, display:block sonst */
.page-canvas  { position:relative; min-height:100% }
```

### Page Filter Bar

```css
.page-filterbar  { display:flex; align-items:center; gap:.35rem; padding:.28rem .7rem; background:var(--bg2); border-bottom:1px solid var(--border); flex-shrink:0; flex-wrap:wrap; min-height:38px; z-index:10 }
.pf-page-title   { font-size:.78rem; font-weight:700; color:var(--text); flex-shrink:0; letter-spacing:-.015em }
.pf-sep          { width:1px; height:16px; background:var(--border); margin:0 .1rem; flex-shrink:0 }
.pf-spacer       { flex:1 }
.pf-filter-chip  { padding:.2rem .52rem; font-size:.65rem; font-weight:600; background:var(--bg3); border:1px solid var(--border); border-radius:5px; color:var(--dim); cursor:pointer; font-family:var(--sans); transition:color .12s,border-color .12s }
.pf-filter-chip:hover { color:var(--text); border-color:var(--dim) }
.pf-filter-chip.pf-active   { color:var(--blue); border-color:rgba(56,189,248,.4); background:rgba(56,189,248,.07) }
.pf-filter-chip.pf-disabled { opacity:.5; cursor:not-allowed }
.pf-reset        { background:transparent; border-color:transparent; color:var(--dimmer) }
.pf-reset:hover  { color:var(--text); background:transparent; border-color:transparent }
.page-scroll     { flex:1; overflow:auto; min-height:0 }
.page-detail-canvas { flex:1; position:relative; min-height:0; overflow:hidden }
/* Card auf Detail-Pages: inset:0, kein Drag-Grid */
.page-detail-canvas .card { position:absolute!important; left:0!important; top:0!important; right:0!important; bottom:0!important; width:auto!important; height:auto!important; border-radius:0!important; border-left:none!important; border-right:none!important; border-bottom:none!important }
.page-detail-canvas .card-drag-handle,
.page-detail-canvas .card-resize-handle { display:none!important }
```

### Datencheck-Page

```css
#page-datencheck { background:var(--bg) }
.dc-wrap         { padding:2rem 2.4rem; max-width:860px; margin:0 auto }  /* ← margin:0 auto neu (v2.5) */
.dc-badge        { display:inline-flex; align-items:center; gap:.35rem; font-size:.67rem; font-weight:600; color:var(--green); background:rgba(74,222,128,.1); border:1px solid rgba(74,222,128,.3); border-radius:5px; padding:.2rem .55rem; margin-bottom:1rem }
.dc-title        { font-size:1.55rem; font-weight:700; letter-spacing:-.03em; margin-bottom:.28rem; color:var(--text) }
.dc-sub          { font-size:.7rem; color:var(--dim); font-family:var(--mono); margin-bottom:1.35rem }
.dc-stats        { display:grid; grid-template-columns:repeat(4,1fr); gap:.6rem; margin-bottom:1.25rem }
.dc-stat         { background:var(--bg2); border:1px solid var(--border); border-radius:8px; padding:.72rem .88rem }
.dc-stat-val     { font-size:1.5rem; font-weight:700; line-height:1; margin-bottom:.18rem; color:var(--text) }
.dc-stat-val.green  { color:var(--green) }
.dc-stat-val.orange { color:var(--orange) }
.dc-stat-lbl     { font-size:.6rem; font-weight:600; text-transform:uppercase; letter-spacing:.07em; color:var(--dim); margin-bottom:.14rem }
.dc-stat-sub     { font-size:.6rem; color:var(--dimmer); font-family:var(--mono) }
.dc-cards        { display:grid; grid-template-columns:1fr 1fr; gap:.6rem; margin-bottom:1.25rem }  /* margin-bottom reduziert (v2.5) */
.dc-card         { background:var(--bg2); border:1px solid var(--border); border-radius:8px; padding:.72rem .88rem }
.dc-card-title   { font-size:.57rem; font-weight:600; text-transform:uppercase; letter-spacing:.09em; color:var(--dimmer); margin-bottom:.55rem }
.dc-pills        { display:flex; flex-wrap:wrap; gap:.28rem; margin-bottom:.42rem }
.dc-pill         { font-size:.67rem; padding:.2rem .5rem; border-radius:5px; background:var(--bg3); border:1px solid var(--border); color:var(--text) }
.dc-pill.leaving { background:rgba(248,113,113,.08); border-color:rgba(248,113,113,.3); color:var(--red) }
.dc-pill.type    { border-color:var(--border); color:var(--dim) }
.dc-note         { font-size:.59rem; color:var(--dimmer); font-family:var(--mono); line-height:1.5 }
.dc-cta          { display:flex; align-items:center; gap:1.1rem; flex-wrap:wrap }
.dc-cta-note     { font-size:.7rem; color:var(--dim) }
.btn-cta         { padding:.52rem 1.4rem; background:var(--blue); border:none; border-radius:7px; color:#fff; font-family:var(--sans); font-size:.82rem; font-weight:600; cursor:pointer; transition:opacity .15s; letter-spacing:.01em }
.btn-cta:hover   { opacity:.85 }

/* Optionale Sheets-Sektion (v2.5) */
.dc-extra-sheets    { margin-bottom:1.6rem }
.dc-section-title   { font-size:.57rem; font-weight:600; text-transform:uppercase; letter-spacing:.09em; color:var(--dimmer); margin-bottom:.6rem }
.dc-sheets          { display:flex; flex-wrap:wrap; gap:.6rem }
.dc-sheet-card      { background:var(--bg2); border:1px solid var(--border); border-radius:8px; padding:.72rem .88rem; min-width:200px; flex:1 }
.dc-sheet-card-title { font-size:.57rem; font-weight:600; text-transform:uppercase; letter-spacing:.09em; color:var(--blue); margin-bottom:.5rem }
.dc-sheet-pills     { display:flex; flex-wrap:wrap; gap:.25rem; margin-top:.35rem }
.dc-pill.resolved   { background:rgba(74,222,128,.08); border-color:rgba(74,222,128,.3); color:var(--green) }
.dc-pill.rejected   { background:rgba(251,146,60,.08); border-color:rgba(251,146,60,.3); color:var(--orange) }
.dc-pill.uncalled   { background:rgba(192,132,252,.08); border-color:rgba(192,132,252,.3); color:var(--purple) }
.dc-pill.alert      { background:rgba(248,113,113,.08); border-color:rgba(248,113,113,.3); color:var(--red) }
```

### Tiles (Lieferfähigkeit-Page)

```css
.tile-container { display:flex; flex-wrap:wrap; justify-content:center; align-content:start; gap:.75rem; padding:.75rem; max-width:calc(3 * var(--tile-w) + 3rem); margin:0 auto }
.tile           { width:var(--tile-w,550px); height:var(--tile-h,344px); flex-shrink:0; background:var(--bg2); border:1px solid var(--border); border-radius:8px; display:flex; flex-direction:column; overflow:hidden }
.tile-header    { display:flex; align-items:center; gap:.3rem; padding:.28rem .5rem; background:var(--bg2); border-bottom:1px solid var(--border); flex-shrink:0; min-height:32px }
.tile-title     { font-size:.72rem; font-weight:700; letter-spacing:-.02em; flex-shrink:0; white-space:nowrap }
.tile-title .hl { color:var(--blue) }
.tile-spacer    { flex:1 }
.tile-content   { flex:1; overflow:hidden; position:relative; min-height:0 }
.tile-content svg { display:block; width:100%; height:100% }
```

### Cards (Deep-Dive-Pages)

```css
.card            { position:absolute; background:var(--bg2); border:1px solid var(--border); border-radius:8px; display:flex; flex-direction:column; overflow:hidden; min-width:220px; min-height:180px }
.card.card-dragging { box-shadow:0 20px 56px rgba(0,0,0,.7); opacity:.92; z-index:100 }
.card.card-resizing { z-index:100 }
.card-header     { display:flex; align-items:center; gap:.3rem; padding:.3rem .5rem; background:var(--bg2); border-bottom:1px solid var(--border); flex-shrink:0; flex-wrap:wrap; min-height:36px }
.card-drag-handle { color:var(--dimmer); font-size:.88rem; cursor:grab; flex-shrink:0; padding:.1rem .2rem; border-radius:3px; line-height:1; transition:color .12s }
.card-drag-handle:hover  { color:var(--dim); background:var(--bg3) }
.card-drag-handle:active { cursor:grabbing }
.card-title      { font-size:.76rem; font-weight:700; letter-spacing:-.02em; flex-shrink:0; white-space:nowrap }
.card-title .hl  { color:var(--blue) }
.card-content    { flex:1; overflow:auto; position:relative; min-height:0 }
.card-resize-handle { position:absolute; bottom:0; right:0; width:18px; height:18px; cursor:nwse-resize; z-index:10 }
.card-resize-handle::after { content:''; position:absolute; bottom:4px; right:4px; width:7px; height:7px; border-right:2px solid var(--dimmer); border-bottom:2px solid var(--dimmer); border-radius:1px; transition:border-color .12s }
.card-resize-handle:hover::after,
.card.card-resizing .card-resize-handle::after { border-color:var(--blue) }
```

### Buttons & Icons

```css
.btn-icon { padding:.25rem .58rem; font-size:.68rem; font-weight:600; background:var(--bg3); border:1px solid var(--border); border-radius:6px; color:var(--dimmer); cursor:pointer; flex-shrink:0; transition:color .12s,border-color .12s,background .12s; white-space:nowrap }
.btn-icon:not([class*="p-"]):hover { color:var(--text) }
.btn-icon.p-blue   { color:var(--blue);   border-color:rgba(56,189,248,.4);  background:rgba(56,189,248,.07) }
.btn-icon.p-yellow { color:var(--yellow); border-color:rgba(251,191,36,.4);  background:rgba(251,191,36,.07) }
.btn-icon.p-purple { color:var(--purple); border-color:rgba(192,132,252,.4); background:rgba(192,132,252,.07) }
.btn-icon.p-orange { color:var(--orange); border-color:rgba(251,146,60,.4);  background:rgba(251,146,60,.07) }
```

### Diag-Bar & Legend

```css
.diag-bar   { padding:.22rem .6rem; background:var(--bg); border-top:1px solid var(--border); font-family:var(--mono); font-size:.56rem; color:var(--dimmer); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; flex-shrink:0 }
.legend-bar { display:flex; align-items:center; gap:.4rem; padding:.28rem .6rem; border-top:1px solid var(--border); font-size:.58rem; color:var(--dimmer); font-family:var(--mono); flex-shrink:0; background:var(--bg2) }
```

### Tooltips

```css
.tt-title { font-family:var(--sans); font-weight:600; font-size:.7rem; color:var(--blue); margin-bottom:.36rem; padding-bottom:.28rem; border-bottom:1px solid var(--border) }
.tt-row   { display:flex; justify-content:space-between; gap:1rem; padding:.07rem 0 }
.tt-lbl   { color:var(--dim) }
.tt-val   { color:var(--text) }
.tt-link  { display:block; color:var(--blue); font-size:.65rem; margin-top:.3rem; padding-top:.3rem; border-top:1px solid var(--border); cursor:pointer; text-decoration:none }
.tt-link:hover { color:var(--text) }
```

### Settings-Panel

```css
.settings-backdrop     { position:fixed; inset:0; background:rgba(0,0,0,.42); z-index:490; display:none }
.settings-backdrop.open { display:block }
.settings-panel        { position:fixed; top:50%; left:50%; transform:translate(-50%,-50%); width:min(540px,92vw); max-height:82vh; overflow-y:auto; background:var(--bg2); border:1px solid var(--border); border-radius:12px; box-shadow:0 20px 56px rgba(0,0,0,.6); z-index:500; padding:.75rem .9rem; display:none; scrollbar-width:thin }
.settings-panel.open   { display:block }
.settings-panel-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:.6rem }
.settings-panel-title  { font-size:.65rem; font-family:var(--mono); color:var(--dimmer); text-transform:uppercase; letter-spacing:.05em }
.settings-close-btn    { background:none; border:none; color:var(--dimmer); cursor:pointer; font-size:.9rem; padding:.1rem .3rem; border-radius:4px; line-height:1; transition:color .12s }
.settings-close-btn:hover { color:var(--text); background:var(--bg3) }
.settings-divider      { border:none; border-top:1px solid var(--border); margin:.5rem 0 }
.settings-section-label { font-size:.58rem; font-weight:600; text-transform:uppercase; letter-spacing:.1em; color:var(--dimmer); margin-bottom:.35rem }
.settings-row          { display:flex; flex-direction:column; gap:.25rem; margin-bottom:.5rem }
.settings-label        { font-size:.7rem; color:var(--dim) }
.settings-input        { width:100%; background:var(--bg3); border:1px solid var(--border); border-radius:5px; color:var(--text); font-family:var(--mono); font-size:.7rem; padding:.3rem .45rem; outline:none }
.settings-input:focus  { border-color:var(--blue) }
.settings-hint         { font-size:.62rem; color:var(--dimmer) }
.settings-range        { width:100%; cursor:pointer; accent-color:var(--blue); margin:.15rem 0 }
.settings-row--disabled { opacity:.4; pointer-events:none }
.settings-order-list   { display:flex; flex-wrap:wrap; gap:.25rem; align-items:flex-start; margin-top:.25rem }
.settings-order-reset  { font-size:.6rem; padding:.12rem .38rem; background:rgba(56,189,248,.08); border:1px solid rgba(56,189,248,.25); border-radius:4px; color:var(--blue); cursor:pointer; font-family:var(--mono); transition:background .12s }
.settings-order-reset:hover { background:rgba(56,189,248,.18) }
```

### Squad-Dropdown

```css
.squad-dropdown  { position:fixed; top:0; left:0; min-width:200px; max-width:280px; background:var(--bg2); border:1px solid var(--border); border-radius:9px; box-shadow:0 12px 32px rgba(0,0,0,.5); z-index:200; padding:.4rem 0; display:none }
.squad-dropdown.open { display:block }
.squad-dd-header { display:flex; gap:.3rem; padding:.3rem .55rem .4rem; border-bottom:1px solid var(--border); margin-bottom:.25rem }
.sdd-btn         { font-size:.63rem; font-family:var(--mono); padding:.15rem .4rem; background:var(--bg3); border:1px solid var(--border); border-radius:4px; color:var(--dim); cursor:pointer }
.sdd-btn:hover   { color:var(--text) }
.squad-opt       { display:flex; align-items:center; gap:.45rem; padding:.22rem .55rem; cursor:pointer; transition:background .1s }
.squad-opt:hover { background:var(--bg3) }
.squad-opt input[type=checkbox] { accent-color:var(--blue); width:12px; height:12px; cursor:pointer; flex-shrink:0 }
.squad-opt label { font-size:.72rem; cursor:pointer; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:200px }
```

### Zeitraum-Dropdown

```css
/* #daterange-dropdown erbt .squad-dropdown (position:fixed, min-width:200px, etc.) */
.dr-mode-list  { display:flex; flex-direction:column; padding:.2rem 0 }
.dr-opt        { display:block; width:100%; padding:.22rem .55rem; font-size:.72rem; color:var(--dim); background:transparent; border:none; text-align:left; cursor:pointer; font-family:var(--sans); transition:background .1s,color .1s }
.dr-opt:hover  { background:var(--bg3); color:var(--text) }
.dr-opt.active { color:var(--blue); font-weight:600 }
.dr-divider    { font-size:.56rem; font-weight:600; text-transform:uppercase; letter-spacing:.09em; color:var(--dimmer); padding:.45rem .55rem .15rem; border-top:1px solid var(--border); margin-top:.2rem; opacity:.65 }
.dr-custom     { padding:.4rem .55rem .5rem; border-top:1px solid var(--border); margin-top:.2rem; display:flex; flex-direction:column; gap:.3rem }
.dr-custom-row { display:flex; align-items:center; gap:.4rem }
.dr-custom-row label { font-size:.65rem; color:var(--dim); min-width:22px }
.dr-custom-row input[type=date] { flex:1; background:var(--bg3); border:1px solid var(--border); border-radius:4px; color:var(--text); font-family:var(--mono); font-size:.68rem; padding:.18rem .35rem; outline:none }
.dr-custom-row input[type=date]:focus { border-color:var(--blue) }
#dr-apply      { align-self:flex-end; padding:.22rem .65rem; font-size:.67rem; font-weight:600; background:var(--blue); border:none; border-radius:5px; color:#fff; cursor:pointer; font-family:var(--sans); transition:opacity .15s }
#dr-apply:hover { opacity:.85 }
```

### Order-Items (Reihenfolge-Panel)

```css
.order-item      { display:flex; align-items:center; gap:.25rem; background:var(--bg3); border:1px solid var(--border); border-radius:5px; padding:.18rem .35rem; cursor:grab; user-select:none; transition:border-color .15s,opacity .15s }
.order-item:active { cursor:grabbing }
.order-item.drag-over-item { border-color:var(--yellow); background:rgba(251,191,36,.08) }
.order-item.dragging { opacity:.4 }
.o-extra { background:rgba(251,146,60,.1); border-color:rgba(251,146,60,.3) }
.o-extra .o-name { color:var(--orange) }
.o-handle { color:var(--dimmer); font-size:.58rem; cursor:grab }
.o-num    { font-family:var(--mono); font-size:.56rem; color:var(--dimmer); min-width:12px }
.o-name   { font-size:.68rem; color:var(--text) }
.obtn     { width:16px; height:16px; background:var(--bg); border:1px solid var(--border); border-radius:3px; color:var(--dimmer); cursor:pointer; font-size:.56rem; display:flex; align-items:center; justify-content:center; padding:0; line-height:1 }
.obtn:hover:not(:disabled) { color:var(--yellow); border-color:rgba(251,191,36,.5) }
.obtn:disabled { opacity:.15; cursor:default }
th.th-extra { color:var(--orange); opacity:.9 }
```

### Light-Theme-Überschreibungen

```css
[data-theme="light"] body { background:var(--bg) }
[data-theme="light"] .card { box-shadow:0 1px 8px rgba(0,0,0,.09) }
[data-theme="light"] .c-bar   { background:rgba(0,0,0,.2) }
[data-theme="light"] .c-bar-w { background:rgba(0,0,0,.07) }
[data-theme="light"] .drop-zone:hover,
[data-theme="light"] .drop-zone.drag-over { background:rgba(2,132,199,.05) }
[data-theme="light"] .dz-cell.c1 { background:var(--bg4) }
[data-theme="light"] .btn-theme-tgl { color:var(--yellow)!important; border-color:rgba(180,83,9,.35)!important; background:rgba(180,83,9,.08)!important }
```

---

## Änderungshistorie

| Datum | Version | Änderung |
|---|---|---|
| 2026-06-03 | 1.0 | Initiales Dokument |
| 2026-06-07 | 1.1 | Phase 1b: Sidebar Glyph/Tech/Section, Tile-Container + Tile-CSS, Settings-Slider `--tile-h`, HTML-Struktur aktualisiert |
| 2026-06-07 | 1.2 | Phase 1c: Globaler Topbar entfernt → Sidebar-Bottom (Einstellungen, Theme, Datencheck, Neue Datei). Neuer App-Flow: File-Load → `#page-datencheck` (Nav gesperrt) → Bestätigung → Dashboard. `#page-lieferfahigkeit` mit `.page-filterbar` + `.page-scroll` + `.page-flex`. Squad-Filter in Filterleiste. `settings-panel` auf `position:fixed`. Neue CSS-Klassen: `.sidebar-filebadge`, `.sidebar-locked`, `.sidebar-bottom`, `.sidebar-bottom-btn`, `.page-filterbar`, `.pf-*`, `.page-scroll`, `.page-flex`, `.dc-*`. |
| 2026-06-08 | 1.3 | Detail-Pages Neustrukturierung: `#page-wipage/scatter/heatmap` erhalten `.page-flex` + `.page-filterbar` (Squad/Issue-Typ/Zeitraum/Reset) + `.page-detail-canvas`. `#squad-dropdown` auf `position:fixed` auf `#app-screen`-Ebene verschoben (shared). Squad-Button auf allen Pages via `.btn-squad-trigger`. Filter-Reset via `.squad-filter-reset` (handled by core.js). Drag-Handle/Resize-Handle auf Detail-Pages via CSS ausgeblendet. Neue Klassen: `.page-detail-canvas`, `.btn-squad-trigger`, `.squad-filter-reset`. |
| 2026-06-08 | 1.4 | Tile-Layout überarbeitet: `--tile-w` (400 px) + `--tile-h` (250 px, 16:10 abgeleitet) als CSS-Variablen. `.tile-container` auf `repeat(auto-fill, var(--tile-w))` + `justify-content:center` + `max-width` (max. 3 Spalten). `.tile` bekommt explizite Breite. `.tile-content svg` füllt Tile vollständig. Kachelgröße-Slider (280–600 px) steuert Breite + Höhe gemeinsam, emittiert `resize`. |
| 2026-06-08 | 1.5 | Bugfix Layout-Vollbreite: `.app-body` bekommt `width:100%`. `core.js` öffnete `#app-screen` mit `display:flex` statt `display:block` → `.app-body` schrumpfte als Flex-Item auf Inhaltsbreite. Tile-Container auf Flexbox (`flex-wrap:wrap`) umgestellt — entfernt `max-width`-Constraint der Filterleiste einschränkte. |
| 2026-06-09 | 1.7 | `wip.js` (WIP pro Person) ergänzt: `import { init as initWip }` + `initWip()` im Bootstrap-Block. |
| 2026-06-08 | 1.6 | Default-Kachelgröße auf 550 × 344 px angehoben. Slider-Range auf ±30 % (390–720 px, step 10). Alle veralteten CSS-Grid- und 220/400-px-Referenzen in der Spec bereinigt. |
| 2026-06-09 | 1.8 | Settings-Panel zu zentriertem Overlay umgebaut (`position:fixed; transform:translate(-50%,-50%)`, Breite 540px, max-height 82vh). Neuer Abschnitt „Status-Reihenfolge" mit `#settings-order-list` (Drag&Drop + ▲▼), `#settings-order-reset` und `#settings-backdrop`. Open/Close-Logik aus core.js in Bootstrap-Block verschoben. `DEFAULT_STATUS_ORDER` im Import ergänzt. Neue CSS-Klassen: `.settings-backdrop`, `.settings-close-btn`, `.settings-panel-header`, `.settings-divider`, `.settings-section-label`, `.settings-order-list`, `.settings-order-reset`, `.o-extra`, `.th-extra`. |
| 2026-06-09 | 1.9 | `flowefficiency.js` (Flow Efficiency) ergänzt: `import { init as initFlowEfficiency }` + `initFlowEfficiency()` im Bootstrap-Block. Tile auf Lieferfähigkeit-Page, Join JiraStories + JiraBlockermanagement. |
| 2026-06-11 | 2.1 | `montecarlo.js` (MonteCarlo Simulation) ergänzt: `import { init as initMonteCarlo }` + `initMonteCarlo()` im Bootstrap-Block. Neue Deep-Dive-Page `monte` (`#page-monte`, `#page-canvas-monte`) mit Filterleiste (Squad + Reset). Sidebar-Link „Wann sind wir fertig?" (🎲🎲) ergänzt. `CARD_PAGE_MAP` in `core.js`: `'montecarlo': 'monte'`. |
| 2026-06-15 | 2.2 | Bugfix: `#page-canvas-lieferfahigkeit` (Fallback-Div) aus HTML-Struktur und Spec entfernt — Migration zu `core.createTile()` war bereits vollständig. |
| 2026-06-17 | 2.3 | Neue Sektion „Exaktes CSS – vollständige Klassen-Referenz" ergänzt: alle Klassen mit vollständigen CSS-Regeln (inkl. Hover-, Active-, State-Varianten) als Neubau-Referenz. Design-Tokens ausgelagert nach `docs/design/design-tokens.css`. |
| 2026-06-19 | 2.4 | Issue-Type-Filter implementiert: `#issuetype-dropdown` (shared, `position:fixed`), `.btn-issuetype-trigger` auf 5 Pages aktiv. `core.state.issueTypeFilter` + `allIssueTypes`. `filteredRows()` filtert Squad + Issue-Type. `fhwa_global` um `issueTypeFilter` erweitert. Filter-Reset setzt beide Filter zurück. Neue Sektion „Issue-Type-Filter" + Backlog-Eintrag entfernt. |
| 2026-06-20 | 2.7 | **Zeitraum-Filter implementiert:** `#daterange-dropdown` (shared, `position:fixed`), `.btn-daterange-trigger` auf allen Pages außer Blocker + Monte. `core.state.dateRangeMode/From/To/CustomFrom/CustomTo`. Modi: `'all'`, `'last30'`, `'last90'`, `'last180'`, `'q0'`–`'q3'` (4 Quartale dynamisch), `'custom'` (Von/Bis-Input + Übernehmen). `filteredRows()` filtert JiraStories nach Resolved/Rejected-Datum (aktive Tickets immer sichtbar). JiraEpics-Visuals + Happiness-Visual wenden Filter selbst an. `fhwa_global` um `dateRange: { mode, customFrom, customTo }` erweitert. Filter-Reset setzt alle 3 Filter zurück. Neue CSS-Klassen: `.dr-mode-list`, `.dr-opt`, `.dr-divider`, `.dr-custom`, `.dr-custom-row`. Neue Sektion „Zeitraum-Filter" + Backlog-Eintrag entfernt. |
| 2026-06-20 | 2.6 | **Squad-Filter Button-Text:** `_updateSquadBtn()` auf gleiche Logik wie Issue-Type-Filter umgestellt: 1 Name / 2 Namen / N/M (vorher immer N/M). |
| 2026-06-22 | 2.8 | **Kachel-Reihenfolge & Drag-and-Drop (Lieferfähigkeit-Page):** Default-Reihenfolge definiert (Lead Time → Say Do → Happiness → Flow Efficiency → WIP → Akzeptanzkriterien). Drag-Trigger = `.tile-title`; Ghost + `.tile-drag-over`-Platzhalter. Persistenz via `fhwa_tile_order`. Neuer Abschnitt „Lieferfähigkeit" im Settings-Panel mit zwei Buttons: „↩ Kachel-Reihenfolge zurücksetzen" + „⚠ Alle Einstellungen zurücksetzen" (mit `window.confirm` + `location.reload()`). **Jira-URL-Default:** `https://jira.axa.com/jira/browse/{issueKey}` vorgebefüllt. Neue CSS-Klassen: `.tile-title` (cursor:grab), `.tile.tile-dragging`, `.tile.tile-drag-over`. |
| 2026-06-20 | 2.5 | **Upload-Screen: Komplett neu gestalten.** `.hint-box` wird durch `.sheet-nav` mit 5 Tabs (JiraStories / JiraEpics / BRP Etappen / Blockermanagement / Happiness Faktor) ersetzt. Neue CSS-Klassen: `.sheet-nav`, `.sheet-tabs`, `.sheet-tab`, `.tab-badge.req/.opt`, `.sheet-tab-content`. **Datencheck-Page: Zentrierungs-Fix** (`.dc-wrap` + `margin:0 auto`). **Neue optionale Sheets-Sektion** (`.dc-extra-sheets` mit `.dc-sheet-card` je Sheet): JiraEpics (Epic-Anzahl + Status-Verteilung) · Blockermanagement (offene + Gesamt-Episoden) · Happiness Faktor (letzter Wert + Ø). Neue CSS-Klassen: `.dc-extra-sheets`, `.dc-section-title`, `.dc-sheets`, `.dc-sheet-card`, `.dc-sheet-card-title`, `.dc-sheet-pills`, `.dc-pill.resolved/.rejected/.uncalled/.alert`. **Browser-Back-Bug** (kein Neuladen nach Browser-Zurück) als separater Bugfix in core.js dokumentiert – nicht Teil dieser Spec. |
