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
      <div className="max-w-md mx-auto my-12 bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center text-slate-400 space-y-4">
        <Clock className="h-8 w-8 text-blue-500 animate-spin mx-auto" />
        <p className="text-sm font-medium">Verifying Candidate Link & Assessment Details...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-md mx-auto my-12 bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center text-slate-300 space-y-4 shadow-2xl">
        <div className="p-3 bg-red-500/10 text-red-400 rounded-2xl inline-block">
          <AlertCircle className="h-8 w-8" />
        </div>
        <h3 className="text-xl font-bold text-white">Assessment Access Error</h3>
        <p className="text-xs text-slate-400">{error}</p>
        <button
          onClick={fetchAssessmentData}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-xl transition"
        >
          Try Again
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
