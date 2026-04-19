<?php

/**
 * AFF Data Store — Platform-Portable Data Management Layer
 *
 * Contains all business logic for variable/class/component CRUD and
 * JSON file persistence. This class has NO WordPress dependencies in
 * its core logic section — only in the clearly-marked WP adapter section
 * at the bottom.
 *
 * This separation is intentional: AFF may be ported to a standalone
 * Windows or Mac application in the future. The core logic must remain
 * portable; WordPress-specific code is isolated in adapter methods only.
 *
 * Storage format: .aff.json files in the WordPress uploads/aff/ directory
 * (or a user-specified path). The JSON format is platform-agnostic.
 *
 * @package AtomicFrameworkForge
 */

if (! defined('ABSPATH')) {
	exit;
}

class AFF_Data_Store
{

	/**
	 * The in-memory project data structure.
	 *
	 * @var array
	 */
	private array $data = array(
		'version'    => '1.0',
		'config'     => array(),
		'variables'  => array(),
		'classes'    => array(),
		'components' => array(),
		'metadata'   => array(),
	);

	/**
	 * Whether data has unsaved changes.
	 *
	 * @var bool
	 */
	private bool $dirty = false;

	/**
	 * Currently loaded file path.
	 *
	 * @var string|null
	 */
	private ?string $current_file = null;

	// -----------------------------------------------------------------------
	// CORE LOGIC — Platform-portable. No WordPress dependencies below this
	// line until the "WP ADAPTER METHODS" section.
	// -----------------------------------------------------------------------

	/**
	 * Load project data from a JSON file.
	 *
	 * @param string $file_path Absolute path to .aff.json file.
	 * @return bool True on success.
	 */
	public function load_from_file(string $file_path): bool
	{
		if (! file_exists($file_path) || ! is_readable($file_path)) {
			return false;
		}

		$json = file_get_contents($file_path);
		if (false === $json) {
			return false;
		}

		$decoded = json_decode($json, true);
		if (JSON_ERROR_NONE !== json_last_error() || ! is_array($decoded)) {
			return false;
		}

		$merged = $this->merge_with_defaults($decoded);
		$this->migrate_data($merged);

		$this->data         = $merged;
		$this->current_file = $file_path;
		$this->dirty        = false;

		return true;
	}

