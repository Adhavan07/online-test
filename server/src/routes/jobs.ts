import { Router } from 'express';
import { prisma } from '../lib/prisma.js';

export const jobsRouter = Router();

/**
 * List all job openings with application statistics
 */
jobsRouter.get('/', async (req, res) => {
  try {
    const jobs = await prisma.job.findMany({
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
 * Create a new Job Opening
 */
jobsRouter.post('/', async (req, res) => {
  const { title, experienceRange, location, skillsRequired, description, passThreshold, assessmentTemplateId, companyId } = req.body;

  try {
    // Default to first company if not provided
    const targetCompanyId = companyId || (await prisma.company.findFirst())?.id;
    if (!targetCompanyId) throw new Error('No company found');

    const newJob = await prisma.job.create({
      data: {
        title,
        experienceRange,
        location,
        skillsRequired: JSON.stringify(skillsRequired || []),
        description,
        passThreshold: Number(passThreshold) || 70,
        assessmentTemplateId: assessmentTemplateId || null,
        companyId: targetCompanyId,
      }
    });

    await prisma.auditLog.create({
      data: {
        action: 'JOB_CREATED',
        entity: 'Job',
        details: `Created new job: ${title} with ${passThreshold}% pass threshold.`,
      }
    });

    res.json({ success: true, job: newJob });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});
