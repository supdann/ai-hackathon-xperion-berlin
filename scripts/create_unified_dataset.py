#!/usr/bin/env python3
"""
Create unified promo-product dataset with lift metrics.
Combines products, promos, and transaction data to calculate promotional effectiveness.
"""

import pandas as pd
import numpy as np
from pathlib import Path
from datetime import datetime

def excel_date_to_datetime(excel_date):
    """Convert Excel serial date to datetime."""
    if pd.isna(excel_date):
        return None
    try:
        base_date = datetime(1899, 12, 30)
        return base_date + pd.Timedelta(days=int(excel_date))
    except:
        return None

def load_clean_data():
    """Load clean products and promos tables."""
    base_path = Path('/Users/smutyala/Desktop/ai-hackathon-xperion-berlin/data/processed')

    print("Loading clean products and promos...")
    products = pd.read_csv(base_path / 'clean_products.csv')
    promos = pd.read_csv(base_path / 'clean_promos.csv')

    print(f"  Products: {len(products):,} records")
    print(f"  Promos: {len(promos):,} records")

    return products, promos

def load_transaction_data():
    """Load all transaction CSVs."""
    base_path = Path('/Users/smutyala/Desktop/ai-hackathon-xperion-berlin/data/processed')

    print("\nLoading transaction data...")

    # Load Stores and Web transactions (non-promo baseline)
    stores_files = [
        'raw_Stores_October-January_FY25_Anon Data.csv',
        'raw_Stores_February-June_FY25_Anon Data.csv',
        'raw_Stores_July-September_FY25_Anon Data.csv'
    ]

    web_files = [
        'raw_Web_October-January_FY25_Anon Data.csv',
        'raw_Web_February-August_FY25_Anon Data.csv',
        'raw_Web_September_FY25_Anon Data.csv'
    ]

    # Load promo transactions
    promo_file = 'raw_Promo_October-September_FY25_Anon Data.csv'

    all_txns = []

    # Load Stores transactions
    for file in stores_files:
        print(f"  Loading {file}...")
        df = pd.read_csv(base_path / file)
        df['source_channel'] = 'STORES'
        df['is_promo'] = False
        all_txns.append(df)

    # Load Web transactions
    for file in web_files:
        print(f"  Loading {file}...")
        df = pd.read_csv(base_path / file)
        df['source_channel'] = 'WEB'
        df['is_promo'] = False
        all_txns.append(df)

    # Load Promo transactions
    print(f"  Loading {promo_file}...")
    df = pd.read_csv(base_path / promo_file)
    df['source_channel'] = df['CHANNEL']
    df['is_promo'] = True
    all_txns.append(df)

    # Combine all
    combined = pd.concat(all_txns, ignore_index=True)
    print(f"  Total transactions: {len(combined):,}")

    return combined

def standardize_transaction_columns(df):
    """Standardize column names across promo and non-promo transactions."""

    # Create standardized columns
    df['sku'] = df['COD SKU'].astype(str)
    df['channel'] = df['source_channel'].str.lower()
    df['date'] = pd.to_numeric(df['DATE'], errors='coerce')

    # Handle different column names for sales values
    if 'SALES VALUE ANON' in df.columns:
        df['sales_value'] = pd.to_numeric(df['SALES VALUE ANON'], errors='coerce')
        df['sales_qty'] = pd.to_numeric(df['SALES QTY ANON'], errors='coerce')
        df['margin_value'] = pd.to_numeric(df['MARGIN VALUE ANON'], errors='coerce')
    else:
        df['sales_value'] = pd.to_numeric(df['SALES VALUE'], errors='coerce')
        df['sales_qty'] = pd.to_numeric(df['SALES QTY'], errors='coerce')
        df['margin_value'] = pd.to_numeric(df['MARGIN VALUE'], errors='coerce')

    # Promo code (only for promo transactions)
    if 'CODE PROMO' in df.columns:
        df['promo_code'] = df['CODE PROMO'].astype(str).str.strip()
    else:
        df['promo_code'] = None

    return df

