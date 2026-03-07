# EFF Master Specification
## Elementor Framework Forge — Complete Build Reference

**Version:** 2.1
**Date:** 2026-03-07
**Status:** Living document — updated to reflect v1.0.0 implementation and Phase 2 design

---

## How to Read This Document

This document is the single authoritative reference for the EFF plugin. It merges the original build spec (EFF-Claude-Code-Spec-v2), the Phase 2 Colors design spec (EFF-Phase2-Colors-Spec-v1), and the v1.0.0 implementation.

- **(Built)** — Item is implemented in v1.0.0 and the description reflects the actual implementation.
- **(Planned)** — Item is specified but not yet built. Description reflects the design intent.
- When the implementation diverged from the original spec, the implementation is authoritative and is documented here without qualification.

---

## Table of Contents

1. [Purpose and Scope](#1-purpose-and-scope)
2. [Elementor v4 Architecture Context](#2-elementor-v4-architecture-context)
3. [Plugin File Structure](#3-plugin-file-structure)
4. [Screen Layout](#4-screen-layout)
5. [Design System](#5-design-system)
6. [Component Library](#6-component-library)
7. [Accessibility Standards](#7-accessibility-standards)
8. [Data Architecture](#8-data-architecture)
9. [CSS Parsing Module](#9-css-parsing-module)
10. [Usage Scanner](#10-usage-scanner)
11. [State Management](#11-state-management)
12. [AJAX API](#12-ajax-api)
13. [JavaScript Module System](#13-javascript-module-system)
14. [Settings and Preferences](#14-settings-and-preferences)
15. [Phase 2: Colors Edit Space](#15-phase-2-colors-edit-space)
16. [Version Roadmap](#16-version-roadmap)
17. [Build and Development Standards](#17-build-and-development-standards)

---

## 1. Purpose and Scope

EFF (Elementor Framework Forge) is a WordPress admin tool for developers who build sites on Elementor v4. It provides a structured workspace for managing the three asset types used by Elementor v4 atomic widgets:

- **Variables** — CSS custom properties (`--name: value`) defined in the kit's `:root` block.
- **Classes** — Reusable CSS class definitions (EFF v3).
- **Components** — Multi-class widget templates (EFF v4).

EFF is NOT an Elementor replacement or a site editor. It is a developer-side management layer that reads from and writes to Elementor's data layer.

### Design Philosophy

The plugin is built with future portability in mind. All business logic in the PHP layer is free of WordPress dependencies. WordPress-specific code is isolated in clearly-marked adapter methods. The data format (`.eff.json`) is platform-agnostic. This allows a future port to a standalone Windows or macOS desktop application by replacing only the adapter layer.

### Plugin Identity

| Property | Value |
|---|---|
| Plugin name | Elementor Framework Forge |
| Menu label | EFF |
| Admin slug | `elementor-framework-forge` |
| PHP class prefix | `EFF_` |
| CSS class prefix | `eff-` |
| JS global prefix | `EFF` |
| Capability required | `manage_options` |
| WordPress hook | `plugins_loaded` |
| Elementor dependency | Both Elementor and Elementor Pro required |

---

## 2. Elementor v4 Architecture Context

### The Kit CSS File

Elementor compiles all kit-level CSS (global styles, tokens, variable definitions) into a single file:

```
wp-content/uploads/elementor/css/post-{kit_id}.css
```

The kit post ID is stored in the WordPress option `elementor_active_kit`. On the test site, the active kit ID is 67, producing `post-67.css`.

### Two `:root` Blocks

The kit CSS file contains two `:root` blocks:

1. **Legacy block** — Contains `--e-global-*` variables (colors, fonts defined through the Elementor Global Settings UI). These use the `--e-global-` prefix and other system prefixes.

2. **v4 Atomic block** — The terminal `:root` block in the file, appended by Elementor v4. Contains user-defined CSS custom properties without system prefixes. This is the block EFF reads.

EFF identifies the v4 block by iterating `:root` blocks from last to first and returning the first one whose variables do not start with any known system prefix. See Section 9 for the full prefix exclusion list.

### Known Elementor v4 Bug: `lamp()` / `clamp()`

Elementor v4's variable editor has a known typo where it outputs `lamp()` instead of `clamp()` for fluid value expressions. EFF normalizes this silently during parsing: any occurrence of `lamp(` in a variable value is replaced with `clamp(`.

### Variable Types (Conceptual)

EFF organizes variables into three subgroups under the Variables group:

| Subgroup | Contents |
|---|---|
| Colors | Color values — hex, hsl, rgb, named, var() references |
| Fonts | Font-family stacks, font-size tokens |
| Numbers | Spacing, sizing, radius, gap, grid tokens |

---

## 3. Plugin File Structure

### Actual File Tree (Built)

```
elementor-framework-forge/
├── elementor-framework-forge.php   Main plugin file, bootstrap
├── readme.txt
├── admin/
│   ├── css/
│   │   ├── eff-theme.css           Design tokens, light/dark mode, base styles
│   │   └── eff-layout.css          Four-panel structure, panel sizing, collapse
│   ├── js/
│   │   ├── eff-theme.js            Light/dark mode management (EFF.Theme)
│   │   ├── eff-modal.js            Single-instance modal dialog (EFF.Modal)
│   │   ├── eff-panel-left.js       Nav tree, accordion, collapse (EFF.PanelLeft)
│   │   ├── eff-panel-right.js      File management, counts (EFF.PanelRight)
│   │   ├── eff-panel-top.js        Top bar buttons, tooltips (EFF.PanelTop)
│   │   ├── eff-edit-space.js       Center content area (EFF.EditSpace)
│   │   └── eff-app.js              Main entry point, global state (EFF.App)
│   └── views/
│       └── page-eff-main.php       HTML template for the admin page
├── assets/
│   ├── fonts/
│   │   └── Inter-*.woff2           Inter font, locally served
│   ├── icons/
│   │   ├── gear.svg                Preferences
│   │   ├── grid.svg                Manage Project
│   │   ├── search.svg              Search
│   │   ├── export.svg              Export
│   │   ├── import.svg              Import
│   │   ├── sync.svg                Sync from Elementor
│   │   ├── history.svg             Change History
│   │   ├── help.svg                Help
│   │   ├── variables.svg           Variables nav icon
│   │   ├── classes.svg             Classes nav icon
│   │   ├── components.svg          Components nav icon
│   │   ├── colors.svg              Colors subgroup icon
│   │   ├── fonts.svg               Fonts subgroup icon
│   │   ├── numbers.svg             Numbers subgroup icon
│   │   ├── chevron-left.svg        Collapse left panel
│   │   ├── chevron-right.svg       Expand left panel
│   │   ├── folder-open.svg         Load file
│   │   ├── save.svg                Save file
│   │   ├── checkmark.svg           Save Changes
│   │   └── close.svg               Close / modal close
│   └── images/
│       └── banner-jimr-forge.png   Background watermark image
├── data/
│   └── eff-defaults.json           Default project config structure
├── includes/
│   ├── class-eff-loader.php        Bootstrap: requires all classes, registers hooks
│   ├── class-eff-admin.php         Admin menu, asset enqueueing, page render
│   ├── class-eff-ajax-handler.php  All AJAX endpoint registration and handling
│   ├── class-eff-data-store.php    Data model, CRUD, file persistence
│   ├── class-eff-css-parser.php    Elementor CSS file locator and variable extractor
│   ├── class-eff-usage-scanner.php Widget-level variable reference counter
│   └── class-eff-settings.php      Plugin-level preferences (wp_options)
└── docs/
    ├── EFF-Claude-Code-Spec-v2.pdf     Original v1 build spec (archived)
    ├── EFF-Phase2-Colors-Spec-v1.pdf   Phase 2 colors design spec (archived)
    └── EFF-Master-Specification.md     This document
```

### Notes on File Structure Divergences

- `class-eff-usage-scanner.php` was added during development and is not in the original spec file tree.
- `class-eff-settings.php` was present in the original spec and is implemented as specified.
- The `admin/views/` directory name diverges from no explicit spec name — implemented as shown.
- JS modules `eff-panel-left.js`, `eff-panel-right.js`, `eff-panel-top.js`, `eff-edit-space.js` were added beyond the minimal `eff-modal.js` and `eff-theme.js` mentioned in the original spec.

---

## 4. Screen Layout

### Overview

The EFF admin page is a full-viewport single-page application scoped inside `.eff-app`. WordPress's own admin chrome (top bar, left nav) sits outside.

The layout consists of four regions:

```
┌─────────────────────────────────────────────────────┐
│  TOP BAR (.eff-top-bar)                             │
├──────────────┬──────────────────────┬───────────────┤
│  LEFT PANEL  │   CENTER EDIT SPACE  │  RIGHT PANEL  │
│ (.eff-panel- │   (.eff-edit-space)  │ (.eff-panel-  │
│   left)      │                      │   right)      │
│  220px       │   flex: 1            │  260px        │
│  (collaps-   │                      │  (fixed)      │
│  ible)       │                      │               │
└──────────────┴──────────────────────┴───────────────┘
```

### Top Bar (Built)

The top bar `.eff-top-bar` is divided into three sections:

- **Left** (`.eff-top-bar__left`): Preferences button (`eff-btn-preferences`) and Manage Project button (`eff-btn-manage-project`).
- **Center** (`.eff-top-bar__brand`): The brand name "Elementor Framework Forge" as static text. This was added during implementation and is not in the original spec.
- **Right** (`.eff-top-bar__right`): Export, Import, Sync, History, Search, Help icon buttons.

The original spec described a two-section layout (left/right only). The implemented three-section layout with a centered brand name is the authoritative design.

### Left Panel (Built)

- Width: 220px expanded, 48px collapsed (icon-only mode).
- Collapse is triggered by the chevron button (`eff-btn-collapse-left`) at the bottom.
- Collapse state uses `[data-collapsed="true"]` attribute on `.eff-panel-left`. CSS transitions handle the width animation.
- Contains an accordion navigation tree: Groups → Subgroups → Category leaf items.
- Each group header uses `aria-expanded` and `aria-controls` for ARIA-compliant accordion behavior.
- Category items are dynamically populated from the project config loaded from WordPress options.
- When collapsed, the version badge (`.eff-panel-version`) is hidden. When expanded, it appears pinned to the panel bottom via `margin-top: auto`.
- **Version badge**: `v{EFF_VERSION}` is displayed at the bottom of the left panel. This was added during implementation and is not in the original spec.

### Center Edit Space (Built)

The center `.eff-workspace` contains two mutually exclusive content states:

1. **Placeholder state** (`.eff-placeholder`, `id="eff-placeholder"`): Shown when no category is selected. Displays a welcome message.
2. **Active state** (`.eff-edit-content`, `id="eff-edit-content"`, `aria-live="polite"`): Shown when a category is selected. Content is dynamically injected by `EFF.EditSpace.loadCategory()`.

**Background Image (Built — diverges from original spec)**

The center workspace has a decorative background using a CSS pseudo-element, not a placeholder `<img>` element.

- `.eff-workspace` has `position: relative; isolation: isolate`.
- `.eff-workspace::before` is positioned absolutely, covers the full workspace, uses `url('../../assets/images/banner-jimr-forge.png')`, `background-size: contain`, `background-position: center`, `background-repeat: no-repeat`.
- Initial opacity: `1` (full background image when no category is loaded).
- When `.eff-workspace[data-active="true"]`: opacity fades to `0.04` (near-invisible watermark).
- The `data-active="true"` attribute is set by `EFF.EditSpace.loadCategory()` and removed by `EFF.EditSpace.reset()`.

The original spec called for a placeholder `<img>` element. The implemented `::before` pseudo-element approach is authoritative.

### Right Panel (Built)

- Fixed width: 260px.
- Contains: filename input (`id="eff-filename"`), Load button (`id="eff-btn-load"`), Save button (`id="eff-btn-save"`), asset counts display, Save Changes button (`id="eff-btn-save-changes"`).
- Asset counts update in real time as variables/classes/components are added: `id="eff-count-variables"`, `id="eff-count-classes"`, `id="eff-count-components"`.
- Save Changes button is disabled when `EFF.state.hasUnsavedChanges === false`, enabled and styled in gold when true.

### Mobile Restriction

At viewport widths below 1024px, `.eff-app` is hidden and a `.eff-mobile-restriction` overlay is shown. EFF requires a minimum 1024px viewport and is explicitly not designed for mobile use.

---

## 5. Design System

### Typography

- **Font family**: Inter, served locally from `assets/fonts/`. Includes Regular (400), Medium (500), SemiBold (600), Bold (700).
- Font is scoped strictly to `.eff-app` using `font-family: 'Inter', system-ui, sans-serif !important` to prevent inheritance bleed from WordPress admin styles.
- CSS font-face paths use three levels relative from `admin/css/`: `url('../../../assets/fonts/Inter-*.woff2')`.
- Base font size: 14px. Line height: 1.5.

### Spacing Scale

| Token | Value | Usage |
|---|---|---|
| `--eff-space-1` | 4px | Micro gap |
| `--eff-space-2` | 8px | Compact padding |
| `--eff-space-3` | 12px | Default gap |
| `--eff-space-4` | 16px | Standard padding |
| `--eff-space-5` | 24px | Section spacing |
| `--eff-space-6` | 32px | Large spacing |

### Color Tokens (Built)

All design tokens use the `--eff-` prefix. Tokens are defined in `eff-theme.css` under `[data-eff-theme="light"]` and `[data-eff-theme="dark"]` selectors (both `[data-eff-theme="..."]` and `.eff-app[data-eff-theme="..."]` are targeted for specificity).

**Light Mode Core Tokens**

| Token | Value | Role |
|---|---|---|
| `--eff-bg-page` | `#f5f0eb` | Page/app background |
| `--eff-bg-panel` | `#ffffff` | Panel backgrounds |
| `--eff-bg-surface` | `#faf7f4` | Surface backgrounds |
| `--eff-clr-primary` | `#1a1007` | Primary text |
| `--eff-clr-secondary` | `#3d2f1f` | Secondary text |
| `--eff-clr-muted` | `#6d5c48` | Muted/placeholder text |
| `--eff-clr-accent` | `#f4c542` | JimRForge gold accent |
| `--eff-border-color` | `#e0d8d0` | Panel/field borders |
| `--eff-top-bar-bg` | `#3d2f1f` | Top bar background (deep brown) |
| `--eff-top-bar-border` | `#5a3f28` | Top bar bottom border |

**Dark Mode Core Tokens**

Dark mode is fully implemented. The dark palette uses very dark warm brown backgrounds and light cream text.

| Token | Value | Role |
|---|---|---|
| `--eff-bg-page` | `#1a1007` | Page background |
| `--eff-bg-panel` | `#2a1f10` | Panel backgrounds |
| `--eff-bg-surface` | `#231808` | Surface backgrounds |
| `--eff-clr-primary` | `#f5ede0` | Primary text |
| `--eff-clr-secondary` | `#c8b49a` | Secondary text |
| `--eff-clr-muted` | `#8a7060` | Muted text |
| `--eff-clr-accent` | `#f4c542` | Gold accent (unchanged) |
| `--eff-border-color` | `#3d2f1f` | Borders |
| `--eff-top-bar-bg` | `#120d06` | Top bar (near black) |

**Additional Tokens (Built — beyond original spec)**

| Token | Role |
|---|---|
| `--eff-nav-active-bg` | Active nav item background |
| `--eff-nav-active-color` | Active nav item text |
| `--eff-nav-hover-bg` | Nav item hover background |
| `--eff-icon-btn-hover-bg` | Icon button hover background |
| `--eff-overlay-bg` | Modal overlay tint |
| `--eff-field-shadow` | Phase 2 pit/recess shadow on input fields |
| `--eff-swatch-shadow` | Phase 2 pit/recess shadow on color swatches |

### Light/Dark Mode

- Theme is stored per-user in WordPress user meta key `eff_theme_preference`.
- PHP reads the preference and sets `data-eff-theme="light|dark"` on `.eff-app` during server-side render.
- `EFF.Theme.init()` reads the attribute on page load.
- `EFF.Theme.set('light'|'dark')` updates the attribute and persists via AJAX to `eff_save_user_theme`.
- Default theme is `light` when no preference is set.

### JimRForge Brand Palette

| Role | Color |
|---|---|
| Deep brown | `#3d2f1f` |
| Medium brown | `#6d4c2f` |
| Light brown | `#6d5c48` |
| Gold accent | `#f4c542` |
| Cream | `#f5ede0` |

---

## 6. Component Library

### Icon System (Built)

Icons are inline SVG files stored in `assets/icons/`. They are inlined at render time by the `eff_icon( $name )` PHP helper function in `page-eff-main.php`:

```php
function eff_icon( string $name ): string {
    $path = EFF_PLUGIN_DIR . 'assets/icons/' . $name . '.svg';
    return file_exists( $path ) ? file_get_contents( $path ) : '';
}
```

SVG icons inherit `currentColor` for stroke/fill so they respond to CSS color changes automatically.

Available icons: `gear`, `grid`, `search`, `export`, `import`, `sync`, `history`, `help`, `variables`, `classes`, `components`, `colors`, `fonts`, `numbers`, `chevron-left`, `chevron-right`, `folder-open`, `save`, `checkmark`, `close`.

### Icon Buttons (Built)

Icon buttons use class `.eff-icon-btn`. Dimensions: 36×36px. Hover state uses `--eff-icon-btn-hover-bg` background with rounded corners. All icon buttons carry a `data-eff-tooltip` attribute for tooltip display.

### Tooltips (Built)

Single `.eff-tooltip` div positioned by JavaScript (`id="eff-tooltip"`). `EFF.PanelTop` binds `mouseenter`/`mouseleave`/`focus`/`blur` to all `[data-eff-tooltip]` elements. Tooltip appears after a 300ms delay, positioned below the anchor element centered horizontally.

### Standard Buttons (Built)

Class `.eff-btn` for standard action buttons. Active Save Changes state: `.eff-save-changes-btn:not(:disabled)` receives gold color treatment.

### Form Fields (Built)

- Text inputs: `.eff-field-input`
- Labels: `.eff-field-label`
- Phase 2 adds pit/recess shadow treatment via `--eff-field-shadow` and `--eff-swatch-shadow` tokens.

### Modal Dialog System (Built)

Single-instance modal. One `.eff-modal-overlay` and one `.eff-modal` in the DOM at all times. `EFF.Modal.open({ title, body, footer })` injects content; `EFF.Modal.close()` removes it.

**Accessibility:**
- Focus trap active while modal is open (tabs cycle within modal only).
- ESC key closes the modal.
- Click on overlay (outside `.eff-modal`) closes the modal.
- `aria-hidden` toggled on the overlay.
- Focus restored to the triggering element on close.

**DOM structure:**
```
#eff-modal-overlay (.eff-modal-overlay)
  └─ #eff-modal (.eff-modal)
       ├─ .eff-modal-header
       │    ├─ #eff-modal-title
       │    └─ #eff-modal-close (×)
       ├─ #eff-modal-body
       └─ #eff-modal-footer
```

Modal styling is defined in `eff-theme.css` (not `eff-layout.css`).

---

## 7. Accessibility Standards

Target: WCAG 2.1 AA.

### Implemented

- All icon buttons have `aria-label` attributes.
- Tooltip text served via `aria-label` on all top-bar buttons.
- Modal: focus trap, ESC close, focus restoration, `aria-hidden` toggle.
- Left panel accordion: `aria-expanded` and `aria-controls` on all group/subgroup headers.
- Active nav item: `aria-current="page"` on the selected `.eff-nav-item`.
- Edit space: `aria-live="polite"` on `#eff-edit-content` for dynamic content announcements.
- Keyboard navigation on group headers: Enter/Space to toggle. (Built)
- Arrow Up/Down between nav items. (Built per module spec; implemented in `EFF.PanelLeft`)
- Usage badges: `aria-label` with human-readable description ("Used 3 times", "Unused").
- `beforeunload` warning when there are unsaved changes.

### Standards

- Color contrast: all text meets WCAG AA minimums in both light and dark modes.
- Focus indicators: visible in both themes.
- No ARIA roles applied to non-interactive elements.

---

## 8. Data Architecture

### The `.eff.json` File Format

Project data is persisted to `.eff.json` files stored in `wp-content/uploads/eff/`. The format is platform-agnostic JSON.

```json
{
  "version": "1.0",
  "config": {
    "groups": {
      "Variables": {
        "Colors":  ["Branding", "Backgrounds", "Neutral", "Status"],
        "Fonts":   [],
        "Numbers": ["Spacing", "Gaps", "Grids", "Radius"]
      }
    }
  },
  "variables": [ ... ],
  "classes": [],
  "components": [],
  "metadata": {}
}
```

Filenames are sanitized and the `.eff.json` extension is enforced by `EFF_Data_Store::sanitize_filename()`.

### Variable Data Model (Built — v1.0.0)

```json
{
  "id":         "uuid-v4-style",
  "name":       "--primary-color",
  "value":      "#3d2f1f",
  "type":       "unknown",
  "group":      "Variables",
  "subgroup":   "Colors",
  "category":   "Branding",
  "source":     "user-defined",
  "modified":   false,
  "created_at": "2026-03-07T00:00:00+00:00",
  "updated_at": "2026-03-07T00:00:00+00:00"
}
```

**Phase 2 extension to this model** — see Section 15 for the extended variable data model including `status` enum, `original_value`, `format`, `category_id`, `order`, and `pending_rename_from` fields.

### Variable Source Values

| Value | Meaning |
|---|---|
| `"elementor-parsed"` | Imported via Sync from Elementor |
| `"user-defined"` | Added manually in EFF |

### EFF_Data_Store (Built)

PHP class. Core logic section is explicitly WordPress-free. WordPress-specific code (file path resolution, filename sanitization) isolated in static adapter methods at the bottom of the class.

Key methods:
- `load_from_file(string $file_path): bool`
- `save_to_file(string $file_path): bool`
- `import_parsed_variables(array $parsed_vars): int` — adds new, preserves existing
- `add_variable(array $var): string` — returns UUID
- `update_variable(string $id, array $data): bool`
- `delete_variable(string $id): bool`
- `find_variable_by_name(string $name): ?array`
- `get_counts(): array` — `{ variables, classes, components }`
- `get_all_data(): array`
- `static get_wp_storage_dir(): string` — returns `uploads/eff/` with trailing slash
- `static sanitize_filename(string $filename): string` — enforces `.eff.json`

IDs are generated as UUID v4-style strings using `mt_rand()`.

### EFF_Settings (Built)

Plugin-level preferences stored in `wp_options` under key `eff_settings`.

```php
$defaults = [
    'default_file_path' => '',
    'auto_sync'         => false,
];
```

Static interface: `EFF_Settings::get()`, `EFF_Settings::set(array $data)`, `EFF_Settings::get_defaults()`.

User-level preferences (theme) are stored separately in user meta.

### Project Config

Stored in `wp_options` under key `eff_project_config`. Separate from the `.eff.json` file. Defines the subgroup structure for the left panel navigation tree. If no saved config, the plugin falls back to `data/eff-defaults.json`.

---

## 9. CSS Parsing Module

### EFF_CSS_Parser (Built)

Read-only. Never modifies Elementor's CSS files.

**Finding the kit file:**

1. Read `get_option('elementor_active_kit')` to get the kit post ID.
2. Look for `uploads/elementor/css/post-{kit_id}.css`.
3. If not found, fall back to scanning `uploads/elementor/css/post-*.css`, sorted by modification time (newest first). Test each for presence of v4 variables.

**Extraction algorithm:**

1. Find all `:root { ... }` blocks via regex `/:root\s*\{([^}]+)\}/`.
2. Iterate blocks in reverse order (last block first).
3. Parse variables from each block via regex `/(--[\w-]+)\s*:\s*([^;]+);/`.
4. Filter out any variable whose name starts with a system prefix.
5. Return the first block that has at least one user variable.

**System prefix exclusion list** (SYSTEM_PREFIXES constant):

`--e-global-`, `--e-a-`, `--e-one-`, `--e-context-`, `--e-button-`, `--e-notice-`, `--e-site-editor-`, `--e-preview-`, `--e-black`, `--e-admin-`, `--e-focus-`, `--arts-fluid-`, `--arts-`, `--container-`, `--kit-`, `--widgets-spacing`, `--page-title-`

**`lamp()` normalization:**

Applied via `preg_replace('/\blamp\s*\(/', 'clamp(', $value)` on each extracted variable value.

**Public API:**
- `find_kit_css_file(): ?string`
- `parse_file(string $file_path): array` — returns `[{ name, value }, ...]`
- `get_kit_css_mtime(): ?int`
- `extract_v4_variables(string $css): array`

---

## 10. Usage Scanner

### EFF_Usage_Scanner (Built — not in original spec)

Scans all Elementor widget data stored in `_elementor_data` post meta for references to CSS custom properties.

**Method:** `static scan(array $variable_names): array<string, int>`

Returns a map of variable name to total usage count across all scanned posts.

**Implementation details:**
- Queries all post types and statuses using `get_posts()` with `meta_query` checking for existence of `_elementor_data`.
- `MAX_POSTS = 500` cap to prevent memory issues on large sites.
- `no_found_rows: true` skips the SQL `COUNT(*)` pagination query for performance.
- Uses `substr_count($data, 'var(' . $var_name)` on the raw JSON string. No JSON decoding required.
- The search pattern `var(--varname` (without closing paren) matches both `var(--x)` and `var(--x, fallback)` in a single pass.

**AJAX integration:** The `eff_get_usage_counts` endpoint accepts a JSON array of variable names. Variable names are sanitized server-side to allow only valid CSS custom property names matching `/^--[\w-]+$/`.

**UI integration:**
- `EFF.App.fetchUsageCounts()` is called automatically after file load and after sync.
- Results are stored in `EFF.state.usageCounts` (`{ '--varname': count }`).
- When counts are available, `EFF.EditSpace` adds a Usage column to the variable list.
- Usage badges: `.eff-usage-badge--active` (gold background, count > 0) and `.eff-usage-badge--unused` (muted with border, count = 0).
- Usage counts are treated as best-effort — failures are caught silently.

---

## 11. State Management

### Global State Object (Built)

`EFF.state` in `eff-app.js`:

```js
EFF.state = {
    hasUnsavedChanges: false,      // Drives Save Changes button
    currentSelection:  null,       // { group, subgroup, category }
    currentFile:       null,       // Currently loaded filename string
    theme:             'light',    // 'light' | 'dark'
    variables:         [],         // Loaded variable objects
    classes:           [],         // Loaded class objects
    components:        [],         // Loaded component objects
    config:            {},         // Project config (subgroup definitions)
    usageCounts:       {},         // { '--varname': count }
}
```

### Dirty Flag (Built)

`EFF.App.setDirty(isDirty)` sets `EFF.state.hasUnsavedChanges` and updates the Save Changes button state. The button is disabled when clean and enabled with gold styling when dirty.

A `beforeunload` event listener warns the user if they attempt to navigate away with unsaved changes.

### Unsaved Change Triggers

- Variables added via Sync (if new variables found)
- Manual variable edits (Phase 2)

### Initialization Order (Built)

On `DOMContentLoaded`, modules initialize in this strict order:

1. `EFF.Theme.init()` — reads `data-eff-theme` from DOM (no AJAX)
2. `EFF.Modal.init()` — must be ready before any button opens a modal
3. `EFF.PanelRight.init()` — file management
4. `EFF.EditSpace.init()` — center content
5. `EFF.PanelTop.init()` — buttons and tooltips (requires Modal)
6. `EFF.App.loadConfig()` then `EFF.PanelLeft.init()` — nav tree (requires config)
7. `EFF.App.refreshCounts()` — initial zero counts

### Phase 2 State Extensions (Planned)

Phase 2 adds two additional save-state flags to the state model:

- `hasEFFUnsavedChanges` — the in-memory EFF data is out of sync with the `.eff.json` file on disk.
- `hasPendingElementorCommit` — the EFF data has been saved to `.eff.json` but not yet pushed to Elementor's `:root` block.

These are separate flags because saving to `.eff.json` and committing to Elementor are distinct operations with different consequences. See Section 15 for full Phase 2 state specification.

---

## 12. AJAX API

### Security (Built)

All endpoints are protected by `EFF_Ajax_Handler::verify_request()`:

1. `check_ajax_referer('eff_admin_nonce', 'nonce', false)` — nonce verification.
2. `current_user_can('manage_options')` — capability check.

Both checks must pass. On failure, a 403 JSON error response is returned immediately.

The nonce is generated server-side and passed to JS via `wp_localize_script` as `EFFData.nonce`.

### EFFData JS Object (Built)

Available globally as `window.EFFData`:

```js
{
    ajaxUrl:   'http://site.local/wp-admin/admin-ajax.php',
    nonce:     '{wp_nonce}',
    theme:     'light',
    version:   '1.0.0',
    uploadUrl: 'http://site.local/wp-content/uploads/eff/',
    pluginUrl: 'http://site.local/wp-content/plugins/elementor-framework-forge/',
}
```

### AJAX Transport (Built)

`EFF.App.ajax(action, data)` uses the Fetch API with `application/x-www-form-urlencoded` content type and `credentials: 'same-origin'`. Returns a Promise resolving to the parsed JSON response.

### Endpoint Reference (Built)

| Action | Handler | Description |
|---|---|---|
| `eff_save_file` | `ajax_eff_save_file` | Save project data to `.eff.json` |
| `eff_load_file` | `ajax_eff_load_file` | Load project data from `.eff.json` |
| `eff_sync_from_elementor` | `ajax_eff_sync_from_elementor` | Extract variables from Elementor kit CSS |
| `eff_save_user_theme` | `ajax_eff_save_user_theme` | Persist theme preference to user meta |
| `eff_get_config` | `ajax_eff_get_config` | Get project config (saved or defaults) |
| `eff_save_config` | `ajax_eff_save_config` | Save project config to `wp_options` |
| `eff_save_settings` | `ajax_eff_save_settings` | Save plugin settings to `wp_options` |
| `eff_get_settings` | `ajax_eff_get_settings` | Get plugin settings |
| `eff_get_usage_counts` | `ajax_eff_get_usage_counts` | Scan Elementor widget data for variable usage |

### Phase 2 Planned Endpoints (Planned)

| Action | Description |
|---|---|
| `eff_save_category` | Create or update a color category |
| `eff_delete_category` | Delete a color category |
| `eff_reorder_categories` | Save category display order |
| `eff_save_color` | Create or update a color variable |
| `eff_delete_color` | Delete a color variable |
| `eff_reorder_colors` | Save variable display order within a category |
| `eff_generate_children` | Generate tint/shade/transparency child variables |
| `eff_commit_to_elementor` | Write EFF variable values back to Elementor kit |

---

## 13. JavaScript Module System

### Module Architecture (Built)

All JS modules are loaded as separate script files in dependency order. Each module wraps its code in an IIFE using `'use strict'`. Modules attach themselves to `window.EFF` as named objects before `eff-app.js` runs.

### Enqueue Order and Dependencies (Built)

PHP enqueues modules in this order, each depending on the previous:

| Handle | File | Attaches to |
|---|---|---|
| `eff-theme` | `admin/js/eff-theme.js` | `EFF.Theme` |
| `eff-modal` | `admin/js/eff-modal.js` | `EFF.Modal` |
| `eff-panel-left` | `admin/js/eff-panel-left.js` | `EFF.PanelLeft` |
| `eff-panel-right` | `admin/js/eff-panel-right.js` | `EFF.PanelRight` |
| `eff-panel-top` | `admin/js/eff-panel-top.js` | `EFF.PanelTop` |
| `eff-edit-space` | `admin/js/eff-edit-space.js` | `EFF.EditSpace` |
| `eff-app` | `admin/js/eff-app.js` | `EFF.App`, `EFF.state` |

All modules load in the footer (`in_footer: true`).

### Module API Summary

**EFF.Theme**
- `init()` — reads `data-eff-theme` from `#eff-app`
- `set(theme)` — sets theme, persists via AJAX
- `toggle()` — toggles between light and dark
- `current` — current theme string

**EFF.Modal**
- `init()` — binds close button, overlay click, ESC key
- `open({ title, body, footer, onClose })` — injects content, shows modal, traps focus
- `close()` — hides modal, restores focus, clears content after transition
- `isOpen()` — returns boolean

**EFF.PanelLeft**
- `init()` — binds group headers, subgroup headers, collapse toggle, loads nav items
- `selectItem(btn, listId, category)` — marks active, updates `EFF.state.currentSelection`, calls `EFF.EditSpace.loadCategory()`
- `refresh()` — re-populates nav items from updated config

**EFF.PanelRight**
- `init()` — binds Load, Save, Save Changes buttons
- `updateSaveChangesBtn()` — sets disabled/enabled state from `EFF.state.hasUnsavedChanges`
- `updateCounts({ variables, classes, components })` — updates DOM count displays

**EFF.PanelTop**
- `init()` — binds all top bar button handlers and tooltip system
- Handles: Preferences, Manage Project, Export, Import, Sync, History, Search, Help
- Export, Import, History modals show "arrives in EFF v5" placeholder message

**EFF.EditSpace**
- `init()` — caches DOM references
- `loadCategory(selection)` — sets `data-active` on workspace, renders category view
- `reset()` — removes `data-active`, shows placeholder

**EFF.App**
- `setDirty(isDirty)` — updates `hasUnsavedChanges`, calls `PanelRight.updateSaveChangesBtn()`
- `refreshCounts()` — re-calculates from state arrays, calls `PanelRight.updateCounts()`
- `ajax(action, data)` — Fetch-based AJAX helper, returns Promise
- `fetchUsageCounts()` — sends variable names to `eff_get_usage_counts`, stores result in `EFF.state.usageCounts`
- `loadConfig()` — loads project config from `eff_get_config`

---

## 14. Settings and Preferences

### Plugin Settings (Built)

Stored in `wp_options` key `eff_settings`. Managed via `EFF_Settings` class.

| Key | Type | Default | Description |
|---|---|---|---|
| `default_file_path` | string | `''` | Default `.eff.json` filename shown in right panel |
| `auto_sync` | bool | `false` | Reserved for future auto-sync on page load |

### User Preferences (Built)

Stored in user meta key `eff_theme_preference`. Per-user, not site-wide.

| Key | Values | Description |
|---|---|---|
| `eff_theme_preference` | `'light'` or `'dark'` | UI theme preference |

### Preferences Modal (Built)

The Preferences modal (opened via gear icon in top bar left) provides:
- Theme toggle: Light / Dark buttons (active theme gets a gold outline).
- Default storage file: text input for the default `.eff.json` filename.

### Asset Versioning (Built — diverges from original spec)

The original spec used `EFF_VERSION` for all asset cache-busting. The implementation uses `filemtime()` during development:

```php
private function asset_version( string $relative_path ): string {
    if ( defined( 'WP_DEBUG' ) && WP_DEBUG ) {
        $abs = EFF_PLUGIN_DIR . $relative_path;
        return file_exists( $abs ) ? (string) filemtime( $abs ) : EFF_VERSION;
    }
    return EFF_VERSION;
}
```

When `WP_DEBUG` is true: any file change automatically busts the browser cache.
In production: `EFF_VERSION` string is used for stable long-lived caching.

---

## 15. Phase 2: Colors Edit Space

This chapter specifies the complete Phase 2 Colors feature. All items in this chapter are **(Planned)** unless marked **(Built)**.

Phase 2 builds on the scaffold already in place: `eff-layout.css` contains grid and category view styles, and `eff-theme.css` includes the field shadow tokens. The PHP and AJAX layers for Phase 2 are not yet implemented.

### 15.1 Overview

Phase 2 transforms the Colors category view from a read-only display into a full editing workspace. It introduces:

- A category management system with named groups of color variables.
- An inline color editor with expand panel containing a color picker, tint/shade generator, and transparency generator.
- A two-store architecture that separates EFF's working data from Elementor's last-synced baseline.
- A "Commit to Elementor" action that pushes EFF values back to the Elementor kit.
- Undo/redo stack.

### 15.2 Category System

**Default categories for Colors:**

| Category | Notes |
|---|---|
| Branding | Core brand colors |
| Background | Background colors |
| Neutral | Grays, tones |
| Semantic | Status colors (renamed from "Status" in original spec) |
| Uncategorized | Catch-all; cannot be deleted; synced variables land here if unassigned |

Categories can be created, renamed, reordered, duplicated, and deleted (except Uncategorized). A category with variables cannot be deleted without first reassigning those variables.

### 15.3 Colors Page Layout

The Colors edit space is structured as:

```
Filter bar (search, collapse-all, expand-all)
Category block 1
  Category header (name, action buttons, collapse)
  Variable rows
  [+ Add variable button]
Category block 2
  ...
```

### 15.4 Category Header

Each category has a header row with 8 action icon buttons (right-aligned):

| Button | Icon | Action |
|---|---|---|
| Duplicate | copy | Duplicate category with all its variables |
| Move Up | chevron-up | Move category up in display order |
| Move Down | chevron-down | Move category down in display order |
| Copy | clipboard | Copy all variable values to clipboard |
| Paste | clipboard-in | Paste variable values from clipboard |
| Add | plus | Add a new blank variable to this category |
| Delete | trash | Delete category (prompts if variables exist) |
| Collapse/Expand | chevron | Toggle variable list visibility |

### 15.5 Color Variable Row

Each variable row is a CSS Grid layout:

```
[swatch] [name field — flex-fill] [value field ~180px] [format selector ~90px] [expand button]
```

**Swatch**: A colored square showing the current value. Uses pit/recess shadow (`--eff-swatch-shadow`). Opens the inline color picker when clicked.

**Name field**: Editable text input. Full flex width. Shows `--variable-name`. Supports rename with tracking (`pending_rename_from` for deferred Elementor update).

**Value field**: Shows the CSS value (hex, hsl, etc.). ~180px width. Editable.

**Format selector**: Dropdown — HEX, HEXA, RGB, RGBA, HSL, HSLA. ~90px width.

**Expand button**: Chevron. Expands the inline color editor panel below the row.

**Field shadow treatment (Variant A — approved):**
Both the value field and swatch use a pit/recess visual treatment:
- `--eff-field-shadow` applied to value field: inner shadow giving a recessed appearance.
- `--eff-swatch-shadow` applied to swatch: same recessed appearance.

### 15.6 Inline Color Editor (Expand Panel)

When the expand button is clicked, a panel appears below the variable row:

**Zone 1 — Generator Controls:**

| Control | Options |
|---|---|
| Tints | Off, 3-step, 9-step |
| Shades | Off, 3-step, 9-step |
| Transparencies | Off, steps 0–10 |

Generating tints/shades/transparencies creates child variables. The "Generate" button triggers the `eff_generate_children` AJAX action.

**Zone 2 — Preview Bars (conditional):**

Visible only when generator output exists. Shows a row of color swatches for the generated tints and shades.

**Zone 3 — Color Picker (always visible):**

A full color picker with hex input, alpha slider, and hue/saturation selector.

### 15.7 Tint/Shade Scaling Algorithm

Child variables are named as siblings, not as sub-children:

- Tints: `--name-plus-NNN` (e.g., `--primary-plus-300`)
- Shades: `--name-minus-NNN` (e.g., `--primary-minus-300`)
- Transparencies: `--name-NNN` (e.g., `--primary-050`)

**Fixed anchors:**
- +900 = L + 45%, clamped to max 95% lightness
- -900 = L - 45%, clamped to min 5% lightness

Steps between 0 and 900 are linearly interpolated.

**Step values:**
- 3-step: 300, 600, 900
- 9-step: 100, 200, 300, 400, 500, 600, 700, 800, 900

### 15.8 Extended Variable Data Model (Phase 2)

The v1.0.0 data model is extended with additional fields:

```json
{
  "id":                 "uuid-v4-style",
  "name":               "--primary-color",
  "value":              "#3d2f1f",
  "original_value":     "#3d2f1f",
  "pending_rename_from": null,
  "type":               "color",
  "format":             "HEX",
  "group":              "Variables",
  "subgroup":           "Colors",
  "category":           "Branding",
  "category_id":        "uuid-of-category",
  "order":              0,
  "source":             "elementor-parsed",
  "status":             "synced",
  "created_at":         "2026-03-07T00:00:00+00:00",
  "updated_at":         "2026-03-07T00:00:00+00:00"
}
```

The `modified: boolean` field from v1.0.0 is superseded by the `status` enum. Backward compatibility is maintained by treating `modified: true` as `status: "modified"` during file load.

**`status` enum values:**

| Value | Meaning |
|---|---|
| `synced` | EFF value matches Elementor baseline |
| `modified` | EFF value differs from Elementor baseline |
| `conflict` | Variable exists in both EFF and Elementor with different values |
| `orphaned` | Variable exists in EFF but not in Elementor (may have been deleted in Elementor) |
| `new` | Variable added in EFF, not yet committed to Elementor |
| `deleted` | Variable marked for deletion in EFF; pending Elementor commit |

### 15.9 Two-Store Architecture

Phase 2 introduces two separate data stores:

**EFF Data Store:** The user's working copy. Contains the current values as the developer intends them. Persisted to `.eff.json`.

**Elementor Baseline Store:** A snapshot of variable values as they exist in Elementor's kit CSS at the time of the last Sync. Stored separately (exact storage mechanism TBD — likely a separate key in `wp_options` or a `.elementor-baseline.json` file). Never directly edited by the user.

The two stores enable conflict detection: if a variable exists in both with different values, it receives `status: "conflict"`.

### 15.10 Save State Flags

Phase 2 uses two separate save-state flags:

**`hasEFFUnsavedChanges`**: True when the in-memory EFF data differs from the last-saved `.eff.json` file. Drives the "Save EFF File" button.

**`hasPendingElementorCommit`**: True when the `.eff.json` file contains variable values that have not yet been written to Elementor's kit. Drives the "Commit to Elementor" button.

Saving to `.eff.json` clears `hasEFFUnsavedChanges` but does NOT clear `hasPendingElementorCommit`. Committing to Elementor clears `hasPendingElementorCommit`.

### 15.11 Sync Decision Tree

When the user runs Sync from Elementor, each parsed variable is evaluated against the EFF Data Store:

1. **Variable exists in EFF, values match** → no change, status: `synced`.
2. **Variable exists in EFF, EFF value differs from parsed value** → status: `conflict`. User must resolve.
3. **Variable exists in Elementor, not in EFF** → added to EFF with status: `new` (or `synced` if it comes from the baseline).
4. **Variable exists in EFF, not in Elementor** → status: `orphaned`.
5. **Variable renamed in Elementor** → old name status: `orphaned`, new name: `new` (user must manually reconcile or use rename tracking).
6. **First sync (EFF has no baseline)** → all parsed variables imported, status: `synced`, baseline established.

### 15.12 Commit to Elementor

The "Commit to Elementor" action writes EFF variable values back to Elementor's kit.

- Reads the kit CSS file.
- For each variable in EFF with a pending commit, replaces the value in the kit CSS `:root` block.
- Triggers Elementor CSS regeneration (if the Elementor API supports this).
- Updates the Elementor Baseline Store to match the committed values.
- Clears `hasPendingElementorCommit`.

This is a destructive operation on Elementor's data and requires explicit user confirmation.

### 15.13 Error Handling

**Load-time errors:**

| Scenario | Behavior |
|---|---|
| `.eff.json` file not found | Error state, prompt to create or load different file |
| `.eff.json` malformed JSON | Parse error shown, file not loaded |
| Variable has no `name` field | Skipped during load, warning logged |
| Category referenced by variable does not exist | Variable placed in Uncategorized |
| Duplicate variable names | Second duplicate skipped, warning logged |

**Sync-time errors:**

| Scenario | Behavior |
|---|---|
| Kit CSS file not found | Error modal: "Regenerate CSS from Elementor → Tools → Regenerate Files" |
| Kit CSS has no v4 variables | Warning modal: "No Elementor v4 variables found" |
| Network error during AJAX | Error modal with retry option |

**Commit-time errors:**

| Scenario | Behavior |
|---|---|
| Kit CSS file not writable | Error modal with file path and permissions guidance |
| Elementor regeneration fails | Warning: "Values written, but Elementor CSS regeneration failed. Regenerate manually." |
| Variable name in EFF not found in kit | Warning: skipped, shown in commit report |

### 15.14 Undo/Redo

Phase 2 implements an undo/redo stack using the command pattern.

- Stack depth: 50 operations.
- Keyboard shortcuts: Ctrl+Z (undo), Ctrl+Y (redo).
- Operations covered: variable value change, variable rename, variable delete, category rename, category reorder, variable category reassignment.
- Undo/redo does NOT undo file saves or Elementor commits.

---

## 16. Version Roadmap

| Version | Feature Set |
|---|---|
| **v1.0.0** (Built) | Foundation: 4-panel layout, Elementor CSS sync, `.eff.json` save/load, usage scanner, light/dark mode |
| **v2.0** (Planned) | Colors edit space: category management, inline editor, tint/shade generator, two-store architecture, Commit to Elementor |
| **v3.0** (Planned) | Classes edit space: CSS class management, selector builder |
| **v4.0** (Planned) | Components edit space: multi-class widget template management |
| **v5.0** (Planned) | Export/Import: generate deployable CSS files, import from external sources, change history |

The Export, Import, and History buttons in the current UI open placeholder modals indicating "arrives in EFF v5".

---

## 17. Build and Development Standards

### PHP Standards

- All PHP files begin with `if ( ! defined('ABSPATH') ) { exit; }`.
- Classes use PascalCase with `EFF_` prefix.
- Methods use `snake_case`.
- WordPress coding standards followed throughout.
- No direct database queries — use WordPress API (`get_option`, `update_option`, `get_user_meta`, `update_user_meta`, `get_posts`, `get_post_meta`).
- Type declarations on all method parameters and return types.

### JavaScript Standards

- All modules use IIFE wrappers with `'use strict'`.
- No ES6+ syntax (no arrow functions, no `const`/`let`, no template literals, no destructuring). Uses ES5 throughout for maximum WordPress compatibility.
- No external dependencies. No jQuery.
- All DOM access via `document.getElementById()` or `element.querySelectorAll()`.
- HTML escaping in JS: create a `div`, set `textContent`, read `innerHTML`.
- AJAX via native `fetch()` with `URLSearchParams`.

### CSS Standards

- All custom properties use `--eff-` prefix.
- All class names use `eff-` prefix.
- No use of `!important` except for font-family on `.eff-app` to override WordPress admin styles.
- Layout uses CSS Grid and Flexbox. No floats.
- Transitions on interactive elements: `150ms ease` for hover states, `250ms ease` for panel collapse.

### Asset Versioning

- Development (`WP_DEBUG = true`): `filemtime()` for automatic cache-busting on every file change.
- Production: `EFF_VERSION` constant for stable caching.

### File Storage

- All `.eff.json` files stored in `wp-content/uploads/eff/`.
- Directory created by the activation hook if it does not exist.
- Filenames sanitized via `EFF_Data_Store::sanitize_filename()` which enforces the `.eff.json` extension and strips unsafe characters.

### No-Build Requirement

EFF has no build step. No npm, no webpack, no SASS compilation. All CSS is authored as plain CSS. All JavaScript is authored in plain ES5. Files are served directly as-is.

### Pre-Deployment Checklist

- [ ] `WP_DEBUG` is false in production
- [ ] All AJAX endpoints tested with valid and invalid nonces
- [ ] Both light and dark modes visually verified
- [ ] Left panel collapse tested
- [ ] Sync tested against a real Elementor v4 kit CSS file
- [ ] Save and load tested with a real `.eff.json` file
- [ ] Usage scanner tested with variables in use and variables not in use
- [ ] Mobile restriction overlay tested at 1023px
- [ ] `EFF_VERSION` bumped in `elementor-framework-forge.php`

---

*EFF Master Specification v2.1 — 2026-03-07*
*Covers EFF v1.0.0 (built) through Phase 2 Colors (planned)*
