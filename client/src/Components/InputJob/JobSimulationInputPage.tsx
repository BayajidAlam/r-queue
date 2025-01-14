import { FormEvent, useState } from "react";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "../../components/ui/card";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { Input } from "../../components/ui/input";
import { Button } from "../../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../../components/ui/dialog";

enum JobPriority {
  LOW = 1,
  MEDIUM = 2,
  HIGH = 3,
}

const JobSimulationPage = () => {
  const [formData, setFormData] = useState({
    type: "email",
    data: "",
    priority: JobPriority.MEDIUM,
    dependencies: "",
    processingTime: 10,
    shouldFail: false,
  });

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState(null);
  const [isOpen, setIsOpen] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const requestData = {
        ...formData,
        data: JSON.parse(formData.data),
        dependencies: formData.dependencies
          .split(",")
          .map((dep) => dep.trim())
          .filter((dep) => dep),
      };

      const response = await fetch(
        `${import.meta.env.VITE_PUBLIC_API_URL}/api/jobs`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestData),
        }
      );

      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      setResult(data);
      setIsOpen(false);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 max-w-md mx-auto">
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <Button>Add new job</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-center">Job Simulation</DialogTitle>
          </DialogHeader>
          <Card>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-3 py-2">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Job Type
                  </label>
                  <select
                    className="w-full p-1 border rounded"
                    value={formData.type}
                    onChange={(e) =>
                      setFormData({ ...formData, type: e.target.value })
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
                    max="300"
                    value={formData.processingTime}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        processingTime: parseInt(e.target.value),
                      })
                    }
                    className="p-1"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    Priority
                  </label>
                  <select
                    className="w-full p-1 border rounded"
                    value={formData.priority}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        priority: parseInt(e.target.value), 
                      })
                    }
                  >
                    <option value={JobPriority.HIGH}>High</option>
                    <option value={JobPriority.MEDIUM}>Medium</option>
                    <option value={JobPriority.LOW}>Low</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    Job Data (JSON)
                  </label>
                  <textarea
                    className="w-full p-1 border rounded h-12"
                    value={formData.data}
                    onChange={(e) =>
                      setFormData({ ...formData, data: e.target.value })
                    }
                    placeholder='{"key": "value"}'
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    Dependencies (comma-separated job IDs)
                  </label>
                  <Input
                    type="text"
                    value={formData.dependencies}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        dependencies: e.target.value,
                      })
                    }
                    placeholder="Paste job id here..."
                    className="p-1"
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
                  Add new job
                </Button>
              </form>

              {error && (
                <Alert variant="destructive" className="mt-4">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {result && (
                <Alert className="mt-4">
                  <AlertDescription>Job created successfully!</AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default JobSimulationPage;
