import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../index.js';

describe('PHASE 1: Authentication & RBAC Security Suite', () => {
  let adminToken: string;
  let recruiterToken: string;

  beforeAll(async () => {
    // Authenticate as Admin
    const adminRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@techscreen.com', password: 'Admin@123456' });
    expect(adminRes.status).toBe(200);
    adminToken = adminRes.body.token;

    // Authenticate as Recruiter
    const recruiterRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'recruiter@acme.com', password: 'Recruiter@123456' });
    expect(recruiterRes.status).toBe(200);
    recruiterToken = recruiterRes.body.token;
  });

  describe('Unauthenticated Request Protection', () => {
    it('rejects unauthenticated GET /api/jobs with 401', async () => {
      const res = await request(app).get('/api/jobs');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('rejects unauthenticated GET /api/candidates with 401', async () => {
      const res = await request(app).get('/api/candidates');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('rejects unauthenticated GET /api/templates with 401', async () => {
      const res = await request(app).get('/api/templates');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('rejects unauthenticated GET /api/admin/stats with 401', async () => {
      const res = await request(app).get('/api/admin/stats');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('rejects unauthenticated GET /api/admin/smtp-config with 401', async () => {
      const res = await request(app).get('/api/admin/smtp-config');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('rejects unauthenticated GET /api/webhooks with 401', async () => {
      const res = await request(app).get('/api/webhooks');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  describe('Credential Verification & Role Anti-Spoofing', () => {
    it('rejects login with invalid email', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'nonexistent@company.com', password: 'AnyPassword@123' });
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('rejects login with incorrect password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'admin@techscreen.com', password: 'WrongPassword123!' });
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('rejects client role spoofing: request with role=ADMIN yields real DB role RECRUITER', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'recruiter@acme.com',
          password: 'Recruiter@123456',
          role: 'ADMIN', // Client tries to elevate to ADMIN
        });
      expect(res.status).toBe(200);
      expect(res.body.user.role).toBe('RECRUITER');
      expect(res.body.user.role).not.toBe('ADMIN');
    });
  });

  describe('Role-Based Access Control (RBAC) Enforcement', () => {
    it('allows RECRUITER to access GET /api/jobs', async () => {
      const res = await request(app)
        .get('/api/jobs')
        .set('Authorization', `Bearer ${recruiterToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.jobs)).toBe(true);
    });

    it('forbids RECRUITER from accessing GET /api/admin/stats with 403', async () => {
      const res = await request(app)
        .get('/api/admin/stats')
        .set('Authorization', `Bearer ${recruiterToken}`);
      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('Forbidden');
    });

    it('forbids RECRUITER from accessing GET /api/webhooks with 403', async () => {
      const res = await request(app)
        .get('/api/webhooks')
        .set('Authorization', `Bearer ${recruiterToken}`);
      expect(res.status).toBe(403);
    });

    it('allows ADMIN to access GET /api/admin/stats', async () => {
      const res = await request(app)
        .get('/api/admin/stats')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.stats).toBeDefined();
    });

    it('allows ADMIN to access GET /api/webhooks', async () => {
      const res = await request(app)
        .get('/api/webhooks')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('rejects expired or malformed JWT token with 401', async () => {
      const res = await request(app)
        .get('/api/jobs')
        .set('Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.signature');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });
});
