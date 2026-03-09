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

	/**
	 * The category ID to scroll to and expand after rendering, or null.
	 * Set by loadColors() from selection.categoryId (nav item click).
	 */
	var _focusedCategoryId = null;

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
			// Single row: add-category | spacer | search (flex-grow, right) | close | collapse-toggle
			html += '<div class="eff-colors-filter-bar">'
				+ '<div class="eff-filter-bar-top">'
				+ '<button class="eff-icon-btn eff-colors-add-cat-btn" id="eff-colors-add-category"'
				+ ' title="Add a new category" aria-label="Add category">'
				+ self._plusCircleSVG()
				+ '</button>'
				+ '<span style="flex:1"></span>'
				+ '<input type="text" class="eff-colors-search" id="eff-colors-search"'
				+ ' placeholder="Search\u2026" aria-label="Search color variables">'
				+ '<button class="eff-icon-btn eff-colors-back-btn" id="eff-colors-back"'
				+ ' title="Close colors view" aria-label="Close colors view">'
				+ self._closeSVG()
				+ '</button>'
				+ '<button class="eff-icon-btn" id="eff-colors-collapse-toggle"'
				+ ' title="' + _toggleTitle + '" aria-label="' + _toggleTitle + '"'
				+ ' data-toggle-state="' + _toggleState + '">'
				+ _toggleSVG
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
				+ '>';

			// --- Header: single row — always-on name input + count + actions ---
			html += '<div class="eff-category-header">'
				+ '<div class="eff-cat-header-top">'
				+ '<div class="eff-cat-header-left">'

				// Always-on name input (same editing style as variable names).
				+ '<input type="text" class="eff-category-name-input"'
				+ ' data-cat-id="' + self._esc(cat.id) + '"'
				+ ' value="' + self._esc(cat.name) + '"'
				+ ' data-original="' + self._esc(cat.name) + '"'
				+ ' aria-label="Category name"'
				+ ' readonly'
				+ (cat.locked ? ' data-locked="true"' : '') + '>'

				// Variable count badge.
				+ '<span class="eff-category-count">' + count + '</span>'

				+ '</div>' // .eff-cat-header-left

				+ '<div class="eff-category-actions" role="toolbar" aria-label="Category actions">'
				+ self._catBtn('duplicate', 'Duplicate category', self._duplicateSVG(), '')
				+ self._catBtn('move-up',   'Move category up',   self._arrowUpSVG(),   '', catIndex === 0)
				+ self._catBtn('move-down', 'Move category down', self._arrowDownSVG(), '', catIndex === catTotal - 1)
				+ (cat.locked ? '' : self._catBtn('delete', 'Delete category', self._trashSVG(), 'eff-icon-btn--danger'))
				+ self._catBtn('collapse', 'Collapse/expand category', self._chevronSVG(), 'eff-category-collapse-btn')
				+ '</div>' // .eff-category-actions

				+ '</div>' // .eff-cat-header-top
				+ '</div>'; // .eff-category-header

			// Variable rows (no column headers, no dividers — category is a single entity).
			html += '<div class="eff-color-list">';
			if (count === 0) {
				html += '<p class="eff-colors-empty">No variables in this category.</p>';
			} else {
				for (var i = 0; i < vars.length; i++) {
					html += self._buildVariableRow(vars[i]);
				}
			}
			// Add-variable footer button (inside list so it hides with collapse).
			html += '<div class="eff-cat-list-footer">'
				+ '<button class="eff-icon-btn eff-add-var-btn" data-action="add-var"'
				+ ' aria-label="Add variable to ' + self._esc(cat.name) + '"'
				+ ' title="Add variable">'
				+ self._plusCircleSVG()
				+ '</button>'
				+ '</div>';
			html += '</div>'; // .eff-color-list

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

				// Status dot (Phase 2e).
				+ '<span class="eff-status-dot"'
				+ ' style="background:' + statusColor + '"'
				+ ' title="Status: ' + this._esc(status) + '"'
				+ ' aria-label="Status: ' + this._esc(status) + '">'
				+ '</span>'

				// Color swatch.
				+ '<span class="eff-color-swatch"'
				+ ' style="background:' + swatchBg + '"'
				+ ' data-action="open-picker"'
				+ ' aria-label="Color swatch \u2014 click expand to pick">'
				+ '</span>'

				// Name input (Phase 2c — always editable).
				+ '<div class="eff-color-name-field">'
				+ '<input type="text" class="eff-color-name-input"'
				+ ' value="' + this._esc(v.name) + '"'
				+ ' data-original="' + this._esc(v.name) + '"'
				+ ' readonly'
				+ ' aria-label="Variable name"'
				+ ' spellcheck="false">'
				+ '</div>'

				// Value field wrapper (shadows applied to wrapper in CSS).
				+ '<div class="eff-color-value-field">'
				+ '<input type="text" class="eff-color-value-input"'
				+ ' value="' + this._esc(v.value || '') + '"'
				+ ' data-original="' + this._esc(v.value || '') + '"'
				+ ' aria-label="Color value"'
				+ ' spellcheck="false">'
				+ '</div>'

				// Format field wrapper (shadows applied to wrapper in CSS).
				+ '<div class="eff-color-format-field">'
				+ '<select class="eff-color-format-sel" aria-label="Color format">'
				+ this._formatOptions(v.format || 'HEX')
				+ '</select>'
				+ '</div>'

				// Expand button.
				+ '<button class="eff-icon-btn eff-color-expand-btn"'
				+ ' data-action="expand"'
				+ ' aria-label="' + (isExpanded ? 'Collapse' : 'Expand') + ' color editor"'
				+ ' aria-expanded="' + (isExpanded ? 'true' : 'false') + '">'
				+ this._chevronSVG()
				+ '</button>'

				+ '</div>'; // .eff-color-row

			// If this row's expand panel is open, include it immediately after.
			if (isExpanded) {
				html += this._buildExpandPanel(v, rowKey);
			}

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
		 * Build the inline expand panel for a variable.
		 *
		 * @param {Object} v      Variable object.
		 * @param {string} rowKey Unique row key (v.id or synthetic name key).
		 * @returns {string}
		 */
		_buildExpandPanel: function (v, rowKey) {
			var self     = this;
			rowKey       = rowKey || self._rowKey(v);
			var children = self._getChildVars(v.id);
			var tints    = children.filter(function (c) { return c.name.indexOf('-plus-') !== -1; });
			var shades   = children.filter(function (c) { return c.name.indexOf('-minus-') !== -1; });

			// Parse current hex for picker.
			var hex6     = self._parseHex6(v.value || '');
			var alphaVal = self._parseAlpha(v.value || '');
			var alphaPct = Math.round(alphaVal * 100);

			var html = '<div class="eff-expand-panel" data-expand-for="' + self._esc(rowKey) + '">';

			// Zone 1 — Generator controls.
			html += '<div class="eff-expand-zone eff-expand-zone--generator">'
				+ '<div class="eff-expand-zone-label">Generate</div>'

				+ '<div class="eff-gen-row">'
				+ '<label for="eff-gen-tints-' + self._esc(rowKey) + '">Tints</label>'
				+ '<select id="eff-gen-tints-' + self._esc(rowKey) + '" class="eff-gen-tints">'
				+ '<option value="0">Off</option>'
				+ '<option value="3">3-step (300/600/900)</option>'
				+ '<option value="9">9-step (100\u2013900)</option>'
				+ '</select>'
				+ '</div>'

				+ '<div class="eff-gen-row">'
				+ '<label for="eff-gen-shades-' + self._esc(rowKey) + '">Shades</label>'
				+ '<select id="eff-gen-shades-' + self._esc(rowKey) + '" class="eff-gen-shades">'
				+ '<option value="0">Off</option>'
				+ '<option value="3">3-step (300/600/900)</option>'
				+ '<option value="9">9-step (100\u2013900)</option>'
				+ '</select>'
				+ '</div>'

				+ '<div class="eff-gen-row">'
				+ '<label for="eff-gen-trans-' + self._esc(rowKey) + '">Transparencies</label>'
				+ '<select id="eff-gen-trans-' + self._esc(rowKey) + '" class="eff-gen-trans">'
				+ '<option value="0">Off</option>'
				+ '<option value="5">5 steps</option>'
				+ '<option value="10">10 steps</option>'
				+ '</select>'
				+ '</div>'

				+ '<button class="eff-btn eff-btn--secondary eff-gen-generate-btn" data-var-id="' + self._esc(rowKey) + '">Generate</button>'
				+ '</div>'; // Zone 1

			// Zone 2 — Preview bars (conditional on existing children).
			html += '<div class="eff-expand-zone eff-expand-zone--preview"'
				+ (children.length === 0 ? ' hidden' : '') + '>'
				+ '<div class="eff-expand-zone-label">Preview</div>';

			if (tints.length > 0) {
				html += '<div class="eff-swatch-preview-row">';
				for (var t = 0; t < tints.length; t++) {
					var tStep = tints[t].name.replace(/.*-plus-/, '+');
					html += '<div class="eff-preview-swatch">'
						+ '<span class="eff-preview-swatch-color" style="background:' + self._esc(tints[t].value || '') + '"></span>'
						+ '<span class="eff-preview-swatch-label">' + self._esc(tStep) + '</span>'
						+ '</div>';
				}
				html += '</div>';
			}

			if (shades.length > 0) {
				html += '<div class="eff-swatch-preview-row">';
				for (var s = 0; s < shades.length; s++) {
					var sStep = shades[s].name.replace(/.*-minus-/, '-');
					html += '<div class="eff-preview-swatch">'
						+ '<span class="eff-preview-swatch-color" style="background:' + self._esc(shades[s].value || '') + '"></span>'
						+ '<span class="eff-preview-swatch-label">' + self._esc(sStep) + '</span>'
						+ '</div>';
				}
				html += '</div>';
			}

			html += '</div>'; // Zone 2

			// Zone 3 — Color picker.
			html += '<div class="eff-expand-zone eff-expand-zone--picker">'
				+ '<div class="eff-expand-zone-label">Color picker</div>'
				+ '<div class="eff-picker-row">'
				+ '<input type="color" class="eff-native-picker"'
				+ ' value="' + self._esc(hex6 || '#000000') + '"'
				+ ' data-var-id="' + self._esc(rowKey) + '"'
				+ ' aria-label="Color picker">'
				+ '<input type="text" class="eff-hex-input"'
				+ ' value="' + self._esc(hex6 || '') + '"'
				+ ' placeholder="#000000"'
				+ ' data-var-id="' + self._esc(rowKey) + '"'
				+ ' aria-label="Hex color value"'
				+ ' spellcheck="false"'
				+ ' maxlength="7">'
				+ '</div>'
				+ '<div class="eff-alpha-row">'
				+ '<label for="eff-alpha-' + self._esc(rowKey) + '">Alpha</label>'
				+ '<input type="range" class="eff-alpha-slider"'
				+ ' id="eff-alpha-' + self._esc(rowKey) + '"'
				+ ' min="0" max="100" value="' + alphaPct + '"'
				+ ' data-var-id="' + self._esc(rowKey) + '"'
				+ ' aria-label="Alpha channel (' + alphaPct + '%)">'
				+ '<span class="eff-alpha-value">' + alphaPct + '%</span>'
				+ '</div>'
				+ '</div>'; // Zone 3

			html += '</div>'; // .eff-expand-panel
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

			// ---- Generate children button ----
			container.addEventListener('click', function (e) {
				var genBtn = e.target.closest('.eff-gen-generate-btn');
				if (!genBtn) { return; }
				var varId = genBtn.getAttribute('data-var-id');
				if (varId !== null) { self._generateChildren(varId, genBtn.closest('.eff-expand-panel')); }
			});

			// ---- Name / Category name input: double-click to start editing ----
			// On single mousedown: prevent focus (keep input non-interactive).
			// On double mousedown (< 300ms): activate editing and select text.
			container.addEventListener('mousedown', function (e) {
				var input = e.target.closest('.eff-color-name-input, .eff-category-name-input');
				if (!input) { return; }
				if (!input.hasAttribute('readonly')) { return; } // already editing
				if (input.getAttribute('data-locked') === 'true') { return; }

				var now  = Date.now();
				var last = input._effLastMousedown || 0;
				input._effLastMousedown = now;

				if (now - last < 300) {
					// Double-click: activate editing
					input.removeAttribute('readonly');
					// Allow focus to happen (don't prevent default),
					// then select all text
					setTimeout(function () { input.focus(); input.select(); }, 0);
				} else {
					// Single click: block focus on readonly input
					e.preventDefault();
				}
			});


			// ---- Restore readonly on focusout (both name input types) ----
			container.addEventListener('focusout', function (e) {
				var nameInput = e.target.closest('.eff-color-name-input');
				if (nameInput) { nameInput.setAttribute('readonly', ''); return; }
				var catInput = e.target.closest('.eff-category-name-input');
				if (catInput && catInput.getAttribute('data-locked') !== 'true') {
					catInput.setAttribute('readonly', '');
				}
			});

			// ---- Category name input: save on blur and Enter ----
			container.addEventListener('change', function (e) {
				var catInput = e.target.closest('.eff-category-name-input');
				if (!catInput) { return; }
				self._saveCategoryName(catInput);
			});
			container.addEventListener('keydown', function (e) {
				if (e.key !== 'Enter') { return; }
				var catInput = e.target.closest('.eff-category-name-input');
				if (!catInput) { return; }
				catInput.blur();
			});

			// ---- Name input: save on blur and Enter ----
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
				if (varId !== null) { self._saveVarValue(varId, valueInput.value, valueInput); }
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

			// ---- Color picker Zone 3 ----
			// Native color picker → update hex input and save.
			container.addEventListener('change', function (e) {
				var picker = e.target.closest('.eff-native-picker');
				if (!picker) { return; }
				var varId  = picker.getAttribute('data-var-id');
				var panel  = picker.closest('.eff-expand-panel');
				if (varId === null || !panel) { return; }
				var newHex      = picker.value; // e.g., '#3d2f1f'
				var alphaSlider = panel.querySelector('.eff-alpha-slider');
				var alphaVal    = alphaSlider ? parseInt(alphaSlider.value, 10) : 100;
				var fullValue   = self._combineHexAlpha(newHex, alphaVal);

				var hexInput = panel.querySelector('.eff-hex-input');
				if (hexInput) { hexInput.value = newHex; }

				self._saveVarValue(varId, fullValue, null);
				self._updateSwatchInDOM(varId, fullValue);
			});

			// Hex text input → update picker and save.
			container.addEventListener('change', function (e) {
				var hexInput = e.target.closest('.eff-hex-input');
				if (!hexInput) { return; }
				var varId = hexInput.getAttribute('data-var-id');
				var panel  = hexInput.closest('.eff-expand-panel');
				if (varId === null || !panel) { return; }

				var raw    = hexInput.value.trim();
				var hex6   = self._parseHex6(raw);
				if (!hex6) { return; } // Invalid — don't save.

				var alphaSlider = panel.querySelector('.eff-alpha-slider');
				var alphaVal   = alphaSlider ? parseInt(alphaSlider.value, 10) : 100;
				var fullValue  = self._combineHexAlpha(hex6, alphaVal);

				var nativePicker = panel.querySelector('.eff-native-picker');
				if (nativePicker) { nativePicker.value = hex6; }

				self._saveVarValue(varId, fullValue, null);
				self._updateSwatchInDOM(varId, fullValue);
			});
			container.addEventListener('keydown', function (e) {
				if (e.key !== 'Enter') { return; }
				var hexInput = e.target.closest('.eff-hex-input');
				if (!hexInput) { return; }
				hexInput.blur();
			});

			// Alpha slider → update alpha value label and save.
			container.addEventListener('input', function (e) {
				var slider = e.target.closest('.eff-alpha-slider');
				if (!slider) { return; }
				var panel = slider.closest('.eff-expand-panel');
				if (!panel) { return; }
				var label = panel.querySelector('.eff-alpha-value');
				if (label) { label.textContent = slider.value + '%'; }
			});
			container.addEventListener('change', function (e) {
				var slider = e.target.closest('.eff-alpha-slider');
				if (!slider) { return; }
				var varId  = slider.getAttribute('data-var-id');
				var panel  = slider.closest('.eff-expand-panel');
				if (varId === null || !panel) { return; }

				var alphaVal     = parseInt(slider.value, 10);
				var nativePicker = panel.querySelector('.eff-native-picker');
				var hex6         = nativePicker ? nativePicker.value : '';
				var fullValue    = self._combineHexAlpha(hex6, alphaVal);

				self._saveVarValue(varId, fullValue, null);
				self._updateSwatchInDOM(varId, fullValue);
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
		 * Toggle the expand panel for a given variable row.
		 *
		 * @param {string}      varId     Variable ID.
		 * @param {HTMLElement} row       The .eff-color-row element.
		 * @param {HTMLElement} container The content container.
		 */
		_toggleExpandPanel: function (varId, row, container) {
			var self = this;

			// If this panel is already open, close it.
			if (self._openExpandId === varId) {
				self._closeExpandPanel(container);
				return;
			}

			// Close any currently open panel.
			self._closeExpandPanel(container);

			// Find the variable.
			var v = self._findVarByKey(varId);
			if (!v) { return; }

			// Mark row as expanded.
			row.setAttribute('data-expanded', 'true');
			var expandBtn = row.querySelector('.eff-color-expand-btn');
			if (expandBtn) { expandBtn.setAttribute('aria-expanded', 'true'); }

			// Insert expand panel after the row.
			var panelHtml = self._buildExpandPanel(v, varId);
			var temp      = document.createElement('div');
			temp.innerHTML = panelHtml;
			var panelEl   = temp.firstChild;

			if (row.nextSibling) {
				row.parentNode.insertBefore(panelEl, row.nextSibling);
			} else {
				row.parentNode.appendChild(panelEl);
			}

			self._openExpandId = varId;
		},

		/**
		 * Close any open expand panel.
		 *
		 * @param {HTMLElement} container
		 */
		_closeExpandPanel: function (container) {
			if (!this._openExpandId) { return; }

			var panelEl = container.querySelector('.eff-expand-panel[data-expand-for="' + this._openExpandId + '"]');
			if (panelEl) { panelEl.parentNode.removeChild(panelEl); }

			var row = container.querySelector('.eff-color-row[data-var-id="' + this._openExpandId + '"]');
			if (row) {
				row.removeAttribute('data-expanded');
				var expandBtn = row.querySelector('.eff-color-expand-btn');
				if (expandBtn) { expandBtn.setAttribute('aria-expanded', 'false'); }
			}

			this._openExpandId = null;
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
				return;
			}

			var v = self._findVarByKey(varId);
			if (!v) { return; }

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

			// Update DOM immediately.
			if (converted !== null) {
				var content = document.getElementById('eff-edit-content');
				if (content) {
					var row = content.querySelector('.eff-color-row[data-var-id="' + self._esc(varId) + '"]');
					if (row) {
						var valInput = row.querySelector('.eff-color-value-input');
						if (valInput) { valInput.value = converted; valInput.setAttribute('data-original', converted); }
						var swatch = row.querySelector('.eff-color-swatch');
						if (swatch) { swatch.style.background = converted; }
					}
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
				self._noFileModal();
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
					// Ensure the category stays expanded so the user sees the new row.
					_collapsedCategoryIds[catId] = false;
					self._rerenderView();
				}
			}).catch(function () {});
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
			var self       = this;
			var newName    = input.value.trim();
			var oldName    = input.getAttribute('data-original') || '';
			var catId      = input.getAttribute('data-cat-id') || '';

			if (!newName || newName === oldName) {
				input.value = oldName;
				return;
			}

			if (!EFF.state.currentFile) {
				input.value = oldName;
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
					input.value = oldName;
				}
			}).catch(function () { input.value = oldName; });
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
					+ '<button class="eff-btn eff-btn--danger" id="eff-modal-del-ok">Delete</button>'
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
						}
					}).catch(function () {});
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

				var vars         = self._getVarsForCategoryId(catId);
				var savePromises = [];

				for (var j = 0; j < vars.length; j++) {
					var v = vars[j];
					var dupVar = {
						name:        v.name + '-copy',
						value:       v.value,
						type:        v.type || 'color',
						subgroup:    v.subgroup || 'Colors',
						category:    newCatName,
						category_id: newCatId,
						format:      v.format || 'HEX',
						status:      'new',
					};
					savePromises.push(EFF.App.ajax('eff_save_color', {
						filename: EFF.state.currentFile,
						variable: JSON.stringify(dupVar),
					}));
				}

				Promise.all(savePromises).then(function (results) {
					var lastResult = results[results.length - 1];
					if (lastResult && lastResult.success && lastResult.data && lastResult.data.data) {
						EFF.state.variables = lastResult.data.data.variables;
					}
					if (EFF.App) { EFF.App.setDirty(true); EFF.App.refreshCounts(); }
					self._rerenderView();
					if (EFF.PanelLeft && EFF.PanelLeft.refresh) {
						EFF.PanelLeft.refresh();
					}
				}).catch(function () {});

			}).catch(function () {});
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
		// TINT/SHADE GENERATOR
		// -----------------------------------------------------------------------

		/**
		 * Read generator controls and call eff_generate_children.
		 *
		 * @param {string}      varId Variable ID.
		 * @param {HTMLElement} panel The .eff-expand-panel element.
		 */
		_generateChildren: function (varId, panel) {
			var self  = this;
			var v     = self._findVarByKey(varId);
			var tints = panel.querySelector('.eff-gen-tints');
			var shades = panel.querySelector('.eff-gen-shades');
			var trans  = panel.querySelector('.eff-gen-trans');

			if (!EFF.state.currentFile) {
				self._noFileModal();
				return;
			}

			EFF.App.ajax('eff_generate_children', {
				filename:       EFF.state.currentFile,
				parent_id:      v ? v.id : varId,
				tints:          tints  ? tints.value  : '0',
				shades:         shades ? shades.value : '0',
				transparencies: trans  ? trans.value  : '0',
			}).then(function (res) {
				if (res.success && res.data) {
					if (res.data.data && res.data.data.variables) {
						EFF.state.variables = res.data.data.variables;
					}
					if (EFF.App) { EFF.App.setDirty(true); EFF.App.setPendingCommit(true); EFF.App.refreshCounts(); }
					self._rerenderView();
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

			// Preserve collapse state across re-renders; don't override with focus.
			_focusedCategoryId = null;
			this.loadColors(EFF.state.currentSelection);
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
				});
			}

			// Standard filter: match by category_id or category name.
			return allVars.filter(function (v) {
				return v.subgroup === 'Colors'
					&& (v.category_id === cat.id || v.category === cat.name)
					&& v.status !== 'deleted';
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
		// MODAL HELPERS
		// -----------------------------------------------------------------------

		/**
		 * Show a "no file loaded" info modal.
		 */
		_noFileModal: function () {
			EFF.Modal.open({
				title: 'No file loaded',
				body:  '<p>Please load or save a project file before managing colors and categories.</p>',
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

			function hex2(n) {
				var s = Math.round(n).toString(16);
				return s.length < 2 ? '0'+s : s;
			}

			switch (newFormat) {
				case 'HEX':
					return '#' + hex2(r) + hex2(g) + hex2(b);
				case 'HEXA':
					return '#' + hex2(r) + hex2(g) + hex2(b) + hex2(a * 255);
				case 'RGB':
					return 'rgb(' + r + ', ' + g + ', ' + b + ')';
				case 'RGBA':
					return 'rgba(' + r + ', ' + g + ', ' + b + ', ' + Math.round(a*100)/100 + ')';
				case 'HSL': {
					var hsl = self._rgbToHsl(r, g, b);
					return 'hsl(' + hsl.h + ', ' + hsl.s + '%, ' + hsl.l + '%)';
				}
				case 'HSLA': {
					var hsl2 = self._rgbToHsl(r, g, b);
					return 'hsla(' + hsl2.h + ', ' + hsl2.s + '%, ' + hsl2.l + '%, ' + Math.round(a*100)/100 + ')';
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
