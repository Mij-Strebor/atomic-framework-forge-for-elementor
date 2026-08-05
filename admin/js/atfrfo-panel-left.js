/**
 * ATFRFO Panel Left — Navigation Tree, Accordion, Collapse, and Category Loading
 *
 * Manages:
 *  - Expand/collapse of top-level group headers
 *  - Expand/collapse of subgroup headers
 *  - Left panel collapse to icon-only mode
 *  - Dynamic population of nav leaf items from project config
 *  - Active selection state and edit space loading trigger
 *
 * Phase 2: Colors nav reads from config.categories (Phase 2 structure) when
 * available, falling back to config.groups.Variables.Colors (v1 structure).
 *
 * Keyboard navigation (WCAG 2.1 AA):
 *  - Arrow Up/Down: move between nav items
 *  - Enter / Space: select item or toggle group
 *
 * @package AtomicFrameworkForge
 */

(function () {
	'use strict';

	window.ATFRFO = window.ATFRFO || {};

	ATFRFO.PanelLeft = {

		/** @type {HTMLElement|null} */
		_panel: null,
		/** @type {HTMLElement|null} */
		_collapseBtn: null,

		/**
		 * Initialize the left panel.
		 */
		init: function () {
			this._panel      = document.getElementById('atfrfo-panel-left');
			this._collapseBtn = document.getElementById('atfrfo-btn-collapse-left');

			if (!this._panel) {
				return;
			}

			this._bindGroupHeaders();
			this._bindSubgroupHeaders();
			this._bindCollapseToggle();
			this._loadNavItems();
		},

		// ------------------------------------------------------------------
		// NAV TREE — Group accordion
		// ------------------------------------------------------------------

		/**
		 * Bind click and keyboard handlers to all top-level group headers.
		 */
		_bindGroupHeaders: function () {
			var headers = this._panel.querySelectorAll('.atfrfo-nav-group__header');

			headers.forEach(function (header) {
				header.addEventListener('click', function () {
					this._toggleGroup(header);
				}.bind(this));

				header.addEventListener('keydown', function (e) {
					if (e.key === 'Enter' || e.key === ' ') {
						e.preventDefault();
						this._toggleGroup(header);
					}
				}.bind(this));
			}.bind(this));
		},

		/**
		 * Toggle a top-level group open/closed.
		 *
		 * @param {HTMLElement} header
		 */
		_toggleGroup: function (header) {
			var expanded   = header.getAttribute('aria-expanded') === 'true';
			var controlsId = header.getAttribute('aria-controls');
			var children   = document.getElementById(controlsId);

			if (!children) {
				return;
			}

			var newExpanded = !expanded;
			header.setAttribute('aria-expanded', String(newExpanded));

			if (newExpanded) {
				children.removeAttribute('hidden');
				// Always expand all subgroups fully — no memory of prior state.
				var subHeaders = children.querySelectorAll('.atfrfo-nav-subgroup__header');
				subHeaders.forEach(function (sh) {
					var shId    = sh.getAttribute('aria-controls');
					var shItems = shId ? document.getElementById(shId) : null;
					sh.setAttribute('aria-expanded', 'true');
					if (shItems) { shItems.removeAttribute('hidden'); }
				});
			} else {
				children.setAttribute('hidden', '');
			}
		},

		/**
		 * Bind click handlers to all subgroup headers.
		 */
		_bindSubgroupHeaders: function () {
			var headers = this._panel.querySelectorAll('.atfrfo-nav-subgroup__header');

			headers.forEach(function (header) {
				header.addEventListener('click', function () {
					this._toggleSubgroup(header);
				}.bind(this));
			}.bind(this));
		},

		/**
		 * Toggle a subgroup open/closed.
		 *
		 * @param {HTMLElement} header
		 */
		_toggleSubgroup: function (header) {
			var expanded   = header.getAttribute('aria-expanded') === 'true';
			var controlsId = header.getAttribute('aria-controls');
			var items      = document.getElementById(controlsId);

			if (!items) {
				return;
			}

			var newExpanded = !expanded;
			header.setAttribute('aria-expanded', String(newExpanded));

			if (newExpanded) {
				items.removeAttribute('hidden');
			} else {
				items.setAttribute('hidden', '');
			}
		},

		// ------------------------------------------------------------------
		// PANEL COLLAPSE
		// ------------------------------------------------------------------

		/**
		 * Bind the collapse/expand toggle button.
		 */
		_bindCollapseToggle: function () {
			if (!this._collapseBtn) {
				return;
			}

			this._collapseBtn.addEventListener('click', function () {
				this._toggleCollapse();
			}.bind(this));
		},

		/**
		 * Toggle the left panel between expanded and collapsed (icon-only) modes.
		 */
		_toggleCollapse: function () {
			var isCollapsed = this._panel.getAttribute('data-collapsed') === 'true';
			var newState    = !isCollapsed;

			this._panel.setAttribute('data-collapsed', String(newState));
			this._collapseBtn.setAttribute('aria-expanded', String(!newState));
			this._collapseBtn.setAttribute(
				'aria-label',
				newState ? 'Expand navigation panel' : 'Collapse navigation panel'
			);
		},

		// ------------------------------------------------------------------
		// NAV LEAF ITEMS — Dynamic population
		// ------------------------------------------------------------------

		/**
		 * Load nav leaf items from the project config stored in ATFRFO.state.
		 *
		 * Phase 2: For Colors, uses config.categories (Phase 2) if present,
		 * otherwise falls back to config.groups.Variables.Colors (v1).
		 *
		 * Called on init and whenever the project config changes.
		 */
		_loadNavItems: function () {
			var config = ATFRFO.state.config;

			if (!config) {
				this._loadDefaultItems();
				return;
			}

			// Phase 2: Colors use config.categories when available.
			if (config.categories && config.categories.length > 0) {
				var sortedCats = config.categories.slice()
					.filter(function (c) { return !c.parent_id; })
					.sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
				this._populateList('atfrfo-nav-colors', sortedCats);
			} else if (config.groups && config.groups.Variables) {
				var colorItems = (config.groups.Variables.Colors || []).slice();
			if (colorItems.indexOf('Uncategorized') === -1) { colorItems.push('Uncategorized'); }
			this._populateList('atfrfo-nav-colors', colorItems);
			} else {
				this._populateList('atfrfo-nav-colors', ['Branding', 'Background', 'Neutral', 'Semantic', 'Uncategorized']);
			}

			// Phase 2: Fonts use config.fontCategories when available.
		var vars = (config.groups && config.groups.Variables) ? config.groups.Variables : {};
		if (config.fontCategories && config.fontCategories.length > 0) {
			var sortedFontCats = config.fontCategories.slice()
				.filter(function (c) { return !c.parent_id; })
				.sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
			this._populateList('atfrfo-nav-fonts', sortedFontCats);
		} else {
			var globalVarsF = (ATFRFO.state.globalConfig && ATFRFO.state.globalConfig.groups && ATFRFO.state.globalConfig.groups.Variables) ? ATFRFO.state.globalConfig.groups.Variables : {};
			this._populateList('atfrfo-nav-fonts', (vars.Fonts && vars.Fonts.length > 0) ? vars.Fonts : (globalVarsF.Fonts || []));
		}

		// Phase 2: Numbers use config.numberCategories when available.
		if (config.numberCategories && config.numberCategories.length > 0) {
			var sortedNumCats = config.numberCategories.slice()
				.filter(function (c) { return !c.parent_id; })
				.sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
			this._populateList('atfrfo-nav-numbers', sortedNumCats);
		} else {
			var globalVarsN = (ATFRFO.state.globalConfig && ATFRFO.state.globalConfig.groups && ATFRFO.state.globalConfig.groups.Variables) ? ATFRFO.state.globalConfig.groups.Variables : {};
			var numList = (vars.Numbers && vars.Numbers.length > 0) ? vars.Numbers : ((globalVarsN.Numbers && globalVarsN.Numbers.length > 0) ? globalVarsN.Numbers : ['Spacing', 'Gaps', 'Grids', 'Radius']);
			this._populateList('atfrfo-nav-numbers', numList);
		}

		this._updateSubgroupCounts();
		this._populateClassesList();
		},

		/**
		 * Guarantee a locked 'Uncategorized' entry exists in
		 * config.classCategories — mirrors _ensureUncategorized() in
		 * atfrfo-variables.js/atfrfo-colors.js for Colors/Fonts/Numbers.
		 * Unlike those three, Classes has no other pre-seeded default
		 * categories (no Classes equivalent of Colors' Branding/Background or
		 * Numbers' Spacing/Gaps/Grids/Radius) — Uncategorized is the only
		 * guaranteed category until the user creates more (Phase 3.3).
		 * Called at the top of _populateClassesList() so it fires on every
		 * render (file load, sync, refresh) without needing to hook into
		 * every load path separately.
		 */
		_ensureClassesUncategorized: function () {
			if (!ATFRFO.state.config) { ATFRFO.state.config = {}; }
			if (!Array.isArray(ATFRFO.state.config.classCategories)) {
				ATFRFO.state.config.classCategories = [];
			}
			var cats     = ATFRFO.state.config.classCategories;
			var hasUncat = false;
			for (var i = 0; i < cats.length; i++) {
				if (cats[i].name === 'Uncategorized') { hasUncat = true; break; }
			}
			if (!hasUncat) {
				var maxOrder = 0;
				for (var j = 0; j < cats.length; j++) {
					if ((cats[j].order || 0) > maxOrder) { maxOrder = cats[j].order; }
				}
				cats.push({
					id:     'default-uncategorized-classCategories',
					name:   'Uncategorized',
					order:  maxOrder + 1,
					locked: true,
				});
			}
		},

		/**
		 * Populate the Classes nav list from config.classCategories, counting
		 * ATFRFO.state.classes per category. Separate from _populateList()
		 * because Classes' counting rule differs from Variables' (no
		 * 'deleted' status to exclude — see atfrfo-classes.js status
		 * vocabulary note) and Classes has no sub-category nesting to
		 * account for. Locked categories (Uncategorized) always render last,
		 * matching docs/AFF-VISION-AND-ROADMAP.md §5.1.
		 */
		_populateClassesList: function () {
			var list = document.getElementById('atfrfo-nav-classes-items');
			if (!list) { return; }

			this._ensureClassesUncategorized();

			var config  = (ATFRFO.state && ATFRFO.state.config) ? ATFRFO.state.config : {};
			var classes = (ATFRFO.state && ATFRFO.state.classes) ? ATFRFO.state.classes : [];
			var cats    = (config.classCategories || []).slice().sort(function (a, b) {
				if (!!a.locked !== !!b.locked) { return a.locked ? 1 : -1; }
				return (a.order || 0) - (b.order || 0);
			});

			list.innerHTML = '';

			cats.forEach(function (cat) {
				var li  = document.createElement('li');
				var btn = document.createElement('button');

				btn.className = 'atfrfo-nav-item';
				btn.setAttribute('type', 'button');
				btn.setAttribute('data-category', cat.name);
				btn.setAttribute('data-category-id', cat.id);

				var nameSpan = document.createElement('span');
				nameSpan.className   = 'atfrfo-nav-item__name';
				nameSpan.textContent = cat.name;
				btn.appendChild(nameSpan);

				var count = ATFRFO.Utils.getClassesForCategory(cat.id, cat.name).length;
				if (count > 0) {
					var badge = document.createElement('span');
					badge.className   = 'atfrfo-nav-count';
					badge.textContent = count;
					btn.appendChild(badge);
				}

				btn.addEventListener('click', function () {
					this.selectItem(btn, 'atfrfo-nav-classes-items', cat.name, cat.id, 'Classes');
				}.bind(this));

				li.appendChild(btn);
				list.appendChild(li);
			}.bind(this));
		},

		/**
		 * Load the hard-coded default subgroup items (used before config loads).
		 */
		_loadDefaultItems: function () {
			this._populateList('atfrfo-nav-colors',  ['Branding', 'Background', 'Neutral', 'Semantic', 'Uncategorized']);
			this._populateList('atfrfo-nav-fonts',   []);
			this._populateList('atfrfo-nav-numbers', ['Spacing', 'Gaps', 'Grids', 'Radius']);
		},

		/**
		 * Populate a <ul> with clickable nav item buttons.
		 *
		 * Items can be plain strings or Phase 2 category objects {id, name, order, locked}.
		 * When objects are supplied, the category ID is passed to selectItem() so
		 * the Colors view can jump to the correct category block.
		 *
		 * @param {string}          listId  ID of the <ul> element.
		 * @param {string[]|Array}  items   Array of names or category objects.
		 */
		_populateList: function (listId, items) {
			var list = document.getElementById(listId);
			if (!list) {
				return;
			}

			// Determine subgroup for per-category counts.
			var sgMap = { 'atfrfo-nav-colors': 'Colors', 'atfrfo-nav-fonts': 'Fonts', 'atfrfo-nav-numbers': 'Numbers' };
			var subgroup = sgMap[listId] || '';
			var vars     = (ATFRFO.state && ATFRFO.state.variables) ? ATFRFO.state.variables : [];
			var config   = (ATFRFO.state && ATFRFO.state.config)    ? ATFRFO.state.config    : {};

			list.innerHTML = '';

			// Build a lookup of all valid (non-Uncategorized) category IDs — including
			// child categories — so orphaned-ref detection in the Uncategorized block
			// does not mis-file variables that legitimately belong to a child category.
			var knownCatIds = {};
			items.forEach(function (it) {
				var itName = (typeof it === 'string') ? it : (it.name || '');
				var itId   = (typeof it === 'string') ? null : (it.id || null);
				if (itId && itName !== 'Uncategorized') { knownCatIds[itId] = true; }
			});
			if (config.categories) {
				config.categories.forEach(function (c) {
					if (c.id && c.parent_id) { knownCatIds[c.id] = true; }
				});
			}

			// Build child-category-IDs-by-parent so each nav item's count rolls up
			// variables in child categories into the parent category total.
			var childCatIdsByParent = {};
			if (config.categories) {
				config.categories.forEach(function (c) {
					if (c.parent_id) {
						if (!childCatIdsByParent[c.parent_id]) {
							childCatIdsByParent[c.parent_id] = [];
						}
						childCatIdsByParent[c.parent_id].push(c.id);
					}
				});
			}

			items.forEach(function (item) {
				var name  = (typeof item === 'string') ? item : (item.name || '');
				var catId = (typeof item === 'string') ? null  : (item.id  || null);

				var li  = document.createElement('li');
				var btn = document.createElement('button');

				btn.className = 'atfrfo-nav-item';
				btn.setAttribute('type', 'button');
				btn.setAttribute('data-category', name);
				if (catId) {
					btn.setAttribute('data-category-id', catId);
				}

				// Category name text.
				var nameSpan = document.createElement('span');
				nameSpan.className   = 'atfrfo-nav-item__name';
				nameSpan.textContent = name;
				btn.appendChild(nameSpan);

				// Count variables directly in this category plus any child categories.
				var childIds = (catId && childCatIdsByParent[catId]) ? childCatIdsByParent[catId] : [];
				var count = vars.filter(function (v) {
					if (v.subgroup !== subgroup || v.status === 'deleted') { return false; }
					if (catId && v.category_id === catId) { return true; }
					if (catId && childIds.indexOf(v.category_id) !== -1) { return true; }
					if (v.category === name) { return true; }
					// Uncategorized catch-all: empty refs and truly orphaned refs.
					if (name === 'Uncategorized') {
						if (!v.category_id && !v.category) { return true; }
						if (v.category_id && !knownCatIds[v.category_id]) { return true; }
					}
					return false;
				}).length;
				if (count > 0) {
					var badge = document.createElement('span');
					badge.className   = 'atfrfo-nav-count';
					badge.textContent = count;
					btn.appendChild(badge);
				}

				btn.addEventListener('click', function () {
					this.selectItem(btn, listId, name, catId);
				}.bind(this));

				btn.addEventListener('contextmenu', function (e) {
					e.preventDefault();
					this.selectItem(btn, listId, name, catId);
				}.bind(this));

				li.appendChild(btn);
				list.appendChild(li);
			}.bind(this));
		},

		/**
		 * Update the variable count shown at the right of each subgroup header button
		 * (Colors / Fonts / Numbers), aligned with the per-category count badges.
		 */
		_updateSubgroupCounts: function () {
			var vars = (ATFRFO.state && ATFRFO.state.variables) ? ATFRFO.state.variables : [];
			var subgroups = [
				{ key: 'Colors',  selector: '[data-subgroup="colors"] .atfrfo-nav-subgroup__header' },
				{ key: 'Fonts',   selector: '[data-subgroup="fonts"] .atfrfo-nav-subgroup__header' },
				{ key: 'Numbers', selector: '[data-subgroup="numbers"] .atfrfo-nav-subgroup__header' },
			];
			subgroups.forEach(function (sg) {
				var btn = document.querySelector(sg.selector);
				if (!btn) { return; }
				var existing = btn.querySelector('.atfrfo-nav-count');
				if (existing) { existing.remove(); }
				var count = vars.filter(function (v) { return v.subgroup === sg.key && v.status !== 'deleted'; }).length;
				if (count > 0) {
					var badge = document.createElement('span');
					badge.className   = 'atfrfo-nav-count';
					badge.textContent = count;
					btn.appendChild(badge);
				}
			});
		},

		/**
		 * Mark an item as active and trigger the edit space to load its content.
		 *
		 * @param {HTMLElement}  btn         The clicked nav item button.
		 * @param {string}       listId      The parent list ID (determines subgroup context).
		 * @param {string}       category    The category name.
		 * @param {string|null}  categoryId  Phase 2 category UUID (null for v1 string items).
		 * @param {string}       [group]     Top-level group name. Defaults to 'Variables'
		 *                                   for backward compatibility with existing callers.
		 */
		selectItem: function (btn, listId, category, categoryId, group) {
			// Remove active class from all items
			var allItems = this._panel.querySelectorAll('.atfrfo-nav-item');
			for (var i = 0; i < allItems.length; i++) {
				allItems[i].classList.remove('is-active');
				allItems[i].removeAttribute('aria-current');
			}

			// Mark this item active
			btn.classList.add('is-active');
			btn.setAttribute('aria-current', 'page');

			// Determine subgroup from listId
			var subgroupMap = {
				'atfrfo-nav-colors':        'Colors',
				'atfrfo-nav-fonts':         'Fonts',
				'atfrfo-nav-numbers':       'Numbers',
				'atfrfo-nav-classes-items': 'Classes',
			};
			var subgroup = subgroupMap[listId] || listId;

			// Update global selection state
			ATFRFO.state.currentSelection = {
				group:      group || 'Variables',
				subgroup:   subgroup,
				category:   category,
				categoryId: categoryId || null,
			};

			// Notify edit space
			if (ATFRFO.EditSpace) {
				ATFRFO.EditSpace.loadCategory(ATFRFO.state.currentSelection);
			}
		},

		/**
		 * Clear the active nav selection and trigger the back-to-placeholder flow.
		 *
		 * Called when the user closes the Colors view via the back/close button.
		 */
		clearSelection: function () {
			var allItems = this._panel.querySelectorAll('.atfrfo-nav-item');
			for (var i = 0; i < allItems.length; i++) {
				allItems[i].classList.remove('is-active');
				allItems[i].removeAttribute('aria-current');
			}
			ATFRFO.state.currentSelection = null;
		},

		/**
		 * Refresh nav items from updated config (called after Manage Project save
		 * or after category CRUD operations update config.categories).
		 */
		refresh: function () {
			this._loadNavItems();
			this._updateSubgroupCounts();
		},
	};
}());
