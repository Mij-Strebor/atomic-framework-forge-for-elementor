# EFF Spec Addition — Design System Sync Module
> Insert this content into the main EFF Claude Code Build Description.
> **Section placement guide is noted at each block.**

---

## INSERT INTO: Section 4.2 — Top Menu Bar (Right Side additions)

Add the following rows to the right side of the top menu bar table:

| Icon | Tooltip | Action |
|------|---------|--------|
| Sync (⟳) | Sync Design System | Opens the Sync Modal (see Section X — Sync Modal) |

---

## INSERT INTO: Section 10 — Modal Dialog System (Defined Modals table)

Add the following row:

| Modal | Trigger | Contents |
|-------|---------|----------|
| Sync | Sync icon (top bar) | Export name field, exclude-deleted toggle, export/backup/import controls, merge-mode toggle, status messages |

---

## NEW SECTION: Design System Sync Module

> **Insert as a new numbered section after the current CSS Parsing Module section.**

---

### X.1 Overview

The Design System Sync Module gives EFF the ability to export, back up, and import Elementor v4 global variables and global classes between WordPress sites. It is the portable bridge for the EFF-managed design system.

This module is implemented as a PHP class (`class-eff-sync.php`) that is instantiated only within the WordPress admin context. Its UI surfaces in two places:

1. A **Sync icon (⟳)** in the EFF top menu bar that opens the Sync Modal
2. The **Sync Modal** itself, which contains all export, backup, and import controls

The underlying data format is a versioned JSON envelope. The current format ID is `eff_design_system_v1`. This ID must be incremented (e.g., `v2`) whenever a breaking change is made to the payload structure.

---

### X.2 File Structure Additions

The following files are added to the EFF plugin structure:

```
elementor-framework-forge/
├── includes/
│   └── class-eff-sync.php          # All sync logic: export, backup, import, merge
├── admin/
│   ├── views/
│   │   └── modal-eff-sync.php      # Sync modal HTML template
│   └── js/
│       └── eff-sync.js             # Sync modal open/close, AJAX triggers, status display
```

**Additions to existing files:**

| File | Change |
|------|--------|
| `class-eff-loader.php` | Instantiate `EFF_Sync` inside the admin guard |
| `eff-app.js` | Register Sync icon click handler → open sync modal |
| `eff-modal.js` | No changes needed; reuse existing modal open/close system |

---

### X.3 PHP Class: `class-eff-sync.php`

**Class name:** `EFF_Sync`  
**Prefix convention:** All constants, actions, and option keys use `eff_sync_` prefix.  
**Instantiated:** Inside `is_admin()` only, from `class-eff-loader.php`.

#### Constants

```php
const CAP           = 'manage_options';        // Required capability
const NONCE_ACTION  = 'eff_sync_nonce';        // Nonce action string
const ACTION_EXPORT = 'eff_sync_export';       // admin-post action: export
const ACTION_BACKUP = 'eff_sync_backup';       // admin-post action: backup
const ACTION_IMPORT = 'eff_sync_import';       // admin-post action: import
const FORMAT_ID     = 'eff_design_system_v1';  // Payload format identifier
const MAX_UPLOAD    = 5_000_000;               // 5MB upload ceiling
```

#### Constructor Hook Registrations

```php
add_action('admin_post_' . self::ACTION_EXPORT, [$this, 'handle_export']);
add_action('admin_post_' . self::ACTION_BACKUP, [$this, 'handle_backup']);
add_action('admin_post_' . self::ACTION_IMPORT, [$this, 'handle_import']);
add_action('wp_ajax_eff_sync_get_nonce',         [$this, 'ajax_get_nonce']);
```

> **Note:** The nonce AJAX endpoint (`eff_sync_get_nonce`) allows `eff-sync.js` to retrieve a fresh nonce when the modal opens without a full page reload.

---

#### Method: `get_active_kit_id(): int`

Retrieves the active Elementor Kit post ID.

1. Read `get_option('elementor_active_kit')` and cast to `int`.
2. If result is `<= 0`, run a `WP_Query` for a published post in `elementor_library` with taxonomy term `kit` as a fallback.
3. Return the kit ID (or `0` if not found).

