#!/usr/bin/env python3
"""
export_jira.py  –  Jira REST API → flowdata.json

Ersetzt den Power Query Prozess aus der Excel-Analyse-Datei.
Spec: docs/specs/JiraExport.md

Aufruf:
    python tools/export_jira.py
    python tools/export_jira.py --output pfad/zur/flowdata.json
    python tools/export_jira.py --dry-run

Konfiguration:
    JIRA_URL, JIRA_USER, JIRA_TOKEN als Umgebungsvariablen setzen.
    Projektliste: PROJECTS-Konstante unten anpassen.
"""

from __future__ import annotations

import argparse
import json
import math
import os
import sys
from datetime import datetime, timezone
from typing import Any

import pandas as pd
import requests

# ─────────────────────────────────────────────────────────────────────────────
# KONFIGURATION
# ─────────────────────────────────────────────────────────────────────────────

JIRA_BASE_URL = os.environ.get("JIRA_URL", "https://jiraws.axa.com")
JIRA_USER     = os.environ.get("JIRA_USER", "")
JIRA_TOKEN    = os.environ.get("JIRA_TOKEN", "")

# Entspricht der jiraProjectsTable in Excel.
# Modifier: optionaler JQL-Zusatz (leerer String = kein Zusatz).
PROJECTS: list[dict] = [
    {"Project": "PROJ-A", "Modifier": "component = 'MyComponent'", "Squad": "Team Alpha"},
    {"Project": "PROJ-B", "Modifier": "",                          "Squad": "Team Beta"},
]

OUTPUT_PATH          = "flowdata.json"
PAGE_SIZE            = 500
JQL_RESOLVED_WINDOW  = "startOfMonth(-52w)"

# ─────────────────────────────────────────────────────────────────────────────
# HILFSFUNKTIONEN
# ─────────────────────────────────────────────────────────────────────────────

def _log(msg: str) -> None:
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}", flush=True)


def _parse_dt(v: Any) -> pd.Timestamp | None:
    """Beliebiger Wert → timezone-naiver Timestamp, None bei Fehler."""
    if v is None:
        return None
    try:
        ts = pd.Timestamp(v)
        if pd.isna(ts):
            return None
        return ts.tz_localize(None) if ts.tzinfo is None else ts.tz_convert(None).tz_localize(None)
    except Exception:
        return None


def _extract_value(v: Any) -> Any:
    """Extrahiert .value aus einem Jira-Auswahl-Record (z.B. Stage, EPIC-Kategorie)."""
    return v.get("value", v) if isinstance(v, dict) else v


def _split_blocked_reason(text: Any) -> tuple[str | None, str | None]:
    """'Blocked - Dependency' → ('Blocked', 'Dependency'). Ohne Trennzeichen → (text, None)."""
    if not text or not isinstance(text, str):
        return None, None
    if " - " in text:
        parts = text.split(" - ", 1)
        return parts[0].strip(), parts[1].strip()
    if "-" in text:
        parts = text.split("-", 1)
        return parts[0].strip(), parts[1].strip()
    return text.strip(), None


def _days_plus_one(end: Any, start: Any) -> int | None:
    """Tage(end − start) + 1. None wenn ein Wert fehlt."""
    if end is None or start is None:
        return None
    try:
        delta = pd.Timestamp(end) - pd.Timestamp(start)
        return int(delta.days) + 1
    except Exception:
        return None


def _parse_time_in_status_blocked(v: Any) -> float | None:
    """
    Parst Blocked-Zeit aus Jira customfield_11821.
    Format: '...|*_10290_*:*_NNNNNNN_*|...' (10290 = Blocked-Status-ID, Wert in Centiseconds).
    Gibt Tage als float zurück, None bei Fehler.
    """
    if not v or not isinstance(v, str):
        return None
    try:
        marker = "|*_10290_*:*_"
        idx = v.find(marker)
        if idx < 0:
            return None
        rest = v[idx + len(marker):]
        end = rest.find("_*")
        if end < 0:
            return None
        raw = rest[:end].rstrip("_")
        return float(raw) / 8_640_000  # centiseconds → Tage
    except Exception:
        return None


def _serialize_val(v: Any) -> Any:
    """Einzelnen Wert für JSON-Ausgabe aufbereiten."""
    if v is None:
        return None
    if isinstance(v, pd.Timestamp):
        return None if pd.isna(v) else v.isoformat()
    if isinstance(v, datetime):
        return v.isoformat()
    if isinstance(v, float) and math.isnan(v):
        return None
    if hasattr(v, "item"):  # numpy-Skalare (int64, float64, bool_)
        item = v.item()
        return None if isinstance(item, float) and math.isnan(item) else item
    try:
        if pd.isna(v):
            return None
    except (TypeError, ValueError):
        pass
    return v


