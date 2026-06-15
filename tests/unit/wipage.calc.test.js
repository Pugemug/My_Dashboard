/**
 * Unit Tests für WIPAge Chart Berechnungslogik (wipage.js).
 * Importiert direkt aus src/calc/wipage.calc.js — kein Copy-Paste.
 */

import { describe, it, expect } from 'vitest';
import { calcAge, isActive, parseExcludeList } from '../../src/calc/wipage.calc.js';

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
