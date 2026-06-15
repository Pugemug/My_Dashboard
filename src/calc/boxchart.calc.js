// LeadTime BoxChart Berechnungslogik aus boxchart.js — keine Browser-APIs.
import { pct } from './core.calc.js';

/**
 * Berechnet Box-Plot Statistiken (P25, Median, P85, Whisker, IQR, Ausreißergrenzen).
 * Whisker = 1,5 × IQR außerhalb der Box.
 * Gibt null zurück für leeres Array.
 */
export function calcBoxStats(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const p25    = pct(sorted, 25);
  const med    = pct(sorted, 50);
  const p85    = pct(sorted, 85);
  const iqr    = p85 - p25;
  const fence  = 1.5 * iqr;
  const allMax = sorted[sorted.length - 1];
  const allMin = sorted[0];
  const wUp    = Math.min(allMax, p85 + fence);
  const wDn    = Math.max(allMin, p25 - fence);
  return { sorted, p25, med, p85, iqr, fence, wUp, wDn, allMin, allMax, n: values.length };
}

export function isOutlier(value, stats) {
  return value > stats.wUp || value < stats.wDn;
}