def _df_to_records(df: pd.DataFrame | None) -> list[dict]:
    """DataFrame → Liste von Dicts mit JSON-kompatiblen Werten."""
    if df is None or df.empty:
        return []
    return [
        {k: _serialize_val(v) for k, v in row.items()}
        for row in df.to_dict("records")
    ]


# Lokalisierungs-Maps: Deutschen Jira-Statusnamen → Englisch
_STATUS_MAP: dict[str, str] = {
    "In Bearbeitung": "In Progress",
    "Gelöst": "Resolved",
}
_CATEGORY_MAP: dict[str, str] = {
    "In Arbeit":     "In Progress",
    "Fertig":        "Done",
    "Zu erledigen":  "To Do",
}

ALLOWED_FOR_LEAVING = {
    "New", "Analysed", "Resume", "Evaluated", "Refinement",
    "Ready4Progress", "In Progress", "Blocked",
    "Ready4QS", "In QS", "ready4Test", "Ready4Test",
    "In Test", "Ready4Review", "Ready4Production", "Ready4E2E-Test",
}

# ─────────────────────────────────────────────────────────────────────────────
# API-ABRUF (SRC-Schicht)
# ─────────────────────────────────────────────────────────────────────────────

def _session() -> requests.Session:
    s = requests.Session()
    s.auth = (JIRA_USER, JIRA_TOKEN)
    s.headers.update({"Accept": "application/json"})
    return s


_SESSION: requests.Session | None = None


def _get_session() -> requests.Session:
    global _SESSION
    if _SESSION is None:
        _SESSION = _session()
    return _SESSION


def _fetch_all(jql: str, fields: str, expand_changelog: bool = False) -> list[dict]:
    """Ruft alle Seiten einer Jira-Suche ab. Gibt Liste von Issue-Dicts zurück."""
    url = f"{JIRA_BASE_URL}/jira/rest/api/2/search"
    params: dict[str, str] = {
        "jql":        jql,
        "fields":     fields,
        "maxResults": str(PAGE_SIZE),
        "startAt":    "0",
    }
    if expand_changelog:
        params["expand"] = "changelog"

    try:
        resp = _get_session().get(url, params=params, timeout=60).json()
    except Exception as exc:
        _log(f"  ⚠ API-Fehler beim ersten Aufruf: {exc}")
        return []

    total  = resp.get("total", 0)
    issues = list(resp.get("issues") or [])
    pages  = max(1, math.ceil(total / PAGE_SIZE))
    _log(f"  Seite 1/{pages} — {len(issues)}/{total}")

    for start in range(PAGE_SIZE, total, PAGE_SIZE):
        page = start // PAGE_SIZE + 1
        try:
            page_params = {**params, "startAt": str(start)}
            page_resp = _get_session().get(url, params=page_params, timeout=60).json()
            batch = list(page_resp.get("issues") or [])
            issues.extend(batch)
            _log(f"  Seite {page}/{pages} — {len(issues)}/{total}")
        except Exception as exc:
            _log(f"  ⚠ Seite {page} fehlgeschlagen: {exc}")

    return issues


_FIELDS_BASE    = ("summary,issuetype,project,status,created,updated,"
                   "customfield_11821,customfield_23623,"
                   "customfield_19320,customfield_17726,customfield_11720")
_FIELDS_HISTORY = "summary,issuetype,project,status,created"


def fetch_epics_base(projects: list[dict]) -> list[dict]:
    """SRC_Jira_Base_Epics: Epics ohne Changelog, mit Modifier + Squad."""
    _log("SRC_Jira_Base_Epics – Epics (aktuell)...")
    rows: list[dict] = []
    for p in projects:
        proj, mod, squad = p["Project"], p.get("Modifier", ""), p.get("Squad", "")
        if not proj:
            continue
        _log(f"  Projekt: {proj}")
        jql = f'project = "{proj}"'
        if mod:
            jql += f" AND ({mod})"
        jql += " AND issuetype in (Epic)"
        for issue in _fetch_all(jql, _FIELDS_BASE):
            rows.append({"_issue": issue, "Project": proj, "Modifier": mod, "Squad": squad})
    return rows


def fetch_epics_history(projects: list[dict]) -> list[dict]:
    """SRC_Jira_History_Epics_ByProject: Epics MIT Changelog, je Projekt."""
    _log("SRC_Jira_History_Epics_ByProject – Epics + Changelog...")
    rows: list[dict] = []
    seen: set[str] = set()
    for p in projects:
        proj = p["Project"]
        if not proj or proj in seen:
            continue
        seen.add(proj)
        _log(f"  Projekt: {proj}")
        jql = f'project = "{proj}" AND issuetype in (Epic)'
        for issue in _fetch_all(jql, _FIELDS_HISTORY, expand_changelog=True):
            rows.append({"_issue": issue, "Project": proj})
    return rows


