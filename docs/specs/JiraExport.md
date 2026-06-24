# Spec: Jira Export (export_jira.py)

**Version:** 1.0  
**Datum:** 2026-06-24  
**Status:** Entwurf  
**Datei:** `tools/export_jira.py`  
**Ausgabe:** `flowdata.json` (Eingabe für das Dashboard)

---

## Block A – Zweck & Abgrenzung

### A.1 Zweck

Ersetzt die Power Query Pipeline aus der Excel-Analyse-Datei vollständig.  
Das Script fragt die Jira REST API direkt ab, transformiert die Daten und schreibt eine
`flowdata.json`, die sofort ins Dashboard geladen werden kann.

**Problem das gelöst wird:** Power Query in Excel bricht bei großen Datenmengen ab oder läuft
sehr lange. Das Python-Script ist stabiler, wiederholbar und unabhängig von Excel.

### A.2 Abgrenzung

- Erzeugt **nur** `JiraStories`, `JiraEpics`, `JiraBlockermanagement` – kein `Happiness Faktor`  
  (der Happiness Faktor wird weiterhin manuell gepflegt und bleibt ein separates Sheet)
- Kein Lesen von Excel-Dateien
- Kein Schreiben in Jira (read-only)
- Keine Authentifizierung per Browser/OAuth – nur Basic Auth oder API-Token

### A.3 Kontext

Dieses Script ist **Stufe 2** der in `docs/Analyse_JSON_Migration.md` beschriebenen Migration.
Stufe 1 (Dashboard auf JSON umstellen) ist Voraussetzung für den produktiven Einsatz.

---

## Block B – Konfiguration

### B.1 Umgebungsvariablen (Pflicht)

| Variable | Bedeutung | Beispiel |
|---|---|---|
| `JIRA_URL` | Basis-URL der Jira-Instanz | `https://jiraws.axa.com` |
| `JIRA_USER` | Jira-Benutzername | `max.mustermann@axa.de` |
| `JIRA_TOKEN` | API-Token oder Passwort | `abc123xyz` |

Empfehlung: `.env`-Datei im Projektordner (nicht ins Git committen, steht in `.gitignore`):

```
JIRA_URL=https://jiraws.axa.com
JIRA_USER=max.mustermann@axa.de
JIRA_TOKEN=mein-api-token
```

### B.2 Projektliste (Pflicht, im Script anpassen)

Die Konstante `PROJECTS` am Anfang von `tools/export_jira.py` entspricht der
`jiraProjectsTable` in Excel:

```python
PROJECTS = [
    {"Project": "PROJ-A", "Modifier": "component = 'MyComponent'", "Squad": "Team Alpha"},
    {"Project": "PROJ-B", "Modifier": "",                          "Squad": "Team Beta"},
]
```

| Feld | Typ | Bedeutung |
|---|---|---|
| `Project` | string | Jira-Projekt-Key (exakt wie in Jira) |
| `Modifier` | string | Optionaler JQL-Zusatz (leer = kein Zusatz) |
| `Squad` | string | Squad-Bezeichnung, erscheint in allen Output-Spalten |

### B.3 Weitere Konstanten

| Konstante | Default | Bedeutung |
|---|---|---|
| `PAGE_SIZE` | `500` | Issues pro API-Seite (Jira-Maximum) |
| `JQL_RESOLVED_WINDOW` | `startOfMonth(-52w)` | Zeitfenster für erledigte Stories |
| `OUTPUT_PATH` | `flowdata.json` | Ausgabepfad (überschreibbar per `--output`) |

---

## Block C – Datenfluss

### C.1 Übersicht der Transformations-Schichten

