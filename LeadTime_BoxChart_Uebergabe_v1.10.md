# LeadTime BoxChart – Projektübergabe

*Version 1.10.0.0 — Autor: Oliver Wolter — Letzte Aktualisierung: Mai 2026*

---

## Was das Visual macht

Box-Plot-Diagramm zur Analyse der Lead Time eines Teams über Zeit. Zeigt für jede Periode (Monat oder Quartal) die Verteilung der Lead-Time-Werte. Ab v1.6 sind drei Ansichtsmodi wählbar: **Boxplot**, **Violin** und **Kombination**.

**Zwei Betriebsmodi:**
- **Dynamisch**: Lead Time wird direkt im Visual aus `End-Datum − Start-Datum` berechnet (in Tagen).
- **Vorberechnet**: Nimmt einen bereits berechneten numerischen Tageswert entgegen.

**X-Achse**: Rolling-Sortierung – beginnt beim aktuellen Monat/Quartal.

**Ansichtsmodi (ab v1.6):**
- **Box** (Default): Boxplot mit P25/Median/P85, Whisker, Ausreißer-Punkte
- **Violin**: KDE-Kurve, getrimmt auf echten Min/Max der Daten, keine Ausreißer-Punkte
- **Kombi**: Violin + eingebetteter Boxplot + Ausreißer-Punkte

**In-Visual-Steuerung (ab v1.6/v1.8):**
- Buttons `Box | Violin | Kombi` oben rechts – überschreiben den Format-Panel-Default
- Button `Ausr. ●/○` – blendet Ausreißer-Punkte ein/aus

**Kapazität (ab v1.10):**
- Bis zu **30.000 Zeilen** werden von Power BI an das Visual gesendet (`dataReductionAlgorithm: top 30000`)

---

## Was es NICHT macht (Abgrenzung)

- Kein DAX, keine berechneten Felder innerhalb des Visuals
- Kein Cross-Filter auf andere Visuals
- Kein Drill-Through
- Kein Klick direkt auf Box oder Whisker (nur Hover-Tooltip)
- Kein Link für Box/Whisker – nur für Ausreißer-Punkte
- Keine Per-Periode-Farbkonfiguration (nur global)

---

## Datenmodell (Power BI Rollen)

| Rolle | Anzeigename | Kind | Beschreibung |
|---|---|---|---|
| `period` | Period (Monat oder Quartal) | Grouping | Monats-/Quartalsspalte – direkte Datumsspalte, max:1 |
| `leadTime` | Lead Time (Tage) – vorberechnet | GroupingOrMeasure | Numerischer Tageswert (vorberechneter Modus) |
| `startDate` | Start-Datum | GroupingOrMeasure | Startdatum des Work Items |
| `endDate` | End-Datum | GroupingOrMeasure | Enddatum des Work Items |
| `issueKey` | Issue Key | Grouping | Optional: Bezeichner für URL-Template `{issueKey}` |
| `issueUrl` | Issue URL | Grouping | Optional: fertige URL – Vorrang vor URL-Template |

---

## Projektstruktur

Das Visual liegt als kompilierte `.pbiviz`-Datei vor (kein separates TypeScript-Projekt).
Quellcode ist als minifiziertes JS im `content.js`-Feld der inneren `pbiviz.json` gespeichert.

```
LeadTime_BoxChart_v1.10.pbiviz
  package.json                                    ← version: "1.10.0.0"
  resources/
    leadTimeBoxChart1234567890.pbiviz.json        ← JS + capabilities + icon
```

**Build-Workflow (Patching ohne Quellcode):**
```bash
# 1. Entpacken
unzip LeadTime_BoxChart_v1.10.pbiviz -d extracted/

# 2. JS + capabilities in extracted/resources/*.pbiviz.json bearbeiten

# 3. Version hochzählen in extracted/package.json + im JS selbst

# 4. Korrekt zurückzippen (aus extracted/ heraus!)
cd extracted/
zip ../LeadTime_BoxChart_v1.11.pbiviz package.json resources/ resources/leadTimeBoxChart1234567890.pbiviz.json

# 5. Validieren
unzip -l ../LeadTime_BoxChart_v1.11.pbiviz
# Erwartet: genau 3 Einträge
```

---

## Format-Panel Einstellungen

### Karte: „Anzeige" (`displayOptions`)

| Property | Typ | Default | Beschreibung |
|---|---|---|---|
| `chartMode` | Enum | `"box"` | Ansicht-Default: `"box"` / `"violin"` / `"combo"` |
| `bandwidth` | NumUpDown | `4` | Violin KDE-Glättung. Kleiner = mehr Detail, größer = glatter |
| `showOutliers` | bool | `true` | Ausreißer-Punkte anzeigen (Box + Kombi-Modus) |
| `showDiag` | bool | `false` | Diagnosemodus anzeigen |
| `urlTemplate` | text | `""` | URL-Template, z.B. `https://jira.company.com/browse/{issueKey}` |

### Karte: „Farben" (`colorOptions`)