def fetch_stories_base(projects: list[dict]) -> list[dict]:
    """SRC_Jira_Base_Projects: Stories/Tasks/Bugs ohne Changelog."""
    _log("SRC_Jira_Base_Projects – Stories/Tasks/Bugs (aktuell)...")
    rows: list[dict] = []
    for p in projects:
        proj, mod, squad = p["Project"], p.get("Modifier", ""), p.get("Squad", "")
        if not proj:
            continue
        _log(f"  Projekt: {proj}")
        jql = f'project = "{proj}"'
        if mod:
            jql += f" AND ({mod})"
        jql += (f" AND issuetype in (Story, Task, Bug)"
                f" AND (resolution = Unresolved OR resolved >= {JQL_RESOLVED_WINDOW})")
        for issue in _fetch_all(jql, _FIELDS_BASE):
            rows.append({"_issue": issue, "Project": proj, "Modifier": mod, "Squad": squad})
    return rows


def fetch_stories_history(projects: list[dict]) -> list[dict]:
    """SRC_Jira_History_Stories_ByProject: Stories/Tasks/Bugs MIT Changelog."""
    _log("SRC_Jira_History_Stories_ByProject – Stories + Changelog...")
    rows: list[dict] = []
    seen: set[str] = set()
    for p in projects:
        proj = p["Project"]
        if not proj or proj in seen:
            continue
        seen.add(proj)
        _log(f"  Projekt: {proj}")
        jql = (f'project = "{proj}"'
               f" AND issuetype in (Story, Task, Bug)"
               f" AND (resolution = Unresolved OR resolved >= {JQL_RESOLVED_WINDOW})")
        for issue in _fetch_all(jql, _FIELDS_HISTORY, expand_changelog=True):
            rows.append({"_issue": issue, "Project": proj})
    return rows


# ─────────────────────────────────────────────────────────────────────────────
# STG I – JSON entpacken
# ─────────────────────────────────────────────────────────────────────────────

def build_epics_base(raw: list[dict]) -> pd.DataFrame:
    """STG_Epics_Base: JSON der Epics entpacken."""
    _log("STG_Epics_Base – JSON entpacken...")
    records = []
    for r in raw:
        issue = r["_issue"]
        f     = issue.get("fields") or {}
        status   = f.get("status") or {}
        cat      = status.get("statusCategory") or {}
        issuetype = (f.get("issuetype") or {}).get("name", "")
        project   = f.get("project") or {}
        if issuetype != "Epic":
            continue
        records.append({
            "issues.key":          issue.get("key"),
            "summary":             f.get("summary"),
            "Stage":               _extract_value(f.get("customfield_19320")),
            "created":             f.get("created"),
            "status.name":         status.get("name"),
            "statusCategory.name": cat.get("name"),
            "EPIC-Kategorie":      _extract_value(f.get("customfield_17726")),
            "Akzeptanzkriterien":  f.get("customfield_11720"),
            "project.key":         project.get("key"),
            "project.name":        project.get("name"),
            "Modifier":            r.get("Modifier", ""),
            "Squad":               r.get("Squad", ""),
        })
    return pd.DataFrame(records)


def build_stories_base(raw: list[dict]) -> pd.DataFrame:
    """STG_Stories_Base: JSON der Stories/Tasks/Bugs entpacken."""
    _log("STG_Stories_Base – JSON entpacken...")
    records = []
    for r in raw:
        issue = r["_issue"]
        f     = issue.get("fields") or {}
        status   = f.get("status") or {}
        cat      = status.get("statusCategory") or {}
        raw_type  = (f.get("issuetype") or {}).get("name", "")
        issuetype = "Task" if raw_type == "Aufgabe" else raw_type
        project   = f.get("project") or {}
        if issuetype not in ("Story", "Task", "Bug"):
            continue
        records.append({
            "issues.key":          issue.get("key"),
            "project.key":         project.get("key"),
            "project.name":        project.get("name"),
            "issuetype":           issuetype,
            "created":             f.get("created"),
            "customfield_11821":   f.get("customfield_11821"),
            "customfield_23623":   f.get("customfield_23623"),
            "status.name":         status.get("name"),
            "statusCategory.name": cat.get("name"),
            "Modifier":            r.get("Modifier", ""),
            "Squad":               r.get("Squad", ""),
        })
    return pd.DataFrame(records)


# ─────────────────────────────────────────────────────────────────────────────
# STG II – Changelog entfalten
# ─────────────────────────────────────────────────────────────────────────────

