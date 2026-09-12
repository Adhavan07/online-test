import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { EmailService } from '../services/EmailService.js';

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
 * Create Question Endpoint (MCQ & CODING types supported)
 */
adminRouter.post('/questions', async (req, res) => {
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
adminRouter.post('/templates', async (req, res) => {
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

/**
 * Get Current SMTP Configuration
 */
adminRouter.get('/smtp-config', async (req, res) => {
  try {
    const config = await EmailService.getSmtpConfig();
    res.json({ success: true, config });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Save SMTP Configuration dynamically
 */
adminRouter.post('/smtp-config', async (req, res) => {
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
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Send Live Test Email to verify SMTP setup
 */
adminRouter.post('/test-email', async (req, res) => {
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
 * Resend Email from Log
 */
adminRouter.post('/email-logs/:id/resend', async (req, res) => {
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

