# Usability & Barrierefreiheit – Analyse Flow Analytics

**Erstellt:** 2026-06-27  
**Basis:** `src/index.html` · `src/core.js` · `docs/WebAppEntwickeln.md`  
**Standard:** WCAG 2.1 AA

---

## 🔴 Kritisch (Barrierefreiheit)

**1. Nicht fokussierbare Sidebar-Navigation**
- `<div class="sidebar-link">` statt `<button>` oder `<a>` – Tastaturnutzer können die Seiten nicht ansteuern.
- Kein `tabindex`, kein `role="button"`, kein `aria-current="page"` beim aktiven Link.
- Fix: `role="button"` + `tabindex="0"` + `aria-current="page"` + Keyboard-Handler.

**2. Focus-Ring fehlt überall**
- `.settings-input`, `.lt-select` haben `outline:none` ohne visuellen Ersatz.
- Keine globale `:focus-visible`-Regel in der App.
- Tastaturnutzer haben keine Orientierung, welches Element fokussiert ist.

**3. Extrem kleine Schriftgrößen**

| Element | Größe in rem | Pixel (bei base 16px) |
|---|---|---|
| `.diag-bar` | `.56rem` | ~9 px |
| `.c-sub`, `.c-n` | `.53rem` | ~8,5 px |
| `.hint-note`, `.settings-hint` | `.62rem` | ~10 px |
| `.sidebar-section` | `.56rem` | ~9 px |
| `.tab-badge` | `.55rem` | ~8,8 px |

- WCAG empfiehlt Mindest-Schriftgröße 12px für Sekundärtext, 16px für Haupttext.

**4. `<label>` nicht korrekt mit Inputs verknüpft**
- Im Zeitraum-Dropdown: `<label>Von</label>` hat kein `for="dr-from"`, `<label>Bis</label>` kein `for="dr-to"`.
- Screenreader können die Felder nicht korrekt vorlesen.

**5. Icon-Buttons ohne zugänglichen Text**
- `⚙ Einstellungen`, `⊘ Neue Datei`, `🔒 Erst Daten bestätigen` – Emojis ohne `aria-label` oder `aria-describedby`.
- Sidebar-Bottom-Buttons: `☀ Light`, `⤾ Neue Datei` – unklar für Screenreader.

**6. Dropdowns ohne ARIA-Rollen**
- `.squad-dropdown` hat kein `role="dialog"` oder `role="listbox"`.
- `.sdd-btn` "Alle" / "Keine" haben keine `aria-label`-Beschreibung (Alle *was*?).
- `aria-expanded` fehlt auf den Trigger-Buttons komplett.

---

## 🟠 Hoch (Usability & Kontrast)

**7. Klickziele zu klein**
- `.sheet-tab`: Padding `.32rem .58rem` → ca. 5 × 9px – unter dem WCAG-Mindestmaß von 44×44px.
- `.sdd-btn` "Alle" / "Keine": ähnlich klein.
- `.obtn` (▲/▼ Reihenfolge): `width:16px; height:16px` – sehr schwer treffsicher anzuklicken.
- `.settings-close-btn` (✕): Kein explizites Mindestmaß gesetzt.

**8. Kontrast-Probleme im Dark-Theme**
- `--dimmer: #4d6a88` auf `--bg: #0f1c30` → Kontrastverhältnis unter 3:1 (WCAG AA erfordert 4,5:1 für kleinen Text).
- `.sidebar-section`, `.diag-bar`, `.hint-note` nutzen alle `--dimmer` für wichtige Labels.
- `.logo-sub` mit `--dimmer` auf `--bg` hat ebenfalls zu geringen Kontrast.

**9. Kontrast-Probleme im Light-Theme**
- `--dimmer: #94a3b8` auf `--bg2: #ffffff` → Kontrastverhältnis ca. 2,4:1 – nicht WCAG-konform.

**10. Mobile / Responsive komplett unbrauchbar**
- `body { overflow: hidden }` und `.sidebar { width: 196px }` plus feste Tile-Breiten (`--tile-w: 550px`) machen die App auf Bildschirmen unter 800px Breite nicht bedienbar.
- Kein Breakpoint, kein Hamburger-Menü, kein Responsive-Fallback.

