import express from "express";
import { JobQueue } from "../../services/JobQueue";
import { createRedisClient } from "../../config/redis";

const router = express.Router();
const queue = new JobQueue(createRedisClient());

export default function createHealthRouter() {
  router.get("/health", async (req, res) => {
    try {
      const health = await queue.checkHealth();
      const status =
        health.status === "healthy"
          ? 200
          : health.status === "degraded"
          ? 207
          : 503;

      res.status(status).json({
        ...health,
        timestamp: new Date().toISOString(),
        version: "1.0",
      });
    } catch (error) {
      res.status(500).json({
        status: "error",
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      });
    }
  });

  return router;
}
