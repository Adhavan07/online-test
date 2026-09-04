import React, { useEffect, useState } from 'react';
import { 
  Play, RotateCcw, CheckCircle2, AlertTriangle, Video, Mic, 
  MessageSquare, Star, Save, ShieldCheck, Terminal, Award, User, RefreshCw, Send
} from 'lucide-react';

export const LiveInterviewRoom: React.FC = () => {
  // Extract roomToken from pathname /interview/:roomToken
  const roomToken = window.location.pathname.split('/interview/')[1] || '';

  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Local state for live code & notes
  const [code, setCode] = useState<string>('');
  const [sharedNotes, setSharedNotes] = useState<string>('');
  const [interviewerRating, setInterviewerRating] = useState<number>(5);
  const [feedbackSummary, setFeedbackSummary] = useState<string>('');

  // Code runner state
  const [isRunning, setIsRunning] = useState(false);
  const [runOutput, setRunOutput] = useState<{ success: boolean; logs: string[]; executionTimeMs: number } | null>(null);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  const fetchSession = async () => {
    try {
      const res = await fetch(`/api/interviews/${roomToken}`);
      const data = await res.json();
      if (data.success) {
        setSession(data.session);
        setCode(data.session.codeBuffer || '');
        setSharedNotes(data.session.sharedNotes || '');
        setInterviewerRating(data.session.interviewerRating || 5);
        setFeedbackSummary(data.session.feedbackSummary || '');
      } else {
        setError(data.error || 'Failed to load interview session');
      }
    } catch (err: any) {
      setError(err.message || 'Error connecting to interview server');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSession();
  }, [roomToken]);

  const handleSyncState = async (statusOverride?: string) => {
    setSaveStatus('Saving changes...');
    try {
      const res = await fetch(`/api/interviews/${roomToken}/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          codeBuffer: code,
          sharedNotes,
          interviewerRating,
          feedbackSummary,
          ...(statusOverride && { status: statusOverride }),
        })
      });
      const data = await res.json();
      if (data.success) {
        setSaveStatus('Synced to room');
        setTimeout(() => setSaveStatus(null), 2000);
      }
    } catch (err) {
      setSaveStatus('Error saving');
    }
  };

  const handleRunCode = async () => {
    setIsRunning(true);
    setRunOutput(null);
    try {
      const res = await fetch('/api/assessment/run-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          testCases: [
            { input: 'solve()', expectedOutput: 'true', description: 'Execution check' }
          ]
        })
      });
      const data = await res.json();
      if (data.success) {
        setRunOutput({
          success: data.passedCount === data.totalCount,
          logs: data.logs || ['Execution output: Success!'],
          executionTimeMs: data.executionTimeMs || 12,
        });
      } else {
        setRunOutput({
          success: false,
          logs: [data.error || 'Execution Error'],
          executionTimeMs: 0,
        });
      }
    } catch (err: any) {
      setRunOutput({
        success: false,
        logs: [`Runtime Exception: ${err.message}`],
        executionTimeMs: 0,
      });
    } finally {
      setIsRunning(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-300">
        <div className="text-center space-y-3">
          <RefreshCw className="h-8 w-8 text-blue-500 animate-spin mx-auto" />
          <p className="font-semibold text-sm">Initializing Live Interview Sandbox...</p>
        </div>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-slate-300">
        <div className="max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center space-y-4 shadow-2xl">
          <AlertTriangle className="h-10 w-10 text-red-500 mx-auto" />
          <h2 className="text-lg font-bold text-white">Interview Room Access Error</h2>
          <p className="text-xs text-slate-400">{error || 'Invalid or expired room token.'}</p>
          <a href="/" className="inline-block px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl">Return to Dashboard</a>
        </div>
      </div>
    );
  }

  const { application } = session;
  const candidateName = application?.candidate?.name || 'Candidate';
  const jobTitle = application?.job?.title || 'Technical Role';
  const latestResult = application?.attempts?.[0]?.result;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      
      {/* Live Room Top Bar */}
      <div className="bg-slate-900 border-b border-slate-800 px-6 py-3 flex flex-wrap items-center justify-between gap-4">
        
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-blue-600/20 text-blue-400 rounded-xl border border-blue-500/30">
            <Video className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="font-extrabold text-white text-base tracking-tight">Live Interview Sandbox</h1>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 animate-pulse">
                ● LIVE PAIR-CODING
              </span>
            </div>
            <p className="text-xs text-slate-400">{candidateName} • {jobTitle} ({roomToken})</p>
          </div>
        </div>

        {/* Audio / Video controls simulation & Sync status */}
        <div className="flex items-center space-x-3">
          {saveStatus && (
            <span className="text-xs text-blue-400 font-mono italic">{saveStatus}</span>
          )}

          <button
            onClick={() => handleSyncState()}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition"
          >
            <Save className="h-3.5 w-3.5 text-blue-400" />
            <span>Save Sync</span>
          </button>

          <button
            onClick={() => handleSyncState('COMPLETED')}
            className="flex items-center space-x-1.5 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition shadow-lg shadow-emerald-600/20"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>Complete Round</span>
          </button>
        </div>

      </div>

      {/* Main Pair-Coding Interface (Split Grid) */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-0 overflow-hidden">
        
        {/* Left Column (4 Cols): Candidate Stats, Shared Notes & Recruiter Rating */}
        <div className="lg:col-span-4 bg-slate-900/60 border-r border-slate-800 p-5 space-y-5 overflow-y-auto flex flex-col justify-between">
          
          <div className="space-y-5">
            {/* Candidate Card */}
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-bold text-white text-sm">{candidateName}</h3>
                  <p className="text-xs text-slate-400">{application?.candidate?.email}</p>
                </div>
                <span className="text-[10px] bg-purple-500/10 text-purple-400 font-bold px-2 py-0.5 rounded border border-purple-500/20">
                  {latestResult ? `Passed (${Math.round(latestResult.percentage)}%)` : 'HR Stage'}
                </span>
              </div>

              {latestResult && (
                <div className="mt-2 text-xs text-slate-400 border-t border-slate-800/80 pt-2 flex justify-between">
                  <span>Proctoring Trust Rating:</span>
                  <strong className="text-emerald-400 font-mono">{latestResult.integrityScore}%</strong>
                </div>
              )}
            </div>

            {/* Shared Notes & Technical Scratchpad */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-white flex items-center space-x-1.5">
                <MessageSquare className="h-3.5 w-3.5 text-blue-400" />
                <span>Shared Interview Scratchpad & Discussion Notes</span>
              </label>
              <textarea
                value={sharedNotes}
                onChange={(e) => setSharedNotes(e.target.value)}
                placeholder="Type real-time interview notes, architecture questions, or discussion points here..."
                rows={7}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono leading-relaxed"
              />
            </div>

            {/* Interviewer Rating */}
            <div className="space-y-2 bg-slate-950 p-4 rounded-xl border border-slate-800">
              <label className="text-xs font-bold text-white block">Interviewer Private Score Rating</label>
              <div className="flex items-center space-x-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setInterviewerRating(star)}
                    className={`p-1.5 rounded-lg transition ${
                      interviewerRating >= star ? 'text-amber-400 bg-amber-400/10' : 'text-slate-600 hover:text-slate-400'
                    }`}
                  >
                    <Star className="h-5 w-5 fill-current" />
                  </button>
                ))}
                <span className="text-xs font-bold text-amber-400 ml-2 font-mono">{interviewerRating} / 5 Stars</span>
              </div>

              <input
                type="text"
                value={feedbackSummary}
                onChange={(e) => setFeedbackSummary(e.target.value)}
                placeholder="Final summary e.g. Strong problem solving, hire recommendation"
                className="mt-2 w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="text-[11px] text-slate-500 text-center italic border-t border-slate-800/60 pt-3">
            Changes auto-sync to both interviewer & candidate views upon save.
          </div>

        </div>

        {/* Right Column (8 Cols): Live Shared Code Editor & Test Console */}
        <div className="lg:col-span-8 bg-slate-950 flex flex-col justify-between overflow-hidden border-l border-slate-800/60">
          
          {/* Code Editor Header */}
          <div className="bg-slate-900/80 px-4 py-2.5 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center space-x-2 text-xs font-mono font-semibold text-slate-300">
              <Terminal className="h-4 w-4 text-cyan-400" />
              <span>solution.js</span>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => setCode(`// Reset boilerplate\nfunction solution() {\n  return true;\n}`)}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
                title="Reset Code Boilerplate"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>

              <button
                onClick={handleRunCode}
                disabled={isRunning}
                className="flex items-center space-x-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg transition shadow-md shadow-blue-600/20 disabled:opacity-50"
              >
                <Play className="h-3.5 w-3.5 fill-current" />
                <span>{isRunning ? 'Executing...' : 'Run Code'}</span>
              </button>
            </div>
          </div>

          {/* Live Shared Code Editor Workspace */}
          <div className="flex-1 p-4 overflow-auto font-mono text-xs bg-slate-950 leading-relaxed">
            <textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-full h-full min-h-[350px] bg-transparent text-emerald-300 focus:outline-none resize-none font-mono tracking-wide"
              spellCheck={false}
            />
          </div>

          {/* Execution Output Panel */}
          {runOutput && (
            <div className="border-t border-slate-800 bg-slate-900 p-4 space-y-2 max-h-[160px] overflow-y-auto">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="flex items-center space-x-1.5 text-slate-300">
                  <Terminal className="h-3.5 w-3.5 text-cyan-400" />
                  <span>Execution Output Console</span>
                </span>
                <span className={`text-[10px] px-2 py-0.5 rounded font-mono ${
                  runOutput.success ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'
                }`}>
                  {runOutput.success ? 'PASSED' : 'EXECUTION FAILED'} ({runOutput.executionTimeMs}ms)
                </span>
              </div>

              <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 font-mono text-[11px] text-slate-300 space-y-1">
                {runOutput.logs.map((log, idx) => (
                  <div key={idx}>{log}</div>
                ))}
              </div>
            </div>
          )}

        </div>

      </div>

    </div>
  );
};
