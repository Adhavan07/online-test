import { prisma } from './prisma.js';
import { getCurrentTenant } from '../middleware/tenant.js';

/**
 * Validates that an entity's tenant matches the requester's active tenant
 */
export function isTenantAuthorized(
  resourceCompanyId: string | null | undefined,
  requesterCompanyId: string | null | undefined,
  isSuperAdmin: boolean = false
): boolean {
  if (isSuperAdmin) return true;
  if (!resourceCompanyId && !requesterCompanyId) return true;
  if (!resourceCompanyId || !requesterCompanyId) return false;
  return resourceCompanyId === requesterCompanyId;
}

export function assertTenantAccess(
  resourceCompanyId: string | null | undefined,
  requesterCompanyId: string | null | undefined,
  resourceName: string = 'Resource',
  isSuperAdmin: boolean = false
): void {
  if (!isTenantAuthorized(resourceCompanyId, requesterCompanyId, isSuperAdmin)) {
    const err: any = new Error(`Forbidden: Access denied to ${resourceName} across tenant boundary.`);
    err.statusCode = 403;
    throw err;
  }
}

/**
 * Returns a Prisma client instance scoped to a specific tenant ID.
 * If no tenantId is passed, it automatically resolves the tenant from the active AsyncLocalStorage context.
 */
export function getScopedPrisma(explicitTenantId?: string | null) {
  const currentTenant = getCurrentTenant();
  const tenantId = explicitTenantId !== undefined ? explicitTenantId : currentTenant?.id;

  // Unscoped client for Super Admins or global operations
  if (!tenantId) {
    return prisma;
  }

  return prisma.$extends({
    query: {
      job: {
        async findMany({ args, query }) {
          args.where = { ...args.where, companyId: tenantId };
          return query(args);
        },
        async findFirst({ args, query }) {
          args.where = { ...args.where, companyId: tenantId };
          return query(args);
        },
        async count({ args, query }) {
          args.where = { ...args.where, companyId: tenantId };
          return query(args);
        },
        async create({ args, query }) {
          (args.data as any) = { ...(args.data as any), companyId: tenantId };
          return query(args);
        }
      },
      assessmentTemplate: {
        async findMany({ args, query }) {
          // Allow tenant-specific templates OR shared global templates (companyId: null)
          if (!args.where?.id) {
            args.where = {
              ...args.where,
              OR: [
                { companyId: null },
                { companyId: tenantId }
              ]
            };
          }
          return query(args);
        },
        async create({ args, query }) {
          (args.data as any) = { ...(args.data as any), companyId: tenantId };
          return query(args);
        }
      },
      webhookConfig: {
        async findMany({ args, query }) {
          args.where = { ...args.where, companyId: tenantId };
          return query(args);
        },
        async create({ args, query }) {
          (args.data as any) = { ...(args.data as any), companyId: tenantId };
          return query(args);
        }
      },
      auditLog: {
        async findMany({ args, query }) {
          args.where = { ...args.where, companyId: tenantId };
          return query(args);
        },
        async create({ args, query }) {
          (args.data as any) = { ...(args.data as any), companyId: tenantId };
          return query(args);
        }
      },
      notification: {
        async findMany({ args, query }) {
          args.where = { ...args.where, companyId: tenantId };
          return query(args);
        },
        async create({ args, query }) {
          (args.data as any) = { ...(args.data as any), companyId: tenantId };
          return query(args);
        }
      }
    }
  });
}
