# FlowHeatmap – Spezifikation (SDD)

**Version:** 1.1  
**Datum:** 2026-06-09  
**Status:** [x] Entwurf → [ ] Bestätigt (Gate 1) → [x] Implementiert (`heatmap.js` v2.0+)

> Diese SDD wurde nachträglich aus dem implementierten Code (`heatmap.js`) und dem
> Übergabedokument (`FlowAnalytics_Dashboard_Uebergabe.md`) rekonstruiert.
> Sie gilt als Baseline für alle künftigen Änderungen.

---

## A – Zweck & Abgrenzung

### Was das Visual macht
Die FlowHeatmap zeigt die kumulative Verweildauer von Work Items pro Workflow-Zustand als
farbkodierte Tabelle. Jede Zeile ist eine Gruppe (Issue-Type oder Squad), jede Spalte ein
erkannter Workflow-Zustand. Die Zellfarbe kodiert den gewählten Kennwert (P25 / Median / P85)
relativ zum globalen Maximum aller Zellen. Zusätzlich kann eine Lead-Time-Spalte eingeblendet
werden. Ein Drill-Down von Squad-Ebene auf Issue-Type-Ebene innerhalb eines Squads ist möglich.

### Was es NICHT macht
- Kein Cross-Filter zwischen Visuals (nur globaler Squad-Filter über `core`)
- Kein Jira-Link im Tooltip (keine URL-Funktion)
- Kein DAX, keine serverseitige Berechnung
- Kein Power BI – ausschließlich standalone HTML (Web-App)
- Keine zeitliche Achse – alle Items der Datei werden aggregiert (kein Zeitraum-Filter)

### Technologie
[ ] pbiviz (TypeScript + Power BI Custom Visual)  
[x] Web-App (.js + core.js, standalone HTML)

---

## B – Datenmodell

### Web-App: Excel-Spalten

| Spaltenname | Typ | Pflicht? | Erkennungslogik | Fallback wenn fehlt |
|---|---|---|---|---|
| `Jira-ID` | Text | ✅ | Name exakt (`META_COLS`) | `key = ''` |
| `Issue-Type` | Text | optional | `core.state.hasIssueType` | Grouping-Toggle „Issue-Typ" deaktiviert |
| `Squad` | Text | optional | `core.state.hasSquad` | Grouping-Toggle „Squad" deaktiviert; kein Drill-Down |
| `[ltStart]` | Datum | optional | Konfigurierbar, Default: `LT_START_DEFAULT` | Lead-Time-Spalte ohne Wert → LT inaktiv |
| `[ltEnd]` | Datum | optional | Konfigurierbar, Default: `LT_END_DEFAULT` | Wie oben |
| `[Zustand]_first` / `leaving_[Zustand]_first` | Datum | optional | Auto-Erkennung (nicht in META_COLS, nicht `leaving_`, nicht `_Count`) | Zustand nicht in Tabelle |
| `[Zustand]` / `leaving_[Zustand]` | Datum | optional | Wie oben | Zustand nicht in Tabelle |

**Zustandserkennung** (`core.state.states`): Spalte ist ein Workflow-Zustand wenn sie **nicht** in
`META_COLS` steht, **nicht** mit `leaving_` beginnt, **nicht** auf `_first` oder `_Count` endet.
Aus erkannten Zuständen baut `core` die Paare `{ name, entryCol, exitCol }`.

**Dauerberechnung:** `core.dur(entryCol, exitCol)` — inklusiv, Dual-Period-Logik über `_first`-
Spalten (gilt global für alle Visuals).

### Datumsstrategie
[x] Nicht anwendbar – Web-App, Datumsspalten direkt aus Excel via `core.toDate()`.

---

## C – UX & Layout

### Hauptbereiche (ASCII-Sketch)

