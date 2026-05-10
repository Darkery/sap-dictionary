# SAP Dictionary for VS Code

Instant SAP table and field descriptions in VS Code — hover over any SAP identifier to see what it means.

**Works offline. No SAP connection required.** Bundled with 674 standard tables and views (16,700+ fields) covering ABAP (FI/MM/SD/HR/Basis) and SAP HANA System/Monitoring Views.

---

## Features

**Hover Tooltips** — hover over SAP table or field names in `.abap`, `.sql`, `.hdbview`, `.hdbtable`, `.hdbprocedure`, `.hdbcalculationview` files.

```
MATNR · MARA
Material Number

Type: `CHAR`  Length: 18
Data Element: `MATNR`
```

**Sidebar Panel** — browse and search all 674 tables and 16,700+ fields with fuzzy search (`mar` matches MARA, MARC, MARD…).

**Import Your System's Metadata** — upload a JSON export from your own SAP system to see custom Z-tables and team-specific descriptions. Your data takes priority over the bundled data.

---

## Quick Start

1. Install the extension
2. Open any `.abap` or `.sql` file
3. Hover over an uppercase identifier like `MARA`, `VBAK`, or `M_ACTIVE_STATEMENTS`

---

## Bundled Coverage

| Module | Key Tables |
|--------|-----------|
| FI (Finance) | BKPF, BSEG, SKA1, SKAT, ACDOCA, T001… |
| MM (Materials) | MARA, MARC, MARD, MAKT, EKKO, EKPO, MSEG… |
| SD (Sales) | VBAK, VBAP, KNA1, KNVV, VBRK, LIKP… |
| HR | PA0001, PA0002, PA0008, HRP1000… |
| Basis | USR02, T000, TADIR, TRDIR, DD03L… |
| HANA System Views | TABLES, COLUMNS, VIEWS, INDEXES… (~205) |
| HANA Monitoring Views | M_ACTIVE_STATEMENTS, M_CONNECTIONS… (~354) |

---

## Import Your System's Metadata

To see descriptions for Z-tables and custom fields, export your SAP system's data dictionary as JSON and import it via **SAP Dictionary: Import System Data (JSON)**.

### JSON Format

```json
{
  "exported_at": "2026-05-01",
  "system": "PRD",
  "tables": {
    "ZCUSTOM_TABLE": {
      "description": "My Custom Business Object",
      "fields": {
        "ZFIELD1": {
          "description": "Custom Field One",
          "type": "CHAR",
          "length": 20
        }
      }
    }
  }
}
```

`description: ""` — empty string means no description; the tooltip will show a "Get AI-powered descriptions" prompt instead.

### Export Methods

**Option A — HANA SQL** (for HANA-native tables):
```sql
SELECT table_name, column_name, data_type_name, length, comments
FROM sys.table_columns
WHERE schema_name = 'YOUR_SCHEMA'
ORDER BY table_name, position;
```

**Option B — ABAP SQL Console / ADT** (for ABAP Dictionary):
```sql
SELECT d~tabname, t~ddtext AS table_desc,
       d~fieldname, d~position, d~datatype, d~leng,
       COALESCE(f~ddtext, e~ddtext) AS field_desc
  FROM dd03l AS d
  LEFT JOIN dd02t AS t ON t~tabname = d~tabname AND t~ddlanguage = 'E'
  LEFT JOIN dd03t AS f ON f~tabname = d~tabname AND f~fieldname = d~fieldname AND f~ddlanguage = 'E'
  LEFT JOIN dd04t AS e ON e~rollname = d~rollname AND e~ddlanguage = 'E'
  WHERE d~tabname IN ('ZTABLE1', 'ZTABLE2')
    AND d~fieldname NOT LIKE '.%'
  ORDER BY d~tabname, d~position.
```

Convert the query output to the JSON format above and import via the command palette.

---

## Commands

| Command | Description |
|---------|-------------|
| `SAP Dictionary: Import System Data (JSON)` | Import a JSON metadata export from your SAP system |
| `SAP Dictionary: Clear Imported Data` | Remove previously imported custom data |
| `SAP Dictionary: Search Tables & Fields` | Fuzzy search in the sidebar |
| `SAP Dictionary: Open Product Page` | Learn about AI-powered descriptions |

---

## Supported File Types

`.abap` · `.sql` · `.hdbview` · `.hdbcalculationview` · `.hdbtable` · `.hdbprocedure`

---

## Missing Descriptions?

If your Z-tables show "Not found in SAP Dictionary" or "No description available", import your system's metadata (see above).

Need AI-powered descriptions and automatic sync from your SAP system? → **[Learn more](https://rosetta-landing.pages.dev)**

---

*Powered by [Rosetta](https://rosetta-landing.pages.dev)*
