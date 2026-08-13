# Multi-Tiered Categories — Design Specification

**Plugin:** Atomic Framework Forge for Elementor (ATFRFO)
**Spec version:** 1.0
**Date:** 2026-04-19
**Status:** Pre-implementation — pending developer decisions in §8

---

## 1. Current State Summary

### 1.1 JSON Data Model (flat)

The project file is a `.atfrfo.json` document. The relevant portions are:

```json
{
  "version": "1.0",
  "config": {
    "categories": [
      { "id": "uuid-1", "name": "Status",  "order": 0, "locked": false },
      { "id": "uuid-2", "name": "Branding","order": 1, "locked": false },
      { "id": "uuid-3", "name": "Uncategorized", "order": 99, "locked": true }
    ],
    "fontCategories":   [ ... same shape ... ],
    "numberCategories": [ ... same shape ... ]
  },
  "variables": [
    {
      "id":             "uuid-v1",
      "name":           "--status-stop-10",
      "value":          "#d32f2f",
      "type":           "color",
      "subgroup":       "Colors",
      "category":       "Status",
      "category_id":    "uuid-1",
      "order":          0,
      "status":         "synced",
      "format":         "HEX",
      "parent_id":      null,
      ...
    }
  ]
}
```

**Category object fields** (defined in `category_defaults()`, line 869):

| Field    | Type    | Description                      |
|----------|---------|----------------------------------|
| `id`     | string  | UUID v4                          |
| `name`   | string  | Display name                     |
| `order`  | int     | Sort position (0-based)          |
| `locked` | bool    | If true, cannot be deleted; used for Uncategorized |

**Variable object fields** (defined in `variable_defaults()`, line 839):

| Field                | Type        | Description                                              |
|----------------------|-------------|----------------------------------------------------------|
| `id`                 | string      | UUID v4                                                  |
| `name`               | string      | CSS custom property name (without `--` prefix in storage)|
| `value`              | string      | Current value                                            |
| `category`           | string      | Category name (legacy fallback)                          |
| `category_id`        | string      | Category UUID (primary key)                              |
| `parent_id`          | string|null  | UUID of a parent color variable (tints/shades only)      |
| `type`               | string      | `color`, `font`, `number`                                |
| `subgroup`           | string      | `Colors`, `Fonts`, `Numbers`                             |
| `order`              | int         | Position within its category                             |

Note: `parent_id` already exists but is used exclusively for tint/shade child variables (the color-picker expansion system), not for category hierarchy.

### 1.2 PHP Storage Layer

**File:** `includes/class-atfrfo-data-store.php`

Categories are stored in `$this->data['config']` under subgroup-specific keys:

- Colors → `config.categories`
- Fonts → `config.fontCategories`
- Numbers → `config.numberCategories`

The `subgroup_to_cat_key()` method (line 343) maps subgroup name to key. All category CRUD operates on these flat arrays. The variables flat array in `$this->data['variables']` stores every variable across all subgroups.

**CRUD methods:**

| Method                                | Purpose                                  |
|---------------------------------------|------------------------------------------|
| `get_categories_for_subgroup()`       | Return sorted category array             |
| `add_category_for_subgroup()`         | Append category, generate UUID           |
| `update_category_for_subgroup()`      | Rename category by ID                    |
| `delete_category_for_subgroup()`      | Delete with variable reassignment logic  |
| `reorder_categories_for_subgroup()`   | Apply new sort order                     |
| `add_variable()`                      | Append variable with UUID                |
| `update_variable()`                   | Patch variable fields by ID              |
| `delete_variable()`                   | Remove variable; optionally cascade children |

`delete_category_for_subgroup()` (line 428): when `$delete_vars = false`, it clears `category_id` and `category` on orphaned variables so they appear under Uncategorized. When `$delete_vars = true` it hard-deletes them.

### 1.3 JavaScript Rendering Layer

**File:** `admin/js/atfrfo-variables.js` (Fonts and Numbers; Colors is in `atfrfo-colors.js` with the same structural pattern)

**Key state helpers:**

- `_getCatsForSet()` (line 1498): reads `ATFRFO.state.config[catKey]` and returns a sorted array of category objects.
- `_getVarsForCategory(cat)` (line 1457): filters `ATFRFO.state.variables` by `category_id` matching `cat.id` (primary) or `category` matching `cat.name` (legacy fallback). The Uncategorized branch catches orphaned variables. Returns variables sorted by `order`.
- `_buildCategoryBlock(cat, ...)` (line 250): emits the HTML for one category block (header + column-sort row + variable rows + add-variable button).
- `_buildVariableRow(v)` (line 364): emits the HTML for one variable row inside a category block.

**Rendering flow:**

1. `loadVars()` → `_ensureUncategorized()` → `_renderAll()`
2. `_renderAll()` loops over `_getCatsForSet()` and calls `_buildCategoryBlock()` for each
3. `_buildCategoryBlock()` calls `_getVarsForCategory(cat)` and calls `_buildVariableRow()` for each variable

