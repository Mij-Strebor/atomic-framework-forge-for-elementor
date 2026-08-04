/**
 * ATFRFO Variables — Generic Variable Set Factory (Fonts & Numbers)
 *
 * A prototype-based factory that creates isolated instances for each
 * variable set (Fonts, Numbers). Each instance intercepts
 * ATFRFO.EditSpace.loadCategory() for its own subgroup and renders a full
 * editing workspace: filter bar, category blocks, variable rows,
 * drag-and-drop, undo/redo, sort, search/filter, and collapse/expand.
 *
 * Architecture:
 *   ATFRFO.Variables.initSet(cfg) — create and wire one set instance.
 *   ATFRFO.Variables._proto       — shared prototype with all behaviour.
 *
 * Per-set configuration (cfg):
 *   setName          {string}    'Fonts' | 'Numbers'
 *   catKey           {string}    'fontCategories' | 'numberCategories'
 *   showExpandPanel  {boolean}   false (expand panel not used in these sets)
 *   valueTypes       {string[]}  format options e.g. ['System','Custom']
 *   newVarDefaults   {Object}    default fields for new variables
 *   renderPreviewCell {Function} (v) → HTML string, or null if no preview col
 *   renderValueCell   {Function} (v) → HTML string (value input + format sel)
 *
 * Differs from Colors (atfrfo-colors.js):
 *   — No expand panel
 *   — Grid omits the preview column for Numbers (6 cols vs 7 for Fonts)
 *   — Category state stored in ATFRFO.state.config[catKey] not config.categories
 *   — Category AJAX endpoints receive a subgroup param
 *   — Value cell rendering delegated to cfg.renderValueCell(v)
 *
 *
 * @package ElementorFrameworkForge
 * @version 1.0.0
 */

