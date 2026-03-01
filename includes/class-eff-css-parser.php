<?php
/**
 * EFF CSS Parser — Elementor v4 Variable Extractor
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
 * @package ElementorFrameworkForge
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class EFF_CSS_Parser {

	/**
	 * Variable name prefixes that belong to Elementor's legacy/system blocks.
	 * Variables starting with any of these are excluded from v4 extraction.
	 *
	 * @var string[]
	 */
	const SYSTEM_PREFIXES = array(
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
	private function get_active_kit_id(): ?int {
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
}
