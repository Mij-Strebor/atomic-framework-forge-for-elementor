# AFF Technical Debt Report
# Atomic Framework Forge for Elementor — v0.4.2-beta
# Reviewed: 2026-04-19

> **Scope:** All PHP and JS source files. CSS and SVG assets excluded.
> Issues are graded **Critical / High / Medium / Low**. Critical = active bug or
> security weakness. High = will cause confusion or incorrect behaviour under
> normal use. Medium = code smell with measurable maintenance cost. Low = cleanup.
>
> Status markers: **OPEN** = not yet addressed. **FIXED** = resolved in source.
> **STUBBED** = intentionally dormant pending a future feature.

---

## Contents

1. [Critical — Active Bugs](#1-critical--active-bugs)
2. [High — Dead Code](#2-high--dead-code)
3. [High — Duplication](#3-high--duplication)
4. [Medium — Architecture & Technical Debt](#4-medium--architecture--technical-debt)
5. [Low — Naming & Cosmetic](#5-low--naming--cosmetic)
6. [Summary Table](#6-summary-table)

---

## 1. Critical — Active Bugs

### C-01 — `AFF.PanelRight._bindV3ColorsBtn()` — STUBBED / INTENTIONAL

**File:** `admin/js/aff-panel-right.js`  
**Status:** STUBBED — Not a bug. The V3 Global Colors import feature is planned
but not yet shipping. `_bindV3ColorsBtn()` and `_openV3ImportDialog()` are
deliberately dormant stubs. The button element does not exist in the current
admin template, so `init()` correctly omits the binding. A code comment has been
added to the method explaining this intent.

**When the feature ships:** Add to `init()`:
```js
this._v3ColorsBtn = document.getElementById('aff-btn-v3-colors');
this._bindV3ColorsBtn();
```

---

### C-02 — Double `verify_request()` in six Phase 2 endpoints — OPEN

**File:** `includes/class-aff-ajax-handler.php`

`with_store()` calls `$this->verify_request()` as its first line (line 1539).
Every Phase 2 endpoint that uses `with_store()` also calls `verify_request()`
explicitly before the `with_store()` call. The nonce is checked twice per request.

Affected endpoints:
- `ajax_aff_save_category()` — line 622
- `ajax_aff_delete_category()` — line 658
- `ajax_aff_reorder_categories()` — line 685
- `ajax_aff_save_color()` — line 714
- `ajax_aff_delete_color()` — line 817
- `ajax_aff_generate_children()` — line 851

While WordPress nonces are not single-use, double-checking adds unnecessary
overhead and contradicts the contract implied by `with_store`. It also obscures
which layer owns the security check. A "why" comment has been added to each
call site and to `with_store()` itself to make this visible.

**Fix — two valid options:**

Option A (preferred): Remove the explicit `verify_request()` call from all six
endpoints. `with_store()` already handles it.

Option B: Remove `verify_request()` from inside `with_store()` and document
that callers are responsible. Update PATTERNS.md.

---

### C-03 — `AFF.PanelRight._escHtml()` is weaker than `AFF.Utils.escHtml()` — OPEN

**File:** `admin/js/aff-panel-right.js` line 1851

`_escHtml` in PanelRight only escapes `&`, `<`, `>`. It does NOT escape `"` or
`'`. This means it is unsafe for use inside HTML attribute values. Several
places in `_showCopyForm()` and other methods use `_escHtml` where
`_escAttr` should be used — and `_escAttr` itself only escapes `&` and `"`,
missing single-quote in attribute contexts.

`AFF.Utils.escHtml()` in `aff-app.js` uses `div.textContent = str; return
div.innerHTML` — the browser-native DOM escape, which handles every character
correctly and is authoritative.

**Fix:** Delete `_escHtml` and `_escAttr` from `aff-panel-right.js`. Replace
all call sites with `AFF.Utils.escHtml()`. For attribute values, use
`AFF.Utils.escHtml()` — the DOM method escapes `"` as `&quot;` which is safe
inside double-quoted attributes.

---

### C-04 — Font-size magic number mismatch in `applyA11y()` — OPEN

**File:** `admin/js/aff-app.js` line 1183

```js
var fs = parseInt(settings.ui_font_size, 10) || 16;
if (fs !== 16) {
    app.setAttribute('data-aff-font-size', String(fs));
} else {
    app.removeAttribute('data-aff-font-size');
}
```

The JS treats `16` as "attribute absent = default". But the PHP default for
`ui_font_size` is `14` (`AFF_Settings::$defaults`). On every page load with an
unmodified setting, `fs = 14`, `14 !== 16` is true, and `data-aff-font-size="14"`
is always set — never absent. The CSS rule that targets the absent-attribute
case (the default) will never fire for a fresh install. A "why" comment has been
added at the call site to document this mismatch.

**Fix:** Either change the PHP default to `16`, or change the JS sentinel to
`14`. Decide which is the "no override" value and make both layers agree.

---

### C-05 — `.eff.json` extension still generated in active code paths — OPEN

**Files:** `aff-colors.js`, `aff-panel-top.js`

The project migrated from `.eff.json` to `.aff.json`. Backward-compat regex
strips both extensions (fine). But some paths still **generate** `.eff.json`
names:

| File | Line | Code |
|------|------|------|
| `aff-colors.js` | 4205 | Default export filename: `elementor-variables.eff.json` |
| `aff-colors.js` | 4224 | `if (!/\.eff\.json$/.test(filename)) { filename += '.eff.json'; }` |
| `aff-panel-top.js` | 1021 | `AFF.state.currentFile = slugged + '.eff.json';` |
| `aff-panel-top.js` | 1642 | Builds export filename ending in `.eff.json` |

Files exported from the Export dialog, and the `currentFile` set after a
top-panel action, will still carry the old extension. The server strips it, so
functionality is not broken, but generated filenames displayed to the user are
wrong. (Note: `aff-panel-right.js` no longer generates `.eff.json` — D-03 was fixed.)

**Fix:** Replace all `'.eff.json'` generation with `'.aff.json'`. Keep the
backward-compat strip regexes `(?:\.aff|\.eff)+(?:\.json)?` in place so old
files still load.

---

### C-06 — String concatenation gaps in `_openSyncOptionsDialog` modal copy — OPEN

**File:** `admin/js/aff-panel-right.js` lines 1129, 1134, 1139

Three strings in the sync dialog body have the product name jammed against the
following word, missing a space:

| Line | Actual | Should be |
|------|--------|-----------|
| 1129 | `"AFFshould handle"` | `"AFF should handle"` |
| 1134 | `"keep existing AFFvalues unchanged"` | `"keep existing AFF values unchanged"` |
| 1139 | `"Discards AFFedits"` | `"Discards AFF edits"` |

This is visible to the user whenever the Fetch Elementor Data button is clicked.
Likely caused by a find-and-replace that removed spaces when inserting the brand name.

**Fix:** Insert the missing space in each of the three strings.

---

## 2. High — Dead Code

### D-01 — `_patch_panel_right.js` committed to the repo — OPEN

**File:** `admin/js/_patch_panel_right.js`

A Node.js script that modifies `aff-panel-right.js` using regex string
replacement. It is not enqueued, not documented, and not part of any build
process. Its presence implies that at some point source files were being
modified by running a patching script rather than by direct editing.

This file has no place in a production plugin repo. It is dead weight, confuses
any future reader, and its regex patterns are fragile — a whitespace change in
the target file would silently produce a non-patched output.

**Fix:** Delete the file. If the edits it describes were intended as a guide for
future changes, move the description to a HANDOFF or RECOVERY-LOG entry.

---

### D-02 — `AFF_Data_Store::list_projects()` (v1) superseded but not removed — FIXED

**Status: FIXED.** `list_projects_v2()` has been renamed to `list_projects()` and
the original flat-file v1 implementation has been removed. The AJAX handler
correctly calls `AFF_Data_Store::list_projects($dir)`. L-02 (naming confusion)
is resolved as a consequence.

---

### D-03 — `AFF.PanelRight._getFilename()` dead code — FIXED

**Status: FIXED.** The `_getFilename()` method has been deleted. The save flow
sends `project_name` to the server and the server derives the filename, which
was always the correct approach.

**Residue (Low):** The doc comment on `_saveFile` (line 296) still says
_"Derives the filename from the human name via `_getFilename()`"_ — this
reference is now stale and should be updated when C-05 cleanup touches this area.

---

### D-04 — `AFF.PanelRight._bindV3ColorsBtn()` — STUBBED / INTENTIONAL

**Status: STUBBED.** See C-01. `_bindV3ColorsBtn()` is a deliberate feature stub,
not dead code. The method and its associated `_openV3ImportDialog()` are complete
but intentionally not wired into `init()`. This is correct until the V3 import
feature ships.

---

## 3. High — Duplication

### DP-01 — Three independent HTML-escape implementations — OPEN

The codebase has three different HTML-escape functions with different character
coverage:

| Location | Function | Escapes |
|----------|----------|---------|
| `aff-app.js:78` | `AFF.Utils.escHtml(str)` | All characters (browser DOM method) |
| `aff-app.js:93` | `AFF.Utils.escAttr(str)` | `& < > " '` (manual replace) |
| `aff-panel-right.js:1851` | `_escHtml(str)` | `& < >` only |
| `aff-panel-right.js:1863` | `_escAttr(str)` | `& "` only |

`AFF.PanelRight._escHtml` is weaker than `AFF.Utils.escHtml` (see C-03).
`AFF.PanelRight._escAttr` is weaker than `AFF.Utils.escAttr` (misses `'`).

**Fix:** Use `AFF.Utils.escHtml()` and `AFF.Utils.escAttr()` everywhere. Delete
`_escHtml` and `_escAttr` from `aff-panel-right.js`.

---

### DP-02 — Number format-unit map defined twice in `aff-panel-right.js` — OPEN

**File:** `admin/js/aff-panel-right.js`

Two identical objects defined in the same file with different names:

```js
// In _openCommitSummaryDialog (~line 1342):
var _FMT = { PX: 'px', '%': '%', EM: 'em', REM: 'rem', VW: 'vw', VH: 'vh', CH: 'ch' };

// In _executeCommit (~line 1529):
var FORMAT_UNIT = { 'PX': 'px', '%': '%', 'EM': 'em', 'REM': 'rem', 'VW': 'vw', 'VH': 'vh', 'CH': 'ch' };
```

If a new unit is added (e.g., `dvh`, `svh`, `cqi`), it must be added in both
places — and will inevitably be missed in one. "Why" comments have been added at
both sites cross-referencing each other.

**Fix:** Hoist as a module-level constant at the top of the IIFE:
```js
var AFF_FORMAT_UNITS = { 'PX': 'px', '%': '%', 'EM': 'em', 'REM': 'rem',
                         'VW': 'vw', 'VH': 'vh', 'CH': 'ch' };
```
Reference from both call sites.

---

### DP-03 — State-loading block duplicated between `_loadFile()` and `_autoLoadFile()` — OPEN

**File:** `admin/js/aff-panel-right.js`

`_loadFile` and `_autoLoadFile` share ~40 lines of identical code for applying
a successful server response to `AFF.state`. The only differences are that
`_loadFile` calls `AFF.Modal.close()`, `AFF.App.setDirty(false)`, persists
`last_file` to settings, and shows a "Project created" toast on `res.data.created`,
while `_autoLoadFile` is silent on failure.

"Why" comments have been added at both sites marking the duplication.

**Fix:** Extract a `_applyLoadedData(res, opts)` helper:
```js
_applyLoadedData: function (res, opts) {
    // opts = { silent: false, closeModal: false }
    AFF.state.variables  = res.data.variables  || [];
    // ... shared 40 lines ...
    if (!opts.silent) { AFF.App.setDirty(false); }
    if (opts.closeModal) { AFF.Modal.close(); }
}
```
Both methods call this helper, adding only their own specific post-load steps.

---

### DP-04 — Two independent `:root` CSS block parsers — OPEN

**PHP files:** `class-aff-css-parser.php` and `class-aff-ajax-handler.php`

`AFF_CSS_Parser::find_root_blocks()` (regex) and
`AFF_Ajax_Handler::find_user_root_close_pos()` (strpos loop) both parse `:root`
blocks from raw CSS strings, but are completely independent implementations with
different algorithms and different edge-case behaviour.

If Elementor changes its CSS structure (e.g., nested `:root` blocks, `@layer`),
one parser may handle it and the other may not.

**Fix:** Move all `:root` block parsing into `AFF_CSS_Parser`. Add a method
`find_user_root_close_pos(string $css): int|false` there and have the Ajax
handler delegate to it.

---

### DP-05 — `aff_get_settings` called twice on every page load — OPEN

**Files:** `admin/js/aff-app.js` and `admin/js/aff-panel-top.js`

On `DOMContentLoaded`:
1. `AFF.PanelTop.init()` makes an `aff_get_settings` AJAX call to load tooltip
   preferences (`show_tooltips`, `extended_tooltips`)
2. `AFF.App`'s init also calls `aff_get_settings` to get `last_file` for
   auto-loading and to call `applyA11y()`

Both calls fire within ~100ms of each other. A "why" comment has been added at
the `AFF.App` call site.

**Fix:** Make one call in `AFF.App`'s init, then pass the settings object to
`AFF.PanelTop._applyTooltipSettings(settings)` rather than having PanelTop
fetch independently.

---

## 4. Medium — Architecture & Technical Debt

### A-01 — `with_store()` calling convention is ambiguous in PATTERNS.md — OPEN

**Files:** `includes/class-aff-ajax-handler.php`, `PATTERNS.md`

PATTERNS.md §6 shows the canonical pattern as calling `verify_request()` always
first. But `with_store()` calls `verify_request()` internally. Any endpoint
using `with_store()` that also calls `verify_request()` first gets double
verification (C-02). The PATTERNS.md rule is incomplete.

**Fix:** Choose one approach and document it clearly. Recommended: remove
`verify_request()` from inside `with_store()`, require all callers to call it
explicitly. This makes the security check visible at every call site.

---

### A-02 — `AFF.state.globalConfig` is aliased to the same object as `config` — OPEN

**File:** `admin/js/aff-app.js` line 1282

```js
AFF.state.config = cfg;
AFF.state.globalConfig = cfg;  // same object reference
```

Both fields point to the same object until `_loadFile()` replaces
`AFF.state.config` with the file's config. If any code mutates
`AFF.state.config` before a file is loaded, those mutations also affect
`globalConfig` — which is intended to be a stable baseline. A "why" comment
has been added at the assignment site.

**Fix:** Store `globalConfig` as a deep copy:
```js
AFF.state.globalConfig = JSON.parse(JSON.stringify(cfg));
```
Document the pattern: `config` = mutable per-file config; `globalConfig` =
immutable baseline from WordPress options, used to backfill missing category
arrays when loading older project files.

---

### A-03 — `AFF.state.metadata` undeclared in initial state — OPEN

**File:** `admin/js/aff-app.js` line 31

`AFF.state` is initialized without a `metadata` field. `metadata` is added
dynamically by `_loadFile()`. All access is guarded with `AFF.state.metadata &&`
throughout `aff-panel-right.js`. This is defensively correct but inconsistent —
every other state field is declared upfront. A comment has been added to the
initial state object.

**Fix:** Add `metadata: {}` to the initial `AFF.state` declaration.

---

### A-04 — Backup filename collision requires `sleep()` in `copy_project` — OPEN

**File:** `includes/class-aff-ajax-handler.php` line ~570

`generate_backup_filename()` uses `gmdate('Y-m-d_H-i-s')` — one-second
resolution. When copying a project with multiple backup files, the loop can
collide on the same timestamp and must sleep up to 10 seconds to generate unique
names. A "why" comment has been added at the `sleep()` call site.

**Fix:** Add microseconds or a sequence counter to the filename:
```php
public static function generate_backup_filename( string $slug ): string {
    return $slug . '_' . gmdate( 'Y-m-d_H-i-s' ) . '_' . substr( uniqid(), -4 ) . '.aff.json';
}
```
This eliminates the sleep loop entirely.

---

### A-05 — `find_root_blocks()` regex fails on nested braces in `:root` blocks — OPEN

**File:** `includes/class-aff-css-parser.php`

```php
$pattern = '/:root\s*\{([^}]+)\}/';
```

`[^}]+` means the regex only captures the block up to the first nested `}`. Any
`:root` block containing a nested rule would be silently truncated. Elementor's
current CSS format works with this regex, but it is a brittle assumption.

**Fix:** Use the more robust strpos-based approach from `find_user_root_close_pos()`
in the Ajax handler (see DP-04). Consolidate into a single correct parser in
`AFF_CSS_Parser`.

---

### A-06 — `list_projects()` sort comparator re-globs the filesystem O(N log N) times — OPEN

**File:** `includes/class-aff-data-store.php` line 1026

The `usort` comparator calls `glob()` and `filemtime()` for both elements on
every comparison. For N projects, a comparison-based sort makes O(N log N) calls
to `glob()`. For 10 projects ~34 glob calls; for 50 projects ~280 glob calls.
A "why" comment has been added at the sort site.

**Fix:** In `list_project_backups()`, also return the raw `filemtime()` of the
latest backup as an integer. Sort `$list` directly on that integer field. No
extra filesystem calls needed.

---

### A-07 — Category normalization done client-side in `loadConfig()` — OPEN

**File:** `admin/js/aff-app.js`

`loadConfig()` normalizes `fontCategories` and `numberCategories` from
`aff-defaults.json` format (array of strings) to `{id, name, order, locked}`
objects. This normalization runs in the AJAX response handler, making it
invisible and fragile. If the server ever returns pre-normalized data, the
normalization runs again (harmlessly but wastefully).

**Fix:** Normalize server-side in `AFF_Ajax_Handler::ajax_aff_get_config()` so
the client always receives the fully-structured format.

---

## 5. Low — Naming & Cosmetic

### L-01 — Wrong `@package` tag in `aff-panel-right.js` — OPEN

**File:** `admin/js/aff-panel-right.js` line 12

```
* @package ElementorFrameworkForge
```

Should be:
```
* @package AtomicFrameworkForge
```

---

### L-02 — `list_projects_v2()` name was misleading — FIXED

**Status: FIXED** (consequence of D-02). `list_projects_v2()` has been renamed to
`list_projects()` and the original v1 removed.

---

### L-03 — `AFF_Data_Store` baseline methods describe `md5()` as "WP adapter" — OPEN

**File:** `includes/class-aff-data-store.php`

The baseline option key uses `md5( $filename )`. `md5()` is a plain PHP function,
not a WordPress function. The "WP adapter" section comment implies it would need
replacement when porting — it would not. Minor comment accuracy issue.

---

### L-04 — `AFF.state.hasUnsavedChanges` vs `isDirty` vs `dirty` naming inconsistency — OPEN

**Files:** `aff-app.js`, `aff-panel-right.js`, `class-aff-data-store.php`

Three names for the same concept across layers. Consistent naming would make
cross-layer code easier to follow.

---

### L-05 — `/* global AFFData */` comment inconsistently applied — OPEN

`AFFData` is used in `aff-panel-right.js`, `aff-panel-top.js`, and `aff-app.js`.
The JSDoc lint comment appears in some files but not others. Not a runtime issue.

---

### L-06 — `_eff` prefix on IndexedDB helpers in `aff-panel-top.js` — OPEN

**File:** `admin/js/aff-panel-top.js` line 25

`_effPickerDB`, `_effPickerDbOpen`, `_effPickerGet`, `_effPickerSave` use the
old `_eff` project prefix. The project prefix is `aff`. Migration artifact.

---

### L-07 — Stale `.eff.json` references in doc comments — OPEN

**File:** `admin/js/aff-panel-right.js` lines 93, 196

Two JSDoc comments still reference `.eff.json` file paths:
- `_loadFile` (line 93): `"path can be a relative backup path (slug/slug_date.eff.json)"`
- `_autoLoadFile` (line 196): `"Stored .eff.json filename (not a project name)."`

These should be updated to `.aff.json` when C-05 is addressed.

---

### L-08 — Stale `_getFilename()` reference in `_saveFile` doc comment — OPEN

**File:** `admin/js/aff-panel-right.js` line 296

The `_saveFile` JSDoc says _"Derives the filename from the human name via
`_getFilename()`"_ — but `_getFilename` was deleted as part of D-03. The comment
should be updated to describe the actual behavior (server derives the filename
from `project_name`).

---

## 6. Summary Table

| ID | Severity | Status | Category | File(s) | One-line description |
|----|----------|--------|----------|---------|----------------------|
| C-01 | **Critical** | STUBBED | Feature stub | `aff-panel-right.js` | V3 import button intentionally not wired — future feature |
| C-02 | **Critical** | OPEN | Bug | `class-aff-ajax-handler.php` | Double `verify_request()` in 6 Phase 2 endpoints |
| C-03 | **Critical** | OPEN | Security | `aff-panel-right.js` | `_escHtml` missing `"` and `'` — weaker than `AFF.Utils.escHtml` |
| C-04 | **Critical** | OPEN | Bug | `aff-app.js` | Font-size sentinel `16` mismatches PHP default `14` |
| C-05 | **Critical** | OPEN | Bug | `aff-colors.js`, `aff-panel-top.js` | `.eff.json` still generated in active code paths |
| C-06 | **Critical** | OPEN | Bug | `aff-panel-right.js` | Missing spaces: "AFFshould", "AFFvalues", "AFFedits" in sync dialog |
| D-01 | **High** | OPEN | Dead code | `_patch_panel_right.js` | Node.js patch script committed to plugin repo |
| D-02 | **High** | FIXED | Dead code | `class-aff-data-store.php` | `list_projects()` v1 removed; v2 renamed to `list_projects` |
| D-03 | **High** | FIXED | Dead code | `aff-panel-right.js` | `_getFilename()` deleted; stale doc comment remains (L-08) |
| D-04 | **High** | STUBBED | Feature stub | `aff-panel-right.js` | `_bindV3ColorsBtn()` dormant — intentional V3 feature stub |
| DP-01 | **High** | OPEN | Duplication | `aff-app.js`, `aff-panel-right.js` | Four escape implementations with different coverage |
| DP-02 | **High** | OPEN | Duplication | `aff-panel-right.js` | Format-unit map defined twice with different names |
| DP-03 | **High** | OPEN | Duplication | `aff-panel-right.js` | ~40 lines of state-loading code in `_loadFile` and `_autoLoadFile` |
| DP-04 | **High** | OPEN | Duplication | `class-aff-css-parser.php`, `class-aff-ajax-handler.php` | Two independent `:root` CSS block parsers |
| DP-05 | **High** | OPEN | Duplication | `aff-app.js`, `aff-panel-top.js` | `aff_get_settings` called twice on every page load |
| A-01 | **Medium** | OPEN | Architecture | `class-aff-ajax-handler.php`, `PATTERNS.md` | `with_store` calling convention undocumented — callers double-verify |
| A-02 | **Medium** | OPEN | Architecture | `aff-app.js` | `globalConfig` and `config` aliased to same object; latent mutation risk |
| A-03 | **Medium** | OPEN | Architecture | `aff-app.js` | `AFF.state.metadata` undeclared in initial state object |
| A-04 | **Medium** | OPEN | Architecture | `class-aff-ajax-handler.php` | `copy_project` sleeps up to 10s for filename collision avoidance |
| A-05 | **Medium** | OPEN | Architecture | `class-aff-css-parser.php` | `find_root_blocks` regex fails on nested braces in `:root` blocks |
| A-06 | **Medium** | OPEN | Architecture | `class-aff-data-store.php` | `list_projects` sort re-globs filesystem O(N log N) times |
| A-07 | **Medium** | OPEN | Architecture | `aff-app.js` | Category normalization done client-side in AJAX handler |
| L-01 | Low | OPEN | Naming | `aff-panel-right.js` | Wrong `@package` tag — `ElementorFrameworkForge` |
| L-02 | Low | FIXED | Naming | `class-aff-data-store.php` | `list_projects_v2` name resolved — function renamed |
| L-03 | Low | OPEN | Naming | `class-aff-data-store.php` | `md5()` in "WP adapter" section is a plain PHP function |
| L-04 | Low | OPEN | Naming | `aff-app.js`, CLAUDE.md | `hasUnsavedChanges` / `isDirty` / `dirty` — three names for one concept |
| L-05 | Low | OPEN | Naming | Multiple JS files | `/* global AFFData */` comment inconsistently applied |
| L-06 | Low | OPEN | Naming | `aff-panel-top.js` | `_eff` prefix on IndexedDB helpers — should be `_aff` |
| L-07 | Low | OPEN | Naming | `aff-panel-right.js` | Stale `.eff.json` references in doc comments (lines 93, 196) |
| L-08 | Low | OPEN | Naming | `aff-panel-right.js` | `_saveFile` doc comment references deleted `_getFilename()` |

---

## Recommended Fix Order

These can be done independently in any order, but this sequence minimises risk:

1. **C-06** — Fix three missing spaces in sync dialog strings (2-min, no logic change)
2. **C-05** — Replace all `.eff.json` generation with `.aff.json`; fix L-07/L-08 doc comments in the same pass
3. **C-02** — Remove double `verify_request()` calls (mechanical, one-liner each)
4. **DP-02** — Hoist format-unit map to module level (5 min, low risk)
5. **DP-01** / **C-03** — Consolidate escape functions; delete `_escHtml`, `_escAttr`
6. **D-01** — Delete `_patch_panel_right.js`
7. **DP-05** — Merge the two `aff_get_settings` calls
8. **A-04** — Fix backup filename collision (add microseconds, remove sleep)
9. **DP-03** — Extract `_applyLoadedData` helper
10. **C-04** — Align font-size default between PHP and JS
11. **A-02** — Deep-clone `globalConfig`; document in PATTERNS.md
12. **A-03** — Add `metadata: {}` to initial state
13. **A-06** — Fix `list_projects` sort efficiency
14. **L-01**, **L-03–L-06** — Cosmetic fixes in a single cleanup commit

Items A-01, A-05, A-07, and DP-04 require more careful design decisions before
implementing and should be discussed first.

C-01 and D-04 are intentional stubs — wire up when the V3 import feature ships.
