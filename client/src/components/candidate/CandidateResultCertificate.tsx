import React, { useEffect, useState } from 'react';
import { Award, CheckCircle2, XCircle, Clock, ShieldCheck, Printer, ArrowRight, BookOpen, ExternalLink } from 'lucide-react';

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
        const res = await fetch(`/api/assessment/question?token=${token}`);
        const data = await res.json();
        if (data.isCompleted) {
          // Fetch detailed candidate application info
          const candRes = await fetch(`/api/candidates`);
          const candData = await candRes.json();
          const currentCand = candData.candidates?.find((c: any) => c.token === token);
          setResultData({
            candidateName: currentCand?.name || 'Candidate',
            jobTitle: currentCand?.jobTitle || 'Technical Role',
            scorePercentage: currentCand?.scorePercentage || 0,
            isPassed: currentCand?.isPassed || false,
            appliedAt: currentCand?.appliedAt,
          });
        } else if (data.error) {
          setError(data.error);
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
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-slate-400 font-medium">Loading Assessment Completion Certificate...</p>
        </div>
      </div>
    );
  }

  if (error || !resultData) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4">
        <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl max-w-md w-full text-center space-y-4">
          <XCircle className="h-12 w-12 text-red-400 mx-auto" />
          <h2 className="text-xl font-bold">Report Unavailable</h2>
          <p className="text-xs text-slate-400">{error || 'No assessment record found for this token.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-12 px-4 flex flex-col items-center justify-center">
      
      {/* Print Hide Controls */}
      <div className="print:hidden w-full max-w-3xl mb-6 flex justify-between items-center bg-slate-900/80 backdrop-blur p-4 rounded-2xl border border-slate-800">
        <div className="flex items-center space-x-2">
          <Award className="h-5 w-5 text-blue-400" />
          <span className="font-bold text-sm text-white">Official Verification Report</span>
        </div>
        <button
          onClick={handlePrint}
          className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-4 py-2 rounded-xl transition shadow-lg shadow-blue-600/20"
        >
          <Printer className="h-4 w-4" />
          <span>Print / Export PDF</span>
        </button>
      </div>

      {/* Certificate Container */}
      <div className="w-full max-w-3xl bg-slate-900 border-2 border-slate-800 rounded-3xl p-8 sm:p-12 shadow-2xl relative overflow-hidden print:border-slate-300 print:bg-white print:text-black">
        
        {/* Glowing Background Effect */}
        <div className="absolute top-0 right-0 -mt-12 -mr-12 w-64 h-64 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -mb-12 -ml-12 w-64 h-64 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

        {/* Certificate Header */}
        <div className="text-center space-y-3 pb-8 border-b border-slate-800 print:border-slate-300">
          <div className="inline-flex items-center space-x-2 bg-blue-500/10 border border-blue-500/20 px-3.5 py-1 rounded-full text-blue-400 text-xs font-semibold uppercase tracking-wider">
            <ShieldCheck className="h-4 w-4" />
            <span>TechScreen Pro Certified Audit</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-white print:text-black tracking-tight">
            Technical Screening Evaluation Report
          </h1>
          <p className="text-xs text-slate-400 print:text-slate-600">Verified Skills Assessment & Proctoring Integrity Certificate</p>
        </div>

        {/* Candidate & Job Info */}
        <div className="py-8 space-y-6">
          <div className="text-center space-y-1">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest">This certifies that</span>
            <div className="text-2xl sm:text-3xl font-extrabold text-white print:text-black tracking-tight">
              {resultData.candidateName}
            </div>
            <p className="text-xs text-slate-400 print:text-slate-600">
              has completed the technical screening process for <strong className="text-blue-400 print:text-slate-900 font-bold">{resultData.jobTitle}</strong>.
            </p>
          </div>

          {/* Result Badge Card */}
          <div className="bg-slate-950 print:bg-slate-100 p-6 rounded-2xl border border-slate-800 print:border-slate-300 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
            <div className="space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Overall Score Percentage</span>
              <div className="text-4xl font-black text-white print:text-black tracking-tight">
                {resultData.scorePercentage}%
              </div>
            </div>

            <div className="flex items-center space-x-3">
              {resultData.isPassed ? (
                <div className="flex items-center space-x-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-4 py-2.5 rounded-xl font-bold text-sm">
                  <CheckCircle2 className="h-5 w-5" />
                  <span>QUALIFIED / PASSED</span>
                </div>
              ) : (
                <div className="flex items-center space-x-2 bg-slate-800 text-slate-300 border border-slate-700 px-4 py-2.5 rounded-xl font-bold text-sm">
                  <Clock className="h-5 w-5 text-indigo-400" />
                  <span>EVALUATION COMPLETED</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer Audit Details */}
        <div className="pt-8 border-t border-slate-800 print:border-slate-300 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 print:text-slate-600 gap-4">
          <div className="space-y-0.5 text-center sm:text-left">
            <div>Token ID: <span className="font-mono text-slate-300 print:text-slate-800">{token}</span></div>
            <div>Issued Date: {new Date().toLocaleDateString()}</div>
          </div>

          <div className="flex items-center space-x-1.5 font-bold text-slate-300 print:text-slate-800">
            <span>TechScreen Pro Platform Audit</span>
          </div>
        </div>

      </div>

    </div>
  );
};
