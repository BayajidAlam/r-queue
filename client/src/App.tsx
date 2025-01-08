import "./App.css";
import JobSimulationPage from "./Components/InputJob/JobSimulationInputPage";
import JobQueueDashboard from "./Components/JobQueueDashboard/JobQueueDashboard";

function App() {
  return (
    <>
      <JobSimulationPage />
      <JobQueueDashboard />
    </>
  );
}

export default App;
