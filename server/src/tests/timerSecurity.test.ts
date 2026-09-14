import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import crypto from 'crypto';
import { app } from '../index.js';
import { prisma } from '../lib/prisma.js';

describe('PHASE 8: Assessment Timer & Session State Security Suite', () => {
  let company: any;
  let template: any;
  let job: any;
  let candidate: any;
  let application: any;
  let token: string;
  let attemptId: string;
  let q1Id: string;
  let q2Id: string;

  beforeAll(async () => {
    company = await prisma.company.create({
      data: { name: 'Timer Security Testing Corp' }
    });

    template = await prisma.assessmentTemplate.create({
      data: {
        title: 'Strict Timer Template',
        roleCategory: 'BACKEND',
        durationMinutes: 45,
        totalQuestions: 2,
        shuffleQuestions: false,
        shuffleOptions: false,
        companyId: company.id,
        sections: {
          create: [
            {
              title: 'Algorithms',
              questionCount: 2,
              questions: {
                create: [
                  {
                    prompt: 'What is the time complexity of binary search?',
                    type: 'MCQ_SINGLE',
                    difficulty: 'EASY',
                    options: {
                      create: [
                        { text: 'O(log n)', isCorrect: true },
                        { text: 'O(n)', isCorrect: false }
                      ]
                    }
                  },
                  {
                    prompt: 'What is the space complexity of merge sort?',
                    type: 'MCQ_SINGLE',
                    difficulty: 'EASY',
                    options: {
                      create: [
                        { text: 'O(n)', isCorrect: true },
                        { text: 'O(1)', isCorrect: false }
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
        title: 'Real-Time Systems Engineer',
        experienceRange: '3+ years',
        location: 'Remote',
        skillsRequired: JSON.stringify(['Algorithms']),
        description: 'Systems engineer with strict latency guarantees.',
        companyId: company.id,
        assessmentTemplateId: template.id,
      }
    });

    token = 'timer-sec-' + crypto.randomBytes(8).toString('hex');
    candidate = await prisma.candidate.create({
      data: {
        name: 'David Timer',
        email: `david.${crypto.randomBytes(4).toString('hex')}@timersec.io`,
      }
    });

    application = await prisma.jobApplication.create({
      data: {
        candidateId: candidate.id,
        jobId: job.id,
        token,
        tokenExpiresAt: new Date(Date.now() + 24 * 3600 * 1000),
        isOtpVerified: true,
      }
    });

    const startRes = await request(app)
      .post('/api/assessment/start')
      .send({ token });

    expect(startRes.status).toBe(200);
    attemptId = startRes.body.attempt?.attemptId;

    const attempt = await prisma.assessmentAttempt.findUnique({ where: { id: attemptId } });
    const questionIds: string[] = JSON.parse(attempt!.questionOrderJson);
    q1Id = questionIds[0];
    q2Id = questionIds[1];
  });

  afterAll(async () => {
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

  it('initializes activeQuestionStartedAt on first question fetch', async () => {
    const res = await request(app)
      .get(`/api/assessment/question/${attemptId}?index=0`)
      .set('x-assessment-token', token);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.timePerQuestionSeconds).toBe(60);
    expect(res.body.data.remainingSeconds).toBeGreaterThanOrEqual(58);
    expect(res.body.data.remainingSeconds).toBeLessThanOrEqual(60);
    expect(res.body.data.activeQuestionStartedAt).toBeDefined();

    const dbAttempt = await prisma.assessmentAttempt.findUnique({ where: { id: attemptId } });
    expect(dbAttempt?.activeQuestionStartedAt).toBeDefined();
  });

  it('preserves exact server remaining seconds upon browser refresh simulation', async () => {
    // Simulate candidate having spent 25 seconds on question 0
    const simulatedStartedAt = new Date(Date.now() - 25 * 1000);
    await prisma.assessmentAttempt.update({
      where: { id: attemptId },
      data: {
        activeQuestionStartedAt: simulatedStartedAt,
        currentQuestionIndex: 0,
      }
    });

    // Fetch again (browser reload)
    const res = await request(app)
      .get(`/api/assessment/question/${attemptId}?index=0`)
      .set('x-assessment-token', token);

    expect(res.status).toBe(200);
    // Should be approximately 35 seconds remaining (60 - 25), NOT reset to 60!
    expect(res.body.data.remainingSeconds).toBeLessThanOrEqual(36);
    expect(res.body.data.remainingSeconds).toBeGreaterThanOrEqual(33);
  });

  it('rejects answer submission after question timer has expired on the server', async () => {
    // Simulate candidate spending 80 seconds on a 60-second question (exceeding 60s + 10s grace window)
    const expiredStartedAt = new Date(Date.now() - 80 * 1000);
    await prisma.assessmentAttempt.update({
      where: { id: attemptId },
      data: {
        activeQuestionStartedAt: expiredStartedAt,
        currentQuestionIndex: 0,
      }
    });

    const res = await request(app)
      .post('/api/assessment/submit-answer')
      .set('x-assessment-token', token)
      .send({
        attemptId,
        questionId: q1Id,
        selectedOptionIds: ['some-opt'],
        timeSpentSeconds: 80,
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain('time limit expired');

    // Verify server advanced attempt to next question index
    const dbAttempt = await prisma.assessmentAttempt.findUnique({ where: { id: attemptId } });
    expect(dbAttempt?.currentQuestionIndex).toBe(1);
  });

  it('auto-advances question if candidate stalled and fetches after question expired', async () => {
    // Current question is index 1. Simulate candidate stalling for 100s
    const stalledStartedAt = new Date(Date.now() - 100 * 1000);
    await prisma.assessmentAttempt.update({
      where: { id: attemptId },
      data: {
        currentQuestionIndex: 1,
        activeQuestionStartedAt: stalledStartedAt,
      }
    });

    // Candidate reconnects and fetches
    const res = await request(app)
      .get(`/api/assessment/question/${attemptId}?index=1`)
      .set('x-assessment-token', token);

    expect(res.status).toBe(200);
    // Since question 1 was the last question (index 1 out of 2), timing out automatically completes the assessment!
    expect(res.body.data.isCompleted).toBe(true);
  });
});
