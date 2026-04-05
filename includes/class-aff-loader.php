<?php
/**
 * AFF Loader — Hook Registration & Bootstrap
 *
 * Loads all includes and wires up the WordPress integration layer.
 * Keep WordPress-specific bootstrapping here; keep business logic
 * in the individual class files.
 *
 * @package AtomicFrameworkForge
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class AFF_Loader {

	/**
	 * Require all includes and initialize all subsystems.
	 */
	public function init(): void {
		require_once AFF_PLUGIN_DIR . 'includes/class-aff-settings.php';
		require_once AFF_PLUGIN_DIR . 'includes/class-aff-data-store.php';
		require_once AFF_PLUGIN_DIR . 'includes/class-aff-css-parser.php';
		require_once AFF_PLUGIN_DIR . 'includes/class-aff-usage-scanner.php';
		require_once AFF_PLUGIN_DIR . 'includes/class-aff-ajax-handler.php';
		require_once AFF_PLUGIN_DIR . 'includes/class-aff-admin.php';

		$admin = new AFF_Admin();
		$admin->register_hooks();

		$ajax = new AFF_Ajax_Handler();
		$ajax->register_handlers();
	}
}
