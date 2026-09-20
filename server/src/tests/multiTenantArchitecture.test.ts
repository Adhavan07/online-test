import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import path from 'path';
import fs from 'fs';
import { app } from '../index.js';
import { prisma } from '../lib/prisma.js';
import { hashPassword } from '../lib/crypto.js';

describe('PHASE 14: Multi-Tenant Architecture & Workspace Isolation Suite', () => {
  let cyberdyneTenant: any;
  let cyberdyneToken: string;
  let cyberdyneUser: any;
  let omniCorpTenant: any;
  let omniCorpToken: string;
  let omniCorpUser: any;
  let superAdminUser: any;
  let superAdminToken: string;

  let cyberdyneJob: any;
  let omniCorpJob: any;
  let cyberdyneApp: any;

  const testResumePath = path.join(process.cwd(), 'uploads', 'test-tenant-sample-resume.pdf');

  beforeAll(async () => {
    // Clean up test tenants if existing
    await prisma.user.deleteMany({
      where: {
        email: {
          in: [
            'sarah@cyberdyne.io',
            'john@cyberdyne.io',
            'dick.jones@omnicorp.com',
            'superadmin@techscreen.io'
          ]
        }
      }
    }).catch(() => {});

    await prisma.company.deleteMany({
      where: {
        slug: { in: ['cyberdyne', 'omnicorp', 'test-dup-slug'] }
      }
    }).catch(() => {});

    // Create Super Admin (companyId is null)
    superAdminUser = await prisma.user.create({
      data: {
        name: 'Platform Super Administrator',
        email: 'superadmin@techscreen.io',
        passwordHash: hashPassword('SuperSecureAdmin@2026'),
        role: 'ADMIN',
        companyId: null
      }
    });

    const superAdminLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'superadmin@techscreen.io', password: 'SuperSecureAdmin@2026' });
    expect(superAdminLogin.status).toBe(200);
    superAdminToken = superAdminLogin.body.token;

    // Create a dummy PDF for file upload testing
    const fakePdfHeader = Buffer.from('%PDF-1.4\n%âãÏÓ\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF');
    await fs.promises.writeFile(testResumePath, fakePdfHeader);
  });

  afterAll(async () => {
    if (fs.existsSync(testResumePath)) {
      await fs.promises.unlink(testResumePath).catch(() => {});
    }

    // Clean up created files in uploads/tenants
    if (cyberdyneTenant?.id) {
      const cyberdyneDir = path.join(process.cwd(), 'uploads', 'tenants', cyberdyneTenant.id);
      if (fs.existsSync(cyberdyneDir)) {
        await fs.promises.rm(cyberdyneDir, { recursive: true, force: true }).catch(() => {});
      }
    }
    if (omniCorpTenant?.id) {
      const omniDir = path.join(process.cwd(), 'uploads', 'tenants', omniCorpTenant.id);
      if (fs.existsSync(omniDir)) {
        await fs.promises.rm(omniDir, { recursive: true, force: true }).catch(() => {});
      }
    }

    await prisma.user.deleteMany({
      where: {
        email: {
          in: [
            'sarah@cyberdyne.io',
            'john@cyberdyne.io',
            'dick.jones@omnicorp.com',
            'superadmin@techscreen.io'
          ]
        }
      }
    }).catch(() => {});

    await prisma.company.deleteMany({
      where: {
        slug: { in: ['cyberdyne', 'omnicorp', 'test-dup-slug'] }
      }
    }).catch(() => {});
  });

  describe('1. Self-Service Tenant Onboarding & Registration', () => {
    it('successfully registers a new tenant organization with starter templates and issued JWT', async () => {
      const res = await request(app)
        .post('/api/tenants/register')
        .send({
          companyName: 'Cyberdyne Systems',
          slug: 'cyberdyne',
          adminName: 'Sarah Connor',
          adminEmail: 'sarah@cyberdyne.io',
          adminPassword: 'Password@Cyberdyne2026',
          brandColor: '#dc2626'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.token).toBeDefined();
      expect(res.body.tenant.slug).toBe('cyberdyne');
      expect(res.body.tenant.name).toBe('Cyberdyne Systems');
      expect(res.body.tenant.brandColor).toBe('#dc2626');
      expect(res.body.user.role).toBe('HR_ADMIN');

      cyberdyneTenant = res.body.tenant;
      cyberdyneToken = res.body.token;
      cyberdyneUser = res.body.user;

      // Verify starter assessment template was created for this tenant
      const templates = await prisma.assessmentTemplate.findMany({
        where: { companyId: cyberdyneTenant.id }
      });
      expect(templates.length).toBeGreaterThanOrEqual(1);
      expect(templates[0].title).toContain('Full-Stack');
    });

    it('registers a second isolated tenant organization (Omni Consumer Products)', async () => {
      const res = await request(app)
        .post('/api/tenants/register')
        .send({
          companyName: 'Omni Consumer Products',
          slug: 'omnicorp',
          adminName: 'Dick Jones',
          adminEmail: 'dick.jones@omnicorp.com',
          adminPassword: 'Password@OmniCorp2026',
          brandColor: '#2563eb'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.tenant.slug).toBe('omnicorp');

      omniCorpTenant = res.body.tenant;
      omniCorpToken = res.body.token;
      omniCorpUser = res.body.user;
    });

    it('rejects duplicate tenant slug with HTTP 409 Conflict', async () => {
      const res = await request(app)
        .post('/api/tenants/register')
        .send({
          companyName: 'Cyberdyne Clone',
          slug: 'cyberdyne',
          adminName: 'Imposter',
          adminEmail: 'imposter@cyberdyne.io',
          adminPassword: 'Password@123456'
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('already in use');
    });

    it('rejects invalid or unsafe slug formats', async () => {
      const res = await request(app)
        .post('/api/tenants/register')
        .send({
          companyName: 'Bad Slug Corp',
          slug: '-invalid--slug-',
          adminName: 'Admin',
          adminEmail: 'bad@slug.io',
          adminPassword: 'Password@123456'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('2. Public Tenant Resolution & Brand Retrieval', () => {
    it('resolves tenant branding by slug', async () => {
      const res = await request(app)
        .get('/api/tenants/resolve/cyberdyne');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.tenant.name).toBe('Cyberdyne Systems');
      expect(res.body.tenant.brandColor).toBe('#dc2626');
    });

    it('returns 404 for unknown tenant slug', async () => {
      const res = await request(app)
        .get('/api/tenants/resolve/non-existent-enterprise-xyz');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  describe('3. Dynamic Tenant Resolution Middleware', () => {
    it('resolves tenant context via X-Tenant-Slug header', async () => {
      const res = await request(app)
        .get('/api/tenants/current')
        .set('Authorization', `Bearer ${cyberdyneToken}`)
        .set('X-Tenant-Slug', 'cyberdyne');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.tenant.slug).toBe('cyberdyne');
    });

    it('resolves tenant context via Subdomain Host header', async () => {
      const res = await request(app)
        .get('/api/tenants/current')
        .set('Authorization', `Bearer ${cyberdyneToken}`)
        .set('Host', 'cyberdyne.techscreen.io');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.tenant.slug).toBe('cyberdyne');
    });
  });

  describe('4. Tenant Data Isolation & Cross-Tenant Boundary Enforcement', () => {
    it('allows Cyberdyne to create a job opening', async () => {
      const res = await request(app)
        .post('/api/jobs')
        .set('Authorization', `Bearer ${cyberdyneToken}`)
        .send({
          title: 'Cybernetics Deep Learning Engineer',
          experienceRange: '3-5 years',
          location: 'Sunnyvale, CA',
          skillsRequired: ['Neural Networks', 'C++', 'CUDA', 'Python'],
          description: 'Design autonomous neural network frameworks.'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      cyberdyneJob = res.body.job;
      expect(cyberdyneJob.companyId).toBe(cyberdyneTenant.id);
    });

    it('allows OmniCorp to create their own job opening', async () => {
      const res = await request(app)
        .post('/api/jobs')
        .set('Authorization', `Bearer ${omniCorpToken}`)
        .send({
          title: 'ED-209 Robotics Architect',
          experienceRange: '5+ years',
          location: 'Detroit, MI',
          skillsRequired: ['Robotics', 'Embedded C', 'Real-Time Linux'],
          description: 'Construct next-generation urban pacification robotics.'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      omniCorpJob = res.body.job;
      expect(omniCorpJob.companyId).toBe(omniCorpTenant.id);
    });

    it('strictly isolates jobs between Cyberdyne and OmniCorp in GET /api/jobs', async () => {
      // Cyberdyne's job list
      const cyberdyneJobs = await request(app)
        .get('/api/jobs')
        .set('Authorization', `Bearer ${cyberdyneToken}`);

      expect(cyberdyneJobs.status).toBe(200);
      const cTitles = cyberdyneJobs.body.jobs.map((j: any) => j.title);
      expect(cTitles).toContain('Cybernetics Deep Learning Engineer');
      expect(cTitles).not.toContain('ED-209 Robotics Architect');

      // OmniCorp's job list
      const omniJobs = await request(app)
        .get('/api/jobs')
        .set('Authorization', `Bearer ${omniCorpToken}`);

      expect(omniJobs.status).toBe(200);
      const oTitles = omniJobs.body.jobs.map((j: any) => j.title);
      expect(oTitles).toContain('ED-209 Robotics Architect');
      expect(oTitles).not.toContain('Cybernetics Deep Learning Engineer');
    });

    it('creates a candidate application for Cyberdyne job and verifies isolation', async () => {
      const applyRes = await request(app)
        .post('/api/candidates/apply')
        .field('name', 'John Connor')
        .field('email', 'john@cyberdyne.io')
        .field('phone', '+1-555-0199')
        .field('jobId', cyberdyneJob.id)
        .attach('resume', testResumePath, 'john-connor-resume.pdf');

      expect(applyRes.status).toBe(200);
      expect(applyRes.body.success).toBe(true);

      const applications = await prisma.jobApplication.findMany({
        where: { jobId: cyberdyneJob.id },
        include: { candidate: true }
      });
      expect(applications.length).toBe(1);
      cyberdyneApp = applications[0];

      // Verify resume is physically partitioned into Cyberdyne's tenant folder
      expect(cyberdyneApp.resumeUrl).toContain(`/uploads/tenants/${cyberdyneTenant.id}/resumes/`);

      // OmniCorp cannot see Cyberdyne's candidate in GET /api/candidates
      const omniCandidates = await request(app)
        .get('/api/candidates')
        .set('Authorization', `Bearer ${omniCorpToken}`);

      expect(omniCandidates.status).toBe(200);
      const candidateEmails = omniCandidates.body.candidates.map((c: any) => c.email);
      expect(candidateEmails).not.toContain('john@cyberdyne.io');

      // Cyberdyne CAN see their own candidate
      const cyberdyneCandidates = await request(app)
        .get('/api/candidates')
        .set('Authorization', `Bearer ${cyberdyneToken}`);

      expect(cyberdyneCandidates.status).toBe(200);
      const cEmails = cyberdyneCandidates.body.candidates.map((c: any) => c.email);
      expect(cEmails).toContain('john@cyberdyne.io');
    });

    it('rejects cross-tenant resume streaming with HTTP 403 Forbidden', async () => {
      // OmniCorp recruiter trying to fetch Cyberdyne candidate resume
      const res = await request(app)
        .get(`/api/candidates/${cyberdyneApp.id}/resume`)
        .set('Authorization', `Bearer ${omniCorpToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('Forbidden');
    });

    it('allows Cyberdyne recruiter to stream their candidate resume with HTTP 200', async () => {
      const res = await request(app)
        .get(`/api/candidates/${cyberdyneApp.id}/resume`)
        .set('Authorization', `Bearer ${cyberdyneToken}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('application/pdf');
    });
  });

  describe('5. Tenant Branding & Customization Settings', () => {
    it('allows tenant admin to update brand settings and custom color', async () => {
      const updateRes = await request(app)
        .patch('/api/tenants/settings')
        .set('Authorization', `Bearer ${cyberdyneToken}`)
        .send({
          name: 'Cyberdyne AI Corporation',
          brandColor: '#10b981',
          settings: {
            defaultPassThreshold: 85,
            proctoringStrictness: 'MAXIMUM'
          }
        });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.success).toBe(true);
      expect(updateRes.body.tenant.name).toBe('Cyberdyne AI Corporation');
      expect(updateRes.body.tenant.brandColor).toBe('#10b981');

      // Verify updated settings returned in current
      const currentRes = await request(app)
        .get('/api/tenants/current')
        .set('Authorization', `Bearer ${cyberdyneToken}`);

      expect(currentRes.status).toBe(200);
      expect(currentRes.body.tenant.name).toBe('Cyberdyne AI Corporation');
      expect(currentRes.body.tenant.settings.defaultPassThreshold).toBe(85);
    });

    it('prevents standard recruiter from modifying tenant settings without HR_ADMIN or ADMIN role', async () => {
      // Create regular recruiter user under Cyberdyne
      const regularRecruiter = await prisma.user.create({
        data: {
          name: 'Recruiter Kyle',
          email: 'kyle@cyberdyne.io',
          passwordHash: hashPassword('Pass@123456'),
          role: 'RECRUITER',
          companyId: cyberdyneTenant.id
        }
      });

      const login = await request(app)
        .post('/api/auth/login')
        .send({ email: 'kyle@cyberdyne.io', password: 'Pass@123456' });
      const recToken = login.body.token;

      const res = await request(app)
        .patch('/api/tenants/settings')
        .set('Authorization', `Bearer ${recToken}`)
        .send({ name: 'Hacked Name' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);

      await prisma.user.delete({ where: { id: regularRecruiter.id } });
    });
  });

  describe('6. Platform Super-Admin Multi-Tenant Oversight', () => {
    it('allows Platform Super Admin to view global directory of all registered tenants', async () => {
      const res = await request(app)
        .get('/api/tenants')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.tenants)).toBe(true);

      const slugs = res.body.tenants.map((t: any) => t.slug);
      expect(slugs).toContain('cyberdyne');
      expect(slugs).toContain('omnicorp');
    });

    it('rejects tenant admin from accessing the global tenants directory', async () => {
      const res = await request(app)
        .get('/api/tenants')
        .set('Authorization', `Bearer ${cyberdyneToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('allows Platform Super Admin to suspend and reactivate a tenant', async () => {
      // 1. Suspend OmniCorp
      const suspendRes = await request(app)
        .patch(`/api/tenants/${omniCorpTenant.id}/status`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ status: 'SUSPENDED' });

      expect(suspendRes.status).toBe(200);
      expect(suspendRes.body.tenant.status).toBe('SUSPENDED');

      // 2. OmniCorp requests should now be blocked with 403 Suspended
      const blockedRes = await request(app)
        .get('/api/jobs')
        .set('Authorization', `Bearer ${omniCorpToken}`);

      expect(blockedRes.status).toBe(403);
      expect(blockedRes.body.error).toContain('suspended');

      // 3. Reactivate OmniCorp
      const reactivateRes = await request(app)
        .patch(`/api/tenants/${omniCorpTenant.id}/status`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ status: 'ACTIVE' });

      expect(reactivateRes.status).toBe(200);
      expect(reactivateRes.body.tenant.status).toBe('ACTIVE');

      // 4. OmniCorp requests now succeed again
      const unblockedRes = await request(app)
        .get('/api/jobs')
        .set('Authorization', `Bearer ${omniCorpToken}`);

      expect(unblockedRes.status).toBe(200);
    });

    it('allows Platform Super Admin to switch active workspace context', async () => {
      const switchRes = await request(app)
        .post('/api/auth/switch-workspace')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ targetCompanyId: cyberdyneTenant.id });

      expect(switchRes.status).toBe(200);
      expect(switchRes.body.success).toBe(true);
      expect(switchRes.body.activeWorkspace.slug).toBe('cyberdyne');
      expect(switchRes.body.token).toBeDefined();

      // Verify new token operates inside Cyberdyne context
      const jobsRes = await request(app)
        .get('/api/jobs')
        .set('Authorization', `Bearer ${switchRes.body.token}`);

      expect(jobsRes.status).toBe(200);
      const titles = jobsRes.body.jobs.map((j: any) => j.title);
      expect(titles).toContain('Cybernetics Deep Learning Engineer');
    });
  });
});
