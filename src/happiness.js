// ════════════════════════════════════════════════
// happiness.js  –  Happiness Faktor Visual
// Flow Analytics Dashboard
// Visual-ID   : happinessfaktor
// Page        : lieferfahigkeit (tile-canvas)
// localStorage: fhwa_happinessfaktor
// ════════════════════════════════════════════════
import { core, createTooltip, createExplanationPanel } from './core.js';

const VID    = 'happinessfaktor';
const LS_KEY = 'fhwa_happinessfaktor';
const SHEET  = 'Happiness Faktor';
const NV_COL = '#9e9e9e';

const CFG_DEF = { title: 'Happiness Faktor', dotRadius: 6 };

// ── Happiness colour: 1=rot · 3=gelb · 5=grün (semantisch, theme-unabhängig) ──
function _hCol(v) {
  const c = Math.max(1, Math.min(5, v));
  if (c <= 3) {
    const t = (c - 1) / 2;
    return `rgb(${Math.round(229 + (253 - 229) * t)},${Math.round(57 + (216 - 57) * t)},53)`;
  }
  const t = (c - 3) / 2;
  return `rgb(${Math.round(253 + (67 - 253) * t)},${Math.round(216 + (160 - 216) * t)},${Math.round(53 + (71 - 53) * t)})`;
}

// ── Monats-Label "Jun '25" ──────────────────────────────────────────────────
function _mlbl(d) {
  if (!d) return '';
  const dt = d instanceof Date ? d : new Date(d);
  return isNaN(dt.getTime()) ? '' : dt.toLocaleDateString('de-DE', { month: 'short', year: '2-digit' });
}

// ── Modul-State ──────────────────────────────────────────────────────────────
let _cfg, _contentEl, _diagEl, _headerExtraEl, _ttEl, _fmtPanelEl, _tileEl;
let _nBadgeEl, _diagMid, _expPanel;
let _rawMonths = []; // [{ date:Date, label:string, values:{[squad]:number|null} }]

// ════════════════════════════════════════════════
// Public – Einstiegspunkt
// ════════════════════════════════════════════════
export function init() {
  _cfg = { ...CFG_DEF, ...core.load(LS_KEY, {}) };

  const { tileEl, contentEl, headerExtraEl, diagEl } = core.createTile({
    id: VID,
    title: 'Happiness <span class="hl">Faktor</span>',
  });
  _tileEl        = tileEl;
  _contentEl     = contentEl;
  _headerExtraEl = headerExtraEl;
  _diagEl        = diagEl;

  // contentEl als Flex-Spalte (damit das Erklärungs-Panel den Chart nach unten drückt)
  contentEl.style.cssText = 'position:relative;overflow:hidden;display:flex;flex-direction:column';

  _expPanel = createExplanationPanel(contentEl,
    'Monatlicher Verlauf des <b style="color:var(--text)">Happiness-Faktors</b> (Skala 1–5) für den gewählten Squad. ' +
    '<b style="color:var(--green)">Grün</b> = gut (≥4), <b style="color:var(--yellow)">Gelb</b> = mittel, ' +
    '<b style="color:var(--red)">Rot</b> = niedrig (≤2). Grau = kein Wert erhoben.',
  );

  // SVG-Bereich nimmt den verbleibenden Platz (flex:1)
  const svgWrapEl = document.createElement('div');
  svgWrapEl.style.cssText = 'flex:1;min-height:0;overflow:hidden;position:relative';
  contentEl.appendChild(svgWrapEl);
  // contentEl-Referenz für _drawChart auf den SVG-Wrapper umleiten
  _contentEl = svgWrapEl;

  _ttEl = createTooltip();

  // 3-spaltiger Footer (diagEl)
  _diagEl.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:8px;overflow:hidden';
  const diagLeft = document.createElement('a');
  diagLeft.textContent = 'Was zeigt diese Ansicht?';
  diagLeft.style.cssText = 'font-size:11px;color:var(--blue);white-space:nowrap;flex-shrink:0;cursor:pointer;text-decoration:none;user-select:none';
  diagLeft.addEventListener('click', () => {
    const open = _expPanel.toggle(_render);
    diagLeft.style.opacity = open ? '0.7' : '1';
  });
  _diagMid = document.createElement('span');
  _diagMid.style.cssText = 'font-size:11px;color:var(--dim);white-space:nowrap;flex:1;text-align:center;overflow:hidden;text-overflow:ellipsis';
  _diagEl.appendChild(diagLeft);
  _diagEl.appendChild(_diagMid);

  _buildHeaderControls();

  core.on('data',   _onData);
  core.on('filter', _render);
  core.on('theme',  _render);
  core.on('resize', _render);
}

