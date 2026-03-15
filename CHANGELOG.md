# Changelog

All notable changes to Elementor Framework Forge are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased] — Session 4 Bug Fixes (2026-03-14)

### Fixed

- **Cross-category drag into empty categories** (`eff-colors.js`) — Drop indicator now
  appears when dragging over an expanded category with no variables. Variables are
  correctly reassigned via the `__empty-cat__` sentinel path in `_dropVariable()`.
- **Commit to Elementor V4** (`class-eff-ajax-handler.php`) — Removed the
  `do_action('elementor/css-file/clear-cache')` call that was causing Elementor to
  regenerate its CSS and overwrite EFF's committed variables. Added `find_user_root_close_pos()`
  helper to correctly target the user-defined `:root` block for variable insertion.
- **Expand modal close button** (`eff-colors.css`) — Restyled to have no background or
  border; ×  is now 22px bold with opacity-based hover effect.

### Added

- **Manage Project — Categories editor** (`eff-panel-top.js`) — The Manage Project modal
  now shows the current Colors categories as editable rows. Users can add, rename, and
  delete non-locked categories. Uncategorized is always locked and protected.
- **Tooltip system** (`eff-panel-top.js`) — Tooltip binding is now delegated from
  `document`, covering dynamically created elements. `Show tooltips` and `Extended tooltips`
  preferences are added to the Preferences modal and persisted via `eff_save_settings`.
  Extended mode shows longer `data-eff-tooltip-long` text.
- **Tooltips on all interactive elements** (`eff-colors.js`, `page-eff-main.php`) —
  `data-eff-tooltip` added to dynamic category/variable action buttons via `_catBtn()`.
  Commit button now has a tooltip. Key top-bar buttons have `data-eff-tooltip-long` text.
- **`EFF-Spec-Variables.md`** — New unified specification covering the Variables module
  data model, category management rules, UI layout, tooltip system, and data flow.

---

## [Unreleased] — Phase 2: Colors Module

### Added — Colors Edit Space (Phase 2a–2d)

- **`eff-colors.js`** — Full Colors subgroup module (`EFF.Colors`) that intercepts `EFF.EditSpace` when the Colors subgroup is selected. Renders category blocks with collapsible variable rows, filter bar, and color swatch previews.
- **Category management** — Add, rename, reorder (drag handles + move up/move down), and delete categories. Categories stored in `EFF.state.config.categories`. `Uncategorized` is a protected locked category that cannot be deleted or renamed.
- **Variable rows** — Each row shows: drag handle, color swatch, CSS variable name (editable inline), value (hex), source badge. Grid layout with expand toggle.
- **Expand panel** — Clicking any row opens an inline expand panel (below the row) showing tint/shade/transparency controls. Tints (A→Z) and shades (A→Z + darker) use a configurable step count 0–10; transparencies are an on/off toggle generating 9 fixed alpha levels (0.1–0.9). Live preview bars for each generated child variable.
- **Drag-and-drop reorder** — Rows can be dragged within and across categories. Ghost element follows the cursor; drop indicator shows insertion position. Auto-expands collapsed categories on hover.
- **Commit to Elementor** — `eff_commit_to_elementor` AJAX endpoint writes modified variable values back to the Elementor kit CSS file (in-place `preg_replace`). Commit button activates when pending changes exist.
- **`eff_save_color` AJAX** — Saves a single color variable (add or update) to the `.eff.json` file. Returns updated full variables array.
- **`eff_delete_color` AJAX** — Deletes a color variable by ID, with optional child deletion.
- **`eff_reorder_colors` AJAX** — Persists drag-and-drop order changes.
- **`eff_add_category` / `eff_rename_category` / `eff_delete_category` / `eff_reorder_categories` AJAX** — Full CRUD for color categories.
- **`eff_duplicate_category` AJAX** — Duplicates all variables in a category into a new category.
- **`eff_get_usage_counts`** — Extended to include color variables.

### Added — Data Store (Phase 2)

- `EFF_Data_Store::delete_variable(string $id, bool $delete_children = false)` — Deletes a variable by ID, with optional child cleanup.
- Category CRUD methods: `add_category()`, `rename_category()`, `delete_category()` (moves orphaned variables to Uncategorized), `reorder_categories()`.

### Added — Session 3: 9-Issue Fix (2026-03-13)

