# LeadTime BoxChart (boxchart.js) – Spezifikation

**Version:** 1.5  
**Datum:** 2026-06-07  
**Status:** Implementiert

---

## A – Zweck & Abgrenzung

### Was das Visual macht
Box-Plot-Diagramm zur Analyse der Lead Time von Work Items über Zeit. Zeigt pro Iteration (Monat oder Quartal) die statistische Verteilung der Lead-Time-Werte in drei wählbaren Ansichtsmodi: Box, Violin, Kombi. Oben eine KPI-Zusammenfassung (Median + Trend + P85 der neuesten Periode), unten der Chart. Lead Time = ltEnd − ltStart (konfigurierbar, Dual-Period-Logik).

### Was es NICHT macht
- Kein Cross-Filter auf andere Visuals
- Kein Visual-spezifisches Grouping (nur eine Serie pro Periode)
- Keine konfigurierbaren Farben (feste Farben aus CSS-Variablen)
- Kein eigenes URL-Template (fällt auf `core.state.urlTemplate` zurück)

### Technologie
Web-App (`boxchart.js`) – ES-Modul, eingebunden in `index.html` + `core.js`  
Rendering-Modell: **Tile** (`core.createTile()`) auf der Lieferfähigkeit-Page — kein Drag/Resize, feste Höhe `var(--tile-h)`.

---

## B – Datenmodell

### Excel-Spalten
| Spalte | Typ | Pflicht? | Beschreibung |
|---|---|---|---|
| `Jira-ID` | Text | ✅ | Eindeutiger Identifier, für Tooltip-URL-Link |
| `Issue Type` | Text | ○ | Wird im Ausreißer-Tooltip angezeigt (Fallback: `IssueType`, `Type`, `issue_type`) |
| `[ltStart]` | Datum | ✅ | Konfigurierbar, Default: `Ready4Progress_first` |
| `[ltEnd]` | Datum | ✅ | Konfigurierbar, Default: `Resolved` |

Alle weiteren Meta-Spalten werden ignoriert. Squad-Filter wirkt global via `core.filteredRows()`.

### Datumsstrategie
Dual-Period-Logik für ltStart und ltEnd (`_first`-Spalten). `lt = core.dur(row[ltStart], row[ltEnd])`. Items ohne gültige Daten werden übersprungen.

### Perioden-Gruppierung
- **Monat**: aus ltEnd-Datum → `YYYY-MM` → Anzeige z.B. `Mai 26`
- **Quartal**: aus ltEnd-Datum → `YYYY-QN` → Anzeige z.B. `Q2 26`
- **Sortierung**: **chronologisch aufsteigend** — ältester Monat links, neuester rechts

---

## C – UX & Layout

### Tile-Struktur (ASCII-Sketch)
```
┌──────────────────────────────────────────────────────────────────┐
│  LeadTime  [Box][Violin][Kombi]  [Ausr.●]  [● AUS JIRA]  [⚙]  │  ← tile-header
├──────────────────────────────────────────────────────────────────┤
│  [bc-cfg-panel] (Overlay, position:absolute, nur wenn ⚙ offen)  │
├──────────────────────────────────────────────────────────────────┤
│  15d  [▲ +9d ggü. Vorperiode]                                   │  ← bc-kpi-area
│  P85 · 21d · typischer Fall                                      │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Y │  ·  Whisker ↑                                              │
│    │  ┌────────┐  Box (P25–P85)                                 │
│    │  │────────│  Median-Linie (blau)                            │
│    │  │ ╌╌╌╌╌╌ │  P85-Linie (amber, gestrichelt)               │
│    │  └────────┘                                                 │
│    │  ·  Whisker ↓ · ○ Ausreißer                               │
│    └──────────────────────────── X (Iterationen, chronologisch) │
│    Jan  Feb  Mär  Apr  Mai  Jun                                  │
│    n=X  n=X  ...                                                 │
├──────────────────────────────────────────────────────────────────┤
│  » Was zeigt diese Ansicht?          Verteilung ansehen →        │  ← footer (diag-bar)
└──────────────────────────────────────────────────────────────────┘
```
Tile-Höhe = `var(--tile-h, 220px)` · konfigurierbar über Settings-Slider (160–320 px).

### Tile-Header Controls
- **Titel**: `Lead<span class="hl">Time</span>`
- **Mode-Buttons**: `Box` · `Violin` · `Kombi` — aktiver Modus hervorgehoben (`p-blue`)
- **Ausreißer-Toggle**: `Ausr. ●` (an, blau) / `Ausr. ○` (aus)
- **Badge**: `● AUS JIRA` (blau, zeigt Datenquelle)
- **Button ⚙**: öffnet Config-Panel als Overlay

