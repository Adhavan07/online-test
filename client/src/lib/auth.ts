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
    logoUrl?: string | null;
  } | null;
}

const TOKEN_KEY = 'techscreen_token';
const USER_KEY = 'techscreen_user';

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

export function setStoredSession(token: string, user: UserSession): void {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearStoredSession(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

/**
 * Configure global fetch interceptor to attach JWT token to all API requests
 */
export function setupFetchInterceptor(): void {
  const originalFetch = window.fetch;
  window.fetch = async function (input: RequestInfo | URL, init?: RequestInit) {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const token = getStoredToken();

    // Attach Bearer token to all /api/ calls if token exists
    if (token && typeof url === 'string' && url.includes('/api/')) {
      // Exclude public candidate routes from requiring recruiter token
      const isPublicAssessment = url.includes('/api/assessment/verify') || 
                                 url.includes('/api/assessment/send-otp') || 
                                 url.includes('/api/assessment/verify-otp') ||
                                 url.includes('/api/badges/verify') ||
                                 url.includes('/api/candidates/apply');

      if (!isPublicAssessment) {
        init = init || {};
        const headers = new Headers(init.headers || {});
        if (!headers.has('Authorization')) {
          headers.set('Authorization', `Bearer ${token}`);
        }
        init.headers = headers;
      }
    }

    const response = await originalFetch(input, init);

    // If 401 Unauthorized received on a protected endpoint, notify application
    if (response.status === 401 && typeof url === 'string' && !url.includes('/api/auth/login')) {
      window.dispatchEvent(new CustomEvent('techscreen:unauthorized'));
    }

    return response;
  };
}
