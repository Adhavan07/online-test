import { Request, Response, NextFunction } from 'express';
import { AsyncLocalStorage } from 'async_hooks';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma.js';

export interface TenantContext {
  id: string;
  name: string;
  slug: string;
  domain: string | null;
  status: string; // ACTIVE, SUSPENDED, TRIAL
  plan: string; // FREE, STARTER, PRO, ENTERPRISE
  brandColor: string;
  logoUrl: string | null;
  settings?: any;
}

export interface TenantRequest extends Request {
  tenant?: TenantContext | null;
  isSuperAdmin?: boolean;
}

export const tenantStorage = new AsyncLocalStorage<TenantContext | null>();

/**
 * Access the active tenant anywhere in the execution context
 */
export function getCurrentTenant(): TenantContext | null {
  return tenantStorage.getStore() || null;
}

export function getTenantId(): string | null {
  const current = getCurrentTenant();
  return current ? current.id : null;
}

// In-memory short-lived tenant cache (30s)
const tenantCache = new Map<string, { tenant: TenantContext; expiresAt: number }>();
const CACHE_TTL_MS = 30 * 1000;

export function clearTenantCache(key?: string): void {
  if (key) {
    tenantCache.delete(key);
    tenantCache.delete(`tenant:${key.toLowerCase()}`);
  } else {
    tenantCache.clear();
  }
}

async function findTenantByIdOrSlug(identifier: string): Promise<TenantContext | null> {
  const normalized = identifier.trim().toLowerCase();
  const cacheKey = `tenant:${normalized}`;
  const cached = tenantCache.get(cacheKey);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.tenant;
  }

  const company = await prisma.company.findFirst({
    where: {
      OR: [
        { id: identifier },
        { slug: normalized },
        { domain: normalized }
      ]
    }
  });

  if (!company) {
    return null;
  }

  let parsedSettings = null;
  if (company.settingsJson) {
    try {
      parsedSettings = JSON.parse(company.settingsJson);
    } catch {}
  }

  const tenant: TenantContext = {
    id: company.id,
    name: company.name,
    slug: company.slug,
    domain: company.domain,
    status: company.status || 'ACTIVE',
    plan: company.plan || 'ENTERPRISE',
    brandColor: company.brandColor || '#2563eb',
    logoUrl: company.logoUrl,
    settings: parsedSettings
  };

  tenantCache.set(cacheKey, { tenant, expiresAt: Date.now() + CACHE_TTL_MS });
  // Also cache by ID and slug for quick cross-lookup
  tenantCache.set(`tenant:${company.id}`, { tenant, expiresAt: Date.now() + CACHE_TTL_MS });
  tenantCache.set(`tenant:${company.slug}`, { tenant, expiresAt: Date.now() + CACHE_TTL_MS });

  return tenant;
}

/**
 * Extract tenant slug from host header (e.g. 'acme.techscreen.io' or 'acme.localhost:3000')
 */
function extractSubdomain(host: string | undefined): string | null {
  if (!host) return null;
  const hostname = host.split(':')[0].toLowerCase();

  // If IP address or plain localhost, no subdomain
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(hostname) || hostname === 'localhost') {
    return null;
  }

  const parts = hostname.split('.');
  // 'acme.localhost' -> parts length 2
  if (parts.length === 2 && parts[1] === 'localhost') {
    const sub = parts[0];
    if (!['www', 'api', 'app', 'admin', 'mail'].includes(sub)) {
      return sub;
    }
  }

  // 'acme.techscreen.io' -> parts length 3+
  if (parts.length >= 3) {
    const sub = parts[0];
    if (!['www', 'api', 'app', 'admin', 'mail'].includes(sub)) {
      return sub;
    }
  }

  return null;
}

/**
 * Global Tenant Resolution Middleware
 * Resolves the active tenant context using a multi-strategy pipeline:
 * 1. Explicit Header: X-Tenant-Slug or X-Tenant-ID
 * 2. Host Subdomain / Custom Domain
 * 3. Authenticated JWT token claims (companyId)
 * 4. Assessment token parameter (for candidate test taking)
 */
export async function resolveTenant(req: TenantRequest, res: Response, next: NextFunction) {
  try {
    let resolvedTenant: TenantContext | null = null;

    // 1. Header Resolution
    const headerSlug = (req.headers['x-tenant-slug'] as string) || (req.headers['x-tenant-id'] as string);
    if (headerSlug && typeof headerSlug === 'string' && headerSlug.trim().length > 0) {
      resolvedTenant = await findTenantByIdOrSlug(headerSlug.trim());
    }

    // 2. Subdomain / Host Resolution
    if (!resolvedTenant) {
      const subdomain = extractSubdomain(req.headers.host);
      if (subdomain) {
        resolvedTenant = await findTenantByIdOrSlug(subdomain);
      }
    }

    // 3. JWT Token Resolution
    if (!resolvedTenant) {
      const authHeader = req.headers['authorization'];
      const token = authHeader && authHeader.startsWith('Bearer ')
        ? authHeader.split(' ')[1]
        : (req.headers['x-auth-token'] as string);

      if (token) {
        try {
          const decoded = jwt.decode(token) as any;
          if (decoded && decoded.companyId) {
            resolvedTenant = await findTenantByIdOrSlug(decoded.companyId);
          }
          if (decoded && decoded.role === 'ADMIN' && !decoded.companyId) {
            req.isSuperAdmin = true;
          }
        } catch {}
      }
    }

    // 4. Candidate Assessment Token Resolution
    if (!resolvedTenant && req.path.includes('/assessment/')) {
      const assessmentToken = (req.headers['x-assessment-token'] as string) ||
        req.query.token as string ||
        req.params?.token;

      if (assessmentToken && typeof assessmentToken === 'string') {
        const application = await prisma.jobApplication.findUnique({
          where: { token: assessmentToken },
          include: { job: { include: { company: true } } }
        });

        if (application?.job?.company) {
          resolvedTenant = {
            id: application.job.company.id,
            name: application.job.company.name,
            slug: application.job.company.slug,
            domain: application.job.company.domain,
            status: application.job.company.status || 'ACTIVE',
            plan: application.job.company.plan || 'ENTERPRISE',
            brandColor: application.job.company.brandColor || '#2563eb',
            logoUrl: application.job.company.logoUrl
          };
        }
      }
    }

    // Check Tenant Status if resolved
    if (resolvedTenant) {
      if (resolvedTenant.status === 'SUSPENDED') {
        return res.status(403).json({
          success: false,
          error: `The organization workspace '${resolvedTenant.name}' has been suspended. Please contact platform support.`
        });
      }
      req.tenant = resolvedTenant;
    }

    // Wrap remaining pipeline in AsyncLocalStorage context
    tenantStorage.run(resolvedTenant, () => {
      next();
    });
  } catch (err: any) {
    console.error('[TENANT RESOLVER ERROR]', err);
    next(err);
  }
}

/**
 * Middleware requiring that a valid tenant was resolved
 */
export function requireTenant(req: TenantRequest, res: Response, next: NextFunction) {
  if (!req.tenant) {
    return res.status(400).json({
      success: false,
      error: 'Tenant context required. Please provide a valid X-Tenant-Slug header or access via organization subdomain.'
    });
  }
  next();
}
