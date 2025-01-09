import React, { useState, useEffect, useCallback } from "react";
import {
  Activity,
  RefreshCw,
  Clock,
  CheckCircle,
  XCircle,
  Timer,
  Users,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { Badge } from "../../components/ui/badge";

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

interface IHealthMatric {
  activeWorkers: number;
  metrics: {
    avgProcessingTime: number;
    errorRate: number;
    throughput: number;
  };
}

interface Job {
  id: string;
  type: string;
  status: "completed" | "failed" | "processing" | "pending";
  priority: string;
  progress: number | null;
  createdAt: string;
}

const JOB_STATUS_OPTIONS = [
  { label: "All Status", value: "all" },
  { label: "Pending", value: "pending" },
  { label: "Processing", value: "processing" },
  { label: "Completed", value: "completed" },
  { label: "Failed", value: "failed" },
];

const PAGE_SIZE_OPTIONS = [
  { label: "5 per page", value: "5" },
  { label: "10 per page", value: "10" },
  { label: "20 per page", value: "20" },
  { label: "50 per page", value: "50" },
];

const SORT_OPTIONS = [
  { label: "Created At", value: "createdAt" },
  { label: "Priority", value: "priority" },
  { label: "Status", value: "status" },
  { label: "Type", value: "type" },
];

const defaultHealthMatrix: IHealthMatric = {
  activeWorkers: 0,
  metrics: {
    avgProcessingTime: 0,
    errorRate: 0,
    throughput: 0,
  },
};

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
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(20);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);
  const [jobTypes, setJobTypes] = useState<string[]>([]);
  const [healthMatrix, setHealthMatrix] =
    useState<IHealthMatric>(defaultHealthMatrix);

  const fetchData = useCallback(async () => {
    try {
      const [metricsRes, jobsRes, healthRes] = await Promise.all([
        fetch(`${import.meta.env.VITE_PUBLIC_API_URL}/api/metrics`),
        fetch(
          `${
            import.meta.env.VITE_PUBLIC_API_URL
          }/api/jobs?${new URLSearchParams({
            page: page.toString(),
            limit: limit.toString(),
            sortBy,
            sortOrder,
            ...(statusFilter !== "all" && { status: statusFilter }),
            ...(typeFilter !== "all" && { type: typeFilter }),
          })}`
        ),
        fetch(`${import.meta.env.VITE_PUBLIC_API_URL}/api/health`),
      ]);

      if (!metricsRes.ok || !jobsRes.ok || !healthRes.ok) {
        throw new Error("Failed to fetch data");
      }

      const [metricsData, jobsData, healthData] = await Promise.all([
        metricsRes.json(),
        jobsRes.json(),
        healthRes.json(),
      ]);

      // Debug logs
      console.log("Health Data:", healthMatrix);

      // Update metrics state
      setMetrics(metricsData);

      // Update health state
      setHealthMatrix(healthData?.details);
      // Ensure jobsData is an array before processing
      const jobsArray = Array.isArray(jobsData)
        ? jobsData
        : jobsData.jobs || [];

      // Update jobs state
      setJobs(jobsArray);

      // Update job types for filter - with null check
      const types = Array.from(new Set(jobsArray.map((job: Job) => job.type)));
      setJobTypes(types);

      setError(null);
    } catch (err) {
      console.error("Fetch Error:", err);
      setError("Failed to fetch dashboard data");
    } finally {
      setLoading(false);
    }
  }, [page, limit, sortBy, sortOrder, statusFilter, typeFilter, healthMatrix]);
  useEffect(() => {
    fetchData();
    let interval: number | undefined;

    if (autoRefresh) {
      interval = window.setInterval(fetchData, 2000); // Poll every 2 seconds
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [
    page,
    limit,
    statusFilter,
    typeFilter,
    sortBy,
    sortOrder,
    autoRefresh,
    fetchData,
  ]);

  const MetricCard = ({ title, value, icon: Icon, color }: any) => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className={`h-4 w-4 text-${color}-500`} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );

  const getStatusBadgeVariant = (
    status: Job["status"]
  ): "default" | "success" | "destructive" | "secondary" => {
    switch (status) {
      case "completed":
        return "success";
      case "failed":
        return "destructive";
      case "processing":
        return "default";
      default:
        return "secondary";
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <RefreshCw className="h-8 w-8 animate-spin text-gray-500" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header section */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Job Queue Dashboard</h1>
        <div className="flex items-center gap-4">
          <Button
            variant={autoRefresh ? "default" : "outline"}
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${autoRefresh ? "animate-spin" : ""}`}
            />
            {autoRefresh ? "Auto-refresh On" : "Auto-refresh Off"}
          </Button>
          <Button variant="outline" onClick={fetchData}>
            Refresh Now
          </Button>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4">
          <div className="flex">
            <XCircle className="h-5 w-5 text-red-400" />
            <p className="ml-3 text-sm text-red-700">{error}</p>
          </div>
        </div>
      )}

      {/* Metrics cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <MetricCard
          title="Active Workers"
          value={healthMatrix.activeWorkers}
          icon={Users}
          color="purple"
        />
        <MetricCard
          title="Queue Length"
          value={metrics.queueLength}
          icon={Clock}
          color="gray"
        />
        <MetricCard
          title="Processing"
          value={metrics.processingJobs}
          icon={Activity}
          color="blue"
        />
        <MetricCard
          title="Completed"
          value={metrics.completedJobs}
          icon={CheckCircle}
          color="green"
        />
        <MetricCard
          title="Failed"
          value={metrics.failedJobs}
          icon={XCircle}
          color="red"
        />
      </div>

      {/* Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Queue Metrics Over Time</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={metrics.history}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="timestamp"
                tickFormatter={(value) => new Date(value).toLocaleTimeString()}
              />
              <YAxis />
              <Tooltip
                labelFormatter={(value) => new Date(value).toLocaleString()}
              />
              <Legend />
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
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Jobs table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Recent Jobs</CardTitle>
            <div className="flex items-center gap-4">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  {JOB_STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {jobTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Sort By" />
                </SelectTrigger>
                <SelectContent>
                  {SORT_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                onClick={() =>
                  setSortOrder(sortOrder === "asc" ? "desc" : "asc")
                }
              >
                {sortOrder === "asc" ? "↑" : "↓"}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="p-3 text-sm font-medium text-left">ID</th>
                  <th className="p-3 text-sm font-medium text-left">Type</th>
                  <th className="p-3 text-sm font-medium text-left">Status</th>
                  <th className="p-3 text-sm font-medium text-left">
                    Priority
                  </th>
                  <th className="p-3 text-sm font-medium text-left">
                    Progress
                  </th>
                  <th className="p-3 text-sm font-medium text-left">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {jobs?.map((job) => (
                  <tr key={job.id} className="hover:bg-gray-50">
                    <td className="p-3 text-sm text-start">{job.id}</td>
                    <td className="p-3 text-sm text-start">{job.type}</td>
                    <td className="p-3">
                      <Badge variant={getStatusBadgeVariant(job.status)}>
                        {job.status}
                      </Badge>
                    </td>
                    <td className="p-3 text-sm text-start">{job.priority}</td>
                    <td className="p-3 text-sm text-start">
                      {job.progress ? `${job.progress}%` : "-"}
                    </td>
                    <td className="p-3 text-sm text-start">
                      {new Date(job.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Pagination */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Select
            value={limit.toString()}
            onValueChange={(val) => setLimit(Number(val))}
          >
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Page Size" />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-sm text-gray-500">Page {page}</span>
        </div>
        <div className="flex gap-4">
          <Button
            variant="outline"
            onClick={() => setPage(page - 1)}
            disabled={page === 1}
          >
            Previous
          </Button>
          <Button variant="outline" onClick={() => setPage(page + 1)}>
            Next
          </Button>
        </div>
      </div>
    </div>
  );
};

export default JobQueueDashboard;
