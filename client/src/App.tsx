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

export const App: React.FC = () => {
  // Candidate / Interview standalone routes mode vs Recruiter Workspace
  const [standaloneMode, setStandaloneMode] = useState<'NONE' | 'CANDIDATE' | 'RESULT' | 'INTERVIEW' | 'BADGE'>('NONE');
  
  // Recruiter active view state
  const [activeView, setActiveView] = useState<string>('dashboard');
  const [candidateToken, setCandidateToken] = useState<string>('demo-test-token-priya-123456');
  const [isCreateJobOpen, setIsCreateJobOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Check URL pathname for candidate assessment link /assessment/:token, /interview/:roomToken or /verify/:badgeId
  useEffect(() => {
    const pathname = window.location.pathname;
    if (pathname.startsWith('/interview/')) {
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

  // Isolated views (Candidate Test, Live Sandbox, Verified Skill Badge)
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
    return (
      <div className="min-h-screen bg-[#FAFAFA] text-zinc-900 font-sans">
        {/* Candidate preview return banner */}
        <div className="bg-zinc-900 text-white text-xs py-2 px-4 flex justify-between items-center font-mono">
          <span>Candidate Assessment Simulator Mode Token: {candidateToken}</span>
          <button
            onClick={() => setStandaloneMode('NONE')}
            className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[11px] font-sans font-medium rounded border border-zinc-700"
          >
            &larr; Return to Recruiter Workspace
          </button>
        </div>
        <CandidateFlow token={candidateToken} />
      </div>
    );
  }

  // Enterprise Recruiter Workspace Shell
  return (
    <div className="min-h-screen bg-[#FAFAFA] text-zinc-900 flex font-sans antialiased">
      
      {/* Persistent Left Sidebar */}
      <Sidebar
        activeView={activeView}
        setActiveView={setActiveView}
        onOpenCreateJob={() => setIsCreateJobOpen(true)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        
        {/* Workspace Top Bar */}
        <Header
          activeView={activeView}
          onOpenCandidateDemo={() => setStandaloneMode('CANDIDATE')}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
        />

        {/* View Component Render */}
        <main className="flex-1 p-6 max-w-7xl w-full mx-auto">
          {activeView === 'dashboard' && (
            <RecruiterDashboard
              searchQuery={searchQuery}
              onNavigateView={setActiveView}
            />
          )}
          {activeView === 'candidates' && (
            <RecruiterDashboard
              searchQuery={searchQuery}
              initialFilter="ALL"
              onNavigateView={setActiveView}
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

    </div>
  );
};

export default App;
