/**
 * AFF Colors — Phase 2 Colors Edit Space
 *
 * Intercepts AFF.EditSpace.loadCategory() for the Colors subgroup and
 * renders a full editing workspace: category blocks with color variable rows,
 * inline expand panels (color picker + tint/shade generator), category
 * management (add/rename/delete/reorder/duplicate), and undo/redo.
 *
 * Phases implemented in this file:
 *   Phase 2b: Category blocks, color variable rows (read-only display)
 *   Phase 2c: Inline editing, category CRUD, undo/redo
 *   Phase 2d: Expand panel (color picker + generator + preview)
 *   Phase 2e: Status dots (rendered; sync decision tree in aff-app.js)
 *
 *
 * @package ElementorFrameworkForge
 */

(function () {
	'use strict';

	window.AFF= window.AFF|| {};

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

	AFF.Colors = {

		/**
		 * The currently open expand panel's variable ID, or null.
		 * @type {string|null}
		 */
		_openExpandId: null,
		/** @type {object|null} */
		_pickrInstance: null,

		/**
		 * Initialize: intercept AFF.EditSpace.loadCategory for Colors subgroup.
		 */
		init: function () {
			var _original = AFF.EditSpace.loadCategory.bind(AFF.EditSpace);

			AFF.EditSpace.loadCategory = function (selection) {
				if (selection && selection.subgroup === 'Colors') {
					AFF.Colors.loadColors(selection);
				} else {
					_original(selection);
				}
			};

			// Undo/redo keyboard handler.
			document.addEventListener('keydown', function (e) {
				if (!e.ctrlKey && !e.metaKey) { return; }
				if (e.key === 'z' || e.key === 'Z') {
					e.preventDefault();
					AFF.Colors.undo();
				} else if (e.key === 'y' || e.key === 'Y') {
					e.preventDefault();
					AFF.Colors.redo();
				}
			});
		},

		/**
		 * Entry point called by the overridden AFF.EditSpace.loadCategory.
		 *
		 * @param {{ group: string, subgroup: string, category: string, categoryId: string|null }} selection
		 */
		loadColors: function (selection) {
			var placeholder = document.getElementById('aff-placeholder');
			var content     = document.getElementById('aff-edit-content');
			var workspace   = document.getElementById('aff-workspace');

			if (!content) { return; }

			// Store the focused category from the nav click.
			if (selection && selection.categoryId) {
				_focusedCategoryId = selection.categoryId;
			} else if (selection && selection.category) {
				var _cats = (AFF.state.config && AFF.state.config.categories) || this._getDefaultCategories();
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
			// regardless of any CSS display rules on .aff-placeholder.
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

			var categories  = (AFF.state.config && AFF.state.config.categories)
				? AFF.state.config.categories.slice().sort(function (a, b) {
					return (a.order || 0) - (b.order || 0);
				})
				: self._getDefaultCategories();

			var html = '<div class="aff-colors-view">';

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
			html += '<div class="aff-colors-filter-bar">'
				+ '<div class="aff-filter-bar-top">'
				+ '<span class="aff-filter-bar-set-name">Colors</span>'
				+ '<span style="flex:1"></span>'
				+ '<input type="text" class="aff-colors-search" id="aff-colors-search"'
				+ ' placeholder="Search\u2026" aria-label="Search color variables">'
				+ '<button class="aff-icon-btn aff-colors-back-btn" id="aff-colors-back"'
				+ ' title="Close colors view" aria-label="Close colors view"'
				+ ' data-aff-tooltip="Close Colors view">'
				+ self._closeSVG()
				+ '</button>'
				+ '<button class="aff-icon-btn" id="aff-colors-collapse-toggle"'
				+ ' title="' + _toggleTitle + '" aria-label="' + _toggleTitle + '"'
				+ ' data-aff-tooltip="' + _toggleTitle + '"'
				+ ' data-toggle-state="' + _toggleState + '">'
				+ _toggleSVG
				+ '</button>'
				+ '</div>'
				+ '<div class="aff-filter-bar-add-cat-wrap">'
				+ '<button class="aff-icon-btn aff-colors-add-cat-btn" id="aff-colors-add-category"'
				+ ' data-aff-tooltip="Add category"'
				+ ' aria-label="Add category">'
				+ self._plusSVG()
				+ '</button>'
				+ '</div>'
				+ '</div>'; // .aff-colors-filter-bar

			// ------- CATEGORY BLOCKS -------
			if (categories.length === 0) {
				html += '<p class="aff-colors-empty">No categories found. Click "+ Category" to add one.</p>';
			} else {
				for (var i = 0; i < categories.length; i++) {
					html += self._buildCategoryBlock(categories[i], i, categories.length);
				}
			}

			html += '</div>'; // .aff-colors-view

			container.innerHTML = html;

			// Bind all interactive elements.
			self._bindEvents(container);

			// Re-apply any active column sorts. _catSortState is display-only and
			// survives re-renders, but the DOM is rebuilt from state (unsorted order)
			// each time, so we must reapply here.
			var _ssKeys = Object.keys(_catSortState);
			for (var _si = 0; _si < _ssKeys.length; _si++) {
				var _ss = _catSortState[_ssKeys[_si]];
				if (_ss && _ss.dir !== 'none') {
					self._sortVarsInCategory(_ssKeys[_si], _ss.field, _ss.dir, container);
				}
			}

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

			var html = '<div class="aff-category-block"'
				+ ' data-category-id="' + AFF.Utils.escHtml(cat.id) + '"'
				+ ' data-collapsed="' + (isCollapsed ? 'true' : 'false') + '"'
				+ '>'
				// Inner wrapper handles overflow clipping; outer block uses
				// overflow:visible so the add button can sit on the bottom edge.
				+ '<div class="aff-category-inner">';

			// --- Header: drag-handle + name span + count + sort buttons + actions ---
			html += '<div class="aff-category-header">'
				+ '<div class="aff-cat-header-top">'
				+ '<div class="aff-cat-header-left">'

				// Drag handle — six-dot grip for category drag-and-drop.
				+ '<span class="aff-cat-drag-handle" data-action="cat-drag-handle" aria-hidden="true"'
				+ ' data-aff-tooltip="Drag to reorder">'
				+ self._sixDotSVG()
				+ '</span>'

				// Category name as plain span — no surrounding box.
				// Double-click activates contenteditable.
				+ '<span class="aff-category-name-input"'
				+ ' data-cat-id="' + AFF.Utils.escHtml(cat.id) + '"'
				+ ' data-original="' + AFF.Utils.escHtml(cat.name) + '"'
				+ ' aria-label="Category name"'
				+ ' contenteditable="false"'
				+ (cat.locked ? ' data-locked="true"' : '') + '>'
				+ AFF.Utils.escHtml(cat.name)
				+ '</span>'

				// Variable count badge — sits right after the name text.
				+ '<span class="aff-category-count">' + count + '</span>'

				+ '</div>' // .aff-cat-header-left

				+ '<div class="aff-category-actions" role="toolbar" aria-label="Category actions">'
				+ self._catBtn('duplicate', 'Duplicate category', self._duplicateSVG(), '')
				+ (cat.locked ? '' : self._catBtn('delete', 'Delete category', self._trashSVG(), 'aff-icon-btn--danger'))
				+ self._catBtn('collapse', 'Collapse/expand category', self._chevronSVG(), 'aff-category-collapse-btn')
				+ '</div>' // .aff-category-actions

				+ '</div>' // .aff-cat-header-top
				+ '</div>'; // .aff-category-header

			// Column sort header row — same grid as variable rows; sort buttons in name (col4) and value (col5).
			var _ns = (_catSortState[cat.id] && _catSortState[cat.id].field === 'name')  ? _catSortState[cat.id].dir : 'none';
			var _vs = (_catSortState[cat.id] && _catSortState[cat.id].field === 'value') ? _catSortState[cat.id].dir : 'none';
			html += '<div class="aff-color-list-header" data-cat-id="' + AFF.Utils.escHtml(cat.id) + '">'
				+ '<span></span>'  // col1: drag
				+ '<span></span>'  // col2: status dot
				+ '<span></span>'  // col3: swatch
				+ '<span class="aff-col-sort-wrap">'
				+ '<button class="aff-col-sort-btn" data-sort-col="name" data-cat-id="' + AFF.Utils.escHtml(cat.id) + '" data-sort-dir="' + _ns + '"'
				+ ' title="Sort by name" aria-label="Sort by name"'
				+ ' data-aff-tooltip="Sort by name">'
				+ self._sortBtnSVG(_ns)
				+ '</button>'
				+ '</span>'
				+ '<span class="aff-col-sort-wrap">'
				+ '<button class="aff-col-sort-btn" data-sort-col="value" data-cat-id="' + AFF.Utils.escHtml(cat.id) + '" data-sort-dir="' + _vs + '"'
				+ ' title="Sort by value" aria-label="Sort by value"'
				+ ' data-aff-tooltip="Sort by value">'
				+ self._sortBtnSVG(_vs)
				+ '</button>'
				+ '</span>'
				+ '</div>'; // .aff-color-list-header

			// Variable rows.
			html += '<div class="aff-color-list">';
			if (count === 0) {
				html += '<p class="aff-colors-empty">No variables in this category.</p>';
			} else {
				for (var i = 0; i < vars.length; i++) {
					html += self._buildVariableRow(vars[i]);
				}
			}
			html += '</div>'; // .aff-color-list

			html += '</div>'; // .aff-category-inner

			// Add-variable button: absolutely positioned circle on bottom-left edge of panel.
			html += '<div class="aff-cat-add-btn-wrap">'
				+ '<button class="aff-icon-btn aff-add-var-btn" data-action="add-var"'
				+ ' data-cat-id="' + AFF.Utils.escHtml(cat.id) + '"'
				+ ' aria-label="Add Color to ' + AFF.Utils.escHtml(cat.name) + '"'
				+ ' title="Add Color"'
			+ ' data-aff-tooltip="Add Color"'
			+ ' data-aff-tooltip-long="Add a new color variable to this category">'
				+ self._plusSVG()
				+ '</button>'
				+ '</div>';

			html += '</div>'; // .aff-category-block
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
			return '<button class="aff-icon-btn ' + (extraClass || '') + '"'
				+ ' data-action="' + action + '"'
				+ ' aria-label="' + AFF.Utils.escHtml(label) + '"'
				+ ' title="' + AFF.Utils.escHtml(label) + '"'
			+ ' data-aff-tooltip="' + AFF.Utils.escHtml(label) + '"'
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
			var swatchBg    = AFF.Utils.escHtml(v.value || '');
			var rowKey      = this._rowKey(v);
			var isExpanded  = (this._openExpandId === rowKey);

			var html = '<div class="aff-color-row"'
				+ (isExpanded ? ' data-expanded="true"' : '')
				+ ' data-var-id="' + AFF.Utils.escHtml(rowKey) + '">'

				// Drag handle (col 1: 24px).
				+ '<div class="aff-drag-handle" data-action="drag-handle" draggable="false"'
			+ ' aria-label="Drag to reorder" data-aff-tooltip="Drag to reorder">'
				+ this._sixDotSVG()
				+ '</div>'

				// Status dot (Phase 2e).
				+ '<span class="aff-status-dot"'
				+ ' style="background:' + statusColor + '"'
				+ ' data-aff-tooltip="' + AFF.Utils.escHtml(status.charAt(0).toUpperCase() + status.slice(1)) + '"'
				+ ' data-aff-tooltip-long="' + AFF.Utils.escHtml(this._statusLongTooltip(status)) + '"'
				+ ' aria-label="Status: ' + AFF.Utils.escHtml(status) + '">'
				+ '</span>'

				// Color swatch.
				+ '<span class="aff-color-swatch"'
				+ ' style="background:' + swatchBg + '"'
				+ ' data-action="open-picker"'
				+ ' aria-label="Color swatch"'
				+ ' data-aff-tooltip="Click to open color editor">'
				+ '</span>'

				// Variable name — single-click to edit.
				+ '<input type="text" class="aff-color-name-input"'
				+ ' value="' + AFF.Utils.escHtml(v.name) + '"'
				+ ' data-original="' + AFF.Utils.escHtml(v.name) + '"'
				+ ' readonly'
				+ ' aria-label="Variable name"'
				+ ' data-aff-tooltip="Variable name — click to edit"'
				+ ' spellcheck="false">'

				// Color value — directly editable.
				+ '<input type="text" class="aff-color-value-input"'
				+ ' value="' + AFF.Utils.escHtml(v.value || '') + '"'
				+ ' data-original="' + AFF.Utils.escHtml(v.value || '') + '"'
				+ ' aria-label="Color value"'
				+ ' data-aff-tooltip="Color value — edit directly"'
				+ ' spellcheck="false">'

				// Format selector.
				+ '<select class="aff-color-format-sel" aria-label="Color format"'
				+ ' data-aff-tooltip="Color format">'
				+ this._formatOptions(v.format || 'HEX')
				+ '</select>'

				// Expand button (col 7: 28px).
				+ '<button class="aff-icon-btn aff-color-expand-btn"'
				+ ' data-action="expand"'
				+ ' aria-label="Open color editor"'
				+ ' aria-expanded="false"'
				+ ' data-aff-tooltip="Open color editor"'
			+ ' data-aff-tooltip-long="Open the full color editor — tints, shades, transparency, and picker">'
				+ this._chevronSVG()
				+ '</button>'

				// Delete button (col 8).
				+ '<button class="aff-icon-btn aff-color-delete-btn" data-action="delete-var" data-var-id="' + AFF.Utils.escHtml(rowKey) + '"'
			+ ' title="Delete variable" aria-label="Delete variable"'
			+ ' data-aff-tooltip="Delete variable"'
			+ ' data-aff-tooltip-long="Remove this variable from the project">&#x1F5D1;</button>'

				+ '</div>'; // .aff-color-row

			return html;
		},

		/**
		 * Build the <select> options for the format field.
		 *
		 * @param {string} current Currently selected format value.
		 * @returns {string} HTML option string.
		 */
		_formatOptions: function (current) {
			// Normalise legacy alpha-suffix formats (HEXA→HEX, RGBA→RGB, HSLA→HSL).
			var base = current.replace(/A$/, '');
			var formats = ['HEX', 'RGB', 'HSL'];
			var html = '';
			for (var i = 0; i < formats.length; i++) {
				var sel = (formats[i] === base) ? ' selected' : '';
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
			var swatchBg = AFF.Utils.escHtml(v.value || '');

			var statusColor = self._statusColor(v.status || 'synced');

			var html = '<div class="aff-modal-header">'
				// Empty drag-handle placeholder (col 1) — keeps grid alignment with .aff-color-row
				+ '<span></span>'
				// Status dot (col 2) — matches color row col 2
				+ '<span class="aff-status-dot" style="background:' + statusColor + '"'
				+ ' title="Status: ' + AFF.Utils.escHtml(v.status || 'synced') + '"></span>'
				// Swatch (col 3) — Pickr trigger button (all formats)
				+ '<button class="aff-color-swatch aff-pickr-btn" type="button" style="background:' + swatchBg + '"'
					+ ' aria-label="Open color picker"'
					+ ' data-aff-tooltip="Click to open color picker"></button>'
				// Name input (col 3)
				+ '<input type="text" class="aff-color-name-input"'
				+ ' value="' + AFF.Utils.escHtml(v.name) + '"'
				+ ' data-original="' + AFF.Utils.escHtml(v.name) + '"'
				+ ' data-var-id="' + AFF.Utils.escHtml(rowKey) + '"'
				+ ' spellcheck="false" aria-label="Variable name"'
				+ ' data-aff-tooltip="Variable name \u2014 click to edit">'
				// Value input (col 4)
				+ '<input type="text" class="aff-color-value-input"'
				+ ' value="' + AFF.Utils.escHtml(v.value || '') + '"'
				+ ' data-original="' + AFF.Utils.escHtml(v.value || '') + '"'
				+ ' data-var-id="' + AFF.Utils.escHtml(rowKey) + '"'
				+ ' spellcheck="false" aria-label="Color value"'
				+ ' data-aff-tooltip="Color value \u2014 edit directly">'
				// Format select (col 5)
				+ '<select class="aff-color-format-sel"'
				+ ' data-var-id="' + AFF.Utils.escHtml(rowKey) + '"'
				+ ' aria-label="Color format"'
				+ ' data-aff-tooltip="Color format">'
				+ self._formatOptions(v.format || 'HEX')
				+ '</select>'
				// Close button (col 6)
				+ '<button class="aff-modal-close-btn" aria-label="Close editor">\u00d7</button>'
				+ '</div>';

			html += '<div class="aff-modal-body">';

			html += '<div class="aff-modal-gen-row">'
				+ '<span class="aff-modal-gen-label">Tints</span>'
				+ '<div class="aff-modal-gen-ctrl">'
				+ '<input type="number" class="aff-gen-num aff-gen-tints-num"'
				+ ' min="0" max="10" value="' + currentTints + '"'
				+ ' data-var-id="' + AFF.Utils.escHtml(rowKey) + '">'
				+ '</div>'
				+ '<div class="aff-palette-strip aff-tints-palette">'
				+ self._buildTintsBars(hsl, currentTints)
				+ '</div>'
				+ '</div>';

			html += '<div class="aff-modal-gen-row">'
				+ '<span class="aff-modal-gen-label">Shades</span>'
				+ '<div class="aff-modal-gen-ctrl">'
				+ '<input type="number" class="aff-gen-num aff-gen-shades-num"'
				+ ' min="0" max="10" value="' + currentShades + '"'
				+ ' data-var-id="' + AFF.Utils.escHtml(rowKey) + '">'
				+ '</div>'
				+ '<div class="aff-palette-strip aff-shades-palette">'
				+ self._buildShadesBars(hsl, currentShades)
				+ '</div>'
				+ '</div>';

			html += '<div class="aff-modal-gen-row">'
				+ '<span class="aff-modal-gen-label">Transparencies</span>'
				+ '<div class="aff-modal-gen-ctrl">'
				+ '<label class="aff-toggle-label">'
				+ '<input type="checkbox" class="aff-gen-trans-toggle"'
				+ ' data-var-id="' + AFF.Utils.escHtml(rowKey) + '"'
				+ (transOn ? ' checked' : '') + '>'
				+ '<span class="aff-toggle-track"></span>'
				+ '</label>'
				+ '</div>'
				+ '<div class="aff-palette-strip aff-trans-palette">'
				+ (transOn ? self._buildTransBars(rgba) : '')
				+ '</div>'
				+ '</div>';

			// Move to Category row.
			var allCats = (AFF.state.config && AFF.state.config.categories) ? AFF.state.config.categories : [];
			var currentCatId = v.category_id || '';
			var catOptions = '';
			for (var ci = 0; ci < allCats.length; ci++) {
				var co = allCats[ci];
				catOptions += '<option value="' + AFF.Utils.escHtml(co.id) + '"'
					+ (co.id === currentCatId ? ' selected' : '') + '>'
					+ AFF.Utils.escHtml(co.name)
					+ '</option>';
			}

			if (allCats.length > 1) {
				html += '<div class="aff-modal-gen-row">'
					+ '<span class="aff-modal-gen-label">Move to Category</span>'
					+ '<div class="aff-modal-gen-ctrl" style="width:auto;flex:1">'
					+ '<select class="aff-cat-move-select" data-var-id="' + AFF.Utils.escHtml(rowKey) + '">'
					+ catOptions
					+ '</select>'
					+ '</div>'
					+ '</div>';
			}

			html += '</div>'; // .aff-modal-body
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
				html += '<span class="aff-palette-swatch" style="background:' + color + '"></span>';
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
				html += '<span class="aff-palette-swatch" style="background:' + color + '"></span>';
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
				html += '<span class="aff-palette-swatch" style="background:' + color + '"></span>';
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
		 * @param {HTMLElement} container The #aff-edit-content element.
		 */
		_bindEvents: function (container) {
			this._bindFilterBar(container);

			if (container._effEventsBound) { return; }
			container._effEventsBound = true;
			var self = this;
			self._initCatDrag(container);
			self._initDrag(container);
			self._bindCategoryAndRowActions(container);
			self._bindInlineEditing(container);
		},

		_bindFilterBar: function (container) {
			var self = this;

			var searchInput = container.querySelector('#aff-colors-search');
			if (searchInput) {
				searchInput.addEventListener('input', function () {
					self._filterRows(container, this.value);
				});
			}

			var backBtn = container.querySelector('#aff-colors-back');
			if (backBtn) {
				backBtn.addEventListener('click', function () {
					self._closeColorsView();
				});
			}

			var toggleBtn = container.querySelector('#aff-colors-collapse-toggle');
			if (toggleBtn) {
				toggleBtn.addEventListener('click', function () {
					var state    = toggleBtn.getAttribute('data-toggle-state');
					var collapse = (state !== 'collapsed');
					self._setAllCollapsed(container, collapse);
				});
			}

			var addCatBtn = container.querySelector('#aff-colors-add-category');
			if (addCatBtn) {
				addCatBtn.addEventListener('click', function () {
					self._addCategory();
				});
			}
		},

		_bindCategoryAndRowActions: function (container) {
			var self = this;

			container.addEventListener('click', function (e) {
				// Route sort buttons first (more specific target).
				var sortBtn = e.target.closest('.aff-col-sort-btn');
				if (sortBtn) {
					var sCatId  = sortBtn.getAttribute('data-cat-id');
					var sCol    = sortBtn.getAttribute('data-sort-col');
					var sDir    = sortBtn.getAttribute('data-sort-dir');
					var nextDir = sDir === 'none' ? 'asc' : (sDir === 'asc' ? 'desc' : 'none');
					_catSortState[sCatId] = { field: sCol, dir: nextDir };
					self._sortVarsInCategory(sCatId, sCol, nextDir, container);
					return;
				}

				var btn = e.target.closest('[data-action]');
				if (!btn) { return; }

				var action = btn.getAttribute('data-action');
				var block  = btn.closest('.aff-category-block');
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
							var isCollapsed  = block.getAttribute('data-collapsed') === 'true';
							var newCollapsed = !isCollapsed;
							block.setAttribute('data-collapsed', String(newCollapsed));
							if (catId) { _collapsedCategoryIds[catId] = newCollapsed; }
						}
						break;

					case 'expand': {
						var row    = btn.closest('.aff-color-row');
						var eVarId = row ? row.getAttribute('data-var-id') : null;
						if (eVarId !== null) { self._toggleExpandPanel(eVarId, row, container); }
						break;
					}

					case 'open-picker': {
						var swatchRow = e.target.closest('.aff-color-row');
						var swVarId   = swatchRow ? swatchRow.getAttribute('data-var-id') : null;
						if (swVarId !== null) { self._toggleExpandPanel(swVarId, swatchRow, container); }
						break;
					}
				}
			});
		},

		_bindInlineEditing: function (container) {
			var self = this;

			// Single-click to activate inline editing for name and category fields.
			container.addEventListener('mousedown', function (e) {
				var input = e.target.closest('.aff-color-name-input, .aff-category-name-input');
				if (!input) { return; }
				if (input.getAttribute('data-locked') === 'true') { return; }

				var isCat     = input.classList.contains('aff-category-name-input');
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

			// Restore readonly/contenteditable on focusout and save pending changes.
			container.addEventListener('focusout', function (e) {
				var nameInput = e.target.closest('.aff-color-name-input');
				if (nameInput) { nameInput.setAttribute('readonly', ''); return; }
				var catInput = e.target.closest('.aff-category-name-input');
				if (catInput && catInput.getAttribute('data-locked') !== 'true') {
					self._saveCategoryName(catInput);
					catInput.setAttribute('contenteditable', 'false');
				}
			});

			// Category name: Enter to confirm, Escape to revert.
			container.addEventListener('keydown', function (e) {
				var catInput = e.target.closest('.aff-category-name-input');
				if (!catInput) { return; }
				if (e.key === 'Enter') {
					e.preventDefault();
					catInput.blur();
				} else if (e.key === 'Escape') {
					var oldName = catInput.getAttribute('data-original') || '';
					catInput.textContent = oldName;
					catInput.setAttribute('contenteditable', 'false');
					catInput.blur();
				}
			});

			// Name input: enforce '--' prefix while typing.
			container.addEventListener('input', function (e) {
				var nameInput = e.target.closest('.aff-color-name-input');
				if (!nameInput) { return; }
				var val = nameInput.value;
				if (val.slice(0, 2) !== '--') {
					nameInput.value = '--' + val.replace(/^-*/, '');
				}
			});

			// Name input: save on change.
			container.addEventListener('change', function (e) {
				var nameInput = e.target.closest('.aff-color-name-input');
				if (!nameInput) { return; }
				var row   = nameInput.closest('.aff-color-row');
				var varId = row ? row.getAttribute('data-var-id') : null;
				if (varId !== null) { self._saveVarName(varId, nameInput); }
			});

			// Name and value inputs: blur on Enter.
			container.addEventListener('keydown', function (e) {
				if (e.key !== 'Enter') { return; }
				var input = e.target.closest('.aff-color-name-input, .aff-color-value-input');
				if (input) { input.blur(); }
			});

			// Value input: validate, normalize, and save on change.
			container.addEventListener('change', function (e) {
				var valueInput = e.target.closest('.aff-color-value-input');
				if (!valueInput) { return; }
				var row   = valueInput.closest('.aff-color-row');
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
				if (AFF.App) { AFF.App.setDirty(true); }
				self._saveVarValue(varId, res.value, valueInput);
			});

			// Value input: select all on focus.
			container.addEventListener('focusin', function (e) {
				if (e.target.classList.contains('aff-color-value-input')) {
					e.target.select();
				}
			});

			// Format selector: save on change.
			container.addEventListener('change', function (e) {
				var formatSel = e.target.closest('.aff-color-format-sel');
				if (!formatSel) { return; }
				var row   = formatSel.closest('.aff-color-row');
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
			if (AFF.PanelLeft && AFF.PanelLeft.clearSelection) {
				AFF.PanelLeft.clearSelection();
			}

			// Delegate hide/show to edit space.
			if (AFF.EditSpace && AFF.EditSpace.reset) {
				AFF.EditSpace.reset();
			}

			AFF.state.currentSelection = null;
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
			var block = container.querySelector('.aff-category-block[data-category-id="' + catId + '"]');
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
		 * @param {HTMLElement} row       The .aff-color-row element.
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
			// is never two .aff-expand-modal elements in the DOM at once.
			self._closeExpandPanel(container, true);

			var v = self._findVarByKey(varId);
			if (!v) { return; }

			row.setAttribute('data-expanded', 'true');
			var expandBtn = row.querySelector('.aff-color-expand-btn');
			if (expandBtn) { expandBtn.setAttribute('aria-expanded', 'true'); }

			var backdrop = document.createElement('div');
			backdrop.className = 'aff-expand-backdrop';
			backdrop.setAttribute('data-expand-backdrop', varId);

			var modal = document.createElement('div');
			modal.className = 'aff-expand-modal';
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

			var effApp = document.getElementById('aff-app') || document.body;
			effApp.appendChild(backdrop);
			effApp.appendChild(modal);

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

			var backdrop = document.querySelector('.aff-expand-backdrop[data-expand-backdrop]');
			if (backdrop && backdrop.parentNode) { backdrop.parentNode.removeChild(backdrop); }

			var modal = document.querySelector('.aff-expand-modal[data-expand-modal]');
			if (modal) {
				if (immediate) {
					// Switching to a new modal — remove the old one instantly so
					// there is never more than one .aff-expand-modal in the DOM.
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
				var row = container.querySelector('.aff-color-row[data-var-id="' + this._openExpandId + '"]');
				if (row) {
					row.removeAttribute('data-expanded');
					var expandBtn = row.querySelector('.aff-color-expand-btn');
					if (expandBtn) { expandBtn.setAttribute('aria-expanded', 'false'); }
				}
			}

			if (this._pickrInstance) {
				try { this._pickrInstance.destroyAndRemove(); } catch (e) {}
				this._pickrInstance = null;
			}
			this._openExpandId = null;
		},

		/**
		 * Bind all interactive events directly on the modal card.
		 * (Modal is appended to #aff-app, so container delegation won't reach it.)
		 *
		 * @param {HTMLElement} modal     The .aff-expand-modal element.
		 * @param {HTMLElement} backdrop  The .aff-expand-backdrop element.
		 * @param {Object}      v         Variable object.
		 * @param {string}      varId     Variable row key.
		 * @param {HTMLElement} row       The .aff-color-row element.
		 * @param {HTMLElement} container The content container.
		 */
		_bindModalEvents: function (modal, backdrop, v, varId, row, container) {
			var self = this;

			// Backdrop click — close modal.
			backdrop.addEventListener('click', function () {
				self._closeExpandPanel(container, false);
			});

			// Close button.
			var closeBtn = modal.querySelector('.aff-modal-close-btn');
			if (closeBtn) {
				closeBtn.addEventListener('click', function () {
					self._closeExpandPanel(container, false);
				});
			}

			// Name input — save on blur / Enter; protect leading '--' prefix.
			var nameInput = modal.querySelector('.aff-color-name-input');
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
			}

			// Value input — save on blur / Enter; sync swatch in header live.
			var valueInput = modal.querySelector('.aff-color-value-input');
			if (valueInput) {
				valueInput.addEventListener('input', function () {
					// Live swatch update while typing.
					var swatch = modal.querySelector('.aff-color-swatch');
					if (swatch) { swatch.style.background = valueInput.value; }
					// Sync Pickr state to the typed value.
					if (self._pickrInstance) {
						try { self._pickrInstance.setColor(valueInput.value, true); } catch (e) {}
					}
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
					var swatch = modal.querySelector('.aff-color-swatch');
					if (swatch) { swatch.style.background = res.value; }
					if (self._pickrInstance) {
						try { self._pickrInstance.setColor(res.value, true); } catch (e) {}
					}
					self._refreshModalPalettes(modal, varId);
				});
			}

			// Name and value inputs: blur on Enter.
			if (nameInput || valueInput) {
				modal.addEventListener('keydown', function (e) {
					if (e.key !== 'Enter') { return; }
					var input = e.target.closest('.aff-color-name-input, .aff-color-value-input');
					if (input) { input.blur(); }
				});
			}

			// Format selector — save on change and update modal header live.
			var formatSel = modal.querySelector('.aff-color-format-sel');
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
						var modalSwatch = modal.querySelector('.aff-color-swatch');
						if (modalSwatch) { modalSwatch.style.background = vv.value; }
					}
				});
			}

			// Pickr — visual color picker for all formats.
			var pickrBtn = modal.querySelector('.aff-pickr-btn');
			if (pickrBtn && typeof Pickr !== 'undefined') {
				// Normalise legacy alpha-suffix formats.
				var pickerFmt = (v.format || 'HEX').replace(/A$/, '');
				var pickr = Pickr.create({
					el:          pickrBtn,
					theme:       'classic',
					useAsButton: true,
					default: v.value || '#000000',
					components: {
						preview: true,
						opacity: true,
						hue:     true,
						interaction: {
							hex:   pickerFmt === 'HEX',
							rgba:  pickerFmt === 'RGB',
							hsla:  pickerFmt === 'HSL',
							input: true,
							save:  true,
						},
					},
				});

				pickr.on('change', function (color) {
					var preview = self._pickrColorToString(color, pickerFmt);
					if (preview && pickrBtn) { pickrBtn.style.background = preview; }
				});

				pickr.on('save', function (color) {
					if (!color) { return; }
					var raw = self._pickrColorToString(color, pickerFmt);
					var res = self._normalizeColorValue(raw, pickerFmt);
					if (res.error) { return; }
					if (valueInput) {
						valueInput.value = res.value;
						valueInput.setAttribute('data-original', res.value);
					}
					if (pickrBtn) { pickrBtn.style.background = res.value; }
					self._saveVarValue(varId, res.value, valueInput);
					self._refreshModalPalettes(modal, varId);
					pickr.hide();
				});

				self._pickrInstance = pickr;
			}

			// Tints number — live preview.
			var tintsNum = modal.querySelector('.aff-gen-tints-num');
			if (tintsNum) {
				tintsNum.addEventListener('input', function () {
					var steps = parseInt(tintsNum.value, 10) || 0;
					if (steps < 0) { steps = 0; }
					if (steps > 10) { steps = 10; }
					tintsNum.value = steps; // clamp displayed value
					var palette = modal.querySelector('.aff-tints-palette');
					var vv      = self._findVarByKey(varId);
					var rgba2   = vv ? self._parseToRgba(vv.value || '') : null;
					var hsl2    = rgba2 ? self._rgbToHsl(rgba2.r, rgba2.g, rgba2.b) : null;
					if (palette) { palette.innerHTML = self._buildTintsBars(hsl2, steps); }
					if (vv) { self._debounceGenerate(varId, modal); }
				});
			}

			// Shades number — live preview.
			var shadesNum = modal.querySelector('.aff-gen-shades-num');
			if (shadesNum) {
				shadesNum.addEventListener('input', function () {
					var steps = parseInt(shadesNum.value, 10) || 0;
					if (steps < 0) { steps = 0; }
					if (steps > 10) { steps = 10; }
					shadesNum.value = steps; // clamp displayed value
					var palette = modal.querySelector('.aff-shades-palette');
					var vv      = self._findVarByKey(varId);
					var rgba2   = vv ? self._parseToRgba(vv.value || '') : null;
					var hsl2    = rgba2 ? self._rgbToHsl(rgba2.r, rgba2.g, rgba2.b) : null;
					if (palette) { palette.innerHTML = self._buildShadesBars(hsl2, steps); }
					if (vv) { self._debounceGenerate(varId, modal); }
				});
			}

			// Transparencies toggle — live preview.
			var transChk = modal.querySelector('.aff-gen-trans-toggle');
			if (transChk) {
				transChk.addEventListener('change', function () {
					var isOn    = transChk.checked;
					var palette = modal.querySelector('.aff-trans-palette');
					var vv      = self._findVarByKey(varId);
					var rgba2   = vv ? self._parseToRgba(vv.value || '') : null;
					if (palette) { palette.innerHTML = isOn ? self._buildTransBars(rgba2) : ''; }
					if (vv) { self._debounceGenerate(varId, modal); }
				});
			}

			// Move to category select.
			var moveCatSel = modal.querySelector('.aff-cat-move-select');
			if (moveCatSel) {
				moveCatSel.addEventListener('change', function () {
					var newCatId = moveCatSel.value;
					if (newCatId) {
						self._closeExpandPanel(container, false);
						self._moveVarToCategory(varId, newCatId);
					}
				});
			}

			// ESC key — close expand modal.
			function escHandler(e) {
				if (e.key === 'Escape') {
					document.removeEventListener('keydown', escHandler);
					self._closeExpandPanel(container, false);
				}
			}
			document.addEventListener('keydown', escHandler);

			// Focus trap — keep keyboard focus within the modal.
			var focusable = modal.querySelectorAll(
				'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
			);
			if (focusable.length) {
				var firstFocus = focusable[0];
				var lastFocus  = focusable[focusable.length - 1];
				modal.addEventListener('keydown', function trapFocus(e) {
					if (e.key !== 'Tab') { return; }
					if (e.shiftKey) {
						if (document.activeElement === firstFocus) {
							e.preventDefault();
							lastFocus.focus();
						}
					} else {
						if (document.activeElement === lastFocus) {
							e.preventDefault();
							firstFocus.focus();
						}
					}
				});
				// Focus first interactive element on open.
				requestAnimationFrame(function () { firstFocus.focus(); });
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
			var content = document.getElementById('aff-edit-content');
			if (content) {
				var listRow = content.querySelector('.aff-color-row[data-var-id="' + AFF.Utils.escHtml(varId) + '"]');
				var listDot = listRow ? listRow.querySelector('.aff-status-dot') : null;
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
				if (AFF.App) { AFF.App.setDirty(true); }
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
			var content = document.getElementById('aff-edit-content');
			if (content) {
				var listRow = content.querySelector('.aff-color-row[data-var-id="' + AFF.Utils.escHtml(varId) + '"]');
				if (listRow) {
					var listSwatch = listRow.querySelector('.aff-color-swatch');
					if (listSwatch) { listSwatch.style.background = newValue; }
					var listVal = listRow.querySelector('.aff-color-value-input');
					if (listVal) { listVal.value = newValue; }
					var listDot = listRow.querySelector('.aff-status-dot');
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
				if (AFF.App) { AFF.App.setDirty(true); }
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
			var content = document.getElementById('aff-edit-content');
			if (content) {
				var row = content.querySelector('.aff-color-row[data-var-id="' + AFF.Utils.escHtml(varId) + '"]');
				if (row) {
					if (converted !== null) {
						var valInput = row.querySelector('.aff-color-value-input');
						if (valInput) { valInput.value = converted; valInput.setAttribute('data-original', converted); }
						var swatch = row.querySelector('.aff-color-swatch');
						if (swatch) { swatch.style.background = converted; }
					}
					var dot = row.querySelector('.aff-status-dot');
					if (dot) { dot.style.background = self._statusColor('modified'); }
				}
			}

			if (AFF.App) { AFF.App.setDirty(true); }

			// Persist via AJAX if a file is loaded (include name for PHP fallback lookup).
			var updateData = { id: v.id, name: v.name, format: newFormat };
			if (converted !== null) { updateData.value = converted; }

			self._ajaxSaveColor(updateData, function () {
				/* AFF.App.setPendingCommit removed */
			});
		},

		/**
		 * Send eff_save_color AJAX and update AFF.state.variables on success.
		 *
		 * @param {Object}   variableData Partial variable object with at least { id }.
		 * @param {Function} onSuccess    Called on success.
		 */
		_ajaxSaveColor: function (variableData, onSuccess) {
			var self = this;

			if (!AFF.state.currentFile) { return; }

			AFF.App.ajax('aff_save_color', {
				filename: AFF.state.currentFile,
				variable: JSON.stringify(variableData),
			}).then(function (res) {
				if (res.success) {
					if (res.data && res.data.data && res.data.data.variables) {
						AFF.state.variables = res.data.data.variables;
					}
					if (onSuccess) { onSuccess(res.data); }
				}
			}).catch(function () { console.warn('[AFF] AJAX error: load file'); });
		},

		// -----------------------------------------------------------------------
		// ADD / DELETE VARIABLE
		// -----------------------------------------------------------------------

		/**
		 * Add a new blank variable to a category.
		 *
		 * @param {string} catId Category ID.
		 */
		_ensureFileExists: function (callback) {
			if (AFF.state.currentFile) { callback(); return; }
			var self     = this;
			var initData = { version: '1.0', config: AFF.state.config || {}, variables: AFF.state.variables || [] };
			AFF.App.ajax('aff_save_file', {
				project_name: 'aff-temp',
				data:         JSON.stringify(initData),
			}).then(function (res) {
				if (res && res.success) {
					AFF.state.currentFile = res.data.filename;
					if (AFF.PanelRight && AFF.PanelRight._filenameInput) {
						AFF.PanelRight._filenameInput.value = 'aff-temp';
					}
					callback();
				} else {
					AFF.Modal.open({ title: 'Error', body: '<p>Could not initialize project file. Please try again.</p>' });
				}
			}).catch(function () {
				AFF.Modal.open({ title: 'Connection error', body: '<p>Could not create project file. Please try again.</p>' });
			});
		},

		_addVariable: function (catId) {
			var self = this;

			if (!AFF.state.currentFile) {
				self._ensureFileExists(function () { self._addVariable(catId); });
				return;
			}


			var cats = (AFF.state.config && AFF.state.config.categories) || [];
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

			AFF.App.ajax('aff_save_color', {
				filename: AFF.state.currentFile,
				variable: JSON.stringify(newVar),
			}).then(function (res) {
				if (res.success && res.data && res.data.data) {
					AFF.state.variables = res.data.data.variables || AFF.state.variables;
					if (AFF.App) { AFF.App.setDirty(true); AFF.App.refreshCounts(); }
					_collapsedCategoryIds[catId] = false;
					self._rerenderView();
				} else if (!res.success) {
					var msg = (res.data && res.data.message) ? res.data.message : 'Could not add variable.';
					AFF.Modal.open({ title: 'Add variable failed', body: '<p>' + msg + '</p>' });
				}
			}).catch(function () {
				AFF.Modal.open({ title: 'Connection error', body: '<p>Could not add color variable. Please try again.</p>' });
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

			if (!AFF.state.currentFile) {
				self._noFileModal();
				return;
			}

			AFF.Modal.open({
				title: 'New Category',
				body:  '<p style="margin-bottom:10px">Enter a name for the new category.</p>'
					+ '<input type="text" class="aff-field-input" id="aff-modal-cat-name"'
					+ ' placeholder="e.g., Accent" autocomplete="off" style="width:100%">',
				footer: '<div style="display:flex;justify-content:flex-end;gap:8px">'
					+ '<button class="aff-btn aff-btn--secondary" id="aff-modal-cat-cancel">Cancel</button>'
					+ '<button class="aff-btn" id="aff-modal-cat-ok">Add Category</button>'
					+ '</div>',
				onClose: function () { document.removeEventListener('click', handleClick); },
			});

			// Focus the input.
			setTimeout(function () {
				var input = document.getElementById('aff-modal-cat-name');
				if (input) { input.focus(); }
			}, 50);

			function handleClick(e) {
				if (e.target.id === 'aff-modal-cat-cancel') {
					AFF.Modal.close();
					document.removeEventListener('click', handleClick);
				} else if (e.target.id === 'aff-modal-cat-ok') {
					var input = document.getElementById('aff-modal-cat-name');
					var name  = input ? input.value.trim() : '';
					AFF.Modal.close();
					document.removeEventListener('click', handleClick);

					if (!name) { return; }

					AFF.App.ajax('aff_save_category', {
						filename: AFF.state.currentFile,
						category: JSON.stringify({ name: name }),
					}).then(function (res) {
						if (res.success && res.data) {
							if (!AFF.state.config) { AFF.state.config = {}; }
							// Use in-memory categories as the authoritative base — they are
							// always complete (set by _ensureUncategorized). The server response
							// may be stale if _ensureUncategorized's async save was still
							// in-flight when eff_save_category ran. Only splice in the new
							// category by ID so the full list is never truncated.
							var existing = (AFF.state.config.categories || []).slice();
							var newId = res.data.id;
							var alreadyInList = existing.some(function (c) { return c.id === newId; });
							if (!alreadyInList) {
								var serverCats = res.data.categories || [];
								for (var _sci = 0; _sci < serverCats.length; _sci++) {
									if (serverCats[_sci].id === newId) {
										existing.push(serverCats[_sci]);
										break;
									}
								}
							}
							AFF.state.config.categories = existing;
							if (AFF.App) { AFF.App.setDirty(true); }
							self._rerenderView();
							if (AFF.PanelLeft && AFF.PanelLeft.refresh) {
								AFF.PanelLeft.refresh();
							}
						}
					}).catch(function () { console.warn('[AFF] AJAX error: add category'); });
				}
			}

			document.addEventListener('click', handleClick);
		},

		/**
		 * Save a category name from the always-on name input.
		 *
		 * @param {HTMLElement} input The .aff-category-name-input element.
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

			if (!AFF.state.currentFile) {
				input.textContent = oldName;
				self._noFileModal();
				return;
			}

			AFF.App.ajax('aff_save_category', {
				filename: AFF.state.currentFile,
				category: JSON.stringify({ id: catId, name: newName }),
			}).then(function (res) {
				if (res.success && res.data) {
					if (!AFF.state.config) { AFF.state.config = {}; }
					AFF.state.config.categories = res.data.categories;
					input.setAttribute('data-original', newName);
					if (AFF.App) { AFF.App.setDirty(true); }
					self._rerenderView();
					if (AFF.PanelLeft && AFF.PanelLeft.refresh) {
						AFF.PanelLeft.refresh();
					}
				} else {
					input.textContent = oldName;
				}
			}).catch(function () { input.textContent = oldName; });
		},

		/**
		 * Delete a category with confirmation modal.
		 *
		 * @param {string} catId Category ID.
		 */
		_deleteCategory: function (catId) {
			var self = this;
			var vars = self._getVarsForCategoryId(catId);

			if (!AFF.state.currentFile) {
				self._noFileModal();
				return;
			}

			var bodyText = vars.length > 0
				? '<p>' + vars.length + ' variable(s) are in this category. Variables will be moved to Uncategorized.</p><p style="margin-top:8px">Delete the category anyway?</p>'
				: '<p>Delete this category?</p>';

			AFF.Modal.open({
				title: 'Delete Category',
				body:  bodyText,
				footer: '<div style="display:flex;justify-content:flex-end;gap:8px">'
					+ '<button class="aff-btn aff-btn--secondary" id="aff-modal-del-cancel">Cancel</button>'
					+ '<button class="aff-btn aff-btn--danger" id="aff-modal-del-ok">Delete Category</button>'
					+ '</div>',
				onClose: function () { document.removeEventListener('click', handleClick); },
			});

			function handleClick(e) {
				if (e.target.id === 'aff-modal-del-cancel') {
					AFF.Modal.close();
					document.removeEventListener('click', handleClick);
				} else if (e.target.id === 'aff-modal-del-ok') {
					AFF.Modal.close();
					document.removeEventListener('click', handleClick);

					AFF.App.ajax('aff_delete_category', {
						filename:    AFF.state.currentFile,
						category_id: catId,
					}).then(function (res) {
						if (res.success && res.data) {
							if (!AFF.state.config) { AFF.state.config = {}; }
							AFF.state.config.categories = res.data.categories;
							delete _collapsedCategoryIds[catId];
							if (AFF.App) { AFF.App.setDirty(true); }
							self._rerenderView();
							if (AFF.PanelLeft && AFF.PanelLeft.refresh) {
								AFF.PanelLeft.refresh();
							}
						} else if (!res.success) {
							var errMsg = (res.data && res.data.message) ? res.data.message : 'Delete failed.';
							AFF.Modal.open({ title: 'Delete failed', body: '<p>' + errMsg + '</p>' });
						}
					}).catch(function () {
						AFF.Modal.open({ title: 'Connection error', body: '<p>Connection error during delete.</p>' });
					});
				}
			}

			document.addEventListener('click', handleClick);
		},

		/**
		 * Return categories sorted by order, ensuring AFF.state.config.categories is initialised.
		 *
		 * @returns {Array} Sorted category objects.
		 */
		_getSortedCategories: function () {
			var hasCats = AFF.state.config && AFF.state.config.categories && AFF.state.config.categories.length > 0;
			var cats = hasCats
				? AFF.state.config.categories.slice().sort(function (a, b) {
					return (a.order || 0) - (b.order || 0);
				})
				: this._getDefaultCategories();
			if (!hasCats) {
				if (!AFF.state.config) { AFF.state.config = {}; }
				AFF.state.config.categories = cats.map(function (c, i) { return { id: c.id, name: c.name, order: i, locked: !!c.locked }; });
			}
			return cats;
		},

		/**
		 * Move a category up in display order.
		 *
		 * @param {string} catId Category ID to move up.
		 */
		_moveCategoryUp: function (catId) {
			var self = this;
			var cats = self._getSortedCategories();

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
			var cats = self._getSortedCategories();

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

			if (!AFF.state.currentFile) {
				self._noFileModal();
				return;
			}

			var cats = (AFF.state.config && AFF.state.config.categories) || [];
			var cat  = null;
			for (var i = 0; i < cats.length; i++) {
				if (cats[i].id === catId) { cat = cats[i]; break; }
			}
			if (!cat) { return; }

			var newName = cat.name + ' (copy)';

			AFF.App.ajax('aff_save_category', {
				filename: AFF.state.currentFile,
				category: JSON.stringify({ name: newName }),
			}).then(function (res) {
				if (!res.success || !res.data) { return; }

				var newCatId   = res.data.id;
				var newCatName = newName;

				if (!AFF.state.config) { AFF.state.config = {}; }
				AFF.state.config.categories = res.data.categories;

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
							return AFF.App.ajax('aff_save_color', {
								filename: AFF.state.currentFile,
								variable: JSON.stringify(dv),
							}).then(function (r) {
								if (r.success && r.data && r.data.data) {
									AFF.state.variables = r.data.data.variables;
								}
							});
						});
					}(dupVar));
				});
				chain.then(function () {
					AFF.App.setDirty(true);
					AFF.App.refreshCounts();
					self._rerenderView();
					if (AFF.PanelLeft && AFF.PanelLeft.refresh) { AFF.PanelLeft.refresh(); }
				}).catch(function () { console.warn('[AFF] AJAX error: usage scan after delete'); });

			}).catch(function () { console.warn('[AFF] AJAX error: delete variable'); });
		},

		/**
		 * Ensure the Uncategorized category always exists in config.
		 * Adds it if missing and persists if a file is currently loaded.
		 */
		_ensureUncategorized: function () {
			if (!AFF.state.config) { AFF.state.config = {}; }
			if (!Array.isArray(AFF.state.config.categories)) {
				AFF.state.config.categories = [];
			}
			var cats = AFF.state.config.categories;
			var _needsSave = false;

			// --- v1 → Phase 2 migration ---
			// If no Phase 2 category objects exist yet, seed from the v1 string list
			// stored in config.groups.Variables.Colors. This happens the first time a
			// file created before Phase 2 is opened in the Colors view.
			if (cats.length === 0) {
				var v1names = (AFF.state.config.groups &&
				               AFF.state.config.groups.Variables &&
				               AFF.state.config.groups.Variables.Colors) || [];
				if (v1names.length > 0) {
					// v1 — Phase 2 migration: seed from old string list.
					v1names.forEach(function (name, idx) {
						var safeName = String(name).toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
						cats.push({
							id:     'default-' + safeName,
							name:   String(name),
							order:  idx,
							locked: (name === 'Uncategorized'),
						});
					});
				} else {
					// Brand new project — seed all 5 default categories so the
					// edit view is fully populated and the file is written with
					// the complete list before any category-add requests arrive.
					var defaults = this._getDefaultCategories();
					for (var _di = 0; _di < defaults.length; _di++) {
						cats.push(defaults[_di]);
					}
				}
				// Categories were seeded in memory but not yet on disk — must persist.
				_needsSave = true;
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
			if (_needsSave && AFF.state.currentFile) {
				var d = { version: '1.0', config: AFF.state.config,
						  variables: AFF.state.variables || [] };
				AFF.App.ajax('aff_save_file', {
					project_name: AFF.state.projectName || 'unnamed-project',
					data:         JSON.stringify(d),
				}).catch(function () { console.warn('[AFF] AJAX error: save file'); });
			}
		},

		/**
		 * Sort all color variables alphabetically by name.
		 * @param {boolean} ascending  true = A→Z, false = Z→A
		 */
		_sortColors: function (ascending) {
			var self = this;
			var sorted = AFF.state.variables.slice().sort(function (a, b) {
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
						return AFF.App.ajax('aff_save_color', {
							filename: AFF.state.currentFile,
							variable: JSON.stringify(variable),
						}).then(function (r) {
							if (r.success && r.data && r.data.data) {
								AFF.state.variables = r.data.data.variables;
							}
						});
					});
				}(v));
			});
			chain.then(function () {
				AFF.App.setDirty(true);
				self._rerenderView();
			}).catch(function () { console.warn('[AFF] AJAX error: save variable'); });
		},

		/**
		 * Sort non-locked categories alphabetically (locked always last).
		 * @param {boolean} ascending  true = A→Z, false = Z→A
		 */
		_sortCategories: function (ascending) {
			var self = this;
			if (!AFF.state.config || !Array.isArray(AFF.state.config.categories)) { return; }
			var locked   = AFF.state.config.categories.filter(function (c) { return c.locked; });
			var unlocked = AFF.state.config.categories.filter(function (c) { return !c.locked; });
			unlocked.sort(function (a, b) {
				var na = (a.name || '').toLowerCase();
				var nb = (b.name || '').toLowerCase();
				return ascending ? (na < nb ? -1 : na > nb ? 1 : 0)
								 : (na > nb ? -1 : na < nb ? 1 : 0);
			});
			var combined = unlocked.concat(locked);
			combined.forEach(function (c, i) { c.order = i + 1; });
			AFF.state.config.categories = combined;
			AFF.App.ajax('aff_reorder_categories', {
				filename:    AFF.state.currentFile,
				ordered_ids: JSON.stringify(combined.map(function (c) { return c.id; })),
			}).then(function (r) {
				if (r.success && r.data && r.data.categories) {
					AFF.state.config.categories = r.data.categories;
				}
				AFF.App.setDirty(true);
				self._rerenderView();
				if (AFF.PanelLeft && AFF.PanelLeft.refresh) { AFF.PanelLeft.refresh(); }
			}).catch(function () { console.warn('[AFF] AJAX error: save format'); });
		},

		/**
		 * Delete a color variable (and optionally its children).
		 *
		 * @param {string} varId  Variable ID to delete.
		 */
		_deleteVariable: function (varId) {
			var self     = this;
			var variable = AFF.state.variables.find(function (v) { return v.id === varId; });
			if (!variable) { return; }

			var children = AFF.state.variables.filter(function (v) { return v.parent_id === varId; });
			var hasChildren = children.length > 0;

			var body = hasChildren
				? '<p>This variable has ' + children.length + ' child variable(s).</p>' +
				  '<p><button id="aff-del-var-with-children" class="aff-btn aff-btn--danger">Delete variable and all children</button> ' +
				  '<button id="aff-del-var-only" class="aff-btn">Delete variable only</button> ' +
				  '<button id="aff-del-var-cancel" class="aff-btn">Cancel</button></p>'
				: '<p>Delete <strong>' + (variable.name || varId) + '</strong>? This cannot be undone.</p>' +
				  '<p><button id="aff-del-var-confirm" class="aff-btn aff-btn--danger">Delete</button> ' +
				  '<button id="aff-del-var-cancel" class="aff-btn">Cancel</button></p>';

			AFF.Modal.open({ title: 'Delete variable', body: body, onClose: function () { document.removeEventListener('click', handleDelClick); } });

			function doDelete(deleteChildren) {
				AFF.Modal.close();
				document.removeEventListener('click', handleDelClick);
				AFF.App.ajax('aff_delete_color', {
					filename:        AFF.state.currentFile,
					variable_id:     varId,
					delete_children: deleteChildren ? '1' : '0',
				}).then(function (res) {
					if (res.success && res.data && res.data.data && res.data.data.variables) {
						AFF.state.variables = res.data.data.variables;
						AFF.App.setDirty(true);
						AFF.App.refreshCounts();
						self._rerenderView();
					} else if (!res.success) {
						var msg = (res.data && res.data.message) ? res.data.message : 'Delete failed.';
						AFF.Modal.open({ title: 'Error', body: '<p>' + msg + '</p>' });
					}
				}).catch(function () {
					AFF.Modal.open({ title: 'Connection error', body: '<p>Connection error during delete.</p>' });
				});
			}

			function handleDelClick(e) {
				var t = e.target;
				if (t.id === 'aff-del-var-cancel') {
					AFF.Modal.close();
					document.removeEventListener('click', handleDelClick);
				} else if (t.id === 'aff-del-var-with-children') {
					doDelete(true);
				} else if (t.id === 'aff-del-var-only' || t.id === 'aff-del-var-confirm') {
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
			if (AFF.state.config && AFF.state.config.categories) {
				var cats = AFF.state.config.categories;
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

			if (!AFF.state.currentFile) { return; }

			if (AFF.App) { AFF.App.setDirty(true); }
			AFF.App.ajax('aff_reorder_categories', {
				filename:    AFF.state.currentFile,
				ordered_ids: JSON.stringify(orderedIds),
			}).then(function (res) {
				if (res.success && res.data) {
					if (!AFF.state.config) { AFF.state.config = {}; }
					AFF.state.config.categories = res.data.categories;
					self._rerenderView();
				}
			}).catch(function () { console.warn('[AFF] AJAX error: move category down'); });
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
		var cats = (AFF.state.config && AFF.state.config.categories)
			? AFF.state.config.categories
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

		var block = container.querySelector('.aff-category-block[data-category-id="' + catId + '"]');
		if (!block) { return; }

		var list = block.querySelector('.aff-color-list');
		if (!list) { return; }

		var html = '';
		if (vars.length === 0) {
			html = '<p class="aff-colors-empty">No variables in this category.</p>';
		} else {
			for (var j = 0; j < vars.length; j++) {
				html += self._buildVariableRow(vars[j]);
			}
		}
		list.innerHTML = html;

		// Update sort button states in this block's column header row.
		var sortBtns = block.querySelectorAll('.aff-col-sort-btn');
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
			var handle = e.target.closest('.aff-cat-drag-handle');
			if (!handle) { return; }
			e.preventDefault();

			var block = handle.closest('.aff-category-block');
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
			ghost.className += ' aff-drag-ghost';
			document.body.appendChild(ghost);
			d.ghost = ghost;

			var indicator = document.createElement('div');
			indicator.className = 'aff-drop-indicator';
			indicator.style.display = 'none';
			indicator.style.pointerEvents = 'none';
			var _appEl  = document.getElementById('aff-app');
			var _accent = _appEl ? getComputedStyle(_appEl).getPropertyValue('--aff-clr-accent').trim() : '';
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

			var targetBlock = elBelow ? elBelow.closest('.aff-category-block') : null;
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

			var draggingBlock = container.querySelector('.aff-category-block[data-category-id="' + d.catId + '"]');
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
		var cats = (AFF.state.config.categories || []).slice();

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
		AFF.state.config.categories = cats;

		AFF.App.ajax('aff_reorder_categories', {
			subgroup:    'Colors',
			ordered_ids: JSON.stringify(ordered_ids),
		}).then(function (res) {
			if (res.success && res.data && res.data.categories) {
				AFF.state.config.categories = res.data.categories;
			}
			if (AFF.App) { AFF.App.setDirty(true); }
			if (AFF.PanelLeft) { AFF.PanelLeft.refresh(); }
			AFF.Colors._renderAll(AFF.state.currentSelection, document.getElementById('aff-edit-content'));
		}).catch(function () {
			AFF.Colors._renderAll(AFF.state.currentSelection, document.getElementById('aff-edit-content'));
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
				var handle = e.target.closest('.aff-drag-handle');
				if (!handle) { return; }
				e.preventDefault();

				var row = handle.closest('.aff-color-row');
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
				ghost.className += ' aff-drag-ghost';
				document.body.appendChild(ghost);
				_drag.ghost = ghost;

				// Create drop indicator — 2px accent-color horizontal line.
				var indicator = document.createElement('div');
				indicator.className = 'aff-drop-indicator';
				indicator.style.display = 'none';
				indicator.style.pointerEvents = 'none'; // Must not intercept elementFromPoint during mousemove
				// --aff-clr-accent is scoped to [data-aff-theme], not :root/body.
				// Read it from the .aff-app element so body-appended elements get the right color.
				var _appEl = document.getElementById('aff-app');
				var _accent = _appEl ? getComputedStyle(_appEl).getPropertyValue('--aff-clr-accent').trim() : '';
				if (!_accent) { _accent = '#f4c542'; }
				indicator.style.background = 'linear-gradient(to right, transparent, ' + _accent + ' 15%, ' + _accent + ' 85%, transparent)';
				indicator.style.boxShadow = '0 0 6px ' + _accent;
				document.body.appendChild(indicator);
				_drag.indicator = indicator;

				// Mark original row as being dragged.
				row.classList.add('aff-row-dragging');
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

				var targetRow = el ? el.closest('.aff-color-row') : null;

				// Auto-expand a collapsed category block when the drag ghost enters it,
				// so cross-category drops can show a row-level drop indicator.
				if (!targetRow && el) {
					var hoverBlock = el.closest('.aff-category-block');
					if (hoverBlock && hoverBlock.getAttribute('data-collapsed') === 'true') {
						hoverBlock.setAttribute('data-collapsed', 'false');
						// Re-probe now that the rows are visible.
						_drag.ghost.style.display = 'none';
						var el2 = document.elementFromPoint(e.clientX, e.clientY);
						_drag.ghost.style.display = '';
						var newRow = el2 ? el2.closest('.aff-color-row') : null;
						if (newRow) { targetRow = newRow; }
					}
				}

				// Fallback: cursor over expanded block but not on any row → append to end
				if (!targetRow && el) {
					var hoverBlock2 = el.closest('.aff-category-block');
					if (hoverBlock2 && hoverBlock2.getAttribute('data-collapsed') === 'false') {
						var blockRows = hoverBlock2.querySelectorAll('.aff-color-row:not(.aff-row-dragging)');
						if (blockRows.length > 0) {
							targetRow = blockRows[blockRows.length - 1];
							_drag._forceAfter = true;
					} else {
						// Empty expanded category — show indicator at the drop zone inside it
						var emptyBody = hoverBlock2.querySelector('.aff-color-list');
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
					_drag.indicator._targetCatBlock = targetRow.closest('.aff-category-block');
				} else {
					if (!el || !el.closest('.aff-category-block')) { _drag.indicator.style.display = 'none';
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
				var draggingRow = container.querySelector('.aff-color-row.aff-row-dragging');
				if (draggingRow) { draggingRow.classList.remove('aff-row-dragging'); }

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
		 * @param {HTMLElement|null} targetCatBlock .aff-category-block element at drop point.
		 */
		_dropVariable: function (draggedId, targetId, insertBefore, targetCatBlock) {
			var self = this;

			if (!AFF.state.currentFile) {
				self._ensureFileExists(function () {
					self._dropVariable(draggedId, targetId, insertBefore, targetCatBlock);
				});
				return;
			}

			// Find the dragged and target variable objects.
			var dragged = null;
			var target  = null;
			for (var i = 0; i < AFF.state.variables.length; i++) {
				if (self._rowKey(AFF.state.variables[i]) === draggedId) { dragged = AFF.state.variables[i]; }
				if (self._rowKey(AFF.state.variables[i]) === targetId)  { target  = AFF.state.variables[i]; }
			}
			// Special case: drop into an empty category (no target variable row exists).
		if (targetId === '__empty-cat__' && dragged && targetCatBlock) {
			var emptyCatId   = targetCatBlock.getAttribute('data-category-id');
			var emptyCatName = dragged.category; // fallback
			var ecCats = (AFF.state.config && AFF.state.config.categories) || self._getDefaultCategories();
			for (var ei = 0; ei < ecCats.length; ei++) {
				if (ecCats[ei].id === emptyCatId) { emptyCatName = ecCats[ei].name; break; }
			}
			for (var ek = 0; ek < AFF.state.variables.length; ek++) {
				if (self._rowKey(AFF.state.variables[ek]) === draggedId) {
					AFF.state.variables[ek].category    = emptyCatName;
					AFF.state.variables[ek].category_id = emptyCatId;
					AFF.state.variables[ek].order       = 0;
					break;
				}
			}
			self._rerenderView();
			if (AFF.App) { AFF.App.setDirty(true); }
			AFF.App.ajax('aff_save_color', {
				filename: AFF.state.currentFile,
				variable: JSON.stringify({ id: dragged.id, order: 0, category: emptyCatName, category_id: emptyCatId }),
			}).catch(function () { console.warn('[AFF] AJAX error: drop into empty category'); });
			return;
		}

		if (!dragged || !target) { return; }

			// Determine target category from the targetCatBlock element.
			var newCatId   = targetCatBlock ? targetCatBlock.getAttribute('data-category-id') : dragged.category_id;
			var newCatName = dragged.category;

			// Find category name from config.
			var cats = (AFF.state.config && AFF.state.config.categories) || self._getDefaultCategories();
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
				// Update in AFF.state.variables.
				for (var sj = 0; sj < AFF.state.variables.length; sj++) {
					if (AFF.state.variables[sj] === catVars[si]) {
						AFF.state.variables[sj].order       = si;
						AFF.state.variables[sj].category    = newCatName;
						AFF.state.variables[sj].category_id = newCatId;
						break;
					}
				}
				saves.push({ id: catVars[si].id, order: si, category: newCatName, category_id: newCatId });
			}

			// If dragged changed category, also update its category in state.
			if (dragged.category_id !== newCatId) {
				for (var dk = 0; dk < AFF.state.variables.length; dk++) {
					if (self._rowKey(AFF.state.variables[dk]) === draggedId) {
						AFF.state.variables[dk].category    = newCatName;
						AFF.state.variables[dk].category_id = newCatId;
						break;
					}
				}
			}

			self._rerenderView();
			if (AFF.App) { AFF.App.setDirty(true); }

			// Persist each affected variable via AJAX (fire-and-forget).
			for (var pi = 0; pi < saves.length; pi++) {
				(function (saveItem) {
					AFF.App.ajax('aff_save_color', {
						filename: AFF.state.currentFile,
						variable: JSON.stringify(saveItem),
					}).catch(function () { console.warn('[AFF] AJAX error: persist drop reorder'); });
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

			var cats   = (AFF.state.config && AFF.state.config.categories) || [];
			var newCat = null;
			for (var i = 0; i < cats.length; i++) {
				if (cats[i].id === newCatId) { newCat = cats[i]; break; }
			}
			if (!newCat) { return; }

			v.category_id = newCatId;
			v.category    = newCat.name;
			v.status      = 'modified';

			self._rerenderView();

			if (!AFF.state.currentFile) { return; }
			if (AFF.App) { AFF.App.setDirty(true); }

			AFF.App.ajax('aff_save_color', {
				filename: AFF.state.currentFile,
				variable: JSON.stringify({ id: v.id, category_id: newCatId, category: newCat.name, status: 'modified' }),
			}).then(function (res) {
				if (res.success && res.data && res.data.data) {
					AFF.state.variables = res.data.data.variables;
				}
			}).catch(function () { console.warn('[AFF] AJAX error: refresh variables'); });
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
		 * @param {HTMLElement} panel The .aff-expand-panel element.
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
		 * @param {HTMLElement} panel The .aff-expand-panel element.
		 */
		_generateChildren: function (varId, panel) {
			var self  = this;
			var v     = self._findVarByKey(varId);

			if (!AFF.state.currentFile) {
				self._noFileModal();
				return;
			}

			// Variable must have a server-assigned UUID.
			if (!v || !v.id) {
				AFF.Modal.open({
					title: 'Variable not saved',
					body:  '<p>Save the project file first so this variable gets an ID, then try generating again.</p>',
				});
				return;
			}

			var tintsNum  = panel ? panel.querySelector('.aff-gen-tints-num')  : null;
			var shadesNum = panel ? panel.querySelector('.aff-gen-shades-num') : null;
			var transChk  = panel ? panel.querySelector('.aff-gen-trans-toggle') : null;

			var tintSteps  = tintsNum  ? (parseInt(tintsNum.value,  10) || 0) : 0;
			var shadeSteps = shadesNum ? (parseInt(shadesNum.value, 10) || 0) : 0;
			var transOn    = transChk  ? (transChk.checked ? '1' : '0') : '0';

			AFF.App.ajax('aff_generate_children', {
				filename:       AFF.state.currentFile,
				parent_id:      v.id,
				tints:          String(tintSteps),
				shades:         String(shadeSteps),
				transparencies: transOn,
			}).then(function (res) {
				if (res.success && res.data) {
					if (res.data.data && res.data.data.variables) {
						AFF.state.variables = res.data.data.variables;
					}
					if (AFF.App) { AFF.App.setDirty(true); AFF.App.refreshCounts(); }
				}
			}).catch(function () { console.warn('[AFF] AJAX error: merge file'); });
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
					if (AFF.App) { AFF.App.setDirty(true); }
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
					if (AFF.App) { AFF.App.setDirty(true); }
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
			var rows = container.querySelectorAll('.aff-color-row');

			for (var i = 0; i < rows.length; i++) {
				var nameInput  = rows[i].querySelector('.aff-color-name-input');
				var valueInput = rows[i].querySelector('.aff-color-value-input');
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
			var blocks = container.querySelectorAll('.aff-category-block');
			for (var i = 0; i < blocks.length; i++) {
				var catId = blocks[i].getAttribute('data-category-id');
				blocks[i].setAttribute('data-collapsed', collapsed ? 'true' : 'false');
				if (catId) { _collapsedCategoryIds[catId] = collapsed; }
			}

			// Update toggle button icon and label.
			var toggleBtn = container.querySelector('#aff-colors-collapse-toggle');
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
			var content = document.getElementById('aff-edit-content');
			if (!content || !AFF.state.currentSelection) { return; }

			// Call _renderAll directly to avoid resetting _collapsedCategoryIds.
			// (loadColors would re-apply _focusedCategoryId from currentSelection
			//  and wipe out the manual collapse overrides set by recent CRUD ops.)
			_focusedCategoryId = null;
			this._renderAll(AFF.state.currentSelection, content);
		},

		/**
		 * Update just the swatch background in the DOM without a full re-render.
		 *
		 * @param {string} varId Variable ID.
		 * @param {string} value CSS color value.
		 */
		_updateSwatchInDOM: function (varId, value) {
			var content = document.getElementById('aff-edit-content');
			if (!content) { return; }
			var row    = content.querySelector('.aff-color-row[data-var-id="' + varId + '"]');
			if (!row) { return; }
			var swatch = row.querySelector('.aff-color-swatch');
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
			var allVars = AFF.state.variables || [];

			if (cat.name === 'Uncategorized') {
				// Build lookup of all non-Uncategorized category IDs and names.
				var cats = (AFF.state.config && AFF.state.config.categories)
					? AFF.state.config.categories
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
			return (AFF.state.variables || []).filter(function (v) {
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
			return (AFF.state.variables || []).filter(function (v) {
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
			var vars = AFF.state.variables || [];
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
			var vars = AFF.state.variables || [];
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
				// 3-digit → 6-digit: F53 → FF5533
				if (/^[0-9A-F]{3}$/.test(bare)) {
					bare = bare[0]+bare[0] + bare[1]+bare[1] + bare[2]+bare[2];
				// 4-digit → 8-digit (each digit doubled): F004 → FF000044
				} else if (/^[0-9A-F]{4}$/.test(bare)) {
					bare = bare[0]+bare[0] + bare[1]+bare[1] + bare[2]+bare[2] + bare[3]+bare[3];
				}
				if (/^[0-9A-F]{6}$/.test(bare) || /^[0-9A-F]{8}$/.test(bare)) {
					return { value: '#' + bare, error: null };
				}
				return { value: v, error: 'HEX must be 3, 4, 6, or 8 hex digits (0–9, A–F). Examples: #F53, #F004, #FF5733, #FF573380' };
			}

			// ---- RGB / RGBA ----
			if (format === 'RGB' || format === 'RGBA') {
				var inner = v.replace(/^rgba?\s*\(/i, '').replace(/\)\s*$/, '').trim();
				var parts = inner.split(/[\s,]+/).filter(function (s) { return s !== ''; });
				if (parts.length < 3) {
					return { value: v, error: 'RGB requires at least 3 values. Example: rgb(255, 87, 51) or rgba(255, 87, 51, 0.8)' };
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
				// 4th value = alpha → output rgba(); otherwise rgb()
				if (parts.length >= 4) {
					var a = parseFloat(parts[3]);
					if (isNaN(a)) {
						return { value: v, error: 'Alpha must be a decimal number (0–1). Example: 0.5' };
					}
					a = Math.round(Math.max(0, Math.min(1, a)) * 100) / 100;
					return { value: 'rgba(' + r + ', ' + g + ', ' + b + ', ' + a + ')', error: null };
				}
				return { value: 'rgb(' + r + ', ' + g + ', ' + b + ')', error: null };
			}

			// ---- HSL / HSLA ----
			if (format === 'HSL' || format === 'HSLA') {
				var inner2 = v.replace(/^hsla?\s*\(/i, '').replace(/\)\s*$/, '').trim();
				var raw2   = inner2.replace(/%/g, '');
				var pts    = raw2.split(/[\s,]+/).filter(function (s) { return s !== ''; });
				if (pts.length < 3) {
					return { value: v, error: 'HSL requires at least 3 values. Example: hsl(200, 60%, 40%) or hsla(200, 60%, 40%, 0.8)' };
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
				// 4th value = alpha → output hsla(); otherwise hsl()
				if (pts.length >= 4) {
					var a2 = parseFloat(pts[3]);
					if (isNaN(a2)) {
						return { value: v, error: 'Alpha must be a decimal number (0–1). Example: 0.5' };
					}
					a2 = Math.round(Math.max(0, Math.min(1, a2)) * 100) / 100;
					return { value: 'hsla(' + h + ', ' + s + '%, ' + l + '%, ' + a2 + ')', error: null };
				}
				return { value: 'hsl(' + h + ', ' + s + '%, ' + l + '%)', error: null };
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
		/**
		 * Convert a Pickr Color object to a normalizable CSS string.
		 *
		 * @param {object} color  Pickr Color instance.
		 * @param {string} format 'HEXA' | 'RGBA' | 'HSLA'
		 * @returns {string}
		 */
		/**
		 * Re-render tints, shades, and transparencies after a color change.
		 *
		 * @param {HTMLElement} modal  The open expand modal element.
		 * @param {string}      varId  Variable ID.
		 */
		_refreshModalPalettes: function (modal, varId) {
			var self  = this;
			var vv    = self._findVarByKey(varId);
			if (!vv || !modal) { return; }
			var rgba2     = self._parseToRgba(vv.value || '');
			var hsl2      = rgba2 ? self._rgbToHsl(rgba2.r, rgba2.g, rgba2.b) : null;
			var tintsNum  = modal.querySelector('.aff-gen-tints-num');
			var shadesNum = modal.querySelector('.aff-gen-shades-num');
			var transChk  = modal.querySelector('.aff-gen-trans-toggle');
			var tintsPal  = modal.querySelector('.aff-tints-palette');
			var shadesPal = modal.querySelector('.aff-shades-palette');
			var transPal  = modal.querySelector('.aff-trans-palette');
			if (tintsPal && tintsNum) {
				var ts = parseInt(tintsNum.value, 10) || 0;
				tintsPal.innerHTML = self._buildTintsBars(hsl2, ts);
			}
			if (shadesPal && shadesNum) {
				var ss = parseInt(shadesNum.value, 10) || 0;
				shadesPal.innerHTML = self._buildShadesBars(hsl2, ss);
			}
			if (transPal && transChk) {
				transPal.innerHTML = transChk.checked ? self._buildTransBars(rgba2) : '';
			}
			self._debounceGenerate(varId, modal);
		},

		_pickrColorToString: function (color, format) {
			var rgba    = color.toRGBA();
			var alpha   = rgba[3]; // 0–1
			var opaque  = alpha >= 0.999;
			// Normalise legacy alpha-suffix formats.
			var fmt = (format || 'HEX').replace(/A$/, '');
			if (fmt === 'HEX') {
				var hexStr = color.toHEXA().toString(); // #RRGGBBAA
				return opaque ? hexStr.slice(0, 7) : hexStr;
			}
			if (fmt === 'RGB') {
				var r = Math.round(rgba[0]);
				var g = Math.round(rgba[1]);
				var b = Math.round(rgba[2]);
				if (opaque) { return 'rgb(' + r + ', ' + g + ', ' + b + ')'; }
				var a = Math.round(alpha * 100) / 100;
				return 'rgba(' + r + ', ' + g + ', ' + b + ', ' + a + ')';
			}
			if (fmt === 'HSL') {
				var hsla = color.toHSLA();
				var h = Math.round(hsla[0]);
				var s = Math.round(hsla[1]);
				var l = Math.round(hsla[2]);
				if (opaque) { return 'hsl(' + h + ', ' + s + '%, ' + l + '%)'; }
				var a2 = Math.round(alpha * 100) / 100;
				return 'hsla(' + h + ', ' + s + '%, ' + l + '%, ' + a2 + ')';
			}
			return '';
		},

		_showFieldError: function (input, message) {
			this._clearFieldError(input);
			var el  = document.createElement('div');
			el.className = 'aff-inline-error';
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
				+ '<input type="text" id="aff-nfl-filename" class="aff-text-input"'
				+ ' value="elementor-variables.eff.json"'
				+ ' style="width:100%;margin-top:12px;" />';

			var footer = '<button class="aff-btn aff-btn--primary" id="aff-nfl-save-btn">Save File</button>';

			AFF.Modal.open({ title: 'No file loaded', body: body, footer: footer });

			var saveBtn = document.getElementById('aff-nfl-save-btn');
			if (!saveBtn) { return; }

			saveBtn.addEventListener('click', function () {
				var inp      = document.getElementById('aff-nfl-filename');
				var filename = inp ? inp.value.trim() : '';
				if (!filename) { return; }
				if (!/\.eff\.json$/.test(filename)) { filename += '.eff.json'; }

				var saveData = {
					config:    { categories: (AFF.state.config && AFF.state.config.categories) ? AFF.state.config.categories : [] },
					variables: AFF.state.variables || [],
				};

				saveBtn.disabled    = true;
				saveBtn.textContent = 'Saving\u2026';

				AFF.App.ajax('aff_save_file', {
					project_name: filename.replace(/\.eff(?:\.json)?$/i, ''),
					data:         JSON.stringify(saveData),
				}).then(function (res) {
					if (res.success && res.data) {
						AFF.state.currentFile = res.data.filename;
						if (AFF.App && AFF.App.setDirty) { AFF.App.setDirty(false); }
						AFF.Modal.close();
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
				orphaned: 'Orphaned \u2014 Exists in AFFbut not found in Elementor kit. Commit to add it.',
			};
			return map[status] || ('Status: ' + status);
		},

		_statusColor: function (status) {
			var map = {
				synced:   'var(--aff-status-synced)',
				modified: 'var(--aff-status-modified)',
				conflict: 'var(--aff-status-conflict)',
				orphaned: 'var(--aff-status-orphaned)',
				new:      'var(--aff-status-new)',
				deleted:  'var(--aff-status-deleted)',
			};
			return map[status] || 'var(--aff-status-synced)';
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

	};

}());
