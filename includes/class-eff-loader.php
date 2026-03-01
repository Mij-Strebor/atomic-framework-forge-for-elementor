<?php
/**
 * EFF Loader — Hook Registration & Bootstrap
 *
 * Loads all includes and wires up the WordPress integration layer.
 * Keep WordPress-specific bootstrapping here; keep business logic
 * in the individual class files.
 *
 * @package ElementorFrameworkForge
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class EFF_Loader {

	/**
	 * Require all includes and initialize all subsystems.
	 */
	public function init(): void {
		require_once EFF_PLUGIN_DIR . 'includes/class-eff-settings.php';
		require_once EFF_PLUGIN_DIR . 'includes/class-eff-data-store.php';
		require_once EFF_PLUGIN_DIR . 'includes/class-eff-css-parser.php';
		require_once EFF_PLUGIN_DIR . 'includes/class-eff-ajax-handler.php';
		require_once EFF_PLUGIN_DIR . 'includes/class-eff-admin.php';

		$admin = new EFF_Admin();
		$admin->register_hooks();

		$ajax = new EFF_Ajax_Handler();
		$ajax->register_handlers();
	}
}
