# AFF — Colors Workpage Specification

**Document:** AFF-Spec-Colors.md
**Version:** 1.0
**Date:** 2026-03-14
**Scope:** The Colors edit-space — everything rendered inside `#aff-edit-content` when a Colors subgroup or category is selected in the left nav.

---

## 1. Overview

The Colors workpage is a full editing environment for CSS custom property color variables. It is implemented as a single JavaScript module (`AFF.Colors`, `admin/js/aff-colors.js`) that intercepts the generic `AFF.EditSpace.loadCategory()` function for the `Colors` subgroup and replaces the content area with its own rendering pipeline.

**Responsibilities:**
- Render category blocks with variable rows
- Provide inline editing for name, value, and format
- Manage category CRUD (add, rename, delete, duplicate, reorder)
- Provide variable CRUD (add, delete, move between categories)
- Provide an expand panel (tint/shade/transparency generator + move-to-category)
- Drag-and-drop reordering of variables within a category
- Sort operations on variables and categories
- Undo/redo stack (50 entries, Ctrl+Z / Ctrl+Y)
- Status dot display reflecting sync state against the Elementor baseline
- Commit modified variables back to Elementor's kit CSS file

---

## 2. Module Architecture

**File:** `admin/js/aff-colors.js`
**Pattern:** ES5 IIFE, `'use strict'`, `var` only, no arrow functions

```
AFF.Colors = {
    _openExpandId       // varId of the currently open expand panel, or null
    init()              // Intercepts AFF.EditSpace.loadCategory; registers undo keyboard handler
    loadColors(sel)     // Entry point; sets up view, calls _renderAll
    _renderAll(sel, el) // Builds full colors-view HTML, injects into #aff-edit-content
    _buildCategoryBlock(cat, idx, total)  // HTML for one category block
    _buildVariableRow(v)                  // HTML for one color variable row
    _buildModalContent(v, rowKey)         // HTML for expand modal header + body
    _catBtn(action, label, icon, cls, disabled)  // Helper for category action buttons
    _formatOptions(current)              // <option> list for HEX/HEXA/RGB/RGBA/HSL/HSLA
    _bindEvents(container)               // Delegated event binding (called once per container)
    _bindModalEvents(modal, backdrop, v, varId, row, container)
    ... (CRUD, AJAX, utility methods)
}
```

Module-level variables:
- `_undoStack` / `_redoStack` — arrays of `{type, id, oldValue, newValue}`, max 50
- `_collapsedCategoryIds` — `{catId: boolean}` map, persists across re-renders
- `_focusedCategoryId` — set from nav click; cleared after first scroll
- `_drag` — drag state object `{active, varId, ghost, indicator, startY, scrollTimer}`

**Initialization** (called from `aff-app.js`):
```javascript
AFF.Colors.init();
```
`init()` patches `AFF.EditSpace.loadCategory` to route `subgroup === 'Colors'` calls to `AFF.Colors.loadColors()`.

---

## 3. Data Models

### 3.1 Variable Object

Stored in `AFF.state.variables[]`. All color variables have `subgroup === 'Colors'`.

| Field | Type | Description |
|-------|------|-------------|
| `id` | string (UUID) | Unique identifier |
| `name` | string | CSS custom property name; must match `^--[\w-]+$` |
| `value` | string | Current color value in the active format |
| `original_value` | string | Value at last Sync from Elementor (baseline reference) |
| `format` | string | One of: `HEX`, `HEXA`, `RGB`, `RGBA`, `HSL`, `HSLA` |
| `type` | string | Always `'color'` for Colors variables |
| `subgroup` | string | Always `'Colors'` |
| `category` | string | Category name (denormalized) |
| `category_id` | string | Category UUID |
| `status` | string | One of: `synced`, `modified`, `new`, `deleted` |
| `source` | string | `'elementor'` (synced from kit CSS) or `'user-defined'` |
| `order` | number | Sort order within category |
| `pending_rename_from` | string\|null | Previous name before an uncommitted rename |
| `parent_id` | string\|null | Parent variable UUID for tint/shade/transparency children |

**Status semantics:**
- `synced` — `value` matches the Elementor baseline
- `modified` — `value` differs from the baseline (or name changed)
- `new` — user-created; not yet in Elementor CSS
- `deleted` — marked for removal; excluded from commit

### 3.2 Category Object

Stored in `AFF.state.config.categories[]`.

