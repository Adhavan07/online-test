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
 * Submit Answer for active question (60-second or coding timer locked)
 */
assessmentRouter.post('/submit-answer', async (req, res) => {
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
 * Record Real-time Proctoring Integrity Violation Log
 */
assessmentRouter.post('/proctor-event', async (req, res) => {
  const { attemptId, eventType, details } = req.body;
  try {
    const { prisma } = await import('../lib/prisma.js');
    const log = await prisma.proctoringLog.create({
      data: {
        attemptId,
        eventType,
        details,
      }
    });

    // Update counters on attempt
    if (eventType === 'FOCUS_LOST') {
      await prisma.assessmentAttempt.update({
        where: { id: attemptId },
        data: { tabSwitchCount: { increment: 1 } }
      });
    } else if (eventType === 'FULLSCREEN_EXIT') {
      await prisma.assessmentAttempt.update({
        where: { id: attemptId },
        data: { fullscreenViolationCount: { increment: 1 } }
      });
    } else if (eventType === 'SCREEN_SHARE_STOPPED') {
      await prisma.assessmentAttempt.update({
        where: { id: attemptId },
        data: { screenShareStopCount: { increment: 1 } }
      });
    } else if (eventType === 'CAMERA_DISABLED') {
      await prisma.assessmentAttempt.update({
        where: { id: attemptId },
        data: { cameraDisconnectCount: { increment: 1 } }
      });
    }

    res.json({ success: true, log });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * Capture & Archive Periodic Proctoring Webcam Snapshot
 */
assessmentRouter.post('/proctor-snapshot', async (req, res) => {
  const { attemptId, imageBase64, eventType, details } = req.body;
  try {
    if (!attemptId || !imageBase64) {
      return res.status(400).json({ success: false, error: 'attemptId and imageBase64 are required.' });
    }

    const { prisma } = await import('../lib/prisma.js');
    const { storageService } = await import('../services/StorageService.js');

    // Strip header if data URL format (e.g. data:image/jpeg;base64,...)
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    const filename = `snapshot-${attemptId.substring(0, 8)}-${Date.now()}.jpg`;

    const stored = await storageService.saveBuffer(buffer, filename, 'proctoring');

    const log = await prisma.proctoringLog.create({
      data: {
        attemptId,
        eventType: eventType || 'WEBCAM_SNAPSHOT',
        details: JSON.stringify({
          snapshotUrl: stored.publicUrl,
          reason: details || 'Periodic proctoring verification',
          sizeBytes: stored.sizeBytes,
        }),
      }
    });

    res.json({ success: true, log, snapshotUrl: stored.publicUrl });
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
    const evalRes = await AssessmentEngine.evaluateAssessment(attemptId);
    const finalResult = (evalRes as any).result || evalRes;
    res.json({ success: true, isCompleted: true, result: finalResult });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});
