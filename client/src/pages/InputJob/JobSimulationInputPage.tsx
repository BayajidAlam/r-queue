import { Loader2 } from "lucide-react";
import { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { Input } from "../../components/ui/input";
import { Button } from "../../components/ui/button";

const JobSimulationPage = () => {
  const [formData, setFormData] = useState({
    jobType: "email",
    processingTime: 10,
    shouldFail: false,
    priority: "MEDIUM",
    data: "",
  });

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch("/api/jobs/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Job Simulation</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Job Type</label>
              <select
                className="w-full p-2 border rounded"
                value={formData.jobType}
                onChange={(e) =>
                  setFormData({ ...formData, jobType: e.target.value })
                }
              >
                <option value="email">Send Email</option>
                <option value="report">Generate Report</option>
                <option value="image">Process Image</option>
                <option value="data">Data Analysis</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Processing Time (seconds)
              </label>
              <Input
                type="number"
                min="1"
                max="30"
                value={formData.processingTime}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    processingTime: parseInt(e.target.value),
                  })
                }
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Priority</label>
              <select
                className="w-full p-2 border rounded"
                value={formData.priority}
                onChange={(e) =>
                  setFormData({ ...formData, priority: e.target.value })
                }
              >
                <option value="HIGH">High</option>
                <option value="MEDIUM">Medium</option>
                <option value="LOW">Low</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Job Data (JSON)
              </label>
              <textarea
                className="w-full p-2 border rounded h-24"
                value={formData.data}
                onChange={(e) =>
                  setFormData({ ...formData, data: e.target.value })
                }
                placeholder='{"key": "value"}'
              />
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="shouldFail"
                checked={formData.shouldFail}
                onChange={(e) =>
                  setFormData({ ...formData, shouldFail: e.target.checked })
                }
                className="mr-2"
              />
              <label htmlFor="shouldFail" className="text-sm font-medium">
                Simulate Failure
              </label>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Create Simulated Job
            </Button>
          </form>

          {error && (
            <Alert variant="destructive" className="mt-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {result && (
            <Alert className="mt-4">
              <AlertDescription>
                Job created successfully! Job ID: {result.jobId}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default JobSimulationPage;