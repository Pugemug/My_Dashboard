# Akzeptanzkriterien – Spezifikation

**Version:** 1.0  
**Datum:** 2026-06-18  
**Status:** [x] Entwurf → [x] Bestätigt (Gate 1) → [x] Implementiert  
**Datei:** `src/akzeptanz.js`

---

## A – Zweck & Abgrenzung

### Was das Visual macht
Zeigt die Qualität der Akzeptanzkriterien pro Etappe (Stage) als Liniendiagramm.
X-Achse = Etappe (chronologisch nach BRP Etappen-Startdatum), Y-Achse = Prozentsatz der Epics
pro Etappe und Squad, deren Akzeptanzkriterien-Feld mehr als 3 Wörter enthält.
Eine Linie pro Squad ermöglicht den Vergleich zwischen Teams über mehrere Etappen hinweg.

### Was es NICHT macht
- Kein Cross-Filter auf andere Visuals
- Keine Darstellung einzelner Epics (aggregiert pro Stage+Squad)
- Schreibt nichts in `core.state` (nur lesend)
- Kein Jira-Link (aggregiertes Visual, kein Datenpunkt pro Epic)
- Zeigt immer nur **1 Squad** – bei Mehrfachauswahl erscheint eine Fehlermeldung (identisches Verhalten wie Happiness-Index und WIP)

### Technologie
[x] Web-App (.js + core.js, standalone HTML in SharePoint)

---

## B – Datenmodell

### Excel-Sheets

| Sheet-Name | Pflicht? | Genutzte Spalten |
|---|---|---|
| `JiraEpics` | optional (Leerzustand wenn fehlend) | `Jira-ID`, `Stage`, `Akzeptanzkriterien`, `Squad` |
| `BRP Etappen` | optional (Fallback: alphabetisch) | `Etappe`, `Startdatum` |

### Erkennungslogik
`core.state.sheets['JiraEpics'] ?? []` – Standard-Header in Zeile 1, kein `sheetsRaw` nötig.

Spalten werden direkt über ihren Namen zugegriffen:
- `row['Stage']` – Etappenname des Epics
- `row['Akzeptanzkriterien']` – Text-Inhalt (kann null/leer sein)
- `row['Squad']` – Squad-Zuordnung (für Filter + Linien-Gruppierung)
- `row['Jira-ID']` – nur zur Zählung, kein Link

BRP Etappen: `core.state.sheets['BRP Etappen'] ?? []`
- `row['Etappe']` – Etappenname (muss mit `JiraEpics.Stage` übereinstimmen)
- `row['Startdatum']` – Datum, via `core.toDate()` geparsed (für chronologische Sortierung)

### Wort-Zähl-Logik
```
function _wordCount(text) {
  if (!text) return 0;
  return String(text).trim().split(/\s+/).filter(t => t.length > 0).length;
}
// Qualifiziert wenn: _wordCount(row['Akzeptanzkriterien']) > 3
```

### Berechnungslogik AK-Qualität
Für jede Kombination (Stage, Squad):
- `N` = Anzahl Epics mit `row['Stage'] === stage && row['Squad'] === squad`
- `n` = Anzahl Epics aus N, bei denen `_wordCount(row['Akzeptanzkriterien']) > 3`
- Qualität % = `Math.round((n / N) * 10000) / 100` (auf 2 Dezimalstellen)
- Wenn `N === 0`: kein Datenpunkt → Lücke in der Linie

### Stage-Reihenfolge
1. `BRP Etappen`-Sheet vorhanden: Stages nach `Startdatum` aufsteigend sortieren (älteste Etappe links)
2. Stages aus `JiraEpics` die nicht in `BRP Etappen` vorkommen: ans Ende, alphabetisch sortiert
3. `BRP Etappen`-Sheet fehlt: alle Stages aus `JiraEpics` alphabetisch sortieren

### Squad-Filter
Globaler Filter via `core.state.squadFilter`.
- Kein Squad ausgewählt (leerer Filter) → Fehlermeldung „Kein Squad ausgewählt"
- Genau 1 Squad ausgewählt → Linie für diesen Squad wird gerendert
- Mehr als 1 Squad ausgewählt → Fehlermeldung „Bitte nur 1 Squad wählen"

### Fallback bei fehlenden Daten
| Situation | Verhalten |
|---|---|
| `JiraEpics` fehlt oder leer | Leerzustand: Diag-Meldung, kein Fehler |
| `Squad`-Spalte fehlt in JiraEpics | Alle Epics werden als ein Squad `'(kein Squad)'` behandelt |
| `Stage`-Spalte fehlt in JiraEpics | Leerzustand: Diag-Meldung |
| `Akzeptanzkriterien` = null/leer | Zählt als 0 Wörter → nicht qualifizierend |
| Stage+Squad mit N=0 | Kein Datenpunkt → Lücke in der Linie |
| Division durch 0 | Unmöglich wegen N=0-Check, dennoch Guard: `N === 0 ? null : ...` |

