# AFF Product Plan — Variables, Classes, Components

**Document version:** 2.0
**Date:** 2026-08-04
**Status:** Living plan — scope, architecture, and roadmap for AFF's three asset pillars.
**Supersedes:** `docs/CLASSES-PLAN.md` v2.0 (2026-05-21) — its confirmed technical findings and implementation plan are folded into this document (Sections 3-6). That file's own text can be retired once this document is reviewed; nothing here contradicts it, only reorganizes and extends it.

---

## Table of Contents

1. Current State — The Three Pillars
2. Variables — Current State & Gaps
3. Classes — What Elementor's Global Classes Are (confirmed from source)
4. Classes — Data Model & Sync Architecture
5. Classes — UI Design
6. Classes — Implementation Plan & Phased Delivery
7. Classes — Open Questions
8. Elementor's Likely Direction (flagged speculation)
9. Roadmap Summary
10. Next Steps

---

## 1. Current State — The Three Pillars

AFF's stated identity (readme.txt) is a management interface for the three asset types introduced by Elementor V4's atomic widget architecture: **Variables**, **Classes**, **Components**.

| Pillar | Status | Notes |
|---|---|---|
| Variables | Shipped, mature | Full CRUD, categorization, tints/shades/alpha generation, usage-count scanning, versioned backups, multi-project support, V3→V4 color migration |
| Classes | Planned in detail, unbuilt | Technical plan complete and source-verified (Sections 3-7); no code written yet |
| Components | Named, undesigned | No technical investigation has been done; Elementor's own implementation may not be stable yet |

This document exists to close the gap between "three pillars" being a stated identity and each pillar having an actual, current, honest plan.

---

## 2. Variables — Current State & Gaps

**Confirmed shipped, this session:** centralized input sanitization on all AJAX write paths, usage-count scanning across the site (`ATFRFO_Usage_Scanner`, `atfrfo_get_usage_counts` endpoint), categories/sub-categories, tints/shades/alpha generation, versioned backups, multi-project support, V3→V4 color migration.

**Candidate gaps** — not confirmed missing (no full UI audit has been done), flagged as worth verifying against the live UI:

1. **Cross-system usage visibility.** Once Classes ships, a variable's "usage" should include "referenced by class X's hover variant," not just widget-level scans. The current usage scanner almost certainly only sees widget-level references. Extend once the class-prop variable-reference question (§7.3) is resolved.
2. **Orphan/unused surfacing.** Usage-count data already exists. Whether the UI proactively flags zero-usage variables as cleanup candidates, versus requiring the user to check each one individually, needs verification — if not present, it's a small addition given the data is already computed. This is a genuinely different signal from item 3 below: zero usage means literally nothing references the variable, independent of its value — a legitimate default-on cleanup signal. Still, make it a settings toggle, off or on by preference, since not every workflow wants proactive flagging.
3. **Duplicate-value detection — opt-in only, never framed as a problem.** AFF's design philosophy is to create variables by *usage/purpose*, not by value — two variables named for two different roles that happen to resolve to the same value (e.g. two different grays that both land on `#e5e5e5`) are an intentional, wanted outcome, not a defect. If this feature exists at all, it must be a purely informational, opt-in grouping view ("variables sharing this value," for reference only) — never a "possible duplicates, consider consolidating" flag. Off by default; default framing must not treat duplicate values as a smell.
4. **Bulk operations.** The concrete gap: multi-select via standard OS conventions — Ctrl+click to toggle individual rows, Shift+click to select a contiguous range — then apply any operation (move to category, delete, bulk tag if that ever exists) to the whole selection at once. Likely the highest-value UX gap for anyone managing 50+ variables; needs verification against the live UI before scoping.
5. **Dependency-aware delete — high priority.** Whether deleting a variable warns when usage-count > 0 needs verification. This isn't really a "gap" so much as a near-bug: deleting something still in active use without warning is a real risk to a live site, not a nice-to-have. If missing, this should be prioritized well above the other items in this list.

None of these block Classes work. Item 1 specifically only becomes answerable once Classes ships.

---

## 3. Classes — What Elementor's Global Classes Are (confirmed from source)

**Source basis:** Direct inspection of the Elementor plugin source (site: `claude-wordpress-integration-novamira`), 2026-05-21.

