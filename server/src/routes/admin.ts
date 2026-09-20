import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { EmailService } from '../services/EmailService.js';
import { RetentionService } from '../services/RetentionService.js';
import { authenticateToken, requireRole, AuthenticatedRequest } from '../middleware/auth.js';

export const adminRouter = Router();

// Protect ALL admin routes with ADMIN RBAC
adminRouter.use(authenticateToken, requireRole(['ADMIN', 'HR_ADMIN']));

/**
 * Get Platform Dashboard Metrics & Health
 */
adminRouter.get('/stats', async (req: AuthenticatedRequest, res) => {
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
 * Create Question Endpoint (MCQ & CODING types supported)
 */
adminRouter.post('/questions', async (req: AuthenticatedRequest, res) => {
  const { sectionId, type, prompt, difficulty, codeTemplate, testCasesJson, explanation, options } = req.body;

  try {
    if (!sectionId || !prompt || !type) {
      return res.status(400).json({ success: false, error: 'sectionId, prompt, and type are required' });
    }

    const question = await prisma.question.create({
      data: {
        sectionId,
        type: type || 'MCQ_SINGLE',
        prompt,
        difficulty: difficulty || 'MEDIUM',
        explanation: explanation || null,
        codeTemplate: codeTemplate || null,
        testCasesJson: testCasesJson || null,
        options: options && Array.isArray(options) ? {
          create: options.map((opt: any) => ({
            text: opt.text,
            isCorrect: opt.isCorrect || false,
          }))
        } : undefined,
      },
      include: { options: true }
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user?.id,
        userName: req.user?.name,
        action: 'QUESTION_CREATED',
        entity: 'Question',
        details: `Created new ${type} question: "${prompt.slice(0, 40)}..."`,
      }
    });

    res.json({ success: true, question });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Create Assessment Template Endpoint
 */
adminRouter.post('/templates', async (req: AuthenticatedRequest, res) => {
  const { title, roleCategory, durationMinutes, passPercentage, sections } = req.body;

  try {
    if (!title) {
      return res.status(400).json({ success: false, error: 'title is required' });
    }

    const template = await prisma.assessmentTemplate.create({
      data: {
        title,
        roleCategory: roleCategory || 'FULLSTACK_ENGINEER',
        durationMinutes: durationMinutes || 30,
        passPercentage: passPercentage || 70,
        sections: sections && Array.isArray(sections) ? {
          create: sections.map((sec: any) => ({
            title: sec.title,
            questionCount: sec.questionCount || 5,
          }))
        } : undefined,
      },
      include: { sections: true }
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user?.id,
        userName: req.user?.name,
        action: 'TEMPLATE_CREATED',
        entity: 'AssessmentTemplate',
        details: `Created new Assessment Template "${title}"`,
      }
    });

    res.json({ success: true, template });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Get Audit Logs (ADMIN ONLY)
 */
adminRouter.get('/audit-logs', requireRole(['ADMIN']), async (req: AuthenticatedRequest, res) => {
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
 * Get Email Logs (ADMIN ONLY)
 */
adminRouter.get('/email-logs', requireRole(['ADMIN']), async (req: AuthenticatedRequest, res) => {
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

/**
 * Get Current SMTP Configuration (ADMIN ONLY - Sensitive)
 */
adminRouter.get('/smtp-config', requireRole(['ADMIN']), async (req: AuthenticatedRequest, res) => {
  try {
    const config = await EmailService.getSmtpConfig();
    res.json({ success: true, config });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Save SMTP Configuration dynamically (ADMIN ONLY - Sensitive)
 */
adminRouter.post('/smtp-config', requireRole(['ADMIN']), async (req: AuthenticatedRequest, res) => {
  try {
    const { host, port, user, pass, from, secure, service } = req.body;
    const result = await EmailService.saveSmtpConfig({
      host,
      port: port ? Number(port) : undefined,
      user,
      pass,
      from,
      secure: secure !== undefined ? Boolean(secure) : undefined,
      service,
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user?.id,
        userName: req.user?.name,
        action: 'SMTP_CONFIG_UPDATED',
        entity: 'SystemSetting',
        details: `Updated SMTP email configuration to service=${service || 'custom'} host=${host || 'env'}`,
      }
    });

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Send Live Test Email to verify SMTP setup (ADMIN ONLY)
 */
adminRouter.post('/test-email', requireRole(['ADMIN']), async (req: AuthenticatedRequest, res) => {
  try {
    const { recipientEmail } = req.body;
    if (!recipientEmail) {
      return res.status(400).json({ success: false, error: 'Recipient email is required' });
    }

    const result = await EmailService.sendTestEmail(recipientEmail);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Resend Email from Log (ADMIN ONLY)
 */
adminRouter.post('/email-logs/:id/resend', requireRole(['ADMIN']), async (req: AuthenticatedRequest, res) => {
  try {
    const log = await prisma.emailLog.findUnique({ where: { id: req.params.id } });
    if (!log) {
      return res.status(404).json({ success: false, error: 'Email log not found' });
    }

    const result = await EmailService.sendEmail({
      recipientEmail: log.recipientEmail,
      subject: log.subject,
      type: log.type as any,
      content: log.content,
    });

    res.json({ success: true, result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * DPDP Section 8(7): Execute Data Retention Purge for Expired Proctoring Media
 * Honors active Legal Holds on candidates, safely unlinking expired media.
 */
adminRouter.post('/retention/purge-expired', requireRole(['ADMIN', 'HR_ADMIN']), async (req: AuthenticatedRequest, res) => {
  const companyId = req.user?.companyId || req.body.companyId;

  if (!companyId && req.user?.role !== 'ADMIN') {
    return res.status(400).json({ success: false, error: 'companyId is required to execute retention purge.' });
  }

  const { overrideDays } = req.body;
  const targetCompanyId = companyId || req.body.targetCompanyId;

  if (!targetCompanyId) {
    return res.status(400).json({ success: false, error: 'Target company ID is required.' });
  }

  try {
    const result = await RetentionService.purgeExpiredSnapshots(targetCompanyId, overrideDays ? Number(overrideDays) : undefined);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Failed to execute retention purge: ' + err.message });
  }
});
