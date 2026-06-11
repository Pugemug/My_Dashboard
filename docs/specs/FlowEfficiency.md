# Spec: Flow Efficiency (flowefficiency.js)

**Version:** 1.1  
**Datum:** 2026-06-09  
**Status:** Bestätigt (Gate 1 freigegeben)  
**localStorage-Key:** `fhwa_flowefficiency`

---

## Block A – Zweck & Abgrenzung

**Was zeigt es:** Monatlicher Verlauf der Flow Efficiency (FE%) als Linienchart mit Punkten oder als Violin-Chart (umschaltbar). Die FE misst welcher Anteil der Lead Time echte aktive Arbeit war — im Gegensatz zu Warte- und Blockier-Zeit.

**Welches Problem löst es:** Teams sehen auf Monatsbasis ob ihr Prozess effizient ist oder ob Wartezeiten (Ready4Test, Blocked, …) die Lieferfähigkeit dominieren. Der Violin-Modus zeigt zusätzlich die Streuung der FE%-Werte einzelner Items pro Monat.

**Was es NICHT tut:**
- Kein Cross-Filter auf andere Visuals
- Kein Link auf Jira-Items (kein `urlTemplate`)
- Keine Anzeige aktiver (nicht-Resolved) Items
- Keine eigene Status-Reihenfolge (kein `statusOrder`-Event nötig)

**Technologie:** Web-App, Tile auf Lieferfähigkeit-Page (`core.createTile()`), localStorage-Key `fhwa_flowefficiency`.

---

## Block B – Datenmodell

### Quellen

| Sheet | Zugriff | Pflicht? |
|---|---|---|
| `JiraStories` | `core.filteredRows()` | ✅ |
| `JiraBlockermanagement` | `core.state.sheets['JiraBlockermanagement'] ?? []` | optional |

### JiraStories — genutzte Spalten

| Spalte | Typ | Pflicht? | Verwendung |
|---|---|---|---|
| `Jira-ID` | string | ✅ | Join-Schlüssel mit JiraBlockermanagement |
| `Squad` | string | optional | Join-Schlüssel + globaler Squad-Filter |
| `Ready4Progress_first` | Datum | ✅ | LT-Start |
| `Resolved` | Datum | ✅ | LT-Ende + Monats-Gruppierung |
| `Rejected` | string/Datum | optional | Ausschluss-Logik (XOR mit Resolved) |
| `Blocked_first`, `leaving_Blocked_first`, `Blocked`, `leaving_Blocked` | Datum | optional | Warte-Zeit Dual-Period |
| `Ready4Test_first`, `leaving_Ready4Test_first`, `Ready4Test`, `leaving_Ready4Test` | Datum | optional | Warte-Zeit Dual-Period |
| `Ready4QS_first`, `leaving_Ready4QS_first`, `Ready4QS`, `leaving_Ready4QS` | Datum | optional | Warte-Zeit Dual-Period |
| `Ready4Review_first`, `leaving_Ready4Review_first`, `Ready4Review`, `leaving_Ready4Review` | Datum | optional | Warte-Zeit Dual-Period |
| `Ready4E2E-Test_first`, `leaving_Ready4E2E-Test_first`, `Ready4E2E-Test`, `leaving_Ready4E2E-Test` | Datum | optional | Warte-Zeit Dual-Period |
| `Ready4Production_first`, `leaving_Ready4Production_first`, `Ready4Production`, `leaving_Ready4Production` | Datum | optional | Warte-Zeit Dual-Period |

### JiraBlockermanagement — genutzte Spalten

| Spalte | Typ | Pflicht? | Verwendung |
|---|---|---|---|
| `issues.key` | string | ✅ | Join auf `Jira-ID` in JiraStories |
| `Squad` | string | ✅ | Join-Schlüssel |
| `BlockiertWartendSeit` | number (Tage) | ✅ | Zusätzliche Wartezeit (Zusatz-Episoden) |
| `Blockiert/Wartend_Zustand` | string | optional | Dedup-Prüfung + Tooltip-Breakdown |
| `Blockiert/Wartend_Grund` | string | optional | Tooltip-Kontext |

