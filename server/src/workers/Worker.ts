import { Job, JobStatus } from "../types";
import { JobQueue } from "../services/JobQueue";
import { EventEmitter } from "events";
import { v4 as uuidv4 } from "uuid";
import { CircuitBreaker } from "../utils/CircuitBreaker";

export class Worker extends EventEmitter {
    private queue: JobQueue;
    private circuitBreaker: CircuitBreaker;
    private isRunning: boolean = false;
    private currentJob?: Job;
    private workerId: string;
    private heartbeatInterval?: NodeJS.Timeout;
    private scalingInterval?: NodeJS.Timeout;
    private scalingLock: boolean = false;

    private static workers: Map<string, Worker> = new Map();
    private static readonly MIN_WORKERS = 1;
    private static readonly MAX_WORKERS = 10;
    private static readonly SCALE_UP_THRESHOLD = 1;
    private static readonly SCALE_DOWN_THRESHOLD = 0.3;
    private static readonly SCALE_CHECK_INTERVAL = 5000;
    private static readonly JOB_TIMEOUT = 30000;
    private static readonly RETRY_DELAY = 1000;
    private static readonly HEARTBEAT_INTERVAL = 5000;

    constructor(queue: JobQueue) {
        super();
        this.queue = queue;
        this.workerId = uuidv4();
        this.circuitBreaker = new CircuitBreaker();
    }

    async start(): Promise<void> {
        try {
            if (Worker.workers.size >= Worker.MAX_WORKERS) {
                console.warn(`Maximum worker limit reached (${Worker.MAX_WORKERS})`);
                return;
            }

            console.log(`Starting worker ${this.workerId}`);
            this.isRunning = true;
            await Worker.addWorker(this);

            await this.queue.registerWorker(this.workerId);
            this.startHeartbeat();
            this.startScalingCheck();

            while (this.isRunning) {
                try {
                    console.log(`Worker ${this.workerId} polling for jobs...`);
                    const job = await this.queue.dequeue(this.workerId);

                    if (job) {
                        this.currentJob = job;
                        this.emit("job-start", job);
                        await this.processJob(job);
                        this.currentJob = undefined;
                        await this.queue.recordMetrics();
                    } else {
                        await new Promise(resolve => setTimeout(resolve, Worker.RETRY_DELAY / 2));
                    }
                } catch (error) {
                    console.error(`Processing error (Worker ${this.workerId}):`, error);
                    if (this.currentJob) {
                        await this.handleJobError(this.currentJob, error as Error);
                    }
                    await new Promise(resolve => setTimeout(resolve, Worker.RETRY_DELAY));
                }
            }
        } catch (error) {
            console.error(`Worker startup error (${this.workerId}):`, error);
            await this.stop();
        }
    }

    private static async addWorker(worker: Worker): Promise<void> {
        if (Worker.workers.size >= Worker.MAX_WORKERS) return;
        Worker.workers.set(worker.workerId, worker);
    }

    private static async removeWorker(workerId: string): Promise<void> {
        const worker = Worker.workers.get(workerId);
        if (worker) {
            await worker.shutdown();
            Worker.workers.delete(workerId);
        }
    }

    private async checkScaling(): Promise<void> {
        if (this.scalingLock) return;

        try {
            this.scalingLock = true;
            const metrics = await this.queue.getMetrics();
            const workerCount = Worker.workers.size;
            const totalJobs = metrics.queueLength + metrics.processingJobs;
            const jobsPerWorker = totalJobs / workerCount;

            console.log(
                `Scaling check - Workers: ${workerCount}, Total jobs: ${totalJobs}, Jobs/worker: ${jobsPerWorker.toFixed(1)}`
            );

            // Scale up logic
            if (jobsPerWorker > Worker.SCALE_UP_THRESHOLD && workerCount < Worker.MAX_WORKERS) {
                const newWorker = new Worker(this.queue);
                await newWorker.start();
                console.log(`Scaled up: New worker ${newWorker.workerId}, total workers: ${Worker.workers.size}`);
                
                // Wait for worker to stabilize
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            // Scale down logic
            if (jobsPerWorker < Worker.SCALE_DOWN_THRESHOLD && 
                workerCount > Worker.MIN_WORKERS && 
                metrics.queueLength === 0) {
                
                const idleWorker = Array.from(Worker.workers.values()).find(
                    w => !w.currentJob && w.workerId !== this.workerId
                );

                if (idleWorker) {
                    await Worker.removeWorker(idleWorker.workerId);
                    console.log(`Scaled down: Removed worker ${idleWorker.workerId}`);
                }
            }
        } catch (error) {
            console.error(`Scaling check failed (Worker ${this.workerId}):`, error);
        } finally {
            this.scalingLock = false;
        }
    }

    private async processJob(job: Job): Promise<void> {
        console.log(`Processing job ${job.id} (priority: ${job.priority})`);
        let progressInterval: NodeJS.Timeout | null = null;

        try {
            // Validate job
            if (!job.id || !job.type) {
                throw new Error("Invalid job format");
            }

            // Update initial status with circuit breaker
            await this.circuitBreaker.execute(async () => {
                await this.queue.updateJobStatus(job.id, JobStatus.PROCESSING);
            });

            // Initialize progress tracking
            let progress = 0;
            progressInterval = setInterval(async () => {
                try {
                    if (progress < 90) {
                        progress += 10;
                        await this.queue.updateJobProgress(job.id, progress);
                    }
                } catch (error) {
                    console.error(`Progress update failed for job ${job.id}:`, error);
                }
            }, 1000);

            // Handle dependencies
            if (Array.isArray(job.dependencies) && job.dependencies.length > 0) {
                await Promise.race([
                    this.waitForDependencies(job.dependencies),
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error("Dependencies timeout")), Worker.JOB_TIMEOUT)
                    ),
                ]);
            }

