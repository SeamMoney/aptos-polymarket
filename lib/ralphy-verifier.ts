/**
 * Ralphy Verifier - Multi-pass verification loop with retry logic
 *
 * Implements the "Ralphy loop" pattern: keep verifying transaction hashes
 * until ALL have a final status (confirmed, failed, or dropped). Uses
 * exponential backoff between passes and persists state for resume capability.
 */

import fs from 'fs';
import path from 'path';
import { Aptos, AptosConfig, Network } from '@aptos-labs/ts-sdk';
import {
  TransactionRecord,
  VerificationResult,
  VerifiedRecord,
  loadHashesFromFile,
  STATE_DIR,
} from './ralphy-collector';

/**
 * Verification configuration
 */
export interface VerifyConfig {
  maxAttempts: number;            // Max verification passes (default: 5)
  initialBackoffMs: number;       // Initial delay between passes (default: 5000)
  backoffMultiplier: number;      // Backoff multiplier (default: 2)
  maxBackoffMs: number;           // Max delay between passes (default: 30000)
  batchSize: number;              // Hashes per API call (default: 50)
  concurrency: number;            // Parallel verifications (default: 10)
  network: 'mainnet' | 'testnet';
  rpcEndpoint?: string;           // Custom RPC endpoint
}

const DEFAULT_CONFIG: VerifyConfig = {
  maxAttempts: 5,
  initialBackoffMs: 5000,
  backoffMultiplier: 2,
  maxBackoffMs: 30000,
  batchSize: 50,
  concurrency: 10,
  network: 'testnet',
};

/**
 * Per-hash verification status tracking
 */
export interface HashStatus {
  hash: string;
  record: TransactionRecord;
  status: 'pending' | 'confirmed' | 'failed' | 'dropped' | 'unknown';
  onChainTimestamp?: number;      // Microseconds from chain
  gasUsed?: number;
  vmStatus?: string;
  verifiedAt?: number;            // When verified (ms)
  attempt?: number;               // Which pass resolved this
  error?: string;                 // API error if unknown
}

/**
 * Verification state (persisted to disk)
 */
export interface VerificationState {
  demoId: string;
  totalHashes: number;
  currentAttempt: number;
  startedAt: number;
  lastUpdatedAt: number;

  // Final states (immutable once set)
  confirmed: number;
  failed: number;
  dropped: number;

  // Transient states
  pending: number;
  unknown: number;

  // Progress tracking
  hashStatuses: Record<string, HashStatus>;

  // Quality gate
  qualityGatePassed: boolean;
}

/**
 * Verification result summary
 */
export interface VerificationSummary {
  totalHashes: number;
  confirmed: number;
  failed: number;
  dropped: number;
  pending: number;
  unknown: number;
  passes: number;
  qualityGatePassed: boolean;
  durationMs: number;
}

/**
 * Progress callback for UI updates
 */
export type ProgressCallback = (
  pass: number,
  maxPasses: number,
  processed: number,
  total: number,
  stats: { confirmed: number; failed: number; pending: number; unknown: number }
) => void;

/**
 * Ralphy Verifier - Multi-pass verification loop
 */
export class RalphyVerifier {
  private config: VerifyConfig;
  private aptos: Aptos;
  private state: VerificationState | null = null;
  private stateFile: string = '';
  private onProgress: ProgressCallback | null = null;

  constructor(config: Partial<VerifyConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Initialize Aptos client
    const rpcEndpoint = this.config.rpcEndpoint || (
      this.config.network === 'mainnet'
        ? 'https://fullnode.mainnet.aptoslabs.com/v1'
        : 'https://api.testnet.aptoslabs.com/v1'
    );

    this.aptos = new Aptos(new AptosConfig({
      network: this.config.network === 'mainnet' ? Network.MAINNET : Network.TESTNET,
      fullnode: rpcEndpoint,
    }));
  }

  /**
   * Set progress callback
   */
  setProgressCallback(callback: ProgressCallback): void {
    this.onProgress = callback;
  }

