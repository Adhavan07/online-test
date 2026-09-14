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
import { analyticsRouter } from './routes/analytics.js';
import { aiGeneratorRouter } from './routes/aiGenerator.js';
import { interviewsRouter } from './routes/interviews.js';
import { badgesRouter } from './routes/badges.js';
import { webhooksRouter } from './routes/webhooks.js';
import { notificationsRouter } from './routes/notifications.js';

import { securityHeaders } from './middleware/securityHeaders.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(securityHeaders);
app.use(cors());
app.use(express.json({ limit: '10mb' }));

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
app.use('/api/analytics', analyticsRouter);
app.use('/api/admin/ai-generator', aiGeneratorRouter);
app.use('/api/ai', aiGeneratorRouter);
app.use('/api/interviews', interviewsRouter);
app.use('/api/badges', badgesRouter);
app.use('/api/webhooks', webhooksRouter);
app.use('/api/notifications', notificationsRouter);

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

// Global error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err.type === 'entity.too.large' || err.status === 413) {
    return res.status(413).json({ success: false, error: 'Payload too large: Request body exceeds allowed size.' });
  }
  if (err.status === 400 && 'body' in err) {
    return res.status(400).json({ success: false, error: 'Invalid JSON payload.' });
  }
  next(err);
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, (err?: any) => {
    if (err) {
      console.error('Error starting server:', err);
    } else {
      console.log(`🚀 TechScreen Pro Server listening on http://localhost:${PORT}`);
    }
  });
}

export { app };
