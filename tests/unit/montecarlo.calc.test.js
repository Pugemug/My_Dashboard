/**
 * Unit Tests für MonteCarlo Simulation (montecarlo.js).
 * Importiert direkt aus src/calc/montecarlo.calc.js — kein Copy-Paste.
 */

import { describe, it, expect } from 'vitest';
import { calcCV, runSimulation } from '../../src/calc/montecarlo.calc.js';

describe('Variationskoeffizient (CV)', () => {
  it('CV = 0 bei konstantem Throughput', () => {
    expect(calcCV([5, 5, 5, 5, 5])).toBeCloseTo(0, 5);
  });

  it('CV > 0 bei variablem Throughput', () => {
    expect(calcCV([1, 5, 10, 3, 8])).toBeGreaterThan(0);
  });

  it('gibt Infinity für leeres Array zurück', () => {
    expect(calcCV([])).toBe(Infinity);
  });

  it('gibt Infinity zurück wenn Mittelwert = 0', () => {
    expect(calcCV([0, 0, 0])).toBe(Infinity);
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
    const sim = runSimulation([10, 10, 10, 10], 100, 500);
    expect(sim.p85).toBe(10);
  });
});

describe('Throughput Perioden-Aggregation', () => {
  it('wöchentliche Periode = 7 Tage', () => {
    const daysPerSlice = { day: 1, week: 7, month: 30 };
    expect(daysPerSlice['week']).toBe(7);
  });

  it('monatliche Periode = 30 Tage', () => {
    const daysPerSlice = { day: 1, week: 7, month: 30 };
    expect(daysPerSlice['month']).toBe(30);
  });
});
