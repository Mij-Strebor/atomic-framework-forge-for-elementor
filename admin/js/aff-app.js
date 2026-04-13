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

			// Font size (attribute absent = default 16px)
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
		var html = '<select class="aff-var-format-sel" aria-label="Format">';
		for (var i = 0; i < types.length; i++) {
			html += '<option value="' + _varEsc(types[i]) + '"'
				+ (types[i] === current ? ' selected' : '')
				+ '>' + _varEsc(types[i]) + '</option>';
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
	 * Format: PX | % | EM | REM | VW | VH | CH | FX
	 */
	var NUMBERS_CFG = {
		setName:         'Numbers',
		catKey:          'numberCategories',
		showExpandPanel: false,
		valueTypes:      ['PX', '%', 'EM', 'REM', 'VW', 'VH', 'CH', 'FX'],
		newVarDefaults:  { name: 'new-number', value: '1rem', format: 'REM' },

		renderPreviewCell: null, // Numbers has no preview column.

		renderValueCell: function (v) {
			return '<input type="text" class="aff-var-value-input"'
				+ ' value="' + _varEsc(v.value) + '"'
				+ ' data-original="' + _varEsc(v.value) + '"'
				+ ' spellcheck="false"'
				+ ' aria-label="Value"'
				+ ' data-aff-tooltip="Value \u2014 edit directly"'
				+ ' data-aff-tooltip-long="CSS value \u2014 include the unit (e.g. 1.5rem, 16px)">'
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
