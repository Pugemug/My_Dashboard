# CycleTime Scatterplot – Spezifikation (SDD)

**Version:** 1.2  
**Datum:** 2026-06-20  
**Status:** [x] Entwurf → [ ] Bestätigt (Gate 1) → [x] Implementiert (`scatter.js` v2.1+)

> Diese SDD wurde nachträglich aus dem implementierten Code (`scatter.js`) und dem
> Übergabedokument (`FlowAnalytics_Dashboard_Uebergabe.md`) rekonstruiert.
> Sie gilt als Baseline für alle künftigen Änderungen.

---

## A – Zweck & Abgrenzung

### Was das Visual macht
Der Scatterplot zeigt die Durchlaufzeit (CT) jedes einzelnen Work Items als Punkt über der Zeitachse (X = Fertigstellungsdatum, Y = CT in Tagen). Vier konfigurierbare Perzentil-Linien (P50, P70, P85, P95) machen Trends und Ausreißer auf einen Blick sichtbar. Drei Farb-Modi (einfarbig, Issue-Type, Heatmap) ermöglichen unterschiedliche Analyseebenen. Ein klickbarer Jira-Link im Tooltip führt direkt zum betroffenen Item.

**Modus-Logik (Lead Time / Cycle Time / Cycle Time sonstige):**  
Identische Logik wie im LeadTime BoxChart (Spec `LeadTime_BoxChart.md` Block A). Der Titel und die Header-Buttons wechseln je nach gewähltem ctStart/ctEnd:

| Modus | ctStart | ctEnd | Titel | Buttons |
|---|---|---|---|---|
| Lead Time | `Ready4Progress_first` | `Resolved` | `Lead<span class="hl">Time</span>` | Lead Time hervorgehoben |
| Cycle Time | `In Progress_first` | `Resolved` | `Cycle<span class="hl">Time</span>` | Cycle Time hervorgehoben |
| Cycle Time sonstige | (beliebig) | (beliebig) | `Cycle Time <span class="hl">sonstige</span>` | keiner hervorgehoben |

**Sync vom BoxChart:** Wenn der Nutzer im BoxChart auf „Verteilung ansehen →" klickt, werden `ctStart` und `ctEnd` in `fhwa_scatter` überschrieben. Der Scatterplot liest beim nächsten Render-Event seine Config neu aus localStorage und passt Titel, Buttons und Berechnung entsprechend an.

### Was es NICHT macht
- Kein Cross-Filter zwischen Visuals (nur globaler Squad-Filter über `core`)
- Keine DAX-Berechnungen, keine serverseitige Aggregation
- Kein Drill-Through, kein Reihenfolge-Panel
- Kein Power BI – ausschließlich standalone HTML (Web-App)
- Keine Darstellung noch aktiver (offener) Items – nur abgeschlossene Items mit `ctEnd`-Datum

### Technologie
[ ] pbiviz (TypeScript + Power BI Custom Visual)  
[x] Web-App (.js + core.js, standalone HTML)

---

## B – Datenmodell

### Web-App: Excel-Spalten

| Spaltenname | Typ | Pflicht? | Erkennungslogik | Fallback wenn fehlt |
|---|---|---|---|---|
| `Jira-ID` | Text | ✅ | Name exakt (`META_COLS`) | `key = ''`, kein Link |
| `[ctEnd]` | Datum | ✅* | Konfigurierbar, Default: `Resolved` | Visual zeigt „Keine Daten" |
| `[ctStart]` | Datum | optional | Konfigurierbar, Default: `In Progress_first` | CT nicht berechenbar → Item übersprungen |
| `Issue-Type` | Text | optional | `core.state.hasIssueType` | Farb-Modus „Typ" deaktiviert |
| `Squad` | Text | optional | `core.state.hasSquad` | Globaler Filter hat keinen Effekt |

\* `ctEnd` ist Pflicht für die Darstellung; ohne `ctStart` kann die CT nicht berechnet werden
(Item wird dann übersprungen).

### Datumsstrategie
[x] Nicht anwendbar – Web-App liest Datumsspalten direkt aus Excel-Zeilen via `core.toDate()`.
Nutzer wählt `ctStart` und `ctEnd` aus allen erkannten Datumsspalten (`core.state.dateCols`).

---

## C – UX & Layout

### Hauptbereiche (ASCII-Sketch)