```
┌──────────────────────────────────────────────────────────────────┐
│  Card-Header: Titel · [Issue-Typ|Squad] · [P25|Median|P85]       │
│               [Alle|Resolved] · [⏱ Lead Time] [👁 Status]        │
│               [↕ Reihenfolge]                                     │
├──────────────────────────────────────────────────────────────────┤
│  [Breadcrumb: ← Zurück · Alle Squads › [Squad] · Filter-Toggle]  │  ← nur im Drill-Down
├──────────────────────────────────────────────────────────────────┤
│  [Sub-Panel: ⏱ Lead Time – Start / Ende / Hint]                  │  ← nur wenn offen
│  [Sub-Panel: 👁 Status   – Checkboxen + ↩ Standard]              │  ← nur wenn offen
│  [Sub-Panel: ↕ Reihenfolge – ⠿ Drag + ▲/▼ pro Zustand]          │  ← nur wenn offen
├──────────────────────────────────────────────────────────────────┤
│  .table-wrap (overflow:auto)                                      │
│  ┌────────────┬───────────┬──────────┬──────────┬──────────┐     │
│  │ Issue-Typ  │ Lead Time │ Zustand1 │ Zustand2 │  …       │     │
│  ├────────────┼───────────┼──────────┼──────────┼──────────┤     │
│  │ Bug        │ Hauptwert │ Hauptw.  │ Hauptw.  │          │     │
│  │            │ Sub (P25/P85) Sub    │  Mini-   │          │     │
│  │            │ n=X       │  n=X    │  balken  │          │     │
│  ├────────────┼───────────┼──────────┼──────────┼──────────┤     │
│  │ Story      │  …        │  …       │  …       │          │     │
│  └────────────┴───────────┴──────────┴──────────┴──────────┘     │
├──────────────────────────────────────────────────────────────────┤
│  Legend-Bar: „wenig Zeit" ▓░░░░░░░░ „viel Zeit" (Canvas 100×6)  │
├──────────────────────────────────────────────────────────────────┤
│  Diag-Bar (immer sichtbar, 1 Zeile)                               │
└──────────────────────────────────────────────────────────────────┘
```

Default-Grid-Position: `{ col: 0, row: 0, w: 8, h: 12 }`.

### Interaktionen

| Aktion | Trigger | Effekt |
|---|---|---|
| Tooltip anzeigen | `mousemove` auf `.has-hm-tt` (document-Level-Delegation) | Tooltip mit P25/Median/P85/Min/Max/n |
| Tooltip ausblenden | `mousemove` auf Element ohne `.has-hm-tt` | `display:none` (sofort, kein Delay) |
| Grouping wechseln | Toggle [Issue-Typ\|Squad] | Zeilen-Gruppierung wechselt, Neurender |
| Metrik wechseln | Toggle [P25\|Median\|P85] | Hauptwert + Farbskalierung wechselt |
| Filter wechseln | Toggle [Alle\|Resolved] | „Resolved" nur aktiv wenn LT konfiguriert |
| Lead-Time-Panel | [⏱ Lead Time] | LT-Spalte nur wenn ltStart ≠ ltEnd ≠ '' |
| Status-Visibility | Checkbox im 👁-Panel | Global oder Squad-spezifisch; `hiddenPerSquad` |
| Status-Reset | „↩ Standard"-Button | Squad-Override gelöscht → globale Sichtbarkeit |
| Spalten-Reihenfolge (Panel) | ▲/▼ oder Drag im ↕-Panel | `cfg.stateOrder` neu sortiert, persistiert |
| Spalten-Reihenfolge (Header) | Drag auf `<th>` der Tabelle | Identischer Effekt wie Panel-Drag |
| Drill-Down | Click auf Squad-Namen in der Gruppe-Spalte | Breadcrumb erscheint; Grouping → Issue-Type |
| Drill-Back | „← Zurück" oder „Alle Squads" im Breadcrumb | Drill-Zustand zurückgesetzt |
| Squad-Filter-Toggle | Checkbox im Breadcrumb | Gibt an ob globaler Filter im Drill aktiv bleibt |
| Panel öffnen/schließen | Button im Header | Immer max. 1 Panel offen |

