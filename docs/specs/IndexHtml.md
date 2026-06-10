# index.html – Spezifikation

**Version:** 1.8  
**Datum:** 2026-06-09  
**Status:** Implementiert · wird bei Änderungen aktualisiert

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
    .app-body               Sidebar + Main-Content (kein globaler Topbar)
      .sidebar              Persistente linke Navigation
        .sidebar-logo       FlowAnalytics
        .sidebar-filebadge  Dateiname · Sheet-Name (#file-badge)
        #sidebar-locked     Oranges Banner „Erst Daten bestätigen" (display:none → flex nach File-Load)
        .sidebar-nav
          .sidebar-section  „Überblick"
          .sidebar-link[data-page="lieferfahigkeit"]   Lieferfähigkeit (▤ + 6 Metriken)
          .sidebar-section  „Detailanalysen"
          .sidebar-link[data-page="wipage"]            Was liegt gerade rum? (◔)
          .sidebar-link[data-page="scatter"]           Wie lange dauert ein Ticket? (◑)
          .sidebar-link[data-page="heatmap"]           Wo verbringen Tickets ihre Zeit? (◕)
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
            #page-canvas-lieferfahigkeit  display:none — Fallback
        #page-wipage  (.page-flex)
          .page-filterbar   „Was liegt gerade rum?" · Squad · Issue-Typ · Zeitraum · Reset
          .page-detail-canvas  id="page-canvas-wipage" — Card füllt inset:0
        #page-scatter  (.page-flex)
          .page-filterbar   „Wie lange dauert ein Ticket?" · Squad · Issue-Typ · Zeitraum · Reset
          .page-detail-canvas  id="page-canvas-scatter" — Card füllt inset:0
        #page-heatmap  (.page-flex)
          .page-filterbar   „Wo verbringen Tickets ihre Zeit?" · Squad · Issue-Typ · Zeitraum · Reset
          .page-detail-canvas  id="page-canvas-heatmap" — Card füllt inset:0
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
| Hint-Box | `.hint-box` | Zeigt erwartete Spalten (Pflicht/optional/Zustand) |

> `#data-preview` existiert noch im DOM (Kompatibilitäts-Rest), wird aber nicht mehr aktiv genutzt. Die Daten-Preview findet jetzt auf `#page-datencheck` im App-Screen statt.

---

## Datencheck-Page (`#page-datencheck`)

Wird nach File-Load von `_buildDatencheckPage()` in core.js dynamisch befüllt.

**Struktur (dynamisch erzeugt):**

```
.dc-wrap
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
  .dc-cta
    .btn-cta         „Weiter zu Lieferfähigkeit →" → ruft _launchApp()
    .dc-cta-note     Hinweistext
```

**Berechnungen in `_buildDatencheckPage()` (core.js):**

| Wert | Berechnung |
|---|---|
| `finished` | Zeilen mit `Resolved != null` ODER `Rejected != null` |
| `active` | `rows.length - finished` |
| Zeitraum | min/max über alle `s.dateCols` |
| `throughput` | `Math.round(finished / totalDays * 30)` |
| `oldCount` | aktive Tickets deren erster Zustands-Eintrag > 90 Tage zurückliegt |
| Leaving-States | `st.exitCol !== null` → `.dc-pill.leaving` (rot) |

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
| Lieferfähigkeit | `lieferfahigkeit` | ▤ | 6 Metriken |
| Was liegt gerade rum? | `wipage` | ◔ | WIP-Alter |
| Wie lange dauert ein Ticket? | `scatter` | ◑ | Cycle Time |
| Wo verbringen Tickets ihre Zeit? | `heatmap` | ◕ | Flow-Heatmap |

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
  #btn-squad (.btn-squad-trigger)   Squad-Filter-Button — öffnet shared #squad-dropdown
  (dropdown ist jetzt auf #app-screen-Ebene, position:fixed)
.pf-filter-chip.pf-disabled   „ISSUE-TYP Alle ▽"   (Platzhalter, noch nicht implementiert)
.pf-filter-chip.pf-disabled   „ZEITRAUM Gesamt ▽"  (Platzhalter, noch nicht implementiert)
pf-spacer
#lf-filter-reset (.squad-filter-reset)   „↻ Filter zurücksetzen" — handled by core.js
```

**Squad-Filter:** `#btn-squad` trägt Klasse `.pf-filter-chip` (statt `.btn-icon`). Aktiv-Zustand: `.pf-active`. Text-Update durch `_updateSquadBtn()` in core.js: `„SQUADS Alle ▽"` / `„SQUADS N/M ▽"`.

**Filter-Reset** (`#lf-filter-reset`, Bootstrap-Script in index.html): setzt alle Squad-Checkboxen auf `checked=true` und feuert `sdd-all`-Click-Event.

### Scrollbarer Inhalt (`.page-scroll`)

```
#tile-canvas-lieferfahigkeit   Flexbox (flex-wrap:wrap, justify-content:center) — auto 3→2→1 Spalten
#page-canvas-lieferfahigkeit   display:none (Fallback bis boxchart.js migriert)
```

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
| `.squad-filter-reset` | Filter-zurücksetzen-Button auf jeder Page — handled by core.js |

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
| **Jira** | `#settings-url-input` | URL-Template; setzt `core.state.urlTemplate`, emittiert `'settings'` |
| **Darstellung** | `#settings-tile-height`, `#tile-h-display`, `#settings-tile-row` | Kachelgröße-Slider (390–720 px, 16:10); `fhwa_tileHeight`; disabled bis Datei geladen |
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

  initHeatmap(); initScatter(); initWipage(); initBoxChart();
  initHappiness(); initWip(); initFlowEfficiency();
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
| **ISSUE-TYP Filter** | mittel | `.pf-filter-chip` in Lieferfähigkeit-Filterleiste aktivieren; `core.state.issueTypeFilter` |
| **ZEITRAUM Filter** | mittel | Datumsbereich-Picker in Filterleiste; `core.state.dateRange` |
| **Card-Titel editierbar** | klein | `contenteditable` auf `.card-title`; Änderung in `fhwa_layout2` persistieren |
| **Card minimieren** | klein | `.card-content` auf `height:0` klappen; Button im Card-Header |
| **Lieferfähigkeit Page-Header** | mittel | ÜBERSICHT-Label, Titel, Zeitraum-Anzeige, Aufmerksamkeits-Box — eigenes `lieferfahigkeit.js`-Modul |

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
| 2026-06-10 | 2.0 | `.tile-container` erhält `max-width:calc(3 * var(--tile-w) + 3rem)` + `margin:0 auto` — begrenzt Tile-Raster auf max. 3 Spalten und zentriert es horizontal. |
