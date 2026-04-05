<?php
/**
 * AFF Settings — Plugin Preferences Storage
 *
 * Thin WordPress adapter for plugin-level preferences.
 * Scoped to developer preferences (default file path, sync options).
 * User-level preferences (theme) are stored in usermeta via AFF_Admin.
 *
 * @package AtomicFrameworkForge
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class AFF_Settings {

	const OPTION_KEY = 'aff_settings';

	/**
	 * @var array Default setting values.
	 */
	private static array $defaults = array(
		'default_file_path'          => '',
		'auto_sync'                  => false,
		'last_file'                  => '',
		'colors_default_type'        => 'HEX',
		'fonts_default_type'         => 'System',
		'numbers_default_type'       => 'REM',
		'colors_default_categories'  => array( 'Branding', 'Backgrounds', 'Neutral', 'Status' ),
		'fonts_default_categories'   => array( 'Titles', 'Text' ),
		'numbers_default_categories' => array( 'Spacing', 'Gaps', 'Grids', 'Radius' ),
		'max_backups'                => 10,
		// Accessibility / UI preferences
		'ui_font_size'               => 14,       // Body font size in px (14–18).
		'ui_contrast'                => 'standard', // 'standard' | 'high'
		'ui_btn_size'                => 'normal',   // 'compact' | 'normal' | 'large'
		'ui_btn_contrast'            => 'standard', // 'standard' | 'high'
		'reduced_motion'             => false,
		'layout_density'             => 'normal',   // 'compact' | 'normal' | 'comfortable'
		'show_tooltips'              => true,
		'extended_tooltips'          => false,
	);

	/**
	 * Get all settings or a single setting by key.
	 *
	 * @param string $key Optional. Specific setting key to retrieve.
	 * @return mixed Full settings array, or single value if $key is provided.
	 */
	public static function get( string $key = '' ) {
		$saved    = get_option( self::OPTION_KEY, array() );
		$settings = wp_parse_args( $saved, self::$defaults );

		if ( '' !== $key ) {
			return $settings[ $key ] ?? null;
		}

		return $settings;
	}

	/**
	 * Update settings. Merges $data into current settings.
	 *
	 * @param array $data Key-value pairs to update.
	 * @return bool True on success.
	 */
	public static function set( array $data ): bool {
		$current = self::get();
		$updated = wp_parse_args( $data, $current );
		return (bool) update_option( self::OPTION_KEY, $updated );
	}

	/**
	 * Return the defaults array.
	 *
	 * @return array
	 */
	public static function get_defaults(): array {
		return self::$defaults;
	}
}
