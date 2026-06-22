# WIP – Work In Progress pro Person

**Version:** 1.3  
**Datum:** 2026-06-19  
**Status:** [ ] Entwurf → [x] Bestätigt (Gate 1) → [x] Implementiert

---

## A – Zweck & Abgrenzung

### Was das Visual macht
Zeigt das monatliche WIP (Work In Progress) pro Teammitglied für einen Squad als
Verlaufsdiagramm. Es beantwortet: „Wie viele Stories lagen gleichzeitig im Status
‚In Progress' – bezogen auf die Teamgröße?" Hohe Werte signalisieren Überlastung
oder mangelnden Flow.

### Was es NICHT macht
- Kein Cross-Filter auf andere Visuals
- Beeinflusst keine anderen Visuals, reagiert aber auf den Squad-Filter (core filter-Event)
- Zeigt keine absoluten Story-Zahlen als primäre Metrik (nur im Tooltip)
- Keine Referenzlinien im Diagramm

### Technologie
[x] Web-App (.js + core.js, standalone HTML in SharePoint)

---

## B – Datenmodell

### Quellen
| Quelle | Sheet / Objekt | Zugriff |
|---|---|---|
| Squadgröße | `SquadDaten` (Custom-Header) | `(core.state.sheetsRaw \|\| {})['SquadDaten'] ?? []` |
| Story-Daten | JiraStories | `core.filteredRows()` |

### SquadDaten – Struktur
- Zeile 1: leer (ignorieren)
- Zeile 2: Header → Spalte B = `"Squad"`, Spalten C–J = Quartalsnamen im Format `YYYY_QX`
  (Beispiele: `2025_01`, `2025_04`, `2026_02`)
- Zeilen 3–19: Datensätze; Spalte B = Squad-Name, Spalten C–J = Anzahl Teammitglieder (integer)
- Leerzeilen (Spalte B leer) werden übersprungen
- Header-Zeile wird per `findIndex(row => row.some(c => c === 'Squad'))` gefunden – nie hardcodiert, Spalte dynamisch via `indexOf('Squad')`

### Quartals-zu-Monats-Mapping
| Quartal (QX) | Monate |
|---|---|
| Q1 (`_01`) | Januar, Februar, März |
| Q2 (`_02`) | April, Mai, Juni |
| Q3 (`_03`) | Juli, August, September |
| Q4 (`_04`) | Oktober, November, Dezember |

Jede Quartalsspalte liefert 3 Datenpunkte (je 1 pro Monat). Die Teamgröße gilt für
alle 3 Monate des Quartals gleich. Format der generierten Monatsschlüssel: `YYYYMM`
(integer, z.B. `202501` für Januar 2025).

Wenn die Teamgröße für ein Quartal leer ist → Fallback: Teamgröße = 1.

### JiraStories – relevante Spalten
| Spaltenname | Typ | Verwendung |
|---|---|---|
| `In Progress` | Datum `DD.MM.YYYY HH:MM:SS` | Startmonat (YYYYMM) |
| `Resolved` | Datum oder leer | Endmonat (YYYYMM), leer = noch offen |
| `Rejected` | Datum oder leer | Endmonat (YYYYMM), leer = nie rejected |
| `Ready4Production` | Datum oder leer | Endmonat (YYYYMM), leer = noch nicht fertig |
| `Analysed` | Datum oder leer | Voraussetzung: muss ≤ In Progress |
| `Ready4Progress` | Datum oder leer | Voraussetzung: muss ≤ In Progress |

### Datumskonvertierung
```
parseToYYYYMM(val):
  Falls Date-Objekt: year*100 + month+1
  Falls String "DD.MM.YYYY ...": parts[2]*100 + parts[1]
  Falls String "YYYY-MM-...": year*100 + month
  Leer/ungültig → 0
```

---

## C – UX & Layout

