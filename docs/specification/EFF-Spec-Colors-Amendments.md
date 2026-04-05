# AFF Spec Colors — Amendments

**Date:** 2026-03-09
**Amends:** AFF-Spec-Colors.docx
**Author:** Jim Roberts / Jim R Forge

This file records amendments to the Colors specification that supersede the base `.docx` file.
See `AFF-Spec-Changelog.docx` for the master change log.

---

## Amendment 1 — Tint/Shade/Transparency Naming Convention (2026-03-09)

### Previous naming (superseded)
| Type | Pattern | Example |
|---|---|---|
| Tints | `--name-plus-NNN` | `--primary-plus-300` |
| Shades | `--name-minus-NNN` | `--primary-minus-300` |
| Transparencies | `--name-NNN` | `--primary-050` |

Steps were fixed: 0, 3-step (300/600/900), or 9-step (100–900).

### New naming (current — §15.7 replacement)

#### Tints (lighter — upshift toward white)
- **User display:** `{ColorName}-{step×10}` — e.g., `Primary-10`, `Primary-20`, `Primary-30`
- **CSS custom property:** `--{varname}-{step×10}` — e.g., `--aff-color-brand-primary-10`
- **Steps:** User-configurable 0–10. Each step interpolates lightness equally toward 100%.
  - Step *i* of *N*: `L_i = L + (100 − L) × i/N` (clamped to 98% max)
  - For N=3: step 1 = 1/3 of way to white, step 2 = 2/3, step 3 = full endpoint

#### Shades (darker — downshift toward black)
- **User display:** `{ColorName}+{step×10}` — e.g., `Primary+10`, `Primary+20`, `Primary+30`
- **CSS custom property:** `--{varname}-plus-{step×10}` — e.g., `--aff-color-brand-primary-plus-10`
  (The `+` is encoded as `-plus-` because `+` is not valid in CSS custom property names)
- **Steps:** User-configurable 0–10. Each step interpolates lightness equally toward 0%.
  - Step *i* of *N*: `L_i = L × (1 − i/N)` (clamped to 2% min)

#### Transparencies (alpha channel steps — fixed 9 levels)
- **User display:** `{ColorName}{step×10}` — e.g., `Primary10`, `Primary20`, … `Primary90`
- **CSS custom property:** `--{varname}{step×10}` — e.g., `--aff-color-brand-primary10`
  (No separator between variable name and number)
- **Steps:** Always 9 fixed steps when enabled. Alpha = step/10 (0.1 to 0.9).
  - `Primary10` → alpha 0.1 (10% opacity)
  - `Primary90` → alpha 0.9 (90% opacity)
- **Format:** Always stored as HEXA (`#rrggbbaa`)
- **Toggle:** On/Off only (not a step count). When On: generates all 9 levels.

### UI Controls (expand panel — supersedes previous 3-zone layout)

The expand panel below each color variable row has three equal zones:

| Zone | Control | Behavior |
|---|---|---|
| Tints | `<input type="number" min="0" max="10">` | Live preview bars generated on input; AJAX save debounced 600ms |
| Shades | `<input type="number" min="0" max="10">` | Same as tints |
| Transparencies | On/Off toggle (`<input type="checkbox">`) | Live preview of all 9 steps when On; AJAX save on toggle |

**Removed from expand panel:** Color Picker (Zone 3), Generate button.

### Preview Bars

Each tint/shade/transparency step is displayed as a full-width colored bar with:
- Swatch bar (full available width, 20px height)
- Variable name label (e.g., `primary-10`)
- Percentage indicator (e.g., `+33%` for tints, `-33%` for shades, `10%α` for transparencies)

### Import / Export / Sync Considerations

The `.aff.json` file stores generated child variables with `parent_id` set to the parent variable's UUID. During sync:
- Children are identified by `parent_id !== null`
- Tint children: name matches `/-\d+$/` and does not contain `-plus-`
- Shade children: name matches `/-plus-\d+$/`
- Transparency children: name matches `/\d+$/` and does not contain `-plus-` or `-{number}$` pattern (no hyphen before number)

