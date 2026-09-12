import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { prisma } from '../lib/prisma.js';
import { ResumeMatchingService } from '../services/ResumeMatchingService.js';
import { EmailService } from '../services/EmailService.js';
import { NotificationService } from '../services/NotificationService.js';
import { storageService } from '../services/StorageService.js';

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

    const formatted = await Promise.all(applications.map(async (app) => {
      const latestAttempt = app.attempts[0];
      const result = latestAttempt?.result;

      // Extract skills & match if not yet saved
      let jobSkills: string[] = [];
      try {
        jobSkills = JSON.parse(app.job.skillsRequired || '[]');
      } catch {
        jobSkills = ['Git', 'Linux', 'Docker', 'Kubernetes', 'CI/CD'];
      }

      let resumeMatchScore = app.resumeMatchScore;
      let matchedSkills: string[] = [];
      if (app.resumeParsedSkills) {
        try {
          matchedSkills = JSON.parse(app.resumeParsedSkills);
        } catch {}
      }

      if ((resumeMatchScore === null || resumeMatchScore === undefined || resumeMatchScore === 0) && app.candidate.resumeUrl) {
        const fullPath = storageService.resolveLocalPath(app.candidate.resumeUrl);
        if (fs.existsSync(fullPath)) {
          try {
            const evalRes = await ResumeMatchingService.parseAndEvaluateResumeFile(
              fullPath,
              jobSkills,
              app.candidate.name
            );
            if (evalRes.matchScore > 0 || evalRes.matchedSkills.length > 0) {
              resumeMatchScore = evalRes.matchScore;
              matchedSkills = evalRes.matchedSkills;
              await prisma.jobApplication.update({
                where: { id: app.id },
                data: {
                  resumeMatchScore: evalRes.matchScore,
                  resumeParsedSkills: JSON.stringify(evalRes.matchedSkills),
                }
              }).catch(() => {});
            }
          } catch {}
        }
      }

      if (resumeMatchScore === null || resumeMatchScore === undefined) {
        const evalRes = ResumeMatchingService.evaluateResumeMatch(
          `${app.candidate.name} ${app.candidate.resumeFileName || ''}`,
          jobSkills
        );
        resumeMatchScore = evalRes.matchScore;
        matchedSkills = evalRes.matchedSkills;
      }

      const techScore = result ? Math.round(result.percentage) : null;
      const riskScore = latestAttempt?.proctoringRiskScore ?? (latestAttempt ? Math.max(0, 100 - latestAttempt.integrityScore) : 0);
      const riskLevel = latestAttempt?.proctoringRiskLevel || (riskScore >= 61 ? 'HIGH' : riskScore >= 31 ? 'MEDIUM' : 'LOW');

      let rankingScore = app.rankingScore;
      let recommendation = app.recommendation;

      if (rankingScore === null || rankingScore === undefined) {
        const rank = ResumeMatchingService.calculateCandidateRanking({
          technicalScore: techScore,
          resumeMatchScore: resumeMatchScore ?? 0,
          proctoringRiskScore: riskScore,
          passThreshold: app.job.passThreshold,
          currentStatus: app.status,
        });
        rankingScore = rank.rankingScore;
        recommendation = rank.recommendation;
      }

      return {
        id: app.id,
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
        scorePercentage: techScore,
        isPassed: result ? result.isPassed : null,
        proctoringRisk: riskLevel,
        proctoringRiskScore: riskScore,
        resumeMatchScore: resumeMatchScore !== null && resumeMatchScore !== undefined ? Math.round(resumeMatchScore) : null,
        matchedSkills,
        rankingScore: rankingScore !== null && rankingScore !== undefined ? Math.round(rankingScore * 10) / 10 : null,
        recommendation,
        createdAt: app.createdAt,
        appliedAt: app.createdAt,
        job: {
          id: app.job.id,
          title: app.job.title,
          location: app.job.location,
          experienceRange: app.job.experienceRange,
          passThreshold: app.job.passThreshold,
          skillsRequired: jobSkills,
        },
        attempts: app.attempts.map(att => ({
          id: att.id,
          integrityScore: att.integrityScore,
          proctoringRiskScore: att.proctoringRiskScore,
          proctoringRiskLevel: att.proctoringRiskLevel,
          tabSwitchCount: att.tabSwitchCount,
          fullscreenViolationCount: att.fullscreenViolationCount,
          screenShareStopCount: att.screenShareStopCount,
          cameraDisconnectCount: att.cameraDisconnectCount,
          result: att.result ? {
            score: att.result.totalScore,
            totalPossible: att.result.maxScore,
            percentage: Math.round(att.result.percentage),
            isPassed: att.result.isPassed,
            integrityScore: att.result.integrityScore,
            proctoringRiskLevel: att.result.proctoringRiskLevel || (att.result.integrityScore < 60 ? 'HIGH' : att.result.integrityScore < 85 ? 'MEDIUM' : 'LOW'),
            proctoringRiskScore: att.result.proctoringRiskScore,
          } : null,
        }))
      };
    }));

    res.json({ success: true, candidates: formatted });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Candidate Detail view for Recruiter Inspection (Includes Proctoring & Coding Submissions)
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
            proctoringLogs: {
              orderBy: { timestamp: 'asc' }
            }
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

    // Retrieve submitted coding answers
    let codeSubmissions: Array<{ questionPrompt: string; codeAnswer: string; sectionTitle?: string }> = [];
    if (latestAttempt && latestAttempt.answers.length > 0) {
      const codeAnswersList = latestAttempt.answers.filter(a => a.codeAnswer && a.codeAnswer.trim().length > 0);
      for (const ca of codeAnswersList) {
        const q = await prisma.question.findUnique({ where: { id: ca.questionId }, include: { section: true } });
        if (q) {
          codeSubmissions.push({
            questionPrompt: q.prompt,
            codeAnswer: ca.codeAnswer || '',
            sectionTitle: q.section?.title,
          });
        }
      }
    }

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
      
      for (const pLog of latestAttempt.proctoringLogs) {
        timeline.push({
          event: `Proctoring Alert: ${pLog.eventType.replace('_', ' ')}`,
          timestamp: pLog.timestamp,
        });
      }

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
        resumeMatch: await (async () => {
          let jobSkills: string[] = [];
          try {
            jobSkills = JSON.parse(application.job.skillsRequired || '[]');
          } catch {
            jobSkills = ['Git', 'Linux', 'Docker', 'Kubernetes', 'CI/CD'];
          }

          let matchedSkills: string[] = [];
          let candidateSkills: string[] = [];
          let matchScore = application.resumeMatchScore;
          let experienceYears: number | null = null;

          if (application.resumeParsedSkills) {
            try { matchedSkills = JSON.parse(application.resumeParsedSkills); } catch {}
          }

          // If resume file exists on disk, deeply parse for full extracted details
          if (application.candidate.resumeUrl) {
            const fullPath = path.join(process.cwd(), application.candidate.resumeUrl.replace(/^\//, ''));
            if (fs.existsSync(fullPath)) {
              try {
                const evalRes = await ResumeMatchingService.parseAndEvaluateResumeFile(
                  fullPath,
                  jobSkills,
                  application.candidate.name
                );
                matchScore = evalRes.matchScore;
                matchedSkills = evalRes.matchedSkills;
                candidateSkills = evalRes.candidateSkills;
                experienceYears = evalRes.experienceYears ?? null;

                if (application.resumeMatchScore !== evalRes.matchScore) {
                  await prisma.jobApplication.update({
                    where: { id: application.id },
                    data: {
                      resumeMatchScore: evalRes.matchScore,
                      resumeParsedSkills: JSON.stringify(evalRes.matchedSkills),
                    }
                  });
                }
              } catch {}
            }
          }

          if (matchScore === null || matchScore === undefined) {
            const evalRes = ResumeMatchingService.evaluateResumeMatch(
              `${application.candidate.name} ${application.candidate.resumeFileName || ''}`,
              jobSkills
            );
            matchScore = evalRes.matchScore;
            matchedSkills = evalRes.matchedSkills;
            candidateSkills = evalRes.candidateSkills;
          }

          const missingSkills = jobSkills.filter(js => !matchedSkills.some(ms => ms.toLowerCase() === js.toLowerCase()));
          const riskScore = latestAttempt?.proctoringRiskScore ?? (latestAttempt ? Math.max(0, 100 - latestAttempt.integrityScore) : 0);
          const techScore = result ? Math.round(result.percentage) : null;
          const rank = ResumeMatchingService.calculateCandidateRanking({
            technicalScore: techScore,
            resumeMatchScore: matchScore ?? 0,
            proctoringRiskScore: riskScore,
            passThreshold: application.job.passThreshold,
            currentStatus: application.status,
          });

          return {
            matchScore: matchScore ?? 0,
            matchedSkills,
            missingSkills,
            candidateSkills,
            experienceYears,
            rankingScore: application.rankingScore ?? rank.rankingScore,
            recommendation: application.recommendation ?? rank.recommendation,
            recommendationLabel: rank.recommendationLabel,
          };
        })(),
        proctorLogs: latestAttempt ? latestAttempt.proctoringLogs : [],
        assessmentSummary: latestAttempt ? {
          attemptId: latestAttempt.id,
          startedAt: latestAttempt.startedAt,
          submittedAt: latestAttempt.submittedAt,
          durationMinutes: latestAttempt.submittedAt
            ? Math.round((new Date(latestAttempt.submittedAt).getTime() - new Date(latestAttempt.startedAt).getTime()) / 60000)
            : null,
          totalScore: result?.totalScore ?? null,
          score: result?.totalScore ?? null,
          maxScore: result?.maxScore ?? null,
          totalPossible: result?.maxScore ?? null,
          percentage: result?.percentage ?? null,
          scorePercentage: result?.percentage ?? null,
          integrityScore: latestAttempt.integrityScore,
          proctoringRiskScore: latestAttempt.proctoringRiskScore ?? Math.max(0, 100 - latestAttempt.integrityScore),
          tabSwitchCount: latestAttempt.tabSwitchCount,
          fullscreenViolationCount: latestAttempt.fullscreenViolationCount,
          screenShareStopCount: latestAttempt.screenShareStopCount,
          cameraDisconnectCount: latestAttempt.cameraDisconnectCount,
          isPassed: result?.isPassed ?? null,
          passed: result?.isPassed ?? null,
          riskLevel: latestAttempt.proctoringRiskLevel || (latestAttempt.integrityScore < 60 ? 'HIGH' : latestAttempt.integrityScore < 85 ? 'MEDIUM' : 'LOW'),
          sectionScores,
          sectionResults: Object.entries(sectionScores).map(([title, val]: [string, any]) => ({
            title,
            correct: val.score,
            total: val.max,
            percentage: Math.round(((val.score || 0) / (val.max || 1)) * 100),
          })),
          proctoringLogs: latestAttempt.proctoringLogs,
          proctorLogs: latestAttempt.proctoringLogs,
          codeSubmissions,
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

    // Dispatch in-app notification
    await NotificationService.createNotification({
      type: 'INVITATION_SENT',
      title: 'Assessment Invitation Dispatched',
      message: `Invitation sent to ${candidate.name} (${candidate.email}) for ${job.title}`,
      candidateName: candidate.name,
      candidateId: candidate.id,
      jobTitle: job.title,
      link: `/assessment/${token}`,
    });

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
 * Recruiter Action: Bulk CSV Candidate Invitation Dispatcher
 */
candidatesRouter.post('/bulk-invite', async (req, res) => {
  const { jobId, candidates } = req.body;

  if (!jobId || !Array.isArray(candidates) || candidates.length === 0) {
    return res.status(400).json({ success: false, error: 'jobId and candidate array are required.' });
  }

  try {
    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job) return res.status(404).json({ success: false, error: 'Job opening not found' });

    const host = req.get('host') || 'localhost:3000';
    const baseUrl = `http://${host.replace(':5000', ':3000')}`;
    const invitedList = [];

    for (const item of candidates) {
      if (!item.email || !item.name) continue;

      let cand = await prisma.candidate.findUnique({ where: { email: item.email } });
      if (!cand) {
        cand = await prisma.candidate.create({
          data: {
            name: item.name,
            email: item.email,
            phone: item.phone || null,
          }
        });
      }

      const token = `cand-${Math.random().toString(36).substr(2, 9)}-${Date.now().toString(36)}`;
      const tokenExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      const app = await prisma.jobApplication.create({
        data: {
          candidateId: cand.id,
          jobId: job.id,
          status: 'INVITED',
          token,
          tokenExpiresAt,
        }
      });

      await EmailService.sendInvitation(cand.name, cand.email, job.title, token, baseUrl);
      invitedList.push({ name: cand.name, email: cand.email, token });
    }

    await prisma.auditLog.create({
      data: {
        action: 'BULK_INVITATION_SENT',
        entity: 'JobApplication',
        details: `Dispatched bulk assessment invites to ${invitedList.length} candidates for job ${job.title}.`,
      }
    });

    res.json({
      success: true,
      message: `Successfully sent ${invitedList.length} candidate assessment invitations!`,
      invitedCount: invitedList.length,
      invitedList,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Recruiter Action: Export Candidates Roster as CSV File
 */
candidatesRouter.get('/export-csv', async (req, res) => {
  try {
    const applications = await prisma.jobApplication.findMany({
      include: {
        candidate: true,
        job: true,
        attempts: {
          orderBy: { startedAt: 'desc' },
          take: 1,
          include: { result: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    let csvContent = 'Application ID,Candidate Name,Email,Phone,Job Title,Status,Score (%),Integrity Score (%),Result,Invited Date\n';

    for (const app of applications) {
      const latestAttempt = app.attempts[0];
      const result = latestAttempt?.result;

      const row = [
        `"${app.id}"`,
        `"${app.candidate.name}"`,
        `"${app.candidate.email}"`,
        `"${app.candidate.phone || 'N/A'}"`,
        `"${app.job.title}"`,
        `"${app.status}"`,
        `"${result ? result.percentage : 'N/A'}"`,
        `"${latestAttempt ? latestAttempt.integrityScore : '100'}"`,
        `"${result ? (result.isPassed ? 'PASSED' : 'FAILED') : 'PENDING'}"`,
        `"${app.createdAt.toISOString()}"`,
      ].join(',');

      csvContent += row + '\n';
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="techscreen_candidates_report.csv"');
    res.send(csvContent);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Recruiter Action: Update Application Status (SHORTLISTED, HR_INTERVIEW, REJECTED, etc.)
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

    // If candidate status is updated to REJECTED, dispatch polite rejection email
    if (status === 'REJECTED') {
      await EmailService.sendRejectionEmail(
        application.candidate.name,
        application.candidate.email,
        application.job.title
      );
      await NotificationService.createNotification({
        type: 'TEST_FAILED',
        title: 'Candidate Application Rejected',
        message: `${application.candidate.name} was rejected for ${application.job.title}. Polite notification email sent.`,
        candidateName: application.candidate.name,
        candidateId: application.candidate.id,
        jobTitle: application.job.title,
      });
    } else if (status === 'SHORTLISTED') {
      await NotificationService.createNotification({
        type: 'TEST_PASSED',
        title: 'Candidate Shortlisted',
        message: `${application.candidate.name} has been shortlisted for ${application.job.title}.`,
        candidateName: application.candidate.name,
        candidateId: application.candidate.id,
        jobTitle: application.job.title,
      });
    } else if (status === 'HR_INTERVIEW') {
      await NotificationService.createNotification({
        type: 'INTERVIEW_SCHEDULED',
        title: 'Moved to HR Interview',
        message: `${application.candidate.name} advanced to HR Interview for ${application.job.title}.`,
        candidateName: application.candidate.name,
        candidateId: application.candidate.id,
        jobTitle: application.job.title,
      });
    }

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

/**
 * Recruiter Action: Re-parse uploaded PDF resume and re-evaluate skill match
 */
candidatesRouter.post('/:applicationId/reparse-resume', async (req, res) => {
  const { applicationId } = req.params;

  try {
    const application = await prisma.jobApplication.findUnique({
      where: { id: applicationId },
      include: {
        candidate: true,
        job: true,
        attempts: {
          include: { result: true },
          orderBy: { startedAt: 'desc' },
          take: 1,
        }
      }
    });

    if (!application) return res.status(404).json({ success: false, error: 'Application not found' });
    if (!application.candidate.resumeUrl) {
      return res.status(400).json({ success: false, error: 'Candidate has no uploaded resume file.' });
    }

    let jobSkills: string[] = [];
    try {
      jobSkills = JSON.parse(application.job.skillsRequired || '[]');
    } catch {
      jobSkills = ['Git', 'Linux', 'Docker', 'Kubernetes', 'CI/CD'];
    }

    const fullPath = storageService.resolveLocalPath(application.candidate.resumeUrl);
    const evalRes = await ResumeMatchingService.parseAndEvaluateResumeFile(
      fullPath,
      jobSkills,
      application.candidate.name
    );

    const latestAttempt = application.attempts[0];
    const techScore = latestAttempt?.result ? Math.round(latestAttempt.result.percentage) : null;
    const riskScore = latestAttempt?.proctoringRiskScore ?? (latestAttempt ? Math.max(0, 100 - latestAttempt.integrityScore) : 0);

    const ranking = ResumeMatchingService.calculateCandidateRanking({
      technicalScore: techScore,
      resumeMatchScore: evalRes.matchScore,
      proctoringRiskScore: riskScore,
      passThreshold: application.job.passThreshold,
      currentStatus: application.status,
    });

    const updated = await prisma.jobApplication.update({
      where: { id: applicationId },
      data: {
        resumeMatchScore: evalRes.matchScore,
        resumeParsedSkills: JSON.stringify(evalRes.matchedSkills),
        rankingScore: ranking.rankingScore,
        recommendation: ranking.recommendation,
      },
      include: { candidate: true, job: true }
    });

    res.json({
      success: true,
      message: `Resume parsed successfully! Match score: ${evalRes.matchScore}%`,
      matchScore: evalRes.matchScore,
      matchedSkills: evalRes.matchedSkills,
      missingSkills: evalRes.missingSkills,
      allExtractedSkills: evalRes.candidateSkills,
      experienceYears: evalRes.experienceYears,
      rankingScore: ranking.rankingScore,
      recommendation: ranking.recommendation,
      recommendationLabel: ranking.recommendationLabel,
      application: updated,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Get Team Recruiter Notes for Application
 */
candidatesRouter.get('/:applicationId/notes', async (req, res) => {
  const { applicationId } = req.params;

  try {
    const notes = await prisma.recruiterNote.findMany({
      where: { applicationId },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, notes });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Add Recruiter Team Note & Star Rating
 */
candidatesRouter.post('/:applicationId/notes', async (req, res) => {
  const { applicationId } = req.params;
  const { authorName, rating, comment } = req.body;

  try {
    if (!comment || !comment.trim()) {
      return res.status(400).json({ success: false, error: 'Note comment is required' });
    }

    const note = await prisma.recruiterNote.create({
      data: {
        applicationId,
        authorName: authorName || 'Hiring Recruiter',
        rating: rating || 5,
        comment,
      }
    });

    res.json({ success: true, note });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Recruiter Action: Reset Assessment Attempt (Allow Candidate Retake)
 */
candidatesRouter.post('/:applicationId/reset-attempt', async (req, res) => {
  const { applicationId } = req.params;

  try {
    const application = await prisma.jobApplication.findUnique({
      where: { id: applicationId },
      include: { candidate: true, job: true }
    });

    if (!application) return res.status(404).json({ success: false, error: 'Application not found' });

    // Generate new token & extend expiration
    const newToken = `cand-${Math.random().toString(36).substr(2, 9)}-${Date.now().toString(36)}`;
    const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await prisma.jobApplication.update({
      where: { id: applicationId },
      data: {
        status: 'INVITED',
        token: newToken,
        tokenExpiresAt: newExpiresAt,
      }
    });

    await prisma.auditLog.create({
      data: {
        action: 'ASSESSMENT_RETEST_GRANTED',
        entity: 'JobApplication',
        details: `Granted retake permission to candidate ${application.candidate.name} for job ${application.job.title}.`,
      }
    });

    const host = req.get('host') || 'localhost:3000';
    const baseUrl = `http://${host.replace(':5000', ':3000')}`;

    await EmailService.sendInvitation(
      application.candidate.name,
      application.candidate.email,
      application.job.title,
      newToken,
      baseUrl
    );

    res.json({ success: true, message: `Assessment reset successfully. Retake link dispatched to ${application.candidate.email}` });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Recruiter Action: Schedule HR Interview & Send Invitation
 */
candidatesRouter.post('/:applicationId/schedule-interview', async (req, res) => {
  const { applicationId } = req.params;
  const { interviewScheduledAt, interviewLink } = req.body;

  try {
    if (!interviewScheduledAt) {
      return res.status(400).json({ success: false, error: 'interviewScheduledAt date is required' });
    }

    const application = await prisma.jobApplication.update({
      where: { id: applicationId },
      data: {
        status: 'HR_INTERVIEW',
        interviewScheduledAt: new Date(interviewScheduledAt),
        interviewLink: interviewLink || 'https://meet.google.com/techscreen-hr-interview',
      },
      include: { candidate: true, job: true }
    });

    const scheduledDateStr = new Date(interviewScheduledAt).toLocaleString();
    const meetingUrl = application.interviewLink || 'https://meet.google.com/techscreen-hr-interview';

    // Dispatch real email via EmailService
    await EmailService.sendInterviewInvite(
      application.candidate.name,
      application.candidate.email,
      application.job.title,
      scheduledDateStr,
      meetingUrl
    );

    await NotificationService.createNotification({
      type: 'INTERVIEW_SCHEDULED',
      title: '📅 HR Interview Scheduled',
      message: `Interview with ${application.candidate.name} scheduled for ${scheduledDateStr}`,
      candidateName: application.candidate.name,
      candidateId: application.candidate.id,
      jobTitle: application.job.title,
    });

    await prisma.auditLog.create({
      data: {
        action: 'HR_INTERVIEW_SCHEDULED',
        entity: 'JobApplication',
        details: `Scheduled HR interview for candidate ${application.candidate.name} on ${scheduledDateStr}`,
      }
    });

    res.json({ success: true, application, message: 'HR Interview scheduled and candidate notified via email.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});
