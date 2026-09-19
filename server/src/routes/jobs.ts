import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticateToken, requireRole, AuthenticatedRequest } from '../middleware/auth.js';

export const jobsRouter = Router();

/**
 * List all job openings with application statistics (Authenticated & Scoped)
 */
jobsRouter.get('/', authenticateToken, requireRole(['RECRUITER', 'HR_ADMIN', 'ADMIN', 'TECH_INTERVIEWER']), async (req: AuthenticatedRequest, res) => {
  try {
    const isSuperAdmin = req.user?.role === 'ADMIN' && !req.user?.companyId;
    const where = isSuperAdmin ? {} : { companyId: req.user?.companyId || undefined };

    const jobs = await prisma.job.findMany({
      where,
      include: {
        company: true,
        assessmentTemplate: true,
        applications: {
          include: {
            attempts: {
              include: { result: true }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const formatted = jobs.map(j => {
      const totalApps = j.applications.length;
      const completed = j.applications.filter(a => ['PASSED', 'FAILED', 'SHORTLISTED', 'HR_INTERVIEW', 'REJECTED'].includes(a.status)).length;
      const passed = j.applications.filter(a => ['PASSED', 'SHORTLISTED', 'HR_INTERVIEW'].includes(a.status)).length;
      const shortlisted = j.applications.filter(a => ['SHORTLISTED', 'HR_INTERVIEW'].includes(a.status)).length;
      const rejected = j.applications.filter(a => a.status === 'REJECTED').length;
      const pending = totalApps - completed;

      return {
        id: j.id,
        title: j.title,
        experienceRange: j.experienceRange,
        location: j.location,
        skillsRequired: JSON.parse(j.skillsRequired || '[]'),
        description: j.description,
        passThreshold: j.passThreshold,
        companyName: j.company.name,
        assessmentTemplate: j.assessmentTemplate ? {
          id: j.assessmentTemplate.id,
          title: j.assessmentTemplate.title,
          roleCategory: j.assessmentTemplate.roleCategory,
          totalQuestions: j.assessmentTemplate.totalQuestions,
        } : null,
        stats: {
          totalApps,
          completed,
          passed,
          shortlisted,
          rejected,
          pending,
        },
        createdAt: j.createdAt,
      };
    });

    res.json({ success: true, jobs: formatted });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Create a new Job Opening (RECRUITER / ADMIN / HR_ADMIN)
 */
jobsRouter.post('/', authenticateToken, requireRole(['RECRUITER', 'HR_ADMIN', 'ADMIN']), async (req: AuthenticatedRequest, res) => {
  const { title, experienceRange, location, skillsRequired, description, passThreshold, assessmentTemplateId } = req.body;

  if (!title || typeof title !== 'string' || title.trim().length < 2) {
    return res.status(400).json({ success: false, error: 'Job title must be at least 2 characters long.' });
  }

  let validatedThreshold = 70;
  if (passThreshold !== undefined) {
    const num = Number(passThreshold);
    if (isNaN(num) || num < 1 || num > 100) {
      return res.status(400).json({ success: false, error: 'passThreshold must be an integer between 1 and 100.' });
    }
    validatedThreshold = Math.round(num);
  }

  try {
    const targetCompanyId = req.user?.companyId || (await prisma.company.findFirst())?.id;
    if (!targetCompanyId) {
      return res.status(400).json({ success: false, error: 'No associated company found for user.' });
    }

    const newJob = await prisma.job.create({
      data: {
        title: String(title).trim().substring(0, 150),
        experienceRange: experienceRange ? String(experienceRange).trim().substring(0, 50) : '0-2 years',
        location: location ? String(location).trim().substring(0, 100) : 'Remote',
        skillsRequired: JSON.stringify(Array.isArray(skillsRequired) ? skillsRequired : []),
        description: description ? String(description).trim().substring(0, 10000) : '',
        passThreshold: validatedThreshold,
        assessmentTemplateId: assessmentTemplateId || null,
        companyId: targetCompanyId,
      }
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user?.id,
        userName: req.user?.name,
        action: 'JOB_CREATED',
        entity: 'Job',
        details: `Created new job: ${title} with ${passThreshold || 70}% pass threshold.`,
      }
    });

    res.json({ success: true, job: newJob });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});