```
┌──────────────────────────────────────────────────────────────┐
│  Card-Header: Titel · [Lead Time|Cycle Time] ·               │
│               [Einfarbig|Typ|Heatmap] · [Wo|Mo|Q]            │
│               [⚙ Einstellungen]                              │
├──────────────────────────────────────────────────────────────┤
│  [⚙ Einstellungen-Panel – nur wenn offen]                    │
│  ┌ ⚙ Berechnungslogik ──────────────────────────────────┐   │
│  │  CT Start: [select]   CT Ende (X-Achse): [select]    │   │
│  │  Dot-Größe: – 4 +                                    │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌ % Linien ────────────────────────────────────────────┐   │
│  │  ☑ P50 [color]  ☑ P70 [color]                       │   │
│  │  ☑ P85 [color]  ☑ P95 [color]                       │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌ 🎨 Farb-Konfiguration ───────────────────────────────┐   │
│  │  Einfarbig: [color]  · Issue-Type-Farben             │   │
│  └──────────────────────────────────────────────────────┘   │
├──────────────────────────────────────────────────────────────┤
│  SVG-Plotbereich (100% × 100% des contentEl)                 │
│   ┌─────────────────────────────────────────────────────┐    │
│   │  n=…  (oben links im Plot)                          │    │
│   │                                                     │    │
│   │  Y-Achse: CT (Tage)   ·   Dots   ·   P-Linien      │    │
│   │                                                     │    │
│   │  X-Achse: Fertigstellungsdatum (Wo/Mo/Q-Ticks)      │    │
│   │  Legende oben rechts (nur Farb-Modus "Typ")         │    │
│   └─────────────────────────────────────────────────────┘    │
├──────────────────────────────────────────────────────────────┤
│  Diag-Bar (immer sichtbar, 1 Zeile)                          │
└──────────────────────────────────────────────────────────────┘
```

Margins SVG: `ML=50 MR=88 MT=20 MB=44` (Pixel, fest).  
Default-Grid-Position: `{ col: 8, row: 0, w: 4, h: 12 }`.

### Interaktionen

| Aktion | Trigger | Effekt |
|---|---|---|
| Tooltip anzeigen | `mouseenter` auf Dot | Tooltip mit Jira-ID, CT, Datum, Typ, Link erscheint (boundary-safe) |
| Tooltip bewegen | `mousemove` auf Dot | `_posTooltip()` aktualisiert Position |
| Tooltip ausblenden | `mouseleave` Dot (130 ms Delay) | `display:none` — Delay erlaubt Mausbewegung zum Tooltip |
| Tooltip halten | `mouseenter` auf Tooltip | Delay-Timer gestoppt (`clearTimeout`) |
| Jira-Link öffnen | Click auf `↗ [Key] öffnen` im Tooltip | `window.open(url, '_blank')` |
| Modus Lead Time wählen | Klick auf `Lead Time`-Button im Header | `cfg.ctStart = 'Ready4Progress_first'`, `cfg.ctEnd = 'Resolved'` setzen, speichern, Titel + Button-Hervorhebung aktualisieren, neu rendern |
| Modus Cycle Time wählen | Klick auf `Cycle Time`-Button im Header | `cfg.ctStart = 'In Progress_first'`, `cfg.ctEnd = 'Resolved'` setzen, speichern, Titel + Button-Hervorhebung aktualisieren, neu rendern |
| Spalten in ⚙ wählen | `<select>` für ctStart / ctEnd ändern | Modus-Erkennung neu prüfen, Titel + Buttons aktualisieren, neu rendern |
| Farb-Modus wechseln | Toggle-Gruppe im Header | Neurender, Farbzuordnung aktualisiert |
| Intervall wechseln | Toggle-Gruppe im Header | X-Achsen-Ticks neu berechnet |
| Panel öffnen/schließen | `⚙ Einstellungen`-Button im Header | Panel `.open` toggled; Neurender nach 20 ms |
| Spalten-Auswahl | `<select>` im Abschnitt „⚙ Berechnungslogik" | `cfg.ctStart` / `cfg.ctEnd` gesetzt, gespeichert, Neurender |
| Dot-Größe ändern | `–` / `+` im Abschnitt „⚙ Berechnungslogik" | `cfg.dotSize` ±1, Bereich 2–12, Neurender |
| Perzentil-Toggle | Checkbox im Abschnitt „% Linien" | Linie ein-/ausgeblendet, Neurender |
| Perzentil-Farbe | Color-Input im Abschnitt „% Linien" | Linienfarbe geändert, Neurender |
| Typ-Farbe | Color-Input im Abschnitt „🎨 Farb-Konfiguration" | Dot-Farbe für diesen Issue-Type geändert, Neurender |

