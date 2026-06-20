# HappinessFaktor – Spezifikation

**Version:** 1.1  
**Datum:** 2026-06-19  
**Status:** [x] Entwurf → [x] Bestätigt (Gate 1) → [x] Implementiert  
**Datei:** `src/happiness.js`

---

## A – Zweck & Abgrenzung

### Was das Visual macht
Zeigt die Happiness-Zeitreihe eines einzelnen Squads über Monate als Liniendiagramm (X = Monate, Y = 1–5).
Ziel ist es, den Trend der Team-Stimmung auf einen Blick sichtbar zu machen.
Zielgruppe: Agile Coaches, Chapter Leads, Management.

### Was es NICHT macht
- Kein Cross-Filter auf andere Visuals
- Zeigt immer nur **1 Squad** – bei Mehrfachauswahl erscheint eine Fehlermeldung
- Keine Berechnung von Durchschnitt, Trend oder gleitendem Mittelwert
- Schreibt nichts in `core.state` (nur lesend)

### Technologie
[x] Web-App (.js + core.js, standalone HTML in SharePoint)

---

## B – Datenmodell

### Excel-Sheet
| Eigenschaft | Wert |
|---|---|
| Sheet-Name | `Happiness Faktor` (exakt, hardcoded) |
| Header-Zeile | Erste Zeile mit dem Wert `Datum` in Spalte B |
| Datum-Spalte | Spalte mit Header `Datum` (typisch Spalte B) |
| Formel-Spalte | Eine Spalte nach `Datum` (`ausgewähltes Squad`) – wird übersprungen |
| Squad-Spalten | Alle weiteren Spalten mit einem nicht-leeren String als Header → Squad-Name |
| Datenwerte | Zeilenweise pro Monat ab der Zeile nach der Header-Zeile |

### Erkennungslogik Squad-Spalten
`core.state.sheetsRaw['Happiness Faktor']` liefert ein 2D-Array (`{header:1}`-Format).
Die Implementierung sucht die Header-Zeile per `row.some(c => c === 'Datum')`,
ermittelt den Spaltenindex von `Datum`, überspringt die nächste Spalte (`ausgewähltes Squad`)
und sammelt alle weiteren Spalten, deren Header-Wert ein nicht-leerer String ist, als Squad-Spalten.
Leere Spalten (null-Header) werden automatisch übersprungen.

### Wertebereiche
| Wert | Bedeutung | Darstellung |
|---|---|---|
| 1–5 (number) | gültiger Happiness-Wert | Farbiger Punkt auf Linie |
| null / außerhalb 1–5 | kein Wert (`nv`) | Grauer Punkt (Ø 70% Radius) auf Y=0, Linie unterbrochen |

### Squad-Filter-Quelle
`core.state.squadFilter` – befüllt durch das BoxChart-Visual aus JiraStories.
Das HappinessFaktor-Visual ist reiner Empfänger.

### Voraussetzung core.js
`core.state.sheetsRaw` muss in `core.js` ergänzt werden:

**`core.state`** (Ergänzung):
```javascript
sheetsRaw: {},  // { [sheetName]: any[][] } – XLSX {header:1} Format für Custom-Header-Sheets
```

**`_loadFile()` in core.js** (Ergänzung, ~3 Zeilen):
```javascript
// Vorher:
const sheets = {};
wb.SheetNames.forEach(sn => {
  sheets[sn] = XLSX.utils.sheet_to_json(wb.Sheets[sn], { defval: null });
});
core.state.sheets = sheets;

// Nachher:
const sheets = {}, sheetsRaw = {};
wb.SheetNames.forEach(sn => {
  sheets[sn]    = XLSX.utils.sheet_to_json(wb.Sheets[sn], { defval: null });
  sheetsRaw[sn] = XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, defval: null });
});
core.state.sheets    = sheets;
core.state.sheetsRaw = sheetsRaw;
```

**Reset-Handler in core.js** (Ergänzung, 1 Zeile):
```javascript
core.state.sheetsRaw = {};
```

### index.html (Ergänzung)
```javascript
import { init as initHappiness } from './happiness.js';
// ...
initHappiness();
```

---

## C – UX & Layout

