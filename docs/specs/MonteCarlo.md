# Monte Carlo Simulation – Spezifikation (SDD)

**Version:** 1.0
**Datum:** 2026-06-11
**Status:** [ ] Entwurf → [x] Bestätigt (Gate 1) → [x] Implementiert

---

## A – Zweck & Abgrenzung

### Was das Visual macht

Das Monte Carlo Visual beantwortet zwei Vorhersage-Fragen:

1. **„Bis wann fertig?"** – Wann werden N Issues mit welcher Wahrscheinlichkeit abgeschlossen sein?
2. **„Wie viele bis Datum X?"** – Wie viele Issues werden bis zu einem gegebenen Datum fertig sein?

Die Simulation basiert auf dem historischen Throughput (abgeschlossene Issues pro Zeiteinheit), zieht zufällige Stichproben daraus und erzeugt eine Häufigkeitsverteilung möglicher Ergebnisse. Ein integrierter Stabilitäts-Check bewertet, ob das System stabil genug ist, dass die Simulation verlässliche Ergebnisse liefert.

### Was es NICHT macht

- Kein Cross-Filter zwischen Visuals (nur globaler Squad-Filter über `core`)
- Kein Jira-Link / URL-Feature
- Keine Einzel-Item-Prognosen (kein Cycle-Time-basiertes MC)
- Keine serverseitige Berechnung – alles im Browser-JS
- Kein Power BI – ausschließlich Web-App

### Technologie

[ ] pbiviz  
[x] Web-App (.js + core.js, standalone HTML)

---

## B – Datenmodell

### Excel-Spalten

| Spaltenname | Typ | Pflicht? | Erkennungslogik | Fallback wenn fehlt |
|---|---|---|---|---|
| `Resolved` | Datum | ✅ | Name exakt (`cfg.completedCol`, Default: `Resolved`) | Visual zeigt „Keine Daten" |
| `Squad` | Text | optional | `core.state.hasSquad` | Globaler Filter hat keinen Effekt |
| `Jira-ID` | Text | optional | Meta-Spalte, für Diagnoseanzeige | Kein N-Detail im Diag |

### Datenquelle

Sheet: **`JiraStories`** (über `core.state.rows` / `core.filteredRows()`)

### Throughput-Berechnung

```
1. Filterperiode: Issues deren cfg.completedCol-Datum im Berechnungszeitraum liegt
2. Aggregation in Zeitscheiben (cfg.throughputUnit: 'day' | 'week' | 'month')
3. Ergebnis: Array von Integer-Werten – z.B. [3, 5, 2, 7, 4, …] (Issues pro Woche)
4. Nullscheiben werden als Messwert 0 behalten (wichtig für CV-Berechnung)
```

### Erkennungslogik der Datumsspalte

Nutzer wählt aus `core.state.dateCols` im Config-Panel. Default: `Resolved`.

---

## C – UX & Layout

### Seitenplatzierung

Neue Deep-Dive-Page `monte` in der Sidebar.

| Page | Sidebar-Label | Visual |
|---|---|---|
| `monte` | Monte Carlo | MonteCarlo Card |

### Hauptbereiche (ASCII-Sketch)

