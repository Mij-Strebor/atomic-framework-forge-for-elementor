# EFF JavaScript Overlap Audit

**Date:** 2026-03-09
**Scope:** `admin/js/` — 8 files totalling ~2,650 lines
**Files reviewed:**
- `eff-app.js` — global state, `EFF.App` API, init sequence
- `eff-theme.js` — light/dark mode
- `eff-modal.js` — shared modal dialog
- `eff-edit-space.js` — center content panel
- `eff-panel-right.js` — file management, counts
- `eff-panel-top.js` — top bar buttons, sync, modals
- `eff-panel-left.js` — nav tree
- `eff-colors.js` — Phase 2 Colors editor (~2,167 lines)

---

## Issue 1 — `_escapeHtml` / `_esc` duplicated in three files

**Severity: MEDIUM**

The same one-liner utility (create a `<div>`, assign `textContent`, return `innerHTML`) exists in three separate modules under two different names.

| File | Method name | Line |
|---|---|---|
| `eff-edit-space.js` | `_escapeHtml(str)` | 174 |
| `eff-panel-top.js` | `_escapeHtml(str)` | 500 |
| `eff-colors.js` | `_esc(str)` | 2158 |

**Risk:** Any future bug fix or change (e.g. switching to a DOMPurify-style approach) must be applied in all three places. Name inconsistency (`_esc` vs `_escapeHtml`) adds confusion.

**Recommendation:** Move to a single shared `EFF.Utils.escapeHtml()` method in `eff-app.js` and update all callers.

---

## Issue 2 — `EFF.state.theme` is dead state, duplicating `EFF.Theme.current`

**Severity: LOW**

`eff-app.js:36` initialises `EFF.state.theme` from `EFFData.theme`:
```js
theme: (typeof EFFData !== 'undefined' ? EFFData.theme : 'light') || 'light',
```

`eff-theme.js` maintains its own authoritative `EFF.Theme.current` property and updates it on every toggle/set call. No module reads `EFF.state.theme` back; all callers use `EFF.Theme.current` instead (e.g. `eff-panel-top.js:143`).

**Risk:** `EFF.state.theme` will silently drift from reality after the first theme change. Developers relying on `EFF.state` to inspect app state will see a stale value.

**Recommendation:** Remove `theme` from `EFF.state`. If a module needs the current theme, read `EFF.Theme.current`.

---

## Issue 3 — `eff-theme.js._persist()` bypasses `EFF.App.ajax()`

**Severity: LOW**

`eff-theme.js:70–80` has its own raw `fetch()` call that manually assembles the same POST boilerplate (`ajaxUrl`, `nonce`, `Content-Type`) as `EFF.App.ajax()`:

```js
// eff-theme.js — manual fetch
fetch(EFFData.ajaxUrl, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    new URLSearchParams({ action, nonce, theme }),
});

// eff-app.js — centralised abstraction
EFF.App.ajax = function (action, data) { ... fetch(EFFData.ajaxUrl ...) };
```

`_persist()` is called at user interaction time, when `EFF.App` is guaranteed to exist. There is no technical reason for the duplication.

**Risk:** If the AJAX pattern needs updating (e.g. adding a CSRF header) it must be changed in two places.

**Recommendation:** Replace `_persist()`'s `fetch()` call with `EFF.App.ajax('eff_save_user_theme', { theme: theme })`.

---

## Issue 4 — `_closeColorsView()` reimplements `EFF.EditSpace.reset()`

**Severity: MEDIUM**

`eff-edit-space.js:66–78` defines `EFF.EditSpace.reset()`:
```js
reset: function () {
    this._workspace.removeAttribute('data-active');
    this._content.setAttribute('hidden', '');
    this._content.innerHTML = '';
    this._placeholder.removeAttribute('hidden');
},
```