**11. Escape-Taste schließt Modals nicht**
- Settings-Panel und Tile-Vollbild-Modal: kein `keydown`-Listener für `Escape`.
- Standard-Verhalten für Overlay-Dialoge fehlt.

**12. Drag & Drop ohne Tastatur-Alternative**
- Tile-Reihenfolge auf der Lieferfähigkeit-Seite nur per Drag & Drop verschiebbar.
- Settings-Panel bietet ▲/▼-Buttons für Status-Reihenfolge – Tile-Reihenfolge hat diese Alternative nicht.

**13. `confirm()` für Factory-Reset**
- `window.confirm(...)` kann in SharePoint-Iframes unterdrückt werden → App würde ohne Bestätigung zurücksetzen.
- Besser: eigener Modal-Dialog im App-Stil.

---

## 🟡 Mittel (UX-Verbesserungen)

**14. Filter-Buttons textlich unklar**
- `SQUADS Alle ▽` – der Stil suggeriert einen Status-Badge, nicht ein Dropdown-Trigger.
- Kein visuelles Chevron-Icon für "Dropdown" im App-eigenen Stil; das `▽` ist zu klein und schwach kontrastiert.

**15. `#sidebar-locked` Banner immer im DOM, aber `display:none` initial**
- Nutzer sehen das Sperrsymbol nur wenn sie die Sidebar scrollen – `display:none` macht es für alle Screenreader unsichtbar, auch wenn es relevant wäre.

**16. Keine Ladeanimation beim Excel-Upload**
- Beim Parsen großer XLSX-Dateien „friert" die App ein ohne visuelles Feedback (kein Spinner, keine Progressanzeige).

**17. Upload-Screen: kein Fehlerfeedback bei falscher Datei**
- Wenn eine defekte oder nicht parsbare XLSX hochgeladen wird, gibt es keine sichtbare Fehlermeldung im UI (nur `console.error`).

**18. Sidebar-Breite fest, kein Collapse**
- 196px Sidebar ist bei kleinen Laptops (1280px Breite) zu breit für Analytics-Dashboards, die viel Platz für Charts brauchen.
- Kein Collapse/Expand der Sidebar.

**19. Datencheck-Seite als Pflichtschritt schlecht kommuniziert**
- Nach dem Upload landet der Nutzer auf dem Datencheck, muss dort aktiv bestätigen. Dieser Schritt ist für neue Nutzer nicht intuitiv – es fehlt eine erklärende Headline oder ein expliziter CTA-Text wie „Bitte prüfen und bestätigen".

**20. Sheet-Navigator auf dem Upload-Screen**
- Der Sheet-Navigator zeigt alle möglichen Spalten, auch wenn das Sheet fehlt – kein Hinweis ob das Sheet in der geladenen Datei vorhanden ist oder nicht.

---

## 🟢 Niedrig (Kleine Verbesserungen)

**21. `<html lang="de">` korrekt gesetzt** ✅ – gut.

**22. `<nav>` ohne `aria-label`**
- Die Sidebar hat `<nav class="sidebar">` – ein `aria-label="Hauptnavigation"` würde Screenreadern helfen, mehrere `<nav>`-Regionen zu unterscheiden.

**23. `color-scheme: dark` korrekt per `data-theme` gesteuert** ✅ – gut.

**24. Vollbild-Button auf Tiles (`tile-expand-btn`) hat keinen `aria-label`**
- Der Button wird dynamisch per `requestAnimationFrame` verdrahtet, aber ob er einen zugänglichen Namen hat, hängt vom jeweiligen Visual ab.

**25. `.card-drag-handle` nur dekorativ, fehlt `aria-hidden="true"`**
- Das `⠿`-Icon wird von Screenreadern vorgelesen (als „Braille-Muster").

---

## Zusammenfassung nach Priorität

| Priorität | Anzahl | Themen |
|---|---|---|
| 🔴 Kritisch | 6 | Tastatur, Focus, Schriftgrößen, Labels, ARIA |
| 🟠 Hoch | 7 | Klickziele, Kontrast, Mobile, Escape, Drag-Alternativen |
| 🟡 Mittel | 7 | Filter-UX, Fehlerfeedback, Ladeanimation, Sidebar |
| 🟢 Niedrig | 4 | ARIA-Labels, semantische Kleinigkeiten |
