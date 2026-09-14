import { describe, it, expect } from 'vitest';
import request from 'supertest';
import crypto from 'crypto';
import { app } from '../index.js';
import { prisma } from '../lib/prisma.js';
import { hashPassword } from '../lib/crypto.js';

describe('PHASE 14: Complete End-to-End Candidate & Recruiter Lifecycle Suite', () => {
  let company: any;
  let recruiter: any;
  let recruiterToken: string;
  let template: any;
  let job: any;
  let candidateToken: string;
  let attemptId: string;

  it('Step 1: Recruiter logs in and retrieves authenticated JWT session', async () => {
    company = await prisma.company.create({
      data: { name: `Global Tech ${crypto.randomBytes(3).toString('hex')}` }
    });

    recruiter = await prisma.user.create({
      data: {
        name: 'Elena Rostova',
        email: `elena.rostova.${crypto.randomBytes(4).toString('hex')}@globaltech.com`,
        passwordHash: hashPassword('ElenaPass@123456'),
        role: 'RECRUITER',
        companyId: company.id,
      }
    });

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: recruiterUserEmail(recruiter.email), password: 'ElenaPass@123456' });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.success).toBe(true);
    expect(loginRes.body.token).toBeDefined();
    recruiterToken = loginRes.body.token;
  });

  function recruiterUserEmail(email: string) {
    return email;
  }

  it('Step 2: Recruiter creates assessment template with questions', async () => {
    template = await prisma.assessmentTemplate.create({
      data: {
        title: 'Full-Stack Platform Engineer Screen',
        roleCategory: 'BACKEND',
        companyId: company.id,
        durationMinutes: 30,
        passPercentage: 75,
        sections: {
          create: [
            {
              title: 'Distributed Architecture',
              questionCount: 2,
              questions: {
                create: [
                  {
                    prompt: 'What principle guarantees consistency and partition tolerance at the expense of availability in distributed systems?',
                    type: 'MCQ_SINGLE',
                    difficulty: 'MEDIUM',
                    options: {
                      create: [
                        { text: 'CAP Theorem (CP)', isCorrect: true },
                        { text: 'ACID Transactions', isCorrect: false },
                        { text: 'BASE Model', isCorrect: false },
                      ]
                    }
                  },
                  {
                    prompt: 'Which hashing algorithm property prevents small input changes from producing similar hashes?',
                    type: 'MCQ_SINGLE',
                    difficulty: 'EASY',
                    options: {
                      create: [
                        { text: 'Avalanche Effect', isCorrect: true },
                        { text: 'Collision Freedom', isCorrect: false },
                        { text: 'Linear Homomorphism', isCorrect: false },
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

    expect(template.id).toBeDefined();
  });

  it('Step 3: Recruiter creates a Job Opening attached to the template', async () => {
    const jobRes = await request(app)
      .post('/api/jobs')
      .set('Authorization', `Bearer ${recruiterToken}`)
      .send({
        title: 'Senior Distributed Systems Architect',
        experienceRange: '4-7 years',
        location: 'Remote / Berlin',
        skillsRequired: ['Distributed Systems', 'Go', 'Docker', 'Kubernetes', 'PostgreSQL'],
        description: 'Lead high-scale real-time telemetry pipelines.',
        passThreshold: 75,
        assessmentTemplateId: template.id,
      });

    expect(jobRes.status).toBe(200);
    expect(jobRes.body.success).toBe(true);
    expect(jobRes.body.job).toBeDefined();
    job = jobRes.body.job;
  });

  it('Step 4: Candidate applies for the job opening', async () => {
    const candidateEmail = `marcus.e2e.${crypto.randomBytes(4).toString('hex')}@systems.io`;
    const applyRes = await request(app)
      .post('/api/candidates/apply')
      .field('name', 'Marcus Vance')
      .field('email', candidateEmail)
      .field('phone', '+1 555 019 2831')
      .field('jobId', job.id);

    expect(applyRes.status).toBe(200);
    expect(applyRes.body.success).toBe(true);
    expect(applyRes.body.token).toBeDefined();
    candidateToken = applyRes.body.token;
  });

  it('Step 5: Candidate verifies token link & requests OTP', async () => {
    // 1. Verify link
    const verifyRes = await request(app).get(`/api/assessment/verify/${candidateToken}`);
    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.data.candidate.name).toBe('Marcus Vance');
    expect(verifyRes.body.data.job.title).toBe('Senior Distributed Systems Architect');

    // 2. Request OTP
    const otpRes = await request(app)
      .post('/api/assessment/send-otp')
      .send({ token: candidateToken });

    expect(otpRes.status).toBe(200);
    expect(otpRes.body.success).toBe(true);

    // Verify OTP plaintext is NOT exposed in response
    expect(otpRes.body.otpCode).toBeUndefined();
  });

  it('Step 6: Candidate enters correct OTP and completes verification', async () => {
    // Fetch hashed OTP record from database (testing simulation)
    const appRecord = await prisma.jobApplication.findUnique({
      where: { token: candidateToken }
    });
    expect(appRecord?.otpCodeHash).toBeDefined();

    // Verify OTP using verification endpoint
    // In our system, the simulation test logger prints OTP or we verify using direct hash comparison
    // Let's verify OTP verification
    const { hashOtp } = await import('../lib/crypto.js');

    // Set known test OTP
    const testOtp = '654321';
    await prisma.jobApplication.update({
      where: { token: candidateToken },
      data: {
        otpCodeHash: hashOtp(testOtp),
        otpExpiresAt: new Date(Date.now() + 300000),
      }
    });

    const verifyOtpRes = await request(app)
      .post('/api/assessment/verify-otp')
      .send({ token: candidateToken, otpCode: testOtp });

    expect(verifyOtpRes.status).toBe(200);
    expect(verifyOtpRes.body.success).toBe(true);
    expect(verifyOtpRes.body.result.isOtpVerified).toBe(true);

    // Single-use check: OTP hash should now be wiped
    const updatedApp = await prisma.jobApplication.findUnique({
      where: { token: candidateToken }
    });
    expect(updatedApp?.isOtpVerified).toBe(true);
    expect(updatedApp?.otpCodeHash).toBeNull();
  });

  it('Step 7: Candidate starts assessment attempt', async () => {
    const startRes = await request(app)
      .post('/api/assessment/start')
      .send({ token: candidateToken });

    expect(startRes.status).toBe(200);
    expect(startRes.body.success).toBe(true);
    attemptId = startRes.body.attempt.attemptId || startRes.body.attempt.id;
    expect(attemptId).toBeDefined();
  });

  it('Step 8: Candidate fetches question #1 with server-authoritative timer', async () => {
    const qRes = await request(app)
      .get(`/api/assessment/question/${attemptId}?index=0`)
      .set('x-assessment-token', candidateToken);

    expect(qRes.status).toBe(200);
    expect(qRes.body.success).toBe(true);
    expect(qRes.body.data.question).toBeDefined();
    expect(qRes.body.data.remainingSeconds).toBeGreaterThanOrEqual(55);
    expect(qRes.body.data.question.options.length).toBe(3);

    // Confirm isCorrect is NEVER leaked
    for (const opt of qRes.body.data.question.options) {
      expect(opt.isCorrect).toBeUndefined();
    }
  });

  it('Step 9: Candidate triggers proctoring telemetry (tab switch)', async () => {
    const proctorRes = await request(app)
      .post('/api/assessment/proctor-event')
      .set('x-assessment-token', candidateToken)
      .send({
        attemptId,
        eventType: 'FOCUS_LOST',
        details: 'Candidate switched tabs to inspect another document.',
      });

    expect(proctorRes.status).toBe(200);
    expect(proctorRes.body.success).toBe(true);
    expect(proctorRes.body.proctoringRiskScore).toBeGreaterThanOrEqual(10);
    expect(proctorRes.body.integrityScore).toBeLessThanOrEqual(90);
  });

  it('Step 10: Candidate answers questions correctly', async () => {
    // 1. Fetch Question 0
    const q0Res = await request(app)
      .get(`/api/assessment/question/${attemptId}?index=0`)
      .set('x-assessment-token', candidateToken);

    const q0Id = q0Res.body.data.question.id;
    const correctOpt0 = await prisma.questionOption.findFirst({
      where: { questionId: q0Id, isCorrect: true }
    });

    const submit0 = await request(app)
      .post('/api/assessment/submit-answer')
      .set('x-assessment-token', candidateToken)
      .send({
        attemptId,
        questionId: q0Id,
        selectedOptionIds: [correctOpt0?.id],
        timeSpentSeconds: 15,
      });

    expect(submit0.status).toBe(200);
    expect(submit0.body.success).toBe(true);

    // 2. Fetch Question 1
    const q1Res = await request(app)
      .get(`/api/assessment/question/${attemptId}?index=1`)
      .set('x-assessment-token', candidateToken);

    const q1Id = q1Res.body.data.question.id;
    const correctOpt1 = await prisma.questionOption.findFirst({
      where: { questionId: q1Id, isCorrect: true }
    });

    const submit1 = await request(app)
      .post('/api/assessment/submit-answer')
      .set('x-assessment-token', candidateToken)
      .send({
        attemptId,
        questionId: q1Id,
        selectedOptionIds: [correctOpt1?.id],
        timeSpentSeconds: 10,
      });

    expect(submit1.status).toBe(200);
    expect(submit1.body.success).toBe(true);
  });

  it('Step 11: Candidate finishes test and assessment is evaluated', async () => {
    const finishRes = await request(app)
      .post('/api/assessment/finish')
      .set('x-assessment-token', candidateToken)
      .send({ attemptId });

    expect(finishRes.status).toBe(200);
    expect(finishRes.body.success).toBe(true);
    expect(finishRes.body.isCompleted).toBe(true);

    const result = finishRes.body.result;
    expect(result).toBeDefined();
    expect(result.totalScore).toBe(2);
    expect(result.maxScore).toBe(2);
    expect(result.percentage).toBe(100);
    expect(result.isPassed).toBe(true);
    expect(result.integrityScore).toBeLessThanOrEqual(90); // Penalized for tab switch
  });

  it('Step 12: Recruiter inspects candidate result & proctoring logs on dashboard', async () => {
    const candidateListRes = await request(app)
      .get('/api/candidates')
      .set('Authorization', `Bearer ${recruiterToken}`);

    expect(candidateListRes.status).toBe(200);
    expect(candidateListRes.body.success).toBe(true);

    const marcusApp = candidateListRes.body.candidates.find(
      (a: any) => a.name === 'Marcus Vance'
    );

    expect(marcusApp).toBeDefined();
    expect(marcusApp.status).toBe('PASSED');
    expect(marcusApp.attempts.length).toBeGreaterThan(0);

    const attemptResult = marcusApp.attempts[0].result;
    expect(attemptResult.percentage).toBe(100);
    expect(attemptResult.isPassed).toBe(true);
    // Composite ranking formula: Technical (60%) + Resume (30%) - Risk penalty (10%)
    // Marcus scored 100% tech, 0% resume, 10 risk -> 60 + 0 - 1 = 59
    expect(marcusApp.rankingScore).toBe(59);
  });
});
