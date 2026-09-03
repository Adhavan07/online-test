import React, { useEffect, useState } from 'react';
import { X, FileText, CheckCircle, XCircle, Clock, Send, Award, Calendar, ChevronRight, ShieldAlert, ShieldCheck, Code2, Copy, Check } from 'lucide-react';

interface CandidateDetailDrawerProps {
  applicationId: string | null;
  onClose: () => void;
  onOpenResume: (name: string, email: string, fileName?: string | null, url?: string | null) => void;
  onStatusChanged: () => void;
}

export const CandidateDetailDrawer: React.FC<CandidateDetailDrawerProps> = ({
  applicationId,
  onClose,
  onOpenResume,
  onStatusChanged,
}) => {
  const [detail, setDetail] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'proctoring' | 'coding'>('overview');
  const [copiedCodeIdx, setCopiedCodeIdx] = useState<number | null>(null);

  useEffect(() => {
    if (!applicationId) return;
    setLoading(true);
    fetch(`/api/candidates/detail/${applicationId}`)
      .then(res => res.json())
      .then(data => {
        if (data.success) setDetail(data.detail);
      })
      .catch(err => console.error('Error fetching detail:', err))
      .finally(() => setLoading(false));
  }, [applicationId]);

  if (!applicationId) return null;

  const handleUpdateStatus = async (newStatus: string) => {
    setUpdatingStatus(true);
    try {
      const res = await fetch(`/api/candidates/${applicationId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (data.success) {
        setDetail((prev: any) => ({ ...prev, status: newStatus }));
        onStatusChanged();
      }
    } catch (err) {
      console.error('Error updating status:', err);
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleResendInvite = async () => {
    try {
      const res = await fetch(`/api/candidates/${applicationId}/resend-invite`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        alert(data.message);
      }
    } catch (err: any) {
      alert('Error resending invite: ' + err.message);
    }
  };

  const copyCodeToClipboard = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedCodeIdx(idx);
    setTimeout(() => setCopiedCodeIdx(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-950/70 backdrop-blur-sm animate-fadeIn flex justify-end">
      <div className="bg-slate-900 border-l border-slate-800 w-full max-w-2xl h-full shadow-2xl flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
          <div>
            <h2 className="text-lg font-bold text-white">Candidate Assessment Record</h2>
            <p className="text-xs text-slate-400">Application ID: #{applicationId.slice(-8)}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab Selector Bar */}
        <div className="flex items-center px-6 border-b border-slate-800 bg-slate-950/60 gap-4 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-3 border-b-2 transition ${
              activeTab === 'overview'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Performance Overview
          </button>
          <button
            onClick={() => setActiveTab('proctoring')}
            className={`py-3 border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'proctoring'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            Integrity Scorecard
            {detail?.assessmentSummary?.integrityScore !== undefined && (
              <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                detail.assessmentSummary.integrityScore >= 90
                  ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/40'
                  : 'bg-rose-950 text-rose-400 border border-rose-800/40'
              }`}>
                {detail.assessmentSummary.integrityScore}%
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('coding')}
            className={`py-3 border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'coding'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            Code Submissions ({detail?.assessmentSummary?.codeSubmissions?.length || 0})
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-sm">Loading candidate details...</div>
        ) : !detail ? (
          <div className="p-12 text-center text-slate-400 text-sm">Candidate details not found.</div>
        ) : (
          <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-300">
            
            {/* Candidate Top Banner */}
            <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="text-xl font-bold text-white">{detail.candidate.name}</h3>
                <p className="text-xs text-slate-400 mt-0.5">{detail.candidate.email} • {detail.candidate.phone || 'No phone'}</p>
                <div className="mt-2 flex items-center space-x-2">
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    Role: {detail.job.title}
                  </span>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-md ${
                    detail.status === 'HR_INTERVIEW' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' :
                    detail.status === 'PASSED' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                    detail.status === 'FAILED' || detail.status === 'REJECTED' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                    'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                  }`}>
                    {detail.status}
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-2 shrink-0">
                <button
                  onClick={() => onOpenResume(detail.candidate.name, detail.candidate.email, detail.candidate.resumeFileName, detail.candidate.resumeUrl)}
                  className="flex items-center space-x-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold px-3 py-2 rounded-xl border border-slate-700 transition"
                >
                  <FileText className="h-4 w-4 text-blue-400" />
                  <span>View Resume</span>
                </button>
                <button
                  onClick={handleResendInvite}
                  className="flex items-center space-x-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium px-3 py-1.5 rounded-xl border border-slate-700 transition"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>Resend Test Link</span>
                </button>
              </div>
            </div>

            {/* TAB 1: OVERVIEW */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* Technical Assessment Performance Card */}
                <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                    <h4 className="font-bold text-white text-sm flex items-center space-x-2">
                      <Award className="h-4 w-4 text-amber-400" />
                      <span>Technical Evaluation Results</span>
                    </h4>
                    <span className="text-xs text-slate-400 font-medium">Pass Threshold: {detail.job.passThreshold}%</span>
                  </div>

                  {detail.assessmentSummary ? (
                    <div className="space-y-4">
                      
                      {/* Big Percentage Badge */}
                      <div className="flex items-center justify-between bg-slate-900 p-4 rounded-xl border border-slate-800">
                        <div>
                          <div className="text-xs text-slate-400">Total Score Achieved</div>
                          <div className="text-2xl font-extrabold text-white">
                            {detail.assessmentSummary.totalScore} / {detail.assessmentSummary.maxScore} <span className="text-lg font-semibold text-slate-400">({detail.assessmentSummary.percentage}%)</span>
                          </div>
                        </div>
                        <div>
                          {detail.assessmentSummary.isPassed ? (
                            <div className="flex items-center space-x-1.5 bg-emerald-500/10 text-emerald-400 px-3 py-1.5 rounded-xl border border-emerald-500/20 text-xs font-bold">
                              <CheckCircle className="h-4 w-4" />
                              <span>PASSED</span>
                            </div>
                          ) : (
                            <div className="flex items-center space-x-1.5 bg-red-500/10 text-red-400 px-3 py-1.5 rounded-xl border border-red-500/20 text-xs font-bold">
                              <XCircle className="h-4 w-4" />
                              <span>FAILED</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Section Breakdown Progress Bars */}
                      <div className="space-y-3">
                        <h5 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Section Performance Breakdown</h5>
                        {Object.entries(detail.assessmentSummary.sectionScores || {}).map(([secName, secData]: [string, any]) => {
                          const secPct = Math.round((secData.score / (secData.max || 1)) * 100);
                          return (
                            <div key={secName} className="space-y-1 text-xs">
                              <div className="flex justify-between font-medium">
                                <span className="text-slate-200">{secName}</span>
                                <span className="text-slate-400">{secData.score}/{secData.max} ({secPct}%)</span>
                              </div>
                              <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                                <div
                                  className={`h-full transition-all rounded-full ${secPct >= 70 ? 'bg-emerald-500' : secPct >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                                  style={{ width: `${secPct}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>

                    </div>
                  ) : (
                    <div className="py-6 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
                      <Clock className="h-6 w-6 text-slate-500 animate-pulse" />
                      <span>Assessment Pending — Candidate has not completed the evaluation yet.</span>
                    </div>
                  )}
                </div>

                {/* Assessment Event Timeline */}
                <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-3">
                  <h4 className="font-bold text-white text-sm flex items-center space-x-2">
                    <Calendar className="h-4 w-4 text-blue-400" />
                    <span>Assessment Audit Timeline</span>
                  </h4>
                  <div className="space-y-2.5 pt-1">
                    {detail.timeline.map((item: any, idx: number) => (
                      <div key={idx} className="flex items-center space-x-3 text-xs">
                        <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                        <div className="flex-1 flex justify-between">
                          <span className="font-medium text-slate-200">{item.event}</span>
                          <span className="text-slate-500 font-mono">{new Date(item.timestamp).toLocaleString()}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: PROCTORING INTEGRITY SCORECARD */}
            {activeTab === 'proctoring' && (
              <div className="space-y-6">
                <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                    <h4 className="font-bold text-white text-sm flex items-center space-x-2">
                      <ShieldCheck className="h-4 w-4 text-emerald-400" />
                      <span>Proctoring Integrity Scorecard</span>
                    </h4>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-extrabold uppercase ${
                      (detail.assessmentSummary?.integrityScore || 100) >= 85
                        ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/40'
                        : 'bg-rose-950 text-rose-400 border border-rose-800/40'
                    }`}>
                      {detail.assessmentSummary?.integrityScore || 100}% Trust Rating
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl">
                      <div className="text-slate-400 font-medium">Window Tab Switch Count</div>
                      <div className="text-xl font-bold text-white mt-1">
                        {detail.assessmentSummary?.tabSwitchCount || 0} times
                      </div>
                    </div>
                    <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl">
                      <div className="text-slate-400 font-medium">Fullscreen Exit Count</div>
                      <div className="text-xl font-bold text-white mt-1">
                        {detail.assessmentSummary?.fullscreenViolationCount || 0} times
                      </div>
                    </div>
                  </div>

                  {/* Proctoring Event Log Items */}
                  <div className="space-y-2 pt-2">
                    <h5 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Recorded Proctoring Alerts</h5>
                    {detail.assessmentSummary?.proctoringLogs?.length > 0 ? (
                      <div className="space-y-2">
                        {detail.assessmentSummary.proctoringLogs.map((log: any) => (
                          <div key={log.id} className="p-3 bg-slate-900 border border-slate-800 rounded-xl flex items-start gap-2.5 text-xs">
                            <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                            <div className="flex-1">
                              <div className="flex items-center justify-between font-bold text-slate-200">
                                <span>{log.eventType.replace('_', ' ')}</span>
                                <span className="font-mono text-[10px] text-slate-500">{new Date(log.timestamp).toLocaleTimeString()}</span>
                              </div>
                              <p className="text-slate-400 mt-0.5">{log.details || 'Integrity flag recorded by browser listener.'}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-4 text-center text-slate-500 text-xs bg-slate-900 rounded-xl border border-slate-800">
                        No proctoring violations recorded. Clean assessment session.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: CODE SUBMISSIONS */}
            {activeTab === 'coding' && (
              <div className="space-y-6">
                {detail.assessmentSummary?.codeSubmissions?.length > 0 ? (
                  <div className="space-y-4">
                    {detail.assessmentSummary.codeSubmissions.map((cs: any, idx: number) => (
                      <div key={idx} className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-cyan-400 uppercase bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                            {cs.sectionTitle || 'Coding Section'}
                          </span>
                          <button
                            onClick={() => copyCodeToClipboard(cs.codeAnswer, idx)}
                            className="p-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-lg text-xs flex items-center gap-1 border border-slate-800 transition"
                          >
                            {copiedCodeIdx === idx ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                            <span>{copiedCodeIdx === idx ? 'Copied' : 'Copy Code'}</span>
                          </button>
                        </div>
                        <h4 className="text-xs font-semibold text-slate-200">{cs.questionPrompt}</h4>
                        <pre className="p-3 bg-slate-900 text-emerald-300 font-mono text-xs rounded-xl overflow-x-auto border border-slate-800">
                          {cs.codeAnswer}
                        </pre>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-12 text-center text-slate-500 text-xs bg-slate-950 rounded-2xl border border-slate-800">
                    No practical code submissions available for this candidate attempt.
                  </div>
                )}
              </div>
            )}

          </div>
        )}

        {/* Footer Action Bar */}
        {detail && (
          <div className="px-6 py-4 border-t border-slate-800 bg-slate-900 flex items-center justify-between gap-3">
            <button
              disabled={updatingStatus}
              onClick={() => handleUpdateStatus('REJECTED')}
              className="px-4 py-2 bg-red-950/40 hover:bg-red-900/50 text-red-300 text-xs font-semibold rounded-xl border border-red-800/40 transition disabled:opacity-50"
            >
              Reject Candidate
            </button>

            <div className="flex items-center space-x-2">
              <button
                disabled={updatingStatus}
                onClick={() => handleUpdateStatus('SHORTLISTED')}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition disabled:opacity-50"
              >
                Shortlist
              </button>
              <button
                disabled={updatingStatus}
                onClick={() => handleUpdateStatus('HR_INTERVIEW')}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-xl flex items-center space-x-1 transition shadow-lg shadow-purple-600/20 disabled:opacity-50"
              >
                <span>Proceed to HR Interview</span>
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