| Property | Anzeigename | Default |
|---|---|---|
| `boxFill` | Box Füllung | `#1e3a8a` |
| `boxStroke` | Box Rahmen | `#3b82f6` |
| `violinFill` | Violin Füllung | `#0f2a50` |
| `violinStroke` | Violin Rahmen | `#3b82f6` |
| `medianColor` | Median-Linie | `#ffffff` |
| `p85Color` | P85-Linie | `#f59e0b` |
| `whiskerColor` | Whisker | `#64748b` |
| `outlierColor` | Ausreißer (ohne Link) | `#ef4444` |
| `outlierUrlColor` | Ausreißer (mit Link) | `#fb923c` |

Alle Farben sind global (alle Perioden gleich). Reset auf Default: ×-Button im Farb-Picker.

### Karte: „Berechnungsmodus" (`calculationMode`)

| Property | Typ | Default | Werte |
|---|---|---|---|
| `mode` | Enum | `"auto"` | `"auto"` / `"dynamic"` / `"precomputed"` |

---

## In-Visual-Steuerung (Session-Override, nicht persistiert)

| Button | Funktion |
|---|---|
| `Box` / `Violin` / `Kombi` | Ansichtsmodus – überschreibt Format-Panel `chartMode` |
| `Ausr. ●` / `Ausr. ○` | Ausreißer ein-/ausblenden – überschreibt Format-Panel `showOutliers` |

Der Override gilt nur für die aktuelle Session. Nach Bericht-Neustart gilt wieder der Format-Panel-Wert.

---

## Aktive Design-Standards (aus pbiviz_entwickeln.md §9)

- [x] **§9.2 Diagnosemodus**: oben, Standard: aus. Zeigt Spalten, Items, Perioden, Modus, Ansicht, Ausreißer-Status, Links.
- [x] **§9.3 Tooltip boundary-safe**: `positionTooltip()` mit Overflow-Prüfung. Box-Tooltip + Outlier-Tooltip getrennt.
- [x] **§9.4 N-Anzeige**: `n=XX` unter jeder Kategoriebeschriftung, alle 3 Ansichtsmodi.
- [x] **§9.5 Skalierung**: Dot-Größe relativ zu Viewport-Breite, Violin-Breite relativ zu `xStep`.
- [-] **§9.1 Reihenfolge-Steuerung**: nicht relevant (Rolling-Sort).
- [x] **§9.6 Icon**: eigenes Motiv (blau Box + amber P85-Linie + rote Ausreißer).
- [x] **§9.7 Link-Feature**: `issueUrl` + `urlTemplate` + `host.launchUrl()` + Hover-Delay 120ms (§4.9).

---

## Statistik-Logik

```
IQR   = P85 − P25               (bewusst P85 statt P75)
Fence = 1,5 × IQR
Whisker oben  = min(max(Werte), P85 + Fence)
Whisker unten = max(min(Werte), P25 − Fence)
Ausreißer     = Werte außerhalb [Whisker unten, Whisker oben]
Perzentile: lineare Interpolation
```

**Violin KDE:**
```
Gaussian Kernel, trimmed auf echten Min/Max der Daten (cut=0)
Bandwidth: konfigurierbar im Format-Panel (Default: 4)
Steps: 80 Stützpunkte
```

---

## Rolling-Sort Logik

```
Heute = Mai 2026
Monate   → Mai, Jun, Jul, ..., Dez, Jan, Feb, Mär, Apr
Quartale → Q2, Q3, Q4, Q1
```

Wenn alle Perioden in der Vergangenheit → chronologische Reihenfolge.

---

## Bekannte Bugs und Lösungen (vollständige Historie)

