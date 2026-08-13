# CLAUDE.md — Atomic Framework Forge for Elementor (ATFRFO)

## INHERITANCE — ADDS TO, NEVER REPLACES

**Parent chain** — every rule from every level above remains fully in effect here:
1. `C:\Users\Owner\.claude\CLAUDE.md` — Root: all Claude Code sessions
2. `E:\projects\.claude\CLAUDE.md` — All E:\projects\ work
3. `E:\projects\plugins\.claude\CLAUDE.md` — All plugin development rules

**This file adds:** ATFRFO-specific rules only.

---

## Project Identity

- **Plugin name:** Atomic Framework Forge for Elementor
- **Acronym / folder:** `aff` → `E:\projects\plugins\aff`
- **Version:** v1.4.0
- **GitHub:** https://github.com/Mij-Strebor/atomic-framework-forge-for-elementor
- **Branding:** Always "Jim R Forge" — never "JimRWeb"
- **Author URI:** https://jimrforge.com

---

## What ATFRFO Does

ATFRFO is a WordPress admin plugin that provides a management interface for **Elementor v4 (atomic widget) assets** — specifically the CSS custom properties that Elementor v4 writes into its compiled kit stylesheet (`post-{id}.css`). ATFRFO reads those variables, lets developers organize and edit them, and persists the data as `.atfrfo.json` files.

**Three asset types managed:**
1. **Variables** — CSS custom properties from the Elementor v4 `:root` block (Colors, Fonts, Numbers — fully implemented)
2. **Classes** — Developer-defined CSS class names on atomic widgets (future)
3. **Components** — User-assembled widget compositions (future)

**Current phase: v1.4.0.** Full Variables workflow (sync, organize, edit, backup, commit to Elementor) is complete and shipped. Classes are planned for v2.0; Components for v3.0.

---

## Test Environment

**Corrected 2026-08-03** — this section previously named a different, stale
Local site (`site`); confirmed via direct WP-CLI use that ATFRFO actually runs
on `claude-wordpress-integration-novamira`, the same Local install used for
JimRForge website/NovaMira work. Both purposes share this one site.

- **WP site:** `claude-wordpress-integration-novamira` (Local by Flywheel)
- **WP root:** `C:/Users/Owner/Local Sites/claude-wordpress-integration-novamira/app/public`
- **Plugins dir:** `C:/Users/Owner/Local Sites/claude-wordpress-integration-novamira/app/public/wp-content/plugins`
- **Uploads/ATFRFO data:** `C:/Users/Owner/Local Sites/claude-wordpress-integration-novamira/app/public/wp-content/uploads/atfrfo/`
- **Symlink target:** `E:/projects/plugins/aff`
- **Symlink creation** requires Administrator CMD:
  ```cmd
  mklink /D "C:\Users\Owner\Local Sites\claude-wordpress-integration-novamira\app\public\wp-content\plugins\atomic-framework-forge-for-elementor" "E:\projects\plugins\aff"
  ```
- **WP Admin:** `http://localhost:10011/wp-admin/`

---

## File Structure

