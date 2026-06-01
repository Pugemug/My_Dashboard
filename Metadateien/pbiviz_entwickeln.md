# pbiviz Entwicklungs-Leitfaden

Lessons Learned aus der gemeinsamen Entwicklung von **LeadTime BoxChart**, **WIPAge Chart**, **CycleTime Scatterplot** und **FlowHeatmap**.

> **Letzte Ergänzung:** SDD-Workflow – §0.0 (Spec-Driven Development), §0.1 (Gate 1 → SDD-Bestätigung), §13 (SDD-Vorlage)
> **Vorherige Ergänzung:** CycleTime Scatterplot v2.1 – §4.7–4.9 (innerHTML-Verbot, TextInput, Tooltip-Links), §9.6 (Custom Icon Pflicht), §9.7 (Link-Feature Standard)

---

## 0. Zusammenarbeits-Protokoll (verbindlich ab sofort)

Dieser Abschnitt regelt **wie** Claude und Oliver zusammenarbeiten. Alle Regeln hier sind verbindlich und werden von Claude selbst eingehalten – ohne Aufforderung.

---

### 0.0 Spec-Driven Development (SDD) – Spezifikation vor dem Code

**Wann:** Vor Gate 1, vor dem ersten Prototyp, vor jeder Zeile Code.

**Was Claude tut:** Ein strukturiertes Interview führen, daraus die `VisualName_SDD.md` schreiben, und erst nach Bestätigung durch Oliver mit Gate 1 fortfahren.

**Warum:** Eine bestätigte Spec ist die einzige Quelle der Wahrheit. Sie verhindert Fehlentwicklungen, macht Neuanfänge reproduzierbar und ersetzt das mündliche Hin-und-Her durch ein Dokument das im nächsten Chat-Kontext direkt wiederverwendbar ist.

---

#### SDD-Interview-Protokoll

Claude führt das Interview in **7 Blöcken (A–G)**. Innerhalb eines Blocks dürfen mehrere zusammenhängende Fragen auf einmal gestellt werden (Ausnahme zu M1). Zwischen den Blöcken wartet Claude auf Olivers Antwort bevor Block B beginnt usw.

**Wie Claude das Interview startet:**

