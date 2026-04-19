=== Atomic Framework Forge for Elementor ===
Contributors:      jimrforge
Tags:              elementor, css variables, design system, developer tools, atomic widgets
Requires at least: 5.8
Tested up to:      6.9
Requires PHP:      8.2
Stable tag:        0.4.2-beta
License:           GPL-2.0-or-later
License URI:       https://www.gnu.org/licenses/gpl-2.0.html

Professional management interface for Elementor Version 4 (atomic widget architecture) assets — Variables, Classes, and Components.

== Description ==

Atomic Framework Forge for Elementor (AFF) is a WordPress plugin that provides a professional management interface for Elementor Version 4 (atomic widget architecture) assets.

AFF allows developers to organize, edit, and persist the three core asset types introduced by Elementor v4:

* **Variables** — CSS custom properties used by atomic widgets
* **Classes** — Developer-defined class names applied to atomic widget controls (AFF v3)
* **Components** — User-assembled widgets built within Elementor v4 (AFF v4)

**Requires Elementor and Elementor Pro.**

= How AFF Interacts with Elementor =

**Read:** AFF reads global variables directly from the active Elementor kit's _elementor_global_variables post meta -- the same authoritative data store Elementor itself uses. This happens only when you click "Fetch Elementor Data". It is purely read-only; nothing in Elementor is touched.

**Write:** When you click "Write to Elementor", AFF writes the current variable values back to _elementor_global_variables on the kit post. Elementor rebuilds its CSS from this meta on the next page load. This is the only write operation AFF performs on Elementor data.

Every write is user-triggered (no background or automatic writes, ever), preceded by a confirmation dialog showing exactly what will change, and limited to variables you have managed in AFF. AFF does not touch anything else in your Elementor configuration.

**Use on staging or a local development environment only.** A corrupted write could damage your Elementor kit's variable data. Always export a project backup before writing to Elementor.

=== Key Features (Beta 0.4.1) ===

* **Sync from Elementor** — Reads the Elementor V4 kit CSS file and imports CSS variables automatically. Sync options dialog: "Sync by name" or "Clear and replace".
* **Versioned backup system** — Every Save Project creates a timestamped snapshot; restore any backup from the two-level project/backup picker. Up to 50 backups per project (configurable).
* **Multi-project support** — Multiple independent named projects per WordPress site.
* **Commit to Elementor** — Write modified variable values back to the active kit CSS. Commit summary shows modified / new / deleted counts before writing.
* **Elementor V3 Global Colors import** — Import V3 system and custom colors into AFF as color variables.
* **Export / Import** — Download the current project as a portable `.aff.json` file; import on any WordPress site running AFF.
* **Four-panel interface** — Top menu bar, collapsible left navigation tree, center edit space, right data management panel.
* **Project organization** — Variables organized into Colors / Fonts / Numbers. Categories are user-configurable per set.
* **Color picker** — Visual Pickr color picker (HEX / RGB / HSL + alpha) with live palette refresh.
* **Tint / shade / transparency generator** — Generate up to 10 tints, 10 shades, and 9 transparency variants per color variable.
* **Light / Dark mode** — Per-user theme preference, persisted to WordPress usermeta.

=== Architecture ===

AFF is built for future portability. The data layer contains no WordPress dependencies and is designed to be ported to a standalone Windows or Mac application in a future phase.

== Installation ==

1. Upload the plugin folder to `/wp-content/plugins/`
2. Ensure **Elementor** and **Elementor Pro** are installed and active
3. Activate the plugin through the 'Plugins' screen in WordPress
4. Navigate to **AFF** in the WordPress admin sidebar

== Frequently Asked Questions ==

= Does AFF modify my Elementor CSS files? =

Not by default. AFF is read-first and non-destructive — it reads your Elementor kit CSS but never modifies it unless you explicitly click **↑ Variables** (Commit to Elementor) in the right panel. A summary dialog shows exactly what will be written before you confirm.

= Where are .aff.json files stored? =

In your WordPress uploads directory under `/uploads/aff/`.

= What Elementor version is required? =

Elementor v4+ (atomic widget architecture) and Elementor Pro.

== Changelog ==

= 0.4.2-beta =
* Added: Elementor commit now writes to _elementor_global_variables post meta as the primary target; CSS file patch applied as secondary for immediate visual preview.
* Fixed: CSS variable names normalized to -- prefix on Elementor commit; bare identifiers (sp-s) are now written as valid custom properties (--sp-s).
* Fixed: AFF now stores bare identifiers internally, preventing double-prefix on round-trip commit/import.
* Fixed: Elementor V4 import preserves labels unchanged; strips only one -- prefix per name.
* Fixed: Renaming a category no longer causes its variables to disappear from the edit view.
* Fixed: Add Category works correctly in Fonts and Numbers panels; modal handler now removed on close.
* Fixed: Deleting a project clears the active display; native confirm() replaced with modal dialog.
* Fixed: Project file auto-saved after Clear and Replace sync operations.
* Fixed: Left panel category count badges now match by category_id in addition to category name.
* Fixed: Take-a-look sign image converted to true PNG with transparent background.
* Changed: Duplicate utility methods extracted into shared AFF.Utils and AFF.Icons (Phase 1, ~520 lines removed).
* Changed: Six category-management methods consolidated into AFF.CatMixin applied to both Colors and Variables (Phase 2, ~290 lines removed).

