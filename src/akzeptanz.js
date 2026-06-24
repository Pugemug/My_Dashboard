// ════════════════════════════════════════════════
// akzeptanz.js  –  Akzeptanzkriterien Visual
// Flow Analytics Dashboard
// Visual-ID   : akzeptanz
// Page        : lieferfahigkeit (tile-canvas)
// localStorage: fhwa_akzeptanz
// ════════════════════════════════════════════════
import { core, escHtml, createTooltip, createExplanationPanel } from './core.js';
import { wordCount, calcAkQuality, sortStagesByBrpEtappen } from './calc/akzeptanz.calc.js';

const VID    = 'akzeptanz';
const LS_KEY = 'fhwa_akzeptanz';

const CFG_DEF = { dotRadius: 5 };

// ── Modul-State ──────────────────────────────────────────────────────────────
let _cfg, _contentEl, _svgWrapEl, _diagEl, _diagTextEl, _nBadgeEl, _headerExtraEl, _ttEl, _fmtPanelEl, _tileEl;
let _expPanel;
let _stages   = []; // geordnete Stage-Namen (aus _onData)
let _epicRows = []; // JiraEpics-Zeilen

// ════════════════════════════════════════════════
// Public – Einstiegspunkt
// ════════════════════════════════════════════════
export function init() {
  _cfg = { ...CFG_DEF, ...core.load(LS_KEY, {}) };
  _cfg.dotRadius = Math.max(3, Math.min(10, _cfg.dotRadius || CFG_DEF.dotRadius));

  const { tileEl, contentEl, headerExtraEl, diagEl } = core.createTile({
    id:    VID,
    title: 'Akzeptanz<span class="hl">kriterien</span>',
  });
  _tileEl        = tileEl;
  _contentEl     = contentEl;
  _headerExtraEl = headerExtraEl;
  _diagEl        = diagEl;

  _ttEl = createTooltip();

  // ── Diag-Bar: flex mit „Was zeigt diese Ansicht?"-Link links ──
  _diagEl.style.cssText = 'display:flex;align-items:center;gap:8px;overflow:hidden';
  const diagLink = document.createElement('a');
  diagLink.textContent = 'Was zeigt diese Ansicht?';
  diagLink.style.cssText = 'font-size:11px;color:var(--blue);white-space:nowrap;flex-shrink:0;cursor:pointer;text-decoration:none;user-select:none';
  diagLink.addEventListener('click', _toggleExplanation);
  _diagTextEl = document.createElement('span');
  _diagTextEl.style.cssText = 'font-size:11px;color:var(--dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1;text-align:right';
  _diagEl.appendChild(diagLink);
  _diagEl.appendChild(_diagTextEl);

  // ── Layout + Erklärungs-Panel ──
  contentEl.style.cssText = 'position:relative;overflow:hidden;display:flex;flex-direction:column';
  _expPanel = createExplanationPanel(contentEl,
    'Misst die Qualität der Akzeptanzkriterien pro Etappe.' +
    '<br><br>' +
    '<strong style="color:var(--text)">AK-Qualität</strong> = Anteil der Epics, deren ' +
    'Akzeptanzkriterien-Feld mehr als&nbsp;3&nbsp;Wörter enthält – bezogen auf alle Epics ' +
    'des gewählten Squads in dieser Etappe.' +
    '<br><br>' +
    'Eine hohe Quote deutet auf gut formulierte Anforderungen hin.',
  );

  // ── SVG-Wrapper: permanenter Chart-Bereich (nie überschrieben) ──
  _svgWrapEl = document.createElement('div');
  _svgWrapEl.style.cssText = 'flex:1;min-height:0;position:relative;overflow:hidden';
  contentEl.appendChild(_svgWrapEl);

  _buildHeaderControls();

  core.on('data',   _onData);
  core.on('filter', _render);
  core.on('theme',  _render);
  core.on('resize', _render);
}

function _toggleExplanation() { _expPanel.toggle(_render); }

