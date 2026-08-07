/**
 * ATFRFO App — Main Application Entry Point
 *
 * Initializes all modules in the correct order and manages global
 * application state. All modules attach themselves to window.ATFRFO before
 * this file runs (enforced by enqueue dependency chain in PHP).
 *
 * Global state object: ATFRFO.state
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

/* global ATFRFOData */
(function () {
	'use strict';

	window.ATFRFO = window.ATFRFO || {};

	// -----------------------------------------------------------------------
	// GLOBAL STATE
	// -----------------------------------------------------------------------

	ATFRFO.state = {
		hasUnsavedChanges:        false, // ATFRFO file has unsaved changes (drives Save Changes button).
		hasPendingElementorCommit: false, // ATFRFO data not yet committed to Elementor (drives Commit button).
		pendingSaveCount:         0,     // Number of in-flight per-variable AJAX saves (blocks file save).
		currentSelection:         null,
		currentFile:              null,
		projectName:              '',   // Human-readable project name (set via Manage Project modal).
		theme:                    (typeof ATFRFOData !== 'undefined' ? ATFRFOData.theme : 'light') || 'light',
		variables:                [],
		classes:                  [],
		components:               [],
		config:                   {},
		usageCounts:              {}, // { '--varname': count } — populated by fetchUsageCounts()
		settings:                 {}, // cached from atfrfo_get_settings on startup
		metadata:                 {}, // { elementor_snapshot, ... } — populated by _loadFile()/_autoLoadFile()
	};

	// -----------------------------------------------------------------------
	// UTILITIES
	// -----------------------------------------------------------------------

	ATFRFO.Utils = {

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
		 * Whether delete-confirmation dialogs should be shown for variables.
		 * Defaults to true; false only once the user unchecks it in Preferences
		 * or ticks "Don't ask me again" on a delete dialog.
		 *
		 * @returns {boolean}
		 */
		confirmDeleteVariablesEnabled: function () {
			return !(ATFRFO.state.settings && ATFRFO.state.settings.confirm_delete_variables === false);
		},

		/**
		 * Persist the confirm-delete-variables preference and update cached state.
		 *
		 * @param {boolean} enabled
		 */
		setConfirmDeleteVariablesEnabled: function (enabled) {
			if (ATFRFO.state.settings) {
				ATFRFO.state.settings.confirm_delete_variables = enabled;
			}
			ATFRFO.App.ajax('atfrfo_save_settings', { settings: JSON.stringify({ confirm_delete_variables: enabled }) });
		},

		/**
		 * HTML for the "Don't ask me again" checkbox used in variable delete dialogs.
		 * Shares .atfrfo-prefs-check-label styling with the Preferences panel.
		 *
		 * @returns {string}
		 */
		dontAskAgainCheckboxHtml: function () {
			return '<label class="atfrfo-prefs-check-label" style="margin-top:var(--sp-3);font-weight:normal;">'
				+ '<input type="checkbox" id="atfrfo-del-dont-ask-again">'
				+ '<span>Don&rsquo;t ask me again</span>'
				+ '</label>';
		},

		/**
		 * CSS custom-property color for a variable status value.
		 *
		 * @param {string} status
		 * @returns {string}
		 */
		statusColor: function (status) {
			var map = {
				synced:   'var(--atfrfo-status-synced)',
				modified: 'var(--atfrfo-status-modified)',
				new:      'var(--atfrfo-status-new)',
				deleted:  'var(--atfrfo-status-deleted)',
				conflict: 'var(--atfrfo-status-conflict)',
				orphaned: 'var(--atfrfo-status-orphaned)',
			};
			return map[status] || 'var(--atfrfo-status-synced)';
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
				orphaned: 'Orphaned \u2014 Exists in ATFRFO but not found in Elementor kit. Commit to add it.',
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
			var vars = ATFRFO.state.variables || [];
			for (var i = 0; i < vars.length; i++) {
				if (ATFRFO.Utils.rowKey(vars[i]) === key) { return vars[i]; }
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
			var vars = ATFRFO.state.variables || [];
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
		getVarsForCategoryId: function (catId, catName) {
			return (ATFRFO.state.variables || []).filter(function (v) {
				if (v.status === 'deleted') { return false; }
				if (v.category_id === catId) { return true; }
				// Legacy: var assigned by name only (no category_id set).
				if (catName && !v.category_id && v.category === catName) { return true; }
				return false;
			});
		},

		/**
		 * Find a class by its AFF UUID.
		 *
		 * @param {string} id Class UUID.
		 * @returns {Object|null}
		 */
		findClassById: function (id) {
			var classes = ATFRFO.state.classes || [];
			for (var i = 0; i < classes.length; i++) {
				if (classes[i].id === id) { return classes[i]; }
			}
			return null;
		},

		/**
		 * Return all classes belonging to a given Classes category.
		 *
		 * Mirrors getVarsForCategoryId() but for ATFRFO.state.classes — Classes
		 * has no 'deleted' status of its own (see class_defaults()/
		 * atfrfo-classes.js status vocabulary note), so no status filter here.
		 *
		 * @param {string|null} catId   Category UUID, or null for name-only match.
		 * @param {string}      catName Category name (matches 'Uncategorized' too).
		 * @returns {Array}
		 */
		getClassesForCategory: function (catId, catName) {
			return (ATFRFO.state.classes || []).filter(function (c) {
				if (catId && c.category_id === catId) { return true; }
				if (catName && !c.category_id && c.category === catName) { return true; }
				return false;
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
			ATFRFO.Utils.clearFieldError(field);
			var el  = document.createElement('div');
			el.className   = 'atfrfo-inline-error';
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

		/**
		 * Classify a CSS value as color / font / number and derive its ATFRFO
		 * format string and storage value.
		 *
		 * Used by both _applyNewVars (Elementor sync) and _applyImport (JSON
		 * import normalization) so the heuristic stays in one place.
		 *
		 * @param {string} value   Raw CSS value string.
		 * @param {string} elUnit  Elementor-supplied unit hint (may be '').
		 * @returns {{ type: string, subgroup: string, format: string, storeValue: string }}
		 */
		classifyVar: function (value, elUnit) {
			var lc      = (value || '').trim().toLowerCase();
			var isColor = ATFRFO.Utils.isColorValue(lc);
			var isFont  = !isColor &&
				/\b(serif|sans-serif|monospace|cursive|fantasy|system-ui|ui-sans-serif|ui-serif|ui-monospace)\b/.test(lc);
			// Named font fallback: a plain word/phrase (letters, digits, spaces, hyphens,
			// commas, apostrophes) that isn't a CSS keyword is almost certainly a font name.
			if (!isFont && !isColor) {
				var _cssKw = /^(none|inherit|initial|unset|auto|normal|bold|bolder|lighter|italic|oblique|currentcolor|transparent)$/i;
				if (/^[a-zA-Z][a-zA-Z0-9 '\-,]*$/.test((value || '').trim()) && !_cssKw.test((value || '').trim())) {
					isFont = true;
				}
			}
			var isNumber = !isColor && !isFont && (
				/^\d/.test(lc) ||
				/^(clamp|calc|min|max)\s*\(/.test(lc) ||
				/\d+(px|rem|em|%|vw|vh|ch|fr|pt|deg|ms)\b/.test(lc)
			);

			var type     = isColor ? 'color'  : isFont ? 'font'  : isNumber ? 'number'  : 'unknown';
			var subgroup = isColor ? 'Colors' : isFont ? 'Fonts' : isNumber ? 'Numbers' : '';
			var format   = '';
			var storeValue = value;

			if (isNumber) {
				var eu = (elUnit || '').toLowerCase();
				if (eu) {
					var unitMap = { px: 'PX', '%': '%', em: 'EM', rem: 'REM', vw: 'VW', vh: 'VH', ch: 'CH', custom: 'FX' };
					format = unitMap[eu] || eu.toUpperCase();
				} else {
					if      (/^(clamp|calc|min|max)\s*\(/.test(lc)) { format = 'FX';  }
					else if (/\d+rem\b/.test(lc))                    { format = 'REM'; }
					else if (/\d+em\b/.test(lc))                     { format = 'EM';  }
					else if (/\d+px\b/.test(lc))                     { format = 'PX';  }
					else if (/\d+%/.test(lc))                        { format = '%';   }
					else if (/\d+vw\b/.test(lc))                     { format = 'VW';  }
					else if (/\d+vh\b/.test(lc))                     { format = 'VH';  }
					else if (/\d+ch\b/.test(lc))                     { format = 'CH';  }
					else                                              { format = 'REM'; }
				}
				// Strip unit suffix so stored value is a pure number (e.g. '1.5rem' → '1.5').
				// FX expressions (clamp, calc, etc.) are kept verbatim.
				if (format !== 'FX') {
					var stripped = (value || '').replace(/(-?[\d.]+)(px|rem|em|%|vw|vh|ch|fr|pt|deg|ms)\s*$/i, '$1');
					if (stripped !== value) { storeValue = stripped; }
				}
			} else if (isColor) {
				if      (lc.indexOf('rgba(') === 0)           { format = 'RGBA'; }
				else if (lc.indexOf('rgb(') === 0)            { format = 'RGB';  }
				else if (lc.indexOf('hsla(') === 0)           { format = 'HSLA'; }
				else if (lc.indexOf('hsl(') === 0)            { format = 'HSL';  }
				else if (/^#[0-9a-f]{8}$/.test(lc))          { format = 'HEXA'; }
				else                                          { format = 'HEX';  }
			}

			return { type: type, subgroup: subgroup, format: format, storeValue: storeValue };
		},

		/**
		 * Inject Google Fonts <link> tags for each unique font-family found in
		 * .atfrfo-font-preview cells inside container. Skips families already
		 * requested. Non-Google fonts fail silently — preview falls back to default.
		 *
		 * @param {Element} container
		 */
		loadFontPreviews: function (container) {
			var cells = container ? container.querySelectorAll('.atfrfo-font-preview') : [];
			if (!cells.length) { return; }
			var loaded = ATFRFO.Utils._loadedFonts || (ATFRFO.Utils._loadedFonts = {});
			for (var i = 0; i < cells.length; i++) {
				var family = (cells[i].style.fontFamily || '').replace(/['"]/g, '').trim();
				if (!family || loaded[family]) { continue; }
				loaded[family] = true;
				var link = document.createElement('link');
				link.rel  = 'stylesheet';
				link.href = 'https://fonts.googleapis.com/css2?family='
					+ encodeURIComponent(family).replace(/%20/g, '+')
					+ ':wght@400;700&display=swap';
				document.head.appendChild(link);
			}
		},

		/**
		 * Re-classify any variables that have no subgroup (e.g. font names stored
		 * before the named-font heuristic existed). Called at file-load time so
		 * in-memory state is always correct; the fix persists on next save.
		 *
		 * @param {Array} variables  ATFRFO.state.variables array (mutated in place).
		 */
		migrateUnclassifiedVars: function (variables) {
			for (var i = 0; i < variables.length; i++) {
				var v = variables[i];
				if (!v.subgroup && v.status !== 'deleted') {
					var cls = ATFRFO.Utils.classifyVar(v.value || '', '');
					if (cls.type !== 'unknown') {
						v.type     = cls.type;
						v.subgroup = cls.subgroup;
						if (!v.format) { v.format = cls.format; }
					}
				}
			}
		},

		/**
		 * Return only the top-level categories (parent_id absent or null) from a
		 * flat sorted array. Sub-categories are retrieved on demand via
		 * _getSubCategoriesOf() at render time.
		 *
		 * @param {Array} cats Flat sorted category array.
		 * @returns {Array} Root categories only.
		 */
		buildCatTree: function (cats) {
			var roots = [];
			for (var i = 0; i < cats.length; i++) {
				if (!cats[i].parent_id) { roots.push(cats[i]); }
			}
			return roots;
		},
	};

	// -----------------------------------------------------------------------
	// SHARED ICON HELPERS
	// -----------------------------------------------------------------------
	//
	// All SVG icon strings and the catBtn builder live here so atfrfo-colors.js
	// and atfrfo-variables.js never need local copies.
	// -----------------------------------------------------------------------

	ATFRFO.Icons = {

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
			var esc = ATFRFO.Utils.escAttr;
			return '<button class="atfrfo-icon-btn ' + (extraClass || '') + '"'
				+ ' data-action="' + esc(action) + '"'
				+ ' aria-label="' + esc(label) + '"'
				+ ' data-atfrfo-tooltip="' + esc(label) + '"'
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

		/** Home icon — back-to-sets navigation. */
		homeSVG: function () {
			return '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"'
				+ ' fill="none" stroke="currentColor" stroke-width="2"'
				+ ' stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
				+ '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>'
				+ '<polyline points="9 22 9 12 15 12 15 22"></polyline>'
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

		/** Brush-cleaning / clear category contents (Lucide brush-cleaning). */
		broomSVG: function () {
			return '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"'
				+ ' fill="none" stroke="currentColor" stroke-width="2"'
				+ ' stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
				+ '<path d="m16 22-1-4"></path>'
				+ '<path d="M19 14a1 1 0 0 0 1-1v-1a2 2 0 0 0-2-2h-3a1 1 0 0 1-1-1V4a2 2 0 0 0-4 0v5a1 1 0 0 1-1 1H6a2 2 0 0 0-2 2v1a1 1 0 0 0 1 1"></path>'
				+ '<path d="M19 14H5l-1.973 6.767A1 1 0 0 0 4 22h16a1 1 0 0 0 .973-1.233z"></path>'
				+ '<path d="m8 22 1-4"></path>'
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
	// Applied to ATFRFO.Colors and ATFRFO.Variables._proto via Object.assign at the
	// end of each module's IIFE.
	//
	// Each target must expose:
	//   this._cfg            { catKey: string, setName: string }
	//   this._collapsedIds   {}
	//   this._rerenderView() — re-renders the current view
	//   this._noFileModal()  — shows the "no file loaded" modal
	//   this._getVarsForCategory(cat) — returns variables for a category

	ATFRFO.CatMixin = {

		/** Scroll to and expand a category block in the current view. */
		_jumpToCategory: function (catId, container) {
			var block = container.querySelector('.atfrfo-category-block[data-category-id="' + catId + '"]');
			if (!block) { return; }
			block.setAttribute('data-collapsed', 'false');
			this._collapsedIds[catId] = false;
			setTimeout(function () {
				block.scrollIntoView({ behavior: 'smooth', block: 'start' });
			}, 50);
		},

		/** Open the "Add Category" modal and persist the new category via AJAX. */
		_addCategory: function () {
			var self = this;
			if (!ATFRFO.state.currentFile) { self._noFileModal(); return; }

			ATFRFO.Modal.open({
				title: 'New Category',
				body:  '<p style="margin-bottom:10px">Enter a name for the new category.</p>'
					+ '<input type="text" class="atfrfo-field-input" id="atfrfo-modal-cat-name"'
					+ ' placeholder="Category name" autocomplete="off" style="width:100%">',
				footer: '<div style="display:flex;justify-content:flex-end;gap:8px">'
					+ '<button class="atfrfo-btn atfrfo-btn--secondary" id="atfrfo-modal-cat-cancel">Cancel</button>'
					+ '<button class="atfrfo-btn" id="atfrfo-modal-cat-ok">Add Category</button>'
					+ '</div>',
				onClose: function () { document.removeEventListener('click', handleClick); },
			});
			setTimeout(function () {
				var inp = document.getElementById('atfrfo-modal-cat-name');
				if (inp) { inp.focus(); }
			}, 50);

			function handleClick(e) {
				if (e.target.id === 'atfrfo-modal-cat-cancel') {
					ATFRFO.Modal.close();
					document.removeEventListener('click', handleClick);
				} else if (e.target.id === 'atfrfo-modal-cat-ok') {
					var inp  = document.getElementById('atfrfo-modal-cat-name');
					var name = inp ? inp.value.trim() : '';
					ATFRFO.Modal.close();
					document.removeEventListener('click', handleClick);
					if (!name) { return; }

					ATFRFO.App.ajax('atfrfo_save_category', {
						filename: ATFRFO.state.currentFile,
						subgroup: self._cfg.setName,
						category: JSON.stringify({ name: name }),
					}).then(function (res) {
						if (res.success && res.data) {
							if (!ATFRFO.state.config) { ATFRFO.state.config = {}; }
							// Use in-memory list as authoritative base; only append the
							// newly created category from the server response. This
							// preserves any unsaved reorder/drag state in local memory.
							var existing = (ATFRFO.state.config[self._cfg.catKey] || []).slice();
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
							// Give the new category an order below all existing top-level
							// cats so it sorts to the top of the rendered list.
							var _minOrd = 0;
							for (var _oi = 0; _oi < existing.length; _oi++) {
								if (!existing[_oi].parent_id && existing[_oi].id !== newId) {
									var _ord = existing[_oi].order || 0;
									if (_ord < _minOrd) { _minOrd = _ord; }
								}
							}
							for (var _ni = 0; _ni < existing.length; _ni++) {
								if (existing[_ni].id === newId) {
									existing[_ni].order = _minOrd - 1;
									break;
								}
							}
							ATFRFO.state.config[self._cfg.catKey] = existing;
							if (ATFRFO.App) { ATFRFO.App.setDirty(true); }
							self._rerenderView();
							if (ATFRFO.PanelLeft && ATFRFO.PanelLeft.refresh) { ATFRFO.PanelLeft.refresh(); }
						}
					}).catch(function () {
						console.warn('[ATFRFO] AJAX error: add category (' + self._cfg.setName + ')');
					});
				}
			}
			document.addEventListener('click', handleClick);
		},

		/**
		 * Save the category name from the always-on contenteditable span.
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
					// Update only the renamed category in memory by ID — never replace
					// the whole array. A wholesale replacement was causing all other
					// categories to disappear when the server returned a stale list.
					var _localCats = ATFRFO.state.config[self._cfg.catKey];
					if (Array.isArray(_localCats)) {
						for (var _ri = 0; _ri < _localCats.length; _ri++) {
							if (_localCats[_ri].id === catId) { _localCats[_ri].name = newName; break; }
						}
					} else {
						ATFRFO.state.config[self._cfg.catKey] = res.data.categories || [];
					}
					// Sync the cached category name on every variable in this category.
					// _getVarsForCategory matches by v.category === cat.name as a
					// fallback; without this sync a rename makes those variables invisible.
					var _allVars = ATFRFO.state.variables || [];
					for (var _vi = 0; _vi < _allVars.length; _vi++) {
						if (_allVars[_vi].category_id === catId || _allVars[_vi].category === oldName) {
							_allVars[_vi].category = newName;
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
		 * Delete a category with confirmation modal.
		 *
		 * @param {string} catId Category ID.
		 */
		_deleteCategory: function (catId) {
			var self = this;
			if (!ATFRFO.state.currentFile) { self._noFileModal(); return; }

			var cats = (ATFRFO.state.config && Array.isArray(ATFRFO.state.config[self._cfg.catKey]))
				? ATFRFO.state.config[self._cfg.catKey] : [];
			var catObj   = cats.find(function (c) { return c.id === catId; });
			var catLabel = catObj ? '‘' + catObj.name + '’' : 'this category';
			var vars     = ATFRFO.Utils.getVarsForCategoryId(catId, catObj ? catObj.name : '');

			// BFS to find all descendant sub-categories.
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
			var descVarCount = 0;
			for (var _dci = 0; _dci < descCats.length; _dci++) {
				var _dc = descCats[_dci];
				descVarCount += ATFRFO.Utils.getVarsForCategoryId(_dc.id, _dc.name).length;
			}

			// deleteVars: true = delete vars with category; false = move to Uncategorized.
			// Toggle represents "Save to Uncategorized" — off by default (vars are deleted).
			var deleteVars = true;

			var bodyText = '<p>Delete category ' + catLabel + '?</p>';
			if (descCats.length > 0) {
				bodyText += '<p style="margin-top:var(--sp-2)">Deleting this category will also delete '
					+ descCats.length + ' nested sub-categor'
					+ (descCats.length === 1 ? 'y' : 'ies')
					+ (descVarCount > 0 ? ' and their ' + descVarCount + ' variable(s)' : '')
					+ '.</p>';
			}
			if (vars.length > 0) {
				var totalVars = vars.length + descVarCount;
				bodyText += '<p style="margin-top:var(--sp-2)">This category has '
					+ (descCats.length > 0 ? totalVars + ' variable(s) in total (direct and nested).' : vars.length + ' variable(s).')
					+ ' You may save them to Uncategorized if you wish.</p>'
					+ '<div class="atfrfo-del-cat-vars">'
					+ '<span class="atfrfo-del-cat-action-label">Save variables to Uncategorized:</span>'
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
				onClose: function () {
					document.removeEventListener('click', handleClick);
					document.removeEventListener('keydown', handleDelCatKey);
				},
			});

			// Wire up iOS toggle after modal renders.
			// Checked = save to Uncategorized (deleteVars = false); unchecked = delete (deleteVars = true).
			if (vars.length > 0) {
				setTimeout(function () {
					var chk = document.getElementById('atfrfo-del-cat-check');
					if (chk) {
						chk.addEventListener('change', function () {
							deleteVars = !chk.checked;
						});
					}
				}, 0);
			}

			// Focus Delete button on open.
			setTimeout(function () {
				var btn = document.getElementById('atfrfo-modal-del-ok');
				if (btn) { btn.focus(); }
			}, 50);

			function handleDelCatKey(e) {
				if (e.key === 'Enter') {
					var focused = document.activeElement;
					if (focused && (focused.id === 'atfrfo-modal-del-ok' || focused.id === 'atfrfo-modal-del-cancel')) {
						e.preventDefault();
						focused.click();
					}
					return;
				}
				var isTab   = e.key === 'Tab';
				var isRight = e.key === 'ArrowRight';
				var isLeft  = e.key === 'ArrowLeft';
				if (!isTab && !isRight && !isLeft) { return; }
				var ids = ['atfrfo-modal-del-cancel', 'atfrfo-modal-del-ok'];
				var focused = document.activeElement;
				var idx = ids.indexOf(focused ? focused.id : '');
				if (isTab) {
					e.preventDefault();
					e.stopImmediatePropagation();
				} else {
					if (idx === -1) { return; }
					e.preventDefault();
				}
				var backward = (isTab && e.shiftKey) || isLeft;
				var next = idx === -1
					? (backward ? ids.length - 1 : 0)
					: (backward ? (idx - 1 + ids.length) % ids.length : (idx + 1) % ids.length);
				var nextBtn = document.getElementById(ids[next]);
				if (nextBtn) { nextBtn.focus(); }
			}
			document.addEventListener('keydown', handleDelCatKey);

			function doDeleteCategory(dv) {
				ATFRFO.Modal.close();
				document.removeEventListener('click', handleClick);
				document.removeEventListener('keydown', handleDelCatKey);
				// Pre-capture local list so we can filter it instead of trusting
				// the server response (avoids potential stale-list replacement).
				var _preDelCats = (ATFRFO.state.config && Array.isArray(ATFRFO.state.config[self._cfg.catKey]))
					? ATFRFO.state.config[self._cfg.catKey].slice() : null;
				ATFRFO.App.ajax('atfrfo_delete_category', {
					filename:    ATFRFO.state.currentFile,
					subgroup:    self._cfg.setName,
					category_id: catId,
					delete_vars: dv ? '1' : '0',
				}).then(function (res) {
					if (res.success && res.data) {
						if (!ATFRFO.state.config) { ATFRFO.state.config = {}; }
						var _descIds = descCats.map(function (c) { return c.id; });
						ATFRFO.state.config[self._cfg.catKey] = _preDelCats !== null
							? _preDelCats.filter(function (c) {
								return c.id !== catId && _descIds.indexOf(c.id) === -1;
							})
							: res.data.categories;
						if (res.data.variables) {
							ATFRFO.state.variables = res.data.variables;
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
					document.removeEventListener('keydown', handleDelCatKey);
				} else if (e.target.id === 'atfrfo-modal-del-ok') {
					doDeleteCategory(deleteVars);
				}
			}
			document.addEventListener('click', handleClick);
		},

		/**
		 * Clear a category: remove all sub-categories and variables inside it,
		 * but keep the category shell itself.
		 *
		 * @param {string} catId Category ID.
		 */
		_clearCategory: function (catId) {
			var self = this;
			if (!ATFRFO.state.currentFile) { self._noFileModal(); return; }

			var cats   = (ATFRFO.state.config && Array.isArray(ATFRFO.state.config[self._cfg.catKey]))
				? ATFRFO.state.config[self._cfg.catKey] : [];
			var catObj = cats.find(function (c) { return c.id === catId; });
				var catLabel = catObj ? '‘' + catObj.name + '’' : 'this category';

			// BFS to collect all descendant sub-categories.
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

			var directVars = ATFRFO.Utils.getVarsForCategoryId(catId, catObj ? catObj.name : '');
			var descVarCount = 0;
			for (var _dci = 0; _dci < descCats.length; _dci++) {
				var _dc = descCats[_dci];
				descVarCount += ATFRFO.Utils.getVarsForCategoryId(_dc.id, _dc.name).length;
			}
			var totalVars = directVars.length + descVarCount;

			var bodyText = '<p>Clear category ' + catLabel + '?</p>'
				+ '<p style="margin-top:var(--sp-2)">All variables'
				+ (descCats.length > 0 ? ' and ' + descCats.length + ' nested sub-categor' + (descCats.length === 1 ? 'y' : 'ies') : '')
				+ ' inside this category will be permanently deleted'
				+ (totalVars > 0 ? ' (' + totalVars + ' variable' + (totalVars === 1 ? '' : 's') + ')' : '')
				+ '. The category itself will remain.</p>';

			ATFRFO.Modal.open({
				title:   'Clear Category',
				body:    bodyText,
				footer:  '<div style="display:flex;justify-content:flex-end;gap:8px">'
					+ '<button class="atfrfo-btn atfrfo-btn--secondary" id="atfrfo-modal-clr-cancel">Cancel</button>'
					+ '<button class="atfrfo-btn atfrfo-btn--danger" id="atfrfo-modal-clr-ok">Clear</button>'
					+ '</div>',
				onClose: function () {
					document.removeEventListener('click', handleClrClick);
					document.removeEventListener('keydown', handleClrKey);
				},
			});

			setTimeout(function () {
				var btn = document.getElementById('atfrfo-modal-clr-ok');
				if (btn) { btn.focus(); }
			}, 50);

			function handleClrKey(e) {
				if (e.key === 'Enter') {
					var focused = document.activeElement;
					if (focused && (focused.id === 'atfrfo-modal-clr-ok' || focused.id === 'atfrfo-modal-clr-cancel')) {
						e.preventDefault();
						focused.click();
					}
					return;
				}
				var isTab = e.key === 'Tab', isRight = e.key === 'ArrowRight', isLeft = e.key === 'ArrowLeft';
				if (!isTab && !isRight && !isLeft) { return; }
				var ids = ['atfrfo-modal-clr-cancel', 'atfrfo-modal-clr-ok'];
				var focused = document.activeElement;
				var idx = ids.indexOf(focused ? focused.id : '');
				if (isTab) { e.preventDefault(); e.stopImmediatePropagation(); }
				else { if (idx === -1) { return; } e.preventDefault(); }
				var backward = (isTab && e.shiftKey) || isLeft;
				var next = idx === -1
					? (backward ? ids.length - 1 : 0)
					: (backward ? (idx - 1 + ids.length) % ids.length : (idx + 1) % ids.length);
				var nextBtn = document.getElementById(ids[next]);
				if (nextBtn) { nextBtn.focus(); }
			}
			document.addEventListener('keydown', handleClrKey);

			function doClearCategory() {
				ATFRFO.Modal.close();
				document.removeEventListener('click', handleClrClick);
				document.removeEventListener('keydown', handleClrKey);
				var _preCats = (ATFRFO.state.config && Array.isArray(ATFRFO.state.config[self._cfg.catKey]))
					? ATFRFO.state.config[self._cfg.catKey].slice() : null;
				ATFRFO.App.ajax('atfrfo_clear_category', {
					filename:    ATFRFO.state.currentFile,
					subgroup:    self._cfg.setName,
					category_id: catId,
				}).then(function (res) {
					if (res.success && res.data) {
						if (!ATFRFO.state.config) { ATFRFO.state.config = {}; }
						var _descIds = descCats.map(function (c) { return c.id; });
						// Remove descendant sub-categories but keep the target category.
						ATFRFO.state.config[self._cfg.catKey] = _preCats !== null
							? _preCats.filter(function (c) { return _descIds.indexOf(c.id) === -1; })
							: res.data.categories;
						if (res.data.variables) {
							ATFRFO.state.variables = res.data.variables;
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
					document.removeEventListener('keydown', handleClrKey);
				} else if (e.target.id === 'atfrfo-modal-clr-ok') {
					doClearCategory();
				}
			}
			document.addEventListener('click', handleClrClick);
		},

		/**
		 * Duplicate a category and all its variables.
		 *
		 * @param {string} catId Source category ID.
		 */
		_duplicateCategory: function (catId) {
			var self = this;
			if (!ATFRFO.state.currentFile) { self._noFileModal(); return; }

			var cats = (ATFRFO.state.config && ATFRFO.state.config[self._cfg.catKey]) || [];
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
				// Merge: append new duplicate category to local state by ID rather
				// than replacing the whole array from the server response.
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
							return ATFRFO.App.ajax('atfrfo_save_color', {
								filename: ATFRFO.state.currentFile,
								variable: JSON.stringify(dv),
							}).then(function (r) {
								if (r.success && r.data && r.data.data) {
									ATFRFO.state.variables = r.data.data.variables;
								}
							});
						});
					}(dupVar));
				});
				chain.then(function () {
					if (ATFRFO.App) { ATFRFO.App.setDirty(true); ATFRFO.App.refreshCounts(); }
					self._rerenderView();
					if (ATFRFO.PanelLeft && ATFRFO.PanelLeft.refresh) { ATFRFO.PanelLeft.refresh(); }
				}).catch(function () {});
			}).catch(function () {});
		},

		/**
		 * Initialize mouse-based drag-and-drop for category blocks.
		 * Requires host module to implement _catViewSelector() and _onDropCat().
		 *
		 * @param {HTMLElement} container
		 */
		_initCatDrag: function (container) {
			var self = this;
			var d = { active: false, catId: null, ghost: null, indicator: null, startY: 0, _dropTargetId: null, _dropAbove: null };

			container.addEventListener('mousedown', function (e) {
				if (!container.querySelector(self._catViewSelector())) { return; }
				var handle = e.target.closest('.atfrfo-cat-drag-handle');
				if (!handle) { return; }
				e.preventDefault();

				var block = handle.closest('.atfrfo-category-block');
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

				block.style.opacity = '0.3';
			});

			document.addEventListener('mousemove', function (e) {
				if (!d.active || !d.ghost) { return; }
				var dy = e.clientY - d.startY;
				d.ghost.style.transform = 'translateY(' + dy + 'px)';

				d.ghost.style.display = 'none';
				var elBelow = document.elementFromPoint(e.clientX, e.clientY);
				d.ghost.style.display = '';

				var targetBlock = elBelow ? elBelow.closest('.atfrfo-category-block') : null;
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

				var draggingBlock = container.querySelector('.atfrfo-category-block[data-category-id="' + d.catId + '"]');
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
		 * Filter variable rows by search query, hiding empty category blocks.
		 * Uses ATFRFO.Utils.findVarByKey to match against state (name + value).
		 *
		 * @param {HTMLElement} container
		 * @param {string}      query Lowercased search string.
		 */
		_filterRows: function (container, query) {
			var lq     = (query || '').trim().toLowerCase();
			var blocks = container.querySelectorAll('.atfrfo-category-block');
			for (var bi = 0; bi < blocks.length; bi++) {
				var block      = blocks[bi];
				var rows       = block.querySelectorAll('.atfrfo-color-row');
				var anyVisible = false;
				for (var ri = 0; ri < rows.length; ri++) {
					var row   = rows[ri];
					var varId = row.getAttribute('data-var-id');
					var v     = varId ? ATFRFO.Utils.findVarByKey(varId) : null;
					var match = !lq;
					if (!match && v) {
						match = (v.name  || '').toLowerCase().indexOf(lq) !== -1
							 || (v.value || '').toLowerCase().indexOf(lq) !== -1;
					}
					row.style.display = match ? '' : 'none';
					if (match) { anyVisible = true; }
				}
				block.style.display = anyVisible ? '' : 'none';
			}
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
			if (ATFRFO.state.config && ATFRFO.state.config[catKey]) {
				var cats = ATFRFO.state.config[catKey];
				for (var i = 0; i < orderedIds.length; i++) {
					for (var j = 0; j < cats.length; j++) {
						if (cats[j].id === orderedIds[i]) { cats[j].order = i; break; }
					}
				}
			}
			self._rerenderView();

			if (!ATFRFO.state.currentFile) { return; }
			if (ATFRFO.App) { ATFRFO.App.setDirty(true); }

			ATFRFO.App.ajax('atfrfo_reorder_categories', {
				filename:    ATFRFO.state.currentFile,
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
		 * Open the "Add sub-category" modal for a given parent category.
		 *
		 * @param {string} parentCatId UUID of the parent category.
		 */
		_addSubCategory: function (parentCatId) {
			var self = this;
			if (!ATFRFO.state.currentFile) { self._noFileModal(); return; }

			var allCats = (ATFRFO.state.config && Array.isArray(ATFRFO.state.config[self._cfg.catKey]))
				? ATFRFO.state.config[self._cfg.catKey] : [];
			var parentCat = null;
			for (var _pi = 0; _pi < allCats.length; _pi++) {
				if (allCats[_pi].id === parentCatId) { parentCat = allCats[_pi]; break; }
			}

			ATFRFO.Modal.open({
				title: 'New Sub-category',
				body:  '<p style="margin-bottom:10px">Enter a name for the new sub-category'
					+ (parentCat ? ' under “' + ATFRFO.Utils.escHtml(parentCat.name) + '”' : '')
					+ '.</p>'
					+ '<input type="text" class="atfrfo-field-input" id="atfrfo-modal-subcat-name"'
					+ ' placeholder="Sub-category name" autocomplete="off" style="width:100%">',
				footer: '<div style="display:flex;justify-content:flex-end;gap:8px">'
					+ '<button class="atfrfo-btn atfrfo-btn--secondary" id="atfrfo-modal-subcat-cancel">Cancel</button>'
					+ '<button class="atfrfo-btn" id="atfrfo-modal-subcat-ok">Add Sub-category</button>'
					+ '</div>',
				onClose: function () { document.removeEventListener('click', _scHandleClick); },
			});
			setTimeout(function () {
				var inp = document.getElementById('atfrfo-modal-subcat-name');
				if (inp) { inp.focus(); }
			}, 50);

			function _scHandleClick(e) {
				if (e.target.id === 'atfrfo-modal-subcat-cancel') {
					ATFRFO.Modal.close();
					document.removeEventListener('click', _scHandleClick);
				} else if (e.target.id === 'atfrfo-modal-subcat-ok') {
					var inp  = document.getElementById('atfrfo-modal-subcat-name');
					var name = inp ? inp.value.trim() : '';
					ATFRFO.Modal.close();
					document.removeEventListener('click', _scHandleClick);
					if (!name) { return; }

					ATFRFO.App.ajax('atfrfo_save_category', {
						filename: ATFRFO.state.currentFile,
						subgroup: self._cfg.setName,
						category: JSON.stringify({ name: name, parent_id: parentCatId }),
					}).then(function (res) {
						if (res.success && res.data) {
							if (!ATFRFO.state.config) { ATFRFO.state.config = {}; }
							var existing  = (ATFRFO.state.config[self._cfg.catKey] || []).slice();
							var newId     = res.data.id;
							var alreadyIn = existing.some(function (c) { return c.id === newId; });
							if (!alreadyIn) {
								var _sCats = res.data.categories || [];
								for (var _ski = 0; _ski < _sCats.length; _ski++) {
									if (_sCats[_ski].id === newId) {
										existing.push(_sCats[_ski]);
										break;
									}
								}
							}
							ATFRFO.state.config[self._cfg.catKey] = existing;
							if (ATFRFO.App) { ATFRFO.App.setDirty(true); }
							self._rerenderView();
							if (ATFRFO.PanelLeft && ATFRFO.PanelLeft.refresh) { ATFRFO.PanelLeft.refresh(); }
						}
					}).catch(function () {
						console.warn('[ATFRFO] AJAX error: add sub-category (' + self._cfg.setName + ')');
					});
				}
			}
			document.addEventListener('click', _scHandleClick);
		},

	};

	// atfrfo-colors.js, atfrfo-variables.js, and atfrfo-classes.js load before
	// atfrfo-app.js, so their module objects are already defined by the time
	// this runs.
	Object.assign(ATFRFO.Colors, ATFRFO.CatMixin);
	Object.assign(ATFRFO.Variables._proto, ATFRFO.CatMixin);

	// Classes only reuses the category primitives that are genuinely generic
	// (add category, add sub-category, reorder, drag-init). Delete/clear/
	// rename/duplicate are implemented locally in atfrfo-classes.js instead —
	// the mixin's versions are hard-wired to ATFRFO.state.variables and
	// atfrfo_save_color, and classes are sync-sourced from Elementor rather
	// than user-created, so "duplicate category" must not fabricate rows.
	ATFRFO.Classes._addCategory           = ATFRFO.CatMixin._addCategory;
	ATFRFO.Classes._addSubCategory        = ATFRFO.CatMixin._addSubCategory;
	ATFRFO.Classes._ajaxReorderCategories = ATFRFO.CatMixin._ajaxReorderCategories;
	ATFRFO.Classes._jumpToCategory        = ATFRFO.CatMixin._jumpToCategory;
	ATFRFO.Classes._initCatDrag           = ATFRFO.CatMixin._initCatDrag;

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
	//   ATFRFO.VarDrag.rowKey(v)              → row key string for a variable object
	//   ATFRFO.VarDrag.drop(opts)             → commit a completed drag (update state + AJAX)
	//   ATFRFO.VarDrag.init(container, opts)  → bind drag events to a container element
	//
	// opts for drop()
	//   draggedId      {string}           row key of the dragged variable
	//   targetId       {string}           row key of the drop-target variable, or '__empty-cat__'
	//   insertBefore   {boolean}          insert before (true) or after (false) target
	//   targetCatBlock {HTMLElement|null} .atfrfo-category-block at the drop point
	//   getCats        {Function}         () → category array for this subgroup
	//   rerenderView   {Function}         () → re-renders the edit panel
	//
	// opts for init()
	//   viewSelector   {string}           CSS selector that the active view element must match
	//   onDrop         {Function}         (draggedId, targetId, insertBefore, targetCatBlock)
	// -----------------------------------------------------------------------

	ATFRFO.VarDrag = {

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
		 *   targetCatBlock {Element}   .atfrfo-category-block at drop point
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
			var getSetVars     = opts.getSetVars || function () { return ATFRFO.state.variables; };
			var rerenderView   = opts.rerenderView;

			if (!draggedId || !ATFRFO.state.currentFile) { return; }

			var self    = ATFRFO.VarDrag;
			var allVars = ATFRFO.state.variables;

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
				if (ATFRFO.App) { ATFRFO.App.setDirty(true); if (ATFRFO.PanelLeft) { ATFRFO.PanelLeft.refresh(); } }
				ATFRFO.App.ajax('atfrfo_save_color', {
					filename: ATFRFO.state.currentFile,
					variable: JSON.stringify({ id: dragged.id, order: 0, category: newCatName, category_id: newCatId }),
				}).catch(function () { console.warn('[ATFRFO] VarDrag: AJAX error on empty-cat drop'); });
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
			if (ATFRFO.App) {
				ATFRFO.App.setDirty(true);
				if (ATFRFO.PanelLeft) { ATFRFO.PanelLeft.refresh(); }
			}

			// Persist each affected variable (fire-and-forget — no state update from response).
			for (var pi = 0; pi < saves.length; pi++) {
				(function (saveItem) {
					if (!saveItem.id) { return; }
					ATFRFO.App.ajax('atfrfo_save_color', {
						filename: ATFRFO.state.currentFile,
						variable: JSON.stringify(saveItem),
					}).catch(function () { console.warn('[ATFRFO] VarDrag: AJAX error on persist reorder'); });
				}(saves[pi]));
			}
		},

		/**
		 * Bind drag-and-drop events to a container element.
		 *
		 * @param {HTMLElement} container   The edit-content element.
		 * @param {Object}      opts
		 *   viewSelector {string}    Selector for the active view (e.g. '.atfrfo-colors-view')
		 *   onDrop       {Function}  (draggedId, targetId, insertBefore, targetCatBlock)
		 */
		init: function (container, opts) {
			var viewSelector = opts.viewSelector;
			var onDrop       = opts.onDrop;

			var drag = {
				active: false, varId: null,
				ghost: null, indicator: null,
				startY: 0, startScroll: 0, scrollTimer: null,
				_forceAfter: false,
			};

			// ---- mousedown ----
			container.addEventListener('mousedown', function (e) {
				if (!container.querySelector(viewSelector)) { return; }
				var handle = e.target.closest('.atfrfo-drag-handle');
				if (!handle) { return; }
				e.preventDefault();

				var row = handle.closest('.atfrfo-color-row');
				if (!row) { return; }

				drag.varId = row.getAttribute('data-var-id');
				if (!drag.varId) { return; }

				drag.active = true;
				drag.startY = e.clientY;

				var _es = document.getElementById('atfrfo-edit-space');
				drag.startScroll = _es ? _es.scrollTop : 0;

				var ghost   = row.cloneNode(true);
				var rowRect = row.getBoundingClientRect();
				ghost.style.cssText = 'position:fixed;pointer-events:none;z-index:9999;'
					+ 'width:' + row.offsetWidth + 'px;'
					+ 'height:' + row.offsetHeight + 'px;'
					+ 'top:' + rowRect.top + 'px;'
					+ 'left:' + rowRect.left + 'px;'
					+ 'opacity:0.88;box-shadow:0 8px 24px rgba(0,0,0,0.28);border-radius:4px;';
				ghost.className += ' atfrfo-drag-ghost';
				document.body.appendChild(ghost);
				drag.ghost = ghost;

				var indicator         = document.createElement('div');
				indicator.className   = 'atfrfo-drop-indicator';
				indicator.style.display      = 'none';
				indicator.style.pointerEvents = 'none';
				var _appEl  = document.getElementById('atfrfo-app');
				var _accent = _appEl ? getComputedStyle(_appEl).getPropertyValue('--atfrfo-clr-drop-indicator').trim() : '';
				if (!_accent) { _accent = '#8a7259'; }
				indicator.style.background = 'linear-gradient(to right, transparent,'
					+ _accent + ' 15%,' + _accent + ' 85%, transparent)';
				indicator.style.boxShadow = '0 0 6px ' + _accent;
				document.body.appendChild(indicator);
				drag.indicator = indicator;

				row.classList.add('atfrfo-row-dragging');
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
				var _editSpace = document.getElementById('atfrfo-edit-space');
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

				var targetRow = el ? el.closest('.atfrfo-color-row') : null;

				// If no row found, check if cursor is over a collapsed category block.
				// Expand it immediately and re-probe so the indicator appears on the
				// same mouse event (no one-event lag).
				if (!targetRow && el) {
					var hoverBlock = el.closest('.atfrfo-category-block');
					if (hoverBlock && hoverBlock.getAttribute('data-collapsed') === 'true') {
						hoverBlock.setAttribute('data-collapsed', 'false');
						drag.ghost.style.display = 'none';
						var el2 = document.elementFromPoint(e.clientX, e.clientY);
						drag.ghost.style.display = '';
						var newRow = el2 ? el2.closest('.atfrfo-color-row') : null;
						if (newRow) { targetRow = newRow; }
					}
				}

				// Cursor over an expanded block but not on a row → append to its end.
				if (!targetRow && el) {
					var hoverBlock2 = el.closest('.atfrfo-category-block');
					if (hoverBlock2 && hoverBlock2.getAttribute('data-collapsed') === 'false') {
						var blockRows = hoverBlock2.querySelectorAll('.atfrfo-color-row:not(.atfrfo-row-dragging)');
						if (blockRows.length > 0) {
							targetRow = blockRows[blockRows.length - 1];
							drag._forceAfter = true;
						} else {
							// Empty category — show indicator in the list body.
							var emptyBody = hoverBlock2.querySelector('.atfrfo-color-list');
							if (emptyBody) {
								var er = emptyBody.getBoundingClientRect();
								drag.indicator.style.display    = 'block';
								drag.indicator.style.top        = (er.top + er.height / 2 - 2) + 'px';
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
					drag.indicator.style.top       = (before ? rect.top : rect.bottom) - 2 + 'px';
					drag.indicator.style.left      = rect.left + 'px';
					drag.indicator.style.width     = rect.width + 'px';
					drag.indicator._targetVarId    = targetRow.getAttribute('data-var-id');
					drag.indicator._insertBefore   = before;
					drag.indicator._targetCatBlock = targetRow.closest('.atfrfo-category-block');
				} else {
					if (!el || !el.closest('.atfrfo-category-block')) {
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

				var draggingRow = container.querySelector('.atfrfo-color-row.atfrfo-row-dragging');
				if (draggingRow) { draggingRow.classList.remove('atfrfo-row-dragging'); }

				drag.ghost     = null;
				drag.indicator = null;
				drag.active    = false;

				if (!targetVarId || !drag.varId) { drag.varId = null; return; }

				var draggedVarId  = drag.varId;
				var savedScroll   = drag.startScroll;
				drag.varId = null;

				onDrop(draggedVarId, targetVarId, insertBefore, targetCatBlock);

				// Restore scroll to where it was before the drag started,
				// but only if it actually moved during the drag.
				var _es = document.getElementById('atfrfo-edit-space');
				if (_es && _es.scrollTop !== savedScroll) {
					_es.scrollTop = savedScroll;
				}
			});
		},

	};

	// -----------------------------------------------------------------------
	// CORE APP API
	// -----------------------------------------------------------------------

	ATFRFO.App = {

		/**
		 * Set or clear the unsaved-changes flag and update the Save Changes button.
		 *
		 * @param {boolean} isDirty
		 */
		setDirty: function (isDirty) {
			ATFRFO.state.hasUnsavedChanges = isDirty;
			if (ATFRFO.PanelRight) {
				ATFRFO.PanelRight.updateSaveChangesBtn();
			}
			var saveBtn = document.getElementById('atfrfo-btn-save-changes');
			if (saveBtn) { saveBtn.classList.toggle('has-changes', !!isDirty); }
		},

		/**
		 * Set or clear the pending Elementor commit flag and update the Commit button.
		 * Also highlights the Sync button with accent color when changes are pending.
		 *
		 * @param {boolean} hasPending
		 */
		setPendingCommit: function (hasPending) {
			ATFRFO.state.hasPendingElementorCommit = hasPending;
			if (ATFRFO.PanelRight) {
				ATFRFO.PanelRight.updateCommitBtn();
			}
		},

		/**
		 * Re-calculate counts from state and update the right panel display.
		 */
		refreshCounts: function () {
			var counts = {
				variables:  ATFRFO.state.variables.filter(function (v) { return v.status !== 'deleted'; }).length,
				classes:    ATFRFO.state.classes.length,
				components: ATFRFO.state.components.length,
			};
			if (ATFRFO.PanelRight) {
				ATFRFO.PanelRight.updateCounts(counts);
			}
		},

		/**
		 * Perform a generic AJAX request to an ATFRFO endpoint.
		 *
		 * @param {string} action  WordPress AJAX action name.
		 * @param {Object} data    Additional POST data (excluding action/nonce).
		 * @returns {Promise<Object>} Parsed JSON response.
		 */
		ajax: function (action, data) {
			if (typeof ATFRFOData === 'undefined') {
				return Promise.reject(new Error('ATFRFOData not available'));
			}

			var body = Object.assign({ action: action, nonce: ATFRFOData.nonce }, data || {});

			return fetch(ATFRFOData.ajaxUrl, {
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
		 * Results are stored in ATFRFO.state.usageCounts and the current edit view
		 * is refreshed if a category is already loaded.
		 *
		 * @returns {Promise}
		 */
		fetchUsageCounts: function () {
			var names = ATFRFO.state.variables.map(function (v) { return v.name; });
			if (names.length === 0) {
				return Promise.resolve();
			}

			return ATFRFO.App.ajax('atfrfo_get_usage_counts', {
				variable_names: JSON.stringify(names),
			}).then(function (res) {
				if (res.success) {
					ATFRFO.state.usageCounts = res.data.counts || {};
					// Re-render the current category view to show updated badges
					if (ATFRFO.state.currentSelection && ATFRFO.EditSpace) {
						ATFRFO.EditSpace.loadCategory(ATFRFO.state.currentSelection);
					}
				}
			}).catch(function () {
				// Non-critical — usage counts are best-effort
			});
		},

		/**
		 * Apply accessibility/UI preferences from saved settings to #atfrfo-app.
		 * Sets data attributes that drive CSS overrides in atfrfo-preferences.css.
		 * Call on startup after settings load, and after any preference change.
		 *
		 * @param {Object} settings  Saved settings object.
		 */
		applyA11y: function (settings) {
			var app = document.getElementById('atfrfo-app');
			if (!app || !settings) { return; }

			// Font size: treat absent attribute as the default size (16px), matching
			// both the base CSS (atfrfo-preferences.css has no override rule for 16) and
			// ATFRFO_Settings::$defaults['ui_font_size'] (see tech debt C-04, fixed 2026-08-02).
			var fs = parseInt(settings.ui_font_size, 10) || 16;
			if (fs !== 16) {
				app.setAttribute('data-atfrfo-font-size', String(fs));
			} else {
				app.removeAttribute('data-atfrfo-font-size');
			}

			// Color contrast
			if (settings.ui_contrast === 'high') {
				app.setAttribute('data-atfrfo-contrast', 'high');
			} else {
				app.removeAttribute('data-atfrfo-contrast');
			}

			// Button size
			if (settings.ui_btn_size && settings.ui_btn_size !== 'normal') {
				app.setAttribute('data-atfrfo-btn-size', settings.ui_btn_size);
			} else {
				app.removeAttribute('data-atfrfo-btn-size');
			}

			// Button contrast
			if (settings.ui_btn_contrast === 'high') {
				app.setAttribute('data-atfrfo-btn-contrast', 'high');
			} else {
				app.removeAttribute('data-atfrfo-btn-contrast');
			}

			// Layout density
			if (settings.layout_density && settings.layout_density !== 'normal') {
				app.setAttribute('data-atfrfo-density', settings.layout_density);
			} else {
				app.removeAttribute('data-atfrfo-density');
			}

			// Reduced motion
			if (settings.reduced_motion) {
				app.setAttribute('data-atfrfo-motion', 'reduced');
			} else {
				app.removeAttribute('data-atfrfo-motion');
			}

			// Tooltip state — sync to PanelTop
			if (ATFRFO.PanelTop) {
				if (typeof settings.show_tooltips !== 'undefined') {
					ATFRFO.PanelTop._showTooltips = !!settings.show_tooltips;
				}
				if (typeof settings.extended_tooltips !== 'undefined') {
					ATFRFO.PanelTop._extendedTooltips = !!settings.extended_tooltips;
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
			ATFRFO.state.pendingSaveCount = Math.max(0, ATFRFO.state.pendingSaveCount - 1);
			if (ATFRFO.PanelRight) {
				ATFRFO.PanelRight.updateSaveChangesBtn();
			}
		},

		/**
		 * Load the project config from WordPress (defaults + saved config).
		 */
		loadConfig: function () {
			return ATFRFO.App.ajax('atfrfo_get_config', {})
				.then(function (res) {
					if (res.success && res.data.config) {
						var cfg = res.data.config;

						// Normalize defaults: groups.Variables.* string arrays → category object arrays.
						// atfrfo-defaults.json stores ["Spacing","Gaps",...] but _getCatsForSet expects
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

						ATFRFO.state.config = cfg;
						// globalConfig and config point to the same object reference here. config is
						// replaced when _loadFile() assigns res.data.data.config, so after a project
						// loads the two fields diverge. globalConfig is used as an immutable baseline
						// to backfill missing category arrays on older project files.
						// Risk (tech debt A-02): any mutation of ATFRFO.state.config before a file loads
						// also mutates globalConfig — fix by deep-cloning: JSON.parse(JSON.stringify(cfg)).
						ATFRFO.state.globalConfig = cfg;
						if (cfg.projectName) {
							ATFRFO.state.projectName = cfg.projectName;
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
	// These objects are passed to ATFRFO.Variables.initSet() after ATFRFO.Variables
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
		// data compatibility with saved .atfrfo.json files.
		function _formatLabel(t) {
			if (t === '')   { return '\u2014'; }   // — em dash: unitless / no suffix
			if (t === 'FX') { return 'f\u2093'; }  // fₓ subscript-x
			return t;
		}
		var html = '<select class="atfrfo-var-format-sel" aria-label="Format">';
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
	 * Col 3: "ABCabc" font-preview cell rendered in the variable's own font-family.
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
			return '<span class="atfrfo-font-preview"'
				+ ' style="font-family:' + _varEsc(v.value) + '"'
				+ ' aria-hidden="true"'
				+ ' data-atfrfo-tooltip="Font preview">ABCabc</span>';
		},

		renderValueCell: function (v) {
			return '<input type="text" class="atfrfo-var-value-input"'
				+ ' value="' + _varEsc(v.value) + '"'
				+ ' data-original="' + _varEsc(v.value) + '"'
				+ ' style="font-family:' + _varEsc(v.value) + '"'
				+ ' spellcheck="false"'
				+ ' aria-label="Font family"'
				+ ' data-atfrfo-tooltip="Font family \u2014 edit directly"'
				+ ' data-atfrfo-tooltip-long="CSS font-family value \u2014 changes the font used for this variable">'
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
			return '<input type="text" class="atfrfo-var-value-input"'
				+ ' value="' + _varEsc(v.value) + '"'
				+ ' data-original="' + _varEsc(v.value) + '"'
				+ ' spellcheck="false"'
				+ ' aria-label="Value"'
				+ ' data-atfrfo-tooltip="Numeric value \u2014 enter number only"'
				+ ' data-atfrfo-tooltip-long="Enter a plain number (e.g. 1.5, 16, 100). Add a type suffix on Enter to change unit (e.g. 16px, 1.5rem, 100pc).">'
				+ _varFormatSelect(v.format, this.valueTypes);
		},
	};

	// -----------------------------------------------------------------------
	// INITIALIZATION (DOM ready)
	// -----------------------------------------------------------------------

	document.addEventListener('DOMContentLoaded', function () {

		// 1. Theme (reads data-atfrfo-theme attribute set by PHP — no AJAX needed)
		if (ATFRFO.Theme) {
			ATFRFO.Theme.init();
		}

		// 2. Modal system (must be ready before any button opens a modal)
		if (ATFRFO.Modal) {
			ATFRFO.Modal.init();
		}

		// 3. Right panel (file management + counts)
		if (ATFRFO.PanelRight) {
			ATFRFO.PanelRight.init();
		}

		// 4. Edit space (center content)
		if (ATFRFO.EditSpace) {
			ATFRFO.EditSpace.init();
		}

		// 4b. Colors module — intercepts EditSpace for Colors subgroup.
		if (ATFRFO.Colors) {
			ATFRFO.Colors.init();
		}

		// 4c. Fonts and Numbers — generic variable-set instances.
		if (ATFRFO.Variables) {
			ATFRFO.Variables.initSet(FONTS_CFG);
			ATFRFO.Variables.initSet(NUMBERS_CFG);
		}

		// 4d. Classes — intercepts EditSpace for the Classes group (Phase 3.2).
		if (ATFRFO.Classes) {
			ATFRFO.Classes.init();
		}

		// 5. Top bar (buttons + tooltips — needs Modal to be ready)
		if (ATFRFO.Print) {
			ATFRFO.Print.init();
		}
		if (ATFRFO.PanelTop) {
			ATFRFO.PanelTop.init();
			// Auto-sync from Elementor on page load (silent — no modal, no dirty flag).
			ATFRFO.PanelTop._syncFromElementor({ silent: true });
		}

		// 6. Load project config, then init left panel and auto-load last file.
		ATFRFO.App.loadConfig().then(function () {
			// NOTE: _ensureUncategorized() is NOT called here. Calling it before a
			// file loads would pollute the global config with a Phase 2 categories
			// array containing only Uncategorized, causing the left panel to enter
			// Phase 2 mode and hide the v1 group items. It is called instead inside
			// loadColors() after the file's config is already in ATFRFO.state.
			if (ATFRFO.PanelLeft) {
				ATFRFO.PanelLeft.init();
			}

			// Notify sign reads #atfrfo-edit-space's rendered left edge, which
			// shifts with the left panel's width — must run after
			// PanelLeft.init() has restored any persisted collapsed state.
			if (ATFRFO.Notify) {
				ATFRFO.Notify.init();
			}

			// Auto-load last used file and cache settings.
			// Tech debt DP-05: ATFRFO.PanelTop.init() (called above) also fires atfrfo_get_settings
			// to load tooltip preferences. Two identical HTTP requests go to admin-ajax.php
			// within ~100ms of each other on every page load. Fix: make one call here, then
			// pass the settings object to ATFRFO.PanelTop._applyTooltipSettings(settings).
			ATFRFO.App.ajax('atfrfo_get_settings', {}).then(function (res) {
				if (res.success && res.data && res.data.settings) {
					ATFRFO.state.settings = res.data.settings;
					ATFRFO.App.applyA11y(res.data.settings);
				}
				var lf = res.success && res.data && res.data.settings && res.data.settings.last_file;
				if (lf && ATFRFO.PanelRight) {
					ATFRFO.PanelRight._autoLoadFile(lf);
				}
			}).catch(function () {});
		});

		// 7. Initial counts (all zero until a file is loaded)
		ATFRFO.App.refreshCounts();

		// 8. Warn on page unload with unsaved or uncommitted changes
		window.addEventListener('beforeunload', function (e) {
			if (ATFRFO.state.hasUnsavedChanges) {
				var msg = 'You have unsaved changes. Leave anyway?';
				e.preventDefault();
				e.returnValue = msg;
				return msg;
			}
		});
	});

}());
