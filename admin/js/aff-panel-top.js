/**
 * AFF Panel Top — Top Menu Bar Buttons, Tooltips, and Modal Launchers
 *
 * Manages:
 *  - Tooltip display (CSS-driven, 300ms delay)
 *  - All top menu bar button click handlers
 *  - Modal content builders for each top-bar action
 *
 * @package AtomicFrameworkForge
 */

/* global AFFData */
(function () {
	'use strict';

	window.AFF = window.AFF || {};

	// ------------------------------------------------------------------
	// FILE PICKER DIRECTORY MEMORY
	// Stores the last FileSystemFileHandle from Export / Import in
	// IndexedDB so the next call opens in the same directory.
	// Falls back to the Desktop on first use.
	// ------------------------------------------------------------------

	var _effPickerDB = null;

	function _effPickerDbOpen(cb) {
		if (_effPickerDB) { cb(_effPickerDB); return; }
		var req = indexedDB.open('aff-picker', 1);
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

	AFF.PanelTop = {

		_showTooltips:     true,  // false → all tooltips suppressed
		_extendedTooltips: false, // true → show data-aff-tooltip-long text when available

		/** @type {HTMLElement|null} */
		_tooltip: null,
		/** @type {number|null} */
		_tooltipTimer: null,

		/**
		 * Initialize all top bar interactions.
		 */
		init: function () {
			this._tooltip = document.getElementById('aff-tooltip');

			this._bindTooltips();
			this._bindButtons();

		// Load tooltip preferences from settings (async, non-blocking)
		var _panelTop = this;
		AFF.App.ajax('aff_get_settings', {}).then(function (res) {
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
		 * Bind tooltip show/hide to all elements with [data-aff-tooltip].
		 */
		_bindTooltips: function () {
			var self = this;

			// Delegated listener — covers dynamically created elements in the colors/fonts/numbers views.
		// _tipEl tracks the active tooltip element to prevent repeated show calls as the mouse
		// moves over child nodes (SVG paths, spans, etc.) of the same trigger element.
		var _tipEl = null;
		document.addEventListener('mouseover', function (e) {
			var target = e.target.closest ? e.target.closest('[data-aff-tooltip]') : null;
			if (target !== _tipEl) {
				if (_tipEl) { self._hideTooltip(); }
				_tipEl = target;
				if (target) { self._showTooltip(target); }
			}
		});
		document.addEventListener('mouseout', function (e) {
			var target = e.target.closest ? e.target.closest('[data-aff-tooltip]') : null;
			if (target && target === _tipEl) {
				var rt = e.relatedTarget;
				if (!rt || !target.contains(rt)) { _tipEl = null; self._hideTooltip(); }
			}
		});
		document.addEventListener('focusin', function (e) {
			if (e.target && e.target.getAttribute && e.target.getAttribute('data-aff-tooltip')) { self._showTooltip(e.target); }
		});
		document.addEventListener('focusout', function (e) {
			if (e.target && e.target.getAttribute && e.target.getAttribute('data-aff-tooltip')) { self._hideTooltip(); }
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
			? (anchor.getAttribute('data-aff-tooltip-long') || anchor.getAttribute('data-aff-tooltip'))
			: anchor.getAttribute('data-aff-tooltip');

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
				'aff-btn-preferences':    self._openPreferences.bind(self),
				'aff-btn-manage-project': self._openManageProject.bind(self),
				'aff-btn-export':         self._openExport.bind(self),
				'aff-btn-import':         self._openImport.bind(self),
				'aff-btn-history':        self._openHistory.bind(self),
				'aff-btn-search':         self._openSearch.bind(self),
				'aff-btn-help':           self._openHelp.bind(self),
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
			var btn      = document.getElementById('aff-btn-functions');
			var dropdown = document.getElementById('aff-dropdown-functions');

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
				var item = e.target.closest('.aff-dropdown__item');
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
			var btn      = document.getElementById('aff-btn-functions');
			var dropdown = document.getElementById('aff-dropdown-functions');
			if (dropdown) { dropdown.classList.remove('is-open'); }
			if (btn)      { btn.setAttribute('aria-expanded', 'false'); }
		},

		/**
		 * Placeholder modal — Convert V3 Variables.
		 * @private
		 */
		_openConvertV3: function () {
			AFF.Modal.open(
				'Convert V3 Variables',
				'<p style="color:var(--aff-clr-secondary);line-height:1.6">'
				+ 'This tool will scan your variables for Elementor V3 naming patterns and '
				+ 'offer to rename them to the V4 convention.'
				+ '</p>'
				+ '<p style="margin-top:12px;color:var(--aff-clr-muted);font-size:var(--fs-sm)">'
				+ 'Coming in a future release.'
				+ '</p>',
				'<button class="aff-btn" id="aff-modal-close-btn">Close</button>'
			);
			var closeBtn = document.getElementById('aff-modal-close-btn');
			if (closeBtn) { closeBtn.addEventListener('click', function () { AFF.Modal.close(); }); }
		},

		/**
		 * Placeholder modal — Change Variable Types.
		 * @private
		 */
		_openChangeTypes: function () {
			AFF.Modal.open(
				'Change Variable Types',
				'<p style="color:var(--aff-clr-secondary);line-height:1.6">'
				+ 'This tool will let you bulk-change the type (format) of selected variables — '
				+ 'for example, converting a group of HEX colors to RGBA.'
				+ '</p>'
				+ '<p style="margin-top:12px;color:var(--aff-clr-muted);font-size:var(--fs-sm)">'
				+ 'Coming in a future release.'
				+ '</p>',
				'<button class="aff-btn" id="aff-modal-close-btn">Close</button>'
			);
			var closeBtn = document.getElementById('aff-modal-close-btn');
			if (closeBtn) { closeBtn.addEventListener('click', function () { AFF.Modal.close(); }); }
		},

		// ------------------------------------------------------------------
		// MODAL CONTENT — Preferences
		// ------------------------------------------------------------------

		_openPreferences: function () {
			var settings = (AFF.state && AFF.state.settings && Object.keys(AFF.state.settings).length)
				? AFF.state.settings
				: null;

			if (settings) {
				if (AFF.EditSpace) { AFF.EditSpace.showPreferences(settings); }
				return;
			}

			// Settings not cached yet — fetch first, then show.
			AFF.App.ajax('aff_get_settings', {}).then(function (res) {
				var s = (res.success && res.data && res.data.settings) ? res.data.settings : {};
				AFF.state.settings = s;
				if (AFF.EditSpace) { AFF.EditSpace.showPreferences(s); }
			}).catch(function () {
				if (AFF.EditSpace) { AFF.EditSpace.showPreferences({}); }
			});
		},

		// ------------------------------------------------------------------
		// MODAL CONTENT — Manage Project (subgroup editor)
		// ------------------------------------------------------------------

		_openManageProject: function () {
			var config  = AFF.state.config;
			var cfg      = AFF.state.config || {};
		var projName = AFF.state.projectName || '';
		function _catsToStr(arr) {
			return (arr || []).filter(function (c) { return !c.locked && c.name !== 'Uncategorized'; })
				.map(function (c) { return c.name; }).join(', ');
		}
		var colorsStr  = _catsToStr(cfg.colorCategories || cfg.categories) || 'Branding, Backgrounds, Neutral, Status';
		var fontsStr   = _catsToStr(cfg.fontCategories)  || 'Titles, Text';
		var numbersStr = _catsToStr(cfg.numberCategories) || 'Spacing, Gaps, Grids, Radius';
		function _catPanel(label, id, value) {
			return '<div style="margin-bottom:16px">'
				+ '<p class="aff-field-label" style="margin-bottom:4px">' + label + ' Categories</p>'
				+ '<p style="font-size:12px;color:var(--aff-clr-muted);margin-bottom:6px">'
				+ 'Comma-separated. \u201cUncategorized\u201d is added automatically.</p>'
				+ '<input type="text" class="aff-field-input" id="' + id + '"'
				+ ' value="' + value + '" style="width:100%" autocomplete="off" spellcheck="false">'
				+ '</div>';
		}
		var projNameEscaped = AFF.Utils.escHtml(projName);
		var body = '<div style="margin-bottom:20px">'
			+ '<label class="aff-field-label" for="aff-proj-name">Project name</label>'
			+ '<input type="text" class="aff-field-input" id="aff-proj-name"'
			+ ' placeholder="e.g., My Brand" autocomplete="off" spellcheck="false"'
			+ ' value="' + projNameEscaped + '" style="width:100%">'
			+ '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:4px">'
			+ '<p style="font-size:12px;color:var(--aff-clr-muted);margin:0">'
			+ 'Used as the project folder name: <em>project-name/</em></p>'
			+ '<button type="button" id="aff-proj-switch" class="aff-btn aff-btn--xs">Switch project</button>'
			+ '</div>'
			+ '</div>'
			+ '<div style="border-top:1px solid var(--aff-clr-border,#d6ccc2);padding-top:16px">'
			+ _catPanel('Colors',  'aff-proj-cat-colors',  AFF.Utils.escHtml(colorsStr))
			+ _catPanel('Fonts',   'aff-proj-cat-fonts',   AFF.Utils.escHtml(fontsStr))
			+ _catPanel('Numbers', 'aff-proj-cat-numbers', AFF.Utils.escHtml(numbersStr))
			+ '</div>'
			+ '<div style="margin-top:16px;padding-top:16px;border-top:1px solid var(--aff-clr-border,#d6ccc2)">'
			+ '<label class="aff-field-label" for="aff-proj-max-backups"'
			+ ' style="font-size:11px;margin-bottom:4px">Max backups per project</label>'
			+ '<input type="number" class="aff-field-input" id="aff-proj-max-backups"'
			+ ' min="1" max="50" style="width:80px" />'
			+ '</div>'
			+ '<div style="border-top:1px solid var(--aff-clr-border,#d6ccc2);padding-top:16px;margin-top:16px">'
			+ '<p class="aff-field-label">Default Format</p>'
			+ '<p style="font-size:12px;color:var(--aff-clr-muted);margin-bottom:8px">Formatting default for variables.</p>'
			+ '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px">'
			+ '<div>'
			+ '<label class="aff-field-label" for="aff-proj-colors-type" style="font-size:11px;margin-bottom:4px">Colors</label>'
			+ '<select class="aff-field-input" id="aff-proj-colors-type" style="width:100%">'
			+ ['HEX','HEXA','RGB','RGBA','HSL','HSLA'].map(function (t) { return '<option value="' + t + '">' + t + '</option>'; }).join('')
			+ '</select>'
			+ '</div>'
			+ '<div>'
			+ '<label class="aff-field-label" for="aff-proj-fonts-type" style="font-size:11px;margin-bottom:4px">Fonts</label>'
			+ '<select class="aff-field-input" id="aff-proj-fonts-type" style="width:100%">'
			+ ['System','Custom'].map(function (t) { return '<option value="' + t + '">' + t + '</option>'; }).join('')
			+ '</select>'
			+ '</div>'
			+ '<div>'
			+ '<label class="aff-field-label" for="aff-proj-numbers-type" style="font-size:11px;margin-bottom:4px">Numbers</label>'
			+ '<select class="aff-field-input" id="aff-proj-numbers-type" style="width:100%">'
			+ ['PX','%','EM','REM','VW','VH','CH','FX'].map(function (t) { return '<option value="' + t + '">' + t + '</option>'; }).join('')
			+ '</select>'
			+ '</div>'
			+ '</div>'
			+ '</div>';
		var footer = '<button class="aff-btn" id="aff-proj-cancel" style="margin-right:8px">Cancel</button>'
			+ '<button class="aff-btn" id="aff-proj-save">Save</button>';
		AFF.Modal.open({ title: 'Manage project', body: body, footer: footer });
		requestAnimationFrame(function () {
			var cancelBtn = document.getElementById('aff-proj-cancel');
			var saveBtn   = document.getElementById('aff-proj-save');
			if (cancelBtn) { cancelBtn.addEventListener('click', function () { AFF.Modal.close(); }); }
			if (saveBtn)   { saveBtn.addEventListener('click', this._saveProjectConfig.bind(this)); }
			var switchBtn = document.getElementById('aff-proj-switch');
			if (switchBtn) {
				switchBtn.addEventListener('click', function () {
					AFF.Modal.close();
					AFF.PanelRight._openProjectPicker();
				});
			}
			var projNameInput = document.getElementById('aff-proj-name');
			if (projNameInput) {
				projNameInput.addEventListener('focus', function () { this.select(); });
				projNameInput.focus();
				projNameInput.select();
			}
			// Load saved default types and populate selects
			AFF.App.ajax('aff_get_settings', {}).then(function (res) {
				var s = res.success && res.data && res.data.settings ? res.data.settings : {};
				var selColors  = document.getElementById('aff-proj-colors-type');
				var selFonts   = document.getElementById('aff-proj-fonts-type');
				var selNumbers = document.getElementById('aff-proj-numbers-type');
				if (selColors  && s.colors_default_type)  { selColors.value  = s.colors_default_type; }
				if (selFonts   && s.fonts_default_type)   { selFonts.value   = s.fonts_default_type; }
				if (selNumbers && s.numbers_default_type) { selNumbers.value = s.numbers_default_type; }
				var maxInput = document.getElementById('aff-proj-max-backups');
				if (maxInput && s.max_backups) { maxInput.value = s.max_backups; }
			});
			// Save default types on change
			var colorsTypeSel  = document.getElementById('aff-proj-colors-type');
			var fontsTypeSel   = document.getElementById('aff-proj-fonts-type');
			var numbersTypeSel = document.getElementById('aff-proj-numbers-type');
			if (colorsTypeSel) {
				colorsTypeSel.addEventListener('change', function () {
					AFF.App.ajax('aff_save_settings', { settings: JSON.stringify({ colors_default_type: colorsTypeSel.value }) });
				});
			}
			if (fontsTypeSel) {
				fontsTypeSel.addEventListener('change', function () {
					AFF.App.ajax('aff_save_settings', { settings: JSON.stringify({ fonts_default_type: fontsTypeSel.value }) });
				});
			}
			if (numbersTypeSel) {
				numbersTypeSel.addEventListener('change', function () {
					AFF.App.ajax('aff_save_settings', { settings: JSON.stringify({ numbers_default_type: numbersTypeSel.value }) });
				});
			}
		}.bind(this));
		},

		/**
		 * Read the Manage Project form and save config via AJAX.
		 * @private
		 */
		_saveProjectConfig: function () {
			var projNameEl  = document.getElementById('aff-proj-name');
		var colCatEl    = document.getElementById('aff-proj-cat-colors');
		var fntCatEl    = document.getElementById('aff-proj-cat-fonts');
		var numCatEl    = document.getElementById('aff-proj-cat-numbers');
		var projName    = (projNameEl ? projNameEl.value.trim() : (AFF.state.projectName || '')).replace(/(?:\.eff)+(?:\.json)?$/i, '');

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

		var cfg         = AFF.state.config || {};
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
		var vars = AFF.state.variables || [];
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
					saveVarPromises.push(AFF.App.ajax('aff_save_color', { variable: JSON.stringify(v) }));
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

		var maxInput = document.getElementById('aff-proj-max-backups');
		if (maxInput && maxInput.value) {
			AFF.App.ajax('aff_save_settings', {
				settings: JSON.stringify({ max_backups: parseInt(maxInput.value, 10) || 10 }),
			});
		}

		Promise.all(saveVarPromises).then(function () {
			return AFF.App.ajax('aff_save_config', { config: JSON.stringify(config) });
		}).then(function (res) {
			if (res && res.success) {
				AFF.state.config      = config;
				AFF.state.projectName = projName;
				if (projName && AFF.PanelRight && AFF.PanelRight._filenameInput) {
					var slugged = projName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
					AFF.PanelRight._filenameInput.value = projName;
					if (!AFF.state.currentFile || AFF.state.currentFile === 'aff-temp.aff.json') {
						AFF.state.currentFile = slugged + '.eff.json';
					}
				}
				AFF.PanelLeft.refresh();
				if (AFF.Colors && AFF.Colors._rerenderView && AFF.state.currentSelection &&
						AFF.state.currentSelection.subgroup === 'Colors') {
					AFF.Colors._rerenderView();
				}
				AFF.Modal.close();
			} else {
				AFF.Modal.open({ title: 'Save error', body: '<p>' + ((res && res.data && res.data.message) || 'Unknown error.') + '</p>' });
			}
		}).catch(function () {
			AFF.Modal.open({ title: 'Save error', body: '<p>Network error while saving config.</p>' });
		});
		},

		// ------------------------------------------------------------------
		// MODAL CONTENT — Search
		// ------------------------------------------------------------------

		_openSearch: function () {
			var body = '<input type="text" class="aff-field-input" id="aff-search-input" '
				+ 'placeholder="Search variables, classes, components..." autocomplete="off" />'
				+ '<div id="aff-search-results" style="margin-top:16px;min-height:40px"></div>';

			AFF.Modal.open({
				title: 'Search',
				body:  body,
			});

			requestAnimationFrame(function () {
				var input   = document.getElementById('aff-search-input');
				var results = document.getElementById('aff-search-results');

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
						results.innerHTML = '<p class="aff-text-muted" style="font-size:13px">Type at least 2 characters to search.</p>';
						return;
					}

					var matches = AFF.state.variables.filter(function (v) {
						return v.name.toLowerCase().includes(query)
							|| v.value.toLowerCase().includes(query);
					});

					if (!matches.length) {
						results.innerHTML = '<p class="aff-text-muted" style="font-size:13px">No results found.</p>';
						return;
					}

					var html = '<ul style="list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:4px">';
					matches.forEach(function (v) {
						html += '<li style="display:flex;justify-content:space-between;padding:4px 8px;border-radius:4px;background:var(--aff-bg-panel)">'
							+ '<code style="font-size:12px;color:var(--aff-clr-primary)">' + v.name + '</code>'
							+ '<span style="font-size:12px;color:var(--aff-clr-muted)">' + v.value + '</span>'
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
			var self   = this;
			var silent = options && options.silent;
			var btn    = document.getElementById('aff-btn-sync-variables');
			if (btn) {
				btn.style.opacity = '0.5';
				btn.disabled      = true;
			}

			AFF.App.ajax('aff_sync_from_elementor', {})
				.then(function (res) {
					if (btn) {
						btn.style.opacity = '';
						btn.disabled      = false;
					}

					if (res.success) {
						var vars    = res.data.variables || [];
						var source  = res.data.source    || '';

						// Partition Elementor vars into: new / conflict / match.
						var partition = AFF.Merge.buildConflictList(vars, AFF.state.variables);

						// Add new variables to state immediately (no conflict risk).
						self._applyNewVars(partition.newVars);

						if (partition.conflictVars.length > 0 && !silent) {
							// Open the merge dialog; apply resolutions on confirm.
							AFF.Merge.openMergeDialog(
								partition.conflictVars,
								'fetch',
								function (resolved) {
									// Apply "Use Elementor" wins to AFF state.
									var elWins = 0;
									resolved.forEach(function (r) {
										if (r.winner === 'el') {
											for (var i = 0; i < AFF.state.variables.length; i++) {
												if (AFF.state.variables[i].name.toLowerCase() === r.name) {
													// Find the Elementor value for this name.
													for (var j = 0; j < vars.length; j++) {
														if ((vars[j].name || '').toLowerCase() === r.name) {
															AFF.state.variables[i].value      = vars[j].value;
															AFF.state.variables[i].updated_at = new Date().toISOString();
															elWins++;
															break;
														}
													}
													break;
												}
											}
										}
									});

									if (partition.newVars.length > 0 || elWins > 0) {
										AFF.App.setDirty(true);
									}
									self._postSyncRefresh(source, partition.newVars.length, partition.conflictVars.length);
								},
								function () {
									// User cancelled — new vars already added; no further action.
									if (partition.newVars.length > 0) {
										AFF.App.setDirty(true);
										self._postSyncRefresh(source, partition.newVars.length, 0);
									}
								}
							);
						} else {
							// No conflicts — proceed as before.
							if (partition.newVars.length > 0 && !silent) {
								AFF.App.setDirty(true);
							}
							AFF.App.fetchUsageCounts();
							if (!silent) {
								self._postSyncRefresh(source, partition.newVars.length, 0);
							}
						}

					} else if (!silent) {
						AFF.PanelTop._showSyncFailedModal(res.data || {});
					}
				})
				.catch(function () {
					if (btn) {
						btn.style.opacity = '';
						btn.disabled      = false;
					}
					if (!silent) {
						AFF.Modal.open({
							title: 'Sync error',
							body:  '<p>Network error while syncing from Elementor.</p>',
						});
					}
				});
		},

		/**
		 * Add freshly-fetched Elementor variables (no name collision) to AFF state.
		 * Shared between the conflict and no-conflict sync paths.
		 *
		 * @param {Array} newVars  [{name, value}, ...] from buildConflictList().newVars
		 */
		_applyNewVars: function (newVars) {
			newVars.forEach(function (v) {
				var lc       = (v.value || '').trim().toLowerCase();
				var isColor  = AFF.Utils.isColorValue(lc);
				var isFont   = !isColor && /\b(serif|sans-serif|monospace|cursive|fantasy|system-ui|ui-sans-serif|ui-serif|ui-monospace)\b/.test(lc);
				var isNumber = !isColor && !isFont && (
					/^\d/.test(lc)
					|| lc.indexOf('clamp(') === 0 || lc.indexOf('calc(') === 0
					|| lc.indexOf('min(')   === 0 || lc.indexOf('max(')  === 0
					|| /\d+(px|rem|em|%|vw|vh|ch|fr|pt|deg|ms)\b/.test(lc)
				);
				var subgroup = isColor ? 'Colors' : (isFont ? 'Fonts' : (isNumber ? 'Numbers' : ''));

				// Determine the Numbers format (unit selector value).
				// Priority: Elementor-supplied unit (el_unit) > value-based inference.
				var format = '';
				if (isNumber) {
					var elUnit = (v.el_unit || '').toLowerCase();
					if (elUnit) {
						// Map Elementor unit to AFF format label.
						var unitMap = { px: 'PX', '%': '%', em: 'EM', rem: 'REM',
						                vw: 'VW', vh: 'VH', ch: 'CH' };
						format = unitMap[elUnit] || elUnit.toUpperCase();
					} else {
						// Infer from value string (CSS file path or string-type vars).
						if (/^(clamp|calc|min|max)\s*\(/.test(lc))  { format = 'FX'; }
						else if (/\d+rem\b/.test(lc))               { format = 'REM'; }
						else if (/\d+em\b/.test(lc))                { format = 'EM'; }
						else if (/\d+px\b/.test(lc))                { format = 'PX'; }
						else if (/\d+%/.test(lc))                   { format = '%'; }
						else if (/\d+vw\b/.test(lc))                { format = 'VW'; }
						else if (/\d+vh\b/.test(lc))                { format = 'VH'; }
						else if (/\d+ch\b/.test(lc))                { format = 'CH'; }
						else                                         { format = 'REM'; }
					}
				} else if (isColor) {
					format = 'HEX';
				}

				AFF.state.variables.push({
					id:          '',
					name:        v.name.toLowerCase(),
					value:       v.value,
					format:      format,
					source:      'elementor-parsed',
					type:        isColor ? 'color' : (isFont ? 'font' : (isNumber ? 'number' : 'unknown')),
					group:       'Variables',
					subgroup:    subgroup,
					category:    subgroup ? 'Uncategorized' : '',
					category_id: '',
					modified:    false,
					created_at:  new Date().toISOString(),
					updated_at:  new Date().toISOString(),
				});
			});
		},

		/**
		 * Refresh panels, counts, and show a sync-complete toast.
		 *
		 * @param {string} source        AJAX source label (e.g. 'elementor_kit_meta')
		 * @param {number} addedCount    Number of new variables added
		 * @param {number} resolvedCount Number of conflicts shown to the user
		 */
		_postSyncRefresh: function (source, addedCount, resolvedCount) {
			AFF.App.refreshCounts();
			if (AFF.Colors && AFF.Colors._ensureUncategorized) { AFF.Colors._ensureUncategorized(); }
			if (AFF.Variables && AFF.Variables._sets) {
				var _vsets = AFF.Variables._sets;
				if (_vsets['Fonts']   && _vsets['Fonts']._ensureUncategorized)   { _vsets['Fonts']._ensureUncategorized(); }
				if (_vsets['Numbers'] && _vsets['Numbers']._ensureUncategorized) { _vsets['Numbers']._ensureUncategorized(); }
			}
			if (AFF.PanelLeft) { AFF.PanelLeft.refresh(); }
			AFF.App.fetchUsageCounts();

			var parts = [];
			if (addedCount > 0) {
				parts.push(addedCount + ' variable' + (addedCount !== 1 ? 's' : '') + ' added');
			}
			if (resolvedCount > 0) {
				parts.push(resolvedCount + ' conflict' + (resolvedCount !== 1 ? 's' : '') + ' resolved');
			}
			var msg = parts.length > 0 ? parts.join(', ') + '.' : 'Already up to date.';

			AFF.Modal.open({
				title: 'Fetch complete',
				body:  '<p>' + msg + '</p>'
					+ (source ? '<p class="aff-text-muted" style="font-size:12px">Source: ' + source + '</p>' : ''),
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

			var body = '<p style="margin-bottom:8px">' + AFF.Utils.escHtml(message) + '</p>';
			if (hint) {
				body += '<p style="font-size:12px;color:var(--aff-clr-muted);margin-bottom:12px">'
					+ AFF.Utils.escHtml(hint) + '</p>';
			}
			body += '<div style="border-top:1px solid var(--aff-clr-border);padding-top:14px;margin-top:4px">'
				+ '<label class="aff-field-label" for="aff-sync-css-path"'
				+ ' style="font-size:12px;margin-bottom:4px">Try a different CSS file path</label>'
				+ '<p style="font-size:11px;color:var(--aff-clr-muted);margin-bottom:6px">'
				+ 'Must be inside <code>wp-content/uploads/elementor/css/</code></p>'
				+ '<input type="text" class="aff-field-input" id="aff-sync-css-path"'
				+ ' placeholder="...uploads/elementor/css/post-67.css"'
				+ ' value="' + AFF.Utils.escHtml(expectedFile) + '"'
				+ ' autocomplete="off" spellcheck="false" style="width:100%;margin-bottom:8px">'
				+ '<button class="aff-btn" id="aff-sync-retry-btn">Retry with this file</button>'
				+ '</div>';

			AFF.Modal.open({ title: 'Sync failed', body: body });

			requestAnimationFrame(function () {
				var retryBtn = document.getElementById('aff-sync-retry-btn');
				if (retryBtn) {
					retryBtn.addEventListener('click', function () {
						var pathInput = document.getElementById('aff-sync-css-path');
						var cssPath   = pathInput ? pathInput.value.trim() : '';
						if (cssPath) {
							AFF.Modal.close();
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
			var btn  = document.getElementById('aff-btn-sync-variables');
			if (btn) { btn.style.opacity = '0.5'; btn.disabled = true; }

			AFF.App.ajax('aff_sync_from_elementor', { css_file_path: cssPath })
				.then(function (res) {
					if (btn) { btn.style.opacity = ''; btn.disabled = false; }
					if (res.success) {
						var data      = res.data || {};
						var vars      = data.variables || [];
						var partition = AFF.Merge.buildConflictList(vars, AFF.state.variables);

						self._applyNewVars(partition.newVars);

						if (partition.conflictVars.length > 0) {
							AFF.Merge.openMergeDialog(
								partition.conflictVars,
								'fetch',
								function (resolved) {
									var elWins = 0;
									resolved.forEach(function (r) {
										if (r.winner === 'el') {
											for (var i = 0; i < AFF.state.variables.length; i++) {
												if (AFF.state.variables[i].name.toLowerCase() === r.name) {
													for (var j = 0; j < vars.length; j++) {
														if ((vars[j].name || '').toLowerCase() === r.name) {
															AFF.state.variables[i].value      = vars[j].value;
															AFF.state.variables[i].updated_at = new Date().toISOString();
															elWins++;
															break;
														}
													}
													break;
												}
											}
										}
									});
									if (partition.newVars.length > 0 || elWins > 0) { AFF.App.setDirty(true); }
									self._postSyncRefresh(data.source || '', partition.newVars.length, partition.conflictVars.length);
								},
								function () {
									if (partition.newVars.length > 0) {
										AFF.App.setDirty(true);
										self._postSyncRefresh(data.source || '', partition.newVars.length, 0);
									}
								}
							);
						} else {
							if (partition.newVars.length > 0) { AFF.App.setDirty(true); }
							self._postSyncRefresh(data.source || '', partition.newVars.length, 0);
						}
					} else {
						self._showSyncFailedModal(res.data || {});
					}
				})
				.catch(function () {
					if (btn) { btn.style.opacity = ''; btn.disabled = false; }
					AFF.Modal.open({ title: 'Sync error', body: '<p>Network error while syncing from Elementor.</p>' });
				});
		},

		// ------------------------------------------------------------------
		// PLACEHOLDER MODALS (v5 features)
		// ------------------------------------------------------------------

		_openExport: function () {
			if (!AFF.state.currentFile && AFF.state.variables.length === 0) {
				AFF.Modal.open({ title: 'Nothing to export', body: '<p>Load or create a project first.</p>' });
				return;
			}

			var exportName = (AFF.state.projectName || 'aff-project')
				.trim().replace(/(?:\.eff)+(?:\.json)?$/i, '');
			var suggestedName = exportName
				.toLowerCase()
				.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
				+ '.eff.json';

			var payload = {
				version:    '1.0',
				name:       exportName || '',
				config:     AFF.state.config      || {},
				variables:  AFF.state.variables   || [],
				classes:    AFF.state.classes     || [],
				components: AFF.state.components  || [],
				metadata:   { exported_at: new Date().toISOString() },
			};
			var json = JSON.stringify(payload, null, 2);

			if (typeof window.showSaveFilePicker === 'function') {
				_effPickerGet('export', function (remembered) {
					window.showSaveFilePicker({
						suggestedName: suggestedName,
						startIn:       remembered || 'desktop',
						types: [{ description: 'AFF Project File', accept: { 'application/json': ['.json'] } }],
					}).then(function (fileHandle) {
						_effPickerSave('export', fileHandle);
						return fileHandle.createWritable().then(function (writable) {
							return writable.write(json).then(function () { return writable.close(); });
						});
					}).catch(function (err) {
						if (err && err.name !== 'AbortError') { console.warn('AFF export error:', err); }
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
						types: [{ description: 'AFF Project File', accept: { 'application/json': ['.json'] } }],
					}).then(function (fileHandles) {
						var fileHandle = fileHandles[0];
						_effPickerSave('import', fileHandle);
						return fileHandle.getFile().then(function (file) {
							return file.text();
						}).then(function (text) {
							self._applyImport(text, null);
						});
					}).catch(function (err) {
						if (err && err.name !== 'AbortError') { console.warn('AFF import error:', err); }
					});
				});
			} else {
				// Fallback for browsers without File System Access API.
				var body =
					'<p style="margin-bottom:12px;color:var(--aff-clr-secondary);line-height:1.6">'
					+ 'Select a <code>.eff.json</code> file exported from AFF.</p>'
					+ '<input type="file" id="aff-import-file" accept=".json" '
					+ 'style="display:block;width:100%;padding:8px 0;cursor:pointer">'
					+ '<div id="aff-import-status" style="font-size:12px;color:var(--aff-clr-muted);margin-top:8px;min-height:18px"></div>';
				var footer =
					'<button class="aff-btn" id="aff-import-cancel" style="margin-right:8px">Cancel</button>'
					+ '<button class="aff-btn" id="aff-import-go">Import</button>';

				AFF.Modal.open({ title: 'Import project', body: body, footer: footer });

				requestAnimationFrame(function () {
					var fileInput = document.getElementById('aff-import-file');
					var statusEl  = document.getElementById('aff-import-status');
					var cancelBtn = document.getElementById('aff-import-cancel');
					var importBtn = document.getElementById('aff-import-go');

					if (cancelBtn) { cancelBtn.addEventListener('click', function () { AFF.Modal.close(); }); }
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
				else { AFF.Modal.open({ title: 'Import error', body: '<p>Invalid JSON \u2014 could not parse file.</p>' }); }
				return;
			}
			if (!parsed || typeof parsed !== 'object') {
				if (statusEl) { statusEl.textContent = 'File does not look like an AFF project.'; }
				else { AFF.Modal.open({ title: 'Import error', body: '<p>File does not look like an AFF project.</p>' }); }
				return;
			}

			AFF.state.variables   = Array.isArray(parsed.variables)                          ? parsed.variables  : [];
			AFF.state.classes     = Array.isArray(parsed.classes)                            ? parsed.classes    : [];
			AFF.state.components  = Array.isArray(parsed.components)                         ? parsed.components : [];
			AFF.state.config      = (parsed.config && typeof parsed.config === 'object')     ? parsed.config     : {};
			var importedName = (parsed.name || '').replace(/(?:\.eff)+(?:\.json)?$/i, '');
			AFF.state.projectName = importedName;

			if (AFF.PanelRight && AFF.PanelRight._filenameInput) {
				AFF.PanelRight._filenameInput.value = importedName;
			}

			AFF.App.refreshCounts();
			if (AFF.PanelLeft) { AFF.PanelLeft.refresh(); }
			if (AFF.state.currentSelection && AFF.EditSpace) {
				AFF.EditSpace.loadCategory(AFF.state.currentSelection);
			}
			AFF.App.setDirty(true);
			AFF.App.fetchUsageCounts();
			AFF.Modal.close();
		},

		_openHistory: function () {
			AFF.Modal.open({
				title: 'Change history',
				body:  '<p>Change history arrives in AFF v5.</p>',
			});
		},

		_openHelp: function () {
			if (AFF.EditSpace && AFF.EditSpace.showInfoPanel) {
				AFF.EditSpace.showInfoPanel();
			}
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
				return '<p style="font-size:12px;color:var(--aff-clr-muted)">No categories yet. Load a file or add one below.</p>';
			}
			var html = '';
			for (var i = 0; i < cats.length; i++) {
				var cat    = cats[i];
				var locked = !!(cat.locked || cat.name === 'Uncategorized');
				html += '<div class="aff-cats-row" data-cat-id="' + AFF.Utils.escHtml(cat.id || cat.name) + '"'
					+ ' style="display:flex;align-items:center;gap:8px;margin-bottom:6px">'
					+ '<input class="aff-field-input aff-cats-name-input" value="' + AFF.Utils.escHtml(cat.name) + '"'
					+ (locked ? ' disabled' : '')
					+ ' style="flex:1' + (locked ? ';opacity:0.6' : '') + '">'
					+ (locked
						? '<span style="font-size:11px;color:var(--aff-clr-muted);min-width:52px;text-align:center">locked</span>'
						: '<button class="aff-btn aff-btn--sm aff-cats-del-btn" style="flex-shrink:0">Delete</button>')
					+ '</div>';
			}
			return html;
		},

		/**
		 * Bind add-category and delete-category events in the Manage Project modal.
		 * @private
		 */
		_bindCatsEditor: function () {
			var list   = document.getElementById('aff-proj-cats-list');
			var addBtn = document.getElementById('aff-proj-cats-add');

			if (list) {
				list.addEventListener('click', function (e) {
					var btn = e.target && e.target.closest ? e.target.closest('.aff-cats-del-btn') : null;
					if (btn) {
						var row = btn.closest('.aff-cats-row');
						if (row && row.parentNode) { row.parentNode.removeChild(row); }
					}
				});
			}

			if (addBtn) {
				addBtn.addEventListener('click', function () {
					if (!list) { return; }
					var newId = 'cat-' + Date.now();
					var row   = document.createElement('div');
					row.className = 'aff-cats-row';
					row.setAttribute('data-cat-id', newId);
					row.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:6px';
					row.innerHTML = '<input class="aff-field-input aff-cats-name-input" value="New Category" style="flex:1">'
						+ '<button class="aff-btn aff-btn--sm aff-cats-del-btn" style="flex-shrink:0">Delete</button>';
					list.appendChild(row);
					var input = row.querySelector('.aff-cats-name-input');
					if (input) { input.focus(); input.select(); }
				});
			}
		},

		_parseLines: function (text) {
			return text.split('\n')
				.map(function (l) { return l.trim(); })
				.filter(function (l) { return l.length > 0; });
		},

	};
}());