Wenn Oliver ein neues Visual ankündigt (z.B. „ich möchte einen BoxChart bauen"), antwortet Claude:

> „Gut. Ich führe zuerst das SDD-Interview durch, damit wir eine vollständige Spec haben bevor wir starten. Block A: [Fragen]"

**Block A – Zweck & Abgrenzung**
```
1. Beschreibe das Visual in 2–3 Sätzen: Was zeigt es? Welches Problem löst es?
2. Was macht es explizit NICHT? (Cross-Filter? DAX? Drill-Through? Andere Visuals beeinflussen?)
3. Technologie: pbiviz (TypeScript + Power BI) oder Web-App (.js + core.js)?
```

**Block B – Datenmodell**

*Für pbiviz:*
```
1. Welche Felder/Rollen braucht das Visual? (Name, Kind: Grouping/Measure, Typ: Text/Datum/Zahl, Pflicht?)
2. Gibt es Felder die optional sind? Was passiert wenn sie fehlen?
3. Datumsstrategie: eine Datumsspalte (max:1) oder mehrere (→ Measure + issueKey)?
```

*Für Web-App:*
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

**Block F – Design-Standards (§9-Pflichtcheck)**
```
1. Tooltip: boundary-safe (positionTooltip) + Links (Hover-Delay, pointerEvents)?
2. N-Anzeige: wo genau? (Unter Kategorie, oben links, in Zelle, …)
3. Reihenfolge-Panel: ▲/▼ + Drag benötigt?
4. Skalierung: Wie skalieren Punkte/Balken/Zellen mit der Containergröße?
5. Diagnosemodus: Welche Infos zeigt die Diag-Zeile mindestens?
6. [nur pbiviz] Icon-Motiv: Welche Formen/Farben? (§9.6)
7. Link-Feature: issueUrl + urlTemplate? Oder nicht benötigt? (§9.7)
```

**Block G – Akzeptanzkriterien**
```
Testbare Aussagen die Claude beim Implementieren prüft und Oliver beim manuellen Test abhakt.
Beispiele:
- "Tooltip bleibt an allen 4 Ecken des Visuals vollständig sichtbar"
- "Config-State überlebt Browser-Reload / Power BI Report-Neuöffnung"
- "Bei 0 Datenzeilen: Diag-Meldung sichtbar, kein JS-Error in der Console"
- "Dots skalieren sichtbar wenn Visual von 400px auf 200px Breite verkleinert wird"
```

---

#### SDD-Ausgabe

Nach Abschluss aller Blöcke schreibt Claude das `VisualName_SDD.md` nach der Vorlage in §13 und präsentiert es Oliver zur Bestätigung:

> „Hier ist die vollständige Spec: [SDD-Inhalt]. Passt das, oder soll ich etwas korrigieren?"

Erst nach Bestätigung durch Oliver beginnt **Gate 1** (jetzt: leichte Bestätigung der SDD, §0.1).

---

### 0.1 Quality Gate 1 – SDD-Bestätigung (vor dem ersten Code)

**Wann:** Direkt nach Abschluss des SDD-Interviews (§0.0) – bevor irgendeine Zeile Code geschrieben wird.

**Was Claude tut:** Die fertige SDD (§13) kurz zusammenfassen und explizit auf Bestätigung warten. Gate 1 ist jetzt **kein Generierungsschritt mehr** – die Spec entstand bereits im Interview. Gate 1 ist der formale Freeze-Moment.

```
## Gate 1 – SDD bestätigt: [VisualName]

SDD-Dokument: [VisualName_SDD.md] liegt vor.

Kern-Entscheidungen:
- Technologie: [pbiviz / Web-App (.js)]
- Datenmodell: [N Rollen / N Spalten] – [Datumsstrategie falls relevant]
- Config: [N Properties]
- Design: Tooltip ✓ · N-Anzeige: [wo] · Reihenfolge: [ja/nein] · Icon: [Motiv] · Link: [ja/nein]
- Akzeptanzkriterien: [N Punkte in SDD Block G]

Offene Punkte die noch nicht in der SDD stehen:
1. [falls vorhanden – sonst: keine]

Soll ich mit dem Prototyp beginnen? (§0.8 M6)
```

**Oliver antwortet** mit „Ja" oder korrigiert einzelne Punkte. Die SDD wird sofort aktualisiert. Erst dann beginnt Claude mit dem Prototyp.

**Warum:** DAX-Fehler (WIPAge) und Reihenfolge-Textfeld-Fehler (FlowHeatmap) wären durch das SDD-Interview in §0.0 Block B/C verhindert worden.

---

### 0.2 Quality Gate 2 – Pre-Delivery Review (vor jeder Datei-Übergabe)

**Wann:** Direkt bevor Claude die `.pbiviz`-Datei präsentiert.

**Was Claude tut:** Die vollständige Checkliste selbst durchgehen und das Ergebnis zeigen. Alle `[ ]`-Punkte müssen zu `[x]` werden – Claude behebt Lücken selbst, bevor die Datei übergeben wird.

```
## Pre-Delivery Review – [VisualName] v[X.Y.Z.0]

### Build & Packaging
- [x] pbiviz package: keine Errors (Warnings ok)
- [x] Version 4-teilig: X.Y.Z.0 ✓
- [x] Version in pbiviz.json UND package.json identisch
- [x] ZIP-Struktur: package.json + resources/ + resources/*.pbiviz.json
- [x] Dateiname enthält Versionsnummer: VisualName_vX.Y.pbiviz

### Struktur & Synchronisation
- [x] author auf Root-Level in pbiviz.json (nicht in visual{})
- [x] supportUrl nicht leer
- [x] Nur eine FormattingCard (name = "config")
- [x] capabilities.json ↔ settings.ts: alle Properties beidseitig vorhanden

### TypeScript-Fallen (§4)
- [x] fmtModel im Constructor vorinitialisiert
- [x] getFormattingModel() liest persistierte Werte aus lastDataView
- [x] Math.max() mit leerem Array abgesichert (length-Check)
- [x] indexOf statt includes verwendet
- [x] Spaltenindex-Bug vermieden (explizite for-Schleife statt map+filter)
- [x] Datumshierarchie-Strategie korrekt (max:1 oder Measure+issueKey)
- [x] Kein innerHTML verwendet -> DOM-API (createElement/textContent) (§4.7)

### Design-Standards (§9)
- [x] Tooltip: position:absolute im Container, positionTooltip() mit Overflow-Prüfung
- [x] Diagnosemodus: oben positioniert, Standard: an
- [x] N-Anzeige: vorhanden, Position: [wo?]
- [x] Skalierung: alle Größen relativ zu options.viewport
- [x/–] Reihenfolge-Panel: ▲/▼ mit persistProperties() / nicht benötigt
- [x] Icon: eigenes Motiv, kein Standard-Platzhalter (§9.6)
- [x/-] Link-Feature: issueUrl + urlTemplate + launchUrl() / nicht benoetigt (§9.7)

### Manueller Test-Hinweis für Oliver
- [ ] Tooltip an allen 4 Ecken des Visuals testen (nicht nur Mitte)
- [ ] Diagnosemodus ein/ausschalten
- [ ] Visual auf kleines Format skalieren → Elemente passen sich an?
```

Der letzte Block (manueller Test) ist für Oliver – er markiert, was nur in Power BI Desktop testbar ist.

---

### 0.3 Maßnahme M1 – Eine Frage, dann warten

Claude stellt in einer Antwort **immer nur eine Klärungsfrage**. Nicht mehrere auf einmal.

Wenn mehrere Unklarheiten bestehen, nennt Claude die wichtigste zuerst und wartet auf die Antwort, bevor die nächste gestellt wird.

**Ausnahme:** Beim Anforderungs-Freeze (Gate 1) dürfen alle offenen Fragen gesammelt aufgelistet werden, da sie vor dem Start vollständig beantwortet werden müssen.

---

### 0.4 Maßnahme M2 – Anforderungs-Zusammenfassung vor dem Code

Entspricht Gate 1 (§0.1). Die Zusammenfassung ist nicht optional – auch wenn eine Anforderung „klar klingt". Unklarheiten zeigen sich erst beim Aufschreiben.

---

### 0.5 Maßnahme M3 – „Ich mache X, weil Y" bei Design-Entscheidungen

Wenn Claude eine Design-Entscheidung trifft, die nicht explizit vorgegeben war (z.B. Tooltip-Position, N-Platzierung, Farbskala), benennt Claude kurz die Begründung:

> „N-Anzeige platziere ich oben links, weil hier kein Achsen-Label kollidiert (§9.4 Scatterplot-Regel). Passt das?"

Das gibt Oliver die Möglichkeit sofort zu korrigieren – bevor es implementiert ist.

---

### 0.6 Maßnahme M4 – Übergabe-Dokument ab Nachricht 15

Bisher: ab ~20–30 Nachrichten. Neu: **ab Nachricht 15** fragt Claude aktiv:

> „Wir sind bei Nachricht 15. Soll ich ein Übergabe-Dokument anlegen, damit der Kontext bei einem Chat-Neustart erhalten bleibt?"

Das Übergabe-Dokument wird nach §12-Vorlage erstellt und enthält den Stand aller Entscheidungen, bekannten Bugs und nächsten Schritte.

---

### 0.7 Maßnahme M5 – Bug-Wissen nach jedem Fix dokumentieren

Wenn im Laufe eines Chats ein neuer Bug entdeckt und behoben wird, dokumentiert Claude den Fix automatisch am Chatende – mit Symptom, Ursache und Fix. Oliver muss das nicht anfordern. Claude zeigt den neuen Eintrag zur Bestätigung.

**Wo dokumentieren (je nach Technologie):**

| Technologie | Ziel-Dokument | Abschnitt |
|---|---|---|
| pbiviz (TypeScript) | `pbiviz_entwickeln.md` | Passender §4-Unterabschnitt oder §11 Ressourcenverbrauch |
| Web App (.js) | `FlowAnalytics_Dashboard_Uebergabe.md` | „Bekannte Bugs und Lösungen" |

**SDD-Update-Regel bei Fehlerbehebung:**

Bevor Claude einen Bug fixt, prüft Claude ob der Bug die SDD betrifft:

```
War der Bug ein Implementierungsfehler?     War der Bug eine Spec-Lücke?
(z.B. falsches Array-Indexing, innerHTML)   (z.B. Edge Case nicht bedacht,
→ Direkt fixen.                              Verhalten bei leerem Status fehlt)
→ Nur Bug-Doku ergänzen (M5).              → SDD zuerst updaten (Block D oder G).
                                            → Dann erst fixen.
                                            → Bug-Doku ergänzen (M5).
```

**Warum:** Die SDD ist die Quelle der Wahrheit. Ein Fix der eine Spec-Lücke schließt, ohne die SDD zu aktualisieren, macht die SDD inkonsistent – das nächste Rebuild würde denselben Fehler reproduzieren.

---

### 0.8 Maßnahme M6 – Kein Code vor Prototyp-Freigabe

Bei Custom Visuals (TypeScript + pbiviz) gilt: **Erst HTML/React-Prototyp bauen und von Oliver freigeben lassen, dann erst TypeScript.**

Wenn Claude bemerkt, dass eine Anforderung direkt in TypeScript umgesetzt werden soll, ohne dass ein Prototyp gezeigt wurde, erinnert Claude aktiv daran:

> „Laut §1 sollten wir vor dem TypeScript-Code einen HTML-Prototyp freigeben. Soll ich das zuerst bauen?"

Ausnahme: Kleine Bugfixes oder Erweiterungen an bestehendem Code brauchen keinen neuen Prototyp.

---

## 1. Vor dem Start: Technologie-Entscheidung treffen

Bevor irgendeine Zeile Code geschrieben wird, gemeinsam klären:

| Frage | Warum wichtig |
|---|---|
| Ist das Visual einfach genug für **Deneb/Vega**? | Deneb braucht keinen Build, kein TypeScript, keinen pbiviz-Import. Änderungen sind sofort sichtbar. |
| Braucht es komplexe Berechnungen (Rolling Percentile, Status-Logik)? | Erst dann ist ein Custom Visual (TypeScript) gerechtfertigt. |
| Welche Felder kommen aus Power BI? | Datenstruktur vor dem ersten Commit klären, nicht schrittweise entdecken. |

**Fehler der Vergangenheit:** Beim WIPAge Chart wurde nie über Deneb/Vega gesprochen. Am Ende des Projekts stellte sich heraus: für einfachere Scatterplots wäre Deneb die bessere Wahl gewesen. Diese Frage muss **immer als erstes** gestellt werden.

**Entscheidungsbaum:**
```
Brauche ich komplexe server-seitige Berechnungen?
├── Nein → Deneb/Vega (kein Build, kein Import)
└── Ja → Custom Visual (TypeScript + pbiviz)
         └── Zuerst React/HTML-Prototyp bauen & freigeben lassen (M6),
             dann erst pbiviz umsetzen
```

---

## 2. Projektstruktur – was immer dabei sein muss

Jedes neue Custom Visual beginnt mit dieser Grundstruktur:

```
src/
  visual.ts          ← Hauptlogik
  settings.ts        ← FormattingSettings-Klassen
capabilities.json    ← MUSS synchron mit settings.ts sein
pbiviz.json          ← author-Feld: nur auf Root-Level, NICHT in visual{}
```

### Sofort nach `pbiviz new VisualName` – Setup-Checkliste

`pbiviz new` erzeugt eine Vorlage mit mehreren Fehlern und Platzhaltern. Diese Punkte **vor dem ersten Commit** korrigieren:

```bash
pbiviz new MeinVisual
cd MeinVisual
# Jetzt sofort die Checkliste abarbeiten:
```

| Schritt | Datei | Was tun |
|---|---|---|
| 1 | `pbiviz.json` | `author` auf Root-Level verschieben (raus aus `visual{}`), `supportUrl` befüllen |
| 2 | `pbiviz.json` + `package.json` | Version auf `1.0.0.0` (4-teilig) setzen, **beide** Dateien synchron |
| 3 | `assets/icon.png` | Sofort durch eigenes Icon ersetzen – nie mit Platzhalter committen (§9.6) |
| 4 | `capabilities.json` | Standard-Rollen löschen, eigenes Datenmodell eintragen (§3, §4.6, §4.11) |
| 5 | `src/visual.ts` | Standard-Kreis-Beispielcode löschen, `fmtModel` im Constructor vorinitialisieren (§4.1) |
| 6 | `src/settings.ts` | Standard-Properties löschen, eigene `ConfigCard` anlegen |
| 7 | `tsconfig.json` | Target prüfen: muss `"ES6"` oder höher sein; `"ES5"` bricht moderne Syntax (§4.4) |

### pbiviz.json: Die korrekte author-Struktur

```json
{
  "visual": {
    "name": "meinVisual",
    "version": "1.0.0.0",
    "supportUrl": "https://company.com",
    "gitHubUrl": ""
  },
  "author": { "name": "Oliver Wolter", "email": "" }
}
```

**Fehler der Vergangenheit:** `author` wurde innerhalb von `visual{}` platziert. Das löst bei `pbiviz package` eine AppSource-Zertifizierungsprüfung aus und verhindert den Build. `supportUrl` muss einen nicht-leeren Wert haben.

**Fehler der Vergangenheit:** Version wurde mit 3-teiligem Format gesetzt (`1.4.0` statt `1.4.0.0`). Power BI erwartet immer **4-teilige Versionsnummern** im Format `MAJOR.MINOR.PATCH.BUILD`. Falsche Formate erzeugen keine Fehlermeldung, verhalten sich aber unvorhersehbar.

---

## 3. Die capabilities.json ↔ settings.ts Synchronisationsregel

Dies ist der häufigste Fehler und muss als **eiserne Regel** befolgt werden:

> **Jede Property in `settings.ts` braucht einen identisch benannten Eintrag in `capabilities.json` – und umgekehrt.**

Immer **eine einzige FormattingCard** mit `name = "config"` verwenden. Mehrere Cards führen zwangsläufig zu Inkonsistenzen.

**capabilities.json (Vorlage):**
```json
{
  "objects": {
    "config": {
      "properties": {
        "meinToggle":  { "type": { "bool": true } },
        "meinWert":    { "type": { "numeric": true } },
        "meineFarbe":  { "type": { "fill": { "solid": { "color": true } } } }
      }
    }
  }
}
```

**settings.ts (Vorlage):**
```typescript
class ConfigCard extends FormattingSettingsCard {
  name = "config";
  displayName = "Einstellungen";

  meinToggle = new formattingSettings.ToggleSwitch({
    name: "meinToggle", displayName: "...", value: true
  });
  meinWert = new formattingSettings.NumUpDown({
    name: "meinWert", displayName: "...", value: 10
  });
  slices = [this.meinToggle, this.meinWert];
}
```

**Checkliste nach jeder Änderung:**
- [ ] Jede Property in `settings.ts` → in `capabilities.json` vorhanden?
- [ ] Jeder Eintrag in `capabilities.json` → in `settings.ts` vorhanden?
- [ ] Nur **eine** Card (`name = "config"`)?

---

## 4. Bekannte TypeScript-Fallen im pbiviz-Kontext

### 4.1 `fmtModel` muss im Constructor initialisiert werden

```typescript
constructor(options: VisualConstructorOptions) {
  // IMMER vorinitialisieren – getFormattingModel() kann vor update() aufgerufen werden
  this.fmtModel = new VisualFormattingSettingsModel();
}
```

**Fehler der Vergangenheit:** `getFormattingModel()` crashte beim ersten Aufruf, bevor `update()` gelaufen ist. Das Visual blieb still leer ohne Fehlermeldung.

### 4.2 `getFormattingModel()` muss persistierte Werte lesen

```typescript
// FALSCH – Wert ist immer hardcodiert true, überschreibt gespeicherte Einstellung
getFormattingModel(): powerbi.visuals.FormattingModel {
  return {
    cards: [{ ... value: true ... }]
  };
}

// RICHTIG – gespeicherten Wert aus lastDataView lesen
getFormattingModel(): powerbi.visuals.FormattingModel {
  const saved = this.lastDataView?.metadata?.objects?.["config"]?.["meinToggle"] as boolean ?? true;
  return {
    cards: [{ ... value: saved ... }]
  };
}
```

**Fehler der Vergangenheit:** Toggle-Schalter (z.B. „Ausreißer anzeigen") wurde nach jedem Neuzeichnen zurückgesetzt, weil `getFormattingModel()` immer `value: true` zurückgab. Der Schalter konnte nicht dauerhaft auf „aus" gestellt werden.

### 4.3 `Math.max()` mit leerem Array

```typescript
// FALSCH – gibt -Infinity zurück → Chart bricht unsichtbar zusammen
const yMax = Math.max(...values);

// RICHTIG – immer mit Fallback absichern
const yMax = values.length ? Math.max(...values) : 0;
```

### 4.4 `Array.includes()` nicht verfügbar

Das pbiviz TypeScript-Target (`"ES6"` / `"ES2015"`) unterstützt einige neuere JavaScript-Methoden nicht. `includes()` ist das bekannteste Beispiel, aber nicht das einzige.

```typescript
// FALSCH
if (statuses.includes("Done")) { ... }

// RICHTIG
if (statuses.indexOf("Done") >= 0) { ... }
```

**Vollständige Übersicht häufig benutzter Methoden und ihrer Alternativen:**

| Methode (nicht verfügbar) | Alternative |
|---|---|
| `array.includes(x)` | `array.indexOf(x) >= 0` |
| `array.flat()` | Manuell: `[].concat(...arrays)` |
| `array.flatMap(fn)` | `array.map(fn).reduce((a,b) => a.concat(b), [])` |
| `Object.entries(obj)` | `Object.keys(obj).map(k => [k, obj[k]])` |
| `Object.fromEntries(pairs)` | Manuell: `pairs.reduce((o,[k,v]) => ({...o,[k]:v}), {})` |
| `String.padStart(n, c)` | Manuell mit `while`-Schleife |
| `?.` optional chaining | Explizite Null-Checks: `obj && obj.prop` |
| `??` nullish coalescing | `(val != null) ? val : default` |

> **Faustregel:** Wenn eine Methode in MDN als „ES2016+" oder später markiert ist, mit Vorsicht verwenden und im Build testen. TypeScript kompiliert manche Syntax herunter (z.B. optional chaining), andere aber nicht.

### 4.5 `.map().filter()` Index-Bug bei Spaltenrollen

```typescript
// FALSCH – i ist der Index im gemappten Array, nicht in cols[]
const sdCols = cols.map((c, i) => ({ n: c.displayName, i }))
                   .filter((_, i) => !!cols[i].roles?.["meinRolle"]);

// RICHTIG – colIdx explizit speichern
const sdCols: { name: string; colIdx: number }[] = [];
for (let ci = 0; ci < cols.length; ci++) {
    if (cols[ci].roles?.["meinRolle"]) {
        sdCols.push({ name: cols[ci].displayName, colIdx: ci });
    }
}
```

### 4.6 Datumshierarchie aus Power BI – Ursache, Erkennung und Lösung

#### Hintergrund: Warum entsteht das Problem?

Power BI aktiviert standardmäßig „Auto Datum/Uhrzeit". Dabei wird jede Datumsspalte automatisch in eine Hierarchie (Jahr → Quartal → Monat → Tag) umgewandelt. Zieht der Nutzer ein solches Feld in ein `Grouping`-Feldwell ohne `max: 1`-Bedingung, fügt Power BI die ganze Hierarchie ein – nicht die Rohdatumsspalte. Das Visual erhält dann statt echter Timestamps kleine Ganzzahlen (z.B. Tag = 5, Monat = 1).

**Fehler der Vergangenheit:** Y-Achse zeigte `0.00018d` weil Power BI-Datumshierarchie die Zahl `5` (Tag) statt einen echten Timestamp lieferte.

#### Wann tritt das Problem NICHT auf?

- Bei **`max: 1`-Bedingung** im Feldwell (z.B. CycleTime Scatterplot): Power BI erlaubt nur ein Feld → verwendet die Rohdatumsspalte, keine Hierarchie.
- Bei **`kind: "Measure"`** im Datenmodell (z.B. WIPAge Chart, FlowHeatmap): Measure-Felder werden nie als Hierarchie behandelt, sondern mit einer Aggregationsfunktion belegt (Standard für Datum: MIN = „Frühestes Datum").

#### Was bedeutet „Frühestes Datum: In Progress"?

Wenn eine Datumsspalte (z.B. „In Progress") als `Measure` ins Feldwell gezogen wird, wendet Power BI automatisch MIN an und benennt das Feld „Frühestes Datum: In Progress". Das klingt nach mehreren Daten pro Eintrag – ist aber irreführend:

> Jedes Work-Item hat genau **ein** „In Progress"-Datum. MIN über einen einzelnen Wert = der Wert selbst. Das Ergebnis ist inhaltlich identisch mit dem Rohdatum.

```
IssueKey = PROJ-1 → MIN("In Progress") = 01.01.2024  ✓  (einziger Wert = MIN)
IssueKey = PROJ-2 → MIN("In Progress") = 05.01.2024  ✓
```

Die Bezeichnung ist Power BIs internes Label für die Aggregationsfunktion, hat aber keine Auswirkung auf die Korrektheit der Daten – vorausgesetzt, ein eindeutiger Zeilenidentifier (Issue Key) ist als `Grouping` vorhanden.

#### Die korrekte Lösung: `Measure` + `issueKey` als Grouping

Für Visuals mit **mehreren Datumsspalten** (kein `max: 1` möglich):

```json
// capabilities.json
{
  "dataRoles": [
    { "name": "issueKey",    "kind": "Grouping" },   // ← PFLICHT: sorgt für Zeilenindividualität
    { "name": "stateDates",  "kind": "Measure"  }    // ← verhindert Datumshierarchie
  ]
}
```

**Warum ist `issueKey` als Grouping Pflicht?**
Ohne `issueKey` aggregiert Power BI alle Items pro Gruppe (z.B. pro Team + Typ) und die Datumsspalten würden als MIN über alle Items der Gruppe berechnet – das wäre inhaltlich falsch. Mit `issueKey` als Grouping erhält das Visual eine Zeile pro Work-Item, und MIN pro Item = das korrekte Einzeldatum.

#### Spaltenname-Extraktion aus `queryName`

Da Power BI den Anzeigenamen ändert (z.B. „Frühestes Datum: leaving_Analysed"), muss der echte Spaltenname aus dem `queryName` extrahiert werden:

```typescript
// queryName-Beispiele:
//   "Min(Issues[leaving_Analysed])"  → "leaving_Analysed"
//   "'Issues Table'[Analysed_first]" → "Analysed_first"

function extractColumnName(col: powerbi.DataViewMetadataColumn): string {
    // Zuerst queryName: letztes [xxx] extrahieren
    const m = (col.queryName || "").match(/\[([^\]]+)\]$/);
    if (m) return m[1].trim();

    // Fallback: bekannte Aggregations-Prefixe aus displayName entfernen
    const dn = (col.displayName || "").trim();
    const prefixes = [
        "Frühestes Datum: ", "Letztes Datum: ", "Frühestes Datum von ",
        "Min of ", "Max of ", "Minimum of ", "Maximum of "
    ];
    for (const p of prefixes) if (dn.startsWith(p)) return dn.slice(p.length).trim();
    return dn;
}
```

#### Entscheidungsbaum: Wie Datumshierarchie vermeiden?

```
Wie viele Datumsspalten braucht das Feldwell?
├── Genau 1 (z.B. Completion Date)
│   └── kind: "Grouping" + conditions: { "meinDatum": { "max": 1 } }
│       → Power BI verwendet Rohdatum, keine Hierarchie
└── Mehrere (z.B. alle Zustandsdaten)
    └── kind: "Measure" + issueKey als Grouping (PFLICHT)
        → Measure vermeidet Hierarchie
        → issueKey stellt Zeilenindividualität sicher
        → Spaltenname via queryName extrahieren
```

### 4.7 `innerHTML` ist verboten – ESLint-Regel `powerbi-visuals/no-inner-outer-html`

**Symptom:** Lint-Error beim Build: `Writing a string to the innerHTML property is insecure`.

**Fehler der Vergangenheit:** Wiederholt aufgetreten – CycleTime Scatterplot (Tooltip-Aufbau und Link-Zeile), FlowHeatmap, LeadTime BoxChart.

```typescript
// FALSCH – Lint-Error, Build schlägt fehl
tooltip.innerHTML = `<b>${key}</b><span>${ct}d</span>`;

// RICHTIG – immer DOM-API verwenden
while (tooltip.firstChild) tooltip.removeChild(tooltip.firstChild);
const b = document.createElement("b");
b.textContent = key;
tooltip.appendChild(b);
const span = document.createElement("span");
span.textContent = ct + "d";
tooltip.appendChild(span);
```

**Regel:** Vor jedem Build prüfen ob `innerHTML`, `outerHTML` oder `insertAdjacentHTML` im Code vorkommt. Gate 2 prüft das.

---

### 4.8 TextInput im Format-Panel

Für einzeilige Texteingaben (z.B. URL-Templates) im Format-Panel:

```typescript
// getFormattingModel()
{
    uid: "url_tmpl",
    displayName: "URL-Template ({issueKey})",
    control: {
        type: "TextInput",
        properties: {
            descriptor: { objectName: "config", propertyName: "urlTemplate" },
            value: getStr(dv, "urlTemplate", ""),
            placeholder: "https://jira.company.com/browse/{issueKey}"
        }
    }
}

// capabilities.json
"urlTemplate": { "type": { "text": true } }
```

---

### 4.9 Tooltip mit klickbaren Elementen: `pointerEvents` + Hover-Delay

Wenn ein Tooltip Links oder andere klickbare Elemente enthält:
1. `pointerEvents: none` blockiert Klicks auf den Tooltip selbst
2. Der Tooltip verschwindet wenn die Maus vom Datenpunkt auf den Tooltip wandert

**Pflichtimplementierung:**

```typescript
// pointerEvents dynamisch umschalten
tooltip.style.pointerEvents = item.url ? "all" : "none";

// Hover-Delay-Muster: 120ms damit Maus vom Punkt auf Tooltip wechseln kann
let hideTimer: ReturnType<typeof setTimeout> | null = null;
const showTt = () => { if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; } };
const hideTt = () => { hideTimer = setTimeout(() => { tooltip.style.display = "none"; }, 120); };

tooltip.addEventListener("mouseenter", showTt);
tooltip.addEventListener("mouseleave", hideTt);

// Datenpunkte: mouseout -> hideTt() statt direktem display:none
dot.on("mouseover", () => { showTt(); /* Tooltip aufbauen */ })
   .on("mousemove", () => { showTt(); })
   .on("mouseout",  () => { hideTt(); });
```

**Cursor auf Datenpunkten mit URL:**
```typescript
.attr("cursor", d => d.url ? "pointer" : "default")
```

---

### 4.10 `update()` – Null-Safety und defensives Grundgerüst

Jedes `update()` muss gegen fehlende oder unvollständige Daten abgesichert sein. Ein Visual das abstürzt zeigt sich in Power BI als leeres weißes Rechteck – ohne jede Fehlermeldung. Das defensive Grundgerüst verhindert das:

```typescript
public update(options: VisualUpdateOptions): void {
    // Schritt 1: dataViews vorhanden?
    const dataViews = options.dataViews;
    if (!dataViews || !dataViews[0]) {
        this.showDiagText(["Keine Daten – Felder in Feldwell ziehen."]);
        return;
    }

    // Schritt 2: lastDataView speichern (PFLICHT für getFormattingModel)
    this.lastDataView = dataViews[0];

    // Schritt 3: FormattingSettings aus DataView befüllen
    this.fmtModel = this.formattingSettingsService.populateFormattingSettingsModel(
        VisualFormattingSettingsModel, dataViews[0]
    );

    // Schritt 4: Tabellenstruktur prüfen (bei table-Mapping)
    const table = dataViews[0].table;
    if (!table || !table.rows || table.rows.length === 0) {
        this.showDiagText(["Tabelle leer oder Struktur fehlt."]);
        return;
    }

    // Schritt 5: Pflicht-Rolle prüfen
    const cols = table.columns;
    const issueKeyIdx = cols.findIndex(c => c.roles?.["issueKey"]);
    if (issueKeyIdx < 0) {
        this.showDiagText(["Pflichtfeld 'issueKey' nicht zugewiesen."]);
        return;
    }

    // Ab hier: Daten sind verlässlich vorhanden → eigentliche Logik
    const cfg = this.fmtModel.config;
    // ...
}
```

**Regeln:**
- `lastDataView` immer in Schritt 2 setzen, **bevor** irgendeine andere Verarbeitung – sonst crasht `getFormattingModel()` beim nächsten Aufruf
- Jede Guard-Bedingung zeigt eine Diagnosemeldung und beendet `update()` mit `return` – nie `throw`
- `populateFormattingSettingsModel()` darf erst aufgerufen werden nachdem `dataViews[0]` auf Existenz geprüft wurde

---

### 4.11 DataViewMapping – `table` vs. `categorical` vs. `matrix`

Die Wahl des DataViewMappings bestimmt wie Power BI die Daten liefert. Falsche Wahl → `dataViews[0]` hat die erwartete Struktur nicht und das Visual zeigt nichts.

**Entscheidungstabelle:**

| Mapping | Einsatz | Datenzugriff | Wann verwenden |
|---|---|---|---|
| `table` | Zeilenliste, eine Zeile pro Work-Item | `dataViews[0].table.rows[i][colIdx]` | **Standard für Flow-Analytics-Visuals** – jede Zeile = ein Issue |
| `categorical` | Gruppierte Daten mit Measures | `dataViews[0].categorical.categories` + `.values` | Wenn Aggregation pro Gruppe gewünscht (z.B. Durchschnitt pro Team) |
| `matrix` | Kreuztabelle / Pivot | `dataViews[0].matrix.rows` + `.columns` | Heatmaps mit Zeilen- und Spalten-Dimension |

**`table`-Mapping in capabilities.json (Standardfall):**
```json
"dataViewMappings": [{
    "table": {
        "rows": {
            "for": { "in": "allColumns" }
        }
    }
}]
```

**`categorical`-Mapping in capabilities.json:**
```json
"dataViewMappings": [{
    "categorical": {
        "categories": {
            "for": { "in": "issueKey" }
        },
        "values": {
            "select": [
                { "for": { "in": "cycleTime" } },
                { "for": { "in": "completionDate" } }
            ]
        }
    }
}]
```

**Typischer Datenzugriff bei `table`:**
```typescript
const rows  = dataViews[0].table.rows;
const cols  = dataViews[0].table.columns;

// Spaltenindex für eine Rolle ermitteln
const keyIdx = cols.findIndex(c => c.roles?.["issueKey"]);

for (const row of rows) {
    const key = row[keyIdx] as string;
    // ...
}
```

**Fehler der Vergangenheit:** `categorical`-Mapping gewählt, obwohl Zeilendaten benötigt wurden → Power BI aggregierte automatisch, jedes Work-Item war nicht mehr einzeln zugänglich.

Jedes Visual sollte einen einschaltbaren Diagnosemodus haben. Das spart bei leerem Chart sofortigen Einblick:

```typescript
// Im update()-Aufruf
if (cfg.showDiag.value !== false) {
  const lines = [
    `Spalten: ${cols.length}`,
    `Items gesamt: ${allItems.length}`,
    `Aktive Items: ${wipItems.length}`,
    `Status: ${statuses.join(", ") || "–"}`
  ];
  this.showDiagText(lines);
}
```

**Regeln:**
- Diagnosemodus ist standardmäßig **an** und wird erst ausgeschaltet wenn das Visual stabil läuft.
- Die Diagnose-Box wird **immer oben** im Visual angezeigt (nie unten oder überlappend mit Diagrammelementen).
- Farbton und Styling der Diagnose-Box bleibt einheitlich über alle Visuals (grauer Hintergrund, kleiner Monospace-Text) — **nicht verändern**.

---

## 6. Versioning und Build-Disziplin

**Bei jedem Build die Version hochzählen.** Power BI cached aggressiv – ohne neue Versionsnummer wird die alte Datei geladen.

```python
# pbiviz.json Version hochzählen vor jedem Package-Build
# ACHTUNG: Immer 4-teiliges Format verwenden: MAJOR.MINOR.PATCH.BUILD
import json
with open('pbiviz.json') as f: d = json.load(f)
d['visual']['version'] = '1.X.0.0'  # ← erhöhen, NIEMALS 3-teilig wie '1.X.0'
with open('pbiviz.json', 'w') as f: json.dump(d, f, indent=4)
```

**Regeln:**
- Version **nie** anfragen – automatisch bei jedem Build hochzählen ohne Rückfrage.
- Versionsnummer immer in **beiden** Dateien aktuell halten: `pbiviz.json` UND `package.json`.
- **Dateinamen-Konvention:** `VisualName_vX.Y.pbiviz` – damit ist im Datei-Explorer sofort erkennbar welche Version es ist.

---

## 7. pbiviz korrekt umpacken (bei Bearbeitung kompilierter Visuals)

Wenn ein bestehendes `.pbiviz` bearbeitet wird (ohne Quellcode), muss beim Zurückzippen die **Verzeichnisstruktur exakt erhalten** bleiben.

```bash
# FALSCH – -j entfernt den resources/-Verzeichniseintrag → "kein gültiges Element"
zip -j output.pbiviz package.json resources/visual.pbiviz.json

# RICHTIG – aus dem Verzeichnis heraus zippen, sodass resources/ als Eintrag drin ist
cd extract_dir
zip output.pbiviz package.json resources/ resources/visual.pbiviz.json
```

**Validierung vor Übergabe:**
```bash
unzip -l output.pbiviz
# Erwartet: genau diese 3 Einträge
#   package.json
#   resources/
#   resources/visualName.pbiviz.json
```

---

## 8. Patch-Strategie: Wann neu schreiben statt patchen

**Faustregel:** Wenn mehr als **2 Patches** auf dieselbe Datei gehen → Datei komplett neu schreiben.

Symptome, die zum Neuschreiben zwingen:
- Jeder Fix erzeugt einen neuen Bug an anderer Stelle
- Der Chat wird sehr lang und das Kontextfenster ist voll
- Die ursprüngliche Logik ist nach mehreren Patches nicht mehr nachvollziehbar

**Bei Neuschreiben:** Zuerst die Anforderungen explizit auflisten, dann einen vollständigen Entwurf schreiben – nicht schrittweise ergänzen.

---

## 9. Design- und UX-Richtlinien für alle Visuals

Dies sind **verbindliche Designstandards** die bei jedem neuen Visual von Anfang an eingehalten werden müssen – nicht erst wenn der Nutzer sie anfordert.

### 9.1 Reihenfolge-Steuerung: Immer wie in der FlowHeatmap

Wenn der Nutzer die Reihenfolge von Elementen (z.B. Prozess-Zustände, Kategorien) im Visual steuern kann, wird **immer** das FlowHeatmap-Muster verwendet: ein In-Visual-Panel mit ▲/▼-Buttons pro Element.

**Nie** stattdessen: einfaches Textfeld im Format-Panel, Drag&Drop (nicht in Power BI unterstützt), Dropdowns.

```
┌─────────────────────────────┐
│ ↕ Reihenfolge          [×] │   ← Button oben rechts öffnet Panel
├─────────────────────────────┤
│ 1. Analyse          [▲][▼] │
│ 2. Entwicklung      [▲][▼] │
│ 3. Test             [▲][▼] │
│ 4. Review           [▲][▼] │
└─────────────────────────────┘
```

Die gewählte Reihenfolge wird via `persistProperties()` im Bericht gespeichert und überlebt das Schließen des Berichts.

**`persistProperties()` – vollständiges Code-Muster:**

```typescript
// capabilities.json – Property für gespeicherte Reihenfolge
// "stateOrder": { "type": { "text": true } }

// Reihenfolge speichern (aufrufen wenn ▲/▼ geklickt wird)
private saveOrder(order: string[]): void {
    this.host.persistProperties({
        merge: [{
            objectName: "config",
            selector: null,           // null = gilt für das gesamte Visual
            properties: {
                stateOrder: JSON.stringify(order)
            }
        }]
    });
    // WICHTIG: persistProperties() löst einen neuen update()-Aufruf aus.
    // Keinen State intern merken der dabei überschrieben würde.
}

// Reihenfolge laden – immer aus lastDataView lesen, nicht aus lokalem State
private loadOrder(): string[] {
    const raw = this.lastDataView?.metadata?.objects?.["config"]?.["stateOrder"] as string;
    if (!raw) return [];
    try { return JSON.parse(raw); }
    catch { return []; }
}

// In update(): gespeicherte Reihenfolge mit aktuellen Zuständen abgleichen
const savedOrder = this.loadOrder();
const currentStates = /* aktuell vorhandene Zustände aus Daten */;
// Neue Zustände ans Ende hängen, weggefallene entfernen:
const order = [
    ...savedOrder.filter(s => currentStates.indexOf(s) >= 0),
    ...currentStates.filter(s => savedOrder.indexOf(s) < 0)
];
```

**Wichtigste Eigenschaft:** `persistProperties()` triggert sofort einen neuen `update()`-Aufruf. Die gespeicherte Reihenfolge erscheint deshalb erst beim nächsten `update()` in `lastDataView` – nicht sofort nach dem Aufruf.

### 9.2 Diagnoseanzeige: Immer oben, einheitliches Styling

- Position: **immer ganz oben** im Visual, vor allen anderen Elementen
- Standardmäßig: **eingeschaltet** (wird nach Stabilisierung abgeschaltet)
- Styling: grauer Hintergrund, kleine Monospace-Schrift – **einheitlich, nicht pro Visual anpassen**
- Toggle im Format-Panel unter „Einstellungen" → „Diagnosemodus anzeigen"
- Diagnoselinie enthält mindestens: Anzahl erkannter Zeilen, gefundene Spalten, erkannte Zustände/Gruppen

### 9.3 Tooltip: Muss immer vollständig sichtbar bleiben

**Dies ist ein wiederkehrender Fehler** – aufgetreten in LeadTime BoxChart, WIPAge Chart, CycleTime Scatterplot und FlowHeatmap. Der Tooltip darf **nie** am Rand des Visuals abgeschnitten werden.

**Pflichtimplementierung** bei jedem Visual mit Tooltip:

```typescript
private positionTooltip(tooltip: HTMLElement, mouseX: number, mouseY: number, container: HTMLElement): void {
    const ttW = tooltip.offsetWidth  || 200;
    const ttH = tooltip.offsetHeight || 100;
    const cW  = container.clientWidth;
    const cH  = container.clientHeight;

    // Horizontal: rechts vom Cursor, bei Überlauf nach links
    let left = mouseX + 12;
    if (left + ttW > cW) left = mouseX - ttW - 12;
    if (left < 0) left = 0;

    // Vertikal: unterhalb des Cursors, bei Überlauf nach oben
    let top = mouseY + 12;
    if (top + ttH > cH) top = mouseY - ttH - 12;
    if (top < 0) top = 0;

    tooltip.style.left = left + "px";
    tooltip.style.top  = top  + "px";
}
```

Der Tooltip muss `position: absolute` **im Container** haben (nicht `position: fixed` im body). Mouse-Koordinaten werden relativ zum Container berechnet:

```typescript
container.addEventListener("mousemove", (e) => {
    const rect = container.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    this.positionTooltip(this.tooltip, mouseX, mouseY, container);
});
```

**Vor jeder Auslieferung prüfen:** Tooltip an allen vier Ecken des Visuals testen, nicht nur in der Mitte.

### 9.4 N-Anzeige: Anzahl der Elemente immer anzeigen

Jedes Visual zeigt die Anzahl der dargestellten Elemente (N) an. Das Vorbild ist das Boxplot-Diagramm (LeadTime BoxChart).

**Platzierungsregeln:**
- Bei **Säulen/Kategorien auf der X-Achse** (BoxChart, WIPAge): N direkt **unter** jeder Kategoriebeschriftung als kleine, gedämpfte Zahl (`n=42`)
- Bei **Scatterplots** (CycleTime): N als kompakter Infoblock **oben links** im Diagrammbereich, ggf. aufgeschlüsselt nach Typ wenn Farb-Grouping aktiv ist
- Bei **Heatmaps**: N als Zahl in jeder Zelle (kleiner Zusatztext zur Metrik-Zahl) oder als Tooltip-Information
- Bei **Zeitreihen**: N als Beschriftung am Ende der Linie oder im Legeneneintrag

Wenn unklar wo N sinnvoll platziert ist → **fragen, nicht raten** (M1, M3).

### 9.5 Skalierung: Elemente müssen mit dem Visual skalieren

Alle graphischen Elemente müssen sich proportional zur Visualgröße verhalten – weder fixe Pixelgrößen für Punkte/Balken noch fixe Abstände.

**Pflichtregeln:**
- Punktgrößen (z.B. in Scatterplots): relativ zur kleineren Dimension (Höhe oder Breite) des Containers berechnen, **plus** konfigurierbarer Basis-Skalierungsfaktor im Format-Panel
- Schriftgrößen für Achsenbeschriftungen, N-Werte etc.: in `px` oder `em` relativ zum Container, nicht absolut
- Spaltenbreiten/Zellhöhen in Heatmaps: `100% / Anzahl` – nie feste Pixel
- Nach jedem `resize`-Event neu berechnen und neu zeichnen

```typescript
// FALSCH – feste Punktgröße
const r = 6;

// RICHTIG – skaliert mit Containerbreite, konfigurierbar
const baseDotSize = cfg.dotSize?.value ?? 4;
const r = Math.max(2, Math.min(baseDotSize, (options.viewport.width / 100)));
```

### 9.6 Custom Icon: Pflicht für jedes Visual

Jedes Visual muss ein **eigenes, sinnvolles 20x20 px Icon** haben. Der Standard-Platzhalter von `pbiviz new` ist nicht akzeptabel.

**Fehler der Vergangenheit:** CycleTime Scatterplot v2.0 hatte kein Icon – beim Neuaufbau mit `pbiviz new` wurde der leere Platzhalter stillschweigend übernommen.

**Erstellungsprozess** (einmalig pro Visual, Python):
```python
import cairosvg  # pip install cairosvg --break-system-packages

svg = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
  <rect width="20" height="20" rx="3" fill="#0f172a"/>
  <!-- Visual-spezifisches Motiv, Beispiel Scatterplot: -->
  <line x1="3" y1="10" x2="17" y2="10" stroke="#fbbf24" stroke-width="0.8" stroke-dasharray="1.5,1"/>
  <circle cx="5"  cy="15" r="1.1" fill="#38bdf8"/>
  <circle cx="10" cy="11" r="1.1" fill="#38bdf8"/>
  <circle cx="14" cy="8"  r="1.1" fill="#fb923c"/>
  <circle cx="9"  cy="5"  r="1.3" fill="#f87171"/>
</svg>"""

cairosvg.svg2png(bytestring=svg.encode(),
                 write_to="assets/icon.png",
                 output_width=20, output_height=20)
```

**Motivrichtlinien:**
- Dunkler Hintergrund (`#0f172a`), Farben aus dem PALETTE-Array
- Erkennbar bei 20x20 px: wenige, klare geometrische Formen
- Spiegelt den Chart-Typ wider: Scatterplot → Punkte + Linie, Heatmap → Raster, Boxplot → Box + Whisker

**Gates:**
- SDD Block F enthält: `Icon-Motiv: [was ist geplant?]` als Pflichtfeld
- Gate 1 bestätigt das Motiv ✓
- Gate 2 prüft: `[x] Icon: eigenes Motiv, kein Standard-Platzhalter (§9.6)`

---

### 9.7 Link-Feature: Standard für alle Visuals mit issueKey

Jedes Visual mit `issueKey`-Datenrolle bekommt das Link-Feature als **eingebauten Standard** – kein Extra-Feature.

**Warum:** Direkt aus dem Visual auf das Jira/ADO-Issue springen ist ein häufiger Bedarf. Nachträglich einbauen kostet mehr als es von Anfang an zu haben.

**Datenrolle** (capabilities.json):
```json
{ "displayName": "Issue URL", "name": "issueUrl", "kind": "Grouping",
  "description": "Optional: URL pro Issue fuer Tooltip-Link" }
```

**Format-Panel Property:**
```json
"urlTemplate": { "type": { "text": true } }
```

**URL-Auflösungs-Logik** (Priorität: Spalte > Template > kein Link):
```typescript
const resolveUrl = (key: string, rawUrl: string): string => {
    if (rawUrl && rawUrl.trim()) return rawUrl.trim();
    if (urlTemplate.trim()) return urlTemplate.replace(/\{issueKey\}/g, key);
    return "";
};
```

**Öffnen via Power BI API** – nie `window.open()` (funktioniert nicht in eingebetteten Reports):
```typescript
linkElement.addEventListener("click", () => { this.host.launchUrl(item.url); });
```

**Tooltip-Regeln** (zusammen mit §4.9 umsetzen):
- Link-Zeile nur wenn `item.url` nicht leer
- Trennlinie vor dem Link (`border-top: 1px solid #334155; margin: 5px 0 4px`)
- `pointerEvents: "all"` auf Tooltip wenn Link vorhanden (§4.9)
- Hover-Delay-Muster damit Nutzer auf Link klicken kann (§4.9)
- Cursor `pointer` auf Datenpunkten mit URL (§4.9)

**SDD Block F enthält:** `Link-Feature: [ja, issueUrl + urlTemplate] / [nicht benoetigt]`
**Gate 2 prüft:** `[x/-] Link-Feature: issueUrl + urlTemplate + launchUrl() / nicht benoetigt (§9.7)`


---

## 10. Workflow-Checkliste pro Visual

### Phase 1: Vor der Umsetzung
- [ ] Deneb/Vega vs. Custom Visual diskutiert? (§1)
- [ ] **SDD-Interview (§0.0) vollständig durchgeführt?** (Blöcke A–G)
- [ ] **`VisualName_SDD.md` erstellt und von Oliver bestätigt?** (§13)
- [ ] **Gate 1 (SDD-Bestätigung) durchgeführt?** (§0.1)
- [ ] HTML/React-Prototyp freigegeben? (M6, §0.8)
- [ ] Icon-Motiv in SDD Block F dokumentiert? (§9.6)
- [ ] Link-Feature in SDD Block F entschieden? (§9.7)

### Phase 2: Beim Entwickeln
- [ ] Eine einzige FormattingCard (`name = "config"`)?
- [ ] capabilities.json und settings.ts synchron?
- [ ] `fmtModel` im Constructor vorinitialisiert?
- [ ] `Math.max()` mit leerem Array abgesichert?
- [ ] `Array.includes()` durch `indexOf() >= 0` ersetzt?
- [ ] Diagnosemodus eingebaut, aktiviert und **oben** positioniert?
- [ ] **Tooltip boundary-safe implementiert** (positionTooltip mit Overflow-Prüfung)?
- [ ] N-Anzeige eingebaut (an sinnvoller Position, ggf. nachgefragt)?
- [ ] Reihenfolge-Steuerung als ▲/▼-Panel implementiert (falls benötigt)?
- [ ] Alle Elemente skalieren mit Viewport-Größe?
- [ ] **Kein `innerHTML` verwendet?** (DOM-API: createElement/textContent) (§4.7)
- [ ] Tooltip mit Links: `pointerEvents` dynamisch + Hover-Delay? (§4.9)
- [ ] Icon mit cairosvg erstellt, kein Standard-Platzhalter? (§9.6)
- [ ] Link-Feature: issueUrl + urlTemplate + `launchUrl()`? (§9.7)
- [ ] Chat bei Nachricht 15: Übergabe-Dokument angeboten? (M4, §0.6)

### Phase 3: Vor der Übergabe – Gate 2 durchführen
- [ ] **Gate 2 (Pre-Delivery Review) vollständig abgehakt** (§0.2)
- [ ] Version in `pbiviz.json` **und** `package.json` hochgezählt (4-teiliges Format)?
- [ ] `pbiviz package` erfolgreich ohne Errors (Warnings ok)?
- [ ] ZIP-Struktur validiert (`unzip -l`)?
- [ ] Dateiname enthält Versionsnummer?
- [ ] Neue Bugs während Entwicklung → pbiviz_entwickeln.md ergänzt? (M5, §0.7)
- [ ] Icon vorhanden und visuell sinnvoll (kein Platzhalter)? (§9.6)
- [ ] Link-Feature vollständig: Feldwell + Template + launchUrl + Tooltip? (§9.7)

### Manueller Test durch Oliver (nach Import in Power BI)
- [ ] Tooltip an allen 4 Ecken des Visuals testen (nicht nur Mitte)
- [ ] Diagnosemodus ein/ausschalten
- [ ] Visual auf kleines Format skalieren → Elemente passen sich an?
- [ ] Icon im Power BI Visual-Menü prüfen (kein Platzhalter) (§9.6)
- [ ] URL-Template eintragen, Hover auf Punkt → Link im Tooltip → klicken öffnet Browser (§9.7)

### Phase 4: Fehlerbehebung (ersetzt Phase 1–3 bei reinen Bugfixes)

> Kein SDD-Interview, kein Prototyp nötig – außer der Bug zeigt eine Spec-Lücke (dann SDD zuerst updaten, §0.7 M5).

**Vorbereitung**
- [ ] Bug klar beschrieben (Symptom, wann tritt er auf, was wurde erwartet)?
- [ ] Richtige Datei(en) hochgeladen?
  - Web App: betroffene `.js`-Datei + ggf. `core.js`
  - pbiviz: `.pbiviz`-Datei oder Quelldateien (`visual.ts`, `settings.ts`, `capabilities.json`)

**Analyse**
- [ ] Bug reproduziert / Diagnose abgeschlossen?
- [ ] Ist der Bug eine **Spec-Lücke**? (Edge Case fehlte in SDD Block D oder G)
  - Ja → **SDD.md zuerst updaten**, dann fixen (§0.7 M5)
  - Nein → direkt fixen

**Fix**
- [ ] Korrektur implementiert?
  - Web App: nur geänderte `.js`-Datei(en) – `core.js` und `index.html` nur wenn explizit angefasst
  - pbiviz: Version hochgezählt (4-teilig: `MAJOR.MINOR.PATCH.BUILD`)

**Gate 2 (leicht)**
- [ ] Kein `innerHTML` eingeschlichen? (§4.7)
- [ ] capabilities.json ↔ settings.ts noch synchron?
- [ ] pbiviz: `unzip -l` Validierung der ZIP-Struktur – auch beim Bugfix!
- [ ] pbiviz: Version in `pbiviz.json` UND `package.json` identisch?

**Übergabe**
- [ ] Web App: geänderte `.js`-Datei(en) übergeben; bei Bundle-Bedarf `build.py` ausführen → `FlowAnalytics.html`
- [ ] pbiviz: `VisualName_vX.Y.pbiviz` (Dateiname enthält Versionsnummer)
- [ ] M5: Bug dokumentiert (§0.7)?
  - Web App: Abschnitt „Bekannte Bugs und Lösungen" in Übergabe-Datei
  - pbiviz: passender §4-Abschnitt oder §11 in `pbiviz_entwickeln.md`

---

## 11. Ressourcenverbrauch optimieren

| Problem | Lösung |
|---|---|
| **Fehlentwicklung weil Anforderung erst beim Implementieren klar wird** | **SDD-Interview (§0.0) vor dem ersten Code – alle 7 Blöcke A–G** |
| Bug-Wissen geht verloren (Web App) | M5 gilt auch für Web App: Bugs in Übergabe-Datei „Bekannte Bugs" dokumentieren |
| Rebuild reproduziert denselben Bug | SDD-Update-Regel: Spec-Lücke → SDD zuerst updaten, dann fixen (§0.7 M5) |
| Zu viele Dateien bei Web-App-Übergabe | Nur geänderte `.js`-Datei(en) übergeben – `core.js`/`index.html` nur wenn explizit geändert |
| Viele Iterations-Runden wegen falschem ZIP-Format | Immer `unzip -l` zur Validierung – auch bei Bugfixes (Phase 4 Checkliste) |
| Viele Patches wegen capabilities ↔ settings Inkonsistenz | Beide Dateien immer gemeinsam bearbeiten, Checkliste nutzen |
| Chat zu lang, Kontext verloren | **Ab Nachricht 15** proaktiv Übergabe-Dokument anbieten (M4) |
| Leeres Visual ohne Fehlermeldung | Diagnosemodus standardmäßig an, Fehler als sichtbaren Text im Visual anzeigen |
| Versionscache in Power BI | Versionsnummer bei jedem Build hochzählen, nie dieselbe Version überschreiben |
| Falsche Technologiewahl (Custom Visual statt Deneb) | Technologie-Entscheidungsbaum am Anfang jedes Projekts durchgehen |
| Tooltip verschwindet am Rand (wiederholt in allen Visuals) | positionTooltip() mit Overflow-Prüfung von Anfang an einbauen – Gate 2 prüft das |
| Version im falschen Format (3-teilig statt 4-teilig) | Immer `MAJOR.MINOR.PATCH.BUILD` – Gate 2 prüft das automatisch |
| N-Anzeige fehlt | N-Anzeige als Standard-Feature einplanen, Platzierung im Gate 1 klären |
| Elemente skalieren nicht | Alle Größen relativ zu `options.viewport` berechnen – Gate 2 prüft das |
| Missverständnis bei Anforderungen (z.B. DAX vs. kein DAX) | Gate 1 mit expliziter Abgrenzung „Nicht enthalten" (§0.1) |
| Design-Entscheidung falsch getroffen (z.B. Textfeld statt ▲/▼) | M3: Claude begründet jede Design-Entscheidung und fragt nach Bestätigung |
| Fehler kehrt nach Behebung zurück | M5: Bug-Wissen nach jedem Fix dokumentieren (§0.7) |
| Zu früh in TypeScript ohne Prototyp | M6: Claude erinnert aktiv an Prototyp-Pflicht aus §1 |
| `innerHTML` bricht den Build (Lint-Error) | Immer DOM-API (createElement, textContent) – §4.7 |
| Standard-Platzhalter-Icon nach `pbiviz new` | Immer eigenes Icon mit cairosvg erstellen – §9.6 |
| Tooltip verschwindet bevor Link geklickt werden kann | Hover-Delay (120ms) + pointerEvents: all – §4.9 |
| Link öffnet nicht in eingebetteten Reports | host.launchUrl() statt window.open() – §9.7 |

---

## 12. Übergabe-Dokument Vorlage

Wenn ein Chat zu lang wird und ein neuer gestartet werden soll (ab Nachricht 15 anbieten – M4):

```markdown
# [VisualName] Projektübergabe

## Spec-Referenz
SDD-Datei: `[VisualName_SDD.md]` (Quelle der Wahrheit für Anforderungen)
SDD-Status: [ ] Bestätigt · [ ] Vollständig implementiert

## Was das Visual macht
[Kurzbeschreibung – kann aus SDD Abschnitt A übernommen werden]

## Was es NICHT macht (Abgrenzung)
[Aus SDD Abschnitt A]

## Datenmodell (Power BI Rollen)
| Rolle | Typ | Beschreibung |
|---|---|---|
| ... | ... | ... |

## Projektstruktur
[Pfade und Dateien]

## Format-Panel Einstellungen
[Alle Properties mit Typ und Default – aus SDD Abschnitt E]

## Aktive Design-Standards (aus pbiviz_entwickeln.md §9)
- [ ] Tooltip: position: absolute im Container, Overflow-Prüfung eingebaut
- [ ] N-Anzeige: vorhanden, Position: [wo?]
- [ ] Reihenfolge-Steuerung: [ja/nein] – als ▲/▼-Panel
- [ ] Skalierung: alle Größen relativ zu viewport
- [ ] Diagnosemodus: oben positioniert, Standard: an
- [ ] Icon: eigenes Motiv vorhanden (§9.6)
- [ ] Link-Feature: [ja: issueUrl + urlTemplate + launchUrl] / [nicht benoetigt] (§9.7)

## Aktives Zusammenarbeits-Protokoll (§0)
- SDD-Interview (§0.0): durchgeführt ✓ · SDD bestätigt ✓
- Gate 1 (SDD-Bestätigung): wurde durchgeführt ✓
- Gate 2 (Pre-Delivery Review): [Stand]
- M1–M6: aktiv

## Bekannte Bugs und Lösungen
[Symptom → Ursache → Fix]

## Nächste Features
[Was geplant ist]

## Build-Umgebung
Node.js, pbiviz-Version, Build-Befehl
```

---

## 13. SDD-Vorlage (Spec-Driven Development)

Diese Vorlage wird vom SDD-Interview (§0.0) ausgefüllt. Alle Abschnitte sind Pflicht – leere Felder sind nicht akzeptabel. Ein vollständig ausgefülltes SDD muss es ermöglichen, das Visual ohne Rückfragen neu zu bauen.

**Dateiname:** `VisualName_SDD.md`  
**Erstellt:** vor Gate 1 · **Aktualisiert:** nach jeder bestätigten Änderung

```markdown
# [VisualName] – Spezifikation (SDD)

**Version:** 1.0  
**Datum:** YYYY-MM-DD  
**Status:** [ ] Entwurf → [ ] Bestätigt (Gate 1) → [ ] Implementiert

---

## A – Zweck & Abgrenzung

### Was das Visual macht
[2–3 Sätze: welches Problem löst es, für wen, was ist der Kern-Output]

### Was es NICHT macht
- [Explizite Ausschlüsse, z.B. „kein Cross-Filter zwischen Visuals"]
- [„kein DAX", „kein Drill-Through", „keine Aggregation über mehrere Items"]

### Technologie
[ ] pbiviz (TypeScript + Power BI Custom Visual)
[ ] Web-App (.js + core.js, standalone HTML)

---

## B – Datenmodell

### pbiviz: Datenrollen
| Rolle (name) | Kind | Typ | Pflicht? | Beschreibung | Bedingung (max/min) |
|---|---|---|---|---|---|
| issueKey | Grouping | Text | ✅ | Eindeutiger Zeilenidentifier | – |
| [weitere] | | | | | |

### Web-App: Excel-Spalten
| Spaltenname | Typ | Pflicht? | Erkennungslogik | Fallback wenn fehlt |
|---|---|---|---|---|
| Jira-ID | Text | ✅ | Name exakt | Visual zeigt Fehlermeldung |
| [weitere] | | | | |

### Datumsstrategie (pbiviz)
[ ] Einzelne Datumsspalte → `kind: Grouping + max: 1` (keine Hierarchie)
[ ] Mehrere Datumsspalten → `kind: Measure + issueKey als Grouping` (§4.6)
[ ] Nicht anwendbar (Web-App / kein Datum)

Begründung: [warum diese Strategie?]

---

## C – UX & Layout

### Hauptbereiche (ASCII-Sketch)
```
┌─────────────────────────────────────────┐
│  [Diag-Bar / Diagnosezeile oben]        │
├─────────────────────────────────────────┤
│  [Bereich 1: z.B. Y-Achse]             │
│                                         │
│  [Hauptbereich: Chart / Heatmap / etc.] │
│                                         │
│  [Bereich 3: z.B. X-Achse, Legende]    │
└─────────────────────────────────────────┘
```

### Interaktionen
| Aktion | Trigger | Effekt |
|---|---|---|
| Tooltip anzeigen | mouseover auf Datenpunkt | Tooltip mit [Felder] erscheint, boundary-safe |
| Tooltip ausblenden | mouseout (+ 120ms Delay wenn Link) | Tooltip display:none |
| Reihenfolge ändern | ▲/▼ im Panel | Reihenfolge wird gespeichert via persistProperties() |
| [weitere] | | |

### Leerzustand
[Was sieht der Nutzer wenn: keine Daten geladen / alle Items herausgefiltert / Pflicht-Spalte fehlt]

### Responsive-Verhalten
[Wie verändern sich Punkte/Balken/Zellen/Schrift wenn das Visual kleiner wird]

---

## D – Berechnungslogik

### Kern-Metriken
| Metrik | Formel | Einheit | Besonderheiten |
|---|---|---|---|
| [Name] | `(endDate - startDate) / 86400000 + 1` | Tage | Inklusiv, Items mit Wert < 1 ausgeschlossen |
| [weitere] | | | |

### Filter- & Aggregationslogik
[Welche Items werden ausgeschlossen? Welche Bedingungen müssen erfüllt sein?]
[z.B. „Nur Items mit In Progress_first gefüllt UND Resolved leer (= aktive WIP-Items)"]

### Edge Cases
| Situation | Verhalten |
|---|---|
| Item ohne Pflicht-Datum | Wird übersprungen, N sinkt, Diag-Hinweis |
| Leere Gruppe / Status | [Gruppe wird ausgeblendet / als leer angezeigt / ...] |
| `Math.max()` auf leerem Array | Abgesichert: `values.length ? Math.max(...values) : 0` (§4.3) |
| Negativer Wert | [ausschließen / als 0 werten / anzeigen] |
| [weitere] | |

---

## E – Config / Format-Panel

### Alle Properties
| Property | Typ | Default | Min | Max | Effekt | Validierung |
|---|---|---|---|---|---|---|
| showDiag | Toggle | true | – | – | Diagnosemodus ein/aus | – |
| [weitere] | | | | | | |

### Storage (Web-App)
localStorage-Key: `fhwa_[visualId]`  
Gespeicherter State: `{ [property]: [Typ], ... }`

---

## F – Design-Standards (§9-Pflichtcheck)

| Standard | Entscheidung | Details |
|---|---|---|
| Tooltip boundary-safe | ✅ Pflicht | positionTooltip() mit Overflow-Prüfung (§9.3) |
| Tooltip mit Links | [ja / nein] | Hover-Delay 120ms + pointerEvents: all (§4.9) |
| N-Anzeige | ✅ Pflicht | Position: [unter Kategorie / oben links / in Zelle / ...] (§9.4) |
| Reihenfolge-Panel | [ja / nicht benötigt] | ▲/▼ + Drag, persistiert (§9.1) |
| Skalierung | ✅ Pflicht | [Formel: Math.max(3, Math.min(8, pW/100)) * (cfg.dotSize/4)] (§9.5) |
| Diagnosemodus | ✅ Pflicht, Standard: an | Position: oben, Inhalt: [N, Spalten, Zustände, ...] (§9.2) |
| Icon (pbiviz) | [Motiv beschreiben] | [Farben, Formen, Hintergrund] (§9.6) |
| Link-Feature | [ja: issueUrl + urlTemplate / nicht benötigt] | launchUrl() vs. window.open() (§9.7) |
| innerHTML | ❌ Verboten | Nur DOM-API: createElement/textContent (§4.7) |
| Dark/Light Theme | [CSS-Variablen / core.scatterColors() / nicht anwendbar] | |

---

## G – Akzeptanzkriterien

Diese Punkte müssen beim manuellen Test in Power BI / Browser alle bestanden werden.

### Automatisch von Claude prüfbar (beim Build)
- [ ] `pbiviz package` ohne Errors
- [ ] Kein `innerHTML` im Code
- [ ] capabilities.json ↔ settings.ts vollständig synchron
- [ ] Version 4-teilig (MAJOR.MINOR.PATCH.BUILD)

### Manuell durch Oliver zu testen
- [ ] Tooltip bleibt vollständig sichtbar an allen 4 Ecken des Visuals
- [ ] Config-State überlebt Power BI Report-Neuöffnung / Browser-Reload
- [ ] Bei 0 Datenzeilen: Diagnosemeldung sichtbar, kein JS-Error in Console
- [ ] Visual auf 200px Breite → Elemente skalieren proportional (kein Überlappen)
- [ ] [weiterer projektspezifischer Test]
- [ ] [weiterer projektspezifischer Test]

---

## Änderungshistorie

| Datum | Version | Änderung | Bestätigt von |
|---|---|---|---|
| YYYY-MM-DD | 1.0 | Initiale Spec nach SDD-Interview | Oliver |
| | | | |
```

---

## 14. Web App – build.py Bundling-Fallen

`build.py` bündelt die ES-Modul-Dateien (`core.js`, `heatmap.js`, `scatter.js`, …) in eine einzelne `FlowAnalytics.html` für SharePoint/OneDrive (wo `type="module"` Scripts nicht funktionieren).

### Was build.py tut (und was es nicht tut)

`strip_module_syntax()` entfernt:
- Zeilen die mit `import ` beginnen (komplette Zeile)
- `export ` Präfix vor `const`, `let`, `var`, `function`, `class`, `async function`

`strip_module_syntax()` entfernt **nicht:**
- `export default` → Build-Fehler oder Laufzeitfehler
- `export { x, y }` → bleibt als ungültiger Code stehen
- `export { x } from './module'` → Re-Exports bleiben stehen
- `import()` dynamische Imports → bleiben stehen

**Regel:** In `.js`-Dateien nur `export const/function/class` und `import ... from` verwenden. Kein `export default`, keine Re-Exports.

### `init()` Namenskonvention – Pflicht

`build.py` benennt die `init()`-Funktion jeder Visual-Datei um um Kollisionen zu vermeiden:

```python
heatmap_out = heatmap_out.replace('function init()', 'function init_heatmap()', 1)
scatter_out = scatter_out.replace('function init()', 'function init_scatter()', 1)
```

**Zwei Bedingungen die erfüllt sein müssen:**
1. Die Funktion muss exakt `function init()` heißen – nicht `async function init()`, nicht `const init = () =>`
2. `replace(..., 1)` ersetzt nur die **erste** Vorkommen – `init()` darf im Code nur einmal als Funktionsdeklaration erscheinen

**Fehler wenn Konvention verletzt wird:** Alle Aufrufe im Bootstrap landen bei der falschen `init()`-Funktion oder gar keiner – das Visual lädt ohne Fehlermeldung nicht.

### Neues Visual hinzufügen – zwei Stellen aktualisieren

Wenn ein neues Visual (z.B. `boxchart.js`) hinzukommt, müssen **beide** Dateien angepasst werden:

**`index.html`** (für Entwicklung mit ES-Modulen):
```javascript
import { init as initBoxChart } from './boxchart.js';
// ...
initBoxChart();
```

**`build.py`** (für Bundle-Distribution) – zwei Stellen:
```python
# Stelle 1: Datei einlesen
boxchart_js = read('boxchart.js')

# Stelle 2: Transformieren + umbenennen
boxchart_out = strip_module_syntax(boxchart_js)
boxchart_out = boxchart_out.replace('function init()', 'function init_boxchart()', 1)

# Stelle 3: In gebündeltes JS aufnehmen
bundled_js = (
    "// ── core.js ──\n" + core_out + "\n\n" +
    "// ── heatmap.js ──\n" + heatmap_out + "\n\n" +
    "// ── scatter.js ──\n" + scatter_out + "\n\n" +
    "// ── boxchart.js ──\n" + boxchart_out + "\n\n" +  # ← neu
    "// ── Bootstrap ──\n" + bootstrap + "\n"
)

# Stelle 4: Bootstrap-Aufruf ergänzen
bootstrap = (
    "  init_heatmap();\n"
    "  init_scatter();\n"
    "  init_boxchart();\n"   # ← neu
    "  core.initApp();"
)
```

**Fehler der Vergangenheit:** Neue Visual-Datei in `index.html` eingetragen aber `build.py` vergessen → Das gebündelte `FlowAnalytics.html` lud das neue Visual nicht.

### build.py ausführen – wann und warum

`build.py` nur für **Distribution** (SharePoint/OneDrive ohne HTTPS-Modul-Support). Für lokale Entwicklung und SharePoint-Ordner mit HTTPS immer die ES-Modul-Version (einzelne `.js`-Dateien + `index.html`) verwenden – sie ist debuggbar und lädt schneller.

```bash
python build.py
# Ausgabe: FlowAnalytics.html (X.X KB)
# Diese Datei übergeben wenn Bundle benötigt wird.
```

---

*Zuletzt aktualisiert: §2 (pbiviz new Setup-Checkliste), §4.4 (ES-Target-Tabelle), §4.10 (update() Null-Safety), §4.11 (DataViewMapping), §9.1 (persistProperties Beispiel), §14 (Web App build.py). SDD-Workflow + Bugfix-Ergänzungen – §0.7 (M5 Web App + SDD-Update-Regel), §10 Phase 4 (Fehlerbehebung-Checkliste). SDD-Workflow – §0.0, §0.1, §13. CycleTime Scatterplot v2.1 – §4.7–4.9, §9.6, §9.7. LeadTime BoxChart, WIPAge Chart v1.4, CycleTime Scatterplot v2.1, FlowHeatmap v1.7 — Autor: Oliver Wolter*
