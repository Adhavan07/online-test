import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { RecruiterDashboard } from './components/recruiter/RecruiterDashboard';
import { AdminPortal } from './components/admin/AdminPortal';
import { CandidateFlow } from './components/candidate/CandidateFlow';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'RECRUITER' | 'ADMIN' | 'CANDIDATE'>('RECRUITER');
  const [candidateToken, setCandidateToken] = useState<string>('demo-test-token-priya-123456');

  // Check URL pathname for candidate assessment link /assessment/:token
  useEffect(() => {
    const pathname = window.location.pathname;
    if (pathname.startsWith('/assessment/')) {
      const tokenFromUrl = pathname.replace('/assessment/', '').trim();
      if (tokenFromUrl) {
        setCandidateToken(tokenFromUrl);
        setActiveTab('CANDIDATE');
      }
    }
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      
      {/* Global Header & Navigation */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        candidateToken={candidateToken}
        setCandidateToken={setCandidateToken}
      />

      {/* Main App Content View Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        
        {activeTab === 'RECRUITER' && <RecruiterDashboard />}
        {activeTab === 'ADMIN' && <AdminPortal />}
        {activeTab === 'CANDIDATE' && <CandidateFlow token={candidateToken} />}

      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-4 text-center text-xs text-slate-500">
        TechScreen Pro — Automated Technical Screening & Assessment Engine (Phase 1)
      </footer>

    </div>
  );
};

export default App;
