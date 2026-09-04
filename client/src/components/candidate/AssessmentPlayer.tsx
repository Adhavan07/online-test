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
      <div className="max-w-3xl mx-auto bg-white border border-zinc-200 rounded p-12 text-center text-zinc-500 font-mono text-xs select-none">
        <Clock className="h-6 w-6 text-zinc-400 animate-spin mx-auto mb-2" />
        <p>Loading Assessment Question...</p>
      </div>
    );
  }

  if (!currentData || !currentData.question) return null;

  const { currentIndex, totalQuestions, question } = currentData;
  const isLastQuestion = currentIndex + 1 >= totalQuestions;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const isUrgent = timeLeft <= 10;

  return (
    <div className="max-w-4xl mx-auto space-y-4 select-none text-zinc-900 py-6">
      
      {/* Proctoring Warning Banner */}
      {recentViolationMsg && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-2.5 rounded text-xs flex items-center justify-between font-mono">
          <div className="flex items-center space-x-2 font-semibold">
            <ShieldAlert className="w-4 h-4 text-red-600" />
            <span>{recentViolationMsg}</span>
          </div>
          <span className="text-[10px] uppercase px-2 py-0.5 rounded bg-red-100 text-red-800 border border-red-200">
            Flags: {violationCount}
          </span>
        </div>
      )}

      {/* Candidate Assessment Top Bar */}
      <div className="bg-white border border-zinc-200 rounded p-4 flex items-center justify-between">
        <div>
          <div className="text-[11px] font-mono text-zinc-500 uppercase tracking-wider">
            TECHSCREEN &bull; {jobTitle}
          </div>
          <div className="text-sm font-bold text-zinc-900 mt-0.5">
            Question <span className="font-mono">{currentIndex + 1}</span> of <span className="font-mono">{totalQuestions}</span> &bull; {question.sectionTitle}
          </div>
        </div>

        {/* 60s Countdown Timer */}
        <div className={`flex items-center space-x-2 px-3.5 py-1.5 rounded border font-mono font-bold text-sm ${
          isUrgent
            ? 'bg-red-50 border-red-300 text-red-700 animate-timer-urgent'
            : 'bg-zinc-50 border-zinc-200 text-zinc-900'
        }`}>
          <Clock className="h-4 w-4 text-zinc-500" />
          <span>{formatTime(timeLeft)}</span>
        </div>
      </div>

      {/* Question Card Container */}
      <div className="bg-white border border-zinc-200 rounded p-6 space-y-6">
        
        {/* Progress Strip */}
        <div className="w-full bg-zinc-100 h-1.5 rounded overflow-hidden">
          <div
            className="bg-blue-600 h-full transition-all duration-300"
            style={{ width: `${((currentIndex + 1) / totalQuestions) * 100}%` }}
          />
        </div>

        {/* Prompt Header */}
        <div className="space-y-1">
          <div className="text-[10px] font-mono font-semibold text-zinc-500 uppercase tracking-wider">
            {question.type === 'MCQ_SINGLE' ? 'Single Choice Question' : question.type === 'MCQ_MULTI' ? 'Multiple Choice Question' : 'Practical Coding Challenge'} &bull; {question.difficulty}
          </div>
          <h3 className="text-base font-bold text-zinc-900 leading-snug">{question.prompt}</h3>
        </div>

        {/* Question Input / Code Widget */}
        {question.type === 'CODING' ? (
          <div className="pt-1">
            <CodeEditorWidget
              questionId={question.id}
              initialCode={codeAnswer || question.codeTemplate || ''}
              sampleTestCases={question.sampleTestCases || []}
              onCodeChange={(val) => setCodeAnswer(val)}
            />
          </div>
        ) : (
          <div className="space-y-2 pt-1">
            {question.options.map((opt: { id: string; text: string }) => {
              const isSelected = selectedOptionIds.includes(opt.id);
              return (
                <div
                  key={opt.id}
                  onClick={() => toggleOption(opt.id, question.type)}
                  className={`p-3.5 rounded border cursor-pointer transition flex items-center justify-between text-xs ${
                    isSelected
                      ? 'bg-blue-50 border-blue-500 text-blue-900 font-semibold'
                      : 'bg-zinc-50/50 border-zinc-200 text-zinc-800 hover:border-zinc-300'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <div className={`w-4 h-4 rounded-${question.type === 'MCQ_SINGLE' ? 'full' : 'sm'} border flex items-center justify-center ${
                      isSelected ? 'bg-blue-600 border-blue-600 text-white' : 'border-zinc-300 bg-white'
                    }`}>
                      {isSelected && <div className={`w-1.5 h-1.5 rounded-${question.type === 'MCQ_SINGLE' ? 'full' : 'xs'} bg-white`} />}
                    </div>
                    <span>{opt.text}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Action Controls */}
        <div className="pt-4 border-t border-zinc-200 flex items-center justify-between text-xs">
          <div className="text-zinc-500 font-mono text-[11px]">
            Timer auto-submits upon expiry
          </div>

          <button
            onClick={handleManualSubmit}
            disabled={submitting}
            className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white font-semibold rounded flex items-center space-x-2 transition disabled:opacity-50"
          >
            <span>{isLastQuestion ? 'Submit Final Assessment' : 'Next Question'}</span>
            {isLastQuestion ? <Lock className="h-3.5 w-3.5" /> : <ArrowRight className="h-3.5 w-3.5" />}
          </button>
        </div>

      </div>

      {/* Integrity Monitor Footer */}
      <div className="bg-white border border-zinc-200 rounded px-4 py-2.5 flex items-center justify-between text-xs text-zinc-500 font-mono">
        <div className="flex items-center space-x-2 font-semibold text-zinc-900">
          <ShieldCheck className="h-4 w-4 text-emerald-600" />
          <span>INTEGRITY MONITOR</span>
        </div>
        <div className="flex items-center space-x-4 text-[11px]">
          <span className="flex items-center space-x-1"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> <span>Screen [OK]</span></span>
          <span className="flex items-center space-x-1"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> <span>Camera [OK]</span></span>
          <span className="flex items-center space-x-1"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> <span>Mic [OK]</span></span>
          <span className="flex items-center space-x-1"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> <span>Fullscreen [OK]</span></span>
        </div>
      </div>

    </div>
  );
};
