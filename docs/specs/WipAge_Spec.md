# WIPAge Chart – Spezifikation (SDD)

**Version:** 1.1  
**Datum:** 2026-06-09  
**Datei:** `wipage.js`  
**Status:** ✅ Bestätigt (Gate 1) · ✅ Implementiert (v2.4)

---

## A – Zweck & Abgrenzung

### Was das Visual macht

Der WIPAge Chart zeigt alle aktiven Work Items (WIP = Work in Progress) als Scatterplot. Die X-Achse gruppiert Items nach ihrem aktuellen Workflow-Status; die Y-Achse zeigt wie viele Tage ein Item bereits in diesem Status verbracht hat (kumuliert über alle Durchläufe). Rolling-Pace-Bänder aus abgeschlossenen Items der letzten N Tage geben Orientierung, ab wann ein Item als überfällig gilt. Das Visual beantwortet: *„Welche Items stecken wo fest, und wie lange schon?"*

### Was es NICHT macht

- Kein Cross-Filter auf andere Visuals
- Kein Drill-Through, keine Hierarchien
- Keine Aggregation pro Gruppe (jeder Punkt = ein Work Item)
- Kein DAX, keine server-seitige Berechnung
- Kein Vergleich zwischen Squads oder Issue-Types (nur globaler Squad-Filter über core)
- `Created (Status New)` wird nicht dargestellt — in Progress befindliche Items können nicht dorthin zurückkehren
- `Rejected`-Items werden nicht dargestellt (per Default ausgeblendet, konfigurierbar)

### Technologie

- [x] **Web-App** (`.js` + `core.js`, standalone HTML auf SharePoint/OneDrive)
- [ ] pbiviz (TypeScript + Power BI Custom Visual)

---

## B – Datenmodell

### Excel-Spalten

| Spaltenname | Typ | Pflicht? | Erkennungslogik | Fallback wenn fehlt |
|---|---|---|---|---|
| `Jira-ID` | Text | ✅ | Name exakt | Item ohne Key → key = `''` |
| `Issue-Status` | Text | ✅* | Name exakt | Kein Status → Item wird nicht dargestellt |
| `In Progress_first` | Datum | ✅* | Name exakt | Aktiv-Filter schlägt fehl → 0 aktive Items |
| `Resolved` | Datum | optional | Name exakt | Fehlt → alle Items gelten als potentiell aktiv |
| `Rejected` | Datum | optional | Name exakt | Fehlt → Rejected-Prüfung entfällt (kein Ausschluss) |
| `[Zustand]_first` | Datum | optional | Name = `[Zustand] + '_first'` | Kein erster Zeitraum → nur regulärer Zeitraum |
| `leaving_[Zustand]_first` | Datum | optional | Präfix `leaving_` + Suffix `_first` | Kein erster Zeitraum nutzbar |
| `[Zustand]` | Datum | optional | Nicht in META_COLS, kein `leaving_`-Präfix, kein `_first`-Suffix, kein `_Count`-Suffix | Nur `_first`-Zeitraum wird verwendet |
| `leaving_[Zustand]` | Datum | optional | Präfix `leaving_`, kein `_first`-Suffix | Rolling Pace für diesen Status nicht berechenbar |

*Für sinnvolle Darstellung erforderlich.

### State-Erkennungslogik

Spalte wird als Workflow-Zustand erkannt wenn **alle** dieser Bedingungen zutreffen:
- Nicht in `META_COLS` (Jira-ID, Issue-Type, Squad, Issue-Status, In Progress_first, Ready4Progress_first, Resolved, Rejected, …)
- Kein `leaving_`-Präfix
- Kein `_first`-Suffix
- Kein `_Count`-Suffix

### Aktiv/Erledigt-Logik (XOR-Prinzip)

Ein Work Item ist **erledigt** wenn `Resolved` **oder** `Rejected` gefüllt ist. Da nur eines der beiden Felder befüllt sein kann, ist dies effektiv ein XOR.

```
Aktiv = In Progress_first gefüllt
        AND Resolved == null
        AND Rejected == null
```

