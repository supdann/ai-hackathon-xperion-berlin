#!/usr/bin/env python3
"""
Add natural language embedding texts to unified dataset.
Creates readable descriptions for each promo-product combination.
"""

import pandas as pd
import numpy as np
from pathlib import Path

def format_number(value, decimal_places=1):
    """Format number, handling NaN values."""
    if pd.isna(value):
        return "not available"
    return f"{value:.{decimal_places}f}"

def format_percentage(value, decimal_places=1):
    """Format percentage, handling NaN and negative values."""
    if pd.isna(value):
        return "no baseline data"

    formatted = f"{abs(value):.{decimal_places}f}"

    if value < 0:
        return f"negative {formatted} percent"
    else:
        return f"{formatted} percent"

def clean_text(text):
    """Clean text for embedding - lowercase, remove special chars."""
    if pd.isna(text):
        return "unknown"

    # Convert to string and lowercase
    text = str(text).lower()

    # Remove multiple spaces
    import re
    text = re.sub(r'\s+', ' ', text)

    return text.strip()

def generate_embedding_text(row):
    """
    Generate natural language description for a promo-product combination.

    Target: 100-150 words, natural reading flow
    """

    # Extract and clean fields
    season = clean_text(row['season_label'])
    promo_type = clean_text(row['promo_type'])
    category = clean_text(row['category'])
    product_name = clean_text(row['product_name'])
    brand = clean_text(row['brand'])
    channel = clean_text(row['channel'])
    promo_name = clean_text(row['promo_name'])

    # Format numeric values
    price = format_number(row['base_price'], 2)
    base_margin = format_percentage(row['base_margin_percent'], 1)
    discount = format_percentage(row['discount_percent'], 1)
    units_sold = format_number(row['total_units_sold'], 0)

    # Lift metrics (handle NaN)
    units_lift = format_percentage(row['units_lift_percent'], 1)
    revenue_lift = format_percentage(row['revenue_lift_percent'], 1)

    # Impact metrics
    margin_impact = format_percentage(row['margin_after_discount_percent'] - row['base_margin_percent'], 1) if not pd.isna(row['margin_after_discount_percent']) and not pd.isna(row['base_margin_percent']) else "not available"
    profit_impact = format_number(row['profit_impact_euros'], 2)

    # Build natural language description in parts
    parts = []

    # Part 1: Season and promo type context
    parts.append(f"during {season} season a {promo_type} promotion named {promo_name}")

    # Part 2: Product details
    parts.append(f"featured {category} category product {product_name} from {brand} brand")

    # Part 3: Pricing and margin info
    parts.append(f"priced at {price} euros with base margin of {base_margin}")

    # Part 4: Discount application
    if not pd.isna(row['discount_percent']) and row['discount_percent'] > 0:
        parts.append(f"promoted with {discount} discount")
    else:
        parts.append("promoted without explicit discount percentage")

    # Part 5: Performance metrics
    parts.append(f"sold {units_sold} units")

    # Part 6: Lift analysis
    if units_lift != "no baseline data":
        parts.append(f"achieving {units_lift} units lift and {revenue_lift} revenue lift compared to baseline")
    else:
        parts.append("with no baseline comparison available as product sold exclusively during promotion")

    # Part 7: Financial impact
    parts.append(f"resulting in margin change of {margin_impact} and profit impact of {profit_impact} euros")

    # Part 8: Channel
    parts.append(f"through {channel} channel")

    # Combine all parts into flowing text
    text = " ".join(parts)

    return text

def main():
    # Load unified dataset
    base_path = Path('/Users/smutyala/Desktop/ai-hackathon-xperion-berlin/data/processed')
    input_file = base_path / 'unified_promo_product_data.csv'

    print(f"Loading unified dataset from {input_file}...")
    df = pd.read_csv(input_file)
    print(f"  Loaded {len(df):,} rows")

    # Generate embedding text for each row
    print("\nGenerating embedding texts...")
    print("  This may take a few minutes for 72k+ rows...")

    df['embedding_text'] = df.apply(generate_embedding_text, axis=1)

    print(f"  ✓ Generated {len(df):,} embedding texts")

    # Calculate average text length
    avg_length = df['embedding_text'].str.len().mean()
    avg_words = df['embedding_text'].str.split().str.len().mean()

    print(f"\n=== TEXT STATISTICS ===")
    print(f"Average characters: {avg_length:.0f}")
    print(f"Average words: {avg_words:.0f}")
    print(f"Estimated tokens: ~{avg_words * 1.3:.0f} (rough estimate)")

    # Show samples
    print("\n=== SAMPLE EMBEDDING TEXTS ===")
    for i in range(3):
        print(f"\nSample {i+1}:")
        print(f"  {df.iloc[i]['embedding_text']}")

    # Save updated dataset
    output_file = base_path / 'unified_promo_product_data.csv'
    df.to_csv(output_file, index=False)

    print(f"\n✓ Updated dataset saved to: {output_file}")
    print(f"  Total rows: {len(df):,}")
    print(f"  Total columns: {len(df.columns)} (including embedding_text)")

    # Validation
    print("\n=== VALIDATION ===")
    missing_text = df['embedding_text'].isna().sum()
    empty_text = (df['embedding_text'].str.len() == 0).sum()

    if missing_text == 0 and empty_text == 0:
        print("  ✓ PASS: All rows have embedding text")
    else:
        print(f"  ✗ WARNING: {missing_text} missing, {empty_text} empty texts")

    # Show column list
    print(f"\n=== FINAL COLUMNS ({len(df.columns)}) ===")
    for i, col in enumerate(df.columns, 1):
        print(f"  {i}. {col}")

    print("\n✓ Embedding text generation complete!")

if __name__ == '__main__':
    main()