### Leerzustand

| Situation | Anzeige |
|---|---|
| Keine Excel-Datei geladen | `.state-msg` mit „Keine Daten" + „Excel-Datei laden" |
| 0 Gruppen oder 0 sichtbare Status | `.state-msg` mit „Keine Daten" + „Filter prüfen …" |
| Zelle ohne Daten (kein Item in Gruppe×Status) | Zelle zeigt `–` (`.c-empty`) |
| LT nicht konfiguriert | Lead-Time-Spalte entfällt; Filter „Resolved" deaktiviert |

### Responsive-Verhalten

- `core.on('resize', () => {})` — **kein Neurender bei Resize** (DOM-Tabelle skaliert nativ)
- `table-wrap` hat `overflow:auto` → horizontales Scrollen bei vielen Zustandsspalten
- Keine SVG-basierte Skalierung (kein Viewport-abhängiger Code)

---

## D – Berechnungslogik

### Kern-Metriken

| Metrik | Formel | Einheit | Besonderheiten |
|---|---|---|---|
| Zustandsdauer | `core.dur(r[entryCol], r[exitCol])` | Tage | Inklusiv; Dual-Period-Logik; `null` wenn Datum fehlt |
| Lead-Time-Dauer | `core.dur(r[ltStart], r[ltEnd])` | Tage | Nur Items mit `ltEnd`-Datum |
| P25 | `core.pct(ds, 25)` | Tage | Pro Gruppe × Zustand aus sortierten Werten |
| Median | `core.pct(ds, 50)` | Tage | Wie P25 |
| P85 | `core.pct(ds, 85)` | Tage | Wie P25 |
| Min / Max | `ds[0]` / `ds[ds.length-1]` | Tage | Nur im Tooltip |
| n | `ds.length` | Items | Nur Items mit auswertbarem Datumspaar |
| gMax | `max(metric-Wert über alle Gruppen × Status)` | Tage | Grundlage für Zellfarbe via `core.lerp(v/gMax)` |
| rowMax | `max(metric-Wert über alle Status einer Zeile)` | Tage | Grundlage für Mini-Balkenbreite in Zellen |

### Filter- & Aggregationslogik

- Eingabe-Basis: `_getDrillRows()` — berücksichtigt Drill-Squad und globalen Squad-Filter
- `filter === 'resolved'`: nur Items mit gesetztem `ltEnd`-Datum (nur wenn LT aktiv)
- `filter === 'all'`: alle Zeilen (unabhängig von LT)
- Pro Gruppe×Status: Items ohne auswertbares Datumspaar (`dur = null`) werden übersprungen
- Versteckte Status (`hiddenGlobal` / `hiddenPerSquad`) werden aus `ordStates` entfernt → erscheinen nicht in Tabelle

### Edge Cases

| Situation | Verhalten |
|---|---|
| Zustand hat kein `exitCol` | `_stateStats()` gibt `null` → Zelle zeigt `–` |
| Keine Items in Gruppe×Status | `_stateStats()` gibt `null` → Zelle zeigt `–` |
| `gMax = 0` | `core.lerp()` nicht aufgerufen; keine Hintergrundfarbe |
| `grouping = 'Squad'` aber kein `Squad` in Daten | Grouping-Toggle deaktiviert; Fallback auf `'Alle Items'` |
| `filter = 'resolved'` ohne LT | Automatisch auf `'all'` zurückgesetzt |
| `stateOrder` enthält unbekannte Zustände | Migration: nur bekannte Namen behalten, neue anhängen |
| `ltStart === ltEnd` | `_hasLT()` → `false`; LT-Spalte wird nicht gerendert |
| Drill-Down ohne Squad-Spalte | `canDrill = false`; kein Click-Handler auf Gruppenzeilen |

---

## E – Config / Format-Panel

