# AFF Unit Tests — Comprehensive Test Plan
# Atomic Framework Forge for Elementor — v0.4.1-beta

> **Purpose:** Define every unit, integration, and regression test for AFF. The
> primary risk is silent breakage when Elementor updates — this document treats
> Elementor compatibility as a first-class testing concern alongside AFF's own logic.
>
> **Framework:** PHPUnit (PHP), Jest (JS — future). See Setup section.
> **Location for test files:** `aff/tests/`

---

## Contents

1. [Test Infrastructure Setup](#1-test-infrastructure-setup)
2. [PHP — AFF_CSS_Parser](#2-php--aff_css_parser)
3. [PHP — AFF_Data_Store](#3-php--aff_data_store)
4. [PHP — AFF_Ajax_Handler (unit-testable methods)](#4-php--aff_ajax_handler-unit-testable-methods)
5. [PHP — AFF_Settings](#5-php--aff_settings)
6. [PHP — AFF_Usage_Scanner](#6-php--aff_usage_scanner)
7. [PHP — Plugin Bootstrap](#7-php--plugin-bootstrap)
8. [JavaScript — AFF.Modal](#8-javascript--affmodal)
9. [JavaScript — AFF.Theme](#9-javascript--afftheme)
10. [JavaScript — AFF.Variables factory](#10-javascript--affvariables-factory)
11. [JavaScript — AFF.Colors module](#11-javascript--affcolors-module)
12. [Elementor Integration — Meta Structures](#12-elementor-integration--meta-structures)
13. [Elementor Integration — CSS File Format](#13-elementor-integration--css-file-format)
14. [Elementor Integration — Plugin API Surface](#14-elementor-integration--plugin-api-surface)
15. [Write-back Round-trip Tests](#15-write-back-round-trip-tests)
16. [Security Tests](#16-security-tests)
17. [Regression Checklist — Run After Every Elementor Update](#17-regression-checklist--run-after-every-elementor-update)

---

## 1. Test Infrastructure Setup

### PHP — PHPUnit

AFF has no build step and no Composer autoloader. PHPUnit must be installed
globally or via a standalone phar.

**Recommended setup:**

```
aff/
└── tests/
    ├── bootstrap.php          ← defines ABSPATH, stubs WP functions
    ├── Unit/
    │   ├── CssParserTest.php
    │   ├── DataStoreTest.php
    │   ├── AjaxHandlerTest.php
    │   ├── SettingsTest.php
    │   └── UsageScannerTest.php
    └── Integration/
        └── ElementorCompatTest.php
```

**bootstrap.php requirements:**

```php
// Must define before requiring any AFF class:
define( 'ABSPATH', '/tmp/wp/' );

// Stub all WP functions used by non-WP core logic:
// wp_upload_dir(), get_option(), update_option(), delete_option(),
// get_post_meta(), update_post_meta(), sanitize_text_field(),
// sanitize_file_name(), wp_parse_args(), get_current_user_id(),
// update_user_meta(), wp_generate_uuid4(), wp_json_encode(),
// wp_delete_file(), wp_mkdir_p(), current_time()

// Require the class under test — do NOT bootstrap the full plugin.
require_once dirname(__DIR__) . '/includes/class-aff-css-parser.php';
```

> Rule: `AFF_Data_Store` is designed to have no WP dependencies in its core
> logic section. The WP adapter methods (`get_wp_storage_dir`, `get_baseline`,
> etc.) must be stubbed or excluded from pure unit tests. Test them separately
> with integration coverage.

### JavaScript — Jest

Since AFF has no build process, Jest must be configured to consume the plain JS
files via JSDOM. Future setup only — document manual test scenarios until then.

---

## 2. PHP — AFF_CSS_Parser

File: `includes/class-aff-css-parser.php`

### 2.1 `normalize_value(string $value): string`

| # | Input | Expected output | Notes |
|---|-------|-----------------|-------|
| 1 | `lamp(1rem, 2rem, 4rem)` | `clamp(1rem, 2rem, 4rem)` | Core EV4 typo fix |
| 2 | `clamp(1rem, 2rem, 4rem)` | `clamp(1rem, 2rem, 4rem)` | Already correct — no change |
| 3 | `#3d2f1f` | `#3d2f1f` | Plain color — untouched |
| 4 | `calc(100% - lamp(1rem, 2rem, 3rem))` | `calc(100% - clamp(1rem, 2rem, 3rem))` | Nested expression |
| 5 | `lamp()` | `clamp()` | Empty parens edge case |
| 6 | `lamp (1rem, 2rem)` | `clamp(1rem, 2rem)` | Space before paren — regex `\blamp\s*\(` must match |
| 7 | `"lamp is a word"` | `"lamp is a word"` | Word 'lamp' not followed by `(` — must NOT be replaced |
| 8 | `` (empty string) | `` | No crash on empty |

### 2.2 `extract_v4_variables(string $css): array`

| # | CSS Input | Expected result |
|---|-----------|-----------------|
| 1 | Single `:root` block containing `--brand: #f00;` | `[{ name: 'brand', value: '#f00' }]` (one `--` stripped) |
| 2 | Two `:root` blocks — first has `--e-global-color-primary: #f00`, second has `--primary: #f00` | Returns `[{ name: 'primary', value: '#f00' }]` from second block |
| 3 | One `:root` block with only `--e-global-*` system variables | Returns `[]` — no user vars found |
| 4 | No `:root` block | Returns `[]` |
| 5 | Empty string | Returns `[]` |
| 6 | `:root` block with `----user-var: #abc;` (double-dashed user label) | Returns `[{ name: '--user-var', value: '#abc' }]` — EV4 adds one `--`, AFF strips one |
| 7 | `:root` block with `--lamp-thing: lamp(1rem, 2rem, 4rem);` | `lamp()` normalized to `clamp()` in returned value |
| 8 | Multiple `:root` blocks; only last contains user vars | Returns variables from the LAST user-var block |
| 9 | `:root` block with `--kit-color: #abc;` | Excluded — `--kit-` is a system prefix |
| 10 | `:root` block with `--arts-fluid-size: 1rem;` | Excluded — `--arts-fluid-` is a system prefix |
| 11 | All 15 known SYSTEM_PREFIXES present in one block | Returns `[]` |

### 2.3 `is_user_variable(array $var): bool` (indirectly via `extract_v4_variables`)

Test each `SYSTEM_PREFIXES` entry individually. For each prefix, create a `:root`
block containing only that prefix → `extract_v4_variables` must return `[]`.

| Prefix to test |
|----------------|
| `--e-global-` |
| `--e-a-` |
| `--e-one-` |
| `--e-context-` |
| `--e-button-` |
| `--e-notice-` |
| `--e-site-editor-` |
| `--e-preview-` |
| `--e-black` |
| `--e-admin-` |
| `--e-focus-` |
| `--arts-fluid-` |
| `--arts-` |
| `--container-` |
| `--kit-` |
| `--widgets-spacing` |
| `--page-title-` |

> **Why this matters:** Elementor adds new system variables in each release.
> When a new prefix is added to Elementor and NOT to `SYSTEM_PREFIXES`, that
> variable leaks into AFF's sync results. This test set must be expanded whenever
> a new prefix is added.

### 2.4 `extract_meta_value(mixed $raw): string`

| # | Input | Expected output | Format |
|---|-------|-----------------|--------|
| 1 | `"#f4c542"` (plain string) | `"#f4c542"` | v1 color |
| 2 | `[ '$$type' => 'color', 'value' => '#3d2f1f' ]` | `"#3d2f1f"` | v2 color |
| 3 | `[ '$$type' => 'size', 'value' => ['size' => 16, 'unit' => 'px'] ]` | `"16px"` | v2 size px |
| 4 | `[ '$$type' => 'size', 'value' => ['size' => 1.5, 'unit' => 'rem'] ]` | `"1.5rem"` | v2 size rem |
| 5 | `[ '$$type' => 'size', 'value' => ['size' => 100, 'unit' => '%'] ]` | `"100%"` | v2 percentage |
| 6 | `[ '$$type' => 'size', 'value' => ['size' => 0, 'unit' => 'auto'] ]` | `"auto"` | v2 auto |
| 7 | `[ '$$type' => 'size', 'value' => ['size' => 'clamp(1rem,2rem,4rem)', 'unit' => 'custom'] ]` | `"clamp(1rem,2rem,4rem)"` | v2 custom (clamp) |
| 8 | `[ '$$type' => 'string', 'value' => '"Roboto"' ]` | `'"Roboto"'` | v2 string/font |
| 9 | `null` | `""` | Null input |
| 10 | `42` (int) | `""` | Non-string, non-array |
| 11 | `[ '$$type' => 'color', 'value' => null ]` | `""` | Null inner value |
| 12 | `[ '$$type' => 'size', 'value' => ['size' => '', 'unit' => 'px'] ]` | `"px"` | Edge: empty size |

### 2.5 `read_from_kit_meta(): ?array`

Requires stubbed `get_option()` and `get_post_meta()`.

| # | Mock setup | Expected |
|---|------------|----------|
| 1 | No active kit (`get_option` returns 0) | `null` |
| 2 | Active kit exists, `_elementor_global_variables` meta is empty | `null` |
| 3 | Meta is valid JSON with one variable, no `deleted_at` | Array with one variable |
| 4 | Meta contains a variable with `deleted_at` set | That variable is excluded |
| 5 | Meta contains a variable with empty `label` | That variable is excluded |
| 6 | Meta is a pre-decoded array (not a JSON string) | Handled correctly |
| 7 | Meta is a JSON string with invalid JSON | `null` |
| 8 | Meta `data` key is missing or empty | `null` |
| 9 | Variable with `el_type === 'size'` and unit `'px'` | `el_unit` field is `'px'` |
| 10 | Variable with `el_type === 'color'` | `el_unit` field is `''` |
| 11 | `lamp()` in value string | Normalized to `clamp()` |

### 2.6 `find_kit_css_file(): ?string`

| # | Scenario | Expected |
|---|----------|----------|
| 1 | No `elementor/css/` directory | `null` |
| 2 | Active kit option points to an existing `post-67.css` | Returns that path |
| 3 | Active kit option points to a non-existent file; one CSS file with user vars exists | Returns the CSS file found by scan |
| 4 | No active kit option; multiple CSS files; only one contains user vars | Returns the one with user vars |
| 5 | No CSS files contain user vars | Returns `$candidates[0]` (newest) or null |

### 2.7 `get_active_kit_id(): ?int`

| # | `get_option` return | Expected |
|---|---------------------|----------|
| 1 | `67` | `67` |
| 2 | `"67"` (string) | `67` |
| 3 | `0` | `null` |
| 4 | `false` | `null` |
| 5 | `""` | `null` |

---

## 3. PHP — AFF_Data_Store

File: `includes/class-aff-data-store.php`

### 3.1 `load_from_file()` / `save_to_file()` — Round-trip

| # | Scenario | Expected |
|---|----------|----------|
| 1 | Save empty project, reload it | All top-level keys present, variables = [] |
| 2 | Save with 3 variables, reload | Same 3 variables with all fields preserved |
| 3 | Save then reload — `dirty` flag | `dirty` is false after both operations |
| 4 | Load non-existent file | Returns `false` |
| 5 | Load file with invalid JSON | Returns `false` |
| 6 | Load file with unexpected extra keys | Keys merged via `array_merge` — extra keys survive |
| 7 | `save_to_file()` with unwritable directory | Returns `false` |
| 8 | After `load_from_file()`, `get_current_file()` returns correct path | Path matches |

### 3.2 `add_variable()` / `get_variables()`

| # | Scenario | Expected |
|---|----------|----------|
| 1 | Add one variable | `get_variables()` returns array with 1 item |
| 2 | Returned ID is a valid UUID v4 (regex) | Matches `/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i` |
| 3 | Two `add_variable()` calls produce distinct IDs | IDs differ |
| 4 | Added variable has `created_at` and `updated_at` in ISO 8601 format | Fields present and parseable |
| 5 | Partial input — missing `type` → gets default | `type` is `'color'` |
| 6 | `dirty` flag becomes true after add | `is_dirty()` returns `true` |
| 7 | All default fields present in added variable | id, name, value, original_value, pending_rename_from, parent_id, type, format, group, subgroup, category, category_id, order, source, status, modified, created_at, updated_at |

### 3.3 `update_variable()`

| # | Scenario | Expected |
|---|----------|----------|
| 1 | Update existing variable's value | Value changed, `updated_at` refreshed |
| 2 | Update sets `modified = true` | `modified` field is `true` |
| 3 | Update sets `status = 'modified'` when status not supplied | Status is `'modified'` |
| 4 | Caller supplies explicit `status` | That status value is used |
| 5 | Update with non-existent ID | Returns `false` |
| 6 | `created_at` is NOT changed by update | Timestamp unchanged |

### 3.4 `delete_variable()`

| # | Scenario | Expected |
|---|----------|----------|
| 1 | Delete existing variable | Returns `true`; variable absent from `get_variables()` |
| 2 | Delete non-existent ID | Returns `false` |
| 3 | Delete with `delete_children = true` | All variables with `parent_id === $id` also removed |
| 4 | Delete with `delete_children = false` | Children remain |
| 5 | After deletion, array is re-indexed (no gaps) | `array_values` applied |
| 6 | `dirty` flag becomes true | `is_dirty()` returns `true` |

### 3.5 `delete_variable_by_name_if_empty_id()`

| # | Scenario | Expected |
|---|----------|----------|
| 1 | Variable with matching name and empty id exists | Deleted, returns `true` |
| 2 | Variable with matching name but non-empty id | NOT deleted, returns `false` |
| 3 | No variable with matching name | Returns `false` |

### 3.6 `find_variable_by_name()`

| # | Scenario | Expected |
|---|----------|----------|
| 1 | Variable with that name exists | Returns the variable array |
| 2 | No variable with that name | Returns `null` |
| 3 | Case sensitivity — `'Primary'` vs `'primary'` | Returns `null` (names are case-sensitive) |

### 3.7 Category CRUD — `add_category_for_subgroup()`

| # | Subgroup | Input | Expected |
|---|----------|-------|----------|
| 1 | Colors | `{ name: 'Branding' }` | Category appears in `get_categories_for_subgroup('Colors')` |
| 2 | Fonts | `{ name: 'Titles' }` | Stored under `fontCategories` key |
| 3 | Numbers | `{ name: 'Spacing' }` | Stored under `numberCategories` key |
| 4 | Unknown subgroup | Falls back to `categories` | No crash |

### 3.8 Category CRUD — `update_category_for_subgroup()`

| # | Scenario | Expected |
|---|----------|----------|
| 1 | Update existing category name | Name changed |
| 2 | Attempt to change `locked` flag via update | `locked` field unchanged (never allowed) |
| 3 | Update non-existent ID | Returns `false` |

### 3.9 Category CRUD — `delete_category_for_subgroup()`

| # | Scenario | Expected |
|---|----------|----------|
| 1 | Delete unlocked category | Returns `true`; category absent |
| 2 | Delete locked category | Returns `false`; category still present |
| 3 | Delete from wrong subgroup | Returns `false` |

### 3.10 `reorder_categories_for_subgroup()`

| # | Scenario | Expected |
|---|----------|----------|
| 1 | Provide reversed ID order for 3 categories | `order` values updated; categories sorted accordingly |
| 2 | IDs include unknown IDs | Only known IDs get their order updated; no crash |
| 3 | Empty `ordered_ids` array | Returns `false` (no config key for empty subgroup) |

### 3.11 `import_parsed_variables()`

| # | Scenario | Expected |
|---|----------|----------|
| 1 | Import 3 vars into empty store | 3 added, returns `3` |
| 2 | Import 3 vars, 1 already exists by name | 2 added, returns `2` |
| 3 | All 3 already exist | 0 added, returns `0`, `dirty` unchanged |
| 4 | Imported variables get `source = 'elementor-parsed'` | Source field set |
| 5 | Empty input array | Returns `0` |

### 3.12 `migrate_data()`

| # | Scenario | Expected |
|---|----------|----------|
| 1 | Variable with `modified = true`, no `status` | `status` becomes `'modified'` |
| 2 | Variable with `modified = false`, no `status` | `status` becomes `'synced'` |
| 3 | Variable already has `status = 'new'` | Status unchanged |
| 4 | Variable missing `original_value` | Field added as copy of `value` |
| 5 | Variable missing `pending_rename_from` | Field added as `null` |
| 6 | Variable missing `parent_id` | Field added as `null` |
| 7 | Variable missing `format` | Field added as `'HEX'` |
| 8 | Variable missing `category_id` | Field added as `''` |
| 9 | Variable missing `order` | Field added as `0` |
| 10 | Called twice on same data (idempotent) | No change on second call |
| 11 | `variables` key missing from data | No crash |

### 3.13 `sanitize_project_slug()`

| # | Input | Expected |
|---|-------|----------|
| 1 | `'My Demo Project'` | `'my-demo-project'` |
| 2 | `'Test & Site!'` | `'test-site'` |
| 3 | `'---leading-dashes---'` | `'leading-dashes'` |
| 4 | `'UPPERCASE'` | `'uppercase'` |
| 5 | `'multiple   spaces'` | `'multiple-spaces'` |
| 6 | `'project.name.v2'` | `'project-name-v2'` |
| 7 | `''` | `''` |

### 3.14 `sanitize_filename()`

| # | Input | Expected |
|---|-------|----------|
| 1 | `'my-project'` | `'my-project.aff.json'` |
| 2 | `'my-project.aff.json'` | `'my-project.aff.json'` |
| 3 | `'my-project.aff'` | `'my-project.aff.json'` |
| 4 | `'my-project.aff.aff'` | `'my-project.aff.json'` (strips repeated `.aff`) |
| 5 | `'../traversal'` | Safe sanitized name (no `..`) |

### 3.15 `generate_backup_filename()`

| # | Input | Constraint |
|---|-------|------------|
| 1 | `'my-project'` | Matches `/^my-project_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.aff\.json$/` |
| 2 | Two calls one second apart | Different filenames |

### 3.16 `prune_backups()`

| # | Setup | `$max` | Expected |
|---|-------|--------|----------|
| 1 | 5 files, max = 10 | 10 | All 5 remain |
| 2 | 5 files, max = 3 | 3 | Oldest 2 deleted; newest 3 remain |
| 3 | 5 files, max = 1 | 1 | Oldest 4 deleted |
| 4 | 5 files, max = 0 | 0 | No deletion (guard: `if ($max < 1) return`) |

---

## 4. PHP — AFF_Ajax_Handler (unit-testable methods)

File: `includes/class-aff-ajax-handler.php`

These are private methods tested by exposing them via a test subclass or reflection.

### 4.1 `is_valid_css_var(string $name): bool`

Pattern: `/^(--)?[A-Za-z_][A-Za-z0-9_-]*$/`

| # | Input | Expected | Reason |
|---|-------|----------|--------|
| 1 | `'primary'` | `true` | Simple identifier |
| 2 | `'color-brand-primary'` | `true` | Hyphenated |
| 3 | `'_private'` | `true` | Leading underscore allowed |
| 4 | `'--primary'` | `true` | Optional `--` prefix allowed |
| 5 | `'primary-1'` | `true` | Digit in middle |
| 6 | `'1primary'` | `false` | Starts with digit |
| 7 | `'-primary'` | `false` | Starts with single dash |
| 8 | `'primary color'` | `false` | Space not allowed |
| 9 | `'primary!'` | `false` | Special char not allowed |
| 10 | `''` | `false` | Empty string |
| 11 | `'a'` | `true` | Minimal valid name |

### 4.2 `variable_name_exists(array $variables, string $name, ?string $exclude_id): bool`

| # | Scenario | Expected |
|---|----------|----------|
| 1 | Name exists, no exclude | `true` |
| 2 | Name exists, excluded by its own ID | `false` |
| 3 | Name exists, excluded by a different ID | `true` |
| 4 | Name does not exist | `false` |
| 5 | Case-insensitive: `'Primary'` vs `'primary'` | `true` — names are compared lowercase |
| 6 | `exclude_id = null` and name matches | `true` |

### 4.3 `build_elementor_meta_value(string $css_value, string $aff_type, string $subgroup, string $format): array`

| # | css_value | aff_type | subgroup | format | Expected `$$type` | Expected `value` |
|---|-----------|----------|----------|--------|---------------------|------------------|
| 1 | `'#f4c542'` | `'color'` | `'Colors'` | `'HEX'` | `'color'` | `'#f4c542'` |
| 2 | `'rgba(61,47,31,0.5)'` | `'color'` | `'Colors'` | `'RGBA'` | `'color'` | `'rgba(61,47,31,0.5)'` |
| 3 | `'16px'` | `'number'` | `'Numbers'` | `'PX'` | `'size'` | `{ size: 16.0, unit: 'px' }` |
| 4 | `'1.5rem'` | `'number'` | `'Numbers'` | `'REM'` | `'size'` | `{ size: 1.5, unit: 'rem' }` |
| 5 | `'clamp(1rem,2rem,4rem)'` | `'number'` | `'Numbers'` | `'FX'` | `'size'` | `{ size: 'clamp(1rem,2rem,4rem)', unit: 'custom' }` |
| 6 | `'calc(100% - 2rem)'` | `'number'` | `'Numbers'` | `'PX'` | `'size'` | `{ size: 'calc(100% - 2rem)', unit: 'custom' }` (falls through to `preg_match`) |
| 7 | `'"Roboto"'` | `'font'` | `'Fonts'` | `'System'` | `'string'` | `'"Roboto"'` |
| 8 | `'Inter, sans-serif'` | `''` | `'Fonts'` | `''` | `'string'` | `'Inter, sans-serif'` |

### 4.4 `parse_size_value(string $value): array`

| # | Input | Expected size | Expected unit |
|---|-------|---------------|---------------|
| 1 | `'16px'` | `16.0` | `'px'` |
| 2 | `'1.5rem'` | `1.5` | `'rem'` |
| 3 | `'100%'` | `100.0` | `'%'` |
| 4 | `'0.75em'` | `0.75` | `'em'` |
| 5 | `'-2px'` | `-2.0` | `'px'` |
| 6 | `'10vw'` | `10.0` | `'vw'` |
| 7 | `'10'` (no unit) | `10.0` | `'px'` (default) |
| 8 | `'clamp(1rem,2rem,4rem)'` | `'clamp(1rem,2rem,4rem)'` | `'custom'` (fallback) |

### 4.5 `hex_to_hsl(string $hex): array`

| # | Input | Expected [H, S, L] | Tolerance |
|---|-------|---------------------|-----------|
| 1 | `'ff0000'` | [0, 100, 50] | ±0.5 |
| 2 | `'00ff00'` | [120, 100, 50] | ±0.5 |
| 3 | `'0000ff'` | [240, 100, 50] | ±0.5 |
| 4 | `'000000'` | [0, 0, 0] | exact |
| 5 | `'ffffff'` | [0, 0, 100] | exact |
| 6 | `'808080'` | [0, 0, ~50.2] | ±0.5 |
| 7 | `'f4c542'` (AFF gold) | ~[46, ~88, ~61] | ±1.0 |

### 4.6 `hsl_to_hex(float $h, float $s, float $l): string`

| # | Input [H, S, L] | Expected hex |
|---|-----------------|--------------|
| 1 | [0, 100, 50] | `'#ff0000'` |
| 2 | [120, 100, 50] | `'#00ff00'` |
| 3 | [240, 100, 50] | `'#0000ff'` |
| 4 | [0, 0, 0] | `'#000000'` |
| 5 | [0, 0, 100] | `'#ffffff'` |

**Round-trip test:** `hex_to_hsl(hsl_to_hex(h, s, l))` must return original [H, S, L]
within ±1 for a matrix of 20 diverse input colors.

### 4.7 `generate_children()` — tint/shade/transparency naming

This tests the naming convention from spec §15.7.

**Setup:** Parent variable: `{ id: 'abc', name: '--primary', value: '#3d2f1f', subgroup: 'Colors' }`

| # | Parameters | Expected child names |
|---|------------|---------------------|
| 1 | tints=3, shades=0, trans=false | `--primary-10`, `--primary-20`, `--primary-30` |
| 2 | tints=0, shades=3, trans=false | `--primary-plus-10`, `--primary-plus-20`, `--primary-plus-30` |
| 3 | tints=0, shades=0, trans=true | `--primary10`, `--primary20`, `--primary30`, `--primary40`, `--primary50`, `--primary60`, `--primary70`, `--primary80`, `--primary90` |
| 4 | tints=2, shades=2, trans=true | All 13 names above |
| 5 | tints=0, shades=0, trans=false | No children generated |
| 6 | Transparency alpha step 1 (10%) | Alpha hex = `'1a'` (round(0.1 * 255) = 26 = `0x1a`) |
| 7 | Transparency alpha step 5 (50%) | Alpha hex = `'80'` (round(0.5 * 255) = 128 = `0x80`) |
| 8 | Transparency alpha step 9 (90%) | Alpha hex = `'e6'` (round(0.9 * 255) = 230 = `0xe6`) |
| 9 | Regenerate children (call twice) | Old children removed first; only new set remains |
| 10 | Parent hex not 6 digits | Exception thrown with descriptive message |
| 11 | tints=10 (max) | 10 tints, lightness steps are uniform toward 100% (≤98) |
| 12 | shades=10 (max) | 10 shades, lightness steps are uniform toward 0% (≥2) |
| 13 | tints=11 (over max via clamp in handler) | Clamped to 10 |

### 4.8 `resolve_file(string $raw): array`

| # | Input | Expected |
|---|-------|----------|
| 1 | `'my-project/my-project_2026-04-01_10-00-00.aff.json'` | Returns absolute path inside uploads dir |
| 2 | `'../../../wp-config.php'` | JSON error sent (contains `..`) |
| 3 | `'/etc/passwd'` | JSON error sent (outside uploads dir after realpath) |
| 4 | `'my-project.aff.json'` (old flat format) | Resolved via `sanitize_filename()` |
| 5 | Leading slash stripped | Works correctly |

### 4.9 `find_user_root_close_pos(string $css): int|false`

| # | CSS input | Expected |
|---|-----------|----------|
| 1 | Single user `:root` block | Returns position of `}` |
| 2 | One system `:root` block only | Returns `false` |
| 3 | System block followed by user block | Returns position of `}` in user block |
| 4 | Two user blocks | Returns position of `}` in LAST user block |
| 5 | No `:root` block at all | Returns `false` |
| 6 | `:root` block with `--e-global-*` vars only | Returns `false` |
| 7 | User block after several system blocks | Returns the user block's `}` position |

### 4.10 `get_subgroup_param()`

| # | POST `subgroup` value | Expected |
|---|----------------------|----------|
| 1 | `'Colors'` | `'Colors'` |
| 2 | `'Fonts'` | `'Fonts'` |
| 3 | `'Numbers'` | `'Numbers'` |
| 4 | `'invalid'` | `'Colors'` (default) |
| 5 | (absent) | `'Colors'` (default) |

---

## 5. PHP — AFF_Settings

File: `includes/class-aff-settings.php`

| # | Test | Expected |
|---|------|----------|
| 1 | `get()` with no saved options | Returns all defaults |
| 2 | `get('max_backups')` | Returns `10` (default) |
| 3 | `get('nonexistent_key')` | Returns `null` |
| 4 | `set(['max_backups' => 5])`, then `get('max_backups')` | Returns `5` |
| 5 | `set(['max_backups' => 5])` merges — other keys unchanged | All other defaults still present |
| 6 | All expected default keys present | Check for every key in `$defaults` |
| 7 | `get_defaults()` returns the hardcoded defaults | Identical to `$defaults` property |
| 8 | `ui_font_size` default | `14` |
| 9 | `max_backups` default | `10` |
| 10 | `colors_default_categories` default | `['Branding', 'Backgrounds', 'Neutral', 'Status']` |

---

## 6. PHP — AFF_Usage_Scanner

File: `includes/class-aff-usage-scanner.php`

| # | Scenario | Expected |
|---|----------|----------|
| 1 | Empty variable names array | Returns `[]` immediately (no DB query) |
| 2 | No posts with `_elementor_data` meta | Returns all names at count `0` |
| 3 | One post, one occurrence of `var(--primary)` | `['--primary' => 1]` |
| 4 | One post, two occurrences of `var(--primary)` | `['--primary' => 2]` |
| 5 | `var(--primary, #fallback)` (fallback syntax) | Still counted (pattern matches `var(--primary`) |
| 6 | Two posts, one occurrence each | `['--primary' => 2]` |
| 7 | Two variable names tracked simultaneously | Both counted correctly |
| 8 | `--primary` occurs in post A, `--accent` occurs in post B | Separate counts |
| 9 | `_elementor_data` is non-string (array) | Skipped, no crash |
| 10 | Variable name not present in any post | Returns `0` for that name |

---

## 7. PHP — Plugin Bootstrap

File: `atomic-framework-forge-for-elementor.php`

| # | Scenario | Expected |
|---|----------|----------|
| 1 | `ELEMENTOR_VERSION` not defined | `aff_check_dependencies()` returns non-empty array |
| 2 | `ELEMENTOR_PRO_VERSION` not defined | `aff_check_dependencies()` returns non-empty array |
| 3 | Both defined | `aff_check_dependencies()` returns `[]` |
| 4 | Both missing | Two error messages returned |
| 5 | `aff_init()` with missing deps | Adds `admin_notices` hook; does NOT require loader |
| 6 | `AFF_VERSION` constant defined | Equals `'0.4.1-beta'` |
| 7 | All required constants defined | `AFF_VERSION`, `AFF_PLUGIN_FILE`, `AFF_PLUGIN_DIR`, `AFF_PLUGIN_URL`, `AFF_SLUG`, `AFF_NONCE_ACTION`, `AFF_USER_META_THEME` |
| 8 | `AFF_NONCE_ACTION` value | `'aff_admin_nonce'` |

---

## 8. JavaScript — AFF.Modal

File: `admin/js/aff-modal.js`

### 8.1 Basic open/close

| # | Action | Expected |
|---|--------|----------|
| 1 | `AFF.Modal.open({ title: 'T', body: 'B', footer: 'F' })` | Modal element appears in DOM |
| 2 | Backdrop appears | Backdrop element visible |
| 3 | `AFF.Modal.close()` | Modal removed from DOM |
| 4 | Backdrop click | Modal closes |
| 5 | ESC key press while open | Modal closes |
| 6 | ESC key press while no modal open | No crash |

### 8.2 Single-instance guarantee

| # | Action | Expected |
|---|--------|----------|
| 7 | Open modal A then open modal B | Only modal B visible; modal A removed |
| 8 | After second open, only one modal in DOM | `document.querySelectorAll('.aff-modal').length === 1` |

### 8.3 Focus management

| # | Action | Expected |
|---|--------|----------|
| 9 | Modal opens | Focus moves into modal |
| 10 | Tab key cycles focus within modal | Focus stays inside modal (not on page behind) |
| 11 | Shift+Tab from first focusable element | Focus wraps to last focusable element |
| 12 | Modal closes | Focus returns to element that triggered open |

### 8.4 `onClose` callback

| # | Action | Expected |
|---|--------|----------|
| 13 | `onClose` provided and close triggered | `onClose()` called |
| 14 | `onClose` not provided | No crash |

### 8.5 Scope

| # | Action | Expected |
|---|--------|----------|
| 15 | Backdrop is scoped to `#aff-app`, not `document.body` | Backdrop parent is inside `#aff-app` |

---

## 9. JavaScript — AFF.Theme

File: `admin/js/aff-theme.js`

| # | Action | Expected |
|---|--------|----------|
| 1 | `AFF.Theme.set('dark')` | `#aff-app` gets `data-aff-theme="dark"` |
| 2 | `AFF.Theme.set('light')` | `#aff-app` gets `data-aff-theme="light"` |
| 3 | `AFF.Theme.toggle()` from light | Becomes `dark` |
| 4 | `AFF.Theme.toggle()` from dark | Becomes `light` |
| 5 | `AFF.Theme.set('dark')` fires AJAX to `aff_save_user_theme` | Request body contains `theme=dark` |
| 6 | Invalid theme value `'blue'` | Defaults to `'light'` |

---

## 10. JavaScript — AFF.Variables factory

File: `admin/js/aff-variables.js`

### 10.1 `_rowKey(v)`

| # | Input | Expected |
|---|-------|----------|
| 1 | Variable with `id = 'abc-123'` | `'abc-123'` |
| 2 | Variable with `id = ''` (unsaved) and `name = 'primary'` | `'__n_primary'` |
| 3 | Variable with `id = null` | `'__n_<name>'` |

### 10.2 `_findVarByKey(key)`

| # | Scenario | Expected |
|---|----------|----------|
| 1 | Key is a UUID, matching variable exists | Returns that variable |
| 2 | Key is `'__n_primary'`, unsaved variable with name `'primary'` exists | Returns that variable |
| 3 | Key is UUID, no match | Returns `null` |
| 4 | Key is `'__n_'` + name, but variable has an id (not unsaved) | Returns `null` (unsaved lookup only matches `!v.id`) |

### 10.3 View-presence guard (per PATTERNS.md)

| # | Scenario | Expected |
|---|----------|----------|
| 1 | Fonts view is active; click event fires on `#aff-edit-content` | Colors handler does NOT fire (`.aff-colors-view` absent) |
| 2 | Colors view is active; Fonts instance click handler fires | Fonts handler does NOT fire (`.aff-fonts-view` absent) |
| 3 | Correct view is active; click fires | Handler executes |

### 10.4 Re-bind guard (per PATTERNS.md)

| # | Scenario | Expected |
|---|----------|----------|
| 1 | Render called twice | `container._effVarsEventsBound` is set; second bind is skipped |
| 2 | Only one click handler for each event type | Event fires once per click, not twice |

### 10.5 Drag/drop — object identity

| # | Scenario | Expected |
|---|----------|----------|
| 1 | Reorder via drag for unsaved vars (no ids) | Uses object `===` comparison, not `.id` comparison |
| 2 | Two unsaved vars with different names | Correctly reordered without cross-contamination |

---

## 11. JavaScript — AFF.Colors module

File: `admin/js/aff-colors.js`

| # | Action | Expected |
|---|--------|----------|
| 1 | View-presence guard on click | Same as Variables 10.3 |
| 2 | View-presence guard on mousedown | Guard applied to drag start |
| 3 | `_drag` object scoped to module level | Does not bleed into Fonts/Numbers drag state |
| 4 | Expand modal opens for a color row | Modal shown with correct variable data |
| 5 | Inline edit commits on Enter key | `aff_save_color` AJAX called |
| 6 | Inline edit cancels on Escape key | No AJAX call; original value restored |

---

## 12. Elementor Integration — Meta Structures

> These tests verify that Elementor's data structures match what AFF expects.
> **Run these after every Elementor update** — structure changes will break AFF.
> Tests require a live WordPress install with Elementor active.

### 12.1 `_elementor_global_variables` post meta

Expected structure (verified against EV4 source, current as of Elementor 3.x → 4.x):

```php
// get_post_meta($kit_id, '_elementor_global_variables', true) returns:
// A JSON-encoded string representing:
[
    'version'   => 2,
    'watermark' => int,
    'data'      => [
        'e-gv-xxxxxxx' => [
            'label'      => string,  // user's variable name
            'value'      => [        // wrapped value
                '$$type' => 'color' | 'size' | 'string',
                'value'  => string | [ 'size' => float, 'unit' => string ],
            ],
            'type'       => 'global-color-variable' | 'global-size-variable' | 'global-variable',
            'order'      => int,
            'created_at' => string,
            'updated_at' => string,
        ]
    ]
]
```

| # | Check | Pass condition |
|---|-------|----------------|
| 1 | Option key name | `get_post_meta($kit_id, '_elementor_global_variables', true)` returns non-false |
| 2 | Top-level `data` key exists | `isset($meta['data'])` is `true` |
| 3 | `$$type` field present on each variable | Each entry in `data` has `value['$$type']` |
| 4 | `label` field present | Each entry has `label` |
| 5 | `deleted_at` field present on soft-deleted vars | Soft-deleted entries have `deleted_at` |
| 6 | Version field is `2` | `$meta['version'] === 2` |
| 7 | Meta stored as JSON string, not PHP array | `is_string(get_post_meta(...))` is `true` |

**Failure impact:** If any of these fail, `read_from_kit_meta()` will return `null` and sync will fall back to the CSS file parser. AFF will not crash but sync will silently degrade.

### 12.2 `_elementor_page_settings` (V3 Global Colors)

| # | Check | Pass condition |
|---|-------|----------------|
| 1 | Key exists on kit post | `get_post_meta($kit_id, '_elementor_page_settings', true)` is an array |
| 2 | `system_colors` key present | `isset($settings['system_colors'])` |
| 3 | Each system color has `_id`, `title`, `color` | Fields present |
| 4 | `custom_colors` key present | `isset($settings['custom_colors'])` |
| 5 | Color value format | `color` field is 3–8 char hex string (with or without `#`) |

**Failure impact:** `ajax_aff_sync_v3_global_colors()` returns empty array. V3 import silently fails.

### 12.3 Active kit option

| # | Check | Pass condition |
|---|-------|----------------|
| 1 | Option key | `get_option('elementor_active_kit')` returns non-zero integer |
| 2 | Kit post exists | `get_post($kit_id)` returns a `WP_Post` object |
| 3 | Kit post type | `$kit->post_type` is `'elementor_library'` |

---

## 13. Elementor Integration — CSS File Format

> These tests verify that the kit CSS file format matches what `AFF_CSS_Parser` expects.

### 13.1 File location

| # | Check | Pass condition |
|---|-------|----------------|
| 1 | CSS directory exists | `wp-content/uploads/elementor/css/` is a directory |
| 2 | Kit CSS file exists | `post-{kit_id}.css` is present after any Elementor save |
| 3 | File path unchanged | File is still at `uploads/elementor/css/post-{id}.css` (not in a subdirectory) |

### 13.2 `:root` block structure

| # | Check | Pass condition |
|---|-------|----------------|
| 4 | File contains at least one `:root { ... }` block | `preg_match('/:root\s*\{/', $css)` matches |
| 5 | V4 user variable block is the LAST `:root` block | Variables in last block do not start with any `SYSTEM_PREFIXES` prefix |
| 6 | V4 variables use `--` prefix in CSS | Each user variable appears as `  --varname: value;` |
| 7 | Variables not wrapped in other at-rules | No `@media` or `@supports` wrapper around the user `:root` block |

### 13.3 `lamp()` typo

| # | Check | Notes |
|---|-------|-------|
| 8 | If `lamp()` appears in the file | `normalize_value()` corrects it — verify by round-trip through parse then commit |
| 9 | If `clamp()` appears | Normalizer leaves it unchanged |

**Failure impact:** If Elementor changes to a subdirectory layout or renames the file, `find_kit_css_file()` returns `null`. Sync degrades to `read_from_kit_meta()` only (which is the primary path anyway — low severity if meta path works).

---

## 14. Elementor Integration — Plugin API Surface

> These tests verify that the Elementor PHP API AFF depends on still exists.

| # | Check | Code | Failure impact |
|---|-------|------|----------------|
| 1 | `\Elementor\Plugin` class exists | `class_exists('\Elementor\Plugin')` | `try_regenerate_elementor_kit_css()` skipped |
| 2 | `\Elementor\Plugin::$instance` set | `isset(\Elementor\Plugin::$instance)` | Same |
| 3 | `files_manager` property on instance | `isset(\Elementor\Plugin::$instance->files_manager)` | `clear_elementor_css_cache()` silently skipped; cache not cleared |
| 4 | `files_manager->clear_cache()` method exists | `method_exists(..., 'clear_cache')` | Cache not cleared after commit; Elementor regenerates on next page load |
| 5 | `\Elementor\Core\Files\CSS\Post` class exists | `class_exists('\Elementor\Core\Files\CSS\Post')` | CSS regeneration skipped; first sync after fresh install requires page load |
| 6 | `CSS\Post::update()` method exists | `method_exists(new \Elementor\Core\Files\CSS\Post($id), 'update')` | Regeneration fails |

> **Critical:** Items 3 and 4 are most likely to change across Elementor versions.
> `files_manager` was renamed in Elementor 3.5. Always check these on update.

---

## 15. Write-back Round-trip Tests

> End-to-end verification that the full sync → edit → commit → verify cycle works.
> These require a live WordPress + Elementor environment. Run manually or via WP-CLI.

### 15.1 Sync → Verify

1. Ensure at least one variable exists in Elementor Site Settings → Global Variables
2. Run `aff_sync_from_elementor` AJAX call
3. **Verify:** Response `success` is `true`
4. **Verify:** `variables` array is non-empty
5. **Verify:** `source` field is `'elementor_kit_meta'` (not CSS fallback)

### 15.2 Edit → Save → Reload

1. Sync variables
2. Change one variable's value (e.g. `--primary` to a new hex)
3. Run `aff_save_file` AJAX call
4. **Verify:** File created in `uploads/aff/{slug}/` directory
5. Run `aff_load_file` with the returned filename
6. **Verify:** Loaded data contains the edited value

### 15.3 Commit → Elementor

1. Sync and change a variable value
2. Run `aff_commit_to_elementor` AJAX call
3. **Verify:** Response `success` is `true`
4. **Verify:** `committed` array contains the variable name
5. Check `_elementor_global_variables` post meta directly (via WP-CLI or var_dump):
   - **Verify:** The variable's `value` in EV4 meta reflects the new value
6. Load a page using that variable in the browser
7. **Verify:** CSS `var(--varname)` resolves to the new value

### 15.4 Commit deletion

1. Sync; note variable `--primary` exists
2. Remove `--primary` from AFF; rebuild elementor_snapshot without it
3. Run `aff_commit_to_elementor` with `elementor_snapshot` containing `'primary'`
4. **Verify:** Response `deleted` array contains `'primary'`
5. Check EV4 meta — **Verify:** `--primary` entry removed from `data` array

### 15.5 New variable creation

1. Add a new variable in AFF that does NOT exist in Elementor
2. Run `aff_commit_to_elementor`
3. **Verify:** Response `created` array contains the new variable name
4. Check EV4 meta — **Verify:** New entry present with `e-gv-xxxxxxx` ID

### 15.6 CSS file fallback path

1. Delete `post-{id}.css` manually
2. Run `aff_sync_from_elementor`
3. **Verify:** Sync succeeds (reads from meta — primary path)
4. Run `aff_commit_to_elementor`
5. **Verify:** CSS file is regenerated by `try_regenerate_elementor_kit_css()` or commit still succeeds without the file

---

## 16. Security Tests

### 16.1 Nonce verification

| # | Scenario | Expected |
|---|----------|----------|
| 1 | POST with no `nonce` field | Response `status 403`, `success: false` |
| 2 | POST with invalid nonce string | Response `status 403`, `success: false` |
| 3 | POST with valid nonce, insufficient capability (`subscriber` role) | Response `status 403`, `success: false` |
| 4 | POST with valid nonce and `manage_options` capability | Request proceeds |

### 16.2 Path traversal

| # | Input | Expected |
|---|-------|----------|
| 1 | `filename = '../../../wp-config.php'` | Rejected — `..` detected |
| 2 | `filename = '/etc/passwd'` | Rejected — outside uploads dir |
| 3 | `filename = 'slug/slug_2026-01-01_00-00-00.aff.json'` followed by `..` | Rejected |
| 4 | `css_file_path` outside `uploads/elementor/css/` | Rejected with error |
| 5 | `css_file_path` not ending in `.css` | Rejected with error |

### 16.3 Input sanitization

| # | Field | Malicious input | Expected |
|---|-------|-----------------|----------|
| 1 | `project_name` | `'<script>alert(1)</script>'` | Sanitized by `sanitize_text_field()` |
| 2 | `category.name` | SQL injection attempt | Sanitized; stored as harmless string |
| 3 | Variable `value` | `'); DROP TABLE wp_posts;--` | Sanitized; no DB execution |
| 4 | `variable_names` (usage scan) | Names not matching CSS var pattern | Filtered out before `substr_count` |

### 16.4 Write-back scope

| # | Scenario | Expected |
|---|----------|----------|
| 1 | `aff_commit_to_elementor` only writes to Elementor's own meta and CSS file | Does NOT modify any other post meta or option |
| 2 | `AFF_CSS_Parser` methods never write to any file | Verified by code review: all file writes are in AJAX handler only |

---

## 17. Regression Checklist — Run After Every Elementor Update

> This is the most important section. Elementor updates are the primary source of
> undetected AFF breakage. Run this checklist whenever Elementor or Elementor Pro
> is updated, before confirming the update to production.

**Instructions:** Work through each item top to bottom. Stop at the first failure and
file a bug before proceeding. Do not mark an item as passed by "it probably works" —
it must be explicitly verified.

---

### Part A — Data Structure Verification (5 minutes)

```
[ ] A1. get_option('elementor_active_kit') returns the correct kit post ID.
         Expected: integer > 0.

[ ] A2. _elementor_global_variables meta is a JSON string (not a serialized array).
         Check: get_post_meta($kit_id, '_elementor_global_variables', true) → is_string().

[ ] A3. Meta JSON decodes to array with top-level keys: version, watermark, data.
         Check: json_decode($raw, true) → isset($meta['version'], $meta['watermark'], $meta['data'])

[ ] A4. Each entry in $meta['data'] has: label, value, type, order, created_at, updated_at.
         Check one entry manually.

[ ] A5. Each entry's value has $$type field: 'color', 'size', or 'string'.
         Check one color entry and one size entry.

[ ] A6. Size value inner structure: { size: number|string, unit: string }.
         Check one size entry.

[ ] A7. Soft-deleted variables have a deleted_at field.
         If none are soft-deleted, mark N/A.
```

---

### Part B — CSS File Verification (3 minutes)

```
[ ] B1. wp-content/uploads/elementor/css/post-{kit_id}.css exists after saving in Elementor.

[ ] B2. File contains a :root block whose variables do NOT start with --e-global-*.
         This is the user variable block that AFF reads.

[ ] B3. No new :root block structure that wraps variables in @media or @supports.

[ ] B4. Variable names in the user :root block still match what is visible in
         Elementor's Variables Manager UI.

[ ] B5. No new system variable prefixes that could leak into AFF sync results.
         Compare SYSTEM_PREFIXES list in AFF_CSS_Parser against all prefixes in post-{id}.css.
```

---

### Part C — Plugin API Verification (2 minutes)

```
[ ] C1. class_exists('\Elementor\Plugin') === true.

[ ] C2. isset(\Elementor\Plugin::$instance) === true.

[ ] C3. isset(\Elementor\Plugin::$instance->files_manager) === true.
         If false: clear_elementor_css_cache() is silently skipped. Update CLAUDE.md.

[ ] C4. method_exists(\Elementor\Plugin::$instance->files_manager, 'clear_cache') === true.

[ ] C5. class_exists('\Elementor\Core\Files\CSS\Post') === true.
         If false: CSS regeneration path is broken. Update CLAUDE.md.
```

---

### Part D — Functional Smoke Tests (10 minutes, requires browser)

```
[ ] D1. Sync from Elementor succeeds. (AFF → Sync button shows correct variable count.)

[ ] D2. Sync source is 'elementor_kit_meta' (shown in AFF sync log or browser console).
         If source is CSS file, meta path is broken — investigate A1–A7.

[ ] D3. Edit one variable value; save project file; reload from file.
         Saved value persists correctly.

[ ] D4. Commit to Elementor with one changed variable.
         Elementor's Variables Manager shows the updated value after page refresh.

[ ] D5. Load a front-end page. CSS var() reflects the committed value.
         (Inspect element → Computed styles → find --varname.)

[ ] D6. Add a NEW variable in AFF (not yet in Elementor); commit.
         New variable appears in Elementor's Variables Manager.

[ ] D7. Delete a variable in AFF that previously existed in Elementor; commit.
         Variable is removed from Elementor's Variables Manager.
```

---

### Part E — If Any Check Fails

1. Do NOT update Elementor on the production site.
2. Identify which AFF class/method is affected:
   - A1–A4: `AFF_CSS_Parser::read_from_kit_meta()` and `ajax_aff_commit_to_elementor()`
   - A5–A7: `AFF_CSS_Parser::extract_meta_value()`
   - B1–B5: `AFF_CSS_Parser::extract_v4_variables()` and `find_kit_css_file()`
   - C1–C5: `try_regenerate_elementor_kit_css()` and `clear_elementor_css_cache()`
   - D1–D7: End-to-end path
3. Create a feature branch: `fix/elementor-{version}-compat`
4. Fix the affected method and add a test case documenting the new structure.
5. Update `SYSTEM_PREFIXES` in `AFF_CSS_Parser` if new system prefixes appeared.
6. Update this checklist to reflect the new expected structure.
7. Run full regression before re-enabling the Elementor update.

---

## Appendix A — Test Priority Matrix

| Test Group | Priority | Run frequency |
|------------|----------|---------------|
| §2 AFF_CSS_Parser — parsing logic | Critical | Every commit touching parser |
| §3 AFF_Data_Store — CRUD + migration | Critical | Every commit touching data layer |
| §4.2 Path traversal (resolve_file) | Critical | Every commit |
| §4.5–4.6 Color math round-trip | High | Before any generate_children change |
| §4.7 Child naming conventions | High | Before any generate_children change |
| §5 AFF_Settings defaults | Medium | When adding/removing settings |
| §6 AFF_Usage_Scanner | Medium | When scanner logic changes |
| §12–14 Elementor structure | Critical | After every Elementor update |
| §15 Write-back round-trips | Critical | After any commit path change |
| §16 Security | Critical | Every commit touching AJAX handlers |
| §17 Regression checklist | Critical | After every Elementor update |

---

## Appendix B — Known Edge Cases to Watch

1. **Double-dashed user variable names:** A user who names a variable `--purple` in EV4
   will see `----purple` in the CSS file. `extract_v4_variables()` strips one `--`, giving
   `--purple` back to AFF. The commit path adds `--` again for CSS output. This must
   not be "fixed" without tracing the full round-trip.

2. **Empty Elementor install (no variables defined):** All sync paths must return
   empty results without error — not a fatal.

3. **Kit CSS file deleted (cache clear):** `find_kit_css_file()` returns `null`. AFF
   must fall through to `try_regenerate_elementor_kit_css()` rather than showing an
   error. The primary meta path makes this survivable.

4. **Elementor Pro deactivated while AFF active:** `aff_check_dependencies()` adds
   an admin notice. AFF loader never initializes. No fatal errors.

5. **Variable name collision on rename:** `save_color` endpoint checks
   `variable_name_exists()` before committing a rename. Ensure the `exclude_id`
   parameter is passed so a variable doesn't collide with itself.

6. **Backup prune race condition:** Two concurrent saves could create same-second
   filenames. `generate_backup_filename()` uses second-level granularity. The `copy_project`
   endpoint has a sleep-based retry guard — this is a known weak point.

7. **`sanitize_text_field()` on hex values:** WordPress's `sanitize_text_field()`
   strips HTML but preserves `#` and hex characters. Verify that `#f4c542` is not
   altered by sanitization in the commit path.