### Dual-Period-Logik (gilt für alle Zeitberechnungen)

Ein Item kann einen Status zweimal durchlaufen (z.B. nach Rücksprung). Die Spalten `[Zustand]_first` / `leaving_[Zustand]_first` repräsentieren den **ersten** Durchlauf, `[Zustand]` / `leaving_[Zustand]` den **letzten/aktuellen**.

```
Schwellwert "gleich": |X_first − X| < 43.200.000 ms (= 0,5 Tage)

X_first ≈ X?
├── Ja  → Item war nur einmal in diesem Status
│         → nur regulären Zeitraum verwenden
└── Nein → Item hat Status zweimal durchlaufen
           → beide Zeiträume addieren
```

### Datumsstrategie

Nicht anwendbar (Web-App, kein Power BI). Datumsauflösung via `core.toDate()`.

---

## C – UX & Layout

### Hauptbereiche (ASCII-Sketch)

```
┌─────────────────────────────────────────────────────────────┐
│  [Card-Header: Titel · ⚙ Einstellungen · ↕ Reihenfolge]    │
├─────────────────────────────────────────────────────────────┤
│  [Settings-Panel / Order-Panel – ausgeklappt wenn aktiv]    │
├─────────────────────────────────────────────────────────────┤
│  Y │                    ·                                    │
│  A │         ·     ·    ·        ·                          │
│  l │    ──── P90 ──── (rot)  ────────────────               │
│  t │    ─ ─ P85 ─ ─ (orange-rot) ─ ─ ─ ─ ─                │
│  e │    ·   P50 ─ ─ (gelbgrün) ─ ─ ─ ─ ─ ─                │
│  r │    ──── P25 ──── (grün) ─────────────                  │
│    │    ·         ·                                          │
│  0 └──────────────────────────────────────────────── Zeit   │
│       Status A    Status B    Status C    Status D           │
│       n=4         n=7         n=2         n=1                │
├─────────────────────────────────────────────────────────────┤
│  [Diag-Bar: N WIP-Items · M Status · Rolling Pace: x/y]     │
└─────────────────────────────────────────────────────────────┘
```

### Farbzonen (von unten nach oben, pro Status-Spalte)

| Zone | Bereich | Hintergrundfarbe | Linie | Linienfarbe |
|---|---|---|---|---|
| 1 | 0 → P25 | `rgba(100,185,100,0.10)` | P25 | `#64B964` |
| 2 | P25 → P50 | `rgba(180,210,80,0.10)` | P50 | `#A8C034` |
| 3 | P50 → P85 | `rgba(230,180,40,0.10)` | P85 | `#E68C3C` |
| 4 | P85 → P90 | `rgba(220,100,40,0.12)` | P90 | `#E84040` |
| 5 | P90 → oben | `rgba(210,50,50,0.10)` | – | – |

### Interaktionen

| Aktion | Trigger | Effekt |
|---|---|---|
| Tooltip anzeigen | `mouseover` auf Dot | Tooltip mit Key, Status, Alter, Pace-Werten, Link |
| Tooltip verfolgen | `mousemove` auf Dot | Tooltip folgt Cursor (boundary-safe) |
| Tooltip ausblenden | `mouseout` + 120ms Delay | `display:none` — Delay erlaubt Klick auf Link |
| Issue öffnen | Klick auf „🔗 Issue öffnen" im Tooltip | `window.open(url, '_blank')` |
| Einstellungen | Klick auf „⚙ Einstellungen" | Settings-Panel ein-/ausklappen |
| Reihenfolge | Klick auf „↕ Reihenfolge" | Order-Panel ein-/ausklappen |
| Status verschieben | ▲/▼ im Order-Panel | `cfg.stateOrder` aktualisieren → `saveConfig()` → `render()` |
| Status per Drag | `⠿`-Handle ziehen | Gleicher Effekt wie ▲/▼ |
| Theme wechseln | `core.on('theme')` | `render()` — alle Farben neu berechnen |
| Squad-Filter | `core.on('filter')` | `render()` — aktive Items neu filtern |
| Card resize/drag | `core.on('resize')` | `render()` — SVG-Dimensionen neu berechnen |