def build_changelog_flat(
    epics_hist: list[dict],
    stories_hist: list[dict],
) -> pd.DataFrame:
    """
    STG_Issues_ChangelogFlat: Changelog aller Issues entfalten.
    1 Zeile = 1 einzelnes Feldänderungs-Event.
    Wird einmal berechnet und an beide nachgelagerten Zweige weitergegeben
    (Performance-Fix gegenüber Power Query, wo kein Buffer gesetzt war).
    """
    _log("STG_Issues_ChangelogFlat – Changelog entfalten...")
    _EMPTY_COLS = [
        "issues.key", "IssueClass", "status.name",
        "history.created", "field", "fromString", "toString",
    ]
    rows: list[dict] = []
    seen: dict[str, str] = {}

    for raw_list, issue_class in [(epics_hist, "Epic"), (stories_hist, "StoryLike")]:
        for r in raw_list:
            issue = r["_issue"]
            key   = issue.get("key")
            if key in seen:
                continue
            seen[key] = issue_class
            current_status = ((issue.get("fields") or {}).get("status") or {}).get("name")
            for hist in (issue.get("changelog") or {}).get("histories") or []:
                created = hist.get("created")
                for item in hist.get("items") or []:
                    rows.append({
                        "issues.key":    key,
                        "IssueClass":    issue_class,
                        "status.name":   current_status,
                        "history.created": created,
                        "field":         item.get("field"),
                        "fromString":    item.get("fromString"),
                        "toString":      item.get("toString"),
                    })

    return pd.DataFrame(rows) if rows else pd.DataFrame(columns=_EMPTY_COLS)


# ─────────────────────────────────────────────────────────────────────────────
# STG III – Filtern
# ─────────────────────────────────────────────────────────────────────────────

def build_status_history(changelog_flat: pd.DataFrame) -> pd.DataFrame:
    """STG_Issues_StatusHistory: nur Status-Änderungen mit normalisiertem Zeitstempel."""
    _log("STG_Issues_StatusHistory...")
    if changelog_flat.empty:
        return pd.DataFrame(columns=[
            "issues.key", "IssueClass", "field", "fromString", "toString", "EventTimestamp"
        ])
    df = changelog_flat[changelog_flat["field"] == "status"].copy()
    df["EventTimestamp"] = df["history.created"].apply(_parse_dt)
    df = df[df["issues.key"].notna() & df["EventTimestamp"].notna()]
    return df[["issues.key", "IssueClass", "field", "fromString", "toString", "EventTimestamp"]]


def build_blocked_field_history(
    changelog_flat: pd.DataFrame,
    stories_base: pd.DataFrame,
) -> pd.DataFrame:
    """
    STG_Issues_BlockedHistory: Blocked/Wartend-Events mit aktuellem Status-Kontext.
    Löst den Join mit STG_Stories_Base direkt hier auf (entspricht dem M-Code-Pfad
    STG_Issues_BlockedFieldHistory → STG_Issues_BlockedHistory).
    """
    _log("STG_Issues_BlockedHistory...")
    _EMPTY_COLS = [
        "issues.key", "status.name", "Squad", "Modifier",
        "history.created", "fromString", "toString",
    ]
    if changelog_flat.empty:
        return pd.DataFrame(columns=_EMPTY_COLS)

    _BLOCKED_FIELDS = {"Blocked Reason", "Blockiert/Wartend", "customfield_23623"}
    mask = (
        changelog_flat["field"].apply(
            lambda f: str(f) in _BLOCKED_FIELDS if f is not None else False
        )
        & (changelog_flat["IssueClass"] == "StoryLike")
    )
    bf = changelog_flat[mask][["issues.key", "history.created", "fromString", "toString"]].copy()
    if bf.empty:
        return pd.DataFrame(columns=_EMPTY_COLS)

    ctx = (
        stories_base[["issues.key", "status.name", "Squad", "Modifier"]]
        .drop_duplicates()
    )
    merged = bf.merge(ctx, on="issues.key", how="inner")
    merged["history.created"] = merged["history.created"].apply(_parse_dt)
    for col in ("fromString", "toString"):
        merged[col] = merged[col].apply(
            lambda v: str(v).strip() if v is not None else None
        )
    return merged[_EMPTY_COLS]


# ─────────────────────────────────────────────────────────────────────────────
# STG IV-VI – Aggregieren / Pivotieren
# ─────────────────────────────────────────────────────────────────────────────