```
atomic-framework-forge-for-elementor/
├── atomic-framework-forge-for-elementor.php  # Main plugin file, headers, bootstrap
├── includes/
│   ├── class-atfrfo-loader.php             # Hook registration
│   ├── class-atfrfo-admin.php              # Admin page registration
│   ├── class-atfrfo-css-parser.php         # Reads/parses post-{id}.css  ← READ-ONLY
│   ├── class-atfrfo-data-store.php         # Variable/class/component persistence
│   ├── class-atfrfo-ajax-handler.php       # AJAX endpoints
│   └── class-atfrfo-settings.php          # Plugin preferences
├── admin/
│   ├── views/page-atfrfo-main.php          # Root PHP template for the admin page
│   ├── js/
│   │   ├── atfrfo-app.js                   # Main JS entry point, ATFRFO.state init
│   │   ├── atfrfo-panel-left.js            # Left nav tree
│   │   ├── atfrfo-panel-right.js           # Right panel: project, sync, backup
│   │   ├── atfrfo-panel-top.js             # Top bar: project name, Switch Project
│   │   ├── atfrfo-colors.js                # Colors variable set (full edit UI)
│   │   ├── atfrfo-variables.js             # Generic variable set factory (Fonts, Numbers)
│   │   ├── atfrfo-merge.js                 # Merge/conflict resolution utilities
│   │   ├── atfrfo-modal.js                 # Single-instance modal system
│   │   └── atfrfo-theme.js                 # Light/dark mode toggle
│   └── css/
│       ├── atfrfo-layout.css               # Panel layout and structure
│       └── atfrfo-theme.css                # Light/dark mode CSS variables
├── assets/
│   ├── fonts/                           # Inter WOFF2 files (4 weights)
│   └── icons/                           # SVG icon set
├── data/
│   └── atfrfo-defaults.json               # Default subgroup definitions
└── docs/
    └── ATFRFO-Framework-Forge-Spec.md      # Full spec document
```

---

## Naming Prefix Rules — Mandatory

| Layer | Prefix | Example |
|-------|--------|---------|
| PHP classes | `ATFRFO_` | `ATFRFO_CSS_Parser`, `ATFRFO_Admin` |
| JS globals | `ATFRFO` | `ATFRFO.Modal`, `ATFRFO.Theme` |
| CSS classes | `atfrfo-` | `atfrfo-btn`, `atfrfo-panel-left`, `atfrfo-modal` |
| AJAX actions | `atfrfo_` | `atfrfo_save_user_theme`, `atfrfo_sync_variables` |

**Never deviate from these prefixes.**

---

## Critical Rules — Read These First

### 1. ATFRFO_CSS_Parser is read-only — write-back lives only in the AJAX handler
`class-atfrfo-css-parser.php` only reads `post-{id}.css`. It **never writes to, modifies, or regenerates** Elementor's stylesheets.

**The one intentional exception:** `ATFRFO_Ajax_Handler::ajax_aff_commit_to_elementor()` writes variable values back to the Elementor kit CSS. This is the **Phase 5 write-back feature** and is intentionally isolated in the AJAX handler layer only. It must never be merged into `ATFRFO_CSS_Parser` or any parser class. Every call site must carry the comment:
```php
// Intentional Phase 5 write-back exception — see ATFRFO CLAUDE.md Critical Rule #1.
```

### 2. Portable data layer
`class-atfrfo-data-store.php`, `class-atfrfo-ajax-handler.php`, and all business logic classes must have **no WordPress dependencies**. All WordPress-specific code belongs in thin adapter classes only. ATFRFO is architecturally intended for future port to a standalone Windows/Mac app. The `.atfrfo.json` storage format must remain platform-agnostic.

### 3. No jQuery for ATFRFO UI logic
Covered by the plugins-level prohibition. ATFRFO-specific addition: prefer `fetch()` with nonces for all AJAX — do not use `jQuery.ajax` even for WordPress API calls in ATFRFO.

### 4. No build process
Pure PHP/JS/CSS. No npm, no Babel, no bundler. ES6+ is fine. Hard-refresh (Ctrl+Shift+R) after JS/CSS changes.

### 5. Font override must be scoped
The Inter font override uses `!important` — it must be scoped within `.atfrfo-app *`, never bare `*`.

---

## Layout — Four-Panel System

```
┌──────────────────────────────────────────────────────────────────┐
│                        TOP MENU BAR (~44px)                      │
├────────────┬─────────────────────────────────────┬───────────────┤
│ LEFT MENU  │       CENTER EDIT SPACE             │ RIGHT STATUS  │
│  PANEL     │       (scrollable)                  │  PANEL        │
│ (~220px    │                                     │  (~220px)     │
│  collaps.) │                                     │               │
└────────────┴─────────────────────────────────────┴───────────────┘
```

