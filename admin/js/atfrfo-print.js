/**
 * ATFRFO Print — Variable & Class Print / PDF Feature
 *
 * Renders a print-ready document from ATFRFO.state.variables (Colors, Fonts,
 * Numbers — table rows) and ATFRFO.state.classes (card layout — classes have
 * no single "value" column the way a variable does, so each class prints as
 * a block: name, category, status, comment, style properties, and site-wide
 * usage, matching the on-screen class detail card's content). Opens a
 * selection modal; user chooses which sets to include and presses Print (or
 * Enter). Print/PDF happens in a separate, clean browser window (not this
 * one) via window.print().
 *
 * @package AtomicFrameworkForge
 */

(function () {
	'use strict';

	window.ATFRFO = window.ATFRFO || {};

	ATFRFO.Print = {

		// -------------------------------------------------------------------
		// INIT
		// -------------------------------------------------------------------

		_enterHandler:   null,
		_enterHandlerEl: null,

		init: function () {
			var btn = document.getElementById('atfrfo-btn-print');
			if (btn) {
				btn.addEventListener('click', this._openModal.bind(this));
			}

		},

		// -------------------------------------------------------------------
		// MODAL
		// -------------------------------------------------------------------

		_openModal: function () {
			var self  = this;
			var vars  = ATFRFO.state.variables || [];
			var hasColors  = vars.some(function (v) { return v.type === 'color'  && v.status !== 'deleted'; });
			var hasFonts   = vars.some(function (v) { return v.type === 'font'   && v.status !== 'deleted'; });
			var hasNumbers = vars.some(function (v) { return v.type === 'number' && v.status !== 'deleted'; });

			var classes    = ATFRFO.state.classes || [];
			var hasClasses = classes.length > 0;

			var counts = {
				colors:  vars.filter(function (v) { return v.type === 'color'  && v.status !== 'deleted'; }).length,
				fonts:   vars.filter(function (v) { return v.type === 'font'   && v.status !== 'deleted'; }).length,
				numbers: vars.filter(function (v) { return v.type === 'number' && v.status !== 'deleted'; }).length,
				classes: classes.length,
			};

			var body = '<div class="atfrfo-print-select">'
				+ '<p class="atfrfo-print-select__hint">Select what to include:</p>'
				+ self._chk('atfrfo-pchk-colors',  'Colors',  counts.colors,  hasColors)
				+ self._chk('atfrfo-pchk-fonts',   'Fonts',   counts.fonts,   hasFonts)
				+ self._chk('atfrfo-pchk-numbers', 'Numbers', counts.numbers, hasNumbers)
				+ self._chk('atfrfo-pchk-classes', 'Classes', counts.classes, hasClasses)
				+ '<hr class="atfrfo-print-select__sep">'
				+ '<label class="atfrfo-print-chk-row">'
				+ '<input type="checkbox" id="atfrfo-pchk-comments">'
				+ ' Print comments'
				+ '</label>'
				+ '</div>';

			var footer = '<button class="atfrfo-btn" id="atfrfo-print-cancel">Cancel</button>'
				+ '<button class="atfrfo-btn atfrfo-btn--primary" id="atfrfo-print-go">Print</button>';

			ATFRFO.Modal.open({
				title:   'Print',
				body:    body,
				footer:  footer,
				onClose: function () { self._removeEnterHandler(); },
			});

			// Wire footer buttons after Modal has injected them
			requestAnimationFrame(function () {
				var goBtn     = document.getElementById('atfrfo-print-go');
				var cancelBtn = document.getElementById('atfrfo-print-cancel');

				if (goBtn) {
					goBtn.addEventListener('click', function () {
						self._doPrint();
					});
				}
				if (cancelBtn) {
					cancelBtn.addEventListener('click', function () {
						ATFRFO.Modal.close();
					});
				}

				// Enter key triggers Print only while the print modal is open.
				// Stored on self so _removeEnterHandler() can clean it up.
				var modalEl = document.getElementById('atfrfo-modal');
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
			var countStr     = enabled ? ' <span class="atfrfo-print-chk-count">(' + count + ')</span>' : ' <span class="atfrfo-print-chk-empty">(none loaded)</span>';
			return '<label class="atfrfo-print-chk-row' + (enabled ? '' : ' atfrfo-print-chk-row--disabled') + '">'
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

			var self = this;
			var selection = {
				colors:   this._isChecked('atfrfo-pchk-colors'),
				fonts:    this._isChecked('atfrfo-pchk-fonts'),
				numbers:  this._isChecked('atfrfo-pchk-numbers'),
				classes:  this._isChecked('atfrfo-pchk-classes'),
				comments: this._isChecked('atfrfo-pchk-comments'),
			};

			ATFRFO.Modal.close();

			// Classes' Usage section needs Elementor's usage data, which is a
			// live scan (~400-450ms, see ATFRFO_Classes_Reader::get_usage_map())
			// — fetch (or reuse the session cache) before building the document
			// rather than printing without it. Colors/Fonts/Numbers need no such
			// wait, so skip it entirely when Classes isn't selected.
			if (selection.classes && ATFRFO.Classes && ATFRFO.Classes._fetchUsageMap) {
				ATFRFO.Classes._fetchUsageMap().then(function () {
					self._openPrintWindow(selection);
				}).catch(function () {
					self._openPrintWindow(selection); // print anyway, Usage sections show "could not load"
				});
			} else {
				this._openPrintWindow(selection);
			}
		},

		_openPrintWindow: function (selection) {
			var cssUrl  = (typeof ATFRFOData !== 'undefined' ? ATFRFOData.pluginUrl : '') + 'admin/css/atfrfo-print-page.css';
			var docHtml = this._buildDoc(selection);

			// Open a clean new window — no WP admin DOM or styles, so no blank
			// first page. The browser's print dialog includes "Save as PDF".
			var win = window.open('', '_blank', 'width=900,height=700');
			if (!win) { return; }

			win.document.write(
				'<!DOCTYPE html>'
				+ '<html><head>'
				+ '<meta charset="utf-8">'
				+ '<title>AFF Print</title>'
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
			var vars    = ATFRFO.state.variables || [];
			var project = (typeof ATFRFOData !== 'undefined' && ATFRFOData.siteName) ? ATFRFOData.siteName : '';
			var date    = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });

			var active = vars.filter(function (v) { return v.status !== 'deleted'; });
			var classes = ATFRFO.state.classes || [];
			var total  = 0;
			if (selection.colors)  { total += active.filter(function (v) { return v.type === 'color'; }).length; }
			if (selection.fonts)   { total += active.filter(function (v) { return v.type === 'font'; }).length; }
			if (selection.numbers) { total += active.filter(function (v) { return v.type === 'number'; }).length; }
			var countLabel = total + ' variable' + (total !== 1 ? 's' : '');
			if (selection.classes) {
				countLabel += ', ' + classes.length + ' class' + (classes.length !== 1 ? 'es' : '');
			}

			var html = '<div class="atfrfo-print-doc">';

			// Document header
			html += '<header class="atfrfo-print-doc-header">'
				+ '<div class="atfrfo-print-doc-header__title">Atomic Framework Forge for Elementor</div>'
				+ '<div class="atfrfo-print-doc-header__project">Website: ' + this._esc(project) + '</div>'
				+ '<div class="atfrfo-print-doc-header__date">Printed: ' + this._esc(date) + '</div>'
				+ '<div class="atfrfo-print-doc-header__count">Count: ' + countLabel + '</div>'
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
			if (selection.classes) {
				html += this._buildClassesSection(selection.comments);
			}

			html += '</div>';
			return html;
		},

		_buildSection: function (type, label, allVars, rowFn, printComments) {
			var vars = allVars.filter(function (v) { return v.type === type; });
			if (!vars.length) { return ''; }

			var catKeyMap  = { color: 'categories', font: 'fontCategories', number: 'numberCategories' };
			var allCats    = (ATFRFO.state.config && ATFRFO.state.config[catKeyMap[type]]) || [];
			var cats       = allCats.slice().sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
			var topCats    = cats.filter(function (c) { return !c.parent_id; });
			var placed     = {};
			var hasPreview = (type === 'color' || type === 'font');
			var colCount   = hasPreview ? 4 : 3;

			var html = '<section class="atfrfo-print-section atfrfo-print-section--' + type + '">'
				+ '<h2 class="atfrfo-print-section-title">'
				+ '<span class="atfrfo-print-section-badge atfrfo-print-section-badge--' + type + '">'
				+ this._esc(label)
				+ '<span class="atfrfo-print-section-count">' + vars.length + ' variable' + (vars.length !== 1 ? 's' : '') + '</span>'
				+ '</span>'
				+ '</h2>'
				+ '<table class="atfrfo-print-table">'
				+ '<thead><tr>'
				+ (hasPreview ? '<th class="atfrfo-ptcol-preview" scope="col"></th>' : '')
				+ '<th class="atfrfo-ptcol-name" scope="col">Name</th>'
				+ '<th class="atfrfo-ptcol-val" scope="col">Value</th>'
				+ '<th class="atfrfo-ptcol-fmt" scope="col">Format</th>'
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

				html += '<tr class="atfrfo-print-cat-row"><td colspan="' + colCount + '">' + this._esc(topCat.name) + '</td></tr>';

				// Sub-categories first, indented
				for (var sgi = 0; sgi < subGroups.length; sgi++) {
					if (!subGroups[sgi].vars.length) { continue; }
					html += '<tr class="atfrfo-print-subcat-row"><td colspan="' + colCount + '">' + this._esc(subGroups[sgi].name) + '</td></tr>';
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
						html += '<tr class="atfrfo-print-cat-row"><td colspan="' + colCount + '">Uncategorized</td></tr>';
						uncatStarted = true;
					}
					html += rowFn(vars[ui], printComments);
				}
			}

			html += '</tbody></table></section>';
			return html;
		},

		// -------------------------------------------------------------------
		// CLASSES — card layout, not a table (classes have no single "value"
		// column the way a color/font/number variable does; the useful
		// content is the same as the on-screen detail card: name, category,
		// status, comment, style properties, and site-wide usage).
		// -------------------------------------------------------------------

		_buildClassesSection: function (printComments) {
			var classes = ATFRFO.state.classes || [];
			if (!classes.length || !ATFRFO.Classes) { return ''; }

			var cats = ATFRFO.Classes._getCatsForSet();
			var topCats = cats.filter(function (c) { return !c.parent_id; });

			var html = '<section class="atfrfo-print-section atfrfo-print-section--class">'
				+ '<h2 class="atfrfo-print-section-title">'
				+ '<span class="atfrfo-print-section-badge atfrfo-print-section-badge--class">'
				+ 'Classes'
				+ '<span class="atfrfo-print-section-count">' + classes.length + ' class' + (classes.length !== 1 ? 'es' : '') + '</span>'
				+ '</span>'
				+ '</h2>';

			for (var ti = 0; ti < topCats.length; ti++) {
				var topCat = topCats[ti];
				var subCats = ATFRFO.Classes._getSubCategoriesOf(topCat.id, cats);
				var directClasses = ATFRFO.Classes._getClassesForCategory(topCat);

				var hasContent = directClasses.length > 0;
				var subGroups = [];
				for (var si = 0; si < subCats.length; si++) {
					var subClasses = ATFRFO.Classes._getClassesForCategory(subCats[si]);
					if (subClasses.length) { hasContent = true; }
					subGroups.push({ name: subCats[si].name, classes: subClasses });
				}
				if (!hasContent) { continue; }

				html += '<div class="atfrfo-print-class-cat-row">' + this._esc(topCat.name) + '</div>';

				for (var sgi = 0; sgi < subGroups.length; sgi++) {
					if (!subGroups[sgi].classes.length) { continue; }
					html += '<div class="atfrfo-print-class-subcat-row">' + this._esc(subGroups[sgi].name) + '</div>';
					for (var ri = 0; ri < subGroups[sgi].classes.length; ri++) {
						html += this._buildClassCard(subGroups[sgi].classes[ri], printComments);
					}
				}
				for (var di = 0; di < directClasses.length; di++) {
					html += this._buildClassCard(directClasses[di], printComments);
				}
			}

			html += '</section>';
			return html;
		},

		_buildClassCard: function (cls, printComments) {
			var meta = ATFRFO.Classes._statusMeta(cls.status);
			var variants = Array.isArray(cls.variants) ? cls.variants : [];
			var usageMap = ATFRFO.state.classUsageMap || {};
			var usage = usageMap[cls.elementor_id] || null;

			var html = '<div class="atfrfo-print-class-card">'
				+ '<div class="atfrfo-print-class-card__head">'
				+ '<span class="atfrfo-print-class-card__name">' + this._esc(cls.label || '') + '</span>'
				+ '<span class="atfrfo-print-class-card__status">'
				+ '<span class="atfrfo-print-status-dot" style="background:' + meta.color + '"></span>'
				+ this._esc(meta.label)
				+ '</span>'
				+ '</div>';

			if (printComments && cls.notes) {
				html += '<p class="atfrfo-print-comment atfrfo-print-class-card__comment">' + this._esc(cls.notes) + '</p>';
			}

			html += '<div class="atfrfo-print-class-card__body">';

			html += '<div class="atfrfo-print-class-card__props">';
			if (!variants.length) {
				html += '<p class="atfrfo-class-variant-empty">No style properties set.</p>';
			} else {
				for (var i = 0; i < variants.length; i++) {
					html += ATFRFO.Classes._renderVariantGroup(variants[i]);
				}
			}
			html += '</div>';

			html += '<div class="atfrfo-print-class-card__usage">'
				+ '<p class="atfrfo-print-class-card__usage-label">Usage</p>';
			if (!usage || !usage.total) {
				html += '<p class="atfrfo-class-variant-empty">Not used anywhere on the site.</p>';
			} else {
				html += '<p class="atfrfo-print-class-card__usage-total">'
					+ usage.total + ' element' + (usage.total === 1 ? '' : 's')
					+ ' across ' + usage.pages.length + ' page' + (usage.pages.length === 1 ? '' : 's')
					+ '</p>'
					+ '<ul class="atfrfo-print-usage-pages">';
				for (var pi = 0; pi < usage.pages.length; pi++) {
					var p = usage.pages[pi];
					html += '<li>' + this._esc(p.title || '(untitled)') + ' <span class="atfrfo-print-usage-count">(' + (p.total || 0) + ')</span></li>';
				}
				html += '</ul>';
			}
			html += '</div>'; // usage

			html += '</div>'; // body
			html += '</div>'; // card
			return html;
		},

		_colorsRow: function (v, printComments, isSubCat) {
			var cmtClass = isSubCat ? 'atfrfo-print-subcat-var atfrfo-print-comment-row' : 'atfrfo-print-comment-row';
			var html;
			if (isSubCat) {
				html = '<tr class="atfrfo-print-subcat-var">'
					+ '<td class="atfrfo-ptcol-preview"></td>'
					+ '<td class="atfrfo-ptcol-name atfrfo-print-varname">'
					+ '<span class="atfrfo-print-swatch atfrfo-print-swatch--inline" style="background:' + this._esc(v.value || '') + '"></span>'
					+ ' ' + this._esc(v.name || '')
					+ '</td>'
					+ '<td class="atfrfo-ptcol-val atfrfo-print-monospace">' + this._esc(v.value || '') + '</td>'
					+ '<td class="atfrfo-ptcol-fmt">' + this._esc(v.format || '') + '</td>'
					+ '</tr>';
			} else {
				html = '<tr>'
					+ '<td class="atfrfo-ptcol-preview"><span class="atfrfo-print-swatch" style="background:' + this._esc(v.value || '') + '"></span></td>'
					+ '<td class="atfrfo-ptcol-name atfrfo-print-varname">' + this._esc(v.name || '') + '</td>'
					+ '<td class="atfrfo-ptcol-val atfrfo-print-monospace">' + this._esc(v.value || '') + '</td>'
					+ '<td class="atfrfo-ptcol-fmt">' + this._esc(v.format || '') + '</td>'
					+ '</tr>';
			}
			if (printComments && v.notes) {
				html += '<tr class="' + cmtClass + '">'
					+ '<td class="atfrfo-ptcol-preview"></td>'
					+ '<td colspan="3" class="atfrfo-print-comment">' + this._esc(v.notes) + '</td>'
					+ '</tr>';
			}
			return html;
		},

		_fontsRow: function (v, printComments, isSubCat) {
			var cmtClass = isSubCat ? 'atfrfo-print-subcat-var atfrfo-print-comment-row' : 'atfrfo-print-comment-row';
			var html;
			if (isSubCat) {
				html = '<tr class="atfrfo-print-subcat-var">'
					+ '<td class="atfrfo-ptcol-preview"></td>'
					+ '<td class="atfrfo-ptcol-name atfrfo-print-varname">'
					+ '<span class="atfrfo-print-font-preview atfrfo-print-font-preview--inline" style="font-family:' + this._esc(v.value || '') + '">ABCabc</span>'
					+ ' ' + this._esc(v.name || '')
					+ '</td>'
					+ '<td class="atfrfo-ptcol-val">' + this._esc(v.value || '') + '</td>'
					+ '<td class="atfrfo-ptcol-fmt">' + this._esc(v.format || '') + '</td>'
					+ '</tr>';
			} else {
				html = '<tr>'
					+ '<td class="atfrfo-ptcol-preview"><span class="atfrfo-print-font-preview" style="font-family:' + this._esc(v.value || '') + '">ABCabc</span></td>'
					+ '<td class="atfrfo-ptcol-name atfrfo-print-varname">' + this._esc(v.name || '') + '</td>'
					+ '<td class="atfrfo-ptcol-val">' + this._esc(v.value || '') + '</td>'
					+ '<td class="atfrfo-ptcol-fmt">' + this._esc(v.format || '') + '</td>'
					+ '</tr>';
			}
			if (printComments && v.notes) {
				html += '<tr class="' + cmtClass + '">'
					+ '<td class="atfrfo-ptcol-preview"></td>'
					+ '<td colspan="3" class="atfrfo-print-comment">' + this._esc(v.notes) + '</td>'
					+ '</tr>';
			}
			return html;
		},

		_numbersRow: function (v, printComments, isSubCat) {
			var trClass = isSubCat ? ' class="atfrfo-print-subcat-var"' : '';
			var cmtClass = isSubCat ? 'atfrfo-print-subcat-var atfrfo-print-comment-row' : 'atfrfo-print-comment-row';
			var html = '<tr' + trClass + '>'
				+ '<td class="atfrfo-ptcol-name atfrfo-print-varname">' + this._esc(v.name || '') + '</td>'
				+ '<td class="atfrfo-ptcol-val atfrfo-print-monospace">' + this._esc(v.value || '') + '</td>'
				+ '<td class="atfrfo-ptcol-fmt">' + this._esc(v.format || '') + '</td>'
				+ '</tr>';
			if (printComments && v.notes) {
				html += '<tr class="' + cmtClass + '">'
					+ '<td colspan="3" class="atfrfo-print-comment">' + this._esc(v.notes) + '</td>'
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
