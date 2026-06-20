// ════════════════════════════════════════════════
// core.js  –  Shared Engine (State · Grid · Theme · Utils · Events)
// Flow Analytics Dashboard v2.1
// Phase 1a: Multi-Sheet-Loading + Navigation/Sidebar
// ════════════════════════════════════════════════

import {
  toDate as _toDate,
  dur    as _dur,
  pct    as _pct,
  fmt    as _fmt,
  intTicks as _intTicks,
} from './calc/core.calc.js';

// ── Constants (exported for use in visuals) ──
export const TARGET_SHEET      = 'JiraStories';
export const LT_START_DEFAULT  = 'Ready4Progress_first';
export const LT_END_DEFAULT    = 'Resolved';

// ── Default Status-Reihenfolge (globaler Standard für alle Visuals) ──
// Queue-Status: New → Evaluated → Refinement → Ready4Progress
// WIP-Status:   In Progress, Blocked, Ready4Test, in Test, Ready4QS, In QS,
//               Ready4Review, Ready4E2E-Test, Ready4Production
// Done:         Resolved
// Versteckt:    Rejected, Resume (am Ende, per excludeList/hiddenGlobal ausgeblendet)
export const DEFAULT_STATUS_ORDER = [
  'New',
  'Evaluated',
  'Analysed',          // Queue Status – zwischen Evaluated und Refinement
  'Refinement',
  'Ready4Progress',
  'In Progress',
  'Blocked',
  'Ready4Test',
  'In Test',           // war 'in Test' – Schreibweise an Echtdaten angepasst
  'Ready4QS',
  'In QS',
  'Ready4Review',
  'Ready4E2E-Test',
  'Ready4Production',
  'Resolved',
  'Rejected',
  'Resume',
];

const GRID_COLS  = 12;
const GRID_ROW_H = 70;   // px per grid row

// ── Card → Page routing (kein Visual-JS anfassen nötig) ──
// Neue Visuals hier eintragen: 'visualId': 'pageId'
const CARD_PAGE_MAP = {
  'heatmap':          'heatmap',
  'scatter':          'scatter',
  'wipage':           'wipage',
  'boxchart':         'lieferfahigkeit',
  'wip':              'lieferfahigkeit',
  'flowefficiency':   'lieferfahigkeit',
  'happinessfaktor':  'lieferfahigkeit',
  'saydoratioepics':  'lieferfahigkeit',
  'montecarlo':       'monte',
};

const COLOR_MIN_DARK  = [28,  42,  63 ];
const COLOR_MAX_DARK  = [192, 57,  43 ];
const COLOR_MIN_LIGHT = [219, 234, 254];
const COLOR_MAX_LIGHT = [251, 146, 60 ];

const PALETTE_DARK  = ['#38bdf8','#fb923c','#a78bfa','#4ade80','#f472b6','#facc15','#34d399','#f87171'];
const PALETTE_LIGHT = ['#0284c7','#c2410c','#7c3aed','#16a34a','#be185d','#b45309','#0f766e','#b91c1c'];

export const META_COLS = new Set([
  'Jira-ID','project.key','project.name','Issue-Type',
  'Created (Status New)','Blockiert/Wartend','Issue-Status','Status-Kategorie',
  'Blockiert/Wartend_Grund','Blockiert/Wartend_Zustand',
  'TimeInStatusBlocked','LeadTime','CycleTime','TimeInWIP','TimeInActualStatus',
  'Squad','Modifier','LoadedFromJiraAt'
]);

// ── Internal grid state ──
const _listeners  = {};           // { event: [fn, …] }
const _gridMap    = {};           // { id: {col,row,w,h} }
const _cardMap    = {};           // { id: { el, defaultGrid, pageId } }
let   _cardDrag   = null;
let   _cardResize = null;
let   _layoutInit = false;        // guard against double-init on second file load