Global Classes are Elementor V4's reusable CSS class system. Each class:

- Has a user-defined name (the `label` field) that becomes the literal CSS class name on the element — a class labelled `primary-btn` renders as `class="primary-btn"` in the HTML DOM.
- Contains one or more **variants** — each variant is a full CSS ruleset scoped to a specific breakpoint and/or pseudo-state (desktop/tablet/mobile × normal/hover/active/focus), not a handful of properties. The property schema (`modules/atomic-widgets/styles/style-schema.php`) covers 40+ property types across layout, typography, spacing, border, background, effects, and alignment. A class with 3 breakpoints × 2 states could carry 6 full variants — closer to a component stylesheet than a short property list.
- Is referenced from Elementor atomic widget elements by an opaque internal ID (`g-XXXXXXX` (7 hex chars — **note:** live-checked 2026-08-04 against the dev site and actual IDs look like `gc-0e2eff4039bbe56f`, a different prefix and length than documented here; re-verify the exact format before Phase 3.4 writes any ID)) rather than by label; the ID-to-label mapping happens during render via `Atomic_Global_Styles::transform_classes_names()`.
- Has a site-wide usage count accessible via a separate REST endpoint.

**Relationship to Variables:** each variant property value uses the same `$$type` value format Variables use (e.g. `{"$$type": "color", "value": "#ff0000"}`). Whether a property's `$$type` can instead be a *reference* to a global Variable's ID, rather than always a literal, is unconfirmed — see §7.3. This is the single fact that determines whether Classes and Variables converge into one linked system or remain structurally separate ones that happen to share a value-encoding format.

**CSS output:** rendered via `Atomic_Styles_Manager` during page render (inline style block or generated file), not the kit CSS file used for Variables. Selector uses `.elementor` as a prefix:

```css
.elementor .primary-btn { color: #ff0000; font-size: 16px; }
.elementor .primary-btn:hover { color: #cc0000; }
@media(max-width:1024px) { .elementor .primary-btn { font-size: 14px; } }
```
(Source: `modules/atomic-widgets/styles/styles-renderer.php`, lines 91-113.)

### 3.1 Storage Format

**Post meta keys** (`modules/global-classes/global-classes-repository.php`, lines 15-16), both on the active kit post — the same post AFF already reads for Variables:

```php
const META_KEY_FRONTEND = '_elementor_global_classes';
const META_KEY_PREVIEW  = '_elementor_global_classes_preview';
```

**Structure** — a PHP array with exactly two keys:

```json
{
  "items": {
    "g-19ae5e7": { "id": "g-19ae5e7", "type": "class", "label": "primary-btn", "variants": [ ... ] },
    "g-8e879b6": { "id": "g-8e879b6", "type": "class", "label": "hero-heading", "variants": [] }
  },
  "order": ["g-8e879b6", "g-19ae5e7"]
}
```
(Confirmed: `global-classes-repository.php` line 58.)

**Item fields**, validated by `Global_Classes_Parser::parse_items()`:

| Field | Type | Description |
|---|---|---|
| `id` | string | Opaque ID, `g-` prefix + 7 hex chars |
| `type` | `"class"` | Always `"class"` |
| `label` | string | The CSS class name; max 50 chars |
| `variants` | array | Per-breakpoint/state style objects; may be empty |
| `sync_to_v3` | bool (optional) | If true, class is synced to Elementor V3 typography globals (`design-system-sync/classes/classes-provider.php` line 39) |

**Variant structure** (`styles-renderer.php` lines 40-86; `classes-provider.php` lines 58-85):

```json
{
  "props": {
    "color": { "$$type": "color", "value": "#ff0000" },
    "font-size": { "$$type": "size", "value": { "size": 16, "unit": "px" } }
  },
  "meta": { "breakpoint": "mobile", "state": "hover" },
  "custom_css": { "raw": "" }
}
```

**REST API:** `wp-json/elementor/v1/global-classes`, GET/PUT. GET requires `is_user_logged_in()`; PUT requires `current_user_can('elementor_global_classes_update_class')` (administrator only by default, via `Add_Capabilities` migration). GET response wraps `items` as `data` and `order` as `meta.order` — a different shape than the stored meta. **Class limit: 100** (`global-classes-rest-api.php` line 18).

