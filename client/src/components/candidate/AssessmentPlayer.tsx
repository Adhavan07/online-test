import React, { useEffect, useState, useRef } from 'react';
import { Clock, ShieldCheck, ArrowRight, CheckCircle2, Lock, AlertTriangle, ShieldAlert, Code2 } from 'lucide-react';
import { CodeEditorWidget } from './CodeEditorWidget';

interface AssessmentPlayerProps {
  attemptId: string;
  jobTitle: string;
  onAssessmentFinish: (result: any) => void;
}

export const AssessmentPlayer: React.FC<AssessmentPlayerProps> = ({
  attemptId,
  jobTitle,
  onAssessmentFinish,
}) => {
  const [currentData, setCurrentData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedOptionIds, setSelectedOptionIds] = useState<string[]>([]);
  const [codeAnswer, setCodeAnswer] = useState<string>('');
  const [timeLeft, setTimeLeft] = useState<number>(60);
  const [submitting, setSubmitting] = useState(false);
  const [violationCount, setViolationCount] = useState<number>(0);
  const [recentViolationMsg, setRecentViolationMsg] = useState<string | null>(null);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Send real-time proctoring log to backend
  const logProctorEvent = async (eventType: string, details: string) => {
    try {
      setViolationCount(prev => prev + 1);
      setRecentViolationMsg(`Warning: ${details}`);
      await fetch('/api/assessment/proctor-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attemptId, eventType, details })
      });
      // Clear alert banner after 6 seconds
      setTimeout(() => setRecentViolationMsg(null), 6000);
    } catch (err) {
      console.error('Failed to log proctoring event', err);
    }
  };

  // Anti-Cheating & Proctoring Event Listeners
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        logProctorEvent('FOCUS_LOST', 'Tab switched or browser window lost focus.');
      }
    };

    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        logProctorEvent('FULLSCREEN_EXIT', 'Candidate exited full-screen proctoring mode.');
      }
    };

    const handleCopyPaste = (e: ClipboardEvent) => {
      e.preventDefault();
      logProctorEvent('COPY_PASTE', 'Attempted copy/paste operation inside assessment player.');
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('copy', handleCopyPaste);
    document.addEventListener('paste', handleCopyPaste);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('copy', handleCopyPaste);
      document.removeEventListener('paste', handleCopyPaste);
    };
  }, [attemptId]);

  // Fetch active question
  const fetchQuestion = async (index?: number) => {
    setLoading(true);
    try {
      const url = index !== undefined ? `/api/assessment/question/${attemptId}?index=${index}` : `/api/assessment/question/${attemptId}`;
      const res = await fetch(url);
      const json = await res.json();

      if (json.success) {
        if (json.data.isCompleted) {
          onAssessmentFinish(json.data.result);
        } else {
          setCurrentData(json.data);
          setSelectedOptionIds(json.data.previousAnswer || []);
          setCodeAnswer(json.data.previousCodeAnswer || json.data.question.codeTemplate || '');
          setTimeLeft(json.data.timePerQuestionSeconds || 60);
          if (json.data.proctoringViolationsCount !== undefined) {
            setViolationCount(json.data.proctoringViolationsCount);
          }
        }
      }
    } catch (err) {
      console.error('Error fetching question:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuestion();
  }, [attemptId]);

  // Timer per question countdown loop
  useEffect(() => {
    if (loading || !currentData || currentData.isCompleted) return;

    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current as NodeJS.Timeout);
          // Auto-submit on 00:00 timer expiry!
          handleAutoSubmitOnExpiry();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [loading, currentData]);

  const handleAutoSubmitOnExpiry = async () => {
    if (submitting || !currentData?.question) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/assessment/submit-answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attemptId,
          questionId: currentData.question.id,
          selectedOptionIds,
          codeAnswer: currentData.question.type === 'CODING' ? codeAnswer : undefined,
          timeSpentSeconds: (currentData.timePerQuestionSeconds || 60) - timeLeft,
        })
      });
      const data = await res.json();
      if (data.success) {
        if (data.isCompleted) {
          onAssessmentFinish(data.result);
        } else {
          fetchQuestion(data.nextIndex);
        }
      }
    } catch (err) {
      console.error('Auto-submit error:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleManualSubmit = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    handleAutoSubmitOnExpiry();
  };

  const toggleOption = (optionId: string, type: 'MCQ_SINGLE' | 'MCQ_MULTI' | 'CODING') => {
    if (type === 'MCQ_SINGLE') {
      setSelectedOptionIds([optionId]);
    } else if (type === 'MCQ_MULTI') {
      setSelectedOptionIds(prev =>
        prev.includes(optionId) ? prev.filter(id => id !== optionId) : [...prev, optionId]
      );
    }
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center text-slate-400 space-y-4">
        <Clock className="h-8 w-8 text-blue-500 animate-spin mx-auto" />
        <p className="text-sm font-medium">Loading Assessment Question...</p>
      </div>
    );
  }

  if (!currentData || !currentData.question) return null;

  const { currentIndex, totalQuestions, question } = currentData;
  const isLastQuestion = currentIndex + 1 >= totalQuestions;

  // Format timer MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Timer visual urgency styling
  const isUrgent = timeLeft <= 10;
  const isWarning = timeLeft <= 25 && !isUrgent;

  return (
    <div className="max-w-5xl mx-auto space-y-4 select-none">
      
      {/* Proctoring Integrity Alert Banner */}
      {recentViolationMsg && (
        <div className="bg-rose-950/90 border border-rose-600 text-rose-200 px-4 py-3 rounded-2xl flex items-center justify-between shadow-2xl animate-bounce">
          <div className="flex items-center gap-2 font-bold text-xs">
            <ShieldAlert className="w-5 h-5 text-rose-400" />
            <span>{recentViolationMsg}</span>
          </div>
          <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-rose-900 text-rose-300 border border-rose-700">
            Total Flagged: {violationCount}
          </span>
        </div>
      )}

      {/* Top Assessment Header Container */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex items-center justify-between">
        <div>
          <div className="flex items-center space-x-2">
            <span className="font-extrabold text-white text-base">{jobTitle}</span>
            <span className="text-xs bg-slate-800 text-blue-400 font-semibold px-2.5 py-0.5 rounded border border-slate-700">
              {question.sectionTitle}
            </span>
            {question.type === 'CODING' && (
              <span className="text-xs bg-cyan-950 text-cyan-400 font-bold px-2 py-0.5 rounded border border-cyan-800/60 flex items-center gap-1">
                <Code2 className="w-3 h-3" /> Live Coding Question
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Question <strong className="text-white">{currentIndex + 1}</strong> of <strong className="text-white">{totalQuestions}</strong>
          </p>
        </div>

        {/* 60-Second / Coding Countdown Badge */}
        <div className={`flex items-center space-x-2 px-4 py-2 rounded-xl border transition-all ${
          isUrgent
            ? 'bg-red-950/60 border-red-500 text-red-400 animate-timer-urgent shadow-lg shadow-red-500/20'
            : isWarning
            ? 'bg-amber-950/40 border-amber-500/80 text-amber-400'
            : 'bg-slate-950 border-slate-800 text-blue-400'
        }`}>
          <Clock className={`h-5 w-5 ${isUrgent ? 'animate-bounce text-red-400' : ''}`} />
          <span className="text-xl font-mono font-extrabold tracking-wider">{formatTime(timeLeft)}</span>
        </div>
      </div>

      {/* Question Card Container */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl space-y-6">
        
        {/* Progress Bar */}
        <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800">
          <div
            className="bg-gradient-to-r from-blue-600 via-indigo-500 to-cyan-400 h-full transition-all duration-300"
            style={{ width: `${((currentIndex + 1) / totalQuestions) * 100}%` }}
          />
        </div>

        {/* Question Prompt */}
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
              {question.type === 'MCQ_SINGLE' ? 'Single Choice' : question.type === 'MCQ_MULTI' ? 'Select All That Apply' : 'Practical Coding Challenge'}
            </span>
            <span className="text-[11px] font-bold text-slate-500 uppercase">{question.difficulty}</span>
          </div>
          <h3 className="text-lg font-bold text-white leading-snug">{question.prompt}</h3>
        </div>

        {/* Render MCQ Options or Live Code Editor */}
        {question.type === 'CODING' ? (
          <div className="pt-2">
            <CodeEditorWidget
              questionId={question.id}
              initialCode={codeAnswer || question.codeTemplate || ''}
              sampleTestCases={question.sampleTestCases || []}
              onCodeChange={(val) => setCodeAnswer(val)}
            />
          </div>
        ) : (
          <div className="space-y-3 pt-2">
            {question.options.map((opt: { id: string; text: string }) => {
              const isSelected = selectedOptionIds.includes(opt.id);
              return (
                <div
                  key={opt.id}
                  onClick={() => toggleOption(opt.id, question.type)}
                  className={`p-4 rounded-2xl border cursor-pointer transition flex items-center justify-between ${
                    isSelected
                      ? 'bg-blue-950/40 border-blue-500 text-white shadow-md shadow-blue-500/10'
                      : 'bg-slate-950/60 border-slate-800/90 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center space-x-3 text-sm font-medium">
                    <div className={`w-5 h-5 rounded-${question.type === 'MCQ_SINGLE' ? 'full' : 'md'} border flex items-center justify-center transition ${
                      isSelected ? 'bg-blue-600 border-blue-500 text-white' : 'border-slate-700 bg-slate-900'
                    }`}>
                      {isSelected && <div className={`w-2 h-2 rounded-${question.type === 'MCQ_SINGLE' ? 'full' : 'sm'} bg-white`} />}
                    </div>
                    <span>{opt.text}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Bottom Control Bar */}
        <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
          <div className="text-xs text-slate-500 font-medium">
            Timer expires in <span className="font-mono font-bold text-slate-300">{timeLeft}s</span> (Auto-advance enabled)
          </div>

          <button
            onClick={handleManualSubmit}
            disabled={submitting}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm rounded-xl transition flex items-center space-x-2 shadow-lg shadow-blue-600/20 disabled:opacity-50"
          >
            <span>{isLastQuestion ? 'Lock & Submit Final Assessment' : 'Lock & Next Question'}</span>
            {isLastQuestion ? <Lock className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
          </button>
        </div>

      </div>

      {/* Proctoring Readiness Footer Indicator */}
      <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl px-4 py-2.5 flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center space-x-2 font-semibold text-emerald-400">
          <ShieldCheck className="h-4 w-4" />
          <span>Proctoring Integrity Engine: ACTIVE</span>
        </div>
        <div className="flex items-center space-x-4 text-[11px]">
          <span className="flex items-center space-x-1"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> <span>Focus Monitor</span></span>
          <span className="flex items-center space-x-1"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> <span>Fullscreen Check</span></span>
          <span className="flex items-center space-x-1"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> <span>Copy/Paste Protection</span></span>
          {violationCount > 0 && (
            <span className="text-rose-400 font-bold flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" /> {violationCount} Violations Logged
            </span>
          )}
        </div>
      </div>

    </div>
  );
};

