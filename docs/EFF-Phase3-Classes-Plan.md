# AFF Phase 3 — Classes Support: Implementation Plan

**Document version:** 1.0  
**Date:** 2026-04-03  
**Author:** Research + planning document for Jim Roberts / JimRForge  
**AFF version target:** v0.4.0-beta  
**Status:** Pre-implementation — awaiting Jim sign-off before coding begins

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Elementor V4 Classes — What Was Found](#2-elementor-v4-classes--what-was-found)
3. [Data Sources and Storage Locations](#3-data-sources-and-storage-locations)
4. [CSS Output — What Goes in What File](#4-css-output--what-goes-in-what-file)
5. [Two Distinct Class Types](#5-two-distinct-class-types)
6. [PHP API Approach — AFF_Classes_Reader](#6-php-api-approach--aff_classes_reader)
7. [AFF Class Data Model — JSON Schema](#7-aff-class-data-model--json-schema)
8. [Left Panel Integration](#8-left-panel-integration)
9. [Edit Space UI Approach](#9-edit-space-ui-approach)
10. [AJAX Endpoints](#10-ajax-endpoints)
11. [AFF_Data_Store Extensions](#11-aff_data_store-extensions)
12. [Limitations and Unknowns](#12-limitations-and-unknowns)
13. [Recommended Implementation Sequence](#13-recommended-implementation-sequence)
14. [Open Questions Before Coding Starts](#14-open-questions-before-coding-starts)
15. [Research Sources](#15-research-sources)

---

## 1. Executive Summary

Elementor V4 (full release April 2026) has a first-class, production-ready **Global Classes** system. Unlike Variables — which are CSS custom properties written into the terminal `:root` block of the kit CSS file — Global Classes are an entirely different data system:

- Stored in the **WordPress database**, accessed via a **REST endpoint** (`wp-json/elementor/v1/global-classes`)
- **Not present** in the kit CSS file (`post-{id}.css`) that AFF's current CSS parser reads
- Managed in the Elementor editor's **Class Manager** panel
- Rendered to the frontend via Elementor's own CSS generation pipeline (separate from kit variables CSS)
- **No PHP read API currently exposed** to third-party plugins — developer documentation for V4 is explicitly deferred until after the 4.0 full release

This has a material impact on AFF Phase 3. The AFF CLAUDE.md note — *"Elementor v4 not yet exposing these"* — was accurate at time of writing and remains partially true: Elementor now stores and exposes class data via its own internal REST API, but there is no documented, stable PHP hook or filter for third-party plugins to read Global Class definitions programmatically.

**Phase 3 is implementable**, but AFF must use a direct database/REST read strategy rather than a clean PHP API. The plan below describes the safest approach: reading Elementor's class data from `wp_postmeta` on the active kit post, with a REST-based fallback.

---

## 2. Elementor V4 Classes — What Was Found

### 2.1 Architecture Overview

Elementor V4 introduces a CSS-first, class-driven design system. The core concept:

- **Variables** define values (colors, font families, sizes) — stored in kit CSS `:root`
- **Classes** define the scope and application of those values — stored in the database
- **Components** bundle classes + structure into reusable layout blocks (V4 Beta / Phase 4)

Every Atomic Element (heading, image, paragraph, button, etc.) receives:
1. A **Local Class** — auto-generated, unique per element, highest specificity, displayed in pink in the editor. Not reusable. Closest equivalent to V3's inline styles.
2. One or more optional **Global Classes** — user-defined, reusable, displayed in green. Managed via the Class Manager. The subject of AFF Phase 3.

### 2.2 Class Manager (Elementor-side)

The Class Manager panel in the Elementor V4 editor allows:
- Creating and naming Global Classes
- Defining styles per class: colors, typography, spacing, border, shadow, etc.
- Adding **States** per class: hover, active, focus
- Adjusting properties **per breakpoint** (desktop, tablet, mobile — all properties)
- Viewing usage counts (how many elements use each class)
- Filtering: unused classes, empty classes, page-specific classes
- Converting Local Class styles into a Global Class
- Renaming and reordering classes
- Importing/exporting classes between sites

### 2.3 Current Status (April 2026)

- V4 moved from Alpha to Beta in Elementor 3.35 (January 2026)
- V4 is now the default for all new Elementor sites starting April 2026
- Global Classes are production-stable but some edge-case bugs remain (CSS not outputting to frontend in popup templates, template widget)
- The 50-class limit (originally Alpha-era) is a community complaint; Elementor has not yet confirmed removal
- Developer API documentation for V4 explicitly deferred until after full 4.0 release

### 2.4 CSS Naming Convention

In earlier Alpha builds, Elementor auto-generated opaque identifiers as class names in the DOM. This was fixed in 3.30: **all Global Classes now render with their user-defined names in the HTML DOM**. A class named `primary-btn` appears as `class="primary-btn"` on the element. This matters for AFF's display: the class name stored in the database is the same class name in the markup.

The legacy `--e-global-color-[hash]` and `--e-global-typography-[hash]` CSS variable naming (from kit CSS `:root`) is a separate, older system (V3 globals) and should not be confused with V4 Global Classes.

---

## 3. Data Sources and Storage Locations

### 3.1 Primary Storage: `wp_postmeta` on the Active Kit Post

Elementor stores its kit-level data (global colors, typography, settings, and in V4 global classes) as post meta on the **active kit post**. The active kit ID is available from `get_option('elementor_active_kit')`, which AFF already uses in `AFF_CSS_Parser::get_active_kit_id()`.

The relevant post meta key for V4 global classes is not yet publicly documented by Elementor. Based on available evidence:

- The active kit ID is stored under `wp_options.elementor_active_kit`
- All Elementor editor data is stored as `_elementor_data` in `wp_postmeta`
- Global V4 class data is believed to be stored in a separate meta key on the kit post, likely `_elementor_global_classes` or similar (requires direct DB inspection on a live V4 site to confirm — see Open Questions)

### 3.2 REST API Access: `wp-json/elementor/v1/global-classes`

Elementor exposes global classes via its own internal REST endpoint:

```
GET  wp-json/elementor/v1/global-classes
PUT  wp-json/elementor/v1/global-classes
```

**CONFIRMED — Response structure verified 2026-04-03 against a live V4 site (`elementor-v40-test`).**

#### Confirmed response shape

```json
{
  "data": {
    "g-19ae5e7": {
      "id": "g-19ae5e7",
      "type": "class",
      "label": "xxxlarge",
      "variants": [ ... ]
    },
    "g-8e879b6": {
      "id": "g-8e879b6",
      "type": "class",
      "label": "color",
      "variants": []
    }
  },
  "meta": {
    "order": ["g-8e879b6", "g-cf3140a", "g-96ea32a", ...]
  }
}
```

#### Key structural facts

- **Top level:** `{ data: {}, meta: {} }` — two keys only.
- **`data`** is a **keyed object** (not an array). Keys are Elementor class IDs.
- **Class ID format:** `g-` prefix followed by 7 hex characters (e.g., `g-19ae5e7`). Not a UUID.
- **`type`** is always `"class"` for Global Classes.
- **`label`** is the CSS class name as it appears in the HTML DOM (e.g., `xxxlarge`, `colour-text-grey-light`). It is both the CSS selector and the display label — there is no separate `name` field.
- **`variants`** is an array of per-state/per-breakpoint style objects. Empty array means the class has no styles defined yet. The internal structure of each variant object is not yet captured — see Open Question 14.5.
- **`meta.order`** is an array of class IDs defining the user-defined display order in the Class Manager.

#### Mapping to AFF data model

| Elementor field | AFF field | Notes |
|-----------------|-----------|-------|
| `id` (e.g. `g-19ae5e7`) | `elementor_id` | Stored verbatim — not converted |
| `label` | `name` AND `label` | Serves both roles; AFF `label` starts as a copy and can be overridden |
| `type` | (discarded) | Always "class"; AFF infers from context |
| `variants` | (phase 3.4+) | Style data — not parsed in Phase 3.1/3.2 |
| `meta.order` index | `order` | Used to set initial sort order |

**AFF will use the GET endpoint as the primary read source.** This is safer than raw `wp_postmeta` queries because:
- It goes through Elementor's own access control
- It returns a normalized JSON response
- It is less likely to break between Elementor versions than meta key names

**Authentication:** The REST endpoint uses WordPress nonce authentication. AFF will use `wp_create_nonce('wp_rest')` on the server side and pass it in `X-WP-Nonce` headers from JS, or call it server-side from a PHP AJAX handler using `wp_remote_get()`.

### 3.3 Export/Import JSON (Supplementary Source)

When a user exports Classes and Variables from Elementor (via Elementor > Tools > Export), they receive a JSON file. AFF could parse an exported file as a manual import path if the REST approach fails. This is a fallback, not the primary path.

### 3.4 Summary of Data Source Hierarchy

| Priority | Source | Method | Notes |
|----------|--------|--------|-------|
| 1 (preferred) | Elementor REST API `wp-json/elementor/v1/global-classes` | PHP `wp_remote_get()` or server-side | Authenticated, normalized, version-resilient |
| 2 (fallback) | `wp_postmeta` direct read on kit post | `get_post_meta($kit_id, '_elementor_global_classes', true)` | Faster, no HTTP, but meta key must be verified |
| 3 (manual) | User-uploaded Elementor export JSON | File parse in AFF | For offline/exported sites |

---

## 4. CSS Output — What Goes in What File

This section is critical because it defines the boundary between AFF's existing CSS parser and the new classes reader.

### 4.1 Kit CSS File (`post-{id}.css`) — Variables Only

The kit CSS file that AFF currently parses contains:
- **Block 1:** Legacy `--e-global-*` variables (V3 global colors, typography as CSS custom properties)
- **Block 2 (terminal `:root`):** V4 user-defined atomic variables — the ones AFF reads

**Global Class CSS definitions are NOT in this file.** The kit CSS file does not contain `.my-class { ... }` blocks.

### 4.2 Where Global Class CSS Lives on the Frontend

Elementor V4 uses a JIT (Just-In-Time) rendering model. Global Class CSS is bundled into a single global stylesheet generated by Elementor and served separately from the kit variables file. Evidence suggests this is served either:
- As a separate generated CSS file in `/wp-content/uploads/elementor/css/`
- As an inline `<style>` block injected by Elementor's frontend rendering (`elementor/post/render` hook)

The exact mechanism is not yet confirmed by official documentation. The CSS would look like:

```css
.primary-btn {
  background-color: var(--my-brand-color);
  padding: 12px 24px;
  border-radius: 4px;
}
.primary-btn:hover {
  background-color: var(--my-brand-color-dark);
}
@media (max-width: 768px) {
  .primary-btn {
    padding: 8px 16px;
  }
}
```

**AFF Phase 3 does not need to parse this CSS output.** AFF reads the class definitions (names, metadata, applied elements) from the REST API/database, not from the generated stylesheet. The stylesheet is read-only output from Elementor; AFF manages the definition layer.

---

## 5. Two Distinct Class Types

Understanding the distinction is important for AFF's data model and UI.

### 5.1 Local Class

- Auto-generated per element (e.g., `e-7a3bc1` style identifier internally, but unique per instance)
- Highest specificity — always wins
- Cannot be shared or reused
- Not relevant to AFF Phase 3 (these are per-page, per-element; too granular)
- **AFF Phase 3 scope: EXCLUDE Local Classes**

### 5.2 Global Class

- User-defined name (e.g., `primary-btn`, `hero-heading`, `card-body`)
- Site-wide — shared across pages and elements
- Managed in Class Manager
- Has states (hover, active, focus) and breakpoint variants
- Has a usage count
- Can be marked unused, empty, or page-specific
- **AFF Phase 3 scope: Global Classes only**

---

## 6. PHP API Approach — `AFF_Classes_Reader`

Create a new file: `E:/projects/plugins/eff/includes/class-aff-classes-reader.php`

This is a **read-only** class (parallel to `AFF_CSS_Parser`, which is also read-only). It does not extend `AFF_CSS_Parser` — it is a sibling class for a different data source.

### 6.1 Class Signature

```php
class AFF_Classes_Reader {

    /**
     * Fetch all Global Classes from Elementor's REST endpoint.
     * Returns normalized array or empty array on failure.
     *
     * @return array[] Array of AFF class objects (see data model section).
     */
    public function fetch_from_rest(): array { ... }

    /**
     * Read Global Classes directly from kit post meta (fallback).
     * Returns raw Elementor data array or empty array.
     *
     * @return array
     */
    public function read_from_postmeta(): array { ... }

    /**
     * Parse an Elementor export JSON file for classes.
     * Used by the manual import path.
     *
     * @param string $file_path Absolute path to export JSON file.
     * @return array[]
     */
    public function parse_export_file( string $file_path ): array { ... }

    /**
     * Normalize raw Elementor class data into AFF class objects.
     *
     * Accepts the full REST response array (with 'data' and 'meta' keys)
     * and returns a flat array of AFF-normalized class objects.
     *
     * Confirmed response shape (2026-04-03):
     *   { data: { [id]: { id, type, label, variants } }, meta: { order: [...] } }
     *
     * @param array $raw Full REST response array.
     * @return array[] Flat array of AFF class objects.
     */
    public function normalize( array $raw ): array {
        $data  = $raw['data'] ?? [];
        $order = $raw['meta']['order'] ?? [];

        if ( empty( $data ) || ! is_array( $data ) ) {
            return [];
        }

        // Build position lookup from meta.order for initial sort.
        $order_index = array_flip( $order );

        $classes = [];
        $now     = gmdate( 'c' );

        foreach ( $data as $elementor_id => $entry ) {
            if ( ! is_array( $entry ) ) {
                continue;
            }

            $label    = trim( $entry['label'] ?? '' );
            $variants = $entry['variants'] ?? [];

            if ( '' === $label ) {
                continue; // skip malformed entries
            }

            $classes[] = [
                'id'             => '',        // AFF UUID assigned by AFF_Data_Store::add_class()
                'elementor_id'   => $elementor_id,
                'name'           => $label,    // CSS class name — same as label in Elementor's model
                'label'          => $label,    // AFF display label; user may override
                'type'           => 'global',
                'source'         => 'elementor-fetched',
                'status'         => 'synced',
                'group'          => 'Classes',
                'category'       => 'Uncategorized',
                'category_id'    => '',
                'order'          => $order_index[ $elementor_id ] ?? 9999,
                'usage_count'    => null,
                'has_states'     => ! empty( $variants ),  // refined in Phase 3.4 when variant structure is known
                'has_responsive' => false,
                'states'         => [],
                'breakpoints'    => [],
                'notes'          => '',
                'tags'           => [],
                'created_at'     => $now,
                'updated_at'     => $now,
                'last_synced_at' => $now,
            ];
        }

        // Sort by initial order position.
        usort( $classes, static fn( $a, $b ) => $a['order'] <=> $b['order'] );

        return $classes;
    }
}
```

### 6.2 `fetch_from_rest()` Implementation Notes

```php
public function fetch_from_rest(): array {
    $url      = rest_url( 'elementor/v1/global-classes' );
    $nonce    = wp_create_nonce( 'wp_rest' );
    $response = wp_remote_get( $url, [
        'headers' => [
            'X-WP-Nonce' => $nonce,
        ],
        'timeout' => 10,
    ] );

    if ( is_wp_error( $response ) ) {
        return [];
    }

    $code = wp_remote_retrieve_response_code( $response );
    if ( 200 !== (int) $code ) {
        return [];
    }

    $body = wp_remote_retrieve_body( $response );
    $data = json_decode( $body, true );

    if ( JSON_ERROR_NONE !== json_last_error() || ! is_array( $data ) ) {
        return [];
    }

    return $this->normalize( $data );
}
```

**Important:** `wp_remote_get()` makes an HTTP request from the server to itself. On some local environments (Local by Flywheel, WAMP) this can fail if the loopback URL is not reachable. AFF must handle this gracefully and fall through to the `read_from_postmeta()` method.

### 6.3 `read_from_postmeta()` Implementation Notes

```php
public function read_from_postmeta(): array {
    $kit_id = AFF_CSS_Parser::get_active_kit_id();
    if ( ! $kit_id ) {
        return [];
    }

    // NOTE: Meta key name must be verified against a live V4 site.
    // Likely candidates: '_elementor_global_classes', '_e_global_classes'
    // See Open Questions section 14.1.
    $meta_key = apply_filters( 'aff_global_classes_meta_key', '_elementor_global_classes' );
    $raw      = get_post_meta( $kit_id, $meta_key, true );

    if ( empty( $raw ) || ! is_array( $raw ) ) {
        // Try JSON string variant
        if ( is_string( $raw ) ) {
            $decoded = json_decode( $raw, true );
            if ( is_array( $decoded ) ) {
                return $this->normalize( $decoded );
            }
        }
        return [];
    }

    return $this->normalize( $raw );
}
```

### 6.4 Critical Rules for `AFF_Classes_Reader`

- **Read-only.** It never writes to Elementor's data. Same rule as `AFF_CSS_Parser`.
- **No WordPress dependencies in normalize().** The normalize method must be platform-portable.
- The class must have `if ( ! defined( 'ABSPATH' ) ) { exit; }` at the top.
- Prefix: `AFF_Classes_Reader` — follows `AFF_` naming rule.

---

## 7. AFF Class Data Model — JSON Schema

### 7.1 The AFF Class Object

Global Classes are stored in the `classes` array of the `.aff.json` project file. Each class object:

```json
{
  "id": "uuid-v4",
  "elementor_id": "e-class-identifier-or-null",
  "name": "primary-btn",
  "label": "Primary Button",
  "type": "global",
  "source": "elementor-fetched",
  "status": "synced",
  "group": "Classes",
  "category": "Buttons",
  "category_id": "uuid-v4-or-empty",
  "order": 0,
  "usage_count": 12,
  "has_states": true,
  "has_responsive": false,
  "states": ["hover", "focus"],
  "breakpoints": ["desktop", "tablet"],
  "notes": "",
  "tags": [],
  "created_at": "2026-04-03T10:00:00+00:00",
  "updated_at": "2026-04-03T10:00:00+00:00",
  "last_synced_at": "2026-04-03T10:00:00+00:00"
}
```

### 7.2 Field Definitions

| Field | Type | Description |
|-------|------|-------------|
| `id` | string (UUID v4) | AFF-generated internal identifier |
| `elementor_id` | string\|null | Elementor's internal class identifier (if exposed by REST response) |
| `name` | string | The CSS class name as it appears in HTML (`primary-btn`) |
| `label` | string | Human-readable display label; defaults to `name` if not set |
| `type` | enum: `"global"` | Phase 3 scope: Global only. Local classes excluded. |
| `source` | enum | `"elementor-fetched"` \| `"user-defined"` \| `"elementor-import"` |
| `status` | enum | `"synced"` \| `"modified"` \| `"aff-only"` \| `"orphaned"` |
| `group` | string | Always `"Classes"` (top-level menu group) |
| `category` | string | User-defined category name (e.g., "Buttons", "Typography") |
| `category_id` | string | UUID of category in `config.classCategories` |
| `order` | integer | Display sort order within category |
| `usage_count` | integer\|null | Number of elements using this class on site (from Elementor fetch) |
| `has_states` | boolean | Whether this class has any state variants (hover/focus/active) |
| `has_responsive` | boolean | Whether this class has any per-breakpoint overrides |
| `states` | string[] | Which states are defined: `["hover", "active", "focus"]` |
| `breakpoints` | string[] | Which breakpoints have overrides: `["desktop", "tablet", "mobile"]` |
| `notes` | string | Developer notes (AFF-only, not synced to Elementor) |
| `tags` | string[] | User-defined tags for filtering (AFF-only) |
| `created_at` | ISO 8601 | When AFF first recorded this class |
| `updated_at` | ISO 8601 | Last AFF modification |
| `last_synced_at` | ISO 8601 | Last successful Elementor sync |

### 7.3 Status Enum Values

| Status | Meaning |
|--------|---------|
| `synced` | Class exists in Elementor and in AFF file, data matches last sync |
| `modified` | Class has AFF-side edits (notes, tags, category) not yet auto-persisted |
| `aff-only` | Class exists in AFF file but not found in Elementor (deleted from editor?) |
| `orphaned` | Class exists in Elementor but not in AFF file (appeared since last sync) |

### 7.4 `.aff.json` Storage Structure

Classes are stored under the top-level `classes` key:

```json
{
  "version": "1.0",
  "config": {
    "classCategories": [
      { "id": "uuid", "name": "Buttons", "order": 0, "locked": false },
      { "id": "uuid", "name": "Typography", "order": 1, "locked": false },
      { "id": "uuid", "name": "Layout", "order": 2, "locked": false },
      { "id": "uuid", "name": "Uncategorized", "order": 999, "locked": true }
    ]
  },
  "variables": [ ... ],
  "classes": [
    { "id": "...", "name": "primary-btn", ... },
    { "id": "...", "name": "hero-heading", ... }
  ],
  "components": []
}
```

The `config.classCategories` array follows the same pattern as `config.categories` (used for variable color categories). It uses AFF_Data_Store's existing `subgroup_to_cat_key()` pattern — a new entry `'Classes' => 'classCategories'` is added to the map.

### 7.5 Comparison with Variable Data Model

The Class model is intentionally parallel to the Variable model to keep the data layer consistent:

| Variable field | Class equivalent | Notes |
|----------------|-----------------|-------|
| `name` (CSS var name) | `name` (CSS class name) | Both are the actual CSS identifier |
| `value` | *(no direct equivalent)* | Class styles live in Elementor; AFF doesn't store individual CSS properties |
| `subgroup` | *(not used)* | Classes have no subgroup level; top-level only |
| `category` | `category` | Both have user-definable categories |
| `source` | `source` | Same enum pattern |
| `status` | `status` | Same enum pattern |
| `modified` | *(not used)* | Replaced by `status` enum |

---

## 8. Left Panel Integration

### 8.1 Current State

The left panel menu tree already has `▶ Classes` as a fixed top-level item (collapsed arrow, no sub-items). The CLAUDE.md specification is explicit: this item is fixed and cannot be renamed or removed.

### 8.2 Phase 3 Expansion

When `▶ Classes` is clicked/expanded, it reveals category sub-items:

```
▼ Classes                ← fixed top-level, expands on click
    • Buttons            ← user-definable category
    • Typography
    • Layout
    • Uncategorized      ← locked, always present, always last
```

Rules:
- Category sub-items follow the exact same rules as variable category sub-items
- At least one category must always remain (Uncategorized is locked)
- Clicking a category loads its classes in the center Edit Space
- Categories are managed via the existing Manage Project modal (new "Classes" tab)
- "Uncategorized" receives any class not assigned to a category

### 8.3 Left Panel JS Changes

File: `admin/js/aff-panel-left.js`

Add a `renderClassesTree(categories, classCounts)` function following the same pattern as the existing variable tree renderer. The Classes branch should:
- Show category names with a count badge (number of classes in that category)
- Support collapse/expand of the top-level Classes node
- Support arrow-key navigation, Enter to select, Space to expand
- Highlight active category with `--aff-clr-accent`

No jQuery. Follow the existing vanilla JS patterns in `aff-panel-left.js`.

---

## 9. Edit Space UI Approach

### 9.1 View: Classes List (Category selected)

When a category is selected from the left panel, the center Edit Space shows a list of all Global Classes in that category. Each row:

```
┌─────────────────────────────────────────────────────────────┐
│ ○ primary-btn           Buttons     ↺ synced    12 uses  [⋮]│
│ ○ secondary-btn         Buttons     ↺ synced     3 uses  [⋮]│
│ ○ hero-heading          Typography  ↑ orphaned   —       [⋮]│
└─────────────────────────────────────────────────────────────┘
```

Columns:
- **Class name** (as it appears in CSS/HTML) — monospace font
- **Category** — badge or plain text
- **Status indicator** — icon + color-coded: synced (green), modified (gold), aff-only (muted), orphaned (red)
- **Usage count** — from last Elementor fetch
- **Actions menu [⋮]** — Edit notes, Move to category, Remove from AFF

### 9.2 No Inline Editing of CSS Properties

AFF Phase 3 **does not** allow editing the CSS properties of a class (colors, typography, spacing). That is Elementor's job, done in the Elementor editor. AFF is a **management and documentation layer**, not a style editor for classes. This mirrors AFF's approach to variables: AFF organizes and annotates, Elementor owns the authoritative values.

What AFF CAN edit on a class:
- `label` — human-readable display name (AFF-only metadata)
- `category` — which AFF category this class belongs to
- `notes` — developer notes
- `tags` — for filtering
- `order` — drag-to-reorder within a category

### 9.3 Detail/Expand Modal (`.aff-class-detail-modal`)

Clicking a class opens a detail view in the existing AFF modal system (`AFF.Modal.open()`):

```
┌──────────────────────────────────────────────────────┐
│  primary-btn                              [×]         │
├──────────────────────────────────────────────────────┤
│  CSS class name:  primary-btn                         │
│  Label:           [Primary Button         ]           │
│  Category:        [Buttons ▼              ]           │
│  Status:          ↺ synced (last synced 2026-04-03)   │
│                                                       │
│  Usage count:     12 elements                         │
│  States:          hover, focus                        │
│  Breakpoints:     desktop, tablet                     │
│                                                       │
│  Tags:            [ button ] [ cta ] [+ add tag]      │
│                                                       │
│  Notes:                                               │
│  ┌───────────────────────────────────────────────┐   │
│  │ Used for all primary CTA buttons. Accent       │   │
│  │ gold background. Matches brand spec.           │   │
│  └───────────────────────────────────────────────┘   │
│                                                       │
│  [Save]                              [Edit in Elementor →]│
└──────────────────────────────────────────────────────┘
```

The "Edit in Elementor" link opens the Elementor editor (deep link to the kit/Class Manager if possible; otherwise just to the editor). This is a link only — AFF does not open Elementor programmatically.

### 9.4 Sync Button

In the top bar or right panel, a "Sync Classes" button triggers `aff_sync_classes` AJAX action. This:
1. Calls `AFF_Classes_Reader::fetch_from_rest()` (or postmeta fallback)
2. Merges new/updated classes with the existing AFF store
3. Marks disappeared classes as `orphaned`
4. Returns updated counts and status to the UI

The sync is **non-destructive**: AFF-only metadata (labels, notes, tags, categories) is preserved.

### 9.5 Empty State

If no Elementor Global Classes are found, the Edit Space shows:

```
No Global Classes found in Elementor.

Create classes in the Elementor editor using the Class Manager,
then sync to import them here.

[Sync Classes]  [Open Elementor →]
```

---

## 10. AJAX Endpoints

All endpoints follow AFF conventions: `wp_ajax_{action}`, nonce via `check_ajax_referer()`, `manage_options` capability check, response via `wp_send_json_success()` / `wp_send_json_error()`.

| Action | Handler Method | Description |
|--------|---------------|-------------|
| `aff_sync_classes` | `ajax_aff_sync_classes()` | Fetch from Elementor, merge into store, return updated class list |
| `aff_get_classes` | `ajax_aff_get_classes()` | Return stored classes (no Elementor fetch) |
| `aff_update_class_meta` | `ajax_aff_update_class_meta()` | Update AFF-only fields: label, notes, tags, category, order |
| `aff_move_class_category` | `ajax_aff_move_class_category()` | Move class to a different category |
| `aff_get_class_categories` | `ajax_aff_get_class_categories()` | Return class category list |
| `aff_add_class_category` | `ajax_aff_add_class_category()` | Add a new class category |
| `aff_rename_class_category` | `ajax_aff_rename_class_category()` | Rename a class category |
| `aff_delete_class_category` | `ajax_aff_delete_class_category()` | Delete a class category (reassign classes to Uncategorized) |
| `aff_reorder_class_categories` | `ajax_aff_reorder_class_categories()` | Reorder class categories |

These are added to the existing `class-aff-ajax-handler.php`. No new PHP files are needed for the AJAX layer.

---

## 11. `AFF_Data_Store` Extensions

### 11.1 `subgroup_to_cat_key()` — Add Classes Entry

Add `'Classes' => 'classCategories'` to the map in the existing `subgroup_to_cat_key()` private method:

```php
$map = [
    'Colors'  => 'categories',
    'Fonts'   => 'fontCategories',
    'Numbers' => 'numberCategories',
    'Classes' => 'classCategories',   // ← Phase 3 addition
];
```

This gives Classes full access to the existing `get_categories_for_subgroup()`, `add_category_for_subgroup()`, `update_category_for_subgroup()`, `delete_category_for_subgroup()`, and `reorder_categories_for_subgroup()` methods at no extra cost.

### 11.2 Classes CRUD Methods

Expand the existing classes placeholder section (currently only `get_classes()`) with full CRUD:

```php
public function add_class( array $class ): string { ... }
public function update_class( string $id, array $data ): bool { ... }
public function delete_class( string $id ): bool { ... }
public function find_class_by_name( string $name ): ?array { ... }
public function import_fetched_classes( array $fetched ): array { ... }
```

`import_fetched_classes()` is the merge method: it returns `['added' => int, 'updated' => int, 'orphaned' => int]` and is the server-side equivalent of the sync operation.

### 11.3 `class_defaults()` Private Helper

Add a parallel method to `variable_defaults()`:

```php
private function class_defaults(): array {
    return [
        'id'             => '',
        'elementor_id'   => null,
        'name'           => '',
        'label'          => '',
        'type'           => 'global',
        'source'         => 'elementor-fetched',
        'status'         => 'synced',
        'group'          => 'Classes',
        'category'       => 'Uncategorized',
        'category_id'    => '',
        'order'          => 0,
        'usage_count'    => null,
        'has_states'     => false,
        'has_responsive' => false,
        'states'         => [],
        'breakpoints'    => [],
        'notes'          => '',
        'tags'           => [],
        'created_at'     => '',
        'updated_at'     => '',
        'last_synced_at' => '',
    ];
}
```

### 11.4 `migrate_data()` Extension

Add a classes migration block (analogous to the existing variables migration block) to handle future schema additions without breaking older `.aff.json` files.

---

## 12. Limitations and Unknowns

### 12.1 No Official PHP API for Third-Party Plugins

**The most significant limitation.** Elementor has not published any PHP hooks, filters, or service classes for reading Global Class data in third-party plugins. The developer documentation explicitly says it will arrive "after 4.0 release." This means AFF must use:
- The internal REST endpoint (undocumented, could change)
- Direct `wp_postmeta` read (brittle if meta key changes)

Both approaches carry upgrade risk. The REST endpoint is the more stable of the two (changing a public-facing endpoint URL is a harder breaking change for Elementor than renaming an internal meta key).

### 12.2 Meta Key Name Unknown Without Direct DB Inspection

The exact `wp_postmeta` key name for Global Classes on the kit post is not in any public documentation. It must be confirmed by:
1. Installing Elementor on the AFF test site (`elementor-v40-test`)
2. Creating a Global Class in the Class Manager
3. Querying the database: `SELECT meta_key, meta_value FROM wp_postmeta WHERE post_id = [kit_id]`
4. Identifying the key that holds the class data

This is a 10-minute task but is **blocking** for the postmeta fallback path.

### 12.3 ✅ REST Endpoint Response Shape — Confirmed

Confirmed 2026-04-03. Structure: `{ data: { [g-XXXXXXX]: { id, type, label, variants } }, meta: { order: [...] } }`. See section 3.2 for full documentation. The `normalize()` method is now written.

### 12.4 Local Class Data Not Accessible

Local Classes (per-element, unique) are stored inside the `_elementor_data` JSON of each individual page/post. They are not surfaced by the global-classes REST endpoint. AFF Phase 3 explicitly excludes Local Classes as out of scope.

### 12.5 50-Class Limit

Elementor currently limits Global Classes to 50 per site (community complaint, GitHub discussion #32277). This is an Elementor-side constraint, not AFF's. AFF should document this in the UI but cannot lift the limit.

### 12.6 wp_remote_get() Loopback Issues on Local Environments

On Local by Flywheel (Jim's development environment), `wp_remote_get()` making a loopback HTTP call can fail due to the local server not accepting loopback connections. AFF must:
- Detect failure and fall through to the postmeta method silently
- Surface an informative message in the UI if both methods fail

### 12.7 CSS Properties Not Stored in AFF

AFF stores class metadata only — not the actual CSS property values (colors, font-size, etc.) assigned to each class. This is intentional: those values live in Elementor and would require parsing Elementor's internal style schema (a complex, nested, per-breakpoint/state structure). Phase 3 is a management layer, not a CSS editor.

If Jim later wants AFF to display the actual CSS properties of a class, this would be a Phase 3.x extension requiring significant additional research into Elementor's internal style data format.

### 12.8 Responsive Classes Are a Feature Request, Not Yet Implemented

GitHub discussion #34972 ("Responsive CSS Classes") shows that class assignments per breakpoint (applying/removing a class on tablet vs desktop) is an open feature request in Elementor, not yet implemented. AFF's `has_responsive` and `breakpoints` fields track per-class style breakpoints, which IS implemented in Elementor. These are different concepts.

---

## 13. Recommended Implementation Sequence

### Phase 3.0 — Foundation (prerequisite: DB inspection)

**Status (2026-04-03):**
- ✅ REST response shape confirmed (Blocker 2 resolved — section 3.2 and `normalize()` updated)
- ⏳ `wp_postmeta` meta key name still unconfirmed (Blocker 1 — needed only for the fallback read path)

**Remaining before Phase 3.1:**
1. Confirm the `wp_postmeta` meta key for Global Classes (Blocker 1). Easiest approach via WP-CLI on `elementor-v40-test`:
   ```bash
   wp eval "print_r(get_post_meta(67));" 2>&1 | grep -i class
   ```
   Or use phpMyAdmin. Only needed for the postmeta fallback — REST API is confirmed working and is the primary path.
2. *(Optional but useful)* Expand one non-empty `variants` entry in DevTools to capture variant structure — needed for Phase 3.4 style display, not Phase 3.1.

Phase 3.1 coding can begin now using the REST endpoint exclusively. Postmeta fallback can be added in a later sub-phase once the key is confirmed.

### Phase 3.1 — Data Layer

Files to create/modify:
- **Create** `includes/class-aff-classes-reader.php` — read-only fetcher + normalizer
- **Modify** `includes/class-aff-data-store.php` — add `classCategories` to map, add Classes CRUD
- **Modify** `includes/class-aff-ajax-handler.php` — add all `aff_sync_classes`, `aff_get_classes`, class meta AJAX endpoints
- **Modify** `includes/class-aff-loader.php` — register `class-aff-classes-reader.php`

Deliverable: `aff_sync_classes` AJAX action returns a normalized class list from Elementor.

### Phase 3.2 — Left Panel

Files to modify:
- **Modify** `admin/js/aff-panel-left.js` — add `renderClassesTree()`, expand `▶ Classes` node
- **Modify** `admin/css/aff-layout.css` — any layout adjustments for class category items (likely minimal; reuses variable category styles)

Deliverable: Clicking `▶ Classes` in the left panel expands to show categories. Clicking a category dispatches a `classCategory:selected` event.

### Phase 3.3 — Edit Space List View

Files to modify/create:
- **Modify** `admin/js/aff-edit-space.js` — add `renderClassesList(category, classes)` handler
- **Create** or extend `admin/css/aff-theme.css` if class-specific color/badge tokens are needed

Deliverable: Selecting a class category shows the list of Global Classes with status badges and usage counts.

### Phase 3.4 — Detail Modal

Files to modify:
- **Modify** `admin/js/aff-edit-space.js` or create `admin/js/aff-classes.js` — class detail modal builder
- Modal uses the existing `AFF.Modal.open()` — no new modal infrastructure needed

Deliverable: Clicking a class row opens the detail modal with editable label/notes/tags/category and a read-only info section.

### Phase 3.5 — Manage Project Modal — Classes Tab

Files to modify:
- The existing Manage Project modal needs a new "Classes" tab for category management
- Follows the same add/rename/delete/reorder pattern as the Variables categories tab

Deliverable: Users can create, rename, reorder, and delete class categories.

### Phase 3.6 — Sync Button + Status

Files to modify:
- Add "Sync Classes" button to the top bar or right panel
- Visual sync status: last synced timestamp, class count by status

---

## 14. Open Questions Before Coding Starts

These must be answered before Phase 3.1 begins. All can be resolved in one hour of direct DB/API inspection on the test site.

### 14.1 (BLOCKING) What is the `wp_postmeta` key for Global Classes on the kit post?

**How to answer:** On `elementor-v40-test`, create a Global Class, then run:
```sql
SELECT meta_key, LEFT(meta_value, 200)
FROM wp_postmeta
WHERE post_id = 67
ORDER BY meta_key;
```
(Replace 67 with the active kit ID from `wp_options.elementor_active_kit`.)

### 14.2 ✅ RESOLVED — REST response shape confirmed

**Confirmed 2026-04-03.** Full structure documented in section 3.2. The `normalize()` method in section 6 is now written against the real response. See section 3.2 for field mapping.

### 14.3 Does the REST endpoint require a specific Elementor-issued nonce, or does the standard `wp_rest` nonce work?

**How to answer:** Inspect the `X-WP-Nonce` header value used by the Elementor editor's own requests. If it matches `wp_create_nonce('wp_rest')`, the standard approach works. If Elementor uses its own nonce action, AFF must replicate it.

### 14.4 Is the 50-class limit enforced client-side only (JS) or server-side (REST validation)?

**Impact on AFF:** If it's only client-side, AFF's read path is unaffected. If server-side, the REST endpoint may only return ≤50 classes regardless.

### 14.5 Are class styles (CSS property values) present in the REST response?

**Partially answered 2026-04-03.** The REST response includes a `variants` array on each class. Classes with no styles defined have `variants: []`. Classes with styles have a non-empty `variants` array. **The internal structure of each variant object is still unknown** — a follow-up capture is needed by expanding one of the non-empty variant arrays in the browser DevTools while the Elementor editor is open. This is **not blocking for Phase 3.1–3.3** (AFF ignores variant data until Phase 3.4). The `has_states` field is conservatively set to `!empty(variants)` until the structure is confirmed.

### 14.6 Does the `elementor-v40-test` site have Global Classes created? If not, create some test classes first.

---

## 15. Research Sources

The following sources were consulted during research for this document:

- [Elementor Editor 4.0 Developers Update](https://developers.elementor.com/elementor-editor-4-0-developers-update/)
- [Introducing version 4.0: the new atomic foundation](https://elementor.com/blog/editor-40-atomic-forms-pro-interactions/)
- [Elementor V4 Beta Production-Ready: CSS-First Changes for Developers | 365i](https://www.365iwebdesign.co.uk/news/2026/01/28/elementor-v4-beta-production-ready-css-first/)
- [Editor V4 Beta Release Discussion #35165](https://github.com/orgs/elementor/discussions/35165)
- [Classes in Elementor](https://elementor.com/help/classes-in-elementor-2/)
- [The Elementor Editor Class Manager](https://elementor.com/help/the-elementor-editor-class-manager/)
- [How to export and import variables and classes](https://elementor.com/help/how-to-export-and-import-variables-and-classes/)
- [Global Class API 403 Issue #32234](https://github.com/elementor/elementor/issues/32234) — confirms REST endpoint `wp-json/elementor/v1/global-classes`
- [Editor V4 Global Classes Disappear Issue #31517](https://github.com/elementor/elementor/issues/31517)
- [Use real class names in CSS Discussion #31055](https://github.com/orgs/elementor/discussions/31055)
- [Allow more than 50 Global Classes Discussion #32277](https://github.com/orgs/elementor/discussions/32277)
- [Import Global Classes Discussion #31811](https://github.com/orgs/elementor/discussions/31811)
- [Plugin Development Documentation & API Access for Elementor v4 Discussion #32950](https://github.com/orgs/elementor/discussions/32950) — confirms developer docs deferred until after 4.0 release
- [Responsive CSS Classes Discussion #34972](https://github.com/orgs/elementor/discussions/34972)
- [Elementor 3.35 Developers Update](https://developers.elementor.com/elementor-editor-3-35-developers-update/)
- [Elementor 4.0: Engineering the Atomic Revolution - DEV Community](https://dev.to/fachremyputra/elementor-40-engineering-the-atomic-revolution-1pci)
- [Elementor Version 4 Explained - Essential Addons](https://essential-addons.com/elementor-version-4-the-atomic-editor/)
- [Why Elementor is going CSS-first](https://elementor.com/blog/editor-v4-css-first/)
- [Version 4 FAQs](https://elementor.com/products/website-builder/v4-faq/)
- [Local and Global Class Styles not appearing on frontend Discussion #33646](https://github.com/orgs/elementor/discussions/33646)

---

*End of document. All sections are complete pending answers to the Open Questions in section 14.*
