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

## Packaging

Requires `@vscode/vsce` (installed on demand via npx):

```bash
npx @vscode/vsce package
```

This produces `sap-dictionary-<version>.vsix` in the project root.
The `vscode:prepublish` script runs automatically and builds a minified production bundle.

To install the `.vsix` locally for testing:

```bash
code --install-extension sap-dictionary-0.1.0.vsix
```

## Publishing

> Update `sapDictionary.productUrl` in `package.json` to the real landing page before publishing.

```bash
npx @vscode/vsce publish
```

You will be prompted for a Personal Access Token (PAT) from
[dev.azure.com](https://dev.azure.com) with **Marketplace (Publish)** scope.

To bump the version before publishing:

```bash
npx @vscode/vsce publish patch   # 0.1.0 → 0.1.1
npx @vscode/vsce publish minor   # 0.1.0 → 0.2.0
npx @vscode/vsce publish major   # 0.1.0 → 1.0.0
```

## Project Structure

```
src/
  extension.ts        # entry point, wires everything together
  dataManager.ts      # data loading, merge, fuzzy search
  hoverProvider.ts    # hover tooltip logic
  sidebarProvider.ts  # tree view (tables & fields)
  searchViewProvider.ts  # webview (search box + import button)
  types.ts            # shared TypeScript interfaces
data/
  sap-standard.json   # bundled SAP table/field data (674 tables, 16752 fields)
scripts/
  scrape_sapdatasheet.py   # ABAP table scraper
  scrape_hana_views.py     # HANA view scraper
  merge_data.py            # merges scraper output into sap-standard.json
resources/
  icon.png / icon.svg      # extension icons
```
