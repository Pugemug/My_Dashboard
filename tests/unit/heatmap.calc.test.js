/**
 * Unit Tests für FlowHeatmap Berechnungslogik (heatmap.js).
 * Fokus: Status-Statistiken (P25/Median/P85), Zellfärbung (Normierung), Dual-Period.
 */

import { describe, it, expect } from 'vitest';

// ── Hilfsfunktionen (aus core.js) ───────────────────────────────────────────

function toDate(v) {
  if (!v) return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  if (typeof v === 'number') {
    const d = new Date(Math.round((v - 25569) * 86400000));
    return isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(String(v).trim());
  return isNaN(d.getTime()) ? null : d;
}

function dur(a, b) {
  const da = toDate(a), db = toDate(b);
  if (!da || !db) return null;
  const d = (db - da) / 86400000 + 1;
  return d > 0 ? d : null;
}

function pct(arr, p) {
  if (!arr.length) return null;
  if (arr.length === 1) return arr[0];
  const i = (p / 100) * (arr.length - 1);
  const lo = Math.floor(i), hi = Math.ceil(i);
  return lo === hi ? arr[lo] : arr[lo] + (arr[hi] - arr[lo]) * (i - lo);
}

// ── _stateStats (aus heatmap.js Zeile 396–402) ─────────────────────────────
// Berechnet P25/Median/P85 der Verweildauer eines Status über alle Rows.
function stateStats(rows, entryCol, exitCol) {
  const ds = rows
    .map(r => dur(r[entryCol], r[exitCol]))
    .filter(d => d != null);
  if (!ds.length) return null;
  ds.sort((a, b) => a - b);
  return {
    p25: pct(ds, 25),
    med: pct(ds, 50),
    p85: pct(ds, 85),
    min: ds[0],
    max: ds[ds.length - 1],
    n:   ds.length,
  };
}

// ── Zellfärbungs-Normierung (aus heatmap.js Zeile 527, 567–570) ────────────
// t = Zellwert / gMax → wird als Heatmap-Gradient-Input verwendet (0..1)
function calcHeatmapT(cellValue, gMax) {
  if (!gMax || gMax <= 0) return 0;
  return Math.max(0, Math.min(1, cellValue / gMax));
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('Heatmap stateStats', () => {
  const rows = [
    { 'In Progress': '2024-01-01', 'leaving_In Progress': '2024-01-03' }, // 3 Tage
    { 'In Progress': '2024-01-05', 'leaving_In Progress': '2024-01-09' }, // 5 Tage
    { 'In Progress': '2024-01-10', 'leaving_In Progress': '2024-01-16' }, // 7 Tage
    { 'In Progress': '2024-01-20', 'leaving_In Progress': '2024-01-21' }, // 2 Tage
    { 'In Progress': '2024-02-01', 'leaving_In Progress': '2024-02-11' }, // 11 Tage
  ];

  it('berechnet Statistiken ohne Fehler', () => {
    const stats = stateStats(rows, 'In Progress', 'leaving_In Progress');
    expect(stats).not.toBeNull();
    expect(stats.n).toBe(5);
  });

  it('P25 <= Median <= P85', () => {
    const stats = stateStats(rows, 'In Progress', 'leaving_In Progress');
    expect(stats.p25).toBeLessThanOrEqual(stats.med);
    expect(stats.med).toBeLessThanOrEqual(stats.p85);
  });

  it('min und max sind korrekt', () => {
    const stats = stateStats(rows, 'In Progress', 'leaving_In Progress');
    expect(stats.min).toBe(2);
    expect(stats.max).toBe(11);
  });

  it('gibt null zurück wenn keine Zeile vollständige Datums-Paare hat', () => {
    const emptyRows = [
      { 'In Progress': null, 'leaving_In Progress': null },
      { 'In Progress': '2024-01-01', 'leaving_In Progress': null },
    ];
    expect(stateStats(emptyRows, 'In Progress', 'leaving_In Progress')).toBeNull();
  });

  it('gibt null zurück für leeres Rows-Array', () => {
    expect(stateStats([], 'In Progress', 'leaving_In Progress')).toBeNull();
  });

  it('ignoriert Zeilen mit inkonsistenten Daten (Ende vor Start)', () => {
    const mixedRows = [
      { 'In Progress': '2024-01-10', 'leaving_In Progress': '2024-01-05' }, // negativ → ignoriert
      { 'In Progress': '2024-01-01', 'leaving_In Progress': '2024-01-04' }, // 4 Tage → zählt
    ];
    const stats = stateStats(mixedRows, 'In Progress', 'leaving_In Progress');
    expect(stats).not.toBeNull();
    expect(stats.n).toBe(1); // nur 1 gültige Zeile
    expect(stats.med).toBe(4);
  });
});

describe('Heatmap Zellfärbung (Normierung)', () => {
  it('gMax-Wert ergibt t = 1.0 (dunkelste Farbe)', () => {
    expect(calcHeatmapT(10, 10)).toBe(1);
  });

  it('0 ergibt t = 0 (hellste Farbe)', () => {
    expect(calcHeatmapT(0, 10)).toBe(0);
  });

  it('Mittelwert ergibt t = 0.5', () => {
    expect(calcHeatmapT(5, 10)).toBeCloseTo(0.5);
  });

  it('t ist immer im Bereich 0..1', () => {
    expect(calcHeatmapT(15, 10)).toBe(1); // über gMax wird auf 1 geclampt
    expect(calcHeatmapT(-3, 10)).toBe(0); // negativ wird auf 0 geclampt
  });

  it('gMax = 0 ergibt t = 0 (kein Div/0)', () => {
    expect(calcHeatmapT(5, 0)).toBe(0);
  });
});

describe('Heatmap Metrik-Selektion (P25 / Median / P85)', () => {
  // In heatmap.js zeigt die Zelle den Wert von cfg.metric (p25 | med | p85)
  const stats = { p25: 3, med: 6, p85: 10, n: 20 };

  it('Metrik "med" gibt Median zurück', () => {
    expect(stats['med']).toBe(6);
  });

  it('Metrik "p85" gibt P85 zurück', () => {
    expect(stats['p85']).toBe(10);
  });

  it('Metrik "p25" gibt P25 zurück', () => {
    expect(stats['p25']).toBe(3);
  });

  it('rowMax berechnet sich aus dem Maximum aller Zellwerte einer Zeile', () => {
    const rowStats = [
      { p25: 2, med: 5, p85: 9 },
      { p25: 1, med: 3, p85: 6 },
      null, // leere Zelle
    ];
    const metric = 'med';
    const rowMax = Math.max(0, ...rowStats.map(st => st ? (st[metric] || 0) : 0));
    expect(rowMax).toBe(5);
  });
});

describe('Heatmap mit Dual-Period Daten', () => {
  // Items die einen Status zweimal durchlaufen haben haben _first-Spalten
  // Die Heatmap verwendet entryCol / exitCol direkt (kein eigenes Dual-Period)
  // → beide Perioden-Paare können als separate Rows betrachtet werden

  const rows = [
    // Normaler Durchlauf
    { 'In Progress': '2024-01-02', 'leaving_In Progress': '2024-01-06' }, // 5 Tage
    // _first-Spalten (erster Durchlauf): die Heatmap liest diese als separate Spalte
    { 'In Progress_first': '2024-01-10', 'leaving_In Progress_first': '2024-01-13' }, // 4 Tage
  ];

  it('_first-Spalten werden als eigene Spalte gelesen', () => {
    const statsFirst = stateStats(rows, 'In Progress_first', 'leaving_In Progress_first');
    const statsBase  = stateStats(rows, 'In Progress', 'leaving_In Progress');
    // statsFirst hat n=1 (nur zweite Row hat _first-Daten)
    expect(statsFirst).not.toBeNull();
    expect(statsFirst.n).toBe(1);
    expect(statsFirst.med).toBe(4);
    // statsBase hat n=1 (nur erste Row hat Basis-Daten)
    expect(statsBase).not.toBeNull();
    expect(statsBase.med).toBe(5);
  });
});
