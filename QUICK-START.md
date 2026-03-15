# EFF Quick Start Guide
## Elementor Framework Forge — Alpha 0.0.1

> **LytBox Academy Testing Edition**
> Welcome, and thank you for being an early tester. This guide gets you from zero to your first
> organized variable set in about ten minutes.

---

## Before You Begin

You will need:

- ✅ A working **WordPress** installation (local or live)
- ✅ **Elementor** (free) — installed and active
- ✅ **Elementor Pro** — installed and active
- ✅ At least one **Elementor Kit** configured with CSS variables
  *(If your site uses Elementor's Site Settings → Global Colors or Typography, you already have these)*

> **Alpha note:** EFF is read-only-safe. It will never modify your Elementor kit unless you
> explicitly click **Commit to Elementor**. Feel free to explore.

---

## Step 1 — Install EFF

### Clone from GitHub (recommended)

Open a terminal and navigate to your WordPress plugins directory:

```bash
cd wp-content/plugins
git clone https://github.com/Mij-Strebor/elementor-framework-forge.git
```

### Or download a ZIP

Click **Code → Download ZIP** on the GitHub repository page. Unzip into
`wp-content/plugins/elementor-framework-forge/`.

### Activate

1. Go to **WordPress Admin → Plugins → Installed Plugins**.
2. Find **Elementor Framework Forge** and click **Activate**.
3. You should see **EFF** appear in your WordPress admin sidebar.

> If EFF shows an error about missing dependencies, make sure both Elementor and
> Elementor Pro are installed and active.

---

## Step 2 — Open EFF

Click **EFF** in the WordPress admin sidebar. You will see the four-panel interface:

```
┌──────────────────────────────────────────────────────────────┐
│  TOP BAR  — Preferences · Manage Project  ···  Sync · Help  │
├────────────┬──────────────────────────────────┬──────────────┤
│            │                                  │              │
│  LEFT NAV  │     CENTER EDIT SPACE            │  RIGHT PANEL │
│            │                                  │              │
│ Variables  │  (Select a category from the     │  filename    │
│  Colors    │   left panel to begin)           │  Load / Save │
│  Fonts     │                                  │              │
│  Numbers   │                                  │  Vars: 0     │
│ Classes    │                                  │  Classes: 0  │
│ Components │                                  │  Comps: 0    │
└────────────┴──────────────────────────────────┴──────────────┘
```

On first load, the edit space shows a placeholder banner. That's expected — nothing has been loaded yet.

---

## Step 3 — Sync Your Variables from Elementor

Click the **Sync** button in the top-right of the top bar (circular arrows icon ↻).

EFF will:
1. Locate your active Elementor kit CSS file automatically.
2. Read the `:root {}` block containing your CSS custom properties.
3. Classify each variable as **Color**, **Font**, or **Number** based on its value.
4. Add new variables to your working state (existing ones are never overwritten).
5. Run a usage scan to count how many Elementor widgets reference each variable.

A summary modal shows how many variables were imported and which CSS file was used.

> **If the sync finds 0 variables:** Your Elementor kit may not have custom CSS variables
> defined yet, or Elementor may not have generated its kit CSS file. Go to
> **Elementor → Site Settings → Save Changes** to regenerate it, then try Sync again.

---

## Step 4 — Explore Your Variables

After syncing, your variables appear organized in the left panel under:

- **Variables → Colors** — hex, rgb, hsl, and rgba values
- **Variables → Fonts** — font family values (e.g., `'Inter', sans-serif`)
- **Variables → Numbers** — sizes, spacing, clamp() values, and unitless numbers

Click any category name in the left panel to open it in the center edit space.

Each variable row shows:
- **⠿** Drag handle — reorder by dragging
- **●** Status dot — green = synced from Elementor, orange = modified, blue = new
- **Color swatch** — live preview of the color value (Colors only)
- **Variable name** — the CSS custom property name (click to rename)
- **Value** — the current value (click to edit)
- **Format** — HEX / RGB / HSL / REM / PX / etc.
- **Usage badge** — how many Elementor widgets use this variable (gold = used, gray = unused)

---

## Step 5 — Organize into Categories

Variables land in **Uncategorized** by default. You can create your own categories to organize them logically (Brand, Background, Text, etc.).

### Add a category

Click the **⊕** circle button at the bottom-left of the edit space (below all the category blocks). Type a name and press Enter.

### Move a variable to a category

Drag any variable row by its **⠿** handle and drop it onto the target category header or into the category's variable list.

### Add a variable manually

Each category block has an **⊕** Add Variable button at its bottom-left. Click it to create a new variable inside that category.

### Category actions

Each category header has three action buttons (top-right corner):
- **Copy** — Duplicate the category and all its variables
- **Trash** — Delete the category (variables move to Uncategorized)
- **Chevron** — Collapse / expand the category

### Sort a category

Each category block has sort arrow buttons in the column header row (above the variable list):
- Click the **Name** sort arrows to sort variables alphabetically
- Click the **Value** sort arrows to sort by value

---

## Step 6 — Save Your Project

Type a filename in the **right panel** input box (e.g., `my-project.eff.json`) and click **Save**.

EFF saves your project as a `.eff.json` file in:
```
/wp-content/uploads/eff/my-project.eff.json
```

To reload your project in a future session:
1. Type the filename in the right panel
2. Click **Load**

> **Save often.** In Alpha, there is no auto-save. Changes not saved to a `.eff.json` file
> will be lost if you navigate away or refresh the page.

---

## Step 7 — Commit to Elementor (Optional)

If you edit a variable's value and want to push it back to Elementor's kit CSS:

1. Edit a variable value in the edit space.
2. The **Commit** button in the top bar becomes active.
3. Click **Commit** to write your changes back to the Elementor kit CSS file.
4. Go back into Elementor to see the updated values reflected site-wide.

> **Important:** Committing modifies your Elementor kit CSS file. This is safe but
> irreversible without Elementor's own version history. Commit only when you're confident
> in your values.

---

## Preferences

Click the **⚙ gear icon** in the top-left to open Preferences:

| Setting | What it does |
|---------|-------------|
| **Interface Theme** | Switch between Light and Dark mode |
| **Default Storage File** | Filename to pre-fill in the right panel |
| **Show Tooltips** | Enable / disable hover tooltips on all buttons |
| **Extended Tooltips** | Show longer descriptions in tooltips |

---

## Interface Theme

EFF ships with two themes built on the JimRForge brand palette (warm brown + gold):

- **Light** — Deep brown on warm cream
- **Dark** — Light cream on warm charcoal brown

Your preference is saved automatically to your WordPress user account.

---

## Known Alpha Limitations

| Area | Status |
|------|--------|
| Classes and Components panels | Navigation shown but content not yet built |
| Export / Import | Placeholder only — coming in a future release |
| Change history / Undo | Not yet built — use Ctrl+Z within an input field only |
| Fonts variable editing | Value input works; font preview forthcoming |
| Auto-save | Not implemented — save manually and often |
| Mobile devices | Not supported (min 1024px screen required) |

---

## Troubleshooting

**Sync finds 0 variables**
→ Go to Elementor → Site Settings → click Save Changes to regenerate the kit CSS, then Sync again.

**"No file loaded" error when saving**
→ Type a filename first, then click Save. The filename must end in `.eff.json`.

**Variables appear in the wrong set (e.g., a color in Numbers)**
→ EFF uses value patterns to classify variables. You can drag a variable to the correct category manually.

**After committing, Elementor variables look wrong**
→ Go to Elementor → Site Settings and regenerate the CSS file. If values look corrupted, restore from a backup and report the issue in LytBox Academy.

**The panel looks broken or unstyled**
→ Try a hard refresh (Ctrl+Shift+R). If the issue persists, clear your browser cache.

---

## Giving Feedback

Your testing feedback directly shapes EFF's development. When reporting:

1. **What you were doing** — Which panel, which action
2. **What you expected** — What you thought would happen
3. **What happened** — What actually occurred (include any browser console errors if possible)
4. **Your setup** — WordPress version, Elementor version, browser

Report in the **LytBox Academy** community portal.

---

## What's Next

Once you're comfortable with the basics:

- Try the **color swatch expand panel** — click the chevron `›` at the right of any color row to generate tints, shades, and transparency variants.
- Use the **Manage Project** button (grid icon, top bar) to edit the default category lists.
- Try the **Preferences → Dark mode** for a different look.
- Explore **usage badges** — the gold pills on each variable show how many Elementor widgets reference that variable. Unused variables (gray outline) might be safe to clean up.

---

*© Jim Roberts / [JimRForge](https://jimrforge.com) — Distributed through [LytBox Academy](https://lytbox.com)*
