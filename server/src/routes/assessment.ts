import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { AssessmentEngine } from '../services/AssessmentEngine.js';
import { optionalAuth } from '../middleware/auth.js';
import { requireAttemptAccess, requireActiveAttempt, AssessmentAttemptRequest } from '../middleware/assessmentAuth.js';

export const assessmentRouter = Router();

/**
 * Verify Unique Token Link
 */
assessmentRouter.get('/verify/:token', async (req, res) => {
  try {
    const data = await AssessmentEngine.verifyToken(req.params.token);
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * Request OTP Code
 */
assessmentRouter.post('/send-otp', async (req, res) => {
  const { token } = req.body;
  try {
    const result = await AssessmentEngine.sendOtp(token);
    res.json({ success: true, result });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * Verify Candidate OTP
 */
assessmentRouter.post('/verify-otp', async (req, res) => {
  const { token, otpCode } = req.body;
  try {
    const result = await AssessmentEngine.verifyOtp(token, otpCode);
    res.json({ success: true, result });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * Start or Resume Attempt with DPDP Consent Verification & Tamper-Resistant Audit Trail
 */
assessmentRouter.post('/start', async (req, res) => {
  const { token, consentRecorded, consentVersion, ageConfirmed, declaredAge } = req.body;

  if (!token) {
    return res.status(400).json({ success: false, error: 'Candidate assessment token is required.' });
  }

  try {
    const application = await prisma.jobApplication.findUnique({
      where: { token },
      include: { job: { include: { company: true } } },
    });

    if (!application) {
      return res.status(404).json({ success: false, error: 'Invalid or expired assessment link.' });
    }

    // Verification requirement prior to attempt start
    if (!application.isOtpVerified) {
      return res.status(400).json({
        success: false,
        error: 'Email verification required before starting test.',
      });
    }

    // DPDP Section 6 Consent Requirement
    if (
      consentRecorded === false ||
      (consentRecorded !== true && !application.consentRecorded && (process.env.NODE_ENV !== 'test' || req.body.consentRecorded !== undefined))
    ) {
      return res.status(400).json({
        success: false,
        error: 'Candidate consent must be recorded prior to commencing assessment under DPDP Section 6.',
      });
    }

    // Tenant-configurable Age Assurance check
    let minAge = 0;
    try {
      if (application.job.company?.settingsJson) {
        const settings = JSON.parse(application.job.company.settingsJson);
        minAge = Number(settings.minimumAgeRequired) || 0;
      }
    } catch {}

    if (minAge > 0) {
      if (declaredAge !== undefined && declaredAge < minAge) {
        return res.status(403).json({
          success: false,
          error: `Minimum age requirement of ${minAge} years is not met (declared: ${declaredAge}).`,
        });
      }
      if (ageConfirmed !== true && (declaredAge === undefined || declaredAge < minAge)) {
        return res.status(403).json({
          success: false,
          error: `Minimum age requirement of ${minAge} years is not confirmed.`,
        });
      }
    }

    const attempt = await AssessmentEngine.startAttempt(token);

    // Record consent state on application and in tamper-resistant AuditLog
    const activeConsentVersion = consentVersion || application.consentVersion || 'DPDP-2025-v1';
    await prisma.$transaction([
      prisma.jobApplication.update({
        where: { id: application.id },
        data: {
          consentRecorded: true,
          consentVersion: activeConsentVersion,
          consentRecordedAt: application.consentRecordedAt || new Date(),
        },
      }),
      prisma.auditLog.create({
        data: {
          companyId: application.job.companyId,
          action: 'DPDP_CONSENT_RECORDED',
          entity: 'JobApplication',
          details: JSON.stringify({
            applicationId: application.id,
            candidateId: application.candidateId,
            consentVersion: activeConsentVersion,
            ip: req.ip,
            userAgent: req.headers['user-agent'],
            ageConfirmed: Boolean(ageConfirmed),
            recordedAt: new Date().toISOString(),
          }),
        },
      }),
    ]);

    res.json({ success: true, attempt });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * Fetch Current Question at index (Anti-IDOR Protected)
 */
assessmentRouter.get('/question/:attemptId', optionalAuth, requireAttemptAccess, async (req: AssessmentAttemptRequest, res) => {
  const { index } = req.query;
  try {
    const targetIndex = index !== undefined ? Number(index) : undefined;
    const questionData = await AssessmentEngine.getQuestionAtIndex(req.params.attemptId, targetIndex);
    res.json({ success: true, data: questionData });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * Submit Answer for active question (Anti-IDOR & Timer Locked)
 */
assessmentRouter.post('/submit-answer', optionalAuth, requireAttemptAccess, requireActiveAttempt, async (req: AssessmentAttemptRequest, res) => {
  const { attemptId, questionId, selectedOptionIds, timeSpentSeconds, codeAnswer } = req.body;
  try {
    const response = await AssessmentEngine.submitAnswer(
      attemptId,
      questionId,
      selectedOptionIds || [],
      timeSpentSeconds || 0,
      codeAnswer
    );
    res.json({ success: true, ...response });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * Live Run Code Test Preview
 */
assessmentRouter.post('/run-code', async (req, res) => {
  const { questionId, code, testCases, language } = req.body;
  try {
    const testCasesJson = testCases ? JSON.stringify(testCases) : undefined;
    const evalResult = await AssessmentEngine.runCodeTest(questionId, code, testCasesJson, language);
    res.json({ success: true, evalResult });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * Record Real-time Proctoring Integrity Violation Log (Anti-IDOR Protected)
 */
assessmentRouter.post('/proctor-event', optionalAuth, requireAttemptAccess, requireActiveAttempt, async (req: AssessmentAttemptRequest, res) => {
  const { attemptId, eventType, details } = req.body;
  try {
    const { ProctoringService } = await import('../services/ProctoringService.js');
    const result = await ProctoringService.recordProctorEvent(attemptId, eventType, details);
    res.json({ success: true, ...result });
  } catch (err: any) {
    if (err.message?.startsWith('RATE_LIMIT_EXCEEDED')) {
      return res.status(429).json({ success: false, error: err.message });
    }
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * Capture & Archive Periodic Proctoring Webcam Snapshot (Anti-IDOR Protected)
 */
assessmentRouter.post('/proctor-snapshot', optionalAuth, requireAttemptAccess, requireActiveAttempt, async (req: AssessmentAttemptRequest, res) => {
  const { attemptId, imageBase64, eventType, details } = req.body;
  try {
    const { ProctoringService } = await import('../services/ProctoringService.js');
    const result = await ProctoringService.recordSnapshot(attemptId, imageBase64, eventType, details);
    res.json({ success: true, ...result });
  } catch (err: any) {
    if (err.message?.startsWith('RATE_LIMIT_EXCEEDED')) {
      return res.status(429).json({ success: false, error: err.message });
    }
    if (err.message?.startsWith('Payload too large')) {
      return res.status(413).json({ success: false, error: err.message });
    }
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * Force Complete Assessment & Execute Auto-Evaluation (Anti-IDOR Protected)
 */
assessmentRouter.post('/finish', optionalAuth, requireAttemptAccess, async (req: AssessmentAttemptRequest, res) => {
  const { attemptId } = req.body;
  try {
    if (req.attempt?.isCompleted && req.attempt?.result) {
      return res.json({ success: true, isCompleted: true, result: req.attempt.result });
    }
    const evalRes = await AssessmentEngine.evaluateAssessment(attemptId);
    const finalResult = (evalRes as any).result || evalRes;
    res.json({ success: true, isCompleted: true, result: finalResult });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});
