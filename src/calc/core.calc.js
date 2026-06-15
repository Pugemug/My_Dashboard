// Reine Berechnungsfunktionen aus core.js — keine Browser-APIs.
// Importiert von core.js (Delegation) und von Unit-Tests direkt.

export function toDate(v) {
  if (!v) return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  if (typeof v === 'number') {
    const d = new Date(Math.round((v - 25569) * 86400000));
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof v === 'string') {
    const d = new Date(v.trim());
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

export function dur(a, b) {
  const da = toDate(a), db = toDate(b);
  if (!da || !db) return null;
  const d = (db - da) / 86400000 + 1;
  return d > 0 ? d : null;
}

export function pct(arr, p) {
  if (!arr.length) return null;
  if (arr.length === 1) return arr[0];
  const i = (p / 100) * (arr.length - 1);
  const lo = Math.floor(i), hi = Math.ceil(i);
  return lo === hi ? arr[lo] : arr[lo] + (arr[hi] - arr[lo]) * (i - lo);
}

export function fmt(v) { return v == null ? '–' : v.toFixed(1) + 'd'; }

export function intTicks(max, n) {
  if (max <= 0) return [0];
  n = n || 5;
  const raw = max / n;
  const mag = Math.pow(10, Math.floor(Math.log10(Math.max(raw, 1))));
  let step = [1, 2, 5, 10].map(f => f * mag).find(f => f >= raw) || mag * 10;
  step = Math.max(1, Math.round(step));
  const ticks = [];
  for (let v = 0; v <= max + step * 0.01; v += step) ticks.push(Math.round(v));
  if (ticks[ticks.length - 1] < max) ticks.push(ticks[ticks.length - 1] + step);
  return [...new Set(ticks)];
}

export const DUAL_PERIOD_THRESHOLD_MS = 43_200_000; // 0,5 Tage

export function dualPeriodDuration(entryFirst, exitFirst, entry, exit) {
  const ef = toDate(entryFirst), xf = toDate(exitFirst);
  const e  = toDate(entry),      x  = toDate(exit);
  if (!e || !x) return null;
  const sameDay = ef && e && Math.abs(ef - e) < DUAL_PERIOD_THRESHOLD_MS;
  if (sameDay || !ef || !xf) {
    return dur(e, x);
  }
  const d1 = dur(ef, xf);
  const d2 = dur(e,  x);
  if (d1 == null || d2 == null) return null;
  return d1 + d2;
}

export function isErledigt(row) {
  return !!(row['Resolved'] || row['Rejected']);
}