  /**
   * Initialize verification for a demo
   */
  async init(demoId: string): Promise<void> {
    // Load hashes from collector file
    const hashes = await loadHashesFromFile(demoId);

    if (hashes.length === 0) {
      throw new Error(`No hashes found for demo: ${demoId}`);
    }

    // Initialize state
    this.stateFile = path.join(STATE_DIR, `${demoId}.json`);

    // Check for existing state (resume)
    if (fs.existsSync(this.stateFile)) {
      this.state = JSON.parse(fs.readFileSync(this.stateFile, 'utf8'));
      return;
    }

    // Create new state
    const hashStatuses: Record<string, HashStatus> = {};
    for (const record of hashes) {
      hashStatuses[record.hash] = {
        hash: record.hash,
        record,
        status: 'pending',
      };
    }

    this.state = {
      demoId,
      totalHashes: hashes.length,
      currentAttempt: 0,
      startedAt: Date.now(),
      lastUpdatedAt: Date.now(),
      confirmed: 0,
      failed: 0,
      dropped: 0,
      pending: hashes.length,
      unknown: 0,
      hashStatuses,
      qualityGatePassed: false,
    };

    // Persist initial state
    this.saveState();
  }

  /**
   * Resume from persisted state
   */
  async resume(demoId: string): Promise<void> {
    this.stateFile = path.join(STATE_DIR, `${demoId}.json`);

    if (!fs.existsSync(this.stateFile)) {
      throw new Error(`No state file found for demo: ${demoId}`);
    }

    this.state = JSON.parse(fs.readFileSync(this.stateFile, 'utf8'));
  }

  /**
   * Save state to disk
   */
  private saveState(): void {
    if (!this.state) return;

    this.state.lastUpdatedAt = Date.now();

    // Ensure directory exists
    if (!fs.existsSync(STATE_DIR)) {
      fs.mkdirSync(STATE_DIR, { recursive: true });
    }

    fs.writeFileSync(this.stateFile, JSON.stringify(this.state, null, 2));
  }

  /**
   * Run verification loop until complete or maxAttempts
   */
  async runLoop(): Promise<VerificationSummary> {
    if (!this.state) {
      throw new Error('Verifier not initialized. Call init() first.');
    }

    const startTime = Date.now();

    while (this.state.currentAttempt < this.config.maxAttempts) {
      this.state.currentAttempt++;

      // Get unresolved hashes
      const unresolved = this.getUnresolvedHashes();

      if (unresolved.length === 0) {
        // All resolved!
        this.state.qualityGatePassed = true;
        this.saveState();
        break;
      }

      // Calculate backoff for this pass
      const backoffMs = Math.min(
        this.config.initialBackoffMs * Math.pow(this.config.backoffMultiplier, this.state.currentAttempt - 1),
        this.config.maxBackoffMs
      );

      // If not first pass, wait before retrying
      if (this.state.currentAttempt > 1) {
        await this.sleep(backoffMs);
      }

      // Verify unresolved hashes
      await this.verifyBatch(unresolved, this.state.currentAttempt);

      // Update counts
      this.updateCounts();

      // Save state after each pass
      this.saveState();
    }

    // If we've exhausted attempts, mark remaining pending as dropped
    const stillUnresolved = this.getUnresolvedHashes();
    if (stillUnresolved.length > 0) {
      for (const hs of stillUnresolved) {
        hs.status = 'dropped';
        hs.attempt = this.state.currentAttempt;
        hs.verifiedAt = Date.now();
      }
      this.updateCounts();
      this.state.qualityGatePassed = true; // All are now resolved (some as dropped)
      this.saveState();
    }

    return {
      totalHashes: this.state.totalHashes,
      confirmed: this.state.confirmed,
      failed: this.state.failed,
      dropped: this.state.dropped,
      pending: this.state.pending,
      unknown: this.state.unknown,
      passes: this.state.currentAttempt,
      qualityGatePassed: this.state.qualityGatePassed,
      durationMs: Date.now() - startTime,
    };
  }

  /**
   * Get hashes that still need verification
   */
  private getUnresolvedHashes(): HashStatus[] {
    if (!this.state) return [];

    return Object.values(this.state.hashStatuses).filter(
      hs => hs.status === 'pending' || hs.status === 'unknown'
    );
  }

  /**
   * Verify a batch of hashes
   */
  private async verifyBatch(hashes: HashStatus[], attempt: number): Promise<void> {
    const total = hashes.length;
    let processed = 0;

    // Process in batches with concurrency
    for (let i = 0; i < hashes.length; i += this.config.batchSize) {
      const batch = hashes.slice(i, Math.min(i + this.config.batchSize, hashes.length));

      // Verify batch with concurrency limit
      const results = await this.verifyWithConcurrency(batch, this.config.concurrency);

      // Update statuses
      for (const result of results) {
        const hs = this.state!.hashStatuses[result.hash];
        if (hs) {
          hs.status = result.status;
          hs.onChainTimestamp = result.onChainTimestamp;
          hs.gasUsed = result.gasUsed;
          hs.vmStatus = result.vmStatus;
          hs.verifiedAt = Date.now();
          hs.attempt = attempt;
          hs.error = result.error;
        }
      }

      processed += batch.length;

      // Update counts and report progress
      this.updateCounts();

      if (this.onProgress) {
        this.onProgress(
          attempt,
          this.config.maxAttempts,
          processed,
          total,
          {
            confirmed: this.state!.confirmed,
            failed: this.state!.failed,
            pending: this.state!.pending,
            unknown: this.state!.unknown,
          }
        );
      }
    }
  }

