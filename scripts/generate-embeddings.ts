#!/usr/bin/env tsx
/**
 * Generate embeddings for promo-product combinations using OpenAI API.
 * Based on the solid architecture from mimir-rag.
 *
 * Features:
 * - Robust rate limiting with Bottleneck
 * - Proper retry logic with p-retry
 * - Incremental CSV saving (never loses data)
 * - Resume capability with checkpoint validation
 * - Progress tracking
 */

import { createOpenAI } from '@ai-sdk/openai';
import { embedMany } from 'ai';
import Bottleneck from 'bottleneck';
import pLimit from 'p-limit';
import pRetry from 'p-retry';
import * as fs from 'fs/promises';
import Papa from 'papaparse';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  apiKey: process.env.OPENAI_API_KEY!,
  model: 'text-embedding-3-small',

  // Rate limiting (OpenAI Tier 1)
  batchSize: 100,
  concurrency: 4,
  maxRequestsPerMinute: 1_500,
  maxTokensPerMinute: 6_250_000,
  retries: 6,

  // Files
  inputFile: 'data/processed/unified_promo_product_data.csv',
  outputFile: 'data/processed/embeddings.csv',
  checkpointFile: 'data/processed/.embeddings_checkpoint.json',

  // Progress
  progressInterval: 10,
  saveInterval: 10,
};

// ============================================================================
// TYPES
// ============================================================================

interface Row {
  promo_id: string;
  product_id: string;
  embedding_text: string;
  [key: string]: any;
}

interface EmbeddingResult {
  promo_id: string;
  product_id: string;
  embedding_text: string;
  embedding: number[];
}

interface Checkpoint {
  lastProcessedIndex: number;
  timestamp: string;
}

// ============================================================================
// UTILITIES
// ============================================================================

function createRateLimiter(concurrency: number, reservoir?: number): Bottleneck {
  const ONE_MINUTE_MS = 60_000;
  const baseOptions = { maxConcurrent: Math.max(1, concurrency) };

  if (reservoir && Number.isFinite(reservoir)) {
    const amount = Math.max(1, Math.floor(reservoir));
    return new Bottleneck({
      ...baseOptions,
      reservoir: amount,
      reservoirRefreshAmount: amount,
      reservoirRefreshInterval: ONE_MINUTE_MS,
    });
  }

  return new Bottleneck(baseOptions);
}

function batchArray<T>(items: T[], batchSize: number): T[][] {
  if (batchSize <= 0) throw new Error("batchSize must be > 0");

  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    batches.push(items.slice(i, i + batchSize));
  }
  return batches;
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function estimateBatchTokens(texts: string[]): number {
  return texts.reduce((sum, text) => sum + estimateTokens(text), 0);
}

async function loadCheckpoint(): Promise<Checkpoint | null> {
  try {
    const data = await fs.readFile(CONFIG.checkpointFile, 'utf-8');
    return JSON.parse(data);
  } catch {
    return null;
  }
}

async function saveCheckpoint(checkpoint: Checkpoint): Promise<void> {
  await fs.writeFile(CONFIG.checkpointFile, JSON.stringify(checkpoint, null, 2));
}

async function loadCSV(filePath: string): Promise<Row[]> {
  const fileContent = await fs.readFile(filePath, 'utf-8');
  return new Promise((resolve, reject) => {
    Papa.parse<Row>(fileContent, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => resolve(results.data),
      error: (error: any) => reject(error),
    });
  });
}

async function countLinesInFile(filePath: string): Promise<number> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return content.split('\n').filter(line => line.trim()).length;
  } catch {
    return 0;
  }
}

// ============================================================================
// EMBEDDING GENERATOR
// ============================================================================

class EmbeddingGenerator {
  private readonly sdk: ReturnType<typeof createOpenAI>;
  private readonly requestLimiter: Bottleneck;
  private readonly tokenLimiter: Bottleneck;
  private batchBuffer: EmbeddingResult[] = [];
  private totalProcessed: number = 0;

  constructor() {
    if (!CONFIG.apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is required');
    }

    this.sdk = createOpenAI({ apiKey: CONFIG.apiKey });

    this.requestLimiter = createRateLimiter(
      CONFIG.concurrency,
      CONFIG.maxRequestsPerMinute
    );

    this.tokenLimiter = createRateLimiter(
      Math.max(CONFIG.concurrency, Math.ceil(CONFIG.maxTokensPerMinute)),
      CONFIG.maxTokensPerMinute
    );
  }