### Leerzustand

| Situation | Anzeige |
|---|---|
| Keine Excel-Datei geladen | `.sc-nodata` mit „Keine Daten" + „Berechnungslogik unter ⚙ Einstellungen konfigurieren" |
| `ctEnd` nicht gesetzt | Wie oben |
| `ctEnd` gesetzt, aber 0 gültige Items | „Keine Items mit [ctEnd]-Datum" |
| Visual kleiner als 20×20 px | SVG geleert, kein Render |

### Responsive-Verhalten

- SVG füllt `contentEl` (100% × 100%, `position:absolute;inset:0`)
- Dot-Radius skaliert: `Math.max(1.5, Math.min(cfg.dotSize ?? 4, pW / 60))`
- X-Tick-Dichte begrenzt: `maxXTk = Math.max(2, Math.floor(pW / 55))`
- Y-Tick-Stufen: `_niceYTicks()` wählt aus `[1,2,5,10,15,20,25,50,75,100,150,200,250,500]`
- Margins (ML/MR/MT/MB) sind fest – bei sehr kleiner Breite kann Plot-Breite auf `max(1, …)` fallen

---

## D – Berechnungslogik

### Preset-Erkennung (Modus-Logik)
Identische Logik wie im BoxChart — wird nach jedem Config-Load und nach jeder ctStart/ctEnd-Änderung aufgerufen:

```javascript
function _detectMode(ctStart, ctEnd) {
  if (ctStart === 'Ready4Progress_first' && ctEnd === 'Resolved') return 'lt';
  if (ctStart === 'In Progress_first'   && ctEnd === 'Resolved') return 'ct';
  return 'custom';
}
```

**Sync-Empfang vom BoxChart:**  
Der Scatterplot liest seinen Config-State beim `data`-, `filter`- und `settings`-Event aus localStorage. Wenn BoxChart vor dem Page-Wechsel `fhwa_scatter.ctStart`/`ctEnd` überschrieben hat, liest der Scatterplot diese beim nächsten Render-Aufruf automatisch. Kein zusätzlicher Event-Mechanismus nötig — der Scatterplot muss jedoch sicherstellen, dass er `cfg` beim Render-Aufruf **aus localStorage** lädt (nicht gecacht aus dem Arbeitsspeicher der Initialisierungsphase).

> **Implementierungshinweis:** Beim `settings`-Event `cfg` neu aus `core.load('fhwa_scatter', defaults)` einlesen, damit der BoxChart-Sync wirkt.

### Kern-Metriken

| Metrik | Formel | Einheit | Besonderheiten |
|---|---|---|---|
| Cycle Time (CT) | `(endDate − startDate) / 86400000 + 1` | Tage | Inklusiv; konsistent mit `core.dur()` |
| P50 | `core.pct(ctVals, 50)` | Tage | Aus sortierten CT-Werten aller gefilterten Items |
| P70 | `core.pct(ctVals, 70)` | Tage | Wie P50 |
| P85 | `core.pct(ctVals, 85)` | Tage | Wie P50 |
| P95 | `core.pct(ctVals, 95)` | Tage | Wie P50 |
| maxCT (Y-Max) | `ctVals[last] × 1.1` | Tage | 10 % Puffer über dem Maximum |

### Filter- & Aggregationslogik

- Eingabe: `core.filteredRows()` (Squad-Filter bereits angewendet)
- Item wird übersprungen wenn: `endDate` fehlt (kein ctEnd-Datum) oder `ct < 1`
- Wenn `ctStart == ctEnd` oder `ctStart` leer: `ct = null` → Item übersprungen
- Kein weiteres Filtern nach Status oder Zeitraum (alle abgeschlossenen Items sichtbar)

### Edge Cases

| Situation | Verhalten |
|---|---|
| `ctEnd`-Spalte nicht gesetzt | Nodata-Zustand, kein JS-Fehler |
| `ctStart` fehlt / leer | CT nicht berechenbar → Item übersprungen, N sinkt |
| `ct < 1` (Start = Ende oder falsches Datum) | Item ausgeschlossen |
| 0 Items nach Filter | Nodata-State mit kontextspezifischer Meldung |
| `maxCT = 0` (nur 1 Item mit ct=0) | `yS()` Division durch 0 vermieden durch `* 1.1` (→ 0), Dot landet bei MT |
| `Math.max(...leeres Array)` | Nicht möglich: `items.length > 0` wird vor Scale-Berechnung geprüft |
| `core.state.urlTemplate` leer | `url = ''`, `pointerEvents: none`, kein Link im Tooltip |
| Issue-Type fehlt für ein Item | `type = ''`, fällt in `_typeColorFor('')` → `core.palette()[0]` |
| P-Linie > maxCT | Linie wird nicht gerendert (`val > maxCT` → skip) |

