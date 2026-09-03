import { Router } from 'express';
import { AssessmentEngine } from '../services/AssessmentEngine.js';

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
 * Fetch Current Question at index
 */
assessmentRouter.get('/question/:attemptId', async (req, res) => {
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
 * Submit Answer for active question (60-second timer locked)
 */
assessmentRouter.post('/submit-answer', async (req, res) => {
  const { attemptId, questionId, selectedOptionIds, timeSpentSeconds } = req.body;
  try {
    const response = await AssessmentEngine.submitAnswer(attemptId, questionId, selectedOptionIds || [], timeSpentSeconds || 0);
    res.json({ success: true, ...response });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * Force Complete Assessment & Execute Auto-Evaluation
 */
assessmentRouter.post('/finish', async (req, res) => {
  const { attemptId } = req.body;
  try {
    const result = await AssessmentEngine.evaluateAssessment(attemptId);
    res.json({ success: true, result });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});
