import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

/**
 * Retrieve JWT secret with fail-fast enforcement in production
 */
export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  const INSECURE_DEFAULTS = [
    'techscreen-enterprise-secret-change-in-prod-2026',
    'techscreen-secret-jwt-key',
    'default-dev-secret',
    'secret',
    'changeme',
    '123456',
    'password',
    'admin',
  ];

  if (process.env.NODE_ENV === 'production') {
    if (!secret || INSECURE_DEFAULTS.includes(secret) || secret.length < 32) {
      throw new Error('FATAL: A strong, cryptographically random JWT_SECRET of at least 32 characters must be configured in production environment.');
    }
    return secret;
  }

  // Non-production fallback
  if (!secret || INSECURE_DEFAULTS.includes(secret)) {
    return 'techscreen-dev-secret-local-only-2026-minimum-length-key';
  }

  return secret;
}

export function validateStartupConfig(): { valid: boolean; error?: string } {
  const secret = process.env.JWT_SECRET;
  const INSECURE_DEFAULTS = [
    'techscreen-enterprise-secret-change-in-prod-2026',
    'techscreen-secret-jwt-key',
    'default-dev-secret',
    'secret',
    'changeme',
    '123456',
    'password',
    'admin',
  ];

  if (process.env.NODE_ENV === 'production') {
    if (!secret) {
      return {
        valid: false,
        error: 'FATAL CONFIGURATION ERROR: JWT_SECRET environment variable is missing in production.',
      };
    }
    if (INSECURE_DEFAULTS.includes(secret)) {
      return {
        valid: false,
        error: 'FATAL CONFIGURATION ERROR: JWT_SECRET cannot be a known insecure default in production.',
      };
    }
    if (secret.length < 32) {
      return {
        valid: false,
        error: 'FATAL CONFIGURATION ERROR: JWT_SECRET must be at least 32 characters long in production.',
      };
    }
  }

  return { valid: true };
}

export function enforceStartupConfig(): void {
  const check = validateStartupConfig();
  if (!check.valid) {
    console.error('====================================================');
    console.error('CRITICAL SERVER CONFIGURATION ERROR:');
    console.error(check.error);
    console.error('Port listening aborted. Refusing to start in production without secure configuration.');
    console.error('====================================================');
    process.exit(1);
  }
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'HR_ADMIN' | 'RECRUITER' | 'TECH_INTERVIEWER' | 'CANDIDATE' | string;
  companyId: string | null;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

/**
 * Authenticate JWT Bearer Token
 */
export function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') 
    ? authHeader.split(' ')[1] 
    : (req.headers['x-auth-token'] as string);

  if (!token) {
    return res.status(401).json({ success: false, error: 'Authentication required. No session token provided.' });
  }

  try {
    const secret = getJwtSecret();
    const decoded = jwt.verify(token, secret) as AuthUser;
    if (!decoded || !decoded.id || !decoded.role) {
      return res.status(401).json({ success: false, error: 'Malformed or invalid authentication token.' });
    }
    req.user = decoded;
    next();
  } catch (err: any) {
    return res.status(401).json({ success: false, error: 'Invalid or expired session token.' });
  }
}

/**
 * Optional Authentication (attaches req.user if token valid, continues if not)
 */
export function optionalAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') 
    ? authHeader.split(' ')[1] 
    : (req.headers['x-auth-token'] as string);

  if (token) {
    try {
      const secret = getJwtSecret();
      const decoded = jwt.verify(token, secret) as AuthUser;
      if (decoded && decoded.id) {
        req.user = decoded;
      }
    } catch {}
  }
  next();
}

/**
 * Role-Based Access Control (RBAC) Guard
 */
export function requireRole(allowedRoles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Authentication required.' });
    }

    const userRole = (req.user.role || '').toUpperCase();
    const normalizedAllowed = allowedRoles.map(r => r.toUpperCase());

    // ADMIN has platform-wide administration across administrative actions (not candidate assessment routes)
    // HR_ADMIN is company-level administration and only has access if explicitly permitted
    const hasPermission = normalizedAllowed.includes(userRole) || (userRole === 'ADMIN' && !normalizedAllowed.includes('CANDIDATE'));

    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        error: `Forbidden: Role '${req.user.role}' lacks permission for this action. Allowed: ${allowedRoles.join(', ')}`,
      });
    }

    next();
  };
}

export const requireAdmin = requireRole(['ADMIN']);
export const requireHrAdmin = requireRole(['HR_ADMIN', 'ADMIN']);
export const requireRecruiter = requireRole(['RECRUITER', 'HR_ADMIN', 'ADMIN']);
export const requireInterviewer = requireRole(['TECH_INTERVIEWER', 'RECRUITER', 'HR_ADMIN', 'ADMIN']);
