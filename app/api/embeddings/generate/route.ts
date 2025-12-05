import { NextRequest, NextResponse } from 'next/server';
import { createOpenAI } from '@ai-sdk/openai';
import { embedMany } from 'ai';
import Bottleneck from 'bottleneck';
import pLimit from 'p-limit';
import pRetry from 'p-retry';
import * as fs from 'fs/promises';
import Papa from 'papaparse';

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  model: 'text-embedding-3-small',
  batchSize: 100,
  concurrency: 4,
  maxRequestsPerMinute: 1_500,
  maxTokensPerMinute: 6_250_000,
  retries: 6,
  inputFile: 'data/processed/unified_promo_product_data.csv',
  outputFile: 'data/processed/embeddings.csv',
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

  constructor(apiKey: string) {
    this.sdk = createOpenAI({ apiKey });

    this.requestLimiter = createRateLimiter(
      CONFIG.concurrency,
      CONFIG.maxRequestsPerMinute
    );

    this.tokenLimiter = createRateLimiter(
      Math.max(CONFIG.concurrency, Math.ceil(CONFIG.maxTokensPerMinute)),
      CONFIG.maxTokensPerMinute
    );
  }

  async generate(rows: Row[], startIndex: number = 0, onProgress?: (progress: number) => void): Promise<void> {
    // Initialize CSV file if starting from scratch
    if (startIndex === 0) {
      const header = 'promo_id,product_id,embedding_text,embedding\n';
      await fs.writeFile(CONFIG.outputFile, header);
    }

    const rowsToProcess = rows.slice(startIndex);
    const batches = batchArray(rowsToProcess, CONFIG.batchSize);

    const limit = pLimit(CONFIG.concurrency);

    await Promise.all(
      batches.map((batch, batchIdx) =>
        limit(async () => {
          const absoluteIndex = startIndex + (batchIdx * CONFIG.batchSize);
          await this.processBatch(batch, batchIdx, batches.length, absoluteIndex);

          if (onProgress) {
            const progress = ((batchIdx + 1) / batches.length) * 100;
            onProgress(progress);
          }
        })
      )
    );

    await this.flushBuffer();
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

    // Save every N batches
    if ((batchIdx + 1) % CONFIG.saveInterval === 0) {
      await this.flushBuffer();
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

  getTotalProcessed(): number {
    return this.totalProcessed;
  }
}

// ============================================================================
// API ROUTE HANDLER
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'OPENAI_API_KEY not configured' },
        { status: 500 }
      );
    }

    // Load input data
    const rows = await loadCSV(CONFIG.inputFile);

    // Check existing progress
    const existingLines = await countLinesInFile(CONFIG.outputFile);
    const startIndex = existingLines > 1 ? existingLines - 1 : 0;

    if (startIndex >= rows.length) {
      return NextResponse.json({
        message: 'All embeddings already generated',
        total: rows.length,
        completed: startIndex,
      });
    }

    // Generate embeddings
    const generator = new EmbeddingGenerator(apiKey);
    await generator.generate(rows, startIndex);

    return NextResponse.json({
      message: 'Embeddings generated successfully',
      total: rows.length,
      processed: generator.getTotalProcessed(),
      outputFile: CONFIG.outputFile,
    });

  } catch (error) {
    console.error('Embedding generation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    // Get status of embeddings generation
    const totalRows = (await loadCSV(CONFIG.inputFile)).length;
    const existingLines = await countLinesInFile(CONFIG.outputFile);
    const completed = existingLines > 1 ? existingLines - 1 : 0;

    return NextResponse.json({
      total: totalRows,
      completed,
      remaining: totalRows - completed,
      progress: ((completed / totalRows) * 100).toFixed(2) + '%',
    });

  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
