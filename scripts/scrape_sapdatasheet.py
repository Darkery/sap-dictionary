#!/usr/bin/env python3
"""
Scrape SAP table metadata from sapdatasheet.org.

Usage:
    python scrape_sapdatasheet.py [--table TABLE] [--tables-file FILE] [--output FILE]
"""

import argparse
import json
import sys
import time
import re
import warnings

# Suppress SSL warnings from older LibreSSL on macOS
warnings.filterwarnings("ignore")

try:
    import requests
    from bs4 import BeautifulSoup
except ImportError:
    print("Missing dependencies. Run: pip install requests beautifulsoup4 lxml", file=sys.stderr)
    sys.exit(1)

BASE_URL = "https://www.sapdatasheet.org/abap/tabl/{table_lower}.html"
RATE_LIMIT_SECONDS = 1.0


# ---------------------------------------------------------------------------
# Category guessing
# ---------------------------------------------------------------------------

CATEGORY_PREFIXES = [
    (["BKPF", "BSEG", "BSID", "BSAD", "BSIK", "BSAK", "BSIS", "BSAS",
      "SKA", "SKB", "T001", "ACDOCA", "FAGL"], "FI"),
    (["MARA", "MARC", "MARD", "MAKT", "MAR", "EKK", "EKP", "EKE",
      "MSEG", "MKP", "T001W", "T001L"], "MM"),
    (["VBAK", "VBAP", "VBEP", "VBKD", "VBFA", "VBPA", "LIKP", "LIPS",
      "KNA1", "KNB", "KNV", "VBRK", "VBRP", "KONV"], "SD"),
    (["PA0", "HRP1"], "HR"),
    (["USR", "AGR_", "T000", "TADIR", "TRDIR", "TSTC", "DD0",
      "TDEV", "E07", "RSDS", "ENLFDIR"], "BASIS"),
    (["AFKO", "AFPO", "AUFK", "RESB", "CRHD", "MAST", "STKO", "STPO"], "PP"),
    (["EQUI", "IFLOT", "QMEL"], "PM"),
    (["COAS", "COEP", "COKA", "COBK", "CSKT", "CSKU", "TKA", "CEPC"], "CO"),
]


def guess_category(table_name: str) -> str:
    upper = table_name.upper()
    for prefixes, category in CATEGORY_PREFIXES:
        for prefix in prefixes:
            if upper.startswith(prefix):
                return category
    return "OTHER"


# ---------------------------------------------------------------------------
# HTML parsing
# ---------------------------------------------------------------------------

def parse_description_from_title(title_text: str) -> str:
    """Extract description from page title like 'SAP ABAP Table MARA (General Material Data) - ...'"""
    # Look for pattern "TABLENAME (Description)" or "TABLENAME - Description"
    match = re.search(r'\(([^)]+)\)', title_text)
    if match:
        return match.group(1).strip()
    return ""


def parse_table_page(html: str, table_name: str) -> dict:
    """
    Parse a sapdatasheet.org table page.

    Returns a dict with keys: description, category, fields
    """
    soup = BeautifulSoup(html, "lxml")

    # --- Description ---
    description = ""
    # Try page title first: "SAP ABAP Table MARA (General Material Data) - ..."
    title_tag = soup.find("title")
    if title_tag:
        description = parse_description_from_title(title_tag.get_text())

    # Fallback: look in table metadata rows (Table 3 has 'Short Description')
    if not description:
        for table in soup.find_all("table"):
            for row in table.find_all("tr"):
                cells = row.find_all(["td", "th"])
                texts = [c.get_text(strip=True) for c in cells]
                if texts and texts[0] == "Short Description" and len(texts) > 1:
                    description = texts[1]
                    break
            if description:
                break

    # --- Fields ---
    fields = {}
    fields_table = _find_fields_table(soup)
    if fields_table is None:
        return {"description": description, "category": guess_category(table_name), "fields": fields}

    rows = fields_table.find_all("tr")
    for row in rows[1:]:  # skip header row
        cells = row.find_all(["td", "th"])
        if len(cells) < 9:
            continue

        # Column layout (0-indexed):
        # 0: row number, 1: Field, 2: Key, 3: Data Element, 4: Domain,
        # 5: DataType, 6: Length, 7: DecimalPlaces, 8: Short Description, 9: Checktable

        field_name = cells[1].get_text(strip=True)
        if not field_name or field_name == "Field":
            continue  # skip header or empty rows
        if field_name.startswith("."):
            continue  # skip .INCLUDE and similar markers

        data_type = cells[5].get_text(strip=True) if len(cells) > 5 else ""
        raw_length = cells[6].get_text(strip=True) if len(cells) > 6 else "0"
        short_desc_text = cells[8].get_text(strip=True) if len(cells) > 8 else ""

        # Data element name from cell[3]; its link's title is the description
        data_element = cells[3].get_text(strip=True) if len(cells) > 3 else ""
        field_description = _extract_field_description(cells[3], short_desc_text)

        # Parse length safely
        try:
            length = int(raw_length)
        except (ValueError, TypeError):
            length = 0

        fields[field_name] = {
            "description": field_description,
            "type": data_type,
            "length": length,
            "data_element": data_element,
        }

    return {
        "description": description,
        "category": guess_category(table_name),
        "fields": fields,
    }