| Field | Type | Description |
|-------|------|-------------|
| `id` | string (UUID) | Unique identifier |
| `name` | string | Display name |
| `order` | number | Sort order |
| `locked` | boolean | If true: cannot be deleted; name editing disabled |

**Default categories** (built-in fallback when config has none):
```
Branding (order:0), Background (order:1), Neutral (order:2), Semantic (order:3),
Uncategorized (order:4, locked:true)
```

**Uncategorized rule:** Always present and always locked. Variables without a matching category are assigned here on sync. When a non-locked category is deleted its variables are moved to Uncategorized.

---

## 4. Status Dot

Column 2 (8px) of every variable row and the expand modal header. An 8px circle with `border-radius: 50%`.

| Status | Color | Short tooltip | Long tooltip |
|--------|-------|---------------|--------------|
| `synced` | `#059669` | "Synced" | "Value matches Elementor — no changes pending" |
| `modified` | `#f4c542` | "Modified" | "Value has changed since last Sync — commit to push to Elementor" |
| `new` | `#3b82f6` | "New" | "New variable — not yet in Elementor CSS; commit to add it" |
| `deleted` | `#dc2626` | "Deleted" | "Marked for deletion — will be removed from Elementor on next commit" |

The `_statusColor(status)` helper maps status strings to these hex values.

---

## 5. UI Layout

### 5.1 Filter Bar (sticky)

The filter bar is `position: sticky; top: 0; z-index: 10` relative to `#aff-edit-space`. One row (`aff-filter-bar-top`):

```
[+ cat] ───────── [search        ] [A↑] [A↓] [C↑] [C↓] [✕] [⊞]
```

| Element | ID / Class | Description |
|---------|-----------|-------------|
| Add Category | `#aff-colors-add-category` | Opens "New Category" modal prompt |
| Spacer | `flex:1` | Pushes search to right |
| Search | `#aff-colors-search` | Live text filter on `aff-color-row` elements |
| Sort A↑ | `data-sort="colors-asc"` | Sort all variables A→Z |
| Sort A↓ | `data-sort="colors-desc"` | Sort all variables Z→A |
| Sort C↑ | `data-sort="cats-asc"` | Sort categories A→Z |
| Sort C↓ | `data-sort="cats-desc"` | Sort categories Z→A |
| Close | `#aff-colors-back` | Returns to placeholder, clears nav selection |
| Collapse toggle | `#aff-colors-collapse-toggle` | Collapse all / Expand all; `data-toggle-state="expanded|collapsed"` |

### 5.2 Category Blocks

Each category renders as `.aff-category-block > .aff-category-inner`, separated by `margin-bottom: 32px`. The outer block uses `overflow: visible` to allow the add-variable button to straddle the bottom edge.

**Collapsed state:** `data-collapsed="true"` on `.aff-category-block` hides `.aff-color-list` and `.aff-cat-add-btn-wrap` via CSS.

**Category header (two rows):**

Row 1 (`.aff-cat-header-top`):
```
[Category Name — 24px/700]  [count badge]  ────  [⧉] [↑] [↓] [✕] [▾]
```

| Element | Class / data-action | Description |
|---------|-----------|-------------|
| Name span | `.aff-category-name-input` | Single-click → `contenteditable="true"`; Enter/blur to save; Escape to revert |
| Count badge | `.aff-category-count` | Live variable count for this category |
| Duplicate | `data-action="duplicate"` | Copies category (name + variables) |
| Move up | `data-action="move-up"` | Disabled on first category |
| Move down | `data-action="move-down"` | Disabled on last category |
| Delete | `data-action="delete"` | Hidden on locked categories; shows confirmation modal |
| Collapse | `data-action="collapse"` / `.aff-category-collapse-btn` | Toggles `data-collapsed`; chevron rotates 180° when expanded |

Row 2 (`.aff-cat-header-bottom`): add-variable circle button (`.aff-cat-add-btn-wrap`, absolutely positioned at `bottom: -14px; left: 0`).

### 5.3 Variable Row Grid

`.aff-color-list-header` and `.aff-color-row` share the same 8-column grid:

```
grid-template-columns: 24px 8px 15% 1fr 28% 12% 28px 28px;
column-gap: 16px;
```

