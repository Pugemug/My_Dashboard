/**
 * blocker.js – Blockermanagement Visual
 * Page-ID: blocker | localStorage-Key: fhwa_blocker
 * Spec: docs/specs/Blockermanagement.md v1.0
 */

import { core } from './core.js';

// ── Feste Kategorie-Listen ──────────────────────────────────────────────────
const BLOCKIERT_CATS = [
  'Infrastruktur-Ausfall',
  'Anforderungen unklar, oder fehlend',
  'Anforderungen haben sich geändert',
  'Fehlende Zugriffsrechte',
  'Dokumentation unzureichend',
  'Abhängigkeit zu anderen Aufgaben',
  'Abhängigkeit zu anderen Teams',
  'Probleme bei der Integration',
  'Verzögerte externe Lieferungen',
];

const WARTEND_CATS = [
  'Abstimmungen mit anderen Teams',
  'Auf Freigabe warten',
  'Deployment-Fenster',
  'Externe Abhängigkeiten',
  'Interne Abstimmung / Entscheidung / Termine',
  'Infrastruktur-Aufbau',
  'Person(en) abwesend',
];

// ── Kurznamen für Summary (mit title-Attribut für Volltext) ───────────────
const BLOCKIERT_SHORT = [
  'Infrastruktur-Ausfall',
  'Anf. unklar/fehlend',
  'Anf. geändert',
  'Fehlende Zugriffsrechte',
  'Doku unzureichend',
  'Abh. and. Aufgaben',
  'Abh. and. Teams',
  'Integration',
  'Verz. ext. Lieferungen',
];

const WARTEND_SHORT = [
  'Abst. and. Teams',
  'Auf Freigabe warten',
  'Deployment-Fenster',
  'Externe Abh.',
  'Int. Abstimmung',
  'Infra-Aufbau',
  'Person(en) abwesend',
];

// ── Sortier-State ──────────────────────────────────────────────────────────
const _sortState = {};

// ── Datums-Hilfsfunktionen ─────────────────────────────────────────────────
function _calcDays(startDate, endDate) {
  const start = startDate instanceof Date ? startDate : new Date(startDate);
  const end   = endDate  ? (endDate instanceof Date ? endDate : new Date(endDate))
                         : new Date();
  const diff = Math.round((end - start) / 86400000) + 1;
  return Math.max(1, diff);
}

function _fmtDate(d) {
  if (!d) return '';
  const dt = d instanceof Date ? d : new Date(d);
  if (isNaN(dt)) return '';
  const dd = String(dt.getDate()).padStart(2,'0');
  const mm = String(dt.getMonth()+1).padStart(2,'0');
  return `${dd}.${mm}.${dt.getFullYear()}`;
}

