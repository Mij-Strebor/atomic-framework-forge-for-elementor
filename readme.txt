=== Atomic Framework Forge for Elementor ===
Contributors:      mijstrebor
Tags:              elementor, css variables, design system, developer tools, atomic widgets
Requires at least: 5.8
Tested up to:      7.0
Requires PHP:      8.2
Stable tag:        1.4.1
License:           GPL-2.0-or-later
License URI:       https://www.gnu.org/licenses/gpl-2.0.html

Professional management interface for Elementor Version 4 (atomic widget architecture) assets — Variables, Classes, and Components.

== Description ==

Atomic Framework Forge for Elementor (ATFRFO) is a WordPress plugin that provides a professional management interface for Elementor Version 4 (atomic widget architecture) assets.

ATFRFO allows developers to organize, edit, and persist the three core asset types introduced by Elementor v4:

* **Variables** — CSS custom properties used by atomic widgets
* **Classes** — Developer-defined class names applied to atomic widget controls *(in development)*
* **Components** — User-assembled widgets built within Elementor v4 *(planned)*

**Requires Elementor and Elementor Pro.**

= How ATFRFO Interacts with Elementor =

**Read:** ATFRFO reads global variables directly from the active Elementor kit's _elementor_global_variables post meta -- the same authoritative data store Elementor itself uses. This happens only when you click "Fetch Elementor Data". It is purely read-only; nothing in Elementor is touched.

**Write:** When you click "Write to Elementor", ATFRFO writes the current variable values back to _elementor_global_variables on the kit post -- the same authoritative data store, updated the same way Elementor itself updates it. This is the primary and authoritative write. As a secondary, best-effort step, ATFRFO also patches the active kit's generated CSS file directly, so the page reflects the change immediately instead of waiting for Elementor's own regeneration on next load; if this secondary step is skipped or fails for any reason, Elementor's own cache-clear and regeneration (triggered by the post meta update) still produces the correct CSS. ATFRFO writes to no other Elementor data.

Every write is user-triggered (no background or automatic writes, ever), preceded by a confirmation dialog showing exactly what will change, and limited to variables you have managed in ATFRFO. ATFRFO does not touch anything else in your Elementor configuration.

**Use on staging or a local development environment only.** A corrupted write could damage your Elementor kit's variable data. Always export a project backup before writing to Elementor.

=== Key Features ===

* **Full Elementor V4 Variable Management** — ATFRFO reads, classifies, and lets you fully edit every CSS custom property exposed by Elementor V4's atomic widget architecture, organized into Colors, Fonts, and Numbers, with user-defined sub-classifications for each.
* **Color Variables** — Visual Pickr color picker (HEX / RGB / HSL + alpha) with live palette refresh; generate up to 10 tints, 10 shades, and 9 transparency variants per color variable.
* **Font Variables** — Organize and edit font-related CSS custom properties by classification.
* **Number Variables** — Full control over spacing, sizing, and other numeric variables, with unit-aware editing (px, rem, em, %, vw, vh, ch, and function mode).
* **Light / Dark Mode** — ATFRFO's own interface supports both, as a per-user preference persisted to WordPress usermeta.
* **V3 → V4 Color Migration** — Import all Elementor V3 Global Colors (system and custom) into ATFRFO with a single click. The four Elementor system colors (Primary, Secondary, Text, Accent) are automatically annotated with their standard usage roles so you never lose track of what each color controls. Use ATFRFO to map V3 colors to their V4 equivalents side-by-side as you rebuild pages.
* **Sync from Elementor V4** — Reads the Elementor V4 kit CSS file and imports CSS variables automatically. Sync options dialog: "Sync by name" or "Clear and replace".
* **Commit to Elementor V4** — Write modified variable values back to the active kit CSS. Commit summary shows modified / new / deleted counts before writing.
* **Versioned backup system** — Every Save Project creates a timestamped snapshot; restore any backup from the two-level project/backup picker. Up to 50 backups per project (configurable).
* **Multi-project support** — Multiple independent named projects per WordPress site.
* **Export / Import** — Download the current project as a portable `.atfrfo.json` file; import on any WordPress site running ATFRFO.
* **Four-panel interface** — Top menu bar, collapsible left navigation tree, center edit space, right data management panel.

