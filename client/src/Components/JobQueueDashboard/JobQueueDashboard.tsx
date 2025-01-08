import React, { useState, useEffect } from "react";
import { Activity, RefreshCw, Clock, CheckCircle, XCircle } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

interface Metric {
  queueLength: number;
  processingJobs: number;
  completedJobs: number;
  failedJobs: number;
  workers: string[];
  history: Array<{
    timestamp: string;
    queueLength: number;
    processingJobs: number;
  }>;
}

interface Job {
  id: string;
  type: string;
  status: "completed" | "failed" | "processing" | "pending";
  priority: string;
  progress: number | null;
  createdAt: string;
}

const JobQueueDashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<Metric>({
    queueLength: 0,
    processingJobs: 0,
    completedJobs: 0,
    failedJobs: 0,
    workers: [],
    history: [],
  });

  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const [metricsRes, jobsRes] = await Promise.all([
        fetch(`${import.meta.env.VITE_PUBLIC_API_URL}/api/metrics`),
        fetch(`${import.meta.env.VITE_PUBLIC_API_URL}/api/jobs`),
      ]);

      if (!metricsRes.ok || !jobsRes.ok) {
        throw new Error("Failed to fetch data");
      }

      const [metricsData, jobsData] = await Promise.all([
        metricsRes.json(),
        jobsRes.json(),
      ]);

      setMetrics(metricsData);
      setJobs(jobsData);
      setError(null);
    } catch (err) {
      console.log(err);
      setError("Failed to fetch dashboard data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  const getStatusBadgeClass = (status: Job["status"]): string => {
    const baseClasses = "px-2 py-1 rounded-full text-xs font-medium";
    switch (status) {
      case "completed":
        return `${baseClasses} bg-green-100 text-green-800`;
      case "failed":
        return `${baseClasses} bg-red-100 text-red-800`;
      case "processing":
        return `${baseClasses} bg-blue-100 text-blue-800`;
      default:
        return `${baseClasses} bg-gray-100 text-gray-800`;
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <RefreshCw className="h-8 w-8 animate-spin text-gray-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert alert-danger m-4">
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Job Queue Dashboard</h1>
        <RefreshCw
          className="h-5 w-5 cursor-pointer hover:text-gray-600"
          onClick={fetchData}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card">
          <div className="card-header flex flex-row items-center justify-between pb-2">
            <span className="text-sm font-medium">Queue Length</span>
            <Clock className="h-4 w-4 text-gray-500" />
          </div>
          <div className="card-content">
            <div className="text-2xl font-bold">{metrics.queueLength}</div>
          </div>
        </div>

        <div className="card">
          <div className="card-header flex flex-row items-center justify-between pb-2">
            <span className="text-sm font-medium">Processing</span>
            <Activity className="h-4 w-4 text-blue-500" />
          </div>
          <div className="card-content">
            <div className="text-2xl font-bold">{metrics.processingJobs}</div>
          </div>
        </div>

        <div className="card">
          <div className="card-header flex flex-row items-center justify-between pb-2">
            <span className="text-sm font-medium">Completed</span>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </div>
          <div className="card-content">
            <div className="text-2xl font-bold">{metrics.completedJobs}</div>
          </div>
        </div>

        <div className="card">
          <div className="card-header flex flex-row items-center justify-between pb-2">
            <span className="text-sm font-medium">Failed</span>
            <XCircle className="h-4 w-4 text-red-500" />
          </div>
          <div className="card-content">
            <div className="text-2xl font-bold">{metrics.failedJobs}</div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="text-lg font-bold">Queue Metrics Over Time</span>
        </div>
        <div className="card-content">
          <LineChart
            className="w-full"
            width={1050}
            height={300}
            data={metrics.history}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="timestamp" />
            <YAxis />
            <Tooltip />
            <Line
              type="monotone"
              dataKey="queueLength"
              stroke="#8884d8"
              name="Queue Length"
            />
            <Line
              type="monotone"
              dataKey="processingJobs"
              stroke="#82ca9d"
              name="Processing Jobs"
            />
          </LineChart>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="text-lg font-bold">Recent Jobs</span>
        </div>
        <div className="card-content">
          <div className="overflow-x-auto">
            <table className="w-full border">
              <thead>
                <tr className="text-left border-b">
                  <th className="p-3 text-sm font-medium text-gray-500 border text-center">
                    ID
                  </th>
                  <th className="p-3 text-sm font-medium text-gray-500 border text-center">
                    Type
                  </th>
                  <th className="p-3 text-sm font-medium text-gray-500 border text-center">
                    Status
                  </th>
                  <th className="p-3 text-sm font-medium text-gray-500 border text-center">
                    Priority
                  </th>
                  <th className="p-3 text-sm font-medium text-gray-500 border text-center">
                    Progress
                  </th>
                  <th className="p-3 text-sm font-medium text-gray-500 border text-center">
                    Created
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {jobs?.map((job) => (
                  <tr key={job.id}>
                    <td className="p-3 text-sm border text-center">{job.id}</td>
                    <td className="p-3 text-sm border text-center">
                      {job.type}
                    </td>
                    <td className="p-3 border text-center">
                      <span className={getStatusBadgeClass(job.status)}>
                        {job.status}
                      </span>
                    </td>
                    <td className="p-3 text-sm border text-center">
                      {job.priority}
                    </td>
                    <td className="p-3 text-sm border text-center">
                      {job.progress ? `${job.progress}%` : "-"}
                    </td>
                    <td className="p-3 text-sm border text-center">
                      {new Date(job.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default JobQueueDashboard;
