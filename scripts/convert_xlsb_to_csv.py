#!/usr/bin/env python3
"""
Convert .xlsb files to CSV format and generate schema documentation.
"""

import os
import csv
from pathlib import Path
from pyxlsb import open_workbook
import pandas as pd

DATA_DIR = Path("data")
OUTPUT_DIR = DATA_DIR / "processed"
SCHEMA_FILE = DATA_DIR / "SCHEMA.md"

def get_column_type(values):
    """Infer the data type of a column from its values."""
    non_null_values = [v for v in values if v is not None and v != '']
    if not non_null_values:
        return "empty"

    # Check if all are numeric
    try:
        all_numeric = all(isinstance(v, (int, float)) for v in non_null_values)
        if all_numeric:
            all_int = all(isinstance(v, int) or (isinstance(v, float) and v.is_integer()) for v in non_null_values)
            return "integer" if all_int else "float"
    except:
        pass

    # Check if dates
    if any(isinstance(v, pd.Timestamp) or 'date' in str(type(v)).lower() for v in non_null_values[:10]):
        return "date/datetime"

    return "string"

def convert_xlsb_to_csv(xlsb_file):
    """Convert a single .xlsb file to CSV files (one per sheet)."""
    file_name = xlsb_file.stem
    print(f"\n{'='*80}")
    print(f"Processing: {xlsb_file.name}")
    print(f"{'='*80}")

    schema_info = {
        'file_name': xlsb_file.name,
        'sheets': []
    }

    try:
        with open_workbook(str(xlsb_file)) as wb:
            sheet_names = wb.sheets
            print(f"Found {len(sheet_names)} sheet(s): {sheet_names}\n")

            for sheet_name in sheet_names:
                print(f"\n--- Processing Sheet: {sheet_name} ---")

                # Read sheet data
                rows = []
                with wb.get_sheet(sheet_name) as sheet:
                    for row in sheet.rows():
                        rows.append([cell.v for cell in row])

                if not rows:
                    print(f"  WARNING: Sheet '{sheet_name}' is empty, skipping...")
                    continue

                # Extract headers and data
                headers = rows[0] if rows else []
                data_rows = rows[1:] if len(rows) > 1 else []

                # Clean headers
                headers = [str(h).strip() if h is not None else f"Column_{i}" for i, h in enumerate(headers)]

                # Create CSV filename
                csv_filename = f"raw_{file_name}_{sheet_name}.csv"
                csv_path = OUTPUT_DIR / csv_filename

                # Write to CSV
                with open(csv_path, 'w', newline='', encoding='utf-8') as csvfile:
                    writer = csv.writer(csvfile)
                    writer.writerow(headers)
                    writer.writerows(data_rows)

                # Calculate statistics
                row_count = len(data_rows)

                # Determine column types
                column_types = {}
                if data_rows:
                    for i, header in enumerate(headers):
                        column_values = [row[i] if i < len(row) else None for row in data_rows]
                        column_types[header] = get_column_type(column_values)

                # Print summary
                print(f"  File Name: {xlsb_file.name}")
                print(f"  Sheet Name: {sheet_name}")
                print(f"  Row Count: {row_count:,}")
                print(f"  Column Count: {len(headers)}")
                print(f"  \nColumn Details:")
                for i, header in enumerate(headers):
                    dtype = column_types.get(header, "unknown")
                    print(f"    {i+1}. {header} ({dtype})")
                print(f"  \nSaved to: {csv_path}")

                # Store schema info
                schema_info['sheets'].append({
                    'name': sheet_name,
                    'row_count': row_count,
                    'columns': [{'name': h, 'type': column_types.get(h, 'unknown')} for h in headers]
                })

        return schema_info

    except Exception as e:
        print(f"ERROR processing {xlsb_file.name}: {str(e)}")
        import traceback
        traceback.print_exc()
        return None

def generate_schema_doc(all_schema_info):
    """Generate SCHEMA.md documentation."""
    with open(SCHEMA_FILE, 'w', encoding='utf-8') as f:
        f.write("# Data Schema Documentation\n\n")
        f.write("This document describes the structure of all data files.\n\n")
        f.write("## Files Overview\n\n")

        for schema in all_schema_info:
            if schema is None:
                continue

            f.write(f"### {schema['file_name']}\n\n")

            for sheet in schema['sheets']:
                f.write(f"#### Sheet: {sheet['name']}\n\n")
                f.write(f"- **Row Count:** {sheet['row_count']:,}\n")
                f.write(f"- **Column Count:** {len(sheet['columns'])}\n\n")
                f.write("| Column Name | Data Type |\n")
                f.write("|-------------|----------|\n")

                for col in sheet['columns']:
                    f.write(f"| {col['name']} | {col['type']} |\n")

                f.write("\n")

            f.write("\n---\n\n")

    print(f"\nSchema documentation saved to: {SCHEMA_FILE}")

def main():
    """Main execution function."""
    # Ensure output directory exists
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # Find all .xlsb files
    xlsb_files = list(DATA_DIR.glob("*.xlsb"))

    if not xlsb_files:
        print("No .xlsb files found in data directory!")
        return

    print(f"Found {len(xlsb_files)} .xlsb file(s) to process\n")

    # Process each file
    all_schema_info = []
    for xlsb_file in sorted(xlsb_files):
        schema_info = convert_xlsb_to_csv(xlsb_file)
        all_schema_info.append(schema_info)

    # Generate schema documentation
    generate_schema_doc(all_schema_info)

    print("\n" + "="*80)
    print("PROCESSING COMPLETE!")
    print("="*80)
    print(f"All CSV files saved to: {OUTPUT_DIR}")
    print(f"Schema documentation: {SCHEMA_FILE}")

if __name__ == "__main__":
    main()