**Category operations in `ATFRFO.CatMixin`** (defined in `atfrfo-app.js`, line 424, mixed into both `ATFRFO.Colors` and `ATFRFO.Variables._proto`):

- `_addCategory()`: opens a modal, POSTs to `atfrfo_save_category`, appends new category to `ATFRFO.state.config[catKey]`, re-renders.
- `_saveCategoryName()`: fires on contenteditable `focusout`, POSTs to `atfrfo_save_category` with existing ID.
- `_deleteCategory()`: opens confirmation modal with iOS toggle (delete vs. move to Uncategorized), POSTs to `atfrfo_delete_category`.
- `_duplicateCategory()`: creates a copy category via `atfrfo_save_category`, then iterates its variables and saves each via `atfrfo_save_color`.

### 1.4 AJAX Endpoints (CRUD flow)

All endpoints are registered in `class-atfrfo-ajax-handler.php`:

- `atfrfo_save_category` — add or rename (identified by presence of `id` in payload)
- `atfrfo_delete_category` — delete with `delete_vars` flag
- `atfrfo_reorder_categories` — persist new `order` values
- `atfrfo_save_color` — add or update a variable (any type, despite the name)
- `atfrfo_delete_color` — delete a variable

The `with_store()` helper (line 1543) wraps all category/variable endpoints: it loads the `.atfrfo.json` file, runs the callback, saves, and sends JSON success or error.

---

## 2. Requirements

### 2.1 Functional Requirements

1. **Variables may live directly in a category OR in a named sub-category.** A category with no sub-categories (current behavior) must continue to work unchanged.

2. **Sub-categories may themselves contain sub-categories.** The minimum required nesting depth is 2 (Category → Sub-category → Variable). The Shadow example requires 2 levels (Shadow → Offset → Inner/Outer variables, alongside Shadow → Spread and Shadow → Blur at level 1). A 3-level limit (Category → Sub-category → Sub-sub-category → Variable) is sufficient and should be treated as the maximum.

3. **Mixed population is required.** A category may contain both direct variables and one or more sub-categories simultaneously. Example: Status has 3 direct colors (for disabled states) alongside Stop, Warning, and Success sub-categories.

4. **The feature applies to all three subgroups:** Colors, Fonts, Numbers.

5. **Backwards compatibility is mandatory.** All existing flat `.atfrfo.json` files must load and behave identically. No migration of existing files is required at load time; old structure is valid.

6. **Sub-categories must support the same CRUD operations as top-level categories:** add, rename, delete (with variable reassignment), reorder within their parent, collapse/expand.

7. **Variables within a sub-category must support drag-and-drop reorder** and must be moveable between sub-categories or up to the parent category.

### 2.2 Design Constraints

- The CSS custom property names of variables are not affected by category structure. A variable named `--status-stop-10` remains named exactly that regardless of whether it lives in Status, Status > Stop, or anywhere else.
- The `parent_id` field on variables currently means "I am a tint/shade child of this color variable." This semantic must not be conflated with sub-category membership.
- The existing `atfrfo_save_color` endpoint is already the universal variable save endpoint (Colors, Fonts, Numbers). It must be extended, not replaced.

---

## 3. Proposed Data Model

### 3.1 Evaluation: Path Array vs. Parent ID

**Option A — Path array on the variable:**

```json
{ "category_path": ["Status", "Stop"] }
```

- Pro: human-readable, easy to debug JSON directly.
- Con: names are not stable — a category rename must update every variable in that branch. The current codebase already has rename-propagation bugs for the simpler `category` name field (see `_saveCategoryName` in `atfrfo-app.js` which manually patches variables). Paths would amplify this technical debt. Adds complexity to the migration path for orphaned variables.

**Option B — Parent ID on the sub-category (recommended):**

Sub-categories are stored in the same flat category array but carry a `parent_id` field pointing to their parent category's UUID. Variables point to the nearest containing category or sub-category by ID, exactly as they do today.

- Pro: renames do not require variable updates; variables always point to the correct entity by UUID. Consistent with how variables already reference categories.
- Pro: backwards compatible — existing category objects have no `parent_id` field (treated as `null`, meaning top-level).
- Pro: the query "give me all direct children of category X" is a single filter on the category list.
- Con: requires a tree-building step at render time to reconstruct the hierarchy from the flat array.

**Recommendation: Option B.** The `parent_id` field on categories directly mirrors the variable-to-category relationship and avoids the rename-propagation problem that already causes bugs with the string `category` field.

### 3.2 Revised Category Object

```json
{
  "id":        "uuid-cat",
  "name":      "Stop",
  "order":     0,
  "locked":    false,
  "parent_id": "uuid-status-cat"
}
```

New field: `parent_id` (string | null). Null or absent = top-level category (backwards compatible).

The `category_defaults()` method gains one new field:

```php
'parent_id' => null,
```

### 3.3 Variable Object — No Changes Required

