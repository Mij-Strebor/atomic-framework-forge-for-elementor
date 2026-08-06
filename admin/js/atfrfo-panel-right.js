/**
 * ATFRFO Panel Right — Data Management Controls and Asset Counts
 *
 * Manages:
 *  - Active Project section (name input, Save Changes indicator, Open / Switch Project)
 *  - Save section (Save Project)
 *  - Elementor 4 Sync section (Fetch Elementor Data, Write to Elementor)
 *  - Export / Import section (bound via atfrfo-panel-top.js by element ID)
 *  - Live asset count display (variables, classes, components)
 *
 * @package ElementorFrameworkForge
 */

/* global ATFRFOData */
(function () {
  "use strict";

  window.ATFRFO = window.ATFRFO || {};

  // Number-format → CSS unit map. Single source of truth for both the
  // conflict-check preview (_openCommitSummaryDialog) and the actual commit
  // payload (_executeCommit) — previously duplicated as _FMT and FORMAT_UNIT
  // (tech debt DP-02, consolidated 2026-08-02).
  var ATFRFO_FORMAT_UNITS = {
    PX: "px",
    "%": "%",
    EM: "em",
    REM: "rem",
    VW: "vw",
    VH: "vh",
    CH: "ch",
  };

  ATFRFO.PanelRight = {
    /** @type {HTMLInputElement|null} */
    _filenameInput: null,
    /** @type {HTMLElement|null} */
    _projectNameEl: null,
    /** @type {HTMLElement|null} */
    _saveChangesBtn: null,
    /** @type {string|null} Current project slug shown in Level 2 picker */
    _pickerCurrentSlug: null,

    /**
     * Initialize the right panel.
     */
    init: function () {
      this._filenameInput  = document.getElementById("atfrfo-filename");
      this._projectNameEl  = document.getElementById("atfrfo-project-name");
      this._saveChangesBtn = document.getElementById("atfrfo-btn-save-changes");

      // Initialise the brand project name from state set before panel init.
      if (ATFRFO.state.projectName) {
        this._setProjectName(ATFRFO.state.projectName);
      }

      this._bindSaveChangesBtn();
      this._bindFilenameInput();
    },

    // ------------------------------------------------------------------
    // PROJECT NAME DISPLAY
    // ------------------------------------------------------------------

    _setProjectName: function (name) {
      ATFRFO.state.projectName = name;
      if (this._projectNameEl) {
        this._projectNameEl.textContent = name || "";
      }
      if (this._filenameInput) {
        this._filenameInput.value = name || "";
      }
    },

    // ------------------------------------------------------------------
    // FILENAME INPUT — keep ATFRFO.state.projectName in sync
    // ------------------------------------------------------------------

    _bindFilenameInput: function () {
      if (!this._filenameInput) {
        return;
      }
      var self = this;
      this._filenameInput.addEventListener("input", function () {
        ATFRFO.state.projectName = self._filenameInput.value.trim();
      });
      this._filenameInput.addEventListener("focus", function () {
        this.select();
      });
    },

    // ------------------------------------------------------------------
    // LOAD FILE
    // ------------------------------------------------------------------


    /**
     * Execute an AJAX load for the given file path.
     * path can be a relative backup path (slug/slug_date.eff.json) or legacy flat name.
     *
     * @param {string} path  File path passed directly to the server.
     */
    _loadFile: function (path) {
      var self = this;

      ATFRFO.App.ajax("atfrfo_load_file", { filename: path })
        .then(function (res) {
          if (res.success) {
            // Tech debt DP-03: the ~40 lines below that apply the server response to
            // ATFRFO.state are duplicated verbatim in _autoLoadFile. The only differences
            // are that _loadFile closes the modal, clears dirty state, and shows a toast.
            // When fixing DP-03, extract this block to a shared _applyLoadedData(res, opts).
            ATFRFO.state.variables = res.data.data.variables || [];
            ATFRFO.Utils.migrateUnclassifiedVars(ATFRFO.state.variables);
            ATFRFO.state.classes = res.data.data.classes || [];
            ATFRFO.state.components = res.data.data.components || [];
            ATFRFO.state.metadata = res.data.data.metadata || {};
            var _oldGroups = ATFRFO.state.config && ATFRFO.state.config.groups;
            ATFRFO.state.config = res.data.data.config || {};
            if (!ATFRFO.state.config.groups && _oldGroups) {
              ATFRFO.state.config.groups = _oldGroups;
            }
            // Preserve Phase 2 category arrays from globalConfig when the file's
            // config doesn't have them (e.g. older files saved before categories existed).
            if (ATFRFO.state.globalConfig) {
              var _gc = ATFRFO.state.globalConfig;
              if (
                (!ATFRFO.state.config.categories ||
                  !ATFRFO.state.config.categories.length) &&
                _gc.categories &&
                _gc.categories.length
              ) {
                ATFRFO.state.config.categories = _gc.categories.slice();
              }
              if (
                (!ATFRFO.state.config.fontCategories ||
                  !ATFRFO.state.config.fontCategories.length) &&
                _gc.fontCategories &&
                _gc.fontCategories.length
              ) {
                ATFRFO.state.config.fontCategories = _gc.fontCategories.slice();
              }
              if (
                (!ATFRFO.state.config.numberCategories ||
                  !ATFRFO.state.config.numberCategories.length) &&
                _gc.numberCategories &&
                _gc.numberCategories.length
              ) {
                ATFRFO.state.config.numberCategories =
                  _gc.numberCategories.slice();
              }
            }
            ATFRFO.state.currentFile = res.data.filename;

            // Prefer the name stored in the project's config, then fall back to
            // the project slug (first path component only — never use the full
            // relative path, which would cascade into an ever-growing slug on save).
            var displayName =
              (res.data.data.config && res.data.data.config.projectName) ||
              (res.data.filename || path || "")
                .split("/")[0]
                .replace(/(?:\.atfrfo|\.eff)+(?:\.json)?$/i, "");
            self._setProjectName(displayName);

            ATFRFO.App.refreshCounts();
            if (ATFRFO.PanelLeft) {
              ATFRFO.PanelLeft.refresh();
            }
            ATFRFO.App.setDirty(false);
            ATFRFO.Modal.close();

            // Persist last loaded filename so auto-load can restore it on next open.
            ATFRFO.App.ajax("atfrfo_save_settings", {
              settings: JSON.stringify({ last_file: res.data.filename }),
            }).catch(function () {
              console.warn("[ATFRFO] Could not persist last_file setting.");
            });

            if (res.data.created) {
              self._showToast("Project created");
            }

            // Scan widget usage for loaded variables (async, non-blocking).
            ATFRFO.App.fetchUsageCounts();
          } else {
            ATFRFO.Modal.open({
              title: "Load error",
              body: "<p>" + (res.data.message || "Unknown error.") + "</p>",
            });
          }
        })
        .catch(function () {
          ATFRFO.Modal.open({
            title: "Load error",
            body: "<p>Network error while loading.</p>",
          });
        });
    },

    /**
     * Silently load a file on startup (no dirty flag, no modal on failure).
     * Used for auto-loading the last opened file.
     *
     * @param {string} filename  Stored .atfrfo.json filename (not a project name).
     */
    _autoLoadFile: function (filename) {
      var self = this;

      ATFRFO.App.ajax("atfrfo_load_file", { filename: filename })
        .then(function (res) {
          if (res.success) {
            // Tech debt DP-03: this ~40-line state assignment block is duplicated from
            // _loadFile above. The only difference is that _autoLoadFile is silent on
            // failure (no modal, no dirty-flag reset). Extract to _applyLoadedData(res, opts).
            ATFRFO.state.variables = res.data.data.variables || [];
            ATFRFO.Utils.migrateUnclassifiedVars(ATFRFO.state.variables);
            ATFRFO.state.classes = res.data.data.classes || [];
            ATFRFO.state.components = res.data.data.components || [];
            ATFRFO.state.metadata = res.data.data.metadata || {};
            var _oldGroupsAL = ATFRFO.state.config && ATFRFO.state.config.groups;
            ATFRFO.state.config = res.data.data.config || {};
            if (!ATFRFO.state.config.groups && _oldGroupsAL) {
              ATFRFO.state.config.groups = _oldGroupsAL;
            }
            // Preserve Phase 2 category arrays from globalConfig when the file's
            // config doesn't have them (e.g. older files saved before categories existed).
            if (ATFRFO.state.globalConfig) {
              var _gcAL = ATFRFO.state.globalConfig;
              if (
                (!ATFRFO.state.config.categories ||
                  !ATFRFO.state.config.categories.length) &&
                _gcAL.categories &&
                _gcAL.categories.length
              ) {
                ATFRFO.state.config.categories = _gcAL.categories.slice();
              }
              if (
                (!ATFRFO.state.config.fontCategories ||
                  !ATFRFO.state.config.fontCategories.length) &&
                _gcAL.fontCategories &&
                _gcAL.fontCategories.length
              ) {
                ATFRFO.state.config.fontCategories = _gcAL.fontCategories.slice();
              }
              if (
                (!ATFRFO.state.config.numberCategories ||
                  !ATFRFO.state.config.numberCategories.length) &&
                _gcAL.numberCategories &&
                _gcAL.numberCategories.length
              ) {
                ATFRFO.state.config.numberCategories =
                  _gcAL.numberCategories.slice();
              }
            }
            ATFRFO.state.currentFile = res.data.filename;

            var displayName =
              (res.data.data.config && res.data.data.config.projectName) ||
              (res.data.filename || "")
                .split("/")[0]
                .replace(/(?:\.atfrfo|\.eff)+(?:\.json)?$/i, "");
            self._setProjectName(displayName);

            ATFRFO.App.refreshCounts();
            if (ATFRFO.PanelLeft) {
              ATFRFO.PanelLeft.refresh();
            }
            ATFRFO.App.fetchUsageCounts();
          }
          // Silent on failure — user will see empty state as expected.
        })
        .catch(function () {
          // Silent on network error at startup.
        });
    },

    // ------------------------------------------------------------------
    // SAVE FILE
    // ------------------------------------------------------------------

    /**
     * Execute an AJAX save for the given project name.
     * Derives the filename from the human name via _getFilename().
     *
     * @param {string} name  Human-readable project name.
     */
    _saveFile: function (name) {
      var self = this;
      // Strip extensions, then take only the first path component so a
      // relative file path (e.g. slug/slug_timestamp.atfrfo.json) never
      // cascades into an ever-growing slug on successive saves.
      var cleanName = (name || "")
        .trim()
        .replace(/(?:\.atfrfo|\.eff)+(?:\.json)?$/i, "")
        .split("/")[0]
        .trim();
      var data = {
        version: "1.0",
        name: cleanName,
        config: ATFRFO.state.config,
        variables: ATFRFO.state.variables,
        classes: ATFRFO.state.classes,
        components: ATFRFO.state.components,
        // Persist metadata (includes elementor_snapshot) so snapshot survives
        // manual saves and page reloads — without this, EV4 deletions are lost.
        metadata: ATFRFO.state.metadata || {},
      };

      ATFRFO.App.ajax("atfrfo_save_file", {
        project_name: cleanName,
        data: JSON.stringify(data),
      })
        .then(function (res) {
          if (res.success) {
            ATFRFO.state.currentFile = res.data.filename;
            self._setProjectName(cleanName);
            // Sync variables back so any empty-id placeholders are replaced
            // with the UUID-assigned copies that php wrote to disk.
            if (res.data.variables) {
              ATFRFO.state.variables = res.data.variables;
            }
            ATFRFO.App.setDirty(false);
            // Keep last_file in sync so auto-load restores the correct project.
            ATFRFO.App.ajax("atfrfo_save_settings", {
              settings: JSON.stringify({ last_file: res.data.filename }),
            }).catch(function () {
              console.warn("[ATFRFO] Could not persist last_file setting.");
            });
          } else {
            ATFRFO.Modal.open({
              title: "Save error",
              body: "<p>" + (res.data.message || "Unknown error.") + "</p>",
            });
          }
        })
        .catch(function () {
          ATFRFO.Modal.open({
            title: "Save error",
            body: "<p>Network error while saving.</p>",
          });
        });
    },

    // ------------------------------------------------------------------
    // SAVE CHANGES BUTTON
    // ------------------------------------------------------------------

    _bindSaveChangesBtn: function () {
      if (!this._saveChangesBtn) {
        return;
      }
      var self = this;

      this._saveChangesBtn.addEventListener("click", function () {
        if (ATFRFO.state.hasUnsavedChanges) {
          var name =
            (self._filenameInput ? self._filenameInput.value.trim() : "") ||
            ATFRFO.state.projectName ||
            "";
          if (name) {
            self._saveFile(name);
          }
        }
      });
    },

    /**
     * Update the Save Changes button state.
     * Disabled when no unsaved changes exist.
     * Shows "Saving…" and stays disabled while per-variable saves are in-flight
     * (pendingSaveCount > 0) to prevent a full file save over stale state.
     */
    updateSaveChangesBtn: function () {
      if (!this._saveChangesBtn) {
        return;
      }

      var isPending = ATFRFO.state.pendingSaveCount > 0;
      var isDirty   = ATFRFO.state.hasUnsavedChanges;

      if (isDirty && !isPending) {
        this._saveChangesBtn.classList.add("atfrfo-icon-btn--dirty");
        this._saveChangesBtn.setAttribute("aria-label", "Save Changes \u2014 unsaved changes pending");
      } else {
        this._saveChangesBtn.classList.remove("atfrfo-icon-btn--dirty");
        this._saveChangesBtn.setAttribute("aria-label", "Save Changes");
      }
    },

    // ------------------------------------------------------------------
    // PROJECT PICKER MODAL — Two-level navigator
    // ------------------------------------------------------------------

    /**
     * Open the project picker: fetch project list and show Level 1.
     */
    _openProjectPicker: function () {
      var self = this;
      self._pickerCurrentSlug = null;

      ATFRFO.App.ajax("atfrfo_list_projects", {})
        .then(function (res) {
          if (res.success) {
            ATFRFO.Modal.open({
              title: "Project Manager",
              body: "",
              footer: "",
              className: "atfrfo-modal--wide",
            });
            self._showProjectList(res.data.projects || []);
          } else {
            ATFRFO.Modal.open({
              title: "Error",
              body:
                "<p>" +
                (res.data.message || "Could not load projects.") +
                "</p>",
            });
          }
        })
        .catch(function () {
          ATFRFO.Modal.open({
            title: "Error",
            body: "<p>Network error loading project list.</p>",
          });
        });
    },

    /**
     * Render Level 1 — project list.
     * @param {Array} projects  [{slug, name, backup_count, latest_modified}]
     */
    _showProjectList: function (projects) {
      var self = this;
      var modalBody = document.getElementById("atfrfo-modal-body");
      if (!modalBody) {
        return;
      }

      // Always restore the correct title — error modals can leave a stale one.
      var titleEl = document.getElementById("atfrfo-modal-title");
      if (titleEl) {
        titleEl.textContent = "Project Manager";
      }

      modalBody.innerHTML = self._buildProjectListBody(projects);

      function pickerL1(e) {
        // Open project → Level 2
        var openBtn = e.target.closest(".atfrfo-picker-open-project");
        if (openBtn) {
          var slug = openBtn.getAttribute("data-slug");
          self._pickerCurrentSlug = slug;
          ATFRFO.App.ajax("atfrfo_list_backups", { project_slug: slug }).then(
            function (res) {
              if (res.success) {
                self._showBackupList(slug, res.data.backups || []);
              }
            },
          );
          cleanup();
          return;
        }

        // Create button — clear state, start fresh project
        if (e.target.id === "atfrfo-picker-create-btn") {
          var nameInput = document.getElementById("atfrfo-picker-name-input");
          var newName = nameInput ? nameInput.value.trim() : "";
          if (!newName) {
            if (nameInput) {
              nameInput.focus();
            }
            return;
          }
          ATFRFO.Modal.close();
          cleanup();

          // Clear all project data for a genuinely blank new project.
          ATFRFO.state.variables = [];
          ATFRFO.state.classes = [];
          ATFRFO.state.components = [];
          ATFRFO.state.config = {};
          ATFRFO.state.currentFile = null;
          self._setProjectName(newName);
          ATFRFO.App.setDirty(false);
          ATFRFO.App.refreshCounts();
          if (ATFRFO.PanelLeft) {
            ATFRFO.PanelLeft.refresh();
          }
          self._saveFile(newName);
          return;
        }

        // Copy project → show copy form
        var copyBtn = e.target.closest(".atfrfo-picker-copy-project");
        if (copyBtn) {
          var srcSlug = copyBtn.getAttribute("data-slug");
          var srcName = copyBtn.getAttribute("data-name");
          cleanup();
          self._showCopyForm(modalBody, srcSlug, srcName);
          return;
        }

        // Delete entire project folder
        var delProjBtn = e.target.closest(".atfrfo-picker-delete-project");
        if (delProjBtn) {
          var delSlug = delProjBtn.getAttribute("data-slug");
          var delName = delProjBtn.getAttribute("data-name");
          cleanup(); // Remove L1 listener before switching to confirm modal.

          var delProjHandler;
          ATFRFO.Modal.open({
            title: "Delete project?",
            body:
              "<p>Delete ALL saves for \u201c" +
              delName +
              "\u201d?</p>" +
              '<p style="margin-top:8px;color:var(--atfrfo-clr-link);font-size:var(--fs-sm)">This cannot be undone.</p>',
            footer:
              '<div style="display:flex;justify-content:flex-end;gap:8px">' +
              '<button class="atfrfo-btn atfrfo-btn--secondary" id="atfrfo-del-proj-cancel">Cancel</button>' +
              '<button class="atfrfo-btn" id="atfrfo-del-proj-confirm">Delete all saves</button>' +
              "</div>",
            onClose: function () {
              document.removeEventListener("click", delProjHandler);
            },
          });
          delProjHandler = function (e) {
            if (e.target.id === "atfrfo-del-proj-cancel") {
              document.removeEventListener("click", delProjHandler);
              self._openProjectPicker();
            } else if (e.target.id === "atfrfo-del-proj-confirm") {
              ATFRFO.Modal.close();
              document.removeEventListener("click", delProjHandler);
              ATFRFO.App.ajax("atfrfo_delete_project_folder", {
                project_slug: delSlug,
              })
                .then(function (res) {
                  if (res.success) {
                    // If the deleted project is currently loaded, clear app state.
                    var activeSlug = ATFRFO.state.currentFile
                      ? ATFRFO.state.currentFile.split("/")[0]
                      : null;
                    if (activeSlug === delSlug) {
                      ATFRFO.state.variables = [];
                      ATFRFO.state.classes = [];
                      ATFRFO.state.components = [];
                      ATFRFO.state.config = {};
                      ATFRFO.state.currentFile = null;
                      self._setProjectName("");
                      ATFRFO.App.setDirty(false);
                      ATFRFO.App.refreshCounts();
                      if (ATFRFO.PanelLeft) {
                        ATFRFO.PanelLeft.refresh();
                      }
                    }
                    ATFRFO.App.ajax("atfrfo_list_projects", {}).then(function (pr) {
                      ATFRFO.Modal.open({
                        title: "Project Manager",
                        body: "",
                        footer: "",
                        className: "atfrfo-modal--wide",
                      });
                      if (pr.success) {
                        self._showProjectList(pr.data.projects || []);
                      }
                    });
                  } else {
                    var msg =
                      res.data && res.data.message
                        ? res.data.message
                        : "Could not delete project.";
                    ATFRFO.Modal.open({
                      title: "Delete error",
                      body: "<p>" + msg + "</p>",
                    });
                  }
                })
                .catch(function () {
                  ATFRFO.Modal.open({
                    title: "Delete error",
                    body: "<p>Network error. Please try again.</p>",
                  });
                });
            }
          };
          document.addEventListener("click", delProjHandler);
          return;
        }
      }

      // Rename on blur: fire AJAX if name changed.
      function pickerL1Focusout(e) {
        var inp = e.target.closest(".atfrfo-picker-name-edit");
        if (!inp) {
          return;
        }
        var newName = inp.value.trim();
        var oldName = inp.getAttribute("data-original") || "";
        var slug = inp.getAttribute("data-slug");
        if (!newName) {
          inp.value = oldName;
          return;
        }
        if (newName === oldName) {
          return;
        }
        inp.setAttribute("data-original", newName);
        var row = inp.closest(".atfrfo-picker-row");
        if (row) {
          var cpBtn = row.querySelector(".atfrfo-picker-copy-project");
          var dlBtn = row.querySelector(".atfrfo-picker-delete-project");
          if (cpBtn) {
            cpBtn.setAttribute("data-name", newName);
          }
          if (dlBtn) {
            dlBtn.setAttribute("data-name", newName);
          }
        }
        ATFRFO.App.ajax("atfrfo_rename_project", {
          old_slug: slug,
          new_name: newName,
        })
          .then(function (res) {
            if (res.success) {
              inp.setAttribute("data-slug", res.data.new_slug);
              if (row) {
                row.setAttribute("data-slug", res.data.new_slug);
                var openBtnR = row.querySelector(".atfrfo-picker-open-project");
                var cpBtnR = row.querySelector(".atfrfo-picker-copy-project");
                var dlBtnR = row.querySelector(".atfrfo-picker-delete-project");
                if (openBtnR) {
                  openBtnR.setAttribute("data-slug", res.data.new_slug);
                }
                if (cpBtnR) {
                  cpBtnR.setAttribute("data-slug", res.data.new_slug);
                }
                if (dlBtnR) {
                  dlBtnR.setAttribute("data-slug", res.data.new_slug);
                }
              }
              // Sync active project name if it was the one renamed.
              if (ATFRFO.state.projectName === oldName) {
                self._setProjectName(newName);
              }
            } else {
              inp.value = oldName;
              inp.setAttribute("data-original", oldName);
            }
          })
          .catch(function () {
            inp.value = oldName;
            inp.setAttribute("data-original", oldName);
          });
      }

      // Enter to confirm rename; Escape to revert.
      function pickerL1Keydown(e) {
        var inp = e.target.closest(".atfrfo-picker-name-edit");
        if (!inp) {
          return;
        }
        if (e.key === "Enter") {
          e.preventDefault();
          inp.blur();
        }
        if (e.key === "Escape") {
          inp.value = inp.getAttribute("data-original") || "";
          inp.blur();
        }
      }

      function cleanup() {
        modalBody.removeEventListener("click", pickerL1);
        modalBody.removeEventListener("focusout", pickerL1Focusout);
        modalBody.removeEventListener("keydown", pickerL1Keydown);
      }

      modalBody.addEventListener("click", pickerL1);
      modalBody.addEventListener("focusout", pickerL1Focusout);
      modalBody.addEventListener("keydown", pickerL1Keydown);
    },

    /**
     * Show the copy-project form inside the modal body.
     * @param {HTMLElement} modalBody
     * @param {string}      srcSlug
     * @param {string}      srcName
     */
    _showCopyForm: function (modalBody, srcSlug, srcName) {
      var self = this;

      modalBody.innerHTML =
        '<div style="margin-bottom:12px">' +
        '<p style="margin-bottom:8px">Copy <strong>' +
        ATFRFO.Utils.escHtml(srcName) +
        "</strong> as:</p>" +
        '<div style="display:flex;gap:8px;align-items:center">' +
        '<input type="text" class="atfrfo-field-input" id="atfrfo-picker-copy-name"' +
        ' value="' +
        ATFRFO.Utils.escAttr(srcName + " (copy)") +
        '" autocomplete="off" style="flex:1">' +
        '<button class="atfrfo-btn" id="atfrfo-picker-copy-confirm">Copy</button>' +
        '<button class="atfrfo-btn" id="atfrfo-picker-copy-cancel">Cancel</button>' +
        "</div>" +
        '<p id="atfrfo-picker-copy-error" style="color:var(--atfrfo-clr-danger,#c0392b);font-size:12px;margin-top:6px;display:none"></p>' +
        "</div>";

      var nameInput = document.getElementById("atfrfo-picker-copy-name");
      if (nameInput) {
        setTimeout(function () {
          nameInput.focus();
          nameInput.select();
        }, 0);
      }

      function doCancel() {
        cleanup();
        ATFRFO.App.ajax("atfrfo_list_projects", {}).then(function (pr) {
          if (pr.success) {
            self._showProjectList(pr.data.projects || []);
          }
        });
      }

      function doConfirm() {
        var inp = document.getElementById("atfrfo-picker-copy-name");
        var errEl = document.getElementById("atfrfo-picker-copy-error");
        var newName = inp ? inp.value.trim() : "";
        if (!newName) {
          if (inp) {
            inp.focus();
          }
          return;
        }
        ATFRFO.App.ajax("atfrfo_copy_project", {
          source_slug: srcSlug,
          new_name: newName,
        })
          .then(function (res) {
            if (res.success) {
              cleanup();
              ATFRFO.App.ajax("atfrfo_list_projects", {}).then(function (pr) {
                if (pr.success) {
                  self._showProjectList(pr.data.projects || []);
                }
              });
            } else {
              var msg =
                res.data && res.data.message
                  ? res.data.message
                  : "Could not copy project.";
              if (errEl) {
                errEl.textContent = msg;
                errEl.style.display = "";
              }
            }
          })
          .catch(function () {
            var errEl2 = document.getElementById("atfrfo-picker-copy-error");
            if (errEl2) {
              errEl2.textContent = "Network error.";
              errEl2.style.display = "";
            }
          });
      }

      function copyClick(e) {
        if (e.target.id === "atfrfo-picker-copy-cancel") {
          doCancel();
          return;
        }
        if (e.target.id === "atfrfo-picker-copy-confirm") {
          doConfirm();
        }
      }

      function copyKeydown(e) {
        if (!e.target.closest("#atfrfo-picker-copy-name")) {
          return;
        }
        if (e.key === "Enter") {
          e.preventDefault();
          doConfirm();
        }
        if (e.key === "Escape") {
          doCancel();
        }
      }

      function cleanup() {
        modalBody.removeEventListener("click", copyClick);
        modalBody.removeEventListener("keydown", copyKeydown);
      }

      modalBody.addEventListener("click", copyClick);
      modalBody.addEventListener("keydown", copyKeydown);
    },

    /**
     * Render Level 2 — backup list for a project.
     * @param {string} slug
     * @param {Array}  backups  [{filename, name, modified}]
     */
    _showBackupList: function (slug, backups) {
      var self = this;
      var modalBody = document.getElementById("atfrfo-modal-body");
      if (!modalBody) {
        return;
      }

      modalBody.innerHTML = self._buildBackupListBody(slug, backups);

      modalBody.addEventListener("click", function pickerL2(e) {
        // Back button → Level 1
        if (e.target.closest(".atfrfo-picker-back")) {
          modalBody.removeEventListener("click", pickerL2);
          ATFRFO.App.ajax("atfrfo_list_projects", {}).then(function (res) {
            if (res.success) {
              self._showProjectList(res.data.projects || []);
            }
          });
          return;
        }

        // Load backup
        var loadBtn = e.target.closest(".atfrfo-picker-load");
        if (loadBtn) {
          var file = loadBtn.getAttribute("data-file");
          var rawName = (loadBtn.getAttribute("data-name") || "").replace(
            /(?:\.eff)+(?:\.json)?$/i,
            "",
          );
          ATFRFO.Modal.close();
          if (self._filenameInput) {
            self._filenameInput.value = rawName;
          }
          self._loadFile(file);
          modalBody.removeEventListener("click", pickerL2);
          return;
        }

        // Delete backup
        var delBtn = e.target.closest(".atfrfo-picker-delete");
        if (delBtn) {
          var filename = delBtn.getAttribute("data-filename");
          ATFRFO.App.ajax("atfrfo_delete_project", { filename: filename })
            .then(function (res) {
              if (res.success) {
                // Refresh Level 2; if empty, go back to Level 1.
                modalBody.removeEventListener("click", pickerL2);
                ATFRFO.App.ajax("atfrfo_list_backups", {
                  project_slug: self._pickerCurrentSlug,
                }).then(function (r) {
                  if (
                    r.success &&
                    r.data.backups &&
                    r.data.backups.length > 0
                  ) {
                    self._showBackupList(
                      self._pickerCurrentSlug,
                      r.data.backups,
                    );
                  } else {
                    ATFRFO.App.ajax("atfrfo_list_projects", {}).then(function (pr) {
                      if (pr.success) {
                        self._showProjectList(pr.data.projects || []);
                      }
                    });
                  }
                });
              } else {
                ATFRFO.Modal.open({
                  title: "Delete error",
                  body:
                    "<p>" + (res.data.message || "Could not delete.") + "</p>",
                });
              }
            })
            .catch(function () {});
          return;
        }
      });
    },

    /**
     * Build Level 1 HTML — project rows + create section.
     * @param {Array} projects
     * @returns {string}
     */
    _buildProjectListBody: function (projects) {
      var self = this;
      var trashSvg =
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="13" height="13" fill="currentColor">' +
        '<path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5.5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>' +
        '<path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>' +
        "</svg>";
      var copySvg =
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="13" height="13" fill="currentColor">' +
        '<path d="M4 2a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V2zm2-1a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1H6zM2 5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-1h1v1a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h1v1H2z"/>' +
        "</svg>";
      var openSvg =
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="14" height="14" fill="currentColor">' +
        '<path d="M1 3.5A1.5 1.5 0 0 1 2.5 2h2.764c.958 0 1.76.56 2.311 1.184C7.985 3.648 8.48 4 9 4h4.5A1.5 1.5 0 0 1 15 5.5v7a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 1 12.5v-9zm8.5.5c-.68 0-1.363-.378-1.949-1H2.5A.5.5 0 0 0 2 3.5V5h12v-.5a.5.5 0 0 0-.5-.5H9.5zM2 6v6.5a.5.5 0 0 0 .5.5h11a.5.5 0 0 0 .5-.5V6H2z"/>' +
        "</svg>";

      var html =
        '<p style="font-size:12px;color:var(--atfrfo-clr-muted);margin:0 0 12px">' +
        "Open a project to browse its saves, or create a new one below. " +
        "Click the project name to rename it inline. Use the row icons to open saves, copy, or delete a project." +
        "</p>";

      if (projects.length > 0) {
        html +=
          '<div class="atfrfo-picker-header">' +
          "<span>Project name</span>" +
          '<span class="atfrfo-picker-header__saves">Saves</span>' +
          '<span class="atfrfo-picker-header__date">Last saved</span>' +
          "<span></span>" +
          "</div>" +
          '<div class="atfrfo-picker-list">';

        for (var i = 0; i < projects.length; i++) {
          var p = projects[i];
          html +=
            '<div class="atfrfo-picker-row" data-slug="' +
            ATFRFO.Utils.escAttr(p.slug) +
            '">' +
            '<input type="text" class="atfrfo-field-input atfrfo-picker-name-edit"' +
            ' value="' +
            ATFRFO.Utils.escAttr(p.name) +
            '"' +
            ' data-original="' +
            ATFRFO.Utils.escAttr(p.name) +
            '"' +
            ' data-slug="' +
            ATFRFO.Utils.escAttr(p.slug) +
            '"' +
            ' aria-label="Project name">' +
            '<span class="atfrfo-picker-row__saves">' +
            ATFRFO.Utils.escHtml(String(p.backup_count)) +
            "</span>" +
            '<span class="atfrfo-picker-row__date">' +
            ATFRFO.Utils.escHtml(p.latest_modified_ts ? self._fmtTs(p.latest_modified_ts) : (p.latest_modified || '')) +
            "</span>" +
            '<div class="atfrfo-picker-row__actions">' +
            '<button class="atfrfo-icon-btn atfrfo-picker-open-project"' +
            ' data-slug="' +
            ATFRFO.Utils.escAttr(p.slug) +
            '"' +
            ' aria-label="Open project" data-atfrfo-tooltip="Open project">' +
            openSvg +
            "</button>" +
            '<button class="atfrfo-icon-btn atfrfo-picker-copy-project"' +
            ' data-slug="' +
            ATFRFO.Utils.escAttr(p.slug) +
            '"' +
            ' data-name="' +
            ATFRFO.Utils.escAttr(p.name) +
            '"' +
            ' aria-label="Copy project" data-atfrfo-tooltip="Copy project">' +
            copySvg +
            "</button>" +
            '<button class="atfrfo-icon-btn atfrfo-picker-delete-project"' +
            ' data-slug="' +
            ATFRFO.Utils.escAttr(p.slug) +
            '"' +
            ' data-name="' +
            ATFRFO.Utils.escAttr(p.name) +
            '"' +
            ' aria-label="Delete project" data-atfrfo-tooltip="Delete all saves">' +
            trashSvg +
            "</button>" +
            "</div>" +
            "</div>";
        }

        html += "</div>"; // .atfrfo-picker-list
      } else {
        html +=
          '<p class="atfrfo-text-muted" style="padding:8px 0">No saved projects found.</p>';
      }

      html +=
        '<div class="atfrfo-picker-create">' +
        '<input type="text" class="atfrfo-field-input" id="atfrfo-picker-name-input"' +
        ' placeholder="New project name\u2026" autocomplete="off" />' +
        '<button class="atfrfo-btn" id="atfrfo-picker-create-btn">Create</button>' +
        "</div>";

      var _storageNote =
        typeof ATFRFOData !== "undefined" && ATFRFOData.uploadUrl
          ? ATFRFOData.uploadUrl.replace(/^https?:\/\/[^/]+/, "")
          : "wp-content/uploads/atfrfo/";
      html +=
        '<p style="font-size:11px;color:var(--atfrfo-clr-muted);margin-top:12px;padding-top:8px;border-top:1px solid var(--atfrfo-clr-border)">' +
        'Files stored in: <code style="user-select:all">' +
        _storageNote +
        "</code></p>";

      return html;
    },

    /**
     * Build Level 2 HTML — back bar + backup rows.
     * @param {string} slug
     * @param {Array}  backups  [{filename, name, modified}]
     * @returns {string}
     */
    _buildBackupListBody: function (slug, backups) {
      var self = this;
      var trashSvg =
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="13" height="13" fill="currentColor">' +
        '<path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5.5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>' +
        '<path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>' +
        "</svg>";

      var html =
        '<div class="atfrfo-picker-back-bar">' +
        '<button class="atfrfo-icon-btn atfrfo-picker-back" aria-label="Back to projects">\u2190</button>' +
        "<span>" +
        ATFRFO.Utils.escHtml(slug) +
        "</span>" +
        "</div>";

      if (backups.length > 0) {
        html +=
          '<div class="atfrfo-picker-backup-header">' +
          "<span>Saved</span>" +
          '<span class="atfrfo-picker-backup-header__vars">Variables</span>' +
          "<span></span>" +
          "</div>" +
          '<div class="atfrfo-picker-list">';

        for (var i = 0; i < backups.length; i++) {
          var b = backups[i];
          var varCount =
            typeof b.variable_count === "number" ? b.variable_count : "";
          html +=
            '<div class="atfrfo-picker-backup-row">' +
            '<span class="atfrfo-picker-backup-row__date">' +
            ATFRFO.Utils.escHtml(b.modified_ts ? self._fmtTs(b.modified_ts) : (b.modified || '')) +
            "</span>" +
            '<span class="atfrfo-picker-backup-row__vars">' +
            (varCount !== "" ? ATFRFO.Utils.escHtml(String(varCount)) : "") +
            "</span>" +
            '<div class="atfrfo-picker-row__actions">' +
            '<button class="atfrfo-btn atfrfo-btn--xs atfrfo-picker-load"' +
            ' data-name="' +
            ATFRFO.Utils.escAttr(b.name) +
            '"' +
            ' data-file="' +
            ATFRFO.Utils.escAttr(b.filename) +
            '">Load</button>' +
            '<button class="atfrfo-icon-btn atfrfo-picker-delete"' +
            ' data-filename="' +
            ATFRFO.Utils.escAttr(b.filename) +
            '"' +
            ' aria-label="Delete backup" data-atfrfo-tooltip="Delete this backup">' +
            trashSvg +
            "</button>" +
            "</div>" +
            "</div>";
        }

        html += "</div>"; // .atfrfo-picker-list
      } else {
        html +=
          '<p class="atfrfo-text-muted" style="padding:8px 0">No backups found.</p>';
      }

      return html;
    },

    // ------------------------------------------------------------------
    // ELEMENTOR SYNC — pull variables and classes from Elementor
    // ------------------------------------------------------------------

    // ------------------------------------------------------------------
    // SYNC MODAL — unified V3 / V4 import and export wizard
    // Opened by the Sync button in the top toolbar.
    // ------------------------------------------------------------------

    /**
     * Open the Sync modal wizard.
     * Public — called by ATFRFO.PanelTop when the toolbar Sync button is clicked.
     */
    openSyncModal: function () {
      var self = this;
      var handler;

      var warnings = [
        "Beta — staging sites only. Sync reads from and writes to your Elementor kit data directly. A failed write could affect your V3 or V4 variable data. Always have a current backup before proceeding.",
        "Warning: Sync operations modify live kit data. Run this on a local or staging site only — never on production. Verify your UpdraftPlus backup before clicking Synchronize.",
        "Caution: This feature is in beta. Importing replaces or extends your AFF variables and classes. Exporting writes directly to Elementor’s stored kit. One bad sync can break your site’s design tokens.",
        "Beta reminder: Sync is a two-way bridge to Elementor’s internal data. If something goes wrong, your backup is the only recovery path. Confirm you have one before continuing.",
        "Heads up: Sync is in beta and edge cases exist. Color format mismatches, missing kit saves, or version drift between Elementor and AFF can cause unexpected results. Test on staging first.",
      ];
      var warningText = warnings[Math.floor(Math.random() * warnings.length)];

      function getBody() {
        var ver  = document.querySelector('input[name="atfrfo-sync-ver"]:checked');
        var dir  = document.querySelector('input[name="atfrfo-sync-dir"]:checked');
        var verV = ver ? ver.value : "v4";
        var dirV = dir ? dir.value : "import";

        var modeSection = "";
        if (dirV === "import" && verV === "v4") {
          // V4 import also syncs Classes alongside Variables (no separate
          // Classes control — see atfrfo-classes.js header comment). Classes
          // has no "clear and replace" mode of its own; that option only
          // affects Variables, called out explicitly below so it isn't
          // assumed to also wipe Classes.
          modeSection =
            '<div class="atfrfo-sync-section">' +
            '<div class="atfrfo-sync-section__label">Import mode</div>' +
            '<label class="atfrfo-sync-radio">' +
            '<input type="radio" name="atfrfo-sync-mode" value="name" checked />' +
            "<span><strong>Sync by name</strong>" +
            '<span class="atfrfo-sync-hint">Add new variables and classes; keep existing AFF values unchanged. Safe for incremental updates.</span></span>' +
            "</label>" +
            '<label class="atfrfo-sync-radio">' +
            '<input type="radio" name="atfrfo-sync-mode" value="clear" />' +
            "<span><strong>Clear and replace</strong>" +
            '<span class="atfrfo-sync-hint">Remove all existing variables and import fresh from Elementor. Discards AFF edits. Classes are not affected by this option — classes always sync non-destructively.</span></span>' +
            "</label>" +
            "</div>";
        } else if (dirV === "import" && verV === "v3") {
          modeSection =
            '<div class="atfrfo-sync-section">' +
            '<div class="atfrfo-sync-section__label">Import mode</div>' +
            '<label class="atfrfo-sync-radio">' +
            '<input type="radio" name="atfrfo-sync-mode" value="name" checked />' +
            "<span><strong>Sync by name</strong>" +
            '<span class="atfrfo-sync-hint">Add new variables; keep existing AFF values unchanged. Safe for incremental updates.</span></span>' +
            "</label>" +
            '<label class="atfrfo-sync-radio">' +
            '<input type="radio" name="atfrfo-sync-mode" value="clear" />' +
            "<span><strong>Clear and replace</strong>" +
            '<span class="atfrfo-sync-hint">Remove all existing variables and import fresh from Elementor. Discards AFF edits.</span></span>' +
            "</label>" +
            "</div>";
        } else if (verV === "v3" && dirV === "export") {
          modeSection =
            '<div class="atfrfo-sync-section">' +
            '<p class="atfrfo-sync-hint" style="margin:0">Export ATFRFO data to Elementor V3 is not yet available in this release.</p>' +
            "</div>";
        }

        return (
          // Beta warning — random message picked at modal open time
          '<div class="atfrfo-sync-warning">' +
          '<div class="atfrfo-sync-warning__icon">&#9888;</div>' +
          '<div class="atfrfo-sync-warning__text">' +
          ATFRFO.Utils.escHtml(warningText) +
          "</div>" +
          "</div>" +
          // Version toggle
          '<div class="atfrfo-sync-section">' +
          '<div class="atfrfo-sync-section__label">Elementor version</div>' +
          '<div class="atfrfo-sync-toggle">' +
          '<span class="atfrfo-sync-toggle__label">V3</span>' +
          '<label class="atfrfo-toggle-switch">' +
          '<input type="checkbox" id="atfrfo-sync-ver-switch" ' + (verV === "v4" ? "checked" : "") + ' />' +
          '<span class="atfrfo-toggle-switch__track"><span class="atfrfo-toggle-switch__thumb"></span></span>' +
          "</label>" +
          '<span class="atfrfo-sync-toggle__label">V4</span>' +
          '<input type="radio" name="atfrfo-sync-ver" value="v3" style="display:none" ' + (verV !== "v4" ? "checked" : "") + ' />' +
          '<input type="radio" name="atfrfo-sync-ver" value="v4" style="display:none" ' + (verV === "v4" ? "checked" : "") + ' />' +
          "</div>" +
          "</div>" +
          // Direction toggle
          '<div class="atfrfo-sync-section">' +
          '<div class="atfrfo-sync-section__label">Direction</div>' +
          '<div class="atfrfo-sync-toggle">' +
          '<span class="atfrfo-sync-toggle__label">Import</span>' +
          '<label class="atfrfo-toggle-switch">' +
          '<input type="checkbox" id="atfrfo-sync-dir-switch" ' + (dirV === "export" ? "checked" : "") + ' />' +
          '<span class="atfrfo-toggle-switch__track"><span class="atfrfo-toggle-switch__thumb"></span></span>' +
          "</label>" +
          '<span class="atfrfo-sync-toggle__label">Export</span>' +
          '<input type="radio" name="atfrfo-sync-dir" value="import" style="display:none" ' + (!dirV || dirV === "import" ? "checked" : "") + ' />' +
          '<input type="radio" name="atfrfo-sync-dir" value="export" style="display:none" ' + (dirV === "export" ? "checked" : "") + ' />' +
          "</div>" +
          "</div>" +
          modeSection
        );
      }

      function getFooter() {
        return (
          '<div style="display:flex;justify-content:flex-end;gap:8px">' +
          '<button class="atfrfo-btn atfrfo-btn--secondary" id="atfrfo-sync-cancel">Cancel</button>' +
          '<button class="atfrfo-btn" id="atfrfo-sync-go">Synchronize</button>' +
          "</div>"
        );
      }

      function rerender() {
        var body = document.getElementById("atfrfo-modal-body");
        var foot = document.getElementById("atfrfo-modal-footer");
        if (!body || !foot) { return; }
        body.innerHTML = getBody();
        foot.innerHTML = getFooter();
        bindInner();
      }

      function bindInner() {
        var verSwitchEl = document.getElementById("atfrfo-sync-ver-switch");
        var dirSwitchEl = document.getElementById("atfrfo-sync-dir-switch");

        if (verSwitchEl) {
          verSwitchEl.addEventListener("change", function () {
            var v3Radio = document.querySelector('input[name="atfrfo-sync-ver"][value="v3"]');
            var v4Radio = document.querySelector('input[name="atfrfo-sync-ver"][value="v4"]');
            if (verSwitchEl.checked) {
              if (v4Radio) { v4Radio.checked = true; }
            } else {
              if (v3Radio) { v3Radio.checked = true; }
            }
            rerender();
          });
        }

        if (dirSwitchEl) {
          dirSwitchEl.addEventListener("change", function () {
            var importRadio = document.querySelector('input[name="atfrfo-sync-dir"][value="import"]');
            var exportRadio = document.querySelector('input[name="atfrfo-sync-dir"][value="export"]');
            if (dirSwitchEl.checked) {
              if (exportRadio) { exportRadio.checked = true; }
            } else {
              if (importRadio) { importRadio.checked = true; }
            }
            rerender();
          });
        }
      }

      ATFRFO.Modal.open({
        title: "Sync with Elementor",
        body: getBody(),
        footer: getFooter(),
        onClose: function () {
          document.removeEventListener("click", handler);
        },
      });

      bindInner();

      handler = function (e) {
        if (e.target.id === "atfrfo-sync-cancel") {
          ATFRFO.Modal.close();
          document.removeEventListener("click", handler);
          return;
        }

        if (e.target.id === "atfrfo-sync-go") {
          var ver = document.querySelector('input[name="atfrfo-sync-ver"]:checked');
          var dir = document.querySelector('input[name="atfrfo-sync-dir"]:checked');
          var verV = ver ? ver.value : "v4";
          var dirV = dir ? dir.value : "import";

          document.removeEventListener("click", handler);
          ATFRFO.Modal.close();

          if (verV === "v4" && dirV === "import") {
            var modeInput = document.querySelector('input[name="atfrfo-sync-mode"]:checked');
            var clearMode = modeInput && modeInput.value === "clear";
            if (clearMode) { ATFRFO.state.variables = []; }
            if (ATFRFO.PanelTop && ATFRFO.PanelTop._syncFromElementor) {
              ATFRFO.PanelTop._syncFromElementor({ clearMode: clearMode });
            }
            // Classes syncs alongside Variables here, not via any Classes-
            // specific control — no V3 Classes concept, so this only ever
            // fires for V4 + Import. clearMode does not apply to Classes
            // (see the mode-section hint above); it always syncs
            // non-destructively regardless of the Variables mode chosen.
            if (ATFRFO.Classes && ATFRFO.Classes.syncFromElementor) {
              ATFRFO.Classes.syncFromElementor();
            }

          } else if (verV === "v4" && dirV === "export") {
            self._showWriteSafetyGate(function () {
              self._openCommitSummaryDialog();
            });

          } else if (verV === "v3" && dirV === "import") {
            var v3ModeInput = document.querySelector('input[name="atfrfo-sync-mode"]:checked');
            var v3ClearMode = v3ModeInput && v3ModeInput.value === "clear";
            self._executeV3Import({ clearMode: v3ClearMode });

          } else if (verV === "v3" && dirV === "export") {
            ATFRFO.Modal.open({
              title: "Not available",
              body: "<p>Export to Elementor V3 is not yet implemented. This feature is planned for a future release.</p>",
            });
          }
        }
      };
      document.addEventListener("click", handler);
    },

    // ------------------------------------------------------------------
    // ELEMENTOR SYNC — commit variables to Elementor
    // ------------------------------------------------------------------


    /**
     * Show a mandatory safety confirmation before any Write to Elementor operation.
     *
     * Warns about live-site risk, backups, test coverage, and Elementor version
     * mismatches.  Calls onConfirm() only when the user explicitly accepts.
     *
     * @param {Function} onConfirm  Called when user clicks "I Understand – Continue".
     */
    _showWriteSafetyGate: function (onConfirm) {
      var d = typeof ATFRFOData !== "undefined" ? ATFRFOData : {};
      var elV = d.elVersion || "?";
      var elP = d.elProVersion || null;
      var devV = d.elDevVersion || "?";
      var devP = d.elProDevVersion || "?";

      // Detect version mismatches.
      var elMismatch = elV !== "?" && elV !== devV;
      var proMismatch = elP !== null && elP !== devP;

      var versionNote = "";
      if (elMismatch || proMismatch) {
        versionNote =
          '<div style="margin-top:10px;padding:8px 10px;border-left:3px solid #e53e3e;background:rgba(229,62,62,.08);font-size:12px">' +
          '<strong style="color:#e53e3e">Version mismatch detected</strong><br>';
        if (elMismatch) {
          versionNote +=
            "Elementor: running <strong>" +
            ATFRFO.Utils.escHtml(elV) +
            "</strong>, developed on <strong>" +
            ATFRFO.Utils.escHtml(devV) +
            "</strong>.<br>";
        }
        if (proMismatch) {
          versionNote +=
            "Elementor Pro: running <strong>" +
            ATFRFO.Utils.escHtml(elP) +
            "</strong>, developed on <strong>" +
            ATFRFO.Utils.escHtml(devP) +
            "</strong>.<br>";
        }
        versionNote +=
          "Internal Elementor data structures may have changed. Verify on staging before using on any real site.</div>";
      }

      var body =
        '<ul style="margin:0 0 10px 16px;list-style:disc;font-size:13px;line-height:1.7">' +
        "<li><strong>Never run on a live / in-service website.</strong> Use staging or a local dev install only.</li>" +
        "<li><strong>Make a backup first.</strong> Export your Elementor kit before writing.</li>" +
        "<li>Writing to Elementor modifies the kit post meta directly. A failed write could corrupt variable data.</li>" +
        "</ul>" +
        versionNote;

      var handler;
      ATFRFO.Modal.open({
        title: "\uD83D\uDED1 Stop, Before You Write To Elementor",
        body: body,
        footer:
          '<div style="display:flex;justify-content:flex-end;gap:8px">' +
          '<button class="atfrfo-btn atfrfo-btn--secondary" id="atfrfo-safety-cancel">Cancel</button>' +
          '<button class="atfrfo-btn" id="atfrfo-safety-confirm">I Understand \u2013 Continue</button>' +
          "</div>",
        onClose: function () {
          document.removeEventListener("click", handler);
        },
      });

      handler = function (e) {
        if (e.target.id === "atfrfo-safety-cancel") {
          ATFRFO.Modal.close();
          document.removeEventListener("click", handler);
        } else if (e.target.id === "atfrfo-safety-confirm") {
          ATFRFO.Modal.close();
          document.removeEventListener("click", handler);
          onConfirm();
        }
      };
      document.addEventListener("click", handler);
    },

    /**
     * Build a summary of pending variable changes and open a confirmation dialog.
     */
    _openCommitSummaryDialog: function () {
      var self = this;
      var modified = 0;
      var added = 0;
      var deleted = 0;

      for (var i = 0; i < ATFRFO.state.variables.length; i++) {
        var s = ATFRFO.state.variables[i].status;
        if (s === "modified") {
          modified++;
        } else if (s === "new") {
          added++;
        } else if (s === "deleted") {
          deleted++;
        }
      }

      // Count snapshot-based EV4 deletions: labels that were in the last fetch
      // but are no longer in ATFRFO.  These are not tracked by variable status —
      // the variable is simply gone from the array — so they must be counted
      // separately to prevent the "Nothing to commit" guard from blocking writes
      // whose only purpose is removing stale variables from Elementor.
      var _snapshot =
        ATFRFO.state.metadata && ATFRFO.state.metadata.elementor_snapshot
          ? ATFRFO.state.metadata.elementor_snapshot
          : [];
      var _currentNamesLc = ATFRFO.state.variables.map(function (v) {
        return (v.name || "").toLowerCase();
      });
      var ev4DeleteCount = _snapshot.filter(function (lbl) {
        return _currentNamesLc.indexOf((lbl || "").toLowerCase()) === -1;
      }).length;

      var total = modified + added + deleted + ev4DeleteCount;

      if (total === 0) {
        ATFRFO.Modal.open({
          title: "Nothing to commit",
          body: "<p>All variables are already in sync with Elementor. No changes to commit.</p>",
        });
        return;
      }

      // Pre-check: fetch Elementor's current values to detect conflicts before
      // letting the user confirm the write. Variables with status 'new' are never
      // conflicts — they don't exist in Elementor yet and are always written.
      ATFRFO.Modal.open({
        title: "Checking for conflicts\u2026",
        body: '<p style="color:var(--atfrfo-clr-muted)">Reading Elementor variables\u2026</p>',
      });

      ATFRFO.App.ajax("atfrfo_sync_from_elementor", {})
        .then(function (res) {
          ATFRFO.Modal.close();

          var elVars =
            res.success && res.data && res.data.variables
              ? res.data.variables
              : [];

          // Exclude 'new' variables from conflict checking — they're always written.
          // Normalize Number values to their CSS form (e.g. '9' + 'rem' → '9rem') so
          // the comparison matches what ATFRFO will write to Elementor — preventing false
          // conflicts when the user stored a bare numeric value with a separate format.
          var candidateVars = ATFRFO.state.variables
            .filter(function (v) {
              return v.status !== "new";
            })
            .map(function (v) {
              if (v.subgroup === "Numbers" && v.format !== "FX") {
                var unit = ATFRFO_FORMAT_UNITS[v.format] || "";
                var m = (v.value || "").match(/^(-?[\d.]+)/);
                var css = m ? m[1] + unit : v.value;
                // Return a shallow copy with the CSS value — do not mutate state.
                return {
                  name: v.name,
                  value: css,
                  status: v.status,
                  subgroup: v.subgroup,
                  format: v.format,
                  type: v.type,
                };
              }
              return v;
            });
          var partition = ATFRFO.Merge.buildConflictList(elVars, candidateVars);

          if (partition.conflictVars.length > 0) {
            // Show merge dialog. On apply, build the final commit payload.
            ATFRFO.Merge.openMergeDialog(
              partition.conflictVars,
              "write",
              function (resolved) {
                // Build set of names the user chose to keep in Elementor (skip writing).
                var skipNames = {};
                resolved.forEach(function (r) {
                  if (r.winner === "el") {
                    skipNames[r.name] = true;
                  }
                });

                // Commit only the variables not in the skip set.
                var commitVars = ATFRFO.state.variables.filter(function (v) {
                  return !skipNames[(v.name || "").toLowerCase()];
                });
                self._showCommitSummary(
                  modified,
                  added,
                  deleted,
                  ev4DeleteCount,
                  commitVars,
                );
              },
              null, // Cancel — do nothing
            );
          } else {
            // No conflicts — show the standard commit summary.
            self._showCommitSummary(
              modified,
              added,
              deleted,
              ev4DeleteCount,
              ATFRFO.state.variables,
            );
          }
        })
        .catch(function () {
          // If the pre-check itself fails, skip it and proceed without conflict check.
          ATFRFO.Modal.close();
          self._showCommitSummary(
            modified,
            added,
            deleted,
            ev4DeleteCount,
            ATFRFO.state.variables,
          );
        });
    },

    /**
     * Show the commit confirmation summary dialog and trigger the commit on confirm.
     *
     * @param {number} modified       Count of modified variables
     * @param {number} added          Count of new variables
     * @param {number} deleted        Count of status-deleted variables (usually 0)
     * @param {number} ev4DeleteCount Count of variables to be removed from EV4 (snapshot diff)
     * @param {Array}  commitVars     ATFRFO variable objects to include in the commit
     */
    _showCommitSummary: function (
      modified,
      added,
      deleted,
      ev4DeleteCount,
      commitVars,
    ) {
      var self = this;
      var summaryLines = [];
      if (modified > 0) {
        summaryLines.push(modified + " modified");
      }
      if (added > 0) {
        summaryLines.push(added + " new");
      }
      if (deleted > 0) {
        summaryLines.push(deleted + " deleted");
      }
      if (ev4DeleteCount > 0) {
        summaryLines.push(ev4DeleteCount + " removed from Elementor");
      }

      var skippedCount = ATFRFO.state.variables.length - commitVars.length;
      var skippedNote =
        skippedCount > 0
          ? '<p style="font-size:12px;color:var(--atfrfo-clr-muted);margin-bottom:8px">' +
            skippedCount +
            " variable" +
            (skippedCount !== 1 ? "s" : "") +
            " excluded (Elementor value kept).</p>"
          : "";

      var commitHandler;
      ATFRFO.Modal.open({
        title: "Write to Elementor",
        body:
          '<p style="margin-bottom:8px">The following changes will be written to Elementor:</p>' +
          '<ul style="margin:0 0 12px 16px;list-style:disc">' +
          summaryLines
            .map(function (l) {
              return "<li>" + l + "</li>";
            })
            .join("") +
          "</ul>" +
          skippedNote +
          "<p style=\"font-size:12px;color:var(--atfrfo-clr-muted)\"><strong>This modifies Elementor's data.</strong> Save a backup first if you haven't already.</p>" +
          '<p style="font-size:12px;color:var(--atfrfo-clr-muted);margin-top:6px">You will need to <strong>refresh the browser page</strong> after writing to see changes in Elementor\'s Variables Manager.</p>',
        footer:
          '<div style="display:flex;justify-content:flex-end;gap:8px">' +
          '<button class="atfrfo-btn atfrfo-btn--secondary" id="atfrfo-commit-cancel">Cancel</button>' +
          '<button class="atfrfo-btn" id="atfrfo-commit-confirm">Commit</button>' +
          "</div>",
        onClose: function () {
          document.removeEventListener("click", commitHandler);
        },
      });

      commitHandler = function (e) {
        if (e.target.id === "atfrfo-commit-cancel") {
          ATFRFO.Modal.close();
          document.removeEventListener("click", commitHandler);
        } else if (e.target.id === "atfrfo-commit-confirm") {
          ATFRFO.Modal.close();
          document.removeEventListener("click", commitHandler);
          self._executeCommit(commitVars);
        }
      };
      document.addEventListener("click", commitHandler);
    },

    /**
     * Execute the commit AJAX call.
     *
     * Sends the resolved variable list to atfrfo_commit_to_elementor, then updates
     * variable statuses to 'synced' and clears the pending commit flag.
     *
     * @param {Array|undefined} commitVars  Optional resolved variable list. When
     *   omitted all ATFRFO state variables are sent (original behaviour).
     */
    _executeCommit: function (commitVars) {
      if (!ATFRFO.state.currentFile) {
        ATFRFO.Modal.open({
          title: "No file loaded",
          body: "<p>Please load a file before committing.</p>",
        });
        return;
      }

      var source = commitVars || ATFRFO.state.variables;
      // For Numbers variables the stored value is a pure number; reconstruct
      // the CSS dimension string (e.g. '16' + 'PX' → '16px') for the commit
      // payload. FX values (function expressions) are sent as-is.
      // Legacy values that already include the unit are handled by extracting
      // only the numeric prefix before re-appending the unit.
      var variables = source.map(function (v) {
        var cssValue = v.value;
        if (v.subgroup === "Numbers" && v.format !== "FX") {
          var unit = ATFRFO_FORMAT_UNITS[v.format] || "";
          var numMatch = (v.value || "").match(/^(-?[\d.]+)/);
          cssValue = numMatch ? numMatch[1] + unit : v.value;
        }
        return {
          name: v.name,
          value: cssValue,
          type: v.type || "",
          subgroup: v.subgroup || "",
          format: v.format || "",
        };
      });

      // Snapshot: labels imported from EV4 on last fetch — used server-side
      // to detect variables deleted in ATFRFO that should also be removed from EV4.
      var snapshot =
        ATFRFO.state.metadata && ATFRFO.state.metadata.elementor_snapshot
          ? ATFRFO.state.metadata.elementor_snapshot
          : [];

      ATFRFO.App.ajax("atfrfo_commit_to_elementor", {
        filename: ATFRFO.state.currentFile,
        variables: JSON.stringify(variables),
        elementor_snapshot: JSON.stringify(snapshot),
      })
        .then(function (res) {
          if (res.success) {
            var committed = res.data.committed || [];
            var created = res.data.created || [];
            var deleted = res.data.deleted || [];
            var skipped = res.data.skipped || [];

            // Update in-memory snapshot to current ATFRFO variable names so the
            // next commit correctly detects future deletions.
            if (!ATFRFO.state.metadata) {
              ATFRFO.state.metadata = {};
            }
            ATFRFO.state.metadata.elementor_snapshot = ATFRFO.state.variables.map(
              function (v) {
                return v.name;
              },
            );

            // Update variable statuses to 'synced' for committed vars BEFORE
            // saving so the file on disk reflects the post-commit state.
            var committedLc = committed.map(function (n) {
              return n.toLowerCase();
            });
            for (var i = 0; i < ATFRFO.state.variables.length; i++) {
              if (
                committedLc.indexOf(
                  (ATFRFO.state.variables[i].name || "").toLowerCase(),
                ) !== -1
              ) {
                ATFRFO.state.variables[i].status = "synced";
              }
            }

            // Persist the updated snapshot and synced statuses to disk.
            if (ATFRFO.state.currentFile && ATFRFO.state.projectName) {
              ATFRFO.App.ajax("atfrfo_save_file", {
                project_name: ATFRFO.state.projectName,
                data: JSON.stringify({
                  version: "1.0",
                  config: ATFRFO.state.config || {},
                  variables: ATFRFO.state.variables || [],
                  classes: ATFRFO.state.classes || [],
                  components: ATFRFO.state.components || [],
                  metadata: ATFRFO.state.metadata,
                }),
              })
                .then(function (sr) {
                  if (sr.success && sr.data && sr.data.filename) {
                    ATFRFO.state.currentFile = sr.data.filename;
                  }
                })
                .catch(function () {
                  console.warn("[ATFRFO] Snapshot save after commit failed.");
                });
            }

            ATFRFO.App.setPendingCommit(false);

            var msg = committed.length + " variable(s) written to Elementor.";
            if (created.length > 0) {
              msg += " " + created.length + " new.";
            }
            if (deleted.length > 0) {
              msg +=
                " " +
                deleted.length +
                " removed from Elementor: " +
                deleted.join(", ") +
                ".";
            }
            if (skipped.length > 0) {
              msg +=
                " " +
                skipped.length +
                " not found in CSS (refresh page to see all changes).";
            }
            // EV4's Variables Manager is populated from meta, not the CSS cache — a page
            // refresh is needed for the panel to show the newly written variables.
            msg +=
              " Refresh the browser page to see changes in Elementor's Variables Manager.";
            ATFRFO.Modal.open({
              title: "Commit complete",
              body: "<p>" + msg + "</p>",
            });

            // Re-render current view to show updated status dots.
            if (
              ATFRFO.Colors &&
              ATFRFO.state.currentSelection &&
              ATFRFO.state.currentSelection.subgroup === "Colors"
            ) {
              ATFRFO.Colors.loadColors(ATFRFO.state.currentSelection);
            }
          } else {
            ATFRFO.Modal.open({
              title: "Commit error",
              body:
                "<p>" +
                ((res.data && res.data.message) || "Unknown error.") +
                "</p>",
            });
          }
        })
        .catch(function () {
          ATFRFO.Modal.open({
            title: "Commit error",
            body: "<p>Network error during commit.</p>",
          });
        });
    },

    /**
     * Toggle the accent highlight on the ↑ Variables (commit) button.
     *
     * Called from ATFRFO.App.setPendingCommit(). Adds .atfrfo-btn--accent when
     * there are pending commits so the button pulses; removes it when clear.
     */
    updateCommitBtn: function () {
      if (!this._commitVariablesBtn) {
        return;
      }

      var hasPending = ATFRFO.state.hasPendingElementorCommit;
      if (hasPending) {
        this._commitVariablesBtn.classList.add("atfrfo-btn--accent");
      } else {
        this._commitVariablesBtn.classList.remove("atfrfo-btn--accent");
      }
    },

    // ------------------------------------------------------------------
    // ELEMENTOR V3 IMPORT — import V3 Global Colors
    // ------------------------------------------------------------------

    /**
     * Bind the ↓ V3 Colors button.
     *
     * STUB — intentionally not called from init(). The V3 Global Colors import
     * feature is planned but not yet shipping. The button element does not exist
     * V3 import is now triggered via openSyncModal() — this button binding
     * is retained for reference but is no longer called directly.
     */
    _bindV3ColorsBtn: function () {
      if (!this._v3ColorsBtn) {
        return;
      }
      var self = this;

      this._v3ColorsBtn.addEventListener("click", function () {
        self._openV3ImportDialog();
      });
    },

    /**
     * Open the V3 Import confirmation dialog, then execute.
     */
    _openV3ImportDialog: function () {
      var self = this;

      ATFRFO.Modal.open({
        title: "Import V3 Global Colors",
        body:
          '<p style="margin-bottom:8px">This will read the V3 Global Colors stored in your Elementor kit post meta and import them as AFFcolor variables.</p>' +
          '<p style="font-size:12px;color:var(--atfrfo-clr-muted)">Existing AFFvariables with the same name will not be overwritten. New colors will be added to <em>Uncategorized</em>.</p>',
        footer:
          '<div style="display:flex;justify-content:flex-end;gap:8px">' +
          '<button class="atfrfo-btn atfrfo-btn--secondary" id="atfrfo-v3-cancel">Cancel</button>' +
          '<button class="atfrfo-btn" id="atfrfo-v3-confirm">Import</button>' +
          "</div>",
      });

      document.addEventListener("click", function v3Handler(e) {
        if (e.target.id === "atfrfo-v3-cancel") {
          ATFRFO.Modal.close();
          document.removeEventListener("click", v3Handler);
        } else if (e.target.id === "atfrfo-v3-confirm") {
          ATFRFO.Modal.close();
          document.removeEventListener("click", v3Handler);
          self._executeV3Import();
        }
      });
    },

    /**
     * Execute the V3 colors import AJAX call.
     */
    _executeV3Import: function (options) {
      var clearMode = options && options.clearMode;

      ATFRFO.App.ajax("atfrfo_sync_v3_global_colors", {})
        .then(function (res) {
          if (res.success) {
            var imported = res.data.imported || [];

            if (clearMode) {
              ATFRFO.state.variables = ATFRFO.state.variables.filter(function (ev) {
                return ev.source !== "elementor-v3";
              });
            }

            imported.forEach(function (v, idx) {
              // Derive a CSS variable name from the human-readable title, preserving
              // original casing. Strip only apostrophes/quotes; replace other invalid
              // chars with hyphens. "Don't Use Primary" → "--Dont-Use-Primary".
              var cleanName = v.title
                ? "--" + v.title.replace(/['"]/g, "").replace(/[^a-zA-Z0-9-]+/g, "-").replace(/^-+|-+$/g, "")
                : v.elementor_var;

              var category = "Uncategorized";

              // Match by v3_var (new imports) or name (legacy imports where name = elementor_var).
              var existing = ATFRFO.state.variables.filter(function (ev) {
                return ev.v3_var === v.elementor_var || ev.name === v.elementor_var;
              });
              // Auto-populate notes for the first four V3 imports (Elementor system
              // colors: Primary, Secondary, Text, Accent) by position, not by title.
              // Titles can be renamed in Elementor and won't match; position is stable.
              var systemColorNotes = [
                "System Colors: Used for Headings and Icons",
                "System Colors: Used for List Items, Subheadings, Animated Headings, and Price Table backgrounds",
                "System Colors: Used for Paragraphs and Menu items",
                "System Colors: Used for Links, Button backgrounds, Tab and Accordion headings, and Badges",
              ];
              var autoNote = idx < systemColorNotes.length ? systemColorNotes[idx] : "";

              if (existing.length === 0) {
                ATFRFO.state.variables.push({
                  id: "",
                  name: cleanName,
                  label: v.title || "",
                  notes: autoNote,
                  v3_var: v.elementor_var,
                  value: v.value,
                  source: "elementor-v3",
                  type: "color",
                  group: "Variables",
                  subgroup: "Colors",
                  category: category,
                  category_id: "default-uncategorized",
                  modified: false,
                  status: "new",
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                });
              }
            });

            ATFRFO.App.refreshCounts();
            if (ATFRFO.Colors && ATFRFO.Colors._ensureUncategorized) {
              ATFRFO.Colors._ensureUncategorized();
            }
            if (ATFRFO.PanelLeft) {
              ATFRFO.PanelLeft.refresh();
            }
            if (imported.length > 0) {
              ATFRFO.App.setDirty(true);
            }

            var msg =
              imported.length > 0
                ? imported.length +
                  " V3 color" +
                  (imported.length !== 1 ? "s" : "") +
                  " imported."
                : "No V3 Global Colors found in the active Elementor kit.";
            ATFRFO.Modal.info("V3 Import complete", "<p>" + msg + "</p>");
          } else {
            ATFRFO.Modal.open({
              title: "V3 Import error",
              body:
                "<p>" +
                ((res.data && res.data.message) || "Unknown error.") +
                "</p>",
            });
          }
        })
        .catch(function () {
          ATFRFO.Modal.open({
            title: "V3 Import error",
            body: "<p>Network error during V3 import.</p>",
          });
        });
    },

    // ------------------------------------------------------------------
    // COUNTS
    // ------------------------------------------------------------------

    /**
     * Update the displayed asset counts.
     *
     * @param {{ variables: number, classes: number, components: number }} counts
     */
    updateCounts: function (counts) {
      this._setCount("atfrfo-count-variables", counts.variables || 0);
      this._setCount("atfrfo-count-classes", counts.classes || 0);
      this._setCount("atfrfo-count-components", counts.components || 0);
    },

    /**
     * @param {string} id    Element ID.
     * @param {number} value Count value.
     * @private
     */
    _setCount: function (id, value) {
      var el = document.getElementById(id);
      if (el) {
        el.textContent = String(value);
      }
    },

    // ------------------------------------------------------------------
    // HELPERS
    // ------------------------------------------------------------------

    /** Format a Unix timestamp (seconds) using the browser's local timezone. */
    _fmtTs: function (ts) {
      try {
        return new Date(ts * 1000).toLocaleString(undefined, {
          month: 'short', day: 'numeric',
          hour: 'numeric', minute: '2-digit',
        });
      } catch (e) {
        return '';
      }
    },

    /**
     * Show a brief toast notification.
     * Auto-dismisses after 2 seconds.
     *
     * @param {string} message
     */
    _showToast: function (message) {
      var toast = document.createElement("div");
      toast.className = "atfrfo-toast";
      toast.textContent = message;
      document.body.appendChild(toast);

      // Trigger the transition in the next frame.
      requestAnimationFrame(function () {
        toast.classList.add("atfrfo-toast--visible");
      });

      setTimeout(function () {
        toast.classList.remove("atfrfo-toast--visible");
        setTimeout(function () {
          toast.remove();
        }, 300);
      }, 2000);
    },
  };
})();
