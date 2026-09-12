import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'techscreen-enterprise-secret-change-in-prod-2026';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: 'HR_ADMIN' | 'RECRUITER' | 'TECH_INTERVIEWER' | 'CANDIDATE' | string;
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
    return res.status(401).json({ success: false, error: 'Access token required.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthUser;
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ success: false, error: 'Invalid or expired session token.' });
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
      const decoded = jwt.verify(token, JWT_SECRET) as AuthUser;
      req.user = decoded;
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

    const userRole = req.user.role.toUpperCase();
    const hasPermission = allowedRoles.map(r => r.toUpperCase()).includes(userRole) || userRole === 'ADMIN' || userRole === 'HR_ADMIN';

    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        error: `Forbidden: Role '${req.user.role}' lacks permission for this action. Allowed: ${allowedRoles.join(', ')}`,
      });
    }

    next();
  };
}
