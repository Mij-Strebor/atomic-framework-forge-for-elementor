# Elementor Framework Forge (EFF) — Claude Code Build Description

> **Version:** 1.2 
> **Author:** Jim Roberts — jim@jimrforge.com | jim@jimrweb.com | 801-631-4428  
> **Organization:** Jim R Forge — https://jimrforge.com  
> **Address:** 252 11th Ave., Salt Lake City, UT 84103  
> **Platform Target:** WordPress Plugin (Primary) | Windows App / Mac App (Future Options — architecture must not preclude these)  
> **UI Standards:** JimRForge UI/UX Standards v1.3.0 (integrated herein — EFF spec takes precedence on all conflicts)  
> **Content:** Edit-space content to be developed after framework is built.

---

## 1. Project Overview

**Elementor Framework Forge (EFF)** is a WordPress plugin that provides a professional management interface for Elementor Version 4 (atomic widget architecture) assets. It allows developers to organize, edit, and persist the three core asset types introduced by Elementor v4:

- **Variables** — CSS custom properties used by atomic widgets
- **Classes** — Developer-defined class names applied to atomic widget controls
- **Components** — User-assembled widgets built within Elementor v4

EFF is a developer tool, not an end-user theme tool. It is accessed via the WordPress admin area and operates as a full-page admin panel.

**CSS Class Prefix:** All EFF CSS classes use the prefix `eff-` (e.g., `eff-btn`, `eff-panel-left`, `eff-modal`). This follows the JimRForge three-character prefix convention.

---

## 2. Elementor Version 4 Deep Dive

> **Note to Claude Code:** The following section contains placeholder markers `<Add further clarification in a deep dive on Elementor Version 4 here.>` These sections must be expanded with authoritative Elementor v4 documentation research before implementation begins. The structural scaffolding around them is correct and complete.

### 2.1 Elementor Version 4 Architecture Context

Elementor Version 4 introduces an **atomic widget system** that represents a fundamental architectural shift from the classic widget model. In the classic system, widgets were self-contained PHP/JS objects with their own controls, styles, and rendering. In version 4, widgets are decomposed into atomic units governed by a new CSS variable layer.

#### Key Characteristics of Elementor v4 Atomic Widgets:
- Each atomic widget exposes a **Variables panel** in its control interface
- When a developer assigns a value in the Variables panel, that value becomes a CSS custom property (CSS variable) registered in the Elementor v4 variable system
- These variables appear at the **end of the compiled stylesheet** (e.g., `post-67.css`) in a **distinct `:root {}` block** — separate from and after the legacy `--e-global-*` variable block
- The new variable naming convention is distinct from `--e-global-*` and must be identified by EFF by its position in the stylesheet and its naming pattern

#### Elementor v4 Variable System (`:root` block in `post-67.css`):
The new `:root` block found at the end of Elementor's compiled CSS file is the primary data source that EFF monitors, reads, and manages. At the time of this specification, this block contains **CSS variables only**. Classes and components defined by the developer will appear here in future iterations of Elementor v4.

```css
/* Example structure — end of post-67.css */

/* Legacy block (DO NOT manage these) */
:root {
  --e-global-color-primary: #6EC1E4;
  --e-global-typography-primary-font-family: "Roboto";
  /* ... */
}

/* Elementor v4 Atomic Variable block (EFF manages these) */
:root {
  --eff-color-brand-primary: #2C3E50;
  --eff-spacing-base: 16px;
  /* ... user-defined atomic variables ... */
}
```

EFF must correctly distinguish between these two blocks and operate **only** on the v4 atomic block.

### 2.2 Variables

`<Add further clarification in a deep dive on Elementor Version 4 here.>`

CSS Variables in the Elementor v4 context are CSS custom properties that serve as the styling parameters for atomic widgets. They are the atomic widget's interface to the design system. Examples of variable types:

- **Color** values (hex, rgb, hsl, CSS named colors)
- **Typography** values (font-family, font-size, font-weight, line-height, letter-spacing)
- **Numeric/dimensional** values (height, width, gap, padding, margin, border-radius, grid column counts)

**EFF Rule:** If any Elementor atomic element has a "variables" control section and a value is assigned there, that value is a candidate for EFF management. EFF ingests these variables, categorizes them, and provides a management UI for editing, organizing, and persisting them.

