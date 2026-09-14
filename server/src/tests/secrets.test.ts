import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../index.js';
import { getJwtSecret } from '../middleware/auth.js';
import { prisma } from '../lib/prisma.js';

describe('PHASE 5: Secrets, Environment Variables & JWT Hardening Security Suite', () => {
  let adminToken: string;
  let testWebhook: any;

  beforeAll(async () => {
    // Authenticate as Admin
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@techscreen.com', password: 'Admin@123456' });

    expect(loginRes.status).toBe(200);
    adminToken = loginRes.body.token;

    const adminUser = await prisma.user.findUnique({ where: { email: 'admin@techscreen.com' } });

    // Create a test webhook with a sensitive secret key scoped to admin's company
    testWebhook = await prisma.webhookConfig.create({
      data: {
        name: 'Secret Masking Test Webhook',
        endpointUrl: 'https://webhook.site/test-masking',
        secretKey: 'whsec_9876543210abcdef9876543210abcdef',
        eventsJson: JSON.stringify(['candidate.completed']),
        isActive: true,
        companyId: adminUser?.companyId,
      }
    });
  });

  afterAll(async () => {
    if (testWebhook?.id) {
      await prisma.webhookConfig.delete({ where: { id: testWebhook.id } }).catch(() => {});
    }
  });

  describe('JWT Secret Production Fail-Fast Enforcement', () => {
    const originalEnv = process.env.NODE_ENV;
    const originalSecret = process.env.JWT_SECRET;

    afterAll(() => {
      process.env.NODE_ENV = originalEnv;
      process.env.JWT_SECRET = originalSecret;
    });

    it('throws fatal error in production if JWT_SECRET is undefined or empty', () => {
      process.env.NODE_ENV = 'production';
      delete process.env.JWT_SECRET;

      expect(() => getJwtSecret()).toThrow(/FATAL: A strong, cryptographically random JWT_SECRET/);
    });

    it('throws fatal error in production if JWT_SECRET is an insecure default or dictionary word', () => {
      process.env.NODE_ENV = 'production';

      const weakKeys = [
        'techscreen-enterprise-secret-change-in-prod-2026',
        'techscreen-secret-jwt-key',
        'default-dev-secret',
        'secret',
        'changeme',
        '123456',
        'short-key',
      ];

      for (const weakKey of weakKeys) {
        process.env.JWT_SECRET = weakKey;
        expect(() => getJwtSecret()).toThrow(/FATAL: A strong, cryptographically random JWT_SECRET/);
      }
    });

    it('succeeds in production when a cryptographically strong 32+ char secret is supplied', () => {
      process.env.NODE_ENV = 'production';
      process.env.JWT_SECRET = 'c9842a6c0b9a8f12d8a5712e4fbc890123456789abcdef0123456789abcdef';

      expect(getJwtSecret()).toBe('c9842a6c0b9a8f12d8a5712e4fbc890123456789abcdef0123456789abcdef');
    });

    it('restores test environment safely', () => {
      process.env.NODE_ENV = 'test';
      process.env.JWT_SECRET = originalSecret || 'test-dev-secret-key-that-is-at-least-32-chars-long';
      expect(typeof getJwtSecret()).toBe('string');
    });
  });

  describe('Token Signature & Forgery Rejection', () => {
    it('rejects tokens signed with unauthorized/rogue secrets', async () => {
      const forgedToken = jwt.sign(
        { id: 'hacker-id', email: 'hacker@darkweb.org', role: 'ADMIN', companyId: null },
        'rogue-attacker-private-secret-key',
        { expiresIn: '1h' }
      );

      const res = await request(app)
        .get('/api/admin/stats')
        .set('Authorization', `Bearer ${forgedToken}`);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/Invalid or expired session token/);
    });

    it('rejects expired tokens', async () => {
      const currentSecret = getJwtSecret();
      const expiredToken = jwt.sign(
        { id: 'admin-id', email: 'admin@techscreen.com', role: 'ADMIN', companyId: null },
        currentSecret,
        { expiresIn: '-1s' } // Expired 1 second ago
      );

      const res = await request(app)
        .get('/api/admin/stats')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/Invalid or expired session token/);
    });
  });

  describe('Secrets Masking on API Responses', () => {
    it('GET /api/admin/smtp-config never returns plain password or sensitive credentials', async () => {
      const res = await request(app)
        .get('/api/admin/smtp-config')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const config = res.body.config;
      expect(config).toBeDefined();

      // Ensure no password field exists in the returned JSON
      expect(config.pass).toBeUndefined();
      expect(config.password).toBeUndefined();
      expect(config.appPassword).toBeUndefined();
      expect(JSON.stringify(res.body)).not.toContain('GMAIL_APP_PASSWORD');
    });

    it('GET /api/webhooks masks secret keys in webhook list responses', async () => {
      const res = await request(app)
        .get('/api/webhooks')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const target = res.body.webhooks.find((w: any) => w.id === testWebhook.id);
      expect(target).toBeDefined();

      // Full secret should NOT be returned on list queries
      expect(target.secretKey).not.toBe('whsec_9876543210abcdef9876543210abcdef');
      // Should be masked with ellipsis or bullets
      expect(target.secretKey).toMatch(/(\.\.\.|••••••••)/);
    });
  });
});