When exporting design system data (AFF-Spec-Sync), child variables are included in the export with their `parent_id` preserved so the relationship can be reconstructed on import.

When syncing from Elementor: child variables are not present in Elementor's compiled CSS (they exist only in the AFF data store) and will appear as `orphaned` status after a sync. This is expected — commit them to Elementor to push child variables into the Elementor kit.

---

## Amendment 2 — Session 4 Bug Fixes (2026-03-14)

### A2.1 — Cross-category drag/drop into empty categories

**File:** `admin/js/aff-colors.js`

Variables can now be dragged into expanded categories that contain no variables. When the
drag cursor enters an empty expanded category (detected via `elementFromPoint`), the drop
indicator is displayed at the vertical midpoint of the `.aff-color-list` container. On
drop, a sentinel value `__empty-cat__` triggers a special path in `_dropVariable()` that
reassigns the dragged variable's `category`, `category_id`, and `order` to the target
category without requiring a target variable row.

The indicator-hide guard was updated to only hide when the cursor is not over any
`.aff-category-block`, preventing premature hide when moving between the category header
and the empty list area.

### A2.2 — Commit to Elementor V4

**File:** `includes/class-aff-ajax-handler.php`

The commit action was rewritten to correctly target the user-defined `:root` block rather
than blindly inserting at the last `}` position.

- `do_action('elementor/css-file/clear-cache')` is no longer called. Calling it caused
  Elementor to regenerate CSS from its database, overwriting AFF's writes.
- A new private helper `find_user_root_close_pos()` scans all `:root` blocks, identifies
  the user-variables block (the one containing no system prefixes such as `--e-global-`,
  `--e-a-`, `--e-one-`, `--e-context-`, `--e-button-`, `--kit-`), and returns the
  position of its closing `}`. If no user block is found, a new `:root` block is appended.

### A2.3 — Expand modal close button

**File:** `admin/css/aff-colors.css`

The close button (`×`) on the Tints/Shades/Transparencies expand modal was restyled:
- `background: none; border: none` — no fill or stroke
- `font-size: 22px; font-weight: 700` — large, bold ×
- `opacity: 0.7` default, `opacity: 1` on hover
- Color inherits from `--aff-clr-secondary` (hardcoded fallback for expand modal since
  it is appended to `document.body`, outside `.aff-app` where CSS variables are defined)

### A2.4 — Manage Project modal — Colors category editor

**File:** `admin/js/aff-panel-top.js`

The Manage Project modal now includes a "Colors categories" section below the subgroup
editors. Each row in `AFF.state.config.categories` is shown as an editable input with a
Delete button. Locked categories (Uncategorized) show a "locked" badge and a disabled
input. The "+ Add category" button appends a new editable row. On Save:
- Category rows are read from the DOM into a `newCats` array
- `Uncategorized` is guaranteed to be present and locked at the end
- Config is saved via `aff_save_config`; `AFF.state.config.categories` is updated
- Colors view is re-rendered if currently active

### A2.5 — Tooltip system

**File:** `admin/js/aff-panel-top.js`

- `_bindTooltips()` now uses delegated `mouseover`/`mouseout`/`focusin`/`focusout`
  listeners on `document`, replacing per-element `querySelector.forEach` binding.
  This covers dynamically created elements (variable rows, category buttons) automatically.
- `AFF.PanelTop._showTooltips` (default `true`) and `AFF.PanelTop._extendedTooltips`
  (default `false`) control tooltip visibility and long-form text, respectively.
- When `_extendedTooltips` is `true`, `_showTooltip()` prefers `data-aff-tooltip-long`
  over `data-aff-tooltip` if the long attribute is present.
- Both settings are persisted via `aff_save_settings` (`show_tooltips` / `extended_tooltips`).
- The Preferences modal has two new checkboxes to toggle these settings live.
- All top-bar buttons, right-panel buttons, and dynamic category/variable row buttons now
  carry `data-aff-tooltip` attributes. Key buttons also carry `data-aff-tooltip-long`.

---

*End of AFF-Spec-Colors-Amendments.md*
*© Jim Roberts / Jim R Forge — jimrforge.com*
