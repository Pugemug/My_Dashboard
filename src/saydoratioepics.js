import { core, escHtml } from './core.js';

export function init() {

  // ── Config ──────────────────────────────────────────────────────────────────
  const DEFAULT_CFG = {
    colorResolved: '#4ade80',
    colorRejected: '#fb923c',
    colorUncalled: '#c084fc',
    colorOpen:     '#8ba8c8',
  };
  const cfg = core.load('fhwa_saydoratioepics', { ...DEFAULT_CFG });

  // ── Tile ────────────────────────────────────────────────────────────────────
  const { contentEl, headerExtraEl, diagEl } = core.createTile({
    id:    'saydoratioepics',
    title: 'Say Do Ratio <span class="hl">Epics</span>',
  });

  contentEl.style.cssText = 'position:relative;overflow:hidden;display:flex;flex-direction:column;';

  // ── Erklärungs-Panel (ausklappbar) ──────────────────────────────────────────
  let showExp = false;
  const expEl = document.createElement('div');
  expEl.style.cssText = [
    'overflow:hidden', 'max-height:0', 'flex-shrink:0',
    'transition:max-height .22s ease',
    'background:var(--bg3)', 'border-bottom:1px solid var(--border)',
    'font-size:11px', 'color:var(--dim)', 'line-height:1.55',
  ].join(';');
  expEl.innerHTML =
    '<div style="padding:7px 14px">' +
    'Zeigt die aktuelle und die 3 vorherigen Etappen mit committeten Epics nach Abschlussstatus. ' +
    'Die <b style="color:var(--text)">Say Do Ratio</b> (SDR) = Resolved ÷ Gesamt pro Etappe.' +
    '</div>';
  contentEl.appendChild(expEl);

  // ── SVG-Wrapper ──────────────────────────────────────────────────────────────
  const svgWrap = document.createElement('div');
  svgWrap.style.cssText = 'flex:1;min-height:0;position:relative;overflow:hidden;';
  contentEl.appendChild(svgWrap);

  // ── Tooltip ──────────────────────────────────────────────────────────────────
  const tooltip = document.createElement('div');
  tooltip.style.cssText = [
    'position:absolute', 'display:none', 'background:var(--bg2)',
    'border:1px solid var(--border)', 'border-radius:6px',
    'padding:8px 12px', 'font-size:12px', 'color:var(--text)',
    'pointer-events:none', 'z-index:100', 'white-space:nowrap', 'line-height:1.7',
  ].join(';');
  contentEl.appendChild(tooltip);

  // ── Einstellungs-Panel ───────────────────────────────────────────────────────
  const panel = document.createElement('div');
  panel.style.cssText = [
    'display:none', 'position:absolute', 'top:4px', 'right:4px',
    'background:var(--bg2)', 'border:1px solid var(--border)',
    'border-radius:8px', 'padding:12px 14px', 'z-index:50',
    'min-width:190px', 'font-size:12px', 'color:var(--text)',
    'box-shadow:0 4px 16px rgba(0,0,0,.35)',
  ].join(';');
  contentEl.appendChild(panel);

  function _buildPanel() {
    panel.innerHTML = '';
    const title = document.createElement('div');
    title.style.cssText = 'font-weight:600;margin-bottom:10px;font-size:12px;';
    title.textContent = 'Farben';
    panel.appendChild(title);

    [
      { key: 'colorResolved', label: 'Resolved' },
      { key: 'colorRejected', label: 'Rejected' },
      { key: 'colorUncalled', label: 'UNCALLED' },
      { key: 'colorOpen',     label: 'Offen (Füllung)' },
    ].forEach(({ key, label }) => {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:7px;';
      const lbl = document.createElement('label');
      lbl.style.cssText = 'flex:1;color:var(--dim);font-size:11px;';
      lbl.textContent = label;
      const inp = document.createElement('input');
      inp.type = 'color';
      inp.value = _safeColor(cfg[key], DEFAULT_CFG[key]);
      inp.style.cssText = 'width:32px;height:22px;border:none;background:none;cursor:pointer;padding:0;border-radius:4px;';
      inp.addEventListener('input', () => {
        cfg[key] = inp.value;
        core.save('fhwa_saydoratioepics', cfg);
        render();
      });
      row.appendChild(lbl);
      row.appendChild(inp);
      panel.appendChild(row);
    });

    const resetBtn = document.createElement('button');
    resetBtn.className = 'btn-icon';
    resetBtn.style.cssText = 'width:100%;margin-top:4px;font-size:11px;';
    resetBtn.textContent = 'Zurücksetzen';
    resetBtn.onclick = () => {
      Object.assign(cfg, DEFAULT_CFG);
      core.save('fhwa_saydoratioepics', cfg);
      _buildPanel();
      render();
    };
    panel.appendChild(resetBtn);
  }
  _buildPanel();

  // ── Header-Controls ──────────────────────────────────────────────────────────
  const nBadge = document.createElement('span');
  nBadge.style.cssText = 'font-size:11px;color:var(--dim);font-family:var(--mono);white-space:nowrap;';
  headerExtraEl.appendChild(nBadge);

  const settingsBtn = document.createElement('button');
  settingsBtn.className = 'btn-icon';
  settingsBtn.textContent = '⚙';
  settingsBtn.title = 'Einstellungen';
  settingsBtn.onclick = () => {
    const vis = panel.style.display !== 'none';
    panel.style.display = vis ? 'none' : 'block';
    if (!vis) _buildPanel();
  };
  headerExtraEl.appendChild(settingsBtn);

  // Panel schließen bei Klick außerhalb
  document.addEventListener('click', e => {
    if (panel.style.display !== 'none' && !panel.contains(e.target) && e.target !== settingsBtn) {
      panel.style.display = 'none';
    }
  }, true);

  // ── Diag-Bar ─────────────────────────────────────────────────────────────────
  diagEl.style.cssText = 'display:flex;align-items:center;gap:8px;overflow:hidden;';
  const diagLink = document.createElement('a');
  diagLink.style.cssText = 'font-size:11px;color:var(--blue);white-space:nowrap;flex-shrink:0;cursor:pointer;text-decoration:none;user-select:none;';
  diagLink.textContent = 'Was zeigt diese Ansicht?';
  diagLink.onclick = () => {
    showExp = !showExp;
    expEl.style.maxHeight = showExp ? '60px' : '0';
  };
  const diagStats = document.createElement('span');
  diagStats.style.cssText = 'font-size:11px;color:var(--dim);white-space:nowrap;flex:1;text-align:center;overflow:hidden;text-overflow:ellipsis;';
  diagEl.appendChild(diagLink);
  diagEl.appendChild(diagStats);

  // ── Helpers ───────────────────────────────────────────────────────────────────

  function _safeColor(c, fallback) {
    if (!c) return fallback;
    if (/^#[0-9a-fA-F]{3,8}$/.test(c)) return c;
    if (/^rgba?\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+/.test(c)) return c;
    return fallback;
  }

  function _hexToRgba(hex, alpha) {
    const h = _safeColor(hex, '#8ba8c8');
    if (!h.startsWith('#') || h.length < 7) return `rgba(139,168,200,${alpha})`;
    const r = parseInt(h.slice(1, 3), 16);
    const g = parseInt(h.slice(3, 5), 16);
    const b = parseInt(h.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  function _inRange(dateVal, start, end) {
    const d = core.toDate(dateVal);
    const s = core.toDate(start);
    const e = core.toDate(end);
    if (!d || !s || !e) return false;
    return d >= s && d <= e;
  }

  function _fmt2(d) {
    if (!d) return '–';
    return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  function positionTooltip(mx, my) {
    const ttW = tooltip.offsetWidth  || 220;
    const ttH = tooltip.offsetHeight || 130;
    const cW  = contentEl.clientWidth;
    const cH  = contentEl.clientHeight;
    let left = mx + 12;
    if (left + ttW > cW) left = mx - ttW - 12;
    if (left < 0) left = 0;
    let top = my + 12;
    if (top + ttH > cH) top = my - ttH - 12;
    if (top < 0) top = 0;
    tooltip.style.left = left + 'px';
    tooltip.style.top  = top  + 'px';
  }

  // ── Render-State ─────────────────────────────────────────────────────────────
  let currentData = [];

  // ── Render ───────────────────────────────────────────────────────────────────
  function render() {
    svgWrap.innerHTML = '';
    tooltip.style.display = 'none';

    const epics   = (core.state.sheets && core.state.sheets['JiraEpics'])   ?? [];
    const etappen = (core.state.sheets && core.state.sheets['BRP Etappen']) ?? [];

    if (!epics.length) {
      nBadge.textContent = '';
      diagStats.textContent = 'JiraEpics-Sheet nicht gefunden';
      currentData = [];
      return;
    }
    if (!etappen.length) {
      nBadge.textContent = '';
      diagStats.textContent = 'BRP Etappen-Sheet nicht gefunden';
      currentData = [];
      return;
    }

    // Squad-Filter
    const activeSquads = core.state.squadFilter ?? [];
    const filteredEpics = activeSquads.length
      ? epics.filter(r => activeSquads.includes(r['Squad']))
      : epics;

    // Alle Etappen chronologisch sortiert (nur mit gültigem Start- und Endedatum)
    const allEtappen = etappen
      .filter(e => e['Etappe'] && core.toDate(e['Startdatum']) && core.toDate(e['Endedatum']))
      .slice()
      .sort((a, b) => core.toDate(a['Startdatum']) - core.toDate(b['Startdatum']));

    if (!allEtappen.length) {
      nBadge.textContent = '';
      diagStats.textContent = 'BRP Etappen: keine gültigen Einträge (Datum fehlt)';
      currentData = [];
      return;
    }

    // Aktuelle Etappe finden (heute liegt im Zeitraum)
    const today = new Date();
    let currentIdx = allEtappen.findIndex(e =>
      today >= core.toDate(e['Startdatum']) && today <= core.toDate(e['Endedatum'])
    );
    if (currentIdx < 0) {
      // Heute liegt vor allen Etappen → Anzeige ab erster Etappe
      // Heute liegt nach allen Etappen → letzte Etappe als Referenz
      currentIdx = today < core.toDate(allEtappen[0]['Startdatum']) ? 0 : allEtappen.length - 1;
    }

    // Sichtbare Etappen: bei aktivem Zeitraum-Filter alle überlappenden,
    // sonst aktuelle + bis zu 3 vorherige Etappen (max 4)
    let visibleEtappen;
    const drMode = core.state.dateRangeMode;
    if (drMode !== 'all' && core.state.dateRangeFrom && core.state.dateRangeTo) {
      const from = core.state.dateRangeFrom;
      const to   = core.state.dateRangeTo;
      visibleEtappen = allEtappen.filter(e => {
        const eStart = core.toDate(e['Startdatum']);
        const eEnd   = core.toDate(e['Endedatum']);
        return eStart <= to && eEnd >= from;
      });
      if (!visibleEtappen.length) {
        nBadge.textContent = '';
        diagStats.textContent = 'Keine Etappen im Zeitraum';
        currentData = [];
        svgWrap.innerHTML = '';
        return;
      }
    } else {
      const startIdx = Math.max(0, currentIdx - 3);
      visibleEtappen = allEtappen.slice(startIdx, currentIdx + 1);
    }

    // Daten berechnen
    const data = visibleEtappen.map(etappe => {
      const name  = etappe['Etappe'];
      const start = core.toDate(etappe['Startdatum']);
      const end   = core.toDate(etappe['Endedatum']);
      const stageEpics = filteredEpics.filter(e => e['Stage'] === name);

      let resolved = 0, rejected = 0, uncalled = 0, open = 0;
      stageEpics.forEach(e => {
        if (_inRange(e['Resolved'], start, end))      { resolved++; return; }
        if (_inRange(e['Rejected'], start, end))      { rejected++; return; }
        if (_inRange(e['UNCALLED'], start, end))      { uncalled++; return; }
        open++;
      });

      const total    = stageEpics.length;
      const sdr      = total > 0 ? Math.round(resolved / total * 100) : null;
      const isCurrent = today >= start && today <= end;

      return { name, start, end, total, resolved, rejected, uncalled, open, sdr, isCurrent };
    });

    currentData = data;

    const totalEpics = data.reduce((s, d) => s + d.total, 0);
    nBadge.textContent = `N = ${totalEpics}`;
    diagStats.textContent = '';

    // ── SVG-Aufbau ───────────────────────────────────────────────────────────
    const W = svgWrap.clientWidth  || 500;
    const H = svgWrap.clientHeight || 260;

    const LEGEND_H      = 18;
    const LABEL_ABOVE_H = 26;   // Platz für n=X + SDR% über dem Balken
    const MARGIN_LEFT   = 34;
    const MARGIN_RIGHT  = 10;
    const MARGIN_TOP    = LEGEND_H + LABEL_ABOVE_H + 2;  // 46
    const MARGIN_BOTTOM = 30;

    const chartW  = W - MARGIN_LEFT - MARGIN_RIGHT;
    const chartH  = H - MARGIN_TOP  - MARGIN_BOTTOM;

    const yMax   = data.length ? Math.max(...data.map(d => d.total)) : 0;
    const ticks  = core.intTicks(yMax || 1, 5);
    const yScale = yMax > 0 ? chartH / yMax : 1;

    const barSlot = chartW / (data.length || 1);
    const barW    = Math.max(28, Math.min(90, barSlot * 0.65));
    const barGap  = (barSlot - barW) / 2;

    const fsSmall = Math.max(8, Math.min(11, W / 56));
    const fsLabel = Math.max(8, Math.min(11, barW / 5));

    const cResolved = _safeColor(cfg.colorResolved, DEFAULT_CFG.colorResolved);
    const cRejected = _safeColor(cfg.colorRejected, DEFAULT_CFG.colorRejected);
    const cUncalled = _safeColor(cfg.colorUncalled, DEFAULT_CFG.colorUncalled);
    const cOpenFill = _hexToRgba(_safeColor(cfg.colorOpen, DEFAULT_CFG.colorOpen), 0.18);
    const cOpenStroke = _safeColor(cfg.colorOpen, DEFAULT_CFG.colorOpen);

    const parts = [];
    parts.push(`<svg width="${W}" height="${H}" font-family="var(--sans)">`);

    // ── Legende oben ─────────────────────────────────────────────────────────
    const legendItems = [
      { label: 'Resolved', fill: cResolved,                    stroke: cResolved  },
      { label: 'Rejected', fill: cRejected,                    stroke: cRejected  },
      { label: 'UNCALLED', fill: cUncalled,                    stroke: cUncalled  },
      { label: 'Offen',    fill: cOpenFill,                    stroke: cOpenStroke },
    ];
    let lx = MARGIN_LEFT;
    const ly = 12;
    legendItems.forEach(item => {
      parts.push(`<rect x="${lx}" y="${ly - 9}" width="10" height="10" fill="${item.fill}" stroke="${item.stroke}" stroke-width="1" rx="2"/>`);
      lx += 13;
      parts.push(`<text x="${lx}" y="${ly}" fill="var(--dim)" font-size="${fsSmall}">${escHtml(item.label)}</text>`);
      lx += item.label.length * (fsSmall * 0.64) + 6;
    });

    // ── Gitternetzlinien + Y-Achsenbeschriftung ───────────────────────────────
    ticks.forEach(v => {
      const y = MARGIN_TOP + chartH - v * yScale;
      parts.push(`<line x1="${MARGIN_LEFT}" y1="${y}" x2="${MARGIN_LEFT + chartW}" y2="${y}" stroke="var(--border)" stroke-width="1" stroke-dasharray="3,3"/>`);
      parts.push(`<text x="${MARGIN_LEFT - 4}" y="${y + 4}" text-anchor="end" fill="var(--dim)" font-size="${fsSmall}">${v}</text>`);
    });

    // ── Achsen ────────────────────────────────────────────────────────────────
    parts.push(`<line x1="${MARGIN_LEFT}" y1="${MARGIN_TOP}" x2="${MARGIN_LEFT}" y2="${MARGIN_TOP + chartH}" stroke="var(--border)" stroke-width="1"/>`);
    parts.push(`<line x1="${MARGIN_LEFT}" y1="${MARGIN_TOP + chartH}" x2="${MARGIN_LEFT + chartW}" y2="${MARGIN_TOP + chartH}" stroke="var(--border)" stroke-width="1"/>`);

    // ── Balken ────────────────────────────────────────────────────────────────
    data.forEach((d, i) => {
      const bx     = MARGIN_LEFT + i * barSlot + barGap;
      const totalH = d.total > 0 ? d.total * yScale : 0;
      const frameY = MARGIN_TOP + chartH - totalH;

      const strokeColor = d.isCurrent ? 'var(--blue)' : 'var(--dimmer)';
      const strokeW     = d.isCurrent ? 2 : 1;

      if (d.total > 0) {
        // Leichte Hintergrundfüllung (offener Bereich)
        parts.push(`<rect x="${bx}" y="${frameY}" width="${barW}" height="${totalH}" fill="${cOpenFill}" rx="2" data-idx="${i}"/>`);

        // Farbige Segmente von unten: Resolved → Rejected → UNCALLED
        let stackBottom = MARGIN_TOP + chartH;

        [[d.resolved, cResolved], [d.rejected, cRejected], [d.uncalled, cUncalled]].forEach(([count, color]) => {
          if (count <= 0) return;
          const segH = count * yScale;
          stackBottom -= segH;
          parts.push(`<rect x="${bx}" y="${stackBottom}" width="${barW}" height="${segH}" fill="${color}" opacity="0.9" rx="1" data-idx="${i}"/>`);
          if (segH >= 16 && barW >= 28) {
            parts.push(`<text x="${bx + barW / 2}" y="${stackBottom + segH / 2 + 4}" text-anchor="middle" fill="var(--bg2)" font-size="${fsLabel}" font-weight="600" data-idx="${i}">${count}</text>`);
          }
        });

        // Rahmen oben (über der Füllung)
        parts.push(`<rect x="${bx}" y="${frameY}" width="${barW}" height="${totalH}" fill="none" stroke="${strokeColor}" stroke-width="${strokeW}" rx="2" data-idx="${i}"/>`);

        // n=X + SDR% immer über dem Balken
        const sdrTxt = d.sdr !== null ? `${d.sdr}%` : '–';
        parts.push(`<text x="${bx + barW / 2}" y="${frameY - 14}" text-anchor="middle" fill="var(--text)" font-size="${fsSmall}" font-weight="600" data-idx="${i}">n=${d.total}</text>`);
        parts.push(`<text x="${bx + barW / 2}" y="${frameY - 3}" text-anchor="middle" fill="var(--dim)" font-size="${fsSmall}" data-idx="${i}">${sdrTxt}</text>`);
      } else {
        // Leerer Balken: nur Tick-Markierung an der X-Achse
        parts.push(`<line x1="${bx + barW / 2}" y1="${MARGIN_TOP + chartH}" x2="${bx + barW / 2}" y2="${MARGIN_TOP + chartH + 4}" stroke="var(--border)" stroke-width="1"/>`);
      }

      // X-Achsen-Beschriftung
      const labelY  = MARGIN_TOP + chartH + 16;
      const rotate  = barW < 60 ? `transform="rotate(-35,${bx + barW / 2},${labelY})"` : '';
      const anchor  = barW < 60 ? 'end' : 'middle';
      parts.push(`<text x="${bx + barW / 2}" y="${labelY}" text-anchor="${anchor}" fill="var(--dim)" font-size="${fsSmall}" ${rotate} data-idx="${i}">${escHtml(d.name)}</text>`);
    });

    parts.push('</svg>');
    svgWrap.innerHTML = parts.join('');
  }

  // ── Tooltip-Events (einmalig, nutzen currentData-Referenz) ──────────────────
  svgWrap.addEventListener('mousemove', e => {
    const idx = parseInt(((e.target || {}).dataset || {}).idx, 10);
    if (isNaN(idx) || !currentData[idx]) { tooltip.style.display = 'none'; return; }
    const d = currentData[idx];
    const sdrTxt = d.sdr !== null ? `${d.sdr}%` : '–';
    tooltip.innerHTML =
      `<div style="font-weight:600;margin-bottom:4px">${escHtml(d.name)}</div>` +
      `<div style="color:var(--dim);font-size:11px;margin-bottom:6px">${_fmt2(d.start)} – ${_fmt2(d.end)}</div>` +
      `<div style="border-top:1px solid var(--border);padding-top:5px">` +
      `<div>Resolved:&nbsp;<b>${d.resolved}</b></div>` +
      `<div>Rejected:&nbsp;<b>${d.rejected}</b></div>` +
      `<div>UNCALLED:&nbsp;<b>${d.uncalled}</b></div>` +
      `<div>Offen:&nbsp;<b>${d.open}</b></div>` +
      `<div style="border-top:1px solid var(--border);margin-top:4px;padding-top:4px">` +
      `Gesamt:&nbsp;<b>${d.total}</b>&nbsp;·&nbsp;SDR:&nbsp;<b>${sdrTxt}</b></div></div>`;
    tooltip.style.display = 'block';
    const rect = contentEl.getBoundingClientRect();
    positionTooltip(e.clientX - rect.left, e.clientY - rect.top);
  });

  svgWrap.addEventListener('mouseleave', () => { tooltip.style.display = 'none'; });

  // ── Events abonnieren ────────────────────────────────────────────────────────
  core.on('data',   render);
  core.on('theme',  render);
  core.on('filter', render);
  core.on('resize', render);
}