def calculate_baseline_metrics(txns, products):
    """Calculate baseline (non-promo) sales metrics for each product-channel combo."""

    print("\nCalculating baseline metrics from non-promo periods...")

    # Filter non-promo transactions
    baseline_txns = txns[txns['is_promo'] == False].copy()

    # Group by SKU and channel
    baseline = baseline_txns.groupby(['sku', 'channel']).agg({
        'sales_qty': 'sum',
        'sales_value': 'sum',
        'date': 'count'  # number of transaction days
    }).reset_index()

    baseline.columns = ['sku', 'channel', 'baseline_total_units',
                       'baseline_total_revenue', 'baseline_transaction_days']

    # Calculate average per transaction day
    baseline['baseline_units_per_day'] = (baseline['baseline_total_units'] /
                                          baseline['baseline_transaction_days'])
    baseline['baseline_revenue_per_day'] = (baseline['baseline_total_revenue'] /
                                            baseline['baseline_transaction_days'])

    print(f"  Baseline metrics calculated for {len(baseline):,} SKU-channel combinations")

    return baseline

def aggregate_promo_transactions(txns, promos):
    """Aggregate promo transactions by promo-product-channel."""

    print("\nAggregating promo transactions...")

    # Filter promo transactions only
    promo_txns = txns[txns['is_promo'] == True].copy()

    # Merge with promos to get promo_id
    promo_txns = promo_txns.merge(
        promos[['promo_code', 'promo_id', 'duration_days']],
        on='promo_code',
        how='left'
    )

    # Group by promo_id, sku, channel
    agg_promos = promo_txns.groupby(['promo_id', 'sku', 'channel']).agg({
        'sales_qty': 'sum',
        'sales_value': 'sum',
        'margin_value': 'sum',
        'date': 'nunique',  # unique transaction days
        'duration_days': 'first'
    }).reset_index()

    agg_promos.columns = ['promo_id', 'sku', 'channel', 'total_units_sold',
                         'total_revenue', 'total_margin', 'transaction_days', 'promo_duration_days']

    # Count times promoted (number of unique transaction days)
    agg_promos['times_promoted'] = agg_promos['transaction_days']

    print(f"  Aggregated {len(agg_promos):,} promo-product-channel combinations")

    return agg_promos

def calculate_lift_metrics(promo_agg, baseline, products, promos):
    """Calculate lift and impact metrics."""

    print("\nCalculating lift and impact metrics...")

    # Merge with baseline
    merged = promo_agg.merge(
        baseline[['sku', 'channel', 'baseline_units_per_day', 'baseline_revenue_per_day']],
        on=['sku', 'channel'],
        how='left'
    )

    # Calculate expected baseline during promo period
    merged['expected_baseline_units'] = (merged['baseline_units_per_day'] *
                                         merged['promo_duration_days'])
    merged['expected_baseline_revenue'] = (merged['baseline_revenue_per_day'] *
                                           merged['promo_duration_days'])

    # Calculate lift percentages
    merged['units_lift_percent'] = (
        (merged['total_units_sold'] - merged['expected_baseline_units']) /
        merged['expected_baseline_units'] * 100
    )

    merged['revenue_lift_percent'] = (
        (merged['total_revenue'] - merged['expected_baseline_revenue']) /
        merged['expected_baseline_revenue'] * 100
    )

    # Handle infinite/NaN values
    merged['units_lift_percent'] = merged['units_lift_percent'].replace([np.inf, -np.inf], np.nan)
    merged['revenue_lift_percent'] = merged['revenue_lift_percent'].replace([np.inf, -np.inf], np.nan)

    # Merge with products to get pricing info
    # Convert SKU to string in products table to match transaction data
    products_copy = products.copy()
    products_copy['sku'] = products_copy['sku'].astype(str)

    merged = merged.merge(
        products_copy[['sku', 'product_id', 'name', 'category', 'base_price',
                      'supplier_cost', 'margin_percent', 'brand']],
        on='sku',
        how='left'
    )

    # Merge with promos to get promo details
    merged = merged.merge(
        promos[['promo_id', 'promo_name', 'season_label', 'promo_type',
               'discount_percent', 'date_start', 'date_end']],
        on='promo_id',
        how='left'
    )

    # Calculate margin after discount
    # If discount is applied, reduce the margin
    merged['discount_percent'] = merged['discount_percent'].fillna(0)
    merged['margin_after_discount_percent'] = merged['margin_percent'] - merged['discount_percent']

    # Calculate margin impact in currency
    # Actual margin from promo sales
    merged['actual_margin_euros'] = merged['total_margin']

    # Expected margin if sold at baseline (no promo)
    merged['expected_margin_euros'] = (
        merged['expected_baseline_revenue'] * merged['margin_percent'] / 100
    )

    # Margin impact (actual - expected)
    merged['margin_impact_euros'] = (
        merged['actual_margin_euros'] - merged['expected_margin_euros']
    )

    # Profit impact (simplified: revenue - cost)
    merged['profit_impact_euros'] = (
        merged['total_revenue'] - (merged['total_units_sold'] * merged['supplier_cost'])
    )

    print(f"  Calculated metrics for {len(merged):,} combinations")

    return merged

