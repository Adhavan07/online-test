/**
 * TechScreen Pro Client Authentication & Session Management
 */

export interface UserSession {
  id: string;
  name: string;
  email: string;
  role: string;
  companyId: string | null;
  company?: {
    id: string;
    name: string;
    slug?: string;
    brandColor?: string;
    plan?: string;
    logoUrl?: string | null;
  } | null;
}

const TOKEN_KEY = 'techscreen_token';
const USER_KEY = 'techscreen_user';
const TENANT_SLUG_KEY = 'techscreen_active_tenant_slug';

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser(): UserSession | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function getStoredTenantSlug(): string | null {
  return localStorage.getItem(TENANT_SLUG_KEY);
}

export function setStoredTenantSlug(slug: string): void {
  localStorage.setItem(TENANT_SLUG_KEY, slug);
}

export function setStoredSession(token: string, user: UserSession): void {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  if (user.company?.slug) {
    localStorage.setItem(TENANT_SLUG_KEY, user.company.slug);
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('techscreen:auth-changed', { detail: user }));
  }
}

export function clearStoredSession(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(TENANT_SLUG_KEY);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('techscreen:auth-changed', { detail: null }));
  }
}

/**
 * Configure global fetch interceptor to attach JWT token & tenant headers to all API requests
 */
export function setupFetchInterceptor(): void {
  const originalFetch = window.fetch;
  window.fetch = async function (input: RequestInfo | URL, init?: RequestInit) {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const token = getStoredToken();
    const activeSlug = getStoredTenantSlug();

    // Attach Bearer token & Tenant headers to all /api/ calls if available
    if (typeof url === 'string' && url.includes('/api/')) {
      init = init || {};
      const headers = new Headers(init.headers || {});

      if (token && !headers.has('Authorization')) {
        const isPublicAssessment = url.includes('/api/assessment/verify') || 
                                   url.includes('/api/assessment/send-otp') || 
                                   url.includes('/api/assessment/verify-otp') ||
                                   url.includes('/api/badges/verify') ||
                                   url.includes('/api/candidates/apply');
        if (!isPublicAssessment) {
          headers.set('Authorization', `Bearer ${token}`);
        }
      }

      if (activeSlug && !headers.has('x-tenant-slug')) {
        headers.set('x-tenant-slug', activeSlug);
      }

      init.headers = headers;
    }

    const response = await originalFetch(input, init);

    // If 401 Unauthorized received on a protected endpoint, notify application
    if (response.status === 401 && typeof url === 'string' && !url.includes('/api/auth/login')) {
      window.dispatchEvent(new CustomEvent('techscreen:unauthorized'));
    }

    return response;
  };
}
