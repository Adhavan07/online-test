import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import crypto from 'crypto';
import { app } from '../index.js';
import { prisma } from '../lib/prisma.js';
import { ProctoringService } from '../services/ProctoringService.js';

describe('PHASE 9: Proctoring Tamper-Resistance & Real-Time Integrity Scoring Suite', () => {
  let company: any;
  let job: any;
  let template: any;
  let candidate: any;
  let application: any;
  let token: string;
  let attemptId: string;

  beforeAll(async () => {
    // 1. Create company
    company = await prisma.company.create({
      data: { name: `Proctoring Test Corp ${crypto.randomBytes(3).toString('hex')}` }
    });

    // 2. Create template with questions
    template = await prisma.assessmentTemplate.create({
      data: {
        title: 'Senior DevOps Proctored Assessment',
        roleCategory: 'DEVOPS',
        companyId: company.id,
        durationMinutes: 60,
        passPercentage: 70,
        sections: {
          create: [
            {
              title: 'Core DevOps',
              questionCount: 1,
              questions: {
                create: [
                  {
                    prompt: 'Explain container isolation mechanics.',
                    type: 'MCQ_SINGLE',
                    difficulty: 'MEDIUM',
                    options: {
                      create: [
                        { text: 'cgroups and namespaces', isCorrect: true },
                        { text: 'Full VM hypervisors', isCorrect: false },
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

    // 3. Create job
    job = await prisma.job.create({
      data: {
        title: 'Staff Infrastructure Engineer',
        experienceRange: '3-5 years',
        location: 'Remote',
        description: 'Staff DevOps screening role',
        companyId: company.id,
        assessmentTemplateId: template.id,
        skillsRequired: JSON.stringify(['Docker', 'Kubernetes']),
      }
    });

    // 4. Create candidate and application
    candidate = await prisma.candidate.create({
      data: {
        name: 'Jordan Proctor',
        email: `jordan.proctor.${crypto.randomBytes(4).toString('hex')}@example.com`,
      }
    });

    token = `proctor_token_${crypto.randomBytes(16).toString('hex')}`;
    application = await prisma.jobApplication.create({
      data: {
        candidateId: candidate.id,
        jobId: job.id,
        token,
        tokenExpiresAt: new Date(Date.now() + 86400000),
        isOtpVerified: true,
      }
    });

    // 5. Start attempt
    const startRes = await request(app)
      .post('/api/assessment/start')
      .send({ token });

    expect(startRes.status).toBe(200);
    attemptId = startRes.body.attempt.attemptId || startRes.body.attempt.id;
    expect(attemptId).toBeDefined();
  });

  beforeEach(() => {
    ProctoringService.resetLimits();
  });

  afterAll(async () => {
    await prisma.candidate.deleteMany({ where: { email: candidate?.email } });
    await prisma.company.deleteMany({ where: { id: company?.id } });
  });

  it('1. should record FOCUS_LOST violation, increment tabSwitchCount, and update integrity score in real-time', async () => {
    const res = await request(app)
      .post('/api/assessment/proctor-event')
      .set('x-assessment-token', token)
      .send({
        attemptId,
        eventType: 'FOCUS_LOST',
        details: 'Candidate left test tab to inspect background window.',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.debounced).toBe(false);
    expect(res.body.proctoringRiskScore).toBeGreaterThanOrEqual(10);
    expect(res.body.integrityScore).toBeLessThanOrEqual(90);

    // Verify persisted record in database
    const updatedAttempt = await prisma.assessmentAttempt.findUnique({
      where: { id: attemptId }
    });
    expect(updatedAttempt?.tabSwitchCount).toBeGreaterThanOrEqual(1);
    expect(updatedAttempt?.proctoringRiskScore).toBe(res.body.proctoringRiskScore);
    expect(updatedAttempt?.integrityScore).toBe(res.body.integrityScore);
  });

  it('2. should debounce rapid duplicate events (e.g. bounce tab switch) within 3 seconds', async () => {
    // Send first event
    const res1 = await request(app)
      .post('/api/assessment/proctor-event')
      .set('x-assessment-token', token)
      .send({
        attemptId,
        eventType: 'FULLSCREEN_EXIT',
        details: 'Initial fullscreen exit.',
      });

    expect(res1.status).toBe(200);
    expect(res1.body.debounced).toBe(false);

    // Immediately send second identical event (bounce)
    const res2 = await request(app)
      .post('/api/assessment/proctor-event')
      .set('x-assessment-token', token)
      .send({
        attemptId,
        eventType: 'FULLSCREEN_EXIT',
        details: 'Rapid bounce duplicate exit.',
      });

    expect(res2.status).toBe(200);
    expect(res2.body.debounced).toBe(true);
    // Score should not be penalized again
    expect(res2.body.proctoringRiskScore).toBe(res1.body.proctoringRiskScore);
  });

  it('3. should reject invalid proctoring event types with 400 Bad Request', async () => {
    const res = await request(app)
      .post('/api/assessment/proctor-event')
      .set('x-assessment-token', token)
      .send({
        attemptId,
        eventType: 'MALICIOUS_CUSTOM_INJECTION',
        details: 'Trying to inject arbitrary event',
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/Invalid event type/i);
  });

  it('4. should enforce sliding-window rate-limiting on proctor-event spam (> 20/minute)', async () => {
    // Fire 20 events with different valid types / times
    for (let i = 0; i < 20; i++) {
      const eventType = i % 2 === 0 ? 'COPY_PASTE' : 'RIGHT_CLICK';
      // Reset debounce for testing sliding window without bounce suppression
      ProctoringService['recentEvents'].clear();
      const res = await request(app)
        .post('/api/assessment/proctor-event')
        .set('x-assessment-token', token)
        .send({ attemptId, eventType, details: `Event #${i}` });
      expect(res.status).toBe(200);
    }

    // 21st event should be blocked with 429 Too Many Requests
    ProctoringService['recentEvents'].clear();
    const spamRes = await request(app)
      .post('/api/assessment/proctor-event')
      .set('x-assessment-token', token)
      .send({ attemptId, eventType: 'FOCUS_LOST', details: 'Excessive event' });

    expect(spamRes.status).toBe(429);
    expect(spamRes.body.success).toBe(false);
    expect(spamRes.body.error).toMatch(/rate limit exceeded/i);
  });

  it('5. should enforce Anti-IDOR authorization on proctor-event', async () => {
    const fakeToken = `fake_${crypto.randomBytes(16).toString('hex')}`;
    const res = await request(app)
      .post('/api/assessment/proctor-event')
      .set('x-assessment-token', fakeToken)
      .send({
        attemptId,
        eventType: 'FOCUS_LOST',
        details: 'Unauthorized attempt to modify',
      });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('6. should save valid JPEG webcam snapshot and record proctoring log', async () => {
    // Generate valid minimal JPEG buffer (starts with FF D8 FF)
    const validJpeg = Buffer.concat([
      Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]),
      Buffer.alloc(120, 0xaa),
      Buffer.from([0xff, 0xd9])
    ]);
    const base64Data = `data:image/jpeg;base64,${validJpeg.toString('base64')}`;

    const res = await request(app)
      .post('/api/assessment/proctor-snapshot')
      .set('x-assessment-token', token)
      .send({
        attemptId,
        imageBase64: base64Data,
        eventType: 'WEBCAM_SNAPSHOT',
        details: 'Periodic 45s webcam frame',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.snapshotUrl).toBeDefined();
    expect(res.body.snapshotUrl).toMatch(/\/uploads\/proctoring\/snapshot-.*\.jpg/);
  });

  it('7. should reject snapshot with invalid magic bytes / non-image format with 400', async () => {
    // Plain text or random non-image bytes
    const fakeData = Buffer.from('NOT_AN_IMAGE_FILE_BUFFER_CORRUPT_PAYLOAD_HERE_123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890');
    const base64Data = `data:image/jpeg;base64,${fakeData.toString('base64')}`;

    const res = await request(app)
      .post('/api/assessment/proctor-snapshot')
      .set('x-assessment-token', token)
      .send({
        attemptId,
        imageBase64: base64Data,
        eventType: 'WEBCAM_SNAPSHOT',
        details: 'Tampered non-image payload',
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/Invalid image format/i);
  });

  it('8. should reject oversized snapshot payloads with 413 Payload Too Large', async () => {
    // Generate valid JPEG header with oversized body (> 2MB buffer)
    const largeBuffer = Buffer.concat([
      Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
      Buffer.alloc(2.2 * 1024 * 1024, 0xbb),
      Buffer.from([0xff, 0xd9])
    ]);
    const base64Data = `data:image/jpeg;base64,${largeBuffer.toString('base64')}`;

    const res = await request(app)
      .post('/api/assessment/proctor-snapshot')
      .set('x-assessment-token', token)
      .send({
        attemptId,
        imageBase64: base64Data,
      });

    expect([400, 413]).toContain(res.status);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/Payload too large/i);
  });

  it('9. should enforce rate limiting on snapshots (< 5s frequency)', async () => {
    const validJpeg = Buffer.concat([
      Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]),
      Buffer.alloc(120, 0xaa),
      Buffer.from([0xff, 0xd9])
    ]);
    const base64Data = `data:image/jpeg;base64,${validJpeg.toString('base64')}`;

    // Send first snapshot
    const res1 = await request(app)
      .post('/api/assessment/proctor-snapshot')
      .set('x-assessment-token', token)
      .send({ attemptId, imageBase64: base64Data });

    expect(res1.status).toBe(200);

    // Immediately send second snapshot (within 5 seconds)
    const res2 = await request(app)
      .post('/api/assessment/proctor-snapshot')
      .set('x-assessment-token', token)
      .send({ attemptId, imageBase64: base64Data });

    expect(res2.status).toBe(429);
    expect(res2.body.success).toBe(false);
    expect(res2.body.error).toMatch(/Snapshot frequency too high/i);
  });

  it('10. should NOT penalize integrity score for benign periodic WEBCAM_SNAPSHOT events', async () => {
    // Reset attempt scores
    await prisma.assessmentAttempt.update({
      where: { id: attemptId },
      data: { proctoringRiskScore: 0, integrityScore: 100 }
    });

    const calculated = ProctoringService.calculateRisk([
      { eventType: 'WEBCAM_SNAPSHOT' },
      { eventType: 'WEBCAM_SNAPSHOT' },
    ]);

    expect(calculated.proctoringRiskScore).toBe(0);
    expect(calculated.integrityScore).toBe(100);
    expect(calculated.proctoringRiskLevel).toBe('LOW');
  });
});