def build_epics_status_pivot(status_history: pd.DataFrame) -> pd.DataFrame:
    """STG_Epics_StatusPivot: letzter Eintrittszeitpunkt je Status als Spalten."""
    _log("STG_Epics_StatusPivot...")
    if status_history.empty:
        return pd.DataFrame(columns=["issues.key"])

    epics = status_history[status_history["IssueClass"] == "Epic"][
        ["issues.key", "toString", "EventTimestamp"]
    ].copy()
    if epics.empty:
        return pd.DataFrame(columns=["issues.key"])

    grouped = (
        epics.groupby(["issues.key", "toString"])["EventTimestamp"]
        .max()
        .reset_index()
        .rename(columns={"EventTimestamp": "StatusTimestamp"})
    )
    pivot = grouped.pivot(index="issues.key", columns="toString", values="StatusTimestamp")
    pivot.columns.name = None
    return pivot.reset_index()


def build_stories_status_agg(status_history: pd.DataFrame) -> pd.DataFrame:
    """
    STG_Stories_StatusAgg = STG_Stories_StatusEntries LEFT JOIN STG_Stories_StatusLeaves.
    Entries: wann und wie oft ein Status betreten wurde.
    Leaves: wann ein Status verlassen wurde.
    """
    _log("STG_Stories_StatusAgg...")
    if status_history.empty:
        return pd.DataFrame(columns=["issues.key"])

    stories = status_history[status_history["IssueClass"] == "StoryLike"].copy()
    stories = stories[stories["issues.key"].notna() & stories["EventTimestamp"].notna()]

    # ── Status-Eintritte ────────────────────────────────────────────────────
    entries_src = stories[stories["toString"].notna() & (stories["toString"] != "")]
    if not entries_src.empty:
        agg = (
            entries_src.groupby(["issues.key", "toString"])["EventTimestamp"]
            .agg(last="max", first="min", count="count")
            .reset_index()
        )
        metric_rows: list[dict] = []
        for _, row in agg.iterrows():
            k, s = row["issues.key"], row["toString"]
            metric_rows += [
                {"issues.key": k, "Metric": s,            "Value": row["last"]},
                {"issues.key": k, "Metric": s + "_first", "Value": row["first"]},
                {"issues.key": k, "Metric": s + "_Count", "Value": int(row["count"])},
            ]
        entries_long = pd.DataFrame(metric_rows)
        entries_pivot = entries_long.pivot_table(
            index="issues.key", columns="Metric", values="Value", aggfunc="first"
        )
        entries_pivot.columns.name = None
        entries_pivot = entries_pivot.reset_index()
    else:
        entries_pivot = pd.DataFrame(columns=["issues.key"])

    # ── Status-Austritte ────────────────────────────────────────────────────
    leaves_src = stories[
        stories["fromString"].notna()
        & (stories["fromString"] != "")
        & stories["fromString"].isin(ALLOWED_FOR_LEAVING)
    ]
    if not leaves_src.empty:
        agg = (
            leaves_src.groupby(["issues.key", "fromString"])["EventTimestamp"]
            .agg(last="max", first="min")
            .reset_index()
        )
        metric_rows = []
        for _, row in agg.iterrows():
            k, s = row["issues.key"], row["fromString"]
            metric_rows += [
                {"issues.key": k, "Metric": "leaving_" + s,            "Value": row["last"]},
                {"issues.key": k, "Metric": "leaving_" + s + "_first", "Value": row["first"]},
            ]
        leaves_long = pd.DataFrame(metric_rows)
        leaves_pivot = leaves_long.pivot_table(
            index="issues.key", columns="Metric", values="Value", aggfunc="first"
        )
        leaves_pivot.columns.name = None
        leaves_pivot = leaves_pivot.reset_index()
    else:
        leaves_pivot = pd.DataFrame(columns=["issues.key"])

    # ── Zusammenführen ──────────────────────────────────────────────────────
    if entries_pivot.empty or list(entries_pivot.columns) == ["issues.key"]:
        return pd.DataFrame(columns=["issues.key"])
    if leaves_pivot.empty or list(leaves_pivot.columns) == ["issues.key"]:
        return entries_pivot
    return entries_pivot.merge(leaves_pivot, on="issues.key", how="left")


# ─────────────────────────────────────────────────────────────────────────────
# OUTPUT: JiraEpics
# ─────────────────────────────────────────────────────────────────────────────

def build_jira_epics(
    epics_base: pd.DataFrame,
    epics_status_pivot: pd.DataFrame,
) -> pd.DataFrame:
    """JiraEpics: finale Epics-Tabelle."""
    _log("JiraEpics – finale Tabelle bauen...")
    if epics_base.empty:
        return pd.DataFrame()

    base = epics_base.drop_duplicates(
        subset=["issues.key", "project.key", "Modifier", "Squad"]
    )
    merged = base.merge(epics_status_pivot, on="issues.key", how="left")

    # Alle Datumsspalten normalisieren
    date_cols = {"created"} | (set(merged.columns) - set(base.columns) - {"issues.key"})
    for col in date_cols:
        if col in merged.columns:
            merged[col] = merged[col].apply(_parse_dt)

    # Modifier entfernen (nicht Teil des Outputs)
    merged = merged.drop(columns=["Modifier"], errors="ignore")

    merged = merged.rename(columns={
        "issues.key":          "Jira-ID",
        "summary":             "Kurzbeschreibung",
        "created":             "Created (Status New)",
        "status.name":         "Issue-Status",
        "statusCategory.name": "Status-Kategorie",
    })
    merged["LoadedFromJiraAt"] = datetime.now()
    return merged


