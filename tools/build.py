#!/usr/bin/env python3
"""
build.py – Flow Analytics Dashboard Bundle-Skript
==================================================
Ordnerstruktur:

    project-root/
      src/          ← Quelldateien (index.html, core.js, *.js)
      tools/        ← dieses Skript
      Web App/      ← Ausgabe (wird automatisch angelegt falls nicht vorhanden)

Ausführen (aus beliebigem Verzeichnis):
    python tools/build.py

Ausgabe:
    project-root/Web App/FlowAnalytics.html
"""

import re
import os

# Verzeichnis-Pfade relativ zu diesem Skript
TOOLS_DIR  = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR   = os.path.dirname(TOOLS_DIR)
SRC_DIR    = os.path.join(ROOT_DIR, 'src')
OUTPUT_DIR = os.path.join(ROOT_DIR, 'Web App')


def read(filename):
    with open(os.path.join(SRC_DIR, filename), encoding='utf-8') as f:
        return f.read()


def read_calc(filename):
    """Liest eine calc-Datei aus SRC_DIR/calc/."""
    with open(os.path.join(SRC_DIR, 'calc', filename), encoding='utf-8') as f:
        return f.read()


def strip_module_syntax(js):
    """
    Verarbeitet ES-Modul-Syntax für den Bundle-Einsatz:
      - import { X as Y } → const Y = X;   (Alias beibehalten)
      - import { X, Y }   → entfernen       (bereits global im Bundle)
      - 'export ' Präfix vor const / let / var / function / class entfernen
    """
    # Alle import-Statements (auch mehrzeilig) auf einmal verarbeiten
    import_pattern = re.compile(
        r'^\s*import\s*\{([^}]*)\}\s*from\s*["\'][^"\']*["\']\s*;?',
        re.MULTILINE | re.DOTALL
    )

    def replace_import(m):
        content = m.group(1)
        aliases = []
        for part in content.split(','):
            part = part.strip()
            if not part:
                continue
            if ' as ' in part:
                original, alias = [x.strip() for x in part.split(' as ', 1)]
                aliases.append(f'const {alias} = {original};')
            # Nicht-aliasierte Imports: bereits global im Bundle → weglassen
        return '\n'.join(aliases)

    js = import_pattern.sub(replace_import, js)

    # 'export const' → 'const', 'export function' → 'function', etc.
    lines = js.splitlines()
    out = []
    for line in lines:
        line = re.sub(
            r'^(\s*)export\s+(const|let|var|function|class|async\s+function)\s+',
            r'\1\2 ',
            line
        )
        out.append(line)
    return '\n'.join(out)


def extract_module_script_block(html):
    """
    Entfernt den <script type="module">…</script>-Block aus index.html
    und gibt (html_ohne_block, einfügeposition) zurück.
    """
    pattern = re.compile(
        r'(\s*)<script\s+type=["\']module["\']>.*?</script>',
        re.DOTALL
    )
    m = pattern.search(html)
    if not m:
        raise ValueError("Kein <script type='module'>-Block in index.html gefunden.")
    html_clean = html[:m.start()] + html[m.end():]
    return html_clean, m.start()


