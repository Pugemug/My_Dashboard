/**
 * Unit Tests für core.js Berechnungsfunktionen.
 * Die Logik wird hier direkt implementiert (1:1 aus core.js kopiert),
 * damit kein Browser-Kontext (localStorage, document) nötig ist.
 */

// ── Funktionen aus core.js (1:1, kein Browser-Import) ──────────────────────

function toDate(v) {
  if (!v) return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  if (typeof v === 'number') {
    const d = new Date(Math.round((v - 25569) * 86400000));
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof v === 'string') {
    const d = new Date(v.trim());
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
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

function fmt(v) { return v == null ? '–' : v.toFixed(1) + 'd'; }

function intTicks(max, n) {
  if (max <= 0) return [0];
  n = n || 5;
  const raw = max / n;
  const mag = Math.pow(10, Math.floor(Math.log10(Math.max(raw, 1))));
  let step = [1, 2, 5, 10].map(f => f * mag).find(f => f >= raw) || mag * 10;
  step = Math.max(1, Math.round(step));
  const ticks = [];
  for (let v = 0; v <= max + step * 0.01; v += step) ticks.push(Math.round(v));
  if (ticks[ticks.length - 1] < max) ticks.push(ticks[ticks.length - 1] + step);
  return [...new Set(ticks)];
}

// ── Dual-Period-Logik (aus allen Visuals) ───────────────────────────────────
const DUAL_PERIOD_THRESHOLD_MS = 43_200_000; // 0,5 Tage

function dualPeriodDuration(entryFirst, exitFirst, entry, exit) {
  const ef = toDate(entryFirst), xf = toDate(exitFirst);
  const e  = toDate(entry),      x  = toDate(exit);

  // Beide Perioden müssen vollständig sein
  if (!e || !x) return null;

  const sameDay = ef && e && Math.abs(ef - e) < DUAL_PERIOD_THRESHOLD_MS;

  if (sameDay || !ef || !xf) {
    // Nur eine Periode
    return dur(e, x);
  } else {
    // Beide Perioden addieren
    const d1 = dur(ef, xf);
    const d2 = dur(e,  x);
    if (d1 == null || d2 == null) return null;
    return d1 + d2;
  }
}

// ── Aktiv/Erledigt-Logik ────────────────────────────────────────────────────
function isErledigt(row) {
  return !!(row['Resolved'] || row['Rejected']);
}

// ═══════════════════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';

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
    // Start und Start_first am gleichen Tag → nur eine Periode
    const d = dualPeriodDuration(
      '2024-01-05', '2024-01-08',  // _first (gleich wie Basis)
      '2024-01-05', '2024-01-08'   // Basis
    );
    expect(d).toBe(4); // 5,6,7,8 = 4 Tage
  });

  it('Dual-Period: Item zweimal in Status (X_first != X)', () => {
    // Erster Durchlauf: 3 Tage, zweiter Durchlauf: 2 Tage → 5 Tage gesamt
    const d = dualPeriodDuration(
      '2024-01-01', '2024-01-03',  // _first: 3 Tage (1,2,3)
      '2024-01-10', '2024-01-11'   // Basis: 2 Tage (10,11)
    );
    expect(d).toBe(5);
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
