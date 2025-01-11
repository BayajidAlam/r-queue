
![image](https://github.com/user-attachments/assets/017cba47-9cb6-4489-805c-8abbe5fcca9e)
# R-queue - A Distributed Job Queue System with Redis

A scalable, fault-tolerant distributed job queue system using Redis to manage tasks across worker nodes with job tracking, retries, prioritization, and a dashboard for monitoring and health checks.

- [Architecture Overview](#architecture-overview)
- [Features](#features)
- [Getting Started](#getting-started)
- [Folder Structure](#folder-structure)
- [API Endpoints](#api-endpoints)
- [Deployments](#deployments)
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


## Getting Started
Follow these steps to run the application locally

**1. Clone the Repository**

```bash
  git clone https://github.com/BayajidAlam/r-queue
  cd r-queue

```

**2. Install Dependencies**

```bash
  cd client
  yarn install

```

**3. Set Up Environment Variables**

Create a **.env** file in the **/client** directory and add this: 
```bash
VITE_PUBLIC_API_URL=backend url

```

**4. Run the server**

```bash
  yarn dev

```


### To run backend follow this steps:
**1. Install Dependencies**

```bash
  cd server
  yarn install

```
#### 2. Create a **.env** file in the **/server** directory and add this:

```bash
REDIS_HOST=localhost 
PORT=5000
```

**3. Navigate to docker compose folder and run all container:**

```bash
cd docker-compose.yml
docker-compose up -d
```
You will see like this:
![image](https://github.com/user-attachments/assets/318d4df9-5119-418d-8afd-efa04ad92e90)


**4. Use any one of the running Redis nodes to initialize the cluster. For example, access redis-node-1:**

```bash
docker exec -it redis-node-1 redis-cli
```

**5. Run following command to create cluster:**
```bash
redis-cli --cluster create \
  <node-1 IP>:6379 <node-2 IP>:6379 <node-3 IP>:6379 \
  <node-4 IP>:6379 <node-5 IP>:6379 <node-6 IP>:6379 \
  --cluster-replicas 1

```
you will see something like this:
![image](https://github.com/user-attachments/assets/279a9e59-ebe2-4231-b81d-c8ffe3fbda8d)


**6. Verify the Cluster**
```bash
redis-cli -c cluster nodes

```

**7. Now run the server and test your applicaion:**
```bash
yarn dev
```


You will see something like this:
![image](https://github.com/user-attachments/assets/8c8b0df6-147d-4d8a-b09f-2c5b111f236d)



## Folder Structure

- `/client` : **Frontend**
  - `/public`: Static files and assets.
  - `/src`: Application code.
  - `.env`: Frontend environment variables
  - `package.json`
-  `/server`: **Backend**
    - `/redis-cluster`: Redis cluster set up for running in docker environment locally 
    - `/src`: Backend source code.
   - `docker-compose`: For creating redis cluster in docker environment locally 
    - `.env`: Backend environment variables
   - `package.json`

- `/IaC`: **Infrastructure** 
    - `/pulumi`:
        - `index.ts`: Pulumi IaC files for managing AWS resources includes networking, compute to create distributed redis cluster.
    - `ansible`: Ansible configuration files 




## API Endpoints
The application have following API's

### Root url(Local environment)

```
  http://localhost:5000/api

```
### Check health (GET)
API Endpoint:
```
    http://localhost:5000/api/health
```

#### Response would be like this
```
{
    "status": "unhealthy",
    "details": {
        "redisConnected": true,
        "activeWorkers": 0,
        "queueLength": 0,
        "processingJobs": 0,
        "metrics": {
            "avgProcessingTime": 0,
            "errorRate": 0,
            "throughput": 0
        }
    },
    "timestamp": "2025-01-10T12:20:37.856Z",
    "version": "1.0"
}
```



### Add new job (POST)
API Endpoint:
```
  http://localhost:5000/api/jobs
```

### Examples

For register a user your request body should be like following

#### Reqeust body

```
{
    "type": "email",
    "data": {
        "Hello": "Hello",
        "world": "world"
    },
    "priority": 3,

    "dependencies": [
        "a3342ec2-fcae-4e8d-8df8-8f59a2c7d58c"
    ]
}
```

#### Response  would be like this
```
{
    "acknowledged": true,
    "insertedId": "675002aea8b348ab91f524d0"
}
```

## Prerequisites

Before deploying the application, ensure you have the following:

- An **AWS account** with EC2 setup permissions.
- **Docker** installed on your local machine for building containers.
- **AWS CLI** installed and configured with your credentials.
- **Node.js** (version 18 or above) and **npm** and **yarn** installed for both frontend and backend applications.
- **Pulumi** installed for managing AWS infrastructure as code.
- **TypeScript** installed on your computer


## Deployments