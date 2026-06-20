// ════════════════════════════════════════════════
// flowefficiency.js  –  Flow Efficiency Tile
// Spec: docs/specs/FlowEfficiency.md v1.2
// ════════════════════════════════════════════════

import { core } from './core.js';
import { WAIT_STATUS } from './calc/flowefficiency.calc.js';

export function init() {

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
  let _monthData  = [];   // [{ key, label, fe, items, n, ltAvg, breakdown }]
  let _errors     = 0;
  let _errorItems = [];  // [{ jiraId, issueType, totalWait, lt, breakdown }]
  let _errSort    = { col: 'diff', dir: -1 };

  // ── Tile ───────────────────────────────────────
  const { contentEl, headerExtraEl, diagEl } = core.createTile({
    id:    'flowefficiency',
    title: 'Flow <span class="hl">Efficiency</span>',
  });

  // ── Header extras: mode toggle · settings · help ──
  ['Linie', 'Violin'].forEach((label, i) => {
    const m   = i === 0 ? 'line' : 'violin';
    const btn = document.createElement('button');
    btn.className    = 'btn-icon';
    btn.textContent  = label;
    btn.dataset.mode = m;
    btn.style.cssText = 'font-size:.58rem;padding:.1rem .32rem';
    btn.classList.toggle('p-blue', cfg.mode === m);
    btn.addEventListener('click', () => {
      cfg.mode = m;
      core.save(KEY, cfg);
      _updateModeToggle();
      _renderChart();
    });
    headerExtraEl.appendChild(btn);
  });

  const helpBtn = document.createElement('button');
  helpBtn.className     = 'btn-icon';
  helpBtn.textContent   = '?';
  helpBtn.title         = 'Flow Efficiency – Erklärung';
  helpBtn.style.cssText = 'font-weight:700;font-size:13px';
  helpBtn.addEventListener('click', _openHelp);

  const settingsBtn = document.createElement('button');
  settingsBtn.className   = 'btn-icon';
  settingsBtn.textContent = '⚙';
  settingsBtn.title       = 'Flow Efficiency – Einstellungen';
  settingsBtn.addEventListener('click', _openSettings);

  headerExtraEl.appendChild(settingsBtn);
  headerExtraEl.appendChild(helpBtn);

  // 3-spaltige Diag-Leiste
  diagEl.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:8px;overflow:hidden';
  const diagLeft = document.createElement('a');
  diagLeft.style.cssText = 'font-size:11px;color:var(--blue);white-space:nowrap;flex-shrink:0;cursor:pointer;text-decoration:none;user-select:none';
  diagLeft.textContent = 'Was zeigt diese Ansicht?';
  diagLeft.addEventListener('click', function() { _toggleExplanation(); });
  const diagMid = document.createElement('span');
  diagMid.style.cssText = 'font-size:11px;color:var(--dim);white-space:nowrap;flex:1;text-align:center;overflow:hidden;text-overflow:ellipsis';
  const diagRight = document.createElement('a');
  diagRight.style.cssText = 'font-size:11px;color:var(--blue);white-space:nowrap;flex-shrink:0;cursor:pointer;text-decoration:none';
  diagRight.textContent = 'Flow analysieren →';
  diagRight.addEventListener('click', function() { core.showPage('heatmap'); });
  diagEl.appendChild(diagLeft);
  diagEl.appendChild(diagMid);
  diagEl.appendChild(diagRight);

  // ── SVG + Erklärungs-Panel ────────────────────────
  let showExplanation = false;

  contentEl.style.cssText = 'position:relative;overflow:hidden;display:flex;flex-direction:column';

  const explanationEl = document.createElement('div');
  explanationEl.style.cssText = [
    'overflow:hidden', 'max-height:0', 'flex-shrink:0',
    'transition:max-height .22s ease',
    'background:var(--bg3)', 'border-bottom:1px solid var(--border)',
    'font-size:13px', 'color:var(--dim)', 'line-height:1.6',
    'font-family:var(--sans)',
  ].join(';');
  explanationEl.innerHTML =
    '<div style="padding:10px 14px">' +
    'Monatlicher Verlauf des Anteils echter Arbeitszeit an der gesamten Lead Time. ' +
    '<strong style="color:var(--text)">Aktive Zeit</strong> = Lead Time minus Warte-Status ' +
    '(Blocked, Ready4Test, Ready4QS, Ready4Review …). ' +
    'Punkte werden <strong style="color:var(--green)">grün</strong> wenn FE% ≥ Ziellinie, ' +
    'sonst <strong style="color:var(--red)">rot</strong>. ' +
    'Der <strong style="color:var(--text)">Violin-Modus</strong> zeigt zusätzlich die Streuung der Einzelwerte pro Monat.' +
    '</div>';
  contentEl.appendChild(explanationEl);

  const svgNS = 'http://www.w3.org/2000/svg';
  const svg   = document.createElementNS(svgNS, 'svg');
  svg.style.cssText = 'width:100%;flex:1;display:block;overflow:visible;min-height:0';
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

  // ── Help modal ─────────────────────────────────
  const feHelpBackdrop = document.createElement('div');
  feHelpBackdrop.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:400';
  feHelpBackdrop.addEventListener('click', _closeHelp);
  document.body.appendChild(feHelpBackdrop);

  const feHelpPanel = document.createElement('div');
  feHelpPanel.style.cssText = [
    'display:none', 'position:fixed', 'top:50%', 'left:50%',
    'transform:translate(-50%,-50%)',
    'width:min(84vw,920px)', 'max-height:87vh',
    'background:var(--bg2)', 'border:1px solid var(--border)', 'border-radius:10px',
    'z-index:401', 'box-shadow:0 16px 60px rgba(0,0,0,.65)',
    'flex-direction:column', 'font-family:var(--sans)', 'color:var(--text)',
    'overflow:hidden',
  ].join(';');
  document.body.appendChild(feHelpPanel);

  feHelpPanel.innerHTML = `
    <style>
      .fe-help-body .th-svg { fill: var(--text) !important; font-family: var(--sans) !important; }
      .fe-help-body .ts-svg { fill: var(--dim)  !important; font-family: var(--sans) !important; }
    </style>
    <div style="display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid var(--border);flex-shrink:0">
      <div style="font-size:16px;font-weight:700">Flow Efficiency – Erklärung</div>
      <button id="fe-help-close" style="background:none;border:none;cursor:pointer;font-size:20px;color:var(--dim);font-family:var(--sans);line-height:1;padding:0 4px">✕</button>
    </div>
    <div class="fe-help-body" style="overflow-y:auto;padding:24px 28px;flex:1;line-height:1.7;font-size:14px;color:var(--dim)">

      <h2 style="font-size:18px;font-weight:600;margin:0 0 10px;color:var(--text)">Was ist Flow Efficiency?</h2>
      <p style="margin:0 0 12px">Das Flow Efficiency Visual zeigt, <strong style="color:var(--text)">wie viel Prozent der gesamten Lieferzeit wirklich aktiv gearbeitet wurde</strong> – und wie viel davon sinnlos im Warten versackte. Es beantwortet die Frage: <em>Ist unser Prozess krank, oder liefern wir flüssig?</em></p>
      <p style="margin:0 0 16px">Das Ergebnis wird als monatlicher Verlauf angezeigt – entweder als Linienchart (Median pro Monat) oder als Violin-Chart (zeigt zusätzlich die Streuung der Einzelwerte).</p>

      <div style="background:var(--bg3);border:1px solid var(--border);border-radius:10px;padding:16px;margin:0 0 24px;overflow:hidden">
        <svg width="100%" viewBox="0 0 680 420" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <marker id="feh-a1" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M2 1L8 5L2 9" fill="none" stroke="var(--dimmer)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </marker>
          </defs>
          <text class="th-svg" x="340" y="36" text-anchor="middle" font-size="16">Was ist Flow Efficiency?</text>
          <rect x="40" y="70" width="210" height="52" rx="8" fill="#e1f5ee" stroke="#0f6e56" stroke-width="0.5"/>
          <text class="th-svg" x="145" y="92" text-anchor="middle" fill="#085041">Aktive Arbeit</text>
          <text class="ts-svg" x="145" y="110" text-anchor="middle" fill="#0f6e56">Ready4Progress → Coding</text>
          <rect x="252" y="70" width="100" height="52" rx="0" fill="#faeeda" stroke="#854f0b" stroke-width="0.5"/>
          <text class="ts-svg" x="302" y="92" text-anchor="middle" fill="#854f0b">Warten</text>
          <text class="ts-svg" x="302" y="108" text-anchor="middle" fill="#854f0b">Ready4Test</text>
          <rect x="354" y="70" width="100" height="52" rx="0" fill="#e1f5ee" stroke="#0f6e56" stroke-width="0.5"/>
          <text class="ts-svg" x="404" y="92" text-anchor="middle" fill="#085041">Aktiv</text>
          <text class="ts-svg" x="404" y="108" text-anchor="middle" fill="#0f6e56">Testing</text>
          <rect x="456" y="70" width="80" height="52" rx="0" fill="#faeeda" stroke="#854f0b" stroke-width="0.5"/>
          <text class="ts-svg" x="496" y="92" text-anchor="middle" fill="#854f0b">Warten</text>
          <text class="ts-svg" x="496" y="108" text-anchor="middle" fill="#854f0b">Blocked</text>
          <rect x="538" y="70" width="102" height="52" rx="8" fill="#e1f5ee" stroke="#0f6e56" stroke-width="0.5"/>
          <text class="ts-svg" x="589" y="92" text-anchor="middle" fill="#085041">Aktiv</text>
          <text class="ts-svg" x="589" y="108" text-anchor="middle" fill="#0f6e56">Review</text>
          <line x1="40" y1="148" x2="640" y2="148" stroke="var(--dimmer)" stroke-width="1" marker-end="url(#feh-a1)" marker-start="url(#feh-a1)"/>
          <text class="ts-svg" x="340" y="166" text-anchor="middle">Lead Time (Ready4Progress → Resolved)</text>
          <line x1="40" y1="64" x2="40" y2="155" stroke="var(--border)" stroke-width="0.5" stroke-dasharray="3 3"/>
          <line x1="640" y1="64" x2="640" y2="155" stroke="var(--border)" stroke-width="0.5" stroke-dasharray="3 3"/>
          <text class="ts-svg" x="40" y="58" text-anchor="middle">Start</text>
          <text class="ts-svg" x="640" y="58" text-anchor="middle">End</text>
          <line x1="40" y1="190" x2="640" y2="190" stroke="var(--border)" stroke-width="0.5"/>
          <text class="th-svg" x="340" y="218" text-anchor="middle">Formel</text>
          <rect x="40" y="232" width="174" height="54" rx="8" fill="#e1f5ee" stroke="#0f6e56" stroke-width="0.5"/>
          <text class="th-svg" x="127" y="254" text-anchor="middle" fill="#085041">Aktive Zeit</text>
          <text class="ts-svg" x="127" y="272" text-anchor="middle" fill="#0f6e56">Lead Time − Wartezeit</text>
          <text class="th-svg" x="240" y="262" text-anchor="middle">÷</text>
          <rect x="258" y="232" width="164" height="54" rx="8" fill="var(--bg4)" stroke="var(--border)" stroke-width="0.5"/>
          <text class="th-svg" x="340" y="254" text-anchor="middle">Lead Time</text>
          <text class="ts-svg" x="340" y="272" text-anchor="middle">Start → Resolved</text>
          <text class="th-svg" x="448" y="262" text-anchor="middle">× 100</text>
          <text class="th-svg" x="510" y="262" text-anchor="middle">=</text>
          <rect x="530" y="232" width="110" height="54" rx="8" fill="#eeedfe" stroke="#534ab7" stroke-width="0.5"/>
          <text class="th-svg" x="585" y="254" text-anchor="middle" fill="#3c3489">FE %</text>
          <text class="ts-svg" x="585" y="272" text-anchor="middle" fill="#534ab7">Flow Efficiency</text>
          <line x1="40" y1="310" x2="640" y2="310" stroke="var(--border)" stroke-width="0.5"/>
          <text class="th-svg" x="340" y="338" text-anchor="middle">Interpretation</text>
          <rect x="40" y="352" width="180" height="48" rx="8" fill="#fcebeb" stroke="#a32d2d" stroke-width="0.5"/>
          <text class="th-svg" x="130" y="372" text-anchor="middle" fill="#791f1f">FE% &lt; Ziellinie (40%)</text>
          <text class="ts-svg" x="130" y="390" text-anchor="middle" fill="#a32d2d">Wartezeiten dominieren</text>
          <line x1="226" y1="376" x2="454" y2="376" stroke="var(--dimmer)" stroke-width="0.5" marker-end="url(#feh-a1)"/>
          <text class="ts-svg" x="340" y="368" text-anchor="middle">Ziel: Wartezeit</text>
          <text class="ts-svg" x="340" y="386" text-anchor="middle">reduzieren</text>
          <rect x="460" y="352" width="180" height="48" rx="8" fill="#e1f5ee" stroke="#0f6e56" stroke-width="0.5"/>
          <text class="th-svg" x="550" y="372" text-anchor="middle" fill="#085041">FE% ≥ Ziellinie (40%)</text>
          <text class="ts-svg" x="550" y="390" text-anchor="middle" fill="#0f6e56">Prozess läuft effizient</text>
        </svg>
      </div>

      <hr style="border:none;border-top:1px solid var(--border);margin:0 0 24px">
      <h2 style="font-size:18px;font-weight:600;margin:0 0 10px;color:var(--text)">Aufbau &amp; Datenfluss</h2>
      <p style="margin:0 0 16px">Zwei Quellen fließen ein. <strong style="color:var(--text)">JiraStories</strong> ist Pflicht und liefert den gesamten Lebenszyklus eines Items. <strong style="color:var(--text)">JiraBlockermanagement</strong> ist optional und enthält <em>zusätzliche</em> Blockierzeit, die nicht schon in den Status-Spalten steckt.</p>

      <div style="background:var(--bg3);border:1px solid var(--border);border-radius:10px;padding:16px;margin:0 0 24px;overflow:hidden">
        <svg width="100%" viewBox="0 0 680 380" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <marker id="feh-a2" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M2 1L8 5L2 9" fill="none" stroke="var(--dimmer)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </marker>
          </defs>
          <rect x="20" y="20" width="200" height="150" rx="8" fill="#e6f1fb" stroke="#185fa5" stroke-width="0.5"/>
          <text class="th-svg" x="120" y="44" text-anchor="middle" fill="#0c447c">JiraStories</text>
          <text class="ts-svg" x="120" y="64" text-anchor="middle" fill="#185fa5">Pflichtquelle</text>
          <text class="ts-svg" x="36" y="88" fill="#185fa5">• Ready4Progress_first</text>
          <text class="ts-svg" x="36" y="106" fill="#185fa5">• Resolved (Ende + Monat)</text>
          <text class="ts-svg" x="36" y="124" fill="#185fa5">• Rejected (Ausschluss)</text>
          <text class="ts-svg" x="36" y="142" fill="#185fa5">• Warte-Status-Spalten</text>
          <text class="ts-svg" x="36" y="160" fill="#185fa5">• Jira-ID, Squad</text>
          <rect x="20" y="190" width="200" height="130" rx="8" fill="#faece7" stroke="#993c1d" stroke-width="0.5"/>
          <text class="th-svg" x="120" y="214" text-anchor="middle" fill="#712b13">JiraBlockermanagement</text>
          <text class="ts-svg" x="120" y="232" text-anchor="middle" fill="#993c1d">Optional</text>
          <text class="ts-svg" x="36" y="256" fill="#993c1d">• issues.key (= Jira-ID)</text>
          <text class="ts-svg" x="36" y="274" fill="#993c1d">• BlockiertWartendSeit</text>
          <text class="ts-svg" x="36" y="292" fill="#993c1d">• Blockiert/Wartend_Zustand</text>
          <text class="ts-svg" x="36" y="310" fill="#993c1d">• Squad</text>
          <line x1="220" y1="90" x2="288" y2="158" stroke="#378add" stroke-width="1" marker-end="url(#feh-a2)"/>
          <line x1="220" y1="255" x2="288" y2="193" stroke="#D85A30" stroke-width="1" marker-end="url(#feh-a2)"/>
          <rect x="290" y="130" width="160" height="80" rx="8" fill="#eeedfe" stroke="#534ab7" stroke-width="0.5"/>
          <text class="th-svg" x="370" y="158" text-anchor="middle" fill="#3c3489">_compute()</text>
          <text class="ts-svg" x="370" y="176" text-anchor="middle" fill="#534ab7">Filter · Join · FE%</text>
          <text class="ts-svg" x="370" y="194" text-anchor="middle" fill="#534ab7">je Item berechnen</text>
          <line x1="450" y1="170" x2="498" y2="170" stroke="var(--dimmer)" stroke-width="1" marker-end="url(#feh-a2)"/>
          <rect x="500" y="130" width="160" height="80" rx="8" fill="#e1f5ee" stroke="#0f6e56" stroke-width="0.5"/>
          <text class="th-svg" x="580" y="158" text-anchor="middle" fill="#085041">Monats-Aggregat</text>
          <text class="ts-svg" x="580" y="176" text-anchor="middle" fill="#0f6e56">Gruppierung nach</text>
          <text class="ts-svg" x="580" y="194" text-anchor="middle" fill="#0f6e56">Resolved-Monat · Median</text>
          <line x1="580" y1="210" x2="580" y2="268" stroke="var(--dimmer)" stroke-width="1" marker-end="url(#feh-a2)"/>
          <rect x="460" y="270" width="200" height="80" rx="8" fill="var(--bg4)" stroke="var(--border)" stroke-width="0.5"/>
          <text class="th-svg" x="560" y="298" text-anchor="middle">_renderChart()</text>
          <text class="ts-svg" x="560" y="316" text-anchor="middle">Linie oder Violin</text>
          <text class="ts-svg" x="560" y="334" text-anchor="middle">Ziellinie · Farbe · Tooltip</text>
          <text class="ts-svg" x="370" y="118" text-anchor="middle">Events: data · filter · resize · theme</text>
        </svg>
      </div>

      <hr style="border:none;border-top:1px solid var(--border);margin:0 0 24px">
      <h2 style="font-size:18px;font-weight:600;margin:0 0 10px;color:var(--text)">Berechnungslogik – Schritt für Schritt</h2>

      <div style="background:var(--bg3);border:1px solid var(--border);border-radius:10px;padding:16px;margin:0 0 16px;overflow:hidden">
        <svg width="100%" viewBox="0 0 680 500" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <marker id="feh-a3" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M2 1L8 5L2 9" fill="none" stroke="var(--dimmer)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </marker>
          </defs>
          <text class="ts-svg" x="30" y="66" text-anchor="middle">①</text>
          <text class="ts-svg" x="30" y="166" text-anchor="middle">②</text>
          <text class="ts-svg" x="30" y="282" text-anchor="middle">③</text>
          <text class="ts-svg" x="30" y="382" text-anchor="middle">④</text>
          <text class="ts-svg" x="30" y="460" text-anchor="middle">⑤</text>
          <rect x="48" y="36" width="590" height="56" rx="8" fill="var(--bg4)" stroke="var(--border)" stroke-width="0.5"/>
          <text class="th-svg" x="100" y="58" text-anchor="middle">Lead Time</text>
          <text class="ts-svg" x="100" y="76" text-anchor="middle">berechnen</text>
          <text class="ts-svg" x="380" y="58" text-anchor="middle">Resolved − Ready4Progress_first</text>
          <text class="ts-svg" x="380" y="76" text-anchor="middle">→ Gesamtdauer in Tagen (inkl. Wochenenden)</text>
          <line x1="343" y1="92" x2="343" y2="120" stroke="var(--dimmer)" stroke-width="1" marker-end="url(#feh-a3)"/>
          <rect x="48" y="122" width="590" height="76" rx="8" fill="#faeeda" stroke="#854f0b" stroke-width="0.5"/>
          <text class="th-svg" x="170" y="146" text-anchor="middle" fill="#633806">Wartezeit aus JiraStories</text>
          <text class="ts-svg" x="170" y="164" text-anchor="middle" fill="#854f0b">Dual-Period-Logik</text>
          <text class="ts-svg" x="450" y="140" text-anchor="middle" fill="#854f0b">Status: Blocked, Ready4Test,</text>
          <text class="ts-svg" x="450" y="158" text-anchor="middle" fill="#854f0b">Ready4QS, Ready4Review,</text>
          <text class="ts-svg" x="450" y="176" text-anchor="middle" fill="#854f0b">Ready4E2E-Test, Ready4Production</text>
          <line x1="343" y1="198" x2="343" y2="228" stroke="var(--dimmer)" stroke-width="1" marker-end="url(#feh-a3)"/>
          <rect x="48" y="230" width="590" height="90" rx="8" fill="#faece7" stroke="#993c1d" stroke-width="0.5"/>
          <text class="th-svg" x="190" y="254" text-anchor="middle" fill="#712b13">Zusatz-Wartezeit (JiraBlockermanagement)</text>
          <text class="ts-svg" x="190" y="272" text-anchor="middle" fill="#993c1d">+ addieren, wenn kein Duplikat</text>
          <text class="ts-svg" x="490" y="250" text-anchor="middle" fill="#993c1d">Dedup-Prüfung:</text>
          <text class="ts-svg" x="490" y="268" text-anchor="middle" fill="#993c1d">Blockiert/Wartend_Zustand</text>
          <text class="ts-svg" x="490" y="286" text-anchor="middle" fill="#993c1d">∈ WAIT_STATUS → überspringen</text>
          <text class="ts-svg" x="490" y="304" text-anchor="middle" fill="#993c1d">(wäre Doppelzählung)</text>
          <line x1="343" y1="320" x2="343" y2="350" stroke="var(--dimmer)" stroke-width="1" marker-end="url(#feh-a3)"/>
          <rect x="48" y="352" width="590" height="54" rx="8" fill="#eeedfe" stroke="#534ab7" stroke-width="0.5"/>
          <text class="th-svg" x="200" y="376" text-anchor="middle" fill="#3c3489">FE% berechnen</text>
          <text class="ts-svg" x="200" y="394" text-anchor="middle" fill="#534ab7">(LT − Wartezeit) ÷ LT × 100</text>
          <text class="ts-svg" x="490" y="376" text-anchor="middle" fill="#534ab7">Aktive Zeit ÷ Lead Time × 100</text>
          <text class="ts-svg" x="490" y="394" text-anchor="middle" fill="#534ab7">= Anteil echter Arbeit in %</text>
          <line x1="343" y1="406" x2="343" y2="434" stroke="var(--dimmer)" stroke-width="1" marker-end="url(#feh-a3)"/>
          <rect x="48" y="436" width="590" height="44" rx="8" fill="#e1f5ee" stroke="#0f6e56" stroke-width="0.5"/>
          <text class="th-svg" x="200" y="456" text-anchor="middle" fill="#085041">Monats-Median</text>
          <text class="ts-svg" x="200" y="472" text-anchor="middle" fill="#0f6e56">Gruppierung nach Resolved-Monat</text>
          <text class="ts-svg" x="490" y="456" text-anchor="middle" fill="#0f6e56">Median aller FE%-Werte</text>
          <text class="ts-svg" x="490" y="472" text-anchor="middle" fill="#0f6e56">pro Monat → ein Chartpunkt</text>
        </svg>
      </div>

      <p style="margin:0 0 10px"><strong style="color:var(--text)">① Lead Time</strong> ist einfach: Von <em>Ready4Progress_first</em> (Arbeit startet) bis <em>Resolved</em> (fertig geliefert) – die gesamte Spanne in Tagen.</p>
      <p style="margin:0 0 10px"><strong style="color:var(--text)">② Wartezeit aus JiraStories</strong> nutzt die <em>Dual-Period-Logik</em>: Manche Status-Spalten haben eine <code style="background:var(--bg4);padding:1px 4px;border-radius:3px;font-size:12px">_first</code>-Variante. War ein Item zweimal im selben Status, werden beide Perioden addiert. Schwelle: 0,5 Tage Abstand.</p>
      <p style="margin:0 0 10px"><strong style="color:var(--text)">③ Dedup</strong> verhindert Doppelzählung: Wenn JiraBlockermanagement eine Blockierung meldet, die schon als Status-Wartezeit erfasst ist, wird sie ignoriert.</p>

      <table style="width:100%;border-collapse:collapse;font-size:13px;margin:0 0 24px">
        <tr><th style="text-align:left;padding:7px 10px;background:var(--bg4);font-weight:500;border-bottom:1px solid var(--border)">Situation</th><th style="text-align:left;padding:7px 10px;background:var(--bg4);font-weight:500;border-bottom:1px solid var(--border)">Verhalten</th></tr>
        <tr><td style="padding:7px 10px;border-bottom:1px solid var(--border)">Ready4Progress_first oder Resolved fehlt</td><td style="padding:7px 10px;border-bottom:1px solid var(--border)">Item überspringen</td></tr>
        <tr><td style="padding:7px 10px;border-bottom:1px solid var(--border)">Lead Time = 0</td><td style="padding:7px 10px;border-bottom:1px solid var(--border)">Item überspringen (Division durch Null)</td></tr>
        <tr><td style="padding:7px 10px;border-bottom:1px solid var(--border)">Rejected gefüllt</td><td style="padding:7px 10px;border-bottom:1px solid var(--border)">Item überspringen</td></tr>
        <tr><td style="padding:7px 10px;border-bottom:1px solid var(--border)">Wartezeit &gt; Lead Time</td><td style="padding:7px 10px;border-bottom:1px solid var(--border)">Datenfehler – ausschließen + in diagEl zählen</td></tr>
        <tr><td style="padding:7px 10px">Kein Warte-Status, kein JiraBlockermanagement</td><td style="padding:7px 10px">FE% = 100 %</td></tr>
      </table>

      <hr style="border:none;border-top:1px solid var(--border);margin:0 0 24px">
      <h2 style="font-size:18px;font-weight:600;margin:0 0 10px;color:var(--text)">Die zwei Chart-Modi</h2>
      <table style="width:100%;border-collapse:collapse;font-size:13px;margin:0 0 24px">
        <tr><th style="text-align:left;padding:7px 10px;background:var(--bg4);font-weight:500;border-bottom:1px solid var(--border)">Modus</th><th style="text-align:left;padding:7px 10px;background:var(--bg4);font-weight:500;border-bottom:1px solid var(--border)">Was man sieht</th></tr>
        <tr><td style="padding:7px 10px;border-bottom:1px solid var(--border)"><strong style="color:var(--text)">Linie</strong></td><td style="padding:7px 10px;border-bottom:1px solid var(--border)">Median-FE% pro Monat als Punkt, verbunden durch Linien. Schneller Überblick über den Trend.</td></tr>
        <tr><td style="padding:7px 10px"><strong style="color:var(--text)">Violin</strong></td><td style="padding:7px 10px">Zusätzlich die Streuung aller Einzelwerte pro Monat (KDE-Kurve, IQR-Box, Median-Punkt). Zeigt, ob alle Items ähnlich performen oder ob Ausreißer das Bild verzerren.</td></tr>
      </table>

      <div style="background:var(--bg4);border-left:3px solid var(--blue);border-radius:0 6px 6px 0;padding:10px 14px;margin:0 0 24px;font-size:13px">
        Punkte und Median-Dots werden <strong style="color:var(--text)">grün</strong> gefärbt, wenn FE% ≥ Ziellinie (Standard: 40 %), sonst <strong style="color:var(--text)">rot</strong>. Die Ziellinie ist per Slider einstellbar und kann ausgeblendet werden. Alle Einstellungen überleben einen Browser-Reload (<code style="font-size:11px">localStorage-Key: fhwa_flowefficiency</code>).
      </div>

      <hr style="border:none;border-top:1px solid var(--border);margin:0 0 24px">
      <h2 style="font-size:18px;font-weight:600;margin:0 0 10px;color:var(--text)">Einstellungen</h2>
      <table style="width:100%;border-collapse:collapse;font-size:13px;margin:0 0 24px">
        <tr><th style="text-align:left;padding:7px 10px;background:var(--bg4);font-weight:500;border-bottom:1px solid var(--border)">Einstellung</th><th style="text-align:left;padding:7px 10px;background:var(--bg4);font-weight:500;border-bottom:1px solid var(--border)">Default</th><th style="text-align:left;padding:7px 10px;background:var(--bg4);font-weight:500;border-bottom:1px solid var(--border)">Bereich</th><th style="text-align:left;padding:7px 10px;background:var(--bg4);font-weight:500;border-bottom:1px solid var(--border)">Effekt</th></tr>
        <tr><td style="padding:7px 10px;border-bottom:1px solid var(--border)">Monate (Fenster)</td><td style="padding:7px 10px;border-bottom:1px solid var(--border)">12</td><td style="padding:7px 10px;border-bottom:1px solid var(--border)">3–36</td><td style="padding:7px 10px;border-bottom:1px solid var(--border)">Wie viele Monate rückwärts werden angezeigt</td></tr>
        <tr><td style="padding:7px 10px;border-bottom:1px solid var(--border)">Ziellinie FE%</td><td style="padding:7px 10px;border-bottom:1px solid var(--border)">40 %</td><td style="padding:7px 10px;border-bottom:1px solid var(--border)">0–100 %</td><td style="padding:7px 10px;border-bottom:1px solid var(--border)">Ab welchem Wert ein Punkt grün wird</td></tr>
        <tr><td style="padding:7px 10px;border-bottom:1px solid var(--border)">Ziellinie anzeigen</td><td style="padding:7px 10px;border-bottom:1px solid var(--border)">an</td><td style="padding:7px 10px;border-bottom:1px solid var(--border)">an / aus</td><td style="padding:7px 10px;border-bottom:1px solid var(--border)">Ziellinie einblenden oder ausblenden</td></tr>
        <tr><td style="padding:7px 10px">Mode</td><td style="padding:7px 10px">Linie</td><td style="padding:7px 10px">Linie / Violin</td><td style="padding:7px 10px">Chart-Typ umschalten</td></tr>
      </table>

      <hr style="border:none;border-top:1px solid var(--border);margin:0 0 24px">
      <h2 style="font-size:18px;font-weight:600;margin:0 0 10px;color:var(--text)">Leerzustände &amp; Fehlermeldungen</h2>
      <table style="width:100%;border-collapse:collapse;font-size:13px;margin:0 0 8px">
        <tr><th style="text-align:left;padding:7px 10px;background:var(--bg4);font-weight:500;border-bottom:1px solid var(--border)">Situation</th><th style="text-align:left;padding:7px 10px;background:var(--bg4);font-weight:500;border-bottom:1px solid var(--border)">Verhalten</th></tr>
        <tr><td style="padding:7px 10px;border-bottom:1px solid var(--border)">Keine Datei geladen</td><td style="padding:7px 10px;border-bottom:1px solid var(--border)">Tile leer, Standard-Leertext</td></tr>
        <tr><td style="padding:7px 10px;border-bottom:1px solid var(--border)">JiraBlockermanagement fehlt</td><td style="padding:7px 10px;border-bottom:1px solid var(--border)">Visual rechnet trotzdem (nur JiraStories-Wartezeiten); Hinweis in der Diag-Leiste</td></tr>
        <tr><td style="padding:7px 10px">Alle Items nach Filter ausgeblendet</td><td style="padding:7px 10px">SVG leer; Meldung: „Keine Resolved Items im Zeitraum"</td></tr>
      </table>

    </div>
  `;

  feHelpPanel.querySelector('#fe-help-close').addEventListener('click', _closeHelp);
  document.addEventListener('keydown', function(e) { if (e.key === 'Escape') { _closeHelp(); _closeErrModal(); } });

  // ── Error-items modal ──────────────────────────
  const feErrBackdrop = document.createElement('div');
  feErrBackdrop.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:400';
  feErrBackdrop.addEventListener('click', _closeErrModal);
  document.body.appendChild(feErrBackdrop);

  const feErrPanel = document.createElement('div');
  feErrPanel.style.cssText = [
    'display:none', 'position:fixed', 'top:50%', 'left:50%',
    'transform:translate(-50%,-50%)',
    'width:min(640px,92vw)', 'max-height:80vh',
    'background:var(--bg2)', 'border:1px solid var(--border)', 'border-radius:8px',
    'z-index:401', 'box-shadow:0 12px 50px rgba(0,0,0,.55)',
    'flex-direction:column', 'font-family:var(--sans)', 'color:var(--text)',
    'overflow:hidden',
  ].join(';');
  document.body.appendChild(feErrPanel);

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

  function _openHelp() {
    feHelpBackdrop.style.display = 'block';
    feHelpPanel.style.display    = 'flex';
  }
  function _closeHelp() {
    feHelpBackdrop.style.display = 'none';
    feHelpPanel.style.display    = 'none';
  }

  function _renderErrTable() {
    var sorted = _errorItems.slice().sort(function(a, b) {
      if (_errSort.col === 'jiraId')    return _errSort.dir * a.jiraId.localeCompare(b.jiraId);
      if (_errSort.col === 'issueType') return _errSort.dir * a.issueType.localeCompare(b.issueType);
      return _errSort.dir * ((a.totalWait - a.lt) - (b.totalWait - b.lt));
    });

    var urlTpl = core.state.urlTemplate || '';

    var rowsHtml = sorted.map(function(item) {
      var jiraCell;
      if (urlTpl && item.jiraId !== '–') {
        var safeId = item.jiraId.replace(/[^A-Za-z0-9\-_]/g, '');
        var url    = urlTpl.replace('{id}', safeId);
        jiraCell   = '<a href="' + url + '" target="_blank" rel="noopener noreferrer"' +
          ' style="color:var(--blue);text-decoration:none;font-family:var(--mono)">' + item.jiraId + '</a>';
      } else {
        jiraCell = '<span style="font-family:var(--mono)">' + item.jiraId + '</span>';
      }

      var bdParts = Object.keys(item.breakdown)
        .filter(function(k) { return item.breakdown[k] > 0; })
        .sort(function(a, b) { return item.breakdown[b] - item.breakdown[a]; })
        .map(function(k) { return k + ': ' + item.breakdown[k].toFixed(1) + 'd'; });
      var fk = 'Wartezeit ' + item.totalWait.toFixed(1) + 'd > LT ' + item.lt.toFixed(1) + 'd';
      if (bdParts.length) fk += ' (' + bdParts.join(', ') + ')';

      return '<tr>' +
        '<td style="padding:7px 10px;border-bottom:1px solid var(--border)">' + jiraCell + '</td>' +
        '<td style="padding:7px 10px;border-bottom:1px solid var(--border);color:var(--dim)">' + item.issueType + '</td>' +
        '<td style="padding:7px 10px;border-bottom:1px solid var(--border);color:var(--dim);font-size:11px">' + fk + '</td>' +
        '</tr>';
    }).join('');

    function si(col) {
      if (_errSort.col !== col) return '<span style="opacity:.3;font-size:9px"> ↕</span>';
      return _errSort.dir === -1
        ? '<span style="font-size:9px"> ↓</span>'
        : '<span style="font-size:9px"> ↑</span>';
    }
    var thBase = 'text-align:left;padding:8px 10px;background:var(--bg4);font-weight:500;border-bottom:1px solid var(--border);' +
      'cursor:pointer;user-select:none;white-space:nowrap;font-size:11px;text-transform:uppercase;letter-spacing:.06em;';

    feErrPanel.innerHTML =
      '<div style="display:flex;align-items:center;justify-content:space-between;' +
        'padding:14px 18px;border-bottom:1px solid var(--border);flex-shrink:0">' +
        '<div style="font-size:14px;font-weight:700">⚠ Ausgeschlossene Items (' + _errorItems.length + ')</div>' +
        '<button id="fe-err-close" style="background:none;border:none;cursor:pointer;font-size:18px;' +
          'color:var(--dim);line-height:1;padding:0 4px;font-family:var(--sans)">✕</button>' +
      '</div>' +
      '<div style="overflow-y:auto;flex:1">' +
        '<table style="width:100%;border-collapse:collapse;font-size:12px;color:var(--text)">' +
          '<thead><tr>' +
            '<th data-sort="jiraId" style="' + thBase + (_errSort.col === 'jiraId' ? 'color:var(--text)' : 'color:var(--dim)') + '">Jira-ID' + si('jiraId') + '</th>' +
            '<th data-sort="issueType" style="' + thBase + (_errSort.col === 'issueType' ? 'color:var(--text)' : 'color:var(--dim)') + '">Issue-Type' + si('issueType') + '</th>' +
            '<th data-sort="diff" style="' + thBase + (_errSort.col === 'diff' ? 'color:var(--text)' : 'color:var(--dim)') + '">Fehlerkonstellation' + si('diff') + '</th>' +
          '</tr></thead>' +
          '<tbody>' + rowsHtml + '</tbody>' +
        '</table>' +
      '</div>';

    feErrPanel.querySelector('#fe-err-close').addEventListener('click', _closeErrModal);
    feErrPanel.querySelectorAll('th[data-sort]').forEach(function(th) {
      th.addEventListener('click', function() {
        var col = th.dataset.sort;
        if (_errSort.col === col) {
          _errSort.dir *= -1;
        } else {
          _errSort.col = col;
          _errSort.dir = (col === 'diff') ? -1 : 1;
        }
        _renderErrTable();
      });
    });
  }

  function _openErrModal() {
    _renderErrTable();
    feErrBackdrop.style.display = 'block';
    feErrPanel.style.display    = 'flex';
  }

  function _closeErrModal() {
    feErrBackdrop.style.display = 'none';
    feErrPanel.style.display    = 'none';
  }

  function _toggleExplanation() {
    showExplanation = !showExplanation;
    explanationEl.style.maxHeight = showExplanation ? explanationEl.scrollHeight + 'px' : '0';
    diagLeft.style.opacity = showExplanation ? '0.7' : '1';
    // Re-render after CSS transition (220ms) so SVG fills the correct remaining height
    setTimeout(_renderChart, 240);
  }

  function _updateModeToggle() {
    headerExtraEl.querySelectorAll('[data-mode]').forEach(btn => {
      btn.classList.toggle('p-blue', btn.dataset.mode === cfg.mode);
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
    _errorItems = [];

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
        var isKnown = WAIT_STATUS_LOWER.includes(ep.zustand.toLowerCase());
        if (!isKnown && ep.dauer > 0) {
          waiteZ += ep.dauer;
          var label = ep.zustand || 'Blockiert';
          breakdown[label] = (breakdown[label] || 0) + ep.dauer;
        }
      });

      var totalWait = waiteJS + waiteZ;

      // Edge case: waiting > LT → data error
      if (totalWait > lt) {
        errors++;
        _errorItems.push({
          jiraId:    jid || '–',
          issueType: String(row['Issue-Type'] || '–').trim(),
          totalWait: Math.round(totalWait * 10) / 10,
          lt:        Math.round(lt * 10) / 10,
          breakdown: Object.assign({}, breakdown),
        });
        return;
      }

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
    if (W < 20) return;
    var H  = Math.max(60, contentEl.clientHeight - explanationEl.offsetHeight) || 280;
    var P  = { t: 18, r: 56, b: 34, l: 40 };
    var cW = W - P.l - P.r;
    var cH = H - P.t - P.b;

    var data = _monthData;
    if (!data.length) {
      svg.innerHTML = '';
      diagMid.textContent = 'Keine Resolved Items im Zeitraum — Datei laden oder Filter anpassen';
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

    // N label (top-right, wie Lead Time)
    var totalN = data.reduce(function(s, d) { return s + d.n; }, 0);
    parts.push('<text x="' + (P.l + cW) + '" y="' + (P.t - 4) + '"' +
      ' text-anchor="end" font-size="11" fill="' + axisCol + '" font-family="var(--mono)">N = ' + totalN + '</text>');

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
    var hasBM = (core.state.sheets['JiraBlockermanagement'] || []).length > 0;
    while (diagMid.firstChild) diagMid.removeChild(diagMid.firstChild);
    if (_errors > 0) {
      var errA = document.createElement('a');
      errA.textContent = _errors + ' Datenfehler ausgeschlossen';
      errA.style.cssText = 'color:var(--blue);cursor:pointer;text-decoration:none';
      errA.addEventListener('click', _openErrModal);
      diagMid.appendChild(errA);
    }
    if (!hasBM) {
      if (_errors > 0) diagMid.appendChild(document.createTextNode(' · '));
      diagMid.appendChild(document.createTextNode('JiraBlockermanagement fehlt'));
    }
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