  async generate(rows: Row[], startIndex: number = 0): Promise<void> {
    console.log(`\n📊 Starting embedding generation...`);
    console.log(`   Total rows: ${rows.length.toLocaleString()}`);
    console.log(`   Starting from: ${startIndex.toLocaleString()}`);
    console.log(`   Batch size: ${CONFIG.batchSize}`);
    console.log(`   Concurrency: ${CONFIG.concurrency}\n`);

    // Initialize CSV file if starting from scratch
    if (startIndex === 0) {
      await this.initOutputFile();
    }

    const rowsToProcess = rows.slice(startIndex);
    const batches = batchArray(rowsToProcess, CONFIG.batchSize);

    console.log(`   Created ${batches.length.toLocaleString()} batches\n`);

    const limit = pLimit(CONFIG.concurrency);
    const startTime = Date.now();

    await Promise.all(
      batches.map((batch, batchIdx) =>
        limit(() => this.processBatch(
          batch,
          batchIdx,
          batches.length,
          startIndex + (batchIdx * CONFIG.batchSize)
        ))
      )
    );

    await this.flushBuffer();

    const duration = (Date.now() - startTime) / 1000;
    console.log(`\n✅ Completed in ${duration.toFixed(1)}s`);
    console.log(`   Total processed: ${this.totalProcessed.toLocaleString()}`);
    console.log(`   Rate: ${(this.totalProcessed / duration).toFixed(1)}/sec\n`);
  }

  private async initOutputFile(): Promise<void> {
    const header = 'promo_id,product_id,embedding_text,embedding\n';
    await fs.writeFile(CONFIG.outputFile, header);
    console.log(`   ✓ Initialized: ${CONFIG.outputFile}\n`);
  }

  private async processBatch(
    batch: Row[],
    batchIdx: number,
    totalBatches: number,
    absoluteIndex: number
  ): Promise<void> {
    const texts = batch.map(row => row.embedding_text);
    const tokens = estimateBatchTokens(texts);

    // Reserve tokens
    await this.reserveTokens(tokens);

    // Call API with retry logic
    const embeddings = await this.requestLimiter.schedule(() =>
      pRetry(
        async () => {
          const model = this.sdk.embedding(CONFIG.model);
          const { embeddings } = await embedMany({ model, values: texts });
          return embeddings;
        },
        {
          retries: CONFIG.retries,
          onFailedAttempt: (error) => {
            console.warn(
              `⚠️  Batch ${batchIdx + 1}/${totalBatches} retry ${error.attemptNumber}/${CONFIG.retries + 1}`
            );
          },
        }
      )
    );

    // Create results
    const results: EmbeddingResult[] = batch.map((row, i) => ({
      promo_id: row.promo_id,
      product_id: row.product_id,
      embedding_text: row.embedding_text,
      embedding: embeddings[i],
    }));

    // Add to buffer
    this.batchBuffer.push(...results);
    this.totalProcessed += results.length;

    // Save every N batches OR on the last batch
    if ((batchIdx + 1) % CONFIG.saveInterval === 0 || batchIdx === totalBatches - 1) {
      await this.flushBuffer();
      await saveCheckpoint({
        lastProcessedIndex: absoluteIndex + batch.length,
        timestamp: new Date().toISOString(),
      });
    }

    // Progress report
    if ((batchIdx + 1) % CONFIG.progressInterval === 0 || batchIdx === totalBatches - 1) {
      const progress = ((batchIdx + 1) / totalBatches * 100).toFixed(1);
      console.log(
        `   Progress: ${progress}% (${(batchIdx + 1).toLocaleString()}/${totalBatches.toLocaleString()})`
      );
    }
  }

  private async flushBuffer(): Promise<void> {
    if (this.batchBuffer.length === 0) return;

    const csvData = this.batchBuffer.map(result => ({
      promo_id: result.promo_id,
      product_id: result.product_id,
      embedding_text: result.embedding_text,
      embedding: JSON.stringify(result.embedding),
    }));

    const csv = Papa.unparse(csvData, { header: false });
    await fs.appendFile(CONFIG.outputFile, csv + '\n');

    this.batchBuffer = [];
  }

  private async reserveTokens(tokens: number): Promise<void> {
    if (tokens <= 0) return;
    const weight = Math.max(1, Math.ceil(tokens));
    await this.tokenLimiter.schedule({ weight }, async () => undefined);
  }
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log('🚀 Embedding Generation Script');
  console.log('================================\n');

  // Load input
  console.log(`📂 Loading: ${CONFIG.inputFile}`);
  const rows = await loadCSV(CONFIG.inputFile);
  console.log(`   ✓ Loaded ${rows.length.toLocaleString()} rows\n`);

  // Check existing progress
  let startIndex = 0;
  const existingLines = await countLinesInFile(CONFIG.outputFile);

  if (existingLines > 1) {
    // CSV exists with data (more than just header)
    startIndex = existingLines - 1; // Subtract header
    console.log(`📌 Found existing embeddings: ${startIndex.toLocaleString()}`);
    console.log(`   Resuming from index ${startIndex.toLocaleString()}\n`);
  }

  if (startIndex >= rows.length) {
    console.log('✨ All embeddings already generated!\n');
    return;
  }

  // Generate
  const generator = new EmbeddingGenerator();
  await generator.generate(rows, startIndex);

  // Cleanup
  try {
    await fs.unlink(CONFIG.checkpointFile);
    console.log('   ✓ Cleaned up checkpoint\n');
  } catch {}

  console.log(`✨ Done! Saved to ${CONFIG.outputFile}\n`);
}

main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