**`Modifier`-Spalte:** wird ignoriert.

### Erkennungslogik

- Resolved = `Resolved`-Spalte gefüllt, `Rejected` leer (XOR-Logik)
- Nur Items mit `Ready4Progress_first` **und** `Resolved` gefüllt fließen in FE ein
- JiraBlockermanagement-Zeilen ohne `BlockiertWartendSeit` oder mit `BlockiertWartendSeit ≤ 0` werden übersprungen

---

## Block C – UX & Layout

### Hauptbereiche (ASCII)

```
┌──────────────────────────────────────────────────────────┐
│ Flow Efficiency   [Linie|Violin]   N=42   [?]   [⚙]      │  ← Tile-Header
├──────────────────────────────────────────────────────────┤
│                                                          │
│  100% ┤                                                  │
│   75% ┤                                                  │
│   50% ┤    ●              ●                              │
│       ┼──────────────────────────── (Ziellinie 40%)      │
│   25% ┤              ●                                   │
│    0% ┤                                                  │
│       Jan  Feb  Mär  Apr  Mai  …                         │
│                                                          │
├──────────────────────────────────────────────────────────┤
│ Zeigt den Anteil aktiver Arbeit… │ 0 Fehler │ Flow → ⬡  │  ← diagEl (3-spaltig)
└──────────────────────────────────────────────────────────┘
```

**Diag-Leiste (3-spaltig, Flexbox):**
- **Links:** Fester Erklärungstext: *„Zeigt den Anteil echter aktiver Arbeit an der Gesamtdurchlaufzeit — je höher, desto weniger Wartezeit im Prozess."* (gedimmt, `font-size: 11px`, `overflow: hidden`, `text-overflow: ellipsis`, `white-space: nowrap`)
- **Mitte:** Dynamische Zähler-Meldung (bisheriger `diagEl`-Inhalt): `„N Items · M Monate · K Datenfehler ausgeschlossen [· Sheet-Hinweis]"` (zentriert)
- **Rechts:** Link-Button `„Flow analysieren →"` → navigiert zur Heatmap-Page (`core.showPage('heatmap')`)

### Hilfe-Modal (?-Button)

Der `[?]`-Button im Tile-Header öffnet ein großes Overlay-Modal mit der vollständigen Erklärung der Flow Efficiency.

**Darstellung:**
- Zentriertes Modal, `~80vw × 85vh`, scrollbar (overflow-y: auto)
- Backdrop (halbtransparent), klick auf Backdrop schließt Modal
- `✕`-Schließen-Button oben rechts im Modal-Header
- `Escape`-Taste schließt Modal

**Inhalt (entspricht FlowEfficiency_Erklaerung.html, Abschnitte in dieser Reihenfolge):**
1. **Was ist Flow Efficiency?** — Text + SVG-Grafik (Lead Time aufgeteilt in aktive Zeit / Wartezeit mit FE%-Berechnung)
2. **Aufbau & Datenfluss** — Text + SVG-Grafik (Datenquellen → _compute() → Aggregat → _renderChart())
3. **Berechnungslogik Schritt für Schritt** — Text + SVG-Grafik (5-Schritte-Flussdiagramm) + Tabelle Edge Cases
4. **Die zwei Chart-Modi** — Tabelle (Linie / Violin)
5. **Einstellungen** — Tabelle (Monate, Ziellinie FE%, Ziellinie anzeigen, Mode)
6. **Leerzustände & Fehlermeldungen** — Tabelle