`eff-colors.js:838–864` defines `_closeColorsView()` which manually restores the same DOM state but mixes inline-style resets with attribute toggles:
```js
content.setAttribute('hidden', '');
content.style.display = '';     // ← inline style not in EditSpace.reset()
placeholder.style.display = ''; // ← inline style not in EditSpace.reset()
workspace.removeAttribute('data-active');
```

The `loadColors()` method in `eff-colors.js` set `placeholder.style.display = 'none'` (inline) to override CSS. `_closeColorsView()` must therefore also clear the inline style. `EFF.EditSpace.reset()` only uses the `hidden` attribute and will not fully undo the inline-style change made by `loadColors()`. This means calling `EFF.EditSpace.reset()` from a Colors context would leave the placeholder hidden.

**Risk:** Two code paths that should produce identical results; each has slightly different DOM side-effects. Future CSS changes could break one path but not the other.

**Recommendation:** Update `EFF.EditSpace.reset()` to also clear `placeholder.style.display` and `content.style.display`, then call it from `_closeColorsView()` instead of duplicating the logic.

---

## Issue 5 — Modal document-click listener leaks in three places

**Severity: MEDIUM**

Three functions attach a `document.addEventListener('click', handler)` for modal confirmation buttons and remove it only when a confirm/cancel button is clicked:

| Location | Function | Modal title |
|---|---|---|
| `eff-panel-right.js:252` | `_openCommitConfirmation()` | "Commit to Elementor" |
| `eff-colors.js:1171` | `_addCategory()` | "New Category" |
| `eff-colors.js:1353` | `_deleteCategory()` | "Delete Category" |

If the user closes the modal via ESC key or overlay click (both handled by `EFF.Modal.close()`), the delegated click handler is **not** removed. Repeated modal opens accumulate stale listeners on `document`.

**Risk:** After 3+ open/close cycles via ESC, a single button click fires the handler multiple times — potentially triggering duplicate AJAX calls or double-saves.

**Recommendation:** Register the click handler removal as `EFF.Modal.open({ onClose: function() { document.removeEventListener('click', handler); } })`. All three sites need this fix.

---

## Issue 6 — Inline color detection in `eff-panel-top.js` vs utilities in `eff-colors.js`

**Severity: LOW**

`eff-panel-top.js:380–381` detects color values inline during sync:
```js
var isColor = lc.charAt(0) === '#'
    || lc.indexOf('rgb(') === 0
    || lc.indexOf('rgba(') === 0
    || lc.indexOf('hsl(') === 0
    || lc.indexOf('hsla(') === 0;
```

`eff-colors.js` contains `_parseToRgba()` which supports the same formats plus `#rrggbbaa` (8-char hex). The inline check misses 8-char hex values (`#rrggbbaa`), so an RGBA hex colour from Elementor would be classified as `type: 'unknown'` and placed in an empty subgroup instead of the Colors subgroup.

**Risk:** Colour variables in `#rrggbbaa` format are silently miscategorised on import.

**Recommendation:** Add a shared `EFF.Utils.isColorValue(str)` function (or expose `EFF.Colors._parseToRgba`) and use it in `_syncFromElementor`.

---

## Issue 7 — `_startCategoryRename` — deprecated dead code (74 lines)

**Severity: LOW**

`eff-colors.js:1251–1324` contains a method marked `@deprecated` in its JSDoc comment. It implements the old DOM-swapping rename approach (replacing a `<span>` with an `<input>`) and is never called anywhere. The replacement is the always-on `eff-category-name-input` approach handled by `_saveCategoryName()`.

**Risk:** 74 lines of dead code that will confuse future maintainers; could be accidentally re-used.

**Recommendation:** Delete `_startCategoryRename()`.

---

## Issue 8 — `_moveCategoryUp` / `_moveCategoryDown` share ~14 identical setup lines

**Severity: LOW** (internal DRY issue within `eff-colors.js`)

`_moveCategoryUp()` (line 1387) and `_moveCategoryDown()` (line 1420) each start with the same block that builds a sorted `cats` array from config, with identical fallback logic. Only the swap direction (index ±1) differs.

