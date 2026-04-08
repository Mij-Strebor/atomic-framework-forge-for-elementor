# Changelog

All notable changes to Atomic Framework Forge for Elementor are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.3.4-beta] — 2026-04-08

### Changed

- **Plugin renamed EFF → AFF** — Renamed from *Elementor Framework Forge* to *Atomic Framework Forge for Elementor* for WordPress.org compatibility (WordPress.org prohibits plugin names starting with "Elementor"). Main plugin file renamed to `atomic-framework-forge-for-elementor.php`; all internal prefixes updated: `eff_` → `aff_`, `EFF_` → `AFF_`, `eff-` → `aff-`, `EFF.` → `AFF.`.
- **Sync reads Elementor kit meta directly** — `AFF_CSS_Parser::read_from_kit_meta()` now reads `_elementor_global_variables` post meta directly instead of requiring a parsed CSS file. `ajax_aff_sync_from_elementor()` uses this as the primary sync path; CSS file parsing is retained as a fallback.
- **Version** — Bumped to 0.3.4-beta.

### Fixed

- **Font and Number category defaults on first load** — `loadConfig()` now normalises `groups.Variables.*` string arrays from the defaults file into the `fontCategories` / `numberCategories` object arrays expected by the edit space, preventing empty category panels on fresh installs.
- **AJAX action names after rename** — Two call sites in `aff-panel-top.js` were still sending `eff_sync_from_elementor`; corrected to `aff_sync_from_elementor`.

---

## [0.3.3-beta] — 2026-04-03

### Added

- **Elementor kit CSS auto-regeneration** — When `aff_sync_from_elementor` is called and the kit CSS file does not exist on disk, AFF now attempts to regenerate it via Elementor's `CSS\Post` API before returning an error. This prevents the 0-variable result that occurred on fresh installs or after Elementor clears its CSS cache, eliminating the need to load a page in the browser first.

### Changed

- **Version** — Bumped to 0.3.3-beta.

---

## [0.3.2-beta] — 2026-03-19

### Fixed

- **Drag-and-drop color reorder** — `aff_save_file` calls in `aff-colors.js` used the old `filename` parameter after the versioned backup refactor changed the PHP handler to require `project_name`. All four call-sites updated; fallback paths now correctly create an `aff-temp` project and set `AFF.state.currentFile` from the server response.
- **Column sort lost on tab switch** — Switching from Colors to Numbers and back rebuilt the DOM from state (sorted by `order` field), discarding the display-only `_catSortState`. The sort is now reapplied at the end of every `_renderAll` call.
- **`resolve_file()` rejecting non-existent directories** — When a versioned path was stored in `last_file` but the project directory had been deleted, `realpath()` returned `false` causing a hard JSON error instead of falling through to the create-on-load path. The helper now only uses `realpath` for the traversal check when the directory actually exists; a `..` component check guards against traversal regardless.

### Changed

- **Version** — Bumped to 0.3.2-beta.

---

## [0.3.1-beta] — 2026-03-19

### Fixed

- **Drag-and-drop color reorder** — `aff_save_file` calls in `aff-colors.js` used the old `filename` parameter after the versioned backup refactor changed the PHP handler to require `project_name`. All four call-sites updated; fallback paths now correctly create an `aff-temp` project and set `AFF.state.currentFile` from the server response.
- **Column sort lost on tab switch** — Switching from Colors to Numbers and back rebuilt the DOM from state (sorted by `order` field), discarding the display-only `_catSortState`. The sort is now reapplied at the end of every `_renderAll` call.
- **`resolve_file()` rejecting non-existent directories** — When a versioned path was stored in `last_file` but the project directory had been deleted, `realpath()` returned `false` causing a hard JSON error instead of falling through to the create-on-load path. The helper now only uses `realpath` for the traversal check when the directory actually exists; a `..` component check guards against traversal regardless.

### Changed

- **Version** — Bumped to 0.3.1-beta.

---

## [0.3.0-beta] — 2026-03-19

### Added

