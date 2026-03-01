/**
 * EFF Theme — Light/Dark Mode Management
 *
 * Reads the initial theme from the data-eff-theme attribute set by PHP,
 * provides EFF.Theme.set() for toggling, and persists the preference
 * via AJAX to WordPress usermeta.
 *
 * @package ElementorFrameworkForge
 */

/* global EFFData */
(function () {
	'use strict';

	window.EFF = window.EFF || {};

	EFF.Theme = {

		/** @type {string} Current theme: 'light' | 'dark' */
		current: 'light',

		/**
		 * Initialize: read theme from the root container attribute.
		 */
		init: function () {
			var app = document.getElementById('eff-app');
			if (app) {
				this.current = app.getAttribute('data-eff-theme') || 'light';
			}
		},

		/**
		 * Set a specific theme.
		 *
		 * @param {string} theme 'light' | 'dark'
		 */
		set: function (theme) {
			if (theme !== 'light' && theme !== 'dark') {
				return;
			}

			var app = document.getElementById('eff-app');
			if (!app) {
				return;
			}

			this.current = theme;
			app.setAttribute('data-eff-theme', theme);
			this._persist(theme);
		},

		/**
		 * Toggle between light and dark.
		 */
		toggle: function () {
			this.set(this.current === 'light' ? 'dark' : 'light');
		},

		/**
		 * Persist theme preference to WordPress usermeta via AJAX.
		 *
		 * @param {string} theme
		 * @private
		 */
		_persist: function (theme) {
			if (typeof EFFData === 'undefined') {
				return;
			}

			fetch(EFFData.ajaxUrl, {
				method:  'POST',
				headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
				body:    new URLSearchParams({
					action: 'eff_save_user_theme',
					nonce:  EFFData.nonce,
					theme:  theme,
				}),
			}).catch(function () {
				// Silently fail — theme toggle is non-critical
			});
		},
	};
}());
