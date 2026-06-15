// Monte Carlo Berechnungslogik aus montecarlo.js — keine Browser-APIs.

/** Variationskoeffizient CV = σ/μ. Gibt null für leeres Array oder μ=0. */
export function calcCV(samples) {
  if (!samples.length) return null;
  const mean = samples.reduce((s, v) => s + v, 0) / samples.length;
  if (mean === 0) return null;
  const variance = samples.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / samples.length;
  return Math.sqrt(variance) / mean;
}

/**
 * Monte Carlo Simulation (Modus „Wie viele Zeitscheiben für targetCount Items?").
 * Gibt null zurück wenn samples leer oder alle 0.
 */
export function runSimulation(samples, targetCount, numRuns) {
  if (!samples.length || samples.every(v => v === 0)) return null;
  const results = [];
  for (let i = 0; i < numRuns; i++) {
    let total = 0, slices = 0;
    while (total < targetCount) {
      total += samples[Math.floor(Math.random() * samples.length)];
      slices++;
      if (slices > 10000) break;
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
