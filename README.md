# Flow Analytics Dashboard

Ein browserbasiertes Dashboard für agile Teams, das Flow-Metriken aus Jira-Daten visualisiert. Keine Installation, kein Server – einfach die HTML-Datei öffnen, JSON laden, fertig.

---

## Was macht die App?

Das Dashboard hilft Teams dabei, ihre Liefergeschwindigkeit, Engpässe und Vorhersagen auf einen Blick zu sehen. Du lädst eine JSON-Datei mit deinen Jira-Tickets in den Browser – die App berechnet und zeigt dann alle Metriken automatisch an.

**Datenschutz by Design:** Die Daten bleiben komplett im Browser. Es gibt keinen Server, keine Cloud-Verbindung und keine Datenübertragung.

---

## Funktionsumfang

Die App gliedert sich in eine Übersichtsseite und mehrere Detailanalysen.

### Übersicht: Lieferfähigkeit

Sechs Metriken auf einen Blick, als verschiebbare Kacheln dargestellt:

| Kachel | Frage | Was zeigt es? |
|---|---|---|
| **Lead Time** | Wie schnell liefern wir? | Box-Chart mit Durchlaufzeiten (Median, Perzentile) |
| **WIP** | Wie viel läuft gleichzeitig? | Anzahl offener Tickets im Zeitverlauf |
| **Flow Efficiency** | Wie viel davon ist echte Arbeit? | Anteil aktiver Zeit vs. Wartezeit |
| **SayDo Ratio Epics** | Halten wir unsere Zusagen? | Verhältnis geplanter zu gelieferter Epics je Etappe |
| **Happiness Factor** | Wie geht es dem Team? | Zufriedenheitswerte im Zeitverlauf |
| **Akzeptanzkriterien** | Sind unsere Epics gut genug beschrieben? | Anteil Epics mit definierten Akzeptanzkriterien |

Die Kachelreihenfolge lässt sich per Drag & Drop anpassen und wird im Browser gespeichert.

### Detailanalysen

- **Was blockiert uns?** – Blockermanagement: Welche Tickets sind blockiert, wie lange und wie oft?
- **Was liegt gerade rum?** – WIP-Alter: Offene Tickets nach Status und Alter sortiert
- **Wie lange dauert ein Ticket?** – Cycle Time Scatterplot: Jedes abgeschlossene Ticket als Punkt, mit konfigurierbaren Perzentillinien
- **Wo verbringen Tickets ihre Zeit?** – Flow Heatmap: Durchschnittliche Verweildauer je Status, aufgeschlüsselt nach Monat und Squad
- **Wann sind wir fertig?** – Monte Carlo Simulation: Wahrscheinlichkeitsbasierte Fertigstellungsprognose auf Basis historischer Durchsatzwerte

### Filter (global auf allen Seiten)

- **Squad** – ein oder mehrere Teams auswählen
- **Issue-Typ** – Story, Task, Bug usw.
- **Zeitraum** – letzte 30/90/180 Tage, Quartale oder freie Datumsauswahl

---

## Datei-Format

Die App erwartet eine `.json`-Datei mit folgender Struktur:

```
{
  "meta": { ... },
  "sheets": {
    "JiraStories":           [...],   ← Pflicht: Stories, Tasks, Bugs
    "JiraEpics":             [...],   ← optional: Epics
    "JiraBlockermanagement": [...],   ← optional: Blocker-Episoden
    "SquadDaten":            [...],   ← optional: Team-Kapazitäten
    "BRP Etappen":           [...],   ← optional: Planungsetappen
    "Happiness":             [...]    ← optional: Zufriedenheitswerte
  }
}
```

**JiraStories** ist das einzige Pflicht-Sheet. Mindestens die Spalte `Jira-ID` muss vorhanden sein. Status-Zeitstempel (z. B. `In Progress`, `leaving_In Progress`) werden automatisch aus den Spaltennamen erkannt – kein manuelles Konfigurieren nötig.

---

## Daten aus Jira laden

### PowerShell-Skript

Einfache Bedienung per Doppelklick.

#### Voraussetzungen

- Windows mit PowerShell 3 oder neuer (Standard seit Windows 8)
- Zugang zur Jira-Instanz (Benutzername + Passwort)

