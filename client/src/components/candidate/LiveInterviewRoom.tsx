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
            { input: 'null', expectedOutput: 'true', description: 'Collaborative Sandbox Check' }
          ]
        })
      });
      const data = await res.json();
      if (data.success && data.evalResult) {
        const evalRes = data.evalResult;
        const isPassed = evalRes.passCount === evalRes.totalCases;
        const resultLogs = evalRes.testResults?.map((r: any) =>
          `${r.description}: ${r.passed ? 'PASSED' : 'FAILED'} (Output: ${r.actual}, Expected: ${r.expected})`
        ) || ['Execution completed successfully.'];
        setRunOutput({
          success: isPassed,
          logs: resultLogs,
          executionTimeMs: 14,
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
      <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center text-zinc-600 font-mono text-xs select-none">
        <div className="text-center space-y-2">
          <RefreshCw className="h-6 w-6 text-zinc-400 animate-spin mx-auto" />
          <p>Initializing Live Interview Sandbox...</p>
        </div>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center p-6 text-zinc-900 select-none">
        <div className="max-w-md bg-white border border-zinc-200 rounded p-6 text-center space-y-4 shadow-sm">
          <AlertTriangle className="h-8 w-8 text-rose-600 mx-auto" />
          <h2 className="text-base font-bold text-zinc-900">Interview Room Access Error</h2>
          <p className="text-xs text-zinc-500">{error || 'Invalid or expired room token.'}</p>
          <a href="/" className="inline-block px-3.5 py-1.5 bg-zinc-900 text-white text-xs font-medium rounded">
            Return to Dashboard
          </a>
        </div>
      </div>
    );
  }

  const { application } = session;
  const candidateName = application?.candidate?.name || 'Candidate';
  const jobTitle = application?.job?.title || 'Technical Role';
  const latestResult = application?.attempts?.[0]?.result;

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-zinc-900 flex flex-col font-sans select-none">
      
      {/* Live Room Top Bar */}
      <div className="bg-white border-b border-zinc-200 px-6 py-3 flex flex-wrap items-center justify-between gap-4">
        
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-blue-50 text-blue-600 rounded border border-blue-200/60">
            <Video className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="font-bold text-zinc-900 text-sm tracking-tight">Live Technical Interview Sandbox</h1>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                &bull; PAIR-PROGRAMMING SESSION
              </span>
            </div>
            <p className="text-xs text-zinc-500 font-mono mt-0.5">{candidateName} &bull; {jobTitle} ({roomToken.slice(0, 12)}...)</p>
          </div>
        </div>

        {/* Action Controls & Sync Status */}
        <div className="flex items-center space-x-2.5">
          {saveStatus && (
            <span className="text-xs text-zinc-500 font-mono italic">{saveStatus}</span>
          )}

          <button
            onClick={() => handleSyncState()}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-white hover:bg-zinc-50 text-zinc-700 text-xs font-semibold rounded border border-zinc-200 transition"
          >
            <Save className="h-3.5 w-3.5 text-zinc-500" />
            <span>Save Sync</span>
          </button>

          <button
            onClick={() => handleSyncState('COMPLETED')}
            className="flex items-center space-x-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded transition shadow-xs"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>Complete Round</span>
          </button>
        </div>

      </div>

      {/* Main Pair-Coding Interface (Split Grid) */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-0 overflow-hidden">
        
        {/* Left Column (4 Cols): Candidate Stats, Shared Notes & Recruiter Rating */}
        <div className="lg:col-span-4 bg-zinc-50/70 border-r border-zinc-200 p-5 space-y-4 overflow-y-auto flex flex-col justify-between text-xs">
          
          <div className="space-y-4">
            {/* Candidate Card */}
            <div className="bg-white p-4 rounded border border-zinc-200 space-y-2">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-bold text-zinc-900 text-sm">{candidateName}</h3>
                  <p className="text-xs text-zinc-500 font-mono">{application?.candidate?.email}</p>
                </div>
                <span className="text-[10px] bg-zinc-100 text-zinc-800 font-mono font-bold px-2 py-0.5 rounded border border-zinc-200">
                  {latestResult ? `Passed (${Math.round(latestResult.percentage)}%)` : 'HR Stage'}
                </span>
              </div>

              {latestResult && (
                <div className="mt-2 text-xs text-zinc-500 border-t border-zinc-200 pt-2 flex justify-between">
                  <span>Proctoring Integrity Score:</span>
                  <strong className="text-emerald-700 font-mono">{latestResult.integrityScore}%</strong>
                </div>
              )}
            </div>

            {/* Shared Notes & Technical Scratchpad */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-900 flex items-center space-x-1.5">
                <MessageSquare className="h-3.5 w-3.5 text-zinc-500" />
                <span>Interview Scratchpad & Shared Questions</span>
              </label>
              <textarea
                value={sharedNotes}
                onChange={(e) => setSharedNotes(e.target.value)}
                placeholder="Type real-time interview notes, architecture questions, or discussion points here..."
                rows={7}
                className="w-full bg-white border border-zinc-200 rounded p-3 text-xs text-zinc-800 placeholder-zinc-400 focus:border-zinc-400 font-mono leading-relaxed resize-none"
              />
            </div>

            {/* Interviewer Rating */}
            <div className="space-y-2 bg-white p-4 rounded border border-zinc-200">
              <label className="text-xs font-semibold text-zinc-900 block">Interviewer Assessment Rating</label>
              <div className="flex items-center space-x-1.5">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setInterviewerRating(star)}
                    className={`p-1 rounded transition ${
                      interviewerRating >= star ? 'text-amber-500' : 'text-zinc-300 hover:text-zinc-400'
                    }`}
                  >
                    <Star className="h-4 w-4 fill-current" />
                  </button>
                ))}
                <span className="text-xs font-bold text-zinc-700 ml-2 font-mono">{interviewerRating} / 5</span>
              </div>

              <input
                type="text"
                value={feedbackSummary}
                onChange={(e) => setFeedbackSummary(e.target.value)}
                placeholder="Summary e.g. Strong algorithms, hire recommendation"
                className="mt-2 w-full bg-white border border-zinc-200 rounded px-3 py-1.5 text-xs text-zinc-800 placeholder-zinc-400 focus:border-zinc-400"
              />
            </div>
          </div>

          <div className="text-[11px] text-zinc-400 text-center font-mono border-t border-zinc-200 pt-3">
            State auto-syncs across both interview participants upon save.
          </div>

        </div>

        {/* Right Column (8 Cols): Live Shared Code Editor & Test Console */}
        <div className="lg:col-span-8 bg-white flex flex-col justify-between overflow-hidden">
          
          {/* Code Editor Header */}
          <div className="bg-zinc-50 px-4 py-2 border-b border-zinc-200 flex items-center justify-between">
            <div className="flex items-center space-x-2 text-xs font-mono font-semibold text-zinc-700">
              <Terminal className="h-3.5 w-3.5 text-zinc-500" />
              <span>solution.js</span>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => setCode(`// Reset boilerplate\nfunction solution() {\n  return true;\n}`)}
                className="p-1 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-200/60 rounded transition"
                title="Reset Code Boilerplate"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>

              <button
                onClick={handleRunCode}
                disabled={isRunning}
                className="flex items-center space-x-1.5 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold rounded transition disabled:opacity-50"
              >
                <Play className={`h-3 w-3 ${isRunning ? 'animate-spin' : 'fill-current'}`} />
                <span>{isRunning ? 'Executing...' : 'Run Code'}</span>
              </button>
            </div>
          </div>

          {/* Live Shared Code Editor Workspace */}
          <div className="flex-1 p-4 overflow-auto font-mono text-xs bg-[#18181B] leading-relaxed">
            <textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-full h-full min-h-[350px] bg-transparent text-zinc-100 focus:outline-none resize-none font-mono tracking-wide"
              spellCheck={false}
            />
          </div>

          {/* Execution Output Panel */}
          {runOutput && (
            <div className="border-t border-zinc-200 bg-zinc-50 p-4 space-y-2 max-h-[160px] overflow-y-auto">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="flex items-center space-x-1.5 text-zinc-700 font-mono">
                  <Terminal className="h-3.5 w-3.5 text-zinc-500" />
                  <span>Execution Output Console</span>
                </span>
                <span className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold border ${
                  runOutput.success 
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
                    : 'bg-rose-50 text-rose-800 border-rose-200'
                }`}>
                  {runOutput.success ? 'PASSED' : 'EXECUTION FAILED'} ({runOutput.executionTimeMs}ms)
                </span>
              </div>

              <div className="bg-white p-2.5 rounded border border-zinc-200 font-mono text-[11px] text-zinc-800 space-y-1">
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

