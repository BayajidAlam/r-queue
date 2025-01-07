import express from 'express';
import { JobQueue } from '../../services/JobQueue';
import { createRedisClient } from '../../config/redis';
import { JobPriority } from '../../types';


const router = express.Router();
const queue = new JobQueue(createRedisClient());

router.post('/jobs', async (req, res) => {
  try {
    const { type, data, priority, dependencies } = req.body;
    const jobId = await queue.enqueue(
      type,
      data,
      priority || JobPriority.MEDIUM,
      dependencies
    );
    res.status(201).json({ jobId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/jobs/:id', async (req, res) => {
  try {
    const job = await queue.getJob(req.params.id);
    if (!job) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }
    res.json(job);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/jobs/:id/cancel', async (req, res) => {
  try {
    const success = await queue.cancelJob(req.params.id);
    if (!success) {
      res.status(400).json({ error: 'Job cannot be cancelled' });
      return;
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});