=== Architecture ===

ATFRFO is built for future portability. The data layer contains no WordPress dependencies and is designed to be ported to a standalone Windows or Mac application in a future phase.

== Installation ==

1. Upload the plugin folder to `/wp-content/plugins/`
2. Ensure **Elementor** and **Elementor Pro** are installed and active
3. Activate the plugin through the 'Plugins' screen in WordPress
4. Navigate to **ATFRFO** in the WordPress admin sidebar

== Frequently Asked Questions ==

= Does ATFRFO modify my Elementor CSS files? =

Not by default. ATFRFO is read-first and non-destructive — it reads your Elementor kit CSS but never modifies it unless you explicitly click **↑ Variables** (Commit to Elementor) in the right panel. A summary dialog shows exactly what will be written before you confirm.

= Where are .atfrfo.json files stored? =

In your WordPress uploads directory under `/uploads/atfrfo/`.

= What Elementor version is required? =

Elementor v4+ (atomic widget architecture) and Elementor Pro.

== Changelog ==

= 1.4.1 =
* Fixed: Critical — every AJAX endpoint (Save, Load, Sync, and all other admin actions) was non-functional due to a method-naming mismatch introduced during the 1.4.0 prefix rename. All endpoints restored.

= 1.4.0 =
* Added: "Take a look" notify sign — rising notification pointing new users at the Quick-Start guide, capped at 3 lifetime shows per user.
* Changed: Brand assets — logo and favicon replaced with new blacksmith-hammer artwork.
* Changed: Help panel — Media Inventory Forge now shown as available on WordPress.org, added Fluid Button Forge as In Development, corrected stale references, updated for jimrforge.com being live.
* Fixed: Weak HTML-escape functions consolidated to the canonical, fully-correct implementation (security).
* Fixed: Font-size default mismatch between PHP and the actual CSS baseline corrected.
* Fixed: Two dead dev-only patch scripts removed from the plugin repo.

= 1.3.0 =
* Added: V3 import result modal — shows import count, Close button, auto-closes after 4 seconds.
* Added: System color auto-notes — first four V3 imports receive a "System Colors: ..." description automatically.
* Added: Print sub-category hierarchy — sub-categories indented with gradient band and accent bar; swatches align under sub-category title.
* Added: Print comments toggle — "Print comments" checkbox in print options modal; comments print as italic second line per variable.
* Changed: Color expand modal restructured to two-row header (Row 1: controls; Row 2: notes field).
* Changed: Sticky group header — filter bar and status legend now pin together as one unit when scrolling.
* Changed: Print document title — removed "V4"; now reads "Atomic Framework Forge for Elementor".
* Changed: Comment field placeholder — shows "Comment" instead of "Add a note…".
* Changed: Informational modals (Fetch, Clean Up, V3 Import) unified into ATFRFO.Modal.info() helper with auto-close and Close button.
* Fixed: App top bar scrolled off screen due to WordPress padding on #wpbody-content.
* Fixed: Brand name title faded on scroll — fade animation removed.

= 1.2.0 =
* Added: Sub-categories — one level of sub-categories under any top-level category, with full CRUD and cascade collapse.
* Added: Tints/Shades/Transparencies generated into named sub-categories rather than flat into the parent.
* Added: Delete Variable button — trash icon on hover in every variable row, with confirmation modal.
* Added: Status legend (Synced / Modified / New / Orphaned / Conflict) shown under the filter bar in all variable views.
* Added: Print/PDF — top-bar printer button with set-selection modal; opens browser print dialog.
* Added: Home icon replaces the ✕ close button on the type filter bar for clearer back-navigation.
* Fixed: Delete button column overflow — PHP inline style was emitting 7 columns, now correctly 8 for all views.
* Fixed: Google Fonts loaded for font preview cells.
* Fixed: Uncategorized badge catch-all, font classification, soft-deleted variable counts, delete-category variables bug, scroll-to-top after delete, smart quotes parse error.
* Changed: Category count badges roll up sub-category variables. New categories insert at top of list.

