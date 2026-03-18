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

	// ------------------------------------------------------------------
	// FILE PICKER DIRECTORY MEMORY
	// Stores the last FileSystemFileHandle from Export / Import in
	// IndexedDB so the next call opens in the same directory.
	// Falls back to the Desktop on first use.
	// ------------------------------------------------------------------

	var _effPickerDB = null;

	function _effPickerDbOpen(cb) {
		if (_effPickerDB) { cb(_effPickerDB); return; }
		var req = indexedDB.open('eff-picker', 1);
		req.onupgradeneeded = function (e) { e.target.result.createObjectStore('handles'); };
		req.onsuccess   = function (e) { _effPickerDB = e.target.result; cb(_effPickerDB); };
		req.onerror     = function ()  { cb(null); };
	}

	function _effPickerGet(key, cb) {
		_effPickerDbOpen(function (db) {
			if (!db) { cb(null); return; }
			var req = db.transaction('handles').objectStore('handles').get(key);
			req.onsuccess = function () { cb(req.result || null); };
			req.onerror   = function () { cb(null); };
		});
	}

	function _effPickerSave(key, handle) {
		_effPickerDbOpen(function (db) {
			if (!db) { return; }
			db.transaction('handles', 'readwrite').objectStore('handles').put(handle, key);
		});
	}

	EFF.PanelTop = {

		_showTooltips:     true,  // false → all tooltips suppressed
		_extendedTooltips: false, // true → show data-eff-tooltip-long text when available

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

		// Load tooltip preferences from settings (async, non-blocking)
		var _panelTop = this;
		EFF.App.ajax('eff_get_settings', {}).then(function (res) {
			if (res.success && res.data && res.data.settings) {
				var s = res.data.settings;
				if (s.show_tooltips === false || s.show_tooltips === 'false') {
					_panelTop._showTooltips = false;
				}
				if (s.extended_tooltips === true || s.extended_tooltips === 'true') {
					_panelTop._extendedTooltips = true;
				}
			}
		}).catch(function () {});
		},

		// ------------------------------------------------------------------
		// TOOLTIPS (CSS-driven positioning, 300ms delay)
		// ------------------------------------------------------------------

		/**
		 * Bind tooltip show/hide to all elements with [data-eff-tooltip].
		 */
		_bindTooltips: function () {
			var self = this;

			// Delegated listener — covers dynamically created elements in the colors/fonts/numbers views.
		// _tipEl tracks the active tooltip element to prevent repeated show calls as the mouse
		// moves over child nodes (SVG paths, spans, etc.) of the same trigger element.
		var _tipEl = null;
		document.addEventListener('mouseover', function (e) {
			var target = e.target.closest ? e.target.closest('[data-eff-tooltip]') : null;
			if (target !== _tipEl) {
				if (_tipEl) { self._hideTooltip(); }
				_tipEl = target;
				if (target) { self._showTooltip(target); }
			}
		});
		document.addEventListener('mouseout', function (e) {
			var target = e.target.closest ? e.target.closest('[data-eff-tooltip]') : null;
			if (target && target === _tipEl) {
				var rt = e.relatedTarget;
				if (!rt || !target.contains(rt)) { _tipEl = null; self._hideTooltip(); }
			}
		});
		document.addEventListener('focusin', function (e) {
			if (e.target && e.target.getAttribute && e.target.getAttribute('data-eff-tooltip')) { self._showTooltip(e.target); }
		});
		document.addEventListener('focusout', function (e) {
			if (e.target && e.target.getAttribute && e.target.getAttribute('data-eff-tooltip')) { self._hideTooltip(); }
		});
		// Empty iteration keeps the original per-element block intact but harmless
		[].forEach(function (el) {
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
			if (!this._showTooltips) { return; }

		var text = this._extendedTooltips
			? (anchor.getAttribute('data-eff-tooltip-long') || anchor.getAttribute('data-eff-tooltip'))
			: anchor.getAttribute('data-eff-tooltip');

			if (!text || !this._tooltip) {
				return;
			}

			clearTimeout(this._tooltipTimer);

			this._tooltipTimer = setTimeout(function () {
				self._tooltip.textContent = text;
				self._tooltip.setAttribute('aria-hidden', 'false');

				var rect   = anchor.getBoundingClientRect();
				var tipW   = self._tooltip.offsetWidth  || 120;
				var tipH   = self._tooltip.offsetHeight || 28;
				var margin = 8;
				var vpW    = window.innerWidth  || document.documentElement.clientWidth;
				var vpH    = window.innerHeight || document.documentElement.clientHeight;

				// Default: to the right of the anchor, vertically centred.
				var leftPos = rect.right + margin;
				var topPos  = rect.top + (rect.height - tipH) / 2;

				// Flip to left if the tooltip would overflow the right edge.
				if (leftPos + tipW > vpW - 10) {
					leftPos = rect.left - tipW - margin;
				}

				// Clamp vertically within the viewport.
				topPos = Math.max(4, Math.min(topPos, vpH - tipH - 4));

				self._tooltip.style.left = leftPos + 'px';
				self._tooltip.style.top  = topPos  + 'px';

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

			this._bindFunctionsBtn();
		},

		// ------------------------------------------------------------------
		// FUNCTIONS DROPDOWN
		// ------------------------------------------------------------------

		/**
		 * Bind the Functions dropdown toggle and item clicks.
		 * @private
		 */
		_bindFunctionsBtn: function () {
			var self     = this;
			var btn      = document.getElementById('eff-btn-functions');
			var dropdown = document.getElementById('eff-dropdown-functions');

			if (!btn || !dropdown) { return; }

			// Toggle dropdown on button click.
			btn.addEventListener('click', function (e) {
				e.stopPropagation();
				var isOpen = dropdown.classList.contains('is-open');
				self._closeFunctionsDropdown();
				if (!isOpen) {
					dropdown.classList.add('is-open');
					btn.setAttribute('aria-expanded', 'true');
				}
			});

			// Close on click outside.
			document.addEventListener('click', function () {
				self._closeFunctionsDropdown();
			});

			// Item clicks.
			dropdown.addEventListener('click', function (e) {
				var item = e.target.closest('.eff-dropdown__item');
				if (!item) { return; }
				e.stopPropagation();
				self._closeFunctionsDropdown();
				var action = item.getAttribute('data-action');
				if (action === 'convert-v3') {
					self._openConvertV3();
				} else if (action === 'change-types') {
					self._openChangeTypes();
				}
			});
		},

		/**
		 * Close the Functions dropdown.
		 * @private
		 */
		_closeFunctionsDropdown: function () {
			var btn      = document.getElementById('eff-btn-functions');
			var dropdown = document.getElementById('eff-dropdown-functions');
			if (dropdown) { dropdown.classList.remove('is-open'); }
			if (btn)      { btn.setAttribute('aria-expanded', 'false'); }
		},

		/**
		 * Placeholder modal — Convert V3 Variables.
		 * @private
		 */
		_openConvertV3: function () {
			EFF.Modal.open(
				'Convert V3 Variables',
				'<p style="color:var(--eff-clr-secondary);line-height:1.6">'
				+ 'This tool will scan your variables for Elementor V3 naming patterns and '
				+ 'offer to rename them to the V4 convention.'
				+ '</p>'
				+ '<p style="margin-top:12px;color:var(--eff-clr-muted);font-size:var(--fs-sm)">'
				+ 'Coming in a future release.'
				+ '</p>',
				'<button class="eff-btn" id="eff-modal-close-btn">Close</button>'
			);
			var closeBtn = document.getElementById('eff-modal-close-btn');
			if (closeBtn) { closeBtn.addEventListener('click', function () { EFF.Modal.close(); }); }
		},

		/**
		 * Placeholder modal — Change Variable Types.
		 * @private
		 */
		_openChangeTypes: function () {
			EFF.Modal.open(
				'Change Variable Types',
				'<p style="color:var(--eff-clr-secondary);line-height:1.6">'
				+ 'This tool will let you bulk-change the type (format) of selected variables — '
				+ 'for example, converting a group of HEX colors to RGBA.'
				+ '</p>'
				+ '<p style="margin-top:12px;color:var(--eff-clr-muted);font-size:var(--fs-sm)">'
				+ 'Coming in a future release.'
				+ '</p>',
				'<button class="eff-btn" id="eff-modal-close-btn">Close</button>'
			);
			var closeBtn = document.getElementById('eff-modal-close-btn');
			if (closeBtn) { closeBtn.addEventListener('click', function () { EFF.Modal.close(); }); }
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

			// Tooltip preferences
			+ '<div>'
			+ '<p class="eff-field-label">Tooltips</p>'
			+ '<div style="display:flex;flex-direction:column;gap:8px">'
			+ '<label style="display:flex;align-items:center;gap:8px;cursor:pointer">'
			+ '<input type="checkbox" id="eff-pref-tooltips-show"'
			+ (this._showTooltips ? ' checked' : '') + '> Show tooltips</label>'
			+ '<label style="display:flex;align-items:center;gap:8px;cursor:pointer">'
			+ '<input type="checkbox" id="eff-pref-tooltips-extended"'
			+ (this._extendedTooltips ? ' checked' : '') + '> Extended mode (show detailed descriptions)</label>'
			+ '</div>'
				+ '</div>'

				+ '</div>';

			EFF.Modal.open({
				title:   'Preferences',
				body:    body,
				onClose: null,
			});

			// Bind theme toggle buttons after modal renders
			requestAnimationFrame(function () {
				// Tooltip preference checkboxes
			var showChk = document.getElementById('eff-pref-tooltips-show');
			var extChk  = document.getElementById('eff-pref-tooltips-extended');
			if (showChk) {
				showChk.addEventListener('change', function () {
					EFF.PanelTop._showTooltips = showChk.checked;
					EFF.App.ajax('eff_save_settings', { settings: JSON.stringify({ show_tooltips: showChk.checked }) });
				});
			}
			if (extChk) {
				extChk.addEventListener('change', function () {
					EFF.PanelTop._extendedTooltips = extChk.checked;
					EFF.App.ajax('eff_save_settings', { settings: JSON.stringify({ extended_tooltips: extChk.checked }) });
				});
			}

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

				// Load saved settings and populate fields
				EFF.App.ajax('eff_get_settings', {}).then(function (res) {
					var s = res.success && res.data && res.data.settings ? res.data.settings : {};

					if (s.default_file_path) {
						var fpInput = document.getElementById('eff-pref-filepath');
						if (fpInput) { fpInput.value = s.default_file_path; }
					}
			});
			});
		},

		// ------------------------------------------------------------------
		// MODAL CONTENT — Manage Project (subgroup editor)
		// ------------------------------------------------------------------

		_openManageProject: function () {
			var config  = EFF.state.config;
			var cfg      = EFF.state.config || {};
		var projName = EFF.state.projectName || '';
		function _catsToStr(arr) {
			return (arr || []).filter(function (c) { return !c.locked && c.name !== 'Uncategorized'; })
				.map(function (c) { return c.name; }).join(', ');
		}
		var colorsStr  = _catsToStr(cfg.colorCategories || cfg.categories) || 'Branding, Backgrounds, Neutral, Status';
		var fontsStr   = _catsToStr(cfg.fontCategories)  || 'Titles, Text';
		var numbersStr = _catsToStr(cfg.numberCategories) || 'Spacing, Gaps, Grids, Radius';
		function _catPanel(label, id, value) {
			return '<div style="margin-bottom:16px">'
				+ '<p class="eff-field-label" style="margin-bottom:4px">' + label + ' Categories</p>'
				+ '<p style="font-size:12px;color:var(--eff-clr-muted);margin-bottom:6px">'
				+ 'Comma-separated. \u201cUncategorized\u201d is added automatically.</p>'
				+ '<input type="text" class="eff-field-input" id="' + id + '"'
				+ ' value="' + value + '" style="width:100%" autocomplete="off" spellcheck="false">'
				+ '</div>';
		}
		var projNameEscaped = this._escapeHtml(projName);
		var body = '<div style="margin-bottom:20px">'
			+ '<label class="eff-field-label" for="eff-proj-name">Project name</label>'
			+ '<input type="text" class="eff-field-input" id="eff-proj-name"'
			+ ' placeholder="e.g., My Brand" autocomplete="off" spellcheck="false"'
			+ ' value="' + projNameEscaped + '" style="width:100%">'
			+ '<p style="font-size:12px;color:var(--eff-clr-muted);margin-top:4px">'
			+ 'Used as the project file name: <em>project-name.eff.json</em></p>'
			+ '</div>'
			+ '<div style="border-top:1px solid var(--eff-clr-border,#d6ccc2);padding-top:16px">'
			+ _catPanel('Colors',  'eff-proj-cat-colors',  this._escapeHtml(colorsStr))
			+ _catPanel('Fonts',   'eff-proj-cat-fonts',   this._escapeHtml(fontsStr))
			+ _catPanel('Numbers', 'eff-proj-cat-numbers', this._escapeHtml(numbersStr))
			+ '</div>'
			+ '<div style="border-top:1px solid var(--eff-clr-border,#d6ccc2);padding-top:16px;margin-top:16px">'
			+ '<p class="eff-field-label">Default Format</p>'
			+ '<p style="font-size:12px;color:var(--eff-clr-muted);margin-bottom:8px">Formatting default for variables.</p>'
			+ '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px">'
			+ '<div>'
			+ '<label class="eff-field-label" for="eff-proj-colors-type" style="font-size:11px;margin-bottom:4px">Colors</label>'
			+ '<select class="eff-field-input" id="eff-proj-colors-type" style="width:100%">'
			+ ['HEX','HEXA','RGB','RGBA','HSL','HSLA'].map(function (t) { return '<option value="' + t + '">' + t + '</option>'; }).join('')
			+ '</select>'
			+ '</div>'
			+ '<div>'
			+ '<label class="eff-field-label" for="eff-proj-fonts-type" style="font-size:11px;margin-bottom:4px">Fonts</label>'
			+ '<select class="eff-field-input" id="eff-proj-fonts-type" style="width:100%">'
			+ ['System','Custom'].map(function (t) { return '<option value="' + t + '">' + t + '</option>'; }).join('')
			+ '</select>'
			+ '</div>'
			+ '<div>'
			+ '<label class="eff-field-label" for="eff-proj-numbers-type" style="font-size:11px;margin-bottom:4px">Numbers</label>'
			+ '<select class="eff-field-input" id="eff-proj-numbers-type" style="width:100%">'
			+ ['PX','%','EM','REM','VW','VH','CH','FX'].map(function (t) { return '<option value="' + t + '">' + t + '</option>'; }).join('')
			+ '</select>'
			+ '</div>'
			+ '</div>'
			+ '</div>';
		var footer = '<button class="eff-btn" id="eff-proj-cancel" style="margin-right:8px">Cancel</button>'
			+ '<button class="eff-btn" id="eff-proj-save">Save</button>';
		EFF.Modal.open({ title: 'Manage project', body: body, footer: footer });
		requestAnimationFrame(function () {
			var cancelBtn = document.getElementById('eff-proj-cancel');
			var saveBtn   = document.getElementById('eff-proj-save');
			if (cancelBtn) { cancelBtn.addEventListener('click', function () { EFF.Modal.close(); }); }
			if (saveBtn)   { saveBtn.addEventListener('click', this._saveProjectConfig.bind(this)); }
			var projNameInput = document.getElementById('eff-proj-name');
			if (projNameInput) { projNameInput.focus(); projNameInput.select(); }
			// Load saved default types and populate selects
			EFF.App.ajax('eff_get_settings', {}).then(function (res) {
				var s = res.success && res.data && res.data.settings ? res.data.settings : {};
				var selColors  = document.getElementById('eff-proj-colors-type');
				var selFonts   = document.getElementById('eff-proj-fonts-type');
				var selNumbers = document.getElementById('eff-proj-numbers-type');
				if (selColors  && s.colors_default_type)  { selColors.value  = s.colors_default_type; }
				if (selFonts   && s.fonts_default_type)   { selFonts.value   = s.fonts_default_type; }
				if (selNumbers && s.numbers_default_type) { selNumbers.value = s.numbers_default_type; }
			});
			// Save default types on change
			var colorsTypeSel  = document.getElementById('eff-proj-colors-type');
			var fontsTypeSel   = document.getElementById('eff-proj-fonts-type');
			var numbersTypeSel = document.getElementById('eff-proj-numbers-type');
			if (colorsTypeSel) {
				colorsTypeSel.addEventListener('change', function () {
					EFF.App.ajax('eff_save_settings', { settings: JSON.stringify({ colors_default_type: colorsTypeSel.value }) });
				});
			}
			if (fontsTypeSel) {
				fontsTypeSel.addEventListener('change', function () {
					EFF.App.ajax('eff_save_settings', { settings: JSON.stringify({ fonts_default_type: fontsTypeSel.value }) });
				});
			}
			if (numbersTypeSel) {
				numbersTypeSel.addEventListener('change', function () {
					EFF.App.ajax('eff_save_settings', { settings: JSON.stringify({ numbers_default_type: numbersTypeSel.value }) });
				});
			}
		}.bind(this));
		},

		/**
		 * Read the Manage Project form and save config via AJAX.
		 * @private
		 */
		_saveProjectConfig: function () {
			var projNameEl  = document.getElementById('eff-proj-name');
		var colCatEl    = document.getElementById('eff-proj-cat-colors');
		var fntCatEl    = document.getElementById('eff-proj-cat-fonts');
		var numCatEl    = document.getElementById('eff-proj-cat-numbers');
		var projName    = projNameEl ? projNameEl.value.trim() : (EFF.state.projectName || '');

		function _parseCsvNames(el) {
			if (!el) { return []; }
			return el.value.split(',').map(function (s) { return s.trim(); })
				.filter(function (s) { return s && s !== 'Uncategorized'; });
		}
		function _buildCatArray(newNames, existingArr) {
			existingArr = existingArr || [];
			var byName = {};
			for (var i = 0; i < existingArr.length; i++) { byName[existingArr[i].name] = existingArr[i]; }
			var result = [];
			for (var j = 0; j < newNames.length; j++) {
				var nm = newNames[j];
				if (byName[nm]) {
					result.push({ id: byName[nm].id, name: nm, order: j, locked: !!byName[nm].locked });
				} else {
					result.push({ id: 'cat-' + Date.now() + '-' + j, name: nm, order: j, locked: false });
				}
			}
			var uncatSrc = byName['Uncategorized'] || { id: 'uncategorized' };
			result.push({ id: uncatSrc.id, name: 'Uncategorized', order: result.length, locked: true });
			return result;
		}

		var cfg         = EFF.state.config || {};
		var colNewNames = _parseCsvNames(colCatEl);
		var fntNewNames = _parseCsvNames(fntCatEl);
		var numNewNames = _parseCsvNames(numCatEl);

		var newColCats = _buildCatArray(colNewNames, cfg.colorCategories || cfg.categories || []);
		var newFntCats = _buildCatArray(fntNewNames, cfg.fontCategories  || []);
		var newNumCats = _buildCatArray(numNewNames, cfg.numberCategories || []);

		// Find IDs of categories that were removed per set, so their variables can be reassigned.
		function _removedIds(existingArr, newNames) {
			var removed = {};
			for (var i = 0; i < existingArr.length; i++) {
				var cat = existingArr[i];
				if (!cat.locked && cat.name !== 'Uncategorized' && newNames.indexOf(cat.name) === -1) {
					removed[cat.id] = true;
				}
			}
			return removed;
		}
		function _uncatIdFor(catArr) {
			for (var i = 0; i < catArr.length; i++) {
				if (catArr[i].name === 'Uncategorized') { return catArr[i].id; }
			}
			return 'uncategorized';
		}

		var removedColIds = _removedIds(cfg.colorCategories  || cfg.categories || [], colNewNames);
		var removedFntIds = _removedIds(cfg.fontCategories   || [], fntNewNames);
		var removedNumIds = _removedIds(cfg.numberCategories || [], numNewNames);
		var colUncatId    = _uncatIdFor(newColCats);
		var fntUncatId    = _uncatIdFor(newFntCats);
		var numUncatId    = _uncatIdFor(newNumCats);

		// Reassign variables from removed categories to Uncategorized.
		var saveVarPromises = [];
		var vars = EFF.state.variables || [];
		for (var vi = 0; vi < vars.length; vi++) {
			var v = vars[vi];
			if (v.category_id) {
				var newCatId = null;
				if (v.subgroup === 'Colors'  && removedColIds[v.category_id]) { newCatId = colUncatId; }
				if (v.subgroup === 'Fonts'   && removedFntIds[v.category_id]) { newCatId = fntUncatId; }
				if (v.subgroup === 'Numbers' && removedNumIds[v.category_id]) { newCatId = numUncatId; }
				if (newCatId) {
					v.category    = 'Uncategorized';
					v.category_id = newCatId;
					saveVarPromises.push(EFF.App.ajax('eff_save_color', { variable: JSON.stringify(v) }));
				}
			}
		}

		var self   = this;
		var config = {
			version:          '1.0',
			projectName:      projName,
			colorCategories:  newColCats,
			fontCategories:   newFntCats,
			numberCategories: newNumCats,
			categories:       newColCats,   // backward-compat alias
			groups:           cfg.groups || {},
		};

		Promise.all(saveVarPromises).then(function () {
			return EFF.App.ajax('eff_save_config', { config: JSON.stringify(config) });
		}).then(function (res) {
			if (res && res.success) {
				EFF.state.config      = config;
				EFF.state.projectName = projName;
				if (projName && EFF.PanelRight && EFF.PanelRight._filenameInput) {
					var slugged = projName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
					EFF.PanelRight._filenameInput.value = projName;
					if (!EFF.state.currentFile || EFF.state.currentFile === 'eff-temp.eff.json') {
						EFF.state.currentFile = slugged + '.eff.json';
					}
				}
				EFF.PanelLeft.refresh();
				if (EFF.Colors && EFF.Colors._rerenderView && EFF.state.currentSelection &&
						EFF.state.currentSelection.subgroup === 'Colors') {
					EFF.Colors._rerenderView();
				}
				EFF.Modal.close();
			} else {
				EFF.Modal.open({ title: 'Save error', body: '<p>' + ((res && res.data && res.data.message) || 'Unknown error.') + '</p>' });
			}
		}).catch(function () {
			EFF.Modal.open({ title: 'Save error', body: '<p>Network error while saving config.</p>' });
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

		_syncFromElementor: function (options) {
			var silent = options && options.silent;
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
							var lc = (v.value || '').trim().toLowerCase();
							var isColor = lc.charAt(0) === '#' || lc.indexOf('rgb(') === 0 || lc.indexOf('rgba(') === 0 || lc.indexOf('hsl(') === 0 || lc.indexOf('hsla(') === 0;
							var isFont   = !isColor && /\b(serif|sans-serif|monospace|cursive|fantasy|system-ui|ui-sans-serif|ui-serif|ui-monospace)\b/.test(lc);
							var isNumber = !isColor && !isFont && (/^\d/.test(lc) || lc.indexOf('clamp(') === 0 || lc.indexOf('calc(') === 0 || lc.indexOf('min(') === 0 || lc.indexOf('max(') === 0 || /\d+(px|rem|em|%|vw|vh|ch|fr|pt|deg|ms)\b/.test(lc));
							var subgroup = isColor ? 'Colors' : (isFont ? 'Fonts' : (isNumber ? 'Numbers' : ''));
								EFF.state.variables.push({
									id:         '',
									name:       v.name.toLowerCase(),
									value:      v.value,
									source:     'elementor-parsed',
									type:        isColor ? 'color' : (isFont ? 'font' : (isNumber ? 'number' : 'unknown')),
									group:      'Variables',
									subgroup:    subgroup,
									category:    subgroup ? 'Uncategorized' : '',
								category_id: '',
									modified:   false,
									created_at: new Date().toISOString(),
									updated_at: new Date().toISOString(),
								});
							}
						});

						EFF.App.refreshCounts();
						if (EFF.Colors && EFF.Colors._ensureUncategorized) { EFF.Colors._ensureUncategorized(); }
						if (EFF.Variables && EFF.Variables._sets) {
							var _vsets = EFF.Variables._sets;
							if (_vsets['Fonts']   && _vsets['Fonts']._ensureUncategorized)   { _vsets['Fonts']._ensureUncategorized(); }
							if (_vsets['Numbers'] && _vsets['Numbers']._ensureUncategorized) { _vsets['Numbers']._ensureUncategorized(); }
						}
						if (EFF.PanelLeft) { EFF.PanelLeft.refresh(); }
						if (count > 0 && !silent) {
							EFF.App.setDirty(true);
						}

						// Scan widget usage for the synced variables (async, non-blocking)
						EFF.App.fetchUsageCounts();

						if (!silent) {
							EFF.Modal.open({
								title: 'Sync complete',
								body:  '<p>' + message + '</p>'
									+ (source ? '<p class="eff-text-muted" style="font-size:12px">Source: ' + source + '</p>' : ''),
							});
						}
					} else if (!silent) {
						EFF.PanelTop._showSyncFailedModal(res.data || {});
					}
				})
				.catch(function () {
					if (btn) {
						btn.style.opacity = '';
						btn.disabled      = false;
					}
					if (!silent) {
						EFF.Modal.open({
							title: 'Sync error',
							body:  '<p>Network error while syncing from Elementor.</p>',
						});
					}
				});
		},

		// ------------------------------------------------------------------
		// SYNC — failure modal with manual CSS path fallback
		// ------------------------------------------------------------------

		/**
		 * Show the Sync Failed modal with a manual CSS path input.
		 * @param {Object} data  Error data from the AJAX response.
		 * @private
		 */
		_showSyncFailedModal: function (data) {
			var self         = this;
			var message      = data.message      || 'Could not read Elementor kit CSS file.';
			var hint         = data.hint         || '';
			var expectedFile = data.expected_file || '';

			var body = '<p style="margin-bottom:8px">' + this._escapeHtml(message) + '</p>';
			if (hint) {
				body += '<p style="font-size:12px;color:var(--eff-clr-muted);margin-bottom:12px">'
					+ this._escapeHtml(hint) + '</p>';
			}
			body += '<div style="border-top:1px solid var(--eff-clr-border);padding-top:14px;margin-top:4px">'
				+ '<label class="eff-field-label" for="eff-sync-css-path"'
				+ ' style="font-size:12px;margin-bottom:4px">Try a different CSS file path</label>'
				+ '<p style="font-size:11px;color:var(--eff-clr-muted);margin-bottom:6px">'
				+ 'Must be inside <code>wp-content/uploads/elementor/css/</code></p>'
				+ '<input type="text" class="eff-field-input" id="eff-sync-css-path"'
				+ ' placeholder="...uploads/elementor/css/post-67.css"'
				+ ' value="' + this._escapeHtml(expectedFile) + '"'
				+ ' autocomplete="off" spellcheck="false" style="width:100%;margin-bottom:8px">'
				+ '<button class="eff-btn" id="eff-sync-retry-btn">Retry with this file</button>'
				+ '</div>';

			EFF.Modal.open({ title: 'Sync failed', body: body });

			requestAnimationFrame(function () {
				var retryBtn = document.getElementById('eff-sync-retry-btn');
				if (retryBtn) {
					retryBtn.addEventListener('click', function () {
						var pathInput = document.getElementById('eff-sync-css-path');
						var cssPath   = pathInput ? pathInput.value.trim() : '';
						if (cssPath) {
							EFF.Modal.close();
							self._retrySyncWithPath(cssPath);
						}
					});
				}
			});
		},

		/**
		 * Retry sync with a user-supplied CSS file path.
		 * @param {string} cssPath  Absolute server path to the CSS file.
		 * @private
		 */
		_retrySyncWithPath: function (cssPath) {
			var self = this;
			var btn  = document.getElementById('eff-btn-sync');
			if (btn) { btn.style.opacity = '0.5'; btn.disabled = true; }

			EFF.App.ajax('eff_sync_from_elementor', { css_file_path: cssPath })
				.then(function (res) {
					if (btn) { btn.style.opacity = ''; btn.disabled = false; }
					if (res.success) {
						var data  = res.data || {};
						var vars  = data.variables || [];
						var existingNames = EFF.state.variables.map(function (v) { return v.name; });
						vars.forEach(function (v) {
							if (!existingNames.includes(v.name)) {
								var lc      = (v.value || '').trim().toLowerCase();
								var isColor  = lc.charAt(0) === '#' || lc.indexOf('rgb(') === 0 || lc.indexOf('rgba(') === 0 || lc.indexOf('hsl(') === 0 || lc.indexOf('hsla(') === 0;
								var isFont   = !isColor && /\b(serif|sans-serif|monospace|cursive|fantasy|system-ui|ui-sans-serif|ui-serif|ui-monospace)\b/.test(lc);
								var isNumber = !isColor && !isFont && (/^\d/.test(lc) || lc.indexOf('clamp(') === 0 || lc.indexOf('calc(') === 0 || /\d+(px|rem|em|%|vw|vh|ch|fr|pt|deg|ms)\b/.test(lc));
								var subgroup = isColor ? 'Colors' : (isFont ? 'Fonts' : (isNumber ? 'Numbers' : ''));
								EFF.state.variables.push({
									id: '', name: v.name, value: v.value, source: 'elementor-parsed',
									type: isColor ? 'color' : (isFont ? 'font' : (isNumber ? 'number' : 'unknown')),
									group: 'Variables', subgroup: subgroup,
									category: subgroup ? 'Uncategorized' : '', category_id: '',
									modified: false,
									created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
								});
							}
						});
						EFF.App.refreshCounts();
						if (EFF.Colors && EFF.Colors._ensureUncategorized) { EFF.Colors._ensureUncategorized(); }
						if (EFF.Variables && EFF.Variables._sets) {
							var _vs = EFF.Variables._sets;
							if (_vs['Fonts']   && _vs['Fonts']._ensureUncategorized)   { _vs['Fonts']._ensureUncategorized(); }
							if (_vs['Numbers'] && _vs['Numbers']._ensureUncategorized) { _vs['Numbers']._ensureUncategorized(); }
						}
						if (EFF.PanelLeft) { EFF.PanelLeft.refresh(); }
						if ((data.count || 0) > 0) { EFF.App.setDirty(true); }
						EFF.App.fetchUsageCounts();
						EFF.Modal.open({
							title: 'Sync complete',
							body:  '<p>' + (data.message || '') + '</p>'
								+ (data.source ? '<p class="eff-text-muted" style="font-size:12px">Source: '
									+ data.source + '</p>' : ''),
						});
					} else {
						self._showSyncFailedModal(res.data || {});
					}
				})
				.catch(function () {
					if (btn) { btn.style.opacity = ''; btn.disabled = false; }
					EFF.Modal.open({ title: 'Sync error', body: '<p>Network error while syncing from Elementor.</p>' });
				});
		},

		// ------------------------------------------------------------------
		// PLACEHOLDER MODALS (v5 features)
		// ------------------------------------------------------------------

		_openExport: function () {
			if (!EFF.state.currentFile && EFF.state.variables.length === 0) {
				EFF.Modal.open({ title: 'Nothing to export', body: '<p>Load or create a project first.</p>' });
				return;
			}

			var exportName = (EFF.state.projectName || 'eff-project')
				.trim().replace(/(?:\.eff)+(?:\.json)?$/i, '');
			var suggestedName = exportName
				.toLowerCase()
				.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
				+ '.eff.json';

			var payload = {
				version:    '1.0',
				name:       exportName || '',
				config:     EFF.state.config      || {},
				variables:  EFF.state.variables   || [],
				classes:    EFF.state.classes     || [],
				components: EFF.state.components  || [],
				metadata:   { exported_at: new Date().toISOString() },
			};
			var json = JSON.stringify(payload, null, 2);

			if (typeof window.showSaveFilePicker === 'function') {
				_effPickerGet('export', function (remembered) {
					window.showSaveFilePicker({
						suggestedName: suggestedName,
						startIn:       remembered || 'desktop',
						types: [{ description: 'EFF Project File', accept: { 'application/json': ['.json'] } }],
					}).then(function (fileHandle) {
						_effPickerSave('export', fileHandle);
						return fileHandle.createWritable().then(function (writable) {
							return writable.write(json).then(function () { return writable.close(); });
						});
					}).catch(function (err) {
						if (err && err.name !== 'AbortError') { console.warn('EFF export error:', err); }
					});
				});
			} else {
				// Fallback for browsers without File System Access API.
				var blob = new Blob([json], { type: 'application/json' });
				var url  = URL.createObjectURL(blob);
				var link = document.createElement('a');
				link.href = url; link.download = suggestedName;
				document.body.appendChild(link); link.click(); document.body.removeChild(link);
				setTimeout(function () { URL.revokeObjectURL(url); }, 10000);
			}
		},

		_openImport: function () {
			var self = this;

			if (typeof window.showOpenFilePicker === 'function') {
				_effPickerGet('import', function (remembered) {
					window.showOpenFilePicker({
						startIn:  remembered || 'desktop',
						multiple: false,
						types: [{ description: 'EFF Project File', accept: { 'application/json': ['.json'] } }],
					}).then(function (fileHandles) {
						var fileHandle = fileHandles[0];
						_effPickerSave('import', fileHandle);
						return fileHandle.getFile().then(function (file) {
							return file.text();
						}).then(function (text) {
							self._applyImport(text, null);
						});
					}).catch(function (err) {
						if (err && err.name !== 'AbortError') { console.warn('EFF import error:', err); }
					});
				});
			} else {
				// Fallback for browsers without File System Access API.
				var body =
					'<p style="margin-bottom:12px;color:var(--eff-clr-secondary);line-height:1.6">'
					+ 'Select a <code>.eff.json</code> file exported from EFF.</p>'
					+ '<input type="file" id="eff-import-file" accept=".json" '
					+ 'style="display:block;width:100%;padding:8px 0;cursor:pointer">'
					+ '<div id="eff-import-status" style="font-size:12px;color:var(--eff-clr-muted);margin-top:8px;min-height:18px"></div>';
				var footer =
					'<button class="eff-btn" id="eff-import-cancel" style="margin-right:8px">Cancel</button>'
					+ '<button class="eff-btn" id="eff-import-go">Import</button>';

				EFF.Modal.open({ title: 'Import project', body: body, footer: footer });

				requestAnimationFrame(function () {
					var fileInput = document.getElementById('eff-import-file');
					var statusEl  = document.getElementById('eff-import-status');
					var cancelBtn = document.getElementById('eff-import-cancel');
					var importBtn = document.getElementById('eff-import-go');

					if (cancelBtn) { cancelBtn.addEventListener('click', function () { EFF.Modal.close(); }); }
					if (fileInput) {
						fileInput.addEventListener('change', function () {
							if (statusEl) { statusEl.textContent = fileInput.files[0] ? fileInput.files[0].name : ''; }
						});
					}
					if (importBtn) {
						importBtn.addEventListener('click', function () {
							if (!fileInput || !fileInput.files || !fileInput.files[0]) {
								if (statusEl) { statusEl.textContent = 'Please choose a file first.'; }
								return;
							}
							var reader = new FileReader();
							reader.onload = function (e) { self._applyImport(e.target.result, statusEl); };
							reader.readAsText(fileInput.files[0]);
						});
					}
				});
			}
		},

		/**
		 * Parse and load an imported .eff.json text string into app state.
		 *
		 * @param {string}          text      Raw JSON string.
		 * @param {HTMLElement|null} statusEl  Element to write error messages into (fallback modal only).
		 */
		_applyImport: function (text, statusEl) {
			var parsed;
			try { parsed = JSON.parse(text); } catch (err) {
				if (statusEl) { statusEl.textContent = 'Invalid JSON \u2014 could not parse file.'; }
				else { EFF.Modal.open({ title: 'Import error', body: '<p>Invalid JSON \u2014 could not parse file.</p>' }); }
				return;
			}
			if (!parsed || typeof parsed !== 'object') {
				if (statusEl) { statusEl.textContent = 'File does not look like an EFF project.'; }
				else { EFF.Modal.open({ title: 'Import error', body: '<p>File does not look like an EFF project.</p>' }); }
				return;
			}

			EFF.state.variables   = Array.isArray(parsed.variables)                          ? parsed.variables  : [];
			EFF.state.classes     = Array.isArray(parsed.classes)                            ? parsed.classes    : [];
			EFF.state.components  = Array.isArray(parsed.components)                         ? parsed.components : [];
			EFF.state.config      = (parsed.config && typeof parsed.config === 'object')     ? parsed.config     : {};
			var importedName = (parsed.name || '').replace(/(?:\.eff)+(?:\.json)?$/i, '');
			EFF.state.projectName = importedName;

			if (EFF.PanelRight && EFF.PanelRight._filenameInput) {
				EFF.PanelRight._filenameInput.value = importedName;
			}

			EFF.App.refreshCounts();
			if (EFF.PanelLeft) { EFF.PanelLeft.refresh(); }
			if (EFF.state.currentSelection && EFF.EditSpace) {
				EFF.EditSpace.loadCategory(EFF.state.currentSelection);
			}
			EFF.App.setDirty(true);
			EFF.App.fetchUsageCounts();
			EFF.Modal.close();
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
		/**
		 * Build HTML rows for the categories editor inside the Manage Project modal.
		 *
		 * @param {Array} cats Array of {id, name, order, locked} objects.
		 * @returns {string}
		 * @private
		 */
		_buildCatsEditorHtml: function (cats) {
			var self = this;
			if (!cats || cats.length === 0) {
				return '<p style="font-size:12px;color:var(--eff-clr-muted)">No categories yet. Load a file or add one below.</p>';
			}
			var html = '';
			for (var i = 0; i < cats.length; i++) {
				var cat    = cats[i];
				var locked = !!(cat.locked || cat.name === 'Uncategorized');
				html += '<div class="eff-cats-row" data-cat-id="' + self._escapeHtml(cat.id || cat.name) + '"'
					+ ' style="display:flex;align-items:center;gap:8px;margin-bottom:6px">'
					+ '<input class="eff-field-input eff-cats-name-input" value="' + self._escapeHtml(cat.name) + '"'
					+ (locked ? ' disabled' : '')
					+ ' style="flex:1' + (locked ? ';opacity:0.6' : '') + '">'
					+ (locked
						? '<span style="font-size:11px;color:var(--eff-clr-muted);min-width:52px;text-align:center">locked</span>'
						: '<button class="eff-btn eff-btn--sm eff-cats-del-btn" style="flex-shrink:0">Delete</button>')
					+ '</div>';
			}
			return html;
		},

		/**
		 * Bind add-category and delete-category events in the Manage Project modal.
		 * @private
		 */
		_bindCatsEditor: function () {
			var list   = document.getElementById('eff-proj-cats-list');
			var addBtn = document.getElementById('eff-proj-cats-add');

			if (list) {
				list.addEventListener('click', function (e) {
					var btn = e.target && e.target.closest ? e.target.closest('.eff-cats-del-btn') : null;
					if (btn) {
						var row = btn.closest('.eff-cats-row');
						if (row && row.parentNode) { row.parentNode.removeChild(row); }
					}
				});
			}

			if (addBtn) {
				addBtn.addEventListener('click', function () {
					if (!list) { return; }
					var newId = 'cat-' + Date.now();
					var row   = document.createElement('div');
					row.className = 'eff-cats-row';
					row.setAttribute('data-cat-id', newId);
					row.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:6px';
					row.innerHTML = '<input class="eff-field-input eff-cats-name-input" value="New Category" style="flex:1">'
						+ '<button class="eff-btn eff-btn--sm eff-cats-del-btn" style="flex-shrink:0">Delete</button>';
					list.appendChild(row);
					var input = row.querySelector('.eff-cats-name-input');
					if (input) { input.focus(); input.select(); }
				});
			}
		},

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