# ─────────────────────────────────────────────────────────────────────────────
# OUTPUT: JiraStories
# ─────────────────────────────────────────────────────────────────────────────

def build_jira_stories(
    stories_base: pd.DataFrame,
    stories_status_agg: pd.DataFrame,
) -> pd.DataFrame:
    """JiraStories: finale Stories/Tasks/Bugs-Tabelle mit allen berechneten Metriken."""
    _log("JiraStories – finale Tabelle bauen...")
    if stories_base.empty:
        return pd.DataFrame()

    base = stories_base.drop_duplicates(
        subset=["issues.key", "project.key", "Modifier", "Squad"]
    )
    merged = base.merge(stories_status_agg, on="issues.key", how="left")

    # Timestamp-Spalten normalisieren (alle dynamischen Status-Spalten + created)
    base_date_cols = {"created"}
    status_cols = set(merged.columns) - set(base.columns) - {"issues.key"}
    count_cols  = {c for c in status_cols if c.endswith("_Count")}
    for col in base_date_cols | (status_cols - count_cols):
        if col in merged.columns:
            merged[col] = merged[col].apply(_parse_dt)

    # Umbenennen
    merged = merged.rename(columns={
        "issues.key":          "Jira-ID",
        "issuetype":           "Issue-Type",
        "created":             "Created (Status New)",
        "customfield_11821":   "Time in Status",
        "customfield_23623":   "Blocked Reason",
        "status.name":         "Issue-Status",
        "statusCategory.name": "Status-Kategorie",
    })

    # Blocked Reason: .value extrahieren → Blockiert/Wartend
    if "Blocked Reason" in merged.columns:
        merged["Blockiert/Wartend"] = merged["Blocked Reason"].apply(
            lambda v: v.get("value") if isinstance(v, dict) else v
        )
        merged = merged.drop(columns=["Blocked Reason"])
    else:
        merged["Blockiert/Wartend"] = None

    # Zustand und Grund trennen
    zustand_grund = merged["Blockiert/Wartend"].apply(
        lambda t: pd.Series(
            _split_blocked_reason(t),
            index=["Blockiert/Wartend_Zustand", "Blockiert/Wartend_Grund"],
        )
    )
    merged[["Blockiert/Wartend_Zustand", "Blockiert/Wartend_Grund"]] = zustand_grund

    # Locale-Fix: Deutsche → englische Statusnamen
    if "Issue-Status" in merged.columns:
        merged["Issue-Status"] = merged["Issue-Status"].apply(
            lambda v: _STATUS_MAP.get(str(v), v) if v is not None else v
        )
    if "Status-Kategorie" in merged.columns:
        merged["Status-Kategorie"] = merged["Status-Kategorie"].apply(
            lambda v: _CATEGORY_MAP.get(str(v), v) if v is not None else v
        )

    # TimeInStatusBlocked aus Jira-eigenem Zeit-im-Status-Feld
    if "Time in Status" in merged.columns:
        merged["TimeInStatusBlocked"] = merged["Time in Status"].apply(
            _parse_time_in_status_blocked
        )
        merged = merged.drop(columns=["Time in Status"])
    else:
        merged["TimeInStatusBlocked"] = None

    # Berechnete Zeitmetriken
    now = datetime.now()

    def _lead_time(row: dict) -> int | None:
        return (_days_plus_one(row.get("Resolved"), row.get("Ready4Progress_first"))
                if row.get("Issue-Status") == "Resolved" else None)

    def _cycle_time(row: dict) -> int | None:
        return (_days_plus_one(row.get("Resolved"), row.get("In Progress_first"))
                if row.get("Issue-Status") == "Resolved" else None)

    def _time_in_wip(row: dict) -> int | None:
        if row.get("Issue-Status") not in ("Resolved", "Rejected") \
                and row.get("In Progress_first") is not None:
            return _days_plus_one(now, row.get("In Progress_first"))
        return None

    def _time_in_actual_status(row: dict) -> int | None:
        status = row.get("Issue-Status")
        if status in ("Resolved", "Rejected") or not status:
            return None
        start = row.get(status)
        return _days_plus_one(now, start) if start is not None else None

    merged["LeadTime"]           = merged.apply(_lead_time, axis=1)
    merged["CycleTime"]          = merged.apply(_cycle_time, axis=1)
    merged["TimeInWIP"]          = merged.apply(_time_in_wip, axis=1)
    merged["TimeInActualStatus"] = merged.apply(_time_in_actual_status, axis=1)

    # Schreibweise normalisieren: ready4Test → Ready4Test
    for old, new in [
        ("ready4Test",               "Ready4Test"),
        ("ready4Test_first",         "Ready4Test_first"),
        ("ready4Test_Count",         "Ready4Test_Count"),
        ("leaving_ready4Test",       "leaving_Ready4Test"),
        ("leaving_ready4Test_first", "leaving_Ready4Test_first"),
    ]:
        if old in merged.columns:
            merged = merged.rename(columns={old: new})

    merged["LoadedFromJiraAt"] = now

    # Spalten-Reihenfolge: Head + Statusblöcke + Tail (analog M-Code-Logik)
    head = [
        "Jira-ID", "project.key", "project.name", "Issue-Type",
        "Created (Status New)", "Blockiert/Wartend", "Issue-Status", "Status-Kategorie",
    ]
    status_names = sorted(
        c[:-len("_Count")]
        for c in merged.columns
        if c.endswith("_Count") and not c.startswith("leaving_")
    )
    status_block: list[str] = []
    for s in status_names:
        status_block += [s, f"{s}_first", f"leaving_{s}_first", f"leaving_{s}", f"{s}_Count"]

    tail = [
        "Blockiert/Wartend_Grund", "Blockiert/Wartend_Zustand", "TimeInStatusBlocked",
        "LeadTime", "CycleTime", "TimeInWIP", "TimeInActualStatus",
        "Squad", "Modifier", "LoadedFromJiraAt",
    ]

    all_cols   = list(merged.columns)
    desired    = [c for c in head + status_block + tail if c in all_cols]
    leftover   = [c for c in all_cols if c not in set(desired)]
    merged     = merged[[c for c in desired + leftover if c in merged.columns]]
    return merged


