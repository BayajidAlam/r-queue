import express from "express";
import cors from "cors";
import { router as jobRoutes } from "./jobs";
import metricsRoutes from "./metrics";
import healthRoutes from "./health";
import dotenv from "dotenv";
import { createRedisClient } from "../../config/redis";
import { Worker } from "../../workers/Worker";
import { JobQueue } from "../../services/JobQueue";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  const start = Date.now();
  const formatTime = (date: Date) => date.toTimeString().split(" ")[0];
  console.log(`[${formatTime(new Date())}] ${req.method} ${req.url}`);

  res.on("finish", () => {
    const duration = Date.now() - start;
    console.log(
      `[${formatTime(new Date())}] ${req.method} ${req.url} - ${
        res.statusCode
      } - ${duration}ms`
    );
  });

  next();
});

app.use("/api", jobRoutes);
app.use("/api", metricsRoutes);
app.use("/api", healthRoutes());

// Initialize and start the worker
const redisClient = createRedisClient();
const jobQueue = new JobQueue(redisClient);
const worker = new Worker(jobQueue);

worker.on("start", () => console.log("Worker has started."));
worker.on("stop", () => console.log("Worker has stopped."));
worker.on("job-start", (job) => console.log(`Job started: ${job.id}`));
worker.on("job-complete", (job) => console.log(`Job completed: ${job.id}`));
worker.on("job-fail", (job, error) =>
  console.log(`Job failed: ${job.id}, Error: ${error.message}`)
);

worker.start();

const PORT = process.env.PORT || 5000;

// Add shutdown handler
process.on("SIGTERM", async () => {
  console.log("Received SIGTERM. Starting graceful shutdown...");
  await worker.shutdown();
  process.exit(0);
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