```
┌──────────────────────────────────────────────────────────────────┐
│ Card-Header:                                                     │
│   Titel: Monte<hl>Carlo</hl>                                    │
│   [Bis wann fertig? | Wie viele bis X?]   [⚙ Einstellungen]     │
├──────────────────────────────────────────────────────────────────┤
│ [Stabilitäts-Bereich – immer sichtbar, kompakt, 1 Zeile]        │
│   🟢/🟡/🔴  CV: 0.42 · stabil  [Trendchart – Sparkline rechts] │
├──────────────────────────────────────────────────────────────────┤
│ [Eingabe-Bereich]                                               │
│   Modus "Bis wann":  [Anzahl Issues: ___]  [Simulation starten] │
│   Modus "Wie viele": [Zieldatum: ___    ]  [Simulation starten] │
├──────────────────────────────────────────────────────────────────┤
│ [Ergebnis-Bereich – nach Simulation]                            │
│   ┌──────────────────────────────┐  ┌─────────────────────────┐ │
│   │  Histogramm (SVG)            │  │  Perzentil-Tabelle      │ │
│   │  X: Datum | Issue-Anzahl     │  │  P50  │ Wert            │ │
│   │  Y: Häufigkeit               │  │  P70  │ Wert            │ │
│   │  P-Linien: P50/P70/P85/P95   │  │  P85  │ Wert            │ │
│   │  Hover → Tooltip mit Detail  │  │  P95  │ Wert            │ │
│   └──────────────────────────────┘  └─────────────────────────┘ │
├──────────────────────────────────────────────────────────────────┤
│ Diag-Bar (immer sichtbar)                                       │
└──────────────────────────────────────────────────────────────────┘
```

Layout: Histogramm nimmt ca. 65% der Breite, Tabelle 35%.  
Default-Grid-Position: `{ col: 0, row: 0, w: 8, h: 14 }`.

### Einstellungs-Panel (⚙)

```
┌─────────────────────────────────────┐
│ ⚙ Einstellungen              [×]   │
├─────────────────────────────────────┤
│ Berechnungszeitraum (MC-Basis)      │
│   Rolling: [___] Tage               │
│   ── oder ──                        │
│   Von: [Datum]  Bis: [Datum]        │
│                                     │
│ Beurteilungszeitraum (Stabilität)   │
│   Rolling: [___] Tage               │
│   ── oder ──                        │
│   Von: [Datum]  Bis: [Datum]        │
│                                     │
│ Throughput-Aggregation              │
│   [Täglich | Wöchentlich | Monatl.] │
│                                     │
│ Fertig-Spalte: [Dropdown dateCols]  │
│ Simulationsläufe: [___] (500–10000) │
└─────────────────────────────────────┘
```

### Toggle-Verhalten

- Toggle sitzt im Card-Header: `[Bis wann fertig?] [Wie viele bis X?]`
- Beim Umschalten: Eingabe-Feld wechselt, Ergebnis wird geleert (neue Simulation nötig)
- Aktiver Modus: hervorgehobene Schaltfläche (wie bestehende Toggle-Gruppen in scatter.js)

### Stabilitäts-Bereich (immer sichtbar)

- Zeigt Ampel-Icon + CV-Wert + kurzen Label-Text
- Rechts daneben: Sparkline-Trendchart (Mini-Balkendiagramm des Throughputs über den Beurteilungszeitraum)
- Berechnung basiert auf **Beurteilungszeitraum** (unabhängig vom Berechnungszeitraum)
- Ampel-Schwellen (konfigurierbar über SDD-Block E):
  - 🟢 Stabil:    CV ≤ 0,5
  - 🟡 Volatil:   CV 0,5–0,8
  - 🔴 Instabil:  CV > 0,8
- Tooltip auf Ampel: Erklärt CV-Formel und zeigt n (Anzahl Zeitscheiben im Beurteilungszeitraum)

### Histogramm

- X-Achse: mögliche Fertigstellungsdaten (Modus „Bis wann") oder mögliche Issue-Anzahlen (Modus „Wie viele")
- Y-Achse: absolute Häufigkeit der Simulationsläufe
- Balken: einfarbig (CSS-Variable `--blue`), Hover-State: hervorgehoben
- Hover-Tooltip auf Balken: Wert (Datum / Anzahl) + Häufigkeit + kumulierte Wahrscheinlichkeit
- Perzentil-Linien: P50 / P70 / P85 / P95 als vertikale Linien mit Label
- Farben der P-Linien: konfigurierbar (identisches Muster wie scatter.js)

### Perzentil-Tabelle

| Spalte | Inhalt |
|---|---|
| Perzentil | P50 / P70 / P85 / P95 |
| Wert | Datum (Modus „Bis wann") oder Anzahl Issues (Modus „Wie viele") |
| Wahrsch. | Prozentwert |