### Config-Panel (⚙, `#bc-cfg-panel`) — Overlay
Das Panel öffnet sich `position:absolute` innerhalb von `contentEl` (Chart-Bereich). Dadurch sind Header und KPI-Bereich nie überdeckt und der ⚙-Button bleibt jederzeit erreichbar. Die Tile-Breite ändert sich nicht.

| Control | ID | Funktion |
|---|---|---|
| ltStart-Select | `#bc-ltstart` | Lead-Time Startspalte wählen |
| ltEnd-Select | `#bc-ltend` | Lead-Time Endspalte wählen |
| Iteration-Select | `#bc-period` | Monat / Quartal |
| Glättung-Checkbox | `#bc-smoothing-chk` | Violin KDE-Glättung ein/aus |
| Y-Schritt-Input | `#bc-ystep` | Schrittweite Y-Achse in Tagen (0 = auto); Tick-Anzahl wird live daneben angezeigt (`#bc-ytick-info`) |
| Log-Skala-Checkbox | `#bc-ylog-chk` | Logarithmische Y-Skala; deaktiviert Y-Schritt-Input |
| × Schließen | `#bc-cfg-close` | Schließt das Config-Panel |

> Ansicht (Box/Violin/Kombi) und Ausreißer sind **nicht** im ⚙-Panel — sie befinden sich direkt im Tile-Header.

### KPI-Bereich (`#bc-kpi-area`)
Liegt **zwischen** KPI-Bereich und `tile-content`. Wird in `_updateKpiArea()` nach jedem Render befüllt.

| Element | ID | Inhalt |
|---|---|---|
| Headline-Wert | `#bc-kpi-val` | Median der **neuesten** Periode, gerundet: z.B. `15d` |
| Trend-Badge | `#bc-kpi-trend` | Differenz zur Vorperiode: `▲ +Xd` (orange) / `▼ −Xd` (grün) |
| Subtitel | `#bc-kpi-sub` | `P85 · Xd · typischer Fall` |

Trend wird nur angezeigt wenn `|diff| >= 1`. Höhere Lead Time → orange (schlechter), niedrigere → grün.

### Interaktionen

| Aktion | Trigger | Effekt |
|---|---|---|
| Modus wechseln | Klick auf `Box`/`Violin`/`Kombi` im Header | `cfg.chartMode` setzen, aktiver Button `p-blue`, neu rendern |
| Ausreißer toggle | Klick auf `Ausr.`-Button im Header | `cfg.showOutliers` toggle, Button-Text und `p-blue` aktualisieren |
| ⚙ öffnen/schließen | Klick auf ⚙ | Overlay-Panel ein/aus (`_togglePanel()`) |
| Panel schließen (×) | Klick auf × im Panel | `_closePanel()` |
| Panel schließen (außen) | Klick außerhalb Panel + ⚙-Button | `_closePanel()` via capture-Listener |
| Tooltip Ausreißer | `mouseover` auf `circle.bc-out` | Jira-ID + Issue Type + Lead Time + Jira-Link (falls URL) |
| Tooltip Box | `mouseover` auf `rect.bc-box-hit` | Median / P85 / P25 / Whisker ↑↓ / n |
| Tooltip schließen | `mouseout` (120ms Delay) | `display:none` |
| Jira-Link klicken | Klick auf Link im Tooltip | `window.open(url, '_blank')` |
| Verteilung ansehen | Klick auf Footer-Link | `core.showPage('scatter')` |

### Footer (`diag-bar`, umgebaut)
Zwei statische Elemente, einmalig in `_buildFooter()` gesetzt:
- Links: `» Was zeigt diese Ansicht?` (gedimmt)
- Rechts: `Verteilung ansehen →` (blau, Link → `core.showPage('scatter')`)

### Leerzustand
Keine Daten / alle Items herausgefiltert / ltStart oder ltEnd nicht gefunden → zentrierte Meldung in `contentEl`, KPI-Bereich zeigt `–`.

### Responsive
SVG 100 % Breite/Höhe des `contentEl`. Boxbreite, Schriftgröße, Ausreißer-Radius skalieren mit Container.

---

## D – Berechnungslogik

### Lead Time pro Item
`lt = core.dur(row[ltStartCol], row[ltEndCol])` — Items mit `lt < 1` oder `null` werden übersprungen.

