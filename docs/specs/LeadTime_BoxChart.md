# LeadTime BoxChart (boxchart.js) – Spezifikation

**Version:** 1.0  
**Datum:** 2026-06-01  
**Status:** Bestätigt (Gate 1)

---

## A – Zweck & Abgrenzung

### Was das Visual macht
Box-Plot-Diagramm zur Analyse der Lead Time von Work Items über Zeit. Zeigt pro Periode (Monat oder Quartal) die statistische Verteilung der Lead-Time-Werte in drei wählbaren Ansichtsmodi: Box, Violin, Kombi. Lead Time = ltEnd − ltStart (konfigurierbar, Dual-Period-Logik).

### Was es NICHT macht
- Kein Cross-Filter auf andere Visuals
- Kein Visual-spezifisches Grouping (nur eine Serie pro Periode)
- Keine konfigurierbaren Farben (feste Farben aus CSS-Variablen)
- Kein eigenes URL-Template (fällt auf `core.state.urlTemplate` zurück)
- Keine DAX-Berechnungen, kein Power BI

### Technologie
Web-App (`boxchart.js`) – ES-Modul, eingebunden in `index.html` + `core.js`

---

## B – Datenmodell

### Excel-Spalten
| Spalte | Typ | Pflicht? | Beschreibung |
|---|---|---|---|
| `Jira-ID` | Text | ✅ | Eindeutiger Identifier, für URL-Link |
| `[ltStart]` | Datum | ✅ | Konfigurierbar, Default: `Ready4Progress_first` |
| `[ltEnd]` | Datum | ✅ | Konfigurierbar, Default: `Resolved` |

Alle weiteren Meta-Spalten werden ignoriert. Squad-Filter wirkt global via `core.filteredRows()`.

### Datumsstrategie
Dual-Period-Logik für ltStart und ltEnd (`_first`-Spalten), konsistent mit allen anderen Visuals. Lead Time pro Item = `core.dur(ltStartVal, ltEndVal)`. Items bei denen start oder end fehlt/null werden übersprungen.

### Perioden-Gruppierung
- **Monat**: aus ltEnd-Datum → `YYYY-MM` → Anzeige z.B. `Mai 26`
- **Quartal**: aus ltEnd-Datum → `YYYY-QN` → Anzeige z.B. `Q2 26`
- **Rolling-Sort**: aktueller Monat/Quartal zuerst (links), dann rollierend vorwärts

---

## C – UX & Layout

### Hauptbereiche (ASCII-Sketch)
```
┌─────────────────────────────────────────────────────────┐
│  LeadTime  [Box][Violin][Kombi]  [Ausr.●]  [⚙]        │  ← Card-Header
├─────────────────────────────────────────────────────────┤
│  Diag-Bar (diagEl): n=X · ltStart→ltEnd · Modus        │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Y │  ·  Whisker ↑                                     │
│    │  ┌──────────┐  Box (P25–P85)                      │
│    │  │──────────│  Median-Linie                        │
│    │  │  ━━━━━━  │  P85-Linie (amber)                  │
│    │  └──────────┘                                      │
│    │  ·  Whisker ↓                                      │
│    │  ○  Ausreißer                                      │
│    │                                                     │
│    └────────────────────── X (Perioden)                 │
│       n=12   n=8   n=15   n=21   ...                    │
└─────────────────────────────────────────────────────────┘
```

### Card-Header Controls
- Titel: `Lead<span class="hl">Time</span>`
- Buttons: `Box` · `Violin` · `Kombi` (aktiver Modus hervorgehoben)
- Toggle: `Ausr. ●` / `Ausr. ○`
- Button `⚙` öffnet Config-Panel (ltStart, ltEnd, Bandwidth, Monat/Quartal)

### Interaktionen
| Aktion | Trigger | Effekt |
|---|---|---|
| Modus wechseln | Klick auf Box/Violin/Kombi | `cfg.chartMode` setzen, neu rendern, speichern |
| Ausreißer toggle | Klick auf `Ausr.` | `cfg.showOutliers` toggle, neu rendern, speichern |
| Monat/Quartal | Im ⚙-Panel | `cfg.periodMode` setzen, neu rendern, speichern |
| Tooltip | mouseover Ausreißer-Punkt | Tooltip mit Jira-ID + LT-Wert + Link (falls URL) |
| Link klicken | Klick auf Link im Tooltip | `window.open(url, '_blank')` |

