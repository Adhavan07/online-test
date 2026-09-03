import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { authRouter } from './routes/auth.js';
import { jobsRouter } from './routes/jobs.js';
import { templatesRouter } from './routes/templates.js';
import { candidatesRouter } from './routes/candidates.js';
import { assessmentRouter } from './routes/assessment.js';
import { adminRouter } from './routes/admin.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Serve static uploaded resumes
const uploadsDir = path.join(process.cwd(), 'uploads');
app.use('/uploads', express.static(uploadsDir));

// API Routers
app.use('/api/auth', authRouter);
app.use('/api/jobs', jobsRouter);
app.use('/api/templates', templatesRouter);
app.use('/api/candidates', candidatesRouter);
app.use('/api/assessment', assessmentRouter);
app.use('/api/admin', adminRouter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'UP', service: 'TechScreen Pro Backend API', timestamp: new Date() });
});

// Serve frontend static build if available
const clientDistDir = path.join(process.cwd(), 'client', 'dist');
if (fs.existsSync(clientDistDir)) {
  app.use(express.static(clientDistDir));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/') || req.path.startsWith('/uploads/')) {
      return next();
    }
    res.sendFile(path.join(clientDistDir, 'index.html'));
  });
}

app.listen(PORT, (err?: any) => {
  if (err) {
    console.error('Error starting server:', err);
  } else {
    console.log(`🚀 TechScreen Pro Server listening on http://localhost:${PORT}`);
  }
});
