# LeadTime BoxChart (boxchart.js) – Spezifikation

**Version:** 1.9  
**Datum:** 2026-06-20  
**Status:** Implementiert

---

## A – Zweck & Abgrenzung

### Was das Visual macht
Box-Plot-Diagramm zur Analyse der Durchlaufzeit von Work Items über Zeit. Zeigt pro Iteration (Monat oder Quartal) die statistische Verteilung der Durchlaufzeit-Werte in drei wählbaren Ansichtsmodi: Box, Violin, Kombi. Oben eine KPI-Zusammenfassung (Median + Trend + P85 der neuesten Periode), unten der Chart. Durchlaufzeit = ltEnd − ltStart (konfigurierbar, Dual-Period-Logik).

**Bug-Ausschluss (visuelspezifisch):** Issue-Type `Bug` (case-insensitiv, exakter Vergleich) ist per Default aus der Berechnung ausgeschlossen. Der Toggle-Button `inkl. Bug` im Header steuert dies lokal und hat absolute Priorität über den globalen Issue-Type-Filter aus `index.html`. Alle anderen Issue-Types (Story, Task, Epic, Sub-Task, …) werden eingeschlossen. Diese Besonderheit gilt nur für dieses Visual.

**Modus-Logik (Lead Time / Cycle Time / Cycle Time sonstige):**  
Das Visual erkennt automatisch anhand der gewählten ltStart/ltEnd-Spalten, welcher Modus aktiv ist:

| Modus | ltStart | ltEnd | Titel | Buttons |
|---|---|---|---|---|
| Lead Time | `Ready4Progress_first` | `Resolved` | `Lead<span class="hl">Time</span>` | Lead Time hervorgehoben |
| Cycle Time | `In Progress_first` | `Resolved` | `Cycle<span class="hl">Time</span>` | Cycle Time hervorgehoben |
| Cycle Time sonstige | (beliebig) | (beliebig) | `Cycle Time <span class="hl">sonstige</span>` | keiner hervorgehoben |

Ein Klick auf einen Modus-Button setzt ltStart/ltEnd sofort auf die Preset-Werte des jeweiligen Modus und speichert die Konfiguration.

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
| `Issue-Type` | Text | ○ | Wird im Ausreißer-Tooltip angezeigt und für Bug-Filterung verwendet (Fallback: `Issue Type`, `IssueType`, `Type`, `issue_type`) |
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
│  LeadTime  [Lead Time●][Cycle Time○]  [inkl. Bug○]  [Box][Violin][Kombi]  │  ← tile-header
│            [Ausreisser●]  [⚙]                                             │
├──────────────────────────────────────────────────────────────────┤
│  [bc-cfg-panel] (Overlay, position:absolute, nur wenn ⚙ offen)  │
├──────────────────────────────────────────────────────────────────┤
│  [bc-explanation] (aufklappbar, max-height 0→auto, Transition)  │
├──────────────────────────────────────────────────────────────────┤
│  15d  [▲ +9d ggü. Vorperiode]                       N = 123    │  ← bc-kpi-area
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
- **Titel**: dynamisch je nach aktivem Modus (Lead Time / Cycle Time / Cycle Time sonstige) — siehe Modus-Logik in Block A
- **Modus-Buttons**: `Lead Time` · `Cycle Time` — links vor `inkl. Bug`; aktiver Modus hervorgehoben (`p-blue`); im Sonstige-Zustand keiner hervorgehoben
- **Bug-Toggle**: `inkl. Bug ○` (Standard, deaktiviert) / `inkl. Bug ●` (aktiviert, blau) — rechts neben `Cycle Time`, links vor `Box`; steuert ob Issue-Type Bug in die Berechnung einfließt
- **Ansichts-Buttons**: `Box` · `Violin` · `Kombi` — aktiver Modus hervorgehoben (`p-blue`)
- **Ausreißer-Toggle**: `Ausreisser ●` (an, blau) / `Ausreisser ○` (aus) — ausgeschrieben, kein AUS-JIRA-Badge mehr
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
Liegt **zwischen** Config-Panel und `tile-content`. Wird in `_updateKpiArea()` nach jedem Render befüllt.

| Element | ID | Inhalt |
|---|---|---|
| Headline-Wert | `#bc-kpi-val` | Median der **neuesten** Periode, gerundet: z.B. `15d` |
| Trend-Badge | `#bc-kpi-trend` | Differenz zur Vorperiode: `▲ +Xd` (orange) / `▼ −Xd` (grün) |
| Subtitel | `#bc-kpi-sub` | `P85 · Xd · typischer Fall` |
| N gesamt | `#bc-kpi-n` | `N = 123` — rechts ausgerichtet; Gesamtzahl aller Items mit gültiger Lead Time über alle Perioden; Reset auf `N = –` im Leerzustand |