### Leerzustand
Keine Daten / alle Items herausgefiltert / ltStart oder ltEnd-Spalte nicht gefunden → Diag-Bar zeigt Meldung, SVG bleibt leer (kein JS-Error).

### Responsive
SVG 100% Breite/Höhe des `contentEl`. Boxbreite, Schriftgrößen, Ausreißer-Radius skalieren mit Viewport.

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

### Violin KDE
Gaussian Kernel, getrimmt auf echten Min/Max (cut=0), 80 Stützpunkte, Bandwidth konfigurierbar (Default 4).

### Edge Cases
| Situation | Verhalten |
|---|---|
| Periode mit < 2 Items | Box/Violin wird trotzdem gezeichnet (ggf. nur Median-Punkt) |
| ltStart/ltEnd-Spalte nicht gefunden | Diag-Meldung, kein Rendern |
| `Math.max()` auf leerem Array | Abgesichert mit length-Check |
| Alle Items herausgefiltert | Leeres SVG, Diag-Meldung |

---

## E – Config / Format-Panel

| Property | Typ | Default | Effekt |
|---|---|---|---|
| `chartMode` | enum | `"box"` | Ansichtsmodus: box / violin / combo |
| `periodMode` | enum | `"month"` | Gruppierung: month / quarter |
| `showOutliers` | bool | `true` | Ausreißer-Punkte ein/aus |
| `bandwidth` | number | `4` | Violin KDE-Glättung (1–20) |
| `ltStart` | string | `"Ready4Progress_first"` | Lead-Time Startspalte |
| `ltEnd` | string | `"Resolved"` | Lead-Time Endspalte |

localStorage-Key: `fhwa_boxchart`

---

## F – Design-Standards (§9-Pflichtcheck)

| Standard | Entscheidung |
|---|---|
| Tooltip boundary-safe | ✅ `positionTooltip()` mit Overflow-Prüfung (§9.3) |
| Tooltip mit Links | ✅ Hover-Delay 120ms + `pointerEvents: all` für Ausreißer (§4.9) |
| N-Anzeige | ✅ `n=XX` unter jeder Perioden-Beschriftung X-Achse (§9.4) |
| Reihenfolge-Panel | — nicht benötigt (Rolling-Sort) |
| Skalierung | ✅ SVG 100%/100%, alle Größen relativ zu Viewport (§9.5) |
| Diagnosemodus | ✅ `diagEl` der Card, immer sichtbar (§9.2) |
| Dark/Light Theme | ✅ `core.scatterColors()` + CSS-Variablen |
| Link-Feature | ✅ `core.state.urlTemplate` + `{issueKey}`, `window.open()` (§9.7) |
| SVG-Rendering | ✅ SVG-String wie scatter.js (kein ESLint-Kontext) |

---

## G – Akzeptanzkriterien

### Automatisch prüfbar
- [ ] `core.filteredRows()` einziger Datenzugriff
- [ ] localStorage-Key `fhwa_boxchart`
- [ ] Kein direkter `core.state.rows`-Zugriff

### Manuell durch Oliver
- [ ] Tooltip vollständig sichtbar an allen 4 Ecken
- [ ] Monat/Quartal-Toggle: Rolling-Sort korrekt (aktueller Monat/Quartal links)
- [ ] Alle 3 Modi rendern ohne Fehler
- [ ] Ausreißer-Toggle funktioniert
- [ ] Ausreißer-Link öffnet Browser
- [ ] 0 Items: Diag-Meldung, kein JS-Error
- [ ] Ungültige ltStart/ltEnd-Spalte: Diag-Meldung, kein Absturz
- [ ] Skalierung bei kleinem Format korrekt
- [ ] Config überlebt Browser-Reload
- [ ] Theme-Wechsel → korrektes Neu-Rendern

---

## Änderungshistorie
| Datum | Version | Änderung |
|---|---|---|
| 2026-06-01 | 1.0 | Initiale Spec nach SDD-Interview |
