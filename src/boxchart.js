// ════════════════════════════════════════════════
// boxchart.js – LeadTime BoxChart
// Flow Analytics Dashboard v2.0
// Spec: LeadTime_BoxChart.md v1.0 (Gate 1 bestätigt)
// ════════════════════════════════════════════════

import { core } from './core.js';

const LS_KEY     = 'fhwa_boxchart';
const KDE_POINTS = 80;

const DEFAULT_CFG = {
  chartMode:    'box',               // 'box' | 'violin' | 'combo'
  periodMode:   'month',             // 'month' | 'quarter'
  showOutliers: true,
  bandwidth:    4,                   // Violin KDE-Glättung (1–20)
  ltStart:      'Ready4Progress_first',
  ltEnd:        'Resolved',
};

// ── Modul-State ──
let cfg = {};
let _contentEl, _diagEl, _headerExtraEl;
let _tooltip     = null;
let _ttTimer     = null;
let _cfgOpen     = false;
let _listenersOk = false;   // Guard: select-Listener nur einmal attachieren

// ════════════════════════════════════════════════
// Public: init (einziger Export)
// ════════════════════════════════════════════════
export function init() {
  cfg = { ...DEFAULT_CFG, ...core.load(LS_KEY, {}) };

  const { contentEl, headerExtraEl, diagEl } = core.createCard({
    id:          'boxchart',
    title:       'Lead<span class="hl">Time</span>',
    defaultGrid: { col: 6, row: 0, w: 6, h: 10 },
  });

  _contentEl     = contentEl;
  _diagEl        = diagEl;
  _headerExtraEl = headerExtraEl;

  _buildHeader();
  _createTooltip();

  core.on('data',     _onData);
  core.on('filter',   _render);
  core.on('theme',    _render);
  core.on('resize',   _render);
  core.on('settings', _render);
}

// ════════════════════════════════════════════════
// Header – Buttons + Config-Panel
// ════════════════════════════════════════════════
function _buildHeader() {
  // Mode-Toggle: Box | Violin | Kombi
  const modeGrp = document.createElement('div');
  modeGrp.className = 'tgl-grp';
  modeGrp.id = 'bc-mode-grp';

  [['box', 'Box'], ['violin', 'Violin'], ['combo', 'Kombi']].forEach(([m, lbl]) => {
    const btn = document.createElement('button');
    btn.className    = 'tgl' + (cfg.chartMode === m ? ' ta-b' : '');
    btn.dataset.mode = m;
    btn.textContent  = lbl;
    btn.addEventListener('click', () => {
      cfg.chartMode = m;
      _saveAndRender();
      _refreshModeButtons();
    });
    modeGrp.appendChild(btn);
  });

  // Ausreißer-Toggle
  const outBtn = document.createElement('button');
  outBtn.className = 'btn-icon' + (cfg.showOutliers ? ' p-blue' : '');
  outBtn.id        = 'bc-out-btn';
  outBtn.title     = 'Ausreißer ein/ausblenden';
  outBtn.textContent = cfg.showOutliers ? 'Ausr. ●' : 'Ausr. ○';
  outBtn.addEventListener('click', () => {
    cfg.showOutliers = !cfg.showOutliers;
    outBtn.className   = 'btn-icon' + (cfg.showOutliers ? ' p-blue' : '');
    outBtn.textContent = cfg.showOutliers ? 'Ausr. ●' : 'Ausr. ○';
    _saveAndRender();
  });

  // Config-Button
  const cfgBtn = document.createElement('button');
  cfgBtn.className   = 'btn-icon';
  cfgBtn.id          = 'bc-cfg-btn';
  cfgBtn.title       = 'Konfiguration';
  cfgBtn.textContent = '⚙';
  cfgBtn.addEventListener('click', e => {
    e.stopPropagation();
    _cfgOpen = !_cfgOpen;
    cfgBtn.classList.toggle('p-blue', _cfgOpen);
    const panel = document.getElementById('bc-cfg-panel');
    if (panel) panel.classList.toggle('open', _cfgOpen);
  });

  _headerExtraEl.appendChild(modeGrp);
  _headerExtraEl.appendChild(outBtn);
  _headerExtraEl.appendChild(cfgBtn);

  // ── Config-Panel (unterhalb Card-Header, oberhalb card-content) ──
  const panel = document.createElement('div');
  panel.id        = 'bc-cfg-panel';
  panel.className = 'sub-panel';   // display:none; .open → display:block

  panel.innerHTML = `
    <div class="lt-row">
      <div class="lt-field">
        <span class="lt-label">ltStart</span>
        <select class="lt-select" id="bc-ltstart"></select>
      </div>
      <div class="lt-field">
        <span class="lt-label">ltEnd</span>
        <select class="lt-select" id="bc-ltend"></select>
      </div>
      <div class="lt-field">
        <span class="lt-label">Periode</span>
        <select class="lt-select" id="bc-period">
          <option value="month">Monat</option>
          <option value="quarter">Quartal</option>
        </select>
      </div>
      <div class="lt-field">
        <span class="lt-label">Bandwidth</span>
        <input type="range" id="bc-bw" min="1" max="20" step="0.5"
               style="width:72px;accent-color:var(--blue);vertical-align:middle">
        <span class="lt-hint" id="bc-bw-val" style="min-width:22px;display:inline-block">${cfg.bandwidth}</span>
      </div>
    </div>`;

  // Panel vor card-content einhängen
  const cardEl    = document.getElementById('card-boxchart');
  const contentEl = cardEl.querySelector('.card-content');
  cardEl.insertBefore(panel, contentEl);

  // Periode
  document.getElementById('bc-period').value = cfg.periodMode;
  document.getElementById('bc-period').addEventListener('change', e => {
    cfg.periodMode = e.target.value;
    _saveAndRender();
  });

  // Bandwidth
  const bwInput = document.getElementById('bc-bw');
  bwInput.value = cfg.bandwidth;
  bwInput.addEventListener('input', () => {
    cfg.bandwidth = parseFloat(bwInput.value);
    document.getElementById('bc-bw-val').textContent = cfg.bandwidth;
    _saveAndRender();
  });

  // ltStart / ltEnd – Listener hier einmalig attachieren
  // Optionen werden erst in _populateColSelects() befüllt
  document.getElementById('bc-ltstart').addEventListener('change', e => {
    cfg.ltStart = e.target.value;
    _saveAndRender();
  });
  document.getElementById('bc-ltend').addEventListener('change', e => {
    cfg.ltEnd = e.target.value;
    _saveAndRender();
  });
}

