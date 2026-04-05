/**
 * AFF Variables — Generic Variable Set Factory (Fonts & Numbers)
 *
 * A prototype-based factory that creates isolated instances for each
 * variable set (Fonts, Numbers). Each instance intercepts
 * AFF.EditSpace.loadCategory() for its own subgroup and renders a full
 * editing workspace: filter bar, category blocks, variable rows,
 * drag-and-drop, undo/redo, sort, search/filter, and collapse/expand.
 *
 * Architecture:
 *   AFF.Variables.initSet(cfg) — create and wire one set instance.
 *   AFF.Variables._proto       — shared prototype with all behaviour.
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
 * Differs from Colors (aff-colors.js):
 *   — No expand panel
 *   — Grid omits the preview column for Numbers (6 cols vs 7 for Fonts)
 *   — Category state stored in AFF.state.config[catKey] not config.categories
 *   — Category AJAX endpoints receive a subgroup param
 *   — Value cell rendering delegated to cfg.renderValueCell(v)
 *
 *
 * @package ElementorFrameworkForge
 * @version 1.0.0
 */

(function () {
	'use strict';

	window.AFF= window.AFF|| {};

	// -----------------------------------------------------------------------
	// FACTORY
	// -----------------------------------------------------------------------

	AFF.Variables = {

		/** Registry of live instances keyed by setName. */
		_sets: {},

		/**
		 * Create and wire one variable-set instance.
		 *
		 * Patches AFF.EditSpace.loadCategory to intercept calls for this
		 * subgroup, and binds the undo/redo keyboard handler.
		 *
		 * @param {Object} cfg Per-set configuration object (see file header).
		 */
		initSet: function (cfg) {
			var inst = Object.create(AFF.Variables._proto);
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
			};

			AFF.Variables._sets[cfg.setName] = inst;

			// Intercept AFF.EditSpace.loadCategory for this subgroup.
			var _prevLoad = AFF.EditSpace.loadCategory.bind(AFF.EditSpace);
			AFF.EditSpace.loadCategory = function (selection) {
				if (selection && selection.subgroup === cfg.setName) {
					inst.loadVars(selection);
				} else {
					_prevLoad(selection);
				}
			};

			// Keyboard undo/redo — active only when this set is current.
			document.addEventListener('keydown', function (e) {
				if (!e.ctrlKey && !e.metaKey) { return; }
				var sel = AFF.state.currentSelection;
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

	AFF.Variables._proto = {

		// -------------------------------------------------------------------
		// ENTRY POINT
		// -------------------------------------------------------------------

		/**
		 * Called by the overridden AFF.EditSpace.loadCategory.
		 *
		 * @param {{ group:string, subgroup:string, category:string, categoryId:string }} selection
		 */
		loadVars: function (selection) {
			var self        = this;
			var placeholder = document.getElementById('aff-placeholder');
			var content     = document.getElementById('aff-edit-content');
			var workspace   = document.getElementById('aff-workspace');
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
			var categories = self._getCatsForSet();

			// Determine initial collapse-toggle state for the ⊞/⊟ button.
			var _anyExpanded = false;
			for (var _ti = 0; _ti < categories.length; _ti++) {
				var _tc = categories[_ti];
				var _tvars = self._getVarsForCategory(_tc);
				var _tcCollapsed;
				if (self._collapsedIds.hasOwnProperty(_tc.id)) {
					_tcCollapsed = self._collapsedIds[_tc.id];
				} else if (self._focusedCatId) {
					_tcCollapsed = (_tc.id !== self._focusedCatId);
				} else {
					_tcCollapsed = (_tvars.length === 0);
				}
				if (!_tcCollapsed) { _anyExpanded = true; break; }
			}
			var _toggleState = _anyExpanded ? 'expanded' : 'collapsed';
			var _toggleSVG   = _anyExpanded ? self._collapseAllSVG() : self._expandAllSVG();
			var _toggleTitle = _anyExpanded ? 'Collapse all categories' : 'Expand all categories';

			var html = '<div class="aff-' + setLower + '-view">';

			// ---- Filter bar ----
			html += '<div class="aff-colors-filter-bar aff-' + setLower + '-filter-bar">'
				+ '<div class="aff-filter-bar-top">'
				+ '<span class="aff-filter-bar-set-name">' + self._esc(cfg.setName) + '</span>'
				+ '<span style="flex:1"></span>'
				+ '<input type="text" class="aff-colors-search aff-' + setLower + '-search"'
				+ ' id="aff-' + setLower + '-search"'
				+ ' placeholder="Search\u2026"'
				+ ' aria-label="Search ' + setLower + ' variables">'
				+ '<button class="aff-icon-btn aff-colors-back-btn"'
				+ ' id="aff-' + setLower + '-back"'
				+ ' data-aff-tooltip="Close ' + cfg.setName + ' view"'
				+ ' aria-label="Close ' + cfg.setName + ' view">'
				+ self._closeSVG()
				+ '</button>'
				+ '<button class="aff-icon-btn"'
				+ ' id="aff-' + setLower + '-collapse-toggle"'
				+ ' title="' + _toggleTitle + '" aria-label="' + _toggleTitle + '"'
				+ ' data-toggle-state="' + _toggleState + '"'
				+ ' data-aff-tooltip="' + _toggleTitle + '">'
				+ _toggleSVG
				+ '</button>'
				+ '</div>'
				+ '<div class="aff-filter-bar-add-cat-wrap">'
				+ '<button class="aff-icon-btn aff-' + setLower + '-add-cat-btn"'
				+ ' id="aff-' + setLower + '-add-category"'
				+ ' data-aff-tooltip="Add category"'
				+ ' aria-label="Add category">'
				+ self._plusCircleSVG()
				+ '</button>'
				+ '</div>'
				+ '</div>'; // filter bar

			// ---- Category blocks ----
			if (categories.length === 0) {
				html += '<p class="aff-colors-empty">No categories found. Click + to add one.</p>';
			} else {
				for (var i = 0; i < categories.length; i++) {
					html += self._buildCategoryBlock(categories[i], i, categories.length);
				}
			}

			html += '</div>'; // .aff-{set}-view

			container.innerHTML = html;
			self._bindEvents(container);

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
		_buildCategoryBlock: function (cat, catIndex, catTotal) {
			var self  = this;
			var vars  = self._getVarsForCategory(cat);
			var count = vars.length;

			var isCollapsed;
			if (self._collapsedIds.hasOwnProperty(cat.id)) {
				isCollapsed = self._collapsedIds[cat.id];
			} else if (self._focusedCatId) {
				isCollapsed = (cat.id !== self._focusedCatId);
			} else {
				isCollapsed = (count === 0);
			}

			var html = '<div class="aff-category-block"'
				+ ' data-category-id="' + self._esc(cat.id) + '"'
				+ ' data-collapsed="' + (isCollapsed ? 'true' : 'false') + '">'
				+ '<div class="aff-category-inner">';

			// Category header
			html += '<div class="aff-category-header">'
				+ '<div class="aff-cat-header-top">'
				+ '<div class="aff-cat-header-left">'
				+ '<span class="aff-cat-drag-handle" data-action="cat-drag-handle" aria-hidden="true"'
				+ ' data-aff-tooltip="Drag to reorder">'
				+ self._sixDotSVG()
				+ '</span>'
				+ '<span class="aff-category-name-input"'
				+ ' data-cat-id="' + self._esc(cat.id) + '"'
				+ ' data-original="' + self._esc(cat.name) + '"'
				+ ' aria-label="Category name"'
				+ ' contenteditable="false"'
				+ (cat.locked ? ' data-locked="true"' : '') + '>'
				+ self._esc(cat.name)
				+ '</span>'
				+ '<span class="aff-category-count">' + count + '</span>'
				+ '</div>' // .aff-cat-header-left
				+ '<div class="aff-category-actions" role="toolbar" aria-label="Category actions">'
				+ self._catBtn('duplicate', 'Duplicate category', self._duplicateSVG(), '')
				+ (cat.locked ? '' : self._catBtn('delete', 'Delete category', self._trashSVG(), 'aff-icon-btn--danger'))
				+ self._catBtn('collapse', 'Collapse/expand category', self._chevronSVG(), 'aff-category-collapse-btn')
				+ '</div>' // .aff-category-actions
				+ '</div>' // .aff-cat-header-top
				+ '</div>'; // .aff-category-header

			// Column sort header — same grid as variable rows.
			// Fonts has preview col (col3), Numbers does not; adjust empty spans accordingly.
			var _ns = (self._catSortState[cat.id] && self._catSortState[cat.id].field === 'name')  ? self._catSortState[cat.id].dir : 'none';
			var _vs = (self._catSortState[cat.id] && self._catSortState[cat.id].field === 'value') ? self._catSortState[cat.id].dir : 'none';
			html += '<div class="aff-color-list-header" data-cat-id="' + self._esc(cat.id) + '">'
				+ '<span></span>'  // col1: drag
				+ '<span></span>'; // col2: status dot
			if (self._cfg.renderPreviewCell) {
				// Fonts: preview is col3, name is col4
				html += '<span></span>'; // col3: preview
			}
			// Name sort (col4 for Fonts, col3 for Numbers)
			html += '<span class="aff-col-sort-wrap">'
				+ '<button class="aff-col-sort-btn" data-sort-col="name" data-cat-id="' + self._esc(cat.id) + '" data-sort-dir="' + _ns + '"'
				+ ' title="Sort by name" aria-label="Sort by name"'
				+ ' data-aff-tooltip="Sort by name">'
				+ self._sortBtnSVG(_ns)
				+ '</button>'
				+ '</span>';
			// Value sort (col5 for Fonts, col4 for Numbers)
			html += '<span class="aff-col-sort-wrap">'
				+ '<button class="aff-col-sort-btn" data-sort-col="value" data-cat-id="' + self._esc(cat.id) + '" data-sort-dir="' + _vs + '"'
				+ ' title="Sort by value" aria-label="Sort by value"'
				+ ' data-aff-tooltip="Sort by value">'
				+ self._sortBtnSVG(_vs)
				+ '</button>'
				+ '</span>'
				+ '</div>'; // .aff-color-list-header

			// Variable rows
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

			// Add-variable button: circle on bottom-left edge of category block.
			var addLabel = 'Add variable to ' + cat.name;
			html += '<div class="aff-cat-add-btn-wrap">'
				+ '<button class="aff-icon-btn aff-add-var-btn" data-action="add-var"'
				+ ' data-cat-id="' + self._esc(cat.id) + '"'
				+ ' aria-label="' + self._esc(addLabel) + '"'
				+ ' data-aff-tooltip="Add ' + self._esc(self._cfg.setName) + '"'
				+ ' data-aff-tooltip-long="Add a new ' + self._esc(self._cfg.setName.toLowerCase())
				+ ' variable to this category">'
				+ self._plusSVG()
				+ '</button>'
				+ '</div>';

			html += '</div>'; // .aff-category-block
			return html;
		},

		/**
		 * Build a single variable row.
		 *
		 * Grid layout:
		 *   Fonts:   drag | dot | preview | name | value | format | delete (7 cols)
		 *   Numbers: drag | dot | name | value | format | delete (6 cols)
		 *
		 * @param {Object} v Variable object.
		 * @returns {string}
		 */
		_buildVariableRow: function (v) {
			var self   = this;
			var cfg    = self._cfg;
			var status = v.status || 'synced';
			var rowKey = self._rowKey(v);

			var html = '<div class="aff-color-row" data-var-id="' + self._esc(rowKey) + '">'

				// Col 1: drag handle (24px)
				+ '<div class="aff-drag-handle" data-action="drag-handle" draggable="false"'
				+ ' aria-label="Drag to reorder" data-aff-tooltip="Drag to reorder">'
				+ self._sixDotSVG()
				+ '</div>'

				// Col 2: status dot (8px circle)
				+ '<span class="aff-status-dot"'
				+ ' style="background:' + self._statusColor(status) + '"'
				+ ' data-aff-tooltip="' + self._esc(status.charAt(0).toUpperCase() + status.slice(1)) + '"'
				+ ' data-aff-tooltip-long="' + self._esc(self._statusLongTooltip(status)) + '"'
				+ ' aria-label="Status: ' + self._esc(status) + '">'
				+ '</span>';

			// Col 3 (optional): preview cell — Fonts only.
			if (cfg.renderPreviewCell) {
				html += cfg.renderPreviewCell.call(cfg, v);
			}

			// Name input (read-only by default; single-click activates).
			html += '<input type="text" class="aff-var-name-input"'
				+ ' value="' + self._esc(v.name) + '"'
				+ ' data-original="' + self._esc(v.name) + '"'
				+ ' readonly'
				+ ' aria-label="Variable name"'
				+ ' data-aff-tooltip="Variable name \u2014 click to edit"'
				+ ' spellcheck="false">';

			// Value input + format selector — delegated to per-set config.
			html += cfg.renderValueCell.call(cfg, v);

			// Delete button (last column, 28px, hidden until row hover).
			html += '<button class="aff-icon-btn aff-var-delete-btn" data-action="delete-var"'
				+ ' data-var-id="' + self._esc(rowKey) + '"'
				+ ' aria-label="Delete variable"'
				+ ' data-aff-tooltip="Delete variable"'
				+ ' data-aff-tooltip-long="Remove this variable from the project">&#x1F5D1;</button>';

			html += '</div>'; // .aff-color-row
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
			var backBtn = container.querySelector('#aff-' + setLower + '-back');
			if (backBtn) {
				backBtn.addEventListener('click', function () {
					self._closeView();
				});
			}

			// Collapse / expand all
			var toggleBtn = container.querySelector('#aff-' + setLower + '-collapse-toggle');
			if (toggleBtn) {
				toggleBtn.addEventListener('click', function () {
					var state    = toggleBtn.getAttribute('data-toggle-state');
					var collapse = (state !== 'collapsed');
					self._setAllCollapsed(container, collapse);
				});
			}

			// Add category
			var addCatBtn = container.querySelector('#aff-' + setLower + '-add-category');
			if (addCatBtn) {
				addCatBtn.addEventListener('click', function () {
					self._addCategory();
				});
			}

			// Search / filter
			var searchInput = container.querySelector('#aff-' + setLower + '-search');
			if (searchInput) {
				searchInput.addEventListener('input', function () {
					self._filterRows(container, searchInput.value.trim().toLowerCase());
				});
			}

			// ---- Delegated events — bound only once per container ----
			if (container._effVarsEventsBound) { return; }
			container._effVarsEventsBound = true;

			self._initDrag(container);
			self._initCatDrag(container);

			// ---- Click delegation ----
			container.addEventListener('click', function (e) {
				var btn    = e.target.closest('[data-action]');
				if (!btn) { return; }
				var action = btn.getAttribute('data-action');
				var block  = btn.closest('.aff-category-block');
				var catId  = block ? block.getAttribute('data-category-id') : null;

				switch (action) {
					case 'duplicate': if (catId) { self._duplicateCategory(catId); } break;
					case 'move-up':   if (catId) { self._moveCategoryUp(catId); }   break;
					case 'move-down': if (catId) { self._moveCategoryDown(catId); } break;
					case 'add-var':   if (catId) { self._addVariable(catId); }      break;
					case 'delete':    if (catId) { self._deleteCategory(catId); }   break;

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
						}
						break;
				}
			});

			// ---- Column sort buttons (in .aff-color-list-header) ----
			container.addEventListener('click', function (e) {
				var sortBtn = e.target.closest('.aff-col-sort-btn');
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
				var input = e.target.closest('.aff-var-name-input, .aff-category-name-input');
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

			// ---- Restore readonly / contenteditable on focusout ----
			container.addEventListener('focusout', function (e) {
				var nameInput = e.target.closest('.aff-var-name-input');
				if (nameInput) { nameInput.setAttribute('readonly', ''); return; }

				var catInput = e.target.closest('.aff-category-name-input');
				if (catInput && catInput.getAttribute('data-locked') !== 'true') {
					self._saveCategoryName(catInput);
					catInput.setAttribute('contenteditable', 'false');
				}
			});

			// ---- Category name: Enter / Escape ----
			container.addEventListener('keydown', function (e) {
				var catInput = e.target.closest('.aff-category-name-input');
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

			// ---- Variable name: live '--' prefix guard ----
			container.addEventListener('input', function (e) {
				var nameInput = e.target.closest('.aff-var-name-input');
				if (!nameInput) { return; }
				var val = nameInput.value;
				if (val.slice(0, 2) !== '--') {
					nameInput.value = '--' + val.replace(/^-*/, '');
				}
			});

			// ---- Variable name: save on change / Enter ----
			container.addEventListener('change', function (e) {
				var nameInput = e.target.closest('.aff-var-name-input');
				if (!nameInput) { return; }
				var row   = nameInput.closest('.aff-color-row');
				var varId = row ? row.getAttribute('data-var-id') : null;
				if (varId !== null) { self._saveVarName(varId, nameInput); }
			});
			container.addEventListener('keydown', function (e) {
				if (e.key !== 'Enter') { return; }
				var nameInput = e.target.closest('.aff-var-name-input');
				if (!nameInput) { return; }
				nameInput.blur();
			});

			// ---- Value input: live preview for Fonts ----
			container.addEventListener('input', function (e) {
				var valInput = e.target.closest('.aff-var-value-input');
				if (!valInput) { return; }
				if (self._cfg.setName === 'Fonts') {
					valInput.style.fontFamily = valInput.value;
					var row     = valInput.closest('.aff-color-row');
					var preview = row ? row.querySelector('.aff-font-preview') : null;
					if (preview) { preview.style.fontFamily = valInput.value; }
				}
			});

			// ---- Value input: save on change / Enter ----
			container.addEventListener('change', function (e) {
				var valInput = e.target.closest('.aff-var-value-input');
				if (!valInput) { return; }
				var row   = valInput.closest('.aff-color-row');
				var varId = row ? row.getAttribute('data-var-id') : null;
				if (varId === null) { return; }
				var newVal = valInput.value.trim();
				if (!newVal) {
					valInput.value = valInput.getAttribute('data-original') || '';
					self._showFieldError(valInput, 'Value must not be empty.');
					return;
				}
				self._clearFieldError(valInput);
				self._saveVarValue(varId, newVal, valInput);
			});
			container.addEventListener('keydown', function (e) {
				if (e.key !== 'Enter') { return; }
				var valInput = e.target.closest('.aff-var-value-input');
				if (!valInput) { return; }
				valInput.blur();
			});

			// ---- Format selector: save on change ----
			container.addEventListener('change', function (e) {
				var fmtSel = e.target.closest('.aff-var-format-sel');
				if (!fmtSel) { return; }
				var row   = fmtSel.closest('.aff-color-row');
				var varId = row ? row.getAttribute('data-var-id') : null;
				if (varId !== null) { self._saveVarFormat(varId, fmtSel.value); }
			});
		},

		// -------------------------------------------------------------------
		// SEARCH / FILTER
		// -------------------------------------------------------------------

		/**
		 * Show/hide rows based on a text search query.
		 * Category blocks with no visible rows are also hidden.
		 *
		 * @param {HTMLElement} container
		 * @param {string}      query Lowercased search string.
		 */
		_filterRows: function (container, query) {
			var self   = this;
			var blocks = container.querySelectorAll('.aff-category-block');
			for (var bi = 0; bi < blocks.length; bi++) {
				var block      = blocks[bi];
				var rows       = block.querySelectorAll('.aff-color-row');
				var anyVisible = false;
				for (var ri = 0; ri < rows.length; ri++) {
					var row   = rows[ri];
					var varId = row.getAttribute('data-var-id');
					var v     = varId ? self._findVarByKey(varId) : null;
					var match = !query;
					if (!match && v) {
						match = (v.name  || '').toLowerCase().indexOf(query) !== -1
							 || (v.value || '').toLowerCase().indexOf(query) !== -1;
					}
					row.style.display = match ? '' : 'none';
					if (match) { anyVisible = true; }
				}
				block.style.display = anyVisible ? '' : 'none';
			}
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
			var blocks = container.querySelectorAll('.aff-category-block');
			for (var i = 0; i < blocks.length; i++) {
				var block = blocks[i];
				var catId = block.getAttribute('data-category-id');
				block.setAttribute('data-collapsed', String(collapse));
				if (catId) { self._collapsedIds[catId] = collapse; }
			}
			var toggleBtn = container.querySelector('[data-toggle-state]');
			if (toggleBtn) {
				toggleBtn.setAttribute('data-toggle-state', collapse ? 'collapsed' : 'expanded');
				toggleBtn.innerHTML = collapse ? self._expandAllSVG() : self._collapseAllSVG();
			}
		},

		/**
		 * Scroll to and expand a specific category block.
		 *
		 * @param {string}      catId
		 * @param {HTMLElement} container
		 */
		_jumpToCategory: function (catId, container) {
			var block = container.querySelector('.aff-category-block[data-category-id="' + catId + '"]');
			if (!block) { return; }
			block.setAttribute('data-collapsed', 'false');
			this._collapsedIds[catId] = false;
			block.scrollIntoView({ behavior: 'smooth', block: 'start' });
		},

		// -------------------------------------------------------------------
		// CLOSE VIEW
		// -------------------------------------------------------------------

		/** Close this set's view and restore the placeholder state. */
		_closeView: function () {
			if (AFF.PanelLeft && AFF.PanelLeft.clearSelection) {
				AFF.PanelLeft.clearSelection();
			}
			var content     = document.getElementById('aff-edit-content');
			var placeholder = document.getElementById('aff-placeholder');
			var workspace   = document.getElementById('aff-workspace');
			if (content) {
				content.setAttribute('hidden', '');
				content.style.display = '';
				content.innerHTML = '';
			}
			if (placeholder) { placeholder.style.display = ''; }
			if (workspace)   { workspace.removeAttribute('data-active'); }
			AFF.state.currentSelection = null;
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
					if (AFF.App) { AFF.App.setDirty(true); }
					self._rerenderView();
				});
			} else if (op.type === 'value-change') {
				v.value = value;
				self._ajaxSaveVar({ id: v.id, value: value }, function () {
					if (AFF.App) { AFF.App.setDirty(true); }
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

			if (!/^--[\w-]+$/.test(newName)) {
				nameInput.value = oldName;
				self._showFieldError(nameInput,
					'Name must start with -- and contain only letters, numbers, dashes, and underscores.');
				return;
			}

			var v = self._findVarByKey(varId);
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
				if (AFF.App) { AFF.App.setDirty(true); AFF.App.setPendingCommit(true); }
			});
		},

		/**
		 * Persist a value change.
		 *
		 * @param {string}          varId
		 * @param {string}          newValue
		 * @param {HTMLElement|null} input
		 */
		_saveVarValue: function (varId, newValue, input) {
			var self     = this;
			var v        = self._findVarByKey(varId);
			if (!v) { return; }
			var oldValue = v.value || '';
			if (newValue === oldValue) { return; }

			v.value  = newValue;
			v.status = 'modified';
			self._updateStatusDotInDOM(varId, 'modified');

			// For Fonts: update the preview cell and value input's inline style.
			if (self._cfg.setName === 'Fonts') {
				var content = document.getElementById('aff-edit-content');
				if (content) {
					var listRow = content.querySelector('.aff-color-row[data-var-id="' + self._esc(varId) + '"]');
					if (listRow) {
						var preview = listRow.querySelector('.aff-font-preview');
						if (preview) { preview.style.fontFamily = newValue; }
						var valInp  = listRow.querySelector('.aff-var-value-input');
						if (valInp)  { valInp.style.fontFamily  = newValue; }
					}
				}
			}

			self._pushUndo({ type: 'value-change', id: v.id, oldValue: oldValue, newValue: newValue });

			self._ajaxSaveVar({ id: v.id, value: newValue, status: 'modified' }, function () {
				if (input) { input.setAttribute('data-original', newValue); }
				if (AFF.App) { AFF.App.setDirty(true); AFF.App.setPendingCommit(true); }
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
			var v    = self._findVarByKey(varId);
			if (!v) { return; }
			v.format = newFormat;
			v.status = 'modified';
			self._ajaxSaveVar({ id: v.id, format: newFormat, status: 'modified' }, function () {
				if (AFF.App) { AFF.App.setDirty(true); AFF.App.setPendingCommit(true); }
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

			if (!AFF.state.currentFile) {
				self._noFileModal();
				return;
			}

			var defaults = cfg.newVarDefaults || {};
			// Derive type from setName: 'Fonts' → 'font', 'Numbers' → 'number'
			var varType  = cfg.setName.toLowerCase().replace(/s$/, '');

			var newVar = {
				name:        defaults.name   || '--new-var',
				value:       defaults.value  || '',
				type:        varType,
				subgroup:    cfg.setName,
				category:    cat ? cat.name : '',
				category_id: catId,
				format:      (AFF.state.settings && AFF.state.settings[cfg.setName.toLowerCase() + '_default_type']) || defaults.format || '',
				status:      'new',
			};

			AFF.App.ajax('aff_save_color', {
				filename: AFF.state.currentFile,
				variable: JSON.stringify(newVar),
			}).then(function (res) {
				if (res.success && res.data && res.data.data) {
					AFF.state.variables = res.data.data.variables || AFF.state.variables;
					if (AFF.App) {
						AFF.App.setDirty(true);
						AFF.App.setPendingCommit(true);
						AFF.App.refreshCounts();
					}
					self._collapsedIds[catId] = false;
					self._rerenderView();
				} else if (!res.success) {
					var msg = (res.data && res.data.message) ? res.data.message : 'Could not add variable.';
					AFF.Modal.open({ title: 'Error', body: '<p>' + msg + '</p>' });
				}
			}).catch(function () {
				AFF.Modal.open({ title: 'Connection error', body: '<p>Could not add variable. Please try again.</p>' });
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
			var variable = null;
			for (var i = 0; i < AFF.state.variables.length; i++) {
				if (AFF.state.variables[i].id === varId) { variable = AFF.state.variables[i]; break; }
			}
			if (!variable) { return; }

			AFF.Modal.open({
				title: 'Delete variable',
				body:  '<p>Delete <strong>' + self._esc(variable.name || varId) + '</strong>?</p>'
					+ '<p>This cannot be undone.</p>',
				footer: '<div style="display:flex;justify-content:flex-end;gap:8px">'
					+ '<button class="aff-btn aff-btn--secondary" id="aff-del-var-cancel">Cancel</button>'
					+ '<button class="aff-btn aff-btn--danger" id="aff-del-var-confirm">Delete</button>'
					+ '</div>',
			});

			function handleClick(e) {
				if (e.target.id === 'aff-del-var-cancel') {
					AFF.Modal.close();
					document.removeEventListener('click', handleClick);
				} else if (e.target.id === 'aff-del-var-confirm') {
					AFF.Modal.close();
					document.removeEventListener('click', handleClick);
					AFF.App.ajax('aff_delete_color', {
						filename:    AFF.state.currentFile,
						variable_id: varId,
					}).then(function (res) {
						if (res.success && res.data && res.data.data) {
							AFF.state.variables = res.data.data.variables;
							if (AFF.App) { AFF.App.setDirty(true); AFF.App.refreshCounts(); }
							self._rerenderView();
						}
					}).catch(function () {
						AFF.Modal.open({ title: 'Connection error', body: '<p>Delete failed. Please try again.</p>' });
					});
				}
			}
			document.addEventListener('click', handleClick);
		},

		// -------------------------------------------------------------------
		// CATEGORY OPERATIONS
		// -------------------------------------------------------------------

		/** Open the add-category modal. */
		_addCategory: function () {
			var self = this;
			if (!AFF.state.currentFile) { self._noFileModal(); return; }

			AFF.Modal.open({
				title: 'New Category',
				body:  '<p style="margin-bottom:10px">Enter a name for the new category.</p>'
					+ '<input type="text" class="aff-field-input" id="aff-modal-cat-name"'
					+ ' placeholder="e.g., Heading fonts" autocomplete="off" style="width:100%">',
				footer: '<div style="display:flex;justify-content:flex-end;gap:8px">'
					+ '<button class="aff-btn aff-btn--secondary" id="aff-modal-cat-cancel">Cancel</button>'
					+ '<button class="aff-btn" id="aff-modal-cat-ok">Add Category</button>'
					+ '</div>',
			});
			setTimeout(function () {
				var inp = document.getElementById('aff-modal-cat-name');
				if (inp) { inp.focus(); }
			}, 50);

			function handleClick(e) {
				if (e.target.id === 'aff-modal-cat-cancel') {
					AFF.Modal.close();
					document.removeEventListener('click', handleClick);
				} else if (e.target.id === 'aff-modal-cat-ok') {
					var inp  = document.getElementById('aff-modal-cat-name');
					var name = inp ? inp.value.trim() : '';
					AFF.Modal.close();
					document.removeEventListener('click', handleClick);
					if (!name) { return; }

					AFF.App.ajax('aff_save_category', {
						filename: AFF.state.currentFile,
						subgroup: self._cfg.setName,
						category: JSON.stringify({ name: name }),
					}).then(function (res) {
						if (res.success && res.data) {
							if (!AFF.state.config) { AFF.state.config = {}; }
							// Merge: append new category to local state instead of
							// replacing — preserves globalConfig-sourced categories
							// that aren't written to the file yet.
							var _newCat = null;
							var _serverCats = res.data.categories || [];
							for (var _ki = 0; _ki < _serverCats.length; _ki++) {
								if (_serverCats[_ki].id === res.data.id) { _newCat = _serverCats[_ki]; break; }
							}
							if (_newCat) {
								if (!Array.isArray(AFF.state.config[self._cfg.catKey])) { AFF.state.config[self._cfg.catKey] = []; }
								AFF.state.config[self._cfg.catKey].push(_newCat);
							} else {
								AFF.state.config[self._cfg.catKey] = _serverCats;
							}
							if (AFF.App) { AFF.App.setDirty(true); }
							self._rerenderView();
							if (AFF.PanelLeft && AFF.PanelLeft.refresh) { AFF.PanelLeft.refresh(); }
						}
					}).catch(function () {});
				}
			}
			document.addEventListener('click', handleClick);
		},

		/**
		 * Save the category name from the contenteditable span.
		 *
		 * @param {HTMLElement} input The .aff-category-name-input element.
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
			if (!AFF.state.currentFile) {
				input.textContent = oldName;
				self._noFileModal();
				return;
			}

			AFF.App.ajax('aff_save_category', {
				filename: AFF.state.currentFile,
				subgroup: self._cfg.setName,
				category: JSON.stringify({ id: catId, name: newName }),
			}).then(function (res) {
				if (res.success && res.data) {
					if (!AFF.state.config) { AFF.state.config = {}; }
					// Merge: update the renamed category in local state by ID.
					var _localCats = AFF.state.config[self._cfg.catKey];
					if (Array.isArray(_localCats)) {
						for (var _ri = 0; _ri < _localCats.length; _ri++) {
							if (_localCats[_ri].id === catId) { _localCats[_ri].name = newName; break; }
						}
					} else {
						AFF.state.config[self._cfg.catKey] = res.data.categories || [];
					}
					input.setAttribute('data-original', newName);
					if (AFF.App) { AFF.App.setDirty(true); }
					self._rerenderView();
					if (AFF.PanelLeft && AFF.PanelLeft.refresh) { AFF.PanelLeft.refresh(); }
				} else {
					input.textContent = oldName;
				}
			}).catch(function () { input.textContent = oldName; });
		},

		/**
		 * Delete a category (with confirmation modal).
		 *
		 * @param {string} catId Category ID.
		 */
		_deleteCategory: function (catId) {
			var self = this;
			var vars = self._getVarsForCategoryId(catId);
			if (!AFF.state.currentFile) { self._noFileModal(); return; }

			var bodyText = vars.length > 0
				? '<p>' + vars.length + ' variable(s) are in this category. Variables will be moved to Uncategorized.</p>'
				  + '<p style="margin-top:8px">Delete the category anyway?</p>'
				: '<p>Delete this category?</p>';

			AFF.Modal.open({
				title:  'Delete Category',
				body:   bodyText,
				footer: '<div style="display:flex;justify-content:flex-end;gap:8px">'
					+ '<button class="aff-btn aff-btn--secondary" id="aff-modal-del-cancel">Cancel</button>'
					+ '<button class="aff-btn aff-btn--danger" id="aff-modal-del-ok">Delete Category</button>'
					+ '</div>',
			});

			function handleClick(e) {
				if (e.target.id === 'aff-modal-del-cancel') {
					AFF.Modal.close();
					document.removeEventListener('click', handleClick);
				} else if (e.target.id === 'aff-modal-del-ok') {
					AFF.Modal.close();
					document.removeEventListener('click', handleClick);
					var _preDelCats = (AFF.state.config && Array.isArray(AFF.state.config[self._cfg.catKey])) ? AFF.state.config[self._cfg.catKey].slice() : null;
				AFF.App.ajax('aff_delete_category', {
						filename:    AFF.state.currentFile,
						subgroup:    self._cfg.setName,
						category_id: catId,
					}).then(function (res) {
						if (res.success && res.data) {
							if (!AFF.state.config) { AFF.state.config = {}; }
							AFF.state.config[self._cfg.catKey] = res.data.categories;
							// Merge: use pre-captured local list, filtered by deleted ID.
						if (_preDelCats !== null) {
							AFF.state.config[self._cfg.catKey] = _preDelCats.filter(function (c) { return c.id !== catId; });
						}
						delete self._collapsedIds[catId];
							if (AFF.App) { AFF.App.setDirty(true); }
							self._rerenderView();
							if (AFF.PanelLeft && AFF.PanelLeft.refresh) { AFF.PanelLeft.refresh(); }
						}
					}).catch(function () {});
				}
			}
			document.addEventListener('click', handleClick);
		},

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
		 * Duplicate a category and all its variables.
		 *
		 * @param {string} catId Source category ID.
		 */
		_duplicateCategory: function (catId) {
			var self = this;
			if (!AFF.state.currentFile) { self._noFileModal(); return; }

			var cats = self._getCatsForSet();
			var cat  = null;
			for (var i = 0; i < cats.length; i++) {
				if (cats[i].id === catId) { cat = cats[i]; break; }
			}
			if (!cat) { return; }

			AFF.App.ajax('aff_save_category', {
				filename: AFF.state.currentFile,
				subgroup: self._cfg.setName,
				category: JSON.stringify({ name: cat.name + ' (copy)' }),
			}).then(function (res) {
				if (!res.success || !res.data) { return; }
				if (!AFF.state.config) { AFF.state.config = {}; }
				// Merge: append new duplicate category to local state by ID.
				var _dupCat = null;
				var _dupServerCats = res.data.categories || [];
				for (var _di = 0; _di < _dupServerCats.length; _di++) {
					if (_dupServerCats[_di].id === res.data.id) { _dupCat = _dupServerCats[_di]; break; }
				}
				if (_dupCat) {
					if (!Array.isArray(AFF.state.config[self._cfg.catKey])) { AFF.state.config[self._cfg.catKey] = []; }
					AFF.state.config[self._cfg.catKey].push(_dupCat);
				} else {
					AFF.state.config[self._cfg.catKey] = _dupServerCats;
				}
				var newCatId = res.data.id;
				var vars     = self._getVarsForCategory(cat);
				var chain    = Promise.resolve();
				vars.forEach(function (v) {
					var dupVar = {
						name:        v.name + '-copy',
						value:       v.value,
						subgroup:    self._cfg.setName,
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
					if (AFF.App) { AFF.App.setDirty(true); AFF.App.refreshCounts(); }
					self._rerenderView();
					if (AFF.PanelLeft && AFF.PanelLeft.refresh) { AFF.PanelLeft.refresh(); }
				}).catch(function () {});
			}).catch(function () {});
		},

		/**
		 * Apply a category reorder locally and persist via AJAX if a file is loaded.
		 *
		 * @param {string[]} orderedIds Category IDs in desired order.
		 */
		_ajaxReorderCategories: function (orderedIds) {
			var self   = this;
			var catKey = self._cfg.catKey;

			// Apply locally so the re-render shows the new order instantly.
			if (AFF.state.config && AFF.state.config[catKey]) {
				var cats = AFF.state.config[catKey];
				for (var i = 0; i < orderedIds.length; i++) {
					for (var j = 0; j < cats.length; j++) {
						if (cats[j].id === orderedIds[i]) { cats[j].order = i; break; }
					}
				}
			}
			self._rerenderView();

			if (!AFF.state.currentFile) { return; }
			if (AFF.App) { AFF.App.setDirty(true); }

			AFF.App.ajax('aff_reorder_categories', {
				filename:    AFF.state.currentFile,
				subgroup:    self._cfg.setName,
				ordered_ids: JSON.stringify(orderedIds),
			}).then(function (res) {
				if (res.success) {
					// Order already applied locally; no state overwrite needed.
					self._rerenderView();
				}
			}).catch(function () {});
		},

		/**
		 * Ensure Uncategorized always exists in this set's category list.
		 * Called on every loadVars() before render.
		 */
		_ensureUncategorized: function () {
			var catKey = this._cfg.catKey;
			if (!AFF.state.config) { AFF.state.config = {}; }
			if (!Array.isArray(AFF.state.config[catKey])) {
				AFF.state.config[catKey] = [];
			}
			var cats     = AFF.state.config[catKey];
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

		/**
		 * Sort all variables in this set alphabetically by name.
		 *
		 * @param {boolean} ascending True = A→Z, false = Z→A.
		 */
		_sortVars: function (ascending) {
			var self    = this;
			var setVars = self._getVarsForSet();
			var sorted  = setVars.slice().sort(function (a, b) {
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
							variable: JSON.stringify({ id: variable.id, order: variable.order }),
						}).then(function (r) {
							if (r.success && r.data && r.data.data) {
								AFF.state.variables = r.data.data.variables;
							}
						});
					});
				}(v));
			});
			chain.then(function () {
				if (AFF.App) { AFF.App.setDirty(true); }
				self._rerenderView();
			}).catch(function () {});
		},

		/**
		 * Sort non-locked categories alphabetically (locked always last).
		 *
		 * @param {boolean} ascending True = A→Z, false = Z→A.
		 */
		_sortCategories: function (ascending) {
			var self   = this;
			var catKey = self._cfg.catKey;
			if (!AFF.state.config || !Array.isArray(AFF.state.config[catKey])) { return; }

			var locked   = AFF.state.config[catKey].filter(function (c) { return c.locked; });
			var unlocked = AFF.state.config[catKey].filter(function (c) { return !c.locked; });
			unlocked.sort(function (a, b) {
				var na = (a.name || '').toLowerCase();
				var nb = (b.name || '').toLowerCase();
				return ascending ? (na < nb ? -1 : na > nb ? 1 : 0)
				                 : (na > nb ? -1 : na < nb ? 1 : 0);
			});
			var combined = unlocked.concat(locked);
			combined.forEach(function (c, i) { c.order = i + 1; });
			AFF.state.config[catKey] = combined;

			AFF.App.ajax('aff_reorder_categories', {
				filename:    AFF.state.currentFile,
				subgroup:    self._cfg.setName,
				ordered_ids: JSON.stringify(combined.map(function (c) { return c.id; })),
			}).then(function (r) {
				if (r.success && r.data && r.data.categories) {
					AFF.state.config[catKey] = r.data.categories;
				}
				if (AFF.App) { AFF.App.setDirty(true); }
				self._rerenderView();
				if (AFF.PanelLeft && AFF.PanelLeft.refresh) { AFF.PanelLeft.refresh(); }
			}).catch(function () {});
		},

		// -------------------------------------------------------------------
		// AJAX HELPERS
		// -------------------------------------------------------------------

		/**
		 * Send eff_save_color AJAX and update AFF.state.variables on success.
		 * Increments/decrements pendingSaveCount so the Save button shows correct state.
		 *
		 * @param {Object}   variableData Partial variable with at least { id }.
		 * @param {Function} onSuccess    Called on AJAX success.
		 */
		_ajaxSaveVar: function (variableData, onSuccess) {
			if (!AFF.state.currentFile) { return; }
			AFF.state.pendingSaveCount = (AFF.state.pendingSaveCount || 0) + 1;

			AFF.App.ajax('aff_save_color', {
				filename: AFF.state.currentFile,
				variable: JSON.stringify(variableData),
			}).then(function (res) {
				if (res.success && res.data && res.data.data && res.data.data.variables) {
					AFF.state.variables = res.data.data.variables;
				}
				if (onSuccess) { onSuccess(res.data); }
				if (AFF.App) { AFF.App.flushPending(); }
			}).catch(function () {
				if (AFF.App) { AFF.App.flushPending(); }
			});
		},

		// -------------------------------------------------------------------
		// RE-RENDER
		// -------------------------------------------------------------------

		/** Re-render the current view using the existing currentSelection. */
		_rerenderView: function () {
			var content = document.getElementById('aff-edit-content');
			if (content) {
				this._renderAll(AFF.state.currentSelection || {}, content);
			}
		},

		/**
		 * Return a small sort-direction SVG icon.
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
			return '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="12" viewBox="0 0 10 12" aria-hidden="true">'
				+ '<polygon points="5,1 9,5 1,5" fill="currentColor" opacity="0.6"/>'
				+ '<polygon points="5,11 1,7 9,7" fill="currentColor" opacity="0.6"/>'
				+ '</svg>';
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
			var cats   = (AFF.state.config && Array.isArray(AFF.state.config[catKey]))
				? AFF.state.config[catKey] : [];
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

			var sortBtns = block.querySelectorAll('.aff-col-sort-btn');
			for (var k = 0; k < sortBtns.length; k++) {
				var btn    = sortBtns[k];
				var btnCol = btn.getAttribute('data-sort-col');
				var btnDir = (btnCol === field) ? dir : 'none';
				btn.setAttribute('data-sort-dir', btnDir);
				btn.innerHTML = self._sortBtnSVG(btnDir);
			}
		},

		// -------------------------------------------------------------------
		// DRAG AND DROP
		// -------------------------------------------------------------------

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
			AFF.state.config[catKey] = cats;

			AFF.App.ajax('aff_reorder_categories', {
				subgroup:    self._cfg.setName,
				ordered_ids: JSON.stringify(ordered_ids),
			}).then(function (res) {
				if (res.success) {
					// Order already applied locally; no state overwrite needed.
				}
				if (AFF.App) { AFF.App.setDirty(true); }
				if (AFF.PanelLeft) { AFF.PanelLeft.refresh(); }
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
			var self = this;
			var d    = self._drag;

			container.addEventListener('mousedown', function (e) {
				var handle = e.target.closest('.aff-drag-handle');
				if (!handle) { return; }
				e.preventDefault();

				var row = handle.closest('.aff-color-row');
				if (!row) { return; }

				d.varId = row.getAttribute('data-var-id');
				if (!d.varId) { return; }

				d.active = true;
				d.startY = e.clientY;

				// Ghost: a fixed-position clone of the dragged row.
				var ghost = row.cloneNode(true);
				var rowRect = row.getBoundingClientRect();
				ghost.style.cssText = 'position:fixed;pointer-events:none;z-index:9999;'
					+ 'width:' + row.offsetWidth + 'px;height:' + row.offsetHeight + 'px;'
					+ 'top:' + rowRect.top + 'px;left:' + rowRect.left + 'px;'
					+ 'opacity:0.88;box-shadow:0 8px 24px rgba(0,0,0,0.28);border-radius:4px;';
				ghost.className += ' aff-drag-ghost';
				document.body.appendChild(ghost);
				d.ghost = ghost;

				// Drop indicator: accent-colour horizontal bar.
				var indicator          = document.createElement('div');
				indicator.className   = 'aff-drop-indicator';
				indicator.style.display      = 'none';
				indicator.style.pointerEvents = 'none';
				var _appEl  = document.getElementById('aff-app');
				var _accent = _appEl ? getComputedStyle(_appEl).getPropertyValue('--aff-clr-accent').trim() : '';
				if (!_accent) { _accent = '#f4c542'; }
				indicator.style.background = 'linear-gradient(to right, transparent, '
					+ _accent + ' 15%, ' + _accent + ' 85%, transparent)';
				document.body.appendChild(indicator);
				d.indicator = indicator;

				row.classList.add('aff-row-dragging');
			});

			document.addEventListener('mousemove', function (e) {
				if (!d.active || !d.ghost) { return; }
				var dy = e.clientY - d.startY;
				d.ghost.style.transform = 'translateY(' + dy + 'px)';

				// Temporarily hide ghost so elementFromPoint sees the row underneath.
				d.ghost.style.display = 'none';
				var elBelow = document.elementFromPoint(e.clientX, e.clientY);
				d.ghost.style.display = '';

				var targetRow = elBelow ? elBelow.closest('.aff-color-row') : null;
				if (targetRow && targetRow.getAttribute('data-var-id') !== d.varId) {
					var trRect  = targetRow.getBoundingClientRect();
					var above   = e.clientY < trRect.top + trRect.height / 2;
					d.indicator.style.display = '';
					d.indicator.style.left    = trRect.left + 'px';
					d.indicator.style.width   = trRect.width + 'px';
					d.indicator.style.top     = (above ? trRect.top : trRect.bottom) - 2 + 'px';
					d.indicator.style.height  = '4px';
					d._dropTargetId = targetRow.getAttribute('data-var-id');
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

				var draggingRow = container.querySelector('.aff-color-row.aff-row-dragging');
				if (draggingRow) { draggingRow.classList.remove('aff-row-dragging'); }

				if (d._dropTargetId && d.varId && d._dropTargetId !== d.varId) {
					self._onDropVar(d.varId, d._dropTargetId, d._dropAbove, container);
				}
				d._dropTargetId = null;
				d._dropAbove    = null;
				d.varId         = null;
			});
		},

		/**
		 * Handle a completed drop: reorder variables and update category if needed.
		 *
		 * @param {string}      srcId    Dragged variable ID.
		 * @param {string}      targetId Drop-target variable ID.
		 * @param {boolean}     above    True = insert before target.
		 * @param {HTMLElement} container
		 */
		_onDropVar: function (srcId, targetId, above, container) {
			var self    = this;
			var setVars = self._getVarsForSet();
			var srcVar  = null;
			var tgtVar  = null;
			for (var i = 0; i < setVars.length; i++) {
				if (setVars[i].id === srcId)   { srcVar = setVars[i]; }
				if (setVars[i].id === targetId) { tgtVar = setVars[i]; }
			}
			if (!srcVar || !tgtVar) { return; }

			// Move src into target's category if different.
			var newCatId   = tgtVar.category_id || '';
			var newCatName = tgtVar.category    || '';

			// Rebuild order: remove src, insert near target.
			var sorted     = setVars.slice().sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
			var withoutSrc = sorted.filter(function (v) { return v.id !== srcId; });
			var tgtIdx     = -1;
			for (var j = 0; j < withoutSrc.length; j++) {
				if (withoutSrc[j].id === targetId) { tgtIdx = j; break; }
			}
			if (tgtIdx === -1) { return; }
			withoutSrc.splice(above ? tgtIdx : tgtIdx + 1, 0, srcVar);
			withoutSrc.forEach(function (v, idx) { v.order = idx + 1; });

			srcVar.category    = newCatName;
			srcVar.category_id = newCatId;

			var chain = Promise.resolve();
			withoutSrc.forEach(function (v) {
				(function (variable) {
					chain = chain.then(function () {
						return AFF.App.ajax('aff_save_color', {
							filename: AFF.state.currentFile,
							variable: JSON.stringify({
								id:          variable.id,
								order:       variable.order,
								category:    variable.category,
								category_id: variable.category_id,
							}),
						}).then(function (r) {
							if (r.success && r.data && r.data.data) {
								AFF.state.variables = r.data.data.variables;
							}
						});
					});
				}(v));
			});
			chain.then(function () {
				if (AFF.App) { AFF.App.setDirty(true); }
				self._rerenderView();
			}).catch(function () {});
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
			return AFF.state.variables.filter(function (v) { return v.subgroup === sub; });
		},

		/**
		 * Return variables in a category, sorted by order.
		 * Matches by category_id first, then falls back to category name string.
		 *
		 * @param {Object} cat Category object.
		 * @returns {Array}
		 */
		_getVarsForCategory: function (cat) {
			var setVars = this._getVarsForSet();
			var matched = setVars.filter(function (v) {
				if (cat.id && v.category_id && v.category_id === cat.id) { return true; }
				if (v.category === cat.name) { return true; }
				return false;
			});
			return matched.sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
		},

		/**
		 * Return variables in a category by ID only.
		 * @param {string} catId
		 * @returns {Array}
		 */
		_getVarsForCategoryId: function (catId) {
			return this._getVarsForSet().filter(function (v) { return v.category_id === catId; });
		},

		/**
		 * Return the sorted category list for this set.
		 * @returns {Array}
		 */
		_getCatsForSet: function () {
			var catKey = this._cfg.catKey;
			var arr    = (AFF.state.config && AFF.state.config[catKey]) || [];
			return arr.slice().sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
		},

		/**
		 * Find a variable by its id.
		 * @param {string} id
		 * @returns {Object|null}
		 */
		_findVarByKey: function (id) {
			for (var i = 0; i < AFF.state.variables.length; i++) {
				if (AFF.state.variables[i].id === id) { return AFF.state.variables[i]; }
			}
			return null;
		},

		/** Alias for _findVarByKey. @param {string} id @returns {Object|null} */
		_findVarById: function (id) { return this._findVarByKey(id); },

		/** Row key for a variable (its UUID). @param {Object} v @returns {string} */
		_rowKey: function (v) { return v.id || ''; },

		// -------------------------------------------------------------------
		// DOM HELPERS
		// -------------------------------------------------------------------

		/**
		 * Update the status dot colour for a variable row.
		 * @param {string} varId
		 * @param {string} status
		 */
		_updateStatusDotInDOM: function (varId, status) {
			var content = document.getElementById('aff-edit-content');
			if (!content) { return; }
			var row = content.querySelector('.aff-color-row[data-var-id="' + this._esc(varId) + '"]');
			var dot = row ? row.querySelector('.aff-status-dot') : null;
			if (dot) { dot.style.background = this._statusColor(status); }
		},

		/**
		 * Show a floating field-error tooltip below the field.
		 * @param {HTMLElement} field
		 * @param {string}      message
		 */
		_showFieldError: function (field, message) {
			this._clearFieldError(field);
			var tip = document.createElement('div');
			tip.className   = 'aff-inline-error';
			tip.textContent = message;
			document.body.appendChild(tip);
			var rect        = field.getBoundingClientRect();
			tip.style.left  = rect.left + 'px';
			tip.style.top   = (rect.bottom + 4) + 'px';
			field._effErrTip = tip;
			setTimeout(function () {
				if (tip.parentNode) { tip.parentNode.removeChild(tip); }
			}, 3000);
		},

		/** Remove any existing field-error tooltip for the given field. */
		_clearFieldError: function (field) {
			if (field._effErrTip && field._effErrTip.parentNode) {
				field._effErrTip.parentNode.removeChild(field._effErrTip);
			}
			field._effErrTip = null;
		},

		/** Open a "no project file" error modal. */
		_noFileModal: function () {
			AFF.Modal.open({
				title: 'No file loaded',
				body:  '<p>Please load or create an AFFproject file before making changes.</p>',
			});
		},

		// -------------------------------------------------------------------
		// STATUS HELPERS
		// -------------------------------------------------------------------

		/**
		 * CSS color for a status value.
		 * @param {string} status
		 * @returns {string}
		 */
		_statusColor: function (status) {
			var map = {
				synced:   '#059669',
				modified: '#f4c542',
				new:      '#3b82f6',
				deleted:  '#dc2626',
				conflict: '#8b5cf6',
				orphaned: '#f97316',
			};
			return map[status] || '#6b7280';
		},

		/**
		 * Extended tooltip text for a status value.
		 * @param {string} status
		 * @returns {string}
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

		// -------------------------------------------------------------------
		// ICON / SVG HELPERS
		// -------------------------------------------------------------------

		/** HTML-escape a string for safe attribute/text insertion. */
		_esc: function (str) {
			return String(str || '')
				.replace(/&/g, '&amp;')
				.replace(/</g, '&lt;')
				.replace(/>/g, '&gt;')
				.replace(/"/g, '&quot;')
				.replace(/'/g, '&#39;');
		},

		/**
		 * Build a category action icon button.
		 * @param {string}  action
		 * @param {string}  label
		 * @param {string}  icon     SVG HTML string.
		 * @param {string}  extraClass
		 * @param {boolean} disabled
		 * @returns {string}
		 */
		_catBtn: function (action, label, icon, extraClass, disabled) {
			return '<button class="aff-icon-btn ' + (extraClass || '') + '"'
				+ ' data-action="' + action + '"'
				+ ' aria-label="' + this._esc(label) + '"'
				+ ' data-aff-tooltip="' + this._esc(label) + '"'
				+ (disabled ? ' disabled' : '')
				+ '>'
				+ icon
				+ '</button>';
		},

		_sixDotSVG: function () {
			return '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="20" viewBox="0 0 14 20" fill="currentColor" aria-hidden="true">'
				+ '<circle cx="4" cy="4" r="2"/><circle cx="10" cy="4" r="2"/>'
				+ '<circle cx="4" cy="10" r="2"/><circle cx="10" cy="10" r="2"/>'
				+ '<circle cx="4" cy="16" r="2"/><circle cx="10" cy="16" r="2"/>'
				+ '</svg>';
		},

		_chevronSVG: function () {
			return '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="4 6 8 10 12 6"/></svg>';
		},

		_plusSVG: function () {
			return '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><line x1="8" y1="3" x2="8" y2="13"/><line x1="3" y1="8" x2="13" y2="8"/></svg>';
		},

		_plusCircleSVG: function () {
			return '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="8" cy="8" r="6"/><line x1="8" y1="5" x2="8" y2="11"/><line x1="5" y1="8" x2="11" y2="8"/></svg>';
		},

		_closeSVG: function () {
			return '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><line x1="2" y1="2" x2="12" y2="12"/><line x1="12" y1="2" x2="2" y2="12"/></svg>';
		},

		_trashSVG: function () {
			return '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
				+ '<polyline points="1 3 3 3 13 3"/>'
				+ '<path d="M4 3V2a1 1 0 011-1h4a1 1 0 011 1v1"/>'
				+ '<path d="M12 3l-1 9a1 1 0 01-1 1H4a1 1 0 01-1-1L2 3"/>'
				+ '<line x1="6" y1="6" x2="6" y2="10"/><line x1="8" y1="6" x2="8" y2="10"/>'
				+ '</svg>';
		},

		_duplicateSVG: function () {
			return '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
				+ '<rect x="4" y="4" width="8" height="8" rx="1"/>'
				+ '<path d="M2 10V3a1 1 0 011-1h7"/>'
				+ '</svg>';
		},

		_arrowUpSVG: function () {
			return '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="7" y1="12" x2="7" y2="2"/><polyline points="3 6 7 2 11 6"/></svg>';
		},

		_arrowDownSVG: function () {
			return '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="7" y1="2" x2="7" y2="12"/><polyline points="3 8 7 12 11 8"/></svg>';
		},

		_expandAllSVG: function () {
			return '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="4 10 8 6 12 10"/><polyline points="4 14 8 10 12 14"/></svg>';
		},

		_collapseAllSVG: function () {
			return '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="4 6 8 10 12 6"/><polyline points="4 2 8 6 12 2"/></svg>';
		},
	};

}());