---

## E – Config / Format-Panel

### Alle Properties (gespeichert unter `localStorage`-Key `fhwa_scatter`)

| Property | Typ | Default | Min | Max | Effekt | Validierung |
|---|---|---|---|---|---|---|
| `colorMode` | `'single' \| 'issueType' \| 'heatmap'` | `'single'` | – | – | Dot-Farb-Strategie | Toggle-Gruppe |
| `interval` | `'week' \| 'month' \| 'quarter'` | `'month'` | – | – | X-Achsen-Tick-Intervall | Toggle-Gruppe |
| `ctStart` | string (Spaltenname) | `'In Progress_first'` | – | – | CT-Startdatum | Muss in `dateCols` enthalten sein; Fallback: erstes dateCols |
| `ctEnd` | string (Spaltenname) | `LT_END_DEFAULT` | – | – | CT-Enddatum + X-Position | Pflicht; Fallback: zweites dateCols |
| `dotSize` | number | `4` | `2` | `12` | Basis-Radius (skaliert mit pW) | Integer-Schritte via ±-Buttons |
| `singleColor` | string (hex) | `'#38bdf8'` | – | – | Dot-Farbe im Modus „Einfarbig" | `<input type="color">` |
| `typeColors` | `{ [type: string]: string }` | `{}` | – | – | Pro-Typ-Farben im Modus „Typ" | Auto-befüllt aus `core.palette()` |
| `show50` | boolean | `true` | – | – | P50-Linie ein/aus | Checkbox |
| `color50` | string (hex) | `'#22d3ee'` | – | – | P50-Linienfarbe | `<input type="color">` |
| `show70` | boolean | `true` | – | – | P70-Linie ein/aus | Checkbox |
| `color70` | string (hex) | `'#86efac'` | – | – | P70-Linienfarbe | `<input type="color">` |
| `show85` | boolean | `true` | – | – | P85-Linie ein/aus | Checkbox |
| `color85` | string (hex) | `'#fbbf24'` | – | – | P85-Linienfarbe | `<input type="color">` |
| `show95` | boolean | `true` | – | – | P95-Linie ein/aus | Checkbox |
| `color95` | string (hex) | `'#f87171'` | – | – | P95-Linienfarbe | `<input type="color">` |

### Storage
`localStorage`-Key: `fhwa_scatter`  
Gespeicherter State: alle 15 Properties aus der Tabelle oben als JSON-Objekt.  
Geladen via `core.load('fhwa_scatter', defaults)`, gespeichert via `core.save('fhwa_scatter', cfg)`.

---

## F – Design-Standards (§9-Pflichtcheck)

| Standard | Entscheidung | Details |
|---|---|---|
| Tooltip boundary-safe | ✅ Pflicht | `position:fixed` + `_posTooltip(cx, cy)` mit Overflow-Prüfung gegen `window.innerWidth/Height` |
| Tooltip mit Links | ✅ Ja | Hover-Delay 130ms + `pointerEvents: all` wenn `item.url` gesetzt |
| N-Anzeige | ✅ Pflicht | SVG-Text oben links im Plotbereich: `n = ${items.length}` (+ Typ-Aufschlüsselung wenn ≤ 5 Typen) |
| Reihenfolge-Panel | – nicht benötigt | Keine Kategorie-Reihenfolge (Items sind individuelle Punkte) |
| Skalierung | ✅ Pflicht | Dot-Radius: `Math.max(1.5, Math.min(cfg.dotSize ?? 4, pW / 60))` |
| Diagnosemodus | ✅ Pflicht, immer an | 1 Zeile, Inhalt: `n · CT: Start → Ende · P50 · P85 · Farbe · Intervall` |
| Icon | – nicht anwendbar | Web-App, kein pbiviz-Icon |
| Link-Feature | ✅ Ja | `core.state.urlTemplate.replace('{issueKey}', key)` → `window.open(url, '_blank')` (kein `host.launchUrl`) |
| innerHTML | ⚠ Erlaubt (Browser-Kontext) | `svgEl.innerHTML = parts.join('')` — kein ESLint/pbiviz-Verbot; Tooltip-DOM via `createElement/textContent` |
| Dark/Light Theme | ✅ CSS-Variablen | Farben via `core.scatterColors()` (`C.plotBg`, `C.axisLine`, `C.gridLine`, etc.) und `core.lerp()` (Heatmap) |
| Einstellungsmenü | ✅ Einheitlich | Einzelner `⚙ Einstellungen`-Button; Panel mit 3 Abschnitten: ⚙ Berechnungslogik · % Linien · 🎨 Farb-Konfiguration |

