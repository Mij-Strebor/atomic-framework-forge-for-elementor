# ATFRFO — Data Management Specification

**Document:** ATFRFO-Spec-Data-Management.md
**Version:** 1.1
**Date:** 2026-03-19
**Author:** Jim Roberts / JimRForge
**Scope:** All operations that move ATFRFO project data in, out, or between states — project files, backups, export/import, and Elementor sync.

---

## 1. Overview

ATFRFO is a purpose-built management interface for Elementor V4 assets. The plugin manages three asset types that together form a **project**:

| Asset type | Description | Phase |
|------------|-------------|-------|
| **Variables** | CSS custom properties — Colors, Fonts, Numbers | Current |
| **Classes** | Elementor class definitions | Phase 3 — future |
| **Components** | Elementor component definitions | Phase 4 — future |

A project file stores all three asset types plus their category configuration.

**The only automatic operation is startup auto-load.** When you open ATFRFO, the last active project is reloaded from disk automatically. If no project has been saved yet, a blank default project is loaded. Every other data operation — sync, commit, export, import, save, restore — requires explicit user action.

---

## 2. The Four Data Channels

Each channel has a clear direction: data flows **into ATFRFO** (to load or replace the current project) or **out of ATFRFO** (to persist or publish it).

| Channel | Into ATFRFO | Out of ATFRFO |
|---------|----------|------------|
| **Elementor V4 Sync** | Pull — reads V4 variables (Classes, Components in future phases) into the current project | Commit — writes ATFRFO project data back to the Elementor V4 kit |
| **Elementor V3 Import** | One-way import of V3 Global Colors (and future: Global Fonts) into the current project | Not supported — ATFRFO cannot write to V3 |
| **Backup / Restore** | Restore — loads a saved snapshot, replacing the current working state | Save — writes the full current project state to a new timestamped backup file |
| **External File** | Import — reads an `.atfrfo.json` file from the user's disk, replacing the current project | Export — downloads the current project as an `.atfrfo.json` file to the user's disk |

### 2.1 What "project data" means

Variables, Classes, and Components **are** the project data. There is no separate "metadata" layer above them. A complete project snapshot includes:

- All variable objects (`ATFRFO.state.variables`) — Colors, Fonts, Numbers
- Category configuration (`ATFRFO.state.config`) — per-set category arrays, settings
- All class objects (`ATFRFO.state.classes`) — *Phase 3*
- All component objects (`ATFRFO.state.components`) — *Phase 4*
- Project name and version

---

## 3. In-Memory Working Store

All editing operates against an in-memory working store. Nothing writes to Elementor or disk automatically except:

- **Per-field AJAX saves** (`atfrfo_save_color`, etc.) — fire on every field change; write one entity to the active backup file
- **Startup auto-load** — loads the last active project on page load

| Store key | Content |
|-----------|---------|
| `ATFRFO.state.variables` | All variable objects across all sets |
| `ATFRFO.state.config` | Category arrays, settings, project metadata |
| `ATFRFO.state.classes` | Class objects *(Phase 3)* |
| `ATFRFO.state.components` | Component objects *(Phase 4)* |
| `ATFRFO.state.currentFile` | Relative path of the active backup file |
| `ATFRFO.state.projectName` | Display name of the active project |

---

## 4. Backup / Restore

*Status: Implemented — v0.3.0*

### 4.1 Save (out of ATFRFO)

| Button | Behavior |
|--------|----------|
| **Save Project** | Creates a new timestamped backup file. Always produces a new file — never overwrites. |
| **Save Changes** | Writes the current working state to the **currently active** backup file. Updates the snapshot in place. |

Both buttons write to `uploads/eff/{slug}/{slug}_{YYYY-MM-DD}_{HH-II-SS}.atfrfo.json`. "Save Project" always generates a new timestamp; "Save Changes" uses `ATFRFO.state.currentFile`.

Per-field AJAX saves also write to the active file continuously — see §7.3.

**Save Project is the backup action.** Each press is a new checkpoint. Over time a project accumulates a list of named-by-date snapshots that the user can restore from.

### 4.2 Restore (into ATFRFO)

The **Open Project** button opens a two-level picker modal:

- **Level 1 — Project list:** all projects on this site · name · backup count · latest save date · Open button
- **Level 2 — Backup list:** all snapshots for the selected project · newest first · timestamp · Load button · Delete button

