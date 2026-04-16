import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import path from 'path';

import authRoutes from './routes/auth';
import patientRoutes from './routes/patients';
import legRoutes from './routes/legs';
import assessmentRoutes from './routes/assessments';
import imageRoutes from './routes/images';
import dopplerRoutes from './routes/doppler';
import fileRoutes from './routes/files';

// Load env vars
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet({
  crossOriginResourcePolicy: false, // Allow local images to be loaded
}));
app.use(cors({
  origin: 'http://localhost:5173', // React dev server
  credentials: true,
}));
app.use(express.json());



// Health check
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/assessments', assessmentRoutes);
app.use('/api/legs', legRoutes);
app.use('/api/images', imageRoutes);
app.use('/api/doppler', dopplerRoutes);
app.use('/api/files', fileRoutes);

// Error handler
app.use((err: any, req: Request, res: Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something broke!' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
