
![image](https://github.com/user-attachments/assets/017cba47-9cb6-4489-805c-8abbe5fcca9e)
# R-queue - A Distributed Job Queue System with Redis

A scalable, fault-tolerant distributed job queue system using Redis to manage tasks across worker nodes with job tracking, retries, prioritization, and a dashboard for monitoring and health checks.

### Objective

The objective is to design and implement a distributed job queue system using Redis that can:

- Distribute computational tasks dynamically across multiple worker nodes.
-  Track job statuses (`pending`, `processing`, `completed`, `failed`) and handle failures through retries or alternative mechanisms.
-  Provide a user-friendly dashboard for real-time monitoring of job statuses and worker health.
-  Support horizontal scaling of worker nodes and job prioritization.

### Core Challenges

-  Ensuring fault-tolerance and graceful recovery from worker or network failures.
-  Efficiently managing a distributed queue to handle job priorities and dependencies.
-  Implementing a robust retry mechanism for failed jobs and a dead-letter queue for irrecoverable tasks.
-  Storing and retrieving job results in a scalable manner.
-  Handling dynamic workload variations and enabling worker auto-scaling based on queue length.

### Additional Features (Bonus Challenges)

-  Implementing job dependencies where certain jobs can only start after others are completed.
-  Tracking real-time job progress for better monitoring and debugging.

## Architecture Overview

![image](https://github.com/user-attachments/assets/06b1320d-c7cd-4cca-a851-6ff10c636c31)

**1. Frontend:**  
A React.js application with an intuitive interface for monitoring and managing the system, providing:  
- Worker health and active worker status.  
- Queue length and benchmarking of jobs.  
- Total jobs (processing, completed, failed).  
- Detailed view of all jobs (pending, processing, canceled, failed, completed) with type, status, progress, and priorities, including dynamic pagination and filtering by parameters.  
- Input modal for simulating jobs.

**2. Backend:**


 **3. Cloud Infrastructure**: 
  
  
- **Networking**: 
  - AWS VPC for managing network configurations.
  - AWS EC2 for hosting the application instances.
  - AWS Security Groups for managing access control to EC2 instances.
  - AWS NAT Gateway for enabling internet access from private subnets.

- **DevOps**: 
  - Pulumi as IAC to manage AWS resources and automate deployments.


## Features

- Priority-based job scheduling
- Automatic worker scaling (1-10 workers)
- Job retry with exponential backoff
- Dead letter queue for failed jobs
- Real-time job progress tracking
- Worker health monitoring
- Comprehensive metrics collection
- Circuit breaker pattern implementation
- Job dependency management

## Folder Structure

- `/client` : **Frontend**
  - `/public`: Static files and assets.
  - `/src`: Application code.
  - `.env`: Frontend environment variables
  - `package.json`
-  `/server`: **Backend**
    - `/src`: Backend source code.
   - `docker-compose`: For creating redis cluster in docker environment locally 
    - `.env`: Backend environment variables
   - `package.json`

- `/IaC`: **Infrastructure** 
    - `index.ts`: Pulumi IaC files for managing AWS resources includes networking, compute to create distributed redis cluster.