Variables continue to store `category_id` pointing to whichever category or sub-category directly contains them. No new fields are needed on the variable object.

### 3.4 Concrete JSON Example: Status Scenario

Status has 3 direct colors + 3 sub-categories (Stop, Warning, Success) each with 11 colors.

```json
"config": {
  "categories": [
    { "id": "cat-status",   "name": "Status",  "order": 0, "locked": false, "parent_id": null },
    { "id": "cat-stop",     "name": "Stop",    "order": 0, "locked": false, "parent_id": "cat-status" },
    { "id": "cat-warning",  "name": "Warning", "order": 1, "locked": false, "parent_id": "cat-status" },
    { "id": "cat-success",  "name": "Success", "order": 2, "locked": false, "parent_id": "cat-status" },
    { "id": "cat-uncat",    "name": "Uncategorized", "order": 99, "locked": true, "parent_id": null }
  ]
},
"variables": [
  { "id": "v1", "name": "--status-disabled-bg",   "category_id": "cat-status", ... },
  { "id": "v2", "name": "--status-disabled-text",  "category_id": "cat-status", ... },
  { "id": "v3", "name": "--status-disabled-border","category_id": "cat-status", ... },
  { "id": "v4", "name": "--status-stop-10",  "category_id": "cat-stop", ... },
  ...11 stop colors...,
  { "id": "v15", "name": "--status-warning-10", "category_id": "cat-warning", ... },
  ...11 warning colors...,
  { "id": "v26", "name": "--status-success-10", "category_id": "cat-success", ... },
  ...11 success colors...
]
```

### 3.5 Concrete JSON Example: Shadow Scenario (2-level nesting)

Shadow > Offset has Inner and Outer as sub-sub-categories. Spread and Blur are direct variables of Shadow.

```json
"config": {
  "numberCategories": [
    { "id": "cat-shadow",        "name": "Shadow", "order": 0, "locked": false, "parent_id": null },
    { "id": "cat-shadow-offset", "name": "Offset", "order": 2, "locked": false, "parent_id": "cat-shadow" },
    { "id": "cat-offset-inner",  "name": "Inner",  "order": 0, "locked": false, "parent_id": "cat-shadow-offset" },
    { "id": "cat-offset-outer",  "name": "Outer",  "order": 1, "locked": false, "parent_id": "cat-shadow-offset" }
  ]
},
"variables": [
  { "id": "v1", "name": "--shadow-spread", "category_id": "cat-shadow", ... },
  { "id": "v2", "name": "--shadow-blur",   "category_id": "cat-shadow", ... },
  { "id": "v3", "name": "--shadow-offset-inner-x", "category_id": "cat-offset-inner", ... },
  { "id": "v4", "name": "--shadow-offset-inner-y", "category_id": "cat-offset-inner", ... },
  { "id": "v5", "name": "--shadow-offset-outer-x", "category_id": "cat-offset-outer", ... },
  { "id": "v6", "name": "--shadow-offset-outer-y", "category_id": "cat-offset-outer", ... }
]
```

---

## 4. PHP Layer Changes

### 4.1 `category_defaults()` — Add `parent_id`

```php
private function category_defaults(): array
{
    return array(
        'id'        => '',
        'name'      => '',
        'order'     => 0,
        'locked'    => false,
        'parent_id' => null,   // NEW — null = top-level category
    );
}
```

### 4.2 `migrate_data()` — Backfill `parent_id` on Load

In the `migrate_data()` method (line 759), add a pass over the config category arrays:

```php
foreach (['categories', 'fontCategories', 'numberCategories'] as $catKey) {
    if (!isset($data['config'][$catKey]) || !is_array($data['config'][$catKey])) {
        continue;
    }
    foreach ($data['config'][$catKey] as &$cat) {
        if (!array_key_exists('parent_id', $cat)) {
            $cat['parent_id'] = null;
        }
    }
    unset($cat);
}
```

This is idempotent and safe on already-migrated data.

### 4.3 `add_category_for_subgroup()` — Accept `parent_id`

The method signature and body need no change. The caller already passes an array that gets merged with `category_defaults()`. The AJAX handler must pass `parent_id` when received from the client:

```php
$id = $store->add_category_for_subgroup($subgroup, array(
    'name'      => $name,
    'parent_id' => $parent_id,   // NEW — may be null for top-level
));
```

### 4.4 `ajax_aff_save_category()` — Accept `parent_id`

In `ATFRFO_Ajax_Handler::ajax_aff_save_category()` (line 627):

```php
$parent_id = isset($category['parent_id'])
    ? sanitize_text_field($category['parent_id'])
    : null;

// Validate parent_id references a real category in the same subgroup.
if (!empty($parent_id)) {
    $existing_ids = array_column($store->get_categories_for_subgroup($subgroup), 'id');
    if (!in_array($parent_id, $existing_ids, true)) {
        throw new \Exception(__('Parent category not found.', 'atomic-framework-forge-for-elementor'));
    }
}
```

