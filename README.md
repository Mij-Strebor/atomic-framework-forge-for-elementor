v<img src="https://raw.githubusercontent.com/Mij-Strebor/elementor-framework-forge/master/assets/images/eff-git-banner.png" alt="Elementor Framework Forge" width="100%" />

# Elementor V4 Framework Forge

**A professional management interface for Elementor Version 4 CSS Variables.**

[![Alpha](https://img.shields.io/badge/status-Alpha%200.0.1-e07a40?style=flat-square&labelColor=2a1a0e)](https://github.com/Mij-Strebor/elementor-framework-forge/releases)
[![Version](https://img.shields.io/badge/version-0.0.1--alpha-f4c542?style=flat-square&labelColor=3d2f1f)](https://github.com/Mij-Strebor/elementor-framework-forge/releases)
[![WordPress](https://img.shields.io/badge/WordPress-5.8%2B-21759b?style=flat-square)](https://wordpress.org)
[![PHP](https://img.shields.io/badge/PHP-7.4%2B-777bb4?style=flat-square)](https://php.net)
[![Requires](https://img.shields.io/badge/requires-Elementor%20Pro-cc2b5e?style=flat-square)](https://elementor.com/pro)
[![License](https://img.shields.io/badge/license-Proprietary-3d2f1f?style=flat-square)](LICENSE)

---

> **LytBox Academy Testers** — Welcome! If you are here to test EFF, jump straight to the  **[Quick Start Guide →](QUICK-START.md)**

---

## What is EFF?

Elementor Framework Forge (EFF) is a WordPress developer tool that gives you a purpose-built management interface for the CSS custom properties introduced by **Elementor Version 4** (the new atomic widget architecture). Instead of hunting through Elementor's generated CSS by hand, EFF reads your kit file automatically, organizes your variables into labeled categories, and lets you manage them as a structured project.

EFF is a **read-first, non-destructive** tool — it never modifies Elementor's compiled CSS output unless you explicitly commit changes back.

---

## Alpha Status

This is **Alpha 0.0.1** — an early testing release distributed exclusively to LytBox Academy members. Expect rough edges. The core variable workflow is functional; some features shown in the roadmap are not yet built.

Please report issues in the LytBox Academy community. Your feedback directly shapes the next release.

---

## What Works in Alpha 0.0.1

| Feature | Status |
|---------|--------|
| Sync CSS variables from Elementor kit | ✅ Working |
| Auto-classify variables into Colors / Fonts / Numbers | ✅ Working |
| Organize variables into named categories | ✅ Working |
| Inline rename variables | ✅ Working |
| Drag-and-drop reorder within and across categories | ✅ Working |
| Color swatch preview | ✅ Working |
| Add / rename / delete / duplicate categories | ✅ Working |
| Save and load `.eff.json` project files | ✅ Working |
| Usage count scan (how many widgets use each variable) | ✅ Working |
| Commit variable values back to Elementor kit CSS | ✅ Working |
| Expand panel — tint/shade/transparency generator | ✅ Working |
| Light / Dark interface theme | ✅ Working |
| Fonts and Numbers variable sets | ✅ Working |
| Classes management | 🔜 EFF v2 |
| Components registry | 🔜 EFF v3 |
| Export / Import | 🔜 EFF v2 |
| Change history / Undo | 🔜 EFF v2 |

---

## Interface

![EFF Numbers](docs/images/numbers.png)

```

```

**Four panels:**
- **Top bar** — Preferences, Manage Project, Sync, Export, Help
- **Left nav** — Collapsible tree: Variables (Colors / Fonts / Numbers) · Classes · Components
- **Center edit space** — Category blocks, variable rows, inline editing
- **Right panel** — File management, asset counts, save/load

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

> **[→ Read the full Quick Start Guide](QUICK-START.md)**

The short version:

1. Activate the plugin and open **EFF** in the WordPress admin sidebar.
2. Click **Sync** (circular arrows, top-right) to import variables from Elementor.
3. Variables appear organized under **Colors**, **Fonts**, and **Numbers** in the left panel.
4. Type a filename in the right panel and click **Save**.

---

## Project File Format

EFF stores your work in `.eff.json` files inside `/wp-content/uploads/eff/`. The format is plain JSON — portable between installations and designed to support a future desktop application.

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
│   │   ├── eff-colors.css               # Colors edit space styles
│   │   └── eff-variables.css            # Fonts / Numbers edit space styles
│   └── js/
│       ├── eff-app.js                   # Global state, AJAX wrapper, init
│       ├── eff-colors.js                # Colors variable set module
│       ├── eff-variables.js             # Generic variable set factory (Fonts, Numbers)
│       ├── eff-edit-space.js            # Edit space router
│       ├── eff-modal.js                 # Modal system with focus trap
│       ├── eff-panel-left.js            # Left nav tree
│       ├── eff-panel-right.js           # File management panel
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

**Non-destructive by default.** EFF reads Elementor's CSS and never modifies it unless you click **Commit to Elementor**. Your Elementor configuration is always the source of truth.

**Platform-portable data layer.** `EFF_Data_Store` contains zero WordPress dependencies in its core methods. The data layer is designed to be ported to a standalone desktop application in a future phase.

**No build step.** All JavaScript is ES5 IIFE — no webpack, no transpiler, no `npm install`. The plugin works by dropping files into WordPress.

---

## Roadmap

| Version | Scope |
|---------|-------|
| **0.0.1-alpha** *(this release)* | Variables module — Colors, Fonts, Numbers. Sync, organize, save, commit. |
| **0.1.0** | Preferences: default categories per set, default type per set. Auto-load last project on startup. |
| **0.2.0** | Pickr color picker integration. Value format conversion (HEX ↔ RGB ↔ HSL). |
| **1.0.0** | Full variable workflow stable. Classes management. Export / Import. Change history. |
| **2.0.0** | Components registry. Elementor Kit Manager API write-back. Bulk variable rename. |
| **Future** | Standalone Windows / Mac desktop application. |

---

## AJAX Endpoints

All endpoints require `manage_options` capability and a valid `eff_admin_nonce`.

| Action | Description |
|--------|-------------|
| `eff_save_file` | Save project data to a `.eff.json` file |
| `eff_load_file` | Load project data from a `.eff.json` file |
| `eff_sync_from_elementor` | Parse Elementor kit CSS; return v4 variables |
| `eff_save_color` | Save a single variable (add or update) |
| `eff_delete_color` | Delete a variable by ID |
| `eff_reorder_colors` | Persist drag-and-drop order |
| `eff_add_category` | Add a category to a variable set |
| `eff_rename_category` | Rename a category |
| `eff_delete_category` | Delete a category (orphans move to Uncategorized) |
| `eff_reorder_categories` | Persist category order |
| `eff_duplicate_category` | Deep-copy a category and all its variables |
| `eff_commit_to_elementor` | Write modified variable values back to kit CSS |
| `eff_get_usage_counts` | Scan widget data for `var()` references |
| `eff_save_user_theme` | Persist light/dark preference to usermeta |
| `eff_get_config` / `eff_save_config` | Read/write subgroup configuration |
| `eff_get_settings` / `eff_save_settings` | Read/write plugin preferences |

---

## Technology

- **PHP** — WordPress hooks, AJAX handlers, CSS parsing, post meta scanning
- **Vanilla JavaScript (ES5)** — No jQuery for EFF UI logic; `fetch()` for all AJAX; no build step
- **CSS Custom Properties** — Full design token system; light/dark mode via `[data-eff-theme]`
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
