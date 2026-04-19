# Changelog

All notable changes to Atomic Framework Forge for Elementor are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.4.2-beta] — 2026-04-18

### Added

- **Elementor Write via Post Meta** — Committing to Elementor now writes variable values directly to the `_elementor_global_variables` post meta (Elementor's authoritative data store). A CSS file patch is applied as a secondary step for immediate visual preview without a page reload.

### Fixed

- **CSS Variable Names on Commit** — Variable names are now normalized to the `--` prefix when committing to Elementor. Bare identifiers stored in AFF (e.g. `sp-s`) are written as valid CSS custom properties (`--sp-s`).
- **CSS Variable Storage** — AFF now stores bare identifiers internally without the `--` prefix, preventing a double-prefix (`----sp-s`) on round-trip commit and re-import.
- **Elementor V4 Import** — EV4 variable labels are preserved unchanged on import; only a single `--` prefix is stripped per name to avoid mangling variable names that contain double hyphens.
- **Category Rename Hides Variables** — Renaming a category no longer causes its variables to disappear from the edit view. The per-variable `category` field is now synced whenever a category is renamed.
- **Add Category — Fonts/Numbers** — Add Category now works correctly in Fonts and Numbers panels; the modal click handler was not removed on close, causing duplicate fires on subsequent attempts.
- **Delete Project** — Deleting a project now correctly clears the active display. Native browser `confirm()` replaced with the AFF modal dialog for consistency.
- **Auto-save After Clear/Replace Sync** — Project file is saved to disk automatically after Clear and Replace sync operations, preventing unsaved state from being silently discarded.
- **Left Panel Count Badges** — Category count badges in the left panel now match variables by `category_id` in addition to `category` name, fixing blank counts for Numbers and Fonts categories whose variables were saved with an ID reference.
- **Placeholder Sign Image** — Take-a-look sign converted to a true PNG; the previous file had an opaque white background that blocked the page theme colour.

### Changed

- **Shared Utilities — Phase 1** — Duplicate utility methods across Colors and Variables extracted into shared `AFF.Utils` and `AFF.Icons` objects, removing ~520 lines of duplication.
- **Shared Category Mixin — Phase 2** — Six category-management methods (`_addCategory`, `_saveCategoryName`, `_deleteCategory`, `_duplicateCategory`, `_ajaxReorderCategories`, `_jumpToCategory`) consolidated into `AFF.CatMixin` and applied to both Colors and Variables via `Object.assign`, removing a further ~290 lines of duplication.
- **Version** — Bumped to 0.4.2-beta.

---

## [0.4.1-beta] — 2026-04-14

### Fixed

- **Placeholder sign background** — The "Take a look" sign PNG now renders with a transparent background; transparent areas show the page theme colour instead of a checkerboard pattern (`mix-blend-mode: multiply` applied; edit-space background set to page theme colour).

### Changed

- **Version** — Bumped to 0.4.1-beta.

---

## [0.4.0-beta] — 2026-04-14

### Added

- **Numbers autofill suffix entry** — Type `33px`, `1.5rem`, `100%`, `33x`, `50vw` etc; unit suffix sets the format automatically on blur/Enter. Parentheses trigger FX function mode with auto-closing `)`. Unknown suffixes show an inline "invalid type" error.
- **`x` shorthand for PX** — Entering `33x` sets value `33`, format `PX`.
- **Numbers unitless type** — New blank `—` format option for pure unitless CSS values (e.g. `z-index`, `opacity`, `line-height`). Committed to Elementor as a bare number with no unit.
- **Variable counts in left navigation** — Each category item shows how many variables it contains. Colors / Fonts / Numbers subgroup headers show total counts, right-aligned to match category item badges.
- **Quick-start arch banner** — Forge-themed amber gradient arch at the bottom of the placeholder panel prompts new users to read QUICK-START.md on first open.

### Fixed

- **Drag/drop broken on Numbers and Fonts** — `setLower` was referenced but never declared in `_initDrag` and `_initCatDrag` prototype methods, causing a silent `ReferenceError` in strict mode that killed all mousedown drag handlers. Each method now declares `setLower` locally from `self._cfg.setName`.
- **Scroll-to-top on Add Variable** — `_rerenderView` was saving/restoring `aff-edit-content.scrollTop` (always 0); the real scroll container is `aff-edit-space` (`overflow-y: auto`). Now saves/restores both `aff-edit-space.scrollTop` and `window.pageYOffset`. Also changed `nameInp.focus()` to `focus({ preventScroll: true })` to prevent a second scroll jump after the new row is focused.
- **Numbers sort header misalignment** — `.aff-color-list-header` inside `.aff-numbers-view` was inheriting the 7-column Colors grid. Added explicit 6-column grid override to match `.aff-color-row`.

### Changed

- **fₓ display for FX format** — FX format now displays as `fₓ` (f + U+2093 LATIN SUBSCRIPT SMALL LETTER X) in all UI dropdowns, matching the Functions icon in the top bar. Stored JSON value remains `'FX'` for backward compatibility.
- **Numbers pure number storage** — Values stored without unit suffix (e.g. `16` not `16px`). CSS unit reconstructed from `format` field when committing to Elementor. Units stripped from synced variables on import.
- **Collapse/expand all buttons** — All three sets (Colors, Fonts, Numbers) now use double-chevron SVG icons. Tooltip text and `aria-label` update dynamically on toggle to reflect the actual current state.
- **Placeholder panel image** — Changed CSS `background-size` from `cover` to `contain` so the full blacksmith image is visible within the panel height without cropping.
- **QUICK-START.md** — Corrected button names throughout (Fetch Elementor, Write to Elementor). Fixed duplicate Step 5 / 5a numbering (now sequential 5–11). Updated right-panel section table to match actual UI. Removed stale "(Not yet active)" note on Write to Elementor. Renamed "What's Not in Beta Yet" section to "Beta Status".
- **Version** — Bumped to 0.4.0-beta.

---

## [0.3.5-beta] — 2026-04-13

### Added

- **Load Project modal — project management** — Level 1 now shows each project's save count and last-saved date. Projects can be renamed inline (click name field, type, blur or Enter to save). Copy project button duplicates all backups under a new name. Delete project button removes the entire project folder after confirmation.
- **Variable count in backup picker** — Level 2 backup rows now show the number of variables stored in each snapshot.

### Fixed

- **Cross-module event contamination** — Colors, Variables, and Numbers all share `#aff-edit-content` as their delegated event container. Click, focusout, and mousedown drag handlers now guard against firing when their own view is not present, preventing Colors events from triggering in Numbers and vice versa.
- **Drag snap-back in Numbers** — Variables dragged in Numbers snapped back to their original position because Colors' drag `mouseup` handler was firing on the same gesture. The view-presence guard on mousedown prevents Colors' drag state from activating when Numbers is shown.
- **Drag cross-module switch** — Dragging in Numbers no longer unexpectedly activates a Colors drag. Root cause was the same shared container; resolved by the view-presence guard on both modules' mousedown handlers.
- **Write to Elementor — kit CSS file not found** — `ajax_aff_commit_to_elementor` now calls `try_regenerate_elementor_kit_css()` when `find_kit_css_file()` returns null, instead of immediately returning an error. Prevents failures on fresh installs or after Elementor clears its CSS cache.
- **Duplicate variable names** — Renaming a variable to an existing name is now blocked in JS (client-side field error, value reverted) and PHP (`variable_name_exists()` check in `ajax_aff_save_color()`).
- **Forced `--` prefix while typing** — Three live `input` event handlers in `aff-colors.js` and `aff-variables.js` were re-inserting `--` as the user typed a variable name. All three removed; the prefix is added only when the name is saved.
- **Missing nonce verification** — `ajax_aff_save_category()` and `ajax_aff_delete_color()` were missing `$this->verify_request()` calls added.
- **category_id validation** — New variables with a `category_id` are now validated against the existing categories for their subgroup before being saved.

### Changed

- **Dead code removed** — `_moveCategoryUp`, `_moveCategoryDown`, `_sortCategories`, and the `move-up` / `move-down` switch cases in `aff-colors.js` were unreachable and removed (~100 lines).
- **Version** — Bumped to 0.3.5-beta.

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
| **0.3.5-beta** | Load Project modal improvements; cross-module event fix; drag fixes; Write to Elementor kit CSS auto-regeneration; duplicate variable name prevention; removed forced `--` prefix |
| **0.4.0-beta** | Numbers editing overhaul (pure storage, autofill suffix, unitless type, fₓ display). Nav variable counts. Double-chevron collapse buttons. Drag/drop and scroll bug fixes. QUICK-START.md corrections. |
| **0.4.1-beta** | Placeholder sign background transparency fix. |
| **0.4.2-beta** | Elementor post-meta commit; CSS var prefix fixes on commit/import/storage; category rename/add/count fixes; shared utilities refactor (Phase 1 & 2). |
| **0.5.x-beta** | Super Categories — two-level category nesting within each variable set (Colors, Fonts, Numbers). Top-level category holds sub-categories only; sub-categories hold variables only. Flat Elementor commit unchanged. Motivated by large Number sets (382-variable website design systems). |
| **1.0.0** | Classes management; Components registry |
| **2.0.0** | Components registry; Elementor Kit Manager API write-back; Bulk variable rename |
| **Future** | Standalone Windows / Mac desktop application |

---

*© Jim Roberts / [JimRForge](https://jimrforge.com)*
