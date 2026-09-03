import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { prisma } from '../lib/prisma.js';
import { EmailService } from '../services/EmailService.js';

export const candidatesRouter = Router();

// Configure Multer for Resume File Uploads
const uploadDir = path.join(process.cwd(), 'uploads', 'resumes');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `resume-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (_req, file, cb) => {
    const allowedExts = ['.pdf', '.docx', '.doc'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedExts.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF and DOCX files are allowed.'));
    }
  }
});

/**
 * List Candidate Applications with filters
 */
candidatesRouter.get('/', async (req, res) => {
  const { jobId, status, search } = req.query;

  try {
    const whereClause: any = {};
    if (jobId) whereClause.jobId = String(jobId);
    if (status && status !== 'ALL') whereClause.status = String(status);

    if (search) {
      whereClause.candidate = {
        OR: [
          { name: { contains: String(search) } },
          { email: { contains: String(search) } },
        ]
      };
    }

    const applications = await prisma.jobApplication.findMany({
      where: whereClause,
      include: {
        candidate: true,
        job: {
          include: { company: true }
        },
        attempts: {
          orderBy: { startedAt: 'desc' },
          take: 1,
          include: { result: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const formatted = applications.map(app => {
      const latestAttempt = app.attempts[0];
      const result = latestAttempt?.result;

      return {
        applicationId: app.id,
        candidateId: app.candidate.id,
        name: app.candidate.name,
        email: app.candidate.email,
        phone: app.candidate.phone,
        resumeUrl: app.candidate.resumeUrl,
        resumeFileName: app.candidate.resumeFileName,
        jobId: app.jobId,
        jobTitle: app.job.title,
        status: app.status,
        token: app.token,
        tokenExpiresAt: app.tokenExpiresAt,
        scorePercentage: result ? result.percentage : null,
        isPassed: result ? result.isPassed : null,
        appliedAt: app.createdAt,
      };
    });

    res.json({ success: true, candidates: formatted });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Candidate Detail view for Recruiter Inspection
 */
candidatesRouter.get('/detail/:applicationId', async (req, res) => {
  const { applicationId } = req.params;

  try {
    const application = await prisma.jobApplication.findUnique({
      where: { id: applicationId },
      include: {
        candidate: true,
        job: {
          include: {
            assessmentTemplate: true
          }
        },
        attempts: {
          orderBy: { startedAt: 'desc' },
          include: {
            result: true,
            answers: true,
          }
        }
      }
    });

    if (!application) {
      return res.status(404).json({ success: false, error: 'Candidate application not found' });
    }

    const latestAttempt = application.attempts[0] || null;
    const result = latestAttempt?.result || null;
    const sectionScores = result ? JSON.parse(result.sectionScoresJson || '{}') : {};

    // Build timeline of events
    const timeline = [
      { event: 'Candidate Applied', timestamp: application.createdAt },
      { event: 'Assessment Invited', timestamp: application.createdAt },
    ];

    if (application.isOtpVerified) {
      timeline.push({ event: 'OTP Verification Passed', timestamp: application.createdAt });
    }

    if (latestAttempt) {
      timeline.push({ event: 'Assessment Started', timestamp: latestAttempt.startedAt });
      if (latestAttempt.submittedAt) {
        timeline.push({ event: 'Assessment Submitted', timestamp: latestAttempt.submittedAt });
        timeline.push({ event: `Evaluation Completed (${result?.isPassed ? 'PASSED' : 'FAILED'})`, timestamp: result?.evaluatedAt || latestAttempt.submittedAt });
      }
    }

    res.json({
      success: true,
      detail: {
        applicationId: application.id,
        candidate: {
          name: application.candidate.name,
          email: application.candidate.email,
          phone: application.candidate.phone,
          resumeUrl: application.candidate.resumeUrl,
          resumeFileName: application.candidate.resumeFileName,
        },
        job: {
          title: application.job.title,
          passThreshold: application.job.passThreshold,
        },
        status: application.status,
        token: application.token,
        assessmentSummary: latestAttempt ? {
          attemptId: latestAttempt.id,
          startedAt: latestAttempt.startedAt,
          submittedAt: latestAttempt.submittedAt,
          durationMinutes: latestAttempt.submittedAt
            ? Math.round((new Date(latestAttempt.submittedAt).getTime() - new Date(latestAttempt.startedAt).getTime()) / 60000)
            : null,
          totalScore: result?.totalScore ?? null,
          maxScore: result?.maxScore ?? null,
          percentage: result?.percentage ?? null,
          isPassed: result?.isPassed ?? null,
          sectionScores,
        } : null,
        timeline,
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Register Candidate & Apply for Job (with Resume Upload)
 */
candidatesRouter.post('/apply', upload.single('resume'), async (req, res) => {
  const { name, email, phone, jobId } = req.body;
  const file = req.file;

  try {
    if (!name || !email || !jobId) {
      return res.status(400).json({ success: false, error: 'Name, email, and jobId are required.' });
    }

    let candidate = await prisma.candidate.findUnique({ where: { email } });

    if (!candidate) {
      candidate = await prisma.candidate.create({
        data: {
          name,
          email,
          phone: phone || null,
          resumeUrl: file ? `/uploads/resumes/${file.filename}` : null,
          resumeFileName: file ? file.originalname : null,
        }
      });
    } else if (file) {
      candidate = await prisma.candidate.update({
        where: { id: candidate.id },
        data: {
          resumeUrl: `/uploads/resumes/${file.filename}`,
          resumeFileName: file.originalname,
        }
      });
    }

    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job) return res.status(404).json({ success: false, error: 'Job not found' });

    // Generate unique cryptographically secure assessment token
    const token = `cand-${Math.random().toString(36).substr(2, 9)}-${Date.now().toString(36)}`;
    const tokenExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const application = await prisma.jobApplication.create({
      data: {
        candidateId: candidate.id,
        jobId: job.id,
        status: 'INVITED',
        token,
        tokenExpiresAt,
      }
    });

    const protocol = req.protocol;
    const host = req.get('host') || 'localhost:3000';
    const baseUrl = `${protocol}://${host.replace(':5000', ':3000')}`;

    // Send invitation email
    await EmailService.sendInvitation(candidate.name, candidate.email, job.title, token, baseUrl);

    res.json({
      success: true,
      message: 'Application received and assessment invitation generated!',
      applicationId: application.id,
      token,
      testUrl: `${baseUrl}/assessment/${token}`
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Recruiter Action: Update Application Status (SHORTLISTED, HR_INTERVIEW, REJECTED)
 */
candidatesRouter.patch('/:applicationId/status', async (req, res) => {
  const { applicationId } = req.params;
  const { status } = req.body;

  try {
    const application = await prisma.jobApplication.update({
      where: { id: applicationId },
      data: { status },
      include: { candidate: true, job: true }
    });

    await prisma.auditLog.create({
      data: {
        action: 'CANDIDATE_STATUS_UPDATED',
        entity: 'JobApplication',
        details: `Updated candidate ${application.candidate.name} status to ${status} for job ${application.job.title}.`,
      }
    });

    res.json({ success: true, application });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Resend Invitation Email to Candidate
 */
candidatesRouter.post('/:applicationId/resend-invite', async (req, res) => {
  const { applicationId } = req.params;

  try {
    const application = await prisma.jobApplication.findUnique({
      where: { id: applicationId },
      include: { candidate: true, job: true }
    });

    if (!application) return res.status(404).json({ success: false, error: 'Application not found' });

    const host = req.get('host') || 'localhost:3000';
    const baseUrl = `http://${host.replace(':5000', ':3000')}`;

    await EmailService.sendInvitation(
      application.candidate.name,
      application.candidate.email,
      application.job.title,
      application.token,
      baseUrl
    );

    res.json({ success: true, message: `Invitation email resent to ${application.candidate.email}` });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});
