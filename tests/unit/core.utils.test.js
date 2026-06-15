/**
 * Unit Tests für core.js Berechnungsfunktionen.
 * Importiert direkt aus src/calc/core.calc.js — kein Copy-Paste.
 */

import { describe, it, expect } from 'vitest';
import {
  toDate,
  dur,
  pct,
  fmt,
  intTicks,
  DUAL_PERIOD_THRESHOLD_MS,
  dualPeriodDuration,
  isErledigt,
} from '../../src/calc/core.calc.js';

// ── toDate ──────────────────────────────────────────────────────────────────
describe('toDate', () => {
  it('gibt null zurück für null/undefined/leer', () => {
    expect(toDate(null)).toBeNull();
    expect(toDate(undefined)).toBeNull();
    expect(toDate('')).toBeNull();
  });

  it('wandelt Excel-Seriennummer um (44927 = 2023-01-01)', () => {
    const d = toDate(44927);
    expect(d).toBeInstanceOf(Date);
    expect(d.getUTCFullYear()).toBe(2023);
    expect(d.getUTCMonth()).toBe(0); // Januar = 0
    expect(d.getUTCDate()).toBe(1);
  });

  it('wandelt ISO-String um', () => {
    const d = toDate('2024-03-15');
    expect(d).toBeInstanceOf(Date);
    expect(d.getFullYear()).toBe(2024);
  });

  it('gibt null zurück für ungültigen String', () => {
    expect(toDate('kein-datum')).toBeNull();
    expect(toDate('abc')).toBeNull();
  });

  it('gibt Date-Objekt unverändert zurück', () => {
    const d = new Date('2024-01-01');
    expect(toDate(d)).toBe(d);
  });

  it('gibt null zurück für ungültiges Date-Objekt', () => {
    expect(toDate(new Date('invalid'))).toBeNull();
  });
});

// ── dur ─────────────────────────────────────────────────────────────────────
describe('dur', () => {
  it('berechnet Dauer inklusiv (Standardfall)', () => {
    expect(dur('2024-01-01', '2024-01-03')).toBe(3);
  });

  it('gibt 1 zurück wenn Start == Ende (gleicher Tag)', () => {
    expect(dur('2024-01-15', '2024-01-15')).toBe(1);
  });

  it('gibt null zurück wenn Ende vor Start liegt', () => {
    expect(dur('2024-01-10', '2024-01-05')).toBeNull();
  });

  it('gibt null zurück wenn ein Datum null ist', () => {
    expect(dur(null, '2024-01-01')).toBeNull();
    expect(dur('2024-01-01', null)).toBeNull();
    expect(dur(null, null)).toBeNull();
  });

  it('verarbeitet Excel-Seriennummern', () => {
    const d = dur(44927, 44930); // 3 Tage Differenz + 1 inklusiv = 4
    expect(d).toBe(4);
  });
});

// ── pct ─────────────────────────────────────────────────────────────────────
describe('pct', () => {
  it('gibt null für leeres Array zurück', () => {
    expect(pct([], 50)).toBeNull();
  });

  it('gibt das einzige Element zurück (1-Element-Array)', () => {
    expect(pct([42], 50)).toBe(42);
    expect(pct([42], 85)).toBe(42);
  });

  it('berechnet Median korrekt (p=50)', () => {
    expect(pct([1, 2, 3, 4, 5], 50)).toBe(3);
  });

  it('berechnet p85 korrekt', () => {
    const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const result = pct(arr, 85);
    expect(result).toBeGreaterThanOrEqual(8);
    expect(result).toBeLessThanOrEqual(9);
  });

  it('interpoliert zwischen Werten', () => {
    const result = pct([0, 10], 50);
    expect(result).toBe(5);
  });
});

// ── fmt ─────────────────────────────────────────────────────────────────────
describe('fmt', () => {
  it('formatiert Zahl mit einer Nachkommastelle und "d"', () => {
    expect(fmt(5)).toBe('5.0d');
    expect(fmt(3.14159)).toBe('3.1d');
  });

  it('gibt "–" für null zurück', () => {
    expect(fmt(null)).toBe('–');
    expect(fmt(undefined)).toBe('–');
  });
});

// ── intTicks ─────────────────────────────────────────────────────────────────
describe('intTicks', () => {
  it('gibt [0] zurück wenn max <= 0', () => {
    expect(intTicks(0)).toEqual([0]);
    expect(intTicks(-5)).toEqual([0]);
  });

  it('beginnt immer mit 0', () => {
    const ticks = intTicks(7, 5);
    expect(ticks[0]).toBe(0);
  });

  it('letzter Tick ist >= max', () => {
    const max = 7;
    const ticks = intTicks(max, 5);
    expect(ticks[ticks.length - 1]).toBeGreaterThanOrEqual(max);
  });

  it('alle Ticks sind ganzzahlig', () => {
    const ticks = intTicks(23, 5);
    ticks.forEach(t => expect(Number.isInteger(t)).toBe(true));
  });

  it('Schrittweite ist immer >= 1', () => {
    const ticks = intTicks(2, 5);
    for (let i = 1; i < ticks.length; i++) {
      expect(ticks[i] - ticks[i - 1]).toBeGreaterThanOrEqual(1);
    }
  });
});

// ── Dual-Period-Logik ────────────────────────────────────────────────────────
describe('Dual-Period-Logik', () => {
  it('einfacher Fall: Item nur einmal in Status (X_first == X)', () => {
    const d = dualPeriodDuration(
      '2024-01-05', '2024-01-08',
      '2024-01-05', '2024-01-08'
    );
    expect(d).toBe(4); // 5,6,7,8 = 4 Tage
  });

  it('Dual-Period: Item zweimal in Status (X_first != X)', () => {
    const d = dualPeriodDuration(
      '2024-01-01', '2024-01-03',
      '2024-01-10', '2024-01-11'
    );
    expect(d).toBe(5); // 3 + 2 Tage
  });

  it('gibt null zurück wenn Basis-Daten fehlen', () => {
    expect(dualPeriodDuration(
      '2024-01-01', '2024-01-03',
      null, '2024-01-11'
    )).toBeNull();
  });
});

// ── Aktiv/Erledigt-Logik ─────────────────────────────────────────────────────
describe('Aktiv/Erledigt-Logik (XOR)', () => {
  it('erledigt wenn Resolved gefüllt', () => {
    expect(isErledigt({ Resolved: '2024-01-10', Rejected: '' })).toBe(true);
  });

  it('erledigt wenn Rejected gefüllt', () => {
    expect(isErledigt({ Resolved: '', Rejected: '2024-01-10' })).toBe(true);
  });

  it('aktiv wenn beide leer', () => {
    expect(isErledigt({ Resolved: '', Rejected: '' })).toBe(false);
    expect(isErledigt({ Resolved: null, Rejected: null })).toBe(false);
  });

  it('erledigt wenn beide gefüllt (Datenqualitätsproblem — kein Absturz)', () => {
    expect(isErledigt({ Resolved: '2024-01-10', Rejected: '2024-01-10' })).toBe(true);
  });
});
