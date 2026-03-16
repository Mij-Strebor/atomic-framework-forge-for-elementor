<?php
/**
 * EFF Admin — WordPress Admin Page Registration & Asset Enqueueing
 *
 * Handles all WordPress admin layer concerns: menu registration,
 * asset enqueueing, page rendering, and user theme preference.
 *
 * @package ElementorFrameworkForge
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class EFF_Admin {

	const MENU_SLUG       = 'elementor-framework-forge';
	const NONCE_ACTION    = 'eff_admin_nonce';
	const USER_META_THEME = 'eff_theme_preference';

	/**
	 * Register all WordPress hooks.
	 */
	public function register_hooks(): void {
		add_action( 'admin_menu',            array( $this, 'register_admin_menu' ) );
		add_action( 'admin_enqueue_scripts', array( $this, 'enqueue_admin_assets' ) );
	}

	/**
	 * Register the top-level EFF admin menu page.
	 */
	public function register_admin_menu(): void {
		add_menu_page(
			__( 'Elementor Framework Forge', 'elementor-framework-forge' ),
			__( 'EFF', 'elementor-framework-forge' ),
			'manage_options',
			self::MENU_SLUG,
			array( $this, 'render_admin_page' ),
			$this->get_menu_icon_svg(),
			30
		);
	}

	/**
	 * Enqueue CSS and JS — only on the EFF admin page.
	 *
	 * @param string $hook Current admin page hook suffix.
	 */
	public function enqueue_admin_assets( string $hook ): void {
		if ( 'toplevel_page_' . self::MENU_SLUG !== $hook ) {
			return;
		}

		// Theme CSS: font-face, custom properties, light/dark mode, base styles.
		wp_enqueue_style(
			'eff-theme',
			EFF_PLUGIN_URL . 'admin/css/eff-theme.css',
			array(),
			$this->asset_version( 'admin/css/eff-theme.css' )
		);

		// Layout CSS: four-panel structure, panel sizing, collapse states.
		wp_enqueue_style(
			'eff-layout',
			EFF_PLUGIN_URL . 'admin/css/eff-layout.css',
			array( 'eff-theme' ),
			$this->asset_version( 'admin/css/eff-layout.css' )
		);

		// Colors CSS: Phase 2 — category blocks, color rows, expand panel.
		wp_enqueue_style(
			'eff-colors',
			EFF_PLUGIN_URL . 'admin/css/eff-colors.css',
			array( 'eff-layout' ),
			$this->asset_version( 'admin/css/eff-colors.css' )
		);

		// Variables CSS: Phase 3 — Fonts and Numbers variable rows, font preview cell.
		wp_enqueue_style(
			'eff-variables',
			EFF_PLUGIN_URL . 'admin/css/eff-variables.css',
			array( 'eff-colors' ),
			$this->asset_version( 'admin/css/eff-variables.css' )
		);

		// Pickr color picker — CDN, loaded before EFF JS modules.
		wp_enqueue_style(
			'pickr-classic',
			'https://cdn.jsdelivr.net/npm/@simonwep/pickr@1.9.0/dist/themes/classic.min.css',
			array( 'eff-colors' ),
			null
		);
		wp_enqueue_script(
			'pickr',
			'https://cdn.jsdelivr.net/npm/@simonwep/pickr@1.9.0/dist/pickr.min.js',
			array(),
			null,
			true
		);

		// JavaScript modules — loaded in dependency order, all in footer.
		$js_modules = array(
			'eff-theme'       => 'admin/js/eff-theme.js',
			'eff-modal'       => 'admin/js/eff-modal.js',
			'eff-panel-left'  => 'admin/js/eff-panel-left.js',
			'eff-panel-right' => 'admin/js/eff-panel-right.js',
			'eff-panel-top'   => 'admin/js/eff-panel-top.js',
			'eff-edit-space'  => 'admin/js/eff-edit-space.js',
			'eff-colors'      => 'admin/js/eff-colors.js',     // Phase 2 — must load before eff-app.
			'eff-variables'   => 'admin/js/eff-variables.js',  // Phase 3 — must load before eff-app.
			'eff-app'         => 'admin/js/eff-app.js',
		);

		$deps = array( 'pickr' );
		foreach ( $js_modules as $handle => $file ) {
			wp_enqueue_script(
				$handle,
				EFF_PLUGIN_URL . $file,
				$deps,
				$this->asset_version( $file ),
				true // Load in footer.
			);
			$deps[] = $handle;
		}

		// Pass PHP data to JS.
		wp_localize_script(
			'eff-app',
			'EFFData',
			array(
				'ajaxUrl'   => admin_url( 'admin-ajax.php' ),
				'nonce'     => wp_create_nonce( self::NONCE_ACTION ),
				'theme'     => $this->get_user_theme(),
				'version'   => EFF_VERSION,
				'uploadUrl' => $this->get_eff_upload_dir_url(),
				'pluginUrl' => EFF_PLUGIN_URL,
			)
		);
	}

	/**
	 * Render the EFF admin page.
	 */
	public function render_admin_page(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'You do not have sufficient permissions to access this page.', 'elementor-framework-forge' ) );
		}

		$theme = $this->get_user_theme();
		require_once EFF_PLUGIN_DIR . 'admin/views/page-eff-main.php';
	}

	/**
	 * Get the current user's EFF theme preference.
	 *
	 * @return string 'light' or 'dark'.
	 */
	public function get_user_theme(): string {
		$user_id = get_current_user_id();
		$theme   = get_user_meta( $user_id, self::USER_META_THEME, true );
		return in_array( $theme, array( 'light', 'dark' ), true ) ? $theme : 'light';
	}

	/**
	 * Get the EFF uploads directory URL.
	 *
	 * @return string URL with trailing slash.
	 */
	private function get_eff_upload_dir_url(): string {
		$upload_dir = wp_upload_dir();
		return $upload_dir['baseurl'] . '/eff/';
	}

	/**
	 * Return the version string for a plugin asset.
	 *
	 * Uses filemtime() when WP_DEBUG is enabled so any file change busts the
	 * browser cache automatically during development. Falls back to EFF_VERSION
	 * in production for stable, long-lived cache headers.
	 *
	 * @param string $relative_path Path relative to EFF_PLUGIN_DIR (e.g. 'admin/css/eff-layout.css').
	 * @return string Version string.
	 */
	private function asset_version( string $relative_path ): string {
		if ( defined( 'WP_DEBUG' ) && WP_DEBUG ) {
			$abs = EFF_PLUGIN_DIR . $relative_path;
			return file_exists( $abs ) ? (string) filemtime( $abs ) : EFF_VERSION;
		}
		return EFF_VERSION;
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
