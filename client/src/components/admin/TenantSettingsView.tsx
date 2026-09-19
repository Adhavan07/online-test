import React, { useState, useEffect } from 'react';
import { 
  Building2, Palette, ShieldCheck, Users, Save, CheckCircle2, 
  AlertCircle, Globe, Link, Sliders, RefreshCw, Plus, Mail
} from 'lucide-react';
import { useTenant } from '../../lib/TenantContext';
import { getStoredUser } from '../../lib/auth';

export const TenantSettingsView: React.FC = () => {
  const { tenant, refreshTenant } = useTenant();
  const storedUser = getStoredUser();
  const activeTenant = tenant || (storedUser?.company ? {
    id: storedUser.company.id,
    name: storedUser.company.name,
    slug: storedUser.company.slug || 'workspace',
    brandColor: storedUser.company.brandColor || '#2563eb',
    logoUrl: storedUser.company.logoUrl,
    plan: storedUser.company.plan || 'ENTERPRISE',
    settings: {
      defaultPassThreshold: 70,
      proctoringStrictness: 'STANDARD'
    }
  } : null);

  const [companyName, setCompanyName] = useState(activeTenant?.name || '');
  const [logoUrl, setLogoUrl] = useState(activeTenant?.logoUrl || '');
  const [brandColor, setBrandColor] = useState(activeTenant?.brandColor || '#2563eb');
  const [passThreshold, setPassThreshold] = useState(activeTenant?.settings?.defaultPassThreshold || 70);
  const [proctoringStrictness, setProctoringStrictness] = useState(activeTenant?.settings?.proctoringStrictness || 'STANDARD');
  
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Invite modal state
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('RECRUITER');
  const [inviting, setInviting] = useState(false);

  useEffect(() => {
    if (activeTenant) {
      setCompanyName(activeTenant.name || '');
      setLogoUrl(activeTenant.logoUrl || '');
      setBrandColor(activeTenant.brandColor || '#2563eb');
      setPassThreshold(activeTenant.settings?.defaultPassThreshold || 70);
      setProctoringStrictness(activeTenant.settings?.proctoringStrictness || 'STANDARD');
    }
  }, [tenant]);

  // Fetch team members
  const fetchTeam = async () => {
    try {
      const res = await fetch('/api/auth/team');
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.members)) {
          setTeamMembers(data.members);
        }
      }
    } catch {}
  };

  useEffect(() => {
    fetchTeam();
  }, []);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaveSuccess(false);

    try {
      const res = await fetch('/api/tenants/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: companyName.trim(),
          logoUrl: logoUrl.trim() || null,
          brandColor,
          settings: {
            defaultPassThreshold: Number(passThreshold),
            proctoringStrictness,
          }
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to update organization settings.');
      }

      await refreshTenant();
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Error updating settings.');
    } finally {
      setSaving(false);
    }
  };

  const handleInviteMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviting(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/team/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: inviteName.trim(),
          email: inviteEmail.trim(),
          role: inviteRole,
          password: 'TemporaryPass@2026'
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to invite team member.');
      }

      await fetchTeam();
      setIsInviteOpen(false);
      setInviteName('');
      setInviteEmail('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setInviting(false);
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
    <div className="space-y-6">
      
      {/* Header Banner */}
      <div className="bg-white border border-zinc-200 rounded-lg p-5 shadow-2xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div 
            style={{ backgroundColor: brandColor }}
            className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-mono font-bold text-sm shadow-xs"
          >
            {companyName.slice(0, 2).toUpperCase() || 'TS'}
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-base font-bold text-zinc-900 tracking-tight">{companyName || 'Organization Workspace'}</h2>
              <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono font-bold px-1.5 py-0.5 rounded">
                ACTIVE
              </span>
            </div>
            <div className="text-xs text-zinc-500 font-mono flex items-center space-x-2 mt-0.5">
              <span>https://{activeTenant?.slug || 'workspace'}.techscreen.io</span>
              <span>&bull;</span>
              <span>Tier: {activeTenant?.plan || 'ENTERPRISE'}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {saveSuccess && (
            <div className="flex items-center space-x-1.5 text-xs text-emerald-600 font-semibold bg-emerald-50 px-3 py-1.5 rounded border border-emerald-200 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4" />
              <span>Saved Successfully</span>
            </div>
          )}
          <button
            onClick={handleSaveSettings}
            disabled={saving}
            style={{ backgroundColor: brandColor }}
            className="text-white text-xs font-semibold px-4 py-2 rounded-md shadow-xs hover:opacity-90 transition flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
          >
            {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            <span>Save Workspace Settings</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-xs flex items-start space-x-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Settings Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Card 1: Branding & Identity */}
        <div className="bg-white border border-zinc-200 rounded-lg p-5 shadow-2xs space-y-4">
          <div className="flex items-center space-x-2 border-b border-zinc-100 pb-3">
            <Palette className="w-4 h-4 text-blue-600" />
            <h3 className="text-xs font-bold text-zinc-900 uppercase font-mono tracking-wider">
              Branding & Visual Skin
            </h3>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-1">Company Display Name</label>
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className="w-full bg-white border border-zinc-200 rounded-md px-3 py-2 text-xs text-zinc-900 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-1">Logo Image URL</label>
            <input
              type="url"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder="https://acme.com/logo.png"
              className="w-full bg-white border border-zinc-200 rounded-md px-3 py-2 text-xs text-zinc-900 focus:outline-none focus:border-blue-500"
            />
            <p className="text-[10px] text-zinc-400 mt-1">Displayed on candidate test screens and candidate certificates.</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-2">Accent & Candidate Theme Color</label>
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
              <span className="text-xs font-mono text-zinc-500 ml-2">{brandColor}</span>
            </div>
          </div>
        </div>

        {/* Card 2: Assessment Policies */}
        <div className="bg-white border border-zinc-200 rounded-lg p-5 shadow-2xs space-y-4">
          <div className="flex items-center space-x-2 border-b border-zinc-100 pb-3">
            <Sliders className="w-4 h-4 text-emerald-600" />
            <h3 className="text-xs font-bold text-zinc-900 uppercase font-mono tracking-wider">
              Screening & Proctoring Policies
            </h3>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-semibold text-zinc-700">Default Passing Threshold</label>
              <span className="text-xs font-mono font-bold text-blue-600">{passThreshold}%</span>
            </div>
            <input
              type="range"
              min={50}
              max={90}
              step={5}
              value={passThreshold}
              onChange={(e) => setPassThreshold(Number(e.target.value))}
              className="w-full accent-blue-600"
            />
            <p className="text-[10px] text-zinc-400 mt-1">Candidates scoring at or above this percentage automatically pass the initial screening.</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-1">Proctoring Sensitivity</label>
            <select
              value={proctoringStrictness}
              onChange={(e) => setProctoringStrictness(e.target.value)}
              className="w-full bg-white border border-zinc-200 rounded-md px-3 py-2 text-xs text-zinc-900 focus:outline-none focus:border-blue-500"
            >
              <option value="RELAXED">Relaxed (Warnings only, no tab limits)</option>
              <option value="STANDARD">Standard (3 tab switches allowed before penalty)</option>
              <option value="STRICT">Strict (Zero tolerance, automatic flag on focus lost)</option>
            </select>
          </div>

          <div className="pt-2 border-t border-zinc-100">
            <div className="flex items-center space-x-2 text-zinc-600 text-xs">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Dedicated tenant database row-level isolation active.</span>
            </div>
          </div>
        </div>

      </div>

      {/* Team Members Management */}
      <div className="bg-white border border-zinc-200 rounded-lg p-5 shadow-2xs space-y-4">
        <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
          <div className="flex items-center space-x-2">
            <Users className="w-4 h-4 text-purple-600" />
            <h3 className="text-xs font-bold text-zinc-900 uppercase font-mono tracking-wider">
              Workspace Team Members ({teamMembers.length})
            </h3>
          </div>
          <button
            type="button"
            onClick={() => setIsInviteOpen(true)}
            className="bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold px-3 py-1.5 rounded transition flex items-center space-x-1 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Invite Team Member</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-zinc-200 text-zinc-400 font-mono uppercase text-[10px]">
                <th className="py-2 px-3 font-semibold">User</th>
                <th className="py-2 px-3 font-semibold">Email</th>
                <th className="py-2 px-3 font-semibold">Role</th>
                <th className="py-2 px-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {teamMembers.map((member) => (
                <tr key={member.id} className="hover:bg-zinc-50/60 transition">
                  <td className="py-2.5 px-3 font-semibold text-zinc-900 flex items-center space-x-2">
                    <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-[10px]">
                      {member.name.slice(0, 2).toUpperCase()}
                    </div>
                    <span>{member.name}</span>
                  </td>
                  <td className="py-2.5 px-3 text-zinc-500 font-mono">{member.email}</td>
                  <td className="py-2.5 px-3">
                    <span className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold ${
                      member.role === 'ADMIN' ? 'bg-purple-50 text-purple-700 border border-purple-200' :
                      member.role === 'HR_ADMIN' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                      'bg-zinc-100 text-zinc-700 border border-zinc-200'
                    }`}>
                      {member.role}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-emerald-600 font-medium text-[11px]">Active</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invite Member Modal */}
      {isInviteOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-zinc-200 rounded-xl shadow-xl max-w-sm w-full p-5 space-y-4">
            <h4 className="text-sm font-bold text-zinc-900 font-mono">Invite Colleague to Workspace</h4>
            <form onSubmit={handleInviteMember} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-zinc-700 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  placeholder="John Doe"
                  className="w-full border border-zinc-200 rounded px-2.5 py-1.5"
                />
              </div>

              <div>
                <label className="block font-semibold text-zinc-700 mb-1">Work Email</label>
                <input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="colleague@company.com"
                  className="w-full border border-zinc-200 rounded px-2.5 py-1.5"
                />
              </div>

              <div>
                <label className="block font-semibold text-zinc-700 mb-1">Workspace Role</label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="w-full border border-zinc-200 rounded px-2.5 py-1.5"
                >
                  <option value="RECRUITER">Recruiter (Post jobs, invite candidates)</option>
                  <option value="TECH_INTERVIEWER">Technical Interviewer (Pair-coding only)</option>
                  <option value="HR_ADMIN">HR Admin (Full organization manager)</option>
                </select>
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsInviteOpen(false)}
                  className="px-3 py-1.5 text-zinc-600 hover:bg-zinc-100 rounded cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={inviting || !inviteName || !inviteEmail}
                  className="px-4 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-white font-semibold rounded cursor-pointer disabled:opacity-50"
                >
                  {inviting ? 'Inviting...' : 'Send Invitation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