// ════════════════════════════════════════════════
// Header-Controls: N-Badge · Format-Button
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
        <input id="${VID}-r" type="range" min="3" max="12" step="1" value="${_cfg.dotRadius}"
          style="accent-color:var(--blue);width:100%"/>
      </div>
    </div>`;

  const ri = _fmtPanelEl.querySelector(`#${VID}-r`);
  const rd = _fmtPanelEl.querySelector(`#${VID}-rd`);

  ri.addEventListener('input', () => {
    _cfg.dotRadius = Math.max(3, Math.min(12, parseInt(ri.value, 10) || CFG_DEF.dotRadius));
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
  const br = btn.getBoundingClientRect();
  // Positioniere unter dem Button, rechtsbündig
  const panelW = 200;
  let left = br.right - panelW;
  if (left < 4) left = br.left;
  _fmtPanelEl.style.top  = (br.bottom + 4) + 'px';
  _fmtPanelEl.style.left = Math.max(4, left) + 'px';
}

// ════════════════════════════════════════════════
// Daten-Parsing (wird beim 'data'-Event aufgerufen)
// ════════════════════════════════════════════════
function _onData() {
  _rawMonths = [];

  // Normalisiertes Format: [{Squad: "name", "2024-01": N, "2024-02": N, ...}]
  const happRows = ((core.state.sheets || {})[SHEET]) || [];

  if (!happRows.length) {
    _render();
    return;
  }

  // Monatsspalten = alle Keys außer "Squad"
  const monthKeys = Object.keys(happRows[0]).filter(k => k !== 'Squad');
  if (!monthKeys.length) { _render(); return; }

  monthKeys.forEach(key => {
    // "YYYY-MM" → Date (z.B. "2024-01" → 2024-01-01)
    const date = new Date(key + '-01');
    if (isNaN(date.getTime())) return;

    const values = {};
    happRows.forEach(row => {
      const squad = String(row['Squad'] || '').trim();
      if (!squad) return;
      const v = parseFloat(row[key]);
      values[squad] = (isFinite(v) && v >= 1 && v <= 5) ? v : null;
    });
    _rawMonths.push({ date, label: _mlbl(date), values });
  });

  // Älteste nach links (chronologisch)
  _rawMonths.sort((a, b) => a.date - b.date);

  _render();
}

// ════════════════════════════════════════════════
// Render  (data · filter · theme · resize)
// ════════════════════════════════════════════════
function _render() {
  if (!_contentEl) return;
  if (_contentEl.clientWidth < 20) return;
  if (_ttEl) _ttEl.style.display = 'none';

  function _clrBadge() { if (_nBadgeEl) _nBadgeEl.textContent = ''; }

  // ── Noch keine Datei geladen ──
  if (!core.state.rows.length && !_rawMonths.length) {
    _showMsg('Noch keine Datei geladen');
    _clrBadge(); _diagMid.textContent = '–';
    return;
  }

  // ── Sheet fehlt ──
  if (!_rawMonths.length) {
    _showMsg(`Sheet „${SHEET}" nicht in den Daten gefunden`);
    _clrBadge(); _diagMid.textContent = 'Sheet fehlt';
    return;
  }

  // ── Squad-Filter-Validierung ──
  const sf = core.state.squadFilter;

  if (!sf || !sf.length) {
    _showMsg('Kein Squad ausgewählt');
    _clrBadge(); _diagMid.textContent = 'Kein Squad';
    return;
  }
  if (sf.length > 1) {
    _showMsg('Bitte nur 1 Squad wählen');
    _clrBadge(); _diagMid.textContent = `${sf.length} Squads gewählt`;
    return;
  }

  const squadName = sf[0];

  // ── Squad in Happiness-Daten vorhanden? ──
  const happinessSquads = Object.keys(_rawMonths[0].values);
  if (!happinessSquads.includes(squadName)) {
    _showMsg(`Squad „${squadName}" nicht in Happiness-Daten`);
    _clrBadge(); _diagMid.textContent = 'Squad fehlt';
    return;
  }

  // ── Zeitraum-Filter anwenden (Monats-Granularität) ──
  const drMode = core.state.dateRangeMode;
  let months = _rawMonths;
  if (drMode !== 'all' && core.state.dateRangeFrom && core.state.dateRangeTo) {
    const from = core.state.dateRangeFrom;
    const to   = core.state.dateRangeTo;
    months = _rawMonths.filter(m => {
      const monStart = new Date(m.date.getFullYear(), m.date.getMonth(), 1);
      const monEnd   = new Date(m.date.getFullYear(), m.date.getMonth() + 1, 0, 23, 59, 59);
      return monStart <= to && monEnd >= from;
    });
  }

  _drawChart(squadName, months);

  const nvCnt    = months.filter(m => m.values[squadName] == null).length;
  const validCnt = months.length - nvCnt;
  if (_nBadgeEl) _nBadgeEl.textContent = `N = ${validCnt}`;
  _diagMid.textContent = nvCnt ? `${nvCnt} ohne Wert` : '';
}

// ════════════════════════════════════════════════
// SVG-Chart
// ════════════════════════════════════════════════
function _drawChart(squadName, months) {
  const W  = _contentEl.clientWidth  || 400;
  const H  = _contentEl.clientHeight || 180;
  const sc = core.scatterColors();

  // Punkte skalieren relativ zu Containergröße
  const baseR = _cfg.dotRadius;
  const r     = Math.max(2.5, baseR * Math.sqrt(Math.min(W, H) / 200));

  const padL = 30, padR = 14, padT = 12, padB = 36;
  const cW   = W - padL - padR;
  const cH   = H - padT - padB;
  const n    = months.length;

  // Koordinaten-Funktionen
  const xOf = i  => padL + (n > 1 ? i * cW / (n - 1) : cW / 2);
  const yOf = v  => padT + cH - (v / 5) * cH;

  const parts = [
    `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg" style="display:block;overflow:visible">`,
  ];

  // ── Y-Gitternetz (0–5) ──
  for (let y = 0; y <= 5; y++) {
    const yp  = yOf(y).toFixed(1);
    parts.push(
      `<line x1="${padL}" y1="${yp}" x2="${(W - padR).toFixed(1)}" y2="${yp}"
         stroke="${sc.gridLine}" stroke-width="${y === 0 ? 1.5 : 0.5}"
         stroke-dasharray="${y === 0 ? '' : '3,3'}"/>`,
      `<text x="${(padL - 4).toFixed(1)}" y="${(+yp + 3.5).toFixed(1)}"
         text-anchor="end" font-family="var(--mono)" font-size="9"
         fill="${sc.axisLabel}">${y}</text>`,
    );
  }

  // ── Linien-Segmente (nur zwischen aufeinanderfolgenden gültigen Punkten) ──
  const vals = months.map(m => m.values[squadName]);
  for (let i = 0; i < n - 1; i++) {
    if (vals[i] == null || vals[i + 1] == null) continue;
    parts.push(
      `<line
         x1="${xOf(i).toFixed(1)}"     y1="${yOf(vals[i]).toFixed(1)}"
         x2="${xOf(i + 1).toFixed(1)}" y2="${yOf(vals[i + 1]).toFixed(1)}"
         stroke="${sc.gridLine}" stroke-width="1.5"/>`,
    );
  }

  // ── Datenpunkte ──
  months.forEach((m, i) => {
    const v    = vals[i];
    const cx   = xOf(i).toFixed(1);
    const cy   = (v == null ? yOf(0) : yOf(v)).toFixed(1);
    const fill = v == null ? NV_COL : _hCol(v);
    const ri   = (v == null ? r * 0.7 : r).toFixed(1);
    parts.push(
      `<circle data-i="${i}"
         cx="${cx}" cy="${cy}" r="${ri}"
         fill="${fill}"
         stroke="${v == null ? 'none' : sc.dotStroke}"
         stroke-width="${v == null ? 0 : sc.dotStrokeW}"
         style="cursor:default"/>`,
    );
  });

  // ── X-Achsen-Labels (rotiert, max. Dichte begrenzt) ──
  const maxLbls = Math.max(2, Math.floor(cW / 52));
  const step    = n <= maxLbls ? 1 : Math.ceil(n / maxLbls);
  months.forEach((m, i) => {
    if (i % step !== 0 && i !== n - 1) return;
    const x  = xOf(i).toFixed(1);
    const ty = (H - padB + 13).toFixed(1);
    const ry = (H - padB + 4).toFixed(1);
    parts.push(
      `<text x="${x}" y="${ty}" text-anchor="middle"
         font-family="var(--mono)" font-size="9"
         fill="${sc.axisLabel}"
         transform="rotate(-30,${x},${ry})">${m.label}</text>`,
    );
  });

  parts.push('</svg>');
  _contentEl.innerHTML = parts.join('\n');

  // ── Tooltip-Events ──
  _contentEl.querySelectorAll('circle[data-i]').forEach(dot => {
    dot.addEventListener('mouseover', e => {
      const idx = parseInt(dot.dataset.i, 10);
      const m   = months[idx];
      const v   = m.values[squadName];
      const col = v == null ? NV_COL : _hCol(v);
      _ttEl.innerHTML = `
        <div class="tt-title">${m.label}</div>
        <div class="tt-row">
          <span class="tt-lbl">Happiness&nbsp;</span>
          <span class="tt-val" style="color:${col};font-weight:600">
            ${v == null ? 'nv' : v.toFixed(1)}
          </span>
        </div>`;
      _ttEl.style.display = 'block';
      _posTT(e);
    });
    dot.addEventListener('mousemove', e => _posTT(e));
    dot.addEventListener('mouseout',  ()  => { _ttEl.style.display = 'none'; });
  });
}

// ── Tooltip positionieren (boundary-safe, position:fixed) ──
function _posTT(e) {
  const tw = _ttEl.offsetWidth  || 130;
  const th = _ttEl.offsetHeight || 48;
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
  _contentEl.innerHTML =
    `<div class="state-msg sc-nodata"><h3>${text}</h3></div>`;
}

function _saveCfg() {
  core.save(LS_KEY, _cfg);
}