Loading a backup replaces the entire working store with that snapshot's data. It becomes the new `ATFRFO.state.currentFile`. Subsequent **Save Changes** writes to it; **Save Project** creates a new checkpoint from it.

### 4.3 Limits and pruning

- Default limit: **10 backups per project**
- Configurable in the Manage Project modal ("Max backups per project", min 1, max 50)
- When a new backup is saved and the count exceeds the limit, the oldest file is silently deleted
- Backup files survive browser sessions, server restarts, and plugin deactivation

### 4.4 Deleting a backup

The Delete button on a Level 2 row removes that single file. If it was the last file in the project directory, the directory is removed and the project disappears from Level 1.

---

## 5. Export / Import (External File)

*Status: Implemented — v0.2.2*

Export and Import exchange a single `.atfrfo.json` file with the user's local disk. Both are **complete replacements** — not merges.

### 5.1 Export (out of ATFRFO)

- Serializes the entire current working store to a `.atfrfo.json` file
- Client-side Blob download — no server request
- Filename: `{project-name}.atfrfo.json`
- Non-destructive — no confirmation required

### 5.2 Import (into ATFRFO)

- File picker (`accept=".json,.atfrfo.json"`)
- Parses the file client-side
- **If the current project has unsaved changes**, shows a confirmation:
  > "Importing will replace all current project data. Unsaved changes to '{project}' will be lost. Continue?"
- On confirm: replaces all working state; sets project name from `data.name`; marks dirty; refreshes all panels
- `ATFRFO.state.currentFile` is **not updated** — the imported state is unsaved until the user clicks Save Project

### 5.3 Scope

| Data | Exported | Imported |
|------|----------|----------|
| Variables (Colors, Fonts, Numbers) | Yes | Yes |
| Category configuration | Yes | Yes |
| Classes | Yes *(Phase 3)* | Yes *(Phase 3)* |
| Components | Yes *(Phase 4)* | Yes *(Phase 4)* |
| ATFRFO plugin settings (theme, tooltips, sync path) | No | No |
| Elementor kit CSS | No | No |

---

## 6. Elementor V4 Sync

Elementor V4 stores Variables, Classes, and Components as independent asset types in the kit. ATFRFO syncs each asset type with a separate operation. A "Sync All" composite is also available.

### 6.1 Pull from Elementor V4 (into ATFRFO)

Reads the active Elementor kit and brings data into the working store.

| Scope | AJAX action | Phase |
|-------|-------------|-------|
| Sync Variables | `atfrfo_sync_from_elementor` | Current |
| Sync Classes | `atfrfo_sync_classes_from_elementor` | Phase 3 |
| Sync Components | `atfrfo_sync_components_from_elementor` | Phase 4 |
| Sync All | Composite of the above | Phase 3+ |

**Before executing, a dialog presents two destination options:**

| Option | Behavior |
|--------|----------|
| **Sync by name** *(recommended)* | Add new variables not yet in ATFRFO · Update value/original_value for matching names · Leave ATFRFO-only variables unchanged |
| **Clear and replace** | Delete all existing ATFRFO variables of this type first · Import a clean copy from Elementor |

"Clear and replace" shows a second confirmation:
> "This will delete all {N} existing variables in '{project}'. This cannot be undone. Continue?"

**Status assigned after pull:**

| Condition | Status |
|-----------|--------|
| Variable found in both; values match | `synced` |
| Variable found in both; ATFRFO value differs from Elementor | `modified` |
| Variable in Elementor, not yet in ATFRFO | `synced` |
| Variable in ATFRFO, not in Elementor (ATFRFO-created) | unchanged |

### 6.2 Commit to Elementor V4 (out of ATFRFO)

Writes ATFRFO data back to the Elementor kit. User-initiated only — never automatic.

| Variable status | Action on commit |
|----------------|------------------|
| `new` | Appended to Elementor kit `:root` block |
| `modified` | Value updated in Elementor kit `:root` block |
| `deleted` | Removed from Elementor kit `:root` block |
| `synced` | Skipped — no write needed |

A summary dialog shows the pending write count before execution:
> "{N} variables will be updated · {M} will be added · {K} will be deleted from Elementor"

After a successful commit, all committed variables receive `status = 'synced'` and `original_value` is updated.

### 6.3 Sync All

