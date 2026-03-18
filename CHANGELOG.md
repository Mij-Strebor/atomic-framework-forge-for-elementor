# Changelog

All notable changes to Elementor Framework Forge are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.2.3] — 2026-03-18

### Added

- **Auto-select project name** — Manage Project modal focuses and selects the project name field on open so the user can immediately type a new name.

### Fixed

- **Elementor sync — lowercase variable names** — Variables imported via Sync from Elementor now have their names lowercased (`--PrimaryColor` → `--primarycolor`) for consistent naming.
- **Stacked `.eff` suffix in filenames** — Projects with legacy `.eff` or `.eff.json` in their stored name no longer produce filenames like `demo-eff-eff.eff.json`. All paths that store or display the project name now strip stacked `.eff[.json]` suffixes before use.

---

## [0.2.2] — 2026-03-17

### Added

- **Export project** — Export button downloads the current project as a portable `.eff.json` file
  (name derived from project name). Works client-side with no server involvement.
- **Import project** — Import button opens a modal with a file picker; reads a `.eff.json` file,
  populates all state (variables, classes, components, config, project name), refreshes all panels,
  and marks the project dirty so the user can save it under a local name.
- **Storage path in project picker** — Project picker modal footer now shows the server path
  where `.eff.json` files are stored (relative URL to `wp-content/uploads/eff/`).

### Fixed

- **Save Changes button contrast** — Glowing Save Changes button now uses dark text
  (`#2a1a0e !important`) so it is readable against the gold accent background.
- **FONTS categories lost on file load** — When loading a `.eff.json` that predates Phase 2
  category arrays, `fontCategories` and `numberCategories` are now copied from `globalConfig`
  so nav items are preserved.
- **`-eff` suffix on project name** — `_getFilename()` now strips `.eff` / `.eff.json` before
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

Initial Alpha release — distributed to LytBox Academy testers.

### Added — Variables Module

- **EFF.Variables factory** (`eff-variables.js`) — Generic prototype-based factory
  instantiated three times (Colors, Fonts, Numbers). Replaces would-be duplicated code
  with a single shared module driven by per-set configuration objects.
- **Colors variable set** (`eff-colors.js`) — Full edit space: filter bar, category blocks,
  color swatch preview, inline value editing, drag-and-drop reorder, collapse/expand.
- **Fonts variable set** — Font family values with preview; same category management as Colors.
- **Numbers variable set** — Numeric/unit values (px, rem, clamp, calc, etc.); same workflow.
- **Per-set category arrays** — `colorCategories`, `fontCategories`, `numberCategories` in
  `EFF.state.config`. Each set manages its own independent category list.
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
- `eff_add_category`, `eff_rename_category`, `eff_delete_category`,
  `eff_reorder_categories`, `eff_duplicate_category` AJAX endpoints (all accept `subgroup` param).

### Added — File Management

- Save and load `.eff.json` project files (`/wp-content/uploads/eff/`).
- Portable JSON format; designed for future desktop application compatibility.

### Added — Colors Expand Panel

- Tint / shade generator (0–10 configurable steps, A→Z naming).
- Transparency generator (9 fixed alpha levels, on/off toggle).
- Live preview bars for each generated child variable.
- Commit to Elementor — writes modified variable values back to kit CSS.

### Added — Usage Count

- `EFF_Usage_Scanner` scans `_elementor_data` post meta (up to 500 posts) for `var()` references.
- Usage badges on each variable row (gold pill = used, gray = unused).
- Auto-triggered after file load and after Sync.

### Added — Dark Mode

- Full dark palette on `[data-eff-theme="dark"]` attribute.
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
- `QUICK-START.md` — Step-by-step testing guide for LytBox Academy members.
- `CHANGELOG.md` — This file.
- `LICENSE` — Proprietary source-available license for LytBox Academy testing.

---

## Roadmap

| Version | Planned Scope |
|---------|---------------|
| **0.1.0** | Preferences: default categories per set; auto-load last project on startup |
| **0.2.0** | Pickr color picker; value format conversion (HEX ↔ RGB ↔ HSL) |
| **0.2.2** | Export/Import; Save Changes contrast fix; category CRUD merge fix |
| **0.2.3** | Elementor sync lowercase names; Manage Project select-all; stacked `.eff` suffix fix |
| **1.0.0** | Full variable workflow stable; Classes management; Change history |
| **2.0.0** | Components registry; Elementor Kit Manager API write-back; Bulk variable rename |
| **Future** | Standalone Windows / Mac desktop application |

---

*© Jim Roberts / [JimRForge](https://jimrforge.com) — Distributed through [LytBox Academy](https://lytbox.com)*