| Symptom | Ursache | Fix | Version |
|---|---|---|---|
| Y-Achse zeigt `0.00018d` | Datumshierarchie gibt Ganzzahlen statt Timestamps | `toDate()` erkennt Zahlen < 15000 als ungültig | v1.0 |
| Toggle „Ausreißer" springt zurück | `getFormattingModel()` gab `value: true` hardcodiert | Wert aus `lastDV.metadata.objects` lesen | v1.1 |
| Monate falsch sortiert | `MONTH_MAP` hatte `är:3` statt `mär:3` | Key korrigiert | v1.1 |
| `000000d` am Y-Achsen-Ursprung | `fmtDays(0)` fiel in `< 0.01`-Kategorie | `if (v===0) return "0d"` Guard | v1.2 |
| Tooltip verschwindet am Rand | Feste Offset-Positionierung | `positionTooltip()` mit Overflow-Prüfung | v1.3 |
| Kein Modus-Override möglich | Keine Format-Panel-Enum-Property | `calculationMode.mode` Dropdown | v1.3 |
| Datumshierarchie im `period`-Feldwell | Kein `max:1` in conditions | `conditions: [{period:{max:1}}]` | v1.3 |
| Titel standardmäßig deaktiviert | `suppressDefaultTitle: true` | Property entfernt | v1.4 |
| Icon fehlt | `pbiviz new` Platzhalter | cairosvg-Icon mit Visual-Motiv | v1.4 |
| Tooltip verschwindet vor Link-Klick | Kein Hover-Delay | 120ms Delay + `pointerEvents:all` | v1.4 |
| `pbiviz package` schlägt fehl: author | `author` in `visual{}` statt Root-Level | `author` auf Root-Level | v1.5 |
| `privileges` Fehler | `["ExternalLink"]` unbekannt in pbiviz 7.0.3 | `privileges: []` | v1.5 |
| Violin Produkt B fehlte | KDE `reduce`: `acc =` statt `acc +=` | `acc + Math.exp(...)` in reduce-Callback | v1.6 |
| „Ausreißer anzeigen" Toggle unsichtbar | Slice-Reihenfolge nach Umbau | Neue eigenständige uid `showOutliers_sl` | v1.7 |
| Ausreißer-Button fehlt im Visual | In-Visual-Button nicht implementiert | `Ausr.`-Toggle-Button in Button-Bar | v1.8 |
| Visual komplett leer (keine Buttons, keine Daten) | `showOut` in `draw()` verwendet aber nie als Parameter übergeben → ReferenceError in strict mode | `draw()`-Aufruf: `...bw,C,showOut)` / Signatur: `draw(...,C,showOut){` | v1.9 |
| „Zu viele Elemente" bei > 1.000 Items, Visual bleibt leer | Fehlender `dataReductionAlgorithm` in capabilities → Power BI sendet standardmäßig max. 1.000 Zeilen | `"dataReductionAlgorithm": { "top": { "count": 30000 } }` in `dataViewMappings` | v1.10 |

---

## Zusammenarbeits-Protokoll (§0, aktiv)

- **Gate 1** (Anforderungs-Freeze): wird vor jedem neuen Feature durchgeführt ✓
- **Gate 2** (Pre-Delivery Review): wird vor jeder Datei-Übergabe durchgeführt ✓
- **M1**: Eine Frage pro Antwort (Ausnahme: Gate 1) ✓
- **M3**: Design-Entscheidungen mit Begründung benennen ✓
- **M4**: Übergabe-Dokument ab Nachricht 15 ✓ (dieses Dokument)
- **M5**: `pbiviz_entwickeln.md` nach jedem neuen Bug ergänzen ✓
- **M6**: Kein Code vor Prototyp-Freigabe (Ausnahme: Bugfixes) ✓

---

## Nächste mögliche Features (Backlog)

| Feature | Aufwand | Notizen |
|---|---|---|
| **Referenzlinie** (SLA-Grenze) | Klein | Horizontale Linie mit konfigurierbarem Wert + Label im Format-Panel |
| **Konfigurierbares Perzentil** | Klein | P75 / P85 / P90 wählbar statt fest P85 |
| **Tooltip: Min/Max** | Klein | Zusätzlich zu Whisker ↑/↓ |
| **Whisker-Endwerte am Chart** | Mittel | Direkte Beschriftung der Whisker-Enden |
| **Cross-Filter** | Groß | `selectionManager` – Klick auf Periode filtert andere Visuals |
| **Per-Periode-Farben** | Mittel | Jede Periode bekommt eigene Farbkonfiguration |

---

## pbiviz_entwickeln.md – Ergänzungen aus diesem Chat

Folgende neue Einträge sollten in `pbiviz_entwickeln.md` §4 und §11 ergänzt werden:

**§4 – Neue Falle: fehlende Parameter-Übergabe an Hilfsfunktionen**
```
Symptom: Visual komplett leer, kein Fehler in Diagnose sichtbar
Ursache: Variable in update() definiert, aber nicht an draw() (oder andere
         interne Methoden) als Parameter weitergegeben → ReferenceError in
         strict mode, bricht vor erstem DOM-Aufruf ab
Fix:     Bei jedem Refactoring prüfen: alle Variablen die in einer
         Hilfsmethode genutzt werden, müssen explizit übergeben werden
```

**§4 – Neue Falle: fehlender dataReductionAlgorithm**
```
Symptom: Visual zeigt „Zu viele Elemente" / bleibt leer sobald mehr als
         ~1.000 Zeilen im Datensatz sind
Ursache: Fehlt dataReductionAlgorithm in capabilities.dataViewMappings →
         Power BI sendet standardmäßig maximal 1.000 Zeilen
Fix:     In dataViewMappings[0].table.rows hinzufügen:
         "dataReductionAlgorithm": { "top": { "count": 30000 } }
         (30.000 ist das Maximum das Power BI an Custom Visuals sendet)
Gate 2:  Prüfpunkt ergänzen: dataReductionAlgorithm vorhanden?
```

**§11 – Ressourcenverbrauch:**
```
| Visual leer bei > 1.000 Items | Fehlender dataReductionAlgorithm in capabilities | "dataReductionAlgorithm": {"top":{"count":30000}} in dataViewMappings |
| Variable in Hilfsmethode nicht übergeben → alles leer | ReferenceError in strict mode vor erstem DOM-Aufruf | Alle Variablen explizit als Parameter übergeben, Gate 2 prüft das |
```
