<?php
/**
 * ATFRFO Classes Reader — Elementor v4 Global Classes Extractor
 *
 * Reads Elementor V4 Global Classes from the active kit. Primary path calls
 * Elementor's own \Elementor\Modules\GlobalClasses\Global_Classes_Repository
 * directly, in-process — no HTTP round-trip, and it is Elementor's own
 * authoritative source. Falls back to the REST API only if that class isn't
 * available (older Elementor versions without it).
 *
 * CRITICAL: This class is READ-ONLY. It never writes to Elementor data.
 *
 * FIXED 2026-08-06 — do not reintroduce a raw `_elementor_global_classes`
 * post meta read as a trusted path. That meta key is legacy: as of
 * Elementor 4.2.1, Global Classes are stored as individual
 * `Global_Class_Post` posts (see `Global_Classes_Repository::all_from_posts()`
 * in Elementor's own source), and the old meta key still exists but no
 * longer reflects the real class list. It returns *something* non-empty,
 * so a naive "fall back to REST only if meta is empty" check never fires —
 * this was live and undetected through all of Phase 3.1/3.2 development:
 * confirmed on two real sites, the meta read returned 10 stale items while
 * the true counts were 54 and 73. If a future Elementor version deprecates
 * `Global_Classes_Repository` too, add a new primary path for whatever
 * replaces it — do not resurrect the meta-blob read as a fallback; it
 * cannot be distinguished from genuinely-empty-and-correct.
 *
 * Item shape confirmed from a live repository call (both `all()->get_items()`
 * and the REST response use the same shape):
 *   { "id": "gc-...", "label": "...", "type": "class", "variants": [...] }
 * `order` is a flat array of those same IDs, defining display order.
 *
 * @package AtomicFrameworkForge
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class ATFRFO_Classes_Reader {

	/**
	 * Entry point: try the in-process repository read first, fall back to REST.
	 *
	 * @return array {
	 *     @type array  $classes Normalized class stubs (see normalize()).
	 *     @type string $source  'repository' | 'rest' | 'unavailable'.
	 * }
	 */
	public function get_all(): array {
		$classes = $this->read_from_repository();
		if ( ! empty( $classes ) ) {
			return array(
				'classes' => $classes,
				'source'  => 'repository',
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
	 * Primary read path: Elementor's own Global_Classes_Repository, called
	 * directly in-process. This is the exact class both Elementor's editor
	 * UI and its REST controller use internally — reading it directly is
	 * as authoritative as REST, without the HTTP round-trip.
	 *
	 * Guarded with class_exists() so this degrades gracefully to the REST
	 * fallback on any Elementor version where this class doesn't exist
	 * (older versions, or a future refactor on Elementor's side).
	 *
	 * @return array Normalized class stubs, or empty array if unavailable.
	 */
	public function read_from_repository(): array {
		if ( ! class_exists( '\Elementor\Modules\GlobalClasses\Global_Classes_Repository' )
			|| ! class_exists( '\Elementor\Plugin' )
		) {
			return array();
		}

		$kit = \Elementor\Plugin::$instance->kits_manager->get_active_kit();
		if ( ! $kit ) {
			return array();
		}

		try {
			$repo  = new \Elementor\Modules\GlobalClasses\Global_Classes_Repository( $kit );
			$all   = $repo->all();
			$items = $all->get_items()->all();
			$order = $all->get_order()->all();
		} catch ( \Throwable $e ) {
			return array();
		}

		if ( ! is_array( $items ) ) {
			return array();
		}

		return $this->normalize(
			array(
				'items' => $items,
				'order' => is_array( $order ) ? $order : array(),
			)
		);
	}

	/**
	 * Fallback read path: Elementor's REST API. Same underlying data source
	 * as read_from_repository() (the REST controller calls the same
	 * repository class), reached over HTTP instead of in-process — only
	 * used when the repository class itself isn't available.
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
	 * Normalize either the repository shape ({items, order}) or the REST
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