### 2.3 Classes

`<Add further clarification in a deep dive on Elementor Version 4 here.>`

Classes in the Elementor v4 context are developer-defined CSS class names entered at the top of the atomic widget's control panel. They allow scoped styling outside of the variable system. EFF will manage these class definitions — their names, associated styles, and organizational grouping — once Elementor v4 exposes them in the compiled output.

### 2.4 Components

`<Add further clarification in a deep dive on Elementor Version 4 here.>`

Components in the Elementor v4 context are user-assembled widget compositions — combinations of atomic widgets treated as a reusable unit. EFF will provide a component registry, listing all defined components, their constituent atoms, and their associated variable and class bindings.

---

## 3. Plugin Registration & WordPress Integration

The plugin file structure must be consistent with and adhere strictly to WordPress plugin structure standards.

### 3.1 Plugin File Structure

```
elementor-framework-forge/
├── elementor-framework-forge.php        # Main plugin file, headers, bootstrap
├── includes/
│   ├── class-eff-loader.php             # Hook registration
│   ├── class-eff-admin.php              # Admin page registration
│   ├── class-eff-css-parser.php         # Reads and parses post-{id}.css
│   ├── class-eff-data-store.php         # Variable/class/component persistence
│   ├── class-eff-ajax-handler.php       # AJAX endpoints for save/load/search
│   └── class-eff-settings.php          # Plugin preferences
├── admin/
│   ├── views/
│   │   └── page-eff-main.php           # Root PHP template for the admin page
│   ├── js/
│   │   ├── eff-app.js                  # Main JS application entry point
│   │   ├── eff-panel-left.js           # Left menu panel logic
│   │   ├── eff-panel-right.js          # Right status panel logic
│   │   ├── eff-panel-top.js            # Top menu bar logic
│   │   ├── eff-edit-space.js           # Center edit space logic
│   │   ├── eff-modal.js                # Modal dialog system
│   │   └── eff-theme.js               # Light/dark mode toggle and persistence
│   └── css/
│       ├── eff-layout.css              # Panel layout and structure
│       └── eff-theme.css              # Light/dark mode variables (Section 5)
├── assets/
│   ├── fonts/                          # Inter WOFF2 files (Section 6.1)
│   │   ├── Inter-Regular.woff2
│   │   ├── Inter-Medium.woff2
│   │   ├── Inter-SemiBold.woff2
│   │   └── Inter-Bold.woff2
│   └── icons/                          # SVG icon set (Section 8)
├── data/
│   └── eff-defaults.json               # Default subgroup definitions
└── readme.txt
```

### 3.2 WordPress Admin Page Registration

- Register a **top-level menu page** in the WordPress admin sidebar under a custom EFF menu icon
- Admin page slug: `elementor-framework-forge`
- Capability required: `manage_options`
- The page renders a full-height, full-width admin panel that visually replaces the standard WordPress admin chrome within the content area
- Enqueue all EFF CSS and JS only on the EFF admin page (use `$hook` check in `admin_enqueue_scripts`)

### 3.3 Future Platform Portability

> **Architectural Note for Claude Code:** The data layer (`class-eff-data-store.php`, `eff-defaults.json`, the AJAX handlers) must be cleanly separated from the WordPress-specific registration layer. All business logic for variable management, categorization, and persistence must be encapsulated in classes that have no WordPress dependencies. This separation is intentional: EFF may be ported to a **standalone Windows application** or **Mac application** in the future. The core logic must be portable. WordPress-specific code (hooks, `wp_*` functions, nonces) must be isolated in thin adapter classes only.

---

## 4. Screen Layout

### 4.1 Layout Overview

The EFF admin page is a **four-panel layout** that fills the available admin content area:

```
┌──────────────────────────────────────────────────────────────────┐
│                        TOP MENU BAR                              │
├────────────┬─────────────────────────────────────┬───────────────┤
│            │                                     │               │
│  LEFT MENU │         CENTER EDIT SPACE           │  RIGHT STATUS │
│    PANEL   │                                     │    PANEL      │
│            │                                     │               │
│ (collaps.) │                                     │               │
│            │                                     │               │
└────────────┴─────────────────────────────────────┴───────────────┘
```

