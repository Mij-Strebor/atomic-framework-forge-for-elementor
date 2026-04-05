=== Atomic Framework Forge for Elementor ===
Contributors:      jimrforge
Tags:              elementor, css variables, design system, developer tools, atomic widgets
Requires at least: 5.8
Tested up to:      6.9
Requires PHP:      7.4
Stable tag:        0.3.3-beta
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

=== Key Features (Beta 0.3.3) ===

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

= 0.3.3-beta =
Auto-regenerates missing Elementor kit CSS on sync — prevents 0-variable result on fresh installs or after Elementor cache clears.

= 0.3.2-beta =
Bug-fix release: drag-and-drop color reorder, column sort persistence across tab switches, and auto-load reliability.

= 0.3.0-beta =
Right panel reorganized; sync and commit buttons moved from top bar to right panel. Versioned backup system replaces single-file saves.

== Credits ==

Developed by Jim Roberts / Jim R Forge — https://jimrforge.com
