/**
 * AFF Edit Space — Center Panel Content Area
 *
 * Manages the center edit space content. Renders the category view with a
 * variable list when a category is selected from the left panel. Each
 * variable row includes a usage count badge showing how many times the
 * variable is referenced in Elementor widget data (populated by
 * AFF.App.fetchUsageCounts after file load or sync).
 *
 * The edit space element carries a [data-active] attribute when a category
 * is loaded. CSS uses this to transition the background banner image from
 * visible (initial load) to a faint watermark (during editing).
 *
 * @package AtomicFrameworkForge
 */

(function () {
	'use strict';

	window.AFF = window.AFF || {};

	AFF.EditSpace = {

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
			this._placeholder = document.getElementById('aff-placeholder');
			this._content     = document.getElementById('aff-edit-content');
			this._workspace   = document.getElementById('aff-workspace');
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
		 * Show the AFF information panel in the edit space.
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
			var activeItems = document.querySelectorAll('.aff-nav-item.is-active');
			for (var i = 0; i < activeItems.length; i++) {
				activeItems[i].classList.remove('is-active');
			}
			AFF.state.currentSelection = null;

			this._placeholder.setAttribute('hidden', '');
			this._content.removeAttribute('hidden');
			this._content.innerHTML = this._buildInfoPanel();
		},

		/**
		 * Show the Preferences panel in the edit space.
		 * Clears any active left-panel selection and fills the edit space with
		 * the user preferences form.
		 *
		 * @param {Object} settings  Current settings from AFF.state.settings.
		 */
		showPreferences: function (settings) {
			if (!this._content || !this._placeholder) {
				return;
			}

			if (this._workspace) {
				this._workspace.setAttribute('data-active', 'true');
			}

			var activeItems = document.querySelectorAll('.aff-nav-item.is-active');
			for (var i = 0; i < activeItems.length; i++) {
				activeItems[i].classList.remove('is-active');
			}
			AFF.state.currentSelection = null;

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
			var theme       = AFF.state.theme              || 'light';
			var fontSize    = settings.ui_font_size        || 14;
			var contrast    = settings.ui_contrast         || 'standard';
			var btnSize     = settings.ui_btn_size         || 'normal';
			var btnContrast = settings.ui_btn_contrast     || 'standard';
			var density     = settings.layout_density      || 'normal';
			var reduced     = !!settings.reduced_motion;
			var showTips    = settings.show_tooltips       !== false;
			var extTips     = !!settings.extended_tooltips;
			var filePath    = AFF.Utils.escHtml(settings.default_file_path || '');

			function choiceBtn(pref, value, current, label) {
				var active = (value === current) ? ' aff-prefs-choice-btn--active' : '';
				return '<button class="aff-btn aff-prefs-choice-btn' + active + '"'
					+ ' data-pref="' + pref + '" data-value="' + value + '">'
					+ label + '</button>';
			}

			function iconSample(size, contrast_val) {
				var isActive   = (btnSize === size && btnContrast === contrast_val);
				var activeClass = isActive ? ' aff-prefs-icon-sample--active' : '';
				var sizeClass   = 'aff-prefs-icon-sample__btn--' + size;
				var hiClass     = (contrast_val === 'high') ? ' aff-prefs-icon-sample__btn--high' : ' aff-prefs-icon-sample__btn--std';
				var labelText   = (size.charAt(0).toUpperCase() + size.slice(1))
					+ (contrast_val === 'high' ? ' &amp; High' : '');
				return '<div class="aff-prefs-icon-sample' + activeClass + '"'
					+ ' data-size="' + size + '" data-contrast="' + contrast_val + '">'
					+ '<button class="aff-prefs-icon-sample__btn ' + sizeClass + hiClass + '"'
					+ ' tabindex="-1" aria-hidden="true">&#9881;</button>'
					+ '<span class="aff-prefs-icon-sample__label">' + labelText + '</span>'
					+ '</div>';
			}

			var html = '<div class="aff-prefs-view">'

				// ── Header ──────────────────────────────────────────────────────
				+ '<div class="aff-prefs-header">'
				+ '<h1 class="aff-prefs-title">Preferences</h1>'
				+ '<p class="aff-prefs-subtitle">Customize the AFF interface to suit your workflow.</p>'
				+ '</div>'

				// ── 1. Appearance ───────────────────────────────────────────
				+ '<section class="aff-prefs-section">'
				+ '<h2 class="aff-prefs-section__title">Appearance</h2>'

				+ '<div class="aff-prefs-field">'
				+ '<p class="aff-field-label">Interface theme</p>'
				+ '<div class="aff-prefs-btn-group">'
				+ choiceBtn('theme', 'light', theme, 'Light')
				+ choiceBtn('theme', 'dark',  theme, 'Dark')
				+ '</div>'
				+ '</div>'

				+ '<div class="aff-prefs-field">'
				+ '<p class="aff-field-label">Layout density</p>'
				+ '<div class="aff-prefs-btn-group">'
				+ choiceBtn('layout_density', 'compact',     density, 'Compact')
				+ choiceBtn('layout_density', 'normal',      density, 'Normal')
				+ choiceBtn('layout_density', 'comfortable', density, 'Comfortable')
				+ '</div>'
				+ '</div>'

				+ '</section>'

				// ── 2. Tooltips ──────────────────────────────────────────────
				+ '<section class="aff-prefs-section">'
				+ '<h2 class="aff-prefs-section__title">Tooltips</h2>'
				+ '<div class="aff-prefs-field">'
				+ '<label class="aff-prefs-check-label">'
				+ '<input type="checkbox" id="aff-pref-tooltips-show"' + (showTips ? ' checked' : '') + '>'
				+ '<span>Show tooltips</span>'
				+ '</label>'
				+ '<label class="aff-prefs-check-label aff-prefs-check-label--indented">'
				+ '<input type="checkbox" id="aff-pref-tooltips-extended"'
				+ (extTips ? ' checked' : '') + (showTips ? '' : ' disabled') + '>'
				+ '<span>Extended mode — show detailed descriptions</span>'
				+ '</label>'
				+ '</div>'
				+ '</section>'

				// ── 3. Project ────────────────────────────────────────────────
				+ '<section class="aff-prefs-section">'
				+ '<h2 class="aff-prefs-section__title">Project</h2>'
				+ '<div class="aff-prefs-field">'
				+ '<label class="aff-field-label" for="aff-pref-filepath">Default storage file</label>'
				+ '<p class="aff-prefs-hint">Path relative to the WordPress uploads directory. Leave blank to choose each time.</p>'
				+ '<input type="text" class="aff-field-input" id="aff-pref-filepath"'
				+ ' placeholder="e.g., my-project.eff.json" value="' + filePath + '">'
				+ '</div>'
				+ '</section>'

				// ── 4. Typography & Contrast ────────────────────────────────
				+ '<section class="aff-prefs-section">'
				+ '<h2 class="aff-prefs-section__title">Typography &amp; Contrast</h2>'

				+ '<div class="aff-prefs-columns">'

				+ '<div class="aff-prefs-field">'
				+ '<label class="aff-field-label" for="aff-pref-font-size">'
				+ 'Font size — <span id="aff-pref-font-size-label">' + fontSize + 'px</span>'
				+ '</label>'
				+ '<div class="aff-prefs-range-wrap">'
				+ '<span class="aff-prefs-range-min">14</span>'
				+ '<input type="range" id="aff-pref-font-size" class="aff-pref-range"'
				+ ' min="14" max="18" step="1" value="' + fontSize + '">'
				+ '<span class="aff-prefs-range-max">18</span>'
				+ '</div>'
				+ '</div>'

				+ '<div class="aff-prefs-field">'
				+ '<p class="aff-field-label">Color contrast</p>'
				+ '<div class="aff-prefs-btn-group">'
				+ choiceBtn('ui_contrast', 'standard', contrast, 'Standard')
				+ choiceBtn('ui_contrast', 'high',     contrast, 'High')
				+ '</div>'
				+ '</div>'

				+ '</div>'

				// Typography live demo
				+ '<div class="aff-prefs-demo">'
				+ '<p class="aff-prefs-demo-label">Live preview</p>'
				+ '<div class="aff-prefs-demo-inner">'
				+ '<p class="aff-prefs-demo-heading">Heading — Atomic Framework Forge for Elementor</p>'
				+ '<p class="aff-prefs-demo-body">Body text — the quick brown fox jumps over the lazy dog.</p>'
				+ '<p class="aff-prefs-demo-muted">Secondary text — supporting information and labels</p>'
				+ '</div>'
				+ '</div>'

				+ '</section>'

				// ── 5. Menu Buttons ─────────────────────────────────────────
				+ '<section class="aff-prefs-section">'
				+ '<h2 class="aff-prefs-section__title">Menu Buttons</h2>'

				+ '<div class="aff-prefs-columns">'

				+ '<div class="aff-prefs-field">'
				+ '<p class="aff-field-label">Button size</p>'
				+ '<div class="aff-prefs-btn-group">'
				+ choiceBtn('ui_btn_size', 'normal', btnSize, 'Normal')
				+ choiceBtn('ui_btn_size', 'large',  btnSize, 'Large')
				+ '</div>'
				+ '</div>'

				+ '<div class="aff-prefs-field">'
				+ '<p class="aff-field-label">Button contrast</p>'
				+ '<div class="aff-prefs-btn-group">'
				+ choiceBtn('ui_btn_contrast', 'standard', btnContrast, 'Standard')
				+ choiceBtn('ui_btn_contrast', 'high',     btnContrast, 'High')
				+ '</div>'
				+ '</div>'

				+ '</div>'

				// Icon button preview
				+ '<div class="aff-prefs-demo aff-prefs-demo--btn">'
				+ '<p class="aff-prefs-demo-label">Top bar button preview</p>'
				+ '<div class="aff-prefs-demo-inner">'
				+ iconSample('normal', 'standard')
				+ iconSample('normal', 'high')
				+ iconSample('large',  'standard')
				+ iconSample('large',  'high')
				+ '</div>'
				+ '</div>'

				+ '</section>'

				// ── 6. Motion ─────────────────────────────────────────────────
				+ '<section class="aff-prefs-section">'
				+ '<h2 class="aff-prefs-section__title">Motion</h2>'
				+ '<div class="aff-prefs-field">'
				+ '<label class="aff-prefs-check-label">'
				+ '<input type="checkbox" id="aff-pref-reduced-motion"' + (reduced ? ' checked' : '') + '>'
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

			var app = document.getElementById('aff-app');

			// ── Choice buttons ───────────────────────────────────────────────
			var choiceBtns = content.querySelectorAll('.aff-prefs-choice-btn');
			for (var i = 0; i < choiceBtns.length; i++) {
				(function (btn) {
					btn.addEventListener('click', function () {
						var pref  = btn.getAttribute('data-pref');
						var value = btn.getAttribute('data-value');

						// Deselect siblings in the same pref group
						var siblings = content.querySelectorAll('[data-pref="' + pref + '"]');
						for (var j = 0; j < siblings.length; j++) {
							siblings[j].classList.remove('aff-prefs-choice-btn--active');
						}
						btn.classList.add('aff-prefs-choice-btn--active');

						// Apply + persist
						if (pref === 'theme') {
							if (AFF.Theme) { AFF.Theme.set(value); }
						} else if (pref === 'layout_density') {
							if (app) {
								if (value === 'normal') { app.removeAttribute('data-aff-density'); }
								else { app.setAttribute('data-aff-density', value); }
							}
							self._savePreference({ layout_density: value });
						} else if (pref === 'ui_contrast') {
							if (app) {
								if (value === 'standard') { app.removeAttribute('data-aff-contrast'); }
								else { app.setAttribute('data-aff-contrast', value); }
							}
							self._savePreference({ ui_contrast: value });
						} else if (pref === 'ui_btn_size') {
							if (app) {
								if (value === 'normal') { app.removeAttribute('data-aff-btn-size'); }
								else { app.setAttribute('data-aff-btn-size', value); }
							}
							self._savePreference({ ui_btn_size: value });
							self._updateBtnSamples(content);
						} else if (pref === 'ui_btn_contrast') {
							if (app) {
								if (value === 'standard') { app.removeAttribute('data-aff-btn-contrast'); }
								else { app.setAttribute('data-aff-btn-contrast', value); }
							}
							self._savePreference({ ui_btn_contrast: value });
							self._updateBtnSamples(content);
						}
					});
				}(choiceBtns[i]));
			}

			// ── Font size range ──────────────────────────────────────────────
			var sizeRange = document.getElementById('aff-pref-font-size');
			var sizeLabel = document.getElementById('aff-pref-font-size-label');
			if (sizeRange) {
				sizeRange.addEventListener('input', function () {
					var px = sizeRange.value;
					if (sizeLabel) { sizeLabel.textContent = px + 'px'; }
					if (app) {
						if (px === '16') {
							app.removeAttribute('data-aff-font-size');
						} else {
							app.setAttribute('data-aff-font-size', px);
						}
					}
				});
				sizeRange.addEventListener('change', function () {
					self._savePreference({ ui_font_size: parseInt(sizeRange.value, 10) });
				});
			}

			// ── Reduced motion ───────────────────────────────────────────────
			var motionChk = document.getElementById('aff-pref-reduced-motion');
			if (motionChk) {
				motionChk.addEventListener('change', function () {
					if (app) {
						if (motionChk.checked) {
							app.setAttribute('data-aff-motion', 'reduced');
						} else {
							app.removeAttribute('data-aff-motion');
						}
					}
					self._savePreference({ reduced_motion: motionChk.checked });
				});
			}

			// ── Tooltips ────────────────────────────────────────────────────
			var showChk = document.getElementById('aff-pref-tooltips-show');
			var extChk  = document.getElementById('aff-pref-tooltips-extended');
			if (showChk) {
				showChk.addEventListener('change', function () {
					if (AFF.PanelTop) { AFF.PanelTop._showTooltips = showChk.checked; }
					if (extChk) { extChk.disabled = !showChk.checked; }
					self._savePreference({ show_tooltips: showChk.checked });
				});
			}
			if (extChk) {
				extChk.addEventListener('change', function () {
					if (AFF.PanelTop) { AFF.PanelTop._extendedTooltips = extChk.checked; }
					self._savePreference({ extended_tooltips: extChk.checked });
				});
			}

			// ── Default file path ────────────────────────────────────────────
			var fpInput = document.getElementById('aff-pref-filepath');
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
			var size     = (AFF.state.settings && AFF.state.settings.ui_btn_size)     || 'normal';
			var contrast = (AFF.state.settings && AFF.state.settings.ui_btn_contrast) || 'standard';
			var samples  = container.querySelectorAll('.aff-prefs-icon-sample');
			for (var i = 0; i < samples.length; i++) {
				var s  = samples[i];
				var sz = s.getAttribute('data-size');
				var ct = s.getAttribute('data-contrast');
				s.classList.toggle('aff-prefs-icon-sample--active', sz === size && ct === contrast);
			}
		},

		/**
		 * Persist a partial settings patch via AJAX and update AFF.state.settings.
		 *
		 * @param {Object} patch  Key-value pairs to merge into saved settings.
		 * @private
		 */
		_savePreference: function (patch) {
			if (AFF.state && AFF.state.settings) {
				var keys = Object.keys(patch);
				for (var k = 0; k < keys.length; k++) {
					AFF.state.settings[keys[k]] = patch[keys[k]];
				}
			}
			AFF.App.ajax('aff_save_settings', { settings: JSON.stringify(patch) });
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
		 * Build the AFF information panel HTML.
		 *
		 * @returns {string} HTML string.
		 * @private
		 */
		_buildInfoPanel: function () {
			var version = (typeof AFFData !== 'undefined' && AFFData.version) ? AFFData.version : '';
			var versionBadge = version ? '<span class="aff-info-badge">v' + version + '</span>' : '';

			return '<div class="aff-info-panel">'

				// ── Header ──────────────────────────────────────────────────
				+ '<div class="aff-info-header">'
				+ '<h1 class="aff-info-title">Atomic Framework Forge for Elementor ' + versionBadge + '</h1>'
				+ '<p class="aff-info-tagline">Professional asset management for Elementor&nbsp;v4 atomic widgets</p>'
				+ '</div>'

				// ── What is AFF ──────────────────────────────────────────────
				+ '<section class="aff-info-section">'
				+ '<h2 class="aff-info-section__title">What is Atomic Framework Forge for Elementor?</h2>'
				+ '<p>Atomic Framework Forge for Elementor (AFF) is a WordPress developer tool that provides a structured management interface for the CSS custom properties and asset definitions introduced by Elementor&nbsp;v4\'s atomic widget architecture.</p>'
				+ '</section>'

				// ── Key Features ─────────────────────────────────────────────
				+ '<section class="aff-info-section">'
				+ '<h2 class="aff-info-section__title">Key Features</h2>'
				+ '<ul class="aff-info-list">'
				+ '<li><strong>Variable Management</strong> — Fetch, organize, and edit Elementor v4 CSS custom properties across Color, Font, and Number categories</li>'
				+ '<li><strong>Structured Projects</strong> — Group variables into named subgroups (Branding, Backgrounds, Spacing, etc.) and save as versioned project files</li>'
				+ '<li><strong>Write-Back to Elementor</strong> — Commit edited variable values directly back to the active Elementor kit</li>'
				+ '<li><strong>Light &amp; Dark Mode</strong> — Full theme support independent of the WordPress admin theme</li>'
				+ '<li><strong>Portable Format</strong> — <code>.eff.json</code> project files are platform-agnostic and designed for future desktop app compatibility</li>'
				+ '<li><strong>Usage Scanning</strong> — Detects which Elementor widgets are actively referencing each variable</li>'
				+ '</ul>'
				+ '</section>'

				// ── How to Get Started ────────────────────────────────────────
				+ '<section class="aff-info-section">'
				+ '<h2 class="aff-info-section__title">Getting Started</h2>'
				+ '<ol class="aff-info-list aff-info-list--ordered">'
				+ '<li>Create a project using <strong>Open / Switch Project</strong> in the right panel</li>'
				+ '<li>Click <strong>Fetch Elementor Data</strong> to import variables from your active Elementor v4 kit</li>'
				+ '<li>Select a category from the left panel to browse and edit your variables</li>'
				+ '<li>Click <strong>Save Project</strong> to persist your work as a <code>.eff.json</code> backup file</li>'
				+ '<li>When ready, click <strong>Write to Elementor</strong> to commit your changes back to the kit</li>'
				+ '</ol>'
				+ '</section>'

				// ── Current Phase ─────────────────────────────────────────────
				+ '<section class="aff-info-section">'
				+ '<h2 class="aff-info-section__title">Development Phase</h2>'
				+ '<p>AFF is in active development. Current capabilities and upcoming phases:</p>'
				+ '<ul class="aff-info-list">'
				+ '<li><span class="aff-info-phase aff-info-phase--current">v1 \u2014 Current</span> Framework, panels, variable fetch &amp; display, project save/load, light/dark mode</li>'
				+ '<li><span class="aff-info-phase aff-info-phase--next">v2</span> Full variable edit UI with inline editing and drag-to-reorder</li>'
				+ '<li><span class="aff-info-phase aff-info-phase--future">v3</span> CSS Classes management (pending Elementor v4 exposure)</li>'
				+ '<li><span class="aff-info-phase aff-info-phase--future">v4</span> Components registry</li>'
				+ '<li><span class="aff-info-phase aff-info-phase--future">v5</span> History, undo, export/import enhancements</li>'
				+ '</ul>'
				+ '</section>'

				// ── Divider ───────────────────────────────────────────────────
				+ '<hr class="aff-info-divider" />'

				// ── Ecosystem ─────────────────────────────────────────────────
				+ '<section class="aff-info-section">'
				+ '<p>Atomic Framework Forge for Elementor is part of the <strong><a href="https://jimrforge.com" target="_blank" rel="noopener noreferrer">Jim R Forge</a></strong> ecosystem \u2014 a growing collection of professional WordPress tools for designers and developers.</p>'
				+ '</section>'

				+ '<section class="aff-info-section">'
				+ '<h2 class="aff-info-section__title">Related Tools &amp; Plugins</h2>'
				+ '<ul class="aff-info-related">'
				+ '<li>'
				+ '<span class="aff-info-related__name">Fluid Font Forge</span>'
				+ '<span class="aff-info-related__desc">Responsive typography with CSS clamp() functions</span>'
				+ '<a class="aff-info-related__status aff-info-related__status--available" href="https://wordpress.org/plugins/fluid-font-forge/" target="_blank" rel="noopener noreferrer">Available at WordPress.org/plugins</a>'
				+ '</li>'
				+ '<li>'
				+ '<span class="aff-info-related__name">Fluid Space Forge</span>'
				+ '<span class="aff-info-related__desc">Responsive spacing with CSS clamp() functions</span>'
				+ '<a class="aff-info-related__status aff-info-related__status--available" href="https://wordpress.org/plugins/fluid-space-forge/" target="_blank" rel="noopener noreferrer">Available at WordPress.org/plugins</a>'
				+ '</li>'
				+ '<li>'
				+ '<span class="aff-info-related__name">Media Inventory Forge</span>'
				+ '<span class="aff-info-related__desc">Comprehensive media file management and organization</span>'
				+ '<a class="aff-info-related__status aff-info-related__status--available" href="https://github.com/Mij-Strebor/media-inventory-forge" target="_blank" rel="noopener noreferrer">Available at GitHub</a>'
				+ '</li>'
				+ '<li>'
				+ '<span class="aff-info-related__name">Elementor Color Inventory</span>'
				+ '<span class="aff-info-related__desc">Color palette management for Elementor</span>'
				+ '<span class="aff-info-related__status aff-info-related__status--dev">In Development</span>'
				+ '</li>'
				+ '</ul>'
				+ '</section>'

				// ── Project Hub ───────────────────────────────────────────────
				+ '<section class="aff-info-section">'
				+ '<h2 class="aff-info-section__title">Project Hub</h2>'
				+ '<p>Soon you can visit <a href="https://jimrforge.com" target="_blank" rel="noopener noreferrer">jimrforge.com</a> for complete documentation and information. Coming.</p>'
				+ '</section>'

				// ── Support ───────────────────────────────────────────────────
				+ '<section class="aff-info-section aff-info-section--support">'
				+ '<h2 class="aff-info-section__title">Support Development</h2>'
				+ '<p>All Jim R Forge tools are free and open source. If you find them useful, please consider supporting development:</p>'
				+ '<div class="aff-info-support-links">'
				+ '<a class="aff-info-support-btn" href="https://buymeacoffee.com/jimrweb" target="_blank" rel="noopener noreferrer">\u2615 Buy Me a Coffee</a>'
				+ '<a class="aff-info-support-btn aff-info-support-btn--secondary" href="https://github.com/Mij-Strebor/atomic-framework-forge-for-elementor" target="_blank" rel="noopener noreferrer">\u2b50 Star on GitHub</a>'
				+ '</div>'
				+ '</section>'

				+ '</div>'; // .aff-info-panel
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
			var hasCounts = Object.keys(AFF.state.usageCounts).length > 0;

			var html = '<div class="aff-category-view">'

				// Breadcrumb + title
				+ '<div class="aff-category-header">'
				+ '<p class="aff-breadcrumb">'
				+ AFF.Utils.escHtml(sel.group) + ' / '
				+ AFF.Utils.escHtml(sel.subgroup) + ' / '
				+ '<strong>' + AFF.Utils.escHtml(sel.category) + '</strong>'
				+ '</p>'
				+ '<h2 class="aff-category-title">' + AFF.Utils.escHtml(sel.category) + '</h2>'
				+ '</div>';

			// Column headings (only when variables exist and counts are loaded)
			if (vars.length > 0) {
				html += '<div class="aff-variable-list-header">'
					+ '<span class="aff-list-col aff-list-col--name">Variable</span>'
					+ '<span class="aff-list-col aff-list-col--value">Value</span>'
					+ '<span class="aff-list-col aff-list-col--source">Source</span>'
					+ (hasCounts ? '<span class="aff-list-col aff-list-col--usage">Usage</span>' : '')
					+ '</div>';
			}

			html += '<div class="aff-variable-list">';

			if (vars.length === 0) {
				html += '<p class="aff-empty-state">No variables in this category yet. '
					+ 'Use <strong>Sync</strong> to import variables from Elementor, '
					+ 'or add variables manually in AFF v2.</p>';
			} else {
				vars.forEach(function (v) {
					var usageCount = AFF.state.usageCounts[v.name];
					var usageBadge = '';

					if (hasCounts) {
						if (typeof usageCount === 'number') {
							var badgeClass = 'aff-usage-badge'
								+ (usageCount === 0 ? ' aff-usage-badge--unused' : ' aff-usage-badge--active');
							var label = usageCount === 1
								? 'Used 1 time'
								: (usageCount === 0 ? 'Unused' : 'Used ' + usageCount + ' times');
							usageBadge = '<span class="' + badgeClass + '" title="' + label + '" aria-label="' + label + '">'
								+ usageCount
								+ '</span>';
						}
					}

					html += '<div class="aff-variable-row">'
						+ '<code class="aff-var-name">' + AFF.Utils.escHtml(v.name) + '</code>'
						+ '<span class="aff-var-value">' + AFF.Utils.escHtml(v.value) + '</span>'
						+ '<span class="aff-var-source">' + AFF.Utils.escHtml(v.source || '') + '</span>'
						+ (hasCounts ? '<span class="aff-var-usage">' + usageBadge + '</span>' : '')
						+ '</div>';
				}.bind(this));
			}

			html += '</div>' // .aff-variable-list
				+ '</div>'; // .aff-category-view

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
			return AFF.state.variables.filter(function (v) {
				return v.group    === sel.group
					&& v.subgroup === sel.subgroup
					&& v.category === sel.category;
			});
		},

	};
}());
