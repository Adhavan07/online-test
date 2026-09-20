import { describe, it, expect } from 'vitest';
import { prisma } from '../lib/prisma.js';
import { verifyPassword } from '../lib/crypto.js';

describe('PHASE 11: Database Migrations & Seed Verification Suite', () => {
  it('1. should verify company and default admin/recruiter users exist with secure password hashes', async () => {
    const company = await prisma.company.findFirst({
      where: { name: 'Acme Cloud Technologies' },
      include: { users: true }
    });

    expect(company).toBeDefined();
    expect(company?.users.length).toBeGreaterThanOrEqual(2);

    const admin = company?.users.find(u => u.role === 'ADMIN');
    const recruiter = company?.users.find(u => u.role === 'RECRUITER');

    expect(admin).toBeDefined();
    expect(recruiter).toBeDefined();

    // Verify passwords are securely hashed (not plaintext)
    expect(admin?.passwordHash).not.toBe('Admin@123456');
    expect(admin?.passwordHash).toMatch(/^[a-f0-9]{32}:[a-f0-9]{128}$/);
    expect(verifyPassword('Admin@123456', admin?.passwordHash || '')).toBe(true);

    expect(recruiter?.passwordHash).not.toBe('Recruiter@123456');
    expect(recruiter?.passwordHash).toMatch(/^[a-f0-9]{32}:[a-f0-9]{128}$/);
    expect(verifyPassword('Recruiter@123456', recruiter?.passwordHash || '')).toBe(true);
  });

  it('2. should verify assessment templates, sections, and question hierarchy', async () => {
    const templates = await prisma.assessmentTemplate.findMany({
      include: {
        sections: {
          include: {
            questions: {
              include: {
                options: true
              }
            }
          }
        }
      }
    });

    expect(templates.length).toBeGreaterThanOrEqual(2);

    const devopsTemplate = templates.find(t => t.roleCategory === 'DEVOPS');
    expect(devopsTemplate).toBeDefined();
    expect(devopsTemplate?.sections.length).toBeGreaterThanOrEqual(3);

    // Verify questions and options exist
    const gitSection = devopsTemplate?.sections.find(s => s.title.includes('Git'));
    expect(gitSection).toBeDefined();
    expect(gitSection?.questions.length).toBeGreaterThanOrEqual(1);

    const firstQuestion = gitSection?.questions[0];
    expect(firstQuestion?.prompt).toBeDefined();
    expect(firstQuestion?.options.length).toBeGreaterThanOrEqual(2);
    expect(firstQuestion?.options.some(o => o.isCorrect)).toBe(true);
  });

  it('3. should verify jobs are correctly linked to company and templates', async () => {
    const jobs = await prisma.job.findMany({
      include: {
        company: true,
        assessmentTemplate: true,
        applications: true,
      }
    });

    expect(jobs.length).toBeGreaterThanOrEqual(2);

    for (const job of jobs) {
      expect(job.companyId).toBeDefined();
      expect(job.company).toBeDefined();
      expect(job.passThreshold).toBeGreaterThan(0);
      expect(job.skillsRequired).toBeDefined();
      expect(() => JSON.parse(job.skillsRequired)).not.toThrow();
    }
  });

  it('4. should verify sample candidate applications, evaluation scores, and proctoring logs', async () => {
    const arunApp = await prisma.jobApplication.findFirst({
      where: { token: 'arun-devops-token-778899' },
      include: {
        candidate: true,
        attempts: {
          include: {
            result: true,
            proctoringLogs: true
          }
        }
      }
    });

    expect(arunApp).toBeDefined();
    expect(arunApp?.candidate.name).toBe('Arun Kumar');
    expect(arunApp?.status).toBe('HR_INTERVIEW');
    expect(arunApp?.attempts.length).toBeGreaterThan(0);

    const attempt = arunApp?.attempts[0];
    expect(attempt?.isCompleted).toBe(true);
    expect(attempt?.result?.isPassed).toBe(true);
    expect(attempt?.result?.percentage).toBeGreaterThan(70);
  });
});
