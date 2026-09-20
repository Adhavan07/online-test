import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import crypto from 'crypto';
import { app } from '../index.js';
import { prisma } from '../lib/prisma.js';

describe('PHASE 4: Assessment Answer-Key & Hidden Test Cases Security Suite', () => {
  let company: any;
  let template: any;
  let job: any;
  let candidate: any;
  let application: any;
  let attemptId: string;
  let mcqQuestionId: string;
  let codingQuestionId: string;
  const token = 'answer-sec-token-' + crypto.randomBytes(8).toString('hex');

  beforeAll(async () => {
    company = await prisma.company.create({
      data: { name: 'Answer Security Test Corp' }
    });

    template = await prisma.assessmentTemplate.create({
      data: {
        title: 'Confidential Exam Template',
        roleCategory: 'BACKEND',
        durationMinutes: 60,
        totalQuestions: 2,
        shuffleQuestions: false,
        shuffleOptions: false,
        companyId: company.id,
        sections: {
          create: [
            {
              title: 'Core Architecture',
              questionCount: 2,
              questions: {
                create: [
                  {
                    prompt: 'Which data structure offers O(1) average lookup?',
                    type: 'MCQ_SINGLE',
                    difficulty: 'EASY',
                    explanation: 'TOP SECRET EXPLANATION: Hash tables use bucket hashing.',
                    options: {
                      create: [
                        { text: 'Hash Table', isCorrect: true },
                        { text: 'Linked List', isCorrect: false },
                        { text: 'Binary Tree', isCorrect: false }
                      ]
                    }
                  },
                  {
                    prompt: 'Implement a function twoSum(nums, target) that returns indices of two numbers.',
                    type: 'CODING',
                    difficulty: 'MEDIUM',
                    explanation: 'TOP SECRET: Use a complement hash map in one pass.',
                    codeTemplate: 'function solution(input) {\n  // your code\n}',
                    testCasesJson: JSON.stringify([
                      {
                        description: 'Public Sample 1',
                        input: '[2, 7, 11, 15], 9',
                        expectedOutput: '[0, 1]',
                        isHidden: false,
                      },
                      {
                        description: 'Top Secret Hidden Benchmark Case',
                        input: '[1000, 2000, 3000, 4000], 7000',
                        expectedOutput: '[2, 3]',
                        isHidden: true,
                      }
                    ])
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
        title: 'Principal Systems Architect',
        experienceRange: '5+ years',
        location: 'Secure Facility / Remote',
        skillsRequired: JSON.stringify(['Algorithms', 'Security']),
        description: 'Lead systems engineering and architectural integrity.',
        companyId: company.id,
        assessmentTemplateId: template.id,
      }
    });

    candidate = await prisma.candidate.create({
      data: {
        name: 'Bob Evaluator',
        email: `bob.${crypto.randomBytes(4).toString('hex')}@examsecurity.io`,
      }
    });

    application = await prisma.jobApplication.create({
      data: {
        candidateId: candidate.id,
        jobId: job.id,
        token,
        tokenExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        isOtpVerified: true, // pre-verified for test attempt flow
      }
    });

    // Start attempt to initialize questions sequence
    const startRes = await request(app)
      .post('/api/assessment/start')
      .send({ token });

    expect(startRes.status).toBe(200);
    attemptId = startRes.body.attempt?.attemptId;
    expect(attemptId).toBeDefined();

    // Identify question IDs
    const attempt = await prisma.assessmentAttempt.findUnique({ where: { id: attemptId } });
    const questionIds: string[] = JSON.parse(attempt!.questionOrderJson);
    mcqQuestionId = questionIds[0];
    codingQuestionId = questionIds[1];
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

  it('never leaks isCorrect flag on MCQ question options to candidate', async () => {
    const res = await request(app)
      .get(`/api/assessment/question/${attemptId}?index=0`)
      .set('x-assessment-token', token);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const question = res.body.data.question;
    expect(question).toBeDefined();
    expect(question.options).toBeDefined();
    expect(question.options.length).toBe(3);

    // Verify every option object lacks isCorrect
    for (const option of question.options) {
      expect(option.isCorrect).toBeUndefined();
      expect(option).not.toHaveProperty('isCorrect');
      expect(option.id).toBeDefined();
      expect(option.text).toBeDefined();
    }
  });

  it('never leaks answer explanations in candidate question payload', async () => {
    const res = await request(app)
      .get(`/api/assessment/question/${attemptId}?index=0`)
      .set('x-assessment-token', token);

    expect(res.status).toBe(200);
    const question = res.body.data.question;
    expect(question.explanation).toBeUndefined();
    expect(res.text).not.toContain('TOP SECRET EXPLANATION');
  });

  it('strips hidden benchmark test cases from coding questions', async () => {
    const res = await request(app)
      .get(`/api/assessment/question/${attemptId}?index=1`)
      .set('x-assessment-token', token);

    expect(res.status).toBe(200);
    const question = res.body.data.question;
    expect(question.type).toBe('CODING');

    // testCasesJson must NEVER be exposed directly
    expect(question.testCasesJson).toBeUndefined();

    // sampleTestCases must ONLY include visible/sample cases
    expect(question.sampleTestCases).toBeDefined();
    expect(question.sampleTestCases.length).toBe(1);
    expect(question.sampleTestCases[0].description).toBe('Public Sample 1');
    expect(question.sampleTestCases[0].input).toBe('[2, 7, 11, 15], 9');

    // Secret hidden cases must not appear anywhere in the response
    expect(res.text).not.toContain('Top Secret Hidden Benchmark Case');
    expect(res.text).not.toContain('7000');
  });

  it('masks actual and expected output when executing against hidden test cases', async () => {
    const prevEnv = process.env.ENABLE_CODE_EXECUTION;
    process.env.ENABLE_CODE_EXECUTION = 'true';
    try {
      // Run candidate code against the question
      const res = await request(app)
        .post('/api/assessment/run-code')
        .send({
          questionId: codingQuestionId,
          code: 'function solution(input) { return "[0, 1]"; }',
          language: 'javascript'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const evalResult = res.body.evalResult;
      expect(evalResult).toBeDefined();

      const hiddenCase = evalResult.testResults.find((r: any) => r.isHidden);
      expect(hiddenCase).toBeDefined();
      // Hidden case outputs must be masked
      expect(hiddenCase.expected).toBe('[Protected Output]');
      expect(hiddenCase.actual).toMatch(/(Passed|Failed) \(Hidden Case\)/);
    } finally {
      process.env.ENABLE_CODE_EXECUTION = prevEnv;
    }
  });

  it('correctly grades server-side using database truth without candidate tampering', async () => {
    // Get correct option ID from DB
    const correctOpt = await prisma.questionOption.findFirst({
      where: { questionId: mcqQuestionId, isCorrect: true }
    });

    // Submit correct answer for question 0
    const submitRes = await request(app)
      .post('/api/assessment/submit-answer')
      .send({
        attemptId,
        questionId: mcqQuestionId,
        selectedOptionIds: [correctOpt!.id],
        timeSpentSeconds: 15,
        token,
      });

    expect(submitRes.status).toBe(200);

    // Finish assessment to compute score
    const finishRes = await request(app)
      .post('/api/assessment/finish')
      .send({ attemptId, token });

    expect(finishRes.status).toBe(200);
    expect(finishRes.body.success).toBe(true);

    // Check DB assessment result
    const result = await prisma.assessmentResult.findUnique({
      where: { attemptId }
    });

    expect(result).toBeDefined();
    expect(result?.totalScore).toBe(1); // 1 point for the correct MCQ answer evaluated on backend
    const sectionScores = JSON.parse(result!.sectionScoresJson);
    expect(sectionScores['Core Architecture'].score).toBe(1);
  });
});