### Persistierte Properties (localStorage-Key `fhwa_heatmap`)

| Property | Typ | Default | Werte | Effekt | Validierung |
|---|---|---|---|---|---|
| `grouping` | string | `'Issue-Type'` | `'Issue-Type'` \| `'Squad'` | Zeilen-Gruppierung | Fallback wenn Spalte fehlt |
| `metric` | string | `'med'` | `'p25'` \| `'med'` \| `'p85'` | Hauptwert + Farbskalierung | Toggle-Gruppe |
| `filter` | string | `'resolved'` | `'all'` \| `'resolved'` | Item-Filterung | `'resolved'` nur wenn LT aktiv |
| `ltStart` | string | `LT_START_DEFAULT` | Spaltenname | Lead-Time-Startdatum | Muss in `dateCols`; Fallback: erstes dateCols |
| `ltEnd` | string | `LT_END_DEFAULT` | Spaltenname | Lead-Time-Enddatum + LT-Spalte | ≠ ltStart; Fallback: zweites dateCols |
| `hiddenGlobal` | string[] | `['Rejected', 'Resume']` | Status-Namen | Global ausgeblendete Status | Persistiert als Array, geladen als `Set` |

> **`stateOrder` wird nicht mehr in `fhwa_heatmap` persistiert.** Die Status-Reihenfolge liegt global in `fhwa_status_order` und wird via `core.loadGlobalStatusOrder()` geladen. Drag in Order-Panel und Tabellen-Header schreiben via `core.saveGlobalStatusOrder()`.

### Runtime-only State (nicht persistiert)

| Variable | Typ | Bedeutung |
|---|---|---|
| `hiddenPerSquad` | `{ [squad]: Set<string> }` | Squad-spezifische Status-Overrides |
| `drillSquad` | `string \| null` | Aktuell aufgebohrter Squad; `null` = Top-Level |
| `drillKeepFilter` | `boolean` | Ob globaler Filter im Drill-Modus aktiv bleibt |
| `panelDragSrc` | `string \| null` | Name des gerade gezogenen Status im Panel |
| `colDrag.name` | `string \| null` | Name des gerade gezogenen Tabellen-Headers |

---

## F – Design-Standards (§9-Pflichtcheck)

| Standard | Entscheidung | Details |
|---|---|---|
| Tooltip boundary-safe | ✅ Pflicht | `position:fixed` + `_posTooltip(cx, cy)` mit Overflow-Prüfung |
| Tooltip mit Links | ❌ Nicht vorhanden | `pointerEvents: none` (fest); kein Jira-Link in Heatmap |
| Tooltip-Aktivierung | Delegiert (kein Delay) | `document.mousemove` → `.closest('.has-hm-tt')`; sofort ein/aus |
| N-Anzeige | ✅ Pflicht | `n=X` in jeder Zelle (`.c-n`) + Diag-Bar-Zähler |
| Reihenfolge-Panel | ✅ vorhanden | ▲/▼ + Drag im Panel **und** Drag auf `<th>` der Tabelle; **schreibt global** via `core.saveGlobalStatusOrder()`; abonniert `core.on('statusOrder')` |
| N=0-Hiding | ✅ Implementiert | Spalten ausgeblendet wenn ALLE Gruppen `null`-Stats haben; Diag-Bar zeigt Anzahl ausgeblendeter Spalten |
| Extra-Status-Markierung | ✅ Implementiert | Status nicht in `DEFAULT_STATUS_ORDER` → Tabellen-Header mit `.th-extra` (Farbe `var(--orange)`); Order-Panel-Item mit `.o-extra` |
| Skalierung | DOM-nativ | Tabelle skaliert per CSS; `resize`-Event wird absichtlich ignoriert |
| Diagnosemodus | ✅ Pflicht, immer an | Inhalt: Gesamt-n · Drill/Squads · Gruppen · Status · Metrik · Filter · LT |
| Icon | – nicht anwendbar | Web-App |
| Link-Feature | ❌ Nicht vorhanden | Kein `urlTemplate`-Bezug, kein `window.open()` |
| innerHTML | ⚠ Nur für Reset | `tableWrap.innerHTML = ''`, `stGrid.innerHTML = ''`, `hmTTBody.innerHTML = ''` zum Leeren; Zellaufbau ausschließlich via DOM-API |
| Dark/Light Theme | ✅ CSS-Variablen + `core.isLight()` | Zellfarben via `core.lerp(t)` + `core.getCellContrast(t)`; Legende via `core.isLight()` |