function _refreshModeButtons() {
  document.querySelectorAll('#bc-mode-grp .tgl').forEach(btn => {
    btn.className = 'tgl' + (btn.dataset.mode === cfg.chartMode ? ' ta-b' : '');
  });
}

// ── Spalten-Selects befüllen (nach Datenload) ──
function _populateColSelects() {
  const cols = core.state.dateCols;
  [['bc-ltstart', cfg.ltStart], ['bc-ltend', cfg.ltEnd]].forEach(([id, cur]) => {
    const sel = document.getElementById(id);
    if (!sel) return;
    sel.innerHTML = cols.map(c =>
      `<option value="${c}"${c === cur ? ' selected' : ''}>${c}</option>`
    ).join('');
  });
}

// ════════════════════════════════════════════════
// Event-Handler
// ════════════════════════════════════════════════
function _onData() {
  _populateColSelects();
  _render();
}

// ════════════════════════════════════════════════
// Tooltip
// ════════════════════════════════════════════════
function _createTooltip() {
  if (_tooltip) return;
  _tooltip = document.createElement('div');
  _tooltip.style.cssText = [
    'position:fixed', 'display:none', 'z-index:9999',
    'background:var(--bg2)', 'border:1px solid var(--border)',
    'border-radius:7px', 'padding:.45rem .6rem',
    'font-family:var(--mono)', 'font-size:.68rem',
    'color:var(--text)', 'pointer-events:none',
    'min-width:140px', 'max-width:230px',
    'box-shadow:0 8px 24px rgba(0,0,0,.45)',
    'line-height:1.55',
  ].join(';');
  _tooltip.addEventListener('mouseenter', () => clearTimeout(_ttTimer));
  _tooltip.addEventListener('mouseleave', () => {
    _ttTimer = setTimeout(() => { _tooltip.style.display = 'none'; }, 130);
  });
  document.body.appendChild(_tooltip);
}

