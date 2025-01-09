import express from 'express';
import { JobQueue } from '../../services/JobQueue';
import { createRedisClient } from '../../config/redis';

const router = express.Router();
const queue = new JobQueue(createRedisClient());

router.get('/metrics', async (req, res) => {
  try {
    const metrics = await queue.getMetrics();
    res.json(metrics);
  } catch (error) {
    const err = error as Error;
    res.status(500).json({ error: err.message });
  }
});

export default router;