| Col | Width | Element | Class |
|-----|-------|---------|-------|
| 1 | 24px | Drag handle | `.aff-drag-handle` |
| 2 | 8px | Status dot | `.aff-status-dot` |
| 3 | 15% | Color swatch | `.aff-color-swatch` |
| 4 | 1fr | Variable name | `.aff-color-name-input` |
| 5 | 28% | Color value | `.aff-color-value-input` |
| 6 | 12% | Format selector | `.aff-color-format-sel` |
| 7 | 28px | Expand button | `.aff-color-expand-btn` |
| 8 | 28px | Delete button | `.aff-color-delete-btn` |

Rows have `6px` top/bottom padding. Row hover shows `var(--aff-clr-bg-hover)` background. The delete button (col 8) is `opacity: 0` by default; `opacity: 1` on row hover.

**Responsive breakpoint** (`max-width: 600px`): column 6 collapses to `0`, column 3 shrinks to `12%`.

### 5.4 Tooltip Attributes on Variable Row Elements

| Element | `data-aff-tooltip` | `data-aff-tooltip-long` |
|---------|-------------------|------------------------|
| Drag handle | "Drag to reorder" | — |
| Status dot | Status name (e.g. "Synced") | Status-specific long text (see §4) |
| Color swatch | "Click to open color editor" | — |
| Name input | "Variable name — click to edit" | — |
| Value input | "Color value — edit directly" | — |
| Format selector | "Color format" | — |
| Expand button | "Open color editor" | "Open the full color editor — tints, shades, transparency, and picker" |
| Delete button | "Delete variable" | "Remove this variable from the project" |

Category action buttons carry `data-aff-tooltip` equal to their `aria-label` (e.g. "Duplicate category", "Move category up", "Collapse/expand category").

---

## 6. Inline Editing

### 6.1 Variable Name

- `<input type="text" readonly>` — `cursor: default` when read-only
- **Single click** on the input or mousedown: removes `readonly`, focuses, selects all
- **Live guard:** `input` event enforces `--` prefix (strips leading dashes then prepends `--`)
- **Save:** `change` event (blur) or Enter key → `_saveVarName(varId, input)`
- **Validation:** must match `/^--[\w-]+$/`; invalid → revert to `data-original`, show field error tooltip
- **On save:** AJAX `aff_save_color` with `{id, name, pending_rename_from: oldName, status: 'modified'}`; updates `data-original` on success
- **Restore readonly:** `focusout` event on container

### 6.2 Color Value

- `<input type="text">` — always editable
- **Save:** `change` event (blur) or Enter key → `_saveVarValue(varId, value, input)`
- **Normalization:** `_normalizeColorValue(value, format)` validates and normalizes the string for the current format; invalid → revert + field error
- **On save:** AJAX `aff_save_color` with `{id, value, status: 'modified'}`; updates swatch and main-list row in DOM immediately (optimistic update)

### 6.3 Format Selector

- `<select>` with options: HEX, HEXA, RGB, RGBA, HSL, HSLA
- **On change:** `_saveVarFormat(varId, newFormat)` — converts current value to new format using `_convertColor()`, updates state, updates DOM (swatch + value input), then AJAX `aff_save_color`

### 6.4 Category Name

- `<span contenteditable="false">` — renders as 24px/700 heading
- **Single click:** sets `contenteditable="true"`, focuses, selects all
- **Enter:** blurs (triggers save via `focusout`)
- **Escape:** reverts to `data-original`, sets `contenteditable="false"`, blurs
- **Save (focusout):** `_saveCategoryName(input)` → AJAX `aff_save_category` with `{id, name}`; re-renders view on success
- **Locked categories** (`data-locked="true"`): single-click has no effect

---

## 7. Color Formats

| Format | Description | Example |
|--------|-------------|---------|
| HEX | 6-digit hex | `#1a2b3c` |
| HEXA | 8-digit hex with alpha | `#1a2b3cff` |
| RGB | CSS `rgb()` | `rgb(26, 43, 60)` |
| RGBA | CSS `rgba()` | `rgba(26, 43, 60, 1)` |
| HSL | CSS `hsl()` | `hsl(210, 39%, 17%)` |
| HSLA | CSS `hsla()` | `hsla(210, 39%, 17%, 1)` |

Format conversion is performed client-side by `_convertColor(value, targetFormat)`. Invalid values return `null` (no conversion applied).

---

## 8. Drag-and-Drop Reordering

Variables within a single category can be reordered via drag-and-drop.