### Erklärungs-Panel (`#bc-explanation`)
Aufklappbares Panel direkt am Anfang von `contentEl` (position: flow, kein absolute). Klappt auf bei Klick auf „Was zeigt diese Ansicht?" im Footer; schließt bei erneutem Klick. Transition: `max-height 0 → scrollHeight` (0.22s ease). Nach `_render()` (innerHTML-Reset) wird das Element durch `insertBefore` an erster Position zurückgehängt und `max-height` anhand von `_explanationOpen` neu gesetzt.

**Der angezeigte Text wechselt je nach aktivem Modus:**

| Modus | Erklärungs-Text |
|---|---|
| Lead Time | „Zeigt, wie lange ein Ticket vom Moment der Bereitschaft zur Bearbeitung (Ready4Progress) bis zur Fertigstellung (Resolved) braucht. Dieser Wert entspricht der Wartezeit aus Kundensicht – inklusive Liegezeiten im Prozess. Ziel: P85 dauerhaft unter dem vereinbarten SLA halten." |
| Cycle Time | „Zeigt, wie lange ein Ticket ab dem ersten aktiven Bearbeitungsmoment (In Progress) bis zur Fertigstellung (Resolved) braucht. Dieser Wert spiegelt die reine Teamleistung wider, ohne vorgelagerte Wartezeiten in der Queue." |
| Cycle Time sonstige | „Die Durchlaufzeit wird mit benutzerdefinierten Start- und Endspalten berechnet (⚙). Wähle ‚Ready4Progress_first → Resolved' für Lead Time oder ‚In Progress_first → Resolved' für Cycle Time." |

Trend wird nur angezeigt wenn `|diff| >= 1`. Höhere Durchlaufzeit → orange (schlechter), niedrigere → grün.

### Interaktionen

| Aktion | Trigger | Effekt |
|---|---|---|
| Modus Lead Time wählen | Klick auf `Lead Time`-Button im Header | `cfg.ltStart = 'Ready4Progress_first'`, `cfg.ltEnd = 'Resolved'` setzen, speichern, Titel + Button-Hervorhebung aktualisieren, neu rendern |
| Modus Cycle Time wählen | Klick auf `Cycle Time`-Button im Header | `cfg.ltStart = 'In Progress_first'`, `cfg.ltEnd = 'Resolved'` setzen, speichern, Titel + Button-Hervorhebung aktualisieren, neu rendern |
| Ansicht wechseln | Klick auf `Box`/`Violin`/`Kombi` im Header | `cfg.chartMode` setzen, aktiver Button `p-blue`, neu rendern |
| Ausreißer toggle | Klick auf `Ausr.`-Button im Header | `cfg.showOutliers` toggle, Button-Text und `p-blue` aktualisieren |
| ⚙ öffnen/schließen | Klick auf ⚙ | Overlay-Panel ein/aus (`_togglePanel()`) |
| Panel schließen (×) | Klick auf × im Panel | `_closePanel()` |
| Panel schließen (außen) | Klick außerhalb Panel + ⚙-Button | `_closePanel()` via capture-Listener |
| Spalten in ⚙ wählen | `<select>` für ltStart / ltEnd ändern | Modus-Erkennung neu prüfen, Titel + Buttons aktualisieren, Erklärungs-Text wechseln, neu rendern |
| Tooltip Ausreißer | `mouseover` auf `circle.bc-out` | Jira-ID + Issue Type + Durchlaufzeit + Jira-Link (falls URL) |
| Tooltip Box | `mouseover` auf `rect.bc-box-hit` | Median / P85 / P25 / Whisker ↑↓ / n |
| Tooltip schließen | `mouseout` (120ms Delay) | `display:none` |
| Jira-Link klicken | Klick auf Link im Tooltip | `window.open(url, '_blank')` |
| Verteilung ansehen | Klick auf Footer-Link | Aktuelles `ltStart`/`ltEnd` in `fhwa_scatter` (ctStart/ctEnd) schreiben, dann `core.showPage('scatter')` |
| Bug-Toggle | Klick auf `inkl. Bug`-Button | `cfg.includeBug` toggling, Button-Text + `p-blue` aktualisieren, `fhwa_boxchart` speichern, neu rendern |

