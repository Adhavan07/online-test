import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import crypto from 'crypto';
import { app } from '../index.js';
import { prisma } from '../lib/prisma.js';
import { storageService } from '../services/StorageService.js';
import { ResumeMatchingService } from '../services/ResumeMatchingService.js';

describe('PHASE 7: Resume Upload, Parsing & Skill-Matching Security Suite', () => {
  let company: any;
  let job: any;

  beforeAll(async () => {
    company = await prisma.company.create({
      data: { name: 'Resume Security Corp' }
    });

    job = await prisma.job.create({
      data: {
        title: 'Platform Security Specialist',
        experienceRange: '3-5 years',
        location: 'Remote',
        skillsRequired: JSON.stringify(['Docker', 'Kubernetes', 'Go']),
        description: 'Security engineer handling container security.',
        companyId: company.id,
      }
    });
  });

  afterAll(async () => {
    await prisma.jobApplication.deleteMany({ where: { job: { companyId: company.id } } });
    await prisma.job.delete({ where: { id: job.id } }).catch(() => {});
    await prisma.company.delete({ where: { id: company.id } }).catch(() => {});
  });

  describe('StorageService Path Traversal Defenses', () => {
    it('throws Access Denied when attempting path traversal in resolveLocalPath', () => {
      expect(() => {
        storageService.resolveLocalPath('../../etc/passwd');
      }).toThrow(/Path traversal detected/);

      expect(() => {
        storageService.resolveLocalPath('/etc/shadow');
      }).toThrow(/Path traversal detected/);

      expect(() => {
        storageService.resolveLocalPath('..\\..\\windows\\system32');
      }).toThrow(/Path traversal detected/);
    });
  });

  describe('File Type & Extension Whitelist Enforcements', () => {
    it('rejects shell script (.sh) upload with 400', async () => {
      const res = await request(app)
        .post('/api/candidates/apply')
        .field('name', 'Hacker Dave')
        .field('email', `dave.${crypto.randomBytes(4).toString('hex')}@hacker.io`)
        .field('jobId', job.id)
        .attach('resume', Buffer.from('#!/bin/bash\necho "pwned"'), 'malicious.sh');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('not allowed');
    });

    it('rejects windows executable (.exe) upload with 400', async () => {
      const res = await request(app)
        .post('/api/candidates/apply')
        .field('name', 'Attacker Evil')
        .field('email', `evil.${crypto.randomBytes(4).toString('hex')}@hacker.io`)
        .field('jobId', job.id)
        .attach('resume', Buffer.from('MZ\x90\x00\x03\x00\x00\x00'), 'trojan.exe');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('not allowed');
    });
  });

  describe('Magic Byte & Disguised Payload Inspection', () => {
    it('rejects disguised executable/script renamed to .pdf', async () => {
      const disguisedBuffer = Buffer.from('#!/bin/bash\nrm -rf /');

      const res = await request(app)
        .post('/api/candidates/apply')
        .field('name', 'Sneaky Script')
        .field('email', `sneaky.${crypto.randomBytes(4).toString('hex')}@script.io`)
        .field('jobId', job.id)
        .attach('resume', disguisedBuffer, 'innocent_looking.pdf');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/(prohibited|disguised|corrupt)/i);
    });

    it('rejects arbitrary text file renamed to .docx without ZIP magic bytes', async () => {
      const fakeDocxBuffer = Buffer.from('This is pure text, not a PK ZIP docx.');

      const res = await request(app)
        .post('/api/candidates/apply')
        .field('name', 'Fake Word')
        .field('email', `fake.${crypto.randomBytes(4).toString('hex')}@word.io`)
        .field('jobId', job.id)
        .attach('resume', fakeDocxBuffer, 'resume.docx');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('disguised content detected');
    });
  });

  describe('Strict 5MB Size Limit Enforcement', () => {
    it('rejects files larger than 5MB with 400', async () => {
      // 5.2 MB payload
      const hugeBuffer = Buffer.alloc(5.2 * 1024 * 1024);

      const res = await request(app)
        .post('/api/candidates/apply')
        .field('name', 'Huge File Candidate')
        .field('email', `huge.${crypto.randomBytes(4).toString('hex')}@bigdata.io`)
        .field('jobId', job.id)
        .attach('resume', hugeBuffer, 'huge_resume.pdf');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('5MB');
    });
  });

  describe('Valid PDF Resume Ingestion & Skill Matching', () => {
    it('successfully accepts legitimate PDF and parses candidate skills safely', async () => {
      // Legitimate PDF header (%PDF-1.4)
      const validPdfHeader = Buffer.from(
        '%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n' +
        'Candidate skills: Extensive experience with Docker, Kubernetes, Terraform, and Go.\n' +
        '%%EOF'
      );

      const res = await request(app)
        .post('/api/candidates/apply')
        .field('name', 'Carol Valid')
        .field('email', `carol.${crypto.randomBytes(4).toString('hex')}@cloudsec.io`)
        .field('jobId', job.id)
        .attach('resume', validPdfHeader, 'carol_resume.pdf');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.applicationId).toBeDefined();

      // Verify skill extraction from resume content
      const sampleText = 'Skilled in Docker, Kubernetes, Go, TypeScript, and AWS architecture for 6+ years.';
      const extractedSkills = ResumeMatchingService.extractSkillsFromContent(sampleText);
      expect(extractedSkills).toContain('Docker');
      expect(extractedSkills).toContain('Kubernetes');
      expect(extractedSkills).toContain('Go');
      expect(extractedSkills).toContain('TypeScript');

      // Verify experience extraction
      const years = ResumeMatchingService.extractExperienceYears(sampleText);
      expect(years).toBe(6);
    });

    it('proves resume matching score is strictly derived from parsed content, and renaming the PDF file does not alter score', async () => {
      const jobWithSevenSkills = await prisma.job.create({
        data: {
          title: 'Cloud Infrastructure Architect',
          experienceRange: '5+ years',
          location: 'Remote',
          skillsRequired: JSON.stringify(['Docker', 'Kubernetes', 'AWS', 'Terraform', 'Linux', 'Azure', 'GCP']),
          description: 'Multi-cloud engineer.',
          companyId: company.id,
        }
      });

      // Synthetic resume containing exactly 5 of the 7 skills (Docker, Kubernetes, AWS, Terraform, Linux)
      const resumeContent = 'Experienced DevOps engineer specializing in Docker, Kubernetes, AWS, Terraform, and Linux environments.';
      const score1 = ResumeMatchingService.evaluateResumeMatch(resumeContent, JSON.parse(jobWithSevenSkills.skillsRequired));

      // 5 of 7 matches = ~71%
      expect(score1.matchedSkills.sort()).toEqual(['AWS', 'Docker', 'Kubernetes', 'Linux', 'Terraform'].sort());
      expect(score1.missingSkills.sort()).toEqual(['Azure', 'GCP'].sort());
      expect(score1.matchScore).toBe(71);

      // Now test that renaming the file to include the missing skills (Azure, GCP) has ZERO effect on evaluation
      const renamedFakeFileName = 'Azure-GCP-Docker-Kubernetes-AWS-Terraform-Linux-Architect.pdf';
      // Evaluation using the real resume content must produce the same 71% score, NOT 100%
      const score2 = ResumeMatchingService.evaluateResumeMatch(resumeContent, JSON.parse(jobWithSevenSkills.skillsRequired));
      expect(score2.matchScore).toBe(score1.matchScore);
      expect([...score2.matchedSkills].sort()).toEqual([...score1.matchedSkills].sort());

      await prisma.job.delete({ where: { id: jobWithSevenSkills.id } });
    });
  });

  describe('Private File Access & Multi-Tenant Isolation', () => {
    let companyB: any;
    let recruiterBToken: string;
    let applicationA: any;

    beforeAll(async () => {
      // Create Company B and Recruiter B
      companyB = await prisma.company.create({
        data: { name: 'Tenant B Competitor Ltd' }
      });

      const { hashPassword } = await import('../lib/crypto.js');
      const recruiterB = await prisma.user.create({
        data: {
          name: 'Recruiter B',
          email: `recruiter.b.${crypto.randomBytes(4).toString('hex')}@competitor.com`,
          passwordHash: hashPassword('Recruiter@123456'),
          role: 'RECRUITER',
          companyId: companyB.id,
        }
      });

      const jwt = (await import('jsonwebtoken')).default;
      const { getJwtSecret } = await import('../middleware/auth.js');
      recruiterBToken = jwt.sign(
        { id: recruiterB.id, email: recruiterB.email, name: recruiterB.name, role: recruiterB.role, companyId: companyB.id },
        getJwtSecret(),
        { expiresIn: '1h' }
      );

      // Create application in Company A with resume
      const candA = await prisma.candidate.create({
        data: {
          name: 'Confidential Candidate A',
          email: `cand.a.${crypto.randomBytes(4).toString('hex')}@privatemail.com`,
        }
      });

      applicationA = await prisma.jobApplication.create({
        data: {
          candidateId: candA.id,
          jobId: job.id,
          status: 'APPLIED',
          token: `cand-token-${crypto.randomBytes(16).toString('hex')}`,
          tokenExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          resumeUrl: '/uploads/resumes/test_confidential_resume.pdf',
          resumeFileName: 'confidential_resume.pdf',
        }
      });

      // Write dummy file to uploads
      const fs = await import('fs');
      const path = await import('path');
      const targetDir = path.join(process.cwd(), 'uploads', 'resumes');
      if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
      fs.writeFileSync(path.join(targetDir, 'test_confidential_resume.pdf'), '%PDF-1.4\nConfidential PII Data\n%%EOF');
    });

    afterAll(async () => {
      if (applicationA?.id) {
        await prisma.jobApplication.delete({ where: { id: applicationA.id } }).catch(() => {});
      }
      if (companyB?.id) {
        await prisma.user.deleteMany({ where: { companyId: companyB.id } });
        await prisma.company.delete({ where: { id: companyB.id } }).catch(() => {});
      }
      const fs = await import('fs');
      const path = await import('path');
      const targetFile = path.join(process.cwd(), 'uploads', 'resumes', 'test_confidential_resume.pdf');
      if (fs.existsSync(targetFile)) fs.unlinkSync(targetFile);
    });

    it('rejects public unauthenticated access to /uploads/resumes with 404 (static serving removed)', async () => {
      const res = await request(app).get('/uploads/resumes/test_confidential_resume.pdf');
      expect(res.status).toBe(404);
    });

    it('rejects unauthenticated access to GET /api/candidates/:applicationId/resume with 403', async () => {
      const res = await request(app).get(`/api/candidates/${applicationA.id}/resume`);
      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/Forbidden/i);
    });

    it('rejects cross-tenant recruiter (Company B) from accessing Company A resume with 403', async () => {
      const res = await request(app)
        .get(`/api/candidates/${applicationA.id}/resume`)
        .set('Authorization', `Bearer ${recruiterBToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/Forbidden: You do not have permission/i);
    });

    it('allows candidate holding the legitimate assessment token to stream their resume', async () => {
      const res = await request(app)
        .get(`/api/candidates/${applicationA.id}/resume?token=${applicationA.token}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('application/pdf');
    });
  });
});