- **Top Menu Bar** — Fixed height. Icon-only buttons. Low-key visual weight.
- **Left Menu Panel** — Collapsible. Shows Variables / Classes / Components tree. Collapses to icon-only thin bar.
- **Center Edit Space** — Main working area. Content driven by left panel selection. Framework scaffold only at this stage.
- **Right Status Panel** — Fixed width. File management at top, counts at bottom.

**Max content width:** 1280px (`--jimr-container-max`) per JimRForge layout standards. Panel padding: 36px (`--sp-9`).

### 4.2 Top Menu Bar

**Position:** Fixed at top of EFF panel (not the browser top — the top of the EFF region)  
**Height:** Compact — approximately 40–48px  
**Style:** Very low visual weight. Subtle background. Icon-only buttons with tooltips on hover. No visible button borders at rest. Subtle hover state only.

#### Left Side of Top Menu Bar:

| Icon | Tooltip | Action |
|------|---------|--------|
| Gear (⚙) | Preferences | Opens modal: theme toggle, default file path, editor preferences |
| Project Board (▦) | Manage Project | Opens modal: edit/add/remove/reorder subgroups under Colors, Fonts, Numbers |

#### Right Side of Top Menu Bar:

| Icon | Tooltip | Action |
|------|---------|--------|
| Magnifier (🔍) | Search | Opens modal: search across all variables, classes, components by name or value |

#### Suggested Additional Top Menu Items (for Jim's review):

| Icon | Tooltip | Suggested Action |
|------|---------|-----------------|
| Export (↑ box) | Export | Export current dataset as JSON or CSS |
| Import (↓ box) | Import | Import a previously exported EFF dataset |
| Sync (⟳) | Sync from Elementor | Re-parse post CSS and update variable list from live Elementor data |
| History (🕐) | Change History | View a log of recent changes with undo capability |
| Help (?) | Help / Documentation | Opens modal with quick reference or links to docs |

**All top menu buttons:** SVG icon only. No border at rest. Subtle hover state. Tooltip appears after 300ms hover delay (CSS-driven, not browser default). Icon color responds to theme via `fill: currentColor`.

### 4.3 Left Menu Panel

**Position:** Left side, below top menu bar, full height  
**Expanded width:** ~220px  
**Collapsed width:** ~48px (icon-only thin bar)  
**Collapse control:** Chevron toggle icon at the top of the left panel

#### Menu Tree Structure:

```
▼ Variables
    ▼ Colors
        • Branding
        • Backgrounds
        • Neutral
        • Status
    ▼ Fonts (Typography)
        • [Custom Elementor Fonts — dynamically listed]
        • [System Fonts — dynamically listed]
    ▼ Numbers
        • Spacing
        • Gaps
        • Grids
        • Radius
▶ Classes
▶ Components
```

#### Left Panel Behavior Rules:

- **Variables, Classes, Components** are the three fixed top-level groups. They cannot be renamed, reordered, or removed.
- **Colors, Fonts, Numbers** are fixed second-level groups under Variables. They cannot be renamed, reordered, or removed.
- **Subgroups** (Branding, Backgrounds, etc.) are user-definable via Manage Project. They can be added, renamed, reordered, and removed — subject to the constraint that at least one subgroup must always remain under each parent.
- **Font subgroups** are dynamically populated from Elementor's registered custom fonts and system font list. Names are read-only (sourced from Elementor).
- Clicking any leaf node (e.g., Branding, Spacing) loads that group's contents into the Center Edit Space.
- Clicking a group header expands/collapses it (accordion behavior; multiple groups can be open simultaneously).
- In collapsed mode (icon-only), only the top-level icons are shown. Hovering a collapsed icon reveals a flyout sub-menu.
- Each menu item has an icon (see Section 8 for assignments).
- Active/selected menu item uses the gold accent color (`--clr-accent: #f4c542`) for highlight.

### 4.4 Center Edit Space

**Position:** Center, between left panel and right status panel, below top menu bar  
**Behavior:** Content-driven by left panel selection. Vertically scrollable.  
**Current State:** Framework scaffold only. Edit content to be specified separately.

The edit space must be architected to support (future phases):
- A grid/table view for listing variables with name, value, category, and action buttons
- Inline edit mode for quick value changes
- A detail panel or modal for full variable/class/component editing
- Drag-and-drop reorder capability within a subgroup

