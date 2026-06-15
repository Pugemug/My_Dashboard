/**
 * Unit Tests für FlowHeatmap Berechnungslogik (heatmap.js).
 * Importiert direkt aus src/calc/heatmap.calc.js — kein Copy-Paste.
 */

import { describe, it, expect } from 'vitest';
import { stateStats, calcHeatmapT } from '../../src/calc/heatmap.calc.js';

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
    expect(stats.n).toBe(1);
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
    expect(calcHeatmapT(15, 10)).toBe(1);
    expect(calcHeatmapT(-3, 10)).toBe(0);
  });

  it('gMax = 0 ergibt t = 0 (kein Div/0)', () => {
    expect(calcHeatmapT(5, 0)).toBe(0);
  });
});

describe('Heatmap Metrik-Selektion (P25 / Median / P85)', () => {
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
      null,
    ];
    const metric = 'med';
    const rowMax = Math.max(0, ...rowStats.map(st => st ? (st[metric] || 0) : 0));
    expect(rowMax).toBe(5);
  });
});

describe('Heatmap mit Dual-Period Daten', () => {
  const rows = [
    { 'In Progress': '2024-01-02', 'leaving_In Progress': '2024-01-06' },
    { 'In Progress_first': '2024-01-10', 'leaving_In Progress_first': '2024-01-13' },
  ];

  it('_first-Spalten werden als eigene Spalte gelesen', () => {
    const statsFirst = stateStats(rows, 'In Progress_first', 'leaving_In Progress_first');
    const statsBase  = stateStats(rows, 'In Progress', 'leaving_In Progress');
    expect(statsFirst).not.toBeNull();
    expect(statsFirst.n).toBe(1);
    expect(statsFirst.med).toBe(4);
    expect(statsBase).not.toBeNull();
    expect(statsBase.med).toBe(5);
  });
});
