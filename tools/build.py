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


def strip_module_syntax(js):
    """
    Entfernt ES-Modul-spezifische Syntax:
      - import-Zeilen komplett entfernen
      - 'export ' Präfix vor const / let / var / function / class entfernen
    """
    lines = js.splitlines()
    out = []
    for line in lines:
        # Import-Zeilen komplett entfernen
        if re.match(r'^\s*import\s+', line):
            continue
        # 'export const' → 'const', 'export function' → 'function', etc.
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
    html_src    = read('index.html')
    core_js     = read('core.js')
    heatmap_js  = read('heatmap.js')
    scatter_js  = read('scatter.js')
    wipage_js   = read('wipage.js')
    boxchart_js = read('boxchart.js')

    print("▶ Transformiere JS (entferne import/export) …")
    core_out     = strip_module_syntax(core_js)
    heatmap_out  = strip_module_syntax(heatmap_js)
    scatter_out  = strip_module_syntax(scatter_js)
    wipage_out   = strip_module_syntax(wipage_js)
    boxchart_out = strip_module_syntax(boxchart_js)

    # init()-Funktionen umbenennen um Kollisionen zu vermeiden
    heatmap_out  = heatmap_out.replace( 'function init()', 'function init_heatmap()',  1)
    scatter_out  = scatter_out.replace( 'function init()', 'function init_scatter()',  1)
    wipage_out   = wipage_out.replace(  'function init()', 'function init_wipage()',   1)
    boxchart_out = boxchart_out.replace('function init()', 'function init_boxchart()', 1)

    # Inline-Bootstrap (ersetzt den import-Block aus index.html)
    bootstrap = (
        "  init_heatmap();\n"
        "  init_scatter();\n"
        "  init_wipage();\n"
        "  init_boxchart();\n"
        "  core.initApp();"
    )

    # Gebündeltes JS zusammensetzen
    bundled_js = (
        "// ── core.js ──\n"      + core_out      + "\n\n" +
        "// ── heatmap.js ──\n"   + heatmap_out   + "\n\n" +
        "// ── scatter.js ──\n"   + scatter_out   + "\n\n" +
        "// ── wipage.js ──\n"    + wipage_out    + "\n\n" +
        "// ── boxchart.js ──\n"  + boxchart_out  + "\n\n" +
        "// ── Bootstrap ──\n"    + bootstrap      + "\n"
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


if __name__ == '__main__':
    build()
