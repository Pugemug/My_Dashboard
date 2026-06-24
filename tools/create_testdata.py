"""
Erstellt den M17 Standard-Testdatensatz für Testautomatisierung.
Enthält gezielte Edge Cases aus TestAutomatisierung.md Block B.
Ausgabe: JSON im Format { meta, sheets } (Stufe 1 JSON-Migration).
"""
import json
import os
from datetime import datetime, timedelta, timezone

def iso(year, month, day):
    """Hilfsfunktion: ISO-8601-String (UTC Mitternacht)"""
    return datetime(year, month, day, tzinfo=timezone.utc).isoformat().replace('+00:00', 'Z')

def month_key(year, month):
    """Monatsspalten-Key im Format 'YYYY-MM'"""
    return f'{year:04d}-{month:02d}'

HEADERS = [
    'Jira-ID', 'Issue-Type', 'Squad', 'Issue-Status',
    'Ready4Progress_first', 'Ready4Progress',
    'In Progress_first', 'In Progress',
    'leaving_In Progress_first', 'leaving_In Progress',
    'Ready4Test_first', 'Ready4Test',
    'leaving_Ready4Test_first', 'leaving_Ready4Test',
    'Resolved', 'Rejected',
]

def make_row(*vals):
    return dict(zip(HEADERS, vals))

# ══════════════════════════════════════════════════════════════
# Sheet 1: JiraStories (Pflicht-Sheet)
# ══════════════════════════════════════════════════════════════
stories = []

# ── Normalfall: abgeschlossen, Squad A ──────────────────────
stories.append(make_row(
    'JA-001', 'Story', 'Squad-A', 'Resolved',
    iso(2024,1,1),  iso(2024,1,1),
    iso(2024,1,2),  iso(2024,1,2),
    iso(2024,1,8),  iso(2024,1,8),
    iso(2024,1,9),  iso(2024,1,9),
    iso(2024,1,12), iso(2024,1,12),
    iso(2024,1,15), None,
))

# ── Dual-Period: Status zweimal durchlaufen ──────────────────
# In Progress: 3.1–5.1 (3 Tage) + 10.1–11.1 (2 Tage) = 5 Tage
stories.append(make_row(
    'JA-002', 'Story', 'Squad-A', 'Resolved',
    iso(2024,1,3),  iso(2024,1,3),
    iso(2024,1,3),  iso(2024,1,10),
    iso(2024,1,5),  iso(2024,1,11),
    iso(2024,1,12), iso(2024,1,12),
    iso(2024,1,14), iso(2024,1,14),
    iso(2024,1,20), None,
))

# ── Aktives WIP-Item (weder Resolved noch Rejected) ─────────
stories.append(make_row(
    'JA-003', 'Bug', 'Squad-A', 'In Progress',
    iso(2024,2,1), iso(2024,2,1),
    iso(2024,2,2), iso(2024,2,2),
    None, None, None, None, None, None,
    None, None,
))

# ── Rejected Item (abgebrochen, nicht in Rolling Pace) ──────
stories.append(make_row(
    'JA-004', 'Story', 'Squad-B', 'Rejected',
    iso(2024,1,5),  iso(2024,1,5),
    iso(2024,1,6),  iso(2024,1,6),
    iso(2024,1,10), iso(2024,1,10),
    None, None, None, None,
    None, iso(2024,1,12),
))

# ── Item ohne Squad (leere Squad-Spalte) ────────────────────
stories.append(make_row(
    'JA-005', 'Task', '', 'Resolved',
    iso(2024,1,8),  iso(2024,1,8),
    iso(2024,1,9),  iso(2024,1,9),
    iso(2024,1,13), iso(2024,1,13),
    iso(2024,1,14), iso(2024,1,14),
    iso(2024,1,14), iso(2024,1,17), None,
))

# ── Squad-B: genau 1 Item (Grenzfall für Statistiken) ───────
stories.append(make_row(
    'JB-001', 'Story', 'Squad-B', 'Resolved',
    iso(2024,3,1), iso(2024,3,1),
    iso(2024,3,2), iso(2024,3,2),
    iso(2024,3,7), iso(2024,3,7),
    iso(2024,3,8), iso(2024,3,8),
    iso(2024,3,10), None,
))

# ── Squad-C: 20 Items für Normalfall (CT variiert) ──────────
def _d(base, delta):
    t = base + timedelta(days=delta)
    return iso(t.year, t.month, t.day)

base_c = datetime(2024, 1, 1)
for i in range(20):
    start = base_c + timedelta(days=i * 3)
    ct = 3 + (i % 7)
    stories.append(make_row(
        f'JC-{i+1:03d}', 'Story', 'Squad-C', 'Resolved',
        _d(start, 0),    _d(start, 0),
        _d(start, 1),    _d(start, 1),
        _d(start, ct),   _d(start, ct),
        _d(start, ct+1), _d(start, ct+1),
        _d(start, ct+2), _d(start, ct+2),
        _d(start, ct+2), None,
    ))

