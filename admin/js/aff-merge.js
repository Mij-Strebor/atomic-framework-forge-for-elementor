/**
 * AFF Merge — Conflict Detection and Resolution
 *
 * Provides a reusable conflict resolution modal used by both the Fetch
 * Elementor (pull) and Write to Elementor (push) operations.
 *
 * Both operations are treated as merge operations: when a variable name
 * exists on both sides but with different values the user must choose which
 * value wins before the operation can proceed.
 *
 * Public API:
 *   AFF.Merge.buildConflictList(elementorVars, affVars)
 *     → { newVars, conflictVars, matchVars }
 *
 *   AFF.Merge.openMergeDialog(conflictVars, direction, onApply, onCancel)
 *     direction: 'fetch' | 'write'
 *     onApply  : called with [{name, winner:'aff'|'el'}, ...]
 *     onCancel : called with no arguments
 *
 * @package AtomicFrameworkForge
 */

/* global AFF */
(function () {
	'use strict';

	window.AFF = window.AFF || {};

	AFF.Merge = {

		// -----------------------------------------------------------------------
		// PUBLIC: CONFLICT LIST BUILDER
		// -----------------------------------------------------------------------

		/**
		 * Partition Elementor variables against the current AFF variable set.
		 *
		 * @param {Array} elementorVars  [{name, value}, ...] — from aff_sync_from_elementor
		 * @param {Array} affVars        AFF.state.variables
		 * @returns {{ newVars: Array, conflictVars: Array, matchVars: Array }}
		 *   newVars      — name not in AFF (should be added as normal)
		 *   conflictVars — name in both, values differ:
		 *                  [{name, affValue, elValue}, ...]
		 *   matchVars    — name in both, values already match (no action needed)
		 */
		buildConflictList: function (elementorVars, affVars) {
			var newVars = [], conflictVars = [], matchVars = [];

			// Build a lowercase-name → current value map from AFF state.
			// We preserve the original AFF value for display but compare lower-cased.
			var affMap = {};
			affVars.forEach(function (v) {
				var key = (v.name || '').toLowerCase();
				affMap[key] = v.value || '';
			});

			elementorVars.forEach(function (v) {
				var nameLc = (v.name || '').toLowerCase();
				if (!(nameLc in affMap)) {
					newVars.push(v);
				} else {
					// Normalise both sides: trim + lowercase for comparison only.
					var affNorm = affMap[nameLc].trim().toLowerCase();
					var elNorm  = (v.value || '').trim().toLowerCase();
					if (affNorm === elNorm) {
						matchVars.push(v);
					} else {
						conflictVars.push({
							name:     nameLc,
							affValue: affMap[nameLc], // original AFF value (display)
							elValue:  v.value,         // Elementor value (display)
						});
					}
				}
			});

			return { newVars: newVars, conflictVars: conflictVars, matchVars: matchVars };
		},

		// -----------------------------------------------------------------------
		// PUBLIC: MERGE DIALOG
		// -----------------------------------------------------------------------

		/**
		 * Open the merge conflict resolution modal.
		 *
		 * The dialog always defaults to "Keep AFF" for every row — the developer's
		 * own data takes priority until they explicitly choose otherwise.
		 *
		 * @param {Array}    conflictVars  [{name, affValue, elValue}, ...]
		 * @param {string}   direction     'fetch' | 'write'
		 * @param {Function} onApply       called with [{name, winner:'aff'|'el'}, ...]
		 * @param {Function} onCancel      called with no arguments
		 */
		openMergeDialog: function (conflictVars, direction, onApply, onCancel) {
			var self     = this;
			var isFetch  = (direction === 'fetch');
			var elLabel  = isFetch ? 'Use Elementor' : 'Keep Elementor';
			var colLabel = isFetch ? 'Elementor value' : 'Elementor (current)';

			var rowsHtml = '';
			conflictVars.forEach(function (c) {
				var radioName = 'aff-merge-' + c.name.replace(/[^a-z0-9]/g, '-');
				rowsHtml +=
					'<tr data-var-name="' + AFF.Utils.escHtml(c.name) + '"'
					+ ' style="border-bottom:1px solid var(--aff-clr-border)">'
					+ '<td style="padding:6px 8px 6px 0;font-size:12px;color:var(--aff-clr-primary)'
					+   ';white-space:nowrap;min-width:160px">'
					+   '<code style="font-size:11px">' + AFF.Utils.escHtml(c.name) + '</code>'
					+ '</td>'
					+ '<td style="padding:6px 8px;font-size:12px;color:var(--aff-clr-secondary)'
					+   ';white-space:nowrap">'
					+   self._swatch(c.affValue) + AFF.Utils.escHtml(c.affValue)
					+ '</td>'
					+ '<td style="padding:6px 8px;font-size:12px;color:var(--aff-clr-secondary)'
					+   ';white-space:nowrap">'
					+   self._swatch(c.elValue) + AFF.Utils.escHtml(c.elValue)
					+ '</td>'
					+ '<td style="padding:6px 0 6px 8px;white-space:nowrap">'
					+   '<label style="margin-right:10px;font-size:12px;cursor:pointer">'
					+     '<input type="radio" name="' + radioName + '" value="aff"'
					+     ' checked style="margin-right:3px;cursor:pointer">'
					+     'Keep AFF'
					+   '</label>'
					+   '<label style="font-size:12px;cursor:pointer">'
					+     '<input type="radio" name="' + radioName + '" value="el"'
					+     ' style="margin-right:3px;cursor:pointer">'
					+     elLabel
					+   '</label>'
					+ '</td>'
					+ '</tr>';
			});

			var plural = conflictVars.length !== 1;
			var body   =
				'<p style="margin-bottom:12px">'
				+ '<strong>' + conflictVars.length + '</strong> variable'
				+ (plural ? 's have' : ' has')
				+ ' different values in AFF and Elementor.'
				+ ' Choose which to keep for each row.</p>'
				+ '<div style="overflow-x:auto;margin-bottom:10px">'
				+ '<table style="width:100%;border-collapse:collapse">'
				+ '<thead>'
				+ '<tr style="border-bottom:2px solid var(--aff-clr-border)">'
				+ '<th style="padding:4px 8px 4px 0;text-align:left;font-size:11px'
				+   ';color:var(--aff-clr-muted);font-weight:600">Variable</th>'
				+ '<th style="padding:4px 8px;text-align:left;font-size:11px'
				+   ';color:var(--aff-clr-muted);font-weight:600">AFF value</th>'
				+ '<th style="padding:4px 8px;text-align:left;font-size:11px'
				+   ';color:var(--aff-clr-muted);font-weight:600">' + colLabel + '</th>'
				+ '<th style="padding:4px 0 4px 8px;text-align:left;font-size:11px'
				+   ';color:var(--aff-clr-muted);font-weight:600">Keep</th>'
				+ '</tr>'
				+ '</thead>'
				+ '<tbody>' + rowsHtml + '</tbody>'
				+ '</table>'
				+ '</div>'
				+ '<div style="display:flex;gap:8px">'
				+ '<button class="aff-btn aff-btn--xs aff-btn--secondary"'
				+   ' id="aff-merge-keep-all-aff">Keep all AFF</button>'
				+ '<button class="aff-btn aff-btn--xs aff-btn--secondary"'
				+   ' id="aff-merge-use-all-el">'
				+   (isFetch ? 'Use all Elementor' : 'Keep all Elementor')
				+ '</button>'
				+ '</div>';

			var footer =
				'<div style="display:flex;justify-content:flex-end;gap:8px">'
				+ '<button class="aff-btn aff-btn--secondary"'
				+   ' id="aff-merge-cancel">Cancel</button>'
				+ '<button class="aff-btn" id="aff-merge-apply">Apply &amp; Continue</button>'
				+ '</div>';

			var mergeHandler;

			AFF.Modal.open({
				title:   'Merge Conflicts',
				body:    body,
				footer:  footer,
				onClose: function () {
					document.removeEventListener('click', mergeHandler);
					if (onCancel) { onCancel(); }
				},
			});

			mergeHandler = function (e) {
				if (e.target.id === 'aff-merge-cancel') {
					document.removeEventListener('click', mergeHandler);
					AFF.Modal.close();
					if (onCancel) { onCancel(); }

				} else if (e.target.id === 'aff-merge-keep-all-aff') {
					self._setAll('aff', conflictVars);

				} else if (e.target.id === 'aff-merge-use-all-el') {
					self._setAll('el', conflictVars);

				} else if (e.target.id === 'aff-merge-apply') {
					document.removeEventListener('click', mergeHandler);
					var resolved = self._collectResolutions(conflictVars);
					AFF.Modal.close();
					if (onApply) { onApply(resolved); }
				}
			};

			document.addEventListener('click', mergeHandler);
		},

		// -----------------------------------------------------------------------
		// PRIVATE HELPERS
		// -----------------------------------------------------------------------

		/**
		 * Render a small inline color swatch for display alongside a CSS value.
		 * Returns empty string if the value is not a recognisable color.
		 *
		 * @param {string} value  CSS value string
		 * @returns {string}  HTML <span> or ''
		 */
		_swatch: function (value) {
			var lc = (value || '').trim().toLowerCase();
			if (!AFF.Utils || !AFF.Utils.isColorValue(lc)) { return ''; }
			return '<span style="display:inline-block;width:12px;height:12px'
				+ ';border-radius:2px;border:1px solid var(--aff-clr-border)'
				+ ';background:' + AFF.Utils.escHtml(value)
				+ ';vertical-align:middle;margin-right:3px"></span>';
		},

		/**
		 * Set every radio button in the conflict table to the given winner value.
		 *
		 * @param {string} winner        'aff' | 'el'
		 * @param {Array}  conflictVars  [{name, ...}, ...]
		 */
		_setAll: function (winner, conflictVars) {
			conflictVars.forEach(function (c) {
				var radioName = 'aff-merge-' + c.name.replace(/[^a-z0-9]/g, '-');
				var radios    = document.querySelectorAll('input[name="' + radioName + '"]');
				radios.forEach(function (r) {
					r.checked = (r.value === winner);
				});
			});
		},

		/**
		 * Read the radio button selections from the DOM after the user has resolved.
		 * Falls back to 'aff' if a radio group cannot be found.
		 *
		 * @param {Array} conflictVars
		 * @returns {Array}  [{name, winner: 'aff'|'el'}, ...]
		 */
		_collectResolutions: function (conflictVars) {
			return conflictVars.map(function (c) {
				var radioName = 'aff-merge-' + c.name.replace(/[^a-z0-9]/g, '-');
				var checked   = document.querySelector('input[name="' + radioName + '"]:checked');
				return { name: c.name, winner: checked ? checked.value : 'aff' };
			});
		},

	};

})();