**Theming der SVG-Grafiken:**
SVG-Farben werden auf CSS-Variablen der App umgestellt — kein hardcodiertes Styling. Mapping:
| HTML-Farbe (Originalstyle) | CSS-Variable |
|---|---|
| `#1a1a18` (Haupt-Text) | `var(--text)` |
| `#faf9f7` (Page-Hintergrund) | `var(--bg)` |
| `#ffffff` (Card-Hintergrund) | `var(--bg2)` |
| `#d3d1c7` (Border) | `var(--border)` |
| `#f1efe8` (Table-Header-BG) | `var(--bg4)` |
| `#3d3d3a` (Text sekundär) | `var(--dim)` |
| `#73726c` (Subtitle) | `var(--dimmer)` |
| `#e6f1fb` / `#378add` (Info-Box) | `var(--blue)` mit Opacity |
| `#eeedfe` / `#534ab7` (Lila, FE%) | unverändertes Lila (funktional) |
| `#e1f5ee` / `#0f6e56` (Grün, aktive Zeit) | unverändertes Grün (funktional) |
| `#faeeda` / `#854f0b` (Amber, Warten) | unverändertes Amber (funktional) |

Füllfarben der fachlichen Elemente (aktive Zeit = grün, Warten = amber, FE = lila) bleiben unverändert — sie sind semantisch, nicht themabhängig.

### Interaktionen

| Aktion | Verhalten |
|---|---|
| **Hover auf Punkt/Violin** | Tooltip mit Monat, FE% (Median, N), Ø Lead Time, Ø Aktive Zeit, Ø Wartezeit, Wartezeit-Breakdown nach `Blockiert/Wartend_Zustand` |
| **Violin-Modus Hover** | Tooltip zusätzlich: Min, Max, IQR der FE%-Einzelwerte |
| **Mode-Toggle [Linie\|Violin]** | Wechsel zwischen Linienchart und Violin-Chart, State wird in cfg gespeichert |
| **⚙-Button** | Öffnet per-tile Settings-Panel (Overlay, zentriert) |
| **?-Button** | Öffnet Hilfe-Modal (Overlay, ~80vw × 85vh, scrollbar) |
| **Ziellinie** | Punkte/Violin rot wenn FE% < Ziellinie, grün wenn ≥ Ziellinie |
| **„Flow analysieren →" Link** | `core.showPage('heatmap')` — navigiert zur Heatmap-Page |
| **Backdrop-Klick / Escape / ✕** | Schließt Hilfe-Modal |

### Settings-Panel (per-tile Overlay)

- **Monate (Fenster):** Slider 3–36, Default 12 — rollierendes Fenster ab heute rückwärts
- **Ziellinie FE%:** Slider 0–100%, Default 40%
- **Ziellinie anzeigen:** Toggle ein/aus, Default an

### Leerzustand

| Situation | Verhalten |
|---|---|
| Keine Datei geladen | Tile leer, Mitte der Diag-Leiste: Standard-Leertext |
| `JiraBlockermanagement` fehlt | Visual rechnet trotzdem (nur JiraStories-Wartezeiten), Mitte der Diag-Leiste: „JiraBlockermanagement fehlt – nur Status-Wartezeiten" |
| Alle Items nach Filter ausgeblendet | SVG leer, Mitte der Diag-Leiste: „Keine Resolved Items im Zeitraum – Datei laden oder Filter anpassen" |

### Responsive

Alle Größen (Achsen, Punkte, Violins, Schrift) relativ zu `contentEl.clientWidth / clientHeight`. Violin-Halbbreite: `Math.min(slotWidth × 0.38, 26px)`.

---

## Block D – Berechnungslogik

### Konstanten

```javascript
WAIT_STATUS = [
  'Blocked', 'Ready4Test', 'Ready4QS',
  'Ready4Review', 'Ready4E2E-Test', 'Ready4Production'
]
```

### Kern-Formeln

```
LT(item) = core.dur(item['Ready4Progress_first'], item['Resolved'])
           // Tage inklusiv (Dual-Period nicht nötig: LT ist Start→Ende-Spanne)

Warte_JiraStories(item) =
  Σ über WAIT_STATUS s:
    _dualPeriodDays(item, s)
    // Dual-Period-Logik: Threshold 43.200.000 ms (0,5 Tage)

Dedup-Regel:
  JiraBlockermanagement-Episode überspringen wenn
  Blockiert/Wartend_Zustand.toLowerCase() ∈ WAIT_STATUS_LOWER
  → bereits in Warte_JiraStories enthalten

Warte_Zusatz(item) =
  Σ über JiraBlockermanagement-Zeilen (issues.key = item['Jira-ID'], Squad = item['Squad']):
    IF Dedup-Regel greift  → 0
    ELSE                   → BlockiertWartendSeit

Gesamt_Wartezeit(item) = Warte_JiraStories + Warte_Zusatz

Aktive_Zeit(item) = LT − Gesamt_Wartezeit

FE%(item) = Aktive_Zeit / LT × 100
```

