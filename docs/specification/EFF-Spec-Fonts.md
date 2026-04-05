# AFF — Fonts Workpage Specification

**Document:** AFF-Spec-Fonts.md
**Version:** 1.0
**Date:** 2026-03-14
**Scope:** The Fonts edit-space — everything rendered inside `#aff-edit-content` when a Fonts subgroup or category is selected in the left nav.
**Related:** AFF-Spec-Colors.md (template), AFF-Spec-Variables.md §2–5

---

## 1. Overview

The Fonts workpage is a full editing environment for CSS custom property font-family variables. It is one of three variable-set workpages (Colors, Fonts, Numbers) that share a common module factory (`AFF.Variables`, `admin/js/aff-variables.js`). The Fonts instance is initialized with `AFF.Variables.initSet(FONTS_CFG)`.

**Differs from Colors in four ways:**

| Feature | Colors | Fonts |
|---------|--------|-------|
| Col 3 | Color swatch (clickable) | Font preview cell (read-only "Aa") |
| Expand panel | Yes (tints/shades/transparencies) | **No** |
| Formats | HEX HEXA RGB RGBA HSL HSLA | **System Custom** |
| Value display | Monospace | **Renders in its own font-family** |

Everything else — filter bar, category blocks, drag-and-drop, undo/redo, sort, search, collapse/expand, status dots, commit, AJAX layer, CSS architecture — is identical to Colors. Differences are called out explicitly in each section; otherwise assume the Colors behavior applies.

---

## 2. Module Architecture

**File:** `admin/js/aff-variables.js` (shared factory)
**Initialization** (in `aff-app.js`):
```javascript
AFF.Variables.initSet(FONTS_CFG);
```

**Per-set configuration object:**
```javascript
var FONTS_CFG = {
    setName:         'Fonts',
    showExpandPanel: false,
    valueTypes:      ['System', 'Custom'],
    newVarDefaults:  { name: '--new-font', value: 'sans-serif', format: 'System' },
    catKey:          'fontCategories',
    renderPreviewCell: function (v) {
        return '<span class="aff-font-preview" style="font-family:' + esc(v.value) + '">'
             + 'Aa'
             + '</span>';
    },
    renderValueCell: function (v) {
        return '<input class="aff-var-value-input" value="' + esc(v.value) + '"'
             + ' style="font-family:' + esc(v.value) + '">'
             + formatSelect(v.format, this.valueTypes);
    },
};
```

**Routing:** `initSet()` patches `AFF.EditSpace.loadCategory` to intercept calls where `selection.subgroup === 'Fonts'` and delegate to the shared prototype's `loadVars(selection)`.

---

## 3. Data Models

### 3.1 Variable Object

All Fonts variables have `subgroup === 'Fonts'` and `type === 'font'`. Fields identical to Colors (see AFF-Spec-Colors.md §3.1) except:

| Field | Fonts value |
|-------|-------------|
| `subgroup` | `'Fonts'` |
| `type` | `'font'` |
| `format` | `'System'` or `'Custom'` |
| `value` | CSS font-family value, e.g. `'Inter, sans-serif'` |
| `original_value` | Font-family at last Sync |

**Format semantics:**

| Format | Meaning | Example value |
|--------|---------|---------------|
| `System` | A web-safe or OS-bundled font (no external load required) | `Georgia, serif` |
| `Custom` | A loaded custom font (web font, variable font, locally declared `@font-face`) | `'Neue Haas Grotesk', sans-serif` |

The format field is informational (no conversion is performed between formats). It serves as metadata for Commit filtering and future font-load auditing.

### 3.2 Category Object

Identical structure to Colors categories. Stored in `AFF.state.config.fontCategories`.

**Default categories:**
```
Titles    (order: 0, locked: false)
Text      (order: 1, locked: false)
Uncategorized (order: 2, locked: true)
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

The Fonts row uses **7 columns** (no expand button, col 7 absent):

```
grid-template-columns: 24px 8px 15% 1fr 28% 12% 28px;
column-gap: 16px;
```

| Col | Width | Element | Class |
|-----|-------|---------|-------|
| 1 | 24px | Drag handle | `.aff-drag-handle` |
| 2 | 8px | Status dot | `.aff-status-dot` |
| 3 | 15% | Font preview | `.aff-font-preview` |
| 4 | 1fr | Variable name | `.aff-var-name-input` |
| 5 | 28% | Font value | `.aff-var-value-input` |
| 6 | 12% | Format selector | `.aff-var-format-sel` |
| 7 | 28px | Delete button | `.aff-var-delete-btn` |

No expand button column. No expand panel.

### 5.4 Font Preview Cell (Column 3)

A read-only `<span class="aff-font-preview">` that displays the text **"Aa"** rendered in the variable's font-family value as an inline style.

```html
<span class="aff-font-preview" style="font-family: {v.value}">Aa</span>
```

- Height: 32px (matches the color swatch height in Colors)
- Font size: 18px
- Color: `var(--aff-clr-secondary)`
- If the font is not loaded, the fallback will render; no loading indicator is shown
- Not interactive (no click action)

**Tooltip:** `data-aff-tooltip="Font preview"` (no long form needed)

### 5.5 Font Value Input (Column 5)

```html
<input class="aff-var-value-input"
       value="{v.value}"
       style="font-family: {v.value}"
       data-aff-tooltip="Font family — edit directly">
