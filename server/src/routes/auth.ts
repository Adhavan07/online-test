import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma.js';
import { authenticateToken, requireRole, AuthenticatedRequest } from '../middleware/auth.js';

export const authRouter = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'techscreen-enterprise-secret-change-in-prod-2026';

/**
 * Get available workspace users or demo sessions
 */
authRouter.get('/users', async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      include: { company: true },
      orderBy: { createdAt: 'asc' }
    });
    res.json({ success: true, users });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Enterprise Login & JWT Token Issuance
 */
authRouter.post('/login', async (req, res) => {
  const { email, role } = req.body;
  try {
    let user = await prisma.user.findFirst({
      where: { email },
      include: { company: true }
    });

    if (!user) {
      // Find or create default enterprise company
      let company = await prisma.company.findFirst();
      if (!company) {
        company = await prisma.company.create({
          data: {
            name: 'Acme Enterprise Technologies',
            logoUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=120&q=80',
          }
        });
      }

      user = await prisma.user.create({
        data: {
          email,
          name: email.split('@')[0].replace('.', ' ').replace(/^./, (str: string) => str.toUpperCase()),
          role: role || 'HR_ADMIN',
          companyId: company.id,
        },
        include: { company: true }
      });
    }

    // Generate real cryptographic JWT
    const tokenPayload = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      companyId: user.companyId
    };

    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        companyId: user.companyId,
        company: user.company
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
        company: user.company
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * List Team Members for Active Company Workspace
 */
authRouter.get('/team', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const companyId = req.user?.companyId;
    const members = await prisma.user.findMany({
      where: companyId ? { companyId } : {},
      orderBy: { createdAt: 'asc' }
    });

    res.json({ success: true, members });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Invite / Add Team Member to Workspace (HR_ADMIN / RECRUITER)
 */
authRouter.post('/team/invite', authenticateToken, requireRole(['HR_ADMIN', 'RECRUITER']), async (req: AuthenticatedRequest, res) => {
  const { name, email, role } = req.body;
  try {
    if (!name || !email || !role) {
      return res.status(400).json({ success: false, error: 'Name, email, and role are required.' });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(400).json({ success: false, error: 'User with this email already exists in workspace.' });
    }

    const member = await prisma.user.create({
      data: {
        name,
        email,
        role,
        companyId: req.user?.companyId || null,
      }
    });

    res.json({ success: true, member });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Update Workspace Branding / Settings (HR_ADMIN)
 */
authRouter.patch('/workspace', authenticateToken, requireRole(['HR_ADMIN']), async (req: AuthenticatedRequest, res) => {
  const { name, logoUrl } = req.body;
  try {
    if (!req.user?.companyId) {
      return res.status(400).json({ success: false, error: 'User does not belong to a company workspace.' });
    }

    const company = await prisma.company.update({
      where: { id: req.user.companyId },
      data: {
        ...(name ? { name } : {}),
        ...(logoUrl !== undefined ? { logoUrl } : {}),
      }
    });

    res.json({ success: true, company });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});
