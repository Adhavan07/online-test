import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import path from 'path';
import fs from 'fs';
import { app } from '../index.js';
import { prisma } from '../lib/prisma.js';
import { hashPassword } from '../lib/crypto.js';

describe('PHASE 2: Multi-Tenant Isolation & Anti-IDOR Security Suite', () => {
  let companyA: any;
  let companyB: any;
  let recruiterA: any;
  let recruiterB: any;
  let adminA: any;
  let adminB: any;
  let tokenA: string;
  let tokenB: string;
  let tokenAdminA: string;
  let tokenAdminB: string;
  let jobA: any;
  let jobB: any;
  let candA: any;
  let candB: any;
  let appA: any;
  let appB: any;
  let templateB: any;
  let sectionB: any;
  let questionB: any;
  let attemptB: any;
  let webhookB: any;
  let noteB: any;
  const testSnapshotFilename = 'proctor-tenant-test-snapshot.jpg';
  const testResumeFilename = 'resume-tenant-test-b.pdf';

  beforeAll(async () => {
    // Clean up any stale records from previous runs
    await prisma.user.deleteMany({
      where: { email: { in: ['recruiter@alphacorp.io', 'recruiter@betasystems.io', 'admin@alphacorp.io', 'admin@betasystems.io'] } }
    }).catch(() => {});
    await prisma.candidate.deleteMany({
      where: { email: { in: ['alice@alpha-candidate.com', 'bob@beta-candidate.com', 'jordan.multi@example.com'] } }
    }).catch(() => {});
    await prisma.company.deleteMany({
      where: { name: { in: ['AlphaCorp Industries', 'BetaSystems Global'] } }
    }).catch(() => {});

    // 1. Create two distinct enterprise tenants
    companyA = await prisma.company.create({
      data: { name: 'AlphaCorp Industries' }
    });
    companyB = await prisma.company.create({
      data: { name: 'BetaSystems Global' }
    });

    // 2. Create recruiters and admins belonging to each company
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

    adminA = await prisma.user.create({
      data: {
        name: 'Admin Alpha',
        email: 'admin@alphacorp.io',
        passwordHash: hashPassword('AdminAlphaPass@2026'),
        role: 'ADMIN',
        companyId: companyA.id,
      }
    });

    adminB = await prisma.user.create({
      data: {
        name: 'Admin Beta',
        email: 'admin@betasystems.io',
        passwordHash: hashPassword('AdminBetaPass@2026'),
        role: 'ADMIN',
        companyId: companyB.id,
      }
    });

    // Authenticate users
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

    const loginAdminARes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@alphacorp.io', password: 'AdminAlphaPass@2026' });
    expect(loginAdminARes.status).toBe(200);
    tokenAdminA = loginAdminARes.body.token;

    const loginAdminBRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@betasystems.io', password: 'AdminBetaPass@2026' });
    expect(loginAdminBRes.status).toBe(200);
    tokenAdminB = loginAdminBRes.body.token;

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

    // Write real mock resume file for appB
    const resumesDir = path.join(process.cwd(), 'uploads', 'resumes');
    if (!fs.existsSync(resumesDir)) fs.mkdirSync(resumesDir, { recursive: true });
    const resumeFilePath = path.join(resumesDir, testResumeFilename);
    await fs.promises.writeFile(resumeFilePath, '%PDF-1.4 Mock Beta Resume for Bob');

    appB = await prisma.jobApplication.create({
      data: {
        candidateId: candB.id,
        jobId: jobB.id,
        status: 'INVITED',
        token: 'beta-test-token-bob',
        tokenExpiresAt: new Date(Date.now() + 86400000),
        resumeUrl: `/uploads/resumes/${testResumeFilename}`,
        resumeFileName: 'bob_resume.pdf',
        resumeParsedText: 'Experienced in AWS Terraform and Cloud Architecture',
      }
    });

    // 5. Create Template, Section, Question, and Attempt for Company B
    templateB = await prisma.assessmentTemplate.create({
      data: {
        title: 'Beta Cloud Template',
        roleCategory: 'Cloud',
        companyId: companyB.id,
      }
    });

    sectionB = await prisma.assessmentSection.create({
      data: {
        templateId: templateB.id,
        title: 'Cloud Architecture',
      }
    });

    questionB = await prisma.question.create({
      data: {
        sectionId: sectionB.id,
        prompt: 'Explain AWS VPC peering.',
        type: 'MCQ_SINGLE',
        difficulty: 'MEDIUM',
        options: {
          create: [
            { text: 'Non-transitive connection between VPCs', isCorrect: true },
            { text: 'Transitive internet router', isCorrect: false },
          ]
        }
      }
    });

    attemptB = await prisma.assessmentAttempt.create({
      data: {
        applicationId: appB.id,
        templateId: templateB.id,
        questionOrderJson: JSON.stringify([questionB.id]),
        isCompleted: false,
        startedAt: new Date(),
      }
    });

    // Write real mock proctoring snapshot for attemptB
    const snapshotsDir = path.join(process.cwd(), 'uploads', 'snapshots', attemptB.id);
    if (!fs.existsSync(snapshotsDir)) fs.mkdirSync(snapshotsDir, { recursive: true });
    const snapshotPath = path.join(snapshotsDir, testSnapshotFilename);
    await fs.promises.writeFile(snapshotPath, 'mock-jpeg-binary-proctor-snapshot');

    // Create a note for appB
    noteB = await prisma.recruiterNote.create({
      data: {
        applicationId: appB.id,
        authorName: 'Recruiter Beta',
        rating: 5,
        comment: 'Confidential BetaSystems hiring note',
      }
    });

    // Create a webhook for companyB
    webhookB = await prisma.webhookConfig.create({
      data: {
        name: 'Beta ATS Integration',
        endpointUrl: 'https://webhook.betasystems.io/ats',
        companyId: companyB.id,
        secretKey: 'whsec_beta_confidential_key',
        eventsJson: JSON.stringify(['candidate.completed']),
      }
    });
  });

  afterAll(async () => {
    // Clean up test tenant records
    await prisma.recruiterNote.deleteMany({ where: { applicationId: { in: [appA?.id, appB?.id] } } }).catch(() => {});
    if (attemptB?.id) {
      await prisma.candidateAnswer.deleteMany({ where: { attemptId: attemptB.id } }).catch(() => {});
      await prisma.proctoringLog.deleteMany({ where: { attemptId: attemptB.id } }).catch(() => {});
      await prisma.assessmentResult.deleteMany({ where: { attemptId: attemptB.id } }).catch(() => {});
      await prisma.assessmentAttempt.deleteMany({ where: { id: attemptB.id } }).catch(() => {});
    }
    await prisma.jobApplication.deleteMany({ where: { id: { in: [appA?.id, appB?.id] } } }).catch(() => {});
    await prisma.candidate.deleteMany({ where: { id: { in: [candA?.id, candB?.id] } } }).catch(() => {});
    if (questionB?.id) {
      await prisma.questionOption.deleteMany({ where: { questionId: questionB.id } }).catch(() => {});
      await prisma.question.deleteMany({ where: { id: questionB.id } }).catch(() => {});
    }
    if (sectionB?.id) await prisma.assessmentSection.deleteMany({ where: { id: sectionB.id } }).catch(() => {});
    if (templateB?.id) await prisma.assessmentTemplate.deleteMany({ where: { id: templateB.id } }).catch(() => {});
    if (webhookB?.id) await prisma.webhookConfig.deleteMany({ where: { id: webhookB.id } }).catch(() => {});
    await prisma.job.deleteMany({ where: { id: { in: [jobA?.id, jobB?.id] } } }).catch(() => {});
    await prisma.user.deleteMany({ where: { id: { in: [recruiterA?.id, recruiterB?.id, adminA?.id, adminB?.id] } } }).catch(() => {});
    await prisma.company.deleteMany({ where: { id: { in: [companyA?.id, companyB?.id] } } }).catch(() => {});

    // Clean up temporary files
    if (attemptB?.id) {
      const snapshotPath = path.join(process.cwd(), 'uploads', 'snapshots', attemptB.id, testSnapshotFilename);
      await fs.promises.unlink(snapshotPath).catch(() => {});
    }
    const resumeFilePath = path.join(process.cwd(), 'uploads', 'resumes', testResumeFilename);
    await fs.promises.unlink(resumeFilePath).catch(() => {});
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

  describe('Cross-Tenant IDOR Prevention Across All Company Resources', () => {
    it('Recruiter A requesting Company B candidate detail dossier receives 403 Forbidden', async () => {
      const res = await request(app)
        .get(`/api/candidates/detail/${appB.id}`)
        .set('Authorization', `Bearer ${tokenA}`);
      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('Forbidden');
    });

    it('Recruiter A attempting to access Company B candidate resume receives 403 Forbidden', async () => {
      const res = await request(app)
        .get(`/api/candidates/${appB.id}/resume`)
        .set('Authorization', `Bearer ${tokenA}`);
      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('Forbidden');
    });

    it('Recruiter A attempting to access Company B proctoring snapshots receives 403 Forbidden', async () => {
      const res = await request(app)
        .get(`/api/candidates/${appB.id}/snapshots/${testSnapshotFilename}`)
        .set('Authorization', `Bearer ${tokenA}`);
      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('Forbidden');
    });

    it('Recruiter A attempting to read Company B candidate notes receives 403 Forbidden', async () => {
      const res = await request(app)
        .get(`/api/candidates/${appB.id}/notes`)
        .set('Authorization', `Bearer ${tokenA}`);
      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('Forbidden');
    });

    it('Recruiter A attempting to add note to Company B candidate receives 403 Forbidden', async () => {
      const res = await request(app)
        .post(`/api/candidates/${appB.id}/notes`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ comment: 'Malicious cross-company note', rating: 1 });
      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
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

    it('Recruiter A attempting to re-test Company B candidate receives 403 Forbidden', async () => {
      const res = await request(app)
        .post(`/api/candidates/${appB.id}/reset-attempt`)
        .set('Authorization', `Bearer ${tokenA}`);
      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('Recruiter A attempting to schedule interview for Company B candidate receives 403 Forbidden', async () => {
      const res = await request(app)
        .post(`/api/candidates/${appB.id}/schedule-interview`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ interviewScheduledAt: new Date(Date.now() + 86400000).toISOString() });
      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('Recruiter A attempting to create live interview room for Company B candidate receives 403 Forbidden', async () => {
      const res = await request(app)
        .post('/api/interviews/create-room')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ applicationId: appB.id });
      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('Recruiter A attempting to inspect Company B assessment attempt questions receives 403 Forbidden', async () => {
      const res = await request(app)
        .get(`/api/assessment/question/${attemptB.id}?index=0`)
        .set('Authorization', `Bearer ${tokenA}`);
      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('Access denied');
    });

    it('Recruiter A attempting to submit answer to Company B assessment attempt receives 403 Forbidden', async () => {
      const res = await request(app)
        .post('/api/assessment/submit-answer')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          attemptId: attemptB.id,
          questionId: questionB.id,
          selectedOptionIds: ['malicious-option'],
          timeSpentSeconds: 10,
        });
      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('Access denied');
    });

    it('Recruiter A attempting to finish/evaluate Company B assessment attempt receives 403 Forbidden', async () => {
      const res = await request(app)
        .post('/api/assessment/finish')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ attemptId: attemptB.id });
      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('Access denied');
    });

    it('Recruiter A attempting to access Company B webhooks receives 403 Forbidden (RBAC)', async () => {
      const res = await request(app)
        .get('/api/webhooks')
        .set('Authorization', `Bearer ${tokenA}`);
      expect(res.status).toBe(403);
    });

    it('Admin A listing webhooks sees only Company A webhooks and not Company B webhooks', async () => {
      const res = await request(app)
        .get('/api/webhooks')
        .set('Authorization', `Bearer ${tokenAdminA}`);
      expect(res.status).toBe(200);
      const webhookNames = res.body.webhooks.map((w: any) => w.name);
      expect(webhookNames).not.toContain('Beta ATS Integration');
    });

    it('Admin A attempting to test-dispatch Company B webhook receives 404 (isolated to own company)', async () => {
      const res = await request(app)
        .post('/api/webhooks/test-dispatch')
        .set('Authorization', `Bearer ${tokenAdminA}`)
        .send({ webhookId: webhookB.id });
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('Webhook configuration not found');
    });
  });

  describe('Multi-Company Candidate Isolation & Resume Separation', () => {
    let multiCand: any;
    let multiAppA: any;
    let multiAppB: any;

    beforeAll(async () => {
      // Single candidate profile applying to both Company A and Company B
      multiCand = await prisma.candidate.create({
        data: {
          name: 'Multi Candidate Jordan',
          email: 'jordan.multi@example.com',
        }
      });

      // Application to Company A (Lead DevOps requiring Docker & Kubernetes)
      multiAppA = await prisma.jobApplication.create({
        data: {
          candidateId: multiCand.id,
          jobId: jobA.id,
          status: 'INVITED',
          token: 'token-jordan-alpha',
          tokenExpiresAt: new Date(Date.now() + 86400000),
          resumeUrl: '/uploads/resumes/jordan-devops.pdf',
          resumeFileName: 'jordan-devops.pdf',
          resumeParsedText: 'Senior DevOps Specialist expert in Kubernetes, Docker, Helm, and CI/CD pipelines.',
          resumeMatchScore: 95,
          resumeParsedSkills: JSON.stringify(['Docker', 'Kubernetes']),
        }
      });

      // Application to Company B (Cloud Architect requiring AWS & Terraform)
      multiAppB = await prisma.jobApplication.create({
        data: {
          candidateId: multiCand.id,
          jobId: jobB.id,
          status: 'INVITED',
          token: 'token-jordan-beta',
          tokenExpiresAt: new Date(Date.now() + 86400000),
          resumeUrl: '/uploads/resumes/jordan-cloud.pdf',
          resumeFileName: 'jordan-cloud.pdf',
          resumeParsedText: 'Cloud Solutions Architect with in-depth knowledge of AWS, Terraform, IAM, and VPC.',
          resumeMatchScore: 90,
          resumeParsedSkills: JSON.stringify(['AWS', 'Terraform']),
        }
      });
    });

    afterAll(async () => {
      await prisma.jobApplication.deleteMany({ where: { id: { in: [multiAppA.id, multiAppB.id] } } }).catch(() => {});
      await prisma.candidate.deleteMany({ where: { id: multiCand.id } }).catch(() => {});
    });

    it('Company A recruiter only sees Jordan application for Company A with DevOps resume', async () => {
      const res = await request(app)
        .get(`/api/candidates/detail/${multiAppA.id}`)
        .set('Authorization', `Bearer ${tokenA}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.detail.candidate.name).toBe('Multi Candidate Jordan');
      expect(res.body.detail.job.title).toBe('AlphaCorp Lead DevOps');
      expect(res.body.detail.candidate.resumeFileName).toBe('jordan-devops.pdf');
      expect(res.body.detail.resumeMatch.matchScore).toBe(95);
      expect(res.body.detail.resumeMatch.matchedSkills).toContain('Docker');
    });

    it('Company A recruiter cannot see Jordan application for Company B (403 Forbidden)', async () => {
      const res = await request(app)
        .get(`/api/candidates/detail/${multiAppB.id}`)
        .set('Authorization', `Bearer ${tokenA}`);
      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('Company B recruiter only sees Jordan application for Company B with Cloud Architect resume', async () => {
      const res = await request(app)
        .get(`/api/candidates/detail/${multiAppB.id}`)
        .set('Authorization', `Bearer ${tokenB}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.detail.candidate.name).toBe('Multi Candidate Jordan');
      expect(res.body.detail.job.title).toBe('BetaSystems Cloud Architect');
      expect(res.body.detail.candidate.resumeFileName).toBe('jordan-cloud.pdf');
      expect(res.body.detail.resumeMatch.matchScore).toBe(90);
      expect(res.body.detail.resumeMatch.matchedSkills).toContain('AWS');
    });

    it('Company B recruiter cannot see Jordan application for Company A (403 Forbidden)', async () => {
      const res = await request(app)
        .get(`/api/candidates/detail/${multiAppA.id}`)
        .set('Authorization', `Bearer ${tokenB}`);
      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('Resumes and scores for the two applications remain distinct and not overwritten', async () => {
      const appARecord = await prisma.jobApplication.findUnique({ where: { id: multiAppA.id } });
      const appBRecord = await prisma.jobApplication.findUnique({ where: { id: multiAppB.id } });

      expect(appARecord?.resumeFileName).toBe('jordan-devops.pdf');
      expect(appARecord?.resumeParsedText).toContain('Kubernetes');
      expect(appARecord?.resumeMatchScore).toBe(95);

      expect(appBRecord?.resumeFileName).toBe('jordan-cloud.pdf');
      expect(appBRecord?.resumeParsedText).toContain('AWS');
      expect(appBRecord?.resumeMatchScore).toBe(90);
    });
  });
});