```

The input renders its own content in the font it represents. If the font is unavailable the fallback font is shown; the value text is still correct. The style is updated live on `input` events so the user sees the preview change as they type.

**Validation on save:** Value must be non-empty. No CSS syntax check is applied at the JS layer (CSS font-family syntax is liberal; invalid values simply fail to render in the browser).

### 5.6 Tooltip Attributes on Variable Row Elements

| Element | `data-aff-tooltip` | `data-aff-tooltip-long` |
|---------|-------------------|------------------------|
| Drag handle | "Drag to reorder" | — |
| Status dot | Status name (e.g. "Synced") | Status-specific long text (see §4) |
| Font preview | "Font preview" | — |
| Name input | "Variable name — click to edit" | — |
| Value input | "Font family — edit directly" | "CSS font-family value — changes the font used for this variable" |
| Format selector | "Font type" | "System font (pre-installed) or Custom (web font / @font-face)" |
| Delete button | "Delete variable" | "Remove this variable from the project" |

---

## 6. Inline Editing

### 6.1 Variable Name

Identical to Colors. `<input type="text" readonly>` — single click removes `readonly`. Enforces `--` prefix on `input` events. Saved via `aff_save_color` AJAX (with `subgroup: 'Fonts'`) on `change` / Enter. Invalid name → revert + field error.

### 6.2 Font Value

- `<input type="text">` — always editable; `font-family` inline style mirrors the current value
- **Live preview:** `input` event updates `style.fontFamily` on the input itself and the font preview cell (col 3)
- **Save:** `change` event (blur) or Enter key → `_saveVarValue(varId, value, input)`
- **Validation:** value must be non-empty after `trim()`; empty → revert to `data-original` + field error
- **On save:** AJAX `aff_save_color` with `{id, value, status: 'modified', subgroup: 'Fonts'}`; updates font preview cell and name input in DOM immediately

### 6.3 Format Selector

- `<select>` with two options: `System`, `Custom`
- **On change:** saves immediately via `aff_save_color` with `{id, format: newFormat}`
- No value conversion is performed (font-family strings do not change format)

### 6.4 Category Name

Identical to Colors. `contenteditable` span, single-click to activate, Enter/blur to save, Escape to revert. Saved via `aff_save_category` (with `subgroup: 'Fonts'`).

---

## 7. Expand Panel

**Not present in Fonts.** There is no expand button (col 7 absent from the grid). Clicking the font preview cell (col 3) does not trigger any action.

The `FONTS_CFG.showExpandPanel = false` flag in the module configuration suppresses all expand panel rendering and event binding for this set.

---

## 8. Drag-and-Drop Reordering

Identical to Colors. Drag handle in col 1. Ghost element and drop indicator follow the same implementation. Variables can be dragged within a category or dropped onto a collapsed category (which expands to accept the drop). Saves `order`, `category`, and `category_id` via `aff_save_color`.

---

## 9. Category Operations

Identical to Colors. All six operations (add, rename, delete, duplicate, move-up, move-down) behave identically, routing to `subgroup: 'Fonts'` on the category AJAX endpoints.

**Confirmation on delete:** "N font variable(s) are in this category. Variables will be moved to Uncategorized."

---

## 10. Variable Operations

### 10.1 Add Variable

Add button (circle on bottom-left edge of category block) → AJAX `aff_save_color` with defaults from `FONTS_CFG.newVarDefaults`:

```javascript
{
    name:        '--new-font',
    value:       'sans-serif',
    type:        'font',
    subgroup:    'Fonts',
    category:    catName,
    category_id: catId,
    format:      'System',
    status:      'new',
}
```

### 10.2 Delete Variable

Delete button (col 7, opacity 0 until row hover) → confirmation modal → AJAX `aff_delete_color` with `{variable_id}`. Fonts variables do not have child variables; the `delete_children` parameter is always `false` and the confirmation modal does not mention children.

### 10.3 Move to Category

No expand panel. Category moves are performed via the **Manage Project modal** bulk re-categorization or by future drag-to-category. (A "Move to Category" select within a Fonts row may be added in a later phase; it is not in this version.)

---

## 11. Undo / Redo

Identical to Colors. 50-entry stack. Ctrl+Z / Ctrl+Y. Tracked operation types:

| Type | Fields |
|------|--------|
| `name-change` | `id, oldValue (name), newValue (name)` |
| `value-change` | `id, oldValue (font-family), newValue (font-family)` |

---

## 12. Sort Operations

Identical to Colors. Filter bar sort buttons:

| Button | data-sort | Action |
|--------|-----------|--------|
| A↑ | `fonts-asc` | Sort all font variables A→Z by name |
| A↓ | `fonts-desc` | Sort Z→A |
| C↑ | `cats-asc` | Sort categories A→Z |
| C↓ | `cats-desc` | Sort categories Z→A |

---

## 13. Search / Filter

Identical to Colors. `#aff-fonts-search` input filters rows where `name` or `value` matches the query. Category blocks with all rows hidden are also hidden.

