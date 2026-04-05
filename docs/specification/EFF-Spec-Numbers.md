# AFF — Numbers Workpage Specification

**Document:** AFF-Spec-Numbers.md
**Version:** 1.0
**Date:** 2026-03-14
**Scope:** The Numbers edit-space — everything rendered inside `#aff-edit-content` when a Numbers subgroup or category is selected in the left nav.
**Related:** AFF-Spec-Colors.md (template), AFF-Spec-Fonts.md, AFF-Spec-Variables.md §2–5

---

## 1. Overview

The Numbers workpage is a full editing environment for CSS custom property numeric variables — sizes, spacings, radii, grid values, and any other dimension or unit-based property. It is one of three variable-set workpages (Colors, Fonts, Numbers) that share a common module factory (`AFF.Variables`, `admin/js/aff-variables.js`). The Numbers instance is initialized with `AFF.Variables.initSet(NUMBERS_CFG)`.

**Differs from Colors in four ways:**

| Feature | Colors | Numbers |
|---------|--------|---------|
| Col 3 | Color swatch (clickable) | **Absent** (6-column grid) |
| Expand panel | Yes (tints/shades/transparencies) | **No** |
| Formats | HEX HEXA RGB RGBA HSL HSLA | **PX % EM REM VW VH CH FX** |
| Value display | Monospace hex/color string | **Monospace numeric string** |

Everything else — filter bar, category blocks, drag-and-drop, undo/redo, sort, search, collapse/expand, status dots, commit, AJAX layer, CSS architecture — is identical to Colors. Differences are called out explicitly in each section; otherwise assume the Colors behavior applies.

---

## 2. Module Architecture

**File:** `admin/js/aff-variables.js` (shared factory)
**Initialization** (in `aff-app.js`):
```javascript
AFF.Variables.initSet(NUMBERS_CFG);
```

**Per-set configuration object:**
```javascript
var NUMBERS_CFG = {
    setName:           'Numbers',
    showExpandPanel:   false,
    valueTypes:        ['PX', '%', 'EM', 'REM', 'VW', 'VH', 'CH', 'FX'],
    newVarDefaults:    { name: '--new-number', value: '1rem', format: 'REM' },
    catKey:            'numberCategories',
    renderPreviewCell: null,  // no preview column for Numbers
    renderValueCell: function (v) {
        return '<input class="aff-var-value-input" value="' + esc(v.value) + '">'
             + formatSelect(v.format, this.valueTypes);
    },
};
```

**Routing:** `initSet()` patches `AFF.EditSpace.loadCategory` to intercept calls where `selection.subgroup === 'Numbers'` and delegate to the shared prototype's `loadVars(selection)`.

---

## 3. Data Models

### 3.1 Variable Object

All Numbers variables have `subgroup === 'Numbers'` and `type === 'number'`. Fields identical to Colors (see AFF-Spec-Colors.md §3.1) except:

| Field | Numbers value |
|-------|--------------|
| `subgroup` | `'Numbers'` |
| `type` | `'number'` |
| `format` | One of: `PX`, `%`, `EM`, `REM`, `VW`, `VH`, `CH`, `FX` |
| `value` | CSS dimension value, e.g. `'1.5rem'`, `'16px'`, `'100%'` |
| `original_value` | Value at last Sync from Elementor |

**Format semantics:**

| Format | CSS unit | Typical use |
|--------|----------|-------------|
| `PX` | `px` | Fixed pixel sizes, border widths, shadows |
| `%` | `%` | Relative widths, percentage-based spacing |
| `EM` | `em` | Font-relative sizing, compound scaling |
| `REM` | `rem` | Root-relative sizing (most common for design tokens) |
| `VW` | `vw` | Viewport-width-relative values |
| `VH` | `vh` | Viewport-height-relative values |
| `CH` | `ch` | Character-width-relative values |
| `FX` | *(none)* | Unitless / raw number (e.g. `1.5` for `line-height`, `0` for resets) |

The format selector allows the user to indicate which unit a variable is intended to use. Changing the format does **not** automatically convert the numeric value (e.g. switching from `PX` to `REM` does not divide by 16). The format field is metadata; the value field is always stored as-is.

### 3.2 Category Object

Identical structure to Colors categories. Stored in `AFF.state.config.numberCategories`.

**Default categories:**
```
Font Size     (order: 0, locked: false)
Line Height   (order: 1, locked: false)
Spacing       (order: 2, locked: false)
Gaps          (order: 3, locked: false)
Grids         (order: 4, locked: false)
Radius        (order: 5, locked: false)
Uncategorized (order: 6, locked: true)
```