            // Process job with bounded time
            const processingTime = typeof job.data?.processingTime === 'number' 
                ? Math.max(1, Math.min(job.data.processingTime, 30)) 
                : 5;

            await new Promise(resolve => setTimeout(resolve, processingTime * 1000));

            // Cleanup progress tracking
            if (progressInterval) {
                clearInterval(progressInterval);
                progressInterval = null;
            }

            // Handle configured failures
            if (job.data?.shouldFail) {
                throw new Error("Job configured to fail");
            }

            // Update final status with retry
            await this.retryOperation(async () => {
                await this.queue.updateJobProgress(job.id, 100);
                await this.queue.updateJobStatus(job.id, JobStatus.COMPLETED, {
                    completedAt: new Date().toISOString(),
                    workerId: this.workerId,
                });
            }, 3);

            this.emit("job-complete", job);
        } catch (error) {
            if (progressInterval) {
                clearInterval(progressInterval);
            }

            const errorMessage = error instanceof Error ? error.message : "Unknown error";
            console.error(`Job ${job.id} failed:`, errorMessage);

            if (job.attempts < job.maxAttempts) {
                await this.queue.retryJob(job.id);
            } else {
                await this.handleJobError(job, error as Error);
            }
        }
    }

    private async retryOperation(
        operation: () => Promise<void>,
        maxRetries: number
    ): Promise<void> {
        let attempts = 0;
        while (attempts < maxRetries) {
            try {
                await operation();
                return;
            } catch (error) {
                attempts++;
                if (attempts === maxRetries) throw error;
                await new Promise(resolve => 
                    setTimeout(resolve, Worker.RETRY_DELAY * attempts)
                );
            }
        }
    }

    private async waitForDependencies(dependencies: string[]): Promise<void> {
        await Promise.all(
            dependencies.map(async (depId) => {
                let status: JobStatus | null;
                do {
                    status = await this.queue.getJobStatus(depId);
                    if (status !== JobStatus.COMPLETED) {
                        await new Promise(resolve => 
                            setTimeout(resolve, Worker.RETRY_DELAY)
                        );
                    }
                } while (
                    status &&
                    status !== JobStatus.COMPLETED &&
                    status !== JobStatus.FAILED
                );

                if (status === JobStatus.FAILED) {
                    throw new Error(`Dependency failed: ${depId}`);
                }
            })
        );
    }

    private startHeartbeat(): void {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
        }

        this.heartbeatInterval = setInterval(async () => {
            try {
                await this.queue.workerHeartbeat(this.workerId);
            } catch (error) {
                console.error(`Heartbeat failed (Worker ${this.workerId}):`, error);
            }
        }, Worker.HEARTBEAT_INTERVAL);
    }

    private startScalingCheck(): void {
        if (this.scalingInterval) {
            clearInterval(this.scalingInterval);
        }

        this.scalingInterval = setInterval(async () => {
            await this.checkScaling();
        }, Worker.SCALE_CHECK_INTERVAL);
    }

    private async handleJobError(job: Job, error: Error): Promise<void> {
        console.error(`Job failed ${job.id} (Worker ${this.workerId}):`, error);
        await this.queue.updateJobStatus(
            job.id,
            JobStatus.FAILED,
            undefined,
            error.message
        );
        this.emit("job-failed", job, error);
    }

    async stop(): Promise<void> {
        console.log(`Stopping worker ${this.workerId}`);
        this.isRunning = false;

        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = undefined;
        }

        if (this.scalingInterval) {
            clearInterval(this.scalingInterval);
            this.scalingInterval = undefined;
        }

        try {
            await this.queue.deregisterWorker(this.workerId);
            Worker.workers.delete(this.workerId);
        } catch (error) {
            console.error(`Failed to stop worker ${this.workerId}:`, error);
        }
    }

    async shutdown(): Promise<void> {
        console.log(`Initiating graceful shutdown for worker ${this.workerId}`);
        this.isRunning = false;

        if (this.currentJob) {
            await this.queue.retryJob(this.currentJob.id);
        }

        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
        }

        if (this.scalingInterval) {
            clearInterval(this.scalingInterval);
        }

        await this.queue.deregisterWorker(this.workerId);
        Worker.workers.delete(this.workerId);

        this.emit("shutdown");
        console.log(`Worker ${this.workerId} shutdown complete`);
    }

    static getWorkerCount(): number {
        return Worker.workers.size;
    }

    static getWorkerIds(): string[] {
        return Array.from(Worker.workers.keys());
    }

    // Expose workers map for testing
    static get activeWorkers(): Map<string, Worker> {
        return Worker.workers;
    }
}