**Feature flag:** requires both `e_classes` and `e_atomic_elements` Elementor experiments active (`modules/global-classes/module.php` lines 41-43). If either is inactive, the REST endpoint doesn't exist and the infrastructure isn't registered. AFF must detect this and surface a clear message rather than reporting "no classes."

---

## 4. Classes — Data Model & Sync Architecture

### 4.1 Read Path

**Primary — direct post meta read** (faster and more reliable than an HTTP loopback):

```php
$kit_id = ATFRFO_CSS_Parser::get_active_kit_id();
$raw    = get_post_meta( $kit_id, '_elementor_global_classes', true );
```

The raw value is a JSON string; decode with `json_decode($raw, true)`. Do not use Elementor's own `get_json_meta()` — that requires Elementor's DI container fully initialized, which may not hold during an AJAX call outside the editor context.

**Fallback — REST API**, if post meta is empty or unavailable, via `wp_remote_get()` against `rest_url('elementor/v1/global-classes')` with a `wp_rest` nonce.

**Normalization** must handle both shapes: `$items = $raw['items'] ?? $raw['data'] ?? []; $order = $raw['order'] ?? $raw['meta']['order'] ?? [];`

**What AFF does not read:** variant CSS property values, in the initial phases. `variants` is stored as-is for potential future use; the list view only uses `count(variants) > 0` for a `has_styles` flag. Full variant parsing is deferred to Phase 3.5 (§6).

### 4.2 Write Path

AFF writes back to Elementor for exactly two operations:

1. **Sync** — read-only from Elementor's perspective; AFF fetches current state and updates its local store. No write to Elementor.
2. **Class creation / rename / delete** — via the REST PUT endpoint only. This is the only safe write path: it runs Elementor's own validation (`Global_Classes_Parser::parse_items()`) and resolver (`Global_Classes_Changes_Resolver`).

**AFF does not write CSS property values to Elementor in Phases 3.1-3.4.** Style editing stays in the Elementor editor for the initial release; see §6 (Phase 3.5) for the deliberately-deferred exception.

PUT body shape:
```json
{
  "context": "frontend",
  "changes": { "added": ["g-newid1"], "deleted": ["g-oldid1"], "modified": ["g-modid1"] },
  "items": { "g-newid1": { "id": "g-newid1", "type": "class", "label": "my-class", "variants": [] } },
  "order": ["g-newid1", "g-modid1"]
}
```
Items not listed in `changes` are preserved verbatim. New class IDs generated server-side: `'g-' . substr(bin2hex(random_bytes(4)), 0, 7)`. Duplicate labels get silently prefixed `DUP_` by Elementor with a `DUPLICATED_LABEL` response code (200, not an error) — AFF must detect and surface this.

### 4.3 AFF Class Object

```json
{
  "id": "uuid-v4",
  "elementor_id": "g-19ae5e7",
  "label": "primary-btn",
  "type": "global",
  "source": "elementor-fetched",
  "status": "synced",
  "group": "Classes",
  "category": "Buttons",
  "category_id": "uuid-of-aff-category",
  "order": 0,
  "has_styles": true,
  "notes": "",
  "created_at": "...", "updated_at": "...", "last_synced_at": "..."
}
```

- `elementor_id` is internal-only, used for REST calls back to Elementor.
- `label` is the single name field — both the literal CSS class name and what's shown to the user as "Name."
- `category`/`category_id` drive the grouping/tree display (§5.1); not an editable field in the UI itself.
- `notes` is the AFF-local free-text field, displayed to the user as "Comment."

`status` enum: `synced` | `modified` | `atfrfo-only` (present in AFF's file but deleted from Elementor) | `orphaned` (present in Elementor, not yet in AFF's file — auto-resolved to `synced` on sync). User-facing text: "Synced" / "Modified" / "AFF only" / "Orphaned" (§5.2).

Fields deliberately dropped from an earlier draft of this model: `has_responsive`, `states`, `breakpoints`, `usage_count` — these are derivable from `variants` on demand; storing them as separate scalars creates sync drift. `usage_count` comes from Elementor's separate `/usage` REST endpoint, fetched on demand, not stored.

