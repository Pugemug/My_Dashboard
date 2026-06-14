# Analyse: Excel → JSON Migration

**Datum:** 2026-06-14  
**Autor:** Oliver Wolter (erarbeitet mit Claude)  
**Status:** Analyse / Entscheidungsgrundlage — kein Implementierungsauftrag

---

## Kontext: Das eigentliche Problem

Der Schmerzpunkt ist nicht das Dateiformat, sondern die **PowerQuery → Excel Pipeline**: Der Jira-Datenimport über PowerQuery in die Excel-Datei dauert sehr lange und bricht teilweise ab. Das ist der primäre Treiber dieser Migration.

**Rahmenbedingungen (aus Analyse-Interview):**
- JSON-Upload: Datei-Picker / Drag & Drop — wie heute Excel
- Migrations-Umfang: Vollständige Ablösung von Excel (kein Parallelbetrieb)
- Happiness Faktor Custom-Header: Normalisieren (Empfehlung, s. Abschnitt 2)

---

## 1. Notwendige Umstellungsarbeiten

### Minimaler Scope — 4 Dateien betroffen

**`src/core.js` — 3 Änderungen:**

**Änderung 1: `_loadFile()`** — SheetJS-Logik durch JSON.parse ersetzen

```javascript
// Heute:
const wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array', cellDates: true });
wb.SheetNames.forEach(sn => {
  sheets[sn]    = XLSX.utils.sheet_to_json(wb.Sheets[sn], { defval: null });
  sheetsRaw[sn] = XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, defval: null });
});

// Neu:
reader.readAsText(file);  // statt readAsArrayBuffer
const data = JSON.parse(e.target.result);
core.state.sheets = data.sheets;
// sheetsRaw entfällt (wenn Happiness Faktor normalisiert wird)
```

Die gesamte `_processData()`-Logik und alle Events bleiben unverändert.

**Änderung 2: `core.toDate(v)` — Kritische Lücke**

Die Funktion kennt heute nur `Date`-Objekte (SheetJS liefert diese via `cellDates: true`) und Zahlen (Excel-Serials). ISO-Strings aus JSON fallen durch zum `return null` am Ende → alle Datumsberechnungen wären *silent broken*:

```javascript
toDate(v) {
  if (!v) return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  if (typeof v === 'number') {
    // Excel-Serial → Date (bleibt als Fallback)
    const d = new Date(Math.round((v - 25569) * 86400000));
    return isNaN(d.getTime()) ? null : d;
  }
  // NEU: ISO-String-Branch für JSON-Daten
  if (typeof v === 'string') {
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}
```

> **Das ist die kritischste Einzeländerung der gesamten Migration.**  
> Ohne diesen Fix funktioniert jedes Visual — kein JS-Fehler, keine Warnung — aber alle Datumsberechnungen (CT, LT, WIPAge, Rolling Pace) liefern null.

**Änderung 3: `core.state.sheetsRaw` entfernen**

Kann vollständig entfallen, wenn Happiness Faktor normalisiert wird (s. Abschnitt 2). Betrifft nur `core.js` und `happiness.js`.

---

**`src/index.html` — 2 Zeilen:**

```html
<!-- Entfernen: -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"></script>

<!-- Ändern: -->
<input id="file-input" type="file" accept=".json">
```

---

**`tests/fixtures/`:**
- `testdata.xlsx` → `testdata.json` (gleiches Datenmodell, JSON-Format)
- Playwright E2E-Tests: Pfadverweise auf `.json` anpassen

---

**`tools/create_testdata.py`:**
- JSON statt xlsx erzeugen
- Dieselben Edge Cases abdecken (insb. `_first`-Spalten, Dual-Period-Logik, Rejected-Items, leere Sheets)

---

**Nicht berührt:**
`heatmap.js`, `scatter.js`, `wipage.js`, `boxchart.js`, `montecarlo.js`, `wip.js`, `flowefficiency.js`, `build.py`, alle Spec-Dateien — sofern die JSON-Struktur zu `core.state.sheets` kompatibel bleibt.

---

## 2. Notwendige JSON-Datenstruktur

### Top-Level-Struktur

```json
{
  "meta": {
    "exportDate": "2026-06-14T10:00:00Z",
    "source": "Jira",
    "version": "1"
  },
  "sheets": {
    "JiraStories": [ ... ],
    "Epics": [ ... ],
    "JiraBlockermanagement": [ ... ],
    "Happiness Faktor": [ ... ]
  }
}
```

`core.js` liest `data.sheets` direkt in `core.state.sheets` — ohne weiteren Transform. Die `meta`-Ebene ist für die Visuals unsichtbar, kann aber im Upload-Screen (`_buildDatencheckPage`) angezeigt werden.

---

### JiraStories (Pflicht-Sheet)