**Implementation:**
- Drag handle (`.aff-drag-handle`): `cursor: grab / grabbing`
- On mousedown: creates a ghost element (`.aff-drag-ghost`) positioned fixed, cloned from the row; creates a drop indicator (`.aff-drop-indicator`) — a fixed 4px bar with `var(--aff-clr-accent)` background and glow
- Dragging row gets `.aff-row-dragging` (opacity 0.3)
- **Drop to empty category (collapsed):** the target category block expands automatically, variable is moved there
- **On drop:** calls `_finalizeDrop(targetCatId, insertBeforeVarId)` → updates `AFF.state.variables`, re-renders, then AJAX `aff_save_color` for each moved variable to update `category`, `category_id`, `order`
- Auto-scroll near viewport edges via `scrollTimer`
- Drop indicator is positioned fixed at the insertion point with a gradient: `linear-gradient(90deg, transparent, accent, accent, transparent)`

---

## 9. Expand Panel (Color Editor Modal)

Triggered by clicking the expand button (col 7) or the color swatch (col 3).

### 9.1 Opening

1. Any previously open panel is removed immediately (no animation)
2. A backdrop (`div.aff-expand-backdrop`) and modal (`div.aff-expand-modal`) are appended to `document.body`
3. `transform-origin` is set to the clicked row's viewport centre so the card appears to grow out of the row
4. Class `is-open` is added after a 10ms tick to trigger the CSS transition (scale 0.04→1.0, opacity 0→1, 650ms spring)

**Closing:**
- Backdrop click or close button (×): removes `is-open`, removes elements after 420ms
- Switching to a different row: old panel removed immediately, new one opens

### 9.2 Modal Layout

The modal header uses the same 7-column grid as `.aff-color-row` (drag placeholder → status dot → swatch → name → value → format → close button). All header fields are live-editable, synchronized with the main list row.

**Modal body — three generator rows:**

| Row | Label | Control | Description |
|-----|-------|---------|-------------|
| Tints | "TINTS" | number input (0–10) | Steps lighter toward white |
| Shades | "SHADES" | number input (0–10) | Steps darker toward black |
| Transparencies | "TRANSPARENCIES" | toggle switch | 9 fixed alpha steps (10%–90%) |
| Move to Category | "MOVE TO CATEGORY" | `<select>` | Only shown when 2+ categories exist |

**Live preview:** Palette strips (`.aff-palette-strip`) update in real time as the user changes step counts or toggles. The strip is a flex row of `.aff-palette-swatch` spans.

### 9.3 Child Variable Generation

Triggered by `_debounceGenerate()` (300ms debounce after any generator control change) → AJAX `aff_generate_children`.

**Naming convention:**

| Type | Pattern | Example (base: `--primary`) |
|------|---------|------------------------------|
| Tints | `--{base}-{i*10}` | `--primary-10`, `--primary-20` |
| Shades | `--{base}-plus-{i*10}` | `--primary-plus-10`, `--primary-plus-20` |
| Transparencies | `--{base}{i*10}` | `--primary10`, `--primary20` … `--primary90` |

Children inherit `category`, `category_id`, `format`, and `subgroup` from the parent. Transparency children always use `format: 'HEXA'`. Each generation call deletes all existing children of the parent before creating new ones.

**Color calculation (server-side, PHP):**
- Base color parsed as 6-digit hex → converted to HSL
- Tints: lightness shifted toward 100% in equal steps; capped at 98%
- Shades: lightness shifted toward 0% in equal steps; floored at 2%
- Transparencies: base hex + alpha byte `{step*10}%` expressed as 2 hex chars

---

## 10. Category Operations

### 10.1 Add Category

Clicking the `+` button in the filter bar opens a modal prompt. On confirm: AJAX `aff_save_category` with `{name}` (no ID = create). Response returns full `categories` array; state updated, view re-rendered, left panel refreshed.

### 10.2 Rename Category

Single-click on the category name span activates `contenteditable`. Save on blur/Enter via AJAX `aff_save_category` with `{id, name}`.

### 10.3 Delete Category

Shows confirmation modal. If the category has variables: "N variable(s) will be moved to Uncategorized." On confirm: AJAX `aff_delete_category` with `{category_id}`. Locked categories do not show the delete button.

### 10.4 Duplicate Category

Copies category and its variables to a new category named `"{name} copy"`. Implemented client-side + server-side via `aff_save_category` for the new category, then `aff_save_color` for each cloned variable with new IDs.