Pass `parent_id` to `add_category_for_subgroup()`. On update, `parent_id` changes are allowed (this is the "move sub-category" operation) unless doing so would create a cycle.

### 4.5 New: Cycle-Detection Guard

When updating a category's `parent_id`, the PHP layer must refuse any assignment that would create a cycle (a category becoming its own ancestor). Add a private helper:

```php
/**
 * Return true if making $child_id a child of $proposed_parent_id
 * would create a cycle in the category tree.
 *
 * @param string   $subgroup
 * @param string   $child_id
 * @param string   $proposed_parent_id
 * @return bool
 */
private function would_create_cycle(string $subgroup, string $child_id, string $proposed_parent_id): bool
{
    $cats      = $this->get_categories_for_subgroup($subgroup);
    $parent_map = [];
    foreach ($cats as $c) {
        $parent_map[$c['id']] = $c['parent_id'] ?? null;
    }
    // Walk up from proposed_parent_id; if we reach child_id, it's a cycle.
    $current = $proposed_parent_id;
    while ($current !== null) {
        if ($current === $child_id) { return true; }
        $current = $parent_map[$current] ?? null;
    }
    return false;
}
```

### 4.6 New: `delete_category_for_subgroup()` — Cascade Sub-categories

When a category is deleted, its sub-categories must also be deleted (or their variables reassigned), recursively. Extend the method:

```php
// Before deleting the target category, collect all descendant category IDs.
$descendant_ids = $this->get_descendant_category_ids($subgroup, $id);
// Delete/reassign variables for descendants first, then for the target itself.
foreach ($descendant_ids as $desc_id) {
    // Same delete_vars logic applied to each descendant...
}
// Then delete the descendant category objects.
$this->data['config'][$key] = array_values(array_filter(
    $this->data['config'][$key],
    function (array $c) use ($id, $descendant_ids): bool {
        return $c['id'] !== $id && !in_array($c['id'], $descendant_ids, true);
    }
));
```

New helper:

```php
/**
 * Return IDs of all categories that are descendants of $root_id
 * (i.e., have $root_id anywhere in their ancestor chain).
 *
 * @param string $subgroup
 * @param string $root_id
 * @return string[]
 */
private function get_descendant_category_ids(string $subgroup, string $root_id): array
{
    $cats    = $this->get_categories_for_subgroup($subgroup);
    $result  = [];
    $queue   = [$root_id];
    while (!empty($queue)) {
        $current = array_shift($queue);
        foreach ($cats as $c) {
            if (($c['parent_id'] ?? null) === $current) {
                $result[] = $c['id'];
                $queue[]  = $c['id'];
            }
        }
    }
    return $result;
}
```

### 4.7 New CRUD Operations Needed (Summary)

| Operation                  | PHP method                          | AJAX endpoint              |
|----------------------------|-------------------------------------|----------------------------|
| Add sub-category           | `add_category_for_subgroup()` (extended) | `atfrfo_save_category` (extended) |
| Rename sub-category        | `update_category_for_subgroup()` (unchanged) | `atfrfo_save_category` (unchanged) |
| Move sub-category to new parent | `update_category_for_subgroup()` with `parent_id` field | `atfrfo_save_category` |
| Delete sub-category        | `delete_category_for_subgroup()` (extended with cascade) | `atfrfo_delete_category` |
| Reorder sub-categories     | `reorder_categories_for_subgroup()` (unchanged) | `atfrfo_reorder_categories` |
| Move variable to sub-category | `update_variable()` with new `category_id` | `atfrfo_save_color` (unchanged) |

No new AJAX endpoints are required. All operations can be handled by extending the existing endpoints.

### 4.8 `get_diagnostics()` and `deduplicate()` — Update for Tree

The diagnostics and deduplication methods currently check for duplicate category names within a flat array. After the change, duplicate name detection should be scoped to siblings (same `parent_id`) rather than the entire flat list. Update the `seen_cat` map to be keyed by `parent_id + name` rather than just `name`.

### 4.9 Migration Strategy

**No automatic migration of existing files is required.** The `migrate_data()` backfill (§4.2) ensures that existing flat category arrays get `parent_id: null` on load, making them valid under the new schema. Existing files continue to work without modification.

Users may then manually restructure their categories using the new UI (Phase 3 of the implementation plan, §7).

---

## 5. JavaScript Layer Changes

### 5.1 Tree-Building Helper

Both `atfrfo-variables.js` and `atfrfo-colors.js` need a shared helper that converts the flat category array into a tree for rendering purposes. This belongs in `atfrfo-app.js` (where `ATFRFO.Utils` lives):

