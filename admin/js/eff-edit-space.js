/**
 * EFF Edit Space — Center Panel Content Area
 *
 * Manages the center edit space content. Renders the category view with a
 * variable list when a category is selected from the left panel. Each
 * variable row includes a usage count badge showing how many times the
 * variable is referenced in Elementor widget data (populated by
 * EFF.App.fetchUsageCounts after file load or sync).
 *
 * @package ElementorFrameworkForge
 */

(function () {
	'use strict';

	window.EFF = window.EFF || {};

	EFF.EditSpace = {

		/** @type {HTMLElement|null} */
		_placeholder: null,
		/** @type {HTMLElement|null} */
		_content: null,

		/**
		 * Initialize the edit space.
		 */
		init: function () {
			this._placeholder = document.getElementById('eff-placeholder');
			this._content     = document.getElementById('eff-edit-content');
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

			// Hide placeholder, show content
			this._placeholder.setAttribute('hidden', '');
			this._content.removeAttribute('hidden');

			// Render category scaffold
			this._content.innerHTML = this._buildCategoryView(selection);
		},

		/**
		 * Reset to placeholder state.
		 */
		reset: function () {
			if (this._content) {
				this._content.setAttribute('hidden', '');
				this._content.innerHTML = '';
			}
			if (this._placeholder) {
				this._placeholder.removeAttribute('hidden');
			}
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
			var hasCounts = Object.keys(EFF.state.usageCounts).length > 0;

			var html = '<div class="eff-category-view">'

				// Breadcrumb + title
				+ '<div class="eff-category-header">'
				+ '<p class="eff-breadcrumb">'
				+ this._escapeHtml(sel.group) + ' / '
				+ this._escapeHtml(sel.subgroup) + ' / '
				+ '<strong>' + this._escapeHtml(sel.category) + '</strong>'
				+ '</p>'
				+ '<h2 class="eff-category-title">' + this._escapeHtml(sel.category) + '</h2>'
				+ '</div>';

			// Column headings (only when variables exist and counts are loaded)
			if (vars.length > 0) {
				html += '<div class="eff-variable-list-header">'
					+ '<span class="eff-list-col eff-list-col--name">Variable</span>'
					+ '<span class="eff-list-col eff-list-col--value">Value</span>'
					+ '<span class="eff-list-col eff-list-col--source">Source</span>'
					+ (hasCounts ? '<span class="eff-list-col eff-list-col--usage">Usage</span>' : '')
					+ '</div>';
			}

			html += '<div class="eff-variable-list">';

			if (vars.length === 0) {
				html += '<p class="eff-empty-state">No variables in this category yet. '
					+ 'Use <strong>Sync</strong> to import variables from Elementor, '
					+ 'or add variables manually in EFF v2.</p>';
			} else {
				vars.forEach(function (v) {
					var usageCount = EFF.state.usageCounts[v.name];
					var usageBadge = '';

					if (hasCounts) {
						if (typeof usageCount === 'number') {
							var badgeClass = 'eff-usage-badge'
								+ (usageCount === 0 ? ' eff-usage-badge--unused' : ' eff-usage-badge--active');
							var label = usageCount === 1
								? 'Used 1 time'
								: (usageCount === 0 ? 'Unused' : 'Used ' + usageCount + ' times');
							usageBadge = '<span class="' + badgeClass + '" title="' + label + '" aria-label="' + label + '">'
								+ usageCount
								+ '</span>';
						}
					}

					html += '<div class="eff-variable-row">'
						+ '<code class="eff-var-name">' + this._escapeHtml(v.name) + '</code>'
						+ '<span class="eff-var-value">' + this._escapeHtml(v.value) + '</span>'
						+ '<span class="eff-var-source">' + this._escapeHtml(v.source || '') + '</span>'
						+ (hasCounts ? '<span class="eff-var-usage">' + usageBadge + '</span>' : '')
						+ '</div>';
				}.bind(this));
			}

			html += '</div>' // .eff-variable-list
				+ '</div>'; // .eff-category-view

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
			return EFF.state.variables.filter(function (v) {
				return v.group    === sel.group
					&& v.subgroup === sel.subgroup
					&& v.category === sel.category;
			});
		},

		/**
		 * Escape HTML special characters.
		 *
		 * @param {string} str
		 * @returns {string}
		 * @private
		 */
		_escapeHtml: function (str) {
			if (typeof str !== 'string') {
				return '';
			}
			var div = document.createElement('div');
			div.textContent = str;
			return div.innerHTML;
		},
	};
}());
