import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma.js';
import { authenticateToken, requireRole, AuthenticatedRequest, getJwtSecret } from '../middleware/auth.js';
import { clearTenantCache, TenantRequest } from '../middleware/tenant.js';
import { hashPassword } from '../lib/crypto.js';
import { createRateLimiter } from '../middleware/rateLimit.js';

export const tenantsRouter = Router();

const registerRateLimiter = createRateLimiter({
  windowMs: 60000,
  max: 5,
  message: 'Too many workspace registration requests. Please wait a minute before trying again.'
});

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function sanitizeSlug(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Public Self-Service Tenant Onboarding
 * Registers a new company, creates the initial workspace admin, seeds starter templates,
 * and returns an active JWT session.
 */
tenantsRouter.post('/register', registerRateLimiter, async (req, res) => {
  const { companyName, slug, adminName, adminEmail, adminPassword, brandColor } = req.body;

  try {
    // 1. Validation
    if (!companyName || typeof companyName !== 'string' || companyName.trim().length < 2) {
      return res.status(400).json({ success: false, error: 'Company name must be at least 2 characters.' });
    }

    if (!adminName || typeof adminName !== 'string' || adminName.trim().length < 2) {
      return res.status(400).json({ success: false, error: 'Administrator name must be at least 2 characters.' });
    }

    if (!adminEmail || typeof adminEmail !== 'string') {
      return res.status(400).json({ success: false, error: 'Administrator email is required.' });
    }

    const normalizedEmail = adminEmail.trim().toLowerCase();
    if (!EMAIL_REGEX.test(normalizedEmail)) {
      return res.status(400).json({ success: false, error: 'Invalid administrator email address format.' });
    }

    if (!adminPassword || typeof adminPassword !== 'string' || adminPassword.length < 8) {
      return res.status(400).json({ success: false, error: 'Password must be at least 8 characters.' });
    }

    // Process & validate slug
    let candidateSlug: string;
    if (slug) {
      const rawSlug = String(slug).trim();
      if (!SLUG_REGEX.test(rawSlug)) {
        return res.status(400).json({
          success: false,
          error: 'Slug must contain only lowercase letters, numbers, and hyphens (no leading or trailing hyphens).'
        });
      }
      candidateSlug = rawSlug;
    } else {
      candidateSlug = sanitizeSlug(companyName);
      if (!candidateSlug || candidateSlug.length < 3) {
        candidateSlug = `${candidateSlug || 'workspace'}-${Math.random().toString(36).substring(2, 6)}`;
      }
    }

    if (!SLUG_REGEX.test(candidateSlug)) {
      return res.status(400).json({
        success: false,
        error: 'Slug must contain only lowercase letters, numbers, and hyphens (no leading or trailing hyphens).'
      });
    }

    // Check slug uniqueness
    const existingCompany = await prisma.company.findUnique({
      where: { slug: candidateSlug }
    });
    if (existingCompany) {
      return res.status(409).json({
        success: false,
        error: `The workspace slug '${candidateSlug}' is already in use. Please choose another slug.`
      });
    }

    // Check user email uniqueness
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail }
    });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: `An account with email '${normalizedEmail}' already exists. Please log in or use a different email.`
      });
    }

    // 2. Atomic Provisioning
    const result = await prisma.$transaction(async (tx) => {
      // A. Create Company
      const company = await tx.company.create({
        data: {
          name: companyName.trim(),
          slug: candidateSlug,
          brandColor: brandColor && /^#[0-9a-fA-F]{6}$/.test(brandColor) ? brandColor : '#2563eb',
          status: 'ACTIVE',
          plan: 'ENTERPRISE',
          settingsJson: JSON.stringify({
            defaultPassThreshold: 70,
            allowCandidateRetakes: false,
            proctoringStrictness: 'STANDARD',
            inviteExpirationDays: 7
          })
        }
      });

      // B. Create Workspace Owner (HR_ADMIN)
      const user = await tx.user.create({
        data: {
          name: adminName.trim(),
          email: normalizedEmail,
          passwordHash: hashPassword(adminPassword),
          role: 'HR_ADMIN',
          companyId: company.id
        }
      });

      // C. Seed Starter Assessment Template for the new Tenant
      const template = await tx.assessmentTemplate.create({
        data: {
          title: 'Full-Stack Software Engineer Screening',
          roleCategory: 'BACKEND',
          durationMinutes: 30,
          totalQuestions: 10,
          passPercentage: 70,
          shuffleQuestions: true,
          shuffleOptions: true,
          companyId: company.id,
          sections: {
            create: [
              {
                title: 'Data Structures & Algorithms',
                description: 'Core complexity analysis and computational logic.',
                questionCount: 5,
                questions: {
                  create: [
                    {
                      prompt: 'What is the average time complexity of searching an element in a balanced Binary Search Tree (BST)?',
                      type: 'MCQ_SINGLE',
                      difficulty: 'EASY',
                      explanation: 'A balanced BST divides search space in half at each step, yielding O(log n).',
                      options: {
                        create: [
                          { text: 'O(1)', isCorrect: false },
                          { text: 'O(log n)', isCorrect: true },
                          { text: 'O(n)', isCorrect: false },
                          { text: 'O(n log n)', isCorrect: false }
                        ]
                      }
                    },
                    {
                      prompt: 'Which data structure is best suited for implementing a breadth-first search (BFS) graph traversal?',
                      type: 'MCQ_SINGLE',
                      difficulty: 'EASY',
                      explanation: 'BFS explores vertices level by level using a FIFO Queue.',
                      options: {
                        create: [
                          { text: 'Stack (LIFO)', isCorrect: false },
                          { text: 'Queue (FIFO)', isCorrect: true },
                          { text: 'Binary Heap', isCorrect: false },
                          { text: 'Hash Map', isCorrect: false }
                        ]
                      }
                    }
                  ]
                }
              },
              {
                title: 'System Architecture & Web APIs',
                description: 'REST, HTTP protocols, caching, and database design.',
                questionCount: 5,
                questions: {
                  create: [
                    {
                      prompt: 'Which HTTP method is idempotent and used to replace an entire resource at a known URI?',
                      type: 'MCQ_SINGLE',
                      difficulty: 'EASY',
                      explanation: 'PUT is defined by RFC 7231 as idempotent complete resource replacement.',
                      options: {
                        create: [
                          { text: 'POST', isCorrect: false },
                          { text: 'PATCH', isCorrect: false },
                          { text: 'PUT', isCorrect: true },
                          { text: 'DELETE', isCorrect: false }
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

      // D. Audit Log
      await tx.auditLog.create({
        data: {
          userId: user.id,
          userName: user.name,
          companyId: company.id,
          action: 'TENANT_ONBOARDED',
          entity: 'Company',
          details: `Organization workspace '${company.name}' (${company.slug}) registered by ${user.email}`
        }
      });

      return { company, user, template };
    });

    clearTenantCache();

    // 3. Issue Token
    const secret = getJwtSecret();
    const tokenPayload = {
      id: result.user.id,
      email: result.user.email,
      name: result.user.name,
      role: result.user.role,
      companyId: result.company.id
    };
    const token = jwt.sign(tokenPayload, secret, { expiresIn: '8h' });

    res.status(201).json({
      success: true,
      token,
      user: {
        id: result.user.id,
        name: result.user.name,
        email: result.user.email,
        role: result.user.role,
        companyId: result.company.id,
        company: {
          id: result.company.id,
          name: result.company.name,
          slug: result.company.slug,
          logoUrl: result.company.logoUrl,
          brandColor: result.company.brandColor,
          plan: result.company.plan
        }
      },
      tenant: {
        id: result.company.id,
        name: result.company.name,
        slug: result.company.slug,
        brandColor: result.company.brandColor,
        plan: result.company.plan,
        status: result.company.status
      }
    });
  } catch (err: any) {
    console.error('[TENANT REGISTRATION ERROR]', err);
    res.status(500).json({ success: false, error: err.message || 'Failed to register organization workspace.' });
  }
});

/**
 * Public Tenant Resolver by Slug or Domain
 * Used by frontend to dynamically skin login screens or candidate flows
 */
tenantsRouter.get('/resolve/:slugOrDomain', async (req, res) => {
  const { slugOrDomain } = req.params;

  try {
    const company = await prisma.company.findFirst({
      where: {
        OR: [
          { slug: slugOrDomain.toLowerCase().trim() },
          { domain: slugOrDomain.toLowerCase().trim() },
          { id: slugOrDomain }
        ]
      },
      select: {
        id: true,
        name: true,
        slug: true,
        domain: true,
        logoUrl: true,
        brandColor: true,
        status: true,
        plan: true
      }
    });

    if (!company) {
      return res.status(404).json({ success: false, error: 'Organization workspace not found.' });
    }

    res.json({ success: true, tenant: company });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Get Current Tenant Details & Metrics (Authenticated Recruiter / Admin)
 */
tenantsRouter.get('/current', authenticateToken, async (req: AuthenticatedRequest & TenantRequest, res) => {
  try {
    const tenantId = req.tenant?.id || req.user?.companyId;

    if (!tenantId) {
      // If super admin without specific tenant
      if (req.user?.role === 'ADMIN') {
        return res.json({
          success: true,
          tenant: null,
          isSuperAdmin: true
        });
      }
      return res.status(404).json({ success: false, error: 'No active organization workspace associated with account.' });
    }

    const company = await prisma.company.findUnique({
      where: { id: tenantId },
      include: {
        _count: {
          select: {
            users: true,
            jobs: true,
            templates: true,
            webhooks: true
          }
        }
      }
    });

    if (!company) {
      return res.status(404).json({ success: false, error: 'Tenant workspace not found.' });
    }

    let settings = {};
    if (company.settingsJson) {
      try {
        settings = JSON.parse(company.settingsJson);
      } catch {}
    }

    res.json({
      success: true,
      tenant: {
        id: company.id,
        name: company.name,
        slug: company.slug,
        domain: company.domain,
        status: company.status,
        plan: company.plan,
        brandColor: company.brandColor,
        logoUrl: company.logoUrl,
        settings,
        metrics: company._count,
        createdAt: company.createdAt
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Update Tenant Settings & Branding (HR_ADMIN or ADMIN)
 */
tenantsRouter.patch('/settings', authenticateToken, requireRole(['HR_ADMIN', 'ADMIN']), async (req: AuthenticatedRequest & TenantRequest, res) => {
  const { name, logoUrl, brandColor, settings } = req.body;
  const tenantId = req.tenant?.id || req.user?.companyId;

  if (!tenantId) {
    return res.status(400).json({ success: false, error: 'Tenant context required.' });
  }

  try {
    const updateData: any = {};
    if (name && typeof name === 'string' && name.trim().length >= 2) {
      updateData.name = name.trim();
    }
    if (logoUrl !== undefined) {
      updateData.logoUrl = logoUrl ? String(logoUrl).trim() : null;
    }
    if (brandColor && /^#[0-9a-fA-F]{6}$/.test(brandColor)) {
      updateData.brandColor = brandColor;
    }
    if (settings && typeof settings === 'object') {
      updateData.settingsJson = JSON.stringify(settings);
    }

    const updated = await prisma.company.update({
      where: { id: tenantId },
      data: updateData
    });

    clearTenantCache(tenantId);
    clearTenantCache(updated.slug);

    await prisma.auditLog.create({
      data: {
        userId: req.user?.id,
        userName: req.user?.name,
        companyId: tenantId,
        action: 'TENANT_SETTINGS_UPDATED',
        entity: 'Company',
        details: `Updated tenant settings for ${updated.name}`
      }
    });

    res.json({
      success: true,
      tenant: {
        id: updated.id,
        name: updated.name,
        slug: updated.slug,
        brandColor: updated.brandColor,
        logoUrl: updated.logoUrl,
        plan: updated.plan,
        status: updated.status
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * List All Platform Tenants (Platform Super-Admin ONLY)
 */
tenantsRouter.get('/', authenticateToken, requireRole(['ADMIN']), async (req: AuthenticatedRequest, res) => {
  // Only platform super-admins without bound companyId or with explicit super-admin role can access
  if (req.user?.companyId) {
    return res.status(403).json({
      success: false,
      error: 'Forbidden: Global tenant directory is restricted to platform Super Administrators.'
    });
  }

  try {
    const companies = await prisma.company.findMany({
      include: {
        _count: {
          select: {
            users: true,
            jobs: true,
            templates: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      success: true,
      tenants: companies.map(c => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        domain: c.domain,
        status: c.status,
        plan: c.plan,
        brandColor: c.brandColor,
        logoUrl: c.logoUrl,
        metrics: c._count,
        createdAt: c.createdAt
      }))
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Suspend or Reactivate a Tenant (Platform Super-Admin ONLY)
 */
tenantsRouter.patch('/:id/status', authenticateToken, requireRole(['ADMIN']), async (req: AuthenticatedRequest, res) => {
  if (req.user?.companyId) {
    return res.status(403).json({ success: false, error: 'Forbidden: Restricted to platform Super Administrators.' });
  }

  const { status } = req.body;
  const ALLOWED_STATUSES = ['ACTIVE', 'SUSPENDED', 'TRIAL'];

  if (!status || !ALLOWED_STATUSES.includes(status)) {
    return res.status(400).json({
      success: false,
      error: `Invalid status: ${status}. Allowed: ${ALLOWED_STATUSES.join(', ')}`
    });
  }

  try {
    const updated = await prisma.company.update({
      where: { id: req.params.id },
      data: { status }
    });

    clearTenantCache(updated.id);
    clearTenantCache(updated.slug);

    await prisma.auditLog.create({
      data: {
        userId: req.user?.id,
        userName: req.user?.name,
        action: 'TENANT_STATUS_CHANGED',
        entity: 'Company',
        details: `Changed tenant status of ${updated.name} to ${status}`
      }
    });

    res.json({ success: true, tenant: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});
