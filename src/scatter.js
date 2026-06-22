// ════════════════════════════════════════════════
// scatter.js  –  CycleTime Scatterplot Visual
// Flow Analytics Dashboard v2.0
// Eigenständiges Visual – abonniert core-Events
// ════════════════════════════════════════════════

import { core, LT_START_DEFAULT, LT_END_DEFAULT, CT_START_DEFAULT, detectLtMode, ltModeTitle, mkBtn, mkPanel, mkTglGrp, mkSelect, mkLtField, mkTTRow, posTooltip } from './core.js';
import { calcCT } from './calc/scatter.calc.js';

export function init() {

  // ── 1. Lokaler Config-State ──────────────────
  const cfg = core.load('fhwa_scatter', {
    colorMode:   'single',
    interval:    'month',
    ctStart:     '',
    ctEnd:       '',
    dotSize:     4,
    singleColor: '',   // leer = theme-aware Fallback via core.palette()[0]
    typeColors:  {},
    show50: true,  color50: '#22d3ee',
    show70: true,  color70: '#86efac',
    show85: true,  color85: '#fbbf24',
    show95: true,  color95: '#f87171',
  });

  let   _typeMap   = {};          // auto-assigned type → color
  let   _renderTO  = null;        // debounce timer
  let   _scHideTimer = null;

  function saveConfig() { core.save('fhwa_scatter', cfg); }

  // ── 2. Card anlegen ──────────────────────────
  const { cardEl, contentEl, headerExtraEl, diagEl } = core.createCard({
    id:          'scatter',
    title:       'Cycle Time<span class="hl"> Scatterplot</span>',
    defaultGrid: { col: 0, row: 0, w: 12, h: 12 },
  });

  const titleEl = cardEl.querySelector('.card-title');

  // ── Modus-Helpers (Lead Time / Cycle Time / Sonstige) ───────────────────
  function _detectMode()   { return detectLtMode(cfg.ctStart, cfg.ctEnd); }
  function _getModeTitle() { return ltModeTitle(cfg.ctStart, cfg.ctEnd); }
  function _updateModeUI() {
    const mode = _detectMode();
    if (titleEl) titleEl.innerHTML = _getModeTitle();
    if (ltModeBtn) ltModeBtn.classList.toggle('p-blue', mode === 'lt');
    if (ctModeBtn) ctModeBtn.classList.toggle('p-blue', mode === 'ct');
  }

  // ── 3. Header-Controls ───────────────────────
  const colorToggle = mkTglGrp([
    { val: 'single',    label: 'Einfarbig' },
    { val: 'issueType', label: 'Typ'       },
    { val: 'heatmap',   label: 'Heatmap'   },
  ], val => { cfg.colorMode = val; saveConfig(); _updateColorToggle(); render(); });

  const intervalToggle = mkTglGrp([
    { val: 'week',    label: 'Wo' },
    { val: 'month',   label: 'Mo' },
    { val: 'quarter', label: 'Q'  },
  ], val => { cfg.interval = val; saveConfig(); _updateIntervalToggle(); render(); });

  const sep2        = document.createElement('div'); sep2.className = 'tb-sep';
  const btnSettings = mkBtn('⚙ Einstellungen', () => _toggleSettings());

  const ltModeBtn = mkBtn('Lead Time', () => {
    cfg.ctStart = LT_START_DEFAULT; cfg.ctEnd = LT_END_DEFAULT;
    ctStartSel.value = cfg.ctStart; ctEndSel.value = cfg.ctEnd;
    saveConfig(); _updateModeUI(); render();
  });
  const ctModeBtn = mkBtn('Cycle Time', () => {
    cfg.ctStart = CT_START_DEFAULT; cfg.ctEnd = LT_END_DEFAULT;
    ctStartSel.value = cfg.ctStart; ctEndSel.value = cfg.ctEnd;
    saveConfig(); _updateModeUI(); render();
  });

  [ltModeBtn, ctModeBtn, colorToggle, intervalToggle, sep2, btnSettings]
    .forEach(el => headerExtraEl.appendChild(el));
  _updateModeUI();

  // ── 4. Settings-Panel (einheitlich) ──────────

  const settingsPanel = mkPanel(); settingsPanel.id = 'sc-settings-panel';

  // Section: ⚙ Berechnungslogik
  const calcTitle = document.createElement('div'); calcTitle.className = 'panel-title'; calcTitle.style.color = 'var(--purple)'; calcTitle.textContent = '⚙ Berechnungslogik';
  const ctStartSel = mkSelect(); const ctEndSel = mkSelect();
  const colsRow = document.createElement('div'); colsRow.className = 'sc-row';
  colsRow.appendChild(mkLtField('CT Start',           ctStartSel));
  colsRow.appendChild(mkLtField('CT Ende (X-Achse)',  ctEndSel));
  ctStartSel.addEventListener('change', () => { cfg.ctStart = ctStartSel.value; saveConfig(); _updateModeUI(); render(); });
  ctEndSel.addEventListener('change',   () => { cfg.ctEnd   = ctEndSel.value;   saveConfig(); _updateModeUI(); render(); });

  const dotRow   = document.createElement('div'); dotRow.className = 'sc-row'; dotRow.style.cssText = 'margin-top:.3rem;align-items:center;gap:.4rem';
  const dotLabel = document.createElement('span'); dotLabel.className = 'lt-label'; dotLabel.textContent = 'Dot-Größe';
  const dotMinus = document.createElement('button'); dotMinus.className = 'btn-icon'; dotMinus.textContent = '–';
  const dotValEl = document.createElement('span'); dotValEl.style.cssText = 'min-width:1.6rem;text-align:center;font-family:var(--mono);font-size:.75rem;color:var(--text)'; dotValEl.textContent = cfg.dotSize ?? 4;
  const dotPlus  = document.createElement('button'); dotPlus.className = 'btn-icon'; dotPlus.textContent = '+';
  dotMinus.addEventListener('click', () => { cfg.dotSize = Math.max(2, (cfg.dotSize ?? 4) - 1); dotValEl.textContent = cfg.dotSize; saveConfig(); render(); });
  dotPlus.addEventListener('click',  () => { cfg.dotSize = Math.min(12, (cfg.dotSize ?? 4) + 1); dotValEl.textContent = cfg.dotSize; saveConfig(); render(); });
  dotRow.appendChild(dotLabel); dotRow.appendChild(dotMinus); dotRow.appendChild(dotValEl); dotRow.appendChild(dotPlus);

  settingsPanel.appendChild(calcTitle); settingsPanel.appendChild(colsRow); settingsPanel.appendChild(dotRow);

  // Section separator
  const panelSep1 = document.createElement('div'); panelSep1.style.cssText = 'border-top:1px solid var(--border);margin:.6rem 0';
  settingsPanel.appendChild(panelSep1);

  // Section: % Linien
  const pctTitle = document.createElement('div'); pctTitle.className = 'panel-title'; pctTitle.style.color = 'var(--yellow)'; pctTitle.textContent = '% Linien';
  const pctGrid  = document.createElement('div'); pctGrid.className = 'sc-pct-grid';
  settingsPanel.appendChild(pctTitle); settingsPanel.appendChild(pctGrid);

  // Section separator
  const panelSep2 = document.createElement('div'); panelSep2.style.cssText = 'border-top:1px solid var(--border);margin:.6rem 0';
  settingsPanel.appendChild(panelSep2);

  // Section: 🎨 Farb-Konfiguration
  const clrTitle = document.createElement('div'); clrTitle.className = 'panel-title'; clrTitle.style.color = 'var(--blue)'; clrTitle.textContent = '🎨 Farb-Konfiguration';
  const clrBody  = document.createElement('div');
  settingsPanel.appendChild(clrTitle); settingsPanel.appendChild(clrBody);

  cardEl.insertBefore(settingsPanel, contentEl);

  // ── Panel toggle ─────────────────────────────
  function _toggleSettings() {
    const open = !settingsPanel.classList.contains('open');
    settingsPanel.classList.toggle('open', open);
    btnSettings.className = 'btn-icon' + (open ? ' p-purple' : '');
    if (open) { _updatePctPanel(); _updateClrPanel(); }
    setTimeout(render, 20);
  }

  // ── 5. Content area ───────────────────────────
  contentEl.style.position = 'relative'; contentEl.style.overflow = 'hidden';

  const svgEl   = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svgEl.id = 'sc-svg';   // stabile ID für eindeutige clipPath-Referenz
  svgEl.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';

  const noDataEl  = document.createElement('div'); noDataEl.className = 'sc-nodata';
  const noDataH   = document.createElement('h3'); noDataH.textContent = 'Keine Daten';
  const noDataMsg = document.createElement('p');  noDataMsg.textContent = 'Berechnungslogik unter ⚙ Einstellungen konfigurieren';
  noDataEl.appendChild(noDataH); noDataEl.appendChild(noDataMsg);
  noDataEl.style.cssText = 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:.4rem;pointer-events:none';

  contentEl.appendChild(svgEl); contentEl.appendChild(noDataEl);

  // ── 6. Tooltip (an body gehängt) ─────────────
  const scTooltip = document.createElement('div');
  scTooltip.style.cssText = 'position:fixed;display:none;background:var(--bg2);border:1px solid var(--border);border-radius:9px;padding:.5rem .65rem;font-family:var(--mono);font-size:.64rem;color:var(--text);z-index:2000;box-shadow:0 12px 32px rgba(0,0,0,.5);min-width:148px';
  const scTTTitle = document.createElement('div'); scTTTitle.className = 'tt-title';
  const scTTBody  = document.createElement('div');
  scTooltip.appendChild(scTTTitle); scTooltip.appendChild(scTTBody);
  document.body.appendChild(scTooltip);

  scTooltip.addEventListener('mouseenter', () => { clearTimeout(_scHideTimer); _scHideTimer = null; });
  scTooltip.addEventListener('mouseleave', () => { _scHideTimer = setTimeout(() => { scTooltip.style.display = 'none'; }, 130); });

  // ══════════════════════════════════════════════
  // Toggle updaters
  // ══════════════════════════════════════════════
  function _updateColorToggle() {
    colorToggle.querySelectorAll('.tgl').forEach(b => b.classList.toggle('ta-b', b.dataset.val === cfg.colorMode));
  }

  function _updateIntervalToggle() {
    intervalToggle.querySelectorAll('.tgl').forEach(b => b.classList.toggle('ta-b', b.dataset.val === cfg.interval));
  }

  function _updatePctPanel() {
    pctGrid.innerHTML = '';
    [['50','P50','show50','color50'],['70','P70','show70','color70'],
     ['85','P85','show85','color85'],['95','P95','show95','color95']
    ].forEach(([v, lbl, sk, ck]) => {
      const item = document.createElement('div'); item.className = 'sc-pct-item';
      const cb   = document.createElement('input'); cb.type = 'checkbox'; cb.id = 'sc-pct-cb-' + v; cb.checked = cfg[sk];
      cb.addEventListener('change', () => { cfg[sk] = cb.checked; saveConfig(); render(); });
      const l  = document.createElement('label'); l.htmlFor = 'sc-pct-cb-' + v; l.textContent = lbl;
      const cp = document.createElement('input'); cp.type = 'color'; cp.value = cfg[ck];
      cp.addEventListener('input', () => { cfg[ck] = cp.value; saveConfig(); render(); });
      item.appendChild(cb); item.appendChild(l); item.appendChild(cp);
      pctGrid.appendChild(item);
    });
  }

  function _updateClrPanel() {
    clrBody.innerHTML = '';
    // Single color
    const s1 = document.createElement('div'); s1.className = 'sc-clr-section';
    const t1 = document.createElement('div'); t1.className = 'sc-clr-heading'; t1.textContent = 'Einfarbig';
    const r1 = document.createElement('div'); r1.className = 'sc-clr-item';
    const l1 = document.createElement('label'); l1.textContent = 'Farbe';
    const cp1 = document.createElement('input'); cp1.type = 'color'; cp1.value = cfg.singleColor || core.palette()[0];
    cp1.addEventListener('input', () => { cfg.singleColor = cp1.value; saveConfig(); render(); });
    r1.appendChild(l1); r1.appendChild(cp1); s1.appendChild(t1); s1.appendChild(r1); clrBody.appendChild(s1);

    // Issue types
    if (!core.state.rows.length || !core.state.hasIssueType) return;
    const types = [...new Set(core.state.rows.map(r => r['Issue-Type']).filter(t => t != null).map(String))].sort();
    if (!types.length) return;
    const s2 = document.createElement('div'); s2.className = 'sc-clr-section';
    const t2 = document.createElement('div'); t2.className = 'sc-clr-heading'; t2.textContent = 'Issue Types'; s2.appendChild(t2);
    types.forEach((type, idx) => {
      if (!cfg.typeColors[type]) cfg.typeColors[type] = core.palette()[idx % core.palette().length];
      const row = document.createElement('div'); row.className = 'sc-clr-item';
      const lbl = document.createElement('label'); lbl.textContent = type;
      const cp  = document.createElement('input'); cp.type = 'color'; cp.value = cfg.typeColors[type];
      cp.addEventListener('input', () => { cfg.typeColors[type] = cp.value; saveConfig(); render(); });
      row.appendChild(lbl); row.appendChild(cp); s2.appendChild(row);
    });
    clrBody.appendChild(s2);
  }

  function _populateCtSelects() {
    [ctStartSel, ctEndSel].forEach((sel, i) => {
      sel.innerHTML = '';
      const none = document.createElement('option'); none.value = ''; none.textContent = '— keine —'; sel.appendChild(none);
      core.state.dateCols.forEach(c => { const o = document.createElement('option'); o.value = c; o.textContent = c; sel.appendChild(o); });
      sel.value = i === 0 ? cfg.ctStart : cfg.ctEnd;
    });
    dotValEl.textContent = cfg.dotSize ?? 4;
  }

  // ── Color helpers ─────────────────────────────
  function _typeColorFor(type) {
    if (!type) return core.palette()[0];
    if (cfg.typeColors[type]) return cfg.typeColors[type];
    if (!_typeMap[type]) {
      const idx = Object.keys(_typeMap).length % core.palette().length;
      _typeMap[type] = core.palette()[idx];
    }
    return _typeMap[type];
  }

  function _dotColor(item, maxCT) {
    if (cfg.colorMode === 'issueType') return cfg.typeColors[item.type] || _typeColorFor(item.type);
    if (cfg.colorMode === 'heatmap')   return core.lerp(maxCT > 0 ? item.ct / maxCT : 0);
    return cfg.singleColor || core.palette()[0];
  }

  // ── Tick helpers ──────────────────────────────
  function _niceYTicks(max) {
    if (max <= 0) return [0];
    const steps = [1,2,5,10,15,20,25,50,75,100,150,200,250,500];
    let step = 1;
    for (const s of steps) { if (max / s <= 6) { step = s; break; } }
    const t = [];
    for (let v = 0; v <= max * 1.01; v += step) t.push(Math.round(v * 10) / 10);
    return t;
  }

  function _getTickDates(minD, maxD, interval) {
    const ticks = []; const d = new Date(minD);
    if (interval === 'week') {
      const dow = d.getDay(); if (dow !== 1) d.setDate(d.getDate() + (dow === 0 ? 1 : 8 - dow));
      d.setHours(0,0,0,0);
      while (d <= maxD) { ticks.push(new Date(d)); d.setDate(d.getDate() + 7); }
    } else if (interval === 'month') {
      d.setDate(1); d.setHours(0,0,0,0); if (d < minD) d.setMonth(d.getMonth() + 1);
      while (d <= maxD) { ticks.push(new Date(d)); d.setMonth(d.getMonth() + 1); }
    } else {
      const q = Math.ceil((d.getMonth() + 1) / 3); d.setMonth((q-1)*3, 1); d.setHours(0,0,0,0);
      if (d < minD) d.setMonth(d.getMonth() + 3);
      while (d <= maxD) { ticks.push(new Date(d)); d.setMonth(d.getMonth() + 3); }
    }
    return ticks;
  }

  function _fmtTickDate(d, interval) {
    if (interval === 'week')  return d.toLocaleDateString('de-DE', { day:'2-digit', month:'2-digit' });
    if (interval === 'month') return d.toLocaleDateString('de-DE', { month:'short', year:'2-digit' });
    return 'Q' + Math.ceil((d.getMonth()+1)/3) + ' \'' + d.getFullYear().toString().slice(2);
  }

  // ── Tooltip ───────────────────────────────────
  function _showTT(e, item) {
    clearTimeout(_scHideTimer); _scHideTimer = null;
    scTTTitle.textContent = item.key || (item.type || 'Item');
    scTTBody.innerHTML = '';
    [['CT',    item.ct.toFixed(1) + 'd'],
     ['Datum', item.date.toLocaleDateString('de-DE')],
     ...(item.type ? [['Typ', item.type]] : []),
    ].forEach(([l, v]) => scTTBody.appendChild(mkTTRow(l, v)));

    if (item.url) {
      const lnk = document.createElement('a');
      lnk.className = 'tt-link';
      lnk.textContent = '↗ ' + item.key + ' öffnen';
      lnk.addEventListener('click', ev => { ev.preventDefault(); window.open(item.url, '_blank'); });
      scTTBody.appendChild(lnk);
      scTooltip.style.pointerEvents = 'all';
    } else {
      scTooltip.style.pointerEvents = 'none';
    }
    scTooltip.style.display = 'block';
    posTooltip(scTooltip, e.clientX, e.clientY);
  }

  // ════════════════════════════════════════════════
  // 4. Render
  // ════════════════════════════════════════════════
  function render() {
    clearTimeout(_renderTO);
    _renderTO = setTimeout(_doRender, 16);
  }

  function _doRender() {
    const W = contentEl.clientWidth, H = contentEl.clientHeight;
    if (W < 20 || H < 20) { svgEl.innerHTML = ''; return; }

    if (!core.state.rows.length || !cfg.ctEnd) {
      svgEl.innerHTML = ''; noDataEl.style.display = 'flex';
      noDataMsg.textContent = 'Berechnungslogik unter ⚙ Einstellungen konfigurieren';
      diagEl.textContent = '—'; return;
    }

    // Build items
    const baseRows = core.filteredRows();
    const items = [];
    _typeMap = {};

    baseRows.forEach(r => {
      const endDate = core.toDate(r[cfg.ctEnd]);
      if (!endDate) return;
      const ct = (cfg.ctStart && cfg.ctStart !== cfg.ctEnd)
        ? calcCT(r[cfg.ctStart], r[cfg.ctEnd])
        : null;
      if (!ct) return;
      const key = String(r['Jira-ID'] || '');
      const url = core.state.urlTemplate ? core.state.urlTemplate.replace(/\{issueKey\}/g, key) : '';
      items.push({ key, type: String(r['Issue-Type'] || ''), ct, date: endDate, url });
    });

    if (!items.length) {
      svgEl.innerHTML = ''; noDataEl.style.display = 'flex';
      noDataMsg.textContent = 'Keine Items mit ' + cfg.ctEnd + ' Datum';
      diagEl.textContent = 'Keine Daten'; return;
    }
    noDataEl.style.display = 'none';

    // Scales
    const ML = 50, MR = 88, MT = 20, MB = 44;
    const pW = Math.max(1, W - ML - MR), pH = Math.max(1, H - MT - MB);

    let minD = items[0].date, maxD = items[0].date;
    items.forEach(d => { if (d.date < minD) minD = d.date; if (d.date > maxD) maxD = d.date; });
    const dateRange = Math.max(1, maxD.getTime() - minD.getTime());
    const xS = d => ML + ((d.getTime() - minD.getTime()) / dateRange) * pW;

    const ctVals = [...items.map(d => d.ct)].sort((a, b) => a - b);
    const maxCT  = ctVals[ctVals.length - 1] * 1.1;
    const yS     = ct => MT + pH * (1 - ct / maxCT);
    const P      = { p50: core.pct(ctVals,50), p70: core.pct(ctVals,70), p85: core.pct(ctVals,85), p95: core.pct(ctVals,95) };

    const parts = [];
    const C     = core.scatterColors();

    // Plot background + clip
    parts.push(`<rect x="${ML}" y="${MT}" width="${pW}" height="${pH}" fill="${C.plotBg}" rx="2"/>`);
    parts.push(`<defs><clipPath id="scc-${svgEl.id || 'sc'}"><rect x="${ML}" y="${MT}" width="${pW}" height="${pH}"/></clipPath></defs>`);
    const clip = `clip-path="url(#scc-${svgEl.id || 'sc'})"`;

    // Y gridlines + labels
    _niceYTicks(maxCT).forEach(v => {
      if (v <= 0 || v > maxCT * 0.99) return;
      const y = yS(v).toFixed(1);
      parts.push(`<line x1="${ML}" y1="${y}" x2="${ML+pW}" y2="${y}" stroke="${C.gridLine}" stroke-width="1"/>`);
      parts.push(`<text x="${ML-5}" y="${(parseFloat(y)+3.5).toFixed(1)}" fill="${C.axisLabel}" font-family="var(--mono)" font-size="9" text-anchor="end">${v}d</text>`);
    });

    // Axis lines
    parts.push(`<line x1="${ML}" y1="${MT}"    x2="${ML}"    y2="${MT+pH}" stroke="${C.axisLine}" stroke-width="1.5"/>`);
    parts.push(`<line x1="${ML}" y1="${MT+pH}" x2="${ML+pW}" y2="${MT+pH}" stroke="${C.axisLine}" stroke-width="1.5"/>`);

    // Y axis label (rotated)
    parts.push(`<text transform="rotate(-90 ${ML-36} ${MT+pH/2})" x="${ML-36}" y="${(MT+pH/2+4).toFixed(0)}" fill="${C.axisLabelFaint}" font-family="var(--mono)" font-size="9" text-anchor="middle">CT (Tage)</text>`);

    // X ticks
    const xTicks  = _getTickDates(minD, maxD, cfg.interval);
    const maxXTk  = Math.max(2, Math.floor(pW / 55));
    const xStep   = Math.max(1, Math.ceil(xTicks.length / maxXTk));
    xTicks.forEach((d, i) => {
      if (i % xStep !== 0) return;
      const x = xS(d).toFixed(1);
      parts.push(`<line x1="${x}" y1="${MT}" x2="${x}" y2="${MT+pH+5}" stroke="${C.gridLine}" stroke-width="1"/>`);
      parts.push(`<text x="${x}" y="${MT+pH+14}" fill="${C.axisLabel}" font-family="var(--mono)" font-size="9" text-anchor="middle">${_fmtTickDate(d, cfg.interval)}</text>`);
    });

    // Percentile lines
    [{ show: cfg.show50, val: P.p50, color: cfg.color50, lbl: 'P50' },
     { show: cfg.show70, val: P.p70, color: cfg.color70, lbl: 'P70' },
     { show: cfg.show85, val: P.p85, color: cfg.color85, lbl: 'P85' },
     { show: cfg.show95, val: P.p95, color: cfg.color95, lbl: 'P95' },
    ].forEach(({ show, val, color, lbl }) => {
      if (!show || val == null || val > maxCT) return;
      const y = yS(val).toFixed(1);
      parts.push(`<line x1="${ML}" y1="${y}" x2="${ML+pW}" y2="${y}" stroke="${color}" stroke-width="1.5" stroke-dasharray="6,3" ${clip}/>`);
      parts.push(`<text x="${ML+pW+5}" y="${(parseFloat(y)+4).toFixed(1)}" fill="${color}" font-family="var(--mono)" font-size="10" font-weight="600">${lbl}</text>`);
      parts.push(`<text x="${ML+pW+5}" y="${(parseFloat(y)+14).toFixed(1)}" fill="${color}" font-family="var(--mono)" font-size="9" opacity="0.8">${val.toFixed(0)}d</text>`);
    });

    // Data dots
    const dotR = Math.max(1.5, Math.min(cfg.dotSize ?? 4, pW / 60));
    items.forEach((item, idx) => {
      const cx     = xS(item.date).toFixed(1), cy = yS(item.ct).toFixed(1);
      const color  = _dotColor(item, maxCT);
      const cursor = item.url ? 'pointer' : 'crosshair';
      parts.push(`<circle cx="${cx}" cy="${cy}" r="${dotR}" fill="${color}" fill-opacity="0.95" stroke="${C.dotStroke}" stroke-width="${C.dotStrokeW}" cursor="${cursor}" class="sc-dot" data-idx="${idx}" ${clip}/>`);
    });

    // N info
    let nInfo = `n = ${items.length}`;
    if (cfg.colorMode === 'issueType' && core.state.hasIssueType) {
      const tc = {}; items.forEach(it => { if (it.type) tc[it.type] = (tc[it.type] || 0) + 1; });
      const ps = Object.entries(tc).map(([t, c]) => `${t}: ${c}`);
      if (ps.length <= 5) nInfo += '  (' + ps.join(', ') + ')';
    }
    parts.push(`<text x="${ML+4}" y="${MT-5}" fill="${C.nText}" font-family="var(--mono)" font-size="9">${nInfo}</text>`);

    // Issue-Type legend
    if (cfg.colorMode === 'issueType' && core.state.hasIssueType) {
      const types = [...new Set(items.map(d => d.type).filter(t => t))].sort();
      if (types.length) {
        const lPad = 8, lLineH = 16, lDotR = 5, lFontSz = 9;
        const maxLen = Math.max(...types.map(t => t.length)) * 5.5;
        const lW = Math.ceil(maxLen + lDotR*2 + lPad*2 + 6);
        const lH = types.length * lLineH + lPad*2 - 2;
        const lx = ML + pW - lW - 6, ly = MT + 8;
        parts.push(`<rect x="${lx}" y="${ly}" width="${lW}" height="${lH}" fill="${C.legendBg}" stroke="${C.legendBorder}" stroke-width="1" rx="5"/>`);
        types.forEach((type, i) => {
          const color = cfg.typeColors[type] || _typeColorFor(type);
          const ey = ly + lPad + i * lLineH + lDotR;
          parts.push(`<circle cx="${lx+lPad+lDotR}" cy="${ey}" r="${lDotR}" fill="${color}" fill-opacity="0.95" stroke="${C.dotStroke}" stroke-width="1"/>`);
          parts.push(`<text x="${lx+lPad+lDotR*2+5}" y="${ey+lFontSz/2-1}" fill="${C.legendText}" font-family="var(--mono)" font-size="${lFontSz}">${type}</text>`);
        });
      }
    }

    svgEl.innerHTML = parts.join('');

    // Attach dot hover events
    svgEl.querySelectorAll('.sc-dot').forEach(dot => {
      const item = items[parseInt(dot.dataset.idx)];
      dot.addEventListener('mouseenter', e => _showTT(e, item));
      dot.addEventListener('mousemove',  e => posTooltip(scTooltip, e.clientX, e.clientY));
      dot.addEventListener('mouseleave', () => { _scHideTimer = setTimeout(() => { scTooltip.style.display = 'none'; }, 130); });
    });

    diagEl.textContent = `n=${items.length} · CT: ${cfg.ctStart || '?'} → ${cfg.ctEnd} · P50: ${P.p50 ? P.p50.toFixed(1)+'d' : '–'} · P85: ${P.p85 ? P.p85.toFixed(1)+'d' : '–'} · Farbe: ${cfg.colorMode} · Intervall: ${cfg.interval}`;
  }

  // ════════════════════════════════════════════════
  // 5. Events abonnieren
  // ════════════════════════════════════════════════
  core.on('data', () => {
    const s = core.state;

    // Validate CT columns
    if (!s.dateCols.includes(cfg.ctStart))
      cfg.ctStart = s.dateCols.includes(CT_START_DEFAULT) ? CT_START_DEFAULT : (s.dateCols[0] || '');
    if (!s.dateCols.includes(cfg.ctEnd))
      cfg.ctEnd = s.dateCols.includes(LT_END_DEFAULT) ? LT_END_DEFAULT : (s.dateCols[1] || s.dateCols[0] || '');

    _typeMap = {};
    _populateCtSelects();
    _updateColorToggle();
    _updateIntervalToggle();
    _updatePctPanel();
    _updateClrPanel();
    _updateModeUI();
    render();
  });

  core.on('theme',    () => { _updateClrPanel(); render(); });
  core.on('filter',   () => render());
  core.on('resize', () => {
    // Re-read ctStart/ctEnd to pick up BoxChart→Scatter sync via localStorage
    const saved = core.load('fhwa_scatter', {});
    let changed = false;
    if (saved.ctStart !== undefined && saved.ctStart !== cfg.ctStart) {
      cfg.ctStart = saved.ctStart; changed = true;
    }
    if (saved.ctEnd !== undefined && saved.ctEnd !== cfg.ctEnd) {
      cfg.ctEnd = saved.ctEnd; changed = true;
    }
    if (changed) { _populateCtSelects(); _updateModeUI(); }
    render();
  });
  core.on('settings', () => { _updateModeUI(); render(); });
}

// DOM helpers werden von core.js importiert (P3.7)