**`.atfrfo.json` storage:** classes live in the top-level `classes` array; class categories live in `config.classCategories` — structurally parallel to `config.categories` / `fontCategories` / `numberCategories` for Variables.

| Aspect | Variables | Classes |
|---|---|---|
| Elementor storage | `_elementor_global_variables` meta key | `_elementor_global_classes` meta key |
| AFF read source | CSS file (primary) + post meta | Post meta (primary) + REST fallback |
| CSS output | `:root` custom properties | Per-class rule blocks (Atomic Styles pipeline) |
| AFF write back | REST + direct meta | REST PUT only (no direct meta write) |
| Category system | `config.categories` / `fontCategories` / `numberCategories` | `config.classCategories` |
| Value editing in AFF | Yes | No in Phases 3.1-3.4; see Phase 3.5 |

---

## 5. Classes — UI Design

### 5.1 Left Panel

The `▶ Classes` node already exists as a fixed item; implementation expands it to a category tree matching the Variables pattern exactly:

```
▼ Classes
    • Buttons       (3)
    • Typography    (7)
    • Layout        (2)
    • Uncategorized (1)  ← locked, always last
```

Same interaction rules as variable categories: click to load, keyboard nav, active highlight, count badges.

### 5.2 Edit Space — List View (default)

A dense table is the default and primary view. Drag handle and status dot share the leading edge as one compact unit — an 8px status dot immediately beside the 24px drag handle, hover tooltip showing the status name, no separate status column or line:

```
┌───────────────────────────────────────────────────────────────────┐
│ ≡● primary-btn        Buttons                        has styles [⋮] │
│ ≡● secondary-btn      Buttons                         no styles [⋮] │
│ ≡◐ hero-heading       Typography                      has styles [⋮] │
└───────────────────────────────────────────────────────────────────┘
```
(`≡` = drag handle, `●`/`◐` = status dot color, tooltip shows "Synced" / "AFF only" / "Modified" / "Orphaned.")

Columns: drag handle + status dot (leading edge, one unit), class name (monospace, read-only inline), category badge, styles indicator (`has_styles` derived), actions menu (edit comment, move category, rename → Elementor, delete → Elementor, open in Elementor).

No inline value editing, no value column, no property preview in the row itself. A future enhancement worth prototyping after the list view ships: a small swatch strip showing dominant colors from a class's variant props, without the layout cost of a full always-on card.

### 5.3 Detail Modal

Open question: whether a separate detail view is needed at all, or whether the list-view row plus inline editing covers everything. If one ships: Name (editable, writes through the Phase 3.4 rename operation since it changes the live class name in Elementor), styles-defined indicator, Comment (editable, AFF-local metadata), a link to open the class in the Elementor editor. Category and status are handled by the list view, not this screen.

### 5.4 Toolbar

Export, Import, Manage Project, History, Preferences, and Help are project-level and need no Classes-specific change. The Functions dropdown (numeric-variable calc mode) has no Classes equivalent.

Sync does need a Classes-specific path, separate from the existing Variables sync button. Variables' sync is built around parsing the kit CSS file, with a recovery flow for when that file can't be found (manual path entry). Classes reads via post meta with a REST fallback — a different mechanism with a different failure mode (the Elementor Global Classes feature flag being off), needing its own recovery message ("enable Global Classes in Elementor Settings → Features") rather than a file-path prompt. A "Sync Classes" button triggers `atfrfo_sync_classes`: fetch from Elementor → merge non-destructively with the existing AFF store (AFF-only metadata preserved) → mark classes missing from Elementor as `atfrfo-only` → mark classes newly found in Elementor as `orphaned`, auto-resolved to `synced` on the same sync → return updated list and counts.

### 5.5 Empty State

```
No Global Classes found in Elementor.
Create classes in the Elementor Class Manager, then sync here.
[Sync Classes]  [Open Elementor →]
```

### 5.6 Create New Class (Phase 3.4)

A "New Class" button opens a modal for the class name. On confirm: AFF generates a `g-XXXXXXX` (7 hex chars — **note:** live-checked 2026-08-04 against the dev site and actual IDs look like `gc-0e2eff4039bbe56f`, a different prefix and length than documented here; re-verify the exact format before Phase 3.4 writes any ID) ID, calls the REST PUT endpoint with `changes.added`, adds the new class to AFF's local store with `source: 'user-created'`, and directs the user to the Elementor editor to add styles. Name validation: alphanumeric/hyphen/underscore only, no leading digit, max 50 chars.

