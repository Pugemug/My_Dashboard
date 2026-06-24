// ════════════════════════════════════════════════
// heatmap.js  –  FlowHeatmap Visual
// Flow Analytics Dashboard v2.0
// Eigenständiges Visual – abonniert core-Events
// ════════════════════════════════════════════════

import { core, LT_START_DEFAULT, LT_END_DEFAULT, DEFAULT_STATUS_ORDER, mkBtn, mkPanel, mkTglGrp, mkSelect, mkLtField, mkTTRow, posTooltip, buildOrderPanel } from './core.js';
import { stateStats as _stateStatsCalc } from './calc/heatmap.calc.js';

export function init() {

  // ── 1. Lokaler Config-State ──────────────────
  const cfg = core.load('fhwa_heatmap', {
    grouping:     'Issue-Type',
    metric:       'med',
    filter:       'resolved',
    ltStart:      '',
    ltEnd:        '',
    hiddenGlobal: ['Rejected', 'Resume'],
    // stateOrder wird NICHT persistiert – liegt in fhwa_status_order (global)
  });

  // Runtime-only state (nicht persistiert)
  const hiddenGlobal  = new Set(cfg.hiddenGlobal || []);
  const hiddenPerSquad = {};      // { squadName: Set<string> }
  let drillSquad    = null;
  let drillKeepFilter = false;
  const colDrag     = { name: null };

  function saveConfig() {
    core.save('fhwa_heatmap', {
      grouping:     cfg.grouping,
      metric:       cfg.metric,
      filter:       cfg.filter,
      ltStart:      cfg.ltStart,
      ltEnd:        cfg.ltEnd,
      hiddenGlobal: [...hiddenGlobal],
      // stateOrder wird NICHT persistiert – liegt in fhwa_status_order (global)
    });
  }

  // ── 2. Card anlegen ──────────────────────────
  const { cardEl, contentEl, headerExtraEl, diagEl } = core.createCard({
    id:          'heatmap',
    title:       'Flow<span class="hl">Heatmap</span>',
    defaultGrid: { col: 0, row: 0, w: 12, h: 12 },
  });

  // ── 3. Header-Controls bauen ─────────────────

  // Grouping toggle
  const grpToggle = mkTglGrp([
    { val: 'Issue-Type', label: 'Issue-Typ' },
    { val: 'Squad',      label: 'Squad'     },
  ], val => _setGrouping(val));
  grpToggle.id = 'hm-grp-toggle';

  // Metric toggle
  const metToggle = mkTglGrp([
    { val: 'p25', label: 'P25'    },
    { val: 'med', label: 'Median' },
    { val: 'p85', label: 'P85'    },
  ], val => _setMetric(val));
  metToggle.id = 'hm-met-toggle';

  // Filter toggle
  const fltToggle = mkTglGrp([
    { val: 'all',      label: 'Alle'     },
    { val: 'resolved', label: 'Resolved' },
  ], val => _setFilter(val));
  fltToggle.id = 'hm-flt-toggle';

  const sep2 = document.createElement('div'); sep2.className = 'tb-sep';

  const btnLt     = mkBtn('⏱ Lead Time',  () => _togglePanel('lt-panel'));
  const btnStatus = mkBtn('👁 Status',      () => _togglePanel('status-panel'));
  const btnOrder  = mkBtn('↕ Reihenfolge', () => _togglePanel('order-panel'));

  [grpToggle, metToggle, fltToggle, sep2, btnLt, btnStatus, btnOrder]
    .forEach(el => headerExtraEl.appendChild(el));

  // ── 4. Breadcrumb (Drill-down) ───────────────
  const breadcrumb = document.createElement('div');
  breadcrumb.className = 'hm-breadcrumb';
  breadcrumb.style.display = 'none';

  const bcBack = document.createElement('button');
  bcBack.className = 'bc-back'; bcBack.textContent = '← Zurück';
  bcBack.addEventListener('click', drillBack);

  const bcCrumb = document.createElement('div'); bcCrumb.className = 'bc-crumb';
  const bcLink  = document.createElement('span'); bcLink.className  = 'bc-link'; bcLink.textContent = 'Alle Squads';
  bcLink.addEventListener('click', drillBack);
  const bcSep   = document.createElement('span'); bcSep.className   = 'bc-sep';  bcSep.textContent  = '›';
  const bcCur   = document.createElement('span'); bcCur.className   = 'bc-cur';
  bcCrumb.appendChild(bcLink); bcCrumb.appendChild(bcSep); bcCrumb.appendChild(bcCur);

  const bcSpacer = document.createElement('div'); bcSpacer.className = 'bc-spacer';

  const bcFltWrap = document.createElement('div'); bcFltWrap.className = 'bc-filter-toggle';
  const bcFltLbl  = document.createElement('span'); bcFltLbl.textContent = 'Squad-Filter aktiv';
  const bcTglSw   = document.createElement('label'); bcTglSw.className = 'bc-toggle-sw';
  const bcTglInp  = document.createElement('input'); bcTglInp.type = 'checkbox';
  const bcSlider  = document.createElement('span');  bcSlider.className = 'bc-slider';
  bcTglInp.addEventListener('change', () => { drillKeepFilter = bcTglInp.checked; render(); });
  bcTglSw.appendChild(bcTglInp); bcTglSw.appendChild(bcSlider);
  bcFltWrap.appendChild(bcFltLbl); bcFltWrap.appendChild(bcTglSw);

  breadcrumb.appendChild(bcBack); breadcrumb.appendChild(bcCrumb);
  breadcrumb.appendChild(bcSpacer); breadcrumb.appendChild(bcFltWrap);
  cardEl.insertBefore(breadcrumb, contentEl);

  // ── 5. Sub-Panels ────────────────────────────
  const ltPanel = mkPanel(); ltPanel.id = 'hm-lt-panel';
  const ltTitle = document.createElement('div'); ltTitle.className = 'panel-title'; ltTitle.style.color = 'var(--purple)'; ltTitle.textContent = 'Lead Time Konfiguration';
  const ltRow   = document.createElement('div'); ltRow.className = 'lt-row';

  const ltStartSel = mkSelect(); const ltEndSel = mkSelect();
  const ltHint = document.createElement('span'); ltHint.className = 'lt-hint'; ltHint.textContent = '—';

  ltRow.appendChild(mkLtField('Start', ltStartSel));
  ltRow.appendChild(mkLtField('Ende',  ltEndSel));
  ltRow.appendChild(ltHint);
  ltPanel.appendChild(ltTitle); ltPanel.appendChild(ltRow);

  ltStartSel.addEventListener('change', () => { cfg.ltStart = ltStartSel.value; _updateHasLT(); _updateLtHint(); _updateFilterToggle(); saveConfig(); render(); });
  ltEndSel.addEventListener('change',   () => { cfg.ltEnd   = ltEndSel.value;   _updateHasLT(); _updateLtHint(); _updateFilterToggle(); saveConfig(); render(); });

  // Status panel
  const statusPanel = mkPanel(); statusPanel.id = 'hm-status-panel';
  const stTitle = document.createElement('div'); stTitle.className = 'panel-title'; stTitle.style.color = 'var(--orange)';
  const stTitleSpan = document.createElement('span'); stTitleSpan.textContent = 'Status sichtbar';
  const stCtxSpan   = document.createElement('span'); stCtxSpan.className = 'status-panel-ctx';
  const stResetBtn  = document.createElement('button'); stResetBtn.className = 'status-reset-btn'; stResetBtn.textContent = '↩ Standard'; stResetBtn.style.display = 'none';
  stResetBtn.addEventListener('click', () => {
    const sq = _activeSquadName();
    if (sq) { delete hiddenPerSquad[sq]; _updateStatusPanel(); render(); }
  });
  stTitle.appendChild(stTitleSpan); stTitle.appendChild(stCtxSpan); stTitle.appendChild(stResetBtn);
  const stGrid = document.createElement('div'); stGrid.className = 'status-grid';
  statusPanel.appendChild(stTitle); statusPanel.appendChild(stGrid);

  // Order panel
  const orderPanel = mkPanel(); orderPanel.id = 'hm-order-panel';
  const orTitle = document.createElement('div'); orTitle.className = 'panel-title'; orTitle.style.color = 'var(--yellow)';
  const orTitleText = document.createElement('span'); orTitleText.textContent = 'Spalten-Reihenfolge ';
  const orTitleHint = document.createElement('span'); orTitleHint.style.cssText = 'font-size:.56rem;color:var(--dimmer);font-weight:400;text-transform:none;letter-spacing:0'; orTitleHint.textContent = '↔ ziehen oder ▲▼';
  orTitle.appendChild(orTitleText); orTitle.appendChild(orTitleHint);
  const orderList = document.createElement('div'); orderList.className = 'order-list';
  orderPanel.appendChild(orTitle); orderPanel.appendChild(orderList);

  [ltPanel, statusPanel, orderPanel].forEach(p => cardEl.insertBefore(p, contentEl));

  // ── 6. Content: table-wrap ───────────────────
  const tableWrap = document.createElement('div'); tableWrap.className = 'table-wrap';
  contentEl.appendChild(tableWrap);

  // ── 7. Legend bar (after contentEl, before diagEl) ──
  const legendBar    = document.createElement('div'); legendBar.className = 'legend-bar';
  const legendLblL   = document.createElement('span'); legendLblL.textContent = 'wenig Zeit';
  const legendCanvas = document.createElement('canvas'); legendCanvas.width = 100; legendCanvas.height = 6; legendCanvas.style.borderRadius = '3px';
  const legendLblR   = document.createElement('span'); legendLblR.textContent = 'viel Zeit';
  legendBar.appendChild(legendLblL); legendBar.appendChild(legendCanvas); legendBar.appendChild(legendLblR);
  cardEl.insertBefore(legendBar, diagEl);

  // ── 8. Tooltip (appended to body) ───────────
  const hmTooltip = document.createElement('div');
  hmTooltip.className = 'hm-tooltip';
  hmTooltip.style.cssText = 'position:fixed;display:none;background:var(--bg2);border:1px solid var(--border);border-radius:9px;padding:.5rem .65rem;font-family:var(--mono);font-size:.64rem;color:var(--text);pointer-events:none;z-index:2000;box-shadow:0 12px 32px rgba(0,0,0,.5);min-width:148px';
  const hmTTTitle = document.createElement('div'); hmTTTitle.className = 'tt-title';
  const hmTTBody  = document.createElement('div');
  hmTooltip.appendChild(hmTTTitle); hmTooltip.appendChild(hmTTBody);
  document.body.appendChild(hmTooltip);

  // Tooltip mouse tracking (delegated on whole document)
  document.addEventListener('mousemove', e => {
    const el = e.target.closest('.has-hm-tt');
    if (!el) { hmTooltip.style.display = 'none'; return; }
    const d = el.dataset;
    hmTTTitle.textContent = d.grp + ' · ' + d.st;
    hmTTBody.innerHTML = '';
    [['P25', d.p25 ? d.p25 + 'd' : '–'],
     ['Median', d.med ? d.med + 'd' : '–'],
     ['P85', d.p85 ? d.p85 + 'd' : '–'],
     ['Min', d.min ? d.min + 'd' : '–'],
     ['Max', d.max ? d.max + 'd' : '–'],
     ['n', d.n || '–'],
    ].forEach(([l, v]) => hmTTBody.appendChild(mkTTRow(l, v)));
    hmTooltip.style.display = 'block';
    posTooltip(hmTooltip, e.clientX, e.clientY);
  });

  // ── Panel toggle map ─────────────────────────
  const PANELS   = ['lt-panel', 'status-panel', 'order-panel'];
  const panelEls = { 'lt-panel': ltPanel, 'status-panel': statusPanel, 'order-panel': orderPanel };
  const panelBtns = { 'lt-panel': btnLt, 'status-panel': btnStatus, 'order-panel': btnOrder };
  const panelClrs = { 'lt-panel': 'p-purple', 'status-panel': 'p-orange', 'order-panel': 'p-yellow' };

  function _togglePanel(id) {
    PANELS.forEach(pid => {
      const open = pid === id ? !panelEls[pid].classList.contains('open') : false;
      panelEls[pid].classList.toggle('open', open);
      panelBtns[pid].className = 'btn-icon' + (open ? ' ' + panelClrs[pid] : '');
    });
    if (id === 'status-panel') _updateStatusPanel();
  }

  // ══════════════════════════════════════════════
  // Internal helpers
  // ══════════════════════════════════════════════

  function _hasLT() { return !!(cfg.ltStart && cfg.ltEnd && cfg.ltStart !== cfg.ltEnd); }

  function _activeSquadName() {
    if (drillSquad) return drillSquad;
    if (core.state.squadFilter !== null && core.state.squadFilter.length === 1) return core.state.squadFilter[0];
    return null;
  }

  function _getHiddenStates() {
    const sq = _activeSquadName();
    if (sq && hiddenPerSquad[sq]) return hiddenPerSquad[sq];
    return hiddenGlobal;
  }

  function _toggleStateVisibility(name) {
    const sq = _activeSquadName();
    if (sq) {
      if (!hiddenPerSquad[sq]) hiddenPerSquad[sq] = new Set(hiddenGlobal);
      hiddenPerSquad[sq].has(name) ? hiddenPerSquad[sq].delete(name) : hiddenPerSquad[sq].add(name);
    } else {
      hiddenGlobal.has(name) ? hiddenGlobal.delete(name) : hiddenGlobal.add(name);
    }
    saveConfig(); _updateStatusPanel(); render();
  }

  function _getDrillRows() {
    if (drillSquad) {
      let rows = core.state.rows.filter(r => String(r['Squad'] || '') === drillSquad);
      if (drillKeepFilter && core.state.squadFilter !== null && core.state.squadFilter.length > 0)
        rows = rows.filter(r => core.state.squadFilter.includes(String(r['Squad'] || '')));
      return rows;
    }
    // Kein Drill-Down: zentrale filteredRows() nutzen (Single Source of Truth)
    return core.filteredRows();
  }

  function _filteredRows() {
    let rows = _getDrillRows();
    if (cfg.filter === 'resolved' && _hasLT()) rows = rows.filter(r => core.toDate(r[cfg.ltEnd]) != null);
    return rows;
  }

  // ── Drill-down ────────────────────────────────
  function drillInto(sq) {
    drillSquad = sq; drillKeepFilter = false;
    bcCur.textContent = sq; bcTglInp.checked = false;
    breadcrumb.style.display = 'flex';
    cfg.grouping = 'Issue-Type'; _updateGroupToggle(); _updateStatusPanel(); render();
  }

  function drillBack() {
    drillSquad = null;
    breadcrumb.style.display = 'none';
    cfg.grouping = core.state.hasSquad ? 'Squad' : (core.state.hasIssueType ? 'Issue-Type' : 'Issue-Type');
    _updateGroupToggle(); _updateStatusPanel(); render();
  }

  // ── Toggle updaters ───────────────────────────
  function _setGrouping(val) {
    if ((val === 'Squad' && !core.state.hasSquad) || (val === 'Issue-Type' && !core.state.hasIssueType)) return;
    cfg.grouping = val; saveConfig(); _updateGroupToggle(); render();
  }

  function _setMetric(val) { cfg.metric = val; saveConfig(); _updateMetricToggle(); render(); }

  function _setFilter(val) {
    if (val === 'resolved' && !_hasLT()) return;
    cfg.filter = val; saveConfig(); _updateFilterToggle(); render();
  }

  function _updateGroupToggle() {
    grpToggle.querySelectorAll('.tgl').forEach(b => {
      const ok = (b.dataset.val === 'Squad' && core.state.hasSquad) ||
                 (b.dataset.val === 'Issue-Type' && core.state.hasIssueType);
      b.classList.toggle('ta-b',    b.dataset.val === cfg.grouping);
      b.classList.toggle('tgl-off', !ok);
    });
  }

  function _updateMetricToggle() {
    metToggle.querySelectorAll('.tgl').forEach(b => b.classList.toggle('ta-r', b.dataset.val === cfg.metric));
  }

  function _updateFilterToggle() {
    fltToggle.querySelectorAll('.tgl').forEach(b => b.classList.toggle('ta-g', b.dataset.val === cfg.filter));
    const resolvedBtn = fltToggle.querySelector('[data-val="resolved"]');
    if (resolvedBtn) resolvedBtn.classList.toggle('tgl-off', !_hasLT());
  }

  function _updateHasLT() {
    if (!_hasLT() && cfg.filter === 'resolved') { cfg.filter = 'all'; _updateFilterToggle(); }
  }

  function _updateLtHint() {
    if (_hasLT()) {
      ltHint.textContent = cfg.ltStart + ' → ' + cfg.ltEnd;
      ltHint.style.color  = 'var(--purple)';
    } else {
      ltHint.textContent = 'Beide Spalten wählen';
      ltHint.style.color  = 'var(--dimmer)';
    }
  }

  function _populateLtSelects() {
    [ltStartSel, ltEndSel].forEach((sel, i) => {
      sel.innerHTML = '';
      const none = document.createElement('option'); none.value = ''; none.textContent = '— keine —'; sel.appendChild(none);
      core.state.dateCols.forEach(c => { const o = document.createElement('option'); o.value = c; o.textContent = c; sel.appendChild(o); });
      sel.value = i === 0 ? cfg.ltStart : cfg.ltEnd;
    });
    _updateLtHint();
  }

  // ── Status panel ─────────────────────────────
  function _updateStatusPanel() {
    const sq = _activeSquadName();
    stCtxSpan.textContent = sq ? ' — Squad: ' + sq : ' — Global';
    stResetBtn.style.display = (sq && hiddenPerSquad[sq]) ? 'inline-block' : 'none';
    stGrid.innerHTML = '';
    const hidden = _getHiddenStates();
    cfg.stateOrder.forEach(name => {
      const isH  = hidden.has(name);
      const isD  = sq && hiddenPerSquad[sq] && (hiddenPerSquad[sq].has(name) !== hiddenGlobal.has(name));
      const item = document.createElement('div');
      item.className = 'status-item' + (isH ? ' hidden-state' : '');
      item.onclick = () => _toggleStateVisibility(name);
      const cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = !isH;
      cb.onclick = ev => ev.stopPropagation(); cb.onchange = () => _toggleStateVisibility(name);
      const lbl = document.createElement('label'); lbl.textContent = name;
      item.appendChild(cb); item.appendChild(lbl);
      if (isD) { const dot = document.createElement('span'); dot.className = 'status-deviation'; item.appendChild(dot); }
      stGrid.appendChild(item);
    });
  }

  // ── Order panel ───────────────────────────────
  function _updateOrderPanel() {
    const hidden = _getHiddenStates();
    buildOrderPanel(
      orderList,
      cfg.stateOrder,
      arr => { cfg.stateOrder = arr; core.saveGlobalStatusOrder(arr); _updateOrderPanel(); _updateStatusPanel(); render(); },
      (item, name) => { if (hidden.has(name)) item.style.opacity = '.4'; },
    );
  }

  // ── Stats helpers ─────────────────────────────
  function _stateStats(rows, st) {
    if (!st.exitCol) return null;
    return _stateStatsCalc(rows, st.entryCol, st.exitCol);
  }

  function _ltStats(rows) {
    const lr  = rows.filter(r => core.toDate(r[cfg.ltEnd]) != null);
    const ds  = lr.map(r => core.dur(r[cfg.ltStart], r[cfg.ltEnd])).filter(d => d != null);
    if (!ds.length) return null;
    ds.sort((a, b) => a - b);
    return { p25: core.pct(ds,25), med: core.pct(ds,50), p85: core.pct(ds,85), min: ds[0], max: ds[ds.length-1], n: ds.length };
  }

  // ── Column drag & drop (table headers) ────────
  function _onColDragStart(e, name) { colDrag.name = name; e.currentTarget.classList.add('dragging-col'); e.dataTransfer.effectAllowed = 'move'; }
  function _onColDragOver(e, th) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; document.querySelectorAll('.drag-over-col').forEach(el => el.classList.remove('drag-over-col')); th.classList.add('drag-over-col'); }
  function _onColDrop(e, tgt) {
    e.preventDefault(); if (!colDrag.name || colDrag.name === tgt) return;
    const arr = [...cfg.stateOrder], fi = arr.indexOf(colDrag.name), ti = arr.indexOf(tgt);
    if (fi < 0 || ti < 0) return;
    arr.splice(fi, 1); arr.splice(ti, 0, colDrag.name);
    cfg.stateOrder = arr; colDrag.name = null;
    core.saveGlobalStatusOrder(cfg.stateOrder);
    _updateOrderPanel(); _updateStatusPanel(); render();
  }

  // ── Cell builder ──────────────────────────────
  function _buildCell(st, gMax, rowMax, gName, stName, isLT) {
    const inner = document.createElement('div'); inner.className = 'cell-in';
    if (!st) { const e = document.createElement('div'); e.className = 'c-empty'; e.textContent = '–'; inner.appendChild(e); return inner; }
    const main = document.createElement('div'); main.className = 'c-main'; main.textContent = core.fmt(st[cfg.metric]); inner.appendChild(main);
    const sub  = document.createElement('div'); sub.className  = 'c-sub';
    if (cfg.metric === 'med') sub.textContent = `P25: ${core.fmt(st.p25)}  P85: ${core.fmt(st.p85)}`;
    else if (cfg.metric === 'p85') sub.textContent = `P25: ${core.fmt(st.p25)}  Med: ${core.fmt(st.med)}`;
    else sub.textContent = `Med: ${core.fmt(st.med)}  P85: ${core.fmt(st.p85)}`;
    inner.appendChild(sub);
    const n = document.createElement('div'); n.className = 'c-n'; n.textContent = `n=${st.n}`; inner.appendChild(n);
    if (!isLT && rowMax > 0) {
      const bw = document.createElement('div'); bw.className = 'c-bar-w';
      const b  = document.createElement('div'); b.className  = 'c-bar'; b.style.width = (((st[cfg.metric] || 0) / rowMax) * 100) + '%';
      bw.appendChild(b); inner.appendChild(bw);
    }
    // Tooltip data
    inner.dataset.grp = gName; inner.dataset.st = stName;
    inner.dataset.p25 = st.p25 != null ? st.p25.toFixed(2) : '';
    inner.dataset.med = st.med != null ? st.med.toFixed(2) : '';
    inner.dataset.p85 = st.p85 != null ? st.p85.toFixed(2) : '';
    inner.dataset.min = st.min != null ? st.min.toFixed(2) : '';
    inner.dataset.max = st.max != null ? st.max.toFixed(2) : '';
    inner.dataset.n   = st.n;
    inner.classList.add('has-hm-tt');
    return inner;
  }

  // ── Legend ────────────────────────────────────
  function _renderLegend() {
    const ctx = legendCanvas.getContext('2d');
    const g   = ctx.createLinearGradient(0, 0, 100, 0);
    const cMin = core.isLight() ? [219,234,254] : [28,42,63];
    const cMax = core.isLight() ? [251,146,60]  : [192,57,43];
    g.addColorStop(0, `rgb(${cMin.join(',')})`);
    g.addColorStop(1, `rgb(${cMax.join(',')})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, 100, 6);
  }

  function _showMsg(title, msg) {
    tableWrap.innerHTML = '';
    const d = document.createElement('div'); d.className = 'state-msg';
    const h = document.createElement('h3'); h.textContent = title;
    const p = document.createElement('p');  p.textContent = msg;
    d.appendChild(h); d.appendChild(p); tableWrap.appendChild(d);
  }

  // ════════════════════════════════════════════════
  // 4. Render
  // ════════════════════════════════════════════════
  function render() {
    _renderLegend();
    if (!core.state.rows.length) { _showMsg('Keine Daten', 'Excel-Datei laden'); diagEl.textContent = '—'; return; }

    const fRows  = _filteredRows();
    const gcol   = cfg.grouping;
    const hasGrp = (gcol === 'Squad' && core.state.hasSquad) || (gcol === 'Issue-Type' && core.state.hasIssueType);
    const isDrill  = !!drillSquad;
    const canDrill = gcol === 'Squad' && core.state.hasSquad && !isDrill;
    const hidden   = _getHiddenStates();
    const allOrdStates = cfg.stateOrder.map(n => core.state.states.find(s => s.name === n)).filter(s => s && !hidden.has(s.name));

    let groups;
    if (hasGrp) {
      const map = new Map();
      fRows.forEach(r => {
        const g = r[gcol] != null ? String(r[gcol]) : '(unbekannt)';
        if (!map.has(g)) map.set(g, []);
        map.get(g).push(r);
      });
      groups = [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], 'de'));
    } else {
      groups = [['Alle Items', fRows]];
    }

    if (!groups.length || !allOrdStates.length) { _showMsg('Keine Daten', 'Filter prüfen oder Spalten konfigurieren.'); return; }

    // Alle Stats vorberechnen (für N=0-Filter)
    const dataAll = groups.map(([gName, gRows]) => ({
      gName, gRows,
      stStats: allOrdStates.map(s => _stateStats(gRows, s)),
      ltStat:  _hasLT() ? _ltStats(gRows) : null,
    }));

    // ── N=0 Hiding: Spalten ausblenden wo ALLE Gruppen null-Stats haben ──
    const ordStates = allOrdStates.filter((s, i) =>
      dataAll.some(d => d.stStats[i] !== null)
    );
    const hiddenN0Count = allOrdStates.length - ordStates.length;

    // data mit gefilterten States neu aufbauen
    const data = dataAll.map(d => ({
      gName:   d.gName,
      gRows:   d.gRows,
      ltStat:  d.ltStat,
      stStats: ordStates.map(s => {
        const oi = allOrdStates.indexOf(s);
        return d.stStats[oi];
      }),
    }));

    let gMax = 0;
    data.forEach(({ stStats }) => stStats.forEach(st => { if (st) { const v = st[cfg.metric]; if (v != null && v > gMax) gMax = v; } }));

    const tbl   = document.createElement('table');
    const thead = document.createElement('thead'), hr = document.createElement('tr');
    const th0 = document.createElement('th');
    th0.textContent = hasGrp ? (gcol === 'Squad' ? 'Squad' : 'Issue-Typ') : 'Gruppe';
    hr.appendChild(th0);

    if (_hasLT()) { const th = document.createElement('th'); th.textContent = 'Lead Time'; hr.appendChild(th); }

    ordStates.forEach(s => {
      const isExtra = !DEFAULT_STATUS_ORDER.includes(s.name);
      const th = document.createElement('th');
      th.textContent = s.name;
      th.className = 'draggable-col' + (isExtra ? ' th-extra' : '');
      th.draggable = true; th.dataset.stateName = s.name;
      th.addEventListener('dragstart', e => _onColDragStart(e, s.name));
      th.addEventListener('dragover',  e => _onColDragOver(e, th));
      th.addEventListener('dragleave', ()  => th.classList.remove('drag-over-col'));
      th.addEventListener('drop',      e  => _onColDrop(e, s.name));
      th.addEventListener('dragend',   ()  => document.querySelectorAll('.dragging-col,.drag-over-col').forEach(el => el.classList.remove('dragging-col','drag-over-col')));
      hr.appendChild(th);
    });
    thead.appendChild(hr); tbl.appendChild(thead);

    const tbody = document.createElement('tbody');
    data.forEach(({ gName, stStats, ltStat }) => {
      const tr = document.createElement('tr');
      const tdG = document.createElement('td');
      tdG.className   = 'td-group' + (canDrill ? ' clickable' : '');
      tdG.textContent = gName;
      if (canDrill) tdG.addEventListener('click', () => drillInto(gName));
      tr.appendChild(tdG);

      const rowMax = Math.max(0, ...stStats.map(st => st ? (st[cfg.metric] || 0) : 0));
      if (_hasLT()) { const td = document.createElement('td'); td.className = 'td-lt'; td.appendChild(_buildCell(ltStat, 0, 0, gName, 'Lead Time', true)); tr.appendChild(td); }

      stStats.forEach((st, i) => {
        const td = document.createElement('td');
        if (st) {
          const v = st[cfg.metric];
          if (v != null && gMax > 0) {
            const t = v / gMax;
            td.style.background = core.lerp(t);
            td.dataset.cellContrast = core.getCellContrast(t);
          }
        }
        td.appendChild(_buildCell(st, gMax, rowMax, gName, ordStates[i].name, false));
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    tbl.appendChild(tbody);

    // Light-mode text contrast on colored cells
    if (core.isLight()) {
      tbody.querySelectorAll('td[data-cell-contrast]').forEach(td => {
        const color = td.dataset.cellContrast === 'dark' ? '#1e293b' : '#f1f5f9';
        td.querySelectorAll('.c-main,.c-sub,.c-n').forEach(el => el.style.color = color);
      });
    }

    tableWrap.innerHTML = '';
    tableWrap.appendChild(tbl);

    // Diag bar
    const total    = _getDrillRows().length;
    const resolved = _hasLT() ? _getDrillRows().filter(r => core.toDate(r[cfg.ltEnd]) != null).length : 0;
    const fStr     = (cfg.filter === 'resolved' && _hasLT()) ? `resolved (${resolved}/${total})` : `alle (${total})`;
    const _sf      = core.state.squadFilter;
    const sqCtx    = drillSquad ? ` · Drill: ${drillSquad}` : (_sf !== null && _sf.length ? ` · Squads: ${_sf.length}` : '');
    diagEl.textContent =
      `${core.state.rows.length} Items${sqCtx} · ${groups.length} Gruppen · ` +
      `${ordStates.length}/${cfg.stateOrder.length} Status` +
      (hiddenN0Count > 0 ? ` (${hiddenN0Count} leer ausgeblendet)` : '') + ` · ` +
      `Metrik: ${cfg.metric === 'med' ? 'Median' : cfg.metric.toUpperCase()} · Filter: ${fStr} · LT: ${_hasLT() ? cfg.ltStart + ' → ' + cfg.ltEnd : 'inaktiv'}`;
  }

  // ════════════════════════════════════════════════
  // 5. Config speichern & Events abonnieren
  // ════════════════════════════════════════════════
  core.on('data', () => {
    const s = core.state;

    // Globale Reihenfolge laden – neue Status aus Excel ans Ende anhängen
    const detectedNames = s.states.map(st => st.name);
    cfg.stateOrder = core.loadGlobalStatusOrder(detectedNames);

    // Validate saved LT columns
    if (!s.dateCols.includes(cfg.ltStart))
      cfg.ltStart = s.dateCols.includes(LT_START_DEFAULT) ? LT_START_DEFAULT : (s.dateCols[0] || '');
    if (!s.dateCols.includes(cfg.ltEnd) || cfg.ltEnd === cfg.ltStart)
      cfg.ltEnd = s.dateCols.includes(LT_END_DEFAULT) ? LT_END_DEFAULT : (s.dateCols[1] || s.dateCols[0] || '');

    // Validate grouping
    if (cfg.grouping === 'Squad' && !s.hasSquad) cfg.grouping = s.hasIssueType ? 'Issue-Type' : 'Issue-Type';
    if (cfg.grouping === 'Issue-Type' && !s.hasIssueType) cfg.grouping = s.hasSquad ? 'Squad' : 'Issue-Type';

    _populateLtSelects();
    _updateHasLT();
    if (!_hasLT() && cfg.filter === 'resolved') cfg.filter = 'all';
    _updateGroupToggle(); _updateMetricToggle(); _updateFilterToggle();
    _updateOrderPanel();
    render();
  });

  core.on('theme',       () => render());
  core.on('filter',      () => render());
  core.on('resize',      () => {});   // Heatmap ist DOM/table → kein SVG-Rerender nötig
  core.on('statusOrder', () => {
    // Globale Reihenfolge neu laden (ohne knownNames – bestehende Reihenfolge übernehmen)
    cfg.stateOrder = core.loadGlobalStatusOrder(core.state.states.map(st => st.name));
    _updateOrderPanel(); _updateStatusPanel(); render();
  });
}

// DOM helpers werden von core.js importiert (P3.7)