A single button that runs Pull (or Commit) for all asset types that are active (Variables now; Classes and Components when those phases ship). One option dialog covers the entire operation.

---

## 7. Elementor V3 Site Settings Import

V3 stores Global Colors and Global Fonts as WordPress post meta on the kit post. ATFRFO can read this data to seed a project. **ATFRFO cannot write back to V3.**

### 7.1 Import Global Colors (into ATFRFO)

Reads the Elementor V3 Global Colors array and creates ATFRFO color variables from them.

- Each V3 entry: `id`, `title`, `color`
- Creates: `name = --{slugified-title}`, `value = color`, `subgroup = Colors`, `source = 'elementor-v3'`

**Destination dialog:**

| Option | Behavior |
|--------|----------|
| **Add new only** *(recommended)* | Skip any variable whose slugified name already exists in ATFRFO |
| **Clear and replace** | Delete all existing ATFRFO color variables first |

Imported variables receive `status = 'new'` — they do not yet exist in the V4 kit.

### 7.2 Import Global Fonts (into ATFRFO) — *Phase 3+*

Each V3 Global Fonts entry contains: `title`, `family`, `size`, `weight`, `transform`, `style`, `decoration`, `line_height`, `letter_spacing`, `word_spacing`.

Planned behavior:
1. Create an ATFRFO Fonts variable: `name = --font-{slug}`, `value = family`
2. Create an ATFRFO Class that applies all typographic properties using the font variable

Deferred until Classes are implemented (Phase 3). The button will appear in the right panel but be disabled with a "Coming in Phase 3" tooltip.

### 7.3 V3 Limitations

| Operation | Supported |
|-----------|-----------|
| Read V3 Global Colors | Yes |
| Read V3 Global Fonts | Phase 3+ |
| Write to V3 (any data) | No — V3 is read-only from ATFRFO |

---

## 8. Right Panel Layout

All data management controls live in the right panel, organized into sections.

### 8.1 Active Project

```
┌─ Active Project ───────────────────────────────────┐
│  [project name input                      ]        │
│  [Open / Switch Project]                           │
└────────────────────────────────────────────────────┘
```

- **Project name input** — display name; does not rename or move files
- **Open / Switch Project** — opens the two-level backup picker modal (Level 1 = projects, Level 2 = backups)

### 8.2 Save & Backups

```
┌─ Save & Backups ───────────────────────────────────┐
│  [Save Project]         [Save Changes]             │
│  Save Project creates a new snapshot.              │
│  Save Changes updates the current snapshot.        │
└────────────────────────────────────────────────────┘
```

- **Save Project** — new timestamped backup file (checkpoint)
- **Save Changes** — write to the current active file (update in place)
- Backup count and max are managed in the Manage Project modal

### 8.3 Elementor Sync

```
┌─ Elementor Sync ───────────────────────────────────┐
│  Pull from Elementor:                              │
│  [↓ Variables]  [↓ Classes*]  [↓ Components*]     │
│  [↓ Sync All*]                                     │
│                                                    │
│  Push to Elementor:                                │
│  [↑ Variables]  [↑ Classes*]  [↑ Components*]     │
│  [↑ Commit All*]                                   │
│                                                    │
│  * Phase 3 / 4 — not yet available                 │
└────────────────────────────────────────────────────┘
```

Each Pull button opens an options dialog (Sync by name / Clear and replace) before executing. Each Push button opens a summary dialog before writing.

### 8.4 V3 Import

```
┌─ Elementor V3 Import ──────────────────────────────┐
│  [↓ Global Colors]                                 │
│  [↓ Global Fonts*]   * Phase 3 — not yet available │
└────────────────────────────────────────────────────┘
```

### 8.5 Export / Import

```
┌─ Export / Import ──────────────────────────────────┐
│  [↑ Export Project]    [↓ Import Project]          │
└────────────────────────────────────────────────────┘
```

---

## 9. Confirmation Dialogs

### 9.1 Pull from Elementor — Options Dialog

```
┌─ Sync Variables from Elementor ────────────────────┐
│  into project: '{project name}'                    │
│                                                    │
│  ● Sync by name  (recommended)                     │
│    Add new · Update matching · Keep ATFRFO-only       │
│                                                    │
│  ○ Clear and replace                               │
│    Delete all ATFRFO variables · Import fresh from    │
│    Elementor                                       │
│                                                    │
│              [Cancel]        [Sync →]              │
└────────────────────────────────────────────────────┘
```