// ════════════════════════════════════════════════
// Public singleton
// ════════════════════════════════════════════════
export const core = {

  // ── Shared application state (read-only for visuals) ──
  state: {
    rows:         [],
    sheets:       {},     // { [sheetName]: Row[] } – alle geladenen Worksheets
                          // Zugriff: core.state.sheets['Epics'] ?? []
                          // rows === sheets['JiraStories'] (Alias, immer identisch)
    sheetsRaw:    {},     // { [sheetName]: any[][] } – 2D-Array-Format (header:1)
                          // für Sheets mit Custom-Headern (z.B. 'Happiness Faktor')
    dateCols:     [],
    states:       [],     // { name, entryCol, exitCol }[]
    stateOrder:   [],     // ordered names as detected from data
    allSquads:       [],
    allIssueTypes:   [],
    hasSquad:        false,
    hasIssueType:    false,
    squadFilter:     [],  // [] = alle aktiv
    issueTypeFilter: [],  // [] = alle aktiv
    fileName:     '',
    sheetName:    '',
    urlTemplate:  '',     // global Jira URL-Template
    activePage:   '',     // aktuell sichtbare Page-ID
  },

  // ── Event bus ──────────────────────────────────
  on(event, fn) {
    if (!_listeners[event]) _listeners[event] = [];
    _listeners[event].push(fn);
  },

  emit(event) {
    (_listeners[event] || []).forEach(fn => {
      try { fn(); } catch (e) { console.error('[core] emit', event, e); }
    });
  },

  // ── Storage ────────────────────────────────────
  save(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
  },

  load(key, def) {
    try {
      const v = localStorage.getItem(key);
      return v != null ? JSON.parse(v) : def;
    } catch (e) { return def; }
  },

  // ── Globale Status-Reihenfolge ──────────────────
  /**
   * Lädt die globale Status-Reihenfolge aus localStorage.
   * Basis ist DEFAULT_STATUS_ORDER (falls noch nicht gespeichert).
   * Wenn knownNames übergeben: unbekannte Namen werden ans Ende angehängt.
   * @param {string[]} [knownNames]  – aus Excel erkannte Status-Namen
   * @returns {string[]}
   */
  loadGlobalStatusOrder(knownNames) {
    let saved = null;
    try {
      const v = localStorage.getItem('fhwa_status_order');
      if (v) saved = JSON.parse(v);
    } catch (e) {}
    const base = saved ? [...saved] : [...DEFAULT_STATUS_ORDER];
    if (knownNames && knownNames.length) {
      // Case-insensitive Dedup: verhindert dass z.B. 'In Test' als Extra angehängt
      // wird, wenn der gespeicherte Order noch 'in Test' enthält.
      const baseLower = base.map(n => n.toLowerCase());
      knownNames.forEach(n => {
        if (!base.includes(n) && !baseLower.includes(n.toLowerCase())) {
          base.push(n);
        }
      });
    }
    return base;
  },

  /**
   * Speichert die globale Status-Reihenfolge und benachrichtigt alle Visuals.
   * @param {string[]} order
   */
  saveGlobalStatusOrder(order) {
    try { localStorage.setItem('fhwa_status_order', JSON.stringify(order)); } catch (e) {}
    core.emit('statusOrder');
  },

  // ── Data utilities ─────────────────────────────
  /** Returns rows after applying active squadFilter and issueTypeFilter. */
  filteredRows() {
    const s = core.state;
    let rows = s.rows;
    if (s.squadFilter.length)     rows = rows.filter(r => s.squadFilter.indexOf(String(r['Squad'] || '')) >= 0);
    if (s.issueTypeFilter.length) rows = rows.filter(r => s.issueTypeFilter.indexOf(String(r['Issue-Type'] || '')) >= 0);
    return rows;
  },

  toDate(v)       { return _toDate(v); },
  dur(a, b)       { return _dur(a, b); },
  pct(arr, p)     { return _pct(arr, p); },
  fmt(v)          { return _fmt(v); },
  intTicks(max, n){ return _intTicks(max, n); },

  // ── Theme ──────────────────────────────────────
  isLight() {
    return document.documentElement.getAttribute('data-theme') === 'light';
  },

  palette() { return core.isLight() ? PALETTE_LIGHT : PALETTE_DARK; },

  lerp(t) {
    const [r1, g1, b1] = core.isLight() ? COLOR_MIN_LIGHT : COLOR_MIN_DARK;
    const [r2, g2, b2] = core.isLight() ? COLOR_MAX_LIGHT : COLOR_MAX_DARK;
    t = Math.max(0, Math.min(1, t));
    return `rgb(${Math.round(r1+(r2-r1)*t)},${Math.round(g1+(g2-g1)*t)},${Math.round(b1+(b2-b1)*t)})`;
  },

  getCellContrast(t) {
    const [r1, g1, b1] = core.isLight() ? COLOR_MIN_LIGHT : COLOR_MIN_DARK;
    const [r2, g2, b2] = core.isLight() ? COLOR_MAX_LIGHT : COLOR_MAX_DARK;
    t = Math.max(0, Math.min(1, t));
    const r = r1+(r2-r1)*t, g = g1+(g2-g1)*t, b = b1+(b2-b1)*t;
    return (0.299*r + 0.587*g + 0.114*b) / 255 > 0.45 ? 'dark' : 'light';
  },

  scatterColors() {
    const lt = core.isLight();
    return {
      plotBg:         lt ? 'rgba(248,250,252,0.9)'  : 'rgba(11,17,32,0.55)',
      gridLine:       lt ? '#e2e8f0'                : '#2a3d5c',
      axisLine:       lt ? '#94a3b8'                : '#3d5068',
      axisLabel:      lt ? '#64748b'                : '#7a8fa8',
      axisLabelFaint: lt ? '#94a3b8'                : '#3d5068',
      legendBg:       lt ? 'rgba(248,250,252,0.95)' : 'rgba(22,32,53,0.92)',
      legendBorder:   lt ? '#cbd5e1'                : '#2a3d5c',
      legendText:     lt ? '#1e293b'                : '#e8f0fe',
      nText:          lt ? '#94a3b8'                : '#4d6a88',
      dotStroke:      lt ? 'rgba(255,255,255,0.6)'  : 'rgba(0,0,0,0.45)',
      dotStrokeW: 1.5,
    };
  },

  toggleTheme() {
    const next = core.isLight() ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', next);
    const btn = document.getElementById('btn-theme');
    if (btn) btn.textContent = next === 'light' ? '🌙 Dark' : '☀ Light';
    core.save('fhwa_theme', next);
    core.emit('theme');
  },

  initTheme() {
    const saved = core.load('fhwa_theme', 'dark');
    document.documentElement.setAttribute('data-theme', saved);
    const btn = document.getElementById('btn-theme');
    if (btn) btn.textContent = saved === 'light' ? '🌙 Dark' : '☀ Light';
  },

  // ── Navigation ─────────────────────────────────
  /**
   * Wechselt zur gewählten Page: blendet alle Pages aus, zeigt pageId,
   * setzt den aktiven Sidebar-Link und speichert in localStorage.
   * Emittiert nach kurzem Delay 'resize' damit Visuals mit korrekter
   * Container-Größe rendern.
   */
  showPage(pageId) {
    document.querySelectorAll('.page').forEach(p => { p.style.display = 'none'; });
    const page = document.getElementById('page-' + pageId);
    if (page) page.style.display = page.classList.contains('page-flex') ? 'flex' : 'block';
    document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
    document.querySelector(`.sidebar-link[data-page="${pageId}"]`)?.classList.add('active');
    // Datencheck-Button aktiv/inaktiv in Sidebar-Bottom
    const dcBtn = document.getElementById('btn-datencheck');
    if (dcBtn) dcBtn.classList.toggle('sb-active', pageId === 'datencheck');
    core.state.activePage = pageId;
    core.save('fhwa_activePage', pageId);
    // Layout neu anwenden + Resize-Event nach DOM-Paint.
    // Cards auf bisher versteckten Pages hatten clientWidth=0 beim initLayout.
    // Einzelkarten-Pages: col/row/w immer auf 0/0/12 normalisieren (old layout fix).
    setTimeout(() => {
      const pageCardIds = Object.entries(_cardMap)
        .filter(([, c]) => c.pageId === pageId)
        .map(([id]) => id);
      if (pageCardIds.length === 1) {
        const id = pageCardIds[0];
        if (_gridMap[id]) {
          _gridMap[id].col = 0;
          _gridMap[id].row = 0;
          _gridMap[id].w   = GRID_COLS;
        }
      }
      pageCardIds.forEach(id => _applyCardLayout(id));
      _updateCanvasH();
      core.emit('resize');
    }, 50);
  },

  // ── Card factory ───────────────────────────────
  /**
   * Erzeugt ein .card-Element und hängt es an den richtigen Page-Canvas
   * (laut CARD_PAGE_MAP). Registriert die Card im Grid.
   * @param {string} id          – Visual ID (z.B. 'heatmap'). Card bekommt id="card-heatmap"
   * @param {string} title       – innerHTML für .card-title
   * @param {object} defaultGrid – { col, row, w, h } in Grid-Einheiten
   * @returns {{ cardEl, contentEl, headerExtraEl, diagEl }}
   */
  createCard({ id, title, defaultGrid }) {
    const cardEl = document.createElement('div');
    cardEl.className = 'card';
    cardEl.id = 'card-' + id;

    // ── Header ──
    const header = document.createElement('div');
    header.className = 'card-header';

    const handle = document.createElement('span');
    handle.className = 'card-drag-handle';
    handle.id = id + '-drag-handle';
    handle.textContent = '⠿';

    const titleEl = document.createElement('span');
    titleEl.className = 'card-title';
    titleEl.innerHTML = title;

    const sep = document.createElement('div');
    sep.className = 'tb-sep';

    const headerExtraEl = document.createElement('div');
    headerExtraEl.style.cssText = 'display:contents';

    header.appendChild(handle);
    header.appendChild(titleEl);
    header.appendChild(sep);
    header.appendChild(headerExtraEl);
    cardEl.appendChild(header);

    // ── Content area ──
    const contentEl = document.createElement('div');
    contentEl.className = 'card-content';
    cardEl.appendChild(contentEl);

    // ── Diag bar ──
    const diagEl = document.createElement('div');
    diagEl.className = 'diag-bar';
    diagEl.textContent = '—';
    cardEl.appendChild(diagEl);

    // ── Resize handle ──
    const resizeHandle = document.createElement('div');
    resizeHandle.className = 'card-resize-handle';
    resizeHandle.id = id + '-resize-handle';
    cardEl.appendChild(resizeHandle);

    // ── An den richtigen Page-Canvas hängen ──
    const pageId = CARD_PAGE_MAP[id] || 'lieferfahigkeit';
    const canvas  = document.getElementById('page-canvas-' + pageId);
    (canvas || document.body).appendChild(cardEl);

    // ── Grid registration ──
    const savedLayout = core.load('fhwa_layout2', {});
    _gridMap[id] = savedLayout[id] ? { ...savedLayout[id] } : { ...defaultGrid };
    _cardMap[id] = { el: cardEl, defaultGrid: { ...defaultGrid }, pageId };

    return { cardEl, contentEl, headerExtraEl, diagEl };
  },

  // ── Tile factory ───────────────────────────────
  /**
   * Erzeugt ein kompaktes .tile-Element und hängt es an den Tile-Canvas der
   * zugehörigen Page (laut CARD_PAGE_MAP). Kein Drag, kein Resize, kein Grid.
   * @param {string} id    – Visual ID (z.B. 'boxchart'). Tile bekommt id="tile-boxchart"
   * @param {string} title – innerHTML für .tile-title
   * @returns {{ tileEl, contentEl, headerExtraEl, diagEl }}
   */
  createTile({ id, title }) {
    const tileEl = document.createElement('div');
    tileEl.className = 'tile';
    tileEl.id = 'tile-' + id;

    // ── Header ──
    const header = document.createElement('div');
    header.className = 'tile-header';

    const titleEl = document.createElement('span');
    titleEl.className = 'tile-title';
    titleEl.innerHTML = title;

    const spacer = document.createElement('div');
    spacer.className = 'tile-spacer';

    const headerExtraEl = document.createElement('div');
    headerExtraEl.style.cssText = 'display:contents';

    header.appendChild(titleEl);
    header.appendChild(spacer);
    header.appendChild(headerExtraEl);
    tileEl.appendChild(header);

    // ── Content area ──
    const contentEl = document.createElement('div');
    contentEl.className = 'tile-content';
    tileEl.appendChild(contentEl);

    // ── Diag bar ──
    const diagEl = document.createElement('div');
    diagEl.className = 'diag-bar';
    diagEl.textContent = '—';
    tileEl.appendChild(diagEl);

    // ── An den richtigen Tile-Canvas hängen ──
    const pageId = CARD_PAGE_MAP[id] || 'lieferfahigkeit';
    const canvas = document.getElementById('tile-canvas-' + pageId);
    (canvas || document.body).appendChild(tileEl);

    return { tileEl, contentEl, headerExtraEl, diagEl };
  },

  // ── App boot ───────────────────────────────────
  initApp() {
    core.initTheme();

    // Load saved global state
    const g = core.load('fhwa_global', null);
    if (g && Array.isArray(g.squadFilter))      core.state.squadFilter      = g.squadFilter;
    if (g && Array.isArray(g.issueTypeFilter))  core.state.issueTypeFilter  = g.issueTypeFilter;
    if (g && typeof g.urlTemplate === 'string') core.state.urlTemplate      = g.urlTemplate;

    _initFileUpload();
    _initSidebarButtons();
    _initSidebar();
  },
};

