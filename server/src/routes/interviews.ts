import { Router } from 'express';
import { prisma } from '../lib/prisma.js';

export const interviewsRouter = Router();

/**
 * Create Live Pair-Coding Interview Room
 */
interviewsRouter.post('/create-room', async (req, res) => {
  const { applicationId, interviewerName } = req.body;

  if (!applicationId) {
    return res.status(400).json({ success: false, error: 'applicationId is required' });
  }

  try {
    const application = await prisma.jobApplication.findUnique({
      where: { id: applicationId },
      include: { candidate: true, job: true }
    });

    if (!application) {
      return res.status(404).json({ success: false, error: 'Application not found' });
    }

    const roomToken = `ROOM-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;

    const starterCode = `/**\n * Live Technical Interview Session\n * Candidate: ${application.candidate.name}\n * Role: ${application.job.title}\n */\n\nfunction solution(input) {\n  // Collaborate on live code here\n  console.log("Hello from live sandbox!");
  return true;\n}\n\n// Run solution\nsolution();\n`;

    const session = await prisma.liveInterviewSession.create({
      data: {
        applicationId,
        roomToken,
        interviewerName: interviewerName || 'Tech Lead',
        status: 'IN_PROGRESS',
        codeBuffer: starterCode,
        sharedNotes: `Live Interview Notes for ${application.candidate.name}:\n- Architectural design discussion\n- Live coding exercise`,
      }
    });

    // Also update application status to HR_INTERVIEW if not set
    await prisma.jobApplication.update({
      where: { id: applicationId },
      data: {
        status: 'HR_INTERVIEW',
        interviewLink: `/interview/${roomToken}`,
      }
    });

    res.json({
      success: true,
      roomToken,
      interviewUrl: `/interview/${roomToken}`,
      session,
    });

  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Fetch Live Interview Session details
 */
interviewsRouter.get('/:roomToken', async (req, res) => {
  const { roomToken } = req.params;

  try {
    const session = await prisma.liveInterviewSession.findUnique({
      where: { roomToken },
      include: {
        application: {
          include: {
            candidate: true,
            job: true,
            attempts: {
              include: { result: true },
              take: 1,
              orderBy: { startedAt: 'desc' },
            }
          }
        }
      }
    });

    if (!session) {
      return res.status(404).json({ success: false, error: 'Interview room not found' });
    }

    res.json({
      success: true,
      session,
    });

  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Update Live Pair-Coding Session (Code buffer, shared notes, rating, status)
 */
interviewsRouter.post('/:roomToken/update', async (req, res) => {
  const { roomToken } = req.params;
  const { codeBuffer, sharedNotes, interviewerRating, feedbackSummary, status } = req.body;

  try {
    const session = await prisma.liveInterviewSession.findUnique({
      where: { roomToken }
    });

    if (!session) {
      return res.status(404).json({ success: false, error: 'Interview room not found' });
    }

    const updated = await prisma.liveInterviewSession.update({
      where: { roomToken },
      data: {
        ...(codeBuffer !== undefined && { codeBuffer }),
        ...(sharedNotes !== undefined && { sharedNotes }),
        ...(interviewerRating !== undefined && { interviewerRating }),
        ...(feedbackSummary !== undefined && { feedbackSummary }),
        ...(status !== undefined && { status }),
      }
    });

    res.json({
      success: true,
      session: updated,
    });

  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});