### Footer (`diag-bar`, umgebaut)
Drei Elemente, einmalig in `_buildFooter()` gesetzt:
- Links: `» Was zeigt diese Ansicht?` (blau, klickbar → `_toggleExplanation()`)
- Mitte: Spacer (flex:1)
- Rechts: `Verteilung ansehen →` (blau, Link → Sync-Mechanismus + `core.showPage('scatter')`)

**Schriftgröße:** `font-size: 11px` (Monospace), angeglichen an WIP-Visual.

**Sync-Mechanismus „Verteilung ansehen →":**  
Beim Klick:
1. Scatterplot-Config laden: `const sc = core.load('fhwa_scatter', scatterDefaults)`
2. `sc.ctStart = cfg.ltStart; sc.ctEnd = cfg.ltEnd`
3. `core.save('fhwa_scatter', sc)` — überschreibt nur ctStart/ctEnd, alle anderen Scatter-Einstellungen bleiben erhalten
4. `core.showPage('scatter')` — Scatterplot liest beim nächsten Render-Event seine Config neu

### Leerzustand
Keine Daten / alle Items herausgefiltert / ltStart oder ltEnd nicht gefunden → zentrierte Meldung in `contentEl`, KPI-Bereich zeigt `–`.

### Responsive
SVG 100 % Breite/Höhe des `contentEl`. Boxbreite, Schriftgröße, Ausreißer-Radius skalieren mit Container.

---

## D – Berechnungslogik

### Preset-Erkennung (Modus-Logik)
Wird nach jedem Config-Load und nach jeder ltStart/ltEnd-Änderung aufgerufen:

```javascript
function _detectMode(ltStart, ltEnd) {
  if (ltStart === 'Ready4Progress_first' && ltEnd === 'Resolved') return 'lt';
  if (ltStart === 'In Progress_first'   && ltEnd === 'Resolved') return 'ct';
  return 'custom';
}
```

Preset-Werte:
| Modus | ltStart | ltEnd |
|---|---|---|
| Lead Time (`'lt'`) | `Ready4Progress_first` | `Resolved` |
| Cycle Time (`'ct'`) | `In Progress_first` | `Resolved` |

Der Modus-Wert wird **nicht** in localStorage gespeichert — er wird immer live aus `cfg.ltStart` + `cfg.ltEnd` abgeleitet.

### Bug-Filterlogik

Wird nach `core.filteredRows()` angewendet und hat absolute Priorität über den globalen Issue-Type-Filter:

```javascript
function _applyBugFilter(rows) {
  if (cfg.includeBug) return rows;
  return rows.filter(r => {
    const t = (r['Issue Type'] || r['IssueType'] || r['Type'] || r['issue_type'] || '').trim().toLowerCase();
    return t !== 'bug';
  });
}
```

- `cfg.includeBug === false` (Default): Alle Rows mit Issue-Type `'bug'` werden entfernt — unabhängig davon ob der globale Filter `core.state.issueTypeFilter` Bug einschließt.
- `cfg.includeBug === true`: Keine zusätzliche Filterung — der globale Filter aus `index.html` greift vollständig (Bug erscheint nur wenn er nicht global herausgefiltert ist).

Issue-Type-Spalte: Fallback-Reihenfolge `Issue Type` → `IssueType` → `Type` → `issue_type` (identisch zum Ausreißer-Tooltip in Block B).

### Durchlaufzeit pro Item
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
| `includeBug` | bool | `false` | Bug-Issues einschließen (lokaler Button hat Vorrang über globalen Issue-Type-Filter) |

### Migration
Beim ersten Laden wird ein gespeicherter `bandwidth`-Wert (Altformat) automatisch in `smoothing: true/false` konvertiert (`bandwidth > 2 → true`) und aus localStorage entfernt. Fehlende `yStep`/`yLog`-Werte werden mit Defaults befüllt.

---

## F – Design-Standards (Pflichtcheck)