- **Root container:** `#atfrfo-app` — carries `data-atfrfo-theme="light|dark"` attribute
- **Max content width:** 1280px (`--jimr-container-max`)
- **Standard panel padding:** 36px (`--sp-9`)
- Left panel collapses to ~48px icon-only bar

---

## Left Menu Panel — Fixed Structure Rules

```
▼ Variables              ← fixed top-level, cannot rename/remove/reorder
    ▼ Colors             ← fixed second-level
        • Branding       ← user-definable subgroup
        • Backgrounds
        • Neutral
        • Status
    ▼ Fonts              ← fixed; subgroups dynamically sourced from Elementor fonts (read-only)
    ▼ Numbers            ← fixed
        • Spacing · Gaps · Grids · Radius
▶ Classes                ← fixed top-level
▶ Components             ← fixed top-level
```

At least one subgroup must always remain under each parent.

---

## Theme System

- Controlled by `data-atfrfo-theme="light|dark"` on `#atfrfo-app`
- Toggle via `ATFRFO.Theme.toggle()` or `ATFRFO.Theme.set('light'|'dark')`
- Preference persisted to WordPress `usermeta` via AJAX (`atfrfo_save_user_theme`)
- Dark mode palette not yet finalized — do not hard-code dark values without confirmation

---

## Modal System

Single-instance modal — never stack modals. Use `ATFRFO.Modal.open({ title, body, footer, onClose })`.

Behavioral rules (already in `atfrfo-modal.js`): backdrop scoped to ATFRFO container; ESC closes; click outside closes; focus trapped; focus restored on close; only one modal open at a time.

---

## Color System — Exact Values

```css
--atfrfo-bg-page:        #faf6f0;    --atfrfo-bg-card:        #ffffff;
--atfrfo-bg-panel:       #faf9f6;    --atfrfo-bg-field:       #fff;
--atfrfo-clr-primary:    #3d2f1f;    --atfrfo-clr-secondary:  #6d4c2f;
--atfrfo-clr-accent:     #f4c542;    --atfrfo-clr-accent-hov: #dda824;
--atfrfo-clr-muted:      #64748b;    --atfrfo-clr-link:       #ce6565;
--atfrfo-clr-link-hov:   #b54545;    --atfrfo-clr-border:     #c9b89a;
--atfrfo-shadow-sm: 0 1px 2px rgba(61,47,31,0.08);
--atfrfo-shadow-md: 0 4px 6px rgba(61,47,31,0.12);
--atfrfo-shadow-lg: 0 10px 20px rgba(61,47,31,0.15);
--atfrfo-shadow-xl: 0 20px 30px rgba(61,47,31,0.18);
```

---

## Button Standards

### Primary (Gold) — `.atfrfo-btn`
Background: `--atfrfo-clr-accent`; Text: `--atfrfo-clr-primary`; Hover: `--atfrfo-clr-accent-hov`, `translate(-2px,-2px)`. Font: 14px/600. Sentence case in HTML. No borders. No gray/ghost secondary buttons.

### Icon-Only — `.atfrfo-icon-btn`
Background: transparent; hover: `rgba(61,47,31,0.08)`. Tooltip after 300ms CSS delay. All icon buttons: `aria-label`.

---

## Icon System

All icons are **inline SVG** from `assets/icons/`. No icon fonts. All use `fill: currentColor` or `stroke: currentColor`. Use existing icons — do not add new icon libraries.

---

## Accessibility — WCAG 2.1 AA minimum

- All icon buttons: `aria-label` required
- Focus: `2px solid var(--atfrfo-clr-accent)`, `outline-offset: 2px`
- Modal: focus trap (already in `atfrfo-modal.js`)
- Left menu tree: arrow key navigation, Enter to select, Space to expand/collapse

---

## Data Models

**Variable:**
```json
{ "id": "uuid-v4", "name": "--atfrfo-color-brand-primary", "value": "#2C3E50",
  "type": "color", "group": "Variables", "subgroup": "Colors",
  "category": "Branding", "source": "elementor-parsed",
  "modified": false, "created_at": "ISO8601", "updated_at": "ISO8601" }
```

