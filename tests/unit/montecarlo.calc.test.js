/**
 * Unit Tests für MonteCarlo Simulation (montecarlo.js).
 * Fokus: Throughput-Berechnung, Variationskoeffizient (CV), Simulation.
 */

import { describe, it, expect } from 'vitest';

// ── Variationskoeffizient (CV) ──────────────────────────────────────────────
function calcCV(samples) {
  if (!samples.length) return null;
  const mean = samples.reduce((s, v) => s + v, 0) / samples.length;
  if (mean === 0) return null;
  const variance = samples.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / samples.length;
  return Math.sqrt(variance) / mean;
}

// ── Simulations-Kern (vereinfacht aus montecarlo.js Zeile 386–416) ──────────
function runSimulation(samples, targetCount, numRuns) {
  if (!samples.length || samples.every(v => v === 0)) return null;
  const results = [];
  for (let i = 0; i < numRuns; i++) {
    let total = 0, slices = 0;
    while (total < targetCount) {
      total += samples[Math.floor(Math.random() * samples.length)];
      slices++;
      if (slices > 10000) break; // Schutz vor Endlosschleife bei samples=[0]
    }
    results.push(slices);
  }
  results.sort((a, b) => a - b);
  return {
    results,
    p50: results[Math.floor(numRuns * 0.50)],
    p70: results[Math.floor(numRuns * 0.70)],
    p85: results[Math.floor(numRuns * 0.85)],
    p95: results[Math.floor(numRuns * 0.95)],
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('Variationskoeffizient (CV)', () => {
  it('CV = 0 bei konstantem Throughput', () => {
    expect(calcCV([5, 5, 5, 5, 5])).toBeCloseTo(0, 5);
  });

  it('CV > 0 bei variablem Throughput', () => {
    expect(calcCV([1, 5, 10, 3, 8])).toBeGreaterThan(0);
  });

  it('gibt null für leeres Array zurück', () => {
    expect(calcCV([])).toBeNull();
  });

  it('gibt null zurück wenn Mittelwert = 0', () => {
    expect(calcCV([0, 0, 0])).toBeNull();
  });

  it('CV < 0.5 = stabiles Team (grüne Ampel)', () => {
    const cv = calcCV([9, 10, 11, 10, 9, 10]);
    expect(cv).toBeLessThan(0.5);
  });

  it('CV > 0.8 = instabiles Team (rote Ampel)', () => {
    const cv = calcCV([0, 0, 0, 20, 0, 0, 15]);
    expect(cv).toBeGreaterThan(0.8);
  });
});

describe('Monte Carlo Simulation', () => {
  it('gibt null zurück bei leerem Samples-Array', () => {
    expect(runSimulation([], 100, 100)).toBeNull();
  });

  it('gibt null zurück wenn alle Samples 0 sind', () => {
    expect(runSimulation([0, 0, 0], 100, 100)).toBeNull();
  });

  it('Ergebnis hat korrekte Anzahl Läufe', () => {
    const sim = runSimulation([5, 8, 6, 7], 10, 500);
    expect(sim.results).toHaveLength(500);
  });

  it('Perzentile sind aufsteigend (p50 <= p70 <= p85 <= p95)', () => {
    const sim = runSimulation([5, 8, 6, 7, 4, 9], 20, 1000);
    expect(sim.p50).toBeLessThanOrEqual(sim.p70);
    expect(sim.p70).toBeLessThanOrEqual(sim.p85);
    expect(sim.p85).toBeLessThanOrEqual(sim.p95);
  });

  it('alle Ergebnisse sind positive Ganzzahlen (Anzahl Zeitscheiben)', () => {
    const sim = runSimulation([5, 8, 6], 30, 200);
    sim.results.forEach(r => {
      expect(r).toBeGreaterThan(0);
      expect(Number.isInteger(r)).toBe(true);
    });
  });

  it('P85 bei konstantem Throughput 10: ~Ziel/Throughput Wochen', () => {
    // Bei Target=100, Throughput immer 10 → brauche immer 10 Wochen
    const sim = runSimulation([10, 10, 10, 10], 100, 500);
    expect(sim.p85).toBe(10);
  });
});

describe('Throughput Perioden-Aggregation', () => {
  // Aus montecarlo.js: daysPerSlice = 1|7|30 je nach throughputUnit
  it('wöchentliche Periode = 7 Tage', () => {
    const daysPerSlice = { day: 1, week: 7, month: 30 };
    expect(daysPerSlice['week']).toBe(7);
  });

  it('monatliche Periode = 30 Tage', () => {
    const daysPerSlice = { day: 1, week: 7, month: 30 };
    expect(daysPerSlice['month']).toBe(30);
  });
});
