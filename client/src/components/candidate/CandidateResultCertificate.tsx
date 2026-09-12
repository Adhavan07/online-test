import React, { useEffect, useState } from 'react';
import { Award, CheckCircle2, XCircle, Clock, ShieldCheck, Printer, ArrowRight, ExternalLink } from 'lucide-react';

interface CandidateResultCertificateProps {
  token: string;
}

export const CandidateResultCertificate: React.FC<CandidateResultCertificateProps> = ({ token }) => {
  const [resultData, setResultData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchResults = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/assessment/verify/${token}`);
        const json = await res.json();
        if (json.success && json.data) {
          const d = json.data;
          const resObj = d.latestAttempt?.result;
          setResultData({
            candidateName: d.candidate?.name || 'Candidate',
            candidateEmail: d.candidate?.email,
            jobTitle: d.job?.title || 'Technical Role',
            scorePercentage: resObj?.percentage ?? (resObj?.totalScore ? Math.round((resObj.totalScore / (resObj.maxScore || 1)) * 100) : 0),
            isPassed: resObj ? resObj.isPassed : d.status === 'PASSED' || d.status === 'HR_INTERVIEW',
            appliedAt: d.createdAt,
          });
        } else {
          setError(json.error || 'Unable to load assessment completion report.');
        }
      } catch (err: any) {
        setError('Unable to load assessment completion report.');
      } finally {
        setLoading(false);
      }
    };

    fetchResults();
  }, [token]);

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] text-zinc-900 flex items-center justify-center p-4 select-none">
        <div className="text-center space-y-2">
          <Clock className="h-6 w-6 text-zinc-400 animate-spin mx-auto" />
          <p className="text-xs font-mono text-zinc-500">Generating assessment verification certificate...</p>
        </div>
      </div>
    );
  }

  if (error || !resultData) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] text-zinc-900 flex items-center justify-center p-4 select-none">
        <div className="bg-white border border-zinc-200 p-8 rounded max-w-md w-full text-center space-y-4 shadow-xs">
          <XCircle className="h-10 w-10 text-rose-600 mx-auto" />
          <div>
            <h2 className="text-base font-bold text-zinc-900 tracking-tight">Record Unavailable</h2>
            <p className="text-xs text-zinc-500 mt-1">{error || 'No assessment record found for this token.'}</p>
          </div>
          <a href="/" className="inline-block px-3.5 py-1.5 bg-zinc-900 text-white text-xs font-medium rounded">
            Return to Dashboard
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-zinc-900 py-12 px-4 flex flex-col items-center justify-center select-none font-sans">
      
      {/* Top Action Bar */}
      <div className="print:hidden w-full max-w-3xl mb-6 flex justify-between items-center bg-white p-3.5 rounded border border-zinc-200 shadow-xs">
        <div className="flex items-center space-x-2">
          <ShieldCheck className="h-4 w-4 text-emerald-600" />
          <span className="font-bold text-xs text-zinc-900 font-mono uppercase tracking-wider">Verified Candidate Record</span>
        </div>
        <button
          onClick={handlePrint}
          className="flex items-center space-x-1.5 bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-medium px-3.5 py-1.5 rounded transition"
        >
          <Printer className="h-3.5 w-3.5" />
          <span>Print / Export PDF</span>
        </button>
      </div>

      {/* Certificate Sheet */}
      <div className="w-full max-w-3xl bg-white border border-zinc-200 rounded-md p-8 sm:p-12 shadow-sm relative print:border-none print:shadow-none space-y-8">
        
        {/* Certificate Header */}
        <div className="text-center space-y-2.5 pb-6 border-b border-zinc-200">
          <div className="inline-flex items-center space-x-1.5 bg-zinc-100 border border-zinc-200 px-2.5 py-0.5 rounded text-zinc-700 text-[10px] font-mono font-semibold uppercase tracking-wider">
            <ShieldCheck className="h-3.5 w-3.5 text-blue-600" />
            <span>TECHSCREEN ENTERPRISE AUDIT</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 tracking-tight">
            Technical Screening Assessment Report
          </h1>
          <p className="text-xs text-zinc-500 font-mono">Proctored First-Round Competency Verification</p>
        </div>

        {/* Candidate & Role Info */}
        <div className="space-y-6">
          <div className="text-center space-y-1">
            <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 block">Candidate Identity</span>
            <div className="text-2xl sm:text-3xl font-bold text-zinc-900 tracking-tight">
              {resultData.candidateName}
            </div>
            <p className="text-xs text-zinc-600">
              has completed automated technical screening for position <strong className="text-zinc-900 font-semibold">{resultData.jobTitle}</strong>.
            </p>
          </div>

          {/* Result Score Card */}
          <div className="bg-zinc-50 p-6 rounded border border-zinc-200 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
            <div className="space-y-0.5">
              <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-zinc-500 block">Overall Technical Score</span>
              <div className="text-4xl font-bold text-zinc-900 font-mono tracking-tight">
                {resultData.scorePercentage}%
              </div>
            </div>

            <div>
              {resultData.isPassed ? (
                <div className="flex items-center space-x-2 bg-emerald-50 text-emerald-800 border border-emerald-200 px-3.5 py-2 rounded font-mono text-xs font-bold">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span>QUALIFIED &bull; PASSED</span>
                </div>
              ) : (
                <div className="flex items-center space-x-2 bg-zinc-100 text-zinc-700 border border-zinc-200 px-3.5 py-2 rounded font-mono text-xs font-bold">
                  <Clock className="h-4 w-4 text-zinc-500" />
                  <span>COMPLETED &bull; UNDER THRESHOLD</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer Audit Details */}
        <div className="pt-6 border-t border-zinc-200 flex flex-col sm:flex-row items-center justify-between text-xs text-zinc-500 font-mono gap-3">
          <div className="space-y-0.5 text-center sm:text-left">
            <div>Token ID: <span className="text-zinc-800 font-semibold">{token}</span></div>
            <div>Issued: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</div>
          </div>

          <div className="text-right text-[11px] text-zinc-400">
            TechScreen Automated Proctoring Engine &bull; Integrity Verified
          </div>
        </div>

      </div>

    </div>
  );
};

