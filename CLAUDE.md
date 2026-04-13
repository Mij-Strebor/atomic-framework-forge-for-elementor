# CLAUDE.md — Atomic Framework Forge for Elementor (AFF)

> Read parent CLAUDE.md files first — in order:
> 1. `E:/projects/CLAUDE.md` — global conventions, git workflow, backups, CSS debugging
> 2. `E:/projects/plugins/CLAUDE.md` — WordPress plugin architecture, PHP/JS debugging, release workflow
>
> This file covers AFF-specific rules only.

---

## Project Identity

- **Plugin name:** Atomic Framework Forge for Elementor
- **Acronym / folder:** `aff`
- **Path:** `E:/projects/plugins/aff`
- **Version:** v0.3.4-beta
- **GitHub:** https://github.com/Mij-Strebor/atomic-framework-forge-for-elementor
- **Branding:** Always "Jim R Forge" — never "JimRWeb"
- **Author URI:** https://jimrforge.com

---

## What AFF Does

AFF is a WordPress admin plugin that provides a management interface for **Elementor v4 (atomic widget) assets** — specifically the CSS custom properties that Elementor v4 writes into its compiled kit stylesheet (`post-{id}.css`). AFF reads those variables, lets developers organize and edit them, and persists the data as `.aff.json` files.

**Three asset types managed:**
1. **Variables** — CSS custom properties from the Elementor v4 `:root` block
2. **Classes** — Developer-defined CSS class names on atomic widgets (future — Elementor v4 not yet exposing these)
3. **Components** — User-assembled widget compositions (future phase)

**Current phase: v1 framework.** The layout shell, panels, modal system, CSS parser, and theme toggle are built or being built. Edit-space content (variable list/edit UI) comes in v2.

---

## Test Environment

- **WP site:** `site` (Local by Flywheel — main dev site)
- **WP root:** `C:/Users/Owner/Local Sites/site/app/public`
- **Plugins dir:** `C:/Users/Owner/Local Sites/site/app/public/wp-content/plugins`
- **Uploads/AFF data:** `C:/Users/Owner/Local Sites/site/app/public/wp-content/uploads/aff/`
- **Symlink target:** `E:/projects/plugins/aff`
- **Symlink creation** requires Administrator CMD:
  ```cmd
  mklink /D "C:\Users\Owner\Local Sites\site\app\public\wp-content\plugins\atomic-framework-forge-for-elementor" "E:\projects\plugins\aff"
  ```
- **Active Elementor kit CSS:** `wp-content/uploads/elementor/css/post-67.css` (kit ID: 67)
- **WP Admin:** `http://site.local/wp-admin/`

---

## File Structure

```
atomic-framework-forge-for-elementor/
├── atomic-framework-forge-for-elementor.php  # Main plugin file, headers, bootstrap
├── includes/
│   ├── class-aff-loader.php             # Hook registration
│   ├── class-aff-admin.php              # Admin page registration
│   ├── class-aff-css-parser.php         # Reads/parses post-{id}.css  ← READ-ONLY
│   ├── class-aff-data-store.php         # Variable/class/component persistence
│   ├── class-aff-ajax-handler.php       # AJAX endpoints
│   └── class-aff-settings.php          # Plugin preferences
├── admin/
│   ├── views/page-aff-main.php          # Root PHP template for the admin page
│   ├── js/
│   │   ├── aff-app.js                   # Main JS entry point
│   │   ├── aff-panel-left.js            # Left menu panel logic
│   │   ├── aff-panel-right.js           # Right status panel logic
│   │   ├── aff-panel-top.js             # Top menu bar logic
│   │   ├── aff-edit-space.js            # Center edit space logic
│   │   ├── aff-modal.js                 # Modal dialog system  ← built
│   │   └── aff-theme.js                 # Light/dark mode toggle  ← built
│   └── css/
│       ├── aff-layout.css               # Panel layout and structure
│       └── aff-theme.css                # Light/dark mode CSS variables
├── assets/
│   ├── fonts/                           # Inter WOFF2 files (4 weights)
│   └── icons/                           # SVG icon set  ← built
├── data/
│   └── aff-defaults.json               # Default subgroup definitions
└── docs/
    └── AFF-Framework-Forge-Spec.md          # Full spec document
```

---

## Naming Prefix Rules — Mandatory

| Layer | Prefix | Example |
|-------|--------|---------|
| PHP classes | `AFF_` | `AFF_CSS_Parser`, `AFF_Admin` |
| JS globals | `AFF` | `AFF.Modal`, `AFF.Theme` |
| CSS classes | `aff-` | `aff-btn`, `aff-panel-left`, `aff-modal` |
| AJAX actions | `aff_` | `aff_save_user_theme`, `aff_sync_variables` |

**Never deviate from these prefixes.** They prevent collisions with WordPress, Elementor, and other plugins.

---

## Critical Rules — Read These First

### 1. AFF_CSS_Parser is read-only — write-back lives only in the AJAX handler
`class-aff-css-parser.php` only reads `post-{id}.css`. It **never writes to, modifies, or regenerates** Elementor's stylesheets. This rule applies to `AFF_CSS_Parser` specifically and must not be violated.

