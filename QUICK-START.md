# AFF Quick Start Guide
## Atomic Framework Forge for Elementor — Beta 0.3.3

> This guide gets you from zero to your first organized variable set in about ten minutes.
>
> For a complete feature reference, see the **[User Manual →](USER-MANUAL.md)**

---

## Before You Begin

You will need:

- ✅ A working **WordPress** installation (local or live)
- ✅ **Elementor** and **Elementor Pro** — installed and active
- ✅ At least one **Elementor Kit** configured with Elementor Version 4 CSS variables *A non-production website with Elementor Version 4 active and one or more pages using atomic elements*
- ✅ A wild bunch of crazy **Version 4 Variables** on these pages

> **Beta note:** AFF is read-first and non-destructive. It will never modify your Elementor kit unless you explicitly click **Commit to Elementor**. (Not yet active) Feel free to explore.

---

## Step 1 — Install AFF

### Clone from GitHub

Open a terminal and navigate to your WordPress plugins directory:

```bash
cd wp-content/plugins
git clone https://github.com/Mij-Strebor/atomic-framework-forge-for-elementor.git
```

### Or download a ZIP (recommended)

Click **Code → Download ZIP** on this GitHub repository page.
 You can Plugins > Add Plugin > Upload Plugin > Choose file in WordPress then select and install ***atomic-framework-forge-for-elementor-0.3.3-Beta.zip***

or unzip directly into your `wp-content/plugins/atomic-framework-forge-for-elementor/`.

### Activate

1. Go to **WordPress Admin → Plugins → Installed Plugins**.
2. Find **Atomic Framework Forge for Elementor** and click **Activate**.
3. You should see **AFF** appear in your WordPress admin sidebar.

> If AFF shows an error about missing dependencies, make sure both Elementor and Elementor Pro are installed and active.

---

## Step 2 — Open AFF

Click **AFF** in the WordPress admin sidebar. You will see the four-panel interface:

- **Top bar** — Preferences, Manage Project, Sync, Functions
- **Left panel** — Variable tree: Colors / Fonts / Numbers
- **Center** — Edit space (variables and categories)
- **Right panel** — All data management controls

On first load, the edit space shows a placeholder. That is expected — nothing has been loaded yet.

---

## Step 3 — Understand the Right Panel

**All data operations live in the right panel.** There are no hidden menus. The right panel has five sections:

| Section | What it does |
|---------|-------------|
| **Active Project** | Shows the current project name; Open / Switch Project button |
| **Save & Backups** | Save Project (new snapshot) · Save Changes (update current) |
| **Elementor Sync** | Pull variables from Elementor V4 Variables· Commit changes back to Elementor |
| **Elementor V3 Import** | Import V3 Global Colors into the current project |
| **Export / Import** | Download/upload the project as a portable `.aff.json` file |

> **The only automatic operation is startup auto-load.** AFF reloads your last active project when you open the plugin. Everything else requires a deliberate action from you.

---

## Step 4 — Pull Your Variables from Elementor

In the right panel under **Elementor Sync**, click **↓ Variables**.

AFF will:
1. Locate your active Elementor kit CSS file automatically.
2. Read the `:root {}` block containing your V4 Variables.
3. Classify each variable as **Color**, **Font**, or **Number** based on its value.
4. Import all variables into your project.
5. Run a usage scan to count how many Elementor widgets reference each variable.

A summary appears when the sync completes.

> **If the sync finds 0 variables:** Your Elementor kit may not have custom CSS variables yet, or the kit CSS may not have been generated. Go to **Elementor → Site Settings → Save Changes** to regenerate it, then try again.

---

## Step 5 — Explore Your Variables

After syncing, your variables appear in the left panel under:

- **Variables → Colors** — hex, rgb, hsl, and rgba values
- **Variables → Fonts** — font family values (e.g., `'Inter', sans-serif`)
- **Variables → Numbers** — sizes, spacing, clamp() values, and other numbers

Click any category name in the left panel to open it in the center edit space. All categories will now be available in the edit space and the selected category will be open with its contents available for editing.

Each variable row in the open category shows:
- **⠿** Drag handle — reorder by dragging
- **●** Status dot — green = synced, orange = modified, blue = new, red = deleted
- **Sample swatch** — live preview of variable (a color swatch for Colors variables); click to expand.
- **Variable name** — the CSS custom property; click to rename
- **Value** — current value; click to edit directly
- **Format** — HEX / RGB / HSL (Colors) or REM / PX / % etc. (Numbers)
- **›** Expand chevron — Expanded edit (on Color variables, opens the tint/shade/transparency modal) 
- **Usage badge** — how many Elementor widgets use this variable

---

## Step 5a — Use the Color Picker

Click any **color swatch** to open the Pickr visual color picker.

- Drag the color field and hue slider to choose a color
- Use the opacity slider for semi-transparent colors
- Click **Save** to apply

The variable value, the swatch, and any tints/shades/transparencies all update immediately.