- **Versioned backup system** — Every "Save Project" creates a timestamped snapshot file instead of overwriting a single file. Storage layout: `uploads/aff/{slug}/{slug}_YYYY-MM-DD_HH-II-SS.aff.json`.
- **Two-level project / backup picker** — "Open / Switch Project" modal shows Level 1 (all projects: name · backup count · latest date) and Level 2 (all backups for a project: timestamp · Load · Delete). Back arrow returns to Level 1.
- **Auto-prune** — Oldest backups are silently removed when the per-project count exceeds the limit.
- **Max backups setting** — Configurable per project in the Manage Project modal (default 10, max 50).
- **Multi-project support** — Multiple independent named projects per WordPress site.
- **Create = blank project** — The "Create" button in the picker now clears all state before saving, producing a genuinely empty project.
- **Right panel reorganized** — Five named sections replace the old flat layout: Active Project · Save & Backups · Elementor Sync · Elementor V3 Import · Export / Import.
- **Sync moved to right panel** — The **↓ Variables** button (Elementor Sync section) replaces the top-bar Sync icon. Before syncing, a **Sync Options dialog** prompts: "Sync by name" (add new variables, preserve existing AFF edits) or "Clear and replace" (wipe all variables and reimport fresh from Elementor).
- **Commit moved to right panel** — The **↑ Variables** button (Elementor Sync section) replaces the old unsynced-indicator Commit button. Before writing to Elementor, a **commit summary dialog** shows counts of modified / new / deleted variables; shows "nothing to commit" when zero changes are pending. Highlights with accent color when uncommitted changes exist.
- **Export / Import moved to right panel** — Buttons relocated from top bar to the Export / Import section. Behavior unchanged.
- **Elementor V3 Global Colors import** — New **↓ V3 Colors** button (Elementor V3 Import section) reads `system_colors` and `custom_colors` from the active Elementor kit post meta (`_elementor_page_settings`) and imports them as AFF color variables (skipping names that already exist).
- **`aff_sync_v3_global_colors` AJAX endpoint** — Server-side handler returns `{ name, value, title }` for each V3 Global Color found in the kit.
- **Data management specification** — `docs/specification/AFF-Spec-Data-Management.md` documents all four data channels (Elementor V4 Sync, Elementor V3 Import, Backup/Restore, Export/Import).

### Changed

- **README.md** — Updated to Beta 0.3.0; data management model section; updated feature table and roadmap.
- **QUICK-START.md** — Rewritten to reflect the versioned backup workflow, right-panel-centric data management, and Beta status. Removed stale Alpha limitations.
- **USER-MANUAL.md** — Revised to Beta 0.3.0; right panel section rewritten; new Elementor V3 Import section; sync and commit sections updated; known limitations updated.
- **Version** — Bumped to 0.3.0-beta across plugin header and `AFF_VERSION` constant.

---

## [0.2.3] — 2026-03-18

### Added

- **Auto-select project name** — Manage Project modal focuses and selects the project name field on open so the user can immediately type a new name.

### Fixed

- **Elementor sync — lowercase variable names** — Variables imported via Sync from Elementor now have their names lowercased (`--PrimaryColor` → `--primarycolor`) for consistent naming.
- **Stacked `.aff` suffix in filenames** — Projects with legacy `.aff` or `.aff.json` in their stored name no longer produce filenames like `demo-aff-aff.aff.json`. All paths that store or display the project name now strip stacked `.aff[.json]` suffixes before use.

---

## [0.2.2] — 2026-03-17

### Added

- **Export project** — Export button downloads the current project as a portable `.aff.json` file
  (name derived from project name). Works client-side with no server involvement.
- **Import project** — Import button opens a modal with a file picker; reads a `.aff.json` file,
  populates all state (variables, classes, components, config, project name), refreshes all panels,
  and marks the project dirty so the user can save it under a local name.
- **Storage path in project picker** — Project picker modal footer now shows the server path
  where `.aff.json` files are stored (relative URL to `wp-content/uploads/aff/`).

### Fixed

- **Save Changes button contrast** — Glowing Save Changes button now uses dark text
  (`#2a1a0e !important`) so it is readable against the gold accent background.
- **FONTS categories lost on file load** — When loading a `.aff.json` that predates Phase 2
  category arrays, `fontCategories` and `numberCategories` are now copied from `globalConfig`
  so nav items are preserved.
- **`-aff` suffix on project name** — `_getFilename()` now strips `.aff` / `.aff.json` before
  slugifying, preventing double-extension saves.
- **Category CRUD wipes globalConfig categories** — Add, rename, delete, duplicate, and reorder
  operations on font/number categories now merge into local state instead of replacing it with
  the server response (which only contains categories stored in the file). This prevents
  globalConfig-sourced categories (e.g. Titles, Body) from disappearing after any CRUD operation.

---

## [0.2.0] — 2026-03-17

### Added — Color Picker

- **Pickr integration** — Visual color picker (Simonwep/Pickr v1.9.0, classic theme) on every
  color variable swatch. Click the swatch in any color row or inside the expand panel header to
  open the picker.
- **HEX / RGB / HSL picker** — Picker format tracks the variable's format selector. Alpha slider
  always visible; opaque colors output without alpha suffix, semi-transparent colors auto-add
  `rgba()` / `hsla()` / 8-digit HEX.
- **4-digit HEX shorthand** — Typing `f00a` in the value field expands to `#FF0000AA` (each
  digit doubled, same as 3→6 shorthand).
- **Live palette refresh** — Tints, shades, and transparency strips inside the expand panel
  refresh immediately when a color is changed via the picker or the value input.
- **Pickr ↔ value input sync** — Editing the value input updates the Pickr state silently;
  saving from the Pickr updates the value input and all palette strips.

### Added — Documentation

- **USER-MANUAL.md** — Complete feature reference covering all panels, workflows, and the
  color picker.
- Updated **README.md** — Prominent Quick Start and User Manual links; feature table reflects
  0.2.0 status.
- Updated **QUICK-START.md** — Color picker step; expand panel details; updated limitations.

