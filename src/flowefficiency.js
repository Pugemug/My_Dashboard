// ════════════════════════════════════════════════
// flowefficiency.js  –  Flow Efficiency Tile
// Spec: docs/specs/FlowEfficiency.md v1.1
// ════════════════════════════════════════════════

export function init() {

  // ── Constants ─────────────────────────────────
  const WAIT_STATUS = [
    'Blocked', 'Ready4Test', 'Ready4QS',
    'Ready4Review', 'Ready4E2E-Test', 'Ready4Production',
  ];
  const WAIT_STATUS_LOWER = WAIT_STATUS.map(s => s.toLowerCase());

  const BREAKDOWN_COLORS = {
    'Blocked':          'var(--red)',
    'Ready4Test':       'var(--orange)',
    'Ready4QS':         'var(--purple)',
    'Ready4Review':     '#2dd4bf',
    'Ready4E2E-Test':   'var(--yellow)',
    'Ready4Production': 'var(--blue)',
  };

  const KEY  = 'fhwa_flowefficiency';
  const DEF  = { months: 12, targetFE: 40, showTarget: true, mode: 'line' };

  // ── State ──────────────────────────────────────
  let cfg       = Object.assign({}, DEF, core.load(KEY, {}));
  let _monthData = [];   // [{ key, label, fe, items, n, ltAvg, breakdown }]
  let _errors    = 0;

  // ── Tile ───────────────────────────────────────
  const { contentEl, headerExtraEl, diagEl } = core.createTile({
    id:    'flowefficiency',
    title: 'Flow <span class="hl">Efficiency</span>',
  });

  // ── Header extras: mode toggle · N-badge · settings ──
  const modeWrap = document.createElement('div');
  modeWrap.style.cssText = 'display:flex;background:var(--bg3);border:1px solid var(--border);border-radius:4px;overflow:hidden;flex-shrink:0';

  ['Linie', 'Violin'].forEach((label, i) => {
    const m   = i === 0 ? 'line' : 'violin';
    const btn = document.createElement('button');
    btn.textContent  = label;
    btn.dataset.mode = m;
    btn.style.cssText = 'background:none;border:none;cursor:pointer;font-size:11px;padding:3px 9px;font-weight:500;white-space:nowrap;font-family:var(--sans);transition:background .12s,color .12s';
    btn.addEventListener('click', () => {
      cfg.mode = m;
      core.save(KEY, cfg);
      _updateModeToggle();
      _renderChart();
    });
    modeWrap.appendChild(btn);
  });

  const nBadge = document.createElement('span');
  nBadge.style.cssText = 'font-size:11px;color:var(--dim);background:var(--bg3);border:1px solid var(--border);padding:2px 7px;border-radius:10px;white-space:nowrap;font-family:var(--mono)';
  nBadge.textContent = 'N=–';

  const settingsBtn = document.createElement('button');
  settingsBtn.className   = 'btn-icon';
  settingsBtn.textContent = '⚙';
  settingsBtn.title       = 'Flow Efficiency – Einstellungen';
  settingsBtn.addEventListener('click', _openSettings);

  headerExtraEl.appendChild(modeWrap);
  headerExtraEl.appendChild(nBadge);
  headerExtraEl.appendChild(settingsBtn);

  // ── SVG ────────────────────────────────────────
  const svgNS = 'http://www.w3.org/2000/svg';
  const svg   = document.createElementNS(svgNS, 'svg');
  svg.style.cssText    = 'width:100%;height:100%;display:block;overflow:visible';
  contentEl.style.cssText = 'position:relative;overflow:hidden';
  contentEl.appendChild(svg);

  // ── Tooltip ────────────────────────────────────
  const tt = document.createElement('div');
  tt.style.cssText = [
    'position:fixed', 'background:var(--bg2)', 'border:1px solid var(--border)',
    'border-radius:6px', 'padding:10px 12px', 'pointer-events:none',
    'font-size:12px', 'line-height:1.65', 'min-width:210px',
    'box-shadow:0 4px 20px rgba(0,0,0,.4)', 'z-index:999',
    'display:none', 'font-family:var(--sans)', 'color:var(--text)',
  ].join(';');
  document.body.appendChild(tt);

  // ── Per-tile settings panel ─────────────────────
  const feBackdrop = document.createElement('div');
  feBackdrop.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:300';
  feBackdrop.addEventListener('click', _closeSettings);
  document.body.appendChild(feBackdrop);

  const fePanel = document.createElement('div');
  fePanel.style.cssText = [
    'display:none', 'position:fixed', 'top:50%', 'left:50%',
    'transform:translate(-50%,-50%)', 'background:var(--bg2)',
    'border:1px solid var(--border)', 'border-radius:6px',
    'padding:20px 24px', 'width:320px', 'z-index:301',
    'box-shadow:0 8px 40px rgba(0,0,0,.5)',
    'font-family:var(--sans)', 'color:var(--text)',
  ].join(';');
  fePanel.innerHTML = `
    <div style="font-size:14px;font-weight:700;margin-bottom:16px">
      ⚙ Flow Efficiency
    </div>
    <div style="margin-bottom:14px">
      <div style="font-size:11px;color:var(--dim);text-transform:uppercase;
        letter-spacing:.08em;margin-bottom:5px;display:flex;justify-content:space-between">
        Monate (Fenster)
        <span id="fe-lbl-months" style="color:var(--text);font-weight:600">12</span>
      </div>
      <input id="fe-sl-months" type="range" min="3" max="36"
        style="width:100%;accent-color:var(--blue);cursor:pointer">
    </div>
    <div style="margin-bottom:14px">
      <div style="font-size:11px;color:var(--dim);text-transform:uppercase;
        letter-spacing:.08em;margin-bottom:5px;display:flex;justify-content:space-between">
        Ziellinie FE%
        <span id="fe-lbl-target" style="color:var(--text);font-weight:600">40%</span>
      </div>
      <input id="fe-sl-target" type="range" min="0" max="100"
        style="width:100%;accent-color:var(--blue);cursor:pointer">
    </div>
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px">
      <span style="font-size:11px;color:var(--dim);text-transform:uppercase;letter-spacing:.08em">
        Ziellinie anzeigen
      </span>
      <button id="fe-tog-target"
        style="width:36px;height:20px;border-radius:10px;position:relative;
        cursor:pointer;border:none;transition:background .2s;flex-shrink:0">
      </button>
    </div>
    <button id="fe-s-close"
      style="width:100%;background:var(--blue);color:#fff;border:none;
      border-radius:6px;padding:8px;font-size:13px;font-weight:600;
      cursor:pointer;font-family:var(--sans)">
      Schließen
    </button>
  `;
  document.body.appendChild(fePanel);

  // Wire settings controls
  const slM   = fePanel.querySelector('#fe-sl-months');
  const slT   = fePanel.querySelector('#fe-sl-target');
  const lblM  = fePanel.querySelector('#fe-lbl-months');
  const lblT  = fePanel.querySelector('#fe-lbl-target');
  const togT  = fePanel.querySelector('#fe-tog-target');

  slM.addEventListener('input', () => {
    cfg.months = +slM.value;
    lblM.textContent = cfg.months;
    core.save(KEY, cfg);
    _compute(); _renderChart();
  });
  slT.addEventListener('input', () => {
    cfg.targetFE = +slT.value;
    lblT.textContent = cfg.targetFE + '%';
    core.save(KEY, cfg);
    _renderChart();
  });
  togT.addEventListener('click', () => {
    cfg.showTarget = !cfg.showTarget;
    core.save(KEY, cfg);
    _updateToggleBtn();
    _renderChart();
  });
  fePanel.querySelector('#fe-s-close').addEventListener('click', _closeSettings);

  function _updateToggleBtn() {
    togT.style.background = cfg.showTarget ? 'var(--blue)' : 'var(--bg4)';
    togT.innerHTML = '<span style="position:absolute;width:14px;height:14px;' +
      'border-radius:50%;background:white;top:3px;' +
      (cfg.showTarget ? 'right:3px' : 'left:3px') + '"></span>';
  }

  function _openSettings() {
    slM.value = cfg.months;  lblM.textContent = cfg.months;
    slT.value = cfg.targetFE; lblT.textContent = cfg.targetFE + '%';
    _updateToggleBtn();
    feBackdrop.style.display = 'block';
    fePanel.style.display    = 'block';
  }
  function _closeSettings() {
    feBackdrop.style.display = 'none';
    fePanel.style.display    = 'none';
  }

  function _updateModeToggle() {
    modeWrap.querySelectorAll('button').forEach(btn => {
      const active = btn.dataset.mode === cfg.mode;
      btn.style.background = active ? 'var(--blue)'   : 'transparent';
      btn.style.color      = active ? '#fff'           : 'var(--dim)';
    });
  }
  _updateModeToggle();
  _updateToggleBtn();

  // ── Dual-Period helper ─────────────────────────
  function _dualPeriodDays(row, status) {
    const e0 = core.toDate(row[status]);
    const x0 = core.toDate(row['leaving_' + status]);
    const e1 = core.toDate(row[status + '_first']);
    const x1 = core.toDate(row['leaving_' + status + '_first']);
    if (!e0 || !x0) return 0;
    // Two-pass check: _first differs from current by ≥ 0.5 days
    if (e1 && x1 && Math.abs(e1.getTime() - e0.getTime()) >= 43200000) {
      return Math.max(0, (x1 - e1) / 86400000 + 1) +
             Math.max(0, (x0 - e0) / 86400000 + 1);
    }
    return Math.max(0, (x0 - e0) / 86400000 + 1);
  }

  // ── Data computation ───────────────────────────
  function _compute() {
    const rows     = core.filteredRows();
    const blockers = core.state.sheets['JiraBlockermanagement'] ?? [];

    // Blocker lookup: jiraId§squad → episodes
    const bMap   = {};
    // Fallback lookup without squad: jiraId → episodes
    const bMapNS = {};
    blockers.forEach(function(b) {
      var jid   = String(b['issues.key'] || '').trim();
      var sq    = String(b['Squad']      || '').trim();
      var dauer = parseFloat(b['BlockiertWartendSeit']);
      if (!jid || isNaN(dauer) || dauer <= 0) return;
      var ep = {
        zustand: String(b['Blockiert/Wartend_Zustand'] || '').trim(),
        grund:   String(b['Blockiert/Wartend_Grund']   || '').trim(),
        dauer,
      };
      var k = jid + '\u00a7' + sq;
      if (!bMap[k])   bMap[k]   = [];
      if (!bMapNS[jid]) bMapNS[jid] = [];
      bMap[k].push(ep);
      bMapNS[jid].push(ep);
    });

    // Rolling-window cutoff
    var now     = new Date();
    var cutoff  = new Date(now.getFullYear(), now.getMonth() - cfg.months + 1, 1);

    var monthly = {};
    var errors  = 0;

    rows.forEach(function(row) {
      // Resolved only (XOR Rejected)
      var resolved = core.toDate(row['Resolved']);
      if (!resolved) return;
      if (row['Rejected'] != null && row['Rejected'] !== '') return;

      // Rolling window
      if (resolved < cutoff) return;

      var r4p = core.toDate(row['Ready4Progress_first']);
      if (!r4p) return;   // skip – no LT start

      var lt = core.dur(r4p, resolved);
      if (!lt || lt <= 0) return;

      // Warte_JiraStories: dual-period for each waiting status
      var waiteJS  = 0;
      var breakdown = {};
      WAIT_STATUS.forEach(function(s) {
        var d = _dualPeriodDays(row, s);
        if (d > 0) {
          waiteJS += d;
          breakdown[s] = (breakdown[s] || 0) + d;
        }
      });

      // Warte_Zusatz: JiraBlockermanagement episodes NOT already in WAIT_STATUS
      var jid     = String(row['Jira-ID'] || '').trim();
      var sq      = String(row['Squad']   || '').trim();
      var entries = bMap[jid + '\u00a7' + sq] || bMapNS[jid] || [];
      var waiteZ  = 0;
      entries.forEach(function(ep) {
        var isKnown = WAIT_STATUS_LOWER.indexOf(ep.zustand.toLowerCase()) >= 0;
        if (!isKnown && ep.dauer > 0) {
          waiteZ += ep.dauer;
          var label = ep.zustand || 'Blockiert';
          breakdown[label] = (breakdown[label] || 0) + ep.dauer;
        }
      });

      var totalWait = waiteJS + waiteZ;

      // Edge case: waiting > LT → data error
      if (totalWait > lt) { errors++; return; }

      var fe = ((lt - totalWait) / lt) * 100;

      var mKey   = resolved.getFullYear() + '-' +
                   String(resolved.getMonth() + 1).padStart(2, '0');
      var mLabel = resolved.toLocaleDateString('de-DE', { month: 'short', year: '2-digit' });

      if (!monthly[mKey]) monthly[mKey] = { label: mLabel, fes: [], lts: [], bds: [] };
      monthly[mKey].fes.push(fe);
      monthly[mKey].lts.push(lt);
      monthly[mKey].bds.push(breakdown);
    });

    // Sort chronologically and aggregate
    _monthData = Object.keys(monthly).sort().map(function(k) {
      var m      = monthly[k];
      var sorted = m.fes.slice().sort(function(a, b) { return a - b; });
      var fe     = core.pct(sorted, 50) || 0;

      // Average breakdown
      var bdAgg = {};
      m.bds.forEach(function(bd) {
        Object.keys(bd).forEach(function(s) {
          bdAgg[s] = (bdAgg[s] || 0) + bd[s];
        });
      });
      Object.keys(bdAgg).forEach(function(s) {
        bdAgg[s] = bdAgg[s] / m.fes.length;
      });

      return {
        key:       k,
        label:     m.label,
        fe:        Math.round(fe * 10) / 10,
        items:     m.fes,
        n:         m.fes.length,
        ltAvg:     m.lts.reduce(function(a, b) { return a + b; }, 0) / m.lts.length,
        breakdown: bdAgg,
      };
    });

    _errors = errors;
    nBadge.textContent = 'N=' + _monthData.reduce(function(s, d) { return s + d.n; }, 0);
  }

  // ── KDE helpers ────────────────────────────────
  function _std(arr) {
    if (arr.length < 2) return 0;
    var m = arr.reduce(function(a, b) { return a + b; }, 0) / arr.length;
    return Math.sqrt(arr.reduce(function(s, v) { return s + (v - m) * (v - m); }, 0) / arr.length);
  }

  function _kde(vals) {
    if (vals.length < 2) return [];
    var bw   = Math.max(1.06 * _std(vals) * Math.pow(vals.length, -0.2), 4);
    var K    = Math.sqrt(2 * Math.PI);
    var pts  = [];
    for (var i = 0; i <= 60; i++) {
      var x = (i / 60) * 100;
      var d = 0;
      vals.forEach(function(v) { var z = (x - v) / bw; d += Math.exp(-0.5 * z * z); });
      pts.push({ x: x, d: d / (vals.length * bw * K) });
    }
    return pts;
  }

  // ── Chart render ───────────────────────────────
  function _renderChart() {
    var W  = contentEl.clientWidth  || 500;
    var H  = contentEl.clientHeight || 280;
    var P  = { t: 18, r: 56, b: 34, l: 40 };
    var cW = W - P.l - P.r;
    var cH = H - P.t - P.b;

    var data = _monthData;
    if (!data.length) {
      svg.innerHTML = '';
      diagEl.textContent = 'Keine Resolved Items im Zeitraum — Datei laden oder Filter anpassen';
      return;
    }

    var sc        = core.scatterColors();
    var lt        = core.isLight();
    var gridCol   = sc.gridLine;
    var axisCol   = sc.axisLabel;
    var tgtCol    = lt ? '#2563eb' : '#60a5fa';
    var greenCol  = lt ? '#16a34a' : '#4ade80';
    var redCol    = lt ? '#dc2626' : '#f87171';
    var bg2       = lt ? 'rgba(255,255,255,.9)' : 'var(--bg2)';

    function yS(v) { return P.t + cH - (v / 100) * cH; }
    function xS(i) { return P.l + (data.length < 2 ? cW / 2 : (i / (data.length - 1)) * cW); }
    var slotW = data.length > 1 ? cW / (data.length - 1) : cW;

    var parts = [];

    // Grid + Y-labels
    [0, 25, 50, 75, 100].forEach(function(v) {
      var y = yS(v);
      parts.push('<line x1="' + P.l + '" y1="' + y + '" x2="' + (P.l + cW) + '" y2="' + y + '"' +
        ' stroke="' + gridCol + '" stroke-width="' + (v === 0 ? 1 : 0.6) + '"' +
        ' stroke-dasharray="' + (v === 0 ? 'none' : '3,5') + '" opacity="' + (v === 0 ? 1 : 0.7) + '"/>');
      parts.push('<text x="' + (P.l - 5) + '" y="' + (y + 4) + '"' +
        ' text-anchor="end" font-size="10" fill="' + axisCol + '" font-family="var(--mono)">' + v + '%</text>');
    });

    // Target line
    if (cfg.showTarget) {
      var ty = yS(cfg.targetFE);
      parts.push('<line x1="' + P.l + '" y1="' + ty + '" x2="' + (P.l + cW) + '" y2="' + ty + '"' +
        ' stroke="' + tgtCol + '" stroke-width="1.5" stroke-dasharray="6,4" opacity=".75"/>');
      parts.push('<text x="' + (P.l + cW + 5) + '" y="' + (ty + 4) + '"' +
        ' font-size="10" fill="' + tgtCol + '" opacity=".9" font-family="var(--sans)">Ziel ' + cfg.targetFE + '%</text>');
    }

    // X-axis ticks + labels
    var step = Math.ceil(data.length / 12);
    data.forEach(function(d, i) {
      var x    = xS(i);
      var show = data.length <= 12 || i % step === 0 || i === data.length - 1;
      parts.push('<line x1="' + x + '" y1="' + (P.t + cH) + '" x2="' + x + '" y2="' + (P.t + cH + 4) + '"' +
        ' stroke="' + gridCol + '"/>');
      if (show) {
        parts.push('<text x="' + x + '" y="' + (P.t + cH + 18) + '"' +
          ' text-anchor="middle" font-size="10" fill="' + axisCol + '" font-family="var(--mono)">' + d.label + '</text>');
      }
    });

    if (cfg.mode === 'line') {
      // ── Line mode ──
      if (data.length > 1) {
        var pts = data.map(function(d, i) { return xS(i) + ',' + yS(d.fe); }).join(' ');
        parts.push('<polyline points="' + pts + '" fill="none" stroke="' + greenCol + '"' +
          ' stroke-width="1.8" stroke-linejoin="round" opacity=".65"/>');
      }
      data.forEach(function(d, i) {
        var x = xS(i), y = yS(d.fe);
        var c = (cfg.showTarget && d.fe < cfg.targetFE) ? redCol : greenCol;
        parts.push('<circle cx="' + x + '" cy="' + y + '" r="5" fill="' + c + '"' +
          ' stroke="' + bg2 + '" stroke-width="2" data-i="' + i + '" class="fe-pt" style="cursor:default"/>');
      });

    } else {
      // ── Violin mode ──
      var maxHW = Math.min(slotW * 0.38, 26);

      data.forEach(function(d, i) {
        var cx = xS(i);
        var c  = (cfg.showTarget && d.fe < cfg.targetFE) ? redCol : greenCol;

        if (d.items.length < 3) {
          parts.push('<circle cx="' + cx + '" cy="' + yS(d.fe) + '" r="5" fill="' + c + '"' +
            ' stroke="' + bg2 + '" stroke-width="2" data-i="' + i + '" class="fe-pt" style="cursor:default"/>');
          return;
        }

        var curve = _kde(d.items);
        var maxD  = 0;
        curve.forEach(function(p) { if (p.d > maxD) maxD = p.d; });
        if (!maxD) return;

        var L = curve.map(function(p) { return { x: cx - (p.d / maxD) * maxHW, y: yS(p.x) }; });
        var R = curve.slice().reverse().map(function(p) { return { x: cx + (p.d / maxD) * maxHW, y: yS(p.x) }; });
        var ph = L.concat(R).map(function(p, j) {
          return (j === 0 ? 'M' : 'L') + p.x.toFixed(1) + ',' + p.y.toFixed(1);
        }).join(' ') + 'Z';

        parts.push('<path d="' + ph + '" fill="' + c + '" opacity=".18"' +
          ' data-i="' + i + '" class="fe-pt" style="cursor:default"/>');
        parts.push('<path d="' + ph + '" fill="none" stroke="' + c + '" stroke-width="1.2" opacity=".55"' +
          ' data-i="' + i + '" class="fe-pt" style="cursor:default"/>');

        // IQR box
        var sorted = d.items.slice().sort(function(a, b) { return a - b; });
        var q1 = sorted[Math.floor(sorted.length * 0.25)];
        var q3 = sorted[Math.floor(sorted.length * 0.75)];
        var bh = Math.max(2, yS(q1) - yS(q3));
        var bw = maxHW * 0.2;
        parts.push('<rect x="' + (cx - bw) + '" y="' + yS(q3) + '"' +
          ' width="' + (bw * 2) + '" height="' + bh + '"' +
          ' fill="' + c + '" opacity=".45"' +
          ' data-i="' + i + '" class="fe-pt" style="cursor:default"/>');

        // Median dot
        var med  = core.pct(sorted, 50);
        var medC = (cfg.showTarget && med < cfg.targetFE) ? redCol : greenCol;
        parts.push('<circle cx="' + cx + '" cy="' + yS(med) + '" r="4" fill="' + medC + '"' +
          ' stroke="' + bg2 + '" stroke-width="2"' +
          ' data-i="' + i + '" class="fe-pt" style="cursor:default"/>');
      });
    }

    svg.innerHTML = parts.join('');

    // Hover events on SVG elements
    svg.querySelectorAll('.fe-pt').forEach(function(el) {
      el.addEventListener('mouseenter', function(e) { _showTT(e, data[+el.dataset.i]); });
      el.addEventListener('mousemove',  _moveTT);
      el.addEventListener('mouseleave', _hideTT);
    });

    // Diag
    var totalN = _monthData.reduce(function(s, d) { return s + d.n; }, 0);
    var hasBM  = (core.state.sheets['JiraBlockermanagement'] || []).length > 0;
    diagEl.textContent =
      totalN + ' Items · ' + data.length + ' Monate · ' + _errors + ' Datenfehler ausgeschlossen' +
      (!hasBM ? ' · JiraBlockermanagement fehlt – nur Status-Wartezeiten' : '');
  }

  // ── Tooltip ────────────────────────────────────
  function _showTT(e, d) {
    if (!d) return;
    var feColor = (cfg.showTarget && d.fe < cfg.targetFE)
      ? (core.isLight() ? '#dc2626' : '#f87171')
      : (core.isLight() ? '#16a34a' : '#4ade80');

    var bRows = Object.keys(d.breakdown)
      .sort(function(a, b) { return d.breakdown[b] - d.breakdown[a]; })
      .map(function(s) {
        var c = BREAKDOWN_COLORS[s] || 'var(--dim)';
        return '<div style="display:flex;align-items:center;gap:6px;margin-bottom:3px">' +
          '<span style="width:8px;height:8px;border-radius:50%;background:' + c +
          ';flex-shrink:0;display:inline-block"></span>' +
          '<span style="color:var(--dim);flex:1;font-size:11px">' + s + '</span>' +
          '<span style="font-weight:600;font-size:11px">' + d.breakdown[s].toFixed(1) + 'd</span>' +
          '</div>';
      }).join('');

    var violinExtra = '';
    if (cfg.mode === 'violin' && d.items.length >= 3) {
      var sorted = d.items.slice().sort(function(a, b) { return a - b; });
      var q1 = sorted[Math.floor(sorted.length * 0.25)];
      var q3 = sorted[Math.floor(sorted.length * 0.75)];
      violinExtra =
        '<div style="border-top:1px solid var(--border);margin:5px 0"></div>' +
        '<div style="display:flex;justify-content:space-between;gap:14px;margin-bottom:2px">' +
          '<span style="color:var(--dim)">Min / Max</span>' +
          '<span style="font-weight:600">' +
            Math.round(sorted[0]) + '% / ' + Math.round(sorted[sorted.length - 1]) + '%' +
          '</span></div>' +
        '<div style="display:flex;justify-content:space-between;gap:14px">' +
          '<span style="color:var(--dim)">IQR</span>' +
          '<span style="font-weight:600">' + Math.round(q1) + '% – ' + Math.round(q3) + '%</span>' +
        '</div>';
    }

    tt.innerHTML =
      '<div style="font-weight:700;font-size:13px;color:var(--text);margin-bottom:4px">' + d.label + '</div>' +
      '<div style="font-size:21px;font-weight:700;color:' + feColor + ';line-height:1.15">' + d.fe.toFixed(0) + '%</div>' +
      '<div style="font-size:10px;color:var(--dim);margin-bottom:6px">Flow Efficiency (Median, N=' + d.n + ')</div>' +
      '<div style="border-top:1px solid var(--border);margin:5px 0"></div>' +
      '<div style="display:flex;justify-content:space-between;gap:14px;margin-bottom:2px">' +
        '<span style="color:var(--dim)">Ø Lead Time</span>' +
        '<span style="font-weight:600">' + d.ltAvg.toFixed(1) + 'd</span></div>' +
      '<div style="display:flex;justify-content:space-between;gap:14px;margin-bottom:2px">' +
        '<span style="color:var(--dim)">Aktive Zeit</span>' +
        '<span style="font-weight:600">' + (d.ltAvg * d.fe / 100).toFixed(1) + 'd</span></div>' +
      '<div style="display:flex;justify-content:space-between;gap:14px">' +
        '<span style="color:var(--dim)">Wartezeit</span>' +
        '<span style="font-weight:600">' + (d.ltAvg * (1 - d.fe / 100)).toFixed(1) + 'd</span></div>' +
      violinExtra +
      (bRows
        ? '<div style="border-top:1px solid var(--border);margin:5px 0"></div>' +
          '<div style="font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:var(--dim);margin-bottom:4px">' +
          'Wartezeit-Breakdown</div>' + bRows
        : '');

    tt.style.display = 'block';
    _moveTT(e);
  }

  function _moveTT(e) {
    var tw = tt.offsetWidth, th = tt.offsetHeight;
    var vw = window.innerWidth, vh = window.innerHeight;
    var x  = e.clientX + 14, y = e.clientY - 10;
    if (x + tw > vw - 8) x = e.clientX - tw - 14;
    if (y + th > vh - 8) y = vh - th - 8;
    if (y < 8) y = 8;
    tt.style.left = x + 'px';
    tt.style.top  = y + 'px';
  }

  function _hideTT() { tt.style.display = 'none'; }

  // ── Main render ────────────────────────────────
  function render() {
    _compute();
    _renderChart();
    _updateModeToggle();
  }

  // ── Events ─────────────────────────────────────
  core.on('data',   render);
  core.on('theme',  render);
  core.on('filter', render);
  core.on('resize', _renderChart);
}
