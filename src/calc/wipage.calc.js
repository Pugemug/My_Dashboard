// WIPAge Berechnungslogik aus wipage.js — keine Browser-APIs.
import { toDate } from './core.calc.js';

const THRESHOLD_MS = 43_200_000; // 0,5 Tage

/**
 * Berechnet das Alter eines WIP-Items im aktuellen Status in Tagen.
 * Bei Dual-Period wird die erste abgeschlossene Periode addiert.
 */
export function calcAge(row, statusName, todayMs) {
  const entryFirst   = toDate(row[statusName + '_first']);
  const entryReg     = toDate(row[statusName]);
  const leavingFirst = toDate(row['leaving_' + statusName + '_first']);

  if (entryReg != null) {
    const ageReg = Math.max(0, Math.round((todayMs - entryReg.getTime()) / 86400000));
    if (entryFirst != null && leavingFirst != null &&
        Math.abs(entryFirst.getTime() - entryReg.getTime()) >= THRESHOLD_MS) {
      const firstPeriod = Math.max(0, Math.round(
        (leavingFirst.getTime() - entryFirst.getTime()) / 86400000
      ) + 1);
      return firstPeriod + ageReg;
    }
    return ageReg;
  }
  if (entryFirst != null) {
    return Math.max(0, Math.round((todayMs - entryFirst.getTime()) / 86400000));
  }
  return null;
}

/** Item ist aktiv wenn weder Resolved noch Rejected gefüllt. */
export function isActive(row) {
  return !row['Resolved'] && !row['Rejected'];
}

/** Parst die Exclude-Liste aus dem Config-String "Status1, Status2". */
export function parseExcludeList(str) {
  return str.split(',').map(s => s.trim()).filter(Boolean);
}