---

## [0.1.0] — 2026-03-16

### Added

- Default categories per variable set (Colors, Fonts, Numbers) configurable in Preferences.
- Default type per variable set configurable in Preferences.
- Auto-load last used project file on startup.
- Functions dropdown button (top bar) with Convert V3 / Change Types placeholders.
- Sync manual CSS path fallback for sites where auto-detect fails.
- Right panel: project name field shows stored name, not raw filename.

### Fixed

- PHP 7.4 compatibility: replaced `str_starts_with()` with `strpos()` in AJAX handler.
- Missing closing brace in sync error handler (caused JS parse error).
- Fonts / Numbers category reassignment after sync.

---

## [0.0.1-alpha] — 2026-03-15

Initial Alpha release.

### Added — Variables Module

- **AFF.Variables factory** (`aff-variables.js`) — Generic prototype-based factory
  instantiated three times (Colors, Fonts, Numbers). Replaces would-be duplicated code
  with a single shared module driven by per-set configuration objects.
- **Colors variable set** (`aff-colors.js`) — Full edit space: filter bar, category blocks,
  color swatch preview, inline value editing, drag-and-drop reorder, collapse/expand.
- **Fonts variable set** — Font family values with preview; same category management as Colors.
- **Numbers variable set** — Numeric/unit values (px, rem, clamp, calc, etc.); same workflow.
- **Per-set category arrays** — `colorCategories`, `fontCategories`, `numberCategories` in
  `AFF.state.config`. Each set manages its own independent category list.
- **Revision 4 UI** — Set name header aligned with category labels; drag handles on category
  headers; column sort buttons (Name ↑↓, Value ↑↓) per category block; collapse/expand fixed.
- **Add Variable button always visible** — Remains visible even when a category is collapsed.

### Added — Elementor Sync

- **Auto-classification** — `_syncFromElementor` classifies variables into Colors (hex/rgb/hsl),
  Fonts (font family keywords), and Numbers (px/rem/clamp/calc/units).
- **lamp() normalization** — Elementor v4 editor typo `lamp()` → `clamp()` corrected on import.
- **_ensureUncategorized** — Called after sync for all three sets; guarantees the locked
  Uncategorized category exists before any rendering.

### Added — Category Management

- Add, rename, delete, duplicate categories per variable set.
- Drag-and-drop reorder of categories.
- `aff_add_category`, `aff_rename_category`, `aff_delete_category`,
  `aff_reorder_categories`, `aff_duplicate_category` AJAX endpoints (all accept `subgroup` param).

### Added — File Management

- Save and load `.aff.json` project files (`/wp-content/uploads/aff/`).
- Portable JSON format; designed for future desktop application compatibility.

### Added — Colors Expand Panel

- Tint / shade generator (0–10 configurable steps, A→Z naming).
- Transparency generator (9 fixed alpha levels, on/off toggle).
- Live preview bars for each generated child variable.
- Commit to Elementor — writes modified variable values back to kit CSS.

### Added — Usage Count

- `AFF_Usage_Scanner` scans `_elementor_data` post meta (up to 500 posts) for `var()` references.
- Usage badges on each variable row (gold pill = used, gray = unused).
- Auto-triggered after file load and after Sync.

### Added — Dark Mode

- Full dark palette on `[data-aff-theme="dark"]` attribute.
- Dark mode component overrides: tooltip contrast, category panel border/shadow,
  lighter category background, drag handle opacity, input field backgrounds,
  button text contrast, color swatch shadow.

### Added — Interface

- Four-panel layout: Top bar · Left nav · Center edit space · Right file panel.
- Preferences modal: Interface theme, default file path, tooltip settings.
- Tooltip system (300ms delay, delegated binding, extended mode).
- Mobile restriction overlay (below 1024px).
- Light / Dark theme toggle persisted to WordPress usermeta.

### Added — Repository

- `README.md` — Banner, feature status table, interface overview, architecture, roadmap.
- `QUICK-START.md` — Step-by-step testing guide.
- `CHANGELOG.md` — This file.
- `LICENSE` — GPL-2.0-or-later.

---

## Roadmap

| Version | Planned Scope |
|---------|---------------|
| **0.1.0** | Preferences: default categories per set; auto-load last project on startup |
| **0.2.0** | Pickr color picker; value format conversion (HEX ↔ RGB ↔ HSL) |
| **0.2.2** | Export/Import; Save Changes contrast fix; category CRUD merge fix |
| **0.2.3** | Elementor sync lowercase names; Manage Project select-all; stacked `.aff` suffix fix |
| **0.3.0-beta** | Versioned backup system; multi-project; two-level picker; right panel reorganization; sync options dialog; commit summary dialog; V3 Global Colors import |
| **1.0.0** | Classes management; Components registry |
| **2.0.0** | Components registry; Elementor Kit Manager API write-back; Bulk variable rename |
| **Future** | Standalone Windows / Mac desktop application |

---

*© Jim Roberts / [JimRForge](https://jimrforge.com)*