**Storage format:** `.atfrfo.json` — platform-agnostic JSON.

---

## JavaScript Architecture

### ATFRFO.state — global state object (atfrfo-app.js)

```js
ATFRFO.state = {
    variables:  [],       // flat array of all variable objects
    categories: {},       // { Colors: [...], Fonts: [...], Numbers: [...] }
    config:     {},       // project config (name, backup limit, etc.)
    currentFile: null,    // active project slug
    isDirty:    false,    // unsaved changes exist
    activeSet:  'Colors', // currently visible variable set
}
```

### Shared Container — the root cause of cross-module bugs

`#atfrfo-edit-content` is a **single DOM element** shared by all variable set modules. Delegated event listeners from a previous module remain bound when a new module renders. **The view-presence guard must be on every handler.** See `PATTERNS.md`.

### Module Architecture

- **`atfrfo-colors.js`** — self-contained module for the Colors variable set. Uses module-level `_drag` object.
- **`atfrfo-variables.js`** — factory function `ATFRFO.Variables(config)` for Fonts and Numbers.
- Both use `_effEventsBound` / `_effVarsEventsBound` flags on the container DOM node to prevent re-binding. **These flags persist even when innerHTML is replaced** — never clear them by destroying the node.

---

## Elementor Data Structures

| Item | Value |
|------|-------|
| WordPress option | `elementor_active_kit` → post ID (e.g. `67`) |
| Kit CSS file | `wp-content/uploads/elementor/css/post-{id}.css` |
| Global variables meta key | `_elementor_global_variables` on the kit post |
| V3 colors meta key | `_elementor_page_settings` → `system_colors` / `custom_colors` |

`ATFRFO_CSS_Parser::read_from_kit_meta()` reads directly from post meta (primary path). CSS file parsing is the fallback.

---

## PHP Standards

- All classes prefixed `ATFRFO_`
- AJAX: `wp_ajax_{action}` hooks + `check_ajax_referer()` on every endpoint
- No direct file access: `if ( ! defined( 'ABSPATH' ) ) { exit; }` in every PHP file
- Enqueue assets only on the ATFRFO admin page (check `$hook`)
- Admin page slug: `atomic-framework-forge`

---

## Roadmap Phases (do not build ahead of phase)

| Phase | Scope | Status |
|-------|-------|--------|
| **v1.x** | Full Variables workflow: sync, organize, edit, backup, commit to Elementor | **Current — 1.4.0** |
| **v2.0** | Classes management; Change History log (currently a placeholder button, no log behind it) | Planned |
| **v3.0** | Components registry; Elementor Kit Manager API write-back | Planned |
| **Future** | Standalone Windows/Mac desktop application | Roadmap |

Do not build ahead of the current phase without explicit instruction from Jim.

---

## Version Number Locations

When bumping the version, update **all locations** in:
- `atomic-framework-forge-for-elementor.php` (header + constant)
- `readme.txt` (Stable tag, changelog, upgrade notice, beta heading)
- `CHANGELOG.md` (new entry)
- `README.md` (badge URLs + beta references + roadmap table)
- `docs/quick-start.md` (header + zip filenames)
- `docs/user-manual.md` (header)

After all edits, search for the old version string — zero matches expected outside changelog/history sections.

---

## Quick Checks Before Any ATFRFO Code Change

- [ ] CSS class uses `atfrfo-` prefix
- [ ] PHP class uses `ATFRFO_` prefix
- [ ] JS global uses `ATFRFO` namespace
- [ ] No jQuery in UI logic (use `fetch()` for AJAX)
- [ ] No writes to Elementor CSS files
- [ ] Font override scoped to `.atfrfo-app *` not bare `*`
- [ ] Button text is sentence case in HTML
- [ ] Icon buttons have `aria-label`
- [ ] Color values match exact hex from the color system above
- [ ] Data layer classes have no WordPress-specific function calls
