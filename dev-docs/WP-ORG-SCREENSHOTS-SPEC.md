# WordPress.org Listing — Screenshot Production Spec

Not part of `readme.txt` — WP.org's `== Screenshots ==` section only takes short numbered
captions (already in `readme.txt`, matching the order below). This file is the production
guidance for actually shooting, cropping, and annotating each screenshot before they go into
the SVN `assets/` folder. Source: Jim's original page outline, 2026-08-15.

Also covers the WP.org `assets/` banner/icon separately from these numbered screenshots —
see the bottom of this file.

---

## Visual hierarchy the page should communicate

1. **What is it?** → Atomic Framework Forge
2. **Why do I need it?** → Managing Elementor design variables becomes difficult as a site grows
3. **What does it manage?** → Colors · Fonts · Numbers
4. **How does it work?** → Fetch → Organize → Edit → Review → Commit
5. **Can I trust it?** → Explicit writes · Confirmation · Backups
6. **Can I use it on real projects?** → Projects · Import/Export · V3 migration · Documentation
7. **Where is it going?** → Variables → Classes → Components

Screenshot order below is deliberate: **1–3 sell the product**, **4–6 establish technical
credibility and safety**, **7–9 demonstrate depth and professionalism**.

---

## Screenshot 1 — Hero / Main Workspace

**Purpose:** answer "What is this plugin?" — the visitor's first question.
**Image:** full AFF interface with a populated project.
**Crop:** wide 16:9.
**Visual emphasis:** make the Colors / Fonts / Numbers navigation immediately visible.
**Annotation (optional):** small unobtrusive overlay identifying (1) project navigation,
(2) variable categories, (3) edit area, (4) data management.
**Caption (already in readme.txt):** "A professional workspace for managing Elementor V4
design variables."

## Screenshot 2 — Color Management

**Purpose:** demonstrate AFF is substantially more capable than a simple variable list.
**Show:** color categories, sub-categories, swatches, variable names, values, editing
interface, status information.
**Optional callouts:** Visual editing / Tints & shades / Transparency variants / Custom
classification.
**Caption:** "Build and organize a structured color system with visual editing and
generated color variants."

## Screenshot 3 — Fonts and Numbers

**Purpose:** demonstrate AFF isn't simply a color-management utility.
**Composition:** show Numbers prominently, with enough nav visible to establish Fonts and
Colors are part of the same system.
**Callouts:** Fonts / Spacing / Sizing / Units.
**Caption:** "Manage typography and numeric design variables alongside your color system."

## Screenshot 4 — Elementor Synchronization

**Purpose:** establish trust.
**Show:** the sync interface immediately before or during a commit. The important visual
element is the difference/status information.
**Callouts:** Synced / Modified / New / Orphaned / Conflict.
**Caption:** "See what has changed before committing variables back to Elementor."

## Screenshot 5 — Commit Confirmation

**Purpose:** answer "Can this plugin unexpectedly change my site?" — **one of the most
important screenshots on the page.**
**Show:** the commit summary dialog.
**Caption:** "AFF never silently writes changes to Elementor. Review the proposed changes
and confirm the commit yourself."

## Screenshot 6 — V3 → V4 Migration

**Purpose:** give established Elementor users a reason to install AFF.
**Show:** the V3 Global Color import/mapping interface.
**Caption:** "Bring Elementor V3 Global Colors into your V4 variable workflow."

## Screenshot 7 — Projects and Backups

**Purpose:** demonstrate AFF is a development tool, not just an admin screen.
**Show:** project selector and backup management.
**Caption:** "Maintain multiple projects, restore previous snapshots, and move projects
between sites."

## Screenshot 8 — Export / Import

**Purpose:** demonstrate portability.
**Show:** export/import controls and, if practical, the `.atfrfo.json` filename.
**Caption:** "Export a portable AFF project and import it into another WordPress site."

## Screenshot 9 — Print / PDF

**Purpose:** show the documentation capability.
**Show:** print selection interface, then enough of the generated document to demonstrate
the result.
**Caption:** "Create printable documentation from your variable system."

---

## Separately: WP.org `assets/` (banner, icon) — not these numbered screenshots

The SVN `assets/` folder (distinct from `trunk/assets/`, AFF's own runtime assets) still
needs, whenever this is tackled:
- `banner-772x250.png` (and optionally `banner-1544x500.png` for high-DPI)
- `icon-128x128.png` (and optionally `icon-256x256.png`)

These are what render at the top of the plugin listing page and in WP.org search results —
separate work from the 9 numbered screenshots above. Flagged, not started, per the
2026-08-14 decision to get the code live first and handle listing cosmetics after.

## Positioning rule (already applied to readme.txt — noted here for consistency)

Do not lead with architecture-first framing ("Professional management interface for
Elementor Version 4 (atomic widget architecture) assets..."). Lead with user benefit
("Take control of your Elementor design variables") — the visitor should understand AFF's
value before being asked to understand Elementor's atomic architecture. Applies to any
future page copy (jimrforge.com plugin detail page, etc.), not just readme.txt.
