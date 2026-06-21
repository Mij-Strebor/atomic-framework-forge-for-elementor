/**
 * AFF Print — Variable Print / PDF Feature
 *
 * Renders a print-ready document from AFF.state.variables for Colors,
 * Fonts, and Numbers. Opens a selection modal; user chooses which sets
 * to include and presses Print (or Enter). The document is injected into
 * a hidden #aff-print-container div; @media print CSS hides the AFF UI
 * and shows only that container.
 *
 * @package AtomicFrameworkForge
 */

(function () {
	'use strict';

	window.AFF = window.AFF || {};

	AFF.Print = {

		// -------------------------------------------------------------------
		// INIT
		// -------------------------------------------------------------------

		_enterHandler:   null,
		_enterHandlerEl: null,

		init: function () {
			var btn = document.getElementById('aff-btn-print');
			if (btn) {
				btn.addEventListener('click', this._openModal.bind(this));
			}

		},

		// -------------------------------------------------------------------
		// MODAL
		// -------------------------------------------------------------------

		_openModal: function () {
			var self  = this;
			var vars  = AFF.state.variables || [];
			var hasColors  = vars.some(function (v) { return v.type === 'color'  && v.status !== 'deleted'; });
			var hasFonts   = vars.some(function (v) { return v.type === 'font'   && v.status !== 'deleted'; });
			var hasNumbers = vars.some(function (v) { return v.type === 'number' && v.status !== 'deleted'; });

			var counts = {
				colors:  vars.filter(function (v) { return v.type === 'color'  && v.status !== 'deleted'; }).length,
				fonts:   vars.filter(function (v) { return v.type === 'font'   && v.status !== 'deleted'; }).length,
				numbers: vars.filter(function (v) { return v.type === 'number' && v.status !== 'deleted'; }).length,
			};

			var body = '<div class="aff-print-select">'
				+ '<p class="aff-print-select__hint">Select which variable sets to include:</p>'
				+ self._chk('aff-pchk-colors',  'Colors',  counts.colors,  hasColors)
				+ self._chk('aff-pchk-fonts',   'Fonts',   counts.fonts,   hasFonts)
				+ self._chk('aff-pchk-numbers', 'Numbers', counts.numbers, hasNumbers)
				+ '<hr class="aff-print-select__sep">'
				+ '<label class="aff-print-chk-row">'
				+ '<input type="checkbox" id="aff-pchk-comments">'
				+ ' Print comments'
				+ '</label>'
				+ '</div>';

			var footer = '<button class="aff-btn" id="aff-print-cancel">Cancel</button>'
				+ '<button class="aff-btn aff-btn--primary" id="aff-print-go">Print</button>';

			AFF.Modal.open({
				title:   'Print Variables',
				body:    body,
				footer:  footer,
				onClose: function () { self._removeEnterHandler(); },
			});

			// Wire footer buttons after Modal has injected them
			requestAnimationFrame(function () {
				var goBtn     = document.getElementById('aff-print-go');
				var cancelBtn = document.getElementById('aff-print-cancel');

				if (goBtn) {
					goBtn.addEventListener('click', function () {
						self._doPrint();
					});
				}
				if (cancelBtn) {
					cancelBtn.addEventListener('click', function () {
						AFF.Modal.close();
					});
				}

				// Enter key triggers Print only while the print modal is open.
				// Stored on self so _removeEnterHandler() can clean it up.
				var modalEl = document.getElementById('aff-modal');
				if (modalEl) {
					self._enterHandler = function (e) {
						if (e.key === 'Enter') {
							e.preventDefault();
							self._doPrint();
						}
					};
					modalEl.addEventListener('keydown', self._enterHandler);
					self._enterHandlerEl = modalEl;
				}
			});
		},

		_chk: function (id, label, count, enabled) {
			var disabledAttr = enabled ? '' : ' disabled';
			var checkedAttr  = enabled ? ' checked' : '';
			var countStr     = enabled ? ' <span class="aff-print-chk-count">(' + count + ')</span>' : ' <span class="aff-print-chk-empty">(none loaded)</span>';
			return '<label class="aff-print-chk-row' + (enabled ? '' : ' aff-print-chk-row--disabled') + '">'
				+ '<input type="checkbox" id="' + id + '"' + checkedAttr + disabledAttr + '>'
				+ ' ' + label + countStr
				+ '</label>';
		},

		// -------------------------------------------------------------------
		// PRINT
		// -------------------------------------------------------------------

		_removeEnterHandler: function () {
			if (this._enterHandlerEl && this._enterHandler) {
				this._enterHandlerEl.removeEventListener('keydown', this._enterHandler);
			}
			this._enterHandler    = null;
			this._enterHandlerEl  = null;
		},

		_doPrint: function () {
			this._removeEnterHandler();

			var selection = {
				colors:   this._isChecked('aff-pchk-colors'),
				fonts:    this._isChecked('aff-pchk-fonts'),
				numbers:  this._isChecked('aff-pchk-numbers'),
				comments: this._isChecked('aff-pchk-comments'),
			};

			AFF.Modal.close();

			var cssUrl  = (typeof AFFData !== 'undefined' ? AFFData.pluginUrl : '') + 'admin/css/aff-print-page.css';
			var docHtml = this._buildDoc(selection);

			// Open a clean new window — no WP admin DOM or styles, so no blank
			// first page. The browser's print dialog includes "Save as PDF".
			var win = window.open('', '_blank', 'width=900,height=700');
			if (!win) { return; }

			win.document.write(
				'<!DOCTYPE html>'
				+ '<html><head>'
				+ '<meta charset="utf-8">'
				+ '<title>AFF Variables</title>'
				+ '<link rel="stylesheet" href="' + cssUrl + '">'
				+ '</head><body>'
				+ docHtml
				+ '<scr' + 'ipt>'
				+ 'window.onload = function () {'
				+ '  setTimeout(function () { window.print(); }, 200);'
				+ '};'
				+ '</scr' + 'ipt>'
				+ '</body></html>'
			);
			win.document.close();
		},

		_isChecked: function (id) {
			var el = document.getElementById(id);
			return el ? el.checked : false;
		},

		// -------------------------------------------------------------------
		// DOCUMENT BUILDER
		// -------------------------------------------------------------------

		_buildDoc: function (selection) {
			var vars    = AFF.state.variables || [];
			var project = (typeof AFFData !== 'undefined' && AFFData.siteName) ? AFFData.siteName : '';
			var date    = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });

			var active = vars.filter(function (v) { return v.status !== 'deleted'; });
			var total  = 0;
			if (selection.colors)  { total += active.filter(function (v) { return v.type === 'color'; }).length; }
			if (selection.fonts)   { total += active.filter(function (v) { return v.type === 'font'; }).length; }
			if (selection.numbers) { total += active.filter(function (v) { return v.type === 'number'; }).length; }

			var html = '<div class="aff-print-doc">';

			// Document header
			html += '<header class="aff-print-doc-header">'
				+ '<div class="aff-print-doc-header__title">Atomic Framework Forge for Elementor</div>'
				+ '<div class="aff-print-doc-header__project">Website: ' + this._esc(project) + '</div>'
				+ '<div class="aff-print-doc-header__date">Printed: ' + this._esc(date) + '</div>'
				+ '<div class="aff-print-doc-header__count">Count: ' + total + ' variable' + (total !== 1 ? 's' : '') + '</div>'
				+ '</header>';

			if (selection.colors) {
				html += this._buildSection('color',  'Colors',  active, this._colorsRow.bind(this),  selection.comments);
			}
			if (selection.fonts) {
				html += this._buildSection('font',   'Fonts',   active, this._fontsRow.bind(this),   selection.comments);
			}
			if (selection.numbers) {
				html += this._buildSection('number', 'Numbers', active, this._numbersRow.bind(this), selection.comments);
			}

			html += '</div>';
			return html;
		},

		_buildSection: function (type, label, allVars, rowFn, printComments) {
			var vars = allVars.filter(function (v) { return v.type === type; });
			if (!vars.length) { return ''; }

			var catKeyMap  = { color: 'categories', font: 'fontCategories', number: 'numberCategories' };
			var allCats    = (AFF.state.config && AFF.state.config[catKeyMap[type]]) || [];
			var cats       = allCats.slice().sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
			var topCats    = cats.filter(function (c) { return !c.parent_id; });
			var placed     = {};
			var hasPreview = (type === 'color' || type === 'font');
			var colCount   = hasPreview ? 4 : 3;

			var html = '<section class="aff-print-section aff-print-section--' + type + '">'
				+ '<h2 class="aff-print-section-title">'
				+ '<span class="aff-print-section-badge aff-print-section-badge--' + type + '">'
				+ this._esc(label)
				+ '<span class="aff-print-section-count">' + vars.length + ' variable' + (vars.length !== 1 ? 's' : '') + '</span>'
				+ '</span>'
				+ '</h2>'
				+ '<table class="aff-print-table">'
				+ '<thead><tr>'
				+ (hasPreview ? '<th class="aff-ptcol-preview" scope="col"></th>' : '')
				+ '<th class="aff-ptcol-name" scope="col">Name</th>'
				+ '<th class="aff-ptcol-val" scope="col">Value</th>'
				+ '<th class="aff-ptcol-fmt" scope="col">Format</th>'
				+ '</tr></thead>'
				+ '<tbody>';

			for (var ti = 0; ti < topCats.length; ti++) {
				var topCat  = topCats[ti];
				var subCats = cats.filter(function (c) { return c.parent_id === topCat.id; });

				// Collect vars belonging directly to this top-level category
				var directVars = [];
				for (var dvi = 0; dvi < vars.length; dvi++) {
					if (vars[dvi].category_id === topCat.id && !placed[vars[dvi].id]) {
						directVars.push(vars[dvi]);
						placed[vars[dvi].id] = true;
					}
				}

				// Collect vars for each sub-category
				var subGroups = [];
				for (var si = 0; si < subCats.length; si++) {
					var subCat  = subCats[si];
					var subVars = [];
					for (var svi = 0; svi < vars.length; svi++) {
						if (vars[svi].category_id === subCat.id && !placed[vars[svi].id]) {
							subVars.push(vars[svi]);
							placed[vars[svi].id] = true;
						}
					}
					subGroups.push({ name: subCat.name, vars: subVars });
				}

				// Skip this top-level cat entirely if it has no content at all
				var hasContent = directVars.length > 0;
				if (!hasContent) {
					for (var sgi2 = 0; sgi2 < subGroups.length; sgi2++) {
						if (subGroups[sgi2].vars.length) { hasContent = true; break; }
					}
				}
				if (!hasContent) { continue; }

				html += '<tr class="aff-print-cat-row"><td colspan="' + colCount + '">' + this._esc(topCat.name) + '</td></tr>';

				// Sub-categories first, indented
				for (var sgi = 0; sgi < subGroups.length; sgi++) {
					if (!subGroups[sgi].vars.length) { continue; }
					html += '<tr class="aff-print-subcat-row"><td colspan="' + colCount + '">' + this._esc(subGroups[sgi].name) + '</td></tr>';
					for (var ri = 0; ri < subGroups[sgi].vars.length; ri++) {
						html += rowFn(subGroups[sgi].vars[ri], printComments, true);
					}
				}

				// Direct vars of the top-level category follow sub-categories
				for (var di = 0; di < directVars.length; di++) {
					html += rowFn(directVars[di], printComments);
				}
			}

			// Append any vars not matched to a known top-level category
			var uncatStarted = false;
			for (var ui = 0; ui < vars.length; ui++) {
				if (!placed[vars[ui].id]) {
					if (!uncatStarted) {
						html += '<tr class="aff-print-cat-row"><td colspan="' + colCount + '">Uncategorized</td></tr>';
						uncatStarted = true;
					}
					html += rowFn(vars[ui], printComments);
				}
			}

			html += '</tbody></table></section>';
			return html;
		},

		_colorsRow: function (v, printComments, isSubCat) {
			var cmtClass = isSubCat ? 'aff-print-subcat-var aff-print-comment-row' : 'aff-print-comment-row';
			var html;
			if (isSubCat) {
				html = '<tr class="aff-print-subcat-var">'
					+ '<td class="aff-ptcol-preview"></td>'
					+ '<td class="aff-ptcol-name aff-print-varname">'
					+ '<span class="aff-print-swatch aff-print-swatch--inline" style="background:' + this._esc(v.value || '') + '"></span>'
					+ ' ' + this._esc(v.name || '')
					+ '</td>'
					+ '<td class="aff-ptcol-val aff-print-monospace">' + this._esc(v.value || '') + '</td>'
					+ '<td class="aff-ptcol-fmt">' + this._esc(v.format || '') + '</td>'
					+ '</tr>';
			} else {
				html = '<tr>'
					+ '<td class="aff-ptcol-preview"><span class="aff-print-swatch" style="background:' + this._esc(v.value || '') + '"></span></td>'
					+ '<td class="aff-ptcol-name aff-print-varname">' + this._esc(v.name || '') + '</td>'
					+ '<td class="aff-ptcol-val aff-print-monospace">' + this._esc(v.value || '') + '</td>'
					+ '<td class="aff-ptcol-fmt">' + this._esc(v.format || '') + '</td>'
					+ '</tr>';
			}
			if (printComments && v.notes) {
				html += '<tr class="' + cmtClass + '">'
					+ '<td class="aff-ptcol-preview"></td>'
					+ '<td colspan="3" class="aff-print-comment">' + this._esc(v.notes) + '</td>'
					+ '</tr>';
			}
			return html;
		},

		_fontsRow: function (v, printComments, isSubCat) {
			var cmtClass = isSubCat ? 'aff-print-subcat-var aff-print-comment-row' : 'aff-print-comment-row';
			var html;
			if (isSubCat) {
				html = '<tr class="aff-print-subcat-var">'
					+ '<td class="aff-ptcol-preview"></td>'
					+ '<td class="aff-ptcol-name aff-print-varname">'
					+ '<span class="aff-print-font-preview aff-print-font-preview--inline" style="font-family:' + this._esc(v.value || '') + '">ABCabc</span>'
					+ ' ' + this._esc(v.name || '')
					+ '</td>'
					+ '<td class="aff-ptcol-val">' + this._esc(v.value || '') + '</td>'
					+ '<td class="aff-ptcol-fmt">' + this._esc(v.format || '') + '</td>'
					+ '</tr>';
			} else {
				html = '<tr>'
					+ '<td class="aff-ptcol-preview"><span class="aff-print-font-preview" style="font-family:' + this._esc(v.value || '') + '">ABCabc</span></td>'
					+ '<td class="aff-ptcol-name aff-print-varname">' + this._esc(v.name || '') + '</td>'
					+ '<td class="aff-ptcol-val">' + this._esc(v.value || '') + '</td>'
					+ '<td class="aff-ptcol-fmt">' + this._esc(v.format || '') + '</td>'
					+ '</tr>';
			}
			if (printComments && v.notes) {
				html += '<tr class="' + cmtClass + '">'
					+ '<td class="aff-ptcol-preview"></td>'
					+ '<td colspan="3" class="aff-print-comment">' + this._esc(v.notes) + '</td>'
					+ '</tr>';
			}
			return html;
		},

		_numbersRow: function (v, printComments, isSubCat) {
			var trClass = isSubCat ? ' class="aff-print-subcat-var"' : '';
			var cmtClass = isSubCat ? 'aff-print-subcat-var aff-print-comment-row' : 'aff-print-comment-row';
			var html = '<tr' + trClass + '>'
				+ '<td class="aff-ptcol-name aff-print-varname">' + this._esc(v.name || '') + '</td>'
				+ '<td class="aff-ptcol-val aff-print-monospace">' + this._esc(v.value || '') + '</td>'
				+ '<td class="aff-ptcol-fmt">' + this._esc(v.format || '') + '</td>'
				+ '</tr>';
			if (printComments && v.notes) {
				html += '<tr class="' + cmtClass + '">'
					+ '<td colspan="3" class="aff-print-comment">' + this._esc(v.notes) + '</td>'
					+ '</tr>';
			}
			return html;
		},

		// -------------------------------------------------------------------
		// UTILITIES
		// -------------------------------------------------------------------

		_esc: function (str) {
			return String(str)
				.replace(/&/g, '&amp;')
				.replace(/</g, '&lt;')
				.replace(/>/g, '&gt;')
				.replace(/"/g, '&quot;');
		},
	};

})();
