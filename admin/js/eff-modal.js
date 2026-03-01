/**
 * EFF Modal — Single-Instance Modal Dialog System
 *
 * All modals in EFF use one shared overlay + modal container.
 * Content is injected via EFF.Modal.open({ title, body, footer }).
 *
 * Accessibility:
 *  - Focus is trapped while the modal is open
 *  - ESC key closes the modal
 *  - Clicking the overlay closes the modal
 *  - aria-hidden is toggled on the overlay
 *
 * @package ElementorFrameworkForge
 */

(function () {
	'use strict';

	window.EFF = window.EFF || {};

	EFF.Modal = {

		/** @type {HTMLElement|null} */
		_overlay: null,
		/** @type {HTMLElement|null} */
		_modal: null,
		/** @type {HTMLElement|null} */
		_title: null,
		/** @type {HTMLElement|null} */
		_body: null,
		/** @type {HTMLElement|null} */
		_footer: null,
		/** @type {HTMLElement|null} */
		_closeBtn: null,

		/** @type {HTMLElement|null} Element focused before modal opened */
		_previousFocus: null,

		/** @type {Function|null} Optional callback on close */
		_onClose: null,

		/**
		 * Initialize modal DOM references and bind events.
		 */
		init: function () {
			this._overlay  = document.getElementById('eff-modal-overlay');
			this._modal    = document.getElementById('eff-modal');
			this._title    = document.getElementById('eff-modal-title');
			this._body     = document.getElementById('eff-modal-body');
			this._footer   = document.getElementById('eff-modal-footer');
			this._closeBtn = document.getElementById('eff-modal-close');

			if (!this._overlay) {
				return;
			}

			// Close button
			this._closeBtn.addEventListener('click', this.close.bind(this));

			// Click outside modal content
			this._overlay.addEventListener('click', function (e) {
				if (e.target === this._overlay) {
					this.close();
				}
			}.bind(this));

			// ESC key
			document.addEventListener('keydown', function (e) {
				if (e.key === 'Escape' && this.isOpen()) {
					this.close();
				}
			}.bind(this));
		},

		/**
		 * Open the modal with given content.
		 *
		 * @param {Object} options
		 * @param {string}          options.title   Modal heading text.
		 * @param {string|Node}     options.body    HTML string or DOM node for body.
		 * @param {string|Node}     [options.footer] HTML string or DOM node for footer.
		 * @param {Function}        [options.onClose] Callback when modal closes.
		 */
		open: function (options) {
			if (!this._overlay) {
				return;
			}

			options = options || {};

			// Inject content
			this._title.textContent = options.title || '';

			if (typeof options.body === 'string') {
				this._body.innerHTML = options.body;
			} else if (options.body instanceof Node) {
				this._body.innerHTML = '';
				this._body.appendChild(options.body);
			} else {
				this._body.innerHTML = '';
			}

			if (options.footer) {
				if (typeof options.footer === 'string') {
					this._footer.innerHTML = options.footer;
				} else if (options.footer instanceof Node) {
					this._footer.innerHTML = '';
					this._footer.appendChild(options.footer);
				}
			} else {
				this._footer.innerHTML = '';
			}

			this._onClose = options.onClose || null;

			// Store previously focused element for focus restoration
			this._previousFocus = document.activeElement;

			// Show modal
			this._overlay.setAttribute('aria-hidden', 'false');
			this._overlay.classList.add('is-open');

			// Focus the close button
			requestAnimationFrame(function () {
				this._closeBtn.focus();
				this._trapFocus();
			}.bind(this));
		},

		/**
		 * Close the modal and restore focus.
		 */
		close: function () {
			if (!this._overlay) {
				return;
			}

			this._overlay.classList.remove('is-open');
			this._overlay.setAttribute('aria-hidden', 'true');

			// Restore focus to the element that opened the modal
			if (this._previousFocus && this._previousFocus.focus) {
				this._previousFocus.focus();
			}

			if (typeof this._onClose === 'function') {
				this._onClose();
			}

			// Clear content after transition
			setTimeout(function () {
				if (!this.isOpen()) {
					this._body.innerHTML   = '';
					this._footer.innerHTML = '';
					this._title.textContent = '';
				}
			}.bind(this), 250);
		},

		/**
		 * @returns {boolean}
		 */
		isOpen: function () {
			return this._overlay ? this._overlay.classList.contains('is-open') : false;
		},

		/**
		 * Trap keyboard focus within the modal while it is open.
		 * @private
		 */
		_trapFocus: function () {
			if (!this._modal) {
				return;
			}

			var focusable = this._modal.querySelectorAll(
				'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
			);

			if (!focusable.length) {
				return;
			}

			var first = focusable[0];
			var last  = focusable[focusable.length - 1];

			var trap = function (e) {
				if (e.key !== 'Tab') {
					return;
				}

				if (!this.isOpen()) {
					document.removeEventListener('keydown', trap);
					return;
				}

				if (e.shiftKey) {
					if (document.activeElement === first) {
						e.preventDefault();
						last.focus();
					}
				} else {
					if (document.activeElement === last) {
						e.preventDefault();
						first.focus();
					}
				}
			}.bind(this);

			document.addEventListener('keydown', trap);
		},
	};
}());
