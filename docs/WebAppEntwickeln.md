# Flow Analytics – Web App Entwicklungs-Leitfaden

**Version:** 4.8  
**Datum:** 2026-06-11  
**Basis:** WebAppEntwickeln.md v3.1 + Architektur-Erweiterung (Navigation, Multi-Sheet, 5 neue Visuals)  
**Vorgänger-Dateien:** `FlowAnalytics_Dashboard_Uebergabe.md` + `pbiviz_entwickeln.md` → zusammengeführt, Power BI entfällt

---

## 0. Zusammenarbeits-Protokoll (verbindlich)

Dieser Abschnitt regelt **wie** Claude und Oliver zusammenarbeiten. Alle Regeln sind verbindlich und werden von Claude selbst eingehalten – ohne Aufforderung.

---

### 0.0 Spec-Driven Development (SDD) – Spezifikation vor dem Code

**Wann:** Vor Gate 1, vor dem ersten Prototyp, vor jeder Zeile Code.

**Was Claude tut:** Ein strukturiertes Interview führen, daraus die `docs/specs/VisualName.md` schreiben, und erst nach Bestätigung durch Oliver mit Gate 1 fortfahren.

**Warum:** Eine bestätigte Spec ist die einzige Quelle der Wahrheit. Sie verhindert Fehlentwicklungen, macht Neuanfänge reproduzierbar und ersetzt das mündliche Hin-und-Her durch ein Dokument das im nächsten Chat-Kontext direkt wiederverwendbar ist.

#### SDD-Interview-Protokoll

Claude führt das Interview in **7 Blöcken (A–G)**. Innerhalb eines Blocks dürfen mehrere zusammenhängende Fragen auf einmal gestellt werden (Ausnahme zu M1). Zwischen den Blöcken wartet Claude auf Olivers Antwort.

**Wie Claude das Interview startet:**

Wenn Oliver ein neues Visual ankündigt, antwortet Claude:

> „Gut. Ich führe zuerst das SDD-Interview durch, damit wir eine vollständige Spec haben bevor wir starten. Block A: [Fragen]"

**Block A – Zweck & Abgrenzung**
```
1. Beschreibe das Visual in 2–3 Sätzen: Was zeigt es? Welches Problem löst es?
2. Was macht es explizit NICHT? (Cross-Filter? Andere Visuals beeinflussen?)
3. Technologie: immer Web-App (.js + core.js) – trotzdem explizit bestätigen.
```

**Block B – Datenmodell**
```
1. Welche Excel-Spalten werden gelesen? (Name, Typ, Pflicht/Optional)
2. Erkennungslogik: Wie unterscheidet das Visual relevante Spalten von Meta-Spalten?
3. Was passiert bei fehlenden Pflicht-Spalten?
```

**Block C – UX & Layout**
```
1. Zeichne (ASCII) oder beschreibe die Hauptbereiche des Visuals.
2. Welche Interaktionen gibt es? (Hover, Click, Panel öffnen, Drag, Reihenfolge ändern)
3. Leerzustand: Was sieht der Nutzer wenn keine Daten geladen sind / alle Items gefiltert wurden?
4. Responsive: Wie verändert sich das Visual bei kleiner Größe?
```

**Block D – Berechnungslogik**
```
1. Was sind die Kern-Metriken und wie werden sie berechnet? (Formeln explizit, z.B. CT = (end-start)/86400000+1)
2. Welche Filter- oder Aggregationslogik gibt es?
3. Edge Cases: Was passiert bei Items ohne Datum? Negativen Werten? Leeren Gruppen? Division durch 0?
```

**Block E – Config / Format-Panel**
```
Für jede konfigurierbare Eigenschaft:
| Property | Typ | Default | Min/Max | Effekt | Validierung |
Pro Eigenschaft eine Zeile – keine Lücken.
```

**Block F – Design-Standards (Pflichtcheck)**
```
1. Tooltip: boundary-safe (positionTooltip) + Links (Hover-Delay, pointerEvents)?
2. N-Anzeige: wo genau?
3. Reihenfolge-Panel: ▲/▼ + Drag benötigt?
4. Skalierung: Wie skalieren Punkte/Balken/Zellen mit der Containergröße?
5. Diagnosemodus: Welche Infos zeigt die Diag-Zeile mindestens?
6. Link-Feature: core.state.urlTemplate + window.open? Oder nicht benötigt?
```

**Block G – Akzeptanzkriterien**
```
Testbare Aussagen die Claude beim Implementieren prüft und Oliver beim manuellen Test abhakt.
Beispiele:
- "Tooltip bleibt an allen 4 Ecken des Visuals vollständig sichtbar"
- "Config-State überlebt Browser-Reload"
- "Bei 0 Datenzeilen: Diag-Meldung sichtbar, kein JS-Error in der Console"
- "Dots skalieren sichtbar wenn Visual von 400px auf 200px Breite verkleinert wird"
```

#### SDD-Ausgabe

Nach Abschluss aller Blöcke schreibt Claude die `docs/specs/VisualName.md` nach der Vorlage in §13 und präsentiert sie Oliver zur Bestätigung:

> „Hier ist die vollständige Spec: [SDD-Inhalt]. Passt das, oder soll ich etwas korrigieren?"

Erst nach Bestätigung durch Oliver beginnt **Gate 1**.

---

### 0.1 Quality Gate 1 – SDD-Bestätigung (vor dem ersten Code)

**Wann:** Direkt nach dem SDD-Interview – bevor irgendeine Zeile Code geschrieben wird.

**Was Claude tut:** Die fertige SDD kurz zusammenfassen und explizit auf Bestätigung warten. Gate 1 ist der formale Freeze-Moment.

```
## Gate 1 – SDD bestätigt: [VisualName]

SDD-Dokument: [docs/specs/VisualName.md] liegt vor.

Kern-Entscheidungen:
- Technologie: Web-App (.js + core.js)
- Datenmodell: [N Excel-Spalten] – [Erkennungslogik]
- Config: [N Properties] in localStorage-Key fhwa_[visualId]
- Design: Tooltip ✓ · N-Anzeige: [wo] · Reihenfolge: [ja/nein] · Link: [ja/nein]
- Layout-Freeze: Seite [lieferfahigkeit / wipage / scatter / heatmap] · Tile oder Card · [Beschreibung Hauptbereiche]
- Akzeptanzkriterien: [N Punkte in SDD Block G]

Offene Punkte die noch nicht in der SDD stehen:
1. [falls vorhanden – sonst: keine]

Soll ich mit dem Prototyp beginnen? (§0.8 M6)
```

Oliver antwortet mit „Ja" oder korrigiert einzelne Punkte. Erst dann beginnt Claude mit dem Prototyp.

---

### 0.2 Quality Gate 2 – Pre-Delivery Review (vor jeder Datei-Übergabe)

**Wann:** Direkt bevor Claude die `.js`-Datei(en) übergeben wird.

**Was Claude tut:** Die vollständige Checkliste selbst durchgehen. Alle `[ ]` müssen zu `[x]` werden – Claude behebt Lücken selbst.

```
## Pre-Delivery Review – [VisualName] v[X.Y]

### Code-Qualität
- [x] Kein innerHTML verwendet → nur DOM-Aufbau via Template-Strings in SVG-Kontext (svgEl.innerHTML = parts.join('') ist erlaubt)
- [x] Tooltips: boundary-safe positionTooltip() + Hover-Delay wenn Links vorhanden
- [x] Math.max() mit leerem Array abgesichert (length-Check)
- [x] Keine hardcodierten SVG-Farben → immer core.scatterColors() oder CSS-Variablen
- [x] Zeitberechnungen: Dual-Period-Logik (_first-Spalten beachtet)
- [x] Aktiv/Erledigt-Logik: erledigt = Resolved XOR Rejected

### Struktur & Integration
- [x] Visual erzeugt eigene Card via `core.createCard()` (Deep-Dive) **oder** Tile via `core.createTile()` (Lieferfähigkeit)
- [x] Config-State lokal im Visual (nie in core.state schreiben)
- [x] localStorage-Key: fhwa_[visualId]
- [x] Events abonniert: data, theme, filter, resize (+ settings wenn urlTemplate genutzt)
- [x] index.html: import + init() ergänzt
- [x] build.py: neues Visual an allen 5 Stellen eingetragen (falls neues Visual):
      `read()` · `strip_module_syntax()` · init-Rename · `wrap_iife()` · bootstrap + `bundled_js`
- [x] Kein top-level `const`/`let` das mit anderen Visuals kollidieren könnte →
      `build.py wrap_iife()` isoliert den Scope automatisch; lokale Konstanten sind kein Problem

### Design-Standards
- [x] Tooltip: position:absolute im Card-Container, positionTooltip() mit Overflow-Prüfung
- [x] Diag-Bar: diagEl.textContent gesetzt
- [x] N-Anzeige: vorhanden, Position: [wo?]
- [x] Skalierung: alle Größen relativ zu Container-Breite/Höhe
- [x/-] Reihenfolge-Panel: ▲/▼ + Drag / nicht benötigt
- [x/-] Link-Feature: core.state.urlTemplate + window.open / nicht benötigt

### Spec & Dokumentation (§0.10 M8)
- [x] docs/specs/VisualName.md aktualisiert und zusammen mit .js übergeben
- [x] Alle Änderungen in Akzeptanzkriterien (Block G) und Änderungshistorie eingetragen

### Testautomatisierung (§0.21 M19)
- [x] Unit Tests für neue/geänderte Berechnungslogik: `npx vitest run` → alle grün
- [x/-] Test-Skeleton für neues Visual angelegt: `tests/unit/[visualName].calc.test.js` + `tests/e2e/[visualName].spec.js`

### Manueller Test-Hinweis für Oliver (§0.11 M9 Smoke-Test)
- [ ] Dateien ins Projektverzeichnis legen + `build.py` ausführen
- [ ] Zur neuen/geänderten Seite navigieren → öffnet sie, oder ist sie leer?
- [ ] Wichtigste Interaktionen testen (Einstellungen, Squad-Filter, Theme-Toggle)
- [ ] Excel laden → Visual erscheint?
- [ ] Tooltip an allen 4 Ecken des Visuals testen
- [ ] Browser-Reload: Config-State erhalten?
```

---

### 0.3 Maßnahme M1 – Eine Frage, dann warten

Claude stellt in einer Antwort **immer nur eine Klärungsfrage**. Wenn mehrere Unklarheiten bestehen, nennt Claude die wichtigste zuerst.

**Ausnahme:** Beim SDD-Interview (§0.0) dürfen alle Fragen eines Blocks gesammelt gestellt werden.

---

### 0.4 Maßnahme M2 – Anforderungs-Zusammenfassung vor dem Code

Entspricht Gate 1 (§0.1). Die Zusammenfassung ist nicht optional.

---

### 0.5 Maßnahme M3 – „Ich mache X, weil Y" bei Design-Entscheidungen

Wenn Claude eine Design-Entscheidung trifft, die nicht explizit vorgegeben war, benennt Claude kurz die Begründung:

> „N-Anzeige platziere ich unter der X-Achse, weil dort kein anderes Element kollidiert. Passt das?"

---

### 0.6 Maßnahme M4 – Übergabe-Dokument ab Nachricht 15

Ab Nachricht 15 fragt Claude aktiv:

> „Wir sind bei Nachricht 15. Soll ich ein Übergabe-Dokument anlegen, damit der Kontext bei einem Chat-Neustart erhalten bleibt?"

Das Übergabe-Dokument wird nach §12-Vorlage erstellt.

---

### 0.7 Maßnahme M5 – Bug-Wissen nach jedem Fix dokumentieren

Wenn im Laufe eines Chats ein Bug entdeckt und behoben wird, dokumentiert Claude den Fix automatisch am Chatende – mit Symptom, Ursache und Fix. Ziel-Abschnitt: „Bekannte Bugs und Lösungen" in dieser Datei.

**SDD-Update-Regel bei Fehlerbehebung:**

```
War der Bug ein Implementierungsfehler?     War der Bug eine Spec-Lücke?
(z.B. falsches Array-Indexing)              (z.B. Edge Case nicht bedacht)
→ Direkt fixen.                             → SDD zuerst updaten (Block D oder G).
→ Nur Bug-Doku ergänzen (M5).              → Dann erst fixen.
                                            → Bug-Doku ergänzen (M5).
```

---

### 0.8 Maßnahme M6 – Kein Code vor Prototyp-Freigabe

Bei neuen Visuals: **erst HTML-Prototyp bauen und von Oliver freigeben lassen, dann erst vollständige Implementierung.**

Ausnahme: Kleine Bugfixes oder Erweiterungen an bestehendem Code brauchen keinen neuen Prototyp.

---

### 0.9 Maßnahme M7 – Datei-Check nach jeder Entwicklung

**Wann:** Direkt nach jeder abgeschlossenen Entwicklung (neues Visual, Änderung, Bugfix).

**Was Claude tut:** Prüfen welche Dateien von der Änderung betroffen sind und diese – wenn vorhanden – sofort aktualisieren. Fehlen Dateien, werden sie explizit angefordert.

**Dateien die Claude prüft:**

| Datei | Wann aktualisieren |
|---|---|
| `docs/specs/VisualName.md` | **Immer** – bei jeder Änderung am Visual |
| `WebAppEntwickeln.md` | Bei Architektur-, Prozess- oder Protokolländerungen |
| `src/core.js` | Wenn neue Core-Funktionen ergänzt oder geändert wurden |
| `src/index.html` | Wenn neues Visual eingebunden oder Navigation geändert wurde |
| `build.py` | Wenn neues Visual an allen 5 Stellen eingetragen werden muss |