### Dual-Period-Logik

```
_dualPeriodDays(row, status):
  e0 = row[status],           x0 = row['leaving_' + status]
  e1 = row[status + '_first'], x1 = row['leaving_' + status + '_first']

  IF !e0 OR !x0 → return 0

  IF e1 AND x1 AND |e1 − e0| ≥ 43.200.000 ms:
    // Zwei Durchläufe
    return (x1 − e1) / 86.400.000 + 1  +  (x0 − e0) / 86.400.000 + 1
  ELSE:
    // Ein Durchlauf
    return (x0 − e0) / 86.400.000 + 1
```

### Monats-Aggregation

- Gruppierung: Monat von `Resolved`-Datum (`YYYY-MM`)
- Rollierendes Fenster: letzte `cfg.months` Monate ab heute (cutoff = erster Tag des Fenster-Startmonats)
- Aggregat pro Monat: **Median** aller FE%-Werte des Monats (`core.pct(sorted, 50)`)
- Monate ohne Items werden nicht gezeichnet

### Violin-Modus — KDE

```
Bandwidth bw = max(1.06 × σ × n^(-0.2),  4)
KDE-Auflösung: 60 Punkte gleichmäßig über [0%, 100%]
Darstellung: gespiegelte Kurve (links + rechts) · IQR-Box (20% der Halbbreite) · Median-Punkt
```

### Edge Cases

| Situation | Verhalten |
|---|---|
| `Ready4Progress_first` oder `Resolved` fehlt | Item überspringen (zählt nicht zu N) |
| `LT = 0` | Item überspringen (Division by zero) |
| `Rejected` gefüllt | Item überspringen (kein Resolved-Item) |
| `Gesamt_Wartezeit > LT` | Datenfehler: Item ausschließen, in `diagEl`-Zähler |
| Kein JiraBlockermanagement-Eintrag für Item | `Warte_Zusatz = 0`, nur JiraStories-Zeit |
| Kein Warte-Status-Eintrag UND kein JiraBlockermanagement | `FE% = 100%` |
| `cfg.months` geändert | `_compute()` wird neu ausgeführt (nicht nur `_renderChart()`) |

---

## Block E – Config / Format-Panel

| Property | Typ | Default | Min/Max | Effekt | Validierung |
|---|---|---|---|---|---|
| `months` | number | 12 | 3 / 36 | Rollierendes Fenster (Monate) | parseInt, clamp |
| `targetFE` | number | 40 | 0 / 100 | Y-Position der Ziellinie in % | parseFloat, clamp |
| `showTarget` | boolean | true | – | Ziellinie ein/aus | – |
| `mode` | string | `'line'` | `'line'` / `'violin'` | Chart-Typ | Whitelist |

Persistenz: `core.save('fhwa_flowefficiency', cfg)` / `core.load('fhwa_flowefficiency', DEF)`

---

## Block F – Design-Standards

| Check | Entscheidung |
|---|---|
| Tooltip | `position:fixed`, boundary-safe `_moveTT()` (vw/vh-Prüfung); kein Hover-Delay (keine Links im Tooltip) |
| N-Anzeige | Tile-Header rechts (`nBadge`, `N=42`) **+** im Tooltip pro Monat (`N=8`) |
| Reihenfolge-Panel | Nicht benötigt |
| Skalierung | Alle Maße relativ zu `contentEl.clientWidth / clientHeight` |
| Diagnosemodus | `diagEl`: `„N Items · M Monate · K Datenfehler ausgeschlossen [· Sheet-Hinweis]"` |
| Link-Feature | Nicht benötigt (kein `urlTemplate`) |
| Status-Reihenfolge | `core.loadGlobalStatusOrder()` nicht benötigt |
| Farben | `core.scatterColors()` + CSS-Variablen (`var(--red)`, `var(--green)` usw.) — keine Hardcodes |
| Events abonniert | `data`, `theme`, `filter`, `resize` |
| Theme-Switch | `theme`-Event → `_renderChart()` (Farben neu berechnet via `core.scatterColors()`) |

