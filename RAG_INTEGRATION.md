# RAG Integration Guide

## Overview

The chat application now has **RAG (Retrieval-Augmented Generation)** capabilities integrated. The AI can search and retrieve information from a database of **72,121 promotional campaigns and products** using semantic vector search.

## Architecture

### 1. **Database**
- **Table**: `unified_promo_product`
- **Rows**: 72,121 promo-product combinations
- **Vector Field**: 1536-dimensional embeddings (OpenAI text-embedding-3-small)
- **Indexes**:
  - B-tree indexes on: season_label, category, product_id
  - IVFFlat index on embeddings for fast vector similarity search

### 2. **Tools Available to AI**

Three new tools have been added to the chat API that the AI can automatically call:

#### **searchPromos** ([lib/ai/tools/search-promos.ts](lib/ai/tools/search-promos.ts))
Semantic search using vector embeddings.

**Use cases:**
- "Find the best electronics deals"
- "Show me summer promotions for toys"
- "What are the most profitable Black Friday campaigns?"

**Parameters:**
- `query` (required): Natural language search query
- `limit`: Max results (default: 5, max: 20)
- `seasonLabel`: Filter by season
- `category`: Filter by category
- `channel`: Filter by sales channel
- `minSimilarity`: Similarity threshold (0-1, default: 0.5)

**How it works:**
1. Generates embedding for user's query using OpenAI API
2. Performs cosine similarity search against 72K embeddings in database
3. Returns ranked results with similarity scores

#### **getPromoDetails** ([lib/ai/tools/get-promo-details.ts](lib/ai/tools/get-promo-details.ts))
Get detailed information about specific promotions or filtered results.

**Use cases:**
- "Show me details for promo PR0091"
- "Get all promotions for product P19270"
- "List all online promotions for electronics under 50 euros"

**Parameters:**
- `promoId`: Specific promo ID
- `productId`: Specific product ID
- `category`, `seasonLabel`, `channel`, `promoType`: Filters
- `minPrice`, `maxPrice`: Price range filters
- `limit`: Max results (default: 10, max: 50)

#### **getPromoStats** ([lib/ai/tools/get-promo-stats.ts](lib/ai/tools/get-promo-stats.ts))
Get aggregated statistics and analytics.

**Use cases:**
- "What are the overall promotion statistics?"
- "Show me performance by category"
- "Which promotions performed best?"
- "Compare seasonal performance"

**Parameters:**
- `statsType`: "total" | "by_category" | "by_season" | "top_promos"
- `limit`: For top_promos, number of results (default: 10, max: 50)
- `sortBy`: "total_revenue" | "total_units" | "avg_margin"

### 3. **Data Schema**

Each promo-product record contains:

**Identity:**
- `promoId`, `productId`, `promoName`, `productName`, `productSku`, `brand`

**Classification:**
- `category`, `seasonLabel`, `channel`, `promoType`

**Pricing:**
- `basePrice`, `supplierCost`, `discountPercent`, `baseMarginPercent`, `marginAfterDiscountPercent`

**Performance:**
- `timesPromoted`, `totalUnitsSold`, `baselineUnits`
- `unitsLiftPercent`, `revenueLiftPercent`
- `marginImpactEuros`, `profitImpactEuros`

**Dates:**
- `dateStart`, `dateEnd`

**Vector:**
- `embedding`: 1536-dimensional vector for semantic search

## How to Use

### Example Chat Queries

The AI will automatically use these tools when appropriate. Here are example queries:

**Semantic Search:**
```
User: "Find me the best Black Friday deals on electronics"
AI: *Calls searchPromos with query and filters*
```

**Specific Details:**
```
User: "Show me all products in promotion PR0091"
AI: *Calls getPromoDetails with promoId filter*
```

**Analytics:**
```
User: "Which product categories perform best?"
AI: *Calls getPromoStats with statsType="by_category"*
```

**Complex Queries:**
```
User: "Compare the performance of summer vs winter toy promotions"
AI: *Calls searchPromos multiple times with different filters, or getPromoStats*
```

### Testing

You can test the RAG integration by:

1. **Start the development server:**
   ```bash
   npm run dev
   ```

