# AFF Code Review
# Atomic Framework Forge for Elementor — v1.1.0
# Reviewed: 2026-05-21

> **Scope:** All PHP classes and JS modules. CSS and SVG assets excluded.
> This document is independent of TECH-DEBT.md. Where an issue is already
> catalogued there with an ID (e.g. DP-05), the ID is cited to avoid
> duplication. New findings not in TECH-DEBT.md are called out explicitly.

---

## Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Object Orientation (PHP)](#2-object-orientation-php)
3. [Module Design (JavaScript)](#3-module-design-javascript)
4. [DRY Analysis](#4-dry-analysis)
5. [Maintainability](#5-maintainability)
6. [Error Handling](#6-error-handling)
7. [Security](#7-security)
8. [Actionable Recommendations](#8-actionable-recommendations)

---

## 1. Architecture Overview

### PHP Layer

```
atomic-framework-forge-for-elementor.php  (bootstrap, constants, hooks)
    └── AFF_Loader::init()
            ├── AFF_Settings            (WordPress option wrapper, static)
            ├── AFF_Data_Store          (file I/O, project/backup management)
            ├── AFF_CSS_Parser          (Elementor kit CSS / meta reader, READ-ONLY)
            ├── AFF_Usage_Scanner       (widget reference counting)
            ├── AFF_Ajax_Handler        (all wp_ajax_* endpoints)
            └── AFF_Admin               (menu, asset enqueueing, page render)
```

**Dependency direction:** Bootstrap → Loader → individual service classes.
The classes are independent of each other except:
- `AFF_Ajax_Handler` instantiates `AFF_CSS_Parser`, `AFF_Data_Store`, and `AFF_Settings`.
- `AFF_Admin` instantiates nothing; it reads constants and calls static helpers.

There are no circular dependencies. All requires happen in `AFF_Loader::init()`,
which is the single composition root.

### JavaScript Layer

```
Enqueue order (all footer, each depends on previous):
    aff-theme.js          (theme toggle, dark/light mode)
    aff-modal.js          (modal system)
    aff-merge.js          (conflict resolution — loaded before panel scripts)
    aff-panel-left.js     (navigation tree)
    aff-panel-right.js    (file management, project picker, commit)
    aff-panel-top.js      (toolbar, tooltips, sync, export/import)
    aff-edit-space.js     (center content host, preferences panel)
    aff-colors.js         (Colors subgroup — intercepts EditSpace)
    aff-variables.js      (Fonts/Numbers factory — intercepts EditSpace)
    aff-app.js            (global state, AFF.Utils, AFF.Icons, AFF.CatMixin,
                           AFF.VarDrag, AFF.App, IIFE initializer)
    aff-print.js          (print/PDF modal)

Dead file:
    _patch_panel_right.js (Node.js patch script — see D-01 in TECH-DEBT.md)
```

**Critical load-order dependency:** `aff-colors.js` and `aff-variables.js`
define `AFF.Colors` and `AFF.Variables._proto` respectively. `aff-app.js`
runs last and applies `AFF.CatMixin` via `Object.assign` to both. This means
the mixin is applied *after* the modules are fully defined, which is correct —
but the constraint is implicit. There is no runtime guard that would catch a
load-order violation.

**Intercept chain for `AFF.EditSpace.loadCategory`:**

```
AFF.Colors.init()      → patches loadCategory, stores _prevLoad
AFF.Variables.initSet(FONTS_CFG)   → patches loadCategory, stores _prevLoad
AFF.Variables.initSet(NUMBERS_CFG) → patches loadCategory, stores _prevLoad
```

Each `initSet` wraps the previous loadCategory implementation. This is a
monkey-patch chain. It works, but breaks silently if init order changes, and
adds invisible layers of indirection. A dispatch table keyed by subgroup name
would be clearer and safer. (See recommendation R-01.)

### CSS Layer

Five cascading stylesheets with explicit dependency order:

```
aff-theme.css → aff-layout.css → aff-colors.css → aff-variables.css
    → aff-preferences.css → aff-print.css
```

Plus `pickr/classic.min.css` (vendor). Grid column widths are overridden via
`wp_add_inline_style` to guarantee correct values regardless of browser cache
state on the static files.

---

## 2. Object Orientation (PHP)

### Single Responsibility

| Class | Responsibility | Assessment |
|-------|---------------|------------|
| `AFF_Loader` | Require includes + instantiate | Correct — pure composition root |
| `AFF_Admin` | Admin menu, asset enqueueing, page render | Correct |
| `AFF_CSS_Parser` | Parse Elementor kit CSS/meta | Correct — READ-ONLY, self-contained |
| `AFF_Settings` | WordPress option read/write | Correct — static façade |
| `AFF_Ajax_Handler` | All AJAX endpoints | **Too large** (see below) |
| `AFF_Data_Store` | File I/O, project/backup management | **Too large** (see below) |
| `AFF_Usage_Scanner` | Widget reference counting | Not reviewed (not in spec) |

### `AFF_Ajax_Handler` — God Class Risk

The handler registers and implements 26 distinct AJAX endpoints in a single
class. Based on the register_handlers list alone this file almost certainly
exceeds 2000 lines. The endpoints span four distinct concerns:

- File I/O (save_file, load_file, save_config, get_config)
- Elementor sync (sync_from_elementor, commit_to_elementor, sync_v3_global_colors)
- Variable CRUD (save_color, delete_color, generate_children, save_baseline, etc.)
- Project management (list_projects, copy_project, rename_project, delete_project, etc.)

There is no immediate runtime risk, but adding new features or fixing edge
cases requires navigating an enormous file. A logical split would be four
handler classes registered from `AFF_Loader::init()`, each responsible for
one concern group.

### `AFF_Data_Store` — Large Surface

Based on the TECH-DEBT.md references (list_project_backups, generate_backup_filename,
list_projects, prune_backups, sanitize_project_slug, get_project_dir), this
class handles both low-level file operations and higher-level project
management logic. The same separation concern applies.

### Static vs Instance Methods

`AFF_CSS_Parser::get_active_kit_id()` is declared `public static` but is called
as `$this->get_active_kit_id()` from instance methods within the same class.
This is not wrong — PHP allows calling static methods via `$this` — but the
inconsistency signals that `get_active_kit_id()` was added as static for
external callers (it is `public`), while the internal callers were not updated.
The method reads a WordPress option and has no state dependency; static is
correct here. The instance call sites should be updated to `self::get_active_kit_id()`.

### Constructor Patterns

None of the classes use constructors for dependency injection. All dependencies
are instantiated inline inside methods. This makes testing impossible without
WordPress loaded. For a WP plugin at v1.1 this is acceptable, but it is worth
noting for future testability work.

### `AFF_Admin::get_icon()` Is Static, `get_menu_icon_svg()` Is Not

`get_icon()` is a public static utility (called from view templates), but
`get_menu_icon_svg()` is a private instance method that could equally be
static. Minor inconsistency.

---

## 3. Module Design (JavaScript)

### Pattern Summary

All modules use the same pattern: an IIFE that attaches an object literal to
`window.AFF`. There are no ES6 classes, no imports, no module system. For a
WordPress admin page loaded as a single bundle this is acceptable and
deliberate. The pattern is consistent across all files.

### Module Isolation

**Well-isolated:**
- `AFF.Modal` — no dependencies on other modules.
- `AFF.Merge` — depends only on `AFF.Utils` and `AFF.Modal`.
- `AFF.Theme` — no dependencies.
- `AFF.Print` — minimal dependencies.
- `AFF.VarDrag` — depends on `AFF.App.ajax` and `AFF.state`; otherwise self-contained.

**Moderately coupled:**
- `AFF.Colors` — references `AFF.state`, `AFF.App`, `AFF.Modal`, `AFF.Icons`,
  `AFF.Utils`, `AFF.PanelLeft`, `AFF.EditSpace`. Expected for a complex UI
  module; manageable.
- `AFF.Variables._proto` — same cross-module references as Colors.

**Tightly coupled (problematic):**
- `AFF.PanelTop._saveProjectConfig` directly accesses `AFF.PanelRight._filenameInput`
  (a private instance property) and calls `AFF.PanelRight._openProjectPicker()`.
  PanelTop should not know about PanelRight internals. This is a Law of Demeter
  violation that will cause a silent bug if PanelRight's internal naming changes.
- `AFF.PanelTop._postSyncRefresh` directly calls `AFF.Colors._ensureUncategorized()`
  and `AFF.Variables._sets["Fonts"]._ensureUncategorized()`. PanelTop is reaching
  through the module registry into module internals. This is the same coupling
  problem in a different place.

### The `AFF.CatMixin` Pattern

`AFF.CatMixin` in `aff-app.js` is applied to `AFF.Colors` and
`AFF.Variables._proto` via `Object.assign`. The mixin requires each target to
expose `_cfg`, `_collapsedIds`, `_rerenderView()`, `_noFileModal()`, and
`_getVarsForCategory()`. This contract is documented in a comment but not
enforced. The pattern works but has two weaknesses:

1. **Timing:** The mixin is applied at the end of `aff-app.js`'s IIFE. If
   `aff-colors.js` or `aff-variables.js` fails to load, `Object.assign` runs
   against an undefined object and throws. The check `if (AFF.Colors)` before
   `Object.assign` would prevent this.

2. **Method shadowing:** `Object.assign` does a shallow copy. If `AFF.Colors`
   already defined a method with the same name as a mixin method (e.g. a
   future override of `_addCategory`), the mixin would silently overwrite it.

### The `AFF.Variables` Factory Pattern

`AFF.Variables.initSet(cfg)` creates instances via `Object.create(AFF.Variables._proto)`.
This is clean — the prototype holds all shared behaviour, and each instance gets
its own state. The factory is registered in `AFF.Variables._sets`, making
programmatic access to live instances possible (used by `_postSyncRefresh`).

The one asymmetry is that `AFF.Colors` is a plain singleton object, while
`AFF.Variables` is a factory producing instances. This makes sense given that
Colors always exists as one module and Fonts/Numbers are identical-pattern sets,
but it does mean the calling conventions differ slightly: `AFF.Colors.init()` vs
`AFF.Variables.initSet(cfg)`.

### AFF.VarDrag Is Well-Extracted

`AFF.VarDrag` is a clean extraction of all mouse-based variable drag-and-drop.
It accepts a `getCats` callback so it does not couple to any specific subgroup.
The separation is correct. The only note: `AFF.VarDrag.rowKey(v)` duplicates
`AFF.Utils.rowKey(v)` — two functions with identical implementations.

---

## 4. DRY Analysis

### Colors vs Variables — Overall

The structural parallel between `aff-colors.js` (Colors) and `aff-variables.js`
(Fonts/Numbers) is the most significant DRY concern in the codebase. The
following functions exist in near-identical form in both files:

| Function | Colors | Variables | Identical? |
|----------|--------|-----------|-----------|
| `_buildCategoryBlock` | yes | yes | ~85% identical |
| `_buildVariableRow` | yes | yes | ~65% identical |
| `_renderAll` | yes | yes | ~75% identical (filter bar differs) |
| `_filterRows` | yes | yes | 100% identical |
| `_setAllCollapsed` | yes | yes | ~90% identical |
| `_sortVarsInCategory` | yes | yes | ~90% identical |
| `_initCatDrag` | yes | yes | 100% identical |
| `_noFileModal` | yes (via mixin) | yes (via mixin) | via CatMixin |
| `_ensureUncategorized` | yes (Colors-specific) | yes | ~80% identical |

The Variables module addressed this by putting shared behaviour in
`AFF.Variables._proto` and applying `AFF.CatMixin`. However, Colors was not
refactored into the same factory; it remains a standalone object with its own
copies of these methods.

The full resolution would be: make Colors an instance of the same factory as
Fonts/Numbers, with a Colors-specific config that enables the expand panel,
the Pickr color picker, multi-select, and tint/shade generation. This is
non-trivial but it would eliminate the largest duplication block.

### Specific Duplications

**`_filterRows` (100% identical):**
`aff-colors.js` and `aff-variables.js` contain byte-for-byte identical
implementations. This is the clearest candidate for moving to `AFF.CatMixin`
right now, with zero risk.

**`_initCatDrag` (100% identical):**
Category drag-and-drop is implemented independently in both files. Like
`_filterRows`, this belongs in the shared module. (Colors uses it via
its own `_initCatDrag`; Variables has its own copy in `_proto`.)

**`_setAllCollapsed` (~90% identical):**
The only difference is the CSS selector prefix used to find the toggle button.
A single shared implementation parameterized by `setLower` would work.

**`_applyNewVars` and `_applyImport` in `aff-panel-top.js`:**
Both functions contain identical heuristic logic for classifying a CSS value
as color / font / number / unknown. This 80-line block appears twice. It
should be extracted to `AFF.Utils.classifyVar(value, elUnit)` and called from
both places.

**`_retrySyncWithPath` in `aff-panel-top.js`:**
The conflict-resolution branch inside `_retrySyncWithPath` is an ~80-line
copy-paste of the same branch in `_syncFromElementor`. The two paths diverge
only in which `source` string is passed to `_postSyncRefresh`. Extract a
`_processSyncResult(res, options)` helper. (New finding — not in TECH-DEBT.md.)

**`_openConvertV3` and `_openChangeTypes` in `aff-panel-top.js`:**
Both are stub modals with identical structure. They could share a
`_openStubModal(title, description)` helper, but since both are intentional
stubs this is low priority.

**`AFF.VarDrag.rowKey` vs `AFF.Utils.rowKey`:**
Two functions with identical source code. `VarDrag` should call
`AFF.Utils.rowKey` directly. (New finding.)

**Color-classification regex in `_applyNewVars` and `_applyImport`:**
The same font-detection regex
(`/\b(serif|sans-serif|monospace|cursive|...)\b/`) appears in both places.
(Part of the `_applyNewVars` duplication above.)

---

## 5. Maintainability

### Tech Debt Markers (from source code comments)

Items already catalogued in TECH-DEBT.md are cited by their IDs.

| Location | Marker | Description | TECH-DEBT ID |
|----------|--------|-------------|-------------|
| `aff-app.js:48` | comment | `AFF.state.metadata` undeclared | A-03 |
| `aff-app.js:1278` | comment | Font-size sentinel mismatch | C-04 |
| `aff-app.js:1383` | comment | `globalConfig` aliased to same object as `config` | A-02 |
| `aff-app.js:1553` | comment | Double `aff_get_settings` call | DP-05 |
| `aff-panel-right.js` | comment | Stale `_saveFile` doc comment | D-03 residue |
| `aff-panel-right.js` | comment | `_loadFile`/`_autoLoadFile` 40-line duplication | DP-03 |
| `aff-panel-right.js` | comment | Format-unit map defined twice | DP-02 |
| `class-aff-ajax-handler.php` | comment | `sleep()` for filename collision | A-04 |
| `class-aff-css-parser.php` | comment (implicit in A-05) | Regex fails on nested braces | A-05 |

### Additional Maintainability Notes Not in TECH-DEBT.md

**`aff-panel-top.js` line 170 — Dead listener block:**
```js
// Empty iteration keeps the original per-element block intact but harmless
[].forEach(function (el) {
    el.addEventListener('mouseenter', function () { self._showTooltip(el); });
    // ... etc.
});
```
This is an empty array literal `.forEach(...)`. The code inside the callback
never runs. This was clearly migration residue from when tooltips were bound
per-element, replaced by the delegated `mouseover` handler above it. The entire
block should be deleted.

**`aff-panel-top.js` — `_buildCatsEditorHtml` and `_bindCatsEditor` are dead:**
These two methods build and bind a category-list editor UI that is never
called from anywhere in the file. `_openManageProject` does not call
`_buildCatsEditorHtml`; it uses the simpler CSV text-field approach instead.
These methods are dead code.

**`aff-panel-top.js` — `_parseLines` is dead:**
The `_parseLines` method at line 2006 has a detached JSDoc (`@private`) with
no function signature above it — the function body appears to have been split
from its comment. The method itself is never called from within the file.

**Function length:**
- `AFF.Colors._bindInlineEditing` — approximately 200 lines, handling six
  distinct event types (mousedown, focusout, keydown×2, change×2). Each
  event type should be its own named function.
- `AFF.PanelTop._openManageProject` — approximately 300 lines mixing UI
  construction, event binding, AJAX calls, and state mutation. Should be split
  into build/bind/save phases.
- `AFF.PanelTop._saveProjectConfig` — approximately 120 lines of pure
  procedural logic. The category-normalization and variable-reassignment
  sections should be extracted as named helpers.
- `AFF.PanelTop._syncFromElementor` — approximately 180 lines. The conflict
  resolution callback is large enough to be its own named function.

**Comment quality:**
Comments are consistently present and generally accurate. Inline `// Tech debt`
and `// Why:` comments are a good practice and are used throughout. The main
gap is that some large procedural blocks in `aff-panel-top.js` (particularly
`_saveProjectConfig` and `_applyNewVars`) lack section-level comments that
would make it easier to scan the logic flow.

**CSS organization:**
The CSS layer is well-structured. The five-file cascade (theme → layout →
colors → variables → preferences) has clear responsibilities. The inline
`get_grid_override_css()` in PHP is a reasonable workaround for cache-busting
problems, but embedding CSS in PHP is an architectural compromise. A better
long-term approach: use CSS custom properties for column widths, set via a
`<style>` tag in the view template.

**Naming:**
- `aff-panel-right.js` uses `_escHtml` / `_escAttr` (weaker versions) while
  the global equivalents are `AFF.Utils.escHtml` / `AFF.Utils.escAttr`. The
  local names shadow the convention without matching behaviour (C-03, DP-01).
- `aff_save_color` endpoint is used for all variable types (Colors, Fonts,
  Numbers). The name is misleading for non-color variables. This is a known
  naming debt but changing it requires a coordinated PHP + JS rename.
- `AFF.state.hasUnsavedChanges` vs `isDirty` naming inconsistency (L-04).
- `_eff` prefix on IndexedDB helpers in `aff-panel-top.js` (L-06).

---

## 6. Error Handling

### AJAX Error Handling

**PHP (server side):** All endpoints use `wp_send_json_error()` for failure
paths. Error messages are translatable strings. The pattern is consistent.
File I/O failures include the PHP error message from `error_get_last()`, which
is good for debugging.

**JS (client side):** Every `AFF.App.ajax()` call chain ends with `.catch()`.
No unhandled promise rejections are present in the reviewed files. The majority
of catch handlers:
- Show a modal with a user-visible error message, or
- `console.warn('[AFF] ...')` for non-critical failures (usage counts,
  background saves).

**Silent failures that warrant attention:**

1. `AFF.App.ajax('aff_save_color', ...)` in `AFF.VarDrag.drop()` is
   fire-and-forget: `.catch(function () { console.warn(...) })`. If a variable
   reorder fails silently, the display state and server state diverge. The
   warning is logged but the user sees no feedback. This is an accepted
   trade-off for drag-and-drop responsiveness, but it means data loss is
   possible without the user knowing.

2. `autoSaveIfClearMode()` in `_syncFromElementor` logs `console.warn` on
   failure but does not notify the user. If the auto-save after clear+replace
   fails, the synced state exists only in memory and will be lost on page
   reload. A modal or toast warning would be appropriate here.

3. `_duplicateCategory` in `AFF.CatMixin` uses `.catch(function () {})` with
   an empty body — the outer category-creation error is silently swallowed.
   The inner chain `chain.then(...).catch(function () {})` also swallows
   per-variable duplication errors. A minimum `console.warn` should be added.

4. In `_ajaxSaveColor` (`aff-colors.js`):
   ```js
   .catch(function () {
       console.warn("[AFF] AJAX error: load file");
   });
   ```
   The message says "load file" but the function saves a color. Copy-paste
   error in the log message.

### Missing HTTP Error Differentiation

`AFF.App.ajax` throws on `!response.ok` but only includes the HTTP status
code. There is no retry logic, no differentiation between transient (503,
429) and permanent (400, 403) failures. For a WP admin tool with local AJAX
this is acceptable, but 403 responses (nonce expiry after long idle) should
surface a "Session expired — please reload" message rather than a generic
error.

### PHP — No Error Logging

PHP error paths use `wp_send_json_error()` but do not call `error_log()`.
Transient server errors (disk full, permissions) will reach the user as a
modal message but leave no server-side trace. Adding `error_log()` calls
for unexpected failures would significantly improve diagnosability in
production.

---

## 7. Security

### Nonce Verification

All PHP AJAX endpoints call `$this->verify_request()` as the first operation.
`verify_request()` calls `check_ajax_referer(AFF_NONCE_ACTION, 'nonce', false)`
and sends a `wp_send_json_error` on failure. The nonce is created server-side
and passed to JS via `wp_localize_script`. This is correct.

**The `with_store()` double-verification issue (A-01 / C-02 in TECH-DEBT.md):**
The C-02 fix removed explicit `verify_request()` calls from six Phase 2
endpoints because `with_store()` calls it internally. However, TECH-DEBT.md
A-01 notes the calling convention is not documented consistently. The current
state is that `with_store()` owns verification for Phase 2 endpoints and
direct `verify_request()` calls own it for Phase 1 endpoints. This dual
pattern should be unified.

### Capability Checks

`AFF_Admin::render_admin_page()` checks `current_user_can('manage_options')`
and calls `wp_die()` on failure. All AJAX endpoints call `verify_request()`
which implicitly requires the user to be logged in (nonce is per-user). However,
no AJAX endpoint performs an explicit `current_user_can()` check beyond what
the nonce implies.

**Gap:** A logged-in user who is not an admin (e.g. Editor role) cannot access
the AFF admin page, but if they know the AJAX action names and have a valid
nonce (which they could obtain by inspecting page source if they ever had
access), they could POST to the AJAX endpoints. `verify_request()` should
include a `current_user_can('manage_options')` check before the nonce check.

### Input Sanitization (PHP)

`$this->post_param()` calls `sanitize_text_field()` for scalar inputs.
JSON payloads go through `$this->safe_json_decode()`. File paths are validated
against allowed directories in `ajax_aff_sync_from_elementor` (the
`$allowed_base` check). This is correct.

**`file_put_contents` vs WP Filesystem API:**
`ajax_aff_save_file` checks `$fs->is_writable($dir)` via the WP Filesystem
API but then calls `file_put_contents()` directly (with a `phpcs:ignore`
comment). This is a minor inconsistency; the API is consulted for the
writability check but bypassed for the actual write. In practice this is fine
on a standard file system, but some hosting environments (FTP-based filesystem)
would require the full WP Filesystem API path for writes to work correctly.

### Input Validation (JS)

Variable names are validated before saving:
- Colors: `/^(--)?[A-Za-z_][A-Za-z0-9_-]*$/`
- Variables (Fonts/Numbers): `/^[A-Za-z0-9_-]+$/`

The two regex patterns are inconsistent. Colors allows a leading `--` prefix
and requires an alphabetic or underscore start; Variables only allows alphanumeric
start. A variable in one subgroup could pass validation that would fail in
another. This should be unified.

**The search modal in `aff-panel-top.js`:**
```js
matches = AFF.state.variables.filter(function (v) {
    return (
        v.name.toLowerCase().includes(query) ||
        v.value.toLowerCase().includes(query)
    );
});
// ...
html += '<code style="...">' + v.name + '</code>';
html += '<span style="...">' + v.value + '</span>';
```
`v.name` and `v.value` are inserted into HTML without escaping. These values
come from `AFF.state.variables`, which originated from server data. If a
variable name contains `<script>`, it would execute. Use `AFF.Utils.escHtml()`
at both insertion points. (New finding — not in TECH-DEBT.md.)

**Unescaped values in diagnostics results:**
In `_openDiagnostics` in `aff-panel-top.js`, duplicate variable names and
category names from the server response are inserted into list items without
escaping:
```js
return "<li>" + AFF.Utils.escHtml(n) + "</li>";   // variables — escaped
return "<li>" + AFF.Utils.escHtml(c.subgroup) + " &rarr; " + AFF.Utils.escHtml(c.name) + "</li>"; // categories — escaped
```
These are actually escaped correctly. Noted for completeness.

### Output Escaping (PHP)

`AFF_Admin::get_icon()` returns raw SVG file contents via `file_get_contents`.
The SVG files are bundled plugin assets, not user input, so this is acceptable.
The `phpcs:ignore` comment acknowledges the PHPCS flag.

No direct `echo` or `print` of unescaped user data was observed in the reviewed
PHP files. `wp_send_json_success/error` handles output encoding.

---

## 8. Actionable Recommendations

### Priority Legend
- **H — High:** Data loss risk, security gap, or active bug causing incorrect behaviour.
- **M — Medium:** Architecture or maintainability issue with measurable ongoing cost.
- **L — Low:** Cleanup with no functional impact.

Items already fully catalogued in TECH-DEBT.md are cited briefly and not re-explained.

---

### High Priority

| ID | File | Location | Issue | Fix |
|----|------|----------|-------|-----|
| R-01 | `aff-colors.js`, `aff-variables.js`, `aff-app.js` | `AFF.EditSpace.loadCategory` monkey-patch chain | Three sequential patches create a fragile dispatch chain that breaks silently on load-order change | Replace with a dispatch table in `AFF.EditSpace`: `var _handlers = {}; AFF.EditSpace.register('Colors', AFF.Colors.loadColors.bind(AFF.Colors)); ...` |
| R-02 | `aff-panel-top.js` | `_openSearch`, lines ~1116–1123 | `v.name` and `v.value` inserted into HTML without escaping — XSS if a variable name contains HTML | Replace `v.name` and `v.value` with `AFF.Utils.escHtml(v.name)` and `AFF.Utils.escHtml(v.value)` |
| R-03 | `class-aff-ajax-handler.php` | `verify_request()` / all endpoints | No `current_user_can('manage_options')` check in the AJAX layer — capability check happens only at page render | Add `if (!current_user_can('manage_options')) { wp_send_json_error(...); }` inside `verify_request()` |
| R-04 | `aff-panel-top.js` | `autoSaveIfClearMode()` ~line 1148 | Silent failure: if auto-save after clear+replace fails, synced state is only in memory and is lost on reload | Show a toast/modal on `.catch()` — "Sync complete but auto-save failed. Use Save Changes." |
| R-05 | `aff-app.js` | `AFF.CatMixin` applied via `Object.assign` ~line 808 | No guard: if `AFF.Colors` or `AFF.Variables._proto` is undefined (e.g. due to a JS error in an earlier file), `Object.assign` throws uncaught | Add guards: `if (AFF.Colors) { Object.assign(AFF.Colors, AFF.CatMixin); }` |
| R-06 | `aff-panel-top.js`, `aff-panel-right.js` | `_escHtml`, `_escAttr` (C-03, DP-01) | Weaker escape implementations risk XSS in attribute values | See TECH-DEBT.md C-03 / DP-01 |
| R-07 | `aff-panel-right.js` | `_syncFromElementor` conflict path | ~80 lines of conflict-resolution logic copied verbatim in `_retrySyncWithPath` | Extract `_processSyncResult(res, source)` helper used by both call paths |

---

### Medium Priority

| ID | File | Location | Issue | Fix |
|----|------|----------|-------|-----|
| R-08 | `aff-colors.js` | `_ajaxSaveColor` | `console.warn("[AFF] AJAX error: load file")` — wrong message for a save operation | Change message to `"[AFF] AJAX error: save color"` |
| R-09 | `aff-app.js` | `AFF.CatMixin._duplicateCategory` | Empty `.catch(function () {})` swallows duplication AJAX errors silently | Add `console.warn('[AFF] duplicateCategory AJAX error')` at minimum |
| R-10 | `aff-colors.js`, `aff-variables.js` | `_filterRows`, `_initCatDrag` | 100%-identical implementations in both files | Move both to `AFF.CatMixin` |
| R-11 | `aff-panel-top.js` | `_applyNewVars`, `_applyImport` | ~80-line value-classification heuristic (color/font/number detection) duplicated verbatim | Extract to `AFF.Utils.classifyVar(value, elUnit) → { type, subgroup, format }` |
| R-12 | `aff-app.js` | `AFF.VarDrag.rowKey` | Identical to `AFF.Utils.rowKey` | Delete `AFF.VarDrag.rowKey`; update the three internal call sites to `AFF.Utils.rowKey` |
| R-13 | `aff-panel-top.js` | `_bindTooltips` lines 170–187 | Empty `[].forEach(...)` block — dead code that never executes | Delete the entire `[].forEach(function (el) { ... })` block |
| R-14 | `aff-panel-top.js` | `_buildCatsEditorHtml`, `_bindCatsEditor`, `_parseLines` | Three methods that are never called from within the file | Delete all three |
| R-15 | `aff-colors.js` | `_bindInlineEditing` | ~200-line function handling 6 event types | Split into `_bindNameEditing`, `_bindValueEditing`, `_bindFormatEditing`, `_bindCategoryEditing`, `_bindTabNavigation` |
| R-16 | `class-aff-css-parser.php` | `find_root_blocks` | Regex `[^}]+` fails on nested braces | See TECH-DEBT.md A-05 |
| R-17 | `aff-app.js` | Variable name validation | Colors allows `--`-prefixed names; Variables does not — inconsistent regex | Unify on a single regex in `AFF.Utils.validateVarName()` used by both modules |
| R-18 | `class-aff-ajax-handler.php` | All 26 endpoints | God class — four distinct concern groups in one file | Split into `AFF_Ajax_File`, `AFF_Ajax_Sync`, `AFF_Ajax_Variable`, `AFF_Ajax_Project` — each registered from `AFF_Loader::init()` |
| R-19 | `class-aff-css-parser.php` | `get_active_kit_id()` | Declared `public static`, called via `$this->` internally | Change internal calls to `self::get_active_kit_id()` for clarity |
| R-20 | `aff-app.js`, `aff-panel-top.js` | `aff_get_settings` double call on page load | DP-05 | See TECH-DEBT.md DP-05 |
| R-21 | `class-aff-ajax-handler.php` | `copy_project` / `generate_backup_filename` | `sleep()` loop for filename uniqueness | See TECH-DEBT.md A-04 |
| R-22 | `aff-app.js` | `AFF.state.globalConfig` | Aliased to same object as `config` — latent mutation risk | See TECH-DEBT.md A-02 |

---

### Low Priority

| ID | File | Location | Issue | Fix |
|----|------|----------|-------|-----|
| R-23 | `aff-app.js` | `AFF.state` initial declaration | `metadata` undeclared | See TECH-DEBT.md A-03 |
| R-24 | `aff-app.js` | `applyA11y()` line 1278 | Font-size sentinel `16` mismatches PHP default `14` | See TECH-DEBT.md C-04 |
| R-25 | `aff-panel-right.js` | Module header | `@package ElementorFrameworkForge` | See TECH-DEBT.md L-01 |
| R-26 | `aff-panel-top.js` | `_effPickerDB`, `_effPickerDbOpen`, `_effPickerGet`, `_effPickerSave` | `_eff` prefix — migration artifact | See TECH-DEBT.md L-06 |
| R-27 | `admin/js/` | `_patch_panel_right.js` | Node.js patch script committed to plugin repo | See TECH-DEBT.md D-01 |
| R-28 | Multiple JS files | `aff_save_color` | Endpoint name used for all variable types (Colors, Fonts, Numbers) — misleading for non-color variables | Rename to `aff_save_variable` in a coordinated PHP + JS commit |
| R-29 | `aff-app.js` | `AFF.App.loadConfig` | Category string-array → object normalization done client-side | See TECH-DEBT.md A-07 |
| R-30 | `aff-panel-right.js` | `_openSyncOptionsDialog` lines ~1129, 1134, 1139 | Missing spaces: "AFFshould", "AFFvalues", "AFFedits" | See TECH-DEBT.md C-06 |

---

## Summary

The plugin is well-structured at the macro level: the PHP layer has a clean
composition root, each class has a clear stated purpose, and the JS modules
are consistently patterned. Documentation and inline comments are above average
for a solo project. The security fundamentals (nonce verification, sanitization,
escaping) are present and correct for the most part.

The main technical liabilities are:

1. **The `aff-colors.js` / `aff-variables.js` structural duplication** (R-10,
   R-11) — the largest maintenance burden. The Variables factory was a step
   toward unification but Colors was not brought into the same pattern.

2. **The `AFF.EditSpace.loadCategory` monkey-patch chain** (R-01) — the
   invisible fragility that most risks silent breakage on future changes.

3. **The two open security gaps** (R-02 unescaped search results, R-03 missing
   capability check in AJAX layer) — both are low-risk in practice but should
   not remain open.

4. **`AFF_Ajax_Handler` god class** (R-18) — will become increasingly painful
   as new features are added.

The TECH-DEBT.md document already captures most medium/low issues accurately
and with good fix guidance. The new findings in this review are R-01, R-02,
R-03, R-04, R-05, R-07, R-08, R-09, R-11, R-12, R-13, R-14, R-15, R-17,
R-19, R-28.
