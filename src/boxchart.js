// ════════════════════════════════════════════════
// boxchart.js – LeadTime BoxChart (Kachel-Format)
// Flow Analytics Dashboard v2.5
// Spec: LeadTime_BoxChart.md v1.8
// Änderungen v2.4:
//   - Bug: Panel konnte nicht geschlossen werden → Panel in contentEl (chart area)
//   - Panel: × Schließen-Button + Klick-außen schließt Panel
//   - Y-Achse: Schrittweite konfigurierbar + Log-Skala wählbar (im ⚙-Panel)
// ════════════════════════════════════════════════
import { calcBoxStats } from './calc/boxchart.calc.js';

import { core, LT_START_DEFAULT, LT_END_DEFAULT, CT_START_DEFAULT, detectLtMode, ltModeTitle } from './core.js';

const LS_KEY     = 'fhwa_boxchart';
const KDE_POINTS = 80;
const BW_ON      = 4;    // Violin-Glättung: An
const BW_OFF     = 1.2;  // Violin-Glättung: Aus (minimal, zeigt Rohdaten-Form)

const DEFAULT_CFG = {
  chartMode:    'box',
  periodMode:   'month',
  showOutliers: true,
  smoothing:    true,
  ltStart:      LT_START_DEFAULT,
  ltEnd:        LT_END_DEFAULT,
  yStep:        0,
  yLog:         false,
  includeBug:   false,
  months:       0,
};

let _initialized = false;