---

## C – UX & Layout

### Hauptbereiche (ASCII-Sketch)
```
┌──────────────────────────────────────────────────────────┐
│  Tile-Header: [Akzeptanzkriterien] [···sep···] [⚙]       │
├──────────────────────────────────────────────────────────┤
│  SVG-Chart                                               │
│  100% ──────────────────────────────────────────────     │
│   75% ────────────●────────────────●────────────         │
│   50% ──────●───────────────●──────────────────          │
│   25% ──────────────────────────────────────────         │
│    0% ──────────────────────────────────────────         │
│         Eta 1  Eta 2  Eta 3  Eta 4  Eta 5                │
├──────────────────────────────────────────────────────────┤
│  Diag-Bar: Squad: Alpha · n=42 Epics · 5 Etappen        │
└──────────────────────────────────────────────────────────┘
```

### Farben
Eine einzelne Linie für den aktiven Squad. Linienfarbe: `core.palette()[0]` (erster Farbwert der aktuellen Palette – konsistent mit anderen Ein-Linien-Visuals). Punkte in derselben Farbe mit Stroke-Halo (`core.scatterColors().dotStroke`).

### Interaktionen
| Aktion | Trigger | Effekt |
|---|---|---|
| Tooltip anzeigen | mouseover auf Datenpunkt | Tooltip mit Etappe, Squad, %, n/N |
| Tooltip ausblenden | mouseout | display:none (120ms Delay nicht nötig, kein Link im Tooltip) |
| Config-Panel öffnen | ⚙-Button im Header | Panel mit Titel + Punkt-Radius erscheint |
| Config-Panel schließen | Klick außerhalb | Panel schließt |
| Squad-Filter ändern | globaler Filter | render() neu aufgerufen via `core.on('filter')` |

### Leerzustände
| Situation | Anzeige in der Tile |
|---|---|
| Noch keine Datei geladen | „Noch keine Datei geladen" |
| Kein Squad ausgewählt | „Kein Squad ausgewählt" |
| Mehrere Squads ausgewählt | „Bitte nur 1 Squad wählen" |
| `JiraEpics`-Sheet fehlt | „JiraEpics-Sheet nicht gefunden" |
| JiraEpics vorhanden, aber keine Stage-Daten | „Keine Epics mit Stage-Daten" |
| Ausgewählter Squad hat keine Epics in JiraEpics | „Keine Daten für Squad ‚{name}'" |

### Responsive-Verhalten
Alle Größen relativ zum Container: Achsen-Beschriftungen, Punkt-Radius und Linienbreite skalieren
mit `Math.max(3, Math.min(8, containerWidth / 100)) * (cfg.dotRadius / 5)`.
X-Achsen-Labels: bei zu wenig Platz jeden zweiten Label ausblenden.
Legende: rechts neben dem Chart, bei sehr kleiner Breite unter dem Chart.

---

## D – Berechnungslogik

### Kern-Metrik
```
AK-Qualität(stage, squad) = round((n_qualifying / N_total) * 100, 2)

wobei:
  N_total     = |{ epic | epic.Stage === stage && epic.Squad === squad }|
  n_qualifying = |{ epic ∈ N_total | wordCount(epic.Akzeptanzkriterien) > 3 }|
  wordCount(text) = Anzahl nicht-leerer Tokens bei Whitespace-Split

Kein Datenpunkt wenn N_total = 0.
```

### Stage-Sortierung (Pseudocode)
```
stagesInBrp = BRP_Etappen
  .filter(r => r['Etappe'] && r['Startdatum'])
  .sort by core.toDate(r['Startdatum']) ascending
  .map(r => r['Etappe'])

stagesOnly = unique(JiraEpics.map(r => r['Stage']).filter(Boolean))

knownStages   = stagesInBrp.filter(s => stagesOnly.includes(s))
unknownStages = stagesOnly.filter(s => !stagesInBrp.includes(s)).sort()

finalOrder = [...knownStages, ...unknownStages]
```

### Edge Cases
| Situation | Verhalten |
|---|---|
| `Akzeptanzkriterien` = null, '', whitespace-only | wordCount = 0 → nicht qualifizierend |
| `Akzeptanzkriterien` hat genau 3 Wörter | nicht qualifizierend (Bedingung: **mehr als** 3) |
| `Akzeptanzkriterien` hat 4 oder mehr Wörter | qualifizierend |
| Stage = null/leer | Epic wird übersprungen (kein Stage = kein Datenpunkt) |
| Squad = null/leer | Epic wird Squad `'(kein Squad)'` zugeordnet |
| BRP Etappen fehlt | Stages alphabetisch sortieren, kein Fehler |
| Alle Epics eines Squads in einer Stage haben keine AK | 0 % (nicht Lücke, da N > 0) |
| N = 0 für Stage+Squad | Lücke in der Linie (null, nicht 0 %) |

