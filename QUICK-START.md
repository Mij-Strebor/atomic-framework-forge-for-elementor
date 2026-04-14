# AFF Quick Start Guide
## Atomic Framework Forge for Elementor — Beta 0.4.1

> This guide gets you from zero to your first organized variable set in about ten minutes.
>
> For a complete feature reference, see the **[User Manual →](USER-MANUAL.md)**

---

## Before You Begin

You will need:

- ✅ A working **WordPress** installation (local or live)
- ✅ **Elementor** and **Elementor Pro** — installed and active
- ✅ At least one **Elementor Kit** configured with Elementor Version 4 CSS variables
- ✅ A non-production website with Elementor Version 4 active and one or more pages using atomic elements
- ✅ A set of **Version 4 Variables** defined on those pages

> **Beta note:** AFF is read-first and non-destructive. It will not modify your Elementor kit unless you explicitly click **Write to Elementor**. Feel free to explore.

---

## Step 1 — Install AFF

### Clone from GitHub

Open a terminal and navigate to your WordPress plugins directory:

```bash
cd wp-content/plugins
git clone https://github.com/Mij-Strebor/atomic-framework-forge-for-elementor.git
```

### Or download a ZIP (recommended)

Click **Code → Download ZIP** on the GitHub repository page.
You can go to **Plugins → Add Plugin → Upload Plugin → Choose file** in WordPress, then select and install **atomic-framework-forge-for-elementor-0.4.1-beta.zip**.

Or unzip directly into `wp-content/plugins/atomic-framework-forge-for-elementor/`.

### Activate

1. Go to **WordPress Admin → Plugins → Installed Plugins**.
2. Find **Atomic Framework Forge for Elementor** and click **Activate**.
3. **AFF** will appear in your WordPress admin sidebar.

> If AFF shows an error about missing dependencies, make sure both Elementor and Elementor Pro are installed and active.

---

## Step 2 — Open AFF

Click **AFF** in the WordPress admin sidebar. You will see the four-panel interface:

- **Top bar** — Preferences, Manage Project, Functions (left side); History, Search, Help (right side)
- **Left panel** — Variable tree: Colors / Fonts / Numbers — with variable counts per class and category
- **Center** — Edit space (variables and categories); shows a startup banner on first load
- **Right panel** — All data management controls

On first load the edit space shows a startup banner with a reminder to read this guide. That is expected — nothing has been loaded yet.

---

## Step 3 — Understand the Right Panel

**All data operations live in the right panel.** There are no hidden menus. The right panel has four sections:

| Section | What it does |
|---------|-------------|
| **Active Project** | Shows the current project name; Save Changes (update in place); Open/Switch Project |
| **Save** | Save Project — creates a new timestamped backup snapshot |
| **Elementor 4 Sync** | **Fetch Elementor** — pull variables from the active V4 kit · **Write to Elementor** — commit your changes back |
| **Export / Import** | Download/upload the project as a portable `.aff.json` file |

> **The only automatic operation is startup auto-load.** AFF reloads your last active project when you open the plugin. Everything else requires a deliberate action from you.

---

## Step 4 — Pull Your Variables from Elementor

In the right panel under **Elementor 4 Sync**, click **Fetch Elementor**.

AFF will:
1. Locate your active Elementor kit CSS file automatically.
2. Read the `:root {}` block containing your V4 Variables.
3. Classify each variable as **Color**, **Font**, or **Number** based on its value.
4. Import all variables into your project.
5. Run a usage scan to count how many Elementor widgets reference each variable. [*Not yet implemented*]

A summary appears when the sync completes.

> **If the sync finds 0 variables:** Your Elementor kit may not have custom CSS variables yet, or the kit CSS may not have been generated. Go to **Elementor → Site Settings → Save Changes** to regenerate it, then try again.

---

## Step 5 — Explore Your Variables

After syncing, your variables appear in the left panel under:

- **Variables → Colors** — hex, rgb, hsl, and rgba values
- **Variables → Fonts** — font family values (e.g., `'Inter', sans-serif`)
- **Variables → Numbers** — sizes, spacing, clamp() values, and other numbers

Each class (Colors, Fonts, Numbers) shows a total variable count next to its label. Each category inside a class shows a count of how many variables it contains.

Click any category name in the left panel to open it in the center edit space. All categories will be available in the edit space and the selected category will be open with its contents ready for editing.

