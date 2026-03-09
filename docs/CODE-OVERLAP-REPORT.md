# EFF PHP Code Overlap Report
**Generated:** 2026-03-09
**Plugin:** Elementor Framework Forge (EFF) v1.0.0
**Scope:** All PHP source files

---

## Files Scanned

| File | Role |
|------|------|
| `elementor-framework-forge.php` | Bootstrap / constants |
| `includes/class-eff-admin.php` | Asset enqueue, menu, UI |
| `includes/class-eff-ajax-handler.php` | All AJAX endpoints |
| `includes/class-eff-css-parser.php` | Elementor CSS parsing |
| `includes/class-eff-data-store.php` | File I/O, data manipulation |
| `includes/class-eff-loader.php` | Hook registration |
| `includes/class-eff-settings.php` | Developer settings |
| `includes/class-eff-usage-scanner.php` | Usage analysis |
| `admin/views/page-eff-main.php` | Admin page template |

---

## Issues by Severity

---

### HIGH — Duplicate `NONCE_ACTION` Constant

**Files:**
- `includes/class-eff-admin.php` line 18
- `includes/class-eff-ajax-handler.php` line 17

**Code:**
```php
// EFF_Admin:
const NONCE_ACTION = 'eff_admin_nonce';

// EFF_Ajax_Handler:
const NONCE_ACTION = 'eff_admin_nonce';
```

Both classes define the identical string. If the nonce action ever changes it must be updated in two places. A mismatch between the two would silently break all AJAX security checks.

**Fix:** Define once in the bootstrap file as a plugin-level constant:
```php
// elementor-framework-forge.php
define( 'EFF_NONCE_ACTION', 'eff_admin_nonce' );
```
Remove the class-level constants and reference `EFF_NONCE_ACTION` everywhere.

---

### MEDIUM — Duplicate Active Kit ID Retrieval

**Files:**
- `includes/class-eff-css-parser.php` lines 177–182 — private method `get_active_kit_id()`
- `includes/class-eff-ajax-handler.php` lines 134–136 — inline inside `ajax_eff_sync_from_elementor()`

**Code:**
```php
// EFF_CSS_Parser::get_active_kit_id()
$kit_id = (int) get_option( 'elementor_active_kit', 0 );
return $kit_id > 0 ? $kit_id : null;

// EFF_Ajax_Handler::ajax_eff_sync_from_elementor() — inline duplicate
$kit_id = (int) get_option( 'elementor_active_kit', 0 );
```

The AJAX handler re-implements the same lookup that already exists in the parser.

**Fix:** Expose `get_active_kit_id()` as `public static` in `EFF_CSS_Parser`, then call it from the AJAX handler:
```php
$kit_id = EFF_CSS_Parser::get_active_kit_id();
```

---

### MEDIUM — JSON Decode + Error Check Repeated 10+ Times

**File:** `includes/class-eff-ajax-handler.php` — throughout

**Pattern (repeated in every endpoint that receives JSON):**
```php
$data = json_decode( $data_raw, true );
if ( JSON_ERROR_NONE !== json_last_error() ) {
    wp_send_json_error( array( 'message' => __( 'Invalid ... format.', 'elementor-framework-forge' ) ) );
}
```

**Fix:** Add a private helper and call it in each endpoint:
```php
private function safe_json_decode( string $json, string $error_msg = '' ): array {
    $decoded = json_decode( $json, true );
    if ( JSON_ERROR_NONE !== json_last_error() ) {
        $msg = $error_msg ?: __( 'Invalid data format.', 'elementor-framework-forge' );
        wp_send_json_error( array( 'message' => $msg ) );
        exit; // wp_send_json_error does not exit automatically in all contexts
    }
    return $decoded;
}
```

---

### MEDIUM — POST Parameter Extraction Repeated 20+ Times

**File:** `includes/class-eff-ajax-handler.php` — throughout

**Pattern:**
```php
$filename = isset( $_POST['filename'] )
    ? sanitize_text_field( wp_unslash( $_POST['filename'] ) )
    : '';
```

This three-line block appears in nearly every AJAX endpoint, with only the key and default value changing.

