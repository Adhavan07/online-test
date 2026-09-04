import React from 'react';
import { Search, ExternalLink, Bell, Globe } from 'lucide-react';

interface HeaderProps {
  activeView: string;
  onOpenCandidateDemo: () => void;
  searchQuery?: string;
  setSearchQuery?: (q: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeView,
  onOpenCandidateDemo,
  searchQuery = '',
  setSearchQuery,
}) => {
  const getBreadcrumbTitle = (view: string) => {
    switch (view) {
      case 'dashboard': return 'Overview / Dashboard';
      case 'candidates': return 'Hiring / Candidates';
      case 'jobs': return 'Hiring / Jobs & Positions';
      case 'assessments': return 'Hiring / Assessment Templates';
      case 'analytics': return 'Insights / Executive Analytics';
      case 'admin': return 'System / Admin Console';
      default: return 'Overview';
    }
  };

  return (
    <header className="bg-white border-b border-zinc-200 sticky top-0 z-30 h-13 flex items-center justify-between px-6 select-none">
      
      {/* Breadcrumb Title */}
      <div className="flex items-center space-x-3">
        <span className="text-xs font-mono font-medium text-zinc-500 uppercase tracking-wider">
          {getBreadcrumbTitle(activeView)}
        </span>
      </div>

      {/* Center Search Input */}
      <div className="flex-1 max-w-md mx-8 hidden sm:block">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-400" />
          <input
            type="text"
            placeholder="Search candidate name, email, or job position... (⌘K)"
            value={searchQuery}
            onChange={(e) => setSearchQuery && setSearchQuery(e.target.value)}
            className="w-full bg-zinc-50 border border-zinc-200 rounded px-3 py-1.5 pl-9 text-xs text-zinc-900 placeholder-zinc-400 focus:bg-white focus:border-zinc-400 transition"
          />
        </div>
      </div>

      {/* Right Actions */}
      <div className="flex items-center space-x-3">
        <button
          onClick={onOpenCandidateDemo}
          className="flex items-center space-x-1.5 text-xs bg-zinc-100 hover:bg-zinc-200/80 text-zinc-700 font-medium px-2.5 py-1.5 rounded border border-zinc-200 transition"
          title="Simulate opening a candidate test link"
        >
          <ExternalLink className="h-3.5 w-3.5 text-blue-600" />
          <span className="hidden md:inline">Preview Candidate Assessment</span>
          <span className="md:hidden">Candidate Test</span>
        </button>

        <div className="h-4 w-px bg-zinc-200 hidden sm:block" />

        <div className="flex items-center space-x-1 text-[11px] font-mono text-zinc-500 bg-zinc-50 px-2 py-1 rounded border border-zinc-200">
          <Globe className="h-3 w-3 text-emerald-600" />
          <span>PRODUCTION</span>
        </div>
      </div>

    </header>
  );
};
