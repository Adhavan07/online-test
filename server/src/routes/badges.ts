import { Router } from 'express';
import crypto from 'crypto';
import { prisma } from '../lib/prisma.js';
import { authenticateToken, requireRole, AuthenticatedRequest, getJwtSecret } from '../middleware/auth.js';

export const badgesRouter = Router();

/**
 * Issue a Verified Candidate Skill Badge (RECRUITER / ADMIN ONLY)
 */
badgesRouter.post('/issue', authenticateToken, requireRole(['RECRUITER', 'ADMIN']), async (req: AuthenticatedRequest, res) => {
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

    const isSuperAdmin = req.user?.role === 'ADMIN' && !req.user?.companyId;
    if (!isSuperAdmin && req.user?.companyId && application.job.companyId !== req.user.companyId) {
      return res.status(403).json({ success: false, error: 'Forbidden: You do not own this application.' });
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

    const badgeSuffix = crypto.randomBytes(4).toString('hex').toUpperCase();
    const badgeId = `BADGE-${badgeSuffix}-${Math.floor(1000 + Math.random() * 9000)}`;
    const secret = getJwtSecret();
    const verificationSignature = `SHA256:${crypto.createHmac('sha256', secret).update(`${badgeId}:${application.id}:${latestAttempt.result.percentage}`).digest('hex')}`;

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
 * Verify Candidate Skill Badge (Public Route - Sanitized Verification View)
 */
badgesRouter.get('/verify/:badgeId', async (req, res) => {
  const { badgeId } = req.params;

  try {
    const badge = await prisma.verifiedBadge.findUnique({
      where: { badgeId },
      include: {
        application: {
          select: {
            id: true,
            job: {
              select: {
                id: true,
                title: true,
                company: { select: { name: true, logoUrl: true } }
              }
            },
            attempts: {
              select: {
                integrityScore: true,
                result: {
                  select: {
                    percentage: true,
                    sectionScoresJson: true,
                    isPassed: true,
                  }
                }
              },
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
        id: badge.id,
        badgeId: badge.badgeId,
        candidateName: badge.candidateName,
        jobTitle: badge.jobTitle,
        skillDomain: badge.skillDomain,
        overallScore: badge.overallScore,
        trustScore: badge.trustScore,
        verificationSignature: badge.verificationSignature,
        issuedAt: badge.issuedAt,
        companyName: badge.application.job.company.name,
        companyLogo: badge.application.job.company.logoUrl,
        sectionBreakdown,
        issuer: 'TechScreen Pro Anti-Tamper Verification Engine',
      }
    });

  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});
