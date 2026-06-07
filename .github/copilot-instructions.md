# Flow Analytics – Copilot Instructions

Dieses Projekt ist ein **browser-basiertes Flow Analytics Dashboard** (vanilla JS, ES-Module, kein Framework, kein Build-System außer `build.py` für Bundle-Distribution).

Vollständige Dokumentation: `WebAppEntwickeln.md` (immer mit `#file:WebAppEntwickeln.md` referenzieren).

---

## Projektstruktur

```
project-root/
  docs/
    WebAppEntwickeln.md        ← Entwicklungsleitfaden
    specs/
      LeadTime_BoxChart.md     ← bestätigte Spec
      WIPAge.md
      [VisualName].md          ← künftige Specs
  src/
    index.html         ← Einstiegspunkt, Layout, CSS, Modul-Imports
    core.js            ← Gemeinsame Engine – State, Grid, Theme, Events, Navigation, Utils
    heatmap.js         ← FlowHeatmap Visual
    scatter.js         ← CycleTime Scatterplot
    wipage.js          ← WIPAge Chart
    boxchart.js        ← LeadTime BoxChart (Tile auf Lieferfähigkeit-Page, core.createTile())
    saydoratio.js      ← Say_Do_Ratio KPI (Epics-Sheet, Quartals-Verlauf)
    wipkpi.js          ← WIP KPI-Card (JiraStories)
    flowefficiency.js  ← Flow Efficiency (JiraStories + BlockedReasons JOIN)
    happiness.js       ← Happiness Faktor Visual (Sheet: 'Happiness Faktor')
    akzeptanz.js       ← Akzeptanzkriterien KPI (dediziertes Sheet)
  tools/
    build.py        ← Bündelt ES-Module zu FlowAnalytics.html
  Web App/
    FlowAnalytics.html
  .github/
    copilot-instructions.md
```

---

## Architektur-Regeln (nie verletzen)

- Jedes Visual ist eine **eigenständige `.js`-Datei** – nie bestehende Visuals erweitern
- Config-State immer **lokal im Visual** via `core.load('fhwa_[id]', defaults)` – nie in `core.state` schreiben
- localStorage-Keys nach Schema: **`fhwa_[visualId]`**
- Events abonnieren: `core.on('data' | 'theme' | 'filter' | 'resize', render)` + `'settings'` wenn `core.state.urlTemplate` genutzt wird
- Neues Visual: **3 Stellen** aktualisieren – neue `.js`-Datei, `index.html` (import + init + Page-Zuordnung), `build.py` (4 Stellen)
- **Lieferfähigkeit-Visuals** → `core.createTile({ id, title })` · **Deep-Dive-Visuals** → `core.createCard({ id, title, defaultGrid })`

### Zwei Rendering-Modelle

| Modell | Factory | Container | Seiten |
|---|---|---|---|
| **Tile** | `core.createTile()` | `#tile-canvas-[pageId]` (CSS-Grid) | lieferfahigkeit |
| **Card** | `core.createCard()` | `#page-canvas-[pageId]` (position:relative) | wipage, scatter, heatmap |

```javascript
// Tile (Lieferfähigkeit) – kein Drag/Resize, feste Höhe var(--tile-h)
const { tileEl, contentEl, headerExtraEl, diagEl } = core.createTile({
  id: 'wipkpi', title: 'WIP<span class="hl">KPI</span>',
});

// Card (Deep-Dive) – Drag/Resize, Grid-Positionierung
const { cardEl, contentEl, headerExtraEl, diagEl } = core.createCard({
  id: 'wipage', title: 'WIP<span class="hl">Age</span>',
  defaultGrid: { col: 0, row: 0, w: 12, h: 10 },
});
```

### Navigation & Pages

Die App hat eine persistente **linke Sidebar** mit 4 Pages:

| Page-ID | Label | Visuals |
|---|---|---|
| `lieferfahigkeit` | Lieferfähigkeit | boxchart, saydoratio, wipkpi, flowefficiency, happinessfaktor, akzeptanz |
| `wipage` | Was liegt gerade rum? | wipage |
| `scatter` | Wie lange dauert ein Ticket? | scatter |
| `heatmap` | Wo verbringen Tickets ihre Zeit? | heatmap |

```javascript
core.showPage('lieferfahigkeit');   // Page wechseln
core.state.activePage               // → aktuell sichtbare Page-ID
```

### Multi-Sheet-Loading

`core.state.sheets` enthält alle Worksheets der Excel-Datei als generische Map:

```javascript
// Zugriff in Visuals – immer mit ?? [] absichern
const epics   = core.state.sheets['Epics']          ?? [];
const blocked = core.state.sheets['BlockedReasons'] ?? [];

// core.state.rows bleibt als Alias für JiraStories (Kompatibilität)
core.state.rows === core.state.sheets['JiraStories']  // true
```

