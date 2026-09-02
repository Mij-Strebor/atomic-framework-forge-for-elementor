<?php
/**
 * ATFRFO Elementor V4 Adapter — Portable AFF <-> Elementor v4 Variable Translation
 *
 * Pure array-in/array-out translation between AFF's internal variable shape
 * and Elementor v4's native `global-variables.json` collection shape (as
 * used by Elementor's own kit Import/Export Customization runners:
 * elementor/modules/variables/import-export-customization/runners/{export,import}.php).
 *
 * No WordPress function calls in this class — see ATFRFO CLAUDE.md Critical
 * Rule #2 (portable data layer). All WordPress-specific I/O (ZipArchive,
 * kit post meta, file uploads) belongs in ATFRFO_Ajax_Handler, not here.
 *
 * Verified directly against Elementor's own source (not assumed) — see
 * modules/variables/storage/variables-collection.php, storage/entities/variable.php,
 * storage/constants.php, prop-types/*-variable-prop-type.php, and
 * classes/css-renderer.php on the local Elementor install.
 *
 * @package AtomicFrameworkForge
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class ATFRFO_Elementor_V4_Adapter {

	// The only three real registered Elementor v4 variable types — confirmed
	// via prop-types/color-variable-prop-type.php, size-variable-prop-type.php,
	// font-variable-prop-type.php. There is no generic/fallback type.
	const TYPE_COLOR = 'global-color-variable';
	const TYPE_SIZE  = 'global-size-variable';
	const TYPE_FONT  = 'global-font-variable';

	// global-variables.json's own "version" field — Elementor's
	// Constants::FORMAT_VERSION_V1 (modules/variables/storage/constants.php).
	// Not to be confused with manifest.json's "version" (Module::FORMAT_VERSION,
	// currently '3.0'), which is a separate constant handled by the AJAX layer.
	const COLLECTION_FORMAT_VERSION = 1;

	/**
	 * Convert an array of AFF variable records into an Elementor v4
	 * global-variables.json collection: { data, watermark, version }.
	 *
	 * @param array $aff_variables AFF variable records (id/name/value/type/subgroup/elementor_id/...).
	 * @return array Elementor collection shape.
	 */
	public static function to_elementor( array $aff_variables ): array {
		$data  = array();
		$order = 0;

		foreach ( $aff_variables as $variable ) {
			if ( ! is_array( $variable ) || empty( $variable['name'] ) ) {
				continue;
			}

			++$order;

			$id = ! empty( $variable['elementor_id'] )
				? (string) $variable['elementor_id']
				: self::generate_id( array_keys( $data ) );

			$now = gmdate( 'Y-m-d H:i:s' );

			$data[ $id ] = array(
				'type'       => self::aff_type_to_elementor( $variable['type'] ?? '', $variable['subgroup'] ?? '' ),
				'label'      => (string) $variable['name'],
				// Native kit-export storage is a plain CSS value string for every
				// type — confirmed via css-renderer.php, which writes it straight
				// into `--{label}:{value};` with no $$type wrapper. This differs
				// from the *live kit meta* shape AFF's own commit-to-elementor
				// write path uses (ATFRFO_Ajax_Handler::build_elementor_meta_value()),
				// which is wrapped — that wrapping only happens when Elementor's
				// own Prop_Type_Adapter::to_storage() runs against a save(), not
				// in the file-export format.
				'value'      => (string) ( $variable['value'] ?? '' ),
				'order'      => $order,
				'sync_to_v3' => false,
				'created_at' => ! empty( $variable['created_at'] ) ? $variable['created_at'] : $now,
				'updated_at' => ! empty( $variable['updated_at'] ) ? $variable['updated_at'] : $now,
			);
		}

		return array(
			'data'      => $data,
			'watermark' => count( $data ),
			'version'   => self::COLLECTION_FORMAT_VERSION,
		);
	}

	/**
	 * Convert an Elementor v4 global-variables.json collection back into AFF
	 * variable records. Always captures the Elementor record's own id into
	 * `elementor_id` — the existing read path (ATFRFO_CSS_Parser::read_from_kit_meta())
	 * does not do this today; this import path fixes that gap for round-tripping.
	 *
	 * @param array $collection Decoded { data, watermark, version } from global-variables.json.
	 * @return array AFF-shaped variable records.
	 */
	public static function from_elementor( array $collection ): array {
		$out  = array();
		$data = is_array( $collection['data'] ?? null ) ? $collection['data'] : array();

		foreach ( $data as $id => $entry ) {
			if ( ! is_array( $entry ) || empty( $entry['label'] ) ) {
				continue;
			}
			// Soft-deleted entries (Elementor's own `deleted`/`deleted_at` markers)
			// are not live variables — skip them, matching Elementor's own import
			// runner behaviour (runners/import.php skips $variable->is_deleted()).
			if ( ! empty( $entry['deleted'] ) || isset( $entry['deleted_at'] ) ) {
				continue;
			}

			list( $aff_type, $subgroup ) = self::elementor_type_to_aff( (string) ( $entry['type'] ?? '' ) );

			$out[] = array(
				'name'         => (string) $entry['label'],
				'value'        => (string) ( $entry['value'] ?? '' ),
				'type'         => $aff_type,
				'subgroup'     => $subgroup,
				'source'       => 'elementor-v4-import',
				'elementor_id' => (string) $id,
			);
		}

		return $out;
	}

	/**
	 * Map an AFF type/subgroup pair to one of Elementor's three real variable types.
	 *
	 * Fixes a gap in ATFRFO_Ajax_Handler::get_elementor_var_type() (the live-kit
	 * write-back path), which never checks for 'font' and falls back to the
	 * invalid generic 'global-variable' key for anything that isn't color/number.
	 *
	 * @param string $type     AFF variable 'type' field.
	 * @param string $subgroup AFF variable 'subgroup' field.
	 * @return string One of TYPE_COLOR / TYPE_SIZE / TYPE_FONT.
	 */
	private static function aff_type_to_elementor( string $type, string $subgroup ): string {
		if ( 'color' === $type || 'Colors' === $subgroup ) {
			return self::TYPE_COLOR;
		}
		if ( 'number' === $type || 'Numbers' === $subgroup ) {
			return self::TYPE_SIZE;
		}
		// 'font' === $type or anything else AFF doesn't have a dedicated
		// color/number type for — Font_Variable_Prop_Type is a String_Prop_Type
		// under the hood, same as AFF's own generic/string fallback.
		return self::TYPE_FONT;
	}

	/**
	 * Reverse of aff_type_to_elementor(): map an Elementor variable type back
	 * to an AFF { type, subgroup } pair.
	 *
	 * @param string $elementor_type One of Elementor's three registered types.
	 * @return array [ string $aff_type, string $aff_subgroup ]
	 */
	private static function elementor_type_to_aff( string $elementor_type ): array {
		switch ( $elementor_type ) {
			case self::TYPE_COLOR:
				return array( 'color', 'Colors' );
			case self::TYPE_SIZE:
				return array( 'number', 'Numbers' );
			case self::TYPE_FONT:
				return array( 'font', 'Fonts' );
			default:
				// Unrecognized type (future Elementor variable type this adapter
				// doesn't know about yet) — import as a Fonts-subgroup generic
				// string rather than dropping the variable silently.
				return array( 'font', 'Fonts' );
		}
	}

	/**
	 * Generate an Elementor v4 variable ID in e-gv-XXXXXXX format, avoiding
	 * collisions with ids already assigned in this export batch.
	 *
	 * Mirrors ATFRFO_Ajax_Handler::generate_elementor_var_id() (kept separate
	 * since that method is private to the WP-dependent AJAX class and this
	 * class must have no dependency on it).
	 *
	 * @param array $existing_ids IDs already used in the current batch.
	 * @return string
	 */
	private static function generate_id( array $existing_ids ): string {
		do {
			$id = 'e-gv-' . substr( md5( uniqid( '', true ) ), 0, 7 );
		} while ( in_array( $id, $existing_ids, true ) );

		return $id;
	}
}