  /**
   * Verify hashes with concurrency limit
   */
  private async verifyWithConcurrency(
    hashes: HashStatus[],
    concurrency: number
  ): Promise<Array<{
    hash: string;
    status: 'confirmed' | 'failed' | 'pending' | 'unknown';
    onChainTimestamp?: number;
    gasUsed?: number;
    vmStatus?: string;
    error?: string;
  }>> {
    const results: Array<{
      hash: string;
      status: 'confirmed' | 'failed' | 'pending' | 'unknown';
      onChainTimestamp?: number;
      gasUsed?: number;
      vmStatus?: string;
      error?: string;
    }> = [];

    // Process in chunks of concurrency
    for (let i = 0; i < hashes.length; i += concurrency) {
      const chunk = hashes.slice(i, Math.min(i + concurrency, hashes.length));

      const chunkResults = await Promise.all(
        chunk.map(async (hs) => {
          try {
            const txn = await this.aptos.getTransactionByHash({ transactionHash: hs.hash });
            const txnAny = txn as any;

            if (txnAny.type === 'pending_transaction') {
              return { hash: hs.hash, status: 'pending' as const };
            }

            if (txnAny.success === true) {
              return {
                hash: hs.hash,
                status: 'confirmed' as const,
                onChainTimestamp: parseInt(txnAny.timestamp || '0', 10),
                gasUsed: parseInt(txnAny.gas_used || '0', 10),
              };
            } else {
              return {
                hash: hs.hash,
                status: 'failed' as const,
                onChainTimestamp: parseInt(txnAny.timestamp || '0', 10),
                gasUsed: parseInt(txnAny.gas_used || '0', 10),
                vmStatus: txnAny.vm_status,
              };
            }
          } catch (err: any) {
            // Transaction not found or API error
            if (err.message?.includes('not found') || err.message?.includes('404')) {
              // Not found - could be dropped, will retry
              return { hash: hs.hash, status: 'unknown' as const, error: 'not_found' };
            }
            return { hash: hs.hash, status: 'unknown' as const, error: err.message };
          }
        })
      );

      results.push(...chunkResults);
    }

    return results;
  }

  /**
   * Update state counts from hash statuses
   */
  private updateCounts(): void {
    if (!this.state) return;

    let confirmed = 0;
    let failed = 0;
    let dropped = 0;
    let pending = 0;
    let unknown = 0;

    for (const hs of Object.values(this.state.hashStatuses)) {
      switch (hs.status) {
        case 'confirmed': confirmed++; break;
        case 'failed': failed++; break;
        case 'dropped': dropped++; break;
        case 'pending': pending++; break;
        case 'unknown': unknown++; break;
      }
    }

    this.state.confirmed = confirmed;
    this.state.failed = failed;
    this.state.dropped = dropped;
    this.state.pending = pending;
    this.state.unknown = unknown;
  }

  /**
   * Get current state
   */
  getState(): VerificationState | null {
    return this.state;
  }

  /**
   * Get all verified records
   */
  getVerifiedRecords(): VerifiedRecord[] {
    if (!this.state) return [];

    return Object.values(this.state.hashStatuses).map(hs => ({
      ...hs.record,
      verification: {
        status: hs.status,
        onChainTimestamp: hs.onChainTimestamp,
        gasUsed: hs.gasUsed,
        vmStatus: hs.vmStatus,
        verifiedAt: hs.verifiedAt || Date.now(),
        attempt: hs.attempt || 0,
      },
    }));
  }

  /**
   * Get confirmed records only
   */
  getConfirmedRecords(): VerifiedRecord[] {
    return this.getVerifiedRecords().filter(r => r.verification?.status === 'confirmed');
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Load verification state from file
 */
export function loadVerificationState(demoId: string): VerificationState | null {
  const stateFile = path.join(STATE_DIR, `${demoId}.json`);

  if (!fs.existsSync(stateFile)) {
    return null;
  }

  return JSON.parse(fs.readFileSync(stateFile, 'utf8'));
}

/**
 * Check if verification is complete for a demo
 */
export function isVerificationComplete(demoId: string): boolean {
  const state = loadVerificationState(demoId);
  return state?.qualityGatePassed || false;
}
