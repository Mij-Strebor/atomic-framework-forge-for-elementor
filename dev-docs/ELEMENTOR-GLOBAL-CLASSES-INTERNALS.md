# Elementor Global Classes — Internals Reference

**Source:** Extracted 2026-08-13 from two superseded `master`-branch planning docs
(`docs/CLASSES-PLAN.md` v2.0, 2026-05-21, and `docs/PHASE3-CLASSES-PLAN.md`, 2026-06-14 —
both now deleted) during a documentation reorganization. Both docs were built from direct
inspection of Elementor's own source (local install, confirmed against v4.1.3) — this is
Elementor's own architecture, not AFF's implementation plan, and much of it remains true
regardless of what AFF actually built. **AFF's actual shipped implementation is documented
in `dev-docs/AFF-VISION-AND-ROADMAP.md` (develop branch) and `docs/user-manual.md` §22 —
where those diverge from what's below, trust the shipped docs, not this file.**

Known confirmed divergences between these plans and what shipped:
- Both plans proposed reading via raw kit postmeta (`_elementor_global_classes`) with a
  REST fallback. **This was later confirmed actively wrong** — the C-08 incident
  (`dev-docs/TECH-DEBT.md`) found that meta key stale/legacy on Elementor 4.2.1+, silently
  returning 10 items on a site with 54 real classes. The shipped reader calls
  `Global_Classes_Repository` directly, matching what the *later* of the two plans
  (PHASE3-CLASSES-PLAN.md §8.1) had already corrected to — the earlier plan's read-path
  guidance was wrong even at the time.
- Both plans included a class-creation feature and/or a CSS-editing mode ("Mode A: Raw CSS
  Editor"). **Both are explicitly out of scope in what shipped** (decided 2026-08-08, see
  CHANGELOG.md) — AFF's Classes feature is sync/organize/rename/delete/read-only-detail
  only, more conservative than either plan proposed.
- Both plans assumed a dedicated "Sync Classes" UI control. Shipped: Classes sync silently
  piggybacks on the Variables Sync modal's V4+Import action — no separate control exists.
- PHASE3-CLASSES-PLAN.md assumed single-level categories only. Shipped: full sub-category
  support, matching Variables.

---

## 1. Storage Model (Elementor 4.1.0+)

Each global class is **its own WordPress post**, post type `e_global_class` — not a single
kit-meta blob. The kit post holds only the index.

**Pre-4.1.0 sites** stored classes as a single JSON blob in kit meta
`_elementor_global_classes`. Version is tracked in the WP option
`elementor_global_classes_db_version` (current = 3 as of this research). A real migration
path exists (`database/migrations/migrate-to-posts.php` = DB v2, moved blob → CPT;
`reconcile-downgraded-posts.php` = DB v3, handles upgrade/downgrade drift).

**Per-class post meta:**

| Meta key | Content |
|---|---|
| `_elementor_global_class_id` | The `g-XXXXXXX` string ID |
| `_elementor_global_class_data` | `{type, variants, sync_to_v3?}` — published/frontend state |
| `_elementor_global_class_data_preview` | Same shape — draft/editor state |
| `_elementor_version` | Elementor version at last save |
| `_elementor_global_class_edited` | Unix timestamp of last edit |

**Kit post meta (index layer, on the active kit):**

| Meta key | Content |
|---|---|
| `_elementor_global_classes_order` | `{order: ['g-xxx', 'g-yyy', …]}` |
| `_elementor_global_classes_labels` | `{g-xxx: 'Label', …}` |
| `_elementor_global_classes_post_ids` | `{g-xxx: 1234, …}` — class ID → WP post ID |
| `_elementor_global_classes_sync_to_v3` | `{g-xxx: true, …}` |
| `..._preview` variants | Same four keys, suffixed `_preview`, for editor draft state |

## 2. Class Object Structure

```json
{
  "id": "g-8091449",
  "label": "Primary Button",
  "type": "class",
  "variants": [
    {
      "meta": { "breakpoint": "desktop", "state": null },
      "props": { "font-size": {"$$type":"size","value":{"size":16,"unit":"px"}} },
      "custom_css": { "raw": "<escaped CSS string>" }
    }
  ],
  "sync_to_v3": false
}
```

- **Class IDs:** `g-` prefix + random suffix (e.g. `g-8091449`), **client-generated** — the
  server stores whatever ID it receives, does not mint them, but does enforce uniqueness.
  Used as the literal CSS selector: `.elementor .g-8091449 { … }`.
- **Label rules:** 2–50 chars, `[a-zA-Z0-9_-]` only, no spaces, cannot start with a digit or
  `--`, `container` is reserved. Duplicate labels are auto-renamed by Elementor with a
  `DUP_` prefix — not an error response, still 200 OK.

### Breakpoints (`core/breakpoints/manager.php`)

| Slug | Notes |
|---|---|
| `desktop` | Base — no media query wrapper emitted. **A string, not `null`.** |
| `tablet`, `mobile` | Always enabled |
| `laptop`, `tablet_extra`, `mobile_extra`, `widescreen` | Optional — user-enabled in Elementor settings |

Breakpoint slugs are **not server-validated** against the registered set (Elementor's own
TODO, ticket EDS-528, as of this research) — a bogus slug is stored silently and simply
never renders.

### States (`modules/atomic-widgets/styles/style-states.php`)

