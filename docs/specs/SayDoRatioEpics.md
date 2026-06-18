# SayDoRatioEpics – Spezifikation

**Version:** 1.0  
**Datum:** 2026-06-18  
**Status:** [x] Entwurf → [x] Bestätigt (Gate 1) → [ ] Implementiert

---

## A – Zweck & Abgrenzung

### Was das Visual macht
Das Visual zeigt pro Etappe (Stage) die Anzahl committeter Epics als Balkendiagramm. Jeder Balken ist in farbige Segmente unterteilt, die den Abschlussstatus der Epics innerhalb des Etappen-Zeitraums widerspiegeln (Resolved, Rejected, UNCALLED, Offen). Oberhalb jedes Balkens wird die Say Do Ratio (SDR = Resolved / Gesamt) als Prozentsatz angezeigt, damit Teams auf einen Blick erkennen wie zuverlässig Commitments eingehalten wurden.

### Was es NICHT macht
- Kein Cross-Filter: das Visual beeinflusst keine anderen Visuals
- Kein Drill-Down auf einzelne Epics (nur Tooltip mit Kategorien-Zählern)
- Kein Jira-Link-Feature (kein urlTemplate, kein window.open)
- Keine Anzeige von Epics ohne passende Etappe in BRP Etappen

### Technologie
[x] Web-App (.js + core.js, standalone HTML in SharePoint)

---

## B – Datenmodell

### Excel-Sheets

| Sheet-Name | Zugriff | Pflicht? | Fallback wenn fehlt |
|---|---|---|---|
| `JiraEpics` | `core.state.sheets['JiraEpics'] ?? []` | ✅ | Leerzustand: „JiraEpics-Sheet nicht gefunden" |
| `BRP Etappen` | `core.state.sheets['BRP Etappen'] ?? []` | ✅ | Leerzustand: „BRP Etappen-Sheet nicht gefunden" |

### Spalten – JiraEpics

| Spaltenname | Typ | Pflicht? | Verwendung |
|---|---|---|---|
| `Jira-ID` | Text | ✅ | Identifikation im Tooltip |
| `Kurzbeschreibung` | Text | optional | Tooltip |
| `Stage` | Text | ✅ | Verknüpfung mit BRP Etappen.Etappe |
| `Squad` | Text | optional | Globaler Filter |
| `Resolved` | Datum | optional | Kategorisierung: Resolved-Segment |
| `Rejected` | Datum | optional | Kategorisierung: Rejected-Segment |
| `UNCALLED` | Datum | optional | Kategorisierung: UNCALLED-Segment |

Alle anderen Spalten (Commitment, Done, In Progress, …) werden nicht ausgewertet.

### Spalten – BRP Etappen

| Spaltenname | Typ | Pflicht? | Verwendung |
|---|---|---|---|
| `Etappe` | Text | ✅ | X-Achsen-Beschriftung + Join zu JiraEpics.Stage |
| `Startdatum` | Datum | ✅ | Zeitraum-Prüfung + X-Achsen-Sortierung |
| `Endedatum` | Datum | ✅ | Zeitraum-Prüfung + aktuelle-Etappe-Erkennung |

### Verknüpfungslogik

```
JiraEpics.Stage === BRP Etappen.Etappe  (exakter Textvergleich)
```

Epics ohne passenden Etappe-Wert werden **ignoriert** (tauchen in keinem Balken auf).

### Committed-Definition

Ein Epic gilt als **committet** wenn sein `Stage`-Wert mit einem `Etappe`-Wert in BRP Etappen übereinstimmt. Die Spalte `Commitment` wird nicht ausgewertet.

### Kategorisierung pro Epic (Priorität absteigend)

```
1. Resolved ≠ null UND Resolved ∈ [Startdatum, Endedatum]  → Kategorie: Resolved
2. Rejected ≠ null UND Rejected ∈ [Startdatum, Endedatum]  → Kategorie: Rejected
3. UNCALLED ≠ null UND UNCALLED ∈ [Startdatum, Endedatum]  → Kategorie: UNCALLED
4. sonst                                                    → Kategorie: Offen
```

