# ATFRFO User Manual
## Atomic Framework Forge for Elementor — v1.4.0

> **Complete feature reference.** For a step-by-step first-run walkthrough, see the
> **[Quick Start Guide →](QUICK-START.md)**

---

## Contents

1. [Interface Overview](#1-interface-overview)
2. [Top Bar](#2-top-bar)
3. [Left Navigation Panel](#3-left-navigation-panel)
4. [Center Edit Space](#4-center-edit-space)
5. [Working with Variables](#5-working-with-variables)
6. [The Color Picker](#6-the-color-picker)
7. [Category Management](#7-category-management)
8. [Colors Expand Panel](#8-colors-expand-panel)
9. [Print / PDF](#9-print--pdf)
10. [Save and Backups](#10-save-and-backups)
11. [The Sync Modal](#11-the-sync-modal)
12. [V4 Import (Fetch from Elementor)](#12-v4-import-fetch-from-elementor)
13. [V3 Import (Global Colors)](#13-v3-import-global-colors)
14. [V4 Export (Write to Elementor)](#14-v4-export-write-to-elementor)
15. [Conflict Resolution — Merge Dialog](#15-conflict-resolution--merge-dialog)
16. [V3 → V4 Migration Workflow](#16-v3--v4-migration-workflow)
17. [Export / Import (.atfrfo.json)](#17-export--import-affjson)
18. [Manage Projects](#18-manage-projects)
19. [Preferences](#19-preferences)
20. [Functions — Diagnose & Clean Up](#20-functions--diagnose--clean-up)
21. [Usage Badges](#21-usage-badges)
22. [Keyboard and Accessibility](#22-keyboard-and-accessibility)
23. [Troubleshooting](#23-troubleshooting)
24. [Known Limitations](#24-known-limitations)

---

## How ATFRFO Interacts with Elementor

> **Read — Import from Elementor:**
> ATFRFO reads from two Elementor data sources depending on version:
> - **V4:** The `_elementor_global_variables` post meta on the active Elementor kit — the same authoritative data Elementor itself renders into CSS. If that meta is unavailable, ATFRFO falls back to parsing the kit's generated CSS file (`/wp-content/uploads/elementor/css/post-{id}.css`).
> - **V3:** The `system_colors` and `custom_colors` stored in the Elementor kit post meta (`_elementor_page_settings`). These are the "Global Colors" panel entries.
>
> Both reads are non-destructive — nothing in Elementor is changed.
>
> **Write — Export to Elementor (V4 only):**
> ATFRFO writes modified variable values directly to the `_elementor_global_variables` post meta on the kit post — the same store Elementor itself uses. As a secondary step, ATFRFO also attempts to regenerate the kit's CSS file so the change is visible immediately without a full page reload; a **browser refresh is required afterward** to see the updated values inside Elementor's own Variables Manager panel. Every write is user-triggered, gated behind an explicit safety confirmation, and preceded by a summary of exactly what will change.
>
> ### Use ATFRFO on staging or a local development environment. Always back up your project — and your Elementor kit — before writing to Elementor.

---

## 1. Interface Overview

ATFRFO uses a three-panel layout that fills the WordPress admin content area.

```
┌──────────────────────────────────────────────────────────────┐
│  LOGO  Atomic Framework Forge   Project: [_______]  BUTTONS  │
├──────────┬───────────────────────────────────────────────────┤
│          │                                                    │
│   LEFT   │             CENTER EDIT SPACE                      │
│   NAV    │                                                    │
│          │                                                    │
│(collapse)│                                                    │
└──────────┴────────────────────────────────────────────────────┘
```

| Panel | Purpose |
|-------|---------|
| **Top bar** | Logo, project name input, and all action buttons |
| **Left nav** | Tree navigation — Variables (Colors / Fonts / Numbers) · Classes · Components |
| **Center edit space** | Main working area — category blocks, variable rows, inline editing, and the Preferences view |

There is no separate right-hand panel. All project management, sync, print, and import/export controls live in the top bar (directly or via the **More** dropdown), and every modal opens as an overlay above the workspace.

ATFRFO requires a minimum screen width of 1024px. Below that, a restriction overlay is displayed.

---

## 2. Top Bar

The top bar spans the full width of the ATFRFO panel: brand mark on the left, an editable project name in the center, and all action buttons on the right. Icon buttons show a tooltip on hover; long-hover (with Extended Tooltips enabled in Preferences) shows a longer description.

### Brand (far left)

The JimRForge logo and "Atomic Framework Forge" title. No interactive controls.

### Project name (center)

A text input pre-filled with the current project name. Edit the name and save your project to rename it. The field is blank when no project is loaded.

### Action buttons (right)

All project-scoped and app-level actions live in this cluster, left to right:

| Icon | ID | Action |
|------|----|--------|
| ▦ Grid | Manage Projects | Opens the **Manage Projects** settings modal (project name, category lists, max backups, default formats) — see [§18](#18-manage-projects) |
| — | Separator | — |
| 💾 Save | Save Changes | Update current project in place — glows red when dirty |
| ⏱ | Change History | Per-session change log *(placeholder — not yet built)* |
| — | Separator | — |
| ⟳ Sync | Sync | Open the **Sync modal** — all Elementor import/export operations, see [§11](#11-the-sync-modal) |
| — | Separator | — |
| ⋯ | More | Dropdown: Preferences · Functions · Print / PDF · Export · Import · Help |

**There is no separate top-level Preferences, Functions, or Help icon.** All three live inside the **More (⋯)** dropdown, along with Print / PDF, Export, and Import. Items inside **More** show a text label as well as an icon, since overflow-menu items are used rarely enough that an icon alone isn't a reliable memory aid.

### The More dropdown

| Item | Action |
|------|--------|
| Preferences | Opens the Preferences view in the center edit space — see [§19](#19-preferences) |
| Functions ▸ | Nested submenu: **Change Variable Types** *(placeholder, marked "Soon")* and **Diagnose & Clean Up** — see [§20](#20-functions--diagnose--clean-up) |
| Print / PDF | Opens the print options modal — see [§9](#9-print--pdf) |
| Export | Downloads the current project as `.atfrfo.json` |
| Import | Loads a `.atfrfo.json` file, replacing the current project |
| Help | Opens a brief in-app reference panel |

#### Save Changes glow behavior

The Save icon pulses with a brief red glow approximately every 12 seconds when there are unsaved changes. The pulse stops as soon as you save. Click the icon at any time to save.

---

## 3. Left Navigation Panel

### Tree structure

```
▼ Variables
    ▼ Colors           ← click to open all Colors categories
        • Brand        ← click to jump to that category
        • Background
        • Uncategorized
    ▼ Fonts
        • Titles
        • Body
        • Uncategorized
    ▼ Numbers
        • Font Size
        • Spacing
        • Uncategorized
▶ Classes              ← placeholder, coming in ATFRFO v3
▶ Components           ← placeholder, coming in ATFRFO v4
```

Each section label shows a count of variables it contains. Category leaves show the count for that category.

### Behavior

- Click **Variables**, **Colors**, **Fonts**, or **Numbers** to toggle expand/collapse.
- Click any **category leaf** to load that category in the edit space. The selected item highlights in gold.
- Click **Colors**, **Fonts**, or **Numbers** directly to load all categories for that set.
- **Classes** and **Components** show only a "coming soon" placeholder message when expanded — no data can be entered yet.
- The **collapse button** (arrow icon at the top of the left panel) collapses the panel to a narrow icon bar.

---

## 4. Center Edit Space

### Filter bar

A sticky bar at the top of the edit space for the active variable set:

| Control | Function |
|---------|----------|
| Set name | Shows the active set (COLORS / FONTS / NUMBERS) |
| Search input | Filter visible variables by name or value in real time |
| Sort buttons | Sort all variables A↑ or A↓ alphabetically |
| Collapse all | Collapse every category block |
| ⊕ Add category | Add a new top-level category |

A **status legend** row below the filter bar maps dot colors to sync states. Scrolling within a category keeps the filter bar and status legend pinned together as one sticky unit.

### Category blocks

Each category is a collapsible titled block. The header shows the category name, variable count, and action buttons (copy, delete, clear, collapse).

### Variable rows

Each row in a category block shows:

| Column | Content |
|--------|---------|
| ⠿ | Drag handle — hold and drag to reorder |
| ● | Status dot — color indicates sync/edit state |
| Swatch / preview | Color swatch (Colors) or "Aa" preview (Fonts); click swatch to open the color picker |
| Name | CSS custom property name or V3 display name; click to rename |
| Comment | Freeform note field; click to add or edit |
| Value | Current value; click to edit inline |
| Format | Type selector: HEX / RGB / HSL for Colors; PX / REM / % / etc. for Numbers |
| › | Expand chevron — opens the detail panel (Colors only) |
| 🗑 | Delete — appears on hover; opens a confirmation before removal |

### Status dot colors

| Color | Meaning |
|-------|---------|
| Green | Synced — value matches the Elementor source |
| Orange | Modified — value differs from the synced source |
| Blue | New — added in ATFRFO, not yet synced to Elementor |
| Yellow | Orphaned — previously synced; no longer in the Elementor source |
| Red | Conflict — exists in both with different content |

---

## 5. Working with Variables

### Rename a variable

Click the variable **name** in the row. The field becomes editable. Type the new CSS property name and press **Enter** or click away.

Names must use only letters, numbers, hyphens, and underscores, with an optional `--` prefix. Spaces and special characters are not valid CSS custom property names. Duplicate names are blocked both in the browser and on the server.

> **V3 imported colors** display their Elementor display name (e.g., "accent", "Don't Use Primary") in the name field. The underlying CSS variable name (e.g., `--e-global-color-accent`) is preserved internally for future V3 export. When you click to edit, you are editing the CSS variable name — type a valid CSS custom property.

### Edit a variable value

Click the **value** field in the row. Type the new value and press **Enter** or click away.

**Colors:** Must be a valid `#RRGGBB`, `#RRGGBBAA`, `rgb()`, `rgba()`, `hsl()`, or `hsla()` value. Shorthand accepted:
- `fff` → `#FFFFFF`
- `f00a` → `#FF0000AA`
- `30, 37, 103` → `rgb(30, 37, 103)`
- `51, 100, 50` → `hsl(51, 100%, 50%)`

**Numbers:** Enter a plain number or type a suffix to set the format automatically:
- `16px` → value `16`, format `PX`
- `1.5rem` → value `1.5`, format `REM`
- `33x` → shorthand for PX — value `33`, format `PX`
- `clamp(1rem, 2vw, 3rem)` → format `fₓ` (function), stored as-is
- A blank/unitless format (`—`) is available for values like `z-index`, `opacity`, or `line-height` that carry no CSS unit.

**Fonts:** Any valid font-family string.

If the value is invalid, an error tooltip appears and the field reverts to the last good value.

### Change format

Click the **Format** selector and choose a new format. For Colors, switching between HEX / RGB / HSL converts the stored value automatically.

### Add a variable

Click **⊕ Add Variable** at the bottom-left of a category block. A new row with a placeholder name appears. Click the name to rename; click the value to set it.

### Delete a variable

Hover any row to reveal the **🗑** button on the right. Click to delete after confirmation. (You can turn confirmations off in Preferences — see [§19](#19-preferences).)

### Add or edit a comment

Click the **Comment** field in the variable row. Type any freeform note — usage, intended role, migration status, etc. Press **Enter** or click away to save. Comments are saved with the project and can optionally appear on the printed variable sheet (see [§9](#9-print--pdf)).

### Reorder variables

Grab the **⠿** drag handle and drag the row to a new position within the same category.

---

## 6. The Color Picker

ATFRFO uses the [Pickr](https://github.com/Simonwep/pickr) visual color picker (v1.9.0, classic theme).

### Opening the picker

Click the **colored swatch** on any color variable row.

### Picker controls

| Control | Function |
|---------|----------|
| Color field (large square) | Drag to choose saturation and lightness |
| Hue slider (rainbow bar) | Drag to choose the hue |
| Opacity slider (checkerboard bar) | Drag to set alpha |
| Format input | Shows the current color; you can type a value directly |
| **Save** button | Apply and close |

The picker shows the color in the variable's current format. Switch the Format selector in the row before opening the picker if you want a different representation.

**Alpha handling:**
- Opacity = 1: output has no alpha (`#FF5733`, `rgb(255, 87, 51)`)
- Opacity < 1: output uses the alpha variant (`#FF573380`, `rgba(255, 87, 51, 0.5)`)

---

## 7. Category Management

### Add a category

Click **⊕** in the filter bar. Type a name and press Enter. The new category appears at the top.

### Rename a category

Click the category name text in the header. It becomes editable inline. Type the new name and press Enter or click away.

> **Uncategorized** is a locked system category — it cannot be renamed or deleted.

### Delete a category

Click **🗑** in the category header. All variables in that category move to **Uncategorized** before deletion.

### Clear a category

Click the **🧹** broom icon in the category header. Permanently deletes all variables in the category; the category itself remains empty.

> This cannot be undone. Export a backup first if needed.

### Duplicate a category

Click the **📋** icon in the category header. A full copy of the category and its variables is created.

### Reorder categories

Drag the **⠿** handle on the left of any category header.

### Collapse / expand

Click the **⌄ chevron** in the category header. Use the collapse-all button in the filter bar to collapse everything at once.

### Sub-categories

Each top-level category supports one level of sub-categories.

**Add** — click **⊕** at the far right of any category header (distinct from the filter bar button).

Sub-categories are indented, use a subtler background, and display their own count. The parent count includes all sub-category variables. Collapsing a parent cascades to its sub-categories.

**Tints, shades, and transparencies** generated from the expand panel are automatically placed in named sub-categories (e.g., "brand-primary Tints"). Re-generating updates the existing sub-category in place.

---

## 8. Colors Expand Panel

Click the **›** chevron at the right of any color row, or **right-click anywhere on the color row**.

The expand panel appears as a modal. Click the backdrop or press **Escape** to close.

### Header row

The expand panel header has two rows:

**Row 1:** drag handle · status dot · color swatch (click to open picker) · variable name (click to rename) · value (click to edit) · format selector · ✕ close

**Row 2:** full-width **Comment** field. Type any freeform note about this variable — its usage, intended role, migration status, etc. The comment is saved with the project and can optionally appear on the printed variable sheet (see [§9](#9-print--pdf)).

### Tints generator

Set the count (0–10) to generate progressively lighter tints. Named automatically (e.g., `--brand-primary-tint-1`).

### Shades generator

Same controls. Shades are progressively darker.

### Transparencies generator

Toggle on to generate 9 fixed-alpha transparency variants (10% through 90%). Named with the alpha percentage (e.g., `--brand-primary-10`).

Palette previews update live as you edit the generator inputs. Click **Save** in the modal footer to commit the generated children as variables; **Cancel** discards the preview without changing anything.

---

## 9. Print / PDF

Open **More (⋯) → Print / PDF**.

### Options modal

| Option | Description |
|--------|-------------|
| **Colors** | Include the Colors variable set (shown with count; disabled if none loaded) |
| **Fonts** | Include the Fonts variable set |
| **Numbers** | Include the Numbers variable set |
| **Print comments** | When checked, each variable's saved comment prints on a second line in italic beneath the variable row. Only variables that have a comment are affected. |

Click **Print** (or press **Enter**) to generate the document and open the browser's native print dialog in a new window. Click **Cancel** to close without printing.

### Printed document layout

The document header shows the plugin name, the active WordPress site name, the print date, and the total variable count.

Each selected variable set appears as a separate section with a colored title banner.

Within each section, the category hierarchy mirrors the screen layout:

- **Top-level category** — full-width colored header band
- **Sub-category** — indented band starting at the Name column; sub-category variable swatches appear under the sub-category title
- **Variable rows** — indented under their category or sub-category

### Saving as PDF

In the browser print dialog, choose **Save as PDF** as the destination.

---

## 10. Save and Backups

### Save Changes (toolbar icon)

Click the **💾 Save** icon in the toolbar. Updates the current project file in place — no new snapshot is created. The icon glows red when unsaved changes exist and pulses briefly every ~12 seconds as a reminder.

### Creating a versioned backup

Every save (via the Save icon, or from inside the Project Manager) writes a new **timestamped snapshot file** — nothing is silently overwritten:

```
wp-content/uploads/atfrfo/
  my-brand/
    my-brand_2026-03-19_14-30-00.atfrfo.json   ← first save
    my-brand_2026-03-19_16-45-12.atfrfo.json   ← second save
```

### Opening a project / restoring a backup

Open **▦ Manage Projects**, then click **Project Manager…** to reach the two-level picker (see [§18](#18-manage-projects) for the full path):

**Level 1 — Projects:** all projects on this site sorted by most recent save.
**Level 2 — Backups:** all backups for the project, newest first, with variable counts.
- Click **Load** to restore a backup.
- Click **🗑** to permanently delete one backup. If all backups are deleted, the project is removed.
- Click **←** to return to Level 1.

### Auto-load on startup

ATFRFO reloads the last active project automatically on the next page load. This is the **only** automatic data operation ATFRFO performs — there is no auto-save.

### Max backups

The default limit is 10 snapshots per project. When exceeded, the oldest is silently pruned. Configure the limit in **▦ Manage Projects** (range: 1–50).

---

## 11. The Sync Modal

Click the **⟳ Sync** button in the toolbar to open the Sync modal.

All Elementor import and export operations go through this modal.

> **Beta notice:** Sync reads from and writes to Elementor kit data directly. Use on staging or local only. The modal shows one of several rotating safety-reminder messages each time it opens.

### Controls

| Control | Options | Default |
|---------|---------|---------|
| **Elementor version** toggle | V3 / V4 | V3 |
| **Direction** toggle | Import / Export | Import |
| **Import mode** (Import only) | Sync by name / Clear and replace | Sync by name |

### Import modes

| Mode | Behavior |
|------|----------|
| **Sync by name** | Add new variables; existing ATFRFO values are not overwritten automatically — conflicting values are routed to the [merge dialog](#15-conflict-resolution--merge-dialog). Safe for incremental updates. |
| **Clear and replace** | Remove all existing variables, then import fresh. Discards ATFRFO edits for those variables. |

### V3 Export

V3 export is not currently provided. Selecting V3 + Export shows a "not available" message. If this feature is important to your workflow, contact the developer.

Click **Synchronize** to run the selected operation.

---

## 12. V4 Import (Fetch from Elementor)

**Sync modal → Elementor version: V4 → Direction: Import**

### What it does

1. Reads the `_elementor_global_variables` post meta on the active Elementor kit (falling back to parsing the kit CSS file if the meta read fails)
2. Classifies each variable as Color, Font, or Number by value pattern
3. Partitions the result into new variables, exact matches, and conflicts (see [§15](#15-conflict-resolution--merge-dialog))
4. Applies the chosen import mode (Sync by name or Clear and replace)

### After import

New variables land in **Uncategorized** under Colors, Fonts, or Numbers in the left panel. A "Fetch complete" summary reports how many variables were added and how many conflicts were resolved.

### Manual CSS path fallback

If ATFRFO cannot locate the kit data automatically, an error dialog shows a manual CSS path input. Enter the full server path to the kit CSS file (must be inside `wp-content/uploads/elementor/css/`) and retry.

---

## 13. V3 Import (Global Colors)

**Sync modal → Elementor version: V3 → Direction: Import**

### What V3 Import does

Elementor's V3 Global Colors are stored as post meta on the active kit post — not in the kit CSS file. V3 Import reads `system_colors` and `custom_colors` from that meta and imports them as ATFRFO color variables.

### Variable naming

Each imported V3 color uses its **Elementor display name** as shown in the Global Colors panel — for example, "accent", "Don't Use Primary", "card-hover". The CSS variable name is derived from the display name (e.g., `--accent`, `--Dont-Use-Primary`, `--card-hover`).

The original Elementor variable identifier (e.g., `--e-global-color-accent`) is stored internally on each variable so it can be used for a future V3 export.

### After import

- All imported V3 colors land in **Uncategorized** in the Colors set.
- Variables whose identifier already exists in ATFRFO are skipped — existing values are not overwritten.
- The left panel count for Uncategorized updates immediately.
- A result modal appears showing the number of colors imported. It closes automatically after 4 seconds, or immediately when you click **Close**.

### System color auto-notes

The first four colors returned by Elementor are the standard system colors (Primary, Secondary, Text, Accent) by position, regardless of what names they have been given in the Global Colors panel. ATFRFO automatically populates the Comment field for each of these four with its standard Elementor role:

| Position | Default Elementor role |
|----------|------------------------|
| 1 | System Colors: Used for Headings and Icons |
| 2 | System Colors: Used for List Items, Subheadings, Animated Headings, and Price Table backgrounds |
| 3 | System Colors: Used for Paragraphs and Menu items |
| 4 | System Colors: Used for Links, Button backgrounds, Tab and Accordion headings, and Badges |

Notes are only set when the color is first imported (not on re-import if the variable already exists).

### V3 Import is read-only

V3 Import never modifies any Elementor file or post meta.

---

## 14. V4 Export (Write to Elementor)

**Sync modal → Elementor version: V4 → Direction: Export**

### Safety gate

Before anything else, ATFRFO shows a mandatory **"Stop, Before You Write To Elementor"** confirmation. It reminds you to:
- Never run this on a live/in-service website — staging or local only
- Make a backup before writing
- Note that ATFRFO is well-tested but makes no compatibility guarantee for every Elementor configuration

If the Elementor or Elementor Pro version currently running on the site differs from the version ATFRFO was developed and tested against, a version-mismatch warning is shown here as well. You must click **I Understand – Continue** to proceed.

### Conflict check and commit summary

After you accept the safety gate, ATFRFO re-reads the current Elementor values and checks for conflicts. If any variable was changed on both sides since the last sync, the [merge dialog](#15-conflict-resolution--merge-dialog) opens first. Once conflicts (if any) are resolved, a commit summary appears:

- **N modified** — variables whose value differs from the last synced value
- **M new** — variables added in ATFRFO not yet in the Elementor kit
- **K deleted / removed from Elementor** — variables that existed in the last fetch but are no longer present in ATFRFO

If there are no pending changes, the dialog shows "Nothing to commit."

### What export does

1. Writes the current values of modified / new / deleted variables to the `_elementor_global_variables` post meta on the kit
2. Attempts to regenerate the kit CSS file as a secondary step for immediate visual preview
3. Only variables managed by ATFRFO are changed — the rest of the kit meta is untouched
4. After a successful write, committed variables revert to green (Synced) status
5. **Refresh the browser page** to see the new values reflected in Elementor's own Variables Manager

### Safety

Export is not reversible through ATFRFO alone. Save a project backup before exporting so you have a clean snapshot.

---

## 15. Conflict Resolution — Merge Dialog

Both **Fetch from Elementor** (import) and **Write to Elementor** (export) can encounter the same problem: a variable with the same name has a different value in ATFRFO than it does in Elementor. When that happens, ATFRFO opens a **Merge Conflicts** dialog before continuing.

### How it works

- Each conflicting variable appears as a row showing its name, the **ATFRFO value**, and the **Elementor value** (with a color swatch preview for color values).
- Each row has two choices: **Keep ATFRFO** (default for every row) or **Use Elementor** / **Keep Elementor** (label depends on direction).
- **Keep all ATFRFO** and **Use all Elementor** / **Keep all Elementor** buttons set every row at once.
- Click **Apply & Continue** to proceed with your choices, or **Cancel** to abort the operation entirely.

### Direction-specific behavior

| Direction | If you choose "Elementor" for a row |
|-----------|--------------------------------------|
| Fetch (Import) | The ATFRFO variable's value is overwritten with the Elementor value |
| Write (Export) | That variable is **excluded** from the write — Elementor's existing value is left untouched |

Variables that are brand-new on either side (not present in the other system) are never treated as conflicts — they are added or written automatically.

---

## 16. V3 → V4 Migration Workflow

A major use case for ATFRFO is migrating an Elementor site from V3 to V4. The challenge: as you move features over to V4 one at a time, you need to keep V3 and V4 colors in sync. Tracking which V3 color maps to which V4 variable — across dozens of colors and many pages — is the hard problem. ATFRFO solves it.

### How it works

**1. Import both V3 and V4 into the same project.**

- Use **Sync → V3 → Import** to bring in all V3 Global Colors (display names preserved).
- Use **Sync → V4 → Import** to bring in all V4 CSS custom properties from the kit.
- Both sets appear as ATFRFO color variables. Use categories to group V3 colors (e.g., category "V3 Source") and V4 variables (e.g., "Brand", "Background", etc.).

**2. Map V3 colors to their V4 equivalents.**

For each V3 color, identify the V4 variable it corresponds to. ATFRFO's side-by-side view — both sets visible in the same edit space — makes visual comparison easy.

Use the variable **label** (display name) and **swatch** to confirm the mapping. V3 variable names carry the original Elementor display name so "accent" in V3 is directly comparable to `--accent` or `--brand-accent` in V4.

**3. Migrate features one at a time.**

As each Elementor page or widget set migrates from V3 to V4 elements:
- The V4 variables it now uses are already in ATFRFO — edit and commit values as needed via **Sync → V4 → Export**.
- The V3 colors that page no longer references become candidates for retirement.

**4. Track V3 retirement.**

When a V3 color is no longer referenced by any V3 page or widget, delete it from ATFRFO (or move it to a "Retired V3" category). When all V3 colors are retired, the migration is complete.

**5. V3 Export**

V3 Export (**Sync → V3 → Export**) is not currently provided. If keeping V3 in sync for un-migrated pages is important to your workflow, contact the developer.

### Why this matters

Without ATFRFO, tracking V3 → V4 variable correspondence requires manually cross-referencing Elementor's Global Colors panel, the kit CSS, and individual widget settings. ATFRFO makes it a managed, visible, side-by-side workflow with a single source of truth.

---

## 17. Export / Import (.atfrfo.json)

### Export

Open **More (⋯) → Export**. Downloads the entire current project as a `.atfrfo.json` file (using the browser's native file-save picker where supported). Use this to:
- Back up a project off-server
- Share a project between WordPress sites
- Hand off a variable set to another designer or developer

### Import

Open **More (⋯) → Import**. Choose a `.atfrfo.json` file. The current project's state is **replaced** with the file's contents.

Export and import are **complete replacements**, not merges. For incremental updates from Elementor, use the Sync modal instead.

### File format

`.atfrfo.json` files are plain JSON and human-readable:

```json
{
  "version": "1.0",
  "name": "My Brand",
  "config": { "colorCategories": [...], "fontCategories": [...], "numberCategories": [...] },
  "variables": [
    {
      "id": "uuid",
      "name": "--brand-primary",
      "label": "Brand Primary",
      "value": "#2C3E50",
      "format": "HEX",
      "subgroup": "Colors",
      "category": "Brand",
      "category_id": "...",
      "source": "elementor-v3",
      "v3_var": "--e-global-color-primary",
      "status": "synced"
    }
  ]
}
```

---

## 18. Manage Projects

Click **▦ Grid** in the top bar. This opens the **Manage Projects** settings modal — not the project picker directly.

### Manage Projects modal (project settings)

| Field | Purpose |
|-------|---------|
| **Project name** | Renames the current project (used as its folder name on save) |
| **Colors / Fonts / Numbers Categories** | Comma-separated category lists seeded for a *new* project of this name. "Uncategorized" is added automatically and does not need to be typed. |
| **Max backups per project** | Snapshot limit before auto-pruning (1–50, default 10) |
| **Default Format** | The format pre-selected when you create a new variable — separate dropdowns for Colors (HEX/HEXA/RGB/RGBA/HSL/HSLA), Fonts (System/Custom), and Numbers (PX/%/EM/REM/VW/VH/CH/fₓ) |

Click **Save** to apply, or **Project Manager…** to open the actual project/backup picker described below.

### Project Manager — Level 1 (Projects)

Click **Project Manager…** inside the Manage Projects modal. Lists all projects on this site sorted by most recent save. Each row shows the project name (click to rename inline), backup count, and last-save date.

| Button | Action |
|--------|--------|
| **Open** | Drill into the project's backup list (Level 2) |
| **Copy** | Duplicate the project and all its backups under a new name |
| **🗑 Delete** | Permanently delete the project and all its backups |

Type a name in the **New project name** input and click **Create** to start a fresh, genuinely empty project.

### Project Manager — Level 2 (Backups)

Lists all backups for the selected project, newest first, with each backup's variable count.

| Button | Action |
|--------|--------|
| **Load** | Restore this backup into the edit space |
| **🗑** | Permanently delete this backup |
| **←** | Return to Level 1 |

---

## 19. Preferences

Open **More (⋯) → Preferences**. Preferences opens as a full view inside the center edit space (not a small popup).

> Category lists and default variable formats are **not** here — they live in the **Manage Projects** modal (see [§18](#18-manage-projects)).

### Appearance

| Setting | Options |
|---------|---------|
| Interface theme | Light / Dark — saved to your WordPress user account |
| Layout density | Compact / Normal / Comfortable |

### Tooltips

| Setting | Options |
|---------|---------|
| Show tooltips | On / Off |
| Extended mode | Show detailed tooltip descriptions (disabled when tooltips are off) |

### Confirmations

| Setting | Description |
|---------|-------------|
| Confirm before deleting variables | On by default. Turn back on here if you previously dismissed a delete confirmation with "Don't ask me again." |

### Project

| Setting | Description |
|---------|-------------|
| Default storage file | Path relative to the WordPress uploads directory, used to pre-fill the save location. Leave blank to choose each time. |

### Typography & Contrast

| Setting | Options |
|---------|---------|
| Font size | 14–18px, live preview shown alongside the slider |
| Color contrast | Standard / High |

### Menu Buttons

| Setting | Options |
|---------|---------|
| Button size | Normal / Large |
| Button contrast | Standard / High |

A live icon-button preview shows all four size/contrast combinations as you choose.

### Motion

Enable or disable reduced motion (suppresses CSS animations).

---

## 20. Functions — Diagnose & Clean Up

Open **More (⋯) → Functions** to reveal a nested submenu:

| Item | Status |
|------|--------|
| **Change Variable Types** | Placeholder — marked "Soon." Will bulk-convert the format of selected variables (e.g., a group of HEX colors to RGBA). |
| **Diagnose & Clean Up** | Fully working — see below |

### Diagnose & Clean Up

Scans the currently loaded project and reports:
- Total variable count
- Category counts per set (Colors / Fonts / Numbers)
- Any **duplicate variable names**
- Any **duplicate categories** (same name within the same subgroup)

If problems are found, click **Clean Up** to automatically:
- Keep the first occurrence of each duplicate variable or category
- Reassign any variables that pointed to a removed duplicate category

A new backup is recommended before running Clean Up, since the operation saves the deduplicated project to disk immediately.

---

## 21. Usage Badges

Each variable row shows a small badge indicating how many Elementor widgets reference that variable via `var()`.

| Badge | Meaning |
|-------|---------|
| Gold pill with number | Variable is in use — number is the widget reference count |
| Gray outline (empty) | Variable is not referenced |

Usage data is updated when you sync from Elementor (V4 import) and when a project loads.

Usage scanning reads up to 500 posts' Elementor data. On large sites, the count may be incomplete.

> Badges are informational only. ATFRFO does not prevent editing or deleting variables that are in use.

---

## 22. Keyboard and Accessibility

| Key | Context | Action |
|-----|---------|--------|
| **Enter** | Variable name input (readonly) | Activate for editing |
| **Enter** | Variable name/value input (active) | Commit and close |
| **Escape** | Expand panel | Close the panel |
| **Escape** | Any modal | Close the modal |
| **Tab** | Modal | Move focus through modal controls |

ATFRFO meets WCAG 2.1 AA contrast standards:
- All icon buttons have `aria-label` attributes
- Modal dialogs trap focus while open
- Focus states use a 2px gold outline

---

## 23. Troubleshooting

**V4 Sync finds 0 variables**
→ Go to **Elementor → Site Settings → Save Changes** to regenerate the kit data, then sync again. If that fails, use the manual CSS path fallback in the error dialog.

**V3 Import finds 0 colors**
→ Confirm you have Global Colors defined in **Elementor → Site Settings → Global Colors**. An empty kit has no V3 colors to import.

**"No file loaded" error when saving or committing**
→ Create a project first via **▦ Manage Projects → Project Manager… → Create**.

**Variables appear in the wrong set (color in Numbers, etc.)**
→ ATFRFO classifies variables by value pattern. Drag misclassified variables to the correct category manually.

**Color picker swatch shows black or wrong color**
→ Hard refresh (`Ctrl+Shift+R`). The Pickr library loads from a CDN — check the browser Network tab for load failures.

**After exporting, Elementor values look wrong or unchanged**
→ Refresh the browser page — Elementor's Variables Manager reads from meta on page load, not live. If values are still wrong, go to **Elementor → Site Settings → Save Changes** to regenerate the CSS. If the kit data is corrupted, restore from a WordPress backup and report the issue.

**The ATFRFO panel looks unstyled or broken**
→ Hard refresh (`Ctrl+Shift+R`). If the issue persists, deactivate and reactivate the plugin, then refresh.

**Drag-and-drop is not working**
→ Grab the **⠿** drag handle specifically — not the name or value field.

**Left panel shows Classes or Components but clicking does nothing**
→ These are placeholders for future phases (ATFRFO v3 and v4 respectively).

**Save icon stays red after saving**
→ Confirm the project has a name in the toolbar input. Saving requires a project name.

**A "Merge Conflicts" dialog appears during Sync or Write**
→ This is expected when a variable's value differs between ATFRFO and Elementor. Resolve each row (or use "Keep all ATFRFO" / "Use all Elementor") and click **Apply & Continue**. See [§15](#15-conflict-resolution--merge-dialog).

---

## 24. Known Limitations

| Area | Status |
|------|--------|
| Classes panel | Navigation shown; content not yet built (planned ATFRFO v3) |
| Components panel | Navigation shown; content not yet built (planned ATFRFO v4) |
| V3 Export (write back to Elementor V3) | Not currently planned — contact developer if needed |
| Change Variable Types (bulk format conversion) | Placeholder in the Functions menu; per-variable format change works today |
| Fonts value preview | Value editing works; live "Aa" font render uses the browser's own font resolution, not a Google Fonts loader everywhere |
| Change History | Button present; history log not yet built |
| Auto-save | Not implemented; save manually with the Save icon. Auto-*load* of the last project on startup is the only automatic behavior. |
| Usage scan size | Scans up to 500 posts; large sites may show incomplete counts |
| Mobile | Not supported; 1024px minimum |

---

*© Jim Roberts / [JimRForge](https://jimrforge.com)*