// ════════════════════════════════════════════════
// Private: Grid helpers
// ════════════════════════════════════════════════

/**
 * Gibt die Breite einer Grid-Spalte in px zurück.
 * Sucht den Canvas-Container der Card per DOM-Traversal, damit jede Page
 * ihren eigenen Koordinatenraum hat.
 */
function _getColW(id) {
  if (id) {
    const card   = document.getElementById('card-' + id);
    const canvas = card?.parentElement;
    if (canvas && canvas.clientWidth) return canvas.clientWidth / GRID_COLS;
  }
  // Fallback: erster Page-Canvas mit positiver Breite
  const allCanvases = document.querySelectorAll('.page-canvas');
  for (const c of allCanvases) {
    if (c.clientWidth > 0) return c.clientWidth / GRID_COLS;
  }
  // Letzter Ausweg: Fensterbreite minus Sidebar
  const sidebar = document.querySelector('.sidebar');
  const sidebarW = sidebar ? sidebar.offsetWidth : 196;
  return (window.innerWidth - sidebarW) / GRID_COLS;
}

function _applyCardLayout(id) {
  const card = document.getElementById('card-' + id);
  if (!card || !_gridMap[id]) return;
  const g  = _gridMap[id];
  const cw = _getColW(id);
  card.style.left   = (g.col * cw + 4)        + 'px';
  card.style.top    = (g.row * GRID_ROW_H + 4) + 'px';
  card.style.width  = (g.w   * cw - 8)         + 'px';
  card.style.height = (g.h   * GRID_ROW_H - 8) + 'px';
}

/** Setzt minHeight auf jedem Page-Canvas so dass Drag-Cards scrollbar sind. */
function _updateCanvasH() {
  document.querySelectorAll('.page-canvas').forEach(canvas => {
    const page  = canvas.closest('.page');
    const pageH = page ? page.clientHeight : 0;
    const maxB  = [...canvas.querySelectorAll('.card')].reduce((m, c) => {
      return Math.max(m, (parseFloat(c.style.top) || 0) + c.offsetHeight + 20);
    }, 0);
    canvas.style.minHeight = Math.max(maxB, pageH) + 'px';
  });
}

function _saveLayout() {
  const layout = {};
  Object.keys(_gridMap).forEach(id => { layout[id] = { ..._gridMap[id] }; });
  core.save('fhwa_layout2', layout);
}

function _gridsOverlap(a, b) {
  return a.col < b.col + b.w && a.col + a.w > b.col &&
         a.row < b.row + b.h && a.row + a.h > b.row;
}

function _snapToGrid(cardId, origGrid) {
  const card = document.getElementById(cardId);
  if (!card) return;
  const id  = cardId.replace('card-', '');
  const cw  = _getColW(id);
  const left = parseFloat(card.style.left) || 0;
  const top  = parseFloat(card.style.top)  || 0;
  const w = card.offsetWidth, h = card.offsetHeight;

  let col    = Math.max(0, Math.round(left / cw));
  const row  = Math.max(0, Math.round(top  / GRID_ROW_H));
  let wCols  = Math.max(2, Math.round(w / cw));
  const hRows = Math.max(4, Math.round(h / GRID_ROW_H));
  wCols = Math.min(wCols, GRID_COLS - col);
  col   = Math.min(col,   GRID_COLS - wCols);

  const newGrid = { col, row, w: wCols, h: hRows };

  if (origGrid) {
    const blocked = Object.entries(_gridMap).some(([k, g]) =>
      k !== id && _gridsOverlap(newGrid, g)
    );
    _gridMap[id] = blocked ? { ...origGrid } : newGrid;
  } else {
    _gridMap[id] = newGrid;
  }
  _applyCardLayout(id);
  _updateCanvasH();
}