```
jiraProjectsTable (PROJECTS-Konstante)
        │
        ├─── SRC_Jira_Base_Epics          ─┐
        ├─── SRC_Jira_History_Epics           │  4× API-Abruf
        ├─── SRC_Jira_Base_Projects           │  (paginiert)
        └─── SRC_Jira_History_Stories      ─┘
                     │
        ┌────────────┴────────────┐
        │ STG I – JSON entpacken  │
        │  Epics_Base             │
        │  Stories_Base           │
        └────────────┬────────────┘
                     │ (Changelog-Daten)
        ┌────────────▼────────────┐
        │ STG II – Entfalten      │
        │  Issues_ChangelogFlat   │  1 Zeile = 1 Feldänderungs-Event
        └─────────┬───────────────┘
                  │
        ┌─────────▼──────────┐   ┌───────────────────────┐
        │ STG III – Filtern  │   │ (Blocked-Pfad)        │
        │  StatusHistory     ├───► BlockedFieldHistory    │
        └────────┬───────────┘   └──────────┬────────────┘
                 │                           │
        ┌────────▼────────────────┐  ┌──────▼─────────────────┐
        │ STG IV/V – Aggregieren  │  │ STG IV – Kontext-Join  │
        │  Epics_StatusPivot      │  │  BlockedHistory         │
        │  Stories_StatusAgg      │  └──────────┬─────────────┘
        └────────┬────────────────┘             │
                 │                              │
        ┌────────▼──────────────────────────────▼────────┐
        │                 OUTPUT                          │
        │  JiraEpics  ·  JiraStories  ·  JiraBlocker     │
        └────────────────────┬────────────────────────────┘
                             │
                      flowdata.json
```

### C.2 SRC-Schicht: API-Abruf

Alle 4 Abruf-Funktionen rufen intern `_fetch_all(jql, fields, expand_changelog)` auf.
Diese Funktion paginiert automatisch bis alle Issues abgerufen sind.

| Funktion | Typen | Changelog | Modifier/Squad |
|---|---|---|---|
| `fetch_epics_base` | Epic | Nein | Ja – je Modifier+Squad |
| `fetch_epics_history` | Epic | Ja | Nein – je Projekt |
| `fetch_stories_base` | Story, Task, Bug | Nein | Ja – je Modifier+Squad |
| `fetch_stories_history` | Story, Task, Bug | Ja | Nein – je Projekt |

**Wichtig:** `fetch_epics_history` und `fetch_stories_history` fragen je Projekt nur
einmal ab (ohne Modifier), weil das Changelog projektübergreifend gültig ist.

### C.3 STG-Schicht: Transformationen

**STG_Issues_ChangelogFlat** ist die zentrale Zwischentabelle.  
Der Changelog (verschachteltes JSON: `histories → items`) wird vollständig entfaltet.  
Jede Zeile entspricht einem einzelnen Feldänderungs-Event.

**Buffer-Optimierung** gegenüber Power Query:  
Der entfaltete Changelog wird **einmal** berechnet und dann an beide Zweige
(StatusHistory und BlockedFieldHistory) übergeben. In Power Query war dies der
primäre Performance-Engpass (kein Buffer → doppelte API-Abrufe).

**STG_Stories_StatusAgg** kombiniert zwei Pivot-Tabellen:
- `StatusEntries`: wann ein Status betreten wurde (`Status`, `Status_first`, `Status_Count`)
- `StatusLeaves`: wann ein Status verlassen wurde (`leaving_Status`, `leaving_Status_first`)

### C.4 Korrekturen gegenüber Power Query

| Problem | Lösung in Python |
|---|---|
| Fehlender Buffer → doppelte API-Abrufe | Changelog einmal berechnen, weitergeben |
| `NormalizeDateTime` doppelt definiert | Einmal als `_parse_dt()` |
| `STG_Blocked_FieldHistory` (toter Code) | Nicht implementiert |
| Encoding-Bug: `Gelöst` korrumpiert | `_STATUS_MAP` mit korrektem Unicode |
| Code-Duplikat SRC-Abfragen | Einheitliche `_fetch_all()`-Funktion |

---