# ── Inkonsistentes Datum: Ende vor Start (Datenqualitätsproblem) ──
stories.append(make_row(
    'JA-ERR', 'Story', 'Squad-A', 'Resolved',
    iso(2024,4,10), iso(2024,4,10),
    iso(2024,4,15), iso(2024,4,15),
    iso(2024,4,12), iso(2024,4,12),
    None, None, None, None,
    iso(2024,4,10), None,
))

# ══════════════════════════════════════════════════════════════
# Sheet 2: JiraEpics (für SayDoRatio, Akzeptanzkriterien)
# ══════════════════════════════════════════════════════════════
EPIC_HEADERS = ['Jira-ID', 'Kurzbeschreibung', 'Squad', 'Stage', 'Resolved', 'Rejected', 'UNCALLED', 'Akzeptanzkriterien']

def make_epic(*vals):
    return dict(zip(EPIC_HEADERS, vals))

epics = [
    make_epic('EP-001', 'Feature A', 'Squad-A', 'Q1-2024', iso(2024,3,28), None, None, 'Als Nutzer möchte ich das Feature A nutzen können'),
    make_epic('EP-002', 'Feature B', 'Squad-A', 'Q1-2024', None, None, None, 'Kurz'),
    make_epic('EP-003', 'Feature C', 'Squad-B', 'Q1-2024', iso(2024,3,30), None, None, 'Als Nutzer möchte ich Feature C sehen und verwenden'),
    make_epic('EP-004', 'Feature D', 'Squad-A', 'Q2-2024', iso(2024,6,28), None, None, 'Als Nutzer möchte ich das Feature D konfigurieren'),
    make_epic('EP-005', 'Feature E', 'Squad-A', 'Q2-2024', iso(2024,6,29), None, None, None),
    make_epic('EP-006', 'Feature F', 'Squad-B', 'Q2-2024', None, iso(2024,5,15), None, 'Als Nutzer möchte ich Feature F deaktivieren können'),
]

# ══════════════════════════════════════════════════════════════
# Sheet 3: Happiness Faktor (normalisiert: Squad + YYYY-MM Spalten)
# ══════════════════════════════════════════════════════════════
happiness = [
    {'Squad': 'Squad-A', month_key(2024,1): 4, month_key(2024,2): 3, month_key(2024,3): 4, month_key(2024,4): 5},
    {'Squad': 'Squad-B', month_key(2024,1): 3, month_key(2024,2): 3, month_key(2024,3): 2, month_key(2024,4): 4},
    {'Squad': 'Squad-C', month_key(2024,1): 5, month_key(2024,2): 4, month_key(2024,3): 4, month_key(2024,4): 3},
]

# ══════════════════════════════════════════════════════════════
# Ausgabe
# ══════════════════════════════════════════════════════════════
out_dir = os.path.join(os.path.dirname(__file__), '..', 'tests', 'fixtures')
os.makedirs(out_dir, exist_ok=True)

export_date = datetime.now(tz=timezone.utc).isoformat().replace('+00:00', 'Z')

def write_json(path, sheets):
    data = {
        'meta': {'exportDate': export_date, 'source': 'Testdaten', 'version': '1'},
        'sheets': sheets,
    }
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2, default=str)

# ── Haupt-Testdatei ──────────────────────────────────────────
main_path = os.path.join(out_dir, 'testdata.json')
write_json(main_path, {
    'JiraStories':   stories,
    'JiraEpics':     epics,
    'Happiness Faktor': happiness,
})
print(f'OK testdata.json: {os.path.abspath(main_path)}')

# ── Leere Datei (nur Pflicht-Sheet, keine Datenzeilen) ───────
empty_path = os.path.join(out_dir, 'testdata-empty.json')
write_json(empty_path, {'JiraStories': []})
print(f'OK testdata-empty.json: {os.path.abspath(empty_path)}')

# ── Einzelner-Squad-Testdatensatz ────────────────────────────
single_stories = []
base_sq = datetime(2024, 3, 1)
for i in range(5):
    start = base_sq + timedelta(days=i * 4)
    ct = 4 + i
    single_stories.append(make_row(
        f'SX-{i+1:03d}', 'Story', 'Squad-X', 'Resolved',
        _d(start, 0),    _d(start, 0),
        _d(start, 1),    _d(start, 1),
        _d(start, ct),   _d(start, ct),
        _d(start, ct+1), _d(start, ct+1),
        _d(start, ct+2), _d(start, ct+2),
        _d(start, ct+2), None,
    ))

single_stories.append(make_row(
    'SX-006', 'Bug', 'Squad-X', 'In Progress',
    iso(2024,5,1), iso(2024,5,1),
    iso(2024,5,2), iso(2024,5,2),
    None, None, None, None, None, None,
    None, None,
))

single_happiness = [
    {'Squad': 'Squad-X', month_key(2024,1): 4, month_key(2024,2): 3, month_key(2024,3): 4, month_key(2024,4): 5},
]

single_path = os.path.join(out_dir, 'testdata-single-squad.json')
write_json(single_path, {
    'JiraStories':   single_stories,
    'Happiness Faktor': single_happiness,
})
print(f'OK testdata-single-squad.json: {os.path.abspath(single_path)}')
