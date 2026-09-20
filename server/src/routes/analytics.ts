import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticateToken, requireRole, AuthenticatedRequest } from '../middleware/auth.js';

export const analyticsRouter = Router();

// Protect ALL analytics routes with authenticated recruiter/admin RBAC
analyticsRouter.use(authenticateToken, requireRole(['RECRUITER', 'ADMIN', 'TECH_INTERVIEWER']));

/**
 * Get Executive Hiring Funnel & Platform Analytics (Scoped to User's Company)
 */
analyticsRouter.get('/funnel', async (req: AuthenticatedRequest, res) => {
  try {
    const isSuperAdmin = req.user?.role === 'ADMIN' && !req.user?.companyId;
    const companyFilter = isSuperAdmin ? {} : { job: { companyId: req.user?.companyId || undefined } };

    const totalApplications = await prisma.jobApplication.count({
      where: companyFilter
    });
    const invitedCount = await prisma.jobApplication.count({
      where: { ...companyFilter, status: 'INVITED' }
    });
    const completedAttempts = await prisma.assessmentAttempt.findMany({
      where: {
        isCompleted: true,
        ...(isSuperAdmin ? {} : { application: { job: { companyId: req.user?.companyId || undefined } } })
      },
      include: { result: true }
    });

    const completedCount = completedAttempts.length;
    const passedCount = completedAttempts.filter(a => a.result?.isPassed).length;
    const hrStageCount = await prisma.jobApplication.count({
      where: {
        ...companyFilter,
        status: { in: ['HR_INTERVIEW', 'SHORTLISTED'] }
      }
    });

    // Calculate Average Completion Time
    let totalMinutes = 0;
    let validDurationCount = 0;
    completedAttempts.forEach(att => {
      if (att.startedAt && att.submittedAt) {
        const diffMs = new Date(att.submittedAt).getTime() - new Date(att.startedAt).getTime();
        totalMinutes += diffMs / (1000 * 60);
        validDurationCount++;
      }
    });
    const avgDurationMinutes = validDurationCount > 0 ? Math.round((totalMinutes / validDurationCount) * 10) / 10 : 0;

    // Aggregate Proctoring Stats
    let totalTabSwitches = 0;
    let totalFullscreenExits = 0;
    let sumIntegrityScore = 0;

    completedAttempts.forEach(att => {
      totalTabSwitches += att.tabSwitchCount || 0;
      totalFullscreenExits += att.fullscreenViolationCount || 0;
      sumIntegrityScore += att.integrityScore || 100;
    });

    const avgIntegrityScore = completedCount > 0 ? Math.round(sumIntegrityScore / completedCount) : 100;

    // Aggregate Skill Radar Breakdown
    const skillTotals: Record<string, { totalScore: number; totalMax: number }> = {};

    completedAttempts.forEach(att => {
      if (att.result?.sectionScoresJson) {
        try {
          const breakdown = JSON.parse(att.result.sectionScoresJson);
          Object.keys(breakdown).forEach(secTitle => {
            if (!skillTotals[secTitle]) {
              skillTotals[secTitle] = { totalScore: 0, totalMax: 0 };
            }
            skillTotals[secTitle].totalScore += breakdown[secTitle].score || 0;
            skillTotals[secTitle].totalMax += breakdown[secTitle].max || 0;
          });
        } catch {
          // Ignore JSON parse errors if any
        }
      }
    });

    const skillAverages = Object.keys(skillTotals).map(skillName => {
      const { totalScore, totalMax } = skillTotals[skillName];
      const percentage = totalMax > 0 ? Math.round((totalScore / totalMax) * 100) : 0;
      return { skill: skillName, percentage };
    });

    res.json({
      success: true,
      metrics: {
        totalApplications,
        invitedCount,
        completedCount,
        passedCount,
        hrStageCount,
        passRate: completedCount > 0 ? Math.round((passedCount / completedCount) * 100) : 0,
        avgDurationMinutes,
        proctoring: {
          totalTabSwitches,
          totalFullscreenExits,
          avgIntegrityScore,
        },
        skillAverages,
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Generate AI Candidate Performance Summary & Risk Insights (Scoped & Authorized)
 */
analyticsRouter.get('/candidates/:applicationId/ai-insights', async (req: AuthenticatedRequest, res) => {
  const { applicationId } = req.params;

  try {
    const isSuperAdmin = req.user?.role === 'ADMIN' && !req.user?.companyId;
    const application = await prisma.jobApplication.findUnique({
      where: { id: applicationId },
      include: {
        candidate: true,
        job: true,
        attempts: {
          include: {
            result: true,
            answers: true,
            proctoringLogs: true,
          },
          orderBy: { startedAt: 'desc' },
          take: 1,
        }
      }
    });

    if (!application) {
      return res.status(404).json({ success: false, error: 'Application not found' });
    }

    if (!isSuperAdmin && req.user?.companyId && application.job.companyId !== req.user.companyId) {
      return res.status(403).json({ success: false, error: 'Forbidden: You do not have access to this application.' });
    }

    const latestAttempt = application.attempts[0];
    if (!latestAttempt || !latestAttempt.result) {
      return res.json({
        success: true,
        hasAssessment: false,
        message: 'Candidate has not completed assessment yet.'
      });
    }

    const result = latestAttempt.result;
    const scorePct = Math.round(result.percentage);
    const trustScore = latestAttempt.integrityScore;

    // Parse section breakdown
    let sectionBreakdown: any[] = [];
    if (result.sectionScoresJson) {
      try {
        const parsed = JSON.parse(result.sectionScoresJson);
        sectionBreakdown = Object.keys(parsed).map(title => ({
          title,
          score: parsed[title].score,
          max: parsed[title].max,
          percentage: parsed[title].max > 0 ? Math.round((parsed[title].score / parsed[title].max) * 100) : 0,
        }));
      } catch {}
    }

    // Determine strengths & weaknesses
    const strengths = sectionBreakdown
      .filter(s => s.percentage >= 70)
      .map(s => s.title);

    const weaknesses = sectionBreakdown
      .filter(s => s.percentage < 70)
      .map(s => s.title);

    // Dynamic AI Executive Summary & Risk Rating
    let recommendation: 'STRONG_PASS' | 'PASS_WITH_RESERVATION' | 'FAIL' = 'FAIL';
    let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
    let summaryText = '';

    if (scorePct >= 80 && trustScore >= 90) {
      recommendation = 'STRONG_PASS';
      riskLevel = 'LOW';
      summaryText = `${application.candidate.name} demonstrated exceptional technical proficiency (${scorePct}%) with pristine proctoring integrity (${trustScore}% trust score). Strong candidate for ${application.job.title}.`;
    } else if (scorePct >= application.job.passThreshold && trustScore >= 75) {
      recommendation = 'PASS_WITH_RESERVATION';
      riskLevel = trustScore < 85 ? 'MEDIUM' : 'LOW';
      summaryText = `${application.candidate.name} passed the technical cutoff (${scorePct}% vs ${application.job.passThreshold}% target) with acceptable proctoring log compliance (${trustScore}%).`;
    } else if (trustScore < 70) {
      recommendation = 'FAIL';
      riskLevel = 'HIGH';
      summaryText = `High proctoring risk detected for ${application.candidate.name} (Trust Score: ${trustScore}% due to repeated tab switches/fullscreen exits). Technical score was ${scorePct}%.`;
    } else {
      recommendation = 'FAIL';
      riskLevel = 'LOW';
      summaryText = `${application.candidate.name} scored ${scorePct}%, falling short of the job pass threshold (${application.job.passThreshold}%).`;
    }

    res.json({
      success: true,
      hasAssessment: true,
      aiInsights: {
        scorePercentage: scorePct,
        integrityScore: trustScore,
        recommendation,
        riskLevel,
        summaryText,
        strengths,
        weaknesses,
        sectionBreakdown,
        proctoringLogCount: latestAttempt.proctoringLogs.length,
        codingScore: result.codingScore,
        codingMaxScore: result.codingMaxScore,
      }
    });

  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});