```javascript
/**
 * Build a tree from the flat category array for a subgroup.
 *
 * Returns an array of top-level category nodes, each with a `children`
 * array of sub-category nodes (recursively), and a `vars` array of
 * variables assigned directly to that category.
 *
 * @param {Object[]} cats     Flat category array (from _getCatsForSet).
 * @param {Object[]} allVars  Variables array for this subgroup.
 * @param {Function} getVarsForCategory  Existing per-category filter.
 * @returns {Object[]} Tree nodes.
 */
ATFRFO.Utils.buildCatTree = function (cats, allVars, getVarsForCategory) {
    var nodeMap = {};
    cats.forEach(function (c) {
        nodeMap[c.id] = Object.assign({}, c, { children: [], directVars: [] });
    });

    var roots = [];
    cats.forEach(function (c) {
        var node = nodeMap[c.id];
        node.directVars = getVarsForCategory(c).filter(function (v) {
            // Only variables directly in this category, not in any sub-category.
            // A variable is "direct" if no live sub-category claims it.
            return true; // Refined in _getDirectVarsForCategory below.
        });
        if (c.parent_id && nodeMap[c.parent_id]) {
            nodeMap[c.parent_id].children.push(node);
        } else {
            roots.push(node);
        }
    });

    // Sort children and roots by order field.
    function sortByOrder(arr) {
        arr.sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
        arr.forEach(function (n) { sortByOrder(n.children); });
    }
    sortByOrder(roots);
    return roots;
};
```

### 5.2 `_getVarsForCategory(cat)` — Distinguish Direct vs. Sub-category Variables

Currently this method returns all variables whose `category_id === cat.id`. Under the new model it should return only variables directly in `cat`, not variables that are in a sub-category of `cat`. This is already the correct behavior because a variable that is in the "Stop" sub-category has `category_id === "cat-stop"`, not `"cat-status"`. No logic change is needed for the variable lookup itself.

However, the `_getVarsForCategory` Uncategorized branch needs to remain aware that sub-categories of real categories are themselves real categories, not orphans. The existing logic already handles this correctly because it checks `knownIds` and `knownNames` from `_getCatsForSet()`, which will include sub-categories.

The one change needed: when displaying a top-level category header count, the count should reflect all variables in that category's entire subtree (direct + all descendant sub-categories), not just direct variables. A new helper is needed:

```javascript
/**
 * Count all variables in a category's entire subtree.
 *
 * @param {Object}   cat     Category object.
 * @param {Object[]} cats    Full flat category array.
 * @param {Object[]} allVars Variables array for this subgroup.
 * @returns {number}
 */
_getSubtreeVarCount: function (cat, cats, allVars) {
    var self   = this;
    var ids    = [cat.id];
    // Collect all descendant category IDs.
    var queue  = [cat.id];
    while (queue.length) {
        var current = queue.shift();
        cats.forEach(function (c) {
            if ((c.parent_id || null) === current) {
                ids.push(c.id);
                queue.push(c.id);
            }
        });
    }
    return allVars.filter(function (v) {
        return ids.indexOf(v.category_id) !== -1;
    }).length;
},
```

### 5.3 `_buildCategoryBlock()` — Recursive Rendering

The current `_buildCategoryBlock()` renders a flat list of variable rows. It must be extended to optionally render sub-category blocks inside the category block, before or after direct variable rows.

Proposed structure:

```
.atfrfo-category-block[data-category-id="cat-status"]
  .atfrfo-category-inner
    .atfrfo-category-header           (Status header with total count)
    .atfrfo-color-list                (direct variables: 3 disabled-state colors)
    .atfrfo-subcategory-list          (NEW wrapper)
      .atfrfo-category-block.atfrfo-category-block--sub[data-category-id="cat-stop"]
        .atfrfo-category-inner--sub
          .atfrfo-category-header--sub  (Stop header with count)
          .atfrfo-color-list
            (11 stop color rows)
      .atfrfo-category-block.atfrfo-category-block--sub[data-category-id="cat-warning"]
        ...
      .atfrfo-category-block.atfrfo-category-block--sub[data-category-id="cat-success"]
        ...
  .atfrfo-cat-add-btn-wrap
```

The `_buildCategoryBlock()` method gains a `depth` parameter (0 = top-level, 1 = sub-category, 2 = sub-sub-category):

```javascript
_buildCategoryBlock: function (cat, catIndex, catTotal, allCats, depth) {
    var self  = this;
    depth     = depth || 0;
    var MAX_DEPTH = 2; // Shadow > Offset > Inner/Outer

    var directVars  = self._getVarsForCategory(cat);
    var subCats     = self._getSubCategoriesOf(cat.id, allCats);
    var totalCount  = self._getSubtreeVarCount(cat, allCats, self._getVarsForSet());

    // ... header HTML (uses totalCount for the badge) ...

    // Direct variables section
    if (directVars.length > 0) {
        html += '<div class="atfrfo-color-list atfrfo-color-list--direct">';
        directVars.forEach(function (v) { html += self._buildVariableRow(v); });
        html += '</div>';
    }

    // Sub-category section
    if (subCats.length > 0 && depth < MAX_DEPTH) {
        html += '<div class="atfrfo-subcategory-list" data-parent-cat-id="' + cat.id + '">';
        subCats.forEach(function (sc, i) {
            html += self._buildCategoryBlock(sc, i, subCats.length, allCats, depth + 1);
        });
        html += '</div>';
    }

    // Add variable button (at any depth)
    // Add sub-category button (only when depth < MAX_DEPTH)
    ...
},
```

