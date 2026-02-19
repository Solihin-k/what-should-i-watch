import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import healthRouter from './routes/health.js';
import regionRouter from './routes/region.js';
import platformsRouter from './routes/platforms.js';
import recommendationsRouter from './routes/recommendations.js';
import recommendRouter from './routes/recommend.js';
import errorHandler from './middleware/errorHandler.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Trust proxy so req.ip reflects real client IP in production
app.set('trust proxy', 1);

app.use(cors());
app.use(express.json());

app.use('/api', healthRouter);
app.use('/api', regionRouter);
app.use('/api', platformsRouter);
app.use('/api', recommendationsRouter);
app.use('/api', recommendRouter);

// Error handler must be last
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;