function _initDrag(id) {
  const handle = document.getElementById(id + '-drag-handle');
  if (!handle) return;
  handle.addEventListener('mousedown', e => {
    if (e.button !== 0 || e.target.closest('button,select,input')) return;
    e.preventDefault();
    const card = document.getElementById('card-' + id);
    _cardDrag = {
      cardId:  'card-' + id,
      startMX: e.clientX, startMY: e.clientY,
      startL:  parseFloat(card.style.left) || 0,
      startT:  parseFloat(card.style.top)  || 0,
      origGrid: { ..._gridMap[id] },
    };
    card.classList.add('card-dragging');
  });
}

function _initResize(id) {
  const handle = document.getElementById(id + '-resize-handle');
  if (!handle) return;
  handle.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    e.preventDefault(); e.stopPropagation();
    const card = document.getElementById('card-' + id);
    _cardResize = {
      cardId: 'card-' + id,
      sx: e.clientX, sy: e.clientY,
      sw: card.offsetWidth, sh: card.offsetHeight,
      origGrid: { ..._gridMap[id] },
    };
    card.classList.add('card-resizing');
  });
}

// ── Layout init (nach erstem Datei-Load aufgerufen) ──
function _initLayout() {
  if (_layoutInit) {
    // Bei erneutem Laden: nur Positionen neu anwenden
    Object.keys(_cardMap).forEach(id => _applyCardLayout(id));
    _updateCanvasH();
    return;
  }
  _layoutInit = true;

  const hasSaved = core.load('fhwa_layout2', null) !== null;
  if (!hasSaved) {
    const topH = document.querySelector('.topbar')?.offsetHeight || 42;
    const defH = Math.max(8, Math.floor((window.innerHeight - topH) / GRID_ROW_H));
    Object.keys(_cardMap).forEach(id => {
      _gridMap[id] = { ..._cardMap[id].defaultGrid, h: defH };
    });
  }

  Object.keys(_cardMap).forEach(id => { _applyCardLayout(id); _initDrag(id); _initResize(id); });
  _updateCanvasH();
}

// ── Global mouse events (drag & resize) ──
document.addEventListener('mousemove', e => {
  if (_cardDrag) {
    const card = document.getElementById(_cardDrag.cardId);
    if (!card) return;
    const dx = e.clientX - _cardDrag.startMX, dy = e.clientY - _cardDrag.startMY;
    card.style.left = Math.max(0, _cardDrag.startL + dx) + 'px';
    card.style.top  = Math.max(0, _cardDrag.startT + dy) + 'px';
    _updateCanvasH();
  }
  if (_cardResize) {
    const card = document.getElementById(_cardResize.cardId);
    if (!card) return;
    const id = _cardResize.cardId.replace('card-', '');
    const cw = _getColW(id);
    const nw = Math.max(2 * cw, _cardResize.sw + (e.clientX - _cardResize.sx));
    const nh = Math.max(4 * GRID_ROW_H, _cardResize.sh + (e.clientY - _cardResize.sy));
    card.style.width  = nw + 'px';
    card.style.height = nh + 'px';
    _updateCanvasH();
    core.emit('resize');
  }
});

document.addEventListener('mouseup', () => {
  if (_cardDrag) {
    const { cardId, origGrid } = _cardDrag;
    document.getElementById(cardId)?.classList.remove('card-dragging');
    _snapToGrid(cardId, origGrid);
    _saveLayout();
    _cardDrag = null;
    core.emit('resize');
  }
  if (_cardResize) {
    const { cardId, origGrid } = _cardResize;
    document.getElementById(cardId)?.classList.remove('card-resizing');
    _snapToGrid(cardId, origGrid);
    _saveLayout();
    _cardResize = null;
    core.emit('resize');
  }
});

let _wResizeTO = null;
window.addEventListener('resize', () => {
  clearTimeout(_wResizeTO);
  _wResizeTO = setTimeout(() => {
    Object.keys(_cardMap).forEach(id => _applyCardLayout(id));
    _updateCanvasH();
    core.emit('resize');
  }, 150);
});

// ════════════════════════════════════════════════
// Private: File upload & data processing
// ════════════════════════════════════════════════
function _initFileUpload() {
  const dropZone  = document.getElementById('drop-zone');
  const fileInput = document.getElementById('file-input');

  dropZone.addEventListener('dragover',  e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
  dropZone.addEventListener('dragleave', ()  => dropZone.classList.remove('drag-over'));
  dropZone.addEventListener('drop',      e  => {
    e.preventDefault(); dropZone.classList.remove('drag-over');
    if (e.dataTransfer.files[0]) _loadFile(e.dataTransfer.files[0]);
  });
  fileInput.addEventListener('change', e => { if (e.target.files[0]) _loadFile(e.target.files[0]); });
}

function _saveGlobal() {
  core.save('fhwa_global', {
    squadFilter:     core.state.squadFilter,
    issueTypeFilter: core.state.issueTypeFilter,
    urlTemplate:     core.state.urlTemplate,
  });
}

function _initSidebarButtons() {
  // Theme toggle
  document.getElementById('btn-theme')?.addEventListener('click', () => core.toggleTheme());

  // Reset (Neue Datei)
  document.getElementById('btn-reset')?.addEventListener('click', () => {
    document.getElementById('upload-screen').style.display = 'flex';
    document.getElementById('app-screen').style.display   = 'none';
    document.getElementById('file-input').value = '';
    // Upload-Screen zurücksetzen
    const dz = document.getElementById('drop-zone');
    const dc = document.getElementById('page-datencheck');
    const dp = document.getElementById('data-preview');
    if (dz) dz.style.display = '';
    if (dc) dc.innerHTML = '';
    if (dp) dp.innerHTML = '';
    // Offene Tooltips ausblenden
    document.querySelectorAll('body > div[style*="position:fixed"]').forEach(el => {
      el.style.display = 'none';
    });
    core.state.rows      = [];
    core.state.sheets    = {};
    core.state.sheetsRaw = {};
  });

  // Squad dropdown toggle – shared across all pages via .btn-squad-trigger
  document.querySelectorAll('.btn-squad-trigger').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const dd   = document.getElementById('squad-dropdown');
      const open = dd.classList.toggle('open');
      if (open) {
        document.getElementById('issuetype-dropdown')?.classList.remove('open');
        document.querySelectorAll('.btn-issuetype-trigger').forEach(b => b.classList.remove('p-blue'));
        _updateIssueTypeBtn();
        const rect = btn.getBoundingClientRect();
        dd.style.top  = (rect.bottom + 4) + 'px';
        dd.style.left = rect.left + 'px';
      }
      document.querySelectorAll('.btn-squad-trigger').forEach(b => {
        b.classList.toggle('p-blue',    open);
        b.classList.toggle('pf-active', open || core.state.squadFilter.length > 0);
      });
    });
  });

  // Squad select all / none
  document.getElementById('sdd-all')?.addEventListener('click',  () => {
    document.querySelectorAll('#squad-opts input[type=checkbox]').forEach(cb => cb.checked = true);
    _onSquadFilterChange();
  });
  document.getElementById('sdd-none')?.addEventListener('click', () => {
    document.querySelectorAll('#squad-opts input[type=checkbox]').forEach(cb => cb.checked = false);
    _onSquadFilterChange();
  });

  // Issue-Type dropdown toggle – shared across all pages via .btn-issuetype-trigger
  document.querySelectorAll('.btn-issuetype-trigger').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const dd   = document.getElementById('issuetype-dropdown');
      const open = dd.classList.toggle('open');
      if (open) {
        document.getElementById('squad-dropdown')?.classList.remove('open');
        document.querySelectorAll('.btn-squad-trigger').forEach(b => b.classList.remove('p-blue'));
        _updateSquadBtn();
        const rect = btn.getBoundingClientRect();
        dd.style.top  = (rect.bottom + 4) + 'px';
        dd.style.left = rect.left + 'px';
      }
      document.querySelectorAll('.btn-issuetype-trigger').forEach(b => {
        b.classList.toggle('p-blue',    open);
        b.classList.toggle('pf-active', open || (core.state.issueTypeFilter.length > 0 && core.state.issueTypeFilter.length < core.state.allIssueTypes.length));
      });
    });
  });

  // Issue-Type select all / none
  document.getElementById('sdd-type-all')?.addEventListener('click', () => {
    document.querySelectorAll('#issuetype-opts input[type=checkbox]').forEach(cb => cb.checked = true);
    _onIssueTypeFilterChange();
  });
  document.getElementById('sdd-type-none')?.addEventListener('click', () => {
    document.querySelectorAll('#issuetype-opts input[type=checkbox]').forEach(cb => cb.checked = false);
    _onIssueTypeFilterChange();
  });

  // Settings panel – URL-Template verdrahten (Open/Close wird in index.html verwaltet)
  const urlInput = document.getElementById('settings-url-input');
  if (urlInput) urlInput.value = core.state.urlTemplate;

  if (urlInput) {
    urlInput.addEventListener('input', () => {
      core.state.urlTemplate = urlInput.value;
      _saveGlobal();
      core.emit('settings');
    });
  }

  // Filter zurücksetzen – beide Filter (Squad + Issue-Type)
  document.querySelectorAll('.squad-filter-reset').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#squad-opts input[type=checkbox]').forEach(cb => cb.checked = true);
      _onSquadFilterChange();
      document.querySelectorAll('#issuetype-opts input[type=checkbox]').forEach(cb => cb.checked = true);
      _onIssueTypeFilterChange();
    });
  });

  // Close dropdowns on outside click
  document.addEventListener('click', e => {
    if (!e.target.closest('.btn-squad-trigger') && !e.target.closest('#squad-dropdown')) {
      document.getElementById('squad-dropdown')?.classList.remove('open');
      _updateSquadBtn();
    }
    if (!e.target.closest('.btn-issuetype-trigger') && !e.target.closest('#issuetype-dropdown')) {
      document.getElementById('issuetype-dropdown')?.classList.remove('open');
      _updateIssueTypeBtn();
    }
  });
}