// ── Haupt-Render ───────────────────────────────────────────────────────────
function render() {
  const canvas = document.getElementById('blocker-canvas');
  const diagEl = document.getElementById('blocker-diag');
  if (!canvas) return;

  const allRows = core.state.sheets['JiraBlockermanagement'] ?? [];
  const sf = core.state.squadFilter;  // null = alle, [] = keine

  // Squad-Filter
  const rows = sf === null
    ? allRows
    : allRows.filter(r => sf.includes(r['Squad']));

  // Episode-Count-Map (issues.key + Squad → Anzahl Episoden), ungefiltert global
  const countMap = new Map();
  allRows.forEach(r => {
    const grund = (r['Blockiert/Wartend_Grund'] || '').trim();
    if (!grund) return;
    const k = `${r['issues.key']}||${r['Squad']}`;
    countMap.set(k, (countMap.get(k) ?? 0) + 1);
  });

  // AKTUELL: Grund gefüllt + BlockedEnd leer
  let aktuell = rows.filter(r => {
    const grund = (r['Blockiert/Wartend_Grund'] || '').trim();
    const end   = r['BlockedEnd'];
    return grund && !end;
  });

  // GESAMT: Grund gefüllt (alle)
  let gesamt = rows.filter(r => {
    const grund = (r['Blockiert/Wartend_Grund'] || '').trim();
    return !!grund;
  });

  // Datenfehler zählen: Zeilen ohne BlockedStart (aus gefilterten mit Grund)
  let errors = 0;
  rows.forEach(r => {
    const grund = (r['Blockiert/Wartend_Grund'] || '').trim();
    if (grund && !r['BlockedStart']) errors++;
  });

  // Zeilen ohne BlockedStart aus Tabellen ausschließen (aber Fehler bereits gezählt)
  aktuell = aktuell.filter(r => r['BlockedStart']);
  gesamt  = gesamt.filter(r => r['BlockedStart']);

  // Diag
  const uniqueIssues = new Set(gesamt.map(r => `${r['issues.key']}||${r['Squad']}`));
  if (diagEl) {
    diagEl.textContent = `${uniqueIssues.size} Issues mit Blockier-/Warte-Episoden · ${aktuell.length} aktuell offen · ${errors} Datenfehler ausgeschlossen`;
  }

  // Default-Sortierung AKTUELL: Zustand aufsteigend (Blockiert vor Wartend)
  const aktuellKey = 'aktuell_default';
  if (!_sortState[aktuellKey]) {
    aktuell = _sortRows(aktuell, 'zustand', true, countMap);
  } else {
    aktuell = _applySortState('aktuell', aktuell, countMap);
  }

  // Default-Sortierung GESAMT: BlockedStart absteigend
  if (!_sortState['gesamt_default']) {
    gesamt = _sortRows(gesamt, 'start', false, countMap);
  } else {
    gesamt = _applySortState('gesamt', gesamt, countMap);
  }

  canvas.innerHTML = '';
  canvas.appendChild(_buildSection('aktuell', aktuell, gesamt, countMap));
  canvas.appendChild(_buildSection('gesamt',  gesamt,  gesamt, countMap));
}

// ── Sortierung ─────────────────────────────────────────────────────────────
function _sortRows(rows, field, asc, countMap) {
  return [...rows].sort((a, b) => {
    let va, vb;
    switch (field) {
      case 'key':    va = a['issues.key'] || ''; vb = b['issues.key'] || ''; break;
      case 'status': va = a['Status'] || '';     vb = b['Status'] || ''; break;
      case 'zustand':va = a['Blockiert/Wartend_Zustand'] || ''; vb = b['Blockiert/Wartend_Zustand'] || ''; break;
      case 'grund':  va = a['Blockiert/Wartend_Grund'] || ''; vb = b['Blockiert/Wartend_Grund'] || ''; break;
      case 'start': {
        const da = a['BlockedStart'] ? new Date(a['BlockedStart']) : new Date(0);
        const db = b['BlockedStart'] ? new Date(b['BlockedStart']) : new Date(0);
        return asc ? da - db : db - da;
      }
      case 'end': {
        const da = a['BlockedEnd'] ? new Date(a['BlockedEnd']) : new Date(9999,0,1);
        const db = b['BlockedEnd'] ? new Date(b['BlockedEnd']) : new Date(9999,0,1);
        return asc ? da - db : db - da;
      }
      case 'days': {
        const da = _calcDays(a['BlockedStart'], a['BlockedEnd']);
        const db = _calcDays(b['BlockedStart'], b['BlockedEnd']);
        return asc ? da - db : db - da;
      }
      case 'count': {
        const ka = `${a['issues.key']}||${a['Squad']}`;
        const kb = `${b['issues.key']}||${b['Squad']}`;
        va = countMap.get(ka) ?? 0; vb = countMap.get(kb) ?? 0;
        return asc ? va - vb : vb - va;
      }
      default: va = ''; vb = '';
    }
    if (typeof va === 'string') return asc ? va.localeCompare(vb,'de') : vb.localeCompare(va,'de');
    return asc ? va - vb : vb - va;
  });
}

function _applySortState(tableId, rows, countMap) {
  const state = _sortState[tableId];
  if (!state) return rows;
  return _sortRows(rows, state.field, state.asc, countMap);
}

