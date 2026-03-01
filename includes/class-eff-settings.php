<?php
/**
 * EFF Settings — Plugin Preferences Storage
 *
 * Thin WordPress adapter for plugin-level preferences.
 * Scoped to developer preferences (default file path, sync options).
 * User-level preferences (theme) are stored in usermeta via EFF_Admin.
 *
 * @package ElementorFrameworkForge
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class EFF_Settings {

	const OPTION_KEY = 'eff_settings';

	/**
	 * @var array Default setting values.
	 */
	private static array $defaults = array(
		'default_file_path' => '',
		'auto_sync'         => false,
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
