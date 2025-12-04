#!/usr/bin/env python3
"""
Extract promotional events from raw CSV files and categorize by season.
"""

import pandas as pd
import numpy as np
from pathlib import Path
import re
from datetime import datetime

def excel_date_to_datetime(excel_date):
    """Convert Excel serial date to datetime."""
    if pd.isna(excel_date):
        return None
    try:
        # Excel's epoch is December 30, 1899
        base_date = datetime(1899, 12, 30)
        return base_date + pd.Timedelta(days=int(excel_date))
    except:
        return None

def get_month_from_excel_date(excel_date):
    """Get month number from Excel serial date."""
    dt = excel_date_to_datetime(excel_date)
    return dt.month if dt else None

def assign_season(date_start_excel, date_end_excel):
    """
    Assign season label based on promo dates.

    Rules:
    - October = "blackfriday"
    - November-December = "christmas"
    - January-February = "newyear"
    - June-August = "summer"
    - September = "backtoschool"
    - Any other month = "clearance"
    """
    start_month = get_month_from_excel_date(date_start_excel)
    end_month = get_month_from_excel_date(date_end_excel)

    if not start_month:
        return "unknown"

    # Use the start month to determine season
    if start_month == 10:
        return "blackfriday"
    elif start_month in [11, 12]:
        return "christmas"
    elif start_month in [1, 2]:
        return "newyear"
    elif start_month in [6, 7, 8]:
        return "summer"
    elif start_month == 9:
        return "backtoschool"
    else:
        return "clearance"

def infer_promo_type(promo_name, type_of_promo):
    """
    Infer promo type from promo name and type field.

    Types: discount, bogo, bundle, flash, seasonal, clearance, other
    """
    promo_name_lower = str(promo_name).lower()
    type_lower = str(type_of_promo).lower()

    # Check for specific patterns
    if 'bogo' in promo_name_lower or 'buy one get one' in promo_name_lower:
        return "bogo"
    elif 'bundle' in promo_name_lower or 'pack' in promo_name_lower:
        return "bundle"
    elif 'flash' in promo_name_lower or 'lampo' in promo_name_lower:
        return "flash"
    elif '%' in promo_name_lower or 'sconto' in promo_name_lower or 'discount' in promo_name_lower:
        return "discount"
    elif 'clearance' in promo_name_lower or 'liquidazione' in promo_name_lower:
        return "clearance"
    elif 'seasonal' in promo_name_lower or 'stagionale' in promo_name_lower:
        return "seasonal"
    elif 'peak' in type_lower:
        return "peak_event"
    elif 'no peak' in type_lower or 'no_peak' in type_lower:
        return "standard"
    else:
        return "other"

def extract_discount_percent(promo_name):
    """
    Try to extract discount percentage from promo name.
    Returns None if not found.
    """
    # Look for patterns like "20%", "-20%", "sconto 20%"
    match = re.search(r'(\d+)\s*%', str(promo_name))
    if match:
        return float(match.group(1))
    return None

def clean_text(text):
    """Clean and standardize text fields."""
    if pd.isna(text):
        return ""
    text = str(text).strip()
    # Remove extra whitespace
    text = re.sub(r'\s+', ' ', text)
    return text

