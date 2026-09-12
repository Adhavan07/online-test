import React, { useEffect, useState } from 'react';
import { 
  X, FileText, CheckCircle, XCircle, Clock, Send, Award, Calendar, 
  ChevronRight, ShieldAlert, ShieldCheck, Code2, Copy, Check, Sparkles, 
  MessageSquare, Star, RotateCcw, Video, ExternalLink, RefreshCw, Briefcase, Camera, Eye
} from 'lucide-react';

interface CandidateDetailDrawerProps {
  applicationId: string | null;
  onClose: () => void;
  onOpenResume: (name: string, email: string, fileName?: string | null, url?: string | null) => void;
  onStatusChanged?: () => void;
  onUpdate?: () => void;
}

export const CandidateDetailDrawer: React.FC<CandidateDetailDrawerProps> = ({
  applicationId,
  onClose,
  onOpenResume,
  onStatusChanged,
  onUpdate,
}) => {
  const triggerStatusChanged = () => {
    if (onStatusChanged) onStatusChanged();
    if (onUpdate) onUpdate();
  };

  const [detail, setDetail] = useState<any>(null);
  const [aiInsights, setAiInsights] = useState<any>(null);
  const [notes, setNotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [reparsingResume, setReparsingResume] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [showAllExtractedSkills, setShowAllExtractedSkills] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'ai-insights' | 'proctoring' | 'coding' | 'notes'>('overview');
  const [copiedCodeIdx, setCopiedCodeIdx] = useState<number | null>(null);

  // HR Interview Modal State
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [selectedSnapshot, setSelectedSnapshot] = useState<string | null>(null);
  const [scheduleData, setScheduleData] = useState({
    interviewScheduledAt: '',
    interviewLink: 'https://meet.google.com/techscreen-hr-interview',
  });

  const handleLaunchLiveRoom = async () => {
    try {
      const res = await fetch('/api/interviews/create-room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applicationId, interviewerName: 'Technical Lead' })
      });
      const data = await res.json();
      if (data.success) {
        window.open(data.interviewUrl, '_blank');
        fetchData();
        triggerStatusChanged();
      } else {
        alert(data.error);
      }
    } catch (err: any) {
      alert('Error launching live interview room: ' + err.message);
    }
  };

  const handleIssueBadge = async () => {
    try {
      const res = await fetch('/api/badges/issue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applicationId })
      });
      const data = await res.json();
      if (data.success) {
        window.open(data.badgeUrl, '_blank');
      } else {
        alert(data.error);
      }
    } catch (err: any) {
      alert('Error issuing verified badge: ' + err.message);
    }
  };

  const fetchData = async () => {
    if (!applicationId) return;
    setLoading(true);
    try {
      const [detailRes, aiRes, notesRes] = await Promise.all([
        fetch(`/api/candidates/detail/${applicationId}`).then(r => r.json()),
        fetch(`/api/analytics/candidates/${applicationId}/ai-insights`).then(r => r.json()),
        fetch(`/api/candidates/${applicationId}/notes`).then(r => r.json()),
      ]);

      if (detailRes.success) setDetail(detailRes.detail);
      if (aiRes.success) setAiInsights(aiRes.aiInsights);
      if (notesRes.success) setNotes(notesRes.notes || []);
    } catch (err) {
      console.error('Error fetching detail:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [applicationId]);

  if (!applicationId) return null;

  const handleUpdateStatus = async (newStatus: string) => {
    if (!applicationId) return;
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
        triggerStatusChanged();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleReparseResume = async () => {
    if (!applicationId) return;
    setReparsingResume(true);
    try {
      const res = await fetch(`/api/candidates/${applicationId}/reparse-resume`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        await fetchData();
        triggerStatusChanged();
      } else {
        alert(data.error || 'Failed to re-parse resume PDF.');
      }
    } catch (err: any) {
      alert(err.message || 'Error communicating with server.');
    } finally {
      setReparsingResume(false);
    }
  };

  const handleResendInvite = async () => {
    try {
      const res = await fetch(`/api/candidates/${applicationId}/resend-invite`, { method: 'POST' });
      const data = await res.json();
      if (data.success) alert(data.message);
    } catch (err: any) {
      alert('Error resending invite: ' + err.message);
    }
  };

  const handleResetAttempt = async () => {
    if (!confirm('Are you sure you want to reset this attempt and allow the candidate to retake the test?')) return;
    try {
      const res = await fetch(`/api/candidates/${applicationId}/reset-attempt`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        alert(data.message);
        fetchData();
        triggerStatusChanged();
      }
    } catch (err: any) {
      alert('Error resetting assessment: ' + err.message);
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.comment.trim()) return;

    try {
      const res = await fetch(`/api/candidates/${applicationId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newNote),
      });
      const data = await res.json();
      if (data.success) {
        setNotes([data.note, ...notes]);
        setNewNote({ rating: 5, comment: '', authorName: '' });
      }
    } catch (err: any) {
      alert('Error adding note: ' + err.message);
    }
  };

  const handleScheduleInterviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`/api/candidates/${applicationId}/schedule-interview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(scheduleData),
      });
      const data = await res.json();
      if (data.success) {
        alert(data.message);
        setIsScheduleModalOpen(false);
        fetchData();
        triggerStatusChanged();
      }
    } catch (err: any) {
      alert('Error scheduling interview: ' + err.message);
    }
  };

  const copyCodeToClipboard = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedCodeIdx(idx);
    setTimeout(() => setCopiedCodeIdx(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-zinc-900/40 backdrop-blur-xs flex justify-end select-none">
      <div className="bg-white border-l border-zinc-200 w-full max-w-2xl h-full shadow-xl flex flex-col text-zinc-900">
        
        {/* Header Bar */}
        <div className="px-6 py-4 border-b border-zinc-200 flex items-center justify-between bg-zinc-50">
          <div>
            <div className="text-[11px] font-mono text-zinc-500 uppercase tracking-wider">
              Candidate Application Record &bull; #{applicationId.slice(-8)}
            </div>
            <h2 className="text-xl font-bold text-zinc-900 tracking-tight">
              {detail?.candidate?.name || 'Loading...'}
            </h2>
          </div>
          <button 
            onClick={onClose} 
            className="p-1.5 rounded hover:bg-zinc-200 text-zinc-500 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Candidate Summary Banner */}
        {detail && (
          <div className="p-6 border-b border-zinc-200 bg-white space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-zinc-900">{detail.job?.title}</div>
                <div className="text-xs text-zinc-500 font-mono">{detail.candidate?.email}</div>
              </div>
              <span className={`inline-block px-2.5 py-1 text-xs font-semibold rounded border ${
                detail.status === 'PASSED' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
                detail.status === 'HR_INTERVIEW' || detail.status === 'SHORTLISTED' ? 'bg-blue-50 text-blue-800 border-blue-200' :
                detail.status === 'FAILED' ? 'bg-red-50 text-red-700 border-red-200' :
                'bg-zinc-100 text-zinc-700 border-zinc-200'
              }`}>
                Stage: {detail.status.replace('_', ' ')}
              </span>
            </div>

            {/* Quick Action Controls */}
            {/* Status & Pipeline Decision Controls */}
            <div className="pt-2 border-t border-zinc-100 space-y-2">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="text-[10px] font-mono uppercase text-zinc-400 font-semibold mr-1">Decision:</span>
                
                {detail.status !== 'HR_INTERVIEW' && (
                  <button
                    onClick={() => handleUpdateStatus('HR_INTERVIEW')}
                    disabled={updatingStatus}
                    className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded font-medium transition flex items-center space-x-1"
                  >
                    <CheckCircle className="h-3 w-3" />
                    <span>Move to HR</span>
                  </button>
                )}

                {detail.status !== 'SHORTLISTED' && detail.status !== 'HR_INTERVIEW' && (
                  <button
                    onClick={() => handleUpdateStatus('SHORTLISTED')}
                    disabled={updatingStatus}
                    className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-300 rounded font-medium transition"
                  >
                    <span>Shortlist</span>
                  </button>
                )}

                {detail.status === 'MANUAL_REVIEW' && (
                  <button
                    onClick={() => handleUpdateStatus('PASSED')}
                    disabled={updatingStatus}
                    className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded font-medium transition flex items-center space-x-1"
                  >
                    <span>Approve (Clear Review)</span>
                  </button>
                )}

                {detail.status !== 'MANUAL_REVIEW' && detail.status !== 'REJECTED' && (
                  <button
                    onClick={() => handleUpdateStatus('MANUAL_REVIEW')}
                    disabled={updatingStatus}
                    className="px-2.5 py-1 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 border border-zinc-300 rounded font-medium transition"
                  >
                    <span>Flag Review</span>
                  </button>
                )}

                {detail.status !== 'REJECTED' && (
                  <button
                    onClick={() => {
                      if (confirm(`Are you sure you want to reject candidate ${detail.candidate.name}? A polite notification will be dispatched.`)) {
                        handleUpdateStatus('REJECTED');
                      }
                    }}
                    disabled={updatingStatus}
                    className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded font-medium transition flex items-center space-x-1"
                  >
                    <XCircle className="h-3 w-3" />
                    <span>Reject</span>
                  </button>
                )}
              </div>

              {/* Utility Tools */}
              <div className="flex flex-wrap gap-2 text-xs pt-1">
                <button
                  onClick={handleLaunchLiveRoom}
                  className="flex items-center space-x-1.5 bg-blue-600 hover:bg-blue-700 text-white font-medium px-2.5 py-1 rounded transition"
                >
                  <Video className="h-3.5 w-3.5" />
                  <span>Live Sandbox</span>
                </button>

                <button
                  onClick={handleIssueBadge}
                  className="flex items-center space-x-1.5 bg-zinc-900 hover:bg-zinc-800 text-white font-medium px-2.5 py-1 rounded transition"
                >
                  <Award className="h-3.5 w-3.5 text-amber-400" />
                  <span>Issue Badge</span>
                </button>

                <button
                  onClick={() => onOpenResume(detail.candidate.name, detail.candidate.email, detail.candidate.resumeFileName, detail.candidate.resumeUrl)}
                  className="flex items-center space-x-1.5 bg-white hover:bg-zinc-50 text-zinc-700 font-medium px-2.5 py-1 rounded border border-zinc-200 transition"
                >
                  <FileText className="h-3.5 w-3.5 text-zinc-500" />
                  <span>Resume</span>
                </button>

                <button
                  onClick={handleResetAttempt}
                  className="flex items-center space-x-1.5 bg-white hover:bg-zinc-50 text-zinc-700 font-medium px-2.5 py-1 rounded border border-zinc-200 transition"
                >
                  <RotateCcw className="h-3.5 w-3.5 text-zinc-500" />
                  <span>Allow Retake</span>
                </button>

                <button
                  onClick={handleResendInvite}
                  className="px-2.5 py-1 bg-white hover:bg-zinc-50 text-zinc-600 border border-zinc-200 rounded font-medium transition ml-auto"
                >
                  <span>Resend Test Link</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Navigation Tabs Bar */}
        <div className="flex items-center px-6 border-b border-zinc-200 bg-zinc-50 gap-6 text-xs font-semibold overflow-x-auto">
          {[
            { id: 'overview', label: 'Overview' },
            { id: 'ai-insights', label: 'AI Insights' },
            { id: 'proctoring', label: `Integrity (${detail?.assessmentSummary?.integrityScore || 100}%)` },
            { id: 'coding', label: `Code (${detail?.assessmentSummary?.codeSubmissions?.length || 0})` },
            { id: 'notes', label: `Team Notes (${notes.length})` },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`py-3 border-b-2 transition shrink-0 ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600 font-bold'
                  : 'border-transparent text-zinc-500 hover:text-zinc-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Drawer Body Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs">
          
          {loading || !detail ? (
            <div className="py-12 text-center text-zinc-500 font-mono">
              Loading record detail...
            </div>
          ) : (
            <>
              {/* TAB 1: OVERVIEW */}
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  
                  {/* Automated Candidate Screening Recommendation Verdict */}
                  {detail.resumeMatch && (
                    <div className={`p-4 rounded-lg border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      detail.resumeMatch.recommendation === 'STRONG_CANDIDATE'
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                        : detail.resumeMatch.recommendation === 'MANUAL_REVIEW'
                        ? 'bg-amber-50 border-amber-200 text-amber-950'
                        : detail.resumeMatch.recommendation === 'REJECT'
                        ? 'bg-red-50 border-red-200 text-red-950'
                        : 'bg-blue-50 border-blue-200 text-blue-950'
                    }`}>
                      <div className="space-y-1">
                        <div className="text-[10px] font-mono uppercase tracking-wider font-bold opacity-80">
                          Automated Candidate Screening Verdict
                        </div>
                        <div className="text-base font-bold flex items-center space-x-2">
                          <span>{detail.resumeMatch.recommendationLabel || detail.resumeMatch.recommendation.replace('_', ' ')}</span>
                          <span className="text-xs font-normal font-mono opacity-80">
                            &bull; Composite Ranking: {detail.resumeMatch.rankingScore} / 100
                          </span>
                        </div>
                      </div>
                      <div className="text-left sm:text-right text-[11px] font-mono opacity-90">
                        <div>Tech Score (60%): <span className="font-bold">{detail.assessmentSummary?.scorePercentage ?? 0}%</span></div>
                        <div>Resume Match (30%): <span className="font-bold">{detail.resumeMatch.matchScore}%</span></div>
                      </div>
                    </div>
                  )}

                  {/* 4-Card Scores Breakdown */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-zinc-50 p-4 rounded border border-zinc-200">
                    <div>
                      <div className="text-[10px] font-mono text-zinc-500 uppercase">Technical Score</div>
                      <div className="text-xl font-bold font-mono text-zinc-900 mt-1">
                        {detail.assessmentSummary?.scorePercentage ?? detail.assessmentSummary?.percentage ?? 0}%
                      </div>
                      <div className="text-[10px] text-zinc-500 font-mono">
                        {detail.assessmentSummary?.score ?? detail.assessmentSummary?.totalScore ?? 0} / {detail.assessmentSummary?.totalPossible ?? detail.assessmentSummary?.maxScore ?? 100} pts
                      </div>
                    </div>

                    <div>
                      <div className="text-[10px] font-mono text-zinc-500 uppercase">Resume Match</div>
                      <div className="text-xl font-bold font-mono text-blue-700 mt-1">
                        {detail.resumeMatch?.matchScore ?? 0}%
                      </div>
                      <div className="text-[10px] text-zinc-500">
                        {detail.resumeMatch?.matchedSkills?.length || 0} skills matched
                      </div>
                    </div>

                    <div>
                      <div className="text-[10px] font-mono text-zinc-500 uppercase">Proctoring Risk</div>
                      <div className={`text-xl font-bold font-mono mt-1 ${
                        detail.assessmentSummary?.riskLevel === 'HIGH' ? 'text-red-600' :
                        detail.assessmentSummary?.riskLevel === 'MEDIUM' ? 'text-amber-600' : 'text-emerald-700'
                      }`}>
                        {detail.assessmentSummary?.riskLevel || 'LOW'}
                      </div>
                      <div className="text-[10px] text-zinc-500 font-mono">
                        Risk: {detail.assessmentSummary?.proctoringRiskScore ?? (100 - (detail.assessmentSummary?.integrityScore ?? 100))}/100 pts
                      </div>
                    </div>

                    <div>
                      <div className="text-[10px] font-mono text-zinc-500 uppercase">Pass Threshold</div>
                      <div className="text-xl font-bold font-mono text-zinc-900 mt-1">
                        {detail.job?.passThreshold}%
                      </div>
                      <div className="text-[10px] text-zinc-500">
                        {(detail.assessmentSummary?.passed ?? detail.assessmentSummary?.isPassed) ? (
                          <span className="text-emerald-700 font-semibold">&ge; Passed</span>
                        ) : (
                          <span className="text-red-600 font-semibold">&lt; Failed</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Skills Match Overview */}
                  {detail.resumeMatch && (
                    <div className="p-4 bg-white border border-zinc-200 rounded space-y-3">
                      <div className="flex justify-between items-center text-xs font-mono font-semibold uppercase text-zinc-500">
                        <div className="flex items-center space-x-2">
                          <span>Skills Verification Match</span>
                          {detail.resumeMatch.experienceYears && (
                            <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded text-[10px]">
                              <Briefcase className="h-2.5 w-2.5" />
                              <span>~{detail.resumeMatch.experienceYears}y exp</span>
                            </span>
                          )}
                        </div>
                        <div className="flex items-center space-x-3">
                          <span>{detail.resumeMatch.matchScore}% Coverage</span>
                          {detail.candidate?.resumeUrl && (
                            <button
                              type="button"
                              disabled={reparsingResume}
                              onClick={handleReparseResume}
                              className="flex items-center space-x-1 text-[11px] font-sans font-medium text-blue-600 hover:text-blue-800 disabled:text-zinc-400 transition cursor-pointer"
                              title="Re-run deep PDF text extraction and skill analysis"
                            >
                              <RefreshCw className={`h-3 w-3 ${reparsingResume ? 'animate-spin' : ''}`} />
                              <span>{reparsingResume ? 'Parsing PDF...' : 'Re-Parse PDF'}</span>
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="space-y-2">
                        {detail.resumeMatch.matchedSkills?.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-[10px] text-emerald-800 font-mono font-bold mr-1">MATCHED:</span>
                            {detail.resumeMatch.matchedSkills.map((sk: string, i: number) => (
                              <span key={i} className="px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded font-mono text-[10px]">
                                &check; {sk}
                              </span>
                            ))}
                          </div>
                        )}
                        {detail.resumeMatch.missingSkills?.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-[10px] text-zinc-500 font-mono font-bold mr-1">GAP:</span>
                            {detail.resumeMatch.missingSkills.map((sk: string, i: number) => (
                              <span key={i} className="px-2 py-0.5 bg-zinc-100 text-zinc-600 border border-zinc-200 rounded font-mono text-[10px]">
                                {sk}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* All Extracted Skills from PDF */}
                        {detail.resumeMatch.candidateSkills?.length > 0 && (
                          <div className="pt-2 border-t border-zinc-100">
                            <button
                              type="button"
                              onClick={() => setShowAllExtractedSkills(!showAllExtractedSkills)}
                              className="text-[11px] text-blue-600 hover:text-blue-800 font-medium cursor-pointer flex items-center space-x-1"
                            >
                              <span>{showAllExtractedSkills ? '▲ Hide' : '▼ View'} all {detail.resumeMatch.candidateSkills.length} extracted tech skills from resume</span>
                            </button>
                            {showAllExtractedSkills && (
                              <div className="flex flex-wrap gap-1 mt-2 p-2.5 bg-zinc-50 rounded border border-zinc-200 text-[10px] font-mono text-zinc-700">
                                {detail.resumeMatch.candidateSkills.map((sk: string, i: number) => (
                                  <span key={i} className="px-1.5 py-0.5 bg-white border border-zinc-200 rounded">
                                    {sk}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Section Performance Table */}
                  {detail.assessmentSummary && (
                    <div className="space-y-2">
                      <h4 className="font-semibold text-zinc-900 text-xs uppercase font-mono text-zinc-500">
                        Section Breakdown
                      </h4>
                      <div className="border border-zinc-200 rounded divide-y divide-zinc-200 bg-white">
                        {(
                          detail.assessmentSummary.sectionResults ||
                          (detail.assessmentSummary.sectionScores
                            ? Object.entries(detail.assessmentSummary.sectionScores).map(([title, val]: [string, any]) => ({
                                title,
                                correct: val.score,
                                total: val.max,
                                percentage: Math.round(((val.score || 0) / (val.max || 1)) * 100),
                              }))
                            : [])
                        ).map((sec: any, idx: number) => {
                          const pct = sec.percentage !== undefined ? sec.percentage : Math.round(((sec.correct || 0) / (sec.total || 1)) * 100);
                          return (
                            <div key={idx} className="p-3 flex justify-between items-center">
                              <div>
                                <div className="font-semibold text-zinc-900">{sec.title}</div>
                                <div className="text-[10px] text-zinc-500">{sec.correct ?? sec.score} of {sec.total ?? sec.max} points</div>
                              </div>
                              <div className="font-mono font-bold text-zinc-900 text-sm">
                                {pct}%
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Stage Transition Actions */}
                  <div className="pt-4 border-t border-zinc-200 space-y-3">
                    <h4 className="font-mono text-[10px] text-zinc-500 uppercase font-semibold">
                      Recruiter Decision Actions
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => handleUpdateStatus('SHORTLISTED')}
                        disabled={updatingStatus}
                        className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded transition"
                      >
                        Shortlist Candidate
                      </button>

                      <button
                        onClick={() => setIsScheduleModalOpen(true)}
                        className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded transition"
                      >
                        Schedule HR Interview
                      </button>

                      <button
                        onClick={() => handleUpdateStatus('REJECTED')}
                        disabled={updatingStatus}
                        className="px-3.5 py-2 bg-zinc-100 hover:bg-red-50 text-red-700 font-medium rounded border border-zinc-200 transition"
                      >
                        Reject Application
                      </button>
                    </div>
                  </div>

                </div>
              )}

              {/* TAB 2: AI INSIGHTS */}
              {activeTab === 'ai-insights' && aiInsights && (
                <div className="space-y-4">
                  <div className="p-4 bg-zinc-50 rounded border border-zinc-200 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-zinc-900">Overall Hiring Recommendation</span>
                      <span className={`font-mono font-bold px-2 py-0.5 rounded text-[11px] ${
                        aiInsights.recommendation?.includes('PASS') ? 'bg-emerald-100 text-emerald-800' : 'bg-zinc-900 text-white'
                      }`}>
                        {aiInsights.recommendation}
                      </span>
                    </div>
                    <p className="text-zinc-700 leading-relaxed">{aiInsights.summaryText || aiInsights.summary}</p>
                  </div>

                  {((aiInsights.strengths && aiInsights.strengths.length > 0) || (aiInsights.skillStrengths && aiInsights.skillStrengths.length > 0)) && (
                    <div className="space-y-2">
                      <h5 className="font-mono text-[10px] text-zinc-500 uppercase font-semibold">Key Strengths</h5>
                      <div className="space-y-1.5">
                        {(aiInsights.strengths || aiInsights.skillStrengths || []).map((str: string, i: number) => (
                          <div key={i} className="p-2.5 bg-emerald-50 text-emerald-900 border border-emerald-200 rounded font-medium">
                            &bull; {str}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {aiInsights.weaknesses && aiInsights.weaknesses.length > 0 && (
                    <div className="space-y-2">
                      <h5 className="font-mono text-[10px] text-zinc-500 uppercase font-semibold">Areas for Improvement</h5>
                      <div className="space-y-1.5">
                        {aiInsights.weaknesses.map((w: string, i: number) => (
                          <div key={i} className="p-2.5 bg-amber-50 text-amber-900 border border-amber-200 rounded font-medium">
                            &bull; {w}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: PROCTORING INTEGRITY */}
              {activeTab === 'proctoring' && (() => {
                const logs = detail.proctorLogs || detail.assessmentSummary?.proctoringLogs || [];
                const snapshots: Array<{ url: string; time: string; reason: string }> = [];
                const violations: any[] = [];

                for (const l of logs) {
                  if (l.eventType === 'WEBCAM_SNAPSHOT' || (l.details && l.details.includes('snapshotUrl'))) {
                    try {
                      const parsed = JSON.parse(l.details);
                      if (parsed.snapshotUrl) {
                        snapshots.push({
                          url: parsed.snapshotUrl,
                          time: new Date(l.timestamp).toLocaleTimeString(),
                          reason: parsed.reason || 'Periodic proctoring verification',
                        });
                      }
                    } catch {
                      if (l.details && l.details.startsWith('/uploads/')) {
                        snapshots.push({
                          url: l.details,
                          time: new Date(l.timestamp).toLocaleTimeString(),
                          reason: 'Webcam snapshot',
                        });
                      }
                    }
                  } else {
                    violations.push(l);
                  }
                }

                return (
                  <div className="space-y-5 font-sans">
                    {/* Visual Webcam Snapshots Photo Strip */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs font-semibold text-zinc-900">
                          <Camera className="w-4 h-4 text-blue-600" />
                          <span>Candidate Webcam Verification Timeline ({snapshots.length} frames)</span>
                        </div>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Automated Periodic Capture
                        </span>
                      </div>

                      {snapshots.length === 0 ? (
                        <div className="p-6 bg-zinc-50 border border-dashed border-zinc-200 rounded text-center text-xs text-zinc-500 font-mono">
                          <Camera className="w-6 h-6 mx-auto mb-2 text-zinc-400 opacity-60" />
                          No webcam snapshots captured during this session.
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                          {snapshots.map((snap, idx) => (
                            <div
                              key={idx}
                              onClick={() => setSelectedSnapshot(snap.url)}
                              className="group relative rounded border border-zinc-200 overflow-hidden bg-zinc-100 cursor-pointer shadow-xs hover:border-blue-400 transition"
                            >
                              <img
                                src={snap.url}
                                alt={`Snapshot ${idx + 1}`}
                                className="w-full h-24 object-cover group-hover:scale-105 transition duration-300"
                              />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-[11px] font-medium gap-1">
                                <Eye className="w-3.5 h-3.5" />
                                <span>Inspect</span>
                              </div>
                              <div className="absolute bottom-0 inset-x-0 bg-zinc-950/75 backdrop-blur-xs px-1.5 py-0.5 text-[9px] font-mono text-zinc-200 flex justify-between">
                                <span>Frame #{idx + 1}</span>
                                <span>{snap.time}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Full Size Snapshot Modal */}
                    {selectedSnapshot && (
                      <div
                        className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4"
                        onClick={() => setSelectedSnapshot(null)}
                      >
                        <div className="relative max-w-xl w-full bg-zinc-900 rounded-lg overflow-hidden border border-zinc-700 p-2" onClick={e => e.stopPropagation()}>
                          <div className="flex justify-between items-center px-2 py-1 text-white text-xs mb-2 font-mono">
                            <span>Webcam Proctoring Frame Preview</span>
                            <button
                              onClick={() => setSelectedSnapshot(null)}
                              className="p-1 text-zinc-400 hover:text-white rounded"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                          <img
                            src={selectedSnapshot}
                            alt="Proctoring Full Frame"
                            className="w-full rounded border border-zinc-800 object-contain max-h-[70vh]"
                          />
                        </div>
                      </div>
                    )}

                    {/* Integrity Violations Table */}
                    <div className="space-y-2 pt-2 border-t border-zinc-200">
                      <div className="flex items-center justify-between text-xs font-semibold text-zinc-900">
                        <div className="flex items-center gap-1.5">
                          <ShieldAlert className="w-4 h-4 text-rose-600" />
                          <span>Proctoring Audit Log ({violations.length} events)</span>
                        </div>
                        <span className="text-[11px] font-mono text-zinc-500">
                          Risk Penalty: {detail.assessmentSummary?.proctoringRiskScore || 0}/100 pts
                        </span>
                      </div>

                      <div className="space-y-1.5 font-mono text-xs">
                        {violations.length === 0 ? (
                          <div className="p-4 bg-emerald-50/50 border border-emerald-200 rounded text-center text-emerald-800 text-[11px]">
                            ✅ Zero suspicious behavior detected. Clean assessment session.
                          </div>
                        ) : (
                          violations.map((log: any, i: number) => {
                            const isSevere = log.eventType === 'FULLSCREEN_EXIT' || log.eventType === 'SCREEN_SHARE_STOPPED';
                            return (
                              <div
                                key={log.id || i}
                                className={`p-2.5 rounded border flex justify-between items-center text-[11px] ${
                                  isSevere
                                    ? 'bg-rose-50/60 border-rose-200 text-rose-900'
                                    : 'bg-amber-50/50 border-amber-200 text-amber-900'
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <span className="font-bold">[{log.eventType}]</span>
                                  <span className="text-zinc-700">{log.details || 'Integrity event logged'}</span>
                                </div>
                                <span className="text-zinc-500 shrink-0 ml-2">
                                  {new Date(log.timestamp).toLocaleTimeString()}
                                </span>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* TAB 4: CODING SUBMISSIONS */}
              {activeTab === 'coding' && (
                <div className="space-y-4 font-mono">
                  {(!detail.assessmentSummary?.codeSubmissions || detail.assessmentSummary.codeSubmissions.length === 0) ? (
                    <div className="p-4 text-center text-zinc-400">No coding challenge submissions recorded.</div>
                  ) : (
                    detail.assessmentSummary.codeSubmissions.map((sub: any, idx: number) => {
                      const codeText = sub.codeAnswer || sub.code || '';
                      return (
                        <div key={idx} className="border border-zinc-200 rounded overflow-hidden">
                          <div className="bg-zinc-100 p-2.5 flex justify-between items-center text-[11px] font-bold text-zinc-800">
                            <span>{sub.sectionTitle || 'Practical Scripting'} - Solution #{idx + 1}</span>
                            <button
                              onClick={() => copyCodeToClipboard(codeText, idx)}
                              className="text-blue-600 hover:underline text-[10px]"
                            >
                              {copiedCodeIdx === idx ? 'Copied!' : 'Copy Code'}
                            </button>
                          </div>
                          {sub.questionPrompt && (
                            <div className="p-2.5 bg-zinc-50 border-b border-zinc-200 text-[11px] text-zinc-700 font-sans">
                              {sub.questionPrompt}
                            </div>
                          )}
                          <pre className="p-3 bg-zinc-900 text-emerald-400 text-xs overflow-x-auto">
                            {codeText || '// Empty submission'}
                          </pre>
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {/* TAB 5: TEAM NOTES */}
              {activeTab === 'notes' && (
                <div className="space-y-4">
                  <form onSubmit={handleAddNote} className="space-y-3 p-4 bg-zinc-50 rounded border border-zinc-200">
                    <div className="font-semibold text-zinc-900">Add Team Recruiter Note</div>
                    <textarea
                      rows={3}
                      required
                      placeholder="Add candidate interview feedback or assessment notes..."
                      value={newNote.comment}
                      onChange={(e) => setNewNote({ ...newNote, comment: e.target.value })}
                      className="w-full p-2.5 bg-white border border-zinc-200 rounded text-xs focus:border-zinc-400"
                    />
                    <div className="flex justify-between items-center">
                      <input
                        type="text"
                        placeholder="Your name (e.g. Lead HR)"
                        value={newNote.authorName}
                        onChange={(e) => setNewNote({ ...newNote, authorName: e.target.value })}
                        className="bg-white border border-zinc-200 rounded px-2.5 py-1 text-xs"
                      />
                      <button type="submit" className="px-3 py-1.5 bg-zinc-900 text-white rounded font-medium">
                        Post Note
                      </button>
                    </div>
                  </form>

                  <div className="space-y-2">
                    {notes.map((note) => (
                      <div key={note.id} className="p-3 border border-zinc-200 rounded space-y-1">
                        <div className="flex justify-between text-[11px] font-mono text-zinc-500">
                          <span className="font-semibold text-zinc-900">{note.authorName || 'Recruiter'}</span>
                          <span>{new Date(note.createdAt).toLocaleDateString()}</span>
                        </div>
                        <p className="text-zinc-700">{note.comment}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

        </div>

      </div>

      {/* Schedule HR Interview Modal */}
      {isScheduleModalOpen && (
        <div className="fixed inset-0 z-50 bg-zinc-900/50 flex items-center justify-center p-4">
          <div className="bg-white border border-zinc-200 rounded-lg p-6 max-w-md w-full space-y-4 select-none">
            <h3 className="text-base font-bold text-zinc-900">Schedule HR Interview</h3>
            <form onSubmit={handleScheduleInterviewSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-zinc-700 font-semibold mb-1">Interview Date & Time</label>
                <input
                  type="datetime-local"
                  required
                  value={scheduleData.interviewScheduledAt}
                  onChange={(e) => setScheduleData({ ...scheduleData, interviewScheduledAt: e.target.value })}
                  className="w-full bg-white border border-zinc-200 rounded p-2 text-zinc-900"
                />
              </div>

              <div>
                <label className="block text-zinc-700 font-semibold mb-1">Meeting Room Link</label>
                <input
                  type="url"
                  required
                  value={scheduleData.interviewLink}
                  onChange={(e) => setScheduleData({ ...scheduleData, interviewLink: e.target.value })}
                  className="w-full bg-white border border-zinc-200 rounded p-2 text-zinc-900 font-mono"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsScheduleModalOpen(false)}
                  className="px-3 py-1.5 bg-zinc-100 text-zinc-700 rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-blue-600 text-white rounded font-medium"
                >
                  Confirm & Notify Candidate
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
