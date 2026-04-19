/**
 * AFF Colors — Phase 2 Colors Edit Space
 *
 * Intercepts AFF.EditSpace.loadCategory() for the Colors subgroup and
 * renders a full editing workspace: category blocks with color variable rows,
 * inline expand panels (color picker + tint/shade generator), category
 * management (add/rename/delete/reorder/duplicate), and undo/redo.
 *
 * Phases implemented in this file:
 *   Phase 2b: Category blocks, color variable rows (read-only display)
 *   Phase 2c: Inline editing, category CRUD, undo/redo
 *   Phase 2d: Expand panel (color picker + generator + preview)
 *   Phase 2e: Status dots (rendered; sync decision tree in aff-app.js)
 *
 *
 * @package ElementorFrameworkForge
 */

(function () {
  "use strict";

  window.AFF = window.AFF || {};

  // -----------------------------------------------------------------------
  // UNDO / REDO STACK
  // -----------------------------------------------------------------------

  var _undoStack = []; // max 50 entries
  var _redoStack = [];
  var UNDO_LIMIT = 50;

  /**
   * Push an operation to the undo stack.
   *
   * @param {{ type: string, data: Object }} op Operation descriptor.
   */
  function pushUndo(op) {
    _undoStack.push(op);
    if (_undoStack.length > UNDO_LIMIT) {
      _undoStack.shift();
    }
    _redoStack = []; // Any new action clears the redo stack.
  }

  // -----------------------------------------------------------------------
  // COLLAPSE STATE — persists across re-renders
  // -----------------------------------------------------------------------

  /**
   * Tracks user-toggled collapse state per category ID.
   * { catId: boolean }  true = collapsed
   */
  // _collapsedIds is now an instance property (this._collapsedIds) set in init().

  var _drag = {
    active: false,
    varId: null,
    ghost: null,
    indicator: null,
    startY: 0,
    scrollTimer: null,
  };

  /**
   * The category ID to scroll to and expand after rendering, or null.
   * Set by loadColors() from selection.categoryId (nav item click).
   */
  var _focusedCategoryId = null;

  /**
   * Per-category sort state. { catId: { field: 'name'|'value', dir: 'none'|'asc'|'desc' } }
   * Client-side display sort only — does not persist to server.
   */
  var _catSortState = {};

  // -----------------------------------------------------------------------
  // MULTI-SELECT STATE — persists across re-renders within the same view session
  // -----------------------------------------------------------------------

  var _selectedKeys = {}; // { rowKey: true } — current selection set
  var _lastSelectKey = null; // shift+click anchor for range selection

  // -----------------------------------------------------------------------
  // MODULE
  // -----------------------------------------------------------------------

  AFF.Colors = {
    /**
     * The currently open expand panel's variable ID, or null.
     * @type {string|null}
     */
    _openExpandId: null,
    /** @type {object|null} */
    _pickrInstance: null,

    /**
     * Initialize: intercept AFF.EditSpace.loadCategory for Colors subgroup.
     */
    init: function () {
      // Inject selection styles once — avoids touching the CSS file.
      if (!document.getElementById("aff-multiselect-styles")) {
        var styleEl = document.createElement("style");
        styleEl.id = "aff-multiselect-styles";
        styleEl.textContent = [
          '.aff-color-row[data-selected="true"]{',
          "  outline:2px solid var(--aff-clr-accent,#c9a84c);",
          "  outline-offset:-2px;",
          "  background:rgba(201,168,76,.10);",
          "}",
          ".aff-selection-bar{",
          "  display:flex;align-items:center;gap:8px;",
          "  padding:6px 10px;margin-bottom:6px;",
          "  background:var(--aff-clr-accent,#c9a84c);",
          "  border-radius:4px;font-size:12px;",
          "  color:var(--aff-clr-on-accent,#1a1a1a);",
          "}",
          ".aff-sel-bar-count{font-weight:600;margin-right:4px;flex:1;}",
        ].join("");
        document.head.appendChild(styleEl);
      }

      var _original = AFF.EditSpace.loadCategory.bind(AFF.EditSpace);

      AFF.EditSpace.loadCategory = function (selection) {
        if (selection && selection.subgroup === "Colors") {
          AFF.Colors.loadColors(selection);
        } else {
          _original(selection);
        }
      };

      // Config required by AFF.CatMixin.
      this._cfg = { catKey: "categories", setName: "Colors" };
      this._collapsedIds = {};

      // Undo/redo keyboard handler.
      document.addEventListener("keydown", function (e) {
        if (!e.ctrlKey && !e.metaKey) {
          return;
        }
        if (e.key === "z" || e.key === "Z") {
          e.preventDefault();
          AFF.Colors.undo();
        } else if (e.key === "y" || e.key === "Y") {
          e.preventDefault();
          AFF.Colors.redo();
        }
      });
    },

    /**
     * Entry point called by the overridden AFF.EditSpace.loadCategory.
     *
     * @param {{ group: string, subgroup: string, category: string, categoryId: string|null }} selection
     */
    loadColors: function (selection) {
      var placeholder = document.getElementById("aff-placeholder");
      var content = document.getElementById("aff-edit-content");
      var workspace = document.getElementById("aff-workspace");

      if (!content) {
        return;
      }

      // Store the focused category from the nav click.
      if (selection && selection.categoryId) {
        _focusedCategoryId = selection.categoryId;
      } else if (selection && selection.category) {
        var _cats =
          (AFF.state.config && AFF.state.config.categories) ||
          this._getDefaultCategories();
        _focusedCategoryId = null;
        for (var _ci = 0; _ci < _cats.length; _ci++) {
          if (_cats[_ci].name === selection.category) {
            _focusedCategoryId = _cats[_ci].id;
            break;
          }
        }
      } else {
        _focusedCategoryId = null;
      }
      // When navigating via left panel, set collapse state so that only the
      // focused category is expanded and all others are collapsed. We store
      // this explicitly in _collapsedIds so that subsequent re-renders
      // (e.g. after add/rename category) preserve the visual state and do not
      // expand everything because _focusedCategoryId was cleared by _rerenderView.
      if (_focusedCategoryId) {
        var _newCollapsed = {};
        var _allCats = (AFF.state.config && AFF.state.config.categories) || [];
        _allCats.forEach(function (c) {
          _newCollapsed[c.id] = c.id !== _focusedCategoryId;
        });
        this._collapsedIds = _newCollapsed;
      }

      if (workspace) {
        workspace.setAttribute("data-active", "true");
      }

      // Use inline style (highest specificity) to ensure placeholder is hidden
      // regardless of any CSS display rules on .aff-placeholder.
      if (placeholder) {
        placeholder.style.display = "none";
      }

      content.removeAttribute("hidden");
      content.style.display = "";

      this._ensureUncategorized();
      this._renderAll(selection, content);
    },

    // -----------------------------------------------------------------------
    // RENDER
    // -----------------------------------------------------------------------

    /**
     * Build and inject the full Colors view HTML into the content element.
     *
     * @param {{ group: string, subgroup: string, category: string }} selection
     * @param {HTMLElement} container
     */
    _renderAll: function (selection, container) {
      var self = this;

      // Close any open expand modal before rebuilding the DOM.
      if (this._openExpandId) {
        this._closeExpandPanel(container);
      }

      var categories =
        AFF.state.config && AFF.state.config.categories
          ? AFF.state.config.categories.slice().sort(function (a, b) {
              return (a.order || 0) - (b.order || 0);
            })
          : self._getDefaultCategories();

      var html = '<div class="aff-colors-view">';

      // Compute initial toggle state: show expand-all if all are collapsed.
      var _anyExpanded = false;
      for (var _ti = 0; _ti < categories.length; _ti++) {
        var _tc = categories[_ti];
        var _tv = self._getVarsForCategory(_tc);
        var _tcCollapsed;
        if (self._collapsedIds.hasOwnProperty(_tc.id)) {
          _tcCollapsed = self._collapsedIds[_tc.id];
        } else if (_focusedCategoryId) {
          _tcCollapsed = _tc.id !== _focusedCategoryId;
        } else {
          _tcCollapsed = _tv.length === 0;
        }
        if (!_tcCollapsed) {
          _anyExpanded = true;
          break;
        }
      }
      var _toggleState = _anyExpanded ? "expanded" : "collapsed";
      var _toggleSVG = _anyExpanded
        ? AFF.Icons.collapseAllSVG()
        : AFF.Icons.expandAllSVG();
      var _toggleTitle = _anyExpanded
        ? "Collapse all categories"
        : "Expand all categories";

      // ------- FILTER BAR -------
      // Top row: COLORS title | spacer | search | close | collapse-toggle
      // Add-category button: circle below filter bar (matches category add-var position)
      html +=
        '<div class="aff-colors-filter-bar">' +
        '<div class="aff-filter-bar-top">' +
        '<span class="aff-filter-bar-set-name">Colors</span>' +
        '<span style="flex:1"></span>' +
        '<input type="text" class="aff-colors-search" id="aff-colors-search"' +
        ' placeholder="Search\u2026" aria-label="Search color variables">' +
        '<button class="aff-icon-btn aff-colors-back-btn" id="aff-colors-back"' +
        ' title="Close colors view" aria-label="Close colors view"' +
        ' data-aff-tooltip="Close Colors view">' +
        AFF.Icons.closeSVG() +
        "</button>" +
        '<button class="aff-icon-btn" id="aff-colors-collapse-toggle"' +
        ' title="' +
        _toggleTitle +
        '" aria-label="' +
        _toggleTitle +
        '"' +
        ' data-aff-tooltip="' +
        _toggleTitle +
        '"' +
        ' data-toggle-state="' +
        _toggleState +
        '">' +
        _toggleSVG +
        "</button>" +
        "</div>" +
        '<div class="aff-filter-bar-add-cat-wrap">' +
        '<button class="aff-icon-btn aff-colors-add-cat-btn" id="aff-colors-add-category"' +
        ' data-aff-tooltip="Add category"' +
        ' aria-label="Add category">' +
        AFF.Icons.plusSVG() +
        "</button>" +
        "</div>" +
        "</div>"; // .aff-colors-filter-bar

      // ------- SELECTION BAR -------
      // Visible only when ≥1 variable is selected. Shown/hidden live by
      // _updateSelectionUI; also rebuilt here so re-renders preserve state.
      var _selCount = Object.keys(_selectedKeys).length;
      html +=
        '<div class="aff-selection-bar" id="aff-selection-bar"' +
        (_selCount === 0 ? ' style="display:none"' : "") +
        ">" +
        '<span class="aff-sel-bar-count">' +
        _selCount +
        " selected</span>" +
        '<button class="aff-btn aff-btn--xs" id="aff-sel-move-btn">Move to\u2026</button>' +
        '<button class="aff-btn aff-btn--xs aff-btn--danger" id="aff-sel-delete-btn">Delete selected</button>' +
        '<button class="aff-icon-btn aff-sel-clear-btn" id="aff-sel-clear-btn"' +
        ' title="Clear selection" aria-label="Clear selection">\u2715</button>' +
        "</div>";

      // ------- CATEGORY BLOCKS -------
      if (categories.length === 0) {
        html +=
          '<p class="aff-colors-empty">No categories found. Click "+ Category" to add one.</p>';
      } else {
        for (var i = 0; i < categories.length; i++) {
          html += self._buildCategoryBlock(categories[i], i, categories.length);
        }
      }

      html += "</div>"; // .aff-colors-view

      container.innerHTML = html;

      // Bind all interactive elements.
      self._bindEvents(container);

      // Re-apply any active column sorts. _catSortState is display-only and
      // survives re-renders, but the DOM is rebuilt from state (unsorted order)
      // each time, so we must reapply here.
      var _ssKeys = Object.keys(_catSortState);
      for (var _si = 0; _si < _ssKeys.length; _si++) {
        var _ss = _catSortState[_ssKeys[_si]];
        if (_ss && _ss.dir !== "none") {
          self._sortVarsInCategory(_ssKeys[_si], _ss.field, _ss.dir, container);
        }
      }

      // Jump to focused category if set (from nav click).
      if (_focusedCategoryId) {
        self._jumpToCategory(_focusedCategoryId, container);
      }
    },

    /**
     * Return built-in default categories if config has none yet.
     * @returns {Array}
     */
    _getDefaultCategories: function () {
      return [
        { id: "default-branding", name: "Branding", order: 0, locked: false },
        {
          id: "default-background",
          name: "Background",
          order: 1,
          locked: false,
        },
        { id: "default-neutral", name: "Neutral", order: 2, locked: false },
        { id: "default-semantic", name: "Semantic", order: 3, locked: false },
        {
          id: "default-uncategorized",
          name: "Uncategorized",
          order: 4,
          locked: true,
        },
      ];
    },

    /**
     * Build the HTML for one category block.
     *
     * Header layout (two rows):
     *   Top:    [Name (Inter 700) + count badge]     [actions: ⧉ ↑ ↓ ✕ ▾]
     *   Bottom: [⊕ add-variable button]
     *
     * @param {{ id: string, name: string, locked: boolean, order: number }} cat
     * @returns {string}
     */
    _buildCategoryBlock: function (cat, catIndex, catTotal) {
      var self = this;
      var vars = self._getVarsForCategory(cat);
      var count = vars.length;

      // Determine initial collapsed state for this render.
      var isCollapsed;
      if (self._collapsedIds.hasOwnProperty(cat.id)) {
        // User has manually toggled this category — respect their choice.
        isCollapsed = self._collapsedIds[cat.id];
      } else if (_focusedCategoryId) {
        // From nav click: focused category expanded, all others collapsed.
        isCollapsed = cat.id !== _focusedCategoryId;
      } else {
        // No focus set (re-render after CRUD): empty categories collapsed.
        isCollapsed = count === 0;
      }

      var html =
        '<div class="aff-category-block"' +
        ' data-category-id="' +
        AFF.Utils.escHtml(cat.id) +
        '"' +
        ' data-collapsed="' +
        (isCollapsed ? "true" : "false") +
        '"' +
        ">" +
        // Inner wrapper handles overflow clipping; outer block uses
        // overflow:visible so the add button can sit on the bottom edge.
        '<div class="aff-category-inner">';

      // --- Header: drag-handle + name span + count + sort buttons + actions ---
      html +=
        '<div class="aff-category-header">' +
        '<div class="aff-cat-header-top">' +
        '<div class="aff-cat-header-left">' +
        // Drag handle — six-dot grip for category drag-and-drop.
        '<span class="aff-cat-drag-handle" data-action="cat-drag-handle" aria-hidden="true"' +
        ' data-aff-tooltip="Drag to reorder">' +
        AFF.Icons.sixDotSVG() +
        "</span>" +
        // Category name as plain span — no surrounding box.
        // Double-click activates contenteditable.
        '<span class="aff-category-name-input"' +
        ' data-cat-id="' +
        AFF.Utils.escHtml(cat.id) +
        '"' +
        ' data-original="' +
        AFF.Utils.escHtml(cat.name) +
        '"' +
        ' aria-label="Category name"' +
        ' contenteditable="false"' +
        (cat.locked ? ' data-locked="true"' : "") +
        ">" +
        AFF.Utils.escHtml(cat.name) +
        "</span>" +
        // Variable count badge — sits right after the name text.
        '<span class="aff-category-count">' +
        count +
        "</span>" +
        "</div>" + // .aff-cat-header-left
        '<div class="aff-category-actions" role="toolbar" aria-label="Category actions">' +
        AFF.Icons.catBtn(
          "duplicate",
          "Duplicate category",
          AFF.Icons.duplicateSVG(),
          "",
        ) +
        (cat.locked
          ? ""
          : AFF.Icons.catBtn(
              "delete",
              "Delete category",
              AFF.Icons.trashSVG(),
              "aff-icon-btn--danger",
            )) +
        AFF.Icons.catBtn(
          "collapse",
          "Collapse/expand category",
          AFF.Icons.chevronSVG(),
          "aff-category-collapse-btn",
        ) +
        "</div>" + // .aff-category-actions
        "</div>" + // .aff-cat-header-top
        "</div>"; // .aff-category-header

      // Column sort header row — same grid as variable rows; sort buttons in name (col4) and value (col5).
      var _ns =
        _catSortState[cat.id] && _catSortState[cat.id].field === "name"
          ? _catSortState[cat.id].dir
          : "none";
      var _vs =
        _catSortState[cat.id] && _catSortState[cat.id].field === "value"
          ? _catSortState[cat.id].dir
          : "none";
      html +=
        '<div class="aff-color-list-header" data-cat-id="' +
        AFF.Utils.escHtml(cat.id) +
        '">' +
        "<span></span>" + // col1: drag
        "<span></span>" + // col2: status dot
        "<span></span>" + // col3: swatch
        '<span class="aff-col-sort-wrap">' +
        '<button class="aff-col-sort-btn" data-sort-col="name" data-cat-id="' +
        AFF.Utils.escHtml(cat.id) +
        '" data-sort-dir="' +
        _ns +
        '"' +
        ' title="Sort by name" aria-label="Sort by name"' +
        ' data-aff-tooltip="Sort by name">' +
        AFF.Icons.sortBtnSVG(_ns) +
        "</button>" +
        "</span>" +
        '<span class="aff-col-sort-wrap">' +
        '<button class="aff-col-sort-btn" data-sort-col="value" data-cat-id="' +
        AFF.Utils.escHtml(cat.id) +
        '" data-sort-dir="' +
        _vs +
        '"' +
        ' title="Sort by value" aria-label="Sort by value"' +
        ' data-aff-tooltip="Sort by value">' +
        AFF.Icons.sortBtnSVG(_vs) +
        "</button>" +
        "</span>" +
        "</div>"; // .aff-color-list-header

      // Variable rows.
      html += '<div class="aff-color-list">';
      if (count === 0) {
        html +=
          '<p class="aff-colors-empty">No variables in this category.</p>';
      } else {
        for (var i = 0; i < vars.length; i++) {
          html += self._buildVariableRow(vars[i]);
        }
      }
      html += "</div>"; // .aff-color-list

      html += "</div>"; // .aff-category-inner

      // Add-variable button: absolutely positioned circle on bottom-left edge of panel.
      html +=
        '<div class="aff-cat-add-btn-wrap">' +
        '<button class="aff-icon-btn aff-add-var-btn" data-action="add-var"' +
        ' data-cat-id="' +
        AFF.Utils.escHtml(cat.id) +
        '"' +
        ' aria-label="Add Color to ' +
        AFF.Utils.escHtml(cat.name) +
        '"' +
        ' title="Add Color"' +
        ' data-aff-tooltip="Add Color"' +
        ' data-aff-tooltip-long="Add a new color variable to this category">' +
        AFF.Icons.plusSVG() +
        "</button>" +
        "</div>";

      html += "</div>"; // .aff-category-block
      return html;
    },

    /**
     * Build the HTML for a single color variable row.
     *
     * @param {Object} v Variable object.
     * @returns {string}
     */
    _buildVariableRow: function (v) {
      var status = v.status || "synced";
      var statusColor = AFF.Utils.statusColor(status);
      var swatchBg = AFF.Utils.escHtml(v.value || "");
      var rowKey = AFF.Utils.rowKey(v);
      var isExpanded = this._openExpandId === rowKey;

      var html =
        '<div class="aff-color-row"' +
        (isExpanded ? ' data-expanded="true"' : "") +
        (_selectedKeys[rowKey] ? ' data-selected="true"' : "") +
        ' data-var-id="' +
        AFF.Utils.escHtml(rowKey) +
        '">' +
        // Drag handle (col 1: 24px).
        '<div class="aff-drag-handle" data-action="drag-handle" draggable="false"' +
        ' aria-label="Drag to reorder" data-aff-tooltip="Drag to reorder">' +
        AFF.Icons.sixDotSVG() +
        "</div>" +
        // Status dot (Phase 2e).
        '<span class="aff-status-dot"' +
        ' style="background:' +
        statusColor +
        '"' +
        ' data-aff-tooltip="' +
        AFF.Utils.escHtml(status.charAt(0).toUpperCase() + status.slice(1)) +
        '"' +
        ' data-aff-tooltip-long="' +
        AFF.Utils.escHtml(AFF.Utils.statusLongTooltip(status)) +
        '"' +
        ' aria-label="Status: ' +
        AFF.Utils.escHtml(status) +
        '">' +
        "</span>" +
        // Color swatch.
        '<span class="aff-color-swatch"' +
        ' style="background:' +
        swatchBg +
        '"' +
        ' data-action="open-picker"' +
        ' aria-label="Color swatch"' +
        ' data-aff-tooltip="Click to open color editor">' +
        "</span>" +
        // Variable name — single-click to edit.
        '<input type="text" class="aff-color-name-input"' +
        ' value="' +
        AFF.Utils.escHtml(v.name) +
        '"' +
        ' data-original="' +
        AFF.Utils.escHtml(v.name) +
        '"' +
        " readonly" +
        ' aria-label="Variable name"' +
        ' data-aff-tooltip="Variable name — click to edit"' +
        ' spellcheck="false">' +
        // Color value — directly editable.
        '<input type="text" class="aff-color-value-input"' +
        ' value="' +
        AFF.Utils.escHtml(v.value || "") +
        '"' +
        ' data-original="' +
        AFF.Utils.escHtml(v.value || "") +
        '"' +
        ' aria-label="Color value"' +
        ' data-aff-tooltip="Color value — edit directly"' +
        ' spellcheck="false">' +
        // Format selector.
        '<select class="aff-color-format-sel" aria-label="Color format"' +
        ' data-aff-tooltip="Color format">' +
        this._formatOptions(v.format || "HEX") +
        "</select>" +
        // Expand button (col 7: 28px).
        '<button class="aff-icon-btn aff-color-expand-btn"' +
        ' data-action="expand"' +
        ' aria-label="Open color editor"' +
        ' aria-expanded="false"' +
        ' data-aff-tooltip="Open color editor"' +
        ' data-aff-tooltip-long="Open the full color editor — tints, shades, transparency, and picker">' +
        AFF.Icons.chevronSVG() +
        "</button>" +
        // Delete button (col 8).
        '<button class="aff-icon-btn aff-color-delete-btn" data-action="delete-var" data-var-id="' +
        AFF.Utils.escHtml(rowKey) +
        '"' +
        ' title="Delete variable" aria-label="Delete variable"' +
        ' data-aff-tooltip="Delete variable"' +
        ' data-aff-tooltip-long="Remove this variable from the project">&#x1F5D1;</button>' +
        "</div>"; // .aff-color-row

      return html;
    },

    /**
     * Build the <select> options for the format field.
     *
     * @param {string} current Currently selected format value.
     * @returns {string} HTML option string.
     */
    _formatOptions: function (current) {
      // Normalise legacy alpha-suffix formats (HEXA→HEX, RGBA→RGB, HSLA→HSL).
      var base = current.replace(/A$/, "");
      var formats = ["HEX", "RGB", "HSL"];
      var html = "";
      for (var i = 0; i < formats.length; i++) {
        var sel = formats[i] === base ? " selected" : "";
        html +=
          '<option value="' +
          formats[i] +
          '"' +
          sel +
          ">" +
          formats[i] +
          "</option>";
      }
      return html;
    },

    /**
     * Build the inner HTML for the expand modal card.
     * Header mirrors the color row; body has three generator rows.
     *
     * @param {Object} v      Variable object.
     * @param {string} rowKey Unique row key.
     * @returns {string}
     */
    _buildModalContent: function (v, rowKey) {
      var self = this;
      var children = self._getChildVars(v.id);

      var tintChildren = children.filter(function (c) {
        return /-\d+$/.test(c.name) && c.name.indexOf("-plus-") === -1;
      });
      var shadeChildren = children.filter(function (c) {
        return c.name.indexOf("-plus-") !== -1 && /-plus-\d+$/.test(c.name);
      });
      var transChildren = children.filter(function (c) {
        return (
          /\d+$/.test(c.name) &&
          c.name.indexOf("-plus-") === -1 &&
          !/-\d+$/.test(c.name)
        );
      });

      var currentTints = tintChildren.length;
      var currentShades = shadeChildren.length;
      var transOn = transChildren.length > 0;

      var rgba = self._parseToRgba(v.value || "");
      var hsl = rgba ? self._rgbToHsl(rgba.r, rgba.g, rgba.b) : null;
      var swatchBg = AFF.Utils.escHtml(v.value || "");

      var statusColor = AFF.Utils.statusColor(v.status || "synced");

      var html =
        '<div class="aff-modal-header">' +
        // Empty drag-handle placeholder (col 1) — keeps grid alignment with .aff-color-row
        "<span></span>" +
        // Status dot (col 2) — matches color row col 2
        '<span class="aff-status-dot" style="background:' +
        statusColor +
        '"' +
        ' title="Status: ' +
        AFF.Utils.escHtml(v.status || "synced") +
        '"></span>' +
        // Swatch (col 3) — Pickr trigger button (all formats)
        '<button class="aff-color-swatch aff-pickr-btn" type="button" style="background:' +
        swatchBg +
        '"' +
        ' aria-label="Open color picker"' +
        ' data-aff-tooltip="Click to open color picker"></button>' +
        // Name input (col 3)
        '<input type="text" class="aff-color-name-input"' +
        ' value="' +
        AFF.Utils.escHtml(v.name) +
        '"' +
        ' data-original="' +
        AFF.Utils.escHtml(v.name) +
        '"' +
        ' data-var-id="' +
        AFF.Utils.escHtml(rowKey) +
        '"' +
        ' spellcheck="false" aria-label="Variable name"' +
        ' data-aff-tooltip="Variable name \u2014 click to edit">' +
        // Value input (col 4)
        '<input type="text" class="aff-color-value-input"' +
        ' value="' +
        AFF.Utils.escHtml(v.value || "") +
        '"' +
        ' data-original="' +
        AFF.Utils.escHtml(v.value || "") +
        '"' +
        ' data-var-id="' +
        AFF.Utils.escHtml(rowKey) +
        '"' +
        ' spellcheck="false" aria-label="Color value"' +
        ' data-aff-tooltip="Color value \u2014 edit directly">' +
        // Format select (col 5)
        '<select class="aff-color-format-sel"' +
        ' data-var-id="' +
        AFF.Utils.escHtml(rowKey) +
        '"' +
        ' aria-label="Color format"' +
        ' data-aff-tooltip="Color format">' +
        self._formatOptions(v.format || "HEX") +
        "</select>" +
        // Close button (col 6)
        '<button class="aff-modal-close-btn" aria-label="Close editor">\u00d7</button>' +
        "</div>";

      html += '<div class="aff-modal-body">';

      html +=
        '<div class="aff-modal-gen-row">' +
        '<span class="aff-modal-gen-label">Tints</span>' +
        '<div class="aff-modal-gen-ctrl">' +
        '<input type="number" class="aff-gen-num aff-gen-tints-num"' +
        ' min="0" max="10" value="' +
        currentTints +
        '"' +
        ' data-var-id="' +
        AFF.Utils.escHtml(rowKey) +
        '">' +
        "</div>" +
        '<div class="aff-palette-strip aff-tints-palette">' +
        self._buildTintsBars(hsl, currentTints) +
        "</div>" +
        "</div>";

      html +=
        '<div class="aff-modal-gen-row">' +
        '<span class="aff-modal-gen-label">Shades</span>' +
        '<div class="aff-modal-gen-ctrl">' +
        '<input type="number" class="aff-gen-num aff-gen-shades-num"' +
        ' min="0" max="10" value="' +
        currentShades +
        '"' +
        ' data-var-id="' +
        AFF.Utils.escHtml(rowKey) +
        '">' +
        "</div>" +
        '<div class="aff-palette-strip aff-shades-palette">' +
        self._buildShadesBars(hsl, currentShades) +
        "</div>" +
        "</div>";

      html +=
        '<div class="aff-modal-gen-row">' +
        '<span class="aff-modal-gen-label">Transparencies</span>' +
        '<div class="aff-modal-gen-ctrl">' +
        '<label class="aff-toggle-label">' +
        '<input type="checkbox" class="aff-gen-trans-toggle"' +
        ' data-var-id="' +
        AFF.Utils.escHtml(rowKey) +
        '"' +
        (transOn ? " checked" : "") +
        ">" +
        '<span class="aff-toggle-track"></span>' +
        "</label>" +
        "</div>" +
        '<div class="aff-palette-strip aff-trans-palette">' +
        (transOn ? self._buildTransBars(rgba) : "") +
        "</div>" +
        "</div>";

      // Move to Category row.
      var allCats =
        AFF.state.config && AFF.state.config.categories
          ? AFF.state.config.categories
          : [];
      var currentCatId = v.category_id || "";
      var catOptions = "";
      for (var ci = 0; ci < allCats.length; ci++) {
        var co = allCats[ci];
        catOptions +=
          '<option value="' +
          AFF.Utils.escHtml(co.id) +
          '"' +
          (co.id === currentCatId ? " selected" : "") +
          ">" +
          AFF.Utils.escHtml(co.name) +
          "</option>";
      }

      if (allCats.length > 1) {
        html +=
          '<div class="aff-modal-gen-row">' +
          '<span class="aff-modal-gen-label">Move to Category</span>' +
          '<div class="aff-modal-gen-ctrl" style="width:auto;flex:1">' +
          '<select class="aff-cat-move-select" data-var-id="' +
          AFF.Utils.escHtml(rowKey) +
          '">' +
          catOptions +
          "</select>" +
          "</div>" +
          "</div>";
      }

      html += "</div>"; // .aff-modal-body
      return html;
    },

    /**
     * Build a horizontal palette strip for tints (lighter toward white).
     *
     * @param {{h:number,s:number,l:number}|null} hsl   Base color in HSL.
     * @param {number}                             steps Number of steps (0–10).
     * @returns {string} HTML palette swatch elements.
     */
    _buildTintsBars: function (hsl, steps) {
      if (!hsl || steps <= 0) {
        return "";
      }
      var html = "";
      for (var i = 1; i <= steps; i++) {
        var l = hsl.l + (100 - hsl.l) * (i / steps);
        if (l > 98) {
          l = 98;
        }
        var color = "hsl(" + hsl.h + ", " + hsl.s + "%, " + l.toFixed(1) + "%)";
        html +=
          '<span class="aff-palette-swatch" style="background:' +
          color +
          '"></span>';
      }
      return html;
    },

    /**
     * Build a horizontal palette strip for shades (darker toward black).
     *
     * @param {{h:number,s:number,l:number}|null} hsl   Base color in HSL.
     * @param {number}                             steps Number of steps (0–10).
     * @returns {string} HTML palette swatch elements.
     */
    _buildShadesBars: function (hsl, steps) {
      if (!hsl || steps <= 0) {
        return "";
      }
      var html = "";
      for (var i = 1; i <= steps; i++) {
        var l = hsl.l - hsl.l * (i / steps);
        if (l < 2) {
          l = 2;
        }
        var color = "hsl(" + hsl.h + ", " + hsl.s + "%, " + l.toFixed(1) + "%)";
        html +=
          '<span class="aff-palette-swatch" style="background:' +
          color +
          '"></span>';
      }
      return html;
    },

    /**
     * Build a horizontal palette strip for transparencies (9 alpha steps: 10%–90%).
     *
     * @param {{r:number,g:number,b:number}|null} rgba Base color.
     * @returns {string} HTML palette swatch elements.
     */
    _buildTransBars: function (rgba) {
      if (!rgba) {
        return "";
      }
      var html = "";
      for (var i = 1; i <= 9; i++) {
        var alpha = i / 10;
        var color =
          "rgba(" + rgba.r + ", " + rgba.g + ", " + rgba.b + ", " + alpha + ")";
        html +=
          '<span class="aff-palette-swatch" style="background:' +
          color +
          '"></span>';
      }
      return html;
    },

    // -----------------------------------------------------------------------
    // EVENT BINDING
    // -----------------------------------------------------------------------

    /**
     * Bind all interactive events after rendering.
     *
     * Uses event delegation on the container for efficiency.
     *
     * @param {HTMLElement} container The #aff-edit-content element.
     */
    _bindEvents: function (container) {
      this._bindFilterBar(container);

      if (container._affEventsBound) {
        return;
      }
      container._affEventsBound = true;
      var self = this;
      self._initCatDrag(container);
      self._initDrag(container);
      self._bindCategoryAndRowActions(container);
      self._bindInlineEditing(container);

      // Escape clears the multi-select without re-rendering.
      document.addEventListener("keydown", function (e) {
        if (e.key === "Escape" && Object.keys(_selectedKeys).length > 0) {
          self._clearSelection(container);
        }
      });
    },

    _bindFilterBar: function (container) {
      var self = this;

      var searchInput = container.querySelector("#aff-colors-search");
      if (searchInput) {
        searchInput.addEventListener("input", function () {
          self._filterRows(container, this.value);
        });
      }

      var backBtn = container.querySelector("#aff-colors-back");
      if (backBtn) {
        backBtn.addEventListener("click", function () {
          self._closeColorsView();
        });
      }

      var toggleBtn = container.querySelector("#aff-colors-collapse-toggle");
      if (toggleBtn) {
        toggleBtn.addEventListener("click", function () {
          var state = toggleBtn.getAttribute("data-toggle-state");
          var collapse = state !== "collapsed";
          self._setAllCollapsed(container, collapse);
        });
      }

      var addCatBtn = container.querySelector("#aff-colors-add-category");
      if (addCatBtn) {
        addCatBtn.addEventListener("click", function () {
          self._addCategory();
        });
      }
    },

    _bindCategoryAndRowActions: function (container) {
      var self = this;

      container.addEventListener("click", function (e) {
        // Bail if the Colors view is not currently active in this container.
        if (!container.querySelector(".aff-colors-view")) {
          return;
        }

        // Selection bar actions.
        if (e.target.id === "aff-sel-move-btn") {
          self._moveSelectedToCategory(container);
          return;
        }
        if (e.target.id === "aff-sel-delete-btn") {
          self._deleteSelected(container);
          return;
        }
        if (e.target.id === "aff-sel-clear-btn") {
          self._clearSelection(container);
          return;
        }

        // Plain row click (no modifiers): update the Shift+click anchor so the
        // next Shift+click always has a valid range start point.
        if (!e.ctrlKey && !e.metaKey && !e.shiftKey) {
          var anchorRow = e.target.closest(".aff-color-row");
          if (anchorRow && !e.target.closest("[data-action]")) {
            var anchorKey = anchorRow.getAttribute("data-var-id");
            if (anchorKey) {
              _lastSelectKey = anchorKey;
            }
          }
        }

        // Multi-select: Ctrl/Meta+click toggles; Shift+click extends range.
        // Skip when the click lands on an action button (drag, expand, picker,
        // delete) so those controls remain functional with modifiers held.
        if (e.ctrlKey || e.metaKey || e.shiftKey) {
          var msRow = e.target.closest(".aff-color-row");
          var msAction = e.target.closest("[data-action]");
          if (msRow && !msAction) {
            var msKey = msRow.getAttribute("data-var-id");
            if (msKey) {
              e.preventDefault();
              self._handleRowSelect(
                msKey,
                e.shiftKey,
                e.ctrlKey || e.metaKey,
                container,
              );
              return;
            }
          }
        }

        // Route sort buttons first (more specific target).
        var sortBtn = e.target.closest(".aff-col-sort-btn");
        if (sortBtn) {
          var sCatId = sortBtn.getAttribute("data-cat-id");
          var sCol = sortBtn.getAttribute("data-sort-col");
          var sDir = sortBtn.getAttribute("data-sort-dir");
          var nextDir =
            sDir === "none" ? "asc" : sDir === "asc" ? "desc" : "none";
          _catSortState[sCatId] = { field: sCol, dir: nextDir };
          self._sortVarsInCategory(sCatId, sCol, nextDir, container);
          return;
        }

        var btn = e.target.closest("[data-action]");
        if (!btn) {
          return;
        }

        var action = btn.getAttribute("data-action");
        var block = btn.closest(".aff-category-block");
        var catId = block ? block.getAttribute("data-category-id") : null;

        switch (action) {
          case "duplicate":
            if (catId) {
              self._duplicateCategory(catId);
            }
            break;
          case "add-var":
            if (catId) {
              self._addVariable(catId);
            }
            break;
          case "delete":
            if (catId) {
              self._deleteCategory(catId);
            }
            break;

          case "delete-var": {
            var varId = btn.getAttribute("data-var-id");
            if (varId) {
              self._deleteVariable(varId);
            }
            break;
          }

          case "collapse":
            if (block) {
              var isCollapsed = block.getAttribute("data-collapsed") === "true";
              var newCollapsed = !isCollapsed;
              block.setAttribute("data-collapsed", String(newCollapsed));
              if (catId) {
                self._collapsedIds[catId] = newCollapsed;
              }
              // Close any open expand panel when the user collapses a category.
              if (newCollapsed) {
                self._closeExpandPanel(container, true);
              }
            }
            break;

          case "expand": {
            var row = btn.closest(".aff-color-row");
            var eVarId = row ? row.getAttribute("data-var-id") : null;
            if (eVarId !== null) {
              self._toggleExpandPanel(eVarId, row, container);
            }
            break;
          }

          case "open-picker": {
            var swatchRow = e.target.closest(".aff-color-row");
            var swVarId = swatchRow
              ? swatchRow.getAttribute("data-var-id")
              : null;
            if (swVarId !== null) {
              self._toggleExpandPanel(swVarId, swatchRow, container);
            }
            break;
          }
        }
      });
    },

    _bindInlineEditing: function (container) {
      var self = this;

      // Single-click to activate inline editing for name and category fields.
      container.addEventListener("mousedown", function (e) {
        var input = e.target.closest(
          ".aff-color-name-input, .aff-category-name-input",
        );
        if (!input) {
          return;
        }
        if (input.getAttribute("data-locked") === "true") {
          return;
        }

        var isCat = input.classList.contains("aff-category-name-input");
        var isEditing = isCat
          ? input.getAttribute("contenteditable") === "true"
          : !input.hasAttribute("readonly");
        if (isEditing) {
          return;
        }

        if (isCat) {
          input.setAttribute("contenteditable", "true");
          setTimeout(function () {
            input.focus();
            var range = document.createRange();
            range.selectNodeContents(input);
            var sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
          }, 0);
        } else {
          input.removeAttribute("readonly");
          setTimeout(function () {
            input.focus();
            input.select();
          }, 0);
        }
      });

      // Restore readonly/contenteditable on focusout and save pending changes.
      container.addEventListener("focusout", function (e) {
        if (!container.querySelector(".aff-colors-view")) {
          return;
        }
        var nameInput = e.target.closest(".aff-color-name-input");
        if (nameInput) {
          nameInput.setAttribute("readonly", "");
          return;
        }
        var catInput = e.target.closest(".aff-category-name-input");
        if (catInput && catInput.getAttribute("data-locked") !== "true") {
          self._saveCategoryName(catInput);
          catInput.setAttribute("contenteditable", "false");
        }
      });

      // Category name: Enter to confirm, Escape to revert.
      container.addEventListener("keydown", function (e) {
        var catInput = e.target.closest(".aff-category-name-input");
        if (!catInput) {
          return;
        }
        if (e.key === "Enter") {
          e.preventDefault();
          catInput.blur();
        } else if (e.key === "Escape") {
          var oldName = catInput.getAttribute("data-original") || "";
          catInput.textContent = oldName;
          catInput.setAttribute("contenteditable", "false");
          catInput.blur();
        }
      });

      // Name input: save on change.
      container.addEventListener("change", function (e) {
        var nameInput = e.target.closest(".aff-color-name-input");
        if (!nameInput) {
          return;
        }
        var row = nameInput.closest(".aff-color-row");
        var varId = row ? row.getAttribute("data-var-id") : null;
        if (varId !== null) {
          self._saveVarName(varId, nameInput);
        }
      });

      // Name and value inputs: Enter commits; Tab moves between fields.
      container.addEventListener("keydown", function (e) {
        // Enter on a readonly name input — activate it for editing.
        if (e.key === "Enter") {
          var nameInput = e.target.closest(".aff-color-name-input");
          if (nameInput && nameInput.hasAttribute("readonly")) {
            e.preventDefault();
            nameInput.removeAttribute("readonly");
            setTimeout(function () {
              nameInput.focus();
              nameInput.select();
            }, 0);
            return;
          }
        }

        // Enter on an active name/value input — commit (blur).
        if (e.key === "Enter") {
          var input = e.target.closest(
            ".aff-color-name-input, .aff-color-value-input",
          );
          if (input) {
            e.preventDefault();
            input.blur();
          }
          return;
        }

        // Tab navigation: move between name ↔ value within a row, and
        // value → next-row name (Tab) or name → prev-row value (Shift+Tab).
        if (e.key === "Tab") {
          var tabInput = e.target.closest(
            ".aff-color-name-input, .aff-color-value-input",
          );
          if (!tabInput) {
            return;
          }
          e.preventDefault();

          var row = tabInput.closest(".aff-color-row");
          var isName = tabInput.classList.contains("aff-color-name-input");
          var reverse = e.shiftKey;

          function activateNameInput(ni) {
            ni.removeAttribute("readonly");
            setTimeout(function () {
              ni.focus();
              ni.select();
            }, 0);
          }

          if (isName && !reverse) {
            // Name → Value (same row).
            var val = row ? row.querySelector(".aff-color-value-input") : null;
            if (val) {
              tabInput.blur();
              setTimeout(function () {
                val.focus();
                val.select();
              }, 0);
            }
          } else if (!isName && !reverse) {
            // Value → Name of next visible row.
            tabInput.blur();
            var allRows = Array.prototype.slice.call(
              container.querySelectorAll(".aff-color-row"),
            );
            var rowIdx = allRows.indexOf(row);
            var nextRow =
              rowIdx >= 0 && rowIdx + 1 < allRows.length
                ? allRows[rowIdx + 1]
                : allRows[0];
            var nextName = nextRow
              ? nextRow.querySelector(".aff-color-name-input")
              : null;
            if (nextName) {
              setTimeout(function () {
                activateNameInput(nextName);
              }, 0);
            }
          } else if (!isName && reverse) {
            // Shift+Tab on Value → Name (same row).
            var prevName = row
              ? row.querySelector(".aff-color-name-input")
              : null;
            if (prevName) {
              tabInput.blur();
              setTimeout(function () {
                activateNameInput(prevName);
              }, 0);
            }
          } else if (isName && reverse) {
            // Shift+Tab on Name → Value of previous visible row.
            tabInput.blur();
            var allRows2 = Array.prototype.slice.call(
              container.querySelectorAll(".aff-color-row"),
            );
            var rowIdx2 = allRows2.indexOf(row);
            var prevRow =
              rowIdx2 > 0
                ? allRows2[rowIdx2 - 1]
                : allRows2[allRows2.length - 1];
            var prevVal = prevRow
              ? prevRow.querySelector(".aff-color-value-input")
              : null;
            if (prevVal) {
              setTimeout(function () {
                prevVal.focus();
                prevVal.select();
              }, 0);
            }
          }
        }
      });

      // Value input: validate, normalize, and save on change.
      container.addEventListener("change", function (e) {
        var valueInput = e.target.closest(".aff-color-value-input");
        if (!valueInput) {
          return;
        }
        var row = valueInput.closest(".aff-color-row");
        var varId = row ? row.getAttribute("data-var-id") : null;
        if (varId === null) {
          return;
        }
        var vv = AFF.Utils.findVarByKey(varId);
        var fmt = vv ? vv.format || "HEX" : "HEX";
        var res = self._normalizeColorValue(valueInput.value, fmt);
        if (res.error) {
          AFF.Utils.showFieldError(valueInput, res.error);
          valueInput.value = valueInput.getAttribute("data-original") || "";
          return;
        }
        AFF.Utils.clearFieldError(valueInput);
        if (res.value !== valueInput.value) {
          valueInput.value = res.value;
        }
        if (AFF.App) {
          AFF.App.setDirty(true);
        }
        self._saveVarValue(varId, res.value, valueInput);
      });

      // Value input: select all on focus.
      container.addEventListener("focusin", function (e) {
        if (e.target.classList.contains("aff-color-value-input")) {
          e.target.select();
        }
      });

      // Format selector: save on change.
      container.addEventListener("change", function (e) {
        var formatSel = e.target.closest(".aff-color-format-sel");
        if (!formatSel) {
          return;
        }
        var row = formatSel.closest(".aff-color-row");
        var varId = row ? row.getAttribute("data-var-id") : null;
        if (varId !== null) {
          self._saveVarFormat(varId, formatSel.value);
        }
      });
    },

    // -----------------------------------------------------------------------
    // NAVIGATION HELPERS
    // -----------------------------------------------------------------------

    /**
     * Close the Colors view and return to the placeholder / main page.
     *
     * Clears nav active state, hides edit content, restores placeholder.
     */
    _closeColorsView: function () {
      // Clear nav selection.
      if (AFF.PanelLeft && AFF.PanelLeft.clearSelection) {
        AFF.PanelLeft.clearSelection();
      }

      // Delegate hide/show to edit space.
      if (AFF.EditSpace && AFF.EditSpace.reset) {
        AFF.EditSpace.reset();
      }

      AFF.state.currentSelection = null;
      _focusedCategoryId = null;
      this._openExpandId = null;
    },

    // -----------------------------------------------------------------------
    // EXPAND PANEL
    // -----------------------------------------------------------------------

    /**
     * Toggle the expand modal for a given variable row.
     *
     * @param {string}      varId     Variable ID.
     * @param {HTMLElement} row       The .aff-color-row element.
     * @param {HTMLElement} container The content container.
     */
    _toggleExpandPanel: function (varId, row, container) {
      var self = this;

      if (self._openExpandId === varId) {
        // Same row clicked again — animate closed.
        self._closeExpandPanel(container, false);
        return;
      }

      // Different row (or first open) — remove old modal instantly so there
      // is never two .aff-expand-modal elements in the DOM at once.
      self._closeExpandPanel(container, true);

      var v = AFF.Utils.findVarByKey(varId);
      if (!v) {
        return;
      }

      row.setAttribute("data-expanded", "true");
      var expandBtn = row.querySelector(".aff-color-expand-btn");
      if (expandBtn) {
        expandBtn.setAttribute("aria-expanded", "true");
      }

      var backdrop = document.createElement("div");
      backdrop.className = "aff-expand-backdrop";
      backdrop.setAttribute("data-expand-backdrop", varId);

      var modal = document.createElement("div");
      modal.className = "aff-expand-modal";
      modal.setAttribute("data-expand-modal", varId);
      modal.innerHTML = self._buildModalContent(v, varId);

      // Set transform-origin to the row's centre so the card appears to
      // grow out of (and shrink back into) the clicked row.
      var rowRect = row.getBoundingClientRect();
      var rowCenterX = rowRect.left + rowRect.width / 2;
      var rowCenterY = rowRect.top + rowRect.height / 2;
      var dx = Math.round(rowCenterX - window.innerWidth / 2);
      var dy = Math.round(rowCenterY - window.innerHeight / 2);
      modal.style.transformOrigin =
        "calc(50% + " + dx + "px) calc(50% + " + dy + "px)";

      var affApp = document.getElementById("aff-app") || document.body;
      affApp.appendChild(backdrop);
      affApp.appendChild(modal);

      // Trigger open animation on next tick.
      setTimeout(function () {
        modal.classList.add("is-open");
      }, 10);

      self._openExpandId = varId;
      self._bindModalEvents(modal, backdrop, v, varId, row, container);
    },

    /**
     * Close any open expand modal.
     *
     * @param {HTMLElement} container
     */
    _closeExpandPanel: function (container, immediate) {
      if (!this._openExpandId) {
        return;
      }

      var backdrop = document.querySelector(
        ".aff-expand-backdrop[data-expand-backdrop]",
      );
      if (backdrop && backdrop.parentNode) {
        backdrop.parentNode.removeChild(backdrop);
      }

      var modal = document.querySelector(
        ".aff-expand-modal[data-expand-modal]",
      );
      if (modal) {
        if (immediate) {
          // Switching to a new modal — remove the old one instantly so
          // there is never more than one .aff-expand-modal in the DOM.
          if (modal.parentNode) {
            modal.parentNode.removeChild(modal);
          }
        } else {
          modal.classList.remove("is-open");
          var _modal = modal;
          setTimeout(function () {
            if (_modal.parentNode) {
              _modal.parentNode.removeChild(_modal);
            }
          }, 420);
        }
      }

      if (container) {
        var row = container.querySelector(
          '.aff-color-row[data-var-id="' + this._openExpandId + '"]',
        );
        if (row) {
          row.removeAttribute("data-expanded");
          var expandBtn = row.querySelector(".aff-color-expand-btn");
          if (expandBtn) {
            expandBtn.setAttribute("aria-expanded", "false");
          }
        }
      }

      if (this._pickrInstance) {
        try {
          this._pickrInstance.destroyAndRemove();
        } catch (e) {}
        this._pickrInstance = null;
      }
      this._openExpandId = null;
    },

    /**
     * Bind all interactive events directly on the modal card.
     * (Modal is appended to #aff-app, so container delegation won't reach it.)
     *
     * @param {HTMLElement} modal     The .aff-expand-modal element.
     * @param {HTMLElement} backdrop  The .aff-expand-backdrop element.
     * @param {Object}      v         Variable object.
     * @param {string}      varId     Variable row key.
     * @param {HTMLElement} row       The .aff-color-row element.
     * @param {HTMLElement} container The content container.
     */
    _bindModalEvents: function (modal, backdrop, v, varId, row, container) {
      var self = this;

      // Backdrop click — close modal.
      backdrop.addEventListener("click", function () {
        self._closeExpandPanel(container, false);
      });

      // Close button.
      var closeBtn = modal.querySelector(".aff-modal-close-btn");
      if (closeBtn) {
        closeBtn.addEventListener("click", function () {
          self._closeExpandPanel(container, false);
        });
      }

      // Name input — save on blur / Enter.
      var nameInput = modal.querySelector(".aff-color-name-input");
      if (nameInput) {
        nameInput.addEventListener("change", function () {
          self._saveVarName(varId, nameInput);
        });
      }

      // Value input — save on blur / Enter; sync swatch in header live.
      var valueInput = modal.querySelector(".aff-color-value-input");
      if (valueInput) {
        valueInput.addEventListener("input", function () {
          // Live swatch update while typing.
          var swatch = modal.querySelector(".aff-color-swatch");
          if (swatch) {
            swatch.style.background = valueInput.value;
          }
          // Sync Pickr state to the typed value.
          if (self._pickrInstance) {
            try {
              self._pickrInstance.setColor(valueInput.value, true);
            } catch (e) {}
          }
        });
        valueInput.addEventListener("change", function () {
          var vv = AFF.Utils.findVarByKey(varId);
          var fmt = vv ? vv.format || "HEX" : "HEX";
          var res = self._normalizeColorValue(valueInput.value, fmt);
          if (res.error) {
            AFF.Utils.showFieldError(valueInput, res.error);
            valueInput.value = valueInput.getAttribute("data-original") || "";
            return;
          }
          AFF.Utils.clearFieldError(valueInput);
          if (res.value !== valueInput.value) {
            valueInput.value = res.value;
          }
          self._saveVarValue(varId, res.value, valueInput);
          var swatch = modal.querySelector(".aff-color-swatch");
          if (swatch) {
            swatch.style.background = res.value;
          }
          if (self._pickrInstance) {
            try {
              self._pickrInstance.setColor(res.value, true);
            } catch (e) {}
          }
          self._refreshModalPalettes(modal, varId);
        });
      }

      // Name and value inputs: blur on Enter.
      if (nameInput || valueInput) {
        modal.addEventListener("keydown", function (e) {
          if (e.key !== "Enter") {
            return;
          }
          var input = e.target.closest(
            ".aff-color-name-input, .aff-color-value-input",
          );
          if (input) {
            input.blur();
          }
        });
      }

      // Format selector — save on change and update modal header live.
      var formatSel = modal.querySelector(".aff-color-format-sel");
      if (formatSel) {
        formatSel.addEventListener("change", function () {
          self._saveVarFormat(varId, formatSel.value);
          // _saveVarFormat updates v.value in state; reflect in modal header.
          var vv = AFF.Utils.findVarByKey(varId);
          if (vv) {
            if (valueInput) {
              valueInput.value = vv.value;
              valueInput.setAttribute("data-original", vv.value);
            }
            var modalSwatch = modal.querySelector(".aff-color-swatch");
            if (modalSwatch) {
              modalSwatch.style.background = vv.value;
            }
          }
        });
      }

      // Pickr — visual color picker for all formats.
      // Wrapped in try-catch: non-standard values (oklch, var(), etc.) can
      // cause Pickr.create() to throw, which must not crash the modal.
      var pickrBtn = modal.querySelector(".aff-pickr-btn");
      if (pickrBtn && typeof Pickr !== "undefined") {
        try {
          // Normalise legacy alpha-suffix formats.
          var pickerFmt = (v.format || "HEX").replace(/A$/, "");
          var pickr = Pickr.create({
            el: pickrBtn,
            theme: "classic",
            useAsButton: true,
            default: v.value || "#000000",
            components: {
              preview: true,
              opacity: true,
              hue: true,
              interaction: {
                hex: pickerFmt === "HEX",
                rgba: pickerFmt === "RGB",
                hsla: pickerFmt === "HSL",
                input: true,
                save: true,
              },
            },
          });

          pickr.on("change", function (color) {
            var preview = self._pickrColorToString(color, pickerFmt);
            if (preview && pickrBtn) {
              pickrBtn.style.background = preview;
            }
          });

          pickr.on("save", function (color) {
            if (!color) {
              return;
            }
            var raw = self._pickrColorToString(color, pickerFmt);
            var res = self._normalizeColorValue(raw, pickerFmt);
            if (res.error) {
              return;
            }
            if (valueInput) {
              valueInput.value = res.value;
              valueInput.setAttribute("data-original", res.value);
            }
            if (pickrBtn) {
              pickrBtn.style.background = res.value;
            }
            self._saveVarValue(varId, res.value, valueInput);
            self._refreshModalPalettes(modal, varId);
            pickr.hide();
          });

          self._pickrInstance = pickr;
        } catch (e) {
          // Pickr could not parse the color value — picker unavailable
          // for this variable, but the rest of the modal works normally.
          console.warn(
            '[AFF] Pickr init failed for value "' + v.value + '":',
            e.message,
          );
        }
      }

      // Tints number — select all on focus; live preview on input.
      var tintsNum = modal.querySelector(".aff-gen-tints-num");
      if (tintsNum) {
        tintsNum.addEventListener("focus", function () {
          tintsNum.select();
        });
        tintsNum.addEventListener("input", function () {
          var steps = parseInt(tintsNum.value, 10) || 0;
          if (steps < 0) {
            steps = 0;
          }
          if (steps > 10) {
            steps = 10;
          }
          tintsNum.value = steps; // clamp displayed value
          var palette = modal.querySelector(".aff-tints-palette");
          var vv = AFF.Utils.findVarByKey(varId);
          var rgba2 = vv ? self._parseToRgba(vv.value || "") : null;
          var hsl2 = rgba2 ? self._rgbToHsl(rgba2.r, rgba2.g, rgba2.b) : null;
          if (palette) {
            palette.innerHTML = self._buildTintsBars(hsl2, steps);
          }
          if (vv) {
            self._debounceGenerate(varId, modal);
          }
        });
      }

      // Shades number — select all on focus; live preview on input.
      var shadesNum = modal.querySelector(".aff-gen-shades-num");
      if (shadesNum) {
        shadesNum.addEventListener("focus", function () {
          shadesNum.select();
        });
        shadesNum.addEventListener("input", function () {
          var steps = parseInt(shadesNum.value, 10) || 0;
          if (steps < 0) {
            steps = 0;
          }
          if (steps > 10) {
            steps = 10;
          }
          shadesNum.value = steps; // clamp displayed value
          var palette = modal.querySelector(".aff-shades-palette");
          var vv = AFF.Utils.findVarByKey(varId);
          var rgba2 = vv ? self._parseToRgba(vv.value || "") : null;
          var hsl2 = rgba2 ? self._rgbToHsl(rgba2.r, rgba2.g, rgba2.b) : null;
          if (palette) {
            palette.innerHTML = self._buildShadesBars(hsl2, steps);
          }
          if (vv) {
            self._debounceGenerate(varId, modal);
          }
        });
      }

      // Transparencies toggle — live preview.
      var transChk = modal.querySelector(".aff-gen-trans-toggle");
      if (transChk) {
        transChk.addEventListener("change", function () {
          var isOn = transChk.checked;
          var palette = modal.querySelector(".aff-trans-palette");
          var vv = AFF.Utils.findVarByKey(varId);
          var rgba2 = vv ? self._parseToRgba(vv.value || "") : null;
          if (palette) {
            palette.innerHTML = isOn ? self._buildTransBars(rgba2) : "";
          }
          if (vv) {
            self._debounceGenerate(varId, modal);
          }
        });
      }

      // Move to category select.
      var moveCatSel = modal.querySelector(".aff-cat-move-select");
      if (moveCatSel) {
        moveCatSel.addEventListener("change", function () {
          var newCatId = moveCatSel.value;
          if (newCatId) {
            self._closeExpandPanel(container, false);
            self._moveVarToCategory(varId, newCatId);
          }
        });
      }

      // ESC key — close expand modal.
      function escHandler(e) {
        if (e.key === "Escape") {
          document.removeEventListener("keydown", escHandler);
          self._closeExpandPanel(container, false);
        }
      }
      document.addEventListener("keydown", escHandler);

      // Focus trap — keep keyboard focus within the modal.
      var focusable = modal.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length) {
        var firstFocus = focusable[0];
        var lastFocus = focusable[focusable.length - 1];
        modal.addEventListener("keydown", function trapFocus(e) {
          if (e.key !== "Tab") {
            return;
          }
          if (e.shiftKey) {
            if (document.activeElement === firstFocus) {
              e.preventDefault();
              lastFocus.focus();
            }
          } else {
            if (document.activeElement === lastFocus) {
              e.preventDefault();
              firstFocus.focus();
            }
          }
        });
        // Focus first interactive element on open.
        requestAnimationFrame(function () {
          firstFocus.focus();
        });
      }
    },

    // -----------------------------------------------------------------------
    // VARIABLE SAVE HELPERS
    // -----------------------------------------------------------------------

    /**
     * Save a variable's name after editing.
     *
     * @param {string}      varId     Variable ID.
     * @param {HTMLElement} nameInput The name <input> element.
     */
    _saveVarName: function (varId, nameInput) {
      var self = this;
      var newName = nameInput.value.trim();
      var oldName = nameInput.getAttribute("data-original") || "";

      if (newName === oldName) {
        return;
      }

      if (!/^(--)?[A-Za-z_][A-Za-z0-9_-]*$/.test(newName)) {
        nameInput.value = oldName; // Revert.
        AFF.Utils.showFieldError(
          nameInput,
          "Use letters, numbers, hyphens, or underscores. May start with --.",
        );
        return;
      }

      var duplicate = AFF.state.variables.some(function (v) {
        return (
          v.name.toLowerCase() === newName.toLowerCase() &&
          String(v.id) !== String(varId)
        );
      });
      if (duplicate) {
        nameInput.value = oldName;
        AFF.Utils.showFieldError(
          nameInput,
          "A variable with that name already exists.",
        );
        return;
      }

      var v = AFF.Utils.findVarByKey(varId);
      if (!v) {
        return;
      }

      // Update status in state and dot in the main-list row immediately.
      v.status = "modified";
      var content = document.getElementById("aff-edit-content");
      if (content) {
        var listRow = content.querySelector(
          '.aff-color-row[data-var-id="' + AFF.Utils.escHtml(varId) + '"]',
        );
        var listDot = listRow ? listRow.querySelector(".aff-status-dot") : null;
        if (listDot) {
          listDot.style.background = AFF.Utils.statusColor("modified");
        }
      }

      pushUndo({
        type: "name-change",
        id: v.id,
        oldValue: oldName,
        newValue: newName,
      });

      var updateData = {
        id: v.id,
        name: newName,
        pending_rename_from: oldName,
        status: "modified",
      };

      self._ajaxSaveColor(updateData, function () {
        nameInput.setAttribute("data-original", newName);
        if (AFF.App) {
          AFF.App.setDirty(true);
        }
      });
    },

    /**
     * Save a variable's value after editing.
     *
     * @param {string}          varId    Variable ID.
     * @param {string}          newValue New CSS value string.
     * @param {HTMLElement|null} input   The input element to update data-original on.
     */
    _saveVarValue: function (varId, newValue, input) {
      var self = this;
      var v = AFF.Utils.findVarByKey(varId);
      if (!v) {
        return;
      }

      var oldValue = v.value || "";
      if (newValue === oldValue) {
        return;
      }

      // Update state immediately so subsequent lookups see the new value.
      v.value = newValue;
      v.status = "modified";

      // Update the main-list row swatch, value, and status dot in place.
      var content = document.getElementById("aff-edit-content");
      if (content) {
        var listRow = content.querySelector(
          '.aff-color-row[data-var-id="' + AFF.Utils.escHtml(varId) + '"]',
        );
        if (listRow) {
          var listSwatch = listRow.querySelector(".aff-color-swatch");
          if (listSwatch) {
            listSwatch.style.background = newValue;
          }
          var listVal = listRow.querySelector(".aff-color-value-input");
          if (listVal) {
            listVal.value = newValue;
          }
          var listDot = listRow.querySelector(".aff-status-dot");
          if (listDot) {
            listDot.style.background = AFF.Utils.statusColor("modified");
          }
        }
      }

      pushUndo({
        type: "value-change",
        id: v.id,
        oldValue: oldValue,
        newValue: newValue,
      });

      var updateData = {
        id: v.id,
        value: newValue,
        status: "modified",
      };

      self._ajaxSaveColor(updateData, function () {
        if (input) {
          input.setAttribute("data-original", newValue);
        }
        if (AFF.App) {
          AFF.App.setDirty(true);
        }
      });
    },

    /**
     * Save a variable's format after selection change.
     * Converts the current value to the new format before saving.
     *
     * @param {string} varId     Row key.
     * @param {string} newFormat New format string.
     */
    _saveVarFormat: function (varId, newFormat) {
      var self = this;
      var v = AFF.Utils.findVarByKey(varId);
      if (!v) {
        return;
      }

      var converted = self._convertColor(v.value || "", newFormat);

      // Update state immediately (client-side, no file required).
      v.format = newFormat;
      if (converted !== null) {
        v.value = converted;
      }
      v.status = "modified";

      // Update DOM immediately.
      var content = document.getElementById("aff-edit-content");
      if (content) {
        var row = content.querySelector(
          '.aff-color-row[data-var-id="' + AFF.Utils.escHtml(varId) + '"]',
        );
        if (row) {
          if (converted !== null) {
            var valInput = row.querySelector(".aff-color-value-input");
            if (valInput) {
              valInput.value = converted;
              valInput.setAttribute("data-original", converted);
            }
            var swatch = row.querySelector(".aff-color-swatch");
            if (swatch) {
              swatch.style.background = converted;
            }
          }
          var dot = row.querySelector(".aff-status-dot");
          if (dot) {
            dot.style.background = AFF.Utils.statusColor("modified");
          }
        }
      }

      if (AFF.App) {
        AFF.App.setDirty(true);
      }

      // Persist via AJAX if a file is loaded (include name for PHP fallback lookup).
      var updateData = { id: v.id, name: v.name, format: newFormat };
      if (converted !== null) {
        updateData.value = converted;
      }

      self._ajaxSaveColor(updateData, function () {
        /* AFF.App.setPendingCommit removed */
      });
    },

    /**
     * Send save_color AJAX and update AFF.state.variables on success.
     *
     * @param {Object}   variableData Partial variable object with at least { id }.
     * @param {Function} onSuccess    Called on success.
     */
    _ajaxSaveColor: function (variableData, onSuccess) {
      var self = this;

      if (!AFF.state.currentFile) {
        return;
      }

      AFF.App.ajax("aff_save_color", {
        filename: AFF.state.currentFile,
        variable: JSON.stringify(variableData),
      })
        .then(function (res) {
          if (res.success) {
            if (res.data && res.data.data && res.data.data.variables) {
              AFF.state.variables = res.data.data.variables;
            }
            if (onSuccess) {
              onSuccess(res.data);
            }
          }
        })
        .catch(function () {
          console.warn("[AFF] AJAX error: load file");
        });
    },

    // -----------------------------------------------------------------------
    // ADD / DELETE VARIABLE
    // -----------------------------------------------------------------------

    /**
     * Add a new blank variable to a category.
     *
     * @param {string} catId Category ID.
     */
    _ensureFileExists: function (callback) {
      if (AFF.state.currentFile) {
        callback();
        return;
      }
      var self = this;
      var initData = {
        version: "1.0",
        config: AFF.state.config || {},
        variables: AFF.state.variables || [],
      };
      AFF.App.ajax("aff_save_file", {
        project_name: "aff-temp",
        data: JSON.stringify(initData),
      })
        .then(function (res) {
          if (res && res.success) {
            AFF.state.currentFile = res.data.filename;
            if (AFF.PanelRight && AFF.PanelRight._filenameInput) {
              AFF.PanelRight._filenameInput.value = "aff-temp";
            }
            callback();
          } else {
            AFF.Modal.open({
              title: "Error",
              body: "<p>Could not initialize project file. Please try again.</p>",
            });
          }
        })
        .catch(function () {
          AFF.Modal.open({
            title: "Connection error",
            body: "<p>Could not create project file. Please try again.</p>",
          });
        });
    },

    _addVariable: function (catId) {
      var self = this;

      if (!AFF.state.currentFile) {
        self._ensureFileExists(function () {
          self._addVariable(catId);
        });
        return;
      }

      var cats = (AFF.state.config && AFF.state.config.categories) || [];
      var cat = null;
      for (var i = 0; i < cats.length; i++) {
        if (cats[i].id === catId) {
          cat = cats[i];
          break;
        }
      }
      var catName = cat ? cat.name : "";

      var _baseName = "new-color";
      var _newName = _baseName;
      var _nameIdx = 1;
      var _existing = (AFF.state.variables || []).map(function (v) {
        return (v.name || "").toLowerCase();
      });
      while (_existing.indexOf(_newName.toLowerCase()) !== -1) {
        _newName = _baseName + "-" + _nameIdx;
        _nameIdx++;
      }

      var newVar = {
        name: _newName,
        value: "#000000",
        type: "color",
        subgroup: "Colors",
        category: catName,
        category_id: catId,
        format: "HEX",
        status: "new",
      };

      AFF.App.ajax("aff_save_color", {
        filename: AFF.state.currentFile,
        variable: JSON.stringify(newVar),
      })
        .then(function (res) {
          if (res.success && res.data && res.data.data) {
            AFF.state.variables =
              res.data.data.variables || AFF.state.variables;
            if (AFF.App) {
              AFF.App.setDirty(true);
              AFF.App.refreshCounts();
            }
            self._collapsedIds[catId] = false;
            self._rerenderView();
          } else if (!res.success) {
            var msg =
              res.data && res.data.message
                ? res.data.message
                : "Could not add variable.";
            AFF.Modal.open({
              title: "Add variable failed",
              body: "<p>" + msg + "</p>",
            });
          }
        })
        .catch(function () {
          AFF.Modal.open({
            title: "Connection error",
            body: "<p>Could not add color variable. Please try again.</p>",
          });
        });
    },

    // -----------------------------------------------------------------------
    // CATEGORY ACTIONS
    // -----------------------------------------------------------------------

    /**
     * Return categories sorted by order, ensuring AFF.state.config.categories is initialised.
     *
     * @returns {Array} Sorted category objects.
     */
    _getSortedCategories: function () {
      var hasCats =
        AFF.state.config &&
        AFF.state.config.categories &&
        AFF.state.config.categories.length > 0;
      var cats = hasCats
        ? AFF.state.config.categories.slice().sort(function (a, b) {
            return (a.order || 0) - (b.order || 0);
          })
        : this._getDefaultCategories();
      if (!hasCats) {
        if (!AFF.state.config) {
          AFF.state.config = {};
        }
        AFF.state.config.categories = cats.map(function (c, i) {
          return { id: c.id, name: c.name, order: i, locked: !!c.locked };
        });
      }
      return cats;
    },

    /**
     * Ensure the Uncategorized category always exists in config.
     * Adds it if missing and persists if a file is currently loaded.
     */
    _ensureUncategorized: function () {
      if (!AFF.state.config) {
        AFF.state.config = {};
      }
      if (!Array.isArray(AFF.state.config.categories)) {
        AFF.state.config.categories = [];
      }
      var cats = AFF.state.config.categories;
      var _needsSave = false;

      // --- v1 → Phase 2 migration ---
      // If no Phase 2 category objects exist yet, seed from the v1 string list
      // stored in config.groups.Variables.Colors. This happens the first time a
      // file created before Phase 2 is opened in the Colors view.
      if (cats.length === 0) {
        var v1names =
          (AFF.state.config.groups &&
            AFF.state.config.groups.Variables &&
            AFF.state.config.groups.Variables.Colors) ||
          [];
        if (v1names.length > 0) {
          // v1 — Phase 2 migration: seed from old string list.
          v1names.forEach(function (name, idx) {
            var safeName = String(name)
              .toLowerCase()
              .replace(/\s+/g, "-")
              .replace(/[^a-z0-9-]/g, "");
            cats.push({
              id: "default-" + safeName,
              name: String(name),
              order: idx,
              locked: name === "Uncategorized",
            });
          });
        } else {
          // Brand new project — seed all 5 default categories so the
          // edit view is fully populated and the file is written with
          // the complete list before any category-add requests arrive.
          var defaults = this._getDefaultCategories();
          for (var _di = 0; _di < defaults.length; _di++) {
            cats.push(defaults[_di]);
          }
        }
        // Categories were seeded in memory but not yet on disk — must persist.
        _needsSave = true;
      }

      var hasUncat = cats.some(function (c) {
        return c.name === "Uncategorized";
      });
      if (!hasUncat) {
        var maxOrder = 0;
        cats.forEach(function (c) {
          if ((c.order || 0) > maxOrder) {
            maxOrder = c.order;
          }
        });
        cats.push({
          id: "default-uncategorized",
          name: "Uncategorized",
          order: maxOrder + 1,
          locked: true,
        });
        _needsSave = true;
      }

      // Refresh the left panel now that categories are in memory.
      // This covers the initial-load case where _ensureUncategorized seeds
      // categories that were not yet reflected in the left nav tree.
      if (_needsSave && AFF.PanelLeft && AFF.PanelLeft.refresh) {
        AFF.PanelLeft.refresh();
      }

      // Persist seeded/added categories to the file so that subsequent
      // aff_save_category calls load a file that already has the full list.
      // IMPORTANT: update AFF.state.currentFile from the response so all
      // following AJAX calls (add category, save color, etc.) use the new
      // backup file. Without this, those calls modify the OLD file and the
      // seeded categories end up split across two different backup files —
      // causing categories to vanish when the newer backup is loaded.
      if (_needsSave && AFF.state.currentFile) {
        var d = {
          version: "1.0",
          config: AFF.state.config,
          variables: AFF.state.variables || [],
          metadata: AFF.state.metadata || {},
          classes: AFF.state.classes || [],
          components: AFF.state.components || [],
        };
        AFF.App.ajax("aff_save_file", {
          project_name: AFF.state.projectName || "unnamed-project",
          data: JSON.stringify(d),
        })
          .then(function (res) {
            if (res.success && res.data && res.data.filename) {
              AFF.state.currentFile = res.data.filename;
            }
          })
          .catch(function () {
            console.warn("[AFF] AJAX error: save file");
          });
      }
    },

    /**
     * Sort all color variables alphabetically by name.
     * @param {boolean} ascending  true = A→Z, false = Z→A
     */
    _sortColors: function (ascending) {
      var self = this;
      var sorted = AFF.state.variables.slice().sort(function (a, b) {
        var na = (a.name || "").toLowerCase();
        var nb = (b.name || "").toLowerCase();
        return ascending
          ? na < nb
            ? -1
            : na > nb
              ? 1
              : 0
          : na > nb
            ? -1
            : na < nb
              ? 1
              : 0;
      });
      sorted.forEach(function (v, i) {
        v.order = i + 1;
      });
      var chain = Promise.resolve();
      sorted.forEach(function (v) {
        (function (variable) {
          chain = chain.then(function () {
            return AFF.App.ajax("aff_save_color", {
              filename: AFF.state.currentFile,
              variable: JSON.stringify(variable),
            }).then(function (r) {
              if (r.success && r.data && r.data.data) {
                AFF.state.variables = r.data.data.variables;
              }
            });
          });
        })(v);
      });
      chain
        .then(function () {
          AFF.App.setDirty(true);
          self._rerenderView();
        })
        .catch(function () {
          console.warn("[AFF] AJAX error: save variable");
        });
    },

    /**
     * Delete a color variable (and optionally its children).
     *
     * @param {string} varId  Variable ID to delete.
     */
    _deleteVariable: function (varId) {
      var self = this;
      var variable = AFF.Utils.findVarByKey(varId);
      if (!variable) {
        return;
      }
      // Use the resolved UUID for API calls; varId may be a stale __n_ key.
      varId = variable.id || varId;

      var children = AFF.state.variables.filter(function (v) {
        return v.parent_id === varId;
      });
      var hasChildren = children.length > 0;

      var body = hasChildren
        ? "<p>This variable has " +
          children.length +
          " child variable(s).</p>" +
          '<p><button id="aff-del-var-with-children" class="aff-btn aff-btn--danger">Delete variable and all children</button> ' +
          '<button id="aff-del-var-only" class="aff-btn">Delete variable only</button> ' +
          '<button id="aff-del-var-cancel" class="aff-btn">Cancel</button></p>'
        : "<p>Delete <strong>" +
          (variable.name || varId) +
          "</strong>? This cannot be undone.</p>" +
          '<p><button id="aff-del-var-confirm" class="aff-btn aff-btn--danger">Delete</button> ' +
          '<button id="aff-del-var-cancel" class="aff-btn">Cancel</button></p>';

      AFF.Modal.open({
        title: "Delete variable",
        body: body,
        onClose: function () {
          document.removeEventListener("click", handleDelClick);
        },
      });

      function doDelete(deleteChildren) {
        AFF.Modal.close();
        document.removeEventListener("click", handleDelClick);

        // Variables imported from Elementor (id:'') exist only in memory —
        // no server record to delete.  Remove them from state directly.
        if (!variable.id) {
          var toRemove = {};
          toRemove[varId] = true;
          if (deleteChildren) {
            children.forEach(function (c) {
              toRemove[AFF.Utils.rowKey(c)] = true;
            });
          }
          AFF.state.variables = AFF.state.variables.filter(function (v) {
            return !toRemove[AFF.Utils.rowKey(v)];
          });
          AFF.App.setDirty(true);
          AFF.App.refreshCounts();
          self._rerenderView();
          return;
        }

        AFF.App.ajax("aff_delete_color", {
          filename: AFF.state.currentFile,
          variable_id: varId,
          delete_children: deleteChildren ? "1" : "0",
        })
          .then(function (res) {
            if (
              res.success &&
              res.data &&
              res.data.data &&
              res.data.data.variables
            ) {
              AFF.state.variables = res.data.data.variables;
              AFF.App.setDirty(true);
              AFF.App.refreshCounts();
              self._rerenderView();
            } else if (!res.success) {
              var msg =
                res.data && res.data.message
                  ? res.data.message
                  : "Delete failed.";
              AFF.Modal.open({ title: "Error", body: "<p>" + msg + "</p>" });
            }
          })
          .catch(function () {
            AFF.Modal.open({
              title: "Connection error",
              body: "<p>Connection error during delete.</p>",
            });
          });
      }

      function handleDelClick(e) {
        var t = e.target;
        if (t.id === "aff-del-var-cancel") {
          AFF.Modal.close();
          document.removeEventListener("click", handleDelClick);
        } else if (t.id === "aff-del-var-with-children") {
          doDelete(true);
        } else if (
          t.id === "aff-del-var-only" ||
          t.id === "aff-del-var-confirm"
        ) {
          doDelete(false);
        }
      }
      document.addEventListener("click", handleDelClick);
    },

    // -----------------------------------------------------------------------
    // MOVE VARIABLE
    // -----------------------------------------------------------------------

    /**
     * Sort variables within a single category and re-render that category's list.
     * Client-side only — does not call the server or modify v.order.
     *
     * @param {string}      catId     Category ID.
     * @param {string}      field     'name' | 'value'.
     * @param {string}      dir       'none' | 'asc' | 'desc'.
     * @param {HTMLElement} container Edit content container.
     */
    _sortVarsInCategory: function (catId, field, dir, container) {
      var self = this;
      var cats =
        AFF.state.config && AFF.state.config.categories
          ? AFF.state.config.categories
          : self._getDefaultCategories();
      var cat = null;
      for (var i = 0; i < cats.length; i++) {
        if (cats[i].id === catId) {
          cat = cats[i];
          break;
        }
      }
      if (!cat) {
        return;
      }

      var vars = self._getVarsForCategory(cat).slice();
      if (dir !== "none") {
        vars.sort(function (a, b) {
          var fa = ((field === "value" ? a.value : a.name) || "").toLowerCase();
          var fb = ((field === "value" ? b.value : b.name) || "").toLowerCase();
          if (fa < fb) {
            return dir === "asc" ? -1 : 1;
          }
          if (fa > fb) {
            return dir === "asc" ? 1 : -1;
          }
          return 0;
        });
      }

      var block = container.querySelector(
        '.aff-category-block[data-category-id="' + catId + '"]',
      );
      if (!block) {
        return;
      }

      var list = block.querySelector(".aff-color-list");
      if (!list) {
        return;
      }

      var html = "";
      if (vars.length === 0) {
        html = '<p class="aff-colors-empty">No variables in this category.</p>';
      } else {
        for (var j = 0; j < vars.length; j++) {
          html += self._buildVariableRow(vars[j]);
        }
      }
      list.innerHTML = html;

      // Update sort button states in this block's column header row.
      var sortBtns = block.querySelectorAll(".aff-col-sort-btn");
      for (var k = 0; k < sortBtns.length; k++) {
        var btn = sortBtns[k];
        var btnCol = btn.getAttribute("data-sort-col");
        var btnDir = btnCol === field ? dir : "none";
        btn.setAttribute("data-sort-dir", btnDir);
        btn.innerHTML = AFF.Icons.sortBtnSVG(btnDir);
      }
    },

    /**
     * Initialize mouse-based drag-and-drop for category blocks.
     *
     * @param {HTMLElement} container
     */
    _initCatDrag: function (container) {
      var self = this;
      var d = {
        active: false,
        catId: null,
        ghost: null,
        indicator: null,
        startY: 0,
        _dropTargetId: null,
        _dropAbove: null,
      };

      container.addEventListener("mousedown", function (e) {
        if (!container.querySelector(".aff-colors-view")) {
          return;
        }
        var handle = e.target.closest(".aff-cat-drag-handle");
        if (!handle) {
          return;
        }
        e.preventDefault();

        var block = handle.closest(".aff-category-block");
        if (!block) {
          return;
        }

        d.catId = block.getAttribute("data-category-id");
        if (!d.catId) {
          return;
        }

        d.active = true;
        d.startY = e.clientY;

        var blockRect = block.getBoundingClientRect();
        var ghost = block.cloneNode(true);
        ghost.style.cssText =
          "position:fixed;pointer-events:none;z-index:9999;" +
          "width:" +
          block.offsetWidth +
          "px;" +
          "top:" +
          blockRect.top +
          "px;left:" +
          blockRect.left +
          "px;" +
          "opacity:0.88;box-shadow:0 8px 24px rgba(0,0,0,0.28);border-radius:12px;";
        ghost.className += " aff-drag-ghost";
        document.body.appendChild(ghost);
        d.ghost = ghost;

        var indicator = document.createElement("div");
        indicator.className = "aff-drop-indicator";
        indicator.style.display = "none";
        indicator.style.pointerEvents = "none";
        var _appEl = document.getElementById("aff-app");
        var _accent = _appEl
          ? getComputedStyle(_appEl).getPropertyValue("--aff-clr-accent").trim()
          : "";
        if (!_accent) {
          _accent = "#f4c542";
        }
        indicator.style.background =
          "linear-gradient(to right, transparent, " +
          _accent +
          " 15%, " +
          _accent +
          " 85%, transparent)";
        document.body.appendChild(indicator);
        d.indicator = indicator;

        block.style.opacity = "0.3";
      });

      document.addEventListener("mousemove", function (e) {
        if (!d.active || !d.ghost) {
          return;
        }
        var dy = e.clientY - d.startY;
        d.ghost.style.transform = "translateY(" + dy + "px)";

        d.ghost.style.display = "none";
        var elBelow = document.elementFromPoint(e.clientX, e.clientY);
        d.ghost.style.display = "";

        var targetBlock = elBelow
          ? elBelow.closest(".aff-category-block")
          : null;
        if (
          targetBlock &&
          targetBlock.getAttribute("data-category-id") !== d.catId
        ) {
          var tbRect = targetBlock.getBoundingClientRect();
          var above = e.clientY < tbRect.top + tbRect.height / 2;
          d.indicator.style.display = "";
          d.indicator.style.left = tbRect.left + "px";
          d.indicator.style.width = tbRect.width + "px";
          d.indicator.style.top =
            (above ? tbRect.top : tbRect.bottom) - 2 + "px";
          d.indicator.style.height = "4px";
          d._dropTargetId = targetBlock.getAttribute("data-category-id");
          d._dropAbove = above;
        } else {
          d.indicator.style.display = "none";
          d._dropTargetId = null;
        }
      });

      document.addEventListener("mouseup", function () {
        if (!d.active) {
          return;
        }
        d.active = false;

        if (d.ghost && d.ghost.parentNode) {
          d.ghost.parentNode.removeChild(d.ghost);
        }
        if (d.indicator && d.indicator.parentNode) {
          d.indicator.parentNode.removeChild(d.indicator);
        }
        d.ghost = null;
        d.indicator = null;

        var draggingBlock = container.querySelector(
          '.aff-category-block[data-category-id="' + d.catId + '"]',
        );
        if (draggingBlock) {
          draggingBlock.style.opacity = "";
        }

        if (d._dropTargetId && d.catId && d._dropTargetId !== d.catId) {
          self._onDropCat(d.catId, d._dropTargetId, d._dropAbove);
        }
        d._dropTargetId = null;
        d._dropAbove = null;
        d.catId = null;
      });
    },

    /**
     * Handle a completed category drop: reorder categories.
     */
    _onDropCat: function (srcId, targetId, above) {
      var self = this;
      var cats = (AFF.state.config.categories || []).slice();

      var srcIdx = -1,
        tgtIdx = -1;
      for (var i = 0; i < cats.length; i++) {
        if (cats[i].id === srcId) {
          srcIdx = i;
        }
        if (cats[i].id === targetId) {
          tgtIdx = i;
        }
      }
      if (srcIdx === -1 || tgtIdx === -1) {
        return;
      }

      var srcCat = cats.splice(srcIdx, 1)[0];
      tgtIdx = -1;
      for (var j = 0; j < cats.length; j++) {
        if (cats[j].id === targetId) {
          tgtIdx = j;
          break;
        }
      }
      cats.splice(above ? tgtIdx : tgtIdx + 1, 0, srcCat);
      cats.forEach(function (c, idx) {
        c.order = idx;
      });

      var ordered_ids = cats.map(function (c) {
        return c.id;
      });
      AFF.state.config.categories = cats;

      AFF.App.ajax("aff_reorder_categories", {
        subgroup: "Colors",
        ordered_ids: JSON.stringify(ordered_ids),
      })
        .then(function (res) {
          if (res.success && res.data && res.data.categories) {
            AFF.state.config.categories = res.data.categories;
          }
          if (AFF.App) {
            AFF.App.setDirty(true);
          }
          if (AFF.PanelLeft) {
            AFF.PanelLeft.refresh();
          }
          AFF.Colors._renderAll(
            AFF.state.currentSelection,
            document.getElementById("aff-edit-content"),
          );
        })
        .catch(function () {
          AFF.Colors._renderAll(
            AFF.state.currentSelection,
            document.getElementById("aff-edit-content"),
          );
        });
    },

    /**
     * Initialize mouse-based drag-and-drop for color variable rows.
     *
     * @param {HTMLElement} container The color list container.
     */
    _initDrag: function (container) {
      var self = this;

      // Delegate all drag infrastructure to the shared AFF.VarDrag module.
      // Colors supplies its own onDrop callback (_dropVariable) so category
      // lookup uses config.categories. The shared module handles ghost, indicator,
      // auto-expand of collapsed blocks, and the empty-category sentinel.
      if (AFF.VarDrag) {
        AFF.VarDrag.init(container, {
          viewSelector: ".aff-colors-view",
          onDrop: function (draggedId, targetId, insertBefore, targetCatBlock) {
            self._dropVariable(
              draggedId,
              targetId,
              insertBefore,
              targetCatBlock,
            );
          },
        });
        return;
      }

      // ---- Fallback: legacy inline implementation (kept for safety) ----
      container.addEventListener("mousedown", function (e) {
        // Bail if the Colors view is not currently active in this container.
        if (!container.querySelector(".aff-colors-view")) {
          return;
        }
        var handle = e.target.closest(".aff-drag-handle");
        if (!handle) {
          return;
        }
        e.preventDefault();

        var row = handle.closest(".aff-color-row");
        if (!row) {
          return;
        }

        _drag.varId = row.getAttribute("data-var-id");
        if (!_drag.varId) {
          return;
        }

        _drag.active = true;
        _drag.startY = e.clientY;

        // Create ghost — clone of the row, fixed position.
        var ghost = row.cloneNode(true);
        ghost.style.position = "fixed";
        ghost.style.width = row.offsetWidth + "px";
        ghost.style.height = row.offsetHeight + "px";
        ghost.style.top = row.getBoundingClientRect().top + "px";
        ghost.style.left = row.getBoundingClientRect().left + "px";
        ghost.style.opacity = "0.88";
        ghost.style.zIndex = "9999";
        ghost.style.pointerEvents = "none";
        ghost.style.boxShadow = "0 8px 24px rgba(0,0,0,0.28)";
        ghost.style.borderRadius = "4px";
        ghost.className += " aff-drag-ghost";
        document.body.appendChild(ghost);
        _drag.ghost = ghost;

        // Create drop indicator — 2px accent-color horizontal line.
        var indicator = document.createElement("div");
        indicator.className = "aff-drop-indicator";
        indicator.style.display = "none";
        indicator.style.pointerEvents = "none"; // Must not intercept elementFromPoint during mousemove
        // --aff-clr-accent is scoped to [data-aff-theme], not :root/body.
        // Read it from the .aff-app element so body-appended elements get the right color.
        var _appEl = document.getElementById("aff-app");
        var _accent = _appEl
          ? getComputedStyle(_appEl).getPropertyValue("--aff-clr-accent").trim()
          : "";
        if (!_accent) {
          _accent = "#f4c542";
        }
        indicator.style.background =
          "linear-gradient(to right, transparent, " +
          _accent +
          " 15%, " +
          _accent +
          " 85%, transparent)";
        indicator.style.boxShadow = "0 0 6px " + _accent;
        document.body.appendChild(indicator);
        _drag.indicator = indicator;

        // Mark original row as being dragged.
        row.classList.add("aff-row-dragging");
      });

      document.addEventListener("mousemove", function (e) {
        if (!_drag.active || !_drag.ghost) {
          return;
        }
        _drag._forceAfter = false;
        e.preventDefault();

        var dy = e.clientY - _drag.startY;
        _drag.ghost.style.top = parseFloat(_drag.ghost.style.top) + dy + "px";
        _drag.startY = e.clientY;

        // Auto-scroll the edit-space panel when near its top/bottom edge.
        var _editSpaceLeg = document.getElementById("aff-edit-space");
        if (_editSpaceLeg) {
          var _rectLeg = _editSpaceLeg.getBoundingClientRect();
          var _szLeg = 60;
          if (e.clientY < _rectLeg.top + _szLeg) {
            clearInterval(_drag.scrollTimer);
            _drag.scrollTimer = setInterval(function () {
              _editSpaceLeg.scrollTop -= 8;
            }, 20);
          } else if (e.clientY > _rectLeg.bottom - _szLeg) {
            clearInterval(_drag.scrollTimer);
            _drag.scrollTimer = setInterval(function () {
              _editSpaceLeg.scrollTop += 8;
            }, 20);
          } else {
            clearInterval(_drag.scrollTimer);
            _drag.scrollTimer = null;
          }
        }

        // Find the row we're hovering over.
        _drag.ghost.style.display = "none";
        var el = document.elementFromPoint(e.clientX, e.clientY);
        _drag.ghost.style.display = "";

        var targetRow = el ? el.closest(".aff-color-row") : null;

        // Auto-expand a collapsed category block when the drag ghost enters it,
        // so cross-category drops can show a row-level drop indicator.
        if (!targetRow && el) {
          var hoverBlock = el.closest(".aff-category-block");
          if (
            hoverBlock &&
            hoverBlock.getAttribute("data-collapsed") === "true"
          ) {
            hoverBlock.setAttribute("data-collapsed", "false");
            // Re-probe now that the rows are visible.
            _drag.ghost.style.display = "none";
            var el2 = document.elementFromPoint(e.clientX, e.clientY);
            _drag.ghost.style.display = "";
            var newRow = el2 ? el2.closest(".aff-color-row") : null;
            if (newRow) {
              targetRow = newRow;
            }
          }
        }

        // Fallback: cursor over expanded block but not on any row → append to end
        if (!targetRow && el) {
          var hoverBlock2 = el.closest(".aff-category-block");
          if (
            hoverBlock2 &&
            hoverBlock2.getAttribute("data-collapsed") === "false"
          ) {
            var blockRows = hoverBlock2.querySelectorAll(
              ".aff-color-row:not(.aff-row-dragging)",
            );
            if (blockRows.length > 0) {
              targetRow = blockRows[blockRows.length - 1];
              _drag._forceAfter = true;
            } else {
              // Empty expanded category — show indicator at the drop zone inside it
              var emptyBody = hoverBlock2.querySelector(".aff-color-list");
              if (emptyBody) {
                var emptyRect = emptyBody.getBoundingClientRect();
                _drag.indicator.style.display = "block";
                _drag.indicator.style.top =
                  emptyRect.top + emptyRect.height / 2 - 1 + "px";
                _drag.indicator.style.left = emptyRect.left + "px";
                _drag.indicator.style.width = emptyRect.width + "px";
                _drag.indicator._targetVarId = "__empty-cat__";
                _drag.indicator._insertBefore = true;
                _drag.indicator._targetCatBlock = hoverBlock2;
              }
            }
          }
        }

        if (
          targetRow &&
          targetRow.getAttribute("data-var-id") !== _drag.varId
        ) {
          var rect = targetRow.getBoundingClientRect();
          var midY = rect.top + rect.height / 2;
          var insertBefore = _drag._forceAfter ? false : e.clientY < midY;

          _drag.indicator.style.display = "block";
          _drag.indicator.style.top =
            (insertBefore ? rect.top : rect.bottom) - 1 + "px";
          _drag.indicator.style.left = rect.left + "px";
          _drag.indicator.style.width = rect.width + "px";
          _drag.indicator._targetVarId = targetRow.getAttribute("data-var-id");
          _drag.indicator._insertBefore = insertBefore;
          _drag.indicator._targetCatBlock = targetRow.closest(
            ".aff-category-block",
          );
        } else {
          if (!el || !el.closest(".aff-category-block")) {
            _drag.indicator.style.display = "none";
            _drag.indicator._targetVarId = null;
          }
        }
      });

      document.addEventListener("mouseup", function (e) {
        if (!_drag.active) {
          return;
        }

        clearInterval(_drag.scrollTimer);
        _drag.scrollTimer = null;

        var targetVarId = _drag.indicator ? _drag.indicator._targetVarId : null;
        var insertBefore = _drag.indicator
          ? _drag.indicator._insertBefore
          : true;
        var targetCatBlock = _drag.indicator
          ? _drag.indicator._targetCatBlock
          : null;

        // Clean up ghost and indicator.
        if (_drag.ghost) {
          _drag.ghost.parentNode &&
            _drag.ghost.parentNode.removeChild(_drag.ghost);
        }
        if (_drag.indicator) {
          _drag.indicator.parentNode &&
            _drag.indicator.parentNode.removeChild(_drag.indicator);
        }

        // Remove dragging style.
        var draggingRow = container.querySelector(
          ".aff-color-row.aff-row-dragging",
        );
        if (draggingRow) {
          draggingRow.classList.remove("aff-row-dragging");
        }

        _drag.ghost = null;
        _drag.indicator = null;
        _drag.active = false;

        if (!targetVarId || !_drag.varId) {
          _drag.varId = null;
          return;
        }

        var draggedVarId = _drag.varId;
        _drag.varId = null;

        self._dropVariable(
          draggedVarId,
          targetVarId,
          insertBefore,
          targetCatBlock,
        );
      });
    },

    /**
     * Commit a drag-and-drop reorder: update state, re-render, and persist.
     *
     * @param {string}           draggedId      Row key of the dragged variable.
     * @param {string}           targetId       Row key of the drop target.
     * @param {boolean}          insertBefore   Insert before (true) or after (false) target.
     * @param {HTMLElement|null} targetCatBlock .aff-category-block element at drop point.
     */
    _dropVariable: function (
      draggedId,
      targetId,
      insertBefore,
      targetCatBlock,
    ) {
      var self = this;

      if (!AFF.state.currentFile) {
        self._ensureFileExists(function () {
          self._dropVariable(draggedId, targetId, insertBefore, targetCatBlock);
        });
        return;
      }

      // Find the dragged and target variable objects.
      var dragged = null;
      var target = null;
      for (var i = 0; i < AFF.state.variables.length; i++) {
        if (AFF.Utils.rowKey(AFF.state.variables[i]) === draggedId) {
          dragged = AFF.state.variables[i];
        }
        if (AFF.Utils.rowKey(AFF.state.variables[i]) === targetId) {
          target = AFF.state.variables[i];
        }
      }
      // Special case: drop into an empty category (no target variable row exists).
      if (targetId === "__empty-cat__" && dragged && targetCatBlock) {
        var emptyCatId = targetCatBlock.getAttribute("data-category-id");
        var emptyCatName = dragged.category; // fallback
        var ecCats =
          (AFF.state.config && AFF.state.config.categories) ||
          self._getDefaultCategories();
        for (var ei = 0; ei < ecCats.length; ei++) {
          if (ecCats[ei].id === emptyCatId) {
            emptyCatName = ecCats[ei].name;
            break;
          }
        }
        for (var ek = 0; ek < AFF.state.variables.length; ek++) {
          if (AFF.Utils.rowKey(AFF.state.variables[ek]) === draggedId) {
            AFF.state.variables[ek].category = emptyCatName;
            AFF.state.variables[ek].category_id = emptyCatId;
            AFF.state.variables[ek].order = 0;
            break;
          }
        }
        self._rerenderView();
        if (AFF.App) {
          AFF.App.setDirty(true);
        }
        AFF.App.ajax("aff_save_color", {
          filename: AFF.state.currentFile,
          variable: JSON.stringify({
            id: dragged.id,
            order: 0,
            category: emptyCatName,
            category_id: emptyCatId,
          }),
        }).catch(function () {
          console.warn("[AFF] AJAX error: drop into empty category");
        });
        return;
      }

      if (!dragged || !target) {
        return;
      }

      // Determine target category from the targetCatBlock element.
      var newCatId = targetCatBlock
        ? targetCatBlock.getAttribute("data-category-id")
        : dragged.category_id;
      var newCatName = dragged.category;

      // Find category name from config.
      var cats =
        (AFF.state.config && AFF.state.config.categories) ||
        self._getDefaultCategories();
      for (var ci = 0; ci < cats.length; ci++) {
        if (cats[ci].id === newCatId) {
          newCatName = cats[ci].name;
          break;
        }
      }

      // Get the target category object.
      var targetCatObj = null;
      for (var cj = 0; cj < cats.length; cj++) {
        if (cats[cj].id === newCatId) {
          targetCatObj = cats[cj];
          break;
        }
      }
      if (!targetCatObj) {
        return;
      }

      var catVars = self._getVarsForCategory(targetCatObj);
      // Remove dragged from the list (handles cross-category and same-cat).
      catVars = catVars.filter(function (v) {
        return AFF.Utils.rowKey(v) !== draggedId;
      });

      // Find insertion index.
      var insertIdx = catVars.length;
      for (var vi = 0; vi < catVars.length; vi++) {
        if (AFF.Utils.rowKey(catVars[vi]) === targetId) {
          insertIdx = insertBefore ? vi : vi + 1;
          break;
        }
      }
      catVars.splice(insertIdx, 0, dragged);

      // Reassign order values.
      var saves = [];
      for (var si = 0; si < catVars.length; si++) {
        catVars[si].order = si;
        // Update in AFF.state.variables.
        for (var sj = 0; sj < AFF.state.variables.length; sj++) {
          if (AFF.state.variables[sj] === catVars[si]) {
            AFF.state.variables[sj].order = si;
            AFF.state.variables[sj].category = newCatName;
            AFF.state.variables[sj].category_id = newCatId;
            break;
          }
        }
        saves.push({
          id: catVars[si].id,
          order: si,
          category: newCatName,
          category_id: newCatId,
        });
      }

      // If dragged changed category, also update its category in state.
      if (dragged.category_id !== newCatId) {
        for (var dk = 0; dk < AFF.state.variables.length; dk++) {
          if (AFF.Utils.rowKey(AFF.state.variables[dk]) === draggedId) {
            AFF.state.variables[dk].category = newCatName;
            AFF.state.variables[dk].category_id = newCatId;
            break;
          }
        }
      }

      self._rerenderView();
      if (AFF.App) {
        AFF.App.setDirty(true);
      }

      // Persist each affected variable via AJAX (fire-and-forget).
      for (var pi = 0; pi < saves.length; pi++) {
        (function (saveItem) {
          AFF.App.ajax("aff_save_color", {
            filename: AFF.state.currentFile,
            variable: JSON.stringify(saveItem),
          }).catch(function () {
            console.warn("[AFF] AJAX error: persist drop reorder");
          });
        })(saves[pi]);
      }
    },

    /**
     * Move a variable to a different category.
     *
     * @param {string} varId    Row key.
     * @param {string} newCatId Target category ID.
     */
    _moveVarToCategory: function (varId, newCatId) {
      var self = this;
      var v = AFF.Utils.findVarByKey(varId);
      if (!v || !newCatId || newCatId === v.category_id) {
        return;
      }

      var cats = (AFF.state.config && AFF.state.config.categories) || [];
      var newCat = null;
      for (var i = 0; i < cats.length; i++) {
        if (cats[i].id === newCatId) {
          newCat = cats[i];
          break;
        }
      }
      if (!newCat) {
        return;
      }

      v.category_id = newCatId;
      v.category = newCat.name;
      v.status = "modified";

      // Move children (tints/shades/transparencies) together with the parent.
      var children = v.id ? self._getChildVars(v.id) : [];
      children.forEach(function (child) {
        child.category_id = newCatId;
        child.category = newCat.name;
        child.status = "modified";
      });

      self._rerenderView();

      if (!AFF.state.currentFile) {
        return;
      }
      if (AFF.App) {
        AFF.App.setDirty(true);
      }

      // Save parent.
      AFF.App.ajax("aff_save_color", {
        filename: AFF.state.currentFile,
        variable: JSON.stringify({
          id: v.id,
          category_id: newCatId,
          category: newCat.name,
          status: "modified",
        }),
      })
        .then(function (res) {
          if (res.success && res.data && res.data.data) {
            AFF.state.variables = res.data.data.variables;
            // Re-render so children appear in the new category (server state may differ).
            self._rerenderView();
          }
        })
        .catch(function () {
          console.warn("[AFF] AJAX error: refresh variables");
        });

      // Save each child's new category.
      children.forEach(function (child) {
        if (!child.id) {
          return;
        }
        AFF.App.ajax("aff_save_color", {
          filename: AFF.state.currentFile,
          variable: JSON.stringify({
            id: child.id,
            category_id: newCatId,
            category: newCat.name,
            status: "modified",
          }),
        }).catch(function () {});
      });
    },

    // -----------------------------------------------------------------------
    // TINT/SHADE/TRANSPARENCY GENERATOR
    // -----------------------------------------------------------------------

    /**
     * Debounce timer handle for generate calls.
     * @type {number|null}
     */
    _generateDebounceTimer: null,

    /**
     * Debounce a generate call so rapid number-input changes don't flood the server.
     *
     * @param {string}      varId Variable row key.
     * @param {HTMLElement} panel The .aff-expand-panel element.
     */
    _debounceGenerate: function (varId, panel) {
      var self = this;
      if (self._generateDebounceTimer) {
        clearTimeout(self._generateDebounceTimer);
      }
      self._generateDebounceTimer = setTimeout(function () {
        self._generateDebounceTimer = null;
        self._generateChildren(varId, panel);
      }, 600);
    },

    /**
     * Read tints/shades/transparencies inputs from the expand panel and call
     * eff_generate_children AJAX to persist child variables.
     *
     * @param {string}      varId Row key.
     * @param {HTMLElement} panel The .aff-expand-panel element.
     */
    _generateChildren: function (varId, panel) {
      var self = this;
      var v = AFF.Utils.findVarByKey(varId);

      if (!AFF.state.currentFile) {
        self._noFileModal();
        return;
      }

      // Variable must have a server-assigned UUID.
      // If not (e.g. just synced from Elementor), auto-save it to get one.
      if (!v || !v.id) {
        if (!v) {
          return;
        }
        AFF.App.ajax("aff_save_color", {
          filename: AFF.state.currentFile,
          variable: JSON.stringify(v),
        })
          .then(function (res) {
            if (res.success && res.data && res.data.id) {
              v.id = res.data.id;
              if (res.data.data && res.data.data.variables) {
                AFF.state.variables = res.data.data.variables;
              }
              self._generateChildren(v.id, panel);
            } else {
              AFF.Modal.open({
                title: "Variable Not Saved",
                body: "<p>Could not auto-save this variable. Save the project file first, then try again.</p>",
              });
            }
          })
          .catch(function () {
            AFF.Modal.open({
              title: "Variable Not Saved",
              body: "<p>Network error while auto-saving. Save the project file first, then try again.</p>",
            });
          });
        return;
      }

      var tintsNum = panel ? panel.querySelector(".aff-gen-tints-num") : null;
      var shadesNum = panel ? panel.querySelector(".aff-gen-shades-num") : null;
      var transChk = panel
        ? panel.querySelector(".aff-gen-trans-toggle")
        : null;

      var tintSteps = tintsNum ? parseInt(tintsNum.value, 10) || 0 : 0;
      var shadeSteps = shadesNum ? parseInt(shadesNum.value, 10) || 0 : 0;
      var transOn = transChk ? (transChk.checked ? "1" : "0") : "0";

      AFF.App.ajax("aff_generate_children", {
        filename: AFF.state.currentFile,
        parent_id: v.id,
        tints: String(tintSteps),
        shades: String(shadeSteps),
        transparencies: transOn,
      })
        .then(function (res) {
          if (res.success && res.data) {
            if (res.data.data && res.data.data.variables) {
              AFF.state.variables = res.data.data.variables;
            }
            if (AFF.App) {
              AFF.App.setDirty(true);
              AFF.App.refreshCounts();
            }
          }
        })
        .catch(function () {
          console.warn("[AFF] AJAX error: merge file");
        });
    },

    // -----------------------------------------------------------------------
    // UNDO / REDO
    // -----------------------------------------------------------------------

    /**
     * Undo the last operation.
     */
    undo: function () {
      var self = this;
      if (_undoStack.length === 0) {
        return;
      }

      var op = _undoStack.pop();
      _redoStack.push(op);

      if (op.type === "value-change" || op.type === "name-change") {
        var field = op.type === "value-change" ? "value" : "name";
        var update = { id: op.id, status: "modified" };
        update[field] = op.oldValue;
        self._ajaxSaveColor(update, function () {
          if (AFF.App) {
            AFF.App.setDirty(true);
          }
          self._rerenderView();
        });
      }
    },

    /**
     * Redo the last undone operation.
     */
    redo: function () {
      var self = this;
      if (_redoStack.length === 0) {
        return;
      }

      var op = _redoStack.pop();
      _undoStack.push(op);

      if (op.type === "value-change" || op.type === "name-change") {
        var field = op.type === "value-change" ? "value" : "name";
        var update = { id: op.id, status: "modified" };
        update[field] = op.newValue;
        self._ajaxSaveColor(update, function () {
          if (AFF.App) {
            AFF.App.setDirty(true);
          }
          self._rerenderView();
        });
      }
    },

    // -----------------------------------------------------------------------
    // FILTER / COLLAPSE
    // -----------------------------------------------------------------------

    /**
     * Filter color rows by search query.
     *
     * @param {HTMLElement} container
     * @param {string}      query
     */
    _filterRows: function (container, query) {
      var lq = query.toLowerCase();
      var rows = container.querySelectorAll(".aff-color-row");

      for (var i = 0; i < rows.length; i++) {
        var nameInput = rows[i].querySelector(".aff-color-name-input");
        var valueInput = rows[i].querySelector(".aff-color-value-input");
        var name = nameInput ? nameInput.value.toLowerCase() : "";
        var value = valueInput ? valueInput.value.toLowerCase() : "";

        var match = !lq || name.indexOf(lq) !== -1 || value.indexOf(lq) !== -1;
        rows[i].style.display = match ? "" : "none";
      }
    },

    /**
     * Expand or collapse all category blocks and update the toggle button.
     *
     * @param {HTMLElement} container
     * @param {boolean}     collapsed True to collapse, false to expand.
     */
    _setAllCollapsed: function (container, collapsed) {
      var blocks = container.querySelectorAll(".aff-category-block");
      for (var i = 0; i < blocks.length; i++) {
        var catId = blocks[i].getAttribute("data-category-id");
        blocks[i].setAttribute("data-collapsed", collapsed ? "true" : "false");
        if (catId) {
          this._collapsedIds[catId] = collapsed;
        }
      }

      // Update toggle button icon and label.
      var toggleBtn = container.querySelector("#aff-colors-collapse-toggle");
      if (toggleBtn) {
        if (collapsed) {
          toggleBtn.setAttribute("title", "Expand all categories");
          toggleBtn.setAttribute("aria-label", "Expand all categories");
          toggleBtn.setAttribute("data-aff-tooltip", "Expand all categories");
          toggleBtn.setAttribute("data-toggle-state", "collapsed");
          toggleBtn.innerHTML = AFF.Icons.expandAllSVG();
        } else {
          toggleBtn.setAttribute("title", "Collapse all categories");
          toggleBtn.setAttribute("aria-label", "Collapse all categories");
          toggleBtn.setAttribute("data-aff-tooltip", "Collapse all categories");
          toggleBtn.setAttribute("data-toggle-state", "expanded");
          toggleBtn.innerHTML = AFF.Icons.collapseAllSVG();
        }
      }
    },

    // -----------------------------------------------------------------------
    // MULTI-SELECT OPERATIONS
    // -----------------------------------------------------------------------

    /**
     * Handle a Ctrl/Shift/plain-click on a variable row for multi-select.
     *
     * @param {string}      rowKey    The clicked row's key (_rowKey value).
     * @param {boolean}     shiftKey  Extend range from last anchor.
     * @param {boolean}     ctrlKey   Toggle individual item.
     * @param {HTMLElement} container The #aff-edit-content element.
     */
    _handleRowSelect: function (rowKey, shiftKey, ctrlKey, container) {
      if (ctrlKey) {
        // Toggle this row; update anchor only on additions.
        if (_selectedKeys[rowKey]) {
          delete _selectedKeys[rowKey];
        } else {
          _selectedKeys[rowKey] = true;
          _lastSelectKey = rowKey;
        }
      } else if (shiftKey && _lastSelectKey) {
        // Extend range between anchor and target using DOM order.
        var allRows = container.querySelectorAll(".aff-color-row");
        var keys = [];
        for (var ri = 0; ri < allRows.length; ri++) {
          keys.push(allRows[ri].getAttribute("data-var-id"));
        }
        var fromIdx = keys.indexOf(_lastSelectKey);
        var toIdx = keys.indexOf(rowKey);
        if (fromIdx !== -1 && toIdx !== -1) {
          var lo = Math.min(fromIdx, toIdx);
          var hi = Math.max(fromIdx, toIdx);
          for (var ki = lo; ki <= hi; ki++) {
            if (keys[ki]) {
              _selectedKeys[keys[ki]] = true;
            }
          }
        }
        // Anchor stays fixed on chained shift-clicks.
      } else {
        // Plain modifier-less click via _handleRowSelect path: select only this one.
        _selectedKeys = {};
        _selectedKeys[rowKey] = true;
        _lastSelectKey = rowKey;
      }
      this._updateSelectionUI(container);
    },

    /**
     * Sync row highlight attributes and selection bar visibility/count to
     * the current _selectedKeys set without re-rendering the full view.
     *
     * @param {HTMLElement} container
     */
    _updateSelectionUI: function (container) {
      var allRows = container.querySelectorAll(".aff-color-row");
      for (var i = 0; i < allRows.length; i++) {
        var rk = allRows[i].getAttribute("data-var-id");
        allRows[i].setAttribute(
          "data-selected",
          _selectedKeys[rk] ? "true" : "false",
        );
      }
      var count = Object.keys(_selectedKeys).length;
      var bar = container.querySelector("#aff-selection-bar");
      if (bar) {
        bar.style.display = count > 0 ? "" : "none";
        var countEl = bar.querySelector(".aff-sel-bar-count");
        if (countEl) {
          countEl.textContent = count + " selected";
        }
      }
    },

    /**
     * Clear all selections and hide the selection bar.
     *
     * @param {HTMLElement} container
     */
    _clearSelection: function (container) {
      _selectedKeys = {};
      _lastSelectKey = null;
      this._updateSelectionUI(container);
    },

    /**
     * Show a category picker and move all selected variables to the chosen category.
     *
     * Updates AFF state then persists via aff_save_file (one round-trip for all
     * moved vars — avoids per-variable aff_save_color calls).
     *
     * @param {HTMLElement} container
     */
    _moveSelectedToCategory: function (container) {
      var self = this;
      var count = Object.keys(_selectedKeys).length;
      if (count === 0) {
        return;
      }

      var cats =
        AFF.state.config && AFF.state.config.categories
          ? AFF.state.config.categories.slice().sort(function (a, b) {
              return (a.order || 0) - (b.order || 0);
            })
          : self._getDefaultCategories();
      if (cats.length === 0) {
        return;
      }

      var opts = cats
        .map(function (c) {
          return (
            '<option value="' +
            AFF.Utils.escHtml(c.id) +
            '">' +
            AFF.Utils.escHtml(c.name) +
            "</option>"
          );
        })
        .join("");

      var handler;
      AFF.Modal.open({
        title:
          "Move " +
          count +
          " variable" +
          (count !== 1 ? "s" : "") +
          " to category",
        body:
          '<select id="aff-sel-cat-pick" style="width:100%;margin-top:4px;padding:6px 8px;font-size:13px;border-radius:4px;border:1px solid var(--aff-clr-border)">' +
          opts +
          "</select>",
        footer:
          '<div style="display:flex;justify-content:flex-end;gap:8px">' +
          '<button class="aff-btn aff-btn--secondary" id="aff-sel-move-cancel">Cancel</button>' +
          '<button class="aff-btn" id="aff-sel-move-confirm">Move</button>' +
          "</div>",
        onClose: function () {
          document.removeEventListener("click", handler);
        },
      });

      handler = function (e) {
        if (e.target.id === "aff-sel-move-cancel") {
          AFF.Modal.close();
          document.removeEventListener("click", handler);
        } else if (e.target.id === "aff-sel-move-confirm") {
          var sel = document.getElementById("aff-sel-cat-pick");
          var catId = sel ? sel.value : "";
          AFF.Modal.close();
          document.removeEventListener("click", handler);
          if (!catId) {
            return;
          }

          // Resolve category name from ID.
          var catName = "";
          for (var ci = 0; ci < cats.length; ci++) {
            if (cats[ci].id === catId) {
              catName = cats[ci].name;
              break;
            }
          }

          // Update category on every selected variable in state.
          for (var vi = 0; vi < AFF.state.variables.length; vi++) {
            var v = AFF.state.variables[vi];
            var rk = AFF.Utils.rowKey(v);
            if (_selectedKeys[rk]) {
              AFF.state.variables[vi].category = catName;
              AFF.state.variables[vi].category_id = catId;
              AFF.state.variables[vi].status = "modified";
            }
          }

          _selectedKeys = {};
          _lastSelectKey = null;

          // Persist all moves in one save call.
          if (AFF.state.currentFile && AFF.state.projectName) {
            AFF.App.ajax("aff_save_file", {
              project_name: AFF.state.projectName,
              data: JSON.stringify({
                version: "1.0",
                config: AFF.state.config || {},
                variables: AFF.state.variables || [],
                classes: AFF.state.classes || [],
                components: AFF.state.components || [],
                metadata: AFF.state.metadata || {},
              }),
            })
              .then(function (res) {
                if (res.success && res.data && res.data.variables) {
                  AFF.state.variables = res.data.variables;
                }
                if (AFF.App) {
                  AFF.App.setDirty(true);
                  AFF.App.refreshCounts();
                }
                self._rerenderView();
              })
              .catch(function () {
                if (AFF.App) {
                  AFF.App.setDirty(true);
                }
                self._rerenderView();
              });
          } else {
            if (AFF.App) {
              AFF.App.setDirty(true);
            }
            self._rerenderView();
          }
        }
      };
      document.addEventListener("click", handler);
    },

    /**
     * Confirm and delete all currently selected variables.
     *
     * Unsaved variables (id:'') are removed from memory only.
     * Saved variables are also deleted from the server via aff_delete_color.
     *
     * @param {HTMLElement} container
     */
    _deleteSelected: function (container) {
      var self = this;
      var count = Object.keys(_selectedKeys).length;
      if (count === 0) {
        return;
      }

      var handler;
      AFF.Modal.open({
        title: "Delete " + count + " variable" + (count !== 1 ? "s" : "") + "?",
        body: "<p>This cannot be undone.</p>",
        footer:
          '<div style="display:flex;justify-content:flex-end;gap:8px">' +
          '<button class="aff-btn aff-btn--secondary" id="aff-msdel-cancel">Cancel</button>' +
          '<button class="aff-btn aff-btn--danger" id="aff-msdel-confirm">Delete all</button>' +
          "</div>",
        onClose: function () {
          document.removeEventListener("click", handler);
        },
      });

      handler = function (e) {
        if (e.target.id === "aff-msdel-cancel") {
          AFF.Modal.close();
          document.removeEventListener("click", handler);
        } else if (e.target.id === "aff-msdel-confirm") {
          AFF.Modal.close();
          document.removeEventListener("click", handler);

          // Remove selected vars from state; collect saved IDs for server delete.
          var savedIds = [];
          AFF.state.variables = AFF.state.variables.filter(function (v) {
            var rk = AFF.Utils.rowKey(v);
            if (!_selectedKeys[rk]) {
              return true;
            } // keep
            if (v.id) {
              savedIds.push(v.id);
            } // mark for server delete
            return false; // remove from state
          });

          _selectedKeys = {};
          _lastSelectKey = null;

          // Fire server deletes for saved vars (fire-and-forget; state already cleaned).
          savedIds.forEach(function (vid) {
            AFF.App.ajax("aff_delete_color", {
              filename: AFF.state.currentFile,
              variable_id: vid,
              delete_children: "0",
            });
          });

          if (AFF.App) {
            AFF.App.setDirty(true);
            AFF.App.refreshCounts();
          }
          self._rerenderView();
        }
      };
      document.addEventListener("click", handler);
    },

    // -----------------------------------------------------------------------
    // RE-RENDER
    // -----------------------------------------------------------------------

    /**
     * Re-render the Colors view after a state change.
     *
     * Clears focused category (so collapse state is preserved, not overridden
     * by the nav-click behaviour) then re-renders with current selection.
     */
    _rerenderView: function () {
      var content = document.getElementById("aff-edit-content");
      if (!content || !AFF.state.currentSelection) {
        return;
      }

      // Call _renderAll directly to avoid resetting this._collapsedIds.
      // (loadColors would re-apply _focusedCategoryId from currentSelection
      //  and wipe out the manual collapse overrides set by recent CRUD ops.)
      _focusedCategoryId = null;
      this._renderAll(AFF.state.currentSelection, content);
    },

    /**
     * Update just the swatch background in the DOM without a full re-render.
     *
     * @param {string} varId Variable ID.
     * @param {string} value CSS color value.
     */
    _updateSwatchInDOM: function (varId, value) {
      var content = document.getElementById("aff-edit-content");
      if (!content) {
        return;
      }
      var row = content.querySelector(
        '.aff-color-row[data-var-id="' + varId + '"]',
      );
      if (!row) {
        return;
      }
      var swatch = row.querySelector(".aff-color-swatch");
      if (swatch) {
        swatch.style.background = value;
      }
    },

    // -----------------------------------------------------------------------
    // DATA HELPERS
    // -----------------------------------------------------------------------

    /**
     * Get variables that belong to a given category object.
     *
     * Special case: "Uncategorized" is a catch-all — it includes any Colors
     * variable that is not explicitly assigned to another defined category.
     * This ensures Elementor-synced vars (which have no category set) appear
     * somewhere in the UI.
     *
     * @param {{ id: string, name: string }} cat
     * @returns {Array}
     */
    _getVarsForCategory: function (cat) {
      var allVars = AFF.state.variables || [];

      if (cat.name === "Uncategorized") {
        // Build lookup of all non-Uncategorized category IDs and names.
        var cats =
          AFF.state.config && AFF.state.config.categories
            ? AFF.state.config.categories
            : this._getDefaultCategories();

        var validIds = {};
        var validNames = {};
        for (var i = 0; i < cats.length; i++) {
          if (cats[i].name !== "Uncategorized") {
            validIds[cats[i].id] = true;
            if (cats[i].name) {
              validNames[cats[i].name] = true;
            }
          }
        }

        return allVars
          .filter(function (v) {
            if (v.subgroup !== "Colors" || v.status === "deleted") {
              return false;
            }
            // Explicitly assigned to this Uncategorized category.
            if (v.category_id === cat.id || v.category === cat.name) {
              return true;
            }
            // Falls through — not matched by any other category.
            var hasOtherCatId = v.category_id && validIds[v.category_id];
            var hasOtherCatName = v.category && validNames[v.category];
            return !hasOtherCatId && !hasOtherCatName;
          })
          .sort(function (a, b) {
            return (a.order || 0) - (b.order || 0);
          });
      }

      // Standard filter: match by category_id or category name, sorted by order.
      return allVars
        .filter(function (v) {
          return (
            v.subgroup === "Colors" &&
            (v.category_id === cat.id || v.category === cat.name) &&
            v.status !== "deleted"
          );
        })
        .sort(function (a, b) {
          return (a.order || 0) - (b.order || 0);
        });
    },

    /**
     * Get child variables (parent_id matches the given ID).
     *
     * @param {string} parentId
     * @returns {Array}
     */
    _getChildVars: function (parentId) {
      return (AFF.state.variables || []).filter(function (v) {
        return v.parent_id === parentId;
      });
    },

    // -----------------------------------------------------------------------
    // FIELD VALIDATION + ERROR DISPLAY
    // -----------------------------------------------------------------------

    /**
     * Normalize and validate a user-entered color value for the given format.
     * Auto-corrects common mistakes; returns error string for fatal failures.
     *
     * @param {string} raw    Raw user input.
     * @param {string} format HEX | HEXA | RGB | RGBA | HSL | HSLA
     * @returns {{ value: string, error: string|null }}
     */
    _normalizeColorValue: function (raw, format) {
      var v = (typeof raw === "string" ? raw : "").trim();

      // ---- HEX / HEXA ----
      if (format === "HEX" || format === "HEXA") {
        var bare = v.replace(/^#/, "").toUpperCase();
        // 3-digit → 6-digit: F53 → FF5533
        if (/^[0-9A-F]{3}$/.test(bare)) {
          bare = bare[0] + bare[0] + bare[1] + bare[1] + bare[2] + bare[2];
          // 4-digit → 8-digit (each digit doubled): F004 → FF000044
        } else if (/^[0-9A-F]{4}$/.test(bare)) {
          bare =
            bare[0] +
            bare[0] +
            bare[1] +
            bare[1] +
            bare[2] +
            bare[2] +
            bare[3] +
            bare[3];
        }
        if (/^[0-9A-F]{6}$/.test(bare) || /^[0-9A-F]{8}$/.test(bare)) {
          return { value: "#" + bare, error: null };
        }
        return {
          value: v,
          error:
            "HEX must be 3, 4, 6, or 8 hex digits (0–9, A–F). Examples: #F53, #F004, #FF5733, #FF573380",
        };
      }

      // ---- RGB / RGBA ----
      if (format === "RGB" || format === "RGBA") {
        var inner = v
          .replace(/^rgba?\s*\(/i, "")
          .replace(/\)\s*$/, "")
          .trim();
        var parts = inner.split(/[\s,]+/).filter(function (s) {
          return s !== "";
        });
        if (parts.length < 3) {
          return {
            value: v,
            error:
              "RGB requires at least 3 values. Example: rgb(255, 87, 51) or rgba(255, 87, 51, 0.8)",
          };
        }
        var r = parseInt(parts[0], 10);
        var g = parseInt(parts[1], 10);
        var b = parseInt(parts[2], 10);
        if (isNaN(r) || isNaN(g) || isNaN(b)) {
          return {
            value: v,
            error: "RGB channel values must be whole numbers (0–255)",
          };
        }
        r = Math.max(0, Math.min(255, r));
        g = Math.max(0, Math.min(255, g));
        b = Math.max(0, Math.min(255, b));
        // 4th value = alpha → output rgba(); otherwise rgb()
        if (parts.length >= 4) {
          var a = parseFloat(parts[3]);
          if (isNaN(a)) {
            return {
              value: v,
              error: "Alpha must be a decimal number (0–1). Example: 0.5",
            };
          }
          a = Math.round(Math.max(0, Math.min(1, a)) * 100) / 100;
          return {
            value: "rgba(" + r + ", " + g + ", " + b + ", " + a + ")",
            error: null,
          };
        }
        return { value: "rgb(" + r + ", " + g + ", " + b + ")", error: null };
      }

      // ---- HSL / HSLA ----
      if (format === "HSL" || format === "HSLA") {
        var inner2 = v
          .replace(/^hsla?\s*\(/i, "")
          .replace(/\)\s*$/, "")
          .trim();
        var raw2 = inner2.replace(/%/g, "");
        var pts = raw2.split(/[\s,]+/).filter(function (s) {
          return s !== "";
        });
        if (pts.length < 3) {
          return {
            value: v,
            error:
              "HSL requires at least 3 values. Example: hsl(200, 60%, 40%) or hsla(200, 60%, 40%, 0.8)",
          };
        }
        var h = parseFloat(pts[0]);
        var s = parseFloat(pts[1]);
        var l = parseFloat(pts[2]);
        if (isNaN(h) || isNaN(s) || isNaN(l)) {
          return {
            value: v,
            error:
              "HSL values must be numbers: hue (0–360), saturation (0–100), lightness (0–100)",
          };
        }
        h = Math.round(((h % 360) + 360) % 360);
        s = Math.round(Math.max(0, Math.min(100, s)));
        l = Math.round(Math.max(0, Math.min(100, l)));
        // 4th value = alpha → output hsla(); otherwise hsl()
        if (pts.length >= 4) {
          var a2 = parseFloat(pts[3]);
          if (isNaN(a2)) {
            return {
              value: v,
              error: "Alpha must be a decimal number (0–1). Example: 0.5",
            };
          }
          a2 = Math.round(Math.max(0, Math.min(1, a2)) * 100) / 100;
          return {
            value: "hsla(" + h + ", " + s + "%, " + l + "%, " + a2 + ")",
            error: null,
          };
        }
        return { value: "hsl(" + h + ", " + s + "%, " + l + "%)", error: null };
      }

      return { value: v, error: null };
    },

    /**
     * Show a floating inline error tooltip below an input element.
     * Auto-dismisses after 3.5 seconds.
     *
     * @param {HTMLElement} input   The input with the invalid value.
     * @param {string}      message Error message to display.
     */
    /**
     * Convert a Pickr Color object to a normalizable CSS string.
     *
     * @param {object} color  Pickr Color instance.
     * @param {string} format 'HEXA' | 'RGBA' | 'HSLA'
     * @returns {string}
     */
    /**
     * Re-render tints, shades, and transparencies after a color change.
     *
     * @param {HTMLElement} modal  The open expand modal element.
     * @param {string}      varId  Variable ID.
     */
    _refreshModalPalettes: function (modal, varId) {
      var self = this;
      var vv = AFF.Utils.findVarByKey(varId);
      if (!vv || !modal) {
        return;
      }
      var rgba2 = self._parseToRgba(vv.value || "");
      var hsl2 = rgba2 ? self._rgbToHsl(rgba2.r, rgba2.g, rgba2.b) : null;
      var tintsNum = modal.querySelector(".aff-gen-tints-num");
      var shadesNum = modal.querySelector(".aff-gen-shades-num");
      var transChk = modal.querySelector(".aff-gen-trans-toggle");
      var tintsPal = modal.querySelector(".aff-tints-palette");
      var shadesPal = modal.querySelector(".aff-shades-palette");
      var transPal = modal.querySelector(".aff-trans-palette");
      if (tintsPal && tintsNum) {
        var ts = parseInt(tintsNum.value, 10) || 0;
        tintsPal.innerHTML = self._buildTintsBars(hsl2, ts);
      }
      if (shadesPal && shadesNum) {
        var ss = parseInt(shadesNum.value, 10) || 0;
        shadesPal.innerHTML = self._buildShadesBars(hsl2, ss);
      }
      if (transPal && transChk) {
        transPal.innerHTML = transChk.checked
          ? self._buildTransBars(rgba2)
          : "";
      }
      self._debounceGenerate(varId, modal);
    },

    _pickrColorToString: function (color, format) {
      var rgba = color.toRGBA();
      var alpha = rgba[3]; // 0–1
      var opaque = alpha >= 0.999;
      // Normalise legacy alpha-suffix formats.
      var fmt = (format || "HEX").replace(/A$/, "");
      if (fmt === "HEX") {
        var hexStr = color.toHEXA().toString(); // #RRGGBBAA
        return opaque ? hexStr.slice(0, 7) : hexStr;
      }
      if (fmt === "RGB") {
        var r = Math.round(rgba[0]);
        var g = Math.round(rgba[1]);
        var b = Math.round(rgba[2]);
        if (opaque) {
          return "rgb(" + r + ", " + g + ", " + b + ")";
        }
        var a = Math.round(alpha * 100) / 100;
        return "rgba(" + r + ", " + g + ", " + b + ", " + a + ")";
      }
      if (fmt === "HSL") {
        var hsla = color.toHSLA();
        var h = Math.round(hsla[0]);
        var s = Math.round(hsla[1]);
        var l = Math.round(hsla[2]);
        if (opaque) {
          return "hsl(" + h + ", " + s + "%, " + l + "%)";
        }
        var a2 = Math.round(alpha * 100) / 100;
        return "hsla(" + h + ", " + s + "%, " + l + "%, " + a2 + ")";
      }
      return "";
    },

    // -----------------------------------------------------------------------
    // MODAL HELPERS
    // -----------------------------------------------------------------------

    /**
     * Show a "no file loaded" info modal.
     */
    _noFileModal: function () {
      var body =
        "<p>No project file is loaded. Enter a filename to save the current data as a project file — then retry your action.</p>" +
        '<input type="text" id="aff-nfl-filename" class="aff-text-input"' +
        ' value="elementor-variables.eff.json"' +
        ' style="width:100%;margin-top:12px;" />';

      var footer =
        '<button class="aff-btn aff-btn--primary" id="aff-nfl-save-btn">Save File</button>';

      AFF.Modal.open({ title: "No file loaded", body: body, footer: footer });

      var saveBtn = document.getElementById("aff-nfl-save-btn");
      if (!saveBtn) {
        return;
      }

      saveBtn.addEventListener("click", function () {
        var inp = document.getElementById("aff-nfl-filename");
        var filename = inp ? inp.value.trim() : "";
        if (!filename) {
          return;
        }
        if (!/\.eff\.json$/.test(filename)) {
          filename += ".eff.json";
        }

        var saveData = {
          config: {
            categories:
              AFF.state.config && AFF.state.config.categories
                ? AFF.state.config.categories
                : [],
          },
          variables: AFF.state.variables || [],
        };

        saveBtn.disabled = true;
        saveBtn.textContent = "Saving\u2026";

        AFF.App.ajax("aff_save_file", {
          project_name: filename.replace(/\.eff(?:\.json)?$/i, ""),
          data: JSON.stringify(saveData),
        })
          .then(function (res) {
            if (res.success && res.data) {
              AFF.state.currentFile = res.data.filename;
              if (AFF.App && AFF.App.setDirty) {
                AFF.App.setDirty(false);
              }
              AFF.Modal.close();
            } else {
              saveBtn.disabled = false;
              saveBtn.textContent = "Save File";
            }
          })
          .catch(function () {
            saveBtn.disabled = false;
            saveBtn.textContent = "Save File";
          });
      });
    },

    // -----------------------------------------------------------------------
    // COLOR UTILITIES
    // -----------------------------------------------------------------------

    /**
     * Extract a 6-character hex string from a CSS color value.
     *
     * @param {string} value CSS color value.
     * @returns {string|null} '#rrggbb' or null.
     */
    _parseHex6: function (value) {
      if (!value) {
        return null;
      }
      var m = value.match(/^#([0-9a-fA-F]{6})/);
      return m ? "#" + m[1].toLowerCase() : null;
    },

    /**
     * Extract the alpha channel (0–1) from a CSS color value.
     *
     * @param {string} value CSS color value.
     * @returns {number} Alpha 0–1.
     */
    _parseAlpha: function (value) {
      if (!value) {
        return 1;
      }
      var m = value.match(/^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})$/);
      if (!m) {
        return 1;
      }
      return parseInt(m[1], 16) / 255;
    },

    /**
     * Combine a #rrggbb hex and an alpha percentage into a CSS value.
     *
     * @param {string} hex6     '#rrggbb' format.
     * @param {number} alphaPct 0–100.
     * @returns {string}
     */
    _combineHexAlpha: function (hex6, alphaPct) {
      if (alphaPct >= 100) {
        return hex6;
      }
      var alpha = Math.round((alphaPct / 100) * 255);
      var alphaHex = alpha.toString(16);
      if (alphaHex.length < 2) {
        alphaHex = "0" + alphaHex;
      }
      return hex6 + alphaHex;
    },

    /**
     * Parse any supported CSS color value to {r, g, b, a} (r/g/b: 0-255, a: 0-1).
     *
     * Supports: #rrggbb, #rrggbbaa, rgb(...), rgba(...), hsl(...), hsla(...)
     *
     * @param {string} value CSS color value.
     * @returns {{r:number,g:number,b:number,a:number}|null}
     */
    _parseToRgba: function (value) {
      if (!value) {
        return null;
      }
      var v = value.trim();

      // HEX 8-char (#rrggbbaa)
      var m8 = v.match(
        /^#([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/,
      );
      if (m8) {
        return {
          r: parseInt(m8[1], 16),
          g: parseInt(m8[2], 16),
          b: parseInt(m8[3], 16),
          a: parseInt(m8[4], 16) / 255,
        };
      }
      // HEX 6-char (#rrggbb)
      var m6 = v.match(/^#([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/);
      if (m6) {
        return {
          r: parseInt(m6[1], 16),
          g: parseInt(m6[2], 16),
          b: parseInt(m6[3], 16),
          a: 1,
        };
      }
      // rgba(r, g, b, a)
      var mRgba = v.match(
        /^rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)$/i,
      );
      if (mRgba) {
        return {
          r: parseInt(mRgba[1]),
          g: parseInt(mRgba[2]),
          b: parseInt(mRgba[3]),
          a: parseFloat(mRgba[4]),
        };
      }
      // rgb(r, g, b)
      var mRgb = v.match(/^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/i);
      if (mRgb) {
        return {
          r: parseInt(mRgb[1]),
          g: parseInt(mRgb[2]),
          b: parseInt(mRgb[3]),
          a: 1,
        };
      }
      // hsla(h, s%, l%, a)
      var mHsla = v.match(
        /^hsla\(\s*([\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%\s*,\s*([\d.]+)\s*\)$/i,
      );
      if (mHsla) {
        var rgb = this._hslToRgb(
          parseFloat(mHsla[1]),
          parseFloat(mHsla[2]),
          parseFloat(mHsla[3]),
        );
        return { r: rgb.r, g: rgb.g, b: rgb.b, a: parseFloat(mHsla[4]) };
      }
      // hsl(h, s%, l%)
      var mHsl = v.match(
        /^hsl\(\s*([\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%\s*\)$/i,
      );
      if (mHsl) {
        var rgb2 = this._hslToRgb(
          parseFloat(mHsl[1]),
          parseFloat(mHsl[2]),
          parseFloat(mHsl[3]),
        );
        return { r: rgb2.r, g: rgb2.g, b: rgb2.b, a: 1 };
      }
      return null;
    },

    /**
     * Convert H/S/L (h: 0-360, s: 0-100, l: 0-100) to {r,g,b} (0-255).
     *
     * @param {number} h Hue 0-360.
     * @param {number} s Saturation 0-100.
     * @param {number} l Lightness 0-100.
     * @returns {{r:number,g:number,b:number}}
     */
    _hslToRgb: function (h, s, l) {
      s /= 100;
      l /= 100;
      var c = (1 - Math.abs(2 * l - 1)) * s;
      var x = c * (1 - Math.abs(((h / 60) % 2) - 1));
      var m = l - c / 2;
      var r = 0,
        g = 0,
        b = 0;
      if (h < 60) {
        r = c;
        g = x;
        b = 0;
      } else if (h < 120) {
        r = x;
        g = c;
        b = 0;
      } else if (h < 180) {
        r = 0;
        g = c;
        b = x;
      } else if (h < 240) {
        r = 0;
        g = x;
        b = c;
      } else if (h < 300) {
        r = x;
        g = 0;
        b = c;
      } else {
        r = c;
        g = 0;
        b = x;
      }
      return {
        r: Math.round((r + m) * 255),
        g: Math.round((g + m) * 255),
        b: Math.round((b + m) * 255),
      };
    },

    /**
     * Convert {r,g,b} (0-255) to {h,s,l} (h: 0-360, s: 0-100, l: 0-100).
     *
     * @param {number} r 0-255.
     * @param {number} g 0-255.
     * @param {number} b 0-255.
     * @returns {{h:number,s:number,l:number}}
     */
    _rgbToHsl: function (r, g, b) {
      r /= 255;
      g /= 255;
      b /= 255;
      var max = Math.max(r, g, b),
        min = Math.min(r, g, b);
      var l = (max + min) / 2,
        s = 0,
        h = 0;
      if (max !== min) {
        var d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
          case r:
            h = (g - b) / d + (g < b ? 6 : 0);
            break;
          case g:
            h = (b - r) / d + 2;
            break;
          default:
            h = (r - g) / d + 4;
        }
        h /= 6;
      }
      return {
        h: Math.round(h * 360),
        s: Math.round(s * 100),
        l: Math.round(l * 100),
      };
    },

    /**
     * Convert a CSS color value to a different format string.
     *
     * @param {string} value     Current CSS color value.
     * @param {string} newFormat Target format: HEX | HEXA | RGB | RGBA | HSL | HSLA.
     * @returns {string|null} Converted value, or null if parse failed.
     */
    _convertColor: function (value, newFormat) {
      var self = this;
      var rgba = self._parseToRgba(value);
      if (!rgba) {
        return null;
      }

      var r = rgba.r,
        g = rgba.g,
        b = rgba.b,
        a = rgba.a;

      // Always two uppercase hex digits (00–FF).
      function hex2(n) {
        var s = Math.round(n).toString(16).toUpperCase();
        return s.length < 2 ? "0" + s : s;
      }

      switch (newFormat) {
        case "HEX":
          return "#" + hex2(r) + hex2(g) + hex2(b);
        case "HEXA":
          // Always 8 chars: #RRGGBBAA — alpha byte from 0–255.
          return "#" + hex2(r) + hex2(g) + hex2(b) + hex2(Math.round(a * 255));
        case "RGB":
          return "rgb(" + r + ", " + g + ", " + b + ")";
        case "RGBA":
          return (
            "rgba(" +
            r +
            ", " +
            g +
            ", " +
            b +
            ", " +
            Math.round(a * 100) / 100 +
            ")"
          );
        case "HSL": {
          var hsl = self._rgbToHsl(r, g, b);
          return "hsl(" + hsl.h + ", " + hsl.s + "%, " + hsl.l + "%)";
        }
        case "HSLA": {
          var hsl2 = self._rgbToHsl(r, g, b);
          return (
            "hsla(" +
            hsl2.h +
            ", " +
            hsl2.s +
            "%, " +
            hsl2.l +
            "%, " +
            Math.round(a * 100) / 100 +
            ")"
          );
        }
      }
      return null;
    },
  };
})();