This method is called by `build_payload()`, `handle_import()`, and the modal page render.

---

#### Method: `build_payload(int $kit_id, string $export_name, bool $exclude_deleted): array`

Assembles the exportable JSON payload.

1. Read `_elementor_global_variables` and `_elementor_global_classes` from post meta on `$kit_id`.
2. Pass both through `maybe_decode_json()` to normalize array-or-string storage.
3. If `$exclude_deleted` is true, pass variables through `strip_deleted_variables()`.
4. Normalize classes: ensure `items` and `order` keys exist as arrays.
5. Return structured array:

```php
[
    'meta' => [
        'exported_at_utc' => gmdate('c'),
        'site_url'        => home_url(),
        'kit_id'          => $kit_id,
        'export_name'     => $export_name,
        'format'          => self::FORMAT_ID,
    ],
    'data' => [
        '_elementor_global_variables' => $vars,
        '_elementor_global_classes'   => $classes,
    ],
]
```

---

#### Method: `handle_export()`

Triggered by `admin_post_eff_sync_export`.

1. Call `require_admin_and_nonce()`.
2. Get active kit ID; die with message if not found.
3. Sanitize `$_POST['export_name']` via `sanitize_export_name()`.
4. Read `$_POST['exclude_deleted']` flag.
5. Call `build_payload()`.
6. Generate filename: `{slug}-{Ymd-His}.json`
7. Call `download_json()`.

---

#### Method: `handle_backup()`

Identical to `handle_export()` except the filename is prefixed with `Backup_`:

```
Backup_{slug}_{Ymd-His}.json
```

This provides a clear visual distinction between routine exports and pre-import backups.

---

#### Method: `handle_import()`

Triggered by `admin_post_eff_sync_import`.

**Validation chain — redirect to fail on any failure:**

1. `require_admin_and_nonce()`
2. Get active kit ID — fail if not found
3. Check `$_FILES['eff_sync_file']['tmp_name']` is not empty
4. Validate file size: `> 0` and `<= self::MAX_UPLOAD`
5. `file_get_contents()` the temp file
6. `json_decode()` — must produce an array
7. Check `$payload['meta']['format']` equals `self::FORMAT_ID`
8. Check `$payload['data']` exists and is an array
9. Extract and normalize `_elementor_global_variables` and `_elementor_global_classes` via `maybe_decode_json()`
10. Both must be arrays after normalization

**Write logic:**

- If `$_POST['merge_mode']` is set:
  - Read current variables and classes from post meta
  - Call `merge_variables()` and `merge_classes()`
  - Write merged results via `update_post_meta()`
- If not merge mode:
  - Write incoming directly via `update_post_meta()`

**Post-write:**

- Call `clear_elementor_cache_best_effort()`
- Redirect back to EFF admin page with `?eff_sync=ok`

---

#### Method: `merge_variables(array $current, array $incoming): array`

Merges variable datasets. **Incoming wins on ID collision.**

```php
$merged_data = array_merge($current['data'] ?? [], $incoming['data'] ?? []);
return [
    'version' => $incoming['version'] ?? ($current['version'] ?? null),
    'data'    => $merged_data,
];
```

Variable IDs follow the Elementor pattern `e-gv-{hash}`. Since `array_merge` with string keys gives the last-occurrence value, incoming keys overwrite current keys of the same ID.

---

#### Method: `merge_classes(array $current, array $incoming): array`

Merges class datasets. **Incoming wins on item key collision.**

1. Merge `items` arrays — incoming wins.
2. Merge `order` arrays — deduplicate, preserve order (current order first, then incoming additions).
3. Ensure every key in `items` appears in `order` (append any orphans).

```php
return [
    'version' => $incoming['version'] ?? ($current['version'] ?? null),
    'items'   => array_merge($current_items, $incoming_items),
    'order'   => $merged_order,  // deduplicated, complete
];
```

---

#### Method: `maybe_decode_json($value)`

Normalizes Elementor's dual storage format (array or JSON string).

- If already an array: return as-is.
- If empty string or non-string: return as-is.
- If string starts with `{` or `[`: attempt `json_decode()`.
- Return decoded array on success, original value on failure.