If "Clear and replace" is selected, a second confirmation appears:
> "This will delete all {N} variables in '{project}'. This cannot be undone."
> [Cancel]  [Delete and Sync]

### 9.2 Commit to Elementor — Summary Dialog

```
┌─ Commit Variables to Elementor ────────────────────┐
│  {N} variables will be updated                    │
│  {M} new variables will be added                  │
│  {K} variables will be deleted                    │
│                                                    │
│              [Cancel]        [Commit →]            │
└────────────────────────────────────────────────────┘
```

### 9.3 Import Project — Overwrite Warning

Shown only if the current project has unsaved changes:

```
┌─ Import Project ───────────────────────────────────┐
│  Importing replaces all current project data.      │
│  Unsaved changes to '{project}' will be lost.      │
│                                                    │
│              [Cancel]     [Import and Replace]     │
└────────────────────────────────────────────────────┘
```

### 9.4 V3 Global Colors — Destination Dialog

```
┌─ Import V3 Global Colors ──────────────────────────┐
│  {N} colors found in Elementor V3 Global Colors    │
│  into project: '{project name}'                    │
│                                                    │
│  ● Add new colors only  (recommended)              │
│    Skip names that already exist in ATFRFO            │
│                                                    │
│  ○ Clear and replace                               │
│    Delete all existing ATFRFO color variables first   │
│                                                    │
│              [Cancel]        [Import →]            │
└────────────────────────────────────────────────────┘
```

---

## 10. AJAX Endpoints

### Implemented (v0.3.0)

| Action | Description |
|--------|-------------|
| `atfrfo_save_file` | Save full project state to a new timestamped backup |
| `atfrfo_load_file` | Load a backup file into working store |
| `atfrfo_list_projects` | List all projects (Level 1 picker) |
| `atfrfo_list_backups` | List all backups for a project slug (Level 2 picker) |
| `atfrfo_delete_project` | Delete one backup file; remove project dir if empty |
| `atfrfo_sync_from_elementor` | Pull V4 variables from Elementor kit CSS |
| `atfrfo_commit_to_elementor` | Push ATFRFO variables to Elementor kit CSS |
| `atfrfo_save_color` | Partial save — one variable field change |
| `atfrfo_delete_color` | Delete one variable |
| `atfrfo_save_category` / `atfrfo_delete_category` / `atfrfo_reorder_categories` | Category CRUD |
| `atfrfo_save_settings` | Persist ATFRFO settings |

### Planned

| Action | Phase | Description |
|--------|-------|-------------|
| `atfrfo_sync_v3_global_colors` | Current | Pull V3 Global Colors into ATFRFO variables |
| `atfrfo_sync_classes_from_elementor` | Phase 3 | Pull V4 classes into ATFRFO |
| `atfrfo_commit_classes_to_elementor` | Phase 3 | Push ATFRFO classes to Elementor V4 |
| `atfrfo_sync_v3_global_fonts` | Phase 3+ | Pull V3 Global Fonts into ATFRFO variables + classes |
| `atfrfo_sync_components_from_elementor` | Phase 4 | Pull V4 components into ATFRFO |
| `atfrfo_commit_components_to_elementor` | Phase 4 | Push ATFRFO components to Elementor V4 |

---

## 11. Implementation Status

| Feature | Status | Version |
|---------|--------|---------|
| Save / Load project file | ✅ | v0.0.1 |
| Multi-project support | ✅ | v0.0.1 |
| Sync Variables from Elementor V4 | ✅ | v0.0.1 |
| Commit Variables to Elementor V4 | ✅ | v0.0.1 |
| Export / Import | ✅ | v0.2.2 |
| Versioned backup system (Save Project / Restore) | ✅ | v0.3.0 |
| Two-level project / backup picker | ✅ | v0.3.0 |
| Sync options dialog (Sync by name / Clear and replace) | 🔲 | — |
| Commit summary dialog | 🔲 | — |
| V3 Global Colors import | 🔲 | — |
| Sync All | 🔲 | Phase 3+ |
| Sync Classes from / to Elementor V4 | 🔲 | Phase 3 |
| V3 Global Fonts import | 🔲 | Phase 3+ |
| Sync Components from / to Elementor V4 | 🔲 | Phase 4 |

---

*© Jim Roberts / [JimRForge](https://jimrforge.com)*