---

## 6. Classes — Implementation Plan & Phased Delivery

### 6.1 New PHP Files

**`includes/class-atfrfo-classes-reader.php`** — read-only, parallel to `ATFRFO_CSS_Parser`:
```php
class ATFRFO_Classes_Reader {
    public function read_from_postmeta(): array { ... }   // primary
    public function fetch_from_rest(): array { ... }       // fallback
    public function normalize( array $raw ): array { ... } // handles both shapes
    public function get_all(): array { ... }                // entry point
}
```

**`includes/class-atfrfo-classes-writer.php`** — REST PUT operations:
```php
class ATFRFO_Classes_Writer {
    public function create( string $label ): ?string { ... }
    public function rename( string $elementor_id, string $new_label ): bool { ... }
    public function delete( string $elementor_id ): bool { ... }
    private function put( array $payload ): array { ... }
    private function generate_elementor_id(): string { ... }
}
```
Each write method fetches the current full class list first, then constructs the `changes` + `items` + `order` payload — the PUT endpoint is a full-replace for touched items only. **Important:** when constructing the payload, merge AFF's changes onto the original Elementor item data rather than building items from scratch — this preserves fields AFF doesn't know about, notably `sync_to_v3` (§7.4).

### 6.2 Modifications to Existing PHP

- **`class-atfrfo-data-store.php`** — add `'Classes' => 'classCategories'` to `subgroup_to_cat_key()`; add `add_class()`, `update_class()`, `delete_class()`, `find_class_by_elementor_id()`, `import_fetched_classes()`; add `class_defaults()`; extend `migrate_data()` for backfill; add a `Classes` branch to `delete_category_for_subgroup()`.
- **`class-atfrfo-ajax-handler.php`** — register `atfrfo_sync_classes`, `atfrfo_get_classes`, `atfrfo_update_class_meta`, `atfrfo_move_class_category`, `atfrfo_create_class`, `atfrfo_rename_class`, `atfrfo_delete_class`, `atfrfo_save_class_category`, `atfrfo_delete_class_category`, `atfrfo_reorder_class_categories`. All call `verify_request()` and check `manage_options`, identical to existing handlers.
- **`class-atfrfo-loader.php`** — register the two new class files.

### 6.3 New JS/CSS

**`admin/js/atfrfo-classes.js`** — follows the `ATFRFO.Variables` factory pattern, simplified (no expand panel, no color picker, no inline value editing): `init()`, `loadClasses()`, `_renderView()`, `_renderClassRow()`, `_openDetailModal()`, `_syncClasses()`, `_createClass()`, `_renameClass()`, `_deleteClass()`. Reuses `ATFRFO.CatMixin` (category CRUD, free), `ATFRFO.VarDrag` (drag-reorder, works on `.atfrfo-color-row` elements which class rows also use), and `ATFRFO.Modal` (no new modal infrastructure needed).

**`admin/css/atfrfo-classes.css`** — row grid (handle+status as one leading unit, name, category badge, has-styles indicator, actions — no swatch/value columns), reuses `.atfrfo-color-row`, `.atfrfo-drag-handle`, `.atfrfo-status-dot` and existing status color tokens, `.atfrfo-category-block`, `.atfrfo-icon-btn` from the existing Variables CSS.

### 6.4 Phased Delivery

**Phase 3.1 — Foundation (data layer).** `atfrfo_sync_classes` works end-to-end: create the reader, extend the data store, add `atfrfo_sync_classes`/`atfrfo_get_classes` endpoints, register in the loader. Verification: call the AJAX action directly, inspect the response and the `.atfrfo.json` file. **No Elementor writes. Low risk.**

**Phase 3.2 — Left panel + list view.** Classes are navigable: `renderClassesTree()` in the left panel, `atfrfo-classes.js` with read-only rows, `atfrfo-classes.css`, wiring in `atfrfo-app.js`, enqueue in `class-atfrfo-admin.php`. Deliverable: category tree with counts, list view per category, working sync button, status badges. **No Elementor writes. Low risk.**