function _posTt(cx, cy) {
  _tooltip.style.display = 'block';
  const tw = _tooltip.offsetWidth  || 200;
  const th = _tooltip.offsetHeight || 80;
  const vw = window.innerWidth, vh = window.innerHeight;
  let l = cx + 14, t = cy - th / 2;
  if (l + tw > vw - 8) l = cx - tw - 14;
  if (t < 8)           t = 8;
  if (t + th > vh - 8) t = vh - th - 8;
  _tooltip.style.left = l + 'px';
  _tooltip.style.top  = t + 'px';
}

// ════════════════════════════════════════════════
// Statistik-Helpers
// ════════════════════════════════════════════════
function _calcStats(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const p25    = core.pct(sorted, 25);
  const med    = core.pct(sorted, 50);
  const p85    = core.pct(sorted, 85);
  const iqr    = p85 - p25;
  const fence  = 1.5 * iqr;
  const allMax = sorted[sorted.length - 1];
  const allMin = sorted[0];
  const wUp    = Math.min(allMax, p85 + fence);
  const wDn    = Math.max(allMin, p25 - fence);
  return { sorted, p25, med, p85, wUp, wDn, n: values.length };
}

// ── Gaussian KDE (getrimmt auf echten Min/Max, cut=0) ──
function _kde(sorted, bw, nPts) {
  if (sorted.length < 2) return [];
  const mn = sorted[0], mx = sorted[sorted.length - 1];
  if (mn === mx) return [{ x: mn, y: 1 }];
  const step   = (mx - mn) / (nPts - 1);
  const norm   = sorted.length * bw * Math.sqrt(2 * Math.PI);
  const result = [];
  for (let i = 0; i < nPts; i++) {
    const x = mn + i * step;
    let s = 0;
    for (const v of sorted) {
      const u = (x - v) / bw;
      s += Math.exp(-0.5 * u * u);
    }
    result.push({ x, y: s / norm });
  }
  return result;
}

// ── Schöne Y-Achsen-Ticks ──
function _niceYTicks(lo, hi, n) {
  const range = hi - lo || 1;
  const raw   = range / (n - 1);
  const mag   = Math.pow(10, Math.floor(Math.log10(raw)));
  const step  = [1, 2, 5, 10].map(f => f * mag).find(f => f >= raw) || mag;
  const ticks = [];
  let t = Math.ceil(lo / step) * step;
  while (t <= hi + step * 0.01) {
    ticks.push(Math.round(t * 100) / 100);
    t += step;
  }
  return ticks;
}

// ── Perioden-Hilfsfunktionen ──
const DE_MONTHS = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];

function _periodKey(d, mode) {
  if (!d) return null;
  const y = d.getFullYear(), m = d.getMonth();
  return mode === 'quarter'
    ? `${y}-Q${Math.floor(m / 3) + 1}`
    : `${y}-${String(m + 1).padStart(2, '0')}`;
}

function _periodLabel(key, mode) {
  if (mode === 'quarter') {
    const [yr, q] = key.split('-');
    return `${q} ${String(yr).slice(2)}`;
  }
  const [yr, mo] = key.split('-');
  return `${DE_MONTHS[parseInt(mo, 10) - 1]} ${String(yr).slice(2)}`;
}

// Rolling-Sort: aktueller Monat/Quartal ganz links, dann rollierend rückwärts
function _rollingSort(keys, mode) {
  const now = new Date();
  const curKey = mode === 'quarter'
    ? `${now.getFullYear()}-Q${Math.floor(now.getMonth() / 3) + 1}`
    : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  return [...keys].sort((a, b) => {
    // Aktueller Monat/Quartal zuerst (Index 0 = ganz links)
    if (a === curKey) return -1;
    if (b === curKey) return  1;
    // Zukünftige Perioden nach ganz rechts
    const aFuture = a > curKey, bFuture = b > curKey;
    if (aFuture && !bFuture) return  1;
    if (!aFuture && bFuture) return -1;
    // Vergangene: neueste zuerst (rollierend vorwärts)
    return b.localeCompare(a);
  });
}

// ════════════════════════════════════════════════
// Speichern & Rendern
// ════════════════════════════════════════════════
function _saveAndRender() {
  core.save(LS_KEY, cfg);
  _render();
}

