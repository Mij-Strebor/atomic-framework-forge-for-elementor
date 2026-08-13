<?php

/**
 * ATFRFO Ajax Handler — AJAX Endpoint Registration & Processing
 *
 * All AJAX endpoints are registered here, each protected with nonce
 * verification and capability checks before any processing occurs.
 *
 * @package AtomicFrameworkForge
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

// phpcs:disable WordPress.Security.NonceVerification.Missing -- All handlers call $this->verify_request() which performs nonce verification via check_ajax_referer().
// phpcs:disable WordPress.Security.ValidatedSanitizedInput.InputNotSanitized -- JSON payloads are decoded and sanitized as a whole via $this->safe_json_decode(), which recursively runs sanitize_text_field() over every string leaf before returning.

class ATFRFO_Ajax_Handler {


	/**
	 * Register all wp_ajax_{action} hooks.
	 */
	public function register_handlers(): void {
		$actions = array(
			// v1.0.0 endpoints
			'atfrfo_save_file',
			'atfrfo_load_file',
			'atfrfo_sync_from_elementor',
			'atfrfo_save_user_theme',
			'atfrfo_increment_notify_count',
			'atfrfo_get_config',
			'atfrfo_save_config',
			'atfrfo_save_settings',
			'atfrfo_get_settings',
			'atfrfo_get_usage_counts',
			// Project management endpoints
			'atfrfo_list_projects',
			'atfrfo_list_backups',
			'atfrfo_delete_project',
			'atfrfo_rename_project',
			'atfrfo_copy_project',
			'atfrfo_delete_project_folder',
			// Classes Phase 3.1 endpoints
			'atfrfo_get_classes',
			'atfrfo_sync_classes',
			'atfrfo_update_class',
			'atfrfo_get_class_usage',
			'atfrfo_delete_class_from_elementor',
			'atfrfo_rename_class_in_elementor',
			// Phase 2 — Colors endpoints
			'atfrfo_save_category',
			'atfrfo_delete_category',
			'atfrfo_clear_category',
			'atfrfo_reorder_categories',
			'atfrfo_save_color',
			'atfrfo_delete_color',
			'atfrfo_generate_children',
			'atfrfo_save_baseline',
			'atfrfo_get_baseline',
			'atfrfo_commit_to_elementor',
			// Elementor V3 Import
			'atfrfo_sync_v3_global_colors',
			// Diagnostics & cleanup
			'atfrfo_get_diagnostics',
			'atfrfo_deduplicate',
		);

		foreach ( $actions as $action ) {
			add_action( 'wp_ajax_' . $action, array( $this, 'ajax_' . $action ) );
		}
	}

	// -----------------------------------------------------------------------
	// ENDPOINT: Save file
	// -----------------------------------------------------------------------

	public function ajax_atfrfo_save_file(): void {
		$this->verify_request();

		$project_name = $this->post_param( 'project_name' );

		$data_raw = isset( $_POST['data'] ) ? wp_unslash( $_POST['data'] ) : '';

		if ( empty( $project_name ) ) {
			wp_send_json_error( array( 'message' => __( 'Project name is required.', 'atomic-framework-forge-for-elementor' ) ) );
		}

		$decoded = $this->safe_json_decode( $data_raw, __( 'Invalid data format.', 'atomic-framework-forge-for-elementor' ) );

		// Assign UUIDs to any variables that arrived with an empty id (e.g., synced
		// Elementor variables that were never explicitly saved via atfrfo_save_color).
		if ( ! empty( $decoded['variables'] ) && is_array( $decoded['variables'] ) ) {
			foreach ( $decoded['variables'] as &$var ) {
				if ( empty( $var['id'] ) ) {
					$var['id'] = wp_generate_uuid4();
				}
			}
			unset( $var );
		}

		$slug  = ATFRFO_Data_Store::sanitize_project_slug( $project_name );
		$dir   = ATFRFO_Data_Store::get_project_dir( $slug );
		$fname = ATFRFO_Data_Store::generate_backup_filename( $slug );
		$file  = $dir . $fname;

		$json = wp_json_encode( $decoded, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES );
		if ( false === $json ) {
			wp_send_json_error(
				array(
					'message' => sprintf(
						/* translators: %s: JSON encoding error message */
						__( 'Could not encode data as JSON. Error: %s', 'atomic-framework-forge-for-elementor' ),
						json_last_error_msg()
					),
				)
			);
		}

		$fs = $this->get_wp_filesystem();
		if ( ! $fs || ! $fs->is_writable( $dir ) ) {
			wp_send_json_error(
				array(
					'message' => sprintf(
						/* translators: %s: directory path */
						__( 'Directory is not writable: %s', 'atomic-framework-forge-for-elementor' ),
						esc_html( $dir )
					),
				)
			);
		}

		if ( false === file_put_contents( $file, $json ) ) { // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_file_put_contents
			$last_error = error_get_last();
			wp_send_json_error(
				array(
					'message' => sprintf(
						/* translators: 1: file path, 2: PHP error message */
						__( 'Could not write file: %1$s — %2$s', 'atomic-framework-forge-for-elementor' ),
						esc_html( $file ),
						esc_html( $last_error['message'] ?? 'unknown error' )
					),
				)
			);
		}

		ATFRFO_Data_Store::prune_backups( $dir, (int) ATFRFO_Settings::get( 'max_backups' ) );

		$relative = $slug . '/' . $fname;
		wp_send_json_success(
			array(
				'message'   => __( 'File saved successfully.', 'atomic-framework-forge-for-elementor' ),
				'filename'  => $relative,
				'variables' => $decoded['variables'] ?? array(),
			)
		);
	}

	// -----------------------------------------------------------------------
	// ENDPOINT: Load file
	// -----------------------------------------------------------------------

	public function ajax_atfrfo_load_file(): void {
		$this->verify_request();

		$raw = $this->post_param( 'filename' );

		if ( empty( $raw ) ) {
			wp_send_json_error( array( 'message' => __( 'Filename is required.', 'atomic-framework-forge-for-elementor' ) ) );
		}

		$resolved = $this->resolve_file( $raw );
		$file     = $resolved['absolute'];
		$filename = $resolved['relative'];
		$dir      = ATFRFO_Data_Store::get_wp_storage_dir();

		if ( ! file_exists( $file ) ) {
			// Backward compat: old flat path — try newest backup in slug subdir.
			if ( strpos( $raw, '/' ) === false ) {
				$slug    = ATFRFO_Data_Store::sanitize_project_slug( preg_replace( '/\.atfrfo\.json$/i', '', $raw ) );
				$backups = ATFRFO_Data_Store::list_project_backups( $dir, $slug );
				if ( ! empty( $backups ) ) {
					$resolved = $this->resolve_file( $backups[0]['filename'] );
					$file     = $resolved['absolute'];
					$filename = $resolved['relative'];
				}
			}

			if ( ! file_exists( $file ) ) {
				// Still not found → return a fresh empty project (create-on-load).
				$project_name = isset( $_POST['project_name'] )
					? sanitize_text_field( wp_unslash( $_POST['project_name'] ) )
					: preg_replace( '/\.atfrfo(?:\.json)?$/i', '', basename( $filename ) );
				$project_name = preg_replace( '/\.atfrfo$/', '', $project_name );

				$store = new ATFRFO_Data_Store();
				$data  = $store->new_project( $project_name );

				wp_send_json_success(
					array(
						'data'     => $data,
						'counts'   => array(
							'variables'  => 0,
							'classes'    => 0,
							'components' => 0,
						),
						'filename' => $filename,
						'created'  => true,
					)
				);
				return;
			}
		}

		$store = new ATFRFO_Data_Store();
		if ( ! $store->load_from_file( $file ) ) {
			wp_send_json_error( array( 'message' => __( 'Could not read or parse file.', 'atomic-framework-forge-for-elementor' ) ) );
		}

		wp_send_json_success(
			array(
				'data'     => $store->get_all_data(),
				'counts'   => $store->get_counts(),
				'filename' => $filename,
			)
		);
	}

	// -----------------------------------------------------------------------
	// ENDPOINT: Sync from Elementor CSS
	// -----------------------------------------------------------------------

	public function ajax_atfrfo_sync_from_elementor(): void {
		$this->verify_request();

		$parser = new ATFRFO_CSS_Parser();

		// Primary path: read directly from _elementor_global_variables post meta.
		// This is Elementor's authoritative storage for v4 variables and works even
		// when no kit CSS file has been generated yet.
		// Skip when a manual CSS file override is supplied.
		$manual_path = $this->post_param( 'css_file_path' );

		if ( ! $manual_path ) {
			$variables = $parser->read_from_kit_meta();

			if ( null !== $variables ) {
				wp_send_json_success(
					array(
						'variables' => $variables,
						'count'     => count( $variables ),
						'source'    => 'elementor_kit_meta',
						/* translators: %d: number of variables found */
						'message'   => sprintf( __( 'Found %d Elementor variable(s).', 'atomic-framework-forge-for-elementor' ), count( $variables ) ),
					)
				);
				return;
			}
		}

		// Fallback: CSS file approach (manual override, or kit meta unavailable).
		$css_file = null;

		if ( $manual_path ) {
			$upload_dir   = wp_upload_dir();
			$allowed_base = wp_normalize_path( $upload_dir['basedir'] . '/elementor/css/' );
			$candidate    = wp_normalize_path( $manual_path );

			// Reject anything outside the allowed directory or that is not a .css file.
			if (
				0 === strpos( $candidate, $allowed_base ) &&
				'.css' === substr( $candidate, -4 ) &&
				file_exists( $candidate )
			) {
				$css_file = $candidate;
			} else {
				wp_send_json_error(
					array(
						'message' => __( 'The supplied path is not valid. It must be an existing .css file inside wp-content/uploads/elementor/css/.', 'atomic-framework-forge-for-elementor' ),
					)
				);
				return;
			}
		}

		if ( ! $css_file ) {
			$css_file = $parser->find_kit_css_file();
		}

		// If the kit CSS file is still missing, attempt to regenerate it via Elementor's
		// CSS API. This handles fresh installs and post-cache-clear states where the file
		// has not yet been written, eliminating the need to load a front-end page first.
		if ( ! $css_file ) {
			$css_file = $this->try_regenerate_elementor_kit_css();
		}

		if ( ! $css_file ) {
			wp_send_json_error(
				array(
					'message' => __( 'No Elementor variables found. Make sure you have defined global variables in Elementor (Site Settings → Global Variables) and saved.', 'atomic-framework-forge-for-elementor' ),
				)
			);
			return;
		}

		$variables = $parser->parse_file( $css_file );

		wp_send_json_success(
			array(
				'variables' => $variables,
				'count'     => count( $variables ),
				'source'    => basename( $css_file ),
				/* translators: %d: number of variables found */
				'message'   => sprintf( __( 'Found %d Elementor variable(s).', 'atomic-framework-forge-for-elementor' ), count( $variables ) ),
			)
		);
	}

	// -----------------------------------------------------------------------
	// ENDPOINT: Save user theme preference
	// -----------------------------------------------------------------------

	public function ajax_atfrfo_save_user_theme(): void {
		$this->verify_request();

		$theme = $this->post_param( 'theme', 'light' );

		$theme   = in_array( $theme, array( 'light', 'dark' ), true ) ? $theme : 'light';
		$user_id = get_current_user_id();

		update_user_meta( $user_id, ATFRFO_USER_META_THEME, $theme );

		wp_send_json_success( array( 'theme' => $theme ) );
	}

	// -----------------------------------------------------------------------
	// ENDPOINT: Increment "take a look" notify sign shown-count
	// -----------------------------------------------------------------------

	/**
	 * Increment the current user's notify-sign shown count by one.
	 * Called once per display, fire-and-forget from the client — the server
	 * is the single source of truth for the cap (ATFRFO_NOTIFY_MAX_SHOWS), and
	 * this endpoint has no meaningful failure mode the client needs to react to.
	 */
	public function ajax_atfrfo_increment_notify_count(): void {
		$this->verify_request();

		$user_id = get_current_user_id();
		$count   = get_user_meta( $user_id, ATFRFO_USER_META_NOTIFY_COUNT, true );
		$count   = is_numeric( $count ) ? (int) $count : 0;
		++$count;

		update_user_meta( $user_id, ATFRFO_USER_META_NOTIFY_COUNT, $count );

		wp_send_json_success( array( 'count' => $count ) );
	}

	// -----------------------------------------------------------------------
	// ENDPOINT: Get project config
	// -----------------------------------------------------------------------

	public function ajax_atfrfo_get_config(): void {
		$this->verify_request();

		// Saved config takes precedence over defaults file.
		$saved = get_option( 'atfrfo_project_config', array() );

		if ( ! empty( $saved ) ) {
			wp_send_json_success( array( 'config' => $saved ) );
			return;
		}

		// Fall back to defaults JSON.
		$defaults_file = ATFRFO_PLUGIN_DIR . 'data/atfrfo-defaults.json';
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

	public function ajax_atfrfo_save_config(): void {
		$this->verify_request();

		$config_raw = isset( $_POST['config'] ) ? wp_unslash( $_POST['config'] ) : '';
		$config     = $this->safe_json_decode( $config_raw, __( 'Invalid config format.', 'atomic-framework-forge-for-elementor' ) );

		update_option( 'atfrfo_project_config', $config );

		wp_send_json_success( array( 'message' => __( 'Configuration saved.', 'atomic-framework-forge-for-elementor' ) ) );
	}

	// -----------------------------------------------------------------------
	// ENDPOINT: Save plugin settings
	// -----------------------------------------------------------------------

	public function ajax_atfrfo_save_settings(): void {
		$this->verify_request();

		$settings_raw = isset( $_POST['settings'] ) ? wp_unslash( $_POST['settings'] ) : '';
		$settings     = $this->safe_json_decode( $settings_raw, __( 'Invalid settings format.', 'atomic-framework-forge-for-elementor' ) );

		ATFRFO_Settings::set( $settings );

		wp_send_json_success( array( 'message' => __( 'Settings saved.', 'atomic-framework-forge-for-elementor' ) ) );
	}

	// -----------------------------------------------------------------------
	// ENDPOINT: Get variable usage counts
	// -----------------------------------------------------------------------

	public function ajax_atfrfo_get_usage_counts(): void {
		$this->verify_request();

		$names_raw = isset( $_POST['variable_names'] ) ? wp_unslash( $_POST['variable_names'] ) : '[]';
		$names     = $this->safe_json_decode( $names_raw, __( 'Invalid variable names format.', 'atomic-framework-forge-for-elementor' ) );

		// Sanitize: allow only valid CSS custom property names (--identifier)
		$names = array_values(
			array_filter(
				array_map( 'sanitize_text_field', $names ),
				function ( string $n ): bool {
					return $this->is_valid_css_var( $n );
				}
			)
		);

		$counts = ATFRFO_Usage_Scanner::scan( $names );

		wp_send_json_success(
			array(
				'counts'  => $counts,
				'scanned' => count( $names ),
			)
		);
	}

	// -----------------------------------------------------------------------
	// ENDPOINT: Get plugin settings
	// -----------------------------------------------------------------------

	public function ajax_atfrfo_get_settings(): void {
		$this->verify_request();
		wp_send_json_success( array( 'settings' => ATFRFO_Settings::get() ) );
	}

	// -----------------------------------------------------------------------
	// ENDPOINT: List projects
	// -----------------------------------------------------------------------

	public function ajax_atfrfo_list_projects(): void {
		$this->verify_request();

		$dir      = ATFRFO_Data_Store::get_wp_storage_dir();
		$projects = ATFRFO_Data_Store::list_projects( $dir );

		wp_send_json_success( array( 'projects' => $projects ) );
	}

	// -----------------------------------------------------------------------
	// ENDPOINT: List backups for a project
	// -----------------------------------------------------------------------

	public function ajax_atfrfo_list_backups(): void {
		$this->verify_request();

		$slug    = $this->post_param( 'project_slug' );
		$slug    = ATFRFO_Data_Store::sanitize_project_slug( $slug );
		$dir     = ATFRFO_Data_Store::get_wp_storage_dir();
		$backups = ATFRFO_Data_Store::list_project_backups( $dir, $slug );

		wp_send_json_success( array( 'backups' => $backups ) );
	}

	// -----------------------------------------------------------------------
	// ENDPOINT: Delete project (single backup)
	// -----------------------------------------------------------------------

	public function ajax_atfrfo_delete_project(): void {
		$this->verify_request();

		$raw = $this->post_param( 'filename' );

		if ( empty( $raw ) ) {
			wp_send_json_error( array( 'message' => __( 'Filename is required.', 'atomic-framework-forge-for-elementor' ) ) );
		}

		$resolved = $this->resolve_file( $raw );
		$file     = $resolved['absolute'];
		$filename = $resolved['relative'];

		if ( ! file_exists( $file ) ) {
			wp_send_json_error( array( 'message' => __( 'File not found.', 'atomic-framework-forge-for-elementor' ) ) );
		}

		if ( ! wp_delete_file( $file ) || file_exists( $file ) ) {
			wp_send_json_error( array( 'message' => __( 'Could not delete file. Check permissions.', 'atomic-framework-forge-for-elementor' ) ) );
		}

		// Clean up stored baseline.
		ATFRFO_Data_Store::delete_baseline( $filename );

		// Remove project subdirectory if now empty.
		$project_dir = dirname( $file );
		if ( is_dir( $project_dir ) && empty( glob( $project_dir . '/*.atfrfo.json' ) ) ) {
			$fs = $this->get_wp_filesystem();
			if ( $fs ) {
				$fs->rmdir( $project_dir );
			}
		}

		wp_send_json_success( array( 'message' => __( 'Backup deleted.', 'atomic-framework-forge-for-elementor' ) ) );
	}

	// -----------------------------------------------------------------------
	// ENDPOINT: Rename a project (display name + folder slug)
	// -----------------------------------------------------------------------

	public function ajax_atfrfo_rename_project(): void {
		$this->verify_request();

		$old_slug = ATFRFO_Data_Store::sanitize_project_slug( $this->post_param( 'old_slug' ) );
		$new_name = sanitize_text_field( $this->post_param( 'new_name' ) );
		$new_slug = ATFRFO_Data_Store::sanitize_project_slug( $new_name );

		if ( empty( $old_slug ) || empty( $new_name ) || empty( $new_slug ) ) {
			wp_send_json_error( array( 'message' => __( 'Project slug and new name are required.', 'atomic-framework-forge-for-elementor' ) ) );
		}

		$base_dir = ATFRFO_Data_Store::get_wp_storage_dir();
		$old_dir  = $base_dir . $old_slug . '/';
		$new_dir  = $base_dir . $new_slug . '/';

		if ( ! is_dir( $old_dir ) ) {
			wp_send_json_error( array( 'message' => __( 'Project not found.', 'atomic-framework-forge-for-elementor' ) ) );
		}

		if ( $old_slug !== $new_slug && is_dir( $new_dir ) ) {
			wp_send_json_error( array( 'message' => __( 'A project with that name already exists.', 'atomic-framework-forge-for-elementor' ) ) );
		}

		// Update name in every backup file.
		foreach ( glob( $old_dir . '*.atfrfo.json' ) ?: array() as $file ) {
			$raw = json_decode( file_get_contents( $file ), true ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents
			if ( is_array( $raw ) ) {
				$raw['name'] = $new_name;
				if ( isset( $raw['config'] ) && is_array( $raw['config'] ) ) {
					$raw['config']['projectName'] = $new_name;
				}
				file_put_contents( $file, wp_json_encode( $raw, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES ) ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_file_put_contents
			}
		}

		// Rename directory if slug changed.
		if ( $old_slug !== $new_slug ) {
			rename( $old_dir, $new_dir ); // phpcs:ignore WordPress.WP.AlternativeFunctions.rename_rename
		}

		wp_send_json_success(
			array(
				'new_slug' => $new_slug,
				'new_name' => $new_name,
			)
		);
	}

	// -----------------------------------------------------------------------
	// ENDPOINT: Copy a project to a new project name
	// -----------------------------------------------------------------------

	public function ajax_atfrfo_copy_project(): void {
		$this->verify_request();

		$src_slug = ATFRFO_Data_Store::sanitize_project_slug( $this->post_param( 'source_slug' ) );
		$new_name = sanitize_text_field( $this->post_param( 'new_name' ) );
		$new_slug = ATFRFO_Data_Store::sanitize_project_slug( $new_name );

		if ( empty( $src_slug ) || empty( $new_name ) || empty( $new_slug ) ) {
			wp_send_json_error( array( 'message' => __( 'Source slug and new name are required.', 'atomic-framework-forge-for-elementor' ) ) );
		}

		$base_dir = ATFRFO_Data_Store::get_wp_storage_dir();
		$src_dir  = $base_dir . $src_slug . '/';
		$new_dir  = $base_dir . $new_slug . '/';

		if ( ! is_dir( $src_dir ) ) {
			wp_send_json_error( array( 'message' => __( 'Source project not found.', 'atomic-framework-forge-for-elementor' ) ) );
		}
		if ( is_dir( $new_dir ) ) {
			wp_send_json_error( array( 'message' => __( 'A project with that name already exists.', 'atomic-framework-forge-for-elementor' ) ) );
		}

		if ( ! wp_mkdir_p( $new_dir ) ) {
			wp_send_json_error( array( 'message' => __( 'Could not create project directory.', 'atomic-framework-forge-for-elementor' ) ) );
		}

		// Copy each backup file, updating the name fields and generating a new timestamped filename.
		foreach ( glob( $src_dir . '*.atfrfo.json' ) ?: array() as $src_file ) {
			$raw = json_decode( file_get_contents( $src_file ), true ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents
			if ( ! is_array( $raw ) ) {
				continue;
			}
			$raw['name'] = $new_name;
			if ( isset( $raw['config'] ) && is_array( $raw['config'] ) ) {
				$raw['config']['projectName'] = $new_name;
			}
			// generate_backup_filename() now appends a uniqid suffix, so filenames from
			// rapid successive calls no longer collide within the same second (A-04).
			$dest = $new_dir . ATFRFO_Data_Store::generate_backup_filename( $new_slug );
			file_put_contents( $dest, wp_json_encode( $raw, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES ) ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_file_put_contents
		}

		wp_send_json_success(
			array(
				'new_slug' => $new_slug,
				'new_name' => $new_name,
			)
		);
	}

	// -----------------------------------------------------------------------
	// ENDPOINT: Delete an entire project folder (all backups)
	// -----------------------------------------------------------------------

	public function ajax_atfrfo_delete_project_folder(): void {
		$this->verify_request();

		$slug     = ATFRFO_Data_Store::sanitize_project_slug( $this->post_param( 'project_slug' ) );
		$base_dir = ATFRFO_Data_Store::get_wp_storage_dir();
		$dir      = $base_dir . $slug . '/';

		if ( empty( $slug ) || ! is_dir( $dir ) ) {
			wp_send_json_error( array( 'message' => __( 'Project not found.', 'atomic-framework-forge-for-elementor' ) ) );
		}

		foreach ( glob( $dir . '*.atfrfo.json' ) ?: array() as $file ) {
			ATFRFO_Data_Store::delete_baseline( $slug . '/' . basename( $file ) );
			wp_delete_file( $file );
		}

		$fs = $this->get_wp_filesystem();
		if ( $fs ) {
			$fs->rmdir( $dir );
		}

		wp_send_json_success( array( 'message' => __( 'Project deleted.', 'atomic-framework-forge-for-elementor' ) ) );
	}

	// -----------------------------------------------------------------------
	// CLASSES PHASE 3.1 ENDPOINTS — Elementor Global Classes (read + sync)
	// -----------------------------------------------------------------------

	/**
	 * Return the Classes list from the AFF store only — no Elementor contact.
	 *
	 * POST params: filename
	 */
	public function ajax_atfrfo_get_classes(): void {
		$this->verify_request();

		$filename = $this->get_filename_param();
		$store    = $this->load_store( $filename );
		$classes  = $store->get_classes();

		wp_send_json_success(
			array(
				'classes' => $classes,
				'count'   => count( $classes ),
			)
		);
	}

	/**
	 * Fetch Global Classes from Elementor and merge into the AFF store.
	 *
	 * See dev-docs/TECH-DEBT.md A-09: ATFRFO_Classes_Reader::get_all() cannot
	 * distinguish "Elementor genuinely has zero classes" from "the fetch
	 * failed" using an empty list alone — that's what the 'source' check
	 * below is for. Refusing to import on 'unavailable' is the fix; do not
	 * remove this check to "simplify" the endpoint.
	 *
	 * POST params: filename
	 */
	public function ajax_atfrfo_sync_classes(): void {
		$this->with_store(
			function ( ATFRFO_Data_Store $store ): array {
				$reader = new ATFRFO_Classes_Reader();
				$result = $reader->get_all();

				if ( 'unavailable' === $result['source'] ) {
					throw new \Exception( __( 'Could not reach Elementor Global Classes data. Sync aborted — nothing was changed. Confirm Global Classes is enabled in Elementor → Settings → Features.', 'atomic-framework-forge-for-elementor' ) ); // phpcs:ignore WordPress.Security.EscapeOutput.ExceptionNotEscaped
				}

				$summary = $store->import_fetched_classes( $result['classes'] );

				return array(
					'classes' => $store->get_classes(),
					'summary' => $summary,
					'source'  => $result['source'],
				);
			}
		);
	}

	/**
	 * Return where every Global Class is actually used across the site —
	 * reads Elementor's own usage-tracking module (see
	 * ATFRFO_Classes_Reader::get_usage_map() docblock). Does not touch the
	 * .atfrfo.json project file at all, so no filename param and no
	 * with_store() wrapper — this is pure Elementor-side data.
	 *
	 * POST params: none beyond the standard nonce.
	 */
	public function ajax_atfrfo_get_class_usage(): void {
		$this->verify_request();

		$reader = new ATFRFO_Classes_Reader();
		wp_send_json_success( array( 'usage' => $reader->get_usage_map() ) );
	}

	/**
	 * Delete a Global Class from Elementor itself — not just AFF's local
	 * copy. Intentional write-back exception (see ATFRFO CLAUDE.md Critical
	 * Rule #1) — the classes reader stays read-only; this lives here.
	 *
	 * Confirmed safe to delete a class that is currently applied to
	 * elements (2026-08-08, read Elementor's own source): deleting via the
	 * proper Global_Classes_Repository::apply_changes() path fires
	 * `elementor/global_classes/cleanup`, which Elementor's own
	 * Global_Classes_Cleanup listener uses to walk every affected
	 * page/post and strip the deleted class ID from every element's
	 * `classes` prop — the same automatic cleanup Elementor's own editor
	 * relies on when a user deletes a class there. It is not reversible
	 * (undoing does not restore the class to the elements it was stripped
	 * from), but it does not corrupt or orphan anything.
	 *
	 * Deletion only needs the target ID and the resulting order —
	 * Global_Classes_Repository::persist_class_batch_mutations() ignores
	 * $touched_items entirely for deletions (confirmed by reading it), so
	 * this does not need to resend every other class's full data.
	 *
	 * POST params: filename, elementor_id (Elementor's class ID, e.g. 'gc-...')
	 */
	// Intentional Phase 5 write-back exception — see ATFRFO CLAUDE.md Critical Rule #1.
	public function ajax_atfrfo_delete_class_from_elementor(): void {
		$this->verify_request();

		$elementor_id = $this->post_param( 'elementor_id' );
		if ( empty( $elementor_id ) ) {
			wp_send_json_error( array( 'message' => __( 'Elementor class ID is required.', 'atomic-framework-forge-for-elementor' ) ) );
		}

		if ( ! class_exists( '\Elementor\Modules\GlobalClasses\Global_Classes_Repository' ) || ! class_exists( '\Elementor\Plugin' ) ) {
			wp_send_json_error( array( 'message' => __( 'Elementor Global Classes are not available on this site.', 'atomic-framework-forge-for-elementor' ) ) );
		}

		$kit = \Elementor\Plugin::$instance->kits_manager->get_active_kit();
		if ( ! $kit ) {
			wp_send_json_error( array( 'message' => __( 'No active Elementor kit found.', 'atomic-framework-forge-for-elementor' ) ) );
		}

		try {
			$repo    = new \Elementor\Modules\GlobalClasses\Global_Classes_Repository( $kit );
			$order   = $repo->get_order();
			$new_order = array_values(
				array_filter(
					$order,
					static function ( $id ) use ( $elementor_id ) {
						return $id !== $elementor_id;
					}
				)
			);

			if ( count( $new_order ) === count( $order ) ) {
				wp_send_json_error( array( 'message' => __( 'That class was not found in Elementor — it may already have been deleted.', 'atomic-framework-forge-for-elementor' ) ) );
			}

			$repo->apply_changes(
				array(),
				array(
					'added'    => array(),
					'deleted'  => array( $elementor_id ),
					'modified' => array(),
					'order'    => true,
				),
				$new_order
			);
		} catch ( \Throwable $e ) {
			wp_send_json_error( array( 'message' => __( 'Elementor rejected the delete: ', 'atomic-framework-forge-for-elementor' ) . $e->getMessage() ) );
		}

		// Mirror the deletion into AFF's own store so the class disappears
		// from the Classes list without waiting for the next sync.
		$this->with_store(
			function ( ATFRFO_Data_Store $store ) use ( $elementor_id ): array {
				$existing = $store->find_class_by_elementor_id( $elementor_id );
				if ( $existing ) {
					$store->delete_class( $existing['id'] );
				}
				return array(
					'classes' => $store->get_classes(),
					'message' => __( 'Class deleted from Elementor.', 'atomic-framework-forge-for-elementor' ),
				);
			}
		);
	}

	/**
	 * Rename a class for real — pushes the new label to Elementor itself,
	 * not just AFF's local copy. Intentional write-back exception (see
	 * ATFRFO CLAUDE.md Critical Rule #1).
	 *
	 * Why this exists: the AFF-local-only rename (ajax_atfrfo_update_class,
	 * 'label' field) is silently overwritten back to Elementor's stored
	 * label on the next Classes sync (import_fetched_classes() always trusts
	 * Elementor as the source of truth for 'label') — reported 2026-08-08 as
	 * "rename doesn't work." Renaming for real removes the conflict at the
	 * source: once Elementor's own label matches, sync has nothing to
	 * revert.
	 *
	 * Confirmed safe via Elementor's own source: Global_Classes_Repository's
	 * update path (`modified` in apply_changes()) keeps the class's
	 * immutable ID and only changes the label field on the existing post —
	 * it does not delete-and-recreate, so every element referencing this
	 * class by ID keeps working and immediately shows the new name.
	 * Verified live 2026-08-08 that Global_Class_Post::to_array() returns
	 * the exact {id, label, type, variants} shape apply_changes() expects
	 * for a 'modified' item — the existing variants must be sent back
	 * unchanged, or Elementor's normalizer would treat missing variants as
	 * "clear all styles."
	 *
	 * POST params: filename, elementor_id, label (new name)
	 */
	// Intentional Phase 5 write-back exception — see ATFRFO CLAUDE.md Critical Rule #1.
	public function ajax_atfrfo_rename_class_in_elementor(): void {
		$this->verify_request();

		$elementor_id = $this->post_param( 'elementor_id' );
		$new_label    = sanitize_text_field( $this->post_param( 'label' ) );

		if ( empty( $elementor_id ) || '' === $new_label ) {
			wp_send_json_error( array( 'message' => __( 'Class ID and new name are both required.', 'atomic-framework-forge-for-elementor' ) ) );
		}

		if ( ! class_exists( '\Elementor\Modules\GlobalClasses\Global_Classes_Repository' ) || ! class_exists( '\Elementor\Plugin' ) ) {
			wp_send_json_error( array( 'message' => __( 'Elementor Global Classes are not available on this site.', 'atomic-framework-forge-for-elementor' ) ) );
		}

		$kit = \Elementor\Plugin::$instance->kits_manager->get_active_kit();
		if ( ! $kit ) {
			wp_send_json_error( array( 'message' => __( 'No active Elementor kit found.', 'atomic-framework-forge-for-elementor' ) ) );
		}

		try {
			$repo    = new \Elementor\Modules\GlobalClasses\Global_Classes_Repository( $kit );
			$current = $repo->get_by_ids( array( $elementor_id ) );

			if ( empty( $current[ $elementor_id ] ) ) {
				wp_send_json_error( array( 'message' => __( 'That class was not found in Elementor.', 'atomic-framework-forge-for-elementor' ) ) );
			}

			$item          = $current[ $elementor_id ];
			$item['label'] = $new_label;

			$order = $repo->get_order();

			$repo->apply_changes(
				array( $elementor_id => $item ),
				array(
					'added'    => array(),
					'deleted'  => array(),
					'modified' => array( $elementor_id ),
					'order'    => false,
				),
				$order
			);
		} catch ( \Throwable $e ) {
			wp_send_json_error( array( 'message' => __( 'Elementor rejected the rename: ', 'atomic-framework-forge-for-elementor' ) . $e->getMessage() ) );
		}

		// Mirror into AFF's own store so the new name shows immediately,
		// without waiting for the next sync.
		$this->with_store(
			function ( ATFRFO_Data_Store $store ) use ( $elementor_id, $new_label ): array {
				$existing = $store->find_class_by_elementor_id( $elementor_id );
				if ( $existing ) {
					$store->update_class( $existing['id'], array( 'label' => $new_label ) );
				}
				return array(
					'classes' => $store->get_classes(),
					'message' => __( 'Class renamed in Elementor.', 'atomic-framework-forge-for-elementor' ),
				);
			}
		);
	}

	/**
	 * Update an existing class's AFF-local metadata (Comment/notes,
	 * category/category_id reassignment). Does not touch Elementor —
	 * this only edits the AFF store's copy of the class.
	 *
	 * POST params: filename, class (JSON: {id, notes?, category?, category_id?})
	 */
	public function ajax_atfrfo_update_class(): void {
		$class_raw = isset( $_POST['class'] ) ? wp_unslash( $_POST['class'] ) : '';
		$class     = $this->safe_json_decode( $class_raw, __( 'Invalid class data.', 'atomic-framework-forge-for-elementor' ) );

		$id = isset( $class['id'] ) ? sanitize_text_field( $class['id'] ) : '';
		if ( empty( $id ) ) {
			wp_send_json_error( array( 'message' => __( 'Class ID is required.', 'atomic-framework-forge-for-elementor' ) ) );
		}

		$data = array();
		if ( array_key_exists( 'notes', $class ) ) {
			$data['notes'] = sanitize_textarea_field( (string) $class['notes'] );
		}
		if ( array_key_exists( 'category', $class ) ) {
			$data['category'] = sanitize_text_field( (string) $class['category'] );
		}
		if ( array_key_exists( 'category_id', $class ) ) {
			$data['category_id'] = sanitize_text_field( (string) $class['category_id'] );
		}
		// 'label' is deliberately NOT handled here — an AFF-local-only rename
		// used to be possible via this endpoint, but it silently reverted on
		// the next Classes sync (reported 2026-08-08) since
		// import_fetched_classes() always trusts Elementor's stored label.
		// Renaming now goes through ajax_atfrfo_rename_class_in_elementor(),
		// which pushes the new name to Elementor itself so there's nothing
		// left for a sync to revert.
		if ( array_key_exists( 'order', $class ) ) {
			$data['order'] = (int) $class['order'];
		}

		$this->with_store(
			function ( ATFRFO_Data_Store $store ) use ( $id, $data ): array {
				if ( ! $store->update_class( $id, $data ) ) {
					throw new \Exception( __( 'Class not found.', 'atomic-framework-forge-for-elementor' ) ); // phpcs:ignore WordPress.Security.EscapeOutput.ExceptionNotEscaped
				}
				return array(
					'classes' => $store->get_classes(),
					'message' => __( 'Class updated.', 'atomic-framework-forge-for-elementor' ),
				);
			}
		);
	}

	// -----------------------------------------------------------------------
	// PHASE 2 ENDPOINTS — Colors category and variable management
	// -----------------------------------------------------------------------

	/**
	 * Add or update a category in the .atfrfo.json file.
	 *
	 * POST params: filename, subgroup (optional, defaults to 'Colors'),
	 *              category (JSON: {id?, name, order?, locked?, parent_id?})
	 *
	 * parent_id (string|null) — UUID of the parent category for sub-categories,
	 * or null/absent for top-level categories.
	 */
	public function ajax_atfrfo_save_category(): void {
		$subgroup     = $this->get_subgroup_param();
		$category_raw = isset( $_POST['category'] ) ? wp_unslash( $_POST['category'] ) : '';
		$category     = $this->safe_json_decode( $category_raw, __( 'Invalid category data.', 'atomic-framework-forge-for-elementor' ) );

		$name = isset( $category['name'] ) ? sanitize_text_field( $category['name'] ) : '';
		if ( empty( $name ) ) {
			wp_send_json_error( array( 'message' => __( 'Category name is required.', 'atomic-framework-forge-for-elementor' ) ) );
		}

		// Extract and normalise parent_id — empty string treated as null (top-level).
		$raw_parent = isset( $category['parent_id'] ) ? sanitize_text_field( $category['parent_id'] ) : null;
		$parent_id  = ( $raw_parent === '' || $raw_parent === null ) ? null : $raw_parent;
		$has_parent = array_key_exists( 'parent_id', $category );

		$this->with_store(
			function ( $store ) use ( $subgroup, $category, $name, $parent_id, $has_parent ) {
				// Validate that the supplied parent_id references a real category.
				if ( ! is_null( $parent_id ) ) {
					$existing_ids = array_column( $store->get_categories_for_subgroup( $subgroup ), 'id' );
					if ( ! in_array( $parent_id, $existing_ids, true ) ) {
						throw new \Exception( __( 'Parent category not found.', 'atomic-framework-forge-for-elementor' ) ); // phpcs:ignore WordPress.Security.EscapeOutput.ExceptionNotEscaped
					}
				}

				if ( ! empty( $category['id'] ) ) {
					$update_data = array( 'name' => $name );

					// Only update parent_id when the caller explicitly supplied it.
					if ( $has_parent ) {
						// Cycle guard: refuse an assignment that would make this category
						// its own ancestor.
						if ( ! is_null( $parent_id ) && $store->would_create_cycle( $subgroup, $category['id'], $parent_id ) ) {
							throw new \Exception( __( 'Cannot set parent: this would create a circular reference.', 'atomic-framework-forge-for-elementor' ) ); // phpcs:ignore WordPress.Security.EscapeOutput.ExceptionNotEscaped
						}
						$update_data['parent_id'] = $parent_id;
					}

					if ( ! $store->update_category_for_subgroup( $subgroup, $category['id'], $update_data ) ) {
						throw new \Exception( __( 'Category not found.', 'atomic-framework-forge-for-elementor' ) ); // phpcs:ignore WordPress.Security.EscapeOutput.ExceptionNotEscaped
					}
					$id = $category['id'];
				} else {
					$id = $store->add_category_for_subgroup(
						$subgroup,
						array(
							'name'      => $name,
							'parent_id' => $parent_id,
						)
					);
				}

				return array(
					'id'         => $id,
					'categories' => $store->get_categories_for_subgroup( $subgroup ),
					/* translators: %s: category name */
					'message'    => sprintf( __( 'Category "%s" saved.', 'atomic-framework-forge-for-elementor' ), $name ),
				);
			}
		);
	}

	/**
	 * Delete a category from the .atfrfo.json file.
	 *
	 * POST params: filename, subgroup (optional, defaults to 'Colors'), category_id
	 */
	public function ajax_atfrfo_delete_category(): void {
		$subgroup    = $this->get_subgroup_param();
		$category_id = $this->post_param( 'category_id' );
		$delete_vars = $this->post_param( 'delete_vars' ) !== '0';

		if ( empty( $category_id ) ) {
			wp_send_json_error( array( 'message' => __( 'Category ID is required.', 'atomic-framework-forge-for-elementor' ) ) );
		}

		$this->with_store(
			function ( $store ) use ( $subgroup, $category_id, $delete_vars ) {
				if ( ! $store->delete_category_for_subgroup( $subgroup, $category_id, $delete_vars ) ) {
					throw new \Exception( __( 'Category not found or cannot be deleted.', 'atomic-framework-forge-for-elementor' ) ); // phpcs:ignore WordPress.Security.EscapeOutput.ExceptionNotEscaped
				}
				return array(
					'categories' => $store->get_categories_for_subgroup( $subgroup ),
					'variables'  => $store->get_variables(),
					'message'    => __( 'Category deleted.', 'atomic-framework-forge-for-elementor' ),
				);
			}
		);
	}

	/**
	 * Clear a category: remove all sub-categories and variables inside it,
	 * but keep the category shell itself.
	 *
	 * POST params: filename, subgroup (optional, defaults to 'Colors'), category_id
	 */
	public function ajax_atfrfo_clear_category(): void {
		$subgroup    = $this->get_subgroup_param();
		$category_id = $this->post_param( 'category_id' );

		if ( empty( $category_id ) ) {
			wp_send_json_error( array( 'message' => __( 'Category ID is required.', 'atomic-framework-forge-for-elementor' ) ) );
		}

		$this->with_store(
			function ( $store ) use ( $subgroup, $category_id ) {
				if ( ! $store->clear_category_for_subgroup( $subgroup, $category_id ) ) {
					throw new \Exception( __( 'Category not found or cannot be cleared.', 'atomic-framework-forge-for-elementor' ) ); // phpcs:ignore WordPress.Security.EscapeOutput.ExceptionNotEscaped
				}
				return array(
					'categories' => $store->get_categories_for_subgroup( $subgroup ),
					'variables'  => $store->get_variables(),
					'message'    => __( 'Category cleared.', 'atomic-framework-forge-for-elementor' ),
				);
			}
		);
	}

	/**
	 * Reorder categories in the .atfrfo.json file.
	 *
	 * POST params: filename, subgroup (optional, defaults to 'Colors'),
	 *              ordered_ids (JSON array of category UUIDs in desired order)
	 */
	public function ajax_atfrfo_reorder_categories(): void {
		$subgroup    = $this->get_subgroup_param();
		$ids_raw     = isset( $_POST['ordered_ids'] ) ? wp_unslash( $_POST['ordered_ids'] ) : '[]';
		$ordered_ids = $this->safe_json_decode( $ids_raw, __( 'Invalid ordered IDs format.', 'atomic-framework-forge-for-elementor' ) );

		// Sanitize: each ID must be a non-empty string.
		$ordered_ids = array_values(
			array_filter(
				array_map( 'sanitize_text_field', $ordered_ids ),
				static function ( string $id ): bool {
					return ! empty( $id );
				}
			)
		);

		$this->with_store(
			function ( $store ) use ( $subgroup, $ordered_ids ) {
				$store->reorder_categories_for_subgroup( $subgroup, $ordered_ids );
				return array(
					'categories' => $store->get_categories_for_subgroup( $subgroup ),
					'message'    => __( 'Categories reordered.', 'atomic-framework-forge-for-elementor' ),
				);
			}
		);
	}

	/**
	 * Add or update a color variable in the .atfrfo.json file.
	 *
	 * POST params: filename, variable (JSON — full variable object or partial with `id`)
	 */
	public function ajax_atfrfo_save_color(): void {
		$variable_raw = isset( $_POST['variable'] ) ? wp_unslash( $_POST['variable'] ) : '';
		$variable     = $this->safe_json_decode( $variable_raw, __( 'Invalid variable data.', 'atomic-framework-forge-for-elementor' ) );

		$this->with_store(
			function ( $store ) use ( $variable ) {
				if ( ! empty( $variable['id'] ) ) {
					// Update existing variable.
					$allowed_fields = array(
						'name',
						'value',
						'original_value',
						'format',
						'category',
						'category_id',
						'order',
						'status',
						'pending_rename_from',
						'type',
						'subgroup',
						'group',
						'notes',
					);
					$update         = array();
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

					// Reject rename if the new name collides with another variable.
					if ( ! empty( $update['name'] ) && ! empty( $variable['pending_rename_from'] ) ) {
						if ( $this->variable_name_exists( $store->get_variables(), $update['name'], (string) $variable['id'] ) ) {
							throw new \Exception( __( 'A variable with that name already exists.', 'atomic-framework-forge-for-elementor' ) ); // phpcs:ignore WordPress.Security.EscapeOutput.ExceptionNotEscaped
						}
					}

					if ( ! $store->update_variable( $variable['id'], $update ) ) {
						throw new \Exception( __( 'Variable not found.', 'atomic-framework-forge-for-elementor' ) ); // phpcs:ignore WordPress.Security.EscapeOutput.ExceptionNotEscaped
					}
					$id = $variable['id'];
				} else {
					// Add new variable.
					$name = isset( $variable['name'] ) ? sanitize_text_field( $variable['name'] ) : '';
					if ( empty( $name ) || ! $this->is_valid_css_var( $name ) ) {
						throw new \Exception( __( 'Variable name is required, must start with a letter or underscore, and may only contain letters, digits, hyphens, and underscores. Do not include the -- prefix.', 'atomic-framework-forge-for-elementor' ) ); // phpcs:ignore WordPress.Security.EscapeOutput.ExceptionNotEscaped
					}

					if ( $this->variable_name_exists( $store->get_variables(), $name ) ) {
						throw new \Exception( __( 'A variable with that name already exists.', 'atomic-framework-forge-for-elementor' ) ); // phpcs:ignore WordPress.Security.EscapeOutput.ExceptionNotEscaped
					}

					// Validate category_id if provided — reject orphaned references.
					$new_category_id = isset( $variable['category_id'] ) ? sanitize_text_field( $variable['category_id'] ) : '';
					if ( ! empty( $new_category_id ) ) {
						$subgroup_for_cats = isset( $variable['subgroup'] ) ? sanitize_text_field( $variable['subgroup'] ) : 'Colors';
						$existing_cat_ids  = array_column( $store->get_categories_for_subgroup( $subgroup_for_cats ), 'id' );
						if ( ! in_array( $new_category_id, $existing_cat_ids, true ) ) {
							throw new \Exception( __( 'Category not found.', 'atomic-framework-forge-for-elementor' ) ); // phpcs:ignore WordPress.Security.EscapeOutput.ExceptionNotEscaped
						}
					}

					// Remove any existing placeholder copy that arrived with an empty id
					// (e.g., a synced Elementor variable saved via atfrfo_save_file before
					// it was assigned a UUID). Without this, add_variable would create a
					// duplicate alongside the empty-id entry already on disk.
					$store->delete_variable_by_name_if_empty_id( $name );

					$id = $store->add_variable(
						array(
							'name'        => $name,
							'value'       => isset( $variable['value'] ) ? sanitize_text_field( $variable['value'] ) : '',
							'type'        => isset( $variable['type'] ) ? sanitize_text_field( $variable['type'] ) : 'color',
							'subgroup'    => isset( $variable['subgroup'] ) ? sanitize_text_field( $variable['subgroup'] ) : 'Colors',
							'category'    => isset( $variable['category'] ) ? sanitize_text_field( $variable['category'] ) : '',
							'category_id' => isset( $variable['category_id'] ) ? sanitize_text_field( $variable['category_id'] ) : '',
							'format'      => isset( $variable['format'] ) ? sanitize_text_field( $variable['format'] ) : 'HEX',
							'notes'       => isset( $variable['notes'] ) ? sanitize_text_field( $variable['notes'] ) : '',
							'status'      => 'new',
							'source'      => 'user-defined',
						)
					);
				}

				return array(
					'id'      => $id,
					'data'    => $store->get_all_data(),
					'counts'  => $store->get_counts(),
					'message' => __( 'Color variable saved.', 'atomic-framework-forge-for-elementor' ),
				);
			}
		);
	}

	/**
	 * Delete a color variable from the .atfrfo.json file.
	 *
	 * POST params: filename, variable_id, delete_children (optional, '1' to delete children)
	 */
	public function ajax_atfrfo_delete_color(): void {
		$variable_id     = $this->post_param( 'variable_id' );
		$delete_children = isset( $_POST['delete_children'] )
			&& $_POST['delete_children'] !== '0'
			&& $_POST['delete_children'] !== '';

		if ( empty( $variable_id ) ) {
			wp_send_json_error( array( 'message' => __( 'Variable ID is required.', 'atomic-framework-forge-for-elementor' ) ) );
		}

		$this->with_store(
			function ( $store ) use ( $variable_id, $delete_children ) {
				if ( ! $store->delete_variable( $variable_id, $delete_children ) ) {
					throw new \Exception( __( 'Variable not found.', 'atomic-framework-forge-for-elementor' ) ); // phpcs:ignore WordPress.Security.EscapeOutput.ExceptionNotEscaped
				}
				return array(
					'data'    => $store->get_all_data(),
					'counts'  => $store->get_counts(),
					'message' => __( 'Color variable deleted.', 'atomic-framework-forge-for-elementor' ),
				);
			}
		);
	}

	/**
	 * Generate tint/shade/transparency child variables for a parent color variable.
	 *
	 * POST params: filename, parent_id, tints (0–10), shades (0–10), transparencies (0|1)
	 *
	 * Child variable naming (spec §15.7 — ATFRFO-Spec-Colors):
	 *   Tints:          --name-{step*10}     (e.g., --primary-10, --primary-20)
	 *   Shades:         --name-plus-{step*10} (e.g., --primary-plus-10; '+' encoded as '-plus-')
	 *   Transparencies: --name{step*10}       (e.g., --primary10, --primary20; 9 fixed steps)
	 */
	public function ajax_atfrfo_generate_children(): void {
		$parent_id     = $this->post_param( 'parent_id' );
		$tint_steps    = max( 0, min( 10, isset( $_POST['tints'] ) ? (int) $_POST['tints'] : 0 ) );
		$shade_steps   = max( 0, min( 10, isset( $_POST['shades'] ) ? (int) $_POST['shades'] : 0 ) );
		$trans_on      = isset( $_POST['transparencies'] ) && $_POST['transparencies'] !== '0' && $_POST['transparencies'] !== '';
		$tints_cat_id  = $this->post_param( 'tints_category_id' );
		$shades_cat_id = $this->post_param( 'shades_category_id' );
		$trans_cat_id  = $this->post_param( 'transparencies_category_id' );

		if ( empty( $parent_id ) ) {
			wp_send_json_error( array( 'message' => __( 'Parent variable ID is required.', 'atomic-framework-forge-for-elementor' ) ) );
		}

		$this->with_store(
			function ( $store ) use ( $parent_id, $tint_steps, $shade_steps, $trans_on, $tints_cat_id, $shades_cat_id, $trans_cat_id ) {
				// Find parent variable.
				$parent = null;
				foreach ( $store->get_variables() as $var ) {
					if ( $var['id'] === $parent_id ) {
						$parent = $var;
						break;
					}
				}
				if ( ! $parent ) {
					throw new \Exception( __( 'Parent variable not found.', 'atomic-framework-forge-for-elementor' ) ); // phpcs:ignore WordPress.Security.EscapeOutput.ExceptionNotEscaped
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
					throw new \Exception( __( 'Parent variable must have a 6-digit hex value to generate children.', 'atomic-framework-forge-for-elementor' ) ); // phpcs:ignore WordPress.Security.EscapeOutput.ExceptionNotEscaped
				}

				list($h, $s, $l) = $this->hex_to_hsl( $hex );
				$base_name       = preg_replace( '/^--/', '', $parent['name'] );
				$new_ids         = array();
				$subgroup        = $parent['subgroup'] ?? 'Colors';

				// Resolve a category override ID to name + id; fall back to parent's category.
				$resolve_cat = function ( string $override_id ) use ( $store, $parent, $subgroup ): array {
					if ( $override_id !== '' ) {
						foreach ( $store->get_categories_for_subgroup( $subgroup ) as $cat ) {
							if ( $cat['id'] === $override_id ) {
								return array(
									'category'    => $cat['name'],
									'category_id' => $override_id,
								);
							}
						}
					}
					return array(
						'category'    => $parent['category'] ?? '',
						'category_id' => $parent['category_id'] ?? '',
					);
				};

				$tint_cat       = $resolve_cat( $tints_cat_id );
				$shade_cat      = $resolve_cat( $shades_cat_id );
				$trans_cat_info = $resolve_cat( $trans_cat_id );

				// Generate tints: each step i of N shifts lightness equally toward 100% (white).
				// Naming: name-{i*10} e.g. primary-10, primary-20 … primary-30 for N=3.
				if ( $tint_steps > 0 ) {
					for ( $i = 1; $i <= $tint_steps; $i++ ) {
						$tint_l    = min( 98.0, $l + ( 100.0 - $l ) * ( $i / $tint_steps ) );
						$new_ids[] = $store->add_variable(
							array(
								'name'        => $base_name . '-' . ( $i * 10 ),
								'value'       => $this->hsl_to_hex( $h, $s, $tint_l ),
								'type'        => 'color',
								'subgroup'    => $subgroup,
								'category'    => $tint_cat['category'],
								'category_id' => $tint_cat['category_id'],
								'format'      => $parent['format'] ?? 'HEX',
								'status'      => 'new',
								'source'      => 'user-defined',
								'parent_id'   => $parent_id,
							)
						);
					}
				}

				// Generate shades: each step i of N shifts lightness equally toward 0% (black).
				// Naming: name-plus-{i*10} ('+' encoded as '-plus-') e.g. primary-plus-10.
				if ( $shade_steps > 0 ) {
					for ( $i = 1; $i <= $shade_steps; $i++ ) {
						$shade_l   = max( 2.0, $l - $l * ( $i / $shade_steps ) );
						$new_ids[] = $store->add_variable(
							array(
								'name'        => $base_name . '-plus-' . ( $i * 10 ),
								'value'       => $this->hsl_to_hex( $h, $s, $shade_l ),
								'type'        => 'color',
								'subgroup'    => $subgroup,
								'category'    => $shade_cat['category'],
								'category_id' => $shade_cat['category_id'],
								'format'      => $parent['format'] ?? 'HEX',
								'status'      => 'new',
								'source'      => 'user-defined',
								'parent_id'   => $parent_id,
							)
						);
					}
				}

				// Generate transparencies: 9 fixed steps, alpha = step/10 (0.1 to 0.9).
				// Naming: name{step*10} (no separator) e.g. primary10, primary20 … primary90.
				if ( $trans_on ) {
					for ( $i = 1; $i <= 9; $i++ ) {
						$alpha_hex = str_pad( strtoupper( dechex( (int) round( $i * 10 / 100 * 255 ) ) ), 2, '0', STR_PAD_LEFT );
						$new_ids[] = $store->add_variable(
							array(
								'name'        => $base_name . ( $i * 10 ),
								'value'       => '#' . $hex . $alpha_hex,
								'type'        => 'color',
								'subgroup'    => $subgroup,
								'category'    => $trans_cat_info['category'],
								'category_id' => $trans_cat_info['category_id'],
								'format'      => 'HEXA',
								'status'      => 'new',
								'source'      => 'user-defined',
								'parent_id'   => $parent_id,
							)
						);
					}
				}

				return array(
					'new_ids' => $new_ids,
					'data'    => $store->get_all_data(),
					'counts'  => $store->get_counts(),
					/* translators: %d: number of child variables generated */
					'message' => sprintf( __( 'Generated %d child variables.', 'atomic-framework-forge-for-elementor' ), count( $new_ids ) ),
				);
			}
		);
	}

	/**
	 * Save the Elementor baseline snapshot for a .atfrfo.json file.
	 *
	 * POST params: filename, variables (JSON array of {name, value})
	 */
	public function ajax_atfrfo_save_baseline(): void {
		$this->verify_request();

		$filename      = $this->get_filename_param();
		$variables_raw = isset( $_POST['variables'] ) ? wp_unslash( $_POST['variables'] ) : '[]';
		$variables     = $this->safe_json_decode( $variables_raw, __( 'Invalid variables format.', 'atomic-framework-forge-for-elementor' ) );

		// Sanitize: allow only valid CSS custom property entries.
		$sanitized = array();
		foreach ( $variables as $v ) {
			if ( ! is_array( $v ) || ! isset( $v['name'] ) || ! $this->is_valid_css_var( $v['name'] ) ) {
				continue;
			}
			$sanitized[] = array(
				'name'  => sanitize_text_field( $v['name'] ),
				'value' => isset( $v['value'] ) ? sanitize_text_field( $v['value'] ) : '',
			);
		}

		ATFRFO_Data_Store::save_baseline( $filename, $sanitized );

		wp_send_json_success(
			array(
				'count'   => count( $sanitized ),
				'message' => __( 'Baseline saved.', 'atomic-framework-forge-for-elementor' ),
			)
		);
	}

	/**
	 * Retrieve the Elementor baseline snapshot for a .atfrfo.json file.
	 *
	 * POST params: filename
	 */
	public function ajax_atfrfo_get_baseline(): void {
		$this->verify_request();

		$filename  = $this->get_filename_param();
		$variables = ATFRFO_Data_Store::get_baseline( $filename );

		wp_send_json_success(
			array(
				'variables' => $variables,
				'count'     => count( $variables ),
			)
		);
	}

	/**
	 * Commit ATFRFO variables to Elementor.
	 *
	 * PRIMARY: Updates _elementor_global_variables post meta — Elementor's
	 * authoritative store. This makes changes visible in EV4's Variables Manager
	 * and survives Elementor's next CSS regeneration.
	 *
	 * SECONDARY: Also patches the kit CSS file directly for immediate visual
	 * effect without requiring a page reload to trigger EV4 regeneration.
	 *
	 * Deletions: variables present in elementor_snapshot (sent by client) but
	 * absent from the current variable list are removed from EV4 meta. Only
	 * variables ATFRFO has previously imported are eligible for deletion — EV4
	 * variables that ATFRFO has never seen are always left untouched.
	 *
	 * POST params:
	 *   filename           - current .atfrfo.json relative path
	 *   variables          - JSON array of {name, value, type, subgroup, format}
	 *   elementor_snapshot - JSON array of label names from last EV4 import
	 */
	// Intentional Phase 5 write-back exception — see ATFRFO CLAUDE.md Critical Rule #1.
	public function ajax_atfrfo_commit_to_elementor(): void {
		$this->verify_request();

		$filename      = $this->get_filename_param();
		$variables_raw = isset( $_POST['variables'] ) ? wp_unslash( $_POST['variables'] ) : '[]';
		$variables     = $this->safe_json_decode( $variables_raw, __( 'Invalid variables format.', 'atomic-framework-forge-for-elementor' ) );

		$snapshot_raw = isset( $_POST['elementor_snapshot'] ) ? wp_unslash( $_POST['elementor_snapshot'] ) : '[]';
		$snapshot     = json_decode( $snapshot_raw, true );
		if ( ! is_array( $snapshot ) ) {
			$snapshot = array();
		}

		// -----------------------------------------------------------------------
		// PRIMARY — Update _elementor_global_variables post meta.
		// -----------------------------------------------------------------------
		$kit_id      = ATFRFO_CSS_Parser::get_active_kit_id();
		$meta_ok     = false;
		$ev4_updated = array(); // labels updated in existing EV4 entries
		$ev4_created = array(); // labels added as new EV4 entries
		$ev4_deleted = array(); // labels removed from EV4
		// AFF variable UUID -> Elementor ID. Returned so the client can store
		// elementor_id on each variable for future commits — see the ID-first
		// matching block below for why this replaces name-only matching.
		$id_map      = array();

		if ( $kit_id ) {
			$raw = get_post_meta( $kit_id, '_elementor_global_variables', true );

			if ( is_string( $raw ) && '' !== $raw ) {
				$meta = json_decode( $raw, true );
			} else {
				$meta = is_array( $raw ) ? $raw : array();
			}

			if ( empty( $meta ) || ! is_array( $meta ) ) {
				$meta = array(
					'data'      => array(),
					'watermark' => 0,
					'version'   => 2,
				);
			}

			$existing  = is_array( $meta['data'] ?? null ) ? $meta['data'] : array();
			$watermark = (int) ( $meta['watermark'] ?? 0 );
			$now       = current_time( 'Y-m-d H:i:s' );

			// Build a case-insensitive label → EV4 entry ID map for fast lookup.
			// Legacy fallback only — see the ID-first matching below. A variable
			// AFF has never committed before (or committed prior to 2026-08-08,
			// before AFF started storing elementor_id) has no ID to match on yet,
			// so name-matching remains the only option for it.
			$label_index = array();
			foreach ( $existing as $eid => $entry ) {
				$lc = strtolower( $entry['label'] ?? '' );
				if ( '' !== $lc ) {
					$label_index[ $lc ] = $eid;
				}
			}

			// IDs that any current variable is explicitly bound to. These must
			// survive the deletion pass below even if their OLD label is in the
			// snapshot (a rename looks exactly like "old name gone, new name
			// appeared" from a name-only point of view) — deleting-then-
			// recreating a renamed variable would assign it a brand new ID,
			// silently orphaning every class/widget property that referenced
			// the old one. Fixed 2026-08-08 (see dev-docs/AFF-VISION-AND-ROADMAP.md
			// §9 — found while investigating the same class of bug in Classes'
			// own rename, which AFF's own class objects side-stepped by always
			// storing elementor_id; variables never did until now).
			$bound_ids = array();
			foreach ( $variables as $v ) {
				if ( is_array( $v ) && ! empty( $v['elementor_id'] ) && isset( $existing[ $v['elementor_id'] ] ) ) {
					$bound_ids[ $v['elementor_id'] ] = true;
				}
			}

			// Collect the lowercased names of variables being committed.
			$current_names_lc = array();
			foreach ( $variables as $v ) {
				if ( isset( $v['name'] ) && is_string( $v['name'] ) ) {
					$current_names_lc[] = strtolower( $v['name'] );
				}
			}

			// Deletions: snapshot labels no longer present in ATFRFO — but never
			// an ID a current variable is bound to (see $bound_ids above; that's
			// a rename, not a real deletion).
			foreach ( $snapshot as $snap_label ) {
				$snap_lc = strtolower( (string) $snap_label );
				if ( ! in_array( $snap_lc, $current_names_lc, true ) ) {
					if ( isset( $label_index[ $snap_lc ] ) && ! isset( $bound_ids[ $label_index[ $snap_lc ] ] ) ) {
						$eid = $label_index[ $snap_lc ];
						unset( $existing[ $eid ], $label_index[ $snap_lc ] );
						$ev4_deleted[] = (string) $snap_label;
						++$watermark;
					}
				}
			}

			// Compute max order for new entries.
			$max_order = 0;
			foreach ( $existing as $entry ) {
				$o = (int) ( $entry['order'] ?? 0 );
				if ( $o > $max_order ) {
					$max_order = $o;
				}
			}

			// Update or create each ATFRFO variable in EV4 meta.
			foreach ( $variables as $v ) {
				if ( ! is_array( $v ) || ! isset( $v['name'] ) ) {
					continue;
				}

				$label = sanitize_text_field( $v['name'] );
				if ( ! $this->is_valid_css_var( $label ) ) {
					continue;
				}

				$css_value    = sanitize_text_field( $v['value'] ?? '' );
				$atfrfo_type  = sanitize_text_field( $v['type'] ?? '' );
				$subgroup     = sanitize_text_field( $v['subgroup'] ?? '' );
				$format       = sanitize_text_field( $v['format'] ?? '' );
				$label_lc     = strtolower( $label );
				$bound_id     = ! empty( $v['elementor_id'] ) ? sanitize_text_field( $v['elementor_id'] ) : '';
				$meta_value   = $this->build_elementor_meta_value( $css_value, $atfrfo_type, $subgroup, $format );

				if ( '' !== $bound_id && isset( $existing[ $bound_id ] ) ) {
					// ID-matched — a true update-in-place, including rename: the
					// label can differ from what's currently stored and this is
					// still the same entry, same ID, nothing else referencing it
					// breaks.
					$existing[ $bound_id ]['label']      = $label;
					$existing[ $bound_id ]['value']      = $meta_value;
					$existing[ $bound_id ]['updated_at'] = $now;
					++$watermark;
					$ev4_updated[] = $label;
					if ( isset( $v['id'] ) ) {
						$id_map[ $v['id'] ] = $bound_id;
					}
				} elseif ( isset( $label_index[ $label_lc ] ) ) {
					// Legacy fallback: no stored ID yet, matched by name instead —
					// still an update-in-place (preserves the ID), just via a
					// weaker signal. Backfills the ID for next time.
					$eid                            = $label_index[ $label_lc ];
					$existing[ $eid ]['value']       = $meta_value;
					$existing[ $eid ]['updated_at']  = $now;
					++$watermark;
					$ev4_updated[] = $label;
					if ( isset( $v['id'] ) ) {
						$id_map[ $v['id'] ] = $eid;
					}
				} else {
					// Create new entry.
					$new_id   = $this->generate_elementor_var_id();
					$ev4_type = $this->get_elementor_var_type( $atfrfo_type, $subgroup );
					++$max_order;
					$existing[ $new_id ] = array(
						'label'      => $label,
						'value'      => $meta_value,
						'type'       => $ev4_type,
						'order'      => $max_order,
						'created_at' => $now,
						'updated_at' => $now,
					);
					++$watermark;
					$ev4_created[] = $label;
					if ( isset( $v['id'] ) ) {
						$id_map[ $v['id'] ] = $new_id;
					}
				}
			}

			$meta['data']      = $existing;
			$meta['watermark'] = $watermark;

			$encoded = wp_json_encode( $meta );
			if ( false !== $encoded ) {
				update_post_meta( $kit_id, '_elementor_global_variables', $encoded );
				$meta_ok = true;
				// Clear Elementor's CSS cache so it regenerates from the updated meta.
				$this->clear_elementor_css_cache();
			}
		}

		// -----------------------------------------------------------------------
		// SECONDARY — Patch the kit CSS file for immediate visual effect.
		// Keeps the page styled without requiring a browser reload to trigger
		// Elementor's CSS regeneration from the (now updated) meta.
		// -----------------------------------------------------------------------
		$css_committed = array();
		$css_skipped   = array();

		$parser   = new ATFRFO_CSS_Parser();
		$css_file = $parser->find_kit_css_file();

		if ( ! $css_file ) {
			$css_file = $this->try_regenerate_elementor_kit_css();
		}

		if ( $css_file ) {
			$fs = $this->get_wp_filesystem();
			if ( $fs && $fs->is_writable( $css_file ) ) {
				$css = $fs->get_contents( $css_file );
				if ( false !== $css ) {
					foreach ( $variables as $v ) {
						if ( ! is_array( $v ) || ! isset( $v['name'] ) || ! $this->is_valid_css_var( $v['name'] ) ) {
							continue;
						}
						$css_name = sanitize_text_field( '--' . $v['name'] );
						$value    = sanitize_text_field( $v['value'] ?? '' );
						$pattern  = '/' . preg_quote( $css_name, '/' ) . '\s*:\s*[^;]+;/';
						$new_css  = preg_replace( $pattern, $css_name . ': ' . $value . ';', $css, -1, $count );

						if ( $count > 0 ) {
							$css             = $new_css;
							$css_committed[] = $css_name;
						} else {
							$css_skipped[] = $css_name;
						}
					}

					// Insert pass — add variables not yet present in the CSS file.
					if ( ! empty( $css_skipped ) ) {
						$insert_block = '';
						$newly_added  = array();
						foreach ( $css_skipped as $css_name ) {
							foreach ( $variables as $v ) {
								if ( isset( $v['name'] ) && '--' . $v['name'] === $css_name ) {
									$insert_block .= "\n  " . $css_name . ': ' . sanitize_text_field( $v['value'] ?? '' ) . ';';
									$newly_added[] = $css_name;
									break;
								}
							}
						}
						if ( $insert_block ) {
							$pos = $this->find_user_root_close_pos( $css );
							if ( false !== $pos ) {
								$css = substr( $css, 0, $pos ) . $insert_block . "\n" . substr( $css, $pos );
							} else {
								$css .= "\n\n/* ATFRFO user-defined variables */\n:root {" . $insert_block . "\n}\n";
							}
							foreach ( $newly_added as $n ) {
								$css_committed[] = $n;
							}
							$css_skipped = array_values( array_diff( $css_skipped, $newly_added ) );
						}
					}

					if ( ! empty( $css_committed ) ) {
						$fs->put_contents( $css_file, $css, FS_CHMOD_FILE );
					}
				}
			}
		}

		// -----------------------------------------------------------------------
		// BASELINE — record committed values for change-tracking.
		// -----------------------------------------------------------------------
		$all_committed_labels = array_merge( $ev4_updated, $ev4_created );
		$baseline_vars        = array();
		foreach ( $all_committed_labels as $label ) {
			foreach ( $variables as $v ) {
				if ( isset( $v['name'] ) && strtolower( $v['name'] ) === strtolower( $label ) ) {
					$baseline_vars[] = array(
						'name'  => $label,
						'value' => sanitize_text_field( $v['value'] ?? '' ),
					);
					break;
				}
			}
		}
		if ( ! empty( $baseline_vars ) ) {
			$existing_bl = ATFRFO_Data_Store::get_baseline( $filename );
			$index       = array();
			foreach ( $existing_bl as $bv ) {
				$index[ $bv['name'] ] = $bv['value'];
			}
			foreach ( $baseline_vars as $bv ) {
				$index[ $bv['name'] ] = $bv['value'];
			}
			$merged = array();
			foreach ( $index as $n => $val ) {
				$merged[] = array(
					'name'  => $n,
					'value' => $val,
				);
			}
			ATFRFO_Data_Store::save_baseline( $filename, $merged );
		}

		// -----------------------------------------------------------------------
		// RESPONSE
		// -----------------------------------------------------------------------
		$total = count( $all_committed_labels );
		/* translators: %d: number of variables written */
		$msg = sprintf( __( '%d variable(s) written to Elementor.', 'atomic-framework-forge-for-elementor' ), $total );
		if ( ! empty( $ev4_created ) ) {
			/* translators: %d: number of new variables */
			$msg .= ' ' . sprintf( __( '%d new.', 'atomic-framework-forge-for-elementor' ), count( $ev4_created ) );
		}
		if ( ! empty( $ev4_deleted ) ) {
			/* translators: %d: number of removed variables */
			$msg .= ' ' . sprintf( __( '%d removed from Elementor.', 'atomic-framework-forge-for-elementor' ), count( $ev4_deleted ) );
		}
		if ( ! $meta_ok ) {
			$msg .= ' ' . __( '(CSS file only — Elementor kit meta unavailable.)', 'atomic-framework-forge-for-elementor' );
		}

		wp_send_json_success(
			array(
				'committed' => $all_committed_labels,
				'created'   => $ev4_created,
				'deleted'   => $ev4_deleted,
				'skipped'   => $css_skipped,
				'id_map'    => $id_map,
				'message'   => $msg,
			)
		);
	}

	// -----------------------------------------------------------------------
	// PRIVATE HELPERS — Elementor meta write-back
	// -----------------------------------------------------------------------

	/**
	 * Build an Elementor v4 meta value object from an ATFRFO variable's CSS value.
	 *
	 * EV4 wraps every value in { "$$type": "...", "value": ... }. The exact
	 * shape of `value` depends on the type: plain string for colors/strings,
	 * { size, unit } for sizes.
	 *
	 * @param string $css_value Full CSS value string (e.g. '9rem', '#f00', 'clamp(...)').
	 * @param string $atfrfo_type  ATFRFO type field ('color', 'number', 'font', etc.).
	 * @param string $subgroup  ATFRFO subgroup ('Colors', 'Numbers', 'Fonts', etc.).
	 * @param string $format    ATFRFO format field ('HEX', 'REM', 'PX', 'FX', etc.).
	 * @return array EV4 meta value: { $$type, value }.
	 */
	private function build_elementor_meta_value( string $css_value, string $atfrfo_type, string $subgroup, string $format ): array {
		$is_color = ( 'color' === $atfrfo_type || 'Colors' === $subgroup );
		$is_size  = ( 'number' === $atfrfo_type || 'Numbers' === $subgroup );

		if ( $is_color ) {
			return array(
				'$$type' => 'color',
				'value'  => $css_value,
			);
		}

		if ( $is_size ) {
			// FX format = clamp/calc/etc. — store the full expression as a custom unit.
			if ( 'FX' === $format || preg_match( '/^(clamp|calc|min|max)\s*\(/i', $css_value ) ) {
				return array(
					'$$type' => 'size',
					'value'  => array(
						'size' => $css_value,
						'unit' => 'custom',
					),
				);
			}
			$parsed = $this->parse_size_value( $css_value );
			return array(
				'$$type' => 'size',
				'value'  => array(
					'size' => $parsed['size'],
					'unit' => $parsed['unit'],
				),
			);
		}

		// Default: string type (fonts, custom expressions, etc.).
		return array(
			'$$type' => 'string',
			'value'  => $css_value,
		);
	}

	/**
	 * Parse a CSS size value string into a { size, unit } pair.
	 *
	 * @param string $value e.g. '1.5rem', '16px', '100%'
	 * @return array { 'size' => float, 'unit' => string }
	 */
	private function parse_size_value( string $value ): array {
		if ( preg_match( '/^(-?[\d.]+)\s*([a-z%]*)$/i', $value, $m ) ) {
			$unit = strtolower( $m[2] ) ?: 'px';
			return array(
				'size' => (float) $m[1],
				'unit' => $unit,
			);
		}
		// Fallback: treat unrecognised values as custom.
		return array(
			'size' => $value,
			'unit' => 'custom',
		);
	}

	/**
	 * Map ATFRFO type/subgroup to the Elementor variable type string stored in meta.
	 *
	 * @param string $atfrfo_type ATFRFO type field.
	 * @param string $subgroup ATFRFO subgroup.
	 * @return string EV4 type string.
	 */
	private function get_elementor_var_type( string $atfrfo_type, string $subgroup ): string {
		if ( 'color' === $atfrfo_type || 'Colors' === $subgroup ) {
			return 'global-color-variable';
		}
		if ( 'number' === $atfrfo_type || 'Numbers' === $subgroup ) {
			return 'global-size-variable';
		}
		return 'global-variable';
	}

	/**
	 * Generate an Elementor v4 variable ID in e-gv-XXXXXXX format.
	 *
	 * @return string
	 */
	private function generate_elementor_var_id(): string {
		return 'e-gv-' . substr( md5( uniqid( '', true ) ), 0, 7 );
	}

	/**
	 * Clear Elementor's generated CSS cache.
	 *
	 * Deletes cached CSS files so Elementor regenerates them from the
	 * (now updated) post meta on the next page request.
	 */
	private function clear_elementor_css_cache(): void {
		if (
			class_exists( '\Elementor\Plugin' ) &&
			isset( \Elementor\Plugin::$instance->files_manager )
		) {
			\Elementor\Plugin::$instance->files_manager->clear_cache();
		}
	}

	// -----------------------------------------------------------------------
	// PHASE 2 PRIVATE HELPERS
	// -----------------------------------------------------------------------

	/**
	 * Find the closing-brace position of the user-defined :root block in a CSS string.
	 *
	 * Scans all :root { ... } blocks and returns the position of the closing `}` for
	 * the LAST block that contains no system/Elementor variables (i.e., the block that
	 * is safe to insert user-defined custom properties into).
	 *
	 * @param string $css Raw CSS content.
	 * @return int|false Position of `}` in $css, or false if no suitable block found.
	 */
	private function find_user_root_close_pos( string $css ) {
		$system_prefixes = ATFRFO_CSS_Parser::SYSTEM_PREFIXES;

		// Find all :root block positions and their content.
		$offset = 0;
		$best   = false; // position of } in the best (last) user-variables block

		while ( ( $root_pos = strpos( $css, ':root', $offset ) ) !== false ) {
			$open_pos = strpos( $css, '{', $root_pos );
			if ( false === $open_pos ) {
				break;
			}

			$close_pos = strpos( $css, '}', $open_pos );
			if ( false === $close_pos ) {
				break;
			}

			$block_content = substr( $css, $open_pos + 1, $close_pos - $open_pos - 1 );

			// Check if the block has any system variables.
			$has_system = false;
			foreach ( $system_prefixes as $prefix ) {
				if ( strpos( $block_content, $prefix ) !== false ) {
					$has_system = true;
					break;
				}
			}

			if ( ! $has_system ) {
				$best = $close_pos; // track last user-variables block
			}

			$offset = $close_pos + 1;
		}

		return $best;
	}

	/**
	 * Get and validate the `subgroup` POST parameter for category endpoints.
	 *
	 * Returns 'Colors' as the default for backward compatibility.
	 *
	 * 'Classes' added 2026-08-07 — this allowlist gates all four category
	 * CRUD endpoints (save/delete/clear/reorder category). Omitting it here
	 * silently downgraded every Classes category request to 'Colors', so
	 * e.g. renaming a Classes category looked up the ID in the Colors
	 * category array, found nothing, and failed with no visible error —
	 * exactly the bug this was fixing. get_categories_for_subgroup() /
	 * subgroup_to_cat_key() already mapped 'Classes' correctly; this
	 * allowlist was the one place that hadn't been updated to match.
	 *
	 * @return string One of 'Colors', 'Fonts', 'Numbers', 'Classes'.
	 */
	private function get_subgroup_param(): string {
		$subgroup = $this->post_param( 'subgroup', 'Colors' );

		$allowed = array( 'Colors', 'Fonts', 'Numbers', 'Classes' );
		return in_array( $subgroup, $allowed, true ) ? $subgroup : 'Colors';
	}

	/**
	 * Get and validate the `filename` POST parameter, resolved to an absolute path.
	 *
	 * Sends a JSON error and dies if missing or empty.
	 *
	 * @return string Resolved relative path (new or legacy format).
	 */
	private function get_filename_param(): string {
		$raw = $this->post_param( 'filename' );

		if ( empty( $raw ) ) {
			wp_send_json_error( array( 'message' => __( 'Filename is required.', 'atomic-framework-forge-for-elementor' ) ) );
		}

		$resolved = $this->resolve_file( $raw );
		return $resolved['relative'];
	}

	/**
	 * Load a .atfrfo.json file into a new ATFRFO_Data_Store instance.
	 *
	 * Sends a JSON error and dies if the file cannot be read.
	 *
	 * @param string $filename Relative path (slug/file.atfrfo.json or legacy file.atfrfo.json).
	 * @return ATFRFO_Data_Store Loaded store.
	 */
	private function load_store( string $filename ): ATFRFO_Data_Store {
		$dir   = ATFRFO_Data_Store::get_wp_storage_dir();
		$file  = $dir . $filename;
		$store = new ATFRFO_Data_Store();

		if ( file_exists( $file ) && ! $store->load_from_file( $file ) ) {
			wp_send_json_error( array( 'message' => __( 'Could not read or parse ATFRFO file.', 'atomic-framework-forge-for-elementor' ) ) );
		}

		return $store;
	}

	/**
	 * Save a data store to its .atfrfo.json file.
	 *
	 * Sends a JSON error and dies if the file cannot be written.
	 *
	 * @param ATFRFO_Data_Store $store    Store to save.
	 * @param string         $filename Relative path (slug/file.atfrfo.json or legacy file.atfrfo.json).
	 */
	private function save_store( ATFRFO_Data_Store $store, string $filename ): void {
		$dir  = ATFRFO_Data_Store::get_wp_storage_dir();
		$file = $dir . $filename;

		if ( ! $store->save_to_file( $file ) ) {
			wp_send_json_error( array( 'message' => __( 'Could not write ATFRFO file. Check directory permissions.', 'atomic-framework-forge-for-elementor' ) ) );
		}
	}

	/**
	 * Verify the request, load the store, run $callback, save, and send JSON success.
	 *
	 * Handles nonce verification and capability check internally — callers must NOT
	 * call verify_request() before with_store(). Security is owned here.
	 *
	 * The callback receives the ATFRFO_Data_Store instance and must return the array
	 * to pass to wp_send_json_success(). Throw an \Exception to send an error instead.
	 *
	 * @param callable $callback function( ATFRFO_Data_Store $store ): array
	 */
	private function with_store( callable $callback ): void {
		$this->verify_request();
		$filename = $this->get_filename_param();
		$store    = $this->load_store( $filename );
		try {
			$result = $callback( $store );
			$this->save_store( $store, $filename );
			wp_send_json_success( $result );
		} catch ( \Exception $e ) {
			wp_send_json_error( array( 'message' => $e->getMessage() ) );
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
			list($r1, $g1, $b1) = array( $c, $x, 0.0 );
		} elseif ( $h < 120 ) {
			list($r1, $g1, $b1) = array( $x, $c, 0.0 );
		} elseif ( $h < 180 ) {
			list($r1, $g1, $b1) = array( 0.0, $c, $x );
		} elseif ( $h < 240 ) {
			list($r1, $g1, $b1) = array( 0.0, $x, $c );
		} elseif ( $h < 300 ) {
			list($r1, $g1, $b1) = array( $x, 0.0, $c );
		} else {
			list($r1, $g1, $b1) = array( $c, 0.0, $x );
		}

		$r = (int) round( ( $r1 + $m ) * 255 );
		$g = (int) round( ( $g1 + $m ) * 255 );
		$b = (int) round( ( $b1 + $m ) * 255 );

		return sprintf( '#%02x%02x%02x', $r, $g, $b );
	}

	// -----------------------------------------------------------------------
	// PRIVATE HELPER — WordPress Filesystem
	// -----------------------------------------------------------------------

	/**
	 * Initialize and return the WP_Filesystem instance.
	 *
	 * Uses the direct filesystem method for wp-content/uploads/ operations,
	 * which never requires credential prompts. Returns null on failure.
	 *
	 * @return \WP_Filesystem_Base|null
	 */
	private function get_wp_filesystem(): ?\WP_Filesystem_Base {
		global $wp_filesystem;
		if ( empty( $wp_filesystem ) ) {
			require_once ABSPATH . 'wp-admin/includes/file.php';
			if ( ! WP_Filesystem() ) {
				return null;
			}
		}
		return $wp_filesystem;
	}

	// -----------------------------------------------------------------------
	// PRIVATE HELPERS — REQUEST, DECODING & VALIDATION
	// -----------------------------------------------------------------------

	// Names are stored as typed (matching EV4's display). A name may optionally
	// start with -- (the user typed '--purple' in EV4) or with a letter/underscore.
	// The commit path prepends -- for CSS output, so '--purple' → '----purple',
	// matching what EV4 would write for a variable the user named '--purple'.
	private const CSS_VAR_PATTERN = '/^(--)?[A-Za-z_][A-Za-z0-9_-]*$/';

	/**
	 * Decode a JSON string and send an error response if decoding fails.
	 *
	 * @param string $raw           Raw JSON string (already unslashed).
	 * @param string $error_message Error message for the JSON error response.
	 * @return array Decoded associative array.
	 */
	private function safe_json_decode( string $raw, string $error_message ): array {
		$decoded = json_decode( $raw, true );
		if ( JSON_ERROR_NONE !== json_last_error() || ! is_array( $decoded ) ) {
			wp_send_json_error( array( 'message' => $error_message ) );
		}
		return $this->sanitize_deep( $decoded );
	}

	/**
	 * Recursively sanitize every string value in a decoded JSON structure.
	 *
	 * json_decode() does not sanitize — a decoded payload can still carry
	 * HTML/script content in any string leaf. Applied centrally here (the
	 * single point all 11 safe_json_decode() call sites funnel through)
	 * rather than at each individual endpoint. Only string values are
	 * touched; array keys, and non-string leaves (bool/int/float/null —
	 * e.g. `locked`, usage counts, `order`) pass through unchanged so
	 * downstream strict-type checks keep working.
	 *
	 * @param array $data Decoded JSON as a PHP array (possibly nested).
	 * @return array Same structure, every string value run through sanitize_text_field().
	 */
	private function sanitize_deep( array $data ): array {
		foreach ( $data as $key => $value ) {
			if ( is_array( $value ) ) {
				$data[ $key ] = $this->sanitize_deep( $value );
			} elseif ( is_string( $value ) ) {
				$data[ $key ] = sanitize_text_field( $value );
			}
			// bool/int/float/null: left as-is.
		}
		return $data;
	}

	/**
	 * Get a sanitized string value from $_POST.
	 *
	 * @param string $key     POST parameter name.
	 * @param string $default Default value if the key is absent.
	 * @return string Sanitized value.
	 */
	private function post_param( string $key, string $default = '' ): string {
		return isset( $_POST[ $key ] )
			? sanitize_text_field( wp_unslash( $_POST[ $key ] ) )
			: $default;
	}

	/**
	 * Check whether a string is a valid CSS custom property name.
	 *
	 * Names are stored without the -- prefix; this validates the bare identifier.
	 *
	 * @param string $name String to test.
	 * @return bool True if the name is a valid bare identifier (no leading dashes).
	 */
	private function is_valid_css_var( string $name ): bool {
		return preg_match( self::CSS_VAR_PATTERN, $name ) === 1;
	}


	// -----------------------------------------------------------------------
	// FILE PATH RESOLUTION
	// -----------------------------------------------------------------------

	/**
	 * Resolve a raw filename POST param to an absolute path.
	 *
	 * Handles new subdirectory format (slug/slug_YYYY-MM-DD_HH-II-SS.atfrfo.json)
	 * and old flat format (slug.atfrfo.json) for backward compat.
	 * Exits with JSON error on invalid input.
	 *
	 * @param string $raw Raw filename value from POST.
	 * @return array { absolute: string, relative: string }
	 */
	private function resolve_file( string $raw ): array {
		$dir = ATFRFO_Data_Store::get_wp_storage_dir();

		if ( strpos( $raw, '/' ) !== false ) {
			// New subdirectory format — validate, prevent path traversal.
			$rel = ltrim( $raw, '/' );
			if ( strpos( $rel, '..' ) !== false ) {
				wp_send_json_error( array( 'message' => __( 'Invalid path.', 'atomic-framework-forge-for-elementor' ) ) );
			}
			$abs = $dir . $rel;
			// Only use realpath if the directory already exists; if it doesn't,
			// the caller's file_exists() check will handle it gracefully.
			$real = realpath( dirname( $abs ) );
			if ( $real ) {
				$base = rtrim( realpath( $dir ) ?: $dir, DIRECTORY_SEPARATOR );
				if ( strpos( $real, $base ) !== 0 ) {
					wp_send_json_error( array( 'message' => __( 'Invalid path.', 'atomic-framework-forge-for-elementor' ) ) );
				}
			}
			return array(
				'absolute' => $abs,
				'relative' => $rel,
			);
		}

		// Old flat format — backward compat.
		$filename = ATFRFO_Data_Store::sanitize_filename( $raw );
		return array(
			'absolute' => $dir . $filename,
			'relative' => $filename,
		);
	}

	// -----------------------------------------------------------------------
	// SHARED GUARD
	// -----------------------------------------------------------------------

	/**
	 * Verify nonce and capability. Sends JSON error and dies on failure.
	 */
	private function verify_request(): void {
		if ( ! check_ajax_referer( ATFRFO_NONCE_ACTION, 'nonce', false ) ) {
			wp_send_json_error(
				array( 'message' => __( 'Security check failed.', 'atomic-framework-forge-for-elementor' ) ),
				403
			);
		}

		if ( ! current_user_can( 'manage_options' ) ) {
			wp_send_json_error(
				array( 'message' => __( 'Insufficient permissions.', 'atomic-framework-forge-for-elementor' ) ),
				403
			);
		}
	}

	// -----------------------------------------------------------------------
	// PRIVATE HELPER — duplicate variable name check
	// -----------------------------------------------------------------------

	/**
	 * Return true if a variable with $name already exists in $variables,
	 * optionally ignoring the variable identified by $exclude_id (used on
	 * rename so the variable does not conflict with itself).
	 *
	 * @param array       $variables   Full variables array from the data store.
	 * @param string      $name        Name to check (case-insensitive).
	 * @param string|null $exclude_id  Variable id to skip, or null to skip none.
	 */
	private function variable_name_exists( array $variables, string $name, ?string $exclude_id = null ): bool {
		foreach ( $variables as $v ) {
			if ( strtolower( $v['name'] ) === strtolower( $name ) ) {
				if ( $exclude_id === null || (string) $v['id'] !== (string) $exclude_id ) {
					return true;
				}
			}
		}
		return false;
	}

	// -----------------------------------------------------------------------
	// PRIVATE HELPER — Elementor kit CSS regeneration
	// -----------------------------------------------------------------------

	/**
	 * Attempt to regenerate the Elementor kit CSS file via Elementor's CSS API.
	 *
	 * Called when find_kit_css_file() returns null, meaning the file does not yet
	 * exist on disk (fresh install, cache clear, etc.). Elementor's Post CSS class
	 * reads kit settings from post meta and writes the CSS file without a page load.
	 *
	 * Returns the path to the regenerated file, or null if Elementor is not
	 * available or regeneration fails.
	 *
	 * @return string|null Absolute path to the kit CSS file, or null on failure.
	 */
	private function try_regenerate_elementor_kit_css(): ?string {
		$kit_id = ATFRFO_CSS_Parser::get_active_kit_id();
		if ( ! $kit_id ) {
			return null;
		}

		// Elementor must be active and its CSS class available.
		if (
			! class_exists( '\Elementor\Plugin' ) ||
			! isset( \Elementor\Plugin::$instance ) ||
			! class_exists( '\Elementor\Core\Files\CSS\Post' )
		) {
			return null;
		}

		try {
			$css_obj = new \Elementor\Core\Files\CSS\Post( $kit_id );
			$css_obj->update();
		} catch ( \Throwable $e ) {
			if ( defined( 'WP_DEBUG' ) && WP_DEBUG ) {
				error_log( 'ATFRFO: Failed to regenerate Elementor kit CSS (kit ID ' . $kit_id . '): ' . $e->getMessage() ); // phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_error_log
			}
			return null;
		}

		// Re-check for the file after regeneration.
		$parser = new ATFRFO_CSS_Parser();
		return $parser->find_kit_css_file();
	}

	// -----------------------------------------------------------------------
	// ENDPOINT: Sync V3 Global Colors
	// -----------------------------------------------------------------------

	/**
	 * Read Elementor V3 Global Colors from the active kit post meta and return
	 * them as an array of { name, value } objects for import into ATFRFO.
	 *
	 * V3 Global Colors are stored in `_elementor_page_settings` → `system_colors`
	 * and `custom_colors` as arrays of { _id, title, color } objects.
	 * The CSS variable name is derived as `--e-global-color-{_id}`.
	 */
	public function ajax_atfrfo_sync_v3_global_colors(): void {
		$this->verify_request();

		$kit_id = ATFRFO_CSS_Parser::get_active_kit_id();
		if ( ! $kit_id ) {
			wp_send_json_error(
				array(
					'message' => __( 'No active Elementor kit found.', 'atomic-framework-forge-for-elementor' ),
				)
			);
		}

		$settings = get_post_meta( $kit_id, '_elementor_page_settings', true );
		if ( ! is_array( $settings ) ) {
			wp_send_json_error(
				array(
					'message' => __( 'Could not read Elementor kit settings. Make sure the kit has been saved at least once.', 'atomic-framework-forge-for-elementor' ),
				)
			);
		}

		$color_groups = array();
		if ( ! empty( $settings['system_colors'] ) && is_array( $settings['system_colors'] ) ) {
			$color_groups['system'] = $settings['system_colors'];
		}
		if ( ! empty( $settings['custom_colors'] ) && is_array( $settings['custom_colors'] ) ) {
			$color_groups['custom'] = $settings['custom_colors'];
		}

		$imported = array();
		foreach ( $color_groups as $group_key => $group ) {
			foreach ( $group as $color ) {
				if ( empty( $color['_id'] ) || empty( $color['color'] ) ) {
					continue;
				}
				$elementor_var = '--e-global-color-' . sanitize_key( $color['_id'] );
				$value         = sanitize_text_field( $color['color'] );
				// Ensure value starts with '#' for bare hex values (Elementor stores
				// them without the leading hash in older kit data).
				if ( preg_match( '/^[0-9a-fA-F]{3,8}$/', $value ) ) {
					$value = '#' . $value;
				}
				$imported[] = array(
					'elementor_var' => $elementor_var,
					'value'         => $value,
					'title'         => isset( $color['title'] ) ? sanitize_text_field( $color['title'] ) : '',
					'source_group'  => $group_key,
				);
			}
		}

		wp_send_json_success(
			array(
				'imported' => $imported,
				'count'    => count( $imported ),
			)
		);
	}

	// -----------------------------------------------------------------------
	// ENDPOINT: Diagnostics
	// -----------------------------------------------------------------------

	/**
	 * Return a duplicate report for the current project file. No data is changed.
	 */
	public function ajax_atfrfo_get_diagnostics(): void {
		$this->verify_request();

		$filename = $this->get_filename_param();
		$store    = new ATFRFO_Data_Store();

		if ( ! $store->load_from_file( ATFRFO_Data_Store::get_wp_storage_dir() . $filename ) ) {
			wp_send_json_error( array( 'message' => __( 'Could not load project file.', 'atomic-framework-forge-for-elementor' ) ) );
			return;
		}

		wp_send_json_success( $store->get_diagnostics() );
	}

	// -----------------------------------------------------------------------
	// ENDPOINT: Deduplicate
	// -----------------------------------------------------------------------

	/**
	 * Remove duplicate variables and categories from the current project file,
	 * save the result, and return a summary of what was removed.
	 */
	public function ajax_atfrfo_deduplicate(): void {
		$this->verify_request();

		$filename = $this->get_filename_param();
		$path     = ATFRFO_Data_Store::get_wp_storage_dir() . $filename;
		$store    = new ATFRFO_Data_Store();

		if ( ! $store->load_from_file( $path ) ) {
			wp_send_json_error( array( 'message' => __( 'Could not load project file.', 'atomic-framework-forge-for-elementor' ) ) );
			return;
		}

		$result = $store->deduplicate();

		if ( $result['removed_variables'] > 0 || $result['removed_categories'] > 0 ) {
			if ( ! $store->save_to_file( $path ) ) {
				wp_send_json_error( array( 'message' => __( 'Deduplication complete but file save failed.', 'atomic-framework-forge-for-elementor' ) ) );
				return;
			}
		}

		wp_send_json_success(
			array_merge(
				$result,
				array(
					'variables' => $store->get_variables(),
				)
			)
		);
	}
}
