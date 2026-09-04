import React, { useEffect, useState } from 'react';
import { 
  ShieldCheck, Copy, Check, 
  Printer, RefreshCw, AlertCircle, BarChart3
} from 'lucide-react';

export const VerifiedSkillBadge: React.FC = () => {
  const badgeId = window.location.pathname.split('/verify/')[1] || '';

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);

  useEffect(() => {
    const fetchBadge = async () => {
      try {
        const res = await fetch(`/api/badges/verify/${badgeId}`);
        const json = await res.json();
        if (json.success) {
          setData(json.badge);
        } else {
          setError(json.error || 'Verified credential not found');
        }
      } catch (err: any) {
        setError(err.message || 'Error fetching credential verification');
      } finally {
        setLoading(false);
      }
    };
    fetchBadge();
  }, [badgeId]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center text-zinc-600 font-mono text-xs select-none">
        <div className="text-center space-y-2">
          <RefreshCw className="h-6 w-6 text-zinc-400 animate-spin mx-auto" />
          <p>Verifying Credential Signature...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-6 text-zinc-900 select-none">
        <div className="max-w-md bg-white border border-zinc-200 rounded p-6 text-center space-y-4 shadow-sm">
          <AlertCircle className="h-8 w-8 text-red-600 mx-auto" />
          <h2 className="text-base font-bold text-zinc-900">Unverified Credential Record</h2>
          <p className="text-xs text-zinc-600">{error || 'The requested skill credential could not be verified on the TechScreen registry.'}</p>
          <a href="/" className="inline-block px-4 py-2 bg-zinc-900 text-white text-xs font-semibold rounded">Return to Platform</a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 flex flex-col items-center justify-center p-4 sm:p-8 select-none">
      
      {/* Container Card */}
      <div className="max-w-2xl w-full bg-white border border-zinc-200 rounded overflow-hidden shadow-sm space-y-6 p-8">
        
        {/* Header */}
        <div className="text-center pb-6 border-b border-zinc-200 space-y-2">
          <div className="inline-flex items-center justify-center p-2.5 bg-zinc-100 rounded text-emerald-700 mb-1">
            <ShieldCheck className="h-8 w-8" />
          </div>
          
          <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-zinc-500">
            TECHSCREEN &bull; VERIFIED CANDIDATE CREDENTIAL
          </div>

          <h1 className="text-2xl font-bold text-zinc-900 tracking-tight">
            {data.candidateName}
          </h1>

          <p className="text-xs text-zinc-600">
            Technical Competency Certification for <strong className="text-zinc-900">{data.jobTitle}</strong>
          </p>
        </div>

        {/* Key Metrics Row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-center">
          <div className="bg-zinc-50 p-4 rounded border border-zinc-200">
            <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider block">Evaluation Score</span>
            <span className="text-2xl font-bold font-mono text-zinc-900 mt-0.5 block">{data.overallScore}%</span>
          </div>

          <div className="bg-zinc-50 p-4 rounded border border-zinc-200">
            <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider block">Integrity Trust Rating</span>
            <span className="text-2xl font-bold font-mono text-blue-700 mt-0.5 block">{data.trustScore}%</span>
          </div>

          <div className="col-span-2 sm:col-span-1 bg-zinc-50 p-4 rounded border border-zinc-200 flex flex-col justify-center items-center">
            <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider block">Status</span>
            <span className="text-xs font-mono font-bold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded border border-emerald-200 inline-block mt-1">
              VERIFIED PASS
            </span>
          </div>
        </div>

        {/* Skill Breakdown */}
        {data.sectionBreakdown && data.sectionBreakdown.length > 0 && (
          <div className="bg-zinc-50 p-5 rounded border border-zinc-200 space-y-3">
            <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wider flex items-center space-x-1.5 border-b border-zinc-200 pb-2">
              <BarChart3 className="h-4 w-4 text-zinc-500" />
              <span>Verified Domain Proficiencies</span>
            </h3>

            <div className="space-y-2.5 pt-1">
              {data.sectionBreakdown.map((sec: any, idx: number) => (
                <div key={idx} className="space-y-1">
                  <div className="flex justify-between text-xs font-medium">
                    <span className="text-zinc-800">{sec.title}</span>
                    <span className="text-blue-700 font-mono font-bold">{sec.percentage}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-zinc-200 rounded overflow-hidden">
                    <div className="h-full bg-blue-600" style={{ width: `${sec.percentage}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Signature Verification Stamp */}
        <div className="bg-zinc-50 p-4 rounded border border-zinc-200 space-y-2 text-xs font-mono text-zinc-600">
          <div className="flex justify-between items-center">
            <span>Credential ID:</span>
            <strong className="text-zinc-900">{data.badgeId}</strong>
          </div>
          <div className="flex justify-between items-center border-t border-zinc-200 pt-2">
            <span>Cryptographic Signature:</span>
            <strong className="text-zinc-900 text-[11px] truncate max-w-[280px]">{data.verificationSignature}</strong>
          </div>
          <div className="flex justify-between items-center border-t border-zinc-200 pt-2">
            <span>Issued Timestamp:</span>
            <strong className="text-zinc-900">{new Date(data.issuedAt).toLocaleDateString()}</strong>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
          <button
            onClick={() => window.print()}
            className="w-full sm:w-auto flex items-center justify-center space-x-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xs font-semibold px-4 py-2 rounded transition border border-zinc-200"
          >
            <Printer className="h-3.5 w-3.5" />
            <span>Print Verification Certificate</span>
          </button>

          <button
            onClick={handleCopyLink}
            className="w-full sm:w-auto flex items-center justify-center space-x-2 bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold px-5 py-2 rounded transition"
          >
            {isCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            <span>{isCopied ? 'Link Copied' : 'Share Verification Record'}</span>
          </button>
        </div>

      </div>

    </div>
  );
};
