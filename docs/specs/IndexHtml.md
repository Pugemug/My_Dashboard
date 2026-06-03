# index.html – Spezifikation

**Version:** 1.0  
**Datum:** 2026-06-03  
**Status:** Implementiert · wird bei Änderungen aktualisiert

---

## Zweck

`index.html` ist der einzige Einstiegspunkt der Web-App. Sie enthält:
- das gesamte CSS (Theme-System, Layout, Komponenten-Klassen)
- das HTML-Gerüst (Upload-Screen, App-Screen, Topbar, Dashboard-Canvas)
- den ES-Module-Bootstrap (Imports + `init()`-Aufrufe aller Visuals)

Es gibt keinen Build-Schritt. Die Datei wird direkt im Browser geöffnet (SharePoint/HTTPS).

---

## HTML-Struktur

```
<body>
  #upload-screen          Drag&Drop + Datei-Picker + Hint-Box
  #app-screen
    .topbar               Logo · File-Badge · 🏰 Squads · ⚙ Einstellungen · ☀/🌙 Theme · Neue Datei
      #squad-dd-wrap      Squad-Filter-Dropdown (squad-dropdown)
      #settings-wrap      Einstellungen-Panel (settings-panel)
    #dashboard            overflow:auto — scrollt wenn Cards über Viewport hinausgehen
      #dash-canvas        position:relative — wächst mit Cards (_updateCanvasH in core.js)
        [Cards]           position:absolute — von den Visuals über core.createCard() erzeugt
  <script type="module"> ES-Module-Bootstrap
```

### Upload-Screen (`#upload-screen`)

Sichtbar beim Start, versteckt nach Datei-Laden.

| Element | ID / Klasse | Funktion |
|---|---|---|
| Drag&Drop-Zone | `#drop-zone` | `dragover`, `drop` → `_loadFile()` in core.js |
| Datei-Picker | `#file-input` | `type="file"`, `display:none` |
| Hint-Box | `.hint-box` | Zeigt erwartete Spalten (Pflicht/optional/Zustand) |

### Topbar (`.topbar`)

Immer sichtbar wenn App-Screen aktiv. Enthält:

| Element | ID | Funktion |
|---|---|---|
| Logo | — | Statischer Text |
| File-Badge | `#file-badge` | Dateiname · Sheet-Name (gesetzt von core.js) |
| Squad-Button | `#btn-squad` | Öffnet `#squad-dropdown` |
| Squad-Dropdown | `#squad-dropdown` | Checkboxen pro Squad; Alle/Keine-Buttons |
| Theme-Button | `#btn-theme` | `core.toggleTheme()` |
| Einstellungen-Button | `#btn-settings` | Öffnet `#settings-panel` |
| Jira-URL-Input | `#settings-url-input` | Setzt `core.state.urlTemplate`, emittiert `'settings'` |
| Neue-Datei-Button | `#btn-reset` | Zurück zum Upload-Screen |

### Dashboard (`#dashboard` / `#dash-canvas`)

```css
#dashboard  { flex:1; overflow:auto; }
#dash-canvas { position:relative; min-height:100%; }
```

Cards werden von core.js per `position:absolute` positioniert. `_updateCanvasH()` hält `#dash-canvas` groß genug, damit der Scrollbalken korrekt erscheint.

---

## CSS-System

### Theme-Variablen (`:root` / `[data-theme="light"]`)

`data-theme` sitzt auf `<html>`. Wird von `core.toggleTheme()` gesetzt.

| Variable | Dark | Light | Verwendung |
|---|---|---|---|
| `--bg` | `#0f1c30` | `#f1f5f9` | Body-Hintergrund |
| `--bg2` | `#162035` | `#ffffff` | Cards, Topbar, Panels |
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
| `--orange` | `#fb923c` | `#c2410c` | Zustandsspalten-Hint |

### Wichtige Komponenten-Klassen

| Klasse | Beschreibung |
|---|---|
| `.card` | Absolute-positionierte Karte; `flex-direction:column` |
| `.card-header` | Drag-Handle · Titel · Controls |
| `.card-drag-handle` | `⠿`-Icon, `cursor:grab` |
| `.card-title` | Fett, `.hl` für blaue Hervorhebung |
| `.card-content` | `flex:1; overflow:auto` — hier rendert das Visual |
| `.card-resize-handle` | Ecke rechts unten, `cursor:nwse-resize` |
| `.diag-bar` | Fixe Zeile unten in jeder Card (Diagnoseanzeige) |
| `.btn-icon` | Standard-Button in Topbar und Card-Header |
| `.btn-icon.p-blue/yellow/…` | Aktiver Zustand eines Buttons (farbig) |
| `.sub-panel` | Aufklappbares Einstellungs-Panel innerhalb einer Card |
| `.order-item` | Drag-fähiges Element im Reihenfolge-Panel |
| `.tt-*` | Tooltip-Stile (`tt-title`, `tt-row`, `tt-lbl`, `tt-val`, `tt-link`) |

---

## ES-Module-Bootstrap

```html
<script type="module">
  import { core }                 from './core.js';
  import { init as initHeatmap }  from './heatmap.js';
  import { init as initScatter }  from './scatter.js';
  import { init as initWipage }   from './wipage.js';
  import { init as initBoxChart } from './boxchart.js';

  initHeatmap();
  initScatter();
  initWipage();
  initBoxChart();

  core.initApp();
</script>
```

**Reihenfolge:** Alle `init()`-Aufrufe vor `core.initApp()`. Die `init()`-Funktionen registrieren Cards und Event-Listener; `initApp()` startet Theme, globalen State und File-Upload-Handler.

**Neues Visual hinzufügen:** Zwei Zeilen ergänzen (import + init-Aufruf). Außerdem `build.py` an 4 Stellen aktualisieren (siehe WebAppEntwickeln.md).

---

## Geplante Features (Backlog)

| Feature | Aufwand | Beschreibung |
|---|---|---|
| **Card-Titel editierbar** | klein | `contenteditable` auf `.card-title`; Änderung in `fhwa_layout2` persistieren |
| **Card minimieren** | klein | `.card-content` auf `height:0` klappen; Button im Card-Header |

---

## Änderungshistorie

| Datum | Version | Änderung |
|---|---|---|
| 2026-06-03 | 1.0 | Initiales Dokument |
