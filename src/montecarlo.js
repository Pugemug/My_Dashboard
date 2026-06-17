// ════════════════════════════════════════════════
// montecarlo.js  –  Monte Carlo Simulation Visual
// Flow Analytics Dashboard
// Eigenständiges Visual – abonniert core-Events
// ════════════════════════════════════════════════

import { core, _mkBtn, _mkPanel, _mkTglGrp } from './core.js';
import { calcCV } from './calc/montecarlo.calc.js';

export function init() {

  // ── 1. Lokaler Config-State ──────────────────
  const cfg = core.load('fhwa_montecarlo', {
    mode:                 'when',        // 'when' | 'howmany'
    targetCount:          100,
    targetDate:           '',            // ISO-String, Default: heute + 12 Wochen (wird unten gesetzt)
    calcRollingDays:      90,
    calcFromDate:         null,
    calcToDate:           null,
    stabilityRollingDays: 60,
    stabilityFromDate:    null,
    stabilityToDate:      null,
    throughputUnit:       'week',        // 'day' | 'week' | 'month'
    completedCol:         'Resolved',
    numRuns:              1000,
    cvThresholdGreen:     0.5,
    cvThresholdRed:       0.8,
    showP50: true,  colorP50: '#22d3ee',
    showP70: true,  colorP70: '#86efac',
    showP85: true,  colorP85: '#fbbf24',
    showP95: true,  colorP95: '#f87171',
  });

  if (!cfg.targetDate) {
    const d = new Date();
    d.setDate(d.getDate() + 84); // +12 Wochen
    cfg.targetDate = d.toISOString().slice(0, 10);
  }

  function saveConfig() { core.save('fhwa_montecarlo', cfg); }

  // ── 2. Card anlegen ──────────────────────────
  const { cardEl, contentEl, headerExtraEl, diagEl } = core.createCard({
    id:          'montecarlo',
    title:       'Monte<span class="hl">Carlo</span>',
    defaultGrid: { col: 0, row: 0, w: 8, h: 14 },
  });

  // ── 3. Header-Controls ───────────────────────
  const modeToggle = _mkTglGrp([
    { val: 'when',    label: 'Bis wann fertig?' },
    { val: 'howmany', label: 'Wie viele bis X?' },
  ], val => {
    cfg.mode = val;
    saveConfig();
    _updateModeToggle();
    _clearResult();
    _renderInputArea();
  });

  const btnSettings = _mkBtn('⚙ Einstellungen', () => _togglePanel('mc-settings-panel'));
  [modeToggle, btnSettings].forEach(el => headerExtraEl.appendChild(el));

  // ── 4. Einstellungs-Panel ────────────────────
  const settingsPanel = _mkPanel(); settingsPanel.id = 'mc-settings-panel';
  settingsPanel.style.cssText += 'max-width:420px;';

  const spTitle = document.createElement('div');
  spTitle.className = 'panel-title';
  spTitle.style.color = 'var(--purple)';
  spTitle.textContent = 'Einstellungen';

  // Berechnungszeitraum
  const calcSection = _mkSection('Berechnungszeitraum (MC-Basis)', 'var(--blue)');
  const calcRollingRow = _mkNumberField('Rolling (Tage)', cfg.calcRollingDays, 7, 730, v => {
    cfg.calcRollingDays = v; saveConfig(); render();
  });
  const calcDateRow = _mkDateRangeRow(
    cfg.calcFromDate, cfg.calcToDate,
    (v) => { cfg.calcFromDate = v; saveConfig(); render(); },
    (v) => { cfg.calcToDate   = v; saveConfig(); render(); }
  );
  calcSection.appendChild(calcRollingRow);
  calcSection.appendChild(calcDateRow);

  // Beurteilungszeitraum
  const stabSection = _mkSection('Beurteilungszeitraum (Stabilität)', 'var(--yellow)');
  const stabRollingRow = _mkNumberField('Rolling (Tage)', cfg.stabilityRollingDays, 7, 730, v => {
    cfg.stabilityRollingDays = v; saveConfig(); render();
  });
  const stabDateRow = _mkDateRangeRow(
    cfg.stabilityFromDate, cfg.stabilityToDate,
    (v) => { cfg.stabilityFromDate = v; saveConfig(); render(); },
    (v) => { cfg.stabilityToDate   = v; saveConfig(); render(); }
  );
  stabSection.appendChild(stabRollingRow);
  stabSection.appendChild(stabDateRow);

  // Throughput-Aggregation
  const unitSection = _mkSection('Throughput-Aggregation', 'var(--dim)');
  const unitToggle = _mkTglGrp([
    { val: 'day',   label: 'Täglich'   },
    { val: 'week',  label: 'Wöchentl.' },
    { val: 'month', label: 'Monatlich' },
  ], val => { cfg.throughputUnit = val; saveConfig(); _updateUnitToggle(); render(); });
  unitSection.appendChild(unitToggle);

  // Fertig-Spalte
  const colSection = _mkSection('Fertig-Spalte', 'var(--dim)');
  const colSelect = document.createElement('select');
  colSelect.className = 'mc-select';
  colSelect.addEventListener('change', () => { cfg.completedCol = colSelect.value; saveConfig(); render(); });
  colSection.appendChild(colSelect);

  // Simulationsläufe
  const runsSection = _mkSection('Simulationsläufe', 'var(--dim)');
  const runsRow = _mkNumberField('Läufe (500–10000)', cfg.numRuns, 500, 10000, v => {
    cfg.numRuns = v; saveConfig();
  });
  runsSection.appendChild(runsRow);

  // Perzentil-Linien
  const pctSection = _mkSection('Perzentil-Linien', 'var(--orange)');
  const pctGrid = document.createElement('div'); pctGrid.className = 'sc-pct-grid';
  pctSection.appendChild(pctGrid);

  [spTitle, calcSection, stabSection, unitSection, colSection, runsSection, pctSection]
    .forEach(el => settingsPanel.appendChild(el));

  cardEl.insertBefore(settingsPanel, contentEl);

  // ── 5. Haupt-Inhalt aufbauen ─────────────────
  contentEl.style.cssText = 'display:flex;flex-direction:column;overflow:hidden;';

  // Stabilitäts-Bereich
  const stabilityBar = document.createElement('div');
  stabilityBar.className = 'mc-stability-bar';
  stabilityBar.style.cssText = 'display:flex;align-items:center;gap:.6rem;padding:.35rem .7rem;border-bottom:1px solid var(--border);flex-shrink:0;flex-wrap:wrap;';

  const ampelEl   = document.createElement('span'); ampelEl.style.cssText = 'font-size:1rem;cursor:default;';
  const stabLabel = document.createElement('span'); stabLabel.style.cssText = 'font-size:.72rem;color:var(--dim);font-family:var(--mono);';
  const sparkWrap = document.createElement('div');  sparkWrap.style.cssText = 'flex:1;min-width:80px;max-width:220px;height:28px;';
  const sparkSvg  = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  sparkSvg.style.cssText = 'width:100%;height:100%;';
  sparkWrap.appendChild(sparkSvg);

  // Stabilitäts-Tooltip
  const stabTooltip = document.createElement('div');
  stabTooltip.className = 'mc-tooltip';
  stabTooltip.style.cssText = 'display:none;position:absolute;background:var(--bg3);border:1px solid var(--border);border-radius:6px;padding:.4rem .6rem;font-size:.7rem;color:var(--text);pointer-events:none;z-index:20;max-width:220px;line-height:1.5;';
  contentEl.appendChild(stabTooltip);

  ampelEl.addEventListener('mouseenter', (e) => {
    const rect = contentEl.getBoundingClientRect();
    stabTooltip.innerHTML = ampelEl.dataset.tooltip || '';
    stabTooltip.style.display = 'block';
    positionTooltip(stabTooltip, e.clientX - rect.left, e.clientY - rect.top, contentEl);
  });
  ampelEl.addEventListener('mousemove', (e) => {
    const rect = contentEl.getBoundingClientRect();
    positionTooltip(stabTooltip, e.clientX - rect.left, e.clientY - rect.top, contentEl);
  });
  ampelEl.addEventListener('mouseleave', () => { stabTooltip.style.display = 'none'; });

  [ampelEl, stabLabel, sparkWrap].forEach(el => stabilityBar.appendChild(el));
  contentEl.appendChild(stabilityBar);

  // Eingabe-Bereich
  const inputArea = document.createElement('div');
  inputArea.style.cssText = 'display:flex;align-items:center;gap:.6rem;padding:.35rem .7rem;border-bottom:1px solid var(--border);flex-shrink:0;flex-wrap:wrap;';
  contentEl.appendChild(inputArea);

  // Ergebnis-Bereich
  const resultArea = document.createElement('div');
  resultArea.style.cssText = 'flex:1;display:flex;gap:0;overflow:hidden;min-height:0;';

  const histWrap = document.createElement('div');
  histWrap.style.cssText = 'flex:1 1 65%;min-width:0;position:relative;';
  const histSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  histSvg.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;';
  histWrap.appendChild(histSvg);

  const tableWrap = document.createElement('div');
  tableWrap.style.cssText = 'flex:0 0 180px;border-left:1px solid var(--border);overflow:auto;';

  resultArea.appendChild(histWrap);
  resultArea.appendChild(tableWrap);
  contentEl.appendChild(resultArea);

  // Tooltip für Histogramm-Hover
  const tooltip = document.createElement('div');
  tooltip.className = 'mc-tooltip';
  tooltip.style.cssText = 'display:none;position:absolute;background:var(--bg3);border:1px solid var(--border);border-radius:6px;padding:.4rem .6rem;font-size:.7rem;color:var(--text);pointer-events:none;z-index:20;max-width:240px;line-height:1.5;';
  contentEl.appendChild(tooltip);

  // Platzhalter-Text im Ergebnis-Bereich
  const placeholder = document.createElement('div');
  placeholder.style.cssText = 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:var(--dimmer);font-size:.78rem;pointer-events:none;text-align:center;padding:1rem;';
  placeholder.textContent = 'Eingabe ausfüllen und Simulation starten';
  histWrap.appendChild(placeholder);

  // ── 6. State für Simulationsergebnis ─────────
  let _simResult = null; // { bins, p50, p70, p85, p95, labels }

  // ── 7. Render-Funktionen ─────────────────────

  function _clearResult() {
    _simResult = null;
    histSvg.innerHTML = '';
    tableWrap.innerHTML = '';
    placeholder.style.display = 'flex';
  }

  function _renderInputArea() {
    inputArea.innerHTML = '';

    const label = document.createElement('span');
    label.style.cssText = 'font-size:.72rem;color:var(--dim);white-space:nowrap;';

    if (cfg.mode === 'when') {
      label.textContent = 'Anzahl Issues:';
      const input = document.createElement('input');
      input.type = 'number'; input.min = 1; input.max = 10000;
      input.value = cfg.targetCount;
      input.style.cssText = 'width:80px;background:var(--bg3);border:1px solid var(--border);border-radius:4px;padding:.2rem .4rem;color:var(--text);font-size:.75rem;font-family:var(--mono);';
      input.addEventListener('change', () => {
        cfg.targetCount = Math.max(1, parseInt(input.value) || 1);
        input.value = cfg.targetCount;
        saveConfig();
        _clearResult();
      });
      inputArea.appendChild(label);
      inputArea.appendChild(input);
    } else {
      label.textContent = 'Zieldatum:';
      const input = document.createElement('input');
      input.type = 'date';
      input.value = cfg.targetDate;
      input.style.cssText = 'background:var(--bg3);border:1px solid var(--border);border-radius:4px;padding:.2rem .4rem;color:var(--text);font-size:.75rem;font-family:var(--mono);';
      input.addEventListener('change', () => {
        cfg.targetDate = input.value;
        saveConfig();
        _clearResult();
      });
      inputArea.appendChild(label);
      inputArea.appendChild(input);
    }

    const runBtn = document.createElement('button');
    runBtn.className = 'btn-icon';
    runBtn.style.cssText += 'background:var(--blue);color:#000;font-weight:600;padding:.25rem .65rem;';
    runBtn.textContent = '▶ Simulation starten';
    runBtn.addEventListener('click', _runSimulation);
    inputArea.appendChild(runBtn);
  }

  function render() {
    const rows = core.filteredRows();
    const dateCols = core.state.dateCols || [];

    // Fertig-Spalte Dropdown aktualisieren
    if (dateCols.length) {
      colSelect.innerHTML = '';
      dateCols.forEach(c => {
        const o = document.createElement('option');
        o.value = c; o.textContent = c;
        if (c === cfg.completedCol) o.selected = true;
        colSelect.appendChild(o);
      });
      if (!dateCols.includes(cfg.completedCol)) {
        cfg.completedCol = dateCols[0] || 'Resolved';
        saveConfig();
      }
    }

    _updateModeToggle();
    _updateUnitToggle();
    _buildPctPanel();
    _renderInputArea();
    _renderStability(rows);

    diagEl.textContent = `n=${rows.length} · Zeitraum: ${cfg.calcRollingDays}d · ${cfg.numRuns} Läufe`;
  }

  function _getDateRange(rollingDays, fromDate, toDate) {
    const toD   = toDate   ? new Date(toDate)   : new Date();
    const fromD = fromDate ? new Date(fromDate)  : new Date(toD.getTime() - rollingDays * 86400000);
    return { fromD, toD };
  }

  function _computeThroughput(rows, fromD, toD) {
    const completed = rows.filter(r => {
      const d = core.toDate(r[cfg.completedCol]);
      return d && d >= fromD && d <= toD;
    });

    const slices = _buildSlices(fromD, toD, cfg.throughputUnit);
    const counts = new Array(slices.length).fill(0);

    completed.forEach(r => {
      const d = core.toDate(r[cfg.completedCol]);
      if (!d) return;
      const idx = slices.findIndex((s, i) => {
        const next = slices[i + 1];
        return d >= s && (!next || d < next);
      });
      if (idx >= 0) counts[idx]++;
    });

    return counts;
  }

  function _buildSlices(fromD, toD, unit) {
    const slices = [];
    let cur = new Date(fromD);
    while (cur <= toD) {
      slices.push(new Date(cur));
      if (unit === 'day')        cur.setDate(cur.getDate() + 1);
      else if (unit === 'week')  cur.setDate(cur.getDate() + 7);
      else                       cur.setMonth(cur.getMonth() + 1);
    }
    return slices;
  }

  function _renderStability(rows) {
    const { fromD, toD } = _getDateRange(
      cfg.stabilityRollingDays, cfg.stabilityFromDate, cfg.stabilityToDate
    );
    const samples = _computeThroughput(rows, fromD, toD);

    if (!samples.length) {
      ampelEl.textContent = '🔴';
      stabLabel.textContent = 'Kein Throughput im Beurteilungszeitraum';
      sparkSvg.innerHTML = '';
      return;
    }

    const cv = calcCV(samples);
    const mean = samples.reduce((s, v) => s + v, 0) / samples.length;

    let ampel, stabText;
    if (cv <= cfg.cvThresholdGreen) {
      ampel = '🟢'; stabText = `Stabil · CV: ${cv.toFixed(2)}`;
    } else if (cv <= cfg.cvThresholdRed) {
      ampel = '🟡'; stabText = `Volatil · CV: ${cv.toFixed(2)}`;
    } else {
      ampel = '🔴'; stabText = cv === Infinity ? 'Instabil · Kein Durchsatz' : `Instabil · CV: ${cv.toFixed(2)}`;
    }

    ampelEl.textContent = ampel;
    stabLabel.textContent = stabText;
    ampelEl.dataset.tooltip = `CV = σ/μ · n=${samples.length} Zeitscheiben · μ=${mean.toFixed(1)} · Grünschwelle: ${cfg.cvThresholdGreen} · Rotschwelle: ${cfg.cvThresholdRed}`;

    // Sparkline
    const maxV = Math.max(...samples, 1);
    const W = sparkWrap.clientWidth || 160;
    const H = 24;
    const bw = Math.max(1, (W / samples.length) - 1);
    const C  = core.scatterColors();
    const parts = samples.map((v, i) => {
      const h   = Math.max(1, (v / maxV) * H);
      const x   = i * (bw + 1);
      const col = ampel === '🟢' ? 'var(--green)' : ampel === '🟡' ? 'var(--yellow)' : 'var(--red)';
      return `<rect x="${x.toFixed(1)}" y="${(H - h).toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" fill="${col}" opacity=".7"/>`;
    });
    sparkSvg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    sparkSvg.innerHTML = parts.join('');
  }

  function _runSimulation() {
    const rows = core.filteredRows();
    const { fromD, toD } = _getDateRange(
      cfg.calcRollingDays, cfg.calcFromDate, cfg.calcToDate
    );
    const samples = _computeThroughput(rows, fromD, toD);

    if (!samples.length || samples.every(v => v === 0)) {
      placeholder.textContent = 'Keine abgeschlossenen Issues im Berechnungszeitraum';
      placeholder.style.display = 'flex';
      histSvg.innerHTML = '';
      tableWrap.innerHTML = '';
      return;
    }

    const results = [];
    const n = cfg.numRuns;
    const today = new Date(); today.setHours(0, 0, 0, 0);

    if (cfg.mode === 'when') {
      const target = cfg.targetCount;
      for (let i = 0; i < n; i++) {
        let remaining = target;
        let slices = 0;
        while (remaining > 0) {
          remaining -= samples[Math.floor(Math.random() * samples.length)];
          slices++;
          if (slices > 5200) break; // max ~100 Jahre Schutz
        }
        const d = new Date(today);
        const daysPerSlice = cfg.throughputUnit === 'day' ? 1 : cfg.throughputUnit === 'week' ? 7 : 30;
        d.setDate(d.getDate() + slices * daysPerSlice);
        results.push(d.getTime());
      }
    } else {
      const targetD = new Date(cfg.targetDate); targetD.setHours(0, 0, 0, 0);
      const daysPerSlice = cfg.throughputUnit === 'day' ? 1 : cfg.throughputUnit === 'week' ? 7 : 30;
      const totalSlices = Math.max(1, Math.round((targetD - today) / (daysPerSlice * 86400000)));
      for (let i = 0; i < n; i++) {
        let total = 0;
        for (let s = 0; s < totalSlices; s++) {
          total += samples[Math.floor(Math.random() * samples.length)];
        }
        results.push(total);
      }
    }

    results.sort((a, b) => a - b);

    const p50 = results[Math.floor(n * 0.50)];
    const p70 = results[Math.floor(n * 0.70)];
    const p85 = results[Math.floor(n * 0.85)];
    const p95 = results[Math.floor(n * 0.95)];

    _simResult = { results, p50, p70, p85, p95 };
    placeholder.style.display = 'none';
    _renderHistogram();
    _renderTable();
  }

  function _renderHistogram() {
    if (!_simResult) return;
    const { results, p50, p70, p85, p95 } = _simResult;

    const W = histWrap.clientWidth  || 400;
    const H = histWrap.clientHeight || 300;
    const ML = 45, MR = 16, MT = 18, MB = 50;
    const pW = W - ML - MR;
    const pH = H - MT - MB;

    if (pW < 20 || pH < 20) { histSvg.innerHTML = ''; return; }

    const isWhen = cfg.mode === 'when';
    const min = results[0];
    const max = results[results.length - 1];

    // Bins berechnen
    // Bins auf Anzahl der tatsächlich vorhandenen Distinct-Werte begrenzen
    // → verhindert Lücken bei wöchentlichem Throughput (Ergebnisse nur auf Wochengrenzen)
    const distinctCount = new Set(results.map(v => isWhen ? Math.round(v / 86400000) : Math.round(v))).size;
    const numBins = Math.max(5, Math.min(distinctCount, Math.floor(pW / 12)));
    const range   = max - min || 1;
    const binSize = range / numBins;
    const bins    = new Array(numBins).fill(0);
    results.forEach(v => {
      const idx = Math.min(numBins - 1, Math.floor((v - min) / binSize));
      bins[idx]++;
    });

    const maxFreq   = Math.max(1, ...bins);
    const n         = results.length;
    const C         = core.scatterColors();
    const bw        = pW / numBins;
    const parts     = [];

    // Achsen
    parts.push(`<rect x="${ML}" y="${MT}" width="${pW}" height="${pH}" fill="${C.plotBg}"/>`);
    parts.push(`<line x1="${ML}" y1="${MT+pH}" x2="${ML+pW}" y2="${MT+pH}" stroke="${C.axisLine}" stroke-width="1"/>`);
    parts.push(`<line x1="${ML}" y1="${MT}" x2="${ML}" y2="${MT+pH}" stroke="${C.axisLine}" stroke-width="1"/>`);

    // Y-Achsen-Ticks (Häufigkeit)
    const yTicks = 4;
    for (let t = 0; t <= yTicks; t++) {
      const freq = Math.round((maxFreq / yTicks) * t);
      const y    = MT + pH - (freq / maxFreq) * pH;
      parts.push(`<line x1="${ML-4}" y1="${y.toFixed(1)}" x2="${ML+pW}" y2="${y.toFixed(1)}" stroke="${C.gridLine}" stroke-width="1" stroke-dasharray="3,3"/>`);
      parts.push(`<text x="${(ML-6).toFixed(1)}" y="${(y+4).toFixed(1)}" text-anchor="end" font-size="9" fill="${C.axisLabel}">${freq}</text>`);
    }

    // Balken
    bins.forEach((freq, i) => {
      const x = ML + i * bw;
      const h = (freq / maxFreq) * pH;
      const y = MT + pH - h;
      parts.push(`<rect class="mc-bar" data-idx="${i}" x="${(x+.5).toFixed(1)}" y="${y.toFixed(1)}" width="${(bw-.5).toFixed(1)}" height="${Math.max(1, h).toFixed(1)}" fill="var(--blue)" opacity=".75"/>`);
    });

    // X-Achsen-Labels
    const maxXLabels = Math.floor(pW / 60);
    const labelStep  = Math.max(1, Math.floor(numBins / maxXLabels));
    for (let i = 0; i < numBins; i += labelStep) {
      const val = min + i * binSize;
      const x   = ML + i * bw + bw / 2;
      const label = isWhen ? _fmtDate(new Date(val)) : Math.round(val).toString();
      parts.push(`<text x="${x.toFixed(1)}" y="${(MT+pH+14).toFixed(1)}" text-anchor="middle" font-size="9" fill="${C.axisLabel}" transform="rotate(-30,${x.toFixed(1)},${(MT+pH+14).toFixed(1)})">${label}</text>`);
    }

    // Perzentil-Linien
    const pLines = [
      { val: p50, show: cfg.showP50, color: cfg.colorP50, label: 'P50' },
      { val: p70, show: cfg.showP70, color: cfg.colorP70, label: 'P70' },
      { val: p85, show: cfg.showP85, color: cfg.colorP85, label: 'P85' },
      { val: p95, show: cfg.showP95, color: cfg.colorP95, label: 'P95' },
    ];
    pLines.forEach(({ val, show, color, label }) => {
      if (!show) return;
      // Linie an der rechten Kante des Bins positionieren → genau zwischen Balken
      const binIdx = Math.min(numBins - 1, Math.floor((val - min) / binSize));
      const x = ML + (binIdx + 1) * bw;
      if (x < ML || x > ML + pW) return;
      parts.push(`<line x1="${x.toFixed(1)}" y1="${MT}" x2="${x.toFixed(1)}" y2="${MT+pH}" stroke="${color}" stroke-width="1.5" stroke-dasharray="4,3"/>`);
      parts.push(`<text x="${(x+3).toFixed(1)}" y="${(MT+11).toFixed(1)}" font-size="9" fill="${color}" font-weight="600">${label}</text>`);
    });

    // Y-Achsentitel
    parts.push(`<text x="${(ML-36).toFixed(1)}" y="${(MT+pH/2).toFixed(1)}" text-anchor="middle" font-size="9" fill="${C.axisLabel}" transform="rotate(-90,${(ML-36).toFixed(1)},${(MT+pH/2).toFixed(1)})">Häufigkeit</text>`);
    // X-Achsentitel
    const xTitle = isWhen ? 'Fertigstellungsdatum' : 'Anzahl Issues';
    parts.push(`<text x="${(ML+pW/2).toFixed(1)}" y="${(H-4).toFixed(1)}" text-anchor="middle" font-size="9" fill="${C.axisLabel}">${xTitle}</text>`);

    histSvg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    histSvg.innerHTML = parts.join('');

    // Hover-Interaktion auf Balken
    histSvg.querySelectorAll('.mc-bar').forEach(rect => {
      rect.addEventListener('mouseenter', (e) => {
        rect.setAttribute('opacity', '1');
        const idx  = parseInt(rect.dataset.idx);
        const freq = bins[idx];
        const val  = min + idx * binSize;
        const cum  = results.filter(v => v <= val + binSize).length / n;
        const valLabel = isWhen ? _fmtDate(new Date(val)) : `${Math.round(val)}–${Math.round(val+binSize)}`;
        tooltip.innerHTML = `<b>${valLabel}</b><br>Häufigkeit: ${freq}<br>Kumuliert: ${(cum*100).toFixed(1)} %`;
        tooltip.style.display = 'block';
        const r = contentEl.getBoundingClientRect();
        positionTooltip(tooltip, e.clientX - r.left, e.clientY - r.top, contentEl);
      });
      rect.addEventListener('mousemove', (e) => {
        const r = contentEl.getBoundingClientRect();
        positionTooltip(tooltip, e.clientX - r.left, e.clientY - r.top, contentEl);
      });
      rect.addEventListener('mouseleave', () => {
        rect.setAttribute('opacity', '.75');
        tooltip.style.display = 'none';
      });
    });
  }

  function _renderTable() {
    if (!_simResult) return;
    const { results, p50, p70, p85, p95 } = _simResult;
    const isWhen = cfg.mode === 'when';
    const n      = results.length;
    const fmt    = v => isWhen ? _fmtDate(new Date(v)) : Math.round(v).toString();

    tableWrap.innerHTML = '';
    const table = document.createElement('table');
    table.style.cssText = 'width:100%;border-collapse:collapse;font-size:.7rem;';

    const header = document.createElement('tr');
    header.innerHTML = `<th style="padding:.3rem .4rem;border-bottom:1px solid var(--border);color:var(--dim);font-weight:600;text-align:left;">%</th>
      <th style="padding:.3rem .4rem;border-bottom:1px solid var(--border);color:var(--dim);font-weight:600;text-align:left;">${isWhen ? 'Datum' : 'Issues'}</th>`;
    table.appendChild(header);

    const pRows = [
      { label: 'P50', val: p50, color: cfg.colorP50 },
      { label: 'P70', val: p70, color: cfg.colorP70 },
      { label: 'P85', val: p85, color: cfg.colorP85 },
      { label: 'P95', val: p95, color: cfg.colorP95 },
    ];
    pRows.forEach(({ label, val, color }) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td style="padding:.28rem .4rem;border-bottom:1px solid var(--border);color:${color};font-weight:600;font-family:var(--mono);">${label}</td>
        <td style="padding:.28rem .4rem;border-bottom:1px solid var(--border);color:var(--text);font-family:var(--mono);">${fmt(val)}</td>`;
      table.appendChild(tr);
    });

    tableWrap.appendChild(table);
  }

  // ── 8. Hilfsfunktionen ───────────────────────

  function positionTooltip(tt, mx, my, container) {
    const ttW = tt.offsetWidth  || 200;
    const ttH = tt.offsetHeight || 80;
    const cW  = container.clientWidth;
    const cH  = container.clientHeight;
    let left  = mx + 12;
    if (left + ttW > cW) left = mx - ttW - 12;
    if (left < 0) left = 0;
    let top   = my + 12;
    if (top + ttH > cH) top = my - ttH - 12;
    if (top < 0) top = 0;
    tt.style.left = left + 'px';
    tt.style.top  = top  + 'px';
  }

  function _fmtDate(d) {
    if (!d || isNaN(d)) return '–';
    return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' });
  }

  // _mkTglGrp, _mkBtn, _mkPanel werden von core.js importiert (P3.7)

  function _mkSection(title, color) {
    const s = document.createElement('div'); s.style.cssText = 'margin-bottom:.65rem;';
    const t = document.createElement('div'); t.className = 'panel-title'; t.style.color = color; t.textContent = title;
    s.appendChild(t);
    return s;
  }

  function _mkNumberField(label, defaultVal, min, max, onChange) {
    const row = document.createElement('div'); row.style.cssText = 'display:flex;align-items:center;gap:.4rem;margin-bottom:.3rem;';
    const lbl = document.createElement('span'); lbl.className = 'lt-label'; lbl.textContent = label;
    const inp = document.createElement('input'); inp.type = 'number'; inp.min = min; inp.max = max; inp.value = defaultVal;
    inp.style.cssText = 'width:72px;background:var(--bg3);border:1px solid var(--border);border-radius:4px;padding:.15rem .3rem;color:var(--text);font-size:.72rem;font-family:var(--mono);';
    inp.addEventListener('change', () => {
      const v = Math.max(min, Math.min(max, parseInt(inp.value) || defaultVal));
      inp.value = v; onChange(v);
    });
    row.appendChild(lbl); row.appendChild(inp);
    return row;
  }

  function _mkDateRangeRow(fromVal, toVal, onFromChange, onToChange) {
    const row = document.createElement('div'); row.style.cssText = 'display:flex;align-items:center;gap:.3rem;flex-wrap:wrap;margin-bottom:.3rem;';
    const lbl1 = document.createElement('span'); lbl1.className = 'lt-label'; lbl1.textContent = 'Von';
    const inpFrom = document.createElement('input'); inpFrom.type = 'date'; inpFrom.value = fromVal || '';
    const lbl2 = document.createElement('span'); lbl2.className = 'lt-label'; lbl2.textContent = 'Bis';
    const inpTo   = document.createElement('input'); inpTo.type = 'date'; inpTo.value = toVal || '';
    [inpFrom, inpTo].forEach(i => {
      i.style.cssText = 'background:var(--bg3);border:1px solid var(--border);border-radius:4px;padding:.15rem .3rem;color:var(--text);font-size:.72rem;font-family:var(--mono);';
    });
    inpFrom.addEventListener('change', () => onFromChange(inpFrom.value || null));
    inpTo.addEventListener('change',   () => onToChange(inpTo.value   || null));
    [lbl1, inpFrom, lbl2, inpTo].forEach(el => row.appendChild(el));
    return row;
  }

  function _updateModeToggle() {
    modeToggle.querySelectorAll('.tgl').forEach(b => {
      b.classList.toggle('ta-b', b.dataset.val === cfg.mode);
    });
  }

  function _updateUnitToggle() {
    unitToggle.querySelectorAll('.tgl').forEach(b => {
      b.classList.toggle('ta-b', b.dataset.val === cfg.throughputUnit);
    });
  }

  function _togglePanel(id) {
    const panel = settingsPanel;
    const isOpen = panel.classList.contains('open');
    panel.classList.toggle('open', !isOpen);
  }

  function _buildPctPanel() {
    pctGrid.innerHTML = '';
    const pLines = [
      { key: 'P50', showKey: 'showP50', colorKey: 'colorP50' },
      { key: 'P70', showKey: 'showP70', colorKey: 'colorP70' },
      { key: 'P85', showKey: 'showP85', colorKey: 'colorP85' },
      { key: 'P95', showKey: 'showP95', colorKey: 'colorP95' },
    ];
    pLines.forEach(({ key, showKey, colorKey }) => {
      const row = document.createElement('div'); row.style.cssText = 'display:flex;align-items:center;gap:.4rem;margin-bottom:.25rem;';
      const cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = cfg[showKey];
      const lbl = document.createElement('span'); lbl.style.cssText = 'font-size:.72rem;color:var(--dim);min-width:2.4rem;'; lbl.textContent = key;
      const ci = document.createElement('input'); ci.type = 'color'; ci.value = cfg[colorKey];
      ci.style.cssText = 'width:28px;height:20px;border:none;background:transparent;cursor:pointer;padding:0;';
      cb.addEventListener('change', () => { cfg[showKey] = cb.checked; saveConfig(); if (_simResult) _renderHistogram(); });
      ci.addEventListener('change', () => { cfg[colorKey] = ci.value; saveConfig(); if (_simResult) { _renderHistogram(); _renderTable(); } });
      [cb, lbl, ci].forEach(el => row.appendChild(el));
      pctGrid.appendChild(row);
    });
  }

  // ── 9. Events abonnieren ─────────────────────
  core.on('data', () => { _clearResult(); render(); });
  core.on('theme', () => { render(); if (_simResult) { _renderHistogram(); _renderTable(); } });
  core.on('filter', () => { _clearResult(); render(); });
  core.on('resize', () => { if (_simResult) _renderHistogram(); _renderStability(core.filteredRows()); });
}
