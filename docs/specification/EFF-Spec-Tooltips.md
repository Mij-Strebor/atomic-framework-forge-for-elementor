# AFF Spec — Tooltips

**Version:** 1.0
**Date:** 2026-03-14
**Author:** Jim Roberts / Jim R Forge
**Status:** Active

---

## 1. Overview

AFF uses a single shared tooltip system for all interactive elements across the entire admin interface — top bar buttons, left panel, right panel, category headers, variable rows, and any dynamically created controls. Every tooltip in the application is rendered through one `#aff-tooltip` DOM element and one set of delegated event listeners.

There is no CSS pseudo-element tooltip system (no `:hover + ::before`). All tooltip behaviour is JavaScript-driven.

---

## 2. The Tooltip Element

### 2.1 HTML

Declared once in `admin/views/page-aff-main.php`, outside the main scroll container, as a direct child of `.aff-app`:

```html
<div class="aff-tooltip" id="aff-tooltip" role="tooltip" aria-hidden="true"></div>
```

| Attribute | Value | Purpose |
|---|---|---|
| `class` | `aff-tooltip` | CSS styling hook |
| `id` | `aff-tooltip` | JS reference (`document.getElementById`) |
| `role` | `tooltip` | ARIA landmark |
| `aria-hidden` | `true` (default) / `false` (when visible) | Accessibility state |

### 2.2 CSS — `admin/css/aff-theme.css`

```css
.aff-app .aff-tooltip {
    position:       fixed;          /* viewport-relative; scrollY is NOT added in JS */
    z-index:        99999;
    background:     var(--aff-clr-primary);     /* deep brown */
    color:          #faf6f0;                    /* light cream */
    font-size:      var(--fs-xs);               /* 11px */
    font-weight:    var(--fw-medium);           /* 500 */
    padding:        var(--sp-1) var(--sp-2);    /* 4px 8px */
    border-radius:  var(--aff-border-radius-sm); /* 4px */
    pointer-events: none;           /* cursor passes through; does not block hover events */
    white-space:    nowrap;
    opacity:        0;
    transform:      translateX(-50%) translateY(4px); /* hidden: centered + 4px below final pos */
    transition:     opacity 0.12s ease, transform 0.12s ease;
    box-shadow:     var(--aff-shadow-sm);
}

.aff-app .aff-tooltip.is-visible {
    opacity:   1;
    transform: translateX(-50%) translateY(0); /* visible: centered + final position */
}
```

**Critical implementation notes:**

- `position: fixed` means `top` and `left` are set in viewport coordinates. **`scrollY` must not be added** to JS-calculated positions.
- `translateX(-50%)` centers the tooltip horizontally on the anchor's midpoint. This is owned entirely by CSS. **JS must never set `element.style.transform`** — doing so overrides the CSS transition and breaks the slide animation.
- `pointer-events: none` means the tooltip is invisible to the mouse. The cursor passes through it to whatever element is underneath. This also means the tooltip cannot visually hide elements beneath it from a user-interaction standpoint.

---

## 3. Triggering Elements — Data Attributes

Any element that should trigger a tooltip carries one or both of:

| Attribute | Purpose |
|---|---|
| `data-aff-tooltip="Short label"` | Text shown in standard tooltip mode |
| `data-aff-tooltip-long="Full sentence."` | Text shown in Extended tooltip mode (see §6) |

If an element has `data-aff-tooltip-long` but not `data-aff-tooltip`, it will not trigger a tooltip in standard mode.

If an element has `data-aff-tooltip` but not `data-aff-tooltip-long`, both standard and extended mode show the same short text.

---

## 4. Event Binding — `AFF.PanelTop._bindTooltips()`

All tooltip events are bound **once**, at application init, via **document-level delegated listeners**. This covers:
- All static elements that exist at page load (top bar, panel buttons)
- All dynamically created elements (category blocks, variable rows) — without any per-element binding