Alle Spaltennamen **exakt beibehalten** — inkl. Sonderzeichen wie `Blockiert/Wartend_Zustand`, Unterstriche, Leerzeichen. Datumswerte als **ISO 8601 Strings**, leere Felder als `null`:

```json
[
  {
    "Jira-ID": "PROJ-123",
    "Issue-Type": "Story",
    "Squad": "Alpha",
    "Issue-Status": "In Progress",
    "In Progress_first": "2026-05-01T00:00:00.000Z",
    "Ready4Progress_first": "2026-04-28T00:00:00.000Z",
    "Resolved": null,
    "Rejected": null,
    "leaving_In Progress": null,
    "In Progress": "2026-05-10T00:00:00.000Z"
  }
]
```

---

### Epics (optional)

```json
[
  {
    "Epic-ID": "PROJ-1",
    "Quartal": "Q1/2026",
    "Status": "Done",
    "Geplant": 1,
    "Abgeschlossen": 1
  }
]
```

---

### JiraBlockermanagement (optional)

```json
[
  {
    "issues.key": "PROJ-123",
    "Squad": "Alpha",
    "BlockiertWartendSeit": 3.5,
    "Blockiert/Wartend_Zustand": "Blocked",
    "Blockiert/Wartend_Grund": "Dependency",
    "BlockedStart": "2026-05-03T00:00:00.000Z",
    "BlockedEnd": "2026-05-06T12:00:00.000Z"
  }
]
```

---

### Happiness Faktor — Empfehlung: Normalisieren

**Option B2 (1:1 als 2D-Array beibehalten):**  
Würde `core.state.sheetsRaw` und den Custom-Header-Suchcode in `happiness.js` unverändert lassen. Der Custom-Header (Daten starten nicht in Zeile 1) ist jedoch ein **Excel-Artefakt** — in JSON gibt es keinen Grund dafür.

**Option B1 (normalisieren) — Empfohlen:**  
Das Export-Script löst den Header-Lookup einmalig auf und speichert fertige Objekte. `happiness.js` muss einmalig leicht angepasst werden (sheetsRaw → sheets, Header-Suche entfällt):

```json
"Happiness Faktor": [
  { "Schlüsselwert": "Alpha", "2026-01": 4, "2026-02": 3, "2026-03": 5 },
  { "Schlüsselwert": "Beta",  "2026-01": 3, "2026-02": 4, "2026-03": 4 }
]
```

**Konsequenz der Normalisierung:** `core.state.sheetsRaw` kann komplett aus `core.js` entfernt werden. Langfristig sauberer, da ein Excel-Workaround verschwindet.

---

## 3. Was für zukünftige Erweiterungen beachtet werden muss

**`meta`-Block ist Pflicht:**  
`exportDate` zeigt dem Nutzer wie aktuell die Daten sind (kann im Upload-Screen angezeigt werden). `version` ermöglicht spätere Schemaänderungen ohne Breaking Changes in alten Export-Scripts.

**Konsistente Null-Darstellung:**  
Immer `null`, nie leerer String `""` oder fehlendes Feld. Heute liefert SheetJS durch `defval: null` genau das — das Export-Script muss das spiegeln. Die Visuals prüfen `r['Resolved'] != null`, nicht `r['Resolved']` — ein leerer String würde als "gesetzt" gelten.

**Spaltennamen einfrieren:**  
Die JSON darf Spaltennamen nicht umbenennen oder vereinheitlichen. Jede Umbenennung bricht potenziell mehrere Visuals, da die Erkennungslogik auf exakten String-Matches basiert (z.B. `leaving_`-Präfix, `_first`-Suffix, `META_COLS`-Ausschlussliste in `heatmap.js`).

**Jira Export Script ist die eigentliche Lösung:**  
Das PowerQuery-Problem löst sich nicht durch das Format allein. Ein `tools/export_jira.py` das direkt die Jira REST API abfragt und `flowdata.json` schreibt, wäre der echte Gewinn. Kein Excel, kein PowerQuery, keine Timeouts.

**Testfixtures parallel validieren:**  
`testdata.json` muss dieselben Edge Cases abdecken wie heute `testdata.xlsx`: `_first`-Spalten-Szenarien, Dual-Period-Logik, Rejected-Items, fehlende optionale Sheets. Nach der Migration: Vitest + Playwright einmal vollständig durchlaufen lassen.

**Neues Sheet eintragen:**  
Das generische `core.state.sheets`-Pattern bleibt erhalten — ein neues Sheet in der JSON wird automatisch ohne Core-Änderungen verfügbar. Kein Unterschied zum heutigen Excel-Verhalten.

---

## 4. Performance-Einschätzung