### Statistik pro Periode
| Metrik | Formel |
|---|---|
| P25 | Lineare Interpolation, 25. Perzentil |
| Median | 50. Perzentil |
| P85 | 85. Perzentil (bewusst statt P75) |
| IQR | P85 − P25 |
| Fence | 1,5 × IQR |
| Whisker oben | min(max(Werte), P85 + Fence) |
| Whisker unten | max(min(Werte), P25 − Fence) |
| Ausreißer | Werte außerhalb [Whisker unten, Whisker oben] |

### KPI-Berechnung (`_updateKpiArea`)
- `latestKey` = letzter Eintrag in `_chronoSort()` (neueste Periode)
- `prevKey` = vorletzter Eintrag (falls vorhanden)
- Headline = `Math.round(latestStats.med)` + `'d'`
- Trend = `latestStats.med − prevStats.med` → auf ganze Tage gerundet
- Subtitel = `P85 · Math.round(latestStats.p85)d · typischer Fall`

### Violin KDE
Gaussian Kernel, getrimmt auf echten Min/Max (cut=0), 80 Stützpunkte.  
Bandwidth: `BW_ON = 4` (Glättung an) / `BW_OFF = 1.2` (Glättung aus, zeigt Rohdaten-Form).

### Perioden-Sortierung
`_chronoSort(keys)` = `[...keys].sort()` — YYYY-MM und YYYY-QN sortieren als Strings korrekt chronologisch.

### Edge Cases
| Situation | Verhalten |
|---|---|
| Periode mit < 2 Items | Box/Violin wird gezeichnet (ggf. nur Median-Punkt) |
| ltStart/ltEnd nicht gefunden | `_showEmpty()`, kein Rendern |
| Alle Items herausgefiltert | `_showEmpty()` |
| `Math.max()` auf leerem Array | Abgesichert mit length-Check |
| `_contentEl.innerHTML` überschreibt Panel | Panel-`<div>` vor jedem `innerHTML`-Aufruf per `getElementById` retten, danach per `appendChild` zurückhängen — gilt für `_render()` und `_showEmpty()` |
| `|trend| < 1d` | Trend-Badge wird nicht angezeigt |
| Keine Vorperiode | Trend-Badge bleibt ausgeblendet |

---

## E – Config / Format-Panel

localStorage-Key: `fhwa_boxchart`

| Property | Typ | Default | Effekt |
|---|---|---|---|
| `chartMode` | enum | `"box"` | Ansichtsmodus: box / violin / combo |
| `periodMode` | enum | `"month"` | Gruppierung: month / quarter |
| `showOutliers` | bool | `true` | Ausreißer-Punkte ein/aus |
| `smoothing` | bool | `true` | Violin KDE-Glättung: an (`bw=4`) / aus (`bw=1.2`) |
| `yStep` | number | `0` | Y-Achsen-Schrittweite in Tagen (0 = auto-berechnet) |
| `yLog` | bool | `false` | Logarithmische Y-Skala (deaktiviert `yStep`) |
| `ltStart` | string | `"Ready4Progress_first"` | Lead-Time Startspalte |
| `ltEnd` | string | `"Resolved"` | Lead-Time Endspalte |

### Migration
Beim ersten Laden wird ein gespeicherter `bandwidth`-Wert (Altformat) automatisch in `smoothing: true/false` konvertiert (`bandwidth > 2 → true`) und aus localStorage entfernt. Fehlende `yStep`/`yLog`-Werte werden mit Defaults befüllt.

---

## F – Design-Standards (Pflichtcheck)

| Standard | Entscheidung | Details |
|---|---|---|
| Tooltip boundary-safe | ✅ | `_posTt()` mit Overflow-Prüfung (position:fixed) |
| Tooltip mit Links | ✅ | Hover-Delay 120ms + `pointerEvents:all` wenn URL vorhanden |
| N-Anzeige | ✅ | `n=XX` unter jeder Iterationsbeschriftung (X-Achse) |
| KPI-Bereich | ✅ | `#bc-kpi-area` zwischen Config-Panel und Chart |
| Footer statt Diag-Text | ✅ | `_buildFooter()` einmalig, nie überschrieben |
| Reihenfolge-Panel | — | nicht benötigt (chronologisch fest) |
| Skalierung | ✅ | SVG 100%/100%, Padding reduziert für kompakte Tile-Höhe |
| Dark/Light Theme | ✅ | `core.scatterColors()` + CSS-Variablen |
| Link-Feature | ✅ | `core.state.urlTemplate` + `{issueKey}`, `window.open()` |
| Panel-Overlay | ✅ | `position:absolute` in `contentEl` → Header/KPI nie überdeckt, keine Breitenänderung |
| Panel schließen | ✅ | ⚙-Toggle + × Schließen-Button + Klick-außerhalb (capture-Listener) |

