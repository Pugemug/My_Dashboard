# Jira → JSON Spalten-Mapping

**Datum:** 2026-06-26  
**Quelle:** `tools/export_jira.py` (abgeleitet aus Power Query M-Code der Analyse-Excel)  
**Ausgabe:** `flowdata.json` → Schlüssel `sheets.JiraStories / .JiraEpics / .JiraBlockermanagement`

---

## JiraStories

Basis-Abfrage: `issuetype in (Story, Task, Bug)` — Stories, Tasks und Bugs aller konfigurierten Projekte.

| Jira-Feld / Jira-Name | Ausgabe-Spalte | Bemerkung |
|---|---|---|
| `issue.key` | `Jira-ID` | |
| `fields.project.key` | `project.key` | |
| `fields.project.name` | `project.name` | |
| `fields.issuetype.name` | `Issue-Type` | `"Aufgabe"` → `"Task"` (Locale-Normalisierung) |
| `fields.created` | `Created (Status New)` | ISO-Timestamp |
| `fields.customfield_23623` (Blocked Reason) | `Blockiert/Wartend` | `.value` extrahiert aus Auswahl-Objekt |
| `fields.status.name` | `Issue-Status` | `"In Bearbeitung"` → `"In Progress"`, `"Gelöst"` → `"Resolved"` |
| `fields.status.statusCategory.name` | `Status-Kategorie` | `"In Arbeit"` → `"In Progress"`, `"Fertig"` → `"Done"`, `"Zu erledigen"` → `"To Do"` |
| Changelog: `toString` letzter Eintritt | `[StatusName]` | z. B. `In Progress`, `Ready4Test`, `Resolved` … — letzter Zeitstempel |
| Changelog: `toString` erster Eintritt | `[StatusName]_first` | z. B. `In Progress_first` — frühester Zeitstempel |
| Changelog: Anzahl Eintritte | `[StatusName]_Count` | z. B. `In Progress_Count` — wie oft Status betreten |
| Changelog: `fromString` letzter Austritt | `leaving_[StatusName]` | z. B. `leaving_In Progress` — letzter Zeitstempel beim Verlassen |
| Changelog: `fromString` erster Austritt | `leaving_[StatusName]_first` | z. B. `leaving_In Progress_first` — frühester Zeitstempel |
| `Blockiert/Wartend` geteilt bei `" - "`, Teil vor Trennzeichen | `Blockiert/Wartend_Zustand` | z. B. `"Blocked"` |
| `Blockiert/Wartend` geteilt bei `" - "`, Teil nach Trennzeichen | `Blockiert/Wartend_Grund` | z. B. `"Dependency"` |
| `fields.customfield_11821` (Time in Status) | `TimeInStatusBlocked` | Parsed: `"\|*_10290_*:*_N_*\|"` → Centiseconds ÷ 8.640.000 = Tage (10290 = Blocked-Status-ID) |
| Berechnet | `LeadTime` | `days(Resolved − Ready4Progress_first) + 1` — nur wenn `Issue-Status = Resolved` |
| Berechnet | `CycleTime` | `days(Resolved − In Progress_first) + 1` — nur wenn `Issue-Status = Resolved` |
| Berechnet | `TimeInWIP` | `days(heute − In Progress_first) + 1` — nur bei aktiven Issues (nicht Resolved/Rejected) |
| Berechnet | `TimeInActualStatus` | `days(heute − [Issue-Status]_first) + 1` — nur bei aktiven Issues |
| `projects.yaml` → `squad` | `Squad` | Manuell konfiguriert je Projekt |
| `projects.yaml` → `modifier` | `Modifier` | JQL-Zusatzbedingung (z. B. Sprint-Filter) |
| Python-Laufzeit | `LoadedFromJiraAt` | Zeitstempel des Exports |

> **Statusblöcke** werden dynamisch aus dem Changelog aller abgerufenen Issues erzeugt.
> Welche Status-Namen erscheinen, hängt von den tatsächlich vorhandenen Jira-Übergängen ab.

---

## JiraEpics

Basis-Abfrage: `issuetype in (Epic)` — Epics aller konfigurierten Projekte.

