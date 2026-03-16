/**
 * EFF Colors — Phase 2 Colors Edit Space
 *
 * Intercepts EFF.EditSpace.loadCategory() for the Colors subgroup and
 * renders a full editing workspace: category blocks with color variable rows,
 * inline expand panels (color picker + tint/shade generator), category
 * management (add/rename/delete/reorder/duplicate), and undo/redo.
 *
 * Phases implemented in this file:
 *   Phase 2b: Category blocks, color variable rows (read-only display)
 *   Phase 2c: Inline editing, category CRUD, undo/redo
 *   Phase 2d: Expand panel (color picker + generator + preview)
 *   Phase 2e: Status dots (rendered; sync decision tree in eff-app.js)
 *
 * JS standard: ES5 IIFE, 'use strict', var only, no arrow functions.
 *
 * @package ElementorFrameworkForge
 */

(function () {
	'use strict';

	window.EFF = window.EFF || {};

	// -----------------------------------------------------------------------
	// UNDO / REDO STACK
	// -----------------------------------------------------------------------

	var _undoStack = [];   // max 50 entries
	var _redoStack = [];
	var UNDO_LIMIT = 50;

	/**
	 * Push an operation to the undo stack.
	 *
	 * @param {{ type: string, data: Object }} op Operation descriptor.
	 */
	function pushUndo(op) {
		_undoStack.push(op);
		if (_undoStack.length > UNDO_LIMIT) {
			_undoStack.shift();
		}
		_redoStack = []; // Any new action clears the redo stack.
	}

	// -----------------------------------------------------------------------
	// COLLAPSE STATE — persists across re-renders
	// -----------------------------------------------------------------------

	/**
	 * Tracks user-toggled collapse state per category ID.
	 * { catId: boolean }  true = collapsed
	 */
	var _collapsedCategoryIds = {};

	var _drag = {
		active:      false,
		varId:       null,
		ghost:       null,
		indicator:   null,
		startY:      0,
		scrollTimer: null
	};

	/**
	 * The category ID to scroll to and expand after rendering, or null.
	 * Set by loadColors() from selection.categoryId (nav item click).
	 */
	var _focusedCategoryId = null;

	/**
	 * Per-category sort state. { catId: { field: 'name'|'value', dir: 'none'|'asc'|'desc' } }
	 * Client-side display sort only — does not persist to server.
	 */
	var _catSortState = {};

	// -----------------------------------------------------------------------
	// MODULE
	// -----------------------------------------------------------------------

	EFF.Colors = {

		/**
		 * The currently open expand panel's variable ID, or null.
		 * @type {string|null}
		 */
		_openExpandId: null,

		/**
		 * Initialize: intercept EFF.EditSpace.loadCategory for Colors subgroup.
		 */
		init: function () {
			var _original = EFF.EditSpace.loadCategory.bind(EFF.EditSpace);

			EFF.EditSpace.loadCategory = function (selection) {
				if (selection && selection.subgroup === 'Colors') {
					EFF.Colors.loadColors(selection);
				} else {
					_original(selection);
				}
			};

			// Undo/redo keyboard handler.
			document.addEventListener('keydown', function (e) {
				if (!e.ctrlKey && !e.metaKey) { return; }
				if (e.key === 'z' || e.key === 'Z') {
					e.preventDefault();
					EFF.Colors.undo();
				} else if (e.key === 'y' || e.key === 'Y') {
					e.preventDefault();
					EFF.Colors.redo();
				}
			});
		},

		/**
		 * Entry point called by the overridden EFF.EditSpace.loadCategory.
		 *
		 * @param {{ group: string, subgroup: string, category: string, categoryId: string|null }} selection
		 */
		loadColors: function (selection) {
			var placeholder = document.getElementById('eff-placeholder');
			var content     = document.getElementById('eff-edit-content');
			var workspace   = document.getElementById('eff-workspace');

			if (!content) { return; }

			// Store the focused category from the nav click.
			if (selection && selection.categoryId) {
				_focusedCategoryId = selection.categoryId;
			} else if (selection && selection.category) {
				var _cats = (EFF.state.config && EFF.state.config.categories) || this._getDefaultCategories();
				_focusedCategoryId = null;
				for (var _ci = 0; _ci < _cats.length; _ci++) {
					if (_cats[_ci].name === selection.category) {
						_focusedCategoryId = _cats[_ci].id;
						break;
					}
				}
			} else {
				_focusedCategoryId = null;
			}
			// When navigating via left panel, reset manual collapse state
			// so the focused category always expands (overrides any prior user toggle).
			if (_focusedCategoryId) {
				_collapsedCategoryIds = {};
			}

			if (workspace) {
				workspace.setAttribute('data-active', 'true');
			}

			// Use inline style (highest specificity) to ensure placeholder is hidden
			// regardless of any CSS display rules on .eff-placeholder.
			if (placeholder) {
				placeholder.style.display = 'none';
			}

			content.removeAttribute('hidden');
			content.style.display = '';

			this._ensureUncategorized();
			this._renderAll(selection, content);
		},

		// -----------------------------------------------------------------------
		// RENDER
		// -----------------------------------------------------------------------

		/**
		 * Build and inject the full Colors view HTML into the content element.
		 *
		 * @param {{ group: string, subgroup: string, category: string }} selection
		 * @param {HTMLElement} container
		 */
		_renderAll: function (selection, container) {
			var self        = this;

			// Close any open expand modal before rebuilding the DOM.
			if (this._openExpandId) {
				this._closeExpandPanel(container);
			}

			var categories  = (EFF.state.config && EFF.state.config.categories)
				? EFF.state.config.categories.slice().sort(function (a, b) {
					return (a.order || 0) - (b.order || 0);
				})
				: self._getDefaultCategories();

			var html = '<div class="eff-colors-view">';

			// Compute initial toggle state: show expand-all if all are collapsed.
			var _anyExpanded = false;
			for (var _ti = 0; _ti < categories.length; _ti++) {
				var _tc = categories[_ti];
				var _tv = self._getVarsForCategory(_tc);
				var _tcCollapsed;
				if (_collapsedCategoryIds.hasOwnProperty(_tc.id)) {
					_tcCollapsed = _collapsedCategoryIds[_tc.id];
				} else if (_focusedCategoryId) {
					_tcCollapsed = (_tc.id !== _focusedCategoryId);
				} else {
					_tcCollapsed = (_tv.length === 0);
				}
				if (!_tcCollapsed) { _anyExpanded = true; break; }
			}
			var _toggleState = _anyExpanded ? 'expanded' : 'collapsed';
			var _toggleSVG   = _anyExpanded ? self._collapseAllSVG() : self._expandAllSVG();
			var _toggleTitle = _anyExpanded ? 'Collapse all categories' : 'Expand all categories';

			// ------- FILTER BAR -------
			// Top row: COLORS title | spacer | search | close | collapse-toggle
			// Add-category button: circle below filter bar (matches category add-var position)
			html += '<div class="eff-colors-filter-bar">'
				+ '<div class="eff-filter-bar-top">'
				+ '<span class="eff-filter-bar-set-name">Colors</span>'
				+ '<span style="flex:1"></span>'
				+ '<input type="text" class="eff-colors-search" id="eff-colors-search"'
				+ ' placeholder="Search\u2026" aria-label="Search color variables">'
				+ '<button class="eff-icon-btn eff-colors-back-btn" id="eff-colors-back"'
				+ ' title="Close colors view" aria-label="Close colors view"'
				+ ' data-eff-tooltip="Close Colors view">'
				+ self._closeSVG()
				+ '</button>'
				+ '<button class="eff-icon-btn" id="eff-colors-collapse-toggle"'
				+ ' title="' + _toggleTitle + '" aria-label="' + _toggleTitle + '"'
				+ ' data-eff-tooltip="' + _toggleTitle + '"'
				+ ' data-toggle-state="' + _toggleState + '">'
				+ _toggleSVG
				+ '</button>'
				+ '</div>'
				+ '<div class="eff-filter-bar-add-cat-wrap">'
				+ '<button class="eff-icon-btn eff-colors-add-cat-btn" id="eff-colors-add-category"'
				+ ' data-eff-tooltip="Add category"'
				+ ' aria-label="Add category">'
				+ self._plusSVG()
				+ '</button>'
				+ '</div>'
				+ '</div>'; // .eff-colors-filter-bar

			// ------- CATEGORY BLOCKS -------
			if (categories.length === 0) {
				html += '<p class="eff-colors-empty">No categories found. Click "+ Category" to add one.</p>';
			} else {
				for (var i = 0; i < categories.length; i++) {
					html += self._buildCategoryBlock(categories[i], i, categories.length);
				}
			}

			html += '</div>'; // .eff-colors-view

			container.innerHTML = html;

			// Bind all interactive elements.
			self._bindEvents(container);

			// Jump to focused category if set (from nav click).
			if (_focusedCategoryId) {
				self._jumpToCategory(_focusedCategoryId, container);
			}
		},

		/**
		 * Return built-in default categories if config has none yet.
		 * @returns {Array}
		 */
		_getDefaultCategories: function () {
			return [
				{ id: 'default-branding',       name: 'Branding',      order: 0, locked: false },
				{ id: 'default-background',      name: 'Background',    order: 1, locked: false },
				{ id: 'default-neutral',         name: 'Neutral',       order: 2, locked: false },
				{ id: 'default-semantic',        name: 'Semantic',      order: 3, locked: false },
				{ id: 'default-uncategorized',   name: 'Uncategorized', order: 4, locked: true  },
			];
		},

		/**
		 * Build the HTML for one category block.
		 *
		 * Header layout (two rows):
		 *   Top:    [Name (Inter 700) + count badge]     [actions: ⧉ ↑ ↓ ✕ ▾]
		 *   Bottom: [⊕ add-variable button]
		 *
		 * @param {{ id: string, name: string, locked: boolean, order: number }} cat
		 * @returns {string}
		 */
		_buildCategoryBlock: function (cat, catIndex, catTotal) {
			var self  = this;
			var vars  = self._getVarsForCategory(cat);
			var count = vars.length;

			// Determine initial collapsed state for this render.
			var isCollapsed;
			if (_collapsedCategoryIds.hasOwnProperty(cat.id)) {
				// User has manually toggled this category — respect their choice.
				isCollapsed = _collapsedCategoryIds[cat.id];
			} else if (_focusedCategoryId) {
				// From nav click: focused category expanded, all others collapsed.
				isCollapsed = (cat.id !== _focusedCategoryId);
			} else {
				// No focus set (re-render after CRUD): empty categories collapsed.
				isCollapsed = (count === 0);
			}

			var html = '<div class="eff-category-block"'
				+ ' data-category-id="' + self._esc(cat.id) + '"'
				+ ' data-collapsed="' + (isCollapsed ? 'true' : 'false') + '"'
				+ '>'
				// Inner wrapper handles overflow clipping; outer block uses
				// overflow:visible so the add button can sit on the bottom edge.
				+ '<div class="eff-category-inner">';

			// --- Header: drag-handle + name span + count + sort buttons + actions ---
			html += '<div class="eff-category-header">'
				+ '<div class="eff-cat-header-top">'
				+ '<div class="eff-cat-header-left">'

				// Drag handle — six-dot grip for category drag-and-drop.
				+ '<span class="eff-cat-drag-handle" data-action="cat-drag-handle" aria-hidden="true"'
				+ ' data-eff-tooltip="Drag to reorder">'
				+ self._sixDotSVG()
				+ '</span>'

				// Category name as plain span — no surrounding box.
				// Double-click activates contenteditable.
				+ '<span class="eff-category-name-input"'
				+ ' data-cat-id="' + self._esc(cat.id) + '"'
				+ ' data-original="' + self._esc(cat.name) + '"'
				+ ' aria-label="Category name"'
				+ ' contenteditable="false"'
				+ (cat.locked ? ' data-locked="true"' : '') + '>'
				+ self._esc(cat.name)
				+ '</span>'

				// Variable count badge — sits right after the name text.
				+ '<span class="eff-category-count">' + count + '</span>'

				+ '</div>' // .eff-cat-header-left

				+ '<div class="eff-category-actions" role="toolbar" aria-label="Category actions">'
				+ self._catBtn('duplicate', 'Duplicate category', self._duplicateSVG(), '')
				+ (cat.locked ? '' : self._catBtn('delete', 'Delete category', self._trashSVG(), 'eff-icon-btn--danger'))
				+ self._catBtn('collapse', 'Collapse/expand category', self._chevronSVG(), 'eff-category-collapse-btn')
				+ '</div>' // .eff-category-actions

				+ '</div>' // .eff-cat-header-top
				+ '</div>'; // .eff-category-header

			// Column sort header row — same grid as variable rows; sort buttons in name (col4) and value (col5).
			var _ns = (_catSortState[cat.id] && _catSortState[cat.id].field === 'name')  ? _catSortState[cat.id].dir : 'none';
			var _vs = (_catSortState[cat.id] && _catSortState[cat.id].field === 'value') ? _catSortState[cat.id].dir : 'none';
			html += '<div class="eff-color-list-header" data-cat-id="' + self._esc(cat.id) + '">'
				+ '<span></span>'  // col1: drag
				+ '<span></span>'  // col2: status dot
				+ '<span></span>'  // col3: swatch
				+ '<span class="eff-col-sort-wrap">'
				+ '<button class="eff-col-sort-btn" data-sort-col="name" data-cat-id="' + self._esc(cat.id) + '" data-sort-dir="' + _ns + '"'
				+ ' title="Sort by name" aria-label="Sort by name"'
				+ ' data-eff-tooltip="Sort by name">'
				+ self._sortBtnSVG(_ns)
				+ '</button>'
				+ '</span>'
				+ '<span class="eff-col-sort-wrap">'
				+ '<button class="eff-col-sort-btn" data-sort-col="value" data-cat-id="' + self._esc(cat.id) + '" data-sort-dir="' + _vs + '"'
				+ ' title="Sort by value" aria-label="Sort by value"'
				+ ' data-eff-tooltip="Sort by value">'
				+ self._sortBtnSVG(_vs)
				+ '</button>'
				+ '</span>'
				+ '</div>'; // .eff-color-list-header

			// Variable rows.
			html += '<div class="eff-color-list">';
			if (count === 0) {
				html += '<p class="eff-colors-empty">No variables in this category.</p>';
			} else {
				for (var i = 0; i < vars.length; i++) {
					html += self._buildVariableRow(vars[i]);
				}
			}
			html += '</div>'; // .eff-color-list

			html += '</div>'; // .eff-category-inner

			// Add-variable button: absolutely positioned circle on bottom-left edge of panel.
			html += '<div class="eff-cat-add-btn-wrap">'
				+ '<button class="eff-icon-btn eff-add-var-btn" data-action="add-var"'
				+ ' data-cat-id="' + self._esc(cat.id) + '"'
				+ ' aria-label="Add Color to ' + self._esc(cat.name) + '"'
				+ ' title="Add Color"'
			+ ' data-eff-tooltip="Add Color"'
			+ ' data-eff-tooltip-long="Add a new color variable to this category">'
				+ self._plusSVG()
				+ '</button>'
				+ '</div>';

			html += '</div>'; // .eff-category-block
			return html;
		},

		/**
		 * Build one category action icon button.
		 *
		 * @param {string} action    data-action value
		 * @param {string} label     aria-label
		 * @param {string} icon      SVG icon HTML
		 * @param {string} extraClass Additional CSS class
		 * @returns {string}
		 */
		_catBtn: function (action, label, icon, extraClass, disabled) {
			return '<button class="eff-icon-btn ' + (extraClass || '') + '"'
				+ ' data-action="' + action + '"'
				+ ' aria-label="' + this._esc(label) + '"'
				+ ' title="' + this._esc(label) + '"'
			+ ' data-eff-tooltip="' + this._esc(label) + '"'
				+ (disabled ? ' disabled' : '')
				+ '>'
				+ icon
				+ '</button>';
		},

		/**
		 * Build the HTML for a single color variable row.
		 *
		 * @param {Object} v Variable object.
		 * @returns {string}
		 */
		_buildVariableRow: function (v) {
			var status      = v.status || 'synced';
			var statusColor = this._statusColor(status);
			var swatchBg    = this._esc(v.value || '');
			var rowKey      = this._rowKey(v);
			var isExpanded  = (this._openExpandId === rowKey);

			var html = '<div class="eff-color-row"'
				+ (isExpanded ? ' data-expanded="true"' : '')
				+ ' data-var-id="' + this._esc(rowKey) + '">'

				// Drag handle (col 1: 24px).
				+ '<div class="eff-drag-handle" data-action="drag-handle" draggable="false"'
			+ ' aria-label="Drag to reorder" data-eff-tooltip="Drag to reorder">'
				+ this._sixDotSVG()
				+ '</div>'

				// Status dot (Phase 2e).
				+ '<span class="eff-status-dot"'
				+ ' style="background:' + statusColor + '"'
				+ ' data-eff-tooltip="' + this._esc(status.charAt(0).toUpperCase() + status.slice(1)) + '"'
				+ ' data-eff-tooltip-long="' + this._esc(this._statusLongTooltip(status)) + '"'
				+ ' aria-label="Status: ' + this._esc(status) + '">'
				+ '</span>'

				// Color swatch.
				+ '<span class="eff-color-swatch"'
				+ ' style="background:' + swatchBg + '"'
				+ ' data-action="open-picker"'
				+ ' aria-label="Color swatch"'
				+ ' data-eff-tooltip="Click to open color editor">'
				+ '</span>'

				// Variable name — single-click to edit.
				+ '<input type="text" class="eff-color-name-input"'
				+ ' value="' + this._esc(v.name) + '"'
				+ ' data-original="' + this._esc(v.name) + '"'
				+ ' readonly'
				+ ' aria-label="Variable name"'
				+ ' data-eff-tooltip="Variable name — click to edit"'
				+ ' spellcheck="false">'

				// Color value — directly editable.
				+ '<input type="text" class="eff-color-value-input"'
				+ ' value="' + this._esc(v.value || '') + '"'
				+ ' data-original="' + this._esc(v.value || '') + '"'
				+ ' aria-label="Color value"'
				+ ' data-eff-tooltip="Color value — edit directly"'
				+ ' spellcheck="false">'

				// Format selector.
				+ '<select class="eff-color-format-sel" aria-label="Color format"'
				+ ' data-eff-tooltip="Color format">'
				+ this._formatOptions(v.format || 'HEX')
				+ '</select>'

				// Expand button (col 7: 28px).
				+ '<button class="eff-icon-btn eff-color-expand-btn"'
				+ ' data-action="expand"'
				+ ' aria-label="Open color editor"'
				+ ' aria-expanded="false"'
				+ ' data-eff-tooltip="Open color editor"'
			+ ' data-eff-tooltip-long="Open the full color editor — tints, shades, transparency, and picker">'
				+ this._chevronSVG()
				+ '</button>'

				// Delete button (col 8).
				+ '<button class="eff-icon-btn eff-color-delete-btn" data-action="delete-var" data-var-id="' + this._esc(rowKey) + '"'
			+ ' title="Delete variable" aria-label="Delete variable"'
			+ ' data-eff-tooltip="Delete variable"'
			+ ' data-eff-tooltip-long="Remove this variable from the project">&#x1F5D1;</button>'

				+ '</div>'; // .eff-color-row

			return html;
		},

		/**
		 * Build the <select> options for the format field.
		 *
		 * @param {string} current Currently selected format value.
		 * @returns {string} HTML option string.
		 */
		_formatOptions: function (current) {
			var formats = ['HEX', 'HEXA', 'RGB', 'RGBA', 'HSL', 'HSLA'];
			var html = '';
			for (var i = 0; i < formats.length; i++) {
				var sel = (formats[i] === current) ? ' selected' : '';
				html += '<option value="' + formats[i] + '"' + sel + '>' + formats[i] + '</option>';
			}
			return html;
		},

		/**
		 * Build the inner HTML for the expand modal card.
		 * Header mirrors the color row; body has three generator rows.
		 *
		 * @param {Object} v      Variable object.
		 * @param {string} rowKey Unique row key.
		 * @returns {string}
		 */
		_buildModalContent: function (v, rowKey) {
			var self     = this;
			var children = self._getChildVars(v.id);

			var tintChildren  = children.filter(function (c) { return /-\d+$/.test(c.name) && c.name.indexOf('-plus-') === -1; });
			var shadeChildren = children.filter(function (c) { return c.name.indexOf('-plus-') !== -1 && /-plus-\d+$/.test(c.name); });
			var transChildren = children.filter(function (c) { return /\d+$/.test(c.name) && c.name.indexOf('-plus-') === -1 && !/-\d+$/.test(c.name); });

			var currentTints  = tintChildren.length;
			var currentShades = shadeChildren.length;
			var transOn       = transChildren.length > 0;

			var rgba     = self._parseToRgba(v.value || '');
			var hsl      = rgba ? self._rgbToHsl(rgba.r, rgba.g, rgba.b) : null;
			var swatchBg = self._esc(v.value || '');

			var statusColor = self._statusColor(v.status || 'synced');

			var html = '<div class="eff-modal-header">'
				// Empty drag-handle placeholder (col 1) — keeps grid alignment with .eff-color-row
				+ '<span></span>'
				// Status dot (col 2) — matches color row col 2
				+ '<span class="eff-status-dot" style="background:' + statusColor + '"'
				+ ' title="Status: ' + self._esc(v.status || 'synced') + '"></span>'
				// Swatch (col 2)
				+ '<span class="eff-color-swatch" style="background:' + swatchBg + '"'
				+ ' aria-label="Color swatch"></span>'
				// Name input (col 3)
				+ '<input type="text" class="eff-color-name-input"'
				+ ' value="' + self._esc(v.name) + '"'
				+ ' data-original="' + self._esc(v.name) + '"'
				+ ' data-var-id="' + self._esc(rowKey) + '"'
				+ ' spellcheck="false" aria-label="Variable name"'
				+ ' data-eff-tooltip="Variable name \u2014 click to edit">'
				// Value input (col 4)
				+ '<input type="text" class="eff-color-value-input"'
				+ ' value="' + self._esc(v.value || '') + '"'
				+ ' data-original="' + self._esc(v.value || '') + '"'
				+ ' data-var-id="' + self._esc(rowKey) + '"'
				+ ' spellcheck="false" aria-label="Color value"'
				+ ' data-eff-tooltip="Color value \u2014 edit directly">'
				// Format select (col 5)
				+ '<select class="eff-color-format-sel"'
				+ ' data-var-id="' + self._esc(rowKey) + '"'
				+ ' aria-label="Color format"'
				+ ' data-eff-tooltip="Color format">'
				+ self._formatOptions(v.format || 'HEX')
				+ '</select>'
				// Close button (col 6)
				+ '<button class="eff-modal-close-btn" aria-label="Close editor">\u00d7</button>'
				+ '</div>';

			html += '<div class="eff-modal-body">';

			html += '<div class="eff-modal-gen-row">'
				+ '<span class="eff-modal-gen-label">Tints</span>'
				+ '<div class="eff-modal-gen-ctrl">'
				+ '<input type="number" class="eff-gen-num eff-gen-tints-num"'
				+ ' min="0" max="10" value="' + currentTints + '"'
				+ ' data-var-id="' + self._esc(rowKey) + '">'
				+ '</div>'
				+ '<div class="eff-palette-strip eff-tints-palette">'
				+ self._buildTintsBars(hsl, currentTints)
				+ '</div>'
				+ '</div>';

			html += '<div class="eff-modal-gen-row">'
				+ '<span class="eff-modal-gen-label">Shades</span>'
				+ '<div class="eff-modal-gen-ctrl">'
				+ '<input type="number" class="eff-gen-num eff-gen-shades-num"'
				+ ' min="0" max="10" value="' + currentShades + '"'
				+ ' data-var-id="' + self._esc(rowKey) + '">'
				+ '</div>'
				+ '<div class="eff-palette-strip eff-shades-palette">'
				+ self._buildShadesBars(hsl, currentShades)
				+ '</div>'
				+ '</div>';

			html += '<div class="eff-modal-gen-row">'
				+ '<span class="eff-modal-gen-label">Transparencies</span>'
				+ '<div class="eff-modal-gen-ctrl">'
				+ '<label class="eff-toggle-label">'
				+ '<input type="checkbox" class="eff-gen-trans-toggle"'
				+ ' data-var-id="' + self._esc(rowKey) + '"'
				+ (transOn ? ' checked' : '') + '>'
				+ '<span class="eff-toggle-track"></span>'
				+ '</label>'
				+ '</div>'
				+ '<div class="eff-palette-strip eff-trans-palette">'
				+ (transOn ? self._buildTransBars(rgba) : '')
				+ '</div>'
				+ '</div>';

			// Move to Category row.
			var allCats = (EFF.state.config && EFF.state.config.categories) ? EFF.state.config.categories : [];
			var currentCatId = v.category_id || '';
			var catOptions = '';
			for (var ci = 0; ci < allCats.length; ci++) {
				var co = allCats[ci];
				catOptions += '<option value="' + self._esc(co.id) + '"'
					+ (co.id === currentCatId ? ' selected' : '') + '>'
					+ self._esc(co.name)
					+ '</option>';
			}

			if (allCats.length > 1) {
				html += '<div class="eff-modal-gen-row">'
					+ '<span class="eff-modal-gen-label">Move to Category</span>'
					+ '<div class="eff-modal-gen-ctrl" style="width:auto;flex:1">'
					+ '<select class="eff-cat-move-select" data-var-id="' + self._esc(rowKey) + '">'
					+ catOptions
					+ '</select>'
					+ '</div>'
					+ '</div>';
			}

			html += '</div>'; // .eff-modal-body
			return html;
		},

		/**
		 * Build a horizontal palette strip for tints (lighter toward white).
		 *
		 * @param {{h:number,s:number,l:number}|null} hsl   Base color in HSL.
		 * @param {number}                             steps Number of steps (0–10).
		 * @returns {string} HTML palette swatch elements.
		 */
		_buildTintsBars: function (hsl, steps) {
			if (!hsl || steps <= 0) { return ''; }
			var html = '';
			for (var i = 1; i <= steps; i++) {
				var l = hsl.l + (100 - hsl.l) * (i / steps);
				if (l > 98) { l = 98; }
				var color = 'hsl(' + hsl.h + ', ' + hsl.s + '%, ' + l.toFixed(1) + '%)';
				html += '<span class="eff-palette-swatch" style="background:' + color + '"></span>';
			}
			return html;
		},

		/**
		 * Build a horizontal palette strip for shades (darker toward black).
		 *
		 * @param {{h:number,s:number,l:number}|null} hsl   Base color in HSL.
		 * @param {number}                             steps Number of steps (0–10).
		 * @returns {string} HTML palette swatch elements.
		 */
		_buildShadesBars: function (hsl, steps) {
			if (!hsl || steps <= 0) { return ''; }
			var html = '';
			for (var i = 1; i <= steps; i++) {
				var l = hsl.l - hsl.l * (i / steps);
				if (l < 2) { l = 2; }
				var color = 'hsl(' + hsl.h + ', ' + hsl.s + '%, ' + l.toFixed(1) + '%)';
				html += '<span class="eff-palette-swatch" style="background:' + color + '"></span>';
			}
			return html;
		},

		/**
		 * Build a horizontal palette strip for transparencies (9 alpha steps: 10%–90%).
		 *
		 * @param {{r:number,g:number,b:number}|null} rgba Base color.
		 * @returns {string} HTML palette swatch elements.
		 */
		_buildTransBars: function (rgba) {
			if (!rgba) { return ''; }
			var html = '';
			for (var i = 1; i <= 9; i++) {
				var alpha = i / 10;
				var color = 'rgba(' + rgba.r + ', ' + rgba.g + ', ' + rgba.b + ', ' + alpha + ')';
				html += '<span class="eff-palette-swatch" style="background:' + color + '"></span>';
			}
			return html;
		},

		// -----------------------------------------------------------------------
		// EVENT BINDING
		// -----------------------------------------------------------------------

		/**
		 * Bind all interactive events after rendering.
		 *
		 * Uses event delegation on the container for efficiency.
		 *
		 * @param {HTMLElement} container The #eff-edit-content element.
		 */
		_bindEvents: function (container) {
			var self = this;

			// ---- Filter bar: search ----
			var searchInput = container.querySelector('#eff-colors-search');
			if (searchInput) {
				searchInput.addEventListener('input', function () {
					self._filterRows(container, this.value);
				});
			}

			// ---- Filter bar: back / close button ----
			var backBtn = container.querySelector('#eff-colors-back');
			if (backBtn) {
				backBtn.addEventListener('click', function () {
					self._closeColorsView();
				});
			}

			// ---- Filter bar: expand/collapse all toggle ----
			var toggleBtn = container.querySelector('#eff-colors-collapse-toggle');
			if (toggleBtn) {
				toggleBtn.addEventListener('click', function () {
					var state      = toggleBtn.getAttribute('data-toggle-state');
					var collapse   = (state !== 'collapsed'); // toggle
					self._setAllCollapsed(container, collapse);
				});
			}

			// ---- Filter bar: add category ----
			var addCatBtn = container.querySelector('#eff-colors-add-category');
			if (addCatBtn) {
				addCatBtn.addEventListener('click', function () {
					self._addCategory();
				});
			}

			// ---- Delegated events — bound only once to prevent listener accumulation ----
			// The container element persists across re-renders; only its innerHTML is
			// replaced. Without this guard, each _renderAll call adds another copy of
			// every delegated handler, causing collapse/expand to double-fire and
			// immediately undo themselves, and the timing-based double-click detection
			// to falsely trigger on single clicks.
			if (container._effEventsBound) { return; }
			container._effEventsBound = true;
			self._initCatDrag(container);
			self._initDrag(container);

			// ---- Delegated click events on category blocks ----
			container.addEventListener('click', function (e) {
				var target = e.target;

				// Find nearest element with data-action (button or span).
				var btn    = target.closest('[data-action]');
				if (!btn) { return; }

				var action = btn.getAttribute('data-action');
				var block  = btn.closest('.eff-category-block');
				var catId  = block ? block.getAttribute('data-category-id') : null;

				switch (action) {

					case 'duplicate': if (catId) { self._duplicateCategory(catId); } break;
					case 'move-up':   if (catId) { self._moveCategoryUp(catId); } break;
					case 'move-down': if (catId) { self._moveCategoryDown(catId); } break;
					case 'add-var':   if (catId) { self._addVariable(catId); } break;
					case 'delete':    if (catId) { self._deleteCategory(catId); } break;

					case 'delete-var': {
						var varId = btn.getAttribute('data-var-id');
						if (varId) { self._deleteVariable(varId); }
						break;
					}

					case 'collapse':
						if (block) {
							var isCollapsed = block.getAttribute('data-collapsed') === 'true';
							var newCollapsed = !isCollapsed;
							block.setAttribute('data-collapsed', String(newCollapsed));
							// Track for re-renders.
							if (catId) { _collapsedCategoryIds[catId] = newCollapsed; }
						}
						break;

					case 'expand':
						var row   = btn.closest('.eff-color-row');
						var varId = row ? row.getAttribute('data-var-id') : null;
						if (varId !== null) { self._toggleExpandPanel(varId, row, container); }
						break;

					case 'open-picker':
						var swatchRow = target.closest('.eff-color-row');
						var swVarId   = swatchRow ? swatchRow.getAttribute('data-var-id') : null;
						if (swVarId !== null) { self._toggleExpandPanel(swVarId, swatchRow, container); }
						break;
				}
			});

			// ---- Column sort buttons (in .eff-color-list-header) ----
			container.addEventListener('click', function (e) {
				var sortBtn = e.target.closest('.eff-col-sort-btn');
				if (!sortBtn) { return; }
				var sCatId  = sortBtn.getAttribute('data-cat-id');
				var sCol    = sortBtn.getAttribute('data-sort-col');
				var sDir    = sortBtn.getAttribute('data-sort-dir');
				var nextDir = sDir === 'none' ? 'asc' : (sDir === 'asc' ? 'desc' : 'none');
				_catSortState[sCatId] = { field: sCol, dir: nextDir };
				self._sortVarsInCategory(sCatId, sCol, nextDir, container);
			});

			// ---- Name / Category name: single-click to start editing ----
			// .eff-color-name-input uses readonly attr; .eff-category-name-input uses contenteditable.
			container.addEventListener('mousedown', function (e) {
				var input = e.target.closest('.eff-color-name-input, .eff-category-name-input');
				if (!input) { return; }
				if (input.getAttribute('data-locked') === 'true') { return; }

				var isCat     = input.classList.contains('eff-category-name-input');
				var isEditing = isCat
					? (input.getAttribute('contenteditable') === 'true')
					: !input.hasAttribute('readonly');
				if (isEditing) { return; }

				// Single click activates editing immediately.
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


			// Tooltip delegation is handled globally by EFF.PanelTop._bindTooltips()
			// via document-level delegated listeners. No local binding needed here.
			container.addEventListener('mouseenter', function (e) {
				var el = e.target ? e.target.closest('[data-eff-tooltip]') : null;
				if (!el) { return; }
				var tip = document.getElementById('eff-tooltip');
				if (!tip) { return; }
				return; /* EFF.PanelTop._bindTooltips handles all tooltips via document delegation */
			tip.textContent = el.getAttribute('data-eff-tooltip'); /* unreachable */
				var rect = el.getBoundingClientRect();
				var scrollY = window.scrollY || document.documentElement.scrollTop;
				tip.style.left      = (rect.left + rect.width / 2) + 'px';
				tip.style.top       = (rect.bottom + scrollY + 6) + 'px';
				tip.style.transform = 'translateX(-50%)';
				tip.setAttribute('aria-hidden', 'false');
				tip.classList.add('is-visible');
			}, true);

			container.addEventListener('mouseleave', function (e) {
				var el = e.target ? e.target.closest('[data-eff-tooltip]') : null;
				if (!el) { return; }
				var tip = document.getElementById('eff-tooltip');
				if (tip) {
					return; /* EFF.PanelTop._bindTooltips handles all tooltips */
				tip.classList.remove('is-visible'); /* unreachable */
					tip.setAttribute('aria-hidden', 'true');
				}
			}, true);

			// ---- Restore readonly/contenteditable on focusout ----
			container.addEventListener('focusout', function (e) {
				var nameInput = e.target.closest('.eff-color-name-input');
				if (nameInput) { nameInput.setAttribute('readonly', ''); return; }
				var catInput = e.target.closest('.eff-category-name-input');
				if (catInput && catInput.getAttribute('data-locked') !== 'true') {
					// Save the name, then deactivate editing.
					self._saveCategoryName(catInput);
					catInput.setAttribute('contenteditable', 'false');
				}
			});

			// ---- Category name span: Enter to confirm, Escape to revert ----
			// (change event does not fire on contenteditable; saving is in focusout above)
			container.addEventListener('keydown', function (e) {
				var catInput = e.target.closest('.eff-category-name-input');
				if (!catInput) { return; }
				if (e.key === 'Enter') {
					e.preventDefault(); // Prevent <br> insertion in contenteditable.
					catInput.blur();
				} else if (e.key === 'Escape') {
					var oldName = catInput.getAttribute('data-original') || '';
					catInput.textContent = oldName;
					catInput.setAttribute('contenteditable', 'false');
					catInput.blur();
				}
			});

			// ---- Name input: live '--' prefix guard + save on blur ----
			container.addEventListener('input', function (e) {
				var nameInput = e.target.closest('.eff-color-name-input');
				if (!nameInput) { return; }
				var val = nameInput.value;
				if (val.slice(0, 2) !== '--') {
					nameInput.value = '--' + val.replace(/^-*/, '');
				}
			});
			container.addEventListener('change', function (e) {
				var nameInput = e.target.closest('.eff-color-name-input');
				if (!nameInput) { return; }
				var row   = nameInput.closest('.eff-color-row');
				var varId = row ? row.getAttribute('data-var-id') : null;
				if (varId !== null) { self._saveVarName(varId, nameInput); }
			});
			container.addEventListener('keydown', function (e) {
				if (e.key !== 'Enter') { return; }
				var nameInput = e.target.closest('.eff-color-name-input');
				if (!nameInput) { return; }
				nameInput.blur();
			});

			// ---- Value input: save on blur and Enter ----
			container.addEventListener('change', function (e) {
				var valueInput = e.target.closest('.eff-color-value-input');
				if (!valueInput) { return; }
				var row   = valueInput.closest('.eff-color-row');
				var varId = row ? row.getAttribute('data-var-id') : null;
				if (varId === null) { return; }
				var vv  = self._findVarByKey(varId);
				var fmt = vv ? (vv.format || 'HEX') : 'HEX';
				var res = self._normalizeColorValue(valueInput.value, fmt);
				if (res.error) {
					self._showFieldError(valueInput, res.error);
					valueInput.value = valueInput.getAttribute('data-original') || '';
					return;
				}
				self._clearFieldError(valueInput);
				if (res.value !== valueInput.value) { valueInput.value = res.value; }
				self._saveVarValue(varId, res.value, valueInput);
			});
			container.addEventListener('keydown', function (e) {
				if (e.key !== 'Enter') { return; }
				var valueInput = e.target.closest('.eff-color-value-input');
				if (!valueInput) { return; }
				valueInput.blur();
			});

			// ---- Format selector: save on change ----
			container.addEventListener('change', function (e) {
				var formatSel = e.target.closest('.eff-color-format-sel');
				if (!formatSel) { return; }
				var row   = formatSel.closest('.eff-color-row');
				var varId = row ? row.getAttribute('data-var-id') : null;
				if (varId !== null) { self._saveVarFormat(varId, formatSel.value); }
			});
		},

		// -----------------------------------------------------------------------
		// NAVIGATION HELPERS
		// -----------------------------------------------------------------------

		/**
		 * Close the Colors view and return to the placeholder / main page.
		 *
		 * Clears nav active state, hides edit content, restores placeholder.
		 */
		_closeColorsView: function () {
			// Clear nav selection.
			if (EFF.PanelLeft && EFF.PanelLeft.clearSelection) {
				EFF.PanelLeft.clearSelection();
			}

			// Hide content, show placeholder.
			var content     = document.getElementById('eff-edit-content');
			var placeholder = document.getElementById('eff-placeholder');
			var workspace   = document.getElementById('eff-workspace');

			if (content) {
				content.setAttribute('hidden', '');
				content.style.display = '';
				content.innerHTML = '';
			}
			if (placeholder) {
				placeholder.style.display = '';
			}
			if (workspace) {
				workspace.removeAttribute('data-active');
			}

			EFF.state.currentSelection = null;
			_focusedCategoryId = null;
			this._openExpandId = null;
		},

		/**
		 * Scroll to and expand a specific category block.
		 *
		 * Called after render when a nav item was clicked.
		 *
		 * @param {string}      catId     Category UUID to focus.
		 * @param {HTMLElement} container The edit-content container.
		 */
		_jumpToCategory: function (catId, container) {
			var block = container.querySelector('.eff-category-block[data-category-id="' + catId + '"]');
			if (!block) { return; }

			// Ensure it is expanded.
			block.setAttribute('data-collapsed', 'false');
			_collapsedCategoryIds[catId] = false;

			// Scroll the block into view.
			block.scrollIntoView({ behavior: 'smooth', block: 'start' });
		},

		// -----------------------------------------------------------------------
		// EXPAND PANEL
		// -----------------------------------------------------------------------

		/**
		 * Toggle the expand modal for a given variable row.
		 *
		 * @param {string}      varId     Variable ID.
		 * @param {HTMLElement} row       The .eff-color-row element.
		 * @param {HTMLElement} container The content container.
		 */
		_toggleExpandPanel: function (varId, row, container) {
			var self = this;

			if (self._openExpandId === varId) {
				// Same row clicked again — animate closed.
				self._closeExpandPanel(container, false);
				return;
			}

			// Different row (or first open) — remove old modal instantly so there
			// is never two .eff-expand-modal elements in the DOM at once.
			self._closeExpandPanel(container, true);

			var v = self._findVarByKey(varId);
			if (!v) { return; }

			row.setAttribute('data-expanded', 'true');
			var expandBtn = row.querySelector('.eff-color-expand-btn');
			if (expandBtn) { expandBtn.setAttribute('aria-expanded', 'true'); }

			var backdrop = document.createElement('div');
			backdrop.className = 'eff-expand-backdrop';
			backdrop.setAttribute('data-expand-backdrop', varId);

			var modal = document.createElement('div');
			modal.className = 'eff-expand-modal';
			modal.setAttribute('data-expand-modal', varId);
			modal.innerHTML = self._buildModalContent(v, varId);

			// Set transform-origin to the row's centre so the card appears to
			// grow out of (and shrink back into) the clicked row.
			var rowRect    = row.getBoundingClientRect();
			var rowCenterX = rowRect.left + rowRect.width  / 2;
			var rowCenterY = rowRect.top  + rowRect.height / 2;
			var dx = Math.round(rowCenterX - window.innerWidth  / 2);
			var dy = Math.round(rowCenterY - window.innerHeight / 2);
			modal.style.transformOrigin =
				'calc(50% + ' + dx + 'px) calc(50% + ' + dy + 'px)';

			document.body.appendChild(backdrop);
			document.body.appendChild(modal);

			// Trigger open animation on next tick.
			setTimeout(function () { modal.classList.add('is-open'); }, 10);

			self._openExpandId = varId;
			self._bindModalEvents(modal, backdrop, v, varId, row, container);
		},

		/**
		 * Close any open expand modal.
		 *
		 * @param {HTMLElement} container
		 */
		_closeExpandPanel: function (container, immediate) {
			if (!this._openExpandId) { return; }

			var backdrop = document.querySelector('.eff-expand-backdrop[data-expand-backdrop]');
			if (backdrop && backdrop.parentNode) { backdrop.parentNode.removeChild(backdrop); }

			var modal = document.querySelector('.eff-expand-modal[data-expand-modal]');
			if (modal) {
				if (immediate) {
					// Switching to a new modal — remove the old one instantly so
					// there is never more than one .eff-expand-modal in the DOM.
					if (modal.parentNode) { modal.parentNode.removeChild(modal); }
				} else {
					modal.classList.remove('is-open');
					var _modal = modal;
					setTimeout(function () {
						if (_modal.parentNode) { _modal.parentNode.removeChild(_modal); }
					}, 420);
				}
			}

			if (container) {
				var row = container.querySelector('.eff-color-row[data-var-id="' + this._openExpandId + '"]');
				if (row) {
					row.removeAttribute('data-expanded');
					var expandBtn = row.querySelector('.eff-color-expand-btn');
					if (expandBtn) { expandBtn.setAttribute('aria-expanded', 'false'); }
				}
			}

			this._openExpandId = null;
		},

		/**
		 * Bind all interactive events directly on the modal card.
		 * (Modal is appended to document.body, so container delegation won't reach it.)
		 *
		 * @param {HTMLElement} modal     The .eff-expand-modal element.
		 * @param {HTMLElement} backdrop  The .eff-expand-backdrop element.
		 * @param {Object}      v         Variable object.
		 * @param {string}      varId     Variable row key.
		 * @param {HTMLElement} row       The .eff-color-row element.
		 * @param {HTMLElement} container The content container.
		 */
		_bindModalEvents: function (modal, backdrop, v, varId, row, container) {
			var self = this;

			// Backdrop click — close modal.
			backdrop.addEventListener('click', function () {
				self._closeExpandPanel(container, false);
			});

			// Close button.
			var closeBtn = modal.querySelector('.eff-modal-close-btn');
			if (closeBtn) {
				closeBtn.addEventListener('click', function () {
					self._closeExpandPanel(container, false);
				});
			}

			// Name input — save on blur / Enter; protect leading '--' prefix.
			var nameInput = modal.querySelector('.eff-color-name-input');
			if (nameInput) {
				nameInput.addEventListener('input', function () {
					var val = nameInput.value;
					if (val.slice(0, 2) !== '--') {
						nameInput.value = '--' + val.replace(/^-*/, '');
					}
				});
				nameInput.addEventListener('change', function () {
					self._saveVarName(varId, nameInput);
				});
				nameInput.addEventListener('keydown', function (e) {
					if (e.key === 'Enter') { nameInput.blur(); }
				});
			}

			// Value input — save on blur / Enter; sync swatch in header live.
			var valueInput = modal.querySelector('.eff-color-value-input');
			if (valueInput) {
				valueInput.addEventListener('input', function () {
					// Live swatch update while typing.
					var swatch = modal.querySelector('.eff-color-swatch');
					if (swatch) { swatch.style.background = valueInput.value; }
				});
				valueInput.addEventListener('change', function () {
					var vv  = self._findVarByKey(varId);
					var fmt = vv ? (vv.format || 'HEX') : 'HEX';
					var res = self._normalizeColorValue(valueInput.value, fmt);
					if (res.error) {
						self._showFieldError(valueInput, res.error);
						valueInput.value = valueInput.getAttribute('data-original') || '';
						return;
					}
					self._clearFieldError(valueInput);
					if (res.value !== valueInput.value) { valueInput.value = res.value; }
					self._saveVarValue(varId, res.value, valueInput);
					var swatch = modal.querySelector('.eff-color-swatch');
					if (swatch) { swatch.style.background = res.value; }
				});
				valueInput.addEventListener('keydown', function (e) {
					if (e.key === 'Enter') { valueInput.blur(); }
				});
			}

			// Format selector — save on change and update modal header live.
			var formatSel = modal.querySelector('.eff-color-format-sel');
			if (formatSel) {
				formatSel.addEventListener('change', function () {
					self._saveVarFormat(varId, formatSel.value);
					// _saveVarFormat updates v.value in state; reflect in modal header.
					var vv = self._findVarByKey(varId);
					if (vv) {
						if (valueInput) {
							valueInput.value = vv.value;
							valueInput.setAttribute('data-original', vv.value);
						}
						var modalSwatch = modal.querySelector('.eff-color-swatch');
						if (modalSwatch) { modalSwatch.style.background = vv.value; }
					}
				});
			}

			// Tints number — live preview.
			var tintsNum = modal.querySelector('.eff-gen-tints-num');
			if (tintsNum) {
				tintsNum.addEventListener('input', function () {
					var steps = parseInt(tintsNum.value, 10) || 0;
					if (steps < 0) { steps = 0; }
					if (steps > 10) { steps = 10; }
					tintsNum.value = steps; // clamp displayed value
					var palette = modal.querySelector('.eff-tints-palette');
					var vv      = self._findVarByKey(varId);
					var rgba2   = vv ? self._parseToRgba(vv.value || '') : null;
					var hsl2    = rgba2 ? self._rgbToHsl(rgba2.r, rgba2.g, rgba2.b) : null;
					if (palette) { palette.innerHTML = self._buildTintsBars(hsl2, steps); }
					if (vv) { self._debounceGenerate(varId, modal); }
				});
			}

			// Shades number — live preview.
			var shadesNum = modal.querySelector('.eff-gen-shades-num');
			if (shadesNum) {
				shadesNum.addEventListener('input', function () {
					var steps = parseInt(shadesNum.value, 10) || 0;
					if (steps < 0) { steps = 0; }
					if (steps > 10) { steps = 10; }
					shadesNum.value = steps; // clamp displayed value
					var palette = modal.querySelector('.eff-shades-palette');
					var vv      = self._findVarByKey(varId);
					var rgba2   = vv ? self._parseToRgba(vv.value || '') : null;
					var hsl2    = rgba2 ? self._rgbToHsl(rgba2.r, rgba2.g, rgba2.b) : null;
					if (palette) { palette.innerHTML = self._buildShadesBars(hsl2, steps); }
					if (vv) { self._debounceGenerate(varId, modal); }
				});
			}

			// Transparencies toggle — live preview.
			var transChk = modal.querySelector('.eff-gen-trans-toggle');
			if (transChk) {
				transChk.addEventListener('change', function () {
					var isOn    = transChk.checked;
					var palette = modal.querySelector('.eff-trans-palette');
					var vv      = self._findVarByKey(varId);
					var rgba2   = vv ? self._parseToRgba(vv.value || '') : null;
					if (palette) { palette.innerHTML = isOn ? self._buildTransBars(rgba2) : ''; }
					if (vv) { self._debounceGenerate(varId, modal); }
				});
			}

			// Move to category select.
			var moveCatSel = modal.querySelector('.eff-cat-move-select');
			if (moveCatSel) {
				moveCatSel.addEventListener('change', function () {
					var newCatId = moveCatSel.value;
					if (newCatId) {
						self._closeExpandPanel(container, false);
						self._moveVarToCategory(varId, newCatId);
					}
				});
			}
		},

		// -----------------------------------------------------------------------
		// VARIABLE SAVE HELPERS
		// -----------------------------------------------------------------------

		/**
		 * Save a variable's name after editing.
		 *
		 * @param {string}      varId     Variable ID.
		 * @param {HTMLElement} nameInput The name <input> element.
		 */
		_saveVarName: function (varId, nameInput) {
			var self    = this;
			var newName = nameInput.value.trim();
			var oldName = nameInput.getAttribute('data-original') || '';

			if (newName === oldName) { return; }

			if (!/^--[\w-]+$/.test(newName)) {
				nameInput.value = oldName; // Revert.
				self._showFieldError(nameInput, 'Name must start with -- and contain only letters, numbers, dashes, and underscores. Example: --my-color');
				return;
			}

			var v = self._findVarByKey(varId);
			if (!v) { return; }

			// Update status in state and dot in the main-list row immediately.
			v.status = 'modified';
			var content = document.getElementById('eff-edit-content');
			if (content) {
				var listRow = content.querySelector('.eff-color-row[data-var-id="' + self._esc(varId) + '"]');
				var listDot = listRow ? listRow.querySelector('.eff-status-dot') : null;
				if (listDot) { listDot.style.background = self._statusColor('modified'); }
			}

			pushUndo({ type: 'name-change', id: v.id, oldValue: oldName, newValue: newName });

			var updateData = {
				id:                  v.id,
				name:                newName,
				pending_rename_from: oldName,
				status:              'modified',
			};

			self._ajaxSaveColor(updateData, function () {
				nameInput.setAttribute('data-original', newName);
				if (EFF.App) { EFF.App.setDirty(true); EFF.App.setPendingCommit(true); }
			});
		},

		/**
		 * Save a variable's value after editing.
		 *
		 * @param {string}          varId    Variable ID.
		 * @param {string}          newValue New CSS value string.
		 * @param {HTMLElement|null} input   The input element to update data-original on.
		 */
		_saveVarValue: function (varId, newValue, input) {
			var self = this;
			var v    = self._findVarByKey(varId);
			if (!v) { return; }

			var oldValue = v.value || '';
			if (newValue === oldValue) { return; }

			// Update state immediately so subsequent lookups see the new value.
			v.value  = newValue;
			v.status = 'modified';

			// Update the main-list row swatch, value, and status dot in place.
			var content = document.getElementById('eff-edit-content');
			if (content) {
				var listRow = content.querySelector('.eff-color-row[data-var-id="' + self._esc(varId) + '"]');
				if (listRow) {
					var listSwatch = listRow.querySelector('.eff-color-swatch');
					if (listSwatch) { listSwatch.style.background = newValue; }
					var listVal = listRow.querySelector('.eff-color-value-input');
					if (listVal) { listVal.value = newValue; }
					var listDot = listRow.querySelector('.eff-status-dot');
					if (listDot) { listDot.style.background = self._statusColor('modified'); }
				}
			}

			pushUndo({ type: 'value-change', id: v.id, oldValue: oldValue, newValue: newValue });

			var updateData = {
				id:     v.id,
				value:  newValue,
				status: 'modified',
			};

			self._ajaxSaveColor(updateData, function () {
				if (input) { input.setAttribute('data-original', newValue); }
				if (EFF.App) { EFF.App.setDirty(true); EFF.App.setPendingCommit(true); }
			});
		},

		/**
		 * Save a variable's format after selection change.
		 * Converts the current value to the new format before saving.
		 *
		 * @param {string} varId     Row key.
		 * @param {string} newFormat New format string.
		 */
		_saveVarFormat: function (varId, newFormat) {
			var self = this;
			var v    = self._findVarByKey(varId);
			if (!v) { return; }

			var converted = self._convertColor(v.value || '', newFormat);

			// Update state immediately (client-side, no file required).
			v.format = newFormat;
			if (converted !== null) { v.value = converted; }
			v.status = 'modified';

			// Update DOM immediately.
			var content = document.getElementById('eff-edit-content');
			if (content) {
				var row = content.querySelector('.eff-color-row[data-var-id="' + self._esc(varId) + '"]');
				if (row) {
					if (converted !== null) {
						var valInput = row.querySelector('.eff-color-value-input');
						if (valInput) { valInput.value = converted; valInput.setAttribute('data-original', converted); }
						var swatch = row.querySelector('.eff-color-swatch');
						if (swatch) { swatch.style.background = converted; }
					}
					var dot = row.querySelector('.eff-status-dot');
					if (dot) { dot.style.background = self._statusColor('modified'); }
				}
			}

			if (EFF.App) { EFF.App.setDirty(true); }

			// Persist via AJAX if a file is loaded (include name for PHP fallback lookup).
			var updateData = { id: v.id, name: v.name, format: newFormat };
			if (converted !== null) { updateData.value = converted; }

			self._ajaxSaveColor(updateData, function () {
				if (EFF.App) { EFF.App.setPendingCommit(true); }
			});
		},

		/**
		 * Send eff_save_color AJAX and update EFF.state.variables on success.
		 *
		 * @param {Object}   variableData Partial variable object with at least { id }.
		 * @param {Function} onSuccess    Called on success.
		 */
		_ajaxSaveColor: function (variableData, onSuccess) {
			var self = this;

			if (!EFF.state.currentFile) { return; }

			EFF.App.ajax('eff_save_color', {
				filename: EFF.state.currentFile,
				variable: JSON.stringify(variableData),
			}).then(function (res) {
				if (res.success) {
					if (res.data && res.data.data && res.data.data.variables) {
						EFF.state.variables = res.data.data.variables;
					}
					if (onSuccess) { onSuccess(res.data); }
				}
			}).catch(function () {});
		},

		// -----------------------------------------------------------------------
		// ADD / DELETE VARIABLE
		// -----------------------------------------------------------------------

		/**
		 * Add a new blank variable to a category.
		 *
		 * @param {string} catId Category ID.
		 */
		_addVariable: function (catId) {
			var self = this;

			if (!EFF.state.currentFile) {
				// No project file yet — save the current state to a temp file first so
				// PHP has the full variable list when we subsequently call eff_save_color.
				EFF.state.currentFile = 'eff-temp.eff.json';
				if (EFF.PanelRight && EFF.PanelRight._filenameInput) {
					EFF.PanelRight._filenameInput.value = 'eff-temp.eff.json';
				}
				var initData = {
					version:   '1.0',
					config:    EFF.state.config    || {},
					variables: EFF.state.variables || [],
				};
				EFF.App.ajax('eff_save_file', {
					filename: EFF.state.currentFile,
					data:     JSON.stringify(initData),
				}).then(function (initRes) {
					if (initRes && initRes.success) {
						self._addVariable(catId);
					} else {
						EFF.state.currentFile = null;
						if (EFF.PanelRight && EFF.PanelRight._filenameInput) {
							EFF.PanelRight._filenameInput.value = '';
						}
						EFF.Modal.open({ title: 'Error', body: '<p>Could not initialize project file. Please try again.</p>' });
					}
				}).catch(function () {
					EFF.state.currentFile = null;
					if (EFF.PanelRight && EFF.PanelRight._filenameInput) {
						EFF.PanelRight._filenameInput.value = '';
					}
					EFF.Modal.open({ title: 'Connection error', body: '<p>Could not create project file. Please try again.</p>' });
				});
				return;
			}


			var cats = (EFF.state.config && EFF.state.config.categories) || [];
			var cat  = null;
			for (var i = 0; i < cats.length; i++) {
				if (cats[i].id === catId) { cat = cats[i]; break; }
			}
			var catName = cat ? cat.name : '';

			var newVar = {
				name:        '--new-color',
				value:       '#000000',
				type:        'color',
				subgroup:    'Colors',
				category:    catName,
				category_id: catId,
				format:      'HEX',
				status:      'new',
			};

			EFF.App.ajax('eff_save_color', {
				filename: EFF.state.currentFile,
				variable: JSON.stringify(newVar),
			}).then(function (res) {
				if (res.success && res.data && res.data.data) {
					EFF.state.variables = res.data.data.variables || EFF.state.variables;
					if (EFF.App) { EFF.App.setDirty(true); EFF.App.setPendingCommit(true); EFF.App.refreshCounts(); }
					_collapsedCategoryIds[catId] = false;
					self._rerenderView();
				} else if (!res.success) {
					var msg = (res.data && res.data.message) ? res.data.message : 'Could not add variable.';
					EFF.Modal.open({ title: 'Add variable failed', body: '<p>' + msg + '</p>' });
				}
			}).catch(function () {
				EFF.Modal.open({ title: 'Connection error', body: '<p>Could not add color variable. Please try again.</p>' });
			});
		},

		// -----------------------------------------------------------------------
		// CATEGORY ACTIONS
		// -----------------------------------------------------------------------

		/**
		 * Open a modal prompt to add a new category.
		 */
		_addCategory: function () {
			var self = this;

			if (!EFF.state.currentFile) {
				self._noFileModal();
				return;
			}

			EFF.Modal.open({
				title: 'New Category',
				body:  '<p style="margin-bottom:10px">Enter a name for the new category.</p>'
					+ '<input type="text" class="eff-field-input" id="eff-modal-cat-name"'
					+ ' placeholder="e.g., Accent" autocomplete="off" style="width:100%">',
				footer: '<div style="display:flex;justify-content:flex-end;gap:8px">'
					+ '<button class="eff-btn eff-btn--secondary" id="eff-modal-cat-cancel">Cancel</button>'
					+ '<button class="eff-btn" id="eff-modal-cat-ok">Add Category</button>'
					+ '</div>',
			});

			// Focus the input.
			setTimeout(function () {
				var input = document.getElementById('eff-modal-cat-name');
				if (input) { input.focus(); }
			}, 50);

			function handleClick(e) {
				if (e.target.id === 'eff-modal-cat-cancel') {
					EFF.Modal.close();
					document.removeEventListener('click', handleClick);
				} else if (e.target.id === 'eff-modal-cat-ok') {
					var input = document.getElementById('eff-modal-cat-name');
					var name  = input ? input.value.trim() : '';
					EFF.Modal.close();
					document.removeEventListener('click', handleClick);

					if (!name) { return; }

					EFF.App.ajax('eff_save_category', {
						filename: EFF.state.currentFile,
						category: JSON.stringify({ name: name }),
					}).then(function (res) {
						if (res.success && res.data) {
							if (!EFF.state.config) { EFF.state.config = {}; }
							EFF.state.config.categories = res.data.categories;
							if (EFF.App) { EFF.App.setDirty(true); }
							self._rerenderView();
							if (EFF.PanelLeft && EFF.PanelLeft.refresh) {
								EFF.PanelLeft.refresh();
							}
						}
					}).catch(function () {});
				}
			}

			document.addEventListener('click', handleClick);
		},

		/**
		 * Save a category name from the always-on name input.
		 *
		 * @param {HTMLElement} input The .eff-category-name-input element.
		 */
		_saveCategoryName: function (input) {
			var self    = this;
			var newName = input.textContent.trim();
			var oldName = input.getAttribute('data-original') || '';
			var catId   = input.getAttribute('data-cat-id') || '';

			if (!newName || newName === oldName) {
				input.textContent = oldName;
				return;
			}

			if (!EFF.state.currentFile) {
				input.textContent = oldName;
				self._noFileModal();
				return;
			}

			EFF.App.ajax('eff_save_category', {
				filename: EFF.state.currentFile,
				category: JSON.stringify({ id: catId, name: newName }),
			}).then(function (res) {
				if (res.success && res.data) {
					if (!EFF.state.config) { EFF.state.config = {}; }
					EFF.state.config.categories = res.data.categories;
					input.setAttribute('data-original', newName);
					if (EFF.App) { EFF.App.setDirty(true); }
					self._rerenderView();
					if (EFF.PanelLeft && EFF.PanelLeft.refresh) {
						EFF.PanelLeft.refresh();
					}
				} else {
					input.textContent = oldName;
				}
			}).catch(function () { input.textContent = oldName; });
		},

		/**
		 * Start an inline rename for a category.
		 *
		 * @deprecated Category name is now an always-on input; kept for reference.
		 * @param {HTMLElement} block Category block element.
		 * @param {string}      catId Category ID.
		 */
		_startCategoryRename: function (block, catId) {
			var self       = this;
			var nameSpan   = block ? block.querySelector('.eff-category-name') : null;
			if (!nameSpan) { return; }

			// If already a rename input is active, do nothing.
			if (nameSpan.tagName === 'INPUT') { return; }

			var currentName = nameSpan.textContent || '';

			var input     = document.createElement('input');
			input.type    = 'text';
			input.className = 'eff-category-name-input';
			input.value   = currentName;
			input.setAttribute('aria-label', 'Category name');

			nameSpan.parentNode.replaceChild(input, nameSpan);
			input.focus();
			input.select();

			function revert() {
				var span = document.createElement('span');
				span.className    = 'eff-category-name';
				span.setAttribute('data-action', 'rename');
				span.setAttribute('title', 'Click to rename');
				span.setAttribute('tabindex', '0');
				span.setAttribute('role', 'button');
				span.setAttribute('aria-label', 'Rename ' + currentName);
				span.textContent = currentName;
				if (input.parentNode) {
					input.parentNode.replaceChild(span, input);
				}
			}

			function commit() {
				var newName = input.value.trim();
				if (!newName || newName === currentName) {
					revert();
					return;
				}

				if (!EFF.state.currentFile) {
					revert();
					self._noFileModal();
					return;
				}

				EFF.App.ajax('eff_save_category', {
					filename: EFF.state.currentFile,
					category: JSON.stringify({ id: catId, name: newName }),
				}).then(function (res) {
					if (res.success && res.data) {
						if (!EFF.state.config) { EFF.state.config = {}; }
						EFF.state.config.categories = res.data.categories;
						if (EFF.App) { EFF.App.setDirty(true); }
						self._rerenderView();
						if (EFF.PanelLeft && EFF.PanelLeft.refresh) {
							EFF.PanelLeft.refresh();
						}
					} else {
						revert();
					}
				}).catch(function () { revert(); });
			}

			input.addEventListener('blur', commit);
			input.addEventListener('keydown', function (e) {
				if (e.key === 'Enter') { input.blur(); }
				if (e.key === 'Escape') {
					input.removeEventListener('blur', commit);
					revert();
				}
			});
		},

		/**
		 * Delete a category with confirmation modal.
		 *
		 * @param {string} catId Category ID.
		 */
		_deleteCategory: function (catId) {
			var self = this;
			var vars = self._getVarsForCategoryId(catId);

			if (!EFF.state.currentFile) {
				self._noFileModal();
				return;
			}

			var bodyText = vars.length > 0
				? '<p>' + vars.length + ' variable(s) are in this category. Variables will be moved to Uncategorized.</p><p style="margin-top:8px">Delete the category anyway?</p>'
				: '<p>Delete this category?</p>';

			EFF.Modal.open({
				title: 'Delete Category',
				body:  bodyText,
				footer: '<div style="display:flex;justify-content:flex-end;gap:8px">'
					+ '<button class="eff-btn eff-btn--secondary" id="eff-modal-del-cancel">Cancel</button>'
					+ '<button class="eff-btn eff-btn--danger" id="eff-modal-del-ok">Delete Category</button>'
					+ '</div>',
			});

			function handleClick(e) {
				if (e.target.id === 'eff-modal-del-cancel') {
					EFF.Modal.close();
					document.removeEventListener('click', handleClick);
				} else if (e.target.id === 'eff-modal-del-ok') {
					EFF.Modal.close();
					document.removeEventListener('click', handleClick);

					EFF.App.ajax('eff_delete_category', {
						filename:    EFF.state.currentFile,
						category_id: catId,
					}).then(function (res) {
						if (res.success && res.data) {
							if (!EFF.state.config) { EFF.state.config = {}; }
							EFF.state.config.categories = res.data.categories;
							delete _collapsedCategoryIds[catId];
							if (EFF.App) { EFF.App.setDirty(true); }
							self._rerenderView();
							if (EFF.PanelLeft && EFF.PanelLeft.refresh) {
								EFF.PanelLeft.refresh();
							}
						} else if (!res.success) {
							var errMsg = (res.data && res.data.message) ? res.data.message : 'Delete failed.';
							EFF.Modal.open({ title: 'Delete failed', body: '<p>' + errMsg + '</p>' });
						}
					}).catch(function () {
						EFF.Modal.open({ title: 'Connection error', body: '<p>Connection error during delete.</p>' });
					});
				}
			}

			document.addEventListener('click', handleClick);
		},

		/**
		 * Move a category up in display order.
		 *
		 * @param {string} catId Category ID to move up.
		 */
		_moveCategoryUp: function (catId) {
			var self = this;

			var hasCats = EFF.state.config && EFF.state.config.categories && EFF.state.config.categories.length > 0;
			var cats = hasCats
				? EFF.state.config.categories.slice().sort(function (a, b) {
					return (a.order || 0) - (b.order || 0);
				})
				: self._getDefaultCategories();
			if (!hasCats) {
				if (!EFF.state.config) { EFF.state.config = {}; }
				EFF.state.config.categories = cats.map(function (c, i) { return { id: c.id, name: c.name, order: i, locked: !!c.locked }; });
			}

			var idx = -1;
			for (var i = 0; i < cats.length; i++) {
				if (cats[i].id === catId) { idx = i; break; }
			}
			if (idx <= 0) { return; }

			var tmp     = cats[idx - 1];
			cats[idx - 1] = cats[idx];
			cats[idx]     = tmp;

			var orderedIds = cats.map(function (c) { return c.id; });
			self._ajaxReorderCategories(orderedIds);
		},

		/**
		 * Move a category down in display order.
		 *
		 * @param {string} catId Category ID to move down.
		 */
		_moveCategoryDown: function (catId) {
			var self = this;

			var hasCats = EFF.state.config && EFF.state.config.categories && EFF.state.config.categories.length > 0;
			var cats = hasCats
				? EFF.state.config.categories.slice().sort(function (a, b) {
					return (a.order || 0) - (b.order || 0);
				})
				: self._getDefaultCategories();
			if (!hasCats) {
				if (!EFF.state.config) { EFF.state.config = {}; }
				EFF.state.config.categories = cats.map(function (c, i) { return { id: c.id, name: c.name, order: i, locked: !!c.locked }; });
			}

			var idx = -1;
			for (var i = 0; i < cats.length; i++) {
				if (cats[i].id === catId) { idx = i; break; }
			}
			if (idx < 0 || idx >= cats.length - 1) { return; }

			var tmp     = cats[idx + 1];
			cats[idx + 1] = cats[idx];
			cats[idx]     = tmp;

			var orderedIds = cats.map(function (c) { return c.id; });
			self._ajaxReorderCategories(orderedIds);
		},

		/**
		 * Duplicate a category and all its variables.
		 *
		 * @param {string} catId Source category ID.
		 */
		_duplicateCategory: function (catId) {
			var self = this;

			if (!EFF.state.currentFile) {
				self._noFileModal();
				return;
			}

			var cats = (EFF.state.config && EFF.state.config.categories) || [];
			var cat  = null;
			for (var i = 0; i < cats.length; i++) {
				if (cats[i].id === catId) { cat = cats[i]; break; }
			}
			if (!cat) { return; }

			var newName = cat.name + ' (copy)';

			EFF.App.ajax('eff_save_category', {
				filename: EFF.state.currentFile,
				category: JSON.stringify({ name: newName }),
			}).then(function (res) {
				if (!res.success || !res.data) { return; }

				var newCatId   = res.data.id;
				var newCatName = newName;

				if (!EFF.state.config) { EFF.state.config = {}; }
				EFF.state.config.categories = res.data.categories;

				// Use _getVarsForCategory (checks both category_id AND category name)
				// so Elementor-synced variables (which have only a category string, no
				// category_id) are also duplicated correctly.
				var vars = self._getVarsForCategory(cat);

				var chain = Promise.resolve();
				vars.forEach(function (v) {
					var dupVar = {
						name:        v.name + '-copy',
						value:       v.value,
						parent_id:   v.parent_id || null,
						category_id: newCatId,
						order:       (v.order || 0),
					};
					(function (dv) {
						chain = chain.then(function () {
							return EFF.App.ajax('eff_save_color', {
								filename: EFF.state.currentFile,
								variable: JSON.stringify(dv),
							}).then(function (r) {
								if (r.success && r.data && r.data.data) {
									EFF.state.variables = r.data.data.variables;
								}
							});
						});
					}(dupVar));
				});
				chain.then(function () {
					EFF.App.setDirty(true);
					EFF.App.refreshCounts();
					self._rerenderView();
					if (EFF.PanelLeft && EFF.PanelLeft.refresh) { EFF.PanelLeft.refresh(); }
				}).catch(function () {});

			}).catch(function () {});
		},

		/**
		 * Ensure the Uncategorized category always exists in config.
		 * Adds it if missing and persists if a file is currently loaded.
		 */
		_ensureUncategorized: function () {
			if (!EFF.state.config) { EFF.state.config = {}; }
			if (!Array.isArray(EFF.state.config.categories)) {
				EFF.state.config.categories = [];
			}
			var cats = EFF.state.config.categories;
			var _needsSave = false;

			// --- v1 → Phase 2 migration ---
			// If no Phase 2 category objects exist yet, seed from the v1 string list
			// stored in config.groups.Variables.Colors. This happens the first time a
			// file created before Phase 2 is opened in the Colors view.
			if (cats.length === 0) {
				var v1names = (EFF.state.config.groups &&
				               EFF.state.config.groups.Variables &&
				               EFF.state.config.groups.Variables.Colors) || [];
				v1names.forEach(function (name, idx) {
					var safeName = String(name).toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
					cats.push({
						id:     'default-' + safeName,
						name:   String(name),
						order:  idx,
						locked: (name === 'Uncategorized'),
					});
				});
				// Categories were seeded in memory but not yet on disk — must persist.
				if (v1names.length > 0) { _needsSave = true; }
			}

			var hasUncat = cats.some(function (c) { return c.name === 'Uncategorized'; });
			if (!hasUncat) {
				var maxOrder = 0;
				cats.forEach(function (c) { if ((c.order || 0) > maxOrder) { maxOrder = c.order; } });
				cats.push({ id: 'default-uncategorized', name: 'Uncategorized',
							order: maxOrder + 1, locked: true });
				_needsSave = true;
			}

			// Persist seeded/added categories to the file so that subsequent
			// eff_save_category calls load a file that already has the full list.
			if (_needsSave && EFF.state.currentFile) {
				var d = { version: '1.0', config: EFF.state.config,
						  variables: EFF.state.variables || [] };
				EFF.App.ajax('eff_save_file', {
					filename: EFF.state.currentFile,
					data:     JSON.stringify(d),
				}).catch(function () {});
			}
		},

		/**
		 * Sort all color variables alphabetically by name.
		 * @param {boolean} ascending  true = A→Z, false = Z→A
		 */
		_sortColors: function (ascending) {
			var self = this;
			var sorted = EFF.state.variables.slice().sort(function (a, b) {
				var na = (a.name || '').toLowerCase();
				var nb = (b.name || '').toLowerCase();
				return ascending ? (na < nb ? -1 : na > nb ? 1 : 0)
								 : (na > nb ? -1 : na < nb ? 1 : 0);
			});
			sorted.forEach(function (v, i) { v.order = i + 1; });
			var chain = Promise.resolve();
			sorted.forEach(function (v) {
				(function (variable) {
					chain = chain.then(function () {
						return EFF.App.ajax('eff_save_color', {
							filename: EFF.state.currentFile,
							variable: JSON.stringify(variable),
						}).then(function (r) {
							if (r.success && r.data && r.data.data) {
								EFF.state.variables = r.data.data.variables;
							}
						});
					});
				}(v));
			});
			chain.then(function () {
				EFF.App.setDirty(true);
				self._rerenderView();
			}).catch(function () {});
		},

		/**
		 * Sort non-locked categories alphabetically (locked always last).
		 * @param {boolean} ascending  true = A→Z, false = Z→A
		 */
		_sortCategories: function (ascending) {
			var self = this;
			if (!EFF.state.config || !Array.isArray(EFF.state.config.categories)) { return; }
			var locked   = EFF.state.config.categories.filter(function (c) { return c.locked; });
			var unlocked = EFF.state.config.categories.filter(function (c) { return !c.locked; });
			unlocked.sort(function (a, b) {
				var na = (a.name || '').toLowerCase();
				var nb = (b.name || '').toLowerCase();
				return ascending ? (na < nb ? -1 : na > nb ? 1 : 0)
								 : (na > nb ? -1 : na < nb ? 1 : 0);
			});
			var combined = unlocked.concat(locked);
			combined.forEach(function (c, i) { c.order = i + 1; });
			EFF.state.config.categories = combined;
			EFF.App.ajax('eff_reorder_categories', {
				filename:    EFF.state.currentFile,
				ordered_ids: JSON.stringify(combined.map(function (c) { return c.id; })),
			}).then(function (r) {
				if (r.success && r.data && r.data.categories) {
					EFF.state.config.categories = r.data.categories;
				}
				EFF.App.setDirty(true);
				self._rerenderView();
				if (EFF.PanelLeft && EFF.PanelLeft.refresh) { EFF.PanelLeft.refresh(); }
			}).catch(function () {});
		},

		/**
		 * Delete a color variable (and optionally its children).
		 *
		 * @param {string} varId  Variable ID to delete.
		 */
		_deleteVariable: function (varId) {
			var self     = this;
			var variable = EFF.state.variables.find(function (v) { return v.id === varId; });
			if (!variable) { return; }

			var children = EFF.state.variables.filter(function (v) { return v.parent_id === varId; });
			var hasChildren = children.length > 0;

			var body = hasChildren
				? '<p>This variable has ' + children.length + ' child variable(s).</p>' +
				  '<p><button id="eff-del-var-with-children" class="eff-btn eff-btn--danger">Delete variable and all children</button> ' +
				  '<button id="eff-del-var-only" class="eff-btn">Delete variable only</button> ' +
				  '<button id="eff-del-var-cancel" class="eff-btn">Cancel</button></p>'
				: '<p>Delete <strong>' + (variable.name || varId) + '</strong>? This cannot be undone.</p>' +
				  '<p><button id="eff-del-var-confirm" class="eff-btn eff-btn--danger">Delete</button> ' +
				  '<button id="eff-del-var-cancel" class="eff-btn">Cancel</button></p>';

			EFF.Modal.open({ title: 'Delete variable', body: body });

			function doDelete(deleteChildren) {
				EFF.Modal.close();
				document.removeEventListener('click', handleDelClick);
				EFF.App.ajax('eff_delete_color', {
					filename:        EFF.state.currentFile,
					variable_id:     varId,
					delete_children: deleteChildren ? '1' : '0',
				}).then(function (res) {
					if (res.success && res.data && res.data.data && res.data.data.variables) {
						EFF.state.variables = res.data.data.variables;
						EFF.App.setDirty(true);
						EFF.App.refreshCounts();
						self._rerenderView();
					} else if (!res.success) {
						var msg = (res.data && res.data.message) ? res.data.message : 'Delete failed.';
						EFF.Modal.open({ title: 'Error', body: '<p>' + msg + '</p>' });
					}
				}).catch(function () {
					EFF.Modal.open({ title: 'Connection error', body: '<p>Connection error during delete.</p>' });
				});
			}

			function handleDelClick(e) {
				var t = e.target;
				if (t.id === 'eff-del-var-cancel') {
					EFF.Modal.close();
					document.removeEventListener('click', handleDelClick);
				} else if (t.id === 'eff-del-var-with-children') {
					doDelete(true);
				} else if (t.id === 'eff-del-var-only' || t.id === 'eff-del-var-confirm') {
					doDelete(false);
				}
			}
			document.addEventListener('click', handleDelClick);
		},

		/**
		 * Reorder categories locally and persist via AJAX if a file is loaded.
		 *
		 * @param {string[]} orderedIds Category IDs in desired order.
		 */
		_ajaxReorderCategories: function (orderedIds) {
			var self = this;

			// Apply reorder to local state immediately (works without a file).
			if (EFF.state.config && EFF.state.config.categories) {
				var cats = EFF.state.config.categories;
				for (var i = 0; i < orderedIds.length; i++) {
					for (var j = 0; j < cats.length; j++) {
						if (cats[j].id === orderedIds[i]) {
							cats[j].order = i;
							break;
						}
					}
				}
			}
			self._rerenderView();

			if (!EFF.state.currentFile) { return; }

			if (EFF.App) { EFF.App.setDirty(true); }
			EFF.App.ajax('eff_reorder_categories', {
				filename:    EFF.state.currentFile,
				ordered_ids: JSON.stringify(orderedIds),
			}).then(function (res) {
				if (res.success && res.data) {
					if (!EFF.state.config) { EFF.state.config = {}; }
					EFF.state.config.categories = res.data.categories;
					self._rerenderView();
				}
			}).catch(function () {});
		},

		// -----------------------------------------------------------------------
		// MOVE VARIABLE
		// -----------------------------------------------------------------------

		/**
		 * Returns the 6-dot drag handle SVG icon.
		 *
		 * @returns {string}
		 */
		_sixDotSVG: function () {
			return '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="20" viewBox="0 0 14 20" fill="currentColor" aria-hidden="true">'
				+ '<circle cx="4" cy="4" r="2"/><circle cx="10" cy="4" r="2"/>'
				+ '<circle cx="4" cy="10" r="2"/><circle cx="10" cy="10" r="2"/>'
				+ '<circle cx="4" cy="16" r="2"/><circle cx="10" cy="16" r="2"/>'
				+ '</svg>';
		},

	/**
	 * Return a small SVG icon for a sort button based on its direction state.
	 * 'none' = neutral (up+down arrows), 'asc' = solid up triangle, 'desc' = solid down triangle.
	 *
	 * @param {string} dir 'none' | 'asc' | 'desc'
	 * @returns {string}
	 */
	_sortBtnSVG: function (dir) {
		if (dir === 'asc') {
			return '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" aria-hidden="true">'
				+ '<polygon points="12,3 22,21 2,21" fill="currentColor"/>'
				+ '</svg>';
		}
		if (dir === 'desc') {
			return '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" aria-hidden="true">'
				+ '<polygon points="12,21 2,3 22,3" fill="currentColor"/>'
				+ '</svg>';
		}
		// 'none' — stacked up+down triangles (neutral)
		return '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="12" viewBox="0 0 10 12" aria-hidden="true">'
			+ '<polygon points="5,1 9,5 1,5" fill="currentColor" opacity="0.6"/>'
			+ '<polygon points="5,11 1,7 9,7" fill="currentColor" opacity="0.6"/>'
			+ '</svg>';
	},

	/**
	 * Sort variables within a single category and re-render that category's list.
	 * Client-side only — does not call the server or modify v.order.
	 *
	 * @param {string}      catId     Category ID.
	 * @param {string}      field     'name' | 'value'.
	 * @param {string}      dir       'none' | 'asc' | 'desc'.
	 * @param {HTMLElement} container Edit content container.
	 */
	_sortVarsInCategory: function (catId, field, dir, container) {
		var self = this;
		var cats = (EFF.state.config && EFF.state.config.categories)
			? EFF.state.config.categories
			: self._getDefaultCategories();
		var cat  = null;
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

		var block = container.querySelector('.eff-category-block[data-category-id="' + catId + '"]');
		if (!block) { return; }

		var list = block.querySelector('.eff-color-list');
		if (!list) { return; }

		var html = '';
		if (vars.length === 0) {
			html = '<p class="eff-colors-empty">No variables in this category.</p>';
		} else {
			for (var j = 0; j < vars.length; j++) {
				html += self._buildVariableRow(vars[j]);
			}
		}
		list.innerHTML = html;

		// Update sort button states in this block's column header row.
		var sortBtns = block.querySelectorAll('.eff-col-sort-btn');
		for (var k = 0; k < sortBtns.length; k++) {
			var btn    = sortBtns[k];
			var btnCol = btn.getAttribute('data-sort-col');
			var btnDir = (btnCol === field) ? dir : 'none';
			btn.setAttribute('data-sort-dir', btnDir);
			btn.innerHTML = self._sortBtnSVG(btnDir);
		}
	},

	/**
	 * Initialize mouse-based drag-and-drop for category blocks.
	 *
	 * @param {HTMLElement} container
	 */
	_initCatDrag: function (container) {
		var self = this;
		var d    = { active: false, catId: null, ghost: null, indicator: null, startY: 0, _dropTargetId: null, _dropAbove: null };

		container.addEventListener('mousedown', function (e) {
			var handle = e.target.closest('.eff-cat-drag-handle');
			if (!handle) { return; }
			e.preventDefault();

			var block = handle.closest('.eff-category-block');
			if (!block) { return; }

			d.catId = block.getAttribute('data-category-id');
			if (!d.catId) { return; }

			d.active = true;
			d.startY = e.clientY;

			var blockRect = block.getBoundingClientRect();
			var ghost = block.cloneNode(true);
			ghost.style.cssText = 'position:fixed;pointer-events:none;z-index:9999;'
				+ 'width:' + block.offsetWidth + 'px;'
				+ 'top:' + blockRect.top + 'px;left:' + blockRect.left + 'px;'
				+ 'opacity:0.88;box-shadow:0 8px 24px rgba(0,0,0,0.28);border-radius:12px;';
			ghost.className += ' eff-drag-ghost';
			document.body.appendChild(ghost);
			d.ghost = ghost;

			var indicator = document.createElement('div');
			indicator.className = 'eff-drop-indicator';
			indicator.style.display = 'none';
			indicator.style.pointerEvents = 'none';
			var _appEl  = document.getElementById('eff-app');
			var _accent = _appEl ? getComputedStyle(_appEl).getPropertyValue('--eff-clr-accent').trim() : '';
			if (!_accent) { _accent = '#f4c542'; }
			indicator.style.background = 'linear-gradient(to right, transparent, '
				+ _accent + ' 15%, ' + _accent + ' 85%, transparent)';
			document.body.appendChild(indicator);
			d.indicator = indicator;

			block.style.opacity = '0.3';
		});

		document.addEventListener('mousemove', function (e) {
			if (!d.active || !d.ghost) { return; }
			var dy = e.clientY - d.startY;
			d.ghost.style.transform = 'translateY(' + dy + 'px)';

			d.ghost.style.display = 'none';
			var elBelow = document.elementFromPoint(e.clientX, e.clientY);
			d.ghost.style.display = '';

			var targetBlock = elBelow ? elBelow.closest('.eff-category-block') : null;
			if (targetBlock && targetBlock.getAttribute('data-category-id') !== d.catId) {
				var tbRect = targetBlock.getBoundingClientRect();
				var above  = e.clientY < tbRect.top + tbRect.height / 2;
				d.indicator.style.display = '';
				d.indicator.style.left    = tbRect.left + 'px';
				d.indicator.style.width   = tbRect.width + 'px';
				d.indicator.style.top     = (above ? tbRect.top : tbRect.bottom) - 2 + 'px';
				d.indicator.style.height  = '4px';
				d._dropTargetId = targetBlock.getAttribute('data-category-id');
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

			var draggingBlock = container.querySelector('.eff-category-block[data-category-id="' + d.catId + '"]');
			if (draggingBlock) { draggingBlock.style.opacity = ''; }

			if (d._dropTargetId && d.catId && d._dropTargetId !== d.catId) {
				self._onDropCat(d.catId, d._dropTargetId, d._dropAbove);
			}
			d._dropTargetId = null;
			d._dropAbove    = null;
			d.catId         = null;
		});
	},

	/**
	 * Handle a completed category drop: reorder categories.
	 */
	_onDropCat: function (srcId, targetId, above) {
		var self = this;
		var cats = (EFF.state.config.categories || []).slice();

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
		EFF.state.config.categories = cats;

		EFF.App.ajax('eff_reorder_categories', {
			subgroup:    'Colors',
			ordered_ids: JSON.stringify(ordered_ids),
		}).then(function (res) {
			if (res.success && res.data && res.data.categories) {
				EFF.state.config.categories = res.data.categories;
			}
			if (EFF.App) { EFF.App.setDirty(true); }
			if (EFF.PanelLeft) { EFF.PanelLeft.refresh(); }
			EFF.Colors._renderAll(EFF.state.currentSelection, document.getElementById('eff-edit-content'));
		}).catch(function () {
			EFF.Colors._renderAll(EFF.state.currentSelection, document.getElementById('eff-edit-content'));
		});
	},

	/**
	 * Initialize mouse-based drag-and-drop for color variable rows.
	 *
	 * @param {HTMLElement} container The color list container.
	 */
	_initDrag: function (container) {
			var self = this;

			container.addEventListener('mousedown', function (e) {
				var handle = e.target.closest('.eff-drag-handle');
				if (!handle) { return; }
				e.preventDefault();

				var row = handle.closest('.eff-color-row');
				if (!row) { return; }

				_drag.varId = row.getAttribute('data-var-id');
				if (!_drag.varId) { return; }

				_drag.active = true;
				_drag.startY = e.clientY;

				// Create ghost — clone of the row, fixed position.
				var ghost = row.cloneNode(true);
				ghost.style.position      = 'fixed';
				ghost.style.width         = row.offsetWidth + 'px';
				ghost.style.height        = row.offsetHeight + 'px';
				ghost.style.top           = (row.getBoundingClientRect().top) + 'px';
				ghost.style.left          = (row.getBoundingClientRect().left) + 'px';
				ghost.style.opacity       = '0.88';
				ghost.style.zIndex        = '9999';
				ghost.style.pointerEvents = 'none';
				ghost.style.boxShadow     = '0 8px 24px rgba(0,0,0,0.28)';
				ghost.style.borderRadius  = '4px';
				ghost.className += ' eff-drag-ghost';
				document.body.appendChild(ghost);
				_drag.ghost = ghost;

				// Create drop indicator — 2px accent-color horizontal line.
				var indicator = document.createElement('div');
				indicator.className = 'eff-drop-indicator';
				indicator.style.display = 'none';
				indicator.style.pointerEvents = 'none'; // Must not intercept elementFromPoint during mousemove
				// --eff-clr-accent is scoped to [data-eff-theme], not :root/body.
				// Read it from the .eff-app element so body-appended elements get the right color.
				var _appEl = document.getElementById('eff-app');
				var _accent = _appEl ? getComputedStyle(_appEl).getPropertyValue('--eff-clr-accent').trim() : '';
				if (!_accent) { _accent = '#f4c542'; }
				indicator.style.background = 'linear-gradient(to right, transparent, ' + _accent + ' 15%, ' + _accent + ' 85%, transparent)';
				indicator.style.boxShadow = '0 0 6px ' + _accent;
				document.body.appendChild(indicator);
				_drag.indicator = indicator;

				// Mark original row as being dragged.
				row.classList.add('eff-row-dragging');
			});

			document.addEventListener('mousemove', function (e) {
				if (!_drag.active || !_drag.ghost) { return; }
				_drag._forceAfter = false;
				e.preventDefault();

				var dy = e.clientY - _drag.startY;
				_drag.ghost.style.top = (parseFloat(_drag.ghost.style.top) + dy) + 'px';
				_drag.startY = e.clientY;

				// Auto-scroll when near viewport edges.
				var scrollZone = 80;
				if (e.clientY < scrollZone) {
					clearInterval(_drag.scrollTimer);
					_drag.scrollTimer = setInterval(function () { window.scrollBy(0, -8); }, 20);
				} else if (e.clientY > window.innerHeight - scrollZone) {
					clearInterval(_drag.scrollTimer);
					_drag.scrollTimer = setInterval(function () { window.scrollBy(0, 8); }, 20);
				} else {
					clearInterval(_drag.scrollTimer);
					_drag.scrollTimer = null;
				}

				// Find the row we're hovering over.
				_drag.ghost.style.display = 'none';
				var el = document.elementFromPoint(e.clientX, e.clientY);
				_drag.ghost.style.display = '';

				var targetRow = el ? el.closest('.eff-color-row') : null;

				// Auto-expand a collapsed category block when the drag ghost enters it,
				// so cross-category drops can show a row-level drop indicator.
				if (!targetRow && el) {
					var hoverBlock = el.closest('.eff-category-block');
					if (hoverBlock && hoverBlock.getAttribute('data-collapsed') === 'true') {
						hoverBlock.setAttribute('data-collapsed', 'false');
						// Re-probe now that the rows are visible.
						_drag.ghost.style.display = 'none';
						var el2 = document.elementFromPoint(e.clientX, e.clientY);
						_drag.ghost.style.display = '';
						var newRow = el2 ? el2.closest('.eff-color-row') : null;
						if (newRow) { targetRow = newRow; }
					}
				}

				// Fallback: cursor over expanded block but not on any row → append to end
				if (!targetRow && el) {
					var hoverBlock2 = el.closest('.eff-category-block');
					if (hoverBlock2 && hoverBlock2.getAttribute('data-collapsed') === 'false') {
						var blockRows = hoverBlock2.querySelectorAll('.eff-color-row:not(.eff-row-dragging)');
						if (blockRows.length > 0) {
							targetRow = blockRows[blockRows.length - 1];
							_drag._forceAfter = true;
					} else {
						// Empty expanded category — show indicator at the drop zone inside it
						var emptyBody = hoverBlock2.querySelector('.eff-color-list');
						if (emptyBody) {
							var emptyRect = emptyBody.getBoundingClientRect();
							_drag.indicator.style.display = 'block';
							_drag.indicator.style.top     = (emptyRect.top + emptyRect.height / 2) - 1 + 'px';
							_drag.indicator.style.left    = emptyRect.left + 'px';
							_drag.indicator.style.width   = emptyRect.width + 'px';
							_drag.indicator._targetVarId    = '__empty-cat__';
							_drag.indicator._insertBefore   = true;
							_drag.indicator._targetCatBlock = hoverBlock2;
						}
						}
					}
				}

				if (targetRow && targetRow.getAttribute('data-var-id') !== _drag.varId) {
					var rect = targetRow.getBoundingClientRect();
					var midY = rect.top + rect.height / 2;
					var insertBefore = _drag._forceAfter ? false : (e.clientY < midY);

					_drag.indicator.style.display = 'block';
					_drag.indicator.style.top     = (insertBefore ? rect.top : rect.bottom) - 1 + 'px';
					_drag.indicator.style.left    = rect.left + 'px';
					_drag.indicator.style.width   = rect.width + 'px';
					_drag.indicator._targetVarId    = targetRow.getAttribute('data-var-id');
					_drag.indicator._insertBefore   = insertBefore;
					_drag.indicator._targetCatBlock = targetRow.closest('.eff-category-block');
				} else {
					if (!el || !el.closest('.eff-category-block')) { _drag.indicator.style.display = 'none';
					_drag.indicator._targetVarId  = null; }
				}
			});

			document.addEventListener('mouseup', function (e) {
				if (!_drag.active) { return; }

				clearInterval(_drag.scrollTimer);
				_drag.scrollTimer = null;

				var targetVarId    = _drag.indicator ? _drag.indicator._targetVarId : null;
				var insertBefore   = _drag.indicator ? _drag.indicator._insertBefore : true;
				var targetCatBlock = _drag.indicator ? _drag.indicator._targetCatBlock : null;

				// Clean up ghost and indicator.
				if (_drag.ghost)     { _drag.ghost.parentNode && _drag.ghost.parentNode.removeChild(_drag.ghost); }
				if (_drag.indicator) { _drag.indicator.parentNode && _drag.indicator.parentNode.removeChild(_drag.indicator); }

				// Remove dragging style.
				var draggingRow = container.querySelector('.eff-color-row.eff-row-dragging');
				if (draggingRow) { draggingRow.classList.remove('eff-row-dragging'); }

				_drag.ghost     = null;
				_drag.indicator = null;
				_drag.active    = false;

				if (!targetVarId || !_drag.varId) {
					_drag.varId = null;
					return;
				}

				var draggedVarId = _drag.varId;
				_drag.varId = null;

				self._dropVariable(draggedVarId, targetVarId, insertBefore, targetCatBlock);
			});
		},

		/**
		 * Commit a drag-and-drop reorder: update state, re-render, and persist.
		 *
		 * @param {string}           draggedId      Row key of the dragged variable.
		 * @param {string}           targetId       Row key of the drop target.
		 * @param {boolean}          insertBefore   Insert before (true) or after (false) target.
		 * @param {HTMLElement|null} targetCatBlock .eff-category-block element at drop point.
		 */
		_dropVariable: function (draggedId, targetId, insertBefore, targetCatBlock) {
			var self = this;

			if (!EFF.state.currentFile) {
				// No project file yet — save current state to temp file first,
				// then retry the drop once PHP has the full variable list.
				EFF.state.currentFile = 'eff-temp.eff.json';
				if (EFF.PanelRight && EFF.PanelRight._filenameInput) {
					EFF.PanelRight._filenameInput.value = 'eff-temp.eff.json';
				}
				var initData = {
					version:   '1.0',
					config:    EFF.state.config    || {},
					variables: EFF.state.variables || [],
				};
				EFF.App.ajax('eff_save_file', {
					filename: EFF.state.currentFile,
					data:     JSON.stringify(initData),
				}).then(function (initRes) {
					if (initRes && initRes.success) {
						self._dropVariable(draggedId, targetId, insertBefore, targetCatBlock);
					} else {
						EFF.state.currentFile = null;
						if (EFF.PanelRight && EFF.PanelRight._filenameInput) {
							EFF.PanelRight._filenameInput.value = '';
						}
					}
				}).catch(function () {
					EFF.state.currentFile = null;
					if (EFF.PanelRight && EFF.PanelRight._filenameInput) {
						EFF.PanelRight._filenameInput.value = '';
					}
				});
				return;
			}

			// Find the dragged and target variable objects.
			var dragged = null;
			var target  = null;
			for (var i = 0; i < EFF.state.variables.length; i++) {
				if (self._rowKey(EFF.state.variables[i]) === draggedId) { dragged = EFF.state.variables[i]; }
				if (self._rowKey(EFF.state.variables[i]) === targetId)  { target  = EFF.state.variables[i]; }
			}
			// Special case: drop into an empty category (no target variable row exists).
		if (targetId === '__empty-cat__' && dragged && targetCatBlock) {
			var emptyCatId   = targetCatBlock.getAttribute('data-category-id');
			var emptyCatName = dragged.category; // fallback
			var ecCats = (EFF.state.config && EFF.state.config.categories) || self._getDefaultCategories();
			for (var ei = 0; ei < ecCats.length; ei++) {
				if (ecCats[ei].id === emptyCatId) { emptyCatName = ecCats[ei].name; break; }
			}
			for (var ek = 0; ek < EFF.state.variables.length; ek++) {
				if (self._rowKey(EFF.state.variables[ek]) === draggedId) {
					EFF.state.variables[ek].category    = emptyCatName;
					EFF.state.variables[ek].category_id = emptyCatId;
					EFF.state.variables[ek].order       = 0;
					break;
				}
			}
			self._rerenderView();
			if (EFF.App) { EFF.App.setDirty(true); EFF.App.setPendingCommit(true); }
			EFF.App.ajax('eff_save_color', {
				filename: EFF.state.currentFile,
				variable: JSON.stringify({ id: dragged.id, order: 0, category: emptyCatName, category_id: emptyCatId }),
			}).catch(function () {});
			return;
		}

		if (!dragged || !target) { return; }

			// Determine target category from the targetCatBlock element.
			var newCatId   = targetCatBlock ? targetCatBlock.getAttribute('data-category-id') : dragged.category_id;
			var newCatName = dragged.category;

			// Find category name from config.
			var cats = (EFF.state.config && EFF.state.config.categories) || self._getDefaultCategories();
			for (var ci = 0; ci < cats.length; ci++) {
				if (cats[ci].id === newCatId) { newCatName = cats[ci].name; break; }
			}

			// Get the target category object.
			var targetCatObj = null;
			for (var cj = 0; cj < cats.length; cj++) {
				if (cats[cj].id === newCatId) { targetCatObj = cats[cj]; break; }
			}
			if (!targetCatObj) { return; }

			var catVars = self._getVarsForCategory(targetCatObj);
			// Remove dragged from the list (handles cross-category and same-cat).
			catVars = catVars.filter(function (v) { return self._rowKey(v) !== draggedId; });

			// Find insertion index.
			var insertIdx = catVars.length;
			for (var vi = 0; vi < catVars.length; vi++) {
				if (self._rowKey(catVars[vi]) === targetId) {
					insertIdx = insertBefore ? vi : vi + 1;
					break;
				}
			}
			catVars.splice(insertIdx, 0, dragged);

			// Reassign order values.
			var saves = [];
			for (var si = 0; si < catVars.length; si++) {
				catVars[si].order = si;
				// Update in EFF.state.variables.
				for (var sj = 0; sj < EFF.state.variables.length; sj++) {
					if (EFF.state.variables[sj] === catVars[si]) {
						EFF.state.variables[sj].order       = si;
						EFF.state.variables[sj].category    = newCatName;
						EFF.state.variables[sj].category_id = newCatId;
						break;
					}
				}
				saves.push({ id: catVars[si].id, order: si, category: newCatName, category_id: newCatId });
			}

			// If dragged changed category, also update its category in state.
			if (dragged.category_id !== newCatId) {
				for (var dk = 0; dk < EFF.state.variables.length; dk++) {
					if (self._rowKey(EFF.state.variables[dk]) === draggedId) {
						EFF.state.variables[dk].category    = newCatName;
						EFF.state.variables[dk].category_id = newCatId;
						break;
					}
				}
			}

			self._rerenderView();
			if (EFF.App) { EFF.App.setDirty(true); EFF.App.setPendingCommit(true); }

			// Persist each affected variable via AJAX (fire-and-forget).
			for (var pi = 0; pi < saves.length; pi++) {
				(function (saveItem) {
					EFF.App.ajax('eff_save_color', {
						filename: EFF.state.currentFile,
						variable: JSON.stringify(saveItem),
					}).catch(function () {});
				}(saves[pi]));
			}
		},

		/**
		 * Move a variable to a different category.
		 *
		 * @param {string} varId    Row key.
		 * @param {string} newCatId Target category ID.
		 */
		_moveVarToCategory: function (varId, newCatId) {
			var self = this;
			var v    = self._findVarByKey(varId);
			if (!v || !newCatId || newCatId === v.category_id) { return; }

			var cats   = (EFF.state.config && EFF.state.config.categories) || [];
			var newCat = null;
			for (var i = 0; i < cats.length; i++) {
				if (cats[i].id === newCatId) { newCat = cats[i]; break; }
			}
			if (!newCat) { return; }

			v.category_id = newCatId;
			v.category    = newCat.name;
			v.status      = 'modified';

			self._rerenderView();

			if (!EFF.state.currentFile) { return; }
			if (EFF.App) { EFF.App.setDirty(true); EFF.App.setPendingCommit(true); }

			EFF.App.ajax('eff_save_color', {
				filename: EFF.state.currentFile,
				variable: JSON.stringify({ id: v.id, category_id: newCatId, category: newCat.name, status: 'modified' }),
			}).then(function (res) {
				if (res.success && res.data && res.data.data) {
					EFF.state.variables = res.data.data.variables;
				}
			}).catch(function () {});
		},

		// -----------------------------------------------------------------------
		// TINT/SHADE/TRANSPARENCY GENERATOR
		// -----------------------------------------------------------------------

		/**
		 * Debounce timer handle for generate calls.
		 * @type {number|null}
		 */
		_generateDebounceTimer: null,

		/**
		 * Debounce a generate call so rapid number-input changes don't flood the server.
		 *
		 * @param {string}      varId Variable row key.
		 * @param {HTMLElement} panel The .eff-expand-panel element.
		 */
		_debounceGenerate: function (varId, panel) {
			var self = this;
			if (self._generateDebounceTimer) {
				clearTimeout(self._generateDebounceTimer);
			}
			self._generateDebounceTimer = setTimeout(function () {
				self._generateDebounceTimer = null;
				self._generateChildren(varId, panel);
			}, 600);
		},

		/**
		 * Read tints/shades/transparencies inputs from the expand panel and call
		 * eff_generate_children AJAX to persist child variables.
		 *
		 * @param {string}      varId Row key.
		 * @param {HTMLElement} panel The .eff-expand-panel element.
		 */
		_generateChildren: function (varId, panel) {
			var self  = this;
			var v     = self._findVarByKey(varId);

			if (!EFF.state.currentFile) {
				self._noFileModal();
				return;
			}

			// Variable must have a server-assigned UUID.
			if (!v || !v.id) {
				EFF.Modal.open({
					title: 'Variable not saved',
					body:  '<p>Save the project file first so this variable gets an ID, then try generating again.</p>',
				});
				return;
			}

			var tintsNum  = panel ? panel.querySelector('.eff-gen-tints-num')  : null;
			var shadesNum = panel ? panel.querySelector('.eff-gen-shades-num') : null;
			var transChk  = panel ? panel.querySelector('.eff-gen-trans-toggle') : null;

			var tintSteps  = tintsNum  ? (parseInt(tintsNum.value,  10) || 0) : 0;
			var shadeSteps = shadesNum ? (parseInt(shadesNum.value, 10) || 0) : 0;
			var transOn    = transChk  ? (transChk.checked ? '1' : '0') : '0';

			EFF.App.ajax('eff_generate_children', {
				filename:       EFF.state.currentFile,
				parent_id:      v.id,
				tints:          String(tintSteps),
				shades:         String(shadeSteps),
				transparencies: transOn,
			}).then(function (res) {
				if (res.success && res.data) {
					if (res.data.data && res.data.data.variables) {
						EFF.state.variables = res.data.data.variables;
					}
					if (EFF.App) { EFF.App.setDirty(true); EFF.App.setPendingCommit(true); EFF.App.refreshCounts(); }
				}
			}).catch(function () {});
		},

		// -----------------------------------------------------------------------
		// UNDO / REDO
		// -----------------------------------------------------------------------

		/**
		 * Undo the last operation.
		 */
		undo: function () {
			var self = this;
			if (_undoStack.length === 0) { return; }

			var op = _undoStack.pop();
			_redoStack.push(op);

			if (op.type === 'value-change' || op.type === 'name-change') {
				var field  = (op.type === 'value-change') ? 'value' : 'name';
				var update = { id: op.id, status: 'modified' };
				update[field] = op.oldValue;
				self._ajaxSaveColor(update, function () {
					if (EFF.App) { EFF.App.setDirty(true); EFF.App.setPendingCommit(true); }
					self._rerenderView();
				});
			}
		},

		/**
		 * Redo the last undone operation.
		 */
		redo: function () {
			var self = this;
			if (_redoStack.length === 0) { return; }

			var op = _redoStack.pop();
			_undoStack.push(op);

			if (op.type === 'value-change' || op.type === 'name-change') {
				var field  = (op.type === 'value-change') ? 'value' : 'name';
				var update = { id: op.id, status: 'modified' };
				update[field] = op.newValue;
				self._ajaxSaveColor(update, function () {
					if (EFF.App) { EFF.App.setDirty(true); EFF.App.setPendingCommit(true); }
					self._rerenderView();
				});
			}
		},

		// -----------------------------------------------------------------------
		// FILTER / COLLAPSE
		// -----------------------------------------------------------------------

		/**
		 * Filter color rows by search query.
		 *
		 * @param {HTMLElement} container
		 * @param {string}      query
		 */
		_filterRows: function (container, query) {
			var lq   = query.toLowerCase();
			var rows = container.querySelectorAll('.eff-color-row');

			for (var i = 0; i < rows.length; i++) {
				var nameInput  = rows[i].querySelector('.eff-color-name-input');
				var valueInput = rows[i].querySelector('.eff-color-value-input');
				var name  = nameInput  ? nameInput.value.toLowerCase()  : '';
				var value = valueInput ? valueInput.value.toLowerCase() : '';

				var match = !lq || name.indexOf(lq) !== -1 || value.indexOf(lq) !== -1;
				rows[i].style.display = match ? '' : 'none';
			}
		},

		/**
		 * Expand or collapse all category blocks and update the toggle button.
		 *
		 * @param {HTMLElement} container
		 * @param {boolean}     collapsed True to collapse, false to expand.
		 */
		_setAllCollapsed: function (container, collapsed) {
			var blocks = container.querySelectorAll('.eff-category-block');
			for (var i = 0; i < blocks.length; i++) {
				var catId = blocks[i].getAttribute('data-category-id');
				blocks[i].setAttribute('data-collapsed', collapsed ? 'true' : 'false');
				if (catId) { _collapsedCategoryIds[catId] = collapsed; }
			}

			// Update toggle button icon and label.
			var toggleBtn = container.querySelector('#eff-colors-collapse-toggle');
			if (toggleBtn) {
				if (collapsed) {
					toggleBtn.setAttribute('title', 'Expand all categories');
					toggleBtn.setAttribute('aria-label', 'Expand all categories');
					toggleBtn.setAttribute('data-toggle-state', 'collapsed');
					toggleBtn.innerHTML = this._expandAllSVG();
				} else {
					toggleBtn.setAttribute('title', 'Collapse all categories');
					toggleBtn.setAttribute('aria-label', 'Collapse all categories');
					toggleBtn.setAttribute('data-toggle-state', 'expanded');
					toggleBtn.innerHTML = this._collapseAllSVG();
				}
			}
		},

		// -----------------------------------------------------------------------
		// RE-RENDER
		// -----------------------------------------------------------------------

		/**
		 * Re-render the Colors view after a state change.
		 *
		 * Clears focused category (so collapse state is preserved, not overridden
		 * by the nav-click behaviour) then re-renders with current selection.
		 */
		_rerenderView: function () {
			var content = document.getElementById('eff-edit-content');
			if (!content || !EFF.state.currentSelection) { return; }

			// Call _renderAll directly to avoid resetting _collapsedCategoryIds.
			// (loadColors would re-apply _focusedCategoryId from currentSelection
			//  and wipe out the manual collapse overrides set by recent CRUD ops.)
			_focusedCategoryId = null;
			this._renderAll(EFF.state.currentSelection, content);
		},

		/**
		 * Update just the swatch background in the DOM without a full re-render.
		 *
		 * @param {string} varId Variable ID.
		 * @param {string} value CSS color value.
		 */
		_updateSwatchInDOM: function (varId, value) {
			var content = document.getElementById('eff-edit-content');
			if (!content) { return; }
			var row    = content.querySelector('.eff-color-row[data-var-id="' + varId + '"]');
			if (!row) { return; }
			var swatch = row.querySelector('.eff-color-swatch');
			if (swatch) { swatch.style.background = value; }
		},

		// -----------------------------------------------------------------------
		// DATA HELPERS
		// -----------------------------------------------------------------------

		/**
		 * Get variables that belong to a given category object.
		 *
		 * Special case: "Uncategorized" is a catch-all — it includes any Colors
		 * variable that is not explicitly assigned to another defined category.
		 * This ensures Elementor-synced vars (which have no category set) appear
		 * somewhere in the UI.
		 *
		 * @param {{ id: string, name: string }} cat
		 * @returns {Array}
		 */
		_getVarsForCategory: function (cat) {
			var allVars = EFF.state.variables || [];

			if (cat.name === 'Uncategorized') {
				// Build lookup of all non-Uncategorized category IDs and names.
				var cats = (EFF.state.config && EFF.state.config.categories)
					? EFF.state.config.categories
					: this._getDefaultCategories();

				var validIds   = {};
				var validNames = {};
				for (var i = 0; i < cats.length; i++) {
					if (cats[i].name !== 'Uncategorized') {
						validIds[cats[i].id] = true;
						if (cats[i].name) { validNames[cats[i].name] = true; }
					}
				}

				return allVars.filter(function (v) {
					if (v.subgroup !== 'Colors' || v.status === 'deleted') { return false; }
					// Explicitly assigned to this Uncategorized category.
					if (v.category_id === cat.id || v.category === cat.name) { return true; }
					// Falls through — not matched by any other category.
					var hasOtherCatId   = v.category_id && validIds[v.category_id];
					var hasOtherCatName = v.category    && validNames[v.category];
					return !hasOtherCatId && !hasOtherCatName;
				}).sort(function (a, b) {
					return (a.order || 0) - (b.order || 0);
				});
			}

			// Standard filter: match by category_id or category name, sorted by order.
			return allVars.filter(function (v) {
				return v.subgroup === 'Colors'
					&& (v.category_id === cat.id || v.category === cat.name)
					&& v.status !== 'deleted';
			}).sort(function (a, b) {
				return (a.order || 0) - (b.order || 0);
			});
		},

		/**
		 * Get variables that belong to a given category ID.
		 *
		 * @param {string} catId
		 * @returns {Array}
		 */
		_getVarsForCategoryId: function (catId) {
			return (EFF.state.variables || []).filter(function (v) {
				return v.category_id === catId && v.status !== 'deleted';
			});
		},

		/**
		 * Get child variables (parent_id matches the given ID).
		 *
		 * @param {string} parentId
		 * @returns {Array}
		 */
		_getChildVars: function (parentId) {
			return (EFF.state.variables || []).filter(function (v) {
				return v.parent_id === parentId;
			});
		},

		/**
		 * Find a variable by ID.
		 *
		 * @param {string} id Variable UUID.
		 * @returns {Object|null}
		 */
		_findVarById: function (id) {
			var vars = EFF.state.variables || [];
			for (var i = 0; i < vars.length; i++) {
				if (vars[i].id === id) { return vars[i]; }
			}
			return null;
		},

		/**
		 * Compute a unique row key for a variable.
		 * Uses v.id when available; falls back to a synthetic key from v.name
		 * so that synced variables (id:'') can still open expand panels.
		 *
		 * @param {Object} v Variable object.
		 * @returns {string}
		 */
		_rowKey: function (v) {
			return (v.id) ? v.id : ('__n_' + v.name);
		},

		/**
		 * Find a variable by its row key (v.id or synthetic __n_name key).
		 *
		 * @param {string} key Row key from data-var-id attribute.
		 * @returns {Object|null}
		 */
		_findVarByKey: function (key) {
			var self = this;
			var vars = EFF.state.variables || [];
			for (var i = 0; i < vars.length; i++) {
				if (self._rowKey(vars[i]) === key) { return vars[i]; }
			}
			return null;
		},

		// -----------------------------------------------------------------------
		// FIELD VALIDATION + ERROR DISPLAY
		// -----------------------------------------------------------------------

		/**
		 * Normalize and validate a user-entered color value for the given format.
		 * Auto-corrects common mistakes; returns error string for fatal failures.
		 *
		 * @param {string} raw    Raw user input.
		 * @param {string} format HEX | HEXA | RGB | RGBA | HSL | HSLA
		 * @returns {{ value: string, error: string|null }}
		 */
		_normalizeColorValue: function (raw, format) {
			var v = (typeof raw === 'string' ? raw : '').trim();

			// ---- HEX / HEXA ----
			if (format === 'HEX' || format === 'HEXA') {
				var bare = v.replace(/^#/, '').toUpperCase();
				// Expand 3-char shorthand: FFF → FFFFFF
				if (/^[0-9A-F]{3}$/.test(bare)) {
					bare = bare[0]+bare[0] + bare[1]+bare[1] + bare[2]+bare[2];
				}
				if (format === 'HEX') {
					if (!/^[0-9A-F]{6}$/.test(bare)) {
						return { value: v, error: 'HEX color must be 3 or 6 hex digits (0–9, A–F). Example: #FF5733 or #F53' };
					}
					return { value: '#' + bare, error: null };
				}
				// HEXA: accept 6 (append FF) or 8 digits.
				if (/^[0-9A-F]{6}$/.test(bare)) { bare += 'FF'; }
				if (!/^[0-9A-F]{8}$/.test(bare)) {
					return { value: v, error: 'HEXA color must be 6 or 8 hex digits. Example: #FF5733CC' };
				}
				return { value: '#' + bare, error: null };
			}

			// ---- RGB / RGBA ----
			if (format === 'RGB' || format === 'RGBA') {
				var inner = v.replace(/^rgba?\s*\(/i, '').replace(/\)\s*$/, '').trim();
				var parts = inner.split(/[\s,]+/).filter(function (s) { return s !== ''; });
				var need  = (format === 'RGBA') ? 4 : 3;
				if (parts.length < need) {
					return { value: v, error: format + ' requires ' + need + ' values separated by commas. Example: ' + (format === 'RGB' ? 'rgb(255, 87, 51)' : 'rgba(255, 87, 51, 0.8)') };
				}
				var r = parseInt(parts[0], 10);
				var g = parseInt(parts[1], 10);
				var b = parseInt(parts[2], 10);
				if (isNaN(r) || isNaN(g) || isNaN(b)) {
					return { value: v, error: 'RGB channel values must be whole numbers (0–255)' };
				}
				r = Math.max(0, Math.min(255, r));
				g = Math.max(0, Math.min(255, g));
				b = Math.max(0, Math.min(255, b));
				if (format === 'RGB') {
					return { value: 'rgb(' + r + ', ' + g + ', ' + b + ')', error: null };
				}
				var a = parseFloat(parts[3]);
				if (isNaN(a)) {
					return { value: v, error: 'RGBA alpha must be a decimal number (0–1). Example: 0.5' };
				}
				a = Math.round(Math.max(0, Math.min(1, a)) * 100) / 100;
				return { value: 'rgba(' + r + ', ' + g + ', ' + b + ', ' + a + ')', error: null };
			}

			// ---- HSL / HSLA ----
			if (format === 'HSL' || format === 'HSLA') {
				var inner2 = v.replace(/^hsla?\s*\(/i, '').replace(/\)\s*$/, '').trim();
				var raw2   = inner2.replace(/%/g, '');
				var pts    = raw2.split(/[\s,]+/).filter(function (s) { return s !== ''; });
				var need2  = (format === 'HSLA') ? 4 : 3;
				if (pts.length < need2) {
					return { value: v, error: format + ' requires ' + need2 + ' values. Example: ' + (format === 'HSL' ? 'hsl(200, 60%, 40%)' : 'hsla(200, 60%, 40%, 0.8)') };
				}
				var h = parseFloat(pts[0]);
				var s = parseFloat(pts[1]);
				var l = parseFloat(pts[2]);
				if (isNaN(h) || isNaN(s) || isNaN(l)) {
					return { value: v, error: 'HSL values must be numbers: hue (0–360), saturation (0–100), lightness (0–100)' };
				}
				h = Math.round(((h % 360) + 360) % 360);
				s = Math.round(Math.max(0, Math.min(100, s)));
				l = Math.round(Math.max(0, Math.min(100, l)));
				if (format === 'HSL') {
					return { value: 'hsl(' + h + ', ' + s + '%, ' + l + '%)', error: null };
				}
				var a2 = parseFloat(pts[3]);
				if (isNaN(a2)) {
					return { value: v, error: 'HSLA alpha must be a decimal number (0–1). Example: 0.5' };
				}
				a2 = Math.round(Math.max(0, Math.min(1, a2)) * 100) / 100;
				return { value: 'hsla(' + h + ', ' + s + '%, ' + l + '%, ' + a2 + ')', error: null };
			}

			return { value: v, error: null };
		},

		/**
		 * Show a floating inline error tooltip below an input element.
		 * Auto-dismisses after 3.5 seconds.
		 *
		 * @param {HTMLElement} input   The input with the invalid value.
		 * @param {string}      message Error message to display.
		 */
		_showFieldError: function (input, message) {
			this._clearFieldError(input);
			var el  = document.createElement('div');
			el.className = 'eff-inline-error';
			el.textContent = message;
			var rect   = input.getBoundingClientRect();
			el.style.left = rect.left + 'px';
			el.style.top  = (rect.bottom + 4) + 'px';
			document.body.appendChild(el);
			input._effError = el;
			var timer = setTimeout(function () {
				if (el.parentNode) { el.parentNode.removeChild(el); }
				if (input._effError === el) { input._effError = null; }
			}, 3500);
			input._effErrorTimer = timer;
		},

		/**
		 * Remove any visible field error tooltip for an input.
		 *
		 * @param {HTMLElement} input
		 */
		_clearFieldError: function (input) {
			if (input._effError) {
				if (input._effError.parentNode) { input._effError.parentNode.removeChild(input._effError); }
				input._effError = null;
			}
			if (input._effErrorTimer) {
				clearTimeout(input._effErrorTimer);
				input._effErrorTimer = null;
			}
		},

		// -----------------------------------------------------------------------
		// MODAL HELPERS
		// -----------------------------------------------------------------------

		/**
		 * Show a "no file loaded" info modal.
		 */
		_noFileModal: function () {
			var body = '<p>No project file is loaded. Enter a filename to save the current data as a project file — then retry your action.</p>'
				+ '<input type="text" id="eff-nfl-filename" class="eff-text-input"'
				+ ' value="elementor-variables.eff.json"'
				+ ' style="width:100%;margin-top:12px;" />';

			var footer = '<button class="eff-btn eff-btn--primary" id="eff-nfl-save-btn">Save File</button>';

			EFF.Modal.open({ title: 'No file loaded', body: body, footer: footer });

			var saveBtn = document.getElementById('eff-nfl-save-btn');
			if (!saveBtn) { return; }

			saveBtn.addEventListener('click', function () {
				var inp      = document.getElementById('eff-nfl-filename');
				var filename = inp ? inp.value.trim() : '';
				if (!filename) { return; }
				if (!/\.eff\.json$/.test(filename)) { filename += '.eff.json'; }

				var saveData = {
					config:    { categories: (EFF.state.config && EFF.state.config.categories) ? EFF.state.config.categories : [] },
					variables: EFF.state.variables || [],
				};

				saveBtn.disabled    = true;
				saveBtn.textContent = 'Saving\u2026';

				EFF.App.ajax('eff_save_file', {
					filename: filename,
					data:     JSON.stringify(saveData),
				}).then(function (res) {
					if (res.success && res.data) {
						EFF.state.currentFile = res.data.filename || filename;
						if (EFF.App && EFF.App.setDirty) { EFF.App.setDirty(false); }
						EFF.Modal.close();
					} else {
						saveBtn.disabled    = false;
						saveBtn.textContent = 'Save File';
					}
				}).catch(function () {
					saveBtn.disabled    = false;
					saveBtn.textContent = 'Save File';
				});
			});
		},

		// -----------------------------------------------------------------------
		// COLOR UTILITIES
		// -----------------------------------------------------------------------

		/**
		 * Return the CSS color string for a status enum value.
		 *
		 * @param {string} status
		 * @returns {string} CSS color string.
		 */
		_statusLongTooltip: function (status) {
			var map = {
				synced:   'Synced \u2014 This variable matches the value in the Elementor kit.',
				modified: 'Modified \u2014 Value changed since last sync. Commit to push to Elementor.',
				new:      'New \u2014 Variable not yet in the Elementor kit. Commit to add it.',
				deleted:  'Deleted \u2014 Marked for deletion. Commit to remove from Elementor.',
				conflict: 'Conflict \u2014 Value changed both here and in Elementor since last sync.',
				orphaned: 'Orphaned \u2014 Exists in EFF but not found in Elementor kit. Commit to add it.',
			};
			return map[status] || ('Status: ' + status);
		},

		_statusColor: function (status) {
			var map = {
				synced:   'var(--eff-status-synced)',
				modified: 'var(--eff-status-modified)',
				conflict: 'var(--eff-status-conflict)',
				orphaned: 'var(--eff-status-orphaned)',
				new:      'var(--eff-status-new)',
				deleted:  'var(--eff-status-deleted)',
			};
			return map[status] || 'var(--eff-status-synced)';
		},

		/**
		 * Extract a 6-character hex string from a CSS color value.
		 *
		 * @param {string} value CSS color value.
		 * @returns {string|null} '#rrggbb' or null.
		 */
		_parseHex6: function (value) {
			if (!value) { return null; }
			var m = value.match(/^#([0-9a-fA-F]{6})/);
			return m ? ('#' + m[1].toLowerCase()) : null;
		},

		/**
		 * Extract the alpha channel (0–1) from a CSS color value.
		 *
		 * @param {string} value CSS color value.
		 * @returns {number} Alpha 0–1.
		 */
		_parseAlpha: function (value) {
			if (!value) { return 1; }
			var m = value.match(/^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})$/);
			if (!m) { return 1; }
			return parseInt(m[1], 16) / 255;
		},

		/**
		 * Combine a #rrggbb hex and an alpha percentage into a CSS value.
		 *
		 * @param {string} hex6     '#rrggbb' format.
		 * @param {number} alphaPct 0–100.
		 * @returns {string}
		 */
		_combineHexAlpha: function (hex6, alphaPct) {
			if (alphaPct >= 100) { return hex6; }
			var alpha    = Math.round((alphaPct / 100) * 255);
			var alphaHex = alpha.toString(16);
			if (alphaHex.length < 2) { alphaHex = '0' + alphaHex; }
			return hex6 + alphaHex;
		},

		/**
		 * Parse any supported CSS color value to {r, g, b, a} (r/g/b: 0-255, a: 0-1).
		 *
		 * Supports: #rrggbb, #rrggbbaa, rgb(...), rgba(...), hsl(...), hsla(...)
		 *
		 * @param {string} value CSS color value.
		 * @returns {{r:number,g:number,b:number,a:number}|null}
		 */
		_parseToRgba: function (value) {
			if (!value) { return null; }
			var v = value.trim();

			// HEX 8-char (#rrggbbaa)
			var m8 = v.match(/^#([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/);
			if (m8) {
				return { r: parseInt(m8[1],16), g: parseInt(m8[2],16), b: parseInt(m8[3],16), a: parseInt(m8[4],16)/255 };
			}
			// HEX 6-char (#rrggbb)
			var m6 = v.match(/^#([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/);
			if (m6) {
				return { r: parseInt(m6[1],16), g: parseInt(m6[2],16), b: parseInt(m6[3],16), a: 1 };
			}
			// rgba(r, g, b, a)
			var mRgba = v.match(/^rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)$/i);
			if (mRgba) {
				return { r: parseInt(mRgba[1]), g: parseInt(mRgba[2]), b: parseInt(mRgba[3]), a: parseFloat(mRgba[4]) };
			}
			// rgb(r, g, b)
			var mRgb = v.match(/^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/i);
			if (mRgb) {
				return { r: parseInt(mRgb[1]), g: parseInt(mRgb[2]), b: parseInt(mRgb[3]), a: 1 };
			}
			// hsla(h, s%, l%, a)
			var mHsla = v.match(/^hsla\(\s*([\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%\s*,\s*([\d.]+)\s*\)$/i);
			if (mHsla) {
				var rgb = this._hslToRgb(parseFloat(mHsla[1]), parseFloat(mHsla[2]), parseFloat(mHsla[3]));
				return { r: rgb.r, g: rgb.g, b: rgb.b, a: parseFloat(mHsla[4]) };
			}
			// hsl(h, s%, l%)
			var mHsl = v.match(/^hsl\(\s*([\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%\s*\)$/i);
			if (mHsl) {
				var rgb2 = this._hslToRgb(parseFloat(mHsl[1]), parseFloat(mHsl[2]), parseFloat(mHsl[3]));
				return { r: rgb2.r, g: rgb2.g, b: rgb2.b, a: 1 };
			}
			return null;
		},

		/**
		 * Convert H/S/L (h: 0-360, s: 0-100, l: 0-100) to {r,g,b} (0-255).
		 *
		 * @param {number} h Hue 0-360.
		 * @param {number} s Saturation 0-100.
		 * @param {number} l Lightness 0-100.
		 * @returns {{r:number,g:number,b:number}}
		 */
		_hslToRgb: function (h, s, l) {
			s /= 100; l /= 100;
			var c = (1 - Math.abs(2*l - 1)) * s;
			var x = c * (1 - Math.abs((h/60) % 2 - 1));
			var m = l - c/2;
			var r = 0, g = 0, b = 0;
			if (h < 60)       { r=c; g=x; b=0; }
			else if (h < 120) { r=x; g=c; b=0; }
			else if (h < 180) { r=0; g=c; b=x; }
			else if (h < 240) { r=0; g=x; b=c; }
			else if (h < 300) { r=x; g=0; b=c; }
			else               { r=c; g=0; b=x; }
			return { r: Math.round((r+m)*255), g: Math.round((g+m)*255), b: Math.round((b+m)*255) };
		},

		/**
		 * Convert {r,g,b} (0-255) to {h,s,l} (h: 0-360, s: 0-100, l: 0-100).
		 *
		 * @param {number} r 0-255.
		 * @param {number} g 0-255.
		 * @param {number} b 0-255.
		 * @returns {{h:number,s:number,l:number}}
		 */
		_rgbToHsl: function (r, g, b) {
			r /= 255; g /= 255; b /= 255;
			var max = Math.max(r,g,b), min = Math.min(r,g,b);
			var l   = (max+min)/2, s = 0, h = 0;
			if (max !== min) {
				var d = max - min;
				s = l > 0.5 ? d/(2-max-min) : d/(max+min);
				switch (max) {
					case r: h = (g-b)/d + (g<b ? 6 : 0); break;
					case g: h = (b-r)/d + 2; break;
					default: h = (r-g)/d + 4;
				}
				h /= 6;
			}
			return { h: Math.round(h*360), s: Math.round(s*100), l: Math.round(l*100) };
		},

		/**
		 * Convert a CSS color value to a different format string.
		 *
		 * @param {string} value     Current CSS color value.
		 * @param {string} newFormat Target format: HEX | HEXA | RGB | RGBA | HSL | HSLA.
		 * @returns {string|null} Converted value, or null if parse failed.
		 */
		_convertColor: function (value, newFormat) {
			var self = this;
			var rgba = self._parseToRgba(value);
			if (!rgba) { return null; }

			var r = rgba.r, g = rgba.g, b = rgba.b, a = rgba.a;

			// Always two uppercase hex digits (00–FF).
			function hex2(n) {
				var s = Math.round(n).toString(16).toUpperCase();
				return s.length < 2 ? '0' + s : s;
			}

			switch (newFormat) {
				case 'HEX':
					return '#' + hex2(r) + hex2(g) + hex2(b);
				case 'HEXA':
					// Always 8 chars: #RRGGBBAA — alpha byte from 0–255.
					return '#' + hex2(r) + hex2(g) + hex2(b) + hex2(Math.round(a * 255));
				case 'RGB':
					return 'rgb(' + r + ', ' + g + ', ' + b + ')';
				case 'RGBA':
					return 'rgba(' + r + ', ' + g + ', ' + b + ', ' + Math.round(a * 100) / 100 + ')';
				case 'HSL': {
					var hsl = self._rgbToHsl(r, g, b);
					return 'hsl(' + hsl.h + ', ' + hsl.s + '%, ' + hsl.l + '%)';
				}
				case 'HSLA': {
					var hsl2 = self._rgbToHsl(r, g, b);
					return 'hsla(' + hsl2.h + ', ' + hsl2.s + '%, ' + hsl2.l + '%, ' + Math.round(a * 100) / 100 + ')';
				}
			}
			return null;
		},

		// -----------------------------------------------------------------------
		// SVG ICONS (inline, no external dependencies)
		// -----------------------------------------------------------------------

		/** Chevron-down (expand row / collapse-category direction indicator). */
		_chevronSVG: function () {
			return '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"'
				+ ' fill="none" stroke="currentColor" stroke-width="2"'
				+ ' stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
				+ '<polyline points="6 9 12 15 18 9"></polyline>'
				+ '</svg>';
		},

		/** × close / back button. */
		_closeSVG: function () {
			return '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"'
				+ ' fill="none" stroke="currentColor" stroke-width="2"'
				+ ' stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
				+ '<line x1="18" y1="6" x2="6" y2="18"></line>'
				+ '<line x1="6" y1="6" x2="18" y2="18"></line>'
				+ '</svg>';
		},

		/** Double-chevron up (collapse-all icon — shown when expanded). */
		_collapseAllSVG: function () {
			return '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"'
				+ ' fill="none" stroke="currentColor" stroke-width="2"'
				+ ' stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
				+ '<polyline points="18 15 12 9 6 15"></polyline>'
				+ '</svg>';
		},

		/** Double-chevron down (expand-all icon — shown when collapsed). */
		_expandAllSVG: function () {
			return '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"'
				+ ' fill="none" stroke="currentColor" stroke-width="2"'
				+ ' stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
				+ '<polyline points="6 9 12 15 18 9"></polyline>'
				+ '</svg>';
		},

		/** Plus inside a circle (add variable / add category). */
		_plusCircleSVG: function () {
			return '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"'
				+ ' fill="none" stroke="currentColor" stroke-width="2"'
				+ ' stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
				+ '<circle cx="12" cy="12" r="10"></circle>'
				+ '<line x1="12" y1="8" x2="12" y2="16"></line>'
				+ '<line x1="8" y1="12" x2="16" y2="12"></line>'
				+ '</svg>';
		},

		/** Plain plus sign — no surrounding circle (used for add-var button whose border IS the circle). */
		_plusSVG: function () {
			return '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"'
				+ ' fill="none" stroke="currentColor" stroke-width="2.5"'
				+ ' stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
				+ '<line x1="12" y1="5" x2="12" y2="19"></line>'
				+ '<line x1="5" y1="12" x2="19" y2="12"></line>'
				+ '</svg>';
		},

		/** Duplicate / copy icon. */
		_duplicateSVG: function () {
			return '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"'
				+ ' fill="none" stroke="currentColor" stroke-width="2"'
				+ ' stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
				+ '<rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>'
				+ '<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>'
				+ '</svg>';
		},

		/** Arrow pointing up (move category up). */
		_arrowUpSVG: function () {
			return '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"'
				+ ' fill="none" stroke="currentColor" stroke-width="2"'
				+ ' stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
				+ '<line x1="12" y1="19" x2="12" y2="5"></line>'
				+ '<polyline points="5 12 12 5 19 12"></polyline>'
				+ '</svg>';
		},

		/** Arrow pointing down (move category down). */
		_arrowDownSVG: function () {
			return '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"'
				+ ' fill="none" stroke="currentColor" stroke-width="2"'
				+ ' stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
				+ '<line x1="12" y1="5" x2="12" y2="19"></line>'
				+ '<polyline points="19 12 12 19 5 12"></polyline>'
				+ '</svg>';
		},

		/** Trash bin (delete category). */
		_trashSVG: function () {
			return '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"'
				+ ' fill="none" stroke="currentColor" stroke-width="2"'
				+ ' stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
				+ '<polyline points="3 6 5 6 21 6"></polyline>'
				+ '<path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>'
				+ '<path d="M10 11v6"></path><path d="M14 11v6"></path>'
				+ '<path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path>'
				+ '</svg>';
		},

		/**
		 * Escape HTML special characters.
		 *
		 * @param {string} str
		 * @returns {string}
		 */
		_esc: function (str) {
			if (typeof str !== 'string') { return ''; }
			var div = document.createElement('div');
			div.textContent = str;
			return div.innerHTML;
		},
	};

}());
