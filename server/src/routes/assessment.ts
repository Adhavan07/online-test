import { Router } from 'express';
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
 * Start or Resume Attempt
 */
assessmentRouter.post('/start', async (req, res) => {
  const { token } = req.body;
  try {
    const attempt = await AssessmentEngine.startAttempt(token);
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
