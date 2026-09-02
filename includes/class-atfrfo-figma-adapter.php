<?php
/**
 * ATFRFO Figma Adapter — Portable AFF <-> Figma Design Tokens Translation
 *
 * Pure array-in/array-out translation between AFF's internal variable shape
 * and a W3C Design Tokens Community Group (DTCG) format JSON file — the
 * format the dominant real-world Figma tokens plugin, Tokens Studio for
 * Figma, can import directly (it supports both a "legacy" format and
 * "W3C DTCG"; this adapter targets DTCG specifically, per the format
 * decision made when this feature was scoped: a static token file, no live
 * Figma REST API connection, no API token, no new external dependency).
 *
 * No WordPress function calls in this class — see ATFRFO CLAUDE.md Critical
 * Rule #2 (portable data layer).
 *
 * LEAST-VERIFIED of AFF's three export adapters — flag this plainly. The
 * $type/$value shapes below (color, dimension, fontFamily) are taken
 * directly from the current DTCG format spec (designtokens.org/tr/drafts/format/),
 * which is itself still a draft, not a finished W3C Recommendation, and
 * could change. Unlike ATFRFO_Elementor_V4_Adapter (cross-checked against
 * real Elementor plugin source) there is no Figma or Tokens Studio install
 * on this dev site to round-trip test against. Before relying on this for
 * a real Figma workflow, do an actual import into Tokens Studio and confirm
 * it reads correctly.
 *
 * @package AtomicFrameworkForge
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class ATFRFO_Figma_Adapter {

	// AFF subgroup name -> DTCG group key + $type. Order controls the
	// group order in the exported file.
	const GROUP_MAP = array(
		'Colors'  => array( 'key' => 'Colors', 'type' => 'color' ),
		'Numbers' => array( 'key' => 'Numbers', 'type' => 'dimension' ),
		'Fonts'   => array( 'key' => 'Fonts', 'type' => 'fontFamily' ),
	);

	/**
	 * Convert an array of AFF variable records into a DTCG-format design
	 * tokens tree, grouped by AFF subgroup (Colors/Numbers/Fonts), each
	 * group carrying its own inherited $type.
	 *
	 * @param array $aff_variables AFF variable records.
	 * @return array DTCG token tree.
	 */
	public static function to_tokens( array $aff_variables ): array {
		$tree = array();

		foreach ( $aff_variables as $variable ) {
			if ( ! is_array( $variable ) || empty( $variable['name'] ) ) {
				continue;
			}

			$subgroup = $variable['subgroup'] ?? '';
			$group    = self::GROUP_MAP[ $subgroup ] ?? self::GROUP_MAP['Numbers'];
			$type     = $group['type'];

			if ( ! isset( $tree[ $group['key'] ] ) ) {
				$tree[ $group['key'] ] = array( '$type' => $type );
			}

			$css_value = (string) ( $variable['value'] ?? '' );
			$token     = array( '$value' => self::css_value_to_dtcg( $css_value, $type ) );

			$tree[ $group['key'] ][ $variable['name'] ] = $token;
		}

		return $tree;
	}

	/**
	 * Convert a decoded DTCG token tree back into AFF variable records.
	 * Recurses through arbitrarily nested groups, carrying each group's
	 * $type down to its children (per spec, a token without its own $type
	 * inherits the nearest ancestor group's $type).
	 *
	 * @param array $tree Decoded DTCG JSON.
	 * @return array AFF-shaped variable records.
	 */
	public static function from_tokens( array $tree ): array {
		$out = array();
		self::walk_tokens( $tree, null, '', $out );
		return $out;
	}

	/**
	 * @param array       $node          Current tree node.
	 * @param string|null $inherited_type Nearest ancestor $type, or null.
	 * @param string      $path_prefix   Unused today (flat AFF names), kept
	 *                                    for a future nested-token-set import.
	 * @param array       $out           Accumulator, passed by reference.
	 */
	private static function walk_tokens( array $node, ?string $inherited_type, string $path_prefix, array &$out ): void {
		$type = isset( $node['$type'] ) && is_string( $node['$type'] ) ? $node['$type'] : $inherited_type;

		foreach ( $node as $key => $value ) {
			if ( '$' === ( $key[0] ?? '' ) ) {
				continue; // $type, $description, $extensions, etc. at this level.
			}
			if ( ! is_array( $value ) ) {
				continue;
			}

			if ( array_key_exists( '$value', $value ) ) {
				// Leaf token.
				$subgroup = self::type_to_subgroup( $type );
				$out[]    = array(
					'name'     => (string) $key,
					'value'    => self::dtcg_value_to_css( $value['$value'], $type ),
					'type'     => strtolower( $subgroup ) === 'colors' ? 'color' : ( strtolower( $subgroup ) === 'numbers' ? 'number' : ( strtolower( $subgroup ) === 'fonts' ? 'font' : '' ) ),
					'subgroup' => $subgroup,
					'source'   => 'figma-import',
				);
				continue;
			}

			// Nested group — recurse.
			self::walk_tokens( $value, $type, $path_prefix . $key . '.', $out );
		}
	}

	/**
	 * Map a DTCG $type back to an AFF subgroup name. Falls back to 'Fonts'
	 * (the same catch-all AFF uses for anything that isn't color/number —
	 * see ATFRFO_Elementor_V4_Adapter::elementor_type_to_aff()) for any
	 * $type this adapter doesn't have a direct AFF equivalent for.
	 *
	 * @param string|null $type DTCG $type, or null if never set.
	 * @return string AFF subgroup name.
	 */
	private static function type_to_subgroup( ?string $type ): string {
		switch ( $type ) {
			case 'color':
				return 'Colors';
			case 'dimension':
			case 'number':
				return 'Numbers';
			case 'fontFamily':
			default:
				return 'Fonts';
		}
	}

	/**
	 * Convert a plain CSS value string into a DTCG $value for the given type.
	 *
	 * @param string $css_value
	 * @param string $type
	 * @return mixed
	 */
	private static function css_value_to_dtcg( string $css_value, string $type ) {
		if ( 'color' === $type ) {
			return self::hex_to_dtcg_color( $css_value );
		}

		if ( 'dimension' === $type ) {
			if ( preg_match( '/^(-?[\d.]+)\s*([a-z%]*)$/i', trim( $css_value ), $m ) ) {
				return array(
					'value' => (float) $m[1],
					'unit'  => $m[2] !== '' ? $m[2] : 'px',
				);
			}
			// Unparseable (clamp()/calc()/etc. — AFF's "FX" format). DTCG has
			// no generic expression type; store the raw CSS string rather
			// than force it into a { value, unit } shape that would lose or
			// misrepresent it. Deliberate spec deviation, documented here.
			return $css_value;
		}

		if ( 'fontFamily' === $type ) {
			$parts = array_map(
				static function ( $part ) {
					return trim( $part, " \t\n\r\0\x0B'\"" );
				},
				explode( ',', $css_value )
			);
			return array_values( array_filter( $parts, static fn( $p ) => '' !== $p ) );
		}

		return $css_value;
	}

	/**
	 * Convert a DTCG $value back into a plain CSS value string.
	 *
	 * @param mixed  $dtcg_value
	 * @param string|null $type
	 * @return string
	 */
	private static function dtcg_value_to_css( $dtcg_value, ?string $type ): string {
		if ( 'color' === $type && is_array( $dtcg_value ) ) {
			return self::dtcg_color_to_hex( $dtcg_value );
		}

		if ( 'dimension' === $type && is_array( $dtcg_value ) && isset( $dtcg_value['value'] ) ) {
			$unit = isset( $dtcg_value['unit'] ) ? $dtcg_value['unit'] : 'px';
			return $dtcg_value['value'] . $unit;
		}

		if ( 'fontFamily' === $type && is_array( $dtcg_value ) ) {
			// No quote-wrapping here, even for multi-word names — AFF's own
			// stored convention is unquoted regardless of spaces (confirmed
			// against real project data: "Space Grotesk", "JetBrains Mono"
			// are stored bare). Adding quotes for CSS technical correctness
			// would break round-trip fidelity with what AFF actually stores.
			return implode( ', ', array_map( 'strval', $dtcg_value ) );
		}

		return is_scalar( $dtcg_value ) ? (string) $dtcg_value : wp_json_encode( $dtcg_value );
	}

	/**
	 * Parse a CSS color string (#hex or #hex with alpha) into a DTCG color
	 * $value object. Includes a plain `hex` convenience field alongside the
	 * spec's colorSpace/components — several real-world DTCG examples do
	 * the same for easier round-tripping/readability, and it's explicitly
	 * allowed (a token MAY carry additional properties beyond $value/$type).
	 *
	 * @param string $css_value
	 * @return array
	 */
	private static function hex_to_dtcg_color( string $css_value ): array {
		$hex = trim( $css_value );

		if ( preg_match( '/^#?([0-9a-f]{6})([0-9a-f]{2})?$/i', $hex, $m ) ) {
			$r     = hexdec( substr( $m[1], 0, 2 ) ) / 255;
			$g     = hexdec( substr( $m[1], 2, 2 ) ) / 255;
			$b     = hexdec( substr( $m[1], 4, 2 ) ) / 255;
			$alpha = isset( $m[2] ) ? round( hexdec( $m[2] ) / 255, 4 ) : 1;

			$result = array(
				'colorSpace' => 'srgb',
				'components' => array( round( $r, 4 ), round( $g, 4 ), round( $b, 4 ) ),
				// Full original hex, including the alpha byte pair when
				// present — dtcg_color_to_hex() prefers this field on the
				// way back for an exact round trip. Storing only the 6-digit
				// RGB portion here previously silently dropped alpha on
				// import (e.g. "#0000FF1A" -> "#0000ff"), even though the
				// numeric alpha value below was captured correctly.
				'hex'        => '#' . strtolower( $m[1] . ( $m[2] ?? '' ) ),
			);
			if ( $alpha < 1 ) {
				$result['alpha'] = $alpha;
			}
			return $result;
		}

		// Unparseable (named color, rgb()/hsl() function, CSS var(), etc.) —
		// keep the original string under `hex` so it survives round-trip,
		// even though it isn't literally a hex value.
		return array(
			'colorSpace' => 'srgb',
			'components' => array( 0, 0, 0 ),
			'hex'        => $hex,
		);
	}

	/**
	 * Reverse of hex_to_dtcg_color(): prefer the convenience `hex` field
	 * when present (round-trips exactly); otherwise reconstruct from
	 * colorSpace/components.
	 *
	 * @param array $dtcg_color
	 * @return string
	 */
	private static function dtcg_color_to_hex( array $dtcg_color ): string {
		if ( ! empty( $dtcg_color['hex'] ) && is_string( $dtcg_color['hex'] ) ) {
			return $dtcg_color['hex'];
		}

		if ( isset( $dtcg_color['components'] ) && is_array( $dtcg_color['components'] ) && count( $dtcg_color['components'] ) >= 3 ) {
			$c   = $dtcg_color['components'];
			$hex = '#';
			foreach ( array_slice( $c, 0, 3 ) as $channel ) {
				$hex .= str_pad( dechex( (int) round( ( (float) $channel ) * 255 ) ), 2, '0', STR_PAD_LEFT );
			}
			return $hex;
		}

		return '#000000';
	}
}
