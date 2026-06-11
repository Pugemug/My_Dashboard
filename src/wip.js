import { core } from './core.js';

export function init() {

  // ── Config ──────────────────────────────────────────────────────────────────
  const cfg = core.load('fhwa_wip', {
    threshGreen:  4,
    threshYellow: 6,
    colorGreen:   '#4caf50',
    colorYellow:  '#ff9800',
    colorRed:     '#e53935',
  });

  // ── Tile ────────────────────────────────────────────────────────────────────
  const { contentEl, headerExtraEl, diagEl } = core.createTile({
    id:    'wip',
    title: 'WIP <span class="hl">pro Person</span>',
  });

  contentEl.style.position = 'relative';
  contentEl.style.overflow = 'hidden';

  // Draw area (SVG or placeholder) – sits below tooltip and panel in DOM order
  const drawEl = document.createElement('div');
  drawEl.style.cssText = 'position:absolute;inset:0;';
  contentEl.appendChild(drawEl);

  // Tooltip
  const tooltip = document.createElement('div');
  tooltip.style.cssText = [
    'position:absolute', 'display:none', 'background:var(--bg2)',
    'border:1px solid var(--border)', 'border-radius:6px',
    'padding:8px 12px', 'font-size:12px', 'color:var(--text)',
    'pointer-events:none', 'z-index:100', 'white-space:nowrap',
  ].join(';');
  contentEl.appendChild(tooltip);

  // Settings panel
  const panel = document.createElement('div');
  panel.style.cssText = [
    'display:none', 'position:absolute', 'top:4px', 'right:4px',
    'background:var(--bg2)', 'border:1px solid var(--border)',
    'border-radius:8px', 'padding:14px', 'z-index:50',
    'min-width:240px', 'font-size:13px', 'color:var(--text)',
  ].join(';');
  contentEl.appendChild(panel);

  // ── Header controls ─────────────────────────────────────────────────────────
  const nBadge = document.createElement('span');
  nBadge.style.cssText = 'font-size:11px;color:var(--dim);margin-right:6px;align-self:center;';
  headerExtraEl.appendChild(nBadge);

  const settingsBtn = document.createElement('button');
  settingsBtn.className = 'btn-icon';
  settingsBtn.title = 'Einstellungen';
  settingsBtn.textContent = '⚙';
  headerExtraEl.appendChild(settingsBtn);

  settingsBtn.onclick = () => {
    const visible = panel.style.display !== 'none';
    panel.style.display = visible ? 'none' : 'block';
    if (!visible) buildPanel();
  };

  // ── Settings panel builder ───────────────────────────────────────────────────
  function buildPanel() {
    panel.innerHTML = [
      '<div style="font-weight:500;margin-bottom:12px;">WIP Einstellungen</div>',
      '<label style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">',
        '<span>Grün bis (WIP/Person)</span>',
        `<input type="number" id="wip-tg" value="${cfg.threshGreen}" min="0.1" step="0.5"`,
        ' style="width:60px;background:var(--bg3);color:var(--text);border:1px solid var(--border);border-radius:4px;padding:2px 6px;">',
      '</label>',
      '<label style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">',
        '<span>Gelb bis (WIP/Person)</span>',
        `<input type="number" id="wip-ty" value="${cfg.threshYellow}" min="0.1" step="0.5"`,
        ' style="width:60px;background:var(--bg3);color:var(--text);border:1px solid var(--border);border-radius:4px;padding:2px 6px;">',
      '</label>',
      '<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">',
        `<input type="color" id="wip-cg" value="${cfg.colorGreen}" style="width:30px;height:26px;border:none;border-radius:3px;cursor:pointer;">`,
        `<input type="color" id="wip-cy" value="${cfg.colorYellow}" style="width:30px;height:26px;border:none;border-radius:3px;cursor:pointer;">`,
        `<input type="color" id="wip-cr" value="${cfg.colorRed}" style="width:30px;height:26px;border:none;border-radius:3px;cursor:pointer;">`,
        '<span style="font-size:11px;color:var(--dim);">Grün · Gelb · Rot</span>',
      '</div>',
      '<button id="wip-close" style="width:100%;padding:5px 0;background:var(--bg3);border:1px solid var(--border);border-radius:4px;color:var(--text);cursor:pointer;">Schließen</button>',
    ].join('');

    const applyConfig = () => {
      const tg = parseFloat(panel.querySelector('#wip-tg').value) || 4;
      const ty = parseFloat(panel.querySelector('#wip-ty').value) || 6;
      cfg.threshGreen  = tg;
      cfg.threshYellow = ty > tg ? ty : tg + 1;
      cfg.colorGreen   = panel.querySelector('#wip-cg').value;
      cfg.colorYellow  = panel.querySelector('#wip-cy').value;
      cfg.colorRed     = panel.querySelector('#wip-cr').value;
      core.save('fhwa_wip', cfg);
      render();
    };

    panel.querySelector('#wip-tg').onchange    = applyConfig;
    panel.querySelector('#wip-ty').onchange    = applyConfig;
    panel.querySelector('#wip-cg').onchange    = applyConfig;
    panel.querySelector('#wip-cy').onchange    = applyConfig;
    panel.querySelector('#wip-cr').onchange    = applyConfig;
    panel.querySelector('#wip-close').onclick  = () => { panel.style.display = 'none'; };
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────
  const MONTH_NAMES = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];

  function monthLabel(yyyymm) {
    const y = Math.floor(yyyymm / 100);
    const m = yyyymm % 100;
    return MONTH_NAMES[m - 1] + ' ' + y;
  }

  function parseToYYYYMM(val) {
    if (!val) return 0;
    if (val instanceof Date) {
      return isNaN(val) ? 0 : val.getFullYear() * 100 + (val.getMonth() + 1);
    }
    const s = String(val).trim();
    if (!s) return 0;
    const datePart = s.split(' ')[0];
    if (datePart.includes('.')) {
      const p = datePart.split('.');
      if (p.length >= 3) {
        const y = parseInt(p[2]), m = parseInt(p[1]);
        if (!isNaN(y) && !isNaN(m) && m >= 1 && m <= 12 && y > 1900) return y * 100 + m;
      }
    }
    const iso = datePart.match(/^(\d{4})-(\d{2})/);
    if (iso) return parseInt(iso[1]) * 100 + parseInt(iso[2]);
    return 0;
  }

  function quarterToMonths(header) {
    const m = String(header).match(/^(\d{4})_0?(\d)$/);
    if (!m) return [];
    const year = parseInt(m[1]);
    const q    = parseInt(m[2]);
    if (q < 1 || q > 4) return [];
    const start = (q - 1) * 3 + 1;
    return [year * 100 + start, year * 100 + start + 1, year * 100 + start + 2];
  }

  function colorFor(v) {
    if (v <= cfg.threshGreen)  return cfg.colorGreen;
    if (v <= cfg.threshYellow) return cfg.colorYellow;
    return cfg.colorRed;
  }

  function positionTooltip(mx, my) {
    const ttW = tooltip.offsetWidth  || 180;
    const ttH = tooltip.offsetHeight || 90;
    const cW  = contentEl.clientWidth;
    const cH  = contentEl.clientHeight;
    let left = mx + 14;
    if (left + ttW > cW) left = mx - ttW - 14;
    if (left < 0) left = 0;
    let top = my + 14;
    if (top + ttH > cH) top = my - ttH - 14;
    if (top < 0) top = 0;
    tooltip.style.left = left + 'px';
    tooltip.style.top  = top  + 'px';
  }

  function showPlaceholder(msg) {
    drawEl.innerHTML =
      `<div style="display:flex;align-items:center;justify-content:center;` +
      `height:100%;color:var(--dim);font-size:13px;">${msg}</div>`;
    nBadge.textContent = '';
    diagEl.textContent  = msg;
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  function render() {
    tooltip.style.display = 'none';

    const filter = core.state.squadFilter || [];
    if (filter.length !== 1) {
      showPlaceholder('Bitte genau einen Squad auswählen');
      return;
    }
    const squadName = filter[0];
    const rows = core.filteredRows();

    // ── SquadDaten lesen ────────────────────────────────────────────────────────
    const sheetsRaw  = core.state.sheetsRaw || {};
    const sheetNames = Object.keys(sheetsRaw);
    const raw        = sheetsRaw['SquadDaten'] ?? [];
    const hIdx       = raw.findIndex(row => row && row.some(c => c === 'Squad'));

    const teamSizeByMonth = {};  // YYYYMM → number
    let squadFoundInSheet = false;

    if (hIdx >= 0) {
      const hRow     = raw[hIdx];
      const squadCol = hRow.indexOf('Squad');   // Spalte mit "Squad"-Label dynamisch ermitteln

      // Alle Quartals-Spalten ermitteln (alles rechts von squadCol mit YYYY_QX-Format)
      const allHeaderMonths = [];
      for (let c = 0; c < hRow.length; c++) {
        if (c === squadCol || !hRow[c]) continue;
        const months = quarterToMonths(hRow[c]);
        months.forEach(m => allHeaderMonths.push(m));
      }

      // Squad-Zeile suchen für individuelle Teamgröße
      const dRow = raw.find((row, i) => i > hIdx && row && row[squadCol] === squadName);
      if (dRow) {
        squadFoundInSheet = true;
        for (let c = 0; c < hRow.length; c++) {
          if (c === squadCol || !hRow[c]) continue;
          const months = quarterToMonths(hRow[c]);
          if (!months.length) continue;
          const size = parseInt(dRow[c]);
          const ts   = isNaN(size) || size <= 0 ? 1 : size;
          months.forEach(mon => { teamSizeByMonth[mon] = ts; });
        }
      } else {
        // Squad nicht in SquadDaten → alle Header-Monate mit Teamgröße 1
        allHeaderMonths.forEach(m => { teamSizeByMonth[m] = 1; });
      }
    }

    // ── Letzte 12 Monate als festes Fenster (inkl. aktuellem Monat) ─────────────
    const now      = new Date();
    const nowYM    = now.getFullYear() * 100 + (now.getMonth() + 1);
    let winY = now.getFullYear(), winM = now.getMonth() + 1 - 11;
    if (winM <= 0) { winY--; winM += 12; }
    const windowStart = winY * 100 + winM;

    const allMonths = [];
    for (let ym = windowStart; ; ) {
      allMonths.push(ym);
      if (ym === nowYM) break;
      const y = Math.floor(ym / 100), m = ym % 100;
      ym = m === 12 ? (y + 1) * 100 + 1 : y * 100 + m + 1;
    }

    // ── WIP pro Monat berechnen ─────────────────────────────────────────────────
    const dataPoints = allMonths.map(M => {
      let wipCount = 0;
      rows.forEach(item => {
        const ip  = parseToYYYYMM(item['In Progress']);
        const res = parseToYYYYMM(item['Resolved']);
        const rej = parseToYYYYMM(item['Rejected']);
        const r4p = parseToYYYYMM(item['Ready4Production']);
        const ana = parseToYYYYMM(item['Analysed']);
        const r4g = parseToYYYYMM(item['Ready4Progress']);
        if (
          ip > 0 && ip <= M &&
          (res === 0 || res >= M) &&
          (rej === 0 || rej >= M) &&
          (r4p === 0 || r4p >= M) &&
          (ana === 0 || ana <= ip) &&
          (r4g === 0 || r4g <= ip)
        ) wipCount++;
      });
      const teamSize     = teamSizeByMonth[M] || 1;
      const wipPerPerson = Math.round(wipCount / teamSize * 100) / 100;
      return { month: M, wipCount, teamSize, wipPerPerson };
    });

    // ── N: einzigartige Stories die in mind. 1 Monat als WIP zählen ────────────
    const wipIds = new Set();
    rows.forEach(item => {
      const ip  = parseToYYYYMM(item['In Progress']);
      if (!ip) return;
      const res = parseToYYYYMM(item['Resolved']);
      const rej = parseToYYYYMM(item['Rejected']);
      const r4p = parseToYYYYMM(item['Ready4Production']);
      const ana = parseToYYYYMM(item['Analysed']);
      const r4g = parseToYYYYMM(item['Ready4Progress']);
      for (const M of allMonths) {
        if (
          ip <= M &&
          (res === 0 || res >= M) &&
          (rej === 0 || rej >= M) &&
          (r4p === 0 || r4p >= M) &&
          (ana === 0 || ana <= ip) &&
          (r4g === 0 || r4g <= ip)
        ) { wipIds.add(item['Jira-ID'] ?? item['Jira-Id'] ?? item); break; }
      }
    });
    const nStories = wipIds.size;

    nBadge.textContent  = `n=${nStories} Stories`;
    const squadHint     = !squadFoundInSheet ? ` · Squad nicht in SquadDaten (Teamgr. = 1)` : '';
    diagEl.textContent  = `n=${nStories} · ${monthLabel(allMonths[0])}–${monthLabel(allMonths[allMonths.length - 1])} · Squad: ${squadName}${squadHint}`;

    // ── SVG aufbauen ────────────────────────────────────────────────────────────
    const pW = contentEl.clientWidth  || 500;
    const pH = contentEl.clientHeight || 290;
    const mL = 46, mR = 14, mT = 16, mB = 44;
    const cW = pW - mL - mR;
    const cH = pH - mT - mB;

    const maxVal = dataPoints.length
      ? Math.max(...dataPoints.map(d => d.wipPerPerson), cfg.threshYellow + 1)
      : cfg.threshYellow + 2;
    const yMax = Math.ceil(maxVal + 0.5);

    const xS  = i => mL + (dataPoints.length > 1 ? i / (dataPoints.length - 1) : 0.5) * cW;
    const yS  = v => mT + cH - (v / yMax) * cH;
    const C   = core.scatterColors();
    const r   = Math.max(4, Math.min(7, pW / 80));

    const parts = [`<svg width="${pW}" height="${pH}" style="display:block;overflow:visible;">`];

    // Y-Gitter + Labels
    const ySteps = 5;
    for (let i = 0; i <= ySteps; i++) {
      const v = (yMax / ySteps) * i;
      const y = yS(v).toFixed(1);
      parts.push(`<line x1="${mL}" y1="${y}" x2="${pW - mR}" y2="${y}" stroke="${C.gridLine}" stroke-width="0.5"/>`);
      const label = v % 1 === 0 ? v : v.toFixed(1);
      parts.push(`<text x="${mL - 5}" y="${(parseFloat(y) + 4).toFixed(1)}" font-size="10" fill="${C.axisLabel}" text-anchor="end">${label}</text>`);
    }

    // Achsen
    parts.push(`<line x1="${mL}" y1="${mT}" x2="${mL}" y2="${mT + cH}" stroke="${C.axisLine}" stroke-width="1"/>`);
    parts.push(`<line x1="${mL}" y1="${mT + cH}" x2="${pW - mR}" y2="${mT + cH}" stroke="${C.axisLine}" stroke-width="1"/>`);

    // X-Labels (ausdünnen bei vielen Monaten)
    const skip = dataPoints.length > 18 ? 3 : dataPoints.length > 9 ? 2 : 1;
    const yLbl = (mT + cH + 14).toFixed(1);
    dataPoints.forEach((dp, i) => {
      if (i % skip !== 0 && i !== dataPoints.length - 1) return;
      parts.push(`<text x="${xS(i).toFixed(1)}" y="${yLbl}" font-size="10" fill="${C.axisLabel}" text-anchor="middle">${monthLabel(dp.month)}</text>`);
    });

    // Liniensegmente – Farbe des Zielpunkts (Index i+1)
    for (let i = 0; i < dataPoints.length - 1; i++) {
      const x1 = xS(i).toFixed(1),     y1 = yS(dataPoints[i].wipPerPerson).toFixed(1);
      const x2 = xS(i + 1).toFixed(1), y2 = yS(dataPoints[i + 1].wipPerPerson).toFixed(1);
      const col = colorFor(dataPoints[i + 1].wipPerPerson);
      parts.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${col}" stroke-width="2" stroke-linecap="round"/>`);
    }

    // Punkte
    dataPoints.forEach((dp, i) => {
      const x   = xS(i).toFixed(1);
      const y   = yS(dp.wipPerPerson).toFixed(1);
      const col = colorFor(dp.wipPerPerson);
      parts.push(`<circle class="wip-dot" cx="${x}" cy="${y}" r="${r}" fill="${col}" stroke="var(--bg2)" stroke-width="1.5" data-idx="${i}" style="cursor:default;"/>`);
    });

    parts.push('</svg>');
    drawEl.innerHTML = parts.join('');

    // ── Tooltip-Events ───────────────────────────────────────────────────────────
    drawEl.querySelectorAll('.wip-dot').forEach(dot => {
      dot.addEventListener('mouseover', e => {
        const dp = dataPoints[parseInt(dot.dataset.idx)];
        tooltip.innerHTML = [
          `<div style="font-weight:500;margin-bottom:4px;">${monthLabel(dp.month)}</div>`,
          `<div>WIP/Person: <b>${dp.wipPerPerson}</b></div>`,
          `<div>Stories in Progress: <b>${dp.wipCount}</b></div>`,
          `<div>Teamgröße: <b>${dp.teamSize}</b></div>`,
        ].join('');
        tooltip.style.display = 'block';
        const rect = contentEl.getBoundingClientRect();
        positionTooltip(e.clientX - rect.left, e.clientY - rect.top);
      });
      dot.addEventListener('mousemove', e => {
        const rect = contentEl.getBoundingClientRect();
        positionTooltip(e.clientX - rect.left, e.clientY - rect.top);
      });
      dot.addEventListener('mouseout', () => { tooltip.style.display = 'none'; });
    });
  }

  // ── Events ───────────────────────────────────────────────────────────────────
  core.on('data',   render);
  core.on('theme',  render);
  core.on('filter', render);
  core.on('resize', render);
}