// ── Section aufbauen ───────────────────────────────────────────────────────
function _buildSection(type, tableRows, allGesamtRows, countMap) {
  const isAktuell = type === 'aktuell';
  const label = isAktuell
    ? 'AKTUELL – Alle aktuell <span class="blk-hl-red">Blockierten</span> &amp; <span class="blk-hl-orange">Wartenden</span> Issues'
    : 'GESAMT – Alle Issues mit <span class="blk-hl-blue">Blockier-</span> oder <span class="blk-hl-orange">Warte-</span>Episoden';

  const section = document.createElement('div');
  section.className = 'blk-section';

  // Header
  const header = document.createElement('div');
  header.className = 'blk-section-header';
  header.innerHTML = `<span class="blk-section-title">${label}</span><span class="blk-section-n">N=${tableRows.length}</span>`;
  section.appendChild(header);

  // Body
  const body = document.createElement('div');
  body.className = 'blk-section-body';

  // Haupt-Tabelle
  const mainWrap = document.createElement('div');
  mainWrap.className = 'blk-main';
  mainWrap.appendChild(_buildMainTable(type, tableRows, countMap));
  body.appendChild(mainWrap);

  // Summary-Spalte
  const summaryCol = document.createElement('div');
  summaryCol.className = 'blk-summary-col';
  summaryCol.appendChild(_buildSummaryBlock(tableRows, 'Blockiert', BLOCKIERT_CATS, BLOCKIERT_SHORT, 'blk-lbl-red', '⛔'));
  summaryCol.appendChild(_buildSummaryBlock(tableRows, 'Wartend',   WARTEND_CATS,  WARTEND_SHORT,  'blk-lbl-orange', '⏳'));
  summaryCol.appendChild(_buildRollupBlock(tableRows));
  body.appendChild(summaryCol);

  section.appendChild(body);
  return section;
}

// ── Haupt-Tabelle ──────────────────────────────────────────────────────────
function _buildMainTable(type, rows, countMap) {
  const isAktuell = type === 'aktuell';
  const table = document.createElement('table');
  table.className = 'blk-table';
  table.id = `blk-tbl-${type}`;

  // Spalten-Definition
  const cols = isAktuell
    ? [
        { label: 'Key',                              field: 'key',    sortable: true  },
        { label: 'Status',                           field: 'status', sortable: true  },
        { label: 'Zustand',                          field: 'zustand',sortable: true  },
        { label: 'Aktueller Grund',                  field: 'grund',  sortable: true  },
        { label: 'Gesetzt am',                       field: 'start',  sortable: true  },
        { label: 'Ges. Zeit (Tage)',                 field: 'days',   sortable: true, center: true },
        { label: 'Wie oft',                          field: 'count',  sortable: true, center: true },
      ]
    : [
        { label: 'Key',                              field: 'key',    sortable: true  },
        { label: 'Status',                           field: 'status', sortable: true  },
        { label: 'Zustand',                          field: 'zustand',sortable: true  },
        { label: 'Grund',                            field: 'grund',  sortable: true  },
        { label: 'Gesetzt am',                       field: 'start',  sortable: true  },
        { label: 'Verlassen am',                     field: 'end',    sortable: true  },
        { label: 'Ges. Zeit (Tage)',                 field: 'days',   sortable: true, center: true },
        { label: 'Wie oft',                          field: 'count',  sortable: true, center: true },
      ];

  // Thead
  const thead = document.createElement('thead');
  const trHead = document.createElement('tr');
  cols.forEach((col, _idx) => {
    const th = document.createElement('th');
    th.textContent = col.label;
    if (col.center) th.style.textAlign = 'center';
    if (col.sortable) {
      th.classList.add('blk-th-sort');
      th.addEventListener('click', () => _onSort(type, col.field, rows, countMap));
      // Aktiven Sortier-Pfeil zeigen
      const st = _sortState[type];
      if (st && st.field === col.field) {
        th.classList.add(st.asc ? 'blk-sort-asc' : 'blk-sort-desc');
      } else if (!st && type === 'aktuell' && col.field === 'zustand') {
        th.classList.add('blk-sort-asc');
      } else if (!st && type === 'gesamt' && col.field === 'start') {
        th.classList.add('blk-sort-desc');
      }
    }
    trHead.appendChild(th);
  });
  thead.appendChild(trHead);
  table.appendChild(thead);

  // Tbody
  const tbody = document.createElement('tbody');
  if (rows.length === 0) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = cols.length;
    td.className = 'blk-empty';
    td.textContent = isAktuell
      ? 'Aktuell keine blockierten Issues – alles fließt! 🎉'
      : 'Keine Episoden für den gewählten Squad gefunden.';
    tr.appendChild(td);
    tbody.appendChild(tr);
  } else {
    rows.forEach(r => {
      tbody.appendChild(_buildRow(r, isAktuell, countMap));
    });
  }
  table.appendChild(tbody);
  return table;
}