---

## 4. Status Dot

Identical to Colors (AFF-Spec-Colors.md §4). Same four statuses, same colors, same tooltip text. The status dot occupies column 2 (8px circle) of every variable row.

| Status | Color | Short tooltip | Long tooltip |
|--------|-------|---------------|--------------|
| `synced` | `#059669` | "Synced" | "Value matches Elementor — no changes pending" |
| `modified` | `#f4c542` | "Modified" | "Value has changed since last Sync — commit to push to Elementor" |
| `new` | `#3b82f6` | "New" | "New variable — not yet in Elementor CSS; commit to add it" |
| `deleted` | `#dc2626` | "Deleted" | "Marked for deletion — will be removed from Elementor on next commit" |

---

## 5. UI Layout

### 5.1 Filter Bar (sticky)

Identical to Colors. One row:

```
[+ cat] ───────── [search        ] [A↑] [A↓] [C↑] [C↓] [✕] [⊞]
```

### 5.2 Category Blocks

Identical to Colors. Two-row header (name + count + actions; add-variable circle button on bottom-left edge). Collapse/expand behavior identical.

### 5.3 Variable Row Grid

The Numbers row uses **6 columns** — no preview cell (col 3 absent), no expand button (col 7 absent):

```
grid-template-columns: 24px 8px 1fr 28% 12% 28px;
column-gap: 16px;
```

| Col | Width | Element | Class |
|-----|-------|---------|-------|
| 1 | 24px | Drag handle | `.aff-drag-handle` |
| 2 | 8px | Status dot | `.aff-status-dot` |
| 3 | 1fr | Variable name | `.aff-var-name-input` |
| 4 | 28% | Numeric value | `.aff-var-value-input` |
| 5 | 12% | Format selector | `.aff-var-format-sel` |
| 6 | 28px | Delete button | `.aff-var-delete-btn` |

No preview column. No expand button. The name column (col 3) is wider than in Colors and Fonts because the 15% preview column is not present.

### 5.4 Numeric Value Input (Column 4)

```html
<input class="aff-var-value-input"
       value="{v.value}"
       data-aff-tooltip="Numeric value — edit directly"
       spellcheck="false">
```

Rendered in monospace (same as Colors name/value inputs). The value is stored as a CSS dimension string including the unit (e.g. `'1.5rem'`, `'16px'`). The format selector (col 5) reflects the unit category but does not dictate value format.

**Live guard:** `input` event does not enforce any prefix (unlike Colors which enforces `--`). The value is saved as-is; validation on blur checks for non-empty.

### 5.5 Tooltip Attributes on Variable Row Elements

| Element | `data-aff-tooltip` | `data-aff-tooltip-long` |
|---------|-------------------|------------------------|
| Drag handle | "Drag to reorder" | — |
| Status dot | Status name (e.g. "Synced") | Status-specific long text (see §4) |
| Name input | "Variable name — click to edit" | — |
| Value input | "Numeric value — edit directly" | "CSS dimension value — include the unit (e.g. 1.5rem, 16px)" |
| Format selector | "Unit type" | "Indicates which CSS unit this variable uses (does not convert the value)" |
| Delete button | "Delete variable" | "Remove this variable from the project" |

---

## 6. Inline Editing

### 6.1 Variable Name

Identical to Colors and Fonts. `<input type="text" readonly>` — single click removes `readonly`. Enforces `--` prefix on `input` events. Saved via `aff_save_color` AJAX (with `subgroup: 'Numbers'`) on `change` / Enter. Invalid name → revert + field error.

### 6.2 Numeric Value

- `<input type="text">` — always editable, monospace
- **Save:** `change` event (blur) or Enter key → `_saveVarValue(varId, value, input)`
- **Validation:** value must be non-empty after `trim()`; empty → revert to `data-original` + field error. No unit syntax validation is applied at the JS layer — CSS dimension syntax is validated by the browser when the value is applied to Elementor
- **On save:** AJAX `aff_save_color` with `{id, value, status: 'modified', subgroup: 'Numbers'}`; updates the DOM input `data-original` on success

No live preview cell to update (no col 3 for Numbers).

### 6.3 Format Selector

