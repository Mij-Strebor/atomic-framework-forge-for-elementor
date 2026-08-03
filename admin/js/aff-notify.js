/**
 * AFF Notify — "Take a look" rising notification sign
 *
 * The sign's own display cap (AFF_NOTIFY_MAX_SHOWS) is enforced server-side —
 * PHP simply does not render #aff-notify-sign once the cap is reached, so this
 * module only ever runs the animation for a sign that's actually allowed to show.
 * Each run counts as one display: the shown-count is incremented once, as soon
 * as the sign starts animating in, not on click/dismiss.
 *
 * @package AtomicFrameworkForge
 */

/* global AFFData */
(function () {
	'use strict';

	window.AFF = window.AFF || {};

	AFF.Notify = {

		/** @type {number} Milliseconds the sign stays settled before leaving. */
		HOLD_MS: 4000,

		/** @type {HTMLElement|null} */
		_el: null,

		/**
		 * Initialize: if the sign exists (server allowed it), animate it in.
		 */
		init: function () {
			this._el = document.getElementById('aff-notify-sign');
			if (!this._el) {
				return;
			}

			this._el.addEventListener('click', this._dismiss.bind(this));

			// Count this as a display immediately — the animation itself has no
			// meaningful failure mode the count should wait on.
			if (typeof AFFData !== 'undefined' && AFF.App && AFF.App.ajax) {
				AFF.App.ajax('aff_increment_notify_count', {}).catch(function () {
					// Non-critical — a failed increment just means the user may see
					// the sign up to one extra time; not worth surfacing an error.
				});
			}

			var self = this;
			// Double rAF: ensures the initial (off-screen) transform has actually
			// painted before adding the visible class, so the CSS transition runs
			// instead of the element snapping straight to its settled position.
			requestAnimationFrame(function () {
				requestAnimationFrame(function () {
					if (self._el) {
						self._el.classList.add('aff-notify-sign--visible');
					}
				});
			});

			this._holdTimer = setTimeout(function () {
				self._dismiss();
			}, this.HOLD_MS);
		},

		/**
		 * Slide the sign back out and remove it from the DOM once the
		 * transition finishes. Safe to call more than once (click during
		 * the hold period, followed by the hold timer firing).
		 */
		_dismiss: function () {
			if (!this._el) {
				return;
			}
			clearTimeout(this._holdTimer);

			var el = this._el;
			this._el = null; // Guards against double-dismiss re-entry.

			el.classList.add('aff-notify-sign--leaving');
			el.classList.remove('aff-notify-sign--visible');

			el.addEventListener('transitionend', function remove() {
				el.removeEventListener('transitionend', remove);
				el.remove();
			});
		},
	};
})();