function _buildRow(r, isAktuell, countMap) {
  const tr = document.createElement('tr');
  const key    = r['issues.key'] || '–';
  const status = r['Status']     || '';
  const zustand= r['Blockiert/Wartend_Zustand'] || '';
  const grund  = r['Blockiert/Wartend_Grund']   || '';
  const start  = r['BlockedStart'];
  const end    = r['BlockedEnd'];
  const days   = _calcDays(start, end);
  const countKey = `${key}||${r['Squad']}`;
  const count  = countMap.get(countKey) ?? 1;

  // Key
  const tdKey = document.createElement('td');
  tdKey.className = 'blk-td-key';
  const url = core.state.urlTemplate
    ? core.state.urlTemplate.replace(/\{issueKey\}/g, key) : '';
  if (url) {
    tdKey.style.cursor = 'pointer';
    tdKey.style.color = 'var(--blue)';
    tdKey.style.textDecoration = 'underline';
    tdKey.style.textUnderlineOffset = '2px';
    tdKey.addEventListener('click', () => window.open(url, '_blank'));
  }
  tdKey.textContent = key;
  tr.appendChild(tdKey);

  // Status
  const tdStatus = document.createElement('td');
  const statusBadge = document.createElement('span');
  statusBadge.className = 'blk-status-badge';
  const sl = (status || '').toLowerCase();
  if (sl.includes('progress') || sl === 'in bearbeitung') statusBadge.classList.add('blk-status-ip');
  else if (sl.includes('block'))                          statusBadge.classList.add('blk-status-bl');
  else if (sl.includes('wait') || sl.includes('wart'))   statusBadge.classList.add('blk-status-wt');
  else if (sl.includes('resolv') || sl.includes('done') || sl.includes('erledigt')) statusBadge.classList.add('blk-status-done');
  statusBadge.textContent = status || '–';
  tdStatus.appendChild(statusBadge);
  tr.appendChild(tdStatus);

  // Zustand
  const tdZustand = document.createElement('td');
  const zustandBadge = document.createElement('span');
  if (zustand === 'Blockiert') {
    zustandBadge.className = 'blk-zustand-b';
  } else if (zustand === 'Wartend') {
    zustandBadge.className = 'blk-zustand-w';
  } else {
    zustandBadge.style.color = 'var(--dim)';
    zustandBadge.style.fontSize = '.62rem';
  }
  zustandBadge.textContent = zustand || '–';
  tdZustand.appendChild(zustandBadge);
  tr.appendChild(tdZustand);

  // Grund
  const tdGrund = document.createElement('td');
  tdGrund.className = 'blk-td-grund';
  tdGrund.title = grund;
  tdGrund.textContent = grund || '–';
  tr.appendChild(tdGrund);

  // Gesetzt am
  const tdStart = document.createElement('td');
  tdStart.className = 'blk-td-date';
  tdStart.textContent = _fmtDate(start);
  tr.appendChild(tdStart);

  // Verlassen am (nur GESAMT)
  if (!isAktuell) {
    const tdEnd = document.createElement('td');
    tdEnd.className = end ? 'blk-td-date' : 'blk-td-open';
    tdEnd.textContent = end ? _fmtDate(end) : 'noch offen';
    tr.appendChild(tdEnd);
  }

  // Ges. Zeit (Tage)
  const tdDays = document.createElement('td');
  tdDays.className = 'blk-td-days';
  tdDays.dataset.sort = String(days);
  if (days >= 14) tdDays.classList.add('blk-days-long');
  else if (days >= 7) tdDays.classList.add('blk-days-medium');
  tdDays.textContent = String(days);
  tr.appendChild(tdDays);

  // Wie oft
  const tdCount = document.createElement('td');
  tdCount.className = 'blk-td-count';
  tdCount.textContent = String(count);
  tr.appendChild(tdCount);

  return tr;
}