= 1.0.0 =
* Fixed: Plugin Check errors resolved — is_writable() replaced with WP_Filesystem, Requires PHP header aligned, hidden .gitkeep removed, filename with spaces renamed.
* Fixed: False-positive nonce/sanitization warnings suppressed (nonces verified centrally via verify_request()).
* Changed: Elementor dev version constants updated to 4.0.8 / 4.0.4.

= 0.4.2-beta =
* Added: Elementor commit now writes to _elementor_global_variables post meta as the primary target; CSS file patch applied as secondary for immediate visual preview.
* Fixed: CSS variable names normalized to -- prefix on Elementor commit; bare identifiers (sp-s) are now written as valid custom properties (--sp-s).
* Fixed: ATFRFO now stores bare identifiers internally, preventing double-prefix on round-trip commit/import.
* Fixed: Elementor V4 import preserves labels unchanged; strips only one -- prefix per name.
* Fixed: Renaming a category no longer causes its variables to disappear from the edit view.
* Fixed: Add Category works correctly in Fonts and Numbers panels; modal handler now removed on close.
* Fixed: Deleting a project clears the active display; native confirm() replaced with modal dialog.
* Fixed: Project file auto-saved after Clear and Replace sync operations.
* Fixed: Left panel category count badges now match by category_id in addition to category name.
* Fixed: Take-a-look sign image converted to true PNG with transparent background.
* Changed: Duplicate utility methods extracted into shared ATFRFO.Utils and ATFRFO.Icons (Phase 1, ~520 lines removed).
* Changed: Six category-management methods consolidated into ATFRFO.CatMixin applied to both Colors and Variables (Phase 2, ~290 lines removed).

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
* Plugin renamed from Elementor Framework Forge (EFF) to Atomic Framework Forge for Elementor (ATFRFO) for WordPress.org compatibility. All internal prefixes updated.
* Sync now reads Elementor kit meta directly via read_from_kit_meta(); CSS file parsing retained as fallback.
* Fixed font and number category defaults not loading correctly on fresh installs.
* Fixed two AJAX action name call sites still using eff_sync_from_elementor after rename.

= 0.3.3-beta =
* Auto-regenerate Elementor kit CSS via Elementor's CSS API when the file is missing, preventing 0-variable sync on fresh installs or after cache clears.

= 0.3.2-beta =
* Fixed drag-and-drop color reorder failing when no project file was loaded (`atfrfo_save_file` API mismatch after versioned backup refactor).
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
* Fixed stacked .atfrfo suffix in filenames.

= 0.2.0 =
* Pickr visual color picker (HEX / RGB / HSL + alpha).
* Tint / shade / transparency generator.
* Export / Import project as .atfrfo.json.
* USER-MANUAL.md added.

= 0.0.1-alpha =
* Initial release — Variables (Colors, Fonts, Numbers), Sync, Organize, Save, Commit, Dark Mode.

== Upgrade Notice ==

= 1.4.1 =
Critical fix: all admin AJAX actions were broken in 1.4.0. Update immediately.

= 1.0.0 =
First stable release. Resolves all WordPress Plugin Check errors and warnings. Safe to install fresh.

= 0.3.4-beta =
Plugin renamed EFF → ATFRFO for WordPress.org compatibility. Sync improved: reads Elementor kit meta directly. Bug fixes for category defaults and AJAX action names.

= 0.3.3-beta =
Auto-regenerates missing Elementor kit CSS on sync — prevents 0-variable result on fresh installs or after Elementor cache clears.

= 0.3.2-beta =
Bug-fix release: drag-and-drop color reorder, column sort persistence across tab switches, and auto-load reliability.

= 0.3.0-beta =
Right panel reorganized; sync and commit buttons moved from top bar to right panel. Versioned backup system replaces single-file saves.

== Credits ==

Developed by Jim Roberts / Jim R Forge — https://jimrforge.com
