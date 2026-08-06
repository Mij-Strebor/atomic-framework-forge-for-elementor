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

			if (self._focusedCatId) {
				self._jumpToCategory(self._focusedCatId, container);
			}
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
				+ '<span></span>' // col4: has-styles flag
				+ '<span></span>' // col5: comment
				+ '<span></span>' // col6: expand
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
		 * only, does not affect Elementor), status dot, name (editable —
		 * AFF-local rename; NOT pushed to Elementor, and overwritten back to
		 * Elementor's value on the next sync), has-styles flag, inline-editable
		 * Comment.
		 *
		 * @param {Object} cls Class object (see class_defaults() in PHP).
		 * @returns {string}
		 */
		_buildClassRow: function (cls) {
			var meta       = ATFRFO.Classes._statusMeta(cls.status);
			var styleLabel = cls.has_styles ? 'has styles' : 'no styles';
			var styleTip   = cls.has_styles
				? 'This class has one or more style properties set in Elementor.'
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
				+ '<input type="text" class="atfrfo-class-name-input"'
				+ ' value="' + ATFRFO.Utils.escAttr(cls.label || '') + '"'
				+ ' data-original="' + ATFRFO.Utils.escAttr(cls.label || '') + '"'
				+ ' readonly'
				+ ' aria-label="Class name"'
				+ ' data-atfrfo-tooltip="Class name — click to edit (AFF-local; reverts on next sync)"'
				+ ' spellcheck="false">'
				+ '<span class="atfrfo-class-styles-flag" data-has-styles="' + (cls.has_styles ? 'true' : 'false') + '"'
				+ ' data-atfrfo-tooltip="' + ATFRFO.Utils.escAttr(styleTip) + '">'
				+ ATFRFO.Utils.escHtml(styleLabel)
				+ '</span>'
				+ '<input type="text" class="atfrfo-class-notes-input"'
				+ ' value="' + ATFRFO.Utils.escAttr(cls.notes || '') + '"'
				+ ' data-original="' + ATFRFO.Utils.escAttr(cls.notes || '') + '"'
				+ ' readonly'
				+ ' placeholder="Comment"'
				+ ' aria-label="Class comment"'
				+ ' data-atfrfo-tooltip="Comment — click to edit"'
				+ ' spellcheck="false">'
				+ '<button class="atfrfo-icon-btn atfrfo-class-expand-btn"'
				+ ' data-action="expand-class"'
				+ ' data-class-id="' + ATFRFO.Utils.escAttr(cls.id) + '"'
				+ ' aria-label="View class details"'
				+ ' data-atfrfo-tooltip="View class details"'
				+ ' data-atfrfo-tooltip-long="Open a read-only card showing this class’s style properties by breakpoint and state">'
				+ ATFRFO.Icons.chevronSVG()
				+ '</button>'
				+ '</div>';
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
				+ '<div><span class="atfrfo-class-card-label">Comment</span><span class="atfrfo-class-card-value">' + ATFRFO.Utils.escHtml(cls.notes || '—') + '</span></div>'
				+ (cls.last_synced_at ? '<div><span class="atfrfo-class-card-label">Last synced</span><span class="atfrfo-class-card-value">' + ATFRFO.Utils.escHtml(cls.last_synced_at) + '</span></div>' : '')
				+ '</div>'; // .atfrfo-class-card-meta

			body += '<div class="atfrfo-class-card-props">';
			if (variants.length === 0) {
				body += '<p class="atfrfo-colors-empty" style="padding:var(--sp-4) 0">No style properties set on this class yet.</p>';
			} else {
				for (var i = 0; i < variants.length; i++) {
					body += ATFRFO.Classes._renderVariantGroup(variants[i]);
				}
			}
			body += '</div>';

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
			var arr    = (ATFRFO.state.config && ATFRFO.state.config[catKey]) || [];
			return arr.slice().sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
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

			ATFRFO.App.ajax('atfrfo_update_class', {
				filename: ATFRFO.state.currentFile,
				class:    JSON.stringify({ id: classId, label: newName }),
			}).then(function (res) {
				if (res.success) {
					var cls = ATFRFO.Utils.findClassById(classId);
					if (cls) { cls.label = newName; }
					nameInput.setAttribute('data-original', newName);
					if (ATFRFO.App) { ATFRFO.App.setDirty(true); }
				} else {
					nameInput.value = oldName;
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
		 * Mouse-based drag-and-drop to reorder class rows within a single
		 * category block. Display order only — classes are not moved
		 * between categories this way (see the category-block drag in
		 * ATFRFO.CatMixin._initCatDrag for that). Modeled on _initCatDrag.
		 *
		 * @param {HTMLElement} container
		 */
		_initRowDrag: function (container) {
			var self = this;
			var d = { active: false, classId: null, listEl: null, ghost: null, indicator: null, startY: 0, _dropTargetId: null, _dropAbove: null };

			container.addEventListener('mousedown', function (e) {
				if (!container.querySelector('.atfrfo-classes-view')) { return; }
				var handle = e.target.closest('[data-action="row-drag-handle"]');
				if (!handle) { return; }
				e.preventDefault();

				var row = handle.closest('.atfrfo-class-row');
				if (!row) { return; }
				d.classId = row.getAttribute('data-class-id');
				if (!d.classId) { return; }
				d.listEl = row.closest('.atfrfo-color-list');
				if (!d.listEl) { return; }

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
				var _accent = _appEl ? getComputedStyle(_appEl).getPropertyValue('--atfrfo-clr-accent').trim() : '';
				if (!_accent) { _accent = '#f4c542'; }
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
				// Only allow dropping within the same category's row list.
				if (targetRow && targetRow.closest('.atfrfo-color-list') === d.listEl
					&& targetRow.getAttribute('data-class-id') !== d.classId) {
					var trRect = targetRow.getBoundingClientRect();
					var above  = e.clientY < trRect.top + trRect.height / 2;
					d.indicator.style.display = '';
					d.indicator.style.left    = trRect.left + 'px';
					d.indicator.style.width   = trRect.width + 'px';
					d.indicator.style.top     = (above ? trRect.top : trRect.bottom) - 2 + 'px';
					d.indicator.style.height  = '4px';
					d._dropTargetId = targetRow.getAttribute('data-class-id');
					d._dropAbove    = above;
				} else {
					d.indicator.style.display = 'none';
					d._dropTargetId = null;
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

				if (d._dropTargetId && d.classId && d._dropTargetId !== d.classId) {
					self._onDropClassRow(d.classId, d._dropTargetId, d._dropAbove);
				}
				d._dropTargetId = null;
				d._dropAbove    = null;
				d.classId       = null;
				d.listEl        = null;
			});
		},

		/**
		 * Handle a completed row drop: reorder classes within their shared
		 * category and persist the new `order` for each affected class via
		 * atfrfo_update_class. Display order only.
		 *
		 * @param {string}  srcId
		 * @param {string}  targetId
		 * @param {boolean} above
		 */
		_onDropClassRow: function (srcId, targetId, above) {
			var self = this;
			var src    = ATFRFO.Utils.findClassById(srcId);
			var target = ATFRFO.Utils.findClassById(targetId);
			if (!src || !target) { return; }

			// Both rows were confirmed same-list at drop time; rebuild that
			// category's ordered list from current state to compute new orders.
			var cats = self._getCatsForSet();
			var cat  = null;
			for (var i = 0; i < cats.length; i++) {
				var members = self._getClassesForCategory(cats[i]);
				if (members.some(function (c) { return c.id === srcId; })
					&& members.some(function (c) { return c.id === targetId; })) {
					cat = cats[i];
					break;
				}
			}
			if (!cat) { return; }

			var ordered = self._getClassesForCategory(cat).slice();
			var srcIdx = -1, tgtIdx = -1;
			for (var j = 0; j < ordered.length; j++) {
				if (ordered[j].id === srcId)    { srcIdx = j; }
				if (ordered[j].id === targetId) { tgtIdx = j; }
			}
			if (srcIdx === -1 || tgtIdx === -1) { return; }

			var moved = ordered.splice(srcIdx, 1)[0];
			tgtIdx = -1;
			for (var k = 0; k < ordered.length; k++) {
				if (ordered[k].id === targetId) { tgtIdx = k; break; }
			}
			ordered.splice(above ? tgtIdx : tgtIdx + 1, 0, moved);

			var changed = [];
			for (var m = 0; m < ordered.length; m++) {
				if ((ordered[m].order || 0) !== m) {
					ordered[m].order = m;
					changed.push(ordered[m]);
				}
			}

			self._rerenderView();

			if (!ATFRFO.state.currentFile || changed.length === 0) { return; }
			var promises = changed.map(function (c) {
				return ATFRFO.App.ajax('atfrfo_update_class', {
					filename: ATFRFO.state.currentFile,
					class:    JSON.stringify({ id: c.id, order: c.order }),
				});
			});
			Promise.all(promises).then(function () {
				if (ATFRFO.App) { ATFRFO.App.setDirty(true); }
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