Tabelle ist read-only, kein Sortieren.

### Leerzustand

| Situation | Anzeige |
|---|---|
| Keine Excel geladen | „Keine Daten – bitte Excel-Datei laden" |
| `completedCol` nicht in dateCols | „Spalte '[Name]' nicht gefunden – bitte Einstellungen prüfen" |
| 0 Issues im Berechnungszeitraum | „Keine abgeschlossenen Issues im gewählten Zeitraum" |
| Simulation noch nicht gestartet | Histogramm-Bereich: „Eingabe ausfüllen und Simulation starten" (Platzhalter) |

### Responsive

- SVG-Histogramm füllt seinen Container (100% × 100%)
- Tabelle: feste Mindestbreite 180 px; bei sehr kleinem Container werden Tabelle und Histogramm untereinander gestapelt (flex-direction: column wenn Breite < 500 px)
- Stabilitäts-Sparkline: skaliert mit verfügbarer Breite

---

## D – Berechnungslogik

### Throughput-Berechnung

```
1. rows = core.filteredRows()
2. Filtere auf rows wo completedDate im Berechnungszeitraum liegt
3. Erzeuge Zeitscheiben-Array (je nach throughputUnit: Tag/Woche/Monat)
4. Zähle abgeschlossene Issues pro Zeitscheibe → throughputSamples[]
   (Nullscheiben werden als 0 behalten)
```

### Monte Carlo – Modus „Bis wann fertig?"

```
Input:  targetCount (Anzahl Issues)
Output: Häufigkeitsverteilung möglicher Fertigstellungsdaten

Für jede Simulation i = 1…numRuns:
  remainingIssues = targetCount
  currentDate    = heute
  while remainingIssues > 0:
    sample = throughputSamples[random(0, length-1)]
    remainingIssues -= sample
    currentDate    += 1 Zeitscheibe
  result[i] = currentDate

→ Histogramm über result[]
→ P50/P70/P85/P95 per core.pct(sorted_result, p)
```

### Monte Carlo – Modus „Wie viele bis Datum X?"

```
Input:  targetDate
Output: Häufigkeitsverteilung möglicher fertiger Issues

Für jede Simulation i = 1…numRuns:
  totalIssues  = 0
  currentDate  = heute
  while currentDate < targetDate:
    sample = throughputSamples[random(0, length-1)]
    totalIssues += sample
    currentDate += 1 Zeitscheibe
  result[i] = totalIssues

→ Histogramm über result[]
→ P50/P70/P85/P95 per core.pct(sorted_result, p)
```

### Stabilitäts-Check (Beurteilungszeitraum)

```
Methode: Variationskoeffizient (CV)

stabilityRows = Issues im Beurteilungszeitraum (cfg.stabilityPeriod)
stabilityThroughput[] = Zeitscheiben-Throughput im Beurteilungszeitraum
mean = Summe / Anzahl
stdDev = Standardabweichung
CV = stdDev / mean   (falls mean == 0: CV = ∞ → rot)

Schwellen:
  CV ≤ 0,5 → grün (stabil)
  CV ≤ 0,8 → gelb (volatil)
  CV >  0,8 → rot  (instabil)
```

### Zeitscheiben-Berechnung

```
'day':   jeder Kalendertag ist eine Scheibe
'week':  ISO-Kalenderwochen (Montag–Sonntag)
'month': Kalendermonat
```

### Edge Cases

| Situation | Verhalten |
|---|---|
| `throughputSamples` leer | Nodata-Zustand, kein Simulationsstart möglich |
| `mean == 0` | CV = Infinity → Ampel rot, Label: „Kein Throughput im Beurteilungszeitraum" |
| `targetCount == 0` | Validierungsfehler: „Mindestens 1 Issue angeben" |
| `targetDate < heute` | Validierungsfehler: „Datum muss in der Zukunft liegen" |
| Alle Samples = 0 (keine Bewegung) | Simulation läuft, liefert Ergebnis „niemals" (Datum = sehr weit in der Zukunft) |
| Division durch 0 bei Histogramm-Skalierung | `Math.max(1, maxFreq)` |

