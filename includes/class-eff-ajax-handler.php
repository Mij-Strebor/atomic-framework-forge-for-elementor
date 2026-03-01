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
			'eff_save_file',
			'eff_load_file',
			'eff_sync_from_elementor',
			'eff_save_user_theme',
			'eff_get_config',
			'eff_save_config',
			'eff_save_settings',
			'eff_get_settings',
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
			wp_send_json_error( array(
				'message' => __( 'Elementor kit CSS file not found. Regenerate CSS from Elementor → Tools → Regenerate Files.', 'elementor-framework-forge' ),
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
	// ENDPOINT: Get plugin settings
	// -----------------------------------------------------------------------

	public function ajax_eff_get_settings(): void {
		$this->verify_request();
		wp_send_json_success( array( 'settings' => EFF_Settings::get() ) );
	}

	// -----------------------------------------------------------------------
	// SHARED GUARD
	// -----------------------------------------------------------------------

	/**
	 * Verify nonce and capability. Sends JSON error and dies on failure.
	 */
	private function verify_request(): void {
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