„∈ [Startdatum, Endedatum]" bedeutet: `date >= Startdatum AND date <= Endedatum` (inklusiv, via `core.toDate()`).

### Dual-Period-Logik

[ ] Visual nutzt keine `_first`-Spalten – Dual-Period-Logik nicht erforderlich.

---

## C – UX & Layout

### Hauptbereiche (ASCII-Sketch)

```
┌────────────────────────────────────────────────────────────────────┐
│  Say Do Ratio Epics                                                │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│        n=8           n=5           n=3                             │
│  8 ┤  ┌──────┐                                                     │
│    │  │75%   │                                                     │
│  6 ┤  │██ 3 █│  ┌──────┐                                           │
│    │  │██████│  │60%   │                                           │
│  4 ┤  │▓▓ 1 ▓│  │██ 2 █│  ┌──────┐                                 │
│    │  │▒▒ 2 ▒│  │▓▓ 1 ▓│  │33%   │                                 │
│  2 ┤  │██████│  │▒▒ 1 ▒│  │██ 1 █│                                 │
│    │  │██████│  │██████│  │      │                                 │
│  0 ┤──┴──────┴──┴──────┴──┴──────┴──                               │
│      Etappe 1   Etappe 2   Etappe 3   ...                          │
│                                                                    │
│  ■ Resolved   ■ Rejected   ■ UNCALLED   □ Offen                    │
├────────────────────────────────────────────────────────────────────┤
│  n=42 Epics · 8 Etappen · Squad: alle                              │
└────────────────────────────────────────────────────────────────────┘
```

**Legende:** Unterhalb der X-Achse, horizontal, mit farbigen Quadraten.

**Legende oben:** Farbige Quadrate mit Label (Resolved · Rejected · UNCALLED · Offen), innerhalb der oberen SVG-Margin.

**Über jedem Balken (immer, wenn total > 0):**
- Zeile 1: `n=X` (Gesamtzahl committeter Epics) – fettgedruckt
- Zeile 2: `SDR: X%` (Say Do Ratio, auf ganze Zahl gerundet) – gedämpft

**Offener Balkenbereich:** Leichtes transparentes Fill (`rgba(openColor, 0.18)`) statt vollständig transparent.

**Innerhalb der farbigen Segmente:** Anzahl der Epics als kleine Zahl. Segment wird nur beschriftet wenn hoch genug (≥ 16px) und Balken breit genug (≥ 28px).

**Angezeigt werden:** Aktuelle Etappe + bis zu 3 vorherige Etappen (max. 4 Etappen total).

**Aktuelle Etappe:** Balken der laufenden Etappe (heute ∈ [Startdatum, Endedatum]) erhält eine Kontur in `var(--blue)` mit `stroke-width: 2`.

### Interaktionen

| Aktion | Trigger | Effekt |
|---|---|---|
| Tooltip anzeigen | mouseover auf Balken (alle Segmente) | Tooltip mit Etappeninfos erscheint, boundary-safe |
| Tooltip ausblenden | mouseout | Tooltip `display:none` nach 0ms (kein Link, kein Delay) |

### Tooltip-Inhalt

```
Etappe 1
01.01.2026 – 31.03.2026
──────────────────────
Resolved:  3
Rejected:  1
UNCALLED:  2
Offen:     2
Gesamt:    8
```

### Leerzustand

| Situation | Anzeige |
|---|---|
| JiraEpics-Sheet fehlt | `diagEl`: „JiraEpics-Sheet nicht gefunden" · contentEl leer |
| BRP Etappen-Sheet fehlt | `diagEl`: „BRP Etappen-Sheet nicht gefunden" · contentEl leer |
| Alle Epics herausgefiltert (Squad-Filter) | Alle Balken zeigen 0 (Etappen bleiben sichtbar) |
| Keine Etappe hat Epics | X-Achse mit allen Etappen, alle Balken bei 0 |

### Responsive-Verhalten