### Hauptbereiche (ASCII-Sketch)
```
┌──────────────────────────────────────────────┐
│  WIP pro Person          [N = 47] [sep] [⚙] │
├──────────────────────────────────────────────┤
│  (Erklärungs-Panel, ausklappbar)             │
├──────────────────────────────────────────────┤
│  Y │                                         │
│    │    •                                    │
│    │   / \    •—•                            │
│    │  /   \  /                               │
│    │ •     \/                                │
│    └────────────────────────── X (Monate)   │
├──────────────────────────────────────────────┤
│  [Was zeigt diese Ansicht?]   [Fehlertext]   │
└──────────────────────────────────────────────┘
```

**Titel:** `WIP <span class="hl">pro Person</span>` – weißer Text, blau gefärbtes Suffix.

Visual ist ein Tile (`core.createTile()`), eingebettet im `tile-canvas-lieferfahigkeit`.

### Zeitraum
Es werden immer genau die **letzten 12 Monate** angezeigt, einschließlich des aktuellen Monats. Das Fenster wird dynamisch beim Rendern aus dem aktuellen Datum berechnet – keine manuelle Konfiguration. Beispiel (Stichtag 11.06.2026): Jun 2025 – Jun 2026 → 12 Datenpunkte.

### Single-Squad-Guard
Identisch zur Happiness-Index-Logik: Das Visual rendert nur wenn exakt **ein** Squad
im Filter ausgewählt ist. Bei 0 oder ≥ 2 Squads: Placeholder-Text
`„Bitte genau einen Squad auswählen"`, kein Diagramm.

### Interaktionen
| Aktion | Trigger | Effekt |
|---|---|---|
| Tooltip anzeigen | `mouseover` auf Punkt | Tooltip erscheint (boundary-safe) |
| Tooltip verschieben | `mousemove` auf Punkt | Tooltip folgt Maus |
| Tooltip ausblenden | `mouseout` | Tooltip `display:none` |
| Erklärungs-Panel öffnen/schließen | Klick auf „Was zeigt diese Ansicht?" | max-height-Transition, Panel klappt auf/zu |
| Einstellungen öffnen | Klick auf ⚙ | Panel erscheint in-visual |
| Filter ändert sich | `filter`-Event | Visual neu rendern |
| Theme wechselt | `theme`-Event | Farben aktualisieren, neu rendern |
| Resize | `resize`-Event | SVG neu rendern |

### Tooltip-Inhalt
```
Monat: März 2025
WIP/Person: 3.2
Stories in Progress: 14
Teamgröße: 7
```

### N-Anzeige
`N = X` im headerExtraEl (oben rechts im Tile-Header, links vom ⚙-Button).
N = Anzahl einzigartiger Stories die in mind. einem dargestellten Monat als WIP zählen.

### Leerzustand
| Situation | Anzeige |
|---|---|
| ≠ 1 Squad gewählt | „Bitte genau einen Squad auswählen" |
| Squad hat keine Stories | Diagramm mit WIP=0 für alle 12 Monate |
| SquadDaten-Sheet fehlt / Squad nicht drin | Teamgröße = 1 für alle 12 Monate (Fallback) |
| Monat liegt nicht in SquadDaten | Teamgröße = 1 für diesen Monat (Fallback) |

### Responsive
Das Visual füllt den Container via `width` auf der SVG (clientWidth/clientHeight beim render).
Größenänderungen werden über das globale `resize`-Event von core.js getriggert → Visual
rendert neu. Keine eigene Größenlogik.

---

## D – Berechnungslogik

### Zeitfenster
Das Fenster wird dynamisch aus dem aktuellen Datum berechnet:
```
nowYYYYMM   = aktuelles Jahr * 100 + aktueller Monat
startYYYYMM = nowYYYYMM − 11 Monate  (inklusiv, d.h. 12 Datenpunkte)
```
`allMonths` = die 12 YYYYMM-Werte von startYYYYMM bis nowYYYYMM (chronologisch).
Für jeden Monat in `allMonths` gilt: `teamSize = teamSizeByMonth[month] || 1`.

