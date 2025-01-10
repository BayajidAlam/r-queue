import express from "express";
import { JobQueue } from "../../services/JobQueue";
import { createRedisClient } from "../../config/redis";
import { Job, JobPriority } from "../../types";

const router = express.Router();
const queue = new JobQueue(createRedisClient());

// Create a new job
router.post("/jobs", async (req, res) => {
  try {
    const { type, data, priority, dependencies, processingTime, shouldFail } =
      req.body;

    const jobId = await queue.enqueue(
      type,
      { ...data, processingTime, shouldFail },
      priority || JobPriority.MEDIUM,
      dependencies || []
    );
    console.log("jobId:- ", jobId, "priority:-: ", priority);
    res.status(201).json({ jobId });
  } catch (error) {
    const err = error as Error;
    res.status(500).json({ error: err.message });
  }
});

// Get all jobs with filtering and pagination
router.get("/jobs", async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      type,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    const filters: Record<string, any> = {};
    if (status) filters.status = status;
    if (type) filters.type = type;

    const [jobs, total] = await Promise.all([
      queue.getJobs(filters, {
        skip,
        limit: limitNum,
        sortBy: sortBy as keyof Job,
        sortOrder: sortOrder as "asc" | "desc",
      }),
      queue.getJobsCount(filters),
    ]);

    res.json({
      jobs,
      page: pageNum,
      limit: limitNum,
      total,
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get a job by id
router.get("/jobs/:id", async (req, res) => {
  try {
    const job = await queue.getJob(req.params.id);

    if (!job) {
      res.status(404).json({ error: "Job not found" });
      return;
    }

    res.json(job);
  } catch (error) {
    const err = error as Error;
    res.status(500).json({ error: err.message });
  }
});

// Cancel a job by id
router.post("/jobs/:id/cancel", async (req, res) => {
  try {
    const success = await queue.cancelJob(req.params.id);

    if (!success) {
      res.status(400).json({ error: "Job cannot be cancelled" });
      return;
    }

    res.json({ success: true });
  } catch (error) {
    const err = error as Error;
    res.status(500).json({ error: err.message });
  }
});

export { router };
