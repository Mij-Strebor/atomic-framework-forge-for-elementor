/**
 * ATFRFO Classes — Elementor V4 Global Classes (Phase 3.3: full category-block UI)
 *
 * Intercepts ATFRFO.EditSpace.loadCategory() for selection.group === 'Classes'
 * and renders the same category-block workspace used by Colors/Fonts/Numbers:
 * collapsible category blocks (with sub-categories), drag-reorder, add/rename/
 * duplicate/clear/delete category, search/filter, and an inline-editable
 * Comment field per class row.
 *
 * Reuses ATFRFO.CatMixin (atfrfo-app.js) for the category primitives that are
 * genuinely generic (add category, add sub-category, reorder). Category
 * operations that touch row-level data (delete, clear, rename, duplicate) are
 * implemented locally instead of via the mixin, because the mixin's versions
 * are hard-wired to ATFRFO.state.variables / atfrfo_save_color — Classes rows
 * live in ATFRFO.state.classes and are never user-created (they come from
 * Elementor via sync), so "duplicate category" must not fabricate new class
 * rows the way it fabricates new variables for Colors/Fonts/Numbers.
 *
 * No standalone "Sync Classes" control — per Jim's direction (2026-08-06),
 * Classes sync is not a separate action. It fires alongside Variables sync
 * from the single top-bar "Sync with Elementor" control (V4 + Import), via
 * ATFRFO.Classes.syncFromElementor(), called from atfrfo-panel-right.js.
 * There is no V3 Classes concept, so this never fires for a V3 sync.
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

		// -------------------------------------------------------------------
		// INIT / ENTRY POINT
		// -------------------------------------------------------------------

		init: function () {
			this._cfg          = { catKey: 'classCategories', setName: 'Classes' };
			this._collapsedIds = {};
			this._focusedCatId = null;
			this._catSortState = {};

			var _prevLoad = ATFRFO.EditSpace.loadCategory.bind(ATFRFO.EditSpace);
			ATFRFO.EditSpace.loadCategory = function (selection) {
				if (selection && selection.group === 'Classes') {
					ATFRFO.Classes.loadClasses(selection);
				} else {
					_prevLoad(selection);
				}
			};
		},

		/**
		 * Called by the overridden EditSpace.loadCategory when a Classes
		 * category is selected in the left panel.
		 *
		 * @param {{ group:string, subgroup:string, category:string, categoryId:string|null }} selection
		 */
		loadClasses: function (selection) {
			var self        = this;
			var placeholder = document.getElementById('atfrfo-placeholder');
			var content     = document.getElementById('atfrfo-edit-content');
			var workspace   = document.getElementById('atfrfo-workspace');
			if (!content) { return; }

			if (selection && selection.categoryId) {
				self._focusedCatId = selection.categoryId;
			} else if (selection && selection.category) {
				var _cats = self._getCatsForSet();
				self._focusedCatId = null;
				for (var _ci = 0; _ci < _cats.length; _ci++) {
					if (_cats[_ci].name === selection.category) {
						self._focusedCatId = _cats[_ci].id;
						break;
					}
				}
			} else {
				self._focusedCatId = null;
			}
			if (self._focusedCatId) { self._collapsedIds = {}; }

			self._ensureUncategorized();

			if (workspace)   { workspace.setAttribute('data-active', 'true'); }
			if (placeholder) { placeholder.setAttribute('hidden', ''); }
			content.removeAttribute('hidden');
			content.style.display = '';

			self._renderAll(selection, content);
		},

		// -------------------------------------------------------------------
		// RENDER — full view
		// -------------------------------------------------------------------

		_renderAll: function (selection, container) {
			var self         = this;
			var categories   = self._getCatsForSet();
			var topLevelCats = categories.filter(function (c) { return !c.parent_id; });

			var _anyExpanded = false;
			for (var _ti = 0; _ti < topLevelCats.length; _ti++) {
				var _tc = topLevelCats[_ti];
				var _subtreeCount = self._getSubtreeClassCount(_tc.id, categories);
				var _tcCollapsed;
				if (self._collapsedIds.hasOwnProperty(_tc.id)) {
					_tcCollapsed = self._collapsedIds[_tc.id];
				} else if (self._focusedCatId) {
					_tcCollapsed = (_tc.id !== self._focusedCatId);
				} else {
					_tcCollapsed = (_subtreeCount === 0);
				}
				if (!_tcCollapsed) { _anyExpanded = true; break; }
			}
			var _toggleState = _anyExpanded ? 'expanded' : 'collapsed';
			var _toggleSVG   = _anyExpanded ? ATFRFO.Icons.collapseAllSVG() : ATFRFO.Icons.expandAllSVG();
			var _toggleTitle = _anyExpanded ? 'Collapse all categories' : 'Expand all categories';

			var html = '<div class="atfrfo-classes-view">';

			html += '<div class="atfrfo-group-sticky-header">';
			html += '<div class="atfrfo-colors-filter-bar atfrfo-classes-filter-bar">'
				+ '<div class="atfrfo-filter-bar-top">'
				+ '<span class="atfrfo-filter-bar-set-name">Classes</span>'
				+ '<span style="flex:1"></span>'
				+ '<input type="text" class="atfrfo-colors-search atfrfo-classes-search"'
				+ ' id="atfrfo-classes-search"'
				+ ' placeholder="Search…"'
				+ ' aria-label="Search classes">'
				+ '<button class="atfrfo-icon-btn atfrfo-colors-back-btn"'
				+ ' id="atfrfo-classes-back"'
				+ ' data-atfrfo-tooltip="Back to sets"'
				+ ' aria-label="Back to sets">'
				+ ATFRFO.Icons.homeSVG()
				+ '</button>'
				+ '<button class="atfrfo-icon-btn"'
				+ ' id="atfrfo-classes-collapse-toggle"'
				+ ' title="' + _toggleTitle + '" aria-label="' + _toggleTitle + '"'
				+ ' data-toggle-state="' + _toggleState + '"'
				+ ' data-atfrfo-tooltip="' + _toggleTitle + '">'
				+ _toggleSVG
				+ '</button>'
				+ '</div>'
				+ '<div class="atfrfo-filter-bar-add-cat-wrap">'
				+ '<button class="atfrfo-icon-btn atfrfo-classes-add-cat-btn"'
				+ ' id="atfrfo-classes-add-category"'
				+ ' data-atfrfo-tooltip="Add category"'
				+ ' aria-label="Add category">'
				+ ATFRFO.Icons.plusSVG()
				+ '</button>'
				+ '</div>'
				+ '</div>';

			html += '<div class="atfrfo-status-legend">'
				+ '<span class="atfrfo-legend-item"><span class="atfrfo-legend-dot" style="background:var(--atfrfo-status-synced)"></span>Synced</span>'
				+ '<span class="atfrfo-legend-item"><span class="atfrfo-legend-dot" style="background:var(--atfrfo-status-modified)"></span>Modified</span>'
				+ '<span class="atfrfo-legend-item"><span class="atfrfo-legend-dot" style="background:var(--atfrfo-status-orphaned)"></span>AFF only</span>'
				+ '<span class="atfrfo-legend-item"><span class="atfrfo-legend-dot" style="background:var(--atfrfo-status-new)"></span>Orphaned</span>'
				+ '</div>';

			html += '</div>'; // .atfrfo-group-sticky-header

			if (topLevelCats.length === 0) {
				html += '<p class="atfrfo-colors-empty">No categories found. Click + to add one.</p>';
			} else {
				for (var i = 0; i < topLevelCats.length; i++) {
					html += self._buildCategoryBlock(topLevelCats[i], i, topLevelCats.length, 0, categories);
				}
			}

			html += '</div>'; // .atfrfo-classes-view

			container.innerHTML = html;
			self._bindEvents(container);
			self._annotateUnusedClasses(container);

			if (self._focusedCatId) {
				self._jumpToCategory(self._focusedCatId, container);
			}
		},

		/**
		 * Mark rows for classes that exist in Elementor but have zero usage
		 * site-wide with a small "Unused" badge next to the name. Runs after
		 * the initial render so rows appear immediately without waiting on
		 * the usage fetch; badges pop in once it resolves. Uses the same
		 * cached site-wide fetch as the detail card and delete-confirmation
		 * flow (_fetchUsageMap) — no extra AJAX cost beyond the one call.
		 *
		 * @param {HTMLElement} container
		 */
		_annotateUnusedClasses: function (container) {
			var wraps = container.querySelectorAll('.atfrfo-class-name-wrap[data-elementor-id]');
			var withId = [];
			for (var i = 0; i < wraps.length; i++) {
				if (wraps[i].getAttribute('data-elementor-id')) { withId.push(wraps[i]); }
			}
			if (withId.length === 0) { return; }

			ATFRFO.Classes._fetchUsageMap().then(function (map) {
				for (var i = 0; i < withId.length; i++) {
					var elId  = withId[i].getAttribute('data-elementor-id');
					var entry = map[elId];
					var badge = withId[i].querySelector('.atfrfo-class-unused-badge');
					if (badge) { badge.hidden = !!(entry && entry.total); }
				}
			}).catch(function () {
				// Usage annotation is non-critical — silently skip on failure,
				// rows already rendered without it.
			});
		},

		_rerenderView: function () {
			var content   = document.getElementById('atfrfo-edit-content');
			var editSpace = document.getElementById('atfrfo-edit-space');
			if (!content) { return; }
			var savedPanel  = editSpace ? editSpace.scrollTop : 0;
			var savedWindow = window.pageYOffset;
			if (this._focusedCatId) {
				var cats = this._getCatsForSet();
				for (var i = 0; i < cats.length; i++) {
					var cat = cats[i];
					if (!this._collapsedIds.hasOwnProperty(cat.id)) {
						this._collapsedIds[cat.id] = (cat.id !== this._focusedCatId);
					}
				}
				this._focusedCatId = null;
			}
			this._renderAll(ATFRFO.state.currentSelection || {}, content);
			if (editSpace) { editSpace.scrollTop = savedPanel; }
			if (window.pageYOffset !== savedWindow) { window.scrollTo(0, savedWindow); }
		},

		_closeView: function () {
			if (ATFRFO.PanelLeft && ATFRFO.PanelLeft.clearSelection) {
				ATFRFO.PanelLeft.clearSelection();
			}
			var content     = document.getElementById('atfrfo-edit-content');
			var placeholder = document.getElementById('atfrfo-placeholder');
			var workspace   = document.getElementById('atfrfo-workspace');
			if (content) {
				content.setAttribute('hidden', '');
				content.style.display = '';
				content.innerHTML = '';
			}
			if (placeholder) { placeholder.style.display = ''; }
			if (workspace)   { workspace.removeAttribute('data-active'); }
			ATFRFO.state.currentSelection = null;
			this._focusedCatId = null;
		},

		// -------------------------------------------------------------------
		// RENDER — one category block
		// -------------------------------------------------------------------

		_buildCategoryBlock: function (cat, catIndex, catTotal, depth, allCats) {
			var self         = this;
			depth            = depth   || 0;
			allCats          = allCats || self._getCatsForSet();
			var classes      = self._getClassesForCategory(cat);
			var directCount  = classes.length;
			var subtreeCount = (depth === 0) ? self._getSubtreeClassCount(cat.id, allCats) : directCount;

			var isCollapsed;
			if (self._collapsedIds.hasOwnProperty(cat.id)) {
				isCollapsed = self._collapsedIds[cat.id];
			} else if (self._focusedCatId) {
				isCollapsed = (cat.id !== self._focusedCatId);
			} else {
				isCollapsed = (subtreeCount === 0);
			}

			var html = '<div class="atfrfo-category-block"'
				+ ' data-category-id="' + ATFRFO.Utils.escAttr(cat.id) + '"'
				+ ' data-collapsed="' + (isCollapsed ? 'true' : 'false') + '"'
				+ (depth > 0 ? ' data-depth="' + depth + '"' : '')
				+ '>'
				+ '<div class="atfrfo-category-inner">';

			html += '<div class="atfrfo-category-header">'
				+ '<div class="atfrfo-cat-header-top">'
				+ '<div class="atfrfo-cat-header-left">';
			if (depth === 0) {
				html += '<span class="atfrfo-cat-drag-handle" data-action="cat-drag-handle" aria-hidden="true"'
					+ ' data-atfrfo-tooltip="Drag to reorder">'
					+ ATFRFO.Icons.sixDotSVG()
					+ '</span>';
			}
			html += '<span class="atfrfo-category-name-input"'
				+ ' data-cat-id="' + ATFRFO.Utils.escAttr(cat.id) + '"'
				+ ' data-original="' + ATFRFO.Utils.escAttr(cat.name) + '"'
				+ ' aria-label="Category name"'
				+ ' contenteditable="false"'
				+ (cat.locked ? ' data-locked="true"' : '') + '>'
				+ ATFRFO.Utils.escAttr(cat.name)
				+ '</span>'
				+ '<span class="atfrfo-category-count">' + subtreeCount + '</span>'
				+ '</div>'
				+ '<div class="atfrfo-category-actions" role="toolbar" aria-label="Category actions">'
				+ (!cat.locked && depth === 0 ? ATFRFO.Icons.catBtn('add-sub-cat', 'Add sub-category', ATFRFO.Icons.plusCircleSVG(), '') : '')
				+ ATFRFO.Icons.catBtn('clear-cat', 'Clear category contents', ATFRFO.Icons.broomSVG(), 'atfrfo-icon-btn--warning')
				+ ATFRFO.Icons.catBtn('duplicate', 'Duplicate category', ATFRFO.Icons.duplicateSVG(), '')
				+ (cat.locked ? '' : ATFRFO.Icons.catBtn('delete', 'Delete category', ATFRFO.Icons.trashSVG(), 'atfrfo-icon-btn--danger'))
				+ ATFRFO.Icons.catBtn('collapse', 'Collapse/expand category', ATFRFO.Icons.chevronSVG(), 'atfrfo-category-collapse-btn')
				+ '</div>'
				+ '</div>'
				+ '</div>'; // .atfrfo-category-header

			if (depth === 0) {
				var subs = self._getSubCategoriesOf(cat.id, allCats);
				for (var si = 0; si < subs.length; si++) {
					html += self._buildCategoryBlock(subs[si], si, subs.length, depth + 1, allCats);
				}
			}

			var _ns = (self._catSortState[cat.id] && self._catSortState[cat.id].field === 'name') ? self._catSortState[cat.id].dir : 'none';
			html += '<div class="atfrfo-color-list-header atfrfo-class-list-header" data-cat-id="' + ATFRFO.Utils.escAttr(cat.id) + '">'
				+ '<span></span>' // col1: drag handle
				+ '<span></span>' // col2: status dot
				+ '<span class="atfrfo-col-sort-wrap">'
				+ '<button class="atfrfo-col-sort-btn" data-sort-col="name" data-cat-id="' + ATFRFO.Utils.escAttr(cat.id) + '" data-sort-dir="' + _ns + '"'
				+ ' title="Sort by name" aria-label="Sort by name"'
				+ ' data-atfrfo-tooltip="Sort by name">'
				+ ATFRFO.Icons.sortBtnSVG(_ns)
				+ '</button>'
				+ '</span>' // col3: name sort
				+ '<span></span>' // col4: comment
				+ '<span></span>' // col5: style categories
				+ '<span></span>' // col6: styles button
				+ '<span></span>' // col7: delete
				+ '</div>';

			html += '<div class="atfrfo-color-list atfrfo-class-list">';
			var _hasSubs = depth === 0 && self._getSubCategoriesOf(cat.id, allCats).length > 0;
			if (directCount === 0 && !_hasSubs) {
				html += '<p class="atfrfo-colors-empty">No classes in this category.</p>';
			} else {
				for (var i = 0; i < classes.length; i++) {
					html += self._buildClassRow(classes[i]);
				}
			}
			html += '</div>'; // .atfrfo-class-list

			html += '</div>'; // .atfrfo-category-inner
			html += '</div>'; // .atfrfo-category-block
			return html;
		},

		/**
		 * Render one class as a category-block row.
		 *
		 * Columns: drag handle (reorder within category — local display order
		 * only, does not affect Elementor), status dot, name (editable — a
		 * real rename, pushed straight to Elementor via
		 * atfrfo_rename_class_in_elementor(); not just an AFF-local edit),
		 * has-styles flag, inline-editable Comment.
		 *
		 * @param {Object} cls Class object (see class_defaults() in PHP).
		 * @returns {string}
		 */
		_buildClassRow: function (cls) {
			var meta = ATFRFO.Classes._statusMeta(cls.status);

			// Styles button doubles as the "open detail card" trigger — see
			// item 4 of the 2026-08-06 UX pass. Disabled (not just styled
			// grey) when there are no properties, since there's nothing for
			// the card to show; the browser blocks the click natively so no
			// extra JS guard is needed.
			var stylesLabel = cls.has_styles ? 'View Styles' : 'No Styles';
			var stylesTip   = cls.has_styles
				? 'View this class’s style properties by breakpoint and state'
				: 'This class exists but has no style properties set yet.';

			return '<div class="atfrfo-color-row atfrfo-class-row" data-class-id="' + ATFRFO.Utils.escAttr(cls.id) + '">'
				+ '<div class="atfrfo-drag-handle" data-action="row-drag-handle" draggable="false"'
				+ ' aria-label="Drag to reorder" data-atfrfo-tooltip="Drag to reorder">'
				+ ATFRFO.Icons.sixDotSVG()
				+ '</div>'
				+ '<span class="atfrfo-status-dot"'
				+ ' style="background:' + meta.color + '"'
				+ ' data-atfrfo-tooltip="' + ATFRFO.Utils.escAttr(meta.label) + '"'
				+ ' aria-label="Status: ' + ATFRFO.Utils.escAttr(meta.label) + '">'
				+ '</span>'
				+ '<div class="atfrfo-class-name-wrap" data-elementor-id="' + ATFRFO.Utils.escAttr(cls.elementor_id || '') + '">'
				+ '<input type="text" class="atfrfo-class-name-input"'
				+ ' value="' + ATFRFO.Utils.escAttr(cls.label || '') + '"'
				+ ' data-original="' + ATFRFO.Utils.escAttr(cls.label || '') + '"'
				+ ' readonly'
				+ ' aria-label="Class name"'
				+ ' data-atfrfo-tooltip="Class name — click to edit (renames the class in Elementor)"'
				+ ' spellcheck="false">'
				+ '<span class="atfrfo-class-unused-badge" hidden'
				+ ' data-atfrfo-tooltip="Not used anywhere on the site">Unused</span>'
				+ '</div>'
				+ '<input type="text" class="atfrfo-class-notes-input"'
				+ ' value="' + ATFRFO.Utils.escAttr(cls.notes || '') + '"'
				+ ' data-original="' + ATFRFO.Utils.escAttr(cls.notes || '') + '"'
				+ ' readonly'
				+ ' placeholder="Comment"'
				+ ' aria-label="Class comment"'
				+ ' data-atfrfo-tooltip="Comment — click to edit"'
				+ ' spellcheck="false">'
				+ ATFRFO.Classes._buildCategoriesCell(cls)
				+ '<button type="button" class="atfrfo-class-styles-btn" data-action="expand-class"'
				+ ' data-class-id="' + ATFRFO.Utils.escAttr(cls.id) + '"'
				+ (cls.has_styles ? '' : ' disabled')
				+ ' aria-label="' + ATFRFO.Utils.escAttr(stylesLabel) + '"'
				+ ' data-atfrfo-tooltip="' + ATFRFO.Utils.escAttr(stylesTip) + '">'
				+ ATFRFO.Utils.escHtml(stylesLabel)
				+ '</button>'
				+ '<button type="button" class="atfrfo-icon-btn atfrfo-class-delete-btn" data-action="delete-class"'
				+ ' data-class-id="' + ATFRFO.Utils.escAttr(cls.id) + '"'
				+ ' aria-label="Delete class"'
				+ ' data-atfrfo-tooltip="Delete class"'
				+ ' data-atfrfo-tooltip-long="Delete this class from Elementor entirely — not just from AFF">&#x1F5D1;</button>'
				+ '</div>';
		},

		/**
		 * Build the "Style Categories" cell: which Elementor style-panel
		 * sections (Layout, Spacing, Size, Position, Typography, Background,
		 * Border, Effects, Custom CSS) this class actually sets properties
		 * in. Computed server-side (class-atfrfo-classes-reader.php
		 * get_style_categories(), sourced directly from Elementor's own
		 * compiled editor bundle — see that method's docblock) and persisted
		 * on `cls.style_categories` during sync. Text truncates naturally via
		 * CSS ellipsis when there isn't room for the full list; the tooltip
		 * always shows the complete list.
		 *
		 * @param {Object} cls
		 * @returns {string}
		 */
		_buildCategoriesCell: function (cls) {
			var cats = Array.isArray(cls.style_categories) ? cls.style_categories : [];
			var text = cats.join(', ');
			return '<span class="atfrfo-class-categories"'
				+ (text ? ' data-atfrfo-tooltip="' + ATFRFO.Utils.escAttr(text) + '"' : '')
				+ '>' + (text ? ATFRFO.Utils.escHtml(text) : '') + '</span>';
		},

		/**
		 * Resolve a Classes status value to a CSS color and user-facing label.
		 * See file header — Classes' vocabulary is not Variables' vocabulary.
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

		/**
		 * Format an ISO 8601 UTC timestamp (PHP gmdate('c'), e.g.
		 * "2026-08-06T22:15:21+00:00") as HH:MM:SS in the browser's local
		 * timezone — the full ISO string with a UTC offset was noise for a
		 * value that's only ever "how long ago was this."
		 *
		 * @param {string} iso
		 * @returns {string}
		 */
		_formatLocalTime: function (iso) {
			var d = new Date(iso);
			if (isNaN(d.getTime())) { return iso; }
			return d.toLocaleTimeString(undefined, { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
		},

		// -------------------------------------------------------------------
		// CLASS DETAIL CARD (read-only)
		// -------------------------------------------------------------------

		/**
		 * Open a read-only modal card showing a class's full detail: name,
		 * category, comment, status, and its Elementor style properties
		 * grouped by breakpoint/state. Properties come from the `variants`
		 * field persisted during sync (class-atfrfo-data-store.php
		 * import_fetched_classes()) — always Elementor's current data as of
		 * the last sync, never edited from here.
		 *
		 * @param {string} classId
		 */
		_openClassCard: function (classId) {
			var cls = ATFRFO.Utils.findClassById(classId);
			if (!cls) { return; }

			var meta = ATFRFO.Classes._statusMeta(cls.status);
			var variants = Array.isArray(cls.variants) ? cls.variants : [];

			var body = '<div class="atfrfo-class-card">'
				+ '<div class="atfrfo-class-card-meta">'
				+ '<div><span class="atfrfo-class-card-label">Name</span><span class="atfrfo-class-card-value">' + ATFRFO.Utils.escHtml(cls.label || '') + '</span></div>'
				+ '<div><span class="atfrfo-class-card-label">Category</span><span class="atfrfo-class-card-value">' + ATFRFO.Utils.escHtml(cls.category || 'Uncategorized') + '</span></div>'
				+ '<div><span class="atfrfo-class-card-label">Status</span><span class="atfrfo-class-card-value">'
				+ '<span class="atfrfo-status-dot" style="background:' + meta.color + ';display:inline-block;margin-right:6px;vertical-align:middle"></span>'
				+ ATFRFO.Utils.escHtml(meta.label) + '</span></div>'
				+ (cls.last_synced_at ? '<div><span class="atfrfo-class-card-label">Last synced</span><span class="atfrfo-class-card-value">' + ATFRFO.Utils.escHtml(ATFRFO.Classes._formatLocalTime(cls.last_synced_at)) + '</span></div>' : '')
				+ '</div>'; // .atfrfo-class-card-meta

			body += '<div class="atfrfo-class-card-comment-wrap">'
				+ '<span class="atfrfo-class-card-label">Comment</span>'
				+ '<textarea class="atfrfo-class-card-comment" rows="4" readonly tabindex="-1">'
				+ ATFRFO.Utils.escHtml(cls.notes || '')
				+ '</textarea>'
				+ '</div>';

			// "Style Properties" — the section header this card never had.
			// Each group inside is one breakpoint/state combination (e.g.
			// "Desktop", "Tablet — hover") — that's Elementor's own style-
			// panel structure, not this card's own invention.
			body += '<span class="atfrfo-class-card-label">Style Properties</span>';
			body += '<div class="atfrfo-class-card-props">';
			if (variants.length === 0) {
				body += '<p class="atfrfo-colors-empty" style="padding:var(--sp-4) 0">No style properties set on this class yet.</p>';
			} else {
				for (var i = 0; i < variants.length; i++) {
					body += ATFRFO.Classes._renderVariantGroup(variants[i]);
				}
			}
			body += '</div>';

			// Usage — fetched lazily below (see _loadUsageIntoCard); this scans
			// every Elementor document on the site (~400ms+), so it only runs
			// when a card is actually opened, not on every sync.
			body += '<div class="atfrfo-class-card-usage" id="atfrfo-class-usage-section">'
				+ '<span class="atfrfo-class-card-label">Usage</span>'
				+ '<p class="atfrfo-class-variant-empty">Loading…</p>'
				+ '</div>';

			body += '<p style="font-size:12px;color:var(--atfrfo-clr-muted);margin-top:var(--sp-3)">'
				+ 'Read-only — reflects Elementor as of the last sync. Edit these properties in Elementor.</p>';

			body += '</div>'; // .atfrfo-class-card

			ATFRFO.Modal.open({
				title:  ATFRFO.Utils.escHtml(cls.label || 'Class'),
				body:   body,
				footer: '<button class="atfrfo-btn" id="atfrfo-class-card-close">Close</button>',
			});
			setTimeout(function () {
				var closeBtn = document.getElementById('atfrfo-class-card-close');
				if (closeBtn) { closeBtn.addEventListener('click', function () { ATFRFO.Modal.close(); }); }
			}, 0);

			ATFRFO.Classes._loadUsageIntoCard(cls.elementor_id);
		},

		/**
		 * Fetch (once per session, then cached) where every class is used
		 * site-wide, and fill in the "Usage" section of an already-open card.
		 * Safe to call even if the card has since been closed — just checks
		 * the section still exists in the DOM before touching it.
		 *
		 * @param {string} elementorId The class's Elementor ID (cls.elementor_id).
		 */
		_loadUsageIntoCard: function (elementorId) {
			ATFRFO.Classes._fetchUsageMap().then(function (map) {
				var section = document.getElementById('atfrfo-class-usage-section');
				if (!section) { return; } // card closed before the fetch resolved
				section.innerHTML = ATFRFO.Classes._renderUsageSection(map[elementorId] || null);
			}).catch(function () {
				var section = document.getElementById('atfrfo-class-usage-section');
				if (section) {
					section.innerHTML = '<span class="atfrfo-class-card-label">Usage</span>'
						+ '<p class="atfrfo-class-variant-empty">Could not load usage data.</p>';
				}
			});
		},

		/**
		 * Fetch the site-wide class usage map once per session and cache it
		 * in ATFRFO.state.classUsageMap. Shared by the detail card and the
		 * delete-confirmation flow, both of which need an accurate count
		 * before showing anything to the user.
		 *
		 * @returns {Promise<Object>}
		 */
		_fetchUsageMap: function () {
			if (ATFRFO.state.classUsageMap) { return Promise.resolve(ATFRFO.state.classUsageMap); }
			return ATFRFO.App.ajax('atfrfo_get_class_usage', {}).then(function (res) {
				ATFRFO.state.classUsageMap = (res.success && res.data) ? (res.data.usage || {}) : {};
				return ATFRFO.state.classUsageMap;
			});
		},

		/**
		 * Render the "Usage" section body: total count and a per-page
		 * breakdown, matching what Elementor's own class manager shows.
		 * Sourced from Elementor's own usage-tracking module — see
		 * ATFRFO_Classes_Reader::get_usage_map() docblock.
		 *
		 * @param {{total:number, pages:Array}|null} entry
		 * @returns {string}
		 */
		_renderUsageSection: function (entry) {
			if (!entry || !entry.total) {
				return '<span class="atfrfo-class-card-label">Usage</span>'
					+ '<p class="atfrfo-class-variant-empty">Not used anywhere on the site.</p>';
			}

			var html = '<span class="atfrfo-class-card-label">Usage — '
				+ entry.total + ' element' + (entry.total === 1 ? '' : 's')
				+ ' across ' + entry.pages.length + ' page' + (entry.pages.length === 1 ? '' : 's')
				+ '</span>'
				+ '<div class="atfrfo-class-usage-pages">';

			entry.pages.forEach(function (p) {
				html += '<div class="atfrfo-class-usage-page">'
					+ '<span class="atfrfo-class-usage-page-title">' + ATFRFO.Utils.escHtml(p.title || '(untitled)') + '</span>'
					+ '<span class="atfrfo-class-usage-page-count">' + (p.total || 0) + '</span>'
					+ '</div>';
				if (Array.isArray(p.elements) && p.elements.length > 0) {
					// Elements arrive as one label per instance (e.g. three
					// "flexbox" entries for three flexboxes on this page) —
					// count occurrences per label rather than listing each
					// one, since individual elements aren't otherwise
					// distinguishable from each other in this data.
					var counts = {};
					var order  = [];
					for (var ei = 0; ei < p.elements.length; ei++) {
						var label = p.elements[ei];
						if (!counts.hasOwnProperty(label)) {
							counts[label] = 0;
							order.push(label);
						}
						counts[label]++;
					}
					var parts = [];
					for (var oi = 0; oi < order.length; oi++) {
						parts.push(order[oi] + ' ' + counts[order[oi]]);
					}
					html += '<div class="atfrfo-class-usage-elements">'
						+ ATFRFO.Utils.escHtml(parts.join(', '))
						+ '</div>';
				}
			});

			html += '</div>';
			return html;
		},

		/**
		 * Delete a class from Elementor itself (not just AFF) after
		 * confirmation. Fetches current usage first so the confirmation
		 * shows an accurate count — deleting a used class is allowed
		 * (Elementor auto-strips it from every element that had it applied;
		 * confirmed via source, see ajax_atfrfo_delete_class_from_elementor()
		 * docblock in class-atfrfo-ajax-handler.php) but the user should see
		 * the real number before doing it, not guess.
		 *
		 * @param {string} classId AFF UUID (cls.id, not cls.elementor_id).
		 */
		_deleteClassFromElementor: function (classId) {
			var self = this;
			var cls = ATFRFO.Utils.findClassById(classId);
			if (!cls) { return; }
			if (!ATFRFO.state.currentFile) { self._noFileModal(); return; }

			ATFRFO.Classes._fetchUsageMap().then(function (map) {
				var entry = map[cls.elementor_id] || null;
				var label = ATFRFO.Utils.escHtml(cls.label || 'this class');

				var bodyText = '<p>Delete <strong>' + label + '</strong> from Elementor?</p>';
				if (entry && entry.total) {
					bodyText += '<p style="margin-top:var(--sp-2);color:var(--atfrfo-status-modified,#b26a00)">'
						+ 'Currently used on <strong>' + entry.total + ' element' + (entry.total === 1 ? '' : 's') + '</strong> across '
						+ entry.pages.length + ' page' + (entry.pages.length === 1 ? '' : 's') + '. '
						+ 'Elementor will automatically remove this class from every one of them — they will lose whatever '
						+ 'this class was styling, but nothing will break or go undefined.</p>';
				} else {
					bodyText += '<p style="margin-top:var(--sp-2);color:var(--atfrfo-clr-muted)">Not currently used anywhere on the site.</p>';
				}
				bodyText += '<p style="margin-top:var(--sp-2);font-size:12px;color:var(--atfrfo-clr-muted)">'
					+ 'This deletes the class from Elementor permanently, not just from AFF. It cannot be undone from here.</p>';

				ATFRFO.Modal.open({
					title:   'Delete Class',
					body:    bodyText,
					footer:  '<div style="display:flex;justify-content:flex-end;gap:8px">'
						+ '<button class="atfrfo-btn atfrfo-btn--secondary" id="atfrfo-modal-delclass-cancel">Cancel</button>'
						+ '<button class="atfrfo-btn atfrfo-btn--danger" id="atfrfo-modal-delclass-ok">Delete</button>'
						+ '</div>',
					onClose: function () { document.removeEventListener('click', handleClick); },
				});
				setTimeout(function () {
					var btn = document.getElementById('atfrfo-modal-delclass-cancel');
					if (btn) { btn.focus(); }
				}, 50);

				function doDelete() {
					ATFRFO.Modal.close();
					document.removeEventListener('click', handleClick);
					ATFRFO.App.ajax('atfrfo_delete_class_from_elementor', {
						filename:     ATFRFO.state.currentFile,
						elementor_id: cls.elementor_id,
					}).then(function (res) {
						if (res.success && res.data) {
							ATFRFO.state.classes = res.data.classes || ATFRFO.state.classes;
							delete ATFRFO.state.classUsageMap; // stale now — target no longer exists
							if (ATFRFO.App) { ATFRFO.App.setDirty(true); }
							self._rerenderView();
							if (ATFRFO.PanelLeft && ATFRFO.PanelLeft.refresh) { ATFRFO.PanelLeft.refresh(); }
						} else {
							var errMsg = (res.data && res.data.message) ? res.data.message : 'Delete failed.';
							ATFRFO.Modal.open({ title: 'Delete failed', body: '<p>' + ATFRFO.Utils.escHtml(errMsg) + '</p>' });
						}
					}).catch(function () {
						ATFRFO.Modal.open({ title: 'Connection error', body: '<p>Connection error during delete.</p>' });
					});
				}

				function handleClick(e) {
					if (e.target.id === 'atfrfo-modal-delclass-cancel') {
						ATFRFO.Modal.close();
						document.removeEventListener('click', handleClick);
					} else if (e.target.id === 'atfrfo-modal-delclass-ok') {
						doDelete();
					}
				}
				document.addEventListener('click', handleClick);
			});
		},

		/**
		 * Render one variant (a breakpoint/state combination and its props)
		 * as a labeled group with a simple prop:value list.
		 *
		 * @param {Object} variant {props, meta:{breakpoint,state}, custom_css}
		 * @returns {string}
		 */
		_renderVariantGroup: function (variant) {
			var meta       = (variant && variant.meta) || {};
			var breakpoint = meta.breakpoint || 'desktop';
			var state      = meta.state || null;
			var groupLabel = breakpoint.charAt(0).toUpperCase() + breakpoint.slice(1)
				+ (state ? ' — ' + state : '');

			var props = (variant && variant.props) || {};
			var propKeys = Object.keys(props);

			var html = '<div class="atfrfo-class-variant-group">'
				+ '<p class="atfrfo-class-variant-label">' + ATFRFO.Utils.escHtml(groupLabel) + '</p>';

			if (propKeys.length === 0) {
				html += '<p class="atfrfo-class-variant-empty">No properties.</p>';
			} else {
				html += '<div class="atfrfo-class-variant-props">';
				for (var i = 0; i < propKeys.length; i++) {
					var key = propKeys[i];
					html += '<span class="atfrfo-class-prop-key">' + ATFRFO.Utils.escHtml(key) + '</span>'
						+ ATFRFO.Classes._renderPropValue(props[key]);
				}
				html += '</div>';
			}

			if (variant && variant.custom_css && variant.custom_css.raw) {
				html += '<p class="atfrfo-class-variant-label" style="margin-top:var(--sp-2)">'
					+ 'Custom CSS <span class="atfrfo-class-prop-badge atfrfo-class-prop-badge--hardcoded" data-atfrfo-tooltip="Raw CSS, not tokenized to a variable">Hardcoded</span>'
					+ '</p>'
					+ '<pre class="atfrfo-class-variant-css">' + ATFRFO.Utils.escHtml(variant.custom_css.raw) + '</pre>';
			}

			html += '</div>';
			return html;
		},

		/**
		 * Format one property's value for display. Handles the two shapes
		 * seen in Elementor's $$type-tagged props (see
		 * docs/AFF-VISION-AND-ROADMAP.md §3.1 "Variant structure"):
		 * {$$type:'size', value:{size,unit}} and {$$type:'color'|..., value:'...'}.
		 * Falls back to JSON for anything unrecognized rather than hiding it.
		 *
		 * @param {*} prop
		 * @returns {string}
		 */
		_formatPropValue: function (prop) {
			if (prop === null || typeof prop === 'undefined') { return ''; }
			if (typeof prop !== 'object') { return String(prop); }
			var val = prop.value;
			if (val && typeof val === 'object' && 'size' in val && 'unit' in val) {
				return val.size + val.unit;
			}
			if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') {
				return String(val);
			}
			try { return JSON.stringify(val !== undefined ? val : prop); } catch (e) { return ''; }
		},

		/**
		 * Render one property's value cell, distinguishing a variable
		 * reference (decoded server-side — see resolve_variable_refs() in
		 * class-atfrfo-classes-reader.php — into `prop._resolved`) from a
		 * literal/hardcoded value. This is the "meaningful display" for
		 * hardcoded values: a visible badge, so the card doubles as a
		 * quick check for design-system violations (AFF's own CSS
		 * architecture rule is no literal hex/px — see
		 * feedback_elementor_css_architecture in project memory).
		 *
		 * @param {Object} prop
		 * @returns {string}
		 */
		_renderPropValue: function (prop) {
			var isVarRef = !!(prop && typeof prop === 'object' && typeof prop.$$type === 'string' && prop.$$type.indexOf('global-') === 0);

			if (isVarRef) {
				if (prop._resolved) {
					var varName = ATFRFO.Utils.escHtml(prop._resolved.name || prop.value);
					var varVal  = ATFRFO.Utils.escHtml(ATFRFO.Classes._formatPropValue(prop._resolved.value));
					return '<span class="atfrfo-class-prop-value">'
						+ '<span class="atfrfo-class-prop-badge atfrfo-class-prop-badge--variable" data-atfrfo-tooltip="Linked to an Elementor global variable">Variable</span>'
						+ '<span class="atfrfo-class-prop-varname">' + varName + '</span>'
						+ '<span class="atfrfo-class-prop-varval">' + varVal + '</span>'
						+ '</span>';
				}
				// Reference exists but couldn't be resolved (e.g. the variable
				// was deleted in Elementor since this class was styled).
				return '<span class="atfrfo-class-prop-value">'
					+ '<span class="atfrfo-class-prop-badge atfrfo-class-prop-badge--variable" data-atfrfo-tooltip="Linked to an Elementor global variable">Variable</span>'
					+ '<span class="atfrfo-class-prop-varname" data-atfrfo-tooltip="Not found — this variable may have been deleted in Elementor">'
					+ ATFRFO.Utils.escHtml(prop.value) + ' (unresolved)</span>'
					+ '</span>';
			}

			return '<span class="atfrfo-class-prop-value">'
				+ '<span class="atfrfo-class-prop-badge atfrfo-class-prop-badge--hardcoded" data-atfrfo-tooltip="Literal value, not tokenized to a variable">Hardcoded</span>'
				+ '<span class="atfrfo-class-prop-varval">' + ATFRFO.Utils.escHtml(ATFRFO.Classes._formatPropValue(prop)) + '</span>'
				+ '</span>';
		},

		// -------------------------------------------------------------------
		// DATA HELPERS
		// -------------------------------------------------------------------

		_getCatsForSet: function () {
			var catKey = this._cfg.catKey;
			var arr = (ATFRFO.state.config && ATFRFO.state.config[catKey])
				? ATFRFO.state.config[catKey]
				: this._getDefaultCategories();
			return arr.slice().sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
		},

		/**
		 * Starter categories shown for a brand-new project — mirrors
		 * ATFRFO.Colors._getDefaultCategories() (same fallback contract: only
		 * used when config[catKey] is entirely absent, not merely empty/
		 * Uncategorized-only — a project that's had its categories edited
		 * down to nothing keeps that choice, it doesn't get defaults back).
		 * Matches the suggested names shown in the Manage Projects "Classes
		 * Categories" panel (atfrfo-panel-top.js).
		 *
		 * @returns {Array}
		 */
		_getDefaultCategories: function () {
			return [
				{ id: 'default-class-layout',        name: 'Layout',        order: 0, locked: false, parent_id: null },
				{ id: 'default-class-typography',     name: 'Typography',    order: 1, locked: false, parent_id: null },
				{ id: 'default-class-buttons',        name: 'Buttons',       order: 2, locked: false, parent_id: null },
				{ id: 'default-class-cards',          name: 'Cards',         order: 3, locked: false, parent_id: null },
				{ id: 'default-class-utility',        name: 'Utility',       order: 4, locked: false, parent_id: null },
				{ id: 'default-class-uncategorized',  name: 'Uncategorized', order: 5, locked: true,  parent_id: null },
			];
		},

		_getSubCategoriesOf: function (catId, allCats) {
			var result = [];
			for (var i = 0; i < allCats.length; i++) {
				if (allCats[i].parent_id === catId) { result.push(allCats[i]); }
			}
			return result.sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
		},

		_getSubtreeClassCount: function (catId, allCats) {
			var cat = null;
			for (var i = 0; i < allCats.length; i++) {
				if (allCats[i].id === catId) { cat = allCats[i]; break; }
			}
			if (!cat) { return 0; }
			var total = this._getClassesForCategory(cat).length;
			var subs  = this._getSubCategoriesOf(catId, allCats);
			for (var j = 0; j < subs.length; j++) {
				total += this._getSubtreeClassCount(subs[j].id, allCats);
			}
			return total;
		},

		/**
		 * Return classes in a category, sorted by order. Matches by
		 * category_id first, then falls back to category name string.
		 * Uncategorized is a catch-all: explicit assignment, empty
		 * reference, or a reference to a category that no longer exists.
		 * Mirrors ATFRFO.Variables._proto._getVarsForCategory exactly.
		 *
		 * @param {Object} cat Category object.
		 * @returns {Array}
		 */
		_getClassesForCategory: function (cat) {
			var self  = this;
			var items = ATFRFO.state.classes || [];

			if (cat.name === 'Uncategorized') {
				var knownIds   = {};
				var knownNames = {};
				var liveCats = self._getCatsForSet();
				for (var i = 0; i < liveCats.length; i++) {
					if (liveCats[i].name !== 'Uncategorized') {
						if (liveCats[i].id)   { knownIds[liveCats[i].id]     = true; }
						if (liveCats[i].name) { knownNames[liveCats[i].name] = true; }
					}
				}
				var matched = items.filter(function (c) {
					if (cat.id && c.category_id && c.category_id === cat.id) { return true; }
					if (c.category === 'Uncategorized') { return true; }
					if (!c.category_id && !c.category) { return true; }
					if (c.category_id && !knownIds[c.category_id]) { return true; }
					if (c.category    && !knownNames[c.category])  { return true; }
					return false;
				});
				return matched.sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
			}

			var direct = items.filter(function (c) {
				if (cat.id && c.category_id && c.category_id === cat.id) { return true; }
				if (c.category === cat.name) { return true; }
				return false;
			});
			return direct.sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
		},

		/** Ensure Uncategorized always exists in classCategories. */
		_ensureUncategorized: function () {
			if (!ATFRFO.state.config) { ATFRFO.state.config = {}; }
			var catKey = this._cfg.catKey;
			var cats   = ATFRFO.state.config[catKey];
			if (!Array.isArray(cats)) { cats = []; ATFRFO.state.config[catKey] = cats; }
			var hasUncat = false;
			for (var i = 0; i < cats.length; i++) {
				if (cats[i].name === 'Uncategorized') { hasUncat = true; break; }
			}
			if (!hasUncat) {
				cats.push({ id: 'uncategorized', name: 'Uncategorized', order: 999999, locked: true, parent_id: null });
			}
		},

		// -------------------------------------------------------------------
		// CATEGORY OPERATIONS — classes-aware (do not reuse CatMixin here)
		// -------------------------------------------------------------------

		/**
		 * Save the category name from the always-on contenteditable span,
		 * and sync the cached category name onto every class in it — the
		 * Classes analog of ATFRFO.Variables._proto._saveCategoryName.
		 *
		 * @param {HTMLElement} input The .atfrfo-category-name-input element.
		 */
		_saveCategoryName: function (input) {
			var self    = this;
			var newName = input.textContent.trim();
			var oldName = input.getAttribute('data-original') || '';
			var catId   = input.getAttribute('data-cat-id')   || '';

			if (!newName || newName === oldName) {
				input.textContent = oldName;
				return;
			}
			if (!ATFRFO.state.currentFile) {
				input.textContent = oldName;
				self._noFileModal();
				return;
			}

			ATFRFO.App.ajax('atfrfo_save_category', {
				filename: ATFRFO.state.currentFile,
				subgroup: self._cfg.setName,
				category: JSON.stringify({ id: catId, name: newName }),
			}).then(function (res) {
				if (res.success && res.data) {
					if (!ATFRFO.state.config) { ATFRFO.state.config = {}; }
					var _localCats = ATFRFO.state.config[self._cfg.catKey];
					if (Array.isArray(_localCats)) {
						for (var _ri = 0; _ri < _localCats.length; _ri++) {
							if (_localCats[_ri].id === catId) { _localCats[_ri].name = newName; break; }
						}
					} else {
						ATFRFO.state.config[self._cfg.catKey] = res.data.categories || [];
					}
					var _allClasses = ATFRFO.state.classes || [];
					for (var _vi = 0; _vi < _allClasses.length; _vi++) {
						if (_allClasses[_vi].category_id === catId || _allClasses[_vi].category === oldName) {
							_allClasses[_vi].category = newName;
						}
					}
					input.setAttribute('data-original', newName);
					if (ATFRFO.App) { ATFRFO.App.setDirty(true); }
					self._rerenderView();
					if (ATFRFO.PanelLeft && ATFRFO.PanelLeft.refresh) { ATFRFO.PanelLeft.refresh(); }
				} else {
					input.textContent = oldName;
				}
			}).catch(function () { input.textContent = oldName; });
		},

		/**
		 * Delete a category with confirmation modal. Classes in the deleted
		 * category (and its descendants) are either deleted or moved to
		 * Uncategorized server-side (class-atfrfo-data-store.php
		 * reassign_or_delete_classes()) depending on the toggle, exactly
		 * like Colors/Fonts/Numbers variables.
		 *
		 * @param {string} catId Category ID.
		 */
		_deleteCategory: function (catId) {
			var self = this;
			if (!ATFRFO.state.currentFile) { self._noFileModal(); return; }

			var cats = self._getCatsForSet();
			var catObj   = cats.find(function (c) { return c.id === catId; });
			var catLabel = catObj ? '‘' + catObj.name + '’' : 'this category';
			var classes  = ATFRFO.Utils.getClassesForCategory(catId, catObj ? catObj.name : '');

			var descCats = [];
			var _bfsQ    = [catId];
			while (_bfsQ.length) {
				var _bfsCur = _bfsQ.shift();
				for (var _bfsi = 0; _bfsi < cats.length; _bfsi++) {
					if ((cats[_bfsi].parent_id || null) === _bfsCur) {
						descCats.push(cats[_bfsi]);
						_bfsQ.push(cats[_bfsi].id);
					}
				}
			}
			var descClassCount = 0;
			for (var _dci = 0; _dci < descCats.length; _dci++) {
				var _dc = descCats[_dci];
				descClassCount += ATFRFO.Utils.getClassesForCategory(_dc.id, _dc.name).length;
			}

			var deleteClasses = true; // toggle represents "Save to Uncategorized" — off by default.

			var bodyText = '<p>Delete category ' + catLabel + '?</p>';
			if (descCats.length > 0) {
				bodyText += '<p style="margin-top:var(--sp-2)">Deleting this category will also delete '
					+ descCats.length + ' nested sub-categor'
					+ (descCats.length === 1 ? 'y' : 'ies')
					+ (descClassCount > 0 ? ' and their ' + descClassCount + ' class(es)' : '')
					+ '.</p>';
			}
			if (classes.length > 0) {
				var totalClasses = classes.length + descClassCount;
				bodyText += '<p style="margin-top:var(--sp-2)">This category has '
					+ (descCats.length > 0 ? totalClasses + ' class(es) in total (direct and nested).' : classes.length + ' class(es).')
					+ ' You may save them to Uncategorized if you wish.</p>'
					+ '<div class="atfrfo-del-cat-vars">'
					+ '<span class="atfrfo-del-cat-action-label">Save classes to Uncategorized:</span>'
					+ '<label class="atfrfo-ios-toggle" for="atfrfo-del-cat-check">'
					+ '<input type="checkbox" id="atfrfo-del-cat-check">'
					+ '<span class="atfrfo-ios-track"><span class="atfrfo-ios-thumb"></span></span>'
					+ '</label>'
					+ '</div>';
			}

			ATFRFO.Modal.open({
				title:   'Delete Category',
				body:    bodyText,
				footer:  '<div style="display:flex;justify-content:flex-end;gap:8px">'
					+ '<button class="atfrfo-btn atfrfo-btn--secondary" id="atfrfo-modal-del-cancel">Cancel</button>'
					+ '<button class="atfrfo-btn atfrfo-btn--danger" id="atfrfo-modal-del-ok">Delete</button>'
					+ '</div>',
				onClose: function () { document.removeEventListener('click', handleClick); },
			});

			if (classes.length > 0) {
				setTimeout(function () {
					var chk = document.getElementById('atfrfo-del-cat-check');
					if (chk) {
						chk.addEventListener('change', function () { deleteClasses = !chk.checked; });
					}
				}, 0);
			}
			setTimeout(function () {
				var btn = document.getElementById('atfrfo-modal-del-ok');
				if (btn) { btn.focus(); }
			}, 50);

			function doDeleteCategory(dv) {
				ATFRFO.Modal.close();
				document.removeEventListener('click', handleClick);
				var _preDelCats = self._getCatsForSet();
				ATFRFO.App.ajax('atfrfo_delete_category', {
					filename:    ATFRFO.state.currentFile,
					subgroup:    self._cfg.setName,
					category_id: catId,
					delete_vars: dv ? '1' : '0',
				}).then(function (res) {
					if (res.success && res.data) {
						if (!ATFRFO.state.config) { ATFRFO.state.config = {}; }
						var _descIds = descCats.map(function (c) { return c.id; });
						ATFRFO.state.config[self._cfg.catKey] = _preDelCats.filter(function (c) {
							return c.id !== catId && _descIds.indexOf(c.id) === -1;
						});
						if (res.data.classes) {
							ATFRFO.state.classes = res.data.classes;
						}
						delete self._collapsedIds[catId];
						for (var _ddi = 0; _ddi < descCats.length; _ddi++) {
							delete self._collapsedIds[descCats[_ddi].id];
						}
						if (ATFRFO.App) { ATFRFO.App.setDirty(true); }
						self._rerenderView();
						if (ATFRFO.PanelLeft && ATFRFO.PanelLeft.refresh) { ATFRFO.PanelLeft.refresh(); }
					} else if (!res.success) {
						var errMsg = (res.data && res.data.message) ? res.data.message : 'Delete failed.';
						ATFRFO.Modal.open({ title: 'Delete failed', body: '<p>' + errMsg + '</p>' });
					}
				}).catch(function () {
					ATFRFO.Modal.open({ title: 'Connection error', body: '<p>Connection error during delete.</p>' });
				});
			}

			function handleClick(e) {
				if (e.target.id === 'atfrfo-modal-del-cancel') {
					ATFRFO.Modal.close();
					document.removeEventListener('click', handleClick);
				} else if (e.target.id === 'atfrfo-modal-del-ok') {
					doDeleteCategory(deleteClasses);
				}
			}
			document.addEventListener('click', handleClick);
		},

		/**
		 * Clear a category: delete all classes in it (and descendant
		 * sub-categories), but keep the category shell itself.
		 *
		 * @param {string} catId Category ID.
		 */
		_clearCategory: function (catId) {
			var self = this;
			if (!ATFRFO.state.currentFile) { self._noFileModal(); return; }

			var cats   = self._getCatsForSet();
			var catObj = cats.find(function (c) { return c.id === catId; });
			var catLabel = catObj ? '‘' + catObj.name + '’' : 'this category';

			var descCats = [];
			var _bfsQ    = [catId];
			while (_bfsQ.length) {
				var _bfsCur = _bfsQ.shift();
				for (var _bfsi = 0; _bfsi < cats.length; _bfsi++) {
					if ((cats[_bfsi].parent_id || null) === _bfsCur) {
						descCats.push(cats[_bfsi]);
						_bfsQ.push(cats[_bfsi].id);
					}
				}
			}

			var directClasses = ATFRFO.Utils.getClassesForCategory(catId, catObj ? catObj.name : '');
			var descClassCount = 0;
			for (var _dci = 0; _dci < descCats.length; _dci++) {
				var _dc = descCats[_dci];
				descClassCount += ATFRFO.Utils.getClassesForCategory(_dc.id, _dc.name).length;
			}
			var totalClasses = directClasses.length + descClassCount;

			var bodyText = '<p>Clear category ' + catLabel + '?</p>'
				+ '<p style="margin-top:var(--sp-2)">All classes'
				+ (descCats.length > 0 ? ' and ' + descCats.length + ' nested sub-categor' + (descCats.length === 1 ? 'y' : 'ies') : '')
				+ ' inside this category will be permanently deleted'
				+ (totalClasses > 0 ? ' (' + totalClasses + ' class' + (totalClasses === 1 ? '' : 'es') + ')' : '')
				+ '. The category itself will remain.</p>';

			ATFRFO.Modal.open({
				title:   'Clear Category',
				body:    bodyText,
				footer:  '<div style="display:flex;justify-content:flex-end;gap:8px">'
					+ '<button class="atfrfo-btn atfrfo-btn--secondary" id="atfrfo-modal-clr-cancel">Cancel</button>'
					+ '<button class="atfrfo-btn atfrfo-btn--danger" id="atfrfo-modal-clr-ok">Clear</button>'
					+ '</div>',
				onClose: function () { document.removeEventListener('click', handleClrClick); },
			});

			setTimeout(function () {
				var btn = document.getElementById('atfrfo-modal-clr-ok');
				if (btn) { btn.focus(); }
			}, 50);

			function doClearCategory() {
				ATFRFO.Modal.close();
				document.removeEventListener('click', handleClrClick);
				var _preCats = self._getCatsForSet();
				ATFRFO.App.ajax('atfrfo_clear_category', {
					filename:    ATFRFO.state.currentFile,
					subgroup:    self._cfg.setName,
					category_id: catId,
				}).then(function (res) {
					if (res.success && res.data) {
						if (!ATFRFO.state.config) { ATFRFO.state.config = {}; }
						var _descIds = descCats.map(function (c) { return c.id; });
						ATFRFO.state.config[self._cfg.catKey] = _preCats.filter(function (c) {
							return _descIds.indexOf(c.id) === -1;
						});
						if (res.data.classes) {
							ATFRFO.state.classes = res.data.classes;
						}
						for (var _ddi = 0; _ddi < descCats.length; _ddi++) {
							delete self._collapsedIds[descCats[_ddi].id];
						}
						if (ATFRFO.App) { ATFRFO.App.setDirty(true); }
						self._rerenderView();
						if (ATFRFO.PanelLeft && ATFRFO.PanelLeft.refresh) { ATFRFO.PanelLeft.refresh(); }
					} else if (!res.success) {
						var errMsg = (res.data && res.data.message) ? res.data.message : 'Clear failed.';
						ATFRFO.Modal.open({ title: 'Clear failed', body: '<p>' + errMsg + '</p>' });
					}
				}).catch(function () {
					ATFRFO.Modal.open({ title: 'Connection error', body: '<p>Connection error during clear.</p>' });
				});
			}

			function handleClrClick(e) {
				if (e.target.id === 'atfrfo-modal-clr-cancel') {
					ATFRFO.Modal.close();
					document.removeEventListener('click', handleClrClick);
				} else if (e.target.id === 'atfrfo-modal-clr-ok') {
					doClearCategory();
				}
			}
			document.addEventListener('click', handleClrClick);
		},

		/**
		 * Duplicate a category shell only — does NOT duplicate the classes
		 * inside it. Classes are sync-sourced from Elementor (identified by
		 * elementor_id); fabricating copies here would create AFF-only rows
		 * with no real Elementor class behind them. This is the one place
		 * Classes deliberately diverges from the Colors/Fonts/Numbers
		 * "duplicate category" behavior.
		 *
		 * @param {string} catId Source category ID.
		 */
		_duplicateCategory: function (catId) {
			var self = this;
			if (!ATFRFO.state.currentFile) { self._noFileModal(); return; }

			var cats = self._getCatsForSet();
			var cat  = null;
			for (var i = 0; i < cats.length; i++) {
				if (cats[i].id === catId) { cat = cats[i]; break; }
			}
			if (!cat) { return; }

			ATFRFO.App.ajax('atfrfo_save_category', {
				filename: ATFRFO.state.currentFile,
				subgroup: self._cfg.setName,
				category: JSON.stringify({ name: cat.name + ' (copy)' }),
			}).then(function (res) {
				if (!res.success || !res.data) { return; }
				if (!ATFRFO.state.config) { ATFRFO.state.config = {}; }
				var _dupCat = null;
				var _dupServerCats = res.data.categories || [];
				for (var _di = 0; _di < _dupServerCats.length; _di++) {
					if (_dupServerCats[_di].id === res.data.id) { _dupCat = _dupServerCats[_di]; break; }
				}
				if (_dupCat) {
					if (!Array.isArray(ATFRFO.state.config[self._cfg.catKey])) {
						ATFRFO.state.config[self._cfg.catKey] = [];
					}
					ATFRFO.state.config[self._cfg.catKey].push(_dupCat);
				} else {
					ATFRFO.state.config[self._cfg.catKey] = _dupServerCats;
				}
				if (ATFRFO.App) { ATFRFO.App.setDirty(true); }
				self._rerenderView();
				if (ATFRFO.PanelLeft && ATFRFO.PanelLeft.refresh) { ATFRFO.PanelLeft.refresh(); }
			}).catch(function () {});
		},

		/** CSS selector for the active view inside the container. Required by ATFRFO.CatMixin._initCatDrag. */
		_catViewSelector: function () {
			return '.atfrfo-classes-view';
		},

		_noFileModal: function () {
			ATFRFO.Modal.open({ title: 'No project open', body: '<p>Open or create a project first.</p>' });
		},

		/**
		 * Handle a completed category drop: reorder categories.
		 * Identical logic to ATFRFO.Variables._proto._onDropCat.
		 */
		_onDropCat: function (srcId, targetId, above) {
			var self = this;
			var cats = self._getCatsForSet().slice();

			var srcIdx = -1, tgtIdx = -1;
			for (var i = 0; i < cats.length; i++) {
				if (cats[i].id === srcId)    { srcIdx = i; }
				if (cats[i].id === targetId) { tgtIdx = i; }
			}
			if (srcIdx === -1 || tgtIdx === -1) { return; }

			var srcCat = cats.splice(srcIdx, 1)[0];
			tgtIdx = -1;
			for (var j = 0; j < cats.length; j++) {
				if (cats[j].id === targetId) { tgtIdx = j; break; }
			}
			cats.splice(above ? tgtIdx : tgtIdx + 1, 0, srcCat);
			cats.forEach(function (c, idx) { c.order = idx; });

			var ordered_ids = cats.map(function (c) { return c.id; });
			ATFRFO.state.config[self._cfg.catKey] = cats;

			ATFRFO.App.ajax('atfrfo_reorder_categories', {
				filename:    ATFRFO.state.currentFile,
				subgroup:    self._cfg.setName,
				ordered_ids: JSON.stringify(ordered_ids),
			}).then(function () {
				self._rerenderView();
			}).catch(function () {});
		},

		// -------------------------------------------------------------------
		// COMMENT FIELD — inline edit
		// -------------------------------------------------------------------

		/**
		 * Save a class's Comment (notes) field via the AFF-local
		 * atfrfo_update_class endpoint. Does not touch Elementor.
		 *
		 * @param {string}      classId
		 * @param {HTMLElement} noteInput
		 */
		_saveClassNote: function (classId, noteInput) {
			var self    = this;
			var newNote = noteInput.value.trim();
			var oldNote = noteInput.getAttribute('data-original') || '';
			if (newNote === oldNote) { return; }
			if (!ATFRFO.state.currentFile) {
				noteInput.value = oldNote;
				self._noFileModal();
				return;
			}

			ATFRFO.App.ajax('atfrfo_update_class', {
				filename: ATFRFO.state.currentFile,
				class:    JSON.stringify({ id: classId, notes: newNote }),
			}).then(function (res) {
				if (res.success) {
					var cls = ATFRFO.Utils.findClassById(classId);
					if (cls) { cls.notes = newNote; }
					noteInput.setAttribute('data-original', newNote);
					if (ATFRFO.App) { ATFRFO.App.setDirty(true); }
				} else {
					noteInput.value = oldNote;
				}
			}).catch(function () { noteInput.value = oldNote; });
		},

		/**
		 * Save a class's display name (label) — AFF-local only. Does not
		 * rename the class in Elementor, and is not permanent: the next
		 * Classes sync overwrites 'label' back to Elementor's value (see
		 * ajax_atfrfo_update_class() in class-atfrfo-ajax-handler.php).
		 *
		 * @param {string}      classId
		 * @param {HTMLElement} nameInput
		 */
		_saveClassName: function (classId, nameInput) {
			var self    = this;
			var newName = nameInput.value.trim();
			var oldName = nameInput.getAttribute('data-original') || '';
			if (!newName) {
				nameInput.value = oldName;
				return;
			}
			if (newName === oldName) { return; }
			if (!ATFRFO.state.currentFile) {
				nameInput.value = oldName;
				self._noFileModal();
				return;
			}

			var cls = ATFRFO.Utils.findClassById(classId);
			if (!cls || !cls.elementor_id) {
				nameInput.value = oldName;
				return;
			}

			// Renames for real now — pushes the new label to Elementor itself
			// (not AFF-local-only), so it survives the next sync instead of
			// being silently overwritten back by it. See
			// ajax_atfrfo_rename_class_in_elementor() docblock for why.
			ATFRFO.App.ajax('atfrfo_rename_class_in_elementor', {
				filename:     ATFRFO.state.currentFile,
				elementor_id: cls.elementor_id,
				label:        newName,
			}).then(function (res) {
				if (res.success) {
					cls.label = newName;
					nameInput.setAttribute('data-original', newName);
					if (ATFRFO.App) { ATFRFO.App.setDirty(true); }
				} else {
					nameInput.value = oldName;
					var errMsg = (res.data && res.data.message) ? res.data.message : 'Rename failed.';
					ATFRFO.Modal.open({ title: 'Rename failed', body: '<p>' + ATFRFO.Utils.escHtml(errMsg) + '</p>' });
				}
			}).catch(function () { nameInput.value = oldName; });
		},

		// -------------------------------------------------------------------
		// COLLAPSE / EXPAND
		// -------------------------------------------------------------------

		_toggleCategoryBlock: function (block, catId) {
			var self    = this;
			var isColl  = block.getAttribute('data-collapsed') === 'true';
			block.setAttribute('data-collapsed', String(!isColl));
			self._collapsedIds[catId] = !isColl;
			if (!isColl) {
				var _subBlocks = block.querySelectorAll('.atfrfo-category-block[data-depth="1"]');
				for (var _sbi = 0; _sbi < _subBlocks.length; _sbi++) {
					var _sb   = _subBlocks[_sbi];
					var _sbId = _sb.getAttribute('data-category-id');
					_sb.setAttribute('data-collapsed', 'true');
					if (_sbId) { self._collapsedIds[_sbId] = true; }
				}
			} else {
				block.scrollIntoView({ behavior: 'smooth', block: 'start' });
			}
		},

		_toggleAll: function (container, collapse) {
			var self   = this;
			var blocks = container.querySelectorAll('.atfrfo-category-block[data-depth="1"], .atfrfo-category-block:not([data-depth])');
			for (var i = 0; i < blocks.length; i++) {
				var block = blocks[i];
				var catId = block.getAttribute('data-category-id');
				block.setAttribute('data-collapsed', String(collapse));
				if (catId) { self._collapsedIds[catId] = collapse; }
			}
		},

		// -------------------------------------------------------------------
		// ROW DRAG — reorder classes within a category
		// -------------------------------------------------------------------

		/**
		 * Mouse-based drag-and-drop to reorder class rows, including moving a
		 * class into a different category (drop it on any row belonging to
		 * that category — reassigns category/category_id, not just display
		 * order). Modeled on ATFRFO.CatMixin._initCatDrag.
		 *
		 * @param {HTMLElement} container
		 */
		_initRowDrag: function (container) {
			var self = this;
			var d = { active: false, classId: null, catId: null, ghost: null, indicator: null, startY: 0, _dropTargetId: null, _dropTargetCatId: null, _dropAbove: null };

			container.addEventListener('mousedown', function (e) {
				if (!container.querySelector('.atfrfo-classes-view')) { return; }
				var handle = e.target.closest('[data-action="row-drag-handle"]');
				if (!handle) { return; }
				e.preventDefault();

				var row = handle.closest('.atfrfo-class-row');
				if (!row) { return; }
				d.classId = row.getAttribute('data-class-id');
				if (!d.classId) { return; }
				// Identify "same category" by ID, not by DOM node reference —
				// a stale node reference (e.g. from a re-render triggered by
				// an in-progress Comment/name edit losing focus when the drag
				// starts) silently breaks the same-list check below, which
				// looked like "drag works but no drop indicator ever appears
				// and drops never complete" (reported 2026-08-07).
				var block = row.closest('.atfrfo-category-block');
				d.catId = block ? block.getAttribute('data-category-id') : null;
				if (!d.catId) { return; }

				d.active = true;
				d.startY = e.clientY;

				var rowRect = row.getBoundingClientRect();
				var ghost = row.cloneNode(true);
				ghost.style.cssText = 'position:fixed;pointer-events:none;z-index:9999;'
					+ 'width:' + row.offsetWidth + 'px;'
					+ 'top:' + rowRect.top + 'px;left:' + rowRect.left + 'px;'
					+ 'opacity:0.88;box-shadow:0 8px 24px rgba(0,0,0,0.28);border-radius:6px;'
					+ 'background:var(--atfrfo-bg-card,#fff);';
				ghost.className += ' atfrfo-drag-ghost';
				document.body.appendChild(ghost);
				d.ghost = ghost;

				var indicator = document.createElement('div');
				indicator.className = 'atfrfo-drop-indicator';
				indicator.style.display = 'none';
				indicator.style.pointerEvents = 'none';
				var _appEl  = document.getElementById('atfrfo-app');
				var _accent = _appEl ? getComputedStyle(_appEl).getPropertyValue('--atfrfo-clr-drop-indicator').trim() : '';
				if (!_accent) { _accent = '#8a7259'; }
				indicator.style.background = 'linear-gradient(to right, transparent, '
					+ _accent + ' 15%, ' + _accent + ' 85%, transparent)';
				document.body.appendChild(indicator);
				d.indicator = indicator;

				row.style.opacity = '0.3';
			});

			document.addEventListener('mousemove', function (e) {
				if (!d.active || !d.ghost) { return; }
				var dy = e.clientY - d.startY;
				d.ghost.style.transform = 'translateY(' + dy + 'px)';

				d.ghost.style.display = 'none';
				var elBelow = document.elementFromPoint(e.clientX, e.clientY);
				d.ghost.style.display = '';

				var targetRow = elBelow ? elBelow.closest('.atfrfo-class-row') : null;
				var forceAfter = false;

				// If hovering a COLLAPSED category, expand it immediately and
				// re-probe so a row (or the now-visible list body) can be found
				// on this same mouse event. Without this, a collapsed category
				// was never a valid drop target — Colors/Fonts/Numbers already
				// do this in ATFRFO.VarDrag; Classes' row drag never had it.
				if (!targetRow && elBelow) {
					var collapsedBlock = elBelow.closest('.atfrfo-category-block');
					if (collapsedBlock && collapsedBlock.getAttribute('data-collapsed') === 'true') {
						collapsedBlock.setAttribute('data-collapsed', 'false');
						var _cbId = collapsedBlock.getAttribute('data-category-id');
						if (_cbId) { self._collapsedIds[_cbId] = false; }
						d.ghost.style.display = 'none';
						var elBelow2 = document.elementFromPoint(e.clientX, e.clientY);
						d.ghost.style.display = '';
						var newRow = elBelow2 ? elBelow2.closest('.atfrfo-class-row') : null;
						if (newRow) { targetRow = newRow; }
						elBelow = elBelow2 || elBelow;
					}
				}

				// Not directly over a row — if hovering anywhere else inside an
				// expanded category block (its header, empty-state text, list
				// body, etc.), fall back to the last row in that block (or the
				// block itself if it has none yet). Without this, a category
				// with no rows near the cursor — including a genuinely empty
				// one — was never a valid drop target at all.
				if (!targetRow && elBelow) {
					var hoverBlock = elBelow.closest('.atfrfo-category-block');
					if (hoverBlock && hoverBlock.getAttribute('data-collapsed') !== 'true') {
						var blockRows = hoverBlock.querySelectorAll('.atfrfo-class-row');
						var lastOther = null;
						for (var bi = 0; bi < blockRows.length; bi++) {
							if (blockRows[bi].getAttribute('data-class-id') !== d.classId) { lastOther = blockRows[bi]; }
						}
						if (lastOther) {
							targetRow  = lastOther;
							forceAfter = true;
						} else {
							// Empty category (or only the dragged row itself) —
							// show the indicator across the list body and drop
							// with no specific target row, just the category.
							var emptyBody = hoverBlock.querySelector('.atfrfo-color-list');
							var catIdOnly = hoverBlock.getAttribute('data-category-id');
							if (emptyBody && catIdOnly) {
								var ebRect = emptyBody.getBoundingClientRect();
								d.indicator.style.display = '';
								d.indicator.style.left    = ebRect.left + 'px';
								d.indicator.style.width   = ebRect.width + 'px';
								d.indicator.style.top     = (ebRect.top + Math.min(ebRect.height, 20) / 2 - 5) + 'px';
								d.indicator.style.height  = '10px';
								d._dropTargetId    = null;
								d._dropTargetCatId = catIdOnly;
								d._dropAbove       = true;
								return;
							}
						}
					}
				}

				var targetBlock = targetRow ? targetRow.closest('.atfrfo-category-block') : null;
				var targetCatId = targetBlock ? targetBlock.getAttribute('data-category-id') : null;
				if (targetRow && targetCatId && targetRow.getAttribute('data-class-id') !== d.classId) {
					var trRect = targetRow.getBoundingClientRect();
					var above  = forceAfter ? false : (e.clientY < trRect.top + trRect.height / 2);
					d.indicator.style.display = '';
					d.indicator.style.left    = trRect.left + 'px';
					d.indicator.style.width   = trRect.width + 'px';
					d.indicator.style.top     = (above ? trRect.top : trRect.bottom) - 5 + 'px';
					d.indicator.style.height  = '10px';
					d._dropTargetId    = targetRow.getAttribute('data-class-id');
					d._dropTargetCatId = targetCatId;
					d._dropAbove       = above;
				} else {
					d.indicator.style.display = 'none';
					d._dropTargetId    = null;
					d._dropTargetCatId = null;
				}
			});

			document.addEventListener('mouseup', function () {
				if (!d.active) { return; }
				d.active = false;

				if (d.ghost     && d.ghost.parentNode)     { d.ghost.parentNode.removeChild(d.ghost); }
				if (d.indicator && d.indicator.parentNode) { d.indicator.parentNode.removeChild(d.indicator); }
				d.ghost     = null;
				d.indicator = null;

				var draggingRow = container.querySelector('.atfrfo-class-row[data-class-id="' + d.classId + '"]');
				if (draggingRow) { draggingRow.style.opacity = ''; }

				if (d._dropTargetCatId && d.classId) {
					self._onDropClassRow(d.classId, d._dropTargetId, d._dropAbove, d._dropTargetCatId);
				}
				d._dropTargetId    = null;
				d._dropTargetCatId = null;
				d._dropAbove       = null;
				d.classId          = null;
				d.catId            = null;
			});
		},

		/**
		 * Handle a completed row drop: reassign the dragged class to the
		 * target row's category (if different from its current one) and
		 * position it relative to the target row, persisting category,
		 * category_id, and order via atfrfo_update_class.
		 *
		 * @param {string}  srcId
		 * @param {string}  targetId
		 * @param {boolean} above
		 * @param {string}  targetCatId Category ID the target row belongs to.
		 */
		_onDropClassRow: function (srcId, targetId, above, targetCatId) {
			var self = this;
			var src = ATFRFO.Utils.findClassById(srcId);
			if (!src) { return; }

			var cats = self._getCatsForSet();
			var targetCat = null;
			for (var i = 0; i < cats.length; i++) {
				if (cats[i].id === targetCatId) { targetCat = cats[i]; break; }
			}
			if (!targetCat) { return; }

			// Reassign category if the drop landed in a different one than
			// the class currently belongs to.
			if (src.category_id !== targetCat.id) {
				src.category_id = targetCat.id;
				src.category    = targetCat.name;
			}

			var ordered = self._getClassesForCategory(targetCat).slice();
			// Ensure src is represented exactly once in the target list, then
			// position it relative to the target row — or at the end, when
			// dropped on an empty category (no targetId at all).
			ordered = ordered.filter(function (c) { return c.id !== srcId; });
			var tgtIdx = -1;
			if (targetId) {
				for (var j = 0; j < ordered.length; j++) {
					if (ordered[j].id === targetId) { tgtIdx = j; break; }
				}
			}
			if (tgtIdx === -1) { ordered.push(src); }
			else { ordered.splice(above ? tgtIdx : tgtIdx + 1, 0, src); }

			var changed = [src];
			for (var m = 0; m < ordered.length; m++) {
				if (ordered[m].id !== srcId && (ordered[m].order || 0) !== m) {
					ordered[m].order = m;
					changed.push(ordered[m]);
				} else if (ordered[m].id === srcId) {
					src.order = m;
				}
			}

			self._rerenderView();

			if (!ATFRFO.state.currentFile) { return; }
			var promises = changed.map(function (c) {
				var payload = { id: c.id, order: c.order };
				if (c.id === srcId) {
					payload.category    = c.category;
					payload.category_id = c.category_id;
				}
				return ATFRFO.App.ajax('atfrfo_update_class', {
					filename: ATFRFO.state.currentFile,
					class:    JSON.stringify(payload),
				});
			});
			Promise.all(promises).then(function () {
				if (ATFRFO.App) { ATFRFO.App.setDirty(true); }
				if (ATFRFO.PanelLeft && ATFRFO.PanelLeft.refresh) { ATFRFO.PanelLeft.refresh(); }
			}).catch(function () {});
		},

		// -------------------------------------------------------------------
		// FILTER / SEARCH
		// -------------------------------------------------------------------

		_filterRows: function (container, term) {
			var blocks = container.querySelectorAll('.atfrfo-category-block');
			for (var b = 0; b < blocks.length; b++) {
				var block = blocks[b];
				var rows  = block.querySelectorAll('.atfrfo-class-row');
				var anyVisible = !term;
				for (var r = 0; r < rows.length; r++) {
					var row   = rows[r];
					var name  = (row.querySelector('.atfrfo-class-name-input') || {}).value || '';
					var match = !term || name.toLowerCase().indexOf(term) !== -1;
					row.style.display = match ? '' : 'none';
					if (match) { anyVisible = true; }
				}
				block.style.display = anyVisible ? '' : 'none';
			}
		},

		// -------------------------------------------------------------------
		// EVENT BINDING
		// -------------------------------------------------------------------

		_bindEvents: function (container) {
			var self = this;

			var backBtn = container.querySelector('#atfrfo-classes-back');
			if (backBtn) { backBtn.addEventListener('click', function () { self._closeView(); }); }

			var toggleBtn = container.querySelector('#atfrfo-classes-collapse-toggle');
			if (toggleBtn) {
				toggleBtn.addEventListener('click', function () {
					var collapseNow = toggleBtn.getAttribute('data-toggle-state') === 'expanded';
					self._toggleAll(container, collapseNow);
					toggleBtn.setAttribute('data-toggle-state', collapseNow ? 'collapsed' : 'expanded');
					toggleBtn.innerHTML = collapseNow ? ATFRFO.Icons.expandAllSVG() : ATFRFO.Icons.collapseAllSVG();
				});
			}

			var addCatBtn = container.querySelector('#atfrfo-classes-add-category');
			if (addCatBtn) { addCatBtn.addEventListener('click', function () { self._addCategory(); }); }

			var searchInput = container.querySelector('#atfrfo-classes-search');
			if (searchInput) {
				searchInput.addEventListener('input', function () {
					self._filterRows(container, searchInput.value.trim().toLowerCase());
				});
			}

			if (container._effClassesEventsBound) { return; }
			container._effClassesEventsBound = true;

			self._initCatDrag(container);
			self._initRowDrag(container);

			// ---- Click delegation: category-action toolbar + click-anywhere header toggle ----
			container.addEventListener('click', function (e) {
				if (!container.querySelector('.atfrfo-classes-view')) { return; }

				var btn = e.target.closest('[data-action]');
				if (btn) {
					var action = btn.getAttribute('data-action');
					var block  = btn.closest('.atfrfo-category-block');
					var catId  = block ? block.getAttribute('data-category-id') : null;

					switch (action) {
						case 'add-sub-cat': if (catId) { self._addSubCategory(catId); }    break;
						case 'clear-cat':   if (catId) { self._clearCategory(catId); }     break;
						case 'duplicate':   if (catId) { self._duplicateCategory(catId); } break;
						case 'delete':      if (catId) { self._deleteCategory(catId); }    break;
						case 'collapse':    if (block && catId) { self._toggleCategoryBlock(block, catId); } break;
					case 'expand-class': {
						var expClassId = btn.getAttribute('data-class-id');
						if (expClassId) { self._openClassCard(expClassId); }
						break;
					}
					case 'delete-class': {
						var delClassId = btn.getAttribute('data-class-id');
						if (delClassId) { self._deleteClassFromElementor(delClassId); }
						break;
					}
					}
					return;
				}

				// Click anywhere else in the header top toggles collapse — matches
				// the explicit collapse button, ignoring the editable name span
				// (which starts a rename on mousedown; see below) and the toolbar
				// (handled above via data-action).
				var headerTop = e.target.closest('.atfrfo-cat-header-top');
				if (!headerTop || e.target.closest('.atfrfo-category-name-input')) { return; }
				var hBlock = headerTop.closest('.atfrfo-category-block');
				var hCatId = hBlock ? hBlock.getAttribute('data-category-id') : null;
				if (hBlock && hCatId) { self._toggleCategoryBlock(hBlock, hCatId); }
			});

			// ---- Column sort ----
			container.addEventListener('click', function (e) {
				var sortBtn = e.target.closest('.atfrfo-col-sort-btn');
				if (!sortBtn) { return; }
				var sCatId = sortBtn.getAttribute('data-cat-id');
				var sDir   = sortBtn.getAttribute('data-sort-dir');
				var nextDir = sDir === 'none' ? 'asc' : (sDir === 'asc' ? 'desc' : 'none');
				self._catSortState[sCatId] = { field: 'name', dir: nextDir };
				self._rerenderView();
			});

			// ---- Single-click to activate editing (category name, name, comment) ----
			container.addEventListener('mousedown', function (e) {
				var input = e.target.closest('.atfrfo-class-notes-input, .atfrfo-class-name-input, .atfrfo-category-name-input');
				if (!input) { return; }
				if (input.getAttribute('data-locked') === 'true') { return; }

				var isCat     = input.classList.contains('atfrfo-category-name-input');
				var isEditing = isCat
					? (input.getAttribute('contenteditable') === 'true')
					: !input.hasAttribute('readonly');
				if (isEditing) { return; }

				if (isCat) {
					input.setAttribute('contenteditable', 'true');
					setTimeout(function () {
						input.focus();
						var range = document.createRange();
						range.selectNodeContents(input);
						var sel = window.getSelection();
						sel.removeAllRanges();
						sel.addRange(range);
					}, 0);
				} else {
					input.removeAttribute('readonly');
					setTimeout(function () { input.focus(); input.select(); }, 0);
				}
			});

			// ---- Restore readonly / contenteditable on focusout ----
			container.addEventListener('focusout', function (e) {
				var noteInput = e.target.closest('.atfrfo-class-notes-input');
				if (noteInput) {
					noteInput.setAttribute('readonly', '');
					var nRow = noteInput.closest('.atfrfo-class-row');
					var nId  = nRow ? nRow.getAttribute('data-class-id') : null;
					if (nId !== null) { self._saveClassNote(nId, noteInput); }
					return;
				}

				var nameInput = e.target.closest('.atfrfo-class-name-input');
				if (nameInput) {
					nameInput.setAttribute('readonly', '');
					var _nmRow = nameInput.closest('.atfrfo-class-row');
					var _nmId  = _nmRow ? _nmRow.getAttribute('data-class-id') : null;
					if (_nmId !== null) { self._saveClassName(_nmId, nameInput); }
					return;
				}

				var catInput = e.target.closest('.atfrfo-category-name-input');
				if (catInput && catInput.getAttribute('data-locked') !== 'true') {
					self._saveCategoryName(catInput);
					catInput.setAttribute('contenteditable', 'false');
				}
			});

			// ---- Category name: Enter / Escape ----
			container.addEventListener('keydown', function (e) {
				var catInput = e.target.closest('.atfrfo-category-name-input');
				if (catInput) {
					if (e.key === 'Enter') {
						e.preventDefault();
						catInput.blur();
					} else if (e.key === 'Escape') {
						catInput.textContent = catInput.getAttribute('data-original') || '';
						catInput.setAttribute('contenteditable', 'false');
						catInput.blur();
					}
					return;
				}

				var noteInput = e.target.closest('.atfrfo-class-notes-input');
				if (noteInput) {
					if (e.key === 'Enter') {
						if (noteInput.hasAttribute('readonly')) {
							e.preventDefault();
							noteInput.removeAttribute('readonly');
							setTimeout(function () { noteInput.focus(); noteInput.select(); }, 0);
						} else {
							e.preventDefault();
							noteInput.blur();
						}
					} else if (e.key === 'Escape' && !noteInput.hasAttribute('readonly')) {
						e.preventDefault();
						noteInput.value = noteInput.getAttribute('data-original') || '';
						noteInput.blur();
					}
					return;
				}

				var nameInput = e.target.closest('.atfrfo-class-name-input');
				if (nameInput) {
					if (e.key === 'Enter') {
						if (nameInput.hasAttribute('readonly')) {
							e.preventDefault();
							nameInput.removeAttribute('readonly');
							setTimeout(function () { nameInput.focus(); nameInput.select(); }, 0);
						} else {
							e.preventDefault();
							nameInput.blur();
						}
					} else if (e.key === 'Escape' && !nameInput.hasAttribute('readonly')) {
						e.preventDefault();
						nameInput.value = nameInput.getAttribute('data-original') || '';
						nameInput.blur();
					}
				}
			});

			// ---- Comment / name: save on change ----
			container.addEventListener('change', function (e) {
				var noteInput = e.target.closest('.atfrfo-class-notes-input');
				if (noteInput) {
					var nRow = noteInput.closest('.atfrfo-class-row');
					var nId  = nRow ? nRow.getAttribute('data-class-id') : null;
					if (nId !== null) { self._saveClassNote(nId, noteInput); }
					return;
				}
				var nameInput = e.target.closest('.atfrfo-class-name-input');
				if (nameInput) {
					var _nmRow = nameInput.closest('.atfrfo-class-row');
					var _nmId  = _nmRow ? _nmRow.getAttribute('data-class-id') : null;
					if (_nmId !== null) { self._saveClassName(_nmId, nameInput); }
				}
			});
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
		 * @param {boolean} [options.silent] Skip the result modal.
		 * @returns {Promise<Object>} Resolves with {success, summary?, message?}.
		 */
		syncFromElementor: function (options) {
			var silent = !!(options && options.silent);

			if (!ATFRFO.state.currentFile) {
				return Promise.resolve({ success: false, message: 'No project open.' });
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
					if (ATFRFO.PanelLeft) { ATFRFO.PanelLeft.refresh(); }

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

	// Category primitives genuinely generic enough to reuse (add category,
	// add sub-category, reorder, drag) are mixed in from ATFRFO.CatMixin in
	// atfrfo-app.js, after CatMixin is defined (this file loads first — see
	// class-atfrfo-admin.php script registration order). See file header for
	// why delete/clear/rename/duplicate are implemented locally above instead.
}());
