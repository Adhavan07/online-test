import React, { useEffect, useState, useRef } from 'react';
import { Clock, ShieldCheck, ArrowRight, CheckCircle2, Lock } from 'lucide-react';

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
  const [timeLeft, setTimeLeft] = useState<number>(60);
  const [submitting, setSubmitting] = useState(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

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
          setTimeLeft(json.data.timePerQuestionSeconds || 60);
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

  // 60-Second Timer per question countdown loop
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
          timeSpentSeconds: 60 - timeLeft,
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

  const toggleOption = (optionId: string, type: 'MCQ_SINGLE' | 'MCQ_MULTI') => {
    if (type === 'MCQ_SINGLE') {
      setSelectedOptionIds([optionId]);
    } else {
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
  const isUrgent = timeLeft <= 5;
  const isWarning = timeLeft <= 15 && !isUrgent;

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      
      {/* Top Assessment Header Container */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex items-center justify-between">
        <div>
          <div className="flex items-center space-x-2">
            <span className="font-extrabold text-white text-base">{jobTitle}</span>
            <span className="text-xs bg-slate-800 text-blue-400 font-semibold px-2.5 py-0.5 rounded border border-slate-700">
              {question.sectionTitle}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Question <strong className="text-white">{currentIndex + 1}</strong> of <strong className="text-white">{totalQuestions}</strong>
          </p>
        </div>

        {/* 60-Second Server Synced Countdown Badge */}
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
            className="bg-gradient-to-r from-blue-600 to-indigo-500 h-full transition-all duration-300"
            style={{ width: `${((currentIndex + 1) / totalQuestions) * 100}%` }}
          />
        </div>

        {/* Question Prompt */}
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
              {question.type === 'MCQ_SINGLE' ? 'Single Choice' : 'Select All That Apply'}
            </span>
            <span className="text-[11px] font-bold text-slate-500 uppercase">{question.difficulty}</span>
          </div>
          <h3 className="text-lg font-bold text-white leading-snug">{question.prompt}</h3>
        </div>

        {/* MCQ Options List */}
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
          <span>Proctoring Mode: ACTIVE</span>
        </div>
        <div className="flex items-center space-x-4 text-[11px]">
          <span className="flex items-center space-x-1"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> <span>Camera ✓</span></span>
          <span className="flex items-center space-x-1"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> <span>Screen ✓</span></span>
          <span className="flex items-center space-x-1"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> <span>Microphone ✓</span></span>
        </div>
      </div>

    </div>
  );
};
