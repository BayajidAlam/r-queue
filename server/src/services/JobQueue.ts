import { v4 as uuidv4 } from "uuid";
import { Redis, Cluster } from "ioredis";
import {
  HealthCheckResult,
  Job,
  JobPriority,
  JobQueryOptions,
  JobQueueMetrics,
  JobStatus,
  QueueMetrics,
} from "../types";

export class JobQueue {
  private redis: Redis | Cluster;
  private readonly hashTag = "{jobQueue}";
  private readonly queueKey = `${this.hashTag}:queue`;
  private readonly jobsKey = `${this.hashTag}:jobs`;
  private readonly deadLetterKey = `${this.hashTag}:deadLetterQueue`;
  private readonly processingQueueKey = `${this.hashTag}:processingQueue`;
  private readonly completedQueueKey = `${this.hashTag}:completedQueue`;
  private readonly metricsHistoryKey = `${this.hashTag}:metrics:history`;
  private readonly workersKey = `${this.hashTag}:workers`;
  private readonly workerHeartbeatKey = `${this.hashTag}:worker:heartbeat`;

  constructor(redisClient: Redis | Cluster) {
    this.redis = redisClient;
    // Start recording metrics periodically
    this.startMetricsRecording();
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
    const jobKey = `${this.jobsKey}:${job.id}`;

    // Store job data
    multi.hmset(jobKey, {
      id: job.id,
      type,
      data: JSON.stringify(data),
      priority: priority.toString(),
      status: JobStatus.PENDING,
      attempts: "0",
      maxAttempts: "3",
      dependencies: JSON.stringify(dependencies),
      progress: "0",
      createdAt: job.createdAt.toISOString(),
      updatedAt: job.updatedAt.toISOString(),
    });

    // Calculate priority score using numeric values
    const priorityValues = {
      [JobPriority.HIGH]: 3,
      [JobPriority.MEDIUM]: 2,
      [JobPriority.LOW]: 1,
    };

    const now = Date.now();
    const priorityValue = priorityValues[priority] || 2; // Default to MEDIUM if invalid
    const priorityScore = now - priorityValue * 1000000;

    // Add to queue with priority score
    multi.zadd(this.queueKey, priorityScore.toString(), job.id);
    multi.sadd(`${this.hashTag}:allJobs`, job.id);

    await multi.exec();
    console.log(
      `Job ${job.id} enqueued with priority ${priority}, score ${priorityScore}`
    );

    await this.recordMetrics();
    return job.id;
  }

  // Modified updateJobStatus method to properly handle queue transitions
  async updateJobStatus(
    jobId: string,
    status: JobStatus,
    result?: any,
    error?: string
  ): Promise<void> {
    const multi = this.redis.multi();

    const updateData: Record<string, any> = {
      status,
      updatedAt: new Date().toISOString(),
    };

    if (result !== undefined) {
      updateData.result = JSON.stringify(result);
    }
    if (error !== undefined) {
      updateData.error = error;
    }

    // Update job data
    multi.hmset(`${this.jobsKey}:${jobId}`, updateData);

    // Handle queue transitions
    switch (status) {
      case JobStatus.PROCESSING:
        multi.zrem(this.queueKey, jobId);
        multi.zadd(this.processingQueueKey, Date.now(), jobId);
        break;
      case JobStatus.COMPLETED:
        multi.zrem(this.processingQueueKey, jobId);
        multi.zadd(this.completedQueueKey, Date.now(), jobId);
        break;
      case JobStatus.FAILED:
        multi.zrem(this.processingQueueKey, jobId);
        multi.zadd(this.deadLetterKey, Date.now(), jobId);
        break;
    }

    await multi.exec();
    await this.recordMetrics();
  }

  // Add a method to check if a job exists
  async jobExists(jobId: string): Promise<boolean> {
    const exists = await this.redis.exists(`${this.jobsKey}:${jobId}`);
    return exists === 1;
  }