### Leerzustände

| Situation | Anzeige |
|---|---|
| Keine Excel-Datei geladen | Mittiger Text „Keine Daten / Excel-Datei laden" |
| Keine aktiven Items | Mittiger Text „Keine aktiven Items / Keine WIP-Items oder alle Status ausgeblendet" |
| Alle Status in excludeList | Wie oben |
| Diag-Bar immer sichtbar | Zeigt Count und Hinweis auch im Leerzustand |

### Responsive-Verhalten

- SVG: `width:100%; height:100%` — füllt `contentEl` komplett
- Dot-Radius: `Math.max(3, Math.min(8, pW/100)) * (cfg.dotSize/4)` — skaliert mit Plotbreite
- Spaltenbreite: `pW / nCols` — gleichmäßig verteilt, keine fixen Pixel
- Achsen-Margins: fest (`top:28, right:24, bottom:60, left:50`) — bei sehr kleinen Cards ggf. Überlappung
- Y-Ticks: `_niceYTicks(maxAge, 5)` — passt Anzahl an maxAge an
- Status-Label: wird nach 14 Zeichen mit `…` abgeschnitten

---

## D – Berechnungslogik

### Aktiv-Filter

```javascript
activeRows = filteredRows.filter(r =>
  core.toDate(r['In Progress_first']) != null
  && core.toDate(r['Resolved']) == null
  && core.toDate(r['Rejected']) == null
)
```

### Status-Alter (Y-Achse)

Für aktive Items — kumulierte Zeit im aktuellen Status:

```
entryFirst  = r[statusName + '_first']
entryReg    = r[statusName]
leavingFirst = r['leaving_' + statusName + '_first']

hasTwoPeriods = entryFirst != null
             && leavingFirst != null
             && |entryFirst − entryReg| > 43.200.000 ms

if hasTwoPeriods:
  age = round((leavingFirst − entryFirst) / 86400000)  [erster Durchlauf]
      + round((heute − entryReg) / 86400000)            [aktueller Durchlauf]
else if entryReg != null:
  age = round((heute − entryReg) / 86400000)
else if entryFirst != null:
  age = round((heute − entryFirst) / 86400000)          [Fallback]
else:
  Item wird nicht dargestellt (age = null)
```

Einheit: ganzzahlige Tage (nicht inklusiv — Differenz-Tage).  
Negative Werte werden auf 0 gesetzt (`Math.max(0, ...)`).

### Rolling Pace (Y-Achse Referenzlinien)

Nur **Resolved-Items** (kein Rejected) der letzten `rollingDays` Tage.

```
cutoff = heute − rollingDays × 86400000
completedRows = allRows.filter(r =>
  core.toDate(r['Resolved']) != null
  && core.toDate(r['Resolved']) >= cutoff
)
```

Dauer pro Item pro Status (Dual-Period):

```
if hasTwoPeriods:
  dauer = (leavingFirst − entryFirst) / 86400000 + 1   [inklusiv]
        + (leavingReg − entryReg) / 86400000+ 1        [inklusiv]
else if entryReg && leavingReg:
  dauer = (leavingReg − entryReg) / 86400000 + 1
else if entryFirst && leavingFirst:
  dauer = (leavingFirst − entryFirst) / 86400000 + 1
else:
  null  (Item für diesen Status ausgeschlossen)
```

Ergebnis: sortiertes Array → `core.pct(durations, 25/50/85/90)` → P25/P50/P85/P90.

### Y-Skala

```
maxAge = max(alle dot.age, alle pace[status].p90) × 1.12  (12% Headroom)
yScale(v) = MAR.top + pH − (v / maxAge) × pH
```

### X-Skala (Band)

```
colW = pW / nCols
xMid(i) = MAR.left + colW × i + colW / 2
```

### Jitter

```
jitterRange = min(colW × 0.35, 18)
jitter(j, n) = n > 1 ? ((j / (n-1)) × 2 − 1) × jitterRange : 0
```

### Edge Cases

