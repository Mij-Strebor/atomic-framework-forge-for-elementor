<img src="https://raw.githubusercontent.com/Mij-Strebor/elementor-framework-forge/master/assets/images/eff-git-banner.png" alt="Elementor Framework Forge" width="100%" />

# Elementor Framework Forge

**Professional management interface for Elementor Version 4 atomic widget assets — Variables, Classes, and Components.**

[![Version](https://img.shields.io/badge/version-1.0.0-f4c542?style=flat-square&labelColor=3d2f1f)](https://github.com/Mij-Strebor/elementor-framework-forge/releases)
[![WordPress](https://img.shields.io/badge/WordPress-5.8%2B-21759b?style=flat-square)](https://wordpress.org)
[![PHP](https://img.shields.io/badge/PHP-7.4%2B-777bb4?style=flat-square)](https://php.net)
[![License](https://img.shields.io/badge/license-GPL--2.0--or--later-green?style=flat-square)](https://www.gnu.org/licenses/gpl-2.0.html)
[![Requires](https://img.shields.io/badge/requires-Elementor%20Pro-cc2b5e?style=flat-square)](https://elementor.com/pro)

---

## Overview

Elementor Framework Forge (EFF) is a WordPress developer tool that provides a purpose-built management interface for the three core asset types introduced by **Elementor Version 4** (atomic widget architecture):

| Asset | Description |
|-------|-------------|
| **Variables** | CSS custom properties used by atomic widgets |
| **Classes** | Developer-defined class names applied to atomic widget controls *(EFF v3)* |
| **Components** | User-assembled widgets built within Elementor v4 *(EFF v4)* |

EFF is a developer-facing tool. It operates as a full-page admin panel inside WordPress and does **not** modify Elementor's compiled CSS output — it reads from it.

---

## Key Features

### v1.0.0

- **Sync from Elementor** — Reads the Elementor kit CSS file, identifies the v4 atomic `:root {}` block, and imports CSS custom properties automatically. Normalizes the known `lamp()` → `clamp()` editor typo.
- **Four-panel interface** — Top menu bar · collapsible left navigation tree · center edit space · right file management panel.
- **Variable usage count** — Scans all Elementor widget data (`_elementor_data` post meta) for `var(--name)` references. Displays per-variable usage badges in the edit space after load or sync.
- **Project organization** — Variables organized into Colors / Fonts / Numbers subgroups. Subgroup names are user-configurable via Manage Project.
- **File persistence** — Save and load project data as `.eff.json` files in the WordPress uploads directory (`/uploads/eff/`).
- **Light / Dark mode** — Per-user theme preference persisted to WordPress usermeta. JimRForge brand palette (deep brown + gold) for light mode.
- **Mobile restriction** — Graceful unsupported-device message on viewports below 1024px.
- **Accessible** — WCAG 2.1 AA/AAA compliant. Keyboard navigation, focus management, aria attributes throughout.

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        TOP MENU BAR                              │
│  [Prefs] [Project]              EFF              [Export][Sync]  │
├────────────┬─────────────────────────────────────┬───────────────┤
│            │                                     │               │
│  LEFT NAV  │         CENTER EDIT SPACE           │  RIGHT PANEL  │
│   PANEL    │                                     │               │
│            │  Variable / Value / Source / Usage  │  filename.eff │
│ ▼ Variables│                                     │  [Load][Save] │
│   ▼ Colors │  --primary   #3C2017  parsed   ●3   │               │
│     Branding  --accent    #FFD700  parsed   ●7   │  Vars:    7   │
│     Neutral│  --h1        clamp(…) parsed   ○0   │  Classes:  0  │
│   ▼ Fonts  │                                     │  Comps:    0  │
│   ▼ Numbers│                                     │               │
│ ▶ Classes  │                                     │               │
│ ▶ Components                                     │               │
└────────────┴─────────────────────────────────────┴───────────────┘
```

### File Structure

```
elementor-framework-forge/
├── elementor-framework-forge.php        # Plugin entry point, headers, bootstrap
├── includes/
│   ├── class-eff-loader.php             # Hook registration & class loading
│   ├── class-eff-admin.php              # Admin page, asset enqueueing
│   ├── class-eff-css-parser.php         # Elementor CSS file parser (read-only)
│   ├── class-eff-data-store.php         # Platform-portable data layer
│   ├── class-eff-usage-scanner.php      # Widget-level var() reference scanner
│   ├── class-eff-ajax-handler.php       # AJAX endpoints
│   └── class-eff-settings.php          # Plugin preferences
├── admin/
│   ├── views/page-eff-main.php          # Four-panel HTML template
│   ├── css/
│   │   ├── eff-theme.css                # Design tokens, light/dark palettes
│   │   └── eff-layout.css               # Panel structure, variable rows, badges
│   └── js/
│       ├── eff-app.js                   # Global state, AJAX wrapper, init
│       ├── eff-theme.js                 # Light/dark toggle & persistence
│       ├── eff-modal.js                 # Single-instance modal with focus trap
│       ├── eff-panel-left.js            # Nav tree, accordion, collapse
│       ├── eff-panel-right.js           # File management, counts
│       ├── eff-panel-top.js             # Toolbar buttons, tooltips, sync
│       └── eff-edit-space.js            # Category view, variable rows
├── assets/
│   ├── fonts/                           # Inter WOFF2 (400/500/600/700, Latin)
│   ├── icons/                           # 20 SVG icons
│   └── images/                          # Banners and screenshots
└── data/
    └── eff-defaults.json                # Default subgroup configuration
```

### Design Principles

**Read-only respect for Elementor.** EFF never modifies Elementor's compiled CSS output. The parser locates the last `:root {}` block in the kit CSS file, identifies non-system-prefixed variables, and imports them. Elementor's files are untouched.

**Platform-portable data layer.** `EFF_Data_Store` contains zero WordPress dependencies in its core logic. All `wp_*` adapter calls are isolated in a clearly marked section at the bottom of the class. The data layer is designed to be ported to a standalone Windows or Mac application in a future phase.

**`lamp()` normalization.** A known Elementor v4 editor quirk produces `lamp()` instead of `clamp()` in output CSS. EFF normalizes this automatically on import.

---

## Requirements

| Requirement | Version |
|-------------|---------|
| WordPress | 5.8+ |
| PHP | 7.4+ |
| Elementor | Latest |
| Elementor Pro | Latest |

> **Note:** Both Elementor and Elementor Pro must be installed and active. EFF displays an admin notice and refuses to load if either dependency is missing.

---

## Installation

1. Clone or download this repository into your WordPress plugins directory:

   ```bash
   cd wp-content/plugins
   git clone https://github.com/Mij-Strebor/elementor-framework-forge.git
   ```

2. Ensure **Elementor** and **Elementor Pro** are installed and active.
3. Activate **Elementor Framework Forge** in **Plugins → Installed Plugins**.
4. Navigate to **EFF** in the WordPress admin sidebar.

### Local Development (Symlink)

To symlink from a development directory on Windows, run from an **elevated** Command Prompt:

```cmd
mklink /D "C:\path\to\wp\wp-content\plugins\elementor-framework-forge" "E:\projects\plugins\eff"
```

On macOS/Linux:

```bash
ln -s /path/to/eff /path/to/wp/wp-content/plugins/elementor-framework-forge
```

---

## Usage

### First Run

1. Open **EFF** in the WordPress admin sidebar.
2. Click **Sync** (circular arrows, top bar) to import variables from Elementor.
3. Variables appear in the left panel under **Variables → Colors**, **Fonts**, or **Numbers** once categorized.
4. Enter a filename in the right panel (e.g., `my-project.eff.json`) and click **Save**.

### Syncing Variables

The Sync action:

1. Locates the active Elementor kit CSS file.
2. Identifies the last `:root {}` block containing non-system-prefixed variables.
3. Normalizes `lamp()` → `clamp()`.
4. Merges new variables into state without overwriting existing ones.
5. Runs a usage scan across all Elementor widget data automatically.

### Usage Count Badges

After syncing or loading a file, EFF scans `_elementor_data` post meta for `var(--varname)` references across up to 500 posts. Each variable row in the edit space displays:

- **Gold pill** — variable is referenced N times in Elementor widgets.
- **Muted outline** — variable exists but is not yet used in any widget.
- *(No badge)* — scan has not run yet for this session.

### File Management

`.eff.json` files are stored in `/wp-content/uploads/eff/`. The format is plain JSON and is designed to be portable — the same file can be loaded by future desktop application versions of EFF.

### Manage Project

Open **Manage Project** (grid icon, top bar) to customize the subgroup names under Colors and Numbers. One name per line. At least one subgroup per section is required.

---

## Roadmap

| Phase | Scope |
|-------|-------|
| **v1** *(current)* | Framework, four-panel layout, CSS parser, variable sync, file save/load, light/dark mode, usage count |
| **v2** | Edit space content — inline variable editing, value pickers, drag-to-reorder |
| **v3** | Classes support (pending Elementor v4 classes CSS exposure) |
| **v4** | Components registry |
| **v5** | Write-back to Elementor via API, change history with undo, export/import |
| **Future** | Standalone Windows application port · Mac application port |

### Controlling Elementor Elements

EFF is designed with three levels of Elementor integration:

1. **`wp_head` override block** *(v2)* — Outputs `<style id="eff-v4-override">:root { ... }</style>` via `wp_head`, overriding `post-XX.css` values in the CSS cascade. Safe — Elementor files untouched.
2. **Kit Manager API** *(v3)* — Reads and writes Elementor's native global colors and typography via `Elementor\Plugin::$instance->kits_manager`. Changes appear in Elementor's own Site Settings UI.
3. **Post meta editing** *(v4+)* — Bulk search-and-replace of `var(--old)` → `var(--new)` references across all `_elementor_data` widget trees. Enables site-wide variable renames in a single action.

---

## AJAX Endpoints

All endpoints require `manage_options` capability and a valid `eff_admin_nonce`.

| Action | Description |
|--------|-------------|
| `eff_save_file` | Save project data to a `.eff.json` file |
| `eff_load_file` | Load project data from a `.eff.json` file |
| `eff_sync_from_elementor` | Parse Elementor kit CSS and return v4 variables |
| `eff_get_usage_counts` | Scan widget data for `var()` references |
| `eff_save_user_theme` | Persist light/dark preference to usermeta |
| `eff_get_config` | Retrieve project subgroup configuration |
| `eff_save_config` | Save project subgroup configuration |
| `eff_get_settings` | Retrieve plugin settings |
| `eff_save_settings` | Save plugin settings |

---

## Technology Stack

- **PHP** — WordPress hooks, AJAX, CSS parsing, database scanning
- **Vanilla JavaScript** — No jQuery for EFF UI logic; `fetch()` for all AJAX
- **CSS Custom Properties** — Full design token system, light/dark mode via `[data-eff-theme]` attribute
- **Inter** — Loaded locally from `assets/fonts/` (WOFF2, Latin subset)
- **SVG icons** — 20 icons, `stroke="currentColor"`, no icon font dependency

---

## License

GPL-2.0-or-later — see [LICENSE](https://www.gnu.org/licenses/gpl-2.0.html).

---

## Credits

Developed by **Jim Roberts** / [Jim R Forge](https://jimrforge.com)

Built with [Claude Code](https://claude.ai/claude-code) — Anthropic