- **Issue 1 — Delete Category error handling** — `_deleteCategory` now shows an error modal when the AJAX response has `success: false` (with server message), and a "Connection error" modal on network failure. Confirm button label changed from "Delete" to "Delete Category".
- **Issue 2 — Duplicate Category race condition** — Replaced `Promise.all(savePromises)` with a sequential promise chain so each variable is saved one at a time, preventing last-write-wins overwrites.
- **Issue 3 — Auto-restore Uncategorized** — Added `_ensureUncategorized()` helper that adds the locked Uncategorized category if it is missing from config, then persists the file. Called on `loadColors()`, after `EFF.App.loadConfig()`, and after Sync from Elementor.
- **Issue 4 — Drag to category header** — Added fallback: when the cursor is over an expanded category block but not over any specific row, the drop appends to the last row of that category. `_drag._forceAfter` flag drives `insertBefore = false` for the drop indicator.
- **Issue 5 — Sort colors and categories** — Four sort buttons added to the filter bar: A↑ (colors A→Z), A↓ (colors Z→A), C↑ (categories A→Z), C↓ (categories Z→A). `_sortColors()` reassigns order values sequentially and persists via chained `eff_save_color` calls. `_sortCategories()` reorders non-locked categories and persists via `eff_reorder_categories`.
- **Issue 6 — Sticky header fix** — Removed `position: sticky` and `top: 32px` from `.eff-top-bar` (the top bar is always visible — sticky was structurally unnecessary). Changed `.eff-app` overflow from `clip` to `visible`. Brand name fade-on-scroll now listens on the edit content container scroll event, not `window`.
- **Issue 7 — Commit adds new variables** — `ajax_eff_commit_to_elementor` now inserts new CSS declarations (variables not yet present in the kit CSS) into the last `:root {}` block, rather than skipping them.
- **Issue 8 — Delete color variable** — Trash icon button added to each variable row. `_deleteVariable(varId)` opens a confirmation modal; if the variable has children, offers "Delete variable and all children" or "Delete variable only". `eff_delete_color` updated to support `delete_children` parameter and return updated variables array.
- **Issue 9 — Close button centering** — `.eff-modal-close-btn` updated to `display: flex` with `align-items: center` and `justify-content: center` for proper centering.

---

## [1.0.0] — 2026-03-01

Initial public release.

### Added — Core Framework

- **Plugin bootstrap** — `elementor-framework-forge.php` with WordPress plugin headers, constants (`EFF_VERSION`, `EFF_PLUGIN_DIR`, `EFF_PLUGIN_URL`, `EFF_SLUG`), and dependency guards for both Elementor and Elementor Pro. Admin notice displayed if either dependency is missing.
- **Activation hook** — Creates `/wp-content/uploads/eff/` storage directory on activation.
- **`EFF_Loader`** — Requires all includes and wires up the WordPress integration layer. Business logic kept separate from WordPress-specific bootstrap code.

### Added — CSS Parser

- **`EFF_CSS_Parser`** — Locates the Elementor kit CSS file (`post-{id}.css`) by reading the `elementor_active_kit` option first, falling back to scanning `uploads/elementor/css/`. Identifies the **last `:root {}` block** in the stylesheet as the Elementor v4 atomic variable block — distinguished from the legacy `--e-global-*` block by position and a 17-entry system prefix exclusion list (`--e-global-`, `--e-a-`, `--arts-`, `--container-`, etc.).
- **`lamp()` normalization** — `preg_replace('/\blamp\s*\(/', 'clamp(', $value)` corrects the known Elementor v4 editor typo on import.
- **Read-only guarantee** — Parser never writes to or modifies Elementor's CSS output files.

### Added — Data Layer

- **`EFF_Data_Store`** — Platform-portable data layer with zero WordPress dependencies in core logic. CRUD for variables, classes, and components. `load_from_file()` / `save_to_file()` handle `.eff.json` project files. `import_parsed_variables()` merges new variables from Elementor without overwriting existing ones. WordPress adapter methods (`get_wp_storage_dir()`, `sanitize_filename()`) isolated at bottom of class.
- **`EFF_Settings`** — Static class managing plugin preferences via WordPress options API. Keys: `default_file_path`, `auto_sync`.
- **`eff-defaults.json`** — Default project config with Colors subgroups (Branding, Backgrounds, Neutral, Status) and Numbers subgroups (Spacing, Gaps, Grids, Radius).

### Added — AJAX Endpoints

All endpoints require `manage_options` capability and pass `check_ajax_referer('eff_admin_nonce')`.

- `eff_save_file` — Writes project data to a `.eff.json` file in the uploads directory.
- `eff_load_file` — Reads and parses a `.eff.json` file; returns variables, classes, components, config.
- `eff_sync_from_elementor` — Calls `EFF_CSS_Parser` to locate and parse the kit CSS; returns v4 variable array with count and source filename.
- `eff_save_user_theme` — Persists `'light'` or `'dark'` preference to `eff_theme_preference` usermeta.
- `eff_get_config` / `eff_save_config` — Read and write project subgroup configuration to WordPress options.
- `eff_get_settings` / `eff_save_settings` — Read and write plugin preferences.

### Added — Admin Interface

- **`EFF_Admin`** — Registers top-level admin menu page (capability: `manage_options`, position: 30). Enqueues `eff-theme.css`, `eff-layout.css`, and seven JS modules in dependency order. Passes `EFFData` object to JS via `wp_localize_script` (ajaxUrl, nonce, theme, version, uploadUrl, pluginUrl).
- **Four-panel layout** (`page-eff-main.php`) — Full-height admin panel with:
  - **Top menu bar** — Preferences, Manage Project (left); Export, Import, Sync, History, Search, Help (right). All icon-only buttons with 300ms CSS tooltip system.
  - **Left navigation panel** — Collapsible to 48px. Accordion nav tree: Variables (Colors / Fonts / Numbers subgroups) → Classes → Components. Dynamically populated subgroup items from project config.
  - **Center edit space** — Banner placeholder on initial load; category view with variable list when a category is selected.
  - **Right status panel** — Storage file input, Load / Save / Save Changes buttons; asset count display (Variables / Classes / Components).
