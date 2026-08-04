/**
 * ATFRFO Font Picker — Combo-box dropdown for Font variable rows.
 *
 * Opens on focus/click of any [data-font-picker] input. Shows a search box
 * and a grouped list (Custom Fonts from Elementor, System web-safe fonts).
 * Selecting an item saves via the Fonts Variables instance.
 *
 * @package AtomicFrameworkForge
 */

(function () {
	'use strict';

	window.ATFRFO = window.ATFRFO || {};

	ATFRFO.FontPicker = {

		_fonts:       null,   // { custom: string[], system: string[] } — cached
		_dropdown:    null,   // current .atfrfo-fp-dropdown in the DOM
		_activeInput: null,   // <input> that owns the open dropdown
		_activeRow:   null,   // .atfrfo-color-row that contains activeInput
		_ignoreOpen:  false,  // blocks reopening for 300 ms after a selection

		init: function () {
			var self = this;

			// Open when the value input receives focus (tab-in or first click).
			// Guard uses _activeInput (not _dropdown) so an in-flight async fetch
			// blocks a second open call that would create a ghost panel in the DOM.
			document.addEventListener('focusin', function (e) {
				if (self._ignoreOpen) { return; }
				var input = e.target;
				if (!input || !input.matches('input.atfrfo-var-value-input[data-font-picker]')) { return; }
				if (self._activeInput === input) { return; }
				self._openDropdown(input);
			});

			// Re-open when the already-focused input is clicked (focusin won't re-fire).
			document.addEventListener('click', function (e) {
				if (self._ignoreOpen) { return; }
				var input = e.target;
				if (!input || !input.matches('input.atfrfo-var-value-input[data-font-picker]')) { return; }
				if (self._activeInput === input) { return; }
				self._openDropdown(input);
			});

			// Close when focus moves outside both the input and the dropdown.
			document.addEventListener('focusin', function (e) {
				if (!self._dropdown) { return; }
				var t = e.target;
				if (t === self._activeInput) { return; }
				if (self._dropdown.contains(t)) { return; }
				self._closeDropdown();
			});

			// Close when clicking outside the input and dropdown.
			document.addEventListener('mousedown', function (e) {
				if (!self._dropdown) { return; }
				if (e.target === self._activeInput) { return; }
				if (self._dropdown.contains(e.target)) { return; }
				self._closeDropdown();
			});

			// Keyboard navigation (input must be focused).
			document.addEventListener('keydown', function (e) {
				if (!self._dropdown || e.target !== self._activeInput) { return; }
				switch (e.key) {
					case 'Escape':
						e.preventDefault();
						self._closeDropdown();
						break;
					case 'ArrowDown':
						e.preventDefault();
						self._moveActive(1);
						break;
					case 'ArrowUp':
						e.preventDefault();
						self._moveActive(-1);
						break;
					case 'Enter':
						e.preventDefault();
						self._selectActive();
						break;
				}
			});
		},

		_openDropdown: function (input) {
			var self = this;
			self._closeDropdown();
			self._activeInput = input;
			self._activeRow   = input.closest('.atfrfo-color-row');

			self._fetchFonts(function (fonts) {
				if (!document.contains(input) || !self._activeRow) { return; }

				var dropdown      = document.createElement('div');
				dropdown.className = 'atfrfo-fp-dropdown';
				dropdown.innerHTML = self._buildHtml(fonts, input.value);
				// Insert immediately after the row — flows in the DOM, no positioning math.
				self._activeRow.insertAdjacentElement('afterend', dropdown);

				// Align left edge with the value input; span to the row's right edge.
				var inputRect = input.getBoundingClientRect();
				var rowRect   = self._activeRow.getBoundingClientRect();
				dropdown.style.marginLeft = (inputRect.left - rowRect.left) + 'px';
				dropdown.style.maxWidth   = (rowRect.right  - inputRect.left) + 'px';
				self._dropdown = dropdown;

				// Search filter — wired on the input element.
				var searchInput = dropdown.querySelector('.atfrfo-fp-search');
				if (searchInput) {
					searchInput.addEventListener('input', function () {
						self._filterList(searchInput.value.trim().toLowerCase());
					});
				}

				// Item selection via click.  Items have tabindex="-1" so clicking
				// them moves focus into the dropdown (keeping it open per the focusin
				// close-guard), then _selectItem refocuses the value input.
				dropdown.addEventListener('click', function (e) {
					var item = e.target.closest('.atfrfo-fp-item');
					if (!item) { return; }
					self._selectItem(item);
				});
			});
		},

		_closeDropdown: function () {
			if (this._dropdown) {
				this._dropdown.remove();
				this._dropdown = null;
			}
			this._activeInput = null;
			this._activeRow   = null;
		},

		_buildHtml: function (fonts, currentValue) {
			var cv   = (currentValue || '').toLowerCase();
			var html = '<div class="atfrfo-fp-search-wrap">'
				+ '<input type="text" class="atfrfo-fp-search" placeholder="Search fonts\u2026" autocomplete="off">'
				+ '</div>'
				+ '<div class="atfrfo-fp-list">';

			var groups = [
				{ label: 'Custom Fonts', type: 'Custom', items: fonts.custom || [] },
				{ label: 'System',       type: 'System', items: fonts.system || [] },
			];

			for (var gi = 0; gi < groups.length; gi++) {
				var g = groups[gi];
				if (!g.items.length) { continue; }
				html += '<div class="atfrfo-fp-group" data-group-type="' + g.type + '">'
					+ '<div class="atfrfo-fp-group-heading">' + ATFRFO.Utils.escHtml(g.label) + '</div>';
				for (var fi = 0; fi < g.items.length; fi++) {
					var font     = g.items[fi];
					var isActive = font.toLowerCase() === cv;
					html += '<div class="atfrfo-fp-item'
						+ (isActive ? ' atfrfo-fp-item--active' : '') + '"'
						+ ' tabindex="-1"'
						+ ' data-font="' + ATFRFO.Utils.escAttr(font) + '"'
						+ ' data-type="' + g.type + '"'
						+ ' style="font-family:' + ATFRFO.Utils.escAttr(font) + '">'
						+ ATFRFO.Utils.escHtml(font)
						+ '</div>';
				}
				html += '</div>';
			}

			html += '</div>';
			return html;
		},

		_filterList: function (query) {
			var dropdown = this._dropdown;
			if (!dropdown) { return; }

			var groups = dropdown.querySelectorAll('.atfrfo-fp-group');
			for (var gi = 0; gi < groups.length; gi++) {
				var group      = groups[gi];
				var items      = group.querySelectorAll('.atfrfo-fp-item');
				var anyVisible = false;
				for (var fi = 0; fi < items.length; fi++) {
					var item    = items[fi];
					var visible = !query || (item.getAttribute('data-font') || '').toLowerCase().indexOf(query) !== -1;
					item.style.display = visible ? '' : 'none';
					if (visible) { anyVisible = true; }
				}
				group.style.display = anyVisible ? '' : 'none';
			}
		},

		_moveActive: function (dir) {
			var dropdown = this._dropdown;
			if (!dropdown) { return; }

			var allItems = dropdown.querySelectorAll('.atfrfo-fp-item');
			var visible  = [];
			for (var i = 0; i < allItems.length; i++) {
				if (allItems[i].style.display !== 'none') { visible.push(allItems[i]); }
			}
			if (!visible.length) { return; }

			var current = dropdown.querySelector('.atfrfo-fp-item--active');
			var idx     = -1;
			for (var j = 0; j < visible.length; j++) {
				if (visible[j] === current) { idx = j; break; }
			}

			if (current) { current.classList.remove('atfrfo-fp-item--active'); }

			var next = idx + dir;
			if (next < 0)               { next = visible.length - 1; }
			if (next >= visible.length) { next = 0; }

			visible[next].classList.add('atfrfo-fp-item--active');
			visible[next].scrollIntoView({ block: 'nearest' });
		},

		_selectActive: function () {
			var active = this._dropdown && this._dropdown.querySelector('.atfrfo-fp-item--active');
			if (active) { this._selectItem(active); }
		},

		_selectItem: function (item) {
			var self       = this;
			var fontFamily = item.getAttribute('data-font') || '';
			var fontType   = item.getAttribute('data-type') || 'System';
			var input      = this._activeInput;
			var row        = this._activeRow;
			if (!input || !row) { return; }

			var varId = row.getAttribute('data-var-id');
			if (!varId) { return; }

			// Update DOM immediately.
			input.value            = fontFamily;
			input.style.fontFamily = fontFamily;
			input.setAttribute('data-original', fontFamily);

			var fmtSel = row.querySelector('.atfrfo-var-format-sel');
			if (fmtSel) { fmtSel.value = fontType; }

			var preview = row.querySelector('.atfrfo-font-preview');
			if (preview) { preview.style.fontFamily = fontFamily; }

			// Persist via the Fonts Variables instance.
			var inst = ATFRFO.Variables && ATFRFO.Variables._sets && ATFRFO.Variables._sets['Fonts'];
			if (inst) {
				inst._saveVarValue(varId, fontFamily, input, fontType);
			}

			// Block the focusin open-handler for 300 ms, then refocus the input.
			// Refocusing fires focusin which would re-open — _ignoreOpen prevents that.
			// After 300 ms the flag clears: user can click the input to open again.
			self._ignoreOpen = true;
			self._closeDropdown();
			input.focus();
			setTimeout(function () { self._ignoreOpen = false; }, 300);
		},

		_fetchFonts: function (cb) {
			var self = this;

			if (self._fonts) {
				cb(self._fonts);
				return;
			}

			ATFRFO.App.ajax('atfrfo_get_font_list', {}).then(function (res) {
				var data    = (res && res.success && res.data) ? res.data : {};
				self._fonts = {
					custom: Array.isArray(data.custom) ? data.custom : [],
					system: Array.isArray(data.system) ? data.system : [],
				};
				cb(self._fonts);
			}).catch(function () {
				self._fonts = {
					custom: [],
					system: [
						'Arial', 'Arial Black', 'Comic Sans MS', 'Courier New',
						'Georgia', 'Helvetica', 'Impact', 'Lucida Console',
						'Lucida Sans Unicode', 'Palatino Linotype', 'Tahoma',
						'Times New Roman', 'Trebuchet MS', 'Verdana',
					],
				};
				cb(self._fonts);
			});
		},
	};

})();
