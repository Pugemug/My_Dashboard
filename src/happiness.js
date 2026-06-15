// ════════════════════════════════════════════════
// happiness.js  –  Happiness Faktor Visual
// Flow Analytics Dashboard
// Visual-ID   : happinessfaktor
// Page        : lieferfahigkeit (tile-canvas)
// localStorage: fhwa_happinessfaktor
// ════════════════════════════════════════════════
import { core } from './core.js';

const VID    = 'happinessfaktor';
const LS_KEY = 'fhwa_happinessfaktor';
const SHEET  = 'Happiness Faktor';
const NV_COL = '#9e9e9e';

function _esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

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
let _rawMonths = []; // [{ date:Date, label:string, values:{[squad]:number|null} }]
let _fmSel, _toSel;

// ════════════════════════════════════════════════
// Public – Einstiegspunkt
// ════════════════════════════════════════════════
export function init() {
  _cfg = { ...CFG_DEF, ...core.load(LS_KEY, {}) };

  const { tileEl, contentEl, headerExtraEl, diagEl } = core.createTile({
    id: VID,
    title: _cfg.title,
  });
  _tileEl        = tileEl;
  _contentEl     = contentEl;
  _headerExtraEl = headerExtraEl;
  _diagEl        = diagEl;

  // Tooltip: position:fixed weil .tile overflow:hidden hat
  _ttEl = document.createElement('div');
  Object.assign(_ttEl.style, {
    position:     'fixed',
    display:      'none',
    pointerEvents:'none',
    zIndex:       '500',
    background:   'var(--bg2)',
    border:       '1px solid var(--border)',
    borderRadius: '7px',
    padding:      '.38rem .58rem',
    fontFamily:   'var(--mono)',
    fontSize:     '.65rem',
    color:        'var(--text)',
    whiteSpace:   'nowrap',
    boxShadow:    '0 2px 8px rgba(0,0,0,.3)',
  });
  document.body.appendChild(_ttEl);

  _buildHeaderControls();

  core.on('data',   _onData);
  core.on('filter', _render);
  core.on('theme',  _render);
  core.on('resize', _render);
}

// ════════════════════════════════════════════════
// Header-Controls: Von/Bis-Selects · Format-Button
// ════════════════════════════════════════════════
function _buildHeaderControls() {
  function sep() {
    const d = document.createElement('div');
    d.style.cssText = 'width:1px;height:14px;background:var(--border);flex-shrink:0;margin:0 .1rem';
    return d;
  }
  function lbl(txt) {
    const s = document.createElement('span');
    s.textContent = txt;
    s.style.cssText = 'font-size:.6rem;color:var(--dimmer);font-family:var(--mono);margin-left:.3rem;flex-shrink:0';
    return s;
  }
  function mkSel() {
    const s = document.createElement('select');
    s.style.cssText = [
      'background:var(--bg3)', 'border:1px solid var(--border)', 'border-radius:4px',
      'color:var(--text)',      'font-family:var(--mono)',         'font-size:.6rem',
      'padding:.1rem .25rem',   'outline:none',                    'cursor:pointer',
      'margin-left:.2rem',      'flex-shrink:0',                   'max-width:80px',
    ].join(';');
    return s;
  }

  _headerExtraEl.appendChild(sep());
  _headerExtraEl.appendChild(lbl('Von'));
  _fmSel = mkSel();
  _fmSel.addEventListener('change', () => { _saveCfg(); _render(); });
  _headerExtraEl.appendChild(_fmSel);

  _headerExtraEl.appendChild(lbl('Bis'));
  _toSel = mkSel();
  _toSel.addEventListener('change', () => { _saveCfg(); _render(); });
  _headerExtraEl.appendChild(_toSel);

  _headerExtraEl.appendChild(sep());

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
  const title = _esc(_cfg.title || CFG_DEF.title);
  _fmtPanelEl.innerHTML = `
    <div style="font-weight:600;font-size:.62rem;color:var(--blue);
                text-transform:uppercase;letter-spacing:.08em;margin-bottom:.55rem">Format</div>
    <div style="display:flex;flex-direction:column;gap:.48rem">
      <div style="display:flex;flex-direction:column;gap:.15rem">
        <span style="font-size:.65rem;color:var(--dim)">Titel</span>
        <input id="${VID}-t" type="text" value="${title}"
          style="background:var(--bg3);border:1px solid var(--border);border-radius:5px;
                 color:var(--text);font-family:var(--mono);font-size:.65rem;
                 padding:.2rem .42rem;outline:none;width:100%;box-sizing:border-box"/>
      </div>
      <div style="display:flex;flex-direction:column;gap:.15rem">
        <span style="font-size:.65rem;color:var(--dim)">
          Punkt-Radius&thinsp;
          <b id="${VID}-rd">${_cfg.dotRadius}</b>&thinsp;px
        </span>
        <input id="${VID}-r" type="range" min="3" max="12" step="1" value="${_cfg.dotRadius}"
          style="accent-color:var(--blue);width:100%"/>
      </div>
    </div>`;

  const ti = _fmtPanelEl.querySelector(`#${VID}-t`);
  const ri = _fmtPanelEl.querySelector(`#${VID}-r`);
  const rd = _fmtPanelEl.querySelector(`#${VID}-rd`);

  ti.addEventListener('input', () => {
    _cfg.title = ti.value.trim() || CFG_DEF.title;
    const tel = _tileEl.querySelector('.tile-title');
    if (tel) tel.textContent = _cfg.title;
    _saveCfg();
  });
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

  const raw = (core.state.sheetsRaw || {})[SHEET];

  if (!raw || !raw.length) {
    _render();
    return;
  }

  // Header-Zeile finden: erste Zeile mit dem Wert 'Datum'
  const hIdx = raw.findIndex(row => Array.isArray(row) && row.some(c => c === 'Datum'));
  if (hIdx < 0) { _render(); return; }

  const hRow   = raw[hIdx];
  const dateCI = hRow.findIndex(c => c === 'Datum');
  // Spalte dateCI+1 = 'ausgewähltes Squad' (Formel-Spalte) → überspringen
  // Squad-Spalten starten ab dateCI+2

  const squadCols = []; // [{idx, name}]
  for (let ci = dateCI + 2; ci < hRow.length; ci++) {
    const v = hRow[ci];
    if (typeof v === 'string' && v.trim()) {
      squadCols.push({ idx: ci, name: v.trim() });
    }
  }

  // Datenzeilen parsen
  raw.slice(hIdx + 1).forEach(row => {
    if (!Array.isArray(row)) return;
    const rawD = row[dateCI];
    if (rawD == null) return;
    const date = rawD instanceof Date ? rawD : core.toDate(rawD);
    if (!date || isNaN(date.getTime())) return;

    const values = {};
    squadCols.forEach(({ idx, name }) => {
      const v = row[idx];
      values[name] = (typeof v === 'number' && isFinite(v) && v >= 1 && v <= 5) ? v : null;
    });
    _rawMonths.push({ date, label: _mlbl(date), values });
  });

  // Älteste nach links (chronologisch)
  _rawMonths.sort((a, b) => a.date - b.date);

  _populateDateSelects();
  _render();
}