- Balkenbreite: `(verfügbare Breite - Achsenbereich) / Anzahl Etappen`, mindestens 30px
- Schriftgrößen für Achsenbeschriftung und Balken-Labels: skalieren mit Container
- Bei wenig Platz: X-Achsen-Labels drehen (45°) wenn Balkenbreite < 60px
- SVG nimmt 100% der contentEl-Breite und -Höhe ein

---

## D – Berechnungslogik

### Kern-Metriken

| Metrik | Formel | Einheit | Besonderheiten |
|---|---|---|---|
| Gesamt je Etappe | `Anzahl Epics mit Stage = Etappe` | Integer | Nach globalem Squad-Filter |
| Resolved-Anzahl | `Epics mit Resolved ∈ [Start, Ende]` | Integer | Höchste Priorität |
| Rejected-Anzahl | `Epics mit Rejected ∈ [Start, Ende] AND kein Resolved ∈ [Start,Ende]` | Integer | |
| UNCALLED-Anzahl | `Epics mit UNCALLED ∈ [Start, Ende] AND kein Resolved/Rejected ∈ [Start,Ende]` | Integer | |
| Offen-Anzahl | `Gesamt − Resolved − Rejected − UNCALLED` | Integer | |
| Say Do Ratio | `Resolved / Gesamt × 100` | % (Integer) | 0% wenn Gesamt = 0 |

### SDR-Sonderfälle

| Situation | SDR-Anzeige |
|---|---|
| Gesamt = 0 | „–" statt Prozentwert |
| Resolved = 0 | „0%" |
| Resolved = Gesamt | „100%" |

### Datumsvergleich

```javascript
function inRange(dateVal, start, end) {
  const d = core.toDate(dateVal);
  const s = core.toDate(start);
  const e = core.toDate(end);
  if (!d || !s || !e) return false;
  return d >= s && d <= e;
}
```

### Filter- & Aggregationslogik

- Globaler Squad-Filter via `core.state.squadFilter` – analog zu anderen Visuals
- Epics ohne passenden Stage-Wert in BRP Etappen: übersprungen
- X-Achsen-Reihenfolge: Etappen aus BRP Etappen, sortiert nach `Startdatum` aufsteigend

### Edge Cases

| Situation | Verhalten |
|---|---|
| Epic hat Resolved UND Rejected beide im Zeitraum | Resolved hat Priorität (Epic → Resolved-Kategorie) |
| Etappe hat keine Epics | Balken mit Höhe 0 wird angezeigt (Etappe bleibt auf X-Achse sichtbar) |
| Segment zu schmal für Label (<20px) | Label im Segment wird ausgeblendet |
| Math.max auf leerem Array | Abgesichert: `epicsPerEtappe.length ? Math.max(...epicsPerEtappe.map(e => e.total)) : 0` |
| BRP Etappen hat Etappe mit fehlendem Start- oder Endedatum | Etappe wird übersprungen, Diag-Hinweis |
| Division durch 0 in SDR | Abgefangen: `gesamt > 0 ? Math.round(resolved/gesamt*100) : null` |

---

## E – Config (localStorage)

localStorage-Key: `fhwa_saydoratioepics`

### Alle Properties

| Property | Typ | Default | Effekt | Validierung |
|---|---|---|---|---|
| `colorResolved` | string (hex) | `#4ade80` | Füllfarbe Resolved-Segment | `_safeColor()` – Fallback auf Default |
| `colorRejected` | string (hex) | `#fb923c` | Füllfarbe Rejected-Segment | `_safeColor()` – Fallback auf Default |
| `colorUncalled` | string (hex) | `#c084fc` | Füllfarbe UNCALLED-Segment | `_safeColor()` – Fallback auf Default |
| `colorOpen` | string (hex) | `#8ba8c8` | Füllfarbe Offener Bereich (rgba mit 0.18 alpha) | `_safeColor()` – Fallback auf Default |

Der globale Squad-Filter (`core.state.squadFilter`) ist kein Visual-eigener Config-Wert.

---

## F – Design-Standards (Pflichtcheck)