- **Mobile restriction overlay** — `.eff-mobile-block` hidden on desktop; shown full-screen at `max-width: 1023px` with `.eff-app { display: none }`.

### Added — JavaScript Modules

- **`eff-app.js`** — Global `EFF.state` object (variables, classes, components, config, usageCounts, theme, hasUnsavedChanges, currentSelection, currentFile). `EFF.App.ajax()` fetch wrapper with nonce. `EFF.App.refreshCounts()`. `EFF.App.loadConfig()`. `EFF.App.fetchUsageCounts()` — scans widget data and re-renders current category view with results. Init sequence on `DOMContentLoaded`. `beforeunload` guard for unsaved changes.
- **`eff-theme.js`** — `EFF.Theme.init()`, `set(theme)`, `toggle()`. Persists preference via `eff_save_user_theme` AJAX.
- **`eff-modal.js`** — Single-instance modal system. Focus trap (Tab/Shift+Tab cycles within modal). ESC and overlay-click close. `EFF.Modal.open({ title, body, footer, onClose })`, `EFF.Modal.close()`.
- **`eff-panel-left.js`** — Accordion group expand/collapse. Subgroup toggle. Panel collapse toggle (persisted to `localStorage`). `_loadNavItems()` populates leaf items from project config. `selectItem()` updates state and loads category in edit space.
- **`eff-panel-right.js`** — File load / save / save-changes button handlers. `updateCounts()`. `updateSaveChangesBtn()`. Triggers `EFF.App.fetchUsageCounts()` after successful file load.
- **`eff-panel-top.js`** — Tooltip system (300ms delay, CSS-positioned). All modal launchers: Preferences (theme toggle, default file path), Manage Project (subgroup editor), Search (live filter across variables), Sync (calls `eff_sync_from_elementor`, merges results, triggers usage scan), Export/Import/History/Help placeholders.
- **`eff-edit-space.js`** — `loadCategory(selection)` renders category header, column headings, and variable rows. Each row: `Variable | Value | Source | Usage`. Usage column and badge suppressed until first scan completes.

### Added — Design System

- **`eff-theme.css`** — `@font-face` for Inter 400/500/600/700. `:root` globals: type scale (`--fs-xxs` through `--fs-xxxl`), weights, line heights (`--fl-md: 1.4`, `--fl-lg: 1.2`), spacing scale (`--sp-1` through `--sp-18`), panel dimensions. Full light and dark palettes on `[data-eff-theme]` attribute. Button, input, tooltip, and modal styles.
- **`eff-layout.css`** — Four-panel flex structure. Left panel collapse transition. Variable row grid layout (`2fr 2fr 1fr auto`). Usage badge styles (`.eff-usage-badge--active` gold pill, `.eff-usage-badge--unused` muted outline). Mobile restriction block. Scrollbar styling.
- **Inter font** — Four WOFF2 files (Latin subset) loaded locally from `assets/fonts/`. No external CDN.
- **SVG icon set** — 20 icons in `assets/icons/`: gear, grid, search, export, import, sync, history, help, variables, classes, components, colors, fonts, numbers, chevron-left, chevron-right, folder-open, save, checkmark, close.

### Added — Usage Count Feature

- **`EFF_Usage_Scanner`** — `scan(array $variable_names): array`. Queries all posts with `_elementor_data` meta (capped at 500; `no_found_rows => true` for performance). For each post, runs `substr_count($data, 'var(--varname')` on the raw JSON string — no JSON decode required. Returns `['--varname' => count]`.
- **`eff_get_usage_counts` AJAX endpoint** — Accepts JSON array of variable names. Validates each against `/^--[\w-]+$/`. Returns per-variable counts and scan count.
- **Edit space integration** — Variable rows show usage badges after scan. Column header row added when variables exist. Usage column hidden until `EFF.state.usageCounts` is populated.
- **Auto-trigger** — `fetchUsageCounts()` called automatically after file load and after Sync from Elementor.

### Added — Repository

- Git repository initialized. Remote: `https://github.com/Mij-Strebor/elementor-framework-forge`
- `readme.txt` — WordPress.org plugin readme format.
- `README.md` — GitHub repository readme with banner, feature overview, architecture, installation, roadmap.
- `CHANGELOG.md` — This file.

---

## Roadmap

| Version | Planned Scope |
|---------|---------------|
| **v2** | Inline variable editing in edit space, value type pickers (color swatch, number input, font selector), drag-to-reorder within subgroups, `wp_head` variable override output |
| **v3** | Classes support; Elementor Kit Manager API integration (read/write native global colors and typography) |
| **v4** | Components registry |
| **v5** | Write-back to Elementor widget data (bulk variable rename), change history with undo, export/import |
| **Future** | Standalone Windows application · Mac application |

---

*© Jim Roberts / [Jim R Forge](https://jimrforge.com)*