def main():
    # Setup paths
    base_path = Path('/Users/smutyala/Desktop/ai-hackathon-xperion-berlin')
    data_path = base_path / 'data' / 'processed'
    output_path = base_path / 'data' / 'processed'
    output_path.mkdir(parents=True, exist_ok=True)

    # Read the promo file
    promo_file = data_path / 'raw_Promo_October-September_FY25_Anon Data.csv'
    print(f"Reading promo file: {promo_file.name}")

    df = pd.read_csv(promo_file)
    print(f"Total promo transaction records: {len(df):,}")

    # Extract unique promos
    # Group by promo code to get unique promotions
    promo_cols = ['CODE PROMO', 'DESC PROMO', 'DATE START PROMO', 'DATE END PROMO',
                  'TYPE OF PROMO', 'CHANNEL']

    unique_promos = df[promo_cols].drop_duplicates(subset=['CODE PROMO'])
    print(f"Unique promo codes: {len(unique_promos):,}")

    # Clean promo name
    unique_promos['promo_name'] = unique_promos['DESC PROMO'].apply(clean_text)

    # Extract discount percentage if available
    unique_promos['discount_percent'] = unique_promos['promo_name'].apply(extract_discount_percent)

    # Infer promo type
    unique_promos['promo_type'] = unique_promos.apply(
        lambda row: infer_promo_type(row['DESC PROMO'], row['TYPE OF PROMO']), axis=1
    )

    # Assign season
    unique_promos['season_label'] = unique_promos.apply(
        lambda row: assign_season(row['DATE START PROMO'], row['DATE END PROMO']), axis=1
    )

    # Determine channels - check which channels each promo appears in
    print("\nDetermining channels for each promo...")
    channel_mapping = df.groupby('CODE PROMO')['CHANNEL'].apply(
        lambda x: ','.join(sorted(set(str(c).strip().lower() for c in x)))
    ).to_dict()

    unique_promos['channels'] = unique_promos['CODE PROMO'].map(channel_mapping)

    # Convert Excel dates to readable format
    unique_promos['date_start'] = unique_promos['DATE START PROMO'].apply(
        lambda x: excel_date_to_datetime(x).strftime('%Y-%m-%d') if excel_date_to_datetime(x) else None
    )
    unique_promos['date_end'] = unique_promos['DATE END PROMO'].apply(
        lambda x: excel_date_to_datetime(x).strftime('%Y-%m-%d') if excel_date_to_datetime(x) else None
    )

    # Calculate promo duration in days
    unique_promos['duration_days'] = (
        unique_promos['DATE END PROMO'] - unique_promos['DATE START PROMO']
    ).fillna(0).astype(int)

    # Create description from TYPE OF PROMO
    unique_promos['description'] = unique_promos['TYPE OF PROMO'].apply(clean_text)

    # Create promo_id
    unique_promos = unique_promos.reset_index(drop=True)
    unique_promos['promo_id'] = unique_promos.index.map(lambda x: f'PR{x+1:04d}')

    # Select final columns
    final_promos = unique_promos[[
        'promo_id',
        'CODE PROMO',
        'promo_name',
        'promo_type',
        'discount_percent',
        'date_start',
        'date_end',
        'duration_days',
        'season_label',
        'channels',
        'description'
    ]].copy()

    # Rename columns
    final_promos.columns = [
        'promo_id',
        'promo_code',
        'promo_name',
        'promo_type',
        'discount_percent',
        'date_start',
        'date_end',
        'duration_days',
        'season_label',
        'channels',
        'description'
    ]

    # Sort by date_start
    final_promos = final_promos.sort_values('date_start')

    # Save to CSV
    output_file = output_path / 'clean_promos.csv'
    final_promos.to_csv(output_file, index=False)
    print(f"\n✓ Created clean promos file: {output_file}")
    print(f"  Total unique promos: {len(final_promos):,}")

    # Validation and Statistics
    print("\n=== VALIDATION ===")

    # Check for duplicates
    duplicate_codes = final_promos['promo_code'].duplicated().sum()
    print(f"Duplicate promo codes: {duplicate_codes}")

    # Check completeness
    print(f"\nCompleteness:")
    print(f"  Promos with names: {final_promos['promo_name'].notna().sum()}/{len(final_promos)}")
    print(f"  Promos with start dates: {final_promos['date_start'].notna().sum()}/{len(final_promos)}")
    print(f"  Promos with end dates: {final_promos['date_end'].notna().sum()}/{len(final_promos)}")
    print(f"  Promos with discount %: {final_promos['discount_percent'].notna().sum()}/{len(final_promos)}")

    # Summary statistics
    print("\n=== SUMMARY STATISTICS ===")
    print(f"Total unique promotions: {len(final_promos):,}")
    print(f"\nAverage promo duration: {final_promos['duration_days'].mean():.1f} days")
    print(f"Min duration: {final_promos['duration_days'].min()} days")
    print(f"Max duration: {final_promos['duration_days'].max()} days")

    # Promo types
    print(f"\n=== PROMO TYPES ===")
    print(final_promos['promo_type'].value_counts().to_string())

    # Seasons
    print(f"\n=== SEASONS ===")
    print(final_promos['season_label'].value_counts().to_string())

    # Channels
    print(f"\n=== CHANNELS ===")
    print(final_promos['channels'].value_counts().head(10).to_string())

    # Discount percentages
    discounted = final_promos[final_promos['discount_percent'].notna()]
    if len(discounted) > 0:
        print(f"\n=== DISCOUNT ANALYSIS ===")
        print(f"Promos with explicit discount: {len(discounted)}")
        print(f"Average discount: {discounted['discount_percent'].mean():.1f}%")
        print(f"Min discount: {discounted['discount_percent'].min():.1f}%")
        print(f"Max discount: {discounted['discount_percent'].max():.1f}%")

    # Sample promos
    print("\n=== SAMPLE PROMOS ===")
    print(final_promos.head(10).to_string(index=False, max_colwidth=30))

    print("\n✓ Promo extraction complete!")

if __name__ == '__main__':
    main()