New helper:

```javascript
_getSubCategoriesOf: function (parentId, allCats) {
    return allCats.filter(function (c) {
        return (c.parent_id || null) === parentId;
    }).sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
},
```

### 5.4 `_renderAll()` — Pass Full Category List

`_renderAll()` currently iterates `_getCatsForSet()` and calls `_buildCategoryBlock()` for each item. Under the new model it should render only top-level categories (those with `parent_id === null`), and let `_buildCategoryBlock()` recursively render sub-categories:

```javascript
_renderAll: function (selection, container) {
    var self      = this;
    var allCats   = self._getCatsForSet();
    var topLevel  = allCats.filter(function (c) { return !c.parent_id; });
    // ... existing filter bar HTML ...
    topLevel.forEach(function (cat, i) {
        html += self._buildCategoryBlock(cat, i, topLevel.length, allCats, 0);
    });
    // ...
},
```

### 5.5 `_getCatsForSet()` — No Change Required

This method returns the full flat array sorted by `order`. It is used both for top-level rendering (where the caller filters by `parent_id === null`) and for the tree-building helpers.

### 5.6 Collapse/Expand State — Sub-categories

`_collapsedIds` already maps `catId → boolean` and is keyed by UUID regardless of depth. No change needed — sub-categories will work with the same map.

The "collapse all" / "expand all" toggle in the filter bar should collapse/expand all blocks at all depths. The current implementation iterates all `.atfrfo-category-block` elements in the DOM, which will naturally include sub-category blocks.

### 5.7 `ATFRFO.CatMixin._addCategory()` — Add Sub-category Support

The existing modal asks for a name and posts to `atfrfo_save_category` with no `parent_id`. This must be extended so the user can add a sub-category to a specific parent. Two approaches are needed:

1. **Add Category (top-level):** existing "+" button in the filter bar — no change.
2. **Add Sub-category (to a specific category):** a new "Add sub-category" button inside each category header, visible only when `depth < MAX_DEPTH`.

The modal for adding a sub-category is identical to the existing one, but the `parent_id` is included in the payload:

```javascript
ATFRFO.App.ajax('atfrfo_save_category', {
    filename: ATFRFO.state.currentFile,
    subgroup: self._cfg.setName,
    category: JSON.stringify({ name: name, parent_id: parentCatId }),
});
```

