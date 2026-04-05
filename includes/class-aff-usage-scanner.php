<?php
/**
 * AFF Usage Scanner — Widget-level Variable Reference Counter
 *
 * Scans all Elementor post data (stored in _elementor_data post meta) for
 * references to CSS custom properties using the var(--name) pattern.
 *
 * This class has no WordPress UI dependencies. The WP database calls are the
 * only coupling to WordPress, isolated in the single public static method.
 *
 * Performance notes:
 *  - Uses substr_count() on the raw JSON string — no JSON decode needed.
 *  - Capped at MAX_POSTS to avoid memory issues on very large sites.
 *  - no_found_rows => true skips the SQL COUNT(*) pagination query.
 *
 * @package AtomicFrameworkForge
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class AFF_Usage_Scanner {

	/**
	 * Maximum number of Elementor posts to scan.
	 * Covers the vast majority of real-world sites without memory risk.
	 */
	const MAX_POSTS = 500;

	/**
	 * Scan all Elementor post data for references to the given CSS variable names.
	 *
	 * For each post that has _elementor_data meta, counts occurrences of
	 * `var(--varname` (without the closing paren to catch var(--x) and
	 * var(--x, fallback) in a single pass).
	 *
	 * @param string[] $variable_names CSS custom property names, e.g. ['--primary', '--accent'].
	 * @return array<string, int>      Map of variable name → total usage count across all posts.
	 */
	public static function scan( array $variable_names ): array {
		if ( empty( $variable_names ) ) {
			return array();
		}

		// Initialise all requested variables at 0
		$counts = array_fill_keys( $variable_names, 0 );

		$post_ids = get_posts( array(
			'post_type'      => 'any',
			'post_status'    => 'any',
			'posts_per_page' => self::MAX_POSTS,
			'fields'         => 'ids',
			'meta_query'     => array( // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_query
				array(
					'key'     => '_elementor_data',
					'compare' => 'EXISTS',
				),
			),
			'no_found_rows'  => true,
		) );

		if ( empty( $post_ids ) ) {
			return $counts;
		}

		foreach ( $post_ids as $post_id ) {
			$data = get_post_meta( $post_id, '_elementor_data', true );

			if ( empty( $data ) || ! is_string( $data ) ) {
				continue;
			}

			foreach ( $variable_names as $var_name ) {
				// Matches var(--varname) and var(--varname, fallback)
				$counts[ $var_name ] += substr_count( $data, 'var(' . $var_name );
			}
		}

		return $counts;
	}
}