| Standard | Entscheidung | Details |
|---|---|---|
| Tooltip boundary-safe | ✅ | `_posTt()` mit Overflow-Prüfung (position:fixed) |
| Tooltip mit Links | ✅ | Hover-Delay 120ms + `pointerEvents:all` wenn URL vorhanden |
| N-Anzeige Chart | ✅ | `n=XX` unter jeder Iterationsbeschriftung (X-Achse) |
| N-Anzeige KPI | ✅ | `#bc-kpi-n` rechts im KPI-Bereich: Gesamtzahl aller Items mit gültiger LT |
| KPI-Bereich | ✅ | `#bc-kpi-area` zwischen Config-Panel und Chart |
| Footer statt Diag-Text | ✅ | `_buildFooter()` einmalig, nie überschrieben |
| Erklärungs-Panel | ✅ | `#bc-explanation` aufklappbar via `_toggleExplanation()` |
| Reihenfolge-Panel | — | nicht benötigt (chronologisch fest) |
| Skalierung | ✅ | SVG 100%/100%, Padding reduziert für kompakte Tile-Höhe |
| Dark/Light Theme | ✅ | `core.scatterColors()` + CSS-Variablen |
| Link-Feature | ✅ | `core.state.urlTemplate` + `{issueKey}`, `window.open()` |
| Panel-Overlay | ✅ | `position:absolute` in `contentEl` → Header/KPI nie überdeckt, keine Breitenänderung |
| Panel schließen | ✅ | ⚙-Toggle + × Schließen-Button + Klick-außerhalb (capture-Listener) |
| AUS-JIRA-Badge | entfernt | mehr Platz für Header-Buttons |

---

## G – Akzeptanzkriterien

### Automatisch prüfbar
- [ ] `core.filteredRows()` einziger Datenzugriff (kein `core.state.rows`)
- [ ] localStorage-Key `fhwa_boxchart`
- [ ] Keine hardcodierten Farben im Code

### Bug-Toggle
- [ ] Start: `inkl. Bug`-Button ist deaktiviert (○, kein `p-blue`) — Default `cfg.includeBug = false`
- [ ] Klick auf `inkl. Bug` → Button zeigt ● (`p-blue`), Bug-Items erscheinen im Chart, N-Wert ändert sich
- [ ] Erneuter Klick → Button zeigt ○, Bug-Items verschwinden wieder
- [ ] `cfg.includeBug = false` + globaler Issue-Type-Filter enthält `Bug` → Bug trotzdem ausgeschlossen (lokaler Button hat Vorrang)
- [ ] `cfg.includeBug = true` + globaler Filter leer (= alle) → Bugs erscheinen im Chart
- [ ] `cfg.includeBug = true` + globaler Filter enthält nur `Story` → nur Stories erscheinen (globaler Filter greift dann)
- [ ] State überlebt Browser-Reload (`fhwa_boxchart.includeBug`)

### Modus-Buttons
- [ ] Start: `Lead Time`-Button ist hervorgehoben (Default-Config = LT-Preset)
- [ ] Klick auf `Cycle Time` → Titel wechselt auf „Cycle Time", Button-Hervorhebung wechselt, Erklärungs-Text wechselt, Config-Änderung überlebt Browser-Reload
- [ ] Klick auf `Lead Time` → Titel wechselt zurück auf „Lead Time"
- [ ] ltStart/ltEnd manuell im ⚙-Panel auf andere Werte setzen → Titel wechselt auf „Cycle Time sonstige", kein Button hervorgehoben
- [ ] Erklärungs-Text „Was zeigt diese Ansicht?" zeigt korrekten Text für LT / CT / Sonstige
- [ ] „Verteilung ansehen →" klicken → Scatter-Page öffnet sich mit passendem ctStart/ctEnd (im Scatter-⚙ nachprüfen)

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
| 2026-06-19 | 1.6 | AUS-JIRA-Badge entfernt; „Ausr." → „Ausreisser" ausgeschrieben; N = x (Gesamt) rechts im KPI-Bereich (`#bc-kpi-n`); „Was zeigt diese Ansicht?" als aufklappbares Panel (`#bc-explanation`, max-height Transition) |
| 2026-06-20 | 1.7 | Lead-Time/Cycle-Time-Modus-Buttons im Header (links vor Box/Violin/Kombi); Titel-Wechsel per Preset-Erkennung (3 Zustände: LT / CT / CT sonstige); Erklärungs-Text je Modus; Sync-Mechanismus „Verteilung ansehen →" schreibt ltStart/ltEnd in fhwa_scatter |
| 2026-06-20 | 1.8 | Bug-Ausschluss: Issue-Type Bug per Default ausgeschlossen; Toggle-Button „inkl. Bug" im Header (rechts neben Cycle Time, links vor Box); lokaler Button hat absolute Priorität über globalen Issue-Type-Filter; `cfg.includeBug` in `fhwa_boxchart` persistiert |
| 2026-06-20 | 1.9 | Footer-Schriftgröße: `font-size` von `.6rem` auf `11px` angeglichen (Block C) |