### Hauptbereiche (ASCII-Sketch)
```
┌──────────────────────────────────────────────────────────┐
│  Happiness Faktor              [N = 10] [sep] [⚙]       │
├──────────────────────────────────────────────────────────┤
│  (Erklärungs-Panel, ausklappbar, max-height:0 by default)│
├──────────────────────────────────────────────────────────┤
│  SVG-Chart                                               │
│  5 ─────────────────────────────────────────────────    │
│  4 ─────●──────────────●────────────────────────        │
│  3 ──────────────●───────────────●──────────────        │
│  2                                                       │
│  1 ─●                                                    │
│  0  ○ nv (grau, Linie unterbrochen)                      │
│     Jun'25  Jul'25  Aug'25  Sep'25  …                    │
├──────────────────────────────────────────────────────────┤
│  [Was zeigt diese Ansicht?]   [2 ohne Wert]              │
└──────────────────────────────────────────────────────────┘
```

**Titel:** `Happiness <span class="hl">Faktor</span>` – weißer Text, blau gefärbtes Suffix.

### Farbskala Datenpunkte (semantisch, theme-unabhängig)
| Wert | Farbe | RGB |
|---|---|---|
| 1 | Rot | `rgb(229, 57, 53)` |
| 3 | Gelb | `rgb(253, 216, 53)` |
| 5 | Grün | `rgb(67, 160, 71)` |
| nv | Grau | `#9e9e9e` |
Zwischen den Ankerpunkten wird linear interpoliert.

### Verbindungslinie
Verbindet nur aufeinanderfolgende **gültige** Punkte (Wert 1–5).
Bei `nv`-Monaten: Linie unterbrochen. Kein Segment zum nv-Punkt.
nv-Punkt: grau, 70% des normalen Radius, liegt auf Y=0.

### Interaktionen
| Aktion | Trigger | Effekt |
|---|---|---|
| Tooltip anzeigen | mouseover auf Datenpunkt | Tooltip mit Monat + Wert (farbig), position:fixed, boundary-safe |
| Tooltip ausblenden | mouseout | display:none |
| Erklärungs-Panel öffnen/schließen | Klick auf „Was zeigt diese Ansicht?" | max-height-Transition, `_expOpen` toggelt |
| Format-Panel öffnen | ⚙-Button im Header | Panel mit Punkt-Radius erscheint |
| Squad wählen | Seiten-Filter | Chart neu rendern |

### Leerzustände
| Situation | Anzeige in der Card |
|---|---|
| Kein Squad ausgewählt | „Kein Squad ausgewählt" |
| Mehrere Squads gewählt | „Bitte nur 1 Squad wählen" |
| Sheet `Happiness Faktor` fehlt | „Sheet ‚Happiness Faktor' nicht in der Excel gefunden" |
| Squad nicht in Happiness-Daten | „Squad ‚{name}' nicht in Happiness-Daten" |
| Noch keine Datei geladen | „Noch keine Datei geladen" |

### Responsive-Verhalten
Alle Größen relativ zu Containergröße: `r = baseRadius × √(min(W,H) / 200)`.
X-Achsen-Labels: max. `floor(chartWidth / 52)` Labels, Rest ausgeblendet.

### Sortierung X-Achse
Chronologisch: ältester Monat links → neuester rechts. Fix, kein Reihenfolge-Panel.

---

## D – Berechnungslogik

### Kern-Metrik
Roher Happiness-Wert (1–5) direkt aus dem Sheet. Keine weiteren Berechnungen.

### Zeitraum
Alle geladenen Monate werden immer vollständig angezeigt (kein Filter). Reihenfolge: chronologisch aufsteigend (ältester Monat links).

### Edge Cases
| Situation | Verhalten |
|---|---|
| Wert null / nicht 1–5 | → `nv`: grauer Punkt auf Y=0, Linie unterbrochen |
| Wert außerhalb 1–5 (numeric) | → `nv` (Validierung: `v >= 1 && v <= 5`) |
| Alle Monate nv | Chart zeigt nur graue Punkte auf X-Achse, Linie fehlt komplett |
| Sheet fehlt | Fehlermeldung in der Tile |
| Squad nicht in Sheet | Fehlermeldung in der Tile |
| `core.state.sheetsRaw` fehlt (alte core.js) | `(core.state.sheetsRaw || {})[SHEET]` → undefined → Sheet-Fehler |
| Datum kein JS-Date | Fallback via `core.toDate()` |

---

## E – Config (localStorage)

**localStorage-Key:** `fhwa_happinessfaktor`