// ════════════════════════════════════════════════
// Header-Controls: ⚙-Button + Format-Panel
// ════════════════════════════════════════════════
function _buildHeaderControls() {
  _nBadgeEl = document.createElement('span');
  _nBadgeEl.style.cssText = 'font-size:11px;color:var(--dim);font-family:var(--mono);white-space:nowrap;margin-right:.15rem;';
  _headerExtraEl.appendChild(_nBadgeEl);

  const sep = document.createElement('div');
  sep.style.cssText = 'width:1px;height:14px;background:var(--border);flex-shrink:0;margin:0 .1rem';
  _headerExtraEl.appendChild(sep);

  const fmtBtn = document.createElement('button');
  fmtBtn.innerHTML = '&#9881;';
  fmtBtn.title = 'Format';
  fmtBtn.style.cssText = [
    'background:transparent', 'border:none', 'color:var(--dimmer)',
    'cursor:pointer',          'font-size:.72rem', 'padding:0 .2rem',
    'line-height:1',           'flex-shrink:0',
  ].join(';');
  fmtBtn.addEventListener('click', e => { e.stopPropagation(); _toggleFmtPanel(fmtBtn); });
  _headerExtraEl.appendChild(fmtBtn);

  // Format-Panel: position:fixed weil .tile overflow:hidden hat
  _fmtPanelEl = document.createElement('div');
  _fmtPanelEl.style.cssText = [
    'position:fixed', 'z-index:600',
    'background:var(--bg2)',  'border:1px solid var(--border)',
    'border-radius:8px',      'padding:.65rem .85rem',
    'min-width:195px',        'display:none',
    'box-shadow:0 4px 18px rgba(0,0,0,.45)',
  ].join(';');
  document.body.appendChild(_fmtPanelEl);
  _rebuildFmtPanel();

  document.addEventListener('click', e => {
    if (!_fmtPanelEl || _fmtPanelEl.style.display === 'none') return;
    if (!_fmtPanelEl.contains(e.target) && !_tileEl.contains(e.target)) {
      _fmtPanelEl.style.display = 'none';
    }
  });
}

function _rebuildFmtPanel() {
  _fmtPanelEl.innerHTML = `
    <div style="font-weight:600;font-size:.62rem;color:var(--blue);
                text-transform:uppercase;letter-spacing:.08em;margin-bottom:.55rem">Format</div>
    <div style="display:flex;flex-direction:column;gap:.48rem">
      <div style="display:flex;flex-direction:column;gap:.15rem">
        <span style="font-size:.65rem;color:var(--dim)">
          Punkt-Radius&thinsp;
          <b id="${VID}-rd">${_cfg.dotRadius}</b>&thinsp;px
        </span>
        <input id="${VID}-r" type="range" min="3" max="10" step="1" value="${_cfg.dotRadius}"
          style="accent-color:var(--blue);width:100%"/>
      </div>
    </div>`;

  const ri = _fmtPanelEl.querySelector(`#${VID}-r`);
  const rd = _fmtPanelEl.querySelector(`#${VID}-rd`);

  ri.addEventListener('input', () => {
    _cfg.dotRadius = Math.max(3, Math.min(10, parseInt(ri.value, 10) || CFG_DEF.dotRadius));
    if (rd) rd.textContent = _cfg.dotRadius;
    _saveCfg();
    _render();
  });
}

function _toggleFmtPanel(btn) {
  if (_fmtPanelEl.style.display !== 'none') {
    _fmtPanelEl.style.display = 'none';
    return;
  }
  _rebuildFmtPanel();
  _fmtPanelEl.style.display = 'block';
  const br     = btn.getBoundingClientRect();
  const panelW = 200;
  let left = br.right - panelW;
  if (left < 4) left = br.left;
  _fmtPanelEl.style.top  = (br.bottom + 4) + 'px';
  _fmtPanelEl.style.left = Math.max(4, left) + 'px';
}

// ════════════════════════════════════════════════
// Daten-Parsing (beim 'data'-Event)
// ════════════════════════════════════════════════
function _onData() {
  _epicRows = (core.state.sheets && core.state.sheets['JiraEpics']) ? core.state.sheets['JiraEpics'] : [];
  const brpRows = (core.state.sheets && core.state.sheets['BRP Etappen']) ? core.state.sheets['BRP Etappen'] : [];

  const rawStages = [...new Set(_epicRows.map(r => r['Stage']).filter(s => s != null && String(s).trim() !== '').map(String))];
  _stages = sortStagesByBrpEtappen(rawStages, brpRows, core.toDate.bind(core));

  _render();
}

