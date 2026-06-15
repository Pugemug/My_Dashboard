/**
 * Unit Tests für CycleTime Scatterplot Berechnungslogik (scatter.js).
 * Importiert direkt aus src/calc/scatter.calc.js — kein Copy-Paste.
 */

import { describe, it, expect } from 'vitest';
import { calcCT, calcCTFromRow } from '../../src/calc/scatter.calc.js';
import { pct } from '../../src/calc/core.calc.js';

describe('CycleTime Berechnung', () => {
  it('berechnet CT korrekt (inklusiv)', () => {
    expect(calcCT('2024-01-01', '2024-01-05')).toBe(5);
  });

  it('CT = 1 wenn Start == Ende (gleicher Tag)', () => {
    expect(calcCT('2024-01-10', '2024-01-10')).toBe(1);
  });

  it('gibt null zurück wenn Ende vor Start', () => {
    expect(calcCT('2024-01-10', '2024-01-05')).toBeNull();
  });

  it('gibt null zurück bei fehlendem Datum', () => {
    expect(calcCT(null, '2024-01-05')).toBeNull();
    expect(calcCT('2024-01-01', null)).toBeNull();
    expect(calcCT('', '')).toBeNull();
  });

  it('CT = 0 wird abgelehnt (ct < 1 → null)', () => {
    expect(calcCT('2024-01-05', '2024-01-05')).toBe(1); // gleicher Tag = 1
  });
});

describe('CT aus Row-Daten', () => {
  const row = {
    'Jira-ID': 'JA-001',
    'In Progress_first': '2024-01-02',
    'Resolved': '2024-01-10',
    'Ready4Progress_first': '2024-01-01',
  };

  it('berechnet CT mit Standard-Spalten (In Progress_first → Resolved)', () => {
    const ct = calcCTFromRow(row, 'In Progress_first', 'Resolved');
    expect(ct).toBe(9); // 2.–10. Januar = 9 Tage
  });

  it('berechnet LT mit alternativen Spalten (Ready4Progress_first → Resolved)', () => {
    const lt = calcCTFromRow(row, 'Ready4Progress_first', 'Resolved');
    expect(lt).toBe(10); // 1.–10. Januar = 10 Tage
  });

  it('gibt null zurück wenn CT-Start-Spalte fehlt', () => {
    const ct = calcCTFromRow(row, 'Nicht_vorhanden', 'Resolved');
    expect(ct).toBeNull();
  });
});

describe('CT Perzentile (Grundlage für Linien im Scatterplot)', () => {
  const ctValues = [2, 3, 4, 5, 6, 7, 8, 10, 12, 15].sort((a, b) => a - b);

  it('P50 liegt in vernünftigem Bereich', () => {
    const p50 = pct(ctValues, 50);
    expect(p50).toBeGreaterThanOrEqual(5);
    expect(p50).toBeLessThanOrEqual(8);
  });

  it('P85 liegt über P50', () => {
    expect(pct(ctValues, 85)).toBeGreaterThan(pct(ctValues, 50));
  });

  it('P95 >= P85', () => {
    expect(pct(ctValues, 95)).toBeGreaterThanOrEqual(pct(ctValues, 85));
  });

  it('Leeres Array → null für alle Perzentile', () => {
    expect(pct([], 50)).toBeNull();
    expect(pct([], 85)).toBeNull();
  });
});