// ── Sortier-Handler ────────────────────────────────────────────────────────
function _onSort(type, field, _rows, _countMap) {
  const prev = _sortState[type];
  const asc = prev && prev.field === field ? !prev.asc : true;
  _sortState[type] = { field, asc };
  // default-Markierung setzen
  _sortState[type + '_default'] = true;
  render();
}

// ── Summary-Tabellen ───────────────────────────────────────────────────────
function _buildSummaryBlock(rows, zustand, cats, shorts, labelCls, icon) {
  const block = document.createElement('div');
  block.className = 'blk-summary-block';

  const lbl = document.createElement('div');
  lbl.className = `blk-summary-label ${labelCls}`;
  lbl.textContent = `${icon} ${zustand}`;
  block.appendChild(lbl);

  const tbl = document.createElement('table');
  tbl.className = 'blk-summary-table';

  // Thead
  const thead = document.createElement('thead');
  thead.innerHTML = '<tr><th>Grund</th><th>Anz.</th><th>∑ Tage</th><th>Ø</th></tr>';
  tbl.appendChild(thead);

  // Aggregation
  const filtered = rows.filter(r => (r['Blockiert/Wartend_Zustand'] || '') === zustand);
  let totalCount = 0, totalDays = 0;
  const tbody = document.createElement('tbody');

  cats.forEach((cat, i) => {
    const matching = filtered.filter(r => (r['Blockiert/Wartend_Grund'] || '') === cat);
    const count = matching.length;
    const daySum = matching.reduce((s, r) => s + _calcDays(r['BlockedStart'], r['BlockedEnd']), 0);
    const avg = count > 0 ? (daySum / count).toFixed(1) : null;
    totalCount += count;
    totalDays  += daySum;

    const tr = document.createElement('tr');
    const tdName = document.createElement('td');
    tdName.title = cat;
    tdName.textContent = shorts[i] || cat;
    tr.appendChild(tdName);

    const tdCount = document.createElement('td');
    tdCount.className = count === 0 ? 'blk-sum-zero' : '';
    tdCount.textContent = count === 0 ? '–' : String(count);
    tr.appendChild(tdCount);

    const tdDays = document.createElement('td');
    tdDays.className = count === 0 ? 'blk-sum-zero' : '';
    tdDays.textContent = count === 0 ? '–' : String(daySum);
    tr.appendChild(tdDays);

    const tdAvg = document.createElement('td');
    tdAvg.className = count === 0 ? 'blk-sum-zero' : '';
    tdAvg.textContent = avg !== null ? avg : '–';
    tr.appendChild(tdAvg);

    tbody.appendChild(tr);
  });

  // Gesamt-Zeile
  const trTotal = document.createElement('tr');
  trTotal.className = 'blk-sum-total';
  const totalAvg = totalCount > 0 ? (totalDays / totalCount).toFixed(1) : '–';
  trTotal.innerHTML = `<td><strong>Gesamt ${zustand}</strong></td><td><strong>${totalCount || '–'}</strong></td><td><strong>${totalDays || '–'}</strong></td><td><strong>${totalAvg}</strong></td>`;
  tbody.appendChild(trTotal);

  tbl.appendChild(tbody);
  block.appendChild(tbl);
  return block;
}