```javascript
_bindTooltips: function () {
    var self  = this;
    var _tipEl = null; // tracks the currently-hovered tooltip anchor

    // Show on mouse enter — uses _tipEl to prevent re-firing on child node traversal
    document.addEventListener('mouseover', function (e) {
        var target = e.target.closest('[data-aff-tooltip]');
        if (target !== _tipEl) {
            if (_tipEl) { self._hideTooltip(); }
            _tipEl = target;
            if (target) { self._showTooltip(target); }
        }
    });

    // Hide on mouse leave (only when leaving the trigger element itself)
    document.addEventListener('mouseout', function (e) {
        var target = e.target.closest('[data-aff-tooltip]');
        if (target && target === _tipEl) {
            var rt = e.relatedTarget;
            if (!rt || !target.contains(rt)) {
                _tipEl = null;
                self._hideTooltip();
            }
        }
    });

    // Keyboard accessibility — show on focus
    document.addEventListener('focusin', function (e) {
        if (e.target && e.target.getAttribute && e.target.getAttribute('data-aff-tooltip')) {
            self._showTooltip(e.target);
        }
    });

    // Keyboard accessibility — hide on blur
    document.addEventListener('focusout', function (e) {
        if (e.target && e.target.getAttribute && e.target.getAttribute('data-aff-tooltip')) {
            self._hideTooltip();
        }
    });
}
```

**`_tipEl` tracking:** `mouseover` fires repeatedly as the cursor moves over child nodes (SVG `<path>` elements, nested `<span>` tags). `_tipEl` prevents the tooltip from being hidden and re-shown on every sub-element traversal.

**No other module binds tooltip events.** Any previous per-container or per-element tooltip binding in feature modules (`aff-colors.js`, etc.) is disabled. The global delegated system handles everything.

---

## 5. Show Behaviour — `AFF.PanelTop._showTooltip(anchor)`

```javascript
_showTooltip: function (anchor) {
    if (!this._showTooltips) { return; } // user preference gate

    var text = this._extendedTooltips
        ? (anchor.getAttribute('data-aff-tooltip-long') || anchor.getAttribute('data-aff-tooltip'))
        : anchor.getAttribute('data-aff-tooltip');

    if (!text || !this._tooltip) { return; }

    clearTimeout(this._tooltipTimer);

    this._tooltipTimer = setTimeout(function () {
        self._tooltip.textContent = text;
        self._tooltip.setAttribute('aria-hidden', 'false');

        var rect = anchor.getBoundingClientRect();
        var tipH = self._tooltip.offsetHeight || 28;

        // Horizontal: center on anchor midpoint (translateX(-50%) in CSS does the shift)
        self._tooltip.style.left = (rect.left + rect.width / 2) + 'px';

        // Vertical: above the anchor by default; flip to below if too close to viewport top
        if (rect.top - tipH - 8 < 10) {
            // Below — 12px gap so cursor arrow does not overlap tooltip text
            self._tooltip.style.top = (rect.bottom + 12) + 'px';
        } else {
            // Above — 8px gap between tooltip bottom and element top
            self._tooltip.style.top = (rect.top - tipH - 8) + 'px';
        }

        // Do NOT set element.style.transform — CSS owns translateX(-50%) translateY(...)
        self._tooltip.classList.add('is-visible'); // triggers CSS transition
    }, 300);
}
```

### 5.1 Delay

The tooltip appears after a **300 ms delay**. This prevents flicker when the cursor passes quickly over elements. The timer is cancelled by `_hideTooltip()` if the cursor leaves before 300 ms.

### 5.2 Positioning

| Case | Position |
|---|---|
| **Default (above)** | Tooltip bottom edge = anchor top − 8 px |
| **Flip (below)** | Anchor bottom + 12 px (flip triggered when `rect.top − tipH − 8 < 10`) |

**Above is the default.** When the cursor is on an element, the cursor hotspot is somewhere inside the element's bounding box — below the element's top edge. Positioning the tooltip above the element means the cursor is never on the tooltip. The `pointer-events: none` rule prevents any hover-related interference regardless, but positioning above eliminates any visual overlap between the cursor arrow and the tooltip text.

