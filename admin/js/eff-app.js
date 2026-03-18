/**
 * EFF App — Main Application Entry Point
 *
 * Initializes all modules in the correct order and manages global
 * application state. All modules attach themselves to window.EFF before
 * this file runs (enforced by enqueue dependency chain in PHP).
 *
 * Global state object: EFF.state
 *  - hasUnsavedChanges {boolean}  — drives Save Changes button state
 *  - currentSelection  {Object}   — { group, subgroup, category }
 *  - currentFile       {string}   — currently loaded filename
 *  - theme             {string}   — 'light' | 'dark'
 *  - variables         {Array}    — loaded variable objects
 *  - classes           {Array}    — loaded class objects
 *  - components        {Array}    — loaded component objects
 *  - config            {Object}   — project config (subgroup definitions)
 *
 * @package ElementorFrameworkForge
 */

/* global EFFData */
(function () {
	'use strict';

	window.EFF = window.EFF || {};

	// -----------------------------------------------------------------------
	// GLOBAL STATE
	// -----------------------------------------------------------------------

	EFF.state = {
		hasUnsavedChanges:        false, // EFF file has unsaved changes (drives Save Changes button).
		hasPendingElementorCommit: false, // EFF data not yet committed to Elementor (drives Commit button).
		pendingSaveCount:         0,     // Number of in-flight per-variable AJAX saves (blocks file save).
		currentSelection:         null,
		currentFile:              null,
		projectName:              '',   // Human-readable project name (set via Manage Project modal).
		theme:                    (typeof EFFData !== 'undefined' ? EFFData.theme : 'light') || 'light',
		variables:                [],
		classes:                  [],
		components:               [],
		config:                   {},
		usageCounts:              {}, // { '--varname': count } — populated by fetchUsageCounts()
		settings:                 {}, // cached from eff_get_settings on startup
	};

	// -----------------------------------------------------------------------
	// CORE APP API
	// -----------------------------------------------------------------------

	EFF.App = {

		/**
		 * Set or clear the unsaved-changes flag and update the Save Changes button.
		 *
		 * @param {boolean} isDirty
		 */
		setDirty: function (isDirty) {
			EFF.state.hasUnsavedChanges = isDirty;
			if (EFF.PanelRight) {
				EFF.PanelRight.updateSaveChangesBtn();
			}
			var saveBtn = document.getElementById('eff-btn-save-changes');
			if (saveBtn) { saveBtn.classList.toggle('has-changes', !!isDirty); }
		},

		/**
		 * Set or clear the pending Elementor commit flag and update the Commit button.
		 * Also highlights the Sync button with accent color when changes are pending.
		 *
		 * @param {boolean} hasPending
		 */
		setPendingCommit: function (hasPending) {
			EFF.state.hasPendingElementorCommit = hasPending;
			if (EFF.PanelRight) {
				EFF.PanelRight.updateCommitBtn();
			}
			var syncBtn = document.getElementById('eff-btn-sync');
			if (syncBtn) {
				if (hasPending) {
					syncBtn.classList.add('eff-btn--accent');
				} else {
					syncBtn.classList.remove('eff-btn--accent');
				}
			}
		},

		/**
		 * Re-calculate counts from state and update the right panel display.
		 */
		refreshCounts: function () {
			var counts = {
				variables:  EFF.state.variables.length,
				classes:    EFF.state.classes.length,
				components: EFF.state.components.length,
			};
			if (EFF.PanelRight) {
				EFF.PanelRight.updateCounts(counts);
			}
		},

		/**
		 * Perform a generic AJAX request to an EFF endpoint.
		 *
		 * @param {string} action  WordPress AJAX action name.
		 * @param {Object} data    Additional POST data (excluding action/nonce).
		 * @returns {Promise<Object>} Parsed JSON response.
		 */
		ajax: function (action, data) {
			if (typeof EFFData === 'undefined') {
				return Promise.reject(new Error('EFFData not available'));
			}

			var body = Object.assign({ action: action, nonce: EFFData.nonce }, data || {});

			return fetch(EFFData.ajaxUrl, {
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
		 * Results are stored in EFF.state.usageCounts and the current edit view
		 * is refreshed if a category is already loaded.
		 *
		 * @returns {Promise}
		 */
		fetchUsageCounts: function () {
			var names = EFF.state.variables.map(function (v) { return v.name; });
			if (names.length === 0) {
				return Promise.resolve();
			}

			return EFF.App.ajax('eff_get_usage_counts', {
				variable_names: JSON.stringify(names),
			}).then(function (res) {
				if (res.success) {
					EFF.state.usageCounts = res.data.counts || {};
					// Re-render the current category view to show updated badges
					if (EFF.state.currentSelection && EFF.EditSpace) {
						EFF.EditSpace.loadCategory(EFF.state.currentSelection);
					}
				}
			}).catch(function () {
				// Non-critical — usage counts are best-effort
			});
		},

		/**
		 * Decrement pendingSaveCount and refresh the Save Changes button.
		 *
		 * Called in the .then() and .catch() of every per-variable AJAX save so
		 * the Save Changes button reflects in-flight state correctly.
		 */
		flushPending: function () {
			EFF.state.pendingSaveCount = Math.max(0, EFF.state.pendingSaveCount - 1);
			if (EFF.PanelRight) {
				EFF.PanelRight.updateSaveChangesBtn();
			}
		},

		/**
		 * Load the project config from WordPress (defaults + saved config).
		 */
		loadConfig: function () {
			return EFF.App.ajax('eff_get_config', {})
				.then(function (res) {
					if (res.success && res.data.config) {
						EFF.state.config = res.data.config;
						EFF.state.globalConfig = res.data.config;
						if (res.data.config.projectName) {
							EFF.state.projectName = res.data.config.projectName;
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
	// These objects are passed to EFF.Variables.initSet() after EFF.Variables
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
		var html = '<select class="eff-var-format-sel" aria-label="Format">';
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
		newVarDefaults:  { name: '--new-font', value: 'sans-serif', format: 'System' },

		renderPreviewCell: function (v) {
			return '<span class="eff-font-preview"'
				+ ' style="font-family:' + _varEsc(v.value) + '"'
				+ ' aria-hidden="true"'
				+ ' data-eff-tooltip="Font preview">Aa</span>';
		},

		renderValueCell: function (v) {
			return '<input type="text" class="eff-var-value-input"'
				+ ' value="' + _varEsc(v.value) + '"'
				+ ' data-original="' + _varEsc(v.value) + '"'
				+ ' style="font-family:' + _varEsc(v.value) + '"'
				+ ' spellcheck="false"'
				+ ' aria-label="Font family"'
				+ ' data-eff-tooltip="Font family \u2014 edit directly"'
				+ ' data-eff-tooltip-long="CSS font-family value \u2014 changes the font used for this variable">'
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
		newVarDefaults:  { name: '--new-number', value: '1rem', format: 'REM' },

		renderPreviewCell: null, // Numbers has no preview column.

		renderValueCell: function (v) {
			return '<input type="text" class="eff-var-value-input"'
				+ ' value="' + _varEsc(v.value) + '"'
				+ ' data-original="' + _varEsc(v.value) + '"'
				+ ' spellcheck="false"'
				+ ' aria-label="Value"'
				+ ' data-eff-tooltip="Value \u2014 edit directly"'
				+ ' data-eff-tooltip-long="CSS value \u2014 include the unit (e.g. 1.5rem, 16px)">'
				+ _varFormatSelect(v.format, this.valueTypes);
		},
	};

	// -----------------------------------------------------------------------
	// INITIALIZATION (DOM ready)
	// -----------------------------------------------------------------------

	document.addEventListener('DOMContentLoaded', function () {

		// 1. Theme (reads data-eff-theme attribute set by PHP — no AJAX needed)
		if (EFF.Theme) {
			EFF.Theme.init();
		}

		// 2. Modal system (must be ready before any button opens a modal)
		if (EFF.Modal) {
			EFF.Modal.init();
		}

		// 3. Right panel (file management + counts)
		if (EFF.PanelRight) {
			EFF.PanelRight.init();
		}

		// 4. Edit space (center content)
		if (EFF.EditSpace) {
			EFF.EditSpace.init();
		}

		// 4b. Colors module — intercepts EditSpace for Colors subgroup.
		if (EFF.Colors) {
			EFF.Colors.init();
		}

		// 4c. Fonts and Numbers — generic variable-set instances.
		if (EFF.Variables) {
			EFF.Variables.initSet(FONTS_CFG);
			EFF.Variables.initSet(NUMBERS_CFG);
		}

		// 5. Top bar (buttons + tooltips — needs Modal to be ready)
		if (EFF.PanelTop) {
			EFF.PanelTop.init();
			// Auto-sync from Elementor on page load (silent — no modal, no dirty flag).
			EFF.PanelTop._syncFromElementor({ silent: true });
		}

		// 6. Load project config, then init left panel and auto-load last file.
		EFF.App.loadConfig().then(function () {
			// NOTE: _ensureUncategorized() is NOT called here. Calling it before a
			// file loads would pollute the global config with a Phase 2 categories
			// array containing only Uncategorized, causing the left panel to enter
			// Phase 2 mode and hide the v1 group items. It is called instead inside
			// loadColors() after the file's config is already in EFF.state.
			if (EFF.PanelLeft) {
				EFF.PanelLeft.init();
			}

			// Auto-load last used file and cache settings.
			EFF.App.ajax('eff_get_settings', {}).then(function (res) {
				if (res.success && res.data && res.data.settings) {
					EFF.state.settings = res.data.settings;
				}
				var lf = res.success && res.data && res.data.settings && res.data.settings.last_file;
				if (lf && EFF.PanelRight) {
					EFF.PanelRight._autoLoadFile(lf);
				}
			}).catch(function () {});
		});

		// 7. Initial counts (all zero until a file is loaded)
		EFF.App.refreshCounts();

		// Title fade — fades the brand name as the center edit space scrolls,
		// keeping the top bar compact with just the action buttons visible.
		// #eff-edit-space is the scroll container (overflow-y: auto); its child
		// #eff-edit-content has no overflow of its own.
		(function () {
			var brandName  = document.querySelector('.eff-brand-name');
			var editSpace  = document.getElementById('eff-edit-space');
			if (brandName && editSpace) {
				editSpace.addEventListener('scroll', function () {
					var y = editSpace.scrollTop;
					brandName.style.opacity = String(Math.max(0, 1 - y / 80));
				}, { passive: true });
			}
		}());

		// 8. Warn on page unload with unsaved or uncommitted changes
		window.addEventListener('beforeunload', function (e) {
			if (EFF.state.hasUnsavedChanges) {
				var msg = 'You have unsaved changes. Leave anyway?';
				e.preventDefault();
				e.returnValue = msg;
				return msg;
			}
		});
	});

}());