// ════════════════════════════════════════════════
// Haupt-Render
// ════════════════════════════════════════════════
function _render() {
  const rows = core.filteredRows();
  const ltS  = cfg.ltStart;
  const ltE  = cfg.ltEnd;

  // ── Leerzustand ──
  if (!rows.length) {
    _diagEl.textContent = 'Keine Daten geladen.';
    _contentEl.innerHTML = '';
    return;
  }
  if (!(ltS in rows[0]) || !(ltE in rows[0])) {
    _diagEl.textContent = `Spalten „${ltS}" oder „${ltE}" nicht gefunden.`;
    _contentEl.innerHTML = '';
    return;
  }

  // ── Daten gruppieren ──
  // periodItems: key → [{ jiraId, lt }]
  const periodItems = new Map();
  let   countAll    = 0;

  for (const row of rows) {
    const lt = core.dur(row[ltS], row[ltE]);
    if (!lt || lt < 1) continue;
    const endDate = core.toDate(row[ltE]);
    if (!endDate) continue;
    const key = _periodKey(endDate, cfg.periodMode);
    if (!key) continue;
    countAll++;
    if (!periodItems.has(key)) periodItems.set(key, []);
    periodItems.get(key).push({ jiraId: String(row['Jira-ID'] || ''), lt });
  }

  if (!periodItems.size) {
    _diagEl.textContent = 'Keine gültigen Lead-Time-Werte (ltStart → ltEnd).';
    _contentEl.innerHTML = '';
    return;
  }

  // ── Perioden sortieren & Statistiken berechnen ──
  const keys     = _rollingSort([...periodItems.keys()], cfg.periodMode);
  const statsMap = new Map();
  keys.forEach(k => statsMap.set(k, _calcStats(periodItems.get(k).map(it => it.lt))));

  // ── Diag-Bar ──
  const modeLabel = cfg.chartMode === 'box' ? 'Box'
                  : cfg.chartMode === 'violin' ? 'Violin' : 'Kombi';
  const perLabel  = cfg.periodMode === 'month' ? 'Monat' : 'Quartal';
  _diagEl.textContent = `n=${countAll} · ${ltS} → ${ltE} · ${modeLabel} · ${perLabel}`;

  // ── SVG-Dimensionen ──
  const W = _contentEl.clientWidth  || 600;
  const H = _contentEl.clientHeight || 360;
  if (W < 60 || H < 60) return;

  const C = core.scatterColors();
  const isLt = core.isLight();

  const PAD_L = 50, PAD_R = 14, PAD_T = 16, PAD_B = 52;
  const pW = W - PAD_L - PAD_R;
  const pH = H - PAD_T - PAD_B;
  if (pW < 40 || pH < 40) return;

  // ── Y-Skala: globales Maximum (inkl. Ausreißer) ──
  let yMax = 1;
  keys.forEach(k => {
    const st = statsMap.get(k);
    if (!st) return;
    yMax = Math.max(yMax, st.wUp);
    if (cfg.showOutliers) {
      periodItems.get(k).forEach(it => { yMax = Math.max(yMax, it.lt); });
    }
  });
  yMax = Math.ceil(yMax * 1.12) || 10;

  const yTicks = _niceYTicks(0, yMax, 6);
  const yS     = v => PAD_T + pH - (Math.max(0, v) / yMax) * pH;

  // ── X-Skala ──
  const nP   = keys.length;
  const colW = pW / nP;
  const bHW  = Math.max(6, Math.min(28, colW * 0.30));   // Box half-width
  const vHW  = Math.max(8,  Math.min(36, colW * 0.40));  // Violin half-width
  const outR = Math.max(3,  Math.min(6,  colW / 14));    // Ausreißer-Radius
  const xC   = i => PAD_L + (i + 0.5) * colW;

  // ── Theme-Farben ──
  const amberC  = isLt ? '#d97706' : '#fbbf24';
  const boxFill = isLt ? 'rgba(2,132,199,0.15)' : 'rgba(56,189,248,0.15)';
  const boxStr  = isLt ? '#0284c7' : '#38bdf8';
  const medC    = isLt ? '#0284c7' : '#38bdf8';
  const whiskC  = C.axisLabel;
  const outlFill = isLt ? '#94a3b8' : '#4d6a88';
  const outlStr  = isLt ? '#0284c7' : '#38bdf8';
  const violinF  = isLt ? 'rgba(2,132,199,0.10)' : 'rgba(56,189,248,0.10)';
  const violinS  = isLt ? 'rgba(2,132,199,0.45)' : 'rgba(56,189,248,0.45)';

  const parts = [];
  parts.push(`<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">`);

  // ── Y-Achse: Grid + Labels ──
  for (const y of yTicks) {
    const sy = yS(y);
    parts.push(`<line x1="${PAD_L}" y1="${sy.toFixed(1)}" x2="${(PAD_L + pW).toFixed(1)}" y2="${sy.toFixed(1)}" stroke="${C.gridLine}" stroke-width="1"/>`);
    parts.push(`<text x="${(PAD_L - 5).toFixed(1)}" y="${(sy + 4).toFixed(1)}" text-anchor="end" font-family="var(--mono)" font-size="10" fill="${C.axisLabel}">${y}</text>`);
  }

  // ── Achsenlinien ──
  parts.push(`<line x1="${PAD_L}" y1="${PAD_T}" x2="${PAD_L}" y2="${(PAD_T + pH).toFixed(1)}" stroke="${C.axisLine}" stroke-width="1"/>`);
  parts.push(`<line x1="${PAD_L}" y1="${(PAD_T + pH).toFixed(1)}" x2="${(PAD_L + pW).toFixed(1)}" y2="${(PAD_T + pH).toFixed(1)}" stroke="${C.axisLine}" stroke-width="1"/>`);

  // ── Pro Periode ──
  keys.forEach((key, i) => {
    const st  = statsMap.get(key);
    const cx  = xC(i);
    const lbl = _periodLabel(key, cfg.periodMode);
    const n   = st ? st.n : 0;

    // X-Achse: Label + n
    parts.push(`<text x="${cx.toFixed(1)}" y="${(PAD_T + pH + 16).toFixed(1)}" text-anchor="middle" font-family="var(--mono)" font-size="10" fill="${C.axisLabel}">${lbl}</text>`);
    parts.push(`<text x="${cx.toFixed(1)}" y="${(PAD_T + pH + 29).toFixed(1)}" text-anchor="middle" font-family="var(--mono)" font-size="9" fill="${C.nText}">n=${n}</text>`);

    if (!st || n === 0) return;

    const syP25 = yS(st.p25);
    const syMed = yS(st.med);
    const syP85 = yS(st.p85);
    const syWUp = yS(st.wUp);
    const syWDn = yS(st.wDn);

    // ── Violin ──────────────────────────────────────
    if (cfg.chartMode === 'violin' || cfg.chartMode === 'combo') {
      const kde = _kde(st.sorted, cfg.bandwidth, KDE_POINTS);
      if (kde.length >= 2) {
        const maxD = Math.max(...kde.map(p => p.y));
        if (maxD > 0) {
          const pts = kde.map(p => ({
            xR: cx + (p.y / maxD) * vHW,
            xL: cx - (p.y / maxD) * vHW,
            sy: yS(p.x),
          }));
          let d = `M${pts[0].xR.toFixed(1)},${pts[0].sy.toFixed(1)}`;
          for (let j = 1; j < pts.length; j++) {
            d += ` L${pts[j].xR.toFixed(1)},${pts[j].sy.toFixed(1)}`;
          }
          for (let j = pts.length - 1; j >= 0; j--) {
            d += ` L${pts[j].xL.toFixed(1)},${pts[j].sy.toFixed(1)}`;
          }
          d += ' Z';
          parts.push(`<path d="${d}" fill="${violinF}" stroke="${violinS}" stroke-width="1.2"/>`);
        }
      }
    }

    // ── Box + Whisker ────────────────────────────────
    if (cfg.chartMode === 'box' || cfg.chartMode === 'combo') {
      const hw     = cfg.chartMode === 'combo' ? bHW * 0.62 : bHW;
      const capHW  = hw * 0.40;
      const boxTop = Math.min(syP25, syP85);   // SVG: kleine y = oben
      const boxHt  = Math.abs(syP85 - syP25);

      // Box-Körper (P25 – P85)
      parts.push(`<rect x="${(cx - hw).toFixed(1)}" y="${boxTop.toFixed(1)}" width="${(hw * 2).toFixed(1)}" height="${boxHt.toFixed(1)}" fill="${boxFill}" stroke="${boxStr}" stroke-width="1.4" rx="2"/>`);
      // Median-Linie
      parts.push(`<line x1="${(cx - hw).toFixed(1)}" y1="${syMed.toFixed(1)}" x2="${(cx + hw).toFixed(1)}" y2="${syMed.toFixed(1)}" stroke="${medC}" stroke-width="2.2"/>`);
      // P85-Linie (amber, gestrichelt) – oben an Box
      parts.push(`<line x1="${(cx - hw).toFixed(1)}" y1="${syP85.toFixed(1)}" x2="${(cx + hw).toFixed(1)}" y2="${syP85.toFixed(1)}" stroke="${amberC}" stroke-width="1.5" stroke-dasharray="3,2"/>`);

      // Whisker oben (P85 → wUp)
      const wyUpBot = Math.max(syP85, syWUp); // SVG: max y = weiter unten
      const wyUpTop = Math.min(syP85, syWUp);
      parts.push(`<line x1="${cx.toFixed(1)}" y1="${wyUpTop.toFixed(1)}" x2="${cx.toFixed(1)}" y2="${wyUpBot.toFixed(1)}" stroke="${whiskC}" stroke-width="1.2"/>`);
      parts.push(`<line x1="${(cx - capHW).toFixed(1)}" y1="${syWUp.toFixed(1)}" x2="${(cx + capHW).toFixed(1)}" y2="${syWUp.toFixed(1)}" stroke="${whiskC}" stroke-width="1.2"/>`);

      // Whisker unten (P25 → wDn)
      const wyDnTop = Math.min(syP25, syWDn);
      const wyDnBot = Math.max(syP25, syWDn);
      parts.push(`<line x1="${cx.toFixed(1)}" y1="${wyDnTop.toFixed(1)}" x2="${cx.toFixed(1)}" y2="${wyDnBot.toFixed(1)}" stroke="${whiskC}" stroke-width="1.2"/>`);
      parts.push(`<line x1="${(cx - capHW).toFixed(1)}" y1="${syWDn.toFixed(1)}" x2="${(cx + capHW).toFixed(1)}" y2="${syWDn.toFixed(1)}" stroke="${whiskC}" stroke-width="1.2"/>`);
    }

    // ── Ausreißer ────────────────────────────────────
    if (cfg.showOutliers) {
      const items = periodItems.get(key);
      items.forEach((item, idx) => {
        if (item.lt <= st.wUp && item.lt >= st.wDn) return;
        const sy    = yS(item.lt);
        // deterministischer Jitter (kein Math.random → stabile Darstellung)
        const hash  = (idx * 7919 + key.charCodeAt(0)) % 100;
        const jitter = ((hash - 50) / 50) * Math.min(bHW * 0.55, colW * 0.25);
        const ox    = (cx + jitter).toFixed(1);
        const esc   = (item.jiraId).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
        parts.push(
          `<circle class="bc-out" cx="${ox}" cy="${sy.toFixed(1)}" r="${outR}" ` +
          `fill="${outlFill}" stroke="${outlStr}" stroke-width="1.2" ` +
          `data-jira="${esc}" data-lt="${item.lt.toFixed(2)}" ` +
          `style="cursor:pointer;opacity:0.9"/>`
        );
      });
    }
  });

  parts.push('</svg>');
  _contentEl.innerHTML = parts.join('');

  // ── Event-Delegation für Ausreißer-Tooltips (§4.9 / §9.3) ──
  const svg = _contentEl.querySelector('svg');
  if (svg && cfg.showOutliers) {
    svg.addEventListener('mouseover', e => {
      const el = e.target.closest && e.target.closest('.bc-out');
      if (!el) return;
      clearTimeout(_ttTimer);
      const jiraId = el.dataset.jira || '';
      const ltVal  = parseFloat(el.dataset.lt);
      const url    = core.state.urlTemplate
        ? core.state.urlTemplate.replace('{issueKey}', jiraId)
        : '';
      let html = `<div class="tt-title">${jiraId || '—'}</div>`;
      html += `<div class="tt-row"><span class="tt-lbl">Lead Time</span><span class="tt-val">${core.fmt(ltVal)}</span></div>`;
      if (url) {
        const urlEsc = url.replace(/'/g, "\\'");
        html += `<a class="tt-link" href="#" onclick="window.open('${urlEsc}','_blank');return false;">🔗 In Jira öffnen</a>`;
      }
      _tooltip.innerHTML       = html;
      _tooltip.style.pointerEvents = url ? 'all' : 'none';
      _posTt(e.clientX, e.clientY);
    });

    svg.addEventListener('mouseout', e => {
      if (e.target.closest && e.target.closest('.bc-out')) {
        _ttTimer = setTimeout(() => { _tooltip.style.display = 'none'; }, 120);
      }
    });
  }
}
