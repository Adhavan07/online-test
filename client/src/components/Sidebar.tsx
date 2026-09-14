import React from 'react';
import { 
  LayoutDashboard, Users, Briefcase, FileText, BarChart3, 
  Settings, ShieldCheck, UserCheck, ChevronRight, Sparkles, Network, LogOut
} from 'lucide-react';
import { UserSession } from '../lib/auth';

interface SidebarProps {
  activeView: string; // 'dashboard' | 'candidates' | 'jobs' | 'assessments' | 'analytics' | 'admin'
  setActiveView: (view: string) => void;
  onOpenCreateJob: () => void;
  currentUser?: UserSession | null;
  onLogout?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeView,
  setActiveView,
  onOpenCreateJob,
}) => {
  const navSections = [
    {
      title: 'OVERVIEW',
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      ]
    },
    {
      title: 'HIRING',
      items: [
        { id: 'candidates', label: 'Candidates', icon: Users },
        { id: 'jobs', label: 'Jobs', icon: Briefcase },
        { id: 'assessments', label: 'Assessments', icon: FileText },
      ]
    },
    {
      title: 'INSIGHTS',
      items: [
        { id: 'analytics', label: 'Analytics', icon: BarChart3 },
      ]
    },
    {
      title: 'SYSTEM',
      items: [
        { id: 'admin', label: 'Admin Console', icon: Settings },
      ]
    }
  ];

  return (
    <aside className="w-60 bg-[#F4F4F5] border-r border-zinc-200 flex flex-col justify-between shrink-0 h-screen sticky top-0 select-none text-zinc-800">
      
      {/* Brand Header */}
      <div>
        <div className="px-5 py-4 border-b border-zinc-200/80 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-6 h-6 bg-zinc-900 rounded flex items-center justify-center text-white font-mono text-xs font-black tracking-tighter">
              TS
            </div>
            <span className="font-bold text-sm text-zinc-900 tracking-tight font-mono">
              TECHSCREEN
            </span>
          </div>
          <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest px-1.5 py-0.5 rounded border border-zinc-200 bg-white">
            ENT
          </span>
        </div>

        {/* Quick Action Button */}
        <div className="px-3 pt-4 pb-2">
          <button
            onClick={onOpenCreateJob}
            className="w-full bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold py-2 px-3 rounded border border-zinc-900 transition flex items-center justify-between"
          >
            <span>+ Create Job</span>
            <span className="font-mono text-[10px] text-zinc-400">⌘N</span>
          </button>
        </div>

        {/* Navigation Groups */}
        <nav className="px-3 py-2 space-y-4">
          {navSections.map((section) => (
            <div key={section.title} className="space-y-1">
              <h4 className="px-2 text-[10px] font-bold text-zinc-400 tracking-wider uppercase font-mono">
                {section.title}
              </h4>
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeView === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveView(item.id)}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded text-xs font-medium transition ${
                        isActive
                          ? 'bg-white text-zinc-900 font-semibold border border-zinc-200/80 shadow-xs'
                          : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/60'
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        <Icon className={`h-4 w-4 ${isActive ? 'text-blue-600' : 'text-zinc-400'}`} />
                        <span>{item.label}</span>
                      </div>
                      {isActive && <ChevronRight className="h-3 w-3 text-zinc-400" />}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </div>

      {/* User Profile / Organization Footer */}
      <div className="p-3 border-t border-zinc-200 bg-zinc-100/50">
        <div className="flex items-center justify-between p-2 rounded bg-white border border-zinc-200/80">
          <div className="flex items-center space-x-2.5 min-w-0">
            <div className="w-7 h-7 rounded bg-blue-600/10 text-blue-700 font-bold text-xs flex items-center justify-center border border-blue-200 font-mono shrink-0">
              {currentUser?.name ? currentUser.name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase() : 'TS'}
            </div>
            <div className="truncate min-w-0">
              <div className="text-xs font-semibold text-zinc-900 truncate">
                {currentUser?.name || 'Authorized Recruiter'}
              </div>
              <div className="text-[10px] text-zinc-500 font-mono uppercase flex items-center space-x-1">
                <span className="text-emerald-600 font-bold">●</span>
                <span>{currentUser?.role || 'RECRUITER'}</span>
              </div>
            </div>
          </div>

          {onLogout && (
            <button
              onClick={onLogout}
              className="p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded transition cursor-pointer shrink-0 ml-1"
              title="Sign Out"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

    </aside>
  );
};