---

## E – Config / Format-Panel

Gespeichert unter `localStorage`-Key `fhwa_montecarlo`.

| Property | Typ | Default | Min/Max | Effekt | Validierung |
|---|---|---|---|---|---|
| `mode` | `'when' \| 'howmany'` | `'when'` | – | Aktiver Vorhersagemodus | Toggle-Gruppe |
| `targetCount` | number | `100` | 1 / 10000 | Issue-Anzahl für „Bis wann" | Integer, positiv |
| `targetDate` | string (ISO) | heute + 12 Wochen | – | Zieldatum für „Wie viele" | >= heute |
| `calcRollingDays` | number | `90` | 7 / 730 | Berechnungszeitraum (Rolling) | Integer |
| `calcFromDate` | string \| null | `null` | – | Berechnungszeitraum (Fix-Start) | <= calcToDate |
| `calcToDate` | string \| null | `null` | – | Berechnungszeitraum (Fix-Ende) | >= calcFromDate |
| `stabilityRollingDays` | number | `60` | 7 / 730 | Beurteilungszeitraum (Rolling) | Integer |
| `stabilityFromDate` | string \| null | `null` | – | Beurteilungszeitraum (Fix-Start) | – |
| `stabilityToDate` | string \| null | `null` | – | Beurteilungszeitraum (Fix-Ende) | – |
| `throughputUnit` | `'day' \| 'week' \| 'month'` | `'week'` | – | Aggregations-Zeitscheibe | Toggle |
| `completedCol` | string | `'Resolved'` | – | Fertig-Datumsspalte | Muss in dateCols sein |
| `numRuns` | number | `1000` | 500 / 10000 | Anzahl Simulationsläufe | Integer |
| `cvThresholdGreen` | number | `0.5` | 0.1 / 2.0 | CV-Grenzwert grün/gelb | Float |
| `cvThresholdRed` | number | `0.8` | 0.2 / 3.0 | CV-Grenzwert gelb/rot | Float |
| `showP50` | boolean | `true` | – | P50-Linie im Histogramm | Checkbox |
| `colorP50` | string (hex) | `'#22d3ee'` | – | P50-Linienfarbe | `<input type="color">` |
| `showP70` | boolean | `true` | – | P70-Linie | Checkbox |
| `colorP70` | string (hex) | `'#86efac'` | – | P70-Linienfarbe | `<input type="color">` |
| `showP85` | boolean | `true` | – | P85-Linie | Checkbox |
| `colorP85` | string (hex) | `'#fbbf24'` | – | P85-Linienfarbe | `<input type="color">` |
| `showP95` | boolean | `true` | – | P95-Linie | Checkbox |
| `colorP95` | string (hex) | `'#f87171'` | – | P95-Linienfarbe | `<input type="color">` |

**Zeitraum-Logik:** Wenn `calcFromDate` und `calcToDate` beide gesetzt sind → fixer Zeitraum. Sonst → Rolling Window der letzten `calcRollingDays` Tage ab heute. Gleiche Logik für Stability-Zeitraum.

---

## F – Design-Standards (§9-Pflichtcheck)

| Standard | Entscheidung | Details |
|---|---|---|
| Tooltip boundary-safe | ✅ Pflicht | `positionTooltip()` mit Overflow-Prüfung gegen Card-Container |
| Tooltip mit Links | – nicht benötigt | Kein Jira-Link, kein URL-Feature |
| N-Anzeige | ✅ Pflicht | Diag-Bar: `n=[Issues im Berechnungszeitraum] · [throughputUnit] · [numRuns] Läufe` |
| Reihenfolge-Panel | – nicht benötigt | Keine Kategorie-Reihenfolge |
| Skalierung | ✅ Pflicht | SVG-Histogramm füllt Container, Balkenbreite = `pW / numBins`, responsiv |
| Diagnosemodus | ✅ Pflicht | Inhalt: `n=[issues] · Zeitraum: [von]–[bis] · CV=[wert] · [numRuns] Läufe` |
| Link-Feature | – nicht benötigt | Kein urlTemplate-Einsatz |
| Dark/Light Theme | ✅ CSS-Variablen | Balken: `var(--blue)`, Achsen: `core.scatterColors()`, Ampel: `var(--green/yellow/red)` |

