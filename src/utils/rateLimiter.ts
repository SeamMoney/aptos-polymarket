/**
 * Simple rate limiter for Aptos testnet API calls
 * Testnet has strict rate limits - we need to queue all requests
 */

class RateLimiter {
  private queue: Array<() => Promise<void>> = [];
  private processing = false;
  private lastRequestTime = 0;
  private minDelayMs = 500; // Minimum 500ms between requests

  async schedule<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await fn();
          resolve(result);
        } catch (err) {
          reject(err);
        }
      });
      this.processQueue();
    });
  }

  private async processQueue() {
    if (this.processing || this.queue.length === 0) return;

    this.processing = true;

    while (this.queue.length > 0) {
      const now = Date.now();
      const timeSinceLastRequest = now - this.lastRequestTime;

      if (timeSinceLastRequest < this.minDelayMs) {
        await new Promise(resolve =>
          setTimeout(resolve, this.minDelayMs - timeSinceLastRequest)
        );
      }

      const task = this.queue.shift();
      if (task) {
        this.lastRequestTime = Date.now();
        try {
          await task();
        } catch (err) {
          console.error('Rate limiter task failed:', err);
        }
      }
    }

    this.processing = false;
  }

  setMinDelay(ms: number) {
    this.minDelayMs = ms;
  }
}

export const aptosRateLimiter = new RateLimiter();
