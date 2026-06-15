// FlowHeatmap Berechnungslogik aus heatmap.js — keine Browser-APIs.
import { dur, pct } from './core.calc.js';

/**
 * Berechnet P25/Median/P85 der Verweildauer eines Status über alle Rows.
 * Gibt null zurück wenn keine gültigen Datums-Paare vorhanden.
 */
export function stateStats(rows, entryCol, exitCol) {
  const ds = rows
    .map(r => dur(r[entryCol], r[exitCol]))
    .filter(d => d != null);
  if (!ds.length) return null;
  ds.sort((a, b) => a - b);
  return {
    p25: pct(ds, 25),
    med: pct(ds, 50),
    p85: pct(ds, 85),
    min: ds[0],
    max: ds[ds.length - 1],
    n:   ds.length,
  };
}

/**
 * Normiert einen Zellwert auf 0..1 für den Heatmap-Farbgradienten.
 * gMax = 0 ergibt 0 (kein Div/0).
 */
export function calcHeatmapT(cellValue, gMax) {
  if (!gMax || gMax <= 0) return 0;
  return Math.max(0, Math.min(1, cellValue / gMax));
}