  async dequeue(workerId: string): Promise<Job | null> {
    // Get highest priority (lowest score) job
    const jobIdResult = await this.redis.zpopmin(this.queueKey);

    if (!jobIdResult?.[0]) {
      return null;
    }

    const jobId = jobIdResult[0];
    console.log(`Attempting to dequeue job ${jobId}`);

    const multi = this.redis.multi();

    try {
      // Get job data
      const jobData = await this.redis.hgetall(`${this.jobsKey}:${jobId}`);
      if (!jobData || Object.keys(jobData).length === 0) {
        console.warn(`No data found for job ${jobId}`);
        return null;
      }

      // Parse and validate job data
      const job: Job = {
        id: jobId,
        type: jobData.type,
        data: JSON.parse(jobData.data || "{}"),
        priority: parseInt(jobData.priority) as JobPriority,
        status: JobStatus.PROCESSING,
        attempts: parseInt(jobData.attempts) || 0,
        maxAttempts: parseInt(jobData.maxAttempts) || 3,
        dependencies: JSON.parse(jobData.dependencies || "[]"),
        progress: parseInt(jobData.progress) || 0,
        createdAt: new Date(jobData.createdAt),
        updatedAt: new Date(),
      };

      // Update job status atomically
      multi.zadd(this.processingQueueKey, Date.now(), jobId);
      multi.hmset(`${this.jobsKey}:${jobId}`, {
        status: JobStatus.PROCESSING,
        workerId,
        updatedAt: new Date().toISOString(),
      });

      await multi.exec();
      console.log(`Job ${jobId} dequeued by worker ${workerId}`);

      // Force metrics update
      await this.recordMetrics();
      return job;
    } catch (error) {
      console.error(`Error dequeuing job ${jobId}:`, error);
      multi.zadd(this.queueKey, Date.now(), jobId); // Return to queue
      await multi.exec();
      return null;
    }
  }

  async retryJob(jobId: string): Promise<boolean> {
    const job = await this.getJob(jobId);
    if (!job) return false;

    const multi = this.redis.multi();

    if (job.attempts >= job.maxAttempts) {
      await this.moveToDeadLetter(jobId, "Max retry attempts exceeded");
      return false;
    }

    // Increment attempts and reset status
    multi.hincrby(`${this.jobsKey}:${jobId}`, "attempts", 1);
    multi.hset(`${this.jobsKey}:${jobId}`, {
      status: JobStatus.PENDING,
      updatedAt: new Date().toISOString(),
    });

    // Add back to queue with delay based on attempts
    const delay = Math.pow(2, job.attempts) * 1000; // Exponential backoff
    const score = Date.now() + delay;
    multi.zadd(this.queueKey, score, jobId);

    await multi.exec();
    console.log(
      `Job ${jobId} scheduled for retry (attempt ${job.attempts + 1})`
    );
    return true;
  }

  async checkHealth(): Promise<HealthCheckResult> {
    try {
      const [
        queueLength,
        processingCount,
        activeWorkers,
        redisStatus,
        metrics,
      ] = await Promise.all([
        this.getQueueLength(),
        this.getProcessingCount(),
        this.redis.smembers(this.workersKey),
        this.redis.ping(),
        this.getPerformanceMetrics(),
      ]);

      const isHealthy = redisStatus === "PONG" && activeWorkers.length > 0;
      const isDegraded =
        queueLength > 100 || processingCount === 0 || metrics.errorRate > 0.1;

      return {
        status: isHealthy ? (isDegraded ? "degraded" : "healthy") : "unhealthy",
        details: {
          redisConnected: redisStatus === "PONG",
          activeWorkers: activeWorkers.length,
          queueLength,
          processingJobs: processingCount,
          metrics: {
            avgProcessingTime: metrics.avgProcessingTime,
            errorRate: metrics.errorRate,
            throughput: metrics.throughput,
          },
        },
      };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      return {
        status: "unhealthy",
        details: {
          redisConnected: false,
          activeWorkers: 0,
          queueLength: 0,
          processingJobs: 0,
          lastError: errorMessage,
        },
      };
    }
  }

