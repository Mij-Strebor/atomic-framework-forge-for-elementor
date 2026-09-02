/**
 * ATFRFO Export/Import — File Export/Import Modal (multi-format)
 *
 * Saves or loads a local FILE on the user's computer. This is deliberately
 * separate from "Sync" (ATFRFO.PanelRight.openSyncModal, atfrfo-panel-right.js)
 * which reads/writes the LIVE active Elementor kit directly — Export/Import
 * never touches the live site.
 *
 * Formats:
 *   - "atfrfo"       AFF Project (.json) — AFF's own full-fidelity
 *                     format (variables + classes + components + config).
 *                     Import here fully replaces the current project state,
 *                     same as before this module existed.
 *   - "elementor-v4" Elementor v4 Kit (.zip) — Elementor's own native
 *                     kit-export shape (manifest.json + global-variables.json),
 *                     droppable directly into Elementor's own Import Kit
 *                     dialog. Variables only. Import here MERGES into the
 *                     current project (via the same ATFRFO.Merge conflict
 *                     resolution already used by the Sync modal), it does
 *                     not replace it.
 *   - "bricks"        Bricks Builder's native Global Variables JSON
 *                     (flat [{id,name,value}] array — see
 *                     ATFRFO_Bricks_Adapter). Variables only. Merges, same
 *                     as elementor-v4.
 *   - "figma"         W3C Design Tokens (DTCG) format JSON, importable into
 *                     Figma via the Tokens Studio plugin — no live API/token
 *                     (see ATFRFO_Figma_Adapter, including its verification
 *                     caveats: this is the least-confirmed of the three
 *                     cross-platform formats, no live Figma/Tokens Studio
 *                     install to round-trip test against). Variables only.
 *                     Merges, same as elementor-v4.
 *
 * @package AtomicFrameworkForge
 */

