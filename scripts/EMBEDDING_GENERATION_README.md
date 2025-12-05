# Embedding Generation Script

## Overview

This script generates vector embeddings for all promo-product combinations using the OpenAI Embeddings API with advanced features for reliability and performance.

## Features

✅ **Batching**: Processes 100 texts per API call (configurable)
✅ **Rate Limiting**: Respects OpenAI's rate limits (1,500 req/min, 6.25M tokens/min)
✅ **Concurrency Control**: Parallel API calls (4 concurrent requests)
✅ **Retry Logic**: Automatic retry with exponential backoff (up to 6 attempts)
✅ **Progress Tracking**: Real-time progress reporting
✅ **Checkpointing**: Resume from last position on interruption
✅ **Error Handling**: Graceful handling of rate limits (429) and network errors

## Prerequisites

1. **OpenAI API Key**: You need an OpenAI API key with access to embeddings
2. **Node.js Dependencies**: Already installed via `pnpm install`

## Setup

### 1. Set OpenAI API Key

Create a `.env.local` file in the project root:

```bash
OPENAI_API_KEY=sk-your-api-key-here
```

Or export it as an environment variable:

```bash
export OPENAI_API_KEY=sk-your-api-key-here
```

### 2. Verify Input Data

Make sure you have the unified dataset with embedding texts:

```bash
ls -lh data/processed/unified_promo_product_data.csv
```

Should show: **~48 MB** with **72,994 rows** and **25 columns** (including `embedding_text`)

## Usage

### Run Embedding Generation

```bash
npx tsx scripts/generate-embeddings.ts
```

### Resume from Checkpoint

If the script is interrupted, resume from where it left off:

```bash
npx tsx scripts/generate-embeddings.ts --resume
```

## Expected Output

The script will create:

1. **`data/processed/embeddings.json`**
   - JSON file with embeddings
   - Format: Array of objects with `promo_id`, `product_id`, `embedding_text`, `embedding` (1536-dim vector)
   - Size: ~600-800 MB (72,994 embeddings × 1536 dimensions)

2. **`data/processed/embeddings.csv`**
   - CSV file with embeddings as JSON strings
   - Useful for analysis tools that prefer CSV

3. **`data/processed/.embeddings_checkpoint.json`** (temporary)
   - Checkpoint file for resuming interrupted runs
   - Automatically deleted when complete

## Configuration

Edit `scripts/generate-embeddings.ts` to customize:

```typescript
const CONFIG = {
  // OpenAI settings
  model: 'text-embedding-3-small',  // 1536 dimensions
  embeddingDimension: 1536,

  // Rate limiting (adjust based on your OpenAI tier)
  batchSize: 100,                   // Texts per API call
  concurrency: 4,                   // Parallel requests
  maxRequestsPerMinute: 1_500,      // Tier 1 limit
  maxTokensPerMinute: 6_250_000,    // Tier 1 limit
  retries: 6,                       // Retry attempts

  // Progress reporting
  progressInterval: 10,             // Report every N batches
};
```

## Performance Estimates

With default settings (Tier 1 limits):

- **Total texts**: 72,994
- **Batch size**: 100 texts
- **Total batches**: ~730
- **Estimated time**: ~5-10 minutes (depends on API latency)
- **Cost**: ~$0.01-0.02 USD (text-embedding-3-small: $0.00002/1K tokens)

## Error Handling

### Rate Limit (429) Errors

The script automatically handles rate limits with:
- Exponential backoff
- Token reservation system
- Request queuing

### Network Errors

Automatic retry with up to 6 attempts before failing.

### Interrupted Execution

Use `--resume` flag to continue from last checkpoint.

## Troubleshooting

### "OPENAI_API_KEY environment variable is required"

Set your API key in `.env.local` or export it:

```bash
export OPENAI_API_KEY=sk-your-key-here
```

### "429 Too Many Requests"

You're hitting rate limits. The script should handle this automatically. If it persists:
- Reduce `batchSize` (try 50)
- Reduce `concurrency` (try 2)
- Lower `maxRequestsPerMinute` (try 500)

### Out of Memory

If processing fails due to memory:
- Process in smaller chunks by modifying batch size
- Use streaming/chunked file writing

## Next Steps

After generating embeddings:

1. **Store in Vector Database**
   - Pinecone, Weaviate, ChromaDB, etc.
   - Enable semantic search

2. **Build Search Interface**
   - Query by natural language
   - Find similar promo-product combinations

3. **LLM Integration**
   - Use for RAG (Retrieval Augmented Generation)
   - Answer questions about promotions

4. **Analysis**
   - Cluster similar promotions
   - Discover patterns

## Technical Details

### Implementation

Based on production code from `mimir-rag` with:
- **AI SDK** (`@ai-sdk/openai`, `ai`)
- **Rate Limiting** (`bottleneck`)
- **Concurrency** (`p-limit`)
- **Retry Logic** (`p-retry`)
- **CSV Parsing** (`papaparse`)

### Token Estimation

Rough estimate: 1 token ≈ 4 characters for English text

Each embedding text is ~470 characters ≈ 120 tokens

Total: 72,994 × 120 = ~8.8M tokens

### API Limits (OpenAI Tier 1)

- Requests per minute: 1,500
- Tokens per minute: 6,250,000
- Input tokens per request: 8,192

## File Structure

```
scripts/
├── generate-embeddings.ts         # Main script
└── EMBEDDING_GENERATION_README.md # This file

data/processed/
├── unified_promo_product_data.csv # Input (with embedding_text)
├── embeddings.json                # Output (will be created)
├── embeddings.csv                 # Output (will be created)
└── .embeddings_checkpoint.json    # Checkpoint (temporary)
```

## Support

For issues or questions:
1. Check OpenAI API status: https://status.openai.com/
2. Verify API key permissions
3. Check rate limits for your tier
4. Review error logs in console

---

Generated: 2025-12-04