	/**
	 * Save current data to a JSON file.
	 *
	 * @param string $file_path Absolute path for output file.
	 * @return bool True on success.
	 */
	public function save_to_file(string $file_path): bool
	{
		$json = json_encode($this->data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

		if (false === $json) {
			return false;
		}

		if (false === file_put_contents($file_path, $json)) {
			return false;
		}

		$this->current_file = $file_path;
		$this->dirty        = false;

		return true;
	}

	/**
	 * Import variables parsed from Elementor CSS (sync operation).
	 *
	 * New variables (by name) are added. Existing variables are NOT
	 * overwritten, preserving any manual edits the developer has made.
	 *
	 * @param array $parsed_vars Array of { name, value } pairs from AFF_CSS_Parser.
	 * @return int Number of new variables imported.
	 */
	public function import_parsed_variables(array $parsed_vars): int
	{
		$imported = 0;

		foreach ($parsed_vars as $parsed) {
			if (null === $this->find_variable_by_name($parsed['name'])) {
				$this->add_variable(array(
					'name'   => $parsed['name'],
					'value'  => $parsed['value'],
					'source' => 'elementor-parsed',
				));
				$imported++;
			}
		}

		if ($imported > 0) {
			$this->dirty = true;
		}

		return $imported;
	}

	// -----------------------------------------------------------------------
	// VARIABLES CRUD
	// -----------------------------------------------------------------------

	/**
	 * @return array[]
	 */
	public function get_variables(): array
	{
		return $this->data['variables'];
	}

	/**
	 * Add a new variable. Returns the generated ID.
	 *
	 * @param array $var Variable data (name, value, type, etc.).
	 * @return string UUID-style ID.
	 */
	public function add_variable(array $var): string
	{
		$id        = $this->generate_id();
		$var['id'] = $id;
		$var       = array_merge($this->variable_defaults(), $var);
		$var       = $this->set_timestamps($var);

		$this->data['variables'][] = $var;
		$this->dirty               = true;

		return $id;
	}

	/**
	 * Update an existing variable by ID.
	 *
	 * @param string $id   Variable UUID.
	 * @param array  $data Fields to update.
	 * @return bool True if found and updated.
	 */
	public function update_variable(string $id, array $data): bool
	{
		$k = $this->find_item_key($this->data['variables'], 'id', $id);
		if ($k === null) {
			return false;
		}

		$data['updated_at'] = gmdate('c');
		$data['modified']   = true;
		// Phase 2: update status to 'modified' unless caller explicitly sets it.
		if (! isset($data['status'])) {
			$data['status'] = 'modified';
		}
		$this->data['variables'][$k] = array_merge($this->data['variables'][$k], $data);
		$this->dirty = true;

		return true;
	}

	/**
	 * Delete a variable by ID, optionally also deleting its children.
	 *
	 * @param string $id              Variable UUID.
	 * @param bool   $delete_children If true, also remove variables where parent_id === $id.
	 * @return bool True if found and deleted.
	 */
	public function delete_variable(string $id, bool $delete_children = false): bool
	{
		$k = $this->find_item_key($this->data['variables'], 'id', $id);
		if ($k === null) {
			return false;
		}

		array_splice($this->data['variables'], $k, 1);
		$this->dirty = true;

		if ($delete_children) {
			$this->data['variables'] = array_values(array_filter(
				$this->data['variables'],
				static function (array $v) use ($id): bool {
					return ! isset($v['parent_id']) || $v['parent_id'] !== $id;
				}
			));
		}

		return true;
	}

	/**
	 * Delete a variable by name only if it has an empty ID.
	 *
	 * Used to remove the placeholder empty-id copy that aff_save_file writes
	 * for synced variables, before add_variable creates the real UUID copy.
	 *
	 * @param string $name CSS custom property name (e.g., '--primary').
	 * @return bool True if a matching empty-id variable was found and removed.
	 */
	public function delete_variable_by_name_if_empty_id(string $name): bool
	{
		foreach ($this->data['variables'] as $k => $var) {
			if (($var['name'] ?? '') === $name && empty($var['id'])) {
				array_splice($this->data['variables'], $k, 1);
				$this->dirty = true;
				return true;
			}
		}
		return false;
	}

	/**
	 * Find a variable by its CSS property name (e.g., '--primary').
	 *
	 * @param string $name CSS custom property name.
	 * @return array|null Variable array or null if not found.
	 */
	public function find_variable_by_name(string $name): ?array
	{
		$k = $this->find_item_key($this->data['variables'], 'name', $name);
		return $k !== null ? $this->data['variables'][$k] : null;
	}

	// -----------------------------------------------------------------------
	// CATEGORY CRUD (Phase 2 — Colors category management)
	// -----------------------------------------------------------------------

	/**
	 * Return the category list.
	 *
	 * @return array[]
	 */
	public function get_categories(): array
	{
		return $this->get_categories_for_subgroup('Colors');
	}

	/**
	 * Add a new category. Returns the generated ID.
	 *
	 * @param array $cat Category data (name, locked, order).
	 * @return string UUID-style ID.
	 */
	public function add_category(array $cat): string
	{
		return $this->add_category_for_subgroup('Colors', $cat);
	}

	/**
	 * Update an existing category by ID.
	 *
	 * @param string $id   Category UUID.
	 * @param array  $data Fields to update.
	 * @return bool True if found and updated.
	 */
	public function update_category(string $id, array $data): bool
	{
		return $this->update_category_for_subgroup('Colors', $id, $data);
	}

	/**
	 * Delete a category by ID.
	 *
	 * @param string $id Category UUID.
	 * @return bool True if found and deleted.
	 */
	public function delete_category(string $id): bool
	{
		return $this->delete_category_for_subgroup('Colors', $id);
	}

	/**
	 * Reorder categories to match the given ordered list of IDs.
	 *
	 * @param string[] $ordered_ids Category IDs in the desired display order.
	 * @return bool True on success.
	 */
	public function reorder_categories(array $ordered_ids): bool
	{
		return $this->reorder_categories_for_subgroup('Colors', $ordered_ids);
	}

	// -----------------------------------------------------------------------
	// CATEGORY CRUD — Subgroup-aware (Fonts, Numbers)
	//
	// These five methods mirror the Colors CRUD above but route to the
	// correct config key via subgroup_to_cat_key(). Pass the subgroup name
	// ('Colors' | 'Fonts' | 'Numbers') from the AJAX layer.
	// -----------------------------------------------------------------------

	/**
	 * Map a subgroup name to its config key in $this->data['config'].
	 *
	 * 'Colors' maps to the legacy 'categories' key for backward compatibility.
	 * Fonts and Numbers use dedicated keys added in Phase 3.
	 *
	 * @param string $subgroup 'Colors' | 'Fonts' | 'Numbers'
	 * @return string Config key, e.g. 'categories', 'fontCategories'.
	 */
	private function subgroup_to_cat_key(string $subgroup): string
	{
		$map = array(
			'Colors'  => 'categories',
			'Fonts'   => 'fontCategories',
			'Numbers' => 'numberCategories',
		);
		return $map[$subgroup] ?? 'categories';
	}

	/**
	 * Return the category list for a subgroup.
	 *
	 * @param string $subgroup Subgroup name ('Colors'|'Fonts'|'Numbers').
	 * @return array[]
	 */
	public function get_categories_for_subgroup(string $subgroup): array
	{
		$key = $this->subgroup_to_cat_key($subgroup);
		return $this->data['config'][$key] ?? array();
	}

	/**
	 * Add a new category for a subgroup. Returns the generated ID.
	 *
	 * @param string $subgroup Subgroup name.
	 * @param array  $cat      Category data (name, locked, order).
	 * @return string UUID-style ID.
	 */
	public function add_category_for_subgroup(string $subgroup, array $cat): string
	{
		$key       = $this->subgroup_to_cat_key($subgroup);
		$id        = $this->generate_id();
		$cat['id'] = $id;
		$cat       = array_merge($this->category_defaults(), $cat);

		if (! isset($this->data['config'][$key])) {
			$this->data['config'][$key] = array();
		}

		$this->data['config'][$key][] = $cat;
		$this->dirty                    = true;

		return $id;
	}

	/**
	 * Update an existing category by ID for a subgroup.
	 *
	 * @param string $subgroup Subgroup name.
	 * @param string $id       Category UUID.
	 * @param array  $data     Fields to update.
	 * @return bool True if found and updated.
	 */
	public function update_category_for_subgroup(string $subgroup, string $id, array $data): bool
	{
		$key = $this->subgroup_to_cat_key($subgroup);

		if (! isset($this->data['config'][$key])) {
			return false;
		}

		$k = $this->find_item_key($this->data['config'][$key], 'id', $id);
		if ($k === null) {
			return false;
		}

		unset($data['locked']); // Never allow changing the locked flag.
		$this->data['config'][$key][$k] = array_merge($this->data['config'][$key][$k], $data);
		$this->dirty = true;

		return true;
	}

	/**
	 * Delete a category by ID for a subgroup.
	 *
	 * Refuses to delete locked categories (e.g., Uncategorized).
	 *
	 * @param string $subgroup Subgroup name.
	 * @param string $id       Category UUID.
	 * @return bool True if found and deleted.
	 */
	public function delete_category_for_subgroup(string $subgroup, string $id): bool
	{
		$key = $this->subgroup_to_cat_key($subgroup);

		if (! isset($this->data['config'][$key])) {
			return false;
		}

		$k = $this->find_item_key($this->data['config'][$key], 'id', $id);
		if ($k === null) {
			return false;
		}

		if (! empty($this->data['config'][$key][$k]['locked'])) {
			return false; // Cannot delete locked categories.
		}

		array_splice($this->data['config'][$key], $k, 1);
		$this->dirty = true;

		return true;
	}

	/**
	 * Reorder categories for a subgroup to match the given ordered list of IDs.
	 *
	 * @param string   $subgroup    Subgroup name.
	 * @param string[] $ordered_ids Category IDs in the desired display order.
	 * @return bool True on success.
	 */
	public function reorder_categories_for_subgroup(string $subgroup, array $ordered_ids): bool
	{
		$key = $this->subgroup_to_cat_key($subgroup);

		if (! isset($this->data['config'][$key])) {
			return false;
		}

		$index = array_flip($ordered_ids);

		foreach ($this->data['config'][$key] as &$cat) {
			if (isset($index[$cat['id']])) {
				$cat['order'] = $index[$cat['id']];
			}
		}
		unset($cat);

		usort(
			$this->data['config'][$key],
			static function (array $a, array $b): int {
				return $a['order'] <=> $b['order'];
			}
		);

		$this->dirty = true;
		return true;
	}

	// -----------------------------------------------------------------------
	// CLASSES CRUD (v1 placeholder — Classes support arrives in AFF v3)
	// -----------------------------------------------------------------------

	/**
	 * @return array[]
	 */
	public function get_classes(): array
	{
		return $this->data['classes'];
	}

	// -----------------------------------------------------------------------
	// COMPONENTS CRUD (v1 placeholder — Components support arrives in AFF v4)
	// -----------------------------------------------------------------------

	/**
	 * @return array[]
	 */
	public function get_components(): array
	{
		return $this->data['components'];
	}

	// -----------------------------------------------------------------------
	// PROJECT CONFIG
	// -----------------------------------------------------------------------

	/**
	 * @return array
	 */
	public function get_config(): array
	{
		return $this->data['config'];
	}

	/**
	 * @param array $config Full config structure.
	 */
	public function set_config(array $config): void
	{
		$this->data['config'] = $config;
		$this->dirty          = true;
	}

	// -----------------------------------------------------------------------
	// STATE ACCESSORS
	// -----------------------------------------------------------------------

	/** @return bool */
	public function is_dirty(): bool
	{
		return $this->dirty;
	}

	/** @return string|null */
	public function get_current_file(): ?string
	{
		return $this->current_file;
	}

	/** @return array */
	public function get_counts(): array
	{
		return array(
			'variables'  => count($this->data['variables']),
			'classes'    => count($this->data['classes']),
			'components' => count($this->data['components']),
		);
	}

	/** @return array */
	public function get_all_data(): array
	{
		return $this->data;
	}

	// -----------------------------------------------------------------------
	// PRIVATE HELPERS (Platform-portable)
	// -----------------------------------------------------------------------

	/**
	 * Return the numeric key of the first item where $item[$field] === $value, or null.
	 *
	 * Eliminates the repetitive by-reference foreach pattern used throughout the
	 * CRUD methods and removes the easy-to-forget unset($var) after such loops.
	 *
	 * @param array  $items Array to search.
	 * @param string $field Field name to match on.
	 * @param string $value Value to match.
	 * @return int|null Array key, or null if not found.
	 */
	private function find_item_key(array $items, string $field, string $value): ?int
	{
		foreach ($items as $k => $item) {
			if (isset($item[$field]) && $item[$field] === $value) {
				return $k;
			}
		}
		return null;
	}

	// -----------------------------------------------------------------------
	// DIAGNOSTICS & DEDUPLICATION
	// -----------------------------------------------------------------------

	/**
	 * Scan for duplicate variables (by name) and duplicate categories (by name
	 * within each subgroup). Returns a report; makes no changes.
	 *
	 * @return array{
	 *   duplicate_variable_names: string[],
	 *   duplicate_categories:     array{ subgroup: string, name: string }[],
	 *   variable_count:           int,
	 *   category_counts:          array{ Colors: int, Fonts: int, Numbers: int },
	 * }
	 */
	public function get_diagnostics(): array
	{
		$dup_var_names = array();
		$seen_names    = array();

		foreach ($this->data['variables'] as $var) {
			$lc = strtolower($var['name'] ?? '');
			if ('' === $lc) {
				continue;
			}
			if (isset($seen_names[$lc])) {
				$dup_var_names[] = $var['name'];
			} else {
				$seen_names[$lc] = true;
			}
		}

		$dup_cats   = array();
		$cat_counts = array();
		foreach (array('Colors', 'Fonts', 'Numbers') as $sg) {
			$cats              = $this->get_categories_for_subgroup($sg);
			$cat_counts[$sg] = count($cats);
			$seen_cat          = array();
			foreach ($cats as $cat) {
				$lc = strtolower($cat['name'] ?? '');
				if ('' === $lc) {
					continue;
				}
				if (isset($seen_cat[$lc])) {
					$dup_cats[] = array('subgroup' => $sg, 'name' => $cat['name']);
				} else {
					$seen_cat[$lc] = true;
				}
			}
		}

		return array(
			'duplicate_variable_names' => array_unique($dup_var_names),
			'duplicate_categories'     => $dup_cats,
			'variable_count'           => count($this->data['variables']),
			'category_counts'          => $cat_counts,
		);
	}

	/**
	 * Remove duplicate variables (keep first occurrence by array order) and
	 * duplicate categories (keep first occurrence, reassign affected variables).
	 *
	 * Marks the store dirty if anything was removed. Does NOT save to disk —
	 * caller must call save_to_file() after.
	 *
	 * @return array{ removed_variables: int, removed_categories: int }
	 */
	public function deduplicate(): array
	{
		$removed_vars = 0;
		$removed_cats = 0;

		// Variables: keep first occurrence of each name (case-insensitive).
		$seen     = array();
		$new_vars = array();
		foreach ($this->data['variables'] as $var) {
			$lc = strtolower($var['name'] ?? '');
			if ('' === $lc || ! isset($seen[$lc])) {
				$seen[$lc] = true;
				$new_vars[]  = $var;
			} else {
				$removed_vars++;
			}
		}
		$this->data['variables'] = array_values($new_vars);

		// Categories: per subgroup, keep first occurrence of each name.
		foreach (array('Colors', 'Fonts', 'Numbers') as $sg) {
			$key  = $this->subgroup_to_cat_key($sg);
			$cats = $this->data['config'][$key] ?? array();

			$seen_cat = array();
			$kept     = array();
			$remap    = array(); // removed_cat_id => kept_cat_id

			foreach ($cats as $cat) {
				$lc = strtolower($cat['name'] ?? '');
				if (! isset($seen_cat[$lc])) {
					$seen_cat[$lc] = $cat['id'];
					$kept[]          = $cat;
				} else {
					$remap[$cat['id']] = $seen_cat[$lc];
					$removed_cats++;
				}
			}

			$this->data['config'][$key] = array_values($kept);

			// Reassign variables whose category_id pointed to a removed category.
			if (! empty($remap)) {
				$id_to_name = array();
				foreach ($kept as $kcat) {
					$id_to_name[$kcat['id']] = $kcat['name'];
				}

				foreach ($this->data['variables'] as &$var) {
					if (($var['subgroup'] ?? '') !== $sg) {
						continue;
					}
					$cid = $var['category_id'] ?? '';
					if (isset($remap[$cid])) {
						$new_id             = $remap[$cid];
						$var['category_id'] = $new_id;
						$var['category']    = $id_to_name[$new_id] ?? $var['category'];
					}
				}
				unset($var);
			}
		}

		if ($removed_vars > 0 || $removed_cats > 0) {
			$this->dirty = true;
		}

		return array(
			'removed_variables'  => $removed_vars,
			'removed_categories' => $removed_cats,
		);
	}

	// -----------------------------------------------------------------------

	/**
	 * Upgrade legacy data structures to the current schema in-place.
	 *
	 * Converts v1.0.0 boolean `modified` field to the Phase 2 `status` enum
	 * and backfills any other Phase 2 fields absent from older files.
	 * Idempotent — safe to call on already-migrated data.
	 *
	 * @param array $data Decoded project data (modified in-place).
	 */
	private function migrate_data(array &$data): void
	{
		if (! isset($data['variables']) || ! is_array($data['variables'])) {
			return;
		}
		foreach ($data['variables'] as &$var) {
			if (! isset($var['status'])) {
				$var['status'] = (isset($var['modified']) && true === $var['modified'])
					? 'modified'
					: 'synced';
			}
			if (! isset($var['original_value'])) {
				$var['original_value']      = $var['value'] ?? '';
			}
			if (! array_key_exists('pending_rename_from', $var)) {
				$var['pending_rename_from'] = null;
			}
			if (! array_key_exists('parent_id', $var)) {
				$var['parent_id']            = null;
			}
			if (! isset($var['format'])) {
				$var['format']               = 'HEX';
			}
			if (! isset($var['category_id'])) {
				$var['category_id']          = '';
			}
			if (! isset($var['order'])) {
				$var['order']                = 0;
			}
		}
		unset($var);
	}

	/**
	 * Merge loaded data with the default structure so new keys are present.
	 *
	 * @param array $data Decoded JSON data.
	 * @return array
	 */
	private function merge_with_defaults(array $data): array
	{
		return array_merge($this->data, $data);
	}

	/**
	 * Generate a UUID v4-style identifier.
	 *
	 * @return string
	 */
	private function generate_id(): string
	{
		$bytes = random_bytes(16);
		$bytes[6] = chr((ord($bytes[6]) & 0x0f) | 0x40); // version 4
		$bytes[8] = chr((ord($bytes[8]) & 0x3f) | 0x80); // variant bits
		return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($bytes), 4));
	}

	/**
	 * Set created_at / updated_at timestamps on a data item.
	 *
	 * @param array $item
	 * @return array
	 */
	private function set_timestamps(array $item): array
	{
		$now              = gmdate('c');
		$item['created_at'] = $item['created_at'] ?? $now;
		$item['updated_at'] = $now;
		return $item;
	}

	/**
	 * Return the default variable data model.
	 *
	 * Includes Phase 2 fields. The legacy `modified` boolean is kept for
	 * backward compatibility when reading v1.0.0 files; it is superseded
	 * by the `status` enum (see load_from_file() migration).
	 *
	 * @return array
	 */
	private function variable_defaults(): array
	{
		return array(
			'id'                  => '',
			'name'                => '',
			'value'               => '',
			'original_value'      => '',
			'pending_rename_from' => null,
			'parent_id'           => null,
			'type'                => 'color',
			'format'              => 'HEX',
			'group'               => 'Variables',
			'subgroup'            => 'Colors',
			'category'            => '',
			'category_id'         => '',
			'order'               => 0,
			'source'              => 'user-defined',
			'status'              => 'synced',
			'modified'            => false,
			'created_at'          => '',
			'updated_at'          => '',
		);
	}

	/**
	 * Return the default category data model.
	 *
	 * @return array
	 */
	private function category_defaults(): array
	{
		return array(
			'id'     => '',
			'name'   => '',
			'order'  => 0,
			'locked' => false,
		);
	}

	// -----------------------------------------------------------------------
	// WP ADAPTER METHODS — WordPress-specific. Isolate here for portability.
	// When porting to Windows/Mac, replace only these methods.
	// -----------------------------------------------------------------------

	/**
	 * Return the absolute path to the AFF file storage directory,
	 * creating it if it does not exist.
	 *
	 * @return string Absolute path with trailing slash.
	 */
	public static function get_wp_storage_dir(): string
	{
		$upload_dir = wp_upload_dir();
		$dir        = $upload_dir['basedir'] . '/aff/';
		wp_mkdir_p($dir);
		return $dir;
	}

	/**
	 * Sanitize a filename and enforce the .aff.json extension.
	 *
	 * @param string $filename Raw input filename.
	 * @return string Safe filename with .aff.json extension.
	 */
	public static function sanitize_filename(string $filename): string
	{
		$filename = sanitize_file_name($filename);

		// Strip existing extension and enforce .aff.json.
		$base = pathinfo($filename, PATHINFO_FILENAME);
		// Handle double-extension like "my-project.aff" → "my-project".
		$base = preg_replace('/(\.aff)+$/', '', $base);

		return $base . '.aff.json';
	}

	// -----------------------------------------------------------------------
	// BASELINE ADAPTER METHODS — Elementor baseline snapshot storage.
	// Baseline is stored in wp_options, keyed by a hash of the filename.
	// -----------------------------------------------------------------------

	/**
	 * Retrieve the Elementor baseline snapshot for a given .aff.json file.
	 *
	 * The baseline is a flat array of { name, value } pairs representing
	 * Elementor's variable values at the time of the last Sync.
	 *
	 * @param string $filename Sanitized .aff.json filename (e.g., 'my-project.aff.json').
	 * @return array Baseline variable array, or empty array if not yet set.
	 */
	public static function get_baseline(string $filename): array
	{
		$key  = 'aff_elementor_baseline_' . md5($filename);
		$data = get_option($key, array());
		return is_array($data) ? $data : array();
	}

	/**
	 * Save the Elementor baseline snapshot for a given .aff.json file.
	 *
	 * @param string  $filename  Sanitized .aff.json filename.
	 * @param array   $variables Array of { name, value } pairs from Elementor.
	 */
	public static function save_baseline(string $filename, array $variables): void
	{
		$key = 'aff_elementor_baseline_' . md5($filename);
		update_option($key, $variables, false); // autoload=false: only needed on demand.
	}

	/**
	 * Delete the Elementor baseline snapshot for a given .aff.json file.
	 *
	 * @param string $filename Sanitized .aff.json filename.
	 */
	public static function delete_baseline(string $filename): void
	{
		$key = 'aff_elementor_baseline_' . md5($filename);
		delete_option($key);
	}

	/**
	 * Return a fresh empty project data structure.
	 *
	 * @param string $name Human-readable project name.
	 * @return array
	 */
	public function new_project(string $name): array
	{
		return array(
			'version'    => '1.0',
			'name'       => $name,
			'config'     => array(),
			'variables'  => array(),
			'classes'    => array(),
			'components' => array(),
			'metadata'   => array(),
		);
	}

	// -----------------------------------------------------------------------
	// VERSIONED BACKUP METHODS — Subdirectory-per-project storage.
	// -----------------------------------------------------------------------

	/**
	 * Lowercase kebab slug. "My Demo" → "my-demo".
	 *
	 * @param string $name Human-readable project name.
	 * @return string Slug.
	 */
	public static function sanitize_project_slug(string $name): string
	{
		$name = mb_strtolower($name);
		$name = preg_replace('/[^a-z0-9]+/', '-', $name);
		return trim($name, '-');
	}

	/**
	 * Return (and create) the project subdirectory.
	 *
	 * @param string $project_slug Slug from sanitize_project_slug().
	 * @return string Absolute path with trailing slash.
	 */
	public static function get_project_dir(string $project_slug): string
	{
		$dir = self::get_wp_storage_dir() . $project_slug . '/';
		if (! is_dir($dir)) {
			wp_mkdir_p($dir);
		}
		return $dir;
	}

	/**
	 * Generate a timestamped backup filename.
	 *
	 * @param string $project_slug Slug.
	 * @return string e.g. "my-demo_2026-03-18_14-30-00.aff.json"
	 */
	public static function generate_backup_filename(string $project_slug): string
	{
		return $project_slug . '_' . gmdate('Y-m-d_H-i-s') . '.aff.json';
	}

	/**
	 * List all projects from subdirectories, sorted newest-first.
	 *
	 * @param string $base_dir Absolute path with trailing slash.
	 * @return array[] Each item: { slug, name, backup_count, latest_modified }.
	 */
	public static function list_projects(string $base_dir): array
	{
		$dirs = glob($base_dir . '*/', GLOB_ONLYDIR) ?: array();
		$list = array();

		foreach ($dirs as $d) {
			$slug    = basename($d);
			$backups = self::list_project_backups($base_dir, $slug);
			if (empty($backups)) {
				continue;
			}
			$latest  = $backups[0];
			$list[]  = array(
				'slug'            => $slug,
				'name'            => $latest['name'] ?: $slug,
				'backup_count'    => count($backups),
				'latest_modified' => $latest['modified'],
			);
		}

		// Sort newest-first by latest backup modification time. The comparator
		// re-calls glob() + filemtime() on both directories for every comparison.
		// A comparison-based sort makes O(N log N) filesystem calls — ~34 glob() calls
		// for 10 projects, ~280 for 50. Tech debt A-06: add a raw filemtime integer to
		// each $list entry during the foreach above and sort on that field instead.
		usort($list, function ($a, $b) use ($base_dir) {
			$fa = $base_dir . $a['slug'] . '/';
			$fb = $base_dir . $b['slug'] . '/';
			$ta = ($files_a = glob($fa . '*.aff.json')) ? max(array_map('filemtime', $files_a)) : 0;
			$tb = ($files_b = glob($fb . '*.aff.json')) ? max(array_map('filemtime', $files_b)) : 0;
			return $tb - $ta;
		});

		return $list;
	}

	/**
	 * List backups for one project, newest first.
	 *
	 * @param string $base_dir    Absolute path with trailing slash.
	 * @param string $project_slug Slug.
	 * @return array[] Each item: { filename (relative: slug/file.aff.json), name, modified }.
	 */
	public static function list_project_backups(string $base_dir, string $project_slug): array
	{
		$dir   = $base_dir . $project_slug . '/';
		$files = glob($dir . '*.aff.json') ?: array();
		usort($files, function ($a, $b) {
			return filemtime($b) - filemtime($a);
		});

		$list = array();
		foreach ($files as $f) {
			$raw    = json_decode(file_get_contents($f), true) ?: array(); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents
			$list[] = array(
				'filename'       => $project_slug . '/' . basename($f),
				'name'           => isset($raw['name']) ? preg_replace('/(\.aff)+(?:\.json)?$/i', '', $raw['name']) : $project_slug,
				'modified'       => date('M j, g:i a', filemtime($f)), // phpcs:ignore WordPress.DateTime.RestrictedFunctions.date_date
				'variable_count' => isset($raw['variables']) && is_array($raw['variables']) ? count($raw['variables']) : 0,
			);
		}

		return $list;
	}

	/**
	 * Delete oldest backups until count <= $max.
	 *
	 * @param string $project_dir Absolute path to project subdirectory (with trailing slash).
	 * @param int    $max         Maximum number of backups to keep.
	 */
	public static function prune_backups(string $project_dir, int $max): void
	{
		if ($max < 1) {
			return;
		}
		$files = glob($project_dir . '*.aff.json') ?: array();
		if (count($files) <= $max) {
			return;
		}
		usort($files, function ($a, $b) {
			return filemtime($a) - filemtime($b);
		}); // oldest first
		$to_delete = array_slice($files, 0, count($files) - $max);
		foreach ($to_delete as $f) {
			wp_delete_file($f);
		}
	}
}
