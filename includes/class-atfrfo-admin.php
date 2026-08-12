<?php
/**
 * ATFRFO Admin — WordPress Admin Page Registration & Asset Enqueueing
 *
 * Handles all WordPress admin layer concerns: menu registration,
 * asset enqueueing, page rendering, and user theme preference.
 *
 * @package AtomicFrameworkForge
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class ATFRFO_Admin {

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
	 * Add atfrfo-fullscreen to body class on the ATFRFO admin page.
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
			$classes .= ' atfrfo-fullscreen';
		}
		return $classes;
	}

	/**
	 * Register the top-level ATFRFO admin menu page.
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
	 * Enqueue CSS and JS — only on the ATFRFO admin page.
	 *
	 * @param string $hook Current admin page hook suffix.
	 */
	public function enqueue_admin_assets( string $hook ): void {
		if ( 'toplevel_page_' . self::MENU_SLUG !== $hook ) {
			return;
		}

		// Remove the WP admin footer text and version string so the ATFRFO full-height
		// layout is not pushed by the footer bar.
		add_filter( 'admin_footer_text', '__return_empty_string' );
		add_filter( 'update_footer', '__return_empty_string', 11 );

		// Theme CSS: font-face, custom properties, light/dark mode, base styles.
		wp_enqueue_style(
			'atfrfo-theme',
			ATFRFO_PLUGIN_URL . 'admin/css/atfrfo-theme.css',
			array(),
			$this->asset_version( 'admin/css/atfrfo-theme.css' )
		);

		// Layout CSS: four-panel structure, panel sizing, collapse states.
		wp_enqueue_style(
			'atfrfo-layout',
			ATFRFO_PLUGIN_URL . 'admin/css/atfrfo-layout.css',
			array( 'atfrfo-theme' ),
			$this->asset_version( 'admin/css/atfrfo-layout.css' )
		);

		// Colors CSS: Phase 2 — category blocks, color rows, expand panel.
		wp_enqueue_style(
			'atfrfo-colors',
			ATFRFO_PLUGIN_URL . 'admin/css/atfrfo-colors.css',
			array( 'atfrfo-layout' ),
			$this->asset_version( 'admin/css/atfrfo-colors.css' )
		);

		// Variables CSS: Phase 3 — Fonts and Numbers variable rows, font preview cell.
		wp_enqueue_style(
			'atfrfo-variables',
			ATFRFO_PLUGIN_URL . 'admin/css/atfrfo-variables.css',
			array( 'atfrfo-colors' ),
			$this->asset_version( 'admin/css/atfrfo-variables.css' )
		);

		// Classes CSS: Phase 3.1/3.2 — Elementor V4 Global Classes list view.
		wp_enqueue_style(
			'atfrfo-classes',
			ATFRFO_PLUGIN_URL . 'admin/css/atfrfo-classes.css',
			array( 'atfrfo-variables' ),
			$this->asset_version( 'admin/css/atfrfo-classes.css' )
		);

		// Preferences CSS: accessibility overrides and preferences panel layout.
		wp_enqueue_style(
			'atfrfo-preferences',
			ATFRFO_PLUGIN_URL . 'admin/css/atfrfo-preferences.css',
			array( 'atfrfo-variables' ),
			$this->asset_version( 'admin/css/atfrfo-preferences.css' )
		);

		// Inline grid overrides — guarantees correct column widths regardless of browser
		// cache state on the static CSS files (cache-busting via filemtime is env-dependent).
		wp_add_inline_style( 'atfrfo-preferences', $this->get_grid_override_css() );

		// Print CSS: modal selection + @media print document styles.
		wp_enqueue_style(
			'atfrfo-print',
			ATFRFO_PLUGIN_URL . 'admin/css/atfrfo-print.css',
			array( 'atfrfo-preferences' ),
			$this->asset_version( 'admin/css/atfrfo-print.css' )
		);

		// Notify sign CSS: rise-in/settle/rise-out animation for the "take a look" tip.
		wp_enqueue_style(
			'atfrfo-notify',
			ATFRFO_PLUGIN_URL . 'admin/css/atfrfo-notify.css',
			array( 'atfrfo-print' ),
			$this->asset_version( 'admin/css/atfrfo-notify.css' )
		);

		// Pickr color picker — local vendor copy (no CDN dependency).
		wp_enqueue_style(
			'pickr-classic',
			ATFRFO_PLUGIN_URL . 'assets/vendor/pickr/classic.min.css',
			array( 'atfrfo-colors' ),
			'1.10.1'
		);
		wp_enqueue_script(
			'pickr',
			ATFRFO_PLUGIN_URL . 'assets/vendor/pickr/pickr.min.js',
			array(),
			'1.10.1',
			true
		);

		// JavaScript modules — loaded in dependency order, all in footer.
		$js_modules = array(
			'atfrfo-theme'       => 'admin/js/atfrfo-theme.js',
			'atfrfo-modal'       => 'admin/js/atfrfo-modal.js',
			'atfrfo-merge'       => 'admin/js/atfrfo-merge.js',      // Conflict resolution — must load before panel scripts.
			'atfrfo-panel-left'  => 'admin/js/atfrfo-panel-left.js',
			'atfrfo-panel-right' => 'admin/js/atfrfo-panel-right.js',
			'atfrfo-panel-top'   => 'admin/js/atfrfo-panel-top.js',
			'atfrfo-edit-space'  => 'admin/js/atfrfo-edit-space.js',
			'atfrfo-colors'      => 'admin/js/atfrfo-colors.js',     // Phase 2 — must load before atfrfo-app.
			'atfrfo-variables'   => 'admin/js/atfrfo-variables.js',  // Phase 3 — must load before atfrfo-app.
			'atfrfo-classes'     => 'admin/js/atfrfo-classes.js',    // Phase 3.1/3.2 — must load before atfrfo-app.
			'atfrfo-app'         => 'admin/js/atfrfo-app.js',
			'atfrfo-print'       => 'admin/js/atfrfo-print.js',    // Print / PDF — must load after atfrfo-app.
			'atfrfo-notify'      => 'admin/js/atfrfo-notify.js',   // Must load after atfrfo-app (uses ATFRFO.App.ajax).
		);

		$deps = array();
		foreach ( $js_modules as $handle => $file ) {
			$module_deps = $deps;
			if ( 'atfrfo-colors' === $handle ) {
				$module_deps[] = 'pickr';
			}
			wp_enqueue_script(
				$handle,
				ATFRFO_PLUGIN_URL . $file,
				$module_deps,
				$this->asset_version( $file ),
				true // Load in footer.
			);
			$deps[] = $handle;
		}

		// Pass PHP data to JS.
		wp_localize_script(
			'atfrfo-app',
			'ATFRFOData',
			array(
				'ajaxUrl'         => admin_url( 'admin-ajax.php' ),
				'nonce'           => wp_create_nonce( ATFRFO_NONCE_ACTION ),
				'theme'           => $this->get_user_theme(),
				'version'         => ATFRFO_VERSION,
				'uploadUrl'       => $this->get_aff_upload_dir_url(),
				'pluginUrl'       => ATFRFO_PLUGIN_URL,
				'siteName'        => get_bloginfo( 'name' ),
				// Elementor version data for runtime safety check.
				'elVersion'       => defined( 'ELEMENTOR_VERSION' ) ? ELEMENTOR_VERSION : null,
				'elProVersion'    => defined( 'ELEMENTOR_PRO_VERSION' ) ? ELEMENTOR_PRO_VERSION : null,
				'elDevVersion'    => ATFRFO_DEV_ELEMENTOR_VERSION,
				'elProDevVersion' => ATFRFO_DEV_ELEMENTOR_PRO_VERSION,
			)
		);
	}

	/**
	 * Render the ATFRFO admin page.
	 */
	public function render_admin_page(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'You do not have sufficient permissions to access this page.', 'atomic-framework-forge-for-elementor' ) );
		}

		$theme               = $this->get_user_theme();
		$show_notify_sign    = $this->get_notify_count() < ATFRFO_NOTIFY_MAX_SHOWS;
		require_once ATFRFO_PLUGIN_DIR . 'admin/views/page-atfrfo-main.php';
	}

	/**
	 * Get the current user's ATFRFO theme preference.
	 *
	 * @return string 'light' or 'dark'.
	 */
	public function get_user_theme(): string {
		$user_id = get_current_user_id();
		$theme   = get_user_meta( $user_id, ATFRFO_USER_META_THEME, true );
		return in_array( $theme, array( 'light', 'dark' ), true ) ? $theme : 'light';
	}

	/**
	 * Get the number of times the "take a look" notify sign has been shown
	 * to the current user. Capped display is enforced by the caller against
	 * ATFRFO_NOTIFY_MAX_SHOWS — this method only reports the raw count.
	 *
	 * @return int
	 */
	public function get_notify_count(): int {
		$user_id = get_current_user_id();
		$count   = get_user_meta( $user_id, ATFRFO_USER_META_NOTIFY_COUNT, true );
		return is_numeric( $count ) ? (int) $count : 0;
	}

	/**
	 * Get the ATFRFO uploads directory URL.
	 *
	 * @return string URL with trailing slash.
	 */
	private function get_aff_upload_dir_url(): string {
		$upload_dir = wp_upload_dir();
		return $upload_dir['baseurl'] . '/atfrfo/';
	}

	/**
	 * Return the version string for a plugin asset.
	 *
	 * Uses filemtime() when WP_DEBUG is enabled so any file change busts the
	 * browser cache automatically during development. Falls back to ATFRFO_VERSION
	 * in production for stable, long-lived cache headers.
	 *
	 * @param string $relative_path Path relative to ATFRFO_PLUGIN_DIR (e.g. 'admin/css/atfrfo-layout.css').
	 * @return string Version string.
	 */
	private function asset_version( string $relative_path ): string {
		if ( defined( 'WP_DEBUG' ) && WP_DEBUG ) {
			$mtime = @filemtime( ATFRFO_PLUGIN_DIR . $relative_path );
			return $mtime ? (string) $mtime : ATFRFO_VERSION;
		}
		return ATFRFO_VERSION;
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
.atfrfo-color-list-header,
.atfrfo-color-row {
	grid-template-columns: 24px 8px 100px 200px 4fr 11% 100px 28px 28px;
}
.atfrfo-fonts-view .atfrfo-color-row,
.atfrfo-fonts-view .atfrfo-color-list-header {
	grid-template-columns: 24px 8px 72px 200px 5fr 19% 150px 28px 28px;
	column-gap: 10px;
}
.atfrfo-numbers-view .atfrfo-color-row,
.atfrfo-numbers-view .atfrfo-color-list-header {
	grid-template-columns: 24px 8px 200px 5fr 4fr 100px 28px 28px;
	column-gap: 10px;
}
@media (max-width: 600px) {
	.atfrfo-color-list-header,
	.atfrfo-color-row {
		grid-template-columns: 24px 8px 80px 120px 0 16% 0 28px 28px;
	}
	.atfrfo-fonts-view .atfrfo-color-row,
	.atfrfo-fonts-view .atfrfo-color-list-header {
		grid-template-columns: 24px 8px 60px 120px 0 20% 0 28px 28px;
	}
	.atfrfo-numbers-view .atfrfo-color-row,
	.atfrfo-numbers-view .atfrfo-color-list-header {
		grid-template-columns: 24px 8px 120px 0 3fr 0 28px 28px;
	}
}';
	}

	/**
	 * Safely inline an SVG icon file.
	 *
	 * Escaped via wp_kses() with an allow-list matching exactly the tags/
	 * attributes actually present in assets/icons/*.svg (verified directly
	 * against every file in that directory, not a generic broad SVG list) —
	 * defense-in-depth even though the source files are plugin-bundled, not
	 * user input.
	 *
	 * @param string $name Icon filename without .svg extension.
	 * @return string Escaped SVG markup, or empty string if file not found.
	 */
	public static function get_icon( string $name ): string {
		$file = ATFRFO_PLUGIN_DIR . 'assets/icons/' . $name . '.svg';
		if ( ! file_exists( $file ) ) {
			return '';
		}

		$svg = file_get_contents( $file ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents

		return wp_kses( $svg, self::get_icon_allowed_tags() );
	}

	/**
	 * Allow-list of SVG tags/attributes for icon output, shared by get_icon()
	 * and the atfrfo_icon() template helper — the same list is used both
	 * where the icon markup is built and, again, where it is finally echoed,
	 * so escaping happens at the actual output point per WordPress.org's
	 * "escape late" review requirement, not only upstream.
	 *
	 * @return array<string, array<string, bool>> wp_kses()-compatible allow-list.
	 */
	public static function get_icon_allowed_tags(): array {
		return array(
			'svg'      => array(
				'xmlns'   => true,
				'viewbox' => true,
				'width'   => true,
				'height'  => true,
				'fill'    => true,
				'stroke'  => true,
				'style'   => true,
			),
			'path'     => array(
				'd'                => true,
				'fill'             => true,
				'stroke'           => true,
				'stroke-width'     => true,
				'stroke-linecap'   => true,
				'stroke-linejoin'  => true,
			),
			'circle'   => array(
				'cx'     => true,
				'cy'     => true,
				'r'      => true,
				'fill'   => true,
				'stroke' => true,
			),
			'rect'     => array(
				'x'      => true,
				'y'      => true,
				'width'  => true,
				'height' => true,
				'rx'     => true,
				'fill'   => true,
				'stroke' => true,
			),
			'line'     => array(
				'x1'             => true,
				'y1'             => true,
				'x2'             => true,
				'y2'             => true,
				'stroke'         => true,
				'stroke-width'   => true,
				'stroke-linecap' => true,
			),
			'polyline' => array(
				'points'          => true,
				'fill'            => true,
				'stroke'          => true,
				'stroke-width'    => true,
				'stroke-linecap'  => true,
				'stroke-linejoin' => true,
			),
		);
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
