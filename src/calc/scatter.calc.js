// CycleTime Berechnungslogik aus scatter.js — keine Browser-APIs.
import { toDate } from './core.calc.js';

export function calcCT(startVal, endVal) {
  const sd = toDate(startVal), ed = toDate(endVal);
  if (!sd || !ed) return null;
  const ct = (ed - sd) / 86400000 + 1;
  return ct >= 1 ? ct : null;
}

export function calcCTFromRow(row, ctStart, ctEnd) {
  return calcCT(row[ctStart], row[ctEnd]);
}