> **Format notes:**
> - **HEX** — `#FF5733` (opaque) or `#FF573380` (with alpha) You can omit the '#' on your entry. The three or four digit shorthand expands:  `fff` → `#FFFFFF` and  `f00a` → `#FF0000AA`
> - **RGB** — `rgb(r, g, b)`; alpha auto-switches to `rgba()` when opacity < 1 You can enter three or four integers as shorthand: '30, 37 103' → rgb(30, 37, 103)
> - **HSL** — `hsl(h, s%, l%)`; alpha auto-switches to `hsla()` when opacity < 1 You can enter three or four integers as shorthand: '51, 100 50' → hsl(51, 100%, 50%)
>

---

## Step 6 — Organize into Categories

Variables arrive in **Uncategorized** by default. Organize them into categories that reflect your design system.

**Add a category** — click the **⊕** button in the filter bar (top of the edit space).

**Move a variable** — drag it by the **⠿** handle and drop it into the target category.

**Add a variable manually** — each category has an **⊕ Add Variable** button at its bottom-left.

**Category actions** (buttons in each category header):
- **Copy** — duplicate the category and all its variables
- **↑ / ↓** — move the category up or down
- **Trash** — delete the category; variables move to Uncategorized
- **Chevron** — collapse / expand the rows

**Sort variables** — click the **A↑ A↓** buttons in the filter bar to sort alphabetically.

---

## Step 7 — Explore the Expand Panel (Colors)

Click the **›** chevron at the right of any color row.

Inside the expand panel:
- **Header** — edit name, value, format; click the swatch for the color picker
- **Tints** — generate up to 10 progressively lighter tints
- **Shades** — generate up to 10 progressively darker shades
- **Transparencies** — toggle on to generate 9 fixed-alpha transparency variants

All preview bars update live when you change the color.

---

## Step 8 — Save Your Project (Create a Backup)

In the right panel under **Save & Backups**, click **Save Project**.

AFF creates a timestamped snapshot:

```
/wp-content/uploads/aff/my-project/my-project_2026-03-19_14-30-00.aff.json
```

Every **Save Project** adds a new snapshot — nothing is overwritten. You can accumulate up to 10 snapshots per project (configurable in Manage Project).

**Save Changes** updates the current snapshot in place — use this for quick saves between checkpoints.

> AFF remembers your last active project and reloads it automatically on the next startup.

---

## Step 9 — Open a Project or Restore a Backup

Click **Open / Switch Project** in the right panel.

**Level 1 — Projects:** shows all projects on this site. Click **Open** on any project.

**Level 2 — Backups:** shows all snapshots for that project, newest first. Click **Load** to restore a snapshot. Click the trash icon to delete one.

Click **←** to return to the project list without loading anything.

---

## Step 10 — Commit to Elementor (Optional)

When you are ready to push your edited values back to Elementor:

1. Edit a variable value in the edit space — the status dot turns orange (modified).
2. Click **↑ Variables** under **Elementor Sync** in the right panel.
3. A summary shows how many variables will be updated / added / deleted.
4. Click **Commit** to write to Elementor's kit CSS.
5. Open Elementor to see the updated values reflected site-wide.

> **Important:** Committing modifies your Elementor kit CSS. This is reversible by restoring a backup in AFF, but it is good practice to Save Project first so you have a clean snapshot before you commit.

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
| **Show Tooltips** | Enable / disable hover tooltips on all buttons |
| **Extended Tooltips** | Show longer descriptions in tooltips |

**Manage Project** (grid icon in top bar):
- Edit the default category lists for Colors, Fonts, and Numbers
- Set the maximum number of backups per project (default 10)

---

## Interface Theme

AFF ships with two themes built on the JimRForge brand palette:

- **Light** — Deep brown on warm cream
- **Dark** — Light cream on warm charcoal brown

Your preference is saved to your WordPress user account.

---

## What's Not in Beta Yet

| Area | Status |
|------|--------|
| Classes panel | Navigation visible — content coming in Phase 3 |
| Components panel | Navigation visible — content coming in Phase 4 |
| Sync options dialog (Sync by name / Clear and replace) | ✅ Implemented |
| Commit summary dialog | ✅ Implemented |
| Elementor V3 Global Colors import | ✅ Implemented |
| Mobile devices | Not supported (min 1024px screen required) |
| Batch format conversion | Per-variable format change works; batch "convert all" planned for 1.0 |

---

## Troubleshooting

**Sync finds 0 variables**
→ Go to Elementor → Site Settings → click Save Changes to regenerate the kit CSS, then sync again.

**Variables appear in the wrong set (e.g., a color in Numbers)**
→ AFF uses value patterns to classify variables. Drag the variable to the correct category manually.

**Color picker swatch shows black**
→ Try a hard refresh (Ctrl+Shift+R). Pickr loads from a CDN — a failed load causes the blank swatch.

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

- Click the **color variables expand** on a Colors Variables entry to generate tints, shades, and transparency variants
- Use **Manage Project** to configure default category lists for your workflow
- Try **Save Project** several times and practice **restoring an older backup** via Open / Switch Project
- Try **Export** to download a portable copy of your project to have a "hard" backup and to move your set of variables to another website.

For everything else, see the **[User Manual →](USER-MANUAL.md)**

---

*© Jim Roberts / [JimRForge](https://jimrforge.com)