import React from 'react';
import { ShieldCheck, UserCheck, Settings, FileSpreadsheet, ExternalLink } from 'lucide-react';

interface HeaderProps {
  activeTab: 'RECRUITER' | 'ADMIN' | 'CANDIDATE';
  setActiveTab: (tab: 'RECRUITER' | 'ADMIN' | 'CANDIDATE') => void;
  candidateToken: string;
  setCandidateToken: (token: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  candidateToken,
  setCandidateToken,
}) => {
  return (
    <header className="bg-slate-900/90 backdrop-blur border-b border-slate-800 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Brand Logo */}
        <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setActiveTab('RECRUITER')}>
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/20 ring-1 ring-white/10">
            <ShieldCheck className="h-6 w-6 text-white" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-bold text-lg text-white tracking-tight">TechScreen</span>
              <span className="bg-blue-500/10 text-blue-400 text-xs font-semibold px-2 py-0.5 rounded border border-blue-500/20">PRO</span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium hidden sm:block">Automated Technical Screening Platform</p>
          </div>
        </div>

        {/* Role Switcher Tabs */}
        <nav className="flex items-center space-x-1 sm:space-x-2 bg-slate-800/80 p-1 rounded-xl border border-slate-700/60">
          <button
            onClick={() => setActiveTab('RECRUITER')}
            className={`flex items-center space-x-2 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
              activeTab === 'RECRUITER'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
            }`}
          >
            <UserCheck className="h-4 w-4" />
            <span>Recruiter HR</span>
          </button>

          <button
            onClick={() => setActiveTab('ADMIN')}
            className={`flex items-center space-x-2 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
              activeTab === 'ADMIN'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
            }`}
          >
            <Settings className="h-4 w-4" />
            <span>Admin Console</span>
          </button>

          <button
            onClick={() => {
              if (!candidateToken) setCandidateToken('demo-test-token-priya-123456');
              setActiveTab('CANDIDATE');
            }}
            className={`flex items-center space-x-2 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
              activeTab === 'CANDIDATE'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
            }`}
          >
            <FileSpreadsheet className="h-4 w-4" />
            <span>Candidate Test Portal</span>
          </button>
        </nav>

        {/* Candidate Direct Link Simulator Quick-Button */}
        <div className="hidden lg:flex items-center space-x-2">
          <button
            onClick={() => {
              setCandidateToken('demo-test-token-priya-123456');
              setActiveTab('CANDIDATE');
            }}
            className="flex items-center space-x-2 text-xs bg-slate-800 hover:bg-slate-700 text-blue-400 hover:text-blue-300 font-medium px-3 py-1.5 rounded-lg border border-slate-700 transition"
            title="Open Priya Sharma's candidate test link"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            <span>Try Candidate Test Link</span>
          </button>
        </div>

      </div>
    </header>
  );
};