| Property | Typ | Default | Min | Max | Effekt |
|---|---|---|---|---|---|
| `dotRadius` | Number | 6 | 3 | 12 | Basis-Radius der Datenpunkte (px bei Referenzgröße) |

---

## F – Design-Standards

| Standard | Entscheidung | Details |
|---|---|---|
| Tooltip boundary-safe | ✅ Pflicht | `position:fixed` (Tile hat `overflow:hidden`), boundary-check gegen `window.innerWidth/Height` |
| Tooltip mit Links | ✗ nicht benötigt | Kein Link-Feature |
| N-Anzeige | ✅ Im Header | `N = X` (Anzahl gültiger Monate) als Badge vor dem ⚙-Button (headerExtraEl) |
| Erklärungs-Panel | ✅ | Ausklappbar via „Was zeigt diese Ansicht?" im linken Footer. Flex-Panel über SVG. |
| Reihenfolge-Panel | ✗ nicht benötigt | Monate immer chronologisch |
| Skalierung | ✅ Pflicht | `r = baseR × √(min(W,H) / 200)` |
| Diagnosemodus | ✅ 3-spaltig | Links: „Was zeigt diese Ansicht?", Mitte: nv-Hinweis oder Fehler, Rechts: – |
| Link-Feature | ✗ nicht benötigt | – |
| Theme | ✅ Pflicht | `core.scatterColors()` für Grid, Achsen, Dot-Stroke. Farbskala rot/gelb/grün hardcoded (semantisch) |
| Y-Achse | Fix 0–5 | Unabhängig von Datenwerten. Gridlinien bei jedem Integer. |
| Format-Panel | ✅ Position:fixed | Wegen `overflow:hidden` auf `.tile`. Nur Punkt-Radius-Slider. Schließt bei Klick außerhalb. |

---

## G – Akzeptanzkriterien

### Automatisch von Claude prüfbar
- [x] localStorage-Key = `fhwa_happinessfaktor`
- [x] Events abonniert: `data`, `filter`, `theme`, `resize`
- [x] Keine hardcodierten Theme-Farben außer der semantischen Farbskala (rot/gelb/grün)
- [x] nv-Punkte haben Y=0 und Farbe `#9e9e9e`
- [x] Linie wird bei nv unterbrochen (kein Segment zu/von nv)
- [x] `core.state.sheetsRaw` über `(core.state.sheetsRaw || {})` zugreifen
- [x] N-Badge im headerExtraEl (`N = X`, Anzahl gültiger Monate)
- [x] Kein Von/Bis-Filter im Header
- [x] 3-spaltiger Footer: Links „Was zeigt diese Ansicht?", Mitte Fehler/nv-Hinweis
- [x] Erklärungs-Panel (max-height:0 → scrollHeight bei Toggle)

### Manuell durch Oliver zu testen
- [ ] Tooltip bleibt vollständig sichtbar an allen 4 Ecken der Tile
- [ ] Config-State (dotRadius) überlebt Browser-Reload
- [ ] Kein Squad gewählt → „Kein Squad ausgewählt", kein JS-Error in Console
- [ ] 2+ Squads gewählt → „Bitte nur 1 Squad wählen"
- [ ] Sheet fehlt in Excel → Fehlermeldung in Tile, kein JS-Error
- [ ] nv-Monate: grauer kleinerer Punkt auf Y=0, Linie unterbrochen
- [ ] Gültige Punkte: korrekte Farbe nach Skala (1=rot, 3=gelb, 5=grün)
- [ ] Erklärungs-Panel klappt auf/zu bei Klick auf „Was zeigt diese Ansicht?"
- [ ] Tile auf kleines Format: Punkte und X-Labels skalieren proportional, kein Überlappen
- [ ] Theme-Toggle → Chart neu gerendert ohne Artefakte
- [ ] Format-Panel öffnet / schließt korrekt; Radius wird gespeichert

---

## Änderungshistorie

| Datum | Version | Änderung | Bestätigt von |
|---|---|---|---|
| 2026-06-07 | 1.0 | Initiale Spec nach SDD-Interview + Implementierung | Oliver |
| 2026-06-19 | 1.1 | Von/Bis-Filter entfernt; N-Badge in Header; Titel mit hl-Span; Erklärungs-Panel + 3-spaltiger Footer; Format-Panel ohne Titel-Feld | Oliver |