---

## G – Akzeptanzkriterien

### Modus-Buttons (manuell)
- [ ] Start nach BoxChart-Sync (LT-Modus): `Lead Time`-Button hervorgehoben, Titel „Lead Time"
- [ ] Klick auf `Cycle Time` im Scatter → Titel wechselt auf „Cycle Time", Button-Hervorhebung wechselt, Config überlebt Browser-Reload
- [ ] ctStart/ctEnd manuell im ⚙-Panel auf andere Werte setzen → Titel wechselt auf „Cycle Time sonstige", kein Button hervorgehoben
- [ ] BoxChart: Lead-Time-Modus aktiv → „Verteilung ansehen →" klicken → Scatter öffnet sich mit `Lead Time`-Button hervorgehoben
- [ ] BoxChart: Cycle-Time-Modus aktiv → „Verteilung ansehen →" klicken → Scatter öffnet sich mit `Cycle Time`-Button hervorgehoben

### Automatisch von Claude prüfbar

- [ ] `scatter.js` lädt ohne JS-Fehler in der Browser-Console
- [ ] `cfg` wird korrekt aus `localStorage` geladen und nach Änderung persistiert (Page-Reload)
- [ ] `ctStart` und `ctEnd` werden nach Datenload auf gültige Spalten validiert (Fallback greift)
- [ ] Items mit `ct < 1` erscheinen nicht im Plot
- [ ] `svgEl.innerHTML` wird bei `W < 20 || H < 20` geleert (kein Render)
- [ ] `core.on('data' | 'theme' | 'filter' | 'resize' | 'settings')` alle abonniert

### Manuell durch Oliver zu testen

- [ ] Tooltip bleibt vollständig sichtbar an allen 4 Ecken des Visuals (besonders unten rechts)
- [ ] Tooltip-Hover-Delay: Maus vom Dot auf Tooltip bewegen ohne dass er verschwindet
- [ ] Jira-Link im Tooltip öffnet den richtigen URL in neuem Tab
- [ ] Config-State (Farb-Modus, Perzentil-Farben, ctStart/ctEnd) überlebt Browser-Reload
- [ ] Alle 3 Farb-Modi (Einfarbig / Typ / Heatmap) rendern korrekt und ohne Fehler
- [ ] Issue-Type-Legende erscheint nur im Modus „Typ" und zeigt alle Typen
- [ ] Visual auf 200 px Breite → Dot-Radius sinkt proportional, kein Überlappen mit Y-Achse
- [ ] Bei 0 Datenzeilen: Nodata-Meldung sichtbar, Diag-Bar zeigt „Keine Daten", kein JS-Fehler
- [ ] Intervall-Wechsel (Wo/Mo/Q) aktualisiert X-Achsen-Ticks korrekt
- [ ] Globaler Squad-Filter (Topbar) wirkt auf Scatter-Plot (N und Punkte ändern sich)

---

## Änderungshistorie

| Datum | Version | Änderung | Bestätigt von |
|---|---|---|---|
| 2026-06-03 | 1.0 | Initiale Spec – retrograd aus `scatter.js` v2.0 rekonstruiert | – |
| 2026-06-11 | 1.1 | CT Start Default: `Ready4Progress_first` → `In Progress_first`; ⚙ Spalten → ⚙ Berechnungslogik; drei Header-Buttons zu einheitlichem ⚙ Einstellungen-Panel zusammengefasst | Oliver |
| 2026-06-20 | 1.2 | Lead-Time/Cycle-Time-Modus-Buttons im Header (links vor Farb-/Intervall-Toggles); Titel-Wechsel per Preset-Erkennung (3 Zustände: LT / CT / CT sonstige); Sync-Empfang von BoxChart via localStorage fhwa_scatter | Oliver |

---

*Autor: Oliver Wolter · Erstellt mit Claude Sonnet*
