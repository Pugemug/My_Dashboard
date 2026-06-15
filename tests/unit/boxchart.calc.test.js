/**
 * Unit Tests für LeadTime BoxChart Berechnungslogik (boxchart.js).
 * Importiert direkt aus src/calc/boxchart.calc.js — kein Copy-Paste.
 */

import { describe, it, expect } from 'vitest';
import { calcBoxStats, isOutlier } from '../../src/calc/boxchart.calc.js';

describe('BoxChart Statistiken', () => {
  const values = [2, 3, 4, 5, 6, 7, 8, 9, 10, 20].sort((a, b) => a - b);
  let stats;

  it('berechnet Box-Stats ohne Fehler', () => {
    stats = calcBoxStats(values);
    expect(stats).not.toBeNull();
  });

  it('P25 < Median < P85', () => {
    stats = calcBoxStats(values);
    expect(stats.p25).toBeLessThan(stats.med);
    expect(stats.med).toBeLessThan(stats.p85);
  });

  it('IQR = P85 - P25', () => {
    stats = calcBoxStats(values);
    expect(stats.iqr).toBeCloseTo(stats.p85 - stats.p25, 5);
  });

  it('Whisker oben <= Maximum', () => {
    stats = calcBoxStats(values);
    expect(stats.wUp).toBeLessThanOrEqual(stats.allMax);
  });

  it('Whisker unten >= Minimum', () => {
    stats = calcBoxStats(values);
    expect(stats.wDn).toBeGreaterThanOrEqual(stats.allMin);
  });

  it('erkennt Ausreißer korrekt', () => {
    stats = calcBoxStats(values);
    expect(isOutlier(20, stats)).toBe(true);
    expect(isOutlier(5, stats)).toBe(false);
  });
});

describe('BoxChart Grenzfälle', () => {
  it('1-Element-Array: alle Statistiken gleich', () => {
    const stats = calcBoxStats([7]);
    expect(stats.p25).toBe(7);
    expect(stats.med).toBe(7);
    expect(stats.p85).toBe(7);
    expect(stats.iqr).toBe(0);
  });

  it('2-Element-Array: keine Division durch null', () => {
    const stats = calcBoxStats([3, 9]);
    expect(stats).not.toBeNull();
    expect(stats.n).toBe(2);
  });

  it('alle gleichen Werte: IQR = 0, kein Ausreißer', () => {
    const stats = calcBoxStats([5, 5, 5, 5, 5]);
    expect(stats.iqr).toBe(0);
    expect(isOutlier(5, stats)).toBe(false);
  });

  it('leeres Array gibt null zurück', () => {
    expect(calcBoxStats([])).toBeNull();
  });
});