def build():
    # Ausgabe-Verzeichnis anlegen falls nicht vorhanden
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    print(f"▶ Quelldateien:  {SRC_DIR}")
    print(f"▶ Ausgabe:       {OUTPUT_DIR}")
    print()

    print("▶ Lese Quelldateien …")
    html_src     = read('index.html')
    # ── calc-Dateien (Hilfsfunktionen, müssen VOR den Visuals stehen) ──
    core_calc_js          = read_calc('core.calc.js')
    boxchart_calc_js      = read_calc('boxchart.calc.js')
    flowefficiency_calc_js= read_calc('flowefficiency.calc.js')
    heatmap_calc_js       = read_calc('heatmap.calc.js')
    montecarlo_calc_js    = read_calc('montecarlo.calc.js')
    scatter_calc_js       = read_calc('scatter.calc.js')
    wipage_calc_js        = read_calc('wipage.calc.js')
    # ── Visuals ──
    core_js      = read('core.js')
    blocker_js   = read('blocker.js')
    heatmap_js   = read('heatmap.js')
    scatter_js   = read('scatter.js')
    wipage_js    = read('wipage.js')
    boxchart_js  = read('boxchart.js')
    happiness_js = read('happiness.js')
    wip_js       = read('wip.js')
    flowefficiency_js = read('flowefficiency.js')
    saydoratioepics_js = read('saydoratioepics.js')
    montecarlo_js     = read('montecarlo.js')
    akzeptanz_js      = read('akzeptanz.js')

    print("▶ Transformiere JS (entferne import/export) …")
    core_calc_out          = strip_module_syntax(core_calc_js)
    boxchart_calc_out      = strip_module_syntax(boxchart_calc_js)
    flowefficiency_calc_out= strip_module_syntax(flowefficiency_calc_js)
    heatmap_calc_out       = strip_module_syntax(heatmap_calc_js)
    montecarlo_calc_out    = strip_module_syntax(montecarlo_calc_js)
    scatter_calc_out       = strip_module_syntax(scatter_calc_js)
    wipage_calc_out        = strip_module_syntax(wipage_calc_js)
    core_out      = strip_module_syntax(core_js)
    blocker_out   = strip_module_syntax(blocker_js)
    heatmap_out   = strip_module_syntax(heatmap_js)
    scatter_out   = strip_module_syntax(scatter_js)
    wipage_out    = strip_module_syntax(wipage_js)
    boxchart_out  = strip_module_syntax(boxchart_js)
    happiness_out = strip_module_syntax(happiness_js)
    wip_out       = strip_module_syntax(wip_js)
    flowefficiency_out = strip_module_syntax(flowefficiency_js)
    saydoratioepics_out = strip_module_syntax(saydoratioepics_js)
    montecarlo_out     = strip_module_syntax(montecarlo_js)
    akzeptanz_js_src   = read_calc('akzeptanz.calc.js')
    akzeptanz_calc_out = strip_module_syntax(akzeptanz_js_src)
    akzeptanz_out      = strip_module_syntax(akzeptanz_js)

    # init()-Funktionen umbenennen um Kollisionen zu vermeiden
    heatmap_out   = heatmap_out.replace(  'function init()', 'function init_heatmap()',   1)
    scatter_out   = scatter_out.replace(  'function init()', 'function init_scatter()',   1)
    wipage_out    = wipage_out.replace(   'function init()', 'function init_wipage()',    1)
    boxchart_out  = boxchart_out.replace( 'function init()', 'function init_boxchart()',  1)
    happiness_out = happiness_out.replace('function init()', 'function init_happiness()', 1)
    wip_out       = wip_out.replace(      'function init()', 'function init_wip()',       1)
    flowefficiency_out = flowefficiency_out.replace('function init()', 'function init_flowefficiency()', 1)
    saydoratioepics_out = saydoratioepics_out.replace('function init()', 'function init_saydoratioepics()', 1)
    montecarlo_out     = montecarlo_out.replace(    'function init()', 'function init_montecarlo()',     1)
    blocker_out        = blocker_out.replace(        'function init()', 'function init_blocker()',        1)
    akzeptanz_out      = akzeptanz_out.replace(      'function init()', 'function init_akzeptanz()',      1)

    # Jedes Visual in eine IIFE einwickeln:
    # Verhindert, dass gleichnamige top-level const/let zwischen Visuals kollidieren.
    # Die init_*-Funktion wird über window.* exponiert, damit der Bootstrap sie aufrufen kann.
    def wrap_iife(js, fn_name):
        return (
            "(function() {\n" +
            js + "\n" +
            f"window.{fn_name} = {fn_name};\n" +
            "})();"
        )

    heatmap_out   = wrap_iife(heatmap_out,   'init_heatmap')
    scatter_out   = wrap_iife(scatter_out,   'init_scatter')
    wipage_out    = wrap_iife(wipage_out,    'init_wipage')
    boxchart_out  = wrap_iife(boxchart_out,  'init_boxchart')
    happiness_out = wrap_iife(happiness_out, 'init_happiness')
    wip_out       = wrap_iife(wip_out,       'init_wip')
    flowefficiency_out = wrap_iife(flowefficiency_out, 'init_flowefficiency')
    saydoratioepics_out = wrap_iife(saydoratioepics_out, 'init_saydoratioepics')
    montecarlo_out     = wrap_iife(montecarlo_out,     'init_montecarlo')
    blocker_out        = wrap_iife(blocker_out,        'init_blocker')
    akzeptanz_out      = wrap_iife(akzeptanz_out,      'init_akzeptanz')

    # Inline-Bootstrap (ersetzt den <script type="module">-Block aus index.html)
    # WICHTIG: Alle Logik aus dem Modul-Script muss hier vollständig enthalten sein,
    # da extract_module_script_block() den gesamten Block entfernt.
    # DEFAULT_STATUS_ORDER ist nach strip_module_syntax() als 'const' im Bundle vorhanden.
    bootstrap = (
        "  init_blocker();\n"
        "  init_heatmap();\n"
        "  init_scatter();\n"
        "  init_wipage();\n"
        "  init_boxchart();\n"
        "  init_happiness();\n"
        "  init_wip();\n"
        "  init_flowefficiency();\n"
        "  init_saydoratioepics();\n"
        "  init_montecarlo();\n"
        "  init_akzeptanz();\n"
        "  core.initApp();\n"
        "\n"
        "  // ── Settings-Panel: Overlay-Logik ──────────────────\n"
        "  (function() {\n"
        "    var btn      = document.getElementById('btn-settings');\n"
        "    var panel    = document.getElementById('settings-panel');\n"
        "    var backdrop = document.getElementById('settings-backdrop');\n"
        "    var closeBtn = document.getElementById('settings-close-btn');\n"
        "\n"
        "    function openSettings() {\n"
        "      _rebuildOrderList();\n"
        "      panel.classList.add('open');\n"
        "      backdrop.classList.add('open');\n"
        "    }\n"
        "    function closeSettings() {\n"
        "      panel.classList.remove('open');\n"
        "      backdrop.classList.remove('open');\n"
        "    }\n"
        "\n"
        "    if (btn)      btn.addEventListener('click', openSettings);\n"
        "    if (closeBtn) closeBtn.addEventListener('click', closeSettings);\n"
        "    if (backdrop) backdrop.addEventListener('click', closeSettings);\n"
        "\n"
        "    // ── Status-Reihenfolge im Settings-Panel ──────\n"
        "    var orderList = document.getElementById('settings-order-list');\n"
        "    var resetBtn  = document.getElementById('settings-order-reset');\n"
        "    var dragSrc   = null;\n"
        "\n"
        "    function _rebuildOrderList() {\n"
        "      if (!orderList) return;\n"
        "      orderList.innerHTML = '';\n"
        "      var order = core.loadGlobalStatusOrder();\n"
        "      order.forEach(function(name, idx) {\n"
        "        var isExtra = DEFAULT_STATUS_ORDER.indexOf(name) < 0;\n"
        "        var item = document.createElement('div');\n"
        "        item.className = 'order-item' + (isExtra ? ' o-extra' : '');\n"
        "        item.draggable = true;\n"
        "        item.dataset.name = name;\n"
        "\n"
        "        item.addEventListener('dragstart', function(e) {\n"
        "          dragSrc = name;\n"
        "          item.classList.add('dragging');\n"
        "          e.dataTransfer.effectAllowed = 'move';\n"
        "        });\n"
        "        item.addEventListener('dragover', function(e) {\n"
        "          e.preventDefault();\n"
        "          item.classList.add('drag-over-item');\n"
        "        });\n"
        "        item.addEventListener('dragleave', function() {\n"
        "          item.classList.remove('drag-over-item');\n"
        "        });\n"
        "        item.addEventListener('drop', function(e) {\n"
        "          e.preventDefault();\n"
        "          item.classList.remove('drag-over-item');\n"
        "          if (!dragSrc || dragSrc === name) return;\n"
        "          var cur = core.loadGlobalStatusOrder();\n"
        "          var fi = cur.indexOf(dragSrc), ti = cur.indexOf(name);\n"
        "          if (fi < 0 || ti < 0) return;\n"
        "          cur.splice(fi, 1); cur.splice(ti, 0, dragSrc);\n"
        "          dragSrc = null;\n"
        "          core.saveGlobalStatusOrder(cur);\n"
        "          _rebuildOrderList();\n"
        "        });\n"
        "        item.addEventListener('dragend', function() {\n"
        "          item.classList.remove('dragging');\n"
        "          dragSrc = null;\n"
        "        });\n"
        "\n"
        "        var handle = document.createElement('span'); handle.className = 'o-handle'; handle.textContent = '\u2807';\n"
        "        var num    = document.createElement('span'); num.className = 'o-num';    num.textContent = (idx + 1) + '.';\n"
        "        var lbl    = document.createElement('span'); lbl.className = 'o-name';   lbl.textContent = name;\n"
        "        var bu     = document.createElement('button'); bu.className = 'obtn'; bu.textContent = '\u25b2';\n"
        "        bu.disabled = idx === 0;\n"
        "        bu.onclick = function() { _moveOrderItem(idx, -1); };\n"
        "        var bd     = document.createElement('button'); bd.className = 'obtn'; bd.textContent = '\u25bc';\n"
        "        bd.disabled = idx === order.length - 1;\n"
        "        bd.onclick = function() { _moveOrderItem(idx, 1); };\n"
        "\n"
        "        item.appendChild(handle); item.appendChild(num); item.appendChild(lbl);\n"
        "        item.appendChild(bu); item.appendChild(bd);\n"
        "        orderList.appendChild(item);\n"
        "      });\n"
        "    }\n"
        "\n"
        "    function _moveOrderItem(idx, dir) {\n"
        "      var ni  = idx + dir;\n"
        "      var cur = core.loadGlobalStatusOrder();\n"
        "      if (ni < 0 || ni >= cur.length) return;\n"
        "      var tmp = cur[idx]; cur[idx] = cur[ni]; cur[ni] = tmp;\n"
        "      core.saveGlobalStatusOrder(cur);\n"
        "      _rebuildOrderList();\n"
        "    }\n"
        "\n"
        "    if (resetBtn) {\n"
        "      resetBtn.addEventListener('click', function() {\n"
        "        core.saveGlobalStatusOrder(DEFAULT_STATUS_ORDER.slice());\n"
        "        _rebuildOrderList();\n"
        "      });\n"
        "    }\n"
        "\n"
        "    // Liste aktualisieren wenn ein Visual die Reihenfolge ändert\n"
        "    core.on('statusOrder', _rebuildOrderList);\n"
        "  })();\n"
        "\n"
        "  // ── Kachelgröße: laden, anwenden, Slider verdrahten (16:10) ──\n"
        "  (function() {\n"
        "    var KEY = 'fhwa_tileHeight', DEFAULT = 550, RATIO = 10 / 16;\n"
        "    var clampW = function(v) { return Math.max(390, Math.min(720, v)); };\n"
        "    function applyTileSize(w) {\n"
        "      w = clampW(parseInt(w, 10) || DEFAULT);\n"
        "      var h = Math.round(w * RATIO);\n"
        "      document.documentElement.style.setProperty('--tile-w', w + 'px');\n"
        "      document.documentElement.style.setProperty('--tile-h', h + 'px');\n"
        "      var disp   = document.getElementById('tile-h-display');\n"
        "      var slider = document.getElementById('settings-tile-height');\n"
        "      if (disp)   disp.textContent = w + ' \u00d7 ' + h;\n"
        "      if (slider) slider.value = w;\n"
        "      core.emit('resize');\n"
        "      return w;\n"
        "    }\n"
        "    applyTileSize(core.load(KEY, DEFAULT));\n"
        "    var slider = document.getElementById('settings-tile-height');\n"
        "    if (slider) {\n"
        "      slider.addEventListener('input', function() {\n"
        "        core.save(KEY, applyTileSize(slider.value));\n"
        "      });\n"
        "    }\n"
        "    var tileRow = document.getElementById('settings-tile-row');\n"
        "    if (tileRow) {\n"
        "      core.on('data', function() {\n"
        "        tileRow.classList.remove('settings-row--disabled');\n"
        "      });\n"
        "    }\n"
        "  })();\n"
        "\n"
        "  // Filter-Reset aller Pages wird von core.js via .squad-filter-reset behandelt.\n"
    )

    # Gebündeltes JS zusammensetzen
    # calc-Dateien kommen ZUERST, da sie Konstanten/Funktionen exportieren
    # die von core.js und den Visuals genutzt werden.
    bundled_js = (
        "// ── calc/core.calc.js ──\n"          + core_calc_out           + "\n\n" +
        "// ── calc/boxchart.calc.js ──\n"      + boxchart_calc_out       + "\n\n" +
        "// ── calc/flowefficiency.calc.js ──\n"+ flowefficiency_calc_out  + "\n\n" +
        "// ── calc/heatmap.calc.js ──\n"       + heatmap_calc_out        + "\n\n" +
        "// ── calc/montecarlo.calc.js ──\n"    + montecarlo_calc_out     + "\n\n" +
        "// ── calc/scatter.calc.js ──\n"       + scatter_calc_out        + "\n\n" +
        "// ── calc/wipage.calc.js ──\n"        + wipage_calc_out         + "\n\n" +
        "// ── core.js ──\n"       + core_out      + "\n\n" +
        "// ── blocker.js ──\n"    + blocker_out   + "\n\n" +
        "// ── heatmap.js ──\n"    + heatmap_out   + "\n\n" +
        "// ── scatter.js ──\n"    + scatter_out   + "\n\n" +
        "// ── wipage.js ──\n"     + wipage_out    + "\n\n" +
        "// ── boxchart.js ──\n"   + boxchart_out  + "\n\n" +
        "// ── happiness.js ──\n"  + happiness_out + "\n\n" +
        "// ── wip.js ──\n"        + wip_out        + "\n\n" +
        "// ── flowefficiency.js ──\n"    + flowefficiency_out    + "\n\n" +
        "// ── saydoratioepics.js ──\n" + saydoratioepics_out  + "\n\n" +
        "// ── montecarlo.js ──\n"      + montecarlo_out        + "\n\n" +
        "// ── calc/akzeptanz.calc.js ──\n" + akzeptanz_calc_out + "\n\n" +
        "// ── akzeptanz.js ──\n"        + akzeptanz_out         + "\n\n" +
        "// ── Bootstrap ──\n"     + bootstrap      + "\n"
    )

    print("▶ Entferne <script type='module'>-Block aus index.html …")
    html_clean, insert_pos = extract_module_script_block(html_src)

    # Inline-Script einfügen
    inline_block = f"\n<script>\n{bundled_js}\n</script>\n"
    html_out = html_clean[:insert_pos] + inline_block + html_clean[insert_pos:]

    out_path = os.path.join(OUTPUT_DIR, 'FlowAnalytics.html')
    with open(out_path, 'w', encoding='utf-8') as f:
        f.write(html_out)

    size_kb = os.path.getsize(out_path) / 1024
    print(f"✅ Fertig: Web App/FlowAnalytics.html ({size_kb:.1f} KB)")

    # ── M11 Selbst-Check: alle init_*-Funktionen im Bundle vorhanden? ──
    expected = [
        'init_blocker',
        'init_heatmap', 'init_scatter', 'init_wipage',
        'init_boxchart', 'init_happiness', 'init_wip',
        'init_flowefficiency', 'init_saydoratioepics', 'init_montecarlo',
        'init_akzeptanz',
    ]
    print()
    ok = True
    for fn in expected:
        if fn not in bundled_js:
            print(f"⚠️  WARNUNG: {fn}() fehlt im Bundle!")
            ok = False
        else:
            print(f"✓  {fn}() vorhanden")

    # ── Prüfe auf verbliebene ES-Modul-Syntax ──
    import_remnants = re.findall(r'^\s*import\s+', bundled_js, re.MULTILINE)
    from_remnants   = re.findall(r'\}\s*from\s+["\']', bundled_js)
    if import_remnants or from_remnants:
        print(f"\n⚠️  WARNUNG: Verbliebene import/from-Syntax im Bundle ({len(import_remnants)+len(from_remnants)} Treffer)!")
        ok = False
    else:
        print("✓  Keine verbliebene import/from-Syntax")

    if ok:
        print("\n✅ Bundle-Selbstcheck bestanden.")
    else:
        print("\n❌ Bundle-Selbstcheck fehlgeschlagen – bitte Fehler beheben.")


if __name__ == '__main__':
    build()
