<?php
/**
 * AFF Admin — WordPress Admin Page Registration & Asset Enqueueing
 *
 * Handles all WordPress admin layer concerns: menu registration,
 * asset enqueueing, page rendering, and user theme preference.
 *
 * @package AtomicFrameworkForge
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class AFF_Admin {

	const MENU_SLUG = 'atomic-framework-forge';

	/**
	 * Register all WordPress hooks.
	 */
	public function register_hooks(): void {
		add_action( 'admin_menu', array( $this, 'register_admin_menu' ) );
		add_action( 'admin_enqueue_scripts', array( $this, 'enqueue_admin_assets' ) );
		add_filter( 'admin_body_class', array( $this, 'add_body_class' ) );
	}

	/**
	 * Add aff-fullscreen to body class on the AFF admin page.
	 * Used by CSS to undo WordPress's body { height:100% } which, combined
	 * with html { padding-top:32px }, makes the document 32px taller than
	 * the viewport and creates a page scrollbar.
	 *
	 * @param string $classes Space-separated body class string.
	 * @return string
	 */
	public function add_body_class( string $classes ): string {
		$screen = get_current_screen();
		if ( $screen && 'toplevel_page_' . self::MENU_SLUG === $screen->id ) {
			$classes .= ' aff-fullscreen';
		}
		return $classes;
	}

	/**
	 * Register the top-level AFF admin menu page.
	 */
	public function register_admin_menu(): void {
		add_menu_page(
			__( 'Atomic Framework Forge', 'atomic-framework-forge-for-elementor' ),
			__( 'AFF', 'atomic-framework-forge-for-elementor' ),
			'manage_options',
			self::MENU_SLUG,
			array( $this, 'render_admin_page' ),
			$this->get_menu_icon_svg(),
			30
		);
	}

	/**
	 * Enqueue CSS and JS — only on the AFF admin page.
	 *
	 * @param string $hook Current admin page hook suffix.
	 */
	public function enqueue_admin_assets( string $hook ): void {
		if ( 'toplevel_page_' . self::MENU_SLUG !== $hook ) {
			return;
		}

		// Remove the WP admin footer text and version string so the AFF full-height
		// layout is not pushed by the footer bar.
		add_filter( 'admin_footer_text', '__return_empty_string' );
		add_filter( 'update_footer', '__return_empty_string', 11 );

		// Theme CSS: font-face, custom properties, light/dark mode, base styles.
		wp_enqueue_style(
			'aff-theme',
			AFF_PLUGIN_URL . 'admin/css/aff-theme.css',
			array(),
			$this->asset_version( 'admin/css/aff-theme.css' )
		);

		// Layout CSS: four-panel structure, panel sizing, collapse states.
		wp_enqueue_style(
			'aff-layout',
			AFF_PLUGIN_URL . 'admin/css/aff-layout.css',
			array( 'aff-theme' ),
			$this->asset_version( 'admin/css/aff-layout.css' )
		);

		// Colors CSS: Phase 2 — category blocks, color rows, expand panel.
		wp_enqueue_style(
			'aff-colors',
			AFF_PLUGIN_URL . 'admin/css/aff-colors.css',
			array( 'aff-layout' ),
			$this->asset_version( 'admin/css/aff-colors.css' )
		);

		// Variables CSS: Phase 3 — Fonts and Numbers variable rows, font preview cell.
		wp_enqueue_style(
			'aff-variables',
			AFF_PLUGIN_URL . 'admin/css/aff-variables.css',
			array( 'aff-colors' ),
			$this->asset_version( 'admin/css/aff-variables.css' )
		);

		// Preferences CSS: accessibility overrides and preferences panel layout.
		wp_enqueue_style(
			'aff-preferences',
			AFF_PLUGIN_URL . 'admin/css/aff-preferences.css',
			array( 'aff-variables' ),
			$this->asset_version( 'admin/css/aff-preferences.css' )
		);

		// Inline grid overrides — guarantees correct column widths regardless of browser
		// cache state on the static CSS files (cache-busting via filemtime is env-dependent).
		wp_add_inline_style( 'aff-preferences', $this->get_grid_override_css() );

		// Print CSS: modal selection + @media print document styles.
		wp_enqueue_style(
			'aff-print',
			AFF_PLUGIN_URL . 'admin/css/aff-print.css',
			array( 'aff-preferences' ),
			$this->asset_version( 'admin/css/aff-print.css' )
		);

		// Pickr color picker — local vendor copy (no CDN dependency).
		wp_enqueue_style(
			'pickr-classic',
			AFF_PLUGIN_URL . 'assets/vendor/pickr/classic.min.css',
			array( 'aff-colors' ),
			'1.9.0'
		);
		wp_enqueue_script(
			'pickr',
			AFF_PLUGIN_URL . 'assets/vendor/pickr/pickr.min.js',
			array(),
			'1.9.0',
			true
		);

		// JavaScript modules — loaded in dependency order, all in footer.
		$js_modules = array(
			'aff-theme'       => 'admin/js/aff-theme.js',
			'aff-modal'       => 'admin/js/aff-modal.js',
			'aff-merge'       => 'admin/js/aff-merge.js',      // Conflict resolution — must load before panel scripts.
			'aff-panel-left'  => 'admin/js/aff-panel-left.js',
			'aff-panel-right' => 'admin/js/aff-panel-right.js',
			'aff-panel-top'   => 'admin/js/aff-panel-top.js',
			'aff-edit-space'  => 'admin/js/aff-edit-space.js',
			'aff-colors'      => 'admin/js/aff-colors.js',     // Phase 2 — must load before aff-app.
			'aff-variables'   => 'admin/js/aff-variables.js',  // Phase 3 — must load before aff-app.
			'aff-app'         => 'admin/js/aff-app.js',
			'aff-print'       => 'admin/js/aff-print.js',    // Print / PDF — must load after aff-app.
		);

		$deps = array();
		foreach ( $js_modules as $handle => $file ) {
			$module_deps = $deps;
			if ( 'aff-colors' === $handle ) {
				$module_deps[] = 'pickr';
			}
			wp_enqueue_script(
				$handle,
				AFF_PLUGIN_URL . $file,
				$module_deps,
				$this->asset_version( $file ),
				true // Load in footer.
			);
			$deps[] = $handle;
		}

		// Pass PHP data to JS.
		wp_localize_script(
			'aff-app',
			'AFFData',
			array(
				'ajaxUrl'         => admin_url( 'admin-ajax.php' ),
				'nonce'           => wp_create_nonce( AFF_NONCE_ACTION ),
				'theme'           => $this->get_user_theme(),
				'version'         => AFF_VERSION,
				'uploadUrl'       => $this->get_aff_upload_dir_url(),
				'pluginUrl'       => AFF_PLUGIN_URL,
				'siteName'        => get_bloginfo( 'name' ),
				// Elementor version data for runtime safety check.
				'elVersion'       => defined( 'ELEMENTOR_VERSION' ) ? ELEMENTOR_VERSION : null,
				'elProVersion'    => defined( 'ELEMENTOR_PRO_VERSION' ) ? ELEMENTOR_PRO_VERSION : null,
				'elDevVersion'    => AFF_DEV_ELEMENTOR_VERSION,
				'elProDevVersion' => AFF_DEV_ELEMENTOR_PRO_VERSION,
			)
		);
	}

	/**
	 * Render the AFF admin page.
	 */
	public function render_admin_page(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'You do not have sufficient permissions to access this page.', 'atomic-framework-forge-for-elementor' ) );
		}

		$theme = $this->get_user_theme();
		require_once AFF_PLUGIN_DIR . 'admin/views/page-aff-main.php';
	}

	/**
	 * Get the current user's AFF theme preference.
	 *
	 * @return string 'light' or 'dark'.
	 */
	public function get_user_theme(): string {
		$user_id = get_current_user_id();
		$theme   = get_user_meta( $user_id, AFF_USER_META_THEME, true );
		return in_array( $theme, array( 'light', 'dark' ), true ) ? $theme : 'light';
	}

	/**
	 * Get the AFF uploads directory URL.
	 *
	 * @return string URL with trailing slash.
	 */
	private function get_aff_upload_dir_url(): string {
		$upload_dir = wp_upload_dir();
		return $upload_dir['baseurl'] . '/aff/';
	}

	/**
	 * Return the version string for a plugin asset.
	 *
	 * Uses filemtime() when WP_DEBUG is enabled so any file change busts the
	 * browser cache automatically during development. Falls back to AFF_VERSION
	 * in production for stable, long-lived cache headers.
	 *
	 * @param string $relative_path Path relative to AFF_PLUGIN_DIR (e.g. 'admin/css/aff-layout.css').
	 * @return string Version string.
	 */
	private function asset_version( string $relative_path ): string {
		if ( defined( 'WP_DEBUG' ) && WP_DEBUG ) {
			$mtime = @filemtime( AFF_PLUGIN_DIR . $relative_path );
			return $mtime ? (string) $mtime : AFF_VERSION;
		}
		return AFF_VERSION;
	}

	/**
	 * Return inline CSS that enforces the correct grid column widths for Colors,
	 * Fonts, and Numbers rows. Injected via wp_add_inline_style() so it lands
	 * directly in the HTML <style> block and is never affected by browser caching
	 * of the static CSS files.
	 *
	 * @return string CSS string.
	 */
	private function get_grid_override_css(): string {
		// Column order:
		// Colors:  drag(24) | dot(8) | swatch(100) | name(200px) | notes(4fr) | value(11%) | format(100px) | delete(28) | empty(28)
		// Fonts:   drag(24) | dot(8) | preview(72)  | name(200px) | notes(5fr) | value(19%) | format(150px) | delete(28) | empty(28)
		// Numbers: drag(24) | dot(8) | name(200px)  | notes(5fr)  | value(4fr) | format(100px) | delete(28) | empty(28)
		return '
.aff-color-list-header,
.aff-color-row {
	grid-template-columns: 24px 8px 100px 200px 4fr 11% 100px 28px 28px;
}
.aff-fonts-view .aff-color-row,
.aff-fonts-view .aff-color-list-header {
	grid-template-columns: 24px 8px 72px 200px 5fr 19% 150px 28px 28px;
	column-gap: 10px;
}
.aff-numbers-view .aff-color-row,
.aff-numbers-view .aff-color-list-header {
	grid-template-columns: 24px 8px 200px 5fr 4fr 100px 28px 28px;
	column-gap: 10px;
}
@media (max-width: 600px) {
	.aff-color-list-header,
	.aff-color-row {
		grid-template-columns: 24px 8px 80px 120px 0 16% 0 28px 28px;
	}
	.aff-fonts-view .aff-color-row,
	.aff-fonts-view .aff-color-list-header {
		grid-template-columns: 24px 8px 60px 120px 0 20% 0 28px 28px;
	}
	.aff-numbers-view .aff-color-row,
	.aff-numbers-view .aff-color-list-header {
		grid-template-columns: 24px 8px 120px 0 3fr 0 28px 28px;
	}
}';
	}

	/**
	 * Safely inline an SVG icon file.
	 *
	 * @param string $name Icon filename without .svg extension.
	 * @return string SVG markup or empty string if file not found.
	 */
	public static function get_icon( string $name ): string {
		$file = AFF_PLUGIN_DIR . 'assets/icons/' . $name . '.svg';
		if ( file_exists( $file ) ) {
			return file_get_contents( $file ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents
		}
		return '';
	}

	/**
	 * Return the base64-encoded SVG data URI for the admin menu icon.
	 *
	 * @return string data:image/svg+xml;base64,... string.
	 */
	private function get_menu_icon_svg(): string {
		// Simple { } curly brace icon — matches the Variables icon theme.
		$svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none">'
			. '<path d="M7 3H5a1 1 0 0 0-1 1v3l-1.5 3L4 13v3a1 1 0 0 0 1 1h2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>'
			. '<path d="M13 3h2a1 1 0 0 1 1 1v3l1.5 3L16 13v3a1 1 0 0 1-1 1h-2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>'
			. '</svg>';
		return 'data:image/svg+xml;base64,' . base64_encode( $svg );
	}
}
