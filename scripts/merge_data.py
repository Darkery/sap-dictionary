#!/usr/bin/env python3
"""
Merges abap_tables.json + hana_views.json → data/sap-standard.json.

Usage:
  python merge_data.py --abap abap_tables.json --hana hana_views.json --output ../data/sap-standard.json
"""
import argparse
import json
import sys
from datetime import date
from pathlib import Path


def validate_entry(table_name: str, entry: dict) -> list[str]:
    errors = []
    if not isinstance(entry.get("description"), str):
        errors.append(f"{table_name}: missing string 'description'")
    if not isinstance(entry.get("fields"), dict):
        errors.append(f"{table_name}: missing dict 'fields'")
    else:
        for field_name, field in entry["fields"].items():
            if not isinstance(field.get("description"), str):
                errors.append(f"{table_name}.{field_name}: missing string 'description'")
    return errors


def merge(abap_path: Path, hana_path: Path) -> dict:
    abap_data = json.loads(abap_path.read_text(encoding="utf-8"))
    hana_data = json.loads(hana_path.read_text(encoding="utf-8"))

    merged = {}
    merged.update(abap_data.get("tables", {}))
    # HANA views use different naming (M_* or system view names) — no key conflicts
    for k, v in hana_data.get("tables", {}).items():
        if k in merged:
            # If same key exists, merge fields — HANA data wins
            merged[k]["fields"].update(v.get("fields", {}))
            if v.get("description"):
                merged[k]["description"] = v["description"]
        else:
            merged[k] = v

    return merged


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--abap", required=True)
    parser.add_argument("--hana", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()

    abap_path = Path(args.abap)
    hana_path = Path(args.hana)

    if not abap_path.exists():
        print(f"[ERROR] ABAP data file not found: {abap_path}", file=sys.stderr)
        sys.exit(1)
    if not hana_path.exists():
        print(f"[ERROR] HANA data file not found: {hana_path}", file=sys.stderr)
        sys.exit(1)

    tables = merge(abap_path, hana_path)

    # Validation pass
    errors = []
    for table_name, entry in tables.items():
        errors.extend(validate_entry(table_name, entry))

    if errors:
        print(f"Validation warnings ({len(errors)}):", file=sys.stderr)
        for e in errors[:20]:
            print(f"  {e}", file=sys.stderr)

    # Remove entries with zero fields
    before = len(tables)
    tables = {k: v for k, v in tables.items() if v.get("fields")}
    after = len(tables)
    if before != after:
        print(f"Removed {before - after} entries with no fields", file=sys.stderr)

    # Stats
    total_fields = sum(len(t["fields"]) for t in tables.values())
    print(f"Tables: {len(tables)}, Fields: {total_fields}", file=sys.stderr)

    output = {
        "exported_at": str(date.today()),
        "source": "sapdatasheet.org + help.sap.com",
        "tables": tables,
    }

    out_path = Path(args.output)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, separators=(",", ":"))

    size_mb = out_path.stat().st_size / 1_000_000
    print(f"Written to {out_path} ({size_mb:.1f} MB)", file=sys.stderr)


if __name__ == "__main__":
    main()