### Stichtag pro Monat
```
today        = aktuelles Datum (z.B. 20.06.2026)
refDate(M)   = Datum mit Tag=today.getDate(), Monat=M, Jahr aus M
               (Ausnahme: Monat M hat weniger Tage → letzter Tag des Monats)

Beispiel (heute = 20.06.2026):
  M = Jun 2026 → refDate = 20.06.2026
  M = Mai 2026 → refDate = 20.05.2026
  M = Feb 2026 → refDate = 20.02.2026
```

### WIP-Formel pro Monat M (Stichtag-Logik)
Ein Item zählt als WIP zum Stichtag refDate(M) wenn **alle** folgenden Bedingungen erfüllt sind:

```
ip  = core.toDate(item['In Progress'])   // Date | null
res = core.toDate(item['Resolved'])
rej = core.toDate(item['Rejected'])
r4p = core.toDate(item['Ready4Production'])
ana = core.toDate(item['Analysed'])
r4g = core.toDate(item['Ready4Progress'])
ref = refDate(M)

Bedingung:
  ip !== null                    // wurde überhaupt gestartet
  && ip <= ref                   // war spätestens am Stichtag in Progress
  && (res === null || res >= ref) // noch nicht resolved am Stichtag
  && (rej === null || rej >= ref) // noch nicht rejected am Stichtag
  && (r4p === null || r4p >= ref) // noch nicht Ready4Production am Stichtag
  && (ana === null || ana <= ip)  // Analysed vor/bei Start (null = toleriert)
  && (r4g === null || r4g <= ip)  // Ready4Progress vor/bei Start (null = toleriert)
```

**Semantik:** Snapshot – es zählen nur Items, die **am Stichtag noch aktiv** waren.
Ein Item, das z.B. am 10. Juni resolved wurde, zählt für Juni (Stichtag 20.06.) **nicht**.

### WIP pro Person
```
wipCount(M)     = Anzahl Items die obige Bedingung für Stichtag refDate(M) erfüllen
teamSize(M)     = Squadgröße aus SquadDaten für das Quartal das M enthält
                  (Fallback: 1 wenn leer oder Squad nicht gefunden)
wipPerPerson(M) = Math.round(wipCount(M) / teamSize(M) * 100) / 100
```

### Linienfarbe
Schwellenwerte konfigurierbar (Default: grün ≤ 4, gelb ≤ 6, rot > 6).

```
colorFor(v):
  v <= threshGreen  → colorGreen
  v <= threshYellow → colorYellow
  else              → colorRed
```

**Punkt:** erhält `colorFor(wipPerPerson(M))`  
**Liniensegment A→B:** erhält `colorFor(wipPerPerson(B))` — Farbe des **Zielpunkts**

### Edge Cases
| Situation | Verhalten |
|---|---|
| `In Progress` leer/ungültig (ip=null) | Item wird nicht gezählt |
| Teamgröße = 0 oder leer | Fallback teamSize = 1 |
| `Analysed` oder `Ready4Progress` leer (null) | Bedingung gilt als erfüllt |
| Squad-Name nicht in SquadDaten | Monate aus Header-Zeile, Teamgröße = 1 für alle Monate, Diag-Hinweis |
| SquadDaten-Sheet fehlt | Teamgröße = 1, kein Abbruch |
| Monat kürzer als today.getDate() (z.B. Feb, heute = 31.) | refDate = letzter Tag des Monats |
| Math.max() auf leerem Array | Abgesichert: `values.length ? Math.max(...values) : 0` |

---

## E – Config (localStorage)

localStorage-Key: `fhwa_wip`

| Property | Typ | Default | Min | Max | Effekt | Validierung |
|---|---|---|---|---|---|---|
| `threshGreen` | number | `4` | 0.1 | – | Obere Grenze für grünen Bereich | threshGreen < threshYellow |
| `threshYellow` | number | `6` | 0.1 | – | Obere Grenze für gelben Bereich | threshYellow > threshGreen; sonst auto +1 |
| `colorGreen` | color | `#4caf50` | – | – | Farbe für grünen Bereich | gültiger CSS-Farbwert |
| `colorYellow` | color | `#ff9800` | – | – | Farbe für gelben/orangen Bereich | gültiger CSS-Farbwert |
| `colorRed` | color | `#e53935` | – | – | Farbe für roten Bereich | gültiger CSS-Farbwert |

