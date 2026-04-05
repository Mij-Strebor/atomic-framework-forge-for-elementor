<?php
/**
 * Plugin Name:       Atomic Framework Forge for Elementor
 * Plugin URI:        https://jimrforge.com/plugins/atomic-framework-forge-for-elementor
 * Description:       Professional management interface for Elementor Version 4 (atomic widget architecture) assets — Variables, Classes, and Components.
 * Version:           0.3.3-beta
 * Requires at least: 5.8
 * Requires PHP:      7.4
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
define( 'AFF_VERSION',    '0.3.3-beta' );
define( 'AFF_PLUGIN_FILE', __FILE__ );
define( 'AFF_PLUGIN_DIR',  plugin_dir_path( __FILE__ ) );
define( 'AFF_PLUGIN_URL',  plugin_dir_url( __FILE__ ) );
define( 'AFF_SLUG',           'atomic-framework-forge' );
define( 'AFF_NONCE_ACTION',   'aff_admin_nonce' );
define( 'AFF_USER_META_THEME', 'aff_theme_preference' );

/**
 * Check that required plugins (Elementor + Elementor Pro) are active.
 *
 * @return string[] Array of error messages. Empty array = all good.
 */
function aff_check_dependencies(): array {
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
function aff_dependency_notice(): void {
	$errors = aff_check_dependencies();
	foreach ( $errors as $error ) {
		printf(
			'<div class="notice notice-error"><p>%s</p></div>',
			wp_kses( $error, array( 'strong' => array() ) )
		);
	}
}

/**
 * Bootstrap AFF after all plugins have loaded.
 */
function aff_init(): void {
	$errors = aff_check_dependencies();

	if ( ! empty( $errors ) ) {
		add_action( 'admin_notices', 'aff_dependency_notice' );
		return;
	}

	require_once AFF_PLUGIN_DIR . 'includes/class-aff-loader.php';
	$loader = new AFF_Loader();
	$loader->init();
}
add_action( 'plugins_loaded', 'aff_init' );

/**
 * Plugin activation: create the AFF uploads directory.
 */
function aff_activate(): void {
	$upload_dir = wp_upload_dir();
	$aff_dir    = $upload_dir['basedir'] . '/aff/';
	if ( ! file_exists( $aff_dir ) ) {
		wp_mkdir_p( $aff_dir );
	}
}
register_activation_hook( __FILE__, 'aff_activate' );

/**
 * Plugin deactivation: nothing to clean up in v1.
 */
function aff_deactivate(): void {}
register_deactivation_hook( __FILE__, 'aff_deactivate' );