/* global ATFRFOData */
(function () {
  "use strict";

  window.ATFRFO = window.ATFRFO || {};

  // ------------------------------------------------------------------
  // FILE PICKER DIRECTORY MEMORY
  // Stores the last FileSystemFileHandle from Export / Import in
  // IndexedDB so the next call opens in the same directory. Falls back
  // to the Desktop on first use. Moved here from atfrfo-panel-top.js.
  // ------------------------------------------------------------------

  var _pickerDB = null;

  function _pickerDbOpen(cb) {
    if (_pickerDB) {
      cb(_pickerDB);
      return;
    }
    var req = indexedDB.open("atfrfo-picker", 1);
    req.onupgradeneeded = function (e) {
      e.target.result.createObjectStore("handles");
    };
    req.onsuccess = function (e) {
      _pickerDB = e.target.result;
      cb(_pickerDB);
    };
    req.onerror = function () {
      cb(null);
    };
  }

  function _pickerGet(key, cb) {
    _pickerDbOpen(function (db) {
      if (!db) {
        cb(null);
        return;
      }
      var req = db.transaction("handles").objectStore("handles").get(key);
      req.onsuccess = function () {
        cb(req.result || null);
      };
      req.onerror = function () {
        cb(null);
      };
    });
  }

  function _pickerSave(key, handle) {
    _pickerDbOpen(function (db) {
      if (!db) {
        return;
      }
      db.transaction("handles", "readwrite").objectStore("handles").put(handle, key);
    });
  }

  /**
   * Trigger a browser download of a Blob, using the File System Access API
   * when available (remembers the last-used directory per format) and
   * falling back to a plain anchor-click download otherwise.
   *
   * @param {Blob}   blob
   * @param {string} suggestedName
   * @param {string} pickerKey  Directory-memory key, e.g. "export-atfrfo".
   * @param {string} mimeType
   * @param {string} extension  Without the dot, e.g. "json" or "zip".
   */
  function _downloadViaAnchor(blob, suggestedName) {
    var url = URL.createObjectURL(blob);
    var link = document.createElement("a");
    link.href = url;
    link.download = suggestedName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 10000);
  }

  function _saveBlob(blob, suggestedName, pickerKey, mimeType, extension) {
    if (typeof window.showSaveFilePicker === "function") {
      _pickerGet(pickerKey, function (remembered) {
        window
          .showSaveFilePicker({
            suggestedName: suggestedName,
            startIn: remembered || "desktop",
            types: [
              {
                description: "ATFRFO File",
                accept: (function () {
                  var accept = {};
                  accept[mimeType] = ["." + extension];
                  return accept;
                })(),
              },
            ],
          })
          .then(function (fileHandle) {
            _pickerSave(pickerKey, fileHandle);
            return fileHandle.createWritable().then(function (writable) {
              return writable.write(blob).then(function () {
                return writable.close();
              });
            });
          })
          .catch(function (err) {
            if (err && err.name === "AbortError") {
              // User deliberately canceled the save dialog — do nothing.
              return;
            }
            // Anything else (including NotAllowedError — the picker requires
            // a fresh user-activation window, which an intervening AJAX call
            // before this point can consume, e.g. the Elementor v4 export
            // path) must not fail silently: fall back to a plain download
            // rather than leaving the user thinking the export just vanished.
            console.warn("ATFRFO export: falling back to direct download —", err);
            _downloadViaAnchor(blob, suggestedName);
          });
      });
    } else {
      _downloadViaAnchor(blob, suggestedName);
    }
  }

  /**
   * Decode a base64 string (as returned by the export AJAX endpoints) into
   * a Blob.
   *
   * @param {string} base64
   * @param {string} mimeType
   * @returns {Blob}
   */
  function _base64ToBlob(base64, mimeType) {
    var binary = atob(base64);
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new Blob([bytes], { type: mimeType });
  }

  var FORMATS = {
    atfrfo: {
      label: "AFF Project (.json)",
      description:
        "AFF's own full-fidelity format — variables, classes, components, and settings. Importing replaces the current project. " +
        "Unlike Save Changes (which stores on this server), this saves a portable copy to your own computer.",
    },
    "elementor-v4": {
      label: "Elementor v4 Kit (.zip)",
      description:
        "Elementor's own native kit-export format — the exported file can also be opened directly through Elementor's own Import Kit dialog. Variables only. Importing merges into the current project.",
    },
    bricks: {
      label: "Bricks Global Variables (.json)",
      description:
        "Bricks Builder's native Global Variables format. Variables only. Importing merges into the current project.",
    },
    figma: {
      label: "Figma Design Tokens (.json)",
      description:
        "W3C Design Tokens (DTCG) format, importable into Figma via the Tokens Studio plugin. No live Figma connection or API token — just a file. Variables only. Importing merges into the current project.",
    },
  };

  /**
   * Build an export filename in AFF's unified naming scheme:
   * {project-slug}[_{platform}]_{YYMMDD}_{HHMM}.{extension}
   *
   * The platform token is omitted for AFF's own native format — an "AFF
   * project" export IS the same artifact as an internal save (just written
   * to a location the user picked instead of AFF's own storage), so tagging
   * it as a distinct format alongside itself is redundant. Bricks, Figma,
   * and Elementor v4 are genuinely different target formats, so they get a
   * platform token. No separate "aff-" marker on that token — the file is
   * self-evidently an AFF export by virtue of coming from AFF at all.
   *
   * Uses local time, not gmdate() — this file lands directly in the user's
   * own filesystem, where a timestamp in their own timezone is what's
   * actually useful (unlike AFF's internal server-side backups, which
   * intentionally stay UTC via generate_backup_filename() for consistent
   * server-side behavior regardless of the visiting user's timezone).
   *
   * @param {string}      projectName Human project name (will be slugified).
   * @param {string|null} platform    e.g. "bricks", "figma", "elementor4" — null for AFF's own format.
   * @param {string}      extension   Without the dot, e.g. "json" or "zip".
   * @returns {string}
   */
  function _buildExportFilename(projectName, platform, extension) {
    var slug = (projectName || "aff-project")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    var now = new Date();
    var pad2 = function (n) {
      return (n < 10 ? "0" : "") + n;
    };
    var stamp =
      pad2(now.getFullYear() % 100) +
      pad2(now.getMonth() + 1) +
      pad2(now.getDate()) +
      "_" +
      pad2(now.getHours()) +
      pad2(now.getMinutes());
    var platformSegment = platform ? "_" + platform : "";
    return slug + platformSegment + "_" + stamp + "." + extension;
  }

  ATFRFO.ExportImport = {
    _mode: "export", // 'export' | 'import'
    _format: "atfrfo", // 'atfrfo' | 'elementor-v4'
    _clickHandler: null,

    /**
     * Open the Export/Import modal, defaulting to Export / AFF Project.
     */
    open: function () {
      this._mode = "export";
      this._format = "atfrfo";
      this._render();
    },

    // ------------------------------------------------------------------
    // MODAL RENDERING
    // ------------------------------------------------------------------

    _render: function () {
      var self = this;
      var isExport = this._mode === "export";
      var fmt = FORMATS[this._format];

      var body =
        '<div class="atfrfo-ei-modeToggle" style="display:flex;gap:8px;margin-bottom:14px">' +
        '<button type="button" class="atfrfo-btn' +
        (isExport ? "" : " atfrfo-btn--secondary") +
        '" id="atfrfo-ei-mode-export" style="flex:1">Export</button>' +
        '<button type="button" class="atfrfo-btn' +
        (isExport ? " atfrfo-btn--secondary" : "") +
        '" id="atfrfo-ei-mode-import" style="flex:1">Import</button>' +
        "</div>" +
        '<label class="atfrfo-field-label" for="atfrfo-ei-format" style="display:block;margin-bottom:4px">Format</label>' +
        '<select id="atfrfo-ei-format" class="atfrfo-field-input" style="width:100%;margin-bottom:8px">' +
        Object.keys(FORMATS)
          .map(function (key) {
            return (
              '<option value="' +
              key +
              '"' +
              (key === self._format ? " selected" : "") +
              ">" +
              FORMATS[key].label +
              "</option>"
            );
          })
          .join("") +
        "</select>" +
        '<p style="font-size:12px;color:var(--atfrfo-clr-muted);margin-bottom:14px">' +
        fmt.description +
        "</p>" +
        '<p style="font-size:11px;color:var(--atfrfo-clr-muted);margin-bottom:14px">This saves or loads a file on your computer — it does not read or write your live Elementor site. Use <strong>Sync</strong> for that.</p>' +
        (isExport ? "" : this._importBodyHtml());

      var footer = isExport
        ? '<button class="atfrfo-btn atfrfo-btn--secondary" id="atfrfo-ei-cancel" style="margin-right:8px">Cancel</button>' +
          '<button class="atfrfo-btn" id="atfrfo-ei-go">Export</button>'
        : '<button class="atfrfo-btn atfrfo-btn--secondary" id="atfrfo-ei-cancel" style="margin-right:8px">Cancel</button>' +
          // Starts disabled — no file chosen yet. _bind()'s file input
          // change handler enables it once one is. Format is always valid
          // (the select always has a value, AFF pre-selected), so the file
          // is the only thing left to gate on.
          '<button class="atfrfo-btn" id="atfrfo-ei-go" disabled>Import</button>';

      ATFRFO.Modal.open({
        title: "Export / Import",
        body: body,
        footer: footer,
        onClose: function () {
          if (self._clickHandler) {
            document.removeEventListener("click", self._clickHandler);
            self._clickHandler = null;
          }
        },
      });

      requestAnimationFrame(function () {
        self._bind();
      });
    },

    // Formats whose import MERGES into the current project (as opposed to
    // "atfrfo", which always fully replaces it by design) get a choice
    // between merging and clearing first — reuses the exact same
    // atfrfo-sync-* markup/copy pattern as the Sync modal's own V4/V3
    // import mode toggle (atfrfo-panel-right.js) for a consistent feel.
    _MERGE_FORMATS: { "elementor-v4": true, bricks: true, figma: true },

    _importBodyHtml: function () {
      var accept = this._format === "elementor-v4" ? ".zip,.json" : ".json";
      var fmt = FORMATS[this._format];
      var modeSection = "";

      if (this._MERGE_FORMATS[this._format]) {
        modeSection =
          '<div class="atfrfo-sync-section">' +
          '<div class="atfrfo-sync-section__label">Import mode</div>' +
          '<label class="atfrfo-sync-radio">' +
          '<input type="radio" name="atfrfo-ei-mode" value="merge" checked />' +
          "<span><strong>Merge</strong>" +
          '<span class="atfrfo-sync-hint">Add new variables and update matches; keep everything else in the current project as-is.</span></span>' +
          "</label>" +
          '<label class="atfrfo-sync-radio">' +
          '<input type="radio" name="atfrfo-ei-mode" value="clear" />' +
          "<span><strong>Clear and replace</strong>" +
          '<span class="atfrfo-sync-hint">Remove all existing variables first, then load fresh from the ' +
          fmt.label +
          " file. Discards AFF edits.</span></span>" +
          "</label>" +
          "</div>";
      }

      return (
        modeSection +
        '<label class="atfrfo-field-label" for="atfrfo-ei-file" style="display:block;margin-bottom:4px">File</label>' +
        '<input type="file" id="atfrfo-ei-file" accept="' +
        accept +
        '" style="display:block;width:100%;padding:8px 0;cursor:pointer">' +
        '<div id="atfrfo-ei-status" style="font-size:12px;color:var(--atfrfo-clr-muted);margin-top:8px;min-height:18px"></div>'
      );
    },

    _bind: function () {
      var self = this;
      var modeExportBtn = document.getElementById("atfrfo-ei-mode-export");
      var modeImportBtn = document.getElementById("atfrfo-ei-mode-import");
      var formatSelect = document.getElementById("atfrfo-ei-format");
      var cancelBtn = document.getElementById("atfrfo-ei-cancel");
      var goBtn = document.getElementById("atfrfo-ei-go");
      var fileInput = document.getElementById("atfrfo-ei-file");
      var statusEl = document.getElementById("atfrfo-ei-status");

      if (modeExportBtn) {
        modeExportBtn.addEventListener("click", function () {
          self._mode = "export";
          self._render();
        });
      }
      if (modeImportBtn) {
        modeImportBtn.addEventListener("click", function () {
          self._mode = "import";
          self._render();
        });
      }
      if (formatSelect) {
        formatSelect.addEventListener("change", function () {
          if (FORMATS[formatSelect.value]) {
            self._format = formatSelect.value;
            self._render();
          } else {
            // "coming soon" row selected — revert, no-op.
            formatSelect.value = self._format;
          }
        });
      }
      if (cancelBtn) {
        cancelBtn.addEventListener("click", function () {
          ATFRFO.Modal.close();
        });
      }
      if (fileInput && statusEl) {
        fileInput.addEventListener("change", function () {
          var hasFile = !!fileInput.files[0];
          // Don't also echo the filename here — the native file input
          // already shows it right next to "Choose File" on its own; a
          // second copy underneath was pure duplication. statusEl is kept
          // for error/status messages only (e.g. "Invalid JSON…", "Please
          // choose a file first.").
          statusEl.textContent = "";
          if (goBtn) {
            goBtn.disabled = !hasFile;
          }
        });
      }
      if (goBtn) {
        goBtn.addEventListener("click", function () {
          if (self._mode === "export") {
            self._runExport();
          } else {
            self._runImport(fileInput, statusEl);
          }
        });
      }
    },

    // ------------------------------------------------------------------
    // EXPORT
    // ------------------------------------------------------------------

    _runExport: function () {
      if (this._format === "elementor-v4") {
        this._exportElementorV4();
      } else if (this._format === "bricks") {
        this._exportGenericJson("bricks", "atfrfo_export_bricks");
      } else if (this._format === "figma") {
        this._exportGenericJson("figma", "atfrfo_export_figma");
      } else {
        this._exportAtfrfo();
      }
    },

    _exportAtfrfo: function () {
      if (!ATFRFO.state.currentFile && ATFRFO.state.variables.length === 0) {
        ATFRFO.Modal.open({
          title: "Nothing to export",
          body: "<p>Load or create a project first.</p>",
        });
        return;
      }

      var exportName = (ATFRFO.state.projectName || "aff-project")
        .trim()
        .replace(/(?:\.eff)+(?:\.json)?$/i, "");
      var suggestedName = _buildExportFilename(exportName, null, "json");

      var payload = {
        version: "1.0",
        name: exportName || "",
        config: ATFRFO.state.config || {},
        variables: ATFRFO.state.variables || [],
        classes: ATFRFO.state.classes || [],
        components: ATFRFO.state.components || [],
        metadata: { exported_at: new Date().toISOString() },
      };
      var json = JSON.stringify(payload, null, 2);
      var blob = new Blob([json], { type: "application/json" });

      _saveBlob(blob, suggestedName, "export-atfrfo", "application/json", "json");
      ATFRFO.Modal.close();
    },

    /**
     * Recombine AFF's own split Numbers storage (bare number in `value`,
     * unit token in `format`, e.g. "320" + "PX") back into a single CSS
     * value string ("320px") that an external tool can actually read.
     * Exact same logic as atfrfo-panel-right.js's `_executeCommit` uses for
     * the live Elementor write-back — reused via the shared
     * ATFRFO.FORMAT_UNITS map rather than re-implemented here. Colors and
     * Fonts are already stored as full CSS-ready strings, so they pass
     * through unchanged; FX-format Numbers (clamp()/calc() expressions)
     * are also already a full expression string, so they're left alone too.
     *
     * Every cross-platform export (Elementor v4, Bricks, Figma) must send
     * this, not the raw ATFRFO.state.variables — sending the bare "320"
     * with no unit produces a meaningless value for the destination tool.
     * Found 2026-09-01 as the mirror-image of the import-side bug where
     * imported combined values weren't being split into this format at all.
     *
     * @returns {Array} Shallow-copied variables with `value` CSS-combined.
     */
    _variablesForCrossPlatformExport: function () {
      return (ATFRFO.state.variables || []).map(function (v) {
        var copy = Object.assign({}, v);
        if (v.subgroup === "Numbers" && v.format !== "FX") {
          var unit = (ATFRFO.FORMAT_UNITS && ATFRFO.FORMAT_UNITS[v.format]) || "";
          var numMatch = (v.value || "").match(/^(-?[\d.]+)/);
          copy.value = numMatch ? numMatch[1] + unit : v.value || "";
        }
        return copy;
      });
    },

    _exportElementorV4: function () {
      if (!ATFRFO.state.variables || ATFRFO.state.variables.length === 0) {
        ATFRFO.Modal.open({
          title: "Nothing to export",
          body: "<p>This project has no variables yet.</p>",
        });
        return;
      }

      var kitTitle = (ATFRFO.state.projectName || "aff-export").trim();
      var suggestedName = _buildExportFilename(kitTitle, "elementor4", "zip");
      var goBtn = document.getElementById("atfrfo-ei-go");
      if (goBtn) {
        goBtn.disabled = true;
        goBtn.textContent = "Exporting…";
      }

      ATFRFO.App.ajax("atfrfo_export_elementor_v4", {
        variables: JSON.stringify(this._variablesForCrossPlatformExport()),
        kit_title: kitTitle,
      })
        .then(function (res) {
          if (!res.success) {
            ATFRFO.Modal.open({
              title: "Export error",
              body: "<p>" + ((res.data && res.data.message) || "Could not export.") + "</p>",
            });
            return;
          }
          var blob = _base64ToBlob(res.data.zip_base64, "application/zip");
          _saveBlob(blob, suggestedName, "export-elementor-v4", "application/zip", "zip");
          ATFRFO.Modal.close();
        })
        .catch(function () {
          ATFRFO.Modal.open({
            title: "Export error",
            body: "<p>Network error during export.</p>",
          });
        });
    },

    /**
     * Export via one of the plain-JSON (no zip) formats — Bricks or Figma.
     * Both AJAX endpoints return the pre-built JSON text directly, so this
     * just wraps it in a Blob and hands it to the same save flow every
     * other format uses.
     *
     * @param {string} platform   "bricks" | "figma" — used for the filename's platform token.
     * @param {string} ajaxAction "atfrfo_export_bricks" | "atfrfo_export_figma".
     */
    _exportGenericJson: function (platform, ajaxAction) {
      if (!ATFRFO.state.variables || ATFRFO.state.variables.length === 0) {
        ATFRFO.Modal.open({
          title: "Nothing to export",
          body: "<p>This project has no variables yet.</p>",
        });
        return;
      }

      var exportName = (ATFRFO.state.projectName || "aff-export").trim();
      var suggestedName = _buildExportFilename(exportName, platform, "json");
      var goBtn = document.getElementById("atfrfo-ei-go");
      if (goBtn) {
        goBtn.disabled = true;
        goBtn.textContent = "Exporting…";
      }

      ATFRFO.App.ajax(ajaxAction, {
        variables: JSON.stringify(this._variablesForCrossPlatformExport()),
      })
        .then(function (res) {
          if (!res.success) {
            ATFRFO.Modal.open({
              title: "Export error",
              body: "<p>" + ((res.data && res.data.message) || "Could not export.") + "</p>",
            });
            return;
          }
          var blob = new Blob([res.data.json], { type: "application/json" });
          _saveBlob(blob, suggestedName, "export-" + platform, "application/json", "json");
          ATFRFO.Modal.close();
        })
        .catch(function () {
          ATFRFO.Modal.open({
            title: "Export error",
            body: "<p>Network error during export.</p>",
          });
        });
    },

    // ------------------------------------------------------------------
    // IMPORT
    // ------------------------------------------------------------------

    _runImport: function (fileInput, statusEl) {
      if (!fileInput || !fileInput.files || !fileInput.files[0]) {
        if (statusEl) {
          statusEl.textContent = "Please choose a file first.";
        }
        return;
      }
      var file = fileInput.files[0];

      var modeInput = document.querySelector('input[name="atfrfo-ei-mode"]:checked');
      var clearMode = !!(modeInput && modeInput.value === "clear");

      if (this._format === "elementor-v4") {
        this._importElementorV4(file, statusEl, clearMode);
      } else if (this._format === "bricks" || this._format === "figma") {
        this._importGenericJson(this._format, file, statusEl, clearMode);
      } else {
        this._importAtfrfo(file, statusEl);
      }
    },

    _importAtfrfo: function (file, statusEl) {
      var self = this;
      var reader = new FileReader();
      reader.onload = function (e) {
        self._applyAtfrfoImport(e.target.result, statusEl);
      };
      reader.readAsText(file);
    },

    /**
     * Parse and load an imported AFF project (.json, or a legacy
     * .atfrfo.json export) text string into app state.
     * Fully replaces the current project — same behaviour as before this
     * module existed.
     *
     * @param {string}          text     Raw JSON string.
     * @param {HTMLElement|null} statusEl Element to write error messages into.
     */
    _applyAtfrfoImport: function (text, statusEl) {
      var parsed;
      try {
        parsed = JSON.parse(text);
      } catch (err) {
        if (statusEl) {
          statusEl.textContent = "Invalid JSON — could not parse file.";
        }
        return;
      }
      if (!parsed || typeof parsed !== "object") {
        if (statusEl) {
          statusEl.textContent = "File does not look like an AFF project.";
        }
        return;
      }

      // A Bricks/Elementor/Figma export can also have a top-level
      // "variables" array (Bricks' own export shape is literally
      // { variables: [...], categories: [...], styleManager: {} }), so
      // Array.isArray(parsed.variables) alone doesn't prove this is really
      // an AFF file — it would silently accept a foreign file with no
      // error, loading Bricks/Elementor/Figma-shaped entries as if they
      // were AFF variables (no type/subgroup, and for Bricks specifically,
      // duplicate empty-value "palette:" entries sharing names with the
      // real ones, silently masking them in any later merge/conflict
      // check). Found 2026-09-01 from a real "wrong format selected"
      // import. `config` is a reliable AFF-only marker — always present
      // (even if empty) in every AFF export, absent from every other
      // format's export.
      if (!parsed.config || typeof parsed.config !== "object") {
        if (statusEl) {
          statusEl.textContent =
            "File does not look like an AFF project — choose the matching format above instead (Elementor v4 / Bricks / Figma) if this file came from one of those.";
        }
        return;
      }

      ATFRFO.state.variables = Array.isArray(parsed.variables) ? parsed.variables : [];
      ATFRFO.state.classes = Array.isArray(parsed.classes) ? parsed.classes : [];
      ATFRFO.state.components = Array.isArray(parsed.components) ? parsed.components : [];
      ATFRFO.state.config = parsed.config && typeof parsed.config === "object" ? parsed.config : {};

      // Normalize variables that lack type/subgroup (e.g. exported before these
      // fields were added, or imported from an external source).
      ATFRFO.state.variables.forEach(function (v) {
        if (!v || typeof v !== "object" || v.type) {
          return;
        }
        var cls = ATFRFO.Utils.classifyVar(v.value, "");
        v.type = cls.type;
        v.subgroup = v.subgroup || cls.subgroup;
        if (!v.format) {
          v.format = cls.format;
        }
      });

      var importedName = (parsed.name || "").replace(/(?:\.eff)+(?:\.json)?$/i, "");
      ATFRFO.state.projectName = importedName;

      if (ATFRFO.PanelRight && ATFRFO.PanelRight._filenameInput) {
        ATFRFO.PanelRight._filenameInput.value = importedName;
      }

      ATFRFO.App.refreshCounts();
      if (ATFRFO.PanelLeft) {
        ATFRFO.PanelLeft.refresh();
      }
      if (ATFRFO.state.currentSelection && ATFRFO.EditSpace) {
        ATFRFO.EditSpace.loadCategory(ATFRFO.state.currentSelection);
      }
      ATFRFO.App.setDirty(true);
      ATFRFO.App.fetchUsageCounts();
      ATFRFO.Modal.close();
    },

    /**
     * Upload an Elementor v4 kit .zip or lone global-variables.json to
     * atfrfo_import_elementor_v4, then merge the result into the current
     * project (does not replace it — see _applyElementorV4Import).
     *
     * @param {File} file
     * @param {HTMLElement|null} statusEl
     * @param {boolean} clearMode When true, remove all existing variables before merging in the import.
     */
    _importElementorV4: function (file, statusEl, clearMode) {
      var self = this;
      if (statusEl) {
        statusEl.textContent = "Reading file…";
      }

      var formData = new FormData();
      formData.append("action", "atfrfo_import_elementor_v4");
      formData.append("nonce", ATFRFOData.nonce);
      formData.append("import_file", file);

      fetch(ATFRFOData.ajaxUrl, {
        method: "POST",
        credentials: "same-origin",
        body: formData,
      })
        .then(function (response) {
          if (!response.ok) {
            throw new Error("HTTP " + response.status);
          }
          return response.json();
        })
        .then(function (res) {
          if (!res.success) {
            if (statusEl) {
              statusEl.textContent = (res.data && res.data.message) || "Import failed.";
            }
            return;
          }
          self._applyImportedVariables("elementor-v4", res.data.variables || [], res.data.warning || "", clearMode);
        })
        .catch(function () {
          if (statusEl) {
            statusEl.textContent = "Network error during import.";
          }
        });
    },

    /**
     * Upload a Bricks or Figma JSON file's text content to the matching
     * import endpoint, then merge the result the same way Elementor v4
     * import does (see _applyImportedVariables). Both formats are plain
     * JSON (no zip), so this reads the file as text client-side and posts
     * it directly, unlike the Elementor v4 path's multipart file upload.
     *
     * @param {string} format    "bricks" | "figma" — selects the AJAX action and id field.
     * @param {File}   file
     * @param {HTMLElement|null} statusEl
     * @param {boolean} clearMode When true, remove all existing variables before merging in the import.
     */
    _importGenericJson: function (format, file, statusEl, clearMode) {
      var self = this;
      var action = format === "bricks" ? "atfrfo_import_bricks" : "atfrfo_import_figma";
      if (statusEl) {
        statusEl.textContent = "Reading file…";
      }
      var reader = new FileReader();
      reader.onload = function (e) {
        ATFRFO.App.ajax(action, { json_text: e.target.result })
          .then(function (res) {
            if (!res.success) {
              if (statusEl) {
                statusEl.textContent = (res.data && res.data.message) || "Import failed.";
              }
              return;
            }
            self._applyImportedVariables(format, res.data.variables || [], "", clearMode);
          })
          .catch(function () {
            if (statusEl) {
              statusEl.textContent = "Network error during import.";
            }
          });
      };
      reader.readAsText(file);
    },

    // Which AFF field carries each format's round-trip id, if any.
    _ID_FIELD_BY_FORMAT: {
      "elementor-v4": "elementor_id",
      bricks: "bricks_id",
      figma: null, // DTCG tokens have no stable id concept — matched by name only.
    },

    /**
     * Merge externally-imported variables (already AFF-shaped by the
     * relevant adapter) into ATFRFO.state.variables, reusing the same
     * conflict-resolution dialog the Sync modal uses for its own V4 import
     * (ATFRFO.Merge, 'fetch' direction) rather than building a separate
     * conflict UI per format.
     *
     * New variables are pushed without an `id` — matching how any other
     * brand-new, not-yet-saved AFF variable looks before its first save
     * round-trip assigns one (see atfrfo-variables.js `_addVariable`).
     *
     * @param {string} format  "elementor-v4" | "bricks" | "figma".
     * @param {Array}  elVars  AFF-shaped records from the matching adapter's from_*() method.
     * @param {string} warning Non-blocking warning (Elementor version mismatch, etc.), or ''.
     * @param {boolean} clearMode When true, remove all existing variables first — everything
     *   in elVars then partitions as "new" and 0 conflicts, matching the same
     *   "Clear and replace" behavior the Sync modal's own V4 import uses
     *   (atfrfo-panel-right.js: `if (clearMode) { ATFRFO.state.variables = []; }`).
     */
    /**
     * Classify one imported variable, filling in type/subgroup/format and
     * splitting a combined CSS value ("320px") into AFF's own storage
     * convention (bare number "320" + format "PX") — regardless of whether
     * the adapter already set type/subgroup (Bricks leaves them blank;
     * Elementor v4/Figma set them). Must run on every imported variable
     * BEFORE conflict detection, not just on ones that end up "new" — see
     * the comment where this is called in _applyImportedVariables for why.
     *
     * @param {Object} v Raw AFF-shaped record from an adapter's from_*() method.
     * @returns {Object} Shallow copy with type/subgroup/format/value normalized.
     */
    _classifyImportedVariable: function (v) {
      var cls = ATFRFO.Utils.classifyVar(v.value || "", "");
      var type = v.type || cls.type;
      var subgroup = v.subgroup || cls.subgroup;
      var varFormat = cls.format;
      var value = cls.storeValue;

      if (!subgroup) {
        // classifyVar() doesn't recognize a CSS var(--other-name) reference
        // (found 2026-09-01: 7 of 154 real Bricks/Core Framework variables
        // were exactly this — e.g. "header-space: var(--space-s)") as any
        // known pattern, so it comes back empty here. Rather than leave the
        // variable with no subgroup at all — which means it renders under
        // NONE of Colors/Numbers/Fonts, not even Uncategorized, i.e.
        // invisible — default it into Numbers, the closest fit for the real
        // cases seen (spacing/size aliases). Not universally correct (a
        // var() reference could alias a color), but strictly better than an
        // import that silently drops variables with no warning. classifyVar()
        // left storeValue/format untouched for this case (isNumber was
        // false), so value/format here still correctly fall through as the
        // original unsplit string / "".
        type = "number";
        subgroup = "Numbers";
      }

      var copy = Object.assign({}, v);
      copy.type = type || "";
      copy.subgroup = subgroup || "";
      copy.format = varFormat || "";
      copy.value = value;
      return copy;
    },

    /**
     * Find the real "Uncategorized" category for a subgroup, so an imported
     * variable always gets a category_id that actually exists in this
     * project — see the comment inside _applyImportedVariables for why this
     * is required, not just nice-to-have.
     *
     * @param {string} subgroup "Colors" | "Numbers" | "Fonts" | anything else (treated as Fonts, AFF's own generic catch-all).
     * @returns {{ name: string, id: string }}
     */
    _resolveUncategorized: function (subgroup) {
      if (subgroup === "Colors" && ATFRFO.Colors && ATFRFO.Colors._ensureUncategorized) {
        // Colors seeds/persists its own category list lazily on first view —
        // force it now so the list is guaranteed populated even if the user
        // never opened the Colors view this session.
        ATFRFO.Colors._ensureUncategorized();
      }

      var cfg = ATFRFO.state.config || {};
      var list;
      if (subgroup === "Colors") {
        list = cfg.categories || [];
      } else if (subgroup === "Numbers") {
        list = cfg.numberCategories || [];
      } else {
        list = cfg.fontCategories || [];
      }

      var found = list.filter(function (c) {
        return c.name === "Uncategorized";
      })[0];

      return found ? { name: found.name, id: found.id } : { name: "Uncategorized", id: "" };
    },
    _applyImportedVariables: function (format, elVars, warning, clearMode) {
      var idField = this._ID_FIELD_BY_FORMAT[format] || null;
      if (clearMode) {
        ATFRFO.state.variables = [];
      }

      // Normalize every imported value BEFORE building the conflict
      // partition, not after — classifying only partition.newVars (the old
      // approach) left the conflict-detection comparison itself comparing a
      // combined CSS string ("320px") against AFF's own split bare-number
      // convention ("320"), so every single Numbers variable registered as
      // a false conflict purely from the unit suffix, even when the
      // underlying value was identical. Found 2026-09-02 from a real merge
      // against a previously-imported copy of the same Bricks data — every
      // variable "conflicted" with itself.
      var normalizedElVars = elVars.map(function (v) {
        return ATFRFO.ExportImport._classifyImportedVariable(v);
      });

      var partition = ATFRFO.Merge.buildConflictList(normalizedElVars, ATFRFO.state.variables);

      var finish = function (resolutions) {
        partition.newVars.forEach(function (v) {
          // v is already fully normalized (type/subgroup/format/value) —
          // partition was built from normalizedElVars, not the raw elVars.
          var rec = {
            name: v.name,
            value: v.value,
            type: v.type || "",
            subgroup: v.subgroup || "",
            format: v.format || "",
            source: format + "-import",
            status: "new",
          };

          // A variable needs a category_id matching a REAL category to show
          // up anywhere in the left panel at all — an imported category name
          // that doesn't exist in this AFF project (e.g. Bricks' own
          // "Core Framework") matches nothing and the variable silently
          // renders nowhere, even though it's really in ATFRFO.state.variables
          // (found 2026-09-01: a real Bricks import reported "163 imported"
          // successfully but nothing appeared under Colors/Numbers/Fonts).
          // Always resolve to that subgroup's real "Uncategorized" category.
          var uncat = ATFRFO.ExportImport._resolveUncategorized(v.subgroup);
          rec.category = uncat.name;
          rec.category_id = uncat.id;

          if (idField && v[idField]) {
            rec[idField] = v[idField];
          }
          ATFRFO.state.variables.push(rec);
        });

        if (resolutions) {
          resolutions.forEach(function (r) {
            if (r.winner !== "el") {
              return;
            }
            var target = ATFRFO.state.variables.filter(function (v) {
              return (v.name || "").toLowerCase() === r.name;
            })[0];
            var source = normalizedElVars.filter(function (v) {
              return (v.name || "").toLowerCase() === r.name;
            })[0];
            if (target && source) {
              target.value = source.value;
              target.format = source.format || "";
              if (idField && source[idField]) {
                target[idField] = source[idField];
              }
            }
          });
        }

        // Backfill the round-trip id on already-matching variables too, when
        // missing — fixes the same read-path ID-blindness this import path
        // exists to address, for variables that didn't need a value change.
        if (idField) {
          partition.matchVars.forEach(function (v) {
            var target = ATFRFO.state.variables.filter(function (x) {
              return (x.name || "").toLowerCase() === (v.name || "").toLowerCase();
            })[0];
            if (target && !target[idField] && v[idField]) {
              target[idField] = v[idField];
            }
          });
        }

        ATFRFO.App.refreshCounts();
        if (ATFRFO.PanelLeft) {
          ATFRFO.PanelLeft.refresh();
        }
        if (ATFRFO.state.currentSelection && ATFRFO.EditSpace) {
          ATFRFO.EditSpace.loadCategory(ATFRFO.state.currentSelection);
        }
        ATFRFO.App.setDirty(true);
        ATFRFO.App.fetchUsageCounts();
        ATFRFO.Modal.close();

        var msg =
          partition.newVars.length +
          " new, " +
          partition.matchVars.length +
          " unchanged" +
          (resolutions ? ", " + resolutions.length + " resolved" : "") +
          ".";
        ATFRFO.Modal.open({
          title: "Import complete",
          body: "<p>" + msg + "</p>" + (warning ? '<p style="color:var(--atfrfo-clr-link)">' + warning + "</p>" : ""),
        });
      };

      if (partition.conflictVars.length > 0) {
        var sourceLabel = this._SOURCE_LABEL_BY_FORMAT[format] || "Elementor";
        ATFRFO.Merge.openMergeDialog(partition.conflictVars, "fetch", finish, null, sourceLabel);
      } else {
        finish(null);
      }
    },

    // Real source-platform name for the merge dialog's column header and
    // "Use all …" button — openMergeDialog defaults to "Elementor" (its
    // original, only caller before this feature existed was the Sync
    // modal's own Elementor-only import), which is wrong for Bricks/Figma.
    _SOURCE_LABEL_BY_FORMAT: {
      "elementor-v4": "Elementor",
      bricks: "Bricks",
      figma: "Figma",
    },
  };
})();