---

## F – Design-Standards (Pflichtcheck)

| Standard | Entscheidung | Details |
|---|---|---|
| Tooltip boundary-safe | ✅ Pflicht | `positionTooltip()` mit Overflow-Prüfung (§9.3) |
| Tooltip mit Links | Nein | Kein Hover-Delay nötig |
| N-Anzeige | ✅ Pflicht | `N = X Stories` im headerExtraEl (links vom ⚙-Button) |
| Erklärungs-Panel | ✅ | Ausklappbar via „Was zeigt diese Ansicht?" im linken Footer |
| Reihenfolge-Panel | Nicht benötigt | Zeitachse ist fix (chronologisch) |
| Skalierung | ✅ Pflicht | `r = Math.max(4, Math.min(7, pW/80))` |
| Diagnosemodus | ✅ 3-spaltig | Links: „Was zeigt diese Ansicht?", Mitte: Fehler/Statustext |
| Link-Feature | Nicht benötigt | – |
| Theme | ✅ Pflicht | `core.scatterColors()` für Achsen; konfigurierte Farben für Punkte/Linien |
| Single-Squad-Guard | ✅ Pflicht | `filter.length !== 1` → Placeholder |

---

## G – Akzeptanzkriterien

### Automatisch von Claude prüfbar
- [x] Keine hardcodierten Farben außer Config-Defaults
- [x] localStorage-Key = `fhwa_wip`
- [x] Events abonniert: `data`, `theme`, `filter`, `resize`
- [x] Liniensegment A→B hat Farbe von Punkt B (nicht A, nicht schlechteste)
- [x] `threshGreen < threshYellow` wird beim Speichern validiert (auto-korrektur: +1)
- [x] `Math.max()` auf leerem Array abgesichert
- [x] Zeitfenster = exakt 12 Monate, immer inklusive aktuellem Monat
- [x] Monate ohne SquadDaten-Eintrag erhalten Teamgröße = 1 (kein Abbruch)

### Manuell durch Oliver zu testen
- [ ] Tooltip bleibt vollständig sichtbar an allen 4 Ecken der Card
- [ ] Config-State überlebt Browser-Reload
- [ ] Bei 0 Datenzeilen: Diagnosemeldung sichtbar, kein JS-Error in Console
- [ ] Farbwechsel der Linie zeigt Ziel-Farbe (nicht Quell-Farbe)
- [ ] Exakt 1 Squad gewählt → Diagramm erscheint; 0 oder 2+ → Placeholder
- [ ] Schwellenwerte im Config-Panel ändern → Punkte + Linien sofort aktualisiert
- [ ] Leeres Quartal in SquadDaten → Teamgröße = 1, kein Fehler, kein JS-Error

---

## Änderungshistorie

| Datum | Version | Änderung | Bestätigt von |
|---|---|---|---|
| 2026-06-09 | 1.0 | Initiale Spec nach SDD-Interview + Implementierung | Oliver |
| 2026-06-09 | 1.1 | Bugfix: Header-Suche auf `row.some()` umgestellt (war `row[1]`); Squad-Fallback liefert jetzt Monate aus Header-Zeile mit Teamgröße=1 | Oliver |
| 2026-06-11 | 1.2 | Zeitraum fest auf letzte 12 Monate (inkl. aktueller Monat) begrenzt; SquadDaten-Sheet nicht mehr für Monatsgenerierung benötigt; Fallback Teamgröße=1 für nicht abgedeckte Monate | Oliver |
| 2026-06-19 | 1.3 | Titel mit hl-Span; Erklärungs-Panel; 3-spaltiger Footer mit „Was zeigt diese Ansicht?" links; N-Format auf `N = X` vereinheitlicht | Oliver |
| 2026-06-22 | 1.4 | WIP-Bedingung auf Stichtag-Logik umgestellt: `core.toDate()` statt YYYYMM-Integer; refDate(M) = gleicher Tag wie heute in Monat M → entspricht Excel-Formel | Oliver |