Each variable row in the open category shows:

- **⠿** Drag handle — reorder by dragging
- **●** Status dot — green = synced, orange = modified, blue = new, red = deleted
- **Sample** — live preview (color swatch for Colors; "Aa" preview for Fonts)
- **Variable name** — the CSS custom property; click to rename
- **Value** — current value; click to edit directly
- **Format** — HEX / RGB / HSL (Colors) or REM / PX / % / fₓ etc. (Numbers)
- **›** Expand chevron — opens the expanded editor (Color variables: tints, shades, transparency modal)
- **Usage badge** — how many Elementor widgets use this variable [*Not yet implemented*]

---

## Step 6 — Use the Color Picker

You can edit the color manually, or us a color picker tool. Open the expanded view of a color and then click its **color swatch** to open the Pickr visual color picker.

- Drag the color field and hue slider to choose a color
- Use the opacity slider for semi-transparent colors
- Click **Save** to apply

The variable value, the swatch, and any tints/shades/transparencies all update immediately.

> **Format shorthand:**
> When editing colors manually, you have several shorthand options for entering a color.
> - **HEX** — `#rrggbb`
-1. Immdiate alpha entry: `#FF5733` (opaque) or `#FF573380` (with alpha).
-2. You can omit the `#`or type it at the beginning of the HEX value. 
-3. Three or four digit shorthand expands: `fff` → `#FFFFFF`, `f00a` → `#FF0000AA`
> - **RGB** — `rgb(r, g, b)`;
-1. alpha auto-switches to `rgba()` when opacity < 1.
 -2. Enter three or four integers as shorthand: `30, 37, 103` → `rgb(30, 37, 103)`
> - **HSL** — `hsl(h, s%, l%)`; 
-1. alpha auto-switches to `hsla()` when opacity < 1. 
-2. Enter three or four integers as shorthand: `51, 100, 50` → `hsl(51, 100%, 50%)`

---

## Step 7 — Organize into Categories

Variables arrive in **Uncategorized** by default. Organize them into categories that reflect your design system.

**Add a category** — click the **⊕** button in the class filter bar (top of the edit space).

**Move a variable** — drag it by the **⠿** handle and drop it into the target category.

**Add a variable manually** — each category has an **⊕ Add Variable** button at its bottom-left.

**Category actions** (buttons in each category header):
- **Copy** — duplicate the category and all its variables
- **Trash** — delete the category; variables move to Uncategorized
- **Chevron** — collapse / expand the rows

**Sort variables** — click the **A↑ A↓** buttons in the filter bar to sort alphabetically.

**Collapse / expand all categories** — use the double-chevron button in the filter bar to toggle the displays of all color categories.

---

## Step 8 — Explore the Expand Panel (Colors)

Click the **›** chevron at the right of any color row.

Inside the expand panel:
- **Header** — edit name, value, format; click the swatch for the color picker
- **Tints** — generate up to 10 progressively lighter tints
- **Shades** — generate up to 10 progressively darker shades
- **Transparencies** — toggle on to generate 9 fixed-alpha transparency variants

All preview bars update live when you change the color.

---

## Step 9 — Save Your Project (Create a Backup)

In the right panel under **Save**, click **Save Project**.

AFF creates a timestamped snapshot:

```
/wp-content/uploads/aff/my-project/my-project_2026-03-19_14-30-00.aff.json
```

Every **Save Project** adds a new snapshot — nothing is overwritten. You can accumulate up to 10 snapshots per project (configurable in Manage Project).

**Save Changes** (in the Active Project section) updates the current snapshot in place — use this for quick saves between checkpoints.

> AFF remembers your last active project and reloads it automatically on the next startup.

---

## Step 10 — Open a Project or Restore a Backup

Click **Open/Switch Project** in the right panel.

**Level 1 — Projects:** shows all projects on this site. Click **Open** on any project.

**Level 2 — Backups:** shows all snapshots for that project, newest first. Click **Load** to restore a snapshot. Click the trash icon to delete one.

Click **←** to return to the project list without loading anything.

---

## Step 11 — Write to Elementor (Optional)

When you are ready to push your edited values back to Elementor:

1. Edit a variable value in the edit space — the status dot turns orange (modified).
2. Click **Write to Elementor** under **Elementor 4 Sync** in the right panel.
3. A summary shows how many variables will be updated / added / deleted.
4. Click **Commit** to write to Elementor's kit CSS.
5. Open Elementor to see the updated values reflected site-wide.

> **Important:** Writing to Elementor modifies your kit CSS. This is reversible by restoring a backup in AFF, but it is good practice to **Save Project** first so you have a clean snapshot before you commit.

---

## Export and Import

**Export** — downloads the entire current project as a `.aff.json` file to your disk. Use this to share a project between WordPress sites or to keep an off-server copy.

**Import** — uploads a `.aff.json` file and replaces the current project with its contents. You will be warned if the current project has unsaved changes.

Export and import are **complete replacements**, not merges.

---

## Preferences

Click the **⚙ gear icon** in the top bar to open Preferences:

| Setting | What it does |
|---------|-------------|
| **Interface Theme** | Switch between Light and Dark mode |
| **Layout Density** | Switch between Compact, Normal, and Comfortable spacing|
| **Show Tooltips** | Enable / disable hover tooltips on all buttons |
| **Extended Tooltips** | Show longer descriptions in tooltips |
| **Default Storage File** | Path to AFF storage in WordPress |
| **Typography & Contrast** | AFF font size and color contrast settings |
| **Menu Buttons** | Size, contrast and style of menu button icons |
| **Motion** | Reduce animations |

## **Manage Project** (grid icon in top bar):
| Setting | What it does |
|---------|-------------|
| **Project Name** | Rename the current project or switch to a different project |
| **Color Categories** | Comma separated list of default categories |
| **Font Categories** | Comma separated list of default categories |
| **Number Categories** | Comma separated list of default categories |
| **Max Backups** | Maximum number of backups for a project |
| **Default Format** | Default variable type |

---

## Interface Theme

AFF ships with two themes built on the JimRForge brand palette:

- **Light** — Deep brown on warm cream
- **Dark** — Light cream on warm charcoal brown

Your preference is saved to your WordPress user account.

---

## Beta Status

| Area | Status |
|------|--------|
| Classes panel | Navigation visible — content coming in Phase 3 |
| Components panel | Navigation visible — content coming in Phase 4 |
| Sync options dialog (Sync by name / Clear and replace) | ✅ Implemented |
| Commit summary dialog | ✅ Implemented |
| Mobile devices | Not supported (min 1024px screen required) |
| Batch format conversion | Per-variable format change works; batch "convert all" planned for 1.0 |
| Elementor V3 Global Colors import | UI button coming in a future beta |

---

## Troubleshooting

**Sync finds 0 variables**
→ Go to Elementor → Site Settings → click Save Changes to regenerate the kit CSS, then sync again.

**Variables appear in the wrong set (e.g., a color in Numbers)**
→ AFF uses value patterns to classify variables. Drag the variable to the correct category manually.

**Color picker swatch shows black**
→ Try a hard refresh (Ctrl+Shift+R). If the issue persists, check the browser console for load errors and report them.

**After committing, Elementor variables look wrong**
→ Restore a backup in AFF, then commit again. If values look corrupted, report the issue on GitHub with the browser console log.

**The panel looks broken or unstyled**
→ Hard refresh (Ctrl+Shift+R). If the issue persists, clear your browser cache.

---

## Giving Feedback

Your testing feedback directly shapes AFF's development. When reporting:

1. **What you were doing** — Which panel, which action
2. **What you expected** — What you thought would happen
3. **What happened** — What actually occurred (include browser console errors if possible)
4. **Your setup** — WordPress version, Elementor version, AFF version, browser

Report issues at https://github.com/Mij-Strebor/atomic-framework-forge-for-elementor/issues

---

## What's Next

Once you're comfortable with the basics:

- Click the **›** expand chevron on a Colors variable to generate tints, shades, and transparency variants
- Use **Manage Project** to configure default category lists for your workflow
- Try **Save Project** several times and practice **restoring an older backup** via Open/Switch Project
- Try **Export** to download a portable copy of your project for a hard backup or to move your variables to another site
- Use **Save Project** in your **blueprint** website to build a master set of variables, classes, and components. Export to a master json file and create copies for new projects.
- 
For everything else, see the **[User Manual →](USER-MANUAL.md)**

---

*© Jim Roberts / [JimRForge](https://jimrforge.com)*