**Ablauf am Ende jeder Entwicklungseinheit:**

```
Datei-Check:
- [x/–] docs/specs/VisualName.md     → [aktualisiert / nicht betroffen]
- [x/–] WebAppEntwickeln.md          → [aktualisiert / nicht betroffen]
- [x/–] core.js                      → [aktualisiert / nicht betroffen / bitte hochladen]
- [x/–] index.html                   → [aktualisiert / nicht betroffen / bitte hochladen]
- [x/–] build.py                     → [aktualisiert / nicht betroffen / bitte hochladen]
```

Wenn eine benötigte Datei nicht hochgeladen wurde, sagt Claude:

> „Für diese Änderung muss auch `[Datei]` aktualisiert werden. Kannst du sie hochladen?"

---

### 0.10 Maßnahme M8 – Spec als lebendiges Dokument (Spec-First)

**Grundsatz:** Die Spec-Datei ist die **einzige Quelle der Wahrheit** und muss den aktuellen Implementierungsstand widerspiegeln. Sie wird nicht am Ende ergänzt, sondern **während** der Entwicklung geführt.

**Konkret:**

- **Vor dem Code:** Wenn Anforderungen per Klärungsfragen geklärt werden (§0.3 M1), hält Claude die bestätigten Entscheidungen sofort in einem Spec-Entwurf fest – nicht erst nach der Implementierung.
- **Mit dem Code:** Die aktualisierte Spec wird **zusammen mit der .js-Datei** übergeben, nicht als separater Nachschritt.
- **Pre-Delivery Review** (§0.2) enthält deshalb einen Pflicht-Check: `Spec aktualisiert? [x]`

**Warum:** Eine veraltete Spec ist keine Spec. Wenn Code und Spec auseinanderlaufen, verliert das Dokument seinen Wert als Grundlage für den nächsten Chat-Kontext.

**Keine Ausnahmen:** Auch wenn es „nur ein kleiner Umbau" ist — jede Änderung die das Verhalten des Visuals ändert, erfordert einen Spec-Update. Die Versuchung, den Spec-Update als „nachträglichen Schritt" zu behandeln, ist der häufigste Grund für veraltete Specs.

---

### 0.11 Maßnahme M9 – Manueller Smoke-Test vor Chat-Ende

**Wann:** Direkt bevor Oliver die gelieferten Dateien als fertig akzeptiert — noch im selben Chat, in dem entwickelt wurde.

**Was Oliver tut:** Gelieferte Dateien ins Projektverzeichnis legen, `build.py` ausführen, `FlowAnalytics.html` im Browser öffnen, und drei Dinge prüfen:

```
1. Zur neuen/geänderten Seite navigieren → öffnet sie, oder ist sie leer?
2. Wichtigste Interaktionen testen → Einstellungen öffnen, Squad wählen, Theme wechseln
3. Eine Excel-Datei laden → erscheint das Visual?
```

Dauer: ca. 2 Minuten.

**Warum vor dem Chat-Ende:** Wenn ein Bug im selben Chat gefunden wird, hat Claude noch den vollen Kontext und kann ihn direkt fixen. Wird der Bug erst im nächsten Chat gemeldet, muss Claude alle Dateien neu einlesen — das kostet 5–10× mehr Aufwand.

**Was bei einem Fund passiert:**
> Oliver beschreibt kurz was er sieht → Claude fixt im selben Chat → Oliver wiederholt den Test.

---

### 0.12 Maßnahme M10 – Screenshot bei Design-Änderungen

**Wann:** Immer wenn ein bestehendes Visual optisch verändert wird (Layout, Farben, Positionierung von Elementen).

**Was Oliver tut:** Einen Screenshot des Visuals **vor** und **nach** der Änderung machen und im Chat anhängen wenn etwas nicht stimmt.

**Was Claude tut:** Bei Design-Änderungen an bestehenden Visuals explizit darauf hinweisen:
> „Diese Änderung betrifft das Layout. Kannst du nach dem Test einen Screenshot schicken, damit wir sehen ob alles stimmt?"

**Warum:** Mehrere Design-Regressions (Scatterplot verschwunden, Sidebar falsch positioniert) wurden erst nach mehreren Chat-Runden entdeckt, weil kein visueller Abgleich stattfand.

---

### 0.13 Maßnahme M11 – build.py Selbst-Check

**Wann:** Am Ende jedes `build.py`-Runs automatisch.

**Was `build.py` tut:** Nach dem Bündeln prüfen ob alle registrierten `init_*`-Funktionen im Bootstrap-Block vorhanden sind:

```python
# Am Ende von build.py ergänzen:
expected = ['init_heatmap', 'init_scatter', 'init_wipage',
            'init_boxchart', 'init_happiness', 'init_wip',
            'init_flowefficiency']  # ← Liste pflegen
for fn in expected:
    if fn not in bundled_js:
        print(f"⚠️  WARNUNG: {fn}() fehlt im Bundle!")
    else:
        print(f"✓  {fn}() vorhanden")
```

**Warum:** `build.py` hat mehrfach ein valides Bundle geliefert, dem ein `init_*()`-Aufruf im Bootstrap fehlte. Die App lud das Visual dann stillschweigend nicht — kein Fehler in der Console, nur ein leeres Panel.

---

### 0.14 Maßnahme M12 – Architecture Decision Log (ADL)