**Phase 3.3 — Detail modal + category management.** `_openDetailModal()`, comment/category editing, `atfrfo_update_class_meta` and the category-CRUD endpoints (reusing `ATFRFO.CatMixin` for zero new category-handling code). Deliverable: full metadata editing, category CRUD, drag-reorder within category. **No Elementor writes (AFF-side metadata only). Low risk.**

**Phase 3.4 — Elementor lifecycle writes.** The Classes Writer, `atfrfo_create_class`/`atfrfo_rename_class`/`atfrfo_delete_class`, UI flows for create/rename/delete. Deliverable: users can create empty classes, rename, and delete — all synced to Elementor via REST PUT. **Writes to Elementor. Medium risk — rename/delete are destructive and immediate on the live site; requires a confirmation modal with an explicit warning.**

**Phase 3.5 — Class style editing.** Editing class property values from within AFF, including assigning a global Variable into a property rather than a literal value — confirmed a real, commonly-used pattern (§7.3), including the "variable pass-through class" idiom: a class that exists purely to hold one variable reference, applied instead of setting the variable on each widget directly. Explicitly out of scope for 3.1-3.4. **High risk — a malformed write can visibly break live styling on every element using that class, sitewide, immediately**, a materially larger blast radius than anything in 3.1-3.4, needing its own preview/diff-before-commit UX. Also needs a maintenance plan for `style-schema.php` drift, since Elementor's atomic widgets are still actively evolving. Sequence after 3.1-3.4 ship and prove stable in production; do not fold into the first release, and do not scope it casually into a later point release without its own planning pass.

---

## 7. Classes — Open Questions

**7.1 (RESOLVED) Meta key names.** `_elementor_global_classes` (frontend), `_elementor_global_classes_preview` (editor preview). Source: `global-classes-repository.php` lines 15-16.

**7.2 (RESOLVED) Storage structure.** `{ items: { [g-id]: {...} }, order: [...] }`; REST wraps this as `{ data: ..., meta: { order: ... } }`. Source: `global-classes-repository.php` line 58, `global-classes-rest-api.php` lines 148-155.

**7.3 (RESOLVED — confirmed by direct usage) Can a class property value reference a global Variable?** Yes. This is a common, established Elementor idiom: rather than setting a variable directly on a widget property, a user creates a class whose property value points at the variable, then applies that class — future changes to the variable propagate everywhere the class is used, without touching individual widgets. Taken to its extreme, a class could exist for every single variable in the system as a reusable pass-through. This confirmation de-risks Phase 3.5 significantly — it moves from "foundational, unknown if even possible" to "the mechanism is proven, only the exact `$$type` wire format needs a quick check." **Remaining detail, not a blocker:** confirm the precise `$$type` shape for a variable-reference value (vs. a literal) by styling a class property with a Global Variable picker in the Elementor editor and inspecting the resulting `_elementor_global_classes` meta — a five-minute check during Phase 3.5 implementation, not a planning-stage gate.

**7.4 (RESOLVED) `sync_to_v3` field handling.** The `design-system-sync` module adds a `sync_to_v3` boolean to class items. AFF's writer must preserve this field verbatim when constructing PUT payloads — merge onto original item data, never rebuild items from scratch, or V3 sync breaks silently for users who have it enabled.

**7.5 (RESOLVED) Class limit.** 100 (`global-classes-rest-api.php` line 18; raised from an earlier Alpha limit of 50).

**7.6 (RESOLVED) REST authentication.** Standard `wp_rest` nonce for GET; custom capability `elementor_global_classes_update_class` for PUT (administrator only by default).

**7.7 (RESOLVED — verified 2026-08-04) Feature flag status on the dev site.** Confirmed active on `claude-wordpress-integration-novamira` — the REST route `/elementor/v1/global-classes` exists and 10 real classes were read back successfully. `ATFRFO_Classes_Reader::is_feature_available()` checks for this route directly, so AFF can always tell "feature disabled" apart from "zero classes" going forward, on any site.

**7.8 (RESOLVED — verified 2026-08-04) `get_post_meta()` raw value type.** Confirmed `string` — a JSON-encoded string, as expected, decoded correctly by the `is_string($raw)` branch. `ATFRFO_Classes_Reader::read_from_postmeta()` in Phase 3.1 handles this correctly as built.

