import React, { useEffect, useState } from 'react';
import { OtpVerification } from './OtpVerification';
import { SystemCheck } from './SystemCheck';
import { AssessmentPlayer } from './AssessmentPlayer';
import { ResultView } from './ResultView';
import { AlertCircle, Clock } from 'lucide-react';

interface CandidateFlowProps {
  token: string;
}

export const CandidateFlow: React.FC<CandidateFlowProps> = ({ token }) => {
  const [assessmentData, setAssessmentData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Step state: 'VERIFY' | 'SYSTEM_CHECK' | 'PLAYER' | 'RESULT'
  const [step, setStep] = useState<'VERIFY' | 'SYSTEM_CHECK' | 'PLAYER' | 'RESULT'>('VERIFY');
  const [attemptId, setAttemptId] = useState<string>('');
  const [finalResult, setFinalResult] = useState<any>(null);

  const fetchAssessmentData = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/assessment/verify/${token}`);
      const data = await res.json();
      if (data.success) {
        setAssessmentData(data.data);

        // Determine step based on status
        if (data.data.latestAttempt?.isCompleted) {
          setFinalResult(data.data.latestAttempt.result);
          setStep('RESULT');
        } else if (data.data.isOtpVerified) {
          setStep('SYSTEM_CHECK');
        } else {
          setStep('VERIFY');
        }
      } else {
        setError(data.error || 'Invalid or expired assessment link.');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) fetchAssessmentData();
  }, [token]);

  const handleOtpVerified = () => {
    setStep('SYSTEM_CHECK');
  };

  const handleSystemCheckComplete = async () => {
    try {
      const res = await fetch('/api/assessment/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      });
      const data = await res.json();
      if (data.success) {
        setAttemptId(data.attempt.attemptId);
        setStep('PLAYER');
      } else {
        alert('Error starting assessment: ' + data.error);
      }
    } catch (err: any) {
      alert('Error starting assessment: ' + err.message);
    }
  };

  const handleAssessmentFinish = (result: any) => {
    setFinalResult(result);
    setStep('RESULT');
  };

  if (loading) {
    return (
      <div className="max-w-md mx-auto my-12 bg-white border border-zinc-200 rounded p-8 text-center text-zinc-600 space-y-3 select-none shadow-xs">
        <Clock className="h-6 w-6 text-zinc-400 animate-spin mx-auto" />
        <p className="text-xs font-mono">Verifying candidate link & assessment details...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-md mx-auto my-12 bg-white border border-zinc-200 rounded p-8 text-center text-zinc-800 space-y-4 select-none shadow-sm">
        <div className="p-2.5 bg-red-50 text-red-700 rounded border border-red-200 inline-block">
          <AlertCircle className="h-6 w-6" />
        </div>
        <div>
          <h3 className="text-base font-bold text-zinc-900 tracking-tight">Assessment Access Notice</h3>
          <p className="text-xs text-zinc-600 mt-1">{error}</p>
        </div>
        <button
          onClick={fetchAssessmentData}
          className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold rounded transition"
        >
          Retry Connection
        </button>
      </div>
    );
  }

  if (!assessmentData) return null;

  return (
    <div className="py-6">
      {step === 'VERIFY' && (
        <OtpVerification
          candidateName={assessmentData.candidate.name}
          candidateEmail={assessmentData.candidate.email}
          jobTitle={assessmentData.job.title}
          companyName={assessmentData.job.companyName}
          token={token}
          onVerifySuccess={handleOtpVerified}
        />
      )}

      {step === 'SYSTEM_CHECK' && (
        <SystemCheck
          jobTitle={assessmentData.job.title}
          onSystemCheckComplete={handleSystemCheckComplete}
        />
      )}

      {step === 'PLAYER' && (
        <AssessmentPlayer
          attemptId={attemptId}
          jobTitle={assessmentData.job.title}
          onAssessmentFinish={handleAssessmentFinish}
        />
      )}

      {step === 'RESULT' && (
        <ResultView
          result={finalResult}
          jobTitle={assessmentData.job.title}
          candidateName={assessmentData.candidate.name}
        />
      )}
    </div>
  );
};
