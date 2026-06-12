/**
 * Unit Tests für Flow Efficiency Berechnungslogik (flowefficiency.js).
 * FE = (lt - totalWait) / lt × 100%
 */

import { describe, it, expect } from 'vitest';

const WAIT_STATUS = [
  'Blocked', 'Ready4Test', 'Ready4QS',
  'Ready4Review', 'Ready4E2E-Test', 'Ready4Production',
];

function toDate(v) {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

function dur(a, b) {
  const da = toDate(a), db = toDate(b);
  if (!da || !db) return null;
  const d = (db - da) / 86400000 + 1;
  return d > 0 ? d : null;
}

/**
 * Berechnet Flow Efficiency für ein einzelnes Item.
 * Gibt null zurück wenn LT nicht berechenbar oder totalWait > lt.
 */
function calcItemFE(row, ltStartCol, ltEndCol) {
  const lt = dur(row[ltStartCol], row[ltEndCol]);
  if (!lt) return null;

  let totalWait = 0;
  WAIT_STATUS.forEach(status => {
    const entry = row[status + '_first'] || row[status];
    const exit  = row['leaving_' + status + '_first'] || row['leaving_' + status];
    const d = dur(entry, exit);
    if (d) totalWait += d;
  });

  if (totalWait > lt) return null; // Datenfehler
  return ((lt - totalWait) / lt) * 100;
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('Flow Efficiency Grundberechnung', () => {
  it('100% FE wenn keine Wartezeit', () => {
    const row = {
      'Ready4Progress_first': '2024-01-01',
      'Resolved': '2024-01-10',
      // keine Wartezeiten
    };
    const fe = calcItemFE(row, 'Ready4Progress_first', 'Resolved');
    expect(fe).toBeCloseTo(100, 0);
  });

  it('50% FE wenn halbe Zeit Warten', () => {
    // LT = 10 Tage, Ready4Test dauert 5 Tage
    const row = {
      'Ready4Progress_first': '2024-01-01',
      'Resolved': '2024-01-10',
      'Ready4Test_first': '2024-01-03',
      'leaving_Ready4Test_first': '2024-01-07', // 5 Tage (3,4,5,6,7)
    };
    const fe = calcItemFE(row, 'Ready4Progress_first', 'Resolved');
    // LT = 10, wait = 5 → FE = 5/10 * 100 = 50%
    expect(fe).toBeCloseTo(50, 0);
  });

  it('gibt null zurück wenn LT nicht berechenbar', () => {
    const row = { 'Ready4Progress_first': null, 'Resolved': '2024-01-10' };
    expect(calcItemFE(row, 'Ready4Progress_first', 'Resolved')).toBeNull();
  });

  it('gibt null zurück wenn totalWait > lt (Datenfehler)', () => {
    // Wartezeit länger als Gesamtdurchlaufzeit = inkonsistente Daten
    const row = {
      'Ready4Progress_first': '2024-01-05',
      'Resolved': '2024-01-06',           // LT = 2 Tage
      'Ready4Test_first': '2024-01-01',
      'leaving_Ready4Test_first': '2024-01-10', // wait = 10 Tage > 2 Tage
    };
    expect(calcItemFE(row, 'Ready4Progress_first', 'Resolved')).toBeNull();
  });

  it('FE ist immer zwischen 0 und 100', () => {
    const row = {
      'Ready4Progress_first': '2024-01-01',
      'Resolved': '2024-01-20',
      'Blocked_first': '2024-01-05',
      'leaving_Blocked_first': '2024-01-08',
    };
    const fe = calcItemFE(row, 'Ready4Progress_first', 'Resolved');
    expect(fe).toBeGreaterThanOrEqual(0);
    expect(fe).toBeLessThanOrEqual(100);
  });
});

describe('Flow Efficiency Grenzfälle', () => {
  it('Item mit keinen Wartezeiten-Spalten: FE = 100%', () => {
    const row = {
      'Ready4Progress_first': '2024-02-01',
      'Resolved': '2024-02-05',
    };
    expect(calcItemFE(row, 'Ready4Progress_first', 'Resolved')).toBeCloseTo(100, 0);
  });

  it('Item mit 0 Wartezeit in allen Spalten: FE = 100%', () => {
    const row = {
      'Ready4Progress_first': '2024-02-01',
      'Resolved': '2024-02-05',
      'Blocked_first': null,
      'leaving_Blocked_first': null,
    };
    expect(calcItemFE(row, 'Ready4Progress_first', 'Resolved')).toBeCloseTo(100, 0);
  });
});