| Situation | Verhalten |
|---|---|
| Item ohne `Issue-Status` | Wird nicht dargestellt (kein Status-Match) |
| Item ohne Eintrittsdatum für aktuellen Status | Wird nicht dargestellt (`age = null`) |
| `leavingFirst` fehlt obwohl `entryFirst` vorhanden | Kein erster Durchlauf → nur regulären Zeitraum verwenden |
| Negativer Alters-Wert (Datumsfehler in Excel) | `Math.max(0, age)` — wird als 0 dargestellt |
| Keine Resolved-Items im Rolling-Fenster | `pace[status] = null` → keine Farbzonen/Linien für diesen Status |
| `Math.max()` auf leerem Array | Abgesichert: `values.length ? Math.max(...values) : 0` |
| Alle Status in excludeList | Leerzustand-Meldung, kein JS-Error |
| 0 aktive Items | Leerzustand-Meldung, kein JS-Error |

---

## E – Config / Format-Panel

### Alle Properties (`fhwa_wipage`)

| Property | Typ | Default | Min | Max | Effekt | Validierung |
|---|---|---|---|---|---|---|
| `rollingDays` | number | `90` | 1 | – | Zeitfenster für Pace-Berechnung | `Math.max(1, parseInt(v))` |
| `statusAgeDays` | number | `5` | 0 | – | Alert-Schwellwert: Dot-Farbe wechselt | `Math.max(0, parseInt(v))` |
| `dotSize` | number | `4` | 1 | 12 | Basis-Radius-Multiplikator | `Math.max(1, Math.min(12, parseInt(v)))` |
| `showBands` | bool | `true` | – | – | Farbzonen + Pace-Linien ein/aus | – |
| `excludeList` | string | `'Rejected, Resume'` | – | – | Komma-getrennte Status ausblenden | `split(/[,;]/).map(trim)` |
| `alertColor` | string | `'var(--red)'` | – | – | Farbe für Dots ≥ statusAgeDays | Hex `#rrggbb` oder CSS-Var |

> **`stateOrder` wird nicht mehr in `fhwa_wipage` persistiert.** Die Status-Reihenfolge liegt global in `fhwa_status_order` und wird via `core.loadGlobalStatusOrder()` geladen. Änderungen über das Order-Panel schreiben direkt in `core.saveGlobalStatusOrder()`.

### Storage

localStorage-Key: `fhwa_wipage`  
Gespeicherter State: alle 6 Properties aus der Tabelle oben (kein `stateOrder`).  
Status-Reihenfolge: `fhwa_status_order` (global, via `core.loadGlobalStatusOrder()` / `core.saveGlobalStatusOrder()`).

---

## F – Design-Standards (§9-Pflichtcheck)

| Standard | Entscheidung | Details |
|---|---|---|
| Tooltip boundary-safe | ✅ Implementiert | `_posTooltip(cx, cy)` mit `window.innerWidth/Height`-Prüfung (§9.3) |
| Tooltip mit Links | ✅ Implementiert | Hover-Delay 120ms + `pointerEvents: all` wenn URL vorhanden (§4.9) |
| N-Anzeige | ✅ Implementiert | SVG-Text unter jeder Status-Spalte: `n=X` (§9.4) |
| Reihenfolge-Panel | ✅ Implementiert | `⠿` Drag-Handle + ▲/▼ Buttons; **schreibt global** via `core.saveGlobalStatusOrder()`; abonniert `core.on('statusOrder')` für Sync aus anderen Visuals (§9.1) |
| N=0-Hiding | ✅ Implementiert | Spalten ohne aktive WIP-Items (`items.length === 0`) werden ausgeblendet; Diag-Bar zeigt Anzahl ausgeblendeter Spalten |
| Extra-Status-Markierung | ✅ Implementiert | Status nicht in `DEFAULT_STATUS_ORDER` → SVG-Label in `var(--orange)` + kleines ▲; Order-Panel-Item mit `.o-extra`-Klasse (orangefarbener Rahmen) |
| Skalierung | ✅ Implementiert | Dot-Radius: `Math.max(3, Math.min(8, pW/100)) × (cfg.dotSize/4)` (§9.5) |
| Diagnosemodus | ✅ Implementiert | Diag-Bar (immer sichtbar): WIP-Count, Status-Count, Pace-Coverage, Alert-Schwellwert (§9.2) |
| Icon | – nicht anwendbar | Standalone Web-App, kein pbiviz-Icon (§9.6) |
| Link-Feature | ✅ Implementiert | URL via `core.state.urlTemplate` + `{issueKey}`; `window.open(_blank)` statt `host.launchUrl` (§9.7) |
| innerHTML | ✅ SVG-Exception | `svgEl.innerHTML = parts.join('')` — erlaubt in Browser-Kontext (kein ESLint/pbiviz). Tooltip-Aufbau via DOM-API. |
| Dark/Light Theme | ✅ Implementiert | `core.scatterColors()` für alle SVG-Farben; Farbzonen als `rgba()`-Werte (theme-unabhängig kalibriert) |
| Dual-Period-Logik | ✅ Implementiert | `_first`-Spalten für Alter + Rolling Pace; Threshold 0,5 Tage |
| Rejected ausblenden | ✅ Implementiert | Default `excludeList: 'Rejected'`; konfigurierbar |

