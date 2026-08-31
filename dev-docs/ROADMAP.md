# Atomic Framework Forge — Roadmap

Items are listed roughly in priority order. Nothing here is a commitment — this is a working plan, not a release schedule.

---

## Roadmap Phases (do not build ahead of phase)

| Phase | Scope | Status |
|-------|-------|--------|
| **v1.x** | Full Variables workflow: sync, organize, edit, backup, commit to Elementor | **Current — 1.5.0** |
| **v2.0** | Classes management; Change History log (currently a placeholder button, no log behind it) | Planned |
| **v3.0** | Components registry; Elementor Kit Manager API write-back | Planned |
| **Future** | Standalone Windows/Mac desktop application | Roadmap |

Do not build ahead of the current phase without explicit instruction from Jim.

---

## Feature Ideas (not yet phased — candidates for a future roadmap pass)

Ideas Jim has raised for AFF but not yet scoped into a specific version phase above.
Captured here so they aren't lost — these are candidates to evaluate, not commitments.

1. **Read Fluid Space Forge / Fluid Font Forge JSON files** — investigate whether AFF could
   import FSF's and FFF's saved size/scale JSON data directly, rather than requiring manual
   re-entry of the same spacing/typography scale in both places.
2. **Built-in fluid generators for on-install classes** — for every class AFF ships as an
   always-present, suggested on-install class, have a matching fluid `clamp()` generator
   (spacing, radii, font weights, and anything else worth generating), with easy editing,
   integrated directly into AFF's Elementor v4 class management — effectively folding a whole
   raft of FSF/FFF-style fluid generators into AFF itself rather than requiring a separate
   plugin per asset type.
3. **Visual connection between FSF and FFF output** — some UI signal in AFF showing where a
   space value it manages and a font value FFF manages are related/intended to work together
   (e.g., a heading's font-size scale paired with its margin scale).
4. **In-app "what's new" signage** — surface new AFF features to users inside the plugin
   itself, not just in the readme.txt changelog (mirrors the same "what's new" visibility
   goal just addressed for FSF's WordPress.org changelog ordering).
5. **Native Elementor/Bricks JSON export + import (cross-platform portability)** — let a user
   export AFF-controlled data as a JSON file in Elementor's own native backup/export format
   (and separately, in Bricks' own native format), and import a file in either format back
   into AFF for editing/categorizing/re-managing. Goal: AFF becomes a cross-platform transfer
   hub, not just an Elementor-only tool. Key risk, not a side note: Elementor's and Bricks'
   JSON schemas are unversioned/undocumented and can change between releases with no notice —
   this is an ongoing maintenance commitment, not a one-time adapter build. Proposed shape:
   AFF keeps its own stable internal format; a thin adapter per external platform
   (Elementor adapter, Bricks adapter) handles the translation and stamps a schema
   fingerprint into each exported file. On import, AFF checks that fingerprint against the
   current adapter's expected shape and warns the user explicitly if the source file's
   structure looks like it predates a schema change, rather than silently misreading it.
   Also probe both plugins' own backup/revision storage (Elementor's own JSON backups,
   Bricks' own template/backup archive) as a possible read source — if either changed its
   backup format at some point, AFF's importer may need to handle more than one historical
   shape and re-emit in the current one.

**Where existing specs live:** `dev-docs/archive/specification/` has specs for Colors, Fonts,
Numbers, Variables, and Data Management, all written before/during the v1.4.0 Variables
implementation. There is no existing spec for Classes (v2.0) yet — idea #2 above should
inform that spec once Classes work actually starts, since it directly touches what a "class"
in AFF is and how it gets generated.

---

## Completed

See `CHANGELOG.md` for the shipped version history.
