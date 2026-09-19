import React, { useState } from 'react';
import { ShieldCheck, Lock, Mail, ArrowRight, AlertCircle, Sparkles, Building2, UserCheck } from 'lucide-react';
import { setStoredSession, UserSession } from '../../lib/auth';
import { RegisterTenantModal } from './RegisterTenantModal';

interface LoginPageProps {
  onLoginSuccess: (user: UserSession) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Authentication failed. Please check your credentials.');
      }

      setStoredSession(data.token, data.user);
      onLoginSuccess(data.user);
    } catch (err: any) {
      setError(err.message || 'Error connecting to authentication service.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickFill = (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex flex-col justify-center items-center p-4 font-sans text-zinc-900 select-none">
      
      {/* Container */}
      <div className="w-full max-w-md bg-white border border-zinc-200 rounded-lg shadow-sm p-8 space-y-6">
        
        {/* Brand Header */}
        <div className="text-center space-y-2 pb-4 border-b border-zinc-100">
          <div className="inline-flex items-center justify-center w-11 h-11 bg-zinc-900 rounded-md text-white font-mono font-black text-base shadow-xs mb-1">
            TS
          </div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-900 font-mono">
            TECHSCREEN <span className="text-blue-600 font-normal">PRO</span>
          </h1>
          <p className="text-xs text-zinc-500 max-w-xs mx-auto">
            Automated Technical Screening & Proctored Assessment Platform
          </p>
        </div>

        {/* Security Alert Badge */}
        <div className="bg-zinc-50 border border-zinc-200/80 rounded px-3 py-2 flex items-center justify-between text-[11px] text-zinc-600 font-mono">
          <div className="flex items-center space-x-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>AUTHENTICATED ACCESS REQUIRED</span>
          </div>
          <span className="bg-emerald-50 text-emerald-700 text-[10px] font-bold px-1.5 py-0.5 rounded border border-emerald-200">
            ENCRYPTED
          </span>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded text-xs flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-zinc-700 font-semibold mb-1">Work Email</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-zinc-400 absolute left-3 top-2.5" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="recruiter@acme.com"
                className="w-full bg-white border border-zinc-200 rounded pl-9 pr-3 py-2 text-xs text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-zinc-500 transition"
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
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full bg-white border border-zinc-200 rounded pl-9 pr-3 py-2 text-xs text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-zinc-500 transition"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !email || !password}
            className="w-full bg-zinc-900 hover:bg-zinc-800 text-white font-semibold py-2.5 rounded transition flex items-center justify-center space-x-2 disabled:opacity-50 cursor-pointer text-xs"
          >
            <span>{loading ? 'Authenticating...' : 'Sign In to Workspace'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </form>

        {/* Self-Service Multi-Tenant Workspace Onboarding Action */}
        <div className="bg-blue-50/60 border border-blue-200/80 rounded-lg p-3 text-center space-y-1.5">
          <div className="text-xs font-semibold text-blue-900 flex items-center justify-center space-x-1.5">
            <Building2 className="w-3.5 h-3.5 text-blue-600" />
            <span>Need a workspace for your company?</span>
          </div>
          <p className="text-[11px] text-blue-700/80">
            Set up an isolated enterprise tenant with custom branding and question library in 60 seconds.
          </p>
          <button
            type="button"
            onClick={() => setIsRegisterOpen(true)}
            className="w-full mt-1 bg-white hover:bg-blue-50 text-blue-700 font-semibold text-xs py-1.5 px-3 rounded border border-blue-300 transition cursor-pointer shadow-2xs"
          >
            + Create New Organization Workspace
          </button>
        </div>

        {/* Quick Demo Fill Buttons for Testing */}
        <div className="pt-2 border-t border-zinc-100 space-y-2">
          <div className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider flex items-center justify-between">
            <span>Quick Demo Credentials</span>
            <Sparkles className="w-3 h-3 text-amber-500" />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleQuickFill('recruiter@acme.com', 'Recruiter@123456')}
              className="px-2.5 py-1.5 bg-zinc-50 hover:bg-zinc-100 text-zinc-700 border border-zinc-200 rounded text-[11px] font-medium text-left transition cursor-pointer flex flex-col"
            >
              <div className="font-semibold text-zinc-900 flex items-center space-x-1">
                <UserCheck className="w-3 h-3 text-blue-600" />
                <span>Acme Recruiter</span>
              </div>
              <span className="text-[10px] text-zinc-400 truncate">recruiter@acme.com</span>
            </button>

            <button
              type="button"
              onClick={() => handleQuickFill('admin@techscreen.com', 'Admin@123456')}
              className="px-2.5 py-1.5 bg-zinc-50 hover:bg-zinc-100 text-zinc-700 border border-zinc-200 rounded text-[11px] font-medium text-left transition cursor-pointer flex flex-col"
            >
              <div className="font-semibold text-zinc-900 flex items-center space-x-1">
                <Building2 className="w-3 h-3 text-emerald-600" />
                <span>Acme Admin</span>
              </div>
              <span className="text-[10px] text-zinc-400 truncate">admin@techscreen.com</span>
            </button>
          </div>
        </div>

        {/* Footer info */}
        <p className="text-[11px] text-zinc-400 text-center font-mono">
          Candidate screening links do not require recruiter login.
        </p>

        {/* Register Organization Modal */}
        <RegisterTenantModal
          isOpen={isRegisterOpen}
          onClose={() => setIsRegisterOpen(false)}
          onSuccess={(user) => onLoginSuccess(user)}
        />

      </div>
      
    </div>
  );
};
