#!/usr/bin/env python3
"""
Extract unique products from all raw CSV files and create a clean product table.
"""

import pandas as pd
import numpy as np
from pathlib import Path
import re

def clean_text(text):
    """Clean and standardize text fields."""
    if pd.isna(text):
        return ""
    text = str(text).strip()
    # Remove extra whitespace
    text = re.sub(r'\s+', ' ', text)
    return text

def extract_products_from_file(filepath):
    """Extract product data from a single CSV file."""
    print(f"Processing: {filepath.name}")

    # Read CSV
    df = pd.read_csv(filepath)

    # Identify product columns (common across all files based on the headers we saw)
    product_cols = {
        'sku': 'COD SKU',
        'desc1': 'DESC 1 SKU',
        'desc2': 'DESC 2 SKU',
        'supplier_code': 'COD SUPPLIER',
        'supplier_desc1': 'DESC 1 SUPPLIER',
        'supplier_desc2': 'DESC 2 SUPPLIER',
        'brand': 'BRAND',
        'department': 'DEPARTMENT',
        'subgroup': 'DESC SUBGROUP',
        'sales_value': 'SALES VALUE',
        'margin_value': 'MARGIN VALUE',
        'sales_qty': 'SALES QTY',
        'date': 'DATE'
    }

    # Note: We only process Stores and Web files (not Promo)
    # All should have SALES VALUE, SALES QTY, MARGIN VALUE columns

    # Extract relevant columns
    products = df[[product_cols['sku'], product_cols['desc1'], product_cols['desc2'],
                   product_cols['supplier_code'], product_cols['supplier_desc1'],
                   product_cols['supplier_desc2'], product_cols['brand'],
                   product_cols['department'], product_cols['subgroup'],
                   product_cols['sales_value'], product_cols['margin_value'],
                   product_cols['sales_qty'], product_cols['date']]].copy()

    # Rename columns
    products.columns = ['sku', 'desc1', 'desc2', 'supplier_code', 'supplier_desc1',
                       'supplier_desc2', 'brand', 'department', 'subgroup',
                       'sales_value', 'margin_value', 'sales_qty', 'date']

    # Clean text fields
    for col in ['desc1', 'desc2', 'supplier_desc1', 'supplier_desc2', 'brand', 'department', 'subgroup']:
        products[col] = products[col].apply(clean_text)

    # Combine desc1 and desc2 for product name
    products['product_name'] = products['desc1'] + ' ' + products['desc2']
    products['product_name'] = products['product_name'].apply(clean_text)

    # Calculate unit price and unit cost from aggregated data
    products['unit_price'] = products['sales_value'] / products['sales_qty']
    products['unit_cost'] = (products['sales_value'] - products['margin_value']) / products['sales_qty']

    # Handle infinite and NaN values
    products['unit_price'] = products['unit_price'].replace([np.inf, -np.inf], np.nan)
    products['unit_cost'] = products['unit_cost'].replace([np.inf, -np.inf], np.nan)

    return products