// ── Sidebar-Navigation initialisieren ──
function _initSidebar() {
  document.querySelectorAll('.sidebar-link').forEach(link => {
    link.addEventListener('click', () => {
      if (link.classList.contains('nav-locked')) return; // gesperrt bis Bestätigung
      const pageId = link.dataset.page;
      if (pageId) core.showPage(pageId);
    });
  });

  // Datencheck-Button in Sidebar-Bottom
  document.getElementById('btn-datencheck')?.addEventListener('click', () => {
    core.showPage('datencheck');
  });
}

// ════════════════════════════════════════════════
// Private: Multi-Sheet Loading
// ════════════════════════════════════════════════
function _loadFile(file) {
  core.state.fileName = file.name;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array', cellDates: true });

      // Alle Sheets laden – automatisch erweiterbar ohne Core-Änderung
      const sheets = {}, sheetsRaw = {};
      wb.SheetNames.forEach(sn => {
        sheets[sn]    = XLSX.utils.sheet_to_json(wb.Sheets[sn], { defval: null });
        sheetsRaw[sn] = XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, defval: null });
      });
      core.state.sheets    = sheets;
      core.state.sheetsRaw = sheetsRaw;

      // Primär-Sheet: JiraStories (oder erstes Sheet als Fallback)
      const sn = wb.SheetNames.includes(TARGET_SHEET) ? TARGET_SHEET : wb.SheetNames[0];
      core.state.sheetName = sn;
      const rows = sheets[sn] || [];

      _processData(rows);
      _showDataPreview(wb.SheetNames, sheets);
    } catch (err) {
      const dp = document.getElementById('data-preview');
      if (dp) {
        dp.innerHTML = `<div style="color:var(--red);background:var(--bg2);border:1px solid var(--red);border-radius:8px;padding:.8rem 1.2rem;font-family:var(--mono);font-size:.8rem">&#9888; Fehler beim Laden: ${_escHtml(err.message)}</div>`;
      }
    }
  };
  reader.readAsArrayBuffer(file);
}

function _processData(rows) {
  if (!rows.length) return;
  const s    = core.state;
  const cols = Object.keys(rows[0]);

  // rows === state.sheets[TARGET_SHEET] (gleiche Array-Referenz)
  s.rows         = rows;
  s.hasSquad     = cols.includes('Squad');
  s.hasIssueType = cols.includes('Issue-Type');

  // Workflow state detection
  s.states = cols
    .filter(c => !META_COLS.has(c) && !c.startsWith('leaving_') && !c.endsWith('_first') && !c.endsWith('_Count'))
    .map(ec => ({
      name:     ec,
      entryCol: ec,
      exitCol:  cols.includes('leaving_' + ec) ? 'leaving_' + ec : null,
    }));

  // stateOrder: Basis-Reihenfolge aus Daten-Spalten
  s.stateOrder = s.states.map(st => st.name);

  // Squads
  if (s.hasSquad) {
    const sq = new Set(rows.map(r => r['Squad']).filter(v => v != null).map(String));
    s.allSquads = [...sq].sort((a, b) => a.localeCompare(b, 'de'));
  } else {
    s.allSquads = [];
  }
  s.squadFilter = (s.squadFilter || []).filter(sq => s.allSquads.includes(sq));

  // Issue Types (global filter list)
  if (s.hasIssueType) {
    const types = new Set(rows.map(r => r['Issue-Type']).filter(v => v != null).map(String));
    s.allIssueTypes = [...types].sort((a, b) => a.localeCompare(b, 'de'));
  } else {
    s.allIssueTypes = [];
  }
  s.issueTypeFilter = (s.issueTypeFilter || []).filter(t => s.allIssueTypes.includes(t));

  // Date columns (used by visuals for LT/CT column selects)
  s.dateCols = cols.filter(c =>
    (!META_COLS.has(c) && !c.endsWith('_Count')) || c === 'Created (Status New)'
  );

  // File badge (Topbar)
  const badge = document.getElementById('file-badge');
  if (badge) badge.textContent = s.fileName + ' · ' + s.sheetName;

  _buildSquadDD();
  _buildIssueTypeDD();
  core.emit('data');
}

// ── Nav sperren / entsperren ──
function _lockNav() {
  const el = document.getElementById('sidebar-locked');
  if (el) el.style.display = 'flex';
  document.querySelectorAll('.sidebar-link').forEach(l => l.classList.add('nav-locked'));
}

