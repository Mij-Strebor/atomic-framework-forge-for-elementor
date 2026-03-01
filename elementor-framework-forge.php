<?php
/**
 * Plugin Name:       Elementor Framework Forge
 * Plugin URI:        https://jimrforge.com/plugins/elementor-framework-forge
 * Description:       Professional management interface for Elementor Version 4 (atomic widget architecture) assets — Variables, Classes, and Components.
 * Version:           1.0.0
 * Requires at least: 5.8
 * Requires PHP:      7.4
 * Author:            Jim Roberts
 * Author URI:        https://jimrforge.com
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       elementor-framework-forge
 * Domain Path:       /languages
 *
 * @package ElementorFrameworkForge
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

// Plugin constants.
define( 'EFF_VERSION',    '1.0.0' );
define( 'EFF_PLUGIN_FILE', __FILE__ );
define( 'EFF_PLUGIN_DIR',  plugin_dir_path( __FILE__ ) );
define( 'EFF_PLUGIN_URL',  plugin_dir_url( __FILE__ ) );
define( 'EFF_SLUG',        'elementor-framework-forge' );

/**
 * Check that required plugins (Elementor + Elementor Pro) are active.
 *
 * @return string[] Array of error messages. Empty array = all good.
 */
function eff_check_dependencies(): array {
	$errors = array();

	if ( ! defined( 'ELEMENTOR_VERSION' ) ) {
		$errors[] = __( 'Elementor Framework Forge requires <strong>Elementor</strong> to be installed and active.', 'elementor-framework-forge' );
	}

	if ( ! defined( 'ELEMENTOR_PRO_VERSION' ) ) {
		$errors[] = __( 'Elementor Framework Forge requires <strong>Elementor Pro</strong> to be installed and active.', 'elementor-framework-forge' );
	}

	return $errors;
}

/**
 * Render admin notices for missing dependencies.
 */
function eff_dependency_notice(): void {
	$errors = eff_check_dependencies();
	foreach ( $errors as $error ) {
		printf(
			'<div class="notice notice-error"><p>%s</p></div>',
			wp_kses( $error, array( 'strong' => array() ) )
		);
	}
}

/**
 * Bootstrap EFF after all plugins have loaded.
 */
function eff_init(): void {
	$errors = eff_check_dependencies();

	if ( ! empty( $errors ) ) {
		add_action( 'admin_notices', 'eff_dependency_notice' );
		return;
	}

	require_once EFF_PLUGIN_DIR . 'includes/class-eff-loader.php';
	$loader = new EFF_Loader();
	$loader->init();
}
add_action( 'plugins_loaded', 'eff_init' );

/**
 * Plugin activation: create the EFF uploads directory.
 */
function eff_activate(): void {
	$upload_dir = wp_upload_dir();
	$eff_dir    = $upload_dir['basedir'] . '/eff/';
	if ( ! file_exists( $eff_dir ) ) {
		wp_mkdir_p( $eff_dir );
	}
}
register_activation_hook( __FILE__, 'eff_activate' );

/**
 * Plugin deactivation: nothing to clean up in v1.
 */
function eff_deactivate(): void {}
register_deactivation_hook( __FILE__, 'eff_deactivate' );
