import { Router } from 'express';
import { prisma } from '../lib/prisma.js';

export const adminRouter = Router();

/**
 * Get Platform Dashboard Metrics & Health
 */
adminRouter.get('/stats', async (req, res) => {
  try {
    const totalCompanies = await prisma.company.count();
    const totalUsers = await prisma.user.count();
    const totalJobs = await prisma.job.count();
    const totalTemplates = await prisma.assessmentTemplate.count();
    const totalCandidates = await prisma.candidate.count();
    const totalApplications = await prisma.jobApplication.count();
    const completedAttempts = await prisma.assessmentAttempt.count({ where: { isCompleted: true } });
    const passedResults = await prisma.assessmentResult.count({ where: { isPassed: true } });

    res.json({
      success: true,
      stats: {
        totalCompanies,
        totalUsers,
        totalJobs,
        totalTemplates,
        totalCandidates,
        totalApplications,
        completedAttempts,
        passedResults,
        passRate: completedAttempts > 0 ? Math.round((passedResults / completedAttempts) * 100) : 0,
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Get Audit Logs
 */
adminRouter.get('/audit-logs', async (req, res) => {
  try {
    const logs = await prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json({ success: true, logs });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Get Email Logs
 */
adminRouter.get('/email-logs', async (req, res) => {
  try {
    const logs = await prisma.emailLog.findMany({
      orderBy: { sentAt: 'desc' },
      take: 50,
    });
    res.json({ success: true, logs });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});
