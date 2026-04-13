<?php
/**
 * AFF CSS Parser — Elementor v4 Variable Extractor
 *
 * Locates Elementor's compiled kit CSS file and extracts the Elementor v4
 * atomic widget CSS variables from the terminal :root block.
 *
 * CRITICAL: This class is READ-ONLY with respect to Elementor's CSS files.
 * It never writes to, modifies, or regenerates Elementor's stylesheets.
 *
 * How the v4 block is identified:
 * - Elementor outputs a legacy :root block containing --e-global-* variables.
 * - Elementor v4 appends a second (terminal) :root block at the end of the
 *   same file containing user-defined atomic variables.
 * - This parser extracts variables from the last :root block whose variables
 *   do NOT start with any known system/legacy prefix.
 *
 * Known normalization: Elementor v4 may output 'lamp()' instead of 'clamp()'
 * due to a known editor typo. This class normalizes lamp() → clamp().
 *
 * @package AtomicFrameworkForge
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class AFF_CSS_Parser {

	/**
	 * Variable name prefixes that belong to Elementor's legacy/system blocks.
	 * Variables starting with any of these are excluded from v4 extraction.
	 *
	 * @var string[]
	 */
	public const SYSTEM_PREFIXES = array(
		'--e-global-',
		'--e-a-',
		'--e-one-',
		'--e-context-',
		'--e-button-',
		'--e-notice-',
		'--e-site-editor-',
		'--e-preview-',
		'--e-black',
		'--e-admin-',
		'--e-focus-',
		'--arts-fluid-',
		'--arts-',
		'--container-',
		'--kit-',
		'--widgets-spacing',
		'--page-title-',
	);

	// -----------------------------------------------------------------------
	// PUBLIC API
	// -----------------------------------------------------------------------

	/**
	 * Find the active Elementor kit CSS file.
	 *
	 * Attempts to locate via the active kit option first; falls back to
	 * scanning the css directory for any post-*.css containing v4 variables.
	 *
	 * @return string|null Absolute file path, or null if not found.
	 */
	public function find_kit_css_file(): ?string {
		$upload_dir = wp_upload_dir();
		$css_dir    = $upload_dir['basedir'] . '/elementor/css/';

		if ( ! is_dir( $css_dir ) ) {
			return null;
		}

		// Primary: use the active kit ID registered by Elementor.
		$kit_id = $this->get_active_kit_id();
		if ( $kit_id ) {
			$file = $css_dir . 'post-' . $kit_id . '.css';
			if ( file_exists( $file ) ) {
				return $file;
			}
		}

		// Fallback: scan all post-*.css files for one containing v4 variables.
		$candidates = glob( $css_dir . 'post-*.css' );
		if ( empty( $candidates ) ) {
			return null;
		}

		// Sort by modification time, newest first.
		usort( $candidates, static fn( $a, $b ) => filemtime( $b ) - filemtime( $a ) );

		foreach ( $candidates as $candidate ) {
			$css = file_get_contents( $candidate );
			if ( false !== $css && ! empty( $this->extract_v4_variables( $css ) ) ) {
				return $candidate;
			}
		}

		return $candidates[0] ?? null;
	}

	/**
	 * Parse a CSS file and return all Elementor v4 atomic variables.
	 *
	 * @param string $file_path Absolute path to the CSS file.
	 * @return array[] Array of { name: string, value: string } pairs.
	 */
	public function parse_file( string $file_path ): array {
		if ( ! file_exists( $file_path ) || ! is_readable( $file_path ) ) {
			return array();
		}

		$css = file_get_contents( $file_path );
		if ( false === $css ) {
			return array();
		}

		return $this->extract_v4_variables( $css );
	}

	/**
	 * Get the modification timestamp of the kit CSS file.
	 *
	 * Useful for detecting when Elementor has regenerated styles.
	 *
	 * @return int|null Unix timestamp, or null if file not found.
	 */
	public function get_kit_css_mtime(): ?int {
		$file = $this->find_kit_css_file();
		return $file ? (int) filemtime( $file ) : null;
	}

	// -----------------------------------------------------------------------
	// EXTRACTION LOGIC
	// -----------------------------------------------------------------------

	/**
	 * Extract v4 atomic variables from a raw CSS string.
	 *
	 * Finds all :root blocks, iterates them in reverse, and returns the
	 * variables from the last block that contains only non-system variables.
	 *
	 * @param string $css Raw CSS content.
	 * @return array[] Array of { name, value } pairs.
	 */
	public function extract_v4_variables( string $css ): array {
		$blocks = $this->find_root_blocks( $css );

		if ( empty( $blocks ) ) {
			return array();
		}

		// Walk blocks from last to first; return first block that has user vars.
		foreach ( array_reverse( $blocks ) as $block ) {
			$all_vars = $this->parse_variables_from_block( $block );
			$user_vars = array_values(
				array_filter( $all_vars, array( $this, 'is_user_variable' ) )
			);

			if ( ! empty( $user_vars ) ) {
				return $user_vars;
			}
		}

		return array();
	}

	// -----------------------------------------------------------------------
	// PRIVATE HELPERS
	// -----------------------------------------------------------------------

	/**
	 * Get the active Elementor kit post ID from WordPress options.
	 *
	 * @return int|null
	 */
	public static function get_active_kit_id(): ?int {
		$kit_id = (int) get_option( 'elementor_active_kit', 0 );
		return $kit_id > 0 ? $kit_id : null;
	}

	/**
	 * Find all :root { ... } block contents in a CSS string.
	 *
	 * @param string $css Raw CSS.
	 * @return string[] Array of block content strings (between { and }).
	 */
	private function find_root_blocks( string $css ): array {
		$blocks  = array();
		$pattern = '/:root\s*\{([^}]+)\}/';

		if ( preg_match_all( $pattern, $css, $matches ) ) {
			$blocks = $matches[1];
		}

		return $blocks;
	}

	/**
	 * Parse CSS custom properties from a block content string.
	 *
	 * @param string $block CSS block content (between { and }).
	 * @return array[] Array of { name, value } pairs.
	 */
	private function parse_variables_from_block( string $block ): array {
		$variables = array();
		$pattern   = '/(--[\w-]+)\s*:\s*([^;]+);/';

		if ( preg_match_all( $pattern, $block, $matches, PREG_SET_ORDER ) ) {
			foreach ( $matches as $match ) {
				$variables[] = array(
					'name'  => trim( $match[1] ),
					'value' => $this->normalize_value( trim( $match[2] ) ),
				);
			}
		}

		return $variables;
	}

	/**
	 * Determine whether a variable is user-defined (not a system variable).
	 *
	 * @param array $var Variable array with 'name' key.
	 * @return bool True if the variable is user-defined.
	 */
	private function is_user_variable( array $var ): bool {
		$name = $var['name'] ?? '';

		foreach ( self::SYSTEM_PREFIXES as $prefix ) {
			if ( str_starts_with( $name, $prefix ) ) {
				return false;
			}
		}

		return true;
	}

	/**
	 * Normalize a CSS variable value.
	 *
	 * Corrections applied:
	 * - lamp() → clamp()  (Elementor v4 known typo in variable editor)
	 *
	 * @param string $value Raw value string.
	 * @return string Normalized value.
	 */
	private function normalize_value( string $value ): string {
		return preg_replace( '/\blamp\s*\(/', 'clamp(', $value );
	}

	// -----------------------------------------------------------------------
	// DIRECT META READ (primary sync path — Elementor v4)
	// -----------------------------------------------------------------------

	/**
	 * Read Elementor v4 variables directly from the active kit's post meta.
	 *
	 * Elementor stores global variables in `_elementor_global_variables` on the
	 * kit post as a JSON-encoded string. The kit CSS file is a cache derived from
	 * this meta — reading the meta directly works even when no CSS file exists.
	 *
	 * @return array[]|null Array of { name: string, value: string }, or null if unavailable.
	 */
	public function read_from_kit_meta(): ?array {
		$kit_id = $this->get_active_kit_id();
		if ( ! $kit_id ) {
			return null;
		}

		$raw = get_post_meta( $kit_id, '_elementor_global_variables', true );

		if ( empty( $raw ) ) {
			return null;
		}

		// Elementor stores the meta as a JSON string (via update_json_meta).
		if ( is_string( $raw ) ) {
			$decoded = json_decode( $raw, true );
			if ( JSON_ERROR_NONE !== json_last_error() || ! is_array( $decoded ) ) {
				return null;
			}
			$raw = $decoded;
		}

		if ( ! is_array( $raw ) ) {
			return null;
		}

		$data = $raw['data'] ?? array();
		if ( empty( $data ) ) {
			return null;
		}

		$variables = array();

		foreach ( $data as $variable ) {
			// Skip soft-deleted variables.
			if ( isset( $variable['deleted_at'] ) ) {
				continue;
			}

			$label = sanitize_text_field( $variable['label'] ?? '' );
			if ( '' === $label ) {
				continue;
			}

			$raw_value = $variable['value'] ?? '';
			$value     = $this->extract_meta_value( $raw_value );
			if ( '' === $value ) {
				continue;
			}

			// Extract Elementor's $$type and, for size variables, the unit.
			// $$type: 'color' | 'size' | 'string'
			// size unit: 'px' | 'rem' | 'em' | '%' | 'vw' | 'vh' | 'ch' | etc.
			$el_type = '';
			$el_unit = '';
			if ( is_array( $raw_value ) ) {
				$el_type = $raw_value['$$type'] ?? '';
				if ( 'size' === $el_type && is_array( $raw_value['value'] ?? null ) ) {
					$el_unit = $raw_value['value']['unit'] ?? '';
				}
			}

			$variables[] = array(
				'name'    => '--' . $label,
				'value'   => $this->normalize_value( $value ),
				'el_type' => $el_type,  // Elementor type hint ('color'|'size'|'string')
				'el_unit' => $el_unit,  // Elementor size unit when el_type === 'size'
			);
		}

		return ! empty( $variables ) ? $variables : null;
	}

	/**
	 * Extract a plain string value from Elementor's wrapped storage format.
	 *
	 * v2 format wraps values as: { "$$type": "color|string|size", "value": ... }
	 * v1 format stores plain strings.
	 *
	 * Size inner value: { "size": 16, "unit": "px" } → "16px"
	 *
	 * @param mixed $raw Raw value from post meta.
	 * @return string Plain string value, or empty string if unparseable.
	 */
	private function extract_meta_value( $raw ): string {
		// v1: plain string
		if ( is_string( $raw ) ) {
			return trim( $raw );
		}

		if ( ! is_array( $raw ) ) {
			return '';
		}

		// v2: { "$$type": "...", "value": ... } — unwrap one level
		$inner = $raw['value'] ?? null;

		// Color / font: inner value is a plain string
		if ( is_string( $inner ) ) {
			return trim( $inner );
		}

		// Size: inner value is { "size": number, "unit": string }
		if ( is_array( $inner ) ) {
			$unit = $inner['unit'] ?? '';
			$size = $inner['size'] ?? '';

			if ( 'auto' === $unit ) {
				return 'auto';
			}

			return trim( $size . $unit );
		}

		return '';
	}
}
