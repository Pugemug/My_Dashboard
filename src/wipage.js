// ════════════════════════════════════════════════
// wipage.js  –  WIPAge Chart Visual
// Flow Analytics Dashboard v2.0
// Eigenständiges Visual – abonniert core-Events
// ════════════════════════════════════════════════

import { core, DEFAULT_STATUS_ORDER, mkBtn, mkPanel, buildOrderPanel } from './core.js';
import { calcAge, parseExcludeList } from './calc/wipage.calc.js';

export function init() {

  // ── 1. Lokaler Config-State ──────────────────
  const cfg = core.load('fhwa_wipage', {
    rollingDays:   90,
    statusAgeDays: 5,
    alertColor:    'var(--red)',
    dotSize:       4,
    showBands:     true,
    excludeList:   'Rejected, Resume',
  });

  // stateOrder: Runtime-only, nicht persistiert – kommt von core.loadGlobalStatusOrder()
  cfg.stateOrder = [];

  function saveConfig() {
    core.save('fhwa_wipage', {
      rollingDays:   cfg.rollingDays,
      statusAgeDays: cfg.statusAgeDays,
      alertColor:    cfg.alertColor,
      dotSize:       cfg.dotSize,
      showBands:     cfg.showBands,
      excludeList:   cfg.excludeList,
      // stateOrder wird NICHT persistiert – liegt in fhwa_status_order (global)
    });
  }

  // ── 2. Card anlegen ──────────────────────────
  const { cardEl, contentEl, headerExtraEl, diagEl } = core.createCard({
    id:          'wipage',
    title:       'WIP<span class="hl">Age</span>',
    defaultGrid: { col: 0, row: 0, w: 12, h: 10 },
  });

  // ── 3. Header-Controls ───────────────────────
  const btnSettings = mkBtn('⚙ Einstellungen', () => _togglePanel('wa-settings-panel'));
  const btnOrder    = mkBtn('↕ Reihenfolge',   () => _togglePanel('wa-order-panel'));
  headerExtraEl.appendChild(btnSettings);
  headerExtraEl.appendChild(btnOrder);

  // ── 4. Settings-Panel ────────────────────────
  const settingsPanel = mkPanel();
  settingsPanel.id = 'wa-settings-panel';

  const spTitle = document.createElement('div');
  spTitle.className = 'panel-title';
  spTitle.style.color = 'var(--blue)';
  spTitle.textContent = 'WIPAge Einstellungen';
  settingsPanel.appendChild(spTitle);

  const spGrid = document.createElement('div');
  spGrid.style.cssText = 'display:grid;grid-template-columns:auto 1fr;gap:.35rem .8rem;align-items:center;font-size:.7rem';
  settingsPanel.appendChild(spGrid);

  function _addLabeledInput(label, type, getValue, setValue, attrs) {
    const lbl = document.createElement('label');
    lbl.textContent = label;
    lbl.style.color = 'var(--dim)';

    const inp = document.createElement('input');
    inp.type = type;
    inp.value = getValue();
    inp.style.cssText = 'background:var(--bg3);border:1px solid var(--border);border-radius:5px;color:var(--text);padding:.2rem .4rem;font-size:.7rem;width:72px';
    if (attrs) Object.assign(inp, attrs);
    inp.addEventListener('change', () => { setValue(inp.value); saveConfig(); render(); });

    spGrid.appendChild(lbl);
    spGrid.appendChild(inp);
    return inp;
  }

  function _addCheckboxRow(label, getValue, setValue) {
    const lbl = document.createElement('label');
    lbl.textContent = label;
    lbl.style.color = 'var(--dim)';

    const inp = document.createElement('input');
    inp.type = 'checkbox';
    inp.checked = getValue();
    inp.addEventListener('change', () => { setValue(inp.checked); saveConfig(); render(); });

    spGrid.appendChild(lbl);
    spGrid.appendChild(inp);
    return inp;
  }

  _addLabeledInput('Rolling Tage',   'number', () => cfg.rollingDays,
    v => { cfg.rollingDays = Math.max(1, parseInt(v, 10) || 1); }, { min: 1, step: 1 });

  _addLabeledInput('Alert ab Tagen', 'number', () => cfg.statusAgeDays,
    v => { cfg.statusAgeDays = Math.max(0, parseInt(v, 10) || 0); }, { min: 0, step: 1 });

  _addLabeledInput('Dot-Größe',      'number', () => cfg.dotSize,
    v => { cfg.dotSize = Math.max(1, Math.min(12, parseInt(v, 10) || 4)); }, { min: 1, max: 12, step: 1 });

  _addCheckboxRow('Bänder zeigen', () => cfg.showBands, v => { cfg.showBands = v; });

  // Alert-Farbe (Color Picker)
  const acLbl = document.createElement('label');
  acLbl.textContent = 'Alert-Farbe';
  acLbl.style.color = 'var(--dim)';

  const acWrap = document.createElement('div');
  acWrap.style.cssText = 'display:flex;align-items:center;gap:.4rem';

  const acInp = document.createElement('input');
  acInp.type = 'color';
  // Default-Anzeige: var(--red) entspricht in Dark #f87171
  acInp.value = cfg.alertColor.startsWith('#') ? cfg.alertColor : '#f87171';
  acInp.style.cssText = 'width:30px;height:22px;border:none;background:none;cursor:pointer;padding:0;border-radius:4px';
  acInp.addEventListener('change', () => { cfg.alertColor = acInp.value; saveConfig(); render(); });

  const acReset = document.createElement('button');
  acReset.className = 'obtn';
  acReset.textContent = '↩';
  acReset.title = 'Auf Standard zurücksetzen (var(--red))';
  acReset.addEventListener('click', () => {
    cfg.alertColor = 'var(--red)';
    acInp.value = '#f87171';
    saveConfig(); render();
  });

  acWrap.appendChild(acInp);
  acWrap.appendChild(acReset);
  spGrid.appendChild(acLbl);
  spGrid.appendChild(acWrap);

  // Exclude-Liste
  const exLbl = document.createElement('label');
  exLbl.textContent = 'Ausblenden';
  exLbl.style.color = 'var(--dim)';

  const exInp = document.createElement('input');
  exInp.type = 'text';
  exInp.value = cfg.excludeList;
  exInp.placeholder = 'Status1, Status2';
  exInp.style.cssText = 'background:var(--bg3);border:1px solid var(--border);border-radius:5px;color:var(--text);padding:.2rem .4rem;font-size:.7rem;width:140px';
  exInp.addEventListener('change', () => { cfg.excludeList = exInp.value; saveConfig(); render(); });
  spGrid.appendChild(exLbl);
  spGrid.appendChild(exInp);

  cardEl.insertBefore(settingsPanel, contentEl);

  // ── 5. Order-Panel (exakt wie heatmap.js) ────
  const orderPanel = mkPanel();
  orderPanel.id = 'wa-order-panel';

  const orTitle = document.createElement('div');
  orTitle.className = 'panel-title';
  orTitle.style.color = 'var(--yellow)';

  const orTitleText = document.createElement('span');
  orTitleText.textContent = 'Status-Reihenfolge ';

  const orTitleHint = document.createElement('span');
  orTitleHint.style.cssText = 'font-size:.56rem;color:var(--dimmer);font-weight:400;text-transform:none;letter-spacing:0';
  orTitleHint.textContent = '↔ ziehen oder ▲▼';

  orTitle.appendChild(orTitleText);
  orTitle.appendChild(orTitleHint);

  const orderList = document.createElement('div');
  orderList.className = 'order-list';

  orderPanel.appendChild(orTitle);
  orderPanel.appendChild(orderList);
  cardEl.insertBefore(orderPanel, contentEl);

  // ── Panel-Toggle ─────────────────────────────
  const PANELS    = ['wa-settings-panel', 'wa-order-panel'];
  const panelEls  = { 'wa-settings-panel': settingsPanel, 'wa-order-panel': orderPanel };
  const panelBtns = { 'wa-settings-panel': btnSettings,   'wa-order-panel': btnOrder   };
  const panelClrs = { 'wa-settings-panel': 'p-blue',       'wa-order-panel': 'p-yellow' };

  function _togglePanel(id) {
    PANELS.forEach(pid => {
      const open = pid === id ? !panelEls[pid].classList.contains('open') : false;
      panelEls[pid].classList.toggle('open', open);
      panelBtns[pid].className = 'btn-icon' + (open ? ' ' + panelClrs[pid] : '');
    });
  }

  // ── 6. Tooltip ───────────────────────────────
  const tooltip = document.createElement('div');
  tooltip.style.cssText = [
    'position:fixed',
    'display:none',
    'background:var(--bg2)',
    'border:1px solid var(--border)',
    'border-radius:9px',
    'padding:.5rem .65rem',
    'font-family:var(--mono)',
    'font-size:.64rem',
    'color:var(--text)',
    'z-index:2000',
    'box-shadow:0 12px 32px rgba(0,0,0,.5)',
    'min-width:164px',
    'pointer-events:none',
  ].join(';');
  document.body.appendChild(tooltip);

  let _hideTimer = null;
  function _showTt() { if (_hideTimer) { clearTimeout(_hideTimer); _hideTimer = null; } }
  function _hideTt() { _hideTimer = setTimeout(() => { tooltip.style.display = 'none'; }, 500); }
  tooltip.addEventListener('mouseenter', _showTt);
  tooltip.addEventListener('mouseleave', _hideTt);

  // ── 7. SVG-Container ─────────────────────────
  const svgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svgEl.style.cssText = 'width:100%;height:100%;display:block';
  contentEl.style.overflow = 'hidden';
  contentEl.appendChild(svgEl);

  // ── 8. Order-Panel-Logik ─────────────────────
  function _updateOrderPanel() {
    buildOrderPanel(
      orderList,
      cfg.stateOrder,
      arr => { cfg.stateOrder = arr; core.saveGlobalStatusOrder(arr); _updateOrderPanel(); render(); },
    );
  }

  // ── 9. Render ─────────────────────────────────
  function render() {
    svgEl.innerHTML = '';

    if (!core.state.rows.length) {
      diagEl.textContent = '— keine Daten —';
      _renderMsg('Keine Daten', 'Excel-Datei laden');
      return;
    }

    const W = contentEl.clientWidth  || 600;
    const H = contentEl.clientHeight || 400;
    const MAR = { top: 28, right: 24, bottom: 60, left: 50 };
    const pW  = W - MAR.left - MAR.right;
    const pH  = H - MAR.top  - MAR.bottom;

    if (pW < 30 || pH < 30) return;

    const today    = new Date(); today.setHours(0, 0, 0, 0);
    const today_ms = today.getTime();
    const C        = core.scatterColors();

    // ── Aktive Items filtern ──────────────────
    // Aktiv = In Progress_first gefüllt UND weder Resolved noch Rejected gefüllt
    // Zeitraumfilter: nach Startdatum (In Progress_first), nicht nach Abschlussdatum
    let baseRows = core.state.rows;
    const sf = core.state.squadFilter;
    const itf = core.state.issueTypeFilter;
    if (sf.length)  baseRows = baseRows.filter(r => sf.includes(String(r['Squad'] || '')));
    if (itf.length) baseRows = baseRows.filter(r => itf.includes(String(r['Issue-Type'] || '')));
    const drActive = core.state.dateRangeMode !== 'all' && core.state.dateRangeFrom && core.state.dateRangeTo;
    const drFrom   = core.state.dateRangeFrom;
    const drTo     = core.state.dateRangeTo;
    const activeRows = baseRows.filter(r => {
      const ip       = core.toDate(r['In Progress_first']);
      const resolved = core.toDate(r['Resolved']);
      const rejected = core.toDate(r['Rejected']);
      if (ip == null || resolved != null || rejected != null) return false;
      if (drActive) return ip >= drFrom && ip <= drTo;
      return true;
    });

    // ── Exclude-Liste ─────────────────────────
    const excluded = cfg.excludeList
      ? parseExcludeList(cfg.excludeList).map(s => s.toLowerCase())
      : [];

    // ── stateOrder: Globale Reihenfolge laden + mit gefundenen Status abgleichen ──
    const foundStatuses = [];
    activeRows.forEach(r => {
      const s = String(r['Issue-Status'] || '').trim();
      if (s && !foundStatuses.includes(s)) foundStatuses.push(s);
    });

    cfg.stateOrder = core.loadGlobalStatusOrder(foundStatuses);
    _updateOrderPanel();

    const visibleStatuses = cfg.stateOrder.filter(n =>
      !excluded.includes(n.toLowerCase())
    );

    if (!visibleStatuses.length) {
      diagEl.textContent = activeRows.length + ' aktive Items – keine sichtbaren Status';
      _renderMsg('Keine aktiven Items', 'Keine WIP-Items oder alle Status ausgeblendet');
      return;
    }

    // ── Items nach Status gruppieren + Alter berechnen ──
    // Altersberechnung mit _first-Logik:
    //   X_first == X (gleicher Tag) → age = heute − X
    //   X_first != X               → age = (leaving_X_first − X_first) + (heute − X)
    const allStatusGroups = visibleStatuses.map(statusName => {
      const items = activeRows
        .filter(r => String(r['Issue-Status'] || '').trim() === statusName)
        .map(r => ({
          key: String(r['Jira-ID'] || ''),
          age: calcAge(r, statusName, today_ms),
          url: _resolveUrl(r),
        }))
        .filter(d => d.age != null);
      return { statusName, items };
    });

    // ── N=0 Hiding: Spalten ohne aktive Items ausblenden ──
    const statusGroups = allStatusGroups.filter(g => g.items.length > 0);

    // ── Effektiv sichtbare Status (nach N=0-Filter) ──
    const renderedStatuses = statusGroups.map(g => g.statusName);

    if (!renderedStatuses.length) {
      diagEl.textContent = activeRows.length + ' aktive Items – alle Spalten haben n=0';
      _renderMsg('Keine sichtbaren Spalten', 'Alle Status haben 0 aktive Items');
      return;
    }

    const cutoff_ms = today_ms - cfg.rollingDays * 86400000;
    const completedRows = baseRows.filter(r => {
      const res = core.toDate(r['Resolved']);
      return res != null && res.getTime() >= cutoff_ms;
    });

    const pace = {}; // statusName → { p25, p50, p85, p90, n } | null
    renderedStatuses.forEach(sName => {
      const durations = completedRows
        .map(r => {
          const entryFirst   = core.toDate(r[sName + '_first']);
          const entryReg     = core.toDate(r[sName]);
          const leavingFirst = core.toDate(r['leaving_' + sName + '_first']);
          const leavingReg   = core.toDate(r['leaving_' + sName]);

          // Dual-Period-Logik: gleich wie Altersberechnung aber mit exit-Datum
          if (entryReg != null && leavingReg != null) {
            const hasTwoPeriods = entryFirst != null
              && leavingFirst != null
              && Math.abs(entryFirst.getTime() - entryReg.getTime()) > 86400000 / 2;

            if (hasTwoPeriods) {
              const d1 = Math.max(0, Math.round(
                (leavingFirst.getTime() - entryFirst.getTime()) / 86400000
              ) + 1);
              const d2 = Math.max(0, Math.round(
                (leavingReg.getTime() - entryReg.getTime()) / 86400000
              ) + 1);
              return d1 + d2;
            } else {
              return Math.max(0, Math.round(
                (leavingReg.getTime() - entryReg.getTime()) / 86400000
              ) + 1);
            }
          }
          // Nur _first vorhanden
          if (entryFirst != null && leavingFirst != null) {
            return Math.max(0, Math.round(
              (leavingFirst.getTime() - entryFirst.getTime()) / 86400000
            ) + 1);
          }
          return null;
        })
        .filter(d => d != null && d > 0);

      if (durations.length) {
        durations.sort((a, b) => a - b);
        pace[sName] = {
          p25: core.pct(durations, 25),
          p50: core.pct(durations, 50),
          p85: core.pct(durations, 85),
          p90: core.pct(durations, 90),
          n:   durations.length,
        };
      } else {
        pace[sName] = null;
      }
    });

    // ── Y-Skala ───────────────────────────────
    let maxAge = 1;
    statusGroups.forEach(g => g.items.forEach(d => { if (d.age > maxAge) maxAge = d.age; }));
    renderedStatuses.forEach(s => {
      const p = pace[s];
      if (p && p.p90 != null && p.p90 > maxAge) maxAge = p.p90;
    });
    maxAge = Math.ceil(maxAge * 1.12);

    function yScale(v) { return MAR.top + pH - (v / maxAge) * pH; }

    // ── X-Skala (Band) ────────────────────────
    const nCols = renderedStatuses.length;
    const colW  = pW / nCols;
    function xMid(i) { return MAR.left + colW * i + colW / 2; }

    // ── Dot-Radius (scatter.js-Muster) ────────
    const r = Math.max(3, Math.min(8, pW / 100)) * (cfg.dotSize / 4);

    // ── SVG-Teile aufbauen ────────────────────
    const parts = [];

    // Y-Achsen-Raster + Labels
    const yTicks = _niceYTicks(maxAge, 5);
    yTicks.forEach(v => {
      const y = yScale(v);
      parts.push(`<line x1="${MAR.left}" y1="${y.toFixed(1)}" x2="${MAR.left + pW}" y2="${y.toFixed(1)}" stroke="${C.gridLine}" stroke-width="1" stroke-dasharray="3,3"/>`);
      parts.push(`<text x="${MAR.left - 7}" y="${(y + 4).toFixed(1)}" text-anchor="end" font-size="10" font-family="var(--mono)" fill="${C.axisLabel}">${v}</text>`);
    });

    // Y-Achsen-Titel
    const yLabelX  = 13;
    const yLabelY  = MAR.top + pH / 2;
    parts.push(`<text x="${yLabelX}" y="${yLabelY}" text-anchor="middle" font-size="10" font-family="var(--mono)" fill="${C.axisLabel}" transform="rotate(-90,${yLabelX},${yLabelY})">Alter (Tage)</text>`);

    // ── Pro Status-Spalte ─────────────────────
    statusGroups.forEach(({ statusName, items }, i) => {
      const cx = xMid(i);
      const x0 = MAR.left + colW * i + 6;
      const x1 = MAR.left + colW * (i + 1) - 6;

      // Spalten-Trenner
      if (i > 0) {
        parts.push(`<line x1="${(MAR.left + colW * i).toFixed(1)}" y1="${MAR.top}" x2="${(MAR.left + colW * i).toFixed(1)}" y2="${(MAR.top + pH).toFixed(1)}" stroke="${C.gridLine}" stroke-width="1"/>`);
      }

      // Perzentil-Bänder: Farbflächen + Linien (grün → rot)
      if (cfg.showBands && pace[statusName]) {
        const p = pace[statusName];

        // Flächen zeichnen: 5 Zonen von 0 → P25 → P50 → P85 → P90 → oben
        const ZONE_FILLS = [
          'rgba(100,185,100,0.10)',  // 0 → P25: grün
          'rgba(180,210, 80,0.10)',  // P25 → P50: gelbgrün
          'rgba(230,180, 40,0.10)',  // P50 → P85: gelb/orange
          'rgba(220,100, 40,0.12)',  // P85 → P90: orange-rot
          'rgba(210, 50, 50,0.10)',  // P90 → oben: rot
        ];
        const zoneEdges = [0, p.p25, p.p50, p.p85, p.p90, maxAge];
        for (let zi = 0; zi < zoneEdges.length - 1; zi++) {
          const lo = zoneEdges[zi];
          const hi = zoneEdges[zi + 1];
          if (lo == null || hi == null || hi <= lo) continue;
          const yTop = yScale(hi).toFixed(1);
          const yBot = yScale(lo).toFixed(1);
          const rectH = (parseFloat(yBot) - parseFloat(yTop));
          if (rectH < 0.5) continue;
          parts.push(
            `<rect x="${x0.toFixed(1)}" y="${yTop}" width="${(x1 - x0).toFixed(1)}" height="${rectH.toFixed(1)}"` +
            ` fill="${ZONE_FILLS[zi]}" />`
          );
        }

        // Linien + Labels für P25, P50, P85, P90
        const LINES = [
          { val: p.p25, color: '#64B964', label: 'P25' },
          { val: p.p50, color: '#A8C034', label: 'P50' },
          { val: p.p85, color: '#E68C3C', label: 'P85' },
          { val: p.p90, color: '#E84040', label: 'P90' },
        ];
        LINES.forEach(({ val, color, label }) => {
          if (val == null) return;
          const y = yScale(val).toFixed(1);
          parts.push(
            `<line x1="${x0.toFixed(1)}" y1="${y}" x2="${x1.toFixed(1)}" y2="${y}"` +
            ` stroke="${color}" stroke-width="1.5" stroke-dasharray="4,3" opacity="0.9"/>`
          );
          parts.push(
            `<text x="${(x1 + 2).toFixed(1)}" y="${(parseFloat(y) + 3).toFixed(1)}"` +
            ` font-size="8" font-family="var(--mono)" fill="${color}" opacity="0.9">${label}</text>`
          );
        });
      }

      // X-Achse: Status-Label
      const isExtra   = !DEFAULT_STATUS_ORDER.includes(statusName);
      const labelColor = isExtra ? 'var(--orange)' : C.axisLabel;
      const labelTxt = statusName.length > 14 ? statusName.slice(0, 13) + '…' : statusName;
      const labelY   = MAR.top + pH + 18;
      parts.push(`<text x="${cx.toFixed(1)}" y="${labelY}" text-anchor="middle" font-size="11" font-family="var(--mono)" fill="${labelColor}">${_escAttr(labelTxt)}</text>`);
      if (isExtra) {
        // Kleines "★" über dem Label als visueller Hinweis
        parts.push(`<text x="${cx.toFixed(1)}" y="${labelY - 1}" text-anchor="middle" font-size="7" font-family="var(--mono)" fill="var(--orange)" opacity="0.6">▲</text>`);
      }

      // N-Anzeige
      parts.push(`<text x="${cx.toFixed(1)}" y="${labelY + 14}" text-anchor="middle" font-size="9" font-family="var(--mono)" fill="${C.axisLabel}" opacity="0.6">n=${items.length}</text>`);
    });

    // X-Achsen-Linie
    parts.push(`<line x1="${MAR.left}" y1="${(MAR.top + pH).toFixed(1)}" x2="${(MAR.left + pW).toFixed(1)}" y2="${(MAR.top + pH).toFixed(1)}" stroke="${C.axisLine || C.gridLine}" stroke-width="1.5"/>`);
    // Y-Achsen-Linie
    parts.push(`<line x1="${MAR.left}" y1="${MAR.top}" x2="${MAR.left}" y2="${(MAR.top + pH).toFixed(1)}" stroke="${C.axisLine || C.gridLine}" stroke-width="1.5"/>`);

    // ── Dots (zuletzt = oben) ─────────────────
    statusGroups.forEach(({ statusName, items }, i) => {
      const cx = xMid(i);
      const jitterRange = Math.min(colW * 0.35, 18);

      items.forEach((d, j) => {
        const jitter = items.length > 1
          ? ((j / (items.length - 1)) * 2 - 1) * jitterRange
          : 0;
        const x   = (cx + jitter).toFixed(1);
        const y   = yScale(d.age).toFixed(1);
        const isAlert = d.age >= cfg.statusAgeDays;
        const fill    = isAlert ? cfg.alertColor : 'var(--blue)';
        const stroke  = C.dotStroke || 'rgba(0,0,0,0.3)';
        const cursor  = d.url ? 'pointer' : 'default';

        const p = pace[statusName];
        parts.push(
          `<circle class="wa-dot"` +
          ` cx="${x}" cy="${y}" r="${r.toFixed(1)}"` +
          ` fill="${fill}" stroke="${stroke}" stroke-width="1.5" opacity="0.93"` +
          ` cursor="${cursor}"` +
          ` data-key="${_escAttr(d.key)}"` +
          ` data-status="${_escAttr(statusName)}"` +
          ` data-age="${d.age}"` +
          ` data-url="${_escAttr(d.url)}"` +
          ` data-alert="${isAlert ? '1' : '0'}"` +
          ` data-p25="${p ? (p.p25 != null ? p.p25 : '') : ''}"` +
          ` data-p50="${p ? (p.p50 != null ? p.p50 : '') : ''}"` +
          ` data-p85="${p ? (p.p85 != null ? p.p85 : '') : ''}"` +
          ` data-p90="${p ? (p.p90 != null ? p.p90 : '') : ''}"` +
          ` data-pn="${p ? p.n : 0}"` +
          `/>`
        );
      });
    });

    // SVG setzen
    svgEl.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svgEl.innerHTML = parts.join('');

    // ── Dot-Event-Listener ────────────────────
    svgEl.querySelectorAll('.wa-dot').forEach(dot => {
      dot.addEventListener('mouseover', e => {
        _showTt();
        const d = dot.dataset;
        const p25 = d.p25 !== '' ? parseFloat(d.p25) : null;
        const p50 = d.p50 !== '' ? parseFloat(d.p50) : null;
        const p85 = d.p85 !== '' ? parseFloat(d.p85) : null;
        const p90 = d.p90 !== '' ? parseFloat(d.p90) : null;
        _buildTooltip(d.key, d.status, parseInt(d.age, 10), d.url, p25, p50, p85, p90, parseInt(d.pn, 10));
        tooltip.style.display  = 'block';
        tooltip.style.pointerEvents = d.url ? 'all' : 'none';
        _posTooltip(e.clientX, e.clientY);
      });
      dot.addEventListener('mousemove', e => { _showTt(); _posTooltip(e.clientX, e.clientY); });
      dot.addEventListener('mouseout',  () => _hideTt());
    });

    // ── Diag-Bar ──────────────────────────────
    const totalWip  = statusGroups.reduce((s, g) => s + g.items.length, 0);
    const paceCount = renderedStatuses.filter(s => pace[s] != null).length;
    diagEl.textContent =
      `${totalWip} WIP-Items · ${renderedStatuses.length} Status (${allStatusGroups.length - renderedStatuses.length} leer ausgeblendet) · ` +
      `Rolling Pace: ${paceCount}/${renderedStatuses.length} mit Daten (${cfg.rollingDays}d) · ` +
      `Alert ab ${cfg.statusAgeDays}d`;
  }

  // ── Tooltip aufbauen ──────────────────────────
  function _buildTooltip(key, status, age, url, p25, p50, p85, p90, pn) {
    while (tooltip.firstChild) tooltip.removeChild(tooltip.firstChild);

    const title = document.createElement('div');
    title.style.cssText = 'font-weight:700;font-size:.68rem;margin-bottom:.35rem;color:var(--text);word-break:break-all';
    title.textContent = key || '–';
    tooltip.appendChild(title);

    const isAlert = age >= cfg.statusAgeDays;
    const ageColor = isAlert
      ? (cfg.alertColor.startsWith('#') ? cfg.alertColor : 'var(--red)')
      : 'var(--text)';

    _appendRow('Status',          status || '–');
    _appendRow('Alter im Status', age + 'd', ageColor);

    if (p25 != null || p50 != null || p85 != null || p90 != null) {
      const sep = document.createElement('div');
      sep.style.cssText = 'border-top:1px solid var(--border);margin:5px 0 3px';
      tooltip.appendChild(sep);
      if (p25 != null) _appendRow('P25 (Pace)', p25.toFixed(1) + 'd', '#64B964');
      if (p50 != null) _appendRow('P50 (Pace)', p50.toFixed(1) + 'd', '#A8C034');
      if (p85 != null) _appendRow('P85 (Pace)', p85.toFixed(1) + 'd', '#E68C3C');
      if (p90 != null) _appendRow('P90 (Pace)', p90.toFixed(1) + 'd', '#E84040');
      if (pn)          _appendRow('Basis n', pn + ' abgeschlossen', null, true);
    }

    if (url) {
      const sep2 = document.createElement('div');
      sep2.style.cssText = 'border-top:1px solid var(--border);margin:5px 0 4px';
      tooltip.appendChild(sep2);

      const link = document.createElement('div');
      link.style.cssText = 'color:var(--blue);cursor:pointer;font-size:.64rem;padding:.1rem 0';
      link.textContent = '🔗 Issue öffnen';
      link.addEventListener('click', () => window.open(url, '_blank'));
      tooltip.appendChild(link);
    }
  }

  function _appendRow(label, val, valColor, dim) {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;justify-content:space-between;gap:.8rem;line-height:1.55';

    const lb = document.createElement('span');
    lb.style.color = 'var(--dim)';
    lb.textContent = label;

    const vl = document.createElement('span');
    vl.style.color = valColor || (dim ? 'var(--dimmer)' : 'var(--text)');
    vl.textContent = val;

    row.appendChild(lb);
    row.appendChild(vl);
    tooltip.appendChild(row);
  }

  function _posTooltip(cx, cy) {
    const tw = tooltip.offsetWidth  || 180;
    const th = tooltip.offsetHeight || 140;
    let l = cx + 8, t = cy + 8;
    if (l + tw > window.innerWidth  - 6) l = cx - tw - 8;
    if (l < 6) l = 6;
    if (t + th > window.innerHeight - 6) t = cy - th - 8;
    if (t < 6) t = 6;
    tooltip.style.left = l + 'px';
    tooltip.style.top  = t + 'px';
  }

  // ── Hilfsfunktionen ──────────────────────────
  function _resolveUrl(row) {
    const tmpl = core.state.urlTemplate || '';
    if (!tmpl) return '';
    const key = String(row['Jira-ID'] || '');
    if (!key) return '';
    return tmpl.replace(/\{issueKey\}/g, encodeURIComponent(key));
  }

  function _escAttr(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function _niceYTicks(max, count) {
    if (max <= 0) return [0];
    const raw  = max / count;
    const mag  = Math.pow(10, Math.floor(Math.log10(raw || 1)));
    const nice = [1, 2, 5, 10].map(f => f * mag).find(f => f >= raw) || mag * 10;
    const ticks = [];
    for (let v = 0; v <= max; v += nice) ticks.push(Math.round(v));
    return ticks;
  }

  function _renderMsg(title, msg) {
    const W  = contentEl.clientWidth  || 300;
    const H  = contentEl.clientHeight || 200;
    svgEl.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svgEl.innerHTML =
      `<text x="${W/2}" y="${H/2 - 10}" text-anchor="middle" font-size="14" font-family="var(--mono)" fill="var(--dim)">${_escAttr(title)}</text>` +
      `<text x="${W/2}" y="${H/2 + 10}" text-anchor="middle" font-size="11" font-family="var(--mono)" fill="var(--dimmer)">${_escAttr(msg)}</text>`;
  }

  // ── 10. Events abonnieren ─────────────────────
  core.on('data', () => {
    _updateOrderPanel();
    render();
  });

  core.on('theme',       () => render());
  core.on('filter',      () => render());
  core.on('resize',      () => render());
  core.on('settings',    () => render());
  core.on('statusOrder', () => {
    // Globale Reihenfolge sofort übernehmen, DANN Panel + Render
    const allKnown = (core.state.rows || [])
      .map(r => String(r['Issue-Status'] || '').trim())
      .filter((v, i, a) => v && a.indexOf(v) === i);  // dedup – indexOf korrekt hier
    cfg.stateOrder = core.loadGlobalStatusOrder(allKnown);
    _updateOrderPanel();
    render();
  });
}

// DOM helpers werden von core.js importiert (P3.7)