| Value | Renders as |
|---|---|
| `null` | (no suffix — normal/default) |
| `"hover"` | `:hover` (also auto-pairs with `focus-visible`) |
| `"active"` | `:active` |
| `"focus"` | `:focus` |
| `"focus-visible"` | `:focus-visible` |
| `"checked"` | `:checked` |
| `"e--selected"` | `.e--selected` — a class, not a pseudo-selector |

## 3. Props Are Typed Objects, Not CSS Strings

The single most important architectural fact: `props` values are never raw CSS strings —
each is a typed object from Elementor's atomic prop-type system (`$$type`/`value` shape,
validated server-side against `style-schema.php` via `Props_Parser`; unknown/malformed
props are dropped silently or rejected). This is the same `$$type`-tagged shape AFF's own
Classes detail card decodes (see `class-atfrfo-classes-reader.php`).

Separately, each variant may also carry `custom_css: { raw: "<CSS>" }` — arbitrary CSS
declarations, sanitized with `sanitize_textarea_field()`, encoded with Elementor's
`Utils::encode_string()`/`decode_string()`. Not validated against the schema. `props` and
`custom_css` can coexist on the same variant; a correct implementation preserves both
verbatim on any round-trip and never regenerates `props` from scratch.

## 4. Read Path (verified correct — matches what shipped)

```php
use Elementor\Modules\GlobalClasses\Global_Classes_Repository;

$kit    = \Elementor\Plugin::$instance->kits_manager->get_active_kit();
$repo   = Global_Classes_Repository::make( $kit );
$labels = $repo->all_labels();                          // lightweight: id => label
$items  = $repo->get_by_ids( array_keys( $labels ) );    // full data for all classes
```

**Never call `$repo->all()`** — flagged directly in Elementor's own source as too heavy,
may cause the server to freeze on a large class count. Always use `all_labels()` +
`get_by_ids()` instead.

## 5. Write Path

`Global_Classes_Repository::put( $items_array, $order_array )` — handles CPT create/
update/delete, updates all kit-meta index keys (order, labels, post-ID map, sync-to-v3
map), fires `elementor/global_classes/update` and cleanup actions, clears preview meta to
keep the editor in sync. This is the only safe write path — never create `e_global_class`
posts directly; the post-ID map can drift if a class post is created by bypassing the
repository (it self-heals by re-querying and pruning duplicates, but don't rely on that).

**Required capability:** `elementor_global_classes_update_class` — granted to the
`administrator` role only by Elementor's own migration. A user with `manage_options` but a
lower-privileged role may still lack it; check explicitly rather than assuming
`manage_options` is sufficient.

## 6. REST API (for reference — AFF does not use this; reads/writes go in-process)

**Endpoint:** `wp-json/elementor/v1/global-classes` — GET (`is_user_logged_in()`), PUT
(`elementor_global_classes_update_class` capability). GET response shape wraps the
storage shape: `{ data: {...items}, meta: { order: [...] } }` — note this differs from the
raw stored/repository shape (`items`/`order` at the top level), so any code handling both
sources must normalize both shapes. **Class limit:** server constant `MAX_ITEMS = 100`
(REST layer); community reports suggest the Elementor editor itself enforces a limit
around 100 despite a much higher server constant elsewhere (reported ~1000) — treat 100 as
the practical ceiling to warn users about.

## 7. Feature Flags

Global Classes require **two** Elementor experiments active simultaneously:
`e_classes` and `e_atomic_elements` (Atomic Widgets). If either is inactive, no Global
Classes infrastructure registers at all and the REST endpoint won't exist. A repository
read against a site with the experiments off returns empty — indistinguishable from
"no classes created yet" without a separate experiment-status check.

## 8. Other Known Risks (Elementor-side, not AFF-side)

- **Preview vs. frontend duality:** every store has a `_preview` twin; the Elementor editor
  reads/writes preview context. Code operating in frontend context (like AFF) may see
  stale data reflected if the Elementor editor is open concurrently with a write.
- **`custom_css.raw` encoding:** Elementor encodes with `Utils::encode_string()` before
  storage, decodes with `Utils::decode_string()` on read — any code touching this field
  directly must use the same utility, not assume plain text round-trips safely.

## Appendix — Key Elementor Source Files (as inspected, v4.1.3)

```
modules/global-classes/
  global-classes-rest-api.php          # REST routes
  global-classes-repository.php        # USE THIS for read/write — the safe API surface
  global-class-post.php                # CPT post wrapper
  global-class-post-type.php           # CPT registration (post type 'e_global_class')
  global-classes-order.php             # Order kit-meta wrapper
  global-classes-labels.php            # Labels kit-meta wrapper
  global-classes-post-ids.php          # Post-ID map wrapper (self-heals, prunes duplicates)
  global-classes-parser.php            # Validation for incoming class data
  database/
    global-classes-database-updater.php
    migrations/migrate-to-posts.php    # DB v2 — moved kit-meta blob to CPT
    migrations/reconcile-downgraded-posts.php  # DB v3 — upgrade/downgrade drift
    migrations/add-capabilities.php    # Grants elementor_global_classes_* caps

modules/atomic-widgets/
  parsers/style-parser.php             # Validates variants and props against schema
  styles/style-schema.php              # Canonical prop schema (what goes in props{})
  styles/style-states.php              # Valid state slugs
  styles/styles-renderer.php           # Emits final CSS

core/breakpoints/manager.php           # Breakpoint slugs and enabled-set resolution
```

Re-verify all of the above against current Elementor source before relying on it for new
work — this was accurate as of v4.1.3; AFF's shipped Classes feature is confirmed running
against v4.2.1+, and Elementor's internals may have moved further since either research
pass.
