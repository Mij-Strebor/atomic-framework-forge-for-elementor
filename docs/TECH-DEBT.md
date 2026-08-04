# AFF Technical Debt Report
# Atomic Framework Forge for Elementor — v1.4.0
# Reviewed: 2026-05-18 · Re-verified against current source: 2026-08-02

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

### C-02 — Double `verify_request()` in six Phase 2 endpoints — FIXED

**File:** `includes/class-aff-ajax-handler.php`

The explicit `$this->verify_request()` call has been removed from all six
Phase 2 endpoints. `with_store()` owns the security check and documents
this contract in its PHPDoc. Affected endpoints were:
`ajax_aff_save_category`, `ajax_aff_delete_category`, `ajax_aff_reorder_categories`,
`ajax_aff_save_color`, `ajax_aff_delete_color`, `ajax_aff_generate_children`.

---

### C-03 — `AFF.PanelRight._escHtml()` is weaker than `AFF.Utils.escHtml()` — FIXED

**Status: FIXED (2026-08-02).** `_escHtml` and `_escAttr` deleted from
`aff-panel-right.js`. All 19 call sites repointed to `AFF.Utils.escHtml()` /
`AFF.Utils.escAttr()` (the DOM-based, fully-correct implementations in
`aff-app.js`). Verified script load order is safe: `aff-panel-right.js` is
enqueued before `aff-app.js`, but every call site is inside an event-triggered
function (modal renders on user action), never top-level/init code — by
execution time `AFF.Utils` is already defined.

---

### C-04 — Font-size magic number mismatch in `applyA11y()` — FIXED

