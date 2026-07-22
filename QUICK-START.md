# Atomic Framework Forge Quick Start Guide
## Atomic Framework Forge for Elementor — v1.3.0

> This guide gets you from zero to your first organized variable set in about ten minutes.
>
> For a complete feature reference, see the **[User Manual →](USER-MANUAL.md)**

---

## Before You Begin

You will need:

- A working **WordPress** installation (local or staging — not a live production site)
- **Elementor**  installed and active
- An active **Elementor Kit** (created automatically when Elementor is first installed)

Atomic Framework Forge works with both **Elementor V3** (Global Colors) and **Elementor V4** (CSS custom properties). You do not need to be on V4 to get started.

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

The top bar gives you access to everything. All buttons are icons; hover anyone to see a tooltip. It's split into two groups either side of the project name: app-level settings on the left, project actions on the right.

**Left side, next to the logo (app-level, not tied to a project):**
| Button | Action |
|--------|--------|
| ⚙ Gear | Preferences — theme, density, tooltip settings |
| fₓ | Functions — variable utilities |
| ? Help | Help |

**Center:** `Project:` The current project.

**Right side (left to right):**
| Button | Action |
|--------|--------|
| ▦ Grid | Manage Projects — create, rename, open, or delete projects |
| 💾 Save | Save Changes in place — glows red when unsaved changes exist |
| History | Change history |
| ⟳ Sync | Open the Sync modal — import from or export to Elementor |
| ⋯ More | Dropdown — Print / PDF, Export, Import |

---

## Step 4 — Create Your First Project

Click the **▦ Manage Projects** button.

In the picker that opens, type a project name in the **New project name** field and click **Create**. Atomic Framework Forge initializes an empty project. The project name appears in the toolbar center.

Your project is saved under `wp-content/uploads/aff/<your-project>/`.

---

## Step 5 — Import Variables from Elementor

Click the **⟳ Sync** button. The Sync modal opens and asks you to choose between Elementor versions 3 and 4. Version 3 has only the Elementor System Colors and any Custom Colors as variables; there are no classes or containers we can pull in from version 3. Version 4 provides all three atomic framework sets: variables, classes, and containers. Set the VERSION toggle to your source for loading into Atomic Framework forge.

Leave the DIRECTION toggle set to Import.

On a new project, the data sets are empty and it doesn't matter which IMPORT MODE is selected.

Click **Synchronize**. Atomic Framework Forge reads the active Elementor kit CSS, extracts all properties.


> **V3 → V4 migration:** Import your version three System Colors and Custom Colors and then push them out to V4. You can maintain the colors in Atomic Framework Forge.

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
| Format | HEX / RGB / HSL (Colors)|

For Font Variables:
| Column | Content |
|--------|---------|
| Sample Text | Very brief preview of font |
| Name |Variable property name |
| Comment | Field for recording comments |
| Value | Font family name |
| Format | System or Custom font family|

For Numbers Variables:

| Column | Content |
|--------|---------|
| Name | Variable property name |
| Comment | Field for recording comments |
| Value | Current value |
| Format | - (none), PX, %, EM, REM, VW, VH, CH, fx (function)|

---

## Step 7 — Organize into Categories

Variables arrive in **Uncategorized**. Organize them into a structure that matches your design system.

A set of default categories is presented for your use. You can add new categories and sub-categories, rename them, or delete them to set up a meaningful grouping of the Elementor variables.

- **Rename a category** — click the category name text and type a new name
- **Add a category** — click ⊕ in the filter bar at the bottom left of the variable type (Colors, Fonts, Numbers) header
- **Move variables** — drag by the ⠿ handle and drop into place in a category
- **Add a sub-category** — click ⊕ at the far right of a category header
- **Clean a category** — click the 🧹 broom to delete all the variables in a category
- **Duplicate a category** — click the 📋 copy icon to copy the category
- **Delete a category** — click 🗑 to remove the category

---

## Step 8 — Edit Variables

When working with Color variables, you can click any color **swatch** to open the Pickr visual color picker. Drag the color field and hue slider to choose, use the opacity slider for transparency, then click **Save**.

Click on the **name** field to change the name of the variable.

Click on the **comment** field to add any comments about the varaible.

Click the **value field** directly in any row to type a value. 

>For Color variables, accepted value shorthands are:
>  - :fff → #FFFFFF for type HEX,
>  - 30, 37, 103 → rgb(30, 37, 103) for RGB, and
  >- 51, 100, 50 → hsl(51, 100%, 50%) for HSL`
>
>Click the **›**, or right click anywhere on the Color line, to expand the color editor to generate tints, shades, transparency variants, dark and light mode variants from any base color.

---

## Step 9 — Save Your Work

The **💾 Save** icon in the toolbar glows red when you have unsaved changes. Click it to update your current project in place.

To create a **timestamped backup snapshot**, click **▦ Manage Projects** and use the Save action, or simply let Atomic Framework Forge auto-save on next project load.

> Atomic Framework Forge remembers your last active project and reloads it automatically on the next page load.

---

## Step 10 — Write Back to Elementor (V4)

When you are ready to push your edited values to Elementor version 4:

1. Click **⟳ Sync**, set Version to **V4** and Direction to **Export**.
2. A commit summary appears — review the count of modified / new / deleted variables.
3. Click **Synchronize** to write the values to your Elementor kit CSS.
4. Open Elementor to see the updated values reflected site-wide.

> Always save your project before committing to Elementor. Writing to Elementor modifies live kit data.

> At present there is no push to version 3 Elementor. It is not considered necessary. If the feature is important to you, please contact the developer and we will add it.

---

## Preferences

Click **⚙ Gear** for:

| Setting | What it does |
|---------|-------------|
| **Interface Theme** | Light / Dark mode |
| **Layout Density** | Compact / Normal / Comfortable |
| **Show Tooltips** | Enable / disable hover tooltips |
| **Extended Tooltips** | Longer tooltip descriptions |
| **Default Storage** | Location for project files |
| **Font Size** | Select 14 - 18px font |
| **Font Contrast** | Standard or High |
| **Menu Buttons** | Icon size and contrast |
| **Motion** | Reduce animations |

---

## Troubleshooting

**Sync finds 0 variables**
→ Go to **Elementor → Site Settings → Save Changes** to regenerate the kit CSS, then sync again.

**Variables appear in the wrong set**
→ Atomic Framework Forge classifies by value pattern. Drag to the correct category manually.

**Panel looks unstyled or broken**
→ Hard refresh (`Ctrl+Shift+R`). If the issue persists, deactivate and reactivate the plugin.

---

## What's Next

- Use **Export** to download a `.aff.json` backup or share a project between sites
- Use **Print** to generate a PDF variable reference sheet — enable "Print comments" in the options modal to include per-variable notes on the printout
- Try **Manage Projects** to create multiple projects (e.g., per client, per theme)
- Explore the **›** expand panel on any color for tints, shades, and transparency families

For everything else, see the **[User Manual →](USER-MANUAL.md)**

---

*© Jim Roberts / [JimRForge](https://jimrforge.com)*
