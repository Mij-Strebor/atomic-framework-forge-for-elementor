# ATFRFO Recovery Log

---

## 2026-06-13 — v1.2.0 Release

**Commit:** c6ae2bf
**Git Tag:** v1.2.0
**Zip Backup:** 260613 atfrfo-v1.2.0-release-complete.zip
**Branch:** master (merged from feature/multi-tiered-categories)

**What Works (new in 1.2.0):**
- Sub-categories — one level of nesting under any top-level category; full CRUD; cascade collapse
- Tints/Shades/Transparencies generated into named sub-categories in place
- Delete Variable button — trash icon on hover, confirmation modal
- Status legend — Synced / Modified / New / Orphaned / Conflict indicator row
- Print / PDF — set-selection modal + browser print dialog
- Home icon on type filter bar (replaces ✕ close button)
- New categories insert at top of list
- Delete button column overflow fixed (PHP inline style was 7 cols; now 8 for all views)

**What Changed:**
- grid-template-columns updated in atfrfo-colors.css, atfrfo-variables.css, and class-atfrfo-admin.php get_grid_override_css()
- Sub-category margin-bottom increased to 28px to clear absolute-positioned add button
- Cascade collapse: collapsing a parent also sets data-collapsed on all depth-1 child blocks
- CSS collapse rule extended to hide depth-1 blocks when parent is collapsed
- ATFRFO.Icons.homeSVG() added; back buttons in atfrfo-colors.js and atfrfo-variables.js updated

**Failed Approaches:**
- CSS-only fix for delete button overflow: reducing value column % had no effect because PHP inline style always wins at equal specificity

---

## 2026-05-18 — v1.0.0 First Stable Release

**Commit:** 8aa05c3
**Git Tag:** v1.0.0
**Zip Backup:** 260518 atfrfo-v1.0.0-release-complete.zip
**Branch:** master

**What Works:**
- Full Variables workflow (Colors, Fonts, Numbers)
- Category management with iOS toggle delete/move
- Tints/Shades/Transparencies palette generation with Save/Cancel
- Elementor V4 sync — reads and writes kit global variables via post meta
- Project manager — versioned backups, copy, rename, delete
- Keyboard navigation in delete modals
- Tooltip auto-dismiss
- scrollIntoView on category expand
- .atfrfo.json export/import

**Known Issues:**
- Font picker Phase 3 (atfrfo-fonts.js) deferred — file exists but not committed

**What Changed:**
- Resolved all WordPress Plugin Check errors (is_writable, Requires PHP mismatch, hidden file, filename with spaces)
- phpcs:disable for false-positive nonce/sanitization warnings (verify_request() handles nonces)
- Added .distignore for dev markdown files
- Elementor dev constants updated to 4.0.8 / 4.0.4
- Removed beta status labels from README

**Failed Approaches:** none
