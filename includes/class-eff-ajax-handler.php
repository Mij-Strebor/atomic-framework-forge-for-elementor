<?php
/**
 * EFF Ajax Handler — AJAX Endpoint Registration & Processing
 *
 * All AJAX endpoints are registered here, each protected with nonce
 * verification and capability checks before any processing occurs.
 *
 * @package ElementorFrameworkForge
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class EFF_Ajax_Handler {

	const NONCE_ACTION = 'eff_admin_nonce';

	/**
	 * Register all wp_ajax_{action} hooks.
	 */
	public function register_handlers(): void {
		$actions = array(
			// v1.0.0 endpoints
			'eff_save_file',
			'eff_load_file',
			'eff_sync_from_elementor',
			'eff_save_user_theme',
			'eff_get_config',
			'eff_save_config',
			'eff_save_settings',
			'eff_get_settings',
			'eff_get_usage_counts',
			// Phase 2 — Colors endpoints
			'eff_save_category',
			'eff_delete_category',
			'eff_reorder_categories',
			'eff_save_color',
			'eff_delete_color',
			'eff_generate_children',
			'eff_save_baseline',
			'eff_get_baseline',
			'eff_commit_to_elementor',
		);

		foreach ( $actions as $action ) {
			add_action( 'wp_ajax_' . $action, array( $this, 'ajax_' . $action ) );
		}
	}

	// -----------------------------------------------------------------------
	// ENDPOINT: Save file
	// -----------------------------------------------------------------------

	public function ajax_eff_save_file(): void {
		$this->verify_request();

		$filename = isset( $_POST['filename'] )
			? sanitize_text_field( wp_unslash( $_POST['filename'] ) )
			: '';

		$data_raw = isset( $_POST['data'] ) ? wp_unslash( $_POST['data'] ) : '';

		if ( empty( $filename ) ) {
			wp_send_json_error( array( 'message' => __( 'Filename is required.', 'elementor-framework-forge' ) ) );
		}

		$decoded = json_decode( $data_raw, true );
		if ( JSON_ERROR_NONE !== json_last_error() ) {
			wp_send_json_error( array( 'message' => __( 'Invalid data format.', 'elementor-framework-forge' ) ) );
		}

		$filename = EFF_Data_Store::sanitize_filename( $filename );
		$dir      = EFF_Data_Store::get_wp_storage_dir();
		$file     = $dir . $filename;

		$json = wp_json_encode( $decoded, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES );
		if ( false === file_put_contents( $file, $json ) ) {
			wp_send_json_error( array( 'message' => __( 'Could not write file. Check directory permissions.', 'elementor-framework-forge' ) ) );
		}

		wp_send_json_success( array(
			'message'  => __( 'File saved successfully.', 'elementor-framework-forge' ),
			'filename' => $filename,
		) );
	}

	// -----------------------------------------------------------------------
	// ENDPOINT: Load file
	// -----------------------------------------------------------------------

	public function ajax_eff_load_file(): void {
		$this->verify_request();

		$filename = isset( $_POST['filename'] )
			? sanitize_text_field( wp_unslash( $_POST['filename'] ) )
			: '';

		if ( empty( $filename ) ) {
			wp_send_json_error( array( 'message' => __( 'Filename is required.', 'elementor-framework-forge' ) ) );
		}

		$filename = EFF_Data_Store::sanitize_filename( $filename );
		$dir      = EFF_Data_Store::get_wp_storage_dir();
		$file     = $dir . $filename;

		if ( ! file_exists( $file ) ) {
			wp_send_json_error( array( 'message' => __( 'File not found.', 'elementor-framework-forge' ) ) );
		}

		$store = new EFF_Data_Store();
		if ( ! $store->load_from_file( $file ) ) {
			wp_send_json_error( array( 'message' => __( 'Could not read or parse file.', 'elementor-framework-forge' ) ) );
		}

		wp_send_json_success( array(
			'data'     => $store->get_all_data(),
			'counts'   => $store->get_counts(),
			'filename' => $filename,
		) );
	}

	// -----------------------------------------------------------------------
	// ENDPOINT: Sync from Elementor CSS
	// -----------------------------------------------------------------------

	public function ajax_eff_sync_from_elementor(): void {
		$this->verify_request();

		$parser   = new EFF_CSS_Parser();
		$css_file = $parser->find_kit_css_file();

		if ( ! $css_file ) {
			$upload_dir  = wp_upload_dir();
			$css_dir     = $upload_dir['basedir'] . '/elementor/css/';
			$kit_id      = (int) get_option( 'elementor_active_kit', 0 );
			$expected    = $kit_id ? $css_dir . 'post-' . $kit_id . '.css' : $css_dir . 'post-?.css';
			wp_send_json_error( array(
				'message'       => __( 'Elementor kit CSS file not found.', 'elementor-framework-forge' ),
				'hint'          => __( 'Open any page in Elementor editor and click Update/Save to regenerate kit CSS.', 'elementor-framework-forge' ),
				'expected_file' => $expected,
			) );
		}

		$variables = $parser->parse_file( $css_file );

		wp_send_json_success( array(
			'variables' => $variables,
			'count'     => count( $variables ),
			'source'    => basename( $css_file ),
			/* translators: %d: number of variables found */
			'message'   => sprintf( __( 'Found %d Elementor v4 variable(s).', 'elementor-framework-forge' ), count( $variables ) ),
		) );
	}

	// -----------------------------------------------------------------------
	// ENDPOINT: Save user theme preference
	// -----------------------------------------------------------------------

	public function ajax_eff_save_user_theme(): void {
		$this->verify_request();

		$theme = isset( $_POST['theme'] )
			? sanitize_text_field( wp_unslash( $_POST['theme'] ) )
			: 'light';

		$theme   = in_array( $theme, array( 'light', 'dark' ), true ) ? $theme : 'light';
		$user_id = get_current_user_id();

		update_user_meta( $user_id, EFF_Admin::USER_META_THEME, $theme );

		wp_send_json_success( array( 'theme' => $theme ) );
	}

	// -----------------------------------------------------------------------
	// ENDPOINT: Get project config
	// -----------------------------------------------------------------------

	public function ajax_eff_get_config(): void {
		$this->verify_request();

		// Saved config takes precedence over defaults file.
		$saved = get_option( 'eff_project_config', array() );

		if ( ! empty( $saved ) ) {
			wp_send_json_success( array( 'config' => $saved ) );
			return;
		}

		// Fall back to defaults JSON.
		$defaults_file = EFF_PLUGIN_DIR . 'data/eff-defaults.json';
		$config        = array();

		if ( file_exists( $defaults_file ) ) {
			$decoded = json_decode( file_get_contents( $defaults_file ), true );
			if ( JSON_ERROR_NONE === json_last_error() ) {
				$config = $decoded;
			}
		}

		wp_send_json_success( array( 'config' => $config ) );
	}

	// -----------------------------------------------------------------------
	// ENDPOINT: Save project config
	// -----------------------------------------------------------------------

	public function ajax_eff_save_config(): void {
		$this->verify_request();

		$config_raw = isset( $_POST['config'] ) ? wp_unslash( $_POST['config'] ) : '';
		$config     = json_decode( $config_raw, true );

		if ( JSON_ERROR_NONE !== json_last_error() ) {
			wp_send_json_error( array( 'message' => __( 'Invalid config format.', 'elementor-framework-forge' ) ) );
		}

		update_option( 'eff_project_config', $config );

		wp_send_json_success( array( 'message' => __( 'Configuration saved.', 'elementor-framework-forge' ) ) );
	}

	// -----------------------------------------------------------------------
	// ENDPOINT: Save plugin settings
	// -----------------------------------------------------------------------

	public function ajax_eff_save_settings(): void {
		$this->verify_request();

		$settings_raw = isset( $_POST['settings'] ) ? wp_unslash( $_POST['settings'] ) : '';
		$settings     = json_decode( $settings_raw, true );

		if ( JSON_ERROR_NONE !== json_last_error() ) {
			wp_send_json_error( array( 'message' => __( 'Invalid settings format.', 'elementor-framework-forge' ) ) );
		}

		EFF_Settings::set( $settings );

		wp_send_json_success( array( 'message' => __( 'Settings saved.', 'elementor-framework-forge' ) ) );
	}

	// -----------------------------------------------------------------------
	// ENDPOINT: Get variable usage counts
	// -----------------------------------------------------------------------

	public function ajax_eff_get_usage_counts(): void {
		$this->verify_request();

		$names_raw = isset( $_POST['variable_names'] ) ? wp_unslash( $_POST['variable_names'] ) : '[]';
		$names     = json_decode( $names_raw, true );

		if ( JSON_ERROR_NONE !== json_last_error() || ! is_array( $names ) ) {
			wp_send_json_error( array( 'message' => __( 'Invalid variable names format.', 'elementor-framework-forge' ) ) );
		}

		// Sanitize: allow only valid CSS custom property names (--identifier)
		$names = array_values( array_filter(
			array_map( 'sanitize_text_field', $names ),
			static function ( string $n ): bool {
				return preg_match( '/^--[\w-]+$/', $n ) === 1;
			}
		) );

		$counts = EFF_Usage_Scanner::scan( $names );

		wp_send_json_success( array(
			'counts'     => $counts,
			'scanned'    => count( $names ),
		) );
	}

	// -----------------------------------------------------------------------
	// ENDPOINT: Get plugin settings
	// -----------------------------------------------------------------------

	public function ajax_eff_get_settings(): void {
		$this->verify_request();
		wp_send_json_success( array( 'settings' => EFF_Settings::get() ) );
	}

	// -----------------------------------------------------------------------
	// PHASE 2 ENDPOINTS — Colors category and variable management
	// -----------------------------------------------------------------------

	/**
	 * Add or update a color category in the .eff.json file.
	 *
	 * POST params: filename, category (JSON: {id?, name, order?, locked?})
	 */
	public function ajax_eff_save_category(): void {
		$this->verify_request();

		$filename     = $this->get_filename_param();
		$category_raw = isset( $_POST['category'] ) ? wp_unslash( $_POST['category'] ) : '';
		$category     = json_decode( $category_raw, true );

		if ( JSON_ERROR_NONE !== json_last_error() || ! is_array( $category ) ) {
			wp_send_json_error( array( 'message' => __( 'Invalid category data.', 'elementor-framework-forge' ) ) );
		}

		$store = $this->load_store( $filename );

		if ( ! empty( $category['id'] ) ) {
			// Update existing.
			$name = isset( $category['name'] ) ? sanitize_text_field( $category['name'] ) : '';
			if ( empty( $name ) ) {
				wp_send_json_error( array( 'message' => __( 'Category name is required.', 'elementor-framework-forge' ) ) );
			}
			$updated = $store->update_category( $category['id'], array( 'name' => $name ) );
			if ( ! $updated ) {
				wp_send_json_error( array( 'message' => __( 'Category not found.', 'elementor-framework-forge' ) ) );
			}
			$id = $category['id'];
		} else {
			// Add new.
			$name = isset( $category['name'] ) ? sanitize_text_field( $category['name'] ) : '';
			if ( empty( $name ) ) {
				wp_send_json_error( array( 'message' => __( 'Category name is required.', 'elementor-framework-forge' ) ) );
			}
			$id = $store->add_category( array( 'name' => $name ) );
		}

		$this->save_store( $store, $filename );

		wp_send_json_success( array(
			'id'         => $id,
			'categories' => $store->get_categories(),
			/* translators: %s: category name */
			'message'    => sprintf( __( 'Category "%s" saved.', 'elementor-framework-forge' ), sanitize_text_field( $category['name'] ?? '' ) ),
		) );
	}

	/**
	 * Delete a color category from the .eff.json file.
	 *
	 * POST params: filename, category_id
	 */
	public function ajax_eff_delete_category(): void {
		$this->verify_request();

		$filename    = $this->get_filename_param();
		$category_id = isset( $_POST['category_id'] )
			? sanitize_text_field( wp_unslash( $_POST['category_id'] ) )
			: '';

		if ( empty( $category_id ) ) {
			wp_send_json_error( array( 'message' => __( 'Category ID is required.', 'elementor-framework-forge' ) ) );
		}

		$store   = $this->load_store( $filename );
		$deleted = $store->delete_category( $category_id );

		if ( ! $deleted ) {
			wp_send_json_error( array( 'message' => __( 'Category not found or cannot be deleted.', 'elementor-framework-forge' ) ) );
		}

		$this->save_store( $store, $filename );

		wp_send_json_success( array(
			'categories' => $store->get_categories(),
			'message'    => __( 'Category deleted.', 'elementor-framework-forge' ),
		) );
	}

	/**
	 * Reorder categories in the .eff.json file.
	 *
	 * POST params: filename, ordered_ids (JSON array of category UUIDs in desired order)
	 */
	public function ajax_eff_reorder_categories(): void {
		$this->verify_request();

		$filename    = $this->get_filename_param();
		$ids_raw     = isset( $_POST['ordered_ids'] ) ? wp_unslash( $_POST['ordered_ids'] ) : '[]';
		$ordered_ids = json_decode( $ids_raw, true );

		if ( JSON_ERROR_NONE !== json_last_error() || ! is_array( $ordered_ids ) ) {
			wp_send_json_error( array( 'message' => __( 'Invalid ordered IDs format.', 'elementor-framework-forge' ) ) );
		}

		// Sanitize: each ID must be a non-empty string.
		$ordered_ids = array_values( array_filter(
			array_map( 'sanitize_text_field', $ordered_ids ),
			static function ( string $id ): bool {
				return ! empty( $id );
			}
		) );

		$store = $this->load_store( $filename );
		$store->reorder_categories( $ordered_ids );
		$this->save_store( $store, $filename );

		wp_send_json_success( array(
			'categories' => $store->get_categories(),
			'message'    => __( 'Categories reordered.', 'elementor-framework-forge' ),
		) );
	}

	/**
	 * Add or update a color variable in the .eff.json file.
	 *
	 * POST params: filename, variable (JSON — full variable object or partial with `id`)
	 */
	public function ajax_eff_save_color(): void {
		$this->verify_request();

		$filename     = $this->get_filename_param();
		$variable_raw = isset( $_POST['variable'] ) ? wp_unslash( $_POST['variable'] ) : '';
		$variable     = json_decode( $variable_raw, true );

		if ( JSON_ERROR_NONE !== json_last_error() || ! is_array( $variable ) ) {
			wp_send_json_error( array( 'message' => __( 'Invalid variable data.', 'elementor-framework-forge' ) ) );
		}

		$store = $this->load_store( $filename );

		if ( ! empty( $variable['id'] ) ) {
			// Update existing variable.
			$allowed_fields = array(
				'name', 'value', 'original_value', 'format', 'category', 'category_id',
				'order', 'status', 'pending_rename_from', 'type', 'subgroup', 'group',
			);
			$update = array();
			foreach ( $allowed_fields as $field ) {
				if ( array_key_exists( $field, $variable ) ) {
					$update[ $field ] = is_string( $variable[ $field ] )
						? sanitize_text_field( $variable[ $field ] )
						: $variable[ $field ];
				}
			}
			// pending_rename_from may be null — preserve as-is.
			if ( array_key_exists( 'pending_rename_from', $variable ) ) {
				$update['pending_rename_from'] = is_null( $variable['pending_rename_from'] )
					? null
					: sanitize_text_field( $variable['pending_rename_from'] );
			}

			$updated = $store->update_variable( $variable['id'], $update );
			if ( ! $updated ) {
				wp_send_json_error( array( 'message' => __( 'Variable not found.', 'elementor-framework-forge' ) ) );
			}
			$id = $variable['id'];
		} else {
			// Add new variable.
			$name = isset( $variable['name'] ) ? sanitize_text_field( $variable['name'] ) : '';
			if ( empty( $name ) || ! preg_match( '/^--[\w-]+$/', $name ) ) {
				wp_send_json_error( array( 'message' => __( 'Valid CSS custom property name required (e.g., --my-color).', 'elementor-framework-forge' ) ) );
			}

			$new_var = array(
				'name'        => $name,
				'value'       => isset( $variable['value'] ) ? sanitize_text_field( $variable['value'] ) : '',
				'type'        => 'color',
				'subgroup'    => 'Colors',
				'category'    => isset( $variable['category'] ) ? sanitize_text_field( $variable['category'] ) : '',
				'category_id' => isset( $variable['category_id'] ) ? sanitize_text_field( $variable['category_id'] ) : '',
				'format'      => isset( $variable['format'] ) ? sanitize_text_field( $variable['format'] ) : 'HEX',
				'status'      => 'new',
				'source'      => 'user-defined',
			);

			$id = $store->add_variable( $new_var );
		}

		$this->save_store( $store, $filename );

		wp_send_json_success( array(
			'id'      => $id,
			'data'    => $store->get_all_data(),
			'counts'  => $store->get_counts(),
			'message' => __( 'Color variable saved.', 'elementor-framework-forge' ),
		) );
	}

	/**
	 * Delete a color variable from the .eff.json file.
	 *
	 * POST params: filename, variable_id, delete_children (optional, '1' to delete children)
	 */
	public function ajax_eff_delete_color(): void {
		$this->verify_request();

		$filename        = $this->get_filename_param();
		$variable_id     = isset( $_POST['variable_id'] )
			? sanitize_text_field( wp_unslash( $_POST['variable_id'] ) )
			: '';
		$delete_children = isset( $_POST['delete_children'] )
			&& $_POST['delete_children'] !== '0'
			&& $_POST['delete_children'] !== '';

		if ( empty( $variable_id ) ) {
			wp_send_json_error( array( 'message' => __( 'Variable ID is required.', 'elementor-framework-forge' ) ) );
		}

		$store   = $this->load_store( $filename );
		$deleted = $store->delete_variable( $variable_id, $delete_children );

		if ( ! $deleted ) {
			wp_send_json_error( array( 'message' => __( 'Variable not found.', 'elementor-framework-forge' ) ) );
		}

		$this->save_store( $store, $filename );

		wp_send_json_success( array(
			'data'    => $store->get_all_data(),
			'counts'  => $store->get_counts(),
			'message' => __( 'Color variable deleted.', 'elementor-framework-forge' ),
		) );
	}

	/**
	 * Generate tint/shade/transparency child variables for a parent color variable.
	 *
	 * POST params: filename, parent_id, tints (0–10), shades (0–10), transparencies (0|1)
	 *
	 * Child variable naming (spec §15.7 — EFF-Spec-Colors):
	 *   Tints:          --name-{step*10}     (e.g., --primary-10, --primary-20)
	 *   Shades:         --name-plus-{step*10} (e.g., --primary-plus-10; '+' encoded as '-plus-')
	 *   Transparencies: --name{step*10}       (e.g., --primary10, --primary20; 9 fixed steps)
	 */
	public function ajax_eff_generate_children(): void {
		$this->verify_request();

		$filename         = $this->get_filename_param();
		$parent_id        = isset( $_POST['parent_id'] ) ? sanitize_text_field( wp_unslash( $_POST['parent_id'] ) ) : '';
		$tint_steps       = isset( $_POST['tints'] ) ? (int) $_POST['tints'] : 0;
		$shade_steps      = isset( $_POST['shades'] ) ? (int) $_POST['shades'] : 0;
		$trans_on         = isset( $_POST['transparencies'] ) && $_POST['transparencies'] !== '0' && $_POST['transparencies'] !== '';

		// Validate step values: 0–10 for tints/shades.
		$tint_steps  = max( 0, min( 10, $tint_steps ) );
		$shade_steps = max( 0, min( 10, $shade_steps ) );

		if ( empty( $parent_id ) ) {
			wp_send_json_error( array( 'message' => __( 'Parent variable ID is required.', 'elementor-framework-forge' ) ) );
		}

		$store = $this->load_store( $filename );

		// Find parent variable.
		$parent = null;
		foreach ( $store->get_variables() as $var ) {
			if ( $var['id'] === $parent_id ) {
				$parent = $var;
				break;
			}
		}

		if ( ! $parent ) {
			wp_send_json_error( array( 'message' => __( 'Parent variable not found.', 'elementor-framework-forge' ) ) );
		}

		// Remove existing children of this parent (regenerate).
		foreach ( $store->get_variables() as $var ) {
			if ( isset( $var['parent_id'] ) && $var['parent_id'] === $parent_id ) {
				$store->delete_variable( $var['id'] );
			}
		}

		// Parse parent hex to H, S, L.
		$hex = ltrim( $parent['value'], '#' );
		if ( strlen( $hex ) !== 6 ) {
			wp_send_json_error( array( 'message' => __( 'Parent variable must have a 6-digit hex value to generate children.', 'elementor-framework-forge' ) ) );
		}

		list( $h, $s, $l ) = $this->hex_to_hsl( $hex );
		$base_name = preg_replace( '/^--/', '', $parent['name'] );

		$new_ids = array();

		// Generate tints: each step i of N shifts lightness equally toward 100% (white).
		// Naming: --name-{i*10} e.g. --primary-10, --primary-20 … --primary-30 for N=3.
		if ( $tint_steps > 0 ) {
			for ( $i = 1; $i <= $tint_steps; $i++ ) {
				$tint_l   = $l + ( 100.0 - $l ) * ( $i / $tint_steps );
				$tint_l   = min( 98.0, $tint_l );
				$tint_hex = $this->hsl_to_hex( $h, $s, $tint_l );
				$new_ids[] = $store->add_variable( array(
					'name'        => '--' . $base_name . '-' . ( $i * 10 ),
					'value'       => $tint_hex,
					'type'        => 'color',
					'subgroup'    => $parent['subgroup'] ?? 'Colors',
					'category'    => $parent['category'] ?? '',
					'category_id' => $parent['category_id'] ?? '',
					'format'      => $parent['format'] ?? 'HEX',
					'status'      => 'new',
					'source'      => 'user-defined',
					'parent_id'   => $parent_id,
				) );
			}
		}

		// Generate shades: each step i of N shifts lightness equally toward 0% (black).
		// Naming: --name-plus-{i*10} ('+' encoded as '-plus-') e.g. --primary-plus-10.
		if ( $shade_steps > 0 ) {
			for ( $i = 1; $i <= $shade_steps; $i++ ) {
				$shade_l   = $l - $l * ( $i / $shade_steps );
				$shade_l   = max( 2.0, $shade_l );
				$shade_hex = $this->hsl_to_hex( $h, $s, $shade_l );
				$new_ids[] = $store->add_variable( array(
					'name'        => '--' . $base_name . '-plus-' . ( $i * 10 ),
					'value'       => $shade_hex,
					'type'        => 'color',
					'subgroup'    => $parent['subgroup'] ?? 'Colors',
					'category'    => $parent['category'] ?? '',
					'category_id' => $parent['category_id'] ?? '',
					'format'      => $parent['format'] ?? 'HEX',
					'status'      => 'new',
					'source'      => 'user-defined',
					'parent_id'   => $parent_id,
				) );
			}
		}

		// Generate transparencies: 9 fixed steps, alpha = step/10 (0.1 to 0.9).
		// Naming: --name{step*10} (no separator) e.g. --primary10, --primary20 … --primary90.
		if ( $trans_on ) {
			for ( $i = 1; $i <= 9; $i++ ) {
				$alpha_pct  = $i * 10;
				$alpha_hex  = strtoupper( dechex( (int) round( $alpha_pct / 100 * 255 ) ) );
				$alpha_hex  = str_pad( $alpha_hex, 2, '0', STR_PAD_LEFT );
				$new_ids[] = $store->add_variable( array(
					'name'        => '--' . $base_name . ( $i * 10 ),
					'value'       => '#' . $hex . $alpha_hex,
					'type'        => 'color',
					'subgroup'    => $parent['subgroup'] ?? 'Colors',
					'category'    => $parent['category'] ?? '',
					'category_id' => $parent['category_id'] ?? '',
					'format'      => 'HEXA',
					'status'      => 'new',
					'source'      => 'user-defined',
					'parent_id'   => $parent_id,
				) );
			}
		}

		$this->save_store( $store, $filename );

		wp_send_json_success( array(
			'new_ids'  => $new_ids,
			'data'     => $store->get_all_data(),
			'counts'   => $store->get_counts(),
			/* translators: %d: number of child variables generated */
			'message'  => sprintf( __( 'Generated %d child variables.', 'elementor-framework-forge' ), count( $new_ids ) ),
		) );
	}

	/**
	 * Save the Elementor baseline snapshot for a .eff.json file.
	 *
	 * POST params: filename, variables (JSON array of {name, value})
	 */
	public function ajax_eff_save_baseline(): void {
		$this->verify_request();

		$filename      = $this->get_filename_param();
		$variables_raw = isset( $_POST['variables'] ) ? wp_unslash( $_POST['variables'] ) : '[]';
		$variables     = json_decode( $variables_raw, true );

		if ( JSON_ERROR_NONE !== json_last_error() || ! is_array( $variables ) ) {
			wp_send_json_error( array( 'message' => __( 'Invalid variables format.', 'elementor-framework-forge' ) ) );
		}

		// Sanitize: allow only valid CSS custom property entries.
		$sanitized = array();
		foreach ( $variables as $v ) {
			if ( ! is_array( $v ) || ! isset( $v['name'] ) || ! preg_match( '/^--[\w-]+$/', $v['name'] ) ) {
				continue;
			}
			$sanitized[] = array(
				'name'  => sanitize_text_field( $v['name'] ),
				'value' => isset( $v['value'] ) ? sanitize_text_field( $v['value'] ) : '',
			);
		}

		EFF_Data_Store::save_baseline( $filename, $sanitized );

		wp_send_json_success( array(
			'count'   => count( $sanitized ),
			'message' => __( 'Baseline saved.', 'elementor-framework-forge' ),
		) );
	}

	/**
	 * Retrieve the Elementor baseline snapshot for a .eff.json file.
	 *
	 * POST params: filename
	 */
	public function ajax_eff_get_baseline(): void {
		$this->verify_request();

		$filename  = $this->get_filename_param();
		$variables = EFF_Data_Store::get_baseline( $filename );

		wp_send_json_success( array(
			'variables' => $variables,
			'count'     => count( $variables ),
		) );
	}

	/**
	 * Commit EFF color variable values back to Elementor's kit CSS file.
	 *
	 * Reads the Elementor kit CSS, replaces matching variable values in the
	 * last `:root` block (the Elementor v4 atomic block), writes the file back,
	 * triggers Elementor CSS regeneration, and updates the baseline.
	 *
	 * POST params: filename, variables (JSON array of {name, value} to commit)
	 */
	public function ajax_eff_commit_to_elementor(): void {
		$this->verify_request();

		$filename      = $this->get_filename_param();
		$variables_raw = isset( $_POST['variables'] ) ? wp_unslash( $_POST['variables'] ) : '[]';
		$variables     = json_decode( $variables_raw, true );

		if ( JSON_ERROR_NONE !== json_last_error() || ! is_array( $variables ) ) {
			wp_send_json_error( array( 'message' => __( 'Invalid variables format.', 'elementor-framework-forge' ) ) );
		}

		// Locate the Elementor kit CSS file.
		$parser   = new EFF_CSS_Parser();
		$css_file = $parser->find_kit_css_file();

		if ( ! $css_file ) {
			wp_send_json_error( array(
				'message' => __( 'Elementor kit CSS file not found. Regenerate CSS from Elementor → Tools → Regenerate Files.', 'elementor-framework-forge' ),
			) );
		}

		if ( ! is_writable( $css_file ) ) {
			wp_send_json_error( array(
				/* translators: %s: absolute file path */
				'message' => sprintf( __( 'Kit CSS file is not writable: %s', 'elementor-framework-forge' ), esc_html( $css_file ) ),
			) );
		}

		$css = file_get_contents( $css_file );
		if ( false === $css ) {
			wp_send_json_error( array( 'message' => __( 'Could not read kit CSS file.', 'elementor-framework-forge' ) ) );
		}

		$committed = array();
		$skipped   = array();

		foreach ( $variables as $v ) {
			if ( ! is_array( $v ) || ! isset( $v['name'] ) || ! preg_match( '/^--[\w-]+$/', $v['name'] ) ) {
				continue;
			}

			$name  = sanitize_text_field( $v['name'] );
			$value = isset( $v['value'] ) ? sanitize_text_field( $v['value'] ) : '';

			// Replace value in the CSS: target `--name: anything;` pattern.
			$pattern     = '/' . preg_quote( $name, '/' ) . '\s*:\s*[^;]+;/';
			$replacement = $name . ': ' . $value . ';';
			$new_css     = preg_replace( $pattern, $replacement, $css, -1, $count );

			if ( $count > 0 ) {
				$css         = $new_css;
				$committed[] = $name;
			} else {
				$skipped[] = $name;
			}
		}

		// Issue 7: Insert pass — add newly-created variables not yet in the CSS.
		if ( ! empty( $skipped ) ) {
			$insert_block    = '';
			$newly_committed = array();
			foreach ( $skipped as $name ) {
				foreach ( $variables as $v ) {
					if ( isset( $v['name'] ) && $v['name'] === $name ) {
						$val           = sanitize_text_field( $v['value'] ?? '' );
						$insert_block .= "\n  " . $name . ': ' . $val . ';';
						$newly_committed[] = $name;
						break;
					}
				}
			}
			if ( $insert_block ) {
				// Insert before the closing } of the last :root block.
				$last_root_pos = strrpos( $css, ':root' );
				if ( false !== $last_root_pos ) {
					$close_pos = strpos( $css, '}', $last_root_pos );
					if ( false !== $close_pos ) {
						$css = substr( $css, 0, $close_pos )
							. $insert_block . "\n"
							. substr( $css, $close_pos );
						foreach ( $newly_committed as $n ) {
							$committed[] = $n;
						}
						$skipped = array_values( array_diff( $skipped, $newly_committed ) );
					}
				}
			}
		}

		if ( ! empty( $committed ) ) {
			if ( false === file_put_contents( $css_file, $css ) ) {
				wp_send_json_error( array( 'message' => __( 'Could not write kit CSS file. Check file permissions.', 'elementor-framework-forge' ) ) );
			}
		}

		// Trigger Elementor CSS regeneration if the API is available.
		do_action( 'elementor/css-file/clear-cache' );

		// Update the baseline to reflect the committed values.
		$baseline_vars = array();
		foreach ( $committed as $name ) {
			foreach ( $variables as $v ) {
				if ( isset( $v['name'] ) && $v['name'] === $name ) {
					$baseline_vars[] = array(
						'name'  => $name,
						'value' => sanitize_text_field( $v['value'] ?? '' ),
					);
					break;
				}
			}
		}
		if ( ! empty( $baseline_vars ) ) {
			// Merge into existing baseline.
			$existing  = EFF_Data_Store::get_baseline( $filename );
			$index     = array();
			foreach ( $existing as $bv ) {
				$index[ $bv['name'] ] = $bv['value'];
			}
			foreach ( $baseline_vars as $bv ) {
				$index[ $bv['name'] ] = $bv['value'];
			}
			$merged = array();
			foreach ( $index as $n => $val ) {
				$merged[] = array( 'name' => $n, 'value' => $val );
			}
			EFF_Data_Store::save_baseline( $filename, $merged );
		}

		wp_send_json_success( array(
			'committed' => $committed,
			'skipped'   => $skipped,
			/* translators: %d: number of variables committed */
			'message'   => sprintf( __( '%d variable(s) committed to Elementor.', 'elementor-framework-forge' ), count( $committed ) ),
		) );
	}

	// -----------------------------------------------------------------------
	// PHASE 2 PRIVATE HELPERS
	// -----------------------------------------------------------------------

	/**
	 * Get and validate the `filename` POST parameter.
	 *
	 * Sends a JSON error and dies if missing or empty.
	 *
	 * @return string Sanitized filename.
	 */
	private function get_filename_param(): string {
		$filename = isset( $_POST['filename'] )
			? sanitize_text_field( wp_unslash( $_POST['filename'] ) )
			: '';

		if ( empty( $filename ) ) {
			wp_send_json_error( array( 'message' => __( 'Filename is required.', 'elementor-framework-forge' ) ) );
		}

		return EFF_Data_Store::sanitize_filename( $filename );
	}

	/**
	 * Load a .eff.json file into a new EFF_Data_Store instance.
	 *
	 * Sends a JSON error and dies if the file cannot be read.
	 *
	 * @param string $filename Sanitized filename.
	 * @return EFF_Data_Store Loaded store.
	 */
	private function load_store( string $filename ): EFF_Data_Store {
		$dir   = EFF_Data_Store::get_wp_storage_dir();
		$file  = $dir . $filename;
		$store = new EFF_Data_Store();

		if ( file_exists( $file ) && ! $store->load_from_file( $file ) ) {
			wp_send_json_error( array( 'message' => __( 'Could not read or parse EFF file.', 'elementor-framework-forge' ) ) );
		}

		return $store;
	}

	/**
	 * Save a data store to its .eff.json file.
	 *
	 * Sends a JSON error and dies if the file cannot be written.
	 *
	 * @param EFF_Data_Store $store    Store to save.
	 * @param string         $filename Sanitized filename.
	 */
	private function save_store( EFF_Data_Store $store, string $filename ): void {
		$dir  = EFF_Data_Store::get_wp_storage_dir();
		$file = $dir . $filename;

		if ( ! $store->save_to_file( $file ) ) {
			wp_send_json_error( array( 'message' => __( 'Could not write EFF file. Check directory permissions.', 'elementor-framework-forge' ) ) );
		}
	}

	/**
	 * Convert a 6-digit hex color string to an [H, S, L] array.
	 *
	 * @param string $hex 6 hex chars without '#'.
	 * @return float[] [hue (0–360), saturation (0–100), lightness (0–100)]
	 */
	private function hex_to_hsl( string $hex ): array {
		$r = hexdec( substr( $hex, 0, 2 ) ) / 255.0;
		$g = hexdec( substr( $hex, 2, 2 ) ) / 255.0;
		$b = hexdec( substr( $hex, 4, 2 ) ) / 255.0;

		$max   = max( $r, $g, $b );
		$min   = min( $r, $g, $b );
		$delta = $max - $min;
		$l     = ( $max + $min ) / 2.0;

		if ( $delta < 0.0001 ) {
			return array( 0.0, 0.0, $l * 100.0 );
		}

		$s = $delta / ( 1.0 - abs( 2.0 * $l - 1.0 ) );

		if ( $max === $r ) {
			$h = fmod( ( $g - $b ) / $delta, 6.0 );
		} elseif ( $max === $g ) {
			$h = ( $b - $r ) / $delta + 2.0;
		} else {
			$h = ( $r - $g ) / $delta + 4.0;
		}

		$h = fmod( $h * 60.0 + 360.0, 360.0 );

		return array( $h, $s * 100.0, $l * 100.0 );
	}

	/**
	 * Convert H, S, L values to a 6-digit hex color string (with '#').
	 *
	 * @param float $h Hue (0–360).
	 * @param float $s Saturation (0–100).
	 * @param float $l Lightness (0–100).
	 * @return string Hex color with '#' prefix.
	 */
	private function hsl_to_hex( float $h, float $s, float $l ): string {
		$s /= 100.0;
		$l /= 100.0;

		$c = ( 1.0 - abs( 2.0 * $l - 1.0 ) ) * $s;
		$x = $c * ( 1.0 - abs( fmod( $h / 60.0, 2.0 ) - 1.0 ) );
		$m = $l - $c / 2.0;

		if ( $h < 60 ) {
			list( $r1, $g1, $b1 ) = array( $c, $x, 0.0 );
		} elseif ( $h < 120 ) {
			list( $r1, $g1, $b1 ) = array( $x, $c, 0.0 );
		} elseif ( $h < 180 ) {
			list( $r1, $g1, $b1 ) = array( 0.0, $c, $x );
		} elseif ( $h < 240 ) {
			list( $r1, $g1, $b1 ) = array( 0.0, $x, $c );
		} elseif ( $h < 300 ) {
			list( $r1, $g1, $b1 ) = array( $x, 0.0, $c );
		} else {
			list( $r1, $g1, $b1 ) = array( $c, 0.0, $x );
		}

		$r = (int) round( ( $r1 + $m ) * 255 );
		$g = (int) round( ( $g1 + $m ) * 255 );
		$b = (int) round( ( $b1 + $m ) * 255 );

		return sprintf( '#%02x%02x%02x', $r, $g, $b );
	}

	// -----------------------------------------------------------------------
	// SHARED GUARD
	// -----------------------------------------------------------------------

	/**
	 * Verify nonce and capability. Sends JSON error and dies on failure.
	 */
	private function verify_request(): void {
		// Suppress PHP notice/warning output so they cannot corrupt JSON responses.
		// Local development environments (e.g. Local WP) often have display_errors = On
		// in their php.ini regardless of WP_DEBUG, which prepends HTML error output to
		// the response body and causes JSON.parse failures in the browser.
		ini_set( 'display_errors', '0' );

		if ( ! check_ajax_referer( self::NONCE_ACTION, 'nonce', false ) ) {
			wp_send_json_error(
				array( 'message' => __( 'Security check failed.', 'elementor-framework-forge' ) ),
				403
			);
		}

		if ( ! current_user_can( 'manage_options' ) ) {
			wp_send_json_error(
				array( 'message' => __( 'Insufficient permissions.', 'elementor-framework-forge' ) ),
				403
			);
		}
	}
}