---

## G – Akzeptanzkriterien

### Automatisch von Claude prüfbar

- [x] `montecarlo.js` lädt ohne JS-Fehler in der Browser-Console
- [x] `cfg` wird korrekt aus `localStorage` geladen und nach Änderung persistiert (Page-Reload)
- [x] `completedCol` wird nach Datenload auf gültige Spalte validiert (Fallback: erster Eintrag in `dateCols`)
- [x] Simulation startet nur bei gültigem Input (targetCount > 0 oder targetDate >= heute)
- [x] `Math.max(...leeres Array)` ist abgesichert (`length > 0` Check vor jeder `Math.max`-Nutzung)
- [x] `core.on('data' | 'theme' | 'filter' | 'resize')` alle abonniert
- [x] Zeitraum-Logik: Rolling vs. Fix-Datum korrekt umgeschaltet (beide Zeiträume unabhängig)
- [x] CV = Infinity wenn mean == 0 → Ampel rot, kein JS-Fehler

### Manuell durch Oliver zu testen

- [ ] Toggle „Bis wann fertig?" / „Wie viele bis X?" wechselt Input-Feld und leert Ergebnis korrekt
- [ ] Simulation mit 1.000 Läufen läuft in < 1 Sekunde (kein UI-Freeze)
- [ ] Histogramm-Tooltip zeigt Datum/Anzahl + Häufigkeit + kumulierte Wahrscheinlichkeit
- [ ] Ampel wechselt korrekt zwischen grün/gelb/rot bei unterschiedlichen Beurteilungszeiträumen
- [ ] Perzentil-Linien P50/P70/P85/P95 im Histogramm sichtbar und an korrekter Position (rechte Balkenkante)
- [ ] Config-State überlebt Browser-Reload vollständig
- [ ] Einstellungen-Panel: Rolling-Window und Fix-Datum können unabhängig gewechselt werden
- [ ] Tooltip bleibt vollständig sichtbar an allen 4 Ecken des Visuals
- [ ] Globaler Squad-Filter aktualisiert Simulation (neue Throughput-Basis nach Filter-Änderung)
- [ ] Bei 0 Issues im Zeitraum: Nodata-Meldung sichtbar, kein JS-Fehler in der Console
- [ ] Sparkline-Trendchart im Stabilitäts-Bereich zeigt Throughput-Verlauf korrekt
- [ ] Tabelle zeigt P50/P70/P85/P95 korrekt für beide Modi
- [ ] Aktiver Toggle (Modus + Throughput-Aggregation) ist blau hervorgehoben (ta-b)

---

## Änderungshistorie

| Datum | Version | Änderung | Bestätigt von |
|---|---|---|---|
| 2026-06-10 | 0.1 | Initiale Spec via SDD-Interview erstellt | – |
| 2026-06-11 | 1.0 | Implementierung abgeschlossen: `montecarlo.js` (699 Zeilen), Integration in `index.html` (Sidebar 🎲🎲, Page `monte`, Import + Init) und `core.js` (CARD_PAGE_MAP). Bugfixes: Toggle-Klasse `tgl-btn` → `tgl`, Panel-Klasse `sc-panel` → `sub-panel`, aktiver Zustand `active` → `ta-b`, Histogramm-Bins auf Distinct-Values gedeckelt (keine Lücken bei wöchentlichem Throughput), Perzentillinien auf rechte Balkenkante gesnappt. | Oliver |

---

*Autor: Oliver Wolter · Erstellt mit Claude (claude-sonnet-4-6)*
