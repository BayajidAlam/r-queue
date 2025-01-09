import fetch from 'node-fetch';

const API_URL = 'http://localhost:5000/api/jobs';
const JOB_TYPES = ['email', 'report', 'image', 'data'];
const PRIORITIES = ['HIGH', 'MEDIUM', 'LOW'];

interface SimulationConfig {
  totalJobs: number;
  duration: number;  // in seconds
  batchSize?: number;
}

async function sendBatch(jobs: any[]) {
  return Promise.all(jobs.map(job => 
    fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(job),
    }).then(res => res.json())
  ));
}

async function simulateRateLimitedJobs({ totalJobs, duration, batchSize = 10 }: SimulationConfig) {
  console.log(`Starting simulation: ${totalJobs} jobs over ${duration} seconds`);
  const startTime = Date.now();
  const jobsPerSecond = Math.ceil(totalJobs / duration);
  const batchesPerSecond = Math.ceil(jobsPerSecond / batchSize);
  const batchInterval = 1000 / batchesPerSecond;
  
  let completedJobs = 0;
  let currentBatch: any[] = [];

  while (completedJobs < totalJobs) {
    const batchSize = Math.min(10, totalJobs - completedJobs);
    
    // Create batch of jobs
    for (let i = 0; i < batchSize; i++) {
      const job = {
        type: JOB_TYPES[Math.floor(Math.random() * JOB_TYPES.length)],
        priority: PRIORITIES[Math.floor(Math.random() * PRIORITIES.length)],
        processingTime: Math.floor(Math.random() * 20) + 1,
        data: {
          id: `batch-${completedJobs + i + 1}`,
          timestamp: new Date().toISOString(),
        },
        shouldFail: Math.random() < 0.1
      };
      currentBatch.push(job);
    }

    // Send batch
    const results = await sendBatch(currentBatch);
    completedJobs += currentBatch.length;
    currentBatch = [];

    const elapsedTime = (Date.now() - startTime) / 1000;
    const currentRate = completedJobs / elapsedTime;
    console.log(`Progress: ${completedJobs}/${totalJobs} jobs (${currentRate.toFixed(2)} jobs/sec)`);

    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, batchInterval));
  }

  const totalTime = (Date.now() - startTime) / 1000;
  console.log(`\nSimulation completed in ${totalTime.toFixed(2)} seconds`);
  console.log(`Average rate: ${(completedJobs / totalTime).toFixed(2)} jobs/sec`);
}

// Parse command line arguments
const args = process.argv.slice(2);
const config: SimulationConfig = {
  totalJobs: parseInt(args[0]) || 200,
  duration: parseInt(args[1]) || 1,
  batchSize: parseInt(args[2]) || 10
};

simulateRateLimitedJobs(config).catch(console.error);