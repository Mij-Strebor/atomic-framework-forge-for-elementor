# EFF User Manual
## Elementor Framework Forge — Alpha 0.2.3

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
10. [File Management](#10-file-management)
11. [Sync from Elementor](#11-sync-from-elementor)
12. [Commit to Elementor](#12-commit-to-elementor)
13. [Preferences](#13-preferences)
14. [Manage Project](#14-manage-project)
15. [Usage Badges](#15-usage-badges)
16. [Keyboard and Accessibility](#16-keyboard-and-accessibility)
17. [Troubleshooting](#17-troubleshooting)
18. [Known Limitations](#18-known-limitations)

---

## 1. Interface Overview

EFF uses a four-panel layout that fills the WordPress admin content area.

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
| **Top bar** | Global actions — Preferences, Sync, Manage Project, Functions, Commit |
| **Left nav** | Tree navigation — Variables (Colors / Fonts / Numbers) · Classes · Components |
| **Center edit space** | Main working area — category blocks, variable rows, inline editing |
| **Right panel** | File management, project counts |

EFF requires a minimum screen width of 1024px. On narrower screens a restriction overlay is displayed.

---

## 2. Top Bar

The top bar runs the full width of the EFF panel. All buttons are icon-only; hover any icon to see a tooltip.

### Left side

| Icon | Action | Description |
|------|--------|-------------|
| ⚙ Gear | Preferences | Open the Preferences modal — theme, default file, tooltip settings |
| ▦ Grid | Manage Project | Open the Manage Project modal — edit subgroup category lists |
| Functions ▼ | Functions menu | Dropdown: Convert V3 Variables, Change Types (placeholders in Alpha) |

### Right side

| Icon | Action | Description |
|------|--------|-------------|
| ↑ Box | Export | Export project as JSON or CSS *(placeholder — EFF 1.0.0)* |
| ↓ Box | Import | Import a previously exported EFF dataset *(placeholder — EFF 1.0.0)* |
| ↻ Arrows | Sync | Re-parse Elementor kit CSS and import new variables |
| ✓ Check | Commit | Write modified variable values back to Elementor kit CSS |
| ? Circle | Help | Quick reference *(placeholder)* |

> **Save Changes vs Commit:** The right panel **Save Changes** button saves your project to a `.eff.json` file. The top bar **Commit** button pushes changed variable values back to Elementor's CSS. They are separate actions.

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
▶ Classes           ← placeholder (EFF 1.0.0)
▶ Components        ← placeholder (EFF 2.0.0)
```

### Behavior

- Click **Variables**, **Colors**, **Fonts**, or **Numbers** to toggle expand/collapse.
- Click any **category leaf node** (e.g., Brand, Spacing) to load that category in the edit space. The selected item highlights in gold.
- Click **Colors**, **Fonts**, or **Numbers** directly to load all categories for that set.
- The left panel can be **collapsed** to a narrow icon bar using the chevron at its top. Hover collapsed icons to see a flyout menu.

---

## 4. Right Panel

### Project name field

Type a filename here (e.g., `my-project.eff.json`). This field is used by the Save and Load buttons.

### Buttons

| Button | Action |
|--------|--------|
| **Save** | Save the current project to the named `.eff.json` file |
| **Load** | Load the named `.eff.json` file into the edit space |
| **Save Changes** | Save the current project (same as Save; highlights gold when changes are pending) |

> EFF remembers the last filename you used and reloads it automatically on startup. See [File Management](#10-file-management).

### Asset counts

The bottom of the right panel shows live counts:

| Counter | What it counts |
|---------|---------------|
| Variables | Total variables across all three sets |
| Classes | Placeholder — always 0 in Alpha |
| Components | Placeholder — always 0 in Alpha |

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
| Blue | New — added manually or created in EFF, not from a sync |
| Gray | Unknown / no sync source |

---

## 6. Working with Variables

### Rename a variable

Click the variable **name** in the row. The field becomes editable. Type the new name and press **Enter** or click away. Names must start with `--` and use only letters, numbers, hyphens, and underscores.

### Edit a variable value

Click the **value** field in the row. Type the new value and press **Enter** or click away. EFF validates and normalizes the value on blur:

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

EFF uses the [Pickr](https://github.com/Simonwep/pickr) visual color picker (v1.9.0, classic theme).

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
- If opacity = 1 (fully opaque), EFF outputs the value without alpha: `#FF5733`, `rgb(255, 87, 51)`, `hsl(14, 100%, 60%)`
- If opacity < 1 (semi-transparent), EFF automatically outputs the alpha variant: `#FF573380`, `rgba(255, 87, 51, 0.5)`, `hsla(14, 100%, 60%, 0.5)`

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

Click the **🗑** trash icon in the category header action buttons. EFF moves all variables in that category to **Uncategorized** before deleting.

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

## 10. File Management

### Saving a project

1. Type a filename in the right panel input (e.g., `my-project.eff.json`).
2. Click **Save**.

EFF saves the file to `/wp-content/uploads/eff/` on your server. The file contains all variables, categories, and configuration for all three sets.

> Filename must end in `.eff.json`. If you omit the extension, EFF adds it.

### Loading a project

1. Type the filename in the right panel input.
2. Click **Load**.

EFF reads the file and replaces the current working state. If there are unsaved changes, EFF will warn you before loading.

### Auto-load on startup

EFF remembers the last filename you loaded or saved. On the next page load, it silently reloads that file in the background. If the file no longer exists, the startup load fails silently and the edit space starts empty.

You can override the default filename in **Preferences → Default Storage File**.

### Project file format

`.eff.json` files are plain JSON. They contain:

```json
{
  "version": "1.0",
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

The format is platform-agnostic — designed to be compatible with a future desktop application.

---

## 11. Sync from Elementor

### What sync does

Clicking **Sync** in the top bar:

1. Reads your active Elementor kit CSS file (e.g., `post-67.css` in `/wp-content/uploads/elementor/css/`)
2. Finds the Elementor v4 `:root {}` block (the second root block — not the legacy `--e-global-*` block)
3. Extracts all CSS custom properties
4. Classifies each one as Color, Font, or Number based on its value
5. Adds any new variables to your working state; existing variables are not overwritten
6. Runs a usage scan to update the usage badges

A result modal shows the count of variables imported, the CSS file path used, and any classification warnings.

### Manual CSS path fallback

If EFF cannot locate your kit CSS file automatically, a **manual path** input appears in the sync modal. Enter the full server path to the kit CSS file (e.g., `/var/www/html/wp-content/uploads/elementor/css/post-67.css`) and sync again.

### Sync does not delete variables

Variables already in your project are never removed by a sync. If a variable was deleted from the Elementor kit, it remains in EFF and its status changes to show it is no longer sourced from Elementor.

---

## 12. Commit to Elementor

### What commit does

Clicking **Commit** in the top bar writes the current values of **modified** variables back to the Elementor kit CSS file. Only variables with an orange (modified) status dot are written.

After a successful commit:
- Modified variables revert to green (synced) status
- Elementor will serve the updated values on the next page load
- The Commit button returns to its inactive (dimmed) state

### Safety notes

- **Commit is not reversible** through EFF. If you commit incorrect values, you will need to restore your Elementor kit from a backup or manually correct the CSS.
- EFF modifies only the variables it manages. The rest of the kit CSS file is untouched.
- Always save your EFF project (Save Changes) before committing, so you have a record of the values you pushed.

---

## 13. Preferences

Click the **⚙ gear icon** in the top-left to open the Preferences modal.

### Interface

| Setting | Options | Description |
|---------|---------|-------------|
| **Interface Theme** | Light / Dark | Sets the EFF color theme; saved to your WordPress user account |
| **Show Tooltips** | On / Off | Show or hide hover tooltips on all icon buttons |
| **Extended Tooltips** | On / Off | Show longer explanatory text in tooltips |

### File

| Setting | Description |
|---------|-------------|
| **Default Storage File** | Filename to pre-fill in the right panel on startup. If set, EFF also uses this as the auto-load target. |

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

## 14. Manage Project

Click the **▦ grid icon** in the top bar to open the Manage Project modal.

Manage Project lets you edit the **subgroup category lists** for each variable set — the categories that appear in the left navigation and in the edit space.

### Actions

| Action | How |
|--------|-----|
| Add a category | Type in the "Add category" input and press Enter or click ⊕ |
| Rename a category | Click the category name text and edit it inline |
| Delete a category | Click the 🗑 icon on the category row |
| Reorder categories | Drag the ⠿ handle to move a category up or down |

> **Uncategorized** cannot be renamed, deleted, or reordered. It is always at the bottom of each set.

Changes in Manage Project take effect immediately and are saved with your project.

---

## 15. Usage Badges

Each variable row shows a small badge on the right side indicating how many Elementor widgets reference that variable via `var()`.

| Badge appearance | Meaning |
|-----------------|---------|
| Gold pill with a number | Variable is used — number is the widget reference count |
| Gray outline (empty) | Variable is not referenced in any widget |

Usage data is collected when:
- You sync from Elementor (auto-triggered after sync)
- EFF loads your project file (auto-triggered after load)

Usage scanning reads up to 500 posts' Elementor data. On large sites, the count may be incomplete.

> Usage badges are informational only. EFF does not prevent you from editing or deleting variables that are in use.

---

## 16. Keyboard and Accessibility

| Key | Context | Action |
|-----|---------|--------|
| **Enter** | Variable name input | Save and close editing |
| **Enter** | Variable value input | Save and close editing |
| **Escape** | Expand panel | Close the panel |
| **Escape** | Any modal | Close the modal |
| **Tab** | Modal | Move focus through modal controls |
| **Ctrl+Z** | Text input | Undo text changes within that input (browser native) |

EFF meets WCAG 2.1 AA contrast standards:
- All icon buttons have `aria-label` attributes
- Modal dialogs trap focus while open
- Focus states use a 2px gold outline (`--eff-clr-accent`)

---

## 17. Troubleshooting

**Sync finds 0 variables**
→ Go to Elementor → Site Settings → click Save Changes to regenerate the kit CSS, then Sync again. If that fails, use the manual path fallback.

**"No file loaded" error when saving**
→ Type a filename ending in `.eff.json` in the right panel before clicking Save.

**Variables appear in the wrong set (color in Numbers, etc.)**
→ EFF classifies variables by value pattern. Drag misclassified variables to the correct category manually. This is a known limitation of pattern-based classification.

**Color picker swatch shows black or wrong color**
→ Hard refresh the page (Ctrl+Shift+R). The Pickr library loads from a CDN — check your browser's Network tab for load failures if the issue persists.

**Color picker does nothing when clicked**
→ Check the browser console for JavaScript errors. Make sure the CDN for Pickr is not blocked by a firewall or content filter.

**After committing, Elementor values look wrong**
→ Go to Elementor → Site Settings → Save Changes to regenerate the CSS. If the kit CSS is corrupted, restore from a WordPress backup and report the issue.

**The EFF panel looks unstyled or broken**
→ Hard refresh (Ctrl+Shift+R). If the issue persists, deactivate and reactivate the plugin, then refresh.

**Drag-and-drop is not working**
→ Make sure you are grabbing the ⠿ drag handle, not the variable name or value. Dragging from anywhere else in the row does not trigger the reorder.

**Left panel shows Classes or Components but clicking does nothing**
→ These sections are placeholders in Alpha 0.2.3. They are planned for EFF 1.0.0 and EFF 2.0.0 respectively.

---

## 18. Known Limitations

| Area | Status |
|------|--------|
| Classes panel | Navigation shown; content not built — EFF 1.0.0 |
| Components panel | Navigation shown; content not built — EFF 2.0.0 |
| Export / Import | Buttons present; not functional — EFF 1.0.0 |
| Change history / Undo | Not built; use Ctrl+Z in text inputs only — EFF 1.0.0 |
| Fonts value preview | Value editing works; live font preview — EFF 1.0.0 |
| Auto-save | Not implemented; save manually — EFF 1.0.0 |
| Batch format conversion | Per-variable format works; no bulk convert tool — EFF 1.0.0 |
| Usage scan size | Scans up to 500 posts; large sites may show incomplete counts |
| Mobile | Not supported; minimum 1024px screen required |

---

*© Jim Roberts / [JimRForge](https://jimrforge.com) — Distributed through [LytBox Academy](https://lytbox.com)*
