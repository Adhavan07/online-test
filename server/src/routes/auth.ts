import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma.js';
import { authenticateToken, requireRole, AuthenticatedRequest, getJwtSecret } from '../middleware/auth.js';
import { verifyPassword, hashPassword } from '../lib/crypto.js';

import { createRateLimiter } from '../middleware/rateLimit.js';

export const authRouter = Router();

const loginRateLimiter = createRateLimiter({
  windowMs: 60000,
  max: 10,
  message: 'Too many login attempts. Please wait 1 minute before trying again.'
});

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Get available workspace users for authenticated recruiters/admins
 */
authRouter.get('/users', authenticateToken, requireRole(['ADMIN', 'RECRUITER']), async (req: AuthenticatedRequest, res) => {
  try {
    const isSuperAdmin = req.user?.role === 'ADMIN' || req.user?.role === 'HR_ADMIN';
    const where = isSuperAdmin && !req.user?.companyId ? {} : { companyId: req.user?.companyId || undefined };

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        companyId: true,
        createdAt: true,
        company: {
          select: { id: true, name: true, logoUrl: true }
        }
      },
      orderBy: { createdAt: 'asc' }
    });
    res.json({ success: true, users });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Enterprise Login with Credential Verification & JWT Token Issuance
 * Enforces database-stored roles; strictly rejects client-supplied role claims.
 */
authRouter.post('/login', loginRateLimiter, async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, error: 'Email and password are required.' });
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  if (!EMAIL_REGEX.test(normalizedEmail)) {
    return res.status(400).json({ success: false, error: 'Invalid email address format.' });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: { company: true }
    });

    if (!user) {
      return res.status(401).json({ success: false, error: 'Invalid email or password.' });
    }

    if (!user.passwordHash || !verifyPassword(String(password), user.passwordHash)) {
      return res.status(401).json({ success: false, error: 'Invalid email or password.' });
    }

    const tokenPayload = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role, // Authoritative role from trusted database record
      companyId: user.companyId
    };

    const secret = getJwtSecret();
    const expiresIn = (process.env.JWT_EXPIRES_IN || '8h') as any;
    const token = jwt.sign(tokenPayload, secret, { expiresIn });

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        companyId: user.companyId,
        company: user.company ? {
          id: user.company.id,
          name: user.company.name,
          logoUrl: user.company.logoUrl,
        } : null,
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Get Authenticated Session Profile
 */
authRouter.get('/me', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: { company: true }
    });

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        companyId: user.companyId,
        company: user.company ? {
          id: user.company.id,
          name: user.company.name,
          logoUrl: user.company.logoUrl,
        } : null,
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * List Team Members for Active Company Workspace
 */
authRouter.get('/team', authenticateToken, requireRole(['ADMIN', 'RECRUITER']), async (req: AuthenticatedRequest, res) => {
  try {
    const companyId = req.user?.companyId;
    const members = await prisma.user.findMany({
      where: companyId ? { companyId } : {},
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        companyId: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' }
    });

    res.json({ success: true, members });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Invite / Add Team Member to Workspace (ADMIN / RECRUITER)
 */
authRouter.post('/team/invite', authenticateToken, requireRole(['ADMIN', 'RECRUITER']), async (req: AuthenticatedRequest, res) => {
  const { name, email, role, password } = req.body;
  try {
    if (!name || !email || !role) {
      return res.status(400).json({ success: false, error: 'Name, email, and role are required.' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    if (!EMAIL_REGEX.test(normalizedEmail)) {
      return res.status(400).json({ success: false, error: 'Invalid email address format.' });
    }

    const ALLOWED_ROLES = ['ADMIN', 'RECRUITER', 'HR_ADMIN', 'TECH_INTERVIEWER'];
    const normalizedRole = String(role).trim().toUpperCase();
    if (!ALLOWED_ROLES.includes(normalizedRole)) {
      return res.status(400).json({ success: false, error: `Invalid role: ${role}. Allowed roles: ${ALLOWED_ROLES.join(', ')}` });
    }

    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) {
      return res.status(400).json({ success: false, error: 'User with this email already exists in workspace.' });
    }

    const defaultPassword = password || 'Welcome@2026';
    const member = await prisma.user.create({
      data: {
        name: String(name).trim(),
        email: normalizedEmail,
        passwordHash: hashPassword(defaultPassword),
        role: String(role).toUpperCase(),
        companyId: req.user?.companyId || null,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        companyId: true,
        createdAt: true,
      }
    });

    res.json({ success: true, member });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Update Workspace Branding / Settings (ADMIN / HR_ADMIN)
 */
authRouter.patch('/workspace', authenticateToken, requireRole(['ADMIN', 'HR_ADMIN']), async (req: AuthenticatedRequest, res) => {
  const { name, logoUrl } = req.body;
  try {
    if (!req.user?.companyId) {
      return res.status(400).json({ success: false, error: 'User does not belong to a company workspace.' });
    }

    const company = await prisma.company.update({
      where: { id: req.user.companyId },
      data: {
        ...(name ? { name: String(name).trim() } : {}),
        ...(logoUrl !== undefined ? { logoUrl: String(logoUrl).trim() } : {}),
      }
    });

    res.json({ success: true, company });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});