**The one intentional exception:** `AFF_Ajax_Handler::ajax_aff_commit_to_elementor()` writes variable values back to the Elementor kit CSS. This is the **Phase 5 write-back feature** (roadmap: "Write-back to Elementor via API") and is intentionally isolated in the AJAX handler layer only. It must never be merged into `AFF_CSS_Parser` or any parser class. Every call site in the AJAX handler must carry the comment:
```php
// Intentional Phase 5 write-back exception — see AFF CLAUDE.md Critical Rule #1.
```
AFF stores its own project data separately in `.aff.json` files via `class-aff-data-store.php`.

### 2. Portable data layer
`class-aff-data-store.php`, `class-aff-ajax-handler.php`, and all business logic classes must have **no WordPress dependencies**. All WordPress-specific code (hooks, `wp_*` functions, nonces) belongs in thin adapter classes only. AFF is architecturally intended for future port to a standalone Windows/Mac app. The `.aff.json` storage format must remain platform-agnostic.

### 3. No jQuery for AFF UI logic
AFF UI is **vanilla JS** only. WordPress jQuery is available and may be used for WordPress API calls only. Prefer `fetch()` with nonces for all AJAX. The existing `aff-theme.js` and `aff-modal.js` set the pattern — follow them.

### 4. No build process
Pure PHP/JS/CSS. No npm, no Babel, no bundler. ES6+ is fine (modern browser target). Hard-refresh (Ctrl+Shift+R) after JS/CSS changes during development.

### 5. Font override must be scoped
The Inter font override uses `!important` — it must be scoped within `.aff-app *`, never bare `*`, to avoid bleeding into WordPress admin styles outside the AFF panel.

### 6. Elementor v4 `lamp()` quirk
Elementor v4's variable editor has a known typo where it outputs `lamp()` instead of `clamp()`. `AFF_CSS_Parser::normalize_value()` already corrects this. Do not add workarounds elsewhere — funnel all CSS value normalization through that method.

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

- **Root container:** `#aff-app` — carries `data-aff-theme="light|dark"` attribute
- **Max content width:** 1280px (`--jimr-container-max`)
- **Standard panel padding:** 36px (`--sp-9`)
- Left panel collapses to ~48px icon-only bar

---

## Left Menu Panel — Fixed Structure Rules

The menu tree has a **fixed hierarchy** that must not be violated:

```
▼ Variables              ← fixed top-level, cannot rename/remove/reorder
    ▼ Colors             ← fixed second-level, cannot rename/remove/reorder
        • Branding       ← user-definable subgroup (add/rename/reorder/remove)
        • Backgrounds
        • Neutral
        • Status
    ▼ Fonts              ← fixed, subgroups dynamically sourced from Elementor fonts
    ▼ Numbers            ← fixed
        • Spacing
        • Gaps
        • Grids
        • Radius
▶ Classes                ← fixed top-level
▶ Components             ← fixed top-level
```

- User may add/rename/reorder/remove **subgroups** via Manage Project modal
- At least one subgroup must always remain under each parent
- Font subgroups are read-only — sourced from Elementor's font registry
- Active selected item uses `--aff-clr-accent` (`#f4c542` gold) highlight

---

## Theme System

- Controlled by `data-aff-theme="light|dark"` on `#aff-app`
- Toggle via `AFF.Theme.toggle()` or `AFF.Theme.set('light'|'dark')`
- Preference persisted to WordPress `usermeta` via AJAX (`aff_save_user_theme`)
- All colors, backgrounds, borders defined as CSS custom properties in `aff-theme.css`
- Dark mode palette not yet finalized — do not hard-code dark values without confirmation

---

## Modal System

Single-instance modal — never stack modals. Use `AFF.Modal.open({ title, body, footer, onClose })`.

**Behavioral rules (already implemented in `aff-modal.js`):**
- Backdrop scoped to AFF container, not full browser
- ESC key closes
- Click outside modal content closes
- Focus trapped within modal while open
- Focus restored to triggering element on close
- Only one modal open at a time

**Defined modals (v1):** Preferences, Manage Project, Search, Load File, Export, Import, History, Help.

---

## Color System — Exact Values, No Approximations

```css
/* AFF-prefixed theme variables (aff-theme.css) */
--aff-bg-page:        #faf6f0;
--aff-bg-card:        #ffffff;
--aff-bg-panel:       #faf9f6;
--aff-bg-field:       #fff;

--aff-clr-primary:    #3d2f1f;     /* Deep brown — headings */
--aff-clr-secondary:  #6d4c2f;     /* Medium brown — body text */
--aff-clr-accent:     #f4c542;     /* Gold — active states */
--aff-clr-accent-hov: #dda824;     /* Gold hover */
--aff-clr-muted:      #64748b;
--aff-clr-link:       #ce6565;
--aff-clr-link-hov:   #b54545;
--aff-clr-border:     #c9b89a;

--aff-shadow-sm: 0 1px 2px rgba(61,47,31,0.08);
--aff-shadow-md: 0 4px 6px rgba(61,47,31,0.12);
--aff-shadow-lg: 0 10px 20px rgba(61,47,31,0.15);
--aff-shadow-xl: 0 20px 30px rgba(61,47,31,0.18);
```