On success, append the new sub-category to `ATFRFO.state.config[catKey]` (not to the parent's children; the flat array is the source of truth).

### 5.8 `ATFRFO.VarDrag.drop()` — Cross-category Movement

The existing drop logic reassigns `category_id` when a variable is dragged across category blocks. This will work for sub-categories without modification because sub-categories are also `.atfrfo-category-block` elements with `data-category-id` attributes. The logic reads `targetCatBlock.getAttribute('data-category-id')` which will correctly resolve to the sub-category UUID.

One edge case: dragging a variable from a sub-category to the parent category's direct variable area. The drop indicator placement logic in `ATFRFO.VarDrag.init()` identifies the target category block by the closest `.atfrfo-category-block`. When a variable is in the "direct variables" section of Status (not inside a sub-category block), the closest `.atfrfo-category-block` is the Status block, which is correct.

### 5.9 Left Panel (`ATFRFO.PanelLeft`)

The left panel currently lists categories as navigation items. Sub-categories must appear as nested items below their parent, indented. This requires changes to `ATFRFO.PanelLeft.refresh()` to build the tree rather than the flat list. The selection object passed to `ATFRFO.EditSpace.loadCategory()` must include `categoryId` so the edit space scrolls to and expands the correct block.

---

## 6. UI/UX Design

### 6.1 Visual Hierarchy

Top-level category blocks use the existing `.atfrfo-category-block` / `.atfrfo-category-inner` appearance (card with 12px border-radius, `--atfrfo-bg-card` background, 32px bottom margin).

Sub-category blocks are rendered inside a `.atfrfo-subcategory-list` container inside the parent category block, with a left indent of 24px (one drag-handle column width) and a reduced visual weight:

- Slightly smaller border-radius (8px vs 12px)
- A left border accent (2px, `--atfrfo-clr-border`) to indicate nesting
- No bottom margin on the last sub-category within a parent
- Same collapse/expand chevron in the header

Sub-sub-category blocks (depth = 2) receive an additional 24px indent relative to their parent sub-category.

```
[Status]  ← top-level: full card, bold header
  ├── --status-disabled-bg   (direct variables)
  ├── --status-disabled-text
  ├── [Stop]   ← sub-cat: indented card, smaller header
  │     ├── --status-stop-10 ... --status-stop-100
  ├── [Warning]
  ├── [Success]
```

```
[Shadow]
  ├── --shadow-spread     (direct variables)
  ├── --shadow-blur
  ├── [Offset]   ← sub-cat
  │     ├── [Inner]   ← sub-sub-cat (depth 2)
  │     │     ├── --shadow-offset-inner-x
  │     │     └── --shadow-offset-inner-y
  │     └── [Outer]
  │           ├── --shadow-offset-outer-x
  │           └── --shadow-offset-outer-y
```

### 6.2 Category Header Changes

**Top-level category header:** the count badge changes from "direct variable count" to "total subtree count" (all variables in all descendant sub-categories combined). Add a secondary label showing how many direct variables exist if both types are present. Example: "33 total · 3 direct".

**Sub-category header:** a compact version of the top-level header without the drag handle (or with a narrower one), showing the sub-category name, count, rename, delete, and collapse buttons. The "Duplicate" action on sub-categories is supported.

### 6.3 Add Sub-category Button

Inside each top-level (and sub-level, up to MAX_DEPTH − 1) category header, add a "Add sub-category" action button alongside the existing "Duplicate" and "Delete" buttons:

```
[≡ Status (33 total)] ... [+ sub] [⧉ dup] [🗑] [⌄]
```

The button fires the same modal as `_addCategory()` but passes `parent_id` in the request.

An alternative (simpler for MVP) is to have the "Add Category" button in the filter bar always ask "Add to:" with a dropdown of existing categories (or "Top level"). This avoids adding per-header buttons but may be harder to discover.

**Recommended for MVP:** per-header "Add sub-category" button, hidden by default and revealed on category header hover (matches the existing pattern for Delete, which is already hover-revealed).

### 6.4 Moving a Variable into a Sub-category

**Primary method: drag and drop.** The user drags the variable row and drops it onto a sub-category block. This works without additional implementation (see §5.8).

**Secondary method: context/edit action (deferred to Phase 3).** A "Move to..." modal listing sub-categories in a dropdown could be added later. It is not required for Phase 1 or 2.

### 6.5 Two-Level Nesting — Shadow > Offset > Inner/Outer

At depth 2, the sub-sub-category block is identical to the depth-1 block but with an additional indent. The "Add sub-category" button is hidden at depth 2 (MAX_DEPTH) because further nesting is not allowed. The user is shown only "Add variable" and the standard rename/delete/collapse header actions.

### 6.6 Mixed Category: Direct Variables and Sub-categories

When a category has both direct variables and sub-categories, they render in this order within the category block:

1. Direct variable rows (in their own `.atfrfo-color-list--direct` container, above the sub-categories)
2. Sub-categories list (`.atfrfo-subcategory-list` below)

The add-variable button at the bottom of the category block adds a variable directly to the category (not to a sub-category). Adding to a sub-category uses the sub-category's own add-variable button.

Rationale: placing direct variables above sub-categories gives them visual primacy and keeps the sub-categories visually grouped as a related cluster below.

### 6.7 Left Panel Navigation

The left panel currently lists `Categories > Category Name` as flat items. Under the new model, sub-categories are displayed as indented child items under their parent:

```
Variables
  Colors
    Status
      Stop       ← indented
      Warning    ← indented
      Success    ← indented
    Branding
```

Sub-sub-categories indent one additional level. Clicking a sub-category in the left panel navigates to the Colors (or Fonts/Numbers) view, scrolls to the parent category block, and expands it to show the sub-category.

### 6.8 Delete Sub-category Behavior

Deleting a sub-category presents the same iOS toggle used for top-level delete: "Delete variables" (hard delete all variables in the sub-category) vs. "Save to Uncategorized" (move variables to Uncategorized). The parent category is not affected.

If a sub-category has its own sub-categories, the delete confirmation states the recursive count: "This will also delete N nested sub-categories and M variables."

---

## 7. Implementation Phases

Each phase leaves the application in a fully working state. Phases do not overlap in responsibility.

### Phase 1 — Data Model & Backwards Compatibility (no UI change)

**Scope:** PHP layer only.

1. Add `parent_id: null` to `category_defaults()`.
2. Add `parent_id` backfill in `migrate_data()` for all three category config keys.
3. Extend `ajax_aff_save_category()` to accept and validate `parent_id`.
4. Add `would_create_cycle()` guard.
5. Implement `get_descendant_category_ids()` helper.
6. Extend `delete_category_for_subgroup()` to cascade sub-category deletion.
7. Update `get_diagnostics()` and `deduplicate()` to scope duplicate detection to siblings.
8. No AJAX endpoint changes other than `atfrfo_save_category` accepting the new field.
9. Test: existing `.atfrfo.json` files load and save without change. New files with nested categories save and load correctly.

**Deliverable:** The PHP data layer fully supports nested categories. No UI exposes the feature yet.

### Phase 2 — JavaScript Tree Model (minimal UI)

**Scope:** JS model and rendering infrastructure, no styling.

1. Add `ATFRFO.Utils.buildCatTree()` to `atfrfo-app.js`.
2. Add `_getSubCategoriesOf()` and `_getSubtreeVarCount()` to `ATFRFO.Variables._proto` and `ATFRFO.Colors`.
3. Modify `_renderAll()` to filter for top-level categories only.
4. Modify `_buildCategoryBlock()` to accept `depth` and `allCats` parameters, recursively rendering sub-categories.
5. Verify: existing flat projects render identically (all categories have `parent_id === null`, rendering is unchanged).

**Deliverable:** Projects with nested category data render correctly in the edit space (no styling yet).

### Phase 3 — Sub-category CRUD UI

**Scope:** Adding the UI actions for managing sub-categories.

1. Add "Add sub-category" button to category headers (hidden at MAX_DEPTH).
2. Wire `_addCategory()` to pass `parent_id` when triggered from a category header.
3. Sub-category delete modal — extend `_deleteCategory()` to show recursive count.
4. Sub-category rename — already works via the contenteditable header (no change needed).
5. Sub-category drag-and-drop reorder within a parent — extend `_initCatDrag()` to scope reorder to siblings (same `parent_id`).
6. Left panel (`ATFRFO.PanelLeft`) — render sub-categories as nested nav items.

**Deliverable:** The user can add, rename, delete, and reorder sub-categories through the UI.

### Phase 4 — Styling & Polish

**Scope:** CSS for the nested visual hierarchy.

1. `.atfrfo-subcategory-list` container: left padding, optional left border.
2. `.atfrfo-category-block--sub` and `.atfrfo-category-inner--sub`: reduced border-radius, smaller header font, distinct background tint.
3. `.atfrfo-category-block--sub-sub`: additional indent for depth 2.
4. Category count badge: display subtree total with secondary direct count.
5. "Add sub-category" button visibility (hover-reveal in category header).
6. Responsive behavior: sub-categories collapse to the same width as top-level categories on narrow screens.

**Deliverable:** The feature looks intentional and consistent with the existing design language.

### Phase 5 — Move Variable UI (Optional)

**Scope:** A "Move to..." action on variable rows.

1. Add a "Move to sub-category" option to variable rows (context button or drag-target affordance).
2. Modal lists available categories and sub-categories in a flat dropdown (indented labels for hierarchy).
3. On confirm, fires `atfrfo_save_color` with the new `category_id`.

**Deliverable:** Users can move variables between categories/sub-categories without drag-and-drop.

---

## 8. Open Questions

The following decisions must be made by the developer before Phase 3 implementation begins. Phases 1 and 2 can proceed without them.

**Q1. Maximum nesting depth: 2 or 3?**
The Shadow > Offset > Inner/Outer example requires depth 2 (two levels below a top-level category). The spec sets `MAX_DEPTH = 2`. If any future design requires depth 3, the depth limit is a single constant — but the UI and data model both need to be designed with the correct limit upfront, as changing it later requires revisiting the "Add sub-category" button visibility logic.

_Decision needed: confirm `MAX_DEPTH = 2` (Category → Sub → Sub-sub) is sufficient._

**Q2. Where should direct variables appear relative to sub-categories?**
The spec places direct variables above sub-categories within a category block (§6.6). An alternative is to place them below (sub-categories first, direct variables last), or to allow the user to drag direct variable rows relative to sub-category blocks.

_Decision needed: direct variables above or below sub-categories?_

**Q3. Should sub-categories be drag-reorderable within their parent?**
The spec includes sub-category reorder within siblings (Phase 3, item 5). This reuses the existing `_initCatDrag()` infrastructure. The alternative is to use only the rename/delete model and not support drag reorder for sub-categories in Phase 3, deferring it to a later phase.

_Decision needed: is drag-reorder of sub-categories required in Phase 3?_

**Q4. What happens to the "Duplicate Category" action on a sub-category?**
Duplicating a top-level category currently duplicates it at the top level. Duplicating a sub-category should logically create a new sub-category under the same parent. Confirm this is the desired behavior before Phase 3 implementation.

_Decision needed: confirm duplicate of sub-category stays within the same parent._

**Q5. Left panel navigation depth**
The left panel currently shows a two-level tree (group → category). Sub-categories would add a third level. Deeply nested left panels can become unwieldy. An alternative is to only show top-level categories in the left panel and navigate sub-categories entirely within the edit space.

_Decision needed: do sub-categories appear in the left panel, or only in the edit space?_

**Q6. `atfrfo_save_category` response — return updated full tree or only the new item?**
The existing endpoint returns the full `categories` array after every save. For large projects with many nested categories, this becomes a significant payload. A leaner alternative returns only the affected category object plus its parent's ID. The client code in `_addCategory()` and `_saveCategoryName()` already uses selective merge logic rather than full replacement, so either format is supportable.

_Decision needed: keep current full-array response or switch to partial response in Phase 3?_