#### Konfiguration einmalig einrichten

1. Die Vorlage kopieren:
   ```
   config\flow_config.example.json  →  config\flow_config.json
   ```
2. Die `flow_config.json` anpassen – Squads, Jira-Projekte und ggf. Custom Field IDs eintragen.

#### Export ausführen

```
Doppelklick auf:  tools\Jira\jira_fetch.bat
```

Das Skript fragt dann nach Benutzername und Passwort – die Zugangsdaten werden **nie gespeichert**, sondern nur für die aktuelle Sitzung im Arbeitsspeicher gehalten.

#### Was passiert im Hintergrund?

Das Skript `jira_transform.ps1` läuft in diesen Schritten:

1. **Config laden** – liest `flow_config.json` mit Squads, Projekten und Custom Fields
2. **Credentials abfragen** – Benutzername und Passwort sicher per Terminal-Eingabe, nie auf Disk
3. **Verbindung testen** – ruft `/rest/api/2/myself` auf und zeigt an, als wer man eingeloggt ist
4. **Issues laden** – für jeden konfigurierten Squad wird eine JQL-Abfrage gebaut und seitenweise abgerufen (100 Issues pro Request):
   - **Vollabzug** (erster Export): alle Issues der letzten 52 Wochen
   - **Inkrementell** (Folge-Exports): nur Issues, die seit dem letzten Export geändert wurden
5. **Daten aufbereiten** – aus dem Jira-Changelog werden für jedes Ticket die genauen Zeitstempel jedes Statusübergangs extrahiert; Blocker-Episoden (Start, Ende, Dauer) werden separat herausgerechnet
6. **Merge** – beim inkrementellen Lauf werden neue und geänderte Issues mit den Bestandsdaten zusammengeführt, die alte Datei wird dabei ersetzt
7. **Ausgabe** – eine Datei `flowanalytics_YYYY-MM-DD.json` landet im Projektordner

Danach: Im Dashboard auf „Datei auswählen" klicken und die JSON-Datei laden.

---

## Projekt-Struktur

```
My_Dashboard/
├── src/                    # Dashboard-Quellcode (HTML + ES-Module JS)
│   ├── index.html          # Einstiegspunkt der Web App
│   ├── core.js             # Globaler State, Datei-Upload, Navigation
│   ├── scatter.js          # Cycle Time Scatterplot
│   ├── heatmap.js          # Flow Heatmap
│   ├── wipage.js           # WIP-Alter
│   ├── blocker.js          # Blockermanagement
│   ├── montecarlo.js       # Monte Carlo Simulation
│   ├── flowefficiency.js   # Flow Efficiency
│   ├── wip.js              # WIP-Kachel
│   ├── boxchart.js         # Lead Time Box Chart
│   ├── happiness.js        # Happiness Factor
│   ├── akzeptanz.js        # Akzeptanzkriterien
│   ├── saydoratioepics.js  # SayDo Ratio Epics
│   └── calc/               # Berechnungslogik (getrennt von der Darstellung)
│
├── tools/
│   └── Jira/
│       ├── jira_fetch.bat      # Starter-Skript (Doppelklick)
│       └── jira_transform.ps1  # PowerShell-Export-Logik
│
├── config/
│   └── flow_config.example.json  # Vorlage für die PowerShell-Konfiguration
│
├── tests/                  # Unit-Tests (Vitest) + E2E-Tests (Playwright)
└── docs/                   # Specs und Design-Dokumentation
```

---

## Entwicklung

```bash
# Tests ausführen
npm test

# Tests im Watch-Modus
npm run test:watch

# Code-Qualität prüfen und Fehler automatisch beheben
npm run lint:fix

# E2E-Tests
npm run test:e2e
```

**Qualitätspflicht:** Nach jeder Änderung in `src/` müssen Lint und alle Tests grün sein.

---

## Technologie

- **Frontend:** Reines HTML + JavaScript (ES-Module), kein Framework, kein Build-Schritt
- **Tests:** Vitest (Unit) + Playwright (E2E)
- **Linting:** ESLint mit pre-commit Hook (Husky + lint-staged)
- **Jira-Export:** PowerShell 3+ (Windows)
