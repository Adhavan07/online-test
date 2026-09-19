import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getStoredToken, getStoredUser, setStoredSession, setStoredTenantSlug } from './auth';

export interface TenantInfo {
  id: string;
  name: string;
  slug: string;
  domain?: string | null;
  brandColor?: string;
  logoUrl?: string | null;
  plan?: string;
  status?: string;
  settings?: any;
  metrics?: {
    users?: number;
    jobs?: number;
    templates?: number;
  };
}

interface TenantContextType {
  tenant: TenantInfo | null;
  setTenant: (tenant: TenantInfo | null) => void;
  availableTenants: TenantInfo[];
  isSuperAdmin: boolean;
  isLoading: boolean;
  switchWorkspace: (companyId: string | null) => Promise<boolean>;
  refreshTenant: () => Promise<void>;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export const TenantProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [tenant, setTenant] = useState<TenantInfo | null>(() => {
    const user = getStoredUser();
    if (user?.company) {
      return {
        id: user.company.id,
        name: user.company.name,
        slug: user.company.slug || 'workspace',
        brandColor: user.company.brandColor || '#2563eb',
        logoUrl: user.company.logoUrl,
        plan: user.company.plan || 'ENTERPRISE',
      };
    }
    return null;
  });

  const [availableTenants, setAvailableTenants] = useState<TenantInfo[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const currentUser = getStoredUser();
  const isSuperAdmin = currentUser?.role === 'ADMIN' && !currentUser?.companyId;

  const refreshTenant = useCallback(async () => {
    const token = getStoredToken();
    if (!token) {
      setTenant(null);
      setAvailableTenants([]);
      return;
    }

    try {
      const res = await fetch('/api/tenants/current');
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.tenant) {
          setTenant(data.tenant);
          if (data.tenant.slug) {
            setStoredTenantSlug(data.tenant.slug);
          }
        }
      }

      // If Super Admin, fetch all tenants
      const user = getStoredUser();
      if (user?.role === 'ADMIN') {
        const listRes = await fetch('/api/tenants');
        if (listRes.ok) {
          const listData = await listRes.json();
          if (listData.success && Array.isArray(listData.tenants)) {
            setAvailableTenants(listData.tenants);
          }
        }
      }
    } catch (err) {
      console.error('[TENANT REFRESH ERROR]', err);
    }
  }, []);

  useEffect(() => {
    refreshTenant();

    const handleAuthChange = (e: Event) => {
      const user = (e as CustomEvent).detail as any;
      if (user?.company) {
        setTenant({
          id: user.company.id,
          name: user.company.name,
          slug: user.company.slug || 'workspace',
          brandColor: user.company.brandColor || '#2563eb',
          logoUrl: user.company.logoUrl,
          plan: user.company.plan || 'ENTERPRISE',
        });
        if (user.company.slug) {
          setStoredTenantSlug(user.company.slug);
        }
      } else if (!user) {
        setTenant(null);
        setAvailableTenants([]);
      }
      refreshTenant();
    };

    window.addEventListener('techscreen:auth-changed', handleAuthChange);
    window.addEventListener('techscreen:workspace-changed', refreshTenant);
    return () => {
      window.removeEventListener('techscreen:auth-changed', handleAuthChange);
      window.removeEventListener('techscreen:workspace-changed', refreshTenant);
    };
  }, [refreshTenant]);

  const switchWorkspace = async (companyId: string | null): Promise<boolean> => {
    const token = getStoredToken();
    if (!token) return false;
    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/switch-workspace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetCompanyId: companyId }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to switch workspace');
      }

      // Update stored session
      const user = getStoredUser();
      if (user) {
        user.companyId = companyId;
        user.company = data.activeWorkspace;
        setStoredSession(data.token, user);
      }

      if (data.activeWorkspace) {
        setTenant(data.activeWorkspace);
        setStoredTenantSlug(data.activeWorkspace.slug);
      } else {
        setTenant(null);
      }

      // Trigger full data re-fetch across active views
      window.dispatchEvent(new CustomEvent('techscreen:workspace-changed'));
      return true;
    } catch (err) {
      console.error('[SWITCH WORKSPACE ERROR]', err);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <TenantContext.Provider
      value={{
        tenant,
        setTenant,
        availableTenants,
        isSuperAdmin,
        isLoading,
        switchWorkspace,
        refreshTenant,
      }}
    >
      {children}
    </TenantContext.Provider>
  );
};

export function useTenant(): TenantContextType {
  const context = useContext(TenantContext);
  if (!context) {
    throw new Error('useTenant must be used within a TenantProvider');
  }
  return context;
}