function _unlockNav() {
  const el = document.getElementById('sidebar-locked');
  if (el) el.style.display = 'none';
  document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('nav-locked'));
}

// ── Daten-Preview auf Upload-Screen (jetzt: Datencheck-Page im App-Screen) ──
function _showDataPreview(sheetNames, sheets) {
  _buildDatencheckPage(sheetNames, sheets);
  _switchToAppScreen();
}

// ── Upload-Screen → App-Screen schalten (Datencheck-Page, gesperrt) ──
function _switchToAppScreen() {
  document.getElementById('upload-screen').style.display = 'none';
  const app = document.getElementById('app-screen');
  app.style.display = 'block';
  _lockNav();
  core.showPage('datencheck');
}

// ── HTML-Sonderzeichen escapen (verhindert XSS aus Excel-Daten) ──
function _escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ── Datencheck-Page befüllen ──
function _buildDatencheckPage(sheetNames, sheets) {
  const s   = core.state;
  const rows = s.rows;

  // Fertige / aktive Tickets
  const finished = rows.filter(r =>
    (r['Resolved'] != null && r['Resolved'] !== '') ||
    (r['Rejected'] != null && r['Rejected'] !== '')
  ).length;
  const active = rows.length - finished;

  // Zeitraum aus allen Datumsspalten
  let minDate = null, maxDate = null;
  rows.forEach(r => {
    s.dateCols.forEach(col => {
      const d = core.toDate(r[col]);
      if (!d) return;
      if (!minDate || d < minDate) minDate = d;
      if (!maxDate || d > maxDate) maxDate = d;
    });
  });
  const fmtD = d => d ? d.toLocaleDateString('de-DE', { day: '2-digit', month: 'short' }) : '–';
  const totalDays = (minDate && maxDate) ? (maxDate - minDate) / 86400000 : 0;
  const months    = totalDays > 0 ? Math.round(totalDays / 30.5) : null;

  // Durchsatz (fertige Tickets / 30 Tage)
  const throughput = (finished > 0 && totalDays > 0)
    ? Math.round(finished / totalDays * 30) : null;

  // Auffällig alt: aktive Tickets deren erster Eintrag > 90 Tage zurückliegt
  let oldCount = 0;
  if (s.states.length > 0) {
    const firstCol = s.states[0].entryCol;
    const now = Date.now();
    rows.forEach(r => {
      if (r['Resolved'] != null || r['Rejected'] != null) return;
      const d = core.toDate(r[firstCol]);
      if (d && (now - d.getTime()) / 86400000 > 90) oldCount++;
    });
  }

  // Issue-Typen
  let issueTypes = [];
  if (s.hasIssueType) {
    issueTypes = [...new Set(rows.map(r => r['Issue-Type']).filter(Boolean).map(String))].slice(0, 8);
  }

  // State-Pills (leaving-States farbig)
  const statePills = s.states.map(st => {
    const isLeaving = st.exitCol !== null;
    return `<span class="dc-pill${isLeaving ? ' leaving' : ''}">${_escHtml(st.name)}</span>`;
  }).join('');

  // Squad-Pills
  const squadPills = s.allSquads.map(sq =>
    `<span class="dc-pill">&#127968; ${_escHtml(sq)}</span>`
  ).join('');

  // Type-Pills
  const typePills = issueTypes.map(t =>
    `<span class="dc-pill type">${_escHtml(t)}</span>`
  ).join('');

  // ── Optionale Sheets ──
  const epics       = (s.sheets && s.sheets['JiraEpics']) || [];
  const blockerRows = (s.sheets && s.sheets['JiraBlockermanagement']) || [];
  const happRaw     = ((s.sheetsRaw || {})['Happiness Faktor']) || [];

  // JiraEpics-Auswertung
  let epicCard = '';
  if (epics.length > 0) {
    const epicResolved = epics.filter(r => r['Resolved'] != null && r['Resolved'] !== '').length;
    const epicRejected = epics.filter(r => r['Rejected'] != null && r['Rejected'] !== '').length;
    const epicUncalled = epics.filter(r => r['UNCALLED'] != null && r['UNCALLED'] !== '').length;
    const epicOpen     = epics.length - epicResolved - epicRejected - epicUncalled;
    epicCard = `
      <div class="dc-sheet-card">
        <div class="dc-sheet-card-title">JiraEpics</div>
        <div class="dc-stat-val" style="font-size:1.25rem;margin-bottom:.12rem">${epics.length}</div>
        <div class="dc-stat-lbl">Epics gesamt</div>
        <div class="dc-sheet-pills">
          ${epicResolved > 0 ? `<span class="dc-pill resolved">${epicResolved} Resolved</span>` : ''}
          ${epicRejected > 0 ? `<span class="dc-pill rejected">${epicRejected} Rejected</span>` : ''}
          ${epicUncalled > 0 ? `<span class="dc-pill uncalled">${epicUncalled} UNCALLED</span>` : ''}
          ${epicOpen     > 0 ? `<span class="dc-pill type">${epicOpen} Offen</span>` : ''}
        </div>
      </div>`;
  }

  // Blockermanagement-Auswertung
  let blockerCard = '';
  if (blockerRows.length > 0) {
    const blockerOpen = blockerRows.filter(r =>
      r['BlockedEnd'] == null || r['BlockedEnd'] === ''
    ).length;
    blockerCard = `
      <div class="dc-sheet-card">
        <div class="dc-sheet-card-title">Blockermanagement</div>
        <div style="display:flex;gap:1.2rem;align-items:flex-end">
          <div>
            <div class="dc-stat-val ${blockerOpen > 0 ? 'orange' : ''}" style="font-size:1.25rem;margin-bottom:.12rem">${blockerOpen}</div>
            <div class="dc-stat-lbl">Offene Episoden</div>
          </div>
          <div>
            <div class="dc-stat-val" style="font-size:1.25rem;margin-bottom:.12rem">${blockerRows.length}</div>
            <div class="dc-stat-lbl">Gesamt-Episoden</div>
          </div>
        </div>
      </div>`;
  }

  // Happiness-Faktor-Auswertung
  let happCard = '';
  if (happRaw.length > 3) {
    const headerIdx = happRaw.findIndex(row => row.some(c => c === 'Squad'));
    if (headerIdx >= 0) {
      const header = happRaw[headerIdx];
      const dataRows = happRaw.slice(headerIdx + 1).filter(r => r[0] && String(r[0]).trim());
      // Letzte Monatsspalte mit Daten finden
      let lastColIdx = -1, lastColName = '';
      for (let ci = header.length - 1; ci >= 1; ci--) {
        const hasData = dataRows.some(r => r[ci] != null && r[ci] !== '' && !isNaN(parseFloat(r[ci])));
        if (hasData) { lastColIdx = ci; lastColName = String(header[ci] || ''); break; }
      }
      if (lastColIdx >= 0) {
        const lastVals = dataRows.map(r => parseFloat(r[lastColIdx])).filter(v => !isNaN(v));
        const happLast = lastVals.length ? (lastVals.reduce((a, b) => a + b, 0) / lastVals.length) : null;
        // Gesamt-Durchschnitt über alle Monatsspalten
        let allVals = [];
        for (let ci = 1; ci < header.length; ci++) {
          dataRows.forEach(r => { const v = parseFloat(r[ci]); if (!isNaN(v)) allVals.push(v); });
        }
        const happAvg = allVals.length ? (allVals.reduce((a, b) => a + b, 0) / allVals.length) : null;
        const fmtH = v => v != null ? v.toFixed(1) : '–';
        const valColor = happLast != null && happLast >= 3.5 ? 'green' : (happLast != null && happLast < 3 ? 'orange' : '');
        happCard = `
          <div class="dc-sheet-card">
            <div class="dc-sheet-card-title">Happiness Faktor</div>
            <div style="display:flex;gap:1.2rem;align-items:flex-end">
              <div>
                <div class="dc-stat-val ${valColor}" style="font-size:1.25rem;margin-bottom:.12rem">${fmtH(happLast)}</div>
                <div class="dc-stat-lbl">Letzter Wert &middot; ${_escHtml(lastColName)}</div>
              </div>
              <div>
                <div class="dc-stat-val" style="font-size:1.25rem;margin-bottom:.12rem">${fmtH(happAvg)}</div>
                <div class="dc-stat-lbl">&Oslash; alle Monate</div>
              </div>
            </div>
          </div>`;
      }
    }
  }

  const extraSheetsHtml = (epicCard || blockerCard || happCard) ? `
    <div class="dc-extra-sheets">
      <div class="dc-section-title">Weitere Daten erkannt</div>
      <div class="dc-sheets">${epicCard}${blockerCard}${happCard}</div>
    </div>` : '';

  const page = document.getElementById('page-datencheck');
  if (!page) return;

  page.innerHTML = `
    <div class="dc-wrap">
      <div class="dc-badge">&#10003; Datei erkannt</div>
      <h2 class="dc-title">Das haben wir in deinem Export gefunden</h2>
      <div class="dc-sub">${_escHtml(s.fileName)} &middot; Sheet &bdquo;${_escHtml(s.sheetName)}&ldquo; &middot; ${rows.length} Tickets</div>

      <div class="dc-stats">
        <div class="dc-stat">
          <div class="dc-stat-val">${rows.length}</div>
          <div class="dc-stat-lbl">Tickets gesamt</div>
          <div class="dc-stat-sub">${finished} fertig &middot; ${active} aktiv</div>
        </div>
        <div class="dc-stat">
          <div class="dc-stat-val">${months != null ? months + '&thinsp;Mon.' : '&ndash;'}</div>
          <div class="dc-stat-lbl">Zeitraum</div>
          <div class="dc-stat-sub">${fmtD(minDate)} &ndash; ${fmtD(maxDate)}</div>
        </div>
        <div class="dc-stat">
          <div class="dc-stat-val green">${throughput != null ? throughput : '&ndash;'}</div>
          <div class="dc-stat-lbl">Durchsatz&thinsp;/&thinsp;30&thinsp;T.</div>
          <div class="dc-stat-sub">Tickets fertig</div>
        </div>
        <div class="dc-stat">
          <div class="dc-stat-val orange">${oldCount}</div>
          <div class="dc-stat-lbl">Auff&auml;llig alt</div>
          <div class="dc-stat-sub">aktive &uuml;ber 90&thinsp;T.</div>
        </div>
      </div>

      <div class="dc-cards">
        <div class="dc-card">
          <div class="dc-card-title">Workflow-Status erkannt</div>
          <div class="dc-pills">${statePills || '<span class="dc-note">Keine Statusspalten erkannt</span>'}</div>
          <div class="dc-note">Reihenfolge automatisch aus den Zeitstempeln abgeleitet &middot; sp&auml;ter anpassbar</div>
        </div>
        <div class="dc-card">
          <div class="dc-card-title">Squads &amp; Typen</div>
          <div class="dc-pills">${squadPills || '<span class="dc-note">Keine Squad-Spalte gefunden</span>'}</div>
          ${typePills ? `<div class="dc-pills" style="margin-top:.35rem">${typePills}</div>` : ''}
        </div>
      </div>

      ${extraSheetsHtml}

      <div class="dc-cta">
        <button class="btn-cta" id="btn-goto-app">Weiter zu Lieferf&auml;higkeit &rarr;</button>
        <span class="dc-cta-note">Alles erkannt &mdash; du kannst Stati &amp; Squads jederzeit sp&auml;ter feinjustieren.</span>
      </div>
    </div>
  `;

  document.getElementById('btn-goto-app')?.addEventListener('click', _launchApp);
}

