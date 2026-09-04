import React, { useEffect, useState } from 'react';
import { 
  X, FileText, CheckCircle, XCircle, Clock, Send, Award, Calendar, 
  ChevronRight, ShieldAlert, ShieldCheck, Code2, Copy, Check, Sparkles, 
  MessageSquare, Star, RotateCcw, Video, ExternalLink
} from 'lucide-react';

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
  const [aiInsights, setAiInsights] = useState<any>(null);
  const [notes, setNotes] = useState<any[]>([]);
  const [newNote, setNewNote] = useState({ rating: 5, comment: '', authorName: '' });
  const [loading, setLoading] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'ai-insights' | 'proctoring' | 'coding' | 'notes'>('overview');
  const [copiedCodeIdx, setCopiedCodeIdx] = useState<number | null>(null);

  // HR Interview Modal State
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
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
        onStatusChanged();
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
        onStatusChanged();
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
        onStatusChanged();
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
            <div className="flex flex-wrap gap-2 pt-2 border-t border-zinc-100 text-xs">
              <button
                onClick={handleLaunchLiveRoom}
                className="flex items-center space-x-1.5 bg-blue-600 hover:bg-blue-700 text-white font-medium px-3 py-1.5 rounded transition"
              >
                <Video className="h-3.5 w-3.5" />
                <span>Live Sandbox</span>
              </button>

              <button
                onClick={handleIssueBadge}
                className="flex items-center space-x-1.5 bg-zinc-900 hover:bg-zinc-800 text-white font-medium px-3 py-1.5 rounded transition"
              >
                <Award className="h-3.5 w-3.5 text-amber-400" />
                <span>Issue Badge</span>
              </button>

              <button
                onClick={() => onOpenResume(detail.candidate.name, detail.candidate.email, detail.candidate.resumeFileName, detail.candidate.resumeUrl)}
                className="flex items-center space-x-1.5 bg-white hover:bg-zinc-50 text-zinc-700 font-medium px-3 py-1.5 rounded border border-zinc-200 transition"
              >
                <FileText className="h-3.5 w-3.5 text-zinc-500" />
                <span>Resume</span>
              </button>

              <button
                onClick={handleResetAttempt}
                className="flex items-center space-x-1.5 bg-white hover:bg-zinc-50 text-zinc-700 font-medium px-3 py-1.5 rounded border border-zinc-200 transition"
              >
                <RotateCcw className="h-3.5 w-3.5 text-zinc-500" />
                <span>Allow Retake</span>
              </button>
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
                  
                  {/* Scores Breakdown */}
                  {detail.assessmentSummary && (
                    <div className="grid grid-cols-3 gap-3 bg-zinc-50 p-4 rounded border border-zinc-200">
                      <div>
                        <div className="text-[10px] font-mono text-zinc-500 uppercase">Technical Score</div>
                        <div className="text-xl font-bold font-mono text-zinc-900 mt-1">
                          {detail.assessmentSummary.scorePercentage}%
                        </div>
                        <div className="text-[10px] text-zinc-500 font-mono">
                          {detail.assessmentSummary.score} / {detail.assessmentSummary.totalPossible} pts
                        </div>
                      </div>

                      <div>
                        <div className="text-[10px] font-mono text-zinc-500 uppercase">Pass Threshold</div>
                        <div className="text-xl font-bold font-mono text-zinc-900 mt-1">
                          {detail.job?.passThreshold}%
                        </div>
                        <div className="text-[10px] text-zinc-500">
                          {detail.assessmentSummary.passed ? (
                            <span className="text-emerald-700 font-semibold">&ge; Threshold Passed</span>
                          ) : (
                            <span className="text-red-600 font-semibold">&lt; Threshold Failed</span>
                          )}
                        </div>
                      </div>

                      <div>
                        <div className="text-[10px] font-mono text-zinc-500 uppercase">Integrity Score</div>
                        <div className="text-xl font-bold font-mono text-emerald-700 mt-1">
                          {detail.assessmentSummary.integrityScore}%
                        </div>
                        <div className="text-[10px] text-zinc-500 font-mono">
                          Risk Level: {detail.assessmentSummary.riskLevel}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Section Performance Table */}
                  {detail.assessmentSummary?.sectionResults && (
                    <div className="space-y-2">
                      <h4 className="font-semibold text-zinc-900 text-xs uppercase font-mono text-zinc-500">
                        Section Breakdown
                      </h4>
                      <div className="border border-zinc-200 rounded divide-y divide-zinc-200 bg-white">
                        {detail.assessmentSummary.sectionResults.map((sec: any) => (
                          <div key={sec.sectionId} className="p-3 flex justify-between items-center">
                            <div>
                              <div className="font-semibold text-zinc-900">{sec.title}</div>
                              <div className="text-[10px] text-zinc-500">{sec.correct} of {sec.total} correct</div>
                            </div>
                            <div className="font-mono font-bold text-zinc-900 text-sm">
                              {Math.round((sec.correct / (sec.total || 1)) * 100)}%
                            </div>
                          </div>
                        ))}
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
                      <span className="font-mono font-bold px-2 py-0.5 rounded bg-zinc-900 text-white text-[11px]">
                        {aiInsights.recommendation}
                      </span>
                    </div>
                    <p className="text-zinc-700 leading-relaxed">{aiInsights.summary}</p>
                  </div>

                  <div className="space-y-2">
                    <h5 className="font-mono text-[10px] text-zinc-500 uppercase font-semibold">Key Strengths</h5>
                    <div className="space-y-1.5">
                      {aiInsights.skillStrengths?.map((str: string, i: number) => (
                        <div key={i} className="p-2.5 bg-emerald-50 text-emerald-900 border border-emerald-200 rounded font-medium">
                          &bull; {str}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: PROCTORING INTEGRITY */}
              {activeTab === 'proctoring' && (
                <div className="space-y-4">
                  <div className="p-3 bg-zinc-50 rounded border border-zinc-200 font-mono text-zinc-700">
                    Proctoring Audit Log ({detail.proctorLogs?.length || 0} events captured)
                  </div>

                  <div className="space-y-2 font-mono">
                    {detail.proctorLogs?.length === 0 ? (
                      <div className="p-4 text-center text-zinc-400">No suspicious proctoring events recorded.</div>
                    ) : (
                      detail.proctorLogs?.map((log: any) => (
                        <div key={log.id} className="p-3 border border-zinc-200 rounded flex justify-between items-center text-[11px]">
                          <div>
                            <span className="font-bold text-zinc-900 mr-2">[{log.eventType}]</span>
                            <span className="text-zinc-600">{log.details || 'Event logged'}</span>
                          </div>
                          <span className="text-zinc-400">{new Date(log.timestamp).toLocaleTimeString()}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* TAB 4: CODING SUBMISSIONS */}
              {activeTab === 'coding' && (
                <div className="space-y-4 font-mono">
                  {detail.assessmentSummary?.codeSubmissions?.length === 0 ? (
                    <div className="p-4 text-center text-zinc-400">No coding challenge submissions recorded.</div>
                  ) : (
                    detail.assessmentSummary?.codeSubmissions?.map((sub: any, idx: number) => (
                      <div key={idx} className="border border-zinc-200 rounded overflow-hidden">
                        <div className="bg-zinc-100 p-2.5 flex justify-between items-center text-[11px] font-bold text-zinc-800">
                          <span>Challenge Solution #{idx + 1}</span>
                          <button
                            onClick={() => copyCodeToClipboard(sub.code, idx)}
                            className="text-blue-600 hover:underline text-[10px]"
                          >
                            {copiedCodeIdx === idx ? 'Copied!' : 'Copy Code'}
                          </button>
                        </div>
                        <pre className="p-3 bg-zinc-900 text-emerald-400 text-xs overflow-x-auto">
                          {sub.code}
                        </pre>
                      </div>
                    ))
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
