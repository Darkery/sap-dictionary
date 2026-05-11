# Development Guide

## Setup

```bash
npm install
```

## Build

```bash
npm run build        # one-time build
npm run watch        # watch mode (rebuilds on file change)
```

Output goes to `out/extension.js`.

## Run in Development

Press **F5** in VS Code to launch the Extension Development Host.
This runs `npm run build` automatically via the pre-launch task.

To test hover tooltips, open any `.sql`, `.abap`, or `.hdb*` file and hover over a table/field name (e.g. `MARA`, `MATNR`).

## Testing

```bash
npm test             # run all tests once
npm run test:watch   # watch mode
npm run test:coverage
```

Tests live in `tests/` and use [Vitest](https://vitest.dev). The `vscode` module is aliased to a lightweight mock so tests run in plain Node without an extension host.

Sample import fixtures for manual and automated testing are in `tests/fixtures/`.

## Data Pipeline

The bundled data at `data/sap-standard.json` is generated from two scrapers:

```bash
# 1. Scrape ABAP tables from sapdatasheet.org
python3 scripts/scrape_sapdatasheet.py

# 2. Scrape HANA views from help.sap.com
python3 scripts/scrape_hana_views.py

# 3. Merge into sap-standard.json
python3 scripts/merge_data.py
```

Raw scraper output is saved to `scripts/abap_tables.json` and `scripts/hana_views.json`.

## Import JSON Format

Users can import custom Z-table metadata. The expected format:

```json
{
  "exported_at": "2026-05-11T00:00:00Z",
  "system": "PRD",
  "tables": {
    "ZTABLE1": {
      "description": "My Custom Table",
      "fields": {
        "MANDT":   { "description": "Client",       "type": "CLNT", "length": 3,  "is_key": true },
        "ZFIELD1": { "description": "Custom Field",  "type": "CHAR", "length": 50 }
      }
    }
  }
}
```

Required: `tables` (object), each table must have a `fields` object.  
Optional per field: `type`, `length`, `is_key`, `data_element`.

Multiple files can be imported; later imports win on field conflicts.  
User data is stored in VS Code `globalState` under `sapDictionary.importEntries`.

## Packaging

```bash
npx vsce package
```

Produces `sap-dictionary-<version>.vsix` in the project root.  
`.token` and `publish/publish.sh` are excluded via `.vscodeignore`.

To install the `.vsix` locally for testing:

```bash
code --install-extension sap-dictionary-0.1.1.vsix
```

## Publishing

```bash
bash publish/publish.sh
```

The script builds a production bundle and publishes using the PAT stored in `publish/.token`.  
To bump the version, update `"version"` in `package.json` first (same version cannot be re-published).

```bash
npx vsce publish patch   # 0.1.1 → 0.1.2
npx vsce publish minor   # 0.1.1 → 0.2.0
```

## Project Structure

```
src/
  extension.ts          # entry point, wires everything together
  dataManager.ts        # data loading, multi-import merge, fuzzy search
  hoverProvider.ts      # hover tooltip logic
  sidebarProvider.ts    # tree view (tables & fields, field-level search results)
  searchViewProvider.ts # sidebar webview (import button, imported files list, search)
  types.ts              # shared TypeScript interfaces
data/
  sap-standard.json     # bundled SAP data (674 tables, 16 700+ fields)
tests/
  __mocks__/vscode.ts   # lightweight vscode module mock
  helpers/mockContext.ts
  fixtures/             # sample import JSON files for testing
  dataManager.test.ts
scripts/
  scrape_sapdatasheet.py
  scrape_hana_views.py
  merge_data.py
publish/
  publish.sh            # build + publish script
  .token                # Azure PAT (gitignored + vscodeignored)
resources/
  icon.png / icon.svg
```