def main():
    # Setup paths
    base_path = Path('/Users/smutyala/Desktop/ai-hackathon-xperion-berlin')
    data_path = base_path / 'data' / 'processed'
    output_path = base_path / 'data' / 'processed'
    output_path.mkdir(parents=True, exist_ok=True)

    # Get all raw CSV files EXCEPT the Promo file (promo data should not be in products table)
    csv_files = [f for f in data_path.glob('raw_*.csv') if 'Promo' not in f.name]
    print(f"Found {len(csv_files)} CSV files to process (excluding Promo file)")

    # Extract products from all files
    all_products = []
    for csv_file in csv_files:
        products = extract_products_from_file(csv_file)
        all_products.append(products)

    # Combine all products
    combined = pd.concat(all_products, ignore_index=True)
    print(f"\nTotal product records: {len(combined)}")

    # Group by SKU to get unique products with aggregated data
    # For each SKU, we want:
    # - Latest product information (based on date)
    # - Average prices and costs across all transactions

    print("\nDeduplicating and aggregating product data...")

    # Sort by date to get latest first
    combined['date'] = pd.to_numeric(combined['date'], errors='coerce')
    combined = combined.sort_values('date', ascending=False)

    # Group by SKU and aggregate
    unique_products = combined.groupby('sku').agg({
        'product_name': 'first',  # Take latest (first after sorting by date desc)
        'brand': 'first',
        'department': 'first',
        'subgroup': 'first',
        'supplier_code': 'first',
        'supplier_desc1': 'first',
        'supplier_desc2': 'first',
        'unit_price': 'mean',  # Average price across all transactions
        'unit_cost': 'mean',   # Average cost across all transactions
        'date': 'first'        # Latest date
    }).reset_index()

    print(f"Unique products (by SKU): {len(unique_products)}")

    # Standardize category (lowercase subgroup)
    unique_products['category'] = unique_products['subgroup'].str.lower().str.strip()

    # Calculate margin percentage
    unique_products['margin_percent'] = ((unique_products['unit_price'] - unique_products['unit_cost']) /
                                         unique_products['unit_price'] * 100)

    # Handle cases where margin calculation fails
    unique_products['margin_percent'] = unique_products['margin_percent'].replace([np.inf, -np.inf], np.nan)

    # Filter out invalid products
    print("\nFiltering invalid products...")
    initial_count = len(unique_products)

    # Remove products with missing critical data
    unique_products = unique_products.dropna(subset=['product_name', 'unit_price', 'unit_cost'])
    print(f"Removed {initial_count - len(unique_products)} products with missing critical data")

    # Keep only products where price >= cost (some negative margins are ok for promotions, but flag extreme cases)
    invalid_pricing = unique_products[unique_products['unit_cost'] > unique_products['unit_price'] * 1.5]
    if len(invalid_pricing) > 0:
        print(f"Warning: {len(invalid_pricing)} products have cost > 1.5x price (likely data errors)")
        print(f"Keeping them but margin will be negative")

    # Ensure margin is reasonable (-100% to 100% allows for some promotional losses)
    unique_products.loc[unique_products['margin_percent'] > 100, 'margin_percent'] = 100
    unique_products.loc[unique_products['margin_percent'] < -100, 'margin_percent'] = -100

    # Create product_id (P00001, P00002, etc.) - using 5 digits for 55k+ products
    unique_products = unique_products.reset_index(drop=True)
    unique_products['product_id'] = unique_products.index.map(lambda x: f'P{x+1:05d}')

    # Select and order final columns
    final_products = unique_products[[
        'product_id',
        'sku',
        'product_name',
        'category',
        'unit_price',
        'unit_cost',
        'margin_percent',
        'brand',
        'department',
        'supplier_code',
        'supplier_desc1'
    ]].copy()

    # Rename columns for output
    final_products.columns = [
        'product_id',
        'sku',
        'name',
        'category',
        'base_price',
        'supplier_cost',
        'margin_percent',
        'brand',
        'department',
        'supplier_code',
        'supplier_name'
    ]

    # Round numeric columns
    final_products['base_price'] = final_products['base_price'].round(2)
    final_products['supplier_cost'] = final_products['supplier_cost'].round(2)
    final_products['margin_percent'] = final_products['margin_percent'].round(2)

    # Sort by product_id
    final_products = final_products.sort_values('product_id')

    # Save to CSV
    output_file = output_path / 'clean_products.csv'
    final_products.to_csv(output_file, index=False)
    print(f"\n✓ Created clean products file: {output_file}")
    print(f"  Total unique products: {len(final_products)}")

    # Validation
    print("\n=== VALIDATION ===")

    # Check for duplicate SKUs
    duplicate_skus = final_products['sku'].duplicated().sum()
    print(f"Duplicate SKUs: {duplicate_skus}")

    # Check price > cost ratio
    valid_pricing = (final_products['base_price'] >= final_products['supplier_cost']).sum()
    total = len(final_products)
    print(f"Products with price >= cost: {valid_pricing}/{total} ({valid_pricing/total*100:.1f}%)")

    # Check margin range
    margin_valid = ((final_products['margin_percent'] >= -100) &
                    (final_products['margin_percent'] <= 100)).sum()
    print(f"Products with margin in [-100, 100]: {margin_valid}/{total} ({margin_valid/total*100:.1f}%)")

    # Show summary statistics
    print("\n=== SUMMARY STATISTICS ===")
    print(f"Average base price: ${final_products['base_price'].mean():.2f}")
    print(f"Average supplier cost: ${final_products['supplier_cost'].mean():.2f}")
    print(f"Average margin: {final_products['margin_percent'].mean():.2f}%")
    print(f"\nPrice range: ${final_products['base_price'].min():.2f} - ${final_products['base_price'].max():.2f}")
    print(f"Margin range: {final_products['margin_percent'].min():.2f}% - {final_products['margin_percent'].max():.2f}%")

    # Show categories
    print(f"\n=== CATEGORIES ===")
    print(f"Unique categories: {final_products['category'].nunique()}")
    print("\nTop 10 categories by product count:")
    print(final_products['category'].value_counts().head(10))

    # Show sample products
    print("\n=== SAMPLE PRODUCTS ===")
    print(final_products.head(10).to_string(index=False))

    print("\n✓ Product extraction complete!")

if __name__ == '__main__':
    main()