| Jira-Feld / Jira-Name | Ausgabe-Spalte | Bemerkung |
|---|---|---|
| `issue.key` | `Jira-ID` | |
| `fields.summary` | `Kurzbeschreibung` | |
| `fields.customfield_19320` (Stage) | `Stage` | `.value` extrahiert aus Auswahl-Objekt (Etappen-Name) |
| `fields.created` | `Created (Status New)` | ISO-Timestamp |
| `fields.status.name` | `Issue-Status` | |
| `fields.status.statusCategory.name` | `Status-Kategorie` | |
| `fields.customfield_17726` (EPIC-Kategorie) | `EPIC-Kategorie` | `.value` extrahiert aus Auswahl-Objekt |
| `fields.customfield_11720` (Akzeptanzkriterien) | `Akzeptanzkriterien` | Freitext |
| `fields.project.key` | `project.key` | |
| `fields.project.name` | `project.name` | |
| `projects.yaml` → `squad` | `Squad` | |
| Changelog: `toString` letzter Eintritt | `[StatusName]` | z. B. `Resolved`, `Rejected` — Pivot: letzter Zeitstempel je Status (nur Epics) |
| Python-Laufzeit | `LoadedFromJiraAt` | Zeitstempel des Exports |

> **Hinweis:** Epics erhalten keinen `_first`/`_Count`/`leaving_`-Block — nur den letzten Eintrittszeitpunkt je Status (vereinfachter Pivot gegenüber Stories).

---

## JiraBlockermanagement

Quelle: Changelog-Events für das Feld `"Blocked Reason"` / `"Blockiert/Wartend"` / `customfield_23623` — gefiltert auf `issuetype in (Story, Task, Bug)`.

| Jira-Feld / Jira-Name | Ausgabe-Spalte | Bemerkung |
|---|---|---|
| `issue.key` | `issues.key` | |
| `fields.status.name` (aus Stories-Basis) | `Status` | Aktueller Status zum Exportzeitpunkt |
| `projects.yaml` → `squad` | `Squad` | |
| `projects.yaml` → `modifier` | `Modifier` | |
| Changelog `history.created` (Event: `toString` ≠ leer) | `BlockedStart` | Zeitpunkt, an dem Issue geblockt/wartend wurde |
| Changelog `item.toString` | `BlockedReason` | Rohwert des Blocked-Felds beim Eintreten |
| Changelog `history.created` (Event: `fromString` ≠ leer) | `BlockedEnd` | Zeitpunkt, an dem Issue Blocked-Zustand verließ — `null` bei offenen Episoden |
| Berechnet | `BlockedDurationHours` | `(BlockedEnd − BlockedStart)` in Stunden — `null` wenn Episode noch offen |
| `BlockedReason` geteilt, Teil vor `" - "` | `Blockiert/Wartend_Zustand` | z. B. `"Blocked"`, `"Waiting"` |
| `BlockedReason` geteilt, Teil nach `" - "` | `Blockiert/Wartend_Grund` | z. B. `"Dependency"`, `"External Team"` |
| Berechnet | `Wie oft in Blocked` | Anzahl Episoden je `issues.key` über den gesamten Exportzeitraum |
| Berechnet | `BlockiertWartendSeit` | Bei offenen Episoden: `(heute − BlockedStart).days`; bei geschlossenen: `⌈BlockedDurationHours / 24⌉` |
| Berechnet | `BlockedSeq` | Laufnummer der Episode je Issue (1, 2, 3 …) |
| Python-Laufzeit | `LoadedFromJiraAt` | Zeitstempel des Exports |

---

## Customfield-Referenz

| Jira-Customfield | Bedeutung | Genutzt in |
|---|---|---|
| `customfield_11821` | Time in Status (Jira-intern, codiertes String-Format) | JiraStories → `TimeInStatusBlocked` |
| `customfield_23623` | Blocked Reason / Blockiert/Wartend (Auswahlfeld) | JiraStories, JiraBlockermanagement |
| `customfield_19320` | Stage / Etappe (Auswahlfeld) | JiraEpics → `Stage` |
| `customfield_17726` | EPIC-Kategorie (Auswahlfeld) | JiraEpics → `EPIC-Kategorie` |
| `customfield_11720` | Akzeptanzkriterien (Freitext) | JiraEpics → `Akzeptanzkriterien` |

---

## Konfiguration (projects.yaml)

Die Spalten `Squad` und `Modifier` stammen **nicht** aus Jira, sondern werden in `tools/projects.yaml` manuell gepflegt:

```yaml
projects:
  - project: PROJ-A
    squad:    "Team Alpha"
    modifier: "sprint in openSprints()"
  - project: PROJ-B
    squad:    "Team Beta"
    modifier: ""
```

`modifier` wird als zusätzliche JQL-Bedingung an die Abfrage angehängt.

---

*Erstellt aus Power Query M-Code-Analyse + Python-Implementierung in `tools/export_jira.py`*