**Placeholder content for v1 framework:** A centered message reading "Select a category from the left panel" with a subdued icon. Styled per JimRForge typography standards (body text color `--clr-txt`, font Inter, 16px).

### 4.5 Right Status Panel

**Position:** Right side, below top menu bar, full height  
**Width:** ~220px fixed. Not collapsible in v1.

#### Right Panel — Top Section (File Management):

- **File Name Field** — Text input. Label: "Storage File". Placeholder: `e.g., my-project.eff.json`. Background: `--clr-white`. Border: `--clr-border`.
- **Load Button** — Icon: folder-open. Tooltip: "Load File". Opens file picker or path entry modal.
- **Save Button** — Icon: floppy/save. Tooltip: "Save File".
- **Save Changes Button** — Icon: checkmark.
  - **Inactive state** (no unsaved changes): Dimmed. Not clickable. Color: `--clr-txt-muted`.
  - **Active state** (changes pending): Highlighted. Color: `--clr-accent`. Clickable.
  - Transition between states: smooth CSS transition on `opacity` and `color`.

#### Right Panel — Bottom Section (Counts):

Displayed as labeled icon + number pairs, right-aligned at the bottom of the right panel:

| Icon | Label | Value |
|------|-------|-------|
| Variable icon | Variables | [live count] |
| Class icon | Classes | [live count] |
| Component icon | Components | [live count] |

Counts update in real time as items are added or removed in the edit space.

---

## 5. Light / Dark Mode

EFF supports **light mode** and **dark mode** independently of the WordPress admin theme.

- Mode toggle is in the Preferences modal (gear icon, top menu bar)
- Mode preference is persisted per-user via `wp_usermeta`
- All colors, backgrounds, borders, and icon tints are defined as CSS custom properties in `eff-theme.css`
- Toggle mechanism: `[data-eff-theme="dark"]` attribute on the root EFF container element
- Light mode defaults to JimRForge brand palette (see Section 6.2)
- Dark mode inverts the background hierarchy and adjusts text/icon colors accordingly — specific dark palette values to be supplied in the separate styling spec

### Light Mode Base Colors (from JimRForge UI Standards — applied as EFF theme variables):

```css
[data-eff-theme="light"] {
  --eff-bg-page:        #faf6f0;     /* Page/panel background */
  --eff-bg-card:        #ffffff;     /* Card/container background */
  --eff-bg-panel:       #faf9f6;     /* Sub-panel background */
  --eff-bg-field:       #fff;        /* Input field background */

  --eff-clr-primary:    #3d2f1f;     /* Deep brown — headings */
  --eff-clr-secondary:  #6d4c2f;     /* Medium brown — body text */
  --eff-clr-accent:     #f4c542;     /* Gold — active states, highlights */
  --eff-clr-accent-hov: #dda824;     /* Gold hover */
  --eff-clr-muted:      #64748b;     /* Disabled / muted text */
  --eff-clr-link:       #ce6565;     /* Link color */
  --eff-clr-link-hov:   #b54545;     /* Link hover */
  --eff-clr-border:     #c9b89a;     /* Border color */

  --eff-shadow-sm: 0 1px 2px rgba(61,47,31,0.08);
  --eff-shadow-md: 0 4px 6px rgba(61,47,31,0.12);
  --eff-shadow-lg: 0 10px 20px rgba(61,47,31,0.15);
  --eff-shadow-xl: 0 20px 30px rgba(61,47,31,0.18);
}
```

---

## 6. Typography & Font Standards

All typography follows JimRForge UI/UX Standards v1.3.0 exactly.

### 6.1 Font Loading

Font: **Inter** — loaded locally from `assets/fonts/`. No external CDN for fonts.

```css
@font-face {
    font-family: 'Inter';
    font-weight: 400;
    font-display: swap;
    src: url('../fonts/Inter-Regular.woff2') format('woff2');
}
@font-face {
    font-family: 'Inter';
    font-weight: 500;
    font-display: swap;
    src: url('../fonts/Inter-Medium.woff2') format('woff2');
}
@font-face {
    font-family: 'Inter';
    font-weight: 600;
    font-display: swap;
    src: url('../fonts/Inter-SemiBold.woff2') format('woff2');
}
@font-face {
    font-family: 'Inter';
    font-weight: 700;
    font-display: swap;
    src: url('../fonts/Inter-Bold.woff2') format('woff2');
}

/* Global font override — scoped to EFF container to avoid bleeding into WP admin */
.eff-app * {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
}
```

