// Flow Efficiency Berechnungslogik aus flowefficiency.js — keine Browser-APIs.
// Deckt den JiraStories-Anteil ab (ohne JiraBlockermanagement-Integration).
import { dur } from './core.calc.js';

export const WAIT_STATUS = [
  'Blocked', 'Ready4Test', 'Ready4QS',
  'Ready4Review', 'Ready4E2E-Test', 'Ready4Production',
];

/**
 * Berechnet Flow Efficiency für ein einzelnes Item.
 * FE = (lt - totalWait) / lt × 100
 * Gibt null zurück wenn LT nicht berechenbar oder totalWait > lt (Datenfehler).
 */
export function calcItemFE(row, ltStartCol, ltEndCol) {
  const lt = dur(row[ltStartCol], row[ltEndCol]);
  if (!lt) return null;

  let totalWait = 0;
  WAIT_STATUS.forEach(status => {
    const entry = row[status + '_first'] || row[status];
    const exit  = row['leaving_' + status + '_first'] || row['leaving_' + status];
    const d = dur(entry, exit);
    if (d) totalWait += d;
  });

  if (totalWait > lt) return null;
  return ((lt - totalWait) / lt) * 100;
}
