=== Elementor Framework Forge ===
Contributors:      jimrforge
Tags:              elementor, css variables, design system, developer tools, atomic widgets
Requires at least: 5.8
Tested up to:      6.7
Requires PHP:      7.4
Stable tag:        0.2.3
License:           GPL-2.0-or-later
License URI:       https://www.gnu.org/licenses/gpl-2.0.html

Professional management interface for Elementor Version 4 (atomic widget architecture) assets — Variables, Classes, and Components.

== Description ==

Elementor Framework Forge (EFF) is a WordPress plugin that provides a professional management interface for Elementor Version 4 (atomic widget architecture) assets.

EFF allows developers to organize, edit, and persist the three core asset types introduced by Elementor v4:

* **Variables** — CSS custom properties used by atomic widgets
* **Classes** — Developer-defined class names applied to atomic widget controls (EFF v3)
* **Components** — User-assembled widgets built within Elementor v4 (EFF v4)

**Requires Elementor and Elementor Pro.**

=== Key Features (v1) ===

* **Sync from Elementor** — Reads the Elementor kit CSS file and imports v4 atomic CSS variables automatically. Normalizes known issues (e.g., `lamp()` → `clamp()`).
* **Four-panel interface** — Top menu bar, collapsible left navigation tree, center edit space, right file management panel.
* **Project organization** — Variables organized into Colors / Fonts / Numbers subgroups. Subgroups are user-configurable via Manage Project.
* **File persistence** — Save/load project data as `.eff.json` files in your uploads directory.
* **Light / Dark mode** — Per-user theme preference, persisted to WordPress usermeta.
* **Accessible** — WCAG 2.1 AA/AAA compliant. Keyboard navigation, focus management, aria attributes throughout.

=== Architecture ===

EFF is built for future portability. The data layer contains no WordPress dependencies and is designed to be ported to a standalone Windows or Mac application in a future phase.

== Installation ==

1. Upload the plugin folder to `/wp-content/plugins/`
2. Ensure **Elementor** and **Elementor Pro** are installed and active
3. Activate the plugin through the 'Plugins' screen in WordPress
4. Navigate to **EFF** in the WordPress admin sidebar

== Frequently Asked Questions ==

= Does EFF modify my Elementor CSS files? =

No. EFF is strictly read-only with respect to Elementor's compiled CSS output. It reads variables for import but never writes to Elementor's files.

= Where are .eff.json files stored? =

In your WordPress uploads directory under `/uploads/eff/`.

= What Elementor version is required? =

Elementor v4+ (atomic widget architecture) and Elementor Pro.

== Changelog ==

= 1.0.0 =
* Initial release — framework, four-panel layout, CSS parser, variable sync, file save/load, light/dark mode.

== Upgrade Notice ==

= 1.0.0 =
Initial release.

== Credits ==

Developed by Jim Roberts / Jim R Forge — https://jimrforge.com