## Block D – JSON-Ausgabeformat

### D.1 Top-Level-Struktur

```json
{
  "meta": {
    "exportDate": "2026-06-24T08:30:00.000000Z",
    "source": "Jira",
    "version": "1"
  },
  "sheets": {
    "JiraStories":          [ ... ],
    "JiraEpics":            [ ... ],
    "JiraBlockermanagement": [ ... ]
  }
}
```

Die `meta`-Ebene ist für Visuals unsichtbar (nur `data.sheets` wird geladen).
Sie kann im Upload-Screen angezeigt werden (`exportDate` = Aktualitätsinfo).

### D.2 JiraStories – Spalten

Alle Spalten aus der Power Query `JiraStories`-Abfrage, exakt beibehalten:

**Kopfspalten (immer vorhanden):**

| Spaltenname | Typ | Quelle |
|---|---|---|
| `Jira-ID` | string | issue.key |
| `project.key` | string | fields.project.key |
| `project.name` | string | fields.project.name |
| `Issue-Type` | string | fields.issuetype.name |
| `Created (Status New)` | ISO datetime / null | fields.created |
| `Blockiert/Wartend` | string / null | customfield_23623.value |
| `Issue-Status` | string | fields.status.name |
| `Status-Kategorie` | string | fields.status.statusCategory.name |

**Status-Zeitstempel (dynamisch, je nach Daten):**

Für jeden Status der im Changelog vorkommt entstehen 5 Spalten:

| Muster | Beispiel | Bedeutung |
|---|---|---|
| `{Status}` | `In Progress` | Letzter Eintrittszeitpunkt |
| `{Status}_first` | `In Progress_first` | Erster Eintrittszeitpunkt |
| `leaving_{Status}_first` | `leaving_In Progress_first` | Erstes Verlassen |
| `leaving_{Status}` | `leaving_In Progress` | Letztes Verlassen |
| `{Status}_Count` | `In Progress_Count` | Wie oft eingetreten (integer) |

Alle Datumsspalten: ISO 8601 String oder `null`. Nie leerer String.

**Berechnete Spalten:**

| Spaltenname | Typ | Formel |
|---|---|---|
| `Blockiert/Wartend_Zustand` | string / null | Text vor erstem ` - ` in `Blockiert/Wartend` |
| `Blockiert/Wartend_Grund` | string / null | Text nach erstem ` - ` |
| `TimeInStatusBlocked` | number / null | Blocked-Zeit aus customfield_11821 (Tage) |
| `LeadTime` | integer / null | `Resolved − Ready4Progress_first + 1` (nur wenn Resolved) |
| `CycleTime` | integer / null | `Resolved − In Progress_first + 1` (nur wenn Resolved) |
| `TimeInWIP` | integer / null | `heute − In Progress_first + 1` (nur wenn in Bearbeitung) |
| `TimeInActualStatus` | integer / null | `heute − {AktuellerStatus}_first + 1` |
| `Squad` | string | aus PROJECTS |
| `Modifier` | string | aus PROJECTS |
| `LoadedFromJiraAt` | ISO datetime | Zeitpunkt des Script-Laufs |

### D.3 JiraEpics – Spalten

| Spaltenname | Quelle |
|---|---|
| `Jira-ID` | issue.key |
| `Kurzbeschreibung` | fields.summary |
| `Stage` | customfield_19320.value |
| `Created (Status New)` | fields.created |
| `Issue-Status` | fields.status.name |
| `Status-Kategorie` | fields.status.statusCategory.name |
| `EPIC-Kategorie` | customfield_17726.value |
| `Akzeptanzkriterien` | customfield_11720 |
| `project.key` | fields.project.key |
| `project.name` | fields.project.name |
| `Squad` | aus PROJECTS |
| Status-Zeitstempel | aus STG_Epics_StatusPivot (dynamisch) |
| `LoadedFromJiraAt` | Zeitpunkt des Script-Laufs |