// ── Daten bestätigt → Nav freischalten, Dashboard zeigen ──
function _launchApp() {
  _unlockNav();
  const savedPage = core.load('fhwa_activePage', 'lieferfahigkeit');
  // Nicht mehr auf Datencheck zurück, lieferfähigkeit als Fallback
  core.showPage(savedPage === 'datencheck' ? 'lieferfahigkeit' : savedPage);
  _initLayout();
}

// ════════════════════════════════════════════════
// Private: Squad dropdown
// ════════════════════════════════════════════════
function _buildSquadDD() {
  const opts = document.getElementById('squad-opts');
  if (!opts) return;
  opts.innerHTML = '';

  core.state.allSquads.forEach(sq => {
    const div = document.createElement('div');
    div.className = 'squad-opt';
    const cb  = document.createElement('input');
    cb.type   = 'checkbox';
    cb.id     = 'sqcb_' + sq;
    cb.checked = core.state.squadFilter.length === 0 || core.state.squadFilter.includes(sq);
    cb.addEventListener('change', _onSquadFilterChange);
    const lbl      = document.createElement('label');
    lbl.htmlFor    = 'sqcb_' + sq;
    lbl.textContent = sq;
    div.appendChild(cb); div.appendChild(lbl);
    opts.appendChild(div);
  });
  _updateSquadBtn();
}

function _onSquadFilterChange() {
  const checked = [];
  document.querySelectorAll('#squad-opts input[type=checkbox]')
    .forEach(cb => { if (cb.checked) checked.push(cb.id.replace('sqcb_', '')); });
  core.state.squadFilter = checked.length === core.state.allSquads.length ? [] : checked;
  _updateSquadBtn();
  _saveGlobal();
  core.emit('filter');
}

function _updateSquadBtn() {
  const f = core.state.squadFilter;
  const m = core.state.allSquads.length;
  const a = f.length;
  let text;
  if (!a || a === m) {
    text = 'SQUADS Alle \u25bd';
  } else if (a === 1) {
    text = `SQUADS ${f[0]} \u25bd`;
  } else if (a === 2) {
    text = `SQUADS ${f[0]}, ${f[1]} \u25bd`;
  } else {
    text = `SQUADS ${a}/${m} \u25bd`;
  }
  const isActive = a > 0 && a < m;
  document.querySelectorAll('.btn-squad-trigger').forEach(btn => {
    btn.textContent = text;
    btn.classList.toggle('pf-active', isActive);
    btn.classList.remove('p-blue');
  });
}