**Risk:** Any bug in the setup block must be fixed in two places. Already diverged slightly — `_moveCategoryUp` guards `idx <= 0`, `_moveCategoryDown` guards `idx >= cats.length - 1`, which is correct, but the duplication makes it easy to miss if these guards are ever edited.

**Recommendation:** Extract the shared setup into a private `_getSortedCategories()` helper. Both move methods call it, then perform only the swap.

---

## Issue 9 — Four near-identical `keydown` Enter→blur handlers (eff-colors.js)

**Severity: LOW** (internal DRY issue)

Four almost-identical delegated `keydown` listeners are registered on `container` in `_bindEvents()`:

| Lines | Target selector | Effect |
|---|---|---|
| 708–713 | `.eff-category-name-input` | Enter → `blur()` |
| 723–728 | `.eff-color-name-input` | Enter → `blur()` |
| 738–743 | `.eff-color-value-input` | Enter → `blur()` |
| 796–801 | `.eff-hex-input` | Enter → `blur()` |

All four do `if (e.key !== 'Enter') return; var x = e.target.closest(selector); if (!x) return; x.blur();`

**Risk:** Maintenance overhead; easy to miss one when changing Enter-key behaviour.

**Recommendation:** Consolidate into a single `keydown` handler that checks a combined selector and calls `blur()`:
```js
container.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter') { return; }
    var input = e.target.closest(
        '.eff-category-name-input, .eff-color-name-input, .eff-color-value-input, .eff-hex-input'
    );
    if (input) { input.blur(); }
});
```

---

## Issue 10 — `_getVarsForCategory` — same name, different signatures in two files

**Severity: LOW** (naming confusion, no runtime conflict)

| File | Signature | Matches by |
|---|---|---|
| `eff-edit-space.js:159` | `_getVarsForCategory(sel)` | `sel.group`, `sel.subgroup`, `sel.category` (strings) |
| `eff-colors.js:1745` | `_getVarsForCategory(cat)` | `cat.id`, `cat.name` (category object) |

These are private methods on different objects and do not conflict at runtime. The Colors module overrides `EFF.EditSpace.loadCategory` for Colors so the EditSpace version is never called for color variables.

**Risk:** Future developers maintaining `eff-edit-space.js` may be surprised that the method signature differs from the analogous function in `eff-colors.js`. If the EditSpace is ever extended to handle Colors without the override, the two would be confused.

**Recommendation:** Rename the `eff-edit-space.js` version to `_getVarsForSelection(sel)` to make the difference explicit.

---

## Summary Table

| # | Issue | Files | Severity | Effort |
|---|---|---|---|---|
| 1 | `_escapeHtml`/`_esc` triplicated | edit-space, panel-top, colors | MEDIUM | Low |
| 2 | `EFF.state.theme` dead state | app, theme | LOW | Trivial |
| 3 | `_persist()` bypasses `EFF.App.ajax()` | theme | LOW | Trivial |
| 4 | `_closeColorsView` duplicates `EditSpace.reset()` | colors, edit-space | MEDIUM | Low |
| 5 | Modal click listener leak (3 sites) | panel-right, colors | MEDIUM | Low |
| 6 | Inline color detection misses HEXA | panel-top | LOW | Low |
| 7 | Dead deprecated `_startCategoryRename` (74 lines) | colors | LOW | Trivial |
| 8 | `_moveCategoryUp/Down` duplicated setup | colors | LOW | Low |
| 9 | Four duplicate Enter→blur keydown handlers | colors | LOW | Trivial |
| 10 | Same method name, different signatures | edit-space, colors | LOW | Trivial |

**Most impactful fixes (do these first):**
1. Issue 5 — Modal listener leak (functional bug risk, reproducible)
2. Issue 6 — HEXA mis-classification on sync (silent data bug)
3. Issue 4 — `_closeColorsView` / `reset()` divergence (CSS interaction risk)
4. Issue 1 — Consolidate `_escapeHtml` (maintenance)
