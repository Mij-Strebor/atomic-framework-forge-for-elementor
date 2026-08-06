/**
 * ATFRFO Classes — Elementor V4 Global Classes (Phase 3.2: read-only list view)
 *
 * Intercepts ATFRFO.EditSpace.loadCategory() for selection.group === 'Classes'
 * and renders a read-only list view per category.
 *
 * No standalone "Sync Classes" control — per Jim's direction (2026-08-06),
 * Classes sync is not a separate action. It fires alongside Variables sync
 * from the single top-bar "Sync with Elementor" control (V4 + Import), via
 * ATFRFO.Classes.syncFromElementor(), called from atfrfo-panel-right.js.
 * There is no V3 Classes concept, so this never fires for a V3 sync.
 *
 * Deliberately simpler than ATFRFO.Variables (atfrfo-variables.js): no expand
 * panel, no color picker, no inline value editing, no drag-reorder, no detail
 * modal, no create/rename/delete. Those are Phase 3.3/3.4
 * (see docs/AFF-VISION-AND-ROADMAP.md).
 *
 * Status vocabulary note: Classes use synced|modified|atfrfo-only|orphaned —
 * this is NOT the same vocabulary as Variables (synced|modified|new|deleted|
 * conflict|orphaned), and 'orphaned' means something different in each (see
 * _statusMeta below). Do not reuse ATFRFO.Utils.statusColor/statusLongTooltip
 * for Classes rows — those describe the Variables vocabulary.
 *
 * @package AtomicFrameworkForge
 */

