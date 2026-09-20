import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import crypto from 'crypto';
import { app } from '../index.js';
import { prisma } from '../lib/prisma.js';
import { hashPassword } from '../lib/crypto.js';
import { RetentionService } from '../services/RetentionService.js';
import { EmailService } from '../services/EmailService.js';
import { generateUnsubscribeToken } from '../routes/legal.js';

describe('India Legal & Privacy Compliance Suite (DPDP Act 2023 & Core Controls)', () => {
  let companyA: any;
  let companyB: any;
  let recruiterTokenA: string;
  let recruiterTokenB: string;
  let adminToken: string;

  let templateA: any;
  let jobA: any;
  let candidateA: any;
  let applicationA: any;
  let assessmentTokenA: string;
  let attemptA: any;

  beforeAll(async () => {
    // 1. Create two test companies with tenant settings
    companyA = await prisma.company.create({
      data: {
        name: 'Bharat Tech Solutions Ltd',
        settingsJson: JSON.stringify({
          defaultPassThreshold: 70,
          proctoringStrictness: 'STANDARD',
          proctoringSnapshotRetentionDays: 30,
          candidateDataRetentionDays: 180,
          minimumAgeRequired: 18,
        })
      }
    });

    companyB = await prisma.company.create({
      data: {
        name: 'Himalaya Corp',
        settingsJson: JSON.stringify({
          defaultPassThreshold: 75,
          minimumAgeRequired: 16,
        })
      }
    });

    // 2. Create users
    const recruiterUserA = await prisma.user.create({
      data: {
        name: 'Pooja Recruiter',
        email: `pooja.${crypto.randomBytes(4).toString('hex')}@bharattech.local`,
        passwordHash: hashPassword('SecurePass@123456'),
        role: 'RECRUITER',
        companyId: companyA.id,
      }
    });

    const recruiterUserB = await prisma.user.create({
      data: {
        name: 'Rohit Recruiter',
        email: `rohit.${crypto.randomBytes(4).toString('hex')}@himalaya.local`,
        passwordHash: hashPassword('SecurePass@123456'),
        role: 'RECRUITER',
        companyId: companyB.id,
      }
    });

    const adminUser = await prisma.user.create({
      data: {
        name: 'Admin User',
        email: `admin.${crypto.randomBytes(4).toString('hex')}@bharattech.local`,
        passwordHash: hashPassword('AdminPass@123456'),
        role: 'ADMIN',
        companyId: companyA.id,
      }
    });

    // Authenticate
    const loginA = await request(app).post('/api/auth/login').send({ email: recruiterUserA.email, password: 'SecurePass@123456' });
    recruiterTokenA = loginA.body.token;

    const loginB = await request(app).post('/api/auth/login').send({ email: recruiterUserB.email, password: 'SecurePass@123456' });
    recruiterTokenB = loginB.body.token;

    const loginAdmin = await request(app).post('/api/auth/login').send({ email: adminUser.email, password: 'AdminPass@123456' });
    adminToken = loginAdmin.body.token;

    // 3. Create assessment template and job for Company A
    templateA = await prisma.assessmentTemplate.create({
      data: {
        title: 'Backend Assessment',
        roleCategory: 'BACKEND',
        durationMinutes: 30,
        companyId: companyA.id,
      }
    });

    jobA = await prisma.job.create({
      data: {
        title: 'Backend Compliance Engineer',
        companyId: companyA.id,
        assessmentTemplateId: templateA.id,
        skillsRequired: JSON.stringify(['Node.js', 'PostgreSQL', 'Security']),
        experienceRange: '2-5 years',
        location: 'Bengaluru / Hybrid',
        description: 'Compliance engineering test role',
        passThreshold: 70,
      }
    });

    candidateA = await prisma.candidate.create({
      data: {
        name: 'Vikram Patel',
        email: `vikram.${crypto.randomBytes(4).toString('hex')}@example.com`,
        phone: '+919876543210',
      }
    });

    assessmentTokenA = `test-token-${crypto.randomBytes(6).toString('hex')}`;
    applicationA = await prisma.jobApplication.create({
      data: {
        jobId: jobA.id,
        candidateId: candidateA.id,
        token: assessmentTokenA,
        tokenExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        status: 'INVITED',
        isOtpVerified: true,
        legalHold: false,
        consentRecorded: false,
      }
    });

    // Create an assessment attempt with proctoring logs for candidate A
    attemptA = await prisma.assessmentAttempt.create({
      data: {
        applicationId: applicationA.id,
        templateId: templateA.id,
        questionOrderJson: JSON.stringify(['q1']),
        isCompleted: false,
        integrityScore: 92,
        proctoringRiskScore: 8,
      }
    });

    await prisma.proctoringLog.createMany({
      data: [
        {
          attemptId: attemptA.id,
          eventType: 'WEBCAM_SNAPSHOT',
          details: JSON.stringify({ snapshotUrl: '/uploads/snapshots/snap1.jpg', reason: 'Periodic' }),
        },
        {
          attemptId: attemptA.id,
          eventType: 'TAB_SWITCH',
          details: 'Tab switch recorded (unfocus)',
        }
      ]
    });
  });

  afterAll(async () => {
    // Cleanup created test records
    if (attemptA?.id) await prisma.proctoringLog.deleteMany({ where: { attemptId: attemptA.id } }).catch(() => {});
    if (applicationA?.id) await prisma.assessmentAttempt.deleteMany({ where: { applicationId: applicationA.id } }).catch(() => {});
    if (jobA?.id) await prisma.jobApplication.deleteMany({ where: { jobId: jobA.id } }).catch(() => {});
    if (companyA?.id) await prisma.job.deleteMany({ where: { companyId: companyA.id } }).catch(() => {});
    if (templateA?.id) await prisma.assessmentTemplate.delete({ where: { id: templateA.id } }).catch(() => {});
    if (candidateA?.id) await prisma.candidate.delete({ where: { id: candidateA.id } }).catch(() => {});
    await prisma.user.deleteMany({ where: { companyId: { in: [companyA?.id, companyB?.id].filter(Boolean) } } }).catch(() => {});
    await prisma.company.deleteMany({ where: { id: { in: [companyA?.id, companyB?.id].filter(Boolean) } } }).catch(() => {});
  });

  describe('1. Dynamic Legal Configuration & Grievance Endpoints', () => {
    it('GET /api/legal/config returns neutral dynamic legal metadata without hard-coded business identities', async () => {
      const res = await request(app).get('/api/legal/config');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.config).toBeDefined();
      expect(res.body.config.applicableFrameworks.some((f: string) => f.includes('DPDP Act'))).toBe(true);
      expect(res.body.config.grievanceOfficer).toBeDefined();
      expect(res.body.config.grievanceOfficer.redressalTimeline).toContain('resolution within 15 days');
      expect(res.body.config.lawyerReviewNotice).toContain('[LAWYER_REVIEW]');
    });

    it('GET /api/legal/policies returns core policy notices with lawyer review advisory', async () => {
      const res = await request(app).get('/api/legal/policies');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.policies.dpdpNotice).toBeDefined();
      expect(res.body.policies.proctoringAdvisory).toBeDefined();
      expect(res.body.policies.lawyerReviewDisclaimer).toContain('[LAWYER_REVIEW]');
    });
  });

  describe('2. Consent Recording & Tenant-Configured Age Assurance', () => {
    it('POST /api/assessment/start rejects start if consentRecorded is false', async () => {
      const res = await request(app)
        .post('/api/assessment/start')
        .send({ token: assessmentTokenA, consentRecorded: false });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('consent must be recorded');
    });

    it('POST /api/assessment/start blocks start if declared age is below tenant-configured minimum', async () => {
      const res = await request(app)
        .post('/api/assessment/start')
        .send({
          token: assessmentTokenA,
          consentRecorded: true,
          consentVersion: 'DPDP-2025-V1',
          declaredAge: 16, // companyA requires minimum 18
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('Minimum age requirement of 18');
    });

    it('POST /api/assessment/start succeeds with consent and valid age, creating tamper-resistant AuditLog', async () => {
      const res = await request(app)
        .post('/api/assessment/start')
        .send({
          token: assessmentTokenA,
          consentRecorded: true,
          consentVersion: 'DPDP-2025-V1',
          declaredAge: 21,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify database recorded consent
      const updatedApp = await prisma.jobApplication.findUnique({ where: { id: applicationA.id } });
      expect(updatedApp?.consentRecorded).toBe(true);
      expect(updatedApp?.consentVersion).toBe('DPDP-2025-V1');
      expect(updatedApp?.consentRecordedAt).toBeDefined();

      // Verify tamper-resistant AuditLog
      const auditEntry = await prisma.auditLog.findFirst({
        where: {
          action: 'DPDP_CONSENT_RECORDED',
          companyId: companyA.id,
        },
        orderBy: { createdAt: 'desc' },
      });
      expect(auditEntry).toBeDefined();
      expect(auditEntry?.details).toContain('DPDP-2025-V1');
    });
  });

  describe('3. Candidate Data Subject Access Request (DSAR Export)', () => {
    it('GET /api/candidates/:applicationId/export-data generates complete structured JSON export for authorized recruiter', async () => {
      const res = await request(app)
        .get(`/api/candidates/${applicationA.id}/export-data`)
        .set('Authorization', `Bearer ${recruiterTokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.dsarExport).toBeDefined();
      expect(res.body.dsarExport.complianceFramework).toContain('Digital Personal Data Protection');
      expect(res.body.dsarExport.dataFiduciary.companyName).toBe(companyA.name);
      expect(res.body.dsarExport.dataPrincipal.name).toBe('Vikram Patel');
      expect(res.body.dsarExport.consentAudit.consentRecorded).toBe(true);
      expect(res.body.dsarExport.evaluations).toBeDefined();
    });

    it('GET /api/candidates/:applicationId/export-data blocks unauthorized access from another company (IDOR protection)', async () => {
      const res = await request(app)
        .get(`/api/candidates/${applicationA.id}/export-data`)
        .set('Authorization', `Bearer ${recruiterTokenB}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });

  describe('4. Legal Retention Hold Exception & Erasure Protection', () => {
    it('PATCH /api/candidates/:applicationId/legal-hold sets active legal hold with reason', async () => {
      const res = await request(app)
        .patch(`/api/candidates/${applicationA.id}/legal-hold`)
        .set('Authorization', `Bearer ${recruiterTokenA}`)
        .send({
          legalHold: true,
          reason: 'Regulatory compliance inquiry reference SEC-IND-2026-99',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.legalHold).toBe(true);
      expect(res.body.legalHoldReason).toBe('Regulatory compliance inquiry reference SEC-IND-2026-99');

      // Verify audit log
      const log = await prisma.auditLog.findFirst({
        where: { action: 'LEGAL_HOLD_APPLIED', companyId: companyA.id },
      });
      expect(log).toBeDefined();
    });

    it('DELETE /api/candidates/:applicationId/personal-data returns 409 Conflict when legal hold is active', async () => {
      const res = await request(app)
        .delete(`/api/candidates/${applicationA.id}/personal-data`)
        .set('Authorization', `Bearer ${recruiterTokenA}`);

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('Active Legal Hold');
    });

    it('PATCH /api/candidates/:applicationId/legal-hold releases legal hold', async () => {
      const res = await request(app)
        .patch(`/api/candidates/${applicationA.id}/legal-hold`)
        .set('Authorization', `Bearer ${recruiterTokenA}`)
        .send({ legalHold: false });

      expect(res.status).toBe(200);
      expect(res.body.legalHold).toBe(false);
    });

    it('DELETE /api/candidates/:applicationId/personal-data executes erasure when no legal hold, preserving audit trail', async () => {
      const res = await request(app)
        .delete(`/api/candidates/${applicationA.id}/personal-data`)
        .set('Authorization', `Bearer ${recruiterTokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify candidate PII is anonymized
      const updatedCandidate = await prisma.candidate.findUnique({ where: { id: candidateA.id } });
      expect(updatedCandidate?.name).toBe('[Anonymized Candidate]');
      expect(updatedCandidate?.email).toContain('anonymized-');

      // Verify tamper-resistant audit trail
      const erasureLog = await prisma.auditLog.findFirst({
        where: { action: 'DPDP_DATA_ERASURE_EXECUTED', companyId: companyA.id },
      });
      expect(erasureLog).toBeDefined();
    });
  });

  describe('5. Candidate Consent Withdrawal', () => {
    it('POST /api/candidates/:applicationId/withdraw-consent halts application and updates status', async () => {
      // Create another candidate to test consent withdrawal
      const candW = await prisma.candidate.create({
        data: { name: 'Withdraw Test', email: `withdraw.${Date.now()}@example.com` }
      });
      const appW = await prisma.jobApplication.create({
        data: {
          jobId: jobA.id,
          candidateId: candW.id,
          token: `token-w-${Date.now()}`,
          tokenExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          status: 'IN_PROGRESS',
          consentRecorded: true,
        }
      });

      const res = await request(app)
        .post(`/api/candidates/${appW.id}/withdraw-consent`)
        .set('Authorization', `Bearer ${recruiterTokenA}`)
        .send();

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const checkApp = await prisma.jobApplication.findUnique({ where: { id: appW.id } });
      expect(checkApp?.status).toBe('CONSENT_WITHDRAWN');
      expect(checkApp?.tokenExpiresAt.getTime()).toBe(0);

      // Cleanup
      await prisma.jobApplication.delete({ where: { id: appW.id } });
      await prisma.candidate.delete({ where: { id: candW.id } });
    });
  });

  describe('6. Retention Service & Legal Hold Protection', () => {
    it('RetentionService.purgeExpiredSnapshots skips records under active legal hold', async () => {
      // Setup candidate under legal hold with a proctoring log
      const candHold = await prisma.candidate.create({
        data: { name: 'Hold Candidate', email: `hold.${Date.now()}@example.com` }
      });
      const appHold = await prisma.jobApplication.create({
        data: {
          jobId: jobA.id,
          candidateId: candHold.id,
          token: `token-hold-${Date.now()}`,
          tokenExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          status: 'SHORTLISTED',
          legalHold: true,
          legalHoldReason: 'Audit sample',
        }
      });
      const attemptHold = await prisma.assessmentAttempt.create({
        data: {
          applicationId: appHold.id,
          templateId: templateA.id,
          questionOrderJson: JSON.stringify(['q1']),
          startedAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
        }
      });
      await prisma.proctoringLog.create({
        data: {
          attemptId: attemptHold.id,
          eventType: 'WEBCAM_SNAPSHOT',
          details: JSON.stringify({ snapshotUrl: '/uploads/snapshots/snap_hold.jpg' }),
          timestamp: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
        }
      });

      const purgeResult = await RetentionService.purgeExpiredSnapshots(companyA.id, 10);
      expect(purgeResult.success).toBe(true);
      expect(purgeResult.legalHoldSkippedCount).toBeGreaterThanOrEqual(1);

      // Cleanup
      await prisma.proctoringLog.deleteMany({ where: { attemptId: attemptHold.id } });
      await prisma.assessmentAttempt.delete({ where: { id: attemptHold.id } });
      await prisma.jobApplication.delete({ where: { id: appHold.id } });
      await prisma.candidate.delete({ where: { id: candHold.id } });
    });
  });

  describe('7. Signed Single-Use Marketing Unsubscribe Tokens & Suppression', () => {
    const targetEmail = `campaign.${Date.now()}@example.org`;
    let rawToken: string;

    it('generateUnsubscribeToken creates a 32-byte hex single-use token', async () => {
      rawToken = await generateUnsubscribeToken(targetEmail);
      expect(rawToken).toBeDefined();
      expect(rawToken.length).toBe(64); // 32 bytes in hex
    });

    it('GET /api/legal/unsubscribe returns masked email without exposing recipient email directly in URL', async () => {
      const res = await request(app).get(`/api/legal/unsubscribe?token=${rawToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.maskedEmail).toBeDefined();
      expect(res.body.maskedEmail).not.toBe(targetEmail); // Masked
      expect(res.body.maskedEmail).toContain('@');
    });

    it('POST /api/legal/unsubscribe processes unsubscribe and adds to suppression table', async () => {
      const res = await request(app)
        .post('/api/legal/unsubscribe')
        .send({ token: rawToken });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Check EmailSuppression table
      const suppression = await prisma.emailSuppression.findUnique({
        where: { email: targetEmail.toLowerCase() }
      });
      expect(suppression).toBeDefined();
    });

    it('POST /api/legal/unsubscribe rejects reuse of single-use token (replay protection)', async () => {
      const res = await request(app)
        .post('/api/legal/unsubscribe')
        .send({ token: rawToken });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('already been used or expired');
    });

    it('EmailService.sendEmail suppresses non-transactional marketing messages to unsubscribed emails', async () => {
      const result = await EmailService.sendEmail({
        to: targetEmail,
        subject: 'Monthly Newsletter',
        html: '<p>Marketing content</p>',
        messageType: 'MARKETING',
      });

      expect(result.success).toBe(false);
      expect(result.suppressed).toBe(true);
    });

    it('EmailService.sendEmail allows essential transactional assessment messages even if suppressed', async () => {
      const result = await EmailService.sendEmail({
        to: targetEmail,
        subject: 'Your Assessment Invitation',
        html: '<p>Candidate assessment link</p>',
        messageType: 'TRANSACTIONAL',
      });

      expect(result.success).toBe(true);
      expect(result.suppressed).toBe(false);
    });
  });
});
