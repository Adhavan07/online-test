import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma.js';
import { getJwtSecret, AuthUser } from './auth.js';
import jwt from 'jsonwebtoken';

export interface AssessmentAttemptRequest extends Request {
  attempt?: any;
  user?: AuthUser;
}

/**
 * Extract assessment authorization token from header, query, or body
 */
function extractAssessmentToken(req: Request): string | null {
  const customHeader = req.headers['x-assessment-token'];
  if (typeof customHeader === 'string' && customHeader.trim()) {
    return customHeader.trim();
  }

  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const bearer = authHeader.split(' ')[1]?.trim();
    if (bearer) return bearer;
  }

  if (req.query?.token && typeof req.query.token === 'string') {
    return req.query.token.trim();
  }

  if (req.body?.token && typeof req.body.token === 'string') {
    return req.body.token.trim();
  }

  return null;
}

/**
 * Anti-IDOR Middleware: Verifies that caller is authorized to access the specific attemptId
 */
export async function requireAttemptAccess(
  req: AssessmentAttemptRequest,
  res: Response,
  next: NextFunction
) {
  const attemptId = req.params.attemptId || req.body?.attemptId;

  if (!attemptId) {
    return res.status(400).json({ success: false, error: 'attemptId is required' });
  }

  try {
    const attempt = await prisma.assessmentAttempt.findUnique({
      where: { id: attemptId },
      include: {
        application: {
          include: {
            job: {
              include: {
                company: true,
                assessmentTemplate: true,
              }
            }
          }
        },
        result: true,
      }
    });

    if (!attempt) {
      return res.status(404).json({ success: false, error: 'Assessment attempt not found.' });
    }

    // Check 1: Authenticated Recruiter or Admin belonging to the tenant
    const authUser = (req as any).user;
    if (authUser) {
      const isSuperAdmin = authUser.role === 'ADMIN' && !authUser.companyId;
      const isCompanyMatch = authUser.companyId && authUser.companyId === attempt.application.job.companyId;
      if (isSuperAdmin || isCompanyMatch) {
        req.attempt = attempt;
        return next();
      }
    }

    // Check 2: Matching Candidate Token
    const candidateToken = extractAssessmentToken(req);
    if (candidateToken && candidateToken === attempt.application.token) {
      req.attempt = attempt;
      return next();
    }

    // Check 3: Signed JWT session token
    if (candidateToken) {
      try {
        const secret = getJwtSecret();
        const decoded: any = jwt.verify(candidateToken, secret);
        if (decoded && (decoded.attemptId === attempt.id || decoded.token === attempt.application.token)) {
          req.attempt = attempt;
          return next();
        }
      } catch {}
    }

    return res.status(403).json({
      success: false,
      error: 'Access denied: You are not authorized to view or interact with this candidate assessment.'
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * Enforce that attempt is active (not already completed and not expired)
 */
export async function requireActiveAttempt(
  req: AssessmentAttemptRequest,
  res: Response,
  next: NextFunction
) {
  const attempt = req.attempt;
  if (!attempt) {
    return res.status(400).json({ success: false, error: 'Attempt context missing.' });
  }

  if (attempt.isCompleted) {
    return res.status(400).json({
      success: false,
      error: 'Assessment has already been completed and submitted.'
    });
  }

  const template = attempt.application?.job?.assessmentTemplate;
  if (template?.durationMinutes) {
    // Duration + 5 min grace window for network latency
    const maxDurationMs = (template.durationMinutes + 5) * 60 * 1000;
    const elapsedMs = Date.now() - new Date(attempt.startedAt).getTime();
    if (elapsedMs > maxDurationMs) {
      await prisma.assessmentAttempt.update({
        where: { id: attempt.id },
        data: { isCompleted: true, submittedAt: new Date() }
      });
      return res.status(400).json({
        success: false,
        error: 'Assessment duration limit has expired. Submissions are closed.'
      });
    }
  }

  next();
}