**12 px gap for below-flip:** The standard cursor arrow is approximately 16 px tall. A 12 px gap between the element's bottom edge and the tooltip's top edge gives enough clearance so the cursor tail does not visually overlap the first line of tooltip text.

**`position: fixed` — no `scrollY`:** `getBoundingClientRect()` returns viewport-relative coordinates. Adding `scrollY` would cause the tooltip to be placed off-screen on scrolled pages.

### 5.3 Animation

On show:
1. `textContent` and `aria-hidden` are set immediately (before the CSS transition)
2. `top` and `left` are set immediately
3. `.is-visible` class is added → CSS transitions `opacity: 0 → 1` and `transform: translateX(-50%) translateY(4px) → translateX(-50%) translateY(0)` over 0.12 s

The slide direction is always upward (Y: +4 → 0) regardless of whether the tooltip is positioned above or below the anchor.

---

## 6. Hide Behaviour — `AFF.PanelTop._hideTooltip()`

```javascript
_hideTooltip: function () {
    clearTimeout(this._tooltipTimer);   // cancel pending show if timer has not fired yet
    if (this._tooltip) {
        this._tooltip.classList.remove('is-visible'); // triggers CSS reverse transition
        this._tooltip.setAttribute('aria-hidden', 'true');
    }
}
```

- Hiding is **immediate** — no delay. The tooltip disappears as soon as the cursor leaves the trigger element or focus moves away.
- Removing `.is-visible` triggers the CSS reverse transition: `opacity → 0`, `transform → translateY(4px)`.
- The `clearTimeout` ensures that if the cursor moves on and off an element within 300 ms, no tooltip appears at all.

---

## 7. Preferences — Show Tooltips & Extended Tooltips

### 7.1 Settings Storage

Two settings are persisted via `aff_save_settings` / `aff_get_settings` (WordPress options):

| Setting key | Type | Default | Description |
|---|---|---|---|
| `show_tooltips` | boolean | `true` | When `false`, no tooltips appear anywhere in the UI |
| `extended_tooltips` | boolean | `false` | When `true`, `data-aff-tooltip-long` text is preferred over `data-aff-tooltip` |

### 7.2 Runtime Properties

`AFF.PanelTop` exposes two properties that reflect the persisted settings:

```javascript
AFF.PanelTop._showTooltips     // boolean, default true
AFF.PanelTop._extendedTooltips // boolean, default false
```

These are loaded from settings on `init()` via an async `aff_get_settings` AJAX call. They update silently (non-blocking) after DOM ready.

### 7.3 Preferences Modal UI

The Preferences modal (opened via the gear icon in the top bar) contains a Tooltips section with two checkboxes:

```
┌─ Tooltips ────────────────────────────────────────────┐
│  ☑  Show tooltips                                     │
│  ☐  Extended tooltips (show longer descriptions)      │
└───────────────────────────────────────────────────────┘
```

On change, each checkbox immediately:
1. Updates the corresponding `AFF.PanelTop._showTooltips` / `AFF.PanelTop._extendedTooltips` property
2. Calls `aff_save_settings` to persist the value

The changes take effect for all subsequent tooltip interactions without a page reload.

---

## 8. Adding Tooltips to New Elements

To add a tooltip to any element:

```html
<!-- Minimum: short tooltip only -->
<button data-aff-tooltip="Save file">…</button>

<!-- Full: short + extended -->
<button
  data-aff-tooltip="Save"
  data-aff-tooltip-long="Save the current project to the selected .aff.json file">
  …
</button>
```

No JavaScript binding is needed. The delegated `document` listener picks up any element with `data-aff-tooltip` automatically — including elements appended to the DOM after page load.

---

## 9. Elements That Must Have Tooltips

### 9.1 Top Bar (static, `page-aff-main.php`)

