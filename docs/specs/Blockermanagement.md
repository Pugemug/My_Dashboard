# Spec: Blockermanagement (blocker.js)

**Version:** 1.0  
**Datum:** 2026-06-17  
**Status:** Entwurf – Gate 1 ausstehend  
**Visual-ID:** `blocker`  
**Datei:** `src/blocker.js`  
**Page-ID:** `blocker`  
**Sidebar-Label:** "Blockermanagement"  
**Sidebar-Position:** Detailanalysen – 1. Eintrag (vor WIPAge)

---

## Block A – Zweck & Abgrenzung

### A.1 Zweck
Das Visual analysiert Blockier- und Warte-Episoden aus dem `JiraBlockermanagement`-Sheet. Es zeigt zwei Bereiche:
- **AKTUELL:** alle Issues, die gerade blockiert oder wartend sind
- **GESAMT:** alle Issues, die in der Vergangenheit oder aktuell blockiert/wartend waren

Ziel: schnell erkennen **was** Teams aufhält, **wie lange** und **wie oft** – aufgeteilt nach Blockier- und Warte-Gründen.

### A.2 Abgrenzung
- Kein Cross-Filter auf andere Visuals
- Kein JOIN auf JiraStories (Status kommt aus JiraBlockermanagement selbst)
- Kein Einfluss auf globale `core.state`-Properties
- Kein Drag/Resize (tabellarisches Layout, kein SVG-Chart)

### A.3 Technologie
Web-App: `blocker.js` + `core.js` (Vanilla JS, ES-Modul)

---

## Block B – Datenmodell

### B.1 Datenquelle
```javascript
const rows = core.state.sheets['JiraBlockermanagement'] ?? [];
```

Ein Row = eine Episode (ein Issue kann mehrere Zeilen = mehrere Episoden haben).

### B.2 Genutzte Spalten

| Excel-Spalte | Typ | Pflicht? | Verwendung |
|---|---|---|---|
| `issues.key` | string | ✅ | Issue-Identifier, anzeigen + Link |
| `Squad` | string | ✅ | Globaler Squad-Filter; Composite-Key für "Wie oft" |
| `Status` | string | optional | Aktueller Workflow-Status (aus JiraBlockermanagement) |
| `Blockiert/Wartend_Zustand` | string | ✅ | Unterscheidung "Blockiert" / "Wartend" |
| `Blockiert/Wartend_Grund` | string | ✅ | Grund-Kategorie (feste Liste, s. B.4) |
| `BlockedStart` | Datum | ✅ | Episode-Startdatum |
| `BlockedEnd` | Datum | optional | Episode-Enddatum (leer = Episode noch offen) |

### B.3 Erkennungslogik

**AKTUELL-Filter:** Zeile ist "aktuell blockiert/wartend" wenn:
- `Blockiert/Wartend_Grund` ist nicht leer **UND**
- `BlockedEnd` ist leer/null

**GESAMT-Filter:** Zeile gehört in GESAMT wenn:
- `Blockiert/Wartend_Grund` ist nicht leer (egal ob BlockedEnd gefüllt oder nicht)

→ AKTUELL ist eine Teilmenge von GESAMT.

### B.4 Feste Kategorien

**Blockiert (9 Kategorien):**
1. Infrastruktur-Ausfall
2. Anforderungen unklar, oder fehlend
3. Anforderungen haben sich geändert
4. Fehlende Zugriffsrechte
5. Dokumentation unzureichend
6. Abhängigkeit zu anderen Aufgaben
7. Abhängigkeit zu anderen Teams
8. Probleme bei der Integration
9. Verzögerte externe Lieferungen

**Wartend (7 Kategorien):**
1. Abstimmungen mit anderen Teams
2. Auf Freigabe warten
3. Deployment-Fenster
4. Externe Abhängigkeiten
5. Interne Abstimmung / Entscheidung / Termine
6. Infrastruktur-Aufbau
7. Person(en) abwesend

Unbekannte Gründe (nicht in der obigen Liste) werden in den Summary-Tabellen **ignoriert** (erscheinen nicht).

### B.5 Fehlende Pflicht-Spalten
Fehlt `JiraBlockermanagement`-Sheet oder ist leer → Leerzustand zeigen, kein JS-Error.