| Dimension | Excel (SheetJS) | JSON | Ergebnis |
|---|---|---|---|
| **Parsing-Zeit** | 200–800 ms (SheetJS, JS-Library) | 10–50 ms (nativer `JSON.parse`) | JSON 10–20× schneller |
| **CDN-Last** | ~1,2 MB SheetJS-Library | 0 — keine externe Library | JSON gewinnt |
| **Dateigröße (Upload)** | ~50–300 KB (.xlsx komprimiert) | ~150–600 KB (unkomprimiertes JSON) | Excel kleiner (2–3×) |
| **Offline-Fähigkeit** | CDN-Abhängigkeit | Vollständig offline-fähig | JSON gewinnt |
| **SharePoint-Restriktionen** | CDN-URL könnte geblockt sein | Kein Risiko | JSON gewinnt |
| **Debugging** | Binärformat — nicht lesbar | Plaintext — direkt im Editor prüfbar | JSON gewinnt |

**Zur Dateigröße:** Bei Upload-Szenario (lokale Datei, kein Netzwerk) ist die 2–3× größere Dateigröße irrelevant. Selbst 1 MB JSON ist in unter 100 ms geladen und geparst. Wenn Größe je ein Problem wird: `JSON.gz` wäre sogar kleiner als `.xlsx`.

**Fazit:** JSON gewinnt in allen relevanten Dimensionen für diesen Use-Case.

---

## 5. Alternativen zu JSON

### Formate die "neben dem Dashboard" liegen

| Format | Mechanismus | Umbauaufwand | Bewertung |
|---|---|---|---|
| **JSON** (Upload) | Datei-Picker wie heute, `JSON.parse` | Gering | ✅ Empfohlen |
| **CSV** (mehrere Dateien) | Separater Upload pro Sheet oder feste Pfade per `fetch()` | Mittel | ❌ Kein Mehrwert, mehr Komplexität |
| **SQLite** (sql.js CDN) | Eine `.db` Datei, SQL-Queries statt Array-Iterationen | Sehr groß — alle Visuals müssten umgebaut werden | ❌ Overkill, Library größer als SheetJS |
| **Jira REST API** (fetch direkt) | Browser-HTTP-Requests direkt zu Jira | Groß + CORS-Problem + API-Key im Frontend | ❌ Technisch blockiert |
| **SharePoint Lists API** | SharePoint REST API im Browser | Sehr groß, starker SharePoint-Lock-in | ❌ Zu invasiv |
| **Excel + Python Export** | PowerQuery bleibt, Python erzeugt JSON als Zwischenschritt | Keiner (Brücke) | ⚠️ Nur als Übergangs-Option |

### Warum CSV nicht funktioniert

Multi-Sheet-Struktur der App (JiraStories, Epics, JiraBlockermanagement, Happiness Faktor) erfordert entweder mehrere CSV-Dateien (kein Single-File-Upload mehr) oder Konventionen wie `data_jira_stories.csv`. Das löst keines der Probleme und erzeugt neue.

### Warum Jira REST API direkt nicht funktioniert

SharePoint und Jira sind unterschiedliche Domains → CORS. Jira-Cloud erlaubt keine Cross-Origin-Requests ohne Server-seitigen Proxy. API-Keys im Frontend-Code wären ein Sicherheitsproblem. Nicht gangbar ohne Backend.

---

## Die eigentliche Empfehlung: Zweistufige Migration

Das Problem ist der **Export-Prozess**, nicht das Dashboard-Format. Die sauberste Lösung kombiniert beides:

**Stufe 1 — Dashboard auf JSON umstellen** (wenige Stunden Aufwand):
- `core.js`, `index.html`, `happiness.js` anpassen
- `testdata.json` erzeugen
- Vollständige Ablösung von Excel + SheetJS

**Stufe 2 — `tools/export_jira.py` schreiben** (separater Chat):
- Python-Script fragt direkt die Jira REST API ab (kein PowerQuery, kein Excel)
- Erzeugt `flowdata.json` im richtigen Format
- Nutzer führt Script aus → lädt JSON ins Dashboard
- PowerQuery-Timeout-Problem vollständig gelöst

Beide Stufen sind unabhängig voneinander und können in separaten Chats bearbeitet werden.

---

## Zusammenfassung

| Frage | Antwort |
|---|---|
| Umstellungsaufwand | Gering — 4 Dateien, ~50–80 Zeilen Code |
| Kritischste Einzelstelle | `core.toDate()` muss ISO-Strings verarbeiten (sonst silent broken) |
| Happiness Faktor | Normalisieren empfohlen — `sheetsRaw` komplett entfernen |
| Performance | JSON gewinnt in allen relevanten Dimensionen |
| Alternativen | Keine schlägt JSON für diesen Use-Case |
| Echter Hebel gegen PowerQuery-Pain | Jira Export Script (Python) als Stufe 2 |

---

*Erstellt: 2026-06-14 · Grundlage: Analyse-Chat mit Claude Sonnet 4.6*
