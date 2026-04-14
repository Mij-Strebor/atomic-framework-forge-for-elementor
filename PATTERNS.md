# AFF Coding Patterns

Established patterns used throughout AFF. Read this before making any change to
`aff-colors.js`, `aff-variables.js`, or `aff-panel-right.js`.

---

## 1. View-Presence Guard

**Problem:** `#aff-edit-content` is shared by Colors, Fonts, and Numbers. All three
modules bind delegated event listeners to the same container. Without a guard, a
Colors click handler fires while Numbers is showing, corrupting state.

**Rule:** Every delegated event handler AND every drag `mousedown` handler must check
for its own view wrapper element before doing anything.

### Colors (aff-colors.js)

```js
container.addEventListener('click', function (e) {
    if (!container.querySelector('.aff-colors-view')) { return; }
    // ... rest of handler
});

container.addEventListener('mousedown', function (e) {
    if (!container.querySelector('.aff-colors-view')) { return; }
    var handle = e.target.closest('.aff-drag-handle');
    // ...
});
```

### Variables factory (aff-variables.js)

```js
// setLower = 'fonts' or 'numbers'
container.addEventListener('click', function (e) {
    if (!container.querySelector('.aff-' + setLower + '-view')) { return; }
    // ...
});

container.addEventListener('mousedown', function (e) {
    if (!container.querySelector('.aff-' + setLower + '-view')) { return; }
    // ...
});
```

**Also applies to:** `focusout`, `input`, and any other delegated event type.

---

## 2. Re-bind Guard

**Problem:** Every time a variable set re-renders, `_bindEvents()` is called again,
stacking duplicate listeners on the container.

**Rule:** Use a flag on the container DOM node. Check it before binding; set it after.

```js
// In _bindCategoryAndRowActions() / equivalent:
if (container._effEventsBound) { return; }
container._effEventsBound = true;

container.addEventListener('click', function (e) { /* ... */ });
// etc.
```

**Important:** These flags survive `innerHTML` replacement. Never remove them by
destroying and recreating the container node — that would re-enable duplicate binding
on the very next render.

---

## 3. Stable Row Identity — `_rowKey` and `_findVarByKey`

**Problem:** Variables synced from Elementor have no AFF-assigned `id` yet (they're
not saved). Using `.id` as the drag/drop key breaks for these rows.

**Rule:** Use `_rowKey(v)` to generate a stable key, and `_findVarByKey(key)` to look
up variables.

```js
// aff-variables.js
_rowKey: function (v) {
    return v.id ? String(v.id) : '__n_' + v.name;
},

_findVarByKey: function (key) {
    var self = this;
    var setVars = self._getVarsForSet();
    if (key.slice(0, 4) === '__n_') {
        var name = key.slice(4);
        return setVars.find(function (v) { return !v.id && v.name === name; }) || null;
    }
    return setVars.find(function (v) { return String(v.id) === key; }) || null;
},
```

`data-var-id` attributes on row elements always use `_rowKey(v)`, not `v.id` directly.

---

## 4. Drag Drop — Object Identity Comparisons

**Problem:** After `_findVarByKey`, comparing by `.id` fails for unsaved variables
(their id is empty string, causing false matches).

**Rule:** After looking up src and target variables, use **object identity** (`===`)
for all array operations — never compare by `.id`.

```js
_onDropVar: function (srcId, targetId, above, container) {
    var srcVar = self._findVarByKey(srcId);
    var tgtVar = self._findVarByKey(targetId);
    if (!srcVar || !tgtVar) { return; }

    var sorted     = setVars.slice().sort(function (a, b) { return (a.order||0) - (b.order||0); });
    var withoutSrc = sorted.filter(function (v) { return v !== srcVar; }); // object identity

    var tgtIdx = withoutSrc.findIndex(function (v) { return v === tgtVar; }); // object identity
    // ...
}
```

---

## 5. AJAX Request Pattern

All AJAX calls use `fetch()` with the AFF nonce. Never use jQuery `$.ajax`.

```js
fetch(window.affData.ajaxUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
        action:  'aff_action_name',
        nonce:   window.affData.nonce,
        // ... payload fields
    })
})
.then(function (r) { return r.json(); })
.then(function (data) {
    if (!data.success) {
        // show error to user — never silently swallow
        return;
    }
    // handle success
})
.catch(function (err) {
    console.error('AFF AJAX error:', err);
    // show error to user
});
```

`window.affData` is localized in `class-aff-admin.php` via `wp_localize_script`.

---

## 6. Category Save / Rename — Nonce Verification

Every AJAX handler that writes data must call `$this->verify_request()` as its
first line. Missing this was a bug found in 0.3.4-beta. The pattern:

```php
public function ajax_aff_save_something(): void {
    $this->verify_request();   // ← always first — checks nonce + capability

    $name = sanitize_text_field( $_POST['name'] ?? '' );
    // ... rest of handler
}
```

`verify_request()` calls `check_ajax_referer()` and `current_user_can('manage_options')`.
It calls `wp_send_json_error()` and exits if either check fails.

---

## 7. Project Storage Layout

```
wp-content/uploads/aff/
└── {project-slug}/
    ├── {slug}_2026-04-08_14-30-00.aff.json
    ├── {slug}_2026-04-09_09-15-22.aff.json
    └── {slug}_2026-04-13_16-44-11.aff.json   ← most recent = active
```

- Slugified from the project name (`sanitize_title()`)
- Each save creates a new timestamped file — never overwrites
- `class-aff-data-store.php` owns all path resolution and file I/O
- Auto-prunes oldest backups when count exceeds `max_backups` (default 10)

---

*Keep this file current. When a new pattern is established that Claude has had to
re-derive from scratch, add it here.*