---

## Block C – UX & Layout

### C.1 Seiten-Layout

```
┌──────────────────────────────────────────────────────────────┐
│ Filterbar: [SQUADS Alle ▽]  [Filter zurücksetzen]            │
├──────────────────────────────────────────────────────────────┤
│  Scrollbarer Inhalt                                           │
│                                                               │
│  ┌── AKTUELL ─────────────────────────────────────────────┐  │
│  │ Titel: "AKTUELL – Aktuell Blockiert/Wartend  N=12"      │  │
│  │ ┌────────────────────────────┬──────────────────────┐   │  │
│  │ │ Haupt-Tabelle (scrollbar)  │ Zusammenfassungs-     │   │  │
│  │ │ Key | Status | Zustand |  │ Tabellen (gestapelt)  │   │  │
│  │ │ Aktueller Grund | Gesetzt │                       │   │  │
│  │ │ am | Gesamtzeit | Wie oft │  [Blockiert]          │   │  │
│  │ │                           │  [Wartend]            │   │  │
│  │ │                           │  [Blockiert/Wartend]  │   │  │
│  │ └────────────────────────────┴──────────────────────┘   │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                               │
│  ┌── GESAMT ──────────────────────────────────────────────┐  │
│  │ Titel: "GESAMT – Alle blockierten Issues  N=47"         │  │
│  │ ┌────────────────────────────┬──────────────────────┐   │  │
│  │ │ Haupt-Tabelle (scrollbar)  │ Zusammenfassungs-     │   │  │
│  │ │ Key | Status | Zustand |  │ Tabellen (gestapelt)  │   │  │
│  │ │ Grund | Gesetzt am |      │                       │   │  │
│  │ │ Verlassen am | Ges.Zeit | │  [Blockiert]          │   │  │
│  │ │ Wie oft                   │  [Wartend]            │   │  │
│  │ │                           │  [Blockiert/Wartend]  │   │  │
│  │ └────────────────────────────┴──────────────────────┘   │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                               │
│  Diag-Bar: "N Episoden · K aktuell offen · M Datenfehler"    │
└──────────────────────────────────────────────────────────────┘
```

**Layout-Regel:** Haupt-Tabelle `flex: 1 1 60%`, Zusammenfassungs-Spalte `flex: 0 0 320px`, nebeneinander (`display:flex`, `gap`). Bei schmalen Viewports (< 800px) umbrechen die Zusammenfassungs-Tabellen unter die Haupt-Tabelle.

### C.2 Haupt-Tabellen

**AKTUELL – Spalten:**

| # | Spaltenheader | Datenquelle |
|---|---|---|
| 1 | Key | `issues.key` (klickbar wenn urlTemplate) |
| 2 | Status | `Status` |
| 3 | Zustand | `Blockiert/Wartend_Zustand` |
| 4 | Aktueller Grund | `Blockiert/Wartend_Grund` |
| 5 | Auf Blockiert/Wartend gesetzt am | `BlockedStart` (formatiert: DD.MM.YYYY) |
| 6 | Gesamtzeit im Zustand (Tage) | `heute − BlockedStart + 1` |
| 7 | Wie oft Blockiert/Wartend | Count aller Zeilen mit gleichem `issues.key` + `Squad` |

**GESAMT – Spalten:**

| # | Spaltenheader | Datenquelle |
|---|---|---|
| 1 | Key | `issues.key` (klickbar wenn urlTemplate) |
| 2 | Status | `Status` |
| 3 | Zustand | `Blockiert/Wartend_Zustand` |
| 4 | Grund | `Blockiert/Wartend_Grund` |
| 5 | Auf Blockiert/Wartend gesetzt am | `BlockedStart` (formatiert: DD.MM.YYYY) |
| 6 | Blockiert/Wartend verlassen am | `BlockedEnd` (formatiert: DD.MM.YYYY, leer = noch offen) |
| 7 | Gesamtzeit im Zustand (Tage) | s. D.2 |
| 8 | Wie oft Blockiert/Wartend | Count aller Zeilen mit gleichem `issues.key` + `Squad` |

### C.3 Zusammenfassungs-Tabellen (pro Bereich)

**Tabelle 1 – Blockiert:**