---

## G – Akzeptanzkriterien

### Automatisch prüfbar
- [ ] `core.filteredRows()` einziger Datenzugriff (kein `core.state.rows`)
- [ ] localStorage-Key `fhwa_boxchart`
- [ ] Keine hardcodierten Farben im Code

### Manuell durch Oliver
- [ ] ⚙ öffnen → Tile-Breite ändert sich **nicht**
- [ ] ⚙ erneut klicken → Panel schließt sich
- [ ] × im Panel → Panel schließt sich
- [ ] Klick außerhalb Panel → Panel schließt sich
- [ ] Mode-Buttons (Box/Violin/Kombi) im Header: aktiver Modus `p-blue` hervorgehoben
- [ ] Ausreißer-Toggle im Header: `Ausr. ●` / `Ausr. ○` wechselt korrekt
- [ ] KPI-Bereich zeigt Median der neuesten (rechtesten) Periode
- [ ] Trend-Badge erscheint/verschwindet korrekt (nur wenn `|diff| >= 1d`)
- [ ] Höhere LT → oranges Badge; niedrigere → grünes Badge
- [ ] Sortierung chronologisch: Jan links, Jun rechts
- [ ] Footer-Links klickbar: „Verteilung ansehen →" öffnet Scatter-Page
- [ ] Alle 3 Modi (Box / Violin / Kombi) rendern ohne Fehler
- [ ] Glättung Ein/Aus: Violin-Form ändert sich sichtbar
- [ ] Y-Schritt eingeben (z.B. 50) → Tick-Anzahl daneben aktualisiert sich live
- [ ] Y-Schritt leer lassen → automatische Skalierung greift
- [ ] Log-Skala aktivieren → Y-Achse logarithmisch, Y-Schritt-Input deaktiviert
- [ ] Log-Skala + Ausreißer: Datenpunkte korrekt auf Log-Skala positioniert
- [ ] Ausreißer-Tooltip: Jira-ID + Issue Type + Lead Time + Link korrekt
- [ ] Box-Tooltip: Median / P85 / P25 / Whisker ↑↓ / n korrekt
- [ ] Tooltip vollständig sichtbar an allen 4 Ecken
- [ ] Ausreißer-Link öffnet Jira im Browser
- [ ] 0 Items: zentrierte Meldung in contentEl, KPI zeigt `–`
- [ ] Ungültige Spalte: Meldung, kein JS-Error
- [ ] Theme-Wechsel: korrektes Neu-Rendern
- [ ] Config überlebt Browser-Reload
- [ ] Migration: altes `bandwidth` aus localStorage wird korrekt konvertiert

---

## Änderungshistorie

| Datum | Version | Änderung |
|---|---|---|
| 2026-06-01 | 1.0 | Initiale Spec nach SDD-Interview |
| 2026-06-07 | 1.1 | Phase 1b: `createCard()` → `createTile()`, Tile-Höhe `var(--tile-h)` |
| 2026-06-07 | 1.2 | Phase 1c: KPI-Bereich (`#bc-kpi-area`), Footer, `_chronoSort`, Badge, Controls in ⚙-Panel |
| 2026-06-07 | 1.3 | ⚙-Panel als Overlay (keine Breitenänderung); Ansicht + Ausreißer in Tile-Header; „Periode" → „Iteration"; Bandwidth-Slider → Glättung Ein/Aus; MouseOver auf Ausreißer (Jira-ID + IssueType + LT + Link) und Box (P25/Median/P85/Whisker/n) |
| 2026-06-07 | 1.4 | Bug: Panel schließen repariert (Panel in `contentEl`, Header nie überdeckt); × Schließen-Button + Klick-außerhalb; Y-Achse: Schrittweite konfigurierbar + live Tick-Anzahl + Log-Skala wählbar |
| 2026-06-07 | 1.5 | Bug: ⚙-Panel wurde bei jedem `_render()`- und `_showEmpty()`-Aufruf durch `innerHTML`-Überschreibung gelöscht → Panel vor `innerHTML` retten, danach per `appendChild` zurückhängen; Edge Case in Block D dokumentiert |
