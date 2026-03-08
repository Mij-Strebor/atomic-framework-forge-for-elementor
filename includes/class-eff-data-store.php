<?php
/**
 * EFF Data Store — Platform-Portable Data Management Layer
 *
 * Contains all business logic for variable/class/component CRUD and
 * JSON file persistence. This class has NO WordPress dependencies in
 * its core logic section — only in the clearly-marked WP adapter section
 * at the bottom.
 *
 * This separation is intentional: EFF may be ported to a standalone
 * Windows or Mac application in the future. The core logic must remain
 * portable; WordPress-specific code is isolated in adapter methods only.
 *
 * Storage format: .eff.json files in the WordPress uploads/eff/ directory
 * (or a user-specified path). The JSON format is platform-agnostic.
 *
 * @package ElementorFrameworkForge
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class EFF_Data_Store {

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
	 * @param string $file_path Absolute path to .eff.json file.
	 * @return bool True on success.
	 */
	public function load_from_file( string $file_path ): bool {
		if ( ! file_exists( $file_path ) || ! is_readable( $file_path ) ) {
			return false;
		}

		$json = file_get_contents( $file_path );
		if ( false === $json ) {
			return false;
		}

		$decoded = json_decode( $json, true );
		if ( JSON_ERROR_NONE !== json_last_error() || ! is_array( $decoded ) ) {
			return false;
		}

		$merged = $this->merge_with_defaults( $decoded );

		// Phase 2 migration: convert legacy `modified` boolean to `status` enum.
		// v1.0.0 files use `modified: true/false`; Phase 2 uses `status` enum.
		if ( isset( $merged['variables'] ) && is_array( $merged['variables'] ) ) {
			foreach ( $merged['variables'] as &$var ) {
				if ( ! isset( $var['status'] ) ) {
					$var['status'] = ( isset( $var['modified'] ) && true === $var['modified'] )
						? 'modified'
						: 'synced';
				}
				// Backfill other Phase 2 fields if absent.
				if ( ! isset( $var['original_value'] ) ) {
					$var['original_value'] = $var['value'] ?? '';
				}
				if ( ! array_key_exists( 'pending_rename_from', $var ) ) {
					$var['pending_rename_from'] = null;
				}
				if ( ! array_key_exists( 'parent_id', $var ) ) {
					$var['parent_id'] = null;
				}
				if ( ! isset( $var['format'] ) ) {
					$var['format'] = 'HEX';
				}
				if ( ! isset( $var['category_id'] ) ) {
					$var['category_id'] = '';
				}
				if ( ! isset( $var['order'] ) ) {
					$var['order'] = 0;
				}
			}
			unset( $var );
		}

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
	public function save_to_file( string $file_path ): bool {
		$json = json_encode( $this->data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES );

		if ( false === $json ) {
			return false;
		}

		if ( false === file_put_contents( $file_path, $json ) ) {
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
	 * @param array $parsed_vars Array of { name, value } pairs from EFF_CSS_Parser.
	 * @return int Number of new variables imported.
	 */
	public function import_parsed_variables( array $parsed_vars ): int {
		$imported = 0;

		foreach ( $parsed_vars as $parsed ) {
			if ( null === $this->find_variable_by_name( $parsed['name'] ) ) {
				$this->add_variable( array(
					'name'   => $parsed['name'],
					'value'  => $parsed['value'],
					'source' => 'elementor-parsed',
				) );
				$imported++;
			}
		}

		if ( $imported > 0 ) {
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
	public function get_variables(): array {
		return $this->data['variables'];
	}

	/**
	 * Add a new variable. Returns the generated ID.
	 *
	 * @param array $var Variable data (name, value, type, etc.).
	 * @return string UUID-style ID.
	 */
	public function add_variable( array $var ): string {
		$id        = $this->generate_id();
		$var['id'] = $id;
		$var       = array_merge( $this->variable_defaults(), $var );
		$var       = $this->set_timestamps( $var );

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
	public function update_variable( string $id, array $data ): bool {
		foreach ( $this->data['variables'] as &$var ) {
			if ( $var['id'] === $id ) {
				$data['updated_at'] = gmdate( 'c' );
				$data['modified']   = true;
				// Phase 2: update status to 'modified' unless caller explicitly sets it.
				if ( ! isset( $data['status'] ) ) {
					$data['status'] = 'modified';
				}
				$var         = array_merge( $var, $data );
				$this->dirty = true;
				return true;
			}
		}
		unset( $var );

		return false;
	}

	/**
	 * Delete a variable by ID.
	 *
	 * @param string $id Variable UUID.
	 * @return bool True if found and deleted.
	 */
	public function delete_variable( string $id ): bool {
		foreach ( $this->data['variables'] as $k => $var ) {
			if ( $var['id'] === $id ) {
				array_splice( $this->data['variables'], $k, 1 );
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
	public function find_variable_by_name( string $name ): ?array {
		foreach ( $this->data['variables'] as $var ) {
			if ( $var['name'] === $name ) {
				return $var;
			}
		}

		return null;
	}

	// -----------------------------------------------------------------------
	// CATEGORY CRUD (Phase 2 — Colors category management)
	// -----------------------------------------------------------------------

	/**
	 * Return the category list for Colors (or all subgroups).
	 *
	 * @return array[]
	 */
	public function get_categories(): array {
		return $this->data['config']['categories'] ?? array();
	}

	/**
	 * Add a new category. Returns the generated ID.
	 *
	 * @param array $cat Category data (name, locked, order).
	 * @return string UUID-style ID.
	 */
	public function add_category( array $cat ): string {
		$id        = $this->generate_id();
		$cat['id'] = $id;
		$cat       = array_merge( $this->category_defaults(), $cat );

		if ( ! isset( $this->data['config']['categories'] ) ) {
			$this->data['config']['categories'] = array();
		}

		$this->data['config']['categories'][] = $cat;
		$this->dirty                          = true;

		return $id;
	}

	/**
	 * Update an existing category by ID.
	 *
	 * @param string $id   Category UUID.
	 * @param array  $data Fields to update.
	 * @return bool True if found and updated.
	 */
	public function update_category( string $id, array $data ): bool {
		if ( ! isset( $this->data['config']['categories'] ) ) {
			return false;
		}

		foreach ( $this->data['config']['categories'] as &$cat ) {
			if ( $cat['id'] === $id ) {
				// Never allow changing the locked flag via this method.
				unset( $data['locked'] );
				$cat         = array_merge( $cat, $data );
				$this->dirty = true;
				return true;
			}
		}
		unset( $cat );

		return false;
	}

	/**
	 * Delete a category by ID.
	 *
	 * Refuses to delete locked categories (e.g., Uncategorized).
	 *
	 * @param string $id Category UUID.
	 * @return bool True if found and deleted.
	 */
	public function delete_category( string $id ): bool {
		if ( ! isset( $this->data['config']['categories'] ) ) {
			return false;
		}

		foreach ( $this->data['config']['categories'] as $k => $cat ) {
			if ( $cat['id'] === $id ) {
				if ( ! empty( $cat['locked'] ) ) {
					return false; // Cannot delete locked categories.
				}
				array_splice( $this->data['config']['categories'], $k, 1 );
				$this->dirty = true;
				return true;
			}
		}

		return false;
	}

	/**
	 * Reorder categories to match the given ordered list of IDs.
	 *
	 * @param string[] $ordered_ids Category IDs in the desired display order.
	 * @return bool True on success.
	 */
	public function reorder_categories( array $ordered_ids ): bool {
		if ( ! isset( $this->data['config']['categories'] ) ) {
			return false;
		}

		$index = array_flip( $ordered_ids );

		foreach ( $this->data['config']['categories'] as &$cat ) {
			if ( isset( $index[ $cat['id'] ] ) ) {
				$cat['order'] = $index[ $cat['id'] ];
			}
		}
		unset( $cat );

		usort(
			$this->data['config']['categories'],
			static function ( array $a, array $b ): int {
				return $a['order'] <=> $b['order'];
			}
		);

		$this->dirty = true;
		return true;
	}

	// -----------------------------------------------------------------------
	// CLASSES CRUD (v1 placeholder — Classes support arrives in EFF v3)
	// -----------------------------------------------------------------------

	/**
	 * @return array[]
	 */
	public function get_classes(): array {
		return $this->data['classes'];
	}

	// -----------------------------------------------------------------------
	// COMPONENTS CRUD (v1 placeholder — Components support arrives in EFF v4)
	// -----------------------------------------------------------------------

	/**
	 * @return array[]
	 */
	public function get_components(): array {
		return $this->data['components'];
	}

	// -----------------------------------------------------------------------
	// PROJECT CONFIG
	// -----------------------------------------------------------------------

	/**
	 * @return array
	 */
	public function get_config(): array {
		return $this->data['config'];
	}

	/**
	 * @param array $config Full config structure.
	 */
	public function set_config( array $config ): void {
		$this->data['config'] = $config;
		$this->dirty          = true;
	}

	// -----------------------------------------------------------------------
	// STATE ACCESSORS
	// -----------------------------------------------------------------------

	/** @return bool */
	public function is_dirty(): bool {
		return $this->dirty;
	}

	/** @return string|null */
	public function get_current_file(): ?string {
		return $this->current_file;
	}

	/** @return array */
	public function get_counts(): array {
		return array(
			'variables'  => count( $this->data['variables'] ),
			'classes'    => count( $this->data['classes'] ),
			'components' => count( $this->data['components'] ),
		);
	}

	/** @return array */
	public function get_all_data(): array {
		return $this->data;
	}

	// -----------------------------------------------------------------------
	// PRIVATE HELPERS (Platform-portable)
	// -----------------------------------------------------------------------

	/**
	 * Merge loaded data with the default structure so new keys are present.
	 *
	 * @param array $data Decoded JSON data.
	 * @return array
	 */
	private function merge_with_defaults( array $data ): array {
		return array_merge( $this->data, $data );
	}

	/**
	 * Generate a UUID v4-style identifier.
	 *
	 * @return string
	 */
	private function generate_id(): string {
		return sprintf(
			'%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
			mt_rand( 0, 0xffff ),
			mt_rand( 0, 0xffff ),
			mt_rand( 0, 0xffff ),
			mt_rand( 0, 0x0fff ) | 0x4000,
			mt_rand( 0, 0x3fff ) | 0x8000,
			mt_rand( 0, 0xffff ),
			mt_rand( 0, 0xffff ),
			mt_rand( 0, 0xffff )
		);
	}

	/**
	 * Set created_at / updated_at timestamps on a data item.
	 *
	 * @param array $item
	 * @return array
	 */
	private function set_timestamps( array $item ): array {
		$now              = gmdate( 'c' );
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
	private function variable_defaults(): array {
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
	private function category_defaults(): array {
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
	 * Return the absolute path to the EFF file storage directory,
	 * creating it if it does not exist.
	 *
	 * @return string Absolute path with trailing slash.
	 */
	public static function get_wp_storage_dir(): string {
		$upload_dir = wp_upload_dir();
		$dir        = $upload_dir['basedir'] . '/eff/';
		wp_mkdir_p( $dir );
		return $dir;
	}

	/**
	 * Sanitize a filename and enforce the .eff.json extension.
	 *
	 * @param string $filename Raw input filename.
	 * @return string Safe filename with .eff.json extension.
	 */
	public static function sanitize_filename( string $filename ): string {
		$filename = sanitize_file_name( $filename );

		// Strip existing extension and enforce .eff.json.
		$base = pathinfo( $filename, PATHINFO_FILENAME );
		// Handle double-extension like "my-project.eff" → "my-project".
		$base = preg_replace( '/\.eff$/', '', $base );

		return $base . '.eff.json';
	}

	// -----------------------------------------------------------------------
	// BASELINE ADAPTER METHODS — Elementor baseline snapshot storage.
	// Baseline is stored in wp_options, keyed by a hash of the filename.
	// -----------------------------------------------------------------------

	/**
	 * Retrieve the Elementor baseline snapshot for a given .eff.json file.
	 *
	 * The baseline is a flat array of { name, value } pairs representing
	 * Elementor's variable values at the time of the last Sync.
	 *
	 * @param string $filename Sanitized .eff.json filename (e.g., 'my-project.eff.json').
	 * @return array Baseline variable array, or empty array if not yet set.
	 */
	public static function get_baseline( string $filename ): array {
		$key  = 'eff_elementor_baseline_' . md5( $filename );
		$data = get_option( $key, array() );
		return is_array( $data ) ? $data : array();
	}

	/**
	 * Save the Elementor baseline snapshot for a given .eff.json file.
	 *
	 * @param string  $filename  Sanitized .eff.json filename.
	 * @param array   $variables Array of { name, value } pairs from Elementor.
	 */
	public static function save_baseline( string $filename, array $variables ): void {
		$key = 'eff_elementor_baseline_' . md5( $filename );
		update_option( $key, $variables, false ); // autoload=false: only needed on demand.
	}

	/**
	 * Delete the Elementor baseline snapshot for a given .eff.json file.
	 *
	 * @param string $filename Sanitized .eff.json filename.
	 */
	public static function delete_baseline( string $filename ): void {
		$key = 'eff_elementor_baseline_' . md5( $filename );
		delete_option( $key );
	}
}
