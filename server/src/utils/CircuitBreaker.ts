export class CircuitBreaker {
  private failures = 0;
  private lastFailure?: Date;
  private readonly maxFailures: number;
  private readonly resetTimeout: number;

  constructor(maxFailures = 3, resetTimeout = 30000) {
    this.maxFailures = maxFailures;
    this.resetTimeout = resetTimeout;
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.isOpen()) {
      throw new Error('Circuit breaker is open');
    }

    try {
      const result = await operation();
      this.reset();
      return result;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }

  private isOpen(): boolean {
    if (!this.lastFailure) return false;
    return this.failures >= this.maxFailures && 
           (Date.now() - this.lastFailure.getTime() <= this.resetTimeout);
  }

  private recordFailure(): void {
    this.failures++;
    this.lastFailure = new Date();
  }

  private reset(): void {
    this.failures = 0;
    this.lastFailure = undefined;
  }
}