def create_unified_dataset(data):
    """Select and order final columns for unified dataset."""

    print("\nCreating final unified dataset...")

    # Select columns in specified order
    final_cols = [
        'promo_id',
        'product_id',
        'promo_name',
        'season_label',
        'category',
        'name',  # product_name
        'sku',   # product_sku
        'brand',
        'base_price',
        'supplier_cost',
        'margin_percent',  # base_margin_percent
        'discount_percent',
        'promo_type',
        'date_start',
        'date_end',
        'channel',
        'times_promoted',
        'total_units_sold',
        'expected_baseline_units',
        'units_lift_percent',
        'revenue_lift_percent',
        'margin_after_discount_percent',
        'margin_impact_euros',
        'profit_impact_euros'
    ]

    # Rename for clarity
    unified = data[final_cols].copy()
    unified.columns = [
        'promo_id',
        'product_id',
        'promo_name',
        'season_label',
        'category',
        'product_name',
        'product_sku',
        'brand',
        'base_price',
        'supplier_cost',
        'base_margin_percent',
        'discount_percent',
        'promo_type',
        'date_start',
        'date_end',
        'channel',
        'times_promoted',
        'total_units_sold',
        'baseline_units',
        'units_lift_percent',
        'revenue_lift_percent',
        'margin_after_discount_percent',
        'margin_impact_euros',
        'profit_impact_euros'
    ]

    # Round numeric columns
    numeric_cols = ['base_price', 'supplier_cost', 'base_margin_percent',
                   'discount_percent', 'units_lift_percent', 'revenue_lift_percent',
                   'margin_after_discount_percent', 'margin_impact_euros',
                   'profit_impact_euros', 'baseline_units']

    for col in numeric_cols:
        if col in unified.columns:
            unified[col] = unified[col].round(2)

    # Sort by promo_id and total_units_sold
    unified = unified.sort_values(['promo_id', 'total_units_sold'], ascending=[True, False])

    return unified

def main():
    # Load clean data
    products, promos = load_clean_data()

    # Load transaction data
    txns = load_transaction_data()

    # Standardize columns
    print("\nStandardizing transaction columns...")
    txns = standardize_transaction_columns(txns)

    # Calculate baseline metrics
    baseline = calculate_baseline_metrics(txns, products)

    # Aggregate promo transactions
    promo_agg = aggregate_promo_transactions(txns, promos)

    # Calculate lift and impact metrics
    data_with_metrics = calculate_lift_metrics(promo_agg, baseline, products, promos)

    # Create final unified dataset
    unified = create_unified_dataset(data_with_metrics)

    # Save to CSV
    output_path = Path('/Users/smutyala/Desktop/ai-hackathon-xperion-berlin/data/processed')
    output_file = output_path / 'unified_promo_product_data.csv'
    unified.to_csv(output_file, index=False)

    print(f"\n✓ Created unified dataset: {output_file}")
    print(f"  Total rows: {len(unified):,}")

    # Validation and statistics
    print("\n=== VALIDATION ===")
    print(f"Unique promos: {unified['promo_id'].nunique()}")
    print(f"Unique products: {unified['product_id'].nunique()}")
    print(f"Unique SKUs: {unified['product_sku'].nunique()}")
    print(f"Channels: {unified['channel'].unique()}")

    print("\n=== SUMMARY STATISTICS ===")
    print(f"Total promo-product combinations: {len(unified):,}")
    print(f"\nAverage metrics:")
    print(f"  Units lift: {unified['units_lift_percent'].mean():.1f}%")
    print(f"  Revenue lift: {unified['revenue_lift_percent'].mean():.1f}%")
    print(f"  Margin impact: €{unified['margin_impact_euros'].mean():.2f}")
    print(f"  Profit impact: €{unified['profit_impact_euros'].mean():.2f}")

    print(f"\n=== TOP PERFORMING PROMOS (by revenue lift) ===")
    top_performers = unified.nlargest(10, 'revenue_lift_percent')[
        ['promo_name', 'product_name', 'season_label', 'revenue_lift_percent', 'total_units_sold']
    ]
    print(top_performers.to_string(index=False, max_colwidth=30))

    print("\n✓ Unified dataset creation complete!")

if __name__ == '__main__':
    main()
