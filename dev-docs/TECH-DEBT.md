# ATFRFO Technical Debt Report
# Atomic Framework Forge for Elementor — v1.4.3 (master) / 2.0.0-beta Classes (develop branch)
# Reviewed: 2026-05-18 · Re-verified against current source: 2026-08-12 (pre-beta pass)

> **Scope:** All PHP and JS source files. CSS and SVG assets excluded.
> Issues are graded **Critical / High / Medium / Low**. Critical = active bug or
> security weakness. High = will cause confusion or incorrect behaviour under
> normal use. Medium = code smell with measurable maintenance cost. Low = cleanup.
>
> Status markers: **OPEN** = not yet addressed. **STUBBED** = intentionally dormant
> pending a future feature. FIXED items are removed from this report once resolved,
> except for two incidents kept permanently in §5 as a record of what happened and
> why it wasn't caught — everything else FIXED lives in git history / commit
> messages, not here.

---

## Contents

1. [Critical](#1-critical)
2. [High — Dead Code / Duplication](#2-high--dead-code--duplication)
3. [Medium — Architecture](#3-medium--architecture)
4. [Low — Naming & Cosmetic](#4-low--naming--cosmetic)
5. [Resolved Incidents — kept as permanent record](#5-resolved-incidents--kept-as-permanent-record)
6. [Recommended Fix Order](#6-recommended-fix-order)

---

## 1. Critical

### C-01 — `ATFRFO.PanelRight._bindV3ColorsBtn()` — STUBBED / INTENTIONAL

**File:** `admin/js/atfrfo-panel-right.js`
**Status:** STUBBED — Not a bug. The V3 Global Colors import feature is planned
but not yet shipping. `_bindV3ColorsBtn()` and `_openV3ImportDialog()` are
deliberately dormant stubs. The button element does not exist in the current
admin template, so `init()` correctly omits the binding.

**When the feature ships:** Add to `init()`:
```js
this._v3ColorsBtn = document.getElementById('atfrfo-btn-v3-colors');
this._bindV3ColorsBtn();
```

---

## 2. High — Dead Code / Duplication

### DP-04 — Two independent `:root` CSS block parsers — OPEN

**PHP files:** `class-atfrfo-css-parser.php` and `class-atfrfo-ajax-handler.php`

`ATFRFO_CSS_Parser::find_root_blocks()` (regex) and
`ATFRFO_Ajax_Handler::find_user_root_close_pos()` (strpos loop) both parse `:root`
blocks from raw CSS strings, but are completely independent implementations with
different algorithms and different edge-case behaviour.

If Elementor changes its CSS structure (e.g., nested `:root` blocks, `@layer`),
one parser may handle it and the other may not.

**Investigated 2026-08-07 while fixing A-05 (see below):** the strpos-based
handler-side parser is **not actually more robust** than the regex — it also
stops at the first `}` after `{`, so it has the identical nested-brace/quoted-
string-containing-`}` bug the regex has, just via a different mechanism.
Swapping one implementation for the other fixes nothing; a real fix needs
brace-depth (and quoted-string) tracking in a single shared method, which is
a deliberate design change, not a mechanical consolidation. Deferred — see A-05.

**Fix:** Once a properly depth-aware `:root` block finder is designed (A-05),
move it into `ATFRFO_CSS_Parser` as the single implementation and have the
Ajax handler delegate to it — this closes DP-04 as a side effect of fixing
A-05 correctly, not as a separate mechanical change.

---

## 3. Medium — Architecture

### A-05 — `find_root_blocks()` regex fails on nested braces in `:root` blocks — OPEN

**File:** `includes/class-atfrfo-css-parser.php`

```php
$pattern = '/:root\s*\{([^}]+)\}/';
```

`[^}]+` means the regex only captures the block up to the first nested `}`. Any
`:root` block containing a nested rule would be silently truncated. Elementor's
current CSS format works with this regex, but it is a brittle assumption.

**Fix:** Use the more robust strpos-based approach from `find_user_root_close_pos()`
in the Ajax handler (see DP-04). Consolidate into a single correct parser in
`ATFRFO_CSS_Parser`. Requires a design discussion first — not a quick fix.

---

### A-07 — Category normalization done client-side in `loadConfig()` — OPEN

**File:** `admin/js/atfrfo-app.js`

`loadConfig()` normalizes `fontCategories` and `numberCategories` from
`atfrfo-defaults.json` format (array of strings) to `{id, name, order, locked}`
objects. This normalization runs in the AJAX response handler, making it
invisible and fragile. If the server ever returns pre-normalized data, the
normalization runs again (harmlessly but wastefully).

**Fix:** Normalize server-side in `ATFRFO_Ajax_Handler::ajax_atfrfo_get_config()` so
the client always receives the fully-structured format. Requires a design
discussion first — not a quick fix.

---

## 4. Low — Naming & Cosmetic

*(No open items in this category as of 2026-08-07 — L-01, L-04, L-05, L-06 fixed.)*

---

## 5. Resolved Incidents — kept as permanent record

These two are FIXED and shipped, but are kept here deliberately (not folded
into git history alone) because each caused real, user-visible breakage that
static review missed, and the prevention lesson is worth keeping visible.

### C-07 — Every AJAX endpoint fatal-errored, undetected through a WP.org submission

**File:** `includes/class-atfrfo-ajax-handler.php`

**Fixed 2026-08-04, v1.4.1.** `register_handlers()` builds callback method
names as `'ajax_' . $action`. The AFF→ATFRFO prefix rename (v1.4.0) updated the
action-name strings in the `$actions` array (`aff_save_file` → `atfrfo_save_file`,
required by WordPress.org's 4-character prefix rule) but never updated the actual
PHP method definitions, which stayed `ajax_aff_*`. Every `wp_ajax_atfrfo_*` hook
pointed at a nonexistent method — Save, Load, Sync, all ~29 endpoints, completely
non-functional. Shipped in v1.4.0 to WordPress.org review undetected, because
Plugin Check is static analysis and never actually fires the hooks; every smoke
test performed that day also used reflection (`method_exists()`), which tests a
method's logic, not whether WordPress's real dispatch table can reach it at all.

Caught by accident days later via a direct `do_action()` dispatch while starting
unrelated Classes work — the first time that day a *real* hook fire was tested
instead of a reflection call. Fixed by renaming all 29 `ajax_aff_*` definitions to
`ajax_atfrfo_*`. v1.4.1 released same day with the fix.

**Prevention:** `/verify-ajax-wiring`, `/verify-js-ajax-actions`, and
`/verify-nonce-consistency` (all `E:\projects\plugins\.claude\commands\`) now exist
specifically to catch this bug class going forward, checking the live WordPress
hook registry rather than static source or reflection. `/verify-ajax-wiring` is now
a mandatory gate in `/push-to-github` (Step 4.5).

---

### C-08 — `ATFRFO_Classes_Reader` read stale/incomplete data on current Elementor

**File:** `includes/class-atfrfo-classes-reader.php`

**Fixed 2026-08-06.** The reader's primary path read the raw
`_elementor_global_classes` post meta key directly, falling back to Elementor's
REST API only if that meta was empty. As of Elementor 4.2.1, Global Classes are
actually stored as individual `Global_Class_Post` posts (see
`Global_Classes_Repository::all_from_posts()` in Elementor's own source) — the
old meta key still exists and still returns *something*, but it's stale/legacy
data that no longer reflects the real class list. Because the fallback logic
only triggered on an *empty* result, and the stale meta was never empty, the
reader silently returned wrong, incomplete data with no error and no signal
anything was wrong.

**Confirmed live on two real sites:** the meta read returned 10 items on both;
the true counts (verified via Elementor's REST API and by calling
`Global_Classes_Repository` directly) were 54 and 73. Every "confirmed N real
classes" result reported during earlier development and testing was reading
this stale data — the sync/merge logic itself was correct throughout, but the
input to it was wrong the whole time.

**Fix:** rewrote the primary read path to call
`\Elementor\Modules\GlobalClasses\Global_Classes_Repository` directly, in-process
— the same class both Elementor's own editor UI and its REST controller use
internally, so it's exactly as authoritative as REST without the HTTP
round-trip. Guarded with `class_exists()` so it degrades gracefully to the REST
fallback on any Elementor version where this class doesn't exist. The raw
meta-blob read was removed entirely, not just demoted — it cannot be
distinguished from a genuinely-empty-and-correct result, so it must never be
part of the trusted fallback chain again. If a future Elementor version
deprecates `Global_Classes_Repository` too, add a new primary path for
whatever replaces it; do not resurrect the meta read.

---

## 6. Recommended Fix Order

**Fixed 2026-08-07:** DP-03 (`_applyLoadedData` helper extracted), DP-05 (the
two load-time `atfrfo_get_settings` calls consolidated — the two
action-triggered call sites in `_openPreferences`/`_openManageProject` were
left alone, they were never the duplication problem), A-04 (uniqid suffix
added to `generate_backup_filename`, sleep loop removed), L-01 (also found and
fixed 3 more instances beyond the one the doc originally listed — `atfrfo-colors.js`,
`atfrfo-variables.js`, `atfrfo-variables.css`), L-04 (JS-side naming unified to
`hasUnsavedChanges`; PHP's unrelated `Data_Store::$dirty` left untouched — different
concept), L-05 (added to `atfrfo-print.js`, `atfrfo-edit-space.js`), L-06 (all 4
IndexedDB helper names renamed `_eff*` → `_aff*`).

**Also fixed since, not previously logged here:** A-08 (`created_at` defaults
to `null` in both `*_defaults()` methods), A-02 (`globalConfig` deep-cloned via
`JSON.parse(JSON.stringify(cfg))` in `atfrfo-app.js`) — both confirmed fixed in
current source during the 2026-08-12 pre-beta pass; this doc had not been
updated to reflect it.

**2026-08-12 Classes card pass (pre-beta):** icon SVG output escaped at point
of echo (WordPress.org review fix, backported to master as well); Classes
category-list comment column no longer a fixed 600px (was clipping the styles/
delete buttons); unused-class badge added to the category list; class detail
card usage section resolves raw Elementor element IDs to widget-type labels
and aggregates per-page counts instead of listing every instance; class card
title no longer forced through `.atfrfo-app h2`'s `text-transform: capitalize`;
style properties broken down by Elementor's own panel section (Layout,
Spacing, Size, Position, Typography, Background, Border, Effects) in that
order, with breakpoint headings reading "Desktop/Tablet/Mobile Device";
variable-referenced values show only the variable name (resolved value moved
to a tooltip); compound props (`dimensions`, `flex`, `border-width`,
`border-radius`, `gap`) broken into one row per field instead of a raw JSON
dump, with variable resolution now recursing into those nested fields
correctly. `box-shadow`, `filter`/`backdrop-filter`, `transform`, and
`transition` remain JSON-dumped — list-of-function-call shapes, deliberately
deferred pending a dedicated renderer, not missed.

Remaining, both deliberately deferred pending a design discussion, not forgotten:

**A-05 and DP-04 are the same underlying fix, deferred together (2026-08-07):**
investigating A-05 for this pass found that DP-04's suggested remedy (switch
the regex parser to the strpos-based one) doesn't actually fix anything — both
implementations stop at the first `}` and share the identical nested-brace bug.
A real fix needs a single depth-aware `:root` block parser, which is a design
decision, not a mechanical swap. Do these two together when picked up.

**A-07** still requires design discussion before implementing.

**C-01** is an intentional stub — wire up when the V3 import feature ships.