**Fix:** Add a private helper:
```php
private function post_param( string $key, string $default = '', callable $sanitizer = null ): string {
    if ( ! isset( $_POST[ $key ] ) ) {
        return $default;
    }
    $value = wp_unslash( $_POST[ $key ] );
    $fn    = $sanitizer ?? 'sanitize_text_field';
    return $fn( $value );
}
```
Usage: `$filename = $this->post_param( 'filename' );`

---

### LOW — CSS Variable Name Regex Repeated 3+ Times

**File:** `includes/class-eff-ajax-handler.php`

**Locations (approximate):**
- `ajax_eff_save_baseline()` — CSS var name check
- `ajax_eff_save_color()` — CSS var name check
- `ajax_eff_commit_to_elementor()` — CSS var name check

**Pattern:**
```php
! preg_match( '/^--[\w-]+$/', $name )
```

**Fix:** Define as a class constant and wrap in a validation method:
```php
private const CSS_VAR_PATTERN = '/^--[\w-]+$/';

private function is_valid_css_var( string $name ): bool {
    return (bool) preg_match( self::CSS_VAR_PATTERN, $name );
}
```

---

### LOW — Category Name Validation Duplicated Within Same Method

**File:** `includes/class-eff-ajax-handler.php` — `ajax_eff_save_category()`

The name extraction and empty-check appear in both the "update" and "add" branches of the same if/else, with identical code.

**Fix:** Move the validation above the branch:
```php
$name = isset( $category['name'] ) ? sanitize_text_field( $category['name'] ) : '';
if ( empty( $name ) ) {
    wp_send_json_error( array( 'message' => __( 'Category name is required.', 'elementor-framework-forge' ) ) );
}

if ( ! empty( $category['id'] ) ) {
    // update using $name
} else {
    // add using $name
}
```

---

### LOW — File Existence/Readability Check Pattern in Two Classes

**Files:**
- `includes/class-eff-css-parser.php` lines 111–118
- `includes/class-eff-data-store.php` lines 66–73

Both use the same `file_exists() + is_readable() + file_get_contents() + false check` sequence. The return types differ (empty array vs. false), so no immediate consolidation is needed, but a shared utility would help if more file I/O classes are added.

**Recommendation:** Acceptable as-is for v1.0. Revisit in Phase 3 if a third class adds the same pattern.

---

### LOW — `USER_META_THEME` Tight Coupling

**Files:**
- `includes/class-eff-admin.php` line 19 — defines `USER_META_THEME`
- `includes/class-eff-ajax-handler.php` line 170 — references `EFF_Admin::USER_META_THEME`

Not a true duplicate, but an unnecessary coupling between two classes. Both should reference the same plugin-level constant rather than one class depending on the other's internals.

**Fix:** Add to `elementor-framework-forge.php`:
```php
define( 'EFF_USER_META_THEME', 'eff_theme' );
```

---

## Phase 3 Architecture Notes (Not Urgent)

**Color math extracted from AJAX handler.** `hex_to_hsl()` and `hsl_to_hex()` are private methods in `EFF_Ajax_Handler`. They are not duplicated but belong logically in a dedicated `EFF_Color_Utility` class. Consider this when adding more color features.

**Sync workflow coordinator.** The `ajax_eff_sync_from_elementor()` method orchestrates CSS Parser → Data Store. As EFF grows, a dedicated `EFF_Sync_Coordinator` class would keep the AJAX handler thin and make the sync logic independently testable.

---

## Summary

| Severity | Count | Issues |
|----------|-------|--------|
| HIGH | 1 | Duplicate `NONCE_ACTION` constant |
| MEDIUM | 3 | Active kit ID, JSON decode, POST param extraction |
| LOW | 4 | CSS var regex, category validation, file checks, meta key coupling |

**Recommended action order:**
1. Move `NONCE_ACTION` (and `USER_META_THEME`) to plugin-level constants — zero risk, high value
2. Add `safe_json_decode()` helper — reduces 10+ duplicate blocks
3. Add `post_param()` helper — reduces 20+ duplicate blocks
4. Make `get_active_kit_id()` public static and call it from the AJAX handler
5. Define `CSS_VAR_PATTERN` constant — cosmetic but improves consistency
