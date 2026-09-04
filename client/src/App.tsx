import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { RecruiterDashboard } from './components/recruiter/RecruiterDashboard';
import { AdminPortal } from './components/admin/AdminPortal';
import { CandidateFlow } from './components/candidate/CandidateFlow';
import { CandidateResultCertificate } from './components/candidate/CandidateResultCertificate';
import { LiveInterviewRoom } from './components/candidate/LiveInterviewRoom';
import { VerifiedSkillBadge } from './components/candidate/VerifiedSkillBadge';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'RECRUITER' | 'ADMIN' | 'CANDIDATE' | 'RESULT' | 'INTERVIEW' | 'BADGE'>('RECRUITER');
  const [candidateToken, setCandidateToken] = useState<string>('demo-test-token-priya-123456');

  // Check URL pathname for candidate assessment link /assessment/:token, /interview/:roomToken or /verify/:badgeId
  useEffect(() => {
    const pathname = window.location.pathname;
    if (pathname.startsWith('/interview/')) {
      setActiveTab('INTERVIEW');
    } else if (pathname.startsWith('/verify/')) {
      setActiveTab('BADGE');
    } else if (pathname.startsWith('/assessment/result/')) {
      const token = pathname.replace('/assessment/result/', '').trim();
      if (token) {
        setCandidateToken(token);
        setActiveTab('RESULT');
      }
    } else if (pathname.startsWith('/assessment/')) {
      const tokenFromUrl = pathname.replace('/assessment/', '').trim();
      if (tokenFromUrl) {
        setCandidateToken(tokenFromUrl);
        setActiveTab('CANDIDATE');
      }
    }
  }, []);

  if (activeTab === 'INTERVIEW') {
    return <LiveInterviewRoom />;
  }

  if (activeTab === 'BADGE') {
    return <VerifiedSkillBadge />;
  }

  if (activeTab === 'RESULT') {
    return <CandidateResultCertificate token={candidateToken} />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      
      {/* Global Header & Navigation */}
      <Header
        activeTab={activeTab as any}
        setActiveTab={setActiveTab as any}
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
        TechScreen Pro — Enterprise Automated Technical Screening & Assessment Integrity Platform
      </footer>

    </div>
  );
};

export default App;