---

#### Method: `strip_deleted_variables(array $vars): array`

Filters out soft-deleted variables from the export payload.

- Expects structure: `['version' => ..., 'data' => ['e-gv-...' => ['deleted_at' => ..., ...], ...]]`
- Iterates `$vars['data']`; removes any entry where `deleted_at` is non-empty.
- Returns the filtered `$vars` array (structure preserved).

---

#### Method: `sanitize_export_name(string $name): string`

Produces a clean, human-readable export name safe for display and filename generation.

1. Trim whitespace.
2. Default to `'EFF Design System'` if empty.
3. `wp_strip_all_tags()`
4. Collapse multiple spaces to single space.
5. Strip non-alphanumeric characters except spaces, hyphens, underscores.
6. Truncate to 80 characters.

---

#### Method: `filename_slug(string $name): string`

Converts a sanitized export name to a filesystem-safe slug.

1. Lowercase.
2. Replace non-alphanumeric runs with `-`.
3. Trim leading/trailing hyphens.
4. Default to `'eff-design-system'` if empty.

---

#### Method: `download_json(array $payload, string $filename)`

Streams JSON to the browser as a file download.

1. Encode with `wp_json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES)`.
2. Die with message if encoding fails.
3. Send `nocache_headers()`.
4. Send `Content-Type: application/json; charset=utf-8`.
5. Send `Content-Disposition: attachment; filename="{filename}"`.
6. Echo JSON, then `exit`.

---

#### Method: `clear_elementor_cache_best_effort()`

Best-effort cache flush post-import. Wrapped entirely in `try/catch(\Throwable)` — never throws.

1. If `\Elementor\Plugin` class exists:
   - Call `files_manager->clear_cache()` if available.
   - Call `cache_manager->clear_cache()` if available.
2. Call `wp_cache_flush()` if function exists.

> **UX Note:** After import, EFF displays a persistent notice: *"Import complete. For full effect, go to Elementor → Editor → Tools and click Regenerate CSS & Data."* The cache clear is best-effort only; the manual step is always required.

---

#### Method: `require_admin_and_nonce()`

Called at the top of every `handle_*` method.

1. `current_user_can(self::CAP)` — die with message if false.
2. `check_admin_referer(self::NONCE_ACTION)` — WordPress handles die on failure.

---

#### Method: `redirect_fail()`

Redirects back to EFF admin page with failure flag.

```php
wp_safe_redirect(add_query_arg([
    'page'     => 'elementor-framework-forge',
    'eff_sync' => 'fail',
], admin_url('admin.php')));
exit;
```

---

#### Method: `ajax_get_nonce()`

AJAX endpoint so `eff-sync.js` can retrieve a fresh nonce on modal open.

```php
if (!current_user_can(self::CAP)) wp_die(-1);
wp_send_json_success(['nonce' => wp_create_nonce(self::NONCE_ACTION)]);
```

---

### X.4 Modal Template: `modal-eff-sync.php`

Rendered inside the EFF admin page when the Sync modal is open. Uses the standard EFF modal pattern from Section 10.

**Modal regions:**

#### Status Bar (top of modal)
Displays context information:
- Active Kit ID (or warning if not found)
- Post-import success/failure notice (driven by `?eff_sync` query arg)
- Post-import reminder: *"Regenerate CSS & Data required."*

#### Export Section
- Heading: `Export (Variables + Classes)`
- `export_name` text input (420px, pre-filled with current project name from EFF data store)
- Checkbox: `exclude_deleted` — *Exclude variables marked as deleted* (checked by default)
- Button: `Download Design System JSON` (primary EFF button style)
- Form posts to `admin-post.php` with `action = eff_sync_export`

#### Backup Section
- Heading: `Backup (recommended before import)`
- Description: *Downloads current Variables + Classes as `Backup_{name}_{timestamp}.json`. Not stored in the database.*
- Same `export_name` field and `exclude_deleted` checkbox
- Button: `Download Backup Now` (secondary EFF button style)
- Form posts to `admin-post.php` with `action = eff_sync_backup`