---

## Block G – Akzeptanzkriterien

- [ ] Tooltip bleibt an allen 4 Ecken des Tiles vollständig sichtbar
- [ ] Config-State (`months`, `targetFE`, `showTarget`, `mode`) überlebt Browser-Reload
- [ ] Bei 0 Datenzeilen / leerem Filter: Diag-Meldung sichtbar, kein JS-Error in der Console
- [ ] Punkte / Violins skalieren sichtbar wenn Tile-Größe über `--tile-w`-Slider geändert wird
- [ ] Globaler Squad-Filter greift korrekt auf JiraStories- **und** JiraBlockermanagement-Daten
- [ ] Items mit `Gesamt_Wartezeit > LT` werden ausgeschlossen und in `diagEl` gezählt
- [ ] Ziellinie verschwindet wenn `showTarget = false`
- [ ] Punkte / Median-Dots werden rot wenn FE% < Ziellinie, grün wenn ≥ Ziellinie
- [ ] `Blockiert/Wartend_Zustand`-Breakdown erscheint korrekt im Tooltip
- [ ] JiraBlockermanagement-Episoden mit `Zustand ∈ WAIT_STATUS` werden nicht doppelt gezählt
- [ ] Bei fehlendem `JiraBlockermanagement`-Sheet: Visual läuft fehlerfrei, `diagEl` zeigt Hinweis
- [ ] Monatspunkte nur für Monate mit ≥ 1 Resolved Item
- [ ] Violin-Modus: IQR, Min, Max im Tooltip korrekt berechnet
- [ ] Mode-Toggle [Linie|Violin] wechselt korrekt und Zustand bleibt nach Reload erhalten
- [ ] Dark/Light-Theme-Wechsel: alle Farben korrekt (kein Hardcode)
- [ ] `build.py`: M11-Selbstcheck meldet `✓ init_flowefficiency() vorhanden`
- [ ] **?-Button:** Hilfe-Modal öffnet sich beim Klick auf `[?]` im Tile-Header
- [ ] Hilfe-Modal schließt sich bei: ✕-Button, Backdrop-Klick, Escape-Taste
- [ ] Hilfe-Modal zeigt alle 6 Inhaltssektionen mit SVG-Grafiken korrekt an
- [ ] Hilfe-Modal passt sich dem Light/Dark-Theme an (Hintergrund, Text, Border via CSS-Variablen); fachliche SVG-Farben (grün/amber/lila) bleiben in beiden Themes erhalten
- [ ] Diag-Leiste ist 3-spaltig: Erklärungstext links — Zähler-Meldung mitte — „Flow analysieren →" Link rechts
- [ ] „Flow analysieren →" navigiert zur Heatmap-Page (`core.showPage('heatmap')`)
- [ ] Erklärungstext in der Diag-Leiste wird bei schmalen Tiles korrekt abgeschnitten (ellipsis), kein Umbruch

---

## Änderungshistorie

| Version | Datum | Änderung |
|---|---|---|
| 1.0 | 2026-06-09 | Initiale Spec nach SDD-Interview (Blöcke A–G) — Gate 1 bestätigt |
| 1.1 | 2026-06-09 | Violin-Modus ergänzt (Block C: Mode-Toggle, Block D: KDE-Beschreibung, Block E: `mode`-Property, Block G: Violin-Akzeptanzkriterien) |
| 1.2 | 2026-06-11 | Drei Erweiterungen (Block C): (1) ?-Button im Tile-Header → Hilfe-Modal mit vollständiger Erklärung inkl. SVG-Grafiken, Theme-adaptiv; (2) Diag-Leiste 3-spaltig (Erklärungstext · Zähler · „Flow analysieren →" Link zur Heatmap); (3) Akzeptanzkriterien Block G erweitert |