**7.9 (RESOLVED) CSS selector prefix.** `Styles_Renderer` uses `.elementor` as a selector prefix — rendered output is `.elementor .primary-btn { ... }`, not bare. Informational only for Phases 3.1-3.3 (display-only, no CSS rendering by AFF).

**Verification note:** 7.7 and 7.8 can both be resolved in a single ~10-15 minute session against the development site before Phase 3.1 implementation begins.

---

## 8. Elementor's Likely Direction (flagged speculation)

Everything in this section is inference from confirmed facts about the current system, not documentation that has been read. Treat as a working hypothesis to revisit each time Elementor ships an update, not as fact.

- **Convergence toward a token-based design system.** Variables (tokens) + Classes (composable, variant-aware style rules referencing tokens) + Components (assembled, reusable widget groups) reads like a structure similar to Tailwind's design-token model or Figma variables/component sets — reusable primitives, composed upward. Confirmed by §7.3: variable-referencing classes are already a real, commonly-used pattern, not a hypothetical.
- **V3 is being sunset, not maintained in parallel indefinitely.** The `sync_to_v3` field reads as transitional scaffolding for users mid-migration, not a permanent dual-support commitment. This raises the priority of AFF being V4-native and correct now; V3 fallback paths already in AFF's Variables code are likely to matter less over time, not more.
- **Components will likely follow the same architectural pattern as Classes** — a dedicated post-meta key on the kit (or possibly a separate CPT, given components are "assembled" rather than a flat token list — worth checking early), a REST endpoint with its own capability gate, its own feature-flag experiment. When Elementor ships this, the same direct-source-inspection methodology used for Classes is the right approach to reuse, not a fresh guess from documentation.
- **The system is still conservative/defensive about stability.** A 100-item class limit, admin-only write capability, dual meta keys for frontend vs. preview state, and a still-gated experiment flag all suggest the current shape isn't considered final. AFF's Classes implementation should stay defensive to match — graceful degradation when the feature flag is off, no assumption that today's REST contract is permanent.

---

## 9. Roadmap Summary

| Phase | Scope | Elementor writes? | Risk | Depends on |
|---|---|---|---|---|
| 3.1 — Foundation | Sync classes into AFF's data store (read-only) | No | Low | Nothing new |
| 3.2 — List view + categories | Left-panel tree, list view, empty state | No | Low | 3.1 |
| 3.3 — Detail modal + metadata | Comment editing, category reassignment, category CRUD, drag-reorder | No (AFF-side only) | Low | 3.2 |
| 3.4 — Lifecycle writes | Create/rename/delete via REST PUT | Yes | Medium | 3.3 |
| 3.5 — Style editing | Edit property values, incl. variable references (confirmed real pattern, §7.3) | Yes | High | 3.4 stable in production |
| Ongoing | Variables gap-closing (§2) | Varies | Low | Independent, interleave anytime |
| Unscheduled | Components | TBD | Unknown | Elementor shipping a stable Components API; fresh source-inspection pass |

**First WordPress release: Phases 3.1 + 3.2 + 3.3.** No Elementor writes anywhere in this scope — sync, categorized list view, detail metadata, category CRUD, drag-reorder. Matches AFF's own established identity — readme.txt's FAQ already promises read-first, non-destructive behavior for Elementor CSS; 3.1-3.3 is that same promise applied to Classes. Phase 3.4 (the first phase with real Elementor writes) is deliberately held back from this release — proceed slow and careful once write operations are on the table.

---

## 10. Next Steps

1. Resolve open questions §7.3, §7.7, §7.8 in a single verification session against the development site (~10-15 minutes).
2. Build Phase 3.1 per §6.1/§6.2/§6.4 — data layer, no UI yet.
3. Build Phase 3.2 per §5.1/§5.2/§6.3/§6.4 — left panel, list view.
4. Build Phase 3.3 per §5.3/§6.2/§6.4 — detail modal, category CRUD, drag-reorder.
5. Ship first WordPress release at the end of 3.3.
6. Stop and reassess before starting Phase 3.4 — first phase with real Elementor writes. Go slow and careful from here.
7. Retire `docs/CLASSES-PLAN.md` once this document has been reviewed and confirmed as the sole source of truth for Classes planning.
