import React, { useEffect, useState, useRef } from 'react';
import { Clock, ShieldCheck, ArrowRight, CheckCircle2, Lock, AlertTriangle, ShieldAlert, Code2, Camera } from 'lucide-react';
import { CodeEditorWidget } from './CodeEditorWidget';

interface AssessmentPlayerProps {
  attemptId: string;
  jobTitle: string;
  token?: string;
  onAssessmentFinish: (result: any) => void;
}

export const AssessmentPlayer: React.FC<AssessmentPlayerProps> = ({
  attemptId,
  jobTitle,
  token,
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
  const [isScreenSharePaused, setIsScreenSharePaused] = useState<boolean>(false);
  const [isCameraDisconnected, setIsCameraDisconnected] = useState<boolean>(false);
  const [isFullscreenExited, setIsFullscreenExited] = useState<boolean>(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const selectedOptionIdsRef = useRef<string[]>(selectedOptionIds);
  const codeAnswerRef = useRef<string>(codeAnswer);
  const timeLeftRef = useRef<number>(timeLeft);
  const submittingRef = useRef<boolean>(submitting);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Initialize background webcam capture for periodic proctoring snapshots
  useEffect(() => {
    let camStream: MediaStream | null = null;
    navigator.mediaDevices?.getUserMedia({ video: { width: 320, height: 240 } })
      .then(stream => {
        camStream = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      })
      .catch(() => {
        setIsCameraDisconnected(true);
      });

    return () => {
      if (camStream) {
        camStream.getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  const captureWebcamSnapshot = async (reason: string = 'Periodic proctor check') => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (video.videoWidth === 0 || video.videoHeight === 0) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageBase64 = canvas.toDataURL('image/jpeg', 0.65);

    try {
      await fetch('/api/assessment/proctor-snapshot', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'x-assessment-token': token } : {}),
        },
        body: JSON.stringify({
          attemptId,
          imageBase64,
          eventType: 'WEBCAM_SNAPSHOT',
          details: reason,
          token,
        })
      });
    } catch (err) {
      console.warn('Failed to dispatch webcam snapshot', err);
    }
  };

  // Periodic proctoring snapshot interval (every 45 seconds)
  useEffect(() => {
    const interval = setInterval(() => {
      captureWebcamSnapshot('Periodic 45s interval frame');
    }, 45000);
    return () => clearInterval(interval);
  }, [attemptId, token]);

  useEffect(() => {
    selectedOptionIdsRef.current = selectedOptionIds;
  }, [selectedOptionIds]);

  useEffect(() => {
    codeAnswerRef.current = codeAnswer;
  }, [codeAnswer]);

  useEffect(() => {
    timeLeftRef.current = timeLeft;
  }, [timeLeft]);

  useEffect(() => {
    submittingRef.current = submitting;
  }, [submitting]);

  // Send real-time proctoring log to backend
  const logProctorEvent = async (eventType: string, details: string) => {
    try {
      setViolationCount(prev => prev + 1);
      setRecentViolationMsg(`Warning: ${details}`);
      await fetch('/api/assessment/proctor-event', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'x-assessment-token': token } : {}),
        },
        body: JSON.stringify({ attemptId, eventType, details, token })
      });
      setTimeout(() => setRecentViolationMsg(null), 6000);
    } catch (err) {
      console.error('Failed to log proctoring event', err);
    }
  };

  // Restore screen share on demand
  const restoreScreenShare = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      screenStreamRef.current = stream;
      const track = stream.getVideoTracks()[0];
      if (track) {
        track.onended = () => {
          setIsScreenSharePaused(true);
          logProctorEvent('SCREEN_SHARE_STOPPED', 'Candidate terminated screen sharing.');
        };
      }
      setIsScreenSharePaused(false);
      setRecentViolationMsg('Screen sharing restored successfully.');
    } catch (err) {
      console.error('Failed to restore screen share', err);
      alert('Screen sharing is mandatory. Please select Entire Screen to continue.');
    }
  };

  // Anti-Cheating & Proctoring Event Listeners
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        logProctorEvent('FOCUS_LOST', 'Tab switched or browser window lost focus.');
      }
    };

    let hasEnteredFullscreen = Boolean(document.fullscreenElement);
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        if (hasEnteredFullscreen) {
          logProctorEvent('FULLSCREEN_EXIT', 'Candidate exited full-screen proctoring mode.');
        }
        setIsFullscreenExited(true);
      } else {
        hasEnteredFullscreen = true;
        setIsFullscreenExited(false);
      }
    };

    const handleCopyPaste = (e: ClipboardEvent) => {
      e.preventDefault();
      logProctorEvent('COPY_PASTE', 'Attempted copy/paste operation inside assessment player.');
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      logProctorEvent('RIGHT_CLICK', 'Attempted right-click inside assessment player.');
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('copy', handleCopyPaste);
    document.addEventListener('paste', handleCopyPaste);
    document.addEventListener('contextmenu', handleContextMenu);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('copy', handleCopyPaste);
      document.removeEventListener('paste', handleCopyPaste);
      document.removeEventListener('contextmenu', handleContextMenu);
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(t => t.stop());
      }
    };
  }, [attemptId]);

  // Fetch active question
  const fetchQuestion = async (index?: number) => {
    setLoading(true);
    try {
      const url = index !== undefined
        ? `/api/assessment/question/${attemptId}?index=${index}${token ? `&token=${encodeURIComponent(token)}` : ''}`
        : `/api/assessment/question/${attemptId}${token ? `?token=${encodeURIComponent(token)}` : ''}`;
      const res = await fetch(url, {
        headers: {
          ...(token ? { 'x-assessment-token': token } : {}),
        }
      });
      const json = await res.json();

      if (json.success) {
        if (json.data.isCompleted) {
          onAssessmentFinish(json.data.result);
        } else {
          setCurrentData(json.data);
          setSelectedOptionIds(json.data.previousAnswer || []);
          setCodeAnswer(json.data.previousCodeAnswer || json.data.question.codeTemplate || '');
          // Server-synchronized remainingSeconds prevents timer resets on refresh!
          const duration = json.data.remainingSeconds !== undefined
            ? json.data.remainingSeconds
            : (json.data.timePerQuestionSeconds || 60);
          setTimeLeft(duration);
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
  }, [attemptId, token]);

  // Timer per question countdown loop (paused if screen share stops)
  useEffect(() => {
    if (loading || !currentData || currentData.isCompleted || isScreenSharePaused) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

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
  }, [loading, currentData, isScreenSharePaused]);

  const handleAutoSubmitOnExpiry = async () => {
    if (submittingRef.current || !currentData?.question) return;
    submittingRef.current = true;
    setSubmitting(true);
    try {
      const res = await fetch('/api/assessment/submit-answer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'x-assessment-token': token } : {}),
        },
        body: JSON.stringify({
          attemptId,
          questionId: currentData.question.id,
          selectedOptionIds: selectedOptionIdsRef.current,
          codeAnswer: currentData.question.type === 'CODING' ? codeAnswerRef.current : undefined,
          timeSpentSeconds: (currentData.timePerQuestionSeconds || 60) - timeLeftRef.current,
          token,
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
      submittingRef.current = false;
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

  const requestReenterFullscreen = async () => {
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
        setIsFullscreenExited(false);
      }
    } catch (err) {
      console.warn('Fullscreen request failed:', err);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-4 select-none text-zinc-900 py-6 relative">
      
      {/* Hidden elements for capturing automated proctoring snapshots */}
      <video ref={videoRef} autoPlay playsInline muted className="hidden" />
      <canvas ref={canvasRef} className="hidden" />

      {/* Dynamic Anti-Cheating Watermark Overlay (deter phone photo recording) */}
      <div className="pointer-events-none fixed inset-0 z-30 select-none overflow-hidden opacity-[0.035] flex flex-wrap items-center justify-around gap-20 p-8 rotate-[-12deg]">
        {Array.from({ length: 30 }).map((_, i) => (
          <div key={i} className="font-mono text-xs tracking-widest text-zinc-900 font-bold uppercase whitespace-nowrap">
            TECHSCREEN PRO &bull; VERIFIED CANDIDATE &bull; {jobTitle}
          </div>
        ))}
      </div>

      {/* Fullscreen Interruption Warning Modal */}
      {isFullscreenExited && (
        <div className="fixed inset-0 z-50 bg-zinc-950/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-amber-200 rounded-xl max-w-md w-full p-6 shadow-2xl space-y-4 text-center">
            <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-base font-bold text-zinc-900">Fullscreen Mode Exited</h3>
              <p className="text-xs text-zinc-600 leading-relaxed">
                This assessment requires full-screen proctoring mode. Your exit event has been recorded in the integrity audit log. Please return to fullscreen immediately.
              </p>
            </div>
            <button
              onClick={requestReenterFullscreen}
              className="w-full bg-amber-600 hover:bg-amber-700 text-white font-semibold py-2.5 rounded text-xs transition shadow-sm"
            >
              Re-enter Fullscreen Mode
            </button>
          </div>
        </div>
      )}

      {/* Screen Sharing Interruption Blocking Modal */}
      {isScreenSharePaused && (
        <div className="fixed inset-0 z-50 bg-zinc-950/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-red-200 rounded-xl max-w-md w-full p-6 shadow-2xl space-y-4 text-center">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-base font-bold text-zinc-900">Screen Sharing Interrupted</h3>
              <p className="text-xs text-zinc-600 leading-relaxed">
                Screen sharing is mandatory for this proctored assessment. The assessment question timer is currently paused. Please restore full screen sharing to resume your test.
              </p>
            </div>
            <button
              onClick={restoreScreenShare}
              className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg transition flex items-center justify-center space-x-2"
            >
              <span>Restore Screen Sharing</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

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

        <div className="flex items-center gap-3">
          {/* Active Proctoring Indicator */}
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded bg-zinc-50 border border-zinc-200 text-zinc-600 font-mono text-[11px]">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Proctored Session</span>
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