# ─────────────────────────────────────────────────────────────────────────────
# OUTPUT: JiraBlockermanagement
# ─────────────────────────────────────────────────────────────────────────────

def build_jira_blockermanagement(blocked_history: pd.DataFrame) -> pd.DataFrame:
    """JiraBlockermanagement: Blocked-Episoden mit Start, Ende, Dauer und Kontext."""
    _log("JiraBlockermanagement – Episoden aufbauen...")
    if blocked_history.empty:
        return pd.DataFrame()

    src = blocked_history.copy()
    src = src[src["issues.key"].notna() & src["history.created"].notna()]
    if src.empty:
        return pd.DataFrame()

    key_cols = ["issues.key", "status.name", "Squad", "Modifier"]

    # ── Start-Events (Issue wurde blockiert: toString gesetzt) ───────────────
    starts_raw = src[
        src["toString"].notna() & (src["toString"].str.strip() != "")
    ].rename(columns={"history.created": "BlockedStart", "toString": "BlockedReason"})

    seq_frames: list[pd.DataFrame] = []
    for _, grp in starts_raw.groupby(key_cols, sort=False):
        g = grp.sort_values("BlockedStart").reset_index(drop=True)
        g["BlockedSeq"] = range(1, len(g) + 1)
        seq_frames.append(g[key_cols + ["BlockedStart", "BlockedReason", "BlockedSeq"]])
    if not seq_frames:
        return pd.DataFrame()
    starts = pd.concat(seq_frames, ignore_index=True)

    # ── End-Events (Issue verließ Blocked-Zustand: fromString gesetzt) ──────
    ends_raw = src[
        src["fromString"].notna() & (src["fromString"].str.strip() != "")
    ].rename(columns={"history.created": "BlockedEnd"})

    end_frames: list[pd.DataFrame] = []
    for _, grp in ends_raw.groupby(key_cols, sort=False):
        g = grp.sort_values("BlockedEnd").reset_index(drop=True)
        g["BlockedSeq"] = range(1, len(g) + 1)
        end_frames.append(g[key_cols + ["BlockedEnd", "BlockedSeq"]])

    if end_frames:
        ends   = pd.concat(end_frames, ignore_index=True)
        joined = starts.merge(ends, on=key_cols + ["BlockedSeq"], how="left")
    else:
        joined = starts.copy()
        joined["BlockedEnd"] = None

    # ── Dauer berechnen ─────────────────────────────────────────────────────
    def _dur_hours(row: dict) -> float | None:
        s, e = row.get("BlockedStart"), row.get("BlockedEnd")
        if s is None or e is None:
            return None
        try:
            return (pd.Timestamp(e) - pd.Timestamp(s)).total_seconds() / 3600
        except Exception:
            return None

    joined["BlockedDurationHours"] = joined.apply(_dur_hours, axis=1)

    # ── Zustand / Grund aus BlockedReason trennen ────────────────────────────
    zustand_grund = joined["BlockedReason"].apply(
        lambda t: pd.Series(
            _split_blocked_reason(t),
            index=["Blockiert/Wartend_Zustand", "Blockiert/Wartend_Grund"],
        )
    )
    joined[["Blockiert/Wartend_Zustand", "Blockiert/Wartend_Grund"]] = zustand_grund

    joined = joined.rename(columns={"status.name": "Status"})

    # ── Wie oft in Blocked je Issue ──────────────────────────────────────────
    count_map = joined.groupby("issues.key").size().rename("Wie oft in Blocked")
    joined    = joined.merge(count_map, on="issues.key", how="left")

    # ── BlockiertWartendSeit (Tage) ──────────────────────────────────────────
    now = datetime.now()

    def _seit(row: dict) -> int | None:
        if row.get("BlockedEnd") is None and row.get("BlockedStart") is not None:
            try:
                return (now - pd.Timestamp(row["BlockedStart"])).days
            except Exception:
                return None
        if row.get("BlockedDurationHours") is not None:
            return math.ceil(row["BlockedDurationHours"] / 24)
        return None

    joined["BlockiertWartendSeit"] = joined.apply(_seit, axis=1)
    joined["LoadedFromJiraAt"]     = now
    return joined


