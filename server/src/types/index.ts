export enum JobStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

export enum JobPriority {
  LOW = 0,
  MEDIUM = 1,
  HIGH = 2
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