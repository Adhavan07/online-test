import { Request, Response, NextFunction } from 'express';
import { AsyncLocalStorage } from 'async_hooks';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma.js';
import { getJwtSecret } from './auth.js';

export interface TenantContext {
  id: string;
  name: string;
  slug: string;
  domain: string | null;
  status: string;
  plan: string;
  brandColor: string;
  logoUrl: string | null;
  settings?: any;
}

export interface TenantRequest extends Request {
  tenant?: TenantContext | null;
  isSuperAdmin?: boolean;
}

export const tenantStorage = new AsyncLocalStorage<TenantContext | null>();

export function getCurrentTenant(): TenantContext | null {
  return tenantStorage.getStore() || null;
}

export function getTenantId(): string | null {
  const current = getCurrentTenant();
  return current ? current.id : null;
}

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

  if (!company) return null;

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
  tenantCache.set(`tenant:${company.id}`, { tenant, expiresAt: Date.now() + CACHE_TTL_MS });
  tenantCache.set(`tenant:${company.slug}`, { tenant, expiresAt: Date.now() + CACHE_TTL_MS });

  return tenant;
}

function extractSubdomain(host: string | undefined): string | null {
  if (!host) return null;
  const hostname = host.split(':')[0].toLowerCase();

  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(hostname) || hostname === 'localhost') {
    return null;
  }

  if (hostname.endsWith('.vercel.app')) {
    return null;
  }

  const parts = hostname.split('.');
  if (parts.length === 2 && parts[1] === 'localhost') {
    const sub = parts[0];
    if (!['www', 'api', 'app', 'admin', 'mail'].includes(sub)) return sub;
  }

  if (parts.length >= 3) {
    const sub = parts[0];
    if (!['www', 'api', 'app', 'admin', 'mail'].includes(sub)) return sub;
  }

  return null;
}

function getBearerToken(req: Request): string | null {
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim() || null;
  }
  const headerToken = req.headers['x-auth-token'];
  return typeof headerToken === 'string' && headerToken.trim() ? headerToken.trim() : null;
}

/**
 * Global Tenant Resolution Middleware.
 *
 * Security rule: a valid authenticated JWT is authoritative for tenant
 * selection. Client-controlled tenant headers/hostnames are only fallback
 * resolution for unauthenticated flows (login/public tenant discovery).
 * This prevents an authenticated user from selecting another tenant by
 * supplying X-Tenant-Slug or a different host.
 */
export async function resolveTenant(req: TenantRequest, res: Response, next: NextFunction) {
  try {
    let resolvedTenant: TenantContext | null = null;
    const token = getBearerToken(req);

    // 1. Verified JWT resolution must take precedence over client-controlled
    // tenant headers/hostnames.
    if (token) {
      try {
        const decoded = jwt.verify(token, getJwtSecret()) as {
          companyId?: string | null;
          role?: string;
        };

        if (decoded.companyId) {
          resolvedTenant = await findTenantByIdOrSlug(decoded.companyId);
        } else if (decoded.role?.toUpperCase() === 'ADMIN') {
          req.isSuperAdmin = true;
        }
      } catch {
        // Authentication middleware will return the appropriate 401 later.
        // Continue to public tenant discovery only when no valid tenant claim
        // can be established.
      }
    }

    // 2. Explicit tenant header. Used for unauthenticated/public flows.
    if (!resolvedTenant) {
      const headerSlug = (req.headers['x-tenant-slug'] as string) ||
        (req.headers['x-tenant-id'] as string);

      if (headerSlug?.trim()) {
        resolvedTenant = await findTenantByIdOrSlug(headerSlug.trim());
      }
    }

    // 3. Host/subdomain resolution for public tenant-aware entry points.
    if (!resolvedTenant) {
      const subdomain = extractSubdomain(req.headers.host);
      if (subdomain) {
        resolvedTenant = await findTenantByIdOrSlug(subdomain);
      }
    }

    // 4. Candidate assessment token resolution.
    if (!resolvedTenant && req.path.includes('/assessment/')) {
      const assessmentToken =
        (req.headers['x-assessment-token'] as string) ||
        (req.query.token as string) ||
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

    if (resolvedTenant) {
      if (resolvedTenant.status === 'SUSPENDED') {
        return res.status(403).json({
          success: false,
          error: `The organization workspace '${resolvedTenant.name}' has been suspended. Please contact platform support.`
        });
      }
      req.tenant = resolvedTenant;
    }

    tenantStorage.run(resolvedTenant, () => next());
  } catch (err: any) {
    console.error('[TENANT RESOLVER ERROR]', err);
    next(err);
  }
}

export function requireTenant(req: TenantRequest, res: Response, next: NextFunction) {
  if (!req.tenant) {
    return res.status(400).json({
      success: false,
      error: 'Tenant context required. Please provide a valid X-Tenant-Slug header or access via organization subdomain.'
    });
  }
  next();
}