### D.4 JiraBlockermanagement – Spalten

| Spaltenname | Typ | Bedeutung |
|---|---|---|
| `issues.key` | string | Jira Issue-Key |
| `Status` | string | Aktueller Workflow-Status |
| `Squad` | string | Squad-Zuordnung |
| `Modifier` | string | JQL-Modifier |
| `BlockedStart` | ISO datetime | Beginn der Blocked-Episode |
| `BlockedEnd` | ISO datetime / null | Ende der Episode (null = noch offen) |
| `BlockedReason` | string | Kombination aus Zustand und Grund |
| `BlockedSeq` | integer | Laufende Nummer je Issue+Status |
| `BlockedDurationHours` | number / null | Episodendauer in Stunden |
| `Blockiert/Wartend_Zustand` | string / null | z.B. "Blockiert" oder "Wartend" |
| `Blockiert/Wartend_Grund` | string / null | z.B. "Dependency" |
| `Wie oft in Blocked` | integer | Anzahl Episoden für dieses Issue |
| `BlockiertWartendSeit` | integer / null | Tage seit Beginn der Episode |
| `LoadedFromJiraAt` | ISO datetime | Zeitpunkt des Script-Laufs |

### D.5 Konventionen (aus Analyse_JSON_Migration.md)

- Datumswerte immer als ISO 8601 String: `"2026-05-01T09:30:00"`
- Fehlende Werte immer als `null`, nie als `""` oder fehlendes Feld
- Spaltennamen exakt beibehalten (Sonderzeichen wie `/`, `_`, Leerzeichen)
- `_Count`-Spalten sind Integer, keine Floats

---

## Block E – Fehlerbehandlung

| Situation | Verhalten |
|---|---|
| Jira API nicht erreichbar | Fehlerlog + leere Liste für dieses Projekt; Script läuft weiter |
| Eine Seite schlägt fehl | Fehlerlog; restliche Seiten werden noch abgerufen |
| Projekt existiert nicht | Jira gibt 0 Treffer zurück; kein Fehler |
| `JIRA_USER` / `JIRA_TOKEN` fehlen | Script bricht mit Fehlermeldung ab (Exit 1) |
| Unbekannte JSON-Struktur | `_extract_value()` / `_parse_dt()` geben `None` zurück; kein Crash |
| Changelog-Feld fehlt | Leere Tabellen; Spalten werden nicht erzeugt |
| `TimeInStatusBlocked` nicht parsebar | `None`; kein Crash |

**Alle Transformationen verwenden defensive Patterns:**  
`try/except` in Hilfsfunktionen, `.get()` statt direktem Dict-Zugriff,
`MissingField.Ignore`-Äquivalent via `errors='ignore'` in pandas.

---

## Block F – Betrieb

### F.1 Installation

```bash
pip install requests pandas
```

Optional für `.env`-Support:
```bash
pip install python-dotenv
```

Dann am Anfang von `export_jira.py` aktivieren:
```python
from dotenv import load_dotenv
load_dotenv()
```

### F.2 Aufruf

```bash
# Standard: flowdata.json im aktuellen Verzeichnis
python tools/export_jira.py

# Abweichender Ausgabepfad
python tools/export_jira.py --output "D:/Dashboard/flowdata.json"

# Konfiguration prüfen (kein API-Aufruf)
python tools/export_jira.py --dry-run
```

### F.3 Typischer Ablauf

```
[08:30:00] SRC_Jira_Base_Epics – Epics (aktuell)...
[08:30:00]   Projekt: PROJ-A
[08:30:01]   Seite 1/2 — 500/850 Issues
[08:30:02]   Seite 2/2 — 850/850 Issues
...
[08:32:10] JiraStories – finale Tabelle bauen...
[08:32:11] JSON erzeugen...
════════════════════════════════════════════════════════════
✓ Export abgeschlossen → flowdata.json
  JiraStories: 1243 Zeilen
  JiraEpics: 87 Zeilen
  JiraBlockermanagement: 312 Zeilen
════════════════════════════════════════════════════════════
```

