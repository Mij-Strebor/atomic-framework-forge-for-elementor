<img src="https://raw.githubusercontent.com/Mij-Strebor/elementor-framework-forge/master/assets/images/eff-git-banner.png" alt="Elementor Framework Forge" width="100%" />

# Elementor V4 Framework Forge

**A professional management interface for Elementor Version 4 CSS assets.**

[![Beta](https://img.shields.io/badge/status-Beta%200.3.1-e07a40?style=flat-square&labelColor=2a1a0e)](https://github.com/Mij-Strebor/elementor-framework-forge/releases)
[![Version](https://img.shields.io/badge/version-0.3.1--beta-f4c542?style=flat-square&labelColor=3d2f1f)](https://github.com/Mij-Strebor/elementor-framework-forge/releases)
[![WordPress](https://img.shields.io/badge/WordPress-5.8%2B-21759b?style=flat-square)](https://wordpress.org)
[![PHP](https://img.shields.io/badge/PHP-7.4%2B-777bb4?style=flat-square)](https://php.net)
[![Requires](https://img.shields.io/badge/requires-Elementor%20Pro-cc2b5e?style=flat-square)](https://elementor.com/pro)
[![License](https://img.shields.io/badge/license-Proprietary-3d2f1f?style=flat-square)](LICENSE)

---

## Get Started

| | |
|---|---|
| **New to EFF?** | **[Quick Start Guide →](QUICK-START.md)** — from zero to an organized project in about ten minutes |
| **Looking up a feature?** | **[User Manual →](USER-MANUAL.md)** — complete reference for every panel and workflow |

> **LytBox Academy testers:** Start with the Quick Start Guide. It covers installation through your first saved project and explains every part of the interface.

---

## What is EFF?

Elementor Framework Forge (EFF) is a WordPress developer tool that gives you a purpose-built management interface for the CSS custom properties introduced by **Elementor Version 4** (the new atomic widget architecture).

Instead of hunting through Elementor's generated CSS by hand, EFF reads your kit file, organizes your variables into labeled categories, and lets you manage them as a structured, multi-project workspace with full backup and version history.

**EFF is a read-first, non-destructive tool.** It never modifies Elementor's CSS unless you explicitly commit changes back.

---

## Data Management Model

EFF manages Elementor V4 assets through four distinct, user-controlled data channels. All controls live in the **right panel**.

| Channel | Into EFF | Out of EFF |
|---------|----------|------------|
| **Elementor V4 Sync** | Pull variables from Elementor kit | Commit EFF variables back to Elementor kit |
| **Elementor V3 Import** | Import V3 Global Colors into current project | Not supported — V3 is read-only |
| **Backup / Restore** | Restore a saved project snapshot | Save Project — creates a timestamped backup |
| **External File** | Import an `.eff.json` from disk | Export current project to `.eff.json` |

**The only automatic operation is startup auto-load** — EFF reloads the last active project when you open the plugin. Everything else is user-initiated.

---

## Beta Status

This is **Beta 0.3.1** — distributed exclusively to LytBox Academy members. The complete Variables workflow is fully functional and ready for systematic testing. Classes and Components management are planned for future phases.

Please report issues in the LytBox Academy community. Your feedback directly shapes the next release.

---

## What Works in Beta 0.3.1

| Feature | Status |
|---------|--------|
| Sync CSS variables from Elementor V4 kit | ✅ Working |
| Auto-classify variables into Colors / Fonts / Numbers | ✅ Working |
| Organize variables into named categories | ✅ Working |
| Inline rename variables and categories | ✅ Working |
| Drag-and-drop reorder within and across categories | ✅ Working |
| Color swatch — click to open Pickr visual color picker | ✅ Working |
| Color picker — HEX / RGB / HSL + alpha | ✅ Working |
| Expand panel — tint / shade / transparency generator | ✅ Working |
| Add / rename / delete / duplicate / reorder categories | ✅ Working |
| Manual CSS path fallback when sync auto-detect fails | ✅ Working |
| Default categories per variable set (configurable) | ✅ Working |
| Usage count scan (how many widgets use each variable) | ✅ Working |
| Commit variable values back to Elementor V4 kit CSS | ✅ Working |
| Undo / Redo — Ctrl+Z / Ctrl+Y (50-step history) | ✅ Working |
| Light / Dark interface theme | ✅ Working |
| Auto-load last used project on startup | ✅ Working |
| Multiple named projects per site | ✅ Working |
| Save Project — creates timestamped backup snapshot | ✅ Working |
| Restore from backup — two-level project / backup picker | ✅ Working |
| Auto-prune — oldest backups removed at configurable limit | ✅ Working |
| Export project to `.eff.json` | ✅ Working |
| Import project from `.eff.json` | ✅ Working |
| Classes management | 🔜 Phase 3 |
| Components registry | 🔜 Phase 4 |
| Sync options dialog (Sync by name / Clear and replace) | ✅ Working |
| Commit summary dialog | ✅ Working |
| Elementor V3 Global Colors import | ✅ Working |

---

## Interface

![EFF Numbers](docs/images/numbers.png)

**Four panels:**
- **Top bar** — Preferences, Manage Project, Functions, History, Search, Help
- **Left nav** — Collapsible tree: Variables (Colors / Fonts / Numbers) · Classes *(Phase 3)* · Components *(Phase 4)*
- **Center edit space** — Category blocks, variable rows, inline editing
- **Right panel** — All data management: active project, save & backups, Elementor sync, V3 import, export/import

---

## Requirements

| Requirement | Version |
|-------------|---------|
| WordPress | 5.8 or later |
| PHP | 7.4 or later |
| Elementor (free) | Latest recommended |
| Elementor Pro | Latest recommended |

> Both **Elementor** and **Elementor Pro** must be installed and active. EFF shows an admin notice and refuses to load if either is missing.

---

## Installation

### Option A — Clone (recommended for testers)

```bash
cd wp-content/plugins
git clone https://github.com/Mij-Strebor/elementor-framework-forge.git
```

Activate **Elementor Framework Forge** in **WordPress → Plugins → Installed Plugins**.

### Option B — Download ZIP

1. Click **Code → Download ZIP** on this page.
2. Unzip into `wp-content/plugins/elementor-framework-forge/`.
3. Activate in WordPress.

### Option C — Development Symlink (Windows)

From an **elevated** Command Prompt:

```cmd
mklink /D "C:\path\to\wp\wp-content\plugins\elementor-framework-forge" "E:\path\to\your\eff"
```

macOS / Linux:
```bash
ln -s /path/to/eff /path/to/wp/wp-content/plugins/elementor-framework-forge
```

---

## Quick Start

> ### [Read the Quick Start Guide →](QUICK-START.md)
>
> The Quick Start walks through installation, syncing variables, organizing into categories, saving your project, and using the backup system. Takes about ten minutes.

The short version:

1. Activate the plugin and open **EFF** in the WordPress admin sidebar.
2. In the right panel under **Elementor Sync**, click **↓ Variables** to pull your variables from Elementor.
3. Variables appear under **Colors**, **Fonts**, and **Numbers** in the left panel.
4. Click any category to open it in the edit space. Edit values inline; click a swatch to open the color picker.
5. Click **Save Project** in the right panel to create your first backup snapshot.

---

## Project File Format

EFF stores projects in `uploads/eff/{project-slug}/` as timestamped `.eff.json` snapshots:

```
uploads/eff/
  my-brand/
    my-brand_2026-03-19_14-30-00.eff.json
    my-brand_2026-03-19_16-45-12.eff.json
  client-theme/
    client-theme_2026-03-18_09-00-00.eff.json
```

The format is plain JSON — portable between installations and designed to support a future desktop application.

---

## Architecture

### File Structure

```
elementor-framework-forge/
├── elementor-framework-forge.php        # Plugin entry, headers, bootstrap
├── includes/
│   ├── class-eff-admin.php              # Admin page, asset enqueueing
│   ├── class-eff-ajax-handler.php       # All AJAX endpoints
│   ├── class-eff-css-parser.php         # Elementor kit CSS parser (read-only)
│   ├── class-eff-data-store.php         # Platform-portable data layer
│   ├── class-eff-loader.php             # Hook registration
│   ├── class-eff-settings.php           # Plugin preferences
│   └── class-eff-usage-scanner.php      # Widget var() reference scanner
├── admin/
│   ├── views/page-eff-main.php          # Four-panel HTML template
│   ├── css/
│   │   ├── eff-theme.css                # Design tokens, light/dark palettes
│   │   ├── eff-layout.css               # Panel structure, nav, badges
│   │   ├── eff-colors.css               # Colors edit space + Pickr styles
│   │   └── eff-variables.css            # Fonts / Numbers edit space styles
│   └── js/
│       ├── eff-app.js                   # Global state, AJAX wrapper, init
│       ├── eff-colors.js                # Colors variable set module + Pickr
│       ├── eff-variables.js             # Generic variable set factory (Fonts, Numbers)
│       ├── eff-edit-space.js            # Edit space router
│       ├── eff-modal.js                 # Modal system with focus trap
│       ├── eff-panel-left.js            # Left nav tree
│       ├── eff-panel-right.js           # Data management panel
│       ├── eff-panel-top.js             # Top bar, tooltips, sync, preferences
│       └── eff-theme.js                 # Light/dark toggle & persistence
├── assets/
│   ├── fonts/                           # Inter WOFF2 (400/500/600/700, Latin)
│   ├── icons/                           # SVG icon set
│   └── images/                          # Banners
└── data/
    └── eff-defaults.json                # Default category lists per variable set
```

### Design Principles

**Non-destructive by default.** EFF reads Elementor's CSS and never modifies it unless you click **Commit to Elementor**. Your Elementor configuration is always the source of truth until you deliberately push changes back.

**User-controlled data flow.** Every sync, commit, export, import, save, and restore is an explicit user action. The only automatic operation is reloading the last active project on startup.

**Platform-portable data layer.** `EFF_Data_Store` contains zero WordPress dependencies in its core methods. The data layer is designed to be ported to a standalone desktop application in a future phase.

**No build step.** All JavaScript is ES5 IIFE — no webpack, no transpiler, no `npm install`. The plugin works by dropping files into WordPress.

---

## Roadmap

| Version | Scope |
|---------|-------|
| **0.0.1-alpha** | Variables — Colors, Fonts, Numbers. Sync, organize, save, commit. |
| **0.1.0** | Default categories/types per set. Auto-load last project. Functions menu. |
| **0.2.0** | Pickr color picker (HEX / RGB / HSL + alpha). Live palette refresh. |
| **0.2.2** | Export / Import. Undo / Redo. |
| **0.2.3** | Sync name normalization. Manage Project auto-select. Stacked suffix fix. |
| **0.3.0-beta** | Versioned backup system. Two-level picker. Multi-project. Right panel reorganization. Sync options dialog. Commit summary dialog. V3 Global Colors import. |
| **0.3.1-beta** *(this release)* | Bug fixes: drag-and-drop color reorder; column sort persistence across tab switches; auto-load reliability. |
| **1.0.0** | Classes management. Components registry. |
| **2.0.0** | Components registry. Elementor Kit Manager API write-back. |
| **Future** | Standalone Windows / Mac desktop application. |

---

## AJAX Endpoints

All endpoints require `manage_options` capability and a valid `eff_admin_nonce`.

| Action | Description |
|--------|-------------|
| `eff_save_file` | Save full project state to a new timestamped backup |
| `eff_load_file` | Load a backup into the working store |
| `eff_list_projects` | List all projects (Level 1 picker) |
| `eff_list_backups` | List all backups for a project (Level 2 picker) |
| `eff_delete_project` | Delete one backup; remove project dir if empty |
| `eff_sync_from_elementor` | Parse Elementor V4 kit CSS; return variables |
| `eff_sync_v3_global_colors` | Read V3 Global Colors from kit post meta; return color list |
| `eff_save_color` | Save one variable (add or update) |
| `eff_delete_color` | Delete a variable by ID |
| `eff_add_category` / `eff_delete_category` / `eff_rename_category` | Category management |
| `eff_reorder_categories` / `eff_duplicate_category` | Category ordering |
| `eff_commit_to_elementor` | Write EFF variable values to Elementor kit CSS |
| `eff_get_usage_counts` | Scan widget data for `var()` references |
| `eff_save_user_theme` | Persist light/dark preference to usermeta |
| `eff_get_config` / `eff_save_config` | Read/write subgroup configuration |
| `eff_get_settings` / `eff_save_settings` | Read/write plugin preferences |

---

## Technology

- **PHP** — WordPress hooks, AJAX handlers, CSS parsing, post meta scanning
- **Vanilla JavaScript (ES5)** — No jQuery for EFF UI logic; `fetch()` for all AJAX; no build step
- **CSS Custom Properties** — Full design token system; light/dark mode via `[data-eff-theme]`
- **Pickr v1.9.0** — Visual color picker (CDN); classic theme; HEX / RGB / HSL + alpha
- **Inter** — Loaded locally from `assets/fonts/` (WOFF2, Latin subset, no CDN)
- **SVG icons** — `stroke="currentColor"`, no icon font

---

## License

This software is distributed under a **proprietary source-available license** for LytBox Academy testing purposes. You may install and test it; you may not redistribute or use it in production without a separate commercial license.

See [LICENSE](LICENSE) for the full terms.

Commercial inquiries: contact@jimrforge.com

---

## Credits

Developed by **Jim Roberts** / [JimRForge](https://jimrforge.com)
Distributed through **[LytBox Academy](https://lytbox.com)**

Built with [Claude Code](https://claude.ai/claude-code) — Anthropic