  private async getPerformanceMetrics(): Promise<{
    avgProcessingTime: number;
    errorRate: number;
    throughput: number;
  }> {
    const timeWindow = 5 * 60 * 1000; // 5 minutes
    const now = Date.now();
    const windowStart = now - timeWindow;

    const [completed, failed, total] = await Promise.all([
      this.redis.zcount(this.completedQueueKey, windowStart, "+inf"),
      this.redis.zcount(this.deadLetterKey, windowStart, "+inf"),
      this.redis.zcount(this.completedQueueKey, "-inf", "+inf"),
    ]);

    return {
      avgProcessingTime: await this.calculateAvgProcessingTime(windowStart),
      errorRate: failed / (completed + failed || 1),
      throughput: (completed + failed) / (timeWindow / 1000),
    };
  }

  private async calculateAvgProcessingTime(since: number): Promise<number> {
    const jobs = await this.redis.zrangebyscore(
      this.completedQueueKey,
      since,
      "+inf",
      "WITHSCORES"
    );

    if (jobs.length === 0) return 0;

    let totalTime = 0;
    for (let i = 0; i < jobs.length; i += 2) {
      const job = await this.getJob(jobs[i]);
      if (job) {
        totalTime +=
          new Date(job.updatedAt).getTime() - new Date(job.createdAt).getTime();
      }
    }

    return totalTime / (jobs.length / 2);
  }

  // Add new methods for worker management
  async registerWorker(workerId: string): Promise<void> {
    const multi = this.redis.multi();
    multi.sadd(this.workersKey, workerId);
    multi.hset(
      `${this.workerHeartbeatKey}:${workerId}`,
      "lastHeartbeat",
      Date.now().toString()
    );
    await multi.exec();
    console.log(`Worker registered: ${workerId}`);
  }

  async workerHeartbeat(workerId: string): Promise<void> {
    await this.redis.hset(
      `${this.workerHeartbeatKey}:${workerId}`,
      "lastHeartbeat",
      Date.now().toString()
    );
  }

  async deregisterWorker(workerId: string): Promise<void> {
    const multi = this.redis.multi();
    multi.srem(this.workersKey, workerId);
    multi.del(`${this.workerHeartbeatKey}:${workerId}`);
    await multi.exec();
    console.log(`Worker deregistered: ${workerId}`);
  }

  private async cleanupStaleWorkers(): Promise<void> {
    const workers = await this.redis.smembers(this.workersKey);
    const staleThreshold = Date.now() - 30000; // 30 seconds

    for (const workerId of workers) {
      const lastHeartbeat = await this.redis.hget(
        `${this.workerHeartbeatKey}:${workerId}`,
        "lastHeartbeat"
      );

      if (!lastHeartbeat || parseInt(lastHeartbeat) < staleThreshold) {
        await this.deregisterWorker(workerId);
      }
    }
  }

  async getJobs(
    filters: Record<string, any> = {},
    options: JobQueryOptions
  ): Promise<Job[]> {
    const allJobIds = await this.redis.smembers(`${this.hashTag}:allJobs`);

    const jobsData = await Promise.all(
      allJobIds.map((id) => this.redis.hgetall(`${this.jobsKey}:${id}`))
    );

    let jobs = jobsData
      .filter((data) => Object.keys(data).length > 0)
      .map(
        (data) =>
          ({
            id: data.id,
            type: data.type,
            data: JSON.parse(data.data || "{}"),
            priority: parseInt(data.priority),
            status: data.status,
            progress: parseInt(data.progress || "0"),
            attempts: parseInt(data.attempts || "0"),
            maxAttempts: parseInt(data.maxAttempts || "3"),
            dependencies: JSON.parse(data.dependencies || "[]"),
            createdAt: new Date(data.createdAt),
            updatedAt: new Date(data.updatedAt),
          } as Job)
      )
      .filter((job) => {
        return Object.entries(filters).every(
          ([key, value]) =>
            !value ||
            //@ts-ignore
            value === "all" ||
            //@ts-ignore
            job[key] === value
        );
      });

    // Apply sorting
    const { sortBy, sortOrder } = options;
    jobs.sort((a, b) => {
      const aVal = a[sortBy];
      const bVal = b[sortBy];
      return sortOrder === "asc"
        ? aVal > bVal
          ? 1
          : -1
        : aVal < bVal
        ? 1
        : -1;
    });

    // Apply pagination
    const { skip, limit } = options;
    return jobs.slice(skip, skip + limit);
  }