> **Scoping note:** Apply the `!important` font override only within `.eff-app` (the root EFF container), not globally on `*`, to avoid disrupting WordPress admin styles outside the EFF panel.

### 6.2 Type Scale

Based on JimRForge 1.125 Major Second Scale at 1620px viewport:

```css
:root {
    --fs-xxs:  11px;    /* Footnotes */
    --fs-xs:   13px;    /* Fine print, captions */
    --fs-sm:   14px;    /* Labels, button text */
    --fs-md:   16px;    /* Body text — BASE */
    --fs-lg:   18px;    /* Emphasized text */
    --fs-xl:   20px;    /* H3 headings */
    --fs-xxl:  24px;    /* H2 headings */
    --fs-xxxl: 32px;    /* H1 headings, page titles */

    --fw-normal:   400;
    --fw-medium:   500;
    --fw-semibold: 600;
    --fw-bold:     700;

    --fl-md: 1.4;
    --fl-lg: 1.2;
}
```

### 6.3 Heading Styles

All heading text uses Capitalize transform, Inter font, no decoration.

| Element | Color | Size | Weight | Line Height |
|---------|-------|------|--------|-------------|
| H1 | `--eff-clr-primary` | `--fs-xxxl` | Bold | `--fl-md` |
| H2 | `--eff-clr-primary` | `--fs-xxl` | Bold | `--fl-md` |
| H3 | `--eff-clr-secondary` | `--fs-xl` | Bold | `--fl-lg` |
| H4 | `--eff-clr-secondary` | `--fs-xl` | Bold | `--fl-lg` |
| H5 | `--eff-clr-secondary` | `--fs-xl` | Bold | `--fl-lg` |
| H6 | `--eff-clr-secondary` | `--fs-xl` | Bold | `--fl-lg` |
| p | `--eff-clr-secondary` | `--fs-md` | Normal | `--fl-lg` |
| a | `--eff-clr-link` | `--fs-sm` | Normal | `--fl-lg` (italic, lowercase) |

---

## 7. Spacing Scale

```css
:root {
    --sp-1:  4px;
    --sp-2:  8px;
    --sp-3:  12px;
    --sp-4:  16px;
    --sp-5:  20px;
    --sp-6:  24px;
    --sp-8:  32px;
    --sp-9:  36px;    /* Standard panel padding */
    --sp-18: 72px;    /* Double padding for inset notices */
}
```

---

## 8. Button Standards

All buttons follow JimRForge UI/UX Standards v1.3.0. EFF-specific buttons use the `eff-btn` class prefix.

### Primary Button (Gold)

```css
.eff-btn {
    background:    var(--eff-clr-accent);     /* #f4c542 gold */
    color:         var(--eff-clr-primary);    /* #3d2f1f brown */
    border:        none;
    border-radius: 8px;
    font-size:     var(--fs-sm);              /* 14px */
    font-weight:   var(--fw-semibold);        /* 600 */
    padding:       var(--sp-2);              /* 8px */
    display:       flex;
    align-items:   center;
    gap:           var(--sp-2);              /* 8px icon gap */
    cursor:        pointer;
    transition:    transform 0.15s ease, background 0.15s ease;
}
.eff-btn:hover {
    background:  var(--eff-clr-accent-hov);  /* #dda824 */
    transform:   translate(-2px, -2px);
}
```

**Rules:**
- Button text must be **sentence case in HTML** (not via CSS `text-transform`)
- Dashicons or SVG icons use `margin-top: 3px` for vertical alignment
- No borders on buttons — use shadows for depth
- No gray/ghost secondary buttons (old pattern — do not use)

### Icon-Only Buttons (Top Menu Bar, Toolbar Actions)

Icon-only buttons are a distinct pattern from the primary gold button. They are used in the top menu bar and wherever an action is represented by icon alone.