---

## 14. Collapse / Expand

Identical to Colors. Per-category toggle, collapse-all / expand-all, nav-click scroll behavior, and default empty-category collapsed state.

---

## 15. Commit to Elementor

Identical to Colors. Font variables are committed to the Elementor kit CSS via `aff_commit_to_elementor`. The commit payload is `{name, value}` pairs for all non-deleted Fonts variables. PHP replaces `--name: value;` in the kit CSS `:root` block or appends new variables.

After a successful commit, all committed variables have their `status` set to `'synced'` and the status dots update accordingly.

---

## 16. AJAX Endpoints

All endpoints require the `aff_admin_nonce` nonce and `manage_options` capability. Fonts variables use the same endpoints as Colors, distinguished by the `subgroup` field in the variable payload.

| Action | POST params | Description |
|--------|-------------|-------------|
| `aff_save_color` | `filename`, `variable` (JSON with `subgroup:'Fonts'`) | Add or update a font variable |
| `aff_delete_color` | `filename`, `variable_id` | Delete a font variable |
| `aff_save_category` | `filename`, `category` (JSON), `subgroup:'Fonts'` | Add or rename a Fonts category |
| `aff_delete_category` | `filename`, `category_id`, `subgroup:'Fonts'` | Delete a Fonts category |
| `aff_reorder_categories` | `filename`, `ordered_ids` (JSON), `subgroup:'Fonts'` | Reorder Fonts categories |
| `aff_commit_to_elementor` | `filename`, `variables` (JSON) | Write Fonts variables to Elementor kit CSS |

**Category routing:** All category endpoints accept `subgroup` to route to `fontCategories` in the data store.

**Response shape:** Identical to Colors — `{success, data: {id, data: {variables, config}, counts, message}}`.

---

## 17. CSS Classes Reference

Fonts uses a parallel class namespace to Colors. Classes are rendered by the shared `aff-variables.js` module with the set name substituted.

| Class | Element | Description |
|-------|---------|-------------|
| `.aff-fonts-view` | Container div | Flex column |
| `.aff-fonts-filter-bar` | Filter bar | Sticky top |
| `.aff-fonts-search` | Search input | Flex-grow |
| `.aff-fonts-add-cat-btn` | Add category button | Icon button |
| `.aff-font-preview` | Font preview cell | Reads `font-family` from inline style; displays "Aa" |
| `.aff-var-name-input` | Name field | Shared class (all sets); monospace, readonly by default |
| `.aff-var-value-input` | Value field | Shared class; renders content in its own `font-family` for Fonts |
| `.aff-var-format-sel` | Format dropdown | Shared class; two options for Fonts |
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
| `.aff-color-list` | Variable rows container | Shared class (name unchanged from Colors) |
| `.aff-color-row` | One variable row | Shared class; 7-col grid for Fonts |
| `.aff-drop-indicator` | Drop target bar | Shared class |
| `.aff-inline-error` | Field error tooltip | Shared class |

---

## 18. Responsive Breakpoint

At `max-width: 600px`, the format selector column (col 6, 12%) collapses to `0` and the font preview column (col 3) narrows to `10%`:

```css
@media (max-width: 600px) {
    .aff-color-list-header,
    .aff-color-row {
        grid-template-columns: 24px 8px 10% 1fr 24% 0 28px;
        column-gap: 6px;
    }
}
```

---

## 19. State Integration

Identical to Colors. Reads/writes `AFF.state.variables` (filtered to `subgroup === 'Fonts'`), `AFF.state.config.fontCategories`, `AFF.state.currentFile`. Calls `AFF.App.setDirty()`, `AFF.App.setPendingCommit()`, `AFF.App.refreshCounts()`, `AFF.PanelLeft.refresh()` on the same triggers as Colors.

**`_getVarsForSet()`:**
```javascript
return AFF.state.variables.filter(function (v) { return v.subgroup === 'Fonts'; });
```
