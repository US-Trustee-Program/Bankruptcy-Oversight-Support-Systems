import * as express from 'express';
import * as cors from 'cors';
import * as dotenv from 'dotenv';
import router from './routes';
import { initializeApplicationInsights } from '../../azure/app-insights';

dotenv.config();

// Initialize Application Insights
initializeApplicationInsights();

const app = express();
const port = process.env.PORT || 7071;

// CORS configuration
const corsOptions = {
  origin: ['http://localhost:3000', 'https://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-request-id'],
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Add request ID middleware for tracing
app.use((req, _res, next) => {
  req.headers['x-request-id'] =
    req.headers['x-request-id'] ||
    `express-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  next();
});

// Use the API router
app.use('/api', router);

// Error handling middleware
app.use((err: Error, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ message: 'Internal Server Error' });
  next();
});

// Start server
app.listen(port, () => {
  console.log(`Express server running on port ${port}`);
});

export default app;
