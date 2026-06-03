// ════════════════════════════════════════════════
// core.js  –  Shared Engine (State · Grid · Theme · Utils · Events)
// Flow Analytics Dashboard v2.0
// ════════════════════════════════════════════════

// ── Constants (exported for use in visuals) ──
export const TARGET_SHEET      = 'JiraStories';
export const LT_START_DEFAULT  = 'Ready4Progress_first';
export const LT_END_DEFAULT    = 'Resolved';

const GRID_COLS  = 12;
const GRID_ROW_H = 70;   // px per grid row

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
const _cardMap    = {};           // { id: { el, defaultGrid } }
let   _cardDrag   = null;
let   _cardResize = null;
let   _layoutInit = false;        // guard against double-init on second file load

// ════════════════════════════════════════════════
// Public singleton
// ════════════════════════════════════════════════
export const core = {

  // ── Shared application state (read-only for visuals) ──
  state: {
    rows:       [],
    dateCols:   [],
    states:     [],     // { name, entryCol, exitCol }[]
    stateOrder: [],     // ordered names as detected from data
    allSquads:  [],
    hasSquad:   false,
    hasIssueType: false,
    squadFilter: [],    // [] = alle aktiv
    fileName: '',
    sheetName: '',
    urlTemplate: '',    // global Jira URL-Template
  },

  // ── Event bus ──────────────────────────────────
  on(event, fn) {
    if (!_listeners[event]) _listeners[event] = [];
    _listeners[event].push(fn);
  },

  emit(event) {
    (_listeners[event] || []).forEach(fn => fn());
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

  // ── Data utilities ─────────────────────────────
  /** Returns rows after applying active squadFilter. */
  filteredRows() {
    const s = core.state;
    if (!s.squadFilter.length) return s.rows;
    return s.rows.filter(r => s.squadFilter.indexOf(String(r['Squad'] || '')) >= 0);
  },

  toDate(v) {
    if (!v) return null;
    if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
    if (typeof v === 'number') {
      const d = new Date(Math.round((v - 25569) * 86400000));
      return isNaN(d.getTime()) ? null : d;
    }
    if (typeof v === 'string') {
      const d = new Date(v.trim());
      return isNaN(d.getTime()) ? null : d;
    }
    return null;
  },

  dur(a, b) {
    const da = core.toDate(a), db = core.toDate(b);
    if (!da || !db) return null;
    const d = (db - da) / 86400000 + 1;
    return d > 0 ? d : null;
  },

  pct(arr, p) {
    if (!arr.length) return null;
    if (arr.length === 1) return arr[0];
    const i = (p / 100) * (arr.length - 1);
    const lo = Math.floor(i), hi = Math.ceil(i);
    return lo === hi ? arr[lo] : arr[lo] + (arr[hi] - arr[lo]) * (i - lo);
  },

  fmt(v) { return v == null ? '–' : v.toFixed(1) + 'd'; },

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
    if (btn) btn.textContent = next === 'light' ? '🌙' : '☀';
    core.save('fhwa_theme', next);
    core.emit('theme');
  },

  initTheme() {
    const saved = core.load('fhwa_theme', 'dark');
    document.documentElement.setAttribute('data-theme', saved);
    const btn = document.getElementById('btn-theme');
    if (btn) btn.textContent = saved === 'light' ? '🌙' : '☀';
  },

  // ── Card factory ───────────────────────────────
  /**
   * Creates a .card element, appends it to #dash-canvas, registers it with the grid.
   * @param {string} id         – Visual ID (e.g. 'heatmap'). Card gets id="card-heatmap"
   * @param {string} title      – innerHTML for .card-title
   * @param {object} defaultGrid – { col, row, w, h } in grid units
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

    document.getElementById('dash-canvas').appendChild(cardEl);

    // ── Grid registration ──
    const savedLayout = core.load('fhwa_layout2', {});
    _gridMap[id] = savedLayout[id] ? { ...savedLayout[id] } : { ...defaultGrid };
    _cardMap[id] = { el: cardEl, defaultGrid: { ...defaultGrid } };

    return { cardEl, contentEl, headerExtraEl, diagEl };
  },

  // ── App boot ───────────────────────────────────
  initApp() {
    core.initTheme();

    // Load saved global state
    const g = core.load('fhwa_global', null);
    if (g && Array.isArray(g.squadFilter))   core.state.squadFilter  = g.squadFilter;
    if (g && typeof g.urlTemplate === 'string') core.state.urlTemplate = g.urlTemplate;

    _initFileUpload();
    _initTopbarButtons();
  },
};

// ════════════════════════════════════════════════
// Private: Grid helpers
// ════════════════════════════════════════════════
function _getColW() {
  const canvas = document.getElementById('dash-canvas');
  return (canvas ? canvas.clientWidth : window.innerWidth) / GRID_COLS;
}

function _applyCardLayout(id) {
  const card = document.getElementById('card-' + id);
  if (!card || !_gridMap[id]) return;
  const g = _gridMap[id], cw = _getColW();
  card.style.left   = (g.col * cw + 4)          + 'px';
  card.style.top    = (g.row * GRID_ROW_H + 4)   + 'px';
  card.style.width  = (g.w   * cw - 8)           + 'px';
  card.style.height = (g.h   * GRID_ROW_H - 8)   + 'px';
}

function _updateCanvasH() {
  const canvas = document.getElementById('dash-canvas');
  const dash   = document.getElementById('dashboard');
  if (!canvas || !dash) return;
  const maxB = Object.keys(_cardMap).reduce((m, id) => {
    const c = document.getElementById('card-' + id);
    if (!c) return m;
    return Math.max(m, (parseFloat(c.style.top) || 0) + c.offsetHeight + 20);
  }, 0);
  canvas.style.minHeight = Math.max(maxB, dash.clientHeight) + 'px';
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
  const cw  = _getColW();
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

// ── Layout init (called once after first file load) ──
function _initLayout() {
  if (_layoutInit) {
    // On subsequent loads: just re-apply positions
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
    const cw = _getColW();
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
    squadFilter: core.state.squadFilter,
    urlTemplate: core.state.urlTemplate,
  });
}

function _initTopbarButtons() {
  // Theme toggle
  document.getElementById('btn-theme')?.addEventListener('click', () => core.toggleTheme());

  // Reset (Neue Datei)
  document.getElementById('btn-reset')?.addEventListener('click', () => {
    document.getElementById('upload-screen').style.display = 'flex';
    document.getElementById('app-screen').style.display   = 'none';
    document.getElementById('file-input').value = '';
    core.state.rows = [];
  });

  // Squad dropdown toggle
  document.getElementById('btn-squad')?.addEventListener('click', () => {
    const dd   = document.getElementById('squad-dropdown');
    const open = dd.classList.toggle('open');
    document.getElementById('btn-squad').classList.toggle('p-blue', open);
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

  // Settings panel
  const urlInput = document.getElementById('settings-url-input');
  if (urlInput) urlInput.value = core.state.urlTemplate;

  document.getElementById('btn-settings')?.addEventListener('click', () => {
    const panel = document.getElementById('settings-panel');
    const btn   = document.getElementById('btn-settings');
    const open  = panel.classList.toggle('open');
    btn.classList.toggle('p-blue', open);
  });

  if (urlInput) {
    urlInput.addEventListener('input', () => {
      core.state.urlTemplate = urlInput.value;
      _saveGlobal();
      core.emit('settings');
    });
  }

  // Close settings panel on outside click
  document.addEventListener('click', e => {
    const wrap = document.getElementById('settings-wrap');
    if (wrap && !wrap.contains(e.target)) {
      document.getElementById('settings-panel')?.classList.remove('open');
      document.getElementById('btn-settings')?.classList.remove('p-blue');
    }
  });

  // Close squad dropdown on outside click
  document.addEventListener('click', e => {
    const wrap = document.getElementById('squad-dd-wrap');
    if (wrap && !wrap.contains(e.target)) {
      document.getElementById('squad-dropdown').classList.remove('open');
      if (!core.state.squadFilter.length)
        document.getElementById('btn-squad').classList.remove('p-blue');
    }
  });
}

function _loadFile(file) {
  core.state.fileName = file.name;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array', cellDates: true });
      const sn = wb.SheetNames.indexOf(TARGET_SHEET) >= 0 ? TARGET_SHEET : wb.SheetNames[0];
      core.state.sheetName = sn;
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[sn], { defval: null });
      _processData(rows);

      // Show app
      document.getElementById('upload-screen').style.display = 'none';
      const app = document.getElementById('app-screen');
      app.style.display       = 'flex';
      app.style.flexDirection = 'column';

      _initLayout();
    } catch (err) {
      alert('Fehler beim Laden: ' + err.message);
    }
  };
  reader.readAsArrayBuffer(file);
}

function _processData(rows) {
  if (!rows.length) return;
  const s    = core.state;
  const cols = Object.keys(rows[0]);

  s.rows          = rows;
  s.hasSquad      = cols.indexOf('Squad')      >= 0;
  s.hasIssueType  = cols.indexOf('Issue-Type') >= 0;

  // Workflow state detection
  s.states = cols
    .filter(c => !META_COLS.has(c) && !c.startsWith('leaving_') && !c.endsWith('_first') && !c.endsWith('_Count'))
    .map(ec => ({
      name:     ec,
      entryCol: ec,
      exitCol:  cols.indexOf('leaving_' + ec) >= 0 ? 'leaving_' + ec : null,
    }));

  // stateOrder: base order from data columns (visuals manage their own saved order on top)
  s.stateOrder = s.states.map(st => st.name);

  // Squads
  if (s.hasSquad) {
    const sq = new Set(rows.map(r => r['Squad']).filter(v => v != null).map(String));
    s.allSquads = [...sq].sort((a, b) => a.localeCompare(b, 'de'));
  } else {
    s.allSquads = [];
  }
  s.squadFilter = (s.squadFilter || []).filter(sq => s.allSquads.indexOf(sq) >= 0);

  // Date columns (used by visuals for LT/CT column selects)
  s.dateCols = cols.filter(c =>
    (!META_COLS.has(c) && !c.endsWith('_Count')) || c === 'Created (Status New)'
  );

  // Update file badge
  const badge = document.getElementById('file-badge');
  if (badge) badge.textContent = s.fileName + ' · ' + s.sheetName;

  _buildSquadDD();
  core.emit('data');
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
    cb.checked = core.state.squadFilter.length === 0 || core.state.squadFilter.indexOf(sq) >= 0;
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
  const btn = document.getElementById('btn-squad');
  if (!btn) return;
  const a = core.state.squadFilter.length;
  if (!a) {
    btn.textContent = '🏰 Squads';
    btn.className   = 'btn-icon';
  } else {
    btn.textContent = `🏰 Squad (${a}/${core.state.allSquads.length})`;
    btn.className   = 'btn-icon p-blue';
  }
}