| Blockiert | Anzahl | Gesamt Tage | Durchschnitt |
|---|---|---|---|
| Infrastruktur-Ausfall | | | |
| Anforderungen unklar, oder fehlend | | | |
| Anforderungen haben sich geändert | | | |
| Fehlende Zugriffsrechte | | | |
| Dokumentation unzureichend | | | |
| Abhängigkeit zu anderen Aufgaben | | | |
| Abhängigkeit zu anderen Teams | | | |
| Probleme bei der Integration | | | |
| Verzögerte externe Lieferungen | | | |
| **Gesamt Blockiert** | | | |

**Tabelle 2 – Wartend:**

| Wartend | Anzahl | Gesamt Tage | Durchschnitt |
|---|---|---|---|
| Abstimmungen mit anderen Teams | | | |
| Auf Freigabe warten | | | |
| Deployment-Fenster | | | |
| Externe Abhängigkeiten | | | |
| Interne Abstimmung / Entscheidung / Termine | | | |
| Infrastruktur-Aufbau | | | |
| Person(en) abwesend | | | |
| **Gesamt Wartend** | | | |

**Tabelle 3 – Rollup:**

| Blockiert/Wartend | Anzahl | Gesamt Tage | Durchschnitt |
|---|---|---|---|
| Gesamt Blockiert | | | |
| Gesamt Wartend | | | |
| **Gesamt** | | | |

### C.4 Sortierung
- Alle Haupt-Tabellen haben klickbare Spaltenköpfe (Auf-/Abstieg)
- Standard-Sortierung AKTUELL: Gesamtzeit absteigend (längste zuerst)
- Standard-Sortierung GESAMT: BlockedStart absteigend (neueste zuerst)
- Aktiver Sortierpfeil visuell hervorgehoben (▲ / ▼)

### C.5 Leerzustand
- Sheet nicht geladen oder leer → Meldung "Keine Daten aus JiraBlockermanagement verfügbar" in beiden Sektionen
- AKTUELL: 0 Treffer → "Aktuell keine blockierten Issues – alles fließt! 🎉"
- GESAMT: 0 Treffer nach Filter → "Keine Episoden für den gewählten Squad gefunden"

### C.6 Responsiveness
- Unter 800px Containerbreite: Zusammenfassungs-Tabellen umbrechen unter die Haupt-Tabelle

---

## Block D – Berechnungslogik

### D.1 Dauer-Berechnung (allgemein)
```javascript
// Alle Zeitberechnungen: +1 damit 0 nicht möglich ist
function calcDays(startDate, endDate) {
  const end = endDate ?? new Date();  // null/undefined → heute
  return Math.round((end - startDate) / 86400000) + 1;
}
```

### D.2 Gesamtzeit pro Episode

| Zustand | BlockedEnd | Formel |
|---|---|---|
| Noch offen (AKTUELL) | leer/null | `heute − BlockedStart + 1` |
| Abgeschlossen (GESAMT) | gefüllt | `BlockedEnd − BlockedStart + 1` |
| Noch offen (auch in GESAMT) | leer/null | `heute − BlockedStart + 1` |

Ergebnis: immer ≥ 1 Tag (durch +1 gesichert).

### D.3 "Wie oft Blockiert/Wartend" (pro Zeile)
```javascript
// Composite-Key: issues.key + Squad
// Zählt ALLE Episoden für dieses Issue+Squad (unabhängig vom aktuellen Filter)
const countKey = `${row['issues.key']}||${row['Squad']}`;
const wipCount = episodeCountMap.get(countKey) ?? 1;
```
→ `episodeCountMap` wird einmal aus allen (ungefilterten) Zeilen mit gültigem Grund aufgebaut.

### D.4 Summary-Tabellen Aggregation
Pro Bereich (AKTUELL / GESAMT) werden die gefilterten Zeilen nach `Blockiert/Wartend_Zustand` und `Blockiert/Wartend_Grund` gruppiert:

```javascript
// Für jede Zeile mit Zustand = "Blockiert":
//   matched Kategorie aus BLOCKIERT_CATS → summiert Anzahl + Tage
// Für jede Zeile mit Zustand = "Wartend":
//   matched Kategorie aus WARTEND_CATS → summiert Anzahl + Tage
// Durchschnitt = Gesamt Tage / Anzahl (0 wenn Anzahl = 0)
```

