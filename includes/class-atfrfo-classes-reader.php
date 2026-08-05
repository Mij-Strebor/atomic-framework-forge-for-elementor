<?php
/**
 * ATFRFO Classes Reader — Elementor v4 Global Classes Extractor
 *
 * Reads Elementor V4 Global Classes from the active kit. Primary path is a
 * direct post meta read (fast, no HTTP); falls back to the Elementor REST
 * API if the meta is empty or unavailable.
 *
 * CRITICAL: This class is READ-ONLY. It never writes to Elementor data.
 *
 * Storage shape confirmed from Elementor source (global-classes-repository.php):
 *   { "items": { "g-XXXXXXX": {...} }, "order": ["g-XXXXXXX", ...] }
 * The REST API wraps this differently: { "data": {...}, "meta": { "order": [...] } }
 * normalize() accepts either shape.
 *
 * @package AtomicFrameworkForge
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class ATFRFO_Classes_Reader {

	const META_KEY_FRONTEND = '_elementor_global_classes';

	/**
	 * Entry point: try the direct post meta read first, fall back to REST.
	 *
	 * @return array {
	 *     @type array  $classes Normalized class stubs (see normalize()).
	 *     @type string $source  'postmeta' | 'rest' | 'unavailable'.
	 * }
	 */
	public function get_all(): array {
		$classes = $this->read_from_postmeta();
		if ( ! empty( $classes ) ) {
			return array(
				'classes' => $classes,
				'source'  => 'postmeta',
			);
		}

		$classes = $this->fetch_from_rest();
		if ( ! empty( $classes ) ) {
			return array(
				'classes' => $classes,
				'source'  => 'rest',
			);
		}

		// Empty from both paths is ambiguous: could mean zero classes exist,
		// or the Global Classes feature (e_classes + e_atomic_elements
		// experiments) is disabled on this site. Callers must check
		// is_feature_available() separately to tell these apart.
		return array(
			'classes' => array(),
			'source'  => 'unavailable',
		);
	}

	/**
	 * Whether the Elementor REST endpoint for Global Classes exists at all —
	 * distinguishes "feature disabled" from "zero classes created yet".
	 *
	 * @return bool
	 */
	public function is_feature_available(): bool {
		$routes = rest_get_server()->get_routes();
		return isset( $routes['/elementor/v1/global-classes'] );
	}

	/**
	 * Primary read path: direct post meta on the active kit post.
	 *
	 * Deliberately does not use Elementor's own Kit::get_json_meta() —
	 * that requires Elementor's DI container fully initialized, which may
	 * not hold during an AJAX call outside the editor context.
	 *
	 * @return array Normalized class stubs, or empty array if none found.
	 */
	public function read_from_postmeta(): array {
		$kit_id = ATFRFO_CSS_Parser::get_active_kit_id();
		if ( ! $kit_id ) {
			return array();
		}

		$raw = get_post_meta( $kit_id, self::META_KEY_FRONTEND, true );
		if ( is_string( $raw ) ) {
			$raw = json_decode( $raw, true );
		}

		if ( ! is_array( $raw ) ) {
			return array();
		}

		return $this->normalize( $raw );
	}

	/**
	 * Fallback read path: Elementor's REST API.
	 *
	 * @return array Normalized class stubs, or empty array on failure.
	 */
	public function fetch_from_rest(): array {
		$response = wp_remote_get(
			rest_url( 'elementor/v1/global-classes' ),
			array(
				'headers' => array( 'X-WP-Nonce' => wp_create_nonce( 'wp_rest' ) ),
				'timeout' => 10,
			)
		);

		if ( is_wp_error( $response ) || 200 !== wp_remote_retrieve_response_code( $response ) ) {
			return array();
		}

		$body = json_decode( wp_remote_retrieve_body( $response ), true );
		if ( ! is_array( $body ) ) {
			return array();
		}

		return $this->normalize( $body );
	}

	/**
	 * Normalize either the direct-meta shape ({items, order}) or the REST
	 * shape ({data, meta.order}) into an order-respecting array of class
	 * stubs. Deliberately minimal — category/status/notes assignment is the
	 * data store's job (merge against existing AFF-local data), not the
	 * reader's.
	 *
	 * @param array $raw Raw Elementor structure, either shape.
	 * @return array List of ['elementor_id' => ..., 'label' => ..., 'has_styles' => bool, 'raw' => array].
	 */
	public function normalize( array $raw ): array {
		$items = $raw['items'] ?? $raw['data'] ?? array();
		$order = $raw['order'] ?? $raw['meta']['order'] ?? array();

		if ( ! is_array( $items ) ) {
			return array();
		}

		// Respect Elementor's stored order; append any item missing from
		// $order (defensive — shouldn't happen with well-formed data).
		$ordered_ids = is_array( $order ) ? $order : array();
		foreach ( array_keys( $items ) as $id ) {
			if ( ! in_array( $id, $ordered_ids, true ) ) {
				$ordered_ids[] = $id;
			}
		}

		$result = array();
		foreach ( $ordered_ids as $id ) {
			if ( ! isset( $items[ $id ] ) || ! is_array( $items[ $id ] ) ) {
				continue;
			}
			$item     = $items[ $id ];
			$variants = isset( $item['variants'] ) && is_array( $item['variants'] ) ? $item['variants'] : array();

			$result[] = array(
				'elementor_id' => (string) ( $item['id'] ?? $id ),
				'label'        => (string) ( $item['label'] ?? '' ),
				'has_styles'   => count( $variants ) > 0,
				'raw'          => $item,
			);
		}

		return $result;
	}
}
