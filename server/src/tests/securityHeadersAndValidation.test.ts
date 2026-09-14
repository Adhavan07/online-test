import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import crypto from 'crypto';
import { app } from '../index.js';
import { prisma } from '../lib/prisma.js';
import { hashPassword } from '../lib/crypto.js';

describe('PHASE 12: Input Validation, Rate Limiting & HTTP Security Headers Suite', () => {
  let company: any;
  let recruiterUser: any;
  let recruiterToken: string;

  beforeAll(async () => {
    company = await prisma.company.create({
      data: { name: `Security Headers Test Corp ${crypto.randomBytes(3).toString('hex')}` }
    });

    recruiterUser = await prisma.user.create({
      data: {
        name: 'SecOps Recruiter',
        email: `secops.recruiter.${crypto.randomBytes(4).toString('hex')}@test.com`,
        passwordHash: hashPassword('SecOpsPass@123456'),
        role: 'RECRUITER',
        companyId: company.id,
      }
    });

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: recruiterUser.email, password: 'SecOpsPass@123456' });

    recruiterToken = loginRes.body.token;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: recruiterUser?.id } });
    await prisma.company.deleteMany({ where: { id: company?.id } });
  });

  it('1. should verify enterprise HTTP security headers on all responses', async () => {
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('DENY');
    expect(res.headers['x-xss-protection']).toBe('1; mode=block');
    expect(res.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    expect(res.headers['cross-origin-opener-policy']).toBe('same-origin');
    expect(res.headers['content-security-policy']).toBeDefined();
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('2. should reject login with invalid email syntax with 400 Bad Request', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'not-a-valid-email-syntax', password: 'SomePassword123' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/Invalid email address format/i);
  });

  it('3. should reject job creation with invalid passThreshold or missing title', async () => {
    // 1. Missing title
    const res1 = await request(app)
      .post('/api/jobs')
      .set('Authorization', `Bearer ${recruiterToken}`)
      .send({ title: '', passThreshold: 75 });

    expect(res1.status).toBe(400);
    expect(res1.body.success).toBe(false);

    // 2. Out of bounds threshold (> 100)
    const res2 = await request(app)
      .post('/api/jobs')
      .set('Authorization', `Bearer ${recruiterToken}`)
      .send({ title: 'DevOps Architect', passThreshold: 150 });

    expect(res2.status).toBe(400);
    expect(res2.body.success).toBe(false);
    expect(res2.body.error).toMatch(/passThreshold must be an integer between 1 and 100/i);

    // 3. Negative threshold
    const res3 = await request(app)
      .post('/api/jobs')
      .set('Authorization', `Bearer ${recruiterToken}`)
      .send({ title: 'DevOps Architect', passThreshold: -5 });

    expect(res3.status).toBe(400);
    expect(res3.body.error).toMatch(/passThreshold must be an integer between 1 and 100/i);
  });

  it('4. should reject candidate application with invalid email format', async () => {
    const res = await request(app)
      .post('/api/candidates/apply')
      .field('name', 'John Doe')
      .field('email', 'not-an-email-domain')
      .field('jobId', 'some-job-id');

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/Invalid email address format/i);
  });

  it('5. should enforce rate limiting on /api/auth/login when enabled', async () => {
    // Send 10 login requests with opt-in header x-test-rate-limit
    for (let i = 0; i < 10; i++) {
      const res = await request(app)
        .post('/api/auth/login')
        .set('x-test-rate-limit', 'true')
        .send({ email: recruiterUser.email, password: 'SecOpsPass@123456' });
      expect(res.status).toBe(200);
    }

    // 11th request should exceed rate limit and return 429
    const blockedRes = await request(app)
      .post('/api/auth/login')
      .set('x-test-rate-limit', 'true')
      .send({ email: recruiterUser.email, password: 'SecOpsPass@123456' });

    expect(blockedRes.status).toBe(429);
    expect(blockedRes.body.success).toBe(false);
    expect(blockedRes.body.error).toMatch(/Too many login attempts/i);
  });
});