  private async moveToDeadLetter(jobId: string, error: string): Promise<void> {
    const multi = this.redis.multi();
    multi.zadd(this.deadLetterKey, Date.now(), jobId);
    multi.hset(`${this.jobsKey}:${jobId}`, {
      status: JobStatus.FAILED,
      error,
      updatedAt: new Date().toISOString(),
    });
    await multi.exec();
  }

  async updateJobProgress(jobId: string, progress: number): Promise<void> {
    if (progress < 0 || progress > 100) {
      throw new Error("Progress must be between 0 and 100");
    }
    await this.redis.hset(`${this.jobsKey}:${jobId}`, "progress", progress);
  }

  async cancelJob(jobId: string): Promise<boolean> {
    const job = await this.redis.hgetall(`${this.jobsKey}:${jobId}`);
    if (!job || job.status === JobStatus.COMPLETED) return false;

    const multi = this.redis.multi();
    multi.zrem(this.queueKey, jobId);
    multi.zrem(this.processingQueueKey, jobId);
    multi.hmset(`${this.jobsKey}:${jobId}`, {
      status: JobStatus.FAILED,
      error: "Job cancelled by user",
      updatedAt: new Date().toISOString(),
    });
    await multi.exec();
    return true;
  }

  async getJob(jobId: string): Promise<Job | null> {
    const jobData = await this.redis.hgetall(`${this.jobsKey}:${jobId}`);
    if (!jobData || Object.keys(jobData).length === 0) return null;

    try {
      return {
        id: jobData.id,
        type: jobData.type,
        data: JSON.parse(jobData.data || "{}"),
        priority: parseInt(jobData.priority) as JobPriority,
        status: jobData.status as JobStatus,
        attempts: parseInt(jobData.attempts) || 0,
        maxAttempts: parseInt(jobData.maxAttempts) || 3,
        dependencies: JSON.parse(jobData.dependencies || "[]"),
        progress: parseInt(jobData.progress) || 0,
        createdAt: new Date(jobData.createdAt),
        updatedAt: new Date(jobData.updatedAt),
      };
    } catch (error) {
      return null;
    }
  }

  async getJobsCount(filters: Record<string, any> = {}): Promise<number> {
    const [pending, processing, completed, failed] = await Promise.all([
      this.redis.zcard(this.queueKey),
      this.redis.zcard(this.processingQueueKey),
      this.redis.zcard(this.completedQueueKey),
      this.redis.zcard(this.deadLetterKey),
    ]);

    if (Object.keys(filters).length === 0) {
      return pending + processing + completed + failed;
    }

    // If filters applied, need to count matching jobs
    const jobs = await this.getJobs(filters, {
      skip: 0,
      limit: Number.MAX_SAFE_INTEGER,
      sortBy: "createdAt",
      sortOrder: "desc",
    });

    return jobs.length;
  }

  async getMetrics(): Promise<JobQueueMetrics> {
    const [
      queueLength,
      processingJobs,
      completedJobs,
      failedJobs,
      workers,
      history,
    ] = await Promise.all([
      this.getQueueLength(),
      this.getProcessingCount(),
      this.getCompletedCount(),
      this.getFailedCount(),
      this.redis.smembers(`${this.hashTag}:workers:active`),
      this.redis.zrange(
        `${this.hashTag}:metrics:history`,
        -288,
        -1,
        "WITHSCORES"
      ),
    ]);

    return {
      queueLength,
      processingJobs,
      completedJobs,
      failedJobs,
      workers,
      history: this.formatMetricsHistory(history),
    };
  }

