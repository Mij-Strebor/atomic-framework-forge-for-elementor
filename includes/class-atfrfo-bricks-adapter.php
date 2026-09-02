<?php
/**
 * ATFRFO Bricks Adapter — Portable AFF <-> Bricks Builder Global Variables Translation
 *
 * Pure array-in/array-out translation between AFF's internal variable shape
 * and Bricks Builder's native Global Variables JSON shape.
 *
 * No WordPress function calls in this class — see ATFRFO CLAUDE.md Critical
 * Rule #2 (portable data layer).
 *
 * Originally built from Bricks' own developer documentation (Bricks Academy,
 * academy.bricksbuilder.io/developer/schema/ and
 * academy.bricksbuilder.io/article/global-variables-manager/), which
 * describes the underlying WordPress option `bricks_global_variables`
 * (constant `BRICKS_DB_GLOBAL_VARIABLES`) as a flat array of
 * `{ id, name, value }` — `name` stored without the leading `--`.
 *
 * CORRECTED 2026-09-01 against a real exported file (see
 * ATFRFO_Ajax_Handler's import-side comment): the docs' bare-array shape did
 * not match reality. A real export wraps the list —
 *   { "variables": [ { "id", "name", "value", "category" }, ... ],
 *     "categories": [ { "id", "name" }, ... ], "styleManager": {} }
 * — and includes a second, duplicate, always-empty-value entry per color
 * under a "palette:..." id (Bricks' separate Color Palette feature
 * referencing the same variable name) that from_bricks() must skip. See
 * that method's comments for exactly what's tolerated. It remains an open
 * question whether this wrapped shape is vanilla Bricks' own Global
 * Variables Manager export or specific to "Core Framework" (a third-party
 * Bricks child-theme/framework — the sample file's `category: "corefrm"` /
 * `"Core Framework"` naming suggests the latter). Confirm which produced
 * any given file before trusting this as "the" Bricks format for it.
 *
 * @package AtomicFrameworkForge
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class ATFRFO_Bricks_Adapter {

	/**
	 * Convert an array of AFF variable records into a Bricks global
	 * variables JSON array: [ { id, name, value }, ... ].
	 *
	 * @param array $aff_variables AFF variable records.
	 * @return array Bricks global-variables array.
	 */
	public static function to_bricks( array $aff_variables ): array {
		$out          = array();
		$existing_ids = array();

		foreach ( $aff_variables as $variable ) {
			if ( ! is_array( $variable ) || empty( $variable['name'] ) ) {
				continue;
			}

			$id = ! empty( $variable['bricks_id'] ) ? (string) $variable['bricks_id'] : self::generate_id( $existing_ids );

			$existing_ids[] = $id;
			$out[]          = array(
				'id'    => $id,
				'name'  => (string) $variable['name'],
				'value' => (string) ( $variable['value'] ?? '' ),
			);
		}

		return $out;
	}

	/**
	 * Convert a Bricks global-variables JSON array back into AFF variable
	 * records. Captures each entry's Bricks id into `bricks_id` for
	 * round-tripping (mirrors `elementor_id` on the Elementor v4 adapter).
	 * Type/subgroup are intentionally left blank — the client-side import
	 * merge already runs unclassified variables through
	 * ATFRFO.Utils.classifyVar() (see atfrfo-export-import.js), so value
	 * sniffing isn't duplicated here.
	 *
	 * @param array $bricks_variables Decoded Bricks global-variables array.
	 * @return array AFF-shaped variable records.
	 */
	public static function from_bricks( array $decoded ): array {
		// Real-world Bricks-ecosystem exports (confirmed against an actual
		// file, 2026-09-01 — the developer docs this adapter was originally
		// built from only showed the bare-array shape, which turned out not
		// to match what's actually produced) wrap the variable list in
		// { "variables": [...], "categories": [...], "styleManager": {} },
		// not a bare array. Accept both: unwrap "variables" when present,
		// otherwise treat the input itself as the flat list.
		if ( isset( $decoded['variables'] ) && is_array( $decoded['variables'] ) ) {
			$bricks_variables = $decoded['variables'];
			$categories       = ( isset( $decoded['categories'] ) && is_array( $decoded['categories'] ) ) ? $decoded['categories'] : array();
		} else {
			$bricks_variables = $decoded;
			$categories       = array();
		}

		$category_names = array();
		foreach ( $categories as $cat ) {
			if ( is_array( $cat ) && isset( $cat['id'], $cat['name'] ) ) {
				$category_names[ $cat['id'] ] = (string) $cat['name'];
			}
		}

		$out = array();

		foreach ( $bricks_variables as $entry ) {
			if ( ! is_array( $entry ) || empty( $entry['name'] ) ) {
				continue;
			}

			$value = (string) ( $entry['value'] ?? '' );
			if ( '' === trim( $value ) ) {
				// Same real-world export also contains a second, duplicate
				// entry per color under a "palette:..." id (Bricks' separate
				// Color Palette feature referencing the same variable name)
				// with an always-empty value — not a real variable value to
				// import, just noise that would otherwise create a blank
				// AFF variable for every color already imported above it.
				continue;
			}

			$record = array(
				'name'      => (string) $entry['name'],
				'value'     => $value,
				'bricks_id' => isset( $entry['id'] ) ? (string) $entry['id'] : '',
				'source'    => 'bricks-import',
			);

			if ( ! empty( $entry['category'] ) && isset( $category_names[ $entry['category'] ] ) ) {
				$record['category'] = $category_names[ $entry['category'] ];
			}

			$out[] = $record;
		}

		return $out;
	}

	/**
	 * Generate a Bricks-style variable id: a short lowercase alphanumeric
	 * string (matches the shape of real Bricks ids seen in the docs, e.g.
	 * "jeeawn", "ab3kxz" — 6 characters, no confirmed generation algorithm
	 * published, so this only needs to be a plausible, collision-free id
	 * for AFF's own round-tripping, not to replicate Bricks' internal
	 * generator exactly).
	 *
	 * @param array $existing_ids IDs already used in the current batch.
	 * @return string
	 */
	private static function generate_id( array $existing_ids ): string {
		$alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
		do {
			$id = '';
			for ( $i = 0; $i < 6; $i++ ) {
				$id .= $alphabet[ random_int( 0, strlen( $alphabet ) - 1 ) ];
			}
		} while ( in_array( $id, $existing_ids, true ) );

		return $id;
	}
}
