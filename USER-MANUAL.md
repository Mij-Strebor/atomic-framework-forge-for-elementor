# AFF User Manual
## Atomic Framework Forge for Elementor — Beta 0.3.4

> **Complete feature reference.** For a step-by-step first-run walkthrough, see the
> **[Quick Start Guide →](QUICK-START.md)**

---

## Contents

1. [Interface Overview](#1-interface-overview)
2. [Top Bar](#2-top-bar)
3. [Left Navigation Panel](#3-left-navigation-panel)
4. [Right Panel](#4-right-panel)
5. [Center Edit Space](#5-center-edit-space)
6. [Working with Variables](#6-working-with-variables)
7. [The Color Picker](#7-the-color-picker)
8. [Category Management](#8-category-management)
9. [Colors Expand Panel](#9-colors-expand-panel)
10. [Save and Backups](#10-save-and-backups)
11. [Sync from Elementor](#11-sync-from-elementor)
12. [Elementor V3 Import](#12-elementor-v3-import)
13. [Commit to Elementor](#13-commit-to-elementor)
14. [Preferences](#14-preferences)
15. [Manage Project](#15-manage-project)
16. [Usage Badges](#16-usage-badges)
17. [Keyboard and Accessibility](#17-keyboard-and-accessibility)
18. [Troubleshooting](#18-troubleshooting)
19. [Known Limitations](#19-known-limitations)

---

## 1. Interface Overview

AFF uses a four-panel layout that fills the WordPress admin content area.

```
┌──────────────────────────────────────────────────────────────┐
│                         TOP BAR                              │
├──────────┬───────────────────────────────────┬───────────────┤
│          │                                   │               │
│   LEFT   │        CENTER EDIT SPACE          │     RIGHT     │
│   NAV    │                                   │     PANEL     │
│          │                                   │               │
│(collapse)│                                   │               │
└──────────┴───────────────────────────────────┴───────────────┘
```

| Panel | Purpose |
|-------|---------|
| **Top bar** | Global actions — Preferences, Manage Project, Functions, Help |
| **Left nav** | Tree navigation — Variables (Colors / Fonts / Numbers) · Classes · Components |
| **Center edit space** | Main working area — category blocks, variable rows, inline editing |
| **Right panel** | All data management — active project, save & backups, Elementor sync, V3 import, export/import; plus asset counts |

AFF requires a minimum screen width of 1024px. On narrower screens a restriction overlay is displayed.

---

## 2. Top Bar

The top bar runs the full width of the AFF panel. All buttons are icon-only; hover any icon to see a tooltip.

### Left side

| Icon | Action | Description |
|------|--------|-------------|
| ⚙ Gear | Preferences | Open the Preferences modal — theme, default file, tooltip settings |
| ▦ Grid | Manage Project | Open the Manage Project modal — edit subgroup category lists |
| Functions ▼ | Functions menu | Dropdown: Convert V3 Variables, Change Types (placeholders in Alpha) |

### Right side

| Icon | Action | Description |
|------|--------|-------------|
| ⏱ History | Change History | Per-session change history *(placeholder)* |
| 🔍 Search | Search | Find variables by name or value *(placeholder)* |
| ? Circle | Help | Quick reference *(placeholder)* |

> **Sync, Commit, Export, and Import** have moved to the **right panel** in Beta 0.3.0. See [Section 4](#4-right-panel), [Section 11](#11-sync-from-elementor), and [Section 13](#13-commit-to-elementor).

---

## 3. Left Navigation Panel

### Tree structure

```
▼ Variables
    ▼ Colors        ← click to open Colors edit space
        • Brand
        • Background
        • Text
        • Uncategorized
    ▼ Fonts
        • Titles
        • Body
        • Uncategorized
    ▼ Numbers
        • Font Size
        • Spacing
        • Uncategorized
▶ Classes           ← placeholder (AFF 1.0.0)
▶ Components        ← placeholder (AFF 2.0.0)
```

### Behavior

- Click **Variables**, **Colors**, **Fonts**, or **Numbers** to toggle expand/collapse.
- Click any **category leaf node** (e.g., Brand, Spacing) to load that category in the edit space. The selected item highlights in gold.
- Click **Colors**, **Fonts**, or **Numbers** directly to load all categories for that set.
- The left panel can be **collapsed** to a narrow icon bar using the chevron at its top. Hover collapsed icons to see a flyout menu.

---

## 4. Right Panel

All data management controls live in the right panel. There are no hidden menus. The panel has five sections plus an asset count footer.

### Section 1 — Active Project

| Control | Function |
|---------|----------|
| **Project name input** | Shows the current project name; type to rename before saving |
| **Open / Switch Project** | Opens the two-level project/backup picker (see [Section 10](#10-save-and-backups)) |

### Section 2 — Save & Backups

| Button | Action |
|--------|--------|
| **Save Project** | Creates a new timestamped backup snapshot for the current project |
| **Save Changes** | Updates the current backup in-place without creating a new snapshot. Glows gold when unsaved changes are pending. |

### Section 3 — Elementor Sync

| Button | Action |
|--------|--------|
| **↓ Variables** | Pull variables from the active Elementor V4 kit. Shows a sync options dialog first (see [Section 11](#11-sync-from-elementor)) |
| **↑ Variables** | Write AFF variable values back to the active Elementor kit CSS. Shows a commit summary dialog first (see [Section 13](#13-commit-to-elementor)). Highlights gold when uncommitted changes exist. |

### Section 4 — Elementor V3 Import

| Button | Action |
|--------|--------|
| **↓ V3 Colors** | Import V3 Global Colors from the Elementor kit post meta as AFF color variables (see [Section 12](#12-elementor-v3-import)) |

### Section 5 — Export / Import

| Button | Action |
|--------|--------|
| **Export** | Download the entire current project as a portable `.aff.json` file |
| **Import** | Upload a `.aff.json` file; replaces the current project with its contents |

### Asset counts

The bottom of the right panel shows live counts:

| Counter | What it counts |
|---------|---------------|
| Variables | Total variables across Colors, Fonts, and Numbers |
| Classes | Placeholder — Phase 3 |
| Components | Placeholder — Phase 4 |

---

## 5. Center Edit Space

### Filter bar

Each variable set has a sticky filter bar at the top of the edit space:

| Control | Function |
|---------|----------|
| Set name label | Shows which set is active (COLORS / FONTS / NUMBERS) |
| Search input | Filter visible variables by name or value in real time |
| Collapse all | Collapse every category block in the current set |
| Back / close | Return to the set overview |

### Category blocks

Each category is a titled block. Category blocks can be collapsed or expanded using the chevron in the category header.

### Variable rows

Each row in a category block shows:

| Column | Content |
|--------|---------|
| ⠿ | Drag handle — hold and drag to reorder |
| ● | Status dot — color indicates sync/edit state |
| Swatch / preview | Color swatch (Colors) or blank (Fonts, Numbers); click swatch to open the color picker |
| Name | CSS custom property name (e.g., `--brand-primary`); click to rename |
| Value | Current value; click to edit inline |
| Format | Type selector: HEX / RGB / HSL for Colors; PX / REM / % etc. for Numbers |
| › | Expand chevron — opens the detail panel (Colors only) |
| 🗑 | Delete button — appears on hover |

### Status dot colors

| Color | Meaning |
|-------|---------|
| Green | Synced from Elementor — value matches the kit CSS |
| Orange | Modified — value differs from the synced source |
| Blue | New — added manually or created in AFF, not from a sync |
| Gray | Unknown / no sync source |

---

## 6. Working with Variables

### Rename a variable

Click the variable **name** in the row. The field becomes editable. Type the new name and press **Enter** or click away. Names must start with `--` and use only letters, numbers, hyphens, and underscores.

### Edit a variable value

Click the **value** field in the row. Type the new value and press **Enter** or click away. AFF validates and normalizes the value on blur:

- **Colors:** Must be a valid HEX (`#RRGGBB` or `#RRGGBBAA`), `rgb()`, `rgba()`, `hsl()`, or `hsla()` value.
- **Numbers:** Any numeric value with a unit (px, rem, %, etc.) or a `clamp()` / `calc()` expression.
- **Fonts:** Any valid font-family string.

If the value is invalid, an error tooltip appears and the field reverts to the last good value.

### Change a variable's format

Click the **Format** selector and choose a new format. For Colors, switching between HEX / RGB / HSL converts the stored value automatically.

### Add a variable

Click the **⊕ Add Variable** button at the bottom-left of a category block. A new row appears with a placeholder name. Click the name to rename it; click the value to set it.

### Delete a variable

Hover any variable row to reveal the **🗑** delete button on the right. Click it to delete. Deletion is immediate; there is no undo in Alpha.

### Reorder variables

Grab the **⠿** drag handle on the left of a row and drag it to a new position within the same category.

### Move a variable to a different category

Open the variable's **expand panel** (Colors: click **›**; other sets: use drag-and-drop to a different category block). Inside the expand panel, use the **Move to Category** dropdown at the bottom.

---

## 7. The Color Picker

AFF uses the [Pickr](https://github.com/Simonwep/pickr) visual color picker (v1.9.0, classic theme).

### Opening the picker

Click the **colored swatch** button on any color variable row. The Pickr panel appears anchored to the swatch.

> The swatch is only a clickable picker trigger on the **variable row** in the edit space. Inside the expand panel header, the swatch also opens the picker.

### Picker controls

| Control | Function |
|---------|----------|
| Color field (large square) | Drag to choose saturation and lightness |
| Hue slider (rainbow bar) | Drag to choose the hue |
| Opacity slider (checkerboard bar) | Drag to set alpha (transparency) |
| Color preview circle | Shows the current color |
| Format input | Shows the current color in the active format; you can type a value directly |
| **Save** button | Apply the color to the variable and close the picker |

### Format behavior

The picker shows the color in the variable's current format (HEX, RGB, or HSL). Switch the variable's format selector in the row before opening the picker if you want a different representation.

**Alpha handling:**
- If opacity = 1 (fully opaque), AFF outputs the value without alpha: `#FF5733`, `rgb(255, 87, 51)`, `hsl(14, 100%, 60%)`
- If opacity < 1 (semi-transparent), AFF automatically outputs the alpha variant: `#FF573380`, `rgba(255, 87, 51, 0.5)`, `hsla(14, 100%, 60%, 0.5)`

### HEX shorthand input

Typing in the value field on a color row accepts shorthand HEX:
- **3 digits** → 6 digits: `f53` → `#FF5533`
- **4 digits** → 8 digits (each digit doubled): `f53a` → `#FF5533AA`
- **6 digits** → full value: `#FF5533`
- **8 digits** → with alpha: `#FF573380`

### Saving a color

Click **Save** in the picker. The variable value updates, the swatch updates, and the tints/shades/transparencies in the expand panel refresh automatically.

Pressing **Enter** in the value input on the row also validates and saves the value.

---

## 8. Category Management

### Add a category

Click the **⊕** circle button at the bottom-left of the filter bar (below all category blocks in the edit space). Type a category name and press Enter.

### Rename a category

Click the category name text in the category header. It becomes an editable field. Type the new name and click away or press Enter.

> **Uncategorized** is a locked system category. It cannot be renamed or deleted.

### Delete a category

Click the **🗑** trash icon in the category header action buttons. AFF moves all variables in that category to **Uncategorized** before deleting.

### Duplicate a category

Click the **Copy** icon in the category header action buttons. A full copy of the category and all its variables is created with the name "Copy of [original name]".

### Reorder categories

Drag the **⠿** handle on the left of any category header to move the category up or down.

### Collapse / expand a category

Click the **⌄ chevron** button on the right of the category header. Collapse all categories at once using the collapse-all button in the filter bar.

### Sort variables within a category

Each category block has column header sort arrows above the variable list:
- Click **Name ↑↓** to sort variables alphabetically by name (ascending then descending on second click)
- Click **Value ↑↓** to sort by value

Sort is applied immediately and persisted.

---

## 9. Colors Expand Panel

The expand panel is available for **Colors** variables only. Click the **›** chevron at the right of any color row to open it.

The expand panel appears as a modal card centered in the screen. Click the backdrop or press **Escape** to close it.

### Header row

The panel header mirrors the variable row in the edit space:
- **Color swatch** — click to open the color picker
- **Variable name** — click to rename
- **Value** — click to edit
- **Format** — HEX / RGB / HSL selector
- **✕** Close button

Changes in the header are saved immediately.

### Tints generator

| Control | Function |
|---------|----------|
| **Tints** label | Row header |
| Count input (0–10) | Number of tints to generate; 0 hides the strip |
| Palette strip | Live preview of the generated tints, lightest at the right |

Tints are progressively lighter versions of the base color, calculated by increasing the lightness in HSL space.

Generated tints are named automatically (e.g., `--brand-primary-tint-1` through `--brand-primary-tint-5`).

### Shades generator

Same controls as Tints. Shades are progressively darker (decreasing lightness).

### Transparencies generator

| Control | Function |
|---------|----------|
| **Transparencies** label | Row header |
| On/Off toggle | Show or hide the transparency strip |
| Palette strip | 9 fixed alpha levels: 10% through 90% |

Transparency variants are named with the alpha percentage (e.g., `--brand-primary-10`).

### Committing children to Elementor

After configuring tints, shades, and transparencies, the generated child variables appear in the palette strips. To persist them, click **Commit** in the top bar. This writes all generated children back to the Elementor kit CSS file.

---

## 10. Save and Backups

### Save Project — creating a backup

Click **Save Project** in the **Save & Backups** section of the right panel.

AFF creates a timestamped snapshot under a per-project subdirectory:

```
wp-content/uploads/aff/
  my-brand/
    my-brand_2026-03-19_14-30-00.aff.json   ← first save
    my-brand_2026-03-19_16-45-12.aff.json   ← second save
```

Each Save Project call adds a new file. Nothing is overwritten.

### Save Changes — in-place update

Click **Save Changes** in the right panel (or wait for it to glow gold). This updates the current backup snapshot in place — no new file is created. Use this for frequent quick-saves between deliberate checkpoints.

### Auto-prune

When the number of backups for a project exceeds the configured limit (default 10), the oldest backup is silently deleted. The limit is configurable in Manage Project (1–50).

### Opening a project / restoring a backup

Click **Open / Switch Project** in the **Active Project** section. The picker has two levels:

**Level 1 — Projects:** lists all projects on this site sorted by most recent save. Each row shows the project name, backup count, and date of the latest backup. Click **Open** to drill into a project.

**Level 2 — Backups:** lists all backups for the selected project, newest first. Each row shows the backup timestamp.
- Click **Load** to restore that backup. The project loads into the edit space; further edits modify that backup until you click Save Project (which creates a new snapshot) or Save Changes (which updates it in-place).
- Click the **🗑 trash** icon to permanently delete one backup. If all backups are deleted, the project is removed from the list.
- Click **←** to return to Level 1 without loading anything.

### Auto-load on startup

AFF remembers the last backup you loaded or saved. On the next page load, it silently reloads that backup in the background. If the backup file no longer exists, the startup load fails silently and the edit space starts empty.

### Create a new project

In Level 1 of the picker, type a name in the "New project name" input and click **Create**. AFF clears all state and saves an empty project under the new name.

### Project file format

`.aff.json` files are plain JSON:

```json
{
  "version": "1.0",
  "name": "My Brand",
  "config": { "colorCategories": [...], "fontCategories": [...], "numberCategories": [...] },
  "variables": [
    {
      "id": "uuid",
      "name": "--brand-primary",
      "value": "#2C3E50",
      "format": "HEX",
      "subgroup": "Colors",
      "category": "Brand",
      "status": "synced"
    }
  ]
}
```

The format is platform-agnostic and designed to be compatible with a future desktop application.

---

## 11. Sync from Elementor

### Starting a sync

Click **↓ Variables** in the **Elementor Sync** section of the right panel. A **Sync Options dialog** appears before any changes are made.

### Sync options

| Option | Behavior |
|--------|----------|
| **Sync by name** *(default)* | Add new variables from Elementor; existing AFF variables are left unchanged. Safe for incremental updates. |
| **Clear and replace** | Remove all current AFF variables, then import everything fresh from Elementor. Discards any AFF-side edits. |

Click **Sync** to proceed or **Cancel** to abort.

### What sync does

1. Reads your active Elementor kit CSS file (e.g., `post-67.css` in `/wp-content/uploads/elementor/css/`)
2. Finds the Elementor V4 `:root {}` block
3. Extracts all CSS custom properties
4. Classifies each one as Color, Font, or Number based on its value
5. Applies the chosen merge strategy (sync by name or clear and replace)
6. Runs a usage scan to update the usage badges

A result modal shows the count of variables imported and the CSS file path used.

### Manual CSS path fallback

If AFF cannot locate your kit CSS file automatically, a **manual path** input appears in the error modal. Enter the full server path to the kit CSS file (e.g., `/var/www/html/wp-content/uploads/elementor/css/post-67.css`) and retry.

### Sync does not delete variables (Sync by name mode)

In "Sync by name" mode, variables already in your project are never removed. If a variable was deleted from the Elementor kit, it remains in AFF until you manually delete it.

---

## 12. Elementor V3 Import

### What V3 Import does

Elementor's legacy V3 "Global Colors" are stored as post meta on the active kit post — not in the kit CSS file. Click **↓ V3 Colors** in the **Elementor V3 Import** section of the right panel to read them and import them as AFF color variables.

The import dialog confirms before proceeding. After import:
- Each V3 color becomes a color variable named `--e-global-color-{id}` (e.g., `--e-global-color-primary`).
- New variables are placed in **Uncategorized**. Rename and move them as needed.
- Variables whose name already exists in AFF are skipped — existing values are not overwritten.
- A result modal reports how many colors were imported.

### When to use V3 Import

Use V3 Import when migrating a site from Elementor V3 to V4. After importing, you can sync the V4 kit (Section 11), then use the commit workflow to push your revised values back.

> V3 Import is read-only with respect to Elementor. It never modifies any Elementor file or post meta.

---

## 13. Commit to Elementor

### Starting a commit

Click **↑ Variables** in the **Elementor Sync** section of the right panel.

### Commit summary dialog

Before writing anything, AFF shows a summary of pending changes:
- **N modified** — variables whose value differs from the last synced value
- **M new** — variables added in AFF that do not yet exist in the Elementor kit
- **K deleted** — variables marked for deletion

If there are no pending changes, the dialog shows "Nothing to commit." Click **Commit** to proceed or **Cancel** to abort.

The **↑ Variables** button highlights gold when uncommitted changes exist.

### What commit does

1. Writes the current values of modified/new/deleted variables to the Elementor kit CSS file
2. Only the variables managed by AFF are changed — the rest of the kit CSS is untouched
3. After a successful commit, modified variables revert to green (synced) status
4. Elementor will serve the updated values on the next page load

### Safety notes

- **Commit is not reversible** through AFF. If you commit incorrect values, restore your Elementor kit from a backup or manually correct the CSS.
- Save a project backup (Save Project) before committing so you have a clean snapshot of the values you pushed.

---

## 14. Preferences

Click the **⚙ gear icon** in the top-left to open the Preferences modal.

### Interface

| Setting | Options | Description |
|---------|---------|-------------|
| **Interface Theme** | Light / Dark | Sets the AFF color theme; saved to your WordPress user account |
| **Show Tooltips** | On / Off | Show or hide hover tooltips on all icon buttons |
| **Extended Tooltips** | On / Off | Show longer explanatory text in tooltips |

### File

| Setting | Description |
|---------|-------------|
| **Default Storage File** | Filename to pre-fill in the right panel on startup. If set, AFF also uses this as the auto-load target. |

### Variable Sets — Default Types

The format that is pre-selected when you create a new variable in each set:

| Setting | Options |
|---------|---------|
| Colors default type | HEX / RGB / HSL |
| Fonts default type | System / Custom |
| Numbers default type | PX / REM / % / EM / VW / VH / CH / FX |

### Variable Sets — Default Categories

The category list that is seeded when you create a new empty project. **Uncategorized** is always present and cannot be removed.

| Setting | Default value |
|---------|--------------|
| Colors categories | Brand, Background, Text, Base, Neutral, Semantic |
| Fonts categories | Titles, Body |
| Numbers categories | Font Size, Line Height, Spacing, Gaps, Grids, Radius |

These defaults apply when you start a new file. Existing project files are not affected by changes to these settings.

---

## 15. Manage Project

Click the **▦ grid icon** in the top bar to open the Manage Project modal.

Manage Project lets you edit the **subgroup category lists** for each variable set and set the maximum number of backup snapshots per project.

### Actions

| Action | How |
|--------|-----|
| Add a category | Type in the "Add category" input and press Enter or click ⊕ |
| Rename a category | Click the category name text and edit it inline |
| Delete a category | Click the 🗑 icon on the category row |
| Reorder categories | Drag the ⠿ handle to move a category up or down |

> **Uncategorized** cannot be renamed, deleted, or reordered. It is always at the bottom of each set.

### Max backups per project

The **Max backups** input (default 10, range 1–50) controls how many timestamped snapshots AFF keeps per project. When the limit is exceeded, the oldest backup is silently deleted on the next Save Project.

Changes in Manage Project take effect immediately and are saved with your project.

---

## 16. Usage Badges

Each variable row shows a small badge on the right side indicating how many Elementor widgets reference that variable via `var()`.

| Badge appearance | Meaning |
|-----------------|---------|
| Gold pill with a number | Variable is used — number is the widget reference count |
| Gray outline (empty) | Variable is not referenced in any widget |

Usage data is collected when:
- You sync from Elementor (auto-triggered after sync)
- AFF loads your project file (auto-triggered after load)

Usage scanning reads up to 500 posts' Elementor data. On large sites, the count may be incomplete.

> Usage badges are informational only. AFF does not prevent you from editing or deleting variables that are in use.

---

## 17. Keyboard and Accessibility

| Key | Context | Action |
|-----|---------|--------|
| **Enter** | Variable name input | Save and close editing |
| **Enter** | Variable value input | Save and close editing |
| **Escape** | Expand panel | Close the panel |
| **Escape** | Any modal | Close the modal |
| **Tab** | Modal | Move focus through modal controls |
| **Ctrl+Z** | Text input | Undo text changes within that input (browser native) |

AFF meets WCAG 2.1 AA contrast standards:
- All icon buttons have `aria-label` attributes
- Modal dialogs trap focus while open
- Focus states use a 2px gold outline (`--aff-clr-accent`)

---

## 18. Troubleshooting

**Sync finds 0 variables**
→ Go to Elementor → Site Settings → click Save Changes to regenerate the kit CSS, then Sync again. If that fails, use the manual path fallback.

**"No file loaded" error when saving**
→ Enter a project name in the right panel input and click Save Project to create the initial backup.

**Variables appear in the wrong set (color in Numbers, etc.)**
→ AFF classifies variables by value pattern. Drag misclassified variables to the correct category manually. This is a known limitation of pattern-based classification.

**Color picker swatch shows black or wrong color**
→ Hard refresh the page (Ctrl+Shift+R). The Pickr library loads from a CDN — check your browser's Network tab for load failures if the issue persists.

**Color picker does nothing when clicked**
→ Check the browser console for JavaScript errors. Make sure the CDN for Pickr is not blocked by a firewall or content filter.

**After committing, Elementor values look wrong**
→ Go to Elementor → Site Settings → Save Changes to regenerate the CSS. If the kit CSS is corrupted, restore from a WordPress backup and report the issue.

**The AFF panel looks unstyled or broken**
→ Hard refresh (Ctrl+Shift+R). If the issue persists, deactivate and reactivate the plugin, then refresh.

**Drag-and-drop is not working**
→ Make sure you are grabbing the ⠿ drag handle, not the variable name or value. Dragging from anywhere else in the row does not trigger the reorder.

**Left panel shows Classes or Components but clicking does nothing**
→ These sections are placeholders in Beta 0.3.0. Classes are planned for Phase 3; Components for Phase 4.

---

## 19. Known Limitations

| Area | Status |
|------|--------|
| Classes panel | Navigation shown; content not built — Phase 3 |
| Components panel | Navigation shown; content not built — Phase 4 |
| Fonts value preview | Value editing works; live font preview not yet implemented |
| Auto-save | Not implemented; save manually with Save Changes |
| Batch format conversion | Per-variable format change works; no "convert all" bulk tool yet |
| Usage scan size | Scans up to 500 posts; large sites may show incomplete counts |
| Mobile | Not supported; minimum 1024px screen required |

---

*© Jim Roberts / [JimRForge](https://jimrforge.com)*
