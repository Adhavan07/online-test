import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { RecruiterDashboard } from './components/recruiter/RecruiterDashboard';
import { AnalyticsDashboard } from './components/recruiter/AnalyticsDashboard';
import { AdminPortal } from './components/admin/AdminPortal';
import { CreateJobModal } from './components/recruiter/CreateJobModal';
import { CandidateFlow } from './components/candidate/CandidateFlow';
import { CandidateResultCertificate } from './components/candidate/CandidateResultCertificate';
import { LiveInterviewRoom } from './components/candidate/LiveInterviewRoom';
import { VerifiedSkillBadge } from './components/candidate/VerifiedSkillBadge';
import { SmtpSettingsModal } from './components/admin/SmtpSettingsModal';
import { ToastProvider } from './components/common/Toast';
import { LoginPage } from './components/auth/LoginPage';
import { getStoredUser, clearStoredSession, UserSession } from './lib/auth';
import { TenantProvider } from './lib/TenantContext';
import { UnsubscribeView } from './components/legal/UnsubscribeView';

export const AppContent: React.FC = () => {
  // Session State
  const [currentUser, setCurrentUser] = useState<UserSession | null>(getStoredUser());

  // Candidate / Interview standalone routes mode vs Recruiter Workspace
  const [standaloneMode, setStandaloneMode] = useState<'NONE' | 'CANDIDATE' | 'RESULT' | 'INTERVIEW' | 'BADGE' | 'UNSUBSCRIBE'>('NONE');
  
  // Recruiter active view state
  const [activeView, setActiveView] = useState<string>('dashboard');
  const [candidateToken, setCandidateToken] = useState<string>('cand-45oejqhul-mtsfqyqq');
  const [isCreateJobOpen, setIsCreateJobOpen] = useState(false);
  const [isSmtpModalOpen, setIsSmtpModalOpen] = useState(false);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Check URL pathname for candidate assessment link /assessment/:token, /interview/:roomToken or /verify/:badgeId
  useEffect(() => {
    const pathname = window.location.pathname;
    if (pathname.startsWith('/unsubscribe')) {
      setStandaloneMode('UNSUBSCRIBE');
    } else if (pathname.startsWith('/interview/')) {
      setStandaloneMode('INTERVIEW');
    } else if (pathname.startsWith('/verify/')) {
      setStandaloneMode('BADGE');
    } else if (pathname.startsWith('/assessment/result/')) {
      const token = pathname.replace('/assessment/result/', '').trim();
      if (token) {
        setCandidateToken(token);
        setStandaloneMode('RESULT');
      }
    } else if (pathname.startsWith('/assessment/')) {
      const tokenFromUrl = pathname.replace('/assessment/', '').trim();
      if (tokenFromUrl) {
        setCandidateToken(tokenFromUrl);
        setStandaloneMode('CANDIDATE');
      }
    }
  }, []);

  // Listen for unauthorized 401 events across the app
  useEffect(() => {
    const handleUnauthorized = () => {
      clearStoredSession();
      setCurrentUser(null);
    };
    window.addEventListener('techscreen:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('techscreen:unauthorized', handleUnauthorized);
  }, []);

  // Global Keyboard Shortcuts (⌘K for Search, ⌘N for Create Job)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        const searchInput = document.getElementById('global-search-input') as HTMLInputElement | null;
        searchInput?.focus();
      } else if ((e.metaKey || e.ctrlKey) && (e.key === 'n' || e.key === 'N')) {
        e.preventDefault();
        setIsCreateJobOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleLogout = () => {
    clearStoredSession();
    setCurrentUser(null);
  };

  // Isolated views (Candidate Test, Live Sandbox, Verified Skill Badge, Email Unsubscribe)
  if (standaloneMode === 'UNSUBSCRIBE') {
    return <UnsubscribeView />;
  }

  if (standaloneMode === 'INTERVIEW') {
    return <LiveInterviewRoom />;
  }

  if (standaloneMode === 'BADGE') {
    return <VerifiedSkillBadge />;
  }

  if (standaloneMode === 'RESULT') {
    return <CandidateResultCertificate token={candidateToken} />;
  }

  if (standaloneMode === 'CANDIDATE') {
    const candidateOptions = [
      { label: 'Priya Sharma (Pending Test)', token: 'demo-test-token-priya-123456' },
      { label: 'Adhavan jvr (DevOps Candidate)', token: 'cand-45oejqhul-mtsfqyqq' },
      { label: 'Arun Kumar (Completed & Shortlisted)', token: 'arun-devops-token-778899' },
    ];

    return (
      <div className="min-h-screen bg-[#FAFAFA] text-zinc-900 font-sans">
        {/* Candidate preview return banner */}
        <div className="bg-zinc-900 text-white text-xs py-2 px-4 flex flex-wrap justify-between items-center gap-3 font-mono border-b border-zinc-800">
          <div className="flex items-center space-x-2">
            <span className="text-zinc-400 font-medium">Candidate Simulator:</span>
            <select
              value={candidateToken}
              onChange={(e) => setCandidateToken(e.target.value)}
              className="bg-zinc-800 text-zinc-100 border border-zinc-700 rounded px-2.5 py-1 text-xs font-sans focus:outline-none focus:border-zinc-500"
            >
              {candidateOptions.map(opt => (
                <option key={opt.token} value={opt.token}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-[11px] text-zinc-500 hidden sm:inline font-mono">Token: {candidateToken.slice(0, 18)}...</span>
            <button
              onClick={() => setStandaloneMode('NONE')}
              className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[11px] font-sans font-medium rounded border border-zinc-700 transition cursor-pointer"
            >
              &larr; Return to Recruiter Workspace
            </button>
          </div>
        </div>
        <CandidateFlow key={candidateToken} token={candidateToken} />
      </div>
    );
  }

  // If not logged in and not in candidate standalone mode, render Authentication Gate
  if (!currentUser) {
    return <LoginPage onLoginSuccess={(user) => setCurrentUser(user)} />;
  }

  // Enterprise Recruiter Workspace Shell
  return (
    <div className="min-h-screen bg-[#FAFAFA] text-zinc-900 flex font-sans antialiased">
      
      {/* Persistent Left Sidebar */}
      <Sidebar
        activeView={activeView}
        setActiveView={setActiveView}
        onOpenCreateJob={() => setIsCreateJobOpen(true)}
        currentUser={currentUser}
        onLogout={handleLogout}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        
        {/* Workspace Top Bar */}
        <Header
          activeView={activeView}
          onOpenCandidateDemo={() => setStandaloneMode('CANDIDATE')}
          onOpenSmtpSettings={() => setIsSmtpModalOpen(true)}
          onSelectCandidate={(id) => {
            setSelectedCandidateId(id);
            setActiveView('dashboard');
          }}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
        />

        {/* View Component Render */}
        <main className="flex-1 p-6 max-w-7xl w-full mx-auto">
          {activeView === 'dashboard' && (
            <RecruiterDashboard
              searchQuery={searchQuery}
              onNavigateView={setActiveView}
              onOpenSmtpSettings={() => setIsSmtpModalOpen(true)}
              selectedCandidateId={selectedCandidateId}
            />
          )}
          {activeView === 'candidates' && (
            <RecruiterDashboard
              searchQuery={searchQuery}
              initialFilter="ALL"
              onNavigateView={setActiveView}
              onOpenSmtpSettings={() => setIsSmtpModalOpen(true)}
              selectedCandidateId={selectedCandidateId}
            />
          )}
          {activeView === 'jobs' && (
            <AdminPortal initialTab="QUESTION_BANK" />
          )}
          {activeView === 'assessments' && (
            <AdminPortal initialTab="QUESTION_BANK" />
          )}
          {activeView === 'analytics' && (
            <AnalyticsDashboard />
          )}
          {activeView === 'admin' && (
            <AdminPortal initialTab="METRICS" />
          )}
        </main>

        {/* Minimal Footer */}
        <footer className="border-t border-zinc-200 py-3 px-6 text-center text-xs text-zinc-400 font-mono">
          TECHSCREEN &bull; Enterprise Technical Screening & Integrity Platform
        </footer>

      </div>

      {/* Global Create Job Modal */}
      <CreateJobModal
        isOpen={isCreateJobOpen}
        onClose={() => setIsCreateJobOpen(false)}
        onSuccess={() => {
          setIsCreateJobOpen(false);
          setActiveView('dashboard');
        }}
      />

      {/* Live Email & SMTP Settings Modal */}
      <SmtpSettingsModal
        isOpen={isSmtpModalOpen}
        onClose={() => setIsSmtpModalOpen(false)}
      />

    </div>
  );
};

export const App: React.FC = () => {
  return (
    <TenantProvider>
      <ToastProvider>
        <AppContent />
      </ToastProvider>
    </TenantProvider>
  );
};

export default App;