(function () {
	'use strict';

	window.ATFRFO = window.ATFRFO || {};

	ATFRFO.Classes = {

		/**
		 * Initialize: intercept EditSpace.loadCategory for the Classes group.
		 */
		init: function () {
			var _prevLoad = ATFRFO.EditSpace.loadCategory.bind(ATFRFO.EditSpace);
			ATFRFO.EditSpace.loadCategory = function (selection) {
				if (selection && selection.group === 'Classes') {
					ATFRFO.Classes.loadClasses(selection);
				} else {
					_prevLoad(selection);
				}
			};
		},

		// -------------------------------------------------------------------
		// ENTRY POINT
		// -------------------------------------------------------------------

		/**
		 * Called by the overridden EditSpace.loadCategory when a Classes
		 * category is selected in the left panel.
		 *
		 * @param {{ group:string, subgroup:string, category:string, categoryId:string|null }} selection
		 */
		loadClasses: function (selection) {
			var placeholder = document.getElementById('atfrfo-placeholder');
			var content     = document.getElementById('atfrfo-edit-content');
			var workspace   = document.getElementById('atfrfo-workspace');
			if (!content) { return; }

			if (workspace)   { workspace.setAttribute('data-active', 'true'); }
			if (placeholder) { placeholder.setAttribute('hidden', ''); }
			content.removeAttribute('hidden');
			content.style.display = '';

			this._renderView(selection, content);
		},

		// -------------------------------------------------------------------
		// RENDER
		// -------------------------------------------------------------------

		/**
		 * Build and inject the Classes list view for one category.
		 *
		 * @param {Object}      selection
		 * @param {HTMLElement} container
		 */
		_renderView: function (selection, container) {
			var classes = ATFRFO.Utils.getClassesForCategory(selection.categoryId, selection.category);

			var html = '<div class="atfrfo-classes-view">'
				+ '<div class="atfrfo-classes-header">'
				+ '<h2 class="atfrfo-classes-title">' + ATFRFO.Utils.escHtml(selection.category || 'Classes') + '</h2>'
				+ '</div>';

			if (classes.length === 0) {
				html += this._renderEmptyState();
			} else {
				html += '<div class="atfrfo-classes-list">';
				classes.forEach(function (cls) {
					html += ATFRFO.Classes._renderClassRow(cls);
				});
				html += '</div>';
			}

			html += '</div>';
			container.innerHTML = html;
		},

		/**
		 * Empty-state markup shown when a category has no synced classes yet.
		 * No sync button here — Classes syncs alongside Variables from the
		 * top-bar "Sync with Elementor" control (V4 + Import), not its own
		 * action. Points the user there instead.
		 *
		 * @returns {string}
		 */
		_renderEmptyState: function () {
			return '<div class="atfrfo-classes-empty">'
				+ '<p>' + ATFRFO.Utils.escHtml('No Global Classes found in Elementor.') + '</p>'
				+ '<p>' + ATFRFO.Utils.escHtml('Use Sync (top bar) to pull classes from Elementor.') + '</p>'
				+ '</div>';
		},

		/**
		 * Render one class as a list row.
		 *
		 * Columns: drag handle placeholder + status dot (leading edge, one
		 * unit — drag itself is Phase 3.3, the handle space is reserved now
		 * so the row layout doesn't shift when drag lands), class name,
		 * category badge, has-styles indicator. No value column, no inline
		 * editing — matches docs/AFF-VISION-AND-ROADMAP.md SS5.2.
		 *
		 * @param {Object} cls Class object (see class_defaults() in PHP).
		 * @returns {string}
		 */
		_renderClassRow: function (cls) {
			var meta  = ATFRFO.Classes._statusMeta(cls.status);
			var label = ATFRFO.Utils.escHtml(cls.label || '');
			var styleLabel = cls.has_styles ? 'has styles' : 'no styles';

			return '<div class="atfrfo-color-row atfrfo-class-row" data-class-id="' + ATFRFO.Utils.escAttr(cls.id) + '">'
				+ '<span class="atfrfo-drag-handle" aria-hidden="true"></span>'
				+ '<span class="atfrfo-status-dot"'
				+ ' style="background:' + meta.color + '"'
				+ ' data-atfrfo-tooltip="' + ATFRFO.Utils.escAttr(meta.label) + '"'
				+ ' aria-label="Status: ' + ATFRFO.Utils.escAttr(meta.label) + '">'
				+ '</span>'
				+ '<span class="atfrfo-class-name">' + label + '</span>'
				+ '<span class="atfrfo-class-category-badge">' + ATFRFO.Utils.escHtml(cls.category || 'Uncategorized') + '</span>'
				+ '<span class="atfrfo-class-styles-flag" data-has-styles="' + (cls.has_styles ? 'true' : 'false') + '">'
				+ ATFRFO.Utils.escHtml(styleLabel)
				+ '</span>'
				+ '</div>';
		},

		/**
		 * Resolve a Classes status value to a CSS color and user-facing label.
		 *
		 * Classes' status vocabulary is NOT the same as Variables' (see file
		 * header). Reuses the same underlying CSS custom properties where the
		 * concept genuinely matches, on its own map — never delegates to
		 * ATFRFO.Utils.statusColor/statusLongTooltip.
		 *
		 * - synced: matches Variables' synced exactly.
		 * - modified: matches Variables' modified exactly (AFF-local metadata
		 *   changed since last sync).
		 * - atfrfo-only: exists in AFF, deleted from Elementor since last sync
		 *   — the same real-world situation as Variables' 'orphaned', so
		 *   reuses that token (muted gray), not Variables' 'deleted' (which
		 *   means something AFF itself is about to remove).
		 * - orphaned: found in Elementor, not yet in AFF's store — per the
		 *   data-store design this auto-resolves to 'synced' within the same
		 *   sync pass, so a persisted class should rarely show this state.
		 *   Reuses Variables' 'new' token (blue) since the concept ("new to
		 *   us") matches.
		 *
		 * @param {string} status
		 * @returns {{color: string, label: string}}
		 */
		_statusMeta: function (status) {
			var map = {
				'synced':      { color: 'var(--atfrfo-status-synced)',   label: 'Synced' },
				'modified':    { color: 'var(--atfrfo-status-modified)', label: 'Modified' },
				'atfrfo-only': { color: 'var(--atfrfo-status-orphaned)', label: 'AFF only' },
				'orphaned':    { color: 'var(--atfrfo-status-new)',      label: 'Orphaned' },
			};
			return map[status] || map.synced;
		},

		// -------------------------------------------------------------------
		// SYNC
		// -------------------------------------------------------------------

		/**
		 * Sync Classes from Elementor. Called from atfrfo-panel-right.js
		 * alongside Variables sync when the top-bar "Sync with Elementor"
		 * modal is submitted with V4 + Import selected — not from any
		 * Classes-specific UI control (there isn't one; see file header).
		 *
		 * @param {Object}  [options]
		 * @param {boolean} [options.silent] Skip the result modal — used when
		 *   the caller is presenting its own combined summary instead, or for
		 *   a future silent/auto-sync path. Errors still surface even when
		 *   silent — a failed sync (source: 'unavailable', see TECH-DEBT.md
		 *   A-09) must never be swallowed entirely.
		 * @returns {Promise<Object>} Resolves with {success, summary?, message?}
		 *   so the caller can fold the result into a combined summary.
		 */
		syncFromElementor: function (options) {
			var silent = !!(options && options.silent);

			if (!ATFRFO.state.currentFile) {
				return Promise.resolve( { success: false, message: 'No project open.' } );
			}

			return ATFRFO.App.ajax('atfrfo_sync_classes', { filename: ATFRFO.state.currentFile })
				.then(function (res) {
					if (!res.success) {
						var msg = (res.data && res.data.message) || 'Sync failed.';
						ATFRFO.Modal.info('Classes sync failed', '<p>' + ATFRFO.Utils.escHtml(msg) + '</p>');
						return { success: false, message: msg };
					}

					ATFRFO.state.classes = res.data.classes || [];
					var s = res.data.summary || {};

					if (!silent) {
						var parts = [];
						if (s.added)       { parts.push(s.added + ' added'); }
						if (s.updated)     { parts.push(s.updated + ' updated'); }
						if (s.atfrfo_only) { parts.push(s.atfrfo_only + ' no longer in Elementor'); }
						var summaryText = parts.length ? parts.join(', ') + '.' : 'No changes.';
						ATFRFO.Modal.info('Classes synced', '<p>' + ATFRFO.Utils.escHtml(summaryText) + '</p>');
					}

					if (ATFRFO.state.currentSelection && ATFRFO.state.currentSelection.group === 'Classes') {
						ATFRFO.Classes.loadClasses(ATFRFO.state.currentSelection);
					}
					if (ATFRFO.PanelLeft) {
						ATFRFO.PanelLeft.refresh();
					}

					return { success: true, summary: s };
				})
				.catch(function () {
					if (!silent) {
						ATFRFO.Modal.info('Classes sync failed', '<p>' + ATFRFO.Utils.escHtml('Could not reach the server.') + '</p>');
					}
					return { success: false, message: 'Network error.' };
				});
		},
	};
}());
