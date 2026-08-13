# Atomic Framework Forge Quick Start Guide
## Atomic Framework Forge for Elementor — v1.4.3

> This guide gets you from install to your first synced, organized, and saved variable project in about ten minutes.
>
> For a complete feature reference, see the **[User Manual →](user-manual.md)**

---

## Before You Begin

You will need:

- A working **WordPress** installation (local or staging — not a live production site)
- **Elementor** and **Elementor Pro** both installed and active — ATFRFO refuses to load without both
- An active **Elementor Kit** (created automatically when Elementor is first installed)

ATFRFO works with both **Elementor V3** (Global Colors) and **Elementor V4** (CSS custom property variables). You do not need to be on V4 to get started. Note: only **Variables** (Colors, Fonts, Numbers) are functional today — Classes and Components appear in the left navigation as future-phase placeholders and cannot be synced from either Elementor version yet.

---

## Step 1 — Install Atomic Framework Forge

### Download a ZIP

Click **Code → Download ZIP** on the GitHub repository page, then go to **WordPress Admin → Plugins → Add Plugin → Upload Plugin** and install the zip.

Or clone directly into your plugins directory:

```bash
cd wp-content/plugins
git clone https://github.com/Mij-Strebor/atomic-framework-forge-for-elementor.git
```

### Activate

Go to **WordPress Admin → Plugins → Installed Plugins**, find **Atomic Framework Forge for Elementor**, and click **Activate**. Atomic Framework Forge appears in the WordPress admin sidebar.

---

## Step 2 — Open Atomic Framework Forge

Click **Atomic Framework Forge** in the WordPress admin sidebar.

You will see the three-panel interface:

| Area | Purpose |
|------|---------|
| **Top bar** | Logo, project name, and all action buttons |
| **Left panel** | Variable tree — Colors / Fonts / Numbers — with counts |
| **Center** | Edit space — category blocks, variable rows, inline editing |

---

## Step 3 — The Top Menu Bar

The top bar gives you access to everything. All buttons are icons; hover any one to see a tooltip. Brand mark on the left, an editable **project name** in the center, and every action button on the right.

**Right side, left to right:**

| Button | Action |
|--------|--------|
| ▦ Grid | Manage Projects — project settings; leads to Project Manager (open, rename, copy, delete, restore backups) |
| 💾 Save | Save Changes in place — glows red when unsaved changes exist |
| ⏱ History | Change history *(placeholder)* |
| ⟳ Sync | Open the Sync modal — import from or export to Elementor |
| ⋯ More | Dropdown — Preferences, Functions, Print / PDF, Export, Import, Help |

There is **no separate gear/functions/help icon** next to the logo — Preferences, Functions, and Help all live inside the **⋯ More** dropdown.

---

## Step 4 — Create Your First Project

Click **▦ Manage Projects**. This opens the project **settings** modal (name, category lists, max backups, default formats).

Click **Project Manager…** at the top of that modal to reach the actual project picker. Type a name in the **New project name** field and click **Create**. ATFRFO initializes an empty project and the name appears in the toolbar center.

Your project is saved under `wp-content/uploads/atfrfo/<your-project>/`.

---

## Step 5 — Import Variables from Elementor

Click the **⟳ Sync** button. The Sync modal opens with two toggles:

- **Elementor version** — V3 or V4. Version 3 has only the Elementor System Colors and any Custom Colors; there is nothing else to pull from V3 today. Version 4 provides the full CSS custom-property variable set.
- **Direction** — leave set to **Import**.

On a new project the data set is empty, so the **Import Mode** choice (Sync by name / Clear and replace) doesn't matter yet.

Click **Synchronize**. ATFRFO reads the active Elementor kit's variable data and classifies everything into Colors, Fonts, and Numbers.

> **V3 → V4 migration:** Import your V3 System Colors and Custom Colors, then also import V4 and map the two sets to each other inside ATFRFO. See the User Manual's [V3 → V4 Migration Workflow](user-manual.md#16-v3--v4-migration-workflow) for the full walkthrough.

> **Conflicts:** If you re-sync a project that already has ATFRFO edits, and a variable's value differs on both sides, a **Merge Conflicts** dialog opens so you can choose which value wins, row by row. See the [User Manual](user-manual.md#15-conflict-resolution--merge-dialog).

---

## Step 6 — Explore Your Variables

After syncing, variables appear in the left panel under:

- **Variables → Colors**
- **Variables → Fonts**
- **Variables → Numbers**

Each section shows a total count. Click any section or category name to open it in the edit space.

Each variable row shows:

| Column | Content |
|--------|---------|
| ⠿ | Drag handle |
| ● | Status dot (color = sync state) |
| **varies** | Depends on variable type |
| 🗑 | Delete (appears on hover) |

For Color Variables:

| Column | Content |
|--------|---------|
| Swatch | Color preview; click to open the color picker |
| Name | Variable property name |
| Comment | Field for recording comments |
| Value | Current value |
| Format | HEX / RGB / HSL |

For Font Variables:

| Column | Content |
|--------|---------|
| Sample Text | Brief preview of the font |
| Name | Variable property name |
| Comment | Field for recording comments |
| Value | Font family name |
| Format | System or Custom font family |

For Number Variables:

| Column | Content |
|--------|---------|
| Name | Variable property name |
| Comment | Field for recording comments |
| Value | Current value |
| Format | — (unitless), PX, %, EM, REM, VW, VH, CH, or fₓ (function, e.g. `clamp()`) |

---

## Step 7 — Organize into Categories

Variables arrive in **Uncategorized**. Organize them into a structure that matches your design system.

A set of default categories is available (configurable in **▦ Manage Projects**). You can add new categories and sub-categories, rename them, or delete them.

- **Rename a category** — click the category name text and type a new name
- **Add a category** — click ⊕ in the filter bar at the top of the variable type (Colors, Fonts, Numbers) view
- **Move variables** — drag by the ⠿ handle and drop into place in a category
- **Add a sub-category** — click ⊕ at the far right of a category header
- **Clean a category** — click the 🧹 broom to delete all the variables in a category
- **Duplicate a category** — click the 📋 copy icon to copy the category
- **Delete a category** — click 🗑 to remove the category (its variables move to Uncategorized first)

---

## Step 8 — Edit Variables

When working with Color variables, click any color **swatch** to open the Pickr visual color picker. Drag the color field and hue slider to choose, use the opacity slider for transparency, then click **Save**.

Click the **name** field to change the name of the variable.

Click the **comment** field to add any comments about the variable.

Click the **value** field directly in any row to type a value.

> For Color variables, accepted value shorthands are:
> - `fff` → `#FFFFFF` for HEX
> - `30, 37, 103` → `rgb(30, 37, 103)` for RGB
> - `51, 100, 50` → `hsl(51, 100%, 50%)` for HSL
>
> Click the **›** chevron, or right-click anywhere on the color row, to expand the color editor and generate tints, shades, and transparency variants from any base color.

---

## Step 9 — Save Your Work

The **💾 Save** icon in the toolbar glows red when you have unsaved changes. Click it to update your current project in place — every save writes a new timestamped backup snapshot, so nothing is silently overwritten.

> ATFRFO remembers your last active project and **reloads it automatically** on the next page load. There is no auto-*save* — you must click 💾 (or Save from the Project Manager) yourself.

---

## Step 10 — Write Back to Elementor (V4)

When you are ready to push your edited values to Elementor V4:

1. Click **⟳ Sync**, set the version toggle to **V4** and direction to **Export**.
2. ATFRFO shows a mandatory safety confirmation ("Stop, Before You Write To Elementor") — read it and click **I Understand – Continue**.
3. ATFRFO checks for conflicts against Elementor's current values; resolve any that appear, then a commit summary shows counts of modified / new / removed variables.
4. Click **Commit** (labelled **Synchronize** in the Sync modal, **Commit** in the summary dialog) to write the values to Elementor's kit data.
5. **Refresh the browser page** — Elementor's own Variables Manager reads from its stored data on page load, so you won't see the update reflected there until you reload.

> Always save your project before committing to Elementor. Writing to Elementor modifies live kit data.

> At present there is no push to Elementor V3. If this is important to your workflow, contact the developer.

---

## Where Everything Else Lives

Preferences, the Functions menu, Print/PDF, and manual Export/Import are all tucked inside **⋯ More** in the top-right of the toolbar — not separate icons.

| Item (under ⋯ More) | What it does |
|----------------------|-------------|
| **Preferences** | Theme, layout density, tooltips, confirmations, font size/contrast, button size, motion |
| **Functions → Diagnose & Clean Up** | Scans your project for duplicate variable names/categories and offers to clean them up |
| **Functions → Change Variable Types** | Placeholder — bulk format conversion, coming soon |
| **Print / PDF** | Generates a printable/PDF variable reference sheet, with an option to include comments |
| **Export / Import** | Download or load a portable `.atfrfo.json` project file |
| **Help** | Quick in-app reference |

For the full list of Preferences settings, see the [User Manual](user-manual.md#19-preferences). Note that default category lists and default variable formats are configured in **▦ Manage Projects**, not in Preferences.

---

## Troubleshooting

**Sync finds 0 variables**
→ Go to **Elementor → Site Settings → Save Changes** to regenerate the kit data, then sync again.

**Variables appear in the wrong set**
→ ATFRFO classifies by value pattern. Drag to the correct category manually.

**A "Merge Conflicts" dialog appears unexpectedly**
→ Normal behavior when a variable's value differs between ATFRFO and Elementor. Pick a winner per row (or "Keep all ATFRFO" / "Use all Elementor") and click **Apply & Continue**.

**Panel looks unstyled or broken**
→ Hard refresh (`Ctrl+Shift+R`). If the issue persists, deactivate and reactivate the plugin.

---

## What's Next

- Use **⋯ More → Export** to download a `.atfrfo.json` backup or share a project between sites
- Use **⋯ More → Print / PDF** to generate a PDF variable reference sheet — enable "Print comments" to include per-variable notes on the printout
- Use **⋯ More → Functions → Diagnose & Clean Up** to catch duplicate variables or categories before they cause confusion
- Try **▦ Manage Projects → Project Manager…** to create multiple projects (e.g., per client, per theme)
- Explore the **›** expand panel on any color for tints, shades, and transparency families

For everything else, see the **[User Manual →](user-manual.md)**

---

*© Jim Roberts / [JimRForge](https://jimrforge.com)*
