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
		currentSelection:         null,
		currentFile:              null,
		projectName:              '',   // Human-readable project name (set via Manage Project modal).
		theme:                    (typeof EFFData !== 'undefined' ? EFFData.theme : 'light') || 'light',
		variables:                [],
		classes:                  [],
		components:               [],
		config:                   {},
		usageCounts:              {}, // { '--varname': count } — populated by fetchUsageCounts()
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
		 * Load the project config from WordPress (defaults + saved config).
		 */
		loadConfig: function () {
			return EFF.App.ajax('eff_get_config', {})
				.then(function (res) {
					if (res.success && res.data.config) {
						EFF.state.config = res.data.config;
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

		// 4b. Colors module (Phase 2) — intercepts EditSpace for Colors subgroup.
		if (EFF.Colors) {
			EFF.Colors.init();
		}

		// 5. Top bar (buttons + tooltips — needs Modal to be ready)
		if (EFF.PanelTop) {
			EFF.PanelTop.init();
			// Auto-sync from Elementor on page load (silent — no modal, no dirty flag).
			EFF.PanelTop._syncFromElementor({ silent: true });
		}

		// 6. Load project config, then init left panel
		EFF.App.loadConfig().then(function () {
			if (EFF.Colors && EFF.Colors._ensureUncategorized) { EFF.Colors._ensureUncategorized(); }
			if (EFF.PanelLeft) {
				EFF.PanelLeft.init();
			}
		});

		// 7. Initial counts (all zero until a file is loaded)
		EFF.App.refreshCounts();

		// Title fade — fades the brand name as the center edit space scrolls,
		// keeping the top bar compact with just the action buttons visible.
		// The body never scrolls (panels scroll internally), so we listen on
		// the edit content container rather than window.
		(function () {
			var brandName   = document.querySelector('.eff-brand-name');
			var editContent = document.getElementById('eff-edit-content');
			if (brandName && editContent) {
				editContent.addEventListener('scroll', function () {
					var y = editContent.scrollTop;
					brandName.style.opacity = String(Math.max(0, 1 - y / 80));
				}, { passive: true });
			}
		}());

		// 8. Warn on page unload with unsaved or uncommitted changes
		window.addEventListener('beforeunload', function (e) {
			if (EFF.state.hasUnsavedChanges || EFF.state.hasPendingElementorCommit) {
				var msg = EFF.state.hasPendingElementorCommit
					? 'You have unsynced changes not yet committed to Elementor. Leave anyway?'
					: 'You have unsaved changes. Leave anyway?';
				e.preventDefault();
				e.returnValue = msg;
				return msg;
			}
		});
	});

}());
