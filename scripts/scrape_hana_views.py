#!/usr/bin/env python3
"""
Fetch SAP HANA System/Monitoring View metadata from help.sap.com.

The SAP HANA SQL Reference is published on help.sap.com and contains ~205 System
Views and ~383 Monitoring Views, each with column names, data types, and descriptions.

API:
  TOC endpoint: GET https://help.sap.com/http.svc/pagecontent
                  ?deliverable_id=36860088&version=2.0.08&locale=en-US&state=PRODUCTION
  Page endpoint: same URL + &file_path=<LOIO>.html

Usage:
    python scrape_hana_views.py [--view VIEW_NAME] [--output FILE]
"""

import argparse
import json
import re
import sys
import time

try:
    import requests
    from bs4 import BeautifulSoup
except ImportError:
    print("Missing dependencies. Run: pip install requests beautifulsoup4 lxml", file=sys.stderr)
    sys.exit(1)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

BASE_URL = "https://help.sap.com/http.svc/pagecontent"
TOC_PARAMS = {
    "deliverable_id": "36860088",
    "version": "2.0.08",
    "locale": "en-US",
    "state": "PRODUCTION",
}
RATE_LIMIT_SECONDS = 2.0   # 0.5 req/s → 2s between requests

VIEW_NAME_RE = re.compile(r"^[A-Z][A-Z0-9_]{2,59}$")
# TOC titles look like "M_ACTIVE_STATEMENTS System View"
# Strip the suffix to get the bare view name
VIEW_TITLE_SUFFIX_RE = re.compile(r"\s+System View$", re.IGNORECASE)

# Data-type length extraction: NVARCHAR(256) → type=NVARCHAR, length=256
TYPE_RE = re.compile(r"^([A-Z0-9_]+)(?:\((\d+)\))?$")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def get_session() -> requests.Session:
    s = requests.Session()
    s.headers.update({
        "User-Agent": (
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/120.0.0.0 Safari/537.36"
        ),
        "Accept": "application/json, text/plain, */*",
    })
    return s


def fetch_toc(session: requests.Session) -> list:
    """
    Fetch the TOC JSON and return a flat list of (view_name, loio) tuples
    covering both System Views and Monitoring Views sections.
    """
    print("Fetching TOC...", file=sys.stderr)
    resp = session.get(BASE_URL, params=TOC_PARAMS, timeout=60)
    resp.raise_for_status()

    data = resp.json()
    full_toc = data["data"]["deliverable"]["fullToc"]

    views = []
    for top_entry in full_toc:
        title = top_entry.get("t", "")
        if "System Views Reference" not in title:
            continue
        # children: [System Views section, Monitoring Views section]
        for section in top_entry.get("c", []):
            for entry in section.get("c", []):
                raw_title = entry.get("t", "")
                url_field = entry.get("u", "")  # e.g. "d20500acd2951014b54ce5af8c1cf675.html"

                # Strip "System View" suffix to get the bare name
                view_name = VIEW_TITLE_SUFFIX_RE.sub("", raw_title).strip()

                if not VIEW_NAME_RE.match(view_name):
                    continue

                # Extract loio from the filename
                loio_match = re.search(r"([a-f0-9]{32})\.html$", url_field)
                if not loio_match:
                    continue

                loio = loio_match.group(1)
                views.append((view_name, loio))

    return views


def parse_type(raw: str) -> dict:
    """
    Parse a HANA type string like 'NVARCHAR(256)' or 'INTEGER' into
    {"type": "NVARCHAR", "length": 256} or {"type": "INTEGER"}.
    """
    m = TYPE_RE.match(raw.strip())
    if not m:
        return {"type": raw.strip()}
    result = {"type": m.group(1)}
    if m.group(2):
        result["length"] = int(m.group(2))
    return result


def fetch_view(session: requests.Session, view_name: str, loio: str):
    """
    Fetch a single view page and parse column metadata.
    Returns a dict with keys: description, category, fields.
    Returns None on error.
    """
    params = dict(TOC_PARAMS)
    params["file_path"] = f"{loio}.html"

    try:
        resp = session.get(BASE_URL, params=params, timeout=30)
        resp.raise_for_status()
        data = resp.json()
        body = data["data"]["body"]
        soup = BeautifulSoup(body, "lxml")

        # Description from <meta name="abstract">
        meta = soup.find("meta", {"name": "abstract"})
        description = meta.get("content", "").strip() if meta else ""

        # Category
        category = "HANA_MONITORING" if view_name.startswith("M_") else "HANA_SYSTEM"

        # Parse column table
        fields = {}
        table = soup.find("table")
        if table:
            rows = table.find_all("tr")
            for row in rows[1:]:   # skip header row
                cells = row.find_all("td")
                if len(cells) < 3:
                    continue
                col_name = cells[0].get_text(strip=True)
                raw_type = cells[1].get_text(strip=True)
                col_desc = cells[2].get_text(strip=True)

                if not col_name:
                    continue

                field_info = {"description": col_desc}
                field_info.update(parse_type(raw_type))
                # Reorder: description first, then type, then length
                ordered = {"description": field_info["description"], "type": field_info["type"]}
                if "length" in field_info:
                    ordered["length"] = field_info["length"]
                fields[col_name] = ordered

        return {
            "description": description,
            "category": category,
            "fields": fields,
        }
    except requests.RequestException as e:
        print(f"  ERROR fetching {view_name}: network error — {e}", file=sys.stderr)
        return None
    except (KeyError, ValueError) as e:
        print(f"  ERROR parsing {view_name}: unexpected response — {e}", file=sys.stderr)
        return None


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Fetch HANA view metadata from help.sap.com")
    parser.add_argument("--view", metavar="VIEW_NAME",
                        help="Fetch a single view by name (for testing)")
    parser.add_argument("--output", default="hana_views.json",
                        help="Output JSON file (default: hana_views.json)")
    args = parser.parse_args()

    session = get_session()

    # ------------------------------------------------------------------
    # Build the list of (view_name, loio) pairs to process
    # ------------------------------------------------------------------
    try:
        all_views = fetch_toc(session)
    except Exception as e:
        print(f"FATAL: could not fetch TOC: {e}", file=sys.stderr)
        sys.exit(1)

    print(f"TOC: {len(all_views)} views found", file=sys.stderr)

    if args.view:
        needle = args.view.upper()
        target = [(n, l) for n, l in all_views if n == needle]
        if not target:
            print(f"ERROR: view '{needle}' not found in TOC", file=sys.stderr)
            sys.exit(1)
        to_process = target
    else:
        to_process = all_views

    # ------------------------------------------------------------------
    # Fetch and parse each view page
    # ------------------------------------------------------------------
    tables = {}
    total = len(to_process)
    for idx, (view_name, loio) in enumerate(to_process, 1):
        print(f"[{idx}/{total}] {view_name} ({loio})", file=sys.stderr)

        result = fetch_view(session, view_name, loio)
        if result is not None:
            tables[view_name] = result

        if idx < total:
            time.sleep(RATE_LIMIT_SECONDS)

    # ------------------------------------------------------------------
    # Write output
    # ------------------------------------------------------------------
    output = {
        "source": "help.sap.com HANA SQL Reference",
        "tables": tables,
    }

    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    print(f"\nDone. {len(tables)} views written to {args.output}", file=sys.stderr)


if __name__ == "__main__":
    main()
