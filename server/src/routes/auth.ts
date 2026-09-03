import { Router } from 'express';
import { prisma } from '../lib/prisma.js';

export const authRouter = Router();

/**
 * Get current demo session users or active role switch
 */
authRouter.get('/users', async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      include: { company: true }
    });
    res.json({ success: true, users });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Mock login/role verification
 */
authRouter.post('/login', async (req, res) => {
  const { email, role } = req.body;
  try {
    const user = await prisma.user.findFirst({
      where: { email }
    });

    if (!user) {
      return res.status(404).json({ success: false, error: 'User account not found' });
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        companyId: user.companyId
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});
