import React, { useState } from 'react';
import { Building2, X, Sparkles, ShieldCheck, Mail, Lock, User, ArrowRight, AlertCircle, CheckCircle2 } from 'lucide-react';
import { setStoredSession, UserSession } from '../../lib/auth';

interface RegisterTenantModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: UserSession) => void;
}

export const RegisterTenantModal: React.FC<RegisterTenantModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [companyName, setCompanyName] = useState('');
  const [slug, setSlug] = useState('');
  const [customSlug, setCustomSlug] = useState(false);
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [brandColor, setBrandColor] = useState('#2563eb');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCompanyNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value;
    setCompanyName(name);
    if (!customSlug) {
      const generated = name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      setSlug(generated);
    }
  };

  const handleSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCustomSlug(true);
    const sanitized = e.target.value
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '');
    setSlug(sanitized);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/tenants/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: companyName.trim(),
          slug: slug.trim(),
          adminName: adminName.trim(),
          adminEmail: adminEmail.trim(),
          adminPassword,
          brandColor,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to create organization workspace.');
      }

      setStoredSession(data.token, data.user);
      onSuccess(data.user);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error connecting to onboarding service.');
    } finally {
      setLoading(false);
    }
  };

  const COLOR_PRESETS = [
    { label: 'Cobalt', hex: '#2563eb' },
    { label: 'Emerald', hex: '#059669' },
    { label: 'Indigo', hex: '#4f46e5' },
    { label: 'Violet', hex: '#7c3aed' },
    { label: 'Crimson', hex: '#dc2626' },
    { label: 'Amber', hex: '#d97706' },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-zinc-200 rounded-xl shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in duration-200">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-zinc-900 text-white flex items-center justify-center font-mono font-bold text-xs">
              TS
            </div>
            <div>
              <h3 className="font-bold text-sm text-zinc-900 font-mono tracking-tight flex items-center space-x-1.5">
                <span>CREATE NEW WORKSPACE</span>
                <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-sans font-semibold">
                  Multi-Tenant
                </span>
              </h3>
              <p className="text-[11px] text-zinc-500">Provision an isolated organization with custom branding & assessment bank</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-600 p-1.5 rounded-md hover:bg-zinc-100 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-xs flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Section 1: Company Profile */}
          <div className="space-y-3 pb-3 border-b border-zinc-100">
            <h4 className="text-[11px] font-bold text-zinc-400 font-mono uppercase tracking-wider">
              1. Organization Profile
            </h4>

            <div>
              <label className="block text-zinc-700 font-semibold mb-1">Company / Organization Name</label>
              <div className="relative">
                <Building2 className="w-4 h-4 text-zinc-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  required
                  value={companyName}
                  onChange={handleCompanyNameChange}
                  placeholder="e.g. Acme Corporation"
                  className="w-full bg-white border border-zinc-200 rounded-md pl-9 pr-3 py-2 text-xs text-zinc-900 focus:outline-none focus:border-blue-500 transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-zinc-700 font-semibold mb-1">Workspace Subdomain / Slug</label>
              <div className="flex items-center rounded-md border border-zinc-200 bg-zinc-50 px-3 py-1.5 focus-within:border-blue-500 focus-within:bg-white transition">
                <span className="text-zinc-400 font-mono text-[11px] select-none">https://</span>
                <input
                  type="text"
                  required
                  value={slug}
                  onChange={handleSlugChange}
                  placeholder="acme"
                  className="bg-transparent text-zinc-900 font-mono text-xs focus:outline-none px-1 w-full"
                />
                <span className="text-zinc-400 font-mono text-[11px] select-none">.techscreen.io</span>
              </div>
              <p className="text-[10px] text-zinc-400 mt-1">Unique URL identifier used for tenant isolation and white-labeled candidate links.</p>
            </div>

            <div>
              <label className="block text-zinc-700 font-semibold mb-1.5">Brand Accent Color</label>
              <div className="flex items-center space-x-2">
                {COLOR_PRESETS.map((p) => (
                  <button
                    type="button"
                    key={p.hex}
                    onClick={() => setBrandColor(p.hex)}
                    style={{ backgroundColor: p.hex }}
                    className={`w-6 h-6 rounded-full cursor-pointer transition transform hover:scale-110 flex items-center justify-center ${
                      brandColor === p.hex ? 'ring-2 ring-offset-2 ring-zinc-800' : ''
                    }`}
                    title={p.label}
                  >
                    {brandColor === p.hex && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                  </button>
                ))}
                <input
                  type="color"
                  value={brandColor}
                  onChange={(e) => setBrandColor(e.target.value)}
                  className="w-7 h-7 rounded border border-zinc-200 cursor-pointer p-0.5"
                  title="Custom Color"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Workspace Admin */}
          <div className="space-y-3">
            <h4 className="text-[11px] font-bold text-zinc-400 font-mono uppercase tracking-wider">
              2. Workspace Lead Administrator
            </h4>

            <div>
              <label className="block text-zinc-700 font-semibold mb-1">Full Name</label>
              <div className="relative">
                <User className="w-4 h-4 text-zinc-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  required
                  value={adminName}
                  onChange={(e) => setAdminName(e.target.value)}
                  placeholder="Sarah Connor"
                  className="w-full bg-white border border-zinc-200 rounded-md pl-9 pr-3 py-2 text-xs text-zinc-900 focus:outline-none focus:border-blue-500 transition"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-zinc-700 font-semibold mb-1">Work Email</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-zinc-400 absolute left-3 top-2.5" />
                  <input
                    type="email"
                    required
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    placeholder="sarah@acme.com"
                    className="w-full bg-white border border-zinc-200 rounded-md pl-9 pr-3 py-2 text-xs text-zinc-900 focus:outline-none focus:border-blue-500 transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-zinc-700 font-semibold mb-1">Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-zinc-400 absolute left-3 top-2.5" />
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full bg-white border border-zinc-200 rounded-md pl-9 pr-3 py-2 text-xs text-zinc-900 focus:outline-none focus:border-blue-500 transition"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-3 flex items-center justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 rounded-md transition cursor-pointer text-xs font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !companyName || !slug || !adminEmail || !adminPassword}
              style={{ backgroundColor: brandColor }}
              className="text-white font-semibold px-5 py-2 rounded-md transition flex items-center space-x-1.5 disabled:opacity-50 cursor-pointer shadow-xs text-xs"
            >
              {loading ? (
                <span>Provisioning Workspace...</span>
              ) : (
                <>
                  <span>Create Workspace & Launch</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