2. **Create a new chat** and try queries like:
   - "What promotions do we have in the database?"
   - "Find profitable electronics deals"
   - "Show me Black Friday performance statistics"
   - "Which brands have the highest margin impact?"

## API Routes

Direct API access is also available (without chat):

### GET `/api/promos`
Query promotions with filters and pagination.

**Query Parameters:**
- `seasonLabel`, `category`, `channel`, `promoType`
- `minPrice`, `maxPrice`, `search`
- `limit`, `offset`, `orderBy`, `order`

### POST `/api/promos/search`
Semantic vector search.

**Body:**
```json
{
  "query": "best electronics deals",
  "limit": 10,
  "filters": {
    "seasonLabel": "blackfriday",
    "category": "electronics"
  }
}
```

### GET `/api/promos/stats`
Get aggregated statistics.

**Query Parameters:**
- `type`: "count" | "category" | "season" | "top_promos" | "top_products" | "filters"
- `limit`: For top results
- `sortBy`: For top results

### GET/PATCH/DELETE `/api/promos/[id]`
Single promo operations by database ID.

## Technical Details

### Vector Search Performance

- **Index Type**: IVFFlat (Inverted File with Flat compression)
- **Distance Metric**: Cosine similarity
- **Lists**: 100 (for IVFFlat clustering)
- **Typical Query Time**: ~50-200ms for semantic search on 72K vectors

### Memory Optimization

The data loading process uses:
- **Streaming**: Papa Parse streams the 1.3GB embeddings CSV
- **Batch Processing**: 500 rows per batch insert
- **Resume Capability**: Can continue from interruption points

### Error Handling

All tools include:
- Try-catch error handling
- Descriptive error messages returned to AI
- Console logging for debugging
- Graceful fallbacks (empty results vs errors)

## Files Modified/Created

### Tools
- [lib/ai/tools/search-promos.ts](lib/ai/tools/search-promos.ts) - Semantic search tool
- [lib/ai/tools/get-promo-details.ts](lib/ai/tools/get-promo-details.ts) - Detail retrieval tool
- [lib/ai/tools/get-promo-stats.ts](lib/ai/tools/get-promo-stats.ts) - Analytics tool

### Database
- [lib/db/schema.ts](lib/db/schema.ts) - Updated schema with 26 columns
- [lib/db/promo-queries.ts](lib/db/promo-queries.ts) - Comprehensive CRUD functions
- [lib/db/load-data-optimized.ts](lib/db/load-data-optimized.ts) - Optimized data loader
- [lib/db/load-data-resume.ts](lib/db/load-data-resume.ts) - Resume-capable loader
- [lib/db/migrations/0008_brainy_inhumans.sql](lib/db/migrations/0008_brainy_inhumans.sql) - Migration

### API Routes
- [app/api/promos/route.ts](app/api/promos/route.ts) - Query endpoint
- [app/api/promos/search/route.ts](app/api/promos/search/route.ts) - Search endpoint
- [app/api/promos/stats/route.ts](app/api/promos/stats/route.ts) - Stats endpoint
- [app/api/promos/[id]/route.ts](app/api/promos/[id]/route.ts) - Single promo CRUD

### Chat Integration
- [app/(chat)/api/chat/route.ts](app/(chat)/api/chat/route.ts) - Added RAG tools to chat

## Environment Variables Required

Make sure these are set in `.env.local`:

```bash
# PostgreSQL with pgvector
POSTGRES_URL="your-railway-postgres-url"

# OpenAI for embeddings
OPENAI_API_KEY="your-openai-api-key"
```

## Data Statistics

- **Total Rows**: 72,121
- **Coverage**: 99.76% of available embeddings
- **Missing**: 173 rows (data quality edge cases)
- **File Sizes**:
  - Embeddings CSV: 1.3GB
  - Unified Data CSV: ~50MB
- **Database Size**: ~500MB with indexes

## Next Steps

Potential enhancements:

1. **Hybrid Search**: Combine vector search with keyword/filter search
2. **Reranking**: Add cross-encoder reranking for better relevance
3. **Caching**: Cache common queries and embeddings
4. **Analytics Dashboard**: Build UI for visualizing promo statistics
5. **Recommendations**: Use embeddings for product/promo recommendations
6. **A/B Testing**: Compare promo strategies using the data