// ════════════════════════════════════════════════
// Public: init
// ════════════════════════════════════════════════
export function init() {
  if (_initialized) return;
  _initialized = true;

  // ── Config laden ─────────────────────────────────────────────────────────
  const saved = core.load(LS_KEY, {});
  if ('bandwidth' in saved && !('smoothing' in saved)) {
    saved.smoothing = saved.bandwidth > 2;
    delete saved.bandwidth;
  }
  if (!('yStep'      in saved)) saved.yStep      = 0;
  if (!('yLog'       in saved)) saved.yLog        = false;
  if (!('includeBug' in saved)) saved.includeBug  = false;
  const cfg = { ...DEFAULT_CFG, ...saved };

  // ── Tile anlegen ──────────────────────────────────────────────────────────
  const { tileEl, contentEl, headerExtraEl, diagEl } = core.createTile({
    id:    'boxchart',
    title: 'Lead<span class="hl">Time</span>',
  });
  const _contentEl     = contentEl;
  const _diagEl        = diagEl;
  const _headerExtraEl = headerExtraEl;
  const _titleEl       = tileEl.querySelector('.tile-title');

  // ── Mutabler State ────────────────────────────────────────────────────────
  let _tooltip = null;
  let _ttTimer = null;
  let _cfgOpen = false;
  let _explanationOpen = false;
  let _explanationEl = null;

  // ── Modus-Helpers ──────────────────────────────────────────────────────────
  function _detectMode()   { return detectLtMode(cfg.ltStart, cfg.ltEnd); }
  function _getModeTitle() { return ltModeTitle(cfg.ltStart, cfg.ltEnd); }

  function _getModeExplanation() {
    const m = _detectMode();
    if (m === 'lt') return '<div style="padding:8px 14px">Zeigt, wie lange ein Ticket vom Moment der Bereitschaft zur Bearbeitung (Ready4Progress) bis zur Fertigstellung (Resolved) braucht. Dieser Wert entspricht der Wartezeit aus Kundensicht – inklusive Liegezeiten im Prozess. Ziel: P85 dauerhaft unter dem vereinbarten SLA halten.</div>';
    if (m === 'ct') return '<div style="padding:8px 14px">Zeigt, wie lange ein Ticket ab dem ersten aktiven Bearbeitungsmoment (In Progress) bis zur Fertigstellung (Resolved) braucht. Dieser Wert spiegelt die reine Teamleistung wider, ohne vorgelagerte Wartezeiten in der Queue.</div>';
    return '<div style="padding:8px 14px">Die Durchlaufzeit wird mit benutzerdefinierten Start- und Endspalten berechnet (⚙). Wähle „Ready4Progress_first → Resolved" für Lead Time oder „In Progress_first → Resolved" für Cycle Time.</div>';
  }

  function _updateModeUI() {
    const mode = _detectMode();
    if (_titleEl) _titleEl.innerHTML = _getModeTitle();
    if (_explanationEl) _explanationEl.innerHTML = _getModeExplanation();
    const ltBtn = document.getElementById('bc-mode-lt');
    const ctBtn = document.getElementById('bc-mode-ct');
    if (ltBtn) ltBtn.classList.toggle('p-blue', mode === 'lt');
    if (ctBtn) ctBtn.classList.toggle('p-blue', mode === 'ct');
  }

  // ── Panel öffnen / schließen ──────────────────────────────────────────────
  function _togglePanel() {
    _cfgOpen ? _closePanel() : _openPanel();
  }

  function _openPanel() {
    _cfgOpen = true;
    const btn   = document.getElementById('bc-cfg-btn');
    const panel = document.getElementById('bc-cfg-panel');
    if (btn)   btn.classList.add('p-blue');
    if (panel) panel.classList.add('open');
  }

  function _closePanel() {
    _cfgOpen = false;
    const btn   = document.getElementById('bc-cfg-btn');
    const panel = document.getElementById('bc-cfg-panel');
    if (btn)   btn.classList.remove('p-blue');
    if (panel) panel.classList.remove('open');
  }

  // ── Y-Tick-Info aktualisieren ─────────────────────────────────────────────
  function _updateYTickInfo() {
    const info = document.getElementById('bc-ytick-info');
    if (!info) return;
    if (cfg.yLog) {
      info.textContent = '(log)';
      return;
    }
    if (cfg.yStep > 0) {
      const yMax = parseFloat(info.dataset.ymax || '0');
      if (yMax > 0) {
        const n = Math.floor(yMax / cfg.yStep) + 1;
        info.textContent = `≈ ${n} Ticks`;
      } else {
        info.textContent = '(auto berechnet)';
      }
    } else {
      info.textContent = '(auto)';
    }
  }

  // ── Sync-Helpers ──────────────────────────────────────────────────────────
  function _syncOutlierControls() {
    const btn = document.getElementById('bc-hdr-out');
    if (btn) {
      btn.textContent = cfg.showOutliers ? 'Ausreisser ●' : 'Ausreisser ○';
      btn.classList.toggle('p-blue', cfg.showOutliers);
    }
  }

  function _syncBugToggle() {
    const btn = document.getElementById('bc-bug-toggle');
    if (btn) {
      btn.textContent = cfg.includeBug ? 'inkl. Bug ●' : 'inkl. Bug ○';
      btn.classList.toggle('p-blue', cfg.includeBug);
    }
  }

  function _applyBugFilter(rows) {
    if (cfg.includeBug) return rows;
    return rows.filter(r => {
      const t = (r['Issue-Type'] || r['Issue Type'] || r['IssueType'] || r['Type'] || r['issue_type'] || '').trim().toLowerCase();
      return t !== 'bug';
    });
  }

  // ════════════════════════════════════════════════
  // Header
  // ════════════════════════════════════════════════
  function _buildHeader() {
    [['lt', 'Lead Time'], ['ct', 'Cycle Time']].forEach(([preset, lbl]) => {
      const btn = document.createElement('button');
      btn.className     = 'btn-icon';
      btn.id            = 'bc-mode-' + preset;
      btn.textContent   = lbl;
      btn.style.cssText = 'font-size:.58rem;padding:.1rem .32rem';
      btn.addEventListener('click', () => {
        if (preset === 'lt') { cfg.ltStart = LT_START_DEFAULT; cfg.ltEnd = LT_END_DEFAULT; }
        else                 { cfg.ltStart = CT_START_DEFAULT; cfg.ltEnd = LT_END_DEFAULT; }
        const ltsEl = document.getElementById('bc-ltstart');
        const lteEl = document.getElementById('bc-ltend');
        if (ltsEl) ltsEl.value = cfg.ltStart;
        if (lteEl) lteEl.value = cfg.ltEnd;
        _updateModeUI();
        _saveAndRender();
      });
      _headerExtraEl.appendChild(btn);
    });

    const bugBtn = document.createElement('button');
    bugBtn.className   = 'btn-icon';
    bugBtn.id          = 'bc-bug-toggle';
    bugBtn.title       = 'Bug-Issues einschließen';
    bugBtn.textContent = cfg.includeBug ? 'inkl. Bug ●' : 'inkl. Bug ○';
    bugBtn.classList.toggle('p-blue', cfg.includeBug);
    bugBtn.style.cssText = 'font-size:.58rem;padding:.1rem .32rem';
    bugBtn.addEventListener('click', () => {
      cfg.includeBug = !cfg.includeBug;
      _syncBugToggle();
      _saveAndRender();
    });
    _headerExtraEl.appendChild(bugBtn);

    const modes = [['box','Box'], ['violin','Violin'], ['combo','Kombi']];
    modes.forEach(([val, lbl]) => {
      const btn = document.createElement('button');
      btn.className        = 'btn-icon';
      btn.dataset.bcMode   = val;
      btn.textContent      = lbl;
      btn.style.cssText    = 'font-size:.58rem;padding:.1rem .32rem';
      btn.classList.toggle('p-blue', cfg.chartMode === val);
      btn.addEventListener('click', () => {
        cfg.chartMode = val;
        _headerExtraEl.querySelectorAll('[data-bc-mode]').forEach(b =>
          b.classList.toggle('p-blue', b.dataset.bcMode === val)
        );
        _saveAndRender();
      });
      _headerExtraEl.appendChild(btn);
    });

    const outBtn = document.createElement('button');
    outBtn.className   = 'btn-icon';
    outBtn.id          = 'bc-hdr-out';
    outBtn.title       = 'Ausreißer ein/aus';
    outBtn.textContent = cfg.showOutliers ? 'Ausreisser ●' : 'Ausreisser ○';
    outBtn.classList.toggle('p-blue', cfg.showOutliers);
    outBtn.addEventListener('click', () => {
      cfg.showOutliers = !cfg.showOutliers;
      _syncOutlierControls();
      _saveAndRender();
    });
    _headerExtraEl.appendChild(outBtn);

    const cfgBtn = document.createElement('button');
    cfgBtn.className        = 'btn-icon';
    cfgBtn.id               = 'bc-cfg-btn';
    cfgBtn.title            = 'Konfiguration';
    cfgBtn.textContent      = '⚙';
    cfgBtn.style.marginLeft = '.15rem';
    cfgBtn.addEventListener('click', e => {
      e.stopPropagation();
      _togglePanel();
    });
    _headerExtraEl.appendChild(cfgBtn);

    // ── Config-Panel ─────────────────────────────────────────────────────────
    const panel = document.createElement('div');
    panel.id        = 'bc-cfg-panel';
    panel.className = 'sub-panel';
    Object.assign(panel.style, {
      position:     'absolute',
      top:          '0',
      left:         '0',
      right:        '0',
      zIndex:       '50',
      background:   'var(--bg2)',
      borderBottom: '1px solid var(--border)',
      overflowY:    'auto',
    });

    panel.innerHTML = `
      <div class="lt-row" style="position:relative">
        <button id="bc-cfg-close" title="Schließen"
                style="position:absolute;top:0;right:0;background:none;border:none;
                       color:var(--dim);cursor:pointer;font-size:.85rem;
                       padding:.1rem .4rem;line-height:1">×</button>
        <div class="lt-field">
          <span class="lt-label">ltStart</span>
          <select class="lt-select" id="bc-ltstart"></select>
        </div>
        <div class="lt-field">
          <span class="lt-label">ltEnd</span>
          <select class="lt-select" id="bc-ltend"></select>
        </div>
        <div class="lt-field">
          <span class="lt-label">Iteration</span>
          <select class="lt-select" id="bc-period">
            <option value="month">Monat</option>
            <option value="quarter">Quartal</option>
          </select>
        </div>
        <div class="lt-field">
          <label style="display:flex;align-items:center;gap:.3rem;font-size:.65rem;
                        color:var(--dim);cursor:pointer;font-family:var(--mono)">
            <input type="checkbox" id="bc-smoothing-chk"
                   style="accent-color:var(--blue);width:11px;height:11px">
            Glättung
          </label>
        </div>
        <div class="lt-field">
          <label style="display:flex;align-items:center;gap:.3rem;font-size:.65rem;
                        color:var(--dim);cursor:pointer;font-family:var(--mono)">
            <input type="checkbox" id="bc-ylog-chk"
                   style="accent-color:var(--blue);width:11px;height:11px">
            Log-Skala
          </label>
        </div>
        <div class="lt-field" style="display:flex;align-items:center;gap:.3rem">
          <span class="lt-label">Y-Schritt</span>
          <input type="number" id="bc-ystep" min="0" step="10"
                 style="width:52px;font-family:var(--mono);font-size:.65rem;
                        background:var(--bg3,var(--bg2));border:1px solid var(--border);
                        color:var(--text);border-radius:3px;padding:.1rem .3rem;
                        text-align:right">
          <span style="font-family:var(--mono);font-size:.6rem;color:var(--dim)">d</span>
          <span id="bc-ytick-info"
                style="font-family:var(--mono);font-size:.6rem;color:var(--dimmer)"></span>
        </div>
        <div class="lt-field" style="display:flex;align-items:center;gap:.3rem">
          <span class="lt-label">Monate</span>
          <input type="number" id="bc-months" min="1" max="60"
                 style="width:52px;font-family:var(--mono);font-size:.65rem;
                        background:var(--bg3,var(--bg2));border:1px solid var(--border);
                        color:var(--text);border-radius:3px;padding:.1rem .3rem;
                        text-align:right">
        </div>
      </div>`;

    _contentEl.style.position = 'relative';
    _contentEl.appendChild(panel);

    document.getElementById('bc-cfg-close').addEventListener('click', e => {
      e.stopPropagation();
      _closePanel();
    });

    document.addEventListener('click', e => {
      if (!_cfgOpen) return;
      const p = document.getElementById('bc-cfg-panel');
      const b = document.getElementById('bc-cfg-btn');
      if (p && !p.contains(e.target) && b && !b.contains(e.target)) {
        _closePanel();
      }
    }, true);

    document.getElementById('bc-period').value = cfg.periodMode;
    document.getElementById('bc-period').addEventListener('change', e => {
      cfg.periodMode = e.target.value;
      _saveAndRender();
    });

    const smoothChk = document.getElementById('bc-smoothing-chk');
    smoothChk.checked = cfg.smoothing;
    smoothChk.addEventListener('change', () => {
      cfg.smoothing = smoothChk.checked;
      _saveAndRender();
    });

    const yLogChk = document.getElementById('bc-ylog-chk');
    yLogChk.checked = cfg.yLog;
    yLogChk.addEventListener('change', () => {
      cfg.yLog = yLogChk.checked;
      const stepInput = document.getElementById('bc-ystep');
      if (stepInput) stepInput.disabled = cfg.yLog;
      _updateYTickInfo();
      _saveAndRender();
    });

    const yStepInput = document.getElementById('bc-ystep');
    yStepInput.value    = cfg.yStep > 0 ? cfg.yStep : '';
    yStepInput.disabled = cfg.yLog;
    yStepInput.addEventListener('input', () => {
      const v = parseFloat(yStepInput.value);
      cfg.yStep = (isFinite(v) && v > 0) ? v : 0;
      _updateYTickInfo();
      _saveAndRender();
    });

    const monthsInput = document.getElementById('bc-months');
    monthsInput.value = cfg.months;
    monthsInput.addEventListener('input', () => {
      const v = parseInt(monthsInput.value, 10);
      cfg.months = (Number.isFinite(v) && v >= 1) ? v : 12;
      _saveAndRender();
    });

    document.getElementById('bc-ltstart').addEventListener('change', e => {
      cfg.ltStart = e.target.value;
      _updateModeUI();
      _saveAndRender();
    });
    document.getElementById('bc-ltend').addEventListener('change', e => {
      cfg.ltEnd = e.target.value;
      _updateModeUI();
      _saveAndRender();
    });
  }

  // ════════════════════════════════════════════════
  // KPI-Bereich
  // ════════════════════════════════════════════════
  function _buildKpiArea() {
    const kpi = document.createElement('div');
    kpi.id = 'bc-kpi-area';
    kpi.style.cssText = [
      'padding:5px 10px 4px', 'flex-shrink:0',
      'border-bottom:1px solid var(--border)',
      'background:var(--bg2)',
    ].join(';');

    kpi.innerHTML = `
      <div style="display:flex;align-items:flex-start;justify-content:space-between">
        <div>
          <div style="display:flex;align-items:baseline;gap:7px;margin-bottom:2px">
            <span id="bc-kpi-val"
                  style="font-size:1.55rem;font-weight:700;line-height:1;color:var(--text)">–</span>
            <span id="bc-kpi-trend"
                  style="display:none;font-size:.6rem;font-weight:600;
                         padding:.12rem .35rem;border-radius:4px;white-space:nowrap"></span>
          </div>
          <div id="bc-kpi-sub"
               style="font-size:.62rem;color:var(--dim);font-family:var(--mono)">–</div>
        </div>
        <span id="bc-kpi-n"
              style="font-family:var(--mono);font-size:.65rem;color:var(--dim);
                     align-self:center;white-space:nowrap">N = –</span>
      </div>
    `;

    const tileEl = document.getElementById('tile-boxchart');
    tileEl.insertBefore(kpi, tileEl.querySelector('.tile-content'));
  }

  function _updateKpiArea(latestStats, prevStats) {
    const valEl   = document.getElementById('bc-kpi-val');
    const trendEl = document.getElementById('bc-kpi-trend');
    const subEl   = document.getElementById('bc-kpi-sub');
    if (!valEl) return;

    if (!latestStats) {
      valEl.textContent = '–';
      if (trendEl) trendEl.style.display = 'none';
      if (subEl)   subEl.textContent = '–';
      return;
    }

    valEl.textContent = Math.round(latestStats.med) + 'd';

    if (trendEl && prevStats) {
      const diff    = latestStats.med - prevStats.med;
      const absDiff = Math.abs(Math.round(diff));
      if (absDiff >= 1) {
        const up = diff > 0;
        trendEl.style.display    = 'inline-block';
        trendEl.textContent      = (up ? '▲ +' : '▼ −') + absDiff + 'd ggü. Vorperiode';
        trendEl.style.color      = up ? 'var(--orange)' : 'var(--green)';
        trendEl.style.background = up ? 'rgba(251,146,60,.12)' : 'rgba(74,222,128,.1)';
      } else {
        trendEl.style.display = 'none';
      }
    } else if (trendEl) {
      trendEl.style.display = 'none';
    }

    if (subEl) subEl.textContent = `P85 · ${Math.round(latestStats.p85)}d · typischer Fall`;
  }

  // ════════════════════════════════════════════════
  // Footer
  // ════════════════════════════════════════════════
  function _buildFooter() {
    _diagEl.style.cssText = [
      'display:flex', 'align-items:center',
      'padding:.2rem .58rem',
      'background:var(--bg2)',
      'border-top:1px solid var(--border)',
      'flex-shrink:0',
      'gap:.4rem',
      'font-family:var(--mono)',
      'font-size:11px',
      'white-space:nowrap',
      'overflow:hidden',
    ].join(';');

    const hint = document.createElement('a');
    hint.textContent = 'Was zeigt diese Ansicht?';
    hint.style.cssText = 'color:var(--blue);cursor:pointer;text-decoration:none';
    hint.addEventListener('click', _toggleExplanation);

    const spacer = document.createElement('span');
    spacer.style.flex = '1';

    const link = document.createElement('a');
    link.textContent = 'Verteilung ansehen →';
    link.style.cssText = [
      'color:var(--blue)', 'cursor:pointer',
      'text-decoration:none', 'font-weight:500', 'flex-shrink:0',
    ].join(';');
    link.addEventListener('click', e => {
      e.preventDefault();
      const sc = core.load('fhwa_scatter', {});
      sc.ctStart = cfg.ltStart;
      sc.ctEnd   = cfg.ltEnd;
      core.save('fhwa_scatter', sc);
      core.showPage('scatter');
    });

    _diagEl.innerHTML = '';
    _diagEl.appendChild(hint);
    _diagEl.appendChild(spacer);
    _diagEl.appendChild(link);
  }

  // ════════════════════════════════════════════════
  // Erklärungs-Panel
  // ════════════════════════════════════════════════
  function _buildExplanation() {
    _explanationEl = document.createElement('div');
    _explanationEl.id = 'bc-explanation';
    _explanationEl.style.cssText = [
      'overflow:hidden', 'max-height:0', 'flex-shrink:0',
      'transition:max-height .22s ease',
      'background:var(--bg3)', 'border-bottom:1px solid var(--border)',
      'font-size:.63rem', 'color:var(--dim)', 'line-height:1.6',
      'font-family:var(--mono)',
    ].join(';');
    _explanationEl.innerHTML = _getModeExplanation();
    _contentEl.insertBefore(_explanationEl, _contentEl.firstChild);
  }

  function _toggleExplanation() {
    _explanationOpen = !_explanationOpen;
    if (_explanationEl) {
      _explanationEl.style.maxHeight = _explanationOpen
        ? _explanationEl.scrollHeight + 'px'
        : '0';
    }
    const hintEl = _diagEl.querySelector('a');
    if (hintEl) hintEl.style.opacity = _explanationOpen ? '0.7' : '1';
    setTimeout(_render, 240);
  }

  // ════════════════════════════════════════════════
  // Spalten-Selects
  // ════════════════════════════════════════════════
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
  function _calcStats(values) { return calcBoxStats(values); }

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

  function _niceYTicks(lo, hi, n, customStep) {
    const range = hi - lo || 1;
    let step;
    if (customStep && customStep > 0) {
      step = customStep;
    } else {
      const raw = range / (n - 1);
      const mag = Math.pow(10, Math.floor(Math.log10(raw)));
      step = [1, 2, 5, 10].map(f => f * mag).find(f => f >= raw) || mag;
    }
    step = Math.max(1, Math.round(step));
    const ticks = [];
    let t = Math.ceil(lo / step) * step;
    if (t > lo + step * 0.01) ticks.unshift(Math.round(lo));
    while (t <= hi + step * 0.01) {
      ticks.push(Math.round(t));
      t += step;
    }
    return [...new Set(ticks)].sort((a, b) => a - b);
  }

  function _logYTicks(lo, hi) {
    const ticks = [];
    const steps = [1, 2, 5];
    let mag = 1;
    while (mag <= hi * 10) {
      for (const s of steps) {
        const v = s * mag;
        if (v >= Math.max(1, lo) && v <= hi * 1.05) ticks.push(v);
      }
      mag *= 10;
    }
    if (!ticks.length) ticks.push(1);
    return ticks;
  }

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

  function _chronoSort(keys) {
    return [...keys].sort();
  }

  function _saveAndRender() {
    core.save(LS_KEY, cfg);
    _render();
  }

  // ════════════════════════════════════════════════
  // Leerzustand
  // ════════════════════════════════════════════════
  function _showEmpty(msg) {
    const panel = document.getElementById('bc-cfg-panel');
    const exp   = document.getElementById('bc-explanation');
    _contentEl.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:center;
                  height:100%;font-family:var(--mono);font-size:.63rem;
                  color:var(--dimmer);padding:.5rem;text-align:center">
        ${msg}
      </div>`;
    if (exp) {
      _contentEl.insertBefore(exp, _contentEl.firstChild);
      exp.style.maxHeight = _explanationOpen ? exp.scrollHeight + 'px' : '0';
    }
    if (panel) _contentEl.appendChild(panel);
    _updateKpiArea(null, null);
    const nEl = document.getElementById('bc-kpi-n');
    if (nEl) nEl.textContent = 'N = –';
  }

  // ════════════════════════════════════════════════
  // Haupt-Render
  // ════════════════════════════════════════════════
  function _render() {
    const rows = _applyBugFilter(core.filteredRows());
    const ltS  = cfg.ltStart;
    const ltE  = cfg.ltEnd;

    if (!rows.length) {
      _showEmpty('Keine Daten geladen.');
      return;
    }

    if (!(ltS in rows[0]) || !(ltE in rows[0])) {
      _showEmpty(`Spalten „${ltS}" oder „${ltE}" nicht gefunden.`);
      return;
    }

    // ── Daten gruppieren ──────────────────────────────────────────────────────
    const periodItems = new Map();
    const now    = new Date();
    const cutoff = cfg.months > 0
      ? new Date(now.getFullYear(), now.getMonth() - cfg.months + 1, 1)
      : null;

    for (const row of rows) {
      if (row['Rejected'] != null && row['Rejected'] !== '') continue;
      const lt = core.dur(row[ltS], row[ltE]);
      if (!lt || lt < 1) continue;
      const endDate = core.toDate(row[ltE]);
      if (!endDate) continue;
      if (cutoff && endDate < cutoff) continue;
      const key = _periodKey(endDate, cfg.periodMode);
      if (!key) continue;
      if (!periodItems.has(key)) periodItems.set(key, []);

      const issueType = String(
        row['Issue-Type'] || row['Issue Type'] || row['IssueType'] || row['Type'] || row['issue_type'] || ''
      );

      periodItems.get(key).push({
        jiraId: String(row['Jira-ID'] || ''),
        lt,
        issueType,
      });
    }

    if (!periodItems.size) {
      _showEmpty('Keine gültigen Lead-Time-Werte.');
      return;
    }

    // ── Sortierung & Statistiken ──────────────────────────────────────────────
    const keys     = _chronoSort([...periodItems.keys()]);
    const statsMap = new Map();
    keys.forEach(k => statsMap.set(k, _calcStats(periodItems.get(k).map(it => it.lt))));

    // ── KPI-Bereich ───────────────────────────────────────────────────────────
    const latestKey = keys[keys.length - 1];
    const prevKey   = keys.length >= 2 ? keys[keys.length - 2] : null;
    _updateKpiArea(
      statsMap.get(latestKey),
      prevKey ? statsMap.get(prevKey) : null
    );

    const totalN = [...periodItems.values()].reduce((s, a) => s + a.length, 0);
    const nEl = document.getElementById('bc-kpi-n');
    if (nEl) nEl.textContent = 'N = ' + totalN;

    // ── SVG-Dimensionen ───────────────────────────────────────────────────────
    const W = _contentEl.clientWidth  || 600;
    const H = _contentEl.clientHeight || 200;
    if (W < 60 || H < 50) return;

    const C    = core.scatterColors();
    const isLt = core.isLight();

    const PAD_L = 38, PAD_R = 10, PAD_T = 10, PAD_B = 42;
    const pW = W - PAD_L - PAD_R;
    const pH = H - PAD_T - PAD_B;
    if (pW < 40 || pH < 30) return;

    // ── Y-Skala ───────────────────────────────────────────────────────────────
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

    const tickInfoEl = document.getElementById('bc-ytick-info');
    if (tickInfoEl) {
      tickInfoEl.dataset.ymax = yMax;
      if (cfg.yLog) {
        tickInfoEl.textContent = '(log)';
      } else if (cfg.yStep > 0) {
        const n = Math.floor(yMax / cfg.yStep) + 1;
        tickInfoEl.textContent = `≈ ${n} Ticks`;
      } else {
        tickInfoEl.textContent = '(auto)';
      }
    }

    let yTicks, yS;
    if (cfg.yLog) {
      yTicks = _logYTicks(1, yMax);
      const logMax = Math.log10(Math.max(1, yMax));
      yS = v => PAD_T + pH - (Math.log10(Math.max(1, v)) / logMax) * pH;
    } else {
      yTicks = _niceYTicks(0, yMax, 5, cfg.yStep > 0 ? cfg.yStep : 0);
      yS     = v => PAD_T + pH - (Math.max(0, v) / yMax) * pH;
    }

    // ── X-Skala ───────────────────────────────────────────────────────────────
    const nP   = keys.length;
    const colW = pW / nP;
    const bHW  = Math.max(5, Math.min(24, colW * 0.28));
    const vHW  = Math.max(7, Math.min(32, colW * 0.38));
    const outR = Math.max(2, Math.min(5,  colW / 14));
    const xC   = i => PAD_L + (i + 0.5) * colW;

    // ── Farben ────────────────────────────────────────────────────────────────
    const amberC   = isLt ? '#d97706' : '#fbbf24';
    const boxFill  = isLt ? 'rgba(2,132,199,0.15)'  : 'rgba(56,189,248,0.15)';
    const boxStr   = isLt ? '#0284c7'                : '#38bdf8';
    const medC     = isLt ? '#0284c7'                : '#38bdf8';
    const whiskC   = C.axisLabel;
    const outlFill = isLt ? '#94a3b8'                : '#4d6a88';
    const outlStr  = isLt ? '#0284c7'                : '#38bdf8';
    const violinF  = isLt ? 'rgba(2,132,199,0.10)'  : 'rgba(56,189,248,0.10)';
    const violinS  = isLt ? 'rgba(2,132,199,0.45)'  : 'rgba(56,189,248,0.45)';

    const bw = cfg.smoothing ? BW_ON : BW_OFF;

    const parts = [];
    parts.push(`<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">`);

    for (const y of yTicks) {
      const sy  = yS(y);
      const lbl = String(Math.round(y));
      parts.push(`<line x1="${PAD_L}" y1="${sy.toFixed(1)}" x2="${(PAD_L+pW).toFixed(1)}" y2="${sy.toFixed(1)}" stroke="${C.gridLine}" stroke-width="1" stroke-dasharray="${cfg.yLog ? '2,3' : 'none'}"/>`);
      parts.push(`<text x="${(PAD_L-4).toFixed(1)}" y="${(sy+4).toFixed(1)}" text-anchor="end" font-family="var(--mono)" font-size="9" fill="${C.axisLabel}">${lbl}</text>`);
    }

    parts.push(`<line x1="${PAD_L}" y1="${PAD_T}" x2="${PAD_L}" y2="${(PAD_T+pH).toFixed(1)}" stroke="${C.axisLine}" stroke-width="1"/>`);
    parts.push(`<line x1="${PAD_L}" y1="${(PAD_T+pH).toFixed(1)}" x2="${(PAD_L+pW).toFixed(1)}" y2="${(PAD_T+pH).toFixed(1)}" stroke="${C.axisLine}" stroke-width="1"/>`);

    keys.forEach((key, i) => {
      const st  = statsMap.get(key);
      const cx  = xC(i);
      const lbl = _periodLabel(key, cfg.periodMode);
      const n   = st ? st.n : 0;

      parts.push(`<text x="${cx.toFixed(1)}" y="${(PAD_T+pH+13).toFixed(1)}" text-anchor="middle" font-family="var(--mono)" font-size="9" fill="${C.axisLabel}">${lbl}</text>`);
      parts.push(`<text x="${cx.toFixed(1)}" y="${(PAD_T+pH+25).toFixed(1)}" text-anchor="middle" font-family="var(--mono)" font-size="8" fill="${C.nText}">n=${n}</text>`);

      if (!st || n === 0) return;

      const syP25 = yS(st.p25);
      const syMed = yS(st.med);
      const syP85 = yS(st.p85);
      const syWUp = yS(st.wUp);
      const syWDn = yS(st.wDn);

      // ── 1. Violin ────────────────────────────────────────────────────────────
      if (cfg.chartMode === 'violin' || cfg.chartMode === 'combo') {
        const kde = _kde(st.sorted, bw, KDE_POINTS);
        if (kde.length >= 2) {
          const maxD = kde.reduce((m, p) => Math.max(m, p.y), 0);
          if (maxD > 0) {
            const pts = kde.map(p => ({
              xR: cx + (p.y / maxD) * vHW,
              xL: cx - (p.y / maxD) * vHW,
              sy: yS(p.x),
            }));
            let d = `M${pts[0].xR.toFixed(1)},${pts[0].sy.toFixed(1)}`;
            for (let j = 1; j < pts.length; j++) d += ` L${pts[j].xR.toFixed(1)},${pts[j].sy.toFixed(1)}`;
            for (let j = pts.length-1; j >= 0; j--) d += ` L${pts[j].xL.toFixed(1)},${pts[j].sy.toFixed(1)}`;
            d += ' Z';
            parts.push(`<path d="${d}" fill="${violinF}" stroke="${violinS}" stroke-width="1.2"/>`);
          }
        }
      }

      // ── 2. Box + Whisker ──────────────────────────────────────────────────────
      if (cfg.chartMode === 'box' || cfg.chartMode === 'combo') {
        const hw    = cfg.chartMode === 'combo' ? bHW * 0.62 : bHW;
        const capHW = hw * 0.40;
        const boxTop = Math.min(syP25, syP85);
        const boxHt  = Math.abs(syP85 - syP25);

        parts.push(`<rect x="${(cx-hw).toFixed(1)}" y="${boxTop.toFixed(1)}" width="${(hw*2).toFixed(1)}" height="${boxHt.toFixed(1)}" fill="${boxFill}" stroke="${boxStr}" stroke-width="1.4" rx="2"/>`);
        parts.push(`<line x1="${(cx-hw).toFixed(1)}" y1="${syMed.toFixed(1)}" x2="${(cx+hw).toFixed(1)}" y2="${syMed.toFixed(1)}" stroke="${medC}" stroke-width="2.2"/>`);
        parts.push(`<line x1="${(cx-hw).toFixed(1)}" y1="${syP85.toFixed(1)}" x2="${(cx+hw).toFixed(1)}" y2="${syP85.toFixed(1)}" stroke="${amberC}" stroke-width="1.5" stroke-dasharray="3,2"/>`);

        parts.push(`<line x1="${cx.toFixed(1)}" y1="${Math.min(syP85,syWUp).toFixed(1)}" x2="${cx.toFixed(1)}" y2="${Math.max(syP85,syWUp).toFixed(1)}" stroke="${whiskC}" stroke-width="1.2"/>`);
        parts.push(`<line x1="${(cx-capHW).toFixed(1)}" y1="${syWUp.toFixed(1)}" x2="${(cx+capHW).toFixed(1)}" y2="${syWUp.toFixed(1)}" stroke="${whiskC}" stroke-width="1.2"/>`);

        parts.push(`<line x1="${cx.toFixed(1)}" y1="${Math.min(syP25,syWDn).toFixed(1)}" x2="${cx.toFixed(1)}" y2="${Math.max(syP25,syWDn).toFixed(1)}" stroke="${whiskC}" stroke-width="1.2"/>`);
        parts.push(`<line x1="${(cx-capHW).toFixed(1)}" y1="${syWDn.toFixed(1)}" x2="${(cx+capHW).toFixed(1)}" y2="${syWDn.toFixed(1)}" stroke="${whiskC}" stroke-width="1.2"/>`);
      }

      // ── 3. Box-Hit-Area ───────────────────────────────────────────────────────
      const hitT = (Math.min(syWUp, syP85, syMed, syP25, syWDn) - 4).toFixed(1);
      const hitB = (Math.max(syWUp, syP85, syMed, syP25, syWDn) + 4).toFixed(1);
      const hitH = (parseFloat(hitB) - parseFloat(hitT)).toFixed(1);
      const lblEsc = lbl.replace(/"/g, '&quot;');
      parts.push(
        `<rect class="bc-box-hit" ` +
        `x="${(cx - colW * 0.48).toFixed(1)}" y="${hitT}" ` +
        `width="${(colW * 0.96).toFixed(1)}" height="${hitH}" ` +
        `fill="transparent" style="cursor:crosshair" ` +
        `data-p25="${st.p25.toFixed(1)}" data-med="${st.med.toFixed(1)}" ` +
        `data-p85="${st.p85.toFixed(1)}" data-wup="${st.wUp.toFixed(1)}" ` +
        `data-wdn="${st.wDn.toFixed(1)}" data-n="${st.n}" ` +
        `data-lbl="${lblEsc}"/>`
      );

      // ── 4. Ausreißer-Kreise ───────────────────────────────────────────────────
      if (cfg.showOutliers) {
        periodItems.get(key).forEach((item, idx) => {
          if (item.lt <= st.wUp && item.lt >= st.wDn) return;
          const sy    = yS(item.lt);
          const hash  = (idx * 7919 + key.charCodeAt(0)) % 100;
          const jitter = ((hash - 50) / 50) * Math.min(bHW * 0.55, colW * 0.25);
          const ox    = (cx + jitter).toFixed(1);
          const escId = item.jiraId.replace(/"/g,'&quot;').replace(/'/g,'&#39;');
          const escTy = item.issueType.replace(/"/g,'&quot;').replace(/'/g,'&#39;');
          parts.push(
            `<circle class="bc-out" cx="${ox}" cy="${sy.toFixed(1)}" r="${outR}" ` +
            `fill="${outlFill}" stroke="${outlStr}" stroke-width="1.2" ` +
            `data-jira="${escId}" data-lt="${item.lt.toFixed(2)}" ` +
            `data-type="${escTy}" ` +
            `style="cursor:pointer;opacity:0.9"/>`
          );
        });
      }
    });

    parts.push('</svg>');
    const savedPanel = document.getElementById('bc-cfg-panel');
    const savedExp   = document.getElementById('bc-explanation');
    _contentEl.innerHTML = parts.join('');
    if (savedExp) {
      _contentEl.insertBefore(savedExp, _contentEl.firstChild);
      savedExp.style.maxHeight = _explanationOpen ? savedExp.scrollHeight + 'px' : '0';
    }
    if (savedPanel) _contentEl.appendChild(savedPanel);

    // ── Tooltip-Delegation ────────────────────────────────────────────────────
    const svg = _contentEl.querySelector('svg');
    if (!svg) return;

    svg.addEventListener('mouseover', e => {
      const outEl = e.target.closest ? e.target.closest('.bc-out')     : null;
      const boxEl = e.target.closest ? e.target.closest('.bc-box-hit') : null;

      if (outEl) {
        clearTimeout(_ttTimer);
        const jiraId  = outEl.dataset.jira || '';
        const ltVal   = parseFloat(outEl.dataset.lt);
        const issType = outEl.dataset.type || '';
        const url     = core.state.urlTemplate
          ? core.state.urlTemplate.replace('{issueKey}', jiraId)
          : '';
        let html = `<div class="tt-title">${jiraId || '—'}</div>`;
        if (issType) {
          html += `<div class="tt-row"><span class="tt-lbl">Typ</span><span class="tt-val">${issType}</span></div>`;
        }
        const modeLbl = _detectMode() === 'ct' ? 'Cycle Time' : 'Lead Time';
        html += `<div class="tt-row"><span class="tt-lbl">${modeLbl}</span><span class="tt-val">${core.fmt(ltVal)}</span></div>`;
        if (url) {
          const urlEsc = url.replace(/'/g, "\\'");
          html += `<a class="tt-link" href="#" onclick="window.open('${urlEsc}','_blank');return false;">🔗 In Jira öffnen</a>`;
        }
        _tooltip.innerHTML           = html;
        _tooltip.style.pointerEvents = url ? 'all' : 'none';
        _posTt(e.clientX, e.clientY);

      } else if (boxEl) {
        clearTimeout(_ttTimer);
        const d = boxEl.dataset;
        let html = `<div class="tt-title">${d.lbl || ''}</div>`;
        html += `<div class="tt-row"><span class="tt-lbl">Median</span><span class="tt-val">${parseFloat(d.med).toFixed(1)}d</span></div>`;
        html += `<div class="tt-row"><span class="tt-lbl">P85</span><span class="tt-val">${parseFloat(d.p85).toFixed(1)}d</span></div>`;
        html += `<div class="tt-row"><span class="tt-lbl">P25</span><span class="tt-val">${parseFloat(d.p25).toFixed(1)}d</span></div>`;
        html += `<div class="tt-row"><span class="tt-lbl">Whisker&nbsp;↑</span><span class="tt-val">${parseFloat(d.wup).toFixed(1)}d</span></div>`;
        html += `<div class="tt-row"><span class="tt-lbl">Whisker&nbsp;↓</span><span class="tt-val">${parseFloat(d.wdn).toFixed(1)}d</span></div>`;
        html += `<div class="tt-row"><span class="tt-lbl">n</span><span class="tt-val">${d.n}</span></div>`;
        _tooltip.innerHTML           = html;
        _tooltip.style.pointerEvents = 'none';
        _posTt(e.clientX, e.clientY);
      }
    });

    svg.addEventListener('mousemove', e => {
      if (_tooltip.style.display === 'block') {
        _posTt(e.clientX, e.clientY);
      }
    });

    svg.addEventListener('mouseout', e => {
      const leavingOut = e.target.closest && e.target.closest('.bc-out');
      const leavingBox = e.target.closest && e.target.closest('.bc-box-hit');
      if (leavingOut || leavingBox) {
        _ttTimer = setTimeout(() => { _tooltip.style.display = 'none'; }, 120);
      }
    });
  }

  // ── Initialisierung ───────────────────────────────────────────────────────
  _buildHeader();
  _buildKpiArea();
  _buildExplanation();
  _updateModeUI();
  _buildFooter();
  _createTooltip();

  core.on('data',     _onData);
  core.on('filter',   _render);
  core.on('theme',    _render);
  core.on('resize',   _render);
  core.on('settings', _render);
}
