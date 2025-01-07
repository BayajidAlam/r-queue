router.get('/metrics', async (req, res) => {
  try {
    const metrics = {
      queueLength: await queue.getQueueLength(),
      processingJobs: await queue.getProcessingCount(),
      completedJobs: await queue.getCompletedCount(),
      failedJobs: await queue.getFailedCount(),
      workers: await queue.getWorkerStatus()
    };
    res.json(metrics);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
