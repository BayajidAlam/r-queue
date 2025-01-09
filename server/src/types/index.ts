export enum JobStatus {
  PENDING = "pending",
  PROCESSING = "processing",
  COMPLETED = "completed",
  FAILED = "failed",
}

export enum JobPriority {
  LOW = 1,
  MEDIUM = 2,
  HIGH = 3,
}

export interface Job {
  id: string;
  type: string;
  data: any;
  priority: JobPriority;
  status: JobStatus;
  attempts: number;
  maxAttempts: number;
  result?: any;
  error?: string;
  dependencies?: string[];
  progress?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface JobQueueMetrics {
  queueLength: number;
  processingJobs: number;
  completedJobs: number;
  failedJobs: number;
  workers: string[];
  history: Array<{
    timestamp: string;
    queueLength: number;
    processingJobs: number;
  }>;
}

export interface JobQueryOptions {
  skip: number;
  limit: number;
  sortBy: keyof Job;
  sortOrder: "asc" | "desc";
}

export interface HealthCheckResult {
  status: "healthy" | "degraded" | "unhealthy";
  details: {
    redisConnected: boolean;
    activeWorkers: number;
    queueLength: number;
    processingJobs: number;
    lastError?: string;
    metrics?: {
      avgProcessingTime: number;
      errorRate: number;
      throughput: number;
    };
  };
}

export interface QueueMetrics {
  queueLength: number;
  processingJobs: number;
  completedJobs: number;
  failedJobs: number;
  workers: string[];
  timestamp: number;
}
