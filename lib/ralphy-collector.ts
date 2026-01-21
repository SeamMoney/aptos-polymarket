/**
 * Ralphy Collector - Persistent hash collection with zero information loss
 *
 * Streams transaction hashes to disk immediately as they're collected,
 * ensuring no data loss even on crash. Uses append-only JSONL format
 * for maximum reliability and recoverability.
 */

import fs from 'fs';
import path from 'path';
import readline from 'readline';

// Directory structure for Ralphy data
const RALPHY_DIR = '.ralphy';
const HASHES_DIR = path.join(RALPHY_DIR, 'hashes');
const STATE_DIR = path.join(RALPHY_DIR, 'state');
const ANALYTICS_DIR = path.join(RALPHY_DIR, 'analytics');

/**
 * Transaction record - everything we know about a submitted transaction
 */
export interface TransactionRecord {
  hash: string;                    // Transaction hash from mempool
  sender: string;                  // Sender address
  recipient: string;               // Recipient address
  amount: number;                  // Transfer amount in octas
  submitTime: number;              // Client-side submission timestamp (ms)
  submitSuccess: boolean;          // Did mempool accept?
  workerIndex: number;             // Which worker submitted
  accountIndex: number;            // Which account used
  batchId: number;                 // Batch identifier for grouping
  latencyMs?: number;              // Submission latency (if tracked)
  error?: string;                  // Error message (if failed)
}

/**
 * Verification result for a single hash (added during verification)
 */
export interface VerificationResult {
  status: 'confirmed' | 'failed' | 'pending' | 'dropped' | 'unknown';
  onChainTimestamp?: number;       // Microseconds from chain
  gasUsed?: number;
  vmStatus?: string;               // VM status for failed txns
  verifiedAt: number;              // When we verified (ms)
  attempt: number;                 // Which verification pass found this
}

/**
 * Combined record with verification status
 */
export interface VerifiedRecord extends TransactionRecord {
  verification?: VerificationResult;
}

/**
 * Configuration for the collector
 */
export interface CollectorConfig {
  flushInterval: number;           // Flush to disk every N records
  flushTimeoutMs: number;          // Or every N milliseconds
  workerId?: number;               // Optional worker ID for multi-worker setups
}

const DEFAULT_CONFIG: CollectorConfig = {
  flushInterval: 100,              // Flush every 100 records
  flushTimeoutMs: 1000,            // Or every 1 second
};

/**
 * Ralphy Collector - Persistent hash collection
 */
export class RalphyCollector {
  private demoId: string = '';
  private workerId: number | undefined;
  private hashFile: string = '';
  private writeStream: fs.WriteStream | null = null;
  private buffer: TransactionRecord[] = [];
  private count: number = 0;
  private flushTimer: NodeJS.Timeout | null = null;
  private config: CollectorConfig;
  private initialized: boolean = false;

  constructor(config: Partial<CollectorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.workerId = config.workerId;
  }

  /**
   * Initialize for a new demo run
   */
  async init(demoId: string): Promise<void> {
    this.demoId = demoId;

    // Create directory structure
    await this.ensureDirectories();

    // Create hash file - include workerId if provided for multi-worker setups
    const filename = this.workerId !== undefined
      ? `${demoId}-worker-${this.workerId}.jsonl`
      : `${demoId}.jsonl`;
    this.hashFile = path.join(HASHES_DIR, filename);

    // Open write stream in append mode
    this.writeStream = fs.createWriteStream(this.hashFile, {
      flags: 'a',
      encoding: 'utf8',
    });

    // Start flush timer
    this.flushTimer = setInterval(() => {
      this.flushBuffer();
    }, this.config.flushTimeoutMs);

    this.initialized = true;
  }

  /**
   * Ensure all Ralphy directories exist
   */
  private async ensureDirectories(): Promise<void> {
    const dirs = [RALPHY_DIR, HASHES_DIR, STATE_DIR, ANALYTICS_DIR];
    for (const dir of dirs) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
  }

  /**
   * Record a transaction hash (write-through to buffer, periodic flush to disk)
   */
  record(record: TransactionRecord): void {
    if (!this.initialized) {
      throw new Error('Collector not initialized. Call init() first.');
    }

    this.buffer.push(record);
    this.count++;

    // Flush if buffer is full
    if (this.buffer.length >= this.config.flushInterval) {
      this.flushBuffer();
    }
  }

  /**
   * Flush buffer to disk
   */
  private flushBuffer(): void {
    if (this.buffer.length === 0 || !this.writeStream) {
      return;
    }

    // Write each record as a JSON line
    const lines = this.buffer.map(r => JSON.stringify(r)).join('\n') + '\n';
    this.writeStream.write(lines);

    // Clear buffer
    this.buffer = [];
  }

  /**
   * Force flush and close the stream
   */
  async flush(): Promise<void> {
    // Flush remaining buffer
    this.flushBuffer();

    // Clear timer
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }

