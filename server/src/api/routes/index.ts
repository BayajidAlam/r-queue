import express from 'express';


const app = express();

app.use(cors());
app.use(express.json());
app.use('/api', jobRoutes);
app.use('/api', metricsRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});