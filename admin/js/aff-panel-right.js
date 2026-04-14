/**
 * AFF Panel Right — Data Management Controls and Asset Counts
 *
 * Manages:
 *  - Active Project section (name input, Save Changes indicator, Open / Switch Project)
 *  - Save section (Save Project)
 *  - Elementor 4 Sync section (Fetch Elementor Data, Write to Elementor)
 *  - Export / Import section (bound via aff-panel-top.js by element ID)
 *  - Live asset count display (variables, classes, components)
 *
 * @package ElementorFrameworkForge
 */

/* global AFFData */
(function () {
	'use strict';

	window.AFF= window.AFF|| {};

	AFF.PanelRight = {

		/** @type {HTMLInputElement|null} */
		_filenameInput: null,
		/** @type {HTMLElement|null} */
		_loadBtn: null,
		/** @type {HTMLElement|null} */
		_saveBtn: null,
		/** @type {HTMLElement|null} */
		_saveChangesBtn: null,
		/** @type {HTMLElement|null} */
		_syncVariablesBtn: null,
		/** @type {HTMLElement|null} */
		_commitVariablesBtn: null,
		/** @type {string|null} Current project slug shown in Level 2 picker */
		_pickerCurrentSlug: null,

		/**
		 * Initialize the right panel.
		 */
		init: function () {
			this._filenameInput       = document.getElementById('aff-filename');
			this._loadBtn             = document.getElementById('aff-btn-load');
			this._saveBtn             = document.getElementById('aff-btn-save');
			this._saveChangesBtn      = document.getElementById('aff-btn-save-changes');
			this._syncVariablesBtn    = document.getElementById('aff-btn-sync-variables');
			this._commitVariablesBtn  = document.getElementById('aff-btn-commit-variables');

			this._bindLoadBtn();
			this._bindSaveBtn();
			this._bindSaveChangesBtn();
			this._bindSyncVariablesBtn();
			this._bindCommitVariablesBtn();
			this._bindFilenameInput();
		},

		// ------------------------------------------------------------------
		// FILENAME INPUT — keep AFF.state.projectName in sync
		// ------------------------------------------------------------------

		_bindFilenameInput: function () {
			if (!this._filenameInput) { return; }
			var self = this;
			this._filenameInput.addEventListener('input', function () {
				AFF.state.projectName = self._filenameInput.value.trim();
			});
			this._filenameInput.addEventListener('focus', function () { this.select(); });
		},

		// ------------------------------------------------------------------
		// LOAD FILE
		// ------------------------------------------------------------------

		_bindLoadBtn: function () {
			if (!this._loadBtn) { return; }
			var self = this;

			this._loadBtn.addEventListener('click', function () {
				self._openProjectPicker();
			});
		},

		/**
		 * Execute an AJAX load for the given file path.
		 * path can be a relative backup path (slug/slug_date.eff.json) or legacy flat name.
		 *
		 * @param {string} path  File path passed directly to the server.
		 */
		_loadFile: function (path) {
			var self = this;

			AFF.App.ajax('aff_load_file', { filename: path })
				.then(function (res) {
					if (res.success) {
						AFF.state.variables  = res.data.data.variables  || [];
						AFF.state.classes    = res.data.data.classes    || [];
						AFF.state.components = res.data.data.components || [];
						var _oldGroups = AFF.state.config && AFF.state.config.groups;
						AFF.state.config     = res.data.data.config     || {};
						if (!AFF.state.config.groups && _oldGroups) { AFF.state.config.groups = _oldGroups; }
					// Preserve Phase 2 category arrays from globalConfig when the file's
					// config doesn't have them (e.g. older files saved before categories existed).
					if (AFF.state.globalConfig) {
						var _gc = AFF.state.globalConfig;
						if ((!AFF.state.config.categories       || !AFF.state.config.categories.length)       && _gc.categories       && _gc.categories.length)       { AFF.state.config.categories       = _gc.categories.slice(); }
						if ((!AFF.state.config.fontCategories   || !AFF.state.config.fontCategories.length)   && _gc.fontCategories   && _gc.fontCategories.length)   { AFF.state.config.fontCategories   = _gc.fontCategories.slice(); }
						if ((!AFF.state.config.numberCategories || !AFF.state.config.numberCategories.length) && _gc.numberCategories && _gc.numberCategories.length) { AFF.state.config.numberCategories = _gc.numberCategories.slice(); }
					}
						AFF.state.currentFile = res.data.filename;

						// Prefer the name stored in the project's config, then fall back to
						// the project slug (first path component only — never use the full
						// relative path, which would cascade into an ever-growing slug on save).
					var displayName = (res.data.data.config && res.data.data.config.projectName)
						|| (res.data.filename || path || '').split('/')[0].replace(/(?:\.aff|\.eff)+(?:\.json)?$/i, '');
						AFF.state.projectName = displayName;
						if (self._filenameInput) {
							self._filenameInput.value = displayName;
						}

						AFF.App.refreshCounts();
						if (AFF.PanelLeft) { AFF.PanelLeft.refresh(); }
						AFF.App.setDirty(false);
						AFF.Modal.close();

						// Persist last loaded filename so auto-load can restore it on next open.
						AFF.App.ajax('aff_save_settings', {
							settings: JSON.stringify({ last_file: res.data.filename }),
						}).catch(function () { console.warn('[AFF] Could not persist last_file setting.'); });

						if (res.data.created) {
							self._showToast('Project created');
						}

						// Scan widget usage for loaded variables (async, non-blocking).
						AFF.App.fetchUsageCounts();
					} else {
						AFF.Modal.open({ title: 'Load error', body: '<p>' + (res.data.message || 'Unknown error.') + '</p>' });
					}
				})
				.catch(function () {
					AFF.Modal.open({ title: 'Load error', body: '<p>Network error while loading.</p>' });
				});
		},

		/**
		 * Silently load a file on startup (no dirty flag, no modal on failure).
		 * Used for auto-loading the last opened file.
		 *
		 * @param {string} filename  Stored .eff.json filename (not a project name).
		 */
		_autoLoadFile: function (filename) {
			var self = this;

			AFF.App.ajax('aff_load_file', { filename: filename })
				.then(function (res) {
					if (res.success) {
						AFF.state.variables  = res.data.data.variables  || [];
						AFF.state.classes    = res.data.data.classes    || [];
						AFF.state.components = res.data.data.components || [];
						var _oldGroupsAL = AFF.state.config && AFF.state.config.groups;
						AFF.state.config     = res.data.data.config     || {};
						if (!AFF.state.config.groups && _oldGroupsAL) { AFF.state.config.groups = _oldGroupsAL; }
					// Preserve Phase 2 category arrays from globalConfig when the file's
					// config doesn't have them (e.g. older files saved before categories existed).
					if (AFF.state.globalConfig) {
						var _gcAL = AFF.state.globalConfig;
						if ((!AFF.state.config.categories       || !AFF.state.config.categories.length)       && _gcAL.categories       && _gcAL.categories.length)       { AFF.state.config.categories       = _gcAL.categories.slice(); }
						if ((!AFF.state.config.fontCategories   || !AFF.state.config.fontCategories.length)   && _gcAL.fontCategories   && _gcAL.fontCategories.length)   { AFF.state.config.fontCategories   = _gcAL.fontCategories.slice(); }
						if ((!AFF.state.config.numberCategories || !AFF.state.config.numberCategories.length) && _gcAL.numberCategories && _gcAL.numberCategories.length) { AFF.state.config.numberCategories = _gcAL.numberCategories.slice(); }
					}
						AFF.state.currentFile = res.data.filename;

						var displayName = (res.data.data.config && res.data.data.config.projectName)
							|| (res.data.filename || '').split('/')[0].replace(/(?:\.aff|\.eff)+(?:\.json)?$/i, '');
						AFF.state.projectName = displayName;
						if (self._filenameInput) {
							self._filenameInput.value = displayName;
						}

						AFF.App.refreshCounts();
						if (AFF.PanelLeft) { AFF.PanelLeft.refresh(); }
						AFF.App.fetchUsageCounts();
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

		_bindSaveBtn: function () {
			if (!this._saveBtn) { return; }
			var self = this;

			this._saveBtn.addEventListener('click', function () {
				var name = self._filenameInput ? self._filenameInput.value.trim() : '';
				if (!name) {
					AFF.Modal.open({ title: 'Name required', body: '<p>Please enter a project name before saving.</p>' });
					if (self._filenameInput) { self._filenameInput.focus(); }
					return;
				}
				self._saveFile(name);
			});
		},

		/**
		 * Execute an AJAX save for the given project name.
		 * Derives the filename from the human name via _getFilename().
		 *
		 * @param {string} name  Human-readable project name.
		 */
		_saveFile: function (name) {
			var self      = this;
			// Strip extensions, then take only the first path component so a
			// relative file path (e.g. slug/slug_timestamp.aff.json) never
			// cascades into an ever-growing slug on successive saves.
			var cleanName = (name || '').trim()
				.replace(/(?:\.aff|\.eff)+(?:\.json)?$/i, '')
				.split('/')[0]
				.trim();
			var data = {
				version:    '1.0',
				name:       cleanName,
				config:     AFF.state.config,
				variables:  AFF.state.variables,
				classes:    AFF.state.classes,
				components: AFF.state.components,
			};

			AFF.App.ajax('aff_save_file', {
				project_name: cleanName,
				data:         JSON.stringify(data),
			})
				.then(function (res) {
					if (res.success) {
						AFF.state.currentFile = res.data.filename;
						AFF.state.projectName = cleanName;
						// Sync variables back so any empty-id placeholders are replaced
						// with the UUID-assigned copies that php wrote to disk.
						if (res.data.variables) {
							AFF.state.variables = res.data.variables;
						}
						if (self._filenameInput) {
							self._filenameInput.value = cleanName;
						}
						AFF.App.setDirty(false);
						// Keep last_file in sync so auto-load restores the correct project.
						AFF.App.ajax('aff_save_settings', {
							settings: JSON.stringify({ last_file: res.data.filename }),
						}).catch(function () { console.warn('[AFF] Could not persist last_file setting.'); });
					} else {
						AFF.Modal.open({ title: 'Save error', body: '<p>' + (res.data.message || 'Unknown error.') + '</p>' });
					}
				})
				.catch(function () {
					AFF.Modal.open({ title: 'Save error', body: '<p>Network error while saving.</p>' });
				});
		},

		// ------------------------------------------------------------------
		// SAVE CHANGES BUTTON
		// ------------------------------------------------------------------

		_bindSaveChangesBtn: function () {
			if (!this._saveChangesBtn) { return; }
			var self = this;

			this._saveChangesBtn.addEventListener('click', function () {
				if (AFF.state.hasUnsavedChanges) {
					var name = (self._filenameInput ? self._filenameInput.value.trim() : '')
						|| AFF.state.projectName || '';
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
			if (!this._saveChangesBtn) { return; }

			var isPending = AFF.state.pendingSaveCount > 0;
			var isDirty   = AFF.state.hasUnsavedChanges;

			if (isPending) {
				this._saveChangesBtn.disabled         = true;
				this._saveChangesBtn.setAttribute('aria-disabled', 'true');
				this._saveChangesBtn.textContent      = 'Saving\u2026';
			} else {
				this._saveChangesBtn.disabled         = !isDirty;
				this._saveChangesBtn.setAttribute('aria-disabled', String(!isDirty));
				this._saveChangesBtn.textContent      = 'Save Changes';
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

			AFF.App.ajax('aff_list_projects', {})
				.then(function (res) {
					if (res.success) {
						AFF.Modal.open({ title: 'Load Project', body: '', footer: '', className: 'aff-modal--wide' });
						self._showProjectList(res.data.projects || []);
					} else {
						AFF.Modal.open({ title: 'Error', body: '<p>' + (res.data.message || 'Could not load projects.') + '</p>' });
					}
				})
				.catch(function () {
					AFF.Modal.open({ title: 'Error', body: '<p>Network error loading project list.</p>' });
				});
		},

		/**
		 * Render Level 1 — project list.
		 * @param {Array} projects  [{slug, name, backup_count, latest_modified}]
		 */
		_showProjectList: function (projects) {
			var self      = this;
			var modalBody = document.getElementById('aff-modal-body');
			if (!modalBody) { return; }

			modalBody.innerHTML = self._buildProjectListBody(projects);

			function pickerL1(e) {
				// Open project → Level 2
				var openBtn = e.target.closest('.aff-picker-open-project');
				if (openBtn) {
					var slug = openBtn.getAttribute('data-slug');
					self._pickerCurrentSlug = slug;
					AFF.App.ajax('aff_list_backups', { project_slug: slug })
						.then(function (res) {
							if (res.success) {
								self._showBackupList(slug, res.data.backups || []);
							}
						});
					cleanup();
					return;
				}

				// Create button — clear state, start fresh project
				if (e.target.id === 'aff-picker-create-btn') {
					var nameInput = document.getElementById('aff-picker-name-input');
					var newName   = nameInput ? nameInput.value.trim() : '';
					if (!newName) {
						if (nameInput) { nameInput.focus(); }
						return;
					}
					AFF.Modal.close();
					cleanup();

					// Clear all project data for a genuinely blank new project.
					AFF.state.variables   = [];
					AFF.state.classes     = [];
					AFF.state.components  = [];
					AFF.state.config      = {};
					AFF.state.currentFile = null;
					AFF.state.projectName = newName;
					AFF.App.setDirty(false);
					AFF.App.refreshCounts();
					if (AFF.PanelLeft) { AFF.PanelLeft.refresh(); }
					if (self._filenameInput) { self._filenameInput.value = newName; }
					self._saveFile(newName);
					return;
				}

				// Copy project → show copy form
				var copyBtn = e.target.closest('.aff-picker-copy-project');
				if (copyBtn) {
					var srcSlug = copyBtn.getAttribute('data-slug');
					var srcName = copyBtn.getAttribute('data-name');
					cleanup();
					self._showCopyForm(modalBody, srcSlug, srcName);
					return;
				}

				// Delete entire project folder
				var delProjBtn = e.target.closest('.aff-picker-delete-project');
				if (delProjBtn) {
					var delSlug = delProjBtn.getAttribute('data-slug');
					var delName = delProjBtn.getAttribute('data-name');
					if (!window.confirm('Delete ALL saves for \u201c' + delName + '\u201d? This cannot be undone.')) { return; }
					AFF.App.ajax('aff_delete_project_folder', { project_slug: delSlug })
						.then(function (res) {
							if (res.success) {
								cleanup();
								AFF.App.ajax('aff_list_projects', {}).then(function (pr) {
									if (pr.success) { self._showProjectList(pr.data.projects || []); }
								});
							} else {
								var msg = (res.data && res.data.message) ? res.data.message : 'Could not delete project.';
								AFF.Modal.open({ title: 'Delete error', body: '<p>' + msg + '</p>' });
							}
						})
						.catch(function () {});
					return;
				}
			}

			// Rename on blur: fire AJAX if name changed.
			function pickerL1Focusout(e) {
				var inp = e.target.closest('.aff-picker-name-edit');
				if (!inp) { return; }
				var newName = inp.value.trim();
				var oldName = inp.getAttribute('data-original') || '';
				var slug    = inp.getAttribute('data-slug');
				if (!newName) { inp.value = oldName; return; }
				if (newName === oldName) { return; }
				inp.setAttribute('data-original', newName);
				var row = inp.closest('.aff-picker-row');
				if (row) {
					var cpBtn = row.querySelector('.aff-picker-copy-project');
					var dlBtn = row.querySelector('.aff-picker-delete-project');
					if (cpBtn) { cpBtn.setAttribute('data-name', newName); }
					if (dlBtn) { dlBtn.setAttribute('data-name', newName); }
				}
				AFF.App.ajax('aff_rename_project', { old_slug: slug, new_name: newName })
					.then(function (res) {
						if (res.success) {
							inp.setAttribute('data-slug', res.data.new_slug);
							if (row) {
								row.setAttribute('data-slug', res.data.new_slug);
								var openBtnR = row.querySelector('.aff-picker-open-project');
								var cpBtnR   = row.querySelector('.aff-picker-copy-project');
								var dlBtnR   = row.querySelector('.aff-picker-delete-project');
								if (openBtnR) { openBtnR.setAttribute('data-slug', res.data.new_slug); }
								if (cpBtnR)   { cpBtnR.setAttribute('data-slug', res.data.new_slug); }
								if (dlBtnR)   { dlBtnR.setAttribute('data-slug', res.data.new_slug); }
							}
							// Sync active project name if it was the one renamed.
							if (AFF.state.projectName === oldName) {
								AFF.state.projectName = newName;
								if (self._filenameInput) { self._filenameInput.value = newName; }
							}
						} else {
							inp.value = oldName;
							inp.setAttribute('data-original', oldName);
						}
					})
					.catch(function () { inp.value = oldName; inp.setAttribute('data-original', oldName); });
			}

			// Enter to confirm rename; Escape to revert.
			function pickerL1Keydown(e) {
				var inp = e.target.closest('.aff-picker-name-edit');
				if (!inp) { return; }
				if (e.key === 'Enter') { e.preventDefault(); inp.blur(); }
				if (e.key === 'Escape') { inp.value = inp.getAttribute('data-original') || ''; inp.blur(); }
			}

			function cleanup() {
				modalBody.removeEventListener('click',    pickerL1);
				modalBody.removeEventListener('focusout', pickerL1Focusout);
				modalBody.removeEventListener('keydown',  pickerL1Keydown);
			}

			modalBody.addEventListener('click',    pickerL1);
			modalBody.addEventListener('focusout', pickerL1Focusout);
			modalBody.addEventListener('keydown',  pickerL1Keydown);
		},

		/**
		 * Show the copy-project form inside the modal body.
		 * @param {HTMLElement} modalBody
		 * @param {string}      srcSlug
		 * @param {string}      srcName
		 */
		_showCopyForm: function (modalBody, srcSlug, srcName) {
			var self = this;

			modalBody.innerHTML = '<div style="margin-bottom:12px">'
				+ '<p style="margin-bottom:8px">Copy <strong>' + self._escHtml(srcName) + '</strong> as:</p>'
				+ '<div style="display:flex;gap:8px;align-items:center">'
				+ '<input type="text" class="aff-field-input" id="aff-picker-copy-name"'
				+ ' value="' + self._escAttr(srcName + ' (copy)') + '" autocomplete="off" style="flex:1">'
				+ '<button class="aff-btn" id="aff-picker-copy-confirm">Copy</button>'
				+ '<button class="aff-btn" id="aff-picker-copy-cancel">Cancel</button>'
				+ '</div>'
				+ '<p id="aff-picker-copy-error" style="color:var(--aff-clr-danger,#c0392b);font-size:12px;margin-top:6px;display:none"></p>'
				+ '</div>';

			var nameInput = document.getElementById('aff-picker-copy-name');
			if (nameInput) { setTimeout(function () { nameInput.focus(); nameInput.select(); }, 0); }

			function doCancel() {
				cleanup();
				AFF.App.ajax('aff_list_projects', {}).then(function (pr) {
					if (pr.success) { self._showProjectList(pr.data.projects || []); }
				});
			}

			function doConfirm() {
				var inp    = document.getElementById('aff-picker-copy-name');
				var errEl  = document.getElementById('aff-picker-copy-error');
				var newName = inp ? inp.value.trim() : '';
				if (!newName) { if (inp) { inp.focus(); } return; }
				AFF.App.ajax('aff_copy_project', { source_slug: srcSlug, new_name: newName })
					.then(function (res) {
						if (res.success) {
							cleanup();
							AFF.App.ajax('aff_list_projects', {}).then(function (pr) {
								if (pr.success) { self._showProjectList(pr.data.projects || []); }
							});
						} else {
							var msg = (res.data && res.data.message) ? res.data.message : 'Could not copy project.';
							if (errEl) { errEl.textContent = msg; errEl.style.display = ''; }
						}
					})
					.catch(function () {
						var errEl2 = document.getElementById('aff-picker-copy-error');
						if (errEl2) { errEl2.textContent = 'Network error.'; errEl2.style.display = ''; }
					});
			}

			function copyClick(e) {
				if (e.target.id === 'aff-picker-copy-cancel') { doCancel(); return; }
				if (e.target.id === 'aff-picker-copy-confirm') { doConfirm(); }
			}

			function copyKeydown(e) {
				if (!e.target.closest('#aff-picker-copy-name')) { return; }
				if (e.key === 'Enter')  { e.preventDefault(); doConfirm(); }
				if (e.key === 'Escape') { doCancel(); }
			}

			function cleanup() {
				modalBody.removeEventListener('click',   copyClick);
				modalBody.removeEventListener('keydown', copyKeydown);
			}

			modalBody.addEventListener('click',   copyClick);
			modalBody.addEventListener('keydown', copyKeydown);
		},

		/**
		 * Render Level 2 — backup list for a project.
		 * @param {string} slug
		 * @param {Array}  backups  [{filename, name, modified}]
		 */
		_showBackupList: function (slug, backups) {
			var self     = this;
			var modalBody = document.getElementById('aff-modal-body');
			if (!modalBody) { return; }

			modalBody.innerHTML = self._buildBackupListBody(slug, backups);

			modalBody.addEventListener('click', function pickerL2(e) {
				// Back button → Level 1
				if (e.target.closest('.aff-picker-back')) {
					modalBody.removeEventListener('click', pickerL2);
					AFF.App.ajax('aff_list_projects', {})
						.then(function (res) {
							if (res.success) {
								self._showProjectList(res.data.projects || []);
							}
						});
					return;
				}

				// Load backup
				var loadBtn = e.target.closest('.aff-picker-load');
				if (loadBtn) {
					var file    = loadBtn.getAttribute('data-file');
					var rawName = (loadBtn.getAttribute('data-name') || '').replace(/(?:\.eff)+(?:\.json)?$/i, '');
					AFF.Modal.close();
					if (self._filenameInput) { self._filenameInput.value = rawName; }
					self._loadFile(file);
					modalBody.removeEventListener('click', pickerL2);
					return;
				}

				// Delete backup
				var delBtn = e.target.closest('.aff-picker-delete');
				if (delBtn) {
					var filename = delBtn.getAttribute('data-filename');
					AFF.App.ajax('aff_delete_project', { filename: filename })
						.then(function (res) {
							if (res.success) {
								// Refresh Level 2; if empty, go back to Level 1.
								modalBody.removeEventListener('click', pickerL2);
								AFF.App.ajax('aff_list_backups', { project_slug: self._pickerCurrentSlug })
									.then(function (r) {
										if (r.success && r.data.backups && r.data.backups.length > 0) {
											self._showBackupList(self._pickerCurrentSlug, r.data.backups);
										} else {
											AFF.App.ajax('aff_list_projects', {})
												.then(function (pr) {
													if (pr.success) { self._showProjectList(pr.data.projects || []); }
												});
										}
									});
							} else {
								AFF.Modal.open({ title: 'Delete error', body: '<p>' + (res.data.message || 'Could not delete.') + '</p>' });
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
			var trashSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="13" height="13" fill="currentColor">'
				+ '<path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5.5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>'
				+ '<path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>'
				+ '</svg>';
			var copySvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="13" height="13" fill="currentColor">'
				+ '<path d="M4 2a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V2zm2-1a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1H6zM2 5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-1h1v1a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h1v1H2z"/>'
				+ '</svg>';
			var openSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="14" height="14" fill="currentColor">'
				+ '<path d="M1 3.5A1.5 1.5 0 0 1 2.5 2h2.764c.958 0 1.76.56 2.311 1.184C7.985 3.648 8.48 4 9 4h4.5A1.5 1.5 0 0 1 15 5.5v7a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 1 12.5v-9zm8.5.5c-.68 0-1.363-.378-1.949-1H2.5A.5.5 0 0 0 2 3.5V5h12v-.5a.5.5 0 0 0-.5-.5H9.5zM2 6v6.5a.5.5 0 0 0 .5.5h11a.5.5 0 0 0 .5-.5V6H2z"/>'
				+ '</svg>';

			var html = '';

			if (projects.length > 0) {
				html += '<div class="aff-picker-header">'
					+ '<span>Project name</span>'
					+ '<span class="aff-picker-header__saves">Saves</span>'
					+ '<span class="aff-picker-header__date">Last saved</span>'
					+ '<span></span>'
					+ '</div>'
					+ '<div class="aff-picker-list">';

				for (var i = 0; i < projects.length; i++) {
					var p = projects[i];
					html += '<div class="aff-picker-row" data-slug="' + self._escAttr(p.slug) + '">'
						+ '<input type="text" class="aff-field-input aff-picker-name-edit"'
						+ ' value="' + self._escAttr(p.name) + '"'
						+ ' data-original="' + self._escAttr(p.name) + '"'
						+ ' data-slug="' + self._escAttr(p.slug) + '"'
						+ ' aria-label="Project name">'
						+ '<span class="aff-picker-row__saves">' + self._escHtml(String(p.backup_count)) + '</span>'
						+ '<span class="aff-picker-row__date">' + self._escHtml(p.latest_modified) + '</span>'
						+ '<div class="aff-picker-row__actions">'
						+ '<button class="aff-icon-btn aff-picker-open-project"'
						+ ' data-slug="' + self._escAttr(p.slug) + '"'
						+ ' aria-label="Open project" data-aff-tooltip="Open project">' + openSvg + '</button>'
						+ '<button class="aff-icon-btn aff-picker-copy-project"'
						+ ' data-slug="' + self._escAttr(p.slug) + '"'
						+ ' data-name="' + self._escAttr(p.name) + '"'
						+ ' aria-label="Copy project" data-aff-tooltip="Copy project">' + copySvg + '</button>'
						+ '<button class="aff-icon-btn aff-picker-delete-project"'
						+ ' data-slug="' + self._escAttr(p.slug) + '"'
						+ ' data-name="' + self._escAttr(p.name) + '"'
						+ ' aria-label="Delete project" data-aff-tooltip="Delete all saves">' + trashSvg + '</button>'
						+ '</div>'
						+ '</div>';
				}

				html += '</div>'; // .aff-picker-list
			} else {
				html += '<p class="aff-text-muted" style="padding:8px 0">No saved projects found.</p>';
			}

			html += '<div class="aff-picker-create">'
				+ '<input type="text" class="aff-field-input" id="aff-picker-name-input"'
				+ ' placeholder="New project name\u2026" autocomplete="off" />'
				+ '<button class="aff-btn" id="aff-picker-create-btn">Create</button>'
				+ '</div>';

			var _storageNote = (typeof AFFData !== 'undefined' && AFFData.uploadUrl)
				? AFFData.uploadUrl.replace(/^https?:\/\/[^/]+/, '')
				: 'wp-content/uploads/aff/';
			html += '<p style="font-size:11px;color:var(--aff-clr-muted);margin-top:12px;padding-top:8px;border-top:1px solid var(--aff-clr-border)">'
				+ 'Files stored in: <code style="user-select:all">' + _storageNote + '</code></p>';

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
			var trashSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="13" height="13" fill="currentColor">'
				+ '<path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5.5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>'
				+ '<path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>'
				+ '</svg>';

			var html = '<div class="aff-picker-back-bar">'
				+ '<button class="aff-icon-btn aff-picker-back" aria-label="Back to projects">\u2190</button>'
				+ '<span>' + self._escHtml(slug) + '</span>'
				+ '</div>';

			if (backups.length > 0) {
				html += '<div class="aff-picker-backup-header">'
					+ '<span>Saved</span>'
					+ '<span class="aff-picker-backup-header__vars">Variables</span>'
					+ '<span></span>'
					+ '</div>'
					+ '<div class="aff-picker-list">';

				for (var i = 0; i < backups.length; i++) {
					var b = backups[i];
					var varCount = typeof b.variable_count === 'number' ? b.variable_count : '';
					html += '<div class="aff-picker-backup-row">'
						+ '<span class="aff-picker-backup-row__date">' + self._escHtml(b.modified) + '</span>'
						+ '<span class="aff-picker-backup-row__vars">' + (varCount !== '' ? self._escHtml(String(varCount)) : '') + '</span>'
						+ '<div class="aff-picker-row__actions">'
						+ '<button class="aff-btn aff-btn--xs aff-picker-load"'
						+ ' data-name="' + self._escAttr(b.name) + '"'
						+ ' data-file="' + self._escAttr(b.filename) + '">Load</button>'
						+ '<button class="aff-icon-btn aff-picker-delete"'
						+ ' data-filename="' + self._escAttr(b.filename) + '"'
						+ ' aria-label="Delete backup" data-aff-tooltip="Delete this backup">'
						+ trashSvg + '</button>'
						+ '</div>'
						+ '</div>';
				}

				html += '</div>'; // .aff-picker-list
			} else {
				html += '<p class="aff-text-muted" style="padding:8px 0">No backups found.</p>';
			}

			return html;
		},

		// ------------------------------------------------------------------
		// ELEMENTOR SYNC — pull variables from Elementor
		// ------------------------------------------------------------------

		/**
		 * Bind the ↓ Variables (sync from Elementor) button.
		 * Shows a sync-options dialog before executing.
		 */
		_bindSyncVariablesBtn: function () {
			if (!this._syncVariablesBtn) { return; }
			var self = this;

			this._syncVariablesBtn.addEventListener('click', function () {
				self._openSyncOptionsDialog();
			});
		},

		/**
		 * Open the Sync Options dialog (Sync by name / Clear and replace).
		 */
		_openSyncOptionsDialog: function () {
			var syncHandler;
			AFF.Modal.open({
				title: 'Fetch Elementor Data',
				body:  '<p style="margin-bottom:12px">Choose how AFFshould handle existing variables when importing from the Elementor kit.</p>'
					+ '<div style="display:flex;flex-direction:column;gap:10px">'
					+ '<label style="display:flex;gap:10px;align-items:flex-start;cursor:pointer">'
					+ '<input type="radio" name="aff-sync-mode" value="name" checked style="margin-top:3px;flex-shrink:0" />'
					+ '<span><strong>Sync by name</strong><br>'
					+ '<span style="font-size:12px;color:var(--aff-clr-muted)">Add new variables; keep existing AFFvalues unchanged. Safe for incremental updates.</span></span>'
					+ '</label>'
					+ '<label style="display:flex;gap:10px;align-items:flex-start;cursor:pointer">'
					+ '<input type="radio" name="aff-sync-mode" value="clear" style="margin-top:3px;flex-shrink:0" />'
					+ '<span><strong>Clear and replace</strong><br>'
					+ '<span style="font-size:12px;color:var(--aff-clr-muted)">Remove all existing variables and import fresh from Elementor. Discards AFFedits.</span></span>'
					+ '</label>'
					+ '</div>',
				footer: '<div style="display:flex;justify-content:flex-end;gap:8px">'
					+ '<button class="aff-btn aff-btn--secondary" id="aff-sync-cancel">Cancel</button>'
					+ '<button class="aff-btn" id="aff-sync-confirm">Sync</button>'
					+ '</div>',
				onClose: function () { document.removeEventListener('click', syncHandler); },
			});

			syncHandler = function (e) {
				if (e.target.id === 'aff-sync-cancel') {
					AFF.Modal.close();
					document.removeEventListener('click', syncHandler);
				} else if (e.target.id === 'aff-sync-confirm') {
					var modeInput = document.querySelector('input[name="aff-sync-mode"]:checked');
					var clearMode = modeInput && modeInput.value === 'clear';
					AFF.Modal.close();
					document.removeEventListener('click', syncHandler);
					if (clearMode) {
						AFF.state.variables = [];
					}
					if (AFF.PanelTop && AFF.PanelTop._syncFromElementor) {
						AFF.PanelTop._syncFromElementor({});
					}
				}
			};
			document.addEventListener('click', syncHandler);
		},

		// ------------------------------------------------------------------
		// ELEMENTOR SYNC — commit variables to Elementor
		// ------------------------------------------------------------------

		/**
		 * Bind the ↑ Variables (commit to Elementor) button.
		 */
		_bindCommitVariablesBtn: function () {
			if (!this._commitVariablesBtn) { return; }
			var self = this;

			this._commitVariablesBtn.addEventListener('click', function () {
				self._openCommitSummaryDialog();
			});
		},

		/**
		 * Build a summary of pending variable changes and open a confirmation dialog.
		 */
		_openCommitSummaryDialog: function () {
			var self     = this;
			var modified = 0;
			var added    = 0;
			var deleted  = 0;

			for (var i = 0; i < AFF.state.variables.length; i++) {
				var s = AFF.state.variables[i].status;
				if (s === 'modified') { modified++; }
				else if (s === 'new') { added++; }
				else if (s === 'deleted') { deleted++; }
			}

			var total = modified + added + deleted;

			if (total === 0) {
				AFF.Modal.open({
					title: 'Nothing to commit',
					body:  '<p>All variables are already in sync with Elementor. No changes to commit.</p>',
				});
				return;
			}

			// Pre-check: fetch Elementor's current values to detect conflicts before
			// letting the user confirm the write. Variables with status 'new' are never
			// conflicts — they don't exist in Elementor yet and are always written.
			AFF.Modal.open({
				title: 'Checking for conflicts\u2026',
				body:  '<p style="color:var(--aff-clr-muted)">Reading Elementor variables\u2026</p>',
			});

			AFF.App.ajax('aff_sync_from_elementor', {})
				.then(function (res) {
					AFF.Modal.close();

					var elVars = (res.success && res.data && res.data.variables) ? res.data.variables : [];

					// Exclude 'new' variables from conflict checking — they're always written.
					var candidateVars = AFF.state.variables.filter(function (v) {
						return v.status !== 'new';
					});
					var partition = AFF.Merge.buildConflictList(elVars, candidateVars);

					if (partition.conflictVars.length > 0) {
						// Show merge dialog. On apply, build the final commit payload.
						AFF.Merge.openMergeDialog(
							partition.conflictVars,
							'write',
							function (resolved) {
								// Build set of names the user chose to keep in Elementor (skip writing).
								var skipNames = {};
								resolved.forEach(function (r) {
									if (r.winner === 'el') { skipNames[r.name] = true; }
								});

								// Commit only the variables not in the skip set.
								var commitVars = AFF.state.variables.filter(function (v) {
									return !skipNames[(v.name || '').toLowerCase()];
								});
								self._showCommitSummary(modified, added, deleted, commitVars);
							},
							null // Cancel — do nothing
						);
					} else {
						// No conflicts — show the standard commit summary.
						self._showCommitSummary(modified, added, deleted, AFF.state.variables);
					}
				})
				.catch(function () {
					// If the pre-check itself fails, skip it and proceed without conflict check.
					AFF.Modal.close();
					self._showCommitSummary(modified, added, deleted, AFF.state.variables);
				});
		},

		/**
		 * Show the commit confirmation summary dialog and trigger the commit on confirm.
		 *
		 * @param {number} modified     Count of modified variables
		 * @param {number} added        Count of new variables
		 * @param {number} deleted      Count of deleted variables
		 * @param {Array}  commitVars   AFF variable objects to include in the commit
		 */
		_showCommitSummary: function (modified, added, deleted, commitVars) {
			var self         = this;
			var summaryLines = [];
			if (modified > 0) { summaryLines.push(modified + ' modified'); }
			if (added > 0)    { summaryLines.push(added    + ' new'); }
			if (deleted > 0)  { summaryLines.push(deleted  + ' deleted'); }

			var skippedCount = AFF.state.variables.length - commitVars.length;
			var skippedNote  = skippedCount > 0
				? '<p style="font-size:12px;color:var(--aff-clr-muted);margin-bottom:8px">'
				+   skippedCount + ' variable' + (skippedCount !== 1 ? 's' : '')
				+   ' excluded (Elementor value kept).</p>'
				: '';

			var commitHandler;
			AFF.Modal.open({
				title: 'Write to Elementor',
				body:  '<p style="margin-bottom:8px">The following changes will be written to the Elementor kit CSS file:</p>'
					+ '<ul style="margin:0 0 12px 16px;list-style:disc">'
					+ summaryLines.map(function (l) { return '<li>' + l + '</li>'; }).join('')
					+ '</ul>'
					+ skippedNote
					+ '<p style="font-size:12px;color:var(--aff-clr-muted)"><strong>This modifies Elementor\'s files.</strong> Save a backup first if you haven\'t already.</p>',
				footer: '<div style="display:flex;justify-content:flex-end;gap:8px">'
					+ '<button class="aff-btn aff-btn--secondary" id="aff-commit-cancel">Cancel</button>'
					+ '<button class="aff-btn" id="aff-commit-confirm">Commit</button>'
					+ '</div>',
				onClose: function () { document.removeEventListener('click', commitHandler); },
			});

			commitHandler = function (e) {
				if (e.target.id === 'aff-commit-cancel') {
					AFF.Modal.close();
					document.removeEventListener('click', commitHandler);
				} else if (e.target.id === 'aff-commit-confirm') {
					AFF.Modal.close();
					document.removeEventListener('click', commitHandler);
					self._executeCommit(commitVars);
				}
			};
			document.addEventListener('click', commitHandler);
		},

		/**
		 * Execute the commit AJAX call.
		 *
		 * Sends the resolved variable list to aff_commit_to_elementor, then updates
		 * variable statuses to 'synced' and clears the pending commit flag.
		 *
		 * @param {Array|undefined} commitVars  Optional resolved variable list. When
		 *   omitted all AFF state variables are sent (original behaviour).
		 */
		_executeCommit: function (commitVars) {
			if (!AFF.state.currentFile) {
				AFF.Modal.open({ title: 'No file loaded', body: '<p>Please load a file before committing.</p>' }); return;
			}

			var source    = commitVars || AFF.state.variables;
			// For Numbers variables the stored value is a pure number; reconstruct
			// the CSS dimension string (e.g. '16' + 'PX' → '16px') for the commit
			// payload. FX values (function expressions) are sent as-is.
			// Legacy values that already include the unit are handled by extracting
			// only the numeric prefix before re-appending the unit.
			var FORMAT_UNIT = { 'PX': 'px', '%': '%', 'EM': 'em', 'REM': 'rem',
			                    'VW': 'vw', 'VH': 'vh', 'CH': 'ch' };
			var variables = source.map(function (v) {
				var cssValue = v.value;
				if (v.subgroup === 'Numbers' && v.format !== 'FX') {
					var unit      = FORMAT_UNIT[v.format] || '';
					var numMatch  = (v.value || '').match(/^(-?[\d.]+)/);
					cssValue = numMatch ? numMatch[1] + unit : v.value;
				}
				return { name: v.name, value: cssValue };
			});

			AFF.App.ajax('aff_commit_to_elementor', {
				filename:  AFF.state.currentFile,
				variables: JSON.stringify(variables),
			}).then(function (res) {
				if (res.success) {
					var committed = res.data.committed || [];
					var skipped   = res.data.skipped   || [];

					// Update variable statuses to 'synced' for committed vars.
					for (var i = 0; i < AFF.state.variables.length; i++) {
						if (committed.indexOf(AFF.state.variables[i].name) !== -1) {
							AFF.state.variables[i].status = 'synced';
						}
					}

					AFF.App.setPendingCommit(false);

					var msg = committed.length + ' variable(s) committed.';
					if (skipped.length > 0) {
						msg += ' ' + skipped.length + ' variable(s) not found in Elementor kit (check names).';
					}
					AFF.Modal.open({ title: 'Commit complete', body: '<p>' + msg + '</p>' });

					// Re-render current view to show updated status dots.
					if (AFF.Colors && AFF.state.currentSelection && AFF.state.currentSelection.subgroup === 'Colors') {
						AFF.Colors.loadColors(AFF.state.currentSelection);
					}
				} else {
					AFF.Modal.open({ title: 'Commit error', body: '<p>' + ((res.data && res.data.message) || 'Unknown error.') + '</p>' });
				}
			}).catch(function () {
				AFF.Modal.open({ title: 'Commit error', body: '<p>Network error during commit.</p>' });
			});
		},

		/**
		 * Toggle the accent highlight on the ↑ Variables (commit) button.
		 *
		 * Called from AFF.App.setPendingCommit(). Adds .aff-btn--accent when
		 * there are pending commits so the button pulses; removes it when clear.
		 */
		updateCommitBtn: function () {
			if (!this._commitVariablesBtn) { return; }

			var hasPending = AFF.state.hasPendingElementorCommit;
			if (hasPending) {
				this._commitVariablesBtn.classList.add('aff-btn--accent');
			} else {
				this._commitVariablesBtn.classList.remove('aff-btn--accent');
			}
		},

		// ------------------------------------------------------------------
		// ELEMENTOR V3 IMPORT — import V3 Global Colors
		// ------------------------------------------------------------------

		/**
		 * Bind the ↓ V3 Colors button.
		 */
		_bindV3ColorsBtn: function () {
			if (!this._v3ColorsBtn) { return; }
			var self = this;

			this._v3ColorsBtn.addEventListener('click', function () {
				self._openV3ImportDialog();
			});
		},

		/**
		 * Open the V3 Import confirmation dialog, then execute.
		 */
		_openV3ImportDialog: function () {
			var self = this;

			AFF.Modal.open({
				title: 'Import V3 Global Colors',
				body:  '<p style="margin-bottom:8px">This will read the V3 Global Colors stored in your Elementor kit post meta and import them as AFFcolor variables.</p>'
					+ '<p style="font-size:12px;color:var(--aff-clr-muted)">Existing AFFvariables with the same name will not be overwritten. New colors will be added to <em>Uncategorized</em>.</p>',
				footer: '<div style="display:flex;justify-content:flex-end;gap:8px">'
					+ '<button class="aff-btn aff-btn--secondary" id="aff-v3-cancel">Cancel</button>'
					+ '<button class="aff-btn" id="aff-v3-confirm">Import</button>'
					+ '</div>',
			});

			document.addEventListener('click', function v3Handler(e) {
				if (e.target.id === 'aff-v3-cancel') {
					AFF.Modal.close();
					document.removeEventListener('click', v3Handler);
				} else if (e.target.id === 'aff-v3-confirm') {
					AFF.Modal.close();
					document.removeEventListener('click', v3Handler);
					self._executeV3Import();
				}
			});
		},

		/**
		 * Execute the V3 colors import AJAX call.
		 */
		_executeV3Import: function () {
			AFF.App.ajax('aff_sync_v3_global_colors', {})
				.then(function (res) {
					if (res.success) {
						var imported = res.data.imported || [];

						imported.forEach(function (v) {
							var existing = AFF.state.variables.filter(function (ev) { return ev.name === v.name; });
							if (existing.length === 0) {
								AFF.state.variables.push({
									id:          '',
									name:        v.name,
									value:       v.value,
									source:      'elementor-v3',
									type:        'color',
									group:       'Variables',
									subgroup:    'Colors',
									category:    'Uncategorized',
									category_id: '',
									modified:    false,
									status:      'new',
									created_at:  new Date().toISOString(),
									updated_at:  new Date().toISOString(),
								});
							}
						});

						AFF.App.refreshCounts();
						if (AFF.Colors && AFF.Colors._ensureUncategorized) { AFF.Colors._ensureUncategorized(); }
						if (AFF.PanelLeft) { AFF.PanelLeft.refresh(); }
						if (imported.length > 0) { AFF.App.setDirty(true); }

						var msg = imported.length > 0
							? imported.length + ' V3 color' + (imported.length !== 1 ? 's' : '') + ' imported.'
							: 'No V3 Global Colors found in the active Elementor kit.';
						AFF.Modal.open({ title: 'V3 Import complete', body: '<p>' + msg + '</p>' });
					} else {
						AFF.Modal.open({ title: 'V3 Import error', body: '<p>' + ((res.data && res.data.message) || 'Unknown error.') + '</p>' });
					}
				})
				.catch(function () {
					AFF.Modal.open({ title: 'V3 Import error', body: '<p>Network error during V3 import.</p>' });
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
			this._setCount('aff-count-variables',  counts.variables  || 0);
			this._setCount('aff-count-classes',    counts.classes    || 0);
			this._setCount('aff-count-components', counts.components || 0);
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

		/**
		 * Derive a .eff.json filename from a human-readable project name.
		 * Slugifies the name: lower-case, hyphens, strips leading/trailing hyphens.
		 *
		 * @param {string} name  Human-readable project name.
		 * @returns {string}     e.g. "my-e-commerce-site.eff.json"
		 */
		_getFilename: function (name) {
			return (name || '').trim()
				.replace(/\.eff\.json$/i, '')   // strip full extension if already present
				.replace(/\.eff$/i, '')          // strip partial extension
				.toLowerCase()
				.replace(/[^a-z0-9]+/g, '-')
				.replace(/^-+|-+$/g, '')
				+ '.eff.json';
		},

		/**
		 * Escape a string for safe insertion into HTML text content.
		 * @param {string} str
		 * @returns {string}
		 */
		_escHtml: function (str) {
			return String(str || '')
				.replace(/&/g, '&amp;')
				.replace(/</g, '&lt;')
				.replace(/>/g, '&gt;');
		},

		/**
		 * Escape a string for safe use in an HTML attribute value (double-quoted).
		 * @param {string} str
		 * @returns {string}
		 */
		_escAttr: function (str) {
			return String(str || '')
				.replace(/&/g, '&amp;')
				.replace(/"/g, '&quot;');
		},

		/**
		 * Show a brief toast notification.
		 * Auto-dismisses after 2 seconds.
		 *
		 * @param {string} message
		 */
		_showToast: function (message) {
			var toast = document.createElement('div');
			toast.className   = 'aff-toast';
			toast.textContent = message;
			document.body.appendChild(toast);

			// Trigger the transition in the next frame.
			requestAnimationFrame(function () {
				toast.classList.add('aff-toast--visible');
			});

			setTimeout(function () {
				toast.classList.remove('aff-toast--visible');
				setTimeout(function () { toast.remove(); }, 300);
			}, 2000);
		},
	};
}());