---

## G – Akzeptanzkriterien

### Automatisch prüfbar (kein JS-Error in Browser-Console)

- [ ] Datei geladen, 0 aktive Items → Leerzustand-Text sichtbar, kein Error
- [ ] Alle Status in excludeList → Leerzustand-Text sichtbar, kein Error
- [ ] Item ohne Eintrittsdatum für aktuellen Status → wird ignoriert, andere Items erscheinen
- [ ] Rolling Pace ohne Resolved-Items im Fenster → keine Farbzonen, kein Error
- [ ] `cfg.rollingDays = 0` → Validierung greift, Wert bleibt ≥ 1

### Manuell durch Oliver zu testen

- [ ] Tooltip bleibt vollständig sichtbar an allen 4 Ecken des Visuals (nicht nur Mitte)
- [ ] Hover auf Dot mit URL → Tooltip zeigt „🔗 Issue öffnen" → Klick öffnet Browser-Tab
- [ ] Hover auf Dot ohne URL → kein Link im Tooltip, `pointerEvents: none`
- [ ] Config-State überlebt Browser-Reload (localStorage-Persistenz)
- [ ] stateOrder-Änderung via ▲/▼ überlebt Reload
- [ ] Item mit zwei Status-Durchläufen: Alter = erster Zeitraum + aktueller Zeitraum
- [ ] Resolved-Item erscheint nicht als aktives WIP-Item
- [ ] Rejected-Item erscheint nicht als aktives WIP-Item (Rejected in excludeList)
- [ ] Rejected aus excludeList entfernt → Rejected-Status wird als Spalte angezeigt
- [ ] Farbzonen: unterhalb P25 grün, oberhalb P90 rot
- [ ] Visual auf ~200px Breite → Dots skalieren, kein Überlappen mit Achsen
- [ ] Squad-Filter ändern → WIPAge aktualisiert sich sofort
- [ ] Theme wechseln → alle SVG-Farben passen sich an

---

## Änderungshistorie

| Datum | Version | Änderung | Bestätigt von |
|---|---|---|---|
| 2026-06-01 | 1.0 | Initiale Spec — rückwirkend aus implementiertem wipage.js v2.4 erstellt | Oliver |
| 2026-06-09 | 1.1 | Unified Status Order: `stateOrder` aus `fhwa_wipage` entfernt (→ `fhwa_status_order` global); `excludeList` Default auf `'Rejected, Resume'`; N=0-Hiding (Spalten ohne aktive Items); Extra-Status-Markierung (`.o-extra` + orange SVG-Label); `statusOrder`-Event abonniert; `statusOrder`-Handler aktualisiert `cfg.stateOrder` vor `_updateOrderPanel()` | Oliver |

---

*Erstellt: 2026-06-01 · Autor: Oliver Wolter / Claude*  
*Rückwirkende SDD — wipage.js war bereits implementiert. Dient als Referenz für Bugfixes, Erweiterungen und neue Chat-Starts.*