Never substitute, approximate, or invent color values. These are the exact JimRForge brand palette.

---

## Button Standards

### Primary (Gold) — `.aff-btn`
- Background: `--aff-clr-accent` (#f4c542), Text: `--aff-clr-primary` (#3d2f1f)
- Hover: background `--aff-clr-accent-hov`, transform `translate(-2px, -2px)`
- Font: 14px (`--fs-sm`), weight 600 (`--fw-semibold`)
- **Text must be sentence case in HTML** — not via `text-transform`
- No borders — use `box-shadow` for depth only
- No gray/ghost secondary buttons

### Icon-Only — `.aff-icon-btn`
- Background: transparent at rest, subtle `rgba(61,47,31,0.08)` on hover
- No border at rest
- Tooltip appears after **300ms** CSS hover delay (not browser default `title` behavior)
- All icon buttons must have `aria-label` attribute

---

## Icon System

All icons are **inline SVG** from `assets/icons/`. No icon fonts. All icons use `fill: currentColor` or `stroke: currentColor` so they respond to theme changes automatically. Existing icon files in `assets/icons/` cover the full UI set — use those, do not add new icon libraries.

---

## Accessibility — Minimum WCAG 2.1 AA

- All icon buttons: `aria-label` attribute required
- Focus style: `2px solid var(--aff-clr-accent)`, `outline-offset: 2px`
- Modal: focus trap pattern (already in `aff-modal.js`)
- Left menu tree: arrow key navigation, Enter to select, Space to expand/collapse
- AFF panel must not break WordPress's own accessibility

---

## Data Models (reference)

**Variable:**
```json
{ "id": "uuid-v4", "name": "--aff-color-brand-primary", "value": "#2C3E50",
  "type": "color", "group": "Variables", "subgroup": "Colors",
  "category": "Branding", "source": "elementor-parsed",
  "modified": false, "created_at": "ISO8601", "updated_at": "ISO8601" }
```

**Storage format:** `.aff.json` — platform-agnostic JSON. Saved to WordPress uploads or user-specified path.

---

## PHP Standards

- All classes prefixed `AFF_`
- Follow WordPress Coding Standards
- AJAX: `wp_ajax_{action}` hooks + `check_ajax_referer()` on every endpoint
- No direct file access: `if ( ! defined( 'ABSPATH' ) ) { exit; }` in every PHP file
- Enqueue assets only on the AFF admin page (check `$hook`)
- Admin page slug: `atomic-framework-forge`
- Required capability: `manage_options`

---

## Roadmap Phases (do not build ahead of phase)

| Phase | Scope |
|-------|-------|
| **v1 (current)** | Framework: layout, panels, left menu, right panel, top bar, modal system, CSS parser, variable data model, light/dark mode, file save/load |
| **v2** | Edit space content: variable list/edit UI, inline editing, drag-to-reorder |
| **v3** | Classes support |
| **v4** | Components registry |
| **v5** | Write-back to Elementor via API, History/undo, Export/Import |

Do not add v2+ functionality unless Jim explicitly requests it. The center edit space in v1 shows only a placeholder message: "Select a category from the left panel."

---

## Pending Roadmap Item (confirmed)

**Pickr color picker** (`Simonwep/pickr`, classic theme) on `.aff-color-value-input` in the expand modal. Formats: HEXA, RGBA, HSLA only. Load as zero-dependency `<script>` — no build step. Do not integrate until Jim initiates this work.

---

## Version Number Locations

When bumping the version, update **all seven** of these locations:

| File | Field |
|------|-------|
| `atomic-framework-forge-for-elementor.php` | `* Version:` header |
| `atomic-framework-forge-for-elementor.php` | `define( 'AFF_VERSION', ... )` constant |
| `readme.txt` | `Stable tag:` field |
| `readme.txt` | `=== Key Features (Beta x.x.x) ===` heading |
| `readme.txt` | New entry in `== Changelog ==` section |
| `readme.txt` | New entry in `== Upgrade Notice ==` section |
| `CHANGELOG.md` | New entry at top (full detail) |
| `README.md` | Two badge URLs + "Beta x.x.x" references + roadmap table row |
| `QUICK-START.md` | Header line + any zip filename references |
| `USER-MANUAL.md` | Header line |

After all edits, search for the old version string — it should appear zero times outside of changelog/history sections.

---

## Quick Checks Before Any AFF Code Change

- [ ] CSS class uses `aff-` prefix
- [ ] PHP class uses `AFF_` prefix
- [ ] JS global uses `AFF` namespace
- [ ] No jQuery in UI logic (use `fetch()` for AJAX)
- [ ] No writes to Elementor CSS files
- [ ] Font override scoped to `.aff-app *` not bare `*`
- [ ] Button text is sentence case in HTML
- [ ] Icon buttons have `aria-label`
- [ ] Color values match exact hex from the color system above
- [ ] Data layer classes have no WordPress-specific function calls