(function () {
	'use strict';

	window.ATFRFO= window.ATFRFO|| {};

	// -----------------------------------------------------------------------
	// FACTORY
	// -----------------------------------------------------------------------

	ATFRFO.Variables = {

		/** Registry of live instances keyed by setName. */
		_sets: {},

		/**
		 * Create and wire one variable-set instance.
		 *
		 * Patches ATFRFO.EditSpace.loadCategory to intercept calls for this
		 * subgroup, and binds the undo/redo keyboard handler.
		 *
		 * @param {Object} cfg Per-set configuration object (see file header).
		 */
		initSet: function (cfg) {
			var inst = Object.create(ATFRFO.Variables._proto);
			inst._cfg          = cfg;
			inst._undoStack    = [];
			inst._redoStack    = [];
			inst._collapsedIds = {};
			inst._focusedCatId = null;
			inst._catSortState = {};
			inst._drag         = {
				active: false, varId: null, ghost: null,
				indicator: null, startY: 0, scrollTimer: null,
				_dropTargetId: null, _dropAbove: null,
				_expandedCatBlock: null,
			};

			ATFRFO.Variables._sets[cfg.setName] = inst;

			// Intercept ATFRFO.EditSpace.loadCategory for this subgroup.
			var _prevLoad = ATFRFO.EditSpace.loadCategory.bind(ATFRFO.EditSpace);
			ATFRFO.EditSpace.loadCategory = function (selection) {
				if (selection && selection.subgroup === cfg.setName) {
					inst.loadVars(selection);
				} else {
					_prevLoad(selection);
				}
			};

			// Keyboard undo/redo — active only when this set is current.
			document.addEventListener('keydown', function (e) {
				if (!e.ctrlKey && !e.metaKey) { return; }
				var sel = ATFRFO.state.currentSelection;
				if (!sel || sel.subgroup !== cfg.setName) { return; }
				if (e.key === 'z' || e.key === 'Z') {
					e.preventDefault();
					inst.undo();
				} else if (e.key === 'y' || e.key === 'Y') {
					e.preventDefault();
					inst.redo();
				}
			});
		},
	};

	// -----------------------------------------------------------------------
	// SHARED PROTOTYPE
	// -----------------------------------------------------------------------

	ATFRFO.Variables._proto = {

		// -------------------------------------------------------------------
		// ENTRY POINT
		// -------------------------------------------------------------------

		/**
		 * Called by the overridden ATFRFO.EditSpace.loadCategory.
		 *
		 * @param {{ group:string, subgroup:string, category:string, categoryId:string }} selection
		 */
		loadVars: function (selection) {
			var self        = this;
			var placeholder = document.getElementById('atfrfo-placeholder');
			var content     = document.getElementById('atfrfo-edit-content');
			var workspace   = document.getElementById('atfrfo-workspace');
			if (!content) { return; }

			// Determine focused category from the nav click.
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

			// Reset manual collapse state when navigating to a specific category.
			if (self._focusedCatId) {
				self._collapsedIds = {};
			}

			if (workspace)   { workspace.setAttribute('data-active', 'true'); }
			if (placeholder) { placeholder.style.display = 'none'; }

			content.removeAttribute('hidden');
			content.style.display = '';

			self._ensureUncategorized();
			self._renderAll(selection, content);
		},

		// -------------------------------------------------------------------
		// RENDER
		// -------------------------------------------------------------------

		/**
		 * Build and inject the full variable-set view into the content element.
		 *
		 * @param {Object}      selection
		 * @param {HTMLElement} container
		 */
		_renderAll: function (selection, container) {
			var self       = this;
			var cfg        = self._cfg;
			var setLower   = cfg.setName.toLowerCase();
			var categories   = self._getCatsForSet();
			var topLevelCats = categories.filter(function (c) { return !c.parent_id; });

			// Determine initial collapse-toggle state for the ⊞/⊟ button.
			// Only top-level cats participate — sub-cats render inside their parents.
			var _anyExpanded = false;
			for (var _ti = 0; _ti < topLevelCats.length; _ti++) {
				var _tc           = topLevelCats[_ti];
				var _subtreeCount = self._getSubtreeVarCount(_tc.id, categories);
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

			var html = '<div class="atfrfo-' + setLower + '-view">';

			// ---- Sticky header wrapper ----
			html += '<div class="atfrfo-group-sticky-header">';

			// ---- Filter bar ----
			html += '<div class="atfrfo-colors-filter-bar atfrfo-' + setLower + '-filter-bar">'
				+ '<div class="atfrfo-filter-bar-top">'
				+ '<span class="atfrfo-filter-bar-set-name">' + ATFRFO.Utils.escAttr(cfg.setName) + '</span>'
				+ '<span style="flex:1"></span>'
				+ '<input type="text" class="atfrfo-colors-search atfrfo-' + setLower + '-search"'
				+ ' id="atfrfo-' + setLower + '-search"'
				+ ' placeholder="Search\u2026"'
				+ ' aria-label="Search ' + setLower + ' variables">'
				+ '<button class="atfrfo-icon-btn atfrfo-colors-back-btn"'
				+ ' id="atfrfo-' + setLower + '-back"'
				+ ' data-atfrfo-tooltip="Back to sets"'
				+ ' aria-label="Back to sets">'
				+ ATFRFO.Icons.homeSVG()
				+ '</button>'
				+ '<button class="atfrfo-icon-btn"'
				+ ' id="atfrfo-' + setLower + '-collapse-toggle"'
				+ ' title="' + _toggleTitle + '" aria-label="' + _toggleTitle + '"'
				+ ' data-toggle-state="' + _toggleState + '"'
				+ ' data-atfrfo-tooltip="' + _toggleTitle + '">'
				+ _toggleSVG
				+ '</button>'
				+ '</div>'
				+ '<div class="atfrfo-filter-bar-add-cat-wrap">'
				+ '<button class="atfrfo-icon-btn atfrfo-' + setLower + '-add-cat-btn"'
				+ ' id="atfrfo-' + setLower + '-add-category"'
				+ ' data-atfrfo-tooltip="Add category"'
				+ ' aria-label="Add category">'
				+ ATFRFO.Icons.plusSVG()
				+ '</button>'
				+ '</div>'
				+ '</div>'; // filter bar

			// ---- Status legend ----
			html += '<div class="atfrfo-status-legend">'
				+ '<span class="atfrfo-legend-item"><span class="atfrfo-legend-dot" style="background:var(--atfrfo-status-synced)"></span>Synced</span>'
				+ '<span class="atfrfo-legend-item"><span class="atfrfo-legend-dot" style="background:var(--atfrfo-status-modified)"></span>Modified</span>'
				+ '<span class="atfrfo-legend-item"><span class="atfrfo-legend-dot" style="background:var(--atfrfo-status-new)"></span>New</span>'
				+ '<span class="atfrfo-legend-item"><span class="atfrfo-legend-dot" style="background:var(--atfrfo-status-orphaned)"></span>Orphaned</span>'
				+ '<span class="atfrfo-legend-item"><span class="atfrfo-legend-dot" style="background:var(--atfrfo-status-conflict)"></span>Conflict</span>'
				+ '</div>';

			html += '</div>'; // .atfrfo-group-sticky-header

			// ---- Category blocks ----
			if (topLevelCats.length === 0) {
				html += '<p class="atfrfo-colors-empty">No categories found. Click + to add one.</p>';
			} else {
				for (var i = 0; i < topLevelCats.length; i++) {
					html += self._buildCategoryBlock(topLevelCats[i], i, topLevelCats.length, 0, categories);
				}
			}

			html += '</div>'; // .atfrfo-{set}-view

			container.innerHTML = html;
			self._bindEvents(container);
			if (cfg.renderPreviewCell && ATFRFO.Utils.loadFontPreviews) {
				ATFRFO.Utils.loadFontPreviews(container);
			}

			if (self._focusedCatId) {
				self._jumpToCategory(self._focusedCatId, container);
			}
		},

		/**
		 * Build one category block (header + variable list + add-var button).
		 *
		 * @param {Object} cat
		 * @param {number} catIndex
		 * @param {number} catTotal
		 * @returns {string}
		 */
		_buildCategoryBlock: function (cat, catIndex, catTotal, depth, allCats) {
			var self         = this;
			depth            = depth   || 0;
			allCats          = allCats || self._getCatsForSet();
			var vars         = self._getVarsForCategory(cat);
			var directCount  = vars.length;
			var subtreeCount = (depth === 0) ? self._getSubtreeVarCount(cat.id, allCats) : directCount;

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

			// Category header
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
				+ '</div>' // .atfrfo-cat-header-left
				+ '<div class="atfrfo-category-actions" role="toolbar" aria-label="Category actions">'
				+ (!cat.locked && depth === 0 ? ATFRFO.Icons.catBtn('add-sub-cat', 'Add sub-category', ATFRFO.Icons.plusCircleSVG(), '') : '')
				+ ATFRFO.Icons.catBtn('clear-cat', 'Clear category contents', ATFRFO.Icons.broomSVG(), 'atfrfo-icon-btn--warning')
				+ ATFRFO.Icons.catBtn('duplicate', 'Duplicate category', ATFRFO.Icons.duplicateSVG(), '')
				+ (cat.locked ? '' : ATFRFO.Icons.catBtn('delete', 'Delete category', ATFRFO.Icons.trashSVG(), 'atfrfo-icon-btn--danger'))
				+ ATFRFO.Icons.catBtn('collapse', 'Collapse/expand category', ATFRFO.Icons.chevronSVG(), 'atfrfo-category-collapse-btn')
				+ '</div>' // .atfrfo-category-actions
				+ '</div>' // .atfrfo-cat-header-top
				+ '</div>'; // .atfrfo-category-header

			// Sub-category blocks — one level deep (top-level cats only)
			if (depth === 0) {
				var subs = self._getSubCategoriesOf(cat.id, allCats);
				for (var si = 0; si < subs.length; si++) {
					html += self._buildCategoryBlock(subs[si], si, subs.length, depth + 1, allCats);
				}
			}

			// Column sort header — same grid as variable rows.
			// Fonts has preview col (col3), Numbers does not; adjust empty spans accordingly.
			var _ns = (self._catSortState[cat.id] && self._catSortState[cat.id].field === 'name')  ? self._catSortState[cat.id].dir : 'none';
			var _vs = (self._catSortState[cat.id] && self._catSortState[cat.id].field === 'value') ? self._catSortState[cat.id].dir : 'none';
			html += '<div class="atfrfo-color-list-header" data-cat-id="' + ATFRFO.Utils.escAttr(cat.id) + '">'
				+ '<span></span>'  // col1: drag
				+ '<span></span>'; // col2: status dot
			if (self._cfg.renderPreviewCell) {
				// Fonts: preview is col3, name is col4
				html += '<span></span>'; // col3: preview
			}
			// Name sort (col4 for Fonts, col3 for Numbers)
			html += '<span class="atfrfo-col-sort-wrap">'
				+ '<button class="atfrfo-col-sort-btn" data-sort-col="name" data-cat-id="' + ATFRFO.Utils.escAttr(cat.id) + '" data-sort-dir="' + _ns + '"'
				+ ' title="Sort by name" aria-label="Sort by name"'
				+ ' data-atfrfo-tooltip="Sort by name">'
				+ ATFRFO.Icons.sortBtnSVG(_ns)
				+ '</button>'
				+ '</span>';
			// Notes (col5 for Fonts, col4 for Numbers) — no sort
			html += '<span></span>';
			// Value sort (col6 for Fonts, col5 for Numbers)
			html += '<span class="atfrfo-col-sort-wrap">'
				+ '<button class="atfrfo-col-sort-btn" data-sort-col="value" data-cat-id="' + ATFRFO.Utils.escAttr(cat.id) + '" data-sort-dir="' + _vs + '"'
				+ ' title="Sort by value" aria-label="Sort by value"'
				+ ' data-atfrfo-tooltip="Sort by value">'
				+ ATFRFO.Icons.sortBtnSVG(_vs)
				+ '</button>'
				+ '</span>'
				+ '</div>'; // .atfrfo-color-list-header

			// Variable rows
			html += '<div class="atfrfo-color-list">';
			var _hasSubs = depth === 0 && self._getSubCategoriesOf(cat.id, allCats).length > 0;
			if (directCount === 0 && !_hasSubs) {
				html += '<p class="atfrfo-colors-empty">No variables in this category.</p>';
			} else {
				for (var i = 0; i < vars.length; i++) {
					html += self._buildVariableRow(vars[i]);
				}
			}
			html += '</div>'; // .atfrfo-color-list

			html += '</div>'; // .atfrfo-category-inner

			// Add-variable button: circle on bottom-left edge of category block.
			var addLabel = 'Add variable to ' + cat.name;
			html += '<div class="atfrfo-cat-add-btn-wrap">'
				+ '<button class="atfrfo-icon-btn atfrfo-add-var-btn" data-action="add-var"'
				+ ' data-cat-id="' + ATFRFO.Utils.escAttr(cat.id) + '"'
				+ ' aria-label="' + ATFRFO.Utils.escAttr(addLabel) + '"'
				+ ' data-atfrfo-tooltip="Add ' + ATFRFO.Utils.escAttr(self._cfg.setName) + '"'
				+ ' data-atfrfo-tooltip-long="Add a new ' + ATFRFO.Utils.escAttr(self._cfg.setName.toLowerCase())
				+ ' variable to this category">'
				+ ATFRFO.Icons.plusSVG()
				+ '</button>'
				+ '</div>';

			html += '</div>'; // .atfrfo-category-block
			return html;
		},

		/**
		 * Build a single variable row.
		 *
		 * Grid layout:
		 *   Fonts:   drag | dot | preview | name | notes | value | format | delete | empty (9 cols)
		 *   Numbers: drag | dot | name | notes | value | format | delete | empty (8 cols)
		 *
		 * @param {Object} v Variable object.
		 * @returns {string}
		 */
		_buildVariableRow: function (v) {
			var self   = this;
			var cfg    = self._cfg;
			var status = v.status || 'synced';
			var rowKey = ATFRFO.Utils.rowKey(v);

			var html = '<div class="atfrfo-color-row" data-var-id="' + ATFRFO.Utils.escAttr(rowKey) + '">'

				// Col 1: drag handle (24px)
				+ '<div class="atfrfo-drag-handle" data-action="drag-handle" draggable="false"'
				+ ' aria-label="Drag to reorder" data-atfrfo-tooltip="Drag to reorder">'
				+ ATFRFO.Icons.sixDotSVG()
				+ '</div>'

				// Col 2: status dot (8px circle)
				+ '<span class="atfrfo-status-dot"'
				+ ' style="background:' + ATFRFO.Utils.statusColor(status) + '"'
				+ ' data-atfrfo-tooltip="' + ATFRFO.Utils.escAttr(status.charAt(0).toUpperCase() + status.slice(1)) + '"'
				+ ' data-atfrfo-tooltip-long="' + ATFRFO.Utils.escAttr(ATFRFO.Utils.statusLongTooltip(status)) + '"'
				+ ' aria-label="Status: ' + ATFRFO.Utils.escAttr(status) + '">'
				+ '</span>';

			// Col 3 (optional): preview cell — Fonts only.
			if (cfg.renderPreviewCell) {
				html += cfg.renderPreviewCell.call(cfg, v);
			}

			// Name input (read-only by default; single-click activates).
			html += '<input type="text" class="atfrfo-var-name-input"'
				+ ' value="' + ATFRFO.Utils.escAttr(v.name) + '"'
				+ ' data-original="' + ATFRFO.Utils.escAttr(v.name) + '"'
				+ ' readonly'
				+ ' aria-label="Variable name"'
				+ ' data-atfrfo-tooltip="Variable name \u2014 click to edit"'
				+ ' spellcheck="false">';

				// Notes input (read-only by default; single-click activates; select-all on entry).
				html += '<input type="text" class="atfrfo-var-notes-input"'
					+ ' value="' + ATFRFO.Utils.escAttr(v.notes || '') + '"'
					+ ' data-original="' + ATFRFO.Utils.escAttr(v.notes || '') + '"'
					+ ' readonly'
					+ ' placeholder="Comment"'
					+ ' aria-label="Variable note"'
					+ ' data-atfrfo-tooltip="Variable note — click to edit"'
					+ ' spellcheck="false">';

			// Value input + format selector — delegated to per-set config.
			html += cfg.renderValueCell.call(cfg, v);

			// Delete button (last column, 28px, hidden until row hover).
			html += '<button class="atfrfo-icon-btn atfrfo-var-delete-btn" data-action="delete-var"'
				+ ' data-var-id="' + ATFRFO.Utils.escAttr(rowKey) + '"'
				+ ' aria-label="Delete variable"'
				+ ' data-atfrfo-tooltip="Delete variable"'
				+ ' data-atfrfo-tooltip-long="Remove this variable from the project">&#x1F5D1;</button>';

			html += '</div>'; // .atfrfo-color-row
			return html;
		},

		// -------------------------------------------------------------------
		// EVENT BINDING
		// -------------------------------------------------------------------

		/**
		 * Bind all interactive events to the container.
		 *
		 * Non-delegated listeners (back, toggle, add-cat, search) are bound
		 * fresh on every render because the buttons are inside innerHTML and
		 * may not exist until after render.
		 *
		 * Delegated listeners (click, mousedown, focusout, keydown, change,
		 * input) are bound once and guarded by _effVarsEventsBound to prevent
		 * accumulation across re-renders.
		 *
		 * @param {HTMLElement} container
		 */
		_bindEvents: function (container) {
			var self     = this;
			var setLower = self._cfg.setName.toLowerCase();

			// Back / close
			var backBtn = container.querySelector('#atfrfo-' + setLower + '-back');
			if (backBtn) {
				backBtn.addEventListener('click', function () {
					self._closeView();
				});
			}

			// Collapse / expand all
			var toggleBtn = container.querySelector('#atfrfo-' + setLower + '-collapse-toggle');
			if (toggleBtn) {
				toggleBtn.addEventListener('click', function () {
					var state    = toggleBtn.getAttribute('data-toggle-state');
					var collapse = (state !== 'collapsed');
					self._setAllCollapsed(container, collapse);
				});
			}

			// Add category
			var addCatBtn = container.querySelector('#atfrfo-' + setLower + '-add-category');
			if (addCatBtn) {
				addCatBtn.addEventListener('click', function () {
					self._addCategory();
				});
			}

			// Search / filter
			var searchInput = container.querySelector('#atfrfo-' + setLower + '-search');
			if (searchInput) {
				searchInput.addEventListener('input', function () {
					self._filterRows(container, searchInput.value.trim().toLowerCase());
				});
			}

			// ---- Delegated events — bound only once per container, per set ----
			// Each set (Fonts, Numbers) needs its own flag so the second set to load
			// doesn't skip binding because the first set already set the shared flag.
			var _boundFlag = '_effVarsEventsBound_' + setLower;
			if (container[_boundFlag]) { return; }
			container[_boundFlag] = true;

			self._initDrag(container);
			self._initCatDrag(container);

			// ---- Click delegation ----
			container.addEventListener('click', function (e) {
				// Bail if this module's view is not currently active in this container.
				if (!container.querySelector('.atfrfo-' + setLower + '-view')) { return; }
				var btn    = e.target.closest('[data-action]');
				if (!btn) { return; }
				var action = btn.getAttribute('data-action');
				var block  = btn.closest('.atfrfo-category-block');
				var catId  = block ? block.getAttribute('data-category-id') : null;

				switch (action) {
					case 'add-sub-cat': if (catId) { self._addSubCategory(catId); }    break;
					case 'clear-cat':   if (catId) { self._clearCategory(catId); }     break;
					case 'duplicate':   if (catId) { self._duplicateCategory(catId); } break;
					case 'add-var':     if (catId) { self._addVariable(catId); }       break;
					case 'delete':      if (catId) { self._deleteCategory(catId); }    break;

					case 'delete-var': {
						var varId = btn.getAttribute('data-var-id');
						if (varId) { self._deleteVariable(varId); }
						break;
					}

					case 'collapse':
						if (block && catId) {
							var isColl = block.getAttribute('data-collapsed') === 'true';
							block.setAttribute('data-collapsed', String(!isColl));
							self._collapsedIds[catId] = !isColl;
							if (!isColl) {
								// Cascade collapse to sub-categories.
								var _subBlocks = block.querySelectorAll('.atfrfo-category-block[data-depth="1"]');
								for (var _sbi = 0; _sbi < _subBlocks.length; _sbi++) {
									var _sb = _subBlocks[_sbi];
									var _sbId = _sb.getAttribute('data-category-id');
									_sb.setAttribute('data-collapsed', 'true');
									if (_sbId) { self._collapsedIds[_sbId] = true; }
								}
							} else {
								block.scrollIntoView({ behavior: 'smooth', block: 'start' });
							}
						}
						break;
				}
			});

			// ---- Column sort buttons (in .atfrfo-color-list-header) ----
			container.addEventListener('click', function (e) {
				var sortBtn = e.target.closest('.atfrfo-col-sort-btn');
				if (!sortBtn) { return; }
				var sCatId  = sortBtn.getAttribute('data-cat-id');
				var sCol    = sortBtn.getAttribute('data-sort-col');
				var sDir    = sortBtn.getAttribute('data-sort-dir');
				var nextDir = sDir === 'none' ? 'asc' : (sDir === 'asc' ? 'desc' : 'none');
				self._catSortState[sCatId] = { field: sCol, dir: nextDir };
				self._sortVarsInCategory(sCatId, sCol, nextDir, container);
			});

			// ---- Single-click to activate editing ----
			container.addEventListener('mousedown', function (e) {
				var input = e.target.closest('.atfrfo-var-name-input, .atfrfo-var-notes-input, .atfrfo-category-name-input');
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
				var nameInput = e.target.closest('.atfrfo-var-name-input');
				if (nameInput) { nameInput.setAttribute('readonly', ''); return; }

				var notesInput = e.target.closest('.atfrfo-var-notes-input');
				if (notesInput) {
					notesInput.setAttribute('readonly', '');
					var nRow = notesInput.closest('.atfrfo-color-row');
					var nId  = nRow ? nRow.getAttribute('data-var-id') : null;
					if (nId !== null) { self._saveVarNote(nId, notesInput); }
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
				if (!catInput) { return; }
				if (e.key === 'Enter') {
					e.preventDefault();
					catInput.blur();
				} else if (e.key === 'Escape') {
					catInput.textContent = catInput.getAttribute('data-original') || '';
					catInput.setAttribute('contenteditable', 'false');
					catInput.blur();
				}
			});

			// ---- Variable name: save on change / Enter ----
			container.addEventListener('change', function (e) {
				var nameInput = e.target.closest('.atfrfo-var-name-input');
				if (!nameInput) { return; }
				var row   = nameInput.closest('.atfrfo-color-row');
				var varId = row ? row.getAttribute('data-var-id') : null;
				if (varId !== null) { self._saveVarName(varId, nameInput); }
			});

			// ---- Variable notes: save on change / Enter / Escape ----
			container.addEventListener('change', function (e) {
				var notesInput = e.target.closest('.atfrfo-var-notes-input');
				if (!notesInput) { return; }
				var nRow = notesInput.closest('.atfrfo-color-row');
				var nId  = nRow ? nRow.getAttribute('data-var-id') : null;
				if (nId !== null) { self._saveVarNote(nId, notesInput); }
			});
			container.addEventListener('keydown', function (e) {
				if (e.key === 'Enter') {
					var notesEnter = e.target.closest('.atfrfo-var-notes-input');
					if (notesEnter && notesEnter.hasAttribute('readonly')) {
						e.preventDefault();
						notesEnter.removeAttribute('readonly');
						setTimeout(function () { notesEnter.focus(); notesEnter.select(); }, 0);
						return;
					} else if (notesEnter) {
						e.preventDefault(); notesEnter.blur(); return;
					}
				}
				if (e.key === 'Escape') {
					var notesEsc = e.target.closest('.atfrfo-var-notes-input');
					if (notesEsc && !notesEsc.hasAttribute('readonly')) {
						e.preventDefault();
						notesEsc.value = notesEsc.getAttribute('data-original') || '';
						notesEsc.blur(); return;
					}
				}
			});
			container.addEventListener('keydown', function (e) {
				if (e.key !== 'Enter') { return; }
				var nameInput = e.target.closest('.atfrfo-var-name-input');
				if (!nameInput) { return; }
				nameInput.blur();
			});

			// ---- Value input: live preview for Fonts ----
			container.addEventListener('input', function (e) {
				var valInput = e.target.closest('.atfrfo-var-value-input');
				if (!valInput) { return; }
				if (self._cfg.setName === 'Fonts') {
					valInput.style.fontFamily = valInput.value;
					var row     = valInput.closest('.atfrfo-color-row');
					var preview = row ? row.querySelector('.atfrfo-font-preview') : null;
					if (preview) { preview.style.fontFamily = valInput.value; }
				}
			});

			// ---- Value input: save on change / Enter ----
			container.addEventListener('change', function (e) {
				var valInput = e.target.closest('.atfrfo-var-value-input');
				if (!valInput) { return; }
				var row   = valInput.closest('.atfrfo-color-row');
				var varId = row ? row.getAttribute('data-var-id') : null;
				if (varId === null) { return; }
				var newVal = valInput.value.trim();
				if (!newVal) {
					valInput.value = valInput.getAttribute('data-original') || '';
					ATFRFO.Utils.showFieldError(valInput, 'Value must not be empty.');
					return;
				}
				ATFRFO.Utils.clearFieldError(valInput);

				// Numbers: parse autofill suffix and optional format change.
				if (self._cfg.setName === 'Numbers') {
					var parsed = self._parseNumberInput(newVal, varId, valInput);
					if (parsed === null) { return; } // invalid suffix — error shown, save blocked
					newVal = parsed.value;
					valInput.value = newVal; // update display to stripped value
					if (parsed.format) {
						var fmtSel = row.querySelector('.atfrfo-var-format-sel');
						if (fmtSel) { fmtSel.value = parsed.format; }
						self._saveVarValue(varId, newVal, valInput, parsed.format);
						return;
					}
				}

				self._saveVarValue(varId, newVal, valInput);
			});
			container.addEventListener('keydown', function (e) {
				if (e.key !== 'Enter') { return; }
				var valInput = e.target.closest('.atfrfo-var-value-input');
				if (!valInput) { return; }
				valInput.blur();
			});

			// ---- Format selector: save on change ----
			container.addEventListener('change', function (e) {
				var fmtSel = e.target.closest('.atfrfo-var-format-sel');
				if (!fmtSel) { return; }
				var row   = fmtSel.closest('.atfrfo-color-row');
				var varId = row ? row.getAttribute('data-var-id') : null;
				if (varId !== null) { self._saveVarFormat(varId, fmtSel.value); }
			});
		},

		// -------------------------------------------------------------------
		// COLLAPSE / EXPAND
		// -------------------------------------------------------------------

		/**
		 * Collapse or expand all categories at once.
		 *
		 * @param {HTMLElement} container
		 * @param {boolean}     collapse True to collapse, false to expand.
		 */
		_setAllCollapsed: function (container, collapse) {
			var self   = this;
			var blocks = container.querySelectorAll('.atfrfo-category-block');
			for (var i = 0; i < blocks.length; i++) {
				var block = blocks[i];
				var catId = block.getAttribute('data-category-id');
				block.setAttribute('data-collapsed', String(collapse));
				if (catId) { self._collapsedIds[catId] = collapse; }
			}
			var toggleBtn = container.querySelector('[data-toggle-state]');
			if (toggleBtn) {
				var newTitle = collapse ? 'Expand all categories' : 'Collapse all categories';
				toggleBtn.setAttribute('data-toggle-state', collapse ? 'collapsed' : 'expanded');
				toggleBtn.setAttribute('aria-label', newTitle);
				toggleBtn.setAttribute('data-atfrfo-tooltip', newTitle);
				toggleBtn.innerHTML = collapse ? ATFRFO.Icons.expandAllSVG() : ATFRFO.Icons.collapseAllSVG();
			}
		},

		// -------------------------------------------------------------------
		// CLOSE VIEW
		// -------------------------------------------------------------------

		/** Close this set's view and restore the placeholder state. */
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
		// UNDO / REDO
		// -------------------------------------------------------------------

		/** @param {{ type:string, id:string, oldValue:string, newValue:string }} op */
		_pushUndo: function (op) {
			this._undoStack.push(op);
			if (this._undoStack.length > 50) { this._undoStack.shift(); }
			this._redoStack = [];
		},

		undo: function () {
			var op = this._undoStack.pop();
			if (!op) { return; }
			this._redoStack.push(op);
			this._applyUndoRedo(op, true);
		},

		redo: function () {
			var op = this._redoStack.pop();
			if (!op) { return; }
			this._undoStack.push(op);
			this._applyUndoRedo(op, false);
		},

		/**
		 * @param {Object}  op     Undo/redo operation.
		 * @param {boolean} isUndo True = undo, false = redo.
		 */
		_applyUndoRedo: function (op, isUndo) {
			var self  = this;
			var v     = self._findVarById(op.id);
			if (!v) { return; }
			var value = isUndo ? op.oldValue : op.newValue;

			if (op.type === 'name-change') {
				v.name = value;
				self._ajaxSaveVar({ id: v.id, name: value }, function () {
					if (ATFRFO.App) { ATFRFO.App.setDirty(true); }
					self._rerenderView();
				});
			} else if (op.type === 'value-change') {
				v.value = value;
				self._ajaxSaveVar({ id: v.id, value: value }, function () {
					if (ATFRFO.App) { ATFRFO.App.setDirty(true); }
					self._rerenderView();
				});
			}
		},

		// -------------------------------------------------------------------
		// VARIABLE INLINE EDIT — SAVE
		// -------------------------------------------------------------------

		/**
		 * Validate and persist a name change.
		 *
		 * @param {string}      varId
		 * @param {HTMLElement} nameInput
		 */
		_saveVarName: function (varId, nameInput) {
			var self    = this;
			var newName = nameInput.value.trim();
			var oldName = nameInput.getAttribute('data-original') || '';
			if (newName === oldName) { return; }

			if (!/^[A-Za-z0-9_-]+$/.test(newName)) {
				nameInput.value = oldName;
				ATFRFO.Utils.showFieldError(nameInput,
					'Name may only contain letters, digits, hyphens, and underscores.');
				return;
			}

			var duplicate = ATFRFO.state.variables.some(function (v) {
				return v.name.toLowerCase() === newName.toLowerCase() && String(v.id) !== String(varId);
			});
			if (duplicate) {
				nameInput.value = oldName;
				ATFRFO.Utils.showFieldError(nameInput, 'A variable with that name already exists.');
				return;
			}

			var v = ATFRFO.Utils.findVarByKey(varId);
			if (!v) { return; }

			v.status = 'modified';
			self._updateStatusDotInDOM(varId, 'modified');
			self._pushUndo({ type: 'name-change', id: v.id, oldValue: oldName, newValue: newName });

			self._ajaxSaveVar({
				id:                  v.id,
				name:                newName,
				pending_rename_from: oldName,
				status:              'modified',
			}, function () {
				nameInput.setAttribute('data-original', newName);
				if (ATFRFO.App) { ATFRFO.App.setDirty(true); ATFRFO.App.setPendingCommit(true); }
			});
		},

		/**
		 * Parse a raw Numbers value input string.
		 *
		 * Strips a recognised type-indicator suffix and returns the pure number plus
		 * the inferred format. Returns null if the suffix is unrecognised (and shows
		 * a field error). Returns { value, format: null } when no suffix is present
		 * (caller should keep the current format unchanged).
		 *
		 * Recognised suffixes (case-insensitive, except pc/PC):
		 *   px → PX   |  e/em → EM   |  r/rem → REM
		 *   pc/PC → % |  vw → VW     |  vh → VH   |  ch → CH   |  % → %
		 * Function expressions (contain '(' and/or ')') → FX, stored as-is.
		 *
		 * @param {string}      raw   Trimmed input value.
		 * @param {string}      varId Row key (for _findVarByKey).
		 * @param {HTMLElement} input The <input> element (for error display).
		 * @returns {{ value: string, format: string|null }|null}
		 */
		_parseNumberInput: function (raw, varId, input) {
			var self = this;

			// FX: any expression containing '(' is a function.
			if (raw.indexOf('(') !== -1) {
				var val = raw.indexOf(')') === -1 ? raw + ')' : raw; // autocomplete ')'
				return { value: val, format: 'FX' };
			}

			// Split into numeric part + trailing suffix.
			var m = raw.match(/^(-?[\d.]+)(.*?)$/);
			if (!m) {
				ATFRFO.Utils.showFieldError(input, 'invalid type');
				return null;
			}

			var numPart   = m[1];
			var suffixRaw = m[2].trim();
			var suffixLc  = suffixRaw.toLowerCase();
			var format    = null; // null → keep current format

			if (suffixLc === '') {
				format = null; // no suffix — keep current format
			} else if (suffixLc === 'px' || suffixLc === 'x') {
				format = 'PX';
			} else if (suffixLc === 'e' || suffixLc === 'em') {
				format = 'EM';
			} else if (suffixLc === 'r' || suffixLc === 'rem') {
				format = 'REM';
			} else if (suffixRaw === 'pc' || suffixRaw === 'PC' || suffixLc === '%') {
				format = '%';
			} else if (suffixLc === 'vw') {
				format = 'VW';
			} else if (suffixLc === 'vh') {
				format = 'VH';
			} else if (suffixLc === 'ch') {
				format = 'CH';
			} else {
				ATFRFO.Utils.showFieldError(input, 'invalid type');
				return null;
			}

			return { value: numPart, format: format };
		},

		/**
		 * Save a variable's note after editing.
		 *
		 * @param {string}      varId      Variable ID.
		 * @param {HTMLElement} noteInput  The notes <input> element.
		 */
		_saveVarNote: function (varId, noteInput) {
			var self    = this;
			var newNote = noteInput.value.trim();
			var oldNote = noteInput.getAttribute('data-original') || '';
			if (newNote === oldNote) { return; }
			var v = ATFRFO.Utils.findVarByKey(varId);
			if (!v) { return; }
			v.notes = newNote;
			self._ajaxSaveVar({ id: v.id, notes: newNote }, function () {
				noteInput.setAttribute('data-original', newNote);
				if (ATFRFO.App) { ATFRFO.App.setDirty(true); }
			});
		},

		_saveVarValue: function (varId, newValue, input, newFormat) {
			var self     = this;
			var v        = ATFRFO.Utils.findVarByKey(varId);
			if (!v) { return; }
			var oldValue = v.value || '';
			if (newValue === oldValue && !newFormat) { return; }

			v.value  = newValue;
			v.status = 'modified';
			if (newFormat) { v.format = newFormat; }
			self._updateStatusDotInDOM(varId, 'modified');

			// For Fonts: update the preview cell and value input's inline style.
			if (self._cfg.setName === 'Fonts') {
				var content = document.getElementById('atfrfo-edit-content');
				if (content) {
					var listRow = content.querySelector('.atfrfo-color-row[data-var-id="' + ATFRFO.Utils.escAttr(varId) + '"]');
					if (listRow) {
						var preview = listRow.querySelector('.atfrfo-font-preview');
						if (preview) { preview.style.fontFamily = newValue; }
						var valInp  = listRow.querySelector('.atfrfo-var-value-input');
						if (valInp)  { valInp.style.fontFamily  = newValue; }
					}
				}
			}

			self._pushUndo({ type: 'value-change', id: v.id, oldValue: oldValue, newValue: newValue });

			var payload = { id: v.id, value: newValue, status: 'modified' };
			if (newFormat) { payload.format = newFormat; }
			self._ajaxSaveVar(payload, function () {
				if (input) { input.setAttribute('data-original', newValue); }
				if (ATFRFO.App) { ATFRFO.App.setDirty(true); ATFRFO.App.setPendingCommit(true); }
			});
		},

		/**
		 * Persist a format change.
		 *
		 * @param {string} varId
		 * @param {string} newFormat
		 */
		_saveVarFormat: function (varId, newFormat) {
			var self = this;
			var v    = ATFRFO.Utils.findVarByKey(varId);
			if (!v) { return; }
			v.format = newFormat;
			v.status = 'modified';
			self._ajaxSaveVar({ id: v.id, format: newFormat, status: 'modified' }, function () {
				if (ATFRFO.App) { ATFRFO.App.setDirty(true); ATFRFO.App.setPendingCommit(true); }
			});
		},

		// -------------------------------------------------------------------
		// ADD / DELETE VARIABLE
		// -------------------------------------------------------------------

		/**
		 * Add a new blank variable to a category.
		 *
		 * @param {string} catId Category ID.
		 */
		_addVariable: function (catId) {
			var self = this;
			var cfg  = self._cfg;
			var cats = self._getCatsForSet();
			var cat  = null;
			for (var i = 0; i < cats.length; i++) {
				if (cats[i].id === catId) { cat = cats[i]; break; }
			}

			if (!ATFRFO.state.currentFile) {
				self._noFileModal();
				return;
			}

			var defaults = cfg.newVarDefaults || {};
			// Derive type from setName: 'Fonts' → 'font', 'Numbers' → 'number'
			var varType  = cfg.setName.toLowerCase().replace(/s$/, '');

			// Generate a unique default name if the base name is already taken.
			var _baseName = defaults.name || 'new-var';
			var _newName  = _baseName;
			var _nameIdx  = 1;
			var _existing = (ATFRFO.state.variables || []).map(function (v) { return (v.name || '').toLowerCase(); });
			while (_existing.indexOf(_newName.toLowerCase()) !== -1) {
				_newName = _baseName + '-' + _nameIdx;
				_nameIdx++;
			}

			var newVar = {
				name:        _newName,
				value:       defaults.value  || '',
				type:        varType,
				subgroup:    cfg.setName,
				category:    cat ? cat.name : '',
				category_id: catId,
				format:      (ATFRFO.state.settings && ATFRFO.state.settings[cfg.setName.toLowerCase() + '_default_type']) || defaults.format || '',
				status:      'new',
			};

			ATFRFO.App.ajax('atfrfo_save_color', {
				filename: ATFRFO.state.currentFile,
				variable: JSON.stringify(newVar),
			}).then(function (res) {
				if (res.success && res.data && res.data.data) {
					ATFRFO.state.variables = res.data.data.variables || ATFRFO.state.variables;
					if (ATFRFO.App) {
						ATFRFO.App.setDirty(true);
						ATFRFO.App.setPendingCommit(true);
						ATFRFO.App.refreshCounts();
					}
					self._collapsedIds[catId] = false;
					self._rerenderView();

					// Find the new row and activate its name input for immediate editing.
					// Use _rowKey so unsaved variables (no id yet) are found correctly.
					var content = document.getElementById('atfrfo-edit-content');
					if (content) {
						var newVarObj = null;
						var vars = ATFRFO.state.variables;
						for (var j = 0; j < vars.length; j++) {
							if (vars[j].name === _newName) { newVarObj = vars[j]; break; }
						}
						if (newVarObj) {
							var rowKey  = ATFRFO.Utils.rowKey(newVarObj);
							var newRow  = content.querySelector('.atfrfo-color-row[data-var-id="' + rowKey + '"]');
							var nameInp = newRow ? newRow.querySelector('.atfrfo-var-name-input') : null;
							if (nameInp) {
								nameInp.removeAttribute('readonly');
								nameInp.focus({ preventScroll: true });
								nameInp.select();
							}
						}
					}
				} else if (!res.success) {
					var msg = (res.data && res.data.message) ? res.data.message : 'Could not add variable.';
					ATFRFO.Modal.open({ title: 'Error', body: '<p>' + msg + '</p>' });
				}
			}).catch(function () {
				ATFRFO.Modal.open({ title: 'Connection error', body: '<p>Could not add variable. Please try again.</p>' });
			});
		},

		/**
		 * Delete a variable with confirmation.
		 *
		 * Fonts/Numbers variables have no children so delete_children is always false.
		 *
		 * @param {string} varId Variable ID.
		 */
		_deleteVariable: function (varId) {
			var self     = this;
			var variable = ATFRFO.Utils.findVarByKey(varId);
			if (!variable) { return; }
			// Use the resolved UUID for the AJAX call; varId may be a stale __n_ key.
			var resolvedId = variable.id || varId;

			function doDelete() {
				ATFRFO.App.ajax('atfrfo_delete_color', {
					filename:    ATFRFO.state.currentFile,
					variable_id: resolvedId,
				}).then(function (res) {
					if (res.success && res.data && res.data.data) {
						ATFRFO.state.variables = res.data.data.variables;
						if (ATFRFO.App) { ATFRFO.App.setDirty(true); ATFRFO.App.refreshCounts(); }
						self._rerenderView();
					}
				}).catch(function () {
					ATFRFO.Modal.open({ title: 'Connection error', body: '<p>Delete failed. Please try again.</p>' });
				});
			}

			// Skip the dialog entirely when the user has suppressed delete confirmations.
			if (!ATFRFO.Utils.confirmDeleteVariablesEnabled()) {
				doDelete();
				return;
			}

			ATFRFO.Modal.open({
				title: 'Delete variable',
				body:  '<p>Delete <strong>' + ATFRFO.Utils.escHtml(variable.name || varId) + '</strong>?</p>'
					+ '<p>This cannot be undone.</p>'
					+ ATFRFO.Utils.dontAskAgainCheckboxHtml(),
				footer: '<div style="display:flex;justify-content:flex-end;gap:8px">'
					+ '<button class="atfrfo-btn atfrfo-btn--secondary" id="atfrfo-del-var-cancel">Cancel</button>'
					+ '<button class="atfrfo-btn atfrfo-btn--danger" id="atfrfo-del-var-confirm">Delete</button>'
					+ '</div>',
			});

			setTimeout(function () {
				var btn = document.getElementById('atfrfo-del-var-confirm');
				if (btn) { btn.focus(); }
			}, 50);

			function handleDelKey(e) {
				if (e.key === 'Enter') {
					var focused = document.activeElement;
					if (focused && (focused.id === 'atfrfo-del-var-confirm' || focused.id === 'atfrfo-del-var-cancel')) {
						e.preventDefault();
						focused.click();
					}
				}
			}
			document.addEventListener('keydown', handleDelKey);

			function handleClick(e) {
				if (e.target.id === 'atfrfo-del-var-cancel') {
					ATFRFO.Modal.close();
					document.removeEventListener('click', handleClick);
					document.removeEventListener('keydown', handleDelKey);
				} else if (e.target.id === 'atfrfo-del-var-confirm') {
					var dontAskChk = document.getElementById('atfrfo-del-dont-ask-again');
					if (dontAskChk && dontAskChk.checked) {
						ATFRFO.Utils.setConfirmDeleteVariablesEnabled(false);
					}
					ATFRFO.Modal.close();
					document.removeEventListener('click', handleClick);
					document.removeEventListener('keydown', handleDelKey);
					doDelete();
				}
			}
			document.addEventListener('click', handleClick);
		},

		// -------------------------------------------------------------------
		// CATEGORY OPERATIONS  (provided by ATFRFO.CatMixin via Object.assign)
		// -------------------------------------------------------------------
		// _addCategory, _saveCategoryName, _deleteCategory, _duplicateCategory,
		// _ajaxReorderCategories, _jumpToCategory — all in ATFRFO.CatMixin (atfrfo-app.js)

		/**
		 * Move a category one position up.
		 *
		 * @param {string} catId
		 */
		_moveCategoryUp: function (catId) {
			var cats = this._getCatsForSet();
			var idx  = -1;
			for (var i = 0; i < cats.length; i++) {
				if (cats[i].id === catId) { idx = i; break; }
			}
			if (idx <= 0) { return; }
			var tmp = cats[idx - 1]; cats[idx - 1] = cats[idx]; cats[idx] = tmp;
			this._ajaxReorderCategories(cats.map(function (c) { return c.id; }));
		},

		/**
		 * Move a category one position down.
		 *
		 * @param {string} catId
		 */
		_moveCategoryDown: function (catId) {
			var cats = this._getCatsForSet();
			var idx  = -1;
			for (var i = 0; i < cats.length; i++) {
				if (cats[i].id === catId) { idx = i; break; }
			}
			if (idx < 0 || idx >= cats.length - 1) { return; }
			var tmp = cats[idx + 1]; cats[idx + 1] = cats[idx]; cats[idx] = tmp;
			this._ajaxReorderCategories(cats.map(function (c) { return c.id; }));
		},

		/**
		 * Ensure Uncategorized always exists in this set's category list.
		 * Called on every loadVars() before render.
		 */
		_ensureUncategorized: function () {
			var catKey = this._cfg.catKey;
			if (!ATFRFO.state.config) { ATFRFO.state.config = {}; }
			if (!Array.isArray(ATFRFO.state.config[catKey])) {
				ATFRFO.state.config[catKey] = [];
			}
			var cats     = ATFRFO.state.config[catKey];
			var hasUncat = false;
			for (var i = 0; i < cats.length; i++) {
				if (cats[i].name === 'Uncategorized') { hasUncat = true; break; }
			}
			if (!hasUncat) {
				var maxOrder = 0;
				for (var j = 0; j < cats.length; j++) {
					if ((cats[j].order || 0) > maxOrder) { maxOrder = cats[j].order; }
				}
				cats.push({
					id:     'default-uncategorized-' + catKey,
					name:   'Uncategorized',
					order:  maxOrder + 1,
					locked: true,
				});
			}
		},

		// -------------------------------------------------------------------
		// SORT
		// -------------------------------------------------------------------

		// -------------------------------------------------------------------
		// AJAX HELPERS
		// -------------------------------------------------------------------

		/**
		 * Send eff_save_color AJAX and update ATFRFO.state.variables on success.
		 * Increments/decrements pendingSaveCount so the Save button shows correct state.
		 *
		 * @param {Object}   variableData Partial variable with at least { id }.
		 * @param {Function} onSuccess    Called on AJAX success.
		 */
		_ajaxSaveVar: function (variableData, onSuccess) {
			if (!ATFRFO.state.currentFile) { return; }
			ATFRFO.state.pendingSaveCount = (ATFRFO.state.pendingSaveCount || 0) + 1;

			ATFRFO.App.ajax('atfrfo_save_color', {
				filename: ATFRFO.state.currentFile,
				variable: JSON.stringify(variableData),
			}).then(function (res) {
				if (res.success && res.data && res.data.data && res.data.data.variables) {
					ATFRFO.state.variables = res.data.data.variables;
				}
				if (onSuccess) { onSuccess(res.data); }
				if (ATFRFO.App) { ATFRFO.App.flushPending(); }
			}).catch(function () {
				if (ATFRFO.App) { ATFRFO.App.flushPending(); }
			});
		},

		// -------------------------------------------------------------------
		// RE-RENDER
		// -------------------------------------------------------------------

		/** Re-render the current view using the existing currentSelection. */
		_rerenderView: function () {
			var content   = document.getElementById('atfrfo-edit-content');
			var editSpace = document.getElementById('atfrfo-edit-space');
			if (!content) { return; }
			var savedPanel  = editSpace ? editSpace.scrollTop : 0;
			var savedWindow = window.pageYOffset;
			// Snapshot focus-driven collapse state into _collapsedIds before clearing
			// _focusedCatId. Without this, clearing _focusedCatId causes previously
			// auto-collapsed categories to expand (their state was never in _collapsedIds).
			// Clears _focusedCatId so _renderAll does not fire _jumpToCategory's
			// scrollIntoView (setTimeout 50ms), which would override the scroll restore.
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

		/**
		 * Sort variables within a single category and re-render that category's variable list.
		 * Client-side only — does not call the server.
		 *
		 * @param {string}      catId
		 * @param {string}      field 'name' | 'value'
		 * @param {string}      dir   'none' | 'asc' | 'desc'
		 * @param {HTMLElement} container
		 */
		_sortVarsInCategory: function (catId, field, dir, container) {
			var self   = this;
			var catKey = self._cfg.catKey;
			var cats   = (ATFRFO.state.config && Array.isArray(ATFRFO.state.config[catKey]))
				? ATFRFO.state.config[catKey] : [];
			var cat = null;
			for (var i = 0; i < cats.length; i++) {
				if (cats[i].id === catId) { cat = cats[i]; break; }
			}
			if (!cat) { return; }

			var vars = self._getVarsForCategory(cat).slice();
			if (dir !== 'none') {
				vars.sort(function (a, b) {
					var fa = ((field === 'value' ? a.value : a.name) || '').toLowerCase();
					var fb = ((field === 'value' ? b.value : b.name) || '').toLowerCase();
					if (fa < fb) { return dir === 'asc' ? -1 : 1; }
					if (fa > fb) { return dir === 'asc' ?  1 : -1; }
					return 0;
				});
			}

			var block = container.querySelector('.atfrfo-category-block[data-category-id="' + catId + '"]');
			if (!block) { return; }
			var list = block.querySelector('.atfrfo-color-list');
			if (!list) { return; }

			var html = '';
			var _cats2 = (ATFRFO.state.config && Array.isArray(ATFRFO.state.config[self._cfg.catKey]))
				? ATFRFO.state.config[self._cfg.catKey] : [];
			var _sortHasSubs = _cats2.some(function (c) { return c.parent_id === catId; });
			if (vars.length === 0 && !_sortHasSubs) {
				html = '<p class="atfrfo-colors-empty">No variables in this category.</p>';
			} else {
				for (var j = 0; j < vars.length; j++) {
					html += self._buildVariableRow(vars[j]);
				}
			}
			list.innerHTML = html;

			var sortBtns = block.querySelectorAll('.atfrfo-col-sort-btn');
			for (var k = 0; k < sortBtns.length; k++) {
				var btn    = sortBtns[k];
				var btnCol = btn.getAttribute('data-sort-col');
				var btnDir = (btnCol === field) ? dir : 'none';
				btn.setAttribute('data-sort-dir', btnDir);
				btn.innerHTML = ATFRFO.Icons.sortBtnSVG(btnDir);
			}
		},

		// -------------------------------------------------------------------
		// DRAG AND DROP
		// -------------------------------------------------------------------

		/**
		 * Handle a completed category drop: reorder categories.
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
			var catKey = self._cfg.catKey;
			ATFRFO.state.config[catKey] = cats;

			ATFRFO.App.ajax('atfrfo_reorder_categories', {
				filename:    ATFRFO.state.currentFile,
				subgroup:    self._cfg.setName,
				ordered_ids: JSON.stringify(ordered_ids),
			}).then(function (res) {
				if (res.success) {
					// Order already applied locally; no state overwrite needed.
				}
				if (ATFRFO.App) { ATFRFO.App.setDirty(true); }
				if (ATFRFO.PanelLeft) { ATFRFO.PanelLeft.refresh(); }
				self._rerenderView();
			}).catch(function () {
				self._rerenderView();
			});
		},

		/**
		 * Initialize mouse-based drag-and-drop for variable rows.
		 *
		 * @param {HTMLElement} container
		 */
		_initDrag: function (container) {
			var self     = this;
			var setLower = self._cfg.setName.toLowerCase();

			// Delegate all drag infrastructure to the shared ATFRFO.VarDrag module.
			// Supply getCats so the drop logic reads the correct category array for
			// this subgroup (Colors → config.categories, Fonts → config.fontCategories,
			// Numbers → config.numberCategories).
			ATFRFO.VarDrag.init(container, {
				viewSelector: '.atfrfo-' + setLower + '-view',
				onDrop: function (draggedId, targetId, insertBefore, targetCatBlock) {
					ATFRFO.VarDrag.drop({
						draggedId:      draggedId,
						targetId:       targetId,
						insertBefore:   insertBefore,
						targetCatBlock: targetCatBlock,
						getCats:        function () { return self._getCatsForSet(); },
						getSetVars:     function () { return self._getVarsForSet(); },
						rerenderView:   function () { self._rerenderView(); },
					});
				},
			});
		},

		// -------------------------------------------------------------------
		// STATE HELPERS
		// -------------------------------------------------------------------

		/**
		 * Return all variables for this set (filtered by subgroup).
		 * @returns {Array}
		 */
		_getVarsForSet: function () {
			var sub = this._cfg.setName;
			return ATFRFO.state.variables.filter(function (v) { return v.subgroup === sub && v.status !== 'deleted'; });
		},

		/**
		 * Return variables in a category, sorted by order.
		 * Matches by category_id first, then falls back to category name string.
		 *
		 * @param {Object} cat Category object.
		 * @returns {Array}
		 */
		_getVarsForCategory: function (cat) {
			var self    = this;
			var setVars = this._getVarsForSet();

			if (cat.name === 'Uncategorized') {
				// Catch-all: build a set of IDs/names for all live non-Uncategorized cats.
				var knownIds   = {};
				var knownNames = {};
				var liveCats = self._getCatsForSet();
				for (var i = 0; i < liveCats.length; i++) {
					if (liveCats[i].name !== 'Uncategorized') {
						if (liveCats[i].id)   { knownIds[liveCats[i].id]     = true; }
						if (liveCats[i].name) { knownNames[liveCats[i].name] = true; }
					}
				}
				var matched = setVars.filter(function (v) {
					// Explicitly assigned here by ID or name.
					if (cat.id && v.category_id && v.category_id === cat.id) { return true; }
					if (v.category === 'Uncategorized') { return true; }
					// Empty category reference — result of "Save to Uncategorized" delete.
					if (!v.category_id && !v.category) { return true; }
					// Orphaned: points to a category that no longer exists.
					if (v.category_id && !knownIds[v.category_id])   { return true; }
					if (v.category    && !knownNames[v.category])    { return true; }
					return false;
				});
				return matched.sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
			}

			var matched = setVars.filter(function (v) {
				if (cat.id && v.category_id && v.category_id === cat.id) { return true; }
				if (v.category === cat.name) { return true; }
				return false;
			});
			return matched.sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
		},

		/**
		 * Return direct sub-categories of a category, sorted by order.
		 *
		 * @param {string} catId   Parent category ID.
		 * @param {Array}  allCats All categories for this set.
		 * @returns {Array}
		 */
		_getSubCategoriesOf: function (catId, allCats) {
			var result = [];
			for (var i = 0; i < allCats.length; i++) {
				if (allCats[i].parent_id === catId) { result.push(allCats[i]); }
			}
			return result.sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
		},

		/**
		 * Return total variable count for a category plus all its sub-categories.
		 *
		 * @param {string} catId   Category ID.
		 * @param {Array}  allCats All categories for this set.
		 * @returns {number}
		 */
		_getSubtreeVarCount: function (catId, allCats) {
			var cat = null;
			for (var i = 0; i < allCats.length; i++) {
				if (allCats[i].id === catId) { cat = allCats[i]; break; }
			}
			if (!cat) { return 0; }
			var total = this._getVarsForCategory(cat).length;
			var subs  = this._getSubCategoriesOf(catId, allCats);
			for (var j = 0; j < subs.length; j++) {
				total += this._getSubtreeVarCount(subs[j].id, allCats);
			}
			return total;
		},

		/**
		 * Return the sorted category list for this set.
		 * @returns {Array}
		 */
		_getCatsForSet: function () {
			var catKey = this._cfg.catKey;
			var arr    = (ATFRFO.state.config && ATFRFO.state.config[catKey]) || [];
			return arr.slice().sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
		},

		// -------------------------------------------------------------------
		// DOM HELPERS
		// -------------------------------------------------------------------

		/**
		 * Update the status dot colour for a variable row.
		 * @param {string} varId
		 * @param {string} status
		 */
		_updateStatusDotInDOM: function (varId, status) {
			var content = document.getElementById('atfrfo-edit-content');
			if (!content) { return; }
			var row = content.querySelector('.atfrfo-color-row[data-var-id="' + ATFRFO.Utils.escAttr(varId) + '"]');
			var dot = row ? row.querySelector('.atfrfo-status-dot') : null;
			if (dot) { dot.style.background = ATFRFO.Utils.statusColor(status); }
		},

		/** CSS selector for the active view inside the container. Required by ATFRFO.CatMixin._initCatDrag. */
		_catViewSelector: function () {
			return '.atfrfo-' + this._cfg.setName.toLowerCase() + '-view';
		},

		/** Open a "no project file" error modal. */
		_noFileModal: function () {
			ATFRFO.Modal.open({
				title: 'No file loaded',
				body:  '<p>Please load or create an AFFproject file before making changes.</p>',
			});
		},

	};

}());
