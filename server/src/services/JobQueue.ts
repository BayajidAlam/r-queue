import { v4 as uuidv4 } from "uuid";
import { Redis } from "ioredis";
import { Job, JobPriority, JobStatus } from "../types";

export class JobQueue {
  private redis: Redis;
  private readonly queueKey = "jobQueue";
  private readonly jobsKey = "jobs";
  private readonly deadLetterKey = "deadLetterQueue";

  constructor(redisClient: Redis) {
    this.redis = redisClient;
  }

  async enqueue(
    type: string,
    data: any,
    priority: JobPriority = JobPriority.MEDIUM,
    dependencies: string[] = []
  ): Promise<string> {
    const job: Job = {
      id: uuidv4(),
      type,
      data,
      priority,
      status: JobStatus.PENDING,
      attempts: 0,
      maxAttempts: 3,
      dependencies,
      progress: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const multi = this.redis.multi();
    multi.hset(`${this.jobsKey}:${job.id}`, job);

    // Only add to queue if no dependencies or all dependencies are completed
    if (dependencies.length === 0) {
      multi.zadd(this.queueKey, priority, job.id);
    }

    await multi.exec();
    return job.id;
  }

  async dequeue(): Promise<Job | null> {
    const jobId = await this.redis.zpopmax(this.queueKey);
    if (!jobId) return null;

    const job = await this.redis.hgetall(`${this.jobsKey}:${jobId}`);
    if (!job) return null;

    await this.updateJobStatus(job.id, JobStatus.PROCESSING);
    return job as Job;
  }

  async updateJobStatus(
    jobId: string,
    status: JobStatus,
    result?: any,
    error?: string
  ): Promise<void> {
    const multi = this.redis.multi();

    multi.hset(`${this.jobsKey}:${jobId}`, {
      status,
      updatedAt: new Date(),
      ...(result && { result }),
      ...(error && { error }),
    });

    if (status === JobStatus.FAILED) {
      const job = await this.redis.hgetall(`${this.jobsKey}:${jobId}`);
      if (job.attempts >= job.maxAttempts) {
        multi.zadd(this.deadLetterKey, Date.now(), jobId);
      } else {
        multi.zadd(this.queueKey, job.priority, jobId);
        multi.hincrby(`${this.jobsKey}:${jobId}`, "attempts", 1);
      }
    }

    if (status === JobStatus.COMPLETED) {
      // Check for dependent jobs and queue them if all dependencies are met
      const dependentJobs = await this.redis.smembers(`dependents:${jobId}`);
      for (const depJobId of dependentJobs) {
        const depJob = await this.redis.hgetall(`${this.jobsKey}:${depJobId}`);
        const deps = JSON.parse(depJob.dependencies || "[]");
        const allCompleted = await this.checkDependenciesCompleted(deps);
        if (allCompleted) {
          multi.zadd(this.queueKey, depJob.priority, depJobId);
        }
      }
    }

    await multi.exec();
  }

  private async checkDependenciesCompleted(
    dependencies: string[]
  ): Promise<boolean> {
    for (const depId of dependencies) {
      const job = await this.redis.hgetall(`${this.jobsKey}:${depId}`);
      if (job.status !== JobStatus.COMPLETED) {
        return false;
      }
    }
    return true;
  }

  async updateJobProgress(jobId: string, progress: number): Promise<void> {
    await this.redis.hset(`${this.jobsKey}:${jobId}`, "progress", progress);
  }

  async cancelJob(jobId: string): Promise<boolean> {
    const job = await this.redis.hgetall(`${this.jobsKey}:${jobId}`);
    if (!job || job.status === JobStatus.COMPLETED) return false;

    const multi = this.redis.multi();
    multi.zrem(this.queueKey, jobId);
    multi.hset(`${this.jobsKey}:${jobId}`, {
      status: JobStatus.FAILED,
      error: "Job cancelled by user",
      updatedAt: new Date(),
    });
    await multi.exec();
    return true;
  }
}