Fehlt ein Sheet → leeres Array → Visual zeigt Leerzustand. Kein Core-Umbau nötig.

---

## Kritische Coding-Regeln

```javascript
// FARBEN: nie hardcoden – immer CSS-Variablen oder core.scatterColors()
// FALSCH:
circle.setAttribute('fill', '#38bdf8');
// RICHTIG:
circle.setAttribute('fill', 'var(--blue)');
// oder: const C = core.scatterColors(); circle.setAttribute('fill', C.accent);

// MATH.MAX: immer gegen leeres Array absichern
// FALSCH: Math.max(...values)
// RICHTIG: values.length ? Math.max(...values) : 0

// SVG-RENDERING: svgEl.innerHTML = parts.join('') ist erlaubt (Browser-Kontext)

// LINKS: window.open(url, '_blank') – kein host.launchUrl (standalone HTML)
```

---

## Zeitberechnungen – Dual-Period-Logik (gilt für alle Visuals)

Ein Work Item kann einen Status zweimal durchlaufen. Immer `_first`-Spalten prüfen:

```javascript
// Korrekte Gesamtdauer eines Status:
const threshold = 43_200_000; // 0.5 Tage in ms
const sameDay = Math.abs(dateX_first - dateX) < threshold;
const duration = sameDay
  ? core.dur(dateX, leavingX)                                    // einmaliger Durchlauf
  : core.dur(dateX_first, leavingX_first) + core.dur(dateX, leavingX); // zweimaliger Durchlauf
```

**Aktiv/Erledigt-Logik (XOR):**
```javascript
const isDone   = row['Resolved'] != null || row['Rejected'] != null;
const isActive = !isDone && row['In Progress_first'] != null;
```

---

## Design-Standards (§9)

### Tooltip – boundary-safe + klickbare Links

```javascript
// Positionierung (immer so – nie direkt mouseX/Y übernehmen)
function positionTooltip(tt, mx, my, container) {
  const ttW = tt.offsetWidth || 200, ttH = tt.offsetHeight || 100;
  let left = mx + 12; if (left + ttW > container.clientWidth)  left = mx - ttW - 12;
  let top  = my + 12; if (top  + ttH > container.clientHeight) top  = my - ttH - 12;
  tt.style.left = Math.max(0, left) + 'px';
  tt.style.top  = Math.max(0, top)  + 'px';
}

// Hover-Delay für klickbare Links (120ms)
let _hideTimer = null;
const _showTt = () => { clearTimeout(_hideTimer); _hideTimer = null; };
const _hideTt = () => { _hideTimer = setTimeout(() => tt.style.display = 'none', 120); };
tt.addEventListener('mouseenter', _showTt);
tt.addEventListener('mouseleave', _hideTt);
tt.style.pointerEvents = item.url ? 'all' : 'none';
```

### Dot-Radius-Formel (Standard)
```javascript
const r = Math.max(3, Math.min(8, containerWidth / 100)) * (cfg.dotSize / 4);
```

### Reihenfolge-Panel
Immer ▲/▼ + Drag-Handle – nie Textfeld oder Dropdown. Gespeichert in `cfg.stateOrder` via `core.save()`.

### N-Anzeige
Immer vorhanden. Scatterplot: oben links im Plot. Kategorie-Charts: unter jeder X-Achsen-Beschriftung.

### Link-Feature
```javascript
const url = item.rawUrl?.trim()
  || (core.state.urlTemplate ? core.state.urlTemplate.replace(/\{issueKey\}/g, item.key) : '');
if (url) window.open(url, '_blank');
```

---

## Zusammenarbeits-Protokoll (§0)

Bei **neuen Visuals**: SDD-Interview (Blöcke A–G) führen → `docs/specs/VisualName.md` erstellen → Gate 1 bestätigen → HTML-Prototyp → Implementierung.

Bei **Bugfixes**: Ist der Bug eine Spec-Lücke? → SDD.md zuerst updaten, dann fixen. Bug danach in „Bekannte Bugs und Lösungen" in `WebAppEntwickeln.md` dokumentieren.

**Eine Frage auf einmal** (M1). **Design-Entscheidungen begründen** (M3). **Ab Chat-Nachricht 15** Übergabe-Dokument anbieten (M4).

---

## Rolling Pace – nur Resolved-Items

```javascript
// FALSCH: completedRows = rows.filter(r => r['Resolved'] != null);
// RICHTIG: Rejected-Items explizit ausschließen
const completedRows = rows.filter(r => r['Resolved'] != null && r['Rejected'] == null);
```