### D.5 Squad-Filter
```javascript
const activeSquads = core.state.filter ?? [];  // leeres Array = alle Squads
const filtered = rows.filter(r =>
  activeSquads.length === 0 || activeSquads.includes(r['Squad'])
);
```

### D.6 Edge Cases

| Situation | Verhalten |
|---|---|
| `BlockedStart` fehlt | Zeile aus AKTUELL/GESAMT-Tabelle ausschließen; Datenfehler-Zähler +1 |
| `BlockedStart` nach heute | Dauer = 1 Tag (Minimum durch +1) |
| Negative Dauer (EndDate < StartDate) | Dauer = 1 Tag (Minimum) |
| `Blockiert/Wartend_Zustand` leer | Zeile in Haupt-Tabellen zeigen, aber in Summary-Tabellen nicht zählen |
| `Blockiert/Wartend_Grund` nicht in fester Liste | In Haupt-Tabelle anzeigen, in Summary-Tabellen ignorieren |
| Division durch 0 bei Durchschnitt | Anzeige als "–" |
| JiraBlockermanagement-Sheet fehlt | Leerzustand, kein Fehler |

---

## Block E – Config / Format-Panel

Config-State: `core.load('fhwa_blocker', defaults)` → localStorage-Key `fhwa_blocker`

Dieses Visual hat **kein** separates Settings-Panel (keine konfigurierbaren Eigenschaften). Die Squad-Auswahl wird über den globalen Squad-Filter gesteuert.

---

## Block F – Design-Standards

### F.1 Tooltip
Kein Hover-Tooltip in Tabellen. Key-Klick öffnet direkt Jira-Link (s. F.6). Lange Texte in Zellen werden mit `text-overflow: ellipsis` abgeschnitten und per `title`-Attribut vollständig zugänglich gemacht.

### F.2 N-Anzeige
Im Abschnitts-Titel als `N=12` (AKTUELL) und `N=47` (GESAMT). N = Anzahl der Zeilen nach Squad-Filter.

### F.3 Reihenfolge-Panel
Nicht benötigt.

### F.4 Skalierung
Tabellen-Spaltenbreiten relativ (%, nicht px). Haupttabelle scrollbar (max-height relativ zur Fensterhöhe, ca. 45vh).

### F.5 Diagnosemodus
Diag-Bar am unteren Rand der Seite:
```
"N Episoden geladen · K aktuell offen · M Datenfehler ausgeschlossen"
```

### F.6 Link-Feature
```javascript
const url = core.state.urlTemplate
  ? core.state.urlTemplate.replace(/\{issueKey\}/g, row['issues.key'])
  : '';
if (url) {
  keyCell.style.cursor = 'pointer';
  keyCell.style.color = 'var(--blue)';
  keyCell.addEventListener('click', () => window.open(url, '_blank'));
}
```

### F.7 Rendering-Modell
**Abweichung von der Card/Tile-Regel:** Dieses Visual ist tabellenbasiert und verwendet kein SVG-Chart. Es rendert direkt in einen `div#blocker-canvas` innerhalb der Page, die einen `page-scroll`-Container hat (wie Lieferfähigkeit). Kein `createCard()` / `createTile()`.

**Begründung:** Zwei separate scrollbare Sektionen mit je einer langen Tabelle + Zusammenfassungs-Tabellen passen nicht in das Card-Modell (absolute Positionierung, feste Größe). Die Seite benötigt vertikales Scrolling.

---

## Block G – Akzeptanzkriterien