### 10.5 Reorder Categories (Move Up / Down)

Swaps the clicked category's `order` with the adjacent one. Buttons are disabled at the list ends. After swap: AJAX `aff_reorder_categories` with `{ordered_ids}` (full array in new order).

---

## 11. Variable Operations

### 11.1 Add Variable

The add button (`.aff-cat-add-btn-wrap`) sits on the bottom-left edge of the category block. Click → AJAX `aff_save_color` with defaults:

```javascript
{
    name:        '--new-color',
    value:       '#000000',
    type:        'color',
    subgroup:    'Colors',
    category:    catName,
    category_id: catId,
    format:      'HEX',
    status:      'new',
}
```

**No file guard:** If `AFF.state.currentFile` is null, a temp file (`aff-temp.aff.json`) is created first, then the variable add retried.

### 11.2 Delete Variable

Delete button (col 8, opacity 0 until row hover): click → `_deleteVariable(varId)` — confirms if the variable has children ("also delete N child variables?"), then AJAX `aff_delete_color` with `{variable_id, delete_children}`.

### 11.3 Move to Category

From the expand panel's "Move to Category" selector: `_moveVarToCategory(varId, newCatId)` → closes expand panel, AJAX `aff_save_color` with updated `category` and `category_id`, re-renders.

---

## 12. Undo / Redo

Stack limit: 50 entries. Operations tracked:

| Type | Fields |
|------|--------|
| `name-change` | `id, oldValue (name), newValue (name)` |
| `value-change` | `id, oldValue (value), newValue (value)` |

**Undo (Ctrl+Z):** Pops from `_undoStack`, pushes to `_redoStack`, calls `_ajaxSaveColor` with reverted field, re-renders.
**Redo (Ctrl+Y):** Pops from `_redoStack`, pushes to `_undoStack`, re-applies.

Any new user action (name or value change) clears `_redoStack`.

---

## 13. Sort Operations

Sort buttons in the filter bar:

| Button | data-sort | Action |
|--------|-----------|--------|
| A↑ | `colors-asc` | Sort all variables within each category alphabetically A→Z by name |
| A↓ | `colors-desc` | Sort Z→A |
| C↑ | `cats-asc` | Sort categories A→Z |
| C↓ | `cats-desc` | Sort categories Z→A |

Variable sort updates `AFF.state.variables` order values and calls AJAX `aff_save_color` for each affected variable. Category sort calls AJAX `aff_reorder_categories`.

---

## 14. Search / Filter

`#aff-colors-search` input fires `input` events → `_filterRows(container, query)`. Rows where `name` or `value` contains the query string (case-insensitive) remain visible; non-matching rows get `display: none`. Category blocks with all rows hidden also get `display: none`.

---

## 15. Collapse / Expand

### 15.1 Per-Category Toggle

Category collapse button (`data-action="collapse"`) toggles `data-collapsed` attribute on `.aff-category-block`. The CSS shows/hides `.aff-color-list` and `.aff-cat-add-btn-wrap`. State persisted in `_collapsedCategoryIds` map across re-renders.

### 15.2 Collapse / Expand All

Filter bar toggle button (`#aff-colors-collapse-toggle`): when in "expanded" state, collapses all; when in "collapsed" state, expands all. Updates `_collapsedCategoryIds` for all categories, re-renders. Button icon and `data-toggle-state` attribute update accordingly.

### 15.3 Nav Click Behavior

When a category is clicked in the left nav panel, `_focusedCategoryId` is set. On render: the focused category is expanded, all others are collapsed. `_jumpToCategory()` then smooth-scrolls the block into view. `_collapsedCategoryIds` is reset on nav click to avoid stale manual toggles overriding focus.

### 15.4 Default State (No Nav Click)

Empty categories start collapsed. Non-empty categories start expanded.

---

## 16. Commit to Elementor

**Trigger:** "Commit" button in the right panel (only when `AFF.state.pendingCommit === true`).

