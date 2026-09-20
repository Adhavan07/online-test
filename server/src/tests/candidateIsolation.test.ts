import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import crypto from 'crypto';
import { app } from '../index.js';
import { prisma } from '../lib/prisma.js';
import { hashPassword } from '../lib/crypto.js';

describe('PHASE 6: Candidate Assessment IDOR & Attempt Isolation Security Suite', () => {
  let companyA: any;
  let companyB: any;
  let recruiterTokenA: string;
  let recruiterTokenB: string;

  let templateA: any;
  let jobA: any;
  let candA: any;
  let appA: any;
  let tokenA: string;
  let attemptIdA: string;
  let questionIdA: string;

  let candB: any;
  let appB: any;
  let tokenB: string;
  let attemptIdB: string;

  beforeAll(async () => {
    // 1. Create two separate companies
    companyA = await prisma.company.create({ data: { name: 'Acme Systems Ltd' } });
    companyB = await prisma.company.create({ data: { name: 'Rival Dynamics Inc' } });

    // 2. Create recruiters for each company
    const recUserA = await prisma.user.create({
      data: {
        name: 'Recruiter Acme',
        email: `rec.acme.${crypto.randomBytes(4).toString('hex')}@acme.com`,
        passwordHash: hashPassword('AcmePass@123456'),
        role: 'RECRUITER',
        companyId: companyA.id,
      }
    });

    const recUserB = await prisma.user.create({
      data: {
        name: 'Recruiter Rival',
        email: `rec.rival.${crypto.randomBytes(4).toString('hex')}@rival.com`,
        passwordHash: hashPassword('RivalPass@123456'),
        role: 'RECRUITER',
        companyId: companyB.id,
      }
    });

    // Authenticate recruiters
    const loginARes = await request(app)
      .post('/api/auth/login')
      .send({ email: recUserA.email, password: 'AcmePass@123456' });
    recruiterTokenA = loginARes.body.token;

    const loginBRes = await request(app)
      .post('/api/auth/login')
      .send({ email: recUserB.email, password: 'RivalPass@123456' });
    recruiterTokenB = loginBRes.body.token;

    // 3. Create assessment template and job under Company A
    templateA = await prisma.assessmentTemplate.create({
      data: {
        title: 'Software Architect Screening',
        roleCategory: 'BACKEND',
        durationMinutes: 45,
        totalQuestions: 1,
        companyId: companyA.id,
        sections: {
          create: [
            {
              title: 'System Design',
              questionCount: 1,
              questions: {
                create: [
                  {
                    prompt: 'Explain eventual consistency in distributed systems.',
                    type: 'MCQ_SINGLE',
                    difficulty: 'MEDIUM',
                    options: {
                      create: [
                        { text: 'Updates propagate across replicas over time', isCorrect: true },
                        { text: 'All nodes are guaranteed synchronous updates immediately', isCorrect: false }
                      ]
                    }
                  }
                ]
              }
            }
          ]
        }
      }
    });

    jobA = await prisma.job.create({
      data: {
        title: 'Staff Architect',
        experienceRange: '6+ years',
        location: 'Remote',
        skillsRequired: JSON.stringify(['Distributed Systems']),
        description: 'Lead architecture team.',
        companyId: companyA.id,
        assessmentTemplateId: templateA.id,
      }
    });

    // 4. Create Candidate A and start attempt
    tokenA = 'token-cand-a-' + crypto.randomBytes(8).toString('hex');
    candA = await prisma.candidate.create({
      data: {
        name: 'Candidate Alice',
        email: `alice.${crypto.randomBytes(4).toString('hex')}@candisolation.io`,
      }
    });
    appA = await prisma.jobApplication.create({
      data: {
        candidateId: candA.id,
        jobId: jobA.id,
        token: tokenA,
        tokenExpiresAt: new Date(Date.now() + 24 * 3600 * 1000),
        isOtpVerified: true,
      }
    });
    const startARes = await request(app)
      .post('/api/assessment/start')
      .send({ token: tokenA });
    attemptIdA = startARes.body.attempt?.attemptId;

    const attemptARecord = await prisma.assessmentAttempt.findUnique({ where: { id: attemptIdA } });
    questionIdA = JSON.parse(attemptARecord!.questionOrderJson)[0];

    // 5. Create Candidate B and start attempt
    tokenB = 'token-cand-b-' + crypto.randomBytes(8).toString('hex');
    candB = await prisma.candidate.create({
      data: {
        name: 'Candidate Bob',
        email: `bob.${crypto.randomBytes(4).toString('hex')}@candisolation.io`,
      }
    });
    appB = await prisma.jobApplication.create({
      data: {
        candidateId: candB.id,
        jobId: jobA.id,
        token: tokenB,
        tokenExpiresAt: new Date(Date.now() + 24 * 3600 * 1000),
        isOtpVerified: true,
      }
    });
    const startBRes = await request(app)
      .post('/api/assessment/start')
      .send({ token: tokenB });
    attemptIdB = startBRes.body.attempt?.attemptId;
  });

  afterAll(async () => {
    if (candA?.id) {
      await prisma.jobApplication.deleteMany({ where: { candidateId: candA.id } });
      await prisma.candidate.delete({ where: { id: candA.id } }).catch(() => {});
    }
    if (candB?.id) {
      await prisma.jobApplication.deleteMany({ where: { candidateId: candB.id } });
      await prisma.candidate.delete({ where: { id: candB.id } }).catch(() => {});
    }
    if (jobA?.id) {
      await prisma.job.delete({ where: { id: jobA.id } }).catch(() => {});
    }
    if (templateA?.id) {
      await prisma.assessmentTemplate.delete({ where: { id: templateA.id } }).catch(() => {});
    }
    if (companyA?.id) {
      await prisma.company.delete({ where: { id: companyA.id } }).catch(() => {});
    }
    if (companyB?.id) {
      await prisma.company.delete({ where: { id: companyB.id } }).catch(() => {});
    }
  });

  describe('Anti-IDOR Attempt Isolation', () => {
    it('rejects Candidate A from reading Candidate B questions without valid token', async () => {
      // Unauthenticated / no token
      const unauthRes = await request(app)
        .get(`/api/assessment/question/${attemptIdB}?index=0`);
      expect(unauthRes.status).toBe(403);
      expect(unauthRes.body.success).toBe(false);

      // Using Candidate A token to access Candidate B attempt
      const rogueRes = await request(app)
        .get(`/api/assessment/question/${attemptIdB}?index=0`)
        .set('x-assessment-token', tokenA);
      expect(rogueRes.status).toBe(403);
      expect(rogueRes.body.success).toBe(false);
      expect(rogueRes.body.error).toContain('Access denied');
    });

    it('rejects Candidate A from submitting answers for Candidate B attempt', async () => {
      const res = await request(app)
        .post('/api/assessment/submit-answer')
        .set('x-assessment-token', tokenA) // Candidate A token
        .send({
          attemptId: attemptIdB, // Candidate B attempt!
          questionId: questionIdA,
          selectedOptionIds: ['some-id'],
          timeSpentSeconds: 10,
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('Access denied');
    });

    it('rejects Candidate A from submitting proctor events for Candidate B attempt', async () => {
      const res = await request(app)
        .post('/api/assessment/proctor-event')
        .set('x-assessment-token', tokenA)
        .send({
          attemptId: attemptIdB,
          eventType: 'FOCUS_LOST',
          details: 'Malicious spoofed event from another user',
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('Access denied');
    });

    it('rejects Candidate A from forcing finish on Candidate B attempt', async () => {
      const res = await request(app)
        .post('/api/assessment/finish')
        .set('x-assessment-token', tokenA)
        .send({ attemptId: attemptIdB });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('Access denied');
    });

    it('allows Candidate A to access their own attempt with tokenA', async () => {
      const res = await request(app)
        .get(`/api/assessment/question/${attemptIdA}?index=0`)
        .set('x-assessment-token', tokenA);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.question.id).toBe(questionIdA);
    });
  });

  describe('Lifecycle State & Completion Guards', () => {
    it('successfully submits and finishes Candidate A attempt', async () => {
      const submitRes = await request(app)
        .post('/api/assessment/submit-answer')
        .set('x-assessment-token', tokenA)
        .send({
          attemptId: attemptIdA,
          questionId: questionIdA,
          selectedOptionIds: [],
          timeSpentSeconds: 20,
        });
      expect(submitRes.status).toBe(200);

      const finishRes = await request(app)
        .post('/api/assessment/finish')
        .set('x-assessment-token', tokenA)
        .send({ attemptId: attemptIdA });
      expect(finishRes.status).toBe(200);
      expect(finishRes.body.isCompleted).toBe(true);
    });

    it('rejects further answer submissions on completed attempt', async () => {
      const res = await request(app)
        .post('/api/assessment/submit-answer')
        .set('x-assessment-token', tokenA)
        .send({
          attemptId: attemptIdA,
          questionId: questionIdA,
          selectedOptionIds: [],
          timeSpentSeconds: 5,
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/already been completed/);
    });

    it('rejects further proctor events on completed attempt', async () => {
      const res = await request(app)
        .post('/api/assessment/proctor-event')
        .set('x-assessment-token', tokenA)
        .send({
          attemptId: attemptIdA,
          eventType: 'FOCUS_LOST',
          details: 'Event after completion',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/already been completed/);
    });

    it('rejects submission when assessment duration has expired', async () => {
      // Set startedAt of Attempt B to 2 hours ago (template duration is 45m)
      await prisma.assessmentAttempt.update({
        where: { id: attemptIdB },
        data: {
          startedAt: new Date(Date.now() - 2 * 3600 * 1000),
          isCompleted: false,
        }
      });

      const res = await request(app)
        .post('/api/assessment/submit-answer')
        .set('x-assessment-token', tokenB)
        .send({
          attemptId: attemptIdB,
          questionId: questionIdA,
          selectedOptionIds: [],
          timeSpentSeconds: 10,
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/duration limit has expired/);
    });
  });

  describe('Recruiter Cross-Tenant Attempt Isolation', () => {
    it('allows Recruiter A (Acme) to inspect Attempt A', async () => {
      const res = await request(app)
        .get(`/api/assessment/question/${attemptIdA}?index=0`)
        .set('Authorization', `Bearer ${recruiterTokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('rejects Recruiter B (Rival Dynamics) from inspecting Attempt A belonging to Acme', async () => {
      const res = await request(app)
        .get(`/api/assessment/question/${attemptIdA}?index=0`)
        .set('Authorization', `Bearer ${recruiterTokenB}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('Access denied');
    });
  });
});