function _populateDateSelects() {
  if (!_fmSel || !_toSel || !_rawMonths.length) return;

  const savedFrom = core.load(LS_KEY + '_from', null);
  const savedTo   = core.load(LS_KEY + '_to',   null);
  const last       = _rawMonths.length - 1;

  const opts = _rawMonths.map((m, i) => `<option value="${i}">${m.label}</option>`).join('');
  _fmSel.innerHTML = opts;
  _toSel.innerHTML = opts;

  // Gespeicherten Monat per Label-String wiederherstellen
  if (savedFrom) {
    const fi = _rawMonths.findIndex(m => m.label === savedFrom);
    _fmSel.value = String(fi >= 0 ? fi : 0);
  } else {
    _fmSel.value = '0';
  }
  if (savedTo) {
    const ti = _rawMonths.findIndex(m => m.label === savedTo);
    _toSel.value = String(ti >= 0 ? ti : last);
  } else {
    _toSel.value = String(last);
  }
}

// ════════════════════════════════════════════════
// Render  (data · filter · theme · resize)
// ════════════════════════════════════════════════
function _render() {
  if (!_contentEl) return;
  if (_ttEl) _ttEl.style.display = 'none';

  // ── Noch keine Datei geladen ──
  if (!core.state.rows.length && !_rawMonths.length) {
    _showMsg('Noch keine Datei geladen');
    _diagEl.textContent = '–';
    return;
  }

  // ── Sheet fehlt ──
  if (!_rawMonths.length) {
    _showMsg(`Sheet „${SHEET}" nicht in der Excel gefunden`);
    _diagEl.textContent = 'Sheet fehlt';
    return;
  }

  // ── Squad-Filter-Validierung ──
  const sf = core.state.squadFilter;

  if (!sf || !sf.length) {
    _showMsg('Kein Squad ausgewählt');
    _diagEl.textContent = 'Kein Squad';
    return;
  }
  if (sf.length > 1) {
    _showMsg('Bitte nur 1 Squad wählen');
    _diagEl.textContent = `${sf.length} Squads gewählt`;
    return;
  }

  const squadName = sf[0];

  // ── Squad in Happiness-Daten vorhanden? ──
  const happinessSquads = Object.keys(_rawMonths[0].values);
  if (!happinessSquads.includes(squadName)) {
    _showMsg(`Squad „${squadName}" nicht in Happiness-Daten`);
    _diagEl.textContent = 'Squad fehlt';
    return;
  }

  // ── Zeitraum-Filter ──
  const fIdx   = Math.min(parseInt(_fmSel?.value ?? '0',  10) || 0, _rawMonths.length - 1);
  const tIdx   = Math.min(parseInt(_toSel?.value  ?? String(_rawMonths.length - 1), 10), _rawMonths.length - 1);
  const fi     = Math.min(fIdx, tIdx);
  const ti     = Math.max(fIdx, tIdx);
  const months = _rawMonths.slice(fi, ti + 1);

  if (!months.length) {
    _showMsg('Keine Monate im gewählten Zeitraum');
    _diagEl.textContent = '0 Monate';
    return;
  }

  _drawChart(squadName, months);

  const nvCnt    = months.filter(m => m.values[squadName] == null).length;
  const validCnt = months.length - nvCnt;
  _diagEl.textContent =
    `Squad: ${squadName} · ${months.length} Monate · ${validCnt} Werte · ${nvCnt} nv`;
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
    const dim = sc.axisLabelFaint;
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
  // Zeitraum per Label-String (stabil über Datei-Reloads hinaus)
  if (_fmSel && _rawMonths.length) {
    const fi = Math.min(parseInt(_fmSel.value, 10) || 0, _rawMonths.length - 1);
    const ti = Math.min(parseInt(_toSel.value,  10) || 0, _rawMonths.length - 1);
    core.save(LS_KEY + '_from', _rawMonths[fi]?.label ?? null);
    core.save(LS_KEY + '_to',   _rawMonths[ti]?.label ?? null);
  }
}