= 0.4.1-beta =
* Fixed placeholder sign background: transparent PNG areas now render against the page theme colour instead of showing a checkerboard pattern.

= 0.4.0-beta =
* Numbers editing overhaul: pure number storage, autofill unit suffix on entry (px, rem, em, %, vw, vh, ch, x=PX), FX function mode with auto-close, invalid suffix error.
* New unitless `—` format type for Numbers (z-index, opacity, line-height, etc.).
* Variable counts in left navigation: per-category counts on category items; total counts on Colors/Fonts/Numbers subgroup headers.
* Collapse/expand all buttons on all three sets now use double-chevron icons with state-aware tooltips.
* Fixed drag/drop broken on Numbers and Fonts (undefined setLower caused ReferenceError in strict mode).
* Fixed scroll-to-top on Add Variable (wrong scroll container; also added preventScroll on focus).
* Fixed Numbers sort header column misalignment.
* Placeholder panel image changed from cover to contain; forge-themed arch banner prompts new users to read QUICK-START.md.
* QUICK-START.md corrected: button names, step numbering, section table, stale notes removed.
* fₓ display label for FX format throughout UI (stored value remains 'FX' for backward compatibility).

= 0.3.5-beta =
* Load Project modal: project list now shows folder structure with save count, last-saved date, and inline rename. Copy and delete project actions added.
* Fixed cross-module event contamination between Colors and Variables/Numbers views (drag, click, and focusout handlers now guarded per-view).
* Fixed drag snap-back and cross-module drag switch in Numbers view.
* Write to Elementor: auto-regenerates missing kit CSS file instead of erroring.
* Prevented duplicate variable names (JS and PHP validation).
* Removed forced `--` prefix while typing variable names.

= 0.3.4-beta =
* Plugin renamed from Elementor Framework Forge (EFF) to Atomic Framework Forge for Elementor (AFF) for WordPress.org compatibility. All internal prefixes updated.
* Sync now reads Elementor kit meta directly via read_from_kit_meta(); CSS file parsing retained as fallback.
* Fixed font and number category defaults not loading correctly on fresh installs.
* Fixed two AJAX action name call sites still using eff_sync_from_elementor after rename.

= 0.3.3-beta =
* Auto-regenerate Elementor kit CSS via Elementor's CSS API when the file is missing, preventing 0-variable sync on fresh installs or after cache clears.

= 0.3.2-beta =
* Fixed drag-and-drop color reorder failing when no project file was loaded (`aff_save_file` API mismatch after versioned backup refactor).
* Fixed column sort state not persisting when switching between Colors and Numbers tabs.
* Fixed `resolve_file()` rejecting valid subdirectory paths when the project directory did not yet exist, causing auto-load to silently fail.

= 0.3.0-beta =
* Versioned backup system with timestamped snapshots and two-level project/backup picker.
* Right panel reorganized into five named sections: Active Project, Save & Backups, Elementor Sync, Elementor V3 Import, Export / Import.
* Sync options dialog (Sync by name / Clear and replace) before pulling from Elementor.
* Commit summary dialog showing modified / new / deleted counts before writing to Elementor.
* Elementor V3 Global Colors import from kit post meta.
* Export and Import moved from top bar to right panel.
* Multi-project support with per-project backup limits (default 10, max 50).

= 0.2.3 =
* Auto-select project name in Manage Project modal.
* Elementor sync now lowercases all variable names on import.
* Fixed stacked .aff suffix in filenames.

= 0.2.0 =
* Pickr visual color picker (HEX / RGB / HSL + alpha).
* Tint / shade / transparency generator.
* Export / Import project as .aff.json.
* USER-MANUAL.md added.

= 0.0.1-alpha =
* Initial release — Variables (Colors, Fonts, Numbers), Sync, Organize, Save, Commit, Dark Mode.

== Upgrade Notice ==

= 0.3.4-beta =
Plugin renamed EFF → AFF for WordPress.org compatibility. Sync improved: reads Elementor kit meta directly. Bug fixes for category defaults and AJAX action names.

= 0.3.3-beta =
Auto-regenerates missing Elementor kit CSS on sync — prevents 0-variable result on fresh installs or after Elementor cache clears.

= 0.3.2-beta =
Bug-fix release: drag-and-drop color reorder, column sort persistence across tab switches, and auto-load reliability.

= 0.3.0-beta =
Right panel reorganized; sync and commit buttons moved from top bar to right panel. Versioned backup system replaces single-file saves.

== Credits ==

Developed by Jim Roberts / Jim R Forge — https://jimrforge.com
