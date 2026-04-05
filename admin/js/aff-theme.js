/**
 * AFF Theme — Light/Dark Mode Management
 *
 * Reads the initial theme from the data-aff-theme attribute set by PHP,
 * provides AFF.Theme.set() for toggling, and persists the preference
 * via AJAX to WordPress usermeta.
 *
 * @package AtomicFrameworkForge
 */

/* global AFFData */
(function () {
	'use strict';

	window.AFF = window.AFF || {};

	AFF.Theme = {

		/** @type {string} Current theme: 'light' | 'dark' */
		current: 'light',

		/**
		 * Initialize: read theme from the root container attribute.
		 */
		init: function () {
			var app = document.getElementById('aff-app');
			if (app) {
				this.current = app.getAttribute('data-aff-theme') || 'light';
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

			var app = document.getElementById('aff-app');
			if (!app) {
				return;
			}

			this.current = theme;
			app.setAttribute('data-aff-theme', theme);
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
			if (typeof AFF === 'undefined' || !AFF.App || !AFF.App.ajax) {
				return;
			}

			AFF.App.ajax('aff_save_user_theme', { theme: theme }).catch(function () {
				// Silently fail — theme toggle is non-critical
			});
		},
	};
}());
