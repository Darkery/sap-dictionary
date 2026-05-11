# Changelog

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