#### Import Section
- Heading: `Import (Variables + Classes)`
- Description: *Uploads a JSON export from another site. Writes into the active Elementor Kit on this site.*
- File input: `accept="application/json"`, required
- Checkbox: `merge_mode` — *Merge with existing (otherwise overwrite)* (unchecked by default)
- Notice block: *"After import: Elementor → Editor → Tools → Regenerate CSS & Data"*
- Button: `Import Design System JSON` (primary EFF button style)
- Form posts to `admin-post.php` with `action = eff_sync_import`, `enctype="multipart/form-data"`

**All forms include:**
- `_wpnonce` hidden field
- `action` hidden field matching the appropriate constant

---

### X.5 JavaScript: `eff-sync.js`

Handles the sync modal lifecycle within the EFF single-page admin panel.

#### Responsibilities

| Function | Description |
|----------|-------------|
| `openSyncModal()` | Fetches fresh nonce via `eff_sync_get_nonce` AJAX, injects into all three form nonce fields, calls EFF modal open system |
| `closeSyncModal()` | Delegates to `eff-modal.js` close handler |
| `bindSyncIcon()` | Attaches click handler to the Sync top bar icon on DOM ready |
| `checkSyncStatus()` | On modal open, reads `?eff_sync` query arg and displays success/fail notice inside the modal status bar |

#### Event Flow

1. User clicks Sync icon (⟳) in top bar.
2. `openSyncModal()` fires.
3. AJAX call to `eff_sync_get_nonce` retrieves a fresh nonce.
4. Nonce injected into all three `_wpnonce` hidden fields in the modal.
5. Modal opens via `eff-modal.js`.
6. `checkSyncStatus()` reads URL params and displays any pending notice.
7. User interacts with export/backup/import forms — these are standard HTML form submissions (not AJAX), causing full-page navigation to `admin-post.php` and redirect back.
8. On redirect return, modal re-opens automatically if `?eff_sync` param is present.

> **Design note:** Export and backup are intentionally standard form POSTs (not AJAX) because they trigger file downloads. Import is also a standard form POST because it involves `multipart/form-data` file upload. Only the nonce fetch uses AJAX.

---

### X.6 Security Model

| Threat | Mitigation |
|--------|------------|
| Unauthorized access | `current_user_can('manage_options')` on every handler |
| CSRF | `check_admin_referer()` with `eff_sync_nonce` on every handler |
| Malicious upload | Size limit (5MB), JSON parse validation, format ID check |
| XSS in export name | `wp_strip_all_tags()`, regex sanitization, `esc_attr()` in output |
| Redirect manipulation | `wp_safe_redirect()` only — never raw `header()` |
| Cache state corruption | Best-effort cache clear + manual Regenerate reminder |

---

### X.7 Format Versioning Policy

The `FORMAT_ID` constant (`eff_design_system_v1`) is the contract between exporting and importing sites.

Rules:
- Increment to `v2`, `v3`, etc. on any breaking structural change to the payload.
- Always maintain backward compat for at least one prior version (check both in `handle_import()`).
- The format ID lives only in `class-eff-sync.php` — do not reference it from JS or templates directly.

---

### X.8 Post-Import UX Requirements

After a successful import, EFF must:

1. Display a `notice-success` styled message inside the Sync modal status bar.
2. Display a persistent reminder banner: *"Import complete — Regenerate CSS & Data required in Elementor."*
3. The reminder banner must remain visible until dismissed or until the user navigates away.
4. The EFF data store should be refreshed (re-read from post meta) so variable/class counts in the right status panel reflect the newly imported data.

---

### X.9 Future Considerations (v2+)

- **Conflict UI:** Surface variable/class ID collisions to the user before committing the import, with per-item keep/overwrite choice.
- **Scheduled backups:** Auto-backup on a WP-Cron schedule to the uploads directory.
- **Remote sync:** Direct site-to-site transfer via REST API (authenticated).
- **Partial export:** Allow the user to select specific variable subgroups or classes for export rather than always exporting the full dataset.
- **Audit log:** Record every import event (timestamp, source site URL, item counts) in a lightweight DB log table.