// ════════════════════════════════════════════════
// Render (data · filter · theme · resize)
// ════════════════════════════════════════════════
function _render() {
  if (!_contentEl) return;
  if (_contentEl.clientWidth < 20) return;
  if (_ttEl) _ttEl.style.display = 'none';

  // ── Noch keine Datei geladen ──
  if (!core.state.rows || !core.state.rows.length) {
    _showMsg('Noch keine Datei geladen');
    if (_nBadgeEl) _nBadgeEl.textContent = '';
    _diagTextEl.textContent = '–';
    return;
  }

  // ── Squad-Filter-Validierung (identisch zu Happiness / WIP) ──
  const sf = core.state.squadFilter;
  if (!sf || !sf.length) {
    _showMsg('Kein Squad ausgewählt');
    if (_nBadgeEl) _nBadgeEl.textContent = '';
    _diagTextEl.textContent = 'Kein Squad';
    return;
  }
  if (sf.length > 1) {
    _showMsg('Bitte nur 1 Squad wählen');
    if (_nBadgeEl) _nBadgeEl.textContent = '';
    _diagTextEl.textContent = `${sf.length} Squads gewählt`;
    return;
  }

  // ── JiraEpics fehlt oder leer ──
  if (!_epicRows.length) {
    _showMsg('JiraEpics-Sheet nicht gefunden');
    if (_nBadgeEl) _nBadgeEl.textContent = '';
    _diagTextEl.textContent = 'JiraEpics fehlt';
    return;
  }

  // ── Keine Stage-Daten ──
  if (!_stages.length) {
    _showMsg('Keine Epics mit Stage-Daten');
    if (_nBadgeEl) _nBadgeEl.textContent = '';
    _diagTextEl.textContent = 'Keine Stage-Daten';
    return;
  }

  const squadName = sf[0];

  // ── Zeitraum-Filter auf Epics anwenden ──
  let filteredEpics = _epicRows;
  const drMode = core.state.dateRangeMode;
  if (drMode !== 'all' && core.state.dateRangeFrom && core.state.dateRangeTo) {
    const from = core.state.dateRangeFrom;
    const to   = core.state.dateRangeTo;
    filteredEpics = _epicRows.filter(r => {
      const resolved = core.toDate(r['Resolved']);
      const rejected = core.toDate(r['Rejected']);
      const doneDate = resolved ?? rejected;
      if (!doneDate) return true;          // offenes Epic: immer anzeigen
      return doneDate >= from && doneDate <= to;
    });
  }

  // ── Stages einschränken auf solche mit mind. 1 Epic für diesen Squad ──
  const visibleStages = _stages.filter(stage =>
    filteredEpics.some(r => r['Stage'] === stage && r['Squad'] === squadName)
  );

  // ── Qualität pro Stage berechnen ──
  const qualities = visibleStages.map(stage => ({
    stage,
    q: calcAkQuality(filteredEpics, stage, squadName),
  }));

  // ── Squad hat keine Epics in JiraEpics ──
  if (!qualities.some(d => d.q !== null)) {
    _showMsg(`Keine Daten für Squad „${escHtml(squadName)}”`);
    if (_nBadgeEl) _nBadgeEl.textContent = '';
    _diagTextEl.textContent = 'Squad fehlt';
    return;
  }

  const totalEpics = filteredEpics.filter(r => r['Squad'] === squadName && r['Stage'] != null && String(r['Stage']).trim() !== '').length;

  if (_nBadgeEl) _nBadgeEl.textContent = `N = ${totalEpics}`;
  _drawChart(squadName, qualities);

  _diagTextEl.textContent = '';
}

