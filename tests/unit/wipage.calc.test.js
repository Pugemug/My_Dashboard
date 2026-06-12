/**
 * Unit Tests für WIPAge Chart Berechnungslogik (wipage.js).
 * Fokus: Altersberechnung, Aktiv-Logik, Dual-Period.
 */

import { describe, it, expect } from 'vitest';

const THRESHOLD_MS = 43_200_000; // 0,5 Tage

function toDate(v) {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * WIPAge Altersberechnung (aus wipage.js Zeilen 351–380).
 * Wie lange ist ein Item schon im aktuellen Status?
 */
function calcAge(row, statusName, todayMs) {
  const entryFirst  = toDate(row[statusName + '_first']);
  const entryReg    = toDate(row[statusName]);
  const leavingFirst = toDate(row['leaving_' + statusName + '_first']);

  if (entryReg != null) {
    const ageReg = Math.max(0, Math.round((todayMs - entryReg.getTime()) / 86400000));
    if (entryFirst != null && leavingFirst != null &&
        Math.abs(entryFirst.getTime() - entryReg.getTime()) >= THRESHOLD_MS) {
      // Dual-Period: erste Periode bereits abgeschlossen, zweite läuft noch
      const firstPeriod = Math.max(0, Math.round(
        (leavingFirst.getTime() - entryFirst.getTime()) / 86400000
      ) + 1);
      return firstPeriod + ageReg;
    }
    return ageReg;
  } else if (entryFirst != null) {
    return Math.max(0, Math.round((todayMs - entryFirst.getTime()) / 86400000));
  }
  return null;
}

/**
 * Aktiv-Logik (XOR): Item ist aktiv wenn weder Resolved noch Rejected.
 */
function isActive(row) {
  return !row['Resolved'] && !row['Rejected'];
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('WIPAge Aktiv-Logik', () => {
  it('aktiv wenn beide leer', () => {
    expect(isActive({ Resolved: null, Rejected: null })).toBe(true);
    expect(isActive({ Resolved: '', Rejected: '' })).toBe(true);
  });

  it('nicht aktiv wenn Resolved gesetzt', () => {
    expect(isActive({ Resolved: '2024-01-10', Rejected: null })).toBe(false);
  });

  it('nicht aktiv wenn Rejected gesetzt', () => {
    expect(isActive({ Resolved: null, Rejected: '2024-01-10' })).toBe(false);
  });
});

describe('WIPAge Altersberechnung', () => {
  const TODAY = new Date('2024-01-15').getTime();

  it('einfacher Fall: Item ist 5 Tage im Status', () => {
    const row = { 'In Progress': '2024-01-10', 'In Progress_first': '2024-01-10' };
    const age = calcAge(row, 'In Progress', TODAY);
    expect(age).toBe(5); // 10.–15. Jan = 5 Tage
  });

  it('Alter = 0 wenn Item heute in Status eingetreten', () => {
    const row = { 'In Progress': '2024-01-15', 'In Progress_first': '2024-01-15' };
    expect(calcAge(row, 'In Progress', TODAY)).toBe(0);
  });

  it('gibt null zurück wenn kein Eintrittsdatum vorhanden', () => {
    const row = { 'In Progress': null, 'In Progress_first': null };
    expect(calcAge(row, 'In Progress', TODAY)).toBeNull();
  });

  it('Dual-Period: addiert erste abgeschlossene Periode zur laufenden', () => {
    // Erste Periode: 1.–3. Jan (3 Tage inkl. leaving)
    // Zweite Periode: 10.–heute (5 Tage bis 15. Jan)
    // Gesamt: 3 + 1 + 5 = 9 Tage... aber leaving_first ist 3.1 → firstPeriod = (3-1)/86400000+1 = 3
    const row = {
      'In Progress_first':         '2024-01-01',
      'leaving_In Progress_first': '2024-01-03',
      'In Progress':               '2024-01-10',
    };
    const age = calcAge(row, 'In Progress', TODAY);
    // firstPeriod = round((3.Jan - 1.Jan) / 86400000) + 1 = 2 + 1 = 3
    // ageReg = round((15.Jan - 10.Jan) / 86400000) = 5
    expect(age).toBe(8); // 3 + 5
  });
});

describe('WIPAge ExcludeList Parsing', () => {
  function parseExcludeList(str) {
    return str.split(',').map(s => s.trim()).filter(Boolean);
  }

  it('parst Standard-ExcludeList korrekt', () => {
    const result = parseExcludeList('Rejected, Resume');
    expect(result).toEqual(['Rejected', 'Resume']);
  });

  it('ignoriert leere Einträge', () => {
    expect(parseExcludeList('')).toHaveLength(0);
  });

  it('trimmt Leerzeichen', () => {
    const result = parseExcludeList('  Rejected ,  Resume  ');
    expect(result).toEqual(['Rejected', 'Resume']);
  });
});
