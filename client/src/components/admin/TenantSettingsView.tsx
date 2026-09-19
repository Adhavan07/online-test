import React, { useState, useEffect } from 'react';
import { 
  Building2, Palette, ShieldCheck, Users, Save, CheckCircle2, 
  AlertCircle, Globe, Link, Sliders, RefreshCw, Plus, Mail,
  Database, Trash2, CreditCard, Shield, Clock
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
      proctoringStrictness: 'STANDARD',
      proctoringSnapshotRetentionDays: 30,
      candidateDataRetentionDays: 180,
      minimumAgeRequired: 18,
    }
  } : null);

  const [companyName, setCompanyName] = useState(activeTenant?.name || '');
  const [logoUrl, setLogoUrl] = useState(activeTenant?.logoUrl || '');
  const [brandColor, setBrandColor] = useState(activeTenant?.brandColor || '#2563eb');
  const [passThreshold, setPassThreshold] = useState(activeTenant?.settings?.defaultPassThreshold || 70);
  const [proctoringStrictness, setProctoringStrictness] = useState(activeTenant?.settings?.proctoringStrictness || 'STANDARD');
  const [proctoringRetentionDays, setProctoringRetentionDays] = useState(activeTenant?.settings?.proctoringSnapshotRetentionDays ?? 30);
  const [candidateRetentionDays, setCandidateRetentionDays] = useState(activeTenant?.settings?.candidateDataRetentionDays ?? 180);
  const [minAge, setMinAge] = useState(activeTenant?.settings?.minimumAgeRequired ?? 18);
  const [purging, setPurging] = useState(false);
  const [purgeResult, setPurgeResult] = useState<string | null>(null);
  
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
      setProctoringRetentionDays(activeTenant.settings?.proctoringSnapshotRetentionDays ?? 30);
      setCandidateRetentionDays(activeTenant.settings?.candidateDataRetentionDays ?? 180);
      setMinAge(activeTenant.settings?.minimumAgeRequired ?? 18);
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
            proctoringSnapshotRetentionDays: Number(proctoringRetentionDays),
            candidateDataRetentionDays: Number(candidateRetentionDays),
            minimumAgeRequired: Number(minAge),
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

  const handleTriggerPurge = async () => {
    if (!window.confirm('Execute automated retention purge now? Expired proctoring snapshots older than configured threshold will be unlinked (records under active Legal Hold are strictly preserved).')) return;
    setPurging(true);
    setPurgeResult(null);
    try {
      const res = await fetch('/api/admin/retention/purge-expired', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId: activeTenant?.id })
      });
      const data = await res.json();
      if (data.success) {
        setPurgeResult(`Purged ${data.purgedCount} expired snapshots. ${data.legalHoldSkippedCount} records skipped due to active legal hold.`);
      } else {
        alert('Purge error: ' + data.error);
      }
    } catch (err: any) {
      alert('Purge request failed: ' + err.message);
    } finally {
      setPurging(false);
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

        {/* Card 3: Data Retention & DPDP Controls */}
        <div className="bg-white border border-zinc-200 rounded-lg p-5 shadow-2xs space-y-4">
          <div className="flex items-center space-x-2 border-b border-zinc-100 pb-3">
            <Database className="w-4 h-4 text-amber-600" />
            <h3 className="text-xs font-bold text-zinc-900 uppercase font-mono tracking-wider">
              Data Retention & DPDP Controls
            </h3>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-semibold text-zinc-700">Webcam Snapshot Retention</label>
              <span className="text-xs font-mono font-bold text-amber-600">{proctoringRetentionDays} Days</span>
            </div>
            <input
              type="range"
              min={7}
              max={90}
              step={1}
              value={proctoringRetentionDays}
              onChange={(e) => setProctoringRetentionDays(Number(e.target.value))}
              className="w-full accent-amber-600"
            />
            <p className="text-[10px] text-zinc-400 mt-1">Periodic proctoring photos are unlinked from disk after this period unless under active legal hold.</p>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-semibold text-zinc-700">Candidate Data Retention</label>
              <span className="text-xs font-mono font-bold text-amber-600">{candidateRetentionDays} Days</span>
            </div>
            <input
              type="range"
              min={30}
              max={365}
              step={15}
              value={candidateRetentionDays}
              onChange={(e) => setCandidateRetentionDays(Number(e.target.value))}
              className="w-full accent-amber-600"
            />
            <p className="text-[10px] text-zinc-400 mt-1">Overall candidate assessment scores and resume files retention window.</p>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-semibold text-zinc-700">Minimum Age Assurance Gate</label>
              <span className="text-xs font-mono font-bold text-blue-600">{minAge} Years</span>
            </div>
            <select
              value={minAge}
              onChange={(e) => setMinAge(Number(e.target.value))}
              className="w-full bg-white border border-zinc-200 rounded-md px-3 py-2 text-xs text-zinc-900 focus:outline-none focus:border-blue-500"
            >
              <option value={14}>14 Years (Apprentices Act, 1961 - Designated trades)</option>
              <option value={16}>16 Years (Vocational training & skill internships)</option>
              <option value={18}>18 Years (Standard adult employment / contract eligibility)</option>
            </select>
            <p className="text-[10px] text-zinc-400 mt-1">Configurable by tenant based on applicable Indian labour & apprenticeship regulations.</p>
          </div>

          <div className="pt-2 border-t border-zinc-100 flex items-center justify-between">
            <span className="text-[11px] text-zinc-500">Legal Hold Protected</span>
            <button
              type="button"
              disabled={purging}
              onClick={handleTriggerPurge}
              className="px-2.5 py-1 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded transition flex items-center space-x-1 cursor-pointer"
            >
              <Trash2 className="w-3 h-3" />
              <span>{purging ? 'Purging...' : 'Purge Expired Media'}</span>
            </button>
          </div>

          {purgeResult && (
            <div className="p-2 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded text-[11px] font-mono">
              {purgeResult}
            </div>
          )}
        </div>

        {/* Card 4: Subscription Transparency & Fair Terms */}
        <div className="bg-white border border-zinc-200 rounded-lg p-5 shadow-2xs space-y-4">
          <div className="flex items-center space-x-2 border-b border-zinc-100 pb-3">
            <CreditCard className="w-4 h-4 text-indigo-600" />
            <h3 className="text-xs font-bold text-zinc-900 uppercase font-mono tracking-wider">
              Subscription & Renewal Transparency
            </h3>
          </div>

          <div className="p-3 bg-zinc-50 rounded border border-zinc-200 space-y-2 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-zinc-600 font-medium">Current Workspace Plan:</span>
              <span className="font-mono font-bold text-zinc-900 uppercase px-2 py-0.5 bg-zinc-200 rounded text-[10px]">
                {activeTenant?.plan || 'ENTERPRISE'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-zinc-600 font-medium">Billing Cycle:</span>
              <span className="text-zinc-800 font-mono text-[11px]">Monthly / Annual Renewal</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-zinc-600 font-medium">Cancellation Notice:</span>
              <span className="text-emerald-700 font-semibold text-[11px]">Immediate self-service / No barriers</span>
            </div>
          </div>

          <div className="text-[11px] text-zinc-600 space-y-2 leading-relaxed">
            <p>
              In accordance with fair subscription guidelines (Consumer Protection Dark Patterns Guidelines, 2023):
            </p>
            <ul className="list-disc list-inside space-y-1 text-zinc-500">
              <li>Renewal terms, billing frequency, and refund windows are disclosed prior to billing.</li>
              <li>No forced continuity, disguised cancellation workflows, or hidden charges.</li>
              <li>Subscription cancellation requests can be initiated at any time prior to the renewal cycle without penalty.</li>
            </ul>
          </div>

          <div className="pt-2 border-t border-zinc-100 flex justify-between items-center">
            <span className="text-[10px] text-zinc-400 font-mono">Invoice / Tax details configured dynamically</span>
            <button
              type="button"
              onClick={() => alert('Subscription cancellation or tier changes can be managed directly via your enterprise billing agreement without cancellation penalties.')}
              className="text-xs text-zinc-700 hover:text-zinc-900 underline font-medium cursor-pointer"
            >
              Subscription Terms & Policy
            </button>
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