### F.4 Nach dem Export

Die `flowdata.json` wird wie bisher die Excel-Datei per Datei-Picker ins Dashboard geladen.  
Nach der Stufe-1-Migration (Dashboard auf JSON umstellen) ersetzt sie die `.xlsx`-Datei
vollständig.

---

## Block G – Akzeptanzkriterien

| # | Kriterium | Prüfung |
|---|---|---|
| G1 | `flowdata.json` ist valides JSON | `python -c "import json; json.load(open('flowdata.json'))"` |
| G2 | `meta.exportDate` vorhanden und ISO-Format | Manuell prüfen |
| G3 | `sheets.JiraStories` enthält alle Issues mit korrekten Spalten | Stichprobe gegen Jira UI |
| G4 | `sheets.JiraEpics` enthält `Jira-ID`, `Stage`, `Akzeptanzkriterien`, `Squad` | Stichprobe |
| G5 | `sheets.JiraBlockermanagement` enthält `BlockedStart`, `BlockedEnd`, `Wie oft in Blocked` | Stichprobe |
| G6 | Datumswerte sind ISO-Strings, keine Excel-Serials | Prüfe `Created (Status New)` |
| G7 | Fehlende Werte sind `null`, nicht `""` | JSON-Inspektion |
| G8 | `LeadTime`, `CycleTime` stimmen für ein bekanntes Issue | Manuell nachrechnen |
| G9 | `In Progress_first` = frühestes Eintrittsdatum aus dem Changelog | Stichprobe |
| G10 | Paginierung: Issues > 500 je Projekt vollständig | Zählung vs. Jira UI |
| G11 | `--dry-run` gibt Konfiguration aus und endet ohne API-Aufruf | Manuell |
| G12 | Fehlende Umgebungsvariablen → Exit 1 mit Fehlermeldung | Test ohne Vars |
| G13 | API-Fehler auf einer Seite → Script läuft weiter, Fehler wird geloggt | Netzwerk trennen |
| G14 | `TimeInStatusBlocked` = `null` wenn Feld nicht parsebar | Issue ohne customfield_11821 |
| G15 | Dashboard akzeptiert die JSON (nach Stufe-1-Migration) | End-to-End-Test |

---

## Block H – Abhängigkeiten

### H.1 Python-Pakete

```
requests>=2.28
pandas>=1.5
```

Python-Version: 3.9+

### H.2 Nicht benötigt

- `openpyxl` / SheetJS: kein Excel-Schreiben
- `dateutil`: pandas Timestamp verarbeitet ISO-Strings direkt
- SQL-Datenbank: alle Transformationen in-memory mit pandas

### H.3 Jira-Zugriff

- Jira REST API v2: `/jira/rest/api/2/search`
- Basic Auth mit Username + API-Token (oder Passwort)
- Berechtigungen: Lesezugriff auf alle konfigurierten Projekte

### H.4 Zusammenspiel mit anderen Dateien

| Datei | Beziehung |
|---|---|
| `docs/Analyse_JSON_Migration.md` | Definiert das JSON-Schema (Stufe 2 dieser Migration) |
| `tools/create_testdata.py` | Erzeugt `testdata.json` – muss nach Stufe-1-Migration auf JSON-Format umgestellt werden |
| `src/core.js` | Konsumiert `flowdata.json` via `data.sheets` (nach Stufe-1-Migration) |

---

## Änderungshistorie

| Version | Datum | Beschreibung |
|---|---|---|
| 1.0 | 2026-06-24 | Initiale Spec – abgeleitet aus Power Query M-Code Analyse (Excel-Datei Team-Dashboard_Mindestmetrikenset_1.411_Analyse.xlsx) |
