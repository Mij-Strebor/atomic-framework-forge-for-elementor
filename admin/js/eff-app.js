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
		hasUnsavedChanges: false,
		currentSelection:  null,
		currentFile:       null,
		theme:             (typeof EFFData !== 'undefined' ? EFFData.theme : 'light') || 'light',
		variables:         [],
		classes:           [],
		components:        [],
		config:            {},
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
		 * Load the project config from WordPress (defaults + saved config).
		 */
		loadConfig: function () {
			return EFF.App.ajax('eff_get_config', {})
				.then(function (res) {
					if (res.success && res.data.config) {
						EFF.state.config = res.data.config;
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

		// 5. Top bar (buttons + tooltips — needs Modal to be ready)
		if (EFF.PanelTop) {
			EFF.PanelTop.init();
		}

		// 6. Load project config, then init left panel
		EFF.App.loadConfig().then(function () {
			if (EFF.PanelLeft) {
				EFF.PanelLeft.init();
			}
		});

		// 7. Initial counts (all zero until a file is loaded)
		EFF.App.refreshCounts();

		// 8. Warn on page unload with unsaved changes
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