// ════════════════════════════════════════════════
// SVG-Chart
// ════════════════════════════════════════════════
function _drawChart(squadName, qualities) {
  const W  = _svgWrapEl.clientWidth  || _contentEl.clientWidth  || 400;
  const H  = _svgWrapEl.clientHeight || _contentEl.clientHeight || 180;
  const sc = core.scatterColors();
  const lineColor = core.palette()[0];

  const baseR = _cfg.dotRadius;
  const r     = Math.max(2.5, baseR * Math.sqrt(Math.min(W, H) / 200));

  const padL = 42, padR = 14, padT = 12, padB = 38;
  const cW   = W - padL - padR;
  const cH   = H - padT - padB;
  const n    = qualities.length;

  const xOf = i => padL + (n > 1 ? (i * cW) / (n - 1) : cW / 2);
  const yOf = v => padT + cH - (v / 100) * cH;

  const parts = [
    `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg" style="display:block;overflow:visible">`,
  ];

  // ── Y-Gitternetz (0–100 %, ganzzahlige Ticks via core.intTicks) ──
  const yTicks = core.intTicks(100, 5);
  for (const v of yTicks) {
    const yp = yOf(v).toFixed(1);
    parts.push(
      `<line x1="${padL}" y1="${yp}" x2="${(W - padR).toFixed(1)}" y2="${yp}"
         stroke="${sc.gridLine}" stroke-width="${v === 0 ? 1.5 : 0.5}"
         stroke-dasharray="${v === 0 ? '' : '3,3'}"/>`,
      `<text x="${(padL - 4).toFixed(1)}" y="${(parseFloat(yp) + 3.5).toFixed(1)}"
         text-anchor="end" font-family="var(--mono)" font-size="9"
         fill="${sc.axisLabel}">${v}%</text>`,
    );
  }

  // ── Verbindungslinie (nur zwischen Punkten mit q !== null) ──
  for (let i = 0; i < n - 1; i++) {
    if (qualities[i].q === null || qualities[i + 1].q === null) continue;
    parts.push(
      `<line
         x1="${xOf(i).toFixed(1)}"     y1="${yOf(qualities[i].q).toFixed(1)}"
         x2="${xOf(i + 1).toFixed(1)}" y2="${yOf(qualities[i + 1].q).toFixed(1)}"
         stroke="${lineColor}" stroke-width="2" stroke-linecap="round"/>`,
    );
  }

  // ── Datenpunkte (nur wo q !== null) ──
  qualities.forEach((d, i) => {
    if (d.q === null) return;
    const cx = xOf(i).toFixed(1);
    const cy = yOf(d.q).toFixed(1);
    parts.push(
      `<circle data-i="${i}"
         cx="${cx}" cy="${cy}" r="${r.toFixed(1)}"
         fill="${lineColor}"
         stroke="${sc.dotStroke}" stroke-width="${sc.dotStrokeW}"
         style="cursor:default"/>`,
    );
  });

  // ── X-Achsen-Labels (rotiert, Dichte begrenzt) ──
  const maxLbls = Math.max(2, Math.floor(cW / 62));
  const step    = n <= maxLbls ? 1 : Math.ceil(n / maxLbls);
  qualities.forEach((d, i) => {
    if (i % step !== 0 && i !== n - 1) return;
    const x  = xOf(i).toFixed(1);
    const ty = (H - padB + 13).toFixed(1);
    const ry = (H - padB + 4).toFixed(1);
    parts.push(
      `<text x="${x}" y="${ty}" text-anchor="middle"
         font-family="var(--mono)" font-size="9"
         fill="${sc.axisLabel}"
         transform="rotate(-30,${x},${ry})">${escHtml(d.stage)}</text>`,
    );
  });

  parts.push('</svg>');
  _svgWrapEl.innerHTML = parts.join('\n');

  // ── Tooltip-Events ──
  _svgWrapEl.querySelectorAll('circle[data-i]').forEach(dot => {
    dot.addEventListener('mouseover', e => {
      const idx  = parseInt(dot.dataset.i, 10);
      const d    = qualities[idx];
      const grp  = _epicRows.filter(r => r['Stage'] === d.stage && r['Squad'] === squadName);
      const N    = grp.length;
      const nQ   = grp.filter(r => wordCount(r['Akzeptanzkriterien']) > 3).length;
      _ttEl.innerHTML =
        `<div style="font-weight:600;margin-bottom:.25rem;color:var(--blue)">${escHtml(d.stage)}</div>` +
        `<div><span style="color:var(--dim)">Squad&nbsp;</span>${escHtml(squadName)}</div>` +
        `<div><span style="color:var(--dim)">AK-Qualität&nbsp;</span><b>${d.q.toFixed(2)}&thinsp;%</b></div>` +
        `<div><span style="color:var(--dim)">Epics&nbsp;</span>${nQ} von ${N}</div>`;
      _ttEl.style.display = 'block';
      _posTT(e);
    });
    dot.addEventListener('mousemove', e => _posTT(e));
    dot.addEventListener('mouseout',  ()  => { _ttEl.style.display = 'none'; });
  });
}

// ── Tooltip positionieren (boundary-safe, position:fixed) ──
function _posTT(e) {
  const tw = _ttEl.offsetWidth  || 150;
  const th = _ttEl.offsetHeight || 72;
  let x = e.clientX + 14;
  let y = e.clientY + 14;
  if (x + tw > window.innerWidth  - 4) x = e.clientX - tw - 10;
  if (y + th > window.innerHeight - 4) y = e.clientY - th - 10;
  _ttEl.style.left = Math.max(4, x) + 'px';
  _ttEl.style.top  = Math.max(4, y) + 'px';
}

// ════════════════════════════════════════════════
// Hilfsfunktionen
// ════════════════════════════════════════════════
function _showMsg(text) {
  _svgWrapEl.innerHTML =
    `<div class="state-msg sc-nodata"><h3>${text}</h3></div>`;
}

function _saveCfg() {
  core.save(LS_KEY, _cfg);
}