---

## G – Akzeptanzkriterien

### Automatisch von Claude prüfbar

- [ ] `heatmap.js` lädt ohne JS-Fehler in der Browser-Console
- [ ] `cfg` wird korrekt aus `localStorage` geladen und nach Änderung persistiert (Page-Reload)
- [ ] `stateOrder` wird nach Datenload korrekt migriert (unbekannte entfernt, neue angehängt)
- [ ] `ltStart` und `ltEnd` werden auf gültige Spalten validiert (Fallback greift)
- [ ] `filter === 'resolved'` fällt auf `'all'` zurück wenn LT nicht konfiguriert
- [ ] `core.on('data' | 'theme' | 'filter')` alle abonniert; `resize`-Handler ist bewusst leer

### Manuell durch Oliver zu testen

- [ ] Tooltip bleibt vollständig sichtbar an allen 4 Ecken des Visuals
- [ ] Tooltip zeigt P25 / Median / P85 / Min / Max / n korrekt für jede Zelle
- [ ] Config-State (Metrik, Reihenfolge, ltStart/ltEnd, hiddenGlobal) überlebt Browser-Reload
- [ ] Reihenfolge per ▲/▼ und per Drag im Panel identisch
- [ ] Drag auf Tabellen-Header ändert dieselbe `cfg.stateOrder` wie Panel-Drag
- [ ] Drill-Down (Click auf Squad-Name) → Breadcrumb erscheint, Grouping wechselt auf Issue-Type
- [ ] Drill-Back → Top-Level-Ansicht; Squad-Grouping wiederhergestellt
- [ ] Squad-Filter-Toggle im Breadcrumb wirkt auf angezeigte Items
- [ ] Status-Visibility: globales Ausblenden wirkt auf alle Squads; Squad-Override nur auf aktiven Squad
- [ ] „↩ Standard"-Button löscht Squad-Override, restoriert globale Sichtbarkeit
- [ ] Lead-Time-Spalte erscheint nur wenn ltStart ≠ ltEnd ≠ '' konfiguriert
- [ ] Filter „Resolved" ist deaktiviert wenn LT nicht konfiguriert
- [ ] Legende zeigt korrekten Farbgradienten in Dark und Light Theme
- [ ] Bei 0 Datenzeilen: State-Message sichtbar, Diag-Bar zeigt `—`, kein JS-Fehler
- [ ] Globaler Squad-Filter (Topbar) wirkt auf Heatmap (Gruppen und n ändern sich)

---

## Änderungshistorie

| Datum | Version | Änderung | Bestätigt von |
|---|---|---|---|
| 2026-06-03 | 1.0 | Initiale Spec – retrograd aus `heatmap.js` v2.0 rekonstruiert | – |
| 2026-06-09 | 1.1 | Unified Status Order: `stateOrder` aus `fhwa_heatmap` entfernt (→ `fhwa_status_order` global); `hiddenGlobal` Default auf `['Rejected','Resume']`; N=0-Hiding (Spalten ohne Stats in allen Gruppen); Extra-Status-Markierung (`.o-extra` + `.th-extra`); `statusOrder`-Event abonniert; `data`-Handler lädt globale Reihenfolge statt zu migrieren | Oliver |

---

*Autor: Oliver Wolter · Erstellt mit Claude Sonnet*
