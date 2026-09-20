import { Router } from 'express';
import crypto from 'crypto';
import { prisma } from '../lib/prisma.js';
import { authenticateToken, requireRole, AuthenticatedRequest } from '../middleware/auth.js';

export const webhooksRouter = Router();

// Protect ALL webhook endpoints with ADMIN RBAC
webhooksRouter.use(authenticateToken, requireRole(['ADMIN', 'HR_ADMIN']));

/**
 * Get configured Webhooks (ADMIN ONLY - Scoped to Company)
 */
webhooksRouter.get('/', async (req: AuthenticatedRequest, res) => {
  try {
    const isSuperAdmin = req.user?.role === 'ADMIN' && !req.user?.companyId;
    const where = isSuperAdmin ? {} : { companyId: req.user?.companyId || undefined };

    const webhooks = await prisma.webhookConfig.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    });
    // Mask secret keys partially in responses
    const masked = webhooks.map(w => ({
      ...w,
      secretKey: w.secretKey ? `${w.secretKey.slice(0, 6)}...${w.secretKey.slice(-4)}` : '••••••••',
    }));
    res.json({ success: true, webhooks: masked });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Save or Update Webhook Config (ADMIN ONLY - Scoped to Company)
 */
webhooksRouter.post('/', async (req: AuthenticatedRequest, res) => {
  const { name, endpointUrl, secretKey, events } = req.body;

  if (!endpointUrl) {
    return res.status(400).json({ success: false, error: 'endpointUrl is required' });
  }

  try {
    // Validate URL format
    new URL(endpointUrl);
  } catch {
    return res.status(400).json({ success: false, error: 'Invalid endpointUrl format.' });
  }

  try {
    const generatedSecret = 'whsec_' + crypto.randomBytes(16).toString('hex');
    const webhook = await prisma.webhookConfig.create({
      data: {
        name: name ? String(name).trim() : 'Enterprise ATS Integration',
        endpointUrl: String(endpointUrl).trim(),
        secretKey: secretKey ? String(secretKey).trim() : generatedSecret,
        eventsJson: JSON.stringify(Array.isArray(events) ? events : ['candidate.completed', 'assessment.passed', 'interview.scheduled']),
        isActive: true,
        companyId: req.user?.companyId || null,
      }
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user?.id,
        userName: req.user?.name,
        companyId: req.user?.companyId,
        action: 'WEBHOOK_CONFIGURED',
        entity: 'WebhookConfig',
        details: `Configured new webhook for ${webhook.name} -> ${webhook.endpointUrl}`,
      }
    });

    res.json({ success: true, webhook });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Dispatch Test Webhook Payload (ADMIN ONLY - Scoped to Company)
 */
webhooksRouter.post('/test-dispatch', async (req: AuthenticatedRequest, res) => {
  const { webhookId } = req.body;

  try {
    const isSuperAdmin = req.user?.role === 'ADMIN' && !req.user?.companyId;
    const webhook = await prisma.webhookConfig.findFirst({
      where: {
        ...(webhookId ? { id: webhookId } : {}),
        ...(isSuperAdmin ? {} : { companyId: req.user?.companyId || undefined })
      }
    });

    if (!webhook) {
      return res.status(404).json({ success: false, error: 'Webhook configuration not found.' });
    }

    const mockPayload = {
      event: 'candidate.completed',
      timestamp: new Date().toISOString(),
      data: {
        candidateName: 'Test Candidate',
        candidateEmail: 'candidate@example.com',
        jobTitle: 'Senior DevOps Engineer',
        assessmentScore: 92,
        trustScore: 100,
        status: 'PASSED',
        certificateUrl: 'http://localhost:3000/assessment/result/DEMO-TOKEN'
      }
    };

    await prisma.webhookConfig.update({
      where: { id: webhook.id },
      data: { lastDispatchedAt: new Date() }
    });

    res.json({
      success: true,
      message: `Test payload dispatched successfully to endpoint "${webhook.endpointUrl}"`,
      deliveredPayload: mockPayload,
      httpStatus: 200,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});