def _find_fields_table(soup):
    """Find the table containing field definitions (has 'Field', 'DataType', 'Length' headers)."""
    for table in soup.find_all("table"):
        headers = table.find_all("th")
        if not headers:
            # Some tables use td for headers in the first row
            first_row = table.find("tr")
            if first_row:
                headers = first_row.find_all(["td", "th"])
        header_texts = [h.get_text(strip=True) for h in headers]
        if "Field" in header_texts and "DataType" in header_texts and "Length" in header_texts:
            return table
    return None


def _extract_field_description(data_element_cell, fallback: str) -> str:
    """
    Extract field description from the Data Element cell.

    The data element cell typically has a link whose title attribute
    contains the human-readable description (the second link, not the first
    which is just the data element name).
    """
    links = data_element_cell.find_all("a")
    # The first link has title = data element name (same as text)
    # The second link (if present) has title = short description
    # Example: <a title="MATNR">MATNR</a>  <a title="Material Number">MATNR</a>
    if len(links) >= 2:
        title = links[1].get("title", "").strip()
        if title:
            return title
    if len(links) == 1:
        title = links[0].get("title", "").strip()
        # If the title equals the link text, it's just the name — use fallback
        if title and title != links[0].get_text(strip=True):
            return title

    # Fall back to Short Description column text
    return fallback


# ---------------------------------------------------------------------------
# Fetching
# ---------------------------------------------------------------------------

def fetch_table(session: requests.Session, table_name: str):
    """
    Fetch and parse a single table page.
    Returns parsed dict or None on error.
    """
    url = BASE_URL.format(table_lower=table_name.lower())
    try:
        response = session.get(url, timeout=20)
        if response.status_code == 404:
            print(f"[SKIP] {table_name}: 404 Not Found", file=sys.stderr)
            return None
        response.raise_for_status()
    except requests.exceptions.RequestException as exc:
        print(f"[ERROR] {table_name}: {exc}", file=sys.stderr)
        return None

    return parse_table_page(response.text, table_name)


# ---------------------------------------------------------------------------
# Reading table list
# ---------------------------------------------------------------------------

def read_table_names(path: str) -> list:
    """Read table names from a file, skipping blank lines and comments."""
    names = []
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            names.append(line.upper())
    return names


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="Scrape SAP ABAP table metadata from sapdatasheet.org"
    )
    parser.add_argument(
        "--table",
        metavar="TABLE",
        help="Scrape a single table (e.g. --table MARA)",
    )
    parser.add_argument(
        "--tables-file",
        metavar="FILE",
        default="core_tables.txt",
        help="File containing table names to scrape (default: core_tables.txt)",
    )
    parser.add_argument(
        "--output",
        metavar="FILE",
        default="abap_tables.json",
        help="Output JSON file (default: abap_tables.json)",
    )
    args = parser.parse_args()

    # Determine which tables to scrape
    if args.table:
        table_names = [args.table.upper()]
    else:
        table_names = read_table_names(args.tables_file)

    if not table_names:
        print("No tables to scrape.", file=sys.stderr)
        sys.exit(1)

    print(f"Scraping {len(table_names)} table(s)...", file=sys.stderr)

    result = {
        "source": "sapdatasheet.org",
        "tables": {},
    }

    session = requests.Session()
    session.headers.update({
        "User-Agent": "Mozilla/5.0 (compatible; SAP-Dictionary-Scraper/1.0)"
    })

    for i, table_name in enumerate(table_names):
        if i > 0:
            time.sleep(RATE_LIMIT_SECONDS)

        print(f"  [{i + 1}/{len(table_names)}] {table_name}...", file=sys.stderr, end=" ")
        data = fetch_table(session, table_name)
        if data is None:
            print("SKIPPED", file=sys.stderr)
            continue

        result["tables"][table_name] = data
        field_count = len(data["fields"])
        print(f"OK ({field_count} fields)", file=sys.stderr)

    # Write output
    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2, ensure_ascii=False)

    print(f"\nDone. Wrote {len(result['tables'])} tables to {args.output}", file=sys.stderr)


if __name__ == "__main__":
    main()
