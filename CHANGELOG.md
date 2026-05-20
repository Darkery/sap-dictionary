# Changelog

## [0.1.7] - 2026-05-20

### Changed
- Improve Marketplace metadata: keywords, gallery banner, homepage; strengthen Rosetta CTA in README

---

## [0.1.6] - 2026-05-14

### Fixed
- Imported table and field names now normalized to uppercase on import — fixes lookup failure for CDS entity names like `com.sap.catalog::SystemArtifact`
- Hover alias resolution now supports quoted CDS names (`FROM "com.sap::Entity" AS alias`), schema-qualified names (`"SCHEMA"."table"`), and underscore-prefixed aliases (`_carr`, `_flsch`)

---

## [0.1.5] - 2026-05-12

### Fixed
- GIFs broken on VS Code Marketplace — switched to absolute GitHub raw URLs

---

## [0.1.4] - 2026-05-12

### Changed
- Exclude `tests/` and `vitest.config.ts` from VSIX package — reduces install size

---

## [0.1.3] - 2026-05-12

### Added
- **SQL alias resolution** — hover over `o.VBELN` now resolves alias `o` to `VBAK` by scanning `FROM/JOIN` clauses; works with both `AS alias` and bare alias syntax
- **Demo GIFs** in README — hover tooltip walkthrough and import workflow

### Changed
- `publish.sh` now creates a GitHub release automatically, attaching the VSIX and pulling release notes from CHANGELOG
- Alias map cached per document version — no repeated full-text scans on every hover

### Fixed
- SQL dot notation (`TABLE.FIELD`) not recognized as field access — only `~` and `-` (ABAP) were supported before

---

## [0.1.2] - 2026-05-11

### Added
- **Multiple JSON imports** — import as many metadata files as needed; each is stored independently and listed in the sidebar with filename, table count, and import time
- **Per-file delete** — remove a single imported file without affecting others; confirms before deleting
- **Field-level search results** — searching by field name or description now surfaces matching fields directly in the sidebar (not just the parent table)
- **Functional tests** — Vitest suite covering merge logic, import validation, lookup, and full-table-visibility regression

### Changed
- Sidebar webview redesigned: primary-styled import button, imported-files list with table count badges and relative timestamps
- Clear all imported data now updates the sidebar immediately
- Sidebar previously capped visible tables at 200 (alphabetically), hiding imported Z-tables — now shows all

### Fixed
- Imported Z-tables were silently hidden when more than 200 standard tables were present

---

## [0.1.1] - 2026-05-11

### Fixed
- Removed Azure PAT token accidentally packaged in the VSIX (`publish/.token` now excluded via `.vscodeignore`)

### Changed
- Replaced all placeholder URLs with deployed landing page `https://rosetta-landing.pages.dev`

---

## [0.1.0] - 2026-05-11

### Added
- Hover tooltips for SAP table and field names in `.abap`, `.sql`, `.hdbview`, `.hdbcalculationview`, `.hdbtable`, `.hdbprocedure` files
- Sidebar panel with browsable tree of all tables and fields
- Fuzzy search across table names, field names, and descriptions
- Bundled data: 674 tables and views with 16,700+ fields
  - ABAP standard tables: FI (Finance), MM (Materials), SD (Sales), HR, Basis (~115 tables)
  - HANA System Views: ~205 views
  - HANA Monitoring Views: ~354 views
- JSON import for custom Z-tables and system-specific metadata
- Lead gen CTA on missing descriptions ("Get AI-powered descriptions →")
- `SAP Dictionary: Import System Data (JSON)` command
- `SAP Dictionary: Clear Imported Data` command
- `SAP Dictionary: Search Tables & Fields` command