```css
.eff-icon-btn {
    background:    transparent;
    border:        none;
    color:         var(--eff-clr-secondary);
    padding:       var(--sp-2);
    border-radius: 6px;
    cursor:        pointer;
    display:       flex;
    align-items:   center;
    justify-content: center;
    transition:    background 0.15s ease, color 0.15s ease;
}
.eff-icon-btn:hover {
    background:  rgba(61,47,31,0.08);
    color:       var(--eff-clr-primary);
}
.eff-icon-btn:focus-visible {
    outline:        2px solid var(--eff-clr-accent);
    outline-offset: 2px;
    border-radius:  2px;
}
```

---

## 9. Icon System

All icons are **SVG**, inline or sprite-based. No icon font libraries (for portability and performance). All icons use `fill: currentColor` or `stroke: currentColor` so they respond to theme color changes via CSS.

### Icon Assignments

| Element | Icon |
|---------|------|
| Variables (top-level) | `{ }` curly braces / code bracket |
| Classes (top-level) | `.cls` dot-class symbol or tag icon |
| Components (top-level) | Puzzle piece or widget stack |
| Colors subgroup | Color palette circle |
| Fonts/Typography subgroup | Letter A with serif |
| Numbers subgroup | Hash / number sign `#` |
| Preferences | Gear / cog |
| Manage Project | Grid / kanban board |
| Search | Magnifier |
| Export | Upload arrow in box |
| Import | Download arrow in box |
| Sync | Circular arrows |
| History | Clock |
| Help | Question mark circle |
| Load File | Folder open |
| Save File | Floppy disk |
| Save Changes (inactive) | Checkmark, muted (`--eff-clr-muted`) |
| Save Changes (active) | Checkmark, gold (`--eff-clr-accent`) |
| Collapse Left Panel | Left-pointing chevron |
| Expand Left Panel | Right-pointing chevron |
| Close Modal | ✕ |

### Tooltip Requirements

All interactive icons must have:
- An `aria-label` attribute (accessibility)
- A `title` attribute (fallback)
- A **CSS-driven tooltip** (not browser default) appearing after **300ms** hover delay
- Hover and active states defined in `eff-theme.css`

---

## 10. Modal Dialog System

All modals in EFF follow a consistent pattern.

### Modal Behavior Rules:
- Triggered by icon button actions (top menu bar or edit space)
- Appear centered over the EFF panel region (not full browser)
- Backdrop: semi-transparent overlay scoped to the EFF container
- **Shadow:** `--eff-shadow-lg` (`0 10px 20px rgba(61,47,31,0.15)`) per JimRForge shadow system
- Rounded corners: `border-radius: 8px`
- Background: `--eff-bg-card` (light) / dark equivalent
- Close button (✕) in top-right corner of modal
- ESC key closes the modal
- Click outside the modal closes it
- Modals do not scroll by default; internal content may scroll if needed
- Only one modal open at a time (no stacking)

### Defined Modals (v1):

| Modal | Trigger | Contents |
|-------|---------|----------|
| Preferences | Gear icon | Theme toggle (light/dark), default file path, editor preferences |
| Manage Project | Project board icon | Subgroup editor for Colors/Fonts/Numbers children: add, rename, reorder, remove |
| Search | Magnifier icon | Search input, results list (variables, classes, components) |
| Load File | Load button (right panel) | File path input or file browser |
| Export | Export icon (top bar) | Format selection, export action |
| Import | Import icon (top bar) | File upload / path entry |
| History | History icon (top bar) | Change log with undo buttons |
| Help | Help icon (top bar) | Quick reference content |

---

## 11. Color System (Complete Reference)

All color values are exact. No variations permitted per JimRForge UI Standards.