// ════════════════════════════════════════════════
// Private: Issue-Type dropdown
// ════════════════════════════════════════════════
function _buildIssueTypeDD() {
  const opts = document.getElementById('issuetype-opts');
  if (!opts) return;
  opts.innerHTML = '';

  core.state.allIssueTypes.forEach(t => {
    const div = document.createElement('div');
    div.className = 'squad-opt';
    const cb  = document.createElement('input');
    cb.type   = 'checkbox';
    cb.id     = 'itcb_' + t;
    cb.checked = core.state.issueTypeFilter.length === 0 || core.state.issueTypeFilter.includes(t);
    cb.addEventListener('change', _onIssueTypeFilterChange);
    const lbl      = document.createElement('label');
    lbl.htmlFor    = 'itcb_' + t;
    lbl.textContent = t;
    div.appendChild(cb); div.appendChild(lbl);
    opts.appendChild(div);
  });
  _updateIssueTypeBtn();
}

function _onIssueTypeFilterChange() {
  const checked = [];
  document.querySelectorAll('#issuetype-opts input[type=checkbox]')
    .forEach(cb => { if (cb.checked) checked.push(cb.id.replace('itcb_', '')); });
  core.state.issueTypeFilter = checked.length === core.state.allIssueTypes.length ? [] : checked;
  _updateIssueTypeBtn();
  _saveGlobal();
  core.emit('filter');
}

function _updateIssueTypeBtn() {
  const f = core.state.issueTypeFilter;
  const m = core.state.allIssueTypes.length;
  const a = f.length;
  let text;
  if (!a || a === m) {
    text = 'ISSUE-TYP Alle ▽';
  } else if (a === 1) {
    text = `ISSUE-TYP ${f[0]} ▽`;
  } else if (a === 2) {
    text = `ISSUE-TYP ${f[0]}, ${f[1]} ▽`;
  } else {
    text = `ISSUE-TYP ${a}/${m} ▽`;
  }
  const isActive = a > 0 && a < m;
  document.querySelectorAll('.btn-issuetype-trigger').forEach(btn => {
    btn.textContent = text;
    btn.classList.toggle('pf-active', isActive);
    btn.classList.remove('p-blue');
  });
}

// ════════════════════════════════════════════════
// Shared DOM Utility Helpers (P3.7)
// Exportiert für alle Visuals – kein Kopieren mehr nötig.
// ════════════════════════════════════════════════

export function _mkBtn(label, onClick) {
  const b = document.createElement('button'); b.className = 'btn-icon'; b.textContent = label;
  b.addEventListener('click', onClick); return b;
}

export function _mkPanel() {
  const p = document.createElement('div'); p.className = 'sub-panel'; return p;
}

export function _mkTglGrp(buttons, onChange) {
  const wrap = document.createElement('div'); wrap.className = 'tgl-grp';
  buttons.forEach(({ val, label }) => {
    const b = document.createElement('button'); b.className = 'tgl'; b.dataset.val = val; b.textContent = label;
    b.addEventListener('click', () => onChange(val));
    wrap.appendChild(b);
  });
  return wrap;
}

export function _mkSelect() {
  const s = document.createElement('select'); s.className = 'lt-select'; return s;
}

export function _mkLtField(label, selectEl) {
  const f = document.createElement('div'); f.className = 'lt-field';
  const l = document.createElement('span'); l.className = 'lt-label'; l.textContent = label;
  f.appendChild(l); f.appendChild(selectEl); return f;
}

export function _mkTTRow(label, val) {
  const row = document.createElement('div'); row.className = 'tt-row';
  const lb  = document.createElement('span'); lb.className  = 'tt-lbl'; lb.textContent = label;
  const vl  = document.createElement('span'); vl.className  = 'tt-val'; vl.textContent = val;
  row.appendChild(lb); row.appendChild(vl); return row;
}

export function _posTooltip(tt, cx, cy) {
  const tw = tt.offsetWidth || 160, th = tt.offsetHeight || 130;
  let l = cx + 14, t = cy + 14;
  if (l + tw > window.innerWidth  - 6) l = cx - tw - 14; if (l < 6) l = 6;
  if (t + th > window.innerHeight - 6) t = cy - th - 14; if (t < 6) t = 6;
  tt.style.left = l + 'px'; tt.style.top = t + 'px';
}

// ════════════════════════════════════════════════
// Shared Order-Panel Builder (P3.8)
// Baut das ▲/▼-Drag-Panel für Status-Reihenfolge.
// Wird von wipage.js und heatmap.js genutzt.
//
// @param {HTMLElement} orderList      – Container-Element (.order-list)
// @param {string[]}    stateOrder     – Aktuelle Reihenfolge (cfg.stateOrder)
// @param {function}    onReorder      – Callback(newOrder: string[]) nach Änderung
// @param {function}   [decorateItem]  – Optional: extra Styling pro Item (item, name)
// ════════════════════════════════════════════════
export function _buildOrderPanel(orderList, stateOrder, onReorder, decorateItem) {
  orderList.innerHTML = '';
  let panelDragSrc = null;
  stateOrder.forEach((name, idx) => {
    const isExtra = !DEFAULT_STATUS_ORDER.includes(name);
    const item = document.createElement('div');
    item.className = 'order-item' + (isExtra ? ' o-extra' : '');
    item.draggable = true; item.dataset.name = name;
    if (decorateItem) decorateItem(item, name);

    item.addEventListener('dragstart', e => { panelDragSrc = name; item.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; });
    item.addEventListener('dragover',  e => { e.preventDefault(); item.classList.add('drag-over-item'); });
    item.addEventListener('dragleave', ()  => item.classList.remove('drag-over-item'));
    item.addEventListener('drop', e => {
      e.preventDefault(); item.classList.remove('drag-over-item');
      if (!panelDragSrc || panelDragSrc === name) return;
      const arr = [...stateOrder];
      const fi = arr.indexOf(panelDragSrc), ti = arr.indexOf(name);
      if (fi < 0 || ti < 0) return;
      arr.splice(fi, 1); arr.splice(ti, 0, panelDragSrc);
      panelDragSrc = null;
      onReorder(arr);
    });
    item.addEventListener('dragend', () => { item.classList.remove('dragging'); panelDragSrc = null; });

    const handle = document.createElement('span'); handle.className = 'o-handle'; handle.textContent = '⠿';
    const num    = document.createElement('span'); num.className = 'o-num';    num.textContent = (idx + 1) + '.';
    const lbl    = document.createElement('span'); lbl.className = 'o-name';   lbl.textContent = name;
    const bu = document.createElement('button'); bu.className = 'obtn'; bu.textContent = '▲'; bu.disabled = idx === 0;
    bu.onclick = () => { const arr = [...stateOrder]; [arr[idx], arr[idx-1]] = [arr[idx-1], arr[idx]]; onReorder(arr); };
    const bd = document.createElement('button'); bd.className = 'obtn'; bd.textContent = '▼'; bd.disabled = idx === stateOrder.length - 1;
    bd.onclick = () => { const arr = [...stateOrder]; [arr[idx], arr[idx+1]] = [arr[idx+1], arr[idx]]; onReorder(arr); };

    item.appendChild(handle); item.appendChild(num); item.appendChild(lbl); item.appendChild(bu); item.appendChild(bd);
    orderList.appendChild(item);
  });
}