- `<select>` with options: `PX`, `%`, `EM`, `REM`, `VW`, `VH`, `CH`, `FX`
- **On change:** saves immediately via `aff_save_color` with `{id, format: newFormat}`
- No value conversion is performed. The format is informational metadata only
- UI hint: the selected format can serve as a reminder to the user of the intended unit, even if the stored value string includes a different unit

### 6.4 Category Name

Identical to Colors and Fonts. `contenteditable` span, single-click to activate, Enter/blur to save, Escape to revert. Saved via `aff_save_category` (with `subgroup: 'Numbers'`).

---

## 7. Expand Panel

**Not present in Numbers.** There is no expand button. No palette generator. No child variable generation.

The `NUMBERS_CFG.showExpandPanel = false` flag in the module configuration suppresses all expand panel rendering and event binding for this set.

---

## 8. Drag-and-Drop Reordering

Identical to Colors. Drag handle in col 1. Ghost element and drop indicator follow the same implementation. Variables can be dragged within a category or dropped onto a collapsed category (which expands to accept the drop). Saves `order`, `category`, and `category_id` via `aff_save_color`.

---

## 9. Category Operations

Identical to Colors. All six operations (add, rename, delete, duplicate, move-up, move-down) behave identically, routing to `subgroup: 'Numbers'` on the category AJAX endpoints.

**Confirmation on delete:** "N number variable(s) are in this category. Variables will be moved to Uncategorized."

---

## 10. Variable Operations

### 10.1 Add Variable

Add button (circle on bottom-left edge of category block) → AJAX `aff_save_color` with defaults from `NUMBERS_CFG.newVarDefaults`:

```javascript
{
    name:        '--new-number',
    value:       '1rem',
    type:        'number',
    subgroup:    'Numbers',
    category:    catName,
    category_id: catId,
    format:      'REM',
    status:      'new',
}
```

### 10.2 Delete Variable

Delete button (col 6, opacity 0 until row hover) → confirmation modal → AJAX `aff_delete_color` with `{variable_id}`. Numbers variables do not have child variables; the `delete_children` parameter is always `false` and the confirmation modal does not mention children.

### 10.3 Move to Category

No expand panel. Category moves will be added in a later phase.

---

## 11. Undo / Redo

Identical to Colors. 50-entry stack. Ctrl+Z / Ctrl+Y. Tracked operation types:

| Type | Fields |
|------|--------|
| `name-change` | `id, oldValue (name), newValue (name)` |
| `value-change` | `id, oldValue (dimension), newValue (dimension)` |

---

## 12. Sort Operations

Identical to Colors. Filter bar sort buttons:

| Button | data-sort | Action |
|--------|-----------|--------|
| A↑ | `numbers-asc` | Sort all number variables A→Z by name |
| A↓ | `numbers-desc` | Sort Z→A |
| C↑ | `cats-asc` | Sort categories A→Z |
| C↓ | `cats-desc` | Sort categories Z→A |

Numeric value sorting (small→large, large→small) is a planned future enhancement.

---

## 13. Search / Filter

Identical to Colors. `#aff-numbers-search` input filters rows where `name` or `value` matches the query. Category blocks with all rows hidden are also hidden.

---

## 14. Collapse / Expand

Identical to Colors. Per-category toggle, collapse-all / expand-all, nav-click scroll behavior, and default empty-category collapsed state.

---

## 15. Commit to Elementor

Identical to Colors. Number variables are committed to the Elementor kit CSS via `aff_commit_to_elementor`. The commit payload is `{name, value}` pairs for all non-deleted Numbers variables. PHP replaces `--name: value;` in the kit CSS `:root` block or appends new variables.

After a successful commit, all committed variables have their `status` set to `'synced'` and the status dots update accordingly.

---

## 16. AJAX Endpoints

All endpoints require the `aff_admin_nonce` nonce and `manage_options` capability. Numbers variables use the same endpoints as Colors and Fonts, distinguished by the `subgroup` field in the variable payload.

| Action | POST params | Description |
|--------|-------------|-------------|
| `aff_save_color` | `filename`, `variable` (JSON with `subgroup:'Numbers'`) | Add or update a number variable |
| `aff_delete_color` | `filename`, `variable_id` | Delete a number variable |
| `aff_save_category` | `filename`, `category` (JSON), `subgroup:'Numbers'` | Add or rename a Numbers category |
| `aff_delete_category` | `filename`, `category_id`, `subgroup:'Numbers'` | Delete a Numbers category |
| `aff_reorder_categories` | `filename`, `ordered_ids` (JSON), `subgroup:'Numbers'` | Reorder Numbers categories |
| `aff_commit_to_elementor` | `filename`, `variables` (JSON) | Write Numbers variables to Elementor kit CSS |

