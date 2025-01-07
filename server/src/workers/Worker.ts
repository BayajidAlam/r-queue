import { Job, JobStatus } from '../types';
import { JobQueue } from '../services/JobQueue';
import { EventEmitter } from 'events';

export class Worker extends EventEmitter {
  private queue: JobQueue;
  private isRunning: boolean = false;
  private currentJob?: Job;

  constructor(queue: JobQueue) {
    super();
    this.queue = queue;
  }

  async start(): Promise<void> {
    this.isRunning = true;
    while (this.isRunning) {
      try {
        const job = await this.queue.dequeue();
        if (!job) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          continue;
        }

        this.currentJob = job;
        await this.processJob(job);
      } catch (error) {
        console.error('Worker error:', error);
        if (this.currentJob) {
          await this.queue.updateJobStatus(
            this.currentJob.id,
            JobStatus.FAILED,
            undefined,
            error.message
          );
        }
      }
    }
  }

  async stop(): Promise<void> {
    this.isRunning = false;
  }

  private async processJob(job: Job): Promise<void> {
    try {
      // Implement job type specific processing logic here
      const result = await this.executeJob(job);
      await this.queue.updateJobStatus(job.id, JobStatus.COMPLETED, result);
    } catch (error) {
      await this.queue.updateJobStatus(job.id, JobStatus.FAILED, undefined, error.message);
      throw error;
    }
  }

  private async executeJob(job: Job): Promise<any> {
    // This should be overridden or configured with actual job processing logic
    throw new Error('Job execution not implemented');
  }
}