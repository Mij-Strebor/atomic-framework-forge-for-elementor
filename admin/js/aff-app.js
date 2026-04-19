/**
 * AFF App — Main Application Entry Point
 *
 * Initializes all modules in the correct order and manages global
 * application state. All modules attach themselves to window.AFF before
 * this file runs (enforced by enqueue dependency chain in PHP).
 *
 * Global state object: AFF.state
 *  - hasUnsavedChanges {boolean}  — drives Save Changes button state
 *  - currentSelection  {Object}   — { group, subgroup, category }
 *  - currentFile       {string}   — currently loaded filename
 *  - theme             {string}   — 'light' | 'dark'
 *  - variables         {Array}    — loaded variable objects
 *  - classes           {Array}    — loaded class objects
 *  - components        {Array}    — loaded component objects
 *  - config            {Object}   — project config (subgroup definitions)
 *
 * @package AtomicFrameworkForge
 */

/* global AFFData */
(function () {
	'use strict';

	window.AFF = window.AFF || {};

	// -----------------------------------------------------------------------
	// GLOBAL STATE
	// -----------------------------------------------------------------------

	AFF.state = {
		hasUnsavedChanges:        false, // AFF file has unsaved changes (drives Save Changes button).
		hasPendingElementorCommit: false, // AFF data not yet committed to Elementor (drives Commit button).
		pendingSaveCount:         0,     // Number of in-flight per-variable AJAX saves (blocks file save).
		currentSelection:         null,
		currentFile:              null,
		projectName:              '',   // Human-readable project name (set via Manage Project modal).
		theme:                    (typeof AFFData !== 'undefined' ? AFFData.theme : 'light') || 'light',
		variables:                [],
		classes:                  [],
		components:               [],
		config:                   {},
		usageCounts:              {}, // { '--varname': count } — populated by fetchUsageCounts()
		settings:                 {}, // cached from aff_get_settings on startup
		// NOTE: metadata is intentionally absent here. It is added dynamically by
		// _loadFile() and _autoLoadFile() when a project file loads. All code that
		// reads it guards with: AFF.state.metadata && ...
		// Tech debt A-03: add metadata: {} here for consistency with all other fields.
	};

	// -----------------------------------------------------------------------
	// UTILITIES
	// -----------------------------------------------------------------------

	AFF.Utils = {

		/**
		 * Return true if the trimmed string is a recognisable CSS color value.
		 * Covers: #rgb, #rrggbb, #rrggbbaa, rgb(), rgba(), hsl(), hsla().
		 *
		 * @param {string} str
		 * @returns {boolean}
		 */
		isColorValue: function (str) {
			var lc = (str || '').trim().toLowerCase();
			if (!lc) { return false; }
			// Hex: 3, 6, or 8 hex digits after '#'
			if (/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/.test(lc)) { return true; }
			// Functional color notations
			return lc.indexOf('rgb(') === 0
				|| lc.indexOf('rgba(') === 0
				|| lc.indexOf('hsl(') === 0
				|| lc.indexOf('hsla(') === 0;
		},

		/**
		 * HTML-escape a string for safe insertion as text or attribute value.
		 *
		 * @param {*} str
		 * @returns {string}
		 */
		escHtml: function (str) {
			if (typeof str !== 'string') { return String(str || ''); }
			var div = document.createElement('div');
			div.textContent = str;
			return div.innerHTML;
		},

		/**
		 * Escape a string for safe use inside an HTML attribute value.
		 * Encodes &, <, >, ", and ' — unlike escHtml which only covers &/</>
		 * via the DOM trick and misses double-quotes inside attribute strings.
		 *
		 * @param {*} str
		 * @returns {string}
		 */
		escAttr: function (str) {
			return String(str || '')
				.replace(/&/g,  '&amp;')
				.replace(/</g,  '&lt;')
				.replace(/>/g,  '&gt;')
				.replace(/"/g,  '&quot;')
				.replace(/'/g,  '&#39;');
		},

		/**
		 * CSS custom-property color for a variable status value.
		 *
		 * @param {string} status
		 * @returns {string}
		 */
		statusColor: function (status) {
			var map = {
				synced:   'var(--aff-status-synced)',
				modified: 'var(--aff-status-modified)',
				new:      'var(--aff-status-new)',
				deleted:  'var(--aff-status-deleted)',
				conflict: 'var(--aff-status-conflict)',
				orphaned: 'var(--aff-status-orphaned)',
			};
			return map[status] || 'var(--aff-status-synced)';
		},

		/**
		 * Extended tooltip text for a variable status value.
		 *
		 * @param {string} status
		 * @returns {string}
		 */
		statusLongTooltip: function (status) {
			var map = {
				synced:   'Synced \u2014 This variable matches the value in the Elementor kit.',
				modified: 'Modified \u2014 Value changed since last sync. Commit to push to Elementor.',
				new:      'New \u2014 Variable not yet in the Elementor kit. Commit to add it.',
				deleted:  'Deleted \u2014 Marked for deletion. Commit to remove from Elementor.',
				conflict: 'Conflict \u2014 Value changed both here and in Elementor since last sync.',
				orphaned: 'Orphaned \u2014 Exists in AFF but not found in Elementor kit. Commit to add it.',
			};
			return map[status] || ('Status: ' + status);
		},

		/**
		 * Compute a unique DOM row key for a variable object.
		 * Uses the UUID when available; falls back to a synthetic '__n_name' key
		 * so unsaved variables that lack an ID still get a unique anchor.
		 *
		 * @param {Object} v Variable object.
		 * @returns {string}
		 */
		rowKey: function (v) {
			return v.id || ('__n_' + v.name);
		},

		/**
		 * Find a variable by its row key (UUID or synthetic __n_name key).
		 * Falls back to name-based search when a __n_ key has been superseded
		 * by a server-assigned UUID without a full re-render.
		 *
		 * @param {string} key Row key from a data-var-id attribute.
		 * @returns {Object|null}
		 */
		findVarByKey: function (key) {
			var vars = AFF.state.variables || [];
			for (var i = 0; i < vars.length; i++) {
				if (AFF.Utils.rowKey(vars[i]) === key) { return vars[i]; }
			}
			if (key.indexOf('__n_') === 0) {
				var name = key.slice(4);
				for (var j = 0; j < vars.length; j++) {
					if (vars[j].name === name) { return vars[j]; }
				}
			}
			return null;
		},

		/**
		 * Find a variable by UUID.
		 *
		 * @param {string} id Variable UUID.
		 * @returns {Object|null}
		 */
		findVarById: function (id) {
			var vars = AFF.state.variables || [];
			for (var i = 0; i < vars.length; i++) {
				if (vars[i].id === id) { return vars[i]; }
			}
			return null;
		},

		/**
		 * Return all non-deleted variables that belong to a given category ID.
		 *
		 * @param {string} catId Category UUID.
		 * @returns {Array}
		 */
		getVarsForCategoryId: function (catId) {
			return (AFF.state.variables || []).filter(function (v) {
				return v.category_id === catId && v.status !== 'deleted';
			});
		},

		/**
		 * Show a positioned error tooltip below a form field.
		 * Auto-dismisses after 3.5 s. Clears any existing tip first.
		 *
		 * @param {HTMLElement} field
		 * @param {string}      message
		 */
		showFieldError: function (field, message) {
			AFF.Utils.clearFieldError(field);
			var el  = document.createElement('div');
			el.className   = 'aff-inline-error';
			el.textContent = message;
			var rect       = field.getBoundingClientRect();
			el.style.left  = rect.left + 'px';
			el.style.top   = (rect.bottom + 4) + 'px';
			document.body.appendChild(el);
			field._affErrEl = el;
			field._affErrTimer = setTimeout(function () {
				if (el.parentNode) { el.parentNode.removeChild(el); }
				if (field._affErrEl === el) { field._affErrEl = null; }
			}, 3500);
		},

		/**
		 * Remove any visible field-error tooltip for an input.
		 *
		 * @param {HTMLElement} field
		 */
		clearFieldError: function (field) {
			if (field._affErrEl) {
				if (field._affErrEl.parentNode) { field._affErrEl.parentNode.removeChild(field._affErrEl); }
				field._affErrEl = null;
			}
			if (field._affErrTimer) {
				clearTimeout(field._affErrTimer);
				field._affErrTimer = null;
			}
		},
	};

	// -----------------------------------------------------------------------
	// SHARED ICON HELPERS
	// -----------------------------------------------------------------------
	//
	// All SVG icon strings and the catBtn builder live here so aff-colors.js
	// and aff-variables.js never need local copies.
	// -----------------------------------------------------------------------

	AFF.Icons = {

		/**
		 * Build a category action icon button.
		 *
		 * @param {string}  action
		 * @param {string}  label
		 * @param {string}  icon       SVG HTML string.
		 * @param {string}  extraClass Additional CSS class(es).
		 * @param {boolean} disabled
		 * @returns {string}
		 */
		catBtn: function (action, label, icon, extraClass, disabled) {
			var esc = AFF.Utils.escAttr;
			return '<button class="aff-icon-btn ' + (extraClass || '') + '"'
				+ ' data-action="' + esc(action) + '"'
				+ ' aria-label="' + esc(label) + '"'
				+ ' title="' + esc(label) + '"'
				+ ' data-aff-tooltip="' + esc(label) + '"'
				+ (disabled ? ' disabled' : '')
				+ '>'
				+ icon
				+ '</button>';
		},

		/** Six-dot drag handle. */
		sixDotSVG: function () {
			return '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="20" viewBox="0 0 14 20" fill="currentColor" aria-hidden="true">'
				+ '<circle cx="4" cy="4" r="2"/><circle cx="10" cy="4" r="2"/>'
				+ '<circle cx="4" cy="10" r="2"/><circle cx="10" cy="10" r="2"/>'
				+ '<circle cx="4" cy="16" r="2"/><circle cx="10" cy="16" r="2"/>'
				+ '</svg>';
		},

		/** Chevron-down (collapse indicator / expand row). */
		chevronSVG: function () {
			return '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"'
				+ ' fill="none" stroke="currentColor" stroke-width="2"'
				+ ' stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
				+ '<polyline points="6 9 12 15 18 9"></polyline>'
				+ '</svg>';
		},

		/** × close / back button. */
		closeSVG: function () {
			return '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"'
				+ ' fill="none" stroke="currentColor" stroke-width="2"'
				+ ' stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
				+ '<line x1="18" y1="6" x2="6" y2="18"></line>'
				+ '<line x1="6" y1="6" x2="18" y2="18"></line>'
				+ '</svg>';
		},

		/** Double-chevron up — collapse-all icon. */
		collapseAllSVG: function () {
			return '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"'
				+ ' fill="none" stroke="currentColor" stroke-width="2"'
				+ ' stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
				+ '<polyline points="18 11 12 5 6 11"></polyline>'
				+ '<polyline points="18 19 12 13 6 19"></polyline>'
				+ '</svg>';
		},

		/** Double-chevron down — expand-all icon. */
		expandAllSVG: function () {
			return '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"'
				+ ' fill="none" stroke="currentColor" stroke-width="2"'
				+ ' stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
				+ '<polyline points="6 5 12 11 18 5"></polyline>'
				+ '<polyline points="6 13 12 19 18 13"></polyline>'
				+ '</svg>';
		},

		/** Plus inside a circle (add variable / add category). */
		plusCircleSVG: function () {
			return '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"'
				+ ' fill="none" stroke="currentColor" stroke-width="2"'
				+ ' stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
				+ '<circle cx="12" cy="12" r="10"></circle>'
				+ '<line x1="12" y1="8" x2="12" y2="16"></line>'
				+ '<line x1="8" y1="12" x2="16" y2="12"></line>'
				+ '</svg>';
		},

		/** Plain plus sign. */
		plusSVG: function () {
			return '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"'
				+ ' fill="none" stroke="currentColor" stroke-width="2.5"'
				+ ' stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
				+ '<line x1="12" y1="5" x2="12" y2="19"></line>'
				+ '<line x1="5" y1="12" x2="19" y2="12"></line>'
				+ '</svg>';
		},

		/** Duplicate / copy icon. */
		duplicateSVG: function () {
			return '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"'
				+ ' fill="none" stroke="currentColor" stroke-width="2"'
				+ ' stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
				+ '<rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>'
				+ '<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>'
				+ '</svg>';
		},

		/** Arrow pointing up (move category up). */
		arrowUpSVG: function () {
			return '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"'
				+ ' fill="none" stroke="currentColor" stroke-width="2"'
				+ ' stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
				+ '<line x1="12" y1="19" x2="12" y2="5"></line>'
				+ '<polyline points="5 12 12 5 19 12"></polyline>'
				+ '</svg>';
		},

		/** Arrow pointing down (move category down). */
		arrowDownSVG: function () {
			return '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"'
				+ ' fill="none" stroke="currentColor" stroke-width="2"'
				+ ' stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
				+ '<line x1="12" y1="5" x2="12" y2="19"></line>'
				+ '<polyline points="19 12 12 19 5 12"></polyline>'
				+ '</svg>';
		},

		/** Trash bin (delete). */
		trashSVG: function () {
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
		 * Sort button icon: neutral (up+down), ascending (up triangle), or descending (down triangle).
		 *
		 * @param {string} dir 'none' | 'asc' | 'desc'
		 * @returns {string}
		 */
		sortBtnSVG: function (dir) {
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
	};

	// -----------------------------------------------------------------------
	// SHARED CATEGORY-MANAGEMENT MIXIN
	// -----------------------------------------------------------------------
	//
	// Applied to AFF.Colors and AFF.Variables._proto via Object.assign at the
	// end of each module's IIFE.
	//
	// Each target must expose:
	//   this._cfg            { catKey: string, setName: string }
	//   this._collapsedIds   {}
	//   this._rerenderView() — re-renders the current view
	//   this._noFileModal()  — shows the "no file loaded" modal
	//   this._getVarsForCategory(cat) — returns variables for a category

	AFF.CatMixin = {

		/** Scroll to and expand a category block in the current view. */
		_jumpToCategory: function (catId, container) {
			var block = container.querySelector('.aff-category-block[data-category-id="' + catId + '"]');
			if (!block) { return; }
			block.setAttribute('data-collapsed', 'false');
			this._collapsedIds[catId] = false;
		},

		/** Open the "Add Category" modal and persist the new category via AJAX. */
		_addCategory: function () {
			var self = this;
			if (!AFF.state.currentFile) { self._noFileModal(); return; }

			AFF.Modal.open({
				title: 'New Category',
				body:  '<p style="margin-bottom:10px">Enter a name for the new category.</p>'
					+ '<input type="text" class="aff-field-input" id="aff-modal-cat-name"'
					+ ' placeholder="Category name" autocomplete="off" style="width:100%">',
				footer: '<div style="display:flex;justify-content:flex-end;gap:8px">'
					+ '<button class="aff-btn aff-btn--secondary" id="aff-modal-cat-cancel">Cancel</button>'
					+ '<button class="aff-btn" id="aff-modal-cat-ok">Add Category</button>'
					+ '</div>',
				onClose: function () { document.removeEventListener('click', handleClick); },
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
							// Use in-memory list as authoritative base; only append the
							// newly created category from the server response. This
							// preserves any unsaved reorder/drag state in local memory.
							var existing = (AFF.state.config[self._cfg.catKey] || []).slice();
							var newId    = res.data.id;
							var alreadyPresent = existing.some(function (c) { return c.id === newId; });
							if (!alreadyPresent) {
								var _serverCats = res.data.categories || [];
								for (var _ki = 0; _ki < _serverCats.length; _ki++) {
									if (_serverCats[_ki].id === newId) {
										existing.push(_serverCats[_ki]);
										break;
									}
								}
							}
							AFF.state.config[self._cfg.catKey] = existing;
							if (AFF.App) { AFF.App.setDirty(true); }
							self._rerenderView();
							if (AFF.PanelLeft && AFF.PanelLeft.refresh) { AFF.PanelLeft.refresh(); }
						}
					}).catch(function () {
						console.warn('[AFF] AJAX error: add category (' + self._cfg.setName + ')');
					});
				}
			}
			document.addEventListener('click', handleClick);
		},

		/**
		 * Save the category name from the always-on contenteditable span.
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
					// Update only the renamed category in memory by ID — never replace
					// the whole array. A wholesale replacement was causing all other
					// categories to disappear when the server returned a stale list.
					var _localCats = AFF.state.config[self._cfg.catKey];
					if (Array.isArray(_localCats)) {
						for (var _ri = 0; _ri < _localCats.length; _ri++) {
							if (_localCats[_ri].id === catId) { _localCats[_ri].name = newName; break; }
						}
					} else {
						AFF.state.config[self._cfg.catKey] = res.data.categories || [];
					}
					// Sync the cached category name on every variable in this category.
					// _getVarsForCategory matches by v.category === cat.name as a
					// fallback; without this sync a rename makes those variables invisible.
					var _allVars = AFF.state.variables || [];
					for (var _vi = 0; _vi < _allVars.length; _vi++) {
						if (_allVars[_vi].category_id === catId || _allVars[_vi].category === oldName) {
							_allVars[_vi].category = newName;
						}
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
		 * Delete a category with confirmation modal.
		 *
		 * @param {string} catId Category ID.
		 */
		_deleteCategory: function (catId) {
			var self = this;
			var vars = AFF.Utils.getVarsForCategoryId(catId);
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
				onClose: function () { document.removeEventListener('click', handleClick); },
			});

			function handleClick(e) {
				if (e.target.id === 'aff-modal-del-cancel') {
					AFF.Modal.close();
					document.removeEventListener('click', handleClick);
				} else if (e.target.id === 'aff-modal-del-ok') {
					AFF.Modal.close();
					document.removeEventListener('click', handleClick);
					// Pre-capture local list so we can filter it instead of trusting
					// the server response (avoids potential stale-list replacement).
					var _preDelCats = (AFF.state.config && Array.isArray(AFF.state.config[self._cfg.catKey]))
						? AFF.state.config[self._cfg.catKey].slice() : null;
					AFF.App.ajax('aff_delete_category', {
						filename:    AFF.state.currentFile,
						subgroup:    self._cfg.setName,
						category_id: catId,
					}).then(function (res) {
						if (res.success && res.data) {
							if (!AFF.state.config) { AFF.state.config = {}; }
							AFF.state.config[self._cfg.catKey] = _preDelCats !== null
								? _preDelCats.filter(function (c) { return c.id !== catId; })
								: res.data.categories;
							delete self._collapsedIds[catId];
							if (AFF.App) { AFF.App.setDirty(true); }
							self._rerenderView();
							if (AFF.PanelLeft && AFF.PanelLeft.refresh) { AFF.PanelLeft.refresh(); }
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
		 * Duplicate a category and all its variables.
		 *
		 * @param {string} catId Source category ID.
		 */
		_duplicateCategory: function (catId) {
			var self = this;
			if (!AFF.state.currentFile) { self._noFileModal(); return; }

			var cats = (AFF.state.config && AFF.state.config[self._cfg.catKey]) || [];
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
				// Merge: append new duplicate category to local state by ID rather
				// than replacing the whole array from the server response.
				var _dupCat = null;
				var _dupServerCats = res.data.categories || [];
				for (var _di = 0; _di < _dupServerCats.length; _di++) {
					if (_dupServerCats[_di].id === res.data.id) { _dupCat = _dupServerCats[_di]; break; }
				}
				if (_dupCat) {
					if (!Array.isArray(AFF.state.config[self._cfg.catKey])) {
						AFF.state.config[self._cfg.catKey] = [];
					}
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
						format:      v.format  || '',
						subgroup:    self._cfg.setName,
						category:    _dupCat ? _dupCat.name : cat.name + ' (copy)',
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

	};

	// aff-colors.js and aff-variables.js load before aff-app.js, so their
	// module objects are already defined by the time this runs.
	Object.assign(AFF.Colors, AFF.CatMixin);
	Object.assign(AFF.Variables._proto, AFF.CatMixin);

	// -----------------------------------------------------------------------
	// UNIFIED VARIABLE DRAG-AND-DROP
	// -----------------------------------------------------------------------
	//
	// All variable types (Colors, Fonts, Numbers, any future set) share this
	// single drag-and-drop implementation.  Variables are plain objects; the
	// only thing that differs per set is which category array to read from.
	// Callers supply a getCats() callback that returns the right array.
	//
	// Public surface
	// ──────────────
	//   AFF.VarDrag.rowKey(v)              → row key string for a variable object
	//   AFF.VarDrag.drop(opts)             → commit a completed drag (update state + AJAX)
	//   AFF.VarDrag.init(container, opts)  → bind drag events to a container element
	//
	// opts for drop()
	//   draggedId      {string}           row key of the dragged variable
	//   targetId       {string}           row key of the drop-target variable, or '__empty-cat__'
	//   insertBefore   {boolean}          insert before (true) or after (false) target
	//   targetCatBlock {HTMLElement|null} .aff-category-block at the drop point
	//   getCats        {Function}         () → category array for this subgroup
	//   rerenderView   {Function}         () → re-renders the edit panel
	//
	// opts for init()
	//   viewSelector   {string}           CSS selector that the active view element must match
	//   onDrop         {Function}         (draggedId, targetId, insertBefore, targetCatBlock)
	// -----------------------------------------------------------------------

	AFF.VarDrag = {

		/** Row key for a variable: UUID when available, otherwise a name-based sentinel. */
		rowKey: function (v) {
			return v.id || ('__n_' + v.name);
		},

		/**
		 * Commit a completed drag-and-drop.
		 *
		 * Works for any variable subgroup — Colors, Fonts, Numbers, future sets.
		 * Callers supply getCats() and getSetVars() so the logic is scoped to the
		 * correct category array and variable set without coupling to module internals.
		 *
		 * opts:
		 *   draggedId      {string}    row key of the dragged variable
		 *   targetId       {string}    row key of the drop target, or '__empty-cat__'
		 *   insertBefore   {boolean}   insert before (true) or after (false) target
		 *   targetCatBlock {Element}   .aff-category-block at drop point
		 *   getCats        {Function}  () → sorted category objects for this subgroup
		 *   getSetVars     {Function}  () → all variable objects for this subgroup
		 *   rerenderView   {Function}  () → re-renders the edit panel
		 */
		drop: function (opts) {
			var draggedId      = opts.draggedId;
			var targetId       = opts.targetId;
			var insertBefore   = opts.insertBefore;
			var targetCatBlock = opts.targetCatBlock;
			var getCats        = opts.getCats;
			var getSetVars     = opts.getSetVars || function () { return AFF.state.variables; };
			var rerenderView   = opts.rerenderView;

			if (!draggedId || !AFF.state.currentFile) { return; }

			var self    = AFF.VarDrag;
			var allVars = AFF.state.variables;

			// Locate the dragged variable in the global pool (UUID lookup).
			var dragged = null;
			for (var i = 0; i < allVars.length; i++) {
				if (self.rowKey(allVars[i]) === draggedId) { dragged = allVars[i]; break; }
			}
			if (!dragged) { return; }

			var cats      = getCats();
			var newCatId  = targetCatBlock ? targetCatBlock.getAttribute('data-category-id') : (dragged.category_id || '');
			var newCatName = dragged.category;

			// Resolve category name from the ID.
			var targetCatObj = null;
			for (var ci = 0; ci < cats.length; ci++) {
				if (cats[ci].id === newCatId) {
					newCatName   = cats[ci].name;
					targetCatObj = cats[ci];
					break;
				}
			}

			// Drop into an empty category — no target row exists.
			if (targetId === '__empty-cat__') {
				if (!targetCatObj) { return; }
				dragged.category    = newCatName;
				dragged.category_id = newCatId;
				dragged.order       = 0;
				rerenderView();
				if (AFF.App) { AFF.App.setDirty(true); if (AFF.PanelLeft) { AFF.PanelLeft.refresh(); } }
				AFF.App.ajax('aff_save_color', {
					filename: AFF.state.currentFile,
					variable: JSON.stringify({ id: dragged.id, order: 0, category: newCatName, category_id: newCatId }),
				}).catch(function () { console.warn('[AFF] VarDrag: AJAX error on empty-cat drop'); });
				return;
			}

			if (!targetCatObj) { return; }

			// Build ordered list of variables in the target category from this subgroup only,
			// excluding the dragged variable so it can be spliced in at the right position.
			var setVars = getSetVars();
			var catVars = setVars.filter(function (v) {
				return ((v.category_id && v.category_id === newCatId) || v.category === newCatName)
				    && self.rowKey(v) !== draggedId;
			}).sort(function (a, b) {
				return (a.order || 0) - (b.order || 0);
			});

			// Find insertion index.
			var insertIdx = catVars.length; // default: append
			for (var vi = 0; vi < catVars.length; vi++) {
				if (self.rowKey(catVars[vi]) === targetId) {
					insertIdx = insertBefore ? vi : vi + 1;
					break;
				}
			}
			catVars.splice(insertIdx, 0, dragged);

			// Reassign order values and update dragged variable's category.
			var saves = [];
			for (var si = 0; si < catVars.length; si++) {
				catVars[si].order       = si;
				catVars[si].category    = newCatName;
				catVars[si].category_id = newCatId;
				saves.push({ id: catVars[si].id, order: si, category: newCatName, category_id: newCatId });
			}

			rerenderView();
			if (AFF.App) {
				AFF.App.setDirty(true);
				if (AFF.PanelLeft) { AFF.PanelLeft.refresh(); }
			}

			// Persist each affected variable (fire-and-forget — no state update from response).
			for (var pi = 0; pi < saves.length; pi++) {
				(function (saveItem) {
					if (!saveItem.id) { return; }
					AFF.App.ajax('aff_save_color', {
						filename: AFF.state.currentFile,
						variable: JSON.stringify(saveItem),
					}).catch(function () { console.warn('[AFF] VarDrag: AJAX error on persist reorder'); });
				}(saves[pi]));
			}
		},

		/**
		 * Bind drag-and-drop events to a container element.
		 *
		 * @param {HTMLElement} container   The edit-content element.
		 * @param {Object}      opts
		 *   viewSelector {string}    Selector for the active view (e.g. '.aff-colors-view')
		 *   onDrop       {Function}  (draggedId, targetId, insertBefore, targetCatBlock)
		 */
		init: function (container, opts) {
			var viewSelector = opts.viewSelector;
			var onDrop       = opts.onDrop;

			var drag = {
				active: false, varId: null,
				ghost: null, indicator: null,
				startY: 0, scrollTimer: null,
				_forceAfter: false,
			};

			// ---- mousedown ----
			container.addEventListener('mousedown', function (e) {
				if (!container.querySelector(viewSelector)) { return; }
				var handle = e.target.closest('.aff-drag-handle');
				if (!handle) { return; }
				e.preventDefault();

				var row = handle.closest('.aff-color-row');
				if (!row) { return; }

				drag.varId = row.getAttribute('data-var-id');
				if (!drag.varId) { return; }

				drag.active = true;
				drag.startY = e.clientY;

				var ghost   = row.cloneNode(true);
				var rowRect = row.getBoundingClientRect();
				ghost.style.cssText = 'position:fixed;pointer-events:none;z-index:9999;'
					+ 'width:' + row.offsetWidth + 'px;'
					+ 'height:' + row.offsetHeight + 'px;'
					+ 'top:' + rowRect.top + 'px;'
					+ 'left:' + rowRect.left + 'px;'
					+ 'opacity:0.88;box-shadow:0 8px 24px rgba(0,0,0,0.28);border-radius:4px;';
				ghost.className += ' aff-drag-ghost';
				document.body.appendChild(ghost);
				drag.ghost = ghost;

				var indicator         = document.createElement('div');
				indicator.className   = 'aff-drop-indicator';
				indicator.style.display      = 'none';
				indicator.style.pointerEvents = 'none';
				var _appEl  = document.getElementById('aff-app');
				var _accent = _appEl ? getComputedStyle(_appEl).getPropertyValue('--aff-clr-accent').trim() : '';
				if (!_accent) { _accent = '#f4c542'; }
				indicator.style.background = 'linear-gradient(to right, transparent,'
					+ _accent + ' 15%,' + _accent + ' 85%, transparent)';
				indicator.style.boxShadow = '0 0 6px ' + _accent;
				document.body.appendChild(indicator);
				drag.indicator = indicator;

				row.classList.add('aff-row-dragging');
			});

			// ---- mousemove ----
			document.addEventListener('mousemove', function (e) {
				if (!drag.active || !drag.ghost) { return; }
				drag._forceAfter = false;
				e.preventDefault();

				var dy = e.clientY - drag.startY;
				drag.ghost.style.top = (parseFloat(drag.ghost.style.top) + dy) + 'px';
				drag.startY = e.clientY;

				// Auto-scroll the edit-space panel when near its top/bottom edge.
				var _editSpace = document.getElementById('aff-edit-space');
				if (_editSpace) {
					var _rect = _editSpace.getBoundingClientRect();
					var _sz   = 60;
					if (e.clientY < _rect.top + _sz) {
						clearInterval(drag.scrollTimer);
						drag.scrollTimer = setInterval(function () { _editSpace.scrollTop -= 8; }, 20);
					} else if (e.clientY > _rect.bottom - _sz) {
						clearInterval(drag.scrollTimer);
						drag.scrollTimer = setInterval(function () { _editSpace.scrollTop += 8; }, 20);
					} else {
						clearInterval(drag.scrollTimer);
						drag.scrollTimer = null;
					}
				}

				// Hide ghost so elementFromPoint sees what's underneath.
				drag.ghost.style.display = 'none';
				var el = document.elementFromPoint(e.clientX, e.clientY);
				drag.ghost.style.display = '';

				var targetRow = el ? el.closest('.aff-color-row') : null;

				// If no row found, check if cursor is over a collapsed category block.
				// Expand it immediately and re-probe so the indicator appears on the
				// same mouse event (no one-event lag).
				if (!targetRow && el) {
					var hoverBlock = el.closest('.aff-category-block');
					if (hoverBlock && hoverBlock.getAttribute('data-collapsed') === 'true') {
						hoverBlock.setAttribute('data-collapsed', 'false');
						drag.ghost.style.display = 'none';
						var el2 = document.elementFromPoint(e.clientX, e.clientY);
						drag.ghost.style.display = '';
						var newRow = el2 ? el2.closest('.aff-color-row') : null;
						if (newRow) { targetRow = newRow; }
					}
				}

				// Cursor over an expanded block but not on a row → append to its end.
				if (!targetRow && el) {
					var hoverBlock2 = el.closest('.aff-category-block');
					if (hoverBlock2 && hoverBlock2.getAttribute('data-collapsed') === 'false') {
						var blockRows = hoverBlock2.querySelectorAll('.aff-color-row:not(.aff-row-dragging)');
						if (blockRows.length > 0) {
							targetRow = blockRows[blockRows.length - 1];
							drag._forceAfter = true;
						} else {
							// Empty category — show indicator in the list body.
							var emptyBody = hoverBlock2.querySelector('.aff-color-list');
							if (emptyBody) {
								var er = emptyBody.getBoundingClientRect();
								drag.indicator.style.display    = 'block';
								drag.indicator.style.top        = (er.top + er.height / 2 - 1) + 'px';
								drag.indicator.style.left       = er.left + 'px';
								drag.indicator.style.width      = er.width + 'px';
								drag.indicator._targetVarId     = '__empty-cat__';
								drag.indicator._insertBefore    = true;
								drag.indicator._targetCatBlock  = hoverBlock2;
							}
						}
					}
				}

				if (targetRow && targetRow.getAttribute('data-var-id') !== drag.varId) {
					var rect   = targetRow.getBoundingClientRect();
					var midY   = rect.top + rect.height / 2;
					var before = drag._forceAfter ? false : (e.clientY < midY);
					drag.indicator.style.display   = 'block';
					drag.indicator.style.top       = (before ? rect.top : rect.bottom) - 1 + 'px';
					drag.indicator.style.left      = rect.left + 'px';
					drag.indicator.style.width     = rect.width + 'px';
					drag.indicator._targetVarId    = targetRow.getAttribute('data-var-id');
					drag.indicator._insertBefore   = before;
					drag.indicator._targetCatBlock = targetRow.closest('.aff-category-block');
				} else {
					if (!el || !el.closest('.aff-category-block')) {
						drag.indicator.style.display = 'none';
						drag.indicator._targetVarId  = null;
					}
				}
			});

			// ---- mouseup ----
			document.addEventListener('mouseup', function () {
				if (!drag.active) { return; }

				clearInterval(drag.scrollTimer);
				drag.scrollTimer = null;

				var targetVarId    = drag.indicator ? drag.indicator._targetVarId    : null;
				var insertBefore   = drag.indicator ? drag.indicator._insertBefore   : true;
				var targetCatBlock = drag.indicator ? drag.indicator._targetCatBlock : null;

				if (drag.ghost)     { drag.ghost.parentNode     && drag.ghost.parentNode.removeChild(drag.ghost); }
				if (drag.indicator) { drag.indicator.parentNode && drag.indicator.parentNode.removeChild(drag.indicator); }

				var draggingRow = container.querySelector('.aff-color-row.aff-row-dragging');
				if (draggingRow) { draggingRow.classList.remove('aff-row-dragging'); }

				drag.ghost     = null;
				drag.indicator = null;
				drag.active    = false;

				if (!targetVarId || !drag.varId) { drag.varId = null; return; }

				var draggedVarId = drag.varId;
				drag.varId = null;

				onDrop(draggedVarId, targetVarId, insertBefore, targetCatBlock);
			});
		},

	};

	// -----------------------------------------------------------------------
	// CORE APP API
	// -----------------------------------------------------------------------

	AFF.App = {

		/**
		 * Set or clear the unsaved-changes flag and update the Save Changes button.
		 *
		 * @param {boolean} isDirty
		 */
		setDirty: function (isDirty) {
			AFF.state.hasUnsavedChanges = isDirty;
			if (AFF.PanelRight) {
				AFF.PanelRight.updateSaveChangesBtn();
			}
			var saveBtn = document.getElementById('aff-btn-save-changes');
			if (saveBtn) { saveBtn.classList.toggle('has-changes', !!isDirty); }
		},

		/**
		 * Set or clear the pending Elementor commit flag and update the Commit button.
		 * Also highlights the Sync button with accent color when changes are pending.
		 *
		 * @param {boolean} hasPending
		 */
		setPendingCommit: function (hasPending) {
			AFF.state.hasPendingElementorCommit = hasPending;
			if (AFF.PanelRight) {
				AFF.PanelRight.updateCommitBtn();
			}
		},

		/**
		 * Re-calculate counts from state and update the right panel display.
		 */
		refreshCounts: function () {
			var counts = {
				variables:  AFF.state.variables.length,
				classes:    AFF.state.classes.length,
				components: AFF.state.components.length,
			};
			if (AFF.PanelRight) {
				AFF.PanelRight.updateCounts(counts);
			}
		},

		/**
		 * Perform a generic AJAX request to an AFF endpoint.
		 *
		 * @param {string} action  WordPress AJAX action name.
		 * @param {Object} data    Additional POST data (excluding action/nonce).
		 * @returns {Promise<Object>} Parsed JSON response.
		 */
		ajax: function (action, data) {
			if (typeof AFFData === 'undefined') {
				return Promise.reject(new Error('AFFData not available'));
			}

			var body = Object.assign({ action: action, nonce: AFFData.nonce }, data || {});

			return fetch(AFFData.ajaxUrl, {
				method:      'POST',
				headers:     { 'Content-Type': 'application/x-www-form-urlencoded' },
				credentials: 'same-origin',
				body:        new URLSearchParams(body),
			}).then(function (response) {
				if (!response.ok) {
					throw new Error('HTTP ' + response.status);
				}
				return response.json();
			});
		},

		/**
		 * Scan all Elementor widget data for references to the current variables.
		 * Results are stored in AFF.state.usageCounts and the current edit view
		 * is refreshed if a category is already loaded.
		 *
		 * @returns {Promise}
		 */
		fetchUsageCounts: function () {
			var names = AFF.state.variables.map(function (v) { return v.name; });
			if (names.length === 0) {
				return Promise.resolve();
			}

			return AFF.App.ajax('aff_get_usage_counts', {
				variable_names: JSON.stringify(names),
			}).then(function (res) {
				if (res.success) {
					AFF.state.usageCounts = res.data.counts || {};
					// Re-render the current category view to show updated badges
					if (AFF.state.currentSelection && AFF.EditSpace) {
						AFF.EditSpace.loadCategory(AFF.state.currentSelection);
					}
				}
			}).catch(function () {
				// Non-critical — usage counts are best-effort
			});
		},

		/**
		 * Apply accessibility/UI preferences from saved settings to #aff-app.
		 * Sets data attributes that drive CSS overrides in aff-preferences.css.
		 * Call on startup after settings load, and after any preference change.
		 *
		 * @param {Object} settings  Saved settings object.
		 */
		applyA11y: function (settings) {
			var app = document.getElementById('aff-app');
			if (!app || !settings) { return; }

			// Font size: treat absent attribute as the default size. The sentinel value
			// here is 16 — but the PHP default in AFF_Settings::$defaults is 14, not 16.
			// On a fresh install fs=14, 14!==16 is always true, so data-aff-font-size="14"
			// is always set and the "absent = use CSS default" branch never fires.
			// Tech debt C-04: align the sentinel — either change PHP default to 16, or
			// change this check to fs !== 14.
			var fs = parseInt(settings.ui_font_size, 10) || 16;
			if (fs !== 16) {
				app.setAttribute('data-aff-font-size', String(fs));
			} else {
				app.removeAttribute('data-aff-font-size');
			}

			// Color contrast
			if (settings.ui_contrast === 'high') {
				app.setAttribute('data-aff-contrast', 'high');
			} else {
				app.removeAttribute('data-aff-contrast');
			}

			// Button size
			if (settings.ui_btn_size && settings.ui_btn_size !== 'normal') {
				app.setAttribute('data-aff-btn-size', settings.ui_btn_size);
			} else {
				app.removeAttribute('data-aff-btn-size');
			}

			// Button contrast
			if (settings.ui_btn_contrast === 'high') {
				app.setAttribute('data-aff-btn-contrast', 'high');
			} else {
				app.removeAttribute('data-aff-btn-contrast');
			}

			// Layout density
			if (settings.layout_density && settings.layout_density !== 'normal') {
				app.setAttribute('data-aff-density', settings.layout_density);
			} else {
				app.removeAttribute('data-aff-density');
			}

			// Reduced motion
			if (settings.reduced_motion) {
				app.setAttribute('data-aff-motion', 'reduced');
			} else {
				app.removeAttribute('data-aff-motion');
			}

			// Tooltip state — sync to PanelTop
			if (AFF.PanelTop) {
				if (typeof settings.show_tooltips !== 'undefined') {
					AFF.PanelTop._showTooltips = !!settings.show_tooltips;
				}
				if (typeof settings.extended_tooltips !== 'undefined') {
					AFF.PanelTop._extendedTooltips = !!settings.extended_tooltips;
				}
			}
		},

		/**
		 * Decrement pendingSaveCount and refresh the Save Changes button.
		 *
		 * Called in the .then() and .catch() of every per-variable AJAX save so
		 * the Save Changes button reflects in-flight state correctly.
		 */
		flushPending: function () {
			AFF.state.pendingSaveCount = Math.max(0, AFF.state.pendingSaveCount - 1);
			if (AFF.PanelRight) {
				AFF.PanelRight.updateSaveChangesBtn();
			}
		},

		/**
		 * Load the project config from WordPress (defaults + saved config).
		 */
		loadConfig: function () {
			return AFF.App.ajax('aff_get_config', {})
				.then(function (res) {
					if (res.success && res.data.config) {
						var cfg = res.data.config;

						// Normalize defaults: groups.Variables.* string arrays → category object arrays.
						// aff-defaults.json stores ["Spacing","Gaps",...] but _getCatsForSet expects
						// [{id, name, order, locked}]. Only run when the key is absent (defaults case).
						var groupVars = (cfg.groups && cfg.groups.Variables) ? cfg.groups.Variables : {};
						var _normalizeCats = function (strArr, prefix) {
							return strArr.map(function (name, i) {
								return {
									id:     'default-' + prefix + '-' + String(name).toLowerCase().replace(/\s+/g, '-'),
									name:   String(name),
									order:  i,
									locked: String(name) === 'Uncategorized'
								};
							});
						};
						if (!cfg.fontCategories || !cfg.fontCategories.length) {
							var fontSrc = (groupVars.Fonts && groupVars.Fonts.length) ? groupVars.Fonts : ['Titles', 'Text', 'Uncategorized'];
							cfg.fontCategories = _normalizeCats(fontSrc, 'font');
						}
						if (!cfg.numberCategories || !cfg.numberCategories.length) {
							var numSrc = (groupVars.Numbers && groupVars.Numbers.length) ? groupVars.Numbers : ['Spacing', 'Gaps', 'Grids', 'Radius', 'Uncategorized'];
							cfg.numberCategories = _normalizeCats(numSrc, 'number');
						}

						AFF.state.config = cfg;
						// globalConfig and config point to the same object reference here. config is
						// replaced when _loadFile() assigns res.data.data.config, so after a project
						// loads the two fields diverge. globalConfig is used as an immutable baseline
						// to backfill missing category arrays on older project files.
						// Risk (tech debt A-02): any mutation of AFF.state.config before a file loads
						// also mutates globalConfig — fix by deep-cloning: JSON.parse(JSON.stringify(cfg)).
						AFF.state.globalConfig = cfg;
						if (cfg.projectName) {
							AFF.state.projectName = cfg.projectName;
						}
					}
				})
				.catch(function () {
					// Non-critical — use empty config
				});
		},
	};

	// -----------------------------------------------------------------------
	// PER-SET VARIABLE CONFIGURATION (Fonts, Numbers)
	//
	// These objects are passed to AFF.Variables.initSet() after AFF.Variables
	// is loaded. Each object configures one variable set.
	// -----------------------------------------------------------------------

	/** HTML-escape helper shared by the cfg renderValueCell methods below. */
	function _varEsc(str) {
		return String(str || '')
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&#39;');
	}

	/** Build a <select> for the format column. */
	function _varFormatSelect(current, types) {
		// FX renders as fₓ (f + U+2093 LATIN SUBSCRIPT SMALL LETTER X) to match the
		// Functions button icon in the top bar. The option *value* stays 'FX' for
		// data compatibility with saved .aff.json files.
		function _formatLabel(t) {
			if (t === '')   { return '\u2014'; }   // — em dash: unitless / no suffix
			if (t === 'FX') { return 'f\u2093'; }  // fₓ subscript-x
			return t;
		}
		var html = '<select class="aff-var-format-sel" aria-label="Format">';
		for (var i = 0; i < types.length; i++) {
			html += '<option value="' + _varEsc(types[i]) + '"'
				+ (types[i] === current ? ' selected' : '')
				+ '>' + _formatLabel(types[i]) + '</option>';
		}
		html += '</select>';
		return html;
	}

	/**
	 * Fonts variable-set configuration.
	 *
	 * Col 3: "Aa" font-preview cell rendered in the variable's own font-family.
	 * Value input also renders its content in its own font-family (live preview).
	 * Format: System | Custom (informational only — no conversion).
	 */
	var FONTS_CFG = {
		setName:         'Fonts',
		catKey:          'fontCategories',
		showExpandPanel: false,
		valueTypes:      ['System', 'Custom'],
		newVarDefaults:  { name: 'new-font', value: 'sans-serif', format: 'System' },

		renderPreviewCell: function (v) {
			return '<span class="aff-font-preview"'
				+ ' style="font-family:' + _varEsc(v.value) + '"'
				+ ' aria-hidden="true"'
				+ ' data-aff-tooltip="Font preview">Aa</span>';
		},

		renderValueCell: function (v) {
			return '<input type="text" class="aff-var-value-input"'
				+ ' value="' + _varEsc(v.value) + '"'
				+ ' data-original="' + _varEsc(v.value) + '"'
				+ ' style="font-family:' + _varEsc(v.value) + '"'
				+ ' spellcheck="false"'
				+ ' aria-label="Font family"'
				+ ' data-aff-tooltip="Font family \u2014 edit directly"'
				+ ' data-aff-tooltip-long="CSS font-family value \u2014 changes the font used for this variable">'
				+ _varFormatSelect(v.format, this.valueTypes);
		},
	};

	/**
	 * Numbers variable-set configuration.
	 *
	 * No preview cell (col 3 absent — 6-column grid).
	 * Format: '' (unitless) | PX | % | EM | REM | VW | VH | CH | FX
	 */
	var NUMBERS_CFG = {
		setName:         'Numbers',
		catKey:          'numberCategories',
		showExpandPanel: false,
		valueTypes:      ['', 'PX', '%', 'EM', 'REM', 'VW', 'VH', 'CH', 'FX'],
		newVarDefaults:  { name: 'new-number', value: '1', format: 'REM' },

		renderPreviewCell: null, // Numbers has no preview column.

		renderValueCell: function (v) {
			return '<input type="text" class="aff-var-value-input"'
				+ ' value="' + _varEsc(v.value) + '"'
				+ ' data-original="' + _varEsc(v.value) + '"'
				+ ' spellcheck="false"'
				+ ' aria-label="Value"'
				+ ' data-aff-tooltip="Numeric value \u2014 enter number only"'
				+ ' data-aff-tooltip-long="Enter a plain number (e.g. 1.5, 16, 100). Add a type suffix on Enter to change unit (e.g. 16px, 1.5rem, 100pc).">'
				+ _varFormatSelect(v.format, this.valueTypes);
		},
	};

	// -----------------------------------------------------------------------
	// INITIALIZATION (DOM ready)
	// -----------------------------------------------------------------------

	document.addEventListener('DOMContentLoaded', function () {

		// 1. Theme (reads data-aff-theme attribute set by PHP — no AJAX needed)
		if (AFF.Theme) {
			AFF.Theme.init();
		}

		// 2. Modal system (must be ready before any button opens a modal)
		if (AFF.Modal) {
			AFF.Modal.init();
		}

		// 3. Right panel (file management + counts)
		if (AFF.PanelRight) {
			AFF.PanelRight.init();
		}

		// 4. Edit space (center content)
		if (AFF.EditSpace) {
			AFF.EditSpace.init();
		}

		// 4b. Colors module — intercepts EditSpace for Colors subgroup.
		if (AFF.Colors) {
			AFF.Colors.init();
		}

		// 4c. Fonts and Numbers — generic variable-set instances.
		if (AFF.Variables) {
			AFF.Variables.initSet(FONTS_CFG);
			AFF.Variables.initSet(NUMBERS_CFG);
		}

		// 5. Top bar (buttons + tooltips — needs Modal to be ready)
		if (AFF.PanelTop) {
			AFF.PanelTop.init();
			// Auto-sync from Elementor on page load (silent — no modal, no dirty flag).
			AFF.PanelTop._syncFromElementor({ silent: true });
		}

		// 6. Load project config, then init left panel and auto-load last file.
		AFF.App.loadConfig().then(function () {
			// NOTE: _ensureUncategorized() is NOT called here. Calling it before a
			// file loads would pollute the global config with a Phase 2 categories
			// array containing only Uncategorized, causing the left panel to enter
			// Phase 2 mode and hide the v1 group items. It is called instead inside
			// loadColors() after the file's config is already in AFF.state.
			if (AFF.PanelLeft) {
				AFF.PanelLeft.init();
			}

			// Auto-load last used file and cache settings.
			// Tech debt DP-05: AFF.PanelTop.init() (called above) also fires aff_get_settings
			// to load tooltip preferences. Two identical HTTP requests go to admin-ajax.php
			// within ~100ms of each other on every page load. Fix: make one call here, then
			// pass the settings object to AFF.PanelTop._applyTooltipSettings(settings).
			AFF.App.ajax('aff_get_settings', {}).then(function (res) {
				if (res.success && res.data && res.data.settings) {
					AFF.state.settings = res.data.settings;
					AFF.App.applyA11y(res.data.settings);
				}
				var lf = res.success && res.data && res.data.settings && res.data.settings.last_file;
				if (lf && AFF.PanelRight) {
					AFF.PanelRight._autoLoadFile(lf);
				}
			}).catch(function () {});
		});

		// 7. Initial counts (all zero until a file is loaded)
		AFF.App.refreshCounts();

		// Title fade — fades the brand name as the center edit space scrolls,
		// keeping the top bar compact with just the action buttons visible.
		// #aff-edit-space is the scroll container (overflow-y: auto); its child
		// #aff-edit-content has no overflow of its own.
		(function () {
			var brandName  = document.querySelector('.aff-brand-name');
			var editSpace  = document.getElementById('aff-edit-space');
			if (brandName && editSpace) {
				editSpace.addEventListener('scroll', function () {
					var y = editSpace.scrollTop;
					brandName.style.opacity = String(Math.max(0, 1 - y / 80));
				}, { passive: true });
			}
		}());

		// 8. Warn on page unload with unsaved or uncommitted changes
		window.addEventListener('beforeunload', function (e) {
			if (AFF.state.hasUnsavedChanges) {
				var msg = 'You have unsaved changes. Leave anyway?';
				e.preventDefault();
				e.returnValue = msg;
				return msg;
			}
		});
	});

}());
