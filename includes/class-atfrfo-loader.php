<?php
/**
 * ATFRFO Loader — Hook Registration & Bootstrap
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

class ATFRFO_Loader {

	/**
	 * Require all includes and initialize all subsystems.
	 */
	public function init(): void {
		require_once ATFRFO_PLUGIN_DIR . 'includes/class-atfrfo-settings.php';
		require_once ATFRFO_PLUGIN_DIR . 'includes/class-atfrfo-data-store.php';
		require_once ATFRFO_PLUGIN_DIR . 'includes/class-atfrfo-css-parser.php';
		require_once ATFRFO_PLUGIN_DIR . 'includes/class-atfrfo-classes-reader.php';
		require_once ATFRFO_PLUGIN_DIR . 'includes/class-atfrfo-usage-scanner.php';
		require_once ATFRFO_PLUGIN_DIR . 'includes/class-atfrfo-ajax-handler.php';
		require_once ATFRFO_PLUGIN_DIR . 'includes/class-atfrfo-admin.php';

		$admin = new ATFRFO_Admin();
		$admin->register_hooks();

		$ajax = new ATFRFO_Ajax_Handler();
		$ajax->register_handlers();
	}
}
