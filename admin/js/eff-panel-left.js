/**
 * EFF Panel Left — Navigation Tree, Accordion, Collapse, and Category Loading
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
 * @package ElementorFrameworkForge
 */

(function () {
	'use strict';

	window.EFF = window.EFF || {};

	EFF.PanelLeft = {

		/** @type {HTMLElement|null} */
		_panel: null,
		/** @type {HTMLElement|null} */
		_collapseBtn: null,

		/**
		 * Initialize the left panel.
		 */
		init: function () {
			this._panel      = document.getElementById('eff-panel-left');
			this._collapseBtn = document.getElementById('eff-btn-collapse-left');

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
			var headers = this._panel.querySelectorAll('.eff-nav-group__header');

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
			} else {
				children.setAttribute('hidden', '');
			}
		},

		/**
		 * Bind click handlers to all subgroup headers.
		 */
		_bindSubgroupHeaders: function () {
			var headers = this._panel.querySelectorAll('.eff-nav-subgroup__header');

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
		 * Load nav leaf items from the project config stored in EFF.state.
		 *
		 * Phase 2: For Colors, uses config.categories (Phase 2) if present,
		 * otherwise falls back to config.groups.Variables.Colors (v1).
		 *
		 * Called on init and whenever the project config changes.
		 */
		_loadNavItems: function () {
			var config = EFF.state.config;

			if (!config) {
				this._loadDefaultItems();
				return;
			}

			// Phase 2: Colors use config.categories when available.
			if (config.categories && config.categories.length > 0) {
				var sortedCats = config.categories.slice().sort(function (a, b) {
					return (a.order || 0) - (b.order || 0);
				});
				this._populateList('eff-nav-colors', sortedCats);
			} else if (config.groups && config.groups.Variables) {
				var colorItems = (config.groups.Variables.Colors || []).slice();
			if (colorItems.indexOf('Uncategorized') === -1) { colorItems.push('Uncategorized'); }
			this._populateList('eff-nav-colors', colorItems);
			} else {
				this._populateList('eff-nav-colors', ['Branding', 'Background', 'Neutral', 'Semantic', 'Uncategorized']);
			}

			var vars = (config.groups && config.groups.Variables) ? config.groups.Variables : {};
			this._populateList('eff-nav-fonts',   vars.Fonts   || []);
			this._populateList('eff-nav-numbers', vars.Numbers || []);
		},

		/**
		 * Load the hard-coded default subgroup items (used before config loads).
		 */
		_loadDefaultItems: function () {
			this._populateList('eff-nav-colors',  ['Branding', 'Background', 'Neutral', 'Semantic', 'Uncategorized']);
			this._populateList('eff-nav-fonts',   []);
			this._populateList('eff-nav-numbers', ['Spacing', 'Gaps', 'Grids', 'Radius']);
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

			list.innerHTML = '';

			items.forEach(function (item) {
				var name  = (typeof item === 'string') ? item : (item.name || '');
				var catId = (typeof item === 'string') ? null  : (item.id  || null);

				var li  = document.createElement('li');
				var btn = document.createElement('button');

				btn.className   = 'eff-nav-item';
				btn.textContent = name;
				btn.setAttribute('type', 'button');
				btn.setAttribute('data-category', name);
				if (catId) {
					btn.setAttribute('data-category-id', catId);
				}

				btn.addEventListener('click', function () {
					this.selectItem(btn, listId, name, catId);
				}.bind(this));

				li.appendChild(btn);
				list.appendChild(li);
			}.bind(this));
		},

		/**
		 * Mark an item as active and trigger the edit space to load its content.
		 *
		 * @param {HTMLElement}  btn         The clicked nav item button.
		 * @param {string}       listId      The parent list ID (determines subgroup context).
		 * @param {string}       category    The category name.
		 * @param {string|null}  categoryId  Phase 2 category UUID (null for v1 string items).
		 */
		selectItem: function (btn, listId, category, categoryId) {
			// Remove active class from all items
			var allItems = this._panel.querySelectorAll('.eff-nav-item');
			for (var i = 0; i < allItems.length; i++) {
				allItems[i].classList.remove('is-active');
				allItems[i].removeAttribute('aria-current');
			}

			// Mark this item active
			btn.classList.add('is-active');
			btn.setAttribute('aria-current', 'page');

			// Determine subgroup from listId
			var subgroupMap = {
				'eff-nav-colors':  'Colors',
				'eff-nav-fonts':   'Fonts',
				'eff-nav-numbers': 'Numbers',
			};
			var subgroup = subgroupMap[listId] || listId;

			// Update global selection state
			EFF.state.currentSelection = {
				group:      'Variables',
				subgroup:   subgroup,
				category:   category,
				categoryId: categoryId || null,
			};

			// Notify edit space
			if (EFF.EditSpace) {
				EFF.EditSpace.loadCategory(EFF.state.currentSelection);
			}
		},

		/**
		 * Clear the active nav selection and trigger the back-to-placeholder flow.
		 *
		 * Called when the user closes the Colors view via the back/close button.
		 */
		clearSelection: function () {
			var allItems = this._panel.querySelectorAll('.eff-nav-item');
			for (var i = 0; i < allItems.length; i++) {
				allItems[i].classList.remove('is-active');
				allItems[i].removeAttribute('aria-current');
			}
			EFF.state.currentSelection = null;
		},

		/**
		 * Refresh nav items from updated config (called after Manage Project save
		 * or after category CRUD operations update config.categories).
		 */
		refresh: function () {
			this._loadNavItems();
		},
	};
}());
