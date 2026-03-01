/**
 * EFF Panel Right — File Management and Asset Counts
 *
 * Manages:
 *  - Storage file name input
 *  - Load / Save file buttons
 *  - Save Changes button (inactive/active state driven by EFF.state.hasUnsavedChanges)
 *  - Live asset count display (variables, classes, components)
 *
 * @package ElementorFrameworkForge
 */

/* global EFFData */
(function () {
	'use strict';

	window.EFF = window.EFF || {};

	EFF.PanelRight = {

		/** @type {HTMLInputElement|null} */
		_filenameInput: null,
		/** @type {HTMLElement|null} */
		_loadBtn: null,
		/** @type {HTMLElement|null} */
		_saveBtn: null,
		/** @type {HTMLElement|null} */
		_saveChangesBtn: null,

		/**
		 * Initialize the right panel.
		 */
		init: function () {
			this._filenameInput  = document.getElementById('eff-filename');
			this._loadBtn        = document.getElementById('eff-btn-load');
			this._saveBtn        = document.getElementById('eff-btn-save');
			this._saveChangesBtn = document.getElementById('eff-btn-save-changes');

			this._bindLoadBtn();
			this._bindSaveBtn();
			this._bindSaveChangesBtn();
		},

		// ------------------------------------------------------------------
		// LOAD FILE
		// ------------------------------------------------------------------

		_bindLoadBtn: function () {
			if (!this._loadBtn) {
				return;
			}

			this._loadBtn.addEventListener('click', function () {
				var filename = this._getFilename();
				if (!filename) {
					// Open a prompt-style modal to enter the filename
					EFF.Modal.open({
						title: 'Load file',
						body:  this._buildLoadModalBody(),
					});
					return;
				}
				this._loadFile(filename);
			}.bind(this));
		},

		/**
		 * @returns {string} HTML for the load filename modal.
		 * @private
		 */
		_buildLoadModalBody: function () {
			return '<p class="eff-text-muted" style="margin-bottom:12px">Enter the filename to load from the EFF storage directory.</p>'
				+ '<input type="text" class="eff-field-input" id="eff-modal-filename-input" '
				+ 'placeholder="e.g., my-project.eff.json" autocomplete="off" />'
				+ '<div style="margin-top:16px;display:flex;justify-content:flex-end;gap:8px">'
				+ '<button class="eff-btn" id="eff-modal-load-confirm">Load</button>'
				+ '</div>';
		},

		/**
		 * Execute an AJAX load for the given filename.
		 *
		 * @param {string} filename
		 */
		_loadFile: function (filename) {
			EFF.App.ajax('eff_load_file', { filename: filename })
				.then(function (res) {
					if (res.success) {
						// Populate state from loaded data
						EFF.state.variables  = res.data.data.variables  || [];
						EFF.state.classes    = res.data.data.classes    || [];
						EFF.state.components = res.data.data.components || [];
						EFF.state.config     = res.data.data.config     || {};
						EFF.state.currentFile = filename;

						if (this._filenameInput) {
							this._filenameInput.value = res.data.filename;
						}

						// Refresh counts and nav
						EFF.App.refreshCounts();
						if (EFF.PanelLeft) {
							EFF.PanelLeft.refresh();
						}

						EFF.App.setDirty(false);
						EFF.Modal.close();
					} else {
						alert('Load error: ' + (res.data.message || 'Unknown error.'));
					}
				}.bind(this))
				.catch(function () {
					alert('Network error while loading file.');
				});
		},

		// ------------------------------------------------------------------
		// SAVE FILE
		// ------------------------------------------------------------------

		_bindSaveBtn: function () {
			if (!this._saveBtn) {
				return;
			}

			this._saveBtn.addEventListener('click', function () {
				var filename = this._getFilename();
				if (!filename) {
					alert('Please enter a filename before saving.');
					if (this._filenameInput) {
						this._filenameInput.focus();
					}
					return;
				}
				this._saveFile(filename);
			}.bind(this));
		},

		/**
		 * Execute an AJAX save for the given filename.
		 *
		 * @param {string} filename
		 */
		_saveFile: function (filename) {
			var data = {
				version:    '1.0',
				config:     EFF.state.config,
				variables:  EFF.state.variables,
				classes:    EFF.state.classes,
				components: EFF.state.components,
			};

			EFF.App.ajax('eff_save_file', {
				filename: filename,
				data:     JSON.stringify(data),
			})
				.then(function (res) {
					if (res.success) {
						EFF.state.currentFile = res.data.filename;
						if (this._filenameInput) {
							this._filenameInput.value = res.data.filename;
						}
						EFF.App.setDirty(false);
					} else {
						alert('Save error: ' + (res.data.message || 'Unknown error.'));
					}
				}.bind(this))
				.catch(function () {
					alert('Network error while saving file.');
				});
		},

		// ------------------------------------------------------------------
		// SAVE CHANGES BUTTON
		// ------------------------------------------------------------------

		_bindSaveChangesBtn: function () {
			if (!this._saveChangesBtn) {
				return;
			}

			this._saveChangesBtn.addEventListener('click', function () {
				if (EFF.state.hasUnsavedChanges) {
					var filename = this._getFilename() || EFF.state.currentFile;
					if (filename) {
						this._saveFile(filename);
					}
				}
			}.bind(this));
		},

		/**
		 * Update the Save Changes button active/inactive state.
		 * Called whenever EFF.state.hasUnsavedChanges changes.
		 */
		updateSaveChangesBtn: function () {
			if (!this._saveChangesBtn) {
				return;
			}

			var isDirty = EFF.state.hasUnsavedChanges;

			this._saveChangesBtn.disabled         = !isDirty;
			this._saveChangesBtn.setAttribute('aria-disabled', String(!isDirty));
		},

		// ------------------------------------------------------------------
		// COUNTS
		// ------------------------------------------------------------------

		/**
		 * Update the displayed asset counts.
		 *
		 * @param {{ variables: number, classes: number, components: number }} counts
		 */
		updateCounts: function (counts) {
			this._setCount('eff-count-variables',  counts.variables  || 0);
			this._setCount('eff-count-classes',    counts.classes    || 0);
			this._setCount('eff-count-components', counts.components || 0);
		},

		/**
		 * @param {string} id    Element ID.
		 * @param {number} value Count value.
		 * @private
		 */
		_setCount: function (id, value) {
			var el = document.getElementById(id);
			if (el) {
				el.textContent = String(value);
			}
		},

		// ------------------------------------------------------------------
		// HELPERS
		// ------------------------------------------------------------------

		/**
		 * Get the current filename input value, trimmed.
		 *
		 * @returns {string}
		 */
		_getFilename: function () {
			if (!this._filenameInput) {
				return '';
			}
			return this._filenameInput.value.trim();
		},
	};
}());