```css
:root {
    /* Primary Browns */
    --clr-primary:    #3d2f1f;   /* Deep brown — headings, button text */
    --clr-secondary:  #6d4c2f;   /* Medium brown — body text */
    --clr-tertiary:   #86400E;   /* Accent brown */

    /* Gold Accent */
    --clr-accent:     #f4c542;   /* Gold — buttons, highlights, active states */
    --clr-btn-hover:  #dda824;   /* Gold hover (15-20% darker) */

    /* Backgrounds (4-level hierarchy) */
    --clr-age-bg:     #faf6f0;   /* Level 1: Page background */
    --clr-card-bg:    #ffffff;   /* Level 2: Card/container background */
    --clr-light:      #faf9f6;   /* Level 3: Panel background */
    --clr-white:      #fff;      /* Level 4: Form field background */

    /* Text */
    --clr-txt:        #6d4c2f;   /* Main body text */
    --clr-txt-light:  #faf9f6;   /* Light text on dark backgrounds */
    --clr-txt-muted:  #64748b;   /* Muted/disabled text */

    /* Links */
    --clr-link:       #ce6565;   /* Default link — coral red */
    --clr-link-hover: #b54545;   /* Link hover — darker coral */

    /* Borders & Shadows */
    --clr-border:     #c9b89a;
    --clr-shadow-sm:  0 1px 2px rgba(61,47,31,0.08);
    --clr-shadow-md:  0 4px 6px rgba(61,47,31,0.12);
    --clr-shadow-lg:  0 10px 20px rgba(61,47,31,0.15);
    --clr-shadow-xl:  0 20px 30px rgba(61,47,31,0.18);

    /* Semantic/Status */
    --clr-success:    #059669;
    --clr-success-bg: #ecfdf5;
    --clr-error:      #dc2626;
    --clr-error-bg:   #fee2e2;
    --clr-warning:    #f59e0b;
    --clr-warning-bg: #fef3c7;
    --clr-info:       #3b82f6;
    --clr-info-bg:    #dbeafe;
}
```

---

## 12. Accessibility Standards

**Minimum:** WCAG 2.1 AA (required)  
**Target:** WCAG 2.1 AAA (preferred)

### Verified Contrast Ratios (JimRForge standard):
- Dark brown (`#3d2f1f`) on cream (`#faf6f0`): **8.2:1** — AAA ✅
- Medium brown (`#6d4c2f`) on white: **6.5:1** — AAA ✅
- Gold (`#f4c542`) buttons with brown text: **7.1:1** — AAA ✅
- Links (`#ce6565`) on white: **3.2:1** — AA Large Text ✅

### Focus States:

```css
.eff-app :focus,
.eff-app :focus-visible {
    outline:        2px solid var(--clr-accent);   /* Gold focus ring */
    outline-offset: 2px;
    border-radius:  2px;
}
```

### Additional Requirements:
- All icon buttons must have `aria-label` attributes
- Modal dialogs must trap focus while open (focus-trap pattern)
- Keyboard navigation for the left menu tree: arrow keys to navigate, Enter to select, Space to expand/collapse
- EFF panel must not break WordPress's own accessibility features

---

## 13. Data Architecture

### 13.1 Variable Data Model

```json
{
  "id": "uuid-v4",
  "name": "--eff-color-brand-primary",
  "value": "#2C3E50",
  "type": "color",
  "group": "Variables",
  "subgroup": "Colors",
  "category": "Branding",
  "source": "elementor-parsed",
  "modified": false,
  "created_at": "ISO8601",
  "updated_at": "ISO8601"
}
```

### 13.2 Class Data Model

```json
{
  "id": "uuid-v4",
  "name": ".eff-hero-text",
  "properties": {},
  "group": "Classes",
  "category": "user-defined",
  "source": "elementor-parsed",
  "created_at": "ISO8601",
  "updated_at": "ISO8601"
}
```

### 13.3 Component Data Model

```json
{
  "id": "uuid-v4",
  "name": "Hero Section",
  "atoms": [],
  "variables_bound": [],
  "classes_bound": [],
  "group": "Components",
  "created_at": "ISO8601",
  "updated_at": "ISO8601"
}
```

### 13.4 Project Config Model (Subgroup Definitions)

```json
{
  "version": "1.0",
  "groups": {
    "Variables": {
      "Colors": ["Branding", "Backgrounds", "Neutral", "Status"],
      "Fonts": [],
      "Numbers": ["Spacing", "Gaps", "Grids", "Radius"]
    }
  }
}
```

`Fonts` uses an empty array (`[]`) — signals dynamic population from Elementor's font registry.

### 13.5 Storage File

- Default format: **JSON** (`.eff.json`)
- Contains: project config, all variables, classes, and components
- Named by user in the right status panel file name field
- Saved to: WordPress uploads directory (or user-specified path)
- Load/Save handled via AJAX to `class-eff-ajax-handler.php`
- File format must remain platform-agnostic so a future Windows or Mac app can read the same files without conversion

---

## 14. CSS Parsing Module

`class-eff-css-parser.php` is responsible for:

1. Locating the compiled Elementor CSS file for the current site (e.g., `post-67.css` in the Elementor uploads directory)
2. Reading the file contents
3. Identifying the **Elementor v4 atomic `:root` block** — distinguished from the legacy `--e-global-*` block by position (it appears after the legacy block) and variable naming convention
4. Extracting all CSS custom properties from the v4 block
5. Returning a structured array of `{ name, value }` pairs to the data store
6. Triggering a UI refresh (via AJAX response) when Sync is invoked from the top menu bar

**Critical rule:** EFF is **read-only** with respect to Elementor's compiled CSS output. Never modify the source file. EFF manages its own data store and may write back to Elementor via Elementor's API in a future phase only.

---

## 15. State Management

### Unsaved Changes Tracking:
- Any change to a variable value, class definition, component, or subgroup configuration sets `hasUnsavedChanges = true`
- This flag controls the active/inactive state of the Save Changes button in the right panel
- On page unload with unsaved changes: display browser confirmation — "You have unsaved changes. Leave anyway?"

### Selection State:
- The currently selected left menu item is highlighted using `--eff-clr-accent`
- The edit space re-renders based on selection
- Selection state is held in JS memory (not persisted between sessions in v1)

---

## 16. Build & Development Standards

### PHP:
- Prefix all PHP classes: `EFF_`
- Follow WordPress Coding Standards
- All AJAX endpoints registered with `wp_ajax_{action}` and protected with `check_ajax_referer()`
- Plugin must pass WordPress Plugin Check (PCP) standards
- Use KSS/JSS or equivalent documentation standards for CSS/JS (per JimRForge standards)

### JavaScript:
- Prefix all JS globals: `EFF`
- Use **vanilla JS** — no jQuery dependency for EFF-specific UI logic
- WordPress jQuery available for WP API calls only; prefer `fetch()` with nonces for AJAX
- ES6+ modern JavaScript
- Transpile with Babel only if compatibility with older browsers is required (Jim's call)

### CSS:
- Prefix all CSS classes: `eff-`
- Use CSS custom properties extensively — all theme values as variables
- Scope the global Inter font override within `.eff-app` (not bare `*`) to avoid bleeding into WP admin
- No external CDN dependencies — all assets local or bundled
- Version CSS via plugin version constant when enqueuing (cache busting)
- Hard refresh (Ctrl+F5) required after CSS changes during development

### Branding:
- All references: "Jim R Forge" (not "JimRWeb")
- Author URI: https://jimrforge.com
- Copyright: Jim Roberts / Jim R Forge

---

## 17. Version Roadmap

| Phase | Scope |
|-------|-------|
| **v1 (Current)** | Framework, layout, panels, left menu tree, right status panel, top menu, modal system, CSS parser, variable data model, light/dark mode, file save/load |
| **v2** | Edit space content — variable list/edit UI, inline editing, drag-to-reorder |
| **v3** | Classes support (pending Elementor v4 classes exposure) |
| **v4** | Components registry |
| **v5** | Write-back to Elementor via API, History/undo, Export/Import |
| **Future** | Standalone Windows application port, Mac application port |

---

## 18. Pre-Build Checklist (Claude Code Reference)

Before writing code, verify the following are in place:

- [ ] Inter font files copied to `assets/fonts/` (4 WOFF2 files)
- [ ] SVG icon set prepared in `assets/icons/`
- [ ] `eff-defaults.json` seeded with default subgroup structure
- [ ] CSS custom properties defined in `eff-theme.css` for both light and dark modes
- [ ] PHP class prefixes: `EFF_`
- [ ] JS global prefixes: `EFF`
- [ ] CSS class prefixes: `eff-`
- [ ] Elementor v4 deep dive sections researched and filled in (Section 2)
- [ ] AJAX nonces registered and checked on all endpoints
- [ ] Font override scoped to `.eff-app` only
- [ ] All button text written in sentence case in HTML (not via CSS transform)
- [ ] All buttons borderless (box-shadow for depth only)
- [ ] All icon buttons have `aria-label` attributes
- [ ] Focus styles use gold outline (`--clr-accent`)
- [ ] Color values match JimRForge standards exactly (no approximations)

---

*End of EFF Claude Code Build Description v1.1*  
*© Jim Roberts / Jim R Forge — https://jimrforge.com*