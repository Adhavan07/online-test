import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import crypto from 'crypto';
import { app } from '../index.js';
import { prisma } from '../lib/prisma.js';
import { hashOtp } from '../lib/crypto.js';

describe('PHASE 3: Candidate Assessment OTP Hardening Security Suite', () => {
  let company: any;
  let job: any;
  let template: any;
  let candidate: any;
  let application: any;
  const token = 'otp-test-token-' + crypto.randomBytes(8).toString('hex');

  beforeAll(async () => {
    company = await prisma.company.create({
      data: { name: 'OTP Security Testing Corp' }
    });

    template = await prisma.assessmentTemplate.create({
      data: {
        title: 'Security Screening Template',
        roleCategory: 'BACKEND',
        durationMinutes: 45,
        totalQuestions: 1,
        companyId: company.id,
        sections: {
          create: [
            {
              title: 'Backend Security',
              questionCount: 1,
              questions: {
                create: [
                  {
                    prompt: 'What is OTP salt hashing?',
                    type: 'MCQ_SINGLE',
                    difficulty: 'EASY',
                    options: {
                      create: [
                        { text: 'Cryptographic defense against rainbow tables', isCorrect: true },
                        { text: 'Plaintext storage', isCorrect: false }
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

    job = await prisma.job.create({
      data: {
        title: 'Senior Cryptographer',
        experienceRange: '3-5 years',
        location: 'Remote',
        skillsRequired: JSON.stringify(['Cryptography', 'TypeScript']),
        description: 'Security engineer for assessment integrity.',
        companyId: company.id,
        assessmentTemplateId: template.id,
      }
    });

    candidate = await prisma.candidate.create({
      data: {
        name: 'Alice Cryptographer',
        email: `alice.${crypto.randomBytes(4).toString('hex')}@securitytest.io`,
      }
    });

    application = await prisma.jobApplication.create({
      data: {
        candidateId: candidate.id,
        jobId: job.id,
        token,
        tokenExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        isOtpVerified: false,
      }
    });
  });

  afterAll(async () => {
    // Clean up test fixtures safely
    if (candidate?.id) {
      await prisma.jobApplication.deleteMany({ where: { candidateId: candidate.id } });
      await prisma.candidate.delete({ where: { id: candidate.id } }).catch(() => {});
    }
    if (job?.id) {
      await prisma.job.delete({ where: { id: job.id } }).catch(() => {});
    }
    if (template?.id) {
      await prisma.assessmentTemplate.delete({ where: { id: template.id } }).catch(() => {});
    }
    if (company?.id) {
      await prisma.company.delete({ where: { id: company.id } }).catch(() => {});
    }
  });

  it('rejects attempt start before OTP verification', async () => {
    const res = await request(app)
      .post('/api/assessment/start')
      .send({ token });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain('Email verification required');
  });

  it('generates secure hashed OTP and does NOT leak code in API response', async () => {
    const res = await request(app)
      .post('/api/assessment/send-otp')
      .send({ token });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    // Crucial: response must NOT contain the OTP code or leaked email payload with OTP
    expect(res.body.result?.otpCode).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toMatch(/\b\d{6}\b/);

    // Verify database state: plaintext otpCode is null, otpCodeHash is populated
    const appRecord = await prisma.jobApplication.findUnique({ where: { token } });
    expect(appRecord?.otpCode).toBeNull();
    expect(appRecord?.otpCodeHash).toBeDefined();
    expect(appRecord?.otpCodeHash).toContain(':'); // Scrypt salt:hash format
    expect(appRecord?.otpExpiresAt).toBeDefined();
    expect(appRecord?.otpExpiresAt!.getTime()).toBeGreaterThan(Date.now());
  });

  it('enforces 30-second rate limiting cooldown on resend', async () => {
    const res = await request(app)
      .post('/api/assessment/send-otp')
      .send({ token });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/Please wait \d+s before requesting another verification code/);
  });

  it('rejects master bypass 123456 when it is not the actual OTP', async () => {
    // Ensure the hashed OTP is definitely not 123456
    await prisma.jobApplication.update({
      where: { token },
      data: {
        otpCodeHash: hashOtp('984321'),
        otpExpiresAt: new Date(Date.now() + 5 * 60 * 1000),
        otpAttemptsCount: 0,
      }
    });

    const res = await request(app)
      .post('/api/assessment/verify-otp')
      .send({ token, otpCode: '123456' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/Invalid verification code/);
  });

  it('locks out verification after 5 consecutive incorrect attempts', async () => {
    // Set known code '654321'
    await prisma.jobApplication.update({
      where: { token },
      data: {
        otpCodeHash: hashOtp('654321'),
        otpExpiresAt: new Date(Date.now() + 5 * 60 * 1000),
        otpAttemptsCount: 0,
      }
    });

    // 4 failed attempts
    for (let i = 1; i <= 4; i++) {
      const res = await request(app)
        .post('/api/assessment/verify-otp')
        .send({ token, otpCode: '000000' });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain(`${5 - i} attempt(s) remaining`);
    }

    // 5th attempt locks out
    const fifthRes = await request(app)
      .post('/api/assessment/verify-otp')
      .send({ token, otpCode: '000000' });
    expect(fifthRes.status).toBe(400);
    expect(fifthRes.body.error).toContain('Too many failed attempts');

    // 6th attempt even with the right code is rejected due to lockout
    const sixthRes = await request(app)
      .post('/api/assessment/verify-otp')
      .send({ token, otpCode: '654321' });
    expect(sixthRes.status).toBe(400);
    expect(sixthRes.body.error).toContain('Too many failed attempts');
  });

  it('rejects expired OTP codes', async () => {
    // Set code with expired timestamp
    await prisma.jobApplication.update({
      where: { token },
      data: {
        otpCodeHash: hashOtp('456789'),
        otpExpiresAt: new Date(Date.now() - 1000), // Expired 1 second ago
        otpAttemptsCount: 0,
      }
    });

    const res = await request(app)
      .post('/api/assessment/verify-otp')
      .send({ token, otpCode: '456789' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain('Verification code has expired');
  });

  it('successfully verifies correct OTP, invalidates code (single-use), and allows start', async () => {
    const activeCode = '741852';
    await prisma.jobApplication.update({
      where: { token },
      data: {
        otpCodeHash: hashOtp(activeCode),
        otpExpiresAt: new Date(Date.now() + 5 * 60 * 1000),
        otpAttemptsCount: 0,
        isOtpVerified: false,
      }
    });

    // Verify with correct code
    const verifyRes = await request(app)
      .post('/api/assessment/verify-otp')
      .send({ token, otpCode: activeCode });

    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.success).toBe(true);
    expect(verifyRes.body.result.isOtpVerified).toBe(true);

    // Verify DB state: single-use invalidation
    const updated = await prisma.jobApplication.findUnique({ where: { token } });
    expect(updated?.isOtpVerified).toBe(true);
    expect(updated?.otpCodeHash).toBeNull();
    expect(updated?.otpExpiresAt).toBeNull();

    // Now test startAttempt succeeds
    const startRes = await request(app)
      .post('/api/assessment/start')
      .send({ token });

    expect(startRes.status).toBe(200);
    expect(startRes.body.success).toBe(true);
    expect(startRes.body.attempt?.attemptId).toBeDefined();
  });
});