| Standard | Entscheidung | Details |
|---|---|---|
| Tooltip boundary-safe | ✅ Pflicht | `positionTooltip()` mit Overflow-Prüfung (§9.3) |
| Tooltip mit Links | ✗ nicht benötigt | Kein Jira-Link, kein Hover-Delay, `pointerEvents: 'none'` |
| N-Anzeige | ✅ Pflicht | Über jedem Balken: `n=X` + `SDR: Y%` |
| Reihenfolge-Panel | ✗ nicht benötigt | Reihenfolge = Startdatum aufsteigend (fix) |
| Skalierung | ✅ Pflicht | Balkenbreite relativ zur Container-Breite, SVG 100% |
| Diagnosemodus | ✅ Pflicht, immer sichtbar | `n=X Epics · Y Etappen · Squad: [alle / Filtername]` |
| Link-Feature | ✗ nicht benötigt | Kein `urlTemplate`, kein `settings`-Event |
| Theme | ✅ Pflicht | `var(--green)`, `var(--orange)`, `var(--purple)`, `var(--dim)` für Offen-Transparenz; `var(--blue)` für aktuelle Etappe; nie hardcoden |
| Y-Achsen-Ticks | ✅ Pflicht | `core.intTicks(yMax, 5)` → nur ganze Zahlen (§9.7) |

### Farbdefinition

| Kategorie | Farbe | CSS-Variable |
|---|---|---|
| Resolved | Grün | `var(--green)` |
| Rejected | Orange | `var(--orange)` |
| UNCALLED | Lila | `var(--purple)` |
| Offen | Transparent (nur Kontur) | `none` als Fill, `var(--dim)` als Stroke |
| Balken-Gesamtrahmen | Transparent + Kontur | `none` Fill, `var(--dimmer)` Stroke |
| Aktuelle Etappe Kontur | Blau | `var(--blue)`, stroke-width: 2 |

---

## G – Akzeptanzkriterien

### Automatisch von Claude prüfbar
- [ ] Keine hardcodierten Farben im Code – nur CSS-Variablen
- [ ] localStorage-Key `fhwa_saydoratioepics` korrekt
- [ ] Events abonniert: `data`, `theme`, `filter`, `resize`
- [ ] `core.intTicks()` für Y-Achse verwendet
- [ ] Division-durch-0 in SDR-Berechnung abgesichert
- [ ] `Math.max()` auf leerem Array abgesichert

### Manuell durch Oliver zu testen
- [ ] Tooltip bleibt vollständig sichtbar an allen 4 Ecken der Card
- [ ] Bei fehlendem JiraEpics-Sheet: Diagnosemeldung sichtbar, kein JS-Error
- [ ] Bei fehlendem BRP Etappen-Sheet: Diagnosemeldung sichtbar, kein JS-Error
- [ ] Squad-Filter: nach Auswahl eines Squads aktualisieren sich alle Balken
- [ ] Aktuelle Etappe: blauer Rahmen sichtbar
- [ ] Balken-Segmente stapeln von unten: Resolved → Rejected → UNCALLED → Offen (transparent)
- [ ] Segment-Labels (Anzahl im Balken) ausgeblendet wenn Segment zu schmal
- [ ] SDR „–" bei Etappe mit 0 Epics
- [ ] Theme-Toggle: Farben wechseln korrekt (kein Hardcode)
- [ ] Browser-Reload: kein Datenverlust (kein Config-State → kein Problem)
- [ ] Tile auf 300px Breite: X-Achsen-Labels drehen sich

---

## Änderungshistorie

| Datum | Version | Änderung | Bestätigt von |
|---|---|---|---|
| 2026-06-18 | 1.0 | Initiale Spec nach SDD-Interview | Oliver |
| 2026-06-18 | 1.1 | Legende nach oben; n=X + SDR% immer über Balken (konsistent); offener Bereich mit leichter Füllung; nur aktuelle + 3 letzte Etappen; Einstellungsmenü (Farben); „Was zeigt diese Ansicht?" in Diag-Bar | Oliver |