| # | Kriterium | Testbar durch |
|---|---|---|
| G1 | Sheet nicht geladen → beide Sektionen zeigen Leerzustand, kein JS-Error in Console | Datei ohne JiraBlockermanagement laden |
| G2 | AKTUELL zeigt nur Zeilen mit `Blockiert/Wartend_Grund` gefüllt **und** `BlockedEnd` leer | Manuell gegen Sheet prüfen |
| G3 | GESAMT zeigt alle Zeilen mit `Blockiert/Wartend_Grund` gefüllt (inkl. abgeschlossener) | Manuell gegen Sheet prüfen |
| G4 | Gesamtzeit in AKTUELL = heute − BlockedStart + 1 (mind. 1) | Datensatz mit bekanntem Datum |
| G5 | Gesamtzeit in GESAMT für abgeschlossene Episoden = BlockedEnd − BlockedStart + 1 | Datensatz mit bekanntem Datum |
| G6 | Summary-Tabellen summieren korrekt (Gesamt = Summe aller Zeilen) | Manuell nachrechnen |
| G7 | Unbekannte Gründe: erscheinen in Haupt-Tabelle, **nicht** in Summary-Tabelle | Datensatz mit unbekanntem Grund |
| G8 | Squad-Filter: Wahl von "Squad-A" → nur Zeilen mit Squad="Squad-A" sichtbar | Filter testen |
| G9 | "Wie oft": gleiche issues.key+Squad-Kombination zeigt denselben Zähler in allen Zeilen | Datensatz mit mehreren Episoden |
| G10 | Sortierung: Klick auf Spaltenheader sortiert auf-/absteigend, Pfeil ändert sich | Manuell testen |
| G11 | Key-Link: Klick öffnet URL-Template mit Issue-Key im neuen Tab (wenn Template gesetzt) | URL-Template konfigurieren |
| G12 | Kein URL-Template → Keys werden ohne Cursor/Farbe angezeigt (kein Klick-Event) | Ohne URL-Template testen |
| G13 | Browser-Reload: Squad-Filter-State erhalten | Reload nach Filter-Auswahl |
| G14 | Diag-Bar zeigt korrekte N-Episoden-Zahl und Datenfehler-Anzahl | Datensatz mit fehlendem BlockedStart |
| G15 | AKTUELL N=0 → "Aktuell keine blockierten Issues"-Meldung sichtbar | Alle AKTUELL-Zeilen haben BlockedEnd gefüllt |

---

## Block H – Integration (3 Stellen)

### H.1 Neue Datei
`src/blocker.js` (neu anlegen)

### H.2 index.html – 3 Änderungen

**1. Sidebar-Eintrag** (vor wipage, nach `.sidebar-section` "Detailanalysen"):
```html
<div class="sidebar-link" data-page="blocker">
  <span class="sidebar-glyph">⛔</span>
  <span class="sidebar-txt">
    <span class="sidebar-name">Was blockiert uns?</span>
    <span class="sidebar-tech">Blockermanagement</span>
  </span>
</div>
```

**2. Page-HTML** (vor `<!-- Page: WIPAge -->`):
```html
<!-- Page: Blockermanagement -->
<div class="page page-flex" id="page-blocker">
  <div class="page-filterbar">
    <span class="pf-page-title">Was blockiert uns?</span>
    <div class="pf-sep"></div>
    <button class="pf-filter-chip btn-squad-trigger" id="btn-squad-blocker">SQUADS Alle &#9661;</button>
    <div class="pf-spacer"></div>
    <button class="pf-reset pf-filter-chip squad-filter-reset">&#8635; Filter zurücksetzen</button>
  </div>
  <div class="page-scroll" style="flex:1;overflow-y:auto;padding:1rem">
    <div id="blocker-canvas"></div>
    <div id="blocker-diag" style="font-size:.7rem;color:var(--dimmer);padding:.5rem 0"></div>
  </div>
</div>
```

**3. Import + Init** (im `<script type="module">`):
```javascript
import { init as initBlocker } from './blocker.js';
// ...
initBlocker();
```

Und in `showPage`-Logik / Page-Mapping: `'blocker'` als page-flex hinzufügen (analog wipage).

### H.3 build.py – 5 Stellen
1. `read('blocker.js')`
2. `strip_module_syntax('blocker.js')`
3. Init-Rename: `init_blocker`
4. `wrap_iife('blocker.js')`
5. Bootstrap + `bundled_js`

---

## Änderungshistorie

| Version | Datum | Beschreibung |
|---|---|---|
| 1.0 | 2026-06-17 | Initiale Spec – SDD-Interview durchgeführt, Gate 1 bestätigt, implementiert |
| 1.0.1 | 2026-06-17 | Bugfix: `core.state.filter` → `core.state.squadFilter` (falscher Property-Name, Filter hatte keine Wirkung) |