# ─────────────────────────────────────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Jira REST API → flowdata.json Export"
    )
    parser.add_argument(
        "--output", default=OUTPUT_PATH,
        help=f"Ausgabepfad (Standard: {OUTPUT_PATH})",
    )
    parser.add_argument(
        "--dry-run", action="store_true",
        help="Konfiguration ausgeben, keinen API-Aufruf starten",
    )
    args = parser.parse_args()

    if args.dry_run:
        _log("Dry-Run – Konfiguration:")
        _log(f"  JIRA_URL:  {JIRA_BASE_URL}")
        _log(f"  JIRA_USER: {JIRA_USER or '(nicht gesetzt)'}")
        _log(f"  Projekte:  {[p['Project'] for p in PROJECTS]}")
        _log(f"  Ausgabe:   {args.output}")
        return

    if not JIRA_USER or not JIRA_TOKEN:
        _log("⚠ JIRA_USER und JIRA_TOKEN als Umgebungsvariablen setzen.")
        sys.exit(1)

    _log("═" * 60)
    _log("Jira Export gestartet")
    _log("═" * 60)

    # ── Abrufen ───────────────────────────────────────────────────────────
    raw_epics_base   = fetch_epics_base(PROJECTS)
    raw_epics_hist   = fetch_epics_history(PROJECTS)
    raw_stories_base = fetch_stories_base(PROJECTS)
    raw_stories_hist = fetch_stories_history(PROJECTS)

    # ── Transformieren ────────────────────────────────────────────────────
    epics_base   = build_epics_base(raw_epics_base)
    stories_base = build_stories_base(raw_stories_base)

    # Changelog wird EINMAL entfaltet und an beide Zweige weitergegeben
    changelog_flat  = build_changelog_flat(raw_epics_hist, raw_stories_hist)
    status_history  = build_status_history(changelog_flat)
    blocked_history = build_blocked_field_history(changelog_flat, stories_base)

    epics_status_pivot = build_epics_status_pivot(status_history)
    stories_status_agg = build_stories_status_agg(status_history)

    jira_epics             = build_jira_epics(epics_base, epics_status_pivot)
    jira_stories           = build_jira_stories(stories_base, stories_status_agg)
    jira_blockermanagement = build_jira_blockermanagement(blocked_history)

    # ── Ausgabe ───────────────────────────────────────────────────────────
    _log("JSON erzeugen und schreiben...")
    output = {
        "meta": {
            "exportDate": datetime.now(timezone.utc).isoformat(),
            "source":     "Jira",
            "version":    "1",
        },
        "sheets": {
            "JiraStories":           _df_to_records(jira_stories),
            "JiraEpics":             _df_to_records(jira_epics),
            "JiraBlockermanagement": _df_to_records(jira_blockermanagement),
        },
    }

    with open(args.output, "w", encoding="utf-8") as fh:
        json.dump(output, fh, ensure_ascii=False, default=str)

    sizes = {k: len(v) for k, v in output["sheets"].items()}
    _log("═" * 60)
    _log(f"✓ Export abgeschlossen → {args.output}")
    for sheet, count in sizes.items():
        _log(f"  {sheet}: {count} Zeilen")
    _log("═" * 60)


if __name__ == "__main__":
    main()