**Category routing:** All category endpoints accept `subgroup` to route to `numberCategories` in the data store.

**Response shape:** Identical to Colors — `{success, data: {id, data: {variables, config}, counts, message}}`.

---

## 17. CSS Classes Reference

Numbers uses the same shared class namespace as Fonts. The 6-column grid is unique to Numbers.

| Class | Element | Description |
|-------|---------|-------------|
| `.aff-numbers-view` | Container div | Flex column |
| `.aff-numbers-filter-bar` | Filter bar | Sticky top |
| `.aff-numbers-search` | Search input | Flex-grow |
| `.aff-numbers-add-cat-btn` | Add category button | Icon button |
| `.aff-var-name-input` | Name field | Shared class; monospace, readonly by default |
| `.aff-var-value-input` | Value field | Shared class; monospace, always editable |
| `.aff-var-format-sel` | Format dropdown | Shared class; 8 unit options for Numbers |
| `.aff-var-delete-btn` | Delete button | Shared class; hidden until row hover |
| `.aff-status-dot` | Status indicator | Shared class; 8px circle |
| `.aff-drag-handle` | Drag trigger | Shared class |
| `.aff-category-block` | One category | Shared class |
| `.aff-category-inner` | Inner clip wrapper | Shared class |
| `.aff-category-header` | Header container | Shared class |
| `.aff-category-name-input` | Category name span | Shared class |
| `.aff-category-count` | Count badge | Shared class |
| `.aff-category-actions` | Action button group | Shared class |
| `.aff-cat-add-btn-wrap` | Add-var button wrapper | Shared class |
| `.aff-color-list` | Variable rows container | Shared class |
| `.aff-color-row` | One variable row | Shared class; **6-col grid** for Numbers |
| `.aff-drop-indicator` | Drop target bar | Shared class |
| `.aff-inline-error` | Field error tooltip | Shared class |

**Grid override for Numbers:**
```css
.aff-numbers-view .aff-color-list-header,
.aff-numbers-view .aff-color-row {
    grid-template-columns: 24px 8px 1fr 28% 12% 28px;
}
```

---

## 18. Responsive Breakpoint

At `max-width: 600px`, the format selector column (col 5) collapses to `0` and the value column (col 4) narrows:

```css
@media (max-width: 600px) {
    .aff-numbers-view .aff-color-list-header,
    .aff-numbers-view .aff-color-row {
        grid-template-columns: 24px 8px 1fr 28% 0 28px;
        column-gap: 6px;
    }
}
```

---

## 19. State Integration

Identical to Colors and Fonts. Reads/writes `AFF.state.variables` (filtered to `subgroup === 'Numbers'`), `AFF.state.config.numberCategories`, `AFF.state.currentFile`. Calls `AFF.App.setDirty()`, `AFF.App.setPendingCommit()`, `AFF.App.refreshCounts()`, `AFF.PanelLeft.refresh()` on the same triggers as Colors.

**`_getVarsForSet()`:**
```javascript
return AFF.state.variables.filter(function (v) { return v.subgroup === 'Numbers'; });
```

---

## 20. Differences Summary (vs Colors)

| Area | Colors | Fonts | Numbers |
|------|--------|-------|---------|
| Grid columns | 8 | 7 | **6** |
| Col 3 | Color swatch | Font preview "Aa" | **Absent** |
| Col 7 | Expand button | Absent | **Absent** |
| Expand panel | Yes | No | **No** |
| Formats | 6 color formats | 2 type tags | **8 unit codes** |
| Value conversion | Yes (hex↔rgb↔hsl) | No | **No** |
| Live preview | Swatch + row swatch update | Font-family on input | **None** |
| Child variables | Yes (tints/shades/alpha) | No | **No** |
| New var defaults | `--new-color` / `#000000` / HEX | `--new-font` / `sans-serif` / System | **`--new-number` / `1rem` / REM** |
| Default categories | Branding, Backgrounds, Neutral, Status | Titles, Text | **Font Size, Line Height, Spacing, Gaps, Grids, Radius** |
| Config key | `colorCategories` | `fontCategories` | **`numberCategories`** |
| `subgroup` value | `'Colors'` | `'Fonts'` | **`'Numbers'`** |
| `type` value | `'color'` | `'font'` | **`'number'`** |