Architektur-Entscheidungen die über eine Sitzung hinaus gelten, werden in einem eigenen Abschnitt dieser Datei festgehalten (siehe „Architecture Decision Log" weiter unten).

**Was dort eingetragen wird:** Entscheidungen die nicht offensichtlich sind und deren Begründung im nächsten Chat nicht mehr sichtbar ist — z.B. warum `var` statt `const/let` im Bootstrap, warum `clientWidth`-Fallback auf `window.innerWidth`, warum IIFE statt Modul-Scope.

**Was Claude tut:** Wenn im Chat eine solche Entscheidung getroffen wird, ergänzt Claude am Ende automatisch einen ADL-Eintrag.

---

### 0.15 Maßnahme M13 – Strukturiertes Chat-Abschluss-Protokoll

Ergänzung zu M4 (§0.6): Ab Nachricht 15 nicht nur ein Übergabe-Dokument anbieten, sondern am Chat-Ende **immer** ein strukturiertes Abschluss-Protokoll ausgeben:

```
## Chat-Abschluss

**Was wurde getan:**
- [Visual / Feature / Bugfix] implementiert (v[X.Y])
- [Datei] aktualisiert

**Offen / Nächster Schritt:**
- [Backlog-Eintrag oder Folgeaufgabe]

**Für den nächsten Chat hochladen:**
- WebAppEntwickeln.md (diese Datei, aktualisierte Version)
- [weitere Dateien je nach Aufgabe]

**Einstiegssatz:**
> „[konkreter Startpunkt für den nächsten Chat]"
```

**Warum:** Mehrere Chats endeten informell. Der nächste Chat begann dann ohne klaren Anknüpfungspunkt — Zeit ging für Orientierung verloren.

---

### 0.16 Maßnahme M14 – Chat-Scope begrenzen

**Regel:** Pro Chat maximal **eine** klar abgegrenzte Aufgabe:
- Ein neues Visual (SDD-Interview + Implementierung)
- Ein Bugfix oder eine Erweiterung an einem bestehenden Visual
- Eine Architektur-/Layout-Änderung

**Was Claude tut:** Wenn Oliver mehrere Aufgaben in einer Nachricht ankündigt, schlägt Claude vor, sie auf mehrere Chats aufzuteilen:
> „Das sind zwei unabhängige Themen. Ich schlage vor, wir nehmen [Aufgabe A] heute und starten für [Aufgabe B] einen neuen Chat — so bleibt der Kontext zuverlässig."

**Warum:** Chats die mehrere Visuals oder eine Migration + einen Bugfix + eine Spec-Aktualisierung kombinieren, füllten das Kontextfenster so stark, dass am Ende Tool-Results wegfielen und Fehler entstanden die vorher nicht da waren.

---

### 0.17 Maßnahme M15 – Fachbegriffe-Glossar

Projektspezifische Begriffe die in Missverständnisse geführt haben, werden in einem Glossar am Ende dieser Datei geführt (siehe „Glossar" weiter unten).

**Was Claude tut:** Wenn im Chat ein Begriff verwendet wird, der noch nicht im Glossar steht und missverständlich sein könnte, schlägt Claude eine Definition vor:
> „Ich nehme an du meinst mit ‚Iteration' dasselbe wie ‚Sprint / Quartal'. Soll ich das ins Glossar eintragen?"

---

### 0.18 Maßnahme M16 – Scope-Check bei explorativen Themen

**Wann:** Wenn ein Chat über eine Idee oder Architektur diskutiert ohne direkten Implementierungsauftrag (z.B. „Können wir Jira direkt abfragen?").

**Was Claude tut:** Am Ende einer explorativen Diskussion explizit abschließen:
> „Sollen wir das als Backlog-Eintrag festhalten, oder ist die Idee verworfen?"

**Ziel:** Kein Chat endet ohne konkretes Ergebnis — entweder eine Entscheidung, ein Backlog-Eintrag oder ein explizites „zurückgestellt".

---

### 0.19 Maßnahme M17 – Standard-Testdatensatz

**Ziel:** Eine dedizierte Excel-Datei mit bekannten Werten und gezielten Edge Cases, die für alle manuellen Tests aus Block G der Spec-Dateien verwendet wird.

**Was die Testdatei enthalten soll** (gemeinsam mit Oliver zu definieren):
- Items mit `_first`-Spalten die gleich und verschieden sind (Dual-Period-Logik)
- Items ohne `Resolved`-Datum (aktive WIP-Items)
- Items mit `Rejected` gefüllt
- Leere Squad-Spalte
- Squad mit genau 1 Item, Squad mit 50 Items
- Fehlende optionale Sheets (kein `Epics`-Sheet → Say_Do_Ratio Leerzustand)

**Status:** ✅ Erstellt (2026-06-12). Liegt unter `tests/fixtures/testdata.xlsx`.  
Erzeugt via `python tools/create_testdata.py`. Enthält JiraStories, Epics und Happiness-Faktor-Sheet.  
Ergänzung mit echten (anonymisierten) Jira-Daten empfohlen — siehe TestAutomatisierung.md Block B Punkt 3.

---

### 0.21 Maßnahme M19 – Testautomatisierung

**Spec:** `docs/specs/TestAutomatisierung.md`

#### Zwei Schichten

| Schicht | Werkzeug | Befehl | Wann |
|---|---|---|---|
| Unit Tests | Vitest | `npm test` | Automatisch vor jedem Commit (pre-commit Hook) |
| E2E Tests | Playwright | `npm run test:e2e` | Manuell nach `build.py` |

#### Was Claude bei neuem Visual automatisch tut

**Im SDD-Interview nach Block G:**
```
Ich lege jetzt den Test-Skeleton an:
- tests/unit/[visualName].calc.test.js  ← leere it()-Blöcke für jeden AC
- tests/e2e/[visualName].spec.js        ← Playwright-Skeleton
```

**Im Gate 2 (Pre-Delivery Review):** Zwei neue Pflichtpunkte — siehe §0.2.

**Bei Bugfixes mit Berechnungslogik:** Erst failing Test schreiben, dann fixen, dann `npm test` grün.

#### Wichtiger Hinweis: Copy-Paste-Anti-Pattern vermeiden

Unit-Tests dürfen Berechnungslogik **nicht** kopieren. Stattdessen muss die Funktion aus der Quelldatei importiert werden:

```js
// ❌ FALSCH – kopiert aus scatter.js, unsichtbar für Modul-Fehler
function calcCT(startVal, endVal) { ... }

// ✅ RICHTIG – importiert aus Quelldatei
import { calcCT } from '../../src/calc/scatter.calc.js';
```

Alle Unit-Tests importieren seit Phase 2 (2026-06-15) aus echten `src/calc/`-Dateien. Reine Berechnungsfunktionen leben in `src/calc/[name].calc.js` — Browser-API-frei, daher mit `environment: 'node'` testbar. Visual-Quelldateien delegieren an `src/calc/`, Unit-Tests importieren ebenfalls von dort. Neu hinzukommende Visuals sollen diesem Muster folgen (Berechnungslogik → `src/calc/`, Visual-Datei importiert von dort).

#### Testdatensatz M17

Liegt unter `tests/fixtures/testdata.xlsx`. Wird von Unit Tests und Playwright verwendet.  
Neu erzeugen: `python tools/create_testdata.py`

---

### 0.20 Maßnahme M18 – Backlog-Priorisierung am Chat-Start

**Wann:** Am Beginn jedes Chats bei dem kein konkreter Auftrag vorliegt.

**Was Claude tut:** Den aktuellen Backlog nennen und Oliver entscheiden lassen:
> „Im Backlog stehen: CFD, Card-Titel editierbar, Card minimieren. Was nehmen wir heute?"

**Warum:** Ohne Ritual dominieren Bugfixes die Entwicklung. Features im Backlog bleiben liegen, obwohl sie für den Mehrwert der App wichtiger wären.

---

## Was die App macht

Browser-basiertes Flow-Analytics-Dashboard: Vier Dateien in einem SharePoint-Ordner (kein Server, kein Build-System), die eine Excel-Datei (mehrere Worksheets) einlesen und Visuals in einer navigierbaren Single-Page-App anzeigen.

### Navigation & Seitenstruktur

Die App ist in **Seiten (Pages)** gegliedert, die über eine persistente linke Sidebar navigiert werden. Jede Page hat einen Namen und enthält eine definierte Menge von Visuals.

| Page | Sidebar-Label | Visuals |
|---|---|---|
| `lieferfahigkeit` | Lieferfähigkeit | LeadTime KPI, Say_Do_Ratio, WIP, Flow Efficiency, Happiness Index, Akzeptanzkriterien |
| `wipage` | Was liegt gerade rum? | WIPAge Chart |
| `scatter` | Wie lange dauert ein Ticket? | CycleTime Scatterplot |
| `heatmap` | Wo verbringen Tickets ihre Zeit? | FlowHeatmap |
| `monte` | Wann sind wir fertig? | MonteCarlo |

**Sidebar-Struktur:** Jeder Link hat Glyph-Icon (`▤ ◔ ◑ ◕ 🎲🎲`), Hauptname und technischen Untertitel (z.B. „WIP-Alter"). Die Links sind in zwei Sections aufgeteilt: „Überblick" (Lieferfähigkeit) und „Detailanalysen" (die 4 Deep-Dive-Pages).

**Einstieg:** Nach dem Datei-Upload zeigt der Upload-Screen eine Data-Preview („Das haben wir in deinem Export gefunden") und leitet per CTA-Button zur Lieferfähigkeit-Page weiter.

### Visuals — bestehend

**Visual 1 – FlowHeatmap (`heatmap.js`):** Kumulative Verweildauer von Work Items in Workflow-Zuständen, gruppiert nach Issue-Type oder Squad.

**Visual 2 – CycleTime Scatterplot (`scatter.js`):** Durchlaufzeit (CT) jedes Work Items über die Zeit, mit Perzentil-Linien, 3 Farb-Modi und Jira-Link im Tooltip.

**Visual 3 – WIPAge Chart (`wipage.js`):** Scatterplot aktiver WIP-Items gruppiert nach aktuellem Status (X-Achse), Rolling-Pace-Bänder (P25/P50/P85/P90), Reihenfolge-Panel, Jira-Link.

**Visual 4 – LeadTime BoxChart (`boxchart.js`):** Box-Plot zur Lead-Time-Analyse pro Periode (Monat/Quartal). Auf der Lieferfähigkeit-Page als KPI-Card dargestellt.

### Visuals — neu (Lieferfähigkeit-Page)

**Visual 5 – Say_Do_Ratio (`saydoratio.js`):** Verhältnis geplanter zu abgeschlossener Epics pro Quartal, als Verlauf über alle vorhandenen Quartale. Datenquelle: `Epics`-Sheet.

**Visual 6 – WIP KPI (`wipkpi.js`):** Aktuelle WIP-Anzahl als KPI-Card mit Trend. Datenquelle: `JiraStories`-Sheet.

**Visual 7 – Flow Efficiency (`flowefficiency.js`):** Anteil aktiver Bearbeitungszeit an der Gesamtdurchlaufzeit. Berechnung aus Warte-Zuständen (`JiraStories`) und `BlockedReasons`-Sheet. Verknüpfung über JiraId + Squad.

**Visual 8 – Happiness Faktor (`happiness.js`):** Liniendiagramm der Team-Happiness (1–5) über Monate pro Squad. Datenquelle: `Happiness Faktor`-Sheet (Custom-Header-Zeile). Implementiert v1.0. localStorage-Key: `fhwa_happinessfaktor`.

**Visual 9 – Akzeptanzkriterien (`akzeptanz.js`):** KPI-Card mit Verlauf. Datenquelle: dediziertes Worksheet (Name noch offen – per SDD-Interview klären).

### Visuals — Deep-Dive-Pages

**Visual 10 – MonteCarlo (`montecarlo.js`):** Vorhersage-Simulation auf Basis historischem Throughput. Zwei Modi: „Bis wann fertig?" (N Issues → Fertigstellungsdatum) und „Wie viele bis X?" (Zieldatum → Issue-Anzahl). Stabilitäts-Check via Variationskoeffizient (CV), Sparkline, konfigurierbares Rolling Window. Datenquelle: `JiraStories`-Sheet (`Resolved`-Spalte, konfigurierbar). Eigenständige Deep-Dive-Page `monte`.

---

## Was die App NICHT macht

- Kein Cross-Filter zwischen Visuals
- Kein Server, keine API, kein Power BI
- Kein DAX, keine automatischen Aggregationen (wird alles in JS berechnet)
- Keine URL-Routing / keine echten Seiten-URLs — reine SPA mit Tab-Switching

---

## Deployment

Alle 4 Dateien in **einen gemeinsamen Ordner** auf SharePoint/OneDrive legen. Nutzer öffnen `index.html` per Link im Browser. ES-Module funktionieren weil SharePoint über HTTPS ausliefert.

```
project-root/
  docs/
    WebAppEntwickeln.md        ← dieser Leitfaden
    specs/
      LeadTime_BoxChart.md     ← bestätigte Spec
      WIPAge.md                ← bestätigte Spec
      [VisualName].md          ← künftige Specs
  src/
    index.html     ← Einstiegspunkt, Layout, CSS, Modul-Imports
    core.js        ← Gemeinsame Engine (State, Grid, Theme, Utils, Events)
    heatmap.js     ← FlowHeatmap Visual (vollständig eigenständig)
    scatter.js     ← CycleTime Scatterplot (vollständig eigenständig)
    wipage.js      ← WIPAge Chart (vollständig eigenständig)
    boxchart.js    ← LeadTime BoxChart (vollständig eigenständig)
    montecarlo.js  ← MonteCarlo Simulation (vollständig eigenständig)
  tools/
    build.py              ← Bundle-Skript
    create_testdata.py    ← Erzeugt tests/fixtures/testdata.xlsx (M17)
  tests/
    unit/                 ← Vitest Unit Tests (Berechnungslogik)
    e2e/                  ← Playwright E2E Tests (Browser)
    fixtures/
      testdata.xlsx       ← M17 Standard-Testdatensatz
      testdata-empty.xlsx ← Leerdatei (nur Header)
  Web App/
    FlowAnalytics.html         ← Ausgabe von build.py
  .github/
    copilot-instructions.md    ← Copilot Hintergrundinstruktionen
  package.json          ← Vitest + Playwright Abhängigkeiten
  vitest.config.js      ← Unit Test Konfiguration
  playwright.config.js  ← E2E Test Konfiguration
```

**Abhängigkeiten (CDN, kein lokaler Install):**
```
Google Fonts: DM Sans + DM Mono
SheetJS:      https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js
```

---

## build.py – Bundle für SharePoint ohne HTTPS-Modul-Support

`build.py` bündelt die ES-Modul-Dateien in eine einzelne `FlowAnalytics.html` für Umgebungen, in denen `type="module"` Scripts nicht funktionieren. Für Entwicklung und Standard-SharePoint immer die ES-Modul-Version verwenden.

### Was build.py tut (und was es nicht tut)

`strip_module_syntax()` entfernt:
- Zeilen die mit `import ` beginnen (komplette Zeile)
- `export ` Präfix vor `const`, `let`, `var`, `function`, `class`, `async function`

`strip_module_syntax()` entfernt **nicht:**
- `export default` → Laufzeitfehler
- `export { x, y }` → bleibt als ungültiger Code stehen
- `import()` dynamische Imports → bleiben stehen

**Regel:** In `.js`-Dateien nur `export const/function/class` und `import ... from` verwenden. Kein `export default`, keine Re-Exports.

### `init()` Namenskonvention – Pflicht

`build.py` benennt die `init()`-Funktion jeder Visual-Datei um um Kollisionen zu vermeiden:

```python
heatmap_out = heatmap_out.replace('function init()', 'function init_heatmap()', 1)
scatter_out = scatter_out.replace('function init()', 'function init_scatter()', 1)
```

Die Funktion muss exakt `function init()` heißen – nicht `async function init()`, nicht `const init = () =>`. `replace(..., 1)` ersetzt nur das **erste** Vorkommen – `init()` darf nur einmal als Funktionsdeklaration erscheinen.

### Neues Visual hinzufügen – fünf Stellen in build.py

```python
# Stelle 1: Datei einlesen
happiness_js = read('happiness.js')

# Stelle 2: Transformieren
happiness_out = strip_module_syntax(happiness_js)

# Stelle 3: init()-Funktion umbenennen
happiness_out = happiness_out.replace('function init()', 'function init_happiness()', 1)

# Stelle 4: In IIFE einwickeln (verhindert top-level const/let Kollisionen zwischen Visuals)
happiness_out = wrap_iife(happiness_out, 'init_happiness')

# Stelle 5a: In gebündeltes JS aufnehmen
bundled_js = (
    "// ── core.js ──\n" + core_out + "\n\n" +
    # ... weitere Visuals ...
    "// ── happiness.js ──\n" + happiness_out + "\n\n"  # ← neu
)

# Stelle 5b: Bootstrap-Aufruf ergänzen
bootstrap = (
    "  init_heatmap();\n"
    "  init_happiness();\n"   # ← neu
    "  core.initApp();"
)
```

**`wrap_iife()` – Pflicht für alle Visuals:**

```python
def wrap_iife(js, fn_name):
    return (
        "(function() {\n" +
        js + "\n" +
        f"window.{fn_name} = {fn_name};\n" +
        "})();"
    )
```

Isoliert den Visual-Code in einer IIFE. Dadurch sind `const`/`let`-Deklarationen auf oberster Datei-Ebene lokal und können nicht mit gleichnamigen Konstanten anderer Visuals kollidieren. Die `init_*`-Funktion wird über `window.*` exponiert, damit der Bootstrap-Code sie aufrufen kann. **Ohne IIFE-Wrapping bricht das Bundle mit `SyntaxError: Identifier already been declared`.**

**Fehler der Vergangenheit:** Neues Visual in `index.html` eingetragen aber `build.py` vergessen → das gebündelte `FlowAnalytics.html` lud das neue Visual nicht.

```bash
python build.py
# Ausgabe: FlowAnalytics.html (X.X KB)
```

---

## Excel-Datenstruktur

Die Excel-Datei enthält **mehrere Worksheets**. `core.js` lädt alle Sheets beim Upload und stellt sie über `core.state.sheets` bereit (siehe Multi-Sheet-Loading).

### Worksheets — Übersicht

| Sheet-Name | Status | Genutzt von | Inhalt |
|---|---|---|---|
| `JiraStories` | ✅ Pflicht | alle bestehenden Visuals | Work-Item-Daten |
| `Epics` | optional | Say_Do_Ratio | Epics mit Iterations-/Quartalszuordnung |
| `JiraBlockermanagement` | optional | Flow Efficiency | issues.key · Squad · Blocked/Warte-Episoden (BlockiertWartendSeit, Blockiert/Wartend_Zustand, Blockiert/Wartend_Grund, BlockedStart, BlockedEnd) |
| `Happiness Faktor` | optional | Happiness Index | Monats-Happiness (1–5) pro Squad; Custom-Header in Zeile 3 → `sheetsRaw` verwenden |
| *(Acceptance-Sheet)* | optional | Akzeptanzkriterien | Name per SDD-Interview klären |

**Regel Standard-Header:** Fehlt ein optionales Sheet → `core.state.sheets['Name']` gibt `[]` zurück → das zugehörige Visual zeigt einen Leerzustand. Kein Fehler, kein Core-Umbau.

**Regel Custom-Header (Header-Zeile nicht in Zeile 1):** `core.state.sheetsRaw['Name']` verwenden (2D-Array-Format). Header-Zeile per `findIndex` suchen, nie hardcodierte Zeilennummern verwenden.

### JiraStories — Spalten

Sheet-Name: **`JiraStories`** (Pflicht, Fallback: erstes Sheet)

| Excel-Spalte | Rolle | Pflicht? |
|---|---|---|
| `Jira-ID` | Eindeutiger Item-Identifier | ✅ |
| `Issue-Type` | Grouping + Scatter-Farb-Modus „Typ" | optional |
| `Squad` | Grouping + globaler Filter | optional |
| `Issue-Status` | Aktueller Workflow-Status (Text) – **WIPAge X-Achse** | optional* |
| `In Progress_first` | WIP-Startmarker – **WIPAge Aktiv-Logik** | optional* |
| `Ready4Progress_first` | LT/CT Start-Default | optional |
| `Resolved` | LT/CT Ende-Default + WIPAge Aktiv-Logik (leer = noch aktiv) | optional |
| `Rejected` | Abbruch-Marker – WIPAge Aktiv-Logik (leer = noch aktiv); **nicht** in Rolling Pace | optional |
| `[Zustand]_first` | Eintrittsdatum **erstes** Mal in Workflow-Zustand – **Dual-Period-Logik** | optional (mehrfach) |
| `leaving_[Zustand]_first` | Austrittsdatum erstes Mal – **Dual-Period-Logik** | optional (mehrfach) |
| `[Zustand]` | Eintrittsdatum **letztes/aktuelles** Mal in Workflow-Zustand | optional (mehrfach) |
| `leaving_[Zustand]` | Austrittsdatum letztes Mal – **WIPAge Rolling Pace** | optional (mehrfach) |

*Für WIPAge Chart erforderlich.

**State-Erkennungslogik:** Spalte ist Workflow-Zustand wenn sie nicht in `META_COLS`, nicht `leaving_`-Präfix, nicht `_first`-Suffix, nicht `_Count`-Suffix.

**Dauerberechnung – Dual-Period-Logik (gilt für alle Visuals):**

Ein Work Item kann einen Status zweimal durchlaufen (z.B. nach Rücksprung). Dafür gibt es `_first`-Spalten für den ersten Durchlauf und Basis-Spalten für den zweiten. Die korrekte Gesamtdauer:

```
X_first == X (gleicher Tag)?
├── Ja  → Item war nur einmal in X → Dauer = leaving_X − X + 1  (inklusiv)
└── Nein → Item hat X zweimal durchlaufen → Dauer = (leaving_X_first − X_first + 1)
                                                    + (leaving_X − X + 1)
```

Threshold für „gleich": Datums-Differenz < 0,5 Tage (43.200.000 ms).

**Aktiv/Erledigt-Logik (XOR):** Ein Item ist erledigt wenn `Resolved` **oder** `Rejected` gefüllt ist — da nur eines der beiden Felder befüllt sein kann, ist das effektiv ein XOR. Aktiv = weder `Resolved` noch `Rejected` gefüllt.

---

## Multi-Sheet-Loading (extensibles Pattern)

`core.js` lädt beim Excel-Upload **alle vorhandenen Worksheets** und stellt sie in einer generischen Map bereit. Dieses Pattern ist bewusst erweiterbar — neue Worksheets in der Excel-Datei werden automatisch ohne Core-Änderungen verfügbar.

### core.state.sheets

```javascript
// Nach dem Upload:
core.state.sheets = {
  'JiraStories':    [ ...rows ],   // Pflicht-Sheet
  'Epics':          [ ...rows ],   // wenn vorhanden
  'BlockedReasons': [ ...rows ],   // wenn vorhanden
  // alle weiteren Sheets landen hier automatisch
}

// core.state.rows bleibt als Alias erhalten (Kompatibilität bestehender Visuals):
core.state.rows === core.state.sheets['JiraStories']  // true
```

### Zugriff in Visuals

```javascript
// Sicher: gibt [] zurück wenn Sheet fehlt → kein Fehler, kein Core-Umbau
const epics   = core.state.sheets['Epics']          ?? [];
const blocked = core.state.sheets['BlockedReasons'] ?? [];

// Leerzustand prüfen
if (!epics.length) {
  diagEl.textContent = 'Epics-Sheet nicht gefunden';
  return;
}
```

### Platzhalter-Regel

Visuals deren Sheet noch nicht definiert ist (Happiness, Akzeptanzkriterien) werden zunächst als **Platzhalter** implementiert:
- Card existiert und ist in der Lieferfähigkeit-Page eingebettet
- Zeigt „–" oder „Daten folgen" wenn Sheet fehlt oder leer
- Vollständige Logik kommt im jeweiligen SDD-Interview wenn Sheet-Struktur bekannt ist

---

## Architektur

### Prinzip: Jedes Visual ist eine eigenständige Datei

```
index.html
  └── <script type="module">
        import { core }        from './core.js'
        import { init }        from './heatmap.js'   → abonniert core-Events
        import { init }        from './scatter.js'   → abonniert core-Events
        import { init }        from './wipage.js'    → abonniert core-Events
        import { init }        from './boxchart.js'  → abonniert core-Events
```

Jedes Visual:
- erzeugt seine eigene Card via `core.createCard()`
- hält seinen Config-State **lokal** (nicht in core)
- abonniert `core.on('data' | 'theme' | 'filter' | 'resize', fn)` — plus `'settings'` wenn es `core.state.urlTemplate` nutzt
- schreibt in eigenen localStorage-Key (`fhwa_xyz`)
- berührt keinen Code anderer Visuals

### DOM-Struktur (index.html)

```
<body>
  #upload-screen      Drag&Drop + Datei-Picker + Data-Preview
  #app-screen
    .sidebar          Persistente linke Navigation (Logo + Section-Labels + Page-Links mit Glyph)
    .main-content     Rechter Bereich, zeigt aktive Page
      #page-lieferfahigkeit
        #tile-canvas-lieferfahigkeit   Flexbox (flex-wrap, justify-content:center) für kompakte KPI-Kacheln
      #page-wipage            position:relative · WIPAge Card
      #page-scatter           position:relative · CycleTime Card
      #page-heatmap           position:relative · Heatmap Card
      #page-monte             position:relative · MonteCarlo Card
  [Tooltips]          von jedem Visual eigenständig erzeugt und an body gehängt
```

**Zwei Rendering-Modelle:**
- **Tile-Canvas** (Lieferfähigkeit-Page): kompakte `.tile`-Elemente in Flexbox (`flex-wrap:wrap`, `justify-content:center`), feste Breite `var(--tile-w, 550px)` + Höhe `var(--tile-h, 344px)` im 16:10-Verhältnis · kein Drag/Resize. Visuals rufen `core.createTile()` auf.
- **Page-Canvas** (Deep-Dive-Pages wipage/scatter/heatmap): `position:absolute`-Cards im Grid-System. Visuals rufen `core.createCard()` auf.

**Page-Switching:** `core.showPage(pageId)` blendet alle Pages aus, zeigt die gewählte, setzt `core.state.activePage` und speichert in `fhwa_activePage` (localStorage). Aktiver Sidebar-Link erhält Klasse `.active`.

**Kein Drag-Grid auf neuen Pages:** Die Lieferfähigkeit-Page nutzt ein festes CSS-Grid-Layout für die KPI-Cards. Das Drag-Resize-System (`fhwa_layout2`) bleibt für die bestehenden Single-Visual-Pages erhalten, wird aber pro Page separat initialisiert.

### Neues Visual registrieren (2 Schritte + build.py)

**Schritt 1** – neue `.js`-Datei schreiben (Template siehe unten).

**Schritt 2** – In `index.html` zwei Zeilen ergänzen:
```javascript
import { init as initBoxChart } from './boxchart.js';
// ...
initBoxChart();
```

**Schritt 3** – In `build.py` an allen 5 Stellen eintragen (siehe Deployment-Abschnitt).

---

## core.js – Public API

`core` ist ein Singleton-Objekt das alle Visuals importieren.

### Shared State (nur lesen, nie direkt schreiben)

```javascript
core.state.rows          // Row[] — JiraStories (Kompatibilität: identisch mit core.state.sheets['JiraStories'])
core.state.sheets        // { [sheetName]: Row[] } — alle geladenen Worksheets (Standard-Header in Zeile 1)
                         // Zugriff: core.state.sheets['Epics'] ?? []
core.state.sheetsRaw     // { [sheetName]: any[][] } — 2D-Array-Format (header:1) für Sheets mit
                         // Custom-Header-Zeile (nicht Zeile 1), z.B. 'Happiness Faktor'
                         // Zugriff: (core.state.sheetsRaw || {})['Happiness Faktor'] ?? []
                         // Header-Zeile finden: raw.findIndex(row => row.some(c => c === 'Schlüsselwert'))
core.state.dateCols      // string[] — alle Datumsspalten
core.state.states        // { name, entryCol, exitCol }[] — erkannte Workflow-Zustände
core.state.stateOrder    // string[] — aktuelle Reihenfolge der Zustände
core.state.allSquads     // string[] — alle Squad-Namen
core.state.hasSquad      // boolean
core.state.hasIssueType  // boolean
core.state.squadFilter   // string[] — aktiver globaler Filter ([] = alle)
core.state.fileName      // string
core.state.sheetName     // string
core.state.urlTemplate   // string — globales Jira URL-Template (⚙ Einstellungen-Panel)
core.state.activePage    // string — aktuell sichtbare Page-ID
```

### Event Bus

```javascript
core.on('data',        fn)    // Excel wurde geladen, state.rows gefüllt
core.on('theme',       fn)    // Dark/Light gewechselt → neu rendern
core.on('filter',      fn)    // Squad-Filter geändert → neu rendern
core.on('resize',      fn)    // Card wurde gezogen/resized → SVG neu rendern
core.on('settings',    fn)    // Globale Einstellung geändert (z.B. urlTemplate) → neu rendern
core.on('statusOrder', fn)    // Globale Status-Reihenfolge geändert → neu rendern + Panel aktualisieren
core.emit(event)              // intern; Visuals rufen das nicht auf
```

### Navigation

```javascript
core.showPage(pageId)        // Page wechseln: blendet alle Pages aus, zeigt pageId, speichert in localStorage
// core.state.activePage     // → string — aktuell sichtbare Page-ID (State, keine Methode)
```

### Card Factory

```javascript
const { cardEl, contentEl, headerExtraEl, diagEl } = core.createCard({
  id:          'wipage',                      // wird zu #card-wipage
  title:       'WIP<span class="hl">Age</span>',
  defaultGrid: { col: 0, row: 0, w: 6, h: 10 },
});
// cardEl         → das .card-Element (Drag/Resize, Grid)
// contentEl      → .card-content (hier rein rendern)
// headerExtraEl  → freier Bereich im Card-Header für eigene Buttons/Toggles
// diagEl         → .diag-bar (Diagnose-Zeile unten)
```

### Tile Factory (Lieferfähigkeit-Page)

```javascript
const { tileEl, contentEl, headerExtraEl, diagEl } = core.createTile({
  id:    'boxchart',                          // wird zu #tile-boxchart
  title: 'Lead<span class="hl">Time</span>',
});
// tileEl         → das .tile-Element (kein Drag/Resize, Flexbox-Wrap)
// contentEl      → .tile-content (flex:1, hier rein rendern)
// headerExtraEl  → freier Bereich im Tile-Header für Badges/Toggles
// diagEl         → .diag-bar (Diagnose-Zeile unten)
// Größe:         --tile-w (550px Default) × --tile-h (344px, 16:10) · via Settings-Slider (390–720 px)
```

Routing für beide Factories über `CARD_PAGE_MAP` in `core.js`. Lieferfähigkeit-Visuals hängen automatisch am `tile-canvas-lieferfahigkeit`.

### Daten-Utilities

```javascript
core.filteredRows()          // → Row[] nach activem squadFilter
core.toDate(v)               // Excel-Wert / String / Date → Date | null
core.dur(entryVal, exitVal)  // → Tage (inklusiv) | null
core.pct(sortedArr, p)       // → Perzentil p (0–100)
core.fmt(v)                  // → "12.3d" | "–"
core.intTicks(max, n)        // → number[] — ganzzahlige Y-Achsen-Ticks von 0 bis ≥ max
                             //   n: gewünschte Tick-Anzahl (Default 5), Schritt immer ≥ 1
                             //   Pflicht für alle Y-Achsen mit Zahlen (§9.7)
```

### Theme & Farben

```javascript
core.isLight()               // → boolean
core.palette()               // → PALETTE_DARK | PALETTE_LIGHT (8 Farben)
core.lerp(t)                 // → rgb-String, Heatmap-Gradient (t = 0…1)
core.getCellContrast(t)      // → 'dark' | 'light' für Text auf Heatmap-Zelle
core.scatterColors()         // → { plotBg, gridLine, axisLine, axisLabel, dotStroke, … }
core.toggleTheme()           // Theme wechseln + 'theme'-Event emittieren
core.initTheme()             // Gespeichertes Theme beim Start laden
```

### Storage

```javascript
core.save(key, value)        // localStorage.setItem mit JSON.stringify
core.load(key, default)      // localStorage.getItem mit JSON.parse + Fallback
```

### Globale Status-Reihenfolge

```javascript
// Exportierte Konstante (17 Status in Default-Reihenfolge)
DEFAULT_STATUS_ORDER         // string[] — Queue → WIP → Done + Rejected/Resume (versteckt)

// Reihenfolge laden (mit case-insensitiver Dedup für neue Status aus Excel)
core.loadGlobalStatusOrder(knownNames?)  // → string[] — gespeicherte oder Default-Reihenfolge
                                         // knownNames: neue Status werden ans Ende angehängt

// Reihenfolge speichern + Event 'statusOrder' emittieren
core.saveGlobalStatusOrder(order)        // → void
// → Alle Visuals die 'statusOrder' abonniert haben rendern neu
```

**Wichtig:** Visuals dürfen `stateOrder` NICHT mehr in ihrem eigenen `cfg` persistieren.  
Stattdessen: `cfg.stateOrder = core.loadGlobalStatusOrder(foundNames)` im `data`- und `statusOrder`-Handler.  
localStorage-Key: `fhwa_status_order`.

### Grid (intern, kein direkter Aufruf nötig)

Grid wird vollständig von `core.initLayout()` und `core.initDragResize()` verwaltet.  
Layout-Key: `fhwa_layout2` (abweichend von v1.x `fhwa_layout` — Absicht, um alten gespeicherten State zu ignorieren).

---

## Visual-Template (Minimalbeispiel für neues Visual)

```javascript
// boxchart.js
import { core } from './core.js';

export function init() {

  // 1. Lokaler Config-State (nur diese Datei kennt ihn)
  const cfg = core.load('fhwa_boxchart', {
    rollingDays: 90,
    // ...
  });

  // 2. Card anlegen
  const { contentEl, headerExtraEl, diagEl } = core.createCard({
    id:          'boxchart',
    title:       'Lead<span class="hl">Time</span>',
    defaultGrid: { col: 0, row: 12, w: 6, h: 10 },
  });

  // 3. Eigene Header-Controls (optional)
  const btn = document.createElement('button');
  btn.className = 'btn-icon';
  btn.textContent = '⚙ Einstellungen';
  btn.onclick = () => { /* Panel öffnen */ };
  headerExtraEl.appendChild(btn);

  // 4. Render-Funktion
  function render() {
    const rows = core.filteredRows();
    // ... SVG oder DOM aufbauen, in contentEl einhängen
    diagEl.textContent = `n=${rows.length}`;
  }

  // 5. Config speichern
  function saveConfig() { core.save('fhwa_boxchart', cfg); }

  // 6. Events abonnieren
  core.on('data',     render);
  core.on('theme',    render);
  core.on('filter',   render);
  core.on('resize',   render);
  core.on('settings', render);  // nur wenn core.state.urlTemplate genutzt wird
}
```

---

## localStorage-Keys

| Key | Datei | Inhalt |
|---|---|---|
| `fhwa_layout2` | core.js | `{ [visualId]: { col, row, w, h } }` für alle Cards |
| `fhwa_activePage` | core.js | zuletzt aktive Page-ID |
| `fhwa_global` | core.js | squadFilter[], urlTemplate |
| `fhwa_theme` | core.js | `'dark'` \| `'light'` |
| `fhwa_status_order` | core.js | `string[]` — globale Status-Reihenfolge (Default: `DEFAULT_STATUS_ORDER`, 17 Einträge) |
| `fhwa_tileHeight` | index.html | Kachelbreite in px (390–720, Default 550) · Höhe wird als 16:10 abgeleitet |
| `fhwa_heatmap` | heatmap.js | metric, filter, ltStart, ltEnd, hiddenGlobal[] (Default: `['Rejected','Resume']`) — **kein stateOrder mehr** |
| `fhwa_scatter` | scatter.js | colorMode, interval, ctStart, ctEnd, dotSize, singleColor, typeColors, P50/70/85/95 show+color |
| `fhwa_wipage` | wipage.js | rollingDays, statusAgeDays, alertColor, dotSize, showBands, excludeList (Default: `'Rejected, Resume'`) — **kein stateOrder mehr** |
| `fhwa_boxchart` | boxchart.js | *(per SDD-Interview zu definieren)* |
| `fhwa_saydoratio` | saydoratio.js | *(per SDD-Interview zu definieren)* |
| `fhwa_wipkpi` | wipkpi.js | *(per SDD-Interview zu definieren)* |
| `fhwa_flowefficiency` | flowefficiency.js | *(per SDD-Interview zu definieren)* |
| `fhwa_happinessfaktor` | happiness.js | title, dotRadius — Spec: HappinessFaktor.md |
| `fhwa_akzeptanz` | akzeptanz.js | *(per SDD-Interview zu definieren)* |
| `fhwa_montecarlo` | montecarlo.js | mode, targetCount, targetDate, calcRollingDays, calcFromDate, calcToDate, stabilityRollingDays, stabilityFromDate, stabilityToDate, throughputUnit, completedCol, numRuns, cvThresholdGreen, cvThresholdRed, showP50/70/85/95, colorP50/70/85/95 |

**Hinweis:** `fhwa_layout` (ohne `2`) war der Key der alten Single-File-Version (v1.x). Wird ignoriert.

---

## Theme-System

### CSS-Variablen (in index.html)

```css
/* Dark (Standard) */
:root { --bg:#0f1c30; --bg2:#162035; --bg3:#1e2e47; --bg4:#273552;
  --border:#2a3d5c; --text:#e8f0fe; --dim:#8ba8c8; --dimmer:#4d6a88;
  --blue:#38bdf8; --red:#f87171; --green:#4ade80; --yellow:#fbbf24;
  --purple:#c084fc; --orange:#fb923c; }

/* Light */
[data-theme="light"] { --bg:#f1f5f9; --bg2:#ffffff; --bg3:#f8fafc; --bg4:#e2e8f0;
  --border:#cbd5e1; --text:#0f172a; --dim:#475569; --dimmer:#94a3b8;
  --blue:#0284c7; --red:#dc2626; --green:#16a34a; --yellow:#b45309;
  --purple:#7c3aed; --orange:#c2410c; }
```

`data-theme` sitzt auf `<html>`. Theme-Toggle ruft `core.toggleTheme()` auf, das 'theme'-Event emittiert — alle Visuals rendern neu.

### Farbpaletten

| | Dark | Light |
|---|---|---|
| Heatmap-Gradient | Navy `[28,42,63]` → Rot `[192,57,43]` | Hellblau `[219,234,254]` → Orange `[251,146,60]` |
| Scatter-Palette | `#38bdf8, #fb923c, #a78bfa, …` | `#0284c7, #c2410c, #7c3aed, …` |
| Dot-Halo | `rgba(0,0,0,0.45)` | `rgba(255,255,255,0.6)` |

**Regel:** Nie SVG-Farben hardcoden. Immer `core.scatterColors()` oder CSS-Variablen verwenden.

---

## Dashboard-Grid

```
GRID_COLS = 12      (Spalten)
GRID_ROW_H = 70px   (Zeilenhöhe)
```

**Drag:** Handle `⠿` → `core._initDrag(id)` → mousemove verschiebt frei → mouseup: `_snapToGrid()` → Kollisionsprüfung → bei Überlappung Revert → `_saveLayout()`.

**Resize:** Ecke rechts unten → `core._initResize(id)` → gleicher Ablauf.

**Überlappungsschutz:**
```javascript
function _overlap(a, b) {
  return a.col < b.col+b.w && a.col+a.w > b.col &&
         a.row < b.row+b.h && a.row+a.h > b.row;
}
// In _snapToGrid(): wenn blocked → _grid[id] = {...origGrid} (Revert)
```

**Scroll:** `_updateCanvasH()` setzt `#dash-canvas.style.minHeight` live im mousemove.

**Default-Layout:** Wenn kein gespeichertes Layout vorhanden, verteilt `initLayout()` alle Cards gleichmäßig auf die volle Breite und die verfügbare Viewport-Höhe.

---

## Design-Standards (verbindlich für alle Visuals)

Diese Standards werden bei jedem neuen Visual von Anfang an eingehalten – nicht erst wenn Oliver sie anfordert.

### §9.1 Reihenfolge-Steuerung

Wenn der Nutzer die Reihenfolge von Elementen im Visual steuern kann, wird **immer** das FlowHeatmap-Muster verwendet: ein In-Visual-Panel mit ▲/▼-Buttons pro Element und Drag-Handle.

**Nie** stattdessen: einfaches Textfeld, Dropdowns.

```
┌─────────────────────────────┐
│ ↕ Reihenfolge          [×] │   ← Button oben rechts öffnet Panel
├─────────────────────────────┤
│ 1. Analyse          [▲][▼] │
│ 2. Entwicklung      [▲][▼] │
│ 3. Test             [▲][▼] │
└─────────────────────────────┘
```

Die gewählte Reihenfolge wird via `core.save('fhwa_[visualId]', cfg)` in localStorage gespeichert und überlebt den Browser-Reload.

**Synchronisierung mit neuen/entfallenen Status:**
```javascript
// In render(): gespeicherte Reihenfolge mit aktuellen Zuständen abgleichen
const currentStates = /* aktuell vorhandene Zustände aus Daten */;
cfg.stateOrder = [
    ...cfg.stateOrder.filter(s => currentStates.indexOf(s) >= 0),
    ...currentStates.filter(s => cfg.stateOrder.indexOf(s) < 0)
];
```

### §9.2 Diagnoseanzeige

- Position: **immer in der Diag-Bar** (`diagEl.textContent`) – nicht im SVG
- Standardmäßig: **immer sichtbar** (Diag-Bar ist fester Bestandteil jeder Card)
- Inhalt mindestens: Anzahl der dargestellten Items (`n=42`)
- Farbton und Styling: einheitlich über alle Visuals, nicht pro Visual anpassen

### §9.3 Tooltip: boundary-safe + klickbare Links

**Tooltip darf nie am Rand des Visuals abgeschnitten werden.** Pflichtimplementierung:

```javascript
function positionTooltip(tooltip, mouseX, mouseY, container) {
    const ttW = tooltip.offsetWidth  || 200;
    const ttH = tooltip.offsetHeight || 100;
    const cW  = container.clientWidth;
    const cH  = container.clientHeight;

    let left = mouseX + 12;
    if (left + ttW > cW) left = mouseX - ttW - 12;
    if (left < 0) left = 0;

    let top = mouseY + 12;
    if (top + ttH > cH) top = mouseY - ttH - 12;
    if (top < 0) top = 0;

    tooltip.style.left = left + 'px';
    tooltip.style.top  = top  + 'px';
}
```

Tooltip muss `position: absolute` **im Card-Container** haben. Mouse-Koordinaten relativ zum Container:

```javascript
container.addEventListener('mousemove', (e) => {
    const rect = container.getBoundingClientRect();
    positionTooltip(tooltip, e.clientX - rect.left, e.clientY - rect.top, container);
});
```

**Tooltips mit klickbaren Links (Hover-Delay-Muster):**

```javascript
// pointerEvents dynamisch umschalten
tooltip.style.pointerEvents = item.url ? 'all' : 'none';

// 120ms Delay damit Maus vom Punkt auf Tooltip wechseln kann
let _hideTimer = null;
const _showTt = () => { if (_hideTimer) { clearTimeout(_hideTimer); _hideTimer = null; } };
const _hideTt = () => { _hideTimer = setTimeout(() => tooltip.style.display = 'none', 120); };

tooltip.addEventListener('mouseenter', _showTt);
tooltip.addEventListener('mouseleave', _hideTt);

// Datenpunkte: mouseout → _hideTt() statt direktem display:none
dot.addEventListener('mouseover',  () => { _showTt(); /* Tooltip befüllen */ });
dot.addEventListener('mouseout',   () => { _hideTt(); });

// Cursor auf Datenpunkten mit URL
dot.style.cursor = item.url ? 'pointer' : 'default';
```

**Links öffnen:**
```javascript
window.open(url, '_blank');  // kein host.launchUrl — standalone HTML
```

**Vor jeder Auslieferung prüfen:** Tooltip an allen vier Ecken des Visuals testen.

### §9.4 N-Anzeige

Jedes Visual zeigt die Anzahl der dargestellten Elemente (N) an.

**Platzierungsregeln:**
- Bei **Säulen/Kategorien auf der X-Achse** (BoxChart, WIPAge): N direkt **unter** jeder Kategoriebeschriftung als kleine, gedämpfte Zahl (`n=42`)
- Bei **Scatterplots** (CycleTime): N als kompakter Infoblock **oben links** im Diagrammbereich
- Bei **Heatmaps**: N als Zahl in jeder Zelle oder als Tooltip-Information
- Wenn unklar: **fragen, nicht raten** (M1, M3)

### §9.5 Skalierung

Alle graphischen Elemente müssen sich proportional zur Visualgröße verhalten.

```javascript
// FALSCH – feste Punktgröße
const r = 6;

// RICHTIG – skaliert mit Container, konfigurierbar
const baseDotSize = cfg.dotSize ?? 4;
const r = Math.max(3, Math.min(8, pW / 100)) * (baseDotSize / 4);
```

- Schriftgrößen: relativ zum Container, nicht absolut
- Spaltenbreiten/Zellhöhen: `100% / Anzahl` – nie feste Pixel
- Nach jedem `resize`-Event neu berechnen und rendern

### §9.6 Link-Feature (Standard für Visuals mit Jira-Link)

Jedes Visual das `core.state.urlTemplate` nutzt, bekommt das Link-Feature als eingebauten Standard.

**URL-Auflösungs-Logik** (Priorität: direkte URL-Spalte > Template > kein Link):
```javascript
function resolveUrl(key) {
    if (item.rawUrl && item.rawUrl.trim()) return item.rawUrl.trim();
    if (core.state.urlTemplate.trim()) return core.state.urlTemplate.replace(/\{issueKey\}/g, key);
    return '';
}
```

**Tooltip-Regeln:**
- Link-Zeile nur wenn URL nicht leer
- Trennlinie vor dem Link (`border-top: 1px solid #334155; margin: 5px 0 4px`)
- `pointerEvents: 'all'` auf Tooltip wenn Link vorhanden (§9.3)
- Hover-Delay-Muster (§9.3)
- `settings`-Event abonnieren: `core.on('settings', render)` wenn `urlTemplate` genutzt

### §9.7 Y-Achsen: immer ganze Zahlen

**Regel:** Alle numerischen Y-Achsen-Ticks zeigen **ausschließlich ganze Zahlen** — keine Dezimalstellen. Datumswerte auf Achsen sind von dieser Regel **nicht betroffen**.

**Pflichtimplementierung** (gilt für alle Visuals — neu und bestehend):

```javascript
// FALSCH
const ySteps = 5;
for (let i = 0; i <= ySteps; i++) {
  const v = (yMax / ySteps) * i;  // → kann 1.6, 2.4 usw. ergeben
  parts.push(`<text ...>${v}</text>`);
}

// RICHTIG — core.intTicks() verwenden
for (const v of core.intTicks(yMax, 5)) {
  parts.push(`<text ...>${v}</text>`);
}
```

`core.intTicks(max, n)` wählt automatisch einen ganzzahligen Tick-Schritt (≥ 1), sodass bei kleinen Wertebereichen weniger Ticks entstehen statt Dezimalwerte. Duplikate sind ausgeschlossen.

**Warum:** Bei kleinen Wertebereichen (z.B. WIP 0–3) erzeugten gleichmäßig geteilte Ticks Dezimalwerte wie 0.6 oder 1.6, die für ganze Items (Tickets) irreführend sind.

---

## WIPAge Chart – Details

**Aktiv-Logik:** `In Progress_first` gefüllt **UND** `Resolved` leer **UND** `Rejected` leer.  
Ein Item ist erledigt wenn `Resolved` **oder** `Rejected` gefüllt ist (XOR — nur eines kann befüllt sein).

**Status-Age Y-Achse (Dual-Period-Logik):**
```
X_first == X (gleicher Tag)?
├── Ja  → age = heute − X
└── Nein → age = (leaving_X_first − X_first) + (heute − X)
```
Fallback: wenn nur `X_first` vorhanden (kein `X`): `age = heute − X_first`.

**Rolling Pace:**
- Nur `Resolved`-Items (kein `Rejected`) fließen in die Pace-Berechnung ein
- Zeitfenster: letzte `rollingDays` Tage gerechnet vom `Resolved`-Datum
- Dauerkalkulation pro Status ebenfalls mit Dual-Period-Logik:
```
X_first == X?
├── Ja  → dauer = leaving_X − X + 1
└── Nein → dauer = (leaving_X_first − X_first + 1) + (leaving_X − X + 1)
```
- Ergebnis: P25/P50/P85/P90 als gestaffelte Farbzonen + gestrichelte Linien

**Pace-Bänder (Farbzonen pro Status-Spalte):**

| Zone | Bereich | Farbe | Bedeutung |
|---|---|---|---|
| 1 | 0 → P25 | Grün `rgba(100,185,100,0.10)` | Im grünen Bereich |
| 2 | P25 → P50 | Gelbgrün `rgba(180,210,80,0.10)` | Untere Hälfte normal |
| 3 | P50 → P85 | Gelb/Orange `rgba(230,180,40,0.10)` | Obere Hälfte normal |
| 4 | P85 → P90 | Orange-Rot `rgba(220,100,40,0.12)` | Kritisch |
| 5 | P90 → oben | Rot `rgba(210,50,50,0.10)` | Überfällig |

Linienfarben: P25 `#64B964` · P50 `#A8C034` · P85 `#E68C3C` · P90 `#E84040`

**Dot-Farben:**
- Normal: `var(--blue)`
- Alert (≥ `statusAgeDays` Tage): `cfg.alertColor` (Default `var(--red)`, konfigurierbar via Color-Picker im ⚙-Panel)

**Jitter:** Dots pro Status-Spalte werden horizontal gestreut (`± colW * 0.35`, max ±18px).

**Config-Panel (⚙ Einstellungen):**

| Property | Typ | Default | Beschreibung |
|---|---|---|---|
| `rollingDays` | number | `90` | Zeitfenster Perzentil-Berechnung |
| `statusAgeDays` | number | `5` | Alert-Schwellwert in Tagen |
| `dotSize` | number | `4` | Basis-Radius (skaliert mit pW) |
| `showBands` | bool | `true` | Farbzonen + P25/P50/P85/P90-Linien ein/ausblenden |
| `excludeList` | string | `'Rejected'` | Komma-getrennte Status ausblenden |
| `alertColor` | string | `var(--red)` | Farbe überfälliger Dots |

**Reihenfolge-Panel (↕):** Exaktes heatmap.js-Muster – `⠿` Drag-Handle + ▲/▼ Buttons. Gespeichert in `cfg.stateOrder`.

**Dot-Radius-Formel:** `Math.max(3, Math.min(8, pW/100)) * (cfg.dotSize/4)` — konsistent mit scatter.js.

**Tooltip** zeigt: Jira-ID · Status · Alter im Status · P25/P50/P85/P90-Pace-Werte · Basis-n · Link

---

## CycleTime Scatterplot – Details

**CT-Formel:** `(endDate − startDate) / 86400000 + 1` (inklusiv, konsistent mit `core.dur()`)  
Items mit `ct < 1` werden ausgeschlossen.

**SVG-Rendering:** `svgEl.innerHTML = parts.join('')` — erlaubt in Browser-Kontext.

**Achsen:**
- X: Fertigstellungsdatum (`cfg.ctEnd`), Ticks nach Woche/Monat/Quartal
- Y: CT in Tagen, `_niceYTicks()` für schöne Rundwerte

**Dot-Rendering:**
- Radius: `Math.max(3.5, Math.min(6, pW/80))`
- Opacity: 0.95
- Stroke-Halo: `stroke="${C.dotStroke}" stroke-width="1.5"`

**Farb-Modi:** `single` → cfg.singleColor · `issueType` → cfg.typeColors[type] · `heatmap` → `core.lerp(ct/maxCT)`

**Tooltip:** Hover-Delay-Muster (§9.3), `window.open(url, '_blank')` für Links.

---

## Patch-Strategie: Wann neu schreiben statt patchen

**Faustregel:** Wenn mehr als **2 Patches** auf dieselbe Datei gehen → Datei komplett neu schreiben.

Symptome, die zum Neuschreiben zwingen:
- Jeder Fix erzeugt einen neuen Bug an anderer Stelle
- Der Chat wird sehr lang und das Kontextfenster ist voll
- Die ursprüngliche Logik ist nach mehreren Patches nicht mehr nachvollziehbar

**Bei Neuschreiben:** Zuerst die Anforderungen explizit auflisten, dann einen vollständigen Entwurf schreiben – nicht schrittweise ergänzen.

---

## Bekannte Bugs und Lösungen

**Bug 1: Scrollbalken fehlte nach Card-Drag**
- Symptom: Card über sichtbaren Bereich ziehen → kein Scrollbalken
- Ursache: Cards in `position:absolute` ohne berechnete Container-Höhe
- Fix: Innerer `#dash-canvas`; `_updateCanvasH()` setzt `minHeight` live im mousemove

**Bug 2: Cards überlappten sich (v1.1 → v1.2)**
- Symptom: Nach Drag/Resize konnte eine Card die andere überdecken
- Ursache: Kein Kollisionscheck
- Fix: `_overlap(a, b)` + `origGrid`-Revert in `_snapToGrid()`

**Bug 3: Issue-Type Legende fehlte im Scatterplot**
- Symptom: Farb-Modus „Typ" ohne Legende
- Fix: SVG-Legende oben rechts im Plotbereich

**Bug 4: WIPAge zeigte Rejected-Items als aktiv**
- Symptom: Abgelehnte Items erschienen im WIPAge-Chart als aktive WIP-Items
- Ursache: Aktiv-Filter prüfte nur `Resolved`, nicht `Rejected`
- Fix: `rejected == null` als dritte Bedingung im Aktiv-Filter ergänzt

**Bug 5: WIPAge ignorierte Mehrfach-Status-Durchläufe**
- Symptom: Alter und Rolling Pace zu niedrig bei Items die einen Status zweimal durchlaufen haben
- Ursache: `_first`-Spalten wurden nicht ausgewertet
- Fix: Dual-Period-Logik — wenn `X_first != X`: beide Zeiträume addieren

**Bug 6: Rolling Pace bezog Rejected-Items ein**
- Symptom: Pace-Werte durch abgelehnte Items verfälscht
- Ursache: `completedRows`-Filter prüfte nur `Resolved`-Datum
- Fix: Rolling Pace filtert ausschließlich auf `Resolved`-Items

**Bug 7: WIPAge-Bänder falsche Perzentile und fehlende Farbzonen**
- Symptom: Bänder zeigten P50/P70/P85 als reine Linien ohne Fläche
- Ursache: Falsche Perzentil-Auswahl; keine Flächen-Darstellung
- Fix: Umstellung auf P25/P50/P85/P90; SVG-Rechtecke als Farbzonen hinter den Linien

**Bug 8: WIP pro Person – Header-Zeile in SquadDaten nicht gefunden**
- Symptom: „Header-Zeile ('Squad') nicht in SquadDaten gefunden" obwohl Sheet vorhanden und Squad-Name korrekt
- Ursache: `row[1] === 'Squad'` hardcodierte Spalte B; 'Squad' steht im realen Sheet in einer anderen Spalte
- Fix: `row.some(c => c === 'Squad')` für Header-Suche; Spaltenposition per `hRow.indexOf('Squad')` dynamisch ermitteln; alle weiteren Zugriffe über `squadCol`-Variable statt fester Index

**Bug 9: WIP pro Person – keine Daten wenn Squad nicht in SquadDaten**
- Symptom: „Keine Zeitraumdaten verfügbar" obwohl JiraStories Daten enthält
- Ursache: Monate wurden nur aus der gefundenen Squad-Zeile befüllt; fehlende Zeile = leere Monatsliste = Abbruch
- Fix: Monate immer aus Header-Spalten ableiten; Squad nicht gefunden → teamsize=1 für alle Header-Monate (Diag-Hinweis in Diag-Bar)

**Bug 10: Fehlender `import { core }` in `flowefficiency.js`**
- Symptom: App stürzt beim Laden mit `ReferenceError: core is not defined`
- Ursache: Copy-Paste aus Prototyp-Phase ohne ES-Module-Import — einzige Visual-Datei ohne `import { core }`
- Fix: `import { core } from './core.js';` als erste Zeile ergänzt

**Bug 11: `Math.max(...[])` → `-Infinity` in `boxchart.js` und `scatter.js`**
- Symptom: KDE-Kurve unsichtbar oder `NaN` in Achsenwerten bei leerem Datensatz
- Ursache: `Math.max(...kde.map(...))` mit leerem Array gibt `-Infinity` zurück — keine Guard-Bedingung
- Fix: `reduce()`-Pattern statt Spread: `kde.reduce((m, p) => Math.max(m, p.y), 0)` und Loop-Pattern für min/max

**Bug 12: XSS via innerHTML in `wip.js` und `happiness.js`**
- Symptom: Manipulierter localStorage-Wert (z.B. `<img src=x onerror=...>`) wird als HTML interpretiert
- Ursache: Konfigurationswerte direkt in Template-Strings für `innerHTML` eingebaut; nur `"` escaped (happiness), keine Validierung (wip)
- Fix: `_safeColor()` in `wip.js` (Regex `#[0-9a-fA-F]{6}$` oder Fallback), `_esc()` in `happiness.js` (vollständige HTML-Escaping-Funktion)

**Bug 13: Rejected-Items in WIP-Berechnung von `wip.js` gezählt**
- Symptom: Abgelehnte Items erscheinen in der WIP-Zählung und beeinflussen den WIP-Grenzwert
- Ursache: Filterlogik prüfte `(rej === 0 || rej >= M)` statt nur `rej === 0` — Items mit Rejected-Datum wurden eingeschlossen
- Fix: Bedingung auf `rej === 0` geändert (an beiden Stellen im WIP-Block)

**Bug 14: Tote Einträge in `CARD_PAGE_MAP` und falscher `happinessindex`-Schlüssel**
- Symptom: `wip`, `flowefficiency`, `happinessfaktor`-Tiles wurden keiner Page zugewiesen → unsichtbar
- Ursache: Map enthielt veraltete Namen aus Planungsphase (`saydoratio`, `wipkpi`, `akzeptanz`) und die Datei `happiness.js` wurde mit `happinessindex` statt `happinessfaktor` referenziert
- Fix: Map auf tatsächlich existierende Visuals bereinigt; `happinessfaktor` als korrekter Key eingetragen

**Bug 15: Hardcodierte Standardfarbe `#38bdf8` in `scatter.js`**
- Symptom: Im Light-Mode ist die Default-Dotfarbe eine dunkle Blautönung, die auf hellem Hintergrund kaum sichtbar ist
- Ursache: Nur im Dark-Mode entwickelt; Default-Farbe aus Dark-Palette hardcodiert statt aus `core.palette()`
- Fix: Default-Wert auf `''` geändert; Fallback `cfg.singleColor || core.palette()[0]` in `_dotColor()` und Color-Picker-Init

---

## Workflow-Checklisten

### Phase 1: Vor der Umsetzung (neues Visual)
- [ ] **SDD-Interview (§0.0) vollständig durchgeführt?** (Blöcke A–G)
- [ ] **`docs/specs/VisualName.md` erstellt und von Oliver bestätigt?** (§13)
- [ ] **Gate 1 (SDD-Bestätigung) durchgeführt?** (§0.1)
- [ ] HTML-Prototyp freigegeben? (M6, §0.8)
- [ ] Link-Feature in SDD Block F entschieden?

### Phase 2: Beim Entwickeln
- [ ] Visual erzeugt eigene Card via `core.createCard()`? (Deep-Dive-Pages) **oder** Tile via `core.createTile()`? (Lieferfähigkeit-Page)
- [ ] Config-State lokal im Visual (nie in `core.state` schreiben)?
- [ ] localStorage-Key nach Schema `fhwa_[visualId]`?
- [ ] Events korrekt abonniert (data, theme, filter, resize, ggf. settings)?
- [ ] **Tooltip boundary-safe** (positionTooltip mit Overflow-Prüfung, §9.3)?
- [ ] Tooltips mit Links: Hover-Delay (120ms) + `pointerEvents` dynamisch? (§9.3)
- [ ] N-Anzeige eingebaut? (§9.4)
- [ ] Reihenfolge-Steuerung als ▲/▼-Panel? (falls benötigt, §9.1)
- [ ] Alle Elemente skalieren mit Container-Größe? (§9.5)
- [ ] Keine hardcodierten SVG-Farben? (§9 Farb-Regel)
- [ ] Y-Achsen-Ticks: `core.intTicks()` verwendet → nur ganze Zahlen? (§9.7)
- [ ] Dual-Period-Logik beachtet? (`_first`-Spalten)
- [ ] Aktiv/Erledigt-Logik korrekt? (XOR: Resolved oder Rejected)
- [ ] Neues Visual: `index.html` + `build.py` an allen Stellen aktualisiert?
- [ ] Chat bei Nachricht 15: Übergabe-Dokument angeboten? (M4, §0.6)

### Phase 3: Vor der Übergabe – Gate 2 durchführen
- [ ] **Gate 2 (Pre-Delivery Review) vollständig abgehakt** (§0.2)
- [ ] Nur geänderte `.js`-Datei(en) übergeben (`core.js` + `index.html` nur wenn explizit geändert)
- [ ] Neue Bugs während Entwicklung → „Bekannte Bugs und Lösungen" ergänzt? (M5, §0.7)

### Phase 4: Fehlerbehebung (ersetzt Phase 1–3 bei reinen Bugfixes)

**Vorbereitung**
- [ ] Bug klar beschrieben (Symptom, wann tritt er auf, was wurde erwartet)?
- [ ] Betroffene `.js`-Datei(en) + ggf. `core.js` hochgeladen?

**Analyse**
- [ ] Ist der Bug eine **Spec-Lücke**? (Edge Case fehlte in SDD Block D oder G)
  - Ja → **SDD.md zuerst updaten**, dann fixen (§0.7 M5)
  - Nein → direkt fixen

**Fix & Übergabe**
- [ ] Korrektur implementiert?
- [ ] Geänderte `.js`-Datei(en) übergeben; bei Bundle-Bedarf `build.py` → `FlowAnalytics.html`
- [ ] M5: Bug dokumentiert in „Bekannte Bugs und Lösungen" (§0.7)?

---

## SDD-Vorlage (§13)

Diese Vorlage wird vom SDD-Interview (§0.0) ausgefüllt. Alle Abschnitte sind Pflicht.

**Dateiname:** `docs/specs/VisualName.md`  
**Erstellt:** vor Gate 1 · **Aktualisiert:** nach jeder bestätigten Änderung

```markdown
# [VisualName] – Spezifikation

**Version:** 1.0  
**Datum:** YYYY-MM-DD  
**Status:** [ ] Entwurf → [ ] Bestätigt (Gate 1) → [ ] Implementiert

---

## A – Zweck & Abgrenzung

### Was das Visual macht
[2–3 Sätze: welches Problem löst es, für wen, was ist der Kern-Output]

### Was es NICHT macht
- [Explizite Ausschlüsse, z.B. "kein Cross-Filter zwischen Visuals"]

### Technologie
[x] Web-App (.js + core.js, standalone HTML in SharePoint)

---

## B – Datenmodell

### Excel-Spalten
| Spaltenname | Typ | Pflicht? | Erkennungslogik | Fallback wenn fehlt |
|---|---|---|---|---|
| Jira-ID | Text | ✅ | Name exakt | Visual zeigt Fehlermeldung |
| [weitere] | | | | |

### Erkennungslogik Workflow-Zustände
[Wie unterscheidet das Visual relevante Spalten von Meta-Spalten?]
[z.B. "Spalte ist Zustand wenn nicht in META_COLS, kein leaving_-Präfix, kein _first-Suffix"]

### Dual-Period-Logik
[ ] Visual nutzt _first-Spalten → Dual-Period-Logik implementieren
[ ] Visual nutzt keine _first-Spalten

---

## C – UX & Layout

### Hauptbereiche (ASCII-Sketch)
\```
┌─────────────────────────────────────────┐
│  [Card-Header: Titel + Controls]        │
├─────────────────────────────────────────┤
│  [Hauptbereich: Chart / Heatmap / etc.] │
├─────────────────────────────────────────┤
│  [Diag-Bar]                             │
└─────────────────────────────────────────┘
\```

### Interaktionen
| Aktion | Trigger | Effekt |
|---|---|---|
| Tooltip anzeigen | mouseover auf Datenpunkt | Tooltip mit [Felder] erscheint, boundary-safe |
| Tooltip ausblenden | mouseout (+ 120ms Delay wenn Link) | Tooltip display:none |
| [weitere] | | |

### Leerzustand
[Was sieht der Nutzer bei: keine Daten / alle Items herausgefiltert / Pflicht-Spalte fehlt]

### Responsive-Verhalten
[Wie verändern sich Punkte/Balken/Zellen/Schrift wenn die Card kleiner wird]

---

## D – Berechnungslogik

### Kern-Metriken
| Metrik | Formel | Einheit | Besonderheiten |
|---|---|---|---|
| [Name] | `(endDate - startDate) / 86400000 + 1` | Tage | Inklusiv, Items < 1 ausgeschlossen |
| [weitere] | | | |

### Filter- & Aggregationslogik
[Welche Items werden ausgeschlossen? Welche Bedingungen müssen erfüllt sein?]

### Edge Cases
| Situation | Verhalten |
|---|---|
| Item ohne Pflicht-Datum | Wird übersprungen, N sinkt, Diag-Hinweis |
| Leere Gruppe / Status | [ausblenden / als leer anzeigen] |
| Math.max() auf leerem Array | Abgesichert: `values.length ? Math.max(...values) : 0` |
| [weitere] | |

---

## E – Config (localStorage)

localStorage-Key: `fhwa_[visualId]`

### Alle Properties
| Property | Typ | Default | Min | Max | Effekt | Validierung |
|---|---|---|---|---|---|---|
| [property] | [Typ] | [Default] | | | | |

---

## F – Design-Standards (Pflichtcheck)

| Standard | Entscheidung | Details |
|---|---|---|
| Tooltip boundary-safe | ✅ Pflicht | positionTooltip() mit Overflow-Prüfung (§9.3) |
| Tooltip mit Links | [ja / nein] | Hover-Delay 120ms + pointerEvents (§9.3) |
| N-Anzeige | ✅ Pflicht | Position: [unter Kategorie / oben links / in Zelle] (§9.4) |
| Reihenfolge-Panel | [ja / nicht benötigt] | ▲/▼ + Drag, localStorage (§9.1) |
| Skalierung | ✅ Pflicht | [Formel für Dot-Radius / Zellgröße] (§9.5) |
| Diagnosemodus | ✅ Pflicht, immer sichtbar | Diag-Bar, Inhalt: [n=X, ...] (§9.2) |
| Link-Feature | [ja: urlTemplate + window.open / nicht benötigt] | core.state.urlTemplate (§9.6) |
| Theme | ✅ Pflicht | core.scatterColors() / CSS-Variablen, nie hardcoden |

---

## G – Akzeptanzkriterien

### Automatisch von Claude prüfbar
- [ ] Keine hardcodierten Farben im Code
- [ ] localStorage-Key nach Schema fhwa_[visualId]
- [ ] Events korrekt abonniert

### Manuell durch Oliver zu testen
- [ ] Tooltip bleibt vollständig sichtbar an allen 4 Ecken der Card
- [ ] Config-State überlebt Browser-Reload
- [ ] Bei 0 Datenzeilen: Diagnosemeldung sichtbar, kein JS-Error in Console
- [ ] Card auf 200px Breite → Elemente skalieren proportional
- [ ] [weiterer projektspezifischer Test]

---

## Änderungshistorie

| Datum | Version | Änderung | Bestätigt von |
|---|---|---|---|
| YYYY-MM-DD | 1.0 | Initiale Spec nach SDD-Interview | Oliver |
```

---

## Architecture Decision Log (ADL)

Begründungen für Architektur-Entscheidungen die nicht offensichtlich sind. Wird von Claude automatisch ergänzt wenn eine solche Entscheidung getroffen wird (§0.14 M12).

| Datum | Entscheidung | Begründung | Alternativen verworfen |
|---|---|---|---|
| 2026-06-07 | `var` statt `const/let` im Bootstrap-Block in `build.py` | Das gebündelte `<script>` ist kein Modul — `var` verhindert Fehler bei erneutem Scriptausführen (z.B. Hot-Reload in SharePoint) | `const/let`: führt zu `SyntaxError: Identifier already been declared` bei Re-Execution |
| 2026-06-07 | `wrap_iife()` für alle Visuals in `build.py` | `const`/`let` auf oberster Datei-Ebene in mehreren Visuals kollidieren im Bundle ohne IIFE-Scope | Kein IIFE: bricht mit `SyntaxError`; ES-Module: nicht überall über `file://` nutzbar |
| 2026-06-07 | `clientWidth`-Fallback auf `window.innerWidth` in `_getColW()` | Pages die `display:none` sind liefern `clientWidth = 0` → Cards bekämen negative Breite | Kein Fallback: Cards auf versteckten Pages werden unsichtbar initialisiert |
| 2026-06-07 | Layout-Key `fhwa_layout2` (nicht `fhwa_layout`) | Verhindert dass altes gespeichertes Layout aus v1.x die neue Architektur bricht | Gleicher Key: alter State würde Grid-Positionen falsch setzen |
| 2026-06-07 | `core.state.sheetsRaw` als separater State neben `core.state.sheets` | Sheets mit Custom-Header-Zeile (nicht Zeile 1) können nicht als Row-Array normalisiert werden | Alles in `sheets`: würde Custom-Header als Datenzeile interpretieren |
| 2026-06-09 | Globale Status-Reihenfolge `fhwa_status_order` (nicht pro-Visual) | Beide Visuals (WIPAge + Heatmap) müssen identische Reihenfolge zeigen. Drag in einem soll sofort im anderen reflektiert werden. Pro-Visual `stateOrder` in cfg führte zu Divergenz | Pro-Visual: führt zu inkonsistenter Darstellung; Keine Persistenz: Verlust bei Reload |
| 2026-06-09 | Settings-Panel als zentriertes Overlay (`position:fixed; transform:translate(-50%,-50%)`) statt sidebar-verankert | Größeres Panel (540px) für Status-Reihenfolge-Liste benötigt mehr Platz als die 300px-Sidebar-Version; Overlay-Pattern ist standard für Modal-ähnliche Einstellungen | Sidebar-verankert: zu schmal für 17+ Drag-Items; Separate Page: zu aufwändig |
| 2026-06-09 | N=0-Hiding per Visual (nicht global) | WIPAge und Heatmap haben unterschiedliche N-Definitionen: WIPAge = aktive WIP-Items, Heatmap = berechnete Stats. Globales Ausblenden würde Kontext verlieren | Global: ein Status könnte in Heatmap n>0 haben, in WIPAge n=0 — beide würden ihn ausblenden |
| 2026-06-09 | Case-insensitive Dedup in `loadGlobalStatusOrder` | Excel-Daten können `'In Test'` liefern während DEFAULT `'in Test'` definiert. Ohne Dedup würde `'In Test'` als Extra-Status angehängt | Exakter Match: Extra-Status-Duplikate (z.B. `'in Test'` + `'In Test'`); Normalisierung: verliert Original-Schreibweise |
| 2026-06-09 | FE-Wartezeit aus zwei Quellen: JiraStories-Statusspalten (Basis) + JiraBlockermanagement (Zusatz, statusunabhängige Episoden) | JiraStories erfasst Warte-Status-Zeiträume strukturiert; JiraBlockermanagement erfasst zusätzlich flag-basierte Blockierungen die innerhalb aktiver Status auftreten (z.B. „Blocked"-Flag während „In Progress") | Nur JiraStories: statusunabhängige Blockierungen gehen verloren; Nur JiraBlockermanagement: Warte-Status ohne Flagging würden nicht gezählt |
| 2026-06-09 | Dedup-Strategie per Status-Typ (nicht per Datumsintervall) | `Blockiert/Wartend_Zustand` in JiraBlockermanagement ∈ WAIT_STATUS → Episode überspringen (bereits in JiraStories gezählt). Robuster als Intervall-Overlap weil BlockedStart/BlockedEnd oft leer sind | Datumsintervall-Overlap: fragil wenn BlockedStart/End fehlen; Keine Dedup: führt zu doppelter Zählung |
| 2026-06-09 | Monatliche FE-Aggregation per Median (nicht Durchschnitt) | Robust gegen Ausreißer (einzelne Items mit sehr hoher/niedriger FE verzerren Mittelwert stark) — konsistent mit BoxChart-Logik | Arithmetisches Mittel: anfällig für Ausreißer; Flächen-Ratio: schwerer zu erklären |
| 2026-06-09 | Sheet-Name `JiraBlockermanagement` statt `BlockedReasons` | Entspricht dem tatsächlichen Excel-Sheet-Namen im Produktivsystem | `BlockedReasons` war Platzhalter-Name in früherer Planung (WebAppEntwickeln.md v4.0) |

---

## Glossar

Projektspezifische Begriffe die zu Missverständnissen geführt haben oder führen könnten (§0.17 M15).

| Begriff | Definition | Nicht verwechseln mit |
|---|---|---|
| **Iteration** | Ein Sprint oder Quartal als Zeitraum für Planung und Messung | „Periode" (veraltet, nicht mehr verwenden) |
| **WIP** | Work in Progress — Anzahl aktiver Items in Bearbeitung | WIPAge (das Visual) |
| **WIPAge** | Das Visual das das Alter aktiver Items zeigt (wipage.js) | WIP als Metrik |
| **Squad** | Ein Team-Name aus den Jira-Daten — entspricht dem `Squad`-Feld in JiraStories | Kein Synonym für „Team" im allgemeinen Sinn |
| **Status_first / leaving_Status_first** | Eintritts-/Austrittsdatum beim **ersten** Durchlauf durch einen Status | `Status` / `leaving_Status` = letzter/aktueller Durchlauf |
| **Dual-Period-Logik** | Berechnungsregel für Items die einen Status zweimal durchlaufen (beide Zeiträume werden addiert) | Einfache CT-Berechnung (end − start) |
| **Smoke-Test** | Kurze manuelle Prüfung (M9) ob das Visual grundsätzlich funktioniert — kein vollständiger Test | Akzeptanztest (Block G der Spec) |
| **Glättung** | KDE-Bandwidth für Violin-Charts: steuert wie glatt die Kurve ist | „Bandwidth" (alter Begriff, nicht mehr verwenden) |
| **Tile** | Kompakte KPI-Karte auf der Lieferfähigkeit-Page (`core.createTile()`) | Card (Deep-Dive-Pages, `core.createCard()`) |
| **Card** | Visualisierungs-Container auf Deep-Dive-Pages mit Drag/Resize | Tile (Lieferfähigkeit-Page, kein Drag) |
| **DEFAULT_STATUS_ORDER** | Die 17 Standard-Status in definierter Reihenfolge (Queue → WIP → Done + Rejected/Resume) — exportierte Konstante in `core.js` | `fhwa_status_order` (gespeicherte/benutzerdefinierte Reihenfolge in localStorage) |
| **Extra-Status** | Workflow-Status der in den Excel-Daten vorkommt, aber NICHT in `DEFAULT_STATUS_ORDER` definiert ist — wird ans Ende angehängt + orange markiert | Standard-Status (in DEFAULT_STATUS_ORDER enthalten) |
| **N=0-Hiding** | Automatisches Ausblenden einer Status-Spalte in einem Visual wenn dort keine darstellbaren Items vorhanden sind — individuell pro Visual | Global-Ausblenden (per Status-Panel in Heatmap oder excludeList in WIPAge) |
| **Flow Efficiency (FE%)** | Anteil der aktiven Arbeitszeit an der gesamten Lead Time: `(LT − Wartezeit) / LT × 100%`. Nur für Resolved Items berechnet, Median pro Monat. Wartezeit-Quellen: JiraStories-Warte-Status + JiraBlockermanagement-Zusatz-Episoden | Lead Time (misst Gesamtdauer, nicht Effizienz) |
| **JiraBlockermanagement** | Excel-Sheet mit statusunabhängigen Blockier-/Warte-Episoden pro Issue. Join über `issues.key` + `Squad`. Schlüsselspalten: `BlockiertWartendSeit` (Tage), `Blockiert/Wartend_Zustand`, `Blockiert/Wartend_Grund` | JiraStories (Haupt-Datensatz mit Status-Zeitstempeln) |
| **WAIT_STATUS** | Die 6 Warte-WIP-Status in `flowefficiency.js`: Blocked, Ready4Test, Ready4QS, Ready4Review, Ready4E2E-Test, Ready4Production — deren Zeitdauer von der Lead Time abgezogen wird | Aktive WIP-Status (In Progress, in Test, In QS) |

---

## Nächste mögliche Features (Backlog)

| Feature | Datei | Aufwand | Hinweis |
|---|---|---|---|
| ~~**LeadTime BoxChart**~~ | ~~`boxchart.js`~~ | ~~mittel~~ | ✅ Implementiert v2.5 |
| ~~**Happiness Index**~~ | ~~`happiness.js`~~ | ~~mittel~~ | ✅ Implementiert v1.0 (Sheet: `Happiness Faktor`) |
| ~~**Flow Efficiency**~~ | ~~`flowefficiency.js`~~ | ~~mittel~~ | ✅ Implementiert v1.0 (Sheets: `JiraStories` + `JiraBlockermanagement`) |
| **CFD (Cumulative Flow)** | `cfd.js` | groß | Stapelflächen über Zeit |
| **Card-Titel editierbar** | index.html | klein | `contenteditable` auf `.card-title` |
| **Card minimieren** | core.js | klein | `.card-content` auf `height:0` klappen |

---

## Hinweise für neuen Chat-Start

**Datei hochladen:** Immer nur diese eine Datei: `docs/WebAppEntwickeln.md`

| Vorhaben | Zusätzlich hochladen |
|---|---|
| **Phase 1a: Multi-Sheet + Navigation** | `docs/WebAppEntwickeln.md` + `src/core.js` + `src/index.html` |
| Neues Visual schreiben | `docs/WebAppEntwickeln.md` + `src/core.js` |
| Bestehendes Visual ändern | `docs/WebAppEntwickeln.md` + `src/core.js` + betroffene `.js`-Datei |
| WIPAge ändern | `docs/WebAppEntwickeln.md` + `src/core.js` + `src/wipage.js` |
| Happiness ändern | `docs/WebAppEntwickeln.md` + `src/core.js` + `src/happiness.js` |
| BoxChart ändern | `docs/WebAppEntwickeln.md` + `src/core.js` + `src/boxchart.js` |
| Flow Efficiency ändern | `docs/WebAppEntwickeln.md` + `src/core.js` + `src/flowefficiency.js` |
| index.html anpassen | `docs/WebAppEntwickeln.md` + `src/index.html` |
| Spec nachschlagen / ändern | `docs/WebAppEntwickeln.md` + `docs/specs/VisualName.md` |

**Einstiegssatz für Phase 1 (nächster Chat):**
> „Wir entwickeln das Flow Analytics Dashboard weiter. Lies bitte WebAppEntwickeln.md, core.js und index.html. Wir starten jetzt Phase 1a: Multi-Sheet-Loading und Navigation/Sidebar."

**Einstiegssatz für neues Visual:**
> „Wir entwickeln das Flow Analytics Dashboard weiter. Lies bitte WebAppEntwickeln.md und core.js. Ich möchte [Visual] ergänzen."

**Chat-Abschluss-Protokoll (§0.15 M13) — Claude gibt das am Ende jedes Chats aus:**

```
## Chat-Abschluss

**Was wurde getan:**
- [Visual / Feature / Bugfix] implementiert (v[X.Y])
- [Datei] aktualisiert

**Offen / Nächster Schritt:**
- [Backlog-Eintrag oder Folgeaufgabe]

**Für den nächsten Chat hochladen:**
- WebAppEntwickeln.md (aktualisierte Version aus diesem Chat)
- [weitere Dateien je nach Aufgabe — siehe Tabelle oben]

**Einstiegssatz:**
> „[konkreter Startpunkt für den nächsten Chat]"
```

**Wichtig:**
- Neue Visuals immer in eigener `.js`-Datei — nie bestehende Dateien erweitern
- Config-State immer lokal im Visual halten — nie in `core.state` schreiben
- Theme-Farben immer über `core.scatterColors()` oder CSS-Variablen — nie hardcoden
- localStorage-Key nach Schema `fhwa_[visualId]` benennen
- Zeitberechnungen immer mit Dual-Period-Logik (`_first`-Spalten beachten) — gilt für alle Visuals
- Aktiv/Erledigt-Logik: erledigt = `Resolved` XOR `Rejected` gefüllt
- Extra-Sheet-Daten (Standard-Header in Zeile 1): `core.state.sheets['SheetName'] ?? []`
- Extra-Sheet-Daten (Custom-Header, nicht Zeile 1): `(core.state.sheetsRaw || {})['SheetName'] ?? []` → 2D-Array; Header-Zeile per `row.some(c => c === 'Schlüsselwert')` finden
- **Status-Reihenfolge NIEMALS in cfg persistieren** — immer `core.loadGlobalStatusOrder(knownNames)` lesen und `core.saveGlobalStatusOrder(order)` schreiben
- **`statusOrder`-Event abonnieren** wenn das Visual eine Reihenfolge-Ansicht zeigt: `core.on('statusOrder', () => { cfg.stateOrder = core.loadGlobalStatusOrder(...); _updateOrderPanel(); render(); })`
- **Extra-Status** (nicht in DEFAULT_STATUS_ORDER) immer mit CSS-Klasse `.o-extra` markieren (Order-Panel); SVG-Labels in `var(--orange)` färben

---

*Erstellt: 2026-06-03 · Autor: Oliver Wolter*  
*v3.1: Projektstruktur auf project-root/docs/specs/ umgestellt.*  
*v4.0 (2026-06-06): Navigation/Sidebar-Struktur, Multi-Sheet-Loading (generisches `core.state.sheets`-Pattern), 5 neue Visuals (Say_Do_Ratio, WIP KPI, Flow Efficiency, Happiness Index, Akzeptanzkriterien), Phasenplan, Chat-Start-Tabelle aktualisiert.*  
*v4.1 (2026-06-07): Phase 1b — Sidebar Glyph/Tech-Untertitel/Section-Labels, Tile-Canvas Lieferfähigkeit (`createTile()`, Flexbox flex-wrap), `--tile-w/h` Slider, Heatmap-Label korrigiert.*
*v4.2 (2026-06-07): M7 (Datei-Check nach jeder Entwicklung) und M8 (Spec als lebendiges Dokument, Spec-First) ergänzt. Pre-Delivery Review um Spec-Pflicht-Check erweitert.*
*v4.3 (2026-06-07): Happiness Faktor Visual (`happiness.js`) implementiert. `core.state.sheetsRaw` ergänzt (2D-Array-Format für Custom-Header-Sheets). `build.py` um `wrap_iife()`-Pattern erweitert (verhindert `const`/`let`-Kollisionen im Bundle, jetzt 5 Stellen statt 4). Dokumentation entsprechend aktualisiert.*
*v4.4 (2026-06-08): Layout-Bugfix: `core.js` öffnete `#app-screen` mit `display:flex` (→ `display:block`). `--tile-w` + `--tile-h` (16:10-Ratio) ersetzen altes `--tile-h`-only-System. Tile-Container auf Flexbox (`flex-wrap:wrap`, `justify-content:center`) umgestellt — max. 3 Spalten (`max-width:calc(3 * var(--tile-w) + 3rem)`), zentriert via `margin:0 auto`. Default 550 × 344 px, Slider-Range 390–720 px (±30 %).*
*v4.5 (2026-06-09): Maßnahmen M9–M18 ergänzt (aus Zusammenarbeits-Analyse): M9 Smoke-Test, M10 Screenshot bei Design-Änderungen, M11 build.py Selbst-Check, M12 Architecture Decision Log, M13 Chat-Abschluss-Protokoll, M14 Chat-Scope begrenzen, M15 Glossar, M16 Scope-Check explorative Themen, M17 Standard-Testdatensatz, M18 Backlog-Priorisierung. Gate 1 um Layout-Freeze ergänzt. ADL mit 5 initialen Einträgen. Glossar mit 10 Begriffen. Pre-Delivery Review um Smoke-Test-Checkliste erweitert. M8 um Ausnahmen-Hinweis verschärft.*
*v4.6 (2026-06-09): Unified Status Order implementiert. `DEFAULT_STATUS_ORDER` (17 Status: Queue→WIP→Done + Rejected/Resume) als Export in `core.js`. `loadGlobalStatusOrder()` + `saveGlobalStatusOrder()` + Event `statusOrder` in core.js API. `stateOrder` aus `fhwa_wipage` und `fhwa_heatmap` entfernt (→ `fhwa_status_order`). N=0-Hiding pro Visual: WIPAge blendet Spalten ohne aktive Items aus, Heatmap blendet Spalten ohne Stats aus. Extra-Status (nicht in DEFAULT) werden ans Ende angehängt + orange markiert (.o-extra, var(--orange)). Settings-Panel als zentriertes Overlay (540px, Backdrop). Status-Reihenfolge-Abschnitt im Settings-Panel mit Drag&Drop + ▲▼ + Reset. ADL um 4 Einträge ergänzt. Glossar um 3 Begriffe ergänzt. build.py Bootstrap aktualisiert.*
*v4.7 (2026-06-09): Flow Efficiency Visual (`flowefficiency.js`) implementiert v1.0. Sheet-Name `BlockedReasons` → `JiraBlockermanagement` (Worksheets-Übersicht + ADL). FE-Berechnung: Dual-Period-Wartezeit aus JiraStories-Warte-Status + statusunabhängige Zusatz-Episoden aus JiraBlockermanagement (Dedup per Status-Typ). Monatliche Aggregation: Median. Line/Violin-Toggle im Tile-Header. Konfigurierbare Ziellinie (FE%, ein/ausblendbar). `index.html` + `build.py` aktualisiert (6. Stelle). M11-Expected-Liste um `init_wip` + `init_flowefficiency` ergänzt. Chat-Start-Tabelle um `flowefficiency.js`-Zeile ergänzt. ADL um 5 Einträge ergänzt. Glossar um 3 Begriffe ergänzt.*
*v4.8 (2026-06-11): Design-Standard §9.7 „Y-Achsen immer ganze Zahlen" eingeführt. `core.intTicks(max, n)` als neue Pflicht-Utility ergänzt (Schritt ≥ 1, dedupliciert). `wip.js`: Y-Tick-Loop auf `core.intTicks()` umgestellt (vorher gleichmäßige 5 Schritte → Dezimalwerte möglich). `boxchart.js`: `_niceYTicks()` erzwingt nun `step = Math.max(1, Math.round(step))`; Label-Format von `y.toFixed(1)` auf `Math.round(y)` geändert. Phase-2-Checkliste um §9.7-Check ergänzt.*
*v4.9 (2026-06-15): 6 Bugfixes (Bug 10–15): fehlender core-Import flowefficiency.js, Math.max-Spread-Pattern (boxchart/scatter), XSS-Escaping (wip/happiness), Rejected-Ausschluss in WIP, CARD_PAGE_MAP bereinigt (happinessindex→happinessfaktor), hardcodierte Farbe scatter.js. Redundante `core.activePage()`-Methode entfernt (→ `core.state.activePage`). Toter Fallback-Div `#page-canvas-lieferfahigkeit` aus index.html entfernt. DOM-Struktur, API-Dok und localStorage-Keys entsprechend aktualisiert. M19 um Copy-Paste-Anti-Pattern-Warnung ergänzt. Visual 8 von `happinessindex.js` auf `happiness.js` korrigiert.*