  async getJobStatus(jobId: string): Promise<JobStatus | null> {
    const jobData = await this.redis.hgetall(`${this.jobsKey}:${jobId}`);
    if (!jobData || Object.keys(jobData).length === 0) {
      return null;
    }
    return jobData.status as JobStatus;
  }

  private formatMetricsHistory(
    rawHistory: string[]
  ): JobQueueMetrics["history"] {
    const history: JobQueueMetrics["history"] = [];

    for (let i = 0; i < rawHistory.length; i += 2) {
      try {
        const data = JSON.parse(rawHistory[i]);
        history.push({
          timestamp: new Date(parseInt(rawHistory[i + 1])).toISOString(),
          queueLength: data.queueLength,
          processingJobs: data.processingJobs,
        });
      } catch (error) {
        console.error("Error parsing metrics history:", error);
      }
    }

    return history;
  }

  async getWorkerStatus(): Promise<Record<string, any>> {
    const status = await this.redis.hgetall(`${this.hashTag}:workers`);
    return status || {};
  }

  public async recordMetrics(): Promise<void> {
    try {
      // Get all queue states atomically
      const pipeline = this.redis.pipeline();
      pipeline.zcard(this.queueKey);
      pipeline.zcard(this.processingQueueKey);
      pipeline.zcard(this.completedQueueKey);
      pipeline.zcard(this.deadLetterKey);
      pipeline.smembers(this.workersKey);

      const results = await pipeline.exec();

      if (!results) {
        console.error("Pipeline execution failed");
        return;
      }

      // Extract results with proper error handling
      const [
        [queueErr, queueCount],
        [processErr, processCount],
        [completedErr, completedCount],
        [failedErr, failedCount],
        [workersErr, workersList],
      ] = results;

      // Validate results
      if (queueErr || processErr || completedErr || failedErr || workersErr) {
        throw new Error("Error fetching metrics");
      }

      const metrics: QueueMetrics = {
        queueLength: Number(queueCount) || 0,
        processingJobs: Number(processCount) || 0,
        completedJobs: Number(completedCount) || 0,
        failedJobs: Number(failedCount) || 0,
        workers: Array.isArray(workersList) ? workersList : [],
        timestamp: Date.now(),
      };

      console.log("Current queue metrics:", JSON.stringify(metrics, null, 2));

      // Store metrics history
      await this.redis
        .multi()
        .zadd(
          this.metricsHistoryKey,
          metrics.timestamp,
          JSON.stringify(metrics)
        )
        .zremrangebyrank(this.metricsHistoryKey, 0, -289)
        .exec();
    } catch (error) {
      console.error(
        "Failed to record metrics:",
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  private startMetricsRecording(): void {
    console.log("Initializing metrics recording...");

    // Record initial metrics
    this.recordMetrics().catch((err) =>
      console.error("Initial metrics recording failed:", err)
    );

    setInterval(() => {
      Promise.all([this.recordMetrics(), this.cleanupStaleWorkers()]).catch(
        (err) => console.error("Metrics/cleanup error:", err)
      );
    }, 5000);
  }

  async getQueueLength(): Promise<number> {
    const count = await this.redis.zcard(this.queueKey);
    console.log("Queue length:", count); // Debug log
    return count;
  }

  async getProcessingCount(): Promise<number> {
    const count = await this.redis.zcard(this.processingQueueKey);
    console.log("Processing count:", count); // Debug log
    return count;
  }

  async getCompletedCount(): Promise<number> {
    const count = await this.redis.zcard(this.completedQueueKey);
    console.log("Completed count:", count); // Debug log
    return count;
  }

  private async getFailedCount(): Promise<number> {
    const count = await this.redis.zcard(this.deadLetterKey);
    console.log("Failed count:", count); // Debug log
    return count;
  }
}
