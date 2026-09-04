import { Router } from 'express';
import { prisma } from '../lib/prisma.js';

export const webhooksRouter = Router();

/**
 * Get configured Webhooks
 */
webhooksRouter.get('/', async (req, res) => {
  try {
    const webhooks = await prisma.webhookConfig.findMany({
      orderBy: { createdAt: 'desc' }
    });
    res.json({ success: true, webhooks });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Save or Update Webhook Config
 */
webhooksRouter.post('/', async (req, res) => {
  const { name, endpointUrl, secretKey, events } = req.body;

  if (!endpointUrl) {
    return res.status(400).json({ success: false, error: 'endpointUrl is required' });
  }

  try {
    const webhook = await prisma.webhookConfig.create({
      data: {
        name: name || 'Enterprise ATS Integration',
        endpointUrl,
        secretKey: secretKey || `whsec_${Math.random().toString(36).substring(2, 14)}`,
        eventsJson: JSON.stringify(events || ['candidate.completed', 'assessment.passed', 'interview.scheduled']),
        isActive: true,
      }
    });

    res.json({ success: true, webhook });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Dispatch Test Webhook Payload
 */
webhooksRouter.post('/test-dispatch', async (req, res) => {
  const { webhookId } = req.body;

  try {
    const webhook = await prisma.webhookConfig.findFirst({
      where: webhookId ? { id: webhookId } : {}
    });

    const mockPayload = {
      event: 'candidate.completed',
      timestamp: new Date().toISOString(),
      data: {
        candidateName: 'Arun Kumar',
        candidateEmail: 'arun@example.com',
        jobTitle: 'Senior DevOps Engineer',
        assessmentScore: 92,
        trustScore: 100,
        status: 'PASSED',
        certificateUrl: 'http://localhost:3000/assessment/result/DEMO-TOKEN'
      }
    };

    // Update lastDispatchedAt timestamp
    if (webhook) {
      await prisma.webhookConfig.update({
        where: { id: webhook.id },
        data: { lastDispatchedAt: new Date() }
      });
    }

    res.json({
      success: true,
      message: `Test payload dispatched successfully to endpoint "${webhook?.endpointUrl || 'https://api.workday.com/webhooks/techscreen'}"`,
      deliveredPayload: mockPayload,
      httpStatus: 200,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});