function _buildRollupBlock(rows) {
  const block = document.createElement('div');
  block.className = 'blk-summary-block blk-summary-block--last';

  const lbl = document.createElement('div');
  lbl.className = 'blk-summary-label blk-lbl-blue';
  lbl.textContent = '📊 Gesamt';
  block.appendChild(lbl);

  const tbl = document.createElement('table');
  tbl.className = 'blk-summary-table';
  const thead = document.createElement('thead');
  thead.innerHTML = '<tr><th>Zustand</th><th>Anz.</th><th>∑ Tage</th><th>Ø</th></tr>';
  tbl.appendChild(thead);

  const tbody = document.createElement('tbody');

  ['Blockiert', 'Wartend'].forEach(z => {
    const matching = rows.filter(r => (r['Blockiert/Wartend_Zustand'] || '') === z);
    const count = matching.length;
    const daySum = matching.reduce((s, r) => s + _calcDays(r['BlockedStart'], r['BlockedEnd']), 0);
    const avg = count > 0 ? (daySum / count).toFixed(1) : '–';
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>Gesamt ${z}</td><td class="${count===0?'blk-sum-zero':''}">${count||'–'}</td><td class="${count===0?'blk-sum-zero':''}">${daySum||'–'}</td><td class="${count===0?'blk-sum-zero':''}">${avg}</td>`;
    tbody.appendChild(tr);
  });

  // Rollup-Gesamt
  const allCount = rows.length;
  const allDays  = rows.reduce((s, r) => s + _calcDays(r['BlockedStart'], r['BlockedEnd']), 0);
  const allAvg   = allCount > 0 ? (allDays / allCount).toFixed(1) : '–';
  const trTotal = document.createElement('tr');
  trTotal.className = 'blk-sum-total';
  trTotal.innerHTML = `<td><strong>Gesamt</strong></td><td><strong>${allCount||'–'}</strong></td><td><strong>${allDays||'–'}</strong></td><td><strong>${allAvg}</strong></td>`;
  tbody.appendChild(trTotal);

  tbl.appendChild(tbody);
  block.appendChild(tbl);
  return block;
}

// ── CSS injizieren ─────────────────────────────────────────────────────────
function _injectStyles() {
  if (document.getElementById('blk-styles')) return;
  const style = document.createElement('style');
  style.id = 'blk-styles';
  style.textContent = `
/* ── Blocker Section ── */
.blk-section {
  background: var(--bg2);
  border: 1px solid var(--border);
  border-radius: 8px;
  margin-bottom: 1rem;
  overflow: hidden;
}
.blk-section-header {
  display: flex;
  align-items: baseline;
  gap: .5rem;
  padding: .5rem .75rem;
  background: var(--bg3);
  border-bottom: 1px solid var(--border);
}
.blk-section-title {
  font-size: .72rem;
  font-weight: 700;
  letter-spacing: -.01em;
  color: var(--text);
}
.blk-hl-red    { color: var(--red) }
.blk-hl-orange { color: var(--orange) }
.blk-hl-blue   { color: var(--blue) }
.blk-section-n {
  font-family: var(--mono);
  font-size: .62rem;
  color: var(--dimmer);
}

/* ── Section Body ── */
.blk-section-body {
  display: flex;
  align-items: stretch;
  min-height: 200px;
}
.blk-main {
  flex: 1 1 58%;
  min-width: 0;
  overflow-x: auto;
  border-right: 1px solid var(--border);
}
.blk-summary-col {
  flex: 0 0 340px;
  display: flex;
  flex-direction: column;
}
@media (max-width: 800px) {
  .blk-section-body { flex-direction: column; }
  .blk-main { border-right: none; border-bottom: 1px solid var(--border); }
  .blk-summary-col { flex: unset; width: 100%; }
}

/* ── Haupt-Tabelle ── */
.blk-table {
  width: 100%;
  border-collapse: collapse;
  font-size: .68rem;
}
.blk-table thead th {
  position: sticky; top: 0; z-index: 5;
  background: var(--bg3);
  border-bottom: 1px solid var(--border);
  padding: .32rem .5rem;
  color: var(--dimmer);
  font-weight: 600; font-size: .58rem;
  text-transform: uppercase; letter-spacing: .05em;
  text-align: left; white-space: nowrap;
}
.blk-table thead th.blk-th-sort {
  cursor: pointer; user-select: none;
  transition: color .12s;
}
.blk-table thead th.blk-th-sort:hover { color: var(--dim) }
.blk-table thead th.blk-sort-asc::after  { content: ' ▲'; color: var(--blue); font-size: .5rem }
.blk-table thead th.blk-sort-desc::after { content: ' ▼'; color: var(--blue); font-size: .5rem }
.blk-table thead th.blk-sort-asc,
.blk-table thead th.blk-sort-desc { color: var(--blue) }
.blk-table tbody tr {
  border-bottom: 1px solid var(--border);
  transition: background .1s;
}
.blk-table tbody tr:hover { background: var(--bg3) }
.blk-table tbody tr:last-child { border-bottom: none }
.blk-table td { padding: .3rem .5rem; vertical-align: middle; white-space: nowrap }
.blk-empty {
  text-align: center; padding: 2rem;
  color: var(--dimmer); font-family: var(--mono); font-size: .7rem;
}
.blk-td-key { font-family: var(--mono); font-size: .67rem; color: var(--dim) }
.blk-status-badge {
  font-size: .6rem; font-weight: 600;
  padding: .14rem .38rem; border-radius: 4px;
  background: var(--bg4); border: 1px solid var(--border);
  color: var(--dim); white-space: nowrap; display: inline-block;
}
.blk-status-ip   { background: rgba(56,189,248,.1);  border-color: rgba(56,189,248,.3);  color: var(--blue)   }
.blk-status-bl   { background: rgba(248,113,113,.1); border-color: rgba(248,113,113,.3); color: var(--red)    }
.blk-status-wt   { background: rgba(251,146,60,.1);  border-color: rgba(251,146,60,.3);  color: var(--orange) }
.blk-status-done { background: rgba(74,222,128,.1);  border-color: rgba(74,222,128,.3);  color: var(--green)  }
.blk-zustand-b {
  font-size: .62rem; font-weight: 600; color: var(--red);
  background: rgba(248,113,113,.1); border: 1px solid rgba(248,113,113,.3);
  padding: .1rem .32rem; border-radius: 4px; white-space: nowrap; display: inline-block;
}
.blk-zustand-w {
  font-size: .62rem; font-weight: 600; color: var(--orange);
  background: rgba(251,146,60,.1); border: 1px solid rgba(251,146,60,.3);
  padding: .1rem .32rem; border-radius: 4px; white-space: nowrap; display: inline-block;
}
.blk-td-grund {
  max-width: 200px; overflow: hidden; text-overflow: ellipsis;
  white-space: nowrap; font-size: .65rem; color: var(--text);
}
.blk-td-date { font-family: var(--mono); font-size: .63rem; color: var(--dim) }
.blk-td-open { color: var(--dimmer); font-style: italic; font-size: .6rem }
.blk-td-days {
  font-family: var(--mono); font-size: .62rem; color: var(--text);
  text-align: center;
}
.blk-days-long   { color: var(--red) }
.blk-days-medium { color: var(--orange) }
.blk-td-count { font-family: var(--mono); font-size: .62rem; color: var(--dimmer); text-align: center }

/* ── Summary-Spalte ── */
.blk-summary-block {
  border-bottom: 1px solid var(--border);
  padding: .45rem .6rem;
}
.blk-summary-block--last { flex: 1; border-bottom: none }
.blk-summary-label {
  font-size: .56rem; font-weight: 600;
  text-transform: uppercase; letter-spacing: .09em;
  padding: .15rem .3rem .25rem; margin-bottom: .22rem;
  border-bottom: 1px solid var(--border);
}
.blk-lbl-red    { color: var(--red) }
.blk-lbl-orange { color: var(--orange) }
.blk-lbl-blue   { color: var(--blue) }
.blk-summary-table { width: 100%; border-collapse: collapse; font-size: .61rem }
.blk-summary-table th {
  padding: .18rem .32rem;
  color: var(--dimmer); font-size: .54rem; font-weight: 600;
  text-transform: uppercase; letter-spacing: .05em;
  border-bottom: 1px solid var(--border); text-align: right;
  background: var(--bg2);
}
.blk-summary-table th:first-child { text-align: left }
.blk-summary-table td {
  padding: .2rem .32rem;
  border-bottom: 1px solid rgba(42,61,92,.5);
  font-family: var(--mono); color: var(--dim); text-align: right;
}
.blk-summary-table td:first-child {
  text-align: left; color: var(--text);
  font-family: var(--sans); font-size: .6rem;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 160px;
}
.blk-summary-table tr.blk-sum-total td {
  border-bottom: none; font-weight: 700; color: var(--text);
  background: var(--bg3); border-top: 1px solid var(--border);
}
.blk-sum-zero { color: var(--dimmer); opacity: .4 }
`;
  document.head.appendChild(style);
}

// ── Init ───────────────────────────────────────────────────────────────────
export function init() {
  _injectStyles();
  core.on('data',   render);
  core.on('filter', render);
  core.on('theme',  render);
}