All icon-only buttons in the top bar carry both `data-aff-tooltip` and `data-aff-tooltip-long`.

| Button | Short | Long |
|---|---|---|
| Preferences (gear) | `Preferences` | `Open Preferences — change theme, configure tooltips, and set file defaults` |
| Manage Project | `Manage Project` | `Manage Project — edit the project name, color categories, and subgroup layout` |
| Export | `Export` | `Export the current project as a .aff.json file` |
| Import | `Import` | `Import a .aff.json file into the current project` |
| Sync from Elementor | `Sync from Elementor` | `Sync variables from the active Elementor kit CSS into this project` |
| History | `History` | `View change history` |
| Search | `Search` | `Search variables, classes, and components` |
| Help | `Help` | `Open help documentation` |
| Commit to Elementor | `Commit to Elementor` | `Write pending variable changes back to the active Elementor kit CSS` |

### 9.2 Variable Rows (dynamic, `aff-colors.js`)

All action buttons on variable rows carry `data-aff-tooltip` (short) and where appropriate `data-aff-tooltip-long` (extended). Category-level action buttons use `data-aff-tooltip` via the `_catBtn()` helper.

| Element | Short | Long |
|---|---|---|
| Drag handle | `Drag to reorder` | — |
| Status dot | Status name, e.g. `Modified` | Full status description (see `_statusLongTooltip`) |
| Expand button | `Open color editor` | `Open the full color editor — tints, shades, transparency, and picker` |
| Delete button | `Delete variable` | `Remove this variable from the project` |
| Add Color (in cat header) | `Add Color` | — |
| Category rename | `Rename category` | — |
| Category delete | `Delete category` | — |
| Category sort buttons | `Sort A→Z` / `Sort Z→A` / etc. | — |

### 9.3 Status Dot Extended Tooltips

The status dot uses `_statusLongTooltip(status)` for its `data-aff-tooltip-long` value:

| Status | Short | Long |
|---|---|---|
| `synced` | `Synced` | `Synced — This variable matches the value in the Elementor kit.` |
| `modified` | `Modified` | `Modified — Value changed since last sync. Commit to push to Elementor.` |
| `new` | `New` | `New — Variable not yet in the Elementor kit. Commit to add it.` |
| `deleted` | `Deleted` | `Deleted — Marked for deletion. Commit to remove from Elementor.` |
| `conflict` | `Conflict` | `Conflict — Value changed both here and in Elementor since last sync.` |
| `orphaned` | `Orphaned` | `Orphaned — Exists in AFF but not found in Elementor kit. Commit to add it.` |

---

## 10. What Tooltips Are Not

- **Not a separate system per module.** Feature modules (`aff-colors.js`, etc.) do not bind their own tooltip events. Only `AFF.PanelTop._bindTooltips()` does.
- **Not CSS-only.** There is no `:hover + ::before` or `::after` system. The JS system is authoritative.
- **Not hidden by the cursor.** The tooltip is positioned above the anchor by default so the cursor (which is on the anchor element below the tooltip) does not visually overlap the tooltip text. When flipped to below (near viewport top), extra gap ensures the cursor arrow tip does not overlap the tooltip's first text line.
- **Not an error display.** Inline field validation errors use a separate `.aff-inline-error` element with its own styling and are not part of this system.

---

## 11. Implementation Checklist

When adding a new interactive element:

- [ ] Add `data-aff-tooltip="short text"` to the element
- [ ] Add `data-aff-tooltip-long="Full sentence."` if the element benefits from extended description
- [ ] Do **not** add a `title` attribute — it creates a native browser tooltip that conflicts
- [ ] Do **not** bind custom `mouseenter`/`mouseleave` listeners for tooltip purposes
- [ ] Do **not** call `element.style.transform` on the tooltip element
- [ ] Verify the element is accessible via keyboard (`tabindex="0"` or naturally focusable) so focus-based tooltip display works

---

*© Jim Roberts / [Jim R Forge](https://jimrforge.com)*
