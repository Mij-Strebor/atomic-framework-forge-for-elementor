/**
 * EFF Panel Top — Top Menu Bar Buttons, Tooltips, and Modal Launchers
 *
 * Manages:
 *  - Tooltip display (CSS-driven, 300ms delay)
 *  - All top menu bar button click handlers
 *  - Modal content builders for each top-bar action
 *
 * @package ElementorFrameworkForge
 */

/* global EFFData */
(function () {
	'use strict';

	window.EFF = window.EFF || {};

	EFF.PanelTop = {

		/** @type {HTMLElement|null} */
		_tooltip: null,
		/** @type {number|null} */
		_tooltipTimer: null,

		/**
		 * Initialize all top bar interactions.
		 */
		init: function () {
			this._tooltip = document.getElementById('eff-tooltip');

			this._bindTooltips();
			this._bindButtons();
		},

		// ------------------------------------------------------------------
		// TOOLTIPS (CSS-driven positioning, 300ms delay)
		// ------------------------------------------------------------------

		/**
		 * Bind tooltip show/hide to all elements with [data-eff-tooltip].
		 */
		_bindTooltips: function () {
			var self = this;

			document.querySelectorAll('[data-eff-tooltip]').forEach(function (el) {
				el.addEventListener('mouseenter', function () {
					self._showTooltip(el);
				});

				el.addEventListener('mouseleave', function () {
					self._hideTooltip();
				});

				el.addEventListener('focus', function () {
					self._showTooltip(el);
				});

				el.addEventListener('blur', function () {
					self._hideTooltip();
				});
			});
		},

		/**
		 * Show tooltip after 300ms delay.
		 *
		 * @param {HTMLElement} anchor The element being hovered.
		 * @private
		 */
		_showTooltip: function (anchor) {
			var self = this;
			var text = anchor.getAttribute('data-eff-tooltip');

			if (!text || !this._tooltip) {
				return;
			}

			clearTimeout(this._tooltipTimer);

			this._tooltipTimer = setTimeout(function () {
				self._tooltip.textContent = text;
				self._tooltip.setAttribute('aria-hidden', 'false');

				var rect = anchor.getBoundingClientRect();
				var scrollY = window.scrollY || document.documentElement.scrollTop;

				// Position below the anchor, centered horizontally
				self._tooltip.style.left = (rect.left + rect.width / 2) + 'px';
				self._tooltip.style.top  = (rect.bottom + scrollY + 6) + 'px';
				self._tooltip.style.transform = 'translateX(-50%)';

				self._tooltip.classList.add('is-visible');
			}, 300);
		},

		/**
		 * Hide the tooltip.
		 * @private
		 */
		_hideTooltip: function () {
			clearTimeout(this._tooltipTimer);

			if (this._tooltip) {
				this._tooltip.classList.remove('is-visible');
				this._tooltip.setAttribute('aria-hidden', 'true');
			}
		},

		// ------------------------------------------------------------------
		// BUTTON BINDINGS
		// ------------------------------------------------------------------

		/**
		 * Bind all top menu bar button click handlers.
		 */
		_bindButtons: function () {
			var self = this;

			var bindings = {
				'eff-btn-preferences':    self._openPreferences.bind(self),
				'eff-btn-manage-project': self._openManageProject.bind(self),
				'eff-btn-export':         self._openExport.bind(self),
				'eff-btn-import':         self._openImport.bind(self),
				'eff-btn-sync':           self._syncFromElementor.bind(self),
				'eff-btn-history':        self._openHistory.bind(self),
				'eff-btn-search':         self._openSearch.bind(self),
				'eff-btn-help':           self._openHelp.bind(self),
			};

			Object.keys(bindings).forEach(function (id) {
				var btn = document.getElementById(id);
				if (btn) {
					btn.addEventListener('click', bindings[id]);
				}
			});
		},

		// ------------------------------------------------------------------
		// MODAL CONTENT — Preferences
		// ------------------------------------------------------------------

		_openPreferences: function () {
			var currentTheme = EFF.Theme.current;

			var body = '<div style="display:flex;flex-direction:column;gap:16px">'

				// Theme toggle
				+ '<div>'
				+ '<p class="eff-field-label">Interface theme</p>'
				+ '<div style="display:flex;gap:8px">'
				+ '<button class="eff-btn" id="eff-pref-theme-light" '
				+ (currentTheme === 'light' ? 'style="outline:2px solid var(--eff-clr-accent)"' : '') + '>'
				+ 'Light</button>'
				+ '<button class="eff-btn" id="eff-pref-theme-dark" '
				+ (currentTheme === 'dark' ? 'style="outline:2px solid var(--eff-clr-accent)"' : '') + '>'
				+ 'Dark</button>'
				+ '</div>'
				+ '</div>'

				// Default file path
				+ '<div>'
				+ '<label class="eff-field-label" for="eff-pref-filepath">Default storage file</label>'
				+ '<input type="text" class="eff-field-input" id="eff-pref-filepath" '
				+ 'placeholder="e.g., my-project.eff.json" />'
				+ '</div>'

				+ '</div>';

			EFF.Modal.open({
				title:   'Preferences',
				body:    body,
				onClose: null,
			});

			// Bind theme toggle buttons after modal renders
			requestAnimationFrame(function () {
				var lightBtn = document.getElementById('eff-pref-theme-light');
				var darkBtn  = document.getElementById('eff-pref-theme-dark');

				if (lightBtn) {
					lightBtn.addEventListener('click', function () {
						EFF.Theme.set('light');
						EFF.Modal.close();
					});
				}

				if (darkBtn) {
					darkBtn.addEventListener('click', function () {
						EFF.Theme.set('dark');
						EFF.Modal.close();
					});
				}

				// Load saved default filepath
				EFF.App.ajax('eff_get_settings', {}).then(function (res) {
					if (res.success && res.data.settings && res.data.settings.default_file_path) {
						var input = document.getElementById('eff-pref-filepath');
						if (input) {
							input.value = res.data.settings.default_file_path;
						}
					}
				});
			});
		},

		// ------------------------------------------------------------------
		// MODAL CONTENT — Manage Project (subgroup editor)
		// ------------------------------------------------------------------

		_openManageProject: function () {
			var config  = EFF.state.config;
			var groups  = (config && config.groups && config.groups.Variables) || {};
			var colors  = (groups.Colors  || ['Branding', 'Backgrounds', 'Neutral', 'Status']).join('\n');
			var numbers = (groups.Numbers || ['Spacing', 'Gaps', 'Grids', 'Radius']).join('\n');

			var body = '<p style="font-size:13px;color:var(--eff-clr-muted);margin-bottom:16px">'
				+ 'Edit subgroups below. One name per line. At least one subgroup required per section.</p>'

				+ '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">'

				+ '<div>'
				+ '<label class="eff-field-label" for="eff-proj-colors">Colors subgroups</label>'
				+ '<textarea class="eff-field-input" id="eff-proj-colors" rows="6" '
				+ 'style="resize:vertical;font-family:monospace">' + this._escapeHtml(colors) + '</textarea>'
				+ '</div>'

				+ '<div>'
				+ '<label class="eff-field-label" for="eff-proj-numbers">Numbers subgroups</label>'
				+ '<textarea class="eff-field-input" id="eff-proj-numbers" rows="6" '
				+ 'style="resize:vertical;font-family:monospace">' + this._escapeHtml(numbers) + '</textarea>'
				+ '</div>'

				+ '</div>';

			var footer = '<button class="eff-btn" id="eff-proj-save">Save changes</button>';

			EFF.Modal.open({
				title:  'Manage project',
				body:   body,
				footer: footer,
			});

			requestAnimationFrame(function () {
				var saveBtn = document.getElementById('eff-proj-save');
				if (saveBtn) {
					saveBtn.addEventListener('click', this._saveProjectConfig.bind(this));
				}
			}.bind(this));
		},

		/**
		 * Read the Manage Project form and save config via AJAX.
		 * @private
		 */
		_saveProjectConfig: function () {
			var colorsEl  = document.getElementById('eff-proj-colors');
			var numbersEl = document.getElementById('eff-proj-numbers');

			var colors  = colorsEl  ? this._parseLines(colorsEl.value)  : [];
			var numbers = numbersEl ? this._parseLines(numbersEl.value) : [];

			// Enforce minimum one subgroup per section
			if (!colors.length)  { colors  = ['Colors']; }
			if (!numbers.length) { numbers = ['Numbers']; }

			var config = {
				version: '1.0',
				groups: {
					Variables: {
						Colors:  colors,
						Fonts:   [],      // Dynamic — sourced from Elementor
						Numbers: numbers,
					},
				},
			};

			EFF.App.ajax('eff_save_config', { config: JSON.stringify(config) })
				.then(function (res) {
					if (res.success) {
						EFF.state.config = config;
						EFF.PanelLeft.refresh();
						EFF.Modal.close();
					} else {
						alert('Error saving config: ' + (res.data.message || 'Unknown error.'));
					}
				})
				.catch(function () {
					alert('Network error while saving config.');
				});
		},

		// ------------------------------------------------------------------
		// MODAL CONTENT — Search
		// ------------------------------------------------------------------

		_openSearch: function () {
			var body = '<input type="text" class="eff-field-input" id="eff-search-input" '
				+ 'placeholder="Search variables, classes, components..." autocomplete="off" />'
				+ '<div id="eff-search-results" style="margin-top:16px;min-height:40px"></div>';

			EFF.Modal.open({
				title: 'Search',
				body:  body,
			});

			requestAnimationFrame(function () {
				var input   = document.getElementById('eff-search-input');
				var results = document.getElementById('eff-search-results');

				if (!input) {
					return;
				}

				input.focus();

				input.addEventListener('input', function () {
					var query = input.value.trim().toLowerCase();
					if (!results) {
						return;
					}

					if (query.length < 2) {
						results.innerHTML = '<p class="eff-text-muted" style="font-size:13px">Type at least 2 characters to search.</p>';
						return;
					}

					var matches = EFF.state.variables.filter(function (v) {
						return v.name.toLowerCase().includes(query)
							|| v.value.toLowerCase().includes(query);
					});

					if (!matches.length) {
						results.innerHTML = '<p class="eff-text-muted" style="font-size:13px">No results found.</p>';
						return;
					}

					var html = '<ul style="list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:4px">';
					matches.forEach(function (v) {
						html += '<li style="display:flex;justify-content:space-between;padding:4px 8px;border-radius:4px;background:var(--eff-bg-panel)">'
							+ '<code style="font-size:12px;color:var(--eff-clr-primary)">' + v.name + '</code>'
							+ '<span style="font-size:12px;color:var(--eff-clr-muted)">' + v.value + '</span>'
							+ '</li>';
					});
					html += '</ul>';
					results.innerHTML = html;
				});
			});
		},

		// ------------------------------------------------------------------
		// SYNC FROM ELEMENTOR
		// ------------------------------------------------------------------

		_syncFromElementor: function () {
			var btn = document.getElementById('eff-btn-sync');
			if (btn) {
				btn.style.opacity = '0.5';
				btn.disabled      = true;
			}

			EFF.App.ajax('eff_sync_from_elementor', {})
				.then(function (res) {
					if (btn) {
						btn.style.opacity = '';
						btn.disabled      = false;
					}

					if (res.success) {
						var vars    = res.data.variables || [];
						var count   = res.data.count     || 0;
						var message = res.data.message   || '';
						var source  = res.data.source    || '';

						// Merge into state (add new, preserve existing)
						var existingNames = EFF.state.variables.map(function (v) { return v.name; });

						vars.forEach(function (v) {
							if (!existingNames.includes(v.name)) {
								EFF.state.variables.push({
									id:         '',
									name:       v.name,
									value:      v.value,
									source:     'elementor-parsed',
									type:       'unknown',
									group:      'Variables',
									subgroup:   '',
									category:   '',
									modified:   false,
									created_at: new Date().toISOString(),
									updated_at: new Date().toISOString(),
								});
							}
						});

						EFF.App.refreshCounts();
						if (count > 0) {
							EFF.App.setDirty(true);
						}

						EFF.Modal.open({
							title: 'Sync complete',
							body:  '<p>' + message + '</p>'
								+ (source ? '<p class="eff-text-muted" style="font-size:12px">Source: ' + source + '</p>' : ''),
						});
					} else {
						EFF.Modal.open({
							title: 'Sync failed',
							body:  '<p>' + (res.data.message || 'Could not read Elementor CSS file.') + '</p>',
						});
					}
				})
				.catch(function () {
					if (btn) {
						btn.style.opacity = '';
						btn.disabled      = false;
					}
					EFF.Modal.open({
						title: 'Sync error',
						body:  '<p>Network error while syncing from Elementor.</p>',
					});
				});
		},

		// ------------------------------------------------------------------
		// PLACEHOLDER MODALS (v5 features)
		// ------------------------------------------------------------------

		_openExport: function () {
			EFF.Modal.open({
				title: 'Export',
				body:  '<p>Export functionality arrives in EFF v5.</p>',
			});
		},

		_openImport: function () {
			EFF.Modal.open({
				title: 'Import',
				body:  '<p>Import functionality arrives in EFF v5.</p>',
			});
		},

		_openHistory: function () {
			EFF.Modal.open({
				title: 'Change history',
				body:  '<p>Change history arrives in EFF v5.</p>',
			});
		},

		_openHelp: function () {
			EFF.Modal.open({
				title: 'Help',
				body:  '<p><strong>Elementor Framework Forge v' + (EFFData && EFFData.version ? EFFData.version : '1.0.0') + '</strong></p>'
					+ '<p>EFF is a developer tool for managing Elementor v4 atomic widget assets.</p>'
					+ '<ul style="margin:12px 0;padding-left:20px;font-size:14px;line-height:1.6">'
					+ '<li><strong>Sync</strong> — import variables from your Elementor kit CSS file</li>'
					+ '<li><strong>Save / Load</strong> — persist your project data to a .eff.json file</li>'
					+ '<li><strong>Manage Project</strong> — customize subgroup names in the left panel</li>'
					+ '<li><strong>Preferences</strong> — toggle light/dark mode and set defaults</li>'
					+ '</ul>'
					+ '<p><a href="https://jimrforge.com" target="_blank" rel="noopener">Jim R Forge</a></p>',
			});
		},

		// ------------------------------------------------------------------
		// HELPERS
		// ------------------------------------------------------------------

		/**
		 * Parse a multiline string into an array of trimmed, non-empty lines.
		 *
		 * @param {string} text
		 * @returns {string[]}
		 * @private
		 */
		_parseLines: function (text) {
			return text.split('\n')
				.map(function (l) { return l.trim(); })
				.filter(function (l) { return l.length > 0; });
		},

		/**
		 * Escape HTML special characters.
		 *
		 * @param {string} str
		 * @returns {string}
		 * @private
		 */
		_escapeHtml: function (str) {
			var div = document.createElement('div');
			div.textContent = str;
			return div.innerHTML;
		},
	};
}());