---

## E – Config (localStorage)

**localStorage-Key:** `fhwa_akzeptanz`

| Property | Typ | Default | Min | Max | Effekt | Validierung |
|---|---|---|---|---|---|---|
| `title` | String | `'Akzeptanzkriterien'` | – | – | Tile-Header-Titel | `_esc()` beim Rendern |
| `dotRadius` | Number | `5` | `3` | `10` | Basis-Radius der Datenpunkte | Clamp auf [3, 10] |

---

## F – Design-Standards

| Standard | Entscheidung | Details |
|---|---|---|
| Tooltip boundary-safe | ✅ Pflicht | `position:fixed` (Tile hat `overflow:hidden`), Boundary-Check gegen `window.innerWidth/Height` |
| Tooltip mit Links | ✗ nicht benötigt | Kein Link-Feature (aggregiertes Visual) |
| N-Anzeige | ✅ Diag-Bar | `Squad: {name} · n=X Epics · Y Etappen` |
| Reihenfolge-Panel | ✗ nicht benötigt | Etappen immer chronologisch |
| Skalierung | ✅ Pflicht | Alle Größen relativ zu Container-Breite/-Höhe |
| Diagnosemodus | ✅ Pflicht, immer sichtbar | Diag-Bar: Anzahl Epics, Etappen, Squads |
| Link-Feature | ✗ nicht benötigt | – |
| Y-Achse | Fix 0–100 % | Ticks via `core.intTicks(100, 5)` → 0, 25, 50, 75, 100 |
| X-Achsen-Label | Stage-Name als „Etappe N" | Label aus `BRP Etappen.Etappe`, kein Datum |
| Theme | ✅ Pflicht | `core.scatterColors()` für Grid, Achsen, Dot-Stroke; Linienfarben aus `core.palette()` |
| Config-Panel | ✅ `position:fixed` | Wegen `overflow:hidden` auf `.tile`. Schließt bei Klick außerhalb. |
| XSS-Schutz | ✅ Pflicht | `_esc()` für alle Werte aus localStorage in innerHTML |

---

## G – Akzeptanzkriterien

### Automatisch von Claude prüfbar
- [ ] localStorage-Key = `fhwa_akzeptanz`
- [ ] Events abonniert: `data`, `filter`, `theme`, `resize`
- [ ] Keine hardcodierten Theme-Farben (nur `core.palette()`, `core.scatterColors()`, CSS-Variablen)
- [ ] Y-Achsen-Ticks via `core.intTicks(100, 5)` → ganzzahlig (0, 25, 50, 75, 100)
- [ ] `_esc()` für Titel und Squad-Namen in innerHTML
- [ ] Stage+Squad mit N=0 → kein Datenpunkt (Lücke), nicht 0 %
- [ ] Stage+Squad mit N>0 und n=0 → 0,00 % Datenpunkt (keine Lücke)
- [ ] Wort-Schwelle: genau 4 Wörter → qualifiziert; genau 3 Wörter → nicht qualifiziert
- [ ] Kein Squad ausgewählt → Fehlermeldung, kein JS-Error
- [ ] Mehr als 1 Squad ausgewählt → Fehlermeldung „Bitte nur 1 Squad wählen", kein JS-Error

### Manuell durch Oliver zu testen
- [ ] Tooltip bleibt vollständig sichtbar an allen 4 Ecken der Tile
- [ ] Config-State (Titel, dotRadius) überlebt Browser-Reload
- [ ] JiraEpics fehlt in Excel → Fehlermeldung in Tile, kein JS-Error in Console
- [ ] BRP Etappen fehlt → Stages alphabetisch, kein Fehler
- [ ] Squad-Filter: genau 1 Squad aktiv → Linie gerendert
- [ ] Squad-Filter: mehrere Squads aktiv → „Bitte nur 1 Squad wählen"
- [ ] Squad-Filter: kein Filter → „Kein Squad ausgewählt"
- [ ] Stage ohne Epics für den gewählten Squad → Lücke in der Linie
- [ ] Theme-Toggle → Chart neu gerendert ohne Artefakte
- [ ] Config-Panel öffnet / schließt korrekt; Titel + Radius werden gespeichert
- [ ] Bei sehr kleiner Kachel: Punkte und Labels skalieren proportional, kein Überlappen

---

## Änderungshistorie

| Datum | Version | Änderung | Bestätigt von |
|---|---|---|---|
| 2026-06-18 | 1.0 | Initiale Spec nach SDD-Interview | Oliver |
| 2026-06-18 | 1.0 | Implementiert: akzeptanz.js, calc/akzeptanz.calc.js, 16 Unit-Tests | Oliver |