    // Close write stream
    if (this.writeStream) {
      await new Promise<void>((resolve, reject) => {
        this.writeStream!.end((err: Error | null | undefined) => {
          if (err) reject(err);
          else resolve();
        });
      });
      this.writeStream = null;
    }
  }

  /**
   * Get all recorded hashes (async iterator for memory efficiency)
   */
  async *getHashes(): AsyncIterableIterator<TransactionRecord> {
    // First flush any pending writes
    this.flushBuffer();

    // Read from file
    if (!fs.existsSync(this.hashFile)) {
      return;
    }

    const fileStream = fs.createReadStream(this.hashFile, { encoding: 'utf8' });
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    });

    for await (const line of rl) {
      if (line.trim()) {
        try {
          yield JSON.parse(line) as TransactionRecord;
        } catch {
          // Skip malformed lines
        }
      }
    }
  }

  /**
   * Get all hashes as an array (loads into memory)
   */
  async getAllHashes(): Promise<TransactionRecord[]> {
    const hashes: TransactionRecord[] = [];
    for await (const hash of this.getHashes()) {
      hashes.push(hash);
    }
    return hashes;
  }

  /**
   * Get count without loading all into memory
   */
  async getCount(): Promise<number> {
    // Flush first to ensure all writes are on disk
    this.flushBuffer();

    if (!fs.existsSync(this.hashFile)) {
      return this.count;
    }

    // Count lines in file
    let lineCount = 0;
    const fileStream = fs.createReadStream(this.hashFile, { encoding: 'utf8' });
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    });

    for await (const line of rl) {
      if (line.trim()) {
        lineCount++;
      }
    }

    return lineCount;
  }

  /**
   * Get demo ID
   */
  getDemoId(): string {
    return this.demoId;
  }

  /**
   * Get hash file path
   */
  getHashFile(): string {
    return this.hashFile;
  }

  /**
   * Check if initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }
}

/**
 * Load hashes from a single file
 */
async function loadHashesFromSingleFile(hashFile: string): Promise<TransactionRecord[]> {
  if (!fs.existsSync(hashFile)) {
    return [];
  }

  const hashes: TransactionRecord[] = [];
  const fileStream = fs.createReadStream(hashFile, { encoding: 'utf8' });
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    if (line.trim()) {
      try {
        hashes.push(JSON.parse(line) as TransactionRecord);
      } catch {
        // Skip malformed lines
      }
    }
  }

  return hashes;
}

/**
 * Load hashes from an existing demo file (supports both single and multi-worker files)
 * For multi-worker demos, this merges all worker files into a single array sorted by submitTime
 */
export async function loadHashesFromFile(demoId: string): Promise<TransactionRecord[]> {
  // Check for single file first
  const singleFile = path.join(HASHES_DIR, `${demoId}.jsonl`);
  if (fs.existsSync(singleFile)) {
    return loadHashesFromSingleFile(singleFile);
  }

  // Check for multi-worker files
  const workerFiles = getWorkerFiles(demoId);
  if (workerFiles.length === 0) {
    throw new Error(`No hash files found for demo: ${demoId}`);
  }

  // Load and merge all worker files
  const allHashes: TransactionRecord[] = [];
  for (const file of workerFiles) {
    const hashes = await loadHashesFromSingleFile(file);
    allHashes.push(...hashes);
  }

  // Sort by submitTime for chronological order
  allHashes.sort((a, b) => a.submitTime - b.submitTime);

  return allHashes;
}

/**
 * Get all worker files for a demo
 */
export function getWorkerFiles(demoId: string): string[] {
  if (!fs.existsSync(HASHES_DIR)) {
    return [];
  }

  const files = fs.readdirSync(HASHES_DIR);
  const pattern = new RegExp(`^${escapeRegExp(demoId)}(-worker-\\d+)?\\.jsonl$`);

  return files
    .filter(f => pattern.test(f))
    .map(f => path.join(HASHES_DIR, f))
    .sort();
}

/**
 * Escape special regex characters
 */
function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Get hash count for a demo (across all worker files)
 */
export async function getHashCount(demoId: string): Promise<number> {
  const files = getWorkerFiles(demoId);
  if (files.length === 0) {
    const singleFile = path.join(HASHES_DIR, `${demoId}.jsonl`);
    if (fs.existsSync(singleFile)) {
      return countLinesInFile(singleFile);
    }
    return 0;
  }

  let total = 0;
  for (const file of files) {
    total += await countLinesInFile(file);
  }
  return total;
}

/**
 * Count lines in a file efficiently
 */
async function countLinesInFile(filePath: string): Promise<number> {
  if (!fs.existsSync(filePath)) {
    return 0;
  }

  let count = 0;
  const fileStream = fs.createReadStream(filePath, { encoding: 'utf8' });
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    if (line.trim()) {
      count++;
    }
  }

  return count;
}

/**
 * List all available demo IDs (handles multi-worker files)
 */
export function listDemoIds(): string[] {
  if (!fs.existsSync(HASHES_DIR)) {
    return [];
  }

  const files = fs.readdirSync(HASHES_DIR).filter(f => f.endsWith('.jsonl'));
  const demoIds = new Set<string>();

  for (const file of files) {
    // Extract demo ID from filename (handles both single and worker files)
    // e.g., "2026-01-21T12-00-00-000Z.jsonl" → "2026-01-21T12-00-00-000Z"
    // e.g., "2026-01-21T12-00-00-000Z-worker-0.jsonl" → "2026-01-21T12-00-00-000Z"
    const match = file.match(/^(.+?)(-worker-\d+)?\.jsonl$/);
    if (match) {
      demoIds.add(match[1]);
    }
  }

  return Array.from(demoIds).sort().reverse(); // Most recent first
}

/**
 * Generate a unique demo ID based on timestamp
 */
export function generateDemoId(): string {
  const now = new Date();
  return now.toISOString().replace(/[:.]/g, '-');
}

// Export directory constants for use by other modules
export { RALPHY_DIR, HASHES_DIR, STATE_DIR, ANALYTICS_DIR };
