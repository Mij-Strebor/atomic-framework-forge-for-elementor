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
	 * Where a class is actually used across the site — same data Elementor's
	 * own editor computes for its class manager, read from Elementor's own
	 * usage-tracking module rather than reimplemented. Scans every Elementor
	 * document (page/post/template) on every call — there is no cache in
	 * Elementor's own class, so this is deliberately NOT called during a
	 * regular Classes sync; call it lazily (e.g. when a class detail card is
	 * opened) and cache the result client-side for the session.
	 *
	 * Confirmed live 2026-08-07: ~440ms for 44 used classes across ~10
	 * documents on the dev site. Cost scales with document + class count,
	 * so treat as "occasionally, on demand," not "every page load."
	 *
	 * @return array<string, array{total:int, pages:array}> Keyed by Elementor
	 *   class ID (e.g. 'gc-0e2eff4039bbe56f'). Each entry: total usage count
	 *   across the whole site, and a list of pages
	 *   {pageId, title, type, total, elements}, where `elements` is a list of
	 *   widget/element type labels (e.g. 'e-heading'), not raw element IDs.
	 */
	public function get_usage_map(): array {
		if ( ! class_exists( '\Elementor\Modules\GlobalClasses\Usage\Applied_Global_Classes_Usage' ) ) {
			return array();
		}

		try {
			$detailed = ( new \Elementor\Modules\GlobalClasses\Usage\Applied_Global_Classes_Usage() )->get_detailed_usage();
		} catch ( \Throwable $e ) {
			return array();
		}

		// Elementor's own tracker (Document_Usage::analyze() in Elementor core)
		// only records each element's opaque node ID, not its widget type —
		// meaningless in the AFF UI, since there's no way to tell which
		// element on the page it actually is. Resolve each ID to its widget
		// type by walking each referenced page's element tree once (cached
		// per page here, since several classes typically share the same
		// pages) and swap the raw ID for that label before returning.
		$page_element_labels = array();

		$map = array();
		foreach ( $detailed as $class_id => $pages ) {
			$total          = 0;
			$resolved_pages = array();
			foreach ( $pages as $page ) {
				$total   = $total + (int) ( $page['total'] ?? 0 );
				$page_id = (int) ( $page['pageId'] ?? 0 );

				if ( ! isset( $page_element_labels[ $page_id ] ) ) {
					$page_element_labels[ $page_id ] = $this->get_page_element_labels( $page_id );
				}
				$labels = $page_element_labels[ $page_id ];

				$element_ids       = is_array( $page['elements'] ?? null ) ? $page['elements'] : array();
				$page['elements']  = array_map(
					function ( $id ) use ( $labels ) {
						return $labels[ $id ] ?? $id;
					},
					$element_ids
				);
				$resolved_pages[] = $page;
			}
			$map[ $class_id ] = array(
				'total' => $total,
				'pages' => $resolved_pages,
			);
		}

		return $map;
	}

	/**
	 * Map every element ID in a document to its widget type (or element
	 * type, for non-widget elements like containers), by walking the raw
	 * element tree once. Used to turn Elementor's opaque per-element usage
	 * IDs into something a user can actually recognize on the page.
	 *
	 * @param int $page_id
	 * @return array<string, string> Element ID => widget/element type label.
	 */
	private function get_page_element_labels( int $page_id ): array {
		if ( ! $page_id || ! class_exists( '\Elementor\Plugin' ) ) {
			return array();
		}

		$document = \Elementor\Plugin::$instance->documents->get( $page_id );
		if ( ! $document ) {
			return array();
		}

		$labels = array();
		$walk   = function ( array $elements ) use ( &$walk, &$labels ) {
			foreach ( $elements as $element ) {
				$id = $element['id'] ?? '';
				if ( $id ) {
					$type = (string) ( $element['widgetType'] ?? $element['elType'] ?? 'element' );
					// Elementor's atomic widget/element type strings are all
					// prefixed 'e-' (e-heading, e-flexbox, e-div-block) —
					// strip that and the dashes for a readable label
					// ("heading", "flexbox", "div block").
					if ( 0 === strpos( $type, 'e-' ) ) {
						$type = substr( $type, 2 );
					}
					$labels[ $id ] = str_replace( '-', ' ', $type );
				}
				if ( ! empty( $element['elements'] ) && is_array( $element['elements'] ) ) {
					$walk( $element['elements'] );
				}
			}
		};
		$walk( $document->get_elements_raw_data() ?? array() );

		return $labels;
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

		$var_index = $this->get_variable_index();

		$result = array();
		foreach ( $ordered_ids as $id ) {
			if ( ! isset( $items[ $id ] ) || ! is_array( $items[ $id ] ) ) {
				continue;
			}
			$item     = $items[ $id ];
			$variants = isset( $item['variants'] ) && is_array( $item['variants'] ) ? $item['variants'] : array();

			if ( ! empty( $var_index ) ) {
				$item['variants'] = $this->resolve_variable_refs( $variants, $var_index );
			}

			$result[] = array(
				'elementor_id'     => (string) ( $item['id'] ?? $id ),
				'label'            => (string) ( $item['label'] ?? '' ),
				'has_styles'       => count( $variants ) > 0,
				'style_categories' => $this->get_style_categories( $item['variants'] ?? $variants ),
				'raw'              => $item,
			);
		}

		return $result;
	}

	/**
	 * Maps a CSS property key (as it appears in a class variant's `props`
	 * object) to Elementor's own editor-panel section label — the same
	 * groupings ("Layout", "Spacing", "Size", "Position", "Typography",
	 * "Background", "Border", "Effects") shown as tabs in the style panel.
	 *
	 * SOURCED, NOT GUESSED — extracted 2026-08-07 directly from Elementor's
	 * own compiled editor bundle (assets/js/packages/editor-editing-panel/
	 * editor-editing-panel.js, non-minified), by reading each style-section
	 * field component's `bind: "prop-key"` prop, e.g. z-index-field.tsx
	 * contains `StylesField, { bind: "z-index" }` inside
	 * .../style-sections/position-section/z-index-field.tsx — the directory
	 * name IS the section. This is Elementor's own source of truth, not an
	 * inference from CSS semantics (e.g. "z-index" living under "Position"
	 * rather than a hypothetical "Layer" section is Elementor's own product
	 * decision, confirmed this way, not assumed from general CSS knowledge).
	 *
	 * Coverage caveat: border-radius's four individual corner sub-controls
	 * bind to compound keys assembled from a template literal in the source
	 * (not a plain string), so they could not be extracted with the same
	 * confidence as the rest of this table — all border-radius props are
	 * bucketed under 'border' without distinguishing corners, which is fine
	 * for AFF's purposes (this table answers "which section," not "which
	 * exact control"). If Elementor's bundle changes on a future update,
	 * this table needs re-extracting the same way, not hand-edited from memory.
	 *
	 * @var array<string,string>
	 */
	private const PROP_CATEGORY_MAP = array(
		// Background
		'background'         => 'Background',
		// Border
		'border-color'       => 'Border',
		'border-style'       => 'Border',
		'border-width'       => 'Border',
		'border-radius'      => 'Border',
		// Effects
		'backdrop-filter'    => 'Effects',
		'box-shadow'         => 'Effects',
		'filter'             => 'Effects',
		'mix-blend-mode'     => 'Effects',
		'opacity'            => 'Effects',
		'transform'          => 'Effects',
		'transition'         => 'Effects',
		// Layout
		'align-content'      => 'Layout',
		'align-items'        => 'Layout',
		'align-self'         => 'Layout',
		'display'            => 'Layout',
		'flex'               => 'Layout',
		'flex-direction'     => 'Layout',
		'flex-wrap'          => 'Layout',
		'flex-basis'         => 'Layout',
		'flex-grow'          => 'Layout',
		'flex-shrink'        => 'Layout',
		'gap'                => 'Layout',
		'grid-auto-columns'  => 'Layout',
		'grid-auto-flow'     => 'Layout',
		'grid-auto-rows'     => 'Layout',
		'justify-content'    => 'Layout',
		'justify-items'      => 'Layout',
		'order'              => 'Layout',
		// Position
		'position'           => 'Position',
		'scroll-margin-top'  => 'Position',
		'z-index'            => 'Position',
		'inset-block-start'  => 'Position',
		'inset-block-end'    => 'Position',
		'inset-inline-start' => 'Position',
		'inset-inline-end'   => 'Position',
		// Size
		'aspect-ratio'       => 'Size',
		'height'             => 'Size',
		'max-height'         => 'Size',
		'max-width'          => 'Size',
		'min-height'         => 'Size',
		'min-width'          => 'Size',
		'object-fit'         => 'Size',
		'object-position'    => 'Size',
		'overflow'           => 'Size',
		'width'              => 'Size',
		// Spacing
		'margin'             => 'Spacing',
		'padding'            => 'Spacing',
		// Typography
		'color'              => 'Typography',
		'column-count'       => 'Typography',
		'column-gap'         => 'Typography',
		'direction'          => 'Typography',
		'font-family'        => 'Typography',
		'font-size'          => 'Typography',
		'font-style'         => 'Typography',
		'font-weight'        => 'Typography',
		'letter-spacing'     => 'Typography',
		'line-height'        => 'Typography',
		'text-align'         => 'Typography',
		'text-decoration'    => 'Typography',
		'text-transform'     => 'Typography',
		'word-spacing'       => 'Typography',
	);

	/**
	 * Determine which Elementor style-panel sections a class actually uses,
	 * by mapping every prop key across all of its variants (all breakpoints/
	 * states) through PROP_CATEGORY_MAP, plus 'Custom CSS' if any variant
	 * has a non-empty custom_css.raw. Order matches Jim's stated category
	 * order, not alphabetical or discovery order.
	 *
	 * An unrecognized prop key is silently skipped rather than guessed —
	 * PROP_CATEGORY_MAP is deliberately not exhaustive of every Elementor
	 * control that could ever exist, only what was confirmed in the bundle
	 * read above.
	 *
	 * @param array $variants A class's `variants` array.
	 * @return string[] Category labels, in Jim's preferred display order.
	 */
	private function get_style_categories( array $variants ): array {
		$found = array();
		$order = array( 'Layout', 'Spacing', 'Size', 'Position', 'Typography', 'Background', 'Border', 'Effects', 'Custom CSS' );

		foreach ( $variants as $variant ) {
			if ( isset( $variant['props'] ) && is_array( $variant['props'] ) ) {
				foreach ( array_keys( $variant['props'] ) as $prop_key ) {
					if ( isset( self::PROP_CATEGORY_MAP[ $prop_key ] ) ) {
						$found[ self::PROP_CATEGORY_MAP[ $prop_key ] ] = true;
					}
				}
			}
			if ( ! empty( $variant['custom_css']['raw'] ) ) {
				$found['Custom CSS'] = true;
			}
		}

		return array_values( array_intersect( $order, array_keys( $found ) ) );
	}

	/**
	 * Build an id => {label, value} index of Elementor's live (non-deleted)
	 * Global Variables, used to decode a class variant prop's `e-gv-XXXXXXX`
	 * reference into the human-readable name and literal value for display
	 * in AFF's class detail card. Read-only, same in-process pattern as
	 * read_from_repository() for classes.
	 *
	 * Storage note: unlike Global Classes, Elementor's Global Variables have
	 * NOT moved off the `_elementor_global_variables` postmeta blob as of
	 * Elementor 4.2.1 (confirmed live 2026-08-06: entries are soft-deleted
	 * in place via a `deleted_at` field, not removed from the meta) — so
	 * reading it here is safe, unlike the stale-meta trap documented above
	 * for classes (TECH-DEBT.md C-08). If Elementor ever migrates Variables
	 * to a repository/per-post model the way it did Classes, this must be
	 * rewritten the same way read_from_repository() was — do not assume this
	 * meta read stays valid forever.
	 *
	 * @return array<string,array{label:string,value:mixed}> Keyed by e-gv- ID.
	 */
	private function get_variable_index(): array {
		if ( ! class_exists( '\Elementor\Modules\Variables\Storage\Repository' )
			|| ! class_exists( '\Elementor\Plugin' )
		) {
			return array();
		}

		$kit = \Elementor\Plugin::$instance->kits_manager->get_active_kit();
		if ( ! $kit ) {
			return array();
		}

		try {
			$repo = new \Elementor\Modules\Variables\Storage\Repository( $kit );
			$vars = $repo->variables();
		} catch ( \Throwable $e ) {
			return array();
		}

		if ( ! is_array( $vars ) ) {
			return array();
		}

		$index = array();
		foreach ( $vars as $var_id => $var ) {
			if ( ! is_array( $var ) || ! empty( $var['deleted_at'] ) ) {
				continue; // Soft-deleted — must not resolve refs to these.
			}
			$index[ $var_id ] = array(
				'name'  => (string) ( $var['label'] ?? '' ), // 'name' to match prop._resolved.name in atfrfo-classes.js.
				'value' => $var['value'] ?? null, // Same {$$type,value} shape as a literal prop.
			);
		}

		return $index;
	}

	/**
	 * Decode each `global-*-variable` prop in a class's variants by
	 * attaching a `_resolved` {name, value} pair looked up from $var_index.
	 * Literal (non-variable) props are left untouched. A reference to a
	 * variable not found in the index (e.g. deleted since the class was
	 * styled) is also left unresolved — the card falls back to showing the
	 * raw ID plus a "not found" note rather than guessing.
	 *
	 * @param array $variants  A class's `variants` array.
	 * @param array $var_index Output of get_variable_index().
	 * @return array The same variants structure with `_resolved` added where possible.
	 */
	private function resolve_variable_refs( array $variants, array $var_index ): array {
		foreach ( $variants as &$variant ) {
			if ( ! isset( $variant['props'] ) || ! is_array( $variant['props'] ) ) {
				continue;
			}
			foreach ( $variant['props'] as &$prop ) {
				$this->resolve_ref_recursive( $prop, $var_index );
			}
			unset( $prop );
		}
		unset( $variant );

		return $variants;
	}

	/**
	 * Attach `_resolved` to a prop, or to any of its nested sub-fields, that
	 * is a `global-*` variable reference found in $var_index.
	 *
	 * A handful of Elementor's style props are compound (Object_Prop_Type)
	 * shapes rather than a single value — 'dimensions' (padding, margin: four
	 * independently-set sides) and 'flex' (flex: grow/shrink/basis) are the
	 * two currently in use — and Elementor's editor lets each sub-field bind
	 * to a *different* variable independently. Rather than hardcoding which
	 * $$type names are compound, this recurses one level into any prop whose
	 * value is itself an array: a compound prop's sub-fields are each their
	 * own {$$type, value} shape and get resolved the same way top-level props
	 * do; a plain Size prop's {size, unit} value contains only scalars, so
	 * the recursive call on 81 or 'px' is a harmless no-op (not an array,
	 * fails the is_array() guard immediately). This way a future compound
	 * prop type needs no change here to resolve correctly — only the
	 * display-side label map (see _COMPOUND_PROP_FIELDS in
	 * atfrfo-classes.js) needs a new entry to show it nicely.
	 *
	 * @param mixed $prop      Passed by reference; mutated in place.
	 * @param array $var_index Output of get_variable_index().
	 */
	private function resolve_ref_recursive( &$prop, array $var_index ): void {
		if ( ! is_array( $prop ) || ! isset( $prop['$$type'] ) ) {
			return;
		}
		if ( isset( $prop['value'] ) && is_array( $prop['value'] ) ) {
			foreach ( $prop['value'] as &$field ) {
				$this->resolve_ref_recursive( $field, $var_index );
			}
			unset( $field );
		}
		if ( 0 !== strpos( (string) $prop['$$type'], 'global-' ) ) {
			return; // Literal or compound value, not itself a variable reference.
		}
		$ref_id = (string) ( $prop['value'] ?? '' );
		if ( isset( $var_index[ $ref_id ] ) ) {
			$prop['_resolved'] = $var_index[ $ref_id ];
		}
	}
}
