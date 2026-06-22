// akzeptanz.calc.js – Berechnungslogik AK-Qualität

/**
 * Zählt nicht-leere Whitespace-Tokens im Text.
 * @param {*} text
 * @returns {number}
 */
export function wordCount(text) {
  if (!text) return 0;
  return String(text).trim().split(/\s+/).filter(t => t.length > 0).length;
}

/**
 * AK-Qualität für eine Stage+Squad-Kombination.
 * @param {Object[]} epics  - Zeilen aus JiraEpics
 * @param {string}   stage
 * @param {string}   squad
 * @returns {number|null} Prozentwert (0-100, 2 Dezimalstellen) oder null wenn N=0
 */
export function calcAkQuality(epics, stage, squad) {
  const group = epics.filter(r => r['Stage'] === stage && r['Squad'] === squad);
  const N = group.length;
  if (N === 0) return null;
  const n = group.filter(r => wordCount(r['Akzeptanzkriterien']) > 3).length;
  return Math.round((n / N) * 10000) / 100;
}

/**
 * Sortiert Stage-Namen chronologisch nach BRP-Etappen-Startdatum.
 * Stages ohne BRP-Eintrag werden alphabetisch ans Ende gestellt.
 * @param {string[]} stages     - alle Stage-Namen aus JiraEpics
 * @param {Object[]} brpRows    - Zeilen aus BRP Etappen
 * @param {Function} toDateFn   - core.toDate
 * @returns {string[]}
 */
export function sortStagesByBrpEtappen(stages, brpRows, toDateFn) {
  const stagesSet = new Set(stages);

  if (!brpRows.length) {
    return [...stages].sort();
  }

  const dated = [];
  const seen  = new Set();
  brpRows
    .filter(r => r['Etappe'] && r['Startdatum'])
    .map(r => ({ name: String(r['Etappe']), date: toDateFn(r['Startdatum']) }))
    .filter(e => e.date && !isNaN(e.date.getTime()) && stagesSet.has(e.name))
    .sort((a, b) => a.date - b.date)
    .forEach(e => {
      if (!seen.has(e.name)) { seen.add(e.name); dated.push(e.name); }
    });

  return dated;
}
