import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import healthRouter from './routes/health.js';
import regionRouter from './routes/region.js';
import platformsRouter from './routes/platforms.js';
import recommendationsRouter from './routes/recommendations.js';
import recommendRouter from './routes/recommend.js';
import feedbackRouter from './routes/feedback.js';
import errorHandler from './middleware/errorHandler.js';
import { loadRedditDb } from './services/redditDbLoader.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Trust proxy so req.ip reflects real client IP in production
app.set('trust proxy', 1);

app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? process.env.FRONTEND_URL
    : true,
}));
app.use(express.json());

// Rate limiter for recommendation endpoints
const recommendLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: { error: "You've been exploring a lot! Take a breather and try again in a bit." },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/recommend', recommendLimiter);

app.use('/api', healthRouter);
app.use('/api', regionRouter);
app.use('/api', platformsRouter);
app.use('/api', recommendationsRouter);
app.use('/api', recommendRouter);
app.use('/api', feedbackRouter);

// Error handler must be last
app.use(errorHandler);

loadRedditDb();

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;
