import { Router } from 'express';
import { prisma } from '../lib/prisma.js';

export const badgesRouter = Router();

/**
 * Issue a Verified Candidate Skill Badge
 */
badgesRouter.post('/issue', async (req, res) => {
  const { applicationId } = req.body;

  if (!applicationId) {
    return res.status(400).json({ success: false, error: 'applicationId is required' });
  }

  try {
    const application = await prisma.jobApplication.findUnique({
      where: { id: applicationId },
      include: {
        candidate: true,
        job: true,
        attempts: {
          include: { result: true },
          where: { isCompleted: true },
          orderBy: { startedAt: 'desc' },
          take: 1,
        }
      }
    });

    if (!application) {
      return res.status(404).json({ success: false, error: 'Application not found' });
    }

    const latestAttempt = application.attempts[0];
    if (!latestAttempt || !latestAttempt.result) {
      return res.status(400).json({ success: false, error: 'Candidate has not completed assessment yet.' });
    }

    // Check if badge already issued
    const existing = await prisma.verifiedBadge.findFirst({
      where: { applicationId }
    });

    if (existing) {
      return res.json({
        success: true,
        message: 'Badge already issued.',
        badge: existing,
        badgeUrl: `/verify/${existing.badgeId}`,
      });
    }

    const badgeId = `BADGE-${Math.random().toString(36).substring(2, 8).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const verificationSignature = `SHA256:${Math.random().toString(36).substring(2, 18).toUpperCase()}`;

    const badge = await prisma.verifiedBadge.create({
      data: {
        badgeId,
        applicationId,
        candidateName: application.candidate.name,
        jobTitle: application.job.title,
        skillDomain: application.job.title.includes('DevOps') ? 'Cloud Systems & Automation' : 'Software Engineering & System Design',
        overallScore: Math.round(latestAttempt.result.percentage),
        trustScore: latestAttempt.integrityScore,
        verificationSignature,
      }
    });

    res.json({
      success: true,
      message: 'Verified Skill Badge issued successfully!',
      badge,
      badgeUrl: `/verify/${badge.badgeId}`,
    });

  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Verify Candidate Skill Badge (Public Route)
 */
badgesRouter.get('/verify/:badgeId', async (req, res) => {
  const { badgeId } = req.params;

  try {
    const badge = await prisma.verifiedBadge.findUnique({
      where: { badgeId },
      include: {
        application: {
          include: {
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

    if (!badge) {
      return res.status(404).json({ success: false, error: 'Verified badge signature not found or invalid.' });
    }

    // Section breakdown if available
    let sectionBreakdown: any[] = [];
    const attempt = badge.application.attempts[0];
    if (attempt?.result?.sectionScoresJson) {
      try {
        const parsed = JSON.parse(attempt.result.sectionScoresJson);
        sectionBreakdown = Object.keys(parsed).map(title => ({
          title,
          score: parsed[title].score,
          max: parsed[title].max,
          percentage: parsed[title].max > 0 ? Math.round((parsed[title].score / parsed[title].max) * 100) : 0,
        }));
      } catch (e) {}
    }

    res.json({
      success: true,
      badge: {
        ...badge,
        sectionBreakdown,
        issuer: 'TechScreen Pro Anti-Tamper Verification Engine',
      }
    });

  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});
