# Data Loading Guide

## Prerequisites

1. Database setup completed (see [DB_SETUP_README.md](./DB_SETUP_README.md))
2. Embeddings generated (see `data/processed/embeddings.csv`)
3. Unified data ready (`data/processed/unified_promo_product_data.csv`)

## Load Data into PostgreSQL

Run the data loading script:

```bash
npx tsx scripts/load-data.ts
```

This script will:
1. Load embeddings from `embeddings.csv` (72,294 rows)
2. Load unified promo-product data
3. Match embeddings with products using `promo_id + product_id` keys
4. Insert data in batches of 1,000 rows
5. Show progress every 10,000 rows

### Expected Output

```
🚀 Data Loading Script
======================

📡 Connecting to PostgreSQL...

📂 Loading embeddings from: data/processed/embeddings.csv
   ✓ Loaded 72,294 embeddings

📂 Loading unified data from: data/processed/unified_promo_product_data.csv
   ✓ Loaded 72,994 rows

🔗 Creating embedding lookup map...
   ✓ Created lookup map with 72,294 embeddings

📦 Preparing data for insertion...
   ✓ Prepared 72,294 rows
   ⚠️  Skipped 700 rows (no embedding found)

💾 Inserting data (batch size: 1,000)...

   Progress: 13.8% (10,000/72,294) - 2.5s - 4000 rows/sec
   Progress: 27.7% (20,000/72,294) - 5.1s - 3922 rows/sec
   ...
   Progress: 100.0% (72,294/72,294) - 18.2s - 3971 rows/sec

✅ Data loading completed!
   Total inserted: 72,294 rows
   Duration: 18.2s
   Average rate: 3971 rows/sec

🔍 Verifying data...
   ✓ Final row count: 72,294

📋 Sample rows:
   1. PR0091 - P13197 - NO IVA CE OTTOBRE 2024 (lcd uhd da 51p a 59p, blackfriday)
   2. PR0091 - P25227 - NO IVA CE OTTOBRE 2024 (lcd uhd da 60p a 74p, blackfriday)
   3. PR0091 - P19378 - NO IVA CE OTTOBRE 2024 (escooter, blackfriday)

✨ All done!
```

## API Routes

### Query Promos

```bash
# Get all promos
GET /api/promos

# Filter by season
GET /api/promos?seasonLabel=blackfriday

# Filter by category
GET /api/promos?category=lcd%20uhd%20da%2051p%20a%2059p

# Search by text
GET /api/promos?search=samsung

# Pagination
GET /api/promos?limit=50&offset=100

# Sort by margin
GET /api/promos?orderBy=margin&order=desc
```

### Semantic Search

```bash
POST /api/promos/search
Content-Type: application/json

{
  "query": "high margin electronics for christmas",
  "limit": 10,
  "minSimilarity": 0.7,
  "filters": {
    "seasonLabel": "christmas",
    "channel": "web"
  }
}
```

### Get Statistics

```bash
# Total count
GET /api/promos/stats?type=count

# Stats by category
GET /api/promos/stats?type=category

# Stats by season
GET /api/promos/stats?type=season

# Top performing promos
GET /api/promos/stats?type=top_promos&limit=10

# Top selling products
GET /api/promos/stats?type=top_products&limit=10

# Get filter options
GET /api/promos/stats?type=filters
```

### Single Promo Operations

```bash
# Get by ID
GET /api/promos/123

# Update
PATCH /api/promos/123
Content-Type: application/json

{
  "basePrice": 299.99,
  "discountPercent": 15.0
}

# Delete
DELETE /api/promos/123
```

## CRUD Functions

Import from `@/lib/db/promo-queries`:

### Create

```typescript
import { createPromoProduct, bulkInsertPromoProducts } from '@/lib/db/promo-queries';

// Single insert
const promo = await createPromoProduct({
  promoId: 'PR0001',
  productId: 'P00001',
  promoName: 'Summer Sale',
  seasonLabel: 'summer',
  category: 'electronics',
  // ... other fields
  embedding: JSON.stringify(embeddingArray),
});

// Bulk insert
const promos = await bulkInsertPromoProducts([/* array of promo objects */]);
```

### Read

```typescript
import {
  getPromoProductById,
  getPromoProductsByPromoId,
  getPromoProductsByFilters,
} from '@/lib/db/promo-queries';

// Get by ID
const promo = await getPromoProductById(123);

// Get all products in a promo
const promoProducts = await getPromoProductsByPromoId('PR0001');

// Filter and paginate
const results = await getPromoProductsByFilters(
  {
    seasonLabel: 'blackfriday',
    category: 'electronics',
    minMargin: 10.0,
  },
  {
    limit: 50,
    offset: 0,
    orderBy: 'margin',
    order: 'desc',
  }
);
```

### Vector Search

```typescript
import {
  searchPromoProductsBySimilarity,
  findSimilarPromoProducts,
} from '@/lib/db/promo-queries';

// Search by embedding
const results = await searchPromoProductsBySimilarity({
  query: 'high-end laptops',
  embedding: embeddingArray,
  limit: 10,
  filters: {
    seasonLabel: 'backtoschool',
  },
  minSimilarity: 0.75,
});

// Find similar products
const similar = await findSimilarPromoProducts(
  'P00001',
  10,
  { seasonLabel: 'christmas' }
);
```

### Aggregations

```typescript
import {
  getPromoStatsByCategory,
  getPromoStatsBySeason,
  getTopPerformingPromos,
  getTopSellingProducts,
} from '@/lib/db/promo-queries';

// Get category stats
const categoryStats = await getPromoStatsByCategory();

// Get seasonal stats
const seasonStats = await getPromoStatsBySeason();

// Get top performers
const topPromos = await getTopPerformingPromos(10);
const topProducts = await getTopSellingProducts(10);
```

### Update & Delete

```typescript
import {
  updatePromoProduct,
  deletePromoProduct,
  deletePromoProductsByPromoId,
} from '@/lib/db/promo-queries';

// Update
const updated = await updatePromoProduct(123, {
  basePrice: 299.99,
  discountPercent: 15.0,
});

// Delete single
await deletePromoProduct(123);

// Delete all products in a promo
await deletePromoProductsByPromoId('PR0001');
```

### Utilities

```typescript
import { getTotalCount, getUniqueValues } from '@/lib/db/promo-queries';

// Get total row count
const count = await getTotalCount();

// Get unique filter values
const seasons = await getUniqueValues('seasonLabel');
const categories = await getUniqueValues('category');
const channels = await getUniqueValues('channel');
const promoTypes = await getUniqueValues('promoType');
```

## Troubleshooting

### Slow inserts

If inserts are slow:
1. Check database connection pool settings
2. Increase batch size (try 5000 or 10000)
3. Ensure indexes are created AFTER bulk insert
4. Use `COPY` command for very large datasets

### Missing embeddings

If some rows are skipped:
1. Check that `promo_id + product_id` keys match between files
2. Verify embeddings were generated for all rows
3. Check for data type mismatches

### Memory issues

If script runs out of memory:
1. Process files in smaller chunks
2. Stream CSV instead of loading all at once
3. Increase Node.js memory: `NODE_OPTIONS=--max-old-space-size=4096 npx tsx scripts/load-data.ts`

## Next Steps

After loading data, you're ready to:
1. Run semantic search queries
2. Build recommendation systems
3. Analyze promo performance
4. Create dashboards and visualizations
