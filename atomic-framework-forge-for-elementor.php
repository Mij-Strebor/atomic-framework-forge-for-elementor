<?php
/**
 * Plugin Name:       Atomic Framework Forge for Elementor
 * Plugin URI:        https://jimrforge.com/atomic-framework-forge/
 * Description:       Professional management interface for Elementor Version 4 (atomic widget architecture) assets — Variables, Classes, and Components.
 * Version:           1.4.0
 * Requires at least: 5.8
 * Requires PHP:      8.2
 * Requires Plugins:  elementor
 * Author:            Jim Roberts
 * Author URI:        https://jimrforge.com
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       atomic-framework-forge-for-elementor
 * Domain Path:       /languages
 *
 * @package AtomicFrameworkForge
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

// Plugin constants.
define( 'ATFRFO_VERSION',    '1.4.0' );
define( 'ATFRFO_PLUGIN_FILE', __FILE__ );
define( 'ATFRFO_PLUGIN_DIR',  plugin_dir_path( __FILE__ ) );
define( 'ATFRFO_PLUGIN_URL',  plugin_dir_url( __FILE__ ) );
define( 'ATFRFO_SLUG',           'atomic-framework-forge' );
define( 'ATFRFO_NONCE_ACTION',   'atfrfo_admin_nonce' );
define( 'ATFRFO_USER_META_THEME', 'atfrfo_theme_preference' );
define( 'ATFRFO_USER_META_NOTIFY_COUNT', 'atfrfo_notify_shown_count' );
define( 'ATFRFO_NOTIFY_MAX_SHOWS', 3 );

// Elementor versions this build was developed and tested against.
// Update these constants whenever ATFRFO is re-validated on a new Elementor release.
// A mismatch at runtime triggers a pre-commit safety warning to the user.
define( 'ATFRFO_DEV_ELEMENTOR_VERSION',     '4.1.3' );
define( 'ATFRFO_DEV_ELEMENTOR_PRO_VERSION', '4.1.1' );

/**
 * Check that required plugins (Elementor + Elementor Pro) are active.
 *
 * @return string[] Array of error messages. Empty array = all good.
 */
function atfrfo_check_dependencies(): array {
	$errors = array();

	if ( ! defined( 'ELEMENTOR_VERSION' ) ) {
		$errors[] = __( 'Atomic Framework Forge for Elementor requires <strong>Elementor</strong> to be installed and active.', 'atomic-framework-forge-for-elementor' );
	}

	if ( ! defined( 'ELEMENTOR_PRO_VERSION' ) ) {
		$errors[] = __( 'Atomic Framework Forge for Elementor requires <strong>Elementor Pro</strong> to be installed and active.', 'atomic-framework-forge-for-elementor' );
	}

	return $errors;
}

/**
 * Render admin notices for missing dependencies.
 */
function atfrfo_dependency_notice(): void {
	$errors = atfrfo_check_dependencies();
	foreach ( $errors as $error ) {
		printf(
			'<div class="notice notice-error"><p>%s</p></div>',
			wp_kses( $error, array( 'strong' => array() ) )
		);
	}
}

/**
 * Bootstrap ATFRFO after all plugins have loaded.
 */
function atfrfo_init(): void {
	$errors = atfrfo_check_dependencies();

	if ( ! empty( $errors ) ) {
		add_action( 'admin_notices', 'atfrfo_dependency_notice' );
		return;
	}

	require_once ATFRFO_PLUGIN_DIR . 'includes/class-atfrfo-loader.php';
	$loader = new ATFRFO_Loader();
	$loader->init();
}
add_action( 'plugins_loaded', 'atfrfo_init' );

/**
 * Plugin activation: create the ATFRFO uploads directory.
 */
function atfrfo_activate(): void {
	$upload_dir = wp_upload_dir();
	$atfrfo_dir    = $upload_dir['basedir'] . '/atfrfo/';
	if ( ! file_exists( $atfrfo_dir ) ) {
		wp_mkdir_p( $atfrfo_dir );
	}
}
register_activation_hook( __FILE__, 'atfrfo_activate' );

/**
 * Plugin deactivation: nothing to clean up in v1.
 */
function atfrfo_deactivate(): void {}
register_deactivation_hook( __FILE__, 'atfrfo_deactivate' );
