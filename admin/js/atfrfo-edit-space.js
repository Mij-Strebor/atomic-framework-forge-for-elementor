/**
 * ATFRFO Edit Space — Center Panel Content Area
 *
 * Manages the center edit space content. Renders the category view with a
 * variable list when a category is selected from the left panel. Each
 * variable row includes a usage count badge showing how many times the
 * variable is referenced in Elementor widget data (populated by
 * ATFRFO.App.fetchUsageCounts after file load or sync).
 *
 * The edit space element carries a [data-active] attribute when a category
 * is loaded. CSS uses this to transition the background banner image from
 * visible (initial load) to a faint watermark (during editing).
 *
 * @package AtomicFrameworkForge
 */

/* global ATFRFOData */
(function () {
	'use strict';

	window.ATFRFO = window.ATFRFO || {};

	ATFRFO.EditSpace = {

		/** @type {HTMLElement|null} */
		_placeholder: null,
		/** @type {HTMLElement|null} */
		_content: null,
		/** @type {HTMLElement|null} */
		_workspace: null,

		/**
		 * Initialize the edit space.
		 */
		init: function () {
			this._placeholder = document.getElementById('atfrfo-placeholder');
			this._content     = document.getElementById('atfrfo-edit-content');
			this._workspace   = document.getElementById('atfrfo-workspace');
		},

		/**
		 * Load the content for a selected category.
		 *
		 * @param {{ group: string, subgroup: string, category: string }} selection
		 */
		loadCategory: function (selection) {
			if (!this._content || !this._placeholder) {
				return;
			}

			// Fade background image to watermark opacity
			if (this._workspace) {
				this._workspace.setAttribute('data-active', 'true');
			}

			// Hide placeholder, show content
			this._placeholder.setAttribute('hidden', '');
			this._content.removeAttribute('hidden');

			// Render category scaffold
			this._content.innerHTML = this._buildCategoryView(selection);
		},

		/**
		 * Show the ATFRFO information panel in the edit space.
		 * Clears any active category selection and fills the edit space with
		 * the about / ecosystem content. Deactivates any left-panel selection.
		 */
		showInfoPanel: function () {
			if (!this._content || !this._placeholder) {
				return;
			}

			// Fade background to watermark (same as category load)
			if (this._workspace) {
				this._workspace.setAttribute('data-active', 'true');
			}

			// Clear left-panel active state without triggering a reload
			var activeItems = document.querySelectorAll('.atfrfo-nav-item.is-active');
			for (var i = 0; i < activeItems.length; i++) {
				activeItems[i].classList.remove('is-active');
			}
			ATFRFO.state.currentSelection = null;

			this._placeholder.setAttribute('hidden', '');
			this._content.removeAttribute('hidden');
			this._content.innerHTML = this._buildInfoPanel();
		},

		/**
		 * Show the Preferences panel in the edit space.
		 * Clears any active left-panel selection and fills the edit space with
		 * the user preferences form.
		 *
		 * @param {Object} settings  Current settings from ATFRFO.state.settings.
		 */
		showPreferences: function (settings) {
			if (!this._content || !this._placeholder) {
				return;
			}

			if (this._workspace) {
				this._workspace.setAttribute('data-active', 'true');
			}

			var activeItems = document.querySelectorAll('.atfrfo-nav-item.is-active');
			for (var i = 0; i < activeItems.length; i++) {
				activeItems[i].classList.remove('is-active');
			}
			ATFRFO.state.currentSelection = null;

			this._placeholder.setAttribute('hidden', '');
			this._content.removeAttribute('hidden');
			this._content.innerHTML = this._buildPreferencesView(settings || {});

			this._bindPreferencesEvents();
		},

		/**
		 * Build the Preferences panel HTML.
		 *
		 * @param {Object} settings
		 * @returns {string}
		 * @private
		 */
		_buildPreferencesView: function (settings) {
			var theme       = ATFRFO.state.theme              || 'light';
			var fontSize    = settings.ui_font_size        || 14;
			var contrast    = settings.ui_contrast         || 'standard';
			var btnSize     = settings.ui_btn_size         || 'normal';
			var btnContrast = settings.ui_btn_contrast     || 'standard';
			var density     = settings.layout_density      || 'normal';
			var reduced     = !!settings.reduced_motion;
			var showTips    = settings.show_tooltips       !== false;
			var extTips     = !!settings.extended_tooltips;
			var confirmDel  = settings.confirm_delete_variables !== false;
			var filePath    = ATFRFO.Utils.escHtml(settings.default_file_path || '');

			function choiceBtn(pref, value, current, label) {
				var active = (value === current) ? ' atfrfo-prefs-choice-btn--active' : '';
				return '<button class="atfrfo-btn atfrfo-prefs-choice-btn' + active + '"'
					+ ' data-pref="' + pref + '" data-value="' + value + '">'
					+ label + '</button>';
			}

			function iconSample(size, contrast_val) {
				var isActive   = (btnSize === size && btnContrast === contrast_val);
				var activeClass = isActive ? ' atfrfo-prefs-icon-sample--active' : '';
				var sizeClass   = 'atfrfo-prefs-icon-sample__btn--' + size;
				var hiClass     = (contrast_val === 'high') ? ' atfrfo-prefs-icon-sample__btn--high' : ' atfrfo-prefs-icon-sample__btn--std';
				var labelText   = (size.charAt(0).toUpperCase() + size.slice(1))
					+ (contrast_val === 'high' ? ' &amp; High' : '');
				return '<div class="atfrfo-prefs-icon-sample' + activeClass + '"'
					+ ' data-size="' + size + '" data-contrast="' + contrast_val + '">'
					+ '<button class="atfrfo-prefs-icon-sample__btn ' + sizeClass + hiClass + '"'
					+ ' tabindex="-1" aria-hidden="true">&#9881;</button>'
					+ '<span class="atfrfo-prefs-icon-sample__label">' + labelText + '</span>'
					+ '</div>';
			}

			var html = '<div class="atfrfo-prefs-view">'

				// ── Header ──────────────────────────────────────────────────────
				+ '<div class="atfrfo-prefs-header">'
				+ '<h1 class="atfrfo-prefs-title">Preferences</h1>'
				+ '<p class="atfrfo-prefs-subtitle">Customize the AFF interface to suit your workflow.</p>'
				+ '</div>'

				// ── 1. Appearance ───────────────────────────────────────────
				+ '<section class="atfrfo-prefs-section">'
				+ '<h2 class="atfrfo-prefs-section__title">Appearance</h2>'

				+ '<div class="atfrfo-prefs-field">'
				+ '<p class="atfrfo-field-label">Interface theme</p>'
				+ '<div class="atfrfo-prefs-btn-group">'
				+ choiceBtn('theme', 'light', theme, 'Light')
				+ choiceBtn('theme', 'dark',  theme, 'Dark')
				+ '</div>'
				+ '</div>'

				+ '<div class="atfrfo-prefs-field">'
				+ '<p class="atfrfo-field-label">Layout density</p>'
				+ '<div class="atfrfo-prefs-btn-group">'
				+ choiceBtn('layout_density', 'compact',     density, 'Compact')
				+ choiceBtn('layout_density', 'normal',      density, 'Normal')
				+ choiceBtn('layout_density', 'comfortable', density, 'Comfortable')
				+ '</div>'
				+ '</div>'

				+ '</section>'

				// ── 2. Tooltips ──────────────────────────────────────────────
				+ '<section class="atfrfo-prefs-section">'
				+ '<h2 class="atfrfo-prefs-section__title">Tooltips</h2>'
				+ '<div class="atfrfo-prefs-field">'
				+ '<label class="atfrfo-prefs-check-label">'
				+ '<input type="checkbox" id="atfrfo-pref-tooltips-show"' + (showTips ? ' checked' : '') + '>'
				+ '<span>Show tooltips</span>'
				+ '</label>'
				+ '<label class="atfrfo-prefs-check-label atfrfo-prefs-check-label--indented">'
				+ '<input type="checkbox" id="atfrfo-pref-tooltips-extended"'
				+ (extTips ? ' checked' : '') + (showTips ? '' : ' disabled') + '>'
				+ '<span>Extended mode — show detailed descriptions</span>'
				+ '</label>'
				+ '</div>'
				+ '</section>'

				// ── 2b. Confirmations ───────────────────────────────────────
				+ '<section class="atfrfo-prefs-section">'
				+ '<h2 class="atfrfo-prefs-section__title">Confirmations</h2>'
				+ '<div class="atfrfo-prefs-field">'
				+ '<label class="atfrfo-prefs-check-label">'
				+ '<input type="checkbox" id="atfrfo-pref-confirm-delete"' + (confirmDel ? ' checked' : '') + '>'
				+ '<span>Confirm before deleting variables</span>'
				+ '</label>'
				+ '<p class="atfrfo-prefs-hint">Turn back on if you previously chose &ldquo;Don&rsquo;t ask me again&rdquo; on a delete dialog.</p>'
				+ '</div>'
				+ '</section>'

				// ── 3. Project ────────────────────────────────────────────────
				+ '<section class="atfrfo-prefs-section">'
				+ '<h2 class="atfrfo-prefs-section__title">Project</h2>'
				+ '<div class="atfrfo-prefs-field">'
				+ '<label class="atfrfo-field-label" for="atfrfo-pref-filepath">Default storage file</label>'
				+ '<p class="atfrfo-prefs-hint">Path relative to the WordPress uploads directory. Leave blank to choose each time.</p>'
				+ '<input type="text" class="atfrfo-field-input" id="atfrfo-pref-filepath"'
				+ ' placeholder="e.g., my-project.eff.json" value="' + filePath + '">'
				+ '</div>'
				+ '</section>'

				// ── 4. Typography & Contrast ────────────────────────────────
				+ '<section class="atfrfo-prefs-section">'
				+ '<h2 class="atfrfo-prefs-section__title">Typography &amp; Contrast</h2>'

				+ '<div class="atfrfo-prefs-columns">'

				+ '<div class="atfrfo-prefs-field">'
				+ '<label class="atfrfo-field-label" for="atfrfo-pref-font-size">'
				+ 'Font size — <span id="atfrfo-pref-font-size-label">' + fontSize + 'px</span>'
				+ '</label>'
				+ '<div class="atfrfo-prefs-range-wrap">'
				+ '<span class="atfrfo-prefs-range-min">14</span>'
				+ '<input type="range" id="atfrfo-pref-font-size" class="atfrfo-pref-range"'
				+ ' min="14" max="18" step="1" value="' + fontSize + '">'
				+ '<span class="atfrfo-prefs-range-max">18</span>'
				+ '</div>'
				+ '</div>'

				+ '<div class="atfrfo-prefs-field">'
				+ '<p class="atfrfo-field-label">Color contrast</p>'
				+ '<div class="atfrfo-prefs-btn-group">'
				+ choiceBtn('ui_contrast', 'standard', contrast, 'Standard')
				+ choiceBtn('ui_contrast', 'high',     contrast, 'High')
				+ '</div>'
				+ '</div>'

				+ '</div>'

				// Typography live demo
				+ '<div class="atfrfo-prefs-demo">'
				+ '<p class="atfrfo-prefs-demo-label">Live preview</p>'
				+ '<div class="atfrfo-prefs-demo-inner">'
				+ '<p class="atfrfo-prefs-demo-heading">Heading — Atomic Framework Forge for Elementor</p>'
				+ '<p class="atfrfo-prefs-demo-body">Body text — the quick brown fox jumps over the lazy dog.</p>'
				+ '<p class="atfrfo-prefs-demo-muted">Secondary text — supporting information and labels</p>'
				+ '</div>'
				+ '</div>'

				+ '</section>'

				// ── 5. Menu Buttons ─────────────────────────────────────────
				+ '<section class="atfrfo-prefs-section">'
				+ '<h2 class="atfrfo-prefs-section__title">Menu Buttons</h2>'

				+ '<div class="atfrfo-prefs-columns">'

				+ '<div class="atfrfo-prefs-field">'
				+ '<p class="atfrfo-field-label">Button size</p>'
				+ '<div class="atfrfo-prefs-btn-group">'
				+ choiceBtn('ui_btn_size', 'normal', btnSize, 'Normal')
				+ choiceBtn('ui_btn_size', 'large',  btnSize, 'Large')
				+ '</div>'
				+ '</div>'

				+ '<div class="atfrfo-prefs-field">'
				+ '<p class="atfrfo-field-label">Button contrast</p>'
				+ '<div class="atfrfo-prefs-btn-group">'
				+ choiceBtn('ui_btn_contrast', 'standard', btnContrast, 'Standard')
				+ choiceBtn('ui_btn_contrast', 'high',     btnContrast, 'High')
				+ '</div>'
				+ '</div>'

				+ '</div>'

				// Icon button preview
				+ '<div class="atfrfo-prefs-demo atfrfo-prefs-demo--btn">'
				+ '<p class="atfrfo-prefs-demo-label">Top bar button preview</p>'
				+ '<div class="atfrfo-prefs-demo-inner">'
				+ iconSample('normal', 'standard')
				+ iconSample('normal', 'high')
				+ iconSample('large',  'standard')
				+ iconSample('large',  'high')
				+ '</div>'
				+ '</div>'

				+ '</section>'

				// ── 6. Motion ─────────────────────────────────────────────────
				+ '<section class="atfrfo-prefs-section">'
				+ '<h2 class="atfrfo-prefs-section__title">Motion</h2>'
				+ '<div class="atfrfo-prefs-field">'
				+ '<label class="atfrfo-prefs-check-label">'
				+ '<input type="checkbox" id="atfrfo-pref-reduced-motion"' + (reduced ? ' checked' : '') + '>'
				+ '<span>Reduce motion and animations</span>'
				+ '</label>'
				+ '</div>'
				+ '</section>'

				+ '</div>';

			return html;
		},

		/**
		 * Bind all interactive events within the currently rendered preferences view.
		 *
		 * @private
		 */
		_bindPreferencesEvents: function () {
			var self    = this;
			var content = this._content;
			if (!content) { return; }

			var app = document.getElementById('atfrfo-app');

			// ── Choice buttons ───────────────────────────────────────────────
			var choiceBtns = content.querySelectorAll('.atfrfo-prefs-choice-btn');
			for (var i = 0; i < choiceBtns.length; i++) {
				(function (btn) {
					btn.addEventListener('click', function () {
						var pref  = btn.getAttribute('data-pref');
						var value = btn.getAttribute('data-value');

						// Deselect siblings in the same pref group
						var siblings = content.querySelectorAll('[data-pref="' + pref + '"]');
						for (var j = 0; j < siblings.length; j++) {
							siblings[j].classList.remove('atfrfo-prefs-choice-btn--active');
						}
						btn.classList.add('atfrfo-prefs-choice-btn--active');

						// Apply + persist
						if (pref === 'theme') {
							if (ATFRFO.Theme) { ATFRFO.Theme.set(value); }
						} else if (pref === 'layout_density') {
							if (app) {
								if (value === 'normal') { app.removeAttribute('data-atfrfo-density'); }
								else { app.setAttribute('data-atfrfo-density', value); }
							}
							self._savePreference({ layout_density: value });
						} else if (pref === 'ui_contrast') {
							if (app) {
								if (value === 'standard') { app.removeAttribute('data-atfrfo-contrast'); }
								else { app.setAttribute('data-atfrfo-contrast', value); }
							}
							self._savePreference({ ui_contrast: value });
						} else if (pref === 'ui_btn_size') {
							if (app) {
								if (value === 'normal') { app.removeAttribute('data-atfrfo-btn-size'); }
								else { app.setAttribute('data-atfrfo-btn-size', value); }
							}
							self._savePreference({ ui_btn_size: value });
							self._updateBtnSamples(content);
						} else if (pref === 'ui_btn_contrast') {
							if (app) {
								if (value === 'standard') { app.removeAttribute('data-atfrfo-btn-contrast'); }
								else { app.setAttribute('data-atfrfo-btn-contrast', value); }
							}
							self._savePreference({ ui_btn_contrast: value });
							self._updateBtnSamples(content);
						}
					});
				}(choiceBtns[i]));
			}

			// ── Font size range ──────────────────────────────────────────────
			var sizeRange = document.getElementById('atfrfo-pref-font-size');
			var sizeLabel = document.getElementById('atfrfo-pref-font-size-label');
			if (sizeRange) {
				sizeRange.addEventListener('input', function () {
					var px = sizeRange.value;
					if (sizeLabel) { sizeLabel.textContent = px + 'px'; }
					if (app) {
						if (px === '16') {
							app.removeAttribute('data-atfrfo-font-size');
						} else {
							app.setAttribute('data-atfrfo-font-size', px);
						}
					}
				});
				sizeRange.addEventListener('change', function () {
					self._savePreference({ ui_font_size: parseInt(sizeRange.value, 10) });
				});
			}

			// ── Reduced motion ───────────────────────────────────────────────
			var motionChk = document.getElementById('atfrfo-pref-reduced-motion');
			if (motionChk) {
				motionChk.addEventListener('change', function () {
					if (app) {
						if (motionChk.checked) {
							app.setAttribute('data-atfrfo-motion', 'reduced');
						} else {
							app.removeAttribute('data-atfrfo-motion');
						}
					}
					self._savePreference({ reduced_motion: motionChk.checked });
				});
			}

			// ── Tooltips ────────────────────────────────────────────────────
			var showChk = document.getElementById('atfrfo-pref-tooltips-show');
			var extChk  = document.getElementById('atfrfo-pref-tooltips-extended');
			if (showChk) {
				showChk.addEventListener('change', function () {
					if (ATFRFO.PanelTop) { ATFRFO.PanelTop._showTooltips = showChk.checked; }
					if (extChk) { extChk.disabled = !showChk.checked; }
					self._savePreference({ show_tooltips: showChk.checked });
				});
			}
			if (extChk) {
				extChk.addEventListener('change', function () {
					if (ATFRFO.PanelTop) { ATFRFO.PanelTop._extendedTooltips = extChk.checked; }
					self._savePreference({ extended_tooltips: extChk.checked });
				});
			}

			// ── Confirm before deleting variables ────────────────────────────
			var confirmDelChk = document.getElementById('atfrfo-pref-confirm-delete');
			if (confirmDelChk) {
				confirmDelChk.addEventListener('change', function () {
					ATFRFO.Utils.setConfirmDeleteVariablesEnabled(confirmDelChk.checked);
				});
			}

			// ── Default file path ────────────────────────────────────────────
			var fpInput = document.getElementById('atfrfo-pref-filepath');
			if (fpInput) {
				fpInput.addEventListener('change', function () {
					self._savePreference({ default_file_path: fpInput.value.trim() });
				});
			}
		},

		/**
		 * Update the active-sample highlight in the Menu Buttons demo after
		 * the button size or contrast preference changes.
		 *
		 * @param {HTMLElement} container  The preferences view content element.
		 * @private
		 */
		_updateBtnSamples: function (container) {
			var size     = (ATFRFO.state.settings && ATFRFO.state.settings.ui_btn_size)     || 'normal';
			var contrast = (ATFRFO.state.settings && ATFRFO.state.settings.ui_btn_contrast) || 'standard';
			var samples  = container.querySelectorAll('.atfrfo-prefs-icon-sample');
			for (var i = 0; i < samples.length; i++) {
				var s  = samples[i];
				var sz = s.getAttribute('data-size');
				var ct = s.getAttribute('data-contrast');
				s.classList.toggle('atfrfo-prefs-icon-sample--active', sz === size && ct === contrast);
			}
		},

		/**
		 * Persist a partial settings patch via AJAX and update ATFRFO.state.settings.
		 *
		 * @param {Object} patch  Key-value pairs to merge into saved settings.
		 * @private
		 */
		_savePreference: function (patch) {
			if (ATFRFO.state && ATFRFO.state.settings) {
				var keys = Object.keys(patch);
				for (var k = 0; k < keys.length; k++) {
					ATFRFO.state.settings[keys[k]] = patch[keys[k]];
				}
			}
			ATFRFO.App.ajax('atfrfo_save_settings', { settings: JSON.stringify(patch) });
		},

		/**
		 * Reset to placeholder state (restores background image to full opacity).
		 */
		reset: function () {
			if (this._workspace) {
				this._workspace.removeAttribute('data-active');
			}

			if (this._content) {
				this._content.setAttribute('hidden', '');
				this._content.style.display = '';
				this._content.innerHTML = '';
			}
			if (this._placeholder) {
				this._placeholder.removeAttribute('hidden');
				this._placeholder.style.display = '';
			}
		},

		/**
		 * Build the ATFRFO information panel HTML.
		 *
		 * @returns {string} HTML string.
		 * @private
		 */
		_buildInfoPanel: function () {
			var version = (typeof ATFRFOData !== 'undefined' && ATFRFOData.version) ? ATFRFOData.version : '';
			var versionBadge = version ? '<span class="atfrfo-info-badge">v' + version + '</span>' : '';

			return '<div class="atfrfo-info-panel">'

				// ── Header ──────────────────────────────────────────────────
				+ '<div class="atfrfo-info-header">'
				+ '<h1 class="atfrfo-info-title">Atomic Framework Forge for Elementor ' + versionBadge + '</h1>'
				+ '<p class="atfrfo-info-tagline">Professional asset management for Elementor&nbsp;v4 atomic widgets</p>'
				+ '</div>'

				// ── What is ATFRFO ──────────────────────────────────────────────
				+ '<section class="atfrfo-info-section">'
				+ '<h2 class="atfrfo-info-section__title">What is Atomic Framework Forge for Elementor?</h2>'
				+ '<p>Atomic Framework Forge for Elementor (<strong>AFF</strong>) is a WordPress developer tool that provides a structured management interface for the CSS custom properties and asset definitions introduced by Elementor&nbsp;v4\'s atomic widget architecture.</p>'
				+ '</section>'

				// ── Key Features ─────────────────────────────────────────────
				+ '<section class="atfrfo-info-section">'
				+ '<h2 class="atfrfo-info-section__title">Key Features</h2>'
				+ '<ul class="atfrfo-info-list">'
				+ '<li><strong>Variable Management</strong> — Fetch, organize, and edit Elementor v4 CSS custom properties across Color, Font, and Number categories</li>'
				+ '<li><strong>Structured Projects</strong> — Group variables into named subgroups (Branding, Backgrounds, Spacing, etc.) and save as versioned project files</li>'
				+ '<li><strong>Write-Back to Elementor</strong> — Commit edited variable values directly back to the active Elementor kit</li>'
				+ '<li><strong>Light &amp; Dark Mode</strong> — Full theme support independent of the WordPress admin theme</li>'
				+ '<li><strong>Portable Format</strong> — <code>.atfrfo.json</code> project files are platform-agnostic and designed for future desktop app compatibility</li>'
				+ '<li><strong>Usage Scanning</strong> — Detects which Elementor widgets are actively referencing each variable</li>'
				+ '</ul>'
				+ '</section>'

				// ── How to Get Started ────────────────────────────────────────
				+ '<section class="atfrfo-info-section">'
				+ '<h2 class="atfrfo-info-section__title">Getting Started</h2>'
				+ '<ol class="atfrfo-info-list atfrfo-info-list--ordered">'
				+ '<li>Create a project using <strong>Open / Switch Project</strong> in the right panel</li>'
				+ '<li>Click <strong>Fetch Elementor Data</strong> to import variables from your active Elementor v4 kit</li>'
				+ '<li>Select a category from the left panel to browse and edit your variables</li>'
				+ '<li>Click <strong>Save Project</strong> to persist your work as a <code>.atfrfo.json</code> backup file</li>'
				+ '<li>When ready, click <strong>Write to Elementor</strong> to commit your changes back to the kit</li>'
				+ '</ol>'
				+ '</section>'

				// ── Current Phase ─────────────────────────────────────────────
				+ '<section class="atfrfo-info-section">'
				+ '<h2 class="atfrfo-info-section__title">Development Phase</h2>'
				+ '<p>AFF is in active development. Current capabilities and upcoming phases:</p>'
				+ '<ul class="atfrfo-info-list">'
				+ '<li><span class="atfrfo-info-phase atfrfo-info-phase--current">v1.x \u2014 Current</span> Full Variables workflow: sync from Elementor, organize into categories, inline edit, versioned backups, commit back to the kit, light/dark mode</li>'
				+ '<li><span class="atfrfo-info-phase atfrfo-info-phase--next">v2.0</span> Classes management \u2014 developer-defined CSS class names on atomic widgets; Change History log</li>'
				+ '<li><span class="atfrfo-info-phase atfrfo-info-phase--future">v3.0</span> Components registry; Elementor Kit Manager API write-back</li>'
				+ '<li><span class="atfrfo-info-phase atfrfo-info-phase--future">Future</span> Standalone Windows/Mac desktop application</li>'
				+ '</ul>'
				+ '</section>'

				// ── Divider ───────────────────────────────────────────────────
				+ '<hr class="atfrfo-info-divider" />'

				// ── Ecosystem ─────────────────────────────────────────────────
				+ '<section class="atfrfo-info-section">'
				+ '<p>Atomic Framework Forge for Elementor is part of the <strong><a href="https://jimrforge.com" target="_blank" rel="noopener noreferrer">Jim R Forge</a></strong> ecosystem \u2014 a growing collection of professional WordPress tools for designers and developers.</p>'
				+ '</section>'

				+ '<section class="atfrfo-info-section">'
				+ '<h2 class="atfrfo-info-section__title">Related Tools &amp; Plugins</h2>'
				+ '<ul class="atfrfo-info-related">'
				+ '<li>'
				+ '<span class="atfrfo-info-related__name">Fluid Font Forge</span>'
				+ '<span class="atfrfo-info-related__desc">Responsive typography with CSS clamp() functions</span>'
				+ '<a class="atfrfo-info-related__status atfrfo-info-related__status--available" href="https://wordpress.org/plugins/fluid-font-forge/" target="_blank" rel="noopener noreferrer">Available at WordPress.org/plugins</a>'
				+ '</li>'
				+ '<li>'
				+ '<span class="atfrfo-info-related__name">Fluid Space Forge</span>'
				+ '<span class="atfrfo-info-related__desc">Responsive spacing with CSS clamp() functions</span>'
				+ '<a class="atfrfo-info-related__status atfrfo-info-related__status--available" href="https://wordpress.org/plugins/fluid-space-forge/" target="_blank" rel="noopener noreferrer">Available at WordPress.org/plugins</a>'
				+ '</li>'
				+ '<li>'
				+ '<span class="atfrfo-info-related__name">Media Inventory Forge</span>'
				+ '<span class="atfrfo-info-related__desc">Comprehensive media file management and organization</span>'
				+ '<a class="atfrfo-info-related__status atfrfo-info-related__status--available" href="https://wordpress.org/plugins/media-inventory-forge/" target="_blank" rel="noopener noreferrer">Available at WordPress.org/plugins</a>'
				+ '</li>'
				+ '<li>'
				+ '<span class="atfrfo-info-related__name">Fluid Button Forge</span>'
				+ '<span class="atfrfo-info-related__desc">Responsive button design system with color management and Elementor integration</span>'
				+ '<span class="atfrfo-info-related__status atfrfo-info-related__status--dev">In Development</span>'
				+ '</li>'
				+ '<li>'
				+ '<span class="atfrfo-info-related__name">Color Inventory Forge</span>'
				+ '<span class="atfrfo-info-related__desc">Color palette management for Elementor</span>'
				+ '<span class="atfrfo-info-related__status atfrfo-info-related__status--dev">In Development</span>'
				+ '</li>'
				+ '</ul>'
				+ '</section>'

				// ── Project Hub ───────────────────────────────────────────────
				+ '<section class="atfrfo-info-section">'
				+ '<h2 class="atfrfo-info-section__title">Project Hub</h2>'
				+ '<p>Visit <a href="https://jimrforge.com" target="_blank" rel="noopener noreferrer">jimrforge.com</a> for complete documentation and information on the whole Jim R Forge plugin family.</p>'
				+ '<p>AFF-specific docs: <a href="https://github.com/Mij-Strebor/atomic-framework-forge-for-elementor/blob/master/docs/quick-start.md" target="_blank" rel="noopener noreferrer">Quick-Start Guide</a> &middot; <a href="https://github.com/Mij-Strebor/atomic-framework-forge-for-elementor/blob/master/docs/user-manual.md" target="_blank" rel="noopener noreferrer">User’s Manual</a></p>'
				+ '</section>'

				// ── Support ───────────────────────────────────────────────────
				+ '<section class="atfrfo-info-section atfrfo-info-section--support">'
				+ '<h2 class="atfrfo-info-section__title">Support Development</h2>'
				+ '<p>All Jim R Forge tools are free and open source. If you find them useful, please consider supporting development:</p>'
				+ '<div class="atfrfo-info-support-links">'
				+ '<a class="atfrfo-info-support-btn" href="https://buymeacoffee.com/jimrweb" target="_blank" rel="noopener noreferrer">\u2615 Buy Me a Coffee</a>'
				+ '<a class="atfrfo-info-support-btn atfrfo-info-support-btn--secondary" href="https://github.com/Mij-Strebor/atomic-framework-forge-for-elementor" target="_blank" rel="noopener noreferrer">\u2b50 Star on GitHub</a>'
				+ '</div>'
				+ '</section>'

				+ '</div>'; // .atfrfo-info-panel
		},

		/**
		 * Build the category view HTML.
		 *
		 * @param {{ group: string, subgroup: string, category: string }} sel
		 * @returns {string} HTML string.
		 * @private
		 */
		_buildCategoryView: function (sel) {
			var vars = this._getVarsForCategory(sel);
			var hasCounts = Object.keys(ATFRFO.state.usageCounts).length > 0;

			var html = '<div class="atfrfo-category-view">'

				// Breadcrumb + title
				+ '<div class="atfrfo-category-header">'
				+ '<p class="atfrfo-breadcrumb">'
				+ ATFRFO.Utils.escHtml(sel.group) + ' / '
				+ ATFRFO.Utils.escHtml(sel.subgroup) + ' / '
				+ '<strong>' + ATFRFO.Utils.escHtml(sel.category) + '</strong>'
				+ '</p>'
				+ '<h2 class="atfrfo-category-title">' + ATFRFO.Utils.escHtml(sel.category) + '</h2>'
				+ '</div>';

			// Column headings (only when variables exist and counts are loaded)
			if (vars.length > 0) {
				html += '<div class="atfrfo-variable-list-header">'
					+ '<span class="atfrfo-list-col atfrfo-list-col--name">Variable</span>'
					+ '<span class="atfrfo-list-col atfrfo-list-col--value">Value</span>'
					+ '<span class="atfrfo-list-col atfrfo-list-col--source">Source</span>'
					+ (hasCounts ? '<span class="atfrfo-list-col atfrfo-list-col--usage">Usage</span>' : '')
					+ '</div>';
			}

			html += '<div class="atfrfo-variable-list">';

			if (vars.length === 0) {
				html += '<p class="atfrfo-empty-state">No variables in this category yet. '
					+ 'Use <strong>Sync</strong> to import variables from Elementor, '
					+ 'or add variables manually in ATFRFO v2.</p>';
			} else {
				vars.forEach(function (v) {
					var usageCount = ATFRFO.state.usageCounts[v.name];
					var usageBadge = '';

					if (hasCounts) {
						if (typeof usageCount === 'number') {
							var badgeClass = 'atfrfo-usage-badge'
								+ (usageCount === 0 ? ' atfrfo-usage-badge--unused' : ' atfrfo-usage-badge--active');
							var label = usageCount === 1
								? 'Used 1 time'
								: (usageCount === 0 ? 'Unused' : 'Used ' + usageCount + ' times');
							usageBadge = '<span class="' + badgeClass + '" title="' + label + '" aria-label="' + label + '">'
								+ usageCount
								+ '</span>';
						}
					}

					html += '<div class="atfrfo-variable-row">'
						+ '<code class="atfrfo-var-name">' + ATFRFO.Utils.escHtml(v.name) + '</code>'
						+ '<span class="atfrfo-var-value">' + ATFRFO.Utils.escHtml(v.value) + '</span>'
						+ '<span class="atfrfo-var-source">' + ATFRFO.Utils.escHtml(v.source || '') + '</span>'
						+ (hasCounts ? '<span class="atfrfo-var-usage">' + usageBadge + '</span>' : '')
						+ '</div>';
				}.bind(this));
			}

			html += '</div>' // .atfrfo-variable-list
				+ '</div>'; // .atfrfo-category-view

			return html;
		},

		/**
		 * Get variables that match the current category selection.
		 *
		 * @param {{ group: string, subgroup: string, category: string }} sel
		 * @returns {Array}
		 * @private
		 */
		_getVarsForCategory: function (sel) {
			return ATFRFO.state.variables.filter(function (v) {
				return v.group    === sel.group
					&& v.subgroup === sel.subgroup
					&& v.category === sel.category;
			});
		},

	};
}());
