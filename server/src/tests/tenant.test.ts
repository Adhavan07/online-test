import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../index.js';
import { prisma } from '../lib/prisma.js';
import { hashPassword } from '../lib/crypto.js';

describe('PHASE 2: Multi-Tenant Isolation & Anti-IDOR Security Suite', () => {
  let companyA: any;
  let companyB: any;
  let recruiterA: any;
  let recruiterB: any;
  let tokenA: string;
  let tokenB: string;
  let jobA: any;
  let jobB: any;
  let candA: any;
  let candB: any;
  let appA: any;
  let appB: any;

  beforeAll(async () => {
    // 1. Create two distinct enterprise tenants
    companyA = await prisma.company.create({
      data: { name: 'AlphaCorp Industries' }
    });
    companyB = await prisma.company.create({
      data: { name: 'BetaSystems Global' }
    });

    // 2. Create recruiters belonging to each company
    recruiterA = await prisma.user.create({
      data: {
        name: 'Recruiter Alpha',
        email: 'recruiter@alphacorp.io',
        passwordHash: hashPassword('AlphaPass@2026'),
        role: 'RECRUITER',
        companyId: companyA.id,
      }
    });

    recruiterB = await prisma.user.create({
      data: {
        name: 'Recruiter Beta',
        email: 'recruiter@betasystems.io',
        passwordHash: hashPassword('BetaPass@2026'),
        role: 'RECRUITER',
        companyId: companyB.id,
      }
    });

    // Authenticate both recruiters
    const loginARes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'recruiter@alphacorp.io', password: 'AlphaPass@2026' });
    expect(loginARes.status).toBe(200);
    tokenA = loginARes.body.token;

    const loginBRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'recruiter@betasystems.io', password: 'BetaPass@2026' });
    expect(loginBRes.status).toBe(200);
    tokenB = loginBRes.body.token;

    // 3. Create jobs for each company
    jobA = await prisma.job.create({
      data: {
        title: 'AlphaCorp Lead DevOps',
        experienceRange: '3-5 years',
        location: 'Remote',
        skillsRequired: JSON.stringify(['Docker', 'Kubernetes']),
        description: 'Alpha job',
        companyId: companyA.id,
      }
    });

    jobB = await prisma.job.create({
      data: {
        title: 'BetaSystems Cloud Architect',
        experienceRange: '5+ years',
        location: 'Onsite',
        skillsRequired: JSON.stringify(['AWS', 'Terraform']),
        description: 'Beta job',
        companyId: companyB.id,
      }
    });

    // 4. Create candidates and applications for each company
    candA = await prisma.candidate.create({
      data: {
        name: 'Alice Alpha',
        email: 'alice@alpha-candidate.com',
      }
    });

    appA = await prisma.jobApplication.create({
      data: {
        candidateId: candA.id,
        jobId: jobA.id,
        status: 'INVITED',
        token: 'alpha-test-token-alice',
        tokenExpiresAt: new Date(Date.now() + 86400000),
      }
    });

    candB = await prisma.candidate.create({
      data: {
        name: 'Bob Beta',
        email: 'bob@beta-candidate.com',
      }
    });

    appB = await prisma.jobApplication.create({
      data: {
        candidateId: candB.id,
        jobId: jobB.id,
        status: 'INVITED',
        token: 'beta-test-token-bob',
        tokenExpiresAt: new Date(Date.now() + 86400000),
      }
    });
  });

  afterAll(async () => {
    // Clean up test tenant records
    await prisma.jobApplication.deleteMany({ where: { id: { in: [appA.id, appB.id] } } });
    await prisma.candidate.deleteMany({ where: { id: { in: [candA.id, candB.id] } } });
    await prisma.job.deleteMany({ where: { id: { in: [jobA.id, jobB.id] } } });
    await prisma.user.deleteMany({ where: { id: { in: [recruiterA.id, recruiterB.id] } } });
    await prisma.company.deleteMany({ where: { id: { in: [companyA.id, companyB.id] } } });
  });

  describe('Job Listing Tenant Scoping', () => {
    it('Recruiter A sees only Company A jobs and not Company B jobs', async () => {
      const res = await request(app)
        .get('/api/jobs')
        .set('Authorization', `Bearer ${tokenA}`);
      expect(res.status).toBe(200);
      const jobTitles = res.body.jobs.map((j: any) => j.title);
      expect(jobTitles).toContain('AlphaCorp Lead DevOps');
      expect(jobTitles).not.toContain('BetaSystems Cloud Architect');
    });

    it('Recruiter B sees only Company B jobs and not Company A jobs', async () => {
      const res = await request(app)
        .get('/api/jobs')
        .set('Authorization', `Bearer ${tokenB}`);
      expect(res.status).toBe(200);
      const jobTitles = res.body.jobs.map((j: any) => j.title);
      expect(jobTitles).toContain('BetaSystems Cloud Architect');
      expect(jobTitles).not.toContain('AlphaCorp Lead DevOps');
    });
  });

  describe('Candidate Roster Tenant Scoping', () => {
    it('Recruiter A sees only Company A candidates in candidate list', async () => {
      const res = await request(app)
        .get('/api/candidates')
        .set('Authorization', `Bearer ${tokenA}`);
      expect(res.status).toBe(200);
      const candEmails = res.body.candidates.map((c: any) => c.email);
      expect(candEmails).toContain('alice@alpha-candidate.com');
      expect(candEmails).not.toContain('bob@beta-candidate.com');
    });

    it('Recruiter B sees only Company B candidates in candidate list', async () => {
      const res = await request(app)
        .get('/api/candidates')
        .set('Authorization', `Bearer ${tokenB}`);
      expect(res.status).toBe(200);
      const candEmails = res.body.candidates.map((c: any) => c.email);
      expect(candEmails).toContain('bob@beta-candidate.com');
      expect(candEmails).not.toContain('alice@alpha-candidate.com');
    });

    it('Recruiter A export-csv includes only Company A candidates', async () => {
      const res = await request(app)
        .get('/api/candidates/export-csv')
        .set('Authorization', `Bearer ${tokenA}`);
      expect(res.status).toBe(200);
      expect(res.text).toContain('alice@alpha-candidate.com');
      expect(res.text).not.toContain('bob@beta-candidate.com');
    });
  });

  describe('Cross-Tenant IDOR Prevention', () => {
    it('Recruiter A requesting Company B candidate detail dossier receives 403 Forbidden', async () => {
      const res = await request(app)
        .get(`/api/candidates/detail/${appB.id}`)
        .set('Authorization', `Bearer ${tokenA}`);
      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('Forbidden');
    });

    it('Recruiter A attempting to update Company B candidate status receives 403 Forbidden', async () => {
      const res = await request(app)
        .patch(`/api/candidates/${appB.id}/status`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ status: 'REJECTED' });
      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);

      // Verify status was NOT modified in database
      const check = await prisma.jobApplication.findUnique({ where: { id: appB.id } });
      expect(check?.status).toBe('INVITED');
    });

    it('Recruiter A attempting to dispatch invites for Company B job receives 403 Forbidden', async () => {
      const res = await request(app)
        .post('/api/candidates/bulk-invite')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          jobId: jobB.id,
          candidates: [{ name: 'Hacker Target', email: 'target@hacker.io' }]
        });
      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('Recruiter A attempting to add note to Company B candidate receives 403 Forbidden', async () => {
      const res = await request(app)
        .post(`/api/candidates/${appB.id}/notes`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ comment: 'Malicious cross-company note', rating: 1 });
      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('Recruiter A attempting to re-test Company B candidate receives 403 Forbidden', async () => {
      const res = await request(app)
        .post(`/api/candidates/${appB.id}/reset-attempt`)
        .set('Authorization', `Bearer ${tokenA}`);
      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });
});