**Status: FIXED (2026-08-02).** Root cause was genuinely ambiguous — the CSS
(`aff-preferences.css`) has override rules for 14/15/17/18 but none for 16,
meaning 16px was always the true "no override" baseline; but PHP's
`AFF_Settings::$defaults['ui_font_size']` said `14`, and the test plan
(`docs/UNIT-TESTS.md`) also documented `14` as expected. Confirmed with Jim
which was actually intended: **16px is correct.** Changed
`AFF_Settings::$defaults['ui_font_size']` from `14` to `16`; updated
`docs/UNIT-TESTS.md`'s expected-default row to match; cleaned up the now-stale
"why" comment at the JS call site (the JS sentinel itself was already correct
and didn't need to change).

---

### C-05 — `.eff.json` extension still generated in active code paths — FIXED

**Status: FIXED.** All generation sites updated to `.aff.json`. Backward-compat
strip regexes `(?:\.aff|\.eff)+(?:\.json)?` left in place so old files still
load. L-07 and L-08 doc comments fixed in the same pass.

---

### C-06 — String concatenation gaps in `_openSyncOptionsDialog` modal copy — FIXED

**Status: FIXED (confirmed 2026-08-02).** All three strings now read correctly:
"Add new variables; keep existing AFF values unchanged." and "Remove all
existing variables and import fresh from Elementor. Discards AFF edits." The
sync dialog itself was substantially rewritten as part of the toolbar/top-bar
restructure (see git log), which appears to have carried this fix along.

---

## 2. High — Dead Code

### D-01 — `_patch_panel_right.js` committed to the repo — FIXED

**Status: FIXED (2026-08-03).** Deleted, along with a second, previously
undocumented dead patch script found in the same pass —
`admin/js/_patch.ps1` (a PowerShell equivalent, even older: its one hardcoded
path referenced the pre-rename `eff` project directory). Both were found via
WordPress Plugin Check flagging "illegal files" ahead of the WordPress.org
submission — real, ship-blocking findings, not false positives. Also added
`vendor/`, `tests/`, `composer.json`, `composer.lock` to `.distignore` as a
defense-in-depth measure (the actual `vendor/` false-positive Plugin Check
also flagged was already `.gitignore`d and never shipped, but hadn't been
excluded from a raw-directory zip build either).

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

### DP-01 — Three independent HTML-escape implementations — FIXED

**Status: FIXED** (same fix as C-03 — see there for details). Only
`AFF.Utils.escHtml()` and `AFF.Utils.escAttr()` remain; the weaker
`aff-panel-right.js` locals are deleted.

---

### DP-02 — Number format-unit map defined twice in `aff-panel-right.js` — FIXED

**Status: FIXED (2026-08-02).** Hoisted to a single module-level
`AFF_FORMAT_UNITS` constant at the top of the IIFE; both call sites
(`_openCommitSummaryDialog`, `_executeCommit`) now reference it. Fixed
proactively ahead of the upcoming Classes work, since Classes will likely need
the same CSS-unit vocabulary — one source of truth now avoids a third
duplicate appearing later.

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

### DP-05 — `aff_get_settings` called on every page load, from multiple sites — OPEN, WORSE THAN DOCUMENTED

**Files:** `admin/js/aff-app.js` and `admin/js/aff-panel-top.js`

**Re-verified 2026-08-02: `aff-panel-top.js` now has three separate `aff_get_settings`
call sites** (lines ~94, ~669, ~842), not the one originally documented — plus
`aff-app.js`'s own call (still marked with its original "why" comment at line 2138).
Not yet confirmed whether the two newer PanelTop calls fire on every page load or
only in specific interaction paths (e.g. opening a picker) — needs a quick trace
before assuming this is four-on-load rather than one-on-load-plus-three-on-demand.
Re-scope the fix once that's confirmed; the original one-call consolidation plan
may need to become a shared cached-settings accessor instead of a single
init-time call if some of these are legitimately triggered by user action.

**Original fix, still the right direction if load-time calls are confirmed
redundant:** Make one call in `AFF.App`'s init, then pass the settings object to
`AFF.PanelTop._applyTooltipSettings(settings)` rather than having PanelTop
fetch independently.

---

## 4. Medium — Architecture & Technical Debt

### A-01 — `with_store()` calling convention is ambiguous in PATTERNS.md — FIXED (as documentation)

**Status: FIXED (confirmed 2026-08-02).** `with_store()`'s PHPDoc now explicitly
states: "Handles nonce verification and capability check internally — callers
must NOT call verify_request() before with_store(). Security is owned here."
Checked all 7 current `with_store()` call sites — none call `verify_request()`
separately beforehand. The ambiguity is resolved; PATTERNS.md §6 itself wasn't
re-checked for a matching update, but the authoritative doc comment is now
unambiguous at the source.

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

### A-03 — `AFF.state.metadata` undeclared in initial state — FIXED

**Status: FIXED (2026-08-02).** Added `metadata: {}` to the initial `AFF.state`
declaration. Verified safe first: every existing guard (`metadata &&
metadata.x`, `metadata || {}`, `if (!metadata) metadata = {}`) produces an
identical result whether `metadata` starts as `undefined` or `{}` — no
behavior changed anywhere. Fixed proactively ahead of the Classes work, which
will add more state fields (`classes`/`components` are already declared as
empty arrays) — establishes "every field declared upfront" as the pattern
before more fields join un-declared.

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

### A-06 — `list_projects()` sort comparator re-globs the filesystem O(N log N) times — FIXED

**Status: FIXED (confirmed 2026-08-02).** `list_projects()` now precomputes a
`_sort_key` (the latest backup's filename, which encodes its creation
timestamp) for each project during the initial build pass, then sorts with a
plain `strcmp` comparator — zero additional filesystem calls during the sort
itself. The internal `_sort_key` field is stripped before the array is
returned. Matches the spirit of the originally recommended fix.

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

### L-03 — `AFF_Data_Store` baseline methods describe `md5()` as "WP adapter" — FIXED

**Status: FIXED (confirmed 2026-08-02).** The section header is now
"BASELINE ADAPTER METHODS" — no longer claims `md5()` (a plain PHP function)
is WordPress-specific. `md5()` usage itself is unchanged, which is correct;
this was purely a comment-accuracy issue.

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

### L-07 — Stale `.eff.json` references in doc comments — FIXED

**Status: FIXED.** `_autoLoadFile` param updated to `.aff.json`. The `_loadFile`
comment at line 93 intentionally retains `.eff.json` in its example path — it
describes a legacy file that can still be read (backward compat).

---

### L-08 — Stale `_getFilename()` reference in `_saveFile` doc comment — FIXED

**Status: FIXED.** `_saveFile` JSDoc now describes the actual behavior: strips
`.aff`/`.eff` extensions and path prefixes from the name before saving.

---

## 6. Summary Table

| ID | Severity | Status | Category | File(s) | One-line description |
|----|----------|--------|----------|---------|----------------------|
| C-01 | **Critical** | STUBBED | Feature stub | `aff-panel-right.js` | V3 import button intentionally not wired — future feature |
| C-02 | **Critical** | FIXED | Bug | `class-aff-ajax-handler.php` | Double `verify_request()` removed from 6 Phase 2 endpoints |
| C-03 | **Critical** | FIXED | Security | `aff-panel-right.js` | Weak local escape fns deleted; all call sites use `AFF.Utils.escHtml/escAttr` |
| C-04 | **Critical** | FIXED | Bug | `class-aff-settings.php` | PHP default changed 14→16 to match CSS/JS (16 confirmed correct) |
| C-05 | **Critical** | FIXED | Bug | `aff-colors.js`, `aff-panel-top.js` | `.eff.json` generation replaced with `.aff.json` |
| C-06 | **Critical** | FIXED | Bug | `aff-panel-right.js` | Missing spaces in sync dialog — fixed, likely as part of dialog rewrite |
| D-01 | **High** | FIXED | Dead code | `_patch_panel_right.js`, `_patch.ps1` | Both dead patch scripts deleted; found via real Plugin Check "illegal files" flag |
| D-02 | **High** | FIXED | Dead code | `class-aff-data-store.php` | `list_projects()` v1 removed; v2 renamed to `list_projects` |
| D-03 | **High** | FIXED | Dead code | `aff-panel-right.js` | `_getFilename()` deleted; stale doc comment fixed (L-08) |
| D-04 | **High** | STUBBED | Feature stub | `aff-panel-right.js` | `_bindV3ColorsBtn()` dormant — intentional V3 feature stub |
| DP-01 | **High** | FIXED | Duplication | `aff-app.js`, `aff-panel-right.js` | Weak locals deleted; single `AFF.Utils` escape pair used everywhere |
| DP-02 | **High** | FIXED | Duplication | `aff-panel-right.js` | Hoisted to single `AFF_FORMAT_UNITS` module-level constant |
| DP-03 | **High** | OPEN | Duplication | `aff-panel-right.js` | ~40 lines of state-loading code in `_loadFile` and `_autoLoadFile` |
| DP-04 | **High** | OPEN | Duplication | `class-aff-css-parser.php`, `class-aff-ajax-handler.php` | Two independent `:root` CSS block parsers |
| DP-05 | **High** | OPEN — worse | Duplication | `aff-app.js`, `aff-panel-top.js` | `aff_get_settings` now has 4 call sites, not 2 — needs re-scoping before fixing |
| A-01 | **Medium** | FIXED | Architecture | `class-aff-ajax-handler.php` | `with_store` calling convention now unambiguous in its own PHPDoc |
| A-02 | **Medium** | OPEN | Architecture | `aff-app.js` | `globalConfig` and `config` aliased to same object; latent mutation risk |
| A-03 | **Medium** | FIXED | Architecture | `aff-app.js` | `metadata: {}` added to initial state; verified no guard behavior changed |
| A-04 | **Medium** | OPEN | Architecture | `class-aff-ajax-handler.php` | `copy_project` sleeps up to 10s for filename collision avoidance |
| A-05 | **Medium** | OPEN | Architecture | `class-aff-css-parser.php` | `find_root_blocks` regex fails on nested braces in `:root` blocks |
| A-06 | **Medium** | FIXED | Architecture | `class-aff-data-store.php` | `list_projects` sort now uses a precomputed sort key, zero extra filesystem calls |
| A-07 | **Medium** | OPEN | Architecture | `aff-app.js` | Category normalization done client-side, not server-side |
| L-01 | Low | OPEN | Naming | `aff-panel-right.js` | Wrong `@package` tag — `ElementorFrameworkForge` |
| L-02 | Low | FIXED | Naming | `class-aff-data-store.php` | `list_projects_v2` name resolved — function renamed |
| L-03 | Low | FIXED | Naming | `class-aff-data-store.php` | Section renamed "BASELINE ADAPTER METHODS" — no longer misclaims md5() as WP-specific |
| L-04 | Low | OPEN | Naming | `aff-app.js`, CLAUDE.md | `hasUnsavedChanges` / `isDirty` / `dirty` — three names for one concept |
| L-05 | Low | OPEN | Naming | Multiple JS files | `/* global AFFData */` comment inconsistently applied |
| L-06 | Low | OPEN | Naming | `aff-panel-top.js` | `_eff` prefix on IndexedDB helpers — should be `_aff` |
| L-07 | Low | FIXED | Naming | `aff-panel-right.js` | Stale `.eff.json` references in doc comments updated |
| L-08 | Low | FIXED | Naming | `aff-panel-right.js` | `_saveFile` doc comment updated; `_getFilename()` reference removed |

---

## Recommended Fix Order (updated 2026-08-03)

~~C-02, C-03, C-04, C-06, DP-01, DP-02, D-01, A-01, A-03, A-06, D-02, D-03,
L-02, L-03, L-07, L-08~~ — all confirmed FIXED. Remaining, in priority order:

1. **DP-05** — Trace all 4 current `aff_get_settings` call sites first (this grew
   since the original audit — re-scope before assuming a simple 2-call merge fixes it)
2. **A-04** — Fix backup filename collision (add microseconds, remove sleep)
3. **DP-03** — Extract `_applyLoadedData` helper
4. **A-02** — Deep-clone `globalConfig`; document in PATTERNS.md
5. **L-01**, **L-04**, **L-05**, **L-06** — Cosmetic fixes in a single cleanup commit

Items A-05 and A-07, and DP-04, still require more careful design decisions
before implementing and should be discussed first.

C-01 and D-04 are intentional stubs — wire up when the V3 import feature ships.
