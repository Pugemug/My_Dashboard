/**
 * Unit Tests für LeadTime BoxChart Berechnungslogik (boxchart.js).
 * Fokus: Box-Plot Statistiken (P25, Median, P85, Whisker, IQR, Ausreißer).
 */

import { describe, it, expect } from 'vitest';

function pct(arr, p) {
  if (!arr.length) return null;
  if (arr.length === 1) return arr[0];
  const i = (p / 100) * (arr.length - 1);
  const lo = Math.floor(i), hi = Math.ceil(i);
  return lo === hi ? arr[lo] : arr[lo] + (arr[hi] - arr[lo]) * (i - lo);
}

/**
 * Box-Plot Statistiken berechnen (aus boxchart.js ~Zeile 488–492).
 * Whisker = 1,5 × IQR außerhalb der Box.
 */
function calcBoxStats(sortedValues) {
  if (!sortedValues.length) return null;
  const p25    = pct(sortedValues, 25);
  const med    = pct(sortedValues, 50);
  const p85    = pct(sortedValues, 85);
  const iqr    = p85 - p25;
  const fence  = 1.5 * iqr;
  const allMax = sortedValues[sortedValues.length - 1];
  const allMin = sortedValues[0];

  // Whisker: engster Wert noch innerhalb der Fence
  const wUp = Math.min(allMax, p85 + fence);
  const wDn = Math.max(allMin, p25 - fence);

  return { p25, med, p85, iqr, fence, wUp, wDn, allMin, allMax, n: sortedValues.length };
}

function isOutlier(value, stats) {
  return value > stats.wUp || value < stats.wDn;
}

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
    // 20 ist weit über P85 + 1.5*IQR → Ausreißer
    expect(isOutlier(20, stats)).toBe(true);
    // 5 liegt innerhalb der Box → kein Ausreißer
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