**Flow (`aff_commit_to_elementor` AJAX):**
1. Sends array of `{name, value}` for all non-deleted variables in the current file
2. PHP reads the active Elementor kit CSS file
3. For each variable: replaces `--name: value;` in the CSS using regex
4. Variables not found in CSS (new): appended to the user-variables `:root` block (or a new block if none exists)
5. CSS written back to disk (Elementor CSS regeneration is intentionally NOT triggered — AFF's values would be overwritten)
6. PHP baseline updated with committed values
7. JS: `AFF.state.pendingCommit = false`; re-renders to show updated status dots

**Skipped variables:** Variables whose names are not found in the CSS are reported in `res.data.skipped`. New variables are inserted instead.

---

## 17. AJAX Endpoints

All endpoints require:
- POST field `nonce`: `wp_nonce` with action `'aff_admin_nonce'`
- Authenticated user with `manage_options` capability

| Action | POST params | Description |
|--------|-------------|-------------|
| `aff_save_color` | `filename`, `variable` (JSON) | Add new variable (no `id`) or update existing (with `id`) |
| `aff_delete_color` | `filename`, `variable_id`, `delete_children` | Delete variable; optionally cascade to children |
| `aff_save_category` | `filename`, `category` (JSON) | Add (no `id`) or rename (with `id`) category |
| `aff_delete_category` | `filename`, `category_id` | Delete category; variables reassigned to Uncategorized |
| `aff_reorder_categories` | `filename`, `ordered_ids` (JSON array) | Set category order |
| `aff_generate_children` | `filename`, `parent_id`, `tints`, `shades`, `transparencies` | Generate tint/shade/alpha child variables |
| `aff_commit_to_elementor` | `filename`, `variables` (JSON array of `{name,value}`) | Write values to Elementor kit CSS |
| `aff_save_baseline` | `filename`, `variables` (JSON array of `{name,value}`) | Persist baseline snapshot |
| `aff_get_baseline` | `filename` | Retrieve baseline snapshot |

**Allowed fields for `aff_save_color` update:**
`name`, `value`, `original_value`, `format`, `category`, `category_id`, `order`, `status`, `pending_rename_from`, `type`, `subgroup`, `group`

**Response shape for write operations:**
```json
{
    "success": true,
    "data": {
        "id": "...",
        "data": { "variables": [...], "config": {...} },
        "counts": { "colors": N, "fonts": N, "numbers": N },
        "message": "..."
    }
}
```

---

## 18. CSS Classes Reference

| Class | Element | Description |
|-------|---------|-------------|
| `.aff-colors-view` | Container div | Flex column; no overflow-y (parent handles scroll) |
| `.aff-colors-filter-bar` | Filter bar | Sticky top; two-row layout |
| `.aff-filter-bar-top` | Row 1 of filter bar | Flex row |
| `.aff-filter-bar-bottom` | Row 2 of filter bar | Flex row (add-cat button) |
| `.aff-colors-view-title` | "COLORS" label | Uppercase, muted, xs |
| `.aff-colors-search` | Search input | Flex-grow |
| `.aff-colors-add-cat-btn` | Add category button | Icon button variant |
| `.aff-sort-btn` | Sort buttons | Small labeled buttons (A↑ etc.) |
| `.aff-colors-back-btn` | Close button | Icon button |
| `.aff-category-block` | One category | `data-collapsed`, `data-category-id` |
| `.aff-category-inner` | Inner clip wrapper | `overflow: hidden`, `border-radius: 12px` |
| `.aff-category-header` | Header container | Two-row flex column |
| `.aff-cat-header-top` | Header row 1 | Name + actions |
| `.aff-cat-header-bottom` | Header row 2 | Add-var button |
| `.aff-cat-header-left` | Left of row 1 | Name + count |
| `.aff-category-name-input` | Category name span | `contenteditable`; 24px/700 |
| `.aff-category-count` | Count badge | Pill, muted, xs |
| `.aff-category-actions` | Action button group | Flex row, gap 2px |
| `.aff-category-collapse-btn` | Collapse chevron | Rotates 180° when expanded |
| `.aff-cat-add-btn-wrap` | Add-var button wrapper | `position: absolute; bottom: -14px; left: 0` |
| `.aff-add-var-btn` | Add-var circle button | 28px circle, primary border |
| `.aff-color-list-header` | Column headings | Same grid as row |
| `.aff-color-list` | Variable rows container | Flex column |
| `.aff-color-row` | One variable row | Grid 8-col; `data-var-id`, `data-expanded` |
| `.aff-status-dot` | Status indicator | 8px circle, col 2 |
| `.aff-color-swatch` | Color preview | 32px height, col 3 |
| `.aff-color-name-input` | Name field | Monospace, readonly by default |
| `.aff-color-value-input` | Value field | Monospace, always editable |
| `.aff-color-format-sel` | Format dropdown | Custom arrow; appearance: none |
| `.aff-drag-handle` | Drag trigger | Col 1; `cursor: grab` |
| `.aff-color-expand-btn` | Expand chevron | Col 7; rotates when `data-expanded="true"` |
| `.aff-color-delete-btn` | Delete button | Col 8; hidden until row hover |
| `.aff-row-dragging` | Row being dragged | `opacity: 0.3` |
| `.aff-drag-ghost` | Drag clone | Fixed, cloned styles |
| `.aff-drop-indicator` | Drop target bar | Fixed 4px, accent color with glow |
| `.aff-expand-backdrop` | Modal click-catcher | Fixed inset-0, semi-transparent |
| `.aff-expand-modal` | Expand modal card | Fixed centered; scale animation; always light theme |
| `.aff-expand-modal.is-open` | Modal open state | `scale(1)`, `opacity: 1` |
| `.aff-modal-header` | Modal header | Same grid as `.aff-color-row` |
| `.aff-modal-close-btn` | Modal × button | Col 7 of header; 22px/700 |
| `.aff-modal-body` | Modal content | Stacked generator rows |
| `.aff-modal-gen-row` | One generator row | Flex: label + ctrl + palette |
| `.aff-modal-gen-label` | Row label | 130px, uppercase, muted |
| `.aff-modal-gen-ctrl` | Control wrapper | 72px fixed width |
| `.aff-palette-strip` | Color preview strip | Flex, 36px tall, gap 2px |
| `.aff-palette-swatch` | One palette color | `flex: 1` |
| `.aff-gen-num` | Step count input | Number, 64px |
| `.aff-toggle-label` | Toggle wrapper | Flex, `cursor: pointer` |
| `.aff-toggle-track` | Toggle track | 36×20px, `border-radius: 10px` |
| `.aff-cat-move-select` | Category move select | Fills ctrl area |
| `.aff-icon-btn` | Generic icon button | 28×28px, transparent bg |
| `.aff-icon-btn--danger` | Danger hover state | Red bg on hover |
| `.aff-inline-error` | Field error tooltip | Fixed, red, appended to body |
| `.aff-colors-empty` | Empty state text | Muted, sm |

---

## 19. Expand Modal — Animation Details

```css
/* Closed */
.aff-expand-modal {
    transform: translate(-50%, -50%) scale(0.04);
    opacity: 0;
    transition: opacity 0.28s ease-in, transform 0.38s cubic-bezier(0.55, 0, 1, 0.45);
}

/* Open */
.aff-expand-modal.is-open {
    transform: translate(-50%, -50%) scale(1);
    opacity: 1;
    transition: opacity 0.28s ease-out, transform 0.65s cubic-bezier(0.22, 1, 0.36, 1);
}
```

`transform-origin` is set by JS to `calc(50% + {dx}px) calc(50% + {dy}px)` where dx/dy are the offsets from the row's centre to the viewport centre. This makes the card appear to grow out of — and collapse back into — the clicked row.

The modal always uses a forced light-mode palette (overrides `--aff-bg-card`, `--aff-clr-primary`, etc. inline) so it looks consistent regardless of the app's dark/light theme.

---

## 20. Field Error Display

`_showFieldError(input, message)` appends a `.aff-inline-error` div to `document.body`, positioned fixed just below the input element. Removed by `_clearFieldError(input)` on the next valid input or on blur. Animated in with `aff-error-in` keyframe (fade + slide up 4px).

---

## 21. State Integration

The Colors module reads from and writes to the shared `AFF.state` object:

| Path | Usage |
|------|-------|
| `AFF.state.variables` | Source of truth for all variables; updated from AJAX responses |
| `AFF.state.config.categories` | Category list for Colors |
| `AFF.state.currentFile` | Filename for all AJAX write operations |
| `AFF.state.currentSelection` | Cleared when closing the Colors view |
| `AFF.state.pendingCommit` | Set to `true` after any variable save; `false` after commit |

**`AFF.App` integration:**
- `AFF.App.setDirty(true)` — marks unsaved changes after any write
- `AFF.App.setPendingCommit(true)` — enables the Commit button
- `AFF.App.refreshCounts()` — updates the variable count display
- `AFF.App.ajax(action, params)` — returns a Promise for all AJAX calls

**Left panel refresh:** After category add/rename/delete/duplicate, `AFF.PanelLeft.refresh()` is called to keep the nav tree in